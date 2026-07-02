# FlowDesk + Omnigent 통합 설계

**상태**: PyPI package + selector/MCP/guard 구현 / task-tier 및 provider-usage snapshot 입력 지원
**ADR**: [ADR 0002](../adr/0002-omnigent-selection-integration.md), [ADR 0003](../adr/0003-omnigent-first-selection-layer.md)
**Safety Rules**: [OMNIGENT_SAFETY_RULES.md](./OMNIGENT_SAFETY_RULES.md)
**기본 정보**: [OMNIGENT_BASE_INFO.md](./OMNIGENT_BASE_INFO.md)
**설치 가이드**: [OMNIGENT_SETUP.md](./OMNIGENT_SETUP.md)
**개발 설계안**: [OMNIGENT_DEVELOPMENT_DESIGN_OPTIONS.md](./OMNIGENT_DEVELOPMENT_DESIGN_OPTIONS.md)
**개발 Backlog**: [OMNIGENT_PHASE_BACKLOG.md](./OMNIGENT_PHASE_BACKLOG.md)
**MCP 운영**: [OMNIGENT_MCP_OPERATION.md](./OMNIGENT_MCP_OPERATION.md)
**Upstream Hook 검토**: [OMNIGENT_UPSTREAM_HOOK_REVIEW.md](./OMNIGENT_UPSTREAM_HOOK_REVIEW.md)

---

## 목표

메인 오케스트레이터가 워크플로우 생성/세부작업 분할/결과 종합을 담당하고,
각 subtask에 FlowDesk가 전문 agent/harness/model binding을 권고해서
Omnigent가 병렬 또는 순차로 실행하는 구조를 만든다.

### FlowDesk의 역할

FlowDesk는 **선택 레이어**만 담당한다:

- 각 task의 성격(security/architecture/implementation 등)을 분석한다.
- provider usage/health snapshot을 selection input으로 반영한다 (quota, 가용성).
- 적합한 agent harness와 model을 결정한다.
- 결과를 `{agent, harness, model}` 형태의 advisory selection으로 반환한다.
- opt-in function-policy guard가 설치된 경우, 선택 결과와 실제 `sys_session_send` binding이 어긋나는지만 좁게 차단한다.

context 관리, memory, orchestration loop, 실행, 결과 수집은 Omnigent가 담당한다.

**Evidence 원칙**: selection evidence의 source of truth는 Omnigent transcript/tool-call history다. `FLOWDESK_OMNIGENT_SELECTION_LOG_PATH`로 켜는 optional debug log는 **derived evidence**일 뿐이며, `flowdesk.omnigent_selection.v1` 응답의 allowlist 필드 투영만 기록한다(요청 본문·prompt·credential 미포함 — `test_debug_evidence_writer_emits_only_schema_aligned_fields`로 고정). 감사·검증은 transcript를 adapter/verifier로 정규화해 수행하고, debug log를 승인·감사 근거로 쓰지 않는다.

---

## 목표 아키텍처 (방향성)

```
사용자 요청
  ↓
Orchestrator (Omnigent, claude-sdk harness, Claude 구독)
  → 워크플로우 분석 / subtask 분할
  → [FlowDesk tool 호출: 각 subtask에 agent/model 선택]
    ↓ sys_session_send 복수 emit → asyncio.gather() 병렬 실행
  ┌─────────────────────────────────────────────────────┐
  │ subtask1: policy-security + claude-opus  (구독)     │
  │ subtask2: architecture    + gpt-5.5      (구독)     │
  │ subtask3: verification    + gpt-mini     (구독)     │
  └─────────────────────────────────────────────────────┘
    ↓ 각 완료 시 inbox push → orchestrator wake
  Orchestrator 결과 수집 (sys_read_inbox)
  → 결과 종합 → 사용자에게 전달
```

---

## 역할 분리

