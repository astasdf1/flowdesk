# OpenCode Conformance Plan

## Purpose

FlowDesk must not enable real OpenCode dispatch or hard managed chat control based on assumptions. This plan defines the evidence required for a pinned OpenCode release or commit. Release 1 uses chat as the normal entry point and routes accepted requests into guarded command-backed FlowDesk workflows when mutation/throw behavior is proven, but it must not claim hard no-reply/cancel authority. FlowDesk also targets delegated workflow authoring so the main agent keeps only routing, compact summaries, Guard handoff, and safe next actions in context.

## Status

OpenCode 1.14.40 local isolated PoC completed on 2026-05-15, with an FDS-1 runtime-closed schema conversion probe added on 2026-05-18 and Release 1 packaging/bootstrap smoke evidence added on 2026-05-19. That Release 1 evidence supports a General-Use MVP with chat-routed command-backed workflows, tested hook-harness containment surfaces, FDS-1 compatibility through FlowDesk runtime-closed validation, package/bin smoke, public registry installation for version `0.1.0`, and non-dispatch command-backed production registration.

Separate Release 2 evidence includes core/adapter fake-client smoke evidence and live OpenCode 1.14.50 provider smoke evidence added on 2026-05-19. That later-gate evidence proves an opt-in adapter boundary can fail closed before dispatch and call the injected OpenCode SDK `session.prompt`/`promptAsync` surface only after all core gate evidence is present. The live smoke proves OpenAI provider dispatch through the official SDK surface and exposes provider/model identity in the response; direct CLI diagnostics can reach tested Anthropic Sonnet/Opus ids, pure headless SDK mode fails for Anthropic because it skips the local external Anthropic auth/provider plugin, and non-pure headless SDK mode succeeds for Anthropic Sonnet. OpenCode model catalog metadata is available, but it does not expose provider-native quota/reset authority or forward provider rate-limit headers through the SDK response. A FlowDesk-bound audit/gate smoke remains fail-closed when usage evidence is missing, a live-call ordering smoke proves durable audit write before live OpenAI SDK prompt, runtime echo/telemetry smoke validates redacted SDK response/session correlation against the current schemas, and internal collector unit evidence now covers Claude OAuth usage, Codex/OpenAI live usage, and Gemini Code Assist quota. Production Release 2 dispatch, hard managed chat control, provider/API/model managed fallback, actual lane launch, durable production-path echo/telemetry persistence, configured verification, credentialed live collector binding, and doctor-visible opt-in remain gated. See `conformance/2026-05-15-opencode-1.14.40-poc.md`, `conformance/2026-05-18-fds1-schema-conversion-probe.md`, `conformance/2026-05-19-release1-packaging-bootstrap-smoke.md`, `conformance/2026-05-19-release2-managed-dispatch-beta-core-adapter-smoke.md`, and `conformance/2026-05-19-release2-live-opencode-provider-smoke.md`.

Public npm publication update on 2026-05-21: `@flowdesk/core@0.1.0` and `@flowdesk/opencode-plugin@0.1.0` are published with `latest: 0.1.0`, public access, and fresh registry install smoke evidence. This resolves the public distribution blocker only; it does not promote real dispatch, actual lane launch, provider fallback, hard managed chat control, or production model selection.

Top-tier multi-perspective internal reviewer lanes are a planned Release 2.5 or Release 3 entry capability, not completed behavior. Current evidence does not prove production internal subtask review, registered highest-tier reviewer fan-out, same-model multi-agent perspective review, arbitrary agent/model override lanes, or release approval for those paths.

Source-surface inspection on 2026-05-21 found that the OpenCode SDK typings expose `session.create(parentID)`, `session.children`, agent/model session metadata, prompt/promptAsync `SubtaskPartInput`, SDK `noReply`, and SDK `session.abort`. It also found that `session.command` does not accept subtask parts in the inspected typings, no literal `subtask: true` runtime boolean was found, plugin chat hooks do not expose first-class hard no-reply/cancel return authority, and external auth plugin APIs must be sanitized because account/auth objects carry tokens. This is source-level API evidence only; runtime lane lifecycle, trusted echo, external auth policy binding, and hard chat suppression remain unproven.

## Outputs

Conformance produces a current compatibility artifact used by `/flowdesk-doctor`:

```text
.flowdesk/runtime/opencode-conformance.json
```

Minimum fields:

```json
{
  "schema_version": "flowdesk.conformance_runtime_metadata.v1",
  "opencode_version": "<version>",
  "opencode_commit": "<commit-if-known-omit-otherwise>",
  "checked_at": "<iso8601>",
  "plugin_package": "@flowdesk/opencode-plugin",
  "plugin_version_or_commit": "<version-or-commit>",
  "chat_intake_mode": "blocking|steering|observe_only|off",
  "command_alias_mode": "portable_only|colon_alias_supported",
  "dispatch_mode": "none|fake-runtime|guarded-dry-run|command-steering|real-opencode-dispatch",
  "runtime_echo_mode": "none|trusted|untrusted|request_surface_only",
  "event_telemetry_mode": "none|partial|sufficient",
  "provider_health_mode": "none|diagnostic_only|dispatch_gate_ready",
  "fallback_reselection_mode": "disabled|diagnostic_only|guarded_real_dispatch_ready",
  "diagnostics_surface_mode": "none|status_only|doctor_usage_status|doctor_usage_status_debug",
  "lane_observability_mode": "none|command_summary|openable_refs",
  "hook_harness_mode": "enforce|observe|off",
  "tui_mode": "ux_only|unsupported",
  "mode_fields": ["top_tier_multi_perspective_review_mode=disabled|planned|conformance_ready|release_gate_ready"],
  "evidence_refs": [],
  "disabled_modes": []
}
```

The canonical schema for this artifact is `flowdesk.conformance_runtime_metadata.v1` / `FlowDeskConformanceRuntimeMetadataV1` in `docs/schemas/RELEASE_1_TOOL_CONTRACTS.md`. Persisted `redacted-evidence.jsonl` lines use `flowdesk.conformance_evidence_record.v1` / `FlowDeskConformanceEvidenceRecordV1`.

The current compatibility artifact is an input to `/flowdesk-doctor`. It is local runtime metadata, not a persisted conformance evidence bundle and not a Guard approval by itself.

Conformance run artifacts default to an isolated temporary directory. Persisted `.flowdesk/conformance/<run_id>` artifacts require explicit opt-in and may contain only redacted reports, compatibility artifacts, and evidence references. Raw prompts, transcripts, tool args/results, provider payloads, provider quota bodies, runtime echoes, stack traces, raw file contents, raw paths, branch names, issue or PR titles, repo or organization names, prompt-derived hashes, public unsalted identifiers, and stable cross-project identifiers are forbidden in persisted conformance artifacts unless a later schema explicitly marks a field safe.

`/flowdesk-doctor` must classify failures into:

1. `dispatch_blocking`: disables managed dispatch and any dependent automation.
2. `chat_mode_disable`: disables chat-routed or hard managed chat behavior while preserving safe command fallback.
3. `degraded_mode_warning`: allows safe read-only, planning, status, or fake-runtime paths with a user-visible warning.
4. `informational`: records non-blocking context.

