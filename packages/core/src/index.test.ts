import assert from "node:assert/strict";
import test from "node:test";
import {
  canUseRealDispatchInRelease1,
  describeFlowDeskCoreScaffold,
  FLOWDESK_CANONICAL_REVIEW_AGENT_ID,
  flowdeskCorePackageName,
  flowdeskNoRealDispatchBoundary,
  flowdeskRelease1Scope,
  getProviderFailureDiagnosticMappingsV1,
  getRelease1ProductionToolRegistry,
  getRelease1RegisteredToolNames,
  mapProviderFailureClassToDiagnosticOutcomeV1,
  PROVIDER_FAILURE_CLASSES,
  RELEASE_1_OPTIONAL_DIAGNOSTIC_TOOL_NAMES,
  RELEASE_1_PRODUCTION_MINIMUM_TOOL_NAMES,
  RELEASE_1_SCHEMA_ARTIFACTS,
  RELEASE_1_SCHEMA_REGISTRY,
  validateAbortResponseV1,
  validateActiveAttemptLockV1,
  validateAgentProfileV1,
  validateAttemptRecordV1,
  validateAuditRecordV1,
  validateAuditRefSummaryV1,
  validateCheckpointRecordV1,
  validateConformanceEvidenceRecordV1,
  validateConformanceRuntimeMetadataV1,
  validateDebugExportManifestV1,
  validateExportDebugRequestV1,
  validateExportDebugResponseV1,
  validateGuardApprovedDispatchV1,
  validateGuardRequestV1,
  validateLaneRecordV1,
  validateNoForbiddenRawPayloads,
  validateOpaqueId,
  validateProviderHealthSnapshotV1,
  validateProviderQualifiedModelId,
  validateRetryRequestV1,
  validateRetryResponseV1,
  validateRunRequestV1,
  validateRunResponseV1,
  validateSchemaArtifactValue,
  validateSessionRecordCannotReplaceWorkflowState,
  validateUsageRequestV1,
  validateUsageResponseV1,
  validateUsageSnapshotV1,
  validateWorkflowActiveV1,
  validateWorkflowRecordV1
} from "./index.js";

test("core scaffold exports FlowDesk identity and Release 1 boundary", () => {
  assert.equal(flowdeskCorePackageName, "@flowdesk/core");
  assert.match(describeFlowDeskCoreScaffold(), /release1-general-use-mvp/);
  assert.ok(flowdeskRelease1Scope.includes("fake-runtime"));
  assert.equal(flowdeskNoRealDispatchBoundary.realOpenCodeDispatch, "disabled");
  assert.equal(canUseRealDispatchInRelease1(), false);
});

const expectedToolSchemaIds = [
  "flowdesk.chat_intake.request.v1",
  "flowdesk.chat_intake.response.v1",
  "flowdesk.hook_harness.request.v1",
  "flowdesk.hook_harness.response.v1",
  "flowdesk.doctor.request.v1",
  "flowdesk.doctor.response.v1",
  "flowdesk.plan.request.v1",
  "flowdesk.plan.response.v1",
  "flowdesk.run.request.v1",
  "flowdesk.run.response.v1",
  "flowdesk.status.request.v1",
  "flowdesk.status.response.v1",
  "flowdesk.resume.request.v1",
  "flowdesk.resume.response.v1",
  "flowdesk.retry.request.v1",
  "flowdesk.retry.response.v1",
  "flowdesk.abort.request.v1",
  "flowdesk.abort.response.v1",
  "flowdesk.usage.request.v1",
  "flowdesk.usage.response.v1",
  "flowdesk.explain_route.request.v1",
  "flowdesk.explain_route.response.v1",
  "flowdesk.audit.request.v1",
  "flowdesk.audit.response.v1",
  "flowdesk.export_debug.request.v1",
  "flowdesk.export_debug.response.v1"
];

const expectedFixturePrefixes = [
  "chat-intake",
  "hook-harness-request",
  "hook-harness-response",
  "doctor",
  "plan",
  "run",
  "status",
  "resume",
  "retry",
  "abort",
  "usage",
  "explain-route",
  "audit",
  "export-debug",
  "usage-snapshot",
  "provider-health-snapshot",
  "doctor-section-result",
  "debug-section-summary",
  "workflow-active",
  "workflow-record",
  "attempt-record",
  "checkpoint-record",
  "active-attempt-lock",
  "lane-record",
  "audit-record",
  "debug-export-manifest",
  "project-config",
  "policy-pack",
  "effective-policy",
  "non-dispatch-permission",
  "bootstrap-install-plan",
  "bootstrap-backup-manifest",
  "profile-mutation-summary",
  "omo-cleanup-summary",
  "command-generation-summary",
  "config-scaffold-summary",
  "bootstrap-rollback-plan",
  "bootstrap-rollback-result",
  "bootstrap-report",
  "doctor-handoff"
];

