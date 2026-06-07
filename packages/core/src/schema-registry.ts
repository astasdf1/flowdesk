export type Release1ToolRegistrationStatus = "registered_minimum" | "optional_diagnostic_unregistered" | "later_release_unregistered" | "schema_artifact_only";
export type Release1SchemaRegistryKind = "envelope" | "tool_request" | "tool_response" | "supporting" | "persisted_state" | "config_policy" | "bootstrap" | "guard" | "workflow" | "runtime" | "audit" | "later_release";
export type Release1PrivilegeClass = "safe_read_only" | "privileged_non_dispatch" | "privileged_release1_dry_run_or_fake_runtime" | "internal_diagnostic" | "not_applicable";
export type Release1SchemaCompatibilityStatus = "compatible_runtime_closed_validation" | "blocked_missing_schema_conversion_evidence" | "inert_schema_artifact" | "not_applicable";

export interface Release1ToolContractMetadata {
  privilegeClass: Release1PrivilegeClass;
  statePreconditions: readonly string[];
  stateOutputs: readonly string[];
  redactedErrorShapeId: "flowdesk.redacted_error.v1";
  schemaCompatibilityStatus: Release1SchemaCompatibilityStatus;
  schemaCompatibilityReadiness: "compatible_with_runtime_closed_validation" | "blocked_until_fds1_conversion_spike_passes" | "not_required_for_non_tool_artifact";
}

export interface Release1SchemaMetadata {
  schemaId: string;
  fixturePrefix: string;
  interfaceName: string;
  kind: Release1SchemaRegistryKind;
  productionRegistrationEligible: boolean;
  release1MinimumTool: boolean;
  registrationStatus: Release1ToolRegistrationStatus;
  toolName?: string;
  toolContract?: Release1ToolContractMetadata;
}

const minimum = "registered_minimum" satisfies Release1ToolRegistrationStatus;
const optional = "optional_diagnostic_unregistered" satisfies Release1ToolRegistrationStatus;
const later = "later_release_unregistered" satisfies Release1ToolRegistrationStatus;
const artifactOnly = "schema_artifact_only" satisfies Release1ToolRegistrationStatus;

const runtimeClosedToolCompatibility = {
  redactedErrorShapeId: "flowdesk.redacted_error.v1",
  schemaCompatibilityStatus: "compatible_runtime_closed_validation",
  schemaCompatibilityReadiness: "compatible_with_runtime_closed_validation"
} as const;

const toolContracts = {
  flowdesk_chat_intake: { privilegeClass: "internal_diagnostic", statePreconditions: ["redacted intake only", "chat steering conformance when used"], stateOutputs: ["redacted intake ref", "route decision"] },
  flowdesk_doctor: { privilegeClass: "safe_read_only", statePreconditions: ["schema-valid request", "redacted refs only"], stateOutputs: ["doctor section results", "provider health summary", "compatibility ref"] },
  flowdesk_plan: { privilegeClass: "privileged_non_dispatch", statePreconditions: ["state write permission when persisted", "audit write permission", "no dispatch"], stateOutputs: ["plan revision id", "guard precheck", "required approvals"] },
  flowdesk_run: { privilegeClass: "privileged_release1_dry_run_or_fake_runtime", statePreconditions: ["Guard approval for dry-run or fake-runtime", "pre-run audit", "Release 1 run mode only"], stateOutputs: ["run result ref", "verification summary ref", "artifact disposition"] },
  flowdesk_status: { privilegeClass: "safe_read_only", statePreconditions: ["workflow state readable", "redacted refs only"], stateOutputs: ["workflow state", "lane summaries", "blocker", "checkpoint id"] },
  flowdesk_resume: { privilegeClass: "privileged_non_dispatch", statePreconditions: ["durable checkpoint", "fresh checks", "no event-only checkpoint"], stateOutputs: ["resume decision", "required fresh checks", "next checkpoint id"] },
  flowdesk_retry: { privilegeClass: "privileged_non_dispatch", statePreconditions: ["existing attempt", "new attempt id", "Guard-compatible binding"], stateOutputs: ["new attempt id", "required guard checks", "retry state"] },
  flowdesk_abort: { privilegeClass: "privileged_non_dispatch", statePreconditions: ["workflow id", "audit write when state changes", "best-effort cancellation only"], stateOutputs: ["requested/observed/failed cancellation state", "remaining safe actions"] },
  flowdesk_usage: { privilegeClass: "safe_read_only", statePreconditions: ["provider family", "usage write permission when refresh persists"], stateOutputs: ["usage snapshot ref", "provider health snapshot ref", "freshness", "dispatchability"] },
  flowdesk_explain_route: { privilegeClass: "safe_read_only", statePreconditions: ["existing workflow", "redacted route ref"], stateOutputs: ["route summary", "guard rationale ref"] },
  flowdesk_audit: { privilegeClass: "safe_read_only", statePreconditions: ["existing workflow", "redacted audit query"], stateOutputs: ["audit refs", "summary labels", "redaction version"] },
  flowdesk_export_debug: { privilegeClass: "privileged_non_dispatch", statePreconditions: ["debug export write permission", "redaction passes", "retention policy"], stateOutputs: ["export manifest ref", "included redacted sections", "delete after"] }
} as const;

