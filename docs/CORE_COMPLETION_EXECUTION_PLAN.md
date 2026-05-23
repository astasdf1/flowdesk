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

1. Add connector profile and recipe-ref contracts if they are absent. Completed 2026-05-22.
2. Add fallback depth/max-depth contract if absent. Already covered by existing fallback decision/regate contracts.
3. Add advisory-output firewall contract if absent. Completed 2026-05-22.
4. Add federated-registry disabled-state contract if absent. Completed 2026-05-22.
5. Add reviewer lane no-deliverable/tool-call-only classification if absent. Completed 2026-05-22.
6. Wire schemas into artifacts/registry/exports and add negative tests. Completed 2026-05-22.
7. Add non-authorizing generic connector gateway invocation planning. Completed 2026-05-22.
8. Add non-authorizing default managed-dispatch promotion readiness so doctor/status can show why opt-in proof has not become default provider execution. Completed 2026-05-22.
9. Update progress and conformance docs after verification. Completed for the first two slices; in progress for default promotion readiness.
10. Add non-authorizing runtime lane launch/lifecycle productization contracts before reviewer fan-out. Completed 2026-05-22.

This slice must not call providers, launch lanes, execute connector tools, install packages, mutate profiles, dispatch prompts, perform remote writes, or enable default managed dispatch.

## Confirmed Follow-Up Slice: Runtime Lane Lifecycle Productization

After the default `/flowdesk-run` managed-dispatch route landed, the next candidate stages were reviewed as remote connector gateway first, runtime lane lifecycle first, reviewer availability cache first, or local operational intelligence first. The selected path is runtime lane lifecycle first because reviewer fan-out depends on durable lane launch/lifecycle contracts, while real connector writes are higher risk and not required for reviewer productization.

The implemented 2026-05-22 slice is intentionally non-authorizing: it adds typed runtime lane launch request, launch plan, and lifecycle projection contracts; requires exact agent/model binding, pre-launch audit, lane-launch approval, SDK-client availability, and durable evidence-root refs before a plan can be `launch_ready`; and still records `launch_attempted=false`, `actualLaneLaunch=false`, `providerCall=false`, and `runtimeExecution=false`. Ordinary child output, missing verdicts, no-output, tool-call-only, timeout, aborted, orphaned, or invocation-failed lifecycle states remain non-approval evidence.

Multi-model reviewer lanes were attempted twice plus fresh replacement lanes for this planning step, but all returned no deliverable. They are recorded as sub-agent instability and not counted as approval. The plan was therefore confirmed by direct document/code review and fail-closed tests only.

Completed follow-up slice: reviewer availability cache assignment-time revalidation and deterministic fan-out planning now exist on top of the runtime lane contracts, still without launching reviewers by default or silently substituting lower-tier models.

## Confirmed Follow-Up Slice: Reviewer Assignment Revalidation and Fan-Out Planning

The implemented 2026-05-23 slice is intentionally non-authorizing. It adds `flowdesk.reviewer_assignment_revalidation.v1` and `flowdesk.reviewer_fanout_plan.v1` as pure planning contracts. Revalidation checks the cache at assignment time against the expected local date, active profile, OpenCode version, FlowDesk package version, registry hash, Policy Pack hash, and auth/account boundary. Stale, drifted, invalid, alias, or lower-tier-only caches block before eligible bindings are exposed.

Fan-out planning deterministically creates `flowdesk.runtime_lane_launch_request.v1` records for the required reviewer perspectives. This is request materialization only: each resulting plan still requires a later runtime launch plan and explicit lane-launch approval, records `launch_attempted=false`, `approval_inferred=false`, and keeps dispatch/provider/lane/runtime authority disabled.

Completed follow-up slice: durable fan-out evidence persistence and doctor/status projection now exist for `flowdesk.reviewer_fanout_plan.v1` records. Actual reviewer lane launch remains blocked until runtime launch planning, approval, SDK-client availability, durable evidence-root refs, and live lane conformance all pass.

## Confirmed Follow-Up Slice: Reviewer Fan-Out Evidence and Diagnostics