| 역할 | 담당 | 구현 위치 |
|---|---|---|
| 워크플로우 생성/분할/종합 | Omnigent orchestrator | config.yaml prompt |
| agent/model 선택 | **FlowDesk** | Python local function tool / MCP selector |
| binding consistency guard | **FlowDesk** opt-in | Omnigent function policy |
| 병렬/순차 실행 | Omnigent runner | asyncio.gather() 자동 |
| context/memory 관리 | Omnigent harness | 각 harness 내부 |
| 결과 수집 | Omnigent inbox | sys_read_inbox |
| provider quota 입력 | **FlowDesk/Caller** | explicit snapshot / sanitized env JSON or path |

### 범위 밖: Operational Intelligence (OpenCode 트랙 전용)

OpenCode 트랙의 Phase 7 Operational Intelligence 자산(9-dimension scoring engine, score ledger, HHI/ESS rollup, hash chain/JCS, GitHub publisher, OI MCP tools)은 **Omnigent 셀렉터 경로에서 사용하지 않는다.** 결정: [ADR 0003](../adr/0003-omnigent-first-selection-layer.md) 및 사용자 결정(2026-07-02)에 따라 OI를 OpenCode 트랙 전용 자산으로 격리한다.

Omnigent 셀렉터는 정적 레지스트리 아티팩트(`omnigent_selector_registry.v1.json`) + task role/tier + provider usage/health snapshot 입력만으로 advisory 선택을 계산한다. `packages/omnigent-tool`은 `packages/core`의 operational-intelligence 모듈이나 `packages/opencode-plugin`에 의존하지 않는다(ADR 0002 구현 규칙). OI 스코어링을 Omnigent 경로에 연결하려면 별도 ADR로 재검토한다.

### 제품 성공 지표 (2026-07-02 정의)

Phase 4/후속 승격 판단("반복 사용 가치")은 주관 판단이 아니라 아래 두 지표로 한다. 둘 다 기존 trace adapter/verifier 출력에서 기계적으로 산출 가능하다.

| 지표 | 정의 | 측정 방법 |
|---|---|---|
| **추천 수용률** | guarded dispatch 중 선행 FlowDesk selection이 존재하고 (family, harness) 바인딩이 검증-통과한 비율 | transcript를 `normalize_omnigent_trace_events`로 정규화 → `verify_selection_dispatch_trace` 결과에서 `dispatch_without_prior_selection`/binding 오류가 없는 dispatch 비율 |
| **quota-회피 유효 사례** | usage snapshot에 `exhausted`/`critical` family가 있고, selection이 그 family를 회피했으며, 후속 dispatch가 회피된 binding으로 검증-통과한 세션 수 | selection의 provider_family ≠ exhausted family + 동일 task dispatch verifier pass 조합 카운트 (레퍼런스 구현: `test_quota_avoidance_flows_through_selection_dispatch_and_verifies`) |

**승격 gate 연결**: 최근 10회 실사용 orchestration 기준 수용률 ≥ 80% AND quota-회피 유효 사례 ≥ 1 이면 "반복 사용 가치 있음"으로 판정한다. 미달이면 MCP/upstream hook 승격을 보류한다.

---

## Harness 구성 (현재 방향)

| Agent | Harness | Provider | 구독 방식 | tmux |
|---|---|---|---|---|
| Orchestrator | `claude-sdk` | Anthropic | Claude Pro/Max 구독 | 불필요 |
| policy-security-agent | `claude-sdk` | Anthropic | Claude Pro/Max 구독 | 불필요 |
| architecture-agent | `codex` | OpenAI | ChatGPT Plus/Pro 구독 | 불필요 |
| verification-agent | `codex` | OpenAI | ChatGPT Plus/Pro 구독 | 불필요 |
| gemini-experimental | `antigravity-native` | Google | Gemini Google OAuth | 필요 |

> `claude-sdk`와 `codex`는 tmux 없이 구독으로 동작한다.
> `antigravity-native`는 tmux가 필요하고 OAuth 만료 시 브라우저 재로그인이 필요하다. MVP default가 아니라 experimental/non-dispatchable 경로로 둔다.
> 상세 설계 확정 후 harness 조합이 변경될 수 있다.

---

## FlowDesk Tool 인터페이스 (초안)

