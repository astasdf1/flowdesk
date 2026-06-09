# Phase 8 — GitHub Federated Registry Connector: Threat Model & Audit Checklist

Status: advisory, non-authorizing. Gate for code PRs 8a (burn-rate), 8b (compaction),
8c (productionPublish flag wiring), and 8d (doctor surface).

Subject of audit:
- `packages/opencode-plugin/src/federated-registry-connector.ts` (lines 1–403)
- `packages/core/src/operational-intelligence/gates.ts` (lines 501–535,
  `FlowDeskSurplusUsageGateV1`)
- Cross-refs: `FlowDeskFederatedDataMinimizationPolicyV1`
  (`packages/core/src/operational-intelligence/federated.ts` 852–879),
  `FORBIDDEN_RAW_PAYLOAD_MARKERS` (`packages/core/src/release1-contracts.ts` 11–39)

This audit assumes the connector is already deployed in Release 1 as an advisory
surface and that `allowActualRemoteWrite` + `connectorGateSatisfied` together
already gate the only network side effect. We are auditing residual risks, not
proposing a redesign. No breaking changes to the published API contract are
recommended.

Reviewer verdict cross-reference:
- Security verdict (task-mq5i8xf4): items F2.1–F2.5
- Architecture verdict: Item 2 (productionPublish flag must AND-gate, not
  replace, existing preconditions)
- Implementation verdict: GitHub-flag testability via injectable `fetchImpl`

---

## 1. Threat Model

### 1.1 OAuth token leakage paths (F2.2 deep-dive)

Surfaces where a token from `GITHUB_TOKEN` or `FLOWDESK_GITHUB_OAUTH_TOKEN`
(see `tokenFromGitHubConnectorEnv` at lines 197–202) could leak:

| # | Path | Risk | Current state | Required mitigation |
|---|------|------|---------------|----------------------|
| T1.1 | `Authorization: Bearer <token>` header in `fetchImpl` call (line 338) is observable to a malicious or instrumented `fetchImpl` override | High in test/dev mode where the override is injectable | Header is built unconditionally and passed to caller-injected fetch | `fetchImpl` injection MUST be restricted to test contexts; production code path MUST go through `globalThis.fetch` only when `productionPublish` flag (Phase 8c) is true |
| T1.2 | `errors[]` array surfaced from `publishToGitHubV1` could echo token if a future change interpolates `token` into error strings | Latent | Currently only emits `"github_token_missing"` and `github_api_status_<n>`; no token interpolation | Add lint/test asserting `errors` never contains any of `FORBIDDEN_RAW_PAYLOAD_MARKERS` (release1-contracts.ts 11–39), and never contains the substring of any env value listed in `GITHUB_TOKEN`, `FLOWDESK_GITHUB_OAUTH_TOKEN` |
| T1.3 | `redactedReason` in `GitHubPublicationRemoteWriteSummaryV1` could be widened to include API response detail | Latent | Today only fixed labels (`github-api-call-failed`, `github-fetch-unavailable`, `github-api-call-threw`, `connector-gate-not-satisfied`, etc.) | Lock `redactedReason` to an enum/union of fixed labels; reject free-form strings in validator (new test in Section 6) |
| T1.4 | `payload.message` fallback at line 347 slices up to 200 chars from `response.text()` on non-JSON responses — GitHub error pages can echo headers or token in some misconfigurations | Medium | Bounded to 200 chars and confined to `payload.message`, not surfaced in `errors` or `redactedReason` | The 200-char text is currently discarded (only `extractGitHubHtmlUrlV1(payload)` is read on success, and `payload.message` is never surfaced on failure). Add a regression test that the failure path returns ONLY `github-api-call-failed` + statusCode and never the payload text |
| T1.5 | `tokenRef` field in `buildGitHubOAuthArchitectureDescriptorV1` (line 109) is a structural label only (`github-token-ref-env_github_token`), not the raw token | Acceptable | Already a ref label, never the raw value | Add validator: `tokenRef` MUST match `^github-token-ref-(missing\|env_github_token\|env_flowdesk_oauth_token)$` |
| T1.6 | Process env may be copied into evidence by an unrelated logger that observes `input.env` | Out of connector scope but relevant | `input.env` is passed by callers | Document that callers MUST NOT persist `input.env` and MUST NOT include `process.env` in `flowdesk.*` evidence; cross-check by validator in Section 6 |

