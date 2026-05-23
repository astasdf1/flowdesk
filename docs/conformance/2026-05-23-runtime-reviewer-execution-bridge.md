# Runtime Reviewer Execution Bridge

Date: 2026-05-23

## Scope

This note records the explicit server/tool bridge from persisted `runtime_lane_launch_plan` evidence to active reviewer lane execution, typed verdict materialization, complete lifecycle materialization, durable linkage, and typed verdict acceptance.

The bridge is not default routing. It registers only when `runtimeReviewerExecution.enabled=true`, an injected SDK client is available, and a durable state root is configured. It does not use `opencode run`, does not infer approval from ordinary output, does not perform fallback/reselection, does not write remote targets, and does not promote default dispatch authority.

## Implemented Tool

`flowdesk_runtime_reviewer_execution` now:

1. Reloads durable session evidence from the configured root.
2. Selects only the caller-provided `runtime_lane_launch_plan` evidence ids.
3. Requires `allowActualLaneLaunch=true`, `workflowId`, `attemptId`, `parentSessionId`, a consumed `reviewer_fanout` approval, and one explicit verdict expectation per launch plan.
4. Launches each persisted plan through `launchFlowDeskInjectedSdkRuntimeLaneFromPlanV1` using the injected SDK client.
5. Persists a `running` lifecycle record for each started lane.
6. Observes only schema-valid typed `flowdesk.top_tier_review_verdict.v1` output matching the supplied lane plan ref, binding ref, and perspective.
7. Persists each observed reviewer verdict as durable `reviewer_verdict` evidence.
8. Persists a `complete` lifecycle record with verdict/output/runtime-echo/telemetry refs for each lane.
9. Reloads evidence and runs the existing typed-verdict acceptance plus durable reviewer-verdict linkage adapters.

Default server behavior remains closed. Without the explicit option, the tool is not registered. Without a consumed reviewer-fanout approval, the tool blocks before SDK calls.

## Verification

Targeted plugin verification is covered by:

```bash
npm test --workspace @flowdesk/opencode-plugin -- --test-name-pattern "runtime reviewer execution|provider acquisition cache materialization can derive reviewer fanout"
```

The added tests prove:

1. The bridge launches three persisted runtime launch plans using the current OpenCode SDK request shape.
2. It materializes three durable reviewer verdict records and six lifecycle records (`running` plus `complete`).
3. It returns `runtime_reviewer_execution_completed`, `verdicts_accepted`, and `durable_verdicts_accepted` with three linked verdicts and three linked lifecycle refs.
4. The tool is absent by default.
5. Missing consumed reviewer-fanout approval blocks before SDK `create` or `prompt` calls.

## Interpretation

This closes the explicit product bridge from provider-acquisition-derived launch-plan evidence to active reviewer execution. The next safe product step is to add a bounded end-to-end server smoke or command path that invokes provider acquisition, cache/fan-out/launch-plan materialization, then this reviewer execution bridge in one explicit user-approved flow. Fallback/reselection, remote connector writes, and default dispatch promotion remain separate gates.
