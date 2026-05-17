# DEX Conductor OpenCode-First Plugin Design

> **FlowDesk supersession note:** This document is historical/background design context. It is not normative for FlowDesk implementation identity, package names, project data paths, Release 1 scope, command naming, or safety gates. Historical command-first or developer-preview wording in this folder is superseded. Current FlowDesk Release 1 is a chat-primary General-Use MVP with guarded command-backed routing, recovery, diagnostics, fallback commands, guarded dry-run, and fake-runtime dispatch only. Hard managed chat control, real dispatch, trusted real-provider echo, colon aliases, and sufficient event telemetry remain later gates.

## 1. Status

This document is a historical design proposal for the earlier DEX Conductor OpenCode plugin direction. It is not a FlowDesk implementation contract.

The plugin is intended to be used after removing `oh-my-openagent` / `oh-my-opencode` from the target OpenCode environment. DEX Conductor may learn from OMO-style orchestration patterns, but it must not depend on OMO runtime, OMO prompts, OMO config schema, OMO agent names, or OMO source code.

This product path is OpenCode-plugin first. The existing DEX CLI and `opencode-adapter` subprocess bridge are development, test, migration, or fallback runtime components; they are not the primary user experience or the target plugin architecture.

## 2. Relationship to Existing Decisions

This document preserves ADR 0001: DEX Conductor remains a standalone, company-wide, project-agnostic orchestration system. The OpenCode plugin is the first-class user experience and runtime integration surface, not a replacement for DEX core.

Supporting research and implementation-gap notes are recorded in `OPENCODE_PLUGIN_RESEARCH.md` in this background folder.

This document specializes `docs/REVISED_ORCHESTRATION_PLAN.md` for an OpenCode-first plugin product. It supersedes that document's OMO runtime language for this product path. Any `OpenCode/OMO runtime` wording in the revised orchestration plan should be treated as legacy or alternate-runtime language; the OpenCode-first plugin must not depend on OMO.

ADR impact: ADR 0001 remains valid because DEX core is still standalone and project-agnostic. A follow-up ADR may record the product packaging decision that the first-class UX is an OpenCode plugin backed by the standalone DEX core.

The existing principles remain in force:

1. DEX core stays project-agnostic.
2. Policy Pack boundaries stay intact.
3. DEX Model Guard is the deterministic pre-dispatch approval authority.
4. Missing config, stale usage, unknown quota, adapter mismatch, policy violation, or runtime uncertainty fails closed.
5. Runtime hooks are a last defense, not the source of policy truth.
6. All routing, selection, guard, dispatch, verification, and retry events are auditable.

## 3. Product Goal

DEX Conductor should become a first-class OpenCode plugin that lets the user keep the normal OpenCode terminal workflow while DEX performs policy-aware multi-model orchestration inside the active OpenCode session.

The plugin must allow the main orchestration model to generate a Workflow Plan, classify each step by difficulty and category, choose an agent profile, choose candidate models and reasoning depth, and dispatch only guard-approved steps to OpenCode.

The routing system must use Claude, GPT, and Gemini subscription capacity as a portfolio. It should avoid draining one provider early when other suitable providers remain available, so the user can keep using diverse model families until the end of the subscription window.

The routing system should prefer current frontier models by default, but it must accumulate performance, reliability, latency, category-fit, and verification outcomes over time so observed evidence can influence later model selection.

The plugin must also provide a safe extensibility substrate for domain specialists. Patent and medical-device software regulatory capabilities are supported through constrained agent profiles, policy gates, and versioned reference packs. They produce source-grounded research artifacts, issue spotting, evidence matrices, and review packets; they must not produce legal advice, regulatory clearance conclusions, patentability opinions, freedom-to-operate opinions, or compliance signoff.

## 4. Non-Goals

The MVP must not implement these items:

1. A full OMO clone.
2. OMO config compatibility.
3. OMO agent persona compatibility.
4. Team Mode, autonomous infinite loops, or ultrawork-style always-continue behavior.
5. A new terminal coding client.
6. A model gateway that hides provider identity from FlowDesk Guard.
7. Automatic fallback that bypasses provider-native usage checks.
8. Runtime policy decisions that happen only inside OpenCode hooks.
9. A legal, patent, clinical, or regulatory advice engine.
10. Bundling copyrighted ISO/IEC standard text without an explicit license.
11. Hardcoding DEX-2 project paths, planning documents, verification commands, or harness assumptions into core/plugin behavior.

## 5. Target User Experience

After installation, users remove the OMO plugin entry from OpenCode and add the FlowDesk plugin entry.

The user still works in the normal OpenCode chat window. The primary interaction is conversational: the user types a natural-language request, watches the model's response, asks follow-up questions, narrows scope, approves or rejects proposed actions, and continues the same conversation until the task is done.

DEX should therefore be automatic chat-intake first, not command-first. When the verified OpenCode plugin surface supports blocking chat intake, every natural-language user request should pass through the FlowDesk plugin's workflow gate before the assistant decides how to respond. Slash commands are explicit controls for setup, status, recovery, diagnostics, and advanced routing; they are not the only way to use DEX. If blocking chat intake cannot be verified for the installed OpenCode version, DEX must fail closed for managed dispatch and present the user with the configured command fallback instead of pretending the chat turn is fully guarded.

The workflow gate has four outcomes:

1. `fast_chat`: answer in normal chat, but still record minimal DEX intake metadata when auditing is enabled. Use for explanation-only, trivial Q&A, or non-privileged requests.
2. `managed_plan`: create a DEX Workflow Plan and explain it in chat before any privileged action.
3. `clarify`: ask a focused question when scope, approval, target files, or risk is ambiguous.
4. `blocked`: refuse or stop when config, policy, usage, runtime compatibility, plugin provenance, or safety checks fail.

This means the user should not need to type `/flowdesk:plan` to benefit from DEX. A natural request like "implement authenticated export" automatically enters DEX intake, classification, planning, route proposal, Guard preparation, status tracking, and recovery handling. Commands expose the same state for explicit control.

Example chat-first flow:

```text
User: Implement authenticated CSV export for admin users.
Assistant/DEX: DEX intake classified this as managed_plan: medium risk because it touches auth and export logic.
Assistant/DEX: Proposed plan: inspect current auth/export code, implement backend changes, add tests, run verification.
Assistant/DEX: Route: executor on <model>, reviewer on <different family> if review is required. Usage is available. Continue?
User: Yes, but don't touch billing exports.
Assistant/DEX: Scope narrowed. Guard approved step 1. Running inspection...
Assistant/DEX: Inspection complete. I need approval before writing files because this affects auth. Proceed with implementation?
User: Proceed.
Assistant/DEX: Implementation finished, tests failed in export authorization. I can retry with the failure output as context or stop and show details.
User: Retry once.
Assistant/DEX: Retry passed verification. Summary and audit reference: ...
```

DEX adds command controls and guardrails around that conversation:

```text
/flowdesk:setup
/flowdesk:init
/flowdesk:doctor
/flowdesk:plan "implement authenticated export flow"
/flowdesk:explain-route
/flowdesk:run
/flowdesk:status
/flowdesk:resume
/flowdesk:retry
/flowdesk:abort
/flowdesk:usage
/flowdesk:audit
/flowdesk:export-debug
```

OpenCode command integration must follow the actual OpenCode plugin surface. If dynamic slash-command registration is not available, `/flowdesk:*` commands are installed through OpenCode command configuration or markdown command files, while the FlowDesk plugin provides the underlying tools, hooks, event observers, and bridge calls.

The default conversational flow is:

1. User gives a natural-language request in OpenCode chat.
2. FlowDesk plugin intercepts or receives the chat turn through a verified blocking chat lifecycle integration and opens a `chat_intake` record with session id, message id, redacted prompt reference, workspace, and plugin/config version.
3. DEX classifies the request before normal assistant execution as `fast_chat`, `managed_plan`, `clarify`, or `blocked`. If the installed OpenCode surface can only observe or mutate chat text but cannot reliably suppress, replace, or handle the normal assistant turn, the classification may be recorded but privileged managed dispatch must stay blocked until the user enters a configured FlowDesk command.
4. `fast_chat` continues as normal OpenCode chat with no privileged DEX dispatch, while preserving optional intake/audit metadata.
5. `clarify` returns a natural-language question in chat and waits for the next user turn before planning or dispatch.
6. `blocked` returns safe feedback in chat, including the exact command or action needed, such as `/flowdesk:doctor`, `/flowdesk:usage`, `/flowdesk:setup`, or `/flowdesk:export-debug`.
7. `managed_plan` automatically creates or revises a DEX Workflow Plan with ordered steps and optional lanes.
8. The assistant explains the proposed workflow in-chat before privileged action: scope, risk, planned steps, selected agent/model families, expected verification, and when user approval will be required.
9. User may refine constraints in natural language. DEX updates the pending workflow proposal without dispatching privileged actions until Guard and required approvals pass.
10. DEX classifies each step by intent, risk, difficulty, category, required capabilities, write scope, and verification requirement.
11. DEX proposes agent/model/reasoning-depth bindings per step and summarizes the route in user-readable language.
12. DEX Model Guard validates policy, usage, runtime compatibility, transaction boundary, and review diversity.
13. Approved steps are dispatched through OpenCode with explicit Guard-approved agent, model, and runtime variant/reasoning metadata where supported.
14. The assistant keeps the user informed in-chat: current step, blocked state, required approval, retry choice, verification failure, or completion summary.
15. Execution echo, verification, performance outcome, and audit events are recorded.