### 1.2 Remote-write authority escalation

The connector is advisory by contract; the only escalation vector is the
two-key combination `allowActualRemoteWrite === true && connectorGateSatisfied
=== true` at lines 285–291.

| # | Path | Risk | Required mitigation |
|---|------|------|---------------------| 
| T2.1 | A future caller could synthesize `connectorGateSatisfied=true` without consuming a real later-gate result | High if not bounded | Phase 8c `productionPublish` flag MUST AND-gate, not replace, both keys. New required precondition: `productionPublish === true` AND `connectorGateSatisfied === true` AND `allowActualRemoteWrite === true` AND `guardApprovalRef` was minted for this specific `attemptId` |
| T2.2 | `dryRunResult` reuse — same `dry_run_result_id` could be replayed against multiple targets | Medium | Validator already requires `dry_run_state === "dry_run_recorded"` (line 278). Add: `ledgerIdempotencyRef` MUST be unique per `(dry_run_result_id, target.owner, target.repo, target.issueNumber or target.title-hash)` tuple; enforced via ledger reservation in Phase 8c |
| T2.3 | `authority` block in `PublishToGitHubResultV1` claims `remoteWriteAuthorityEnabledInRecord: false` even on `state: "posted"` (line 379) | Acceptable structural contract | Document explicitly: a successful POST is a *transient side effect*, not authority. Add a typed invariant test that `authority.remoteWriteAuthorityEnabledInRecord` is `false` for ALL return branches, including `state: "posted"` |
| T2.4 | `publicationState: "pending_gate_promotion"` (line 370) on success could be misread by downstream as "approved" | Medium | Downstream consumers MUST treat `pending_gate_promotion` as "side effect occurred, authority not granted". Add an `assert` in the synthesis path that `pending_gate_promotion` never promotes to `published` without a later-gate record |

### 1.3 Compaction audit-trail breakage (Phase 8b scope)

The compaction script is referenced but not yet implemented. The connector's
publication ledger creates `publication-result-<dry_run_result_id>` records
(line 247) that compaction must preserve.

| # | Path | Risk | Required mitigation |
|---|------|------|---------------------| 
| T3.1 | Compaction deletes `publication-result-*` records that still have an outstanding `pending_gate_promotion` state | High — destroys evidence of a real network side effect | Compaction MUST refuse to delete any record whose `publicationState === "pending_gate_promotion"`, regardless of age. Source-of-truth TTL lives in `flowdesk.ledger_retention_policy.v1` (`schema-artifacts.ts` 161; `routing-advisory.ts` 18–113) |
| T3.2 | Compaction races with an in-flight `publishToGitHubV1` call and removes the dry-run record before the publication record references it | High | Compaction MUST acquire an exclusive lock (e.g., `flock` on `.flowdesk/locks/compaction.lock`) before scanning; `publishToGitHubV1` MUST be a no-op (return `blocked_labels: ["compaction-lock-held"]`) when the lock exists |
| T3.3 | Compaction script reads TTL from CLI arg instead of policy file → drift between configured policy and actual deletion | High | TTL source-of-truth MUST be `flowdesk.ledger_retention_policy.v1` records reloaded at script start; CLI args may NARROW (filter) but never WIDEN the deletion set |
| T3.4 | Compaction silently fails-open on malformed records | High | Fail-closed: any record that fails `validate*` MUST be quarantined to `.flowdesk/quarantine/`, never deleted |
| T3.5 | Two concurrent compaction runs delete overlapping records | Medium | Exclusive lock per T3.2; also serialize via `compaction-evidence` schema (Section 7) recording a monotonically increasing run id |

### 1.4 Path-traversal in cleanup / compaction script

The connector itself does not write to disk, but the Phase 8b compaction
script will. Threats apply to that future script.

