# FlowDesk Implementation Roadmap

## Purpose

This roadmap turns `FLOWDESK_OPENCODE_PLUGIN_IMPLEMENTATION_SPEC.md` into an implementation sequence. It is intentionally conservative: Release 1 proves the safety harness through chat-routed command-backed workflows, guarded dry-run, fake runtime, provider health diagnostics, audit, abnormal-use guidance, and conformance before enabling real OpenCode dispatch, automatic provider/model fallback, or hard chat cancellation authority.

## Release Tracks

### Release 1: General-Use MVP

Release 1 is for ordinary OpenCode users. Natural-language chat is the primary UX, routed into guarded command-backed FlowDesk workflows without relying on unverified OpenCode runtime dispatch, automatic provider/model fallback, or hard chat cancellation authority. The final product target also minimizes main-agent context by delegating workflow authoring, refinement, and review to bounded subagent lanes that return compact typed summaries.

Critical review update, 2026-05-18: Release 1 must not implement broad OMO-style invisible prefix injection. `chat.message` steering is not a proven hard-interception boundary, so FlowDesk must not silently rewrite most user input or imply that the normal assistant/provider turn has been fully handled. Chat intake uses an internal intent detector with conservative outcomes: `general_chat` leaves the request alone, `flowdesk_suggest` presents a transparent FlowDesk card or guidance, `flowdesk_manage` is reserved for explicit or high-confidence FlowDesk requests, and `unsafe_later_gate` blocks only the FlowDesk route while showing safe fallback actions. User-facing UX should talk about “FlowDesk로 정리”, “계획 보기”, “실행 전 확인”, and “진단” rather than internal `manage`, `non-dispatch`, `adapter`, or `fake-runtime` terms. Execution-like natural language must stop at confirmation or plan readiness; no chat-routed path may immediately perform `/flowdesk-run` or fake-runtime state changes without explicit confirmation.

Included:

1. Project workspace and packages.
2. Installer bootstrap, rollback/report contracts, and `/flowdesk-doctor`.
3. Chat-routed command-backed plan/run/status/recovery/diagnostic flows.
4. Delegated workflow authoring records and lane status summaries.
5. Release 1 minimum command surface: `/flowdesk-doctor`, `/flowdesk-plan`, `/flowdesk-run`, `/flowdesk-status`, `/flowdesk-resume`, `/flowdesk-retry`, `/flowdesk-abort`, `/flowdesk-usage`, and `/flowdesk-export-debug`.
6. Guarded dry-run.
7. Fake-runtime dispatch.
8. Redaction-first audit.
9. Conformance report bounded to OpenCode 1.14.40 evidence until newer evidence exists.
10. Fail-closed usage/config/policy behavior.
11. Provider Health Snapshot diagnostics for auth, provider, API, model, timeout, OpenCode provider-load, and ambiguous telemetry failures.
12. Hook harness `enforce`, `observe`, and `off` modes.
13. User manual abnormal-use examples and safe alternatives.
14. Intent detection and transparent workflow-suggestion UX that distinguishes no intervention, suggestion, explicit management, and later-gate unsafe requests without claiming hard chat takeover.

Excluded:

1. Real OpenCode runtime dispatch.
2. Hard `noReply`/`cancel`/`stop` authority.
3. Automatic provider/model fallback or reselection.
4. Evaluation-based ranking or workflow optimization as approval. Release 1 may scaffold taxonomy, proposal, provider health, fallback decision, score, and event schemas only.
5. Patent, legal, or medical-device specialist workflows.
6. Optional MCP connector execution.
7. Opt-in federated score registry, central telemetry, or community score sharing.
8. Broad hidden prompt/prefix injection that tries to route most ordinary chat through FlowDesk without explicit user visibility.

### Progress Snapshot

The current progress estimate lives in `PROGRESS_SNAPSHOT.md`. Update that file whenever implementation status, release gates, blockers, user-facing readiness, or critical review findings change. The roadmap defines the target sequence; the progress snapshot records the current position against it.

### Release 2: Managed Dispatch Beta

Release 2 enables managed real dispatch for low-risk workflows after conformance proves model/agent binding, runtime echo, harness event telemetry, fresh usage, fresh provider health, sanitized auth capture, external auth/provider policy, configured verification, Guard approval, and durable pre-dispatch audit. Managed fallback or reselection is still optional and requires a new attempt id, runtime compatibility, policy eligibility, trusted binding/echo, sufficient telemetry, fresh usage, fresh provider health, durable pre-dispatch audit, and explicit Guard approval for the new binding.

### Release 2.5: Top-Tier Multi-Perspective Review Lane Entry Gate

Release 2.5 is a planned gate for internal OpenCode subtask/lane orchestration and dedicated reviewer bindings. It must not change Release 1 non-dispatch behavior or Release 2 opt-in dispatch gating. The gate exists to prove that FlowDesk can launch bounded internal lanes through OpenCode `subtask: true` command bindings or injected SDK/client calls, with explicit `agent` and concrete provider-qualified `model` binding, without using nested `opencode run` as production orchestration.

