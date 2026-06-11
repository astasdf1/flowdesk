# FlowDesk Phase 8 완성플랜

> 작성일: 2026-06-10
> 기준 문서: `docs/AUDIT_GITHUB_CONNECTOR_PHASE8.md`, `docs/IMPLEMENTATION_ROADMAP.md`
> 상태: advisory, non-authorizing. Guard 승인 / dispatch / fallback / write 권한 신규 부여 없음.

---

## 1. Phase 8 완성 목표 및 현황 요약

Phase 8 목표는 Opt-In Federated Score Registry 완성이다. 핵심은 `federated-registry-connector.ts`의 `publishToGitHubV1`을 실제 GitHub POST가 가능한 수준으로 강화하되, **9개 AND-gate 조건을 모두 충족한 per-attempt에서만** 실행되도록 잠그는 것이다.

2026-06-10 기준 선행 작업 완료 상태:
- model-availability SQLite DB 도입 및 merge 모드 구현 완료
- provider-catalog.json GitHub 동기화 설계 문서화 완료
- `publishToGitHubV1` advisory-only 구현 존재 (`PublishToGitHubInputV1`에 optional 필드 3종 이미 선언됨)
- `FlowDeskCompactionEvidenceV1` 스키마 이미 존재 (`packages/core/src/compaction-runner.ts:19`)
- refresh 스크립트 provider 전체 확장 및 분류 정확도 개선 완료

**핵심 수정 사항 (AUDIT 문서 대비):**
- Slice 8b: `FlowDeskCompactionEvidenceV1`은 신규 정의가 아닌 **기존 스키마 필드 additive 추가**로 처리
- Slice 8a–8c: 새 필드 추가가 아닌 **validator 강화 + AND-gate conformance 테스트 잠금**이 핵심
- **R-NEW-1 신규 위험**: connector lock 경로(`<cwd>/.flowdesk/locks/compaction.lock`)와 compaction-runner lock 경로(`<stateRoot>/.locks/agent-task-progress-compaction.lock`) 불일치 → Slice 8b에서 반드시 통합

---

## 2. 슬라이스별 상세 계획

### Slice 8a — Burn-Rate Gate

**목적:** 실제 GitHub POST 전 surplus usage gate 소비를 필수화하여 quota 초과 publish 차단.

**구현 대상 파일:**
- `packages/opencode-plugin/src/federated-registry-connector.ts`
- `packages/opencode-plugin/src/federated-registry-connector.test.ts`

**핵심 변경 사항 (additive 원칙):**
- `preliminaryBlockLabels` 배열에 `surplus-usage-gate-missing` 조건 추가
- `surplusUsageGateRef`가 있을 때 `FlowDeskSurplusUsageGateV1` (`gates.ts:501`) 레코드 reload → `gate_verdict === "allow"` AND `snapshot_fresh === true` 검증
- 실패 시 `blocked_labels: ["surplus-usage-gate-stale"]` 또는 `["surplus-usage-gate-verdict-deny"]` 반환
- 기존 `allowActualRemoteWrite + connectorGateSatisfied` 게이트는 변경하지 않고 AND-gate로 확장

**필수 테스트:**
- `test_publish_consumes_fresh_surplus_usage_gate`
- `test_surplus_gate_stale_blocks_publish`
- `test_surplus_gate_verdict_deny_blocks_publish`

**선결조건:** 없음 (8b와 독립, 병렬 가능)

**담당 에이전트:** `flowdesk-code-backend` / Claude

---

### Slice 8b — Compaction Script

**목적:** `.flowdesk/` 레저 레코드 안전 정리 + R-NEW-1 lock 경로 불일치 해결.

**구현 대상 파일:**
- `packages/core/src/compaction-runner.ts` (기존 스키마에 필드 추가)
- `packages/core/src/schema-artifacts.ts` (ledger retention 정책 등록 확인)
- `packages/core/src/schema-registry.ts` (등록 확인)
- `packages/opencode-plugin/src/federated-registry-connector.ts` (lock 경로 통합)
- `scripts/compact-flowdesk-ledger.mjs` (신규 스크립트)
- `packages/opencode-plugin/src/federated-registry-connector.test.ts`

**핵심 변경 사항:**

