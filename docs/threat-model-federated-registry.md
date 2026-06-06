# Threat Model: Phase 8 GitHub-First Federated Score Registry

**Document status:** Draft — P8-S1 deliverable  
**Date:** 2026-06-07  
**Scope:** Phase 8 GitHub-first federated advisory score registry  
**Threat model owner:** FlowDesk plugin maintainer (`astasdf1/flowdesk` repository owner)  
**Review trigger:** Any schema change to publication contracts, any new connector type, any consent model change  
**Normative references:**
- `docs/THREAT_MODEL.md` §T15, §T16, §T17, §T18, §T19, §T20 (parent threat model)
- `packages/core/src/operational-intelligence/federated.ts`
- `packages/core/src/connector-profile.ts`
- `packages/core/src/operational-intelligence/score-dimensions.ts`
- `docs/REMOTE_WRITE_CONNECTOR_PROFILE_PLAN.md`

---

## Overview

The Phase 8 federated score registry is a GitHub-first, opt-in mechanism that allows FlowDesk installations to publish anonymized, advisory-only operational intelligence (OI) scores to a shared GitHub repository. Published scores are derived from `FlowDeskOptimizerProposalScoreV1` records and carry no authorization, dispatch, or routing authority. The registry is **blocked by default** in all current code (`connector_gate_satisfied: false` as a TypeScript literal type; `state: "blocked"` on all publication intents). This threat model documents the security properties, trust boundaries, and mitigations required before any actual GitHub publication is implemented or enabled.

---

## Concrete User Stories

The following stories define who interacts with the federated registry, what they want, and what changes as a result. Each story is answered explicitly.

### Story 1 — Publisher (FlowDesk Operator)

> "As a FlowDesk operator, I want my installation to publish anonymized workflow scores to a shared GitHub repo so that other FlowDesk users can benefit from historical cost/latency signal."

**Who publishes?** The FlowDesk installation whose `opencode.json` contains `federatedRegistry.enabled: true` and a valid `federatedRegistry.targetRepo`. Publication is triggered by the FlowDesk coordinator, not directly by the user or any chat input.

**Who reads?** Other FlowDesk installations configured with a matching `federatedRegistry.targetRepo` and a trust allow-list (`federatedRegistry.trustedInstallations[]`) that includes the publisher's `installation_id`.

**What decision changes?** Reader installations may incorporate federated scores as a cold-start advisory signal during workflow planning. No routing, dispatch, model selection, or Guard decision is changed by federated scores; they are advisory metadata only. Scores cannot make an ineligible workflow eligible.

---

### Story 2 — Reader (FlowDesk Operator)

> "As a FlowDesk operator, I want to read federated scores during workflow planning so that new workflows can start with historical signal rather than neutral placeholders."

**Who publishes?** One or more trusted FlowDesk installations in the operator's allow-list. Trust is explicit and operator-controlled, not automatic.

**Who reads?** The local FlowDesk installation, during advisory scoring in the OI module (post-selection, never influencing model selection; see `oi-assignment-advisor.ts`).

**What decision changes?** The advisory score shown for a workflow proposal may start from a historically-informed baseline rather than a neutral placeholder. Hard filters, Guard, usage gates, policy eligibility, and human approval remain unchanged. Federated scores cannot override any of these.

---

### Story 3 — PR Review (Developer)

> "As a developer, I want FlowDesk to post an advisory score comment on my PR so that reviewers can see cost/safety/latency signals at review time."

**Who publishes?** A FlowDesk installation with the `github_pr_comment` connector type configured (see `FLOWDESK_CONNECTOR_TARGET_KINDS` in `connector-profile.ts`) and explicit operator consent. The connector profile must satisfy the connector gate before any real write is attempted.

**Who reads?** Any GitHub user with access to the PR. The comment is public within the repo's visibility scope.

**What decision changes?** PR reviewers see an advisory label (e.g., `cost_tier: medium`, `latency_tier: low`) and aggregated score bucket. This is informational only. No merge decision, dispatch action, or FlowDesk authorization is implied by the comment. The comment must include a disclosure footer stating that the scores are advisory and non-authoritative.

---

## 1. Registry Endpoint Trust Model

### Endpoint Ownership