### 5.1 Automatic Chat Intake Simulations

These simulations define the desired behavior for real users who type natural language instead of commands.

#### Simulation A: Explanation-Only Request

```text
User: Explain how the export module works.
DEX intake: fast_chat, low risk, no privileged action.
Assistant/DEX: Answers in normal chat, optionally cites files if already visible, and does not create a runnable workflow.
```

Design implication: not every chat turn should become a heavy workflow, but every turn should still pass through the DEX gate so the system can decide and audit why it stayed lightweight.

#### Simulation B: Simple Code Change

```text
User: Fix the typo in the CLI help text.
DEX intake: managed_plan, trivial/low risk, single-step workflow.
Assistant/DEX: "I will update the help text and run the closest verification. Continue?"
User: Yes.
Assistant/DEX: Guard approves, dispatches one step, runs verification, summarizes result.
```

Design implication: DEX should auto-plan even small implementation requests, but the plan can be compact and chat-native. The user should not need `/flowdesk:plan`.

#### Simulation C: Ambiguous High-Risk Request

```text
User: Fix auth, it's broken.
DEX intake: clarify, high potential risk, scope unknown.
Assistant/DEX: "Which auth flow is failing, and should I only investigate first or also change files?"
User: Investigate login failures only.
Assistant/DEX: Creates read-only managed_plan, no write dispatch until user approves implementation.
```

Design implication: automatic intake must not mean automatic execution. Ambiguous or high-risk natural language should first become a clarification or read-only investigation workflow.

#### Simulation D: Usage or Policy Block

```text
User: Refactor the billing export and run the tests.
DEX intake: managed_plan candidate, but usage snapshot stale.
Assistant/DEX: "Blocked before planning dispatch: usage snapshot is stale. Run /flowdesk:usage refresh or wait until <time>."
```

Design implication: blocked states must be explained in chat with safe next actions and a stable status object visible through `/flowdesk:status`.

#### Simulation E: Verification Failure and Retry

```text
User: Implement admin CSV export.
DEX intake: managed_plan.
Assistant/DEX: Implements after approval, verification fails.
Assistant/DEX: "Verification failed in export authorization. Options: retry with failure output, show details, reduce scope, abort."
User: Retry once with the failure output.
Assistant/DEX: Records auditable retry approval, reruns Guard/reselection if needed, resumes from checkpoint.
```

Design implication: retry/resume/abort must be available in natural language and through `/flowdesk:retry`, `/flowdesk:resume`, and `/flowdesk:abort`.

The explicit command flow is still available when the user wants direct control:

1. `/flowdesk:doctor` checks installation, config, policy, provider auth, usage freshness, plugin provenance, runtime capability, and Guard dry-run readiness.
2. `/flowdesk:plan <goal>` forces plan creation without dispatch.
3. `/flowdesk:explain-route` prints the latest route and Guard rationale.
4. `/flowdesk:run` dispatches the approved plan or next approved step.
5. `/flowdesk:status` shows current workflow state, blocked reason, safe next actions, checkpoint, and audit reference.
6. `/flowdesk:resume`, `/flowdesk:retry`, and `/flowdesk:abort` recover from failure, continue from checkpoint, or stop cleanly.
7. `/flowdesk:usage`, `/flowdesk:audit`, and `/flowdesk:export-debug` expose operational state for troubleshooting and review.

Automatic chat-intake behavior must not weaken safety. Natural-language approval is acceptable only when Policy Pack allows it and the assistant records an auditable approval event. For high-risk actions, DEX may require a typed confirmation token, explicit command, or permission prompt rather than inferring approval from ambiguous prose. The plugin must never treat silence, conversational acknowledgement, hidden comments such as `<!-- ... -->`, system-internal markers, or unrelated follow-up text as approval for privileged dispatch.

### 5.2 Chat Intake Capability Contract

The chat-first MVP requires a verified blocking intake capability for the exact installed OpenCode version or commit. DEX must record this in the runtime capability artifact before enabling automatic managed dispatch from natural-language chat.

Required capability evidence:

1. A supported chat hook, command hook, or equivalent lifecycle surface runs before normal assistant execution for a user turn.
2. The hook can deterministically choose one of these outcomes: continue as normal chat, replace the assistant response with a DEX clarification/blocked/plan response, or prevent normal assistant execution while DEX opens a managed workflow.
3. Failure inside the hook is fail-closed and user-visible, not silently converted into an unguarded assistant execution.
4. The hook exposes stable session/message identifiers or DEX can generate a collision-resistant correlation id before any privileged operation.
5. The hook behavior is covered by conformance tests pinned to the OpenCode version or commit used by production installs.

Supported modes:

| Mode | Meaning | Managed dispatch from natural chat |
|---|---|---|
| `blocking` | DEX can classify and suppress/replace/handle the normal assistant turn before execution | Allowed after `/flowdesk:doctor` passes |
| `observe_only` | DEX can observe or add context but cannot prove control of the turn | Blocked; ask user to use configured FlowDesk command |
| `off` | No chat intake hook is enabled or available | Blocked; commands only |

`observe_only` is useful for diagnostics and migration, but it is not the chat-first MVP. In `observe_only` or `off`, DEX may answer with safe instructions such as "FlowDesk managed chat intake is unavailable in this OpenCode profile; run `/flowdesk:plan ...` or `/flowdesk:doctor`", but it must not dispatch a managed workflow from natural chat.

### 5.3 Approval Contract

Auditable natural-language approval must include at least `workflow_id`, `step_id` or `plan_revision_id`, `message_id`, normalized approval intent, approval mode, risk tier, Policy Pack rule id, timestamp, actor, redacted prompt reference, and the exact action scope approved. Approval classifiers must be deterministic enough to test against fixtures.

Typed confirmation is required by default for critical-risk writes, destructive operations, broad auth/security changes, legal/regulatory/patent decision artifacts, policy/config mutation, plugin installation/migration, and any action where the requested scope is wider than the current plan summary. Policy Packs may require stricter confirmation but must not weaken core hard bans or Guard approval.

## 6. Architecture

```text
OpenCode Plugin Surface
  automatic chat intake hooks
  configured /dex commands
  plugin tools
  chat lifecycle hooks
  tool before/after hooks
  session events
  config handler
        |
        v
DEX Plugin Bridge
  resolves .conductor config path and project context
  passes Policy Pack reference to Policy Engine
  requests fresh Usage Availability Snapshot from Usage Adapter
  calls DEX core planner/router/guard
        |
        v
DEX Core
  Intent Classifier
  Workflow Planner
  Category Router
  Agent Profile Registry
  Model Candidate Resolver
  DEX Model Guard
  Reselection Loop
  Audit Engine
        |
        +----> Reference Pack Registry
        |       source manifests, retrieval tags, stale-source checks
        |
        +----> Evaluation Ledger
        |       append-only observations and derived score snapshots
        |
        v
Runtime Adapter
  OpenCode capability discovery
  OpenCode in-session tool/SDK dispatch
  final usage check
  execution echo validation
  cancellation and timeout supervision
```

The OpenCode plugin is thin. It should not contain policy logic. It should collect runtime context, expose user commands, and call DEX core. The bridge may locate and validate input paths and translate OpenCode context into typed DEX requests, but Policy Engine owns policy loading semantics and Usage Adapter owns usage interpretation.

### 6.1 Component Ownership

