# Release 3 Fake Remote Connector Simulation

Date: 2026-05-22

## Scope

This slice adds a fake remote connector simulation contract in `@flowdesk/core`. It records only simulated remote-write evidence after the remote write connector gate reports readiness. It does not install tools, call GitHub, call HTTP APIs, write to storage or databases, launch MCP connectors, or persist a real remote write result.

The word "adapter" in current TypeScript helper names is historical/local-test wording. It must not be read as a plan to build one direct GitHub/API/storage/database adapter per target. Real remote write execution is planned through `ConnectorProfile` records, recipe refs, skill/command/agent playbooks, and a generic connector gateway.

## Added Contract

`flowdesk.fake_remote_connector_write_result.v1` records:

1. workflow, attempt, connector, target, and content-hash refs from the dry-run remote write plan.
2. a redacted opaque `fake-remote-*` remote ref.
3. `fake_remote_write_attempted=true` only for fake success.
4. `remote_write_attempted=false`, `connector_write_attempted=false`, and all GitHub/storage/database/URL/raw-path/provider/lane/runtime authority disabled.

## Safety Boundary

`prepareFlowDeskFakeRemoteConnectorWriteV1` re-evaluates connector execution readiness from:

1. connector capability discovery,
2. dry-run remote write plan,
3. consumed `external_write` approval,
4. redacted fake remote ref.

The helper blocks when the connector is unavailable, auth scope drifts, approval is not consumed, approval action is wrong, or the fake remote ref contains a raw URL/path/secret-shaped value. A fake success does not become connector execution authority and does not authorize a later real write.

## Verification

Targeted verification should include:

```text
npm test --workspace @flowdesk/core -- --test-name-pattern "fake remote connector|remote write connector"
npm run typecheck --workspace @flowdesk/core
```

## Remaining Gaps

1. No `ConnectorProfile` or connector recipe-ref schema yet.
2. No skill/command/agent playbook binding yet.
3. No generic connector gateway execution boundary yet.
4. No connector installation/activation executor yet.
5. No live remote write smoke.
6. No durable session-evidence class for remote connector readiness or remote write result yet.
7. No doctor/status surface for remote connector capability discovery yet.
