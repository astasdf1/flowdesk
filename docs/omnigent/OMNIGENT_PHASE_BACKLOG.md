# FlowDesk + Omnigent Phase Backlog

**상태**: active development backlog
**작성일**: 2026-06-26
**범위**: Phase 1b 후속, Phase 2, Phase 3, Phase 4를 순차 개발 가능한 todo로 확장한다.

이 문서는 실행 가능한 개발 backlog다. 각 항목은 구현 전에 상세 설계를 짧게 확정하고, 구현 후 테스트/문서/진행 스냅샷을 갱신한다.

---

## 공통 진행 규칙

- [ ] 각 phase 시작 전에 현재 authority boundary를 다시 확인한다.
- [ ] `docs/PROGRESS_SNAPSHOT.md`를 phase별 구현/검증 결과로 갱신한다.
- [ ] credential/token 원문, provider payload, raw transcript 전문을 새 evidence에 저장하지 않는다.
- [ ] Omnigent dispatch, fallback, retry, provider switch 권한은 명시적 phase gate 전까지 만들지 않는다.
- [ ] 테스트는 최소 unit tests + smoke/replay 가능 evidence 중 하나를 포함한다.
- [ ] 기존 OpenCode Release 1 권한을 바꾸는 변경은 별도 ADR 없이 하지 않는다.

---

## Phase 1b Tail: Transcript Adapter

목표: 이미 구현된 pure verifier가 실제 Omnigent transcript/tool-call history에서 파생된 normalized events를 검증할 수 있게 한다.

### 상세 설계 Todo

- [x] Omnigent transcript/tool-call history 저장 위치와 event shape를 실제 repo/run artifact 기준으로 확인한다.
- [x] adapter 입력을 정한다: file path, JSON object, 또는 already-loaded Python object 중 최소 경로를 선택한다.
- [x] normalized event schema를 고정한다: `type`, `task_id`, `agent`, `model`, `selection_status`, `selection_id`, `source_ref`.
- [x] `model=null` semantics를 명시한다: selected model이 `null`이면 dispatch args에서 model override가 없어야 한다.
- [x] stale/duplicate selection 처리 정책을 정한다: 우선 duplicate selection은 fail-closed, expiry는 selection payload에 있을 때만 검사한다.
- [x] adapter는 redaction-safe refs만 출력하고 raw prompts/transcripts를 반환하지 않게 한다.

### 구현 Todo

- [x] `flowdesk_omnigent.trace_adapter` module을 추가한다.
- [x] `normalize_omnigent_trace_events(...)` pure function을 작성한다.
- [x] selector tool output에서 selection event를 추출한다.
- [x] `sys_session_send` tool args에서 dispatch event를 추출한다.
- [x] extraction 실패/unknown tool event는 warning으로 보존하되 verifier 실패와 분리한다.
- [x] package README에 adapter 사용 예를 추가한다.

### 검증 Todo

- [x] positive fixture: selection 3개 + matching dispatch 3개.
- [x] negative fixture: selection 없는 dispatch.
- [x] negative fixture: `blocked`/`non_dispatchable` 뒤 dispatch.
- [x] negative fixture: Codex `model=null` selection 뒤 explicit model override.
- [x] unit suite 재실행: `PYTHONPATH=packages/omnigent-tool/src ... unittest discover`.
- [ ] 가능하면 live smoke transcript 일부를 redacted/minimized fixture로 재현한다.

현재 구현 상태: `flowdesk_omnigent.trace_adapter.normalize_omnigent_trace_events`가 Omnigent `function_call` / `function_call_output` item shape와 generic `tool_calls` shape를 받아 redaction-safe normalized events를 생성한다. Verification-only adapter이며 dispatch deny authority를 만들지 않는다.

---

## Phase 2: TypeScript Selection CLI Bridge

목표: Python static registry에서 기존 FlowDesk TypeScript selection/usage 자산을 재사용하는 CLI bridge로 확장한다. 이 phase도 selection-only이며 runtime dispatch 권한을 만들지 않는다.