1. **R-NEW-1 lock 경로 통합**: connector의 lock 경로를 `<stateRoot>/.locks/compaction.lock`으로 단일화하거나, 두 경로 모두 체크하도록 수정
2. **`FlowDeskCompactionEvidenceV1` 필드 보완**: 기존 스키마에 누락 필드 additive 추가
   - `records_preserved_due_to_pending_gate_promotion`
   - `lock_path`
   - `records_quarantined`
3. **컴팩션 스크립트 구현**:
   - `node:fs` 직접 사용, `child_process.exec` 금지
   - `--root` 인수: `path.resolve()` + `fs.realpath()` + 경로 traversal 거부
   - `.git`, `node_modules` 하드 deny 목록
   - `flowdesk.ledger_retention_policy.v1` reload → TTL 소스 단일화, CLI args는 narrowing만 허용
   - 독점 lock 획득 후 스캔, 실패 레코드 → `.flowdesk/quarantine/` 이동
   - `pending_gate_promotion` 레코드 무조건 보존
   - 단조 증가 `compactionRunId` 기록

**필수 테스트:**
- `test_compaction_refuses_pending_gate_promotion_records`
- `test_compaction_path_traversal_rejected` (parameterized: `../`, symlink, absolute 외부 경로)
- `test_compaction_lock_held_blocks_publish`
- `test_compaction_lock_path_unified` (R-NEW-1 검증)
- `test_compaction_quarantines_malformed_records`
- `test_compaction_ttl_from_policy_not_cli`

**선결조건:** 없음 (8a와 독립, 병렬 가능)

**담당 에이전트:** `flowdesk-code-backend` / Claude

---

### Slice 8c — productionPublish Flag AND-Gate 배선

**목적:** 실제 GitHub POST를 9개 AND-gate 조건으로 잠금.

**구현 대상 파일:**
- `packages/opencode-plugin/src/federated-registry-connector.ts`
- `packages/core/src/schema-artifacts.ts` (`FlowDeskGitHubConnectorProductionPublishFlagV1` 등록)
- `packages/core/src/schema-registry.ts`
- `packages/opencode-plugin/src/federated-registry-connector.test.ts`

**신규 스키마:**
```typescript
// FlowDeskGitHubConnectorProductionPublishFlagV1
{
  schema_version: "flowdesk.github_connector_production_publish_flag.v1",
  state: "disabled" | "enabled",  // 기본값: "disabled"
  surplus_usage_gate_ref: string,
  minimization_policy_ref: string,
  guard_approval_ref: string,
  attempt_id: string,
  // 표준 authority block:
  advisory_only: true,
  non_authorizing: true,
  remote_write_authority_enabled: false,
  dispatch_authority_enabled: false,
  write_authority_enabled: false,
}
```

**AND-gate 9개 조건 (모두 false이면 `publicationState: "blocked"`):**
```
1. allowActualRemoteWrite === true
2. connectorGateSatisfied === true
3. productionPublishFlag.state === "enabled"
4. surplusUsageGate.gate_verdict === "allow" AND .snapshot_fresh === true
5. minimizationPolicy.advisory_only === true AND .k_anonymity_threshold >= 10
6. guardApprovalRef bound to attemptId
7. ledgerIdempotencyRef unique per (dryRunResultId, target tuple)
8. no compaction lock held
9. token discovered AND contentMarkdown passes forbidden-marker scan
```

**핵심 변경 사항 (additive):**
- `PublishToGitHubInputV1`에 optional 필드 추가:
  - `productionPublishFlagRef?: string`
  - `surplusUsageGateRef?: string` (8a에서 추가)
  - `minimizationPolicyRef?: string`
- `preliminaryBlockLabels` 확장 (AND-gate, 기존 조건 교체 금지)
- `validateContentMarkdownAgainstForbiddenMarkers()` 헬퍼 추가
- **프로덕션 fetch 보안**: `productionPublishFlag.state === "enabled"`이면 `fetchImpl` 오버라이드 무시 → `globalThis.fetch` 강제
- env 단독으로 `state: "enabled"` 전환 불가 — Guard 승인 ref 필수