| # | Path | Risk | Required mitigation |
|---|------|------|---------------------| 
| T4.1 | Compaction script accepts a `--root` CLI arg and resolves it without anchoring to repo root | High | Resolve `--root` via `path.resolve()` and reject if not a descendant of `process.cwd()` or `FLOWDESK_WORKFLOW_STATE_ROOT` (`release1-contracts.ts` 7). Reject any path containing `..` after normalization |
| T4.2 | Symlinked subpaths inside `.flowdesk/` escape the root | High | Use `fs.realpath()` on each entry and reject if `realpath` is outside the resolved root |
| T4.3 | Filenames containing newlines or shell metacharacters are passed to a shell | High | Compaction MUST use `node:fs` directly, never `child_process.exec` with interpolated paths. If a shell is unavoidable, use `execFile` with argument array, never `exec` |
| T4.4 | Glob pattern from CLI matches `.git/` or other repo metadata | High | Hard-deny list: `.git`, `node_modules`, any path not matching `^\.flowdesk/(workflows\|sessions)/` |

### 1.5 GitHub API rate-limit + auth scope collisions

| # | Path | Risk | Required mitigation |
|---|------|------|---------------------| 
| T5.1 | `GITHUB_TOKEN` issued for CI (limited scope) is reused for issue/PR comment writes (`repo` scope required) | Medium | Discovery (line 47–52) only flags presence, not scope. Phase 8d doctor surface MUST surface `requiredGithubScopes` (line 108) vs. observed token scopes (from a `GET /user` probe), but the probe itself MUST NOT be performed automatically — only on explicit `/flowdesk-doctor` invocation |
| T5.2 | Rate-limit (primary or secondary) responses (403/429) classified as "github-api-call-failed" lose the retry-after hint | Medium | On 403/429, surface `redactedReason: "github-api-rate-limited"` (new fixed label) and include `statusCode`. Do NOT echo `Retry-After` header value in error strings to avoid passive fingerprinting; surface it only as a numeric `retryAfterSeconds` field in `remoteWrite` (new optional field) |
| T5.3 | Burn-rate gate (Phase 8a) and GitHub publication share quota assumptions, but the connector does not consult `FlowDeskSurplusUsageGateV1` | High — could exhaust quota during a fanout | Phase 8a MUST require a fresh `FlowDeskSurplusUsageGateV1` decision with `gate_verdict === "allow"` AND `snapshot_fresh === true` AND `alert_level_safe === true` before any `allowActualRemoteWrite=true` path is taken. The gate decision ref MUST be passed into `publishToGitHubV1` as a new required field (Phase 8c — additive, non-breaking, defaulted to a blocking sentinel) |
| T5.4 | A `public_repo`-scoped token attempting to comment on a private repo gets a misleading 404 | Low | Phase 8d doctor surface MUST display the chosen scope (`repo` vs `public_repo`) prominently |

---

## 2. Audit Checklist (8 sections)

Each item is a hard precondition for merging Phase 8a–8d. Items marked
**[BLOCKER]** must fail-closed; items marked **[GUARDED]** may be deferred to
the doctor surface or a later gate.

### 2.1 Token lifecycle

- [ ] **[BLOCKER]** Discovery (`discoverGitHubConnectorV1`, line 41–75) MUST
  NOT log, echo, or persist the raw token value. Add unit test:
  `discoverGitHubConnectorV1({ env: { GITHUB_TOKEN: "[GITHUB_TOKEN]" } })`
  result MUST NOT contain the literal `[GITHUB_TOKEN]` in ANY string field
  when serialized via `JSON.stringify()`.
- [ ] **[BLOCKER]** `tokenFromGitHubConnectorEnv` (line 197–202) MUST NOT log.
  Add a static-analysis check (grep test) that no `console.*`, `logger.*`,
  `audit.*`, or `evidence.*` call site references `GITHUB_TOKEN` or
  `FLOWDESK_GITHUB_OAUTH_TOKEN` by name.