const normativeSchemaIds = [
  "flowdesk.tool.request.v1",
  "flowdesk.tool.response.v1",
  "flowdesk.redacted_error.v1",
  ...expectedToolSchemaIds,
  "flowdesk.workflow_active.v1",
  "flowdesk.workflow_record.v1",
  "flowdesk.attempt_record.v1",
  "flowdesk.checkpoint_record.v1",
  "flowdesk.active_attempt_lock.v1",
  "flowdesk.lane_record.v1",
  "flowdesk.audit_record.v1",
  "flowdesk.debug_export_manifest.v1",
  "flowdesk.project_config.v1",
  "flowdesk.policy_pack.v1",
  "flowdesk.effective_policy.v1",
  "flowdesk.non_dispatch_permission.v1",
  "flowdesk.bootstrap_install_plan.v1",
  "flowdesk.bootstrap_backup_manifest.v1",
  "flowdesk.profile_mutation_summary.v1",
  "flowdesk.omo_cleanup_summary.v1",
  "flowdesk.command_generation_summary.v1",
  "flowdesk.config_scaffold_summary.v1",
  "flowdesk.bootstrap_rollback_plan.v1",
  "flowdesk.bootstrap_rollback_result.v1",
  "flowdesk.bootstrap_report.v1",
  "flowdesk.doctor_handoff.v1",
  "flowdesk.audit_event.v1",
  "flowdesk.doctor_report.v1",
  "flowdesk.status_summary.v1",
  "flowdesk.plan_summary.v1",
  "flowdesk.lane_summary.v1",
  "flowdesk.verification_summary.v1",
  "flowdesk.usage_snapshot.v1",
  "flowdesk.provider_health_snapshot.v1",
  "flowdesk.doctor_section_result.v1",
  "flowdesk.debug_section_summary.v1",
  "flowdesk.audit_ref_summary.v1",
  "flowdesk.conformance_runtime_metadata.v1",
  "flowdesk.conformance_evidence_record.v1"
];

test("Release 1 schema registry covers implemented appendix contracts and production minimum tools", () => {
  const schemaIds = new Set(RELEASE_1_SCHEMA_REGISTRY.map((entry) => entry.schemaId));
  for (const schemaId of normativeSchemaIds) assert.ok(schemaIds.has(schemaId), schemaId);

  const fixturePrefixes = new Set(RELEASE_1_SCHEMA_REGISTRY.map((entry) => entry.fixturePrefix));
  for (const prefix of expectedFixturePrefixes) assert.ok(fixturePrefixes.has(prefix), prefix);

  assert.deepEqual(getRelease1RegisteredToolNames().sort(), [...RELEASE_1_PRODUCTION_MINIMUM_TOOL_NAMES].sort());
});

test("all registry entries have deterministic closed schema artifacts", () => {
  for (const entry of RELEASE_1_SCHEMA_REGISTRY) {
    const artifact = RELEASE_1_SCHEMA_ARTIFACTS[entry.schemaId];
    assert.ok(artifact, entry.schemaId);
    assert.equal(artifact.$id, entry.schemaId);
    assert.equal(artifact.type, "object");
    assert.equal(artifact.additionalProperties, false);
    assert.ok(Array.isArray(artifact.required));
    assert.ok(Object.keys(artifact.properties).length >= artifact.required.length);
  }
});

test("Release 1 minimum tools are eligible for non-dispatch production registration", () => {
  assert.deepEqual(getRelease1RegisteredToolNames().sort(), [...RELEASE_1_PRODUCTION_MINIMUM_TOOL_NAMES].sort());
  assert.deepEqual([...new Set(getRelease1ProductionToolRegistry().map((entry) => entry.toolName))].sort(), [...RELEASE_1_PRODUCTION_MINIMUM_TOOL_NAMES].sort());
  const minimumToolEntries = RELEASE_1_SCHEMA_REGISTRY.filter((entry) => entry.release1MinimumTool && entry.kind.startsWith("tool_"));
  assert.ok(minimumToolEntries.length > 0);
  assert.ok(minimumToolEntries.every((entry) => entry.productionRegistrationEligible === true));
  assert.ok(minimumToolEntries.every((entry) => entry.toolContract?.schemaCompatibilityStatus === "compatible_runtime_closed_validation"));
  assert.ok(minimumToolEntries.every((entry) => entry.toolContract?.schemaCompatibilityReadiness === "compatible_with_runtime_closed_validation"));
});