The implemented 2026-05-23 slice adds a `reviewer_fanout_plan` session-evidence class for reloadable `flowdesk.reviewer_fanout_plan.v1` records. The session evidence path validates fan-out records through the same closed validator used for planning, so forged `actualLaneLaunch`, provider-call, runtime-execution, or dispatch-authority fields remain blocked during prepare, apply, and reload.

Doctor and status projections now expose fan-out state without promoting execution. `/flowdesk-doctor` can show fan-out state, required/planned perspective counts, runtime launch plan and lane-launch approval requirements, launch-attempt and approval-inference flags, and blocker labels. `/flowdesk-status` can surface blocked fan-out plans as redacted conformance blockers for the active workflow. Ready fan-out plans remain diagnostic only and do not launch lanes.

Completed follow-up slice: daily exact-model availability cache discovery/refresh contracts now classify cache-hit, refresh-required, and blocked states before reviewer assignment. Doctor/status projections can surface missing, stale, drifted, or invalid cache evidence without attempting discovery, refresh, provider calls, or lane launch.

## Confirmed Follow-Up Slice: Exact-Model Cache Refresh Planning

The implemented 2026-05-23 slice adds `flowdesk.exact_model_availability_cache_refresh_plan.v1` as a pure non-authorizing contract. A current cache is usable only when it validates and matches the same local date, active profile, OpenCode version, FlowDesk package version, registry hash, Policy Pack hash, and auth/account boundary. Missing, stale, or drifted cache inputs produce `refresh_required`; malformed or unsafe cache/context inputs produce `blocked`.

The contract records `discovery_required`, `refresh_required`, and `cache_usable_for_assignment` as diagnostics only, while keeping `discovery_attempted=false`, `refresh_attempted=false`, `providerCall=false`, `actualLaneLaunch=false`, `runtimeExecution=false`, and `dispatch_authority_enabled=false`. `/flowdesk-doctor` and `/flowdesk-status` can now expose cache-refresh blockers before reviewer fan-out. Actual cache discovery/provider probing remains a later gate that still needs a bounded acquisition adapter, durable evidence persistence, and explicit approval/conformance before any provider interaction.

Completed follow-up slice: exact-model availability cache records and cache-refresh plans are now managed session-evidence classes. They can be prepared, applied, reloaded, and rejected through the same fail-closed evidence spine used by reviewer fan-out, typed verdicts, lane lifecycle, and dispatch idempotency.

## Confirmed Follow-Up Slice: Exact-Model Cache Evidence Persistence

The implemented 2026-05-23 slice adds `exact_model_availability_cache` and `exact_model_availability_cache_refresh_plan` to the session evidence class registry. `flowdesk.exact_model_availability_cache.v1` records validate through the cache validator before prepare/apply/reload. `flowdesk.exact_model_availability_cache_refresh_plan.v1` records validate through the refresh-plan validator before prepare/apply/reload.

Forged cache evidence that enables provider calls, runtime execution, dispatch authority, or actual lane launch is rejected. Forged refresh-plan evidence that claims discovery or refresh was attempted is rejected. This is durable evidence support only; actual cache acquisition and provider probing remain unimplemented.

Completed follow-up slice: reviewer assignment revalidation can now require paired exact-model cache evidence plus a cache-hit refresh plan before exposing eligible reviewer bindings.

## Confirmed Follow-Up Slice: Paired Cache Evidence Revalidation

The implemented 2026-05-23 slice adds `revalidateFlowDeskReviewerAssignmentsFromCacheEvidenceV1`. It wraps assignment revalidation with the additional requirement that the cache record is paired with a valid `flowdesk.exact_model_availability_cache_refresh_plan.v1` in `cache_hit` state for the same cache id and expected context.

The helper blocks when refresh evidence is missing, invalid, not `cache_hit`, not usable for assignment, mismatched to the cache id, drifted from expected profile/version/hash/auth-boundary context, or drifted from the cache record itself. Blocked paired evidence suppresses eligible bindings before fan-out can materialize launch requests.

Completed follow-up slice: reloaded session evidence now has a selector for deriving a single exact-model cache/cache-refresh pair from durable evidence entries.

## Confirmed Follow-Up Slice: Reloaded Cache Evidence Pair Selector

