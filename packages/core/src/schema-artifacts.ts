import { DOCTOR_CHECK_SCOPES, DOCTOR_FAILURE_CATEGORIES, DOCTOR_PROFILES, FLOWDESK_RUN_REQUEST_MODES, HOOK_HARNESS_ATTEMPT_KINDS, HOOK_HARNESS_CAPABILITIES, HOOK_HARNESS_DECISIONS, HOOK_HARNESS_MODES, INPUT_MODES, LANE_FAILURE_CLASSES, LANE_INVOCATION_REF_KINDS, LANE_VERDICT_STATUSES, RETENTION_HINTS, RESUME_MODES, SAFE_NEXT_ACTIONS, STATUS_DETAIL_LEVELS, TOOL_STATUSES } from "./release1-contracts.js";
import { RELEASE_1_SCHEMA_REGISTRY } from "./schema-registry.js";

export type Release1JsonSchemaPropertyType = "string" | "number" | "boolean" | "array" | "object";

export interface Release1JsonSchemaPropertyArtifact {
  type: Release1JsonSchemaPropertyType;
  maxLength?: number;
  maxItems?: number;
  enum?: readonly string[];
  description: string;
}

export interface Release1JsonSchemaArtifact {
  $schema: "https://json-schema.org/draft/2020-12/schema";
  $id: string;
  type: "object";
  required: readonly string[];
  additionalProperties: false;
  properties: Readonly<Record<string, Release1JsonSchemaPropertyArtifact>>;
}

const requestEnvelopeRequired = ["schema_version", "request_id", "input_mode"] as const;
const requestEnvelopeOptional = ["workflow_id", "session_ref", "redacted_intake_ref", "user_approval_ref", "confirmation_nonce"] as const;
const responseEnvelopeRequired = ["schema_version", "ok", "status", "safe_next_actions", "user_message"] as const;
const responseEnvelopeOptional = ["workflow_id", "audit_ref", "debug_ref", "lane_refs", "error"] as const;

