# FlowDesk Stall Recovery V11.3 — 이벤트-즉시 종결 (event-awakened watchdog)

> **설계 정정 (2026-06-02, 2-model 리뷰 반영)**: 초안의 "event-hook과 watchdog 둘 다 캡처(dual-entry)"는
> await 인터리빙 중복 캡처 race + polling 미감소로 `changes_required`. 정정안 = **event-awakened watchdog**:
> 캡처는 watchdog 단일 소유로 두고, 이벤트는 watchdog 사이클을 **즉시 깨우기만(poke)** 한다(디바운스 + 재진입 가드 + 결정적 terminal id).
> event-hook은 observer로 유지(SDK client·캡처 책임 없음). 폴링은 이벤트 누락 backstop으로 불변.

> **배경 (2026-06-02)**: V11.2에서 종료 "판정"은 이벤트(turn-completed / session.error)로 하지만,
> 정상 종료(turn-completed)의 실제 **캡처(task_result write)는 watchdog `setInterval` 폴링 사이클에서만** 일어난다.
> 즉 이벤트를 받고도 다음 폴링 사이클(기본 30s 간격)을 기다린다. 사용자 지적: "이벤트로 종료/에러를 감지하면
> 그 이벤트를 받아 바로 처리해야지 폴링할 필요가 없다."
>
> **현재 비대칭** (V11.2):
> - `session.error` → event-hook이 **즉시** task_failed 기록 (`writeSessionErrorTerminal`) ✅
> - `message.updated(time.completed)` → event-hook은 **progress 라벨만** 기록, 캡처는 watchdog 폴링에서 ❌
>
> **V11.3 목표**: 정상 종료(turn-completed)도 에러처럼 **이벤트 핸들러에서 즉시 캡처**한다. watchdog 폴링 루프는
> "이벤트가 누락된 transport 장애" 대비 **타임아웃 backstop으로 격하**(정상 경로에선 캡처 주체가 아님).

---

## 1. 현재 사실관계 (조사 완료)

- event-hook `observeFlowDeskOpenCodeEventV1(input: { rootDir, event })` — 현재 client 인자 없음.
- 호출부(server.ts:5113 `eventHook`)는 watchdog의 `capturedClient`(server.ts:5032, `input.client`)와 **동일 스코프** → event-hook도 같은 SDK client를 캡처해 `session.messages`를 읽을 수 있다. (배선 가능, 확인됨)
- 캡처 멱등 가드 `laneAlreadyHasTerminalTaskEvidence`는 이미 존재 → 중복 캡처 방지 기반 있음.
- tool 상태 / turn-completed 신호는 append-only progress evidence에서 도출(V11.2 Slice 1·2).

---

## 2. 설계 — event-awakened watchdog (리뷰 반영, dual-entry 폐기)

> **다관점 리뷰 결론 (Claude/GPT 합의)**: 처음 초안의 "event-hook과 watchdog **둘 다** 캡처하는 dual-entry"는
> (R3) await 경계 인터리빙으로 **중복 task_result write race**가 실재하고, polling 위에 fast-path를 더해
> **코드만 늘 뿐 polling을 줄이지 못한다.** 더 깨끗한 설계는 GPT 대안 (a) **event-awakened watchdog**:
> **캡처는 watchdog 단일 소유**로 두고, **이벤트는 watchdog 사이클을 즉시 깨우기만(poke)** 한다.

### 2.1 캡처는 watchdog 단일 소유 (진입점 1개)
- turn-completed 캡처 로직(monitor 분기 0)은 **watchdog(monitor) 안에만** 둔다. event-hook은 캡처하지 않는다.
- → **중복 캡처 race 원천 차단** (캡처 진입점이 하나라 인터리빙 자체가 없음).
- → event-hook은 **observer로 유지** (SDK client·캡처·retry·nudge·timeout 책임 안 가짐 → "두 번째 watchdog" 회피).

### 2.2 이벤트가 watchdog를 즉시 깨운다 (poke)
- watchdog 사이클 실행 함수(`runFlowDeskWatchdogCycleV1`)를 **온디맨드로 즉시 호출**할 수 있는 트리거를 둔다.
- event-hook이 **종결-관련 이벤트**(turn-completed, tool-settled, session.idle, session.error)를 child-session 바인딩과 함께 관측하면:
  1. 기존대로 progress/terminal evidence 기록.
  2. 해당 워크플로의 watchdog 사이클을 **즉시 1회 실행하도록 poke**(디바운스 적용).
- watchdog 사이클은 기존 로직 그대로(공유 함수 추가 없음) child-session을 reload해 캡처/타임아웃/nudge 처리.
- **재진입 가드**: poke로 인한 즉시 실행과 setInterval 주기 실행이 겹치지 않도록 워크플로/프로세스 단위 **in-flight 플래그(async mutex)**로 직렬화. 한 번에 한 사이클만.
- **디바운스**: 짧은 시간 다수 이벤트(스트리밍 message part)가 watchdog를 폭주 호출하지 않도록, 종결-관련 이벤트(turn-completed/idle/error/tool-settled)에만 poke + 최소 간격(예: 250ms) 디바운스. 일반 message part는 poke 안 함.