### 상세 설계 Todo

- [x] CLI package 위치 확정: 우선 `packages/core` 또는 별도 shared package 중 하나를 선택한다.
- [x] CLI command contract 작성: stdin JSON request, stdout JSON response, stderr redacted diagnostics.
- [x] Python wrapper timeout 정책을 정한다: 기본 timeout, failure response, retry 없음.
- [x] subprocess env allowlist를 정의한다: credential/token 관련 env 제거가 기본이다.
- [x] TypeScript selection result와 Python `flowdesk.omnigent_selection.v1` response mapping을 문서화한다.
- [x] usage/provider health가 unavailable일 때 selection을 block할지 advisory note로 둘지 결정한다.
- [x] Codex subscription `model=null` policy를 TS engine에서도 보존하는 mapping을 정한다.

### 구현 Todo

- [x] TypeScript CLI entrypoint를 추가한다.
- [x] request parser와 schema validation을 추가한다.
- [x] 기존 model-selection/task-model-selection logic 중 재사용 가능한 최소 path를 연결한다.
- [x] `authority="advisory_selection_only"`를 CLI response에서 강제한다.
- [x] credential/token/env stripping helper를 Python wrapper에 추가한다.
- [x] Python selector에 `engine="static|ts_cli"` 또는 config 기반 bridge path를 추가한다.
- [x] CLI failure 시 Python wrapper가 fail-closed `blocked` 또는 static fallback 없이 명확한 error response를 반환하게 한다.

### 검증 Todo

- [x] TS unit tests: valid request, invalid request, provider disallowed, model family mismatch.
- [x] Python wrapper tests: timeout, malformed stdout, stderr redaction, env stripping.
- [x] Cross-language golden fixture tests: 같은 request가 expected response shape를 유지한다. (`packages/omnigent-tool/tests/fixtures/omnigent_selection_parity_cases.json` 14개 케이스를 Python `test_selection_parity_golden_cases`와 TS `omnigent selection matches Python/TypeScript parity golden cases`가 동일 필드로 검증.)
- [x] 기존 Python selector tests와 trace verifier tests를 유지한다.
- [x] Omnigent example smoke를 `static` mode와 `ts_cli` mode 중 최소 하나로 재실행한다.

### 완료 기준

- [x] CLI bridge가 static registry와 동일하거나 더 보수적인 selected/blocked 결과를 낸다.
- [x] raw credential/token env가 subprocess에 전달되지 않음을 테스트로 증명한다.
- [x] 실패 시 자동 fallback/retry/provider switch 없이 fail-closed로 끝난다.

현재 구현 상태: `packages/core/src/omnigent-selection.ts`와 `packages/core/src/omnigent-selection-cli.ts`가 추가되었고, Python selector는 명시적 `engine="ts_cli"`에서만 Node CLI를 호출한다. CLI failure는 static fallback 없이 `blocked`로 끝난다.

**Registry SSOT (2026-07-02 확인)**: `omnigent_selector_registry.v1.json`이 단일 소스다. Python 런타임 레지스트리는 이 JSON을 직접 로드하고(`_load_selector_registry_artifact`), TS는 하드코딩 복사본(`FLOWDESK_OMNIGENT_DEFAULT_REGISTRY_V1`)을 유지하되 양쪽 테스트가 각자의 레지스트리를 JSON 아티팩트와 `deepEqual`/normalized-equal로 검증한다(`test_python_registry_matches_shared_registry_artifact`, `omnigent TypeScript registry matches shared registry artifact`). 따라서 TS ≡ JSON ≡ Python이 테스트로 강제되며 drift는 CI 실패가 된다. TS가 런타임에 JSON을 직접 읽지 않는 이유는 `@flowdesk/core`가 `packages/omnigent-tool`에 의존하지 않아야 하는 ADR 0002 패키징 경계 때문이다(런타임 cross-package 파일 읽기 회피). 검증: Python 92 tests OK, TS omnigent 25 tests OK.

