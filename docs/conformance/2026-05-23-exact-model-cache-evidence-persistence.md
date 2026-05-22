# Exact-Model Cache Evidence Persistence

Date: 2026-05-23

## Scope

This note records durable evidence support for exact-model availability cache records and cache-refresh plans. It is an evidence-spine slice only; it does not acquire model availability, call providers, or launch reviewer lanes.

## Implemented

Session evidence now manages two additional classes:

1. `exact_model_availability_cache` for `flowdesk.exact_model_availability_cache.v1`.
2. `exact_model_availability_cache_refresh_plan` for `flowdesk.exact_model_availability_cache_refresh_plan.v1`.

Both classes use the existing `.flowdesk/sessions/<workflowId>/evidence/<class>/<evidenceId>.json` path discipline and temp-then-rename write intents.

## Validation

Cache records validate through `validateFlowDeskExactModelAvailabilityCacheV1` before prepare, apply, or reload can treat them as usable evidence.

Cache-refresh plans validate through `validateFlowDeskExactModelAvailabilityCacheRefreshPlanV1` before prepare, apply, or reload can treat them as usable evidence.

The reload path rejects forged evidence that claims:

1. Provider calls.
2. Runtime execution.
3. Actual lane launch.
4. Dispatch authority.
5. Discovery attempted.
6. Refresh attempted.

## Verification

Targeted verification passed with the session-evidence tests covering durable write/reload and forged evidence rejection. Full verification for the work session should include `npm run typecheck`, `npm test`, and `GIT_MASTER=1 git diff --check`.

## Remaining Gaps

Reviewer assignment and fan-out still need to consume reloaded cache evidence rather than in-memory records. Actual cache discovery/provider probing remains a later gate requiring bounded acquisition, provider/account/auth binding, durable evidence, and explicit conformance before any provider interaction.
