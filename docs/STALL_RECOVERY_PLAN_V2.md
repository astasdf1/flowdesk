# FlowDesk Stall Recovery — 독립 신규 설계 (V2)

> **작성 배경**: V1 계획은 다관점 리뷰(2026-05-26)에서 OMO 소스 의존, Release 1 범위 위반,
> Guard 우회, 거버넌스 역전 등 critical 결함으로 blocked 판정을 받았다.
> V2는 OMO 코드를 일절 참조하지 않고, FlowDesk 실제 SDK 표면과 아키텍처 탐색 결과에
> 기반해 독립적으로 재설계한다.

---

## 1. 현황 파악 — 탐색으로 확인된 사실

### 1.1 실제 SDK 표면 (관련 부분)

| 메서드 | 시그니처 요약 | 확인 여부 |
|--------|-------------|----------|
| `client.session.abort(opts)` | `path: { id }`, `query?: { directory? }` | 인터페이스 존재 확인. 실제 SSE 종료 여부는 **미검증** |
| `client.session.messages(opts)` | `path: { id }`, `query?: { directory? }` | 존재 확인 |
| `client.session.children(opts)` | `path: { id }`, `query?: { directory? }` | 존재 확인 |
| `client.event.*` | — | **존재하지 않음** |

> ⚠️ `client.event.subscribe` 는 FlowDesk SDK 인터페이스에 없다.
> V1 P0 event-watchdog의 전제가 성립하지 않으므로 폐기.

### 1.2 현재 stall 감지 방식

- **트리거**: `chat.message` hook (사용자 메시지 도달 시만 실행)
- **폴링 없음**: background timer / interval 없음
- **감지 근거**: durable evidence 파일 (`lane_heartbeat`, `lane_lifecycle`) 의 `observed_at` 대비 경과 시간
- **출력**: 텍스트 카드 1개 → safe next actions 안내 (passive)
- **현재 auto-action 없음**: abort/retry/fallback 모두 수동

### 1.3 "Stall"의 두 가지 의미

| 종류 | 정의 | FlowDesk 대응 |
|------|------|--------------|
| **Evidence Stall** | FlowDesk lane이 heartbeat/lifecycle evidence 기록을 멈춤 | 현재 감지함 (chat.message hook) |
| **SDK Session Stall** | opencode SDK 세션이 응답을 멈춤 (SSE hang 등) | 현재 감지 안 함, 대응 안 함 |

V1은 두 가지를 혼동했다. V2는 명확히 분리한다.

---

## 2. 설계 원칙 (V2)

1. **OMO 소스 의존 금지** — 코드, 패턴 목록, 상수값 복제 없음. 모두 독립 설계.
2. **Release 1 범위 준수** — 자동 provider/model fallback 없음. Release 1 금지 항목 제거.
3. **auto-abort는 명시적 opt-in + Guard 연계** — 기본값 false. 활성화 시 사용자 인지 보장.
4. **단일 stall 감지 메커니즘** — P0(watchdog)과 P2(stallAlert)의 경합 없음.
5. **API 스파이크 우선** — `session.abort()` 동작을 코드 작성 전 검증.
6. **타임아웃은 context-aware** — 전역 상수 하드코딩 금지.

---

## 3. 컴포넌트 설계

### P1 — `with-timeout.ts` (필수 기반, 독립 구현)

**파일**: `packages/opencode-plugin/src/shared/with-timeout.ts`

**역할**: SDK 호출 hang 방지. OMO 없이 표준 Promise.race 패턴.

```typescript
/**
 * Wraps a promise with a timeout.
 * On timeout, rejects with FlowDeskTimeoutError.
 * Does NOT cancel the underlying operation (SDK-level cancellation
 * requires AbortSignal passed to the original call site).
 */
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
  const timeout = new Promise<never>((_, reject) => {
    handle = setTimeout(
      () => reject(new FlowDeskTimeoutError(operationName, timeoutMs)),
      timeoutMs,
    )
  })
  try {
    return await Promise.race([promise, timeout])
  } finally {
    // Always clear — avoids timer leak even if promise rejects
    if (handle !== undefined) clearTimeout(handle)
  }
}

/**
 * Default timeouts for FlowDesk SDK operations.
 * These are conservative and provider-agnostic.
 * Override via plugin config if model behavior differs.
 */
export const FLOWDESK_TIMEOUT_DEFAULTS = {
  /** session.abort() — destructive, must not hang */
  sessionAbortMs: 10_000,
  /** session.messages(), session.children() — read-only status check */
  sessionReadMs: 5_000,
  /** session.prompt() / promptAsync() — dispatch call */
  sessionDispatchMs: 30_000,
} as const

export type FlowDeskTimeoutConfig = Partial<typeof FLOWDESK_TIMEOUT_DEFAULTS>
```