Guard, audit durability, redaction, usage, provider health, policy, plugin schema compatibility, trusted runtime binding, trusted echo, and dispatch-critical conformance failures are `dispatch_blocking` for real dispatch. Chat-hook or chat-steering failures are `chat_mode_disable` unless they also affect command-backed safety. Release 1 provider/API/model outages are diagnostic, status, degraded, or fake-runtime signals only and must not trigger real automatic provider/model switching.

## Gate Resolution Queue

The remaining gates must be resolved in dependency order. A later gate cannot be used to justify an earlier one, and no gate may silently enable real dispatch, fallback/reselection, hard chat cancellation, actual lane launch, or production registration outside its explicit scope.

1. **Release 1 handler readiness:** completed for command-backed handlers for doctor, plan, run, status, resume, retry, abort, usage, and export-debug. Handlers validate requests, write only through scoped non-dispatch paths, and return schema-valid redacted results without real dispatch authority.
2. **Plugin schema evidence:** FDS-1 runtime-closed compatibility is the handler safety boundary. Provider-facing closedness remains a documented OpenCode 1.14.40 caveat, with FlowDesk-side runtime validation rejecting unknown properties before execution.
3. **Production non-dispatch registration:** completed only for command-backed non-dispatch handlers after doctor, schema, Guard, audit, policy, redaction, disabled-mode, and conformance checks. This gate still rejects `real-opencode-dispatch`, provider calls, actual lane launch, automatic fallback/reselection, and hard chat cancellation.
4. **Telemetry and runtime echo harness:** before real dispatch, prove correlated event/log/hook evidence for session id, message id, command/tool id, workflow id, attempt id, selected provider/model, tool schema hash, audit refs, and failure classes. Persist only redacted references and summaries.
5. **Single-step managed dispatch beta:** enable one low-risk real dispatch step only when trusted binding, trusted runtime echo, sufficient telemetry, fresh usage, fresh provider health, Guard approval, durable pre-dispatch audit, configured verification, and quarantine-on-ambiguity all pass.
6. **Hard managed chat and cancellation:** prove `blocking` chat/no-reply/cancellation with e2e evidence for no duplicate assistant reply, pending tool abort, lane cleanup, and audit state transitions. Until then, chat remains steering and abort remains best-effort.
7. **Actual delegated lane launch:** promote lane launch only after managed dispatch also proves task ref capture, reference-kind separation, incomplete-result detection, timeout/correlation handling, redacted status/debug refs, and bounded retry behavior.
8. **Dedicated top-tier multi-perspective reviewer lanes and arbitrary overrides:** promote only after actual delegated lane launch also proves internal `subtask: true` or injected SDK/client routing, explicit agent binding, concrete provider-qualified model ids, binding registry evidence, fresh auth/usage/quota evidence, fresh provider health, runtime echo, telemetry persistence, typed reviewer output schema, same-model multi-agent perspective separation, no silent fallback, and no `opencode run` production path. Registered highest-tier models drive the model set; missing unregistered providers do not block review by themselves.
9. **Managed fallback/reselection:** keep automatic provider/model switching last. It requires every real-dispatch gate plus runtime compatibility, policy eligibility, fresh usage, fresh provider health, durable pre-dispatch audit for the new binding, a new attempt id, and explicit Guard approval.

Each queue item must produce a redacted conformance artifact, a doctor-consumable compatibility result, and tests proving both the pass path and fail-closed behavior before the next gate is promoted.

## Required Evidence Areas

### 1. Plugin Loading

Questions:

1. Can OpenCode load FlowDesk as an npm plugin?
2. Can OpenCode load FlowDesk as a local/file plugin for development?
3. Does `exports["./server"]`, `exports["."]`, or `main` resolve as expected?
4. Does OpenCode enforce `engines.opencode` for npm package plugins?
5. Does FlowDesk independently reject incompatible local/file plugin installs?

Pass criteria:

1. Npm plugin load succeeds with pinned package identity.
2. Local/file plugin load is marked development/test unless doctor independently validates compatibility.
3. Incompatible OpenCode version blocks production dispatch.

Fail behavior:

1. `/flowdesk-doctor` fails production readiness.
2. Installer may allow local/file path only in development/test profile with production dispatch disabled.

### 2. Command Parsing and Command Files

Questions:

1. Do portable commands such as `/flowdesk-doctor` resolve reliably?
2. Do desired aliases such as `/flowdesk:doctor` resolve reliably?
3. Can configured commands call the intended plugin tools?
4. Are command markdown filenames with colon portable on target platforms?
5. Do command-level `agent`, `model`, and `subtask` fields route as expected?

Pass criteria:

1. Portable commands always work for Release 1.
2. Colon aliases are enabled only when parser and platform tests pass.
3. Command-to-tool mapping is deterministic.
4. Command-level `agent`, `model`, and `subtask` routing is used only after conformance proves routing/binding behavior and Guard approves the resulting binding.

Fail behavior:

1. Use portable commands only.
2. Mark `command_alias_mode` as `portable_only`.

### 2A. Installer Bootstrap Artifacts

Questions:

1. Does the installer write a redacted bootstrap install plan, backup manifest, profile mutation summary, OMO cleanup summary, command generation summary, config scaffold summary, rollback plan/result, bootstrap report, and doctor handoff using the canonical schema ids?
2. Are generated command entries or command markdown files static and free of shell interpolation or equivalent pre-hook execution forms?
3. Can rollback restore only selected-profile/config entries covered by the backup manifest while preserving provider authentication entries?
4. Does `/flowdesk-doctor` consume bootstrap report and doctor handoff refs as evidence without treating them as approval?

Pass criteria:

1. Bootstrap artifacts validate against `flowdesk.bootstrap_install_plan.v1`, `flowdesk.bootstrap_backup_manifest.v1`, `flowdesk.profile_mutation_summary.v1`, `flowdesk.omo_cleanup_summary.v1`, `flowdesk.command_generation_summary.v1`, `flowdesk.config_scaffold_summary.v1`, `flowdesk.bootstrap_rollback_plan.v1`, `flowdesk.bootstrap_rollback_result.v1`, `flowdesk.bootstrap_report.v1`, and `flowdesk.doctor_handoff.v1`.
2. Reports contain only opaque refs, keyed hashes, counts, phase labels, disabled modes, safe next actions, and redacted audit refs.
3. Bootstrap authority closes after a passing doctor result.

Fail behavior:

1. `/flowdesk-doctor` fails production readiness.
2. Managed run/chat dispatch remains disabled.
3. User sees safe rollback, manual recovery, doctor, or debug-export guidance only.

### 3. Chat Intake

Questions:

1. Does `chat.message` run before assistant execution?
2. Can FlowDesk prevent unguarded assistant execution for `managed_plan`, `clarify`, and `blocked` outcomes?
3. Does hook failure fail closed and show a user-visible message?
4. Are stable session/message/correlation ids available?
5. Can chat state survive compaction or session transitions where needed?

Modes:

1. `blocking`: FlowDesk can suppress, replace, or fully handle the turn before unguarded execution.
2. `steering`: FlowDesk can mutate or throw from chat hooks to steer normal requests into a FlowDesk envelope, but cannot prove hard no-reply/cancel authority.
3. `observe_only`: FlowDesk can observe context but cannot safely steer or prove control.
4. `off`: no usable chat intake.

OpenCode 1.14.40 PoC result:

1. `chat.message` mutation changes outgoing text.
2. `chat.message` throw aborts dispatch.
3. Unsupported `noReply`, `cancel`, and `stop` fields do not provide hard cancellation authority.
4. Resulting mode for Release 1 is `steering`, not `blocking`.

Pass criteria for hard managed chat control:

1. `chat_intake_mode` is `blocking`.
2. Failure is fail-closed.
3. Tests prove no duplicate unguarded assistant execution occurs.

Fail behavior:

1. Hard managed natural-language dispatch is disabled.
2. User is directed to command-backed routing, `/flowdesk-plan`, and `/flowdesk-doctor`.

### 4. Real Runtime Dispatch

Questions:

1. Can FlowDesk dispatch a step inside the active OpenCode runtime without nested `opencode run`?
2. Can the dispatch bind the exact Guard-approved agent and model?
3. Can dispatch be cancelled or timed out safely?
4. Can dispatch prevent runtime fallback unless Guard re-approves?
5. Can command shape hash or equivalent binding metadata be preserved?

Pass criteria:

1. `real-opencode-dispatch` can execute one low-risk command-driven step.
2. The actual agent/model binding is verified independently of model text.
3. Missing or mismatched binding quarantines output.

Fail behavior:

1. Real dispatch remains disabled.
2. `/flowdesk-run` stays guarded dry-run or fake-runtime only.

OpenCode 1.14.40 PoC result:

1. `command.execute.before` mutation changes outgoing text and supports command-backed steering.
2. `command.execute.before` throw prevents downstream chat dispatch in the tested path.
3. These outcomes support `command-steering` but do not prove `real-opencode-dispatch`.

### 5. Runtime Echo

Questions:

1. Which OpenCode runtime surface proves actual agent id?
2. Which OpenCode runtime surface proves actual model id?
3. Which surface proves runtime variant or reasoning setting?
4. Can runtime capability snapshot id or config hash be correlated?
5. Can the evidence be captured without raw prompts, transcripts, or provider payloads?

Pass criteria:

1. Echo includes workflow id, step id, attempt id, correlation id, runtime agent id, runtime model id, provider-qualified FlowDesk model id, runtime variant when required, capability snapshot id, and command shape hash.
2. Echo is not sourced only from model text.
3. Missing evidence marks `execution_echo_untrusted`.

Fail behavior:

1. Artifacts are quarantined.
2. Evaluation cannot count the attempt as success.

OpenCode 1.14.40 PoC result: `chat.params` and `chat.headers` reached a fake OpenAI-compatible provider, including a conformance header. This is `request_surface_only` evidence, not trusted runtime echo for a real external provider.

### 5A. Provider Health and Managed Fallback

Questions:

1. Can FlowDesk create a Provider Health Snapshot separate from a Usage Availability Snapshot?
2. Can provider/API/model failures be classified without storing raw provider errors, provider payloads, credentials, prompts, transcripts, raw runtime echoes, raw logs, raw file paths, or stack traces?
3. Can OpenCode provider-load failures, disabled providers, explicit provider/model settings, timeout/chunkTimeout settings, and model refresh state be diagnosed without treating them as fallback approval?
4. Can event observations for session, message, tool, provider, error, timeout, or cancellation surfaces inform status while remaining observational only?
5. Can future fallback/reselection prove fresh provider-native usage, fresh provider health, runtime compatibility, policy eligibility, trusted binding/echo, sufficient telemetry, durable pre-dispatch audit, a new attempt id, and explicit Guard approval?
6. Can OpenCode Go and z.ai diagnostics prove provider configuration, credential presence, model-list or static-catalog evidence, and failure classification without assuming quota APIs, scraping account consoles, or enabling fallback?

Release 1 required mode:

```text
provider_health_mode = diagnostic_only
fallback_reselection_mode = diagnostic_only
diagnostics_surface_mode = doctor_usage_status
```

Provider/API/model failure classes:

1. `auth_missing`.
2. `auth_expired`.
3. `provider_unavailable`.
4. `rate_limited`.
5. `model_unavailable`.
6. `transport_timeout`.
7. `provider_error`.
8. `opencode_provider_load_failure`.
9. `telemetry_ambiguous`.

Provider family diagnostic additions:

1. `opencode_go`: conformance records whether OpenCode documents and exposes the Go provider, configured model ids use the `opencode-go/<model-id>` form, credentials can be checked without leaking secrets, and the documented Go model endpoint or OpenCode model cache can be used as redacted model-list evidence. Any Go service-side balance, fallback, or model-substitution behavior is provider behavior only; FlowDesk Release 1 must not treat it as dispatch or fallback approval.
2. `z_ai`: conformance records whether Z.AI or Z.AI Coding Plan is configured through documented OpenCode auth/provider flows, whether the configured base URL and model label match official documentation or OpenCode model cache evidence, and whether documented z.ai HTTP/business errors map into the existing failure classes. Unless an official machine-readable quota/usage endpoint is proven, z.ai pre-dispatch usage availability is `unknown` and non-dispatchable for real provider/model selection.
3. For both providers, authenticated diagnostic probes are opt-in or conformance-only unless proven no-cost and low-impact. FlowDesk must not scrape billing, subscription, rate-limit, or console pages.
4. OpenUsage-style tools may inform conformance test design by showing how providers label source types and capability gaps. Conformance must distinguish provider API truth from local observed history, response accounting, header/rate-limit probes, browser-session console data, and inferred estimates. Browser cookie extraction, HAR capture, console scraping, undocumented provider endpoints, and unmerged OpenCode usage UI behavior are not valid Release 1 usage evidence.

Pass criteria for Release 1 diagnostics:

1. Provider Health Snapshot is first-class and separate from Usage Availability Snapshot.
2. `/flowdesk-doctor`, `/flowdesk-usage`, and `/flowdesk-status` can show redacted provider health state and safe next actions.
3. Provider/API/model failures can block or degrade only the affected Release 1 path.
4. No Release 1 conformance result enables automatic provider/model switching.
5. Event-hook observations are treated as situational awareness only. They do not approve dispatch, fallback, durable audit, or runtime echo.
6. OpenCode Go and z.ai diagnostics use the same Provider Health Snapshot and Usage Availability Snapshot contracts as other providers; provider-specific docs may explain evidence sources, but they do not add provider-specific dispatch authority.
7. Any DEX Conductor or external OpenUsage-compatible local API/cache is opt-in, loopback-only, version-pinned, redacted, and advisory to FlowDesk validation until a pinned conformance artifact proves the source is authoritative for the exact provider/model family, credential scope, reset bucket, and account/project boundary.
8. OpenCode model catalog metadata such as pricing, context, and capability fields is provider/model catalog evidence only. It is not provider-native usage, quota, remaining-budget, or reset-bucket evidence unless a pinned provider/API conformance artifact proves that authority for the exact provider/model family.
9. Provider-native usage collectors may use documented response rate-limit headers, documented provider admin usage/cost APIs, documented provider rate-limit APIs, documented cloud quota/monitoring APIs, or pinned DEX Conductor/OpenUsage evidence only when the credential scope, reset semantics, model-family mapping, account/project boundary, and redacted evidence refs are proven through `flowdesk.managed_dispatch_beta.usage_authority_evidence.v1`. OpenCode SDK response headers that omit provider rate-limit data do not satisfy the usage gate by themselves.
10. Every concrete provider/model eligibility path is auth- and usage-gated: absent OpenCode auth plugin/API key/OAuth readiness, provider load evidence, real usage/quota/reset acquisition, or exact account/auth scope binding maps to non-dispatchable diagnostics such as `auth_missing` or unknown usage and excludes those models without fallback or automatic reselection.
11. Actual model runs are connected only through the explicit opt-in `flowdesk_managed_dispatch_beta` server tool. The tool is registered only when `managedDispatchBetaAdapter` is enabled and an injected SDK client is present; default Release 1 registration remains non-dispatch.

