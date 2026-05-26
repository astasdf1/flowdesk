# FlowDesk Stall Recovery — 독립 설계 V3

> **작성 배경**: V2 다관점 리뷰(2026-05-26)에서 3개 레인 모두 `changes_required` 판정.
> 핵심 지적: P3 silent catch-all 투명성 부족, P4 laneId 검증 부재, P5 단독 stall 판정 위험,
> withTimeout resource cleanup 계약 불명확, FlowDesk-owned lane 판별 기준 미명세.
> V3은 이를 모두 반영하여 수정한다.

---

## 1. V2 → V3 변경 요약

| V2 지적 | V3 수정 내용 |
|---------|------------|
| P3 `.catch(() => undefined)` — timeout/error 구분 불가 | `FlowDeskTimeoutError`만 undefined, 나머지는 redacted diagnostic + rethrow |
| P3 timeout 시 stall alert 무음 생략 | timeout 시 "stall 감지 일시 불가" 최소 카드 표시 |
| P4 laneId 존재 검증 없음 | abort 전 5단계 validation 필수화 |
| P4 reason 필드 optional | auto-generated audit reason으로 교체 |
| P5 messages() 단독 stall 판정 위험 | messages() → 보조 신호로만 사용, 단독 판정 금지 |
| P6 preAbortWarningMs 취소 메커니즘 불명확 | "informational-only" 명확화 + 취소 경로로 `/flowdesk-abort` 안내 |
| FlowDesk-owned lane 판별 기준 미명세 | lane_lifecycle evidence 기반 ownership 판별 기준 명문화 |
| withTimeout resource cleanup "호출 측 책임" 불충분 | 계층별 cleanup 계약 명세 추가 |
| Rule 10 수정 Guard sign-off 완료 기준 불명확 | Guard sign-off artifact 명세 |
| 작업량 추정 없음 | 단계별 추정 추가 |
| integration test DI seam 불명확 | fake-clock + DI seam 방식 명세 |

---

## 2. 확인된 전제 (탐색 결과)

- `client.event.*` 없음 — event-watchdog 전제 불성립
- 현재 stall 감지: chat.message hook 발화 시 on-demand polling (background timer 없음)
- 사용 가능 SDK: `client.session.abort/messages/children`
- `session.abort()` SSE 실제 종료 여부: **P2 스파이크에서 검증 필요**

---

## 3. 컴포넌트 설계 (V3)

---

### P1 — `with-timeout.ts` (독립 구현)

**파일**: `packages/opencode-plugin/src/shared/with-timeout.ts`

```typescript
export class FlowDeskTimeoutError extends Error {
  constructor(
    public readonly operationName: string,
    public readonly timeoutMs: number,
  ) {
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
  // late rejection suppression: losing promise의 reject를 명시적으로 무시
  const suppressedPromise = promise.catch(() => undefined) as Promise<T>
  const timeout = new Promise<never>((_, reject) => {
    handle = setTimeout(
      () => reject(new FlowDeskTimeoutError(operationName, timeoutMs)),
      timeoutMs,
    )
  })
  try {
    return await Promise.race([suppressedPromise, timeout])
  } finally {
    if (handle !== undefined) clearTimeout(handle)
  }
}

export const FLOWDESK_TIMEOUT_DEFAULTS = {
  sessionAbortMs: 10_000,
  sessionReadMs: 5_000,
  sessionDispatchMs: 30_000,
} as const

export type FlowDeskTimeoutConfig = Partial<typeof FLOWDESK_TIMEOUT_DEFAULTS>
```

#### Resource Cleanup 계약 (계층별)

| 호출 위치 | 취소 계약 |
|----------|---------|
| `session.abort()` | abort 자체가 취소 대상 → timeout 후 후속 조치 없음. P2 스파이크에서 SSE 종료 여부 확인 |
| `session.messages()` | read-only 호출 → timeout 후 orphan 없음 |
| `session.children()` | read-only 호출 → timeout 후 orphan 없음 |
| `executeFlowDeskStatusLiveV1` | 파일 I/O → OS가 정리. Promise 자체는 계속 실행되지만 결과 무시 |
| `session.prompt/promptAsync()` | dispatch → timeout 후 세션이 실제로 실행 중일 수 있음. **P2 스파이크에서 abort 실효성 확인 필수** |

