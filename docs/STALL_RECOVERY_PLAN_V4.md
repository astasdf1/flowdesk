# FlowDesk Stall Recovery — 독립 설계 V4

> **작성 배경**: V3 다관점 리뷰(2026-05-26)에서 3개 레인 모두 `changes_required`.
> 신규 critical 발견:
> 1. `suppressedPromise` 패턴이 early rejection을 삼키는 버그
> 2. `spawnedBy` 필드가 현재 `lane_lifecycle_record.v1` 스키마에 없음
> 3. P6 5초 취소 창이 hook-only 아키텍처에서 구현 불가
> V4는 이 세 가지를 포함해 모든 지적을 수정한다.

---

## 1. V3 → V4 변경 요약

| V3 지적 | V4 수정 |
|--------|---------|
| suppressedPromise early rejection 삼킴 버그 | `void promise.catch()` side-effect + `Promise.race([promise, timeout])` |
| `spawnedBy` 필드 스키마 미존재 | durable evidence 존재 여부 기반 ownership 판별로 재설계 + 스키마 확장 계획 |
| P6 5초 타이머 hook-only 불가 | "다음 hook 발화 시 경고 만료 확인" semantics로 재정의 |
| P3 UNAVAILABLE 카드 렌더링 경로 미명세 | hook 내부 sentinel → text part 변환 흐름 완전 명세 |
| `recordFlowDeskInternalDiagnosticV1` 미존재 | 기존 `@flowdesk/core` evidence 경로 활용 또는 stderr 로그로 단순화 |
| messages() (B) `api_responsive` 시 stall 판정 규칙 불명확 | (A)(C)(D) 충족 시 stall 판정, (B)는 P6 auto-abort의 추가 선결 조건 |
| P4 pseudocode 필드명 오류 (camelCase) | 실제 스키마 snake_case 기준으로 수정 |
| Guard sign-off 임의 텍스트 파일 대체 가능 | `flowdesk.guard_sign_off.v1` 최소 스키마 요건 정의 |
| TOCTOU atomic write 미명세 | 단일 인스턴스 전제 명문화 + write-then-read 검증 패턴 |

---

## 2. 확인된 전제

- `client.event.*` 없음
- 현재 stall 감지: `chat.message` hook on-demand polling, background timer 없음
- `client.session.{abort, messages, children}` 존재, SSE 종료 여부 P2 스파이크 필요
- FlowDesk는 단일 인스턴스로 동작 (multi-instance 경쟁 없음)

---

## 3. 컴포넌트 설계 (V4)

---

### P1 — `with-timeout.ts` (버그 수정)