type ToolName = keyof typeof toolContracts;

function toolContract(toolName: ToolName): Release1ToolContractMetadata {
  return { ...runtimeClosedToolCompatibility, ...toolContracts[toolName] };
}

function toolEntry(
  toolName: ToolName,
  schemaId: string,
  fixturePrefix: string,
  interfaceName: string,
  kind: "tool_request" | "tool_response",
  status: Release1ToolRegistrationStatus,
  release1MinimumTool: boolean
): Release1SchemaMetadata {
  return {
    schemaId,
    fixturePrefix,
    interfaceName,
    kind,
    productionRegistrationEligible: release1MinimumTool,
    release1MinimumTool,
    registrationStatus: status,
    toolName,
    toolContract: toolContract(toolName)
  };
}

function artifactEntry(schemaId: string, fixturePrefix: string, interfaceName: string, kind: Release1SchemaRegistryKind): Release1SchemaMetadata {
  return {
    schemaId,
    fixturePrefix,
    interfaceName,
    kind,
    productionRegistrationEligible: false,
    release1MinimumTool: false,
    registrationStatus: artifactOnly
  };
}

export const RELEASE_1_PRODUCTION_MINIMUM_TOOL_NAMES = [
  "flowdesk_doctor",
  "flowdesk_plan",
  "flowdesk_run",
  "flowdesk_status",
  "flowdesk_resume",
  "flowdesk_retry",
  "flowdesk_abort",
  "flowdesk_usage",
  "flowdesk_export_debug"
] as const;

export const RELEASE_1_OPTIONAL_DIAGNOSTIC_TOOL_NAMES = ["flowdesk_chat_intake", "flowdesk_explain_route", "flowdesk_audit"] as const;
export const RELEASE_1_LATER_RELEASE_TOOL_NAMES = ["flowdesk_reference_search"] as const;

