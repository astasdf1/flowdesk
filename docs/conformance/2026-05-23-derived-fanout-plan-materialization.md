# Derived Fan-Out Plan Materialization

Date: 2026-05-23

## Scope

This note records the optional product-path materialization that persists a ready reviewer fan-out diagnostic plan as durable `reviewer_fanout_plan` session evidence.

## Implemented

The OpenCode plugin local non-dispatch adapter can now accept `persistDerivedFanoutPlanEvidence` and an optional `fanoutPlanEvidenceId` inside explicit `reviewerFanoutDiagnostics` options. When diagnostic derivation from reloaded durable exact-model cache evidence returns `fanout_ready`, the adapter prepares and applies a `reviewer_fanout_plan` session-evidence write intent using the existing closed validator and durable evidence apply path.

Blocked, drifted, missing, invalid, or ambiguous selected-cache evidence does not write fan-out plan evidence. Failed materialization surfaces through the adapter's durable read/write error state instead of being treated as successful diagnostics.

## Safety Boundary

This slice materializes only a planning artifact that has already preserved `launch_attempted=false`, `approval_inferred=false`, `actualLaneLaunch=false`, `providerCall=false`, `runtimeExecution=false`, and `dispatch_authority_enabled=false`. It does not discover models, refresh caches, call providers, launch reviewer lanes, accept verdicts, authorize dispatch, or run SDK prompts.

## Verification

Product-path tests cover ready cache evidence persisting exactly one derived `reviewer_fanout_plan` record with disabled authority flags, and blocked cache evidence persisting no fan-out plan. Typecheck, touched-file LSP diagnostics, full test suite, and diff whitespace checks passed for this slice.

## Remaining Gaps

Actual cache discovery acquisition, provider probing, runtime launch approval, SDK-client lane launch, typed verdict persistence, and verdict acceptance remain later-gated.
