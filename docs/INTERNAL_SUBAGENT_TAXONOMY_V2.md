# FlowDesk Internal Subagent Taxonomy V2

**Scope**: Internal subagents only. This does **not** define or replace `flowdesk-main`.
**Consumers**: current command-backed planning/status evidence, durable `workflow_dispatch_plan` session evidence, `flowdesk.workflow_dispatch_plan.v1`, optional opt-in `flowdesk_workflow_dispatch_plan` planning evidence, separate dev-mode one-task `flowdesk_workflow_dispatch` E2E evidence, and separate dev/beta controlled write ledger evidence.
**Date**: 2026-05-26

> Release 1 note: this taxonomy is a design and registry contract for internal subagent roles. It does not authorize default real OpenCode subtask/model/provider launches or default file writes in Release 1. The dev-mode `flowdesk_workflow_dispatch` E2E path is a separate explicit opt-in beta exception for exactly one actual lane launch with per-call allow flags and non-authorizing durable evidence; it does not grant write-capable execution, provider/model fallback or reselection, controlled write/apply, or default dispatch authority. The dev/beta `flowdesk_controlled_write_apply` path is also separate and explicit opt-in: it applies only one bounded workspace-relative full-file replacement after per-call acknowledgement, approval ref, allow flag, path/hash checks, and durable ledger recording. It is not automatic model-output apply and does not grant default Release 1 write, provider, runtime, lane, fallback, or dispatch authority. Any production real dispatch, write-capable subagent execution, or provider/model reselection remains later-gate work requiring conformance evidence, fresh provider evidence where applicable, durable audit, and explicit Guard approval.

---

## 1. Design Principles

1. **Main stays coordinator-only**.
   - Main plans, records command-backed workflow intent, and summarizes evidence.
   - Main does not directly implement, review, explore, or run broad investigation.
   - Main may perform intake, task classification, plan/evidence recording, Guard handoff, status synthesis, and user-facing summarization.
   - Main must not act as a hidden reviewer lane, implementation lane, verifier lane, dispatch approver, provider/model fallback authority, or substitute for Guard approval.

2. **Subagents are role-specialized**.
   - Agent identity is based on work role, not provider/model.
   - Model is selected dynamically per task from eligible models.

3. **Models are selected by guarded eligibility and bounded scoring**.
   - Inputs: usage headroom, model availability, historical performance, task fit, risk tier.
   - Release 1 must not perform evaluation-based ranking for production authority.
   - No automatic provider/model fallback or reselection outside explicit later-gate FlowDesk rules and Guard approval.

4. **Evidence-first**.
   - Every planned or simulated lane should produce task result / verdict / lifecycle / heartbeat evidence as applicable.
   - Outputs are evidence, not authority.

5. **No OMO / no nested `opencode run` / no hidden injection**.
   - Do not use OMO code, runtime patterns, prompt/prefix injection, unsupported hard chat control, or nested OpenCode execution.

---

## 2. OMO Comparative Reference Boundary

The OMO subagent design may be used only as a **comparative checklist**. FlowDesk may learn from general concepts such as:

1. role-specialized internal agents;
2. explicit handoff contracts;
3. permission-bounded profiles;
4. registry-driven routing; and
5. concise task-result summaries.

FlowDesk must not copy, import, adapt, or depend on:

1. OMO source code, prompts, constants, naming schemes, or runtime files;
2. hidden prompt/prefix injection;
3. OMO runtime orchestration patterns;
4. nested `opencode run`; or
5. implicit agent authority that bypasses FlowDesk Guard, durable evidence, or OpenCode conformance gates.

Any OMO-inspired idea must be restated as a FlowDesk-native requirement and checked against Release 1 non-dispatch constraints before implementation.

---

## 3. Taxonomy Overview