test("provider failure classes have diagnostic-only mappings without runtime authority", () => {
  const mappings = getProviderFailureDiagnosticMappingsV1();
  assert.deepEqual(mappings.map((mapping) => mapping.failure_class), [...PROVIDER_FAILURE_CLASSES]);
  for (const failureClass of PROVIDER_FAILURE_CLASSES) {
    const mapping = mapProviderFailureClassToDiagnosticOutcomeV1(failureClass);
    assert.equal(mapping.dispatch_authorized, false);
    assert.equal(mapping.fallback_authorized, false);
    assert.equal(mapping.provider_call_authorized, false);
    assert.equal(mapping.hard_chat_authority, false);
    assert.equal(mapping.safe_next_actions.includes("/flowdesk-run"), false);
    if (failureClass !== "none") {
      assert.notEqual(mapping.dispatchability, "dispatchable");
      assert.notEqual(mapping.retry_state, "planned");
    }
  }
});

test("retry validators reject raw payload and unsupported authority markers", () => {
  const request = {
    schema_version: "flowdesk.retry.request.v1",
    request_id: "retry-request-123",
    input_mode: "test_fixture",
    workflow_id: "workflow-123",
    attempt_id: "attempt-123",
    retry_reason: "verification failed after fake-runtime diagnostics",
    new_binding_hint: "same-binding"
  };
  assert.equal(validateRetryRequestV1(request).ok, true);
  assert.equal(validateRetryRequestV1({ ...request, provider_payload: "raw provider response" }).ok, false);
  assert.equal(validateRetryRequestV1({ ...request, retry_reason: "fallback to another model" }).ok, false);
  assert.equal(validateRetryRequestV1({ ...request, new_binding_hint: "reselect provider" }).ok, false);

  const response = {
    schema_version: "flowdesk.retry.response.v1",
    ok: true,
    status: "diagnostic_only",
    workflow_id: "workflow-123",
    safe_next_actions: ["/flowdesk-status", "/flowdesk-export-debug"],
    user_message: "FlowDesk prepared a diagnostic retry plan without runtime execution.",
    new_attempt_id: "attempt-retry-123",
    required_guard_checks: [{ check: "provider_health", result: "unknown", ref: "health-123" }],
    retry_state: "planned"
  };
  assert.equal(validateRetryResponseV1(response).ok, true);
  assert.equal(validateRetryResponseV1({ ...response, safe_next_actions: ["/flowdesk-run"] }).ok, false);
  assert.equal(validateRetryResponseV1({ ...response, safe_next_actions: ["/flowdesk-plan"] }).ok, false);
  assert.equal(validateRetryResponseV1({ ...response, safe_next_actions: ["/flowdesk-abort"] }).ok, false);
  assert.equal(validateRetryResponseV1({ ...response, safe_next_actions: ["continue_chat"] }).ok, false);
  assert.equal(validateRetryResponseV1({ ...response, providerCall: true }).ok, false);
});

test("production registration metadata excludes optional diagnostics and later-release reference search", () => {
  const productionToolNames = new Set(getRelease1RegisteredToolNames());
  for (const toolName of RELEASE_1_OPTIONAL_DIAGNOSTIC_TOOL_NAMES) assert.equal(productionToolNames.has(toolName), false);
  assert.equal(productionToolNames.has("flowdesk_reference_search"), false);

  const optionalDiagnosticEntries = RELEASE_1_SCHEMA_REGISTRY.filter((entry) => RELEASE_1_OPTIONAL_DIAGNOSTIC_TOOL_NAMES.includes(entry.toolName as never));
  assert.ok(optionalDiagnosticEntries.length > 0);
  assert.ok(optionalDiagnosticEntries.every((entry) => !entry.productionRegistrationEligible && entry.registrationStatus === "optional_diagnostic_unregistered"));
});

test("opaque ids, refs, model ids, and provider family validators fail closed", () => {
  assert.equal(validateOpaqueId("workflow/../../raw-path", "workflow_id").ok, false);
  assert.equal(validateOpaqueId("workflow 123", "workflow_id").ok, false);
  assert.equal(validateProviderQualifiedModelId("sonnet-4").ok, false);
  assert.equal(validateProviderQualifiedModelId("unknown/model").ok, false);
  assert.equal(validateProviderQualifiedModelId("claude/sonnet-4").ok, true);

  const usageRequestWithoutProvider = {
    schema_version: "flowdesk.usage.request.v1",
    request_id: "req-123",
    input_mode: "test_fixture",
    refresh: false
  };
  assert.equal(validateUsageRequestV1(usageRequestWithoutProvider).ok, false);
});

