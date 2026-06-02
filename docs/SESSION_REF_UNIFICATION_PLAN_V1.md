# FlowDesk Session Ref 통합 리팩터 계획 V1

> **배경 (2026-06-02)**: 사이드바 "running 중 미표시" 버그의 근본 원인은,
> 하나의 세션 식별자가 **두 표현(raw OpenCode id `ses_...` vs FlowDesk wrapper `ses-...`)** 으로
> 시스템 전체에 공존하면서, 변환·역변환·비교가 여러 파일에 산재해 정규화가 누락된 것이다.
> 본 계획은 이 이중성을 **단일 헬퍼 모듈로 통합**하고 산재 지점을 교체한다.

---

## 1. 현재 구조의 사실관계 (조사 결과)

### 두 표현이 존재하는 이유 — 제거 불가
| 표현 | 형식 | 소비처 | 강제 근거 |
|------|------|--------|-----------|
| **raw id** | `ses_17f8...` | SDK `session.create({ parentID })` | OpenCode SDK가 raw id를 요구. wrapper를 주면 존재하지 않는 부모를 기다려 launch timeout |
| **wrapper ref** | `ses-<rawId>` (=`ses-ses_17f8...`) | 증거/사이드바 `parent_session_ref`, `child_session_ref` | **core 스키마 validator가 `refWithPrefix(..., ["ses-"])`로 `ses-` 접두사 강제** (lane-lifecycle-record.ts:125, runtime-lane-productization.ts:186, lane-heartbeat.ts:118 등) |

→ 두 표현은 **각각 정당한 계약**이라 한쪽으로 통일 불가. wrapper는 "raw id를 한 번 감싼 것"이라는 **불변식**만 보장하면 된다.

### 산재 지점 (전수 조사, 33개 매치 중 production 로직)
- **raw→wrapper 변환** (`ses-${rawId}`):
  - agent-task-runner.ts:122, 156
  - stall-recovery.ts:874, 1318
  - quick-reviewer-run.ts:228
  - event-hook-observer.ts:207
  - managed-dispatch-adapter.ts:4167 / stall-recovery.ts:1910 (조건부: 이미 `ses-`면 그대로)
- **wrapper→raw 역변환** (`.slice("ses-".length)`):
  - agent-task-runner.ts:875-876
  - stall-recovery.ts:893-894
  - runtime-reviewer-execution-bridge.ts:533-534
- **입력 검증** (raw 강제, `ses-` 거부):
  - agent-task-runner.ts:140-157 (`validateAgentTaskParentSessionId`)
- **양방향 variant 비교** (이미 부분 구현):
  - server.ts:2182-2183 (`ses_`↔`ses-` 교차 variant 생성)
- **사이드바 비교** (버그 지점, 이미 1차 수정함):
  - tui-subtask-activity.ts:109-128 (`sessionRefMatches` / `canonicalSessionCoreId`)

---

## 2. 통합 설계

### 2.1 단일 헬퍼 모듈 — `packages/core/src/session-ref.ts` (신규)

순수 함수만, 의존성 없음, 양 패키지에서 import:

```typescript
// raw OpenCode session id인지 (ses_ 로 시작, ses- wrapper 아님)
export function isRawOpenCodeSessionId(value: string): boolean;

// FlowDesk wrapper ref인지 (ses- 로 시작)
export function isFlowDeskSessionRef(value: string): boolean;

// raw id -> FlowDesk wrapper. 이미 wrapper면 그대로(이중 래핑 금지).
//   "ses_abc"      -> "ses-ses_abc"
//   "ses-ses_abc"  -> "ses-ses_abc" (idempotent)
export function toFlowDeskSessionRef(value: string): string;

// FlowDesk wrapper -> raw id. wrapper 레이어를 한 겹만 벗김.
//   "ses-ses_abc"  -> "ses_abc"
//   "ses_abc"      -> "ses_abc" (raw면 그대로)
export function toRawOpenCodeSessionId(value: string): string;

// 비교용 canonical core: 모든 ses- wrapper 레이어를 벗기되 raw ses_ 토큰은 보존.
//   "ses-ses_abc" / "ses_abc" / "ses-abc" -> 동일 core로 정규화
export function canonicalSessionCoreId(value: string): string;

// 두 ref가 (래핑 레이어 무관) 같은 세션을 가리키는가
export function sessionRefsMatch(a: string | undefined, b: string | undefined): boolean;

// 입력이 lane launch용 raw parent id로 유효한가 (검증 + 사유)
export function validateRawParentSessionId(value: string):
  | { ok: true; rawId: string; flowdeskRef: string }
  | { ok: false; redactedReason: string };
```

