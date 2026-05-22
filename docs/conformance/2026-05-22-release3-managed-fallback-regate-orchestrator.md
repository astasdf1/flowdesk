# Release 3 Managed Fallback Re-Gate Orchestrator

Date: 2026-05-22

## Summary

FlowDesk now has a non-authorizing managed fallback re-gate plan layer for the managed fallback/reselection blocker. The new core contract `flowdesk.fallback_regate_plan.v1` turns a valid fallback decision and consumed `fallback_reselection` approval into an explicit full re-gate plan for the new attempt.

The plugin helper `orchestrateFlowDeskManagedFallbackRegateV1` wraps that plan as a local orchestrator result. It can return only `regate_plan_ready` or `blocked_before_regate_plan`; it never switches providers, never calls the SDK, never launches lanes, and never enables runtime or dispatch authority.

## Implemented Boundary

- Valid fallback decisions must already carry a parent attempt, a distinct new attempt, fresh usage/health/runtime evidence refs, a fresh Guard decision ref, a fresh approval ref, a fresh pre-dispatch audit ref, policy eligibility, runtime compatibility, bounded depth, and `automatic_fallback_authorized=false`.
- The consumed approval must be scoped to `fallback_reselection`, match the workflow/new attempt/approval ref/model binding, and already be consumed by the new attempt.
- The resulting plan exposes the required fresh evidence refs and safe next actions for `/flowdesk-status` plus `/flowdesk-run` so the new attempt can re-run the existing managed-dispatch gates from scratch.
- Blocked decisions expose only `/flowdesk-status` and keep the partially constructed plan non-authorizing.

## Authority Claims

The orchestrator preserves all disabled authority flags:

- `automatic_fallback_authorized=false`
- `provider_switch_attempted=false`
- `dispatch_authority_enabled=false`
- `realOpenCodeDispatch=false`
- `providerCall=false`
- `actualLaneLaunch=false`
- `runtimeExecution=false`
- `dispatchAttempted=false`
- `sdkCallAttempted=false`

This closes only the local planning/orchestration slice for fallback re-gating. Automatic provider/model switching remains blocked until a later gate proves the full managed-dispatch path, fresh native usage/health for the new binding, runtime compatibility, policy eligibility, fresh Guard approval, fresh external approval, fresh durable pre-dispatch audit, and bounded fallback depth in one runtime flow.

## Verification

- `lsp_diagnostics` on the touched TypeScript files reported no errors; only existing Biome organize-import informational hints appeared in three files.
- `npm test --workspace @flowdesk/core -- --test-name-pattern "fallback regate|fallback decision|fallback reselection"` passed with 276/276 tests in the workspace test invocation.
- `npm test --workspace @flowdesk/opencode-plugin -- --test-name-pattern "managed fallback regate|fallback reselection"` passed with 101/101 tests in the workspace test invocation.

- `npm run typecheck` passed.
- Full `npm test` passed with 377/377 tests.
- `GIT_MASTER=1 git diff --check` reported no whitespace errors.