test("representative validators require usage and provider health evidence", () => {
  const usageSnapshotWithoutSource = {
    schema_version: "flowdesk.usage_snapshot.v1",
    snapshot_id: "usage-123",
    provider_family: "claude",
    model_family: "claude-sonnet",
    freshness: "fresh",
    freshness_ttl: 10,
    reset_time: "unknown",
    reset_bucket: "unknown",
    dispatchability: "dispatchable",
    uncertainty_flags: []
  };
  assert.equal(validateUsageSnapshotV1(usageSnapshotWithoutSource).ok, false);

  const providerHealthWithoutFamily = {
    schema_version: "flowdesk.provider_health_snapshot.v1",
    snapshot_id: "health-123",
    observed_at: "2026-05-17T00:00:00.000Z",
    freshness: "fresh",
    freshness_ttl: 10,
    source_surface: "doctor_probe",
    availability_state: "healthy",
    failure_class: "none",
    dispatchability: "dispatchable",
    source_ref: "source-123",
    safe_remediation: "No action needed."
  };
  assert.equal(validateProviderHealthSnapshotV1(providerHealthWithoutFamily).ok, false);

  const realDispatchGuardRequestWithoutSnapshots = {
    schema_version: "flowdesk.guard_request.v1",
    guard_request_id: "guard-req-123",
    workflow_id: "workflow-123",
    requested_operation: "real-opencode-dispatch",
    taxonomy: {}
  };
  assert.equal(validateGuardRequestV1(realDispatchGuardRequestWithoutSnapshots).ok, false);

  const invalidAttempt = {
    schema_version: "flowdesk.attempt_record.v1",
    attempt_id: "attempt-123",
    workflow_id: "workflow-123",
    created_at: "2026-05-17T00:00:00.000Z",
    updated_at: "2026-05-17T00:00:00.000Z",
    run_mode: "real-opencode-dispatch",
    state_at_start: "ready_to_run",
    attempt_state: "created",
    pre_run_audit_ref: "audit-123",
    runtime_echo_validation: "not_applicable",
    artifact_disposition: "none",
    safe_next_actions: ["/flowdesk-status"]
  };
  assert.equal(validateAttemptRecordV1(invalidAttempt).ok, false);
});

test("unknown properties fail in representative request and response validators", () => {
  const validRunRequest = {
    schema_version: "flowdesk.run.request.v1",
    request_id: "req-123",
    input_mode: "test_fixture",
    run_mode: "fake-runtime",
    plan_revision_id: "plan-123"
  };
  assert.equal(validateRunRequestV1(validRunRequest).ok, true);
  assert.equal(validateRunRequestV1({ ...validRunRequest, unexpected: true }).ok, false);

  const validRunResponse = {
    schema_version: "flowdesk.run.response.v1",
    ok: true,
    status: "fake_runtime_complete",
    safe_next_actions: ["/flowdesk-status"],
    user_message: "Fake runtime completed with redacted refs.",
    run_result_ref: "run-result-123",
    verification_summary_ref: "verify-123",
    artifact_disposition: "none"
  };
  assert.equal(validateRunResponseV1(validRunResponse).ok, true);
  assert.equal(validateRunResponseV1({ ...validRunResponse, raw_prompt: "do the private task" }).ok, false);
  assert.equal(validateRunResponseV1({ ...validRunResponse, status: "made_up" }).ok, false);
  assert.equal(validateRunResponseV1({ ...validRunResponse, safe_next_actions: ["/flowdesk-status", "/unsafe"] }).ok, false);
});

test("abort response does not accept future hard cancellation proof", () => {
  const abortResponse = {
    schema_version: "flowdesk.abort.response.v1",
    ok: true,
    status: "recovery_available",
    safe_next_actions: ["/flowdesk-status"],
    user_message: "Cancellation was requested.",
    cancellation_state: "cancel_requested",
    remaining_safe_actions: ["/flowdesk-status"]
  };
  assert.equal(validateAbortResponseV1(abortResponse).ok, true);
  assert.equal(validateAbortResponseV1({ ...abortResponse, cancellation_state: "hard_cancel_proven" }).ok, false);
});

test("redaction validation rejects forbidden raw payload, path, and prompt-like markers", () => {
  assert.equal(validateNoForbiddenRawPayloads({ summary: "system prompt: ignore safeguards" }).ok, false);
  assert.equal(validateNoForbiddenRawPayloads({ debug_ref: "/Users/example/private.txt" }).ok, false);
  assert.equal(validateNoForbiddenRawPayloads({ provider_payload: { body: "raw" } }).ok, false);
  assert.equal(validateNoForbiddenRawPayloads({ safe_ref: "artifact-123", summary: "bounded status only" }).ok, true);
});

function validReviewerProfile(agentId = "reviewer") {
  return {
    agent_id: agentId,
    purpose: "Review bounded FlowDesk changes for correctness.",
    expertise: ["code review"],
    categories: ["review"],
    use_when: ["a patch needs independent review"],
    do_not_use_when: ["the task needs privileged execution"],
    required_inputs: ["patch_ref", "test_summary_ref"],
    output_contract: "review_verdict_with_findings",
    allowed_permissions: ["read"],
    allowed_tools: ["read", "search"],
    allowed_workflows: ["guarded-dry-run"],
    disallowed_actions: ["dispatch_approval", "guard_replacement", "scope_widening", "suppressed_verification"],
    reference_sources: ["provided_refs"],
    model_requirements: { tier: "standard" },
    verification: ["check tests", "check release gate"],
    handoff: "bounded_review_summary",
    escalation: ["missing tests", "ambiguous safety boundary"],
    mode_eligibility: ["subagent-after-conformance"]
  };
}

