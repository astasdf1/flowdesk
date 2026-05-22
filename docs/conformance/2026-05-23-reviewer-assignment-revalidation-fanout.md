# Reviewer Assignment Revalidation and Fan-Out Planning

Date: 2026-05-23

## Scope

This slice adds non-authorizing reviewer productization contracts after the runtime lane launch/lifecycle foundation. It does not launch reviewer lanes, call providers, accept verdicts, persist durable fan-out evidence, or register a default server route.

## Implemented Contracts

`flowdesk.reviewer_assignment_revalidation.v1` rechecks an exact-model availability cache at assignment time against the expected local date, active profile, OpenCode version, FlowDesk package version, registry hash, Policy Pack hash, and auth/account boundary. It exposes eligible bindings only when the cache is schema-valid, same-day, context-matched, concrete, registered, available, and highest-tier eligible.

`flowdesk.reviewer_fanout_plan.v1` deterministically materializes one `flowdesk.runtime_lane_launch_request.v1` per required reviewer perspective. Fan-out readiness means launch requests were planned, not that lanes can run. Every plan still requires a later runtime launch plan and explicit lane-launch approval.

## Fail-Closed Behavior

Revalidation blocks stale dates, active-profile drift, OpenCode/FlowDesk version drift, registry or Policy Pack hash drift, auth/account-boundary drift, invalid/alias model ids, and registered-available lower-tier-only substitutions.

Fan-out planning blocks when assignment revalidation is blocked, required perspectives are malformed or incomplete, generated runtime launch requests are invalid, or authority fields are forged.

Both contracts keep `dispatch_authority_enabled=false`, `providerCall=false`, `actualLaneLaunch=false`, and `runtimeExecution=false`. The fan-out plan additionally records `launch_attempted=false` and `approval_inferred=false`.

## Verification

Local targeted verification passed:

```text
npm test -- --test-name-pattern "availability|reviewer fanout|reviewer assignment"
tests 408
pass 408
fail 0
```

## Remaining Gates

Actual reviewer lanes remain blocked until daily exact-model cache discovery/refresh, durable fan-out evidence, runtime lane launch planning, lane-launch approval, SDK-client availability, durable evidence-root refs, live launch conformance, typed verdict persistence, and durable verdict linkage all pass.
