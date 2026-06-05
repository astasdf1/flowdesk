export type OpaqueId = string;
export type OpaqueRef = string;
export type IsoTimestamp = string;

export const FLOWDESK_SCHEMA_VERSION_PREFIX = "flowdesk." as const;
export const FLOWDESK_RELEASE_1 = "release1" as const;
export const FLOWDESK_WORKFLOW_STATE_ROOT = ".flowdesk/workflows" as const;
export const FLOWDESK_SESSION_RECORD_ROOT = ".flowdesk/sessions" as const;
export const FLOWDESK_CANONICAL_REVIEW_AGENT_ID = "reviewer" as const;

export const FORBIDDEN_RAW_PAYLOAD_MARKERS = [
  "payload",
  "raw_prompt",
  "raw_body",
  "raw_path",
  "raw_log",
  "prompt_body",
  "transcript",
  "credential",
  "secret",
  "token",
  "tool_args",
  "tool_result",
  "shell_output",
  "provider_payload",
  "provider_response",
  "runtime_echo",
  "stack_trace",
  "file_content",
  "file_path",
  "filesystem_path",
  "absolute_path",
  "repo_name",
  "organization_name",
  "branch_name",
  "issue_title",
  "pr_title",
  "prompt_hash"
] as const;

export const INPUT_MODES = ["chat_routed", "portable_command", "alias_command", "test_fixture"] as const;
export type InputMode = (typeof INPUT_MODES)[number];

export const PROVIDER_FAMILIES = ["claude", "anthropic", "openai", "gemini", "google", "opencode", "opencode_go", "z_ai", "unknown", "all"] as const;
export type ProviderFamily = (typeof PROVIDER_FAMILIES)[number];

export const TOOL_STATUSES = [
  "ready",
  "blocked",
  "needs_clarification",
  "dry_run_complete",
  "fake_runtime_complete",
  "recovery_available",
  "degraded",
  "diagnostic_only",
  "error"
] as const;
export type ToolStatus = (typeof TOOL_STATUSES)[number];

export const SAFE_NEXT_ACTIONS = [
  "/flowdesk-doctor",
  "/flowdesk-plan",
  "/flowdesk-explain-route",
  "/flowdesk-run",
  "/flowdesk-status",
  "/flowdesk-resume",
  "/flowdesk-retry",
  "/flowdesk-abort",
  "/flowdesk-usage",
  "/flowdesk-audit",
  "/flowdesk-export-debug",
  "continue_chat",
  "ask_clarification"
] as const;
export type SafeNextAction = (typeof SAFE_NEXT_ACTIONS)[number];

export const REDACTED_ERROR_CATEGORIES = [
  "schema",
  "policy",
  "conformance",
  "usage",
  "provider_health",
  "provider_api",
  "model_availability",
  "state",
  "audit",
  "redaction",
  "runtime",
  "unknown"
] as const;
export type RedactedErrorCategory = (typeof REDACTED_ERROR_CATEGORIES)[number];

export const PROVIDER_FAILURE_CLASSES = [
  "none",
  "auth_missing",
  "auth_expired",
  "provider_unavailable",
  "rate_limited",
  "model_unavailable",
  "transport_timeout",
  "provider_error",
  "opencode_provider_load_failure",
  "telemetry_ambiguous"
] as const;
export type ProviderFailureClass = (typeof PROVIDER_FAILURE_CLASSES)[number];

export const DISABLED_MODES = [
  "chat_routed",
  "real_dispatch",
  "managed_fallback",
  "lane_launch",
  "hard_chat_blocking",
  "workflow_optimization",
  "specialist_workflow"
] as const;
export type DisabledModeV1 = (typeof DISABLED_MODES)[number];

export const DOCTOR_FAILURE_CATEGORIES = ["dispatch_blocking", "chat_mode_disable", "degraded_mode_warning", "informational"] as const;
export type DoctorFailureCategoryV1 = (typeof DOCTOR_FAILURE_CATEGORIES)[number];

export interface DoctorFailureCategoryOutcomeV1 {
  category: DoctorFailureCategoryV1;
  disabled_modes: DisabledModeV1[];
  safe_next_actions: SafeNextAction[];
  managed_dispatch_allowed: false;
  privileged_automation_allowed: false;
  dispatch_authorized: false;
  fallback_authorized: false;
  guard_bypassed: false;
}

export const WORKFLOW_STATES = [
  "idle",
  "intake_received",
  "fast_chat",
  "clarify_pending",
  "plan_pending_approval",
  "guard_pending",
  "ready_to_run",
  "running",
  "verification_failed",
  "retry_pending",
  "blocked",
  "complete",
  "aborted"
] as const;
export type WorkflowStateV1 = (typeof WORKFLOW_STATES)[number];

export const USAGE_UNCERTAINTY_FLAGS = [
  "unknown",
  "stale",
  "refused",
  "shared_limit_suspected",
  "fallback_derived",
  "model_generated",
  "telemetry_ambiguous"
] as const;
export type UsageUncertaintyFlagV1 = (typeof USAGE_UNCERTAINTY_FLAGS)[number];

export const DEBUG_SECTIONS = [
  "doctor",
  "conformance",
  "workflow_state",
  "audit_refs",
  "usage_summary",
  "policy_summary",
  "redaction_summary"
] as const;
export type DebugSectionV1 = (typeof DEBUG_SECTIONS)[number];

export const RELEASE_1_RUN_MODES = ["guarded-dry-run", "fake-runtime", "command-steering", "managed-dispatch"] as const;
export type Release1RunModeV1 = (typeof RELEASE_1_RUN_MODES)[number];
export const FLOWDESK_RUN_REQUEST_MODES = ["guarded-dry-run", "fake-runtime", "managed-dispatch"] as const;
export type FlowDeskRunRequestModeV1 = (typeof FLOWDESK_RUN_REQUEST_MODES)[number];

export const ATTEMPT_STATES = ["created", "guard_pending", "ready", "running", "blocked", "verification_failed", "complete", "aborted"] as const;
export type AttemptStateV1 = (typeof ATTEMPT_STATES)[number];

export const ARTIFACT_DISPOSITIONS = ["none", "quarantined", "promoted", "discarded", "blocked"] as const;
export type ArtifactDispositionV1 = (typeof ARTIFACT_DISPOSITIONS)[number];

export const RESUME_MODES = ["resume", "retry", "abort_only", "status_only"] as const;
export type ResumeModeV1 = (typeof RESUME_MODES)[number];