The target GitHub repository is owned and configured by the human operator who writes `federatedRegistry.targetRepo` in `opencode.json`. FlowDesk does not own or operate any central registry repository. Each installation publishes only to the repository explicitly configured by its operator.

### Transport Security

- GitHub HTTPS only. No custom endpoints, no HTTP fallback, no webhook relay.
- All API calls use `https://api.github.com`. TLS certificate validation is delegated to the GitHub API client; no pinned certificates or custom CA roots are acceptable in Phase 8 scope.
- Raw GitHub API URLs, repository locators, and tokens must never appear in connector profiles or recipe refs. The `ConnectorProfile` validator (`connector-profile.ts`) enforces `raw_locator_allowed: false` and `validateNoForbiddenRawPayloads` on all profile and recipe records.

### Authentication

- GitHub OAuth token with `repo` scope (private repos) or `public_repo` scope (public repos).
- Tokens are stored in the host environment, not in FlowDesk config or audit records.
- The connector profile carries an `auth_scope_refs` array (opaque refs to required scopes); raw token values are never persisted.
- Token rotation and expiry are operator responsibilities. FlowDesk surfaces an `auth_expired` or `auth_missing` health label via the connector doctor status surface when the token cannot be verified.

### Trust Boundaries

| Boundary | Trust level | Notes |
|---|---|---|
| GitHub HTTPS API | High (for transport) | TLS-validated; content integrity is not guaranteed by transport alone — require content hashes per `content_hash_required: true` in recipe refs |
| GitHub repository content | Low until verified | Malicious or poisoned issues/comments are possible; readers must apply trust allow-list and content validation |
| `installation_id` claims in published scores | Low until verified | Readers must verify `installation_id` against `federatedRegistry.trustedInstallations[]` |
| Operator-configured `targetRepo` | Partially trusted | Read from `opencode.json` only; never from chat input or tool arguments |
| FlowDesk connector gateway | Trusted after validation | Only executes against validated `ConnectorProfile` + `ConnectorRecipeRef` after consumed external-write approval and pre-write audit |

### Single-Tenant vs. Shared

- Each FlowDesk installation is configured with exactly one `targetRepo` per registry endpoint.
- Multiple FlowDesk installations may publish to the same `targetRepo` (shared registry scenario), but each publication carries the publisher's `installation_id` and `canonical_workflow_ref`.
- Cross-organization publishing (different GitHub orgs) requires explicit configuration of a second `targetRepo` entry. There is no automatic cross-org discovery.

---

## 2. Cross-Tenant Isolation

### Publication Identity

Every published score record carries:

- `installation_id`: opaque, keyed identifier for the publishing FlowDesk installation. Not a raw GitHub username or organization name.
- `canonical_workflow_ref`: SHA-256(`workflowId` + `installationId`), one-way and non-reversible. Raw `workflow_id` is never published.
- `ledger_entry_id`: SHA-256(`installationId` + `workflowId` + `proposalId` + `scored_at_day`) — globally unique across installations.

These identifiers allow readers to group publications by installation and workflow signature without revealing raw workflow content.

### Fingerprinting and k-Anonymity

Score shapes (dimension values) and publication timing can fingerprint workflow patterns, even without raw content:

- **Mitigation:** k-anonymity cohort gate — a minimum of **N = 10** workflows with matching task-signature and scoring context must exist in the local ledger before any publication is attempted. Publication below this threshold is blocked with label `k_anonymity_cohort_not_reached`.
- Bucketed score ranges (see §4 Data Minimization) further reduce fingerprinting surface for sensitive dimensions.
- Publication timestamps are day-resolution only (`scored_at_day: YYYY-MM-DD`), not exact ISO timestamps.

### Reader Trust Allow-List

Readers must explicitly configure which installations they trust:

```json
{
  "federatedRegistry": {
    "trustedInstallations": ["inst-hash-a1b2c3", "inst-hash-d4e5f6"]
  }
}
```

- Scores from installations not in `trustedInstallations[]` are silently ignored.
- An empty allow-list disables federated score consumption even if `enabled: true`.
- The allow-list is read from `opencode.json` only; it cannot be updated via chat input or tool arguments.

### Isolation Mechanism

- GitHub Issues use the label `flowdesk-score-v1` on all FlowDesk-managed score publications.
- Label-scoped queries (`label:flowdesk-score-v1`) allow discovery without scanning all repository issues.
- `installation_id` is embedded in a structured comment body, enabling per-installation filtering.
- Stale or revoked publications use the label `flowdesk-score-deleted` (soft deletion; see §6).