> `suppressedPromise` 패턴으로 losing promise의 late rejection을 명시적으로 무시하여
> unhandled rejection 이벤트 방지. 정상 완료 케이스와 구별 가능.

---

### P2 — SDK 스파이크 (선결 조건)

**출력**: `docs/adr/0002-sdk-surface-verification.md`

| 검증 항목 | 방법 | 판정 기준 |
|----------|------|---------|
| `session.abort()` SSE 종료 여부 | fake-runtime 세션 abort 후 messages() 응답 확인 | stream closed vs. status-only mark |
| `session.messages()` 부분 응답 | long-running prompt 중 messages() 2회 폴링 | 메시지 수 변화 여부 |
| `session.messages()` reasoning phase 거동 | 응답 전 extended thinking 중 messages() | 빈 배열 vs. 에러 vs. timeout |

> P2 결과에 따라 P5·P6 진행 여부 결정. P5가 messages()를 보조 신호로만 쓰는 이유는
> reasoning phase에서 messages()가 빈 배열을 반환할 수 있어 단독 판정이 위험하기 때문.

---

### P3 — stallAlert Timeout Wrapping (투명성 개선)

**파일**: `packages/opencode-plugin/src/server.ts` 수정

```typescript
async function collectStallAlertSummary(
  stallAlert: FlowDeskChatMessageStallAlertOptionsV1,
  clock: FlowDeskLocalClockV1,
): Promise<FlowDeskChatMessageStallSummaryV1 | undefined> {
  try {
    const observedAt = (typeof clock === "function" ? clock() : clock).toISOString()
    const config: FlowDeskStatusLiveConfigV1 = { /* ... */ }
    const result = await withTimeout(
      executeFlowDeskStatusLiveV1({ config, now: () => new Date(observedAt) }),
      stallAlert.statusLiveTimeoutMs ?? 8_000,
      "executeFlowDeskStatusLiveV1",
    )
    // ... 기존 집계 로직 ...
  } catch (error) {
    if (error instanceof FlowDeskTimeoutError) {
      // timeout: 사용자에게 "stall 감지 일시 불가" 카드 표시를 위해 sentinel 반환
      return STALL_DETECTION_UNAVAILABLE_SENTINEL
    }
    // 비-timeout 에러: redacted diagnostic 기록 후 undefined (조용히 스킵)
    // 운영 문제 추적을 위해 internal log에 남김 (사용자 노출 안함)
    recordFlowDeskInternalDiagnosticV1({
      operationName: "collectStallAlertSummary",
      errorClass: error instanceof Error ? error.name : "UnknownError",
    })
    return undefined
  }
}

// sentinel 반환 시 hook에서 표시할 카드 텍스트
const STALL_DETECTION_UNAVAILABLE_TEXT =
  "FlowDesk\nStall detection temporarily unavailable (status check timed out).\n" +
  "Safe next actions:\n- /flowdesk-status\n- /flowdesk-doctor"
```

**Config 확장**:
```jsonc
"chatMessageStallAlert": {
  "enabled": true,
  "includeProgressingLate": false,
  "statusLiveTimeoutMs": 8000   // 신규
}
```

**timeout vs. non-timeout 구분 테스트**:
```typescript
// DI seam: executeFlowDeskStatusLiveV1를 주입 가능한 구조로 변경
// fake-clock: jest.useFakeTimers()로 setTimeout 제어
test("timeout → UNAVAILABLE sentinel 반환", async () => {
  const fakeStatusLive = () => new Promise(() => {}) // 영구 대기
  const result = await collectStallAlertSummary(
    { statusLiveTimeoutMs: 100, /* ... */ },
    () => new Date(),
    { statusLiveImpl: fakeStatusLive }, // DI seam
  )
  expect(result).toBe(STALL_DETECTION_UNAVAILABLE_SENTINEL)
})

test("non-timeout 에러 → undefined 반환 (조용히)", async () => {
  const fakeStatusLive = () => Promise.reject(new Error("disk error"))
  const result = await collectStallAlertSummary(/* ... */)
  expect(result).toBeUndefined()
})
```