**필수 테스트 (AUDIT Section 2.6 전체):**
- `test_token_not_in_errors_for_all_failure_modes` (11개 failure mode parameterized)
- `test_token_not_in_evidence_when_serialized`
- `test_authorization_header_only_present_when_remote_write_enabled`
- `test_fetch_not_called_when_preliminary_block_labels_present`
- `test_authority_block_invariants_for_all_branches` (6개 return branch 전부)
- `test_productionPublish_flag_and_gates_with_existing_preconditions` (9개 조건 중 1개 제거 시 blocked)
- `test_mock_fetchImpl_seam_works_in_test_and_is_disabled_in_production`
- `test_content_markdown_forbidden_marker_rejected`
- `test_content_markdown_requires_minimization_policy_ref`
- `test_redactedReason_is_fixed_enum`
- `test_rate_limit_403_429_classified_as_rate_limited`

**선결조건:** Slice 8a + 8b 스키마 완료 필수

**담당 에이전트:** `flowdesk-code-backend` / Claude

---

### Slice 8d — Doctor Surface

**목적:** Phase 8 상태를 `/flowdesk-doctor`에 노출.

**구현 대상 파일:**
- `packages/opencode-plugin/src/command-handlers.ts`
- `packages/opencode-plugin/src/bootstrap-installer.ts`
- `packages/opencode-plugin/src/command-handlers.test.ts`

**핵심 변경 사항:**
- GitHub connector 진단 섹션 추가:
  - `productionPublish` 플래그 상태: `"disabled"` / `"enabled"` / `"unknown"` (absent 불허)
  - `githubTokenAvailable`, `authSource`, `capabilityState` (redacted ref labels만, raw token 금지)
  - 최신 `FlowDeskCompactionEvidenceV1` 요약 (run id, completed_at, counts)
  - `FlowDeskSurplusUsageGateV1` freshness
  - `FlowDeskFederatedDataMinimizationPolicyV1` freshness
  - stale/absent 시 `safe_next_actions: ["/flowdesk-doctor", "/flowdesk-usage", "/flowdesk-status"]`
- `--probe-github-scope` 플래그 (기본 off): `GET /user` probe → observed token scope 노출, 자동 doctor 실행 시 비활성

**필수 테스트:**
- `test_doctor_reports_production_publish_flag_state`
- `test_doctor_reports_github_token_available_redacted`
- `test_doctor_reports_compaction_evidence_summary`
- `test_doctor_reports_gate_freshness`

**선결조건:** Slice 8a + 8b + 8c 완료

**담당 에이전트:** `flowdesk-code-backend` / Claude

---

### Slice 8e — model-availability DB GitHub 동기화

**목적:** 번들 스냅샷 → GitHub release asset 자동 갱신 (merge 방식).

**구현 대상 파일:**
- `packages/opencode-plugin/src/federated-registry-connector.ts` (`fetchModelAvailabilityDbFromGitHubV1()` 추가)
- `packages/opencode-plugin/src/server.ts` (`flowdesk_model_availability_refresh` 툴 또는 doctor 훅)
- `scripts/export-model-availability-db.mjs` (`--publish` 플래그 추가)
- `packages/opencode-plugin/src/federated-registry-connector.test.ts`

**핵심 변경 사항:**
- `fetchModelAvailabilityDbFromGitHubV1()`: productionPublish 게이트 패턴 동일하게 적용
  - sha256 체크섬 검증 (릴리즈 메타 비교)
  - `observed_at` 비교로 다운그레이드 방지
  - tmpfile → rename 원자적 교체
  - `allowActualRemoteRead` 게이트 플래그
- `--publish` 플래그: GitHub release asset에 `.db` 업로드, Phase 8c `productionPublish` 게이트 적용
- 바이너리이므로 `FORBIDDEN_RAW_PAYLOAD_MARKERS` 검사 대신 sha256 검증 필수
- durable evidence: `model_availability_db_refresh` evidenceClass 신규 추가

**선결조건:** Slice 8c productionPublish 게이트 패턴 완료 권장 (병렬 가능하나 의존성 주의)

**담당 에이전트:** `flowdesk-code-backend` / Claude

---

### Slice 8f — provider-catalog.json GitHub 동기화

**목적:** `model-selection-engine.ts` 하드코딩 → catalog 동적 로드, 코드 수정 없이 새 provider 추가 가능.

