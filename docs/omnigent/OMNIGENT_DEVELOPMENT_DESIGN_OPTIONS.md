# FlowDesk + Omnigent 개발 설계안

**상태**: Phase 1 live smoke 통과 / Phase 1b pure trace verifier 구현
**작성일**: 2026-06-26
**ADR**: [ADR 0002](../adr/0002-omnigent-selection-integration.md)
**관련 문서**: [OMNIGENT_DESIGN.md](./OMNIGENT_DESIGN.md), [OMNIGENT_BASE_INFO.md](./OMNIGENT_BASE_INFO.md), [OMNIGENT_SAFETY_RULES.md](./OMNIGENT_SAFETY_RULES.md), [OMNIGENT_PHASE_BACKLOG.md](./OMNIGENT_PHASE_BACKLOG.md)

---

## 목표

FlowDesk를 Omnigent의 orchestration loop에 붙는 **agent/model selection intelligence layer**로 구현한다.

Omnigent는 workflow 생성, subtask 분할, 병렬 실행, context 관리, 결과 수집, synthesis를 담당한다. FlowDesk는 각 subtask에 대해 실행 가능한 `{agent, harness, model}` 선택 결과와 선택 근거만 반환한다.

---

## 현재 확인된 사실

| 항목 | 상태 |
|---|---|
| Omnigent 로컬 설치 | 완료 (`omnigent 0.3.0.dev0`) |
| Claude 구독 harness | `claude-sdk` headless 동작 확인 |
| GPT 구독 harness | `codex` headless 동작 확인 |
| Claude + GPT 병렬 fan-out | `examples/debby/`로 확인 |
| Gemini OAuth harness | `antigravity-native`만 구독 OAuth 가능, TUI/token-refresh 제약 존재 |
| Gemini headless harness | `antigravity`는 API key/Vertex 중심, 구독 OAuth 목적에는 부적합 |
| Omnigent 실행 모델 | LLM이 여러 `sys_session_send`를 emit하면 runner가 `asyncio.gather()`로 병렬 실행 |
| FlowDesk 기존 자산 | TypeScript 모델 선택 엔진, provider usage live collector, task model selection evidence schema |

---

## 공통 설계 원칙

1. FlowDesk는 `sys_session_send`, `sys_session_create`, `sys_read_inbox`를 직접 호출하지 않는다.
2. FlowDesk는 Omnigent core를 수정하지 않는 경로를 우선한다.
3. FlowDesk 선택 결과는 실행 권한이 아니라 권고다.
4. 구독 credential, token, keychain, `auth.json`, `oauth_creds.json` 원문을 FlowDesk 선택 로직에서 직접 읽지 않는다.
5. Gemini OAuth는 MVP 차단 요소로 두지 않는다. Claude + GPT 구독 경로를 먼저 완성한다.
6. 모델 fallback은 selection phase 안에서만 기록한다. runtime retry, provider switch, automatic fallback 권한으로 해석하지 않는다.
7. 처음부터 복잡한 score engine을 만들지 않는다. role/harness/model registry와 fail-closed compatibility check를 먼저 구현한다.
8. Phase 1 selection은 advisory-only다. `selected` 결과가 실제 dispatch gate로 작동한다고 주장하려면 별도 mechanical guard와 trace 검증이 필요하다.
9. Orchestrator-visible `reason_codes`는 enum allowlist만 사용한다. 사용자 입력이나 task description을 그대로 반사하지 않는다.

---

## 설계안 A: Omnigent Local Function Tool MVP

### 요약

FlowDesk Python package를 Omnigent venv에 editable로 설치하고, Omnigent YAML에서 `type: function` tool로 `flowdesk.omnigent.select_agent_model`을 등록한다.

```
Omnigent orchestrator
  -> flowdesk_select_agent_model(task_role, task_description, constraints)
  <- {agent, harness, model, confidence, reason_codes, blocked_labels, authority}
  -> sys_session_send(agent=..., args={model: ..., harness: ...})
```

### 구현 요소

| 요소 | 내용 |
|---|---|
| 새 Python module | `packages/omnigent-tool/flowdesk_omnigent/selection.py` |
| Tool function | `select_agent_model(request: dict) -> dict` |
| Config fixture | `examples/omnigent-flowdesk/config.yaml` |
| Registry | static role → agent/harness/model map |
| Validation | allowed agent, harness, provider family, model prefix, blocked Gemini OAuth 상태 |
| Evidence | Omnigent transcript/tool-call history를 1차 증거로 사용, normalized trace verifier 구현 |

