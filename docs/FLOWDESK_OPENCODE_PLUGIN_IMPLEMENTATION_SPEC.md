# FlowDesk for opencode Plugin Implementation Specification

## 1. Project Identity

Project name: **FlowDesk**

Public name: **FlowDesk for opencode**

Repository slug: `flowdesk`

OpenCode plugin id: `flowdesk`

Primary npm package: `@flowdesk/opencode-plugin`

User-facing command family: desired aliases `/flowdesk:*`, with portable fallbacks such as `/flowdesk-plan`, `/flowdesk-run`, and `/flowdesk-doctor` when the pinned OpenCode command parser does not support colon aliases.

Documentation should lead with portable commands until conformance proves colon aliases. FlowDesk commands use the `/flowdesk` namespace.

Project data root: `.flowdesk/`. A future migration utility may read legacy `.conductor/` configs, but new FlowDesk projects write `.flowdesk/` by default.

Initial OpenCode API research snapshot: `anomalyco/opencode` commit `c43edc5b71a2b1aedd8159ed4b547edc4c97606f`, verified on 2026-05-15. A later isolated OpenCode 1.14.40 PoC is summarized in `conformance/2026-05-15-opencode-1.14.40-poc.md` and supports a scoped Release 1 General-Use MVP with chat-routed command-backed workflows, while leaving hard chat interception and real external-provider trusted echo gated.

FlowDesk is a new OpenCode-plugin-first project. It may reuse concepts and contracts from `dex-conductor`, but it is not an OMO compatibility layer and not a CLI-first subprocess wrapper.

## 2. Status and Scope

This document is a pre-implementation development specification. It defines the first implementation contract before code is written in the new project folder.

The spec incorporates the current OpenCode-plugin-first FlowDesk design:

1. OMO is removed from the target runtime.
2. OpenCode chat is the Release 1 primary UX. Release 1 may expose chat routing through proven message mutation and throw behavior, but not hard no-reply/cancel interception.
3. Automatic real natural-language managed dispatch is supported only when a verified blocking OpenCode chat-intake capability exists. Release 1 chat routing may wrap or route requests toward FlowDesk command-backed flows without claiming hard interception.
4. FlowDesk Guard is the sole dispatch authority.
5. `/flowdesk:*` and portable `/flowdesk-*` commands are setup, status, recovery, diagnostics, and fallback controls, not the primary UX.
6. Plugin-managed workflows must not use nested `opencode run` as a production orchestration mechanism. Production orchestration must use conformance-proven internal OpenCode command lanes with `subtask: true`, or an injected SDK/client path, with explicit `agent` and concrete provider-qualified `model` binding in both cases.
7. Patent, legal, and medical-device regulatory capabilities are source-grounded research helpers, not professional advice or signoff engines.
8. Release 1 must not rely on broad invisible prefix injection. Chat routing may classify and steer, but it must not secretly rewrite most ordinary user input or imply that FlowDesk fully handled the turn unless blocking chat intake is conformance-proven.

Release 1 is a **General-Use MVP with chat-routed command-backed workflows**: install, doctor, natural-language chat routing into guarded command-backed plan/run/status/recovery/diagnostic flows, delegated workflow authoring records, guarded dry-run, fake-runtime dispatch, redacted audit, provider health diagnostics, abnormal-use manual guidance, hook harness enforcement or observation, lane observability summaries, and conformance reporting. Real OpenCode dispatch, hard chat interception, automatic model/provider fallback, evaluation scoring authority, and specialist reference-pack workflows are later release gates unless explicitly promoted by a follow-up spec revision. Release 1 may scaffold workflow taxonomy, proposal, provider health, fallback decision, and evaluation event schemas, but those schemas must not rank work as an approval path, switch providers, switch models, or enable real dispatch.

Release 1 chat routing uses a conservative intent model. Internally, implementations should distinguish general chat that FlowDesk leaves alone, likely FlowDesk-related requests that receive transparent suggestion-only guidance, explicit/high-confidence FlowDesk requests that enter command-backed management, and later-gate unsafe requests that block only the FlowDesk route. These internal states are product implementation details, not authority. User-facing experiences should present a visible FlowDesk card or guidance such as “FlowDesk로 정리”, “계획 보기”, “실행 전 확인”, and “진단” rather than hidden prompt prefixes or internal labels. Execution-like natural language must create a confirmation-required or plan-ready state before any guarded dry-run or fake-runtime evaluation occurs.

### 2.1 Final Target Feature Contract Rule

All implementation work must be traced to a final target feature and to the release gate that permits it. A feature is not implementation-ready until this specification or a newer ADR defines its authority boundary, exact input/output contract, persistent schema if any, conformance requirement, failure behavior, redaction rule, and user-facing promise.

| Final target feature | Release gate | Required contract before implementation |
|---|---|---|
| User-first chat intake and steering | Release 1 | `chat_intake_mode`, mutation/throw conformance, safe fallback command path, redacted intake envelope |
| Portable command-backed controls | Release 1 | Static command templates, command-to-tool mapping, tool schemas, alias conformance gating |
| Installer/bootstrap and doctor | Release 1 | Bootstrap authority, profile mutation confirmation, doctor result categories, rollback/report schema |
| Guarded planning and dry-run | Release 1 | Plan schema, Guard request/response schema, non-dispatch permission classes, audit ordering |
| Workflow authoring delegation | Release 1 | Main-agent minimal routing contract, lane contract, typed summary schema, redacted lane refs, failure classes, degraded fallback behavior |
| Fake-runtime execution | Release 1 | Fake runtime output schema, deterministic echo evidence, verification summary schema |
| Workflow state, checkpoint, recovery | Release 1 | Workflow/attempt/checkpoint schemas, transition table, lock semantics, atomic writes, corruption handling |
| Redacted audit and debug export | Release 1 | Allowed event fields, forbidden persisted payload enforcement, export manifest, retention/deletion behavior |
| Usage readiness | Release 1 for display and future gating | Usage snapshot schema, freshness TTL, unknown/stale/refused/shared-limit fail-closed rules |
| Provider health diagnostics | Release 1 for display and future gating | Provider Health Snapshot schema, failure class vocabulary, redacted status/doctor/usage display, diagnostic-only Release 1 behavior |
| Hook harness containment | Release 1 | Harness modes, supported hook surfaces, fail-closed behavior, off-mode safe fallback |
| Subagent lane observability | Release 1 | Status card or command summary schema, openable reference conformance gate, event/log/debug ref schema, redaction rules, fallback commands |
| OpenCode conformance | Release 1 and every later release | Compatibility artifact, evidence matrix, schema-conversion gate, release-mode disable rules |
| Real OpenCode dispatch | Release 2+ | Trusted binding, trusted runtime echo, sufficient telemetry, fresh usage, Guard approval, durable pre-dispatch audit |
| Internal agent/model lane routing | Release 2.5 or Release 3 entry | OpenCode `subtask: true` command lane or injected SDK/client path, explicit agent id, concrete provider-qualified model id, binding registry entry, runtime echo, telemetry persistence, no nested `opencode run`, Guard-compatible override policy |
| Top-tier multi-perspective reviewer lanes | Release 2.5 or Release 3 entry | Canonical `reviewer` profile extensions for every registered highest-tier available reviewer/model binding in the active FlowDesk registry; when only one highest-tier model is registered, multiple reviewer agents or perspective bindings may share that model, with provider-qualified concrete model ids, fresh auth/usage/quota evidence, runtime echo, telemetry persistence, typed critical review schema, no silent fallback, no approval authority |
| Managed model/provider fallback and reselection | Release 2+ | Fresh provider-native usage, fresh provider health, runtime compatibility, policy eligibility, trusted binding/echo, sufficient telemetry, durable pre-dispatch audit, new attempt id, explicit Guard approval |
| Operational intelligence and proposal optimization | Release 3+ | Proposal/fan-out/scoring schemas, usage reserve, cadence limits, advisory-only ranking gates |
| GitHub/private ledger and external DB migration | Release 3+ | Canonical forbidden payload enforcement, hash-chain, partition/rollup/archive/migration schemas, OIDC identity |
| Federated score registry | Release 4+ | Explicit opt-in, preview, revoke/retention policy, registry schema, anti-Sybil and self-hosting controls |
| Specialist reference-pack workflows and optional MCP | Release 4+ | Reference-pack schemas, professional-boundary disclaimers, connector permission model, no professional signoff |

If a target feature lacks one of the required contracts above, implementation must stop at documentation, fake-runtime, or conformance exploration. Later-release schemas may be scaffolded in Release 1 only when they are inert, redacted, advisory-only, and unable to authorize dispatch.

## 3. Non-Negotiable Invariants

1. No OMO runtime, prompts, config schema, agents, skills, task files, team runtime, or source dependency.
2. No hidden model gateway. Provider, model, account/quota source, and runtime variant must be visible to Guard and audit.
3. No privileged action without Guard approval.
4. No real managed natural-language dispatch unless `chat_intake_mode` is verified as `blocking`. Release 1 chat routing may be enabled when conformance proves mutation/throw behavior and the product does not claim hard no-reply/cancel authority.
5. No fallback on stale, unknown, shared, refused, fallback-derived, or unverified usage state.
6. No nested `opencode run` for normal plugin-managed workflows.
7. No audit, debug, session, conformance, artifact, evaluation, or evidence record may contain forbidden persisted payloads from section 3.2.
8. No DEX-2 or project-specific paths in core/plugin behavior.
9. No evaluation score, workflow optimizer score, proposal comparison, external score, or GitHub-backed score may override policy, runtime compatibility, provider-native usage, review diversity, human approval, or Guard rejection.
10. No hook harness mode may approve dispatch, bypass Guard, or turn harness-off behavior into a safety bypass.
11. No main-agent path may author heavy workflow plans directly when delegated authoring is available. The main agent is limited to intake, routing, compact typed summaries, Guard handoff, and safe next actions.
12. No subagent output, lane status card, log summary, or debug reference may approve dispatch, widen scope, suppress verification, or replace Guard.
13. No Release 1 path may automatically switch provider or model. Provider/API/model outages in Release 1 are diagnostic, status, degraded-mode, or fake-runtime signals only.
14. No provider health snapshot, hook observation, status UI, conformance artifact, model output, or runtime echo may approve dispatch or fallback.
15. No Release 1 path may depend on broad invisible prompt or prefix injection. Message mutation is allowed only for transparent steering, command-backed routing, or conformance-proven containment; it is not a substitute for approval, blocking intake, or Guard.
16. No production orchestration path may use `opencode run` to launch delegated authoring, reviewer lanes, review fan-out, arbitrary agent/model override lanes, or normal multi-model orchestration. Those paths must use conformance-proven internal OpenCode subtask lanes or injected SDK/client calls with explicit `agent` and provider-qualified concrete `model` binding.
17. No dedicated reviewer profile may replace the canonical `reviewer` id, approve dispatch, replace Guard, self-approve, or turn a critical review into user approval. Dedicated top-tier reviewer and perspective bindings are bindings of the `reviewer` capability profile, not separate authority classes.

Bootstrap exception: the installer may perform a narrow set of setup mutations before normal Guard operation exists, but only under the bootstrap authority model in section 6.5.

### 3.1 Safety Terms

FlowDesk uses the following terms narrowly. Implementations must not use one term as evidence for another:

1. **Guard**: deterministic policy authority that approves or denies a specific privileged operation, scope, runtime binding, and verification requirement. Only Guard can authorize dispatch.
2. **Hook Containment**: OpenCode hook and permission surfaces that deny, rewrite, or route unsafe attempts when conformance proves the surface. Containment is a last-defense runtime control, not approval authority.
3. **Audit**: durable redacted records of intake, policy, routing, delegated lane activity, Guard decisions, execution attempts, verification, recovery, and debug references. Audit proves what was recorded; it does not authorize what happened.
4. **Echo**: user-visible status, runtime echo evidence, or summaries. Echo helps users understand state but is not Guard approval and is not durable audit by itself.
5. **Conformance**: repeatable evidence that a pinned OpenCode version supports the hook, command, chat, runtime, echo, telemetry, and tool-schema behavior FlowDesk depends on. Conformance enables or disables modes; it does not approve individual dispatches.

If these terms conflict in an implementation path, the path must fail closed. For example, a hook denial proves containment for a tested surface, not policy correctness; an audit event proves observability, not safety; and event telemetry or echo must never satisfy Guard approval or durable pre-dispatch audit requirements.

### 3.1A Chat Intent and Suggestion Terms

Release 1 implementations use these terms for chat UX and routing:

1. **General chat**: ordinary OpenCode chat where FlowDesk does not mutate, route, or suggest. This is the default when intent is ambiguous or unrelated.
2. **FlowDesk suggestion**: a transparent, dismissible suggestion that a request can be organized as a FlowDesk workflow. It may show a card, concise guidance, or safe commands, but it must not claim takeover or execution.
3. **FlowDesk management request**: an explicit or high-confidence user request to use FlowDesk. It may route into command-backed planning, status, recovery, diagnostics, guarded dry-run, or fake-runtime paths, subject to Guard and confirmation requirements.
4. **Unsafe later-gate request**: a request for real dispatch, provider calls, actual lane launch, automatic fallback or reselection, hard no-reply/cancel/stop, or another later-release authority. FlowDesk blocks its own route and shows safe alternatives, but does not claim hard chat suppression unless conformance proves blocking intake.
5. **Pending intent**: a redacted, time-bound, one-shot state representing a proposed FlowDesk action that requires user confirmation before execution-like behavior.

These terms must not be exposed as raw product labels. Product copy should explain what FlowDesk can do, what it will not do, and whether user confirmation is required.

### 3.2 Canonical Forbidden Persisted Payloads

Unless a later schema explicitly classifies a narrower field as safe, FlowDesk persistent stores, debug exports, conformance artifacts, logs, audit records, session records, artifact indexes, evidence references, evaluation events, ledgers, archives, and public summaries must not contain:

1. Raw prompts or prompt-like bodies.
2. Transcripts or transcript fragments.
3. Secrets, credentials, tokens, or credential-shaped values.
4. Tool args, tool results, shell output, or command payload bodies.
5. Provider payloads, provider quota response bodies, provider request bodies, or provider response bodies.
6. Runtime echoes or raw runtime event payloads.
7. Stack traces or unredacted error dumps.
8. Raw file contents.
9. Raw file paths, absolute paths, branch names, issue titles, PR titles, repository names, or organization names.
10. Prompt-derived hashes, public unsalted workspace/task/file identifiers, or stable cross-project identifiers.

Allowed records must use typed safe fields, coarse labels, opaque artifact references, redacted envelope ids, keyed hashes, and bounded summaries.

## 4. Target Repository Layout

```text
flowdesk/
  package.json
  tsconfig.base.json
  packages/
    opencode-plugin/
    core/
    policy-engine/
    usage/
    evaluation/
    test-harness/
  policy-packs/
    generic-starter/
  examples/
    generic-project/
  docs/
    START_HERE.md
    USER_MANUAL.md
    FLOWDESK_OPENCODE_PLUGIN_IMPLEMENTATION_SPEC.md
    OPENCODE_CONFORMANCE_PLAN.md
    IMPLEMENTATION_ROADMAP.md
    THREAT_MODEL.md
    schemas/
      RELEASE_1_TOOL_CONTRACTS.md
    conformance/
  scripts/
    install-flowdesk.ts
```

If code is initially bootstrapped from `dex-conductor`, preserve only project-agnostic contracts and tests. CLI/subprocess files may be copied into `packages/test-harness` or a compatibility package only when they are clearly marked non-primary.

## 5. Package Responsibilities

### 5.1 `@flowdesk/opencode-plugin`

Owns:

1. OpenCode plugin entrypoint and package metadata.
2. Chat intake hooks, hook harness mode, and `chat_intake_mode` enforcement.
3. Configured command entrypoints and command markdown/config generation.
4. Plugin tool modules, divided by release registration status:
   - Release 1 registered minimum: `flowdesk_doctor`, `flowdesk_plan`, `flowdesk_run`, `flowdesk_status`, `flowdesk_resume`, `flowdesk_retry`, `flowdesk_abort`, `flowdesk_usage`, `flowdesk_export_debug`.
   - Release 1 internal or optional diagnostics, registered only when the exact contract in section 6.3A passes schema conformance: `flowdesk_chat_intake`, `flowdesk_explain_route`, `flowdesk_audit`.
   - Later-release module, not registered in Release 1: `flowdesk_reference_search`.
5. OpenCode session/event observation.
6. Translation from OpenCode context to typed core requests.
7. User-visible blocked, clarify, status, lane observability, and recovery messages.
8. Runtime-adapter reporting for delegated lane invocation ids, retry attempts, incomplete outputs, and aborted/inconclusive lane states.

Must not own:

1. Policy decisions.
2. Quota interpretation.
3. Model approval.
4. Evaluation scoring authority.
5. Redaction rules beyond invoking the redaction-first audit API.

### 5.2 `@flowdesk/core`

Owns:

1. Intent classification contracts.
2. Workflow plan and step contracts.
3. Task and workflow taxonomy normalization.
4. Category/difficulty/risk normalization derived from the normative taxonomy.
5. Candidate model and agent profile selection contracts.
6. FlowDesk Guard request/response contracts.
7. Reselection and retry contracts.
8. Runtime execution echo validation contract.
9. Audit event type definitions.
10. Checkpoint/resume state machine contracts.
11. Workflow authoring delegation contracts and typed subagent lane summaries.
12. Delegation reliability supervisor contracts that distinguish invocation ids from continuation ids, classify incomplete and aborted lane results, bound retry attempts, and prevent failed lanes from counting as approval or verification.

Reuse from `dex-conductor` where safe: `WorkflowPlan`, `WorkflowStep`, Guard contracts, usage snapshot contracts, runtime capability artifacts, execution echo validation, verification result, artifact lineage, and checkpoint contracts.

### 5.3 `@flowdesk/policy-engine`

Owns:

1. `.flowdesk/config.json` schema validation.
2. Policy Pack loading and merge semantics.
3. Hard bans and project-specific hard-ban extensions.
4. Redaction baseline and audit writer safety.
5. Artifact quarantine/promote/discard policy.
6. Fail-closed config validation.

Harness-specific bans such as `HARNESS_SCORING=off` belong in a project Policy Pack, not in core defaults unless globally justified.

Exact Release 1 config and policy schemas are normative in `docs/schemas/RELEASE_1_TOOL_CONTRACTS.md` under “Config and Policy Schemas”. The canonical schema ids are:

1. `flowdesk.project_config.v1` for `.flowdesk/config.json`.
2. `flowdesk.policy_pack.v1` for Policy Pack documents.
3. `flowdesk.effective_policy.v1` for the merged effective policy summary.
4. `flowdesk.non_dispatch_permission.v1` for Guard-approved non-dispatch permissions.

Config and Policy Pack loading rules:

1. Missing, malformed, stale, hand-edited, unrecognized, hash-mismatched, or conformance-mismatched config/policy inputs fail closed for managed behavior.
2. `.flowdesk/config.json` may select only `release1` behavior in Release 1. It cannot enable real dispatch, managed provider/model fallback, hard chat no-reply/cancel/stop, or actual OpenCode subtask/model/provider lane launch.
3. Policy Packs may hard-ban modes, shorten retention, require approval, disable tools, define redaction baselines, and constrain provider/usage/health eligibility. They cannot grant reusable approval or approve privileged execution by themselves.
4. Config and Policy Pack hashes are hashes of normalized schema-safe config/policy objects. They must not be prompt-derived hashes and must be checked before non-dispatch permissions, state writes, audit writes, usage writes, debug exports, or fake-runtime writes.
5. Project-specific extensions require an explicit schema-safe namespace in both config and effective policy. Unknown extension namespaces, arbitrary nested policy payloads, and background/legacy OMO policy imports fail validation.
6. Retention defaults are at most 14 days for session records, 7 days for debug staging, and 30 days for opted-in conformance summaries. Policy Packs may shorten these windows. Longer retention requires explicit user config and remains subject to the same redaction contract.
7. Usage policy and Provider Health policy remain separate. Missing official machine-readable quota evidence for OpenCode Go or z.ai is recorded as `unknown`, not guessed, and is non-dispatchable.

### 5.4 `@flowdesk/usage`

Owns two separate snapshot families for Claude, OpenAI/Codex, Gemini, OpenCode Go, z.ai, and future providers:

1. Provider-native Usage Availability Snapshots, which answer whether a provider/model family has fresh usage or quota evidence.
2. Provider Health Snapshots, which answer whether provider auth, API reachability, model availability, OpenCode provider loading, and related telemetry look usable.

The two snapshot families must not be merged. A healthy provider with stale usage is non-dispatchable. Fresh usage with an unavailable provider is non-dispatchable. Release 1 may display, diagnose, warn, block, or use fake-runtime paths from these snapshots, but it must not automatically switch provider or model.

`@flowdesk/usage` owns diagnostic availability reporting only. It is not a provider orchestration, routing, or failover control plane; any future managed provider/model reselection remains a separate Guard-approved dispatch decision under the Release 2+ gates in section 8.2.

