# Core Completion Execution Plan

Date: 2026-05-22

Status: confirmed after multi-model critical review synthesis

## Multi-Model Review Synthesis

Review lanes attempted:

1. Claude Opus: usable after verdict-only continuation. Verdict `changes_required`.
2. GPT frontier: no-deliverable on initial/fresh runs and `inconclusive` on verdict-only continuation because it did not retain/read the documents. This lane is recorded as inconclusive and is not counted as approval.
3. Gemini Pro: usable after verdict-only continuation. Verdict `changes_required`.

Consensus decision: proceed, but only by implementing additive fail-closed contracts first. Do not promote default dispatch, real remote writes, actual reviewer fan-out, automatic fallback, connector installation, or federated data sharing until the new contracts and evidence surfaces exist and pass tests.

Reviewer-required corrections folded into the plan:

1. Move `ConnectorProfile` and recipe-ref schemas ahead of remote-write evidence/gateway work.
2. Add assignment-time reviewer availability/cache revalidation before product reviewer fan-out.
3. Require durable evidence reload proof before any default managed-dispatch promotion.
4. Add explicit fallback depth/max-depth contract and terminal blocked state.
5. Add an advisory-output firewall so operational-intelligence outputs cannot become Guard, approval, dispatch, verification, or external-write authority.
6. Add federated-registry disabled-state contracts and negative tests before any federated registry implementation.
7. Add tool-call-only/no-final-verdict classification for reviewer lanes and keep no-deliverable reviews out of approval evidence.
8. Keep federated data sharing documentation-only until a separate security/privacy review approves a concrete opt-in design.

## Purpose

This plan converts FlowDesk's unfinished core feature list into a dependency-ordered execution program. Each stage lists multiple implementation options, the preliminary preferred option, required evidence, and the safety boundary that must remain closed until proof exists.

The unfinished core areas are:

1. Default user-facing managed dispatch.
2. Productized runtime lane lifecycle and reviewer lanes.
3. Managed fallback/reselection.
4. Real remote write through connector profiles.
5. Operational intelligence.
6. Federated score registry.
7. Doctor/status/evidence surfaces across the above gates.

## Global Invariants

1. Release 1 default behavior remains non-dispatch unless a later release gate explicitly promotes a path.
2. No production orchestration proof may depend on nested `opencode run`.
3. No provider call, lane launch, automatic fallback, remote write, connector install, profile mutation, hard chat suppression, or reviewer fan-out happens without typed evidence and explicit approval for that action.
4. No reviewer or delegated lane output counts as approval unless it returns the requested deliverable and validates against the expected schema.
5. All gate outputs must distinguish pass, blocked, denied, invalid, inconclusive, no-output, missing-verdict, timeout, aborted, and invocation-failed states where applicable.
6. Durable evidence must be committed and reloadable before dependent authority is consumed.
7. Doctor/status/debug surfaces must expose redacted blockers and next actions without raw payloads, raw paths, tokens, provider bodies, repo locators, or stable cross-project identifiers.

## Stage 1: Doctor, Status, and Evidence Spine

This stage should land before expanding execution capabilities because every later gate needs user-visible diagnostics and durable evidence.

Options:

1. Minimal spine: add only connector/reviewer/fallback/operational-intelligence status labels to existing doctor output.
2. Evidence-first spine: add durable evidence classes, reload evaluators, and doctor/status projections for each unfinished gate before execution.
3. Full observability spine: add evidence classes, doctor/status/debug export, failure-class taxonomy, and operator remediation text for every unfinished gate before any new execution path.

Preliminary preferred option: Option 2. It closes the most dangerous proof gaps without blocking all implementation behind user-facing copy polish.

Required deliverables:

1. Typed evidence classes for connector readiness/write result, reviewer availability/binding cache, lane lifecycle summary, fallback regate attempts, operational-intelligence evaluations, and federated registry disabled/enabled state.
2. Reload evaluators that fail closed on missing, malformed, stale, drifted, cross-profile, or redaction-failed evidence.
3. Doctor/status summary fields for disabled, blocked, configured, ready, approved, and execution-capable states, with no authority implied by diagnostics alone.

