# Reloaded Cache Evidence Selector

Date: 2026-05-23

## Scope

This note records the non-authorizing selector that derives a single exact-model cache/cache-refresh evidence pair from reloaded session evidence. It closes the gap between durable evidence reload and paired reviewer assignment revalidation inputs.

## Implemented

`selectFlowDeskExactModelCacheEvidencePairV1` scans `FlowDeskSessionEvidenceReloadResultV1` entries and returns `pair_ready` only when exactly one valid `flowdesk.exact_model_availability_cache_refresh_plan.v1` matches the requested local date, active profile, OpenCode version, FlowDesk package version, registry hash, Policy Pack hash, and auth/account boundary.

The matching refresh plan must be in `cache_hit` state with `cache_usable_for_assignment=true`. The selector then requires exactly one valid `flowdesk.exact_model_availability_cache.v1` record whose cache id and echoed cache context match the refresh plan.

## Fail-Closed Cases

The selector blocks when:

1. Session evidence reload is invalid.
2. No matching cache-hit refresh plan exists.
3. More than one matching cache-hit refresh plan exists.
4. The matching refresh plan has no matching cache record.
5. More than one matching cache record exists.
6. Cache or refresh-plan records are malformed, drifted, refresh-required, blocked, or otherwise fail validation.

## Safety Boundary

The selector does not discover models, refresh the cache, call providers, launch reviewer lanes, accept verdicts, approve dispatch, or infer provider health/usage freshness. It preserves `providerCall=false`, `actualLaneLaunch=false`, `runtimeExecution=false`, and `dispatch_authority_enabled=false`.

## Verification

Verification for this slice covered selector-ready, drifted, missing, and ambiguous evidence cases, plus full project typecheck and test execution during the work session.

## Remaining Gaps

Product reviewer fan-out still needs to consume this selected pair and feed it through paired assignment revalidation before fan-out planning. Actual cache discovery acquisition and provider probing remain later-gated.