Usage Availability Snapshot rules:

1. Snapshot id, provider family, model family, freshness, freshness TTL, reset time, reset bucket, dispatchability, uncertainty flags, and source ref are mandatory. Use `unknown` or a coarse `unknown` bucket when provider-native reset evidence is unavailable; do not omit the field.
2. Unknown, stale, refused, shared-limit-suspected, or fallback-derived usage state is non-dispatchable.
3. Raw provider credentials, raw quota payloads, and full local session transcripts must not be persisted.
4. Codex/OpenAI local session inspection must be bounded and redacted.
5. Usage snapshots may persist only normalized dispatchability fields, freshness metadata, provider/model family identifiers, reset bucket metadata, uncertainty flags, and redacted source references.
6. Usage snapshots must not persist provider response bodies, account identifiers beyond a redacted stable reference, raw local session excerpts, auth headers, API keys, or model-generated usage claims.

OpenUsage-style usage checking may be used as a reference pattern, not as authority by default. FlowDesk may borrow the pattern of a provider capability matrix and explicit source labels for each metric, such as provider API truth, local observed history, response `usage` accounting, rate-limit/header probe, authenticated diagnostic probe, or inferred estimate. A Usage Availability Snapshot that relies on local observed history, including OpenCode SQLite/history style evidence, must label the source as local-only and may not claim account-wide quota truth across devices or sessions. FlowDesk must not copy browser cookie extraction, HAR capture, provider console scraping, undocumented subscription or quota endpoints, permissive local HTTP cache assumptions, or unmerged OpenCode `/usage` pull request behavior into Release 1. FlowDesk's internal provider-native collector may implement pinned DEX Conductor/OpenUsage-style acquisition logic for Claude OAuth usage, Codex/OpenAI live usage, and Gemini Code Assist quota, but it may emit trusted managed-dispatch usage authority only when it actually acquires auth-bound usage/quota/reset evidence and redacts all raw provider payloads. If DEX Conductor or an external OpenUsage-compatible local API is used as Release 2 evidence, it must be opt-in, loopback-only, version-pinned, redacted, continuously auditable, and bound by a conformance artifact proving the exact provider, concrete non-alias model id, model family, auth profile, credential scope, account/project boundary, actual usage acquisition, quota evidence, reset time, reset bucket, and source authority. Managed-dispatch beta represents that proof as `flowdesk.managed_dispatch_beta.usage_authority_evidence.v1`, matching the Usage Snapshot `snapshot_id`, `provider_family`, `model_family`, `reset_time`, `reset_bucket`, and `source_ref` plus the Guard-approved provider-qualified model id without storing raw provider payloads.

Provider Health Snapshot minimum fields:

1. `snapshot_id`: opaque schema-safe id.
2. `provider_family`: `claude|openai|gemini|opencode_go|z_ai|unknown|all`.
3. `model_family`: optional provider-qualified model family label or `unknown`.
4. `observed_at`, `freshness`, and `freshness_ttl`.
5. `source_surface`: `opencode_config|plugin_event|doctor_probe|usage_collector|provider_smoke_test|manual_report|unknown`.
6. `availability_state`: `healthy|degraded|unavailable|unknown`.
7. `failure_class`: one of the provider/API/model failure classes below, or `none`.
8. `retry_after_bucket`: optional coarse bucket such as `unknown|seconds|minutes|hours|after_reset`.
9. `runtime_config_ref`: optional opaque ref to redacted provider/runtime config metadata.
10. `telemetry_ref`: optional opaque ref to redacted event or diagnostic metadata.
11. `dispatchability`: `dispatchable|diagnostic_only|non_dispatchable`.
12. `source_ref`: opaque ref to the redacted diagnostic source summary.
13. `safe_remediation`: bounded user-facing remediation label.

Provider Health Snapshot rules:

1. Provider health is first-class status and diagnostic input, separate from usage availability.
2. Unknown, stale, telemetry-ambiguous, refused, fallback-derived, or model-generated provider health is non-dispatchable.
3. Health snapshots may persist only normalized provider/model family labels, availability state, failure class, freshness metadata, coarse retry bucket, dispatchability, and redacted source references.
4. Health snapshots must not persist raw provider errors, provider payloads, credential values, auth headers, prompts, transcripts, raw runtime echoes, raw logs, raw file paths, stack traces, or account identifiers beyond a redacted stable reference.
5. A provider smoke test may be used only as a diagnostic or conformance probe unless a later release gate proves it as part of real dispatch. It must not become plugin-level automatic cross-provider fallback.
6. Every concrete provider family requires explicit auth readiness and real usage/quota/reset evidence before any model is eligible. If auth plugin readiness, API key/OAuth readiness, credential scope, account boundary, usage acquisition, quota evidence, or reset evidence is absent or stale, FlowDesk records a non-dispatchable diagnostic such as `auth_missing`, marks the affected models non-dispatchable, and excludes them rather than dispatching, falling back, or reselecting automatically.
7. Managed-dispatch beta actual OpenCode SDK calls may be exposed only through an explicit opt-in server tool that receives a complete evidence bundle and calls the guarded adapter. The default Release 1 server registration must not expose the beta tool.

Provider/API/model failure classes:

1. `auth_missing`: provider authentication was not found.
2. `auth_expired`: authentication exists but appears expired or rejected.
3. `provider_unavailable`: provider API or service appears unavailable.
4. `rate_limited`: provider or account reports a rate or usage limit.
5. `model_unavailable`: the requested model is disabled, missing, retired, or not available for the account.
6. `transport_timeout`: request, stream, or chunk timeout occurred.
7. `provider_error`: provider returned an error that can be safely summarized only by class.
8. `opencode_provider_load_failure`: OpenCode could not load the configured provider or model list.
9. `telemetry_ambiguous`: FlowDesk cannot tell whether the provider, OpenCode, network, or telemetry path failed.

Release 1 provider family additions:

| Provider family | User-facing label | Release 1 usage availability design | Release 1 provider health design | Required conformance posture |
|---|---|---|---|---|
| `opencode_go` | OpenCode Go | Use only documented OpenCode Go account/model metadata or completed-response usage evidence when available. If fresh provider-native quota or reset evidence is unavailable, mark usage `unknown` and non-dispatchable for real provider/model selection. | Diagnose configured provider presence, credential presence through OpenCode auth surfaces, `opencode-go/<model-id>` model id shape, optional authenticated model-list evidence from the documented OpenCode Go model endpoint, and OpenCode provider-load state. | Treat OpenCode Go as an official OpenCode provider, but keep Release 1 diagnostic-only. Go service-side balance/model behavior must not become FlowDesk fallback, routing, or dispatch authority. |
| `z_ai` | z.ai | No official machine-readable quota/remaining-usage API is assumed. Per-call `usage` from completed z.ai responses may inform post-call accounting in later real-dispatch modes, but Release 1 pre-dispatch usage remains `unknown` unless a pinned conformance artifact proves a safe official source. Do not scrape subscription, billing, or rate-limit console pages. | Diagnose `ZAI_API_KEY` or OpenCode-managed credential presence without exposing secrets, documented official base URL family, configured model label against a documented/static catalog where available, OpenCode provider-load state, and documented z.ai HTTP/business error classes mapped into the existing failure vocabulary. | Treat Z.AI and Z.AI Coding Plan as `z_ai` family modes. Exact OpenCode provider ids, coding-plan endpoints, model ids, authenticated model listing, streaming/tool support, and account-specific availability are conformance-gated. |

Persisted provider family values are schema-safe labels. User-facing copy may display `opencode_go` as “OpenCode Go” and `z_ai` as “z.ai”. Exact provider ids, base URLs, model ids, and coding-plan modes are stored only as bounded redacted refs or normalized model-family labels; they must not include raw credentials, raw provider payloads, or console-scraped account data.

### 5.5 `@flowdesk/evaluation`

Owns append-only observations and derived advisory snapshots.

Initial files:

```text
packages/evaluation/src/types.ts
packages/evaluation/src/events.ts
packages/evaluation/src/store.ts
packages/evaluation/src/aggregate.ts
packages/evaluation/src/selectors.ts
```

Initial project data paths:

```text
.flowdesk/evaluation/events.jsonl
.flowdesk/evaluation/category-fit.snapshot.json
.flowdesk/evaluation/workflow-proposal-events.jsonl
.flowdesk/evaluation/workflow-score.snapshot.json
```

Evaluation signals are applied only after policy, runtime, usage, review-diversity, and Guard hard filters. They are ranking inputs, not approvals.

Evaluation stores and snapshots are untrusted inputs unless generated by FlowDesk from trusted, redacted events in the current workspace. Evaluation config must not load arbitrary external score files or paths outside the project policy boundary. Missing, malformed, stale, hand-edited, or externally sourced snapshots must be ignored safely or fail closed according to Policy Pack; they never authorize dispatch.

Optional GitHub-backed score storage is a publication and ledger option, not a managed database. FlowDesk may write low-volume private repository JSONL ledgers and sanitized summary artifacts when a Policy Pack enables it. GitHub Actions artifacts are temporary bundles, not durable score storage. GitHub Pages may publish sanitized aggregate summaries only. For high-volume querying, concurrency control, joins, or operational dashboards, FlowDesk must use an external managed database reached through GitHub Actions OIDC or another approved workload identity path.

GitHub ledgers, artifacts, Pages summaries, and external score stores must enforce the canonical forbidden persisted payload list in section 3.2. They may contain only schema-safe opaque ids, keyed hashes, timestamps, model/provider family labels, taxonomy labels, redacted prompt envelope ids, aggregate scores, reviewer verdict labels, and opaque artifact references. Workspace, task, file, and prompt-envelope identifiers must use Policy Pack-approved HMAC or another keyed hash construction, not unsalted public hashes.

### 5.6 Normative Task and Workflow Taxonomy

Every `WorkflowPlan`, `WorkflowPlanProposal`, model candidate comparison, and evaluation event must carry separate taxonomy axes. A single generic difficulty label is not enough.

Required axes:

1. Primary category: `coding`, `debugging`, `refactor`, `test`, `documentation`, `research`, `planning`, `review`, `security`, `data`, `ops`, `design`, `specialist_reference`, or Policy Pack extension.
2. Difficulty drivers: a list of the concrete reasons the task is hard, such as unclear requirements, unfamiliar APIs, missing tests, hidden state, concurrency, security sensitivity, domain uncertainty, or broad repo impact.
3. Impact and coupling scope: `single_file`, `few_files`, `module`, `cross_module`, `repo_wide`, `multi_repo`, or `external_system`.
4. Algorithmic hardness: `none`, `low`, `moderate`, `high`, or `research_grade`, based on algorithm design, data structures, complexity, and proof burden.
5. Architecture hardness: `none`, `low`, `moderate`, `high`, or `system_boundary`, based on API design, ownership boundaries, extensibility, and long-term coupling.
6. Migration and state hardness: `none`, `low`, `moderate`, `high`, or `irreversible`, based on data migration, compatibility, rollback, and state recovery.
7. Domain and research uncertainty: `none`, `low`, `moderate`, `high`, or `expert_review_required`, based on unknown facts, source quality, and specialist knowledge needs.
8. Verification hardness: `none`, `low`, `moderate`, `high`, or `external_lab`, based on how hard it is to prove correctness with tests, builds, manual checks, or outside systems.
9. Operational risk: `none`, `low`, `moderate`, `high`, or `critical`, based on production impact, data loss, availability, privacy, security, and rollback risk.
10. Policy and professional boundary: `ordinary`, `sensitive`, `restricted`, `specialist_reference_only`, or `professional_human_required`.

The taxonomy is normative input to planning and advisory evaluation. It must not replace Guard, Policy Pack rules, usage checks, runtime compatibility, conformance, or human approval.

### 5.7 Reference Packs

Reference packs are a root data tree plus optional validation library, not automatically an npm workspace package. If implementation needs TypeScript validators, create `packages/reference-pack-tools/`; otherwise keep schemas and pack data under root `reference-packs/`.

Canonical source layout:

```text
reference-packs/
  patent/
    registry/source-register.yaml
  medical-device-software/
    registry/source-register.yaml
  schemas/
    reference-pack.schema.json
    reference-card.schema.json
    source-register.schema.json
```

Project registration path:

```text
.flowdesk/reference-packs/registry.yaml
```

Optional MCP connectors, including Korean law MCP servers, are ingestion or retrieval connectors only. They are not authoritative stores by themselves.

Each reference source entry must include source URL, official publication URL when different, authority, jurisdiction, source type, publication/effective/version dates when applicable, fetched date, last verified date, next review due, license/copyright note, quote/embedding policy, source hash or change hash, stale/superseded status, and professional-review flags.

Optional MCP connectors require Policy Pack opt-in. Connector responses must carry provenance, retrieval timestamp, upstream source identity, auth redaction status, failure/stale markers, and payload hash before use in specialist workflows. Query-string API keys, raw connector payloads, and unredacted legal/regulatory responses must not be persisted.

## 6. OpenCode Integration Contract

### 6.1 Plugin Entry

Package shape:

```json
{
  "name": "@flowdesk/opencode-plugin",
  "type": "module",
  "main": "./dist/index.js",
  "exports": {
    ".": "./dist/index.js",
    "./server": "./dist/index.js"
  },
  "peerDependencies": {
    "@opencode-ai/plugin": "<pinned-compatible-range>"
  },
  "engines": {
    "opencode": "<verified-version-or-range>"
  }
}
```

Implementation must pin the exact OpenCode release or source commit used for conformance before production install.

Before implementation, every plugin tool must have an explicit tool contract: request schema, response schema, privilege class, state preconditions, state outputs, redacted error shapes, and schema compatibility tests against the pinned OpenCode tool conversion path. This is a release gate because the OpenCode 1.14.40 PoC showed that custom plugin tool definitions can crash during schema conversion before provider dispatch. A tool without this contract cannot be registered in production profiles, and `/flowdesk-doctor` must fail readiness if a registered FlowDesk tool lacks a passing schema compatibility result.

Safe OpenCode API assumptions for the first implementation:

1. Plugins can be loaded from local plugin directories or npm package specs declared in OpenCode config.
2. `engines.opencode` in plugin `package.json` is checked by OpenCode for npm plugin specs and may be used as a compatibility signal. Local/file plugin installs must be separately checked by the installer and `/flowdesk-doctor` before production dispatch.
3. Trigger-style plugin hooks run sequentially and mutate a shared output object. `event` hooks are fire-and-forget harness telemetry and coordination surfaces. FlowDesk may require capability-discovered event telemetry for real dispatch, stall detection, recovery, status tracking, artifact quarantine triggers, and runtime failure detection. However, event delivery, ordering, or failure must not be treated as Guard authority, dispatch authorization, durable audit completion, or sole runtime echo evidence.
4. Official OpenCode evidence supports plugin `event` observations for session, message, tool, and related lifecycle surfaces where exposed by the pinned version. The event hook is observational and returns no retry, fallback, or dispatch decision. FlowDesk must not treat it as plugin-level automatic cross-provider fallback.
5. The plugin hook surface includes `config`, `event`, `tool`, auth/provider hooks, chat hooks, `command.execute.before`, `tool.execute.before`, `tool.execute.after`, `shell.env`, `tool.definition`, and experimental transforms.
6. OpenCode provider configuration supports provider timeout and chunk timeout settings, enabled or disabled providers, explicit provider/model selection, and model refresh commands such as `opencode models`. FlowDesk may diagnose or surface those settings after conformance, but Release 1 must not mutate them to perform automatic fallback.
7. `chat.params` and `chat.headers` can modify LLM request parameters or headers before a provider request, but they do not provide model/agent routing authority or fallback authority.
8. Command definitions support at least `template`, optional `description`, `agent`, `model`, and `subtask`.
9. Command definitions expose command-level `agent`, `model`, and `subtask` fields in the researched API, but FlowDesk must treat routing through those fields as conformance-gated until the pinned OpenCode version proves routing and binding behavior. FlowDesk may use them only after constructing a Guard-approved command template/binding and recording matching conformance evidence.
10. TUI plugin APIs may support UI affordances such as toast, prompt refs, route/navigation, state inspection, and client calls. FlowDesk must treat TUI surfaces as UX-only unless conformance proves a specific behavior. TUI state/events are not trusted runtime echo or audit evidence.

### 6.2 Chat Intake Modes

Release 1 uses chat as the normal user entry point, but routes accepted chat requests into command-backed FlowDesk workflows. Commands remain visible controls for setup, status, recovery, diagnostics, and fallback.

`chat_intake_mode` values:

| Mode | Meaning | Managed dispatch from natural chat |
|---|---|---|
| `blocking` | FlowDesk can classify and suppress, replace, or fully handle the normal assistant turn before unguarded execution | Allowed after `/flowdesk-doctor` passes |
| `steering` | FlowDesk can mutate or throw from chat hooks to steer normal requests into a FlowDesk envelope, but cannot provide hard no-reply/cancel authority | Allowed for Release 1 chat routing, not privileged managed dispatch |
| `observe_only` | FlowDesk can observe chat context but cannot safely steer or prove control of the turn | Blocked; direct user to command fallback |
| `off` | No chat intake hook enabled | Blocked; commands only |

`blocking` requires conformance tests proving:

1. The hook runs before normal assistant execution.
2. FlowDesk can prevent unguarded assistant execution for `managed_plan`, `clarify`, and `blocked` outcomes.
3. Hook failure is user-visible and fail-closed.
4. Session/message/correlation ids are stable.
5. Event ordering is consistent across the pinned OpenCode version.

OpenCode 1.14.40 PoC result: `chat.message` mutation changes outgoing text and can steer normal chat requests toward a FlowDesk envelope; `chat.message` throw aborts dispatch. Unsupported `noReply`, `cancel`, and `stop` fields do not provide safe hard cancellation authority and may trigger validation failure. Therefore Release 1 may use `steering` mode for chat-routed command-backed workflows, but `blocking` remains disabled until a first-class handled/cancel/prevent-default contract or equivalent safe boundary is proven.

### 6.3 Command Contract

Portable commands are the documented fallback and are supported by the OpenCode 1.14.40 PoC command probes. Colon aliases remain preferred aliases, not required installed UX, until alias conformance passes. Natural-language chat remains the primary Release 1 UX, with commands used for setup, status, recovery, diagnostics, and fallback.

Canonical Release 1 minimum command surface:

| Portable command | Desired alias | Release 1 role | Required in Release 1 |
|---|---|---|---|
| `/flowdesk-doctor` | `/flowdesk:doctor` | Diagnose install, compatibility, provider readiness, policy, usage, hook harness, and conformance state | Yes |
| `/flowdesk-plan` | `/flowdesk:plan` | Create or revise a guarded plan through delegated authoring where conformance permits, without dispatch | Yes |
| `/flowdesk-run` | `/flowdesk:run` | Run guarded dry-run or fake-runtime dispatch only in Release 1 | Yes |
| `/flowdesk-status` | `/flowdesk:status` | Show workflow state, subagent lane state, blocker, checkpoint, audit reference, and next actions | Yes |
| `/flowdesk-resume` | `/flowdesk:resume` | Resume from a durable valid checkpoint | Yes |
| `/flowdesk-retry` | `/flowdesk:retry` | Retry with a new attempt id and Guard-compatible binding | Yes |
| `/flowdesk-abort` | `/flowdesk:abort` | Request workflow cancellation, record audit state, and expose safe next actions | Yes |
| `/flowdesk-usage` | `/flowdesk:usage` | Refresh or display redacted usage snapshot state | Yes |
| `/flowdesk-export-debug` | `/flowdesk:export-debug` | Export a redacted diagnostic bundle | Yes |

`/flowdesk-setup` and `/flowdesk-init` are bootstrap or config-scaffold controls. `/flowdesk-explain-route` and `/flowdesk-audit` are useful diagnostics, but they are not part of the Release 1 minimum surface unless a profile enables them. Documentation that gives normal or recovery instructions must at least cover the required commands in the table above.

Desired aliases:

