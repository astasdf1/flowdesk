# FlowDesk Progress Snapshot

## Purpose and Update Rule

This is the compact canonical dashboard for FlowDesk roadmap status. It is not a substitute for tests, conformance evidence, durable session evidence, or release approval.

Update this file whenever code, tests, docs, packaging, installer behavior, conformance evidence, release gates, blockers, or user-facing readiness changes. If a work session changes only historical detail, append or correct the relevant archive entry rather than expanding this dashboard. Historical archive files must not be silently rewritten; if a claim is superseded, add a dated correction note.

If no progress fields changed during a non-trivial work session, the final response should state that this snapshot was checked and did not need an update.

## Current Canonical State (2026-06-05)

FlowDesk is a conservative OpenCode plugin with a default Release 1 path built around command-backed, non-dispatch chat routing, redacted durable evidence, status/usage diagnostics, passive TUI display, and guarded recovery surfaces. Explicit dev/beta provider-lane, workflow-dispatch, auto-continue, and controlled-write paths exist only behind opt-in flags and per-call acknowledgements.

Recent visible 2026-06-05 state:

- TUI sidebar task labels: compact task-summary generation now targets at most 5 useful words, clamps generated/sidebar display labels to 25 characters, avoids `dispatch_authority_enabled` false-positive suppression, and still suppresses labels containing forbidden raw markers. Focused build/test verification is pending for this slice.
- Wake prompt model routing: completion wake consumer now resolves the wake prompt model in priority order: row-specific persisted model from evidence → config fallback. The wake-ready cache producer persists `wakeProviderQualifiedModelId` from the launch-time `provider_qualified_model_id` in agent_task_context evidence. Invalid row-specific models fall back to config model without crashing. All 170 opencode-plugin functional tests pass.
- Managed dispatch beta terminal evidence: a standalone plugin Terminal Evidence Writer module now classifies terminal SDK dispatch outcomes and writes write-once atomic terminal lifecycle evidence under `.flowdesk/sessions/<workflow>/evidence/terminal-lifecycle/`; focused build/test verification is pending for this slice.
- Provider usage sidebar priority: compact TUI usage display now prioritizes low short-window buckets below 20% and low long-window buckets below 5% before falling back to period-normalized representative-bucket selection.
- Result excerpts/status display: `flowdesk_workflow_synthesis_preview` and `flowdesk_status_live` now surface bounded, line-break-preserving task-result excerpts from durable `task_result.result_text`, with forbidden raw-provider/auth/dispatch markers omitted.
- Main-agent coordinator polling optimization: project/global/bootstrap coordinator instructions no longer require automatic post-launch status polling. `task_launched` is only launch acknowledgement; status checks are demand-driven for explicit progress/status intents or wake evidence.
- Independent-lane continuation: project/global/bootstrap coordinator instructions now say that when multiple lanes are in flight, completed lanes that are independent of still-running lanes can be processed immediately; aggregate decisions/synthesis/approval/verification still wait for all required dependent lanes to terminalize or be explicitly handled.
- TUI readability: compact sidebar formatting now inserts one blank line between provider usage/status and auto-next/subtask activity, improving visual separation. The running OpenCode/TUI process must restart to pick up rebuilt plugin/TUI changes.
- Completion wake minimalism: main/parent session wake prompts now include only the FlowDesk wake tag, workflow id, and `/flowdesk-status` hint; task/sidebar summaries and notification labels remain out of parent chat wake text while cache/status displays retain their own data.
- Test execution ergonomics: default test entrypoints now route to functional checks while `test:full`, `test:slow`, and `test:integration` preserve broader coverage.
- Phase 1/2 closure: fresh Phase 1 core and Phase 2 policy/usage/audit focused verification passed on 2026-06-05; closure evidence is recorded in `docs/conformance/2026-06-05-phase1-phase2-closure.md`.
- Phase 3/4 closure: fresh plugin build, functional/integration tests, OpenCode version observation, plugin/doctor smoke, package dry-runs, and dependency metadata checks passed on 2026-06-05; closure evidence is recorded in `docs/conformance/2026-06-05-phase3-phase4-closure.md`.
- Release/package verification delegation: `flowdesk-release-package-verifier` now exists as a narrow no-edit package verification profile with explicit allowlist coverage for pack dry-runs, version/dependency checks, and git whitespace/status checks.
- Subtask sidebar retention: the sidebar activity cache now preserves up to 100 rows globally while protecting up to 20 rows per parent session when possible; the visible TUI Subtasks cap remains 5 rows.
- Opaque id validation: `workflow_id` and other schema-safe opaque ids no longer reject ordinary words such as `prompt`, `transcript`, or `runtime`; raw-payload marker scanning remains on actual payload/text/summary/auth/path-bearing fields.
- Bootstrap dev/beta tool visibility: installer-generated FlowDesk plugin options now include the non-quarantined exact-model provider acquisition live-test and runtime reviewer execution blocks so fresh installs expose the current explicit opt-in tool surface after OpenCode restart. Provider acquisition allowlists now include both OpenCode runtime `google/gemini-*` ids and FlowDesk evidence-facing `gemini/gemini-*` aliases.
- Exact Gemini acquisition evidence: after restart, `flowdesk_exact_model_provider_acquisition_live_test` recorded successful provider-acquisition evidence for `gemini/gemini-3-flash-preview`, `gemini/gemini-2.5-flash-lite`, `gemini/gemini-2.5-pro`, and `gemini/gemini-3.1-pro-preview`; `gemini/gemini-3-pro-preview` blocked at metadata preflight with `opencode_provider_model_missing`.
- Model-pool routing candidates: provider acquisition allowlists now include separate OpenAI fast/mini/codex-spark candidates and Claude Opus/Sonnet/Haiku family candidates, with both runtime-facing `anthropic/claude-*` and evidence-facing `claude/claude-*` ids for Claude.
- Model catalog research completed: 4-lane research workflow (`workflow-model-catalog-research-20260605`) finished with all lanes terminal. Official pricing verified directly from OpenAI, Anthropic, and Google Cloud Vertex AI pricing pages. Community/benchmark signals collected from Artificial Analysis, Aider polyglot leaderboard, and LM Arena. Gemini official Vertex AI pricing confirmed: Gemini 3.1 Pro Preview $2/$12, Gemini 3.5 Flash $1.50/$9, Gemini 3 Flash Preview $0.50/$3, Gemini 3.1 Flash-Lite $0.25/$1.50, Gemini 2.5 Pro $1.25/$10, Gemini 2.5 Flash $0.30/$2.50, Gemini 2.5 Flash Lite $0.10/$0.40 (all per 1M tokens, input/output, standard ≤200K context).
- Exact model provider acquisition completed for OpenAI fast/spark and Claude family after restart: `openai/gpt-5.5-fast`, `openai/gpt-5.4-fast`, `openai/gpt-5.4-mini-fast`, `openai/gpt-5.3-codex-spark` all `availability_acquired`. `claude/claude-opus-4-8`, `claude/claude-opus-4-7`, `claude/claude-opus-4-6`, `claude/claude-sonnet-4-6`, `claude/claude-sonnet-4-5`, `claude/claude-haiku-4-5` all `availability_acquired`. Combined with prior Gemini results, FlowDesk now has exact acquisition evidence for 14 candidate models across all three providers.

