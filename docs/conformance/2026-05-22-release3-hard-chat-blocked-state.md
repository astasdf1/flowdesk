# Release 3 Hard Chat Blocked-State Hardening

Date: 2026-05-22

## Scope

This note records local hardening for `flowdesk.chat_hook_authority_probe.v1`. It does not prove or enable hard chat `noReply`, `cancel`, or `stop` authority, and it does not perform live OpenCode calls, provider calls, lane launches, active-profile mutation, or external writes.

## Change

`createFlowDeskChatHookAuthorityProbeV1` now distinguishes ordinary steering evidence from incomplete or unsafe hard-chat evidence:

1. `hard_control_proven` requires mutation observed plus throw-blocking, `noReply`, cancel/stop, no duplicate assistant reply, timeout/null fail-closed, and malformed-return fail-closed observations.
2. `steering_only` requires mutation observed, no duplicate assistant reply, timeout/null fail-closed, and malformed-return fail-closed, while hard-control primitives may remain unproven.
3. `blocked` is used when mutation is missing, duplicate assistant reply is observed, timeout/null does not fail closed, or malformed returns do not fail closed.

All outcomes continue to force `hardCancelOrNoReplyAuthority=false`, `dispatch_authority_enabled=false`, `providerCall=false`, `runtimeExecution=false`, and `actualLaneLaunch=false`.

## Verification

Command run from `/Users/bagel_macpro_055/Documents/work/projects/flowdesk`:

1. `npm test --workspace @flowdesk/core -- --test-name-pattern "chat hook probe"` passed: 255/255 tests in the matched core run.
2. LSP diagnostics were clean for `packages/core/src/chat-hook-authority-probe.ts` and `packages/core/src/chat-hook-authority-probe.test.ts`.
3. `npm run typecheck` passed.
4. `npm test` passed: 324/324 tests.
5. `GIT_MASTER=1 git diff --check` passed.

## Authority State

Hard chat authority remains blocked. This hardening only prevents timeout/null, malformed-return, duplicate-reply, and missing-mutation gaps from being misread as sufficient steering or hard-control proof.