export const DOCTOR_CHECK_SCOPES = ["install", "runtime", "policy", "usage", "provider_health", "conformance", "all"] as const;
export type DoctorCheckScopeV1 = (typeof DOCTOR_CHECK_SCOPES)[number];

export const DOCTOR_PROFILES = ["production", "development", "test"] as const;
export type DoctorProfileV1 = (typeof DOCTOR_PROFILES)[number];

export const STATUS_DETAIL_LEVELS = ["summary", "diagnostic", "debug_refs", "lane_refs"] as const;
export type StatusDetailLevelV1 = (typeof STATUS_DETAIL_LEVELS)[number];

export const RETENTION_HINTS = ["delete_after_export", "keep_until_default_expiry", "keep_until_policy_expiry"] as const;
export type RetentionHintV1 = (typeof RETENTION_HINTS)[number];

export const LOCK_RECOVERY_STATES = ["active", "stale_recoverable", "conflicted", "corrupt"] as const;
export type LockRecoveryV1 = (typeof LOCK_RECOVERY_STATES)[number];

export const PERSISTED_LANE_STATES = [
  "queued",
  "launching",
  "running",
  "waiting",
  "completed",
  "blocked",
  "failed",
  "timed_out",
  "correlation_lost",
  "cancel_requested",
  "cancel_observed",
  "cancel_failed"
] as const;
export type PersistedLaneStateV1 = (typeof PERSISTED_LANE_STATES)[number];

export const LANE_STATES = [...PERSISTED_LANE_STATES, "hard_cancel_proven"] as const;
export type LaneStateV1 = (typeof LANE_STATES)[number];

export const LANE_FAILURE_CLASSES = [
  "launch_failed",
  "missing_tool",
  "schema_conversion_failed",
  "timeout",
  "correlation_lost",
  "abnormal_exit",
  "telemetry_unavailable",
  "cancellation_unproven",
  "redaction_blocked",
  "invocation_failed",
  "incomplete_result",
  "reference_kind_mismatch",
  "retry_limit_reached",
  "auth_missing",
  "auth_expired",
  "provider_unavailable",
  "rate_limited",
  "model_unavailable",
  "transport_timeout",
  "provider_error",
  "opencode_provider_load_failure"
] as const;
export type LaneFailureClassV1 = (typeof LANE_FAILURE_CLASSES)[number];

export const LANE_INVOCATION_REF_KINDS = ["background_invocation", "continuation_session", "opencode_task", "unknown"] as const;
export type LaneInvocationRefKindV1 = (typeof LANE_INVOCATION_REF_KINDS)[number];

export const LANE_VERDICT_STATUSES = ["present", "missing", "incomplete", "not_required"] as const;
export type LaneVerdictStatusV1 = (typeof LANE_VERDICT_STATUSES)[number];

export const HOOK_HARNESS_MODES = ["enforce", "observe", "off"] as const;
export type HookHarnessModeV1 = (typeof HOOK_HARNESS_MODES)[number];

export const HOOK_HARNESS_ATTEMPT_KINDS = ["chat", "command", "tool", "shell"] as const;
export type HookHarnessAttemptKindV1 = (typeof HOOK_HARNESS_ATTEMPT_KINDS)[number];

export const HOOK_HARNESS_CAPABILITIES = [
  "safe_manual",
  "command_backed_flow",
  "managed_plan",
  "privileged_automation",
  "real_dispatch",
  "provider_call",
  "lane_launch",
  "managed_fallback",
  "hard_chat_control",
  "unknown"
] as const;
export type HookHarnessCapabilityV1 = (typeof HOOK_HARNESS_CAPABILITIES)[number];

export const HOOK_HARNESS_DECISIONS = ["allow_safe_manual", "route_command", "deny", "observe", "off_fallback"] as const;
export type HookHarnessDecisionV1 = (typeof HOOK_HARNESS_DECISIONS)[number];

export const NON_DISPATCH_PERMISSION_CLASSES = [
  "bootstrap_profile_mutation",
  "config_scaffold",
  "state_write",
  "audit_write",
  "debug_export_write",
  "usage_snapshot_write",
  "fake_runtime_write"
] as const;
export type NonDispatchPermissionClassV1 = (typeof NON_DISPATCH_PERMISSION_CLASSES)[number];

export const BOOTSTRAP_PHASES = ["preflight", "backup", "profile_mutation", "omo_cleanup", "plugin_registration", "command_generation", "config_scaffold", "doctor_handoff", "complete", "failed", "rolled_back"] as const;
export type BootstrapPhaseV1 = (typeof BOOTSTRAP_PHASES)[number];

export const BOOTSTRAP_MUTATION_STATUSES = ["planned", "skipped", "applied", "failed", "rolled_back", "partial"] as const;
export type BootstrapMutationStatusV1 = (typeof BOOTSTRAP_MUTATION_STATUSES)[number];

export const BOOTSTRAP_FAILURE_CLASSES = ["typed_confirmation_missing", "backup_failed", "profile_conflict", "unsafe_plugin_spec", "command_template_unsafe", "config_invalid", "doctor_failed", "rollback_failed", "redaction_blocked", "unknown"] as const;
export type BootstrapFailureClassV1 = (typeof BOOTSTRAP_FAILURE_CLASSES)[number];

export const RELEASE_MODES = ["release1", "managed_dispatch_beta", "operational_intelligence", "specialist_workflow"] as const;
export type ReleaseModeV1 = (typeof RELEASE_MODES)[number];

export const CHAT_INTAKE_MODES = ["steering", "observe_only", "off"] as const;
export type ChatIntakeModeV1 = (typeof CHAT_INTAKE_MODES)[number];

export const POLICY_EFFECTS = ["allow", "deny", "require_approval", "disable_mode"] as const;
export type PolicyEffectV1 = (typeof POLICY_EFFECTS)[number];

export const POLICY_RULE_TARGETS = ["release_mode", "tool", "permission_class", "provider_family", "agent_profile", "retention", "extension"] as const;
export type PolicyRuleTargetV1 = (typeof POLICY_RULE_TARGETS)[number];

export const WORKFLOW_PRIMARY_CATEGORIES = [
  "coding",
  "debugging",
  "refactor",
  "test",
  "documentation",
  "research",
  "planning",
  "review",
  "security",
  "data",
  "ops",
  "design",
  "specialist_reference"
] as const;
export type WorkflowPrimaryCategoryV1 = (typeof WORKFLOW_PRIMARY_CATEGORIES)[number];

