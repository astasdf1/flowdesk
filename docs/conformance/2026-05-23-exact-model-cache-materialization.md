# Exact-Model Cache Materialization

Date: 2026-05-23

## Scope

This note records the core-only path that converts a successful prompt-backed exact-model provider acquisition result into reloadable same-day cache evidence.

The path does not call providers, run OpenCode, launch reviewer lanes, execute cache refresh, authorize dispatch, perform fallback, or accept reviewer verdicts. It only prepares or materializes two session evidence records through the existing evidence write/apply/reload mechanics.

## Implemented Path

`@flowdesk/core` now exposes `materializeFlowDeskExactModelAvailabilityCacheFromProviderAcquisitionResultV1` for pure cache construction and `materializeFlowDeskExactModelCacheEvidenceFromProviderAcquisitionEvidenceV1` for durable/session evidence materialization.

The pure helper creates `flowdesk.exact_model_availability_cache.v1` only when the provider acquisition result validates and is a real prompt-backed success: `state=availability_acquired`, `available=true`, `highest_tier_eligible=true`, `providerCall=true`, acquisition and discovery were attempted, and `sanitized_provider_result_ref` is present. Metadata-only results with `providerCall=false` cannot become live cache availability.

The durable helper selects exactly one acquisition result by evidence id or strict same-day context, builds the cache, derives a matching `flowdesk.exact_model_availability_cache_refresh_plan.v1` cache-hit plan with `planFlowDeskExactModelAvailabilityCacheRefreshV1`, prepares both write intents, and optionally applies/reloads them when a root is supplied.

## Fail-Closed Boundaries

Materialization blocks before writes for:

1. Invalid, blocked, unavailable, lower-tier, metadata-only, or authority-forged provider acquisition results.
2. Local date, active profile, OpenCode version, FlowDesk package version, registry hash, Policy Pack hash, or auth/account-boundary drift.
3. Missing or ambiguous acquisition evidence under strict selection.
4. Duplicate target cache or cache-refresh evidence ids.
5. Existing context-equivalent cache/cache-refresh evidence that would make downstream pair selection ambiguous.
6. Invalid cache or refresh-plan write intents.

The materialized cache carries the exact provider family, provider identity ref, provider-qualified model id, model family, and availability ref from the acquisition result, while keeping `dispatch_authority_enabled=false`, `providerCall=false`, `actualLaneLaunch=false`, and `runtimeExecution=false`. The matching refresh plan is a `cache_hit` plan and also keeps all runtime/provider/lane authority disabled.

## Verification

Targeted core verification passed with:

```bash
npm test --workspace @flowdesk/core -- --test-name-pattern "provider acquisition materializes|cache materialization|session evidence materializes provider acquisition|ambiguous acquisition"
```

The selected run reported 320 passing tests and included the new pure and durable materialization coverage. LSP diagnostics were clean on changed TypeScript files after import sorting.

## Interpretation

This closes the safe bridge from redacted prompt-backed provider acquisition evidence to same-day exact-model cache evidence plus a matching cache-hit refresh plan. It remains evidence materialization only; actual cache discovery, provider calls, reviewer lane launch, dispatch, fallback, cache refresh execution, and verdict acceptance remain separately gated.