```python
# Omnigent function tool로 등록되는 FlowDesk 선택 tool
# 상세 후보는 OMNIGENT_DEVELOPMENT_DESIGN_OPTIONS.md 참조

def flowdesk_select_agent_model(
    task_role: str,           # "policy_security" | "architecture" | "implementation" | "verification" | "research" | "general"
    available_agents: list,   # 현재 parent spec이 등록한 agent 이름들
    provider_usage: dict,     # optional redacted provider usage snapshot
    task_complexity: str,     # optional "low" | "medium" | "high" | "critical"
    task_phase: str,          # optional "high_level_design" 등
) -> dict:
    return {
        "schema_version": "flowdesk.omnigent_selection.v1",
        "selection_status": "selected",
        "agent": "policy-security-agent",    # Omnigent agent 이름
        "harness": "claude-sdk",      # 사용할 harness
        "model": "claude-opus-4-8",   # 구체적 model id 또는 null for harness default
        "authority": "advisory_selection_only",
    }
```

**미결 사항**:
- Python/TypeScript selector registry를 single source of truth로 통합하는 방법
- provider usage snapshot을 strict allowlist schema로 formalize하는 방법
- FD-OC user-level templates를 repo-managed, versioned, opt-in template으로 제공하는 방법

현재 추천은 `Python selector/MCP portable path 유지 → registry parity/golden fixtures → strict provider usage schema → repo-owned FD-OC template` 순서다. Upstream Omnigent core hook은 아직 deferred다.

---

## Orchestrator Spec 방향 (미정)

```yaml
# 방향성만 — 실제 spec은 상세 설계 후 작성

name: flowdesk-orchestrator
prompt: |
  당신은 작업 orchestrator입니다.
  각 subtask 실행 전에 flowdesk_select_agent_model을 호출해서
  적합한 agent와 model을 선택하세요.
  선택 결과가 selected일 때만 sys_session_send를 호출하여 병렬 실행하세요.
  selector 결과는 advisory-only입니다. 선택적으로 설치된 FlowDesk guard는 task/agent/harness/model binding mismatch만 좁게 차단합니다.

executor:
  harness: claude-sdk

tools:
  flowdesk_select:
    type: function
    callable: flowdesk.omnigent.select_agent_model  # 미정

  agents:
    policy-security-agent:
      harness: claude-sdk
    architecture-agent:
      harness: codex
    verification-agent:
      harness: codex
```

---

## 구현 단계

Phase 1b 후속, Phase 2, Phase 3, Phase 4의 실행 단위 todo는 [OMNIGENT_PHASE_BACKLOG.md](./OMNIGENT_PHASE_BACKLOG.md)에 상세 기록한다.

### 1단계: 설치 + 단독 동작 테스트

- tmux, uv 설치
- Omnigent 로컬 설치
- `claude-sdk`, `codex` 각각 단독 테스트
- `antigravity-native`는 experimental로 보류하고 OAuth/TUI 제약만 기록
- debby 예제로 병렬 fan-out 확인

### 2단계: FlowDesk Python tool 기본 구현

- `flowdesk_select_agent_model` Python 함수 작성
- Omnigent local function tool로 등록
- 단순한 role → agent/model 매핑부터 시작
- Omnigent transcript/tool-call history를 Phase 1 selection evidence source로 사용
- post-run consistency 검증용 pure trace verifier 구현
- quota 연동은 2단계 후반 또는 3단계로

### 3단계: Orchestrator spec + 통합 테스트

- FlowDesk tool 연동 orchestrator config.yaml 작성
- debby 스타일 병렬 fan-out 테스트
- policy_security + architecture + verification 세 agent 동시 실행 검증
- 결과 수집 및 종합 흐름 확인

### 4단계: 상세 설계 확정 후 개선

- model selection scoring 고도화 (quota 반영, 성능 이력 등)
- orchestrator prompt 최적화
- 에러 처리 및 failover 설계
- FlowDesk evidence/audit Omnigent 통합 (미정)

---

## 미결 사항 및 알려진 제약