---

## 3. Consent and Opt-In Semantics

### Who Grants Consent

The **human operator** who edits `opencode.json` grants consent. FlowDesk requires explicit configuration changes; no in-chat approval, no tool argument, and no model-generated text can enable the federated registry.

Relevant configuration fields:

```json
{
  "federatedRegistry": {
    "enabled": true,
    "targetRepo": "owner/repo-name",
    "consentGrantedAt": "2026-06-07T00:00:00Z",
    "retentionDays": 90,
    "trustedInstallations": []
  }
}
```

| Field | Required | Notes |
|---|---|---|
| `enabled` | Yes | Must be `true` to permit publication planning. Default: `false`. |
| `targetRepo` | Yes | GitHub `owner/repo` string. Read-only after connector gate validation. |
| `consentGrantedAt` | Yes | ISO 8601 timestamp set by the operator when enabling. FlowDesk validates freshness (not older than 365 days). |
| `retentionDays` | No | Default 90. Configurable 30–365. |
| `trustedInstallations` | No | Default empty (no federated reading). |

### Consent is Revocable

Setting `enabled: false` (or removing the field) immediately blocks all future publication planning. The connector gate evaluator (`connector_gate_satisfied: false`) ensures no write attempt can proceed without an active consent record.

Existing published GitHub Issues are **not** automatically closed or deleted when consent is revoked. The operator must manually close or request deletion of previously published issues. See §6 (Right to Deletion / Retention).

### Durable Consent Record

A local durable evidence record (`flowdesk.federated_consent_record.v1`) is written to `.flowdesk/sessions/<workflow>/evidence/` when consent is first granted and when consent is revoked. This record:

- Stores a redacted reference to the operator-set `consentGrantedAt` timestamp.
- Does not store the raw `targetRepo` string; stores an opaque `registry_ref`.
- Is included in pre-write audit evidence before any publication attempt.

### Hostile Agent Cannot Flip Consent

The consent gate reads exclusively from `opencode.json` (parsed at startup) and from the durable local consent record. No FlowDesk tool input, chat message, model output, or agent instruction can set `federatedRegistry.enabled: true`. The config validation path (`T2D` in the parent threat model) ensures unknown or injected fields are rejected.

---

## 4. Data Minimization

### Fields Never Published

The following fields are **never** included in any federated score publication, in any format (raw, hashed, or encoded):

| Category | Examples |
|---|---|
| Raw identifiers | `workflowId`, `proposalId`, `candidateRef` (raw form) |
| Task content | Task descriptions, goal summaries, prompt text, user messages |
| Model identity | Model names, provider names, provider-qualified model IDs |
| Repository metadata | Repo names, org names, branch names, file paths, PR/issue titles |
| Provider data | Provider payloads, quota bodies, auth tokens, API responses |
| Runtime data | Stack traces, raw logs, runtime echoes, tool arguments/results |
| User identity | GitHub usernames, email addresses, stable user IDs |

This prohibition is enforced by `validateNoForbiddenRawPayloads()` on all federated score records, mirroring the canonical forbidden-payload list from the implementation spec (§3.2) and from parent threat model threats T15, T19.

### Fields Published (Canonicalized)

| Published field | Format | Privacy notes |
|---|---|---|
| `canonical_workflow_ref` | SHA-256(`workflowId` + `installationId`) — 64 hex chars | One-way, non-reversible. Cannot be correlated across different `installationId` values. |
| `installation_id` | Opaque keyed identifier (not raw GitHub identity) | Rotatable by operator. Correlated only within a single registry. |
| `scored_at_day` | `YYYY-MM-DD` — day resolution only | Not exact timestamp. |
| `ledger_entry_id` | SHA-256(`installationId` + `workflowId` + `proposalId` + `scored_at_day`) | Globally unique; non-reversible. |
| `advisory_health_label` | Enumerated string: `healthy`, `degraded`, `stale`, `partial`, etc. | No continuous values; low entropy. |
| `hard_filter_state` | `passed` or `blocked` | Binary; no granular content. |
| Dimension scores (bounded) | Bucketed ranges (see below) | Not exact values for sensitive dimensions. |
| `aggregated_score_bucket` | Enumerated bucket: `0-25`, `26-50`, `51-75`, `76-100` | Not exact `advisory_score`. |

