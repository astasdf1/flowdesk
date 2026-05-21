# Release 1 Active Profile Registry Smoke

Date: 2026-05-21

## Scope

This smoke migrated the active OpenCode profile dependency entries for FlowDesk from durable local tarballs to published npm registry packages and verified the installed plugin module from the active profile. It did not call providers, run `opencode run`, enable real dispatch, launch lanes, switch providers/models, or prove hard chat cancellation/no-reply authority.

## Active Profile Change

Active profile root: `~/.config/opencode`.

The active profile already listed `@flowdesk/opencode-plugin` in `opencode.json`. Only the package dependency source changed:

- `@flowdesk/core`: `file:./flowdesk-packages/flowdesk-core-0.1.0.tgz` -> `0.1.0`
- `@flowdesk/opencode-plugin`: `file:./flowdesk-packages/flowdesk-opencode-plugin-0.1.0.tgz` -> `0.1.0`

`npm install --prefer-online` initially left the old file resolutions in place, so the package refresh was repeated with exact registry specs. The active lockfile then resolved the packages to:

- `https://registry.npmjs.org/@flowdesk/core/-/core-0.1.0.tgz`
- `https://registry.npmjs.org/@flowdesk/opencode-plugin/-/opencode-plugin-0.1.0.tgz`

`npm ls @flowdesk/core @flowdesk/opencode-plugin --json --depth=0` reported both packages at `0.1.0` with registry URLs.

## Plugin Load Evidence

The active profile loaded the plugin through the package server export `@flowdesk/opencode-plugin/server`.

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

The package root import exposes helper exports rather than the plugin server default, so the active smoke used the documented `./server` export.

## Command and Chat Smoke

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

Validated active-profile paths:

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

The active OpenCode profile now uses the published `@flowdesk/core@0.1.0` and `@flowdesk/opencode-plugin@0.1.0` registry packages rather than local tarball dependencies, and the installed active-profile plugin module preserves the Release 1 command-backed non-dispatch boundary.

This does not promote managed dispatch or any later-gated capability. Real provider dispatch, automatic provider/model fallback or reselection, actual OpenCode subtask/model/provider lane launch, hard chat cancellation/no-reply authority, production model selection, and release approval for managed dispatch remain blocked until their separate conformance and Guard gates pass.
