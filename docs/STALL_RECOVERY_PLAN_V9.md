# FlowDesk Stall Recovery — 독립 설계 V9

> **작성 배경**: V8 다관점 리뷰(2026-05-26)에서 `changes_required` 판정.
> V8 작성 중 우발적으로 누락되었던 V7의 핵심 정책 명세(P5 Session Health, P6 비활성화 게이트,
> 결정 행렬 Fall-through, 구현 순서, Sunset 게이트 등)를 모두 복구하고, ADR Markdown 본문
> 바인딩 및 취소 상태(`cancel_state_unknown`)에 대한 fail-closed 처리를 강화한다.

---

## 1. 컴포넌트 설계 (V9)

### P0 — 스키마 선행 마이그레이션 (사전 작업)

1. **`lane_lifecycle_record.v1` 확장**:
   - `spawned_by?: "flowdesk" | "user" | "external"` 필드 추가.
   - 디렉토리 fsync 실패 식별을 위해 `durability?: "best_effort_no_dir_fsync"` 필드 추가.

2. **신규 증거 클래스 및 스키마 등록**:

**`pending_abort_warning.v1` 스키마 명세**:
```typescript
interface FlowDeskPendingAbortWarningV1 {
  schema_version: "flowdesk.pending_abort_warning.v1"
  warning_id: string
  workflow_id: string
  lane_id: string
  warning_issued_at: string   // ISO timestamp
  expires_at: string          // warning_issued_at + preAbortWarningMs
  cancel_command: string      // "/flowdesk-abort <lane_id> cancel"
  dispatch_authority_enabled: false
}
```

**`pending_abort_cancel.v1` 스키마 명세**:
```typescript
interface FlowDeskPendingAbortCancelV1 {
  schema_version: "flowdesk.pending_abort_cancel.v1"
  cancel_id: string
  warning_id_ref: string
  workflow_id: string
  lane_id: string
  cancelled_at: string
  cancel_reason: string       // "user_requested_via_command"
  cancel_actor: "user"        // Release 1에서는 "user"만 허용 (P6 Promotion 시 "system" 추가 가능)
  dispatch_authority_enabled: false
}
```

---

### P1 — `with-timeout.ts` (타입 안전성)

```typescript
export class FlowDeskTimeoutError extends Error {
  constructor(public readonly operationName: string, public readonly timeoutMs: number) {
    super(`FlowDesk: "${operationName}" timed out after ${timeoutMs}ms`)
    this.name = "FlowDeskTimeoutError"
  }
}

export async function withTimeout<T>(
  promise: Promise<T>,
  timeoutMs: number,
  operationName: string,
): Promise<T> {
  let handle: ReturnType<typeof setTimeout> | undefined
  // late rejection suppression (side-effect only, early rejection 보존)
  void promise.catch(() => undefined)
  const timeout = new Promise<never>((_, reject) => {
    handle = setTimeout(() => reject(new FlowDeskTimeoutError(operationName, timeoutMs)), timeoutMs)
  })
  try {
    return await Promise.race([promise, timeout])
  } finally {
    if (handle !== undefined) clearTimeout(handle)
  }
}

export const FLOWDESK_TIMEOUT_DEFAULTS = {
  sessionAbortMs: 10_000,
  sessionReadMs: 5_000,
  sessionDispatchMs: 30_000,
} as const
```

---

### P2 — SDK 스파이크 및 ADR Guard Sign-off

**ADR Guard Sign-off 무결성 보장 (HMAC & Canonical JSON)**:
- 파일 경로 명시: `docs/adr/0002-sdk-surface-verification.md`의 무결성 검증을 위해 **동일 경로**에 `0002-sdk-surface-verification.guard_sign_off.json` sidecar 파일을 둔다.
- **바인딩 및 해시**: ADR Markdown 본문의 SHA-256 Digest를 sidecar payload에 포함시킨다. 이를 통해 Markdown 변경 시 서명 검증이 실패하도록 강제한다.
- `content_hash` 생성 기준: **RFC 8785 Canonical JSON**으로 정규화한 문자열에 대해 **HMAC-SHA-256** 알고리즘 적용.
- Replay 방지: 스키마 내에 `nonce`, `expires_at`, `workflow_binding`, `p6_safe` 필드를 포함하여 서명 페이로드로 사용한다.

**HMAC 키 프로비저닝/로테이션/Fail-closed 정책**:
- **Key Source**: OS Keychain(키체인)을 최우선으로 사용한다.
- **Provisioning**: FlowDesk 설치/초기화 시 관리자가 오프라인으로 1회 주입. 모델 출력을 통한 자동 프로비저닝 금지.
- **Rotation**: 정기 업데이트 릴리스 시 키체인 로테이션 스크립트 실행.
- **Fail-closed**: 키가 주입되지 않았거나 파일 해시 불일치 시 조건 없는 실패(Fail-closed)로 처리한다. 프로덕션 환경에서 환경 변수(`FLOWDESK_GUARD_HMAC_KEY`) 폴백(Fallback) 사용은 금지되며, 명시적 developer-mode 플래그가 켜진 로컬 개발 환경에서만 허용된다.