### 2.3 결정적 terminal evidence id (R3/idempotency 보강)
- 리뷰 합의: 랜덤 id + 존재 체크가 아니라 **결정적 id**가 불변식.
- watchdog 캡처가 쓰는 task_result evidence id를 `(workflowId, attemptId, laneId, terminalKind)` 기반 **결정적**으로 생성 → 같은 lane의 두 번째 캡처 write는 **동일 파일 덮어쓰기(no-op)**, 절대 2개 생성 안 됨. `laneAlreadyHasTerminalTaskEvidence`는 guard로 유지(불변식은 결정적 id).
- (단일 진입점이라 race가 이미 없지만, 결정적 id로 이중 방어.)

### 2.4 watchdog 재진입 가드 (in-flight)
- 현재 `setInterval` 콜백은 사이클이 30s를 초과하면 이론상 겹칠 수 있다. poke가 추가되면 겹침 가능성이 커지므로 **워크플로 단위 in-flight 플래그**로 "이미 실행 중이면 즉시 재실행하지 않고 1회 pending 표시"만 한다.

### 2.5 graceful degrade / backstop
- poke 트리거가 없거나(설정 미배선) 이벤트가 아예 안 오면(transport 장애) → **setInterval backstop이 그대로** 캡처/타임아웃 처리. V11.2 대비 안전망 불변.
- edge-triggered 한계(turn-completed가 tool-settled보다 먼저 옴) → tool-settled 이벤트도 poke 대상이므로 **다음 종결-관련 이벤트에서 watchdog가 다시 깨어 재평가** → dual-entry 초안의 "재트리거 없음" 문제 해소.

---

## 3. 위험·경계 (event-awakened 반영)

- **R1 중복 캡처 — 해소**: 캡처 진입점이 watchdog **하나**뿐이라 dual-entry race가 구조적으로 없음. 추가로 결정적 terminal id(§2.3)로 이중 방어.
- **R2 재진입(poke + interval 겹침)**: 워크플로 단위 in-flight 플래그(§2.4)로 한 번에 한 사이클만. 겹침 요청은 pending 1회로 합쳐짐.
- **R3 디바운스/폭주**: 스트리밍 중 다수 이벤트가 watchdog를 폭주 호출하지 않도록, **종결-관련 이벤트에만 poke + 최소간격 디바운스**(§2.2). 일반 message part는 poke 안 함.
- **R4 이벤트 누락(transport 장애, UEP-036 유형)**: poke가 안 와도 **setInterval backstop이 그대로** 처리. V11.2 안전망 불변.
- **R5 body 미동기**: turn-completed 시점 body가 비면 watchdog가 `held` → awaiting_body_capture 재시도(즉시 no_response 금지). poke가 한 번 더 오거나 다음 interval이 이어받음.
- **R6 권한 경계**: event-hook은 **여전히 observer** — SDK client·캡처·abort·prompt를 갖지 않음. poke는 "내부 watchdog 사이클 실행 요청"일 뿐 새 권한 아님. dispatch/fallback/hard-chat 불변.
- **R7 멀티스텝 turn 조기 캡처**: turn-completed가 step마다 올 수 있으므로 expectedTurn 바인딩은 "epoch 이후 첫 turn"이되, 캡처는 `!toolRunningNow && !toolStateUnknown` 가드 뒤에서만 — step 사이 tool이 곧 열리면 toolRunningNow로 보류. (V11.2 로직 그대로, poke는 트리거만.) 구현 시 provider의 time.completed 의미(최종 step만인지) 검증 필요.

## 4. 슬라이스

- **Slice A — watchdog 온디맨드 실행 + 재진입 가드**: `runFlowDeskWatchdogCycleV1`를 setInterval 외에 **즉시 호출 가능한 트리거**로 노출하고, 워크플로 단위 in-flight 플래그로 직렬화. 결정적 terminal evidence id 도입(§2.3). 테스트: 동시 트리거 2회 → 사이클 1회만 실행/캡처 1개만, 결정적 id로 중복 write가 덮어쓰기.
- **Slice B — event-hook poke 배선**: event-hook이 종결-관련 이벤트(turn-completed/tool-settled/session.idle/session.error) 관측 시 해당 워크플로 watchdog를 디바운스 poke. event-hook은 캡처/SDK client를 갖지 않음(observer 유지). 테스트: turn-completed 이벤트 → watchdog poke 호출됨 / 일반 message part → poke 안 함 / 디바운스 동작.
- **Slice C — 통합 검증 + 라이브**: 전체 회귀, 라이브 스모크 — 정상 lane이 **다음 setInterval(최대 30s)까지 기다리지 않고** 이벤트 직후 즉시 캡처되는지(종결 지연 단축 확인), 이벤트 누락 시 backstop 정상.

---

## 5. 비범위
- watchdog 폴링 간격/타임아웃 값 변경 없음.
- abort/nudge/continuation 권한 변경 없음(V11.2 그대로: continuation OFF).
- 새 dispatch/provider/fallback/hard-chat 권한 없음.