Release 2.5 must support fan-out to every registered highest-tier available reviewer/model lane for high-risk or critical review when all gates pass. The active FlowDesk registry and Policy Pack decide the highest-tier set; Claude Opus, GPT frontier, and Gemini Pro are abstract family labels only and may seed discovery, but they are never valid lane bindings by themselves. Reviewer lane bindings must use exact currently available provider-qualified model ids from a redacted model-availability cache. That cache is refreshed at most once per local day for the same active profile, registry, Policy Pack, OpenCode version, and account/auth boundary, and is refreshed early only when any of those inputs change. Missing unregistered providers do not block review by themselves. If only one highest-tier model is registered and available, FlowDesk still runs multi-perspective review by assigning multiple reviewer agents or perspective bindings to that same concrete model. These lanes extend the canonical `reviewer` profile rather than replacing it. They return typed critical review outputs only, and they cannot approve dispatch, replace Guard, replace verification, or self-approve.

### Release 3: Operational Intelligence

Release 3 adds advisory evaluation, workflow proposal optimization, multi-model proposal fan-out behind surplus usage gates, dedicated top-tier multi-perspective review lane use where Release 2.5 gates pass, GitHub-backed score ledger support, richer operational recovery, FlowDesk-owned todo continuation supervision where the managed-chat/recovery gates prove safe continuation, and source-grounded reference-pack workflows without weakening Guard or turning specialist output into professional signoff.

### Release 4: Opt-In Federated Intelligence

Release 4 may add opt-in central or self-hosted federated score registry support. It is for sanitized aggregate community learning only, defaults off, and remains advisory-only.

## Phase 0: Bootstrap Workspace

Goal: create a clean new project that is not a DEX Conductor checkout with renamed files.

Tasks:

1. Create `flowdesk/` workspace.
2. Add root `package.json`, `tsconfig.base.json`, formatter/lint/test scripts.
3. Add docs copied from current planning work.
4. Add ADR 0001.
5. Add package folders with minimal buildable TypeScript packages.

Exit criteria:

1. `npm run typecheck` works from the root.
2. `npm test` works, even if only scaffold tests exist.
3. No package depends on OMO.
4. No production package shells out to `opencode run`.

## Phase 1: Core Contracts

Goal: establish typed contracts before runtime integration.

Tasks:

1. Implement workflow plan, workflow step, attempt, status, and checkpoint types.
2. Implement Guard request/response types.
3. Implement Usage Availability Snapshot, Provider Health Snapshot, and runtime capability artifact types.
4. Implement exact Release 1 TypeScript interfaces and exported JSON Schema artifacts from `docs/schemas/RELEASE_1_TOOL_CONTRACTS.md` before production tool registration work starts.
5. Implement `GuardApprovedDispatch` and runtime echo types.
6. Implement audit event types.
7. Implement normative workflow taxonomy types with separate axes for category, difficulty drivers, coupling, algorithmic hardness, architecture hardness, migration/state hardness, domain uncertainty, verification hardness, operational risk, and policy/professional boundary.
8. Implement proposal and score event schemas without using scores as authority.
9. Implement canonical agent profiles with `reviewer` as the only canonical review id, using the Agent Profile Authoring Standard in the implementation spec. Add planned binding metadata for every registered highest-tier reviewer/model lane and reviewer perspective as `reviewer` extensions, not replacement canonical ids.
10. Add audited `critic -> reviewer` migration rule for legacy imports.
11. Define safety terms for Guard, Hook Containment, Audit, Echo, and Conformance.
12. Define `.flowdesk/workflows` as authoritative state and `.flowdesk/sessions` as redacted session/audit/artifact organization.
13. Define the Delegation Runtime Contract with policy-controlled lane limits, main-agent minimal routing, timeouts, verification, lane status summaries, invocation failure classes, reference-kind separation, bounded retry disposition, incomplete-result handling, and best-effort cancellation records.

Exit criteria:

1. Contract validators reject malformed ids, unqualified model ids, missing provider family, missing usage snapshot, missing provider health snapshot, and missing transaction boundary.
2. `critic`/`reviewer` mismatch fails doctor or validation unless an audited alias is configured.
3. Session records cannot replace workflow/checkpoint state and cannot store forbidden raw payloads.
4. Delegation records distinguish launch failure, missing tool, schema conversion failure, timeout, lost correlation, abnormal exit, telemetry unavailable, cancellation requested, cancellation observed, and hard cancellation proven without claiming unproven hard cancellation.
5. Agent profile validation rejects mandatory document-path traversal, OMO/OMC runtime or path dependencies, missing expertise boundaries, missing output contracts, missing verification obligations, and profiles that grant Guard or dispatch authority.
6. Release 1 tool contract tests cover every schema id and fixture prefix in `docs/schemas/RELEASE_1_TOOL_CONTRACTS.md`.
7. Persisted workflow/state schema tests cover `workflow-active`, `workflow-record`, `attempt-record`, `checkpoint-record`, `active-attempt-lock`, `lane-record`, `audit-record`, and `debug-export-manifest` fixture prefixes before any state writer is enabled.
8. Tests cover success and fail-closed cases, including malformed ids, unknown properties, forbidden raw payloads, raw paths, stale or corrupt locks, mismatched active workflow, event-only checkpoints, and session records attempting to replace authoritative workflow state.