### Canonicalization Step

```
canonical_workflow_ref = SHA-256(workflowId + ":" + installationId)
```

This is computed locally before publication. The raw `workflowId` is not transmitted. The hash is non-reversible and installation-scoped: the same `workflowId` produces a different `canonical_workflow_ref` on a different installation.

### Score Dimension Bucketing

Dimensions that encode workflow semantics — specifically `goal_fit` and `taxonomy_fit` — are published only as bucketed ranges, not exact values:

| Exact score range | Published bucket |
|---|---|
| 0–25 | `"0-25"` |
| 26–50 | `"26-50"` |
| 51–75 | `"51-75"` |
| 76–100 | `"76-100"` |

Operational dimensions (`cost`, `latency`, `confidence`) may be published as exact 0–100 integers because these dimensions are derived from provider usage signals (alert levels, reset bucket seconds) rather than from task content.

---

## 5. Replay and Idempotency

### `ledger_entry_id` Format

```
ledger_entry_id = SHA-256(installationId + ":" + workflowId + ":" + proposalId + ":" + scored_at_day)
```

- **Globally unique:** Two different installations scoring the same workflow on the same day produce different `ledger_entry_id` values (because `installationId` differs).
- **Deterministic:** Re-running the same scoring for the same inputs on the same calendar day produces the same `ledger_entry_id`.
- **Non-reversible:** The hash cannot be decomposed to retrieve `workflowId`, `proposalId`, or `installationId`.

### GitHub Deduplication

Before creating a new GitHub Issue or PR comment, the connector gateway must:

1. Query GitHub Issues/comments scoped to `label:flowdesk-score-v1`.
2. Search for an existing entry matching the `ledger_entry_id`.
3. If a match exists: return the existing remote ref (idempotent no-op).
4. If no match: proceed with creation.

This deduplication is mandatory. The `dry_run_required: true` flag on `FlowDeskConnectorRecipeRefV1` ensures a dry-run write plan is validated before any real creation.

### Replay Safety

The same `ledger_entry_id` always targets the same GitHub Issue slot (determined by the deduplication query result). A replayed publication attempt produces no duplicate Issues.

### Stale Replay Rejection

Publication attempts referencing `ledger_entry_id` values older than **30 days** (relative to `scored_at_day`) are rejected by the publication gate with label `stale_ledger_entry_rejected`. This prevents indefinite accumulation of backdated scores.

---

## 6. Right to Deletion / Retention

### Soft Deletion

Closing a GitHub Issue **soft-deletes** the publication:

- The issue is labeled `flowdesk-score-deleted`.
- The original content remains in GitHub's history.
- FlowDesk readers who query by `label:flowdesk-score-v1` will exclude `flowdesk-score-deleted` issues by default.

FlowDesk does not automatically close issues. Soft deletion requires manual action by a GitHub user with write access to the repository.

### Hard Deletion

The repository owner may delete GitHub Issues entirely via the GitHub UI or API. FlowDesk **cannot guarantee** hard deletion of previously published data once it exists on GitHub's infrastructure. Operators must be informed of this limitation before enabling the registry.

### Retention Policy

| Setting | Default | Range |
|---|---|---|
| `federatedRegistry.retentionDays` | 90 days | 30–365 days |

The FlowDesk plugin surfaces a doctor warning when published issues older than `retentionDays` exist without soft-deletion labels. Automated cleanup is not implemented in Phase 8; operators perform cleanup manually or via a separate GitHub Action.

### GDPR / CCPA Considerations

Because no PII is published (see §4 Data Minimization), the primary GDPR right-to-erasure concern is the `installation_id` linkage, not individual user data. Operator actions required for compliance:

1. Delete or revoke the local durable consent record (`.flowdesk/sessions/.../evidence/federated-consent-*`).
2. Set `federatedRegistry.enabled: false` in `opencode.json`.
3. Manually close (soft-delete) or request deletion of previously published GitHub Issues from the `targetRepo` owner.
4. Note: GitHub retains deleted-issue history in some contexts. Operators in GDPR-regulated environments should use private repositories and coordinate with their GitHub organization administrator.

