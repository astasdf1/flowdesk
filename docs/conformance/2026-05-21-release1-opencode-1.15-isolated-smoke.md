# Release 1 OpenCode 1.15 Isolated Smoke

Date: 2026-05-21

## Scope

This smoke verifies the Release 1 command-backed non-dispatch plugin path against the OpenCode 1.15 package line in an isolated throwaway npm profile. It did not touch the active OpenCode profile, call providers, run `opencode run`, enable real dispatch, launch lanes, switch providers/models, publish packages, or prove hard chat cancellation/no-reply authority.

## Environment

- Local Node: `v24.14.1`.
- Local npm: `11.11.0`.
- Local OpenCode CLI: `1.15.5`.
- Isolated profile root: `/var/folders/yh/84gs38c94211rknpy09lpz_40000gn/T/opencode/flowdesk-r1-opencode-115-smoke/profile`.
- Packed workspace packages installed into the isolated profile:
  - `@flowdesk/core@0.1.0`
  - `@flowdesk/opencode-plugin@0.1.0`
  - `@opencode-ai/plugin@1.15.6`
  - `@opencode-ai/sdk@1.15.6`

## Commands

```sh
npm run build
npm pack --workspace @flowdesk/core --pack-destination /var/folders/yh/84gs38c94211rknpy09lpz_40000gn/T/opencode/flowdesk-r1-opencode-115-smoke
npm pack --workspace @flowdesk/opencode-plugin --pack-destination /var/folders/yh/84gs38c94211rknpy09lpz_40000gn/T/opencode/flowdesk-r1-opencode-115-smoke
npm install --prefix /var/folders/yh/84gs38c94211rknpy09lpz_40000gn/T/opencode/flowdesk-r1-opencode-115-smoke/profile --prefer-online /var/folders/yh/84gs38c94211rknpy09lpz_40000gn/T/opencode/flowdesk-r1-opencode-115-smoke/flowdesk-core-0.1.0.tgz /var/folders/yh/84gs38c94211rknpy09lpz_40000gn/T/opencode/flowdesk-r1-opencode-115-smoke/flowdesk-opencode-plugin-0.1.0.tgz
node smoke.mjs
```

## Evidence

The isolated smoke script completed successfully with this redacted summary:

```json
{
  "ok": true,
  "plugin": "@flowdesk/opencode-plugin",
  "pluginVersion": "0.1.0",
  "opencodePluginVersion": "1.15.6",
  "opencodeSdkVersion": "1.15.6",
  "toolCount": 11,
  "chatMessagePresent": true,
  "directToolsChecked": [
    "flowdesk_pre_spike_doctor",
    "flowdesk_doctor",
    "flowdesk_status",
    "flowdesk_usage"
  ],
  "chatIntakeChecked": true,
  "chatMessageSteeringChecked": true,
  "fds1FixtureCatalogChecked": true,
  "fds1ProbeToolsChecked": 9,
  "authority": {
    "providerCall": false,
    "runtimeExecution": false,
    "actualLaneLaunch": false,
    "fallbackAuthority": false,
    "hardCancelOrNoReplyAuthority": false
  }
}
```

Validated behavior:

1. Direct module load returned plugin id `flowdesk`.
2. Default server load exposed 11 tools and a `chat.message` hook.
3. `flowdesk_pre_spike_doctor`, `flowdesk_doctor`, `flowdesk_status`, and `flowdesk_usage` succeeded without provider/runtime/lane authority.
4. Korean status chat intake routed to `flowdesk_status` and remained non-dispatch.
5. `chat.message` appended visible FlowDesk steering and did not emit `noReply`, `cancel`, or `stop` fields.
6. FDS-1 fixture catalog validation passed, valid minimal samples were accepted, and unknown-property samples failed closed.
7. Sandbox FDS-1 probe tools existed for the 9 Release 1 minimum commands, accepted no production work, and preserved `providerCall=false` and `runtimeExecution=false`.

## Interpretation

This clears the immediate OpenCode 1.15 Release 1 package-compatibility blocker for isolated command-backed non-dispatch behavior. It does not promote any later-gated capability. Real provider dispatch, actual OpenCode subtask/model/provider lane launch, automatic fallback/reselection, production model selection, hard chat cancellation/no-reply authority, and top-tier reviewer lane orchestration remain blocked until separate conformance and Guard gates pass.
