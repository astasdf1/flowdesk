# FlowDesk + Omnigent 통합 — Safety Rules

**적용 범위**: FlowDesk + Omnigent 통합 개발에만 적용된다.
OpenCode 플러그인 개발 시에는 [../opencode/OPENCODE_SAFETY_RULES.md](../opencode/OPENCODE_SAFETY_RULES.md)를 참조한다.

---

## 역할 경계 원칙

FlowDesk와 Omnigent의 역할은 명확히 분리된다.

| | FlowDesk | Omnigent |
|---|---|---|
| **담당** | agent/model 선택 (intelligence) | orchestration loop, 실행, context, 결과 수집 |
| **권한** | 선택 결과 반환, opt-in 일관성 검증 | 실행 결정 및 수행 |
| **금지** | 직접 실행, sys_session_send 호출 | FlowDesk 선택 로직 침범 |

---

## Safety Rules

### 1. FlowDesk는 선택만 한다

FlowDesk tool은 `{agent, harness, model}` 선택 결과를 반환하는 것에만 관여한다.
`sys_session_send`, `sys_session_create`, `sys_read_inbox` 등
Omnigent orchestration tool을 FlowDesk 코드에서 직접 호출하지 않는다.

### 2. FlowDesk는 Omnigent core를 수정하지 않는다

FlowDesk 기능은 Omnigent의 local function tool 또는 MCP tool 등록 방식으로만 추가한다.
`omnigent/` 하위 core 코드를 직접 수정하지 않는다.
단, 명확한 버그 수정이나 FlowDesk 연동을 위한 hook point 추가는
별도 PR로 Omnigent upstream에 기여하는 방식을 사용한다.

### 3. FlowDesk는 orchestrator 역할을 겸하지 않는다

FlowDesk가 subtask 분할, 워크플로우 계획, 결과 종합을 담당하지 않는다.
이 역할은 Omnigent orchestrator의 prompt와 내부 로직이 담당한다.
FlowDesk는 orchestrator로부터 "이 task에 적합한 agent/model을 골라줘"라는
요청을 받아 응답하는 역할에 집중한다.

### 4. 실행 권한은 Omnigent가 가진다

FlowDesk tool이 반환한 선택 결과는 **권고(recommendation)**다.
최종 실행 여부와 방법은 Omnigent orchestrator가 결정한다.
FlowDesk는 Omnigent의 guardrail/policy를 우회하지 않는다.

단, 사용자가 Omnigent fixture에 `flowdesk_omnigent.policies.omnigent_selection_dispatch_guard`를 명시적으로 설치한 경우 FlowDesk는 좁은 **dispatch-consistency gate**로 동작할 수 있다. 이 guard는 FlowDesk-known `sys_session_send` 호출이 fresh selector provenance의 task/agent/harness/model binding과 일치하지 않을 때만 DENY할 수 있다. 이는 Omnigent dispatch authority를 FlowDesk로 이전하는 것이 아니며 provider/model fallback, runtime retry, write/apply, hard-chat/noReply 권한을 만들지 않는다.

### 5. 구독 credential을 FlowDesk 코드에서 직접 다루지 않는다

Claude/Codex/Gemini 구독 OAuth token, keychain 접근,
`auth.json` 파일 읽기 등을 FlowDesk tool 코드에서 수행하지 않는다.
인증은 각 harness(claude-sdk, codex, antigravity-native)가 독립적으로 처리한다.
FlowDesk는 어떤 harness를 선택할지만 결정한다.

### 6. provider quota 정보는 read-only로만 사용한다

FlowDesk가 quota 상태를 파악하기 위해 provider API나 로컬 캐시를 읽을 수 있다.
단, quota를 소비하거나 provider 상태를 변경하는 작업은 수행하지 않는다.

Omnigent selector는 provider credential/token 파일을 직접 읽지 않는다. Omnigent 경로에서 usage 정보는 explicit request의 `provider_usage`/`provider_health` 또는 caller-provided sanitized snapshot(`FLOWDESK_OMNIGENT_PROVIDER_USAGE_JSON`, `FLOWDESK_OMNIGENT_PROVIDER_USAGE_PATH`)으로만 들어온다. 이 env/path 입력은 임시 bridge이며 release-grade 신뢰 신호가 되려면 strict allowlist schema, source labeling, stale/rejected snapshot handling이 필요하다.

### 7. 미결 사항은 구현하지 않는다

인터페이스나 동작이 확정되지 않은 항목(OMNIGENT_DESIGN.md의 미결 사항 참조)은
설계가 확정되기 전에 구현을 시작하지 않는다.
특히 FlowDesk evidence/audit과 Omnigent 통합은 범위가 명확해진 후 진행한다.

### 8. Selector는 advisory-only이고 guard는 opt-in consistency-only다

`flowdesk.omnigent_selection.v1` 결과는 Omnigent dispatch gate가 아니다.
Selector 자체는 trace/evidence로 "선택 후 실행"을 관찰할 수 있지만 blocked/non-dispatchable 결과를 기계적으로 막는 safety boundary라고 주장하지 않는다.

선택적으로 설치되는 function-policy guard는 selector와 분리된 consistency-only boundary다. Guard가 DENY할 수 있는 범위는 FlowDesk-known sub-agent dispatch의 provenance/binding mismatch로 제한된다. broader policy enforcement, provider fallback/reselection, runtime retry, upstream Omnigent core hook은 별도 ADR과 conformance evidence 없이는 주장하지 않는다.

### 9. Prompt injection을 selection output으로 반사하지 않는다

`task_description`은 bounded/redacted input으로만 사용한다.
Orchestrator-visible `reason_codes`, `blocked_labels`, `authority`는 고정 enum/label만 사용하고,
사용자 원문, provider payload, credential path, token-shaped string을 그대로 반환하지 않는다.

---

## Conformance Checklist (Omnigent Track)

Phase 1 implementation before merge:

- `packages/omnigent-tool` code must not import or call `sys_session_send`, `sys_session_create`, or `sys_read_inbox`.
- Selector code must not open known credential files such as `~/.codex/auth.json`, `~/.gemini/oauth_creds.json`, or keychain material.
- Selector code must not read raw token-bearing environment variables for routing decisions.
- Unit tests must cover invalid role, disallowed provider, model-family mismatch, malformed request, and Gemini default `non_dispatchable`.
- Selection output must carry `authority="advisory_selection_only"`.
- If the optional function-policy guard is installed, DENY behavior must stay limited to fresh selector-provenance and task/agent/harness/model binding mismatches.
- Selection evidence should be read from Omnigent transcript/tool-call history by default. Optional debug logs, if explicitly enabled, must be bounded, redacted, and omit raw prompts, tokens, credential paths, and provider payloads.

---

## OpenCode Safety Rules와의 관계

OpenCode 플러그인 Safety Rules(특히 Rule 1 "No external orchestrator runtime dependency",
Rule 2 "No nested opencode run")는 OpenCode 플러그인 컨텍스트에만 적용된다.

Omnigent 통합 개발에서는:
- Omnigent를 **허용된 외부 orchestration 플랫폼**으로 사용한다.
- FlowDesk는 Omnigent의 tool로 등록되는 **플러그인 역할**을 한다.
- OpenCode 플러그인 코드를 Omnigent 통합 코드에 혼용하지 않는다.
  (두 방향은 독립적으로 개발되며 필요한 경우 공통 core 로직만 공유한다.)
