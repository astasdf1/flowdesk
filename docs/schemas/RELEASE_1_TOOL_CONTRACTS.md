# FlowDesk Release 1 Tool Contracts

## Purpose

This document is the normative Release 1 schema appendix for FlowDesk plugin tools. It turns the named contracts in `../FLOWDESK_OPENCODE_PLUGIN_IMPLEMENTATION_SPEC.md` into implementation-ready TypeScript interface names, JSON Schema ids, fixture names, and conformance expectations.

Release 1 custom tools use OpenCode's official Zod-based plugin tool API. FlowDesk does not claim arbitrary JSON Schema compatibility. Schemas are restricted to a tested Zod subset because OpenCode converts plugin Zod args to JSON Schema and may apply provider-specific transformations before model dispatch.

FDS-1 compatibility is defined by FlowDesk runtime-closed validation: canonical FlowDesk schema artifacts reject unknown properties, and handlers must validate requests before any privileged behavior. OpenCode provider-facing JSON Schema closedness is a caveat for the pinned conversion path because `additionalProperties: false` may be missing/null; it is not by itself a blocker when runtime validation rejects unknown properties.

## FDS-1 Authoring Profile

FDS-1 schemas are authored as Zod raw shapes for OpenCode plugin tools, then exported to JSON Schema artifacts for review, tests, and documentation. Implementations must not hand-author plugin tool args as raw JSON Schema unless a later conformance report explicitly promotes that path.

Allowed in Release 1 before additional conformance:

1. Top-level `args: { ... }` object shape only.
2. `string`, `number`, `boolean`, `array`, and simple nested object fields.
3. String enums represented as explicit Zod enums.
4. `.optional()` for optional fields; optional fields are omitted from `required`.
5. `.describe()` on every field and tool.
6. Bounded scalar constraints that are tested in the schema spike, such as string length, numeric min/max, array max length, and object max property count.

Forbidden in Release 1 unless a pinned conformance report narrows or promotes them:

1. Raw JSON Schema plugin args.
2. Mixed Zod and raw JSON Schema args in the same tool.
3. `oneOf`, `anyOf`, `allOf`, unions, discriminated unions, recursive schemas, records, maps, sets, tuples, transforms, preprocessors, `refine`, or `superRefine`.
4. Nullable fields, numeric enums, `$ref`-dependent designs, or provider-specific schema tricks unless tested for the pinned provider/model path.
5. Defaults that must be preserved by OpenCode or a provider transform. FlowDesk code must apply defaults after validating the request envelope.

## Shared Type Aliases

All ids and refs are opaque schema-safe strings. They must not contain raw prompts, paths, branch names, issue or PR titles, repository names, organization names, provider payloads, runtime echoes, stack traces, or public unsalted identifiers.

```ts
type OpaqueId = string;
type OpaqueRef = string;
type IsoTimestamp = string;

type InputMode = "chat_routed" | "portable_command" | "alias_command" | "test_fixture";
type ProviderFamily =
  | "claude"
  | "openai"
  | "gemini"
  | "opencode_go"
  | "z_ai"
  | "unknown"
  | "all";
type ToolStatus =
  | "ready"
  | "blocked"
  | "needs_clarification"
  | "dry_run_complete"
  | "fake_runtime_complete"
  | "recovery_available"
  | "degraded"
  | "diagnostic_only"
  | "error";
type SafeNextAction =
  | "/flowdesk-doctor"
  | "/flowdesk-plan"
  | "/flowdesk-explain-route"
  | "/flowdesk-run"
  | "/flowdesk-status"
  | "/flowdesk-resume"
  | "/flowdesk-retry"
  | "/flowdesk-abort"
  | "/flowdesk-usage"
  | "/flowdesk-audit"
  | "/flowdesk-export-debug"
  | "continue_chat"
  | "ask_clarification";
type RedactedErrorCategory =
  | "schema"
  | "policy"
  | "conformance"
  | "usage"
  | "provider_health"
  | "provider_api"
  | "model_availability"
  | "state"
  | "audit"
  | "redaction"
  | "runtime"
  | "unknown";
type ProviderFailureClass =
  | "none"
  | "auth_missing"
  | "auth_expired"
  | "provider_unavailable"
  | "rate_limited"
  | "model_unavailable"
  | "transport_timeout"
  | "provider_error"
  | "opencode_provider_load_failure"
  | "telemetry_ambiguous";
type LaneFailureClass =
  | "launch_failed"
  | "missing_tool"
  | "schema_conversion_failed"
  | "timeout"
  | "correlation_lost"
  | "abnormal_exit"
  | "telemetry_unavailable"
  | "cancellation_unproven"
  | "redaction_blocked"
  | "invocation_failed"
  | "incomplete_result"
  | "reference_kind_mismatch"
  | "retry_limit_reached"
  | "auth_missing"
  | "auth_expired"
  | "provider_unavailable"
  | "rate_limited"
  | "model_unavailable"
  | "transport_timeout"
  | "provider_error"
  | "opencode_provider_load_failure";
type LaneInvocationRefKind = "background_invocation" | "continuation_session" | "opencode_task" | "unknown";
type LaneVerdictStatus = "present" | "missing" | "incomplete" | "not_required";
```

## Shared Envelopes

JSON Schema ids:

1. `flowdesk.tool.request.v1`
2. `flowdesk.tool.response.v1`
3. `flowdesk.redacted_error.v1`

```ts
interface FlowDeskToolRequestEnvelopeV1 {
  schema_version: string;
  request_id: OpaqueId;
  input_mode: InputMode;
  workflow_id?: OpaqueId;
  session_ref?: OpaqueRef;
  redacted_intake_ref?: OpaqueRef;
  user_approval_ref?: OpaqueRef;
}

interface FlowDeskRedactedErrorV1 {
  code?: string;
  category: RedactedErrorCategory;
  safe_remediation: string;
}

interface FlowDeskToolResponseEnvelopeV1 {
  schema_version: string;
  ok: boolean;
  status: ToolStatus;
  workflow_id?: OpaqueId;
  safe_next_actions: SafeNextAction[];
  user_message: string;
  audit_ref?: OpaqueRef;
  debug_ref?: OpaqueRef;
  lane_refs?: OpaqueRef[];
  error?: FlowDeskRedactedErrorV1;
}
```

Envelope field bounds:

1. `request_id`, `workflow_id`, `session_ref`, `redacted_intake_ref`, `user_approval_ref`, `audit_ref`, `debug_ref`, and lane refs: max 128 chars.
2. `user_message` and `safe_remediation`: max 500 chars.
3. `safe_next_actions`: max 8 items.
4. `lane_refs`: max 20 items.
5. Unknown properties fail validation.

## Release 1 Tool Contract Matrix