**불변식 (테스트로 고정)**
- `toFlowDeskSessionRef(toRawOpenCodeSessionId(x)) === toFlowDeskSessionRef(x)` (멱등 round-trip)
- `toFlowDeskSessionRef`는 절대 `ses-ses-...`(wrapper의 wrapper)를 만들지 않는다.
- `canonicalSessionCoreId`는 raw `ses_` 토큰을 절대 벗기지 않는다.
- 모든 wrapper 결과는 core 스키마 `refWithPrefix(["ses-"])`를 통과한다.

### 2.2 산재 지점 교체
- raw→wrapper 6+개 지점 → `toFlowDeskSessionRef()`
- wrapper→raw 3개 지점 → `toRawOpenCodeSessionId()`
- `validateAgentTaskParentSessionId` → `validateRawParentSessionId` 재사용 (거부 정책 유지: raw만 허용)
- server.ts:2182-2183 variant 생성 → `sessionRefsMatch()` 또는 canonical 비교로 대체
- tui `sessionRefMatches`/`canonicalSessionCoreId` → core 헬퍼로 위임(중복 제거)

### 2.3 사이드바 필터 수정 (이미 1차 적용, 확정)
- `sessionRefMatches`를 `canonicalSessionCoreId` 비교로 교체 (wrapper 레이어 무관 매칭).
- fail-closed 정책 유지(다른 세션 누수 금지). 단 canonical 매칭으로 정상 매칭 보장.

---

## 3. 슬라이스 (메인 직접, 순차)

- **Slice A — core `session-ref.ts` 헬퍼 + 단위 테스트** (신규, 무의존)
  - 위 함수 + 불변식 테스트. 기존 동작 변경 없음(순수 추가).
- **Slice B — tui 사이드바 필터를 core 헬퍼로 위임 + 회귀 테스트**
  - tui-subtask-activity.ts가 core `sessionRefsMatch` 사용. 이중 wrapper/raw/single 매칭 fixture.
- **Slice C — raw↔wrapper 변환 산재 지점 교체 (production)**
  - agent-task-runner / stall-recovery / quick-reviewer / event-hook / managed-dispatch / bridge.
  - 각 파일 교체 후 해당 테스트 통과 확인. 동작 동일성(특히 SDK parentID는 raw 유지) 보장.
- **Slice D — server.ts variant 비교 통합 + 전체 회귀 + 문서/스냅샷**
  - `npm test` (opencode-plugin + core), build, `git diff --check`, PROGRESS_SNAPSHOT.

---

## 4. 리스크 / 비범위

- **스키마 계약 불변**: wrapper의 `ses-` 접두사 요구는 그대로 둔다(스키마 변경 아님).
- **SDK 호출 불변**: `session.create({ parentID })`에는 계속 raw id만 전달.
- **인플라이트 증거 호환**: 기존 `ses-ses_...` 레코드는 canonical 비교로 그대로 매칭되므로 마이그레이션 불요.
- **비범위**: stall-recovery V11.1 이벤트 전환과 독립. 단 두 작업 모두 `parent_session_ref`를 만지므로 충돌 없게 Slice 순서 분리.
- **안전 경계**: dispatch/fallback/hard-chat 권한 변화 없음. 순수 식별자 정규화 리팩터.