## Stage 2: Remote Write Connector Profiles and Generic Gateway

Remote writes must become possible without direct per-service adapter proliferation.

Options:

1. GitHub-first implementation: build a GitHub issue/comment path first, then generalize.
2. ConnectorProfile-first implementation: define profile and recipe contracts, then implement a generic gateway with fake execution before any live connector.
3. MCP-first implementation: standardize around MCP tool calls and treat CLIs/APIs as later connector kinds.

Preliminary preferred option: Option 2. It matches the environment-variable nature of user setups and avoids hard-coding GitHub/API/CLI behavior into FlowDesk core.

Required deliverables:

1. `flowdesk.connector_profile.v1` and `flowdesk.connector_recipe_ref.v1` contracts.
2. Profile/playbook binding for MCP/API/CLI usage instructions without treating playbooks as authority.
3. Generic gateway that executes only profile/recipe-bound operations after consumed `external_write` approval, committed pre-write audit, connector capability proof, and idempotency reservation.
4. Durable remote-write evidence and post-write verification summaries.
5. Fake gateway tests before any user-approved live connector smoke.

## Stage 3: Runtime Lane Lifecycle Productization

The current proof shows parent/child/message observation, but product behavior needs lifecycle handling and durable status.

Options:

1. Observation-only lanes: keep runtime lanes non-authorizing and expose observed refs/status only.
2. Controlled lane launch: allow explicit opt-in child sessions with strict agent/model binding, lifecycle recording, timeout/no-output handling, and no approval inference.
3. Full lane orchestration: add launch, retry, cancellation, cleanup, typed outputs, and parent dashboard in one stage.

Preliminary preferred option: Option 2. It provides real lane utility while preventing the high-risk jump to autonomous fan-out orchestration.

Required deliverables:

1. Product lane launch request/plan contracts with exact agent/model binding.
2. Lifecycle materializer for complete, incomplete, no-output, missing-verdict, aborted, timeout, late-output, orphaned, and invocation-failed states.
3. Durable lane evidence reload and status/debug projection.
4. Zero approval inference from ordinary child output.

## Stage 4: Top-Tier Reviewer Lanes

Reviewer fan-out depends on lane lifecycle and exact model availability.

Options:

1. Static three-lane floor: always require Claude/GPT/Gemini if available.
2. Registered highest-tier cache: use active-profile registry, same-day availability cache, Policy Pack hash, account/auth boundary, usage/quota evidence, and concrete provider-qualified model ids.
3. Single-model multi-perspective fallback: if only one registered top model is available, run multiple perspective-bound reviewer lanes on that same model.

Preliminary preferred option: combine Options 2 and 3. Option 1 can be a review protocol for manual planning, but product behavior needs registry-driven exact bindings.

Required deliverables:

1. Availability cache refresh and invalidation rules.
2. Binding inventory and fan-out plan materialization.
3. Typed verdict observation and durable linkage for every accepted verdict.
4. Budget/quota/timeouts and no silent lower-tier substitution.

## Stage 5: Default User-Facing Managed Dispatch

Opt-in SDK proof exists, but default product readiness needs a controlled promotion path.

Options:

1. Keep dispatch permanently explicit-opt-in and expose doctor-ready setup only.
2. Promote a single low-risk managed dispatch path after production evidence, approval source, provider health, usage, verification, and idempotency pass.
3. Promote broader command-backed dispatch with reviewer/fallback integration in one release.

Preliminary preferred option: Option 2. It is the smallest user-visible promotion that can be proven and rolled back.

Required deliverables:

1. Release gate that distinguishes configured, approved, dispatch-capable, and default-enabled.
2. Durable proof of usage, provider health, sanitized auth/provider policy, configured verification, approval source, idempotency reservation, pre-dispatch audit, manifest, runtime echo, and telemetry.
3. Failure-state materialization after SDK failure and no approval reuse.
4. User-facing doctor/status guidance before enabling any default path.

