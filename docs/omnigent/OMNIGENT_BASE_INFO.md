# Omnigent — 플랫폼 기본 정보

**관련 문서**:
- [OMNIGENT_SETUP.md](./OMNIGENT_SETUP.md) — 설치 및 운영 가이드
- [OMNIGENT_DESIGN.md](./OMNIGENT_DESIGN.md) — FlowDesk 통합 설계
- [OMNIGENT_SAFETY_RULES.md](./OMNIGENT_SAFETY_RULES.md) — Safety Rules

---

## Omnigent 개요

| 항목 | 내용 |
|---|---|
| 공식 사이트 | https://omnigent.ai |
| 로컬 repo | `/Users/bagel_macpro_055/Documents/work/projects/omnigent` |
| 로컬 버전 | `0.3.0.dev0` |
| 언어 | Python 3.12+ |
| 라이선스 | Apache 2.0 |
| 상태 | alpha |

Omnigent는 Claude Code, Codex, Pi, Cursor 등 다양한 AI agent를 하나의 공통 orchestration layer로 통합하는 open-source AI agent framework다. 여러 harness를 조합하고, sub-agent에 작업을 위임하며, 결과를 종합하는 orchestrator를 YAML spec으로 정의할 수 있다.

---

## FlowDesk가 Omnigent를 선택한 이유

### 목표 구조와 가장 잘 맞는다

FlowDesk의 목표는 "orchestrator가 task를 분할하고, FlowDesk가 각 subtask에 적합한 agent와 model을 선택하며, 결과를 종합하는 구조"다.

| 플랫폼 | 병렬 fan-out | cross-provider 병렬 | FlowDesk 통합 방식 | 구독 지원 |
|---|---|---|---|---|
| **Omnigent** | 플랫폼 기본 동작 | 완전 지원 (검증됨) | Python tool 1개 등록 | 1급 provider kind |
| Pi | extension 예제로만 존재 | provider 제약 있음 | extension 코드 수정 | pi harness는 구독 미지원 |
| OpenCode | scheduler 순차 처리 (미완) | 지원하나 미완성 | 이미 구현됨 (현재 경로) | claude/ prefix 모델 |

### 핵심 근거

1. **병렬 fan-out이 플랫폼 기본 동작**: LLM이 한 응답에서 여러 `sys_session_send`를 emit하면 `asyncio.gather()`가 자동 병렬 실행한다. 추가 구현 불필요.
2. **cross-vendor 병렬 실행이 검증됨**: `examples/debby/`에서 Claude + GPT를 동시에 fan-out하는 패턴이 프로덕션에서 작동 중이다.
3. **구독 OAuth를 1급 provider kind로 지원**: `kind: subscription`이 공식 provider 타입이며, API key 없이 CLI 로그인 상태를 그대로 사용한다.
4. **FlowDesk 통합 최소 비용**: Python tool 하나(`flowdesk_select_agent_model`)를 local function tool로 등록하고 orchestrator prompt에 3줄 추가하면 된다. Omnigent core 코드 수정 불필요.
5. **guardrail/policy 레이어**: `spawn_bounds`, `blast_radius` 등 안전 장치가 내장되어 있다.

---

## Harness 목록

### Headless (subprocess / SDK) — tmux 불필요

| Harness | 실행 방식 | Provider | 구독 지원 |
|---|---|---|---|
| `claude-sdk` | Anthropic SDK subprocess | Anthropic 전용 | Claude Pro/Max (API key 제거 후 OAuth 자동) |
| `codex` | codex app-server subprocess | OpenAI 전용 | ChatGPT Plus/Pro (OPENAI_API_KEY 제거 후 auth.json 자동) |
| `antigravity` | Google AGY SDK in-process | Google 전용 | GEMINI_API_KEY 또는 Vertex AI만 (구독 OAuth 미지원) |
| `pi` | Pi CLI subprocess | 모든 provider | Pi harness는 subscription kind 명시적 차단 |
| `openai-agents` | OpenAI Agents SDK in-process | multi-model | API key 방식 |
| `open-responses` | OpenAI Responses API | OpenAI | API key 방식 |

### Native (TUI + tmux) — tmux 필수

| Harness | 실행 방식 | Provider | 구독 지원 |
|---|---|---|---|
| `claude-native` | Claude Code CLI + tmux | Anthropic 전용 | Claude Pro/Max (keychain OAuth 자동) |
| `codex-native` | codex app-server + tmux | OpenAI 전용 | ChatGPT Plus/Pro (auth.json 자동) |
| `antigravity-native` | agy TUI + tmux | Google 전용 | Google OAuth (~/.gemini/oauth_creds.json 자동) |
| `pi-native` | Pi TUI + tmux | 모든 provider | Pi 자체 로그인 |
| `opencode-native` | OpenCode serve + SSE | OpenCode provider | OpenCode 자체 설정 |

