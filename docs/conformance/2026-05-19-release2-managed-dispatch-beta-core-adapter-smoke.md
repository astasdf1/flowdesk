# Release 2 Managed Dispatch Beta Core Adapter Smoke

Date: 2026-05-19

## Scope

This smoke covers the Release 2 managed-dispatch beta core gate and opt-in OpenCode SDK adapter boundary added after Release 1 production non-dispatch registration. It does not promote the default server path and does not perform a live provider call.

## Evidence

1. `@flowdesk/core` now exposes a separate managed-dispatch beta eligibility evaluator. Release 1 `evaluateGuardBoundaryV1` still blocks `real-opencode-dispatch` even when dispatchable diagnostic snapshots are present.
2. Managed-dispatch beta eligibility requires all of these inputs before adapter dispatch: managed beta policy mode, GuardApprovedDispatch, exact provider/model binding, fresh provider-native usage reset evidence, fresh dispatchable provider/OpenCode-native health, trusted runtime echo, sufficient telemetry correlation, durable pre-dispatch audit ref, configured verification ref, fallback disabled, hard chat authority disabled, and ambiguity quarantine.
3. `@flowdesk/opencode-plugin` now exposes an opt-in adapter that uses only the injected OpenCode SDK client `session.prompt` or `session.promptAsync` boundary. It does not shell out to nested `opencode run`, does not set `noReply`, does not pass tool authority, does not enable fallback, and does not claim actual lane launch authority.
4. Fake-client smoke output:

```json
{
  "blockedStatus": "blocked_before_dispatch",
  "blockedAttempted": false,
  "acceptedStatus": "dispatch_accepted",
  "acceptedAttempted": true,
  "callCount": 1,
  "model": {
    "providerID": "claude",
    "modelID": "sonnet-4"
  },
  "hasNoReply": false,
  "hasTools": false,
  "actualLaneLaunch": false
}
```

## Verification

Commands run locally:

1. `npm run test --workspace @flowdesk/core` -> 128 pass.
2. `npm run build --workspace @flowdesk/opencode-plugin && node --test packages/opencode-plugin/dist/managed-dispatch-adapter.test.js packages/opencode-plugin/dist/server.test.js` -> 21 pass.
3. `npm run typecheck` -> pass.
4. `npm test` -> 187 pass.
5. `GIT_MASTER=1 git diff --check` -> pass.
6. Direct adapter smoke with a fake injected client -> pass with the JSON above.

## Remaining Blockers

Live real-provider dispatch remains blocked until a real OpenCode runtime can supply trusted runtime echo, sufficient correlated telemetry, fresh provider-native usage, fresh provider/OpenCode-native health, durable pre-dispatch audit application evidence, and configured verification evidence for the exact provider/model/agent binding.

Default Release 1 server registration remains non-dispatch command-backed behavior.