---

## Phase 3: Evidence and Audit Alignment

목표: Omnigent selection/trace evidence를 FlowDesk core schema와 맞추고, debug/export/conformance에서 재사용할 수 있게 한다.

### 상세 설계 Todo

- [x] `flowdesk.omnigent_selection.v1` JSON schema 위치를 확정한다.
- [x] `flowdesk.omnigent_trace_verification.v1` JSON schema 위치를 확정한다.
- [x] OpenCode `flowdesk.task_model_selection.v1`과 공통 authority fields를 비교한다.
- [x] evidence 저장 원칙을 정한다: transcript/history가 source of truth, optional debug export는 derived evidence.
- [x] redaction policy를 schema field별로 정의한다.
- [ ] conformance 문서에 Omnigent experimental track을 어떻게 표시할지 결정한다.

### 구현 Todo

- [x] core schema/type definitions를 추가한다.
- [ ] Python response shape와 core schema 사이 golden examples를 추가한다.
- [x] trace verifier result를 schema-validating fixture로 고정한다.
- [ ] optional debug export writer를 schema-aligned derived evidence로 제한한다.
- [x] docs에 evidence source-of-truth와 derived debug artifact 차이를 명시한다.

### 검증 Todo

- [x] schema validation tests.
- [x] redaction tests: raw prompt, token-shaped string, credential path가 derived evidence에 포함되지 않음.
- [x] OpenCode schema와 authority naming drift check.
- [ ] Omnigent selection smoke artifact를 최소 redacted fixture로 검증한다.

### 완료 기준

- [x] Omnigent selection/trace outputs가 documented schema와 일치한다.
- [x] OpenCode Release 1 evidence/authority와 이름 충돌이 없다.
- [ ] debug/export artifact는 source-of-truth가 아니라 derived evidence로만 문서화된다.

현재 구현 상태: core에 `FlowDeskOmnigentSelectionV1` / `FlowDeskOmnigentTraceVerificationV1` 타입과 validators가 있고, `schema-registry.ts` / `schema-artifacts.ts`에 later-release artifact로 등록되었다.

---

## Phase 4: Optional MCP 또는 Upstream Hook

목표: local function tool 한계를 확인한 뒤, 반복 사용 가치가 있을 때만 MCP server 또는 Omnigent upstream hook로 승격한다.

### Gate Todo

- [ ] Phase 1b transcript adapter가 안정적으로 real trace를 검증한다.
- [ ] Phase 2 CLI bridge 또는 static selector가 최소 2회 이상 smoke에서 안정 동작한다.
- [ ] Phase 3 schema/evidence alignment가 완료된다.
- [ ] local function tool의 한계가 명확히 기록된다: lifecycle, guardrail, distribution, shared service 중 무엇이 문제인지.
- [ ] 사용자/프로젝트가 MCP 또는 upstream hook의 운영 복잡도를 감수할 가치가 있다고 판단한다.

### 상세 설계 Todo

- [x] MCP server와 Omnigent upstream hook 중 하나를 먼저 선택한다.
- [x] MCP 선택 시 server lifecycle, local socket/port, auth boundary, crash behavior를 설계한다.
- [ ] Upstream hook 선택 시 Omnigent core 변경 범위, pre-dispatch guard 위치, maintainability를 설계한다.
- [x] selection-only authority와 dispatch-deny authority를 분리해서 설계한다.
- [x] fallback/retry/provider switch는 계속 별도 authority gate로 둔다.

### 구현 Todo: MCP 경로

- [x] minimal MCP tool `flowdesk_select_agent_model` 구현.
- [x] Python/TS CLI bridge 중 하나를 backend로 연결한다.
- [x] startup/readiness/health check를 추가한다.
- [x] Omnigent MCP tool config fixture를 추가한다.

### 구현 Todo: Upstream Hook 경로