```text
/flowdesk:setup
/flowdesk:init
/flowdesk:doctor
/flowdesk:plan
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

Portable fallback commands:

```text
/flowdesk-setup
/flowdesk-init
/flowdesk-doctor
/flowdesk-plan
/flowdesk-explain-route
/flowdesk-run
/flowdesk-status
/flowdesk-resume
/flowdesk-retry
/flowdesk-abort
/flowdesk-usage
/flowdesk-audit
/flowdesk-export-debug
```

Dynamic slash-command registration must not be assumed. The installer generates configured OpenCode commands or command markdown files that call plugin tools.

Custom command aliases are not a documented plugin feature. To support both desired and portable names, the installer should register separate command entries when conformance proves the exact names are accepted. Markdown command filenames must avoid platform-sensitive characters unless the target platform/parser is tested.

Command-template shell interpolation is forbidden in generated or user-controlled FlowDesk command templates. The OpenCode 1.14.40 PoC showed that shell interpolation in command templates can execute before `tool.execute.before`; FlowDesk must generate static, schema-reviewed templates and must reject templates containing shell interpolation or equivalent pre-hook execution forms.

Command-to-tool mapping:

| Documented command | Desired alias | Tool or action | Behavior |
|---|---|---|---|
| `/flowdesk-setup` | `/flowdesk:setup` | installer, then `flowdesk_doctor` | Prepare profile, write command files, then run doctor |
| `/flowdesk-init` | `/flowdesk:init` | `flowdesk_doctor` plus config scaffolding | Create or validate `.flowdesk/config.json` and starter Policy Pack reference |
| `/flowdesk-doctor` | `/flowdesk:doctor` | `flowdesk_doctor` | Answer “Can FlowDesk safely run here?” |
| `/flowdesk-plan` | `/flowdesk:plan` | `flowdesk_plan` | Create or revise a plan through delegated authoring where available; no dispatch |
| `/flowdesk-explain-route` | `/flowdesk:explain-route` | `flowdesk_explain_route` | Explain latest route and Guard rationale; optional diagnostic command in Release 1 |
| `/flowdesk-run` | `/flowdesk:run` | `flowdesk_run` | Dispatch only when current release mode and Guard allow it |
| `/flowdesk-status` | `/flowdesk:status` | `flowdesk_status` | Show current state, lane summaries, blocker, checkpoint, and next actions |
| `/flowdesk-resume` | `/flowdesk:resume` | `flowdesk_resume` | Resume from a valid checkpoint |
| `/flowdesk-retry` | `/flowdesk:retry` | `flowdesk_retry` | Retry with a new attempt id and Guard-compatible binding |
| `/flowdesk-abort` | `/flowdesk:abort` | `flowdesk_abort` | Request best-effort cancellation, record audit state, and distinguish requested/observed/failed/proven-hard cancellation |
| `/flowdesk-usage` | `/flowdesk:usage` | `flowdesk_usage` | Refresh or display redacted usage snapshot state |
| `/flowdesk-audit` | `/flowdesk:audit` | `flowdesk_audit` | Show redacted audit references and summaries; optional diagnostic command in Release 1 |
| `/flowdesk-export-debug` | `/flowdesk:export-debug` | `flowdesk_export_debug` | Export redacted diagnostic bundle only |

`/flowdesk-setup` is a bootstrap installer entrypoint, not a normal plugin-managed workflow command. It may perform only the bootstrap mutations listed in section 6.6, requires typed confirmation for profile mutation, and cannot enable production dispatch by itself. If exposed inside OpenCode after bootstrap, it may only re-run safe diagnostics or hand off to the external installer; privileged profile mutation then requires an explicit Guard-approved non-dispatch permission.

`/flowdesk-init` is a config-scaffold command. During bootstrap it may create initial `.flowdesk/config.json` and starter Policy Pack references under bootstrap authority. After bootstrap ends, it may only create or mutate config through a Guard-approved non-dispatch config-scaffold permission, with redacted audit and rollback metadata. It is not part of the minimum Release 1 command path unless the installer profile explicitly enables config scaffolding.

#### 6.3A Release 1 Tool Contracts

Release 1 tools must use OpenCode-compatible schemas proven by the custom tool schema conformance test before registration. Until that PoC passes, tools may exist only as static command-backed documentation, test harness stubs, or fake-runtime fixtures.

Release 1 schema authoring uses **FDS-1**, a conservative Zod raw-shape profile for OpenCode plugin tool conversion tests. Implementations export JSON Schema artifacts from those Zod shapes for review, fixtures, documentation, and conformance evidence; they must not hand-author production plugin args as raw JSON Schema unless a later pinned conformance report explicitly promotes that path.

1. Top-level tool args are Zod object/raw shapes. FlowDesk validation and exported schema artifacts reject unknown properties.
2. Allowed field shapes are `string`, `number`, `boolean`, arrays, and simple nested objects that also follow FDS-1.
3. String enums use explicit Zod enums. Numeric enums are unsupported unless a later conformance report promotes them.
4. Optional fields use `.optional()` and are omitted from exported `required` lists.
5. Every field and tool uses `.describe()`.
6. Bounded scalar and collection constraints, such as string length, numeric min/max, array max length, and object max property count, are allowed only when covered by the schema conversion spike.
7. Defaults are applied by FlowDesk after validating the request envelope; they must not rely on OpenCode or provider schema transforms.
8. Raw JSON Schema plugin args, mixed Zod/raw args, `oneOf`, `anyOf`, `allOf`, unions, discriminated unions, recursive schemas, nullable fields, transforms, preprocessors, `refine`, `superRefine`, records, maps, sets, tuples, and provider-specific schema tricks remain unsupported unless explicitly promoted by pinned conformance.

FDS-1 compatibility is accepted only at the FlowDesk runtime-closed validation boundary: OpenCode may expose provider-facing schemas without `additionalProperties: false`, but FlowDesk canonical schemas and handlers must reject unknown properties before privileged behavior. Production OpenCode tool registration remains disabled until production handlers and the wider release gates are separately satisfied.

Shared request envelope fields:

1. `schema_version`: tool-specific literal schema id in concrete request contracts. Shared envelope base types may keep this as `string` so concrete contracts can narrow it.
2. `workflow_id`: optional opaque id for an existing workflow.
3. `session_ref`: optional redacted session reference.
4. `request_id`: opaque id generated per user action.
5. `input_mode`: `chat_routed`, `portable_command`, `alias_command`, or `test_fixture`.
6. `redacted_intake_ref`: optional reference to a redacted intake record.
7. `user_approval_ref`: optional scope-bound approval reference when required.

Illustrative shared request envelope shape:

```json
{
  "schema_version": "flowdesk.<tool>.request.v1",
  "request_id": "opaque-id",
  "input_mode": "chat_routed|portable_command|alias_command|test_fixture",
  "workflow_id": "optional opaque-id",
  "session_ref": "optional opaque-ref",
  "redacted_intake_ref": "optional opaque-ref",
  "user_approval_ref": "optional opaque-ref"
}
```

Shared response envelope fields:

1. `schema_version`: tool-specific literal schema id in concrete response contracts. Shared envelope base types may keep this as `string` so concrete contracts can narrow it.
2. `ok`: boolean.
3. `status`: `ready`, `blocked`, `needs_clarification`, `dry_run_complete`, `fake_runtime_complete`, `recovery_available`, `degraded`, `diagnostic_only`, or `error`.
4. `workflow_id`: optional opaque id.
5. `safe_next_actions`: list of portable commands or chat actions.
6. `user_message`: bounded plain-language summary with no forbidden persisted payloads.
7. `audit_ref`: optional opaque audit reference.
8. `debug_ref`: optional opaque debug reference.
9. `lane_refs`: optional list of opaque lane status references.
10. `error`: optional redacted error object with `code`, `category`, and `safe_remediation`.

Illustrative shared response envelope shape:

```json
{
  "schema_version": "flowdesk.<tool>.response.v1",
  "ok": true,
  "status": "ready|blocked|needs_clarification|dry_run_complete|fake_runtime_complete|recovery_available|degraded|diagnostic_only|error",
  "workflow_id": "optional opaque-id",
  "safe_next_actions": ["/flowdesk-status"],
  "user_message": "bounded plain-language summary",
  "audit_ref": "optional opaque-ref",
  "debug_ref": "optional opaque-ref",
  "lane_refs": ["optional opaque-ref"],
  "error": {
    "code": "optional_code",
    "category": "schema|policy|conformance|usage|provider_health|provider_api|model_availability|state|audit|redaction|runtime|unknown",
    "safe_remediation": "bounded remediation text"
  }
}
```

Release 1 minimum tool-specific contracts:

| Tool | Privilege class | Request-specific fields | Response-specific fields | Failure behavior |
|---|---|---|---|---|
| `flowdesk_doctor` | `safe_read_only` for checks; privileged non-dispatch when `persist_report` or installer bootstrap report writes state | `check_scope`, `profile`, optional `persist_report` | doctor category results, provider health summary, compatibility artifact ref, disabled modes | Never enables dispatch or fallback; report writes require the relevant bootstrap or audit/state non-dispatch permission |
| `flowdesk_plan` | privileged non-dispatch state/audit write | `goal_summary`, `scope_summary`, `risk_hint`, optional `existing_plan_revision_id` | plan revision id, delegated authoring summary, lane refs, required approvals, Guard precheck summary | Blocks on unclear scope, forbidden payload, invalid config, missing state write permission, or ambiguous required lane state |
| `flowdesk_run` | privileged; Release 1 allows only `guarded-dry-run` or `fake-runtime` | `run_mode`, `plan_revision_id`, optional `step_id` | dry-run/fake-runtime result, verification summary ref, artifact disposition summary | Rejects real dispatch, unsupported mode, missing Guard approval, missing pre-dispatch audit, stale usage, or non-dispatchable provider health when the selected path performs provider/model selection |
| `flowdesk_status` | `safe_read_only` | optional `detail_level` | current state, current step, lane summaries, provider health summary, blocker, checkpoint id, audit refs, safe next actions | If state is corrupt, ambiguous, provider health is unknown, or lane correlation is missing, returns status-only recovery and debug export option |
| `flowdesk_resume` | privileged non-dispatch until Release 2 real dispatch gates pass | `checkpoint_id`, `resume_mode` | resumed plan/checkpoint summary, required fresh checks | Blocks if checkpoint is missing, stale, corrupt, lock-conflicted, or telemetry-dependent without sufficient evidence |
| `flowdesk_retry` | privileged non-dispatch state/audit write | `attempt_id`, `retry_reason`, optional `new_binding_hint` | new attempt id, required Guard checks, safe next actions | Creates no runtime execution and performs no provider/model fallback unless Release gate and Guard allow the resulting run mode and binding |
| `flowdesk_abort` | privileged non-dispatch state/audit write | `workflow_id`, optional `attempt_id`, `reason` | cancellation state: `cancel_requested`, `cancel_observed`, `cancel_failed`, or `hard_cancel_proven` | Must not claim hard cancellation unless conformance proves it; otherwise leaves status/debug path |
| `flowdesk_usage` | `safe_read_only` for display; privileged non-dispatch when `refresh` writes a local snapshot | `provider_family`, `refresh` | usage snapshot ref, optional provider health snapshot ref, freshness, dispatchability, uncertainty flags | Snapshot writes require `usage_snapshot_write`; unknown, stale, refused, shared-limit-suspected, fallback-derived, or model-generated usage or health is non-dispatchable |
| `flowdesk_export_debug` | privileged non-dispatch export write | `include_sections`, `retention_hint` | export manifest ref, included redacted sections, deletion guidance | Rejects if any section would include section 3.2 forbidden persisted payloads |

Optional Release 1 diagnostics `flowdesk_explain_route` and `flowdesk_audit` use `safe_read_only` contracts and may return only redacted rationale, audit references, and bounded summaries. `flowdesk_chat_intake` is an internal Release 1 tool only when OpenCode tool schema conversion passes; otherwise chat intake must be implemented as hook logic that writes only through the redaction-first core API. `flowdesk_reference_search` is not a Release 1 registered tool.

When a command exposes both display-only and write-capable operation modes, the implementation must resolve the effective privilege class before doing any side effect. The write-capable path is privileged even if the same named command also supports a safe read-only display path.

Release 1 exact tool payload schemas are named contracts, not free-form maps:

| Tool | Request contract | Request-specific fields | Response contract | Response-specific fields |
|---|---|---|---|---|
| `flowdesk_chat_intake` | `FlowDeskChatIntakeRequestV1` | `intake_summary`, `source_surface` | `FlowDeskChatIntakeResponseV1` | `classification`, `redacted_intake_ref`, `route_decision` |
| `flowdesk_doctor` | `FlowDeskDoctorRequestV1` | `check_scope`, `profile`, optional `persist_report` | `FlowDeskDoctorResponseV1` | `doctor_results`, `provider_health_summary`, `compatibility_ref`, `disabled_modes` |
| `flowdesk_plan` | `FlowDeskPlanRequestV1` | `goal_summary`, `scope_summary`, `risk_hint` | `FlowDeskPlanResponseV1` | `plan_revision_id`, `delegated_authoring_summary`, `required_approvals`, `guard_precheck` |
| `flowdesk_run` | `FlowDeskRunRequestV1` | `run_mode`, `plan_revision_id` | `FlowDeskRunResponseV1` | `run_result_ref`, `verification_summary_ref`, `artifact_disposition` |
| `flowdesk_status` | `FlowDeskStatusRequestV1` | optional `detail_level` | `FlowDeskStatusResponseV1` | `workflow_state`, `current_step_id`, `lane_summaries`, `provider_health_summary`, `blocker`, `checkpoint_id` |
| `flowdesk_resume` | `FlowDeskResumeRequestV1` | `checkpoint_id`, `resume_mode` | `FlowDeskResumeResponseV1` | `resume_decision`, `required_fresh_checks`, `next_checkpoint_id` |
| `flowdesk_retry` | `FlowDeskRetryRequestV1` | `attempt_id`, `retry_reason` | `FlowDeskRetryResponseV1` | `new_attempt_id`, `required_guard_checks`, `retry_state` |
| `flowdesk_abort` | `FlowDeskAbortRequestV1` | `workflow_id`, optional `attempt_id`, `reason` | `FlowDeskAbortResponseV1` | `cancellation_state`, `remaining_safe_actions` |
| `flowdesk_usage` | `FlowDeskUsageRequestV1` | `provider_family`, `refresh` | `FlowDeskUsageResponseV1` | `usage_snapshot_ref`, `provider_health_snapshot_ref`, `freshness`, `dispatchability`, `uncertainty_flags` |
| `flowdesk_explain_route` | `FlowDeskExplainRouteRequestV1` | `workflow_id`, `route_ref` | `FlowDeskExplainRouteResponseV1` | `route_summary`, `guard_rationale_ref` |
| `flowdesk_audit` | `FlowDeskAuditRequestV1` | `workflow_id`, `audit_query` | `FlowDeskAuditResponseV1` | `audit_refs`, `summary_labels`, `redaction_version` |
| `flowdesk_export_debug` | `FlowDeskExportDebugRequestV1` | `include_sections`, `retention_hint` | `FlowDeskExportDebugResponseV1` | `export_manifest_ref`, `included_sections`, `delete_after` |

Contract field constraints:

1. `check_scope`: `install|runtime|policy|usage|provider_health|conformance|all`.
2. `profile`: `production|development|test`.
3. `persist_report`: boolean, omitted defaults to `false` after request validation.
4. `intake_summary`, `goal_summary`, `scope_summary`, `risk_hint`, `retry_reason`, and `reason`: bounded user-facing summaries, max 500 chars, never raw prompts or transcripts.
5. `run_mode`: `guarded-dry-run|fake-runtime`; `real-opencode-dispatch` is invalid in Release 1 schemas.
6. `detail_level`: `summary|diagnostic|debug_refs|lane_refs`; omitted defaults to `summary` after request validation.
7. `resume_mode`: `resume|retry|abort_only|status_only`.
8. `provider_family`: `claude|openai|gemini|opencode_go|z_ai|unknown|all`; `unknown` is display-only and non-dispatchable. `opencode_go` displays as OpenCode Go and `z_ai` displays as z.ai.
9. `source_surface`: `chat.message|command.execute.before|manual_command|test_fixture`.
10. `classification`: `fast_chat|managed_plan|clarify|blocked`.
11. `route_decision`: `continue_chat|show_plan|ask_clarification|block|use_command_fallback`.
12. `audit_query`: `latest|workflow_summary|guard_decisions|verification_refs|debug_refs`.
13. `include_sections`: array of `doctor|conformance|workflow_state|audit_refs|usage_summary|policy_summary|redaction_summary`, max 7 items.
14. `retention_hint`: `delete_after_export|keep_until_default_expiry|keep_until_policy_expiry`.
15. Every `*_ref`, `*_id`, and hash is an opaque schema-safe value with max length 128 unless a narrower schema applies.
16. `delegated_authoring_summary` and `lane_summaries` are bounded typed summaries, not raw logs or transcripts.
17. `provider_health_summary` is a bounded typed summary of Provider Health Snapshot fields, not raw provider errors, raw logs, payloads, stack traces, or credential details.

Release 1 registered tool set is closed: implementations must not register `flowdesk_reference_search` or any unlisted tool. Optional diagnostics may remain unregistered if their schema conformance or user-facing need is not proven.

Provider health and fallback/reselection diagnostics must use the existing Release 1 tools, especially `flowdesk_doctor`, `flowdesk_usage`, `flowdesk_status`, `flowdesk_retry`, and `flowdesk_export_debug`. No new Release 1 registered tool is added for provider health or fallback decisions.

Release 1 persisted artifact schemas must be generated from these named contracts and from sections 7.1, 7.1A, 9, 11, and 12 before code writes them. Ad hoc persisted keys are forbidden.

#### 6.3B Release 1 Exact Schema Appendix

`docs/schemas/RELEASE_1_TOOL_CONTRACTS.md` is the normative Release 1 schema appendix for plugin tool contracts. It defines the implementation-ready TypeScript interface names, JSON Schema ids, shared envelopes, supporting summary contracts, fixture names, artifact schema additions, and custom tool schema conversion artifact requirements for the closed Release 1 tool set.

Release 1 tool schemas must be authored through OpenCode's official Zod-based plugin tool API and exported to JSON Schema artifacts for review and tests. FlowDesk does not claim arbitrary JSON Schema compatibility for plugin tool args. Raw JSON Schema args, mixed Zod/raw args, unions, recursive schemas, nullable fields, transforms, and provider-specific schema tricks remain unsupported unless a pinned conformance report explicitly narrows or promotes them.

Production tool registration is allowed only for Release 1 command-backed non-dispatch handlers after every registered Release 1 tool has a passing runtime-closed schema compatibility artifact, production handlers exist, and the applicable Guard, audit, redaction, disabled-mode, and policy checks are satisfied. Provider-facing `additionalProperties: false` emission is a documented caveat for OpenCode 1.14.40, not a production blocker by itself when FlowDesk runtime validation rejects unknown properties before execution.

Promotion order is strict:

1. Release 1 production handlers are implemented and verified before OpenCode production registration is promoted.
2. Plugin tool schema evidence proves the pinned OpenCode plugin path, provider/model transforms, and FlowDesk runtime validation preserve the selected FDS boundary.
3. Production OpenCode registration is enabled only for command-backed non-dispatch handlers after doctor, schema, Guard, audit, policy, redaction, and disabled-mode checks pass.
4. Telemetry and runtime-echo conformance is proven before any real dispatch path is implemented.
5. A single low-risk `real-opencode-dispatch` beta path is promoted only after trusted binding, trusted runtime echo, sufficient telemetry, fresh usage, fresh provider health, Guard approval, durable pre-dispatch audit, and configured verification all pass.
6. Hard chat no-reply/cancellation, actual delegated lane launch, and automatic provider/model fallback or reselection remain separate later gates. They must not be bundled into the production-registration gate or the first real-dispatch beta gate.

Generated command templates must be static. The allowed template shape is a fixed instruction to call the matching FlowDesk tool with schema-reviewed fields supplied by OpenCode command arguments or by a redacted intake reference. Templates must not include shell interpolation, arbitrary shell blocks, dynamic imports, provider calls, raw prompt persistence, or command text that widens the tool schema.

### 6.4 Runtime Dispatch

Plugin-managed dispatch uses the OpenCode plugin context, client, session id, message id, tool context, worktree, directory, and abort signal.

Model/agent routing must use Guard-approved command configuration, SDK/session inputs, or another conformance-proven runtime path. It must not rely on mutating `chat.message` metadata to change the already-selected runtime agent or model.

Supported dispatch modes:

| Mode | Meaning | Release eligibility |
|---|---|---|
| `fake-runtime` | Test harness returns deterministic runtime outputs and echo evidence | Required for Release 1 General-Use MVP |
| `guarded-dry-run` | Builds plan, route, Guard decision, command shape, and audit without execution | Required for Release 1 General-Use MVP |
| `command-steering` | Uses command hooks and chat steering to guide user/model text into FlowDesk envelope without real privileged dispatch | Allowed in Release 1 after conformance-backed mutation/throw tests |
| `real-opencode-dispatch` | Executes a Guard-approved step inside the active OpenCode runtime through a conformance-proven model/agent binding path | Disabled until a later real-dispatch release gate passes |

Real dispatch requires conformance evidence for both trusted model/agent binding and trusted runtime echo source. Without that evidence, `/flowdesk-run` may only perform guarded dry-run or fake-runtime dispatch according to release mode.

OpenCode 1.14.40 PoC result: `command.execute.before` mutation can steer command-backed flows, and `command.execute.before` throw prevents downstream chat dispatch. This is sufficient for command-backed Release 1 steering, but not a substitute for trusted real runtime dispatch.

Forbidden for normal plugin-managed workflow:

```text
opencode run ...
```

The old subprocess adapter pattern is allowed only in a compatibility or fake-runtime test harness. `opencode run` may be used manually or in CI as a provider smoke test, auth/plugin diagnostic, or compatibility probe, but it must not implement FlowDesk's delegated authoring lanes, subagent execution, review fan-out, or normal multi-model orchestration. Treat every external `opencode run` invocation as one non-interactive OpenCode session with cold-start, plugin-loading, provider-loading, auth-loading, and in-session sequencing behavior. Shell-level parallel process launch is not evidence of coordinated parallel model execution, trusted model/agent binding, lane status correlation, cancellation semantics, or runtime echo.

Production orchestration binding rule:

1. A delegated lane, reviewer lane, review fan-out lane, or arbitrary agent/model override lane must be launched only through a conformance-proven internal OpenCode command lane with `subtask: true`, or through an injected SDK/client path whose call boundary is owned by FlowDesk and tested with the same evidence bundle.
2. The launch request must name an explicit FlowDesk agent profile id, a concrete provider-qualified model id, the runtime model id where OpenCode uses a different value, and the binding registry entry that allowed the pair. Unqualified aliases such as `opus`, `gpt`, `gemini`, `best`, `latest`, or provider-hidden gateways are not production bindings.
3. The arbitrary override path is allowed only as a guarded override: the requested agent/model pair must exist in the model binding registry, pass Policy Pack constraints, pass fresh auth/usage/quota and Provider Health Snapshot gates when provider/model selection is involved, and produce runtime echo plus telemetry that matches the approved binding.
4. Override lanes cannot silently fall back, downgrade, substitute a model, change provider, or change agent class. A mismatch, unavailable model, stale usage snapshot, missing auth, missing quota evidence, or missing echo blocks the lane and returns a safe next action.
5. Reviewer lanes return typed critical review outputs only. They may report findings, uncertainty, required fixes, and schema-valid verdict labels, but they do not approve dispatch, replace Guard, replace configured verification, or self-approve the work they review.

### 6.5 Privileged Operation Gate

A privileged operation is any filesystem write, shell execution, network call, provider/model routing, OpenCode session mutation, config mutation, audit mutation, reference retrieval, debug export, plugin install/migration, or runtime dispatch.

Every plugin command and tool must classify itself as either `safe_read_only` or `privileged`. Privileged operations require a current `GuardApprovedDispatch` or a specific Guard-approved non-dispatch permission. Safe read-only operations must still use redacted inputs, bounded output, no raw prompt/body persistence, and no provider/model/config mutation.

Release 1 non-dispatch permission classes:

| Permission | Allows | Must not allow |
|---|---|---|
| `bootstrap_profile_mutation` | Installer profile backup, OMO removal after typed confirmation, FlowDesk plugin registration, command file generation | Model/provider dispatch, unrelated profile mutation, credential deletion |
| `config_scaffold` | Create or revise `.flowdesk/config.json` and starter Policy Pack references | Real dispatch enablement, hidden policy import, unreviewed external config load |
| `state_write` | Atomic `.flowdesk/workflows` workflow, attempt, checkpoint, and lock writes | Runtime dispatch or artifact promotion |
| `audit_write` | Redacted audit/intake/status records and opaque references | Forbidden persisted payloads from section 3.2 |
| `debug_export_write` | Redacted debug bundle staging and manifest write | Raw prompts, transcripts, paths, provider payloads, tool payloads, runtime echoes, or stack traces |
| `usage_snapshot_write` | Normalized local usage snapshot metadata | Credentials, provider response bodies, account identifiers beyond redacted references |
| `fake_runtime_write` | Deterministic fake-runtime result, echo evidence, and verification summary | Real provider/model call or claim of real execution |

Every non-dispatch permission is scope-bound, time-bound, audited before mutation when possible, and invalidated by config hash, Policy Pack hash, workflow id, project root, or release-mode mismatch.

Guard-approved non-dispatch permission object:

```json
{
  "schema_version": "flowdesk.non_dispatch_permission.v1",
  "permission_id": "opaque-id",
  "permission_class": "bootstrap_profile_mutation|config_scaffold|state_write|audit_write|debug_export_write|usage_snapshot_write|fake_runtime_write",
  "workflow_id": "optional opaque-id",
  "scope_ref": "opaque-ref",
  "grant_source": "bootstrap|guard_rule|typed_confirmation|policy_pack",
  "created_at": "iso8601",
  "expires_at": "iso8601",
  "config_hash": "schema-safe-hash",
  "policy_pack_hash": "schema-safe-hash",
  "release_mode": "release1|managed_dispatch_beta|operational_intelligence|specialist_workflow",
  "audit_ref": "optional opaque-ref"
}
```

The canonical TypeScript/schema form for this object is `FlowDeskNonDispatchPermissionV1` / `flowdesk.non_dispatch_permission.v1` in `docs/schemas/RELEASE_1_TOOL_CONTRACTS.md`. The JSON example above is illustrative and must stay field-compatible with that schema.

Validation rules: permission class must match the tool operation, scope must cover only the requested mutation, `expires_at` must be in the future, config and Policy Pack hashes must match current state, and `release_mode` must allow the requested operation. Missing, stale, mismatched, hand-edited, or widened permission objects fail closed.

`tool.execute.before`, `tool.execute.after`, command hooks, OpenCode permission prompts, runtime echoes, and model text are containment or observation surfaces only. They must not authorize dispatch or widen the approved scope.

### 6.6 Bootstrap Authority

The installer runs before normal project Guard state exists, so it has a narrow bootstrap authority rather than normal workflow authority.

Allowed bootstrap mutations:

1. Create timestamped backups of OpenCode config.
2. Remove OMO plugin/config references from the selected profile after explicit user confirmation.
3. Add a pinned FlowDesk plugin spec or reviewed local development plugin path.
4. Generate portable command entries or command markdown files.
5. Create initial `.flowdesk/config.json` and starter Policy Pack references.
6. Write a bootstrap report and redacted diagnostics.

Bootstrap authority must not run model/provider dispatch, mutate unrelated profiles, delete provider credentials, import OMO prompts/agents/skills, or enable production dispatch. It requires typed confirmation for profile mutation and ends when `/flowdesk-doctor` produces a passing result. After that point, normal Guard rules apply to every privileged operation.

Post-bootstrap setup and init behavior is not bootstrap authority. Any config/profile mutation after `/flowdesk-doctor` passes requires a Guard-approved non-dispatch permission and must write a redacted audit event before mutation.

Exact Release 1 bootstrap/installer schemas are normative in `docs/schemas/RELEASE_1_TOOL_CONTRACTS.md` under “Installer and Bootstrap Schemas”. The canonical schema ids are:

1. `flowdesk.bootstrap_install_plan.v1` for the installer plan.
2. `flowdesk.bootstrap_backup_manifest.v1` for timestamped OpenCode config/profile backups.
3. `flowdesk.profile_mutation_summary.v1` for selected-profile mutation summaries.
4. `flowdesk.omo_cleanup_summary.v1` for OMO removal summaries.
5. `flowdesk.command_generation_summary.v1` for generated command entries or command markdown files.
6. `flowdesk.config_scaffold_summary.v1` for `.flowdesk/config.json` and starter Policy Pack references.
7. `flowdesk.bootstrap_rollback_plan.v1` and `flowdesk.bootstrap_rollback_result.v1` for rollback/restore planning and results.
8. `flowdesk.bootstrap_report.v1` for the redacted bootstrap report.
9. `flowdesk.doctor_handoff.v1` for handing bootstrap evidence to `/flowdesk-doctor`.

Installer/bootstrap ordering is fail-closed: preflight, backup, profile mutation, OMO cleanup, plugin registration, command generation, config scaffold, doctor handoff, doctor run. Any failure after backup must leave a rollback plan or a redacted partial-recovery report. Rollback must restore only the selected profile/config entries covered by the backup manifest, preserve provider authentication entries, avoid unrelated profile mutation, and write a redacted rollback result. If rollback is partial or blocked, FlowDesk must expose only safe manual recovery, `/flowdesk-doctor`, or `/flowdesk-export-debug` guidance.

Bootstrap reports, backup manifests, rollback results, and doctor handoff records may contain only opaque refs, keyed hashes, counts, phase labels, summary labels, disabled modes, safe next actions, and redacted audit refs. They must not contain raw OpenCode config/profile contents, credentials, provider auth entries, raw filesystem paths, raw command bodies, prompts, transcripts, provider payloads, stack traces, runtime echoes, or raw file contents.

Typed confirmation for bootstrap profile mutation must be bound to the target profile ref, exact mutation plan ref, backup manifest ref, rollback plan ref, confirmation ref, expiry, and actor class. It is single-use and invalid after the mutation attempt, rollback attempt, or doctor handoff completes.

### 6.7 Harness Event Telemetry Contract

Event hooks are not UX-only. They are part of the runtime harness telemetry surfaces required when FlowDesk enables real dispatch or recovery modes that depend on OpenCode session telemetry.

Minimum capability-discovered harness telemetry surfaces for real dispatch:

1. Fire-and-forget plugin `event` observations for session lifecycle/status, message progress, runtime errors, cancellation, and timeout where available.
2. Awaited trigger hooks such as `tool.execute.before`, `tool.execute.after`, and `command.execute.before` where they are available and relevant to the approved step.
3. Session, message, status, permission, shell, tool, or command bus events where the pinned OpenCode version exposes them.
4. Stable correlation identifiers linking telemetry to workflow id, step id, attempt id, lane id, task ref, session id, message id, tool call id, or command id.
5. Policy-bounded latency and lossiness measurements sufficient to decide whether status, stall detection, recovery, and quarantine are safe.

FlowDesk may use event telemetry for:

1. Subagent heartbeat and progress tracking.
2. Stall detection.
3. Runtime failure suspicion.
4. Status and recovery state updates.
5. Artifact quarantine triggers.
6. Audit correlation and attempt lineage.
7. Provider/API/model failure observation, only as a clue that must be reconciled with Provider Health Snapshot rules before status, recovery, or later dispatch decisions rely on it.

FlowDesk must not use event telemetry for:

1. Guard approval.
2. Dispatch authorization.
3. Scope widening.
4. Durable audit-write success.
5. Sole proof of execution success.
6. Sole proof of actual model/agent/runtime echo.
7. Provider/model fallback or reselection approval.

If the minimum telemetry surfaces are unavailable, delayed beyond policy tolerance, lossy in a way that prevents safe coordination, or not correlated to stable session/message/tool identifiers, FlowDesk must disable real dispatch, managed fallback/reselection, and any recovery mode that depends on those surfaces. Command-driven guarded dry-run and fake-runtime dispatch may remain available.

Event-derived lifecycle states such as `completed`, `failed`, `cancelled`, or `idle` are observations only. They may update status displays and recovery hints, but they must not transition a workflow to `complete`, promote artifacts, mark verification passed, or mark execution successful without trusted runtime echo, configured verification when required, and durable audit outcome records.

### 6.8 Hook Harness Mode

FlowDesk has a hook harness mode that controls how chat, command, tool, and shell-related hook surfaces are used to prevent agent deviation. The harness is containment and routing only. It never approves dispatch, never widens scope, and never replaces FlowDesk Guard.

Supported modes use `enforce`, `observe`, and `off` as the canonical stored, artifact, and config values. User-facing UI may accept `on` only as an alias that normalizes to `enforce` before storage or audit.

| Mode | Meaning | Allowed behavior |
|---|---|---|
| `enforce` | Active containment for managed Release 1 UX | Deny, rewrite, or route unsafe chat, command, tool, or shell attempts when conformance proves the hook can safely do so |
| `observe` | Diagnostics and warnings without containment claims | Record and report deviation attempts; managed privileged automation that depends on containment stays disabled |
| `off` | Managed hook harness disabled | Disable managed and privileged automation; leave only safe manual, setup, status, recovery, diagnostics, and fallback behavior |

The harness may prevent agent deviation by:

1. Denying tool or command attempts that are outside the FlowDesk workflow state, policy scope, or Guard decision.
2. Rewriting chat or command text into a safe FlowDesk envelope when OpenCode 1.14.40 mutation/throw evidence supports that route.
3. Routing the user to `/flowdesk-doctor`, `/flowdesk-status`, `/flowdesk-plan`, `/flowdesk-resume`, `/flowdesk-retry`, `/flowdesk-abort`, `/flowdesk-usage`, or `/flowdesk-export-debug` when the request cannot be safely handled through chat.
4. Blocking command templates or tool attempts that contain shell interpolation or equivalent pre-hook execution forms.

Fail-closed rules:

1. Unknown harness mode, missing required hooks, hook validation failure, conformance mismatch, stale capability artifact, or ambiguous denial outcome blocks managed automation.
2. In `enforce` mode, a hook failure blocks the dependent workflow and shows a safe recovery path.
3. In `observe` mode, FlowDesk must not rely on observation as containment; any privileged automation that needs containment remains disabled.
4. In `off` mode, FlowDesk must not treat disabled hooks as permission to bypass safety. It disables managed and privileged automation and leaves safe manual fallback only.
5. Real dispatch remains disabled until the real-dispatch gate proves trusted binding, trusted runtime echo, sufficient telemetry, fresh usage, Guard approval, and durable pre-dispatch audit.

### 6.9 Workflow Authoring Delegation and Lane Observability

FlowDesk should minimize main-agent context. The main agent performs intake, routing, compact typed summaries, Guard handoff, and safe next actions. It must not directly author large workflow plans when delegated authoring is available. Heavy workflow drafting, refinement, review, verification, research, and documentation work belongs in bounded subagent lanes that return typed summaries.

Delegation is bounded runtime behavior, not extra authority. A subagent lane can suggest, draft, review, or verify, but it cannot approve dispatch, widen scope, suppress verification, replace user approval, replace Guard, or make model text authoritative.

OpenCode-feasible delegation basis:

1. Official OpenCode command documentation exposes command-level `agent`, `model`, and `subtask`; `subtask: true` is the documented mechanism for running a command as a subagent to avoid polluting primary context. FlowDesk treats this as the preferred delegated authoring mechanism only after conformance proves the pinned version's routing and binding behavior and the active release gate permits actual lane launch. In Release 1, actual OpenCode subtask/model/provider lane launch remains disabled unless a later spec revision explicitly promotes it through the real-dispatch gate.
2. Official plugin documentation exposes `event` subscriptions, `command.executed`, `session.*`, `message.*`, `tool.execute.before`, `tool.execute.after`, `tui.toast.show`, `tui.prompt.append`, custom tools, and structured `client.app.log()`. FlowDesk may use those surfaces for lane status, failure detection, and redacted references only after conformance proves correlation to lane ids/task refs.
3. No current official OpenCode document proves that a plugin can create a native clickable task pane or raw log viewer. FlowDesk must not promise a custom task UI. It may present task-like lane summaries through `/flowdesk-status`, command output, TUI toasts/prompts, or assistant-visible markdown/file references only when the pinned UI proves those references are openable and redacted.
4. If openable references are not proven, the product promise is still satisfied by portable status summaries and `/flowdesk-export-debug` redacted bundles.

Minimum contract:

1. Policy Pack must set maximum concurrent lanes per workflow and per lane class. Release 1 defaults must be conservative and must not imply real provider fan-out.
2. Workflow authoring must be split into lane classes where useful: `planning_draft`, `planning_refine`, `planning_review`, `critical_review`, `research`, `documentation`, `verification`, and `diagnostics`.
3. Non-mutating exploration, documentation lookup, and independent review lanes may run in parallel when their inputs are redacted and their outputs are treated as untrusted until verified.
4. Main-agent context input to a lane must be a redacted task envelope, not a raw prompt or transcript. Main-agent output from a lane must be a compact typed summary plus opaque references.
5. Guard decisions, user approval decisions, final dispatch selection, and Oracle-style architecture decisions that the plan depends on are blocking lanes. FlowDesk must not execute a dependent step before those decisions complete.
6. Every lane has a timeout, retry policy, cancellation policy, and failure disposition. Timeout or failed lanes must write redacted status and leave safe next actions.
7. Cancellation is best-effort unless the pinned OpenCode conformance artifact proves hard cancellation for that lane type. Audit must distinguish `cancel_requested`, `cancel_observed`, `cancel_failed`, and `hard_cancel_proven`.
8. Delegated outputs are advisory until verified by the workflow's required validation path. A delegated result cannot widen scope, approve dispatch, suppress verification, or replace Guard.
9. If lane state is ambiguous because telemetry is missing, delayed, lossy, or uncorrelated, FlowDesk must quarantine dependent artifacts and fall back to status, abort, retry planning, or debug export.
10. FlowDesk must keep separate id classes for background invocation handles and continuation/session handles. A background invocation handle may be used only to retrieve or cancel that invocation's result; a continuation/session handle may be used only to continue the same lane context. Adapters that expose concrete prefixes such as `bg_*` and `ses_*` must preserve that distinction in typed records and reject cross-use before retrying.
11. A lane result is complete only when it contains the requested deliverable or a final verdict matching the lane contract. A lane that terminates after tool calls only, returns an invocation error such as `Tool execution aborted`, or lacks a required verdict is `incomplete`, `invocation_failed`, or `abnormal_exit`; it must not count as approval, QA pass, security pass, or implementation completion.
12. The delegation reliability supervisor may retry an invocation failure once with corrected invocation metadata, and may retry once through a fresh compatible lane route when safe and non-destructive. Retries must be recorded with a new attempt/ref and must not silently switch provider, model, or authority class unless a later release gate and Guard approve that binding.

Release 1 lane behavior is limited to delegated authoring records, fake-runtime lane summaries, command/status summaries, and degraded fallback records. Any actual OpenCode subtask/model/provider lane launch requires the managed-dispatch gate: trusted binding, trusted runtime echo, sufficient telemetry, fresh usage when provider/model selection is involved, fresh provider health, Guard approval for privileged work, and durable pre-dispatch audit.

Planned top-tier reviewer and perspective bindings for Release 2.5 or Release 3 entry:

1. FlowDesk must support critical review by launching every registered highest-tier available reviewer/model lane when the release gate permits actual lane launch. The highest-tier set is discovered from the active FlowDesk model binding registry and Policy Pack; it is not hard-coded to a fixed provider count. Claude Opus, GPT frontier, and Gemini Pro can be seeded as the current environment's top bindings when registered, but missing unregistered providers do not block review by themselves.
2. Multi-perspective review is mandatory even when model diversity is low. If the registry exposes only one highest-tier available model, FlowDesk may assign that same concrete model to multiple reviewer agents or perspective bindings, such as policy/security, architecture, and verification/implementation review, while preserving separate lane records and output schemas.
3. These lanes are extensions of the canonical `reviewer` capability profile. The canonical `reviewer` id remains the policy and audit anchor, while each dedicated lane records a binding such as `reviewer` plus a perspective id and an approved top-tier model binding. They must not reintroduce `critic` as a canonical id.
4. Each dedicated reviewer binding must resolve through the model binding registry to a concrete provider-qualified model id, for example an Anthropic Claude Opus model, an OpenAI GPT frontier model, a Google Gemini Pro model, or another registered highest-tier model. The registry must reject aliases, stale retired ids, provider-hidden ids, lower-tier substitutions, and account-unavailable ids.
5. All registered highest-tier available reviewer/model bindings are included for high-risk or critical review when fresh auth, usage, quota/reset, provider health, runtime compatibility, runtime echo, telemetry, and policy evidence all pass. If a registered highest-tier binding is unavailable, FlowDesk records the exclusion reason and safe next action in the inventory snapshot. It must not silently substitute a lower tier, hidden provider, or unregistered model.
6. A top-tier review run must persist redacted telemetry and lane records for each reviewer: requested binding, approved binding, perspective id, runtime echo match, provider family, model family, usage evidence ref, Provider Health Snapshot ref, output schema status, and final typed review verdict. It must not persist raw prompts, transcripts, provider payloads, runtime echo bodies, raw tool data, raw file contents, or raw paths.
7. Reviewer outputs use a typed critical review schema with findings, severity, evidence refs, uncertainty, required fixes, and verdict labels such as `pass`, `changes_required`, `blocked`, or `inconclusive`. These verdict labels are review outputs only. Guard, user approval, and configured verification remain separate gates.
8. `Registered` means the binding is enrolled in the FlowDesk model binding registry and enabled by the active Policy Pack for the current workflow class. `Available` means that same binding has fresh auth, usage/quota/reset, Provider Health Snapshot, runtime compatibility, runtime echo, telemetry, and budget/reserve evidence for this run. `Highest-tier` means the binding is explicitly marked by the registry as the highest review tier available for its provider or model family after conformance proves the concrete model id, context/capability metadata, and provider/account availability; auto-selected aliases and lower-tier fallbacks are never highest-tier.
9. If policy budget, concurrency, quota reserve, timeout, retry budget, or cost caps cannot include the registered highest-tier set and the required perspective set, FlowDesk must block the review run or ask for an explicit policy-compatible scope/configuration change. It must not silently run fewer perspectives or substitute a lower model.
10. Every run must persist a redacted reviewer binding inventory snapshot listing registered bindings, available bindings, included bindings, excluded bindings, blocked bindings, perspective assignments, exclusion reasons, highest-tier eligibility refs, availability refs, budget/concurrency decisions, and safe next actions. This snapshot is audit evidence only and cannot approve dispatch.

Minimum lane status summary fields:

1. `lane_id`: opaque schema-safe lane id.
2. `workflow_id`, `plan_revision_id`, and optional `attempt_id`.
3. `task_ref`: opaque task id or subagent invocation reference.
4. `lane_class`: `planning_draft|planning_refine|planning_review|research|documentation|verification|diagnostics|other`.
5. `state`: `queued|launching|running|waiting|completed|blocked|failed|timed_out|correlation_lost|cancel_requested|cancel_observed|cancel_failed|hard_cancel_proven`.
6. `created_at`, `started_at`, `updated_at`, and optional `completed_at`.
7. `event_refs`: bounded list of opaque event references.
8. `audit_refs`: bounded list of redacted audit references.
9. `log_ref` or `debug_ref`: opaque reference to a redacted summary or debug bundle, not a raw log.
10. `failure_class`: optional value from the lane failure class list below.
11. `safe_next_action`: portable command or bounded chat action.
12. `invocation_ref_kind`: optional `background_invocation|continuation_session|opencode_task|unknown` when the pinned surface exposes distinct references.
13. `retry_count`: optional non-negative integer bounded by policy.
14. `verdict_status`: optional `present|missing|incomplete|not_required`.

Lane failure classes:

1. `launch_failed`: OpenCode did not accept or start the subagent lane.
2. `missing_tool`: the required tool, command, agent, model, or subtask binding is unavailable.
3. `schema_conversion_failed`: a FlowDesk or OpenCode schema conversion failed before safe execution.
4. `timeout`: the lane exceeded its policy timeout.
5. `correlation_lost`: events or status cannot be matched to the lane id, task ref, session id, message id, tool call id, or command id.
6. `abnormal_exit`: the lane exited, failed, or disappeared outside the expected state transition.
7. `telemetry_unavailable`: the pinned OpenCode version does not expose enough event, hook, or status data for the lane behavior FlowDesk wanted.
8. `cancellation_unproven`: cancellation was requested but hard cancellation was not proven.
9. `redaction_blocked`: a lane summary or reference would contain forbidden persisted payloads.
10. `invocation_failed`: the adapter returned an invocation/runtime failure, including an aborted tool execution, before a valid lane verdict or deliverable was produced.
11. `incomplete_result`: the lane ran but produced only intermediate tool calls, partial output, or a response missing the required verdict/deliverable.
12. `reference_kind_mismatch`: a background invocation reference was used as a continuation reference, a continuation reference was used for result retrieval, or another adapter-specific id class was crossed.
13. `retry_limit_reached`: the bounded retry policy has been exhausted and the lane must degrade to direct verification, status, retry planning, or debug export.
14. `auth_missing`: required provider authentication was not found.
15. `auth_expired`: provider authentication appears expired or rejected.
16. `provider_unavailable`: the provider API or service appears unavailable.
17. `rate_limited`: a provider/account limit blocks the requested lane.
18. `model_unavailable`: the selected model is unavailable for the provider/account.
19. `transport_timeout`: request, stream, or chunk timeout occurred.
20. `provider_error`: provider returned an error that can be represented only by safe class.
21. `opencode_provider_load_failure`: OpenCode could not load the configured provider or model list.

Release 1 observability surface:

1. `/flowdesk-status` must show a compact lane summary when lane records exist.
2. The default Release 1 UX is task-like, not native task UI: status shows one row/card-equivalent per lane with state, failure class, refs, and safe next action.
3. When OpenCode conformance proves safe clickable or openable references, status may include markdown/file refs that open redacted lane summaries, status cards, or debug summaries.
4. If clickable or openable references are not proven, FlowDesk must expose portable command summaries and `/flowdesk-export-debug` fallback instead.
5. Openable references are UX only. They are not durable audit, runtime echo, Guard approval, or proof of success.
6. Status and debug output must use redacted summaries and opaque refs. Raw prompts, transcripts, provider payloads, tool args/results, runtime echoes, stack traces, raw file contents, and raw paths remain forbidden.

## 7. Workflow State Machine

Minimum states:

```text
idle
intake_received
fast_chat
clarify_pending
plan_pending_approval
guard_pending
ready_to_run
running
verification_failed
retry_pending
blocked
complete
aborted
```

State transitions must be auditable and resumable. `/flowdesk-status` must show state, workflow id, current step, lane summaries when available, blocked reason, safe next actions, checkpoint id, and audit reference.

Allowed Release 1 state transitions:

| From | To | Required evidence |
|---|---|---|
| `idle` | `intake_received` | redacted intake envelope or command request envelope |
| `intake_received` | `fast_chat` | classifier marks no privileged workflow required |
| `intake_received` | `clarify_pending` | missing scope, approval, policy, or safety details |
| `intake_received` | `plan_pending_approval` | plan draft and redacted audit reference |
| `plan_pending_approval` | `guard_pending` | scope-bound user approval if required |
| `guard_pending` | `ready_to_run` | Guard approval for dry-run/fake-runtime or approved non-dispatch permission |
| `ready_to_run` | `running` | pre-dispatch audit for dry-run/fake-runtime and current lock acquired |
| `running` | `complete` | fake-runtime or dry-run result, required verification summary, outcome audit |
| `running` | `verification_failed` | failed verification summary and artifact quarantine state |
| `running` | `retry_pending` | retryable failure, checkpoint, and safe retry reason |
| Any active state | `blocked` | fail-closed policy, conformance, usage, provider health, provider/API/model, redaction, lock, or schema error |
| Any active state | `aborted` | abort request recorded and no further Release 1 execution allowed |

Transitions to `complete` must not be based solely on OpenCode event telemetry, model text, hook observation, or user-facing echo. Release 1 `running` means a guarded dry-run or fake-runtime operation is in progress; it never means real provider dispatch.

A checkpoint is valid for resume or retry only when it is backed by durable FlowDesk state and redacted audit references. Event telemetry may correlate or annotate checkpoints and lane records, but a checkpoint derived solely from event hooks is not resumable. If telemetry loss creates ambiguity about the active attempt or a required lane, FlowDesk must block event-dependent resume/retry and offer only safe status, abort, or debug-export actions.

### 7.1 Workflow State Store and Checkpoint Contract

Durable workflow state lives under:

```text
.flowdesk/workflows/
  active.json
  <workflow_id>/
    workflow.json
    attempts/
      <attempt_id>.json
    checkpoints/
      <checkpoint_id>.json
    locks/
      active-attempt.lock