| Agent ID | Category | Primary Purpose | Write Access |
|---|---|---|---|
| `agent-docs-writer` | documentation | docs, README, changelog, user guide | later-gate scoped docs-only |
| `agent-explorer-researcher` | exploration | codebase/API/research exploration | no |
| `agent-git-master` | git | git status/diff/log/commit planning | later-gate explicit only |
| `agent-code-backend` | implementation | backend/service/CLI/SDK logic | later-gate scoped |
| `agent-code-frontend` | implementation | UI/UX/frontend/status card work | later-gate scoped |
| `agent-code-language-specialist` | implementation | language-specific coding | later-gate scoped |
| `agent-critical-reviewer` | review | critical review, regression/risk finding | no |
| `agent-architecture` | architecture | system/module/API design | no by default |
| `agent-oracle-decision` | decision | synthesize conflicting lanes, make recommendation | no |
| `agent-verifier-testing` | verification | tests, reproduction, validation | no edit; bash tests allowed |
| `agent-security-policy` | security | threat model, permission, redaction, policy | no |
| `agent-performance` | performance | latency/cost/quota/bottleneck analysis | no edit; benchmark allowed |
| `agent-migration-refactor` | migration | refactor/migration plan and scoped patches | later-gate scoped |

In Release 1, the `Write Access` column describes future permission intent only. Release 1 may record plans, fake-runtime/degraded lane summaries, command-backed evidence, explicit dev-mode one-task lane evidence, or explicit dev/beta controlled write ledger evidence, but it must not treat these roles as authority for automatic edits, model-output apply, provider/model fallback, or default real dispatch.

---

## 4. Agent Contracts

### 4.1 `agent-docs-writer`

- **Use when**: documentation, README, changelog, release note, runbook, user manual.
- **Do not use when**: policy approval, security sign-off, code implementation.
- **Input**: feature summary, audience, source refs, required sections, forbidden claims.
- **Output**: doc patch proposal, assumptions, missing facts, final markdown/diff summary.
- **Permissions**: read, grep/glob, edit only docs/README/changelog paths.
- **Model fit**: strong writing and synthesis; GPT/Claude preferred.

### 4.2 `agent-explorer-researcher`

- **Use when**: unknown code path, API surface discovery, implementation option research.
- **Do not use when**: final approval, broad edits.
- **Input**: research question, repo scope, allowed external URLs.
- **Output**: entry points, files/symbols, findings, uncertainty, next probes.
- **Permissions**: read, grep/glob, codegraph, optional webfetch.
- **Model fit**: long context + code navigation; Gemini/GPT/Claude depending quota.

### 4.3 `agent-git-master`

- **Use when**: status/diff/log analysis, commit scope planning, PR checklist.
- **Do not use when**: user did not request commit/push; destructive git operations.
- **Input**: intended scope, base branch, commit policy.
- **Output**: changed file grouping, risk summary, commit message draft, PR notes.
- **Permissions**: git read by default; commit/push only explicit user approval.
- **Model fit**: precise diff reasoning; GPT/Claude preferred.

### 4.4 `agent-code-backend`

- **Use when**: server logic, CLI, persistence, SDK integration, TypeScript backend.
- **Do not use when**: frontend-only UI, policy approval.
- **Input**: target behavior, files/symbols, constraints, test command.
- **Output**: patch summary, touched files, tests run, residual risks.
- **Permissions**: scoped read/edit, targeted bash tests/build.
- **Model fit**: strong code model; Claude/GPT preferred.

### 4.5 `agent-code-frontend`

- **Use when**: UI, status cards, React/CSS, interactive surfaces.
- **Do not use when**: backend authority or security logic.
- **Input**: UX goal, components, state requirements, accessibility constraints.
- **Output**: UI patch summary, visual/accessibility notes, test/build result.
- **Permissions**: scoped read/edit, frontend build/test.
- **Model fit**: GPT/Claude; Gemini if large UI context.

### 4.6 `agent-code-language-specialist`

- **Use when**: task is strongly tied to a language/runtime.
- **Options**: `typescript`, `python`, `rust`, `go`, `shell`, `sql`, `docs-as-code`.
- **Input**: language, runtime, target files, style constraints.
- **Output**: implementation patch/snippet, language caveats, tests.
- **Permissions**: scoped edit + language compiler/test commands.
- **Model fit**: selected by historical language performance.

### 4.7 `agent-critical-reviewer`

- **Use when**: design/code/PR needs adversarial review.
- **Do not use when**: implementation is requested.
- **Input**: diff/design target, severity rubric, evidence refs.
- **Output**: findings with severity, file/line refs, verdict, required fixes.
- **Permissions**: read-only.
- **Model fit**: Claude Opus/GPT/Gemini multi-perspective if available.