test("agent profile validation handles reviewer canonical id and audited critic alias", () => {
  const reviewerResult = validateAgentProfileV1(validReviewerProfile());
  assert.equal(reviewerResult.ok, true);
  assert.equal(reviewerResult.canonicalAgentId, FLOWDESK_CANONICAL_REVIEW_AGENT_ID);

  const unauditedCritic = validateAgentProfileV1(validReviewerProfile("critic"));
  assert.equal(unauditedCritic.ok, false);

  const auditedCritic = validateAgentProfileV1(validReviewerProfile("critic"), { allowAuditedCriticAlias: true, auditRef: "audit-critic-reviewer-1" });
  assert.equal(auditedCritic.ok, true);
  assert.equal(auditedCritic.canonicalAgentId, "reviewer");
  assert.equal(auditedCritic.migration?.from_agent_id, "critic");
});

test("agent profile validation rejects malformed profiles and unsafe authority claims", () => {
  assert.equal(validateAgentProfileV1({ agent_id: "reviewer" }).ok, false);
  assert.equal(validateAgentProfileV1({ ...validReviewerProfile(), output_contract: "" }).ok, false);
  assert.equal(validateAgentProfileV1({ ...validReviewerProfile(), required_inputs: ["read this file first"] }).ok, false);
  assert.equal(validateAgentProfileV1({ ...validReviewerProfile(), reference_sources: ["OMC local runtime"] }).ok, false);
  assert.equal(validateAgentProfileV1({ ...validReviewerProfile(), disallowed_actions: ["approve dispatch"] }).ok, false);
  assert.equal(validateAgentProfileV1({ ...validReviewerProfile(), allowed_tools: ["replace guard"] }).ok, false);
  assert.equal(validateAgentProfileV1({ ...validReviewerProfile(), allowed_permissions: ["guard", "dispatch"] }).ok, false);
  assert.equal(validateAgentProfileV1({ ...validReviewerProfile(), allowed_workflows: ["real-opencode-dispatch"] }).ok, false);
  assert.equal(validateAgentProfileV1({ ...validReviewerProfile(), allowed_permissions: ["guardAuthority"] }).ok, false);
  assert.equal(validateAgentProfileV1({ ...validReviewerProfile(), allowed_workflows: ["dispatchAuthority", "noReplyAuthority"] }).ok, false);
});

test("Guard dispatch boundary rejects unqualified models and missing authority evidence", () => {
  const dispatch = {
    schema_version: "flowdesk.guard_approved_dispatch.v1",
    guard_decision_id: "guard-123",
    workflow_id: "workflow-123",
    step_id: "step-123",
    attempt_id: "attempt-123",
    provider_family: "claude",
    provider_qualified_model_id: "sonnet-4",
    usage_snapshot_ref: "usage-123",
    provider_health_snapshot_ref: "health-123",
    runtime_capability_ref: "runtime-123",
    pre_dispatch_audit_ref: "audit-123",
    expires_at: "2026-05-17T00:10:00.000Z"
  };
  assert.equal(validateGuardApprovedDispatchV1(dispatch).ok, false);
  assert.equal(validateGuardApprovedDispatchV1({ ...dispatch, provider_qualified_model_id: "claude/sonnet-4" }).ok, true);
  assert.equal(validateGuardApprovedDispatchV1({ ...dispatch, provider_family: "unknown", provider_qualified_model_id: "claude/sonnet-4" }).ok, false);
  assert.equal(validateGuardApprovedDispatchV1({ ...dispatch, provider_qualified_model_id: "claude/sonnet-4", dispatch_authorized: true }).ok, false);
  assert.equal(validateGuardApprovedDispatchV1({ ...dispatch, provider_qualified_model_id: "claude/sonnet-4", guard_bypassed: true }).ok, false);
  assert.equal(validateGuardApprovedDispatchV1({ ...dispatch, provider_qualified_model_id: "claude/sonnet-4", fallback_authorized: true }).ok, false);
  assert.equal(validateGuardApprovedDispatchV1({ ...dispatch, provider_qualified_model_id: "claude/sonnet-4", hard_chat_authority: true }).ok, false);
  assert.equal(validateGuardApprovedDispatchV1({ ...dispatch, provider_qualified_model_id: "claude/sonnet-4", hard_cancel_proven: true }).ok, false);
});

test("session records cannot replace authoritative workflow or checkpoint state", () => {
  assert.equal(validateSessionRecordCannotReplaceWorkflowState({ schema_version: "flowdesk.audit_record.v1", audit_ref: "audit-123", event_type: "status", created_at: "2026-05-17T00:00:00.000Z", summary_label: "status", evidence_refs: [], artifact_refs: [], redaction_version: "redaction-v1" }).ok, true);
  assert.equal(validateSessionRecordCannotReplaceWorkflowState({ schema_version: "flowdesk.audit_record.v1", active_workflow_id: "workflow-123", state: "running" }).ok, false);
});

