# Release 3 Authority Hardening

Date: 2026-05-21

## Scope

This note records a post-live-conformance hardening pass for Release 3 blocker contracts. It does not enable new runtime authority. The purpose is to reduce the risk that live provider/lane/reviewer evidence is overinterpreted as broad product authority.

## Hardened Areas

### Durable Session Evidence

- Session evidence batch application now rejects duplicate target paths before writing any evidence record.
- Existing prevalidation still rejects forged paths, escaping temp paths, schema mismatch, workflow mismatch, stale evidence, profile drift, symlinked evidence roots, malformed JSON, and redaction failures.
- Runtime authority flags remain false on write/apply/reload artifacts.

### Production Approval Source

- `typed_phrase` approvals must use the `external_user_confirmation` issuer boundary.
- `signed_intent` approvals must use the `external_signed_intent` issuer boundary.
- Consumption must happen after issuance and before expiry.
- Consumption audit refs must differ from issuance audit refs.
- Persisted consumed approvals must keep `consumed_by_attempt_id` aligned with the original scoped attempt.

### Dispatch Attempt Manifest

- `approval_consumed` and `sdk_call_permitted` manifests require both consumed approval and committed pre-dispatch audit.
- `planned` manifests cannot carry consumed approval or committed audit.
- `audit_committed` manifests require a committed audit flag.
- `updated_at` cannot precede `created_at`.

### Lane Lifecycle And Reviewer Approval Separation

- Complete lanes now require child session, message, output, runtime echo, telemetry, and verdict refs.
- `no_output` lanes cannot carry output or verdict refs.
- Failed lane states (`aborted`, `timeout`, `orphaned`, `invocation_failed`) cannot carry verdict refs.
- Parent and child session refs must remain distinct.

### Exact Model Reviewer Planning

- Invalid exact-model availability caches now produce `cache_invalid` and no reviewer lane bindings.
- Stale same-day cache checks produce no reviewer lane bindings.
- Valid cache availability remains planning input only and does not imply dispatch, quota, health, approval, or Guard authority.

### Fallback/Reselection

- Fallback decisions now require at least fresh usage, health, and runtime evidence refs.
- Fallback-derived evidence refs are rejected.
- Fallback depth must start at one and remain bounded by max depth.
- Automatic fallback authority remains false.

### Operational Intelligence

- Passed hard filters cannot carry blocked labels.
- Blocked hard filters must carry blocked labels and force score zero.
- Reference pack source refs and source hash refs must align one-to-one.
- Scores and reference packs remain advisory-only and cannot act as approval, dispatch authority, professional signoff, or external-write authority.

## Verification

Commands run from `/Users/bagel_macpro_055/Documents/work/projects/flowdesk`:

1. `npm run build && node --test packages/core/dist/session-evidence.test.js packages/core/dist/production-approval-source.test.js packages/core/dist/dispatch-attempt-manifest.test.js packages/core/dist/lane-lifecycle-record.test.js packages/core/dist/model-availability-cache.test.js packages/core/dist/fallback-decision.test.js packages/core/dist/operational-intelligence.test.js` passed: 41/41 targeted tests.
2. LSP diagnostics were clean for the changed core source files.

## Authority State

The hardening pass closes stricter local contract gaps only. It does not promote:

1. Default Release 1 real dispatch.
2. Hard chat `noReply`, cancel, or stop authority.
3. Automatic fallback/reselection execution.
4. External ledger, GitHub, connector, or storage writes.
5. Typed reviewer verdict approval from live reviewer content.