**Missing fact:** Phase 8 does not yet implement an automated compliance workflow for closing/deleting old issues. This is a known gap to be addressed before production enablement.

---

## 7. Adversarial Publishers

### Threat

A malicious FlowDesk installation — or one that has been compromised — publishes poisoned scores to bias other users' advisory planning. Examples include: inflating `safety` scores for dangerous workflow patterns, deflating `cost` scores to encourage quota-exhausting fan-out, or flooding the registry with high-volume noise to drown legitimate signal.

### Mitigation 1: Reader Allow-List (Primary Defense)

Readers **must** verify that the publishing `installation_id` is listed in `federatedRegistry.trustedInstallations[]`. Scores from any unlisted installation are silently discarded before they reach the advisory scoring pipeline. An empty allow-list disables all federated consumption.

This is the strongest mitigation: a hostile publisher outside the allow-list has zero influence, regardless of what they post to the registry.

### Mitigation 2: Bounded Score Dimensions

All published dimension scores are bounded **0–100**. Out-of-range values are rejected by `validateFlowDeskOptimizerProposalScoreV1()` at the validator level in `@flowdesk/core`. A poisoned publication containing `score: 999` on any dimension fails validation before it can be ingested.

### Mitigation 3: Advisory-Only Non-Authorizing Pipeline

All federated scores are advisory only. No FlowDesk code path uses federated scores as routing authority, Guard approval, dispatch permission, or eligibility proof. The source contracts (`FlowDeskOptimizerProposalScoreV1`, `FlowDeskFederatedScoreRegistryPublicationIntentV1`) enforce authority flags as TypeScript literal `false` types — these cannot be overridden at runtime.

A poisoned score can at most affect an advisory label visible to a human operator. It cannot change a Guard decision, bypass policy, skip a usage check, or authorize a dispatch.

### Mitigation 4: GitHub Issue Audit Trail

All publications create GitHub Issues (or PR comments) that are publicly visible to anyone with repository access. Publications are attributable to an `installation_id` and timestamped. Suspicious publication patterns (sudden volume spikes, anomalous dimension distributions, unusual `canonical_workflow_ref` patterns) are visible to repository maintainers and can be investigated.

### Mitigation 5: Minimum Sample Gate

Federated scores are reusable as advisory cold-start input only when they pass the score reuse threshold gate (`FlowDeskScoreReuseThresholdGateV1`): minimum sample count, recency, confidence bucket, and scorer diversity requirements must be met. A single poisoned entry from a trusted installation cannot pass the gate on its own.

### Mitigation 6: Anomaly Detection (Later Gate)

Production central registry hosting (not Phase 8 scope) requires rate limits, client/build provenance, anomaly detection, quarantine, and source concentration caps as the minimum anti-Sybil baseline before deployment. These are not Phase 8 requirements but are recorded as a prerequisite for any later central hosting.

---

## 8. Side-Channel Risks

### Publication Attempt Timing as Local Audit Evidence

Even when a publication is blocked (as it always is in the current scaffold), the publication attempt is recorded as durable local evidence:

- `FlowDeskFederatedScoreRegistryPublicationIntentV1` with `state: "blocked"`.
- Stored under `.flowdesk/sessions/<workflow>/evidence/`.

This local record is **intentional**: it provides an audit trail of when an operator-configured installation attempted to publish, even if the attempt was blocked by the connector gate or k-anonymity requirement. It does not leak content to GitHub or any remote endpoint.

The local record must not contain raw prompts, task descriptions, or provider payloads. `validateNoForbiddenRawPayloads()` is applied on all such records.

### GitHub API Rate Limits

- Authenticated GitHub API: 5,000 requests per hour per token.
- Deduplication discovery queries (searching for existing `ledger_entry_id` issues) consume API quota.
- **Mitigation:** Discovery queries run at planning time, not per-request. The connector gateway caches discovery results for a configurable TTL (default: 5 minutes) to avoid redundant API calls within a single work session.
- A rate-limit failure produces a `rate_limited` health label and blocks the publication attempt gracefully. No retry storm is implemented.

### Existence Inference

A reader querying the registry for a specific `canonical_workflow_ref` can infer:

- Whether that workflow was scored at all (presence/absence of matching issues).
- Approximately when it was scored (day-resolution `scored_at_day`).