const requiredFields: Record<string, readonly string[]> = {
  "flowdesk.tool.request.v1": requestEnvelopeRequired,
  "flowdesk.tool.response.v1": responseEnvelopeRequired,
  "flowdesk.redacted_error.v1": ["category", "safe_remediation"],
  "flowdesk.chat_intake.request.v1": [...requestEnvelopeRequired, "intake_summary", "source_surface"],
  "flowdesk.chat_intake.response.v1": [...responseEnvelopeRequired, "classification", "redacted_intake_ref", "route_decision"],
  "flowdesk.hook_harness.request.v1": ["schema_version", "request_id", "hook_harness_mode", "attempt_kind", "requested_capability", "redacted_attempt_ref", "attempt_summary"],
  "flowdesk.hook_harness.response.v1": ["schema_version", "request_id", "hook_harness_mode", "ok", "decision", "diagnostic_observations", "safe_next_actions", "user_message", "managed_automation_enabled", "privileged_automation_enabled", "dispatch_authorized", "guard_bypassed", "fallback_authorized", "hard_chat_authority", "mutation_applied", "denial_applied", "redacted_attempt_ref"],
  "flowdesk.doctor.request.v1": [...requestEnvelopeRequired, "check_scope", "profile"],
  "flowdesk.doctor.response.v1": [...responseEnvelopeRequired, "doctor_results", "provider_health_summary", "compatibility_ref", "disabled_modes"],
  "flowdesk.plan.request.v1": [...requestEnvelopeRequired, "goal_summary", "scope_summary", "risk_hint"],
  "flowdesk.plan.response.v1": [...responseEnvelopeRequired, "plan_revision_id", "delegated_authoring_summary", "required_approvals", "guard_precheck"],
  "flowdesk.run.request.v1": [...requestEnvelopeRequired, "run_mode", "plan_revision_id"],
  "flowdesk.run.response.v1": [...responseEnvelopeRequired, "run_result_ref", "verification_summary_ref", "artifact_disposition"],
  "flowdesk.status.request.v1": requestEnvelopeRequired,
  "flowdesk.status.response.v1": [...responseEnvelopeRequired, "workflow_state", "lane_summaries", "provider_health_summary"],
  "flowdesk.resume.request.v1": [...requestEnvelopeRequired, "checkpoint_id", "resume_mode"],
  "flowdesk.resume.response.v1": [...responseEnvelopeRequired, "resume_decision", "required_fresh_checks"],
  "flowdesk.retry.request.v1": [...requestEnvelopeRequired, "attempt_id", "retry_reason"],
  "flowdesk.retry.response.v1": [...responseEnvelopeRequired, "new_attempt_id", "required_guard_checks", "retry_state"],
  "flowdesk.abort.request.v1": [...requestEnvelopeRequired, "workflow_id", "reason"],
  "flowdesk.abort.response.v1": [...responseEnvelopeRequired, "cancellation_state", "remaining_safe_actions"],
  "flowdesk.usage.request.v1": [...requestEnvelopeRequired, "provider_family", "refresh"],
  "flowdesk.usage.response.v1": [...responseEnvelopeRequired, "usage_snapshot_ref", "freshness", "dispatchability", "uncertainty_flags"],
  "flowdesk.explain_route.request.v1": [...requestEnvelopeRequired, "workflow_id", "route_ref"],
  "flowdesk.explain_route.response.v1": [...responseEnvelopeRequired, "route_summary"],
  "flowdesk.audit.request.v1": [...requestEnvelopeRequired, "workflow_id", "audit_query"],
  "flowdesk.audit.response.v1": [...responseEnvelopeRequired, "audit_refs", "summary_labels", "redaction_version"],
  "flowdesk.export_debug.request.v1": [...requestEnvelopeRequired, "include_sections", "retention_hint"],
  "flowdesk.export_debug.response.v1": [...responseEnvelopeRequired, "export_manifest_ref", "included_sections", "delete_after"],
  "flowdesk.doctor_section_result.v1": ["schema_version", "run_id", "section", "category", "summary", "safe_next_actions", "refs", "redaction_version"],
  "flowdesk.doctor_report.v1": ["schema_version", "run_id", "checked_at", "profile", "category_results", "disabled_modes", "compatibility_ref", "safe_next_actions"],
  "flowdesk.status_summary.v1": ["schema_version", "workflow_id", "state", "lane_summary_refs", "safe_next_actions", "audit_refs"],
  "flowdesk.plan_summary.v1": ["schema_version", "plan_revision_id", "workflow_id", "created_at", "goal_summary", "scope_summary", "risk_tier", "required_approvals", "step_summary_refs", "verification_summary"],
  "flowdesk.lane_summary.v1": ["schema_version", "lane_id", "workflow_id", "plan_revision_id", "task_ref", "lane_class", "state", "safe_next_action", "refs", "created_at", "updated_at", "event_refs", "audit_refs"],
  "flowdesk.verification_summary.v1": ["schema_version", "verification_id", "workflow_id", "result", "check_labels", "artifact_refs", "safe_next_actions"],
  "flowdesk.usage_snapshot.v1": ["schema_version", "snapshot_id", "provider_family", "model_family", "freshness", "freshness_ttl", "reset_time", "reset_bucket", "dispatchability", "uncertainty_flags", "source_ref"],
  "flowdesk.provider_health_snapshot.v1": ["schema_version", "snapshot_id", "provider_family", "observed_at", "freshness", "freshness_ttl", "source_surface", "availability_state", "failure_class", "dispatchability", "source_ref", "safe_remediation"],
  "flowdesk.evaluation_event.v1": ["schema_version", "evaluation_event_id", "workflow_id", "dedupe_ref", "taxonomy_hash_ref", "policy_hash_ref", "redaction_hash_ref", "scorer_ref", "source_ref", "observed_at", "score_dimensions", "overall_outcome_label", "evidence_refs", "safe_next_actions", "local_only", "append_only", "non_authorizing", "advisory_only", "dispatch_authority_enabled", "approval_authority_enabled", "provider_authority_enabled", "runtime_authority_enabled", "external_write_authority_enabled", "write_authority_enabled", "remote_write_authority_enabled", "fallback_authority_enabled", "lane_launch_authority_enabled", "hard_chat_authority_enabled"],
  "flowdesk.debug_section_summary.v1": ["schema_version", "export_id", "section", "ref", "redaction_status", "warning_count", "excluded_categories"],
  "flowdesk.debug_section_file.v1": ["schema_version", "export_id", "section", "ref", "generated_at", "redaction_version", "redaction_status", "warning_count", "excluded_categories", "source_refs", "summary_labels", "audit_refs"],
  "flowdesk.audit_ref_summary.v1": ["schema_version", "audit_ref", "event_type", "summary_label", "created_at", "redaction_version"],
  "flowdesk.audit_event.v1": ["schema_version", "event_id", "event_type", "created_at", "actor_class", "redaction_version", "summary_label", "artifact_refs"],
  "flowdesk.conformance_runtime_metadata.v1": ["schema_version", "opencode_version", "checked_at", "plugin_package", "plugin_version_or_commit", "chat_intake_mode", "command_alias_mode", "dispatch_mode", "runtime_echo_mode", "event_telemetry_mode", "provider_health_mode", "fallback_reselection_mode", "diagnostics_surface_mode", "lane_observability_mode", "hook_harness_mode", "tui_mode", "mode_fields", "evidence_refs", "disabled_modes"],
  "flowdesk.conformance_evidence_record.v1": ["schema_version", "evidence_ref", "run_id", "checked_at", "evidence_area", "result", "summary_label", "redaction_version", "source_refs"],
  "flowdesk.workflow_active.v1": ["schema_version", "state", "updated_at", "audit_refs"],
  "flowdesk.workflow_record.v1": ["schema_version", "workflow_id", "created_at", "updated_at", "state", "project_root_ref", "config_hash", "policy_pack_id", "policy_pack_hash", "attempt_refs", "checkpoint_refs", "lane_refs", "latest_lane_summary_refs", "audit_refs", "artifact_disposition", "safe_next_actions"],
  "flowdesk.attempt_record.v1": ["schema_version", "attempt_id", "workflow_id", "created_at", "updated_at", "run_mode", "state_at_start", "attempt_state", "pre_run_audit_ref", "runtime_echo_validation", "artifact_disposition", "safe_next_actions"],
  "flowdesk.checkpoint_record.v1": ["schema_version", "checkpoint_id", "workflow_id", "created_at", "expires_at", "resume_mode", "required_fresh_checks", "audit_refs", "artifact_refs", "reason", "safe_next_actions"],
  "flowdesk.active_attempt_lock.v1": ["schema_version", "workflow_id", "attempt_id", "owner_ref", "acquired_at", "expires_at", "recovery_state", "audit_ref"],
  "flowdesk.lane_record.v1": ["schema_version", "lane_id", "workflow_id", "task_ref", "lane_class", "state", "created_at", "updated_at", "safe_next_action", "refs", "event_refs", "audit_refs"],
  "flowdesk.audit_record.v1": ["schema_version", "audit_ref", "event_type", "created_at", "summary_label", "evidence_refs", "artifact_refs", "redaction_version"],
  "flowdesk.debug_export_manifest.v1": ["schema_version", "export_id", "manifest_ref", "created_at", "delete_after", "included_sections", "redaction_version", "source_refs", "file_count", "byte_count", "warnings", "deletion_state", "audit_refs"],
  "flowdesk.project_config.v1": ["schema_version", "config_id", "created_at", "updated_at", "release_mode", "project_root_ref", "config_hash", "policy_pack_refs", "policy_pack_hashes", "chat_intake_mode", "hook_harness_mode", "retention", "usage_policy", "provider_health_policy", "disabled_modes", "extension_namespaces", "audit_refs"],
  "flowdesk.policy_pack.v1": ["schema_version", "policy_pack_id", "policy_pack_hash", "name", "version", "source_ref", "applies_to_release_modes", "priority", "rules", "hard_ban_refs", "allowed_extension_namespaces", "redaction_baseline_ref"],
  "flowdesk.effective_policy.v1": ["schema_version", "effective_policy_id", "config_hash", "policy_pack_hashes", "computed_at", "release_mode", "disabled_modes", "retention", "usage_policy", "provider_health_policy", "hook_policy", "rules", "audit_ref"],
  "flowdesk.non_dispatch_permission.v1": ["schema_version", "permission_id", "permission_class", "scope_ref", "grant_source", "created_at", "expires_at", "config_hash", "policy_pack_hash", "release_mode"],
  "flowdesk.bootstrap_install_plan.v1": ["schema_version", "install_plan_id", "created_at", "target_profile_ref", "release_mode", "planned_phases", "requires_typed_confirmation", "package_ref", "rollback_plan_ref", "safe_next_actions"],
  "flowdesk.bootstrap_backup_manifest.v1": ["schema_version", "backup_manifest_id", "created_at", "target_profile_ref", "backup_ref", "backup_hash", "source_config_ref", "credential_preservation_check", "restore_eligible", "audit_ref"],
  "flowdesk.profile_mutation_summary.v1": ["schema_version", "mutation_id", "target_profile_ref", "status", "changed_entry_refs", "skipped_entry_refs", "provider_auth_preserved", "unrelated_profile_mutation", "backup_manifest_ref", "audit_ref"],
  "flowdesk.omo_cleanup_summary.v1": ["schema_version", "cleanup_id", "target_profile_ref", "status", "removed_ref_count", "retained_ref_count", "blocked_ref_count", "omitted_legacy_runtime_imports", "provider_auth_preserved", "backup_manifest_ref", "audit_ref"],
  "flowdesk.command_generation_summary.v1": ["schema_version", "generation_id", "target_profile_ref", "status", "command_refs", "template_hash", "static_template_validation", "rollback_ref"],
  "flowdesk.config_scaffold_summary.v1": ["schema_version", "scaffold_id", "status", "config_ref", "config_hash", "policy_pack_refs", "policy_pack_hashes", "audit_ref"],
  "flowdesk.bootstrap_rollback_plan.v1": ["schema_version", "rollback_plan_id", "install_plan_id", "target_profile_ref", "backup_manifest_ref", "reversible_phase_refs", "non_reversible_summary_refs", "restore_preconditions", "safe_next_actions"],
  "flowdesk.bootstrap_rollback_result.v1": ["schema_version", "rollback_result_id", "rollback_plan_id", "completed_at", "status", "restored_ref_count", "skipped_ref_count", "warning_count", "audit_refs", "safe_next_actions"],
  "flowdesk.bootstrap_report.v1": ["schema_version", "report_id", "install_plan_id", "target_profile_ref", "started_at", "final_phase", "status", "disabled_modes", "safe_next_actions", "audit_refs"],
  "flowdesk.doctor_handoff.v1": ["schema_version", "handoff_id", "created_at", "install_plan_ref", "bootstrap_report_ref", "doctor_request_ref", "safe_next_actions"],
  "flowdesk.guard_request.v1": ["schema_version", "guard_request_id", "workflow_id", "requested_operation", "taxonomy"],
  "flowdesk.guard_response.v1": ["schema_version", "guard_decision_id", "guard_request_id", "decision", "required_checks", "decision_ref", "audit_ref"],
  "flowdesk.guard_approved_dispatch.v1": ["schema_version", "guard_decision_id", "workflow_id", "step_id", "attempt_id", "provider_family", "provider_qualified_model_id", "usage_snapshot_ref", "provider_health_snapshot_ref", "runtime_capability_ref", "pre_dispatch_audit_ref", "expires_at"],
  "flowdesk.runtime_capability_metadata.v1": ["schema_version", "capability_ref", "checked_at", "dispatch_mode", "runtime_echo_mode", "event_telemetry_mode", "disabled_modes"],
  "flowdesk.workflow_plan.v1": ["schema_version", "plan_revision_id", "workflow_id", "created_at", "taxonomy", "steps", "required_approvals", "verification_summary"],
  "flowdesk.top_tier_reviewer_binding.v1": ["schema_version", "binding_id", "reviewer_profile_id", "binding_label", "provider_family", "provider_qualified_model_id", "model_family", "highest_tier_eligible", "registry_entry_ref", "policy_pack_eligibility_ref", "availability", "dispatch_authority_enabled", "observed_at", "expires_at"],
  "flowdesk.top_tier_reviewer_lane_plan.v1": ["schema_version", "lane_plan_id", "binding_ref", "perspective", "inclusion_state", "reason_label", "safe_next_actions", "dispatch_authority_enabled"],
  "flowdesk.top_tier_review_binding_inventory.v1": ["schema_version", "inventory_id", "workflow_id", "plan_revision_id", "created_at", "redaction_version", "registered_binding_refs", "available_binding_refs", "unavailable_binding_refs", "included_binding_refs", "excluded_binding_refs", "blocked_binding_refs", "lane_plan_refs", "labels", "blocked_labels", "evidence_refs", "max_concurrent_lane_count", "budget_cap_label", "quota_reserve_label", "timeout_label", "retry_budget_label", "inventory_decision", "safe_next_actions", "dispatch_authority_enabled", "providerCall", "actualLaneLaunch", "runtimeExecution", "fallback_authority_enabled", "guard_replacement_authority_enabled", "external_write_authority_enabled"],
  "flowdesk.top_tier_review_verdict.v1": ["schema_version", "verdict_id", "workflow_id", "attempt_id", "lane_id", "lane_plan_ref", "binding_ref", "perspective", "source", "created_at", "scored_at", "redaction_version", "findings", "evidence_refs", "uncertainty", "required_fixes", "verdict_label", "safe_next_actions", "dispatch_authority_enabled", "guard_replacement_authority_enabled"],
  "flowdesk.top_tier_reviewer_lane_probe.request.v1": ["schema_version", "probe_id", "binding_ref", "lane_plan_ref", "channel", "agent_id", "provider_qualified_model_id", "perspective", "auth_evidence_ref", "usage_evidence_ref", "quota_evidence_ref", "provider_health_ref", "runtime_echo_ref", "telemetry_ref", "policy_pack_eligibility_ref", "redaction_version", "fake_runtime", "dispatch_authority_enabled"],
  "flowdesk.top_tier_reviewer_lane_probe.result.v1": ["schema_version", "probe_id", "binding_ref", "lane_plan_ref", "channel", "provider_qualified_model_id", "perspective", "outcome", "observed_at", "evidence_refs", "safe_next_actions", "dispatch_authority_enabled", "provider_call_made", "lane_launch_made"],
  "flowdesk.remote_write_connector_capability.v1": ["schema_version", "capability_id", "connector_kind", "connector_ref", "active_profile_ref", "discovered_at", "required_tool_refs", "installed_tool_refs", "missing_tool_refs", "auth_scope_ref", "capability_state", "safe_installation_available", "remote_write_authority_enabled", "external_write_authority_enabled", "dispatch_authority_enabled", "providerCall", "actualLaneLaunch", "runtimeExecution"],
  "flowdesk.remote_write_connector_install_plan.v1": ["schema_version", "installation_plan_id", "capability_ref", "connector_kind", "active_profile_ref", "requested_tool_refs", "package_source_ref", "expected_version_ref", "rollback_ref", "created_at", "requires_user_approval", "approved_for_install", "remote_write_authority_enabled", "external_write_authority_enabled", "dispatch_authority_enabled"],
  "flowdesk.remote_write_plan.v1": ["schema_version", "write_plan_id", "workflow_id", "attempt_id", "connector_kind", "connector_ref", "target_ref", "content_hash_ref", "redaction_policy_ref", "auth_scope_ref", "capability_ref", "pre_write_audit_ref", "idempotency_key_ref", "expected_remote_ref_shape", "created_at", "remote_write_attempted", "remote_write_authority_enabled", "external_write_authority_enabled", "dispatch_authority_enabled", "providerCall", "actualLaneLaunch", "runtimeExecution"],
  "flowdesk.remote_write_connector_execution_readiness.v1": ["schema_version", "state", "blocked_labels", "remote_write_connector_ready", "remote_write_attempted", "remote_write_authority_enabled", "external_write_authority_enabled", "dispatch_authority_enabled", "providerCall", "actualLaneLaunch", "runtimeExecution"],
  "flowdesk.fake_remote_connector_write_result.v1": ["schema_version", "state", "blocked_labels", "fake_remote_write_attempted", "remote_write_attempted", "connector_write_attempted", "github_write_attempted", "storage_write_attempted", "database_write_attempted", "url_write_attempted", "raw_path_write_attempted", "remote_write_authority_enabled", "external_write_authority_enabled", "dispatch_authority_enabled", "providerCall", "actualLaneLaunch", "runtimeExecution"],
  "flowdesk.connector_profile.v1": ["schema_version", "profile_id", "connector_kind", "active_profile_ref", "allowed_target_kinds", "required_tool_refs", "auth_scope_refs", "recipe_playbook_refs", "install_policy", "rollback_ref", "doctor_status_ref", "gateway_execution_authority_enabled", "remote_write_authority_enabled", "external_write_authority_enabled", "dispatch_authority_enabled"],
  "flowdesk.connector_recipe_ref.v1": ["schema_version", "recipe_ref", "connector_profile_ref", "connector_kind", "target_kind", "operation_label", "playbook_ref", "content_hash_required", "dry_run_required", "raw_locator_allowed", "gateway_execution_authority_enabled", "remote_write_authority_enabled", "dispatch_authority_enabled"],
  "flowdesk.connector_gateway_invocation_plan.v1": ["schema_version", "state", "blocked_labels", "gateway_execution_attempted", "remote_write_attempted", "connector_write_attempted", "remote_write_authority_enabled", "external_write_authority_enabled", "dispatch_authority_enabled", "providerCall", "actualLaneLaunch", "runtimeExecution"],
  "flowdesk.default_managed_dispatch_promotion_readiness.v1": ["schema_version", "workflow_id", "state", "blocked_labels", "evidence_refs", "production_enablement_state", "managed_dispatch_ready", "durable_precall_ready", "adapter_available", "sdk_client_available", "doctor_status_ref", "default_dispatch_candidate", "dispatch_authority_enabled", "providerCall", "actualLaneLaunch", "runtimeExecution", "safe_next_actions"],
  "flowdesk.default_managed_dispatch_authorization.v1": ["schema_version", "authorization_id", "workflow_id", "state", "blocked_labels", "readiness_ref", "actor_ref", "profile_ref", "release_gate_ref", "rollback_ref", "created_at", "expires_at", "default_enablement_requested", "kill_switch_state", "default_managed_dispatch_authority_enabled", "dispatch_authority_enabled", "providerCall", "actualLaneLaunch", "runtimeExecution", "safe_next_actions"],
  "flowdesk.release2_phase6a_closure_evidence.v1": ["schema_version", "closure_ref", "workflow_id", "phase", "result", "closed_at", "expires_at", "closure_labels", "evidence_refs", "dispatch_authority_enabled", "fallback_authority_enabled", "hard_chat_authority_enabled", "external_write_authority_enabled", "providerCall", "actualLaneLaunch", "runtimeExecution"],
  "flowdesk.release2_managed_dispatch_gate_promotion_readiness.v1": ["schema_version", "workflow_id", "state", "blocked_labels", "evidence_refs", "production_enablement_state", "managed_dispatch_ready", "phase6a_closed", "scoped_explicit_approval_present", "fresh_evidence_present", "release2_managed_dispatch_gate_ready", "dispatch_authority_enabled", "fallback_authority_enabled", "hard_chat_authority_enabled", "external_write_authority_enabled", "providerCall", "actualLaneLaunch", "runtimeExecution", "safe_next_actions"],
  "flowdesk.exact_model_availability_cache_refresh_plan.v1": ["schema_version", "state", "blocked_labels", "refresh_reason_labels", "expected_local_date", "expected_active_profile_ref", "expected_opencode_version_ref", "expected_flowdesk_package_version_ref", "expected_registry_hash", "expected_policy_pack_hash", "expected_auth_account_boundary_ref", "discovery_required", "refresh_required", "cache_usable_for_assignment", "discovery_attempted", "refresh_attempted", "dispatch_authority_enabled", "providerCall", "actualLaneLaunch", "runtimeExecution"],
  "flowdesk.exact_model_availability_cache_acquisition_plan.v1": ["schema_version", "state", "blocked_labels", "acquisition_reason_labels", "refresh_plan_ok", "refresh_plan_state", "acquisition_required", "cache_usable_for_assignment", "acquisition_attempted", "discovery_attempted", "refresh_attempted", "dispatch_authority_enabled", "providerCall", "actualLaneLaunch", "runtimeExecution"],
  "flowdesk.exact_model_availability_cache_provider_acquisition_result.v1": ["schema_version", "result_id", "state", "blocked_labels", "acquisition_plan_ok", "acquisition_plan_state", "local_date", "active_profile_ref", "opencode_version_ref", "flowdesk_package_version_ref", "registry_hash", "policy_pack_hash", "auth_account_boundary_ref", "provider_family", "provider_identity_ref", "provider_qualified_model_id", "model_family", "availability_ref", "pre_call_audit_ref", "idempotency_ref", "live_test_run_ref", "redaction_proof_ref", "observed_at", "available", "highest_tier_eligible", "acquisition_attempted", "discovery_attempted", "refresh_attempted", "dispatch_authority_enabled", "providerCall", "actualLaneLaunch", "runtimeExecution"],
  "flowdesk.reviewer_assignment_revalidation.v1": ["schema_version", "state", "blocked_labels", "expected_local_date", "expected_active_profile_ref", "expected_opencode_version_ref", "expected_flowdesk_package_version_ref", "expected_registry_hash", "expected_policy_pack_hash", "expected_auth_account_boundary_ref", "eligible_bindings", "dispatch_authority_enabled", "providerCall", "actualLaneLaunch", "runtimeExecution"],
  "flowdesk.reviewer_fanout_plan.v1": ["schema_version", "workflow_id", "attempt_id", "state", "blocked_labels", "required_perspectives", "planned_perspectives", "runtime_lane_launch_requests", "max_concurrent_lane_count", "runtime_launch_plan_required", "lane_launch_approval_required", "launch_attempted", "approval_inferred", "dispatch_authority_enabled", "providerCall", "actualLaneLaunch", "runtimeExecution"],
  "flowdesk.advisory_output_firewall.v1": ["schema_version", "advisory_ref", "workflow_id", "source_schema_version", "allowed_consumer_refs", "forbidden_consumers", "advisory_only", "guard_authority_enabled", "approval_authority_enabled", "dispatch_authority_enabled", "verification_authority_enabled", "external_write_authority_enabled"],
  "flowdesk.federated_registry_state.v1": ["schema_version", "registry_state_id", "workflow_id", "state", "policy_ref", "remote_upload_enabled", "remote_download_enabled", "planning_influence_enabled", "ranking_influence_enabled", "guard_influence_enabled", "approval_influence_enabled", "dispatch_influence_enabled", "external_write_authority_enabled"],
  "flowdesk.category_fit_snapshot.v1": ["schema_version", "snapshot_id", "workflow_id", "task_signature_ref", "category_signature_ref", "sample_count", "fitness_score", "freshness_timestamp", "evidence_refs", "safe_next_actions", "advisory_only", "dispatch_authority_enabled", "approval_authority_enabled", "provider_authority_enabled", "runtime_authority_enabled", "external_write_authority_enabled", "remote_write_authority_enabled", "fallback_authority_enabled", "lane_launch_authority_enabled", "hard_chat_authority_enabled"],
  "flowdesk.reference_search.request.v1": ["schema_version"],
  "flowdesk.fallback_regate_plan.v1": ["schema_version", "state", "required_fresh_evidence_refs", "safe_next_actions", "automatic_fallback_authorized", "provider_switch_attempted", "dispatch_authority_enabled", "realOpenCodeDispatch", "providerCall", "actualLaneLaunch", "runtimeExecution"]
} satisfies Record<string, readonly string[]>;