### 4.8 `agent-architecture`

- **Use when**: module boundaries, plugin architecture, API design, workflows.
- **Do not use when**: small bug fix or test-only change.
- **Input**: problem, constraints, current structure, options requested.
- **Output**: recommended architecture, alternatives, tradeoffs, migration steps.
- **Permissions**: read-only by default.
- **Model fit**: Claude/GPT frontier.

### 4.9 `agent-oracle-decision`

- **Use when**: lanes disagree, user wants final recommendation, tradeoff choice.
- **Do not use when**: raw implementation, security override.
- **Input**: competing lane outputs, decision criteria, risk tolerance.
- **Output**: decision, rationale, dissent, required follow-up evidence.
- **Permissions**: read-only synthesis.
- **Model fit**: GPT frontier / Claude Opus; high reasoning score.

### 4.10 `agent-verifier-testing`

- **Use when**: test plan, failing test analysis, reproduction, verification.
- **Do not use when**: feature design or broad implementation.
- **Input**: expected behavior, changed files, allowed commands.
- **Output**: test plan, commands run, pass/fail, reproduction notes.
- **Permissions**: read + bash test commands; edit denied.
- **Model fit**: GPT/Claude; low hallucination preferred.

### 4.11 `agent-security-policy`

- **Use when**: permission, provider dispatch, redaction, auth, threat model.
- **Do not use when**: performance/UI-only work.
- **Input**: workflow/action, data classes, permission changes, provider use.
- **Output**: policy verdict, risks, required guard checks, redaction notes.
- **Permissions**: read-only, no network unless explicitly approved.
- **Model fit**: Claude Opus first; GPT frontier second.

### 4.12 `agent-performance`

- **Use when**: latency, cost, memory, quota, fan-out efficiency.
- **Do not use when**: security approval or generic docs.
- **Input**: workload, traces/logs, target metrics, bottleneck hypothesis.
- **Output**: bottleneck analysis, benchmark plan, optimization candidates.
- **Permissions**: read + benchmark/test commands.
- **Model fit**: GPT/Claude; Gemini for large logs if quota allows.

### 4.13 `agent-migration-refactor`

- **Use when**: schema migration, module split, legacy cleanup, rename plan.
- **Do not use when**: greenfield feature without migration constraints.
- **Input**: old/new shape, compatibility requirements, rollback constraints.
- **Output**: stepwise migration plan, patch sequence, rollback notes.
- **Permissions**: scoped edit optional; destructive git denied.
- **Model fit**: Claude/GPT; conservative edit behavior preferred.

---

## 5. Workflow Dispatch Routing

### 5.1 Classification → Agent

Release 1 interpretation: classification maps user intent to command-backed planning records and fake-runtime/degraded lane summaries. The mapping below becomes real subagent dispatch only after a later gate proves trusted binding, trusted runtime echo, sufficient telemetry, fresh usage/health evidence where required, durable pre-dispatch audit, and Guard approval.

| Classification | Primary Agent | Companion Agents |
|---|---|---|
| documentation | `agent-docs-writer` | `agent-critical-reviewer` for public docs |
| exploration | `agent-explorer-researcher` | `agent-architecture` |
| git | `agent-git-master` | `agent-critical-reviewer` before commit/PR |
| backend-code | `agent-code-backend` | `agent-verifier-testing`, `agent-critical-reviewer` |
| frontend-code | `agent-code-frontend` | `agent-verifier-testing`, `agent-critical-reviewer` |
| language-code | `agent-code-language-specialist` | backend/frontend reviewer as applicable |
| critical-review | `agent-critical-reviewer` | `agent-security-policy` if sensitive |
| architecture | `agent-architecture` | `agent-oracle-decision` if alternatives conflict |
| decision | `agent-oracle-decision` | source lanes only |
| verification | `agent-verifier-testing` | code agent only if fixes requested |
| security-policy | `agent-security-policy` | oracle for synthesis only |
| performance | `agent-performance` | verifier for benchmarks |
| migration-refactor | `agent-migration-refactor` | reviewer + verifier |

### 5.2 Model Scoring

