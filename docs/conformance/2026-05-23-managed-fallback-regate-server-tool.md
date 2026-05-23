# Managed Fallback Regate Server Tool

Date: 2026-05-23

## Scope

This note records the explicit opt-in server tool that surfaces the existing managed fallback re-gate orchestrator to users without changing default Release 1 behavior.

The tool plans only. It does not perform automatic provider switching, dispatch, SDK calls, lane launches, runtime execution, or any other authority promotion. It returns a non-authorizing re-gate plan that points the caller back into the regular `/flowdesk-run` re-gate flow.

## Implemented Tool

`flowdesk_managed_fallback_regate` registers only when `managedFallbackRegate.enabled=true` is set in plugin options. The tool takes two record arguments:

1. `decision`: complete `flowdesk.fallback_decision.v1` with `state="requires_full_regate"`, `automatic_fallback_authorized=false`, fresh evidence/guard/approval/audit/policy/runtime-compatibility refs, and a distinct `new_attempt_id`.
2. `consumedApproval`: consumed `flowdesk.production_approval_source.v1` with `action_type="fallback_reselection"` bound to the decision's `new_attempt_id` and `fresh_approval_ref`.

The tool calls `orchestrateFlowDeskManagedFallbackRegateV1` and returns a redacted summary including the orchestrator status, parent/new attempt ids, redacted from/to provider-qualified model ids, regate plan state, plan ok flag, plan error list, required fresh evidence ref count, required guard/approval/audit refs, policy/runtime compatibility refs, consumed approval ref, safe next actions, and the orchestrator authority bundle.

Default plugin registration does not include this tool. Without explicit opt-in, the tool surface is absent from `hooks.tool`.

## Authority Boundary

The redacted tool result always reports these flags as `false`:

1. `dispatchAttempted`, `providerSwitchAttempted`, `sdkCallAttempted`.
2. `automaticFallbackAuthorized`.
3. `realOpenCodeDispatch`, `providerCall`, `actualLaneLaunch`, `runtimeExecution`.
4. `fallbackAuthority`, `hardCancelOrNoReplyAuthority`, `toolAuthority`.
5. `dispatch_authority_enabled` on the embedded regate plan.

A `regatePlanState="full_regate_required"` result means only that the user can submit a new `/flowdesk-run` attempt with the listed required fresh refs and a new approval consumption. The tool does not consume that approval itself.

## Verification

Targeted plugin verification is covered by:

```bash
npm test --workspace @flowdesk/opencode-plugin -- --test-name-pattern "managed fallback regate tool"
```

The added regression tests prove:

1. The tool is absent from default plugin tool registration.
2. With explicit opt-in, a valid fallback decision plus a consumed `fallback_reselection` approval returns `regate_plan_ready` with `regatePlanState="full_regate_required"`, three required fresh evidence refs, and disabled runtime/dispatch/fallback authority on the result.
3. Missing decision or approval blocks before the orchestrator with `redactedBlockReason` describing the missing record.
4. Terminal-depth or invalid decisions block with `blocked_before_regate_plan` and zero runtime authority.

## Interpretation

This closes the user-facing surface for managed fallback re-gate planning. The next product step toward fallback-aware operation is wiring this re-gate plan into a durable evidence record and exposing it through `/flowdesk-status`, so a user who hits a `changes_required` or `provider_unhealthy` attempt can pick up the re-gate plan in a later session. Active dispatch behind the re-gate plan continues to require a fresh `/flowdesk-run` attempt with the listed evidence refs.
