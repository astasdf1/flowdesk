# Release 3 Blocker Clearance Plan

Date: 2026-05-21

## Purpose

This plan orders the remaining blockers that would prevent FlowDesk from progressing safely from the current Release 1/2 state through Release 3. It preserves the fail-closed boundary: no real dispatch, actual lane launch, automatic fallback/reselection, top-tier reviewer fan-out, hard chat cancellation/no-reply, package publish, active-profile mutation, provider call, or external storage write may occur without the listed proof and required confirmation.

## Dependency-Ordered Backlog

| Order | Blocker | Release/Phase | Current Evidence | Required Safe Proof | Target | Verification | Confirmation |
|---:|---|---|---|---|---|---|---|
| 1 | OpenCode 1.15 Release 1 compatibility | R1 / Phase 3-4 | Cleared 2026-05-21. Type/source compatibility, isolated workspace smoke, fresh public-registry install smoke, and active OpenCode profile module-load smoke all pass for `@flowdesk/opencode-plugin@0.1.1` with nested `@opencode-ai/plugin@1.15.6` and `@opencode-ai/sdk@1.15.6`. | None (closed). | `docs/conformance/2026-05-21-release1-0.1.1-publish-completion.md`. | `npm test`, isolated registry install smoke, active profile module-load smoke. | None (closed). |
| 2 | Package distribution drift | R1 / Phase 3 | Cleared 2026-05-21. `@flowdesk/opencode-plugin@0.1.1` is published to the public npm registry with `latest` tag, exact `@opencode-ai/plugin@1.15.6` dependency, fresh registry install smoke pass, and active profile migration smoke pass. | None (closed). | npm registry, `docs/conformance/2026-05-21-release1-0.1.1-publish-completion.md`. | `npm view @flowdesk/opencode-plugin version`, fresh registry install, active profile `npm ls`. | None (closed). |
| 3 | FDS-1 schema conversion under updated package line | R1 / Phase 4 | Runtime-closed fixture/probe smoke passes locally under `@opencode-ai/plugin@1.15.6`. | If OpenCode provider-facing conversion behavior is exercised, unknown-property rejection must still fail closed. | FDS-1 conformance docs and probe tooling. | FDS-1 fixture/probe smoke; no provider call. | Not required for local probe; required for external OpenCode conformance mutation. |
| 4 | Chat hook hard-control uncertainty | R1/R2 / Phase 6 | `chat.message` steering appends visible text and emits no `noReply`, `cancel`, or `stop`. | E2E proof of no duplicate assistant reply, hard suppression, pending tool abort, cleanup, and audit transitions before any hard-control claim. | Hook harness, chat conformance docs, threat model. | Chat hook mutation/throw/no-reply/cancel probe. | Required before enabling hard no-reply/cancel. |
| 5 | Durable production evidence persistence | R2 / Phase 5 | Evidence contracts and session evidence write/reload exist. | Redacted durable refs reload and fail closed for usage, runtime echo, telemetry, verification, auth policy, approval, and pre-dispatch audit. | `session-evidence`, production enablement, doctor diagnostics. | `npm test -- --test-name-pattern "session evidence|production enablement|doctor"`. | Not required for local tests. |
| 6 | Production approval source authority | R2 / Phase 5 | Approval diagnostics exist but issuance authority is unresolved. | Scoped, durable, non-reusable approval decision with evidence binding and drift/denial handling. | Production approval contract and policy docs. | Approval drift/denial tests. | Required before approval issuance can authorize dispatch. |
| 7 | Single-step managed dispatch beta | R2 / Phase 5 | Core gate and opt-in injected SDK adapter exist, default server remains non-dispatch. | Trusted binding, runtime echo, telemetry, fresh usage, provider health, sanitized auth, external auth/provider policy, configured verification, Guard approval, and pre-dispatch audit in one run. | Managed-dispatch adapter, gate evaluator, conformance evidence. | Gate/unit tests plus user-approved live conformance. | Required before any provider call or real dispatch. |
| 8 | Actual delegated lane launch | R2.5 / Phase 6A | Schemas/fake probes/source surfaces exist, runtime lifecycle is unproven. | Parent/child refs, message refs, timeout/failure metadata, provider/model echo, telemetry, no-output detection, and reference-kind separation. | Reviewer lane conformance, lane records, status/debug summaries. | Lane conformance tests plus user-approved runtime probe. | Required before actual lane launch. |
| 9 | Top-tier multi-perspective reviewer lanes | R2.5/R3 | Planned contracts exist only. | Same-day exact model availability cache, registered/highest-tier binding predicates, typed verdicts, budget/quota controls, no silent lower-tier substitution. | Binding registry, availability cache, reviewer lane plans/verdicts. | `npm test -- --test-name-pattern "top-tier|reviewer|availability|binding"`. | Required before reviewer fan-out/provider calls. |
| 10 | Managed fallback/reselection | R2/R3 last gate | Fallback is diagnostic-only. | All real-dispatch gates plus runtime compatibility, policy eligibility, fresh usage/health for new binding, new attempt id, durable audit, explicit Guard approval. | Fallback decision contracts and retry/reselection docs. | Fallback/reselection tests. | Required before automatic provider/model switching. |
| 11 | Operational intelligence | R3 / Phase 7 | Concepts/schemas only. | Advisory-only scoring after hard filters, opt-in fan-out with fresh usage/budget, redacted GitHub score ledger, reference packs that never act as professional signoff. | Evaluation/proposal/ledger/reference-pack packages and docs. | Evaluation, proposal, score, ledger, redaction tests. | Required for multi-model fan-out, GitHub writes, connectors, or external storage. |