---

### P3 — stallAlert Timeout Wrapping (Discriminated Union + Exhaustive Check)

```typescript
type StallAlertResult =
  | { status: "ok"; data: FlowDeskChatMessageStallSummaryV1 }
  | { status: "unavailable" }
  | { status: "error" }
  | { status: "none" }

const ALLOWED_ERROR_NAMES = new Set(["FlowDeskDiskError", "FlowDeskStateError"])

// Exhaustive Check Helper
function assertNever(x: never): never {
  throw new Error("Unexpected object: " + x)
}

async function collectStallAlertResult(
  stallAlert: FlowDeskChatMessageStallAlertOptionsV1,
  clock: FlowDeskLocalClockV1,
  deps: { statusLiveImpl?: typeof executeFlowDeskStatusLiveV1 } = {},
): Promise<StallAlertResult> {
  const statusLiveImpl = deps.statusLiveImpl ?? executeFlowDeskStatusLiveV1
  try {
    const observedAt = (typeof clock === "function" ? clock() : clock).toISOString()
    const result = await withTimeout(
      statusLiveImpl({ config: buildStatusLiveConfig(stallAlert), now: () => new Date(observedAt) }),
      stallAlert.statusLiveTimeoutMs ?? 8_000,
      "executeFlowDeskStatusLiveV1",
    )
    const summary = buildStallSummary(result, stallAlert)
    return summary !== undefined ? { status: "ok", data: summary } : { status: "none" }
  } catch (error) {
    if (error instanceof FlowDeskTimeoutError) return { status: "unavailable" }
    
    const errorName = error instanceof Error ? error.name : "UnknownError"
    const safeName = ALLOWED_ERROR_NAMES.has(errorName) ? errorName : "UnknownError"
    // error.message는 절대 로깅하지 않음 (식별자/경로/PII 누출 방지)
    process.stderr.write(`[flowdesk] collectStallAlertResult error: ${safeName}\n`)
    return { status: "error" }
  }
}
```

---

### P4 — Lane Abort Tool (Ownership, Legacy Sunset & Fsync Fallback)

**Workflow Reserved Prefixes 목록**:
- `/flowdesk-abort` 및 P6 진입점에 한하여 아래 4개의 예약된 Prefix만 허용하며, 불일치 시 거부한다.
  1. `workflow-quick-reviewer-`
  2. `workflow-quick-fallback-`
  3. `workflow-stall-recovery-`
  4. `workflow-provider-usage-`

**레거시 소유권(Legacy Ownership) 수동 취소 및 Sunset Gate**:
- `spawned_by`가 없는 기존 레거시 레코드에 대한 수동 `/flowdesk-abort`는 **Release 2 진입(또는 명시적 릴리스 버전 도달) 전까지만(Sunset Gate)** 허용한다.
- 수동 취소 시 Out-of-band confirmation(`/flowdesk-abort <lane_id> --confirm <lane_id>`)을 강제한다.

**디렉토리 fsync 예외 처리 (Durability Marker)**:
- `fs.open` -> write -> `fs.fsync` -> `fs.close` 후 parent directory `fs.fsync` 수행.
- 디렉토리 fsync 실패 시 에러를 던지지 않되, **`lane_lifecycle_record.v1`** (aborted 상태 레코드) 증거 파일에 **`durability: "best_effort_no_dir_fsync"`** 마커를 반드시 추가하고 write-then-read 검증을 수행.

---

### P5 — Session Health Check (복구)

```typescript
export type FlowDeskSdkSessionHealthV1 =
  | { status: "api_responsive" }
  | { status: "api_timeout"; reason: string }
  | { status: "unknown"; reason: string }

/**
 * session.messages()를 통한 응답 확인.
 * 단독 판정 금지. P6 auto-abort의 보조 신호로만 사용.
 */
async function checkSdkSessionApiHealth(
  client: FlowDeskManagedDispatchBetaOpenCodeClientV1,
  session_id: string,
  timeouts: FlowDeskTimeoutConfig,
): Promise<FlowDeskSdkSessionHealthV1> {
  if (typeof client.session.messages !== "function") {
    return { status: "unknown", reason: "sdk_messages_not_available" }
  }
  try {
    await withTimeout(
      client.session.messages({ path: { id: session_id } }) as Promise<unknown>,
      timeouts.sessionReadMs ?? FLOWDESK_TIMEOUT_DEFAULTS.sessionReadMs,
      "session.messages",
    )
    return { status: "api_responsive" }
  } catch (error) {
    if (error instanceof FlowDeskTimeoutError) {
      return { status: "api_timeout", reason: "messages_api_did_not_respond_within_threshold" }
    }
    return { status: "unknown", reason: "messages_api_error" }
  }
}
```