## Phase 2: Policy, Usage, and Audit

Goal: make the safety boundary real before plugin execution exists.

Tasks:

1. Implement `.flowdesk/config.json` schema.
2. Implement Policy Pack loading and merge semantics.
3. Implement hard-ban and project extension handling.
4. Implement provider-native usage snapshot interface.
5. Implement Provider Health Snapshot interface and diagnostic collectors.
6. Implement initial fake and local usage and health collectors, plus OpenCode Go and z.ai diagnostic collectors that report unknown usage when no official machine-readable quota evidence exists.
7. Model OpenUsage-style source labeling for usage collectors: provider API truth, local observed history, response usage accounting, diagnostic probe, and inferred estimate must be distinct uncertainty sources.
8. Implement redaction-first audit writer.
9. Implement pre-dispatch audit event writer.
10. Implement artifact quarantine/promote/discard state.

Exit criteria:

1. Missing or malformed config fails closed.
2. Unknown/stale/refused/shared-limit usage fails closed.
3. Non-dispatchable provider health fails closed for any real provider/model selection.
4. Config/policy schema tests cover `project-config`, `policy-pack`, `effective-policy`, and `non-dispatch-permission` fixture prefixes from `docs/schemas/RELEASE_1_TOOL_CONTRACTS.md`.
5. Config/policy tests reject release-mode escalation, automatic fallback enablement, hard-cancel/no-reply enablement, provider console scraping, stale or mismatched config/policy hashes, unregistered extensions, retention overage without explicit user config, forbidden raw payloads, and raw paths.
6. Policy Pack loading and merge tests prove Policy Packs can constrain, hard-ban, shorten retention, require approval, and disable modes, but cannot grant reusable approval or authorize privileged execution by themselves.
7. Audit writer rejects forbidden nested payloads.
8. Real dispatch cannot start if pre-dispatch audit cannot be written.
9. `flowdesk_export_debug` emits only redacted bundles.

## Phase 3: OpenCode Plugin Command Path

Goal: provide the first usable General-Use MVP without real dispatch.

Precondition: before any production plugin tool is registered with OpenCode, FDS-1 runtime-closed schema compatibility must pass and production handlers plus the applicable release gates must be satisfied. Provider-facing `additionalProperties: false` emission remains a caveat, not a blocker by itself, when FlowDesk runtime validation rejects unknown properties before execution.

Pre-spike allowed work: package skeletons, TypeScript interfaces, exported JSON Schema artifacts, static command files, fixtures, and fake/test-harness stubs. Pre-spike forbidden work: production plugin tool registration, provider dispatch, actual OpenCode subtask/model/provider lane launch, or any claim that custom tool schemas are production-ready.

Tasks:

1. Implement `@flowdesk/opencode-plugin` package skeleton.
2. Define FDS-1 request schemas, response schemas, privilege classes, state preconditions, state outputs, redacted error shapes, and schema compatibility tests for every registered plugin tool before registration.
3. Generate fixtures for every Release 1 schema id and fixture prefix in `docs/schemas/RELEASE_1_TOOL_CONTRACTS.md`.
4. Implement plugin tools: `flowdesk_doctor`, `flowdesk_plan`, `flowdesk_run`, `flowdesk_status`, `flowdesk_resume`, `flowdesk_retry`, `flowdesk_abort`, `flowdesk_usage`, and `flowdesk_export_debug` first.
5. Generate portable command files: `/flowdesk-doctor`, `/flowdesk-plan`, `/flowdesk-run`, `/flowdesk-status`, `/flowdesk-resume`, `/flowdesk-retry`, `/flowdesk-abort`, `/flowdesk-usage`, `/flowdesk-export-debug`.
6. Add desired alias generation only behind conformance.
7. Implement command-driven guarded dry-run.
8. Implement fake-runtime dispatch.
9. Implement status and recovery state display, including lane summaries, Provider Health Snapshot summaries, and safe debug references.
10. Implement chat routing into command-backed flows where OpenCode 1.14.40 steering evidence applies. The routing pipeline must be split into redacted intake normalization, intent detection, safety gate, and route rendering. The detector is not an authority boundary and must support at least `general_chat`, `flowdesk_suggest`, `flowdesk_manage`, and `unsafe_later_gate` internal outcomes.
11. Implement delegated workflow authoring records, fake-runtime lane summaries, and command/status summaries for Release 1. Actual OpenCode subtask/model/provider lane launch is disabled until managed-dispatch gates pass and a later release explicitly promotes it. Do not implement lanes by spawning nested `opencode run` subprocesses; `opencode run` is limited to smoke tests, diagnostics, compatibility probes, and fake-runtime harnesses.
12. Implement hook harness `enforce`, `observe`, and `off` behavior.
13. Implement doctor failure categories: dispatch-blocking, chat-mode-disable, degraded-mode warning, and informational.
14. Implement provider/API/model failure classes in doctor, usage, status, retry planning, and debug export without adding a new Release 1 registered tool.