## Current Cleared Items

1. OpenCode 1.15 source/type compatibility: `@opencode-ai/plugin@1.15.6` and `@opencode-ai/sdk@1.15.6` compile with the plugin.
2. OpenCode 1.15 isolated Release 1 smoke: packaged `0.1.0` exposed 11 tools, `chat.message`, direct diagnostic/status/usage paths, chat-intake routing, and FDS-1 runtime-closed probes without runtime authority.
3. `@flowdesk/opencode-plugin@0.1.1` was published to the public npm registry with exact `@opencode-ai/plugin@1.15.6` dependency.
4. Fresh public-registry install smoke for `0.1.1` passed in a throwaway profile: 11 tools, `chat.message`, direct doctor/status/usage, and Korean chat-intake routing succeeded with all real-dispatch/lane-launch/fallback/hard cancel authority flags false.
5. Active OpenCode profile migration from `0.1.0` to `0.1.1` completed at `~/.config/opencode`. The nested `@opencode-ai/plugin@1.15.6` and `@opencode-ai/sdk@1.15.6` resolve under FlowDesk while a separate top-level `@opencode-ai/plugin@1.3.12` remains for other plugins. Module-load smoke from the active profile passed.
6. Release 3 authority-promotion core contracts now exist for managed-dispatch beta promotion, typed reviewer verdict acceptance, fallback reselection/regate promotion, and controlled external-write promotion. These contracts compose the already-hardened evidence, approval, manifest, reviewer verdict, fallback, and redaction validators while preserving Release 1 non-dispatch defaults.

## 2026-05-21 Live Runtime Batch

Bounded OpenCode 1.15.5 runtime evidence is recorded in `docs/conformance/2026-05-21-release3-live-runtime-conformance.md`. The batch proved live OpenAI provider dispatch through the opt-in SDK adapter after correct manifest/approval/Guard binding, actual parent/child session creation, and coordinator-controlled three-reviewer fan-out with exact Claude Opus, Gemini Pro, and GPT model bindings. It also proved active-profile FlowDesk tool discovery, FDS-1 runtime unknown-property rejection, chat-message steering without hard no-reply/cancel fields, fallback terminal-blocked contract validation, and advisory-only operational-intelligence artifacts.

The parent-prompted fan-out attempt produced duplicate GPT children and an unmatched Claude sentinel, so FlowDesk must use coordinator-controlled child session creation rather than freeform parent-model fan-out instructions. Hard chat cancellation/no-reply, automatic fallback execution, external writes, and typed reviewer verdict approval remain blocked.

## 2026-05-21 Authority Hardening Batch

Post-live hardening is recorded in `docs/conformance/2026-05-21-release3-authority-hardening.md`. The pass tightened duplicate durable-evidence target rejection, approval issuer/method compatibility, approval consumption timing, dispatch manifest state transitions, complete/failed lane lifecycle invariants, invalid-cache reviewer binding suppression, fallback fresh-evidence requirements, and advisory-only operational-intelligence consistency. These changes reduce authority-smuggling and overclaim risk without enabling new runtime authority.

## 2026-05-21 Authority Promotion Batch