### Request shape

```json
{
  "task_id": "task-opaque-label",
  "task_role": "policy_security|architecture|implementation|verification|research|general|gemini_experimental",
  "task_description": "bounded redacted summary",
  "preferred_provider_family": "claude|openai|gemini|null",
  "allowed_provider_families": ["claude", "openai"],
  "risk_level": "low|medium|high",
  "requires_headless": true
}
```

### Response shape

```json
{
  "schema_version": "flowdesk.omnigent_selection.v1",
  "selection_status": "selected|blocked|non_dispatchable",
  "agent": "policy-security-agent",
  "harness": "claude-sdk",
  "model": "claude-opus-4-8",
  "provider_family": "claude",
  "confidence": "high|medium|low",
  "reason_codes": ["role_policy_security_prefers_deep_reasoning", "headless_subscription_verified"],
  "blocked_labels": [],
  "authority": "advisory_selection_only",
  "expires_at": "2026-06-26T00:00:00Z"
}
```

### Canonical role enum

| Role | Meaning |
|---|---|
| `policy_security` | 보안, 정책, credential, authority boundary 검토 |
| `architecture` | 모듈 경계, API, workflow shape, migration 설계 |
| `implementation` | backend/CLI/service 구현 또는 patch 계획 |
| `verification` | 테스트, smoke, reproduction, validation 계획 |
| `research` | repo 탐색, platform 조사, 문서 근거 수집 |
| `general` | 위 역할로 분류되지 않는 일반 작업 |
| `gemini_experimental` | Gemini OAuth/TUI 실험 전용. MVP default에서는 `non_dispatchable` |

### Reason code policy

`reason_codes`는 고정 enum이다. 사용자 입력, raw task text, provider payload, credential path, token-shaped string을 넣지 않는다.

Initial enum:

- `role_policy_security_prefers_deep_reasoning`
- `role_architecture_prefers_frontier_reasoning`
- `role_implementation_prefers_coding_harness`
- `role_verification_prefers_cost_controlled_model`
- `headless_subscription_verified`
- `quota_unknown_used_as_non_blocking_mvp_default`
- `subscription_harness_default_model`
- `gemini_oauth_refresh_unstable`
- `model_family_compatible`
- `model_family_mismatch_blocked`
- `provider_not_allowed`
- `unknown_role_blocked`

### 장점

- 가장 빠르게 목표 구조를 검증한다.
- Omnigent core 변경이 없다.
- Claude + GPT 구독 경로만으로도 실제 병렬 subtask 실행을 증명할 수 있다.
- 기존 Omnigent examples의 `type: function` 패턴과 맞다.

### 단점

- TypeScript에 있는 기존 FlowDesk selection engine을 바로 재사용하기 어렵다.
- quota/usage live collector를 Python에서 다시 구현하거나 별도 경로로 호출해야 한다.
- evidence/audit 체계는 OpenCode 플러그인과 분리된다.
- Phase 1 자체는 advisory-only이며 dispatch safety boundary가 아니다.

### 적합도

MVP와 첫 통합 검증에 가장 적합하다.

### Phase 1 evidence

Phase 1은 별도 FlowDesk JSONL 파일을 만들지 않는다. Source of truth는 Omnigent run transcript/tool-call history다.

The transcript must show, for each selected task:

- `flowdesk_select_agent_model` tool call.
- Selection result with `selection_id`, `task_id`, `task_role`, `selection_status`, `agent`, `harness`, `model`, and `authority`.
- Subsequent `sys_session_send` using the selected agent and matching model behavior (`model=null` means omit override).
- `sys_read_inbox` result collection.

Optional local debug JSONL is allowed only when explicitly enabled by a caller for local troubleshooting. It is not the normative evidence path and must not be required for smoke acceptance.

---

## 설계안 B: FlowDesk Selection CLI Bridge

### 요약

Omnigent tool은 Python wrapper지만 실제 선택은 FlowDesk Node/TypeScript CLI를 subprocess로 호출한다. 기존 TypeScript `model-selection-engine.ts`와 provider usage logic을 최대한 재사용한다. 이 설계는 Phase 1 이후에만 고려한다.

```
Omnigent function tool (Python)
  -> node packages/core/dist/omnigent-selection-cli.js --request-json ...
  <- selection JSON
```