Release 1 interpretation: this formula is a design-time heuristic for planning and diagnostics only. It must not be used as production evaluation-based ranking authority or automatic provider/model fallback. Later gates must define authority, evidence freshness, and policy eligibility before using model scoring to launch real lanes.

```text
score =
  0.35 * task_fit +
  0.20 * historical_success +
  0.15 * context_fit +
  0.10 * usage_headroom +
  0.10 * latency_cost_fit +
  0.10 * risk_suitability -
  failure_penalty
```

`historical_success` is allowed only as a redacted, local, bounded planning metric derived from prior FlowDesk evidence such as terminal status, verifier pass/fail summaries, timeout/error categories, and user-accepted completion records. It must not include raw prompts, raw transcripts, credentials, private file contents, or external evaluation ledgers in Release 1. Missing, stale, malformed, or policy-ineligible scoring inputs must fail closed to “no preference” rather than silently selecting a model.

### 5.3 Candidate Filter

A model is eligible only if:

- registered in OpenCode profile
- exact model id is available
- provider auth/usage evidence exists or is not required for dry-run
- usage is not exhausted
- policy pack allows it for the task class
- runtime mapping exists
- explicit Guard approval exists for any real dispatch or reselection

### 5.4 Role Overlap and Precedence

When classifications overlap, use the most safety-critical route first:

1. **Security/policy first** for permissions, redaction, auth, provider use, dispatch, fallback/reselection, external writes, or controlled file writes.
2. **Verification before completion** when the task claims behavior changed, tests passed, or a bug is fixed.
3. **Architecture before implementation** when module boundaries, public APIs, persistence contracts, or workflow semantics change.
4. **Critical review before user-ready claims** for public docs, release notes, agent prompts, workflow dispatch, and later-gate authority changes.
5. **Oracle/decision only after source lanes** when reviews conflict or the user asks for a tradeoff recommendation.

No role may override Guard, promote dispatch, approve fallback/reselection, mark a reviewer verdict accepted, or convert advisory output into authority. `agent-oracle-decision` may summarize and recommend, but it cannot approve security, dispatch, write, or release gates.

### 5.5 Role → Evidence Matrix

| Agent ID | Release 1 evidence | Later-gate evidence additions | Terminal expectation |
|---|---|---|---|
| `agent-docs-writer` | `task_result`, `lane_lifecycle`, optional `lane_heartbeat` | patch summary refs, docs verification refs | `incomplete` for advisory docs output; later `complete` only when a gated writer records accepted artifacts |
| `agent-explorer-researcher` | `task_result`, `lane_lifecycle`, optional `lane_heartbeat` | research artifact refs | `incomplete` unless a typed research-output contract is added |
| `agent-git-master` | `task_result`, `lane_lifecycle` | commit/PR approval refs, redacted git audit refs | advisory until explicit user-approved git action evidence exists |
| `agent-code-backend` | planning/fake-runtime `task_result`, `lane_lifecycle` | patch refs, test refs, verifier result refs, controlled-write audit | later-gate only for real edits |
| `agent-code-frontend` | planning/fake-runtime `task_result`, `lane_lifecycle` | patch refs, build/accessibility refs, visual verification refs | later-gate only for real edits |
| `agent-code-language-specialist` | planning/fake-runtime `task_result`, `lane_lifecycle` | language compiler/test refs, patch refs | later-gate only for real edits |
| `agent-critical-reviewer` | `reviewer_verdict` when typed verdict is accepted; otherwise `task_result` + `lane_lifecycle` as incomplete | multi-perspective acceptance refs, durable linkage refs | `complete` only after typed verdict validation and linkage |
| `agent-architecture` | `task_result`, `lane_lifecycle` | architecture decision refs | advisory unless promoted by user/Guard process |
| `agent-oracle-decision` | `task_result`, `lane_lifecycle` | decision record refs | advisory recommendation only |
| `agent-verifier-testing` | `task_result`, `lane_lifecycle`, command summary refs when available | typed verification result refs, artifact refs | pass/fail claims require explicit command or artifact evidence |
| `agent-security-policy` | `task_result` or typed policy review result, `lane_lifecycle` | Guard decision refs only from Guard, not from the lane | advisory unless Guard separately approves |
| `agent-performance` | `task_result`, `lane_lifecycle`, benchmark summary refs when available | benchmark artifact refs | advisory unless benchmark evidence is durable |
| `agent-migration-refactor` | planning/fake-runtime `task_result`, `lane_lifecycle` | migration patch refs, rollback refs, verification refs | later-gate only for real edits |