| Component | Owns | Must not own | Inputs | Outputs |
|---|---|---|---|---|
| OpenCode plugin | automatic chat intake, configured command integration, plugin tools, lifecycle hooks, event observation, user diagnostics | policy decisions, quota interpretation, model approval, fallback mutation | OpenCode chat turns, events, user commands, session metadata | DEX intake requests, command requests, observed runtime events |
| DEX Plugin Bridge | translation between OpenCode events and DEX contracts | business policy, final model approval, provider quota source of truth | `.conductor/config.json`, Policy Pack path, OpenCode context | typed core requests, audit correlation IDs |
| DEX Core | planning, category routing, model candidate ranking, Guard, reselection, audit contracts | OpenCode hook mechanics, raw provider auth handling | classification, usage snapshot, runtime capability, policy | route proposals, guard approvals/rejections, audit events |
| Agent Profile Registry | reusable capability profiles, output contracts, tool bounds, domain specialist definitions | provider/model approval, legal/regulatory conclusions | built-in profiles, Policy Pack extensions, Reference Pack scopes | agent profiles and constraints |
| Policy Engine | policy loading, hard bans, redaction baseline, policy merge | runtime dispatch, fallback execution | Policy Pack, project profile | validated policy, denylist, redaction rules |
| Reference Pack Registry | versioned source manifests, retrieval tags, provenance, stale-source validation | professional advice, policy approval, hidden source substitution | reference pack manifests, official source metadata, optional MCP connectors | source-grounded reference cards and retrieval results |
| Usage Adapter | provider-native usage snapshot creation | model approval, normalized-score approval | local provider credentials and usage sources | Usage Availability Snapshot |
| Runtime Adapter | OpenCode capability discovery, approved execution, cancellation, execution echo observation | planning, routing, policy, usage balancing | Guard-approved runtime request | runtime result, execution echo, capability artifact |
| Evaluation Ledger | append-only model/category observations, derived score snapshots, anti-Goodhart controls | hard approval or denial | verification outcomes, runtime metrics, review results, human overrides | category-fit and performance signals |

No component outside DEX Model Guard may authorize execution. Components may propose, translate, observe, or record; only Guard approves or blocks dispatch.

### 6.2 Package Contracts

The target package graph must be explicit before implementation:

1. `@dex-conductor/opencode-plugin` owns OpenCode hooks, configured command entrypoints, plugin tools, session/event observation, chat-intake mode enforcement, and the bridge from OpenCode context into typed DEX requests. It depends on core contract types but must not implement policy, usage interpretation, model ranking, or redaction rules.
2. `@dex-conductor/core` owns intent classification contracts, workflow planning, routing, Guard requests/decisions, reselection, dispatch contracts, and audit event type definitions. It may consume policy, usage, evaluation, and reference-pack interfaces through typed inputs.
3. `@dex-conductor/policy-engine` owns `.conductor/config.json` schema loading, Policy Pack merge semantics, hard-ban extension validation, redaction policy, and fail-closed config validation.
4. `@dex-conductor/usage` owns provider-native usage collection and emits short-lived Usage Availability Snapshots. It must not persist raw provider credentials, raw quota responses, or full session transcripts.
5. `@dex-conductor/evaluation` owns append-only ledger event schemas, stores, aggregation, decay, exclusion rules, and read-only category-fit snapshots. Its outputs are advisory ranking inputs only.
6. Reference packs use the canonical repository/data path `reference-packs/` and project config path `.conductor/reference-packs/registry.yaml`. The schema owner is the policy/reference-pack layer, not the OpenCode plugin. Optional connectors such as MCP servers may feed snapshots, but they do not replace source manifests.

Dependency direction should stay acyclic: OpenCode plugin -> core contracts -> policy/usage/evaluation/reference-pack interfaces. No package may call back into the OpenCode plugin for authorization.

## 7. OpenCode Plugin Surface

The plugin should use only the OpenCode surfaces required for a safe MVP:

1. OpenCode plugin module loaded locally or from an npm package, with `@opencode-ai/plugin` types.
2. Chat lifecycle hooks such as `chat.message`, `chat.params`, `chat.headers`, or equivalent surfaces for automatic DEX intake and safe context insertion. `chat.params` and `chat.headers` may alter provider call parameters or headers where supported, but they are not routing authority and must not be assumed to replace the selected model, agent, or Guard-approved dispatch binding.
3. Plugin tools such as `flowdesk_chat_intake`, `flowdesk_plan`, `flowdesk_run`, `flowdesk_explain_route`, `flowdesk_doctor`, `flowdesk_status`, `flowdesk_resume`, `flowdesk_retry`, `flowdesk_abort`, `flowdesk_usage`, `flowdesk_audit`, `flowdesk_export_debug`, and `flowdesk_reference_search`.
4. Configured `/flowdesk:*` commands that call the plugin tools. Do not assume an undocumented dynamic slash-command registration API.
5. `event` hook for command, session, permission, shell, tool, message, LSP, and TUI observations.
6. `command.execute.before` for FlowDesk command context injection and validation.
7. `tool.execute.before` as a last-defense hard-ban check.
8. `tool.execute.after` for execution metadata and audit correlation.
9. Session events for audit boundaries and resumable workflow state.
10. Config hook for plugin diagnostics and safe defaults, not for overriding DEX Policy Pack decisions.

The plugin may inspect normal user messages for DEX intake, but it must not silently modify OpenCode's selected model, agent, tools, permissions, or prompt body unless the message has been classified into a DEX-managed workflow path and the modification is represented in the auditable intake/route state.

Automatic intake must be capability-gated. If OpenCode exposes `chat.message` only as message mutation and not as a documented handled/cancel/prevent-default contract, DEX may use it for safe context insertion, classification, or a blocked/clarify response only when conformance tests prove the normal assistant turn is not also executing unguarded. Otherwise the plugin must fall back to configured FlowDesk commands for managed workflows.

Server plugin tools and configured command files are the MVP integration path. OpenCode TUI plugin APIs, palette entries, panels, keymaps, or legacy slash-like TUI actions are separate UI surfaces and should not be treated as the authority for server-side tool registration or Guard policy enforcement.

### 7.1 Plugin-First Packaging

The plugin package should be a real OpenCode plugin, not a wrapper that starts another OpenCode process.

Target package:

```json
{
  "name": "@dex-conductor/opencode-plugin",
  "type": "module",
  "main": "./dist/index.js",
  "exports": {
    ".": "./dist/index.js",
    "./server": "./dist/index.js"
  },
  "peerDependencies": {
    "@opencode-ai/plugin": ">=1.14.0"
  }
}
```

Package compatibility and provenance rules:

1. `@opencode-ai/plugin >=1.14.0` is a proposed compatibility floor, not proof that every researched hook is stable. Implementation must pin and record the verified OpenCode version or commit, then set `engines.opencode` or equivalent compatibility metadata.
2. Release builds should use lockfile or package-integrity verification and avoid unreviewed third-party plugin dependencies in the Guard, policy, usage, audit, or dispatch path.
3. Local plugin development paths are allowed for testing, but production installation should document the trusted package source and review boundary.
4. Development-harness LSP configuration may temporarily live in an OMO/oh-my-openagent config file only for this repository's authoring workflow. That configuration is not part of the FlowDesk plugin runtime and must not be required after target installation removes OMO.

Runtime rule: inside the OpenCode plugin, DEX should use the plugin context, OpenCode client, tool context, session id, message id, `directory`, `worktree`, and abort signal. It should not call `opencode run` for normal plugin-managed execution. Nested `opencode run` can recursively load the same plugin, split session state, duplicate dependency installation, and blur permission boundaries.

The existing `packages/opencode-adapter` may remain for CLI compatibility, fake-runtime tests, and migration diagnostics, but the first-class plugin path should use in-session OpenCode tools/hooks/events instead of a nested OpenCode subprocess.

### 7.2 Subagent Stall and Runtime Failure Hooks

DEX should treat subagent silence, empty completion, model failure, and runtime fallback as first-class observed states.

OpenCode event surfaces that can support this include session lifecycle events, message update events, tool execution before/after hooks, permission events, and session error events. The plugin should normalize these into DEX events instead of copying OMO hook behavior directly.

Minimum normalized events:

| Event | Trigger | Default DEX behavior |
|---|---|---|
| `subagent_started` | approved runtime step creates or attaches to an OpenCode agent/session | open attempt boundary and audit lineage |
| `subagent_progress_observed` | message/tool/session activity advances within the attempt | update heartbeat timestamp |
| `subagent_stalled` | no activity before policy timeout or stale heartbeat | pause attempt, request status, or cancel according to Policy Pack |
| `subagent_completed_empty` | subagent returns without required output contract | fail attempt and require retry/reselection |
| `subagent_exited_early` | todos/step contract remain incomplete but session reports idle/complete | fail attempt unless user explicitly accepts partial result |
| `runtime_model_failed` | provider/API/model error, context error, or OpenCode session error | record failure and ask selector for Guard-approved reselection |
| `runtime_fallback_requested` | runtime or provider suggests a different model | require fresh usage check and Guard approval before fallback |
| `execution_echo_untrusted` | actual agent/model/variant cannot be proven | invalidate result and keep artifacts quarantined |

