# Release 3 Blocker Clearance Plan

Date: 2026-05-21

## Purpose

This plan orders the remaining blockers that would prevent FlowDesk from progressing safely from the current Release 1/2 state through Release 3. It preserves the fail-closed boundary: no real dispatch, actual lane launch, automatic fallback/reselection, top-tier reviewer fan-out, hard chat cancellation/no-reply, package publish, active-profile mutation, provider call, or external storage write may occur without the listed proof and required confirmation.

## Dependency-Ordered Backlog

| Order | Blocker | Release/Phase | Current Evidence | Required Safe Proof | Target | Verification | Confirmation |
|---:|---|---|---|---|---|---|---|
| 1 | OpenCode 1.15 Release 1 compatibility | R1 / Phase 3-4 | Type/source compatibility and isolated smoke now exist for `@opencode-ai/plugin@1.15.6`. | Fresh public-registry and active-profile smoke after `0.1.1` publish. | `docs/conformance`, npm package metadata. | `npm test`, isolated install smoke, active profile module-load smoke. | Required before npm publish or active profile mutation. |
| 2 | Package distribution drift | R1 / Phase 3 | Workspace plugin is `0.1.1` candidate; published `0.1.0` remains older. | npm publication of `@flowdesk/opencode-plugin@0.1.1`, registry freshness check, install smoke. | `packages/opencode-plugin/package.json`, npm registry evidence. | `npm pack --dry-run`, isolated install, fresh registry install. | Required for `npm publish`. |
| 3 | FDS-1 schema conversion under updated package line | R1 / Phase 4 | Runtime-closed fixture/probe smoke passes locally under `@opencode-ai/plugin@1.15.6`. | If OpenCode provider-facing conversion behavior is exercised, unknown-property rejection must still fail closed. | FDS-1 conformance docs and probe tooling. | FDS-1 fixture/probe smoke; no provider call. | Not required for local probe; required for external OpenCode conformance mutation. |
| 4 | Chat hook hard-control uncertainty | R1/R2 / Phase 6 | `chat.message` steering appends visible text and emits no `noReply`, `cancel`, or `stop`. | E2E proof of no duplicate assistant reply, hard suppression, pending tool abort, cleanup, and audit transitions before any hard-control claim. | Hook harness, chat conformance docs, threat model. | Chat hook mutation/throw/no-reply/cancel probe. | Required before enabling hard no-reply/cancel. |
| 5 | Durable production evidence persistence | R2 / Phase 5 | Evidence contracts and session evidence write/reload exist. | Redacted durable refs reload and fail closed for usage, runtime echo, telemetry, verification, auth policy, approval, and pre-dispatch audit. | `session-evidence`, production enablement, doctor diagnostics. | `npm test -- --test-name-pattern "session evidence|production enablement|doctor"`. | Not required for local tests. |
| 6 | Production approval source authority | R2 / Phase 5 | Approval diagnostics exist but issuance authority is unresolved. | Scoped, durable, non-reusable approval decision with evidence binding and drift/denial handling. | Production approval contract and policy docs. | Approval drift/denial tests. | Required before approval issuance can authorize dispatch. |
| 7 | Single-step managed dispatch beta | R2 / Phase 5 | Core gate and opt-in injected SDK adapter exist, default server remains non-dispatch. | Trusted binding, runtime echo, telemetry, fresh usage, provider health, sanitized auth, external auth/provider policy, configured verification, Guard approval, and pre-dispatch audit in one run. | Managed-dispatch adapter, gate evaluator, conformance evidence. | Gate/unit tests plus user-approved live conformance. | Required before any provider call or real dispatch. |
| 8 | Actual delegated lane launch | R2.5 / Phase 6A | Schemas/fake probes/source surfaces exist, runtime lifecycle is unproven. | Parent/child refs, message refs, timeout/failure metadata, provider/model echo, telemetry, no-output detection, and reference-kind separation. | Reviewer lane conformance, lane records, status/debug summaries. | Lane conformance tests plus user-approved runtime probe. | Required before actual lane launch. |
| 9 | Top-tier multi-perspective reviewer lanes | R2.5/R3 | Planned contracts exist only. | Same-day exact model availability cache, registered/highest-tier binding predicates, typed verdicts, budget/quota controls, no silent lower-tier substitution. | Binding registry, availability cache, reviewer lane plans/verdicts. | `npm test -- --test-name-pattern "top-tier|reviewer|availability|binding"`. | Required before reviewer fan-out/provider calls. |
| 10 | Managed fallback/reselection | R2/R3 last gate | Fallback is diagnostic-only. | All real-dispatch gates plus runtime compatibility, policy eligibility, fresh usage/health for new binding, new attempt id, durable audit, explicit Guard approval. | Fallback decision contracts and retry/reselection docs. | Fallback/reselection tests. | Required before automatic provider/model switching. |
| 11 | Operational intelligence | R3 / Phase 7 | Concepts/schemas only. | Advisory-only scoring after hard filters, opt-in fan-out with fresh usage/budget, redacted GitHub score ledger, reference packs that never act as professional signoff. | Evaluation/proposal/ledger/reference-pack packages and docs. | Evaluation, proposal, score, ledger, redaction tests. | Required for multi-model fan-out, GitHub writes, connectors, or external storage. |

## Current Cleared Items

1. OpenCode 1.15 source/type compatibility: `@opencode-ai/plugin@1.15.6` and `@opencode-ai/sdk@1.15.6` compile with the plugin.
2. OpenCode 1.15 isolated Release 1 smoke: packaged `0.1.0` exposes 11 tools, `chat.message`, direct diagnostic/status/usage paths, chat-intake routing, and FDS-1 runtime-closed probes without runtime authority.
3. `0.1.1` publish candidate: local version bump, lockfile update, dry-run pack, tarball install, and direct module load all pass. npm publish is still waiting for explicit confirmation.

## Next Safe Actions

1. Run full repository verification after this documentation/update batch.
2. Commit and push the `0.1.1` prep and conformance records.
3. Ask for confirmation before `npm publish --workspace @flowdesk/opencode-plugin --access public`.
4. After publish, run public-registry install smoke and active-profile migration smoke.
