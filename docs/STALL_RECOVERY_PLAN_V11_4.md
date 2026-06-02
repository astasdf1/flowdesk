# FlowDesk Stall Recovery V11.4 — silence-based nudge 제거 + abort 재정의

> **배경 (2026-06-02)**: 90초+ 장시간 lane 라이브 테스트에서 watchdog nudge가 2회 발생(`rawNudgeCount=2`)한 것이
> 관찰됨. nudge는 무해했지만(기본 `skipped` = 증거만 기록, 실제 prompt 안 보냄), 사용자가 핵심 모순을 지적:
> **이벤트로 종료/유휴를 판정하는데 nudge는 여전히 silence 추정(10초 침묵)으로 트리거**된다. 그리고 nudge는
> 본질적으로 **event-gated idle continuation(1c)의 silence-기반·default-noop 구버전**이다 — 같은 목적(멈춘 child 깨우기),
> 다른 트리거. continuation(이벤트 기반)이 그 역할을 더 정확히 대체하므로 **nudge는 중복이자 silence 추정 잔재**.

## 변경

1. **silence-based nudge 분기(branch 3) 제거.** `sendWatchdogNudge`, `AGENT_TASK_NUDGE_TEXT_WATCHDOG`,
   내부 `maxNudges`, nudge progress(`phase="nudged"`) 기록을 제거. 멈춘 child 깨우기는 event-gated opt-in
   idle continuation(1c)이, 진짜 멈춘 lane 종결은 abort/타임아웃이 담당.

2. **abort 재정의 (필수).** 다관점 리뷰(GPT)가 확인: 기존 기본 동작에서 abort를 실제로 트리거하던 것은
   `nudgeCount >= maxNudges`였다(skipped nudge도 `nudge_count`를 증가시켜 ~20초에 2 도달 → 30초에 abort).
   nudge를 제거하면 그 트리거가 사라지므로 abort가 G2(600s)로 회귀한다. 따라서 abort를 nudge 예산과
   무관하게 재정의:
   - `normalAbortEligible = silenceMs >= abortThresholdMs(30s) && !continuationBudgetPending && !toolRunningNow && !toolStateUnknown`
   - `continuationBudgetPending` = continuation이 opt-in(`maxIdleContinuations>0`)이고 아직 예산이 남은 경우에만 true
     → continuation을 켰을 때만 그 기회를 먼저 주고, 끄면(기본) silence+tool-gate만으로 abort.
   - G1(`unknownStateMaxMs`) / G2(`absoluteLaneAgeMs`) force-terminate 불변.

3. **하위호환**: input `maxNudges?`/`allowRawPromptNoReplyNudge?` 필드는 인터페이스에 남겨 기존 호출자가 넘겨도
   타입 호환되나 **무시**된다. 기존 child-session 레코드의 `nudge_count`는 읽되 abort 판정에 쓰지 않는다
   (abort는 silence+tool-gate로만). `nudgeCount`는 progress evidence의 `progress_seq` 계산에만 잔존.

## 안전성 (2-model 리뷰: GPT changes_required→방향확인, Gemini pass)

- **stuck lane**: text 후 영구 침묵(no tool/idle/turn-completed) → silence>=30s에 즉시 abort. 600s 회귀 없음.
- **running tool**: `toolRunningNow` 게이트로 30s+ 침묵에도 abort 안 함 → 완료 후 종결.
- **unknown tool**: 정상 abort 차단, G1만 force-terminate.
- **zero-event lane**: G2가 종결 보장.
- **meaningful progress**가 silence clock을 리셋하므로 진행 중 lane을 조기 종결하지 않음.
- **마이그레이션**: stale `nudge_count`는 abort 타이밍에 영향 없음(silence+tool-gate만).
- **reachability hole 없음** (Gemini): `!tool&&!unknown`→normal, `unknown`→G1, `tool/zero-event`→G2.

## 테스트 (리뷰 필수 픽스처 반영)

- silence-only quiet lane → **nudge 미발생**(`lanesNudged=0`), abort threshold 미만이면 abort 안 함, `nudged` phase 증거 없음.
- stuck lane → silence 29s 미abort / 31s abort(nudge 예산 무관, `lanesNudged=0`).
- migration: `nudge_count=2` + 최근 활동(5s 침묵) → abort 안 함.
- 기존 abort/tool-gate/G1/G2/continuation 테스트 회귀 유지.

## 비범위
- continuation(opt-in) 정책 불변(기본 OFF). 폴링/event-awakened(V11.3) 불변. 권한 변경 없음.
