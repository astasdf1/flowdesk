# FlowDesk Stall Recovery — 독립 설계 V7

> **작성 배경**: V6 다관점 리뷰(2026-05-26, Claude Opus 4.7)에서 `changes_required` 판정.
> V6가 문서를 압축하면서 V5의 중요한 감사(Audit) 및 통제 정책을 누락하는 퇴행(Regression)이 발생함.
> V7은 V5의 핵심 정책(결정 행렬, Prefix 규칙, 비활성화 게이트)을 복구하고, HMAC 키 관리,
> 레거시 소유권 Sunset 일정, 디렉토리 fsync 예외 처리 등 보안/운영 세부 사항을 명확히 정의한다.

---

## 1. 컴포넌트 설계 (V7)

### P0 — 스키마 선행 마이그레이션 (사전 작업)

실제 로직 구현 전, 아래 스키마와 증거 클래스를 등록해야 한다 (unknown property rejection 해결).

1. **`lane_lifecycle_record.v1` 확장**:
   - `spawned_by?: "flowdesk" | "user" | "external"` 필드 추가.
   - 기존 validator, fixture 업데이트.

2. **신규 증거 클래스 등록**:
   - `flowdesk.pending_abort_warning.v1`
   - `flowdesk.pending_abort_cancel.v1`
   - `FLOWDESK_SESSION_EVIDENCE_CLASSES`에 등록.

**`pending_abort_cancel.v1` 스키마 명세**:
```typescript
interface FlowDeskPendingAbortCancelV1 {
  schema_version: "flowdesk.pending_abort_cancel.v1"
  cancel_id: string
  warning_id_ref: string      // 취소 대상 warning_id
  workflow_id: string
  lane_id: string
  cancelled_at: string        // ISO timestamp
  cancel_reason: string       // "user_requested_via_command"
  cancel_actor: "user" | "system"
  dispatch_authority_enabled: false
}
```

---

### P1 — `with-timeout.ts` (타입 안전성 및 버그 수정)

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

### P2 — SDK 스파이크 및 ADR Guard Sign-off (P6 선결 조건)

**출력**: `docs/adr/0002-sdk-surface-verification.md`
- `session.abort()`의 SSE 스트림 종료 여부 확인.
- `session.messages()`의 reasoning phase 거동 확인.

**ADR HMAC Verification**:
- Markdown 파일 자체에 HMAC을 서명하는 것은 모호하므로, ADR 문서와 동일한 디렉토리에 **JSON sidecar sign-off 레코드**(`0002-sdk-surface-verification.guard_sign_off.json`)를 동봉한다.
- 런타임에는 이 JSON sidecar를 로드하여 `p6_safe: true` 여부와 HMAC 무결성을 검증한다.

---

### P3 — stallAlert Timeout Wrapping (Discriminated Union + Error Allow-list)

```typescript
type StallAlertResult =
  | { status: "ok"; data: FlowDeskChatMessageStallSummaryV1 }
  | { status: "unavailable" }
  | { status: "error" }
  | { status: "none" }

// 에러 로그 Allow-list (Exhaustive)
// 이 목록 외의 에러 이름은 모두 "UnknownError"로 축소됨. error.message는 절대 로깅 금지.
// 목록 확장은 반드시 Guard 리뷰를 거쳐야 함.
const ALLOWED_ERROR_NAMES = new Set(["FlowDeskDiskError", "FlowDeskStateError"])

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
    // error.message는 절대 포함하지 않음 (식별자/경로 누출 방지)
    process.stderr.write(`[flowdesk] collectStallAlertResult error: ${safeName}\n`)
    return { status: "error" }
  }
}
```

---

### P4 — Lane Abort Tool (`spawned_by` 검증 및 fsync)

**Ownership 판별 및 레거시 Sunset**:
- `spawned_by === "flowdesk"` 필드가 있는 레코드만 명시적 소유로 인정한다.
- `spawned_by`가 없는 기존 레거시 레코드에 대한 수동 `/flowdesk-abort`는 **Release 2 진입 전까지만(Sunset Gate)** 허용한다.
- 레거시 기간 동안 레거시 레코드에 대해 수동 abort를 시도할 경우, 사용자에게 `legacy_ownership_unverified` 경고 카드(잔존 주입 공격 위험 안내)를 표시한 뒤 진행한다. P6 자동 abort에서는 레거시 레코드를 절대 허용하지 않는다.

**Workflow Prefix 검증 규칙 복구**:
- `validateAndAbortLane` 진입점에서만 적용 (기존 테스트 오작동 방지).
- **Reserved Prefixes**:
  - `workflow-quick-reviewer-`
  - `workflow-quick-fallback-`
  - `workflow-stall-recovery-`
  - `workflow-provider-usage-`
- 이 prefix로 시작하지 않는 workflow_id는 abort 요청을 거부한다.

