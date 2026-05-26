# FlowDesk Stall Recovery Plan

OMO 의 stall 방어 메커니즘을 분석해서 FlowDesk 에 적용할 항목을 정리한 계획.
실제 운영 환경에서 codex-spark / gpt-5.5 모델로 prompt 호출 시 ~11% 확률로
**SSE stream silent stall** (서버 측 SSE 도중 무응답) 이 발생하는데,
opencode 본체에 stream timeout 이 없어서 사용자 cancel 전까지 무한 대기하는
문제를 해결하기 위함.

## 1. 배경 & 진단 요약

### 관측된 stall 패턴

- `service=llm ... stream` 시작 후 첫 토큰까지 200~300초+ 무응답
- 같은 세션·모델 내 79번의 호출 중 6번 (~8%) 발생
- TCP 카운터 측정 시 양방향 모두 정지 (rxbytes/txbytes 변화 0, Recv-Q/Send-Q 0)
- 연결은 ESTABLISHED 유지, OS 버퍼 비어있음
- opencode 로그는 stall 동안 완전 침묵

### 진단

- 클라이언트 (opencode) 가 request 본문 전송 완료 (~988KB)
- 서버 (OpenAI codex backend) 가 응답 헤더 + 일부 SSE 이벤트 (~523KB) 전송
- 서버 측에서 SSE stream 을 멈춰버림 (reasoning 모델 특성)
- opencode 의 ai-sdk 는 client-side stream idle timeout 없음 → 무한 read 대기

### OMO 와의 차이

OMO 는 같은 OAuth backend / 같은 모델 / 더 많은 tool · 더 긴 system prompt 환경에서도
stall 이 누적되지 않음. 이유는 OMO 에 **다층 timeout + 능동 워치독** 이 구현되어 있어서
silent stall 을 30~60초 안에 감지하고 자동 회복하기 때문.

opencode 본체 패치 없이 **FlowDesk 플러그인 레이어**에서 같은 메커니즘을 추가하면
대부분의 stall 을 자동 회복 가능.

## 2. OMO 의 안전장치 매핑

### 2.1 이벤트 워치독 (가장 중요)

`oh-my-openagent/src/cli/run/poll-for-completion.ts`

```ts
const DEFAULT_EVENT_WATCHDOG_MS = 30_000
const DEFAULT_SECONDARY_MEANINGFUL_WORK_TIMEOUT_MS = 60_000
```

매 polling cycle 에서 `Date.now() - lastEventTimestamp > eventWatchdogMs` 면
**능동적으로 `session.status()` 호출** 해서 busy/idle/retry 판정.
30초 무이벤트 = 자동 health probe → silent SSE stall 감지의 핵심.

### 2.2 모든 외부 호출 timeout wrapping

`oh-my-openagent/src/shared/prompt-async-gate/timing.ts`

```ts
DEFAULT_PROMPT_DISPATCH_TIMEOUT_MS = 30_000

export async function withDispatchTimeout<T>(
  operation: Promise<T>,
  dispatchTimeoutMs: number,
  operationName: string,
): Promise<T> {
  // Promise.race(operation, setTimeout(reject))
}
```

`session.status()` 자체도 5초 timeout (`session-idle-settle.ts`).
`session.abort()` 자체도 10초 timeout (`abort-with-timeout.ts`).

RFC 인용: *"A hung OpenCode API call must fail closed instead of holding
a reservation forever."*

### 2.3 전체 prompt 라이프사이클 timeout

`oh-my-openagent/src/shared/prompt-timeout-context.ts`

```ts
PROMPT_TIMEOUT_MS = 120_000  // 2분 전체 prompt timeout
// AbortController 로 upstream cancel + timeout 결합
```

### 2.4 자동 fallback retry chain

`oh-my-openagent/packages/model-core/src/model-error-classifier.ts`

retryable patterns (50+):
```
"rate_limit", "503", "502", "504", "429", "529",
"timeout", "connection error", "network error",
"service unavailable", "internal_server_error",
"temporarily unavailable", "overloaded", "try again",
"频率限制", "请求过于频繁"  // multilang
```

