# FlowDesk Progress Snapshot

## Purpose

This document tracks implementation progress against the full FlowDesk roadmap. Update it whenever work changes implementation status, release gates, user-facing readiness, or known blockers.

This snapshot is not a substitute for tests, conformance evidence, or release approval. It is a planning artifact that keeps the roadmap state visible between sessions.

## Update Rule

Every non-trivial FlowDesk work session must update this file before concluding if any of the following changed:

1. Code, tests, docs, packaging, installer behavior, conformance evidence, or release gates.
2. A phase’s estimated progress, blocker list, or readiness interpretation.
3. The distinction between prototype, local adapter, production registration, and user-ready behavior.
4. Any critical review finding that changes plan priority or scope.

If no progress fields changed, the final response should explicitly say the progress snapshot was checked and did not need an update.

## Snapshot: 2026-05-19

This snapshot tracks implementation against the full roadmap, not only passing tests. Percentages are approximate readiness estimates for each phase’s exit criteria.

| Area | Progress | Evidence | Remaining gap |
|---|---:|---|---|
| Phase 0 Bootstrap workspace | 100% | Workspace, packages, build/test scripts, docs, and no-OMO/no-production-dispatch scaffolding exist. | None for scaffold. |
| Phase 1 Core contracts | 88% | Release 1 contracts, validators, schema artifacts, fixtures, Guard/fake-runtime/status/retry/audit/state tests, production-eligible minimum tool registry metadata, and durable workflow-state reload/fail-closed recovery tests exist. | Persisted lane/delegation contracts need product hardening beyond the current Release 1 state reload path. |
| Phase 2 Policy, usage, audit | 70% | Config/policy/effective-policy, non-dispatch permission, provider health/usage fail-closed helpers, audit/debug write-intent tests, validated durable `.flowdesk` state materialization, durable workflow-state reload, malformed persisted-state fail-closed handling, and durable redacted bootstrap artifact materialization with batch-level prevalidation exist. | Real config loading, provider collectors, and debug bundle implementation remain partial. |
| Phase 3 OpenCode plugin command path | 84% | Plugin package, FDS-1 schema conversion probe, command-backed handler evaluators, Release 1 non-dispatch production registration metadata, production-ready command-backed readiness checks, default-on safe local non-dispatch command tools, explicit diagnostic-only opt-out, opt-in durable `.flowdesk` state materialization and reload wired through server options, fail-closed durable write/reload handling, tool-boundary injected local permissions, portable `/flowdesk-*` command file materialization, `flowdesk-install-release1` package bin wiring, typed-bound Release 1 bootstrap installer library with derived profile-root binding, installer-only durable pending/consumed confirmation ledger, one-shot confirmation consumption, symlink-hardened ledger path checks, command-file rollback on durable artifact or ledger failure, `flowdesk_chat_intake`, default-on text-only `chat.message` FlowDesk card steering, confirmation-before-run steering guard, pending-approval workflow state writes, typed-approval chat-run acceptance, and `/flowdesk-doctor` Release 1 readiness diagnostics exist. Tests pass. | Broader user-facing install/bootstrap documentation, packaging smoke evidence, and conformance artifact updates are incomplete. Real dispatch/provider/runtime/lane/fallback/hard-chat authority remains intentionally later-gated. |
| Phase 4 OpenCode conformance | 25% | OpenCode 1.14.40 PoC, local OpenCode 1.14.50 / `@opencode-ai/plugin@1.3.12` steering inspection, and FDS-1 schema-conversion evidence exist. | Command alias proof, blocking/no-reply proof, runtime echo, event telemetry, lane observability, and broader pinned-version conformance evidence remain incomplete. |
| Phase 5 Managed dispatch beta | 0% | Intentionally not started. | Requires Release 2 gates: trusted binding, runtime echo, telemetry, fresh usage/health, Guard approval, durable audit. |
| Phase 6 Managed chat and recovery | 50% | Core chat routing outcomes, default-on steering hook, visible text-only FlowDesk card suggestions with confirmation codes, in-memory duplicate suppression for repeated non-confirmation steering cards before command-backed state mutation, execution-like request hold-for-confirmation behavior, pending-approval workflow state, typed confirmation consumption, TTL/scoped/one-shot/cancellable pending confirmation gating in the local adapter, stronger approval classifier, boundary-injected local permissions, and schema-valid chat-routed retry/abort/resume/usage/export-debug diagnostics exist. | Intent detector split, broader abnormal-use recovery UX, durable suggestion preferences, and blocking conformance remain missing. |
| Phase 7 Operational intelligence | 0% | Schemas/concepts only. | Advisory evaluation, proposal fan-out, score ledgers, and reference packs are later gates. |
| Phase 8 Federated score registry | 0% | Documentation only. | Explicit opt-in registry design and implementation are later gates. |