- [ ] **[BLOCKER]** Telemetry: any `flowdesk.*` evidence record produced by
  the connector MUST pass `validateNoForbiddenRawPayloads` against
  `FORBIDDEN_RAW_PAYLOAD_MARKERS` (`release1-contracts.ts` 11–39, validated
  via `validators.ts` 258). Add a connector-specific test that all returned
  `PublishToGitHubResultV1` fields, when stringified, contain none of:
  `token`, `secret`, `credential`, `provider_payload`, `raw_body`,
  `raw_prompt`.
- [ ] **[BLOCKER]** Error redaction coverage means concretely: for the test
  matrix `{ token in env, no token, malformed token, network error, 401,
  403, 404, 422, 429, 500, non-JSON response }`, the union of
  `result.errors`, `result.remoteWrite.redactedReason`, and the JSON
  serialization of `result.publicationResult` MUST contain zero substring
  matches of the input token. Encode this as a parameterized test in
  `federated-registry-connector.test.ts`.
- [ ] **[GUARDED]** Token lifetime: the connector does NOT cache the token
  across calls (verified: `tokenFromGitHubConnectorEnv` reads on each
  invocation). Add a regression test that two sequential calls with
  different `env` get different `tokenRef` labels.

### 2.2 Authorization header handling

- [ ] **[BLOCKER]** `Authorization: Bearer [TOKEN]` is constructed at line
  338 only inside the `try` block, only after `preliminaryBlockLabels`
  passes. Add an invariant test: when `allowActualRemoteWrite=false`,
  `fetchImpl` is NEVER invoked (assert with a spy that throws if called).
- [ ] **[BLOCKER]** Header set is fixed: `Accept`, `Authorization`,
  `Content-Type`, `User-Agent`, `X-GitHub-Api-Version`. No caller-injected
  headers. Add a test that the `headers` object passed to `fetchImpl` has
  exactly those 5 keys.
- [ ] **[BLOCKER]** `User-Agent` is the literal string
  `"flowdesk-opencode-plugin"` (line 340) — never includes a workflow id,
  session id, or any user-derived value.
- [ ] **[GUARDED]** Consider adding an `X-Request-ID` header derived from
  `ledgerIdempotencyRef` for GitHub-side deduplication, but ONLY after
  validating that `ledgerIdempotencyRef` contains no user content
  (currently a structural ref, so safe — but future-proof with a validator).

### 2.3 `contentMarkdown` boundary and redaction policy

- [ ] **[BLOCKER]** `contentMarkdown` is bounded to ≤ 60,000 chars (line
  280) and non-empty (line 279). Confirmed present.
- [ ] **[BLOCKER]** `contentMarkdown` MUST be pre-validated by the caller
  against `FlowDeskFederatedDataMinimizationPolicyV1` (`federated.ts`
  852–879). Phase 8c MUST add an explicit new required input field
  `minimizationPolicyRef: string` to `PublishToGitHubInputV1`, with a
  validator that the referenced policy has `advisory_only: true`,
  `non_authorizing: true`, `strip_workflow_id: true`, `strip_proposal_id:
  true`, `strip_task_descriptions: true`, `strip_model_names: true`,
  `publish_dimension_scores_as_buckets: true`, `score_bucket_size: 25`,
  `publish_timestamp_resolution: "day"`, `k_anonymity_threshold >= 10`.
- [ ] **[BLOCKER]** `contentMarkdown` MUST itself pass
  `validateNoForbiddenRawPayloads`-style scanning against
  `FORBIDDEN_RAW_PAYLOAD_MARKERS`. Add a new helper
  `validateContentMarkdownAgainstForbiddenMarkers(contentMarkdown)` and
  call it in the connector before line 282. Reject with
  `blocked_labels: ["content-markdown-contains-forbidden-marker"]`.
- [ ] **[BLOCKER]** No interpolation of `target.owner`, `target.repo`,
  `target.title`, or `target.issueNumber` into `contentMarkdown` by the
  connector. The connector treats `contentMarkdown` as opaque (confirmed
  at line 223 and 228).
- [ ] **[GUARDED]** `target.title` is bounded to ≤ 256 chars (line 213)
  but not redaction-checked. Add the same forbidden-marker scan to
  `target.title` for `github_issue` kind.