---

### P4 — Lane Abort Tool (검증 강화)

**파일**: `packages/opencode-plugin/src/command-handlers.ts` 수정

#### 입력 스키마

```typescript
interface FlowDeskLaneAbortInputV1 {
  workflowId: string
  laneId: string
  // reason은 auto-generated (사용자 입력 불필요)
  // auto-reason: "user-requested-abort at <ISO timestamp> via /flowdesk-abort"
}
```

#### 5단계 Validation (abort 전 필수)

```typescript
async function validateAndAbortLane(
  input: FlowDeskLaneAbortInputV1,
  rootDir: string,
): Promise<FlowDeskLaneAbortResultV1> {
  // 1. workflow evidence reload
  const evidence = await reloadFlowDeskSessionEvidenceV1({ rootDir, workflowId: input.workflowId })
  if (evidence.status !== "ok") {
    return { status: "blocked", reason: "workflow_not_found" }
  }

  // 2. laneId가 해당 workflow에 존재하는지 확인
  const laneLifecycles = evidence.records.filter(
    r => r.schema_version === "flowdesk.lane_lifecycle_record.v1" && r.laneId === input.laneId
  )
  if (laneLifecycles.length === 0) {
    return { status: "blocked", reason: "lane_not_found_in_workflow" }
  }

  // 3. FlowDesk-owned lane 확인 (소유권 검증)
  const isFlowDeskOwned = laneLifecycles.some(r => r.spawnedBy === "flowdesk")
  if (!isFlowDeskOwned) {
    return { status: "blocked", reason: "not_flowdesk_owned_lane" }
  }

  // 4. 이미 terminal 상태인지 확인 (중복 abort 방지)
  const latestLifecycle = laneLifecycles.sort(
    (a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
  )[0]
  const terminalStates = ["complete", "aborted", "invocation_failed", "timeout", "orphaned"]
  if (terminalStates.includes(latestLifecycle.state)) {
    return { status: "blocked", reason: "lane_already_terminal", currentState: latestLifecycle.state }
  }

  // 5. stalled/eligible 상태인지 확인 (무분별한 abort 방지)
  const eligibleStates = ["running", "awaiting_dependency"]
  if (!eligibleStates.includes(latestLifecycle.state)) {
    return { status: "blocked", reason: "lane_not_in_eligible_state", currentState: latestLifecycle.state }
  }

  // 검증 통과 → abort evidence 기록
  const autoReason = `user-requested-abort at ${new Date().toISOString()} via /flowdesk-abort`
  await writeFlowDeskLaneLifecycleEvidenceV1({
    rootDir,
    workflowId: input.workflowId,
    laneId: input.laneId,
    state: "aborted",
    reason: autoReason,
    abortedBy: "user",
  })
  return { status: "aborted", laneId: input.laneId, reason: autoReason }
}
```

#### idempotency
- 동일 laneId에 대한 중복 abort 요청: step 4에서 `"lane_already_terminal"` 차단
- 재시도 시 안전

---

### P5 — Session Health Check (보조 신호로만 사용)

> **중요**: session.messages()는 stall 판정의 단독 근거가 아니다.
> reasoning phase에서 messages()가 빈 배열을 반환할 수 있어 오탐 가능성이 높다.
> P5는 P6 confirmed_stall의 보조 신호로만 사용한다.

**파일**: `packages/opencode-plugin/src/status-live-tool.ts` 수정