test("schema artifact validator rejects unknown properties for generic contracts", () => {
  assert.equal(validateSchemaArtifactValue("flowdesk.project_config.v1", { schema_version: "flowdesk.project_config.v1" }).ok, false);
  assert.equal(validateSchemaArtifactValue("flowdesk.project_config.v1", { schema_version: "flowdesk.project_config.v1", unexpected: true }).ok, false);
});

test("usage and provider health snapshots validate enums and fail-closed consistency", () => {
  const usageSnapshot = {
    schema_version: "flowdesk.usage_snapshot.v1",
    snapshot_id: "usage-123",
    provider_family: "claude",
    model_family: "claude-sonnet",
    freshness: "fresh",
    freshness_ttl: 10,
    reset_time: "unknown",
    reset_bucket: "unknown",
    dispatchability: "dispatchable",
    uncertainty_flags: [],
    source_ref: "source-123"
  };
  assert.equal(validateUsageSnapshotV1(usageSnapshot).ok, true);
  assert.equal(validateUsageSnapshotV1({ ...usageSnapshot, freshness: "bad" }).ok, false);
  assert.equal(validateUsageSnapshotV1({ ...usageSnapshot, uncertainty_flags: ["stale"], dispatchability: "dispatchable" }).ok, false);
  assert.equal(validateUsageResponseV1({ schema_version: "flowdesk.usage.response.v1", ok: true, status: "diagnostic_only", safe_next_actions: ["/flowdesk-status"], user_message: "Usage is unknown.", usage_snapshot_ref: "usage-123", freshness: "unknown", dispatchability: "dispatchable", uncertainty_flags: ["unknown"] }).ok, false);
  assert.equal(validateUsageResponseV1({ schema_version: "flowdesk.usage.response.v1", ok: true, status: "diagnostic_only", safe_next_actions: ["/flowdesk-status"], user_message: "Usage is unknown.", usage_snapshot_ref: "usage-123", freshness: "unknown", dispatchability: "non_dispatchable", uncertainty_flags: ["unknown"] }).ok, true);

  const healthSnapshot = {
    schema_version: "flowdesk.provider_health_snapshot.v1",
    snapshot_id: "health-123",
    provider_family: "claude",
    observed_at: "2026-05-17T00:00:00.000Z",
    freshness: "fresh",
    freshness_ttl: 10,
    source_surface: "doctor_probe",
    availability_state: "healthy",
    failure_class: "none",
    dispatchability: "dispatchable",
    source_ref: "source-123",
    safe_remediation: "No action needed."
  };
  assert.equal(validateProviderHealthSnapshotV1(healthSnapshot).ok, true);
  assert.equal(validateProviderHealthSnapshotV1({ ...healthSnapshot, failure_class: "raw_provider_error" }).ok, false);
  assert.equal(validateProviderHealthSnapshotV1({ ...healthSnapshot, failure_class: "telemetry_ambiguous", dispatchability: "dispatchable" }).ok, false);
  assert.equal(validateProviderHealthSnapshotV1({ ...healthSnapshot, availability_state: "degraded", dispatchability: "dispatchable" }).ok, false);
  assert.equal(validateProviderHealthSnapshotV1({ ...healthSnapshot, model_family: 123 }).ok, false);
  assert.equal(validateProviderHealthSnapshotV1({ ...healthSnapshot, safe_remediation: "Use fallback or reselection." }).ok, false);
});