Promotion contract evidence is recorded in `docs/conformance/2026-05-21-release3-authority-promotion.md`. The pass adds explicit pure promotion evaluators instead of flipping existing Release 1 booleans, and the opt-in managed-dispatch adapter now requires the managed-dispatch promotion gate after manifest/approval pre-call permission and before injected SDK calls. Managed dispatch can be promoted only from an eligible Guard boundary, SDK pre-call permission, consumed `managed_dispatch_beta` approval, and matching audit/conformance refs. Reviewer verdicts can be accepted only when all canonical perspectives return typed `pass` verdicts with low uncertainty and a consumed `reviewer_fanout` approval. Fallback/reselection can advance only to a new-attempt full re-gate with consumed `fallback_reselection` approval. External writes can be authorized only for controlled redacted targets with dry-run, pre-write audit, redaction policy, content hash, and consumed `external_write` approval. Hard chat authority remains blocked.

## 2026-05-22 Hard Chat Blocked-State Hardening

Hard-chat blocked-state hardening is recorded in `docs/conformance/2026-05-22-release3-hard-chat-blocked-state.md`. The local probe contract now treats missing mutation, duplicate assistant reply, timeout/null not fail-closed, or malformed return not fail-closed as `blocked` rather than ordinary `steering_only`. This does not prove `noReply`, `cancel`, or `stop` authority; it prevents incomplete hard-chat observations from being overinterpreted as safe steering evidence.

## 2026-05-22 Durable Approval Provenance Hardening

Durable approval provenance hardening is recorded in `docs/conformance/2026-05-22-release3-durable-approval-provenance.md`. Session evidence now has a dedicated `production_approval_source` class whose reload path validates the full approval-source contract, and dispatch pre-call readiness has a pure durable evaluator that requires both a reloaded consumed approval source and a reloaded pre-dispatch audit entry. This closes an in-memory provenance gap without enabling provider calls, runtime dispatch, or default Release 1 dispatch.

## Next Safe Actions