Exit criteria:

1. `/flowdesk-doctor` answers “Can FlowDesk safely run here?” in four sections: migration cleanup, OpenCode/plugin compatibility, provider/usage readiness, policy/project safety. Provider/usage readiness shows usage separately from provider health.
2. `/flowdesk-plan` creates a plan but cannot dispatch.
3. `/flowdesk-run` performs guarded dry-run or fake-runtime dispatch only.
4. `/flowdesk-status` shows workflow id, step, state, lane summaries, blocker, checkpoint, audit reference, and safe next actions.
5. `/flowdesk-resume`, `/flowdesk-retry`, `/flowdesk-abort`, `/flowdesk-usage`, and `/flowdesk-export-debug` cover Release 1 recovery, usage refresh, provider health diagnostics, and redacted diagnostics.
6. Plugin tool schema compatibility tests pass for every registered tool, including crash-free conversion before provider dispatch.
7. Release 1 uses chat as the normal UX while keeping commands available for setup, status, recovery, diagnostics, and fallback.
8. Hook harness off mode disables managed and privileged automation and leaves safe manual fallback only.
9. Lane failure classes are represented in workflow state and audit when possible: failed launch, missing tool, schema conversion failure, timeout, lost correlation, abnormal exit, invocation failure, incomplete result, reference-kind mismatch, retry limit reached, and unproven cancellation.
10. Taxonomy, proposal, and score event schemas may be emitted in fake-runtime or guarded dry-run paths, but ranking cannot approve work and real dispatch remains disabled.
11. `/flowdesk-doctor` blocks managed dispatch for Guard, audit, redaction, usage, provider health, policy, plugin schema, or dispatch-critical conformance failures, but may disable only chat-routed mode when the failure is chat-specific and command fallback remains safe.
12. Release 1 provider/API/model failures are diagnostic, status, degraded-mode, or fake-runtime outcomes only and never trigger real automatic provider/model switching.
13. Actual delegated lane launch is not a Release 1 exit criterion; Release 1 must show the degraded status/fallback state when lane launch or observability is unavailable.
14. Installer/bootstrap schema tests cover `bootstrap-install-plan`, `bootstrap-backup-manifest`, `profile-mutation-summary`, `omo-cleanup-summary`, `command-generation-summary`, `config-scaffold-summary`, `bootstrap-rollback-plan`, `bootstrap-rollback-result`, `bootstrap-report`, and `doctor-handoff` fixture prefixes before production installer mutation is enabled.
15. Installer failure tests prove backup-first ordering, selected-profile-only mutation, provider-auth preservation, typed-confirmation binding, rollback/partial-restore reporting, static command-template validation, doctor handoff, bootstrap authority closure after doctor pass, and redacted reports with no raw config/profile content.
16. Doctor/status/debug/audit/conformance artifact tests cover doctor report, doctor section result, status summary, debug export manifest, debug section summary, audit event, audit record, audit ref summary, usage snapshot, provider health snapshot, conformance runtime metadata, and conformance evidence record fixture prefixes.
17. Artifact tests prove redaction, unknown-property rejection, retention/deletion state, audit-event to audit-record lifecycle, debug-section omission/blocking, conformance evidence redaction, usage/provider-health separation, and non-authority for dispatch, fallback, hard cancellation, or Guard replacement.
18. Chat routing does not use broad invisible prefix injection. `general_chat` preserves the normal chat path, `flowdesk_suggest` produces transparent user-visible guidance or a FlowDesk card, `flowdesk_manage` requires explicit/high-confidence FlowDesk intent, and `unsafe_later_gate` never suggests `/flowdesk-run` or any later-gate authority.
19. Any natural-language execution request reaches a confirmation-required or plan-ready state before fake-runtime or guarded dry-run evaluation. Confirmation state must be one-shot, scoped, time-bound, and redacted.

## Phase 4: OpenCode Conformance

Goal: replace assumptions with evidence for a pinned OpenCode version.

Tasks:

1. Select OpenCode release or commit.
2. Record package loading behavior for npm and local/file plugins.
3. Verify `engines.opencode` enforcement for npm and independent doctor checks for local/file plugins.
4. Test command names and `/flowdesk:*` alias feasibility.
5. Test `chat.message` steering, blocking, and observe-only behavior.
6. Test command-level `agent`, `model`, and `subtask` routing.
7. Test real runtime model/agent binding feasibility.
8. Test runtime echo evidence source.
9. Test capability-discovered harness telemetry surfaces for lifecycle, progress, tool activity, permission/shell/command events, errors, cancellation, and timeout.
10. Test subagent lane launch, task reference capture, reference-kind separation, status correlation, lane timeout, abnormal exit detection, missing tool detection, schema conversion failure detection, invocation failure classification, incomplete-result classification, bounded retry behavior, and status or debug reference presentation.
11. Test custom plugin tool schema conversion for every registered tool because the OpenCode 1.14.40 PoC found a schema conversion crash before provider dispatch. This task is a Phase 3 precondition for production tool registration and remains in Phase 4 for full pinned-version evidence reporting.
12. Record `opencode run` behavior as a diagnostic/smoke-test surface only. Conformance must not count nested CLI subprocess fan-out as proof of delegated lane execution, parallel multi-model orchestration, top-tier multi-perspective review, trusted model/agent binding, lane observability, cancellation, or runtime echo.
13. Test Provider Health Snapshot modes and provider/API/model failure classes, including auth missing/expired, provider unavailable, rate limited, model unavailable, transport timeout, provider error, OpenCode provider-load failure, and telemetry ambiguous.
14. Test OpenCode Go and z.ai diagnostic evidence sources, including documented provider setup, auth presence, model-list or static-catalog evidence, base URL mode, quota/usage availability or lack of official API evidence, and error-code mapping without console scraping.
15. Test OpenUsage-style source labeling and reject browser cookie extraction, HAR capture, console scraping, undocumented quota endpoints, and local-history-only data as account-wide quota truth.
16. Record official evidence that plugin event hooks are observational, `chat.params` and `chat.headers` are pre-request, provider timeout/chunkTimeout and explicit provider/model selection exist, and no official plugin-level automatic cross-provider fallback evidence is present.
17. Test internal agent/model lane routing through OpenCode `subtask: true` command bindings or injected SDK/client calls with explicit `agent` and concrete provider-qualified `model` binding. Include arbitrary override requests constrained by the model binding registry, Guard evidence, runtime echo, telemetry persistence, and no silent fallback.
18. Test planned top-tier multi-perspective reviewer lanes for every registered highest-tier available reviewer/model binding. When only one highest-tier model is registered, test that multiple reviewer agents or perspective bindings can share that model without losing lane separation. Each lane must resolve through the canonical `reviewer` profile, return a typed critical review output, and fail closed on missing auth, stale usage, missing quota/reset evidence, missing runtime echo, missing telemetry, lower-tier substitution, or unavailable concrete model id.

Exit criteria:

1. `docs/OPENCODE_CONFORMANCE_PLAN.md` has a completed evidence table for the pinned version.
2. Conformance artifact records `blocking`, `steering`, `observe_only`, or `off` for chat intake.
3. Real dispatch remains disabled unless binding, echo, telemetry, fresh usage, fresh provider health, Guard approval, and durable pre-dispatch audit all pass.
4. Managed fallback/reselection remains disabled unless all future fallback gates pass with a new attempt id and explicit Guard approval.

Gate resolution order:

1. Finish Release 1 command-backed product handlers while production OpenCode registration stays disabled. Handlers may write only through existing non-dispatch permissions and must preserve guarded dry-run, fake-runtime, status, recovery, usage, and debug-export boundaries.
2. Complete provider-facing schema evidence for the plugin tool path. The current FDS-1 runtime-closed compatibility pass is sufficient for handler safety, but production registration still needs pinned evidence for OpenCode registry conversion, provider/model transform output, and any FlowDesk-side schema hardening required to preserve the runtime-closed boundary.
3. Promote production OpenCode registration only for non-dispatch command-backed handlers after doctor, schema, Guard, audit, policy, redaction, and disabled-mode checks pass. This gate must not enable real dispatch, actual lane launch, automatic fallback/reselection, or hard chat cancellation.
4. Add the telemetry and runtime-echo conformance harness before any real dispatch. The harness must correlate workflow id, attempt id, command/tool id, model/provider binding, tool schema hash, event refs, and audit refs without persisting raw prompts, transcripts, provider payloads, or runtime echo bodies.
5. Promote a single low-risk managed-dispatch beta step only after trusted binding, trusted runtime echo, sufficient telemetry, fresh usage, fresh Provider Health Snapshot, sanitized auth capture, external auth/provider policy, Guard approval, durable pre-dispatch audit, and configured verification all pass.
6. Prove hard managed chat/no-reply/cancellation separately. Until e2e evidence proves no duplicate assistant reply, pending-tool abort, lane cleanup, and audit transitions, abort remains best-effort and chat remains steering/command-backed.
7. Promote actual delegated lane launch only after the managed-dispatch gate also proves task ref capture, reference-kind separation, incomplete-result detection, timeout/correlation handling, redacted status/debug refs, and bounded retry behavior for the pinned OpenCode surface.
8. Promote dedicated top-tier multi-perspective reviewer lanes only after actual delegated lane launch also proves provider-qualified concrete model ids, fresh auth/usage/quota evidence, runtime echo, telemetry persistence, reviewer output schema validation, registered highest-tier binding selection, same-model multi-agent perspective assignment, and no silent lower-tier substitution.
9. Keep automatic provider/model fallback or reselection last. It requires all real-dispatch gates plus runtime compatibility, policy eligibility, a new attempt id, fresh usage, fresh provider health, durable audit for the new binding, and explicit Guard approval.

## Phase 5: Managed Dispatch Beta Gate

Goal: enable low-risk managed real dispatch safely.

Tasks:

1. Implement real `GuardApprovedDispatch` runtime path only after production non-dispatch registration and telemetry/echo conformance are already passing.
2. Require trusted model/agent binding evidence.
3. Require trusted runtime echo evidence.
4. Require capability-discovered telemetry surfaces with stable correlation ids.
5. Require fresh provider-native usage and fresh Provider Health Snapshot.
6. Require durable pre-dispatch audit.
7. Run configured verification.
8. Quarantine artifacts on missing evidence, failed verification, provider health failure, event ambiguity, missing echo, or mismatched binding.

Exit criteria:

1. One low-risk managed step can execute in OpenCode.
2. Event-only completion cannot mark success.
3. Event-derived checkpoints cannot resume without durable FlowDesk state and audit references.
4. Missing echo or required telemetry quarantines results.
5. Any managed fallback/reselection uses a new attempt id and requires fresh usage, fresh provider health, runtime compatibility, policy eligibility, trusted binding/echo, sufficient telemetry, durable pre-dispatch audit, and explicit Guard approval.

## Phase 6: Managed Chat and Recovery

Goal: improve the chat-routed user experience without relying on unsupported hard cancellation.

Tasks:

1. Enable `chat_intake_mode: blocking` only when conformance proves it; otherwise keep Release 1 steering limited to transparent command-backed routing.
2. Implement the internal intent detector outcomes `general_chat`, `flowdesk_suggest`, `flowdesk_manage`, and `unsafe_later_gate`, mapped onto schema-compatible user-facing route decisions.
3. Implement non-intrusive FlowDesk card or guidance copy for `flowdesk_suggest`, including why FlowDesk is suggesting a workflow, what it will do, what it will not do, and the fact that execution requires confirmation.
4. Implement `fast_chat`, `managed_plan`, `clarify`, and `blocked` outcomes without exposing internal routing labels as product language.
5. Implement deterministic approval classifier.
6. Implement typed confirmation with nonce/scope binding.
7. Implement pending-intent confirmation state with TTL, source summary/ref binding, one-shot consumption, cancellation/clear behavior, and non-dispatch adapter mode.
8. Implement natural-language retry/resume/abort/status affordances.
9. Design and implement a FlowDesk-owned todo continuation supervisor for workflow task records. It may detect incomplete FlowDesk task records after a turn and propose or perform continuation only through durable workflow/checkpoint state, explicit completion contracts, and the existing `/flowdesk-status`, `/flowdesk-resume`, `/flowdesk-retry`, and `/flowdesk-abort` recovery surfaces.
10. Gate automatic continuation behind conformance that proves a safe post-turn or pre-turn control surface. Until that proof exists, the supervisor may only show transparent visible guidance or command-backed safe next actions; it must not inject hidden system directives, rely on raw OpenCode/OMO todo state, or claim hard no-reply/cancel authority.
11. Require continuation attempts to preserve lane reference-kind separation, bounded retry budgets, idempotent attempt ids, redacted audit refs, user/Guard approval where scope or privilege changes, and fail-closed handling for no-output lanes, missing verdicts, aborted tool calls, stale checkpoints, or telemetry ambiguity.

Exit criteria:

1. Natural-language request creates a guarded plan without requiring `/flowdesk-plan`.
2. Ambiguous or high-risk requests clarify instead of executing.
3. Privileged dispatch requires Guard and approval.
4. `observe_only` or `off` mode directs users to command fallback; `steering` mode routes to a guarded command-backed flow.
5. FlowDesk suggestions are transparent and dismissible; repeated suggestions are rate-limited or preference-aware so ordinary OpenCode chat is not polluted.
6. Execution-like chat such as “run”, “execute”, “진행”, or “실행” cannot directly mutate workflow state to complete without explicit confirmation.
7. User-facing copy avoids internal implementation terms such as `pre-spike`, `adapter`, `non-dispatch`, `fake-runtime`, and `manage` unless a diagnostic/debug surface explicitly needs them.
8. Todo continuation can resume only FlowDesk-owned durable task records with valid checkpoints and required approvals; incomplete, no-output, aborted, or missing-verdict lanes are recorded as blocked/incomplete and cannot count as success, approval, QA, security review, or implementation completion.

## Phase 6A: Top-Tier Multi-Perspective Review Lane Gate

Goal: prove planned internal reviewer lane orchestration without weakening Release 1 non-dispatch behavior or Release 2 opt-in dispatch gating.

Tasks:

1. Implement the model binding registry rules for dedicated reviewer bindings under the canonical `reviewer` profile for every registered highest-tier reviewer/model lane. Seed discovery from abstract families such as Claude Opus, GPT frontier, or Gemini Pro when useful, but bind only exact provider-qualified model ids observed in the current environment.
2. Implement the arbitrary agent/model override request shape with explicit agent id, concrete provider-qualified model id, registry binding ref, Guard evidence refs, and no silent fallback.
3. Implement internal lane launch only through OpenCode `subtask: true` command bindings or the injected SDK/client path after conformance proves the chosen surface. Do not use `opencode run` for production orchestration.
4. Implement typed critical review output schemas for reviewer lanes, including findings, severity, evidence refs, uncertainty, required fixes, and verdict labels.
5. Require fresh auth, usage, quota/reset, Provider Health Snapshot, runtime compatibility, runtime echo, telemetry persistence, and output schema validation for each reviewer lane.
6. Add status, audit, and debug summaries that persist only redacted reviewer lane evidence.
7. Implement explicit `registered`, `available`, and `highest-tier` predicates in the binding registry and Policy Pack, including provider/model-family promotion criteria and lower-tier substitution rejection.
8. Implement reviewer perspective bindings such as policy/security, architecture, and verification/implementation, and prove they can share one concrete highest-tier model when only one such model is registered.
9. Implement reviewer fan-out caps for maximum concurrent lanes, cost budget, quota reserve, timeout, and retry budget. If the caps cannot safely include every registered highest-tier binding and required perspective, block the run or ask for an explicit policy-compatible configuration change.
10. Implement a redacted daily model-availability cache keyed by local date, active profile, registry, Policy Pack, OpenCode version, and account/auth boundary. Reuse it for same-day review planning, refresh it on date/input changes, and block multi-model review when no current cache can prove exact available model ids.
11. Implement a redacted reviewer binding inventory snapshot that records registered, available, included, excluded, and blocked bindings plus perspective assignments with evidence refs and safe next actions.

Exit criteria:

1. A review plan can request all registered highest-tier available reviewer/model lanes as `reviewer` bindings with concrete provider-qualified model ids from the current daily model-availability cache, and can assign multiple reviewer perspectives to the same model when only one highest-tier model is registered.
2. Missing auth, stale or unknown usage, missing quota/reset evidence, unavailable model id, provider health failure, runtime echo mismatch, telemetry loss, lower-tier substitution, or output schema failure blocks the affected lane and reports a safe next action.
3. Review lanes return typed critical review outputs only. They do not approve dispatch, replace Guard, replace configured verification, or self-approve.
4. No `opencode run` invocation is part of the production lane path.
5. The feature is opt-in or later-gate only until all conformance and release approvals pass.
6. Conformance proves that registered highest-tier unavailable bindings are excluded or blocked with explicit inventory evidence, same-model multi-agent review preserves perspective separation, and fan-out never silently shrinks because of budget, quota, timeout, retry, or concurrency pressure.

## Phase 7: Operational Intelligence

Goal: add advisory learning, workflow optimization, score storage, and source-grounded specialist workflows without weakening Guard.

Tasks:

1. Implement append-only evaluation events.
2. Implement derived category-fit snapshots.
3. Implement the refined taxonomy in scoring fixtures and acceptance tests.
4. Implement `WorkflowPlanProposal` and `ProposalSet` for `simple`, `standard`, `detailed`, and `high_assurance` variants.
5. Implement advisory workflow optimizer scoring for goal fit, safety, simplicity fit, detail fit, taxonomy fit, verification coverage, implementation risk, dependency impact, confidence, cost/latency, and model diversity.
6. Implement normalized score aggregation using bounded weighted means, rates, percentiles, confidence intervals, sample counts, and recency decay; never rank by raw cumulative score sums.
7. Implement score reuse threshold gates with minimum sample count, task-signature match, recency/decay, confidence threshold, scorer diversity, policy/taxonomy hash compatibility, and recent-failure checks.
8. Implement multi-model proposal fan-out only behind explicit mode, user/policy opt-in, fresh provider-native dispatchable usage, fresh provider health where provider/model selection is involved, preserved reserve, budget cap, runtime compatibility, redacted prompt envelope gates, and cadence controls.
9. Implement fan-out cadence controls: default off, rolling-window caps, task/category cooldown, per-run confirmation above cost threshold, novelty requirement, and backoff after low-value or failed fan-out.
10. Implement local JSONL proposal and score ledgers plus derived snapshots.
11. Implement optional GitHub private repo JSONL score ledger support for low-volume redacted events with raw partitions, sealed immutable partitions, mandatory RFC 8785 canonical event hash chains, partition genesis hashes, manifest records, trusted chain heads, rotation, retention, archive paths, conflict handling, deterministic duplicate and event-id conflict handling, least-privilege GitHub workflow permissions, and migration triggers.
12. Implement GitHub ledger rollup and compaction from sealed partitions only into normalized aggregate snapshots, including sample count, effective sample count, weighted means, confidence buckets or intervals, rates, percentiles, decay-adjusted means, last observation time, scorer concentration, and negative-signal counters. Active raw partitions may produce only local non-reusable preview calculations.
13. Implement tests that prove rollups never rank by cumulative raw sums and never approve dispatch, change eligibility, bypass Guard, reduce verification, skip approval, or override usage and conformance.
14. Implement temporary GitHub Actions artifact export and sanitized GitHub Pages aggregate summaries.
15. Implement external managed database writer/readers through GitHub Actions OIDC or another approved workload identity path for scale, including migration manifest, final GitHub chain head, ingestion watermark, source precedence, cutover, and idempotent replay checks.
16. Ensure evaluation snapshots are ignored or fail closed when stale, malformed, hand-edited, external, below threshold, or outside the matching task signature.
17. Add reference-pack schemas.
18. Add minimal patent and medical-device source registers.
19. Add optional MCP connector interface with Policy Pack opt-in.
20. Add specialist output contracts and human-review boundaries.