retryable error 감지하면 자동으로 fallback chain 의 다음 모델로 전환.
새 세션 ID + 같은 task → 사용자 개입 없이 다른 모델로 살림.

### 2.5 Reservation-based prompt gate

`oh-my-openagent/docs/reference/prompt-async-gate-rfc.md`

- session 당 reservation map — 동시 중복 injection 방지
- 13+ 개 internal hook 이 prompt 보낼 수 있는데 race condition 막음
- `postDispatchHoldMs = 2000ms` — dispatch 후 2초간 holds 유지
- *"promptAsync returns before durably accepted hazard"* 대응

### 2.6 백그라운드 task stale 감지

`oh-my-openagent/src/features/background-agent/constants.ts`

```ts
DEFAULT_STALE_TIMEOUT_MS = 2_700_000        // 45분 무활동
DEFAULT_MESSAGE_STALENESS_TIMEOUT_MS = 3_600_000  // 60분
DEFAULT_SESSION_GONE_TIMEOUT_MS = 60_000    // 1분
MIN_SESSION_GONE_POLLS = 3                  // 3회 연속 확인
MIN_RUNTIME_BEFORE_STALE_MS = 30_000        // 30초 grace
POLLING_INTERVAL_MS = 3_000                 // 3초 polling
```

주기적 검사 → stale 감지하면 `abortWithTimeout(10s)` 으로 강제 종료 + 부모 알림.

### 2.7 Session existence verification

`oh-my-openagent/src/features/background-agent/session-existence.ts`

404 한 번에 죽었다고 판단 안 함, 3회 연속 missing 확인 후 판정.

## 3. FlowDesk 적용 계획

### P0 — 이벤트 워치독 (필수, stall 직접 해결)

**파일**: `packages/opencode-plugin/src/event-watchdog.ts` (신규)

**책임**:
1. opencode bus 이벤트 구독해서 `lastEventTimestamp` 추적
2. 주기적 polling (3초) — `Date.now() - lastEventTimestamp > eventWatchdogMs` 시 능동 회복
3. 능동 회복 flow:
   - `session.status()` 를 5초 timeout 으로 호출
   - status === "busy" 이고 마지막 message.part.delta 가 30초+ 전 → confirmed stall
   - `session.abort()` 를 10초 timeout 으로 호출 → 강제 종료
   - FlowDesk durable evidence 기록 (`flowdesk.lane_stall_recovery.v1`)
   - 사용자에게 alert (`/flowdesk-status` 안내 + 자동 abort 사실 표시)

**OMO 인용 상수**:
- `EVENT_WATCHDOG_MS = 30_000`
- `STATUS_PROBE_TIMEOUT_MS = 5_000`
- `ABORT_TIMEOUT_MS = 10_000`
- `POLLING_INTERVAL_MS = 3_000`

**Plugin 등록**: `server.ts` 의 Hooks 반환에 `event` 또는 background interval 로 추가.

**활성화 옵션**:
```jsonc
"eventWatchdog": {
  "enabled": true,
  "eventWatchdogMs": 30000,
  "autoAbortOnStall": true
}
```

**효과**: 11% silent stall 자동 회복. 사용자 cancel 불필요.

### P1 — SDK 호출 timeout wrapping

**파일**: `packages/opencode-plugin/src/shared/with-timeout.ts` (신규)

**내용**:
```ts
export async function withTimeout<T>(
  promise: Promise<T>,
  timeoutMs: number,
  operationName: string,
): Promise<T> {
  let timeoutHandle: ReturnType<typeof setTimeout> | undefined
  try {
    return await Promise.race([
      promise,
      new Promise<never>((_, reject) => {
        timeoutHandle = setTimeout(
          () => reject(new Error(`${operationName} timed out after ${timeoutMs}ms`)),
          timeoutMs,
        )
      }),
    ])
  } finally {
    if (timeoutHandle !== undefined) clearTimeout(timeoutHandle)
  }
}
```

