# FlowDesk Stall Recovery — 독립 설계 V8

> **작성 배경**: V7 다관점 리뷰(2026-05-26)에서 `changes_required` 판정.
> 보완 사항:
> 1. HMAC 암호화 알고리즘(SHA-256), Canonical JSON(RFC 8785) 및 Replay 방지 필드 명세 추가.
> 2. 비밀키 Keychain 우선 원칙(프로덕션 환경변수 금지).
> 3. 레거시 레코드 수동 취소 시 Out-of-band confirmation(`lane_id` 직접 입력) 강제.
> 4. `pending_abort_warning` 전체 스키마 복구 및 P6 자동 취소 상태머신 구체화.
> 5. Exhaustive type check (`assertNever`) 복구.
> 6. 디렉토리 fsync 실패 시 `durability="best_effort_no_dir_fsync"` 마커 도입.
> 7. `cancel_actor` Release 1에서는 `"user"`만 허용.
> 8. 테스트 코드 전역 Listener 해제 버그 수정.

---

## 1. 컴포넌트 설계 (V8)

### P0 — 스키마 선행 마이그레이션 (사전 작업)

실제 로직 구현 전, 스키마와 증거 클래스를 등록한다.

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
  cancel_actor: "user"        // Release 1에서는 "user"만 허용 (P6 Promotion 시 "system" 추가)
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
  // late rejection suppression
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
```

---

### P2 — SDK 스파이크 및 ADR Guard Sign-off

**ADR Guard Sign-off 무결성 보장 (HMAC & Canonical JSON)**:
- ADR(markdown)의 무결성을 검증하기 위해 **JSON sidecar sign-off 레코드**를 사용한다.
- `content_hash` 생성 기준: **RFC 8785 Canonical JSON**으로 정규화한 문자열에 대해 **HMAC-SHA-256** 알고리즘 적용.
- Replay 방지: 스키마 내에 `nonce`, `expires_at`, `workflow_binding` 필드를 추가하여 복사/재사용 공격 차단.
- **HMAC 키 소스 정책**: OS Keychain(키체인)을 최우선으로 사용한다. 프로덕션 환경에서 환경 변수(`FLOWDESK_GUARD_HMAC_KEY`) 사용은 fail-closed(거부) 되며, 명시적 developer-mode 플래그가 켜진 로컬 개발 환경에서만 fallback으로 허용된다.

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
    process.stderr.write(`[flowdesk] collectStallAlertResult error: ${safeName}\n`)
    return { status: "error" }
  }
}

// Caller 사용 예시:
// switch (stallResult.status) {
//   case "ok": ... return;
//   case "unavailable": ... return;
//   case "error": ... return;
//   case "none": return;
//   default: assertNever(stallResult);
// }
```

---

### P4 — Lane Abort Tool (Ownership & Fsync Fallback)

**레거시 소유권(Legacy Ownership) 수동 취소**:
- `spawned_by`가 없는 레거시 레코드는 소유권 증명이 불확실(주입 공격 위험)하므로 수동 취소 시 경고 카드를 띄운다.
- 사용자는 반드시 **Out-of-band confirmation**으로 `/flowdesk-abort <lane_id> --confirm <lane_id>` 형태 등 `lane_id`를 직접 다시 입력해야만 abort가 승인된다.

**디렉토리 fsync 예외 처리 (Durability Marker)**:
- `fs.open` -> write -> `fs.fsync` -> `fs.close` 후 parent directory `fs.fsync`를 수행.
- 일부 파일시스템에서 디렉토리 fsync 실패 시 에러를 무시하되, 생성된 abort evidence에 **`durability: "best_effort_no_dir_fsync"`** 마커를 추가하고, write-then-read 검증을 수행한다. `/flowdesk-doctor`에서 이 마커를 표시한다.

**Workflow Prefix 규칙**:
- `/flowdesk-abort` 및 P6 진입점에 한하여 `workflow-quick-reviewer-` 등 FlowDesk 예약 Prefix 검증을 수행한다.

---

### P6 — Guarded Auto-Abort (Hook-only State Machine 복구)

**stall_confirmed 결정 행렬** = `(A) AND (C) AND (D_explicit)`
- `(A) Evidence stall`: 마지막 신호 > stallConfirmThresholdMs
- `(C) Lane state`: "running" 또는 "created"
- `(D_explicit)`: `spawned_by === "flowdesk"` 명시 필수

| (A) | (C) | (D_explicit) | (B) API (messages) | P2 ADR | 결과 |
|-----|-----|--------------|-------------------|--------|------|
| ✅ | ✅ | ✅ | `api_timeout` | `p6_safe=true` | **pending warning 발급 (opt-in)** |
| ✅ | ✅ | ✅ | `api_timeout` | 없음 / false | **수동 권고** (likely_stall) |
| ✅ | ✅ | ✅ | `api_responsive` | any | **수동 권고** (likely_stall) |
| ✅ | ✅ | ✅ | `unknown` | any | **수동 권고** (probable_stall) |
| ✅ | ✅ | ❌ (Legacy) | any | any | P4 수동 abort만 (Out-of-band confirm 필요) |

**P6 Hook-only 자동 취소 상태머신**:
1. **경고 발급**: 조건이 만족되면 `pending_abort_warning` evidence 작성 후 안내 카드 노출.
2. **다음 Hook 발화 시 평가**:
   - Durable pending warning 레코드 존재 확인.
   - `now >= expires_at` 만료 확인.
   - 명시적인 Cancel 레코드(`pending_abort_cancel`) 부재 확인 (파일 삭제를 Cancel로 간주하지 않음. Cancel 레코드 없이 warning 파일만 사라진 경우 'cancel_state_unknown' 감사 로그 후 재평가).
   - Stall reconfirmation (여전히 조건 A, C, D가 유지되는지 재확인).
3. **실행**: 위 조건을 모두 만족하면 P4의 `validateAndAbortLane`을 멱등성(Idempotency) 있게 호출.

---

## 2. 테스트 전략 (node:test 인프라 반영)

### Unit (전역 Listener 해제 버그 수정)

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
