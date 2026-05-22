# Release 3 Live Reviewer Verdict Proof

Date: 2026-05-22

## Scope

This note records a bounded live OpenCode reviewer-verdict proof for Release 3. It used the active OpenCode SDK/server path and coordinator-created child sessions. It did not use `opencode run`, did not print token material, did not mutate the active profile, did not write GitHub/connector/storage targets, and did not promote default Release 1 dispatch authority.

## SDK Shape Finding

The active SDK accepts `agent` and `model` at `session.prompt`, not at `session.create`. A probe that passed `agent`/`model` to `session.create` failed before child creation. The corrected shape is:

1. `session.create({ body: { parentID, title } })` for the child session.
2. `session.prompt({ path: { id: childId }, body: { agent, model, parts } })` for the reviewer lane call.

A single registered reviewer probe using that shape succeeded with `reviewer-gpt-frontier` and `openai/gpt-5.5`:

- Parent session: `ses_1b310a23affetxxpoLS7F7lMfK`.
- Child session: `ses_1b310a228ffeGF3M3uro2ImBrG`.
- Assistant message: `msg_e4cef5f29001aLW3qb4ivdHs3y`.
- Sentinel: `FLOWDESK_REVIEWER_CORRECTED_SINGLE_PROBE_20260522`.

## Live Reviewer Fan-Out

The live proof created one parent session and three coordinator-controlled child sessions:

- Parent session: `ses_1b30c2e8effeD7KRa3mfRw0cpr`.
- Policy/security lane: child `ses_1b30c2e76ffe8NyLGRwM5OJbri`, agent `reviewer-claude-opus`, model `anthropic/claude-opus-4-5`.
- Architecture lane: child `ses_1b30bf48effejHg2bE5Xkg6S2s`, agent `reviewer-gemini-pro`, model `google/gemini-2.5-pro`.
- Verification/implementation lane: child `ses_1b30be430ffe2T1PfE5pSvH5tw`, agent `reviewer-gpt-frontier`, model `openai/gpt-5.5`.

Prompt message ids were:

- `msg_e4cf3d357001C7nf07I6J300PU` for the initial Claude lane request.
- `msg_e4cf40b860013qRHNUBPxoEnGi` for Gemini.
- `msg_e4cf41be7001fZTtILkVTd0VPK` for GPT.
- `msg_e4cf7a280001lT6jGMhGxh7sJ4` for the final Claude machine-readable verdict formatting request after independent review.

The Claude lane initially refused a pre-filled pass verdict because no independent review had been performed. The follow-up request provided redacted implementation and validation evidence. Claude then inspected relevant code/tests, observed the test suite passing, completed an independent policy/security review, and only afterward emitted the final machine-readable typed verdict.

## Typed Verdict Observation

`observeInjectedSdkReviewerVerdictV1` observed all canonical perspective verdicts as schema-valid `flowdesk.top_tier_review_verdict.v1` outputs matching workflow, lane plan, binding, and perspective:

| Perspective | Status | Verdict id | Label | Uncertainty |
|---|---|---|---|---|
| `policy_security` | `verdict_observed` | `verdict-policy-security-live-20260522d` | `pass` | `low` |
| `architecture` | `verdict_observed` | `verdict-architecture-live-20260522d` | `pass` | `low` |
| `verification_implementation` | `verdict_observed` | `verdict-verification-implementation-live-20260522d` | `pass` | `low` |

The acceptance adapter then returned:

- Status: `verdicts_accepted`.
- Accepted verdict ids: `verdict-policy-security-live-20260522d`, `verdict-architecture-live-20260522d`, `verdict-verification-implementation-live-20260522d`.
- Accepted perspectives: `policy_security`, `architecture`, `verification_implementation`.
- `typedReviewerVerdictsAccepted: true`.

All dispatch/runtime authority flags on the acceptance result remained disabled:

- `realOpenCodeDispatch: false`.
- `providerCall: false`.
- `runtimeExecution: false`.
- `actualLaneLaunch: false`.
- `fallbackAuthority: false`.
- `toolAuthority: false`.
- `hardCancelOrNoReplyAuthority: false`.

## Result

This closes the live typed reviewer verdict observation and local acceptance proof slice. It proves that coordinator-controlled registered reviewer lanes can produce machine-readable typed verdicts that FlowDesk can observe and accept only after a consumed `reviewer_fanout` approval.

It does not promote default Release 1 real dispatch, automatic fallback, hard chat no-reply/cancel/stop, external GitHub/connector/storage writes, or production managed-dispatch execution. Durable linkage of live verdict artifacts into long-lived workflow evidence and full lane lifecycle/no-output classification remain follow-up hardening items before these verdicts can support a broader production dispatch decision.