| Tool | Request schema id | Response schema id | TypeScript request | TypeScript response | Fixture prefix |
|---|---|---|---|---|---|
| `flowdesk_chat_intake` | `flowdesk.chat_intake.request.v1` | `flowdesk.chat_intake.response.v1` | `FlowDeskChatIntakeRequestV1` | `FlowDeskChatIntakeResponseV1` | `chat-intake` |
| `flowdesk_doctor` | `flowdesk.doctor.request.v1` | `flowdesk.doctor.response.v1` | `FlowDeskDoctorRequestV1` | `FlowDeskDoctorResponseV1` | `doctor` |
| `flowdesk_plan` | `flowdesk.plan.request.v1` | `flowdesk.plan.response.v1` | `FlowDeskPlanRequestV1` | `FlowDeskPlanResponseV1` | `plan` |
| `flowdesk_run` | `flowdesk.run.request.v1` | `flowdesk.run.response.v1` | `FlowDeskRunRequestV1` | `FlowDeskRunResponseV1` | `run` |
| `flowdesk_status` | `flowdesk.status.request.v1` | `flowdesk.status.response.v1` | `FlowDeskStatusRequestV1` | `FlowDeskStatusResponseV1` | `status` |
| `flowdesk_resume` | `flowdesk.resume.request.v1` | `flowdesk.resume.response.v1` | `FlowDeskResumeRequestV1` | `FlowDeskResumeResponseV1` | `resume` |
| `flowdesk_retry` | `flowdesk.retry.request.v1` | `flowdesk.retry.response.v1` | `FlowDeskRetryRequestV1` | `FlowDeskRetryResponseV1` | `retry` |
| `flowdesk_abort` | `flowdesk.abort.request.v1` | `flowdesk.abort.response.v1` | `FlowDeskAbortRequestV1` | `FlowDeskAbortResponseV1` | `abort` |
| `flowdesk_usage` | `flowdesk.usage.request.v1` | `flowdesk.usage.response.v1` | `FlowDeskUsageRequestV1` | `FlowDeskUsageResponseV1` | `usage` |
| `flowdesk_explain_route` | `flowdesk.explain_route.request.v1` | `flowdesk.explain_route.response.v1` | `FlowDeskExplainRouteRequestV1` | `FlowDeskExplainRouteResponseV1` | `explain-route` |
| `flowdesk_audit` | `flowdesk.audit.request.v1` | `flowdesk.audit.response.v1` | `FlowDeskAuditRequestV1` | `FlowDeskAuditResponseV1` | `audit` |
| `flowdesk_export_debug` | `flowdesk.export_debug.request.v1` | `flowdesk.export_debug.response.v1` | `FlowDeskExportDebugRequestV1` | `FlowDeskExportDebugResponseV1` | `export-debug` |

Only the Release 1 registered minimum tools may be registered in production profiles: `flowdesk_doctor`, `flowdesk_plan`, `flowdesk_run`, `flowdesk_status`, `flowdesk_resume`, `flowdesk_retry`, `flowdesk_abort`, `flowdesk_usage`, and `flowdesk_export_debug`. Optional diagnostics remain unregistered unless schema conformance and profile policy allow them.

## Tool-Specific Interfaces

Each request interface extends `FlowDeskToolRequestEnvelopeV1`; each response extends `FlowDeskToolResponseEnvelopeV1`. Fields marked as summary or message fields are bounded safe summaries, not raw prompts, tool args/results, provider payloads, raw logs, stack traces, runtime echoes, or raw paths.

Request defaults are applied by FlowDesk after request validation and before command/tool execution. OpenCode registry conversion or provider schema transforms must not be relied on to preserve defaults. Release 1 field-specific defaults in this appendix are:

1. `FlowDeskDoctorRequestV1.persist_report`: omitted defaults to `false`.
2. `FlowDeskStatusRequestV1.detail_level`: omitted defaults to `summary`.

```ts
interface FlowDeskChatIntakeRequestV1 extends FlowDeskToolRequestEnvelopeV1 {
  schema_version: "flowdesk.chat_intake.request.v1";
  intake_summary: string;
  source_surface: "chat.message" | "command.execute.before" | "manual_command" | "test_fixture";
}

interface FlowDeskChatIntakeResponseV1 extends FlowDeskToolResponseEnvelopeV1 {
  schema_version: "flowdesk.chat_intake.response.v1";
  classification: "fast_chat" | "managed_plan" | "clarify" | "blocked";
  redacted_intake_ref: OpaqueRef;
  route_decision: "continue_chat" | "show_plan" | "ask_clarification" | "block" | "use_command_fallback";
}

interface FlowDeskDoctorRequestV1 extends FlowDeskToolRequestEnvelopeV1 {
  schema_version: "flowdesk.doctor.request.v1";
  check_scope: "install" | "runtime" | "policy" | "usage" | "provider_health" | "conformance" | "all";
  profile: "production" | "development" | "test";
  persist_report?: boolean;
}

interface FlowDeskDoctorResponseV1 extends FlowDeskToolResponseEnvelopeV1 {
  schema_version: "flowdesk.doctor.response.v1";
  doctor_results: DoctorSectionResultV1[];
  provider_health_summary: ProviderHealthSummaryV1;
  compatibility_ref: OpaqueRef;
  disabled_modes: DisabledModeV1[];
}

interface FlowDeskPlanRequestV1 extends FlowDeskToolRequestEnvelopeV1 {
  schema_version: "flowdesk.plan.request.v1";
  goal_summary: string;
  scope_summary: string;
  risk_hint: string;
  existing_plan_revision_id?: OpaqueId;
}

interface FlowDeskPlanResponseV1 extends FlowDeskToolResponseEnvelopeV1 {
  schema_version: "flowdesk.plan.response.v1";
  plan_revision_id: OpaqueId;
  delegated_authoring_summary: string;
  required_approvals: OpaqueRef[];
  guard_precheck: GuardPrecheckSummaryV1;
}

interface FlowDeskRunRequestV1 extends FlowDeskToolRequestEnvelopeV1 {
  schema_version: "flowdesk.run.request.v1";
  run_mode: "guarded-dry-run" | "fake-runtime";
  plan_revision_id: OpaqueId;
  step_id?: OpaqueId;
}

interface FlowDeskRunResponseV1 extends FlowDeskToolResponseEnvelopeV1 {
  schema_version: "flowdesk.run.response.v1";
  run_result_ref: OpaqueRef;
  verification_summary_ref: OpaqueRef;
  artifact_disposition: "none" | "quarantined" | "promoted" | "discarded";
}

interface FlowDeskStatusRequestV1 extends FlowDeskToolRequestEnvelopeV1 {
  schema_version: "flowdesk.status.request.v1";
  detail_level?: "summary" | "diagnostic" | "debug_refs" | "lane_refs";
}

interface FlowDeskStatusResponseV1 extends FlowDeskToolResponseEnvelopeV1 {
  schema_version: "flowdesk.status.response.v1";
  workflow_state: WorkflowStateV1;
  current_step_id?: OpaqueId;
  lane_summaries: FlowDeskStatusLaneSummaryV1[];
  provider_health_summary: ProviderHealthSummaryV1;
  blocker?: BlockerSummaryV1;
  checkpoint_id?: OpaqueId;
}

interface FlowDeskResumeRequestV1 extends FlowDeskToolRequestEnvelopeV1 {
  schema_version: "flowdesk.resume.request.v1";
  checkpoint_id: OpaqueId;
  resume_mode: "resume" | "retry" | "abort_only" | "status_only";
}

interface FlowDeskResumeResponseV1 extends FlowDeskToolResponseEnvelopeV1 {
  schema_version: "flowdesk.resume.response.v1";
  resume_decision: "allowed" | "blocked" | "requires_fresh_checks" | "status_only";
  required_fresh_checks: FreshCheckV1[];
  next_checkpoint_id?: OpaqueId;
}

interface FlowDeskRetryRequestV1 extends FlowDeskToolRequestEnvelopeV1 {
  schema_version: "flowdesk.retry.request.v1";
  attempt_id: OpaqueId;
  retry_reason: string;
  new_binding_hint?: string;
}

interface FlowDeskRetryResponseV1 extends FlowDeskToolResponseEnvelopeV1 {
  schema_version: "flowdesk.retry.response.v1";
  new_attempt_id: OpaqueId;
  required_guard_checks: GuardCheckV1[];
  retry_state: "planned" | "blocked" | "diagnostic_only";
}

interface FlowDeskAbortRequestV1 extends FlowDeskToolRequestEnvelopeV1 {
  schema_version: "flowdesk.abort.request.v1";
  workflow_id: OpaqueId;
  attempt_id?: OpaqueId;
  reason: string;
}

interface FlowDeskAbortResponseV1 extends FlowDeskToolResponseEnvelopeV1 {
  schema_version: "flowdesk.abort.response.v1";
  cancellation_state: "cancel_requested" | "cancel_observed" | "cancel_failed" | "hard_cancel_proven";
  remaining_safe_actions: SafeNextAction[];
}

interface FlowDeskUsageRequestV1 extends FlowDeskToolRequestEnvelopeV1 {
  schema_version: "flowdesk.usage.request.v1";
  provider_family: ProviderFamily;
  refresh: boolean;
}

interface FlowDeskUsageResponseV1 extends FlowDeskToolResponseEnvelopeV1 {
  schema_version: "flowdesk.usage.response.v1";
  usage_snapshot_ref: OpaqueRef;
  provider_health_snapshot_ref?: OpaqueRef;
  freshness: "fresh" | "stale" | "unknown";
  dispatchability: "dispatchable" | "diagnostic_only" | "non_dispatchable";
  uncertainty_flags: UsageUncertaintyFlagV1[];
}

interface FlowDeskExplainRouteRequestV1 extends FlowDeskToolRequestEnvelopeV1 {
  schema_version: "flowdesk.explain_route.request.v1";
  workflow_id: OpaqueId;
  route_ref: OpaqueRef;
}

interface FlowDeskExplainRouteResponseV1 extends FlowDeskToolResponseEnvelopeV1 {
  schema_version: "flowdesk.explain_route.response.v1";
  route_summary: string;
  guard_rationale_ref?: OpaqueRef;
}

interface FlowDeskAuditRequestV1 extends FlowDeskToolRequestEnvelopeV1 {
  schema_version: "flowdesk.audit.request.v1";
  workflow_id: OpaqueId;
  audit_query: "latest" | "workflow_summary" | "guard_decisions" | "verification_refs" | "debug_refs";
}

interface FlowDeskAuditResponseV1 extends FlowDeskToolResponseEnvelopeV1 {
  schema_version: "flowdesk.audit.response.v1";
  audit_refs: OpaqueRef[];
  summary_labels: string[];
  redaction_version: string;
}

interface FlowDeskExportDebugRequestV1 extends FlowDeskToolRequestEnvelopeV1 {
  schema_version: "flowdesk.export_debug.request.v1";
  include_sections: DebugSectionV1[];
  retention_hint: "delete_after_export" | "keep_until_default_expiry" | "keep_until_policy_expiry";
}

interface FlowDeskExportDebugResponseV1 extends FlowDeskToolResponseEnvelopeV1 {
  schema_version: "flowdesk.export_debug.response.v1";
  export_manifest_ref: OpaqueRef;
  included_sections: DebugSectionSummaryV1[];
  delete_after: IsoTimestamp;
}
```

