# Release 2 Production Approval State Gate

Date: 2026-05-21

## Scope

This note records doctor-visible production approval decision diagnostics and fail-closed production enablement handling. It is a state-machine visibility slice only. It does not create release approval, user approval, Guard approval, provider calls, real OpenCode dispatch, runtime execution, actual lane launch, automatic fallback/reselection, or hard chat cancellation/no-reply authority.

## Implemented Behavior

`@flowdesk/core` already exposes `flowdesk.production_approval_decision.v1` as part of production enablement. This slice tightens and surfaces that decision state:

- Valid approval decisions can now be echoed from `evaluateFlowDeskProductionEnablementV1` as non-authorizing diagnostics:
  - `approval_decision=<approve|deny>`
  - `approval_ref=<approval_id>`
- Invalid, mismatched, malformed, wrong-workflow, or authority-smuggling approval decisions remain blocked with `approval_mismatched` and are not echoed.
- Denied but otherwise valid approvals remain doctor-visible as `deny` while keeping production enablement blocked.
- Required-evidence drift remains blocked with `approval_required_refs_missing`.
- `dispatch_authority_enabled` remains `false` in all production enablement results.

## Doctor and Server Wiring

The OpenCode plugin server option parser now accepts an explicit `approvalDecision` object under opt-in `productionEnablement` options. The local adapter already passed that option into core evaluation; validation still occurs only inside `evaluateFlowDeskProductionEnablementV1`.

`/flowdesk-doctor` can surface these diagnostic refs only from evaluated production enablement output:

- `production_approval_decision=<approve|deny>`
- `production_approval_ref=<approval_id>`

The command handler does not read raw plugin options. Invalid approval option data therefore cannot be surfaced as doctor approval refs.

## Verification

Commands run from the repository root:

```text
npm test -- --test-name-pattern "production enablement|doctor diagnostic handler can surface evaluated production enablement|server option wires production enablement|invalid configured verification"
```

Results:

- Targeted production enablement and doctor/server approval diagnostics passed: 271/271 in the targeted command run.
- LSP diagnostics were clean on touched TypeScript files.

## Remaining Uncertainties

- This does not define who may issue a production release approval or how that decision is durably captured in a production path.
- This does not make review output, doctor output, plugin config, or Guard output equivalent to user/release approval.
- Actual runtime lane lifecycle proof, durable production-path sanitized auth capture, trusted runtime conformance, and hard chat cancel/no-reply authority remain separate blockers.
- Managed dispatch/model selection must remain disabled until all required gates pass.
