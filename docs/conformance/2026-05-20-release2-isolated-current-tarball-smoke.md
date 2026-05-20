# Release 2 Isolated Current-Tarball Smoke

Date: 2026-05-20

## Scope

This smoke verified the current workspace build as isolated local tarballs, separate from the active OpenCode profile. It does not prove npm registry install, OpenCode `subtask: true` lifecycle observability, hard chat cancellation/no-reply authority, or production dispatch approval.

## Environment

- OpenCode CLI: `1.14.50`
- Sandbox root: `/var/folders/yh/84gs38c94211rknpy09lpz_40000gn/T/opencode/flowdesk-isolated-evidence-20260520`
- Installed packages from current workspace tarballs:
  - `@flowdesk/core@0.1.0`
  - `@flowdesk/opencode-plugin@0.1.0`
  - `@opencode-ai/plugin@1.3.12`
- `npm install` in the isolated profile completed with zero vulnerabilities.

## Package Evidence

Current workspace build and pack succeeded before install.

- `@flowdesk/core@0.1.0`
  - tarball: `flowdesk-core-0.1.0.tgz`
  - shasum: `87118c0e8764bcd5abc537ed552d1efbdd1d492c`
  - total files: 117
- `@flowdesk/opencode-plugin@0.1.0`
  - tarball: `flowdesk-opencode-plugin-0.1.0.tgz`
  - shasum: `e64725ee69329af6e86cab1a0f052f7c0e343703`
  - total files: 37

## Plugin Load Smoke

Direct module load from the isolated installed tarball succeeded.

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

The pre-spike doctor reported `release1-non-dispatch-command-backed`, eight readiness checks passed, and all runtime authority flags stayed disabled:

- `providerCall: false`
- `runtimeExecution: false`
- `actualLaneLaunch: false`

## Command and Chat Smoke

Validated paths:

- Direct `/flowdesk-doctor` equivalent with `input_mode: "portable_command"` succeeded.
  - handler mode: `command_backed_diagnostic_handler`
  - request schema valid: true
  - response schema valid: true
  - status: `degraded`
  - production refs included:
    - `production_enablement_state=disabled`
    - `production_evidence_persistence=implemented_core_contract`
    - `production_approval_state_machine=fail_closed`
    - `configured_verification_gate=required`
    - `external_auth_provider_policy_gate=required`
- Direct `/flowdesk-status` equivalent succeeded.
  - handler mode: `command_backed_core_evaluator`
  - response schema valid: true
  - `realOpenCodeDispatch: false`
  - `providerCall: false`
  - `runtimeExecution: false`
  - `actualLaneLaunch: false`
- Chat-routed `/flowdesk-doctor` succeeded and routed to `flowdesk_doctor`.
- Korean status chat intake (`FlowDesk 상태를 확인해줘`) succeeded and routed to `flowdesk_status` with `routeDecision: "use_command_fallback"`.
- The `chat.message` hook emitted a visible text-only FlowDesk card suggesting `/flowdesk-status`.

## Fail-Closed Evidence

A direct doctor request using unsupported `input_mode: "command"` did not produce a diagnostic response and failed closed inside the handler:

- handler mode: `request_schema_invalid`
- request schema valid: false
- errors included `input_mode is not allowed` and `input_mode is invalid`
- runtime authority flags remained disabled.

## Production Enablement Contract Smoke

The isolated installed `@flowdesk/core` evaluated a complete synthetic production evidence bundle plus required policy/config/audit refs with `allowIncompleteConformance: true`.

Result:

- state: `configured`
- blocker labels: `approval_missing`
- uncertainty labels:
  - `opencode_subtask_lifecycle_unproven`
  - `injected_sdk_runtime_echo_partial`
- `managed_dispatch_ready: false`
- `dispatch_authority_enabled: false`
- `default_release1_non_dispatch_preserved: true`

A missing-evidence evaluation produced `state: "blocked"` with missing usage, runtime echo, telemetry, pre-dispatch audit, configured verification, external auth policy, provider policy, and lane conformance blockers.

## Interpretation

This smoke increases confidence that the Release 2/2.5 production enablement contracts are packaged and usable from current tarballs, and that Release 1 non-dispatch behavior remains preserved in an isolated install. It does not promote managed dispatch to production readiness because explicit approval, real production-path persisted evidence, and OpenCode lane conformance proof are still missing.