## Supporting Summary Contracts

Provider family labels are persisted schema values. User-facing copy may display `opencode_go` as “OpenCode Go” and `z_ai` as “z.ai”, but persisted enum values must use the schema-safe labels above. `z_ai` covers Z.AI and Z.AI Coding Plan modes; the exact provider id, base URL, and coding-plan mode belong in redacted config or runtime metadata refs, not in `provider_family`.

OpenUsage-style evidence, local history readers, and external usage dashboards must be represented through existing usage snapshot refs, provider health snapshot refs, freshness, dispatchability, uncertainty flags, and redacted evidence refs. They do not add raw quota payload fields, raw local history fields, browser cookie fields, or provider console payload fields to Release 1 tool responses.

```ts
type DisabledModeV1 =
  | "chat_routed"
  | "real_dispatch"
  | "managed_fallback"
  | "lane_launch"
  | "hard_chat_blocking"
  | "workflow_optimization"
  | "specialist_workflow";

type WorkflowStateV1 =
  | "idle"
  | "intake_received"
  | "fast_chat"
  | "clarify_pending"
  | "plan_pending_approval"
  | "guard_pending"
  | "ready_to_run"
  | "running"
  | "verification_failed"
  | "retry_pending"
  | "blocked"
  | "complete"
  | "aborted";

type UsageUncertaintyFlagV1 =
  | "unknown"
  | "stale"
  | "refused"
  | "shared_limit_suspected"
  | "fallback_derived"
  | "model_generated"
  | "telemetry_ambiguous";

type DebugSectionV1 =
  | "doctor"
  | "conformance"
  | "workflow_state"
  | "audit_refs"
  | "usage_summary"
  | "policy_summary"
  | "redaction_summary";

interface ProviderHealthSummaryV1 {
  provider_family: ProviderFamily;
  model_family?: string;
  availability_state: "healthy" | "degraded" | "unavailable" | "unknown";
  failure_class: ProviderFailureClass;
  dispatchability: "dispatchable" | "diagnostic_only" | "non_dispatchable";
  safe_remediation: string;
  snapshot_ref?: OpaqueRef;
}

interface DoctorSectionResultV1 {
  schema_version: "flowdesk.doctor_section_result.v1";
  run_id: OpaqueId;
  section: "migration_cleanup" | "opencode_plugin_compatibility" | "provider_usage_readiness" | "policy_project_safety";
  category: "dispatch_blocking" | "chat_mode_disable" | "degraded_mode_warning" | "informational";
  summary: string;
  safe_next_actions: SafeNextAction[];
  refs: OpaqueRef[];
  redaction_version: string;
}

interface LaneSummaryV1 {
  lane_id: OpaqueId;
  task_ref: OpaqueRef;
  lane_class: "planning_draft" | "planning_refine" | "planning_review" | "research" | "documentation" | "verification" | "diagnostics" | "other";
  state: "queued" | "launching" | "running" | "waiting" | "completed" | "blocked" | "failed" | "timed_out" | "correlation_lost" | "cancel_requested" | "cancel_observed" | "cancel_failed" | "hard_cancel_proven";
  failure_class?: LaneFailureClass;
  safe_next_action: SafeNextAction;
  refs: OpaqueRef[];
  invocation_ref_kind?: LaneInvocationRefKind;
  retry_count?: number;
  verdict_status?: LaneVerdictStatus;
}

interface FlowDeskStatusLaneSummaryV1 extends LaneSummaryV1 {
  workflow_id: OpaqueId;
  plan_revision_id: OpaqueId;
  attempt_id?: OpaqueId;
  created_at: IsoTimestamp;
  started_at?: IsoTimestamp;
  updated_at: IsoTimestamp;
  completed_at?: IsoTimestamp;
  event_refs: OpaqueRef[];
  audit_refs: OpaqueRef[];
  log_ref?: OpaqueRef;
  debug_ref?: OpaqueRef;
}

interface BlockerSummaryV1 {
  category: RedactedErrorCategory;
  summary: string;
  safe_remediation: string;
  refs: OpaqueRef[];
}

interface GuardPrecheckSummaryV1 {
  result: "eligible" | "blocked" | "requires_approval";
  required_checks: GuardCheckV1[];
  refs: OpaqueRef[];
}

interface GuardCheckV1 {
  check: "policy" | "usage" | "provider_health" | "runtime_compatibility" | "audit" | "redaction" | "approval" | "conformance";
  result: "pass" | "fail" | "unknown";
  ref?: OpaqueRef;
}

interface FreshCheckV1 {
  check: "usage" | "provider_health" | "policy" | "runtime_capability" | "checkpoint" | "audit";
  required: boolean;
  ref?: OpaqueRef;
}

interface DebugSectionSummaryV1 {
  schema_version: "flowdesk.debug_section_summary.v1";
  export_id: OpaqueId;
  section: DebugSectionV1;
  ref: OpaqueRef;
  redaction_status: "passed" | "partial" | "blocked";
  warning_count: number;
  excluded_categories: RedactedErrorCategory[];
}

interface FlowDeskDoctorReportV1 {
  schema_version: "flowdesk.doctor_report.v1";
  run_id: OpaqueId;
  checked_at: IsoTimestamp;
  profile: "production" | "development" | "test";
  category_results: DoctorSectionResultV1[];
  disabled_modes: DisabledModeV1[];
  compatibility_ref: OpaqueRef;
  safe_next_actions: SafeNextAction[];
}

interface FlowDeskPlanSummaryArtifactV1 {
  schema_version: "flowdesk.plan_summary.v1";
  plan_revision_id: OpaqueId;
  workflow_id: OpaqueId;
  created_at: IsoTimestamp;
  goal_summary: string;
  scope_summary: string;
  risk_tier: "low" | "medium" | "high" | "blocked";
  required_approvals: GuardCheckV1[];
  step_summary_refs: OpaqueRef[];
  verification_summary: string;
}

interface FlowDeskLaneSummaryArtifactV1 extends FlowDeskStatusLaneSummaryV1 {
  schema_version: "flowdesk.lane_summary.v1";
}

interface FlowDeskVerificationSummaryArtifactV1 {
  schema_version: "flowdesk.verification_summary.v1";
  verification_id: OpaqueId;
  workflow_id: OpaqueId;
  attempt_id?: OpaqueId;
  result: "passed" | "failed" | "blocked" | "not_run";
  check_labels: string[];
  artifact_refs: OpaqueRef[];
  failure_category?: RedactedErrorCategory;
  safe_next_actions: SafeNextAction[];
}

interface FlowDeskStatusSummaryArtifactV1 {
  schema_version: "flowdesk.status_summary.v1";
  workflow_id: OpaqueId;
  state: WorkflowStateV1;
  current_step_id?: OpaqueId;
  blocker_summary?: BlockerSummaryV1;
  lane_summary_refs: OpaqueRef[];
  usage_summary_ref?: OpaqueRef;
  provider_health_summary_ref?: OpaqueRef;
  checkpoint_id?: OpaqueId;
  safe_next_actions: SafeNextAction[];
  audit_refs: OpaqueRef[];
  debug_ref?: OpaqueRef;
}

interface FlowDeskAuditRefSummaryV1 {
  schema_version: "flowdesk.audit_ref_summary.v1";
  audit_ref: OpaqueRef;
  workflow_id?: OpaqueId;
  attempt_id?: OpaqueId;
  event_type: string;
  summary_label: string;
  created_at: IsoTimestamp;
  redaction_version: string;
}

interface FlowDeskAuditEventV1 {
  schema_version: "flowdesk.audit_event.v1";
  event_id: OpaqueId;
  event_type: string;
  workflow_id?: OpaqueId;
  attempt_id?: OpaqueId;
  step_id?: OpaqueId;
  created_at: IsoTimestamp;
  actor_class: "user" | "flowdesk" | "opencode" | "provider" | "system" | "unknown";
  policy_ref?: OpaqueRef;
  decision_ref?: OpaqueRef;
  redaction_version: string;
  summary_label: string;
  artifact_refs: OpaqueRef[];
}

interface FlowDeskUsageSnapshotV1 {
  schema_version: "flowdesk.usage_snapshot.v1";
  snapshot_id: OpaqueId;
  provider_family: ProviderFamily;
  model_family: string;
  freshness: "fresh" | "stale" | "unknown";
  freshness_ttl: number;
  reset_time: string;
  reset_bucket: string;
  dispatchability: "dispatchable" | "diagnostic_only" | "non_dispatchable";
  uncertainty_flags: UsageUncertaintyFlagV1[];
  source_ref: OpaqueRef;
}

interface FlowDeskProviderHealthSnapshotV1 {
  schema_version: "flowdesk.provider_health_snapshot.v1";
  snapshot_id: OpaqueId;
  provider_family: ProviderFamily;
  model_family?: string;
  observed_at: IsoTimestamp;
  freshness: "fresh" | "stale" | "unknown";
  freshness_ttl: number;
  source_surface: "opencode_config" | "plugin_event" | "doctor_probe" | "usage_collector" | "provider_smoke_test" | "manual_report" | "unknown";
  availability_state: "healthy" | "degraded" | "unavailable" | "unknown";
  failure_class: ProviderFailureClass;
  retry_after_bucket?: string;
  runtime_config_ref?: OpaqueRef;
  telemetry_ref?: OpaqueRef;
  dispatchability: "dispatchable" | "diagnostic_only" | "non_dispatchable";
  source_ref: OpaqueRef;
  safe_remediation: string;
}

interface FlowDeskConformanceRuntimeMetadataV1 {
  schema_version: "flowdesk.conformance_runtime_metadata.v1";
  opencode_version: string;
  opencode_commit?: string;
  checked_at: IsoTimestamp;
  plugin_package: "@flowdesk/opencode-plugin";
  plugin_version_or_commit: string;
  chat_intake_mode: "blocking" | "steering" | "observe_only" | "off";
  command_alias_mode: "portable_only" | "colon_alias_supported";
  dispatch_mode: "none" | "fake-runtime" | "guarded-dry-run" | "command-steering" | "real-opencode-dispatch";
  runtime_echo_mode: "none" | "trusted" | "untrusted" | "request_surface_only";
  event_telemetry_mode: "none" | "partial" | "sufficient";
  provider_health_mode: "none" | "diagnostic_only" | "dispatch_gate_ready";
  fallback_reselection_mode: "disabled" | "diagnostic_only" | "guarded_real_dispatch_ready";
  diagnostics_surface_mode: "none" | "status_only" | "doctor_usage_status" | "doctor_usage_status_debug";
  lane_observability_mode: "none" | "command_summary" | "openable_refs";
  hook_harness_mode: HookHarnessModeV1;
  tui_mode: "ux_only" | "unsupported";
  mode_fields: string[];
  evidence_refs: OpaqueRef[];
  disabled_modes: DisabledModeV1[];
}

interface FlowDeskConformanceEvidenceRecordV1 {
  schema_version: "flowdesk.conformance_evidence_record.v1";
  evidence_ref: OpaqueRef;
  run_id: OpaqueId;
  checked_at: IsoTimestamp;
  evidence_area: string;
  result: "pass" | "fail" | "partial" | "skipped";
  summary_label: string;
  redaction_version: string;
  source_refs: OpaqueRef[];
}
```

