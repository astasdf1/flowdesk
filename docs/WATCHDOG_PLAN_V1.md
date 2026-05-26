# FlowDesk P8 Background Watchdog Design — V1

**Date**: 2026-05-26  
**Status**: Implementation-ready  
**Gate**: Release 1 developer-mode (opt-in only, same Guard as P6/P7)

---

## 1. 목표

사용자가 메시지를 보내지 않아도 30초마다 자동으로 stall 감지 → abort → retry 실행.

---

## 2. 아키텍처 선택

### 채택: Option B — plugin 내부 setInterval

```
[OpenCode process]
  └─ flowdesk plugin (server.ts)
       └─ setInterval(30s) ─► runFlowDeskWatchdogCycleV1(input.client, ...)
                                    └─ P6: evaluateGuardedAutoAbortHookV1
                                    └─ P7: evaluateGuardedAutoRetryHookV1
```

- `input.client`를 클로저로 캡처 → session.create / promptAsync 직접 사용
- plugin 프로세스와 생명주기 공유 → OpenCode 종료 시 자동 정리

### Option A 전환 경로 (setInterval 불안정 시)

`runFlowDeskWatchdogCycleV1`은 **순수 async 함수**로 구현.  
`flowdesk_watchdog_trigger` MCP 툴이 이 함수를 1회 호출.  
외부 프로세스(`flowdesk-watchdog` CLI)가 30초마다 이 툴을 MCP로 호출.

```
[flowdesk-watchdog process]           [OpenCode process]
  while(true) {                         flowdesk_watchdog_trigger MCP tool
    sleep(30s)               ──MCP──►       └─ runFlowDeskWatchdogCycleV1()
  }
```

전환 방법: config에서 `watchdog.mcpTriggerEnabled: true` 추가, setInterval 비활성화.

---

## 3. 핵심 설계 원칙

- `runFlowDeskWatchdogCycleV1`은 setInterval / MCP tool / 테스트 모두에서 호출 가능
- P6/P7 로직 재사용 (`evaluateGuardedAutoAbortHookV1`, `evaluateGuardedAutoRetryHookV1`)
- Guard HMAC 검증은 각 사이클마다 재실행
- 동시 실행 방지: `isWatchdogCycleRunning` 플래그로 중복 실행 차단
- 에러 격리: 개별 lane 실패가 전체 사이클을 막지 않음

---

## 4. Config

```jsonc
"watchdog": {
  "enabled": true,           // setInterval 활성화 여부
  "intervalMs": 30000,       // 폴링 주기 (최소 10s, 기본 30s)
  "stallThresholdMs": 300000, // stall 판정 기준 (기본 5분, P6와 독립)
  "mcpTriggerEnabled": false, // Option A: 외부 프로세스가 MCP로 트리거
  // P6/P7 설정은 chatMessageStallAlert.guardedAutoAbort에서 공유
}
```

`chatMessageStallAlert.guardedAutoAbort`의 Guard HMAC, autoAbortOnStall,
autoRetryAfterAbort 설정을 그대로 참조 — 중복 설정 없음.

---

## 5. runFlowDeskWatchdogCycleV1 실행 순서

```
1. Guard HMAC 검증 (verifyGuardSignOffHmacV1) → 실패 시 전체 스킵
2. isWatchdogCycleRunning 체크 → 이미 실행 중이면 스킵 (중복 방지)
3. isWatchdogCycleRunning = true
4. 모든 workflow evidence 로드 (reloadFlowDeskSessionEvidenceV1 * N)
5. lane stall projection 실행 (projectFlowDeskLaneStallV1)
6. stalled lane 목록 추출
7. 각 stalled lane에 대해 (에러 격리):
   a. evaluateGuardedAutoAbortHookV1 호출
   b. auto_abort_executed이면 evaluateGuardedAutoRetryHookV1 호출
8. isWatchdogCycleRunning = false
9. 사이클 결과 evidence 기록 (watchdog_cycle_log.v1) — 선택적
```

---

## 6. 신규 파일/변경 파일

| 파일 | 변경 내용 |
|------|----------|
| `packages/opencode-plugin/src/stall-recovery.ts` | `runFlowDeskWatchdogCycleV1` 추가 |
| `packages/opencode-plugin/src/server.ts` | watchdog setInterval 시작, `flowdesk_watchdog_trigger` 툴 등록 (mcpTriggerEnabled 시) |

---

## 7. 안전 제약

| 제약 | 방법 |
|------|------|
| 중복 실행 방지 | `isWatchdogCycleRunning` boolean flag |
| Guard 만료 시 자동 중단 | 각 사이클 시작 시 Guard re-verify |
| maxAutoRetries 초과 방지 | P7 로직이 이미 cap 강제 |
| 프로세스 종료 시 정리 | `process.on('exit', clearInterval)` |
| 에러 격리 | lane별 try/catch, 전체 사이클 계속 |
| 옵트인 필수 | `watchdog.enabled: true` + Guard HMAC 없으면 아무것도 안 함 |