| 항목 | 상태 | 비고 |
|---|---|---|
| FlowDesk Python tool 구현 방식 | 추천 확정 | `packages/omnigent-tool` local function MVP 우선 |
| quota 정보 Omnigent → FlowDesk 전달 | 부분 구현 | explicit `provider_usage`/`provider_health`, sanitized env JSON/path bridge |
| antigravity-native tmux 의존성 테스트 | 보류 | MVP default 제외, experimental/non-dispatchable |
| Gemini OAuth token 만료 처리 | 보류 | agy TUI 재로그인 필요 |
| FlowDesk audit/evidence Omnigent 통합 | 부분 확정 | Phase 1 transcript/history, core schema alignment는 후속 |
| Phase 1b trace verifier | 구현 | normalized events 기반 post-run verification-only |
| Phase 1b trace adapter | 구현 | Omnigent function_call/function_call_output history를 normalized events로 변환 |
| Phase 2 TS CLI bridge | 구현 | `packages/core` CLI + Python opt-in `engine="ts_cli"` wrapper |
| Phase 3 schema alignment | 부분 구현 | core selection/trace types, validators, schema registry artifacts 추가 |
| Phase 4 MCP path | 실험 구현 및 live smoke 통과 | stdio MCP selection-only server + Omnigent MCP fixture |
| Phase 4b pre-dispatch binding guard | 구현 및 live smoke 통과 | opt-in function policy로 FlowDesk-known binding mismatch만 DENY |
| task-tier-aware selection | 구현 | `task_complexity`/`task_phase`/`task_tier`로 reasoning model preference |
| provider usage env/path bridge | 구현 | sanitized snapshot 입력만, strict schema formalization 필요 |
| orchestrator spec YAML 상세 설계 | 부분 구현 | PyPI fixture + user-level FD-OC bundles, repo-managed template 필요 |
| Pi harness와의 병용 가능성 | 검토 필요 | multi-provider 유연성 확보용 |

Live smoke 결과 (2026-06-26):

- `FLOWDESK_SELECTION_SMOKE_20260626_RETRY` 통과.
- `flowdesk_select_agent_model`이 세 번 호출되어 `selected`를 반환.
- `policy_security`는 `claude-sdk` + `claude-opus-4-8` override로 성공.
- `architecture`와 `verification`은 `codex` harness default(`model=null`)로 성공.
- 세 sub-agent 모두 inbox를 통해 expected token을 반환.
- 별도 JSONL evidence는 Phase 1 필수 경로가 아니다. Phase 1b는 Omnigent transcript/tool-call history 기반 verifier 또는 guardrail context 기반 대조로 진행한다.

Phase 1b trace verifier 상태 (2026-06-26):

- `packages/omnigent-tool/src/flowdesk_omnigent/trace_verifier.py` 추가.
- `packages/omnigent-tool/src/flowdesk_omnigent/trace_adapter.py` 추가.
- `verify_selection_dispatch_trace(events)`는 normalized `selection`/`dispatch` events를 검증한다.
- `normalize_omnigent_trace_events(items)`는 Omnigent `function_call` / `function_call_output` records와 generic `tool_calls` records에서 redaction-safe events를 추출한다.
- prior selection 없음, agent/model mismatch, `model=null` selection 뒤 override 사용, `blocked`/`non_dispatchable` dispatch를 실패로 분류한다.
- 검증 결과의 authority는 `verification_only`이며 dispatch deny, fallback, retry, provider switch 권한을 만들지 않는다.
- adapter 결과의 authority는 `trace_normalization_only`이며 raw prompt, full tool args/output, provider payload, credential을 보존하지 않는다.

Phase 4 MCP path 상태 (2026-06-27):

- `packages/omnigent-tool/src/flowdesk_omnigent/mcp_server.py` 추가.
- `flowdesk-omnigent-mcp` console script 추가.
- `examples/omnigent-flowdesk-mcp/` fixture 추가.
- Omnigent parser가 `flowdesk` stdio MCP server와 sub-agents를 정상 인식함을 확인.
- Live smoke `FLOWDESK_MCP_SELECTION_SMOKE_20260627_OK` 통과.
- MCP path도 selection-only이며 dispatch deny, fallback, retry, provider switch 권한을 만들지 않는다.

