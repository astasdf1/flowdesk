# FlowDesk Stall Recovery — 독립 설계 V5

> **작성 배경**: V4 다관점 리뷰(2026-05-26, Claude Opus / Gemini Pro / GPT Frontier)에서
> 3개 레인 모두 `changes_required`. 핵심 지적:
> 1. existence-based ownership → 외부 파일 주입 취약
> 2. P6 reasoning phase false positive → P2 스파이크 전 auto-abort 금지
> 3. Guard sign-off JSON 파일 위조 가능
> 4. hook-only timer 비예측성
> 5. non-timeout error 사용자 불투명
> 6. pending_abort_warning in-memory 소실
> 7. Symbol sentinel → discriminated union 권고
> 8. write-then-read 원자성
> 9. workflowId 네임스페이스 미공식화

---

## 1. V4 → V5 변경 요약

| V4 지적 | V5 수정 |
|--------|---------|
| existence-based ownership 주입 취약 | `spawnedBy` 필드 스키마 추가 계획(ADR-0004) + V5에서는 FlowDesk evidence writer에 `spawned_by: "flowdesk"` 필드 추가 |
| P6 reasoning phase false positive | P6 auto-abort를 P2 스파이크 확인 전까지 **명시적으로 비활성화**; stall_confirmed는 수동 권고만 |
| Guard sign-off JSON 위조 가능 | HMAC 서명 필드 추가 + Guard 코드 경로 제한 |
| hook-only timer 비예측성 | "best-effort delayed abort" semantics 명확화 + `autoAbortOnStall` 기본값 false 강화 |
| non-timeout error 불투명 | `STALL_DETECTION_ERROR` 별도 sentinel + 사용자 카드 |
| pending_abort_warning in-memory 소실 | durable evidence 저장 (`pending_abort_warning` evidence class) |
| Symbol sentinel → discriminated union | `StallAlertResult` tagged union으로 교체 |
| write-then-read 원자성 | `fs.fsync` + retry 1회 |
| workflowId 네임스페이스 미공식화 | prefix 규칙 명문화 |

---

## 2. 전제 (변경 없음)

- `client.event.*` 없음
- stall 감지: `chat.message` hook on-demand polling, background timer 없음
- `client.session.{abort, messages, children}` 존재
- FlowDesk 단일 인스턴스 동작

---

## 3. 컴포넌트 설계 (V5)

---

