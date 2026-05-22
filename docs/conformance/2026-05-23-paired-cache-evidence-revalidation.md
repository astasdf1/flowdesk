# Paired Cache Evidence Revalidation

Date: 2026-05-23

## Scope

This note records the paired exact-model cache evidence revalidation slice for reviewer assignment. It prevents reviewer fan-out from using a raw cache record unless that cache is paired with a valid cache-hit refresh plan for the same context.

## Implemented

`revalidateFlowDeskReviewerAssignmentsFromCacheEvidenceV1` wraps the existing assignment revalidation and adds paired evidence checks.

The helper requires:

1. A valid `flowdesk.exact_model_availability_cache.v1` cache record.
2. A valid `flowdesk.exact_model_availability_cache_refresh_plan.v1` refresh plan.
3. Refresh plan state `cache_hit`.
4. `cache_usable_for_assignment=true`.
5. Matching cache id.
6. Matching expected local date, active profile, OpenCode version, FlowDesk package version, registry hash, Policy Pack hash, and auth/account boundary.
7. Matching cache context echoed by the refresh plan.

## Fail-Closed Cases

The helper blocks and returns no eligible bindings when:

1. The refresh plan is invalid or forged.
2. The refresh plan is `refresh_required` or `blocked`.
3. The refresh plan is not usable for assignment.
4. The refresh plan cache id does not match the cache record.
5. Expected context drifts from the caller context.
6. Cached context drifts from the paired cache record.

## Safety Boundary

This slice does not launch reviewer lanes, call providers, discover models, refresh the cache, accept verdicts, approve dispatch, or infer provider health/usage freshness. It only controls whether eligible reviewer bindings can be exposed from paired cache evidence.

## Verification

Verification passed locally with paired cache revalidation tests, typecheck, and the full test suite during the work session.

## Remaining Gaps

Product fan-out still needs a selector that derives the paired cache/cache-refresh inputs from reloaded session-evidence entries. Actual cache discovery acquisition and provider probing remain later-gated.
