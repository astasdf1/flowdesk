# Fan-Out Diagnostic Wiring

Date: 2026-05-23

## Scope

This note records the non-authorizing product wiring that derives reviewer fan-out diagnostics from durable exact-model cache evidence for `/flowdesk-doctor` and `/flowdesk-status`.

## Implemented

The OpenCode plugin now accepts `reviewerFanoutDiagnostics` local diagnostic options. When the local non-dispatch adapter also has a durable state root, it reloads session evidence for the requested workflow and calls `planFlowDeskReviewerFanoutFromReloadedCacheEvidenceV1`.

Derived diagnostics are then surfaced through existing diagnostic fields:

1. `exactModelAvailabilityCacheRefreshPlan` when a matching cache-hit refresh plan is selected.
2. `reviewerFanoutPlan` for ready or blocked fan-out topology planning.

`/flowdesk-doctor` can show cache-hit and fan-out-ready refs from durable evidence. `/flowdesk-status` can show blocked fan-out refs when selected cache evidence is missing, drifted, or ambiguous.

## Safety Boundary

This slice only reloads local durable evidence and derives diagnostic planning artifacts. It does not discover models, refresh caches, call providers, launch reviewer lanes, accept verdicts, authorize dispatch, or run SDK prompts. All surfaced artifacts preserve `providerCall=false`, `actualLaneLaunch=false`, and `runtimeExecution=false`. A later 2026-05-23 slice can optionally persist a ready derived plan as durable `reviewer_fanout_plan` evidence, but that evidence remains diagnostic planning input only.

## Verification

Targeted product-path tests cover ready durable cache evidence surfacing through doctor diagnostics and drifted cache evidence surfacing as status blockers. The tests also assert provider calls, runtime execution, and actual lane launch remain false.

## Remaining Gaps

Actual cache discovery acquisition, provider probing, runtime launch approval, SDK-client lane launch, typed verdict persistence, and verdict acceptance remain later-gated.