**주의**: timeout 발생 시 원래 promise의 리소스 정리는 **호출 측 책임**. `withTimeout`은 단순 race
wrapper이고, 하위 작업 abort는 AbortSignal을 SDK 호출에 직접 전달해야 한다.
→ `session.abort()` 자체에는 AbortSignal 파라미터가 없으므로 abort 호출 timeout 후
원 세션 상태는 SDK 동작에 달려 있다. 스파이크에서 확인 필요.

**적용 대상**:
- `managed-dispatch-adapter.ts` 내 모든 `client.session.*` 호출
- `runtime-reviewer-execution-bridge.ts` 내 lane spawn / status check
- `status-live-tool.ts` 내 `executeFlowDeskStatusLiveV1` (현재 unbounded await 가능)

---

### P2 — SDK 스파이크 (선결 조건)

**목적**: P3 이후 모든 작업의 전제를 검증.

**검증 항목**:

| 항목 | 검증 방법 | 판정 기준 |
|------|----------|---------|
| `session.abort()` 가 SSE stream을 실제로 끊는가 | fake-runtime 세션에 abort 호출 후 messages() 응답 없음 확인 | stream closed vs. status-only mark 구분 |
| `session.messages()` 가 진행 중 세션의 부분 결과를 반환하는가 | 장시간 prompt 중 messages() 폴링 | 메시지 수가 증가하는지 여부 |
| `chat.message` hook이 FlowDesk-owned lane 세션의 메시지에도 발화하는가 | 자식 세션 생성 후 hook 발화 여부 | 발화하면 lane health check 가능 |

**출력**: `docs/adr/0002-sdk-surface-verification.md` (스파이크 결과 ADR)

---

### P3 — 강화된 Stall Alert (Evidence Stall 대응)

**현재 문제**: `collectStallAlertSummary`가 `executeFlowDeskStatusLiveV1`를 매번 무제한 대기로 호출.
파일 I/O hang 시 chat.message hook 전체가 blocking.

**변경사항**: `withTimeout`으로 wrapping + 타임아웃 설정 노출.

```typescript
// server.ts 수정 — collectStallAlertSummary 내부
const result = await withTimeout(
  executeFlowDeskStatusLiveV1({ config, now: () => new Date(observedAt) }),
  stallAlert.statusLiveTimeoutMs ?? 8_000,  // 기본 8초, 설정 가능
  "executeFlowDeskStatusLiveV1",
).catch(() => undefined)  // timeout 시 undefined → stall alert 생략
```

**config 확장**:
```jsonc
"chatMessageStallAlert": {
  "enabled": true,
  "includeProgressingLate": false,
  "statusLiveTimeoutMs": 8000   // 신규 (P3)
}
```

**auto-abort 미포함** — 이 단계에서는 passive alert만. auto-abort는 P5에서 별도 게이트.

---

### P4 — Lane Abort Tool (Evidence Stall 수동 회복)

**목적**: 사용자가 특정 stalled lane을 명시적으로 abort 처리할 수 있도록.
FlowDesk evidence 레이어만 업데이트. SDK session abort와 분리.

**파일**: `packages/opencode-plugin/src/command-handlers.ts` (수정)

**새 tool**: `flowdesk_lane_abort` (또는 `/flowdesk-abort` 명령 강화)

```typescript
// /flowdesk-abort 명령에 laneId 파라미터 추가
// laneId 없으면 stalled lanes 목록 표시 → 선택 유도
// laneId 있으면 해당 lane에 lifecycle evidence (aborted) 기록

interface FlowDeskLaneAbortInputV1 {
  workflowId: string
  laneId: string
  reason?: string  // 사용자 제공 이유 (감사 trail)
}

// 결과: flowdesk.lane_lifecycle.v1 { state: "aborted", reason, abortedBy: "user" } 기록
// SDK session에는 영향 없음
```

**중요 분리**:
- `flowdesk_lane_abort` → FlowDesk evidence에 aborted 기록 (사용자 요청 즉시 실행)
- SDK session abort → 별도 P5에서 Guard 연계 후 선택적 제공