---

## 6. Agent Registry Contract Sketch

`agent_registry.v1` exists in core as a standalone validation contract before real `workflow_dispatch` implementation. `flowdesk.workflow_dispatch_plan.v1` now consumes registry role categories/agent refs for planning-only task graphs without authorizing runtime launch. Minimum registry fields:

```typescript
interface FlowDeskAgentRegistryEntryV1 {
  schema_version: "flowdesk.agent_registry_entry.v1";
  agent_id: string; // stable FlowDesk id, e.g. agent-security-policy
  role_category: "documentation" | "exploration" | "git" | "implementation" | "review" | "architecture" | "decision" | "verification" | "security" | "performance" | "migration";
  release_gate: "release1_planning_only" | "later_gate_read_only" | "later_gate_scoped_write";
  description_label: string;
  use_when: string[];
  do_not_use_when: string[];
  allowed_actions: string[];
  forbidden_actions: string[];
  permission_profile_ref: string;
  input_contract_ref: string;
  output_contract_ref: string; // one of the contract refs below
  required_evidence_classes: string[];
  optional_evidence_classes: string[];
  model_eligibility_policy_ref: string;
  default_runtime_agent_ref?: string;
  fallback_allowed: false;
  dispatch_authority_enabled: false;
  redaction_version: "v1";
}
```

Registry invariants:

1. `agent_id` must be stable, lowercase, and FlowDesk-owned.
2. `release_gate` must prevent accidental real dispatch from Release 1 planning records.
3. `allowed_actions` are descriptive until backed by active OpenCode permission enforcement.
4. `forbidden_actions` must include hidden injection, nested `opencode run`, automatic provider/model fallback, and authority claims for every entry.
5. `output_contract_ref` must distinguish free-form `task_result` from typed verdict/verification/policy contracts.
6. Registry migration must be additive or versioned; existing evidence must remain reloadable.
7. Multi-perspective reviewer lanes may be used as acceptance evidence only when completion-wait succeeds, typed verdict validation succeeds, durable `reviewer_verdict` evidence is written, complete terminal `lane_lifecycle` evidence is written, and status reload projects the lane as terminal/complete. If any prerequisite is missing, aborted, malformed, stale, or still running, classify the review as incomplete rather than approval.
8. Stale or restarted workflows may require evidence-only abort/backfill to stop misleading stall projections. Those cleanup records are recovery evidence only and must not be treated as review approval or reviewer acceptance.
9. `dispatch_authority_enabled` and `fallback_allowed` must remain `false`; role, contract, evidence, permission, and descriptive strings must not smuggle Guard approval, dispatch approval, fallback, hard chat control, provider payload, runtime execution, actual lane launch, nested `opencode run`, or hidden-injection authority.

### 6.1 Output Contract Refs

Core registry validation recognizes these redaction-safe output contract refs:

| Ref | Meaning | Evidence expectation |
|---|---|---|
| `contract-task-result-v1` | Free-form/advisory task result. | `task_result` or `task_failed`, usually with `lane_lifecycle`. |
| `contract-reviewer-verdict-v1` | Typed reviewer verdict result. | `reviewer_verdict` plus terminal `lane_lifecycle`. |
| `contract-verification-result-v1` | Typed verification result. | `verification_result` placeholder or `task_result`, plus `lane_lifecycle`. |
| `contract-policy-review-result-v1` | Typed policy/security review result. | `policy_review_result` placeholder or advisory `task_result`, plus `lane_lifecycle`. |
| `contract-architecture-decision-result-v1` | Typed architecture decision result. | `architecture_decision_result` placeholder or advisory `task_result`, plus `lane_lifecycle`. |
| `contract-migration-plan-result-v1` | Typed migration plan result. | `migration_plan_result` placeholder or advisory `task_result`, plus `lane_lifecycle`. |

