# Release 3 Reviewer Verdict Acceptance Adapter

Date: 2026-05-22

## Scope

This note records local adapter wiring for typed reviewer verdict acceptance. It does not record a new live reviewer lane launch, provider call, model fan-out, or dispatch authorization.

## Result

`prepareFlowDeskReviewerTypedVerdictAcceptanceAdapterV1` converts schema-valid canonical reviewer verdicts plus consumed `reviewer_fanout` approval into `verdicts_accepted` only when the core promotion contract accepts the full verdict set.

The adapter accepts only the canonical perspectives:

- `policy_security`
- `architecture`
- `verification_implementation`

Each accepted verdict must be a typed `flowdesk.top_tier_review_verdict.v1` output with `verdict_label: "pass"`, `uncertainty: "low"`, non-empty evidence refs, distinct verdict ids, distinct perspectives, and the requested workflow id.

Blocked inputs return `blocked_before_acceptance` with `/flowdesk-status` as the only safe next action.

## Safety Boundary

The adapter is an acceptance gate only. It does not launch lanes or call providers. Runtime and dispatch authority remain disabled:

- `realOpenCodeDispatch: false`
- `providerCall: false`
- `actualLaneLaunch: false`
- `runtimeExecution: false`

The only positive readiness bit is `typedReviewerVerdictsAccepted: true`, and only after consumed `reviewer_fanout` approval and canonical typed verdicts are validated.

## Local Coverage

Tests cover:

1. All canonical passing low-uncertainty verdicts plus consumed `reviewer_fanout` approval produce `verdicts_accepted`.
2. Missing canonical perspective blocks before acceptance.
3. Non-pass verdict blocks before acceptance.
4. Wrong approval action blocks before acceptance.
5. Accepted and blocked outcomes preserve disabled dispatch/provider/lane/runtime authority.

## Remaining Blocker

This closes only the local verdict acceptance adapter. A follow-up bounded live proof is recorded in `docs/conformance/2026-05-22-release3-live-reviewer-verdict-proof.md`: coordinator-controlled registered reviewer lanes produced all three canonical typed `pass` verdicts and this adapter accepted them after consumed `reviewer_fanout` approval. Durable evidence linking and full lane lifecycle/no-output classification remain follow-up hardening before these verdicts can support a broader production dispatch decision.