const optionalFields: Record<string, readonly string[]> = {
  "flowdesk.tool.request.v1": requestEnvelopeOptional,
  "flowdesk.tool.response.v1": responseEnvelopeOptional,
  "flowdesk.redacted_error.v1": ["code"],
  "flowdesk.chat_intake.request.v1": requestEnvelopeOptional,
  "flowdesk.chat_intake.response.v1": [...responseEnvelopeOptional, "intent_outcome"],
  "flowdesk.hook_harness.request.v1": ["chat_intake_mode", "conformance_ref"],
  "flowdesk.hook_harness.response.v1": ["audit_ref"],
  "flowdesk.doctor.request.v1": ["persist_report"],
  "flowdesk.plan.request.v1": [...requestEnvelopeOptional, "existing_plan_revision_id"],
  "flowdesk.plan.response.v1": responseEnvelopeOptional,
  "flowdesk.run.request.v1": [...requestEnvelopeOptional, "step_id", "managed_dispatch_boundary_input", "managed_dispatch_request", "managed_dispatch_manifest", "managed_dispatch_reloaded_evidence"],
  "flowdesk.status.response.v1": [...responseEnvelopeOptional, "current_step_id", "blocker", "checkpoint_id"],
  "flowdesk.status.request.v1": [...requestEnvelopeOptional, "detail_level"],
  "flowdesk.retry.request.v1": [...requestEnvelopeOptional, "new_binding_hint"],
  "flowdesk.retry.response.v1": responseEnvelopeOptional,
  "flowdesk.abort.request.v1": [...requestEnvelopeOptional, "attempt_id", "lane_id"],
  "flowdesk.abort.response.v1": responseEnvelopeOptional,
  "flowdesk.usage.response.v1": [...responseEnvelopeOptional, "provider_health_snapshot_ref"],
  "flowdesk.usage_snapshot.v1": ["remaining_percent"],
  "flowdesk.provider_health_snapshot.v1": ["model_family", "retry_after_bucket", "runtime_config_ref", "telemetry_ref"],
  "flowdesk.evaluation_event.v1": ["task_ref", "proposal_ref", "candidate_ref"],
  "flowdesk.bootstrap_install_plan.v1": ["confirmation_ref"],
  "flowdesk.command_generation_summary.v1": ["alias_conformance_ref"],
  "flowdesk.bootstrap_report.v1": ["completed_at", "failure_class", "backup_manifest_ref", "profile_mutation_ref", "omo_cleanup_ref", "command_generation_ref", "config_scaffold_ref", "rollback_plan_ref", "rollback_result_ref", "doctor_handoff_ref", "doctor_report_ref"],
  "flowdesk.doctor_handoff.v1": ["config_ref", "compatibility_ref"],
  "flowdesk.workflow_active.v1": ["active_workflow_id", "active_attempt_id", "status_summary_ref"],
  "flowdesk.workflow_record.v1": ["session_ref", "latest_plan_revision_id", "current_step_id", "current_attempt_id", "latest_checkpoint_id", "status_summary_ref", "blocker_summary"],
  "flowdesk.attempt_record.v1": ["step_id", "state_at_end", "guard_decision_ref", "non_dispatch_permission_ref", "command_shape_hash", "usage_snapshot_ref", "provider_health_snapshot_ref", "runtime_capability_ref", "verification_ref", "outcome_audit_ref", "failure_category"],
  "flowdesk.checkpoint_record.v1": ["attempt_id", "current_step_id"],
  "flowdesk.active_attempt_lock.v1": ["heartbeat_at"],
  "flowdesk.lane_record.v1": ["plan_revision_id", "attempt_id", "started_at", "completed_at", "failure_class", "invocation_ref_kind", "retry_count", "verdict_status", "observability_ref", "debug_ref"],
  "flowdesk.audit_event.v1": ["workflow_id", "attempt_id", "step_id", "policy_ref", "decision_ref"],
  "flowdesk.audit_record.v1": ["event_id", "workflow_id", "attempt_id", "step_id", "checkpoint_id", "actor_class", "policy_ref", "decision_ref"],
  "flowdesk.debug_export_manifest.v1": ["workflow_id", "session_ref", "deletion_proof_ref", "partial_deletion_warning"],
  "flowdesk.debug_section_file.v1": ["workflow_id", "session_ref"],
  "flowdesk.audit_ref_summary.v1": ["workflow_id", "attempt_id"],
  "flowdesk.conformance_runtime_metadata.v1": ["opencode_commit"],
  "flowdesk.status_summary.v1": ["current_step_id", "blocker_summary", "usage_summary_ref", "provider_health_summary_ref", "checkpoint_id", "debug_ref"],
  "flowdesk.lane_summary.v1": ["attempt_id", "started_at", "completed_at", "failure_class", "invocation_ref_kind", "retry_count", "verdict_status", "observability_ref", "log_ref", "debug_ref"],
  "flowdesk.verification_summary.v1": ["attempt_id", "failure_category"],
  "flowdesk.policy_pack.v1": ["retention_override", "usage_policy_override", "provider_health_policy_override", "hook_policy_override"],
  "flowdesk.non_dispatch_permission.v1": ["workflow_id", "audit_ref"],
  "flowdesk.top_tier_reviewer_lane_probe.result.v1": ["failure_label"],
  "flowdesk.remote_write_connector_capability.v1": ["installation_plan_ref"],
  "flowdesk.remote_write_connector_execution_readiness.v1": ["workflow_id", "attempt_id", "connector_kind"],
  "flowdesk.fake_remote_connector_write_result.v1": ["workflow_id", "attempt_id", "connector_kind", "connector_ref", "target_ref", "content_hash_ref", "redacted_remote_ref", "ok", "errors"],
  "flowdesk.connector_gateway_invocation_plan.v1": ["workflow_id", "attempt_id", "ok", "errors", "connector_profile_ref", "connector_recipe_ref", "connector_kind", "target_ref", "content_hash_ref", "pre_write_audit_ref", "idempotency_key_ref"],
  "flowdesk.default_managed_dispatch_promotion_readiness.v1": ["ok", "errors", "release_enablement_ref"],
  "flowdesk.default_managed_dispatch_authorization.v1": ["ok", "errors"],
  "flowdesk.release2_phase6a_closure_evidence.v1": [],
  "flowdesk.release2_managed_dispatch_gate_promotion_readiness.v1": ["ok", "errors", "phase6a_closure_ref"],
  "flowdesk.exact_model_availability_cache_refresh_plan.v1": ["ok", "errors", "cache_id", "cache_local_date", "cache_active_profile_ref", "cache_opencode_version_ref", "cache_flowdesk_package_version_ref", "cache_registry_hash", "cache_policy_pack_hash", "cache_auth_account_boundary_ref"],
  "flowdesk.exact_model_availability_cache_acquisition_plan.v1": ["ok", "errors", "refresh_plan_cache_id"],
  "flowdesk.exact_model_availability_cache_provider_acquisition_result.v1": ["ok", "errors", "sanitized_provider_result_ref"],
  "flowdesk.reviewer_assignment_revalidation.v1": ["ok", "errors", "cache_id", "cache_local_date", "cache_active_profile_ref", "cache_opencode_version_ref", "cache_flowdesk_package_version_ref", "cache_registry_hash", "cache_policy_pack_hash", "cache_auth_account_boundary_ref"],
  "flowdesk.reviewer_fanout_plan.v1": ["ok", "errors", "cache_id"],
  "flowdesk.fallback_regate_plan.v1": ["ok", "errors", "workflow_id", "parent_attempt_id", "new_attempt_id", "decision_ref", "from_provider_qualified_model_id", "to_provider_qualified_model_id", "required_guard_decision_ref", "required_approval_ref", "required_pre_dispatch_audit_ref", "policy_eligibility_ref", "runtime_compatibility_ref", "consumed_fallback_approval_ref"]
} satisfies Record<string, readonly string[]>;

