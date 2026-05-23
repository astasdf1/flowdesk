# Exact-Model Cache Acquisition Plan

Date: 2026-05-23

## Summary

FlowDesk now has a fail-closed `flowdesk.exact_model_availability_cache_acquisition_plan.v1` contract for the step between cache-refresh diagnostics and any future cache discovery implementation.

This slice is planning and durable evidence only. It does not discover models, refresh caches, call providers, launch reviewer lanes, execute runtime work, infer approval, or authorize dispatch.

## Implemented Behavior

`planFlowDeskExactModelAvailabilityCacheAcquisitionV1` consumes a validated `flowdesk.exact_model_availability_cache_refresh_plan.v1` and returns one of three states:

1. `acquisition_not_needed` when the refresh plan is a cache hit and the cache remains usable for reviewer assignment.
2. `acquisition_planned` when the refresh plan is `refresh_required`; the plan carries only bounded acquisition reason labels copied from the refresh plan.
3. `blocked` when the refresh plan is invalid or already blocked.

`validateFlowDeskExactModelAvailabilityCacheAcquisitionPlanV1` rejects unknown properties, inconsistent state/reason/blocker combinations, invalid refresh-plan state echoing, raw payload markers, and any attempt to claim discovery, refresh, acquisition, provider-call, lane-launch, runtime, or dispatch authority.

## Durable Evidence

Session evidence now includes an `exact_model_availability_cache_acquisition_plan` class under `.flowdesk/sessions/<workflow>/evidence/exact-model-availability-cache-acquisition-plan/`.

Prepare/apply/reload validation runs the acquisition-plan validator before records can be consumed. Forged records that set `acquisition_attempted`, `discovery_attempted`, `refresh_attempted`, `providerCall`, `actualLaneLaunch`, `runtimeExecution`, or `dispatch_authority_enabled` are rejected.

The schema registry and generated schema-artifact map now include `flowdesk.exact_model_availability_cache_acquisition_plan.v1` as a later-release artifact.

## Safety Boundary

This contract does not create a provider acquisition adapter. A future acquisition gate still needs explicit approval/conformance, auth/account-boundary proof, redaction proof, durable provider response handling, and no-output/error classification before any provider interaction can occur.

Reviewer fan-out continues to depend on selected cache-hit evidence and runtime launch approval. An acquisition plan alone cannot satisfy cache evidence, provider health, usage freshness, reviewer verdict acceptance, Guard approval, or dispatch authority.

## Verification

Targeted verification during implementation:

```text
npm test -- --test-name-pattern "availability cache acquisition|session evidence"
```

Result: passed after build, 425/425 selected tests in the harness output.

Full repository verification is recorded in the implementation handoff for this slice.