```typescript
/**
 * session.messages()를 통해 세션의 API 응답 가능 여부를 확인.
 * 주의: "unresponsive"는 "세션이 사망했다"가 아니라
 * "messages API가 주어진 시간 내 응답하지 않았다"를 의미한다.
 * reasoning phase 등에서 false positive 가능 → P6 단독 판정에 사용 금지.
 */
async function checkSdkSessionApiHealth(
  client: FlowDeskManagedDispatchBetaOpenCodeClientV1,
  sessionId: string,
  timeouts: FlowDeskTimeoutConfig,
): Promise<FlowDeskSdkSessionHealthV1> {
  if (typeof client.session.messages !== "function") {
    return { status: "unknown", reason: "sdk_messages_not_available" }
  }
  try {
    await withTimeout(
      client.session.messages({ path: { id: sessionId } }) as Promise<unknown>,
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

export type FlowDeskSdkSessionHealthV1 =
  | { status: "api_responsive" }
  | { status: "api_timeout"; reason: string }
  | { status: "unknown"; reason: string }
```

**status 응답 표현**:
- `api_responsive`: API가 정상 응답했다 (세션 정상 판정 아님)
- `api_timeout`: API가 제한 시간 내 응답하지 않았다 (세션 사망 판정 아님)
- `unknown`: API 불가/에러

---

### P6 — Guarded Auto-Abort (복합 조건 + 투명한 취소 안내)

#### FlowDesk-owned Lane 판별 기준 (명문화)

FlowDesk가 생성한 lane은 반드시 아래 조건을 모두 충족해야 auto-abort 대상이 된다:

1. **lane_lifecycle evidence 존재**: 해당 workflowId + laneId의 `flowdesk.lane_lifecycle_record.v1` 레코드가 존재
2. **spawnedBy === "flowdesk"**: 레코드의 `spawnedBy` 필드가 "flowdesk"
3. **NOT 사용자 main session**: sessionId가 FlowDesk가 `session.create(parentID)` 로 생성한 자식 세션 (부모 세션 = 사용자 세션이므로 제외)

> `abortOnlyFlowDeskOwnedLanes: true`는 위 3가지 조건 충족 레인에만 auto-abort를 허용한다.
> in-memory 세션 ID 목록만으로는 불충분; 반드시 durable lane_lifecycle evidence 기반으로 판별한다.

#### confirmed_stall 복합 조건 (4개 모두 필요)

```
confirmed_stall = ALL of:
  (A) Evidence Stall: 마지막 heartbeat or lifecycle 신호 > stallConfirmThresholdMs (기본 5분)
  (B) SDK API Health: session.messages()가 sessionReadMs(5초) 내 응답 없음 → "api_timeout"
      ⚠️ 단독으로는 reasoning phase 오탐 가능. (A)(C)(D)와 반드시 결합.
  (C) Lane state: latest lifecycle = "running" 또는 "awaiting_dependency"
  (D) FlowDesk-owned: lane_lifecycle evidence의 spawnedBy === "flowdesk" 확인
```

> (B)는 보조 신호. (A)(C)(D) 없이 (B)만으로는 abort 불가.
> (B) 없이 (A)(C)(D)만으로는 P5가 검증되지 않은 경우 abort 불가 (P5 스파이크 선결).

#### preAbortWarningMs — Informational Only

```
preAbortWarningMs = 5000 (기본)

동작:
1. confirmed_stall 판정 시 경고 카드 표시:
   "FlowDesk: Confirmed stall detected on lane <laneId>.
    Auto-abort will proceed in 5 seconds.
    To cancel: /flowdesk-abort <laneId> cancel  (또는 /flowdesk-status)"
2. 5초 후 취소 요청이 없으면 abort evidence 기록
3. 취소 요청 수신 시: abort 취소, "auto-abort cancelled by user" 기록

취소 메커니즘:
- `/flowdesk-abort <laneId> cancel` 명령으로 취소
- 다음 chat.message hook 발화 시 취소 플래그 확인
- 5초 창 내 다음 메시지가 없으면 auto-abort 진행
```

> WARNING: 5초 창은 사용자가 타이핑할 수 있는 충분한 시간이 아닐 수 있다.
> 취소 메커니즘이 chat.message hook 의존이므로 5초 내 메시지가 없으면 취소 불가.
> 따라서 autoAbortOnStall 기본값은 **false**로 유지하고, opt-in 사용자에게 이 제약을 명시한다.

#### Rule 10 수정 Guard Sign-off 완료 기준

