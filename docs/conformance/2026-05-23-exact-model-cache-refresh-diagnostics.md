# Exact-Model Cache Refresh Diagnostics

Date: 2026-05-23

## Scope

This note records the non-authorizing exact-model availability cache refresh planning slice. The slice exists to prevent reviewer assignment and fan-out from depending on stale or mismatched cache records.

## Implemented

`flowdesk.exact_model_availability_cache_refresh_plan.v1` now classifies cache state as `cache_hit`, `refresh_required`, or `blocked`.

The plan binds cache usability to:

1. Local date.
2. Active profile ref.
3. OpenCode version ref.
4. FlowDesk package version ref.
5. Registry hash.
6. Policy Pack hash.
7. Auth/account boundary ref.

Missing, stale, or drifted cache inputs produce `refresh_required`. Invalid cache/context inputs produce `blocked`. Only a validated same-context cache produces `cache_hit` and `cache_usable_for_assignment=true`.

## Safety Boundary

The plan is diagnostic only. It does not discover models, refresh the cache, launch reviewer lanes, call providers, execute runtime work, or authorize dispatch.

The contract requires:

1. `discovery_attempted=false`.
2. `refresh_attempted=false`.
3. `providerCall=false`.
4. `actualLaneLaunch=false`.
5. `runtimeExecution=false`.
6. `dispatch_authority_enabled=false`.

`/flowdesk-doctor` and `/flowdesk-status` can now surface cache-refresh blockers before reviewer fan-out without promoting execution authority.

## Verification

Targeted verification for this slice should include:

1. `npm test -- --test-name-pattern "availability cache refresh|exact-model cache|doctor and status surface"`
2. `npm run typecheck`
3. `GIT_MASTER=1 git diff --check`

## Remaining Gaps

Actual cache discovery acquisition, durable cache-refresh/cache evidence persistence, provider/model probing, reviewer runtime launch approval, SDK-client launch readiness, and live lane conformance remain later gates.