## Persisted Workflow/State Schemas

The persisted schemas below are the Release 1 canonical shapes for `.flowdesk/workflows` and redacted `.flowdesk/sessions` records. They are state/recovery evidence only; they do not store reusable approval, dispatch authority, provider/model fallback authority, hard-cancel proof, raw runtime echoes, or raw provider usage/quota payloads. Unknown properties fail validation unless a later schema version explicitly defines a namespaced `extensions` object.

| Persisted file or record | Schema id | TypeScript interface | Fixture prefix |
|---|---|---|---|
| `.flowdesk/workflows/active.json` | `flowdesk.workflow_active.v1` | `FlowDeskWorkflowActiveV1` | `workflow-active` |
| `.flowdesk/workflows/<workflow_id>/workflow.json` | `flowdesk.workflow_record.v1` | `FlowDeskWorkflowRecordV1` | `workflow-record` |
| `.flowdesk/workflows/<workflow_id>/attempts/<attempt_id>.json` | `flowdesk.attempt_record.v1` | `FlowDeskAttemptRecordV1` | `attempt-record` |
| `.flowdesk/workflows/<workflow_id>/checkpoints/<checkpoint_id>.json` | `flowdesk.checkpoint_record.v1` | `FlowDeskCheckpointRecordV1` | `checkpoint-record` |
| `.flowdesk/workflows/<workflow_id>/locks/active-attempt.lock` | `flowdesk.active_attempt_lock.v1` | `FlowDeskActiveAttemptLockV1` | `active-attempt-lock` |
| `.flowdesk/sessions/<session_id>/lanes.jsonl` line | `flowdesk.lane_record.v1` | `FlowDeskLaneRecordV1` | `lane-record` |
| `.flowdesk/sessions/<session_id>/audit.jsonl` line | `flowdesk.audit_record.v1` | `FlowDeskAuditRecordV1` | `audit-record` |
| `.flowdesk/sessions/<session_id>/redacted-debug/manifest.json` | `flowdesk.debug_export_manifest.v1` | `FlowDeskDebugExportManifestV1` | `debug-export-manifest` |