Retry rules:

1. A stalled or empty subagent does not automatically continue forever.
2. Retry requires a new attempt id, audit event, and either the same Guard-approved binding or a Guard-approved reselection.
3. Runtime fallback is never automatic. It may only use a pre-approved candidate set or trigger a new Guard pass.
4. Repeated semantic failures must narrow the failure reason. Repeating the same model/provider/category failure exhausts retry budget early.
5. Policy Pack may set stricter stall timeout, maximum attempts, and human-approval requirements.

These hooks are observability and containment tools. They do not authorize execution and do not replace DEX Model Guard.

### 7.3 Security Invariants

FlowDesk Guard is the sole policy authority. OpenCode permissions, plugin hooks, command handlers, runtime echoes, and provider responses are not authorization sources.

Every privileged operation must be authorized by FlowDesk Guard before execution and must fail closed when authorization cannot be completed. Privileged operations include filesystem writes, shell execution, network calls, provider/model routing, config mutation, audit mutation, session mutation, and runtime dispatch.

All custom plugin commands and tools must route through a Guard-approved path before performing filesystem, shell, network, provider, model-routing, config, audit, or session-mutating behavior. No command or tool may bypass Guard by calling OpenCode APIs, provider SDKs, subprocesses, or local config loaders directly.

`tool.execute.before` is a final containment layer only. Policy enforcement must happen earlier at command dispatch, chat lifecycle, config load, session mutation, model routing, and runtime request construction. A missing earlier check is a design defect.

User overrides may only narrow policy or select from Guard-approved alternatives. Overrides must not disable FlowDesk Guard, fail-closed behavior, audit logging, redaction, provider-native usage checks, hard bans, model/provider identity logging, or OMO removal guarantees.

`.conductor` config is untrusted input. Missing, malformed, stale-version, conflicting, privileged-unknown-key, symlink-ambiguous, path-traversing, remotely included, or otherwise suspicious config must fail closed before any privileged operation runs.

Audit logs must redact raw prompts, secrets, environment variables, credentials, provider API responses, quota/usage payloads, auth headers, file contents, tool arguments/results, stack traces, and runtime echoes unless the field is explicitly classified safe. Redaction failure must fail closed for audit emission and must not leak unredacted payloads.

Model routing must preserve provider identity. The plugin must not use a model gateway or abstraction that hides the real provider, model, account/quota source, or provider-native usage-check result from FlowDesk Guard or audit logs.

OMO is fully removed from runtime behavior. The plugin must not depend on, invoke, shell out to, dynamically import, fallback to, alias, or compatibility-wrap OMO under any condition, including migration, error recovery, or environment-variable opt-in.

### 7.4 DEX-2 Harness Integration Boundary

The DEX-2 harness is a reference integration, not a source of project-specific defaults for every plugin installation.

Reusable concepts that may become plugin templates or generic Policy Pack defaults:

1. Policy Pack structure for allowed/disallowed agents, allowed providers, model families, minimum tier by risk, high-risk review diversity, hard-ban extension, governance verification command, and audit redaction baseline.
2. Governance integrity pattern: project config declares governance files and optional checksums; DEX validates them before privileged execution.
3. Verification command contract: Policy Pack may name a project verification command, but plugin/core only know how to run a validated command safely.
4. Provider-qualified usage snapshot shape for Claude, GPT, and Gemini families.
5. Review diversity policy and fail-closed behavior when required model families are unavailable.

DEX-2-specific material that must remain in `policy-packs/dex2-harness`, project config, or project artifacts:

1. `./scripts/dex verify` and any script path under a DEX-2 repository.
2. `plan_docs/canon/00_ENTRYPOINT.md` and any planning/canon document path.
3. `scripts/hooks/` path and DEX-2 hook semantics.
4. DEX-2-specific hard-ban extensions such as harness feature toggles.
5. DEX-2 project name, profile type, planning documents, and local audit/artifact paths.

Core hard bans should stay project-agnostic. If a ban only makes sense for the DEX-2 harness, it belongs in `policy-packs/dex2-harness` under `hard_ban_extension.denylist`, not in the core `CORE_HARD_BANS` set.

These DEX-2 paths are migration examples, not FlowDesk agent-authoring requirements. Generated FlowDesk agents must not require `plan_docs/canon/00_ENTRYPOINT.md` or any fixed planning/canon path as a startup step or expertise source.

Plugin templates may ship a generic starter profile inspired by DEX-2, but installation must require a project to choose or create a Policy Pack. The plugin must fail closed when a project-specific verification command or governance file is declared but missing, malformed, path-traversing, or outside the trusted workspace.

## 8. Workflow Plan Contract

The main model produces a Workflow Plan, but it does not approve execution.

Each `workflow_step` must include:

```json
{
  "step_id": "step_03_execute",
  "type": "execution",
  "purpose": "apply the approved implementation change",
  "difficulty": "high",
  "category": "backend-implementation",
  "agent_id": "executor",
  "required_capabilities": ["code_editing", "tool_use", "verification_followthrough"],
  "candidate_models": [
    {
      "model_id": "openai/gpt-5.5",
      "provider": "openai",
      "model_family": "gpt",
      "reasoning_depth": "high",
      "selection_role": "primary"
    },
    {
      "model_id": "anthropic/claude-sonnet-4-6",
      "provider": "anthropic",
      "model_family": "claude",
      "reasoning_depth": "medium",
      "selection_role": "fallback"
    }
  ],
  "usage_snapshot_id": "usage_2026_05_14T10_00_00Z",
  "verification_exit_conditions": ["tests_passed", "lsp_diagnostics_clean"]
}
```

This extends the current `WorkflowStep` shape conceptually. The implementation may introduce this as a new contract before migrating the older `fallback_candidates: string[]` field.

### 8.1 Canonical Data Contracts

The OpenCode-first plugin must distinguish current implementation contracts from target routing contracts.

Current core compatibility:

1. Existing `WorkflowStep.selected_model` remains the single selected model for an approved attempt.
2. Existing `WorkflowStep.fallback_candidates: string[]` remains a transitional list of model ids only.
3. Existing `WorkflowStep.runtime_variant`, `usage_snapshot_id`, `transaction_boundary`, `verification_exit_conditions`, and `selection_reason` remain valid and should be populated when available.
4. Existing `RouteDecision.planner_model`, `critic_model`, `executor_model`, `fallback_models`, and `critical_review_models` remain MVP-v0 compatibility outputs.

Target plugin contract:

1. `CandidateModel` is the future candidate shape. It contains at least `model_id`, `provider`, `model_family`, `tier`, `capabilities`, `runtime_model_id`, `supported_runtime_variants`, `reasoning_depth`, `selection_role`, and `score_breakdown`.
2. `WorkflowPlanProposal` may carry multiple `CandidateModel` entries before Guard approval.
3. `GuardApprovedDispatch` carries exactly one selected `model_id`, one `runtime_model_id`, one `agent_id`, one `runtime_agent_id`, one optional `runtime_variant`, the approved `usage_snapshot_id`, and the Guard request id.
4. The adapter may execute only `GuardApprovedDispatch`; it must not execute a raw `WorkflowPlanProposal` or selector-ranked candidate.

Migration rule: until `CandidateModel[]` lands in core types, the plugin bridge may down-convert the primary candidate into `selected_model` and additional approved ids into `fallback_candidates`. This down-conversion must preserve provider-qualified model ids and must not erase provider, family, tier, or usage evidence from audit events.

Review-agent migration hazard: current MVP-v0 code may still emit or map the legacy `critic` agent id and `critic_model` field, while the target registry and several policy packs use `reviewer`. The plugin path must resolve this before dispatch by either introducing an explicit `critic -> reviewer` compatibility alias that is visible to Guard/audit, or by requiring Policy Packs to allow both during migration. Silent mismatch is not acceptable because runtime capability discovery and `agents.allowed` checks can otherwise reject high-risk review steps after selection.

This is an MVP prerequisite, not a cosmetic migration note. `/flowdesk:doctor` must fail plugin-managed dispatch when a planned review lane uses `critic` but policy/runtime capability only recognizes `reviewer`, or vice versa. Any temporary alias must be recorded in audit as an agent-id migration decision with both source and target ids.

### 8.2 Runtime Adapter Trust Contract

The runtime adapter is a constrained executor, not a trusted decision maker.

Adapter inputs must be limited to Guard-approved dispatch data, redacted task instructions, runtime capability snapshot id, final usage check request, and audit correlation ids. The adapter must not accept policy overrides, arbitrary model aliases, unqualified model ids, provider-hidden gateway ids, raw quota substitutions, or unreviewed command fragments.