1. Keep the managed-dispatch promotion gate wired only to the explicit opt-in adapter path, preserving the ordering: durable evidence reload, Guard approval, pre-dispatch audit, consumed scoped approval, manifest pre-call permission, promotion gate, then SDK call.
2. Probe `chat.message` mutation/throw/no-reply/cancel behavior under OpenCode 1.15 to either prove or keep blocked the hard chat-control authority (blocker #4). Timeout, malformed output, null output, and unsupported return fields must all map to explicit denied/blocked results, never implicit allow.
3. Add runtime emission paths for typed reviewer verdicts only after coordinator-controlled lane launch remains deterministic and no-output/missing-verdict lanes are classified as non-approvals.
4. Keep fallback/reselection as reselection plus full re-gate, not automatic provider switching. A promoted fallback decision must still pass the managed-dispatch gate before any provider call.
5. Keep external writes limited to controlled redacted targets with explicit user confirmation. GitHub, connector, storage, database, URL, and raw-path targets remain blocked unless a later dedicated write connector gate is designed and proven.

## 2026-05-21 Multi-Model Critical Review Synthesis

The blocker-resolution proposal was reviewed through three explicit lanes: Claude Opus, GPT frontier, and Gemini Pro. The initial Claude and Gemini sessions completed without deliverables and were not counted; fresh replacement lanes produced usable reviews. All valid reviewer lanes agreed that the prior plan was directionally safe but not implementation-ready until abstract blocker labels are converted into typed contracts, negative tests, and strict ordering.

Reviewer-specific findings:

1. Claude Opus: marked the plan conditional not-ready. Highest risks were approval replay/scope leakage, audit-before-dispatch durability, ambiguous full re-gate semantics, cache invalidation, no-output thresholds, and orphan lane cleanup. Required additions include nonce-backed atomic approval consumption, committed manifest persistence, idempotency/compensation fields, reviewer assignment-time verification, coordinator-issued fallback attempt ids, max fallback depth, and explicit advisory labeling for operational intelligence.
2. GPT frontier: marked the plan inconclusive/not implementation-ready. Highest risks were underspecified approval source authority, vague dispatch ordering, incomplete durable evidence scope, underdefined lane lifecycle states, false authority from exact-model cache, insufficient fallback separation, and operational intelligence crossing advisory boundaries. Required additions include formal contracts for approval issuance, dispatch attempts, pre-dispatch audit, lane lifecycle, availability cache, fallback decisions, and operational ledgers/reference packs.
3. Gemini Pro: marked the plan conceptually sound but critically underdeveloped. Highest risks were undefined fail-closed probe contracts, implicit trust in cache state, non-atomic audit/dispatch, missing approval invalidity guarantees, and ambiguous fallback re-gating. Required additions include timeout/error/malformed-output semantics for every probe, a stateful approval lifecycle, transaction-style audit-before-dispatch guarantees, deterministic reviewer planning, and traceable lane/fallback states.

Consensus corrections:

1. Every probe/check/gate must return an explicit `pass`, `blocked`, `denied`, `invalid`, or `inconclusive` state. Timeout, null, malformed output, missing output, missing verdict, and thrown errors are fail-closed.
2. Durable evidence and audit writes must be committed and reloadable before dependent authority can be consumed. Buffered/asynchronous write intent is not enough for dispatch or approval.
3. Production approval is a security primitive, not a diagnostic label. It must define issuer boundary, actor/profile/workflow/action scope, nonce/idempotency, expiry, revocation, one-shot atomic consumption, and pre-consumption audit linkage.
4. A dispatch attempt manifest must be the atomic work unit. It must bind workflow id, attempt id, actor/profile refs, target provider/model binding, evidence refs, approval ref, Guard decision ref, pre-dispatch audit ref, idempotency key, current state, and disabled authority flags until the final gate permits a call.
5. Lane lifecycle records must classify `complete`, `incomplete`, `no_output`, `missing_verdict`, `aborted`, `timeout`, `late_output`, `orphaned`, and `invocation_failed`. No-output and missing-verdict lanes are never approvals.
6. Exact-model availability cache is planning input only. It must be bound to active profile, OpenCode version, FlowDesk package version, registry hash, Policy Pack hash, provider identity, auth/account boundary, and local date. Availability never implies quota, usage freshness, provider health, review approval, or dispatchability.
7. Fallback/reselection must create a new attempt id, re-run every gate from scratch, capture fresh evidence, obtain fresh Guard/approval, enforce a maximum depth, and terminate in a visible blocked state. Fallback-derived evidence cannot authorize fallback.
8. Operational intelligence must remain advisory. Scores, reference packs, proposal fan-out, and ledgers must not be accepted as approval, Guard decision, professional signoff, dispatch authority, or external-write authority.

## Corrected Execution Order

The dependency-safe order is:

1. Blocker #5 durable evidence foundation: extend reload/fail-closed coverage, redaction checks, stale/drift/version tests, and doctor-visible states.
2. Blocker #3 FDS-1 runtime/provider-facing schema probe and blocker #4 chat hook authority probe: build explicit fail-closed probe result contracts. #4 remains independent from non-chat Release 2 work; if hard control is unproven, steering-only remains the permanent safe state until a first-class boundary appears.
3. Blocker #6 production approval source: implement scoped issuance, pre-consumption audit linkage, expiry, revocation, and atomic one-shot consumption.
4. Blocker #7 single-step dispatch manifest: implement manifest/audit ordering and injected SDK spy tests proving zero calls before committed audit and valid consumed approval. Live dispatch remains confirmation-gated.
5. Blocker #8 lane lifecycle: implement typed lifecycle records, timeout/no-output/missing-verdict/late-output/orphan classifications, reference-kind separation, and bounded retry metadata.
6. Blocker #9 exact-model availability cache and reviewer plan: implement same-day cache, assignment-time verification, deterministic reviewer planning, and no silent lower-tier/alias substitution.
7. Blocker #10 fallback/reselection: implement full fresh re-gate, coordinator-issued new attempt id, max fallback depth, and terminal blocked states.
8. Blocker #11 operational intelligence: implement local advisory schemas/tests first; require separate opt-in and confirmation before fan-out, GitHub writes, connectors, or external storage.

## Contract Requirements Before Each Gate Can Close

Contract status as of 2026-05-21: blockers #3 through #11 have local contract/test foundations, a bounded live runtime batch has proven selected OpenCode/provider/lane surfaces under explicit user approval, a follow-up authority-hardening batch tightened local negative tests around evidence, approval, dispatch, lanes, cache planning, fallback, and advisory artifacts, and an authority-promotion batch now defines explicit fail-closed promotion evaluators for managed dispatch, typed reviewer verdict acceptance, fallback reselection/regate, and controlled external writes. The live batch closes only the observed provider smoke, opt-in managed-dispatch adapter call, actual child session launch, coordinator-controlled reviewer fan-out, active-profile tool discovery, FDS-1 runtime validation, and non-authorizing fallback/operational-intelligence artifacts. Hard chat authority and automatic fallback execution remain blocked; external writes are promoted only as controlled redacted write requests, not GitHub/connector/storage writes.

### Blocker #3: FDS-1 Schema Conversion

- Add a probe result contract that distinguishes `probe_pass`, `probe_blocked`, and `probe_invalid`.
- Unknown properties, malformed events, missing tool schemas, provider-facing conversion failure, and runtime validator mismatch must block.
- Local runtime-closed validation is not provider-facing proof; docs must label the evidence source precisely.

### Blocker #4: Chat Hook Hard-Control

- Add explicit outcomes for mutation-only, throw, unsupported `noReply`, unsupported cancel/stop, timeout, null return, malformed return, and duplicate assistant reply.
- Missing first-class hard-control proof must result in `hardCancelOrNoReplyAuthority=false`; timeout/null, malformed-return, duplicate-reply, or no-mutation gaps must be recorded as blocked hard-chat authority rather than ordinary steering-only behavior.

### Blocker #5: Durable Production Evidence

- Expand evidence classes beyond usage/runtime echo/telemetry where needed for configured verification, sanitized auth, external auth/provider policy, approval, and pre-dispatch audit refs.
- Production approval source evidence must be durably written/reloaded through its own evidence class and validated with the full approval-source contract before dispatch pre-call readiness can depend on it.
- Test malformed, truncated, stale, drifted, cross-workflow, cross-profile, schema-version mismatch, symlink/root escape, partial write, and redaction-failure cases.
- Doctor output must expose redacted fail-closed state without raw payloads or secret-bearing paths.

### Blocker #6: Production Approval Source Authority

- Define issuer boundary and forbid FlowDesk self-authorization for production dispatch.
- Bind approval to actor ref, profile ref, workflow id, attempt id, action type, provider/model binding hash, evidence bundle hash, Guard decision ref, issuance audit ref, expiry, and nonce/idempotency key.
- Consumption must be atomic and one-shot. Consumed, expired, revoked, denied, drifted, forged, or scope-mismatched approvals block.

### Blocker #7: Single-Step Managed Dispatch Beta

- Dispatch order is: validate evidence reloads -> validate approval source -> Guard decision -> write manifest -> write and reload pre-dispatch audit -> consume approval -> only then injected SDK call.
- Local readiness evaluators must distinguish object-level pre-call validation from durable-provenance pre-call validation; provider/runtime dispatch may only depend on the durable path once wired.
- Injected SDK spy tests must prove zero SDK/provider calls for every pre-call failure.
- SDK failure after manifest/audit write must update the manifest to failed/quarantined without reusing approval or attempt id.

### Blocker #8: Actual Delegated Lane Launch

- Record parent/child/session/message refs with strict kind separation.
- Classify timeout, no-output, missing-verdict, aborted, late-output, orphaned, invocation-failed, and complete states.
- Define orphan max age, late-output handling, retry/idempotency behavior, and cleanup/audit refs before runtime lane proof can count.

### Blocker #9: Top-Tier Multi-Perspective Reviewer Lanes

- Cache keys must include active profile, OpenCode version, FlowDesk package version, registry hash, Policy Pack hash, provider identity, auth/account boundary, and local date.
- Assignment must re-check cache freshness and registered/highest-tier predicates at fan-out time.
- Cache availability cannot satisfy usage/quota/provider-health/approval/Guard gates.

### Blocker #10: Managed Fallback/Reselection

- Full re-gate means all gates from blocker #7 plus runtime compatibility, policy eligibility, fresh usage/health, fresh evidence, fresh approval, fresh Guard decision, and fresh pre-dispatch audit.
- Each fallback must have a coordinator-issued new attempt id, parent attempt ref, reason label, max-depth counter, and terminal blocked state.
- Silent chained fallback and same-attempt fallback are forbidden.

### Blocker #11: Operational Intelligence

- Hard filters run before scoring. Scoring is advisory-only and cannot be consumed as gate input.
- External ledger writes, GitHub writes, connectors, and proposal fan-out require explicit opt-in and confirmation.
- Reference packs must be source-grounded, redacted, and barred from acting as legal/medical/patent/professional signoff.
