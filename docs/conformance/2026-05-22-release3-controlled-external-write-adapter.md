# Release 3 Controlled External Write Adapter

Date: 2026-05-22

## Scope

This note records local adapter wiring for controlled external-write promotion. It does not record a GitHub write, connector write, storage write, database write, URL write, raw-path write, provider call, lane launch, or unmanaged filesystem write.

## Result

`prepareFlowDeskControlledExternalWriteAdapterV1` converts a schema-valid `flowdesk.controlled_external_write_request.v1` plus consumed `external_write` approval into `write_ready` only when the core promotion contract accepts the target. The adapter preserves the target kind/ref and exposes safe next actions for status and debug export.

Blocked requests return `blocked_before_write` with `/flowdesk-status` as the only safe next action.

## Safety Boundary

The adapter does not perform the write itself. It is a final local pre-write readiness gate for controlled redacted targets only. Runtime and dispatch authority remain disabled:

- `writeAttempted: false`
- `realOpenCodeDispatch: false`
- `providerCall: false`
- `actualLaneLaunch: false`
- `runtimeExecution: false`

The only positive authority bit in the adapter result is `controlledExternalWriteAuthorized: true`, and only after the core promotion contract accepts:

- target kind is controlled (`redacted_audit_export` or `release_conformance_doc`)
- target ref is opaque and not GitHub/connector/storage/database/URL/raw-path shaped
- redaction policy, content hash, pre-write audit, and dry-run refs are present
- consumed approval is scoped to `external_write`

## Local Coverage

Tests cover:

1. Valid release conformance doc target plus consumed `external_write` approval produces `write_ready` without attempting a write.
2. Forbidden GitHub/path-shaped target refs block before write.
3. Wrong approval action blocks before write.
4. Blocked and ready outcomes preserve disabled dispatch/provider/lane/runtime authority.

## Remaining Blocker

This closes only the local controlled external-write readiness adapter. Actual external writes remain limited to controlled redacted targets and should be performed only through a dedicated writer that consumes `write_ready` evidence, records the resulting artifact/audit refs, and never widens the target set to GitHub, connector, storage, database, URL, or raw-path writes without a separate gate.

## Follow-Up Recording Proof

A bounded controlled write readiness and recording proof is recorded in `docs/conformance/2026-05-22-release3-controlled-external-write-recording.md`. A consumed `external_write` approval plus `release_conformance_doc` target returned `write_ready`, then the release conformance docs were materialized as explicit local repository documentation updates. This proves only controlled release-conformance-doc recording, not remote connector or GitHub write authority.