Adapter outputs are observations. They include process result, parsed OpenCode JSON events, execution echo, artifact references, cancellation state, timeout state, final usage check result, and runtime errors. These outputs can prove failure, uncertainty, or quarantine requirements; they cannot prove policy approval.

Execution echo is trustworthy only when all of these match the Guard-approved request:

1. `workflow_id`, `step_id`, `attempt_id`, and invocation/correlation id.
2. Runtime agent id.
3. Runtime model id and provider-qualified DEX model id.
4. Runtime variant/reasoning setting, when required.
5. Runtime capability snapshot id or compatible runtime version/provider config hash.
6. Command shape hash generated before dispatch.

If any required echo field is missing, mismatched, malformed, truncated, or sourced only from unstructured model text, the result must be marked `execution_echo_untrusted`. Artifacts from that attempt stay quarantined and cannot update performance scores as success. Echo generated only by the CLI/subprocess compatibility bridge is test or migration evidence; plugin-managed dispatch must prefer verified OpenCode runtime events, tool context, session metadata, and capability hashes. If actual runtime agent/model evidence cannot be proven, DEX quarantines the result even if the model text claims success.

## 9. Difficulty and Category System

DEX should use semantic categories, not raw model names, as the first routing abstraction.

Initial categories:

| Category | Purpose | Default agent candidates | Model family preference |
|---|---|---|---|
| `planning` | Requirements, decomposition, acceptance criteria | `planner`, `adversary` | Claude/GPT frontier, Gemini as diversity fallback |
| `architecture` | System design, trade-off analysis | `planner`, `reviewer`, `adversary` | GPT high reasoning, Claude Opus/Sonnet fallback |
| `backend-implementation` | Server, CLI, core logic | `executor`, `test-engineer` | GPT or Claude, chosen by usage and observed fit |
| `frontend-implementation` | UI, styling, interaction design | `executor`, `reviewer` | Gemini latest Pro preferred when available |
| `security-review` | Secrets, hard bans, policy risk | `security-reviewer`, `adversary` | At least high-tier non-executor model |
| `verification` | Tests, builds, diagnostics, output validation | `verifier`, `test-engineer` | Fast reliable model with tool discipline |
| `documentation` | Design docs, onboarding, migration notes | `document-specialist`, `reviewer` | Gemini Flash/Pro, Claude, or GPT depending observed writing score |
| `patent-research` | Patent source research, prior-art framing, office-action issue spotting | `patent-specialist`, `document-specialist`, `reviewer` | High citation fidelity model, independent reviewer required |
| `medical-device-software-regulatory` | SaMD/MDSW regulatory issue spotting and evidence packet preparation | `meddev-regulatory-specialist`, `safety-risk-reviewer`, `reviewer` | High citation fidelity model, human RA/QA review required |
| `legal-reference-validation` | Verify legal/regulatory citations and source freshness | `legal-reference-validator`, `verifier` | Reliable retrieval/tool-use model |
| `quick-fix` | Low-risk single-file fixes | `executor` | cheapest suitable fresh model |

Difficulty levels:

| Difficulty | Meaning | Routing implication |
|---|---|---|
| `trivial` | Typo, single local edit, no architecture risk | cheap model, low reasoning, narrow tool scope |
| `low` | Simple implementation with known pattern | standard model, medium verification |
| `medium` | Multi-file or unclear edge cases | stronger model or review step required |
| `high` | Architecture, security, migration, broad blast radius | high reasoning, independent review, diversity policy |
| `critical` | Data loss/security/production risk | typed approval, multi-provider review, strict fail-closed |

### 9.1 Agent Profile Registry

Agent names are not enough. DEX must route through capability profiles that define what an agent may do, which references it may use, and what output contract it must satisfy.

Minimum `AgentProfile` registry fields:

```json
{
  "agent_id": "meddev-regulatory-specialist",
  "type": "capability_profile",
  "categories": ["medical-device-software-regulatory"],
  "required_capabilities": ["source_retrieval", "citation_checking", "regulatory_issue_spotting"],
  "minimum_tier": "high",
  "allowed_tools": ["flowdesk_reference_search", "flowdesk_reference_get", "flowdesk_citation_verify"],
  "disallowed_actions": ["legal_advice", "compliance_signoff", "clinical_claim_approval", "regulatory_submission_decision"],
  "reference_scopes": ["medical-device-software"],
  "output_contract": "evidence_matrix_with_citations_and_uncertainty",
  "human_review_required_for": ["regulatory_strategy", "market_claim", "submission_content", "release_decision"]
}
```

Built-in generic profiles should cover planner, executor, reviewer, verifier, adversary, security-reviewer, debugger, test-engineer, document-specialist, patent-specialist, meddev-regulatory-specialist, safety-risk-reviewer, and legal-reference-validator. Policy Packs may allow, disallow, narrow, or extend profiles, but they must not weaken core hard bans, legal/regulatory advice boundaries, source provenance requirements, human review gates, or Guard approval.

Patent and regulatory specialists are bounded research accelerators. They may summarize official sources, prepare issue lists, verify citations, build evidence matrices, and generate questions for counsel or RA/QA. They must not make final patentability, infringement, freedom-to-operate, compliance, market clearance, clinical, or product-release decisions.

### 9.2 Reference Pack Architecture

Legal, patent, and regulatory knowledge must live in versioned reference packs, not in prompt-only agent personas and not as copied project planning documents.

Canonical repository shape:

```text
reference-packs/
  patent/
    registry/source-register.yaml
    jurisdictions/
      us/
      ep/
      pct/
      kr/
    concepts/
    workflows/
  medical-device-software/
    registry/source-register.yaml
    global/imdrf/
    jurisdictions/us-fda/
    jurisdictions/eu-mdr-ivdr/
    jurisdictions/kr-mfds/
    standards/
    concepts/
    workflows/
schemas/
  reference-pack.schema.json
  reference-card.schema.json
  source-register.schema.json
```

Projects may register installed packs through `.conductor/reference-packs/registry.yaml`, but source packs should use the canonical `reference-packs/` layout unless a future ADR defines packaged reference-pack distribution.

Reference cards should be small, source-bound, and machine-readable:

```yaml
id: fda-device-software-premarket-2023
domain: medical-device-software
jurisdiction: US
authority: FDA
source_type: guidance
status: final
issue_date: 2023-06-14
last_verified: 2026-05-15
next_review_due: 2026-08-15
source_url: https://www.fda.gov/regulatory-information/search-fda-guidance-documents/content-premarket-submissions-device-software-functions
retrieval_tags:
  - meddev.us.fda.premarket
  - meddev.software.documentation
legal_boundary: reference_only_not_legal_or_regulatory_advice
do_not_use_for:
  - eu_mdr_classification
  - compliance_signoff
  - clinical_claim_approval
```

Reference pack rules:

1. Every card needs jurisdiction, authority, source URL, source type, status, last verification date, update cadence, license/copyright note, retrieval tags, and `do_not_use_for` constraints.
2. Official sources are preferred: law.go.kr/MOLEG and relevant Korean authorities for Korean law; USPTO, WIPO, EPO, national patent offices for patent; FDA, EU/MDCG, IMDRF, ISO/IEC metadata pages, MFDS, and related official regulators for medical-device software.
3. ISO/IEC standards text must not be copied unless licensed. Store metadata, scope summaries, section pointers, access instructions, and organization-authored notes.
4. Stale or superseded references fail closed for high-risk use. The agent should return `refresh_reference_pack`, `narrow_jurisdiction`, or `human_review_required` instead of guessing.
5. External tools such as MCP servers may be optional connectors, but they are not sole sources of truth unless their provenance, auth, freshness, and failure semantics are validated.
6. Reference retrieval results are evidence inputs, not policy approvals. Guard and Policy Pack boundaries still apply.

The `korean-law-mcp` project is a useful optional integration pattern for Korean law retrieval because it wraps law.go.kr/MOLEG APIs, provides citation verification, time comparison, and law-impact style tools. DEX should treat it as an optional connector or reference-pack ingestion source, not as a bundled or exclusive legal database. DEX must validate API key handling, response provenance, stale-source behavior, license compatibility, and failure markers before using it in specialist workflows.

## 10. Agent, Model, and Reasoning-Depth Selection

Agent, model, and reasoning depth are separate decisions.

```text
category + difficulty + risk
  -> agent profile candidates
  -> model candidate chain
  -> reasoning depth / runtime variant
  -> DEX Model Guard approval
```

Reasoning-depth values should be normalized to runtime-supported variants:

| DEX value | OpenCode/runtime examples | Use case |
|---|---|---|
| `low` | low, minimal, no extended thinking | quick fixes, simple verification |
| `medium` | medium, standard | normal implementation |
| `high` | high, xhigh, max, extended thinking | architecture, security, critical review |

