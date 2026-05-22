# Reviewer Fan-Out Evidence and Diagnostics

Date: 2026-05-23

## Scope

This slice persists and surfaces reviewer fan-out planning state. It does not discover models, launch reviewer lanes, call providers, accept verdicts, or promote dispatch authority.

## Implemented Behavior

Session evidence now supports a `reviewer_fanout_plan` evidence class for `flowdesk.reviewer_fanout_plan.v1` records. Prepare, apply, and reload paths validate the record through the closed fan-out planner validator, so malformed plans or forged authority flags block before they can become durable evidence.

`/flowdesk-doctor` can expose redacted reviewer fan-out diagnostics in the OpenCode compatibility section:

- fan-out state
- required and planned perspective counts
- runtime launch plan requirement
- lane-launch approval requirement
- launch-attempt flag
- approval-inference flag
- provider/lane/runtime authority flags
- blocked labels

`/flowdesk-status` can surface a blocked reviewer fan-out plan as a redacted conformance blocker for the active workflow. A ready fan-out plan removes that blocker, but still does not launch lanes.

## Safety Boundary

The slice keeps all reviewer fan-out evidence non-authorizing:

- `launch_attempted=false`
- `approval_inferred=false`
- `dispatch_authority_enabled=false`
- `providerCall=false`
- `actualLaneLaunch=false`
- `runtimeExecution=false`

Durable fan-out evidence proves topology planning only. It does not prove daily cache discovery, runtime launch approval, SDK-client availability, live lane conformance, typed verdict acceptance, Guard approval, or provider-call authority.

## Verification

Targeted verification passed:

```text
npm test -- --test-name-pattern "session evidence|status surfaces reviewer fanout|doctor and status surface"
tests 409
pass 409
fail 0
```

LSP diagnostics on touched TypeScript files reported no errors; Biome organize-import informational hints remain non-blocking.

## Remaining Gates

Next safe work is daily exact-model availability cache discovery/refresh and its diagnostics, because reviewer fan-out still depends on externally supplied cache records. Actual reviewer lane launch remains blocked until runtime launch planning, explicit lane-launch approval, SDK-client availability, durable evidence-root refs, live lane conformance, and typed verdict persistence all pass.