---

### P6 — Guarded Auto-Abort (비활성화 게이트 및 행렬 복구)

#### P6 강제 비활성화 게이트
P2 스파이크(reasoning phase 오탐 위험 등)가 완료되기 전까지 P6 코드는 강제 비활성화된다.
```typescript
function isAutoAbortEnabled(config, rootDir): boolean {
  if (!config.autoAbortOnStall) return false
  const spikeSignOff = loadSdkSpikeGuardSignOff(rootDir) // 0002-sdk-surface-verification.guard_sign_off.json
  // HMAC 검증 (RFC 8785 + SHA-256) 및 마크다운 본문 Digest 바인딩 검증 포함
  if (!spikeSignOff || !verifyGuardSignOffHmac(spikeSignOff) || spikeSignOff.p6_safe !== true) {
    return false // Fail-closed
  }
  return true
}
```

#### Confirmed Stall 규칙 및 결정 행렬

**stall_confirmed** = `(A) AND (C) AND (D_explicit)`
- `(A) Evidence stall`: 마지막 heartbeat/lifecycle 신호 > stallConfirmThresholdMs
- `(C) Lane state`: "running" 또는 "created"
- `(D_explicit)`: `spawned_by === "flowdesk"` 명시 필수 (레거시 불허)

| (A) | (C) | (D_explicit) | (B) API | P2 ADR | 결과 |
|-----|-----|--------------|---------|--------|------|
| ✅ | ✅ | ✅ | `api_timeout` | `p6_safe=true` | **pending warning 발급 (opt-in)** |
| ✅ | ✅ | ✅ | `api_timeout` | 없음 / false | **수동 권고** (likely_stall) |
| ✅ | ✅ | ✅ | `api_responsive`| any | **수동 권고** (likely_stall) |
| ✅ | ✅ | ✅ | `unknown` | any | **수동 권고** (probable_stall) |
| ✅ | ✅ | ❌ (Legacy) | any | any | P4 수동 abort만 (Out-of-band confirm 필요) |
| ✅ | ❌ | any | any | any | 조치 없음 |
| ❌ | any | any | any | any | 조치 없음 |

#### P6 Hook-only 자동 취소 상태머신
1. **경고 발급**: 조건 만족 시 `pending_abort_warning` evidence 작성 후 안내 카드 노출.
2. **다음 Hook 발화 시 평가**:
   - `now >= expires_at` 확인.
   - 명시적인 Cancel 레코드(`pending_abort_cancel`) 부재 확인.
   - 만약 Warning 레코드 파일만 삭제되고 Cancel 레코드가 없는 경우(`cancel_state_unknown`), **fail-closed(정지)** 처리하여 auto-abort를 진행하지 않고 수동 개입을 요구한다.
   - Stall reconfirmation (여전히 조건 A, C, D가 유지되는지 재확인).
3. **실행**: 위 조건을 모두 만족하면 P4의 `validateAndAbortLane`을 호출.

---

## 2. 테스트 전략 (node:test 인프라 반영)

### Unit (전역 Listener 해제 버그 수정 적용)

```typescript
import test from "node:test"
import assert from "node:assert"
import { mock } from "node:test"

test("withTimeout: late rejection suppression", async () => {
  mock.timers.enable({ apis: ["setTimeout"] })
  let unhandled = false
  const listener = () => { unhandled = true }
  process.on("unhandledRejection", listener)
  
  try {
    const lateReject = new Promise<never>((_, reject) => setTimeout(() => reject(new Error("late")), 50))
    const race = withTimeout(lateReject, 10, "op")
    mock.timers.tick(10)
    await Promise.resolve() // flush microtasks
    await assert.rejects(race, FlowDeskTimeoutError)
    
    mock.timers.tick(50)
    await Promise.resolve()
    assert.strictEqual(unhandled, false)
  } finally {
    mock.timers.reset()
    process.off("unhandledRejection", listener) // 특정 리스너만 해제
  }
})
```

---

## 3. 구현 순서 및 의존성 (복구)

| 단계 | 작업 | Release 1 |
|------|------|-----------|
| **P0** | `spawned_by`, `pending_abort_warning`, `pending_abort_cancel` 스키마 마이그레이션 | ✅ 필수 사전 작업 |
| **P1** | `withTimeout` 타입 안전성 강화 및 버그 수정 | ✅ R1 |
| **P2** | SDK 스파이크, ADR JSON Sidecar 서명 및 HMAC 키 프로비저닝 (P6-before-P2 Sequencing 보장) | ✅ R1 필수 |
| **P3/P4** | StallAlertResult exhaustive switch 도입, P4 ownership 기반 abort 툴 (fsync Directory fallback 포함) | ✅ R1 |
| **P5/P6** | P5 API Health Check 구현 및 Guard Sign-off 기반 P6 Auto-Abort 적용, 명시적 Cancel 레코드 도입 | ⚠️ R1 후반 |