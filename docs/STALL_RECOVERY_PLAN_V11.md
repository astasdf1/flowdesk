# FlowDesk Stall Recovery — 이벤트 기반 전환 설계 V11 (V11.2: 이벤트 토대 + 타임아웃 예외처리)

> **V11.2 확정 (2026-06-02)**: 방향 = **이벤트가 1차 토대(WHEN 판정), 이벤트 예외(누락/지연/race)는 silence "추정"이 아니라
> tool 가드 뒤 명시적 타임아웃으로 처리, 폴링은 body 추출 폴백 전용.** (폴링 silence 추정이 모든 버그의 근원이었음 — 1차 신호로 승격 금지.)
> 2차 다관점 리뷰(Claude `changes_required` / GPT `changes_required` / Gemini `inconclusive`)의 false-abort·오캡처 경로를 이 틀에서 흡수:
> (1) 타임아웃 종결도 `toolRunningNow=false` 게이트, (2) stale-tool은 `idle` 아닌 `unknown` 강등(주입/abort 차단), (3) session.idle은 dwell+후속 step/tool 없음 코로보레이션, (4) slow-first-token grace, (5) capture는 기대 messageId/seq 바인딩, (6) 중간텍스트는 코로보레이션 없이는 final 미확정 + awaiting_body_capture 재시도. continuation 자동 주입은 기본 OFF.
>
> **V11.2 확정보강 (2026-06-02, 2차 리뷰 합산)**: "종결 보장 3대 구멍" 메움 — **G1** `unknownStateMaxMs`(unknown 영구 deadlock 방지 → `abort(tool_state_unrecoverable)`), **G2** `absoluteLaneAgeMs`(true zero-event lane 종결 보장, meaningful-event 게이트 독립), **G3** expected-turn 바인딩(`time.created>laneEpoch` 첫 assistant 메시지, latest fallback 금지), **G4** dwell 비순환(idle 캡처는 body 안정성으로 코로보레이션), **G5** awaiting_body_capture 바운드(`bodyRetryMax`/interval, 즉시 no_response 금지), **G6** 스키마 최소화. Slice 순서 재조정: terminator(tool set+timeout)를 Slice 1로 선행.
>
> **V11.1 갱신 (2026-06-02, 1차 리뷰)**: per-callID open-tool 집합 + stale-tool timeout, turn_completed messageId/seq 바인딩, 단일 writer/`signal_write_seq`, idle epoch freshness, per-message monotonic seq.
>
> **작성 배경 (2026-06-02)**: V10까지의 watchdog는 child session의 종료/유휴 판정을
> `session.messages` **폴링 스냅샷 + silence 추정 + `hasRunningTool` 스냅샷**에 의존했다.
> 라이브 증거(`workflow-session-idle-continuation-20260601-slice1c`)에서 다음 회귀가 확인됨:
>
> - `message.part.updated`(step-finish, 20:14:49) 등 turn이 살아있는 상태에서
>   폴링이 silence를 idle로 오판 → `session.idle` 실관측 없이 continuation prompt 주입(20:15:12)
>   → 진행 중이던 turn이 `MessageAbortedError`로 abort(20:15:45). 즉 **"파일은 수정됐는데 실패"** 현상.
> - 동기 경로(slice1/post-restart)에서는 폴링이 child 메시지를 한 번도 못 읽어 `no_response` 종결.
>
> 결론: **종료/유휴 판정의 진실의 원천을 폴링 추정 → OpenCode 이벤트 신호로 교체한다.**
> 폴링은 "본문 텍스트 가져오기" 용도로만 강등한다.

---

## 1. 이벤트 성격 분류 (OpenCode SDK `types.gen.d.ts` 기준)

각 이벤트를 **역할(role)** 로 명확히 분리한다. 지금까지 이 성격을 뭉개 폴링 silence로 추정한 것이 결함의 근원이다.

