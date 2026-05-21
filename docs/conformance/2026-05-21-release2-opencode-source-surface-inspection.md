# Release 2 OpenCode Source-Surface Inspection

Date: 2026-05-21

## Scope

This note records source-level inspection of extracted OpenCode SDK, plugin, and external auth plugin packages. It is API-surface evidence only. It does not prove runtime lane lifecycle behavior, actual provider dispatch, hard chat no-reply/cancel authority, npm registry installation, or release approval.

Inspected package extracts:

- `@opencode-ai/sdk@1.15.5`
- `@opencode-ai/plugin@1.3.12`
- `opencode-claude-auth@1.5.4`
- `opencode-gemini-auth@1.4.15`

Extraction root: `/var/folders/yh/84gs38c94211rknpy09lpz_40000gn/T/opencode/flowdesk-opencode-sdk-inspect`

## SDK Subtask and Session Surface

Source references:

- `sdk/dist/v2/gen/sdk.gen.d.ts`
- `sdk/dist/v2/gen/types.gen.d.ts`

Proven API surfaces:

- `session.create` accepts `parentID`, `agent`, and structured `model` fields.
- `Session` and `SessionInfo` include optional `parentID`, `agent`, and `model` fields.
- `session.children` returns child `Session` records for a parent session.
- `session.prompt` and `session.promptAsync` accept `SubtaskPartInput` through their `parts` arrays.
- `SubtaskPartInput` includes `type: "subtask"`, `prompt`, `description`, `agent`, optional structured `model`, and optional `command`.
- Assistant message and session info types expose agent/model echo fields.
- SDK session APIs expose `noReply?: boolean` on prompt surfaces and `session.abort` for active sessions.

Not proven by the SDK typings:

- `session.command` does not accept `SubtaskPartInput`; its `parts` surface is file-only in the inspected typings.
- No literal `subtask: true` runtime boolean was found. Optional `subtask?: boolean` exists only in command/config declaration shapes.
- Typings do not prove that runtime-created subtasks populate child sessions, parent refs, telemetry, timeout metadata, or trustworthy provider/model echo in actual execution.

FlowDesk interpretation: reviewer lane conformance may cite SDK prompt/subtask and session child metadata as source-surface evidence, but actual OpenCode lane lifecycle observability remains an uncertainty label until controlled runtime evidence proves it.

## Plugin Chat Control Surface

Source reference: `plugin/dist/index.d.ts`.

Proven plugin hook surfaces:

- `chat.message` receives session, agent/model, message id, user message, and mutable-looking `output.parts`.
- `chat.params` can mutate LLM request parameters.
- `chat.headers` can mutate provider request headers.
- `command.execute.before` can mutate command execution parts.
- Experimental message/system/text hooks expose mutation surfaces for their respective outputs.
- `permission.ask` can set permission status to `ask`, `deny`, or `allow`.

Not proven by plugin typings:

- No plugin hook return type includes `boolean`, `preventDefault`, `cancel`, `stop`, `abort`, or `noReply` authority.
- `chat.message` does not expose first-class hard no-reply or assistant suppression semantics.
- Throw-based suppression is not proven by the inspected type surface.
- The SDK `noReply` and `abort` surfaces are session API capabilities, not plugin hook cancellation authority.

FlowDesk interpretation: hard managed chat cancel/no-reply authority remains unclaimed. Release 1 chat stays steering/command-backed, and Release 2 production dispatch must not depend on plugin-level hard chat suppression.

## External Auth Plugin Introspection Surface

Source references:

- `claude-auth/dist/index.d.ts`
- `claude-auth/dist/credentials.d.ts`
- `claude-auth/dist/keychain.d.ts`
- `claude-auth/dist/model-config.d.ts`
- `gemini-auth/dist/index.d.ts`

Safe source-surface metadata, after sanitization:

- Claude account count and sanitized account labels/sources can be derived, but account objects include credentials and must not be persisted whole.
- Claude subscription type and expiry timestamp are visible through credential shapes; expiry is usable as metadata only after stripping tokens.
- Claude model/beta config metadata is visible through model config exports.
- Gemini auth method labels, provider id, OAuth scope intent, expiry timestamp, project/tier metadata, and quota bucket summaries are visible in the inspected plugin surface/implementation.
- Gemini email is readable after OAuth exchange, but it is PII and should be omitted or redacted unless user-visible consent exists.

Secret-sensitive surfaces that must not be logged or persisted by FlowDesk:

- Claude `accessToken`, `refreshToken`, token-bearing account objects, auth.json sync payloads, request headers, and token refresh results.
- Gemini `access`, `refresh`, `apiKey`, PKCE verifier, OAuth state, authorization code, callback URLs, token endpoint payloads, and debug request/response bodies.

Not proven:

- Claude does not expose a token-free email/profile id, granted OAuth scope list, or provider-native quota remaining/reset bucket surface in the inspected APIs.
- Gemini does not expose a dedicated stable token-free account object; token-bearing auth details must be sanitized.

FlowDesk interpretation: external auth introspection can be built as an allowlisted sanitizer, not as a raw plugin object persistence path. External auth policy and doctor gating remain later work.

## Production Impact

No production authority changed in this inspection.

- `realOpenCodeDispatch`: still gated.
- `actualLaneLaunch`: still gated.
- `providerCall`: not performed by this inspection.
- `runtimeExecution`: not performed by this inspection.
- `hardChatCancelOrNoReply`: still unclaimed.
- `default_release1_non_dispatch_preserved`: unchanged.

## Remaining Uncertainties

- Runtime proof that prompt-subtask parts create observable reviewer lanes with parent/child references.
- Runtime proof that OpenCode echoes the Guard-approved concrete provider/model binding in a trustworthy way for lane outputs.
- Durable production-path mapping from sanitized external auth metadata into FlowDesk policy/doctor diagnostics.
- First-class hard chat no-reply/cancel authority, if any, outside the inspected plugin typings.