function propertyType(fieldName: string): Release1JsonSchemaPropertyType {
  if (fieldName === "status" || fieldName === "freshness" || fieldName === "verdict_status") return "string";
  if (fieldName.startsWith("is_") || fieldName.startsWith("allow_") || fieldName.startsWith("requires_") || fieldName.endsWith("_eligible") || fieldName.endsWith("_enabled") || fieldName.endsWith("_authorized") || fieldName.endsWith("_bypassed") || fieldName.endsWith("_applied") || fieldName.endsWith("_attempted") || fieldName.endsWith("_required") || fieldName.endsWith("_allowed") || fieldName.endsWith("_confirmed") || fieldName.endsWith("_inferred") || fieldName.endsWith("_ok") || fieldName.endsWith("_only") || fieldName === "non_authorizing" || fieldName === "ok" || fieldName === "refresh" || fieldName === "available" || fieldName === "persist_report" || fieldName === "providerCall" || fieldName === "actualLaneLaunch" || fieldName === "runtimeExecution" || fieldName === "cache_usable_for_assignment" || fieldName === "unrelated_profile_mutation" || fieldName === "omitted_legacy_runtime_imports") return "boolean";
  if (fieldName.endsWith("_count") || fieldName === "priority" || fieldName === "freshness_ttl" || fieldName === "byte_count" || fieldName === "file_count" || fieldName === "remaining_percent") return "number";
  if (fieldName.endsWith("s") || fieldName.endsWith("_refs") || fieldName.endsWith("_hashes") || fieldName === "safe_next_actions" || fieldName === "lane_refs" || fieldName === "uncertainty_flags" || fieldName === "include_sections" || fieldName === "diagnostic_observations") return "array";
  if (["error", "provider_health_summary", "guard_precheck", "blocker", "blocker_summary", "retention", "usage_policy", "provider_health_policy", "hook_policy", "taxonomy", "model_requirements", "retention_override", "usage_policy_override", "provider_health_policy_override", "hook_policy_override", "promotion_readiness", "managed_dispatch_boundary_input", "managed_dispatch_request", "managed_dispatch_manifest", "managed_dispatch_reloaded_evidence"].includes(fieldName)) return "object";
  return "string";
}