| 이벤트 / 파트 | SDK payload 근거 | 의미 | FlowDesk 역할 |
|---|---|---|---|
| `message.updated` (info=AssistantMessage) with `time.completed` and/or `finish` | `AssistantMessage.time.completed?`, `AssistantMessage.finish?` | **turn(assistant 메시지) 권위적 종료** | **TURN_COMPLETED** (캡처 트리거, 최우선) |
| `session.error` (`MessageAbortedError`/`ApiError`/…) | `EventSessionError.properties.error` | turn 실패 | **FAILED** (terminal) |
| `session.idle` | `EventSessionIdle.properties.sessionID` | 세션 큐에 작업 없음 = 할 일 끝 | **IDLE** (continuation 게이트 + 보조 캡처) |
| `session.status` type=`idle` | `SessionStatus = {type:"idle"}` | idle 상태 보고 | **IDLE** (위와 동일 취급) |
| `session.status` type=`busy` | `{type:"busy"}` | 세션 바쁨 | **ACTIVITY** |
| `session.status` type=`retry` | `{type:"retry"}` | 재시도 중 | **ACTIVITY** |
| `message.part.updated` part=`tool`, state.status=`running` | `ToolStateRunning` | 도구 실행 시작/진행 | **TOOL_RUNNING** (continuation/캡처 금지 가드) |
| `message.part.updated` part=`tool`, state.status=`completed`/`error` | `ToolStateCompleted`/`ToolStateError` | 도구 종료 | **TOOL_SETTLED** (ACTIVITY) |
| `message.part.updated` part=`text` | `TextPart.text`, `time.end?` | 답변 본문 스트리밍 | **ACTIVITY** + 본문 출처 |
| `message.part.updated` part=`step-finish` | `StepFinishPart.reason` | **한 step(LLM 호출) 경계** (turn 종료 아님) | **ACTIVITY** (STEP 경계, terminal 아님) |
| `message.part.updated` part=`step-start` | `StepStartPart` | step 시작 | **ACTIVITY** |
| `permission.updated` | `Permission` | 권한 대기 | **AWAITING_PERMISSION** (nudge/abort 금지) |
| `permission.replied` | — | 권한 해제 | **ACTIVITY** (권한 대기 해제) |
| `message.updated`/`session.updated`/`session.diff` (완료 신호 없음) | — | 일반 갱신 | **ACTIVITY** |
| `session.compacted` | `EventSessionCompacted.properties.sessionID` | 컨텍스트 압축 | **ACTIVITY** (중립) |
| `file.edited` | `EventFileEdited.properties.file` **(sessionID 없음)** | 파일 수정 | **사용 불가** — child session 바인딩 불가하므로 활동 신호로 쓰지 않음 |

### 핵심 분리 원칙
1. **`step-finish` ≠ turn 종료.** step-finish는 LLM 호출 1회의 경계일 뿐, 같은 turn에서 도구 후속 step이 이어질 수 있다. 따라서 **STEP 경계는 ACTIVITY로만** 취급하고, 절대 terminal/idle 신호로 쓰지 않는다. (slice1c가 혼동한 지점)
2. **turn 종료의 권위 = `message.updated`의 `AssistantMessage.time.completed`(+`finish`).** 이것만이 "이 turn이 진짜 끝났다"를 의미한다.
3. **`session.idle` ≠ turn 종료.** idle은 세션 레벨 "할 일 없음" 신호다. continuation 주입을 게이트하는 데 쓰고, 본문이 이미 있으면 보조 캡처에도 쓴다. 단, turn-completed보다 약한 신호다.

---

## 2. 상태 모델 — child-session 레코드 신호 누적 (이벤트 기반)

이벤트는 상태 전이만 주므로, `agent_task_child_session` 레코드에 **신호**를 누적해 "현재 상태"를 도출한다. (폴링 스냅샷 대체)

> **V11.1 변경 (다관점 리뷰 반영)**: 단일 `running/settled` 타임스탬프 쌍은
> (a) settle 이벤트 1개 누락 시 영구 `toolRunningNow=true` 고정, (b) 동시 도구 표현 불가,
> (c) wall-clock max 누적의 out-of-order 취약 문제가 있다(Claude/GPT/Gemini High 합의).
> 따라서 **per-callID open-tool 집합 + monotonic per-message sequence + stale-tool timeout**으로 모델링한다.

`flowdesk.agent_task_child_session.v1` 에 추가(모두 optional, 하위호환):

