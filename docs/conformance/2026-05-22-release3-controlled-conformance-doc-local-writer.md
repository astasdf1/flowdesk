# Release 3 Controlled Conformance Doc Local Writer

Date: 2026-05-22

## Scope

This note records the C-track local-only writer/ledger hardening for the controlled `release_conformance_doc` target kind.

The writer is separate from `prepareFlowDeskControlledExternalWriteAdapterV1`. The adapter still returns `write_ready` with `writeAttempted: false`; materialization requires an explicit follow-up call to `materializeFlowDeskControlledConformanceDocLocalWriteV1`.

## Result

`materializeFlowDeskControlledConformanceDocLocalWriteV1` now materializes only the deterministic local repository path:

- `docs/conformance/<target_ref>.md`

It requires a `write_ready` readiness result, a matching controlled write request, `target_kind: release_conformance_doc`, a consumed `external_write` approval with consumption audit ref, and `content_hash_ref` equal to the SHA-256 ref computed from the exact markdown to write.

On success, it writes a reloadable session-evidence ledger record:

- Evidence class: `controlled_conformance_doc_write`.
- Schema: `flowdesk.controlled_conformance_doc_write.v1`.
- Path family: `.flowdesk/sessions/<workflow>/evidence/controlled-conformance-doc-write/<ledger_entry_id>.json`.

## Safety Boundary

The writer remains local-only and blocks before write when readiness is not `write_ready`, the target kind is not `release_conformance_doc`, approval consumption is incomplete, the hash does not match, existing session evidence cannot reload cleanly, the doc or ledger target already exists, a path escapes the project root, or an existing directory on the write path is a symlink.

The result and ledger explicitly keep remote, GitHub, connector, storage, database, URL, raw-path, dispatch, provider-call, actual-lane-launch, runtime, fallback, tool, and hard-chat authority false.

This does not enable GitHub, connector, storage, database, URL, raw-path, or external ledger writes.

## Verification

Verification performed after implementation:

- `npm run typecheck` passed.
- Focused C-track/session-evidence test command passed with 358/358 tests reported by Node's test runner.
- Full `npm test` passed with 358/358 tests.
- LSP diagnostics on touched TypeScript files reported no TypeScript errors; import-order information diagnostics remain non-blocking.

## Remaining Boundary

This closes only the local `release_conformance_doc` writer/ledger slice. Broader external-write execution, remote connector writes, GitHub writes, storage/database writes, URL writes, arbitrary filesystem paths, and managed-dispatch production integration remain blocked unless separately designed, reviewed, and proven.