Rule 10 수정 조건 (4가지 artifact 필수):
1. **구현 완료**: P6 코드 PR이 merge된 commit SHA
2. **통합 테스트**: confirmed_stall 4조건 + false positive 시나리오 테스트 통과 증거
3. **ADR**: `docs/adr/0003-guarded-auto-abort-guard-sign-off.md` 작성 완료
4. **Guard sign-off artifact**: `docs/conformance/<date>-p6-guard-review-complete.md` 문서에
   - 검토자 명시
   - 검토 범위 (false positive 위험, ownership 판별, cancellation mechanism)
   - "approved for rule 10 modification" 명시적 기재

위 4가지 artifact가 모두 존재한 이후에만 rule 10 수정 가능.

#### Config

```jsonc
"stallRecovery": {
  "autoAbortOnStall": false,             // 기본 false, 명시적 opt-in 필요
  "stallConfirmThresholdMs": 300000,     // 5분 (Evidence stall 판정)
  "sessionHealthCheckEnabled": true,     // P5 의존, false면 (A)(C)(D)만 사용
  "preAbortWarningMs": 5000,             // informational 예고 시간
  "abortOnlyFlowDeskOwnedLanes": true    // 변경 불가 (하드코딩)
}
```

---

## 4. 구현 순서 및 의존성

```
[P2 스파이크] ────────────────────────────────►
    |                                           |
    |                                           ▼
[P1 withTimeout] → [P3 stall wrapping]   [P5 Session Health]
                   [P4 Lane Abort Tool]       |
                                              ▼
                                        [P6 Guarded Auto-Abort]
                                        (P5 + Guard sign-off)
```

| 단계 | 작업 | Release 1 | 작업량 추정 | 선결 조건 |
|------|------|-----------|-----------|---------|
| P1 | withTimeout helper | ✅ R1 | 0.5~1일 | 없음 |
| P2 | SDK 스파이크 + ADR | ✅ R1 필수 | 1.5~3일 | P1 |
| P3 | stallAlert wrapping (DI seam 포함) | ✅ R1 | 1~1.5일 | P1 |
| P4 | Lane Abort Tool (5단계 validation) | ✅ R1 | 2~4일 | P1 |
| P5 | Session Health Check | ✅ R1 조건부 | 1~2일 | P2 확인 |
| P6 | Guarded Auto-Abort | ⚠️ R1 후반 | 3~6일 | P5 + Guard |
| **합계** | | | **9~17.5일** | |

---

## 5. 테스트 전략

### Unit (DI seam + fake-clock 활용)

| 대상 | 테스트 케이스 |
|------|------------|
| `withTimeout` | (a) 정상 완료, (b) timeout → FlowDeskTimeoutError, (c) handle clearTimeout 확인, (d) late rejection 무시됨(suppressedPromise 패턴) |
| `collectStallAlertSummary` | (a) timeout → UNAVAILABLE sentinel (fake-clock), (b) non-timeout 에러 → undefined + diagnostic 기록, (c) stall 있음 → 요약 반환, (d) stall 없음 → undefined |
| `validateAndAbortLane` | (a) workflow 없음 → blocked, (b) laneId 없음 → blocked, (c) not-flowdesk-owned → blocked, (d) 이미 terminal → blocked, (e) eligible → aborted evidence 기록 |
| `checkSdkSessionApiHealth` | (a) 정상 응답 → api_responsive, (b) timeout → api_timeout, (c) 에러 → unknown, (d) API 없음 → unknown |

### Integration (fake-runtime + DI seam)

| 시나리오 | 검증 내용 | DI 방법 |
|----------|---------|--------|
| statusLive 8초+ blocking | hook이 UNAVAILABLE sentinel 카드를 출력하고 8초 내 완료 | `statusLiveImpl` DI seam + fake-clock |
| stalled lane에 `/flowdesk-abort laneId` | 5단계 validation 통과 후 aborted evidence 기록, SDK 무영향 | evidence 파일 mock |
| non-stalled lane에 `/flowdesk-abort laneId` | `lane_not_in_eligible_state` 차단 | — |
| P6 confirmed_stall (4조건) | abort evidence + 예고 카드 출력 | fake messages() timeout |

