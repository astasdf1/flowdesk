# FlowDesk OpenCode Plugin — Design

**적용 범위**: FlowDesk OpenCode 플러그인 개발
**Safety Rules**: [OPENCODE_SAFETY_RULES.md](./OPENCODE_SAFETY_RULES.md)
**ADR**: [../adr/0001-opencode-plugin-first.md](../adr/0001-opencode-plugin-first.md)
**진행 상태**: [../PROGRESS_SNAPSHOT.md](../PROGRESS_SNAPSHOT.md)

---

## 현재 목표

FlowDesk는 OpenCode 플러그인으로 구현된 agent/model selection intelligence layer다.
Release 1은 일반 OpenCode 사용자를 위한 general-use MVP다.
자연어 채팅이 주 UX이며, 수락된 요청은 guarded command-backed workflow로 라우팅된다.
명령어는 설정/상태/복구/진단/폴백 컨트롤용이며, 일반 작업의 기본 방식이 아니다.

**핵심 원칙**: 광범위한 OMO 스타일 프롬프트/접두사 주입을 구현하지 않는다.
Release 1 채팅 라우팅은 보수적이고 투명한 의도 처리를 사용한다.
- 일반 채팅은 그대로 둔다.
- 가능성 있는 FlowDesk 관련 요청에는 가시적인 제안을 보여준다.
- 명시적/고신뢰도 FlowDesk 요청만 command-backed workflow로 라우팅한다.
- 실행 유사 채팅은 guarded dry-run 또는 fake-runtime 단계 전에 확인을 요구한다.

---

## Release 1 Scope

### 포함

1. Installer bootstrap 및 `/flowdesk-doctor`.
2. 위임된 계획 기록, guarded dry-run, fake-runtime 실행, lane 상태 요약, 복구 및 진단을 위한
   채팅 라우팅 command-backed flow.
   Release 1은 실제 dispatch gate가 해당 동작을 명시적으로 승격하지 않는 한
   실제 OpenCode subtask/model/provider lane launch를 수행하지 않는다.
3. Release 1 최소 명령어 surface:
   `/flowdesk-doctor`, `/flowdesk-plan`, `/flowdesk-run`, `/flowdesk-status`,
   `/flowdesk-resume`, `/flowdesk-retry`, `/flowdesk-abort`, `/flowdesk-usage`,
   `/flowdesk-export-debug`.
4. 안전한 폴백 동작을 유지하면서 관리된 자동화를 강제, 관찰 또는 끄는 hook harness 모드.
5. Redacted audit, lane 요약, debug export.
6. 지원되는 OpenCode 버전에 대한 Plugin/SDK 호환성 conformance 보고.
7. 비정상적인 사용 및 안전한 대안에 대한 사용자 매뉴얼 적용 범위.
8. Usage Availability Snapshot 표시 및 fail-closed 동작과 별도의
   Provider Health Snapshot 진단.

### 미포함 (나중 gate)

1. 실제 OpenCode dispatch.
2. 자동 provider/model fallback 또는 재선택.
3. 지원되지 않는 `noReply`, `cancel`, `stop` 필드를 통한 hard chat cancellation 권한.
4. Evaluation 기반 ranking.
5. Patent, legal, medical-device specialist workflow.
6. Optional MCP connector 실행.

---

## 아키텍처

### 패키지 구조

```
packages/
  core/                        ← 계약, 스키마, 핵심 비즈니스 로직 (154개 파일)
  opencode-plugin/             ← OpenCode 플러그인 런타임 (120개 파일)
    src/
      server.ts                ← 플러그인 메인, 모든 tool 등록 (~8000줄)
      agent-task-runner.ts     ← executeFlowDeskAgentTaskV1()
      managed-dispatch-adapter.ts
      model-selection-engine.ts
      provider-usage-live-tool.ts
      workflow-orchestrator.ts
      stall-recovery.ts        ← lane 종료/캡처 복구 로직
```

### Subtask 실행 흐름

```
flowdesk_agent_task_run
  → resolveOpenCodeRuntimeLaunchModelBindingV1()  — model 검증/선택
  → agentTaskLaunchPlan()                         — launch plan 생성
  → launchFlowDeskInjectedSdkRuntimeLaneFromPlanV1()
      → client.session.create({ model, parentID })
      → client.session.promptAsync()
  → extractAssistantTextFromResponse()            — polling
      → client.session.messages() (3초 timeout)
      → 침묵 10초마다 nudge (최대 2회)
```

### Model Selection 흐름

```
selectModelForTask(role, usageMap, context)
  → ROLE_TIER_MAP[role]    → 후보 모델 군 결정
  → provider usage cache   → exhausted/critical 제외
  → same-family fallback   → exact model id 반환
  → providerQualifiedModelId (예: "anthropic/claude-opus-4-7")
```

---

## 코드 변경 전 확인

변경 전에 작업이 속하는 release gate를 식별한다:

1. Release 1 general-use MVP
2. Managed dispatch beta
3. Operational intelligence
4. Specialist workflow

나중 gate 작업이라면 구현 전에 필요한 conformance 및 threat-model 조건을 확인한다.

구현 또는 계획 작업을 마치기 전에 `docs/PROGRESS_SNAPSHOT.md`를 업데이트하거나
업데이트가 필요 없는 이유를 명시한다.