Unsupported reasoning settings must not fail open. They must either be downgraded through a documented compatibility rule or rejected with `change_runtime_variant` / `raise_tier` safe feedback.

## 11. Model Freshness Policy

DEX should prefer the newest stable frontier model in each family, but freshness is not enough to dispatch.

Each model resource should include:

```json
{
  "model_id": "google/gemini-3.1-pro",
  "provider": "google",
  "model_family": "gemini",
  "release_channel": "stable",
  "frontier_rank": 1,
  "capabilities": ["code_reasoning", "visual_reasoning", "long_context"],
  "supported_runtime_variants": ["low", "medium", "high"],
  "status": "available"
}
```

Selection preference order:

1. Policy allowed.
2. Runtime available.
3. Provider-native usage bucket dispatchable.
4. Capability and category match.
5. Difficulty and reasoning-depth match.
6. Freshness/frontier rank.
7. Historical performance and reliability.
8. Portfolio balance across providers.

Fresh latest models can lose to older models if observed failure rate or category-fit evidence is poor.

### 11.1 Routing Precedence

Routing must be deterministic enough to audit. The selector applies these phases in order:

1. Normalize the step into category, difficulty, risk, required capabilities, write scope, verification requirement, and review requirement.
2. Load agent profile candidates that satisfy the category and required capabilities.
3. Build provider-qualified model candidates from the model catalog and current config.
4. Apply hard policy filters from core hard bans, Policy Pack, project profile, allowed providers/families, minimum tier, and agent restrictions.
5. Apply runtime compatibility filters from the latest capability discovery artifact.
6. Apply provider-native usage availability filters using a fresh Usage Availability Snapshot.
7. Apply review diversity filters for high-risk and critical steps.
8. Score remaining candidates for capability fit, category fit, difficulty fit, freshness, performance, reliability, latency, and portfolio balance.
9. Select a primary candidate and bounded fallback candidates.
10. Submit the selected candidate to DEX Model Guard for approval.

If phases conflict, the stricter phase wins. A later scoring phase cannot undo an earlier hard filter. User preferences, config preferences, historical performance, freshness, and portfolio balance are ranking signals only; they never override policy, runtime compatibility, provider-native usage availability, review diversity, or Guard rejection.

## 12. Subscription Usage Balancing

DEX must treat model subscriptions as a portfolio, not as isolated fallback pools.

The goal is not to use the cheapest model first. The goal is to preserve useful diversity until the end of the reset window.

For each provider/model family, DEX tracks:

1. Native bucket name and window.
2. Remaining usage.
3. Reset time.
4. Uncertainty state.
5. Recent dispatch rate.
6. Category-specific demand forecast.
7. Minimum reserve policy.

Balancing rules:

1. Never dispatch on `unknown`, `stale`, `provider_refused`, or `shared_limit_suspected`.
2. Keep reserve capacity for high-risk review models.
3. Avoid spending the last high-tier Gemini capacity on non-visual/non-diversity tasks if GPT or Claude is suitable.
4. Avoid draining Claude/GPT high-reasoning buckets on quick fixes if lower-tier or alternate family models are policy-compatible.
5. Prefer underused suitable providers when category-fit scores are close.
6. If one family is near reset and another is far from reset, controlled use of the near-reset family is allowed when risk is low and policy permits.

The balancing score is only a ranking signal. Guard approval is still based on provider-native bucket state, not a normalized score.

### 12.1 Usage Snapshot Validity Contract

Usage balancing depends on provider-native availability, so the snapshot has to be treated as a short-lived capability artifact.

A Usage Availability Snapshot is valid only when all of these are true:

1. `snapshot_id`, `created_at`, and positive `freshness_ttl_seconds` are present and parseable.
2. Current time is before `created_at + freshness_ttl_seconds`.
3. Provider and model family are explicit and provider-qualified.
4. Provider API health is not `unavailable` or `unknown` for the bucket needed by the candidate.
5. At least one relevant bucket has `uncertainty: "available"` and `remaining > 0`.
6. The snapshot was acquired from the configured provider-native source or an approved local usage adapter, not from model-generated text.
7. The snapshot id used by selection is the same snapshot id presented to Guard, or a newer fresh snapshot is explicitly acquired for final dispatch.

Invalid states are fail-closed: missing snapshot, stale timestamp, malformed provider/model family, unknown remaining amount, provider refusal, shared-limit suspicion, degraded source without policy opt-in, or mismatch between selected candidate and checked bucket.

Final dispatch requires a final usage check as close to runtime execution as practical. If final usage differs from the selection snapshot, the adapter must block dispatch and return `refresh_usage`, `wait_until`, `change_provider`, or `reduce_scope` safe feedback instead of falling back by itself.

## 13. Performance and Category-Fit Evaluation

DEX should accumulate evidence after every step in a dedicated evaluation ledger. The current MVP-v0 `ModelPerformance { model, score, latency_ms? }` shape is only a transitional caller-supplied hint; it is not sufficient for real category-fit learning.

Target implementation package:

```text
packages/evaluation/
  src/types.ts
  src/events.ts
  src/store.ts
  src/aggregate.ts
  src/selectors.ts
  src/index.ts
  tests/index.test.ts
```

Storage should be append-only observations plus rebuildable derived snapshots:

```text
.conductor/evaluation/events.jsonl
.conductor/evaluation/category-fit.snapshot.json
```

Minimum evaluation event:

```json
{
  "event": "model_performance_observed",
  "workflow_id": "wf_2026_05_14_001",
  "step_id": "step_03_execute",
  "agent_id": "executor",
  "category": "backend-implementation",
  "difficulty": "high",
  "model_id": "openai/gpt-5.5",
  "runtime_variant": "high",
  "status": "passed",
  "latency_ms": 84500,
  "verification_status": "passed",
  "guard_status": "approved",
  "runtime_echo_status": "trusted",
  "artifact_disposition": "promoted",
  "review_verdict": "approved",
  "rework_required": false,
  "guard_rejections_before_success": 1,
  "user_override": false,
  "trusted_for_scoring": true,
  "excluded_reason_codes": []
}
```

Evaluation dimensions:

| Dimension | Source | Effect |
|---|---|---|
| `verification_pass_rate` | tests/build/lsp/Policy Pack command | raises or lowers category fit |
| `rework_rate` | follow-up fixes, reviewer rejection | penalizes model/category pairing |
| `latency` | runtime adapter timing | affects low/quick categories more than high-risk work |
| `tool_error_rate` | OpenCode JSON events, adapter errors | penalizes runtime binding |
| `guard_rejection_rate` | DEX Model Guard | penalizes stale candidate policies |
| `user_acceptance` | explicit approval or repeated overrides | weak positive signal |
| `cost_of_diversity` | remaining usage impact | informs portfolio balancing, not sole selection |
| `citation_fidelity` | reference validator / reviewer | critical for patent/regulatory agents |
| `unsafe_advice_rate` | reviewer / output contract validator | penalizes legal/regulatory specialist pairing |
| `stale_reference_rate` | Reference Pack Registry | penalizes outdated source usage |

Evaluation must be scoped by category, difficulty, agent, and model family. A model can be excellent for `architecture` and poor for `frontend-implementation`.

### 13.1 Evaluation Ledger Trust Rules

Only trusted observations may improve a score. These observations are excluded from positive scoring:

1. Guard rejected, policy denied, or usage failed.
2. Runtime echo missing, mismatched, malformed, or untrusted.
3. Final usage check stale or unavailable.
4. Verification missing when the step required verification.
5. Artifacts quarantined, discarded, or not promoted.
6. Required review diversity not satisfied.
7. Specialist output missing citations, jurisdiction, source status, uncertainty, or human-review boundary.
8. Legal/regulatory agent produced forbidden conclusion language such as final patentability, freedom-to-operate, compliance, clearance, marketability, clinical, or product-release determination.

Negative signals may be recorded immediately. Positive penalties or boosts should respect `min_samples_before_penalty`, confidence, decay, and model-version resets.

### 13.2 Aggregation and Anti-Goodhart Controls

Derived scores are advisory ranking inputs. They must never override policy, hard bans, provider-native usage availability, runtime compatibility, review diversity, human approval, or Guard rejection.

Aggregates should be keyed by:

```text
category + difficulty + agent_id + provider + model_family + model_id + runtime_variant
```

Minimum aggregate fields:

1. sample count and trusted sample count.
2. verification pass rate.
3. runtime echo trusted rate.
4. guard rejection rate.
5. runtime failure rate.
6. rework rate.
7. reviewer acceptance/disagreement rate.
8. latency percentiles.
9. citation fidelity and stale-reference rate for reference-heavy agents.
10. unsafe-advice or overconfidence rate for legal/regulatory agents.
11. confidence interval or confidence class.
12. last observation time and decay-adjusted score.