### 구현 요소

| 요소 | 내용 |
|---|---|
| Node CLI | `packages/core/src/omnigent-selection-cli.ts` 또는 별도 shared package |
| Python wrapper | subprocess 호출, timeout, JSON validation |
| Shared types | `flowdesk.omnigent_selection.v1` schema를 TS/Python 양쪽에 문서화 |
| Usage path | 기존 cached/live usage helper를 CLI에서 read-only 사용 |
| Isolation | absolute binary path, stripped env, timeout, killed child process, stdout/stderr redaction |

### 장점

- 기존 TypeScript selection engine 재사용이 쉽다.
- OpenCode와 Omnigent의 모델 선택 정책 drift를 줄인다.
- provider usage cache/readiness code를 활용할 수 있다.

### 단점

- Omnigent Python runtime에서 Node build artifact가 필요하다.
- subprocess timeout, PATH, package build 상태 문제가 생긴다.
- OpenCode 플러그인 코드와 Omnigent integration 경계가 흐려질 수 있다.
- subprocess가 credential-related environment를 상속하면 Safety Rule 5를 위반할 수 있다.

### 적합도

MVP 다음 단계에 적합하다. 첫 MVP에서 Python static registry가 검증되고, subprocess credential isolation contract가 문서화된 뒤에만 도입한다. CLI 코드는 `packages/opencode-plugin`이 아니라 `packages/core` 또는 별도 shared package에 둔다.

---

## 설계안 C: FlowDesk MCP Selection Server

### 요약

FlowDesk를 MCP server로 띄우고 Omnigent가 MCP tool로 `flowdesk_select_agent_model`을 호출한다.

### 장점

- OpenCode, Omnigent, 다른 orchestrator가 같은 FlowDesk selection service를 공유할 수 있다.
- 장기적으로 provider usage, model registry, OI advisory, evidence export를 한 곳에 모을 수 있다.

### 단점

- 설치/운영 복잡도가 증가한다.
- server lifecycle, port/socket, auth boundary, failure mode 설계가 필요하다.
- 현재 목표인 빠른 Omnigent 검증에는 과하다.

### 적합도

장기 확장안이다. 지금은 MVP 경로로 선택하지 않는다.

---

## 설계안 D: Omnigent Core Integration PR

### 요약

Omnigent core에 FlowDesk selection hook point나 first-class selector contract를 추가한다.

### 장점

- agent/model selection이 Omnigent 내부 lifecycle과 강하게 결합된다.
- `sys_session_send` 직전 validation, selection evidence, model override handling을 더 정교하게 제어할 수 있다.

### 단점

- upstream 설계 합의가 필요하다.
- FlowDesk가 Omnigent core를 수정하지 않는다는 현재 원칙과 충돌한다.
- 빠른 실험 속도가 떨어진다.

### 적합도

MVP 후 실제 hook point 부족이 확인될 때만 고려한다.

---

## 설계안 E: OpenCode FlowDesk Bridge 유지

### 요약

Omnigent 통합을 보류하고 OpenCode 플러그인 내 실제 dispatch/model-selection path를 계속 강화한다.

### 장점

- 기존 FlowDesk 코드/테스트/evidence를 그대로 사용한다.
- OpenCode 사용자에게 바로 이어지는 경로다.

### 단점

- 현재 목표인 external orchestrator 기반 병렬 subtask 구조와 거리가 있다.
- OpenCode runtime lane 안정성, wake/capture, child tool boundary 등 이미 많은 복잡도가 존재한다.
- Omnigent가 이미 제공하는 병렬 fan-out과 inbox collection을 다시 구축하게 된다.

### 적합도

OpenCode 제품 경로로는 계속 유지하지만, 이번 목표 달성의 주 경로는 아니다.

---

## 추천 경로

### Phase 0: Gemini 보류와 Claude/GPT 기준선 고정

- `antigravity-native`는 OAuth token refresh/TUI 제약 때문에 MVP 필수 경로에서 제외한다.
- MVP 기본 provider는 `claude-sdk`와 `codex`다.
- Gemini는 `gemini_status=deferred_due_to_native_oauth_refresh`로 명시한다.
- `gemini_experimental` 요청은 기본적으로 `non_dispatchable`과 `blocked_labels=["gemini_oauth_refresh_unstable"]`를 반환한다.

### Phase 1: Local Function Tool MVP