### 2.4 OAuth scope minimization

- [ ] **[BLOCKER]** `requiredGithubScopes` is `["repo", "public_repo"]`
  (line 108) — this is an OR (the connector requires *one of*), not an
  AND. Clarify in the OAuth architecture descriptor: add a new field
  `scopeSelectionMode: "least_privilege_prefer_public_repo"` and document
  that `public_repo` MUST be tried first when the target repo is
  detected as public.
- [ ] **[GUARDED]** Phase 8d doctor surface MUST expose actual token scope
  observed from a `GET /user` probe, but only on explicit
  `/flowdesk-doctor` invocation, never automatically.
- [ ] **[GUARDED]** When `target.kind === "github_issue"` on a public repo,
  the connector SHOULD reject `repo`-scoped tokens with a soft warning
  (advisory `blocked_labels: ["scope-broader-than-needed"]`) — but this
  is a Phase 9+ refinement; for Phase 8 just document the gap.
- [ ] **[BLOCKER]** No fine-grained PAT scope inference is attempted (PATs
  are opaque). Document explicitly: scope minimization is a
  *configuration discipline*, not enforced by the connector.

### 2.5 Compaction script constraints (Phase 8b)

- [ ] **[BLOCKER]** Path safety: resolve all paths via `path.resolve()` +
  `fs.realpath()`, reject any path not under
  `FLOWDESK_WORKFLOW_STATE_ROOT` or `FLOWDESK_SESSION_RECORD_ROOT`
  (`release1-contracts.ts` 7–8). Reject `..` after normalization. Reject
  symlinks pointing outside the root.
- [ ] **[BLOCKER]** Exclusive lock: acquire `flock`-style lock on
  `.flowdesk/locks/compaction.lock` before any scan. Connector's
  `publishToGitHubV1` MUST check for this lock and return
  `blocked_labels: ["compaction-lock-held"]` if held (additive — does
  not change existing semantics when lock is absent).
- [ ] **[BLOCKER]** TTL source-of-truth: load
  `flowdesk.ledger_retention_policy.v1` (`schema-artifacts.ts` 161;
  `routing-advisory.ts` 18) at start. CLI args may NARROW, never WIDEN.
- [ ] **[BLOCKER]** Fail-closed: any malformed record →
  `.flowdesk/quarantine/<timestamp>-<sha>/`, NEVER deleted.
- [ ] **[BLOCKER]** Concurrency: monotonically increasing
  `compactionRunId` recorded in the new
  `FlowDeskCompactionEvidenceV1` schema (Section 3).
- [ ] **[BLOCKER]** Refuse to delete any record where
  `publicationState === "pending_gate_promotion"` regardless of age
  (T3.1).
- [ ] **[BLOCKER]** No `child_process.exec` with interpolated paths
  (T4.3). Use `node:fs` directly.

### 2.6 Conformance tests that must exist before merge

The following tests MUST exist in
`packages/opencode-plugin/src/federated-registry-connector.test.ts` (or a
new sibling file) before any Phase 8 PR merges:

- [ ] `test_token_not_in_errors_for_all_failure_modes` (parameterized
  over 11 failure modes from Section 2.1).
- [ ] `test_token_not_in_evidence_when_serialized`.
- [ ] `test_authorization_header_only_present_when_remote_write_enabled`.
- [ ] `test_fetch_not_called_when_preliminary_block_labels_present`.
- [ ] `test_authority_block_invariants_for_all_branches` (all 6 return
  branches in `publishToGitHubV1` MUST report
  `remoteWriteAuthorityEnabledInRecord: false`,
  `dispatchAuthorityEnabled: false`, `laneLaunchAuthorityEnabled: false`,
  `advisoryOnlyRecord: true`).
- [ ] `test_productionPublish_flag_and_gates_with_existing_preconditions`
  (must verify Phase 8c AND-gating: removing any one of
  `productionPublish`, `connectorGateSatisfied`, `allowActualRemoteWrite`,
  fresh `FlowDeskSurplusUsageGateV1`, or fresh
  `FlowDeskFederatedDataMinimizationPolicyV1` blocks the publish).