export type CouplingScopeV1 = "single_file" | "few_files" | "module" | "cross_module" | "repo_wide" | "multi_repo" | "external_system";
export type HardnessV1 = "none" | "low" | "moderate" | "high" | "research_grade";
export type ArchitectureHardnessV1 = "none" | "low" | "moderate" | "high" | "system_boundary";
export type MigrationStateHardnessV1 = "none" | "low" | "moderate" | "high" | "irreversible";
export type DomainUncertaintyV1 = "none" | "low" | "moderate" | "high" | "expert_review_required";
export type VerificationHardnessV1 = "none" | "low" | "moderate" | "high" | "external_lab";
export type OperationalRiskV1 = "none" | "low" | "moderate" | "high" | "critical";
export type PolicyProfessionalBoundaryV1 = "ordinary" | "sensitive" | "restricted" | "specialist_reference_only" | "professional_human_required";

export interface WorkflowTaxonomyV1 {
  primary_category: WorkflowPrimaryCategoryV1;
  difficulty_drivers: string[];
  coupling_scope: CouplingScopeV1;
  algorithmic_hardness: HardnessV1;
  architecture_hardness: ArchitectureHardnessV1;
  migration_state_hardness: MigrationStateHardnessV1;
  domain_uncertainty: DomainUncertaintyV1;
  verification_hardness: VerificationHardnessV1;
  operational_risk: OperationalRiskV1;
  policy_professional_boundary: PolicyProfessionalBoundaryV1;
}

export interface FlowDeskToolRequestEnvelopeV1 {
  schema_version: string;
  request_id: OpaqueId;
  input_mode: InputMode;
  workflow_id?: OpaqueId;
  session_ref?: OpaqueRef;
  redacted_intake_ref?: OpaqueRef;
  user_approval_ref?: OpaqueRef;
}

export interface FlowDeskRedactedErrorV1 {
  code?: string;
  category: RedactedErrorCategory;
  safe_remediation: string;
}

