# @flowdesk/core

Core FlowDesk contracts, validators, schema artifacts, durable session evidence
helpers, Omnigent selection contracts, and OpenCode Release 1 safety boundaries.

This package is consumed by `@flowdesk/opencode-plugin` and by any
FlowDesk-aware tooling that needs the same fail-closed validators and
opaque-ref conventions. It performs no dispatch, never calls providers, and
never claims `realOpenCodeDispatch`, `providerCall`, `runtimeExecution`,
`actualLaneLaunch`, `fallbackAuthority`, or `hardCancelOrNoReplyAuthority`.

## Install

```bash
npm install @flowdesk/core@^0.1.19
```

## Highlights

- Release 1 minimum command surface contracts and FDS-1 schema artifacts.
- Durable `.flowdesk` session evidence writer and reload helpers.
- Fail-closed validators for usage authority, runtime echo, telemetry
  correlation, configured verification, sanitized auth capture, external
  auth/provider policy, production approval, dispatch attempt manifest,
  dispatch idempotency, reviewer fan-out plans, runtime lane launch plans,
  lane lifecycle records, lane heartbeats, fallback regate plans, and
  more.
- Lane heartbeat stall projection (`projectFlowDeskLaneStallV1`) that
  classifies FlowDesk-owned lanes as `progressing_normal`,
  `progressing_late`, `stalled`, `terminal`, or `unknown`.
- Chat intake routing with conservative Korean and English natural-language
  patterns.

## Authority Boundary

No new dispatch, fallback, runtime, lane launch, or hard chat authority is
introduced by this package. All authority flags remain `false`; only
diagnostic flags (for example `providerUsageAcquired`,
`statusEvidenceObserved`, `laneHeartbeatPersisted`,
`expectedNextHeartbeatOverdue`) can become `true`.

## License

MIT. See the workspace-level [LICENSE](https://github.com/astasdf1/flowdesk/blob/main/LICENSE).