Pass criteria for future Release 2+ managed fallback/reselection:

1. `fallback_reselection_mode` is `guarded_real_dispatch_ready`.
2. Fresh usage and fresh provider health are tied to the exact new provider/model family.
3. Runtime compatibility, policy eligibility, trusted binding/echo, sufficient telemetry, durable pre-dispatch audit, a new attempt id, and explicit Guard approval all pass.
4. Stale, unknown, refused, shared-limit-suspected, fallback-derived, model-generated, telemetry-ambiguous, policy-ineligible, runtime-incompatible, untrusted, unaudited, or Guard-rejected inputs block fallback.

Fail behavior:

1. Release 1 remains diagnostic/status/degraded/fake-runtime only.
2. Real dispatch and fallback/reselection stay disabled.
3. Users are directed to `/flowdesk-doctor`, `/flowdesk-usage`, `/flowdesk-status`, `/flowdesk-retry`, or `/flowdesk-export-debug` according to the safe next action.

OpenCode official evidence to preserve:

1. Plugin event hooks can observe session, message, tool, and related surfaces where the pinned version exposes them.
2. The event hook is observational and does not document retry, fallback, or dispatch authority.
3. `chat.params` and `chat.headers` are pre-request customization surfaces.
4. Provider timeout, chunkTimeout, enabled/disabled providers, explicit provider/model selection, and model refresh commands exist as runtime/config evidence surfaces.
5. There is no official evidence for plugin-level automatic cross-provider fallback.

### 6. Harness Telemetry Surfaces

Questions:

1. Are session lifecycle/status events available?
2. Are message progress events available?
3. Are tool before/after or equivalent tool activity events available?
4. Are permission, shell, or command events available where relevant?
5. Are error, cancellation, timeout, or failure events available?
6. Are events correlated to stable session/message/tool identifiers?
7. Are delays and lossiness within policy tolerance?

Required mode for real dispatch:

```text
event_telemetry_mode = sufficient
```

Harness telemetry may be collected from fire-and-forget plugin `event` observations, awaited trigger hooks such as `tool.execute.before/after` and `command.execute.before`, and session/message/status bus events exposed by the pinned OpenCode version. Event observations provide situational awareness for status, provider health suspicion, and recovery hints only.

Harness telemetry may be used for:

1. Heartbeat.
2. Stall detection.
3. Status updates.
4. Recovery hints.
5. Artifact quarantine triggers.
6. Runtime failure suspicion.
7. Audit correlation.

Harness telemetry must not be used for:

1. Guard approval.
2. Dispatch authorization.
3. Durable audit-write success.
4. Sole runtime echo evidence.
5. Sole proof of execution success.
6. Resumable checkpoint creation without durable FlowDesk state.
7. Provider/model fallback or reselection approval.

Pass criteria:

1. Minimum telemetry surfaces are available and correlated.
2. Event-only `completed` cannot mark success.
3. Event-derived checkpoint cannot resume without durable FlowDesk state and audit reference.
4. Event-only provider failure observations cannot trigger provider/model fallback.

OpenCode 1.14.40 PoC result: awaited command/chat/tool hooks are useful containment and coordination surfaces. Treat this as `partial` telemetry until correlated lifecycle, progress, tool, error, cancellation, and timeout evidence is proven for real dispatch.

Fail behavior:

1. Real dispatch is disabled.
2. Event-dependent recovery is disabled.
3. Safe status, abort, and debug export remain available.

### 7. TUI Surfaces

Questions:

1. Can TUI surfaces show toast or status feedback?
2. Can TUI prompt refs improve UX?
3. Are TUI events durable or transcript-backed?

Pass criteria:

1. TUI surfaces are used only as UX affordances.
2. No TUI surface is treated as runtime echo, durable audit, or dispatch authority.

Fail behavior:

1. TUI features are disabled without affecting command path.

### 7A. Plugin Tool Contracts

Questions:

1. Does every registered FlowDesk plugin tool define a request schema and response schema?
2. Does every tool declare `safe_read_only` or `privileged` before execution?
3. Are state preconditions and state outputs documented for each tool?
4. Are redacted error shapes defined and fixture-tested?
5. Does each schema convert through the pinned OpenCode tool path without crashing before provider dispatch?

Pass criteria:

1. Every registered tool has a request schema, response schema, privilege class, state preconditions, state outputs, and redacted error shapes.
2. Schema compatibility tests pass for every registered tool against the pinned OpenCode version, with FDS-1 compatibility defined by FlowDesk runtime-closed validation when provider-facing closedness is not emitted.
3. `/flowdesk-doctor` fails production readiness when a registered tool lacks a passing schema compatibility result.
4. Every Release 1 registered tool maps to a TypeScript interface name, JSON Schema id, fixture prefix, and artifact schema in `schemas/RELEASE_1_TOOL_CONTRACTS.md`.
5. Plugin tool args use the official Zod-based OpenCode custom tool API. Raw JSON Schema args, mixed Zod/raw args, unions, recursive schemas, nullable fields, transforms, and provider-specific schema tricks are rejected unless a pinned conformance report explicitly promotes them.
6. Unknown-property probes are rejected by FlowDesk handler/runtime validation before execution.

OpenCode 1.14.40 FDS-1 probe result: Release 1 minimum tools register and execute in sandbox probe mode without provider dispatch, and FlowDesk handler/runtime validation rejects unknown properties before execution. The provider-facing JSON Schema conversion does not emit `additionalProperties: false`; this is a documented caveat, not an FDS-1 runtime-closed compatibility blocker.

Custom plugin tool schema conversion spike artifact:

1. Records pinned OpenCode version or commit and FlowDesk version or commit.
2. Lists every tested tool name, request schema id, response schema id, FDS profile version, and fixture prefix.
3. Records whether the schema was authored through the Zod plugin tool API.
4. Records registry conversion result for every schema and whether conversion crashed before provider dispatch.
5. Records provider transform result for every provider/model family included in the spike, including whether provider-facing `additionalProperties` is missing/null or `false`.
6. Records runtime validation result for valid and invalid fixture args before tool execution, including unknown-property rejection.
7. Records whether field descriptions survive conversion sufficiently for safe model use.
8. Records redaction status and opaque evidence refs only.
9. Records a narrowed FDS profile when any currently allowed construct fails.
10. Is consumed by `/flowdesk-doctor` as production readiness input.

Minimum spike fixtures:

1. Required string with `.describe()`.
2. Optional string with `.describe()`.
3. String enum.
4. Number with min/max.
5. Boolean.
6. Array of strings.
7. Nested object with required and optional fields.
8. Unknown property rejection.
9. Secret-shaped and prompt-shaped redaction rejection.
10. Intentionally unsupported union, nullable, mixed Zod/raw, and raw JSON Schema args to document failure behavior.

Fail behavior:

1. The affected tool is not registered in production profiles.
2. Managed automation depending on the tool is disabled.
3. Safe command fallback remains available when the fallback does not depend on the failed tool.
4. If the spike narrows FDS-1, the implementation specification and schema appendix must be updated before Phase 3 production tool registration continues.

Sandbox-only production-shape tool registration may be used for conformance testing when it is explicitly marked `sandbox_conformance_probe_only`, returns non-authorizing blocked results, keeps production registries empty, and is reported by `/flowdesk-doctor` as production OpenCode registration disabled. Such probe registration is not production readiness evidence by itself.

### 7AA. Workflow Authoring Delegation and Lane Observability

Questions:

1. Can FlowDesk launch or request a planning, refinement, review, verification, or diagnostics subagent lane through command-level `agent`, `model`, and `subtask` configuration, custom tools, or another pinned OpenCode surface without relying on unproven real dispatch? Release 1 records this evidence but does not enable actual OpenCode subtask/model/provider lane launch unless a later real-dispatch gate promotes it.
2. Can FlowDesk capture an opaque lane id and task ref for each lane?
3. Can OpenCode event, hook, command, status, or TUI surfaces show lane state changes without raw prompts, transcripts, tool payloads, stack traces, or raw file contents?
4. Can FlowDesk detect failed launch, missing tool or agent, schema conversion failure, timeout, lost correlation, and abnormal exit through available event, hook, status, or command results?
5. Can `/flowdesk-status` show a compact lane summary with safe next actions?
6. Can OpenCode show clickable or openable markdown/file references to redacted lane summaries, or must FlowDesk use portable command and debug export fallback?
7. Can plugin `event`, command, message, session, tool, TUI, structured log, or command result surfaces detect failed lane launch, missing tool/agent/model/subtask binding, schema conversion failure, timeout, lost correlation, and abnormal exit?
8. Can FlowDesk distinguish background invocation handles from continuation/session handles for the pinned surface, reject reference-kind cross-use, and record invocation failure instead of treating it as a valid lane result?
9. Can FlowDesk detect a lane that completes after only tool calls or without the required verdict/deliverable, classify it as incomplete, and prevent it from counting as approval, QA, security review, verification, or implementation completion?
10. Can FlowDesk enforce bounded retry behavior for invocation/runtime failures without silently switching provider, model, authority class, or release gate?

Pass criteria for Release 1 lane summaries:

1. `lane_observability_mode` is `command_summary` or `openable_refs`.
2. `/flowdesk-status` can show lane id, workflow id, plan revision id, optional attempt id, task ref, lane class, state, timestamps, redacted event refs, audit refs, debug refs, failure class, and safe next action.
3. Missing launch, missing tool, schema conversion failure, timeout, lost correlation, and abnormal exit are represented in workflow state or audit when the surface exposes enough evidence.
4. Openable or clickable references are used only when the pinned OpenCode version proves they resolve to redacted summaries or debug refs. A native clickable task pane is not a Release 1 promise unless a later conformance artifact proves an official UI surface.
5. Raw lane prompts, transcripts, logs, tool args/results, provider payloads, runtime echoes, stack traces, raw file contents, and raw paths are excluded.
6. Distinct invocation and continuation reference kinds are recorded when the pinned runtime exposes them; cross-use is rejected and represented as `reference_kind_mismatch` or equivalent redacted failure evidence.
7. Invocation/runtime failures and incomplete lane outputs are represented as non-passing lane states. They cannot satisfy review, QA, security, verification, or approval gates.
8. Retry records show bounded retry count, corrected invocation metadata when applicable, fresh route/category retry when safe, and final degradation when retry limit is reached.

Fail behavior:

1. Set `lane_observability_mode` to `none` or `command_summary`, according to the evidence.
2. Use `/flowdesk-status` and `/flowdesk-export-debug` fallback instead of promising clickable UI.
3. Mark affected lane state as `blocked`, `failed`, `timed_out`, or `correlation_lost` when enough evidence exists; record `telemetry_unavailable` as `failure_class`, not as lane state.
4. Disable dependent actual lane launch if a required lane cannot be observed or safely summarized.
5. Keep command-backed planning available when it does not depend on the failed lane surface.
6. Treat aborted invocations, reference-kind mismatches, missing final verdicts, and tool-only completions as non-passing. Retry only within the bounded policy, then degrade to direct verification, status, retry planning, or debug export.

### 7AB. Agent Profile Authoring and Specialist Boundaries

Questions:

1. Does every built-in and Policy Pack agent profile define purpose, expertise, routing triggers, exclusion cases, required inputs, output contract, allowed tools/workflows, disallowed actions, verification, handoff, and escalation?
2. Does profile validation reject mandatory document-path traversal, ordered reading lists, OMO/OMC/user-local path dependencies, nested `opencode run`, and Release 1 real-dispatch claims?
3. Are planning, execution, review, verification, security review, specialist domain research, and user-facing writing profiles separated unless a Policy Pack explicitly narrows a low-risk combined profile?
4. Are specialist domain profiles backed by versioned reference packs or cited official sources rather than prompt-only persona claims?
5. Does `/flowdesk-doctor` fail readiness when a selected profile grants Guard authority, dispatch approval, self-approval, forbidden professional decisions, or raw-payload persistence?

Pass criteria:

1. Agent profile schema validation passes for every enabled built-in and Policy Pack profile.
2. Invalid profile fixtures fail closed with redacted diagnostics and safe next actions.
3. Profile selection is explainable through category, risk, required capabilities, output contract, and verification requirement rather than document path or persona name alone.

Fail behavior:

1. The invalid profile is disabled.
2. Workflows depending on the invalid profile are blocked or rerouted only to policy-compatible profiles.
3. `/flowdesk-doctor` reports `dispatch_blocking` when a required profile is invalid for a privileged workflow.

### 7AC. Dedicated Top-Tier Multi-Perspective Reviewer Lanes and Agent/Model Overrides

Questions:

1. Can FlowDesk launch a reviewer lane through internal OpenCode `subtask: true` command binding or an injected SDK/client path without nested `opencode run`?
2. Can the review request bind `agent: reviewer` plus every registered highest-tier available reviewer/model binding from the active registry and Policy Pack?
3. Can each binding resolve to a concrete provider-qualified model id from the model binding registry, not an alias, lower-tier substitution, or provider-hidden gateway?
4. Can arbitrary agent/model override requests be constrained by the same registry, Policy Pack, Guard evidence, usage, provider health, runtime echo, and telemetry gates?
5. Can each reviewer lane persist redacted runtime echo, telemetry, usage evidence refs, provider health refs, binding refs, output schema status, and final typed review verdict?
6. Can FlowDesk prove that reviewer lanes return typed critical review outputs only and do not approve dispatch, replace Guard, replace verification, or self-approve?
7. Can unavailable registered highest-tier reviewer bindings be excluded or blocked with explicit inventory evidence without silent degradation to a lower model, different provider, or unapproved fallback?
8. Can FlowDesk prove deterministic definitions for `registered`, `available`, `highest-tier`, reviewer perspective, same-model multi-agent assignment, maximum concurrency, cost budget, quota reserve, timeout, and retry budget?
9. Can each review run persist a redacted reviewer binding inventory snapshot showing registered, available, included, excluded, and blocked bindings plus perspective assignments with evidence refs and safe next actions?

Pass criteria:

1. `mode_fields` may report `top_tier_multi_perspective_review_mode=conformance_ready` or `release_gate_ready` only when the review run uses every registered highest-tier available reviewer/model binding and preserves the required reviewer perspective set. Missing unregistered providers do not block this mode.
2. Every reviewer lane has a concrete provider-qualified model id, runtime model id when different, canonical `reviewer` profile id, reviewer perspective id, dedicated binding label, auth evidence ref, usage/quota/reset evidence ref, Provider Health Snapshot ref, runtime echo evidence ref, telemetry ref, and output schema validation result.
3. The reviewer output schema includes findings, severity, evidence refs, uncertainty, required fixes, and verdict labels. The schema states that verdict labels are review outputs, not dispatch approval.
4. Arbitrary agent/model override lanes reject unregistered bindings, alias model ids, stale retired ids, missing auth, stale usage, missing quota/reset evidence, provider health failure, runtime echo mismatch, telemetry loss, and Policy Pack denial.
5. Production orchestration evidence comes from internal OpenCode `subtask: true` lanes or injected SDK/client calls. `opencode run` evidence is accepted only for diagnostics, smoke tests, compatibility probes, or fake-runtime harnesses.
6. No silent fallback occurs. A blocked reviewer lane returns a safe next action such as refresh usage, wait, reduce scope, choose human review where policy permits, retry with the same approved binding after fresh evidence, or stop.
7. `Registered` means enrolled in the model binding registry and enabled by the active Policy Pack. `Available` means the same binding has fresh auth, usage/quota/reset, provider health, runtime compatibility, runtime echo, telemetry, and budget/reserve evidence for the run. `Highest-tier` means registry-marked highest review tier for the provider or model family after conformance proves concrete id and capability metadata.
8. The registered highest-tier available model set drives model fan-out. If only one highest-tier model is registered and available, FlowDesk must still run multiple reviewer perspectives against that model with separate lane records. If maximum concurrency, cost budget, quota reserve, timeout, or retry budget cannot include every registered highest-tier binding and required perspective, the run blocks or asks for an explicit policy-compatible configuration change.
9. A redacted reviewer binding inventory snapshot records registered, available, included, excluded, and blocked bindings, plus perspective assignments, highest-tier eligibility refs, availability refs, budget/concurrency decisions, and safe next actions.

Fail behavior:

1. Set the `mode_fields` entry `top_tier_multi_perspective_review_mode` to `disabled` or `planned`.
2. Keep Release 1 command-backed non-dispatch behavior unchanged.
3. Keep Release 2 managed dispatch beta opt-in and blocked for any path that depends on failed review lane evidence.
4. Degrade to status, debug export, retry planning, or human review where policy permits. Do not replace the missing reviewer with another provider, model family, lower tier, or generic `reviewer` lane without a new Guard-approved binding.

### 7B. Workflow Optimization and Score Storage

Questions:

1. Can FlowDesk create `WorkflowPlanProposal` and `ProposalSet` records while enforcing the canonical forbidden persisted payload list from the implementation spec section 3.2?
2. Can multi-model proposal fan-out prove fresh provider-native usage, configured reserve, project budget cap, policy/user opt-in, runtime compatibility, and redacted prompt envelope before any provider call?
3. Can proposal scoring prove that scores are advisory only and cannot make ineligible candidates eligible?
4. Can accumulated score reuse prove normalized aggregation, minimum sample count, task-signature match, recency/decay, confidence threshold, scorer diversity, policy/taxonomy compatibility, and recent-failure checks before scores influence workflow/model ranking?
5. Can fan-out cadence controls prove rolling-window caps, task/category cooldown, novelty requirement, cost threshold confirmation, and backoff before any provider call?
6. Can GitHub-backed ledgers write only schema-safe JSONL events and handle raw partitions, sealed immutable partitions, rotation, retention, archives, append conflicts, duplicate events, GitHub workflow permissions, and migration triggers without data loss or unsafe retries?
7. Can GitHub-backed rollup compaction derive normalized advisory snapshots from sealed partitions without cumulative raw sums or authority over dispatch?
8. Can manifests and hash chains verify RFC 8785 canonical event hashes, partition genesis hash, raw file hash, rollup hash, previous hash, included partitions, schema/policy/taxonomy hashes, dedupe ids, trusted chain head, and mandatory previous-event hashes?
9. Can stale rollups, duplicate aggregation attempts, tampered archives, and mismatched manifests be ignored or fail closed?
10. Can GitHub Pages or artifacts expose only sanitized aggregate summaries or temporary redacted bundles?
11. Can external managed database access use OIDC or approved workload identity without long-lived credentials, and can migration prove cutover manifest, ingestion watermark, source precedence, and idempotent replay semantics?
12. If federated score sharing is enabled in a future release, can installer opt-in, payload preview, upload redaction, registry ingestion, community snapshot reads, self-hosted endpoints, opt-out, and local-only fallback be proven without weakening Guard or privacy?

Pass criteria:

1. Workflow optimization records include taxonomy snapshot hash, policy hash, scorer identity class, redaction status, provenance, and score version.
2. Multi-model fan-out blocks on stale, unknown, shared-limit-suspected, refused, fallback-derived, over-budget, non-opted-in, or untrusted usage.
3. Score snapshots use normalized aggregates and never raw cumulative sums for ranking.
4. Accumulated scores are loaded only when the threshold gate passes; below-threshold or mismatched-task scores are ignored.
5. Fan-out does not run merely because usage is high; cadence, cooldown, novelty, budget, reserve, opt-in, and confirmation gates must pass.
6. GitHub score ledger tests prove no canonical forbidden persisted payload classes from the implementation spec section 3.2 are stored and no ledger score changes eligibility.
7. Raw partitions are append-only until sealed, sealed partitions are immutable, and corrections use later compensating events.
8. Rollups are generated only from sealed partitions and contain normalized aggregates including sample count, effective sample count, weighted means, confidence intervals or buckets, rates, percentiles, decay-adjusted means, last observation time, scorer concentration, and negative-signal counters.
9. Rollups never store or rank by cumulative raw score sums and never approve dispatch, change eligibility, bypass Guard, reduce verification, skip approval, or override usage and conformance.
10. Manifest and hash-chain tests detect tampered raw partitions, tampered rollups, stale rollups, duplicate conflicts, event id conflicts, duplicate partitions, missing included partitions, partition-genesis mismatch, schema/policy/taxonomy mismatch, redaction mismatch, trusted-chain-head mismatch, and previous-event hash mismatch.
11. Archive tests prove sealed archives and archive indexes exclude every canonical forbidden persisted payload class from the implementation spec section 3.2.
12. External score reads are ignored or fail closed when stale, malformed, tampered, policy-mismatched, below threshold, mismatched to the task signature, before the migration watermark, or outside the configured trust boundary.
13. Federated sharing is off by default, requires explicit opt-in, provides payload preview before enablement, uploads only schema-approved coarse fields, rejects forbidden payload classes, and treats community snapshots as advisory-only cold-start inputs.

Fail behavior:

1. Workflow optimization is disabled.
2. FlowDesk falls back to single-proposal planning or manual command-backed planning.
3. Scores remain unavailable for ranking and cannot affect Guard, policy, usage, conformance, runtime compatibility, verification, or required approval.

### 8. Audit Ordering

Questions:

1. Can FlowDesk durably write pre-dispatch audit before real dispatch?
2. Can FlowDesk write outcome audit after dispatch?
3. What happens if audit write fails after runtime starts?

Pass criteria:

1. Real privileged dispatch is blocked unless pre-dispatch audit is durable.
2. Outcome audit failure quarantines the attempt.
3. Event-hook delivery cannot satisfy audit durability.

Fail behavior:

1. Dispatch does not start when pre-dispatch audit fails.
2. Attempt is quarantined when outcome audit fails.

## Conformance Test Matrix

| Area | Test | Required for Release 1 | Required for Real Dispatch | Required for Hard Managed Chat Control |
|---|---|---:|---:|---:|
| Plugin loading | npm package load | Yes | Yes | Yes |
| Plugin loading | `npm pack --dry-run` package/bin smoke | Yes | Yes | Yes |
| Plugin loading | local/file independent doctor check | Yes | Yes | Yes |
| Commands | `/flowdesk-doctor` portable command | Yes | Yes | Yes |
| Commands | `/flowdesk:*` colon alias | No | No | No |
| Commands | reject shell interpolation in generated templates | Yes | Yes | Yes |
| Tools | plugin tool contract and schema compatibility | Yes | Yes | Yes |
| Optimization | proposal schema and score records are redacted/advisory | Schema only | Yes | Yes |
| Optimization | accumulated score reuse threshold gate | No | Yes | Yes |
| Optimization | multi-model fan-out surplus usage gate | No | Yes | Yes |
| Optimization | fan-out cadence, cooldown, and novelty gate | No | Yes | Yes |
| Score storage | normalized score aggregation, never cumulative sum ranking | No | If enabled | If enabled |
| Score storage | GitHub/private JSONL ledger and external DB safety | No | If enabled | If enabled |
| Score storage | raw partitions, sealed immutable partitions, and archive safety | No | If enabled | If enabled |
| Score storage | rollup compaction uses normalized aggregates only | No | If enabled | If enabled |
| Score storage | manifest and hash-chain tamper detection | No | If enabled | If enabled |
| Score storage | duplicate event handling and stale rollup rejection | No | If enabled | If enabled |
| Federated registry | installer opt-in and payload preview | No | If enabled | If enabled |
| Federated registry | upload redaction and forbidden payload rejection | No | If enabled | If enabled |
| Federated registry | community snapshot advisory-only gates | No | If enabled | If enabled |
| Federated registry | registry unavailable/stale/tampered fallback to local-only | No | If enabled | If enabled |
| Chat | `chat.message` steering by mutation/throw | Yes | No | Yes |
| Chat | blocking managed dispatch | No | No | Yes |
| Dispatch | fake-runtime dispatch | Yes | No | No |
| Dispatch | command-steering without real dispatch | Yes | No | No |
| Dispatch | real model/agent binding | No | Yes | Yes |
| Echo | request-surface header/params plumbing | Yes | No | No |
| Echo | trusted runtime echo | No | Yes | Yes |
| Provider health | separate Provider Health Snapshot and failure classes | Yes | Yes | Yes |
| Provider health | `/flowdesk-doctor`, `/flowdesk-usage`, and `/flowdesk-status` diagnostics surface | Yes | Yes | Yes |
| Provider health | automatic provider/model fallback | No | No, unless future guarded fallback gate passes | No, unless future guarded fallback gate passes |
| Telemetry | minimum telemetry surfaces | No | Yes | Yes |
| Delegation | delegated authoring records and lane summaries; actual lane launch and task ref capture | Records/summaries in Release 1; actual launch conformance-gated for later release | Yes | Yes |
| Delegation | lane status summary fields and failure classes | Yes | Yes | Yes |
| Delegation | launch failure, timeout, abnormal exit, schema failure, and lost correlation detection | Best effort | Yes | Yes |
| Delegation | reference-kind separation, aborted invocation handling, incomplete verdict detection, and bounded retry records | Yes | Yes | Yes |
| Review lanes | every registered highest-tier available reviewer/model binding as canonical `reviewer` extensions, with same-model multi-agent perspective assignment when only one top model is registered | No, planned only | Release 2.5 or Release 3 entry gate | Release 2.5 or Release 3 entry gate |
| Review lanes | provider-qualified concrete model ids, fresh auth/usage/quota evidence, runtime echo, telemetry persistence, output schema, top-tier eligibility, perspective separation, and no silent fallback | No | Release 2.5 or Release 3 entry gate | Release 2.5 or Release 3 entry gate |
| Overrides | arbitrary agent/model override constrained by binding registry and Guard evidence | No | Release 2.5 or Release 3 entry gate | Release 2.5 or Release 3 entry gate |
| Delegation | clickable or openable redacted lane refs | No, unless proven | No, unless proven | No, unless proven |
| Hook harness | `enforce` denies/rewrites/routes unsafe attempts and fails closed | Yes | Yes | Yes |
| Hook harness | `observe` and `off` disable automation that needs containment | Yes | Yes | Yes |
| Storage | sessions complement workflows and stay redacted-only | Yes | Yes | Yes |
| Storage | conformance artifacts default temp, persisted summaries require opt-in | Yes | Yes | Yes |
| Delegation | lane limits, timeouts, verification, failure disposition, observability refs, and best-effort cancellation records | Schema and status summaries | Yes | Yes |
| Audit | pre-dispatch durable audit | Yes for fake-runtime, Yes for real dispatch | Yes | Yes |
| TUI | UX-only status/toast | No | No | No |

Score storage rows marked `If enabled` are not prerequisites for real dispatch when score storage is disabled by policy. In that case conformance must instead prove the disabled score-storage path cannot load GitHub ledgers, external databases, or rollups and cannot influence planning, ranking, Guard, approval, usage, or dispatch.

Federated registry rows marked `If enabled` are not prerequisites for real dispatch when community score sharing is disabled by policy. In that case conformance must instead prove the disabled federated path cannot upload telemetry, load community snapshots, or influence planning, ranking, Guard, approval, usage, conformance, verification, or dispatch.

## Current Evidence Snapshot