**Early rejection 보존 + Late rejection suppression** 분리:

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

  // Late rejection suppression:
  // promise가 timeout 이후 reject하면 unhandled rejection 이벤트 발생.
  // void .catch()로 reaction을 미리 등록해 late rejection을 무시.
  // Early rejection(timeout 전)은 아래 Promise.race에서 정상 전파됨.
  void promise.catch(() => undefined)

  const timeout = new Promise<never>((_, reject) => {
    handle = setTimeout(
      () => reject(new FlowDeskTimeoutError(operationName, timeoutMs)),
      timeoutMs,
    )
  })

  try {
    // promise를 직접 race에 넣어 early rejection을 보존
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

export type FlowDeskTimeoutConfig = Partial<typeof FLOWDESK_TIMEOUT_DEFAULTS>
```

**동작 검증**:

| 시나리오 | 기대 동작 |
|---------|---------|
| promise가 timeout 전 resolve | 정상 값 반환, handle cleared |
| promise가 timeout 전 reject | early rejection 전파, handle cleared |
| timeout 먼저 발생 | FlowDeskTimeoutError, handle cleared |
| promise가 timeout 후 reject (late) | void .catch()로 무시, unhandled rejection 없음 |

**Resource Cleanup 계층별 계약**:

| 호출 위치 | cleanup 계약 |
|----------|------------|
| `session.messages()` / `session.children()` | read-only → orphan 없음 |
| `executeFlowDeskStatusLiveV1` | 파일 I/O → OS 정리, 결과 무시 |
| `session.abort()` | P2 스파이크에서 SSE 종료 여부 확인 |
| `session.prompt/promptAsync()` | dispatch → P2에서 abort 실효성 확인 필수 |

---

### P2 — SDK 스파이크 (선결 조건)

**출력**: `docs/adr/0002-sdk-surface-verification.md`

| 검증 항목 | 방법 |
|----------|------|
| `session.abort()` SSE 종료 여부 | fake-runtime 세션 abort 후 messages() 응답 확인 |
| `session.messages()` reasoning phase 거동 | extended thinking 중 messages() 결과 (빈 배열 vs timeout) |
| `session.messages()` 부분 응답 | long-running prompt 중 메시지 수 변화 |

---

### P3 — stallAlert Timeout Wrapping (완전한 렌더링 경로)

**파일**: `packages/opencode-plugin/src/server.ts`

#### 구현

```typescript
// DI seam을 위한 타입
type StatusLiveImpl = typeof executeFlowDeskStatusLiveV1
interface CollectStallAlertDeps {
  statusLiveImpl?: StatusLiveImpl
}

// sentinel: undefined와 구별되는 특수 객체
const STALL_DETECTION_UNAVAILABLE = Symbol("STALL_DETECTION_UNAVAILABLE")

async function collectStallAlertSummary(
  stallAlert: FlowDeskChatMessageStallAlertOptionsV1,
  clock: FlowDeskLocalClockV1,
  deps: CollectStallAlertDeps = {},
): Promise<FlowDeskChatMessageStallSummaryV1 | typeof STALL_DETECTION_UNAVAILABLE | undefined> {
  const statusLiveImpl = deps.statusLiveImpl ?? executeFlowDeskStatusLiveV1
  try {
    const observedAt = (typeof clock === "function" ? clock() : clock).toISOString()
    const config: FlowDeskStatusLiveConfigV1 = {
      rootDir: stallAlert.rootDir,
      ...(stallAlert.maxWorkflows !== undefined && { maxWorkflows: stallAlert.maxWorkflows }),
      ...(stallAlert.laneHeartbeatLateThresholdMs !== undefined && {
        laneHeartbeatLateThresholdMs: stallAlert.laneHeartbeatLateThresholdMs,
      }),
      ...(stallAlert.laneHeartbeatStallThresholdMs !== undefined && {
        laneHeartbeatStallThresholdMs: stallAlert.laneHeartbeatStallThresholdMs,
      }),
    }
    const result = await withTimeout(
      statusLiveImpl({ config, now: () => new Date(observedAt) }),
      stallAlert.statusLiveTimeoutMs ?? 8_000,
      "executeFlowDeskStatusLiveV1",
    )
    // ... 기존 집계 로직 ...
    return summary
  } catch (error) {
    if (error instanceof FlowDeskTimeoutError) {
      // timeout: 사용자에게 감지 불가 카드 표시
      return STALL_DETECTION_UNAVAILABLE
    }
    // non-timeout 에러: stderr 로그 + undefined (silent skip)
    // production에서 stderr는 opencode 로그로 캡처됨
    const safeMessage = error instanceof Error ? error.name : "UnknownError"
    process.stderr.write(
      `[flowdesk] collectStallAlertSummary non-timeout error: ${safeMessage}\n`,
    )
    return undefined
  }
}
```

#### UNAVAILABLE sentinel → 카드 렌더링 흐름 (완전 명세)

```typescript
// server.ts chat.message hook 내부
const stallSummary = await collectStallAlertSummary(stallAlert, clock, deps)

if (stallSummary === STALL_DETECTION_UNAVAILABLE) {
  // timeout 시: UNAVAILABLE 카드 표시
  const key = `${sessionRef}|stall-detection-unavailable`
  if (!isDuplicateStallAlert(key, recentStallAlerts, clock)) {
    output.parts.push(buildTextPart(STALL_DETECTION_UNAVAILABLE_TEXT))
    recordStallAlertKey(key, recentStallAlerts, clock)
  }
  return  // 이후 stall alert 로직 skip
}

if (stallSummary === undefined) {
  return  // non-timeout 에러 또는 stall 없음: 조용히 skip
}

// 기존 stall/late 카드 로직 계속 ...
const STALL_DETECTION_UNAVAILABLE_TEXT =
  "FlowDesk\n" +
  "Stall detection temporarily unavailable (status check timed out).\n" +
  "Safe next actions:\n" +
  "- /flowdesk-status\n" +
  "- /flowdesk-doctor"
```

**Config 확장**:
```jsonc
"chatMessageStallAlert": {
  "enabled": true,
  "includeProgressingLate": false,
  "statusLiveTimeoutMs": 8000
}
```

---

### P4 — Lane Abort Tool (스키마 정합화 + 5단계 Validation)

#### FlowDesk-owned Lane Ownership 판별 기준 (스키마 없이 동작)

**현재 스키마 기반 판별 전략**:

FlowDesk가 생성한 lane은 반드시 FlowDesk의 durable evidence 경로에
`lane_lifecycle` 레코드가 존재한다.
(`reloadFlowDeskSessionEvidenceV1`로 로드한 레코드가 있으면 FlowDesk가 생성한 것)

이 판별은 `spawnedBy` 필드 없이도 가능하다:
- FlowDesk는 자신이 spawn한 lane에 대해서만 `.flowdesk/sessions/<workflowId>/evidence/lane-lifecycle/` 아래 파일을 기록한다
- 사용자 main session은 FlowDesk가 lane_lifecycle evidence를 기록하지 않는다
- 따라서 "해당 workflowId + laneId에 FlowDesk lane_lifecycle evidence가 존재하면 = FlowDesk-owned"

> **스키마 확장 계획 (별도 ADR)**: 향후 `spawnedBy: "flowdesk" | "user" | "external"` 필드를
> `lane_lifecycle_record.v1`에 추가. 현재 V4는 existence-based 판별로 동작하고,
> ADR 확정 후 해당 필드로 교체한다.

#### 입력 스키마

```typescript
interface FlowDeskLaneAbortInputV1 {
  workflow_id: string   // snake_case (실제 스키마 기준)
  lane_id: string       // snake_case
  // reason: auto-generated, 사용자 입력 없음
}
```

#### 5단계 Validation (실제 필드명 기준)

```typescript
async function validateAndAbortLane(
  input: FlowDeskLaneAbortInputV1,
  rootDir: string,
): Promise<FlowDeskLaneAbortResultV1> {

  // 1. workflow evidence reload
  const evidence = await reloadFlowDeskSessionEvidenceV1({
    rootDir,
    workflowId: input.workflow_id,
  })
  if (evidence.status !== "ok") {
    return { status: "blocked", reason: "workflow_not_found" }
  }

  // 2. laneId가 해당 workflow의 lane_lifecycle evidence에 존재하는지 확인
  //    (실제 필드: lane_id, workflow_id, updated_at — snake_case)
  const laneRecords = evidence.records.filter(
    (r): r is FlowDeskLaneLifecycleRecordV1 =>
      r.schema_version === "flowdesk.lane_lifecycle_record.v1" &&
      r.lane_id === input.lane_id,
  )
  if (laneRecords.length === 0) {
    return { status: "blocked", reason: "lane_not_found_in_workflow" }
  }

  // 3. FlowDesk-owned lane 확인 (existence-based)
  //    lane_lifecycle evidence가 존재하면 FlowDesk가 생성한 lane
  //    (FlowDesk는 자신이 생성하지 않은 lane의 evidence를 기록하지 않음)
  //    → 이 단계는 step 2에서 이미 확인됨: records 존재 = FlowDesk-owned
  //    단, 향후 spawnedBy 필드 추가 시 이 단계에서 명시적 확인으로 교체

  // 4. 이미 terminal 상태인지 확인 (중복 abort 방지, idempotency)
  //    실제 스키마의 terminal states
  const terminalStates = new Set([
    "complete", "aborted", "invocation_failed", "timeout", "orphaned",
  ])
  const latestRecord = laneRecords.sort(
    (a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime(),
  )[0]
  if (terminalStates.has(latestRecord.state)) {
    return {
      status: "blocked",
      reason: "lane_already_terminal",
      current_state: latestRecord.state,
    }
  }

  // 5. eligible 상태인지 확인
  //    현재 lane_lifecycle_record.v1의 실제 active states
  const eligibleStates = new Set(["running", "created"])
  if (!eligibleStates.includes(latestRecord.state)) {
    return {
      status: "blocked",
      reason: "lane_not_in_eligible_state",
      current_state: latestRecord.state,
    }
  }

  // 검증 통과 → abort evidence 기록
  // write-then-read 검증 (단일 인스턴스 TOCTOU 완화)
  const autoReason =
    `user-requested-abort at ${new Date().toISOString()} via /flowdesk-abort`
  await writeFlowDeskLaneLifecycleEvidenceV1({
    rootDir,
    workflow_id: input.workflow_id,
    lane_id: input.lane_id,
    state: "aborted",
    reason: autoReason,
    updated_at: new Date().toISOString(),
  })

  // write 후 reload 검증 (원자성 대신 write-then-verify)
  const reloaded = await reloadFlowDeskSessionEvidenceV1({
    rootDir,
    workflowId: input.workflow_id,
  })
  const abortVerified = reloaded.status === "ok" &&
    reloaded.records.some(
      r => r.schema_version === "flowdesk.lane_lifecycle_record.v1" &&
           r.lane_id === input.lane_id &&
           r.state === "aborted",
    )
  if (!abortVerified) {
    return { status: "write_failed", reason: "abort_evidence_not_persisted" }
  }

  return { status: "aborted", lane_id: input.lane_id, reason: autoReason }
}
```

> **TOCTOU 완화**: FlowDesk는 단일 인스턴스이므로 실질적 경합 없음.
> write-then-read 검증으로 쓰기 실패 감지. multi-instance 지원은 별도 gate.

---

### P5 — Session Health Check (semantics 명확화)

```typescript
/**
 * session.messages() API의 응답 가능 여부를 확인한다.
 *
 * ⚠️ 의미 범위:
 * - "api_responsive" = API가 제한 시간 내에 응답했다
 *   (세션 정상 또는 작업 완료를 보장하지 않음)
 * - "api_timeout" = API가 제한 시간 내에 응답하지 않았다
 *   (세션 사망 판정이 아님. reasoning phase에서 false positive 가능)
 * - "unknown" = API 미지원 또는 비-timeout 에러
 *
 * P6 confirmed_stall의 추가 확인 신호로만 사용.
 * 단독으로 stall 또는 abort를 결정하는 데 사용 금지.
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
      return {
        status: "api_timeout",
        reason: "messages_api_did_not_respond_within_threshold",
      }
    }
    return { status: "unknown", reason: "messages_api_error" }
  }
}

export type FlowDeskSdkSessionHealthV1 =
  | { status: "api_responsive" }
  | { status: "api_timeout"; reason: string }
  | { status: "unknown"; reason: string }
```

---

### P6 — Guarded Auto-Abort (Hook-only Semantics 재정의)

#### confirmed_stall 판정 규칙 (명확화)

```
stall_confirmed = (A) AND (C) AND (D)
  (A) Evidence Stall: 마지막 heartbeat/lifecycle 신호 > stallConfirmThresholdMs
  (C) Lane state: latest lifecycle = "running" 또는 "created"
  (D) FlowDesk-owned: workflowId + lane_id의 lane_lifecycle evidence 존재

(B) session.messages() api_timeout 은 P6 auto-abort의 추가 선결 조건:
  - stall_confirmed AND (B)=api_timeout → auto-abort 허용
  - stall_confirmed AND (B)=api_responsive → auto-abort 하지 않음
    (reasoning 중인 정상 세션일 수 있음 → 사용자에게 수동 판단 위임)
  - stall_confirmed AND (B)=unknown → auto-abort 하지 않음

/flowdesk-status 표시:
  - stall_confirmed=true, (B)=api_responsive → "Stall detected, session API responsive
    (may be in reasoning phase). Manual abort recommended: /flowdesk-abort <lane_id>"
  - stall_confirmed=true, (B)=api_timeout   → "Confirmed stall + API unresponsive.
    Auto-abort will proceed on next message."
```

#### Hook-only 취소 메커니즘 (재정의)

**문제**: background timer 없음 → "5초 후 자동 abort" 구현 불가.

**V4 semantics**:

```
preAbortWarningMs = 경고 발행 후 다음 chat.message hook 발화 시 경과 시간 기준.

흐름:
1. confirmed_stall (A)(B)(C)(D) 모두 충족 시:
   a. 경고 카드 출력 + pending_abort_warning 기록:
      { lane_id, workflow_id, warning_issued_at: now, cancel_command: "/flowdesk-abort <lane_id> cancel" }
   b. 사용자에게 취소 방법 명시: "Send '/flowdesk-abort <lane_id> cancel' to prevent."
   c. pending_abort_warning은 in-memory (또는 durable evidence로 선택적 저장)

2. 다음 chat.message hook 발화 시:
   a. pending_abort_warning 확인
   b. now - warning_issued_at >= preAbortWarningMs → abort 진행
   c. now - warning_issued_at < preAbortWarningMs → 아직 대기 (경고 카드 재표시 안함)
   d. 사용자 메시지에 "/flowdesk-abort <lane_id> cancel" 포함 → pending_abort_warning 취소

3. auto-abort 진행 시:
   - validateAndAbortLane() 호출
   - flowdesk.lane_stall_recovery.v1 evidence 기록

비고:
- "preAbortWarningMs 후 abort"는 "preAbortWarningMs가 경과한 이후 다음 hook 발화 시 abort"를 의미.
- 사용자가 preAbortWarningMs 동안 메시지를 보내지 않으면 abort는 지연됨 (hook 없으면 실행 안됨).
- 이는 의도된 동작: hook-only 아키텍처에서 auto-abort는 "사용자가 계속 대화하는 환경"에서만 실행.
- 완전한 background timer는 별도 background interval 등록이 필요하며 Release 1 후반 gate.
```

**경고 카드 텍스트**:
```
FlowDesk: Stall + API unresponsive confirmed on lane <lane_id>.
Auto-abort will proceed on next message (after <preAbortWarningMs>ms).
To cancel: send "/flowdesk-abort <lane_id> cancel"
```

#### FlowDesk Guard Sign-off Schema (최소 요건)

Rule 10 수정 전 필요한 `flowdesk.guard_sign_off.v1` artifact:

```typescript
// docs/conformance/<date>-p6-guard-sign-off.md (Markdown 구조)
// 최소 포함 항목:
interface FlowDeskGuardSignOffV1 {
  schema_version: "flowdesk.guard_sign_off.v1"
  sign_off_id: string          // 고유 식별자
  created_at: string           // ISO timestamp
  target_change: string        // "rule_10_modification"
  reviewed_scope: string[]     // ["false_positive_risk", "ownership_criteria", "cancellation_mechanism", "audit_trail"]
  reviewer_ref: string         // 검토자 식별 (익명 가능, 단 실제 검토 증거 필요)
  evidence_refs: string[]      // P6 commit SHA, 테스트 증거 파일, ADR 경로
  approved: true               // false이면 사용 불가
  approval_statement: string   // "approved for rule 10 modification: ..."
  dispatch_authority_enabled: false
}
```

이 파일이 `docs/conformance/` 에 존재하고 `approved: true` 및 모든 필드가 채워진 이후에만 rule 10 수정 가능.

---

## 4. stall 판정 → 조치 결정 행렬

| (A) Evidence stall | (C) State | (D) Owned | (B) API | 판정 | 자동 조치 |
|-------------------|-----------|-----------|---------|------|---------|
| ✅ | ✅ | ✅ | api_timeout | confirmed_stall | P6 auto-abort (opt-in) |
| ✅ | ✅ | ✅ | api_responsive | likely_stall | 수동 조치 권고 |
| ✅ | ✅ | ✅ | unknown | probable_stall | 수동 조치 권고 |
| ✅ | ✅ | ❌ | any | not_owned | 조치 없음 |
| ✅ | ❌ | ✅ | any | terminal/non-eligible | 조치 없음 |
| ❌ | any | any | any | not_stalled | 조치 없음 |

---

## 5. 구현 순서 및 작업량

| 단계 | 작업 | Release 1 | 추정 | 선결 |
|------|------|-----------|------|------|
| P1 | withTimeout (버그 수정 포함) | ✅ | 0.5~1일 | 없음 |
| P2 | SDK 스파이크 + ADR | ✅ 필수 | 1.5~3일 | P1 |
| P3 | stallAlert wrapping + DI seam + UNAVAILABLE 카드 | ✅ | 1~1.5일 | P1 |
| P4 | Lane Abort Tool (5단계 validation) | ✅ | 2~3일 | P1 |
| P5 | Session Health Check | ✅ 조건부 | 1~1.5일 | P2 확인 |
| P6 | Guarded Auto-Abort (pending_abort_warning) | ⚠️ R1 후반 | 3~5일 | P5 + Guard |
| **합계** | | | **9~15일** | |

---

## 6. 테스트 전략 (V4 기준)

### Unit (DI seam + fake-clock)

**withTimeout**:
```typescript
// (a) 정상 완료
expect(await withTimeout(Promise.resolve(42), 100, "op")).toBe(42)

// (b) early rejection 보존
await expect(withTimeout(Promise.reject(new Error("early")), 100, "op"))
  .rejects.toThrow("early")

// (c) timeout
await expect(withTimeout(new Promise(() => {}), 10, "op"))
  .rejects.toBeInstanceOf(FlowDeskTimeoutError)

// (d) late rejection: unhandledRejection 발생 안함
const lateReject = new Promise<never>((_, reject) => setTimeout(() => reject("late"), 50))
jest.useFakeTimers()
const race = withTimeout(lateReject, 10, "op")
jest.advanceTimersByTime(10)
await expect(race).rejects.toBeInstanceOf(FlowDeskTimeoutError)
jest.advanceTimersByTime(50) // late rejection 발화
// unhandledRejection 없음 확인 (process.on mock)
```

**collectStallAlertSummary** (DI seam):
```typescript
// (a) timeout → UNAVAILABLE sentinel
const blockingImpl = () => new Promise(() => {}) // 영구 대기
jest.useFakeTimers()
const promise = collectStallAlertSummary(
  { statusLiveTimeoutMs: 100, rootDir: "/tmp" },
  () => new Date(),
  { statusLiveImpl: blockingImpl },
)
jest.advanceTimersByTime(100)
expect(await promise).toBe(STALL_DETECTION_UNAVAILABLE)

// (b) non-timeout 에러 → undefined + stderr 기록
const errorImpl = () => Promise.reject(new Error("disk error"))
const stderrSpy = jest.spyOn(process.stderr, "write").mockImplementation(() => true)
expect(await collectStallAlertSummary(..., { statusLiveImpl: errorImpl })).toBeUndefined()
expect(stderrSpy).toHaveBeenCalledWith(expect.stringContaining("non-timeout error"))
```

**validateAndAbortLane**:
```typescript
// step 1: workflow 없음 → blocked
// step 2: lane_id 없음 → blocked
// step 3: FlowDesk-owned (existence-based) — step 2와 통합
// step 4: terminal state → blocked
// step 5: non-eligible state → blocked
// 정상: aborted evidence 기록 + reload 검증
// idempotency: 동일 lane_id 재시도 → step 4 blocked
```

### Integration

| 시나리오 | DI 방법 | 검증 내용 |
|----------|--------|---------|
| statusLive 8초 blocking → UNAVAILABLE 카드 | `statusLiveImpl` DI + `jest.useFakeTimers()` | 8초 내 UNAVAILABLE 카드 출력 |
| stalled lane abort → 5단계 validation | evidence 파일 mock | aborted evidence 기록 확인 |
| terminal lane abort | — | `lane_already_terminal` 차단 |
| UNAVAILABLE 후 중복 카드 | dedup key 확인 | 10초 창 내 중복 출력 없음 |
| P6 pending_abort_warning → 취소 | cancel 메시지 주입 | abort evidence 없음 확인 |

---

## 7. V3 지적 해소 확인

| V3 지적 | V4 해소 방법 | 상태 |
|--------|------------|------|
| suppressedPromise early rejection 삼킴 | `void promise.catch()` side-effect 분리 | ✅ |
| spawnedBy 스키마 없음 | existence-based ownership + 스키마 확장 계획 | ✅ |
| P6 5초 hook-only 불가 | "다음 hook 발화 시 경과 확인" semantics | ✅ |
| P3 UNAVAILABLE 렌더링 경로 불명확 | hook 내부 sentinel → text part 완전 흐름 | ✅ |
| recordFlowDeskInternalDiagnosticV1 미존재 | `process.stderr.write` 단순화 | ✅ |
| messages() api_responsive 시 판정 불명확 | 판정 행렬 + "수동 조치 권고" 명확화 | ✅ |
| P4 필드명 camelCase 오류 | snake_case (`lane_id`, `updated_at`) 수정 | ✅ |
| Guard sign-off 임의 텍스트 가능 | `flowdesk.guard_sign_off.v1` 최소 스키마 | ✅ |
| DI seam 본문/테스트 불일치 | 함수 시그니처와 테스트 예시 일치 | ✅ |
| TOCTOU atomic write | 단일 인스턴스 전제 명문화 + write-then-verify | ✅ |
| (B) api_responsive 시 stall 판정 모호 | 판정 행렬에서 "likely_stall → 수동 권고"로 명확화 | ✅ |
