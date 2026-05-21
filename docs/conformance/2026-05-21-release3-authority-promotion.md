# Release 3 Authority Promotion Contracts

Date: 2026-05-21

## Scope

This note records explicit Release 3 authority-promotion contracts in `@flowdesk/core` and the follow-up opt-in managed-dispatch adapter wiring. The pass does not flip existing Release 1 `dispatch_authority_enabled: false` artifacts and does not perform live provider calls, live lane launches, fallback execution, active-profile mutation, GitHub writes, connector writes, storage writes, or hard chat control.

## Promoted Gates

### Managed Dispatch Beta

- `promoteFlowDeskManagedDispatchBetaAuthorityV1` requires an eligible Guard boundary, a valid pre-call evaluation with `sdk_call_permitted=true`, a consumed scoped `managed_dispatch_beta` approval, and matching audit/conformance refs.
- The result enables only `managed_dispatch_beta_authority_enabled`; generic Release 1 dispatch, fallback, provider call, lane launch, and runtime execution fields remain false.
- Missing conformance, blocked pre-call labels, wrong approval action type, and authority-smuggling fields block.
- The opt-in `dispatchManagedDispatchBetaPromptV1` adapter now calls this promotion gate after the existing manifest/consumed-approval pre-call check and before resolving or calling `prompt`/`promptAsync` on the injected OpenCode SDK client.

### Reviewer Typed Verdict Acceptance

- `promoteFlowDeskReviewerTypedVerdictsV1` requires all canonical perspectives: `policy_security`, `architecture`, and `verification_implementation`.
- Each verdict must validate as `flowdesk.top_tier_review_verdict.v1`, use a distinct verdict id and perspective, include evidence refs, and report `verdict_label=pass` with `uncertainty=low`.
- The consumed approval must be scoped to `reviewer_fanout`.
- Acceptance does not grant dispatch, provider, fallback, lane-launch, or external-write authority.

### Fallback Reselection Re-Gate

- `promoteFlowDeskFallbackReselectionRegateV1` requires a valid fallback decision in `requires_full_regate` state, a new attempt id, fresh evidence refs enforced by the fallback validator, and consumed `fallback_reselection` approval bound to the new attempt.
- Terminal max-depth fallback, same-attempt fallback, automatic fallback authority, and approval mismatch block.
- The result authorizes only reselection into a full fresh re-gate, not automatic provider/model switching or SDK calls.

### Controlled External Write

- `FlowDeskControlledExternalWriteRequestV1` allows only `redacted_audit_export` and `release_conformance_doc` target kinds.
- Requests require target, redaction policy, content hash, pre-write audit, dry-run ref, timestamp, and disabled runtime authority flags.
- GitHub, connector, storage, bucket/blob, file/path, database, URL, raw payload, provider payload, unknown property, and authority-smuggling targets block.
- `promoteFlowDeskExternalWriteAuthorityV1` also requires consumed scoped `external_write` approval.

## Verification

Commands run from `/Users/bagel_macpro_055/Documents/work/projects/flowdesk`:

1. `npm test --workspace @flowdesk/core -- --test-name-pattern "authority promotion|managed dispatch promotion|reviewer typed verdict promotion|fallback reselection promotion|external write promotion"` passed: 253/253 tests in the matched core run.
2. `npm test --workspace @flowdesk/opencode-plugin -- --test-name-pattern "managed dispatch beta adapter"` passed: 69/69 tests in the matched plugin run.
3. LSP diagnostics were clean for `packages/core/src/authority-promotion.ts`, `packages/core/src/authority-promotion.test.ts`, `packages/core/src/index.ts`, `packages/opencode-plugin/src/managed-dispatch-adapter.ts`, and `packages/opencode-plugin/src/managed-dispatch-adapter.test.ts`.

## Remaining Blocked Authority

1. Default Release 1 real dispatch remains disabled.
2. Hard chat `noReply`, `cancel`, or `stop` authority remains unproven and blocked.
3. Automatic fallback execution remains blocked; fallback promotion only permits a new full re-gate.
4. GitHub, connector, storage, database, URL, and raw-path external writes remain blocked.
5. Typed reviewer verdict acceptance is not a Guard approval or dispatch approval.
