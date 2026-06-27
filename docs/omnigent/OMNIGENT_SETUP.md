# Omnigent — 설치 및 운영 가이드

**관련 문서**:
- [OMNIGENT_BASE_INFO.md](./OMNIGENT_BASE_INFO.md) — 플랫폼 기본 정보
- [OMNIGENT_DESIGN.md](./OMNIGENT_DESIGN.md) — FlowDesk 통합 설계
- [OMNIGENT_SAFETY_RULES.md](./OMNIGENT_SAFETY_RULES.md) — Safety Rules

---

## 사전 요구사항

### 필수

| 항목 | 설치 명령 | 확인 명령 |
|---|---|---|
| **tmux** | `brew install tmux` | `tmux -V` |
| **uv** | `curl -LsSf https://astral.sh/uv/install.sh \| sh` | `uv --version` |
| **Python 3.12** | `uv python install 3.12` (uv가 자동 관리) | `uv python list` |

> tmux는 `claude-native`, `antigravity-native` harness에 필수다.
> `claude-sdk`, `codex` headless harness는 tmux 없이도 동작한다.

### CLI 로그인 상태

각 구독 CLI가 미리 로그인되어 있어야 한다.

```bash
# Claude Pro/Max 구독
claude auth status
# → authMethod: claude.ai, loggedIn: true 확인

# ChatGPT Plus/Pro 구독
ls ~/.codex/auth.json
# → tokens 필드 존재 확인

# Gemini Google OAuth (antigravity-native 사용 시)
ls ~/.gemini/oauth_creds.json
# → access_token, refresh_token 필드 존재 확인
```

### 현재 로컬 환경 상태 (2026-06-26 기준)

| 항목 | 상태 |
|---|---|
| tmux | 설치됨 (`tmux 3.6b`) |
| uv | 설치됨 (`uv 0.11.24`) |
| Python 3.12 | 설치됨 (`cpython-3.12.13-macos-aarch64-none`) |
| claude CLI v2.1.176 | OAuth 활성 (team 구독) |
| codex CLI v0.141.0 | auth.json + tokens 존재 |
| agy CLI v1.0.12 | oauth_creds.json 존재, access_token 만료 시 TUI 재로그인 필요 |
| omnigent | 설치됨 (`0.3.0.dev0`) |

---

## 설치 (로컬 repo 기준)

로컬 repo 방식을 사용한다. FlowDesk tool을 Omnigent에 추가하는 개발 작업이 필요하기 때문이다.

```bash
# 1. tmux 설치
brew install tmux

# 2. uv 설치
curl -LsSf https://astral.sh/uv/install.sh | sh
source ~/.zshrc   # 또는 터미널 재시작

# 3. Omnigent 로컬 개발 설치
cd /Users/bagel_macpro_055/Documents/work/projects/omnigent

uv python install 3.12        # Python 3.12 설치 (시스템 Python 변경 없음)
uv venv --python 3.12         # .venv 생성
uv sync --extra all           # 모든 의존성 설치 (antigravity 포함)
source .venv/bin/activate     # 활성화

# 4. 설치 확인
which omnigent
omnigent --version
```

> `uv sync --extra all` 은 `antigravity`, `databricks` 등 모든 optional extra를 포함한다.
> antigravity(Gemini) harness를 쓰려면 이 옵션이 필요하다.

---

## 업데이트

```bash
cd /Users/bagel_macpro_055/Documents/work/projects/omnigent

# 1. 최신 코드 받기
git pull

# 2. 의존성 동기화 (새 dependency 추가된 경우에만 필요)
uv sync --extra all

# 3. 서버가 실행 중이면 재시작
omnigent stop
omnigent server start
```

Python 코드 변경은 editable install이라 `git pull`만으로 즉시 반영된다.
`uv sync`는 `pyproject.toml`이 변경된 경우에만 필요하다.

---

## 구독 Provider 설정

### 방법 1: `omnigent setup` (대화형)

```bash
omnigent setup
```

대화형으로 credential을 추가/변경한다. Kind를 `subscription`으로 선택하고 CLI를 지정한다.

### 방법 2: `~/.omnigent/config.yaml` 직접 작성

```yaml
providers:
  # Claude Pro/Max 구독
  claude-sub:
    kind: subscription
    cli: claude
    default: true

  # ChatGPT Plus/Pro 구독
  codex-sub:
    kind: subscription
    cli: codex
    default: true

# Gemini: ~/.gemini/oauth_creds.json 파일이 존재하면 자동 감지
# antigravity-native harness가 OAuth 파일을 직접 읽는다
```

> provider `kind: subscription`은 API key를 사용하지 않는다.
> CLI 자체의 로그인 상태(keychain / auth.json)를 그대로 사용한다.

---

## 빠른 동작 테스트

### claude-sdk 단독 (tmux 불필요)

```bash
omnigent claude
# → Claude Code 구독으로 대화 시작
```

### codex 단독 (tmux 불필요)

```bash
omnigent codex
# → ChatGPT Plus/Pro 구독으로 대화 시작
```

### debby 예제 (Claude + GPT 병렬 fan-out)

```bash
omnigent run /Users/bagel_macpro_055/Documents/work/projects/omnigent/examples/debby/
# → 질문 입력 시 Claude와 GPT가 동시에 답변
```

### antigravity-native (Gemini, tmux 필요)

```bash
# tmux 설치 후
omnigent run --harness antigravity-native
```

`antigravity-native`는 agy TUI를 직접 launch한다. `-p/--prompt` 같은 REPL-only 옵션은 적용되지 않으며, OAuth access token이 만료되면 브라우저 로그인 창이 다시 뜰 수 있다. Gemini 구독 OAuth는 MVP 필수 경로에서 제외하고 experimental로 둔다.

---

## FlowDesk tool 추가 시 의존성 연결

FlowDesk Python 패키지를 Omnigent venv에 추가할 때 사용한다. Phase 1 패키지 경계는 `packages/omnigent-tool`이다.

```bash
cd /Users/bagel_macpro_055/Documents/work/projects/omnigent
uv add --dev /Users/bagel_macpro_055/Documents/work/projects/flowdesk/packages/omnigent-tool
uv sync
```

이후 FlowDesk tool 코드 수정은 `git pull` 없이 즉시 반영된다 (editable).

> `packages/omnigent-tool`은 설계상 목표 경로이며, 구현 전에는 존재하지 않을 수 있다. `packages/core`는 TypeScript package이므로 `uv add` 대상으로 쓰지 않는다.

---

## 트러블슈팅

| 증상 | 원인 | 해결 |
|---|---|---|
| `omnigent: command not found` | PATH 미적용 | `source ~/.zshrc` 후 재시도 |
| `tmux: command not found` | tmux 미설치 | `brew install tmux` |
| claude-sdk 400 "extra usage" 에러 | Claude CLI OAuth 만료 또는 미로그인 | `claude auth status` 확인 후 재로그인 |
| codex 인증 실패 | codex auth.json 없음 | `codex login` 실행 |
| `uv: Python 3.12 not found` | Python 3.12 미설치 | `uv python install 3.12` |
| antigravity-native 실패 | tmux 미설치 또는 agy OAuth 만료 | tmux 설치 + agy 재실행으로 OAuth 갱신 |