```

Minimum `workflow.json` fields:

1. `workflow_id`.
2. `created_at` and `updated_at`.
3. Current state.
4. Latest plan revision id.
5. Current step id.
6. Project root and config hash.
7. Policy Pack id and hash.
8. Audit reference ids.
9. Artifact disposition summary.
10. Delegated lane refs and latest lane summary refs when present.

Exact `workflow.json` constraints:

1. `workflow_id`, `plan_revision_id`, `step_id`, `audit_ref`, `checkpoint_id`, and `attempt_id` are opaque ids, not raw prompt, path, branch, issue, PR, repo, or organization strings.
2. `state` must be one of the states in section 7.
3. `project_root_ref` is a redacted or keyed reference, not an absolute path.
4. `config_hash` and `policy_pack_hash` are hashes of normalized schema-safe config, not prompt-derived hashes.
5. Unknown fields are rejected unless `schema_version` explicitly permits extension fields under a namespaced `extensions` object.

Minimum attempt record fields:

1. `attempt_id`, `workflow_id`, and `step_id`.
2. Guard decision id.
3. Approved agent, model, provider, runtime variant, and command shape hash.
4. Usage snapshot id, provider health snapshot id, and final usage/health check id.
5. Runtime capability artifact id.
6. Pre-dispatch audit event id.
7. Runtime echo validation result.
8. Verification result reference.
9. Artifact quarantine or promotion state.
10. Outcome audit event id when available.

Attempt records must include `schema_version`, `created_at`, `updated_at`, `run_mode`, `state_at_start`, `state_at_end`, and `failure_category` when failed. `failure_category` may use provider/API/model failure classes when the attempt is blocked or degraded by outage, auth, model availability, timeout, provider load, or ambiguous telemetry. Release 1 `run_mode` is limited to `guarded-dry-run`, `fake-runtime`, or `command-steering`.

Minimum checkpoint fields:

1. `checkpoint_id`, `workflow_id`, `attempt_id`, and current step id.
2. Resume mode: `resume`, `retry`, `abort_only`, or `status_only`.
3. Required fresh checks before resume.
4. Redacted audit references.
5. Artifact disposition references.
6. Expiration time or freshness policy.
7. Reason checkpoint was created.

Checkpoint `resume_mode` controls available commands: `resume` permits `/flowdesk-resume` after fresh checks; `retry` permits `/flowdesk-retry`; `abort_only` permits `/flowdesk-abort` and `/flowdesk-export-debug`; `status_only` permits only status and debug export.

State writes must be atomic: write to a temporary file, flush where supported, then rename into place. Active attempt locks prevent duplicate dispatch. Missing, corrupt, stale, mismatched, or lock-conflicted state fails closed for resume/retry and leaves only status, abort, or debug-export actions available. Recovery must never reconstruct privileged state from transcripts, raw prompts, shell history, or OpenCode event telemetry alone.

Exact persisted Release 1 state schemas are normative in `docs/schemas/RELEASE_1_TOOL_CONTRACTS.md` under “Persisted Workflow/State Schemas”. The canonical schema ids are:

1. `flowdesk.workflow_active.v1` for `.flowdesk/workflows/active.json`.
2. `flowdesk.workflow_record.v1` for `.flowdesk/workflows/<workflow_id>/workflow.json`.
3. `flowdesk.attempt_record.v1` for `.flowdesk/workflows/<workflow_id>/attempts/<attempt_id>.json`.
4. `flowdesk.checkpoint_record.v1` for `.flowdesk/workflows/<workflow_id>/checkpoints/<checkpoint_id>.json`.
5. `flowdesk.active_attempt_lock.v1` for `.flowdesk/workflows/<workflow_id>/locks/active-attempt.lock`.

Release 1 persisted attempts must use `guarded-dry-run`, `fake-runtime`, or `command-steering` run modes only. Provider/model/usage/runtime fields in attempt records are opaque evidence refs when available and must be omitted when not applicable; they must not be represented by placeholder provider ids that imply real dispatch. `runtime_echo_validation` is `not_applicable` for command-steering and fake-runtime paths unless a pinned conformance report proves a trusted runtime echo surface for the specific path.

`active.json` is an index for safe status/recovery lookup only. If it points to a missing, corrupt, stale, or mismatched workflow or attempt record, FlowDesk must treat the active workflow as blocked for resume/retry and offer only `/flowdesk-status`, `/flowdesk-abort`, or `/flowdesk-export-debug` as appropriate. It cannot be used as standalone proof that a workflow is eligible to run.

`active-attempt.lock` must contain an opaque owner ref, acquire time, expiry time, optional heartbeat, recovery state, and audit ref. Stale or corrupt locks cannot be ignored silently; recovery must write an audit record and keep duplicate-dispatch prevention fail-closed until the lock is either safely replaced by the owning workflow state transition or the workflow is moved to a safe blocked/aborted state.

### 7.1A Session, Artifact, and Conformance Storage Layout

`.flowdesk/workflows` remains the authoritative workflow and checkpoint state store. Session and artifact directories organize redacted runtime evidence around that state; they must not become a second source of truth.

Recommended layout:

```text
.flowdesk/
  workflows/                 # authoritative workflow/checkpoint state
  sessions/
    <session_id>/
      intake.jsonl            # redacted intake envelopes and references
      audit.jsonl             # redacted audit references or local audit records
      guard-decisions.jsonl   # Guard decision references and summaries
      verification.jsonl      # verification summaries and references
      lanes.jsonl             # redacted subagent lane summaries and refs
      artifacts/              # generated workflow artifacts only
      redacted-debug/         # debug export staging, redacted only
  conformance/
    <run_id>/                 # opt-in persisted conformance summaries only
      report.md
      opencode-conformance.json
      redacted-evidence.jsonl