Anti-Goodhart rules:

1. No single global model score.
2. Preserve exploration quota so routing does not collapse to one winner.
3. Treat user override as weak evidence, not proof of quality.
4. Verification pass is necessary but not sufficient for high-risk work.
5. Specialist agents are penalized more for hallucinated citations, stale sources, and unsafe conclusion language than for latency.
6. Derived snapshots are rebuildable and must not be hand-edited.

### 13.3 Routing Integration

The selector may consume an `EvaluationSnapshot`, not raw unvalidated event logs. Routing order remains:

1. core hard bans and Policy Pack filters.
2. runtime compatibility.
3. provider-native usage freshness and availability.
4. capability, category, difficulty, and tier.
5. review diversity and human approval requirements.
6. evaluation/category-fit ranking among remaining eligible candidates.

If evaluation config is missing, malformed, stale, or points outside the workspace, DEX-managed workflows either ignore evaluation safely or fail closed according to Policy Pack. They must not silently load arbitrary external score files.

## 14. Selection Score

The model selector produces ranked candidates, not approvals.

Conceptual score:

```text
candidate_score =
  capability_fit
  + category_fit
  + difficulty_fit
  + freshness_bonus
  + performance_score
  + portfolio_balance_bonus
  - latency_penalty
  - reliability_penalty
  - reserve_penalty
```

Hard filters run before scoring:

1. Policy denied provider/model/agent.
2. Runtime unsupported model/agent/variant.
3. Missing capability for required agent profile.
4. Usage not dispatchable.
5. Minimum tier not met.
6. Review diversity impossible.

## 15. Multi-Model Critical Review

High-risk or critical workflows require independent review from multiple model families when usage permits.

Review lanes:

| Lane | Purpose | Preferred family |
|---|---|---|
| Policy/security reviewer | hard bans, secrets, unsafe actions | Claude or GPT high-tier |
| Architecture critic | coupling, maintainability, hidden assumptions | GPT high reasoning |
| Diversity reviewer | alternate reasoning style, frontend/UX or broad critique | Gemini latest Pro when available |

If a required review family is unavailable because usage is exhausted or unknown, DEX must not silently degrade to a single-family review. It must return safe feedback such as `refresh_usage`, `wait_until`, `reduce_scope`, or `human_approval_required`.

### 15.1 Review Diversity Requirements

Review diversity is a Guard requirement for high-risk and critical workflows, not an optional quality preference.

Default matrix:

| Workflow risk | Minimum reviewers | Minimum distinct providers | Minimum distinct model families | Required lanes |
|---|---:|---:|---:|---|
| `low` | 0 | 0 | 0 | none |
| `medium` | 1 | 1 | 1 | verifier or reviewer when scope is multi-file |
| `high` | 2 | 2 | 2 | policy/security plus architecture |
| `critical` | 3 | 3 when available, otherwise human approval | 3 when available, otherwise human approval | policy/security, architecture, diversity |

The matrix may be tightened by Policy Pack. It may not be weakened below core hard-ban and Guard requirements.

The selector must reserve enough high-tier capacity for required review lanes before spending that capacity on execution. If execution would consume the last dispatchable reviewer bucket needed for a pending high-risk review, the candidate receives a reserve penalty or is filtered out according to Policy Pack.

Reviewers must be independent from the executor for the reviewed attempt. Independence means a different attempt id, no shared hidden scratchpad, no self-approval, and a distinct model family when the diversity policy requires it. A model may not review its own execution output as the only approval lane.

### 15.2 Review Failure and Fallback Semantics

Review fallback follows the same authority model as execution fallback:

1. A failed or exhausted reviewer lane may select only from pre-approved reviewer candidates or trigger fresh usage acquisition plus Guard reselection.
2. If diversity becomes impossible after an execution step completes, DEX must quarantine the result until a valid review or human approval completes.
3. If a reviewer returns empty, stalls, or produces non-contract output, the lane is failed rather than counted as approval.
4. Conflicting review outcomes are resolved by stricter policy: any policy/security hard-ban finding blocks promotion unless a human explicitly overrides only where Policy Pack allows override.
5. Review results update category-fit and reliability scores only after their own execution echo and output contract are trusted.

## 16. Plugin Config Shape

The OpenCode plugin should read DEX config, not OMO config.

Example extension to `.conductor/config.json`:

```json
{
  "plugin": {
    "opencode": {
      "enabled": true,
      "commands": [
        "dex-plan",
        "dex-run",
        "dex-explain-route",
        "dex-doctor",
        "dex-status",
        "dex-resume",
        "dex-retry",
        "dex-abort",
        "dex-usage",
        "dex-audit",
        "dex-export-debug"
      ],
      "desired_command_aliases": [
        "/flowdesk:plan",
        "/flowdesk:run",
        "/flowdesk:explain-route",
        "/flowdesk:doctor",
        "/flowdesk:status",
        "/flowdesk:resume",
        "/flowdesk:retry",
        "/flowdesk:abort",
        "/flowdesk:usage",
        "/flowdesk:audit",
        "/flowdesk:export-debug"
      ],
      "managed_workflows_only": true,
      "chat_intake_mode": "blocking"
    }
  },
  "routing": {
    "model_freshness": {
      "prefer_latest_stable": true,
      "allow_preview_models": false
    },
    "usage_balancing": {
      "enabled": true,
      "reserve_high_tier_review_percent": 20,
      "prefer_underused_provider_when_score_delta_below": 0.08
    },
    "evaluation": {
      "enabled": true,
      "ledger_path": ".conductor/evaluation/events.jsonl",
      "snapshot_path": ".conductor/evaluation/category-fit.snapshot.json",
      "min_samples_before_penalty": 5,
      "decay_half_life_days": 45,
      "category_fit_weight": 0.25,
      "verification_weight": 0.35,
      "allow_negative_signal_immediately": true
    }
  },
  "agent_profiles": {
    "enabled_builtin_profiles": [
      "planner",
      "executor",
      "reviewer",
      "verifier",
      "document-specialist",
      "patent-specialist",
      "meddev-regulatory-specialist"
    ],
    "profile_registry_path": ".conductor/agent-profiles.json"
  },
  "reference_packs": {
    "enabled": true,
    "registry_path": ".conductor/reference-packs/registry.yaml",
    "packs": [
      "reference-packs/patent",
      "reference-packs/medical-device-software"
    ],
    "optional_connectors": {
      "korean_law_mcp": {
        "enabled": false,
        "mode": "mcp",
        "provenance_required": true,
        "snapshot_required_for_high_risk": true
      }
    }
  }
}
```

All fields must be schema-validated. Invalid plugin config fails closed for DEX-managed workflows. `chat_intake_mode` may be `blocking`, `observe_only`, or `off`; only `blocking` satisfies the chat-first MVP. `desired_command_aliases` are user-facing names to validate against the pinned OpenCode command parser. If colon aliases are not supported by the verified OpenCode version, the installer must expose portable configured command names such as `/flowdesk-plan` and document the fallback.

### 16.1 Config Versioning and Compatibility

The plugin config is an extension of `.conductor/config.json`; it is not a separate OMO-style config file.

Required compatibility rules:

1. Existing top-level fields such as `project_name`, `project_root`, `profile_type`, `governance`, `agents`, `model_policy`, `model_variants`, `usage`, `runtime_compatibility`, and transitional `agent_mapping` remain valid.
2. New plugin fields must be namespaced under `plugin.opencode` or explicit routing/evaluation namespaces.
3. New fields require schema versioning before they become required. Unknown privileged fields fail closed; unknown inert metadata fields may be ignored only if the schema marks them inert.
4. `agent_mapping` remains transitional compatibility. It must not become the authority for policy, review diversity, or provider-native usage.
5. Config cannot authorize OMO fallback, disable Guard, hide provider identity, skip final usage checks, skip execution echo when required, or disable audit lineage.
6. Config loaded through symlinks, parent-directory traversal, remote includes, or ambiguous project roots must fail closed unless explicitly supported by a future audited loader contract.

Schema migrations should be additive first: support current core fields, add plugin-specific validation, then introduce `CandidateModel[]` and richer routing contracts behind a versioned schema. Removal of transitional fields should require an ADR or migration note.

### 16.2 Implementation Gap Matrix

The design is ahead of the current implementation. The gap must be explicit so CLI/subprocess behavior is not mistaken for the plugin target.