- [ ] `test_compaction_refuses_pending_gate_promotion_records`.
- [ ] `test_compaction_path_traversal_rejected` (parameterized over
  `../`, symlink, absolute path outside root).
- [ ] `test_compaction_lock_held_blocks_publish`.
- [ ] `test_content_markdown_forbidden_marker_rejected` (parameterized
  over each of `FORBIDDEN_RAW_PAYLOAD_MARKERS`).
- [ ] `test_content_markdown_requires_minimization_policy_ref`.
- [ ] `test_redactedReason_is_fixed_enum` (assert closed set of labels).
- [ ] `test_rate_limit_403_429_classified_as_rate_limited`.
- [ ] `test_publish_consumes_fresh_surplus_usage_gate` (Phase 8a — burn
  rate dependency).
- [ ] `test_mock_fetchImpl_seam_works_in_test_and_is_disabled_in_production`
  (verify production path uses `globalThis.fetch` when
  `productionPublish=true`; the `fetchImpl` override is honored only
  when `productionPublish` is absent/false).

### 2.7 Evidence preservation

- [ ] **[BLOCKER]** Every `publishToGitHubV1` call (whether blocked or
  posted) MUST produce a durable `FlowDeskFederatedPublicationResultV1`
  record. Confirmed present at lines 246–256.
- [ ] **[BLOCKER]** `pending_gate_promotion` records MUST be preserved by
  compaction (T3.1).
- [ ] **[BLOCKER]** New schema `FlowDeskCompactionEvidenceV1` MUST be
  defined (see Section 3) with fields:
  `schema_version: "flowdesk.compaction_evidence.v1"`, `compaction_run_id`,
  `started_at`, `completed_at`, `policy_ref` (the
  `flowdesk.ledger_retention_policy.v1` ref consulted),
  `records_scanned`, `records_deleted`, `records_quarantined`,
  `records_preserved_due_to_pending_gate_promotion`,
  `lock_path`, plus the standard `advisory_only: true`,
  `non_authorizing: true`, and all `*_authority_enabled: false` flags
  matching `FlowDeskSurplusUsageGateV1` (gates.ts 522–534).
- [ ] **[BLOCKER]** Quarantined records (T3.4) MUST themselves be
  preserved for at least the retention window of the
  `flowdesk.ledger_retention_policy.v1` policy.

### 2.8 Doctor surface (`/flowdesk-doctor`)

- [ ] **[BLOCKER]** `/flowdesk-doctor` MUST report the
  `productionPublish` flag state as one of `disabled`, `enabled`, or
  `unknown` — never absent. Wire via the existing doctor section pattern
  in `command-handlers.ts` 433 / `bootstrap-installer.ts` 418/449/462.
- [ ] **[BLOCKER]** `/flowdesk-doctor` MUST report
  `githubTokenAvailable`, `authSource`, and `capabilityState` from
  `discoverGitHubConnectorV1` — using only the redaction-safe ref labels,
  never the raw token.
- [ ] **[GUARDED]** `/flowdesk-doctor` MAY report observed token scope
  from an opt-in `GET /user` probe, gated by an explicit
  `--probe-github-scope` doctor flag (default off). The probe MUST NOT
  run on automatic doctor invocations (startup, post-error).
- [ ] **[BLOCKER]** `/flowdesk-doctor` MUST report the most recent
  `FlowDeskCompactionEvidenceV1` summary (run id, completed_at, counts)
  when present, redacted-first.
- [ ] **[BLOCKER]** `/flowdesk-doctor` MUST report the freshness of the
  most recent `FlowDeskSurplusUsageGateV1` and
  `FlowDeskFederatedDataMinimizationPolicyV1` records. If either is
  stale or absent, surface
  `safe_next_actions: ["/flowdesk-doctor", "/flowdesk-usage",
  "/flowdesk-status"]` and report `productionPublish` as effectively
  blocked regardless of its configured value.

---

## 3. Evidence Requirements

### 3.1 Existing schemas leveraged

- `FlowDeskFederatedPublicationResultV1` — already created at lines
  246–256.