```typescript
// turn 종료 권위 신호 — 멀티턴 식별을 위해 messageId/seq 바인딩
last_turn_completed_message_id?: string;    // 완료된 AssistantMessage.id
last_turn_completed_seq?: number;           // 단조 시퀀스(이벤트 도착 순서가 아니라 메시지 순서)
last_turn_completed_signal_at?: string;     // message.updated(info.time.completed) 관측 시각
last_turn_completed_finish_reason?: string; // AssistantMessage.finish (있을 때)

// 도구 상태 — per-callID open set (단일 타임스탬프 쌍 폐기)
open_tool_call_ids?: string[];              // 현재 running/pending 상태인 tool callID 집합
open_tool_first_started_at?: string;        // 집합이 비어있지 않게 된 최초 시각(stale timeout 기준)
last_tool_event_seq?: number;               // 마지막 처리한 tool 이벤트 seq (중복/역순 방지)

// idle — lane attempt epoch 기준 freshness 바인딩
last_session_idle_signal_at?: string;       // session.idle / session.status idle 관측 시각
last_idle_continuation_signal_at?: string;  // 이미 처리한 idle 신호 (중복주입 방지)
idle_continuation_count?: number;

// V11.2 G1: unknown 상태 추적 (stale-tool → unknown, unknownStateMaxMs 종결 기준)
tool_state_unknown_since?: string;          // toolStateUnknown 진입 시각 (없으면 unknown 아님)

// V11.2 G5: awaiting_body_capture 바운드 재시도
awaiting_body_capture_attempts?: number;    // event-terminal/timeout 후 body 빈 경우 재시도 횟수
awaiting_body_capture_since?: string;       // 첫 awaiting 진입 시각

// 단일 writer 보호
signal_write_seq?: number;                  // 레코드 단조 증가 시퀀스 (LWW 회귀 방지)
```

> **V11.2 G6 스키마 최소화 (GPT med)**: 위 필드 중 **crash recovery/audit에 필수인 것만 영구 저장**한다 —
> `last_turn_completed_message_id/seq/signal_at`, `open_tool_call_ids` 스냅샷, `tool_state_unknown_since`,
> `awaiting_body_capture_attempts`, terminal/timeout reason, `signal_write_seq`. `last_tool_event_seq`, idle freshness,
> dwell 계산은 **메모리/파생**으로 두고 영구 레코드 churn을 줄인다(crash recovery에 불필요하면 저장 안 함).
> `laneEpoch`는 기존 `created_at`을 재사용한다(신규 필드 아님).

### 도출 규칙 (monitor 내) — V11.1
- **toolRunningNow** = `open_tool_call_ids`가 비어있지 않음. 단, **stale-tool timeout**:
  `now - open_tool_first_started_at >= toolStaleMs`이면 그 집합을 강제로 비운 것으로 간주(force-settle).
  → settle 누락으로 인한 영구 hang을 끊는다. callID를 알 수 없는 런타임에선 "running/unknown"을 settled가 아니라 **running**으로 보수적으로 처리하되 stale-timeout으로 회수.
- **turnCompletedObserved** = `last_turn_completed_seq`가 가장 최신 assistant 메시지 seq와 일치하고(=옛 turn 아님),
  그 이후 신규 `open_tool` 또는 신규 text part가 없으며, `toolRunningNow === false`.
- **freshIdleSignal** = `last_session_idle_signal_at`가 **lane attempt epoch(created_at) 이후**이고,
  마지막 meaningful 활동 이후이며, 아직 미처리(`> last_idle_continuation_signal_at`).
  → 재시작 후 재생된 옛 idle 이벤트는 epoch 이전이므로 continuation을 authorize하지 못한다.