1. `flowdesk_omnigent.selection.select_agent_model` Python function 작성. 완료: `packages/omnigent-tool`.
2. `flowdesk.omnigent_selection.v1` request/response schema와 canonical role enum 고정. 완료.
3. static registry로 role별 agent/harness/model 선택. 완료.
4. Omnigent transcript/tool-call history를 selection evidence source로 사용. 완료.
5. `examples/omnigent-flowdesk/`에 orchestrator + `policy_security`, `architecture`, `implementation`, `verification` agent spec 작성. 완료.
6. pure unit tests로 invalid role, disallowed provider, model-family mismatch, malformed request, Gemini non-dispatchable을 검증. 완료.
7. Claude/GPT 2-provider 병렬 fan-out으로 selection call → `sys_session_send` → inbox synthesis 검증. 완료: `FLOWDESK_SELECTION_SMOKE_20260626_RETRY`.
8. 실패 시 `blocked` 또는 `non_dispatchable` response를 반환하고 orchestrator가 해당 task를 실행하지 않도록 prompt에 명시. fixture에 반영.

Phase 1은 advisory-only다. Selection result가 실제 dispatch gate로 집행됐다고 주장하지 않는다.

Live smoke note (2026-06-26): first pass with stale model ids proved the selector tool registered but selected unavailable overrides (`anthropic/claude-opus-4-7`, `openai/gpt-*` for Codex subscription). The registry was corrected to `claude-opus-4-8` for Claude and `model=null` for Codex subscription harness defaults. The retry smoke passed first-pass selection and dispatch for `policy_security`, `architecture`, and `verification`. Separate JSONL evidence was deliberately demoted: the Omnigent transcript/tool-call history is the source of truth for Phase 1, and Phase 1b should verify consistency from that history or from a guardrail context rather than from a second sidecar log.

### Phase 1b: Selection Consistency Guard

1. Pure trace verifier 구현 완료: `flowdesk_omnigent.trace_verifier.verify_selection_dispatch_trace`는 normalized `selection`/`dispatch` events를 받아 dispatch가 prior `selected` evidence와 일치하는지 검증한다.
2. 검증 규칙 구현 완료: prior selection 없음, agent mismatch, model mismatch, `model=null` selection 뒤 model override 사용, `blocked`/`non_dispatchable` dispatch를 `fail`로 분류한다.
3. Unit tests 구현 완료: positive/negative trace cases 포함, 전체 `packages/omnigent-tool` suite 16 tests 통과.
4. 후속: Omnigent transcript/tool-call history에서 normalized events를 추출하는 adapter를 작성한다.
5. 후속: Omnigent guardrail policy 또는 mechanical pre-dispatch guard가 필요하면 별도 설계한다. 현재 verifier는 post-run verification-only다.
6. 이 verifier만으로는 FlowDesk selection을 dispatch safety boundary로 설명하지 않는다.

### Phase 2: TS Selection CLI Bridge

상세 개발 todo는 [OMNIGENT_PHASE_BACKLOG.md](./OMNIGENT_PHASE_BACKLOG.md)의 Phase 2 섹션을 기준으로 순차 진행한다.

1. 기존 TypeScript model-selection engine을 `packages/core` 또는 별도 shared package의 CLI로 감싼다.
2. Python function tool은 CLI JSON adapter가 된다.
3. subprocess 실행 전 `ANTHROPIC_API_KEY`, `OPENAI_API_KEY`, `GEMINI_API_KEY`, token-shaped env, credential override env를 제거한다.
4. usage snapshot, provider health, available model cache를 read-only로 연결한다.
5. selection result에 attempted model ids와 usage note를 추가한다.

### Phase 3: Evidence and Audit Alignment

상세 개발 todo는 [OMNIGENT_PHASE_BACKLOG.md](./OMNIGENT_PHASE_BACKLOG.md)의 Phase 3 섹션을 기준으로 순차 진행한다.

1. `flowdesk.omnigent_selection.v1` JSON schema를 `packages/core`에 추가한다.
2. OpenCode `flowdesk.task_model_selection.v1`과 authority fields를 맞춘다.
3. Omnigent transcript/tool-call history를 normalized trace events로 해석하는 adapter를 설계한다. Pure verifier는 Phase 1b에서 구현 완료.
4. debug export나 conformance 문서로 연결할지는 별도 결정한다.

### Phase 4: Optional MCP 또는 Upstream Hook