- `FlowDeskFederatedDataMinimizationPolicyV1` —
  `federated.ts` 852–879. Required as a precondition by Phase 8c.
- `FlowDeskSurplusUsageGateV1` — `gates.ts` 501–535. Required as a
  precondition by Phase 8a.
- `FlowDeskGitHubOAuthArchitectureV1` — already exposed via
  `buildGitHubOAuthArchitectureDescriptorV1` (line 102–113).
- `flowdesk.ledger_retention_policy.v1` — `schema-artifacts.ts` 161;
  `routing-advisory.ts` 18. MUST target
  `agent-task-progress-*`, `publication-result-*`, and
  `dry-run-result-*` ledger families. Update the policy artifact entry
  to enumerate these families explicitly.

### 3.2 Missing schemas to define before Phase 8b/8c

- **`FlowDeskCompactionEvidenceV1`** (Phase 8b BLOCKER). Fields listed
  in Section 2.7. Register in `schema-artifacts.ts` and
  `schema-registry.ts` mirroring the pattern at
  `schema-artifacts.ts` 161 and `schema-registry.ts` 252.
- **`FlowDeskGitHubConnectorProductionPublishFlagV1`** (Phase 8c
  BLOCKER). Encodes the `productionPublish` flag with required AND-gate
  predicates (verified surplus usage gate ref, verified minimization
  policy ref, verified guard approval ref, verified ledger idempotency
  ref). Default = `disabled`. Standard authority block:
  `advisory_only: true`, `non_authorizing: true`,
  `remote_write_authority_enabled: false`,
  `dispatch_authority_enabled: false`, `write_authority_enabled: false`.

### 3.3 Durable-artifact link requirements

- Every `publishToGitHubV1` invocation MUST emit:
  1. `FlowDeskFederatedPublicationResultV1` (existing).
  2. A reference to the consumed `FlowDeskSurplusUsageGateV1` decision
     (new required field — Phase 8a/8c).
  3. A reference to the consumed
     `FlowDeskFederatedDataMinimizationPolicyV1` (new required field —
     Phase 8c).
  4. A reference to the consumed
     `FlowDeskGitHubConnectorProductionPublishFlagV1` (new required
     field — Phase 8c).
- Compaction MUST emit one `FlowDeskCompactionEvidenceV1` per run.

---

## 4. Safe Next Actions for Code Implementers

### 4.1 Code locations to modify (no breaking-change rule)

All changes MUST be additive at the published API boundary:

- `federated-registry-connector.ts:167–180` (`PublishToGitHubInputV1`):
  add optional fields `productionPublishFlagRef?: string`,
  `surplusUsageGateRef?: string`, `minimizationPolicyRef?: string`.
  Default behavior when omitted: the existing block path (with new
  `blocked_labels` entries such as `production-publish-flag-missing`,
  `surplus-usage-gate-missing`, `minimization-policy-missing`).
- `federated-registry-connector.ts:285–291` (`preliminaryBlockLabels`):
  extend with the three new AND-gate predicates. **Do not replace —
  AND-gate.** This is the Architecture verdict Item 2 requirement.
- `federated-registry-connector.ts:313` (`fetchImpl` resolution): in
  Phase 8c, when `productionPublishFlagRef` resolves to a flag with
  `state === "enabled"`, force `fetchImpl = globalThis.fetch` and ignore
  the override. When the flag is absent or disabled, honor the
  caller-injected override (test seam). Document this seam contract in
  a comment block at line 312.
- `gates.ts:501–535` (`FlowDeskSurplusUsageGateV1`): no changes needed;
  consume as a precondition reference only.

### 4.2 productionPublish flag AND-gate semantics

The flag MUST AND-gate with existing preconditions:

```
canPostToGitHub = allowActualRemoteWrite === true
  AND connectorGateSatisfied === true
  AND productionPublishFlag.state === "enabled"
  AND surplusUsageGate.gate_verdict === "allow"
  AND surplusUsageGate.snapshot_fresh === true
  AND minimizationPolicy.advisory_only === true
  AND minimizationPolicy.k_anonymity_threshold >= 10
  AND guardApprovalRef bound to attemptId
  AND ledgerIdempotencyRef unique per (dryRunResultId, target tuple)
  AND no compaction lock held
  AND token discovered
  AND contentMarkdown passes forbidden-marker scan
```

