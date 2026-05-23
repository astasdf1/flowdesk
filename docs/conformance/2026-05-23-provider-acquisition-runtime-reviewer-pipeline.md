# Provider Acquisition to Runtime Reviewer Execution Pipeline

Date: 2026-05-23

## Scope

This note records the end-to-end nested opt-in pipeline that chains exact-model provider acquisition into cache materialization, reviewer fanout planning, runtime launch-plan materialization, and runtime reviewer execution within a single explicit `flowdesk_exact_model_provider_acquisition_live_test` invocation.

The pipeline is gated entirely behind nested opt-in flags. No step engages without the previous step succeeding. The chain still does not use `opencode run`, infer approval from output, perform fallback/reselection, write remote targets, or promote default dispatch authority.

## Implemented Chain

`flowdesk_exact_model_provider_acquisition_live_test` now supports nesting `runtimeReviewerExecution` under `cacheMaterialization.reviewerFanoutPlanning.runtimeLaunchPlanMaterialization`. The chain executes in order:

1. Exact-model provider acquisition with sanitized provider check evidence.
2. Same-day cache and cache-hit refresh-plan materialization from the acquisition result.
3. Reviewer fanout planning from the reloaded selected cache pair.
4. Durable reviewer fanout plan evidence persistence.
5. Runtime lane launch-plan materialization for the requested launch-plan evidence ids.
6. Runtime reviewer execution that launches each persisted launch plan through the injected OpenCode SDK client, persists `running` and `complete` lifecycle evidence, persists `reviewer_verdict` evidence, and runs typed-verdict acceptance plus durable reviewer-verdict linkage.

The SDK client for step 6 is selected from `exactModelProviderAcquisitionLiveTest.runtimeReviewerExecutionClient`, `exactModelProviderAcquisitionLiveTest.sdkClient`, or the underlying `PluginInput.client`. It must satisfy the `FlowDeskManagedDispatchBetaOpenCodeClientV1` shape.

Step 6 is invoked only when:

1. The previous steps succeed without blocking labels.
2. The runtime reviewer execution option includes a valid `attemptId`, `parentSessionId`, observed timestamp (optional), consumed `reviewer_fanout` approval, and one verdict expectation per launch-plan evidence id.
3. A managed-dispatch-shaped SDK client is available.

If any precondition is missing, step 6 is skipped silently and the chain still returns the lower-level step results.

## Verification

Targeted plugin verification is covered by:

```bash
npm test --workspace @flowdesk/opencode-plugin -- --test-name-pattern "provider acquisition can chain|provider acquisition chained reviewer|runtime reviewer execution bridge"
```

The added coverage proves:

1. The full chain executes from provider acquisition through runtime reviewer execution in one tool call, returning `runtime_reviewer_execution_completed`, `verdicts_accepted`, and `durable_verdicts_accepted` with three linked verdicts and three linked lifecycle refs.
2. After the chain, durable evidence contains the expected `runtime_lane_launch_plan`, `reviewer_verdict`, and `lane_lifecycle` records.
3. Without the nested `runtimeReviewerExecution` opt-in, the chain stops at launch plan materialization and no SDK calls run.

## Authority Boundary

The chained pipeline keeps default `realOpenCodeDispatch`, `fallbackAuthority`, and `hardCancelOrNoReplyAuthority` false on the returned linkage authority artifact. Provider/runtime authority on linkage stays false; the underlying explicit step 6 SDK calls remain bounded reviewer-lane execution that the user has explicitly opted into.

## Interpretation

This closes the bounded end-to-end user-facing pipeline from active provider availability to durable typed reviewer verdict acceptance in a single explicit invocation. Remaining product gates are still separate: fallback/reselection, remote connector writes, and default dispatch promotion.