```ts
type Release1RunModeV1 = "guarded-dry-run" | "fake-runtime" | "command-steering";
type AttemptStateV1 = "created" | "guard_pending" | "ready" | "running" | "blocked" | "verification_failed" | "complete" | "aborted";
type ArtifactDispositionV1 = "none" | "quarantined" | "promoted" | "discarded" | "blocked";
type ResumeModeV1 = "resume" | "retry" | "abort_only" | "status_only";
type LockRecoveryV1 = "active" | "stale_recoverable" | "conflicted" | "corrupt";
type PersistedLaneStateV1 = "queued" | "launching" | "running" | "waiting" | "completed" | "blocked" | "failed" | "timed_out" | "correlation_lost" | "cancel_requested" | "cancel_observed" | "cancel_failed";

interface FlowDeskWorkflowActiveV1 {
  schema_version: "flowdesk.workflow_active.v1";
  active_workflow_id?: OpaqueId;
  active_attempt_id?: OpaqueId;
  state: WorkflowStateV1;
  updated_at: IsoTimestamp;
  status_summary_ref?: OpaqueRef;
  audit_refs: OpaqueRef[];
}

interface FlowDeskWorkflowRecordV1 {
  schema_version: "flowdesk.workflow_record.v1";
  workflow_id: OpaqueId;
  session_ref?: OpaqueRef;
  created_at: IsoTimestamp;
  updated_at: IsoTimestamp;
  state: WorkflowStateV1;
  latest_plan_revision_id?: OpaqueId;
  current_step_id?: OpaqueId;
  project_root_ref: OpaqueRef;
  config_hash: string;
  policy_pack_id: OpaqueId;
  policy_pack_hash: string;
  current_attempt_id?: OpaqueId;
  latest_checkpoint_id?: OpaqueId;
  attempt_refs: OpaqueRef[];
  checkpoint_refs: OpaqueRef[];
  lane_refs: OpaqueRef[];
  latest_lane_summary_refs: OpaqueRef[];
  audit_refs: OpaqueRef[];
  status_summary_ref?: OpaqueRef;
  artifact_disposition: ArtifactDispositionV1;
  blocker_summary?: BlockerSummaryV1;
  safe_next_actions: SafeNextAction[];
}

interface FlowDeskAttemptRecordV1 {
  schema_version: "flowdesk.attempt_record.v1";
  attempt_id: OpaqueId;
  workflow_id: OpaqueId;
  step_id?: OpaqueId;
  created_at: IsoTimestamp;
  updated_at: IsoTimestamp;
  run_mode: Release1RunModeV1;
  state_at_start: WorkflowStateV1;
  state_at_end?: WorkflowStateV1;
  attempt_state: AttemptStateV1;
  guard_decision_ref?: OpaqueRef;
  non_dispatch_permission_ref?: OpaqueRef;
  command_shape_hash?: string;
  usage_snapshot_ref?: OpaqueRef;
  provider_health_snapshot_ref?: OpaqueRef;
  runtime_capability_ref?: OpaqueRef;
  pre_run_audit_ref: OpaqueRef;
  runtime_echo_validation: "not_applicable" | "untrusted" | "trusted" | "failed";
  verification_ref?: OpaqueRef;
  artifact_disposition: ArtifactDispositionV1;
  outcome_audit_ref?: OpaqueRef;
  failure_category?: RedactedErrorCategory;
  safe_next_actions: SafeNextAction[];
}

interface FlowDeskCheckpointRecordV1 {
  schema_version: "flowdesk.checkpoint_record.v1";
  checkpoint_id: OpaqueId;
  workflow_id: OpaqueId;
  attempt_id?: OpaqueId;
  current_step_id?: OpaqueId;
  created_at: IsoTimestamp;
  expires_at: IsoTimestamp;
  resume_mode: ResumeModeV1;
  required_fresh_checks: FreshCheckV1[];
  audit_refs: OpaqueRef[];
  artifact_refs: OpaqueRef[];
  reason: "planned_pause" | "retryable_failure" | "verification_failed" | "blocked" | "abort_requested" | "status_snapshot";
  safe_next_actions: SafeNextAction[];
}

interface FlowDeskActiveAttemptLockV1 {
  schema_version: "flowdesk.active_attempt_lock.v1";
  workflow_id: OpaqueId;
  attempt_id: OpaqueId;
  owner_ref: OpaqueRef;
  acquired_at: IsoTimestamp;
  expires_at: IsoTimestamp;
  heartbeat_at?: IsoTimestamp;
  recovery_state: LockRecoveryV1;
  audit_ref: OpaqueRef;
}

interface FlowDeskLaneRecordV1 {
  schema_version: "flowdesk.lane_record.v1";
  lane_id: OpaqueId;
  workflow_id: OpaqueId;
  plan_revision_id?: OpaqueId;
  attempt_id?: OpaqueId;
  task_ref: OpaqueRef;
  lane_class: "planning_draft" | "planning_refine" | "planning_review" | "research" | "documentation" | "verification" | "diagnostics" | "other";
  state: PersistedLaneStateV1;
  created_at: IsoTimestamp;
  started_at?: IsoTimestamp;
  updated_at: IsoTimestamp;
  completed_at?: IsoTimestamp;
  failure_class?: LaneFailureClass;
  invocation_ref_kind?: LaneInvocationRefKind;
  retry_count?: number;
  verdict_status?: LaneVerdictStatus;
  safe_next_action: SafeNextAction;
  refs: OpaqueRef[];
  event_refs: OpaqueRef[];
  audit_refs: OpaqueRef[];
  debug_ref?: OpaqueRef;
}

interface FlowDeskAuditRecordV1 {
  schema_version: "flowdesk.audit_record.v1";
  audit_ref: OpaqueRef;
  event_id?: OpaqueId;
  workflow_id?: OpaqueId;
  attempt_id?: OpaqueId;
  step_id?: OpaqueId;
  checkpoint_id?: OpaqueId;
  event_type: string;
  created_at: IsoTimestamp;
  actor_class?: "user" | "flowdesk" | "opencode" | "provider" | "system" | "unknown";
  summary_label: string;
  policy_ref?: OpaqueRef;
  decision_ref?: OpaqueRef;
  evidence_refs: OpaqueRef[];
  artifact_refs: OpaqueRef[];
  redaction_version: string;
}

interface FlowDeskDebugExportManifestV1 {
  schema_version: "flowdesk.debug_export_manifest.v1";
  export_id: OpaqueId;
  manifest_ref: OpaqueRef;
  workflow_id?: OpaqueId;
  session_ref?: OpaqueRef;
  created_at: IsoTimestamp;
  delete_after: IsoTimestamp;
  included_sections: DebugSectionSummaryV1[];
  redaction_version: string;
  source_refs: OpaqueRef[];
  file_count: number;
  byte_count: number;
  warnings: string[];
  deletion_state: "pending" | "deleted" | "partial" | "retained_by_policy";
  deletion_proof_ref?: OpaqueRef;
  partial_deletion_warning?: string;
  audit_refs: OpaqueRef[];
}
```