| Surface | Observed result | Current mode |
|---|---|---|
| Command arguments | `$ARGUMENTS` works; `$1` expands from positional content; `$name` remains literal | portable command path supported |
| Command steering | `command.execute.before` mutation changes outgoing text; throw prevents downstream chat dispatch | `command-steering` candidate |
| Chat steering | `chat.message` mutation changes outgoing text; throw aborts dispatch | `chat_intake_mode: steering` |
| Hard chat cancellation | Unsupported `noReply`, `cancel`, and `stop` fields do not provide authority | `blocking` not proven |
| Guard containment | Model-driven built-in `bash` calls can be denied with zero side effect in tested path | guard hook evidence for tested built-ins |
| Hook harness | Tool, command, and chat hooks can be used as containment surfaces when conformance-proven | `enforce` candidate for tested paths |
| Runtime echo | `chat.params` and `chat.headers` reached fake provider | `request_surface_only` |
| Provider health | no official plugin-level automatic cross-provider fallback evidence | `diagnostic_only` |
| Custom plugin tools | FDS-1 minimum tools pass through runtime-closed validation; provider-facing `additionalProperties: false` is missing/null | compatible with runtime-closed validation; provider-facing closedness caveat |
| Packaging/bootstrap | `npm pack --dry-run --json` passes for core and plugin packages; plugin exposes `flowdesk-install-release1`; packed files exclude tests and `.tsbuildinfo`; public `@flowdesk/core@0.1.0` and `@flowdesk/opencode-plugin@0.1.0` registry install smoke passed | public package/bin smoke pass |
| Shell interpolation | Command-template interpolation can execute before `tool.execute.before` | generated templates must forbid interpolation |
| Lane observability | No complete clickable lane UI proof in current evidence | use command summaries and debug export until proven |
| External `opencode run` | Single non-interactive CLI session behavior; useful for smoke tests and diagnostics, not proof of coordinated parallel fan-out or lane observability | smoke/diagnostics only |
| Release 2 SDK provider smoke | OpenCode 1.14.50 headless server plus SDK `client.session.prompt` succeeds for `openai/gpt-5.4-mini-fast` and exposes provider/model identity | diagnostic SDK provider reachability only |
| Anthropic diagnostic provider smoke | Direct CLI diagnostics succeed for tested Sonnet/Opus ids; tested Haiku ids return provider 404 model-not-found; pure headless SDK mode skips the local external Anthropic auth/provider plugin and returns server `UnknownError`; non-pure headless SDK mode succeeds for Anthropic Sonnet | provider reachable; external plugin dependency must be policy/doctor-gated |
| OpenCode model metadata | Verbose model listing exposes catalog metadata such as context/pricing/capabilities but no account quota/reset bucket | catalog evidence only; usage gate unsatisfied |
| Provider usage source research and internal collector | OpenAI and Anthropic expose documented admin/rate-limit/header surfaces; Google Cloud exposes Cloud Quotas/Monitoring surfaces for supported services; DEX Conductor/OpenUsage collector patterns have been ported into FlowDesk core for Claude OAuth usage, Codex/OpenAI live usage, and Gemini Code Assist quota; this local shell has no provider/admin keys and OpenCode SDK responses do not forward provider rate-limit headers | collector logic unit-tested; live credentialed conformance gate unsatisfied |
| Release 2 audit/gate smoke | FlowDesk-bound audit write intent can write a redacted audit record while authority flags remain false; missing usage evidence still blocks the managed-dispatch beta gate; follow-up smoke proves durable audit write before live OpenAI SDK prompt; gate now requires explicit auth profile, credential scope, account boundary, concrete non-alias model id, actual usage acquisition, quota evidence, reset time, and reset bucket in pinned usage-authority evidence | fail-closed gate evidence plus live-call audit ordering smoke |
| Release 2 echo/telemetry smoke | SDK `session.prompt` response and `session.messages` expose provider/model, assistant message id, session correlation, part lifecycle, and message count; redacted evidence records validate against runtime echo and telemetry schemas | schema-level trusted echo/telemetry path proven; production persistence still gated |
| Top-tier multi-perspective internal review lanes | Fan-out to every registered highest-tier available reviewer/model lane is now normative planned capability, with same-model multi-agent perspective review when only one top model is registered, but no production internal subtask review evidence or release approval exists | planned only; not implemented or verified |

Release 1 interpretation: the current product target is a General-Use MVP where chat is the normal entry point and accepted requests route into guarded command-backed workflows. Heavy workflow authoring should be represented through delegated records, fake-runtime lane summaries, command/status summaries, or degraded fallback records. Provider/API/model failures are surfaced through doctor, usage, status, retry guidance, and debug export, but Release 1 does not perform real automatic provider/model fallback. Actual OpenCode subtask/model/provider lane launch remains disabled until a later release gate proves safe launch, schema, status, redacted observability, trusted binding, trusted runtime echo, sufficient telemetry, fresh usage, fresh provider health, Guard approval, and durable pre-dispatch audit. Hard managed chat control, real OpenCode dispatch, automatic provider/model fallback, trusted real-provider echo, sufficient event telemetry, perfect clickable lane UI, and colon aliases remain gated. Production registration is limited to Release 1 non-dispatch command-backed handlers.

Hook harness interpretation: stored artifacts and config use `hook_harness_mode: enforce|observe|off`. User-facing UI may accept `on`, but it must normalize to `enforce` before storage or audit. Release 1 normal managed UX requires `chat_intake_mode: steering` and `hook_harness_mode: enforce`. Hook `observe` and `off` are supported degraded modes, but they disable managed or privileged automation that depends on containment and must not be marketed as full managed automation.

## Evidence Record Format

Each conformance test records:

Persisted `redacted-evidence.jsonl` lines use `flowdesk.conformance_evidence_record.v1` and include:

1. `schema_version`: `flowdesk.conformance_evidence_record.v1`.
2. `evidence_ref`: opaque schema-safe evidence ref.
3. `run_id`: opaque conformance run id.
4. `checked_at`: ISO timestamp.
5. `evidence_area`: bounded test-area label.
6. `result`: `pass|fail|partial|skipped`.
7. `summary_label`: bounded redacted safe summary.
8. `redaction_version`: redaction policy version.
9. `source_refs`: bounded redacted source refs.

Persisted evidence references and redacted logs must not contain raw prompts, transcripts, credentials, provider payloads, provider quota bodies, tool args/results, runtime echoes, stack traces, raw file contents, raw paths, branch names, issue or PR titles, repo or organization names, prompt-derived hashes, public unsalted identifiers, or stable cross-project identifiers unless explicitly classified safe by schema.

## Release Gate Rules

1. Release 1 General-Use MVP normal managed UX requires `chat_intake_mode: steering` and `hook_harness_mode: enforce`.
2. Chat `observe_only` or chat `off` are degraded fallback modes. They cannot provide normal chat-routed managed UX, so users must be directed to command-backed fallback paths.
3. Hook `observe` or hook `off` are degraded fallback modes. They disable managed and privileged automation that depends on containment and leave only safe manual, setup, status, recovery, diagnostics, and fallback behavior.
4. The UI alias `on` may be accepted only if it normalizes to stored `enforce`.
5. Release 1 may not enable real dispatch.
6. First real dispatch requires trusted binding, trusted echo, sufficient event telemetry, fresh usage, fresh provider health, Guard approval, and durable pre-dispatch audit.
7. First managed provider/model fallback or reselection requires all real-dispatch gates plus runtime compatibility, policy eligibility, a new attempt id, a durable pre-dispatch audit for the new binding, and explicit Guard approval.
8. Hard managed chat control requires blocking chat intake plus all real-dispatch gates for privileged execution.
9. Conformance regressions disable the dependent feature until re-verified.
10. Release 1 must not promise clickable or openable lane references unless `lane_observability_mode` is `openable_refs` for the pinned OpenCode version.
11. If lane launch, schema conversion, timeout, abnormal completion, reference-kind separation, final verdict presence, or event correlation cannot be observed safely, dependent delegated authoring must degrade to command-backed planning, status, abort, retry planning, direct verification, or redacted debug export.
12. Nested or parallel-launched `opencode run` subprocesses may support provider smoke tests, diagnostics, compatibility probes, or fake-runtime harnesses only. They must not satisfy release gates for delegated authoring lanes, review fan-out, real dispatch, trusted binding, runtime echo, lane observability, or cancellation.
13. Provider/API/model outages in Release 1 must degrade to diagnostics, status, fake-runtime behavior, safe retry planning, or user-facing remediation. They must not trigger real provider/model switching.