**fsync 디렉토리 Fallback**:
- `fs.open` -> write -> `fs.fsync` -> `fs.close` 후 parent directory `fs.fsync`를 수행.
- 일부 파일시스템(APFS, NFS)에서 디렉토리 fsync가 `EPERM` 또는 `ENOTSUP`을 반환할 수 있다. 이 경우 에러를 던지지 않고 경고 로그만 남긴 뒤 abort 처리를 정상 완료로 간주한다(Non-fatal fallback).

---

### P5 — Session Health Check

```typescript
type FlowDeskSdkSessionHealthV1 =
  | { status: "api_responsive" }
  | { status: "api_timeout"; reason: string }
  | { status: "unknown"; reason: string }
```
- `session.messages()`를 통한 응답 확인. 단독 판정 금지, P6 보조 신호.

---

### P6 — Guarded Auto-Abort (명시적 비활성화 및 행렬 복구)

#### P6 강제 비활성화 게이트 (복구)
P2 스파이크(reasoning phase 오탐 위험 등)가 완료되기 전까지 P6 코드는 강제 비활성화된다.
```typescript
function isAutoAbortEnabled(config, rootDir): boolean {
  if (!config.autoAbortOnStall) return false
  const spikeSignOff = loadSdkSpikeGuardSignOff(rootDir) // JSON sidecar
  // HMAC 검증 포함
  if (!spikeSignOff || !verifyGuardSignOffHmac(spikeSignOff) || spikeSignOff.p6_safe !== true) {
    return false
  }
  return true
}
```

#### Confirmed Stall 규칙 및 결정 행렬 (복구)

**stall_confirmed** = `(A) AND (C) AND (D_explicit)`
- `(A) Evidence stall`: 마지막 heartbeat/lifecycle 신호 > stallConfirmThresholdMs
- `(C) Lane state`: "running" 또는 "created"
- `(D_explicit)`: `spawned_by === "flowdesk"` 명시 필수 (레거시 불허)

| (A) Evidence | (C) State | (D_explicit) Owned | (B) API (messages) | P2 ADR | 결과 |
|-------------|-----------|--------------------|-------------------|--------|------|
| ✅ | ✅ | ✅ | `api_timeout` | `p6_safe=true` (HMAC OK) | **auto-abort** (opt-in) |
| ✅ | ✅ | ✅ | `api_timeout` | 없음 / false | **수동 권고** (likely_stall) |
| ✅ | ✅ | ✅ | `api_responsive` | any | **수동 권고** (likely_stall) |
| ✅ | ✅ | ✅ | `unknown` | any | **수동 권고** (probable_stall) |
| ✅ | ✅ | ❌ (Legacy) | any | any | P4 수동 abort만 (경고 표시) |
| ✅ | ❌ | any | any | any | 조치 없음 |
| ❌ | any | any | any | any | 조치 없음 |

#### Hook-only Timer UX 명확화 (AGENTS.md 규칙 준수)
- background timer 부재로 인한 지연을 명확히 함.
- 표시되는 경고 카드는 **steering-only**이며, "hard chat cancellation"이나 "no-reply authority"를 절대 주장하지 않는다. (Safety Rule 6 준수)
- 카드 내용: "Best-effort delayed auto-abort scheduled. It will execute on your next message. Send `/flowdesk-abort <lane_id> cancel` to prevent."

#### Guard Sign-off HMAC 키 관리 정책
- **Key Source**: OS 환경변수 `FLOWDESK_GUARD_HMAC_KEY` 또는 안전한 로컬 키체인.
- **Provisioning**: FlowDesk 설치/초기화 시 관리자가 오프라인으로 1회 주입. 모델 출력을 통한 자동 프로비저닝 금지.
- **Rotation**: 정기 업데이트 릴리스 시 키체인 로테이션 스크립트 실행 권장.
- **Fail-closed**: 키가 주입되지 않았거나, 파일 해시 불일치 시 조건 없는 실패(Fail-closed)로 처리. 무시(silent degradation) 금지.

---

## 2. 테스트 전략 (node:test 인프라 반영)

### Unit (node:test mock.timers 활용)

```typescript
import test from "node:test"
import assert from "node:assert"
import { mock } from "node:test"

test("withTimeout: late rejection suppression", async () => {
  mock.timers.enable({ apis: ["setTimeout"] })
  let unhandled = false
  process.on("unhandledRejection", () => { unhandled = true })
  
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
    process.removeAllListeners("unhandledRejection")
  }
})
```

---

## 3. 구현 순서

1. **P0 (사전)**: `spawned_by`, `pending_abort_warning`, `pending_abort_cancel` 스키마 마이그레이션.
2. **P1 (기반)**: `withTimeout` 타입 안전성 강화 및 버그 수정.
3. **P2 (스파이크)**: SDK 동작 검증, JSON Sidecar ADR 서명 및 HMAC 키 프로비저닝 메커니즘 구축.
4. **P3/P4 (1단계 구현)**: StallAlertResult exhaustive switch 도입, Prefix 검증 및 P4 ownership 기반 abort 툴 (fsync Directory fallback 포함).
5. **P5/P6 (2단계 구현)**: 결정 행렬 기반 Guarded P6 Auto-Abort 적용 및 명시적 Cancel 레코드 도입.