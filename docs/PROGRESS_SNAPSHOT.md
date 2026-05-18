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

## Snapshot: 2026-05-18

This snapshot tracks implementation against the full roadmap, not only passing tests. Percentages are approximate readiness estimates for each phase’s exit criteria.

| Area | Progress | Evidence | Remaining gap |
|---|---:|---|---|
| Phase 0 Bootstrap workspace | 100% | Workspace, packages, build/test scripts, docs, and no-OMO/no-production-dispatch scaffolding exist. | None for scaffold. |
| Phase 1 Core contracts | 85% | Release 1 contracts, validators, schema artifacts, fixtures, Guard/fake-runtime/status/retry/audit/state tests exist. | Persisted lane/delegation contracts need product hardening and full durable-state integration. |
| Phase 2 Policy, usage, audit | 62% | Config/policy/effective-policy, non-dispatch permission, provider health/usage fail-closed helpers, audit/debug write-intent tests, and validated durable `.flowdesk` state materialization exist. | Real config loading, wiring durable state into the plugin adapter, provider collectors, and debug bundle implementation remain partial. |
| Phase 3 OpenCode plugin command path | 58% | Plugin package, FDS-1 schema conversion probe, command-backed handler evaluators, local non-dispatch adapter, tool-boundary injected local permissions, portable `/flowdesk-*` command file materialization, `flowdesk_chat_intake`, opt-in text-only `chat.message` FlowDesk card steering, confirmation-before-run steering guard, pending-approval workflow state writes, and typed-approval chat-run acceptance exist. Tests pass. | Production registration remains blocked, default server is still inert doctor-only, durable state is not yet wired into the plugin adapter, full user-ready install is incomplete, and production adapter promotion remains incomplete. |
| Phase 4 OpenCode conformance | 25% | OpenCode 1.14.40 PoC, local OpenCode 1.14.50 / `@opencode-ai/plugin@1.3.12` steering inspection, and FDS-1 schema-conversion evidence exist. | Command alias proof, blocking/no-reply proof, runtime echo, event telemetry, lane observability, and broader pinned-version conformance evidence remain incomplete. |
| Phase 5 Managed dispatch beta | 0% | Intentionally not started. | Requires Release 2 gates: trusted binding, runtime echo, telemetry, fresh usage/health, Guard approval, durable audit. |
| Phase 6 Managed chat and recovery | 42% | Core chat routing outcomes, opt-in steering hook, visible text-only FlowDesk card suggestions, execution-like request hold-for-confirmation behavior, pending-approval workflow state, typed confirmation consumption, TTL/scoped/one-shot/cancellable pending confirmation gating in the local adapter, stronger approval classifier, boundary-injected local permissions, and schema-valid chat-routed retry/abort/resume/usage/export-debug diagnostics exist. | Intent detector split, broader abnormal-use recovery UX, suggestion rate limiting/preferences, and blocking conformance remain missing. |
| Phase 7 Operational intelligence | 0% | Schemas/concepts only. | Advisory evaluation, proposal fan-out, score ledgers, and reference packs are later gates. |
| Phase 8 Federated score registry | 0% | Documentation only. | Explicit opt-in registry design and implementation are later gates. |

## Overall Assessment

Release 1 foundations are roughly halfway implemented, but product-ready Release 1 remains below half because production registration, durable state, installer/user commands, confirmation UX, and conformance gates are still open.

The full multi-release roadmap is roughly one quarter complete because Releases 2-4 are intentionally unstarted.

## Active Critical Plan Updates

1. Release 1 must not implement broad OMO-style invisible prefix injection.
2. Chat routing must use conservative, transparent intent handling: leave general chat alone, suggest visibly, route only explicit/high-confidence FlowDesk requests, and block later-gate unsafe FlowDesk routes.
3. Execution-like natural language must stop at confirmation or plan readiness before any guarded dry-run or fake-runtime state change.
4. User-facing copy should avoid internal terms such as `manage`, `non-dispatch`, `adapter`, `pre-spike`, and `fake-runtime` unless a diagnostic/debug surface explicitly needs them.