---

### P5 — Session Health Check (SDK Session Stall 감지, 조건부)

> **전제**: P2 스파이크에서 `session.messages()` polling이 실용적임을 확인한 경우에만 구현.

**목적**: `/flowdesk-status` 또는 `/flowdesk-doctor` 호출 시 stalled lane의
underlying SDK session 이 실제로 살아 있는지 확인.

```typescript
async function checkSdkSessionHealth(
  client: FlowDeskManagedDispatchBetaOpenCodeClientV1,
  sessionId: string,
  timeouts: FlowDeskTimeoutConfig,
): Promise<"responsive" | "unresponsive" | "unknown"> {
  if (typeof client.session.messages !== "function") return "unknown"
  try {
    await withTimeout(
      client.session.messages({ path: { id: sessionId } }),
      timeouts.sessionReadMs ?? FLOWDESK_TIMEOUT_DEFAULTS.sessionReadMs,
      "session.messages",
    )
    return "responsive"
  } catch (e) {
    if (e instanceof FlowDeskTimeoutError) return "unresponsive"
    return "unknown"
  }
}
```

**출력**: `/flowdesk-status` 응답에 `sessionHealth: "responsive" | "unresponsive" | "unknown"` 추가.

---

### P6 — Guarded Auto-Abort (옵션, Release 1 후반 또는 별도 gate)

> **Release 1 스코프 조건**: Guard 승인 또는 명시적 사용자 opt-in이 증명된 경우에만 활성화.

**설계 원칙**:
1. `autoAbortOnStall: false` 기본값. 사용자가 명시적으로 `true`로 설정.
2. abort 전 사용자에게 **취소 가능한 예고** (예: 5초 카운트다운 카드).
3. FlowDesk-owned lane의 SSE session만 대상 (사용자 main session 제외).
4. abort 발생 시 `flowdesk.lane_stall_recovery.v1` evidence 기록.
5. abort 이후 stall 재발 시 이전 auto-abort 이력 포함해서 안내.

**Stall 판정 조건 (multi-factor, false positive 방지)**:

```
confirmed_stall = all of:
  (A) Evidence Stall: 마지막 heartbeat > configurable threshold (기본 5분)
  (B) SDK Session Check: session.messages() 응답 없음 (P5 검증 후)
  (C) Lane state: lifecycle "running" 또는 "awaiting_dependency"
  (D) Not: main session (사용자 세션은 절대 auto-abort 대상 아님)
```

**config**:
```jsonc
"stallRecovery": {
  "autoAbortOnStall": false,         // 기본 false, 명시적 opt-in 필요
  "stallConfirmThresholdMs": 300000, // Evidence stall 판정 기준 (5분, 기본)
  "sessionHealthCheckEnabled": true, // P5 의존 (false면 A+C만으로 판정)
  "preAbortWarningMs": 5000,         // abort 전 예고 시간
  "abortOnlyFlowDeskOwnedLanes": true // 사용자 세션 보호 (변경 불가)
}
```

**rule 10 수정 조건 (선행 필요)**:
- P6 코드 구현 완료
- 통합 테스트 통과 (false positive 0%, confirmed stall auto-recovery 확인)
- ADR 작성 및 Guard 리뷰 완료
- 위 3가지 이후에만 rule 변경

---

## 4. 구현 순서 및 의존성

```
[P2 스파이크] ──────────────────────────────────────────►
    |                                                    |
    | (스파이크 결과에 따라 P5, P6 진행 여부 결정)          |
    ▼                                                    ▼
[P1 withTimeout]──►[P3 stallAlert wrapping]    [P5 Session Health Check]
                   [P4 Lane Abort Tool]         (P2 확인 후)
                                                    |
                                                    ▼
                                           [P6 Guarded Auto-Abort]
                                           (P5 확인 후, Guard 승인 후)
```

| 단계 | 작업 | Release 1 여부 | 선행 조건 |
|------|------|--------------|---------|
| P1 | withTimeout helper | ✅ R1 | 없음 |
| P2 | SDK 스파이크 (ADR) | ✅ R1 (필수 선결) | P1 |
| P3 | stallAlert timeout wrapping | ✅ R1 | P1 |
| P4 | Lane Abort Tool | ✅ R1 | P1 |
| P5 | Session Health Check | ✅ R1 조건부 | P2 확인 |
| P6 | Guarded Auto-Abort | ⚠️ R1 후반 / 별도 gate | P5 + Guard |