The implemented 2026-05-23 slice adds `selectFlowDeskExactModelCacheEvidencePairV1`. It scans reloaded session evidence for a single valid `flowdesk.exact_model_availability_cache_refresh_plan.v1` in `cache_hit` state matching the requested local date, active profile, OpenCode version, FlowDesk package version, registry hash, Policy Pack hash, and auth/account boundary. It then requires exactly one matching `flowdesk.exact_model_availability_cache.v1` record for the refresh plan cache id and echoed cache context.

Missing, drifted, invalid, or ambiguous cache-refresh/cache evidence blocks before callers can feed paired records into reviewer assignment revalidation. The selector remains non-authorizing and preserves disabled provider-call, lane-launch, runtime, and dispatch authority.

Completed follow-up slice: selected durable cache evidence can now feed paired assignment revalidation and deterministic reviewer fan-out planning through a single non-authorizing composition helper.

## Confirmed Follow-Up Slice: Selected Cache Fan-Out Planning

The implemented 2026-05-23 slice adds `planFlowDeskReviewerFanoutFromReloadedCacheEvidenceV1`. The helper composes reloaded cache evidence selection, paired assignment revalidation, and reviewer fan-out planning while exposing all intermediate artifacts. It returns `fanout_ready` only when exactly one cache/cache-refresh pair is selected, paired revalidation succeeds, and fan-out planning can materialize the required runtime lane launch requests.

Missing, drifted, invalid, or ambiguous durable cache evidence blocks before fan-out request materialization. Even ready plans remain request topology only: provider calls, runtime execution, actual lane launch, dispatch authority, cache discovery, and cache refresh remain disabled.

Completed follow-up slice: `/flowdesk-doctor` and `/flowdesk-status` can now derive reviewer fan-out diagnostics from reloaded durable exact-model cache evidence when `reviewerFanoutDiagnostics` is explicitly configured with a durable state root.

## Confirmed Follow-Up Slice: Fan-Out Diagnostic Wiring

The implemented 2026-05-23 slice wires `planFlowDeskReviewerFanoutFromReloadedCacheEvidenceV1` into the local non-dispatch adapter as a diagnostic-only option. The server option `reviewerFanoutDiagnostics` supplies the expected cache context and fan-out planning refs; the adapter reloads session evidence from the configured durable state root for the requested workflow, derives the selected-cache fan-out plan, and passes only diagnostic artifacts into the existing doctor/status surfaces.

Ready durable cache evidence can surface `exact_model_cache_refresh_state=cache_hit` and `reviewer_fanout_state=fanout_ready` in `/flowdesk-doctor`. Drifted or missing selected cache evidence can surface blocked reviewer fan-out refs in `/flowdesk-status`. This diagnostic derivation does not launch lanes, call providers, refresh caches, or enable runtime/dispatch authority.

Completed follow-up slice: ready derived reviewer fan-out diagnostics can now optionally persist durable `reviewer_fanout_plan` evidence after diagnostic derivation succeeds. Blocked derivations write no fan-out plan evidence.

## Confirmed Follow-Up Slice: Derived Fan-Out Plan Materialization

The implemented 2026-05-23 slice adds optional materialization to the existing `reviewerFanoutDiagnostics` product path. When explicit diagnostic options include `persistDerivedFanoutPlanEvidence`, and selected-cache fan-out derivation returns `fanout_ready`, the local adapter writes the ready plan through `prepareFlowDeskSessionEvidenceWriteIntentV1` and `applyFlowDeskSessionEvidenceWriteIntentsV1` as `reviewer_fanout_plan` evidence.

Blocked, drifted, missing, invalid, or ambiguous cache evidence leaves the durable fan-out plan inventory unchanged. Ready materialized records still represent topology planning only and keep lane launch, provider calls, cache discovery/refresh, runtime execution, dispatch authority, and approval inference disabled.

Completed follow-up slice: an observed typed reviewer verdict can now be materialized as durable `reviewer_verdict` evidence without accepting verdicts or launching lanes.

## Confirmed Follow-Up Slice: Observed Reviewer Verdict Materialization

The implemented 2026-05-23 slice adds `materializeFlowDeskObservedReviewerVerdictEvidenceV1` to the plugin adapter layer. It consumes the result of `observeInjectedSdkReviewerVerdictV1` and persists only a `verdict_observed` result carrying a valid `flowdesk.top_tier_review_verdict.v1` record. Missing, invalid, unavailable, or failed observations write no evidence.