- [ ] Omnigent `sys_session_send` 직전 hook point를 제안/패치한다.
- [ ] selected evidence와 dispatch args 대조를 pre-dispatch로 옮긴다.
- [ ] blocked/non-dispatchable dispatch를 mechanical deny로 처리한다.
- [ ] hook failure mode를 fail-closed 또는 advisory-only 중 명시적으로 선택한다.

### 검증 Todo

- [x] MCP 또는 hook path unit/integration tests.
- [x] selection mismatch negative smoke.
- [ ] blocked/non-dispatchable mechanical deny smoke, 단 mechanical authority를 도입한 경우에만.
- [ ] latency/operational overhead check.

### 완료 기준

- [x] local function tool보다 나은 명확한 가치가 증명된다.
- [x] 권한 경계가 문서와 테스트에서 일치한다.
- [x] 운영/설치 복잡도가 사용자에게 설명 가능한 수준이다.

현재 구현 상태: `flowdesk_omnigent.mcp_server`와 `flowdesk-omnigent-mcp` console script가 추가되었다. stdio JSON-RPC로 `initialize`, `tools/list`, `tools/call`을 지원하며, selection-only MCP path다. `examples/omnigent-flowdesk-mcp/` fixture와 live MCP selection smoke가 통과했다. Mechanical dispatch deny는 여전히 후속 upstream/pre-dispatch guard work다.

---

## Phase 4b: Minimal Pre-Dispatch Binding Guard

목표: Omnigent core patch 없이 function policy hook으로 FlowDesk-known sub-agent/model binding mismatch를 mechanical DENY한다.

### 상세 설계 Todo

- [x] Omnigent `tool_call` policy event shape 확인.
- [x] `sys_session_send` schema가 arbitrary `args.flowdesk_selection` payload를 허용하지 않음을 확인.
- [x] 최소 guard 범위를 registry-compatible dispatch binding으로 제한한다.
- [x] 한계를 문서화한다: 실제 selector tool 호출 여부 증명은 하지 않고, dispatch args가 FlowDesk binding과 호환되는지만 검사한다.

### 구현 Todo

- [x] `flowdesk_omnigent.policies.omnigent_selection_dispatch_guard` direct policy callable 추가.
- [x] `flowdesk_omnigent.policies.make_omnigent_selection_dispatch_guard` factory helper 추가.
- [x] `examples/omnigent-flowdesk/`에 guardrail policy 연결.
- [x] `examples/omnigent-flowdesk-mcp/`에 guardrail policy 연결.

### 검증 Todo

- [x] Unit tests: allowed Claude policy/security binding.
- [x] Unit tests: denied wrong Claude model.
- [x] Unit tests: denied Codex default agent with explicit model override.
- [x] Unit tests: allowed Codex default agent without model override.
- [x] Fixture parser check: both examples load `flowdesk_selection_dispatch_guard`.
- [x] Negative live smoke: architecture-agent with explicit `openai/gpt-5.5` override is denied and orchestrator returns `FLOWDESK_DISPATCH_GUARD_NEGATIVE_20260627_OK`.
- [x] Positive live smoke: architecture-agent without model override dispatches and returns `FLOWDESK_DISPATCH_GUARD_POSITIVE_20260627_OK`.

### 현재 한계

- [x] Selector call provenance proof: policy records FlowDesk selector calls in Omnigent session state and requires a matching record before guarded dispatch.
- [x] Dynamic binding guard: policy records selector output when available, falls back to selector-call recomputation, and dispatch must match recorded task/agent/harness/model binding.
- [x] Selection expiry/title collision checks: expired records and mismatched task/title dispatches are denied by the guard.
- [x] Dynamic quota/usage-aware binding: selector accepts provider usage/health snapshots and skips exhausted, critical, stale, blocked, unavailable, or non-dispatchable providers when alternatives exist.
- [ ] Upstream pre-dispatch evidence hook: not implemented; reviewed in `OMNIGENT_UPSTREAM_HOOK_REVIEW.md` and deferred.
