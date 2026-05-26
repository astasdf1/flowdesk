# FlowDesk Stall Recovery — 독립 설계 V6

> **작성 배경**: V5 다관점 리뷰(2026-05-26)에서 `changes_required` 판정.
> 주요 보완 사항:
> 1. 스키마 선행 마이그레이션(P0) 분리: `spawned_by`, `pending_abort_warning`
> 2. `withTimeout` 타입 안전성 강화 (`Promise<T | undefined>`)
> 3. `node:test` 인프라 맞춤형 테스트 전략
> 4. Guard sign-off HMAC 알고리즘 구체화 및 Cancel 레코드 도입
> 5. 에러 로그 allow-list 필터링 및 fsync 동작 명확화
> 6. hook-only 타이머의 본질적 한계 명문화 및 UX 안내

---

## 1. 컴포넌트 설계 (V6)

### P0 — 스키마 선행 마이그레이션 (사전 작업)

실제 로직 구현 전, 아래 스키마와 증거 클래스를 등록해야 한다 (unknown property rejection 해결).

1. **`lane_lifecycle_record.v1` 확장**:
   - `spawned_by?: "flowdesk" | "user" | "external"` 필드 추가.
   - 기존 validator, fixture 업데이트.

2. **신규 증거 클래스 등록**:
   - `flowdesk.pending_abort_warning.v1`
   - `flowdesk.pending_abort_cancel.v1` (파일 삭제 대신 명시적 취소 레코드)
   - `FLOWDESK_SESSION_EVIDENCE_CLASSES`에 등록.

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

### P2 — SDK 스파이크 (P6 선결 조건)

**출력**: `docs/adr/0002-sdk-surface-verification.md`
- `session.abort()`의 SSE 스트림 종료 여부 확인.
- `session.messages()`의 reasoning phase 거동 확인.
- `p6_safe: true` 여부를 Guard sign-off와 동일한 HMAC 검증 방식으로 기록.

### P3 — stallAlert Timeout Wrapping (Discriminated Union + Exhaustive Check)

```typescript
type StallAlertResult =
  | { status: "ok"; data: FlowDeskChatMessageStallSummaryV1 }
  | { status: "unavailable" }
  | { status: "error" }
  | { status: "none" }

// 에러 로그 Allow-list
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
    process.stderr.write(`[flowdesk] collectStallAlertResult error: ${safeName}\n`)
    return { status: "error" }
  }
}

// Exhaustive check 강제
function assertNever(x: never): never {
  throw new Error("Unexpected object: " + x)
}

// ... switch (stallResult.status) ...
// default: assertNever(stallResult)
```

### P4 — Lane Abort Tool (`spawned_by` 검증 및 fsync)

- **Ownership 판별**: `spawned_by === "flowdesk"` 필드 명시. Legacy (undefined) 레코드는 레거시 종료일(sunset gate) 전까지만 수동 `/flowdesk-abort` 허용, 이때 사용자에게 `legacy_ownership_unverified` 경고 표시.
- **Workflow Prefix 검증**: `/flowdesk-abort` 진입점에만 "workflow-" prefix 검사 적용 (전역 evidence 검증 아님, 기존 테스트 보호).
- **fsync 원자성**: `fs.open` -> write -> `fs.fsync` -> `fs.close` -> parent directory `fs.fsync` 수행 (단일 인스턴스 기준 최대한의 원자성 확보).

### P5 — Session Health Check

```typescript
type FlowDeskSdkSessionHealthV1 =
  | { status: "api_responsive" }
  | { status: "api_timeout"; reason: string }
  | { status: "unknown"; reason: string }
```
- `session.messages()`를 통한 응답 확인 (단독 판정 금지, P6 보조 신호).

### P6 — Guarded Auto-Abort (Hook-only Timer + Explicit Cancel)

#### Hook-only Timer 한계 명문화
- **설계 제약**: background timer가 없으므로 `preAbortWarningMs`는 최소 지연 시간이다. 사용자가 채팅을 입력해야만 hook이 발화하여 abort가 실행됨. 문서 및 UX에 "다음 상호작용 시 실행됨"을 명시한다.

#### 명시적 취소 레코드
- pending_abort_warning 삭제가 아닌, `FlowDeskPendingAbortCancelV1` 증거를 기록하여 취소 이력 감사(Audit) 유지.

#### Guard Sign-off 무결성
- RFC 8785 Canonical JSON을 사용하여 `content_hash` 생성.
- FlowDesk가 구동 시 환경 변수 또는 키체인에 저장된 비밀키(HMAC)와 대조하여 위조 검증. 모델 출력을 통한 CLI 우회 방지.

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
3. **P2 (스파이크)**: SDK 동작 검증 및 ADR 서명.
4. **P3/P4 (1단계 구현)**: StallAlertResult exhaustive switch 도입, P4 ownership 기반 abort 툴 (fsync 포함).
5. **P5/P6 (2단계 구현)**: Guard Sign-off 기반 P6 Auto-Abort 적용 및 명시적 Cancel 도입.

이 순서를 통해 점진적으로 통합 복잡성과 스키마 위반 리스크를 줄인다.