> 멀티-turn 안전성(Claude #1·7): turn-completed는 **메시지 식별자(seq/id)** 에 바인딩되므로,
> 새 turn(N+1)이 시작되면 `last_turn_completed_seq`가 더 이상 "가장 최신"이 아니게 되어 옛 turn 캡처가 차단된다.
> out-of-order(Gemini, Claude med)는 wall-clock이 아니라 **per-message monotonic seq** 비교로 방지한다.

---

## 3. monitor 분기 (폴링 silence 제거)

```
for each non-terminal lane:
  signals = deriveFromChildSessionRecord(lane)   // 이벤트 누적에서 도출

  if lane has terminal evidence: skip
  if AWAITING_PERMISSION outstanding: skip (nudge/abort 금지)

  # 1. TURN_COMPLETED 캡처 (권위 신호 + tool 가드)
  if signals.turnCompletedObserved AND not signals.toolRunningNow:
       text = pollChildSessionText(lane)          # 폴링은 '본문만' 읽음
       if text 비어있지 않음: write task_result(finalization_reason="turn_completed"); done
       # 본문이 비었으면 아래 IDLE/continuation 로직으로 진행

  # 2. IDLE 보조 캡처 (turn-completed가 없을 때만, idle 실관측 필요)
  elif signals.freshIdleSignal AND not signals.toolRunningNow:
       text = pollChildSessionText(lane)
       if text 비어있지 않음: write task_result(finalization_reason="stable_idle"); done

  # 3. continuation 주입 — ★ session.idle 실관측이 있을 때만 ★ (silence 추정 금지)
  if (not captured) AND signals.freshIdleSignal AND not signals.toolRunningNow
        AND text 비어있음 AND idle_continuation_count < maxIdleContinuations:
       sendIdleContinuationPrompt(lane); record handled idle signal; done

  # 4. abort — recovery 예산 소진 + 진짜 침묵
  if silenceMs >= abortThresholdMs AND recoveryBudgetExhausted:
       partial 캡처 시도 → 없으면 task_failed(no_response/sdk_prompt_timeout); done

  # 5. nudge — 기존 legacy 경로 (조건부)
  ...
```

**핵심 변화점**
- continuation 주입 조건에서 **`silenceMs >= idleSettleMs` 단독 진입 경로를 제거.** 오직 `freshIdleSignal`(=`session.idle` 실관측)이 있을 때만 주입한다. → slice1c abort 원인 직접 제거.
- 캡처/continuation의 tool 가드를 **이벤트 도출 `toolRunningNow`** 로 교체. (폴링 `hasRunningTool` 스냅샷 의존 제거)
- 캡처 트리거를 silence가 아니라 **TURN_COMPLETED 신호**로 전환.

### ★ V11.2 철학 확정 (사용자 방향 + 2차 다관점 리뷰 반영, 2026-06-02)

> **이벤트가 1차 토대(진실의 원천)이고, 이벤트의 예외상황(누락/지연/race)은 silence "추정"이 아니라 명시적 타임아웃으로 처리한다. 폴링은 본문(body) 추출 폴백으로만 쓰고 WHEN을 판정하지 않는다.**
>
> 폴링 silence 기반 idle "추정"이 모든 버그의 근원이었다(slice1c mid-turn abort, zero-event no_response).
> 따라서 silence를 **캡처/판정의 1차 신호로 승격하지 않는다.** silence는 오직 "이벤트가 와야 할 시간이 지났다"는
> **예외 타임아웃**으로만 쓰며, 그 타임아웃조차 `toolRunningNow` 가드 뒤에 둔다.

2차 리뷰(Claude/GPT/Gemini)에서 드러난 false-abort/오캡처 경로를 **이 틀 안에서** 흡수한다:

1. **타임아웃 종결도 `toolRunningNow=false` 게이트 필수** (Claude #1 high): 이벤트-예외 abort 타임아웃은
   `silenceMs >= abortThresholdMs AND not toolRunningNow AND recoveryBudgetExhausted`일 때만. 90초 단일 tool 등
   장시간 정상 작업을 죽이지 않는다.
2. **stale-tool은 `idle`이 아니라 `unknown`으로 강등** (Claude #2, Gemini high): settle 누락으로 stale timeout이
   open-tool set을 비우면 `toolRunningNow=false`가 아니라 **`toolStateUnknown=true`**. unknown 동안은
   continuation·abort 주입을 **차단**하고, 폴링 body 시도만 허용(있으면 캡처, 없으면 계속 대기 후 별도 unknown-timeout).
3. **session.idle은 dwell + 후속 step/tool 없음 코로보레이션** (Claude #3 high): step 사이 emit된 idle이 mid-turn
   주입을 일으키지 않도록, idle 관측 후 `minIdleDwellMs` 동안 `step-start`/`tool running`/text part가 **새로 안 오면**에만
   fresh idle로 인정. (단일 idle 이벤트로 즉시 주입 금지)
4. **slow-first-token grace ≠ post-activity quietPeriod** (Claude #4 med): 첫 meaningful 이벤트 관측 전에는
   nudge 금지(heavy 모델 opening turn 보호). nudge/타임아웃 침묵은 **meaningful 활동 이후**부터 측정.
5. **capture는 expected assistantMessageId/seq에 바인딩** (Claude #5, Gemini multi-turn): "latest seq"가 아니라
   이 attempt가 기대하는 turn에만 캡처. 새 turn 텍스트를 옛 결과로 오캡처 방지.
6. **중간 텍스트 오캡처 방지** (Gemini high, GPT): `time.completed` 또는 dwell 코로보레이션이 없으면
   "I'll start..." 같은 의도 표명 텍스트를 final로 **확정하지 않는다.** body 캡처는 bounded 재시도(`awaiting_body_capture`)로
   안정화 후 확정.

### monitor 분기 (V11.2)

```
for each non-terminal lane:
  signals = deriveFromEvents(lane)   # 이벤트 누적이 1차 토대

  if terminal evidence: skip
  if AWAITING_PERMISSION: skip

  # 1. 이벤트 1차: TURN_COMPLETED 캡처 (권위 신호)
  if signals.turnCompletedForThisAttempt AND not signals.toolRunningNow AND not signals.toolStateUnknown:
       text = pollBody(lane)                 # 폴링은 body만
       if text: task_result(turn_completed); done

  # 2. 이벤트 1차: 코로보레이션된 fresh idle 보조 캡처
  elif signals.corroboratedFreshIdle AND not signals.toolRunningNow AND not signals.toolStateUnknown:
       text = pollBody(lane)
       if text(안정화): task_result(stable_idle); done

  # 3. 이벤트-예외 타임아웃 종결 (silence는 '추정'이 아니라 '이벤트 지연' 예외)
  #    반드시 tool 가드 뒤. unknown 동안은 abort 금지(body만 시도).
  if silenceFromMeaningfulMs >= abortThresholdMs AND not signals.toolRunningNow:
       text = pollBody(lane)
       if text(안정화): task_result(timeout_partial/stable_idle); done
       if signals.toolStateUnknown: continue   # unknown은 아직 abort 안 함
       if recoveryBudgetExhausted: abort + task_failed(no_response); done

  # 4. nudge — 첫 meaningful 이벤트 이후에만, capped
  if firstMeaningfulSeen AND silenceFromMeaningfulMs >= quietPeriodMs AND nudge<maxNudges:
       nudge(); done

  # continuation 자동 주입은 기본 비활성(slice1c 근원). 명시적 옵트인일 때만,
  # corroboratedFreshIdle + !toolRunningNow + !toolStateUnknown + capped 에서만.
```

이로써 **이벤트가 1차로 WHEN을 정하고**, 이벤트가 안 오거나(zero-event) 누락되는 예외는
**tool 가드 뒤의 명시적 타임아웃**이 종결한다 — silence를 idle로 추정하지 않으므로 정상 동작을 도중에 죽이지 않는다.

### ★ V11.2 확정보강 (2차 리뷰 합산, "종결 보장의 3대 구멍" 메움)

> 2차 리뷰(Claude/GPT/Gemini 만장일치)가 남긴 위험은 전부 **"lane이 영구히 멈추거나(deadlock) 오캡처될 수 있는 종결 보장의 구멍"**이었다.
> 방향(이벤트 토대 + 타임아웃 예외)은 유지하되, 아래 종결 규칙을 **명시적 타임아웃/바인딩**으로 못박는다. **모든 클록은 주입식.**

**G1. unknown-timeout — `unknownStateMaxMs` (Claude/GPT/Gemini high)**
`toolStateUnknown`은 abort/continuation을 막지만 **영구 limbo가 되면 안 된다.** unknown 진입 시각(`tool_state_unknown_since`)부터
`unknownStateMaxMs` 초과 + body 없음이면 **강제 종결**: `abort(tool_state_unrecoverable)` + redacted evidence. (unknown은 "잠깐 보류"이지 "영원히 대기"가 아니다.)

**G2. absolute lane-age cap — `absoluteLaneAgeMs` (Claude/Gemini high)**
slow-first-token grace(첫 meaningful 이벤트 전 silence 미측정)가 **true zero-event lane을 영원히 안 죽이는** 역효과를 막기 위해,
meaningful-event 게이트와 **독립적인** 절대 수명 상한을 둔다. `now - laneEpoch >= absoluteLaneAgeMs`이고 `!toolRunningNow`이면
body 최후 폴링 → 있으면 캡처, 없으면 `abort(no_response/firstEventDeadline)`. 이 cap이 **최후 종결을 무조건 보장**한다.

**G3. expected turn 바인딩 해소 규칙 (Claude/GPT high) — latest fallback 금지**
watchdog는 모델이 메시지를 만들기 전엔 messageId를 모르므로, expected turn을 다음으로 해소한다:
`time.created > laneEpoch` AND (가능하면 attempt 태그/첫 assistant 메시지) 인 **첫 AssistantMessage**를 이 attempt의 expected turn으로 1회 바인딩.
바인딩이 아직 확정되지 않았으면 rule 1 캡처를 **보류**한다(절대 "latest"로 fallback하지 않음 → 멀티턴 오캡처 차단).

**G4. dwell 비순환 (Claude/Gemini med)**
rule 2(corroboratedFreshIdle)를 트리거하는 dwell과 rule 6(중간텍스트 final 미확정) 코로보레이션은 **같은 dwell이면 안 된다(순환).**
rule 2의 idle 캡처는 다음 중 **더 강한 신호**를 추가로 요구한다: (a) `turnCompleted`(time.completed) 동반, 또는
(b) idle 이후 `minIdleDwellMs` 동안 신규 step-start/tool-running/text part가 없을 뿐 아니라 **그 dwell 동안 body가 변하지 않음(stabilized)**.
즉 idle 단독은 terminal로 승격하지 않고, body 안정성으로 코로보레이션한다.

**G5. awaiting_body_capture 바운드 명시 (Claude/Gemini med)**
event-terminal(또는 G1/G2 타임아웃) 후 body가 비어있으면 `awaiting_body_capture`로 `bodyRetryMax`회 / `bodyRetryIntervalMs` 간격 재시도.
재시도 소진 후에도 body 없음이면 최종 분류: turn_completed 이벤트가 있었으면 `turn_completed_empty`(usable=false), 아니면 `no_response`.
**즉시 no_response 금지**(SDK 버퍼 지연으로 결과 유실 방지).

**보강 후 종결 보장 불변식**: 모든 lane은 유한 시간 내 반드시 capture 또는 abort에 도달한다 —
정상 종료는 이벤트(G3 turnCompleted / G4 idle), 누락/지연은 타임아웃(G1 unknown / G2 lane-age / §3 abortThreshold)이 보장하고,
어떤 분기도 `toolRunningNow=true`인 동안에는 abort/continuation하지 않으므로 정상 작업을 죽이지 않는다.

### 이중 진실원 일관성 (GPT #6, 폴링 race)
- 폴링은 **비권위(non-authoritative)**: event terminal인데 폴링 본문이 비어있으면 `no_response`로 즉시 실패시키지 않고
  `awaiting_body_capture` 상태로 **바운드 재시도**(N회/△t) 후에만 §4로 내려간다. 폴링 본문이 event terminality를 **뒤집지 않는다**.

---

## 4. 동시성·일관성·back-compat (V11.1 추가)

- **단일 writer 소유권 (GPT #2 High) — 구현 시 검증 결과: `signal_write_seq` 불필요**:
  GPT는 event-hook과 monitor의 동시 write로 인한 LWW 손상을 우려했으나, 구현 단계에서 실제 아키텍처를 확인한 결과 **event-hook은 child-session 레코드를 read-only로만 사용**(binding 조회)하고 **child-session write는 monitor(+ launch 시 agent-task-runner 1회)만** 수행한다. tool 상태·turn-completed 신호는 child-session이 아니라 **append-only progress 증거에서 도출**되고, monitor는 watchdog `setInterval`로 사이클당 순차 실행되며 각 사이클은 디스크 최신 레코드를 read-modify-write(단조 증분)한다. 따라서 동시 writer 경합이 구조적으로 없고, 설령 사이클이 겹쳐도 카운터가 한 번 덜 증가할 뿐 **역행(regress)은 발생하지 않는다.** `signal_write_seq` 시퀀스 머신은 실제 위험이 없어 **추가하지 않는다**(1b 단순화와 동일한 "실제 위험 없으면 미추가" 원칙). 진실원은 이미 append-only progress 증거이고 child-session은 monitor 단독 소유 캐시다.
- **이벤트 identity 바인딩 (GPT #1·3)**: `time.completed`로 turn 종료를 인정할 때 그 메시지가 **이 lane의 child session**에 속하는지(sessionID 일치) 확인. 재시작/세션 재사용 시 무관한 메시지가 엉뚱한 lane을 종료하지 못하게 한다.
- **back-compat (Claude low)**: 신규 optional 필드가 없는 **구버전 in-flight 레코드**는 다음 규칙으로 안전 처리:
  `open_tool_call_ids` 미존재 → `toolRunningNow=false`로 간주(단 폴링 `hasRunningTool` 안전망과 §3.4 silence fallback이 보호). `last_turn_completed_seq` 미존재 → turn_completed 캡처 비활성(폴링/idle 경로로만). 즉 구 레코드는 **legacy degraded 모드**로 떨어지고 V11 캡처/continuation 신경로를 부분 적용하지 않는다.
- **stall-projection 소비자 마이그레이션 (Claude low)**: step-finish를 ACTIVITY로 재분류해도 stall 분류가 조기 `late`로 회귀하지 않도록, meaningful-activity 판정에 step-finish/text part가 포함됨을 보장.

## 5. 슬라이스 분할 (메인에서 순차 구현, 1 objective/슬라이스) — V11.2

> 각 슬라이스: 좁은 변경 + 단위 테스트 + `build` + 해당 테스트 통과 후 다음 슬라이스.
> **GPT 권고(G5 slice 순서)**: terminator가 항상 먼저 존재하도록 **per-callID tool set + tool-gated 타임아웃 종결선을 Slice 1(최소 안전층)로 먼저** 깐다.
> 그 위에 이벤트 fast-path(turnCompleted 캡처)를 Slice 2로 올린다. 이렇게 하면 어느 중간 슬라이스에서도 "종결 보장"이 깨지지 않는다.

- **Slice 1 — 최소 안전층: per-callID tool set + tool-gated 타임아웃 종결선 (monitor + 스키마 코어)**
  - tool state 전이를 `open_tool_call_ids` 집합으로 누적(running/pending 추가, completed/error 제거), `last_tool_event_seq`로 역순/중복 방지. `toolRunningNow = 집합 비어있지 않음`.
  - stale timeout 초과 → `tool_state_unknown_since` 설정(=`toolStateUnknown`, **idle 아님**), unknown은 abort/continuation 차단·body 폴링만. **G1**: `unknownStateMaxMs` 초과 + body 없음 → `abort(tool_state_unrecoverable)`.
  - **G2 absoluteLaneAgeMs** + `silenceFromMeaningfulMs >= abortThresholdMs`, 둘 다 `!toolRunningNow` 게이트. body 있으면 캡처, 없으면 abort(no_response). **slow-first-token grace**는 abortThreshold에만 적용, lane-age cap은 무조건 적용(zero-event 종결 보장).
  - 테스트(fixtures 3·4·5·6·10·11): zero-event+body→캡처 / zero-event+no-body→lane-age abort / dropped settle→unknown→unknownStateMaxMs→abort / 90초 단일 tool→abort 안 함 / slow-first-token→opening nudge 안 함 / concurrent A·B.

- **Slice 2 — TURN_COMPLETED 이벤트 분류 + expected-turn 바인딩 캡처 (event-hook + monitor)**
  - `message.updated` info=assistant + `time.completed` → child-session에 `last_turn_completed_message_id/seq/signal_at(+finish)` 기록(**sessionID 일치 확인**). step-finish는 ACTIVITY 유지.
  - **G3 expected-turn 바인딩**: `time.created > laneEpoch`인 첫 assistant 메시지를 이 attempt의 expected turn으로 1회 바인딩. 미확정 시 캡처 **보류**(절대 latest fallback 금지).
  - 캡처 = `turnCompletedForThisAttempt` AND !toolRunningNow AND !toolStateUnknown AND body. (Slice 1 종결선은 그대로 fast-path 아래 안전망)
  - 테스트(fixtures 1·2): step-finish→terminal 아님 / turn-complete-then-new-turn→seq 바인딩으로 옛·새 turn 오캡처 차단 / 무관 sessionID→미적용.

- **Slice 3 — awaiting_body_capture 바운드 (G5) + 중간텍스트 오캡처 방지 (G4 일부)**
  - event-terminal/타임아웃 후 body 빈 경우 `awaiting_body_capture` `bodyRetryMax`회/`bodyRetryIntervalMs` 재시도 → 소진 시 `turn_completed_empty`(turnCompleted 있었음) 또는 `no_response`. **즉시 no_response 금지**.
  - 테스트(fixtures 7·8): event-terminal+empty body→재시도 후 late body 캡처 / 재시도 소진→분류.

- **Slice 4 — corroboratedFreshIdle 보조 캡처 (G4 비순환 dwell, continuation 기본 OFF)**
  - `corroboratedFreshIdle` = idle 관측 후 `minIdleDwellMs` 동안 신규 step/tool/text 없음 **AND body가 그 dwell 동안 불변(stabilized)** + epoch 이후 + 미처리. (rule 6 코로보레이션 = body 안정성, rule 2 트리거 dwell과 **다른 신호** → 비순환)
  - 보조 캡처만. **continuation 자동 주입 기본 OFF**; 옵트인 + 코로보레이션 + capped 에서만.
  - 테스트(fixtures 9·12): thinking-prefix("I'll...")-then-delayed-tool→body 불변 코로보레이션 실패로 중간텍스트 미캡처 / 재시작 옛 idle 재생→epoch 차단 / 코로보레이션된 idle+stabilized body→stable_idle.

- **Slice 5 — 통합 검증 + 문서/스냅샷 (signal_write_seq는 불필요로 확정)**
  - 구현 검증 결과 `signal_write_seq`는 단일-writer 아키텍처라 불필요(§4 참조) → 추가하지 않음. G6 스키마 최소화 확인.
  - `stall-recovery.test.ts` 전체 + `agent-task-output`/`async-lane`/`completion-ui-cache` 회귀, plugin+core 전체 `npm test`, build, `git diff --check`, `PROGRESS_SNAPSHOT.md` 갱신.

### 필수 테스트 픽스처 (2차 리뷰 합의 + V11.2 보강)
1. step-finish-then-more-tools (turn 계속) 2. turn-complete-then-new-turn (seq 바인딩 오캡처 차단)
3. dropped settle → unknown → **unknownStateMaxMs → abort(tool_state_unrecoverable)** 4. ZERO mid events + body → 타임아웃 캡처 / + no body → **absoluteLaneAgeMs abort**
5. out-of-order/중복 이벤트 (seq 방어) 6. concurrent tools A·B 7. 재시작 후 옛 session.idle 재생 → epoch 차단
8. event-terminal + empty body → awaiting_body_capture 재시도 → late body 캡처 9. thinking-prefix-then-delayed-tool → body 불변 코로보레이션 실패로 중간텍스트 미캡처
10. 90초 단일 long tool → abort 안 함 11. slow-first-token → opening turn nudge 안 함 12. dropped settle → unknown → 진짜 완료(late time.completed) → 정상 캡처(영구 unknown 아님)
> 모든 클록(`abortThreshold`, `staleToolMs`, `minIdleDwellMs`, `quietPeriod`, **`unknownStateMaxMs`**, **`absoluteLaneAgeMs`**, `bodyRetryIntervalMs`, freshness)은 **주입 가능**으로 → 결정적 테스트.

---

## 6. 안전 경계 (불변)

- 본 설계는 Release 1 / watchdog 범위. **실제 dispatch·provider fallback·hard-chat 권한을 추가하지 않는다.**
- continuation/nudge prompt 주입은 기존 capped 정책(`maxIdleContinuations`, `maxNudges`)을 유지·강화한다(완화 아님).
- 모든 신호는 redacted-first 증거로만 기록한다. raw prompt/transcript는 누적 필드에 넣지 않는다.
- 폴링 API(`session.messages`)는 제거하지 않고 **본문 추출 전용**으로 남긴다(이벤트 누락 환경의 안전망).