Exit criteria:

1. Evaluation can rank only already-eligible candidates.
2. Evaluation never authorizes dispatch.
3. Workflow optimization cannot override Guard, policy, usage, runtime compatibility, conformance, or human approval.
4. Accumulated scores are loaded only when the threshold gate passes; below-threshold scores are ignored and current-task planning is used.
5. Score snapshots use normalized aggregates and never raw cumulative sums for ranking.
6. Multi-model proposal fan-out is impossible when usage or provider health is stale, unknown, shared-limit-suspected, refused, fallback-derived, over budget, over cadence limits, in cooldown, lacking novelty, or missing explicit opt-in.
7. GitHub score ledger tests prove no canonical forbidden persisted payload classes from the implementation spec section 3.2 are stored, and ledger rotation, sealing, retention, archive, compaction, conflict retry, duplicate quarantine, workflow permission hardening, and migration triggers work.
8. Rollup tests prove sealed partitions are immutable, active raw partitions are excluded from reusable rollups, manifest hash chains include RFC 8785 canonical event hashes, partition genesis hash, raw file hash, rollup hash, previous manifest hash, trusted chain head, included partitions, schema/policy/taxonomy hashes, dedupe ids, and mandatory previous-event hashes, and stale or tampered rollups are ignored or fail closed.
9. Rollup aggregation tests prove sample counts, effective sample counts, weighted means, confidence buckets or intervals, rates, percentiles, decay-adjusted means, last observation time, scorer concentration, and negative-signal counters are normalized and advisory only, and duplicate partitions or replayed events cannot inflate counts or confidence.
10. Acceptance tests compare simple, standard, detailed, and high-assurance variants against taxonomy and verification requirements.
11. Specialist workflows fail closed on stale or missing references.
12. No specialist produces legal, patentability, FTO, compliance, clearance, clinical, release, or product decisions.

## Phase 8: Opt-In Federated Score Registry

Goal: allow users who explicitly opt in to contribute sanitized aggregate signals to a central or self-hosted registry and consume community advisory snapshots without weakening privacy, Guard, verification, or local-only operation.

Tasks:

1. Add installer choices `no_keep_local`, `yes_share_redacted_aggregates`, and `ask_later`, with no preselected sharing option.
2. Add a payload preview command that shows the exact outbound schema with representative redacted values before sharing is enabled.
3. Implement a telemetry client that sends only schema-approved coarse aggregates or redacted event envelopes, never private ledger files.
4. Implement registry ingestion with schema validation, redaction validation, version checks, rate limits, abuse detection, anomaly quarantine, retention policy, documented revoke semantics, client/build provenance, and source concentration caps.
5. Implement public community score snapshots as normalized aggregates with minimum sample thresholds, concentration limits, freshness checks, and no per-user or per-project leaderboards.
6. Implement self-hosted registry endpoint configuration for privacy-sensitive teams.
7. Implement opt-out and revoke controls that stop future uploads without changing local ledgers or local planning, and document whether already-uploaded data is deleted, tombstoned, retained only in irreversible aggregate form, or cannot be removed after aggregation.
8. Prove registry outage, disablement, tampering, stale snapshots, and rate limits fall back to local-only planning.

Exit criteria:

1. Sharing is off by default and cannot be enabled by silence, preselection, config import, environment default, or model-generated approval.
2. Shared payload tests prove no raw prompts, transcripts, repo names, organization names, file paths, branch names, issue or PR titles, tool args/results, provider payloads, runtime echoes, stack traces, raw file contents, secrets, credentials, stable ids, public unsalted hashes, or prompt-derived hashes are uploaded.
3. Community snapshots influence only ranking among already-eligible candidates after the normal score reuse threshold gate and registry-specific trust gates pass.
4. Community snapshots cannot approve dispatch, change eligibility, bypass Guard, reduce verification, skip approval, override usage, override conformance, or override local Policy Pack rules.
5. Registry poisoning tests prove low-sample, concentrated, anomalous, malformed, stale, unknown-version, or provenance-missing submissions are quarantined or ignored.
6. Self-hosted and central registry modes use the same schema and safety gates.

## Cross-Cutting Verification

Every phase must include:

1. Typecheck.
2. Unit tests for success and fail-closed paths.
3. Redaction tests when audit/debug output changes.
4. Fixture tests for policy/config changes.
5. Conformance tests before enabling OpenCode-dependent behavior.

## Stop Conditions

Stop implementation and revise the spec if:

1. OpenCode cannot provide a safe path for real dispatch evidence.
2. Chat blocking cannot be implemented without unsafe prompt mutation.
3. Event telemetry is too lossy for safe recovery or quarantine.
4. Provider-native usage or provider health cannot be checked without unsafe credential, raw provider error, provider payload, log, path, stack trace, or transcript persistence.
5. Any feature requires OMO runtime compatibility.
6. FlowDesk value depends on broad invisible prompt/prefix injection rather than explicit commands, transparent suggestions, or conformance-proven blocking chat intake.