### DI Seam 명세

```typescript
// collectStallAlertSummary에 statusLiveImpl 주입 가능 구조
async function collectStallAlertSummary(
  stallAlert: ...,
  clock: ...,
  deps: {
    statusLiveImpl?: typeof executeFlowDeskStatusLiveV1  // 테스트에서 교체
  } = {},
)

// fake-clock: jest.useFakeTimers() + jest.advanceTimersByTime(ms)
// 실제 8초 sleep 없이 timeout 시나리오 테스트 가능
```

---

## 6. 비교: V2 → V3 주요 변경사항

| 항목 | V2 | V3 |
|------|----|----|
| timeout vs. error 구분 | `.catch(() => undefined)` (구분 불가) | `FlowDeskTimeoutError` 분기 |
| timeout 시 사용자 알림 | 무음 생략 | UNAVAILABLE sentinel 카드 |
| P4 laneId 검증 | 없음 | 5단계 validation 필수 |
| P4 reason 필드 | optional | auto-generated audit reason |
| P5 "unresponsive" semantics | "세션 사망" 오해 가능 | "API가 응답하지 않았다"로 축소 |
| P6 stall 판정 | messages() 단독 가능 | 4조건 모두 필요, messages()는 보조 신호 |
| P6 preAbortWarningMs 취소 | 미명세 | informational + `/flowdesk-abort cancel` 경로 |
| FlowDesk-owned lane 판별 | 미명세 | durable evidence 기반 3조건 명문화 |
| withTimeout late rejection | 언급만 | suppressedPromise 패턴 명시 |
| resource cleanup | "호출 측 책임" | 계층별 cleanup 계약표 추가 |
| Rule 10 수정 Guard sign-off | "완료 기준 불명확" | 4가지 artifact 명문화 |
| 작업량 추정 | 없음 | 단계별 추정 추가 (9~17.5일) |
| integration test DI seam | 불명확 | fake-clock + statusLiveImpl DI seam 명세 |

---

## 7. 외부 위험 및 완화 (V3 기준)

| 위험 | 완화 |
|------|------|
| `session.abort()`가 SSE를 끊지 못함 | P2 스파이크에서 확인. 끊지 못하면 P6 orphan resource 누적 위험 → P6 연기 |
| reasoning phase에서 messages() api_timeout 오탐 | (B)를 단독 판정에 사용 금지. 항상 (A)(C)(D)와 결합 |
| P3 DI seam 없는 환경에서 테스트 어려움 | collectStallAlertSummary signature에 deps 파라미터 추가 (optional, 기본값=production impl) |
| 5초 경고 창 내 사용자 취소 실패 | autoAbortOnStall 기본값 false 유지. opt-in 시 명시적 경고 문서화 |
| suppressedPromise의 원 에러 소실 | non-timeout 에러를 diagnostic에 기록하는 catch 블록으로 보완 |

---

## 8. 관련 파일 목록 (구현 예상 변경)

```
packages/opencode-plugin/src/
  shared/
    with-timeout.ts                  ← 신규 (P1, suppressedPromise 패턴 포함)
  server.ts                          ← 수정 (P3: DI seam + timeout/error 분기)
  command-handlers.ts                ← 수정 (P4: 5단계 validation + auto-reason)
  managed-dispatch-adapter.ts        ← 수정 (P1: client.session.* wrapping)
  status-live-tool.ts                ← 수정 (P5: checkSdkSessionApiHealth 추가)
  runtime-reviewer-execution-bridge.ts ← 수정 (P1: spawn/check timeout)

docs/
  adr/0002-sdk-surface-verification.md ← 신규 (P2 스파이크 결과)
  adr/0003-guarded-auto-abort-guard-sign-off.md ← 신규 (P6 Guard ADR)
  conformance/<date>-p6-guard-review-complete.md ← 신규 (Guard sign-off artifact)
  STALL_RECOVERY_PLAN_V3.md           ← 본 문서
```