**Mitigation:** The k-anonymity cohort gate (§2) ensures that no individual workflow is published until at least N=10 workflows with matching task-signature have been scored locally. Readers cannot distinguish a single workflow's signal from the cohort. Individual workflow presence inference is therefore bounded to the cohort level.

**Residual risk:** For installations with low workflow volume (fewer than 10 workflows ever scored), the k-anonymity gate permanently blocks publication. This is the intended behavior and is not a defect.

### Registry Downtime and Local-Only Fallback

If the GitHub API is unavailable, rate-limited, or returns unexpected errors:

- Publication is blocked gracefully with a connector health label.
- Advisory planning continues using local-only scores (no degradation to planning functionality).
- No retry queuing is implemented in Phase 8. Retries are operator-initiated.
- FlowDesk falls back to local-only operation; the federated registry is never a required dependency for core planning.

### Threat Model Owner Role

The FlowDesk plugin maintainer (`astasdf1/flowdesk` repository owner) owns this threat model. Review is required before:

1. Any schema change to publication contracts (`federated.ts`, `score-dimensions.ts`, `connector-profile.ts`).
2. Any new connector type is added to `FLOWDESK_CONNECTOR_TARGET_KINDS`.
3. Any change to the consent model (`consentGrantedAt` handling, `enabled` gate logic).
4. Any change to the k-anonymity threshold (N=10).
5. Any change to data minimization rules (fields published, canonicalization functions, bucketing boundaries).
6. Any move from blocked/scaffold state toward actual GitHub API writes.

---

## Cross-References to Parent Threat Model

The following entries in `docs/THREAT_MODEL.md` directly govern the federated registry:

| Parent threat | Relevance |
|---|---|
| **T13** Score Overreach and Goodharting | Federated scores are advisory-only; cannot override Guard, usage, or eligibility |
| **T15** GitHub Ledger Privacy, Compaction, and Concurrency | Governs GitHub as private repo JSONL ledger and sanitized publisher only |
| **T16** External Score and Rollup Tampering | Mandates hash chains, provenance checks, and tamper detection |
| **T17** Duplicate Aggregation Bias | Mandates deterministic `ledger_entry_id` and idempotent deduplication |
| **T18** Raw Archive Leakage and Stale Rollup Reuse | Mandates redacted sealed archives and rollup hash validation |
| **T19** Federated Registry Privacy Leakage | Mandates explicit opt-in, coarse fields, no PII, upload-scoped identifiers |
| **T20** Federated Score Poisoning and Central Dependency | Mandates reader trust allow-list, anomaly detection baseline, and local-only fallback |

---

## Open Questions and Missing Facts

The following items are unresolved and must be addressed before Phase 8 moves beyond the scaffold/blocked state:

1. **Consent record schema:** `flowdesk.federated_consent_record.v1` is referenced in §3 but not yet implemented. The schema, validator, and durable evidence class registration are pending (P8-S6a).
2. **Automated compliance workflow:** No automated GitHub Issue cleanup is implemented. GDPR/CCPA environments require a separate deletion workflow (noted in §6).
3. **k-anonymity N=10 value:** The cohort threshold of 10 is stated as a design target but has not been formally justified by a privacy analysis. A privacy review should confirm or adjust this value before production enablement.
4. **`installation_id` rotation policy:** The mechanism for rotating an opaque `installation_id` (e.g., after a suspected compromise) is not specified. Rotation would invalidate all historical `canonical_workflow_ref` and `ledger_entry_id` values.
5. **GitHub App vs. personal access token:** The connector architecture in `connector-profile.ts` references `auth_scope_refs` but does not specify whether publication uses a GitHub App (preferred for audit trails) or a personal access token (simpler but less auditable).
6. **PR comment disclosure footer:** Story 3 requires a disclosure footer in PR comments. The exact wording is not specified.
7. **Anti-Sybil baseline for central hosting:** The mitigation listed in §7 (Mitigation 6) names rate limits, provenance, anomaly detection, quarantine, and concentration caps as prerequisites but provides no implementation plan. This is a later-gate prerequisite, not a Phase 8 requirement.
8. **`federatedRegistry.consentGrantedAt` expiry:** §3 states the consent timestamp must not be older than 365 days. The gate evaluator that enforces this is not yet implemented.

---

*Document end. All claims are grounded in cited source files or explicitly marked as missing facts.*
