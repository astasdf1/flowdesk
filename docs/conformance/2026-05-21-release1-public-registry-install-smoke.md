# Release 1 Public Registry Install Smoke

Date: 2026-05-21

## Scope

This smoke verified the published npm packages in an isolated throwaway profile under `/var/folders/yh/84gs38c94211rknpy09lpz_40000gn/T/opencode`. It did not touch the active OpenCode profile, call providers, run `opencode run`, enable real dispatch, launch lanes, switch providers/models, or prove hard chat cancellation/no-reply authority.

## Environment

- OpenCode CLI available locally: `1.14.50`.
- Installed from the public npm registry into a throwaway profile:
  - `@flowdesk/core@0.1.0`
  - `@flowdesk/opencode-plugin@0.1.0`
  - `@opencode-ai/plugin@1.3.12`
- `npm install --prefer-online` completed successfully.

## Plugin Load Evidence

Direct module load from the registry-installed plugin succeeded.

- plugin id: `flowdesk`
- tool count: 11
- tools:
  - `flowdesk_abort`
  - `flowdesk_chat_intake`
  - `flowdesk_doctor`
  - `flowdesk_export_debug`
  - `flowdesk_plan`
  - `flowdesk_pre_spike_doctor`
  - `flowdesk_resume`
  - `flowdesk_retry`
  - `flowdesk_run`
  - `flowdesk_status`
  - `flowdesk_usage`
- `chat.message` hook present: `true`

The pre-spike doctor reported Release 1 non-dispatch registration:

- `productionToolRegistration: "release1-non-dispatch-command-backed"`
- `localNonDispatchAdapterProfile: "local_non_dispatch_command_adapter"`
- `naturalLanguageRoutingProfile: "chat_steering_command_backed_non_dispatch"`
- `realOpenCodeDispatch: "disabled"`
- `providerCall: false`
- `runtimeExecution: false`
- `actualLaneLaunch: false`
- `fallbackAuthority: false`
- `hardCancelOrNoReplyAuthority: false`

## Command and Chat Smoke

Validated paths:

- Direct `flowdesk_status` tool request succeeded.
  - handler mode: `command_backed_core_evaluator`
  - response schema valid: `true`
  - `realOpenCodeDispatch: false`
  - `providerCall: false`
  - `runtimeExecution: false`
  - `actualLaneLaunch: false`
- Chat-intake request for `FlowDesk 상태를 확인해줘` succeeded.
  - route decision: `use_command_fallback`
  - routed tool: `flowdesk_status`
  - routed tool handler ok: `true`
  - `providerCall: false`
  - `runtimeExecution: false`
  - `actualLaneLaunch: false`
  - `fallbackAuthority: false`
  - `hardCancelOrNoReplyAuthority: false`

## Interpretation

This smoke proves the public npm registry packages can be installed into an isolated profile and loaded as the Release 1 command-backed non-dispatch plugin. It supersedes the earlier local-tarball-only install evidence for public distribution readiness.

It does not promote any later-gated capability. Real provider dispatch, automatic provider/model fallback or reselection, actual OpenCode subtask/model/provider lane launch, hard chat cancellation/no-reply authority, production model selection, and release approval for managed dispatch remain blocked until their separate conformance and Guard gates pass.
