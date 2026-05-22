# Release 3 Controlled Redacted Audit Export Local Writer

Date: 2026-05-22

## Scope

This slice implements only the local materialization step for an already approved `redacted_audit_export` controlled-write target. It does not authorize GitHub, connector, storage, database, URL, raw-path, or broader external writes.

The write order is intentionally separate from `prepareFlowDeskControlledExternalWriteAdapterV1`: the adapter can return `write_ready`, but actual local materialization still requires a matching consumed `external_write` approval, exact content hash binding, a clean pre-write evidence reload, and reloadable ledger evidence after the write.

## Implementation

`@flowdesk/core` now has a dedicated durable evidence class and validator for `flowdesk.controlled_redacted_audit_export_write.v1`. The ledger records the request, consumed approval provenance, redaction policy ref, content hash, artifact path, local-only flags, and disabled authority flags.

`@flowdesk/opencode-plugin` now exposes `materializeFlowDeskControlledRedactedAuditExportLocalWriteV1`, which:

1. Accepts only `target_kind: "redacted_audit_export"` after `write_ready`.
2. Parses the supplied JSON export and rejects prompt-like, raw payload, credential, and raw-path markers before any write.
3. Verifies `request.content_hash_ref` against the export SHA-256.
4. Writes only `.flowdesk/sessions/<workflow_id>/redacted-audit/<target_ref>.json` under the provided local root.
5. Persists a reloadable `controlled_redacted_audit_export_write` session-evidence ledger entry.
6. Verifies artifact hash and ledger reload after write, with best-effort cleanup on post-write verification failure.

## Boundary

The result is a local redacted audit export materializer, not external-write connector authority. Remote, GitHub, connector, storage, database, URL, raw-path, provider-call, runtime, lane-launch, fallback, tool, dispatch, and hard-chat authority remain false.

Default Release 1 behavior remains command-backed and non-dispatch. This helper is an explicit controlled-write materialization surface only.

## Validation

Validation passed:

1. Clean touched-file LSP errors.
2. `npm test --workspace @flowdesk/opencode-plugin -- managed-dispatch-adapter.test.ts`: 99/99 plugin tests.
3. `npm test --workspace @flowdesk/core`: 274/274 core tests.
4. `npm run typecheck`.
5. `npm test`: 373/373 workspace tests.