## Overall Assessment

Release 1 foundations are substantially implemented, with default safe local command-backed chat usable without opt-in and Release 1 minimum tools promoted to production-eligible non-dispatch command-backed registration. Product-ready Release 1 remains gated by user-facing packaging/docs, smoke evidence, and OpenCode conformance artifacts, while real dispatch/provider/runtime/lane/fallback/hard-chat authority remains later-release scope.

The full multi-release roadmap is roughly one quarter complete because Releases 2-4 are intentionally unstarted.

## Active Critical Plan Updates

1. Release 1 must not implement broad OMO-style invisible prefix injection.
2. Chat routing must use conservative, transparent intent handling: leave general chat alone, suggest visibly, route only explicit/high-confidence FlowDesk requests, and block later-gate unsafe FlowDesk routes.
3. Execution-like natural language must stop at confirmation or plan readiness before any guarded dry-run or fake-runtime state change.
4. User-facing copy should avoid internal terms such as `manage`, `non-dispatch`, `adapter`, `pre-spike`, and `fake-runtime` unless a diagnostic/debug surface explicitly needs them.
5. Durable local adapter state must fail closed or surface a blocking error when `.flowdesk` writes fail; command success must not mask failed durable materialization or leave mutated in-memory state ahead of durable state.
6. Pending chat-run confirmations must require exact scoped binding for captured session/source fields and expose a user-completable confirmation path in visible chat steering.
7. Critical review on 2026-05-19 found and the follow-up patch resolved two Release 1 safety blockers: bootstrap durable artifact materialization now validates the full batch before any write, and duplicate chat steering suppression now runs before command-backed state mutation for suppressed non-confirmation cards.
8. Critical review on 2026-05-19 found and the follow-up patch addressed bootstrap installer blockers: installer confirmation now binds target profile, profile root ref, install plan, rollback plan, actor, expiry, and exact typed phrase; command files are rolled back when durable bootstrap artifact writes fail.
9. Critical review on 2026-05-19 found and follow-up patches partially addressed the bootstrap installer profile-binding blocker: `profileRootRef` is now derived from the actual selected `profileRootDir`, the exact typed phrase binds target profile, profile-root ref, confirmation ref, and install plan, direct replay to another profile root is rejected before writes, and successful confirmation refs are consumed once per installer process.
10. The Release 1 bootstrap installer now persists installer confirmations in a lightweight durable ledger under `.flowdesk/bootstrap/confirmations/<confirmationRef>.json`, claims `pending` before bootstrap artifact writes, promotes successful installs to `consumed`, rejects pending/consumed or binding-mismatched ledgers before writes, stores only a typed phrase hash, and fails closed with command rollback if ledger persistence fails. Remaining installer work is CLI/profile wiring and user-facing bootstrap flow integration.
11. Critical review on 2026-05-19 found and follow-up patch resolved durable ledger hardening blockers: installer confirmation now creates a durable `pending` claim before bootstrap artifact writes so incomplete attempts block replay after restart, promotes the ledger to `consumed` only after durable bootstrap artifacts succeed, rejects matching `pending` and `consumed` ledgers before writes, and rejects symlinked or root-escaping confirmation ledger directories.
12. The Release 1 installer now has an explicit `flowdesk-install-release1` CLI/package bin that previews the exact typed approval phrase without writing files, installs only after exact approval, writes portable command files and redacted bootstrap artifacts through the hardened installer library, and reports safe next actions while keeping production registration and provider/runtime dispatch disabled.
13. The OpenCode server plugin now defaults to safe local command-backed tools and visible `chat.message` steering without production registration, provider calls, runtime execution, real dispatch, fallback authority, lane launch, or hard chat cancellation/no-reply authority. Explicit `localNonDispatchAdapter: false` plus `naturalLanguageRouting: false` preserves diagnostic-only mode, and `fds1SchemaConversionProbe: true` remains isolated unless local/chat modes are explicitly requested.
14. Release 1 production registration has been promoted only to non-dispatch command-backed registration: schema registry and command manifest minimum tool metadata are production-eligible, the plugin scaffold reports `release1-non-dispatch-command-backed`, readiness checks pass with zero blocked checks, pre-spike sandbox probe registries remain empty/non-authorizing, and tests verify real OpenCode dispatch, provider calls, runtime execution, actual lane launch, fallback authority, and hard chat cancellation/no-reply authority stay disabled.