`LaneSummaryV1` includes `hard_cancel_proven` only as a future gated summary value for surfaces where pinned conformance proves hard cancellation. Release 1 persisted `FlowDeskLaneRecordV1` uses `PersistedLaneStateV1` and must not store `hard_cancel_proven`.

Persisted workflow/state fixture suites must include valid minimal/full examples plus invalid unknown-property, forbidden-raw-payload, raw-path, stale-lock, corrupt-lock, mismatched-active-workflow, event-only-checkpoint, and session-authority-conflict examples where applicable.

## Config and Policy Schemas

The schemas below are the Release 1 canonical shapes for `.flowdesk/config.json`, Policy Pack references, effective policy summaries, and Guard-approved non-dispatch permissions. Config and Policy Pack data may constrain eligibility, shorten retention, disable modes, and require checks. They must not store reusable approval, enable Release 1 real dispatch, enable automatic provider/model fallback, claim hard chat cancellation/no-reply, or authorize actual OpenCode subtask/model/provider lane launch.

| Config/policy record | Schema id | TypeScript interface | Fixture prefix |
|---|---|---|---|
| `.flowdesk/config.json` | `flowdesk.project_config.v1` | `FlowDeskProjectConfigV1` | `project-config` |
| Policy Pack document | `flowdesk.policy_pack.v1` | `FlowDeskPolicyPackV1` | `policy-pack` |
| Effective merged policy summary | `flowdesk.effective_policy.v1` | `FlowDeskEffectivePolicyV1` | `effective-policy` |
| Guard-approved non-dispatch permission | `flowdesk.non_dispatch_permission.v1` | `FlowDeskNonDispatchPermissionV1` | `non-dispatch-permission` |

```ts
type ReleaseModeV1 = "release1" | "managed_dispatch_beta" | "operational_intelligence" | "specialist_workflow";
type ChatIntakeModeV1 = "steering" | "observe_only" | "off";
type HookHarnessModeV1 = "enforce" | "observe" | "off";
type PolicyEffectV1 = "allow" | "deny" | "require_approval" | "disable_mode";
type NonDispatchPermissionClassV1 = "bootstrap_profile_mutation" | "config_scaffold" | "state_write" | "audit_write" | "debug_export_write" | "usage_snapshot_write" | "fake_runtime_write";

interface FlowDeskRetentionPolicyV1 {
  session_records_max_days: number;
  debug_staging_max_days: number;
  conformance_summary_max_days: number;
  allow_user_longer_retention: boolean;
  deletion_behavior: "delete_after_expiry" | "keep_until_policy_expiry" | "manual_cleanup_only";
}

interface FlowDeskUsagePolicyV1 {
  usage_freshness_ttl_minutes: number;
  unknown_usage_dispatchability: "non_dispatchable";
  stale_usage_dispatchability: "non_dispatchable";
  refused_usage_dispatchability: "non_dispatchable";
  shared_limit_suspected_dispatchability: "non_dispatchable";
  fallback_derived_dispatchability: "non_dispatchable";
  allow_local_history_source: boolean;
  allow_provider_console_scraping: false;
}

interface FlowDeskProviderHealthPolicyV1 {
  health_freshness_ttl_minutes: number;
  unavailable_dispatchability: "non_dispatchable";
  degraded_dispatchability: "diagnostic_only" | "non_dispatchable";
  opencode_go_usage_without_official_quota: "unknown";
  z_ai_usage_without_official_quota: "unknown";
  allow_automatic_provider_fallback: false;
}

interface FlowDeskHookPolicyV1 {
  chat_intake_mode: ChatIntakeModeV1;
  hook_harness_mode: HookHarnessModeV1;
  blocking_chat_intake_enabled: false;
  hard_no_reply_or_cancel_enabled: false;
}

interface FlowDeskPolicyRuleV1 {
  rule_id: OpaqueId;
  effect: PolicyEffectV1;
  target: "release_mode" | "tool" | "permission_class" | "provider_family" | "agent_profile" | "retention" | "extension";
  summary_label: string;
  refs: OpaqueRef[];
}

interface FlowDeskProjectConfigV1 {
  schema_version: "flowdesk.project_config.v1";
  config_id: OpaqueId;
  created_at: IsoTimestamp;
  updated_at: IsoTimestamp;
  release_mode: "release1";
  project_root_ref: OpaqueRef;
  config_hash: string;
  policy_pack_refs: OpaqueRef[];
  policy_pack_hashes: string[];
  chat_intake_mode: ChatIntakeModeV1;
  hook_harness_mode: HookHarnessModeV1;
  retention: FlowDeskRetentionPolicyV1;
  usage_policy: FlowDeskUsagePolicyV1;
  provider_health_policy: FlowDeskProviderHealthPolicyV1;
  disabled_modes: DisabledModeV1[];
  extension_namespaces: string[];
  audit_refs: OpaqueRef[];
}

interface FlowDeskPolicyPackV1 {
  schema_version: "flowdesk.policy_pack.v1";
  policy_pack_id: OpaqueId;
  policy_pack_hash: string;
  name: string;
  version: string;
  source_ref: OpaqueRef;
  applies_to_release_modes: ReleaseModeV1[];
  priority: number;
  rules: FlowDeskPolicyRuleV1[];
  hard_ban_refs: OpaqueRef[];
  retention_override?: FlowDeskRetentionPolicyV1;
  usage_policy_override?: FlowDeskUsagePolicyV1;
  provider_health_policy_override?: FlowDeskProviderHealthPolicyV1;
  hook_policy_override?: FlowDeskHookPolicyV1;
  allowed_extension_namespaces: string[];
  redaction_baseline_ref: OpaqueRef;
}

interface FlowDeskEffectivePolicyV1 {
  schema_version: "flowdesk.effective_policy.v1";
  effective_policy_id: OpaqueId;
  config_hash: string;
  policy_pack_hashes: string[];
  computed_at: IsoTimestamp;
  release_mode: "release1";
  disabled_modes: DisabledModeV1[];
  retention: FlowDeskRetentionPolicyV1;
  usage_policy: FlowDeskUsagePolicyV1;
  provider_health_policy: FlowDeskProviderHealthPolicyV1;
  hook_policy: FlowDeskHookPolicyV1;
  rules: FlowDeskPolicyRuleV1[];
  audit_ref: OpaqueRef;
}

interface FlowDeskNonDispatchPermissionV1 {
  schema_version: "flowdesk.non_dispatch_permission.v1";
  permission_id: OpaqueId;
  permission_class: NonDispatchPermissionClassV1;
  workflow_id?: OpaqueId;
  scope_ref: OpaqueRef;
  grant_source: "bootstrap" | "guard_rule" | "typed_confirmation" | "policy_pack";
  created_at: IsoTimestamp;
  expires_at: IsoTimestamp;
  config_hash: string;
  policy_pack_hash: string;
  release_mode: ReleaseModeV1;
  audit_ref?: OpaqueRef;
}
```

Release 1 `FlowDeskProjectConfigV1.release_mode` and `FlowDeskEffectivePolicyV1.release_mode` must be the literal `release1`. Later release-mode values may appear only in Policy Pack compatibility declarations and non-dispatch permission mismatch checks; they do not enable later-gate behavior in Release 1. Unknown config/policy properties fail validation. Extension names must be explicit schema-safe namespace labels and may not carry nested arbitrary policy payloads until a later schema version defines that namespace.

Config/policy fixture suites must include valid minimal/full examples plus invalid unknown-property, release-mode-escalation, fallback-enabled, hard-cancel-enabled, provider-console-scraping-enabled, retention-too-long-without-user-config, stale-hash, mismatched-policy-pack-hash, forbidden-raw-payload, raw-path, and unregistered-extension examples where applicable.

