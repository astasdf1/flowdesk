# Release 3 SDK Chat-Control Authority

Date: 2026-05-22

## Scope

This note supersedes only the actionable SDK-control portion of the hard-chat timebox. The `chat.message` hook still does not prove first-class reply suppression, cancellation, or stop behavior, so `hardCancelOrNoReplyAuthority` remains false.

The active OpenCode 1.15 SDK/plugin typings expose three first-class control surfaces that FlowDesk can model separately from `chat.message` hard-chat authority:

1. `permission.ask` with output status `ask`, `deny`, or `allow`.
2. `session.abort({ path: { id } })`.
3. `session.prompt` and `session.promptAsync` bodies with `noReply?: boolean`.

## Implementation

`@flowdesk/core` now has fail-closed contracts for:

1. `flowdesk.permission_ask_decision.v1`.
2. `flowdesk.session_abort_decision.v1`.
3. `flowdesk.prompt_no_reply_decision.v1`.

The plugin now wraps those SDK surfaces in explicit adapters:

1. `applyFlowDeskPermissionAskControlV1` mutates only the `permission.ask` hook status after validating the decision and keeps provider/runtime/lane authority false.
2. `abortFlowDeskSessionWithDecisionV1` calls only `client.session.abort` after validating a session-abort decision and keeps provider/runtime/lane authority false.
3. `dispatchFlowDeskPromptNoReplyWithDecisionV1` calls the injected SDK prompt method with `noReply: true` only when the no-reply decision, session binding, agent binding, provider/model binding, bounded text, and FlowDesk-to-OpenCode provider mapping all validate.

## Boundary

This closes the SDK-control design gap within the active OpenCode typing surface, but it does not close hard-chat blocker proof. `prompt noReply` is an SDK prompt option, not a `chat.message` hook return authority. `session.abort` is coordinator-issued session control, not proof that an arbitrary incoming chat turn can be cancelled safely. `permission.ask` denial is tool/permission gating, not dispatch approval.

Default Release 1 behavior remains command-backed and non-dispatch. These adapters are explicit helper surfaces only and do not change default server registration.

## Validation

Targeted validation passed:

1. `npm test --workspace @flowdesk/core`: 273/273.
2. `npm test --workspace @flowdesk/opencode-plugin`: 96/96.
3. `npm run typecheck`.
4. `npm test`: 369/369.
5. `GIT_MASTER=1 git diff --check`.

The tests prove malformed authority claims block before hook status mutation, session abort calls occur only after decision validation, no-reply prompt calls include `noReply: true`, mismatched session/agent/model bindings block before prompt calls, and ordinary managed-dispatch beta calls still omit `noReply`, `tools`, `cancel`, and fallback controls.
