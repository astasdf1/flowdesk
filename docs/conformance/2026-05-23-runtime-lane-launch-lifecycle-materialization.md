# Runtime Lane Launch Lifecycle Materialization

Date: 2026-05-23

## Scope

This note records the adapter-side bridge from an explicit injected-SDK runtime lane launch result to reloadable `lane_lifecycle` session evidence.

The bridge persists lifecycle evidence only. It does not observe or accept typed verdicts, infer approval from output, promote dispatch, register a default server route, perform fallback/reselection, or write remote targets.

## Implemented Materializer

`materializeFlowDeskRuntimeLaneLaunchLifecycleEvidenceV1` now:

1. Requires a valid `launch_ready` `flowdesk.runtime_lane_launch_plan.v1`.
2. Accepts only `lane_launch_started` or `lane_launch_failed` adapter results.
3. Requires workflow, attempt, lane, and parent-session refs to match the launch plan.
4. Converts `lane_launch_started` into `flowdesk.lane_lifecycle_record.v1` with `state: "running"`.
5. Converts `lane_launch_failed` into `state: "invocation_failed"`.
6. Normalizes launch message refs into the durable lifecycle `msg-*` ref kind.
7. Writes through the existing session-evidence prepare/apply/reload path and rejects duplicate lifecycle evidence ids before writes.

Durable lifecycle records keep `dispatch_authority_enabled=false`, `providerCall=false`, `actualLaneLaunch=false`, and `runtimeExecution=false`; they are evidence for later lifecycle/verdict gates, not authority grants.

## Verification

Targeted plugin verification is covered by:

```bash
npm test --workspace @flowdesk/opencode-plugin -- --test-name-pattern "runtime lane launch lifecycle|injected sdk runtime lane"
```

The added coverage proves:

1. A successful fake-client runtime lane launch materializes reloadable `running` lifecycle evidence with child/message refs.
2. Blocked pre-launch results write no lifecycle evidence.
3. Prompt failure materializes reloadable `invocation_failed` lifecycle evidence.
4. Duplicate lifecycle evidence ids block before additional writes.

## Interpretation

This closes the durable evidence bridge immediately after an explicit runtime lane launch adapter result. The next safe work is a bounded active-environment smoke that launches a reviewer lane through this adapter, persists lifecycle evidence, observes typed verdict output, and then uses the existing verdict materialization/linkage gates. Acceptance, fallback/reselection, remote writes, and dispatch promotion remain separate gates.