## Stage 6: Managed Fallback/Reselection

Fallback currently produces non-authorizing re-gate plans only.

Options:

1. Keep fallback manual: status explains alternatives and user starts a new attempt.
2. User-initiated fallback: FlowDesk proposes candidates, user confirms, then full fresh re-gate runs.
3. Automatic fallback: FlowDesk switches provider/model when health/usage fails.

Preliminary preferred option: Option 2. Option 3 remains too risky until every real-dispatch and fallback-specific gate is durable and proven.

Required deliverables:

1. Candidate selection contract using policy eligibility, fresh usage, provider health, and runtime compatibility.
2. Explicit user confirmation for fallback candidate and new attempt id.
3. Full fresh re-gate with fresh Guard, approval, pre-dispatch audit, manifest, idempotency reservation, runtime echo, and telemetry.
4. Max-depth and terminal blocked states.

## Stage 7: Operational Intelligence

Operational intelligence must remain advisory unless specific downstream gates consume separate approvals.

Options:

1. Local-only advisory scoring and reference packs.
2. Opt-in proposal fan-out using reviewer lanes after lane/reviewer gates pass.
3. Remote score ledgers through connector profiles after remote write gate passes.

Preliminary preferred option: implement Option 1 first, then Option 2, then Option 3. Do not combine them.

Required deliverables:

1. Evaluation, proposal, score, ledger, redaction, and reference-pack schemas.
2. Hard filters before advisory scoring.
3. Explicit non-signoff labeling for legal, medical, patent, financial, or professional contexts.
4. Connector-profile-only path for any remote ledger write.

## Stage 8: Federated Score Registry

Federated registry is the highest-risk data-sharing stage and should remain last.

Options:

1. Disabled-by-default local registry metadata only.
2. Opt-in private remote ledger through connector profiles.
3. Community/shared federated registry with upload/download and scoring influence.

Preliminary preferred option: Option 1 now, Option 2 later, Option 3 only after separate privacy/security review. Federated data must not influence planning, ranking, Guard, approval, usage, conformance, verification, or dispatch unless a future explicit gate allows it.

Required deliverables:

1. Disabled-state contracts proving no upload/download/planning influence.
2. Redaction and aggregation policy.
3. Remote ledger profile only through the connector gateway.
4. Separate opt-in and revocation story.

## Dependency Order

1. Doctor/status/evidence spine.
2. ConnectorProfile and recipe-ref schema foundation.
3. Fail-closed correction contracts: fallback depth, advisory firewall, federated disabled state, and reviewer tool-call-only classification.
4. Remote write connector profiles and generic gateway.
5. Runtime lane lifecycle productization.
6. Top-tier reviewer lanes with assignment-time cache revalidation.
7. Default user-facing managed dispatch with durable reload proof.
8. User-initiated managed fallback.
9. Local operational intelligence.
10. Remote operational-intelligence ledgers through the connector gateway.
11. Federated score registry only after separate security/privacy approval.

## Confirmed Immediate Implementation Slice

The first execution slice is intentionally non-authorizing:

1. Add connector profile and recipe-ref contracts if they are absent.
2. Add fallback depth/max-depth contract if absent.
3. Add advisory-output firewall contract if absent.
4. Add federated-registry disabled-state contract if absent.
5. Add reviewer lane no-deliverable/tool-call-only classification if absent.
6. Wire schemas into artifacts/registry/exports and add negative tests.
7. Update progress and conformance docs after verification.

This slice must not call providers, launch lanes, execute connector tools, install packages, mutate profiles, dispatch prompts, perform remote writes, or enable default managed dispatch.

## Review Questions

1. Is the dependency order safe, or should remote write wait until lane/reviewer productization?
2. Is Option 2 for default managed dispatch narrow enough to promote safely?
3. Are ConnectorProfile/recipe/playbook/gateway layers sufficient to avoid direct adapter proliferation?
4. Which evidence classes must be implemented before any first execution slice?
5. Which stages should remain documentation-only until a separate release approval?