function propertyArtifact(fieldName: string): Release1JsonSchemaPropertyArtifact {
  const type = propertyType(fieldName);
  return {
    type,
    ...(fieldName === "input_mode" ? { enum: INPUT_MODES } : {}),
    ...(fieldName === "run_mode" ? { enum: FLOWDESK_RUN_REQUEST_MODES } : {}),
    ...(fieldName === "hook_harness_mode" ? { enum: HOOK_HARNESS_MODES } : {}),
    ...(fieldName === "attempt_kind" ? { enum: HOOK_HARNESS_ATTEMPT_KINDS } : {}),
    ...(fieldName === "requested_capability" ? { enum: HOOK_HARNESS_CAPABILITIES } : {}),
    ...(fieldName === "decision" ? { enum: HOOK_HARNESS_DECISIONS } : {}),
    ...(fieldName === "invocation_ref_kind" ? { enum: LANE_INVOCATION_REF_KINDS } : {}),
    ...(fieldName === "verdict_status" ? { enum: LANE_VERDICT_STATUSES } : {}),
    ...(fieldName === "check_scope" ? { enum: DOCTOR_CHECK_SCOPES } : {}),
    ...(fieldName === "profile" ? { enum: DOCTOR_PROFILES } : {}),
    ...(fieldName === "detail_level" ? { enum: STATUS_DETAIL_LEVELS } : {}),
    ...(fieldName === "resume_mode" ? { enum: RESUME_MODES } : {}),
    ...(fieldName === "retention_hint" ? { enum: RETENTION_HINTS } : {}),
    ...(type === "string" && (fieldName.endsWith("_id") || fieldName.endsWith("_ref") || fieldName.endsWith("_hash") || fieldName === "confirmation_nonce") ? { maxLength: 128 } : {}),
    ...(type === "string" && (fieldName.includes("summary") || fieldName === "user_message" || fieldName === "safe_remediation" || fieldName === "reason") ? { maxLength: 500 } : {}),
    ...(fieldName === "safe_next_actions" ? { maxItems: 8, enum: SAFE_NEXT_ACTIONS } : {}),
    ...(fieldName === "diagnostic_observations" ? { maxItems: 8 } : {}),
    ...(fieldName === "lane_refs" ? { maxItems: 20 } : {}),
    ...(fieldName === "include_sections" ? { maxItems: 7 } : {}),
    description: propertyDescription(fieldName)
  };
}