상세 개발 todo와 gate 조건은 [OMNIGENT_PHASE_BACKLOG.md](./OMNIGENT_PHASE_BACKLOG.md)의 Phase 4 섹션을 기준으로 한다.

MVP가 반복 사용될 만큼 안정화된 뒤에만 MCP server나 Omnigent core PR을 검토한다.

---

## Role Registry 초안

| Role | Primary | Secondary | Notes |
|---|---|---|---|
| `policy_security` | `claude-sdk` + `claude-opus-4-8` | `codex` + harness default | 보안/정책은 깊은 추론 우선 |
| `architecture` | `codex` + harness default | `claude-sdk` + `claude-sonnet-4-6` | 구조/계약/API 검토 |
| `implementation` | `codex` + harness default | `claude-sdk` + `claude-sonnet-4-6` | 코드 작성/패치 계획 |
| `verification` | `codex` + harness default | `claude-sdk` + `claude-haiku-4-5` | 테스트/재현/검증 비용 절감 |
| `research` | `claude-sdk` + `claude-sonnet-4-6` | `codex` + harness default | repo 탐색/문서 조사 |
| `gemini_experimental` | none | none | OAuth refresh 안정화 전까지 `non_dispatchable` |

---

## MVP Acceptance Criteria

1. Omnigent orchestrator가 최소 3개 subtask를 만들고 각 subtask 전에 FlowDesk selection tool을 호출한다.
2. Phase 1에서는 trace가 `selected` task만 `sys_session_send`로 실행됐음을 보여준다. 이것은 advisory trace evidence이며 safety boundary claim이 아니다.
3. Phase 1b verifier 이후에는 blocked/non-dispatchable dispatch 시도가 failed trace verification으로 잡힌다. Mechanical deny는 별도 guardrail work가 필요하다.
4. Claude와 GPT child sessions가 같은 turn에서 병렬 launch된다.
5. Orchestrator가 `sys_read_inbox`로 결과를 모아 synthesis한다.
6. Gemini가 없어도 전체 workflow가 degraded mode로 완료된다.
7. FlowDesk 선택 tool은 credential/token 원문을 읽거나 출력하지 않는다.
8. FlowDesk 선택 tool은 Omnigent orchestration tool을 직접 호출하지 않는다.
9. 잘못된 role, disallowed provider, model-family mismatch는 fail-closed `blocked` 또는 `non_dispatchable`로 끝난다.
10. 최소 하나의 deterministic smoke trace가 남아 재현 가능하다.

---

## 주요 리스크

| 리스크 | 영향 | 완화 |
|---|---|---|
| Orchestrator가 selection 결과를 무시하고 임의 agent/model 실행 | FlowDesk가 실제 선택 레이어가 아니게 됨 | Phase 1은 advisory-only로 표시, Phase 1b pure trace verifier로 post-run 불일치 검출. Mechanical guard는 후속 |
| Python static registry와 TS selection engine 정책 drift | 장기 유지보수 비용 증가 | Phase 2에서 TS CLI bridge로 흡수 |
| Gemini OAuth refresh가 계속 interactive | 3-provider 목표 지연 | Gemini를 MVP default에서 제외하고 experimental role로 격리 |
| `args.model`이 기존 child session 재사용 시 적용되지 않음 | 잘못된 model binding 가능 | child title에 selection id/task id 포함, 재사용 방지, trace에서 effective binding 확인 |
| quota 정보가 부정확하거나 stale | 부적절한 provider 선택 | MVP는 quota advisory 없이 시작, stale이면 tie-breaker로만 사용 |
| Omnigent YAML/function schema가 예상과 다름 | tool registration 실패 | examples 기반 최소 fixture부터 실행 |

---

## 리뷰 질문

1. Local Function Tool MVP가 advisory-only 첫 검증으로 충분히 작고 검증 가능한가?
2. Python static registry로 시작하는 것이 정책 drift를 감수할 만큼 빠른가?
3. Phase 1b selection consistency를 post-run trace verifier 다음에 Omnigent guardrail로 승격할 필요가 있는가?
4. Gemini를 MVP에서 제외하는 판단이 제품 목표를 훼손하지 않는가?
5. Phase 2 CLI bridge가 OpenCode 플러그인 코드와 Omnigent integration 경계를 지나치게 결합하지 않도록 `packages/core` 경계가 충분한가?
6. Omnigent transcript/history adapter가 selection-result와 dispatch args를 충분히 안정적으로 normalized events로 추출할 수 있는가?
