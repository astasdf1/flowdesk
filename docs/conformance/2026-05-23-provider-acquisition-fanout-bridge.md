# Provider Acquisition Fanout Bridge

Date: 2026-05-23

## Scope

This note records the explicit OpenCode plugin bridge from prompt-backed exact-model provider acquisition cache materialization to selected-cache reviewer fan-out planning.

The bridge remains opt-in, redacted-first, and non-launching. It does not enable default dispatch, execute reviewer lanes, run SDK reviewer prompts, perform fallback or reselection, accept verdicts, execute cache refresh, or grant runtime authority.

## Implemented Wiring

`@flowdesk/opencode-plugin` now accepts an additional nested option under `exactModelProviderAcquisitionLiveTest.cacheMaterialization`:

```ts
reviewerFanoutPlanning: {
  enabled: true,
  attemptId: string,
  parentSessionRef: string,
  agentRef: string,
  requestedAt?: string,
  requestedPerspectives?: string[],
  maxConcurrentLaneCount?: number,
  timeoutMs?: number,
  orphanMaxAgeMs?: number,
  retryBudget?: number,
  preLaunchAuditRef?: string,
  laneLaunchApprovalRef?: string,
  persistDerivedFanoutPlanEvidence?: boolean,
  fanoutPlanEvidenceId?: string,
}
```

The bridge runs only after the provider acquisition result is recorded and cache materialization verifies a reloadable same-day cache/cache-hit refresh pair. It then calls `planFlowDeskReviewerFanoutFromReloadedCacheEvidenceV1` with the just-reloaded cache evidence and the original provider acquisition request context.

When `persistDerivedFanoutPlanEvidence` is true and fan-out planning returns `fanout_ready`, the server prepares and applies one `reviewer_fanout_plan` session-evidence record through the existing closed session-evidence writer. Blocked or non-ready fan-out plans are reported but not persisted.

## Redacted Tool Output

The provider acquisition tool output adds only a nested `cacheMaterialization.reviewerFanoutPlanning` summary containing:

1. Planning `state` and `blockedLabels`
2. Fan-out plan state
3. Planned perspectives and runtime-lane launch-request count
4. Launch/approval/authority flags, all still false
5. Optional persisted fan-out evidence id and persistence errors

No raw prompts, raw provider payloads, raw cache records, raw fan-out records, reviewer outputs, or SDK responses are returned.

## Verification

Targeted plugin verification is covered by:

```bash
npm test --workspace @flowdesk/opencode-plugin -- --test-name-pattern "provider acquisition cache materialization"
```

The added coverage proves that explicit provider acquisition cache materialization can derive a `fanout_ready` plan from the newly materialized selected cache pair, persist exactly one `reviewer_fanout_plan` evidence record, and preserve `actualLaneLaunch=false`, `providerCall=false`, and `runtimeExecution=false`.

## Interpretation

This closes the provider-first bridge from active exact-model acquisition evidence to durable selected-cache fan-out planning evidence. It prepares auditable reviewer topology inputs only; reviewer lane launch, runtime launch approval, SDK reviewer execution, typed verdict observation/acceptance, fallback, remote writes, and dispatch promotion remain separately gated.
