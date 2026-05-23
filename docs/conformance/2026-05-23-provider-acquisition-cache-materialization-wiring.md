# Provider Acquisition Cache Materialization Wiring

Date: 2026-05-23

## Scope

This note records the OpenCode plugin wiring that bridges the explicit exact-model provider acquisition live-test tool to the new core exact-model cache materialization helper.

The path remains opt-in and redacted-first. It does not make provider acquisition cache materialization the default, does not execute cache refresh, does not authorize dispatch, does not launch reviewer lanes, does not perform fallback, and does not execute runtime work.

## Implemented Wiring

`@flowdesk/opencode-plugin` now accepts an additional nested server option under `exactModelProviderAcquisitionLiveTest`:

```ts
cacheMaterialization: {
  enabled: true,
  targetCacheEvidenceId: string,
  targetCacheRefreshPlanEvidenceId: string,
  cacheId?: string,
  entryId?: string,
}
```

When this nested option is absent, disabled, or malformed, the live-test tool stays acquisition-only and writes only `exact_model_availability_cache_provider_acquisition_result` evidence.

When enabled, the server tool still runs `runFlowDeskExactModelProviderAcquisitionLiveTestV1` first. After the acquisition result is durably reloaded, the tool reloads session evidence from the configured root and calls `materializeFlowDeskExactModelCacheEvidenceFromProviderAcquisitionEvidenceV1` with:

1. `workflowId`
2. `providerAcquisitionEvidenceId=request.evidenceId`
3. `targetCacheEvidenceId`
4. `targetCacheRefreshPlanEvidenceId`
5. Optional `cacheId` and `entryId`
6. `rootDir`
7. The same request context fields: local date, active profile, OpenCode version, FlowDesk package version, registry hash, Policy Pack hash, and auth/account boundary

## Redacted Tool Output

The tool response still omits raw provider payloads and raw cache/acquisition records.

When cache materialization is enabled, the response adds only a narrow `cacheMaterialization` summary with:

1. Materialization `state`
2. `blockedLabels`
3. Target cache/cache-refresh evidence ids
4. `cacheId` and `entryId`
5. Ref-ish values only (`availabilityRef`, `sanitizedProviderResultRef`)
6. `selectionState` and `pairSelectionReady`

## Verification

Targeted plugin verification for this wiring is covered by:

```bash
npm test --workspace @flowdesk/opencode-plugin -- --test-name-pattern "provider acquisition"
```

The coverage proves three behaviors:

1. Default acquisition-only mode writes no cache or cache-refresh evidence.
2. Explicit cache materialization writes provider acquisition plus cache plus cache-hit refresh-plan evidence and reports `pair_ready`.
3. Duplicate target ids block before any additional cache/cache-refresh write while still returning a redacted blocked materialization state.

## Interpretation

This closes the server-tool bridge from prompt-backed provider acquisition evidence to same-day cache evidence materialization without changing the default acquisition-only behavior. Cache discovery, cache refresh execution, provider fallback, reviewer lane launch, runtime execution, and dispatch authority remain separately gated.