export const RELEASE_1_SCHEMA_REGISTRY: Release1SchemaMetadata[] = [
  artifactEntry("flowdesk.tool.request.v1", "tool-request-envelope", "FlowDeskToolRequestEnvelopeV1", "envelope"),
  artifactEntry("flowdesk.tool.response.v1", "tool-response-envelope", "FlowDeskToolResponseEnvelopeV1", "envelope"),
  artifactEntry("flowdesk.redacted_error.v1", "redacted-error", "FlowDeskRedactedErrorV1", "envelope"),

  toolEntry("flowdesk_chat_intake", "flowdesk.chat_intake.request.v1", "chat-intake", "FlowDeskChatIntakeRequestV1", "tool_request", optional, false),
  toolEntry("flowdesk_chat_intake", "flowdesk.chat_intake.response.v1", "chat-intake", "FlowDeskChatIntakeResponseV1", "tool_response", optional, false),
  artifactEntry("flowdesk.hook_harness.request.v1", "hook-harness-request", "FlowDeskHookHarnessRequestV1", "supporting"),
  artifactEntry("flowdesk.hook_harness.response.v1", "hook-harness-response", "FlowDeskHookHarnessResponseV1", "supporting"),
  toolEntry("flowdesk_doctor", "flowdesk.doctor.request.v1", "doctor", "FlowDeskDoctorRequestV1", "tool_request", minimum, true),
  toolEntry("flowdesk_doctor", "flowdesk.doctor.response.v1", "doctor", "FlowDeskDoctorResponseV1", "tool_response", minimum, true),
  toolEntry("flowdesk_plan", "flowdesk.plan.request.v1", "plan", "FlowDeskPlanRequestV1", "tool_request", minimum, true),
  toolEntry("flowdesk_plan", "flowdesk.plan.response.v1", "plan", "FlowDeskPlanResponseV1", "tool_response", minimum, true),
  toolEntry("flowdesk_run", "flowdesk.run.request.v1", "run", "FlowDeskRunRequestV1", "tool_request", minimum, true),
  toolEntry("flowdesk_run", "flowdesk.run.response.v1", "run", "FlowDeskRunResponseV1", "tool_response", minimum, true),
  toolEntry("flowdesk_status", "flowdesk.status.request.v1", "status", "FlowDeskStatusRequestV1", "tool_request", minimum, true),
  toolEntry("flowdesk_status", "flowdesk.status.response.v1", "status", "FlowDeskStatusResponseV1", "tool_response", minimum, true),
  toolEntry("flowdesk_resume", "flowdesk.resume.request.v1", "resume", "FlowDeskResumeRequestV1", "tool_request", minimum, true),
  toolEntry("flowdesk_resume", "flowdesk.resume.response.v1", "resume", "FlowDeskResumeResponseV1", "tool_response", minimum, true),
  toolEntry("flowdesk_retry", "flowdesk.retry.request.v1", "retry", "FlowDeskRetryRequestV1", "tool_request", minimum, true),
  toolEntry("flowdesk_retry", "flowdesk.retry.response.v1", "retry", "FlowDeskRetryResponseV1", "tool_response", minimum, true),
  toolEntry("flowdesk_abort", "flowdesk.abort.request.v1", "abort", "FlowDeskAbortRequestV1", "tool_request", minimum, true),
  toolEntry("flowdesk_abort", "flowdesk.abort.response.v1", "abort", "FlowDeskAbortResponseV1", "tool_response", minimum, true),
  toolEntry("flowdesk_usage", "flowdesk.usage.request.v1", "usage", "FlowDeskUsageRequestV1", "tool_request", minimum, true),
  toolEntry("flowdesk_usage", "flowdesk.usage.response.v1", "usage", "FlowDeskUsageResponseV1", "tool_response", minimum, true),
  toolEntry("flowdesk_explain_route", "flowdesk.explain_route.request.v1", "explain-route", "FlowDeskExplainRouteRequestV1", "tool_request", optional, false),
  toolEntry("flowdesk_explain_route", "flowdesk.explain_route.response.v1", "explain-route", "FlowDeskExplainRouteResponseV1", "tool_response", optional, false),
  toolEntry("flowdesk_audit", "flowdesk.audit.request.v1", "audit", "FlowDeskAuditRequestV1", "tool_request", optional, false),
  toolEntry("flowdesk_audit", "flowdesk.audit.response.v1", "audit", "FlowDeskAuditResponseV1", "tool_response", optional, false),
  toolEntry("flowdesk_export_debug", "flowdesk.export_debug.request.v1", "export-debug", "FlowDeskExportDebugRequestV1", "tool_request", minimum, true),
  toolEntry("flowdesk_export_debug", "flowdesk.export_debug.response.v1", "export-debug", "FlowDeskExportDebugResponseV1", "tool_response", minimum, true),

  artifactEntry("flowdesk.doctor_section_result.v1", "doctor-section-result", "DoctorSectionResultV1", "supporting"),
  artifactEntry("flowdesk.doctor_report.v1", "doctor-report", "FlowDeskDoctorReportV1", "supporting"),
  artifactEntry("flowdesk.status_summary.v1", "status-summary", "FlowDeskStatusSummaryArtifactV1", "supporting"),
  artifactEntry("flowdesk.plan_summary.v1", "plan-summary", "FlowDeskPlanSummaryArtifactV1", "supporting"),
  artifactEntry("flowdesk.lane_summary.v1", "lane-summary", "FlowDeskLaneSummaryArtifactV1", "supporting"),
  artifactEntry("flowdesk.verification_summary.v1", "verification-summary", "FlowDeskVerificationSummaryArtifactV1", "supporting"),
  artifactEntry("flowdesk.usage_snapshot.v1", "usage-snapshot", "FlowDeskUsageSnapshotV1", "supporting"),
  artifactEntry("flowdesk.provider_health_snapshot.v1", "provider-health-snapshot", "FlowDeskProviderHealthSnapshotV1", "supporting"),
  artifactEntry("flowdesk.evaluation_event.v1", "evaluation-event", "FlowDeskEvaluationEventV1", "later_release"),
  artifactEntry("flowdesk.debug_section_summary.v1", "debug-section-summary", "DebugSectionSummaryV1", "supporting"),
  artifactEntry("flowdesk.audit_ref_summary.v1", "audit-ref-summary", "FlowDeskAuditRefSummaryV1", "audit"),
  artifactEntry("flowdesk.audit_event.v1", "audit-event", "FlowDeskAuditEventV1", "audit"),
  artifactEntry("flowdesk.conformance_runtime_metadata.v1", "conformance-runtime-metadata", "FlowDeskConformanceRuntimeMetadataV1", "runtime"),
  artifactEntry("flowdesk.conformance_evidence_record.v1", "conformance-evidence-record", "FlowDeskConformanceEvidenceRecordV1", "runtime"),
  artifactEntry("flowdesk.workflow_active.v1", "workflow-active", "FlowDeskWorkflowActiveV1", "persisted_state"),
  artifactEntry("flowdesk.workflow_record.v1", "workflow-record", "FlowDeskWorkflowRecordV1", "persisted_state"),
  artifactEntry("flowdesk.attempt_record.v1", "attempt-record", "FlowDeskAttemptRecordV1", "persisted_state"),
  artifactEntry("flowdesk.checkpoint_record.v1", "checkpoint-record", "FlowDeskCheckpointRecordV1", "persisted_state"),
  artifactEntry("flowdesk.active_attempt_lock.v1", "active-attempt-lock", "FlowDeskActiveAttemptLockV1", "persisted_state"),
  artifactEntry("flowdesk.lane_record.v1", "lane-record", "FlowDeskLaneRecordV1", "persisted_state"),
  artifactEntry("flowdesk.audit_record.v1", "audit-record", "FlowDeskAuditRecordV1", "persisted_state"),
  artifactEntry("flowdesk.debug_export_manifest.v1", "debug-export-manifest", "FlowDeskDebugExportManifestV1", "persisted_state"),
  artifactEntry("flowdesk.debug_section_file.v1", "debug-section-file", "FlowDeskDebugSectionFileV1", "persisted_state"),
  artifactEntry("flowdesk.project_config.v1", "project-config", "FlowDeskProjectConfigV1", "config_policy"),
  artifactEntry("flowdesk.policy_pack.v1", "policy-pack", "FlowDeskPolicyPackV1", "config_policy"),
  artifactEntry("flowdesk.effective_policy.v1", "effective-policy", "FlowDeskEffectivePolicyV1", "config_policy"),
  artifactEntry("flowdesk.non_dispatch_permission.v1", "non-dispatch-permission", "FlowDeskNonDispatchPermissionV1", "config_policy"),
  artifactEntry("flowdesk.bootstrap_install_plan.v1", "bootstrap-install-plan", "FlowDeskBootstrapInstallPlanV1", "bootstrap"),
  artifactEntry("flowdesk.bootstrap_backup_manifest.v1", "bootstrap-backup-manifest", "FlowDeskBootstrapBackupManifestV1", "bootstrap"),
  artifactEntry("flowdesk.profile_mutation_summary.v1", "profile-mutation-summary", "FlowDeskProfileMutationSummaryV1", "bootstrap"),
  artifactEntry("flowdesk.omo_cleanup_summary.v1", "omo-cleanup-summary", "FlowDeskOmoCleanupSummaryV1", "bootstrap"),
  artifactEntry("flowdesk.command_generation_summary.v1", "command-generation-summary", "FlowDeskCommandGenerationSummaryV1", "bootstrap"),
  artifactEntry("flowdesk.config_scaffold_summary.v1", "config-scaffold-summary", "FlowDeskConfigScaffoldSummaryV1", "bootstrap"),
  artifactEntry("flowdesk.bootstrap_rollback_plan.v1", "bootstrap-rollback-plan", "FlowDeskBootstrapRollbackPlanV1", "bootstrap"),
  artifactEntry("flowdesk.bootstrap_rollback_result.v1", "bootstrap-rollback-result", "FlowDeskBootstrapRollbackResultV1", "bootstrap"),
  artifactEntry("flowdesk.bootstrap_report.v1", "bootstrap-report", "FlowDeskBootstrapReportV1", "bootstrap"),
  artifactEntry("flowdesk.doctor_handoff.v1", "doctor-handoff", "FlowDeskDoctorHandoffV1", "bootstrap"),
  artifactEntry("flowdesk.guard_request.v1", "guard-request", "GuardRequestV1", "guard"),
  artifactEntry("flowdesk.guard_response.v1", "guard-response", "GuardResponseV1", "guard"),
  artifactEntry("flowdesk.guard_approved_dispatch.v1", "guard-approved-dispatch", "GuardApprovedDispatchV1", "guard"),
  artifactEntry("flowdesk.runtime_capability_metadata.v1", "runtime-capability-metadata", "FlowDeskRuntimeCapabilityMetadataV1", "runtime"),
  artifactEntry("flowdesk.workflow_plan.v1", "workflow-plan", "FlowDeskWorkflowPlanV1", "workflow"),
  artifactEntry("flowdesk.workflow_authoring_result.v1", "workflow-authoring-result", "FlowDeskWorkflowAuthoringResultV1", "workflow"),
  artifactEntry("flowdesk.task_graph.v1", "task-graph", "FlowDeskTaskGraphV1", "workflow"),
  artifactEntry("flowdesk.task_agent_assignment.v1", "task-agent-assignment", "FlowDeskTaskAgentAssignmentV1", "workflow"),
  artifactEntry("flowdesk.task_model_selection.v1", "task-model-selection", "FlowDeskTaskModelSelectionV1", "workflow"),
  artifactEntry("flowdesk.workflow_dispatch_plan.v1", "workflow-dispatch-plan", "FlowDeskWorkflowDispatchPlanV1", "workflow"),
  artifactEntry("flowdesk.top_tier_reviewer_binding.v1", "top-tier-reviewer-binding", "FlowDeskTopTierReviewerBindingV1", "later_release"),
  artifactEntry("flowdesk.top_tier_reviewer_lane_plan.v1", "top-tier-reviewer-lane-plan", "FlowDeskTopTierReviewerLanePlanV1", "later_release"),
  artifactEntry("flowdesk.top_tier_review_binding_inventory.v1", "top-tier-review-binding-inventory", "FlowDeskTopTierReviewBindingInventoryV1", "later_release"),
  artifactEntry("flowdesk.top_tier_review_verdict.v1", "top-tier-review-verdict", "FlowDeskTopTierReviewVerdictV1", "later_release"),
  artifactEntry("flowdesk.top_tier_reviewer_lane_probe.request.v1", "top-tier-reviewer-lane-probe-request", "FlowDeskTopTierReviewerLaneProbeRequestV1", "later_release"),
  artifactEntry("flowdesk.top_tier_reviewer_lane_probe.result.v1", "top-tier-reviewer-lane-probe-result", "FlowDeskTopTierReviewerLaneProbeResultV1", "later_release"),
  artifactEntry("flowdesk.remote_write_connector_capability.v1", "remote-write-connector-capability", "FlowDeskRemoteWriteConnectorCapabilityV1", "later_release"),
  artifactEntry("flowdesk.remote_write_connector_install_plan.v1", "remote-write-connector-install-plan", "FlowDeskRemoteWriteConnectorInstallPlanV1", "later_release"),
  artifactEntry("flowdesk.remote_write_plan.v1", "remote-write-plan", "FlowDeskRemoteWritePlanV1", "later_release"),
  artifactEntry("flowdesk.remote_write_connector_execution_readiness.v1", "remote-write-connector-execution-readiness", "FlowDeskRemoteWriteConnectorExecutionReadinessV1", "later_release"),
  artifactEntry("flowdesk.fake_remote_connector_write_result.v1", "fake-remote-connector-write-result", "FlowDeskFakeRemoteConnectorWriteResultV1", "later_release"),
  artifactEntry("flowdesk.connector_profile.v1", "connector-profile", "FlowDeskConnectorProfileV1", "later_release"),
  artifactEntry("flowdesk.connector_recipe_ref.v1", "connector-recipe-ref", "FlowDeskConnectorRecipeRefV1", "later_release"),
  artifactEntry("flowdesk.connector_gateway_invocation_plan.v1", "connector-gateway-invocation-plan", "FlowDeskConnectorGatewayInvocationPlanV1", "later_release"),
  artifactEntry("flowdesk.default_managed_dispatch_promotion_readiness.v1", "default-managed-dispatch-promotion-readiness", "FlowDeskDefaultManagedDispatchPromotionReadinessV1", "later_release"),
  artifactEntry("flowdesk.default_managed_dispatch_authorization.v1", "default-managed-dispatch-authorization", "FlowDeskDefaultManagedDispatchAuthorizationV1", "later_release"),
  artifactEntry("flowdesk.release2_phase6a_closure_evidence.v1", "release2-phase6a-closure-evidence", "FlowDeskRelease2Phase6AClosureEvidenceV1", "later_release"),
  artifactEntry("flowdesk.release2_managed_dispatch_gate_promotion_readiness.v1", "release2-managed-dispatch-gate-promotion-readiness", "FlowDeskRelease2ManagedDispatchGatePromotionReadinessV1", "later_release"),
  artifactEntry("flowdesk.runtime_lane_launch_request.v1", "runtime-lane-launch-request", "FlowDeskRuntimeLaneLaunchRequestV1", "later_release"),
  artifactEntry("flowdesk.runtime_lane_launch_plan.v1", "runtime-lane-launch-plan", "FlowDeskRuntimeLaneLaunchPlanV1", "later_release"),
  artifactEntry("flowdesk.runtime_lane_lifecycle_projection.v1", "runtime-lane-lifecycle-projection", "FlowDeskRuntimeLaneLifecycleProjectionV1", "later_release"),
  artifactEntry("flowdesk.exact_model_availability_cache_refresh_plan.v1", "exact-model-availability-cache-refresh-plan", "FlowDeskExactModelAvailabilityCacheRefreshPlanV1", "later_release"),
  artifactEntry("flowdesk.exact_model_availability_cache_acquisition_plan.v1", "exact-model-availability-cache-acquisition-plan", "FlowDeskExactModelAvailabilityCacheAcquisitionPlanV1", "later_release"),
  artifactEntry("flowdesk.exact_model_availability_cache_provider_acquisition_result.v1", "exact-model-availability-cache-provider-acquisition-result", "FlowDeskExactModelAvailabilityCacheProviderAcquisitionResultV1", "later_release"),
  artifactEntry("flowdesk.reviewer_assignment_revalidation.v1", "reviewer-assignment-revalidation", "FlowDeskReviewerAssignmentRevalidationV1", "later_release"),
  artifactEntry("flowdesk.reviewer_fanout_plan.v1", "reviewer-fanout-plan", "FlowDeskReviewerFanoutPlanV1", "later_release"),
  artifactEntry("flowdesk.fallback_regate_plan.v1", "fallback-regate-plan", "FlowDeskFallbackRegatePlanV1", "later_release"),
  artifactEntry("flowdesk.advisory_output_firewall.v1", "advisory-output-firewall", "FlowDeskAdvisoryOutputFirewallV1", "later_release"),
  artifactEntry("flowdesk.federated_registry_state.v1", "federated-registry-state", "FlowDeskFederatedRegistryStateV1", "later_release"),
  artifactEntry("flowdesk.federated_gate_evaluation.v1", "federated-gate-evaluation", "FlowDeskFederatedGateEvaluationResultV1", "later_release"),
  artifactEntry("flowdesk.category_fit_snapshot.v1", "category-fit-snapshot", "FlowDeskCategoryFitSnapshotV1", "later_release"),
  artifactEntry("flowdesk.workflow_plan_proposal.v1", "workflow-plan-proposal", "FlowDeskWorkflowPlanProposalV1", "later_release"),
  artifactEntry("flowdesk.workflow_plan_proposal_set.v1", "workflow-plan-proposal-set", "FlowDeskWorkflowPlanProposalSetV1", "later_release"),
  artifactEntry("flowdesk.optimizer_proposal_score.v1", "optimizer-proposal-score", "FlowDeskOptimizerProposalScoreV1", "later_release"),
  artifactEntry("flowdesk.normalized_score_aggregation.v1", "normalized-score-aggregation", "FlowDeskNormalizedScoreAggregationV1", "later_release"),
  artifactEntry("flowdesk.score_reuse_threshold_gate.v1", "score-reuse-threshold-gate", "FlowDeskScoreReuseThresholdGateV1", "later_release"),
  artifactEntry("flowdesk.fanout_cadence_gate.v1", "fanout-cadence-gate", "FlowDeskFanoutCadenceGateV1", "later_release"),
  artifactEntry("flowdesk.local_ledger_snapshot.v1", "local-ledger-snapshot", "FlowDeskLocalLedgerSnapshotV1", "later_release"),
  artifactEntry("flowdesk.score_reference_pack.v1", "score-reference-pack", "FlowDeskScoreReferencePackV1", "later_release"),
  artifactEntry("flowdesk.workflow_signature_index_entry.v1", "workflow-signature-index-entry", "FlowDeskWorkflowSignatureIndexEntryV1", "later_release"),
  artifactEntry("flowdesk.oi_session_summary.v1", "oi-session-summary", "FlowDeskOISessionSummaryV1", "later_release"),
  artifactEntry("flowdesk.specialist_workflow_eligibility.v1", "specialist-workflow-eligibility", "FlowDeskSpecialistWorkflowEligibilityV1", "later_release"),
  artifactEntry("flowdesk.mcp_connector_advisory.v1", "mcp-connector-advisory", "FlowDeskMCPConnectorAdvisoryV1", "later_release"),
  artifactEntry("flowdesk.federated_registry_connector_capability.v1", "federated-registry-connector-capability", "FlowDeskFederatedRegistryConnectorCapabilityV1", "later_release"),
  artifactEntry("flowdesk.federated_registry_publication_preflight.v1", "federated-registry-publication-preflight", "FlowDeskFederatedRegistryPublicationPreflightV1", "later_release"),
  artifactEntry("flowdesk.github_dry_run_publication_result.v1", "github-dry-run-publication-result", "FlowDeskGitHubDryRunPublicationResultV1", "later_release"),
  artifactEntry("flowdesk.federated_consent_record.v1", "federated-consent-record", "FlowDeskFederatedConsentRecordV1", "later_release"),
  artifactEntry("flowdesk.github_oauth_architecture.v1", "github-oauth-architecture", "FlowDeskGitHubOAuthArchitectureV1", "later_release"),
  artifactEntry("flowdesk.federated_ledger_idempotency.v1", "federated-ledger-idempotency", "FlowDeskFederatedLedgerIdempotencyRecordV1", "later_release"),
  artifactEntry("flowdesk.federated_discovery_config.v1", "federated-discovery-config", "FlowDeskFederatedDiscoveryConfigV1", "later_release"),
  artifactEntry("flowdesk.federated_discovery_query_plan.v1", "federated-discovery-query-plan", "FlowDeskFederatedDiscoveryQueryPlanV1", "later_release"),
  artifactEntry("flowdesk.federated_publication_result.v1", "federated-publication-result", "FlowDeskFederatedPublicationResultV1", "later_release"),
  artifactEntry("flowdesk.federated_revocation_request.v1", "federated-revocation-request", "FlowDeskFederatedRevocationRequestV1", "later_release"),
  artifactEntry("flowdesk.surplus_usage_gate.v1", "surplus-usage-gate", "FlowDeskSurplusUsageGateV1", "later_release"),
  artifactEntry("flowdesk.r3_admission_decision.v1", "r3-admission-decision", "FlowDeskR3AdmissionDecisionV1", "later_release"),
  artifactEntry("flowdesk.r3_fanout_reservation.v1", "r3-fanout-reservation", "FlowDeskR3FanoutReservationV1", "later_release"),
  artifactEntry("flowdesk.advisory_variant_result.v1", "advisory-variant-result", "FlowDeskAdvisoryVariantResultV1", "later_release"),
  artifactEntry("flowdesk.task_block_scoring.v1", "task-block-scoring", "FlowDeskTaskBlockScoringV1", "later_release"),
  artifactEntry("flowdesk.design_spec_quality.v1", "design-spec-quality", "FlowDeskDesignSpecQualityV1", "later_release"),
  artifactEntry("flowdesk.model_capability_profile.v1", "model-capability-profile", "FlowDeskModelCapabilityProfileV1", "later_release"),
  artifactEntry("flowdesk.block_selection_criteria.v1", "block-selection-criteria", "FlowDeskBlockSelectionCriteriaV1", "later_release"),
  artifactEntry("flowdesk.model_selection_result.v1", "model-selection-result", "FlowDeskModelSelectionResultV1", "later_release"),
  artifactEntry("flowdesk.block_decomposition.v1", "block-decomposition", "FlowDeskBlockDecompositionV1", "later_release"),
  artifactEntry("flowdesk.block_hierarchy.v1", "block-hierarchy", "FlowDeskBlockHierarchyV1", "later_release"),
  artifactEntry("flowdesk.block_score_reconciliation.v1", "block-score-reconciliation", "FlowDeskBlockScoreReconciliationV1", "later_release"),
  artifactEntry("flowdesk.block_decomposition_failure.v1", "block-decomposition-failure", "FlowDeskBlockDecompositionFailureV1", "later_release"),
  artifactEntry("flowdesk.proposal_generator_config.v1", "proposal-generator-config", "FlowDeskProposalGeneratorConfigV1", "later_release"),
  artifactEntry("flowdesk.r3_reservation_lifecycle_event.v1", "r3-reservation-lifecycle-event", "FlowDeskR3ReservationLifecycleEventV1", "later_release"),
  artifactEntry("flowdesk.multi_variant_aggregation.v1", "multi-variant-aggregation", "FlowDeskMultiVariantAggregationV1", "later_release"),
  artifactEntry("flowdesk.multi_variant_test_result.v1", "multi-variant-test-result", "ExecuteMultiVariantTestV1Result", "later_release"),
  artifactEntry("flowdesk.multi_model_aggregation.v1", "multi-model-aggregation", "FlowDeskMultiModelAggregationV1", "later_release"),
  artifactEntry("flowdesk.multi_model_fanout_result_envelope.v1", "multi-model-fanout-result-envelope", "FlowDeskMultiModelFanoutResultEnvelopeV1", "later_release"),
  {
    schemaId: "flowdesk.reference_search.request.v1",
    fixturePrefix: "reference-search",
    interfaceName: "FlowDeskReferenceSearchRequestV1",
    kind: "later_release",
    productionRegistrationEligible: false,
    release1MinimumTool: false,
    registrationStatus: later,
    toolName: "flowdesk_reference_search"
  }
];

export function getRelease1MinimumToolRegistry(): Release1SchemaMetadata[] {
  return RELEASE_1_SCHEMA_REGISTRY.filter((entry) => entry.release1MinimumTool && entry.kind.startsWith("tool_"));
}

export function getRelease1ProductionToolRegistry(): Release1SchemaMetadata[] {
  return RELEASE_1_SCHEMA_REGISTRY.filter((entry) => entry.productionRegistrationEligible && entry.kind.startsWith("tool_"));
}

export function getRelease1RegisteredToolNames(): string[] {
  return [...new Set(getRelease1MinimumToolRegistry().map((entry) => entry.toolName).filter((toolName): toolName is string => typeof toolName === "string"))];
}

export function getRelease1SchemaMetadata(schemaId: string): Release1SchemaMetadata | undefined {
  return RELEASE_1_SCHEMA_REGISTRY.find((entry) => entry.schemaId === schemaId);
}
