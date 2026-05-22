# Release 3 Hard Chat Timebox

Date: 2026-05-22

## Scope

This note records the B-track hard-chat proof timebox selected by the multi-model strategy review. The goal was to determine whether the current OpenCode 1.15 `chat.message` path proves first-class `noReply`, `cancel`, or `stop` authority.

## Probe Result

The active built plugin was loaded and its `chat.message` hook was invoked with natural-language routing enabled.

Observed result:

- Before parts count: `1`.
- After parts count: `2`.
- FlowDesk steering text was appended.
- Hook returned `undefined`.
- Hook did not throw.
- Serialized hook output and return value did not contain `noReply`, `cancel`, or `stop`.

The resulting `flowdesk.chat_hook_authority_probe.v1` outcome was `blocked`:

- `mutation_observed: true`.
- `throw_blocks_reply: false`.
- `no_reply_supported: false`.
- `cancel_or_stop_supported: false`.
- `timeout_or_null_fail_closed: false`.
- `malformed_return_fail_closed: false`.
- `hardCancelOrNoReplyAuthority: false`.

Failure labels:

- `throw_blocking_unproven`.
- `no_reply_unproven`.
- `cancel_or_stop_unproven`.
- `timeout_or_null_not_fail_closed`.
- `malformed_return_not_fail_closed`.

## Decision

Hard chat control remains unproven and blocked. FlowDesk should treat Release 3 chat behavior as visible steering plus command-backed confirmation only. It must not claim first-class no-reply, cancellation, stop, duplicate-reply suppression, timeout fail-closed, or malformed-return fail-closed authority from the current `chat.message` surface.

## Remaining Boundary

Future hard-chat work requires a first-class OpenCode boundary or a new conformance proof that explicitly demonstrates reply suppression/cancellation semantics, timeout/null fail-closed behavior, malformed-return fail-closed behavior, and duplicate assistant reply prevention. Until then, `hardCancelOrNoReplyAuthority` remains false in all production surfaces.
