# Selected Cache Fan-Out Planning

Date: 2026-05-23

## Scope

This note records the non-authorizing composition helper that connects reloaded exact-model cache evidence selection to paired assignment revalidation and deterministic reviewer fan-out planning.

## Implemented

`planFlowDeskReviewerFanoutFromReloadedCacheEvidenceV1` composes the existing fail-closed primitives:

1. `selectFlowDeskExactModelCacheEvidencePairV1` derives exactly one cache/cache-refresh pair from reloaded session evidence.
2. `revalidateFlowDeskReviewerAssignmentsFromCacheEvidenceV1` exposes eligible reviewer bindings only from a valid cache-hit refresh plan paired to the same cache record and expected context.
3. `planFlowDeskReviewerFanoutV1` materializes deterministic runtime lane launch requests for required reviewer perspectives only after assignment revalidation succeeds.

The helper returns the selection, revalidation, and fan-out plan together so callers can surface every intermediate blocker without treating diagnostics as execution authority.

## Fail-Closed Cases

The helper blocks when reloaded session evidence is invalid, the cache/cache-refresh pair is missing or ambiguous, the selected evidence drifts from requested context, paired assignment revalidation blocks, or fan-out planning validation fails. Blocked paths produce no runtime lane launch requests.

## Safety Boundary

This slice does not discover models, refresh caches, call providers, launch reviewer lanes, accept verdicts, approve dispatch, or infer provider health/usage freshness. It keeps `dispatch_authority_enabled=false`, `providerCall=false`, `actualLaneLaunch=false`, and `runtimeExecution=false`.

## Verification

Verification covered ready composition from persisted cache evidence to fan-out planning, plus missing/drifted/ambiguous cache evidence blocking before runtime launch request materialization. Full work-session verification should include typecheck, full test suite, LSP diagnostics on touched TypeScript files, and `GIT_MASTER=1 git diff --check`.

## Remaining Gaps

Doctor/status or product command paths still need to call this helper with real reloaded durable evidence before user-visible fan-out diagnostics can be derived automatically. Actual cache discovery acquisition, provider probing, runtime launch approval, SDK-client launch, and typed verdict persistence remain later-gated.