export interface FlowDeskToolResponseEnvelopeV1 {
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

export interface FlowDeskChatIntakeRequestV1 extends FlowDeskToolRequestEnvelopeV1 {
  schema_version: "flowdesk.chat_intake.request.v1";
  intake_summary: string;
  source_surface: "chat.message" | "command.execute.before" | "manual_command" | "test_fixture";
}

export interface FlowDeskChatIntakeResponseV1 extends FlowDeskToolResponseEnvelopeV1 {
  schema_version: "flowdesk.chat_intake.response.v1";
  classification: "fast_chat" | "managed_plan" | "clarify" | "blocked";
  redacted_intake_ref: OpaqueRef;
  route_decision: "continue_chat" | "show_plan" | "ask_clarification" | "block" | "use_command_fallback";
}

export interface FlowDeskHookHarnessRequestV1 {
  schema_version: "flowdesk.hook_harness.request.v1";
  request_id: OpaqueId;
  hook_harness_mode: HookHarnessModeV1;
  attempt_kind: HookHarnessAttemptKindV1;
  requested_capability: HookHarnessCapabilityV1;
  redacted_attempt_ref: OpaqueRef;
  attempt_summary: string;
  chat_intake_mode?: ChatIntakeModeV1;
  conformance_ref?: OpaqueRef;
}

export interface FlowDeskHookHarnessResponseV1 {
  schema_version: "flowdesk.hook_harness.response.v1";
  request_id: OpaqueId;
  hook_harness_mode: HookHarnessModeV1;
  ok: boolean;
  decision: HookHarnessDecisionV1;
  diagnostic_observations: string[];
  safe_next_actions: SafeNextAction[];
  user_message: string;
  managed_automation_enabled: boolean;
  privileged_automation_enabled: false;
  dispatch_authorized: false;
  guard_bypassed: false;
  fallback_authorized: false;
  hard_chat_authority: false;
  mutation_applied: boolean;
  denial_applied: boolean;
  redacted_attempt_ref: OpaqueRef;
  audit_ref?: OpaqueRef;
}

export interface FlowDeskDoctorRequestV1 extends FlowDeskToolRequestEnvelopeV1 {
  schema_version: "flowdesk.doctor.request.v1";
  check_scope: "install" | "runtime" | "policy" | "usage" | "provider_health" | "conformance" | "all";
  profile: "production" | "development" | "test";
  persist_report?: boolean;
}

export interface FlowDeskDoctorResponseV1 extends FlowDeskToolResponseEnvelopeV1 {
  schema_version: "flowdesk.doctor.response.v1";
  doctor_results: DoctorSectionResultV1[];
  provider_health_summary: ProviderHealthSummaryV1;
  compatibility_ref: OpaqueRef;
  disabled_modes: DisabledModeV1[];
}

export interface FlowDeskPlanRequestV1 extends FlowDeskToolRequestEnvelopeV1 {
  schema_version: "flowdesk.plan.request.v1";
  goal_summary: string;
  scope_summary: string;
  risk_hint: string;
  existing_plan_revision_id?: OpaqueId;
}

export interface FlowDeskPlanResponseV1 extends FlowDeskToolResponseEnvelopeV1 {
  schema_version: "flowdesk.plan.response.v1";
  plan_revision_id: OpaqueId;
  delegated_authoring_summary: string;
  required_approvals: OpaqueRef[];
  guard_precheck: GuardPrecheckSummaryV1;
}

export interface FlowDeskRunRequestV1 extends FlowDeskToolRequestEnvelopeV1 {
  schema_version: "flowdesk.run.request.v1";
  run_mode: FlowDeskRunRequestModeV1;
  plan_revision_id: OpaqueId;
  step_id?: OpaqueId;
  managed_dispatch_boundary_input?: Record<string, unknown>;
  managed_dispatch_request?: Record<string, unknown>;
  managed_dispatch_manifest?: Record<string, unknown>;
  managed_dispatch_reloaded_evidence?: Record<string, unknown>;
}

export interface FlowDeskRunResponseV1 extends FlowDeskToolResponseEnvelopeV1 {
  schema_version: "flowdesk.run.response.v1";
  run_result_ref: OpaqueRef;
  verification_summary_ref: OpaqueRef;
  artifact_disposition: "none" | "quarantined" | "promoted" | "discarded";
}

export interface FlowDeskStatusRequestV1 extends FlowDeskToolRequestEnvelopeV1 {
  schema_version: "flowdesk.status.request.v1";
  detail_level?: "summary" | "diagnostic" | "debug_refs" | "lane_refs";
}

export interface FlowDeskStatusResponseV1 extends FlowDeskToolResponseEnvelopeV1 {
  schema_version: "flowdesk.status.response.v1";
  workflow_state: WorkflowStateV1;
  current_step_id?: OpaqueId;
  lane_summaries: FlowDeskStatusLaneSummaryV1[];
  provider_health_summary: ProviderHealthSummaryV1;
  blocker?: BlockerSummaryV1;
  checkpoint_id?: OpaqueId;
}

export interface FlowDeskResumeRequestV1 extends FlowDeskToolRequestEnvelopeV1 {
  schema_version: "flowdesk.resume.request.v1";
  checkpoint_id: OpaqueId;
  resume_mode: ResumeModeV1;
}

export interface FlowDeskResumeResponseV1 extends FlowDeskToolResponseEnvelopeV1 {
  schema_version: "flowdesk.resume.response.v1";
  resume_decision: "allowed" | "blocked" | "requires_fresh_checks" | "status_only";
  required_fresh_checks: FreshCheckV1[];
  next_checkpoint_id?: OpaqueId;
}

export interface FlowDeskRetryRequestV1 extends FlowDeskToolRequestEnvelopeV1 {
  schema_version: "flowdesk.retry.request.v1";
  attempt_id: OpaqueId;
  retry_reason: string;
  new_binding_hint?: string;
}

export interface FlowDeskRetryResponseV1 extends FlowDeskToolResponseEnvelopeV1 {
  schema_version: "flowdesk.retry.response.v1";
  new_attempt_id: OpaqueId;
  required_guard_checks: GuardCheckV1[];
  retry_state: "planned" | "blocked" | "diagnostic_only";
}

export interface FlowDeskAbortRequestV1 extends FlowDeskToolRequestEnvelopeV1 {
  schema_version: "flowdesk.abort.request.v1";
  workflow_id: OpaqueId;
  attempt_id?: OpaqueId;
  lane_id?: OpaqueId;
  reason: string;
}

export interface FlowDeskAbortResponseV1 extends FlowDeskToolResponseEnvelopeV1 {
  schema_version: "flowdesk.abort.response.v1";
  cancellation_state: "cancel_requested" | "cancel_observed" | "cancel_failed";
  remaining_safe_actions: SafeNextAction[];
}

export interface FlowDeskUsageRequestV1 extends FlowDeskToolRequestEnvelopeV1 {
  schema_version: "flowdesk.usage.request.v1";
  provider_family: ProviderFamily;
  refresh: boolean;
}

export interface FlowDeskUsageResponseV1 extends FlowDeskToolResponseEnvelopeV1 {
  schema_version: "flowdesk.usage.response.v1";
  usage_snapshot_ref: OpaqueRef;
  provider_health_snapshot_ref?: OpaqueRef;
  freshness: "fresh" | "stale" | "unknown";
  dispatchability: "dispatchable" | "diagnostic_only" | "non_dispatchable";
  uncertainty_flags: UsageUncertaintyFlagV1[];
}

export interface FlowDeskExplainRouteRequestV1 extends FlowDeskToolRequestEnvelopeV1 {
  schema_version: "flowdesk.explain_route.request.v1";
  workflow_id: OpaqueId;
  route_ref: OpaqueRef;
}

export interface FlowDeskExplainRouteResponseV1 extends FlowDeskToolResponseEnvelopeV1 {
  schema_version: "flowdesk.explain_route.response.v1";
  route_summary: string;
  guard_rationale_ref?: OpaqueRef;
}

export interface FlowDeskAuditRequestV1 extends FlowDeskToolRequestEnvelopeV1 {
  schema_version: "flowdesk.audit.request.v1";
  workflow_id: OpaqueId;
  audit_query: "latest" | "workflow_summary" | "guard_decisions" | "verification_refs" | "debug_refs";
}

export interface FlowDeskAuditResponseV1 extends FlowDeskToolResponseEnvelopeV1 {
  schema_version: "flowdesk.audit.response.v1";
  audit_refs: OpaqueRef[];
  summary_labels: string[];
  redaction_version: string;
}

export interface FlowDeskExportDebugRequestV1 extends FlowDeskToolRequestEnvelopeV1 {
  schema_version: "flowdesk.export_debug.request.v1";
  include_sections: DebugSectionV1[];
  retention_hint: "delete_after_export" | "keep_until_default_expiry" | "keep_until_policy_expiry";
}

export interface FlowDeskExportDebugResponseV1 extends FlowDeskToolResponseEnvelopeV1 {
  schema_version: "flowdesk.export_debug.response.v1";
  export_manifest_ref: OpaqueRef;
  included_sections: DebugSectionSummaryV1[];
  delete_after: IsoTimestamp;
}

export interface ProviderHealthSummaryV1 {
  provider_family: ProviderFamily;
  model_family?: string;
  availability_state: "healthy" | "degraded" | "unavailable" | "unknown";
  failure_class: ProviderFailureClass;
  dispatchability: "dispatchable" | "diagnostic_only" | "non_dispatchable";
  safe_remediation: string;
  snapshot_ref?: OpaqueRef;
}

export interface DoctorSectionResultV1 {
  schema_version: "flowdesk.doctor_section_result.v1";
  run_id: OpaqueId;
  section: "migration_cleanup" | "opencode_plugin_compatibility" | "provider_usage_readiness" | "policy_project_safety";
  category: DoctorFailureCategoryV1;
  summary: string;
  safe_next_actions: SafeNextAction[];
  refs: OpaqueRef[];
  redaction_version: string;
}

export interface LaneSummaryV1 {
  lane_id: OpaqueId;
  task_ref: OpaqueRef;
  lane_class: "planning_draft" | "planning_refine" | "planning_review" | "research" | "documentation" | "verification" | "diagnostics" | "other";
  state: LaneStateV1;
  failure_class?: LaneFailureClassV1;
  safe_next_action: SafeNextAction;
  refs: OpaqueRef[];
  invocation_ref_kind?: LaneInvocationRefKindV1;
  retry_count?: number;
  verdict_status?: LaneVerdictStatusV1;
}

export interface FlowDeskStatusLaneSummaryV1 extends LaneSummaryV1 {
	workflow_id: OpaqueId;
	plan_revision_id: OpaqueId;
	attempt_id?: OpaqueId;
  created_at: IsoTimestamp;
  started_at?: IsoTimestamp;
  updated_at: IsoTimestamp;
  completed_at?: IsoTimestamp;
	event_refs: OpaqueRef[];
	audit_refs: OpaqueRef[];
	observability_ref?: OpaqueRef;
	log_ref?: OpaqueRef;
	debug_ref?: OpaqueRef;
}

export const LANE_OBSERVABILITY_LEVELS = ["status_summary", "openable_refs", "native_child_trace", "event_stream"] as const;
export type LaneObservabilityLevelV1 = (typeof LANE_OBSERVABILITY_LEVELS)[number];

export const LANE_INSPECTION_STATES = ["inspectable", "degraded", "blocked"] as const;
export type LaneInspectionStateV1 = (typeof LANE_INSPECTION_STATES)[number];

export interface FlowDeskLaneObservabilityArtifactV1 {
	schema_version: "flowdesk.lane_observability.v1";
	observability_id: OpaqueId;
	workflow_id: OpaqueId;
	lane_id: OpaqueId;
	status_summary_ref: OpaqueRef;
	observability_level: LaneObservabilityLevelV1;
	inspection_state: LaneInspectionStateV1;
	lane_state: PersistedLaneStateV1;
	requested_binding_ref?: OpaqueRef;
	observed_binding_ref?: OpaqueRef;
	parent_session_ref?: OpaqueRef;
	child_session_ref?: OpaqueRef;
	message_ref?: OpaqueRef;
	output_ref?: OpaqueRef;
	detail_ref?: OpaqueRef;
	debug_ref?: OpaqueRef;
	inspect_actions: SafeNextAction[];
	redaction_status: "passed" | "partial" | "blocked";
	created_at: IsoTimestamp;
	updated_at: IsoTimestamp;
	dispatch_authority_enabled: false;
	provider_call_made: false;
	runtime_execution: false;
	hard_chat_authority_claimed: false;
}

export interface BlockerSummaryV1 {
  category: RedactedErrorCategory;
  summary: string;
  safe_remediation: string;
  refs: OpaqueRef[];
}

export interface GuardPrecheckSummaryV1 {
  result: "eligible" | "blocked" | "requires_approval";
  required_checks: GuardCheckV1[];
  refs: OpaqueRef[];
}

export interface GuardCheckV1 {
  check: "policy" | "usage" | "provider_health" | "runtime_compatibility" | "audit" | "redaction" | "approval" | "conformance";
  result: "pass" | "fail" | "unknown";
  ref?: OpaqueRef;
}

export interface FreshCheckV1 {
  check: "usage" | "provider_health" | "policy" | "runtime_capability" | "checkpoint" | "audit";
  required: boolean;
  ref?: OpaqueRef;
}

export interface DebugSectionSummaryV1 {
  schema_version: "flowdesk.debug_section_summary.v1";
  export_id: OpaqueId;
  section: DebugSectionV1;
  ref: OpaqueRef;
  redaction_status: "passed" | "partial" | "blocked";
  warning_count: number;
  excluded_categories: RedactedErrorCategory[];
}

export interface FlowDeskWorkflowPlanV1 {
  schema_version: "flowdesk.workflow_plan.v1";
  plan_revision_id: OpaqueId;
  workflow_id: OpaqueId;
  created_at: IsoTimestamp;
  taxonomy: WorkflowTaxonomyV1;
  steps: FlowDeskWorkflowStepV1[];
  required_approvals: GuardCheckV1[];
  verification_summary: string;
}

export interface FlowDeskWorkflowStepV1 {
  step_id: OpaqueId;
  title: string;
  state: WorkflowStateV1;
  lane_class?: LaneSummaryV1["lane_class"];
  requires_guard: boolean;
  required_fresh_checks: FreshCheckV1[];
}

export interface FlowDeskAttemptRecordV1 {
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

export interface FlowDeskWorkflowActiveV1 {
  schema_version: "flowdesk.workflow_active.v1";
  active_workflow_id?: OpaqueId;
  active_attempt_id?: OpaqueId;
  state: WorkflowStateV1;
  updated_at: IsoTimestamp;
  status_summary_ref?: OpaqueRef;
  audit_refs: OpaqueRef[];
}

export interface FlowDeskWorkflowRecordV1 {
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

export interface FlowDeskCheckpointRecordV1 {
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

export interface FlowDeskActiveAttemptLockV1 {
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

export interface FlowDeskLaneRecordV1 {
  schema_version: "flowdesk.lane_record.v1";
  lane_id: OpaqueId;
  workflow_id: OpaqueId;
  plan_revision_id?: OpaqueId;
  attempt_id?: OpaqueId;
  task_ref: OpaqueRef;
  lane_class: LaneSummaryV1["lane_class"];
  state: PersistedLaneStateV1;
  created_at: IsoTimestamp;
  started_at?: IsoTimestamp;
  updated_at: IsoTimestamp;
  completed_at?: IsoTimestamp;
  failure_class?: LaneFailureClassV1;
  invocation_ref_kind?: LaneInvocationRefKindV1;
  retry_count?: number;
  verdict_status?: LaneVerdictStatusV1;
  safe_next_action: SafeNextAction;
	refs: OpaqueRef[];
	event_refs: OpaqueRef[];
	audit_refs: OpaqueRef[];
	observability_ref?: OpaqueRef;
	debug_ref?: OpaqueRef;
}

export interface FlowDeskAuditRecordV1 {
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

export interface FlowDeskDebugExportManifestV1 {
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

export interface FlowDeskDebugSectionFileV1 {
  schema_version: "flowdesk.debug_section_file.v1";
  export_id: OpaqueId;
  section: DebugSectionV1;
  ref: OpaqueRef;
  workflow_id?: OpaqueId;
  session_ref?: OpaqueRef;
  generated_at: IsoTimestamp;
  redaction_version: string;
  redaction_status: "passed" | "partial" | "blocked";
  warning_count: number;
  excluded_categories: RedactedErrorCategory[];
  source_refs: OpaqueRef[];
  summary_labels: string[];
  audit_refs: OpaqueRef[];
}

export interface GuardRequestV1 {
  schema_version: "flowdesk.guard_request.v1";
  guard_request_id: OpaqueId;
  workflow_id: OpaqueId;
  step_id?: OpaqueId;
  attempt_id?: OpaqueId;
  requested_operation: "guarded-dry-run" | "fake-runtime" | "command-steering" | "real-opencode-dispatch" | "non-dispatch-permission";
  taxonomy: WorkflowTaxonomyV1;
  usage_snapshot_ref?: OpaqueRef;
  provider_health_snapshot_ref?: OpaqueRef;
  runtime_capability_ref?: OpaqueRef;
  pre_run_audit_ref?: OpaqueRef;
  non_dispatch_permission_class?: NonDispatchPermissionClassV1;
}

export interface GuardResponseV1 {
  schema_version: "flowdesk.guard_response.v1";
  guard_decision_id: OpaqueId;
  guard_request_id: OpaqueId;
  decision: "approved" | "denied" | "requires_approval" | "requires_fresh_checks";
  required_checks: GuardCheckV1[];
  decision_ref: OpaqueRef;
  audit_ref: OpaqueRef;
}

export interface GuardApprovedDispatchV1 {
  schema_version: "flowdesk.guard_approved_dispatch.v1";
  guard_decision_id: OpaqueId;
  workflow_id: OpaqueId;
  step_id: OpaqueId;
  attempt_id: OpaqueId;
  provider_family: Exclude<ProviderFamily, "unknown" | "all">;
  provider_qualified_model_id: string;
  usage_snapshot_ref: OpaqueRef;
  provider_health_snapshot_ref: OpaqueRef;
  runtime_capability_ref: OpaqueRef;
  pre_dispatch_audit_ref: OpaqueRef;
  expires_at: IsoTimestamp;
}

export interface FlowDeskRetentionPolicyV1 {
  session_records_max_days: number;
  debug_staging_max_days: number;
  conformance_summary_max_days: number;
  allow_user_longer_retention: boolean;
  deletion_behavior: "delete_after_expiry" | "keep_until_policy_expiry" | "manual_cleanup_only";
}

export interface FlowDeskUsagePolicyV1 {
  usage_freshness_ttl_minutes: number;
  unknown_usage_dispatchability: "non_dispatchable";
  stale_usage_dispatchability: "non_dispatchable";
  refused_usage_dispatchability: "non_dispatchable";
  shared_limit_suspected_dispatchability: "non_dispatchable";
  fallback_derived_dispatchability: "non_dispatchable";
  allow_local_history_source: boolean;
  allow_provider_console_scraping: false;
}

export interface FlowDeskProviderHealthPolicyV1 {
  health_freshness_ttl_minutes: number;
  unavailable_dispatchability: "non_dispatchable";
  degraded_dispatchability: "diagnostic_only" | "non_dispatchable";
  opencode_go_usage_without_official_quota: "unknown";
  z_ai_usage_without_official_quota: "unknown";
  allow_automatic_provider_fallback: false;
}

export interface FlowDeskHookPolicyV1 {
  chat_intake_mode: ChatIntakeModeV1;
  hook_harness_mode: HookHarnessModeV1;
  blocking_chat_intake_enabled: false;
  hard_no_reply_or_cancel_enabled: false;
}

export interface FlowDeskPolicyRuleV1 {
  rule_id: OpaqueId;
  effect: PolicyEffectV1;
  target: PolicyRuleTargetV1;
  summary_label: string;
  refs: OpaqueRef[];
}

export interface FlowDeskProjectConfigV1 {
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

export interface FlowDeskPolicyPackV1 {
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

export interface FlowDeskEffectivePolicyV1 {
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

export interface FlowDeskNonDispatchPermissionV1 {
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

export interface FlowDeskBootstrapInstallPlanV1 {
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

export interface FlowDeskBootstrapBackupManifestV1 {
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

export interface FlowDeskProfileMutationSummaryV1 {
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

export interface FlowDeskOmoCleanupSummaryV1 {
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

export interface FlowDeskCommandGenerationSummaryV1 {
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

export interface FlowDeskConfigScaffoldSummaryV1 {
  schema_version: "flowdesk.config_scaffold_summary.v1";
  scaffold_id: OpaqueId;
  status: BootstrapMutationStatusV1;
  config_ref: OpaqueRef;
  config_hash: string;
  policy_pack_refs: OpaqueRef[];
  policy_pack_hashes: string[];
  audit_ref: OpaqueRef;
}

export interface FlowDeskBootstrapRollbackPlanV1 {
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

export interface FlowDeskBootstrapRollbackResultV1 {
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

export interface FlowDeskBootstrapReportV1 {
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

export interface FlowDeskDoctorHandoffV1 {
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

export interface FlowDeskUsageSnapshotV1 {
  schema_version: "flowdesk.usage_snapshot.v1";
  snapshot_id: OpaqueId;
  provider_family: ProviderFamily;
  model_family: string;
  freshness: "fresh" | "stale" | "unknown";
  freshness_ttl: number;
  reset_time: string;
  reset_bucket: string;
  remaining_percent?: number | null;
  dispatchability: "dispatchable" | "diagnostic_only" | "non_dispatchable";
  uncertainty_flags: UsageUncertaintyFlagV1[];
  source_ref: OpaqueRef;
}

export interface FlowDeskProviderHealthSnapshotV1 {
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

export interface FlowDeskRuntimeCapabilityMetadataV1 {
  schema_version: "flowdesk.runtime_capability_metadata.v1";
  capability_ref: OpaqueRef;
  checked_at: IsoTimestamp;
  dispatch_mode: "none" | "fake-runtime" | "guarded-dry-run" | "command-steering" | "real-opencode-dispatch";
  runtime_echo_mode: "none" | "trusted" | "untrusted" | "request_surface_only";
  event_telemetry_mode: "none" | "partial" | "sufficient";
  disabled_modes: DisabledModeV1[];
}

export interface FlowDeskConformanceRuntimeMetadataV1 {
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

export interface FlowDeskConformanceEvidenceRecordV1 {
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

export interface FlowDeskManagedDispatchBetaPolicyV1 {
  release_mode: "managed_dispatch_beta";
  policy_mode: "managed_dispatch_beta";
  config_hash: string;
  policy_pack_hashes: string[];
  fallback_reselection_mode: "disabled";
  hard_chat_authority: "disabled";
  require_quarantine_on_ambiguity: true;
  audit_ref: OpaqueRef;
}

export interface FlowDeskManagedDispatchBetaUsageAuthorityEvidenceV1 {
  schema_version: "flowdesk.managed_dispatch_beta.usage_authority_evidence.v1";
  authority_ref: OpaqueRef;
  usage_snapshot_ref: OpaqueRef;
  provider_family: Exclude<ProviderFamily, "unknown" | "all">;
  provider_qualified_model_id: string;
  model_family: string;
  source_kind: "provider_native" | "dex_conductor" | "openusage";
  source_version_ref: OpaqueRef;
  auth_profile_ref: OpaqueRef;
  auth_evidence_ref: OpaqueRef;
  credential_scope_ref: OpaqueRef;
  account_boundary_ref: OpaqueRef;
  quota_evidence_ref: OpaqueRef;
  usage_acquired: true;
  reset_time: IsoTimestamp;
  reset_bucket: string;
  source_ref: OpaqueRef;
  conformance_ref: OpaqueRef;
  redacted_evidence_refs: OpaqueRef[];
  trusted: true;
  observed_at: IsoTimestamp;
  expires_at: IsoTimestamp;
}

export interface FlowDeskManagedDispatchBetaBindingEvidenceV1 {
  schema_version: "flowdesk.managed_dispatch_beta.binding_evidence.v1";
  binding_ref: OpaqueRef;
  workflow_id: OpaqueId;
  step_id: OpaqueId;
  attempt_id: OpaqueId;
  provider_family: Exclude<ProviderFamily, "unknown" | "all">;
  provider_qualified_model_id: string;
  source: "guard_approved_dispatch";
  trusted: true;
  created_at: IsoTimestamp;
  expires_at: IsoTimestamp;
}

export interface FlowDeskManagedDispatchBetaRuntimeEchoEvidenceV1 {
  schema_version: "flowdesk.managed_dispatch_beta.runtime_echo_evidence.v1";
  runtime_echo_ref: OpaqueRef;
  workflow_id: OpaqueId;
  step_id: OpaqueId;
  attempt_id: OpaqueId;
  provider_family: Exclude<ProviderFamily, "unknown" | "all">;
  provider_qualified_model_id: string;
  runtime_capability_ref: OpaqueRef;
  conformance_ref: OpaqueRef;
  runtime_echo_mode: "trusted";
  trusted: true;
  observed_at: IsoTimestamp;
  expires_at: IsoTimestamp;
}

export interface FlowDeskManagedDispatchBetaTelemetryCorrelationV1 {
  schema_version: "flowdesk.managed_dispatch_beta.telemetry_correlation.v1";
  telemetry_ref: OpaqueRef;
  workflow_id: OpaqueId;
  step_id: OpaqueId;
  attempt_id: OpaqueId;
  event_telemetry_mode: "sufficient";
  correlation_count: number;
  ambiguous: false;
  source_refs: OpaqueRef[];
}

export interface FlowDeskAuditEventV1 {
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

export interface FlowDeskDoctorReportV1 {
  schema_version: "flowdesk.doctor_report.v1";
  run_id: OpaqueId;
  checked_at: IsoTimestamp;
  profile: "production" | "development" | "test";
  category_results: DoctorSectionResultV1[];
  disabled_modes: DisabledModeV1[];
  compatibility_ref: OpaqueRef;
  safe_next_actions: SafeNextAction[];
}

export interface FlowDeskPlanSummaryArtifactV1 {
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

export interface FlowDeskLaneSummaryArtifactV1 extends FlowDeskStatusLaneSummaryV1 {
  schema_version: "flowdesk.lane_summary.v1";
}

export interface FlowDeskVerificationSummaryArtifactV1 {
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

export interface FlowDeskStatusSummaryArtifactV1 {
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

export interface FlowDeskAuditRefSummaryV1 {
  schema_version: "flowdesk.audit_ref_summary.v1";
  audit_ref: OpaqueRef;
  workflow_id?: OpaqueId;
  attempt_id?: OpaqueId;
  event_type: string;
  summary_label: string;
  created_at: IsoTimestamp;
  redaction_version: string;
}

export const FLOWDESK_TOP_TIER_REVIEW_PERSPECTIVES = [
  "policy_security",
  "architecture",
  "verification_implementation"
] as const;
export type FlowDeskTopTierReviewPerspective = (typeof FLOWDESK_TOP_TIER_REVIEW_PERSPECTIVES)[number];

export const FLOWDESK_TOP_TIER_BINDING_AVAILABILITY_STATES = [
  "registered_available",
  "registered_unavailable",
  "registered_blocked"
] as const;
export type FlowDeskTopTierBindingAvailability = (typeof FLOWDESK_TOP_TIER_BINDING_AVAILABILITY_STATES)[number];

export const FLOWDESK_TOP_TIER_LANE_INCLUSION_STATES = ["included", "excluded", "blocked"] as const;
export type FlowDeskTopTierLaneInclusionState = (typeof FLOWDESK_TOP_TIER_LANE_INCLUSION_STATES)[number];

export const FLOWDESK_TOP_TIER_REVIEW_INVENTORY_DECISIONS = ["ready", "blocked", "policy_change_required"] as const;
export type FlowDeskTopTierReviewInventoryDecision = (typeof FLOWDESK_TOP_TIER_REVIEW_INVENTORY_DECISIONS)[number];

export interface FlowDeskTopTierReviewerBindingV1 {
  schema_version: "flowdesk.top_tier_reviewer_binding.v1";
  binding_id: OpaqueId;
  reviewer_profile_id: typeof FLOWDESK_CANONICAL_REVIEW_AGENT_ID;
  binding_label: string;
  provider_family: Exclude<ProviderFamily, "unknown" | "all">;
  provider_qualified_model_id: string;
  model_family: string;
  highest_tier_eligible: true;
  registry_entry_ref: OpaqueRef;
  policy_pack_eligibility_ref: OpaqueRef;
  availability: FlowDeskTopTierBindingAvailability;
  dispatch_authority_enabled: false;
  observed_at: IsoTimestamp;
  expires_at: IsoTimestamp;
}

export interface FlowDeskTopTierReviewerLanePlanV1 {
  schema_version: "flowdesk.top_tier_reviewer_lane_plan.v1";
  lane_plan_id: OpaqueId;
  binding_ref: OpaqueRef;
  perspective: FlowDeskTopTierReviewPerspective;
  inclusion_state: FlowDeskTopTierLaneInclusionState;
  reason_label: string;
  safe_next_actions: SafeNextAction[];
  dispatch_authority_enabled: false;
}

export interface FlowDeskTopTierReviewBindingInventoryV1 {
  schema_version: "flowdesk.top_tier_review_binding_inventory.v1";
  inventory_id: OpaqueId;
  workflow_id: OpaqueId;
  plan_revision_id: OpaqueId;
  created_at: IsoTimestamp;
  redaction_version: string;
  registered_binding_refs: OpaqueRef[];
  available_binding_refs: OpaqueRef[];
  unavailable_binding_refs: OpaqueRef[];
  blocked_binding_refs: OpaqueRef[];
  lane_plan_refs: OpaqueRef[];
  max_concurrent_lane_count: number;
  budget_cap_label: string;
  quota_reserve_label: string;
  timeout_label: string;
  retry_budget_label: string;
  inventory_decision: FlowDeskTopTierReviewInventoryDecision;
  safe_next_actions: SafeNextAction[];
  dispatch_authority_enabled: false;
}

export const FLOWDESK_TOP_TIER_REVIEW_VERDICT_LABELS = ["pass", "changes_required", "blocked", "inconclusive"] as const;
export type FlowDeskTopTierReviewVerdictLabel = (typeof FLOWDESK_TOP_TIER_REVIEW_VERDICT_LABELS)[number];

export const FLOWDESK_TOP_TIER_REVIEW_FINDING_SEVERITIES = ["info", "low", "medium", "high", "critical"] as const;
export type FlowDeskTopTierReviewFindingSeverity = (typeof FLOWDESK_TOP_TIER_REVIEW_FINDING_SEVERITIES)[number];

export const FLOWDESK_TOP_TIER_REVIEW_UNCERTAINTY_LEVELS = ["low", "medium", "high", "unknown"] as const;
export type FlowDeskTopTierReviewUncertaintyLevel = (typeof FLOWDESK_TOP_TIER_REVIEW_UNCERTAINTY_LEVELS)[number];

export interface FlowDeskTopTierReviewFindingV1 {
  finding_id: OpaqueId;
  severity: FlowDeskTopTierReviewFindingSeverity;
  category: RedactedErrorCategory;
  summary_label: string;
  evidence_refs: OpaqueRef[];
  required_fix_label: string;
}

export interface FlowDeskTopTierReviewVerdictV1 {
  schema_version: "flowdesk.top_tier_review_verdict.v1";
  verdict_id: OpaqueId;
  workflow_id: OpaqueId;
  lane_plan_ref: OpaqueRef;
  binding_ref: OpaqueRef;
  perspective: FlowDeskTopTierReviewPerspective;
  source: string;
  created_at: IsoTimestamp;
  redaction_version: string;
  findings: FlowDeskTopTierReviewFindingV1[];
  evidence_refs: OpaqueRef[];
  uncertainty: FlowDeskTopTierReviewUncertaintyLevel;
  required_fixes: string[];
  verdict_label: FlowDeskTopTierReviewVerdictLabel;
  safe_next_actions: SafeNextAction[];
  dispatch_authority_enabled: false;
}

export const FLOWDESK_PLANNED_MODE_FIELD_LABELS = ["top_tier_multi_perspective_review_mode"] as const;
export type FlowDeskPlannedModeFieldLabel = (typeof FLOWDESK_PLANNED_MODE_FIELD_LABELS)[number];

export const FLOWDESK_PLANNED_MODE_FIELD_STATES = ["disabled", "planned", "conformance_ready", "release_gate_ready"] as const;
export type FlowDeskPlannedModeFieldState = (typeof FLOWDESK_PLANNED_MODE_FIELD_STATES)[number];

export const FLOWDESK_FORBIDDEN_MODE_FIELD_STATES = ["enabled", "active", "dispatch_ready", "approved", "authorized"] as const;

export interface FlowDeskPlannedModeFieldV1 {
  label: FlowDeskPlannedModeFieldLabel;
  state: FlowDeskPlannedModeFieldState;
  dispatch_authority_enabled: false;
}

export function flowDeskPlannedModeFieldToString(entry: FlowDeskPlannedModeFieldV1): string {
  return `${entry.label}=${entry.state}`;
}

export function createFlowDeskPlannedTopTierMultiPerspectiveReviewModeFieldV1(state: FlowDeskPlannedModeFieldState = "planned"): FlowDeskPlannedModeFieldV1 {
  return {
    label: "top_tier_multi_perspective_review_mode",
    state,
    dispatch_authority_enabled: false
  };
}

export const FLOWDESK_PLANNED_TOP_TIER_MULTI_PERSPECTIVE_REVIEW_MODE_FIELD_REF = flowDeskPlannedModeFieldToString(createFlowDeskPlannedTopTierMultiPerspectiveReviewModeFieldV1());

export const FLOWDESK_TOP_TIER_REVIEWER_LANE_PROBE_CHANNELS = ["subtask_true_command_lane", "injected_sdk_client"] as const;
export type FlowDeskTopTierReviewerLaneProbeChannel = (typeof FLOWDESK_TOP_TIER_REVIEWER_LANE_PROBE_CHANNELS)[number];

export const FLOWDESK_TOP_TIER_REVIEWER_LANE_PROBE_OUTCOMES = ["probe_pass", "probe_fail_closed", "probe_invalid"] as const;
export type FlowDeskTopTierReviewerLaneProbeOutcome = (typeof FLOWDESK_TOP_TIER_REVIEWER_LANE_PROBE_OUTCOMES)[number];

export interface FlowDeskTopTierReviewerLaneProbeRequestV1 {
  schema_version: "flowdesk.top_tier_reviewer_lane_probe.request.v1";
  probe_id: OpaqueId;
  binding_ref: OpaqueRef;
  lane_plan_ref: OpaqueRef;
  channel: FlowDeskTopTierReviewerLaneProbeChannel;
  agent_id: typeof FLOWDESK_CANONICAL_REVIEW_AGENT_ID;
  provider_qualified_model_id: string;
  perspective: FlowDeskTopTierReviewPerspective;
  auth_evidence_ref: OpaqueRef;
  usage_evidence_ref: OpaqueRef;
  quota_evidence_ref: OpaqueRef;
  provider_health_ref: OpaqueRef;
  runtime_echo_ref: OpaqueRef;
  telemetry_ref: OpaqueRef;
  policy_pack_eligibility_ref: OpaqueRef;
  redaction_version: string;
  fake_runtime: true;
  dispatch_authority_enabled: false;
}

export interface FlowDeskTopTierReviewerLaneProbeResultV1 {
  schema_version: "flowdesk.top_tier_reviewer_lane_probe.result.v1";
  probe_id: OpaqueId;
  channel: FlowDeskTopTierReviewerLaneProbeChannel;
  outcome: FlowDeskTopTierReviewerLaneProbeOutcome;
  failure_label?: string;
  observed_at: IsoTimestamp;
  evidence_refs: OpaqueRef[];
  safe_next_actions: SafeNextAction[];
  dispatch_authority_enabled: false;
  provider_call_made: false;
  lane_launch_made: false;
}