**구현 대상 파일:**
- `packages/opencode-plugin/data/provider-catalog.json` (번들 fallback 신규 생성)
- `packages/opencode-plugin/src/federated-registry-connector.ts` (`fetchProviderCatalogFromGitHubV1()` 추가)
- `packages/opencode-plugin/src/model-selection-engine.ts` (하드코딩 상수 → catalog 로드)
- `packages/opencode-plugin/src/managed-dispatch-adapter.ts` (`opencodeRuntimeProviderIDForFlowDeskProviderFamily()` catalog 교체)
- `packages/opencode-plugin/src/agent-task-runner.ts` (라인 817 `rootDir` 인수 추가 확인)
- `.opencode/agent/<family>-*.md` (새 provider 추가 시 에이전트 프로파일)

**핵심 변경 사항:**
- `provider-catalog.json` 스키마: `schema_version`, `families[]`, `tiers{}`, `roles{}`
- `model-selection-engine.ts` 모듈 초기화 시 1회 동기 로드, 메모리 캐시, 번들 fallback 필수
- 보안 검증:
  - `opencode_provider_id`: 허용 값 whitelist (`anthropic`, `openai`, `google`, `opencode` 등 고정 enum)
  - `agent_name`: `^[a-z][a-z0-9-]*$` 패턴 검증 (경로 traversal 방지)
  - `fallback_chains`: `provider/model` 형식 강제
  - `updated_at` 비교로 다운그레이드 방지

**필수 동기화 4개 지점 (누락 시 런타임 오류):**
1. `managed-dispatch-adapter.ts` `opencodeRuntimeProviderIDForFlowDeskProviderFamily()` → catalog `opencode_provider_id` 교체
2. `agent-task-runner.ts:817` `resolveOpenCodeRuntimeLaunchModelBindingV1()` 호출부 `rootDir` 추가
3. `.opencode/agent/<family>-*.md` 에이전트 프로파일 파일
4. `packages/opencode-plugin/data/provider-catalog.json` 번들 fallback

**선결조건:** Slice 8c 완료 권장 / 리팩터는 `flowdesk-migration-refactor` 에이전트 별도 위임

**담당 에이전트:** `flowdesk-migration-refactor` (리팩터) + `flowdesk-code-backend` (커넥터) / Claude

---

## 3. 슬라이스 실행 순서 및 의존성 그래프

```
Day 1–2:
  Slice 8a (Burn-Rate Gate) ──┐
                              ├──→ Slice 8c (AND-Gate, Day 3)
  Slice 8b (Compaction)     ──┘         │
    └─ R-NEW-1 lock 통합 필수            │
                                        ↓
                              Day 4 병렬:
                              ├── Slice 8d (Doctor Surface)
                              ├── Slice 8e (Model DB 동기화)
                              └── Slice 8f (provider-catalog 동기화)
                                    └─ migration-refactor 선행 필요
```

**병렬 가능:** 8a ↔ 8b, 8d ↔ 8e ↔ 8f
**순차 필수:** 8a+8b → 8c → 8d/8e/8f

---

## 4. 전체 Exit Criteria 검증 매트릭스

| # | Exit Criteria | 담당 Slice | 검증 방법 |
|---|---|---|---|
| EC1 | 공유 기본값 off — silence/preselection/env로 활성화 불가 | 8c | `productionPublishFlag.state` 기본값 `"disabled"` 테스트 |
| EC2 | 업로드 페이로드 — raw prompts/secrets 비포함 | 8c | `test_token_not_in_errors_for_all_failure_modes` (11-mode) |
| EC3 | 커뮤니티 스냅샷 — 적격 후보 ranking에만 영향, dispatch/Guard 우회 불가 | 8c | authority block invariant 테스트 (6개 branch) |
| EC4 | Registry poisoning 방어 — 저샘플/anomalous/오래된 제출 quarantine | 8b | `test_compaction_quarantines_malformed_records` |
| EC5 | Self-hosted + central registry 동일 스키마/안전게이트 | 8c | `test_productionPublish_flag_and_gates_with_existing_preconditions` |
| EC6 | AUDIT Section 2.6 conformance 테스트 전체 통과 | 8a+8b+8c | 15개 named 테스트 전부 green |
| EC7 | lock 경로 통합 (R-NEW-1) | 8b | `test_compaction_lock_path_unified` |
| EC8 | Doctor surface Phase 8 상태 노출 | 8d | `test_doctor_reports_*` 4개 |
| EC9 | model-availability DB 원격 갱신 (sha256 + 다운그레이드 방지) | 8e | fetchModelAvailabilityDb 테스트 |
| EC10 | provider-catalog 동적 로드 (whitelist 검증) | 8f | catalog 보안 검증 테스트 |