**적용 대상**:
- 모든 `client.session.*` 호출 (특히 `managed-dispatch-adapter.ts`)
- 모든 `client.event.*` 호출
- Reviewer lane spawn / status check
- `executeFlowDeskStatusLiveV1` (현재 `await collectStallAlertSummary` 가 hang 가능)

**계층화 (OMO 표준)**:
- SDK call (status/get): 5초
- SDK dispatch (prompt): 30초
- Abort: 10초

### P2 — chatMessageStallAlert 를 active recovery 로 강화

**현재**: passive — 텍스트 카드만 표시
**목표**: confirmed stall 시 자동 abort

**파일**: `packages/opencode-plugin/src/server.ts` (수정)

```ts
// before
output.parts.push(buildTextPart(stallAlertText(summary)))

// after (when option enabled)
output.parts.push(buildTextPart(stallAlertText(summary)))
if (stallAlert.autoAbortOnStall && isConfirmedStuck) {
  await withTimeout(
    client.session.abort({ path: { id: sessionID } }),
    10_000,
    "session.abort",
  )
  recordFlowDeskLaneAbortEvidenceV1({
    workflowId, laneId, reason: "auto-recovery-after-confirmed-stall",
  })
}
```

`flowdesk-main.md` 의 *"FlowDesk does not auto-retry, auto-abort, or auto-fallback on stall"*
규칙은 **현재 보호장치 없음**의 선언이라 보호장치 도입 후 규칙 재설계 필요:

```
After P2 lands: "FlowDesk auto-aborts only on confirmed SSE silent stall
(>30s no events + session.status busy + lastDelta >30s ago)."
```

### P3 — Fallback retry chain

**파일**: `packages/opencode-plugin/src/shared/model-error-classifier.ts` (신규)

OMO 의 `model-error-classifier` 전체 패턴 복제. retryable / stop / auto-retry-gate
분류 동일하게.

**FlowDesk config 확장**:
```jsonc
"quickReviewerRun": {
  "providerQualifiedModelId": "openai/gpt-5.5",
  "fallbackChain": [
    { "model": "claude-sonnet-4-6", "providers": ["anthropic"] },
    { "model": "gemini-2.5-pro", "providers": ["google"] }
  ]
}
```

reviewer lane / quick-reviewer-run 실행 시 error 감지 → classifier 통과 →
다음 모델 + 새 attempt + durable evidence.

### P4 — Prompt-async-gate (reservation map)

**파일**: `packages/opencode-plugin/src/shared/prompt-reservation-gate.ts` (신규)

FlowDesk 가 lane spawn / heartbeat / status injection 등 여러 곳에서 동시에
session 에 prompt 를 건드릴 수 있음. session 당 reservation map 도입:

```ts
const reservations = new Map<string, FlowDeskReservation>()

export async function dispatchInternalPrompt(args: {
  client, sessionID, source, input,
  dispatchTimeoutMs = 30_000,
  postDispatchHoldMs = 2_000,
}): Promise<DispatchResult> {
  // 1. check active reservation → skip if exists
  // 2. set reservation
  // 3. withTimeout(dispatch, 30s)
  // 4. hold reservation 2s after dispatch
  // 5. release
}
```

OMO 의 RFC 그대로 차용 가능. FlowDesk 의 internal hook 들이 모두 이 gate 를
통과하도록 강제.

### P5 — Background task stale 감지 (장기)

FlowDesk lane 들에 대한 watchdog. OMO 의 `task-poller.ts` 패턴 차용.
이미 `laneHeartbeatWriter`, `statusLive` 가 부분적으로 존재하지만 active recovery
없음. P0 의 event-watchdog 와 통합 가능.

## 4. 적용 순서 & 예상 작업량

| 단계 | 작업 | 효과 | 작업량 | 의존성 |
|---|---|---|---|---|
| P0 | event-watchdog 신규 작성 | 11% stall 자동 해소 | 1일 | P1 (withTimeout) |
| P1 | withTimeout helper + SDK 호출 wrapping | hang 호출 자동 cleanup | 0.5일 | 없음 |
| P2 | stallAlert active recovery | sub-second 회복 | 0.5일 | P0, P1 |
| P3 | fallback chain + error classifier | provider 장애 자동 우회 | 1일 | P1 |
| P4 | prompt reservation gate | duplicate injection 차단 | 1일 | P1 |
| P5 | background task stale | 장기 lane 정합성 | 1일 | P0 |