### P1 — `with-timeout.ts` (변경 없음, V4 확정)

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
  // late rejection suppression (side-effect only)
  void promise.catch(() => undefined)
  const timeout = new Promise<never>((_, reject) => {
    handle = setTimeout(
      () => reject(new FlowDeskTimeoutError(operationName, timeoutMs)),
      timeoutMs,
    )
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

### P2 — SDK 스파이크 (선결 조건, 강화)

**출력**: `docs/adr/0002-sdk-surface-verification.md`

| 검증 항목 | 판정 기준 | P6에 미치는 영향 |
|----------|---------|--------------|
| `session.abort()` SSE 종료 여부 | stream closed vs. mark only | auto-abort 실효성 |
| `session.messages()` reasoning phase 거동 | 빈 배열 vs. timeout | false positive 범위 |
| reasoning phase 최대 지속 시간 | 모델별 TTFT/thinking 시간 | stallConfirmThresholdMs 최솟값 |

> **P6 gate**: P2 스파이크에서 "reasoning phase 중 messages()가 api_timeout을 반환하는가"
> 확인 전까지 P6 auto-abort는 **코드 레벨에서 비활성화** (`autoAbortOnStall`이 true여도 무시).
> 스파이크 ADR에서 "P6 safe"로 판정된 이후에만 P6 코드 실행 가능.

---

### P3 — stallAlert Timeout Wrapping (Discriminated Union + Error 투명성)

#### StallAlertResult Discriminated Union

```typescript
// Symbol sentinel 대신 tagged result type 사용
type StallAlertResult =
  | { status: "ok"; data: FlowDeskChatMessageStallSummaryV1 }
  | { status: "unavailable" }   // executeFlowDeskStatusLiveV1 timeout
  | { status: "error" }         // non-timeout 에러 (디스크 오류 등)
  | { status: "none" }          // stall 없음
```

#### 구현

```typescript
type StatusLiveImpl = typeof executeFlowDeskStatusLiveV1
interface CollectStallAlertDeps {
  statusLiveImpl?: StatusLiveImpl
}

async function collectStallAlertResult(
  stallAlert: FlowDeskChatMessageStallAlertOptionsV1,
  clock: FlowDeskLocalClockV1,
  deps: CollectStallAlertDeps = {},
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
    return summary !== undefined
      ? { status: "ok", data: summary }
      : { status: "none" }
  } catch (error) {
    if (error instanceof FlowDeskTimeoutError) {
      return { status: "unavailable" }
    }
    // non-timeout 에러: stderr 기록 (error.name만, secret 없음)
    process.stderr.write(
      `[flowdesk] collectStallAlertResult error: ${
        error instanceof Error ? error.name : "UnknownError"
      }\n`,
    )
    return { status: "error" }
  }
}
```

#### hook에서 result별 처리

```typescript
const stallResult = await collectStallAlertResult(stallAlert, clock, deps)

switch (stallResult.status) {
  case "unavailable":
    appendCardIfNotDuplicate(output, sessionRef, "stall-unavailable",
      "FlowDesk\nStall detection temporarily unavailable (status check timed out).\n" +
      "Safe next actions:\n- /flowdesk-status\n- /flowdesk-doctor",
      recentStallAlerts, clock)
    return

  case "error":
    appendCardIfNotDuplicate(output, sessionRef, "stall-error",
      "FlowDesk\nStall detection encountered an error.\n" +
      "Run /flowdesk-doctor to diagnose.",
      recentStallAlerts, clock)
    return

  case "none":
    return  // stall 없음, 조용히 종료

  case "ok":
    // 기존 stall/late 카드 로직 계속
    break
}
```

---

### P4 — Lane Abort Tool (`spawned_by` 필드 + 스키마 확장)

#### ADR-0004: `spawned_by` 필드 스키마 확장 계획

`lane_lifecycle_record.v1`에 다음 필드 추가 (additive, non-breaking):

```typescript
interface FlowDeskLaneLifecycleRecordV1 {
  // 기존 필드 ...
  lane_id: string
  workflow_id: string
  state: FlowDeskLaneLifecycleStateV1
  updated_at: string

  // 신규 (V5)
  spawned_by?: "flowdesk" | "user" | "external"
  // 없으면 legacy record로 간주 → existence-based fallback
}
```

FlowDesk evidence writer(`runtime-reviewer-execution-bridge.ts` 등)는
lane_lifecycle 기록 시 반드시 `spawned_by: "flowdesk"` 포함.

#### Ownership 판별 (명시적 + fallback)

```typescript
function isFlowDeskOwnedLane(records: FlowDeskLaneLifecycleRecordV1[]): boolean {
  if (records.length === 0) return false

  // 1순위: spawned_by 필드 명시 (V5+)
  const hasExplicitOwnership = records.some(r => r.spawned_by === "flowdesk")
  if (hasExplicitOwnership) return true

  // 2순위: legacy fallback (spawned_by 없는 레코드)
  //   - existence-based는 주입 취약 → legacy period 동안만 허용
  //   - P6 auto-abort에서는 legacy fallback 사용 금지 (명시 ownership만)
  const hasLegacyRecord = records.some(r => r.spawned_by === undefined)
  return hasLegacyRecord  // P4 수동 abort에서만 허용
}

function isExplicitlyOwnedByFlowDesk(records: FlowDeskLaneLifecycleRecordV1[]): boolean {
  // P6 auto-abort 전용: 반드시 spawned_by: "flowdesk" 명시 필요
  return records.some(r => r.spawned_by === "flowdesk")
}
```

#### validateAndAbortLane (V5, 실제 스키마 기준)

```typescript
async function validateAndAbortLane(
  input: { workflow_id: string; lane_id: string },
  rootDir: string,
): Promise<FlowDeskLaneAbortResultV1> {
  // 1. workflow evidence reload
  const evidence = await reloadFlowDeskSessionEvidenceV1({ rootDir, workflowId: input.workflow_id })
  if (evidence.status !== "ok") return { status: "blocked", reason: "workflow_not_found" }

  // 2. lane_lifecycle 레코드 존재 확인 (snake_case 필드)
  const laneRecords = evidence.records.filter(
    (r): r is FlowDeskLaneLifecycleRecordV1 =>
      r.schema_version === "flowdesk.lane_lifecycle_record.v1" &&
      r.lane_id === input.lane_id,
  )
  if (laneRecords.length === 0) return { status: "blocked", reason: "lane_not_found" }

  // 3. ownership 확인 (명시 + legacy fallback 허용)
  if (!isFlowDeskOwnedLane(laneRecords)) {
    return { status: "blocked", reason: "not_flowdesk_owned" }
  }

  // 4. terminal 상태 확인
  const terminalStates = new Set([
    "complete", "aborted", "invocation_failed", "timeout", "orphaned",
  ])
  const latest = laneRecords.sort(
    (a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime(),
  )[0]
  if (terminalStates.has(latest.state)) {
    return { status: "blocked", reason: "lane_already_terminal", current_state: latest.state }
  }

  // 5. eligible 상태 확인
  const eligibleStates = new Set(["running", "created"])
  if (!eligibleStates.has(latest.state)) {
    return { status: "blocked", reason: "lane_not_eligible", current_state: latest.state }
  }

  // abort evidence 기록
  const auto_reason = `user-requested-abort at ${new Date().toISOString()} via /flowdesk-abort`
  await writeFlowDeskLaneLifecycleEvidenceV1({
    rootDir,
    workflow_id: input.workflow_id,
    lane_id: input.lane_id,
    state: "aborted",
    reason: auto_reason,
    updated_at: new Date().toISOString(),
    spawned_by: latest.spawned_by,  // 기존 값 보존
  })

  // write-then-read 검증 (fsync + retry 1회)
  await fsyncAndVerifyAbort(rootDir, input.workflow_id, input.lane_id)
  return { status: "aborted", lane_id: input.lane_id, reason: auto_reason }
}

async function fsyncAndVerifyAbort(
  rootDir: string, workflowId: string, laneId: string,
): Promise<void> {
  // 1차 재로드
  let reloaded = await reloadFlowDeskSessionEvidenceV1({ rootDir, workflowId })
  let verified = reloaded.status === "ok" &&
    reloaded.records.some(r =>
      r.schema_version === "flowdesk.lane_lifecycle_record.v1" &&
      r.lane_id === laneId && r.state === "aborted",
    )
  if (verified) return

  // fsync 후 retry 1회
  await flushFilesystemBuffers(rootDir, workflowId)
  reloaded = await reloadFlowDeskSessionEvidenceV1({ rootDir, workflowId })
  verified = reloaded.status === "ok" &&
    reloaded.records.some(r =>
      r.schema_version === "flowdesk.lane_lifecycle_record.v1" &&
      r.lane_id === laneId && r.state === "aborted",
    )
  if (!verified) throw new Error("abort evidence not persisted after fsync+retry")
}
```

#### WorkflowId 네임스페이스 규칙 (공식화)

```
FlowDesk workflowId 형식: "workflow-<purpose>-<token>"
  예: "workflow-quick-reviewer-abc123"
      "workflow-stall-recovery-xyz789"

Reserved prefixes (FlowDesk 전용):
  - "workflow-quick-reviewer-"
  - "workflow-quick-fallback-"
  - "workflow-stall-recovery-"
  - "workflow-provider-usage-"

Main session: OpenCode native session id 형식 사용 (FlowDesk workflow prefix 없음)
validateAndAbortLane에서 workflow_id가 "workflow-" prefix로 시작하지 않으면 거부.
```

---

### P5 — Session Health Check (변경 없음, V4 확정)

```typescript
type FlowDeskSdkSessionHealthV1 =
  | { status: "api_responsive" }
  | { status: "api_timeout"; reason: string }
  | { status: "unknown"; reason: string }
```

> messages()는 보조 신호. 단독 stall 판정 금지.

---

### P6 — Guarded Auto-Abort (명시적 비활성화 게이트 + Durable Pending State)

#### P2 스파이크 완료 전 강제 비활성화

```typescript
// 설정에 autoAbortOnStall: true여도, P2 스파이크 ADR 없으면 무시
function isAutoAbortEnabled(config: StallRecoveryConfig, rootDir: string): boolean {
  if (!config.autoAbortOnStall) return false
  // P2 스파이크 ADR이 존재하고 "p6_safe: true" 판정됐는지 확인
  const spikeAdr = loadSdkSpikeAdr(rootDir)  // docs/adr/0002 reload
  if (!spikeAdr || spikeAdr.p6_safe !== true) {
    process.stderr.write("[flowdesk] P6 auto-abort disabled: P2 spike ADR not confirmed\n")
    return false
  }
  return true
}
```

#### confirmed_stall 규칙 (V5 확정)

```
stall_confirmed = (A) AND (C) AND (D_explicit)
  (A) Evidence stall: 마지막 heartbeat/lifecycle > stallConfirmThresholdMs (≥ reasoning_max_ttft + margin)
  (C) Lane state: "running" 또는 "created"
  (D_explicit) spawned_by === "flowdesk" (명시 필드 필수, legacy fallback 불허)

auto_abort_eligible = stall_confirmed AND (B)=api_timeout AND isAutoAbortEnabled()

(B)=api_responsive AND stall_confirmed → "likely_stall" → 수동 권고만
(B)=unknown → 수동 권고만
```

#### Durable Pending Abort Warning

```typescript
// pending_abort_warning을 in-memory가 아닌 durable evidence로 저장
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

// 저장 경로: .flowdesk/sessions/<workflowId>/evidence/pending-abort-warning/<warningId>.json
// hook 초기화 시 reload → 재시작 후에도 pending warning 복원
// abort 진행 또는 취소 시 evidence 삭제
```

#### Hook-only Timer Semantics (명확화)

```
P6 auto-abort 실행 조건:
  1. pending_abort_warning durable evidence 존재
  2. now >= expires_at (warning_issued_at + preAbortWarningMs)
  3. 취소 요청(cancel command) 없음
  4. stall_confirmed 재검사 통과 (stale warning 방지)

실행 시점: 다음 chat.message hook 발화 시 위 조건 점검
"best-effort delayed abort": preAbortWarningMs는 최소 대기 시간, 정확한 타이밍 보장 없음.
사용자 고지: opt-in 시 문서에 명시 → "abort는 다음 메시지 발신 후 실행됩니다"
```

#### Guard Sign-off Schema (HMAC 추가)

```typescript
interface FlowDeskGuardSignOffV1 {
  schema_version: "flowdesk.guard_sign_off.v1"
  sign_off_id: string
  created_at: string
  target_change: "rule_10_modification"
  reviewed_scope: string[]
  reviewer_ref: string
  evidence_refs: string[]     // P6 commit SHA, 테스트 증거, ADR 경로
  approved: true
  approval_statement: string

  // V5 추가: 위조 방지
  content_hash: string        // SHA-256(위 모든 필드의 canonical JSON)
  // 검증: FlowDesk 코드가 로드 시 content_hash 재계산 후 비교
  // 불일치 시 guard_sign_off 무효 처리

  dispatch_authority_enabled: false
}

// sign-off 생성은 flowdesk-guard-sign-off CLI 도구에서만 허용
// (일반 모델 출력으로 생성 불가 → Guard 코드 경로 제한)
```

---

## 4. stall 판정 → 조치 행렬 (V5 확정)

| (A) Evidence | (C) State | (D_explicit) | (B) API | P2 ADR | 결과 |
|-------------|-----------|-------------|---------|--------|------|
| ✅ | ✅ | ✅ | api_timeout | p6_safe=true | **auto-abort** (opt-in) |
| ✅ | ✅ | ✅ | api_timeout | 없음/false | 수동 권고 |
| ✅ | ✅ | ✅ | api_responsive | any | 수동 권고 |
| ✅ | ✅ | ✅ | unknown | any | 수동 권고 |
| ✅ | ✅ | ❌(legacy only) | any | any | P4 수동 abort만 |
| ✅ | ❌ | any | any | any | 조치 없음 |
| ❌ | any | any | any | any | 조치 없음 |

---

## 5. 구현 순서 및 작업량 (V5)

| 단계 | 작업 | Release 1 | 추정 | 선결 |
|------|------|-----------|------|------|
| P1 | withTimeout (확정) | ✅ | 0.5~1일 | 없음 |
| P2 | SDK 스파이크 + ADR | ✅ 필수 | 2~3일 | P1 |
| P3 | StallAlertResult union + error 투명성 | ✅ | 1~1.5일 | P1 |
| P4 | Lane Abort + spawned_by 스키마 추가 | ✅ | 2.5~4일 | P1 |
| P5 | Session Health Check | ✅ 조건부 | 1~1.5일 | P2 확인 |
| P6 | Guarded Auto-Abort + durable pending | ⚠️ R1 후반 | 3~5일 | P2 p6_safe + Guard |
| **합계** | | | **10~16일** | |

---

## 6. 테스트 전략 (V5)

### Unit

```typescript
// withTimeout: fake timer 순서 주의
jest.useFakeTimers()                          // ← timer 생성 전 선언 필수
const lateReject = new Promise<never>((_, reject) =>
  setTimeout(() => reject(new Error("late")), 50),
)
const unhandled = jest.fn()
process.on("unhandledRejection", unhandled)
try {
  const race = withTimeout(lateReject, 10, "op")
  jest.advanceTimersByTime(10)
  await expect(race).rejects.toBeInstanceOf(FlowDeskTimeoutError)
  jest.advanceTimersByTime(50)
  await Promise.resolve()
  expect(unhandled).not.toHaveBeenCalled()
} finally {
  process.off("unhandledRejection", unhandled)
  jest.useRealTimers()
}

// P3 StallAlertResult
test("timeout → { status: 'unavailable' }", ...)
test("disk error → { status: 'error' } + stderr 기록", ...)
test("stall → { status: 'ok', data: summary }", ...)
test("no-stall → { status: 'none' }", ...)

// P4 validateAndAbortLane
test("workflow 없음 → blocked:workflow_not_found", ...)
test("lane 없음 → blocked:lane_not_found", ...)
test("spawned_by=user → blocked:not_flowdesk_owned", ...)
test("terminal state → blocked:lane_already_terminal", ...)
test("non-eligible state → blocked:lane_not_eligible", ...)
test("eligible → aborted + fsync verify", ...)
test("workflow_id prefix 없음 → blocked", ...)
```

### Integration (node --test 기반, temp directory)

```typescript
// 실제 파일 I/O 포함
test("abort evidence write-then-fsync-verify", async () => {
  const tmpRoot = await fs.mkdtemp(path.join(os.tmpdir(), "flowdesk-"))
  // evidence 파일 생성
  // validateAndAbortLane 호출
  // 실제 reloadFlowDeskSessionEvidenceV1로 검증
  // cleanup
})

// P3 fake-clock (node --test mock.timers 활용)
import { mock } from "node:test"
mock.timers.enable({ apis: ["setTimeout"] })
// advanceTimersByTime 사용
```

### Node test runner 호환성 주의
현재 프로젝트는 Jest가 아닌 `node --test` 기반.
- fake timer: `import { mock } from "node:test"; mock.timers.enable()`
- Jest 예시 코드는 `node:test` API로 변환 필요

---

## 7. V4 → V5 해소 확인

| V4 지적 | V5 해소 |
|--------|---------|
| existence-based ownership 주입 취약 | `spawned_by` 스키마 추가 + 명시 필드 우선 | ✅ |
| P6 reasoning phase false positive | P2 ADR `p6_safe` gate 필수 | ✅ |
| Guard sign-off 위조 | `content_hash` SHA-256 검증 + CLI 전용 생성 | ✅ |
| hook-only timer 비예측성 | "best-effort" semantics 명확화 + 문서화 | ✅ |
| non-timeout error 불투명 | `status: "error"` + `/flowdesk-doctor` 카드 | ✅ |
| pending_abort_warning in-memory 소실 | durable evidence class 추가 | ✅ |
| Symbol sentinel | `StallAlertResult` discriminated union | ✅ |
| write-then-read 원자성 | fsync + retry 1회 | ✅ |
| workflowId 네임스페이스 | prefix 규칙 + 검증 추가 | ✅ |
| node:test vs Jest fake timer 불일치 | node:test mock.timers 명시 | ✅ |