### 기타

| Harness | Provider |
|---|---|
| `cursor`, `cursor-native` | Cursor CLI |
| `goose`, `goose-native` | Goose CLI (ACP mode) |
| `kimi`, `kimi-native` | Kimi Code CLI |
| `qwen`, `qwen-native` | Qwen Code CLI |
| `hermes`, `hermes-native` | Hermes CLI |
| `copilot` | GitHub Copilot SDK |

### Harness별 모델 family 제약

```
claude-sdk / claude-native  → Claude 모델만 허용
codex / codex-native        → GPT 모델만 허용
antigravity                 → Gemini 모델만 허용
pi / openai-agents          → 모든 모델 허용 (multi-provider)
```

cross-provider 요청 시 명시적 에러:
```
"harness 'claude-native' only runs Claude models; got 'gpt-5.4'"
```

---

## 구독 지원 현황

| 구독 | 최적 Harness | 인증 파일 위치 | tmux 필요 |
|---|---|---|---|
| Claude Pro/Max | `claude-sdk` (headless) 또는 `claude-native` | macOS Keychain (`Claude Code-credentials`) | claude-sdk: 불필요 / claude-native: 필요 |
| ChatGPT Plus/Pro | `codex` (headless) 또는 `codex-native` | `~/.codex/auth.json` | codex: 불필요 / codex-native: 필요 |
| Gemini Google OAuth | `antigravity-native` | `~/.gemini/oauth_creds.json` | 필요 |
| Gemini API key | `antigravity` (headless) | 환경변수 `GEMINI_API_KEY` | 불필요 |

**구독 인증 동작 원리**:
- `claude-sdk`: ANTHROPIC_API_KEY를 subprocess 환경에서 제거 → Claude CLI의 keychain OAuth 자동 사용
- `codex`: OPENAI_API_KEY를 subprocess 환경에서 제거 → `~/.codex/auth.json` tokens 자동 사용
- `antigravity-native`: `~/.gemini/oauth_creds.json` 파일을 직접 읽어 Google OAuth 사용

---

## 병렬 실행 메커니즘

### 핵심 원리

LLM이 하나의 응답(response)에서 `sys_session_send`를 여러 개 emit하면,
Omnigent runner가 각 tool call을 `asyncio.create_task()`로 만들어
`asyncio.gather()`로 동시 실행한다.

```python
# app.py 내부 (의사코드)
for tool_call in response.tool_calls:
    _dispatch_tasks.append(
        asyncio.create_task(dispatch_tool_locally(tool_call))
    )
await asyncio.gather(*_dispatch_tasks)
```

### 병렬 실행 트리거

```
LLM 한 응답에서:
  sys_session_send(agent="claude_code", model="claude-opus-4-8", ...)
  sys_session_send(agent="codex",       model="gpt-5.5", ...)
  sys_session_send(agent="pi",          model="gemini-pro", ...)
    ↓ asyncio.gather() — 세 child session 동시 launch
```

### 결과 수집 흐름 (inbox 패턴)

```
[1] 각 sub-agent 완료
    → parent의 asyncio.Queue에 결과 push
    → wake notice: "[System: sub-agent X finished — N results waiting]"
    → orchestrator LLM 재실행

[2] orchestrator가 sys_read_inbox 호출
    → Queue drain → 결과 수신

[3] 모든 sub-agent 완료 확인 후 종합
```

### spawn 제한 (guardrail)

```yaml
guardrails:
  policies:
    spawn_bounds:
      max_dispatches_per_turn: 5   # 한 턴에 최대 5개 병렬
```

---

## 주요 파일 위치

| 파일 | 역할 |
|---|---|
| `omnigent/runner/app.py` | 메인 실행 루프, asyncio.gather 병렬 처리 |
| `omnigent/tools/builtins/spawn.py` | sys_session_send 구현 |
| `omnigent/tools/builtins/async_inbox.py` | sys_read_inbox 구현 |
| `omnigent/runner/tool_dispatch.py` | sub-agent session 생성/관리 |
| `omnigent/model_catalog.py` | 각 harness별 사용 가능 모델 목록 |
| `omnigent/model_override.py` | model override 유효성 검증 |
| `omnigent/onboarding/provider_config.py` | provider kind 정의 (subscription 포함) |
| `omnigent/runtime/harnesses/__init__.py` | 전체 harness 목록 등록 |
| `examples/debby/config.yaml` | Claude + GPT 병렬 fan-out 예제 |
| `examples/polly/config.yaml` | 멀티 worker 코딩 orchestrator 예제 |