---

## 5. 위협모델 잔여 위험 체크리스트

감사문서 기준 미완료 항목 (코드 PR 전 반드시 처리):

### BLOCKER 항목
- [ ] **T1.1**: `fetchImpl` override — 8c에서 프로덕션 시 `globalThis.fetch` 강제 (test seam 계약 문서화)
- [ ] **T1.2**: `errors[]`에 token interpolation 없음 — lint/test 추가
- [ ] **T1.3**: `redactedReason` 고정 enum 잠금 — validator에서 free-form string 거부
- [ ] **T1.4**: non-JSON response 200자 텍스트 미노출 — 회귀 테스트 추가
- [ ] **T1.5**: `tokenRef` 형식 검증 (`^github-token-ref-(missing|env_github_token|env_flowdesk_oauth_token)$`)
- [ ] **T2.1**: `productionPublish` AND-gate — 기존 조건 교체 금지, 반드시 확장
- [ ] **T2.3**: `authority.remoteWriteAuthorityEnabledInRecord: false` — `state: "posted"` 포함 모든 branch
- [ ] **T3.1**: 컴팩션 시 `pending_gate_promotion` 레코드 보존
- [ ] **T3.2**: 컴팩션 독점 lock — in-flight publish와 race 방지
- [ ] **T3.3**: TTL 소스 = `flowdesk.ledger_retention_policy.v1` 전용, CLI args narrowing만
- [ ] **T3.4**: 컴팩션 malformed record → quarantine, 삭제 금지
- [ ] **T4.1–T4.4**: 경로 traversal, symlink escape, shell metachar, `.git` deny
- [ ] **T5.3**: GitHub publish 전 `FlowDeskSurplusUsageGateV1` fresh 확인
- [ ] **R-NEW-1**: lock 경로 불일치 통합

### GUARDED 항목 (Doctor surface 또는 후속 Phase)
- [ ] **T1.6**: 호출자가 `input.env`를 evidence에 저장하지 않도록 문서화
- [ ] **T2.2**: `ledgerIdempotencyRef` unique per tuple 검증
- [ ] **T2.4**: `pending_gate_promotion` → `published` 전환 시 later-gate record 필수
- [ ] **T5.1**: Doctor surface에서 required GitHub scope vs. observed scope 노출 (opt-in probe)
- [ ] **T5.2**: 403/429 → `redactedReason: "github-api-rate-limited"` + `retryAfterSeconds` 필드
- [ ] **T5.4**: `public_repo`-scoped token + private repo → soft warning

---

## 6. PROGRESS_SNAPSHOT.md 업데이트 지침

### 업데이트 트리거 조건
- 코드/테스트 변경이 발생하는 각 Slice 완료 시
- 본 플랜 문서(`PHASE8_COMPLETION_PLAN.md`) 저장 시 1줄 항목 추가

### 추가할 항목 형식
```
- **Phase 8 완성플랜 문서화** (2026-06-10): `docs/PHASE8_COMPLETION_PLAN.md` 작성.
  6개 슬라이스(8a–8f), 의존성 그래프, Exit Criteria 매트릭스, 위협모델 체크리스트 포함.
  R-NEW-1(lock 경로 불일치) 신규 위험 식별. 코드 변경 없음.
```

### Slice별 Snapshot 업데이트 포인트
| Slice | 업데이트 내용 |
|---|---|
| 8a 완료 | burn-rate gate validator 강화, 관련 테스트 통과 수 |
| 8b 완료 | compaction 스크립트 구현, R-NEW-1 해결, 테스트 통과 수 |
| 8c 완료 | AND-gate 9개 조건 잠금, conformance 테스트 15개 통과 |
| 8d 완료 | doctor surface Phase 8 섹션 추가 |
| 8e 완료 | model-availability DB 원격 갱신 구현 |
| 8f 완료 | provider-catalog 동적 로드, 하드코딩 제거 |

---

*Advisory authority: `advisory_only: true`, `non_authorizing: true`, `dispatch_authority_enabled: false`, `approval_authority_enabled: false`, `remote_write_authority_enabled: false`, `write_authority_enabled: false`*