function propertyDescription(fieldName: string): string {
  switch (fieldName) {
    case "schema_version": return "FlowDesk Release 1 field schema_version";
    case "request_id": return "FlowDesk Release 1 field request_id";
    case "input_mode": return "FlowDesk Release 1 field input_mode";
    case "check_scope": return "Doctor check scope: install, runtime, policy, usage, provider_health, conformance, or all";
    case "profile": return "Doctor profile: production, development, or test";
    case "persist_report": return "FlowDesk Release 1 field persist_report";
    case "detail_level": return "Status detail level: summary, diagnostic, debug_refs, or lane_refs";
    case "resume_mode": return "Resume mode: resume, retry, abort_only, or status_only";
    case "retention_hint": return "Debug export retention: delete_after_export, keep_until_default_expiry, or keep_until_policy_expiry";
    case "run_mode": return "Run mode: guarded-dry-run, fake-runtime, or managed-dispatch";
    case "include_sections": return "Debug export sections to include (e.g. redaction_summary, doctor, status, usage)";
    case "provider_family": return "Provider family identifier (e.g. claude, openai, gemini, unknown)";
    case "refresh": return "Whether to force-refresh provider usage data";
    case "goal_summary": return "FlowDesk Release 1 field goal_summary";
    case "scope_summary": return "FlowDesk Release 1 field scope_summary";
    case "risk_hint": return "FlowDesk Release 1 field risk_hint";
    case "plan_revision_id": return "FlowDesk Release 1 field plan_revision_id";
    case "checkpoint_id": return "FlowDesk Release 1 field checkpoint_id";
    case "attempt_id": return "FlowDesk Release 1 field attempt_id";
    case "retry_reason": return "FlowDesk Release 1 field retry_reason";
    case "reason": return "FlowDesk Release 1 field reason";
    default: return `FlowDesk Release 1 field ${fieldName}`;
  }
}