| Area | Current implementation | Target design | Required change |
|---|---|---|---|
| User entrypoint | `dex-conductor dry-run`, `run`, `repl` CLI | OpenCode plugin + automatic blocking chat intake + configured `/flowdesk:*` commands where supported, with portable command fallbacks + plugin tools | Add `packages/opencode-plugin`; demote CLI to compatibility path; add command alias conformance tests |
| OpenCode runtime | `OpenCodeAdapter` shells out to `opencode run --model --agent --format json` | In-session plugin tools/hooks/events/client | Avoid nested `opencode run` for normal plugin workflows |
| Planner/router | fixed role route fields and static fallback lists | category/difficulty `CandidateModel[]` selector | Add category/difficulty fields and candidate chain contract |
| Agents | allowed string lists, ad hoc `AgentProfile` construction, and legacy `critic` compatibility fields | Agent Profile Registry with output contracts, tool bounds, reference scopes, canonical `reviewer` profile | Add registry schema, Policy Pack extension points, and explicit `critic` to `reviewer` migration/alias handling |
| Specialist domains | not implemented | patent and medical-device software regulatory profiles | Add bounded profiles, reference scopes, legal/regulatory output contracts |
| Reference knowledge | absent | versioned reference packs and optional MCP connectors | Add reference pack schemas, provenance validation, stale-source checks |
| Evaluation | static `ModelPerformance[]` input | append-only Evaluation Ledger + derived snapshots | Add `packages/evaluation` and routing snapshot input |
| DEX-2 harness | reference policy pack and example config | reusable concepts only, project paths stay project-specific | Move harness-only bans/settings into DEX2 Policy Pack; document boundaries |
| Docs | several CLI/OMO-era docs remain | OpenCode plugin-first path | Add supersession notes and follow-up ADR |

Implementation sequencing should treat this matrix as migration control. Do not remove the CLI path until the plugin path has equivalent Guard, usage, audit, verification, and evaluation coverage.

## 17. Audit Events

Add these audit events to the existing audit vocabulary:

1. `chat_intake_received`.
2. `chat_intake_classified`.
3. `workflow_auto_created_from_chat`.
4. `natural_language_approval_recorded`.
5. `plugin_command_received`.
6. `workflow_plan_requested`.
7. `workflow_category_assigned`.
8. `model_candidates_ranked`.
9. `reasoning_depth_selected`.
10. `usage_portfolio_balance_computed`.
11. `model_performance_observed`.
12. `category_fit_updated`.
13. `plugin_dispatch_blocked`.
14. `opencode_plugin_event_observed`.

Audit events must not contain raw prompt bodies, secrets, environment variables, auth headers, provider raw quota responses, raw tool arguments/results, stack traces, runtime echoes, or long transcripts. Store redacted artifact references instead.

The audit writer should be redaction-first: callers submit typed safe fields plus explicit artifact references, not arbitrary nested payloads to be scrubbed after the fact. Any event containing unknown nested objects, forbidden keys, prompt-like bodies, provider quota payloads, credential-shaped values, or transcript fragments must be rejected before write. Redaction failure blocks audit emission and therefore blocks privileged dispatch where audit lineage is required.

## 18. Migration from OMO

Migration target:

1. Remove `oh-my-openagent` / `oh-my-opencode` from OpenCode plugin configuration.
2. Add DEX Conductor OpenCode plugin entry.
3. Keep existing OpenCode provider authentication.
4. Keep project `.conductor/config.json` and Policy Pack as the DEX source of truth.
5. Regenerate or validate DEX runtime capability discovery.
6. Run `/flowdesk:doctor` before first dispatch.

DEX must not depend on `.opencode/oh-my-openagent.json[c]`, `.sisyphus/`, OMO task files, OMO skill files, or OMO team runtime directories.

### 18.1 Fresh Install Script Plan

The production install path should be a fresh OpenCode plugin setup, not an in-place OMO compatibility layer. The installer should make the target environment reproducible and fail closed before enabling DEX-managed workflows.

Required installer behavior:

1. Detect active OpenCode config files and create timestamped backups before mutation.
2. Remove `oh-my-openagent`, `oh-my-opencode`, OMO aliases, OMO local plugin paths, and OMO-owned config references from the target OpenCode plugin list.
3. Reject or require explicit user confirmation for unpinned plugin specs such as `@latest`, branch names, mutable local paths, or unreviewed third-party plugins in the same target config.
4. Disable OpenCode `autoupdate` for DEX-managed production profiles unless the update source, lockfile, and rollback plan are explicitly configured.
5. Install the FlowDesk plugin from a pinned package version, package tarball, or reviewed local build with lockfile/integrity metadata recorded.
6. Preserve provider authentication entries but re-run runtime capability discovery and provider-native usage checks before first dispatch.
7. Write or validate DEX-owned `.conductor/config.json`, Policy Pack path, runtime compatibility artifact path, audit path, and optional reference/evaluation paths.
8. Configure Markdown authoring support such as Marksman only as developer tooling. If an LSP mapping is needed, it should be recorded outside OMO-owned runtime config in the target environment, or documented as a local development harness setting that is not loaded by DEX at runtime.
9. Run `/flowdesk:doctor` after install and block automatic chat dispatch and `/flowdesk:run` until config schema validation, plugin provenance checks, capability discovery, final usage check, and Guard dry-run all pass.
10. Emit a migration report listing removed plugins, retained provider settings, pinned DEX package identity, OpenCode version/commit, and any skipped optional tooling.

The installer must not silently migrate OMO agents, OMO prompts, OMO skills, OMO team runtime files, or mutable `@latest` plugin dependencies into DEX. If the current user environment still needs OMO for unrelated work, the installer should support a separate OpenCode profile or require explicit confirmation before changing the global profile.

## 19. MVP Vertical Slice

> **FlowDesk status:** This section is historical context and is not the current Release 1 definition. Release 1 is defined in `../FLOWDESK_OPENCODE_PLUGIN_IMPLEMENTATION_SPEC.md` and `../IMPLEMENTATION_ROADMAP.md` as a chat-primary General-Use MVP with guarded command-backed routing, recovery, diagnostics, fallback commands, guarded dry-run, and fake-runtime dispatch only. Portable `/flowdesk-*` commands remain setup, status, recovery, diagnostics, and fallback controls; `/flowdesk:*` aliases require conformance.

Future chat-first target slice:

1. On a verified `blocking` chat-intake profile, every natural-language chat request passes through DEX automatic intake and is classified as `fast_chat`, `managed_plan`, `clarify`, or `blocked`. On `observe_only` or `off`, managed dispatch from natural chat is blocked and the user is directed to configured FlowDesk commands.
2. `fast_chat` returns normal conversational help without privileged dispatch, while preserving intake state when audit is enabled.
3. `managed_plan` automatically creates a Workflow Plan without requiring `/flowdesk:plan`.
4. The assistant explains the proposed plan and route in-chat before privileged action.
5. `/flowdesk:plan` and `/flowdesk:explain-route` provide explicit command access to the same plan/route state.
6. Auditable natural-language approval or `/flowdesk:run` dispatches one ordered step through OpenCode only after final usage check and Guard approval.
7. Execution echo is validated against approved agent/model/variant.
8. Verification command runs if configured.
9. `/flowdesk:status` shows current state, blocked reason, safe next actions, checkpoint, and audit reference.
10. Natural-language recovery choices and `/flowdesk:resume`, `/flowdesk:retry`, and `/flowdesk:abort` cover the minimum recovery loop.
11. Performance/evaluation event is appended.
12. Audit JSONL contains complete lineage.

This slice should use a fake OpenCode adapter test harness before real OpenCode plugin dispatch.

## 20. Open Questions

1. Should preview models be allowed by default, or only by Policy Pack opt-in?
2. What is the minimum reserve percentage for high-tier review capacity per provider?
3. How should category-fit scores decay when models are updated or renamed?
4. What is the minimum sample size before a model can be penalized for poor category fit?
5. Should user override be able to choose among Guard-approved, policy-eligible model candidates when usage is available but category-fit is poor?
6. Which OpenCode plugin event can provide the most trustworthy runtime echo for actual model and agent used?
7. What exact classifier threshold separates `fast_chat`, `managed_plan`, `clarify`, and `blocked`, and how should the assistant ask for confirmation when the intent is ambiguous?
8. Which high-risk approvals require typed command confirmation instead of natural-language approval in chat beyond the default critical-risk set in this document?

## 21. Summary

DEX Conductor should replace OMO in the target OpenCode environment with a smaller, policy-first plugin. The plugin should preserve normal OpenCode UX while adding DEX-managed Workflow Plans, category/difficulty routing, agent/model/reasoning-depth proposals, subscription-aware balanced model use, latest-model preference, accumulated performance evaluation, fail-closed guard approval, execution echo validation, and audit-complete verification.

The key distinction is authority: the main model proposes, the selector ranks, the adapter executes, but DEX Model Guard approves or blocks.
