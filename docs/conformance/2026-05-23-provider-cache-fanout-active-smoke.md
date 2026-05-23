# Provider Cache Fanout Active Smoke

Date: 2026-05-23

## Scope

This note records a bounded active-environment smoke of the full provider-first chain: prompt-backed exact-model provider acquisition, same-day cache materialization, selected-cache reviewer fan-out planning, and durable fan-out plan evidence persistence.

The smoke used `opencode serve` plus the OpenCode SDK. It did not use `opencode run`, did not print token material, did not print raw provider/auth/model payloads, did not launch reviewer lanes, did not run SDK reviewer prompts, did not accept verdicts, did not perform fallback/reselection, did not execute remote writes, and did not promote default dispatch authority.

## Preconditions

The smoke used a temporary `.flowdesk` evidence root and explicit nested server options only:

1. `exactModelProviderAcquisitionLiveTest.promptBackedCheck.enabled=true`
2. `allowProviderCall=true`
3. Exact allowlist containing only `claude/claude-opus-4-5`
4. `cacheMaterialization.enabled=true`
5. Explicit cache and cache-refresh evidence ids
6. `cacheMaterialization.reviewerFanoutPlanning.enabled=true`
7. Explicit fan-out attempt/session/agent refs plus pre-launch audit and lane-launch approval refs
8. `persistDerivedFanoutPlanEvidence=true`

## Result

The successful run selected `claude/claude-opus-4-5`, performed one fixed sentinel provider acquisition check, wrote and reloaded sanitized provider acquisition evidence, materialized a same-day cache/cache-hit refresh pair, planned three reviewer fan-out launch requests, and persisted one durable `reviewer_fanout_plan` evidence record.

Redacted live summary:

```json
{
  "serverReady": true,
  "status": "provider_acquisition_recorded",
  "selectedProviderQualifiedModelId": "claude/claude-opus-4-5",
  "providerCallAttempted": true,
  "writeAttempted": true,
  "evidenceReloaded": true,
  "resultState": "availability_acquired",
  "available": true,
  "highestTierEligible": true,
  "blockedLabels": [],
  "providerCallAuthority": false,
  "dispatchAuthorityEnabled": false,
  "cacheMaterializationState": "materialized",
  "pairSelectionReady": true,
  "fanoutState": "fanout_ready",
  "fanoutBlockedLabels": [],
  "fanoutPlanState": "fanout_ready",
  "fanoutPlannedPerspectives": [
    "policy_security",
    "architecture",
    "verification_implementation"
  ],
  "fanoutRuntimeLaneLaunchRequests": 3,
  "fanoutPersisted": true,
  "fanoutPersistedEvidenceId": "live-fanout-plan-from-provider-2026-05-23",
  "fanoutPersistErrors": [],
  "fanoutLaunchAttempted": false,
  "fanoutApprovalInferred": false,
  "fanoutActualLaneLaunch": false,
  "fanoutProviderCall": false,
  "fanoutRuntimeExecution": false,
  "reloadOk": true,
  "evidenceCounts": {
    "exact_model_availability_cache_provider_acquisition_result": 1,
    "exact_model_availability_cache": 1,
    "exact_model_availability_cache_refresh_plan": 1,
    "reviewer_fanout_plan": 1
  },
  "blockedCount": 0
}
```

## Failed Attempts

The first harness attempt blocked before any provider call because the synthetic refresh-required acquisition plan used `ok=false`. No provider call was attempted and no evidence was written.

The second harness attempt also blocked before any provider call because the synthetic registry and Policy Pack refs were not hash-bound. No provider call was attempted and no evidence was written.

A third harness attempt performed the provider call and materialized the cache pair, but fan-out planning remained blocked because the harness omitted pre-launch audit and lane-launch approval refs. It wrote provider acquisition plus cache plus cache-refresh evidence, but no fan-out plan evidence. The final passing run included the required non-authorizing fan-out planning refs.

## Interpretation

This closes the active provider-first smoke from live provider availability to durable selected-cache reviewer fan-out topology evidence. The resulting fan-out plan is planning evidence only: it contains launch requests but records `launch_attempted=false`, `approval_inferred=false`, `actualLaneLaunch=false`, `providerCall=false`, and `runtimeExecution=false`.

Reviewer lane launch, SDK reviewer prompts, runtime launch approval consumption, lane lifecycle observation, typed verdict persistence/acceptance, fallback/reselection, remote writes, and dispatch promotion remain separately gated.