Current package version wording: workspace package manifests and dry-run package artifacts are `@flowdesk/core@0.2.0` and `@flowdesk/opencode-plugin@0.2.0`. Historical archive evidence still records earlier `0.1.22` publication state and should be treated as historical.

## Phase Readiness

| Phase | Readiness | Canonical interpretation |
|---|---:|---|
| Phase 0 Bootstrap workspace | 100% | Workspace, package scaffold, Release 1 bootstrap/installer foundations, and no-OMO/no-default-dispatch guardrails are complete for the scaffold. |
| Phase 1 Core contracts | 100% | Core contracts, validators, evidence classes, planning artifacts, lane/result/verdict/retry/heartbeat/fallback/write schemas, and reload paths are complete for the current plugin-verifiable scope. Later-gate live binding/productization is tracked outside Phase 1. |
| Phase 2 Policy, usage, audit | 100% | Policy/config loading, provider usage/health diagnostics, durable audit/debug/export evidence, production-preparation diagnostics, and fail-closed command-backed policy handling are complete for the current plugin-verifiable scope. Richer health/debug/release-promotion work is later-gate enhancement. |
| Phase 3 OpenCode plugin command path | 100% | Plugin command-backed Release 1 path, chat steering, bootstrap materialization, live status/usage, TUI/sidebar, provider-free previews, split test commands, plugin registration smoke, and package dry-runs are complete for the current non-dispatch scope. Later-gate execution authority remains gated. |
| Phase 4 OpenCode Plugin/SDK Compatibility | 100% | Compatibility scope is complete for plugin/SDK-observable behavior: OpenCode 1.x version observation, plugin load, tool schema registration, command-backed behavior, SDK adapter shapes, session/message/lifecycle observation, fail-closed modes, redaction, durable reload, dependency metadata, and permission-profile compatibility. Platform-internal facts remain diagnostic only. |
| Phase 5 Managed dispatch beta | 78% | Managed-dispatch beta contracts, guarded route wiring, durable pre-call/idempotency/provenance checks, default authorization scaffolding, and live beta evidence exist. Production/default authority is still gated behind explicit evidence/approval. |
| Phase 6 Managed chat and recovery | 65% | Conservative chat routing, visible suggestions, confirmation gates, status/retry/resume/abort diagnostics, heartbeat/stall projection, advisory wakes, and SDK-scoped controls exist. Hook-level hard chat/noReply/cancel remains unclaimed unless a supported boundary is proven. |
| Phase 7 Operational intelligence | 14% | Advisory-only contracts, exact-model cache planning/acquisition/fan-out scaffolding, provider-aware routing, connector planning, and firewall boundaries exist. Productized intelligence/reviewer orchestration remains later-gate. |
| Phase 8 Federated score registry | 1% | Documentation and disabled/non-authorizing registry state contracts exist only. Implementation, privacy/security review, and remote-write connector support are later gates. |