```

Rules:

1. `.flowdesk/sessions` is redacted-only, retention-bounded, and enabled to support status, resume, abort, audit references, and debug export. It complements `.flowdesk/workflows`; it does not replace workflow state or locks.
2. Workflow artifacts go under `.flowdesk/sessions/<session_id>/artifacts` unless the user explicitly asks for a project file and Guard approves that write scope.
3. Conformance artifacts default to an isolated temporary directory. Persisting summaries under `.flowdesk/conformance` requires explicit opt-in and may contain only redacted reports, compatibility artifacts, and evidence references.
4. Sessions, artifacts, conformance records, and debug exports must not store any forbidden persisted payload from section 3.2.
5. Lane records under `.flowdesk/sessions` are redacted summaries and opaque refs only. Authoritative workflow state stays under `.flowdesk/workflows`.
6. Release 1 default retention before user configuration: session records are kept for at most 14 days, debug export staging for at most 7 days, and opted-in conformance summaries for at most 30 days. A Policy Pack may shorten these windows. Longer retention requires explicit user configuration and the same redaction contract.
7. Deletion must remove generated artifacts and manifests that are not needed for active workflow recovery. If deletion cannot prove what was removed without exposing forbidden payloads, it must report a redacted partial-deletion warning and leave safe manual cleanup guidance.

Exact persisted session-side schemas are normative in `docs/schemas/RELEASE_1_TOOL_CONTRACTS.md`:

1. `flowdesk.lane_record.v1` for each `lanes.jsonl` line.
2. `flowdesk.audit_record.v1` for each `audit.jsonl` line.
3. `flowdesk.debug_export_manifest.v1` for each redacted debug export manifest.

Session-side records are append-oriented redacted evidence. They may explain what FlowDesk observed, summarized, quarantined, or exported, but they cannot replace `.flowdesk/workflows` state, grant or extend Guard approval, prove success, prove hard cancellation, or authorize dispatch/fallback. Release 1 persisted lane records must not store `hard_cancel_proven`; they may store only `cancel_requested`, `cancel_observed`, or `cancel_failed` cancellation states. If session records conflict with authoritative workflow records, authoritative workflow records win and the conflict must be visible through status/debug with a redacted audit ref.

### 7.2 Workflow Proposal and Optimizer Contracts

`WorkflowPlanProposal` is an advisory candidate plan. It is not a dispatch approval. A proposal may describe a simpler plan, a more detailed plan, a verification-heavy plan, or a high-assurance plan, but it cannot make any step eligible for execution.

Minimum `WorkflowPlanProposal` fields:

1. `proposal_id`, `workflow_id`, `created_at`, and `source`.
2. `variant`: `simple`, `standard`, `detailed`, or `high_assurance`.
3. Redacted prompt envelope id and intake record id.
4. Taxonomy axes from section 5.6.
5. Step summary, step count, write scope summary, verification summary, and rollback summary.
6. Required agents, models, capabilities, usage class, and runtime compatibility constraints.
7. Risk summary and required approvals.
8. Expected cost and latency class.
9. Proposal provenance, including provider family and model family, without raw provider payloads.

`ProposalSet` groups candidate proposals for the same redacted intake and policy context. Minimum fields:

1. `proposal_set_id`, `workflow_id`, and `plan_revision_id`.
2. `mode`: `single_model`, `multi_variant_single_model`, or `multi_model_fanout`.
3. Included variants.
4. Proposal ids.
5. Surplus usage gate decision id when fan-out is used.
6. Advisory score summary.
7. Selected proposal id, selected by policy-safe advisory ranking or human choice.
8. Guard eligibility result after hard filters.

Optimization variants:

1. `simple`: shortest safe plan for ordinary, low-coupling tasks with light verification.
2. `standard`: balanced plan for routine implementation or documentation changes.
3. `detailed`: expanded plan for broad impact, unclear requirements, or higher verification hardness.
4. `high_assurance`: extra review, adversarial checking, rollback, and verification for high risk, security-sensitive, migration-heavy, or professional-boundary-adjacent work.

Workflow optimization is advisory only. It cannot override Guard, Policy Pack decisions, provider-native usage, runtime compatibility, OpenCode conformance, redaction policy, review diversity, or required human approval. External scores and GitHub-backed ledger entries cannot make an ineligible proposal, model, agent, or step eligible.

Release 1 may create `WorkflowPlanProposal` and `ProposalSet` schemas and redacted fake-runtime events. Release 1 must not use evaluation ranking or workflow optimization as approval, and it must not enable real dispatch.

### 7.3 Surplus Usage Gate for Multi-Model Proposal Fan-Out

Multi-model proposal fan-out asks more than one eligible provider or model family to draft workflow proposals for the same redacted task envelope. Fan-out is allowed only when an explicit mode and every gate below pass.

Required mode and gates:

1. Policy Pack and user setting explicitly enable proposal fan-out for the project, task category, and risk tier.
2. The operation is proposal-only unless a later release also satisfies every real-dispatch gate. Release 1 fan-out may use schema scaffolding and fake-runtime events only.
3. Provider-native usage snapshots are fresh, dispatchable, and tied to the exact provider/model family considered.
4. Required reserve is preserved for the user's normal work and for configured verification.
5. A project budget cap for proposal fan-out is set and not exceeded.
6. Cadence and throttling gates pass. Plentiful usage is necessary but never sufficient: fan-out must not run on every eligible request.
7. Usage is not stale, unknown, shared-limit-suspected, refused, fallback-derived, model-generated, or sourced from an untrusted snapshot.
8. Runtime compatibility and conformance allow the proposal generation path.
9. A redacted prompt envelope is used. The envelope must enforce the canonical forbidden persisted payload list from section 3.2.
10. Policy allows the category and professional boundary for proposal generation.
11. The fan-out plan, expected cost class, and provider/model families are visible to the user when user approval is required.

Cadence controls must include:

1. Default `disabled` unless project policy and user setting enable it.
2. Per-project rolling-window cap, such as max fan-outs per day or week.
3. Per-task-signature and per-category cooldown so repeated similar requests reuse cached proposals or single-proposal planning instead of fan-out.
4. Cost-class threshold requiring explicit per-run confirmation above the configured cost class.
5. Minimum novelty rule: fan-out may run only when current-task uncertainty, taxonomy mismatch, low confidence, or stale proposal coverage justifies new samples.
6. Backoff after failed, quarantined, or low-value fan-out runs.

If any gate fails, FlowDesk must fall back to single-proposal planning or ask the user to refresh usage, reduce scope, or change settings. It must not fall back to unknown or shared usage, and it must not call a provider just because local cached scores look favorable.

### 7.4 Proposal Scoring and Score Storage

Proposal scores are advisory inputs for comparing eligible proposals. Score dimensions:

1. Goal fit.
2. Safety.
3. Simplicity fit.
4. Detail fit.
5. Taxonomy fit.
6. Verification coverage.
7. Implementation risk.
8. Dependency impact.
9. Confidence.
10. Cost and latency.
11. Model diversity.

Score records must include scorer identity class, score version, taxonomy snapshot hash, policy hash, redaction status, and whether the score came from local evaluation, model critique, human review, GitHub ledger replay, or external managed database read. Scores must be ignored or fail closed when stale, malformed, inconsistent with the current policy hash, or sourced outside the configured trust boundary.

Derived scores must be normalized aggregates, not cumulative totals. FlowDesk must not rank by raw accumulated score sum because sum favors high-volume models, common categories, and repeated evaluations. Derived score snapshots should use bounded means, weighted means, rates, percentiles, confidence intervals, and sample counts per dimension. Minimum snapshot fields:

1. `sample_count` and effective sample count after decay.
2. `weighted_mean_by_dimension` for each score dimension.
3. Confidence interval or confidence bucket per dimension and overall.
4. Pass/trusted/rejected/failure rates where applicable.
5. Latency and cost percentiles rather than cumulative totals.
6. Decay window, half-life or recency rule, and `last_observation_at`.
7. Scorer/model/provider concentration metrics.
8. Negative-signal counters for recent failures, quarantines, regressions, and policy mismatches.

Score reuse is allowed only after a threshold gate passes. FlowDesk may load accumulated scores for workflow optimization or model selection only when all conditions below pass:

1. The current task signature matches the score scope. The signature is built from redacted task intent, primary category, taxonomy axes, project policy hash, runtime capability class, verification class, and professional-boundary label. It must not include raw prompt text or file contents.
2. The score scope has at least the configured minimum sample count, for example `min_samples_per_scope`, and no single scorer/model/provider family dominates beyond the configured concentration limit.
3. The score window is fresh enough under configured recency and decay rules.
4. The confidence interval or confidence bucket meets the configured threshold for advisory reuse.
5. The score schema version, taxonomy snapshot hash, Policy Pack hash, redaction version, and scorer identity class are compatible with the current workspace.
6. The score source is trusted for advisory reuse: local FlowDesk-generated snapshot, verified GitHub ledger replay, or approved external managed database read.
7. The score does not conflict with recent failures, quarantines, verification regressions, or policy changes.

If the threshold gate passes, scores may influence workflow variant ordering, model tie-breaking, candidate explanation, and whether FlowDesk suggests `simple`, `standard`, `detailed`, or `high_assurance` planning. They must never make an ineligible candidate eligible, suppress required verification, reduce required approval, bypass Guard, or override fresh usage and conformance checks. If the gate fails, FlowDesk must ignore the accumulated scores and fall back to current-task planning and hard-filter ranking.

Storage paths:

1. Local JSONL: `.flowdesk/evaluation/workflow-proposal-events.jsonl` for append-only proposal and score events.
2. Local snapshots: `.flowdesk/evaluation/workflow-score.snapshot.json` for derived advisory summaries.
3. Optional local partitioned ledger: `.flowdesk/evaluation/ledger/raw/YYYY/MM/DD/score-events-<partition_id>.jsonl` for raw redacted score events.
4. Optional local sealed partitions: `.flowdesk/evaluation/ledger/sealed/YYYY/MM/score-events-<partition_id>.jsonl` for immutable completed partitions.
5. Optional local rollups: `.flowdesk/evaluation/ledger/rollups/YYYY/MM/workflow-score-rollup-<scope_id>-<window_id>.json` for derived normalized advisory summaries.
6. Optional local manifests: `.flowdesk/evaluation/ledger/manifests/score-ledger-manifest.jsonl` for hash-chain and inclusion records.
7. Optional local archives: `.flowdesk/evaluation/ledger/archive/YYYY/MM/<archive_id>.tar.zst` or another approved immutable archive format for sealed, redacted partitions and manifests.
8. Optional GitHub private repo ledger mirror: `score-ledger/raw/YYYY/MM/DD/score-events-<partition_id>.jsonl`, `score-ledger/sealed/YYYY/MM/score-events-<partition_id>.jsonl`, `score-ledger/rollups/YYYY/MM/workflow-score-rollup-<scope_id>-<window_id>.json`, `score-ledger/manifests/score-ledger-manifest.jsonl`, and `score-ledger/archive/YYYY/MM/<archive_id>.tar.zst`, protected by branch rules, private-repo visibility, and least-privilege `GITHUB_TOKEN` or GitHub App permissions.
9. GitHub Actions artifacts: temporary redacted bundles for review and CI, not durable score storage.
10. GitHub Pages: sanitized aggregate summaries only, with no per-prompt, per-file, secret, provider payload, or tool payload detail.
11. External managed database: required for scale, strong querying, multi-writer concurrency, or long-lived dashboards. Access must use GitHub Actions OIDC or another approved workload identity path rather than long-lived stored database credentials.

The optional GitHub private repo ledger is a ledger and publication path only. It is not a general managed database, query engine, queue, lock service, or dashboard backend. FlowDesk may compact GitHub-backed history by sealing raw JSONL partitions, writing normalized rollup snapshots, and preserving manifests with hashes. Compaction must preserve advisory score semantics and must not turn scores into dispatch authority.

Raw partition contract:

1. Raw partitions are append-only until sealed.
2. A raw partition may accept only schema-safe, redacted JSONL events.
3. A raw event must enforce the canonical forbidden persisted payload list in section 3.2.
4. Each event must include `event_id`, `dedupe_id`, `event_schema_version`, `score_schema_version`, `workspace_id_hash`, `scope_id`, `taxonomy_snapshot_hash`, `policy_hash`, `redaction_version`, `scorer_identity_class`, `created_at`, `previous_event_hash`, and `event_hash`.
5. GitHub JSONL partition ordering is always evidence-bearing. `event_hash` must be computed as `sha256` over UTF-8 RFC 8785 JSON Canonicalization Scheme bytes for the event object excluding `event_hash`. The serialized JSONL newline is not part of the hash. If an implementation cannot use RFC 8785, it must not enable GitHub ledger support until a later spec defines an equivalent canonicalization profile. `previous_event_hash` must link to the previous event hash or, for the first event in a partition, to the manifest-recorded `partition_genesis_hash`. The writer must reject mismatched previous hashes.
6. `dedupe_id` must be deterministic for the logical observation across retries, replays, GitHub imports, and external database migration. It must be derived only from schema-approved redacted fields and keyed identifiers, never from raw prompt text, file contents, raw paths, or public unsalted hashes.
7. Duplicate prevention uses global `dedupe_id`, `event_id`, `event_hash`, and partition membership across every partition included in a replay, rollup, import, or migration. A duplicate with the same hash is ignored idempotently. A duplicate with the same `dedupe_id` and different hash, or the same `event_id` and different hash, is quarantined and excluded from rollups.
8. Writers must use single-writer Actions workflows, branch protection, optimistic conflict detection, bounded retry, and idempotent event ids. After the configured conflict retry limit is reached, the writer must stop and report a safe retry path instead of creating parallel histories.
9. GitHub workflows must run only from trusted branches, must not grant fork pull requests write access to ledgers, must avoid PATs in repository config, and must redact all ledger payloads from Actions logs.
10. A partition rotates when it reaches configured `max_events_per_partition`, `max_partition_bytes`, age, run boundary, or policy-triggered seal condition.

Sealed partition contract:

1. Sealed partitions are immutable.
2. A sealed partition must not be edited, truncated, sorted, rewritten, or compacted in place.
3. Corrections require a new compensating event in a later raw partition, not mutation of a sealed file.
4. Sealing writes a manifest entry with the ledger-relative partition path, `partition_genesis_hash`, raw file hash, event count, byte size, first and last event timestamp, dedupe id set hash, schema hash, policy hash, taxonomy hash, redaction version, first and last event hash, and previous manifest hash.
5. Sealed partitions may move to archive paths only when the manifest records the archive path and archive hash. The archived bytes must match the sealed hash.

Rollup snapshot contract:

1. Rollups are derived advisory snapshots generated only from sealed partitions. Active raw partitions may be used only for local non-reusable preview calculations that are not written as GitHub rollups and cannot pass the score reuse threshold gate.
2. Rollups must use normalized aggregates. They must not store or rank by cumulative raw score sums.
3. Minimum normalized aggregate fields are `sample_count`, effective sample count after decay, weighted means by score dimension, confidence intervals or confidence buckets, pass/trusted/rejected/failure rates, latency and cost percentiles, decay-adjusted means, `last_observation_at`, scorer/model/provider concentration metrics, and negative-signal counters for recent failures, quarantines, regressions, policy mismatches, duplicate conflicts, stale inputs, and tamper suspicions.
4. Rollups must preserve per-scope semantics. A scope is bound to redacted task signature, taxonomy axes, Policy Pack hash, runtime capability class, verification class, and professional-boundary label. It must not include raw prompt text or file contents.
5. Rollups may include bucketed confidence and percentile summaries, but must not expose per-prompt, per-file, provider payload, tool payload, secret, credential, or raw file detail.
6. Rollups are inputs to the score reuse threshold gate only. They cannot approve dispatch, change eligibility, bypass Guard, reduce verification, skip approval, override provider-native usage, override OpenCode conformance, or override Policy Pack rules.

Manifest and hash-chain contract:

1. Every sealed raw partition must have a manifest record containing ledger-relative partition path, `partition_genesis_hash`, raw file hash, previous manifest hash, included event count, included dedupe ids or a dedupe id set hash, event schema hash, score schema hash, policy hash, taxonomy hash, redaction policy hash, partition status, first and last event hash, and writer identity class.
2. Every rollup must have a manifest record containing rollup hash, previous manifest hash, trusted chain head hash, included partition ids, included partition hashes, excluded duplicate ids, excluded quarantined ids, schema hash, policy hash, taxonomy hash, redaction policy hash, rollup policy hash, and generation timestamp.
3. Manifest validation must verify RFC 8785 canonical event hashes and `previous_event_hash` links inside each included raw GitHub partition.
4. A rollup is valid only if every included sealed partition hash matches its manifest, the manifest chain validates from a trusted chain head, every listed schema/policy/taxonomy/redaction hash is compatible with the current workspace, duplicate exclusions are reproducible across all included partitions, and the rollup hash matches the manifest entry.
5. Missing, stale, mismatched, hand-edited, forked, or unverifiable manifests make the affected ledger range unavailable for advisory reuse.

Capacity, retention, archive, and migration controls:

1. Policy must set `max_events_per_partition`, `max_partition_bytes`, `max_open_partitions`, rotation cadence, retention window, archive window, compaction cadence, maximum rollup age, conflict retry limit, and duplicate quarantine behavior before GitHub ledger support is enabled.
2. Compaction must run on a bounded schedule, such as after partition seal, daily, weekly, or after a configured event threshold. It must not run on every score read.
3. Retention may delete original sealed partition files only after their immutable archive bytes, archive hash, manifest coverage, and rollup coverage are verified and the policy retention window has expired. Active raw partitions, archives still inside their archive retention window, and required manifests must not be deleted.
4. Archives and archive indexes must remain redacted, schema-safe, and compliant with the canonical forbidden persisted payload list in section 3.2.
5. Duplicate event handling must be deterministic and testable. Accepted duplicates are idempotent no-ops. Conflicting duplicates are quarantined, counted in negative-signal counters, and excluded from normalized aggregates.
6. Migration to an external managed database is required when any configured limit is exceeded: partition rotation cannot keep up, conflict retries exceed policy, multiple independent writers are needed, query latency or joins are needed, dashboards need long-lived interactive reads, retention/archive operations become too costly for GitHub, rollup regeneration exceeds policy time, or score history becomes operationally critical.
7. Migration must write a migration manifest containing the final GitHub manifest hash, final trusted chain head, included partition ids and hashes, ingestion watermark, external database target identity class, schema/policy/taxonomy/redaction hashes, dedupe policy hash, and cutover timestamp. After cutover, GitHub is read-only import history unless a later spec defines an idempotent dual-write protocol with source precedence, replay safety, and duplicate handling.
8. External database ingestion must be idempotent across GitHub replay, retries, and dual-read comparison. External reads are trusted for advisory reuse only after source precedence, ingestion watermark, schema compatibility, policy compatibility, and global dedupe checks pass.
9. The external database must be reached through GitHub Actions OIDC or another approved workload identity path. Long-lived database credentials in the repo, Actions secrets, ledgers, rollups, archives, artifacts, Pages output, audit, or debug export are forbidden unless a later spec creates a narrower approved exception.

### 7.5 Future Opt-In Federated Score Registry

A future release may add a central or self-hosted federated score registry so users can voluntarily contribute sanitized aggregate signals and benefit from community advisory score snapshots. This feature is not Release 1 scope and must not be enabled by default.

Installer and configuration requirements:

1. Sharing must default to `off`.
2. Installation may ask whether to enable sharing only after showing a concise explanation of what is shared, what is never shared, the registry endpoint, retention summary, and how to disable or revoke sharing later.
3. Valid install choices are `no_keep_local`, `yes_share_redacted_aggregates`, and `ask_later`. Silence, preselection, config import, environment default, or model-generated approval must not enable sharing.
4. Users must be able to run a preview command before enabling sharing that prints the exact outbound payload shape with representative redacted values.
5. Disabling sharing must stop future uploads without affecting local ledgers, local snapshots, Guard, dispatch, verification, or recovery. Revoke semantics must be explicit before production: the user-facing policy must say whether already-uploaded records are deleted, tombstoned, retained only in irreversible aggregate form, or cannot be removed after aggregation.

Central registry submission contract:

1. Submissions may contain only coarse, schema-approved aggregate or event-envelope fields: task taxonomy axes, verification class, workflow variant, model/provider family label, result label, cost bucket, latency bucket, confidence bucket, redaction version, schema version, Policy Pack compatibility class, and coarse client version.
2. Submissions must not contain raw prompts, transcripts, repo names, organization names, file paths, branch names, issue or PR titles, tool args/results, provider payloads, runtime echoes, stack traces, raw file contents, secrets, credentials, stable user ids, stable workspace ids, stable project ids, public unsalted hashes, or prompt-derived hashes.
3. Shared identifiers must be upload-scoped, rotated, and keyed. They must not be reusable across registries, projects, or long time windows unless a later privacy review explicitly approves the schema.
4. Local aggregation should be preferred over raw per-attempt uploads. If per-attempt redacted envelopes are ever allowed, they must use coarse buckets, minimum k-anonymity thresholds before publication, and short retention.
5. The registry must reject malformed, over-detailed, low-k, unknown-version, unredacted, or policy-incompatible submissions.

Central registry read contract:

1. Community score snapshots are advisory cold-start inputs only.
2. Community scores must pass the normal score reuse threshold gate plus registry-specific trust, freshness, minimum sample, concentration, anomaly, and policy-compatibility checks before influencing ranking among already-eligible candidates.
3. Community scores cannot approve dispatch, change eligibility, bypass Guard, reduce verification, skip approval, override provider-native usage, override OpenCode conformance, or override local Policy Pack rules.
4. If the registry is unavailable, stale, tampered, rate-limited, or disabled, FlowDesk must continue with local-only planning and local-only score sources.

Registry operation requirements:

1. The submission schema, redaction code, aggregation logic, public snapshot format, and retention policy must be open for audit before a production central registry launch.
2. A self-hosted registry endpoint must be possible before the feature is considered production-ready for privacy-sensitive teams.
3. The registry must use a documented anti-Sybil baseline before production central hosting: rate limits, abuse detection, client/build provenance, anomaly detection, quarantine, minimum sample thresholds, and source concentration caps. Stronger signed provenance may be added when practical, but the baseline controls are required.
4. Public outputs must be normalized aggregate snapshots, not raw event feeds or per-user/per-project leaderboards.
5. Registry data must be separated from private local/GitHub ledgers. Central collection must never require uploading private ledger files.

## 8. Guarded Dispatch Flow

1. Receive chat or command input.
2. Create redacted intake record.
3. Classify into `fast_chat`, `managed_plan`, `clarify`, or `blocked`.
4. For `fast_chat`, continue without privileged dispatch.
5. For `clarify`, ask one focused question and wait.
6. For `blocked`, explain safe next action.
7. For `managed_plan`, delegate workflow drafting, refinement, and review to bounded subagent lanes when conformance permits; otherwise use the safe command fallback and record degraded lane state.
8. Main agent receives compact typed lane summaries, then normalizes the full taxonomy axes from section 5.6, capabilities, write scope, and verification requirements.
9. If workflow optimization is enabled, create a `ProposalSet` with `simple`, `standard`, `detailed`, or `high_assurance` variants as policy allows.
10. Use multi-model proposal fan-out only when the surplus usage gate in section 7.3 passes. Release 1 may scaffold schemas and fake-runtime events only, with no real provider dispatch.
11. Score proposals with advisory dimensions from section 7.4.
12. Load accumulated score snapshots or ledgers only when the score reuse threshold gate in section 7.4 passes.
13. Apply policy, runtime, usage, provider health, review-diversity, professional-boundary, and Guard hard filters before any candidate is considered eligible.
14. Resolve agent profile candidates.
15. Resolve provider-qualified model candidates.
16. Rank only already-eligible candidates using freshness, provider health, fit, reliability, latency, portfolio balance, and advisory evaluation snapshots.
17. Submit selected candidate to Guard.
18. Perform final fresh usage and provider health checks immediately before execution.
19. Write durable redacted pre-dispatch audit event.
20. Dispatch only `GuardApprovedDispatch`.
21. Validate runtime echo from trusted runtime surfaces.
22. Run verification if configured.
23. Quarantine or promote artifacts.
24. Append durable redacted outcome audit and evaluation events.
25. Return user-facing summary and next actions.

Before any real privileged dispatch, FlowDesk must durably write a redacted pre-dispatch audit event containing the Guard decision id, workflow id, step id, attempt id, approved scope, approved provider/model binding, usage snapshot id, provider health snapshot id, command shape hash, runtime capability snapshot id, and correlation id. If this pre-dispatch audit event cannot be redacted and written durably, dispatch must not start. Event-hook delivery or observed runtime events must not satisfy this pre-dispatch audit requirement.

### 8.1 Execution Pipeline Variants

The ordered flow depends on the enabled release mode. FlowDesk must document and test the selected pipeline instead of inferring authority from hook order.

Release 1 chat-routed command-backed pipeline:

```text
chat input
  -> chat steering or safe fallback check
  -> redacted intake record
  -> intent classification
  -> policy, usage, and runtime compatibility preflight
  -> provider health diagnostic preflight
  -> delegated workflow authoring lanes or degraded command fallback
  -> compact typed plan summary or clarification
  -> approval gate when required
  -> Guard decision
  -> guarded dry-run or fake-runtime dispatch only
  -> redacted audit/status update
  -> verification summary when configured
  -> recovery/checkpoint update
