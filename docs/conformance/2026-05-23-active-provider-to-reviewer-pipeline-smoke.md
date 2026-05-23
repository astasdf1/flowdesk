# Active Provider to Reviewer Pipeline Smoke

Date: 2026-05-23

## Scope

This note records a bounded active-environment smoke of the chained `flowdesk_exact_model_provider_acquisition_live_test` tool with all nested opt-in steps enabled. A single tool invocation performed live provider acquisition through cache materialization, reviewer fanout planning, runtime launch plan materialization, and runtime reviewer execution.

The smoke used `opencode serve` plus the OpenCode SDK. It did not use `opencode run`, did not print token material, did not print raw provider/auth/model payloads, did not perform fallback/reselection, did not write remote targets, and did not promote default Release 1 dispatch authority.

## Preconditions

The harness used a temporary `.flowdesk` evidence root and a real `openai/gpt-5.4-mini-fast` provider call. Explicit nested opt-in:

1. `exactModelProviderAcquisitionLiveTest.enabled=true` with `promptBackedCheck.enabled=true`, `allowProviderCall=true`, and exact allowlist `openai/gpt-5.4-mini-fast`.
2. `cacheMaterialization.enabled=true` with explicit cache and cache-refresh evidence ids.
3. `cacheMaterialization.reviewerFanoutPlanning.enabled=true` with attempt id, parent session ref, agent ref, pre-launch audit ref, lane launch approval ref, and persisted fan-out plan evidence id.
4. `cacheMaterialization.reviewerFanoutPlanning.runtimeLaunchPlanMaterialization.enabled=true` with three target launch-plan evidence ids, SDK client available, and durable evidence root ref.
5. `cacheMaterialization.reviewerFanoutPlanning.runtimeLaunchPlanMaterialization.runtimeReviewerExecution.enabled=true` with attempt id, parent session id, consumed `reviewer_fanout` approval, and one verdict expectation per launch plan.

The injected SDK client was the live OpenCode SDK client returned by `createOpencode({ port: 0 })`.

## Result

The single tool invocation returned a sanitized chained summary:

```json
{
  "serverReady": true,
  "providerAcquisitionStatus": "provider_acquisition_recorded",
  "providerCallAttempted": true,
  "cacheMaterializationState": "materialized",
  "pairSelectionReady": true,
  "fanoutState": "fanout_ready",
  "fanoutPlanState": "fanout_ready",
  "fanoutPersisted": true,
  "fanoutRuntimeLaneLaunchRequests": 3,
  "launchPlanMaterializationState": "materialized",
  "launchPlanCount": 3,
  "runtimeReviewerExecutionStatus": "runtime_reviewer_execution_completed",
  "runtimeReviewerLaneCount": 3,
  "acceptanceStatus": "verdicts_accepted",
  "durableLinkageStatus": "durable_verdicts_accepted",
  "linkedVerdictCount": 3,
  "linkedLifecycleCount": 3,
  "acceptedPerspectives": [
    "policy_security",
    "architecture",
    "verification_implementation"
  ],
  "reloadOk": true,
  "blockedCount": 0,
  "evidenceCounts": {
    "exact_model_availability_cache": 1,
    "exact_model_availability_cache_refresh_plan": 1,
    "exact_model_availability_cache_provider_acquisition_result": 1,
    "reviewer_verdict": 3,
    "reviewer_fanout_plan": 1,
    "runtime_lane_launch_plan": 3,
    "lane_lifecycle": 6
  }
}
```

Durable session evidence reload returned `ok=true` and `blockedCount=0` after the chain, with one provider acquisition result, one cache, one cache-refresh plan, one persisted reviewer fanout plan, three runtime launch plans, three reviewer verdict records, and six lane lifecycle records (`running` plus `complete` per lane).

## Authority Boundary

The reported result authority kept:

1. `realOpenCodeDispatch=false`.
2. `providerCall=false` on the artifact authority (despite the chain having performed an explicit provider acquisition check and explicit reviewer lane SDK calls, neither becomes default authority).
3. `runtimeExecution=false`.
4. `actualLaneLaunch=false`.
5. `fallbackAuthority=false`.
6. `hardCancelOrNoReplyAuthority=false`.
7. `dispatchAuthorityEnabled=false`.
8. `exactModelProviderAcquisitionRecorded=true` (a diagnostic acquisition flag, not dispatch authority).
9. `reviewerLaunchAuthorized=false`.

## Interpretation

This closes the bounded active end-to-end pipeline from live provider availability acquisition to durable typed reviewer verdict acceptance through a single user-facing tool call. The chain is fully gated by nested opt-in flags and a consumed reviewer-fanout approval; missing any one of them stops the chain at the previous step with no SDK calls beyond what the lower step required.

Remaining product gates are still separate and unchanged: fallback/reselection, remote connector writes, hard-chat authority, and default dispatch promotion.