## Release Gate Evidence Summary

- Release 1: substantially implemented as a command-backed, non-dispatch OpenCode plugin with bootstrap/doctor/status/usage/debug/recovery flows, provider-free local previews, redacted evidence reload, and passive TUI status/usage/subtask surfaces.
- Managed dispatch beta / later gates: explicit opt-in SDK-backed routes and evidence records exist, including managed-dispatch beta, agent-task lanes, workflow dispatch, auto-continue execute, and controlled write. These do **not** promote default Release 1 dispatch authority.
- Provider usage/health: Claude/OpenAI/Gemini usage collection, durable usage snapshots, TUI display, and period-normalized model-selection support exist. Provider Health Snapshot diagnostics remain separate from Usage Availability Snapshot display.
- Reviewer/model gates: exact-model availability cache, provider acquisition, reviewer fan-out planning, typed verdict capture/linkage, and multi-model reviewer binding support exist as later-gate/dev-beta evidence surfaces, not default authority.
- Platform evidence demotion: OpenCode platform-internal runtime truth, telemetry authority, lane conformance, and account-scope usage authority are non-gating diagnostics when observable, not plugin-satisfiable completion criteria.

## Active Blockers and Caveats

- Default Release 1 remains non-dispatch. Real managed dispatch, provider/runtime lane launch, and provider-backed continuation require explicit later/dev-beta gates and approvals.
- Managed provider/model fallback or reselection remains gated. Quick fallback/regate tooling prepares a fresh full re-gate plan; it does not automatically switch providers.
- Controlled write is explicit dev/beta only, bounded to one approved local workspace file replacement with hash/path/redaction checks and durable ledger evidence.
- Hard chat cancellation and hook-level noReply/cancel/stop authority remain unclaimed unless a scoped supported SDK/OpenCode boundary is proven.
- Historical archive content is evidence-preserving and may include superseded interpretations. Use this dashboard plus newer ADRs/specs for canonical state.
- Running OpenCode/TUI processes often require restart after plugin/profile/config changes before live behavior reflects rebuilt code.

## Current Verification Baseline

Latest archived 2026-06-05 verification includes:

- `npm run build --workspace @flowdesk/opencode-plugin`
- `node --test packages/opencode-plugin/dist/workflow-synthesis-tool.test.js packages/opencode-plugin/dist/status-live-tool.test.js` (21/21)
- `node --test packages/opencode-plugin/dist/bootstrap-installer.test.js` (10/10)
- `node --test packages/opencode-plugin/dist/bootstrap-installer.test.js packages/opencode-plugin/dist/project-agent-profiles.test.js` (12/12)
- `node --test packages/opencode-plugin/dist/tui-subtask-activity.test.js packages/opencode-plugin/dist/tui-usage-snapshot.test.js` (32/32)
- Phase 1/2 closure verification: `npm run build --workspace @flowdesk/core`; `node scripts/run-tests.mjs --mode functional --package core` (472/472); `npm run build --workspace @flowdesk/opencode-plugin`; provider-usage/command-handler tests (23/23); focused server policy/usage/debug tests (13/13); `git diff --check`.
- Phase 3/4 closure verification: `npm run build --workspace @flowdesk/opencode-plugin`; `node scripts/run-tests.mjs --mode functional --package opencode-plugin` (155/155); `node scripts/run-tests.mjs --mode integration --package opencode-plugin` (178/178); `opencode --version` (`1.15.13`); `npm ls @opencode-ai/plugin @opentui/core @flowdesk/core --workspace @flowdesk/opencode-plugin`; dry-run packs for both packages at `0.2.0`; `git diff --check`.
- Dedicated release/package verifier evidence: after OpenCode restart, `workflow-release-package-verifier-packdiff-after-restart-20260605` completed with `git diff --check` PASS, `opencode --version` `1.15.13`, package dry-runs PASS for both `0.2.0` packages, and dependency inspection showing `@opencode-ai/plugin@1.15.6` / `@opentui/core@0.2.16`. A too-narrow exact `npm ls` allowlist was patched afterward and verified with plugin build, profile/materialization tests (12/12), and `git diff --check`.
- Subtask sidebar retention verification: `node --test packages/opencode-plugin/dist/completion-ui-cache.test.js packages/opencode-plugin/dist/tui-subtask-activity.test.js` (37/37) plus `git diff --check` passed after the 100-global/20-per-session cache policy change.
- Opaque id validation verification: `npm run test --workspace @flowdesk/core` (472/472) plus `git diff --check` passed after relaxing broad raw-payload marker scanning for schema-safe opaque ids.
- Completion wake minimalism verification: `npm run build --workspace @flowdesk/opencode-plugin` and `node --test packages/opencode-plugin/dist/completion-wake-main-session.test.js` (9/9) passed; `git diff --check` was attempted but blocked by the active bash permission policy.
- Bootstrap tool-option materialization verification: `npm run build --workspace @flowdesk/opencode-plugin`, `node --test packages/opencode-plugin/dist/bootstrap-installer.test.js` (10/10), and `git diff --check` passed after adding exact-model provider acquisition, runtime reviewer execution, and Gemini provider-acquisition alias allowlist installer options.
- Model candidate allowlist verification: global OpenCode config JSON validation, `npm run build --workspace @flowdesk/opencode-plugin`, `node --test packages/opencode-plugin/dist/bootstrap-installer.test.js` (10/10), and `git diff --check` passed after adding OpenAI fast/spark and Claude Opus/Sonnet/Haiku acquisition candidates.
- `git diff --check` after the result-excerpt slice; one later session noted git bash commands were denied by the active tool permission policy.

No broad test suite is required for this documentation-only cleanup slice.

## Release 1 Checklist

1. README, quickstart, user manual, and progress dashboard distinguish default command-backed non-dispatch behavior from explicit opt-in provider-calling/dev-beta helpers.
2. Fresh install smoke should confirm package-root plugin load, `/flowdesk-*` command-backed tool registration, chat-intake routing, and TUI config materialization without provider/runtime/lane authority by default.
3. Active profile smoke after restart should confirm plugin origin, `flowdesk_pre_spike_doctor`, provider usage, status reload, TUI plugin loading, and redacted debug/export behavior.
4. Debug export remains diagnostic-only with authority flags false and redaction-first section files/manifests.
5. Guarded auto-abort/retry/watchdog features, when enabled, must be documented as explicit opt-in diagnostics/recovery, not default Release 1 authority.
6. Release notes should continue to state that hard chat cancellation/noReply, automatic provider fallback, and production/default dispatch remain later-gated.

## Archive Index

Historical append-only evidence was moved to `docs/progress-archive/` on 2026-06-05. Archives preserve historical claims and should not be silently rewritten.

| Archive | Contents |
|---|---|
| `docs/progress-archive/2026-05-19-to-2026-05-27.md` | Early Release 1/2/3 contract, publication, bootstrap, reviewer, usage, heartbeat, and dev/beta lane history through 2026-05-27, plus undated legacy entries assigned to the earliest range. |
| `docs/progress-archive/2026-05-28-to-2026-05-31.md` | Agent-task reliability, TUI/sidebar, provider-free synthesis, managed-dispatch beta, reviewer verdict, packaging, Release 1 publication, and platform-boundary history. |
| `docs/progress-archive/2026-06-01-to-2026-06-03.md` | Dev/beta lane capability, watchdog/event capture hardening, TUI session scoping, usage/model-selection, release/package, and npm/local-profile transition history. |
| `docs/progress-archive/2026-06-04-to-2026-06-05.md` | Platform evidence demotion, permission/profile reliability, async capture fixes, live smoke evidence, 0.1.22 publication, result excerpts/status display, main-agent polling optimization, split tests, and TUI readability history. |