## Installer and Bootstrap Schemas

The schemas below are the Release 1 canonical shapes for installer/bootstrap planning, backup, rollback, report, and doctor handoff artifacts. Bootstrap records may prove what was planned, backed up, changed, skipped, restored, or handed to doctor. They must not contain raw OpenCode config/profile content, credentials, provider auth entries, raw paths, raw command bodies, raw prompts, transcripts, provider payloads, stack traces, or runtime echoes. Bootstrap authority is temporary and ends when `/flowdesk-doctor` passes.

| Bootstrap record | Schema id | TypeScript interface | Fixture prefix |
|---|---|---|---|
| Installer plan | `flowdesk.bootstrap_install_plan.v1` | `FlowDeskBootstrapInstallPlanV1` | `bootstrap-install-plan` |
| Backup manifest | `flowdesk.bootstrap_backup_manifest.v1` | `FlowDeskBootstrapBackupManifestV1` | `bootstrap-backup-manifest` |
| Profile mutation summary | `flowdesk.profile_mutation_summary.v1` | `FlowDeskProfileMutationSummaryV1` | `profile-mutation-summary` |
| OMO cleanup summary | `flowdesk.omo_cleanup_summary.v1` | `FlowDeskOmoCleanupSummaryV1` | `omo-cleanup-summary` |
| Command generation summary | `flowdesk.command_generation_summary.v1` | `FlowDeskCommandGenerationSummaryV1` | `command-generation-summary` |
| Config scaffold summary | `flowdesk.config_scaffold_summary.v1` | `FlowDeskConfigScaffoldSummaryV1` | `config-scaffold-summary` |
| Rollback plan | `flowdesk.bootstrap_rollback_plan.v1` | `FlowDeskBootstrapRollbackPlanV1` | `bootstrap-rollback-plan` |
| Rollback result | `flowdesk.bootstrap_rollback_result.v1` | `FlowDeskBootstrapRollbackResultV1` | `bootstrap-rollback-result` |
| Bootstrap report | `flowdesk.bootstrap_report.v1` | `FlowDeskBootstrapReportV1` | `bootstrap-report` |
| Doctor handoff | `flowdesk.doctor_handoff.v1` | `FlowDeskDoctorHandoffV1` | `doctor-handoff` |

```ts
type BootstrapPhaseV1 = "preflight" | "backup" | "profile_mutation" | "omo_cleanup" | "plugin_registration" | "command_generation" | "config_scaffold" | "doctor_handoff" | "complete" | "failed" | "rolled_back";
type BootstrapMutationStatusV1 = "planned" | "skipped" | "applied" | "failed" | "rolled_back" | "partial";
type BootstrapFailureClassV1 = "typed_confirmation_missing" | "backup_failed" | "profile_conflict" | "unsafe_plugin_spec" | "command_template_unsafe" | "config_invalid" | "doctor_failed" | "rollback_failed" | "redaction_blocked" | "unknown";

interface FlowDeskBootstrapInstallPlanV1 {
  schema_version: "flowdesk.bootstrap_install_plan.v1";
  install_plan_id: OpaqueId;
  created_at: IsoTimestamp;
  target_profile_ref: OpaqueRef;
  release_mode: "release1";
  planned_phases: BootstrapPhaseV1[];
  requires_typed_confirmation: boolean;
  confirmation_ref?: OpaqueRef;
  package_ref: OpaqueRef;
  rollback_plan_ref: OpaqueRef;
  safe_next_actions: SafeNextAction[];
}

interface FlowDeskBootstrapBackupManifestV1 {
  schema_version: "flowdesk.bootstrap_backup_manifest.v1";
  backup_manifest_id: OpaqueId;
  created_at: IsoTimestamp;
  target_profile_ref: OpaqueRef;
  backup_ref: OpaqueRef;
  backup_hash: string;
  source_config_ref: OpaqueRef;
  credential_preservation_check: "passed" | "blocked" | "not_applicable";
  restore_eligible: boolean;
  audit_ref: OpaqueRef;
}

interface FlowDeskProfileMutationSummaryV1 {
  schema_version: "flowdesk.profile_mutation_summary.v1";
  mutation_id: OpaqueId;
  target_profile_ref: OpaqueRef;
  status: BootstrapMutationStatusV1;
  changed_entry_refs: OpaqueRef[];
  skipped_entry_refs: OpaqueRef[];
  provider_auth_preserved: "passed" | "blocked" | "unknown";
  unrelated_profile_mutation: false;
  backup_manifest_ref: OpaqueRef;
  audit_ref: OpaqueRef;
}

interface FlowDeskOmoCleanupSummaryV1 {
  schema_version: "flowdesk.omo_cleanup_summary.v1";
  cleanup_id: OpaqueId;
  target_profile_ref: OpaqueRef;
  status: BootstrapMutationStatusV1;
  removed_ref_count: number;
  retained_ref_count: number;
  blocked_ref_count: number;
  omitted_legacy_runtime_imports: boolean;
  provider_auth_preserved: "passed" | "blocked" | "unknown";
  backup_manifest_ref: OpaqueRef;
  audit_ref: OpaqueRef;
}

interface FlowDeskCommandGenerationSummaryV1 {
  schema_version: "flowdesk.command_generation_summary.v1";
  generation_id: OpaqueId;
  target_profile_ref: OpaqueRef;
  status: BootstrapMutationStatusV1;
  command_refs: OpaqueRef[];
  template_hash: string;
  static_template_validation: "passed" | "blocked";
  alias_conformance_ref?: OpaqueRef;
  rollback_ref: OpaqueRef;
}

interface FlowDeskConfigScaffoldSummaryV1 {
  schema_version: "flowdesk.config_scaffold_summary.v1";
  scaffold_id: OpaqueId;
  status: BootstrapMutationStatusV1;
  config_ref: OpaqueRef;
  config_hash: string;
  policy_pack_refs: OpaqueRef[];
  policy_pack_hashes: string[];
  audit_ref: OpaqueRef;
}

interface FlowDeskBootstrapRollbackPlanV1 {
  schema_version: "flowdesk.bootstrap_rollback_plan.v1";
  rollback_plan_id: OpaqueId;
  install_plan_id: OpaqueId;
  target_profile_ref: OpaqueRef;
  backup_manifest_ref: OpaqueRef;
  reversible_phase_refs: OpaqueRef[];
  non_reversible_summary_refs: OpaqueRef[];
  restore_preconditions: FreshCheckV1[];
  safe_next_actions: SafeNextAction[];
}

interface FlowDeskBootstrapRollbackResultV1 {
  schema_version: "flowdesk.bootstrap_rollback_result.v1";
  rollback_result_id: OpaqueId;
  rollback_plan_id: OpaqueId;
  completed_at: IsoTimestamp;
  status: "restored" | "partial" | "blocked" | "failed";
  restored_ref_count: number;
  skipped_ref_count: number;
  warning_count: number;
  audit_refs: OpaqueRef[];
  safe_next_actions: SafeNextAction[];
}

interface FlowDeskDoctorHandoffV1 {
  schema_version: "flowdesk.doctor_handoff.v1";
  handoff_id: OpaqueId;
  created_at: IsoTimestamp;
  install_plan_ref: OpaqueRef;
  bootstrap_report_ref: OpaqueRef;
  config_ref?: OpaqueRef;
  compatibility_ref?: OpaqueRef;
  doctor_request_ref: OpaqueRef;
  safe_next_actions: SafeNextAction[];
}

interface FlowDeskBootstrapReportV1 {
  schema_version: "flowdesk.bootstrap_report.v1";
  report_id: OpaqueId;
  install_plan_id: OpaqueId;
  target_profile_ref: OpaqueRef;
  started_at: IsoTimestamp;
  completed_at?: IsoTimestamp;
  final_phase: BootstrapPhaseV1;
  status: "complete" | "failed" | "rolled_back" | "partial";
  failure_class?: BootstrapFailureClassV1;
  backup_manifest_ref?: OpaqueRef;
  profile_mutation_ref?: OpaqueRef;
  omo_cleanup_ref?: OpaqueRef;
  command_generation_ref?: OpaqueRef;
  config_scaffold_ref?: OpaqueRef;
  rollback_plan_ref?: OpaqueRef;
  rollback_result_ref?: OpaqueRef;
  doctor_handoff_ref?: OpaqueRef;
  doctor_report_ref?: OpaqueRef;
  disabled_modes: DisabledModeV1[];
  safe_next_actions: SafeNextAction[];
  audit_refs: OpaqueRef[];
}
```