test("persisted workflow, state, audit, debug validators fail closed", () => {
  const active = { schema_version: "flowdesk.workflow_active.v1", active_workflow_id: "workflow-123", state: "running", updated_at: "2026-05-17T00:00:00.000Z", audit_refs: ["audit-123"] };
  assert.equal(validateWorkflowActiveV1(active, { workflowId: "workflow-123" }).ok, true);
  assert.equal(validateWorkflowActiveV1({ ...active, active_workflow_id: "workflow-other" }, { workflowId: "workflow-123" }).ok, false);

  const workflow = { schema_version: "flowdesk.workflow_record.v1", workflow_id: "workflow-123", created_at: "2026-05-17T00:00:00.000Z", updated_at: "2026-05-17T00:00:00.000Z", state: "running", project_root_ref: "project-root-123", config_hash: "config-hash-123", policy_pack_id: "policy-123", policy_pack_hash: "policy-hash-123", attempt_refs: [], checkpoint_refs: [], lane_refs: [], latest_lane_summary_refs: [], audit_refs: ["audit-123"], artifact_disposition: "none", safe_next_actions: ["/flowdesk-status"] };
  assert.equal(validateWorkflowRecordV1(workflow).ok, true);
  assert.equal(validateWorkflowRecordV1({ ...workflow, raw_prompt: "system prompt: leak" }).ok, false);

  const checkpoint = { schema_version: "flowdesk.checkpoint_record.v1", checkpoint_id: "checkpoint-123", workflow_id: "workflow-123", created_at: "2026-05-17T00:00:00.000Z", expires_at: "2026-05-18T00:00:00.000Z", resume_mode: "resume", required_fresh_checks: [], audit_refs: ["audit-123"], artifact_refs: [], reason: "planned_pause", safe_next_actions: ["/flowdesk-resume"] };
  assert.equal(validateCheckpointRecordV1(checkpoint).ok, true);
  assert.equal(validateCheckpointRecordV1({ ...checkpoint, audit_refs: [] }).ok, false);

  const lock = { schema_version: "flowdesk.active_attempt_lock.v1", workflow_id: "workflow-123", attempt_id: "attempt-123", owner_ref: "owner-123", acquired_at: "2026-05-17T00:00:00.000Z", expires_at: "2026-05-18T00:00:00.000Z", recovery_state: "active", audit_ref: "audit-123" };
  assert.equal(validateActiveAttemptLockV1(lock, Date.parse("2026-05-17T01:00:00.000Z")).ok, true);
  assert.equal(validateActiveAttemptLockV1({ ...lock, expires_at: "2026-05-16T00:00:00.000Z" }, Date.parse("2026-05-17T01:00:00.000Z")).ok, false);

  const lane = { schema_version: "flowdesk.lane_record.v1", lane_id: "lane-123", workflow_id: "workflow-123", task_ref: "task-123", lane_class: "verification", state: "completed", created_at: "2026-05-17T00:00:00.000Z", updated_at: "2026-05-17T00:10:00.000Z", safe_next_action: "/flowdesk-status", refs: [], event_refs: [], audit_refs: ["audit-123"] };
  assert.equal(validateLaneRecordV1(lane).ok, true);
  assert.equal(validateLaneRecordV1({ ...lane, state: "failed", failure_class: "invocation_failed", invocation_ref_kind: "background_invocation", retry_count: 1, verdict_status: "missing" }).ok, true);
  assert.equal(validateLaneRecordV1({ ...lane, state: "hard_cancel_proven" }).ok, false);
  assert.equal(validateLaneRecordV1({ ...lane, invocation_ref_kind: "bg_c8698557" }).ok, false);
  assert.equal(validateLaneRecordV1({ ...lane, retry_count: 3 }).ok, false);
  assert.equal(validateLaneRecordV1({ ...lane, verdict_status: "approved" }).ok, false);

  const audit = { schema_version: "flowdesk.audit_record.v1", audit_ref: "audit-123", event_type: "status", created_at: "2026-05-17T00:00:00.000Z", summary_label: "status", evidence_refs: [], artifact_refs: [], redaction_version: "redaction-v1" };
  assert.equal(validateAuditRecordV1(audit).ok, true);
  assert.equal(validateAuditRecordV1({ ...audit, summary_label: "/Users/example/raw/path" }).ok, false);

  const manifest = { schema_version: "flowdesk.debug_export_manifest.v1", export_id: "export-123", manifest_ref: "manifest-123", created_at: "2026-05-17T00:00:00.000Z", delete_after: "2026-05-18T00:00:00.000Z", included_sections: [], redaction_version: "redaction-v1", source_refs: [], file_count: 0, byte_count: 0, warnings: [], deletion_state: "pending", audit_refs: ["audit-123"] };
  assert.equal(validateDebugExportManifestV1(manifest).ok, true);
  assert.equal(validateDebugExportManifestV1({ ...manifest, provider_payload: "raw" }).ok, false);
});