Phase 4b pre-dispatch binding guard 상태 (2026-06-27):

- `packages/omnigent-tool/src/flowdesk_omnigent/policies.py` 추가.
- `flowdesk_omnigent.policies.omnigent_selection_dispatch_guard`를 Omnigent function policy로 연결.
- `examples/omnigent-flowdesk/`와 `examples/omnigent-flowdesk-mcp/`에 `flowdesk_selection_dispatch_guard` guardrail 추가.
- Guard는 selector tool call과 selector tool result를 Omnigent policy `session_state`에 기록하고, `sys_session_send` 직전 matching task/agent/harness/model selection provenance가 있는지 검사한다.
- Selector tool result가 있으면 exact selector output provenance를 기록하고, tool result가 없는 구간에서는 selector-call args recomputation을 fallback provenance로 사용한다.
- `architecture-agent`, `implementation-agent`, `verification-agent`는 Codex subscription default를 사용하므로 explicit model override를 DENY한다.
- `policy-security-agent`는 `claude-opus-4-8` override만 허용한다.
- Claude fallback이 필요한 역할은 sub-agent `allowed_harnesses`와 dispatch `harness` override를 통해 실제 Omnigent harness와 맞춰야 한다.
- Negative smoke `FLOWDESK_DISPATCH_GUARD_NEGATIVE_20260627_OK` 통과.
- Positive smoke `FLOWDESK_DISPATCH_GUARD_POSITIVE_20260627_OK` 통과.
- Provenance negative smoke `FLOWDESK_PROVENANCE_GUARD_NEGATIVE_20260627_OK` 통과.
- Provenance positive smoke `FLOWDESK_PROVENANCE_GUARD_POSITIVE_2_20260627_OK` 통과.
- Final provenance negative smoke `FLOWDESK_PROVENANCE_GUARD_NEGATIVE_FINAL_20260628_OK` 통과.
- Final provenance positive smoke `FLOWDESK_PROVENANCE_GUARD_POSITIVE_FINAL_2_20260628_OK` 통과.
- 한계: fixture-level opt-in function policy enforcement다. Upstream core hook은 아직 구현하지 않았다.

Phase 1 최소 구현 파일:

- `packages/omnigent-tool/src/flowdesk_omnigent/selection.py`
- `packages/omnigent-tool/src/flowdesk_omnigent/trace_adapter.py`
- `packages/omnigent-tool/src/flowdesk_omnigent/trace_verifier.py`
- `packages/omnigent-tool/src/flowdesk_omnigent/policies.py`
- `packages/omnigent-tool/tests/test_selection.py`
- `packages/omnigent-tool/tests/test_trace_adapter.py`
- `packages/omnigent-tool/tests/test_trace_verifier.py`
- `examples/omnigent-flowdesk/config.yaml`
- `examples/omnigent-flowdesk-mcp/config.yaml`

상세 후보와 추천 경로는 [OMNIGENT_DEVELOPMENT_DESIGN_OPTIONS.md](./OMNIGENT_DEVELOPMENT_DESIGN_OPTIONS.md)에 기록한다.

---

## 참고: 플랫폼 선택 근거

Pi, OpenCode, Omnigent 비교 검토 결과 Omnigent를 선택한 이유:

- **병렬 fan-out**: Omnigent는 플랫폼 기본 동작 / Pi는 extension 예제 / OpenCode는 미완성
- **cross-provider 병렬**: Omnigent 검증됨 / Pi는 provider 제약 / OpenCode는 family 기반
- **구독 지원**: Omnigent `kind: subscription` 1급 / Pi harness는 구독 차단 / OpenCode는 `claude/` prefix
- **FlowDesk 통합 비용**: Omnigent는 tool 1개 / Pi는 extension 코드 수정 / OpenCode는 이미 내장

상세 비교는 이전 세션 분석 참조 (2026-06-26).