Any one being false MUST produce `publicationState: "blocked"` with a
specific label in `blocked_labels`.

### 4.3 Mock-injectable test seam contract

```
// Phase 8c contract:
// - In test contexts (productionPublishFlag absent or state !== "enabled"):
//     fetchImpl override is honored. This is the test seam.
// - In production contexts (productionPublishFlag.state === "enabled"):
//     fetchImpl override is IGNORED; globalThis.fetch is used unconditionally.
//     This prevents a malicious or buggy caller from injecting a fetch
//     observer that captures the Authorization header (T1.1).
```

Tests in Phase 8a (burn-rate) and Phase 8b (compaction) MUST use the
seam with `productionPublishFlag` absent. Production conformance tests
in Phase 8c MUST verify the override is rejected when
`productionPublishFlag.state === "enabled"`.

### 4.4 Phase separation

- **Phase 8a (burn-rate)** and **Phase 8b (compaction)** are independent
  concerns. Both MUST pass this audit, but they do not block each other.
- **Phase 8c (productionPublish flag)** depends on both 8a and 8b
  schemas being in place.
- **Phase 8d (doctor surface)** depends on 8a + 8b + 8c records
  existing.
- A reviewer MUST NOT approve a Phase 8c PR until the conformance tests
  listed in Section 2.6 are present and passing.

### 4.5 What this audit does NOT approve

- This document does NOT grant Guard approval, dispatch approval,
  fallback approval, security sign-off, or release approval.
- This document does NOT promote `pending_gate_promotion` to a published
  state.
- This document does NOT authorize automatic enabling of
  `productionPublish` in any environment.
- A separate explicit Guard-approved record is required for each
  attemptId before any real GitHub POST is executed in production.

---

## 5. Cross-reference matrix

| Reviewer finding | Audit section | Concrete requirement |
|------------------|---------------|----------------------|
| Security F2.1 (advisory authority claim correct) | 1.2 / 2.6 | `test_authority_block_invariants_for_all_branches` |
| Security F2.2 (token discovery happens) | 1.1 / 2.1 | "Redaction coverage" defined as the 11-mode parameterized test in Section 2.6 |
| Security F2.3 (content boundary) | 1.1 T1.4 / 2.3 | Forbidden-marker scan on `contentMarkdown` + minimization policy ref |
| Security F2.4 (scope minimization) | 1.5 T5.1, T5.4 / 2.4 | Doctor surface for observed scope; `scopeSelectionMode` field |
| Security F2.5 (compaction integrity) | 1.3 / 2.5 / 2.7 | `FlowDeskCompactionEvidenceV1`, exclusive lock, pending-gate-promotion preservation |
| Architecture Item 2 (productionPublish AND-gate) | 4.2 | Explicit `canPostToGitHub` predicate composition |
| Implementation (fetchImpl testability) | 4.3 | Test seam contract; production ignores override |

---

## 6. Verdict

**Advisory verdict:** `audit_complete_followups_required`.

The connector's current advisory-only contract (lines 187–192, 268–273) is
sound. The remaining risks are concentrated in:
1. Future productionPublish wiring (must AND-gate, not replace).
2. Compaction script that does not yet exist (must implement the schema
   and lock requirements in Sections 2.5 and 2.7 before any Phase 8b
   merge).
3. Test coverage gap for the 11-mode redaction matrix (Section 2.6) and
   the AND-gate composition test.

No breaking change to the published API is required. All new fields are
additive optional with safe block-on-missing defaults.

Authority assertions for this audit: `advisory_only: true`,
`non_authorizing: true`, `dispatch_authority_enabled: false`,
`approval_authority_enabled: false`, `remote_write_authority_enabled:
false`, `write_authority_enabled: false`, `hard_chat_authority_enabled:
false`. This document is gate input for PR review, not approval.