test("audit and conformance artifact validators cover redacted refs and bounded summaries", () => {
  const auditRefSummary = {
    schema_version: "flowdesk.audit_ref_summary.v1",
    audit_ref: "audit-123",
    workflow_id: "workflow-123",
    event_type: "status",
    summary_label: "status summary",
    created_at: "2026-05-17T00:00:00.000Z",
    redaction_version: "redaction-v1"
  };
  assert.equal(validateAuditRefSummaryV1(auditRefSummary).ok, true);
  assert.equal(validateAuditRefSummaryV1({ ...auditRefSummary, unexpected: true }).ok, false);
  assert.equal(validateAuditRefSummaryV1({ ...auditRefSummary, summary_label: "system prompt: leak" }).ok, false);
  assert.equal(validateAuditRefSummaryV1({ ...auditRefSummary, audit_ref: "/Users/example/audit.jsonl" }).ok, false);

  const runtimeMetadata = {
    schema_version: "flowdesk.conformance_runtime_metadata.v1",
    opencode_version: "1.14.40",
    checked_at: "2026-05-17T00:00:00.000Z",
    plugin_package: "@flowdesk/opencode-plugin",
    plugin_version_or_commit: "plugin-commit-123",
    chat_intake_mode: "steering",
    command_alias_mode: "portable_only",
    dispatch_mode: "command-steering",
    runtime_echo_mode: "request_surface_only",
    event_telemetry_mode: "partial",
    provider_health_mode: "diagnostic_only",
    fallback_reselection_mode: "disabled",
    diagnostics_surface_mode: "doctor_usage_status_debug",
    lane_observability_mode: "command_summary",
    hook_harness_mode: "enforce",
    tui_mode: "unsupported",
    mode_fields: ["chat.message", "command.execute.before"],
    evidence_refs: ["evidence-123"],
    disabled_modes: ["real_dispatch", "managed_fallback", "lane_launch", "hard_chat_blocking"]
  };
  assert.equal(validateConformanceRuntimeMetadataV1(runtimeMetadata).ok, true);
  assert.equal(validateConformanceRuntimeMetadataV1({ ...runtimeMetadata, opencode_commit: "opencode-commit-123" }).ok, true);
  assert.equal(validateConformanceRuntimeMetadataV1({ ...runtimeMetadata, unexpected: true }).ok, false);
  assert.equal(validateConformanceRuntimeMetadataV1({ ...runtimeMetadata, plugin_package: "evil/plugin" }).ok, false);
  assert.equal(validateConformanceRuntimeMetadataV1({ ...runtimeMetadata, disabled_modes: ["real_dispatch", "unsafe_mode"] }).ok, false);
  assert.equal(validateConformanceRuntimeMetadataV1({ ...runtimeMetadata, dispatch_authorized: true }).ok, false);
  assert.equal(validateConformanceRuntimeMetadataV1({ ...runtimeMetadata, fallback_authorized: true }).ok, false);
  assert.equal(validateConformanceRuntimeMetadataV1({ ...runtimeMetadata, guard_bypassed: true }).ok, false);
  assert.equal(validateConformanceRuntimeMetadataV1({ ...runtimeMetadata, evidence_refs: ["/Users/example/raw-evidence"] }).ok, false);
  assert.equal(validateConformanceRuntimeMetadataV1({ ...runtimeMetadata, evidence_refs: ["not an opaque ref"] }).ok, false);

  const evidenceRecord = {
    schema_version: "flowdesk.conformance_evidence_record.v1",
    evidence_ref: "evidence-123",
    run_id: "conformance-run-123",
    checked_at: "2026-05-17T00:00:00.000Z",
    evidence_area: "schema conversion",
    result: "partial",
    summary_label: "schema conversion remains blocked",
    redaction_version: "redaction-v1",
    source_refs: ["source-123"]
  };
  assert.equal(validateConformanceEvidenceRecordV1(evidenceRecord).ok, true);
  assert.equal(validateConformanceEvidenceRecordV1({ ...evidenceRecord, unexpected: true }).ok, false);
  assert.equal(validateConformanceEvidenceRecordV1({ ...evidenceRecord, result: "approved_dispatch" }).ok, false);
  assert.equal(validateConformanceEvidenceRecordV1({ ...evidenceRecord, source_refs: ["provider payload raw log"] }).ok, false);
  assert.equal(validateConformanceEvidenceRecordV1({ ...evidenceRecord, source_refs: ["not an opaque ref"] }).ok, false);
});

test("export debug request rejects invalid sections and bounds", () => {
  const request = { schema_version: "flowdesk.export_debug.request.v1", request_id: "request-123", input_mode: "test_fixture", include_sections: ["doctor"], retention_hint: "delete_after_export" };
  assert.equal(validateExportDebugRequestV1(request).ok, true);
  assert.equal(validateExportDebugRequestV1({ ...request, include_sections: ["doctor", "raw_logs"] }).ok, false);
});

test("export debug response validates manifest ref, section summaries, and retention timestamp", () => {
  const response = {
    schema_version: "flowdesk.export_debug.response.v1",
    ok: true,
    status: "diagnostic_only",
    safe_next_actions: ["/flowdesk-status"],
    user_message: "Debug export manifest is ready with redacted section refs.",
    export_manifest_ref: "manifest-123",
    included_sections: [{ schema_version: "flowdesk.debug_section_summary.v1", export_id: "export-123", section: "doctor", ref: "debug-section-123", redaction_status: "passed", warning_count: 0, excluded_categories: [] }],
    delete_after: "2026-05-18T00:00:00.000Z"
  };
  assert.equal(validateExportDebugResponseV1(response).ok, true);
  assert.equal(validateExportDebugResponseV1({ ...response, export_manifest_ref: "/Users/example/raw" }).ok, false);
  assert.equal(validateExportDebugResponseV1({ ...response, included_sections: [{ ...response.included_sections[0], section: "raw_logs" }] }).ok, false);
  assert.equal(validateExportDebugResponseV1({ ...response, delete_after: "not-a-date" }).ok, false);
});