The typed verification, policy review, architecture decision, and migration plan contracts are placeholders until implemented as concrete durable evidence schemas. Until then, they are registry-level compatibility markers only; they do not authorize dispatch, verification acceptance, Guard approval, fallback/reselection, writes, or OpenCode agent file materialization.

### 6.2 Workflow Dispatch Planning Contract

Core now includes `flowdesk.workflow_dispatch_plan.v1` as a Release 1-safe planning contract. It is not a provider caller and not a runtime launcher. Durable session evidence accepts this contract as the `workflow_dispatch_plan` evidence class under `.flowdesk/sessions/<workflow>/evidence/workflow-dispatch-plan`, and status live reports the latest plan revision/task count. The optional server helper `flowdesk_workflow_dispatch_plan` can be registered only with `workflowDispatchPlanTool.enabled=true` plus a configured durable state root; it evaluates through this core contract, persists only planning evidence, and keeps dispatch/provider/runtime/lane/fallback/tool authority false. The contract records:

1. `workflow_id`, `plan_revision_id`, and redacted `requested_goal_summary`.
2. `selected_agent_roles[]` with `agent_role` and optional `agent_role_ref`/`registry_entry_ref` hints.
3. `tasks[]` with `task_id`, `title`, `summary`, `agent_role`, optional `agent_role_ref`, and dependency ids.
4. `task_graph_summary`.
5. `model_selection_diagnostics` refs/labels only, with `scoring_authority_enabled: false` and `fallback_or_reselection_allowed: false`.
6. hard false authority flags: `dispatch_authority_enabled`, `provider_call_made`, `runtime_execution`, and `actual_lane_launch`.

Validation rejects unknown properties, invalid role categories, registry-mismatched `agent_role_ref` values when a registry is supplied, authority-smuggling language, provider/model fallback or reselection wording, runtime launch refs, and any true dispatch/provider/runtime/lane-launch flag. The evaluator returns only an inert planning artifact and runtime flags set false. Durable reload uses the same validator and does not infer lane execution from a planning record.

### 6.3 Role/Evidence Compatibility

Registry validation enforces the current minimum compatibility rules:

1. Review roles must use `contract-reviewer-verdict-v1` or explicitly advisory `contract-task-result-v1`; advisory review entries must not require `reviewer_verdict` evidence.
2. Verification roles must require `lane_lifecycle` and either `task_result` or the placeholder `verification_result` evidence class.
3. Implementation roles must be `release1_planning_only` or `later_gate_scoped_write`; Release 1 entries must not require real patch/write evidence.
4. Security roles may use `contract-policy-review-result-v1` or advisory `contract-task-result-v1`, but their output or permission refs must not claim Guard approval or dispatch approval authority.
5. Every role must require `lane_lifecycle` or a terminal-equivalent evidence class such as `task_result`, `task_failed`, `reviewer_verdict`, `verification_result`, `policy_review_result`, `architecture_decision_result`, or `migration_plan_result`.

---

## 7. OpenCode Agent File Compatibility

Actual agent files should use only schema-supported frontmatter:

```yaml
---
description: Internal FlowDesk architecture subagent.
mode: subagent
model: openai/gpt-5.5
permission:
  edit: deny
  bash: ask
---

Prompt body goes here.
```

Metadata like `input_contract`, `output_contract`, `allowed_workflows`, and model scoring profile should live in FlowDesk registry/docs, not unknown frontmatter fields.

Agent files must not claim permissions that the active OpenCode profile does not actually enforce. Permission boundaries are per-agent and per-action, and Release 1 must prefer read-only or command-backed records unless a later gate explicitly promotes write-capable execution.

### 7.1 Materialized Project Agent Profiles

The following Release 1-safe profiles are materialized under `.opencode/agent/` as project-local OpenCode agent files. They are conservative advisory subagents: `mode: subagent`, `edit: deny`, no runtime/provider launch instructions, no hidden injection, no nested OpenCode CLI execution, and no fallback/reselection authority. OpenCode must be restarted before newly added or changed project agent files are loaded by the active profile.

