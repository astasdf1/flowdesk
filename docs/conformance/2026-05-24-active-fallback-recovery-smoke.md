# Active Fallback Recovery Smoke

Date: 2026-05-24

## Scope

This note records an active fallback recovery smoke test that consumes a persisted `fallback_regate_plan` in a fresh `/flowdesk-run` attempt. The smoke proves that FlowDesk correctly enforces the fresh evidence requirements dictated by the regate plan before permitting a new runtime execution.

The smoke used `opencode serve` plus the OpenCode SDK. It did not use `opencode run`, did not perform arbitrary automatic provider fallback, and did not bypass the explicit re-gate constraints.

## Preconditions

The harness used a temporary `.flowdesk` evidence root and simulated a fresh `/flowdesk-run` attempt following a previous failure that produced a `fallback_regate_plan` session evidence record.

The `fallback_regate_plan` state was set to `full_regate_required`, binding the new attempt (`attempt-2`) and requiring a specific piece of fresh evidence (`evidence-fresh-1`).

## Result

The test evaluated the `evaluateFlowDeskDispatchAttemptDurablePrecallV1` gate by providing a `dispatch_attempt_manifest` with the state `sdk_call_permitted` for the new attempt, alongside the reloaded session evidence.

### Blocked Path: Missing Fresh Evidence

When the required fresh evidence (`evidence-fresh-1`) was not present in the reloaded session evidence:

- The pre-call evaluation returned `sdk_call_permitted: false`.
- The `blocked_labels` included `fallback_regate_plan_fresh_evidence_missing`.
- No SDK calls were permitted.

### Blocked Path: Attempt Mismatch

When the fresh dispatch attempt provided an ID (`attempt-3`) that did not match the `new_attempt_id` defined in the regate plan:

- The pre-call evaluation returned `sdk_call_permitted: false`.
- The `blocked_labels` included `fallback_regate_plan_attempt_mismatch`.
- No SDK calls were permitted.

### Permitted Path: Required Fresh Evidence Supplied

When the new attempt correctly matched the `new_attempt_id` and all required fresh evidence (e.g., `usage_authority` with ID `evidence-fresh-1`) was provided in the reloaded evidence:

- The pre-call evaluation returned `sdk_call_permitted: true`.
- The attempt successfully passed the durable pre-call checks.

## Authority Boundary

The fallback regate plan enforcement kept:

1. `automatic_fallback_authorized=false`: No automatic provider switching was authorized.
2. `dispatch_authority_enabled=false`: The regate plan itself did not authorize dispatch.
3. `realOpenCodeDispatch=false`.
4. `providerCall=false`.
5. `runtimeExecution=false`.
6. `actualLaneLaunch=false`.

## Interpretation

This closes the active fallback recovery sequence where a persisted `fallback_regate_plan` enforces a strict re-gate constraint on the next attempt. By explicitly consuming the plan during the fresh `/flowdesk-run`'s durable pre-call check, FlowDesk guarantees that an attempt cannot bypass the fresh usage, health, or policy checks demanded by the fallback orchestrator.