**권장 실행 순서**: P1 → P0 → P2 → P3 → P4 → P5

P0 + P1 두 단계만으로도 현재 stall 문제는 사실상 해결됨. 나머지는 견고성 강화.

## 5. 테스트 전략

### Unit
- `withTimeout`: timeout 발동, cleanup, AbortSignal 통합
- `model-error-classifier`: 50+ pattern, edge case
- `event-watchdog`: lastEventTimestamp 추적, status probe trigger

### Integration
- silent stall 시뮬레이션: mock SSE stream 이 일정 시간 침묵 → watchdog 가 30~40초 안에 abort 호출하는지
- fallback chain: retryable error → 다음 모델 dispatch 호출되는지
- reservation gate: 동시 2개 prompt → 하나만 dispatched, 다른 하나 reserved 반환

### Live regression (수동)
- DEX-2 / flowdesk 세션에서 codex-spark 로 20번 prompt 보내고 stall 횟수 측정
- P0 적용 전/후 비교: 11% stall → ~0% (자동 회복 메트릭)

## 6. Migration & 호환성

### `flowdesk-main.md` agent prompt 수정 필요
**rule 10** (현재):
> Do not claim that FlowDesk auto-retries, auto-aborts, auto-fallbacks,
> force-kills, or hard-cancels chat on stall unless a first-class
> FlowDesk/OpenCode control surface proves it.

**rule 10** (P0~P3 적용 후):
> FlowDesk auto-aborts on confirmed silent stall (>30s no events +
> session busy + lastDelta >30s ago). FlowDesk auto-retries reviewer
> lanes on retryable provider errors using the configured fallbackChain.
> All other auto-* claims remain blocked until first-class evidence.

### `chatMessageStallAlert` 옵션 확장
```jsonc
"chatMessageStallAlert": {
  "enabled": true,
  "includeProgressingLate": false,
  "autoAbortOnStall": true,        // 신규 (P2)
  "eventWatchdogMs": 30000,        // 신규 (P0)
  "statusProbeTimeoutMs": 5000     // 신규 (P0)
}
```

기존 사용자는 `autoAbortOnStall: false` 기본값으로 opt-in 형태로 유지.

## 7. 외부 의존 / 위험

- opencode 의 `client.event.subscribe` 가 보장하는 이벤트 종류와 순서에 의존.
  옵션이 1.15.x 와 다른 minor 에서 바뀌면 watchdog 재튜닝 필요.
- `session.abort()` 가 SSE stream 을 끊는지, 단순히 마크만 하는지 opencode
  bundled binary 거동 확인 필요. 끊지 못하면 P0 의 효과 절반.
- `model-error-classifier` 의 retryable 판정이 false positive 면 비싼
  모델로 자동 swap 위험. OMO 의 `STOP_MESSAGE_PATTERNS` (quota / billing)
  반드시 함께 차용.
- Reviewer lane fallbackChain 의 provider 가 OAuth 인증 안 돼 있으면
  silent skip → 사용자에게 명시적 진단 메시지 노출 필요.

## 8. 참조

- OMO 저장소: <https://github.com/code-yeongyu/oh-my-openagent>
- 핵심 파일:
  - `src/cli/run/poll-for-completion.ts`
  - `src/shared/prompt-async-gate/timing.ts`
  - `src/shared/prompt-async-gate/session-idle-dispatch.ts`
  - `src/shared/prompt-timeout-context.ts`
  - `src/shared/session-idle-settle.ts`
  - `src/features/background-agent/abort-with-timeout.ts`
  - `src/features/background-agent/task-poller.ts`
  - `src/features/background-agent/constants.ts`
  - `packages/model-core/src/model-error-classifier.ts`
- 핵심 ADR: `docs/reference/prompt-async-gate-rfc.md` (OMO 저장소 내)
