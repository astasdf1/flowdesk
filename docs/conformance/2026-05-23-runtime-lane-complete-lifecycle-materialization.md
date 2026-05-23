# Runtime Lane Complete Lifecycle Materialization

Date: 2026-05-23

## Scope

This note records the adapter-side bridge from an explicit injected-SDK reviewer lane launch result plus an observed typed reviewer verdict to reloadable `complete` `lane_lifecycle` session evidence.

The bridge persists lifecycle linkage only. It does not launch reviewer lanes by default, infer approval from ordinary output, accept verdicts, perform fallback/reselection, write remote targets, or promote dispatch/runtime authority.

## Implemented Materializer

`materializeFlowDeskRuntimeLaneCompleteLifecycleEvidenceV1` now:

1. Requires a valid `launch_ready` `flowdesk.runtime_lane_launch_plan.v1`.
2. Requires a matching `lane_launch_started` result from `launchFlowDeskInjectedSdkRuntimeLaneFromPlanV1`.
3. Requires a `verdict_observed` result from `observeInjectedSdkReviewerVerdictV1`.
4. Revalidates the observed `flowdesk.top_tier_review_verdict.v1` before writing lifecycle evidence.
5. Writes `flowdesk.lane_lifecycle_record.v1` with `state: "complete"`, child/message refs from the launch result, and the observed `verdict_ref`.
6. Carries explicit `output_ref`, `runtime_echo_ref`, and `telemetry_ref` into the lifecycle record so later durable verdict linkage can require concrete runtime evidence refs.
7. Writes through the existing session-evidence prepare/apply/reload path and rejects duplicate lifecycle evidence ids before writes.

Durable complete lifecycle records keep `dispatch_authority_enabled=false`, `providerCall=false`, `actualLaneLaunch=false`, and `runtimeExecution=false`; they are evidence for durable verdict linkage, not approval or runtime authority.

## Verification

Targeted plugin verification is covered by:

```bash
npm test --workspace @flowdesk/opencode-plugin -- --test-name-pattern "complete lifecycle|runtime lane launch lifecycle|injected sdk runtime lane|durable reviewer verdict linkage"
```

The added coverage proves:

1. A successful fake-client reviewer lane launch plus schema-valid observed typed verdict materializes reloadable `complete` lifecycle evidence.
2. The materialized lifecycle record links the child session, message ref, verdict ref, output ref, runtime echo ref, and telemetry ref.
3. Missing or non-typed verdict observations write no lifecycle evidence.
4. Duplicate complete lifecycle evidence ids block before additional writes.

## Interpretation

This closes the local durable linkage path that the existing durable reviewer-verdict linkage adapter expects: a `reviewer_verdict` evidence record plus a complete `lane_lifecycle` record for the same workflow and attempt. The next safe work is an active-environment reviewer lane smoke that exercises launch, verdict observation, verdict evidence materialization, complete lifecycle materialization, durable linkage, and typed verdict acceptance through the explicit SDK path while keeping default Release 1 dispatch closed.
