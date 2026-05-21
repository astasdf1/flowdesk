# Release 3 Durable Approval Provenance Hardening

Date: 2026-05-22

## Scope

This note records local durable-provenance hardening for production approval sources and dispatch pre-call readiness. It does not enable provider calls, real OpenCode dispatch, actual lane launches, active-profile mutation, external writes, or default Release 1 dispatch.

## Change

`flowdesk.production_approval_source.v1` is now a first-class durable session-evidence class:

1. `production_approval_source` records are written under `.flowdesk/sessions/<workflow>/evidence/production-approval-source/<evidence>.json`.
2. Session evidence reload validates those records with `validateFlowDeskProductionApprovalSourceV1`, not only by schema id.
3. Forged authority fields, profile drift, workflow drift, stale expiry, schema mismatch, redaction failures, path traversal, and symlink/root escape continue to fail closed through the session-evidence reload path.

`flowdesk.dispatch_idempotency_snapshot.v1` is also a first-class durable session-evidence class. `evaluateFlowDeskDispatchIdempotencyReplayV1` blocks a dispatch attempt when its attempt id is already recorded or its idempotency key has already been used in the reloaded snapshot.

`evaluateFlowDeskDispatchAttemptDurablePrecallV1` adds a pure durable readiness layer over the existing object-level pre-call evaluator. It requires:

1. A valid reload result with no blocked evidence entries.
2. A reloaded `dispatch_idempotency` snapshot that does not contain the manifest attempt id or idempotency key.
3. A reloaded `production_approval_source` record whose `approval_id` matches the dispatch manifest `approval_ref`.
4. A reloaded `pre_dispatch_audit` entry matching the dispatch manifest `pre_dispatch_audit_ref`.
5. The existing manifest and consumed-approval scope checks.

The evaluator remains non-authorizing: `dispatch_authority_enabled=false`, `realOpenCodeDispatch=false`, `providerCall=false`, `runtimeExecution=false`, and `actualLaneLaunch=false`.

The explicit opt-in `dispatchManagedDispatchBetaPromptV1` adapter now requires this durable evaluator before managed-dispatch promotion and injected SDK calls. The adapter no longer accepts a direct in-memory `consumedApproval` object as sufficient pre-call provenance; callers must provide a reloaded evidence bundle containing the matching consumed approval source and pre-dispatch audit evidence.

## Verification

Command run from `/Users/bagel_macpro_055/Documents/work/projects/flowdesk`:

1. `npm test --workspace @flowdesk/core -- --test-name-pattern "dispatch attempt|session evidence|idempotency"` passed: 262/262 tests in the matched core run.
2. LSP diagnostics were clean for changed TypeScript files.
3. `npm test --workspace @flowdesk/opencode-plugin -- --test-name-pattern "managed dispatch beta adapter|managed dispatch beta server"` passed: 69/69 tests in the matched plugin run after adapter wiring.
4. `npm run typecheck` passed.
5. `npm test` passed: 328/328 tests before adapter wiring; full validation was rerun after adapter wiring in the same work session before commit.
6. `GIT_MASTER=1 git diff --check` passed.

## Authority State

Managed dispatch remains gated and default Release 1 dispatch remains disabled. This change only prevents later gates from treating arbitrary in-memory approval objects as durable approval-source provenance.
