# AGENTS.md - FlowDesk Repository Guidance

This repository is the FlowDesk project — an agent/model selection intelligence layer
that attaches to AI orchestration platforms as a plugin or tool.

## 개발 방향

FlowDesk는 두 가지 통합 방향을 병행 개발 중이다.
작업 전에 어느 방향인지 확인하고 해당 문서를 참조한다.

| 방향 | 설명 | 문서 |
|---|---|---|
| **OpenCode 플러그인** | OpenCode에 플러그인으로 통합, Release 1 MVP | `docs/opencode/` |
| **Omnigent 통합** | Omnigent orchestrator의 agent/model 선택 tool | `docs/omnigent/` |

---

## 공통 규칙 (두 방향 모두 적용)

### Task Tracking

항상 `todowrite` tool을 사용해서 비자명한 구현 단계의 todo 항목을 등록, 추적, 업데이트한다.

### Progress Tracking

`docs/PROGRESS_SNAPSHOT.md`는 이 저장소의 진행 상황 추적기다.
코드, 테스트, 문서, 패키징, 설치 동작, conformance 증거, release gate, 블로커,
사용자 대면 준비 상태가 변경되면 반드시 업데이트한다.
변경 사항이 없으면 최종 응답에서 스냅샷을 확인했으나 업데이트가 필요 없었음을 명시한다.

### Developer Agent 규칙

Developer agent(예: 표준 OpenCode assistant)가 이 코드베이스에서 작업할 때는
FlowDesk product workflow 규칙의 제약을 받지 않는다.
컴파일, 테스트, 검색 등 병렬 개발 작업에 raw `task` subagent, 표준 파일 편집 도구,
`bash` 명령을 자유롭게 사용할 수 있다.
아래 Safety Rules는 작성 중인 *product 코드*의 아키텍처와 동작을 설명하며,
개발 프로세스 자체에 대한 제약이 아니다.

---

## OpenCode 플러그인 개발 시

- **설계**: [docs/opencode/OPENCODE_DESIGN.md](docs/opencode/OPENCODE_DESIGN.md)
- **Safety Rules**: [docs/opencode/OPENCODE_SAFETY_RULES.md](docs/opencode/OPENCODE_SAFETY_RULES.md)
- **ADR**: [docs/adr/0001-opencode-plugin-first.md](docs/adr/0001-opencode-plugin-first.md)
- **진행 상태**: [docs/PROGRESS_SNAPSHOT.md](docs/PROGRESS_SNAPSHOT.md)

---

## Omnigent 통합 개발 시

- **설치/운영**: [docs/omnigent/OMNIGENT_SETUP.md](docs/omnigent/OMNIGENT_SETUP.md)
- **기본 정보**: [docs/omnigent/OMNIGENT_BASE_INFO.md](docs/omnigent/OMNIGENT_BASE_INFO.md)
- **설계**: [docs/omnigent/OMNIGENT_DESIGN.md](docs/omnigent/OMNIGENT_DESIGN.md)
- **Safety Rules**: [docs/omnigent/OMNIGENT_SAFETY_RULES.md](docs/omnigent/OMNIGENT_SAFETY_RULES.md)

---

## Identity and Paths

| 항목 | 값 |
|---|---|
| Project name | FlowDesk |
| Public name | FlowDesk for opencode |
| Repository slug | `flowdesk` |
| Plugin id | `flowdesk` |
| Package scope | `@flowdesk/*` |
| Project data root | `.flowdesk/` |

Legacy names such as DEX Conductor, `@dex-conductor/*`, and `.conductor/` are
background or migration references only.

---

## Background Docs

Files under `docs/background/` are non-normative. Do not implement production
behavior directly from them.

Use background docs only for historical context, research rationale, or migration
notes. If they conflict with normative docs, the normative docs win.

---

## Skills

Skills provide specialized instructions and workflows for specific tasks.
Use the skill tool to load a skill when a task matches its description.
