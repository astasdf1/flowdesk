# Provider Acquisition Runtime Launch-Plan Bridge

Date: 2026-05-23

## Scope

This note records the explicit OpenCode plugin bridge from provider acquisition cache materialization and persisted reviewer fan-out evidence to durable runtime lane launch-plan materialization.

The bridge remains opt-in and non-launching. It does not call reviewer SDK prompts, launch reviewer lanes, execute provider calls beyond the separate acquisition check, observe lane output, accept typed verdicts, perform fallback/reselection, run remote writes, or promote dispatch/runtime authority.

## Implemented Wiring

`@flowdesk/opencode-plugin` now accepts an additional nested option under `exactModelProviderAcquisitionLiveTest.cacheMaterialization.reviewerFanoutPlanning`:

```ts
runtimeLaunchPlanMaterialization: {
  enabled: true,
  targetLaunchPlanEvidenceIds: string[],
  sdkClientAvailable?: boolean,
  durableEvidenceRootRef?: string,
}
```

The bridge runs only after all of the following are true:

1. Provider acquisition evidence was recorded.
2. Cache/cache-hit refresh materialization returned `materialized`.
3. Reviewer fan-out planning returned a persisted `reviewer_fanout_plan` evidence id.
4. The fan-out evidence write succeeded and is reloadable through session evidence.
5. The nested runtime launch-plan materialization option is explicitly enabled.

The server then reloads session evidence and calls `materializeFlowDeskRuntimeLaneLaunchPlansFromReviewerFanoutEvidenceV1` with the persisted fan-out evidence id, requested target launch-plan evidence ids, SDK-client availability signal, durable evidence-root ref, workflow id, and durable root.

## Redacted Tool Output

The provider acquisition tool output adds only a nested `cacheMaterialization.reviewerFanoutPlanning.runtimeLaunchPlanMaterialization` summary containing:

1. Materialization `state` and `blockedLabels`.
2. Target launch-plan evidence ids.
3. Launch-plan states, plan count, and write-intent count.
4. Launch/provider/runtime authority flags, all still false.

No raw fan-out records, raw launch-plan records, prompts, provider payloads, SDK responses, reviewer outputs, or credential material are returned.

## Verification

Targeted plugin verification is covered by:

```bash
npm test --workspace @flowdesk/opencode-plugin -- --test-name-pattern "provider acquisition"
```

The added coverage proves:

1. Explicit provider acquisition can chain acquisition -> cache/cache-hit refresh -> reviewer fan-out -> three durable `runtime_lane_launch_plan` records.
2. The default fan-out bridge writes no runtime launch-plan evidence unless the nested runtime option is enabled.
3. Missing launch prerequisites such as a durable evidence-root ref block before runtime launch-plan writes.
4. Materialized launch-plan evidence preserves `launch_attempted=false`, `actualLaneLaunch=false`, `providerCall=false`, and `runtimeExecution=false`.

## Interpretation

This closes the provider-first planning bridge from an active acquisition result to reloadable cache, fan-out, and runtime launch-plan evidence in one explicit product path. It prepares auditable launch inputs only.

The next gated work remains actual reviewer lane SDK launch and lifecycle observation. That still requires explicit launch approval consumption, SDK-client orchestration, lane lifecycle evidence, typed verdict persistence and linkage, acceptance gates, and separate authority promotion checks.