---

## 5. 테스트 전략

### Unit

| 대상 | 테스트 케이스 |
|------|------------|
| `withTimeout` | (a) 정상 완료, (b) timeout 발동 → FlowDeskTimeoutError, (c) timeout 후 handle 정리됨, (d) 원 promise reject 시 timeout handle 정리됨 |
| `collectStallAlertSummary` | (a) statusLive timeout → undefined 반환, (b) stall 없음 → undefined, (c) stall 있음 → 요약 반환 |
| `checkSdkSessionHealth` | (a) 정상 응답 → responsive, (b) timeout → unresponsive, (c) client.messages 없음 → unknown |

### Integration (fake-runtime 활용)

| 시나리오 | 검증 내용 |
|----------|---------|
| statusLive가 8초 이상 blocking | chat.message hook이 8초 내로 완료됨 (timeout 발동) |
| stalled lane 존재 시 `/flowdesk-abort laneId` | `lane_lifecycle: aborted` evidence 기록됨, SDK session 영향 없음 |
| P6 활성화 시 confirmed_stall 판정 | abort evidence 기록 + 예고 카드 출력 확인 |

### Spike 검증 (P2, 수동)

| 항목 | 방법 |
|------|------|
| `session.abort()` SSE 종료 여부 | fake-runtime 세션 생성 → abort 호출 → messages() 응답 확인 |
| `session.messages()` 부분 응답 | long-running prompt 중 messages() 2회 폴링 → 메시지 수 변화 확인 |

---

## 6. 비교: V1 → V2 주요 변경사항

| 항목 | V1 (blocked) | V2 (신규) |
|------|-------------|---------|
| OMO 의존 | 코드·패턴·상수 복제 | 없음. 독립 설계 |
| P0 event-watchdog | `client.event.subscribe` 기반 | **폐기** (API 없음) |
| P3 fallback chain | Release 1 금지 자동 fallback | **제거** |
| auto-abort | 선행 rule 수정 제안 | Guard 승인 후 opt-in, rule은 구현 후 수정 |
| 타임아웃 | 전역 상수 하드코딩 | config-aware, 기본값 보수적 |
| P0+P2 경합 | 두 메커니즘 독립 동작 | 단일 경로 (P3에서 통합) |
| 통계 주장 | "11% stall 해소" | 주장 없음. 스파이크 결과로 판단 |
| SDK 스파이크 | 없음 | **P2로 선결 조건화** |
| rule 10 수정 | 선행 수정 제안 | 구현·테스트·ADR 완료 후에만 수정 |

---

## 7. 외부 위험 및 완화

| 위험 | 완화 |
|------|------|
| `session.abort()`이 SSE를 끊지 못함 | P2 스파이크로 사전 확인. 끊지 못하면 P6 가치 감소 → P6 연기 |
| `session.messages()` polling이 세션 부하 유발 | P5를 status/doctor 호출 시에만 실행. chat.message마다 실행 안함 |
| config 미설정 시 기본값으로 사용자 세션 abort 위험 | `abortOnlyFlowDeskOwnedLanes: true` 하드코딩, config로 변경 불가 |
| withTimeout 후 late reject가 unhandled rejection | `Promise.race` 패턴에서 losing promise reject는 자동으로 무시. Node.js 15+ 에서는 unhandledRejection 이벤트 발생 가능 → losing promise의 .catch(noop) 추가 고려 |

---

## 8. 관련 파일 목록 (구현 예상 변경)

```
packages/opencode-plugin/src/
  shared/
    with-timeout.ts                  ← 신규 (P1)
  server.ts                          ← 수정 (P3: collectStallAlertSummary wrapping)
  command-handlers.ts                ← 수정 (P4: /flowdesk-abort laneId 지원)
  managed-dispatch-adapter.ts        ← 수정 (P1: 모든 client.session.* wrapping)
  status-live-tool.ts                ← 수정 (P3: executeFlowDeskStatusLiveV1 timeout)
  runtime-reviewer-execution-bridge.ts ← 수정 (P1: spawn/check timeout)

docs/
  adr/0002-sdk-surface-verification.md ← 신규 (P2 스파이크 결과)
  STALL_RECOVERY_PLAN_V2.md           ← 본 문서
```
