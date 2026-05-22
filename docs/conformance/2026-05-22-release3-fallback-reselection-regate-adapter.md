# Release 3 Fallback Reselection Re-Gate Adapter

Date: 2026-05-22

## Scope

This note records local adapter wiring for the fallback/reselection promotion contract. It does not record a live provider switch, SDK call, lane launch, or automatic fallback execution.

## Result

`prepareFlowDeskFallbackReselectionRegateAdapterV1` converts a valid `flowdesk.fallback_decision.v1` plus consumed `fallback_reselection` approval into a non-authorizing `regate_required` adapter result. The result carries the parent attempt id, new attempt id, source and target provider-qualified model ids, and safe next actions for status plus a fresh `/flowdesk-run` gate.

Blocked fallback decisions return `blocked_before_regate` with `/flowdesk-status` as the only safe next action.

## Safety Boundary

The adapter never calls the OpenCode SDK, never switches providers, never launches a lane, and never enables automatic fallback authority. Even the successful path keeps all runtime authority flags false:

- `dispatchAttempted: false`
- `automaticFallbackAuthorized: false`
- `fallbackAuthority: false`
- `realOpenCodeDispatch: false`
- `providerCall: false`
- `actualLaneLaunch: false`
- `runtimeExecution: false`

## Local Coverage

Tests cover:

1. Valid fallback decision plus consumed `fallback_reselection` approval produces `regate_required` only.
2. Same-attempt fallback is blocked before re-gate.
3. Max-depth non-terminal fallback is blocked before re-gate.
4. Approval/ref mismatch is blocked before re-gate.
5. All outcomes preserve disabled dispatch, provider, lane, runtime, and automatic fallback authority.

## Remaining Blocker

This closes only the local fallback reselection adapter helper. Automatic provider/model switching remains blocked until the new attempt passes the full managed-dispatch gate with fresh usage, health, runtime compatibility, policy eligibility, Guard approval, consumed approval, durable audit, durable idempotency, and explicit user-approved live proof.
