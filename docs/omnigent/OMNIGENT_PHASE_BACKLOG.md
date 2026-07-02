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

## Phase 3: Evidence and Audit Alignment (내부 정합성 / engineering hygiene)

> 성격 명시 (2026-07-02 리뷰 반영): 이 phase의 잔여 항목은 schema/evidence 내부 정합성 작업이며, 설치자가 체감하는 선택 품질·quota 절약 가치와 직접 연결되지 않는다. 사용자 가치 증분은 아래 "다관점 비판 리뷰 반영" 섹션의 P0/P2 항목이 우선한다.

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

- [x] Selector provenance record (recomputation 기반 self-attestation): policy는 selector tool_call args를 재계산해 record를 만들고 guarded dispatch가 그 record와 일치할 것을 요구한다. 이는 "selector가 실제 호출되었음"의 증명이 아니라 "dispatch args와 호환되는 selection이 재구성 가능함"의 확인이다. 실제 call-attestation은 upstream pre-dispatch hook의 성공 조건으로 이관한다.
- [x] Dynamic binding guard: policy records selector output when available, falls back to selector-call recomputation, and dispatch must match recorded task/agent/harness/model binding.
- [x] Selection expiry/title collision checks: expired records and mismatched task/title dispatches are denied by the guard.
- [x] Dynamic quota/usage-aware binding: selector accepts provider usage/health snapshots and skips exhausted, critical, stale, blocked, unavailable, or non-dispatchable providers when alternatives exist.
- [ ] Upstream pre-dispatch evidence hook: not implemented; reviewed in `OMNIGENT_UPSTREAM_HOOK_REVIEW.md` and deferred.

---

## 다관점 비판 리뷰 반영 (2026-07-02)

4개 독립 관점(보안/권한경계, 엔지니어링/검증, 제품/전략, 운영/플랫폼결합) 리뷰의 검증된 발견을 우선순위화한 백로그다. HIGH 발견은 전부 코드 라인 단위로 재검증되었다(TS 로직 부재 0-hit grep, dead literal line 378 덮어쓰기, guard cache 무권한 write/무검증 read, template manifest 0건 등).

### 구현 진행 (2026-07-02)

- **완료**: TS selector parity 이식(available_agents/agent_not_available/compatibility, `pythonTruthy` 빈-리스트 무제약 재현) + parity fixture 3케이스, dead DEFAULT_REGISTRY 리터럴 제거, MCP stdio 바이트 상한, provider_usage O_NOFOLLOW/fstat, NODE_PATH 제거, guard cache perms(0700/0600)+unique tmp+O_NOFOLLOW+read 상한, guard 실패 방향 문서 정정(4곳), allow_unknown 의도 docstring.
- **완료(신규)**: harness↔model-family 커플링 — 정본 `HARNESSES_BY_FAMILY`/`PROVIDER_FAMILY_HARNESS`(Py+TS), `agent_allowed_bindings()`, guard를 "recorded harness exact-match"에서 "dispatched (family,harness) 쌍 일관 + agent 레지스트리 허용 쌍" 검증으로 변경(matcher family 필터 제거), 레지스트리 harness↔family 불변식 테스트(Py+TS), cross-family coupled guard 테스트 3건, FD-OC 프롬프트에 family별 harness 동반 설정 지시. 검증: Python 97 OK, TS core 987, TS omnigent 26.
- **부분**: guard cache 무결성(same-UID poisoning은 근본적으로 남음 — session-binding/HMAC 미도입, "best-effort" 문서 유지); parity fixture(allowed_models·preferred+tier·dispatchable=false·expires_at 케이스 미추가); guard 실패 모드 매트릭스의 `OMNIGENT_SAFETY_RULES.md` 반영 미완.
- **미착수(P1 잔여)**: event-shape 계약 테스트+버전 핀, model-id drift 검증, guard cache pruning/다중세션 격리(근본 해결 upstream hook), template manifest, live E2E smoke, 설치경로 정리, ts_cli ADR.
- **후속 parity 갭**: 트레이스 verifier(`trace_verifier`/`omnigent-trace-verification`)는 여전히 cross-family override를 실패로 본다. guard가 coupled cross-family를 허용하도록 바뀌었으므로, post-run verifier도 동일 규칙(agent 레지스트리 허용 쌍)으로 완화해야 guard와 정합. 별도 작업으로 분리.

