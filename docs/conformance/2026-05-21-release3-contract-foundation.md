# Release 3 Contract Foundation

Date: 2026-05-21

## Scope

This note records local-only contract and test work after the multi-model critical review of the remaining Release 3 blockers. It does not promote runtime authority. No provider calls, real OpenCode dispatch, actual lane launches, managed fallback/reselection, reviewer fan-out, hard chat cancel/no-reply, active-profile mutation, GitHub writes, or external storage writes were performed.

## Multi-Model Review Inputs

The blocker-resolution plan was reviewed through explicit Claude Opus, GPT frontier, and Gemini Pro lanes. The valid reviewer consensus required stricter contracts before implementation:

1. Explicit fail-closed probe states for timeout, null, malformed, no-output, missing-verdict, and thrown-error cases.
2. Whole-batch durable evidence validation before writes.
3. Stale, drifted, redaction-failed, cross-profile, malformed, symlink/root-escaped, and schema-version-mismatched evidence must fail closed.
4. Production approval source authority must be scoped, externally issued, expiry-bound, revocable, one-shot, and atomically consumed.
5. Dispatch attempt manifests must bind evidence, approval, Guard decision, committed pre-dispatch audit, idempotency, and disabled authority flags before any SDK call can be considered.

## Implemented Local Contracts

### Durable Session Evidence

`session-evidence.ts` now prevalidates the full write-intent batch before writing any evidence record. A forged later intent no longer leaves earlier records written. Evidence classes were expanded to include configured verification, sanitized auth capture, external auth/provider policy, production approval, and pre-dispatch audit records in addition to usage authority, runtime echo, and telemetry correlation.

Reload now supports optional stale and profile-alignment checks and exposes a redacted inventory summary with valid/blocked counts per evidence class. Blocked entries remain fail-closed and do not enable runtime authority.

### Production Approval Source

`production-approval-source.ts` adds `flowdesk.production_approval_source.v1` and `flowdesk.production_approval_consume_result.v1`. The contract binds approval to workflow, attempt, action type, issuer boundary, approval method, actor/profile refs, concrete provider-qualified model id, provider binding hash, evidence bundle hash, Guard decision ref, issuance audit ref, nonce ref, issued/expiry timestamps, revocation state, and an `atomic_compare_and_swap_required` consume strategy.

Consumption fails closed for replay, revocation, expiry, scope drift, model/provider hash drift, evidence-bundle drift, Guard decision drift, actor/profile drift, or authority smuggling. Consumed approvals still carry `dispatch_authority_enabled=false`.

### Dispatch Attempt Manifest

`dispatch-attempt-manifest.ts` adds `flowdesk.dispatch_attempt_manifest.v1` and `flowdesk.dispatch_attempt_precall_evaluation.v1`. The manifest binds workflow id, attempt id, actor/profile refs, concrete provider-qualified model id, provider binding hash, evidence bundle hash, evidence refs, approval ref, consumed approval ref, Guard decision ref, pre-dispatch audit ref, committed audit flag, idempotency key, timestamps, state, and disabled runtime authority flags.

The pre-call evaluator permits only manifests with committed pre-dispatch audit plus a consumed, matching approval source. It remains pure and performs no SDK call.

### OpenCode 1.15 Test Compatibility

Plugin tests now handle OpenCode 1.15-style `ToolResult` objects by parsing the `output` field where needed. This is test compatibility only and does not change plugin runtime behavior.

## Verification

Commands run from `/Users/bagel_macpro_055/Documents/work/projects/flowdesk`:

1. `npm test --workspace @flowdesk/core -- --test-name-pattern "session evidence"` passed after tightening the redaction test id.
2. `npm test --workspace @flowdesk/core -- --test-name-pattern "production approval source|session evidence"` passed.
3. `npm test --workspace @flowdesk/core -- --test-name-pattern "dispatch attempt|production approval source|session evidence"` passed.
4. `npm run typecheck` passed.
5. `npm test` passed: 287/287 tests.

## Authority State

Runtime authority remains unchanged:

- `realOpenCodeDispatch`: disabled.
- `providerCall`: disabled.
- `runtimeExecution`: disabled.
- `actualLaneLaunch`: disabled.
- `fallbackAuthority`: disabled.
- `hardCancelOrNoReplyAuthority`: disabled.

## Remaining Gate Work

The implemented contracts are foundations only. Remaining work includes explicit #3/#4 probe result contracts and runtime conformance notes, wiring the #6 approval source into production enablement diagnostics, integrating the #7 manifest with the opt-in adapter using committed audit/consumed approval checks and SDK spy tests, and later blockers #8-#11.