| OpenCode profile file | Taxonomy agent id | Runtime posture |
|---|---|---|
| `.opencode/agent/flowdesk-docs-writer.md` | `agent-docs-writer` | read-only advisory docs proposals |
| `.opencode/agent/flowdesk-explorer-researcher.md` | `agent-explorer-researcher` | read-only repository/API research |
| `.opencode/agent/flowdesk-git-master.md` | `agent-git-master` | advisory git analysis; bash ask for non-mutating inspection |
| `.opencode/agent/flowdesk-code-backend.md` | `agent-code-backend` | read-only backend patch planning |
| `.opencode/agent/flowdesk-code-frontend.md` | `agent-code-frontend` | read-only frontend patch planning |
| `.opencode/agent/flowdesk-code-language-specialist.md` | `agent-code-language-specialist` | read-only language/runtime specialist planning |
| `.opencode/agent/flowdesk-critical-reviewer.md` | `agent-critical-reviewer` | read-only adversarial review |
| `.opencode/agent/flowdesk-architecture.md` | `agent-architecture` | read-only architecture analysis |
| `.opencode/agent/flowdesk-oracle-decision.md` | `agent-oracle-decision` | read-only recommendation synthesis |
| `.opencode/agent/flowdesk-verifier-testing.md` | `agent-verifier-testing` | edit denied; bash ask for bounded tests/verification |
| `.opencode/agent/flowdesk-security-policy.md` | `agent-security-policy` | read-only security/policy review |
| `.opencode/agent/flowdesk-performance.md` | `agent-performance` | edit denied; bash ask for bounded benchmark/test analysis |
| `.opencode/agent/flowdesk-migration-refactor.md` | `agent-migration-refactor` | read-only migration/refactor sequencing |

The materialized filenames intentionally mirror registry intent but are not registry evidence and do not enable real dispatch. Registry identifiers, output contracts, role categories, model scoring policy, and evidence requirements remain in FlowDesk docs/core contracts rather than unsupported OpenCode agent frontmatter.

---

## 8. Implementation Phases

| Phase | Deliverable |
|---|---|
| 1 | Agent registry schema + this taxonomy in docs |
| 2 | Typed output contracts + result aggregation prerequisites for review, verification, policy, and task-result lanes |
| 3 | Core planning records can carry registry-backed `agent_role`/`agent_role_ref` hints inside `flowdesk.workflow_dispatch_plan.v1`; `/flowdesk-plan` public request integration remains deferred |
| 4 | Release 1-safe workflow-dispatch planning contract/evaluator exists for registry role selection and diagnostic model-selection refs without authority; durable `workflow_dispatch_plan` session evidence, status visibility, and an optional opt-in `flowdesk_workflow_dispatch_plan` evidence writer exist; fake-runtime/degraded lane evidence emission and richer task-graph status aggregation remain deferred |
| 5 | Terminal reviewer acceptance projection and richer workflow-level task graph status projection |
| 6 | Release 1-safe project-local agent files materialized for all taxonomy roles with advisory/read-only defaults; OpenCode restart required before active profile load |
| 7 | Verifier/performance agents with bounded bash test/benchmark permissions behind explicit approval |
| 8 | Scoped write agents: backend, frontend, language specialist, migration/refactor as later-gate work only |
| 9 | model scorer: usage + performance + fit for diagnostics/planning until later-gate authority exists |
| 10 | git-master guarded commit/PR workflow |

---

## 9. Recommended Next Implementation

1. Add concrete durable evidence schemas for typed verification, policy review, architecture decision, and migration plan outputs.
2. Decide whether `/flowdesk-plan` should expose a public `agentRole` field or keep role hints internal to workflow-dispatch planning artifacts.
3. Decide whether a local-adapter command-backed workflow should consume `flowdesk.workflow_dispatch_plan.v1` directly or keep the opt-in server helper as the only writer for now.
4. Implement later task-graph planning/status expansion that:
    - classifies request
    - selects subagents
    - records model eligibility/scoring diagnostics without using them as production authority
    - emits fake-runtime/degraded lane evidence unless later-gate real dispatch is approved
    - aggregates `summaryForUser`
5. Expand status beyond latest plan revision/task count only if a user-facing task-graph summary is needed.
6. Materialize read-only agent files under `.opencode/agent/` or global profile only after the registry, output contracts, planning validation, and status acceptance projection are in place.
7. Separately design the later-gate promotion path for real subagent dispatch and write-capable agents.