Bootstrap fixture suites must include valid minimal/full examples plus invalid unknown-property, raw-config-content, credential-leak, raw-path, unsafe-plugin-spec, command-template-interpolation, missing-typed-confirmation, unrelated-profile-mutation, provider-auth-deletion, rollback-without-backup, partial-restore, stale-backup-hash, doctor-handoff-missing-report, and bootstrap-authority-reuse examples where applicable.

## Artifact Allow-List Additions

The implementation specification owns the canonical persisted artifact allow-list. Release 1 implementations must include at least these extra generated schema names before writing matching artifacts:

| Artifact schema id | TypeScript interface | Fixture prefix | Purpose |
|---|---|---|---|
| `flowdesk.audit_event.v1` | `FlowDeskAuditEventV1` | `audit-event` | Redacted audit writer input/event envelope without raw payloads |
| `flowdesk.audit_record.v1` | `FlowDeskAuditRecordV1` | `audit-record` | Redacted persisted audit JSONL record under `.flowdesk/sessions` |
| `flowdesk.doctor_report.v1` | `FlowDeskDoctorReportV1` | `doctor-report` | Full redacted doctor report with section results and compatibility refs |
| `flowdesk.status_summary.v1` | `FlowDeskStatusSummaryArtifactV1` | `status-summary` | Redacted status-card equivalent for workflow, blocker, lane, usage, provider health, checkpoint, and safe next actions |
| `flowdesk.plan_summary.v1` | `FlowDeskPlanSummaryArtifactV1` | `plan-summary` | Redacted plan summary artifact without raw prompt or path content |
| `flowdesk.lane_summary.v1` | `FlowDeskLaneSummaryArtifactV1` | `lane-summary` | Redacted lane status summary artifact with refs and safe next action |
| `flowdesk.verification_summary.v1` | `FlowDeskVerificationSummaryArtifactV1` | `verification-summary` | Redacted verification result summary without command output or stack traces |
| `flowdesk.usage_snapshot.v1` | `FlowDeskUsageSnapshotV1` | `usage-snapshot` | Normalized usage availability snapshot without quota payloads or account ids |
| `flowdesk.provider_health_snapshot.v1` | `FlowDeskProviderHealthSnapshotV1` | `provider-health-snapshot` | Normalized provider health snapshot without raw provider errors or credentials |
| `flowdesk.doctor_section_result.v1` | `DoctorSectionResultV1` | `doctor-section-result` | One safe section inside the doctor report |
| `flowdesk.debug_export_manifest.v1` | `FlowDeskDebugExportManifestV1` | `debug-export-manifest` | Redacted debug export manifest with retention and deletion state |
| `flowdesk.debug_section_summary.v1` | `DebugSectionSummaryV1` | `debug-section-summary` | One redacted debug bundle section summary |
| `flowdesk.audit_ref_summary.v1` | `FlowDeskAuditRefSummaryV1` | `audit-ref-summary` | Bounded audit-reference summary without raw audit payloads |
| `flowdesk.conformance_runtime_metadata.v1` | `FlowDeskConformanceRuntimeMetadataV1` | `conformance-runtime-metadata` | Redacted OpenCode runtime/conformance compatibility metadata |
| `flowdesk.conformance_evidence_record.v1` | `FlowDeskConformanceEvidenceRecordV1` | `conformance-evidence-record` | One redacted conformance evidence JSONL record |
| `flowdesk.bootstrap_report.v1` | `FlowDeskBootstrapReportV1` | `bootstrap-report` | Redacted installer/bootstrap phase report and safe recovery refs |
| `flowdesk.bootstrap_backup_manifest.v1` | `FlowDeskBootstrapBackupManifestV1` | `bootstrap-backup-manifest` | Redacted backup manifest with opaque refs and credential-preservation check |
| `flowdesk.bootstrap_rollback_result.v1` | `FlowDeskBootstrapRollbackResultV1` | `bootstrap-rollback-result` | Redacted rollback/restore result with counts, warnings, audit refs, and safe next actions |
| `flowdesk.doctor_handoff.v1` | `FlowDeskDoctorHandoffV1` | `doctor-handoff` | Redacted handoff from bootstrap evidence to doctor request |

These artifacts may contain only schema-safe ids, labels, counts, coarse status, redacted summaries, and opaque refs. They must not contain raw command output, raw logs, raw provider errors, provider payloads, credentials, auth headers, prompts, transcripts, runtime echoes, raw paths, stack traces, or raw file contents.

Artifact fixture suites must include valid minimal/full examples plus invalid unknown-property, forbidden-raw-payload, raw-path, raw-provider-payload, raw-runtime-echo, credential-shaped, prompt-shaped, unredacted-debug-section, audit-event-with-payload, conformance-evidence-with-raw-source, usage-provider-health-merged, and authority-claim examples where applicable.

## Fixture Matrix

Every Release 1 registered tool requires fixture tests before registration:

1. `<prefix>.valid.minimal.json` validates through FlowDesk runtime-closed validation and converts without crash.
2. `<prefix>.valid.full.json` validates through FlowDesk runtime-closed validation and converts without crash.
3. `<prefix>.invalid.unknown-property.json` fails FlowDesk validation.
4. `<prefix>.invalid.enum.json` fails FlowDesk validation.
5. `<prefix>.invalid.length.json` fails FlowDesk validation.
6. `<prefix>.redaction.secret-shaped.json` fails redaction validation.
7. `<prefix>.redaction.prompt-shaped.json` fails redaction validation.

The schema conversion spike must also include unsupported-control fixtures for union, nullable, mixed Zod/raw args, and raw JSON Schema args. Those fixtures should fail or be explicitly marked unsupported; they must not be registered in production profiles.

## Conformance Artifact Requirements

The custom plugin tool schema conversion spike must produce a redacted artifact with:

1. Pinned OpenCode version or commit.
2. FlowDesk version or commit.
3. Tool names and schema ids tested.
4. FDS profile version.
5. Zod authoring result.
6. OpenCode registry conversion result.
7. Provider transform result for every provider/model family included in the spike, including provider-facing `additionalProperties` missing/null versus `false`.
8. Runtime validation result for valid and invalid fixture args, including unknown-property rejection before execution.
9. Crash/no-crash verdict before provider dispatch.
10. Whether descriptions survive conversion well enough for safe model use.
11. Redaction status and evidence refs.
12. Narrowed FDS profile if any fixture fails.

If any Release 1 registered tool lacks a passing runtime-closed schema compatibility artifact, `/flowdesk-doctor` must report production readiness as blocked and the tool must not be registered in production profiles. A missing provider-facing `additionalProperties: false` remains a documented caveat, not a production blocker by itself, when FlowDesk runtime validation rejects unknown properties before execution.