function schemaArtifact(schemaId: string): Release1JsonSchemaArtifact {
  const required = requiredFields[schemaId] ?? ["schema_version"];
  const fieldNames = [...new Set([...required, ...(optionalFields[schemaId] ?? [])])];
  const properties = Object.fromEntries(fieldNames.map((fieldName) => [fieldName, propertyArtifact(fieldName)]));
  if (properties.schema_version !== undefined) properties.schema_version = { ...properties.schema_version, description: `Must be exactly "${schemaId}"` };
  if (schemaId.endsWith(".response.v1") && properties.status !== undefined) properties.status = { ...properties.status, type: "string", enum: TOOL_STATUSES };
  if (schemaId === "flowdesk.doctor_section_result.v1" && properties.category !== undefined) properties.category = { ...properties.category, type: "string", enum: DOCTOR_FAILURE_CATEGORIES };
  if ((schemaId === "flowdesk.lane_record.v1" || schemaId === "flowdesk.lane_summary.v1") && properties.failure_class !== undefined) properties.failure_class = { ...properties.failure_class, type: "string", enum: LANE_FAILURE_CLASSES };
  return {
    $schema: "https://json-schema.org/draft/2020-12/schema",
    $id: schemaId,
    type: "object",
    required,
    additionalProperties: false,
    properties
  };
}

export const RELEASE_1_SCHEMA_ARTIFACTS: Readonly<Record<string, Release1JsonSchemaArtifact>> = Object.fromEntries(
  RELEASE_1_SCHEMA_REGISTRY.map((entry) => [entry.schemaId, schemaArtifact(entry.schemaId)])
);

export function getRelease1SchemaArtifact(schemaId: string): Release1JsonSchemaArtifact | undefined {
  return RELEASE_1_SCHEMA_ARTIFACTS[schemaId];
}