### P0 — 기존 기능의 정확성·안전 (즉시)

- [ ] **Guard cache 위협모델 + 무결성**: `~/.cache/flowdesk/omnigent-selection-guard-cache.json`은 같은 UID의 임의 프로세스가 가짜 selected record를 주입해 guard DENY를 우회할 수 있다(`policies.py:194-216` — 권한 미설정 write, 무검증 Mapping 수용). 파일/디렉토리 0600/0700 강제, session_ref 매칭 필수화, record HMAC 서명 또는 in-process-only(캐시 폐기) 중 설계 결정 + 테스트. (보안 HIGH)
- [ ] **Guard 실패 모드 매트릭스 명문화**: 미설치=no-deny, unknown-agent=`allow_unknown_agents=True` 기본 통과(fail-open), 캐시 read 실패=record 부재→DENY(fail-closed 가용성 실패), 캐시 poisoning=fail-open 우회. 이 매트릭스를 `OMNIGENT_SAFETY_RULES.md`에 반영하고 사용자 문서의 방향 오기를 정정한다. (보안 HIGH; 문구 정정은 2026-07-02 완료)
- [ ] **TS selector 로직 parity 갭 해소**: `omnigent-selection.ts`에 `available_agents`/`allowed_agents` 필터, `_entry_compatibility_error` 상당, `agent_not_available` blocked 사유가 없다(0-hit). 같은 request에 Python=blocked, TS=selected가 가능한 침묵 divergence. TS에 이식하거나, 미지원 필드 수신 시 fail-closed(blocked) 처리 + 문서화. (엔지니어링 HIGH)
- [ ] **Parity fixture 분기 커버리지 확장**: available_agents 필터, agent_not_available/model_family_mismatch blocked, allowed_models 필터, preferred_model+model_tier 동시 지정, provider_usage dispatchable=false / remaining_percent<=0, expires_at 검증 케이스를 `omnigent_selection_parity_cases.json`에 추가(현재 14케이스에 전부 부재). (엔지니어링 HIGH)
- [ ] **Dead DEFAULT_REGISTRY 리터럴 제거**: `selection.py:158-376` 리터럴은 line 378의 JSON 로드로 즉시 덮어써지는 dead code이며 내용도 stale(sonnet-5 등 부재)해 SSOT 오인 위험. 삭제하고 JSON 단일 소스를 유지. (엔지니어링 MED, 위험도 낮고 비용 미미)

### P1 — drift·플랫폼 결합·하드닝