```

Release 1 command fallback pipeline:

```text
/flowdesk-* command
  -> command schema validation
  -> redacted intake record
  -> doctor/conformance/policy preflight
  -> usage and provider health diagnostic preflight where relevant
  -> delegated plan/status/recovery/diagnostic action where conformance permits
  -> Guard decision when the action is privileged
  -> guarded dry-run, fake-runtime, or safe read-only result
  -> redacted audit/status/debug reference
```

Future blocking-chat pipeline, enabled only when `chat_intake_mode=blocking` is conformance-proven:

```text
chat input
  -> blocking intake boundary
  -> redacted intake record
  -> managed outcome: fast_chat | managed_plan | clarify | blocked
  -> policy and approval gates
  -> Guard decision for privileged work
  -> dispatch mode allowed by release gate
  -> trusted echo, verification, audit, and recovery updates
```

Future real-dispatch pipeline, enabled only after the managed dispatch beta gate passes:

```text
approved workflow step
  -> final fresh usage check
  -> final fresh provider health check
  -> durable redacted pre-dispatch audit
  -> GuardApprovedDispatch through conformance-proven runtime binding
  -> trusted runtime echo validation
  -> configured verification
  -> artifact quarantine or promotion
  -> durable redacted outcome audit
```

Any missing or failed stage must fail closed to a safe next action. In Release 1, missing real-dispatch evidence or provider/API/model availability evidence falls back to guarded dry-run, fake-runtime, status, doctor, usage diagnostics, or command-backed planning; it must not silently execute real work or switch provider/model.

### 8.2 Future Managed Fallback and Reselection

Managed fallback or provider/model reselection is not Release 1 behavior. Release 1 may record that fallback was considered, blocked, or requires user action, but it must not perform a real automatic switch.

Future Release 2+ managed fallback/reselection may proceed only when every condition below passes for the new provider/model binding:

1. Fresh provider-native or pinned local Usage Availability Snapshot tied to the exact provider, concrete non-alias model id, model family, auth profile, credential scope, account/project boundary, actual usage acquisition, quota evidence, reset time, and reset bucket.
2. Fresh Provider Health Snapshot with `dispatchability=dispatchable` and no unresolved provider/API/model failure class.
3. Runtime compatibility and OpenCode conformance for the new provider/model, command shape, runtime variant, and lane or dispatch surface.
4. Policy Pack eligibility, user approval where required, budget/reserve checks, and professional-boundary checks.
5. Trusted binding evidence before dispatch and trusted runtime echo after dispatch.
6. Sufficient telemetry for the enabled real-dispatch and recovery modes.
7. Durable redacted pre-dispatch audit for the new binding before any provider call.
8. A new attempt id. Fallback must never reuse the failed attempt id as if it were the same execution.
9. Explicit FlowDesk Guard approval for the new provider/model/account/auth binding and scope.

Fallback/reselection must be blocked when any required input is stale, unknown, refused, shared-limit-suspected, fallback-derived, model-generated, telemetry-ambiguous, policy-ineligible, runtime-incompatible, untrusted, unaudited, or missing Guard approval. A fallback-derived usage or health snapshot cannot justify another fallback.

Fallback/reselection audit and status events must include only schema-safe labels and opaque refs. They must not persist raw provider errors, provider payloads, credentials, prompts, transcripts, raw runtime echoes, raw logs, raw file paths, or stack traces.

## 9. Approval Contract

Natural-language approval is valid only when Policy Pack allows it and FlowDesk records an auditable approval event. It is valid only for the exact pending plan revision or step scope shown to the user.

The approval classifier must be deterministic, fixture-tested, and scope-bound. It must reject ambiguous, compound, conditional, hidden-comment, unrelated, or scope-widening text.

Approval event fields:

1. `workflow_id`
2. `plan_revision_id` or `step_id`
3. `message_id`
4. normalized approval intent
5. approval mode
6. risk tier
7. Policy Pack rule id
8. timestamp
9. actor
10. redacted prompt reference
11. exact approved action scope

Never count these as approval:

1. Silence.
2. Conversational acknowledgement.
3. Hidden comments.
4. System-internal markers.
5. Unrelated follow-up text.
6. Text that widens scope beyond the plan summary.

Typed confirmation must include a nonce or exact confirmation phrase bound to `workflow_id`, `plan_revision_id` or `step_id`, risk tier, and approved action scope. A typed confirmation expires after the current pending approval decision and cannot be reused for retries, widened scope, policy/config mutation, plugin migration, or specialist review packets adjacent to legal/regulatory/patent decisions.

Typed confirmation is required by default for critical-risk writes, destructive operations, broad auth/security changes, policy/config mutation, plugin install/migration, specialist review packets adjacent to legal/regulatory/patent decisions, and any action whose scope is wider than the current plan.

No approval mode, including typed confirmation, may authorize legal advice, patentability or freedom-to-operate opinions, regulatory compliance or clearance claims, clinical claims, filing/submission decisions, market-release decisions, or product decisions.

## 10. Runtime Echo and Artifact Trust

Required echo evidence:

1. `workflow_id`, `step_id`, `attempt_id`, and correlation id.
2. Runtime agent id.
3. Runtime model id.
4. Provider-qualified FlowDesk model id.
5. Runtime variant or reasoning setting when required.
6. Runtime capability snapshot id or compatible runtime version/provider config hash.
7. Command shape hash generated before dispatch.

If any field is missing, mismatched, malformed, truncated, or sourced only from model text, mark the result `execution_echo_untrusted` and quarantine artifacts. Quarantined attempts cannot update evaluation as success.

OpenCode 1.14.40 PoC result: `chat.params` and `chat.headers` reached a fake OpenAI-compatible provider, including a conformance header. This proves request-surface header/parameter plumbing for the fake provider path. It does not prove trusted runtime echo for a real external provider, actual model execution identity, or production dispatch success.

## 11. Audit Contract

Audit is redaction-first. Callers submit typed safe fields and artifact references, not arbitrary nested payloads.

Reject audit events containing any forbidden persisted payload from section 3.2, including:

1. Unknown nested objects.
2. Forbidden keys.
3. Prompt-like bodies.
4. Provider payloads or provider quota payloads.
5. Credential-shaped values.
6. Tool args/results.
7. Stack traces.
8. Runtime echoes.
9. Transcript fragments.

Audit writer rejection is fail-closed for the triggering operation. If an operation requires an audit event and the event is rejected, cannot be redacted, or cannot be written durably, FlowDesk must block dispatch or quarantine the attempt. It must not continue with an unaudited privileged action.

`flowdesk_export_debug` may export only a redacted diagnostic bundle. The bundle must exclude every forbidden persisted payload from section 3.2 unless a field is explicitly classified safe by schema.

Allowed Release 1 persisted artifact field allow-list:

| Artifact type | Allowed top-level fields | Explicitly forbidden |
|---|---|---|
| `audit_event` | `schema_version`, `event_id`, `event_type`, `workflow_id`, `attempt_id`, `step_id`, `created_at`, `actor_class`, `policy_ref`, `decision_ref`, `redaction_version`, `summary_label`, `artifact_refs` | arbitrary `payload`, nested provider/tool/runtime objects, raw prompt/body/path fields |
| `audit_record` | `schema_version`, `audit_ref`, `event_id`, `workflow_id`, `attempt_id`, `step_id`, `checkpoint_id`, `event_type`, `created_at`, `actor_class`, `summary_label`, `policy_ref`, `decision_ref`, `evidence_refs`, `artifact_refs`, `redaction_version` | raw audit payloads, nested provider/tool/runtime objects, prompt bodies, raw paths, stack traces |
| `debug_export_manifest` | `schema_version`, `export_id`, `manifest_ref`, `workflow_id`, `session_ref`, `created_at`, `delete_after`, `included_sections`, `redaction_version`, `source_refs`, `file_count`, `byte_count`, `warnings`, `deletion_state`, `deletion_proof_ref`, `partial_deletion_warning`, `audit_refs` | raw logs, stack traces, transcripts, provider bodies, tool args/results, raw paths |
| `doctor_report` | `schema_version`, `run_id`, `checked_at`, `profile`, `category_results`, `disabled_modes`, `compatibility_ref`, `safe_next_actions` | credentials, provider response bodies, raw config values, raw filesystem paths |
| `plan_summary` | `schema_version`, `plan_revision_id`, `workflow_id`, `created_at`, `goal_summary`, `scope_summary`, `risk_tier`, `required_approvals`, `step_summary_refs`, `verification_summary` | raw prompt text, raw file contents, raw paths, issue/PR/repo/org names |
| `lane_summary` | `schema_version`, `lane_id`, `workflow_id`, `plan_revision_id`, `attempt_id`, `task_ref`, `lane_class`, `state`, `created_at`, `started_at`, `updated_at`, `completed_at`, `event_refs`, `audit_refs`, `refs`, `log_ref`, `debug_ref`, `failure_class`, `safe_next_action` | raw prompts, transcripts, raw logs, tool args/results, provider payloads, runtime echoes, stack traces, raw file contents, raw paths |
| `verification_summary` | `schema_version`, `verification_id`, `workflow_id`, `attempt_id`, `result`, `check_labels`, `artifact_refs`, `failure_category`, `safe_next_actions` | command output, stack traces, tool results, runtime echo payloads |
| `usage_snapshot` | `schema_version`, `snapshot_id`, `provider_family`, `model_family`, `freshness`, `freshness_ttl`, `reset_time`, `reset_bucket`, `dispatchability`, `uncertainty_flags`, `source_ref` | auth headers, account ids, quota response bodies, raw local session excerpts |
| `provider_health_snapshot` | `schema_version`, `snapshot_id`, `provider_family`, `model_family`, `observed_at`, `freshness`, `freshness_ttl`, `source_surface`, `availability_state`, `failure_class`, `retry_after_bucket`, `runtime_config_ref`, `telemetry_ref`, `dispatchability`, `source_ref`, `safe_remediation` | raw provider errors, provider payloads, credentials, auth headers, account ids, raw logs, raw paths, stack traces |
| `status_summary` | `schema_version`, `workflow_id`, `state`, `current_step_id`, `blocker_summary`, `lane_summary_refs`, `usage_summary_ref`, `provider_health_summary_ref`, `checkpoint_id`, `safe_next_actions`, `audit_refs`, `debug_ref` | raw prompts, transcripts, raw logs, tool args/results, provider payloads, runtime echoes, stack traces, raw file contents, raw paths |
| `doctor_section_result` | `schema_version`, `run_id`, `section`, `category`, `summary`, `safe_next_actions`, `refs`, `redaction_version` | credentials, auth headers, provider response bodies, raw config values, raw filesystem paths, raw logs, stack traces |
| `debug_section_summary` | `schema_version`, `export_id`, `section`, `ref`, `redaction_status`, `warning_count`, `excluded_categories` | raw logs, stack traces, transcripts, provider bodies, provider errors, tool args/results, raw paths, raw file contents |
| `audit_ref_summary` | `schema_version`, `audit_ref`, `workflow_id`, `attempt_id`, `event_type`, `summary_label`, `created_at`, `redaction_version` | raw audit payloads, nested provider/tool/runtime objects, prompt bodies, raw paths, stack traces |
| `conformance_runtime_metadata` | `schema_version`, `opencode_version`, `opencode_commit`, `checked_at`, `plugin_package`, `plugin_version_or_commit`, `chat_intake_mode`, `command_alias_mode`, `dispatch_mode`, `runtime_echo_mode`, `event_telemetry_mode`, `provider_health_mode`, `fallback_reselection_mode`, `diagnostics_surface_mode`, `lane_observability_mode`, `hook_harness_mode`, `tui_mode`, `mode_fields`, `evidence_refs`, `disabled_modes` | raw evidence payloads, prompts, transcripts, raw paths, provider payloads |
| `conformance_evidence_record` | `schema_version`, `evidence_ref`, `run_id`, `checked_at`, `evidence_area`, `result`, `summary_label`, `redaction_version`, `source_refs` | raw evidence payloads, prompts, transcripts, raw paths, provider payloads, provider quota bodies, tool args/results, stack traces |
| `bootstrap_install_plan` | `schema_version`, `install_plan_id`, `created_at`, `target_profile_ref`, `release_mode`, `planned_phases`, `requires_typed_confirmation`, `confirmation_ref`, `package_ref`, `rollback_plan_ref`, `safe_next_actions` | raw install script, raw config/profile contents, credentials, provider auth entries, raw filesystem paths, raw command bodies |
| `bootstrap_report` | `schema_version`, `report_id`, `install_plan_id`, `target_profile_ref`, `started_at`, `completed_at`, `final_phase`, `status`, `failure_class`, `backup_manifest_ref`, `profile_mutation_ref`, `omo_cleanup_ref`, `command_generation_ref`, `config_scaffold_ref`, `rollback_plan_ref`, `rollback_result_ref`, `doctor_handoff_ref`, `doctor_report_ref`, `disabled_modes`, `safe_next_actions`, `audit_refs` | raw OpenCode config/profile contents, credentials, provider auth entries, raw filesystem paths, raw command bodies, prompts, transcripts, provider payloads, stack traces, runtime echoes |
| `bootstrap_backup_manifest` | `schema_version`, `backup_manifest_id`, `created_at`, `target_profile_ref`, `backup_ref`, `backup_hash`, `source_config_ref`, `credential_preservation_check`, `restore_eligible`, `audit_ref` | raw backup bytes, raw config/profile contents, credentials, provider auth entries, raw filesystem paths |
| `profile_mutation_summary` | `schema_version`, `mutation_id`, `target_profile_ref`, `status`, `changed_entry_refs`, `skipped_entry_refs`, `provider_auth_preserved`, `unrelated_profile_mutation`, `backup_manifest_ref`, `audit_ref` | raw before/after config, raw profile contents, credentials, provider auth entries, raw paths |
| `omo_cleanup_summary` | `schema_version`, `cleanup_id`, `target_profile_ref`, `status`, `removed_ref_count`, `retained_ref_count`, `blocked_ref_count`, `omitted_legacy_runtime_imports`, `provider_auth_preserved`, `backup_manifest_ref`, `audit_ref` | raw OMO prompt/agent/skill/task/team content, raw config/profile contents, provider auth entries, credentials, raw paths |
| `command_generation_summary` | `schema_version`, `generation_id`, `target_profile_ref`, `status`, `command_refs`, `template_hash`, `static_template_validation`, `alias_conformance_ref`, `rollback_ref` | raw command bodies, shell interpolation payloads, raw paths, provider calls, prompt bodies |
| `config_scaffold_summary` | `schema_version`, `scaffold_id`, `status`, `config_ref`, `config_hash`, `policy_pack_refs`, `policy_pack_hashes`, `audit_ref` | raw config values, raw Policy Pack payloads, credentials, raw paths |
| `bootstrap_rollback_plan` | `schema_version`, `rollback_plan_id`, `install_plan_id`, `target_profile_ref`, `backup_manifest_ref`, `reversible_phase_refs`, `non_reversible_summary_refs`, `restore_preconditions`, `safe_next_actions` | raw backup bytes, raw restore content, raw config/profile contents, credentials, raw paths |
| `bootstrap_rollback_result` | `schema_version`, `rollback_result_id`, `rollback_plan_id`, `completed_at`, `status`, `restored_ref_count`, `skipped_ref_count`, `warning_count`, `audit_refs`, `safe_next_actions` | raw restored content, raw config/profile contents, credentials, provider auth entries, raw filesystem paths |
| `doctor_handoff` | `schema_version`, `handoff_id`, `created_at`, `install_plan_ref`, `bootstrap_report_ref`, `config_ref`, `compatibility_ref`, `doctor_request_ref`, `safe_next_actions` | raw bootstrap payloads, raw config/profile contents, credentials, raw filesystem paths |

Every allow-listed string is bounded, schema-safe, and redacted. Any implementation need for a field outside this table must update this specification or a newer ADR before writing code.

Audit lifecycle uses two related schemas: `flowdesk.audit_event.v1` is the redacted writer input/event envelope, and `flowdesk.audit_record.v1` is the persisted `.flowdesk/sessions/<session_id>/audit.jsonl` line after redaction validation. `audit_ref_summary` is a bounded display/reference summary only. None of these artifacts can authorize dispatch, prove success, or replace Guard.

Debug export lifecycle uses `flowdesk.debug_export_manifest.v1` as the manifest for redacted debug bundles and `flowdesk.debug_section_summary.v1` for allow-listed sections. A debug export must block or omit any section that would require a forbidden payload; partial deletion or retention-by-policy must be represented in the manifest rather than by exposing raw paths or raw file contents.

Conformance lifecycle uses `flowdesk.conformance_runtime_metadata.v1` for the current compatibility artifact consumed by `/flowdesk-doctor` and `flowdesk.conformance_evidence_record.v1` for optional persisted redacted evidence lines. Conformance artifacts enable/disable modes and inform doctor output, but they are not Guard approval and cannot authorize dispatch or fallback by themselves.

Required initial event vocabulary:

```text
chat_intake_received
chat_intake_classified
workflow_auto_created_from_chat
natural_language_approval_recorded
plugin_command_received
workflow_plan_requested
workflow_authoring_lane_requested
workflow_authoring_lane_started
workflow_authoring_lane_completed
workflow_authoring_lane_failed
workflow_category_assigned
model_candidates_ranked
usage_portfolio_balance_computed
provider_health_observed
provider_health_degraded
provider_health_blocked
fallback_considered
fallback_blocked
reselection_required
guard_decision_recorded
plugin_dispatch_blocked
runtime_echo_validated
verification_recorded
artifact_disposition_recorded
model_performance_observed
category_fit_updated
workflow_proposal_created
workflow_proposal_set_created
workflow_proposal_scored
workflow_optimizer_advisory_selection_recorded
surplus_usage_gate_evaluated
github_score_ledger_updated
```

## 12. Agent and Model Contracts

Canonical built-in agent profiles:

```text
planner
executor
reviewer
verifier
adversary
security-reviewer
patent-specialist
meddev-regulatory-specialist
safety-risk-reviewer
legal-reference-validator
```

`reviewer` is canonical. Any legacy `critic` input must be resolved before dispatch through an explicit audited alias or by Policy Pack allowing both. `/flowdesk-doctor` fails when a plan, policy, and runtime capability disagree on `critic` versus `reviewer`.

Model candidates must be provider-qualified and include model id, provider, family, tier, runtime model id, supported runtime variants, reasoning depth, capabilities, and score breakdown.

### 12.1 Agent Profile Authoring Standard

FlowDesk agent definitions are capability profiles, not persona scripts and not document-navigation scripts. An agent profile must stand on its own with enough structured context for routing, safety, output validation, and handoff. It may reference relevant documentation as optional context, but it must not require an agent to read a fixed document path, ordered document list, OMO/OMC path, local user config path, or project-specific planning file before the profile is valid.

Every authored agent profile must define:

1. `agent_id`: stable kebab-case id. `reviewer` is the canonical review id.
2. `purpose`: one sentence describing the job.
3. `expertise`: the narrow domain where the profile is better than generic execution.
4. `categories`: workflow categories and difficulty/risk bands where the profile is eligible.
5. `use_when`: positive routing triggers.
6. `do_not_use_when`: exclusion cases and escalation boundaries.
7. `required_inputs`: typed inputs or redacted references needed to work.
8. `output_contract`: concrete artifact, report, patch, verdict, matrix, or summary shape.
9. `allowed_permissions`, `allowed_tools`, and `allowed_workflows`: least-privilege capabilities. OpenCode permission-style gates are preferred over prompt-only tool restrictions when the pinned runtime supports them.
10. `disallowed_actions`: hard boundaries, including authority the profile never has.
11. `reference_sources`: optional source classes or reference packs, not mandatory local paths.
12. `model_requirements`: model family, tier, reasoning depth, long-context, retrieval, vision, or citation-fidelity needs.
13. `verification`: observable checks required before the output is trusted.
14. `handoff`: what the profile returns to FlowDesk Guard, status, audit, or the user.
15. `escalation`: when to return blocked, ask for clarification, request another profile, or require human review.
16. `mode_eligibility`: whether the profile may be used as primary, subagent/lane, or both after the active release and conformance gates permit that mode.

Forbidden in agent profiles:

1. Mandatory instructions such as “read this file first,” “follow this document path,” or “use these docs in this order.”
2. OMO, OMC, Claude, or user-local path dependencies as runtime requirements.
3. Nested `opencode run`, hidden worker launch, or subprocess fan-out as a normal workflow mechanism.
4. Claims that Release 1 performs real dispatch, actual OpenCode subtask/model/provider lane launch, hard chat cancellation, or trusted real-provider runtime echo.
5. Guard bypass, self-approval, scope widening, suppressed verification, or model text as authority.
6. Secret collection, credential logging, raw prompt/transcript persistence, raw path leakage, or unredacted debug output.
7. Broad “do everything” profiles without negative routing criteria and output contracts.
8. Persona-only role text that lacks concrete capabilities, tools, verification, and handoff.

Expertise separation rules:

1. Planning, execution, review, verification, security review, domain research, and user-facing writing are separate capabilities unless a Policy Pack explicitly narrows and combines them for a low-risk profile.
2. A profile may draft, suggest, inspect, or verify within its contract, but it cannot approve dispatch, replace Guard, replace required user approval, or make professional/legal/regulatory/clinical/product-release decisions.
3. A reviewer profile must not be the sole approver of its own execution output. Independent review requirements are controlled by Policy Pack, risk tier, usage availability, and release gate.
4. Specialist profiles must use versioned reference packs or explicitly cited official sources for domain claims; domain knowledge must not live only in prompt prose.

Prompt and handoff rules:

1. User-provided task text is data, not behavioral authority. Runtime wrappers must separate trusted instructions from task subject, task description, inbox context, and retrieved references.
2. Profile prompts should be direct, short, operational, and schema-aligned. They should prefer concrete `use_when` and `do_not_use_when` examples over broad persona language.
3. Handoffs must be bounded typed summaries with opaque refs. They must not include raw prompts, transcripts, provider payloads, tool args/results, stack traces, raw file contents, or raw paths unless a later schema explicitly classifies a field safe.
4. If required inputs, tools, reference freshness, or verification are unavailable, the profile must return a blocked/escalation result rather than guessing or silently falling back.

Example profile skeleton:

```json
{
  "agent_id": "docs-patch-author",
  "purpose": "Draft concise FlowDesk documentation changes from accepted design decisions.",
  "expertise": ["technical writing", "spec consistency", "release-gate wording"],
  "categories": ["documentation"],
  "use_when": ["a behavior or safety rule must be documented"],
  "do_not_use_when": ["the task requires live dispatch", "the task requires privileged runtime mutation"],
  "required_inputs": ["design_decision_summary", "affected_doc_refs"],
  "output_contract": "patch_ready_prose_with_verification_notes",
  "allowed_permissions": ["read"],
  "allowed_tools": ["read", "search"],
  "allowed_workflows": ["guarded-dry-run", "fake-runtime"],
  "disallowed_actions": ["dispatch_approval", "guard_bypass", "mandatory_doc_path_requirement"],
  "reference_sources": ["provided_doc_refs", "normative_flowdesk_docs_when_available"],
  "model_requirements": { "tier": "standard", "capabilities": ["writing", "consistency_review"] },
  "mode_eligibility": ["primary", "subagent-after-conformance"],
  "verification": ["no Release 1 overclaim", "no forced document path", "redaction-safe output"],
  "handoff": "summary_for_guard_or_maintainer_review",
  "escalation": ["ambiguous release gate", "conflicting normative docs"]
}
```

## 13. Specialist Domain Boundaries

Patent and regulatory agents may:

1. Retrieve and summarize official sources.
2. Verify citations.
3. Build evidence matrices.
4. Identify issues and uncertainty.
5. Draft review packets for counsel or RA/QA.

They must not:

1. Give legal advice.
2. Provide patentability or freedom-to-operate opinions.
3. Claim regulatory compliance or clearance.
4. Approve clinical, market, filing, release, or product decisions.

Human review is mandatory before filings, submissions, claims, compliance assertions, or product decisions.

## 14. Installer and Doctor

The production installer must:

1. Backup active OpenCode configs.
2. Remove OMO plugins, aliases, local paths, and OMO-owned config references from the target profile.
3. Reject mutable plugin specs in production, including `@latest`, branch names, floating semver ranges, unpinned git URLs, and unreviewed local paths.
4. Disable unsafe OpenCode autoupdate for FlowDesk-managed production profiles unless lockfile and rollback policy are configured.
5. Install `@flowdesk/opencode-plugin` from a pinned version, tarball, or reviewed local build with integrity metadata.
6. Preserve provider authentication entries.
7. Run runtime capability discovery, provider-native usage checks, and provider health diagnostics.
8. Generate configured commands or command markdown files.
9. Write or validate `.flowdesk/config.json`.
10. Run `/flowdesk-doctor` and block `/flowdesk-run` plus automatic chat dispatch until doctor passes.

`/flowdesk-doctor` checks:

1. Plugin package identity and integrity.
2. OpenCode version or commit.
3. Chat-intake capability mode.
4. Command alias support and fallback availability.
5. Policy Pack load and schema validity.
6. Provider auth presence without leaking credentials.
7. Fresh usage snapshot availability.
8. Fresh Provider Health Snapshot availability and provider/API/model failure class.
9. Runtime capability artifact.
10. Event telemetry capability artifact for any release mode that enables real dispatch, event-dependent recovery, or chat routing.
11. Hook harness mode, required hook capability, and fail-closed behavior for `enforce`, `observe`, and `off`.
12. Plugin tool contract completeness and schema compatibility for every registered FlowDesk tool.
13. `critic`/`reviewer` compatibility.
14. Audit redaction writer health.
15. Reference pack registry validity when specialist workflows are enabled.
16. Evaluation store writability when evaluation is enabled.

Typed confirmation may allow mutable or local plugin specs only in an explicit development/test profile that disables production dispatch.

The installer and `/flowdesk-doctor` must independently enforce `engines.opencode` or equivalent compatibility metadata. FlowDesk must not rely solely on OpenCode to enforce compatibility, especially for local/file plugin installs.

Production package provenance must record package name, exact version or commit, source registry or tarball URL, lockfile entry, integrity hash, build provenance when available, dependency review status for dispatch-path dependencies, and rollback target.

The installer must emit redacted bootstrap artifacts using the canonical schema ids from section 6.6. `/flowdesk-doctor` consumes `flowdesk.doctor_handoff.v1` and `flowdesk.bootstrap_report.v1` refs as evidence, not as approval. A passing doctor result closes bootstrap authority; a failing doctor result keeps production run/chat dispatch disabled and points to rollback, safe manual recovery, or debug export. Doctor must not treat a bootstrap report, package provenance report, command-generation manifest, or rollback result as proof of runtime dispatch safety.

`/flowdesk-doctor` output should be grouped into four user-facing sections: migration cleanup, OpenCode/plugin compatibility, provider/usage readiness, and policy/project safety. Provider/usage readiness must show Usage Availability Snapshot state separately from Provider Health Snapshot state. Its mental model is one question: “Can FlowDesk safely run here?” In Release 1, a provider/API/model outage can block or degrade only the affected path and can point users to safe commands, but it must not trigger a real automatic provider/model switch.

Provider-family-specific status notes:

1. OpenCode Go diagnostics may tell users to connect or refresh OpenCode Go through documented OpenCode auth/model flows. They must not imply FlowDesk can spend, switch, or fall back across Go-backed models in Release 1.
2. z.ai diagnostics may tell users to configure Z.AI or Z.AI Coding Plan credentials and refresh OpenCode models. When z.ai quota, subscription, or account-specific model availability cannot be proven through an official machine-readable source, FlowDesk must report usage as unknown and stay on diagnostic, degraded, guarded dry-run, or fake-runtime paths.
3. Neither provider-specific note adds a new Release 1 registered tool or changes the shared provider/API/model failure vocabulary.

Common status and recovery copy:

| State | User-facing message template | Safe next actions |
|---|---|---|
| stale usage | `Blocked: provider usage is stale, so FlowDesk cannot safely choose a model.` | `/flowdesk-usage`, `/flowdesk-doctor` |
| missing provider auth | `Blocked: provider authentication or exact auth-scope evidence was not found or cannot be checked without exposing secrets. Affected models are excluded until auth readiness and real usage/quota/reset evidence are available.` | configure provider auth, `/flowdesk-doctor` |
| expired provider auth | `Blocked: provider authentication appears expired or rejected. FlowDesk cannot safely use this provider.` | refresh provider auth outside FlowDesk, `/flowdesk-doctor` |
| provider unavailable | `Degraded: the provider appears unavailable. Release 1 can show status, diagnostics, or fake-runtime output, but it will not switch providers automatically.` | `/flowdesk-status`, `/flowdesk-usage`, `/flowdesk-doctor` |
| rate limited | `Blocked: the provider reports a limit. FlowDesk will not fall back to another provider without a later release gate and Guard approval.` | wait for reset, `/flowdesk-usage`, `/flowdesk-status` |
| model unavailable | `Blocked: the selected model is unavailable for this provider or account.` | choose a supported model in OpenCode, `/flowdesk-doctor` |
| transport timeout | `Degraded: the provider request or stream timed out. Status and diagnostics remain available.` | `/flowdesk-status`, `/flowdesk-doctor`, `/flowdesk-export-debug` |
| OpenCode provider load failure | `Blocked: OpenCode could not load the configured provider or model list.` | refresh OpenCode models, check provider config, `/flowdesk-doctor` |
| telemetry ambiguous | `Blocked: FlowDesk cannot tell whether the provider, OpenCode, network, or telemetry path failed.` | `/flowdesk-status`, `/flowdesk-doctor`, `/flowdesk-export-debug` |
| chat intake disabled | `Chat-managed dispatch is unavailable in this profile. Use command mode.` | `/flowdesk-plan`, `/flowdesk-doctor` |
| chat steering only | `FlowDesk can route this request toward a guarded command-backed flow, but hard chat interception is not available in this profile.` | continue with routed command flow, `/flowdesk-plan`, `/flowdesk-doctor` |
| hook harness off | `Managed FlowDesk automation is off. Safe manual setup, status, recovery, diagnostics, and fallback commands are still available.` | `/flowdesk-status`, `/flowdesk-plan`, `/flowdesk-doctor` |
| hook harness failure | `Blocked: FlowDesk could not prove that its hook harness can contain this request.` | `/flowdesk-doctor`, `/flowdesk-status`, `/flowdesk-export-debug` |
| untrusted runtime echo | `Execution result is quarantined because the runtime model or agent could not be proven.` | `/flowdesk-status`, `/flowdesk-export-debug`, retry after conformance fix |
| verification failed | `Verification failed. FlowDesk can retry with the failure output, show details, or abort.` | `/flowdesk-retry`, `/flowdesk-status`, `/flowdesk-abort` |

## 15. Conformance Test Matrix

Before enabling production dispatch, implement tests for:

1. `chat_intake_mode: blocking` prevents unguarded assistant execution.
2. `chat_intake_mode: steering` can mutate/route normal requests into a FlowDesk envelope and can abort unsafe dispatch through a proven throw path, without claiming hard no-reply/cancel authority.
3. `observe_only` blocks managed natural-chat dispatch.
4. Hook failure fails closed and is user-visible.
5. Unsupported `noReply`, `cancel`, and `stop` fields are never treated as cancellation authority.
6. `/flowdesk:*` aliases work or portable fallback commands are installed.
7. Command execution calls the intended plugin tool.
8. Generated command templates reject shell interpolation or equivalent pre-hook execution.
9. Tool before/after hooks cannot authorize dispatch.
10. Model-driven built-in tool calls can be denied by policy hooks with zero side effect in tested paths.
11. Runtime echo evidence is collected from trusted OpenCode runtime surfaces.
12. Fake-provider request headers/params are recorded separately from trusted runtime echo.
13. Missing runtime model/agent evidence quarantines artifacts.
14. Stale usage blocks dispatch.
15. Non-dispatchable Provider Health Snapshot blocks real dispatch and managed fallback/reselection.
16. Natural-language approval rejects silence, acknowledgements, hidden comments, and widened scope.
17. Typed confirmation is required for critical-risk actions.
18. Audit writer rejects forbidden nested payloads.
19. OMO plugin/config remnants block production doctor.
20. Mutable plugin specs block production install; development/test confirmation disables production dispatch.
21. `critic`/`reviewer` mismatch blocks dispatch.
22. Local/file plugin installs are independently checked for OpenCode compatibility.
23. Minimum harness telemetry surfaces are available and correlated before real dispatch, managed fallback/reselection, or event-dependent recovery is enabled.
24. Event hooks are used as telemetry/coordination prerequisites but not as Guard, dispatch, durable audit, or sole runtime echo authority.
25. TUI surfaces are not treated as runtime echo evidence.
26. Real dispatch is blocked when the pre-dispatch audit event cannot be durably written.
27. Event-only `completed` telemetry cannot mark workflow complete, promote artifacts, or count as execution success.
28. Event-derived checkpoints are not resumable without durable FlowDesk state and audit references.
29. Hook harness `enforce` mode denies, rewrites, or routes unsafe tool/command/chat attempts and fails closed on hook failure.
30. Hook harness `observe` mode never enables privileged automation that depends on containment.
31. Hook harness `off` mode disables managed and privileged automation and does not bypass Guard.
32. Every registered plugin tool has request and response schemas, privilege class, state preconditions, state outputs, redacted error shapes, and passing schema compatibility tests.
33. Workflow taxonomy stores separate axes for category, difficulty drivers, coupling, algorithmic hardness, architecture hardness, migration/state hardness, domain uncertainty, verification hardness, operational risk, and policy/professional boundary.
34. Workflow optimizer scores cannot override Guard, policy, usage, runtime compatibility, conformance, or human approval.
35. Multi-model proposal fan-out is blocked unless the surplus usage gate passes with fresh provider-native dispatchable usage, fresh provider health where provider/model selection is involved, preserved reserve, budget cap, explicit opt-in, and a redacted prompt envelope.
36. Future managed fallback/reselection is blocked unless fresh provider-native usage, fresh provider health, runtime compatibility, policy eligibility, trusted binding/echo, sufficient telemetry, durable pre-dispatch audit, a new attempt id, and explicit Guard approval all pass.
37. GitHub score ledger tests prove private repo JSONL stores only redacted schema-safe fields, reusable rollups come only from sealed partitions, canonical event hash chains and trusted chain heads detect tampering, duplicate replays cannot inflate aggregates, Actions artifacts are temporary, Pages summaries are aggregate only, GitHub workflows use least-privilege permissions, and external managed database access uses OIDC or an approved workload identity path with a cutover manifest and ingestion watermark.

## 16. Release Tracks and Implementation Sequence

### Release 1: General-Use MVP

Release 1 includes:

1. Installer bootstrap with backups and OMO cleanup report.
2. Chat-routed command-backed workflows for planning, guarded dry-run, fake-runtime execution, status, recovery, and diagnostics.
3. `/flowdesk-doctor`, `/flowdesk-plan`, `/flowdesk-run`, `/flowdesk-status`, `/flowdesk-resume`, `/flowdesk-retry`, `/flowdesk-abort`, `/flowdesk-usage`, and `/flowdesk-export-debug` portable fallback command path.
4. Hook harness `enforce`, `observe`, and `off` modes with fail-closed behavior.
5. Redaction-first audit and redacted debug export.
6. Provider usage snapshot checks sufficient to prove fail-closed behavior.
7. Provider Health Snapshot diagnostics for auth, provider, API, model, timeout, OpenCode provider-load, and ambiguous telemetry failures.
8. OpenCode conformance artifact reporting `blocking`, `steering`, `observe_only`, or `off`.
9. User manual abnormal-use examples and safe alternatives.

Release 1 excludes:

1. Real OpenCode runtime dispatch.
2. Hard chat cancellation or no-reply authority through unsupported `noReply`, `cancel`, or `stop` fields.
3. Automatic provider/model fallback or reselection.
4. Evaluation-based ranking or workflow optimization as approval. Event, taxonomy, proposal, provider health, fallback decision, and score shape scaffolding is allowed only when it cannot authorize dispatch or switch providers/models.
5. Patent, legal, or medical-device specialist workflows.
6. Optional MCP connector execution.

Release 2 Managed Dispatch Beta must satisfy the later definition of done in section 17.2 before any real OpenCode dispatch is enabled.

### Phase 0: Bootstrap

1. Create repo/package workspace.
2. Add TypeScript/build/test tooling.
3. Add project docs and ADR for plugin-first packaging.
4. Port only project-agnostic contracts from `dex-conductor`.

Exit criteria: workspace typecheck and tests run.

### Phase 1: Core Contracts

1. Implement workflow, Guard, usage snapshot, provider health snapshot, runtime capability, dispatch, echo, audit, and checkpoint types.
2. Add validators.
3. Add `reviewer` canonical profile and audited `critic` migration rule.

Exit criteria: contract tests pass.

### Phase 2: Policy, Usage, Audit

1. Implement config schema and Policy Pack loader.
2. Implement usage snapshot and provider health snapshot interfaces with initial diagnostic collectors.
3. Implement redaction-first audit writer.

Exit criteria: malformed config, stale usage, non-dispatchable provider health, and unsafe audit payloads fail closed.

### Phase 3: OpenCode Plugin Command Path

1. Implement plugin package skeleton.
2. Implement plugin tools.
3. Generate configured commands and fallback command names.
4. Implement `/flowdesk-doctor`, `/flowdesk-plan`, `/flowdesk-run`, `/flowdesk-status`, `/flowdesk-resume`, `/flowdesk-retry`, `/flowdesk-abort`, `/flowdesk-usage`, and `/flowdesk-export-debug` command path first.

Exit criteria: command-driven guarded dry-run and one fake-runtime execution pass.

### Phase 4: OpenCode Conformance

1. Pin OpenCode version or commit.
2. Test chat hook event ordering, steering semantics, and blocking semantics.
3. Test command parser aliases.
4. Test trusted runtime echo source.
5. Test the minimum harness telemetry surfaces for lifecycle, message progress, tool activity, permission/shell/command activity where applicable, and failure/cancellation signals.
6. Test provider/API/model failure observation and classification without treating event hooks or provider health as fallback approval.
7. Test plugin tool schema compatibility for every registered FlowDesk tool, including crash-free conversion before provider dispatch.

Exit criteria: conformance artifact records `blocking`, `steering`, `observe_only`, or `off` with evidence.

### Phase 5: Managed Dispatch Beta Gate

1. Prove a trusted OpenCode model/agent binding path.
2. Prove trusted runtime echo source.
3. Prove minimum harness telemetry surfaces are available and correlated within policy tolerance.
4. Require fresh Usage Availability Snapshot and fresh Provider Health Snapshot before any provider/model binding.
5. Enable `real-opencode-dispatch` for a single low-risk command-driven step.
6. Keep hard chat dispatch disabled unless Phase 4 also proves blocking chat intake; Release 1 chat routing remains limited to command-backed workflows unless promoted by a later gate.

Exit criteria: `/flowdesk-run` can execute one low-risk Guard-approved step in OpenCode and quarantine results when runtime evidence is incomplete.

### Phase 6: Chat UX Hardening

1. Enable `chat_intake_mode: blocking` only when Phase 4 proves it; otherwise keep Release 1 `steering` limited to command-backed routing.
2. Implement `fast_chat`, `managed_plan`, `clarify`, and `blocked` responses.
3. Implement natural-language approval and typed confirmation gates.
4. Implement retry/resume/abort/status recovery loop.

Exit criteria: natural-language request can create a guarded plan and execute one approved step with audit and verification.

### Phase 7: Operational Intelligence

1. Implement append-only evaluation event store.
2. Implement derived advisory snapshots.
3. Add reference-pack schemas and minimal patent/medical-device registries.
4. Add optional connector interface.

Exit criteria: evaluation can rank eligible candidates without overriding Guard; specialist workflows fail closed on stale or missing references.

## 17. Definitions of Done

### 17.1 Release 1 General-Use MVP

1. OMO removal installer path exists and is tested on a disposable OpenCode profile.
2. `/flowdesk-doctor` blocks unsafe installs.
3. Chat-routed command-backed flow works for normal planning and safe run requests when conformance supports steering.
4. `/flowdesk-run` performs guarded dry-run or fake-runtime dispatch only.
5. Guard approval is required for every privileged operation.
6. Usage snapshot logic proves stale/unknown/refused states fail closed.
7. Provider Health Snapshot logic proves auth missing/expired, provider unavailable, rate limited, model unavailable, transport timeout, provider error, OpenCode provider-load failure, and telemetry ambiguous states are diagnostic or non-dispatchable as specified.
8. Audit is complete and redacted.
9. Recovery commands work for blocked, failed verification, retry, resume, and abort states in fake-runtime mode.
10. OpenCode conformance report records whether chat intake, chat steering, command aliases, provider health mode, fallback/reselection mode, diagnostics surface mode, and runtime echo are production-eligible.
11. Hook harness `enforce`, `observe`, and `off` modes behave as specified, including fail-closed behavior and safe manual fallback.
12. Every registered production tool has passing schema compatibility for the pinned OpenCode version.
13. Delegated lane output is limited to records, fake-runtime summaries, command/status summaries, or degraded fallback unless managed-dispatch gates explicitly permit actual lane launch.
14. Real dispatch, automatic provider/model fallback, hard chat cancellation/no-reply authority, evaluation scoring authority, workflow optimization authority, and specialist workflows remain disabled by default.

### 17.2 Release 2 Managed Dispatch Beta

1. OMO removal installer path exists and is tested on a disposable OpenCode profile.
2. `/flowdesk-doctor` blocks unsafe installs.
3. Chat-routed command-backed flow and fallback commands both work.
4. Any hard chat-managed mode is enabled only with conformance evidence.
5. Guard approval is required for every privileged operation.
6. Usage is provider-native and fresh.
7. Provider health is fresh, provider-native or OpenCode-native where applicable, and separately checked from usage.
8. Runtime echo trust is enforced.
9. Minimum harness event telemetry is conformance-proven for the enabled real-dispatch, recovery, and managed fallback/reselection modes.
10. Managed fallback/reselection, if enabled, requires a new attempt id, fresh usage, fresh provider health, runtime compatibility, policy eligibility, trusted binding/echo, durable pre-dispatch audit, and explicit Guard approval.
11. Audit is complete and redacted.
12. Recovery commands work for blocked, failed verification, retry, resume, and abort states.
13. Evaluation and reference-pack features are advisory/source-grounded and cannot approve dispatch.

### 17.3 Release 3 Operational Intelligence

1. Evaluation ranks only already-eligible candidates.
2. Evaluation cannot authorize dispatch or override Guard, usage, policy, runtime compatibility, review diversity, or human approval.
3. Workflow optimizer compares `simple`, `standard`, `detailed`, and `high_assurance` proposals using the normative taxonomy and advisory score dimensions only.
4. Multi-model proposal fan-out is gated by explicit opt-in, fresh provider-native usage, preserved reserve, budget cap, runtime compatibility, policy allowance, and a redacted prompt envelope.
5. GitHub-backed score storage is limited to low-volume private JSONL ledgers, sealed-partition rollups, temporary Actions artifacts, and sanitized Pages summaries unless an external managed database is used through OIDC or another approved workload identity path with an explicit cutover manifest.
6. Recovery signals remain tied to durable FlowDesk state, audit references, and trusted runtime evidence where required.
7. Specialist reference-pack workflows stay source-grounded and cannot provide legal, patentability, FTO, compliance, clearance, clinical, release, or product decisions.

## 18. First Files to Create

```text
package.json
tsconfig.base.json
packages/core/package.json
packages/core/src/types.ts
packages/core/src/contracts.ts
packages/core/src/guard.ts
packages/policy-engine/package.json
packages/policy-engine/src/config.ts
packages/policy-engine/src/audit.ts
packages/usage/package.json
packages/usage/src/types.ts
packages/evaluation/package.json
packages/evaluation/src/types.ts
packages/opencode-plugin/package.json
packages/opencode-plugin/src/index.ts
packages/opencode-plugin/src/tools.ts
packages/opencode-plugin/src/chat-intake.ts
packages/opencode-plugin/src/doctor.ts
packages/opencode-plugin/src/commands.ts
packages/test-harness/package.json
packages/test-harness/src/fake-opencode.ts
policy-packs/generic-starter/package.json
reference-packs/schemas/reference-pack.schema.json
docs/START_HERE.md
docs/USER_MANUAL.md
docs/FLOWDESK_OPENCODE_PLUGIN_IMPLEMENTATION_SPEC.md
docs/OPENCODE_CONFORMANCE_PLAN.md
docs/IMPLEMENTATION_ROADMAP.md
docs/THREAT_MODEL.md
```

## 19. Deferred Decisions and Release Gates

These items are not open blockers for Release 1 documentation or scaffolding. They are explicit gates that must be resolved before the affected implementation step starts:

1. **OpenCode tool schema subset:** Release 1 uses FDS-1 through FlowDesk runtime-closed validation. OpenCode provider-facing `additionalProperties: false` emission remains a caveat, while production tool registration stays disabled until production handlers and release gates are satisfied.
2. **Npm scope:** `@flowdesk/*` is the normative implementation target for Release 1. A private organization scope requires a newer ADR before package publication.
3. **Provider usage and health collectors:** Release 1 implements display/freshness/diagnostic contracts and fake/local fixtures. FlowDesk core now contains Release 2 candidate provider-native usage collector logic for Claude OAuth, Codex/OpenAI, and Gemini Code Assist, but real dispatch or managed fallback/reselection still requires live credentialed conformance binding, provider health collector integration, and production approval before `real-opencode-dispatch` is enabled.
4. **Reference-pack jurisdictions:** Specialist reference packs are not Release 1 scope. The first jurisdictions are a Release 4 gate and must be specified before any specialist workflow or `flowdesk_reference_search` registration.
