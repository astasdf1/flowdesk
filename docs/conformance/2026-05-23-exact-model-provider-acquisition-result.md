# Exact-Model Provider Acquisition Result

Date: 2026-05-23

## Summary

FlowDesk now has a bounded `flowdesk.exact_model_availability_cache_provider_acquisition_result.v1` contract and an explicit opt-in plugin/server adapter for recording exact-model provider acquisition/live-test outcomes.

This slice records sanitized live-test facts and durable evidence only. It does not launch reviewer lanes, execute runtime work, refresh caches, accept verdicts, infer Guard approval, enable fallback, or authorize dispatch.

## Implemented Behavior

`recordFlowDeskExactModelAvailabilityCacheProviderAcquisitionResultV1` consumes a validated `flowdesk.exact_model_availability_cache_acquisition_plan.v1` and records either:

1. `availability_acquired` when the input plan is `acquisition_planned`, active-environment refs are valid, and the bounded provider check produced a sanitized available or unavailable outcome.
2. `blocked` when the acquisition plan is invalid, not planned, context refs are invalid, or the provider acquisition/live-test attempt failed.

The record carries active profile, OpenCode version, FlowDesk package version, registry hash, Policy Pack hash, auth/account boundary, exact provider-qualified model id, redaction proof, durable pre-call audit ref, idempotency ref, live-test run ref, sanitized provider result ref, and observed availability flags.

`validateFlowDeskExactModelAvailabilityCacheProviderAcquisitionResultV1` rejects unknown properties, aliases, provider-family/model drift, missing sanitized result refs for successful acquisition, raw payload markers, inconsistent attempted/provider-call flags, cache refresh claims, lane launch claims, runtime execution claims, and dispatch authority claims.

## Durable Evidence

Session evidence now includes an `exact_model_availability_cache_provider_acquisition_result` class under `.flowdesk/sessions/<workflow>/evidence/exact-model-availability-cache-provider-acquisition-result/`.

Prepare/apply/reload validation runs the provider-acquisition-result validator before records can be consumed. Forged records that enable `dispatch_authority_enabled`, `actualLaneLaunch`, `runtimeExecution`, or cache refresh authority fail closed during reload.

The schema registry and schema-artifact map now include `flowdesk.exact_model_availability_cache_provider_acquisition_result.v1` as a later-release artifact.

## Opt-In Adapter

`runFlowDeskExactModelProviderAcquisitionLiveTestV1` performs one bounded provider acquisition check through an injected `FlowDeskExactModelProviderAcquisitionClientV1`. It blocks before any provider call unless the input acquisition plan validates as `acquisition_planned` and a durable state root is configured.

When the injected client returns a sanitized result, the adapter records `exact_model_availability_cache_provider_acquisition_result` evidence through the session-evidence prepare/apply/reload path. The server exposes this only through `flowdesk_exact_model_provider_acquisition_live_test` when `exactModelProviderAcquisitionLiveTest.enabled=true`, a client is injected, and a durable state root is available. The tool is absent from default Release 1 command-backed registration.

The tool response redacts the result record and returns refs/status only; raw provider responses are not echoed.

## Safety Boundary

`providerCall=true` in this result is evidence that a bounded explicit provider acquisition/live-test happened; it is not reusable provider-call authority. The record cannot authorize reviewer launch, managed dispatch, fallback, verdict acceptance, or cache refresh by itself.

The next product slice is to bind this adapter to the real active-environment provider/auth surface and run an actual credentialed live check, then fix any observed auth binding, provider id mapping, model id normalization, redaction, quota/health, or reload failures.

## Verification

Targeted verification during implementation:

```text
npm test -- --test-name-pattern "provider acquisition result|session evidence"
npm test -- --test-name-pattern "provider acquisition|exact-model provider acquisition|server plugin defaults"
```

Full verification status is recorded in the implementation handoff for this slice.