The helper reuses the session-evidence prepare/apply/reload path, blocks duplicate reviewer-verdict evidence ids before write, and verifies that the persisted verdict reloads. It does not invoke acceptance, durable linkage, provider calls, SDK prompts, runtime execution, lane launch, dispatch, or cache discovery.

Completed follow-up slice: exact-model cache discovery acquisition planning now exists as a durable fail-closed contract, without implementing provider probing or cache refresh execution.

## Confirmed Follow-Up Slice: Exact-Model Cache Acquisition Planning

The implemented 2026-05-23 slice adds `flowdesk.exact_model_availability_cache_acquisition_plan.v1` and `planFlowDeskExactModelAvailabilityCacheAcquisitionV1`. The helper consumes a cache-refresh plan and distinguishes cache-hit no-op, refresh-required acquisition planning, and invalid/blocked refresh evidence.

The acquisition plan can be persisted and reloaded as `exact_model_availability_cache_acquisition_plan` session evidence. It records `acquisition_attempted=false`, `discovery_attempted=false`, `refresh_attempted=false`, `providerCall=false`, `actualLaneLaunch=false`, `runtimeExecution=false`, and `dispatch_authority_enabled=false`. Forged records that claim attempted discovery/acquisition/refresh or runtime authority fail closed during validation and reload.

Priority update from user direction: provider execution in a real working environment is now the next critical path. Diagnostic-only expansion should pause unless it directly supports that provider-first path.

Next safe slice: design and implement an explicit opt-in provider acquisition/live-test track for exact-model availability. It should run against the real active environment under bounded approval, but still preserve the existing gate order: acquisition preflight, auth/account-boundary proof, redaction proof, durable pre-call audit, idempotency/run ref, provider call, sanitized acquisition result evidence, reload verification, and blocked/failure classification. Reviewer lane launch and verdict acceptance remain gated until live acquisition evidence proves exact provider-qualified model availability.

## Provider-First Priority Update

The immediate goal is no longer more acquisition-plan diagnostics. The next implementation work should prove real provider operation by testing in the actual working environment and fixing the product around observed failures.

Provider-first does not mean default-open dispatch. It means an explicit, bounded, auditable live-test path that can call the relevant provider only after the preflight evidence is present and can persist sanitized results. A failed provider run should become durable blocked evidence and a concrete repair target, not an implicit fallback or silent substitution.

Recommended provider-first sequence:

1. Add an exact-model acquisition preflight contract that consumes `acquisition_planned` evidence and proves active profile, auth/account boundary, registry hash, Policy Pack hash, OpenCode version, package version, and redaction readiness.
2. Add an opt-in acquisition adapter that can perform one bounded real provider discovery/check in the active environment and persist only sanitized availability evidence.
3. Run the adapter against the real environment, then fix failures observed in auth binding, provider id mapping, model id normalization, redaction, or evidence reload.
4. Only after successful reloadable cache evidence exists, resume reviewer fan-out productization.

The first provider-first contract now exists as `flowdesk.exact_model_availability_cache_provider_acquisition_result.v1`. It records sanitized bounded live-test facts, including active profile, auth/account-boundary, registry, Policy Pack, pre-call audit, idempotency, live-test run, redaction proof, exact provider-qualified model, and availability refs. The plugin also exposes an explicit opt-in `flowdesk_exact_model_provider_acquisition_live_test` tool only when `exactModelProviderAcquisitionLiveTest.enabled=true`, an acquisition client is injected, and a durable state root is configured. This path may record that a provider call happened, but it still cannot refresh caches, launch reviewers, execute runtime work, authorize dispatch, accept verdicts, or enable fallback. The next implementation slice is binding the adapter to the real active-environment provider/auth surface and running one credentialed provider check.

## Review Questions

1. Is the dependency order safe, or should remote write wait until lane/reviewer productization?
2. Is Option 2 for default managed dispatch narrow enough to promote safely?
3. Are ConnectorProfile/recipe/playbook/gateway layers sufficient to avoid direct adapter proliferation?
4. Which evidence classes must be implemented before any first execution slice?
5. Which stages should remain documentation-only until a separate release approval?