- [ ] **Omnigent event shape 계약 테스트 + 버전 호환 매트릭스**: guard/trace가 의존하는 `tool_call`/`tool_result`/`function_call` shape를 golden fixture로 핀하고, 검증된 Omnigent 버전 범위(현재 0.3.0.dev0)를 명시. shape drift 시 guard가 조용히 fail-open으로 퇴화하는 회귀를 CI에서 감지. (엔지니어링 MED + 운영 HIGH 중복 → 통합)
- [ ] **레지스트리 model-id 실존/deprecation 검증 절차**: 하드코딩 id(claude-sonnet-5, openai/gpt-5.5, gemini-3.5-flash 등)의 verified_at/source 메타 도입 + "수동 확인 산물" 문서화 + 가능하면 provider 목록 대조 스모크. (엔지니어링 HIGH)
- [ ] **Guard cache concurrency/pruning**: 고정 `.tmp` suffix 동시-write 손상 및 read-modify-write lost-update(마지막 writer 승) 해소 — PID/랜덤 suffix + lock 또는 append-only 포맷. append 시 expired record prune, crash 잔여 `.tmp` cleanup. (보안 MED + 운영 MED 통합)
- [ ] **Guard cache 다중 세션 격리**: 전역 200-record 파일을 FD-OC/Opus/Codex 세션이 공유 — 한 세션 selection이 다른 세션 dispatch를 ALLOW하거나 window 밀림으로 정당 dispatch DENY 가능. 세션/task 스코프 키 분리 또는 "동시 세션 best-effort" 명시. 근본 해결은 upstream hook. (운영 MED)
- [ ] **MCP stdio 입력 하드닝**: 라인/요청 바이트 상한(예: 256KB) + 초과·malformed 시 JSON-RPC 에러 반환, oversized/no-newline DoS 테스트. (보안 MED)
- [ ] **provider_usage PATH 입력 TOCTOU/symlink 방어**: stat-then-read race 제거(O_NOFOLLOW+fstat 기반), symlink 거부 테스트. (보안 MED)
- [ ] **subprocess env allowlist에서 NODE_PATH 제거 검토**: NODE_PATH는 TS CLI 모듈 해석을 공격자 통제 경로로 돌릴 수 있어 credential-strip 취지와 상충. 제거 또는 정당화 문서화. (보안 LOW)
- [ ] **ts_cli bridge 운명 결정(ADR)**: `engine="ts_cli"` 실소비자가 테스트 외 전무. 유지/삭제/승격 기준을 ADR로 확정하고, 유지 시 "실험/미사용" 명시. (엔지니어링 MED)
- [ ] **Template manifest + drift 감지**: `template_installer`에 버전+checksum manifest 기록(현재 0건), `--check` drift 리포트 모드, launcher stale 경고. `--force`의 사용자 수정 소실 위험 문서화. (운영 HIGH)
- [ ] **Live E2E smoke 자동화**: 주간 PyPI smoke는 import/tools-list만 커버 — 고정 버전 Omnigent를 CI에 설치해 실제 FunctionPolicy allow/deny 왕복을 검증하거나, 불가 시 smoke 미커버 범위를 문서화. (운영 MED)
- [ ] **정식 설치 경로 1개 선언**: 현재 5갈래(editable/uv/PyPI/MCP venv-python/콘솔스크립트). supported 1개 + 나머지 experimental 격하, MCP fixture의 절대경로(`/Users/...`) 제거. (운영 MED)

### P2 — 제품 가치 증분 (Phase 3 hygiene보다 우선 검토)

- [ ] **Usage bridge**: OpenCode 트랙 live usage collector(Claude/OpenAI/Gemini) 출력을 strict allowlist schema로 정규화해 Omnigent selector의 snapshot 입력(env/path)으로 연결. snapshot을 caller가 수작업으로 만들어야 하는 현 UX가 핵심 가치(quota 보존)를 무력화하는 주 갭. (제품 HIGH)
- [ ] **entitled_providers 1급 입력**: "사용자가 실제 보유한 구독/자격" allowlist를 selector 입력으로 formalize. `available_agents`(parent 등록 목록)와 구독 자격은 다른 개념. "구독 없는 provider 추천 금지"를 negative fixture로 고정. (제품 HIGH)
- [ ] **Quota-보존 증명 시나리오**: "A 90% 소모 → selector가 A 회피, B 선택 → A quota 미증가"를 redacted fixture + trace verifier 검증으로 고정하고 완료 기준에 포함. 현재 가치 제안은 기능 정상성 테스트만 있고 보존 결과 지표가 없다. (제품 HIGH)
- [ ] **제품 성공 지표 정의**: 최소 2개(예: 추천 수용률, quota-회피가 실소모를 줄인 사례 수)와 측정 방법을 정의하고 Phase 4 승격 gate("반복 사용 가치")를 주관 판단이 아닌 이 지표에 연결. (제품 MED)
- [ ] **snapshot 미주입 시 퇴화 명시**: usage snapshot이 없으면 selector는 정적 role 매핑으로 동작하며 quota-보존 가치가 발생하지 않음을 사용자 문서에 정직하게 명시. (제품 MED)

### 리뷰에서 기각/보류된 항목

- Guard 가치 서사 추가 격하(제품 MED): 2026-07-02 문서 커밋에서 이미 "best-effort, not a hard gate"로 4개 문서에 반영됨. README 상단 기능 나열의 추가 조정은 P2 성공지표 작업과 함께 재검토.
- 캐시 poisoning exploit PoC 재현: 정적 판독으로 공격면은 확정했으나 PoC는 P0 무결성 설계 작업의 검증 단계에 포함한다.
