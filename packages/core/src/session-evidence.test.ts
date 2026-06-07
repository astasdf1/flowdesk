import assert from "node:assert/strict";
import { mkdirSync, mkdtempSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import {
  applyFlowDeskSessionEvidenceWriteIntentsV1,
  createFlowDeskConfiguredVerificationResultV1,
  createFlowDeskExternalAuthProviderPolicyResultV1,
  createFlowDeskProductionApprovalDecisionV1,
  createFlowDeskSanitizedAuthCaptureResultV1,
  FLOWDESK_SESSION_EVIDENCE_CLASSES,
  type FlowDeskExactModelAvailabilityCacheRefreshPlanV1,
  materializeFlowDeskExactModelCacheEvidenceFromProviderAcquisitionEvidenceV1,
  materializeFlowDeskRuntimeLaneLaunchPlansFromReviewerFanoutEvidenceV1,
  planFlowDeskExactModelAvailabilityCacheAcquisitionV1,
  planFlowDeskReviewerFanoutFromReloadedCacheEvidenceV1,
  planFlowDeskRuntimeLaneLaunchV1,
  prepareFlowDeskDispatchIdempotencyReservationV1,
  prepareFlowDeskSessionEvidenceWriteIntentV1,
  recordFlowDeskExactModelAvailabilityCacheProviderAcquisitionResultV1,
  reloadFlowDeskSessionEvidenceV1,
  selectFlowDeskExactModelCacheEvidencePairV1,
  sessionEvidenceDirectoryPath,
  sessionEvidenceRecordPath,
  summarizeFlowDeskSessionEvidenceInventoryV1
} from "./index.js";

const workflowId = "workflow-evidence-1";
const now = "2026-05-24T12:00:00.000Z";

function usageAuthorityRecord(overrides: Record<string, unknown> = {}) {
  return {
    schema_version: "flowdesk.managed_dispatch_beta.usage_authority_evidence.v1",
    authority_ref: "authority-ref-1",
    usage_snapshot_ref: "usage-snapshot-1",
    provider_family: "claude",
    provider_qualified_model_id: "claude/claude-opus-4-5",
    model_family: "opus",
    source_kind: "provider_native",
    source_version_ref: "source-version-1",
    auth_profile_ref: "principal-scope-claude",
    auth_evidence_ref: "auth-evidence-claude",
    credential_scope_ref: "principal-scope-claude",
    account_boundary_ref: "account-boundary-claude",
    quota_evidence_ref: "quota-evidence-claude",
    usage_acquired: true,
    reset_time: "2026-05-19T01:00:00.000Z",
    reset_bucket: "claude-weekly",
    source_ref: "usage-source-claude",
    conformance_ref: "usage-conformance-claude",
    redacted_evidence_refs: ["redacted-evidence-claude-1"],
    trusted: true,
    observed_at: "2026-05-19T00:00:00.000Z",
    expires_at: "2026-05-19T05:00:00.000Z",
    ...overrides
  };
}

function runtimeEchoRecord(overrides: Record<string, unknown> = {}) {
  return {
    schema_version: "flowdesk.managed_dispatch_beta.runtime_echo_evidence.v1",
    runtime_echo_ref: "runtime-echo-ref-1",
    workflow_id: workflowId,
    step_id: "step-1",
    attempt_id: "attempt-1",
    provider_family: "claude",
    provider_qualified_model_id: "claude/claude-opus-4-5",
    runtime_capability_ref: "runtime-capability-1",
    conformance_ref: "conformance-1",
    runtime_echo_mode: "trusted",
    trusted: true,
    observed_at: "2026-05-19T00:00:00.000Z",
    expires_at: "2026-05-19T05:00:00.000Z",
    ...overrides
  };
}

function telemetryRecord(overrides: Record<string, unknown> = {}) {
  return {
    schema_version: "flowdesk.managed_dispatch_beta.telemetry_correlation.v1",
    telemetry_ref: "telemetry-ref-1",
    workflow_id: workflowId,
    step_id: "step-1",
    attempt_id: "attempt-1",
    event_telemetry_mode: "sufficient",
    correlation_count: 3,
    ambiguous: false,
    source_refs: ["telemetry-source-1"],
    ...overrides
  };
}

function productionApprovalSourceRecord(overrides: Record<string, unknown> = {}) {
  return {
    schema_version: "flowdesk.production_approval_source.v1",
    approval_id: "approval-1",
    workflow_id: workflowId,
    attempt_id: "attempt-1",
    action_type: "managed_dispatch_beta",
    issuer_boundary: "external_user_confirmation",
    approval_method: "typed_phrase",
    actor_ref: "actor-user-1",
    profile_ref: "principal-scope-claude",
    provider_qualified_model_id: "claude/claude-opus-4-5",
    provider_binding_hash: "hash-provider-binding-1",
    evidence_bundle_hash: "hash-evidence-bundle-1",
    guard_decision_ref: "guard-decision-1",
    issuance_audit_ref: "audit-issuance-1",
    nonce_ref: "nonce-1",
    issued_at: "2026-05-19T00:00:00.000Z",
    expires_at: "2026-05-19T05:00:00.000Z",
    revoked: false,
    consume_strategy: "atomic_compare_and_swap_required",
    dispatch_authority_enabled: false,
    ...overrides
  };
}

function preDispatchAuditRecord(overrides: Record<string, unknown> = {}) {
  return {
    schema_version: "flowdesk.pre_dispatch_audit_record.v1",
    workflow_id: workflowId,
    pre_dispatch_audit_ref: "audit-predispatch-1",
    observed_at: "2026-05-19T00:00:00.000Z",
    ...overrides
  };
}

function dispatchIdempotencyRecord(overrides: Record<string, unknown> = {}) {
  return {
    schema_version: "flowdesk.dispatch_idempotency_snapshot.v1",
    workflow_id: workflowId,
    snapshot_ref: "idempotency-snapshot-1",
    observed_at: "2026-05-19T00:00:00.000Z",
    entries: [],
    dispatch_authority_enabled: false,
    realOpenCodeDispatch: false,
    actualLaneLaunch: false,
    providerCall: false,
    runtimeExecution: false,
    ...overrides
  };
}

function reviewerVerdictRecord(overrides: Record<string, unknown> = {}) {
  return {
    schema_version: "flowdesk.top_tier_review_verdict.v1",
    verdict_id: "verdict-policy-security-1",
    workflow_id: workflowId,
    attempt_id: "attempt-1",
    lane_id: "lane-policy-security-1",
    lane_plan_ref: "lane-plan-policy-security-1",
    binding_ref: "binding-reviewer-1",
    perspective: "policy_security",
    source: "claude_opus",
    created_at: "2026-05-19T00:02:00.000Z",
    scored_at: "2026-05-19T00:02:00.000Z",
    redaction_version: "redaction-v1",
    findings: [],
    evidence_refs: ["lane-evidence-policy-security-1"],
    uncertainty: "low",
    required_fixes: [],
    verdict_label: "pass",
    safe_next_actions: ["/flowdesk-status"],
    dispatch_authority_enabled: false,
    guard_replacement_authority_enabled: false,
    ...overrides
  };
}

function reviewerFanoutPlanRecord(overrides: Record<string, unknown> = {}) {
	const fanoutPerspectives = ["policy_security", "architecture", "verification_implementation"] as const;
	const runtimeRequests = fanoutPerspectives.map((perspective) => ({
		schema_version: "flowdesk.runtime_lane_launch_request.v1" as const,
		launch_request_id: `reviewer-launch-attempt-1-${perspective}`,
		workflow_id: workflowId,
		attempt_id: "attempt-1",
		lane_id: `reviewer-lane-attempt-1-${perspective}`,
		parent_session_ref: "ses-parent-1",
		agent_ref: "agent-reviewer",
		provider_qualified_model_id: "claude/claude-opus-4-5",
		launch_reason: "reviewer_fanout" as const,
		pre_launch_audit_ref: "audit-pre-launch-1",
		lane_launch_approval_ref: "approval-lane-launch-1",
		requested_at: "2026-05-19T00:01:00.000Z",
		timeout_ms: 30000,
		orphan_max_age_ms: 60000,
		retry_budget: 1,
		dispatch_authority_enabled: false as const,
		providerCall: false as const,
		actualLaneLaunch: false as const,
		runtimeExecution: false as const
	}));
  return {
    schema_version: "flowdesk.reviewer_fanout_plan.v1",
    ok: true,
    errors: [],
    workflow_id: workflowId,
    attempt_id: "attempt-1",
    cache_id: "cache-1",
    state: "fanout_ready",
    blocked_labels: [],
    required_perspectives: [...fanoutPerspectives],
    planned_perspectives: [...fanoutPerspectives],
    runtime_lane_launch_requests: runtimeRequests,
    max_concurrent_lane_count: 1,
		same_model_stagger_ms: 1,
		lane_launch_schedule: runtimeRequests.map((request, index) => ({
			lane_id: request.lane_id,
			provider_qualified_model_id: request.provider_qualified_model_id,
			launch_delay_ms: index * 1
		})),
    runtime_launch_plan_required: true,
    lane_launch_approval_required: true,
    launch_attempted: false,
    approval_inferred: false,
    dispatch_authority_enabled: false,
    providerCall: false,
    actualLaneLaunch: false,
    runtimeExecution: false,
    ...overrides
  };
}

function runtimeLaneLaunchPlanRecord(overrides: Record<string, unknown> = {}) {
  return {
    ...planFlowDeskRuntimeLaneLaunchV1({
      request: reviewerFanoutPlanRecord().runtime_lane_launch_requests[0] as Parameters<typeof planFlowDeskRuntimeLaneLaunchV1>[0]["request"],
      sdkClientAvailable: true,
      durableEvidenceRootRef: "evidence-root-workflow-1"
    }),
    ...overrides
  };
}

function exactModelAvailabilityCacheRecord(overrides: Record<string, unknown> = {}) {
  return {
    schema_version: "flowdesk.exact_model_availability_cache.v1",
    cache_id: "cache-1",
    local_date: "2026-05-19",
    active_profile_ref: "profile-1",
    opencode_version_ref: "opencode-1.15.6",
    flowdesk_package_version_ref: "flowdesk-0.1.1",
    registry_hash: "hash-registry-1",
    policy_pack_hash: "hash-policy-1",
    auth_account_boundary_ref: "account-1",
    entries: [{
      entry_id: "entry-claude-1",
      provider_family: "claude",
      provider_identity_ref: "provider-claude-1",
      provider_qualified_model_id: "claude/claude-opus-4-5",
      model_family: "opus",
      registered: true,
      available: true,
      highest_tier_eligible: true,
      availability_ref: "availability-1"
    }],
    dispatch_authority_enabled: false,
    providerCall: false,
    actualLaneLaunch: false,
    runtimeExecution: false,
    ...overrides
  };
}

function exactModelAvailabilityCacheRefreshPlanRecord(overrides: Record<string, unknown> = {}): FlowDeskExactModelAvailabilityCacheRefreshPlanV1 {
  return {
    schema_version: "flowdesk.exact_model_availability_cache_refresh_plan.v1",
    ok: true,
    errors: [],
    state: "cache_hit",
    blocked_labels: [],
    refresh_reason_labels: [],
    expected_local_date: "2026-05-19",
    expected_active_profile_ref: "profile-1",
    expected_opencode_version_ref: "opencode-1.15.6",
    expected_flowdesk_package_version_ref: "flowdesk-0.1.1",
    expected_registry_hash: "hash-registry-1",
    expected_policy_pack_hash: "hash-policy-1",
    expected_auth_account_boundary_ref: "account-1",
    cache_id: "cache-1",
    cache_local_date: "2026-05-19",
    cache_active_profile_ref: "profile-1",
    cache_opencode_version_ref: "opencode-1.15.6",
    cache_flowdesk_package_version_ref: "flowdesk-0.1.1",
    cache_registry_hash: "hash-registry-1",
    cache_policy_pack_hash: "hash-policy-1",
    cache_auth_account_boundary_ref: "account-1",
    discovery_required: false,
    refresh_required: false,
    cache_usable_for_assignment: true,
    discovery_attempted: false,
    refresh_attempted: false,
    dispatch_authority_enabled: false,
    providerCall: false,
    actualLaneLaunch: false,
    runtimeExecution: false,
    ...overrides
  } as FlowDeskExactModelAvailabilityCacheRefreshPlanV1;
}

function exactModelAvailabilityCacheAcquisitionPlanRecord(overrides: Record<string, unknown> = {}) {
  return {
    ...planFlowDeskExactModelAvailabilityCacheAcquisitionV1({
      refreshPlan: exactModelAvailabilityCacheRefreshPlanRecord({
        state: "refresh_required",
        refresh_reason_labels: ["cache_missing"],
        cache_id: undefined,
        cache_local_date: undefined,
        cache_active_profile_ref: undefined,
        cache_opencode_version_ref: undefined,
        cache_flowdesk_package_version_ref: undefined,
        cache_registry_hash: undefined,
        cache_policy_pack_hash: undefined,
        cache_auth_account_boundary_ref: undefined,
        discovery_required: true,
        refresh_required: true,
        cache_usable_for_assignment: false
      })
    }),
    ...overrides
  };
}

function exactModelAvailabilityCacheProviderAcquisitionResultRecord(overrides: Record<string, unknown> = {}) {
  return {
    ...recordFlowDeskExactModelAvailabilityCacheProviderAcquisitionResultV1({
      acquisitionPlan: exactModelAvailabilityCacheAcquisitionPlanRecord(),
      resultId: "provider-acquisition-result-1",
      localDate: "2026-05-19",
      activeProfileRef: "profile-1",
      opencodeVersionRef: "opencode-1.15.6",
      flowdeskPackageVersionRef: "flowdesk-0.1.1",
      registryHash: "hash-registry-1",
      policyPackHash: "hash-policy-1",
      authAccountBoundaryRef: "account-1",
      providerFamily: "claude",
      providerIdentityRef: "provider-claude-1",
      providerQualifiedModelId: "claude/claude-opus-4-5",
      modelFamily: "opus",
      availabilityRef: "availability-live-1",
      preCallAuditRef: "audit-provider-acquisition-1",
      idempotencyRef: "idempotency-provider-acquisition-1",
      liveTestRunRef: "live-test-run-1",
      redactionProofRef: "redaction-proof-1",
      sanitizedProviderResultRef: "provider-result-redacted-1",
      observedAt: "2026-05-19T00:00:00.000Z",
      outcome: "available",
      highestTierEligible: true
    }),
    ...overrides
  };
}

function laneLifecycleRecord(overrides: Record<string, unknown> = {}) {
  return {
    schema_version: "flowdesk.lane_lifecycle_record.v1",
    lane_id: "lane-policy-security-1",
    workflow_id: workflowId,
    attempt_id: "attempt-1",
    parent_session_ref: "ses-parent-1",
    child_session_ref: "ses-child-1",
    message_ref: "msg-policy-security-1",
    agent_ref: "agent-reviewer",
    provider_qualified_model_id: "claude/claude-opus-4-5",
    state: "complete",
    verdict_ref: "verdict-policy-security-1",
    output_ref: "output-policy-security-1",
    runtime_echo_ref: "runtime-echo-policy-security-1",
    telemetry_ref: "telemetry-policy-security-1",
    timeout_ms: 30000,
    orphan_max_age_ms: 60000,
    retry_count: 0,
    created_at: "2026-05-19T00:01:00.000Z",
    updated_at: "2026-05-19T00:02:00.000Z",
    dispatch_authority_enabled: false,
    providerCall: false,
    actualLaneLaunch: false,
    runtimeExecution: false,
    ...overrides
  };
}

function reviewerLaneConformanceRecord(overrides: Record<string, unknown> = {}) {
  return {
    schema_version: "flowdesk.top_tier_reviewer_lane_conformance_observation.v1",
    observation_id: "observation-policy-security-1",
    workflow_id: workflowId,
    lane_id: "lane-policy-security-1",
    binding_ref: "binding-reviewer-1",
    lane_plan_ref: "lane-plan-policy-security-1",
    channel: "injected_sdk_client",
    agent_id: "reviewer",
    provider_qualified_model_id: "claude/claude-opus-4-5",
    perspective: "policy_security",
    prompt_hash_ref: "hash-reviewinput-policy-security-1",
    output_ref: "output-policy-security-1",
    runtime_echo_ref: "runtime-echo-policy-security-1",
    telemetry_ref: "telemetry-policy-security-1",
    parent_task_ref: "parent-task-policy-security-1",
    subtask_ref: "subtask-policy-security-1",
    status: "observed",
    uncertainty_labels: [],
    observed_at: "2026-05-19T00:02:00.000Z",
    dispatch_authority_enabled: false,
    hard_chat_authority_claimed: false,
    ...overrides
  };
}

function controlledConformanceDocWriteRecord(overrides: Record<string, unknown> = {}) {
  return {
    schema_version: "flowdesk.controlled_conformance_doc_write.v1",
    ledger_entry_id: "controlled-doc-write-1",
    request_id: "request-controlled-doc-1",
    workflow_id: workflowId,
    attempt_id: "attempt-1",
    target_kind: "release_conformance_doc",
    target_ref: "release-conformance-doc-1",
    approval_id: "approval-1",
    actor_ref: "actor-user-1",
    profile_ref: "principal-scope-claude",
    evidence_bundle_hash: "hash-evidence-bundle-1",
    guard_decision_ref: "guard-decision-1",
    issuance_audit_ref: "audit-issuance-1",
    consumption_audit_ref: "audit-consumption-1",
    redaction_policy_ref: "redaction-policy-1",
    content_hash_ref: "sha256-1234567890abcdef",
    pre_write_audit_ref: "audit-prewrite-1",
    dry_run_ref: "dry-run-1",
    artifact_ref: "artifact-release-conformance-doc-1",
    artifact_path: "docs/conformance/release-conformance-doc-1.md",
    artifact_sha256_ref: "sha256-1234567890abcdef",
    materialized_at: "2026-05-19T00:03:00.000Z",
    local_only: true,
    writeAttempted: true,
    remoteWriteAttempted: false,
    githubWriteAttempted: false,
    connectorWriteAttempted: false,
    storageWriteAttempted: false,
    databaseWriteAttempted: false,
    urlWriteAttempted: false,
    rawPathWriteAttempted: false,
    dispatch_authority_enabled: false,
    realOpenCodeDispatch: false,
    providerCall: false,
    actualLaneLaunch: false,
    runtimeExecution: false,
    fallbackAuthority: false,
    toolAuthority: false,
    hardCancelOrNoReplyAuthority: false,
    ...overrides
  };
}

function controlledRedactedAuditExportWriteRecord(overrides: Record<string, unknown> = {}) {
  return {
    schema_version: "flowdesk.controlled_redacted_audit_export_write.v1",
    ledger_entry_id: "controlled-audit-export-write-1",
    request_id: "request-controlled-audit-export-1",
    workflow_id: workflowId,
    attempt_id: "attempt-1",
    target_kind: "redacted_audit_export",
    target_ref: "redacted-audit-export-1",
    approval_id: "approval-1",
    actor_ref: "actor-user-1",
    profile_ref: "principal-scope-claude",
    evidence_bundle_hash: "hash-evidence-bundle-1",
    guard_decision_ref: "guard-decision-1",
    issuance_audit_ref: "audit-issuance-1",
    consumption_audit_ref: "audit-consumption-1",
    redaction_policy_ref: "redaction-policy-1",
    content_hash_ref: "sha256-1234567890abcdef",
    pre_write_audit_ref: "audit-prewrite-1",
    dry_run_ref: "dry-run-1",
    artifact_ref: "artifact-redacted-audit-export-1",
    artifact_path: `.flowdesk/sessions/${workflowId}/redacted-audit/redacted-audit-export-1.json`,
    artifact_sha256_ref: "sha256-1234567890abcdef",
    materialized_at: "2026-05-19T00:03:00.000Z",
    local_only: true,
    redacted: true,
    writeAttempted: true,
    remoteWriteAttempted: false,
    githubWriteAttempted: false,
    connectorWriteAttempted: false,
    storageWriteAttempted: false,
    databaseWriteAttempted: false,
    urlWriteAttempted: false,
    rawPathWriteAttempted: false,
    dispatch_authority_enabled: false,
    realOpenCodeDispatch: false,
    providerCall: false,
    actualLaneLaunch: false,
    runtimeExecution: false,
    fallbackAuthority: false,
    toolAuthority: false,
    hardCancelOrNoReplyAuthority: false,
    ...overrides
  };
}

function controlledWorkspaceFileWriteRecord(overrides: Record<string, unknown> = {}) {
  return {
    schema_version: "flowdesk.controlled_workspace_file_write.v1",
    ledger_entry_id: "controlled-workspace-write-1",
    workflow_id: workflowId,
    user_approval_ref: "approval-user-1",
    target_file_path: "docs/example.md",
    expected_content_sha256_ref: "sha256-0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef",
    previous_content_sha256_ref: "sha256-0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef",
    replacement_content_sha256_ref: "sha256-abcdef0123456789abcdef0123456789abcdef0123456789abcdef0123456789",
    reason_summary: "Apply explicitly approved dev beta file replacement.",
    materialized_at: "2026-05-19T00:04:00.000Z",
    dev_beta_explicit_opt_in: true,
    developer_mode_acknowledged: true,
    allow_controlled_write: true,
    local_only: true,
    writeAttempted: true,
    remoteWriteAttempted: false,
    githubWriteAttempted: false,
    connectorWriteAttempted: false,
    storageWriteAttempted: false,
    databaseWriteAttempted: false,
    urlWriteAttempted: false,
    rawPathWriteAttempted: false,
    dispatch_authority_enabled: false,
    realOpenCodeDispatch: false,
    providerCall: false,
    actualLaneLaunch: false,
    runtimeExecution: false,
    fallbackAuthority: false,
    toolAuthority: false,
    hardCancelOrNoReplyAuthority: false,
    ...overrides
  };
}

function oiSessionSummaryRecord(overrides: Record<string, unknown> = {}) {
  return {
    schema_version: "flowdesk.oi_session_summary.v1",
    summary_id: "summary-oi-1",
    session_ref: "ses-session-1",
    workflow_id: workflowId,
    proposals_scored: 3,
    reuse_gates_checked: 2,
    fanout_gates_evaluated: 1,
    ledger_entries_total: 6,
    advisory_health_label: "healthy",
    captured_at: now,
    safe_next_actions: ["flowdesk-status"],
    advisory_only: true,
    non_authorizing: true,
    dispatch_authority_enabled: false,
    approval_authority_enabled: false,
    provider_authority_enabled: false,
    runtime_authority_enabled: false,
    external_write_authority_enabled: false,
    remote_write_authority_enabled: false,
    fallback_authority_enabled: false,
    lane_launch_authority_enabled: false,
    write_authority_enabled: false,
    hard_chat_authority_enabled: false,
    ...overrides
  };
}

function workflowDispatchPlanRecord(overrides: Record<string, unknown> = {}) {
  return {
    schema_version: "flowdesk.workflow_dispatch_plan.v1",
    workflow_id: workflowId,
    plan_revision_id: "plan-revision-1",
    requested_goal_summary: "Prepare a bounded documentation update",
    selected_agent_roles: [{ agent_role: "documentation", agent_role_ref: "agent-docs" }],
    tasks: [{
      task_id: "task-docs-1",
      title: "Review documentation notes",
      summary: "Summarize the bounded documentation change needed for the release note",
      agent_role: "documentation",
      agent_role_ref: "agent-docs"
    }],
    task_graph_summary: "One documentation task with no dependencies",
    model_selection_diagnostics: {
      diagnostic_refs: ["diagnostic-plan-1"],
      diagnostic_labels: ["planning_only"],
      scoring_authority_enabled: false,
      fallback_or_reselection_allowed: false
    },
    release_gate: "release1_planning_only",
    dispatch_authority_enabled: false,
    provider_call_made: false,
    runtime_execution: false,
    actual_lane_launch: false,
    redaction_version: "v1",
    ...overrides
  };
}

function workflowAuthoringResultRecord(overrides: Record<string, unknown> = {}) {
  return {
    schema_version: "flowdesk.workflow_authoring_result.v1",
    workflow_id: workflowId,
    authoring_result_id: "authoring-result-1",
    goal_summary: "Prepare a bounded documentation update",
    scope_summary: "Planning-only durable evidence records",
    output_summary: "A task graph and assignment selection summary",
    risk_summary: "Malformed evidence could block reload",
    status: "authored",
    created_at: now,
    evidence_refs: ["task-graph-1"],
    release_gate: "release1_planning_only",
    dispatch_authority_enabled: false,
    provider_call_made: false,
    runtime_execution: false,
    actual_lane_launch: false,
    write_authority_enabled: false,
    redaction_version: "v1",
    ...overrides
  };
}

function taskGraphRecord(overrides: Record<string, unknown> = {}) {
  return {
    schema_version: "flowdesk.task_graph.v1",
    workflow_id: workflowId,
    task_graph_id: "task-graph-1",
    nodes: [{ task_id: "task-docs-1", title: "Review docs", summary: "Summarize bounded documentation update" }],
    edges: [],
    graph_summary: "One documentation planning task",
    created_at: now,
    release_gate: "release1_planning_only",
    dispatch_authority_enabled: false,
    provider_call_made: false,
    runtime_execution: false,
    actual_lane_launch: false,
    write_authority_enabled: false,
    redaction_version: "v1",
    ...overrides
  };
}

function taskAgentAssignmentRecord(overrides: Record<string, unknown> = {}) {
  return {
    schema_version: "flowdesk.task_agent_assignment.v1",
    workflow_id: workflowId,
    task_id: "task-docs-1",
    assignment_id: "assignment-docs-1",
    agent_role: "documentation",
    agent_role_ref: "agent-role-docs",
    selected_agent_ref: "agent-docs",
    selected_profile_ref: "profile-readonly",
    compatibility_status: "compatible",
    fit_label: "documentation planning fit",
    registry_evidence_ref: "registry-evidence-1",
    profile_evidence_ref: "profile-evidence-1",
    blocked_labels: [],
    created_at: now,
    release_gate: "release1_planning_only",
    dispatch_authority_enabled: false,
    provider_call_made: false,
    runtime_execution: false,
    actual_lane_launch: false,
    write_authority_enabled: false,
    redaction_version: "v1",
    ...overrides
  };
}

function taskModelSelectionRecord(overrides: Record<string, unknown> = {}) {
  return {
    schema_version: "flowdesk.task_model_selection.v1",
    workflow_id: workflowId,
    task_id: "task-docs-1",
    selection_id: "selection-docs-1",
    provider_family: "openai",
    provider_qualified_model_id: "openai/gpt-5.5",
    usage_snapshot_ref: "usage-snapshot-1",
    usage_snapshot_freshness: "fresh",
    provider_health_ref: "provider-health-1",
    provider_health_label: "ok",
    exact_model_availability_ref: "model-availability-1",
    exact_model_availability_label: "available",
    fit_label: "documentation planning fit",
    performance_label: "balanced",
    selection_status: "selected",
    blocked_labels: [],
    fallback_allowed: false,
    reselection_allowed: false,
    created_at: now,
    release_gate: "release1_planning_only",
    dispatch_authority_enabled: false,
    provider_call_made: false,
    runtime_execution: false,
    actual_lane_launch: false,
    write_authority_enabled: false,
    redaction_version: "v1",
    ...overrides
  };
}

test("session evidence path builders produce per-class relative paths", () => {
  for (const evidenceClass of FLOWDESK_SESSION_EVIDENCE_CLASSES) {
    const dir = sessionEvidenceDirectoryPath(workflowId, evidenceClass);
    assert.ok(dir.startsWith(`.flowdesk/sessions/${workflowId}/evidence/`));
    const record = sessionEvidenceRecordPath(workflowId, evidenceClass, "evidence-1");
    assert.ok(record.startsWith(dir));
    assert.ok(record.endsWith("/evidence-1.json"));
  }
});

test("session evidence write intent succeeds for valid usage authority records", () => {
  const result = prepareFlowDeskSessionEvidenceWriteIntentV1({ workflowId, evidenceId: "evidence-1", record: usageAuthorityRecord() });
  assert.equal(result.ok, true, result.errors.join("; "));
  const intent = result.writeIntent;
  assert.ok(intent);
  assert.equal(intent.evidenceClass, "usage_authority");
  assert.equal(intent.authority, "redacted_session_support");
  assert.equal(intent.realOpenCodeDispatch, false);
  assert.equal(intent.actualLaneLaunch, false);
  assert.equal(intent.providerCall, false);
  assert.equal(intent.runtimeExecution, false);
  assert.ok(intent.path.startsWith(`.flowdesk/sessions/${workflowId}/evidence/usage-authority/`));
  assert.ok(intent.tempPath.startsWith(`${intent.path}.tmp-`));
});

test("session evidence write intent succeeds for production approval source records", () => {
  const result = prepareFlowDeskSessionEvidenceWriteIntentV1({ workflowId, evidenceId: "approval-source-1", record: productionApprovalSourceRecord() });
  assert.equal(result.ok, true, result.errors.join("; "));
  const intent = result.writeIntent;
  assert.ok(intent);
  assert.equal(intent.evidenceClass, "production_approval_source");
  assert.equal(intent.schemaId, "flowdesk.production_approval_source.v1");
  assert.equal(intent.providerCall, false);
  assert.ok(intent.path.startsWith(`.flowdesk/sessions/${workflowId}/evidence/production-approval-source/`));
});

test("session evidence write intent rejects schema version mismatch and authority leaks", () => {
  const wrongSchema = prepareFlowDeskSessionEvidenceWriteIntentV1({ workflowId, evidenceId: "evidence-1", record: { ...usageAuthorityRecord(), schema_version: "flowdesk.managed_dispatch_beta.usage_authority_evidence.v2" } });
  assert.equal(wrongSchema.ok, false);

  const unknownSchema = prepareFlowDeskSessionEvidenceWriteIntentV1({ workflowId, evidenceId: "evidence-1", record: { schema_version: "flowdesk.unknown.v1" } });
  assert.equal(unknownSchema.ok, false);

  const wrongWorkflow = prepareFlowDeskSessionEvidenceWriteIntentV1({ workflowId, evidenceId: "evidence-1", record: runtimeEchoRecord({ workflow_id: "workflow-other" }) });
  assert.equal(wrongWorkflow.ok, false);

  const promptLeak = prepareFlowDeskSessionEvidenceWriteIntentV1({ workflowId, evidenceId: "evidence-1", record: { ...usageAuthorityRecord(), source_ref: "system prompt: hidden" } });
  assert.equal(promptLeak.ok, false);
});

test("session evidence write intent rejects malformed ids", () => {
  const badEvidence = prepareFlowDeskSessionEvidenceWriteIntentV1({ workflowId, evidenceId: "../escape", record: usageAuthorityRecord() });
  assert.equal(badEvidence.ok, false);

  const badWorkflow = prepareFlowDeskSessionEvidenceWriteIntentV1({ workflowId: "../escape", evidenceId: "evidence-1", record: usageAuthorityRecord() });
  assert.equal(badWorkflow.ok, false);

  const nonObject = prepareFlowDeskSessionEvidenceWriteIntentV1({ workflowId, evidenceId: "evidence-1", record: "not-an-object" as unknown as Record<string, unknown> });
  assert.equal(nonObject.ok, false);
});

test("session evidence apply writes intents durably and reloads them", () => {
  withEvidenceTree((rootDir) => {
    const records = [usageAuthorityRecord(), runtimeEchoRecord(), telemetryRecord(), productionApprovalSourceRecord(), dispatchIdempotencyRecord(), preDispatchAuditRecord(), exactModelAvailabilityCacheRecord(), exactModelAvailabilityCacheRefreshPlanRecord(), exactModelAvailabilityCacheAcquisitionPlanRecord(), exactModelAvailabilityCacheProviderAcquisitionResultRecord(), reviewerVerdictRecord(), reviewerFanoutPlanRecord(), runtimeLaneLaunchPlanRecord(), laneLifecycleRecord(), reviewerLaneConformanceRecord(), controlledConformanceDocWriteRecord(), controlledRedactedAuditExportWriteRecord(), controlledWorkspaceFileWriteRecord(), workflowAuthoringResultRecord(), taskGraphRecord(), taskAgentAssignmentRecord(), taskModelSelectionRecord(), workflowDispatchPlanRecord(), oiSessionSummaryRecord()];
    const intents = records.map((record, index) => {
      const prepared = prepareFlowDeskSessionEvidenceWriteIntentV1({ workflowId, evidenceId: `evidence-${index + 1}`, record });
      assert.equal(prepared.ok, true, prepared.errors.join("; "));
      assert.ok(prepared.writeIntent);
      return prepared.writeIntent;
    });

    const applied = applyFlowDeskSessionEvidenceWriteIntentsV1(rootDir, intents);
    assert.equal(applied.ok, true, applied.errors.join("; "));
    assert.equal(applied.writtenPaths.length, 24);
    assert.equal(applied.providerCall, false);
    assert.equal(applied.runtimeExecution, false);

    const reloaded = reloadFlowDeskSessionEvidenceV1({ workflowId, rootDir });
    assert.equal(reloaded.ok, true, reloaded.errors.join("; "));
    assert.equal(reloaded.entries.length, 24);
    assert.deepEqual(new Set(reloaded.entries.map((entry) => entry.evidenceClass)), new Set(["usage_authority", "runtime_echo", "telemetry_correlation", "production_approval_source", "dispatch_idempotency", "pre_dispatch_audit", "exact_model_availability_cache", "exact_model_availability_cache_refresh_plan", "exact_model_availability_cache_acquisition_plan", "exact_model_availability_cache_provider_acquisition_result", "reviewer_verdict", "reviewer_fanout_plan", "runtime_lane_launch_plan", "lane_lifecycle", "reviewer_lane_conformance", "controlled_conformance_doc_write", "controlled_redacted_audit_export_write", "controlled_workspace_file_write", "workflow_authoring_result", "task_graph", "task_agent_assignment", "task_model_selection", "workflow_dispatch_plan", "oi_session_summary"]));
  });
});

test("session evidence reload validates first planning evidence slice", () => {
  withEvidenceTree((rootDir) => {
    writeEvidenceFile(rootDir, sessionEvidenceRecordPath(workflowId, "workflow_authoring_result", "authoring-good"), JSON.stringify(workflowAuthoringResultRecord()));
    writeEvidenceFile(rootDir, sessionEvidenceRecordPath(workflowId, "task_graph", "graph-good"), JSON.stringify(taskGraphRecord()));
    writeEvidenceFile(rootDir, sessionEvidenceRecordPath(workflowId, "task_agent_assignment", "assignment-good"), JSON.stringify(taskAgentAssignmentRecord()));
    writeEvidenceFile(rootDir, sessionEvidenceRecordPath(workflowId, "task_model_selection", "selection-good"), JSON.stringify(taskModelSelectionRecord()));
    writeEvidenceFile(rootDir, sessionEvidenceRecordPath(workflowId, "task_model_selection", "selection-forged"), JSON.stringify(taskModelSelectionRecord({ fallback_allowed: true })));
    writeEvidenceFile(rootDir, sessionEvidenceRecordPath(workflowId, "task_graph", "graph-cycle"), JSON.stringify(taskGraphRecord({
      nodes: [
        { task_id: "task-a", title: "A", summary: "First planning task" },
        { task_id: "task-b", title: "B", summary: "Second planning task" }
      ],
      edges: [
        { from_task_id: "task-a", to_task_id: "task-b", relation: "depends_on" },
        { from_task_id: "task-b", to_task_id: "task-a", relation: "depends_on" }
      ]
    })));

    const result = reloadFlowDeskSessionEvidenceV1({ workflowId, rootDir });
    assert.equal(result.entries.length, 4);
    assert.deepEqual(new Set(result.entries.map((entry) => entry.evidenceClass)), new Set(["workflow_authoring_result", "task_graph", "task_agent_assignment", "task_model_selection"]));
    assert.equal(result.blocked.length, 2);
    assert.match(result.blocked.map((entry) => entry.reason).join("|"), /fallback_allowed must be false|cycle/);
    assert.equal(result.providerCall, false);
    assert.equal(result.actualLaneLaunch, false);
    assert.equal(result.runtimeExecution, false);
  });
});

test("session evidence reload validates workflow dispatch planning evidence", () => {
  withEvidenceTree((rootDir) => {
    writeEvidenceFile(rootDir, sessionEvidenceRecordPath(workflowId, "workflow_dispatch_plan", "workflow-plan-good"), JSON.stringify(workflowDispatchPlanRecord()));
    writeEvidenceFile(rootDir, sessionEvidenceRecordPath(workflowId, "workflow_dispatch_plan", "workflow-plan-forged"), JSON.stringify(workflowDispatchPlanRecord({ provider_call_made: true })));
    writeEvidenceFile(rootDir, sessionEvidenceRecordPath(workflowId, "workflow_dispatch_plan", "workflow-plan-copy"), JSON.stringify(workflowDispatchPlanRecord({ workflow_id: "workflow-other" })));
    const result = reloadFlowDeskSessionEvidenceV1({ workflowId, rootDir });
    assert.equal(result.entries.length, 1);
    assert.equal(result.entries[0].evidenceClass, "workflow_dispatch_plan");
    assert.equal(result.blocked.length, 2);
    const reasons = result.blocked.map((entry) => entry.reason).join("|");
    assert.match(reasons, /provider_call_made must be false/);
    assert.match(reasons, /workflow_id mismatch/);
    assert.equal(result.providerCall, false);
    assert.equal(result.actualLaneLaunch, false);
    assert.equal(result.runtimeExecution, false);
  });
});

test("session evidence reload validates exact-model cache refresh and acquisition evidence", () => {
  withEvidenceTree((rootDir) => {
    writeEvidenceFile(rootDir, sessionEvidenceRecordPath(workflowId, "exact_model_availability_cache", "cache-good"), JSON.stringify(exactModelAvailabilityCacheRecord()));
    writeEvidenceFile(rootDir, sessionEvidenceRecordPath(workflowId, "exact_model_availability_cache", "cache-forged"), JSON.stringify(exactModelAvailabilityCacheRecord({ providerCall: true })));
    writeEvidenceFile(rootDir, sessionEvidenceRecordPath(workflowId, "exact_model_availability_cache_refresh_plan", "cache-refresh-good"), JSON.stringify(exactModelAvailabilityCacheRefreshPlanRecord()));
    writeEvidenceFile(rootDir, sessionEvidenceRecordPath(workflowId, "exact_model_availability_cache_refresh_plan", "cache-refresh-forged"), JSON.stringify(exactModelAvailabilityCacheRefreshPlanRecord({ refresh_attempted: true })));
    writeEvidenceFile(rootDir, sessionEvidenceRecordPath(workflowId, "exact_model_availability_cache_acquisition_plan", "cache-acquisition-good"), JSON.stringify(exactModelAvailabilityCacheAcquisitionPlanRecord()));
    writeEvidenceFile(rootDir, sessionEvidenceRecordPath(workflowId, "exact_model_availability_cache_acquisition_plan", "cache-acquisition-forged"), JSON.stringify(exactModelAvailabilityCacheAcquisitionPlanRecord({ acquisition_attempted: true })));
    writeEvidenceFile(rootDir, sessionEvidenceRecordPath(workflowId, "exact_model_availability_cache_provider_acquisition_result", "provider-acquisition-good"), JSON.stringify(exactModelAvailabilityCacheProviderAcquisitionResultRecord()));
    writeEvidenceFile(rootDir, sessionEvidenceRecordPath(workflowId, "exact_model_availability_cache_provider_acquisition_result", "provider-acquisition-forged"), JSON.stringify(exactModelAvailabilityCacheProviderAcquisitionResultRecord({ dispatch_authority_enabled: true })));
    const result = reloadFlowDeskSessionEvidenceV1({ workflowId, rootDir });
    assert.equal(result.entries.length, 4);
    assert.deepEqual(new Set(result.entries.map((entry) => entry.evidenceClass)), new Set(["exact_model_availability_cache", "exact_model_availability_cache_refresh_plan", "exact_model_availability_cache_acquisition_plan", "exact_model_availability_cache_provider_acquisition_result"]));
    assert.equal(result.blocked.length, 4);
    assert.match(result.blocked.map((entry) => entry.reason).join("|"), /cannot enable runtime authority|cannot attempt discovery|cannot refresh cache/);
  });
});

test("session evidence selector returns paired exact-model cache evidence", () => {
  withEvidenceTree((rootDir) => {
    writeEvidenceFile(rootDir, sessionEvidenceRecordPath(workflowId, "exact_model_availability_cache", "cache-good"), JSON.stringify(exactModelAvailabilityCacheRecord()));
    writeEvidenceFile(rootDir, sessionEvidenceRecordPath(workflowId, "exact_model_availability_cache_refresh_plan", "cache-refresh-good"), JSON.stringify(exactModelAvailabilityCacheRefreshPlanRecord()));
    const reloaded = reloadFlowDeskSessionEvidenceV1({ workflowId, rootDir });
    const selection = selectFlowDeskExactModelCacheEvidencePairV1({
      reloadedEvidence: reloaded,
      localDate: "2026-05-19",
      activeProfileRef: "profile-1",
      opencodeVersionRef: "opencode-1.15.6",
      flowdeskPackageVersionRef: "flowdesk-0.1.1",
      registryHash: "hash-registry-1",
      policyPackHash: "hash-policy-1",
      authAccountBoundaryRef: "account-1"
    });
    assert.equal(selection.state, "pair_ready", selection.errors.join("; "));
    assert.equal(selection.cache?.cache_id, "cache-1");
    assert.equal(selection.cacheRefreshPlan?.state, "cache_hit");
    assert.equal(selection.providerCall, false);
    assert.equal(selection.actualLaneLaunch, false);
  });
});

test("session evidence materializes provider acquisition into cache and cache-hit refresh evidence", () => {
  withEvidenceTree((rootDir) => {
    writeEvidenceFile(rootDir, sessionEvidenceRecordPath(workflowId, "exact_model_availability_cache_provider_acquisition_result", "provider-acquisition-good"), JSON.stringify(exactModelAvailabilityCacheProviderAcquisitionResultRecord()));
    const reloaded = reloadFlowDeskSessionEvidenceV1({ workflowId, rootDir });
    const materialized = materializeFlowDeskExactModelCacheEvidenceFromProviderAcquisitionEvidenceV1({
      reloadedEvidence: reloaded,
      workflowId,
      providerAcquisitionEvidenceId: "provider-acquisition-good",
      targetCacheEvidenceId: "cache-from-acquisition-1",
      targetCacheRefreshPlanEvidenceId: "cache-refresh-from-acquisition-1",
      cacheId: "cache-from-acquisition-1",
      entryId: "entry-from-acquisition-1",
      localDate: "2026-05-19",
      activeProfileRef: "profile-1",
      opencodeVersionRef: "opencode-1.15.6",
      flowdeskPackageVersionRef: "flowdesk-0.1.1",
      registryHash: "hash-registry-1",
      policyPackHash: "hash-policy-1",
      authAccountBoundaryRef: "account-1",
      rootDir
    });
    assert.equal(materialized.state, "materialized", materialized.errors.join("; "));
    assert.equal(materialized.writeIntents.length, 2);
    assert.equal(materialized.applyResult?.writtenPaths.length, 2);
    assert.equal(materialized.cache?.providerCall, false);
    assert.equal(materialized.cache?.actualLaneLaunch, false);
    assert.equal(materialized.cacheRefreshPlan?.state, "cache_hit");
    assert.equal(materialized.cacheRefreshPlan?.providerCall, false);
    assert.equal(materialized.selection?.state, "pair_ready");

    const selected = selectFlowDeskExactModelCacheEvidencePairV1({
      reloadedEvidence: materialized.reloadedEvidence ?? reloadFlowDeskSessionEvidenceV1({ workflowId, rootDir }),
      localDate: "2026-05-19",
      activeProfileRef: "profile-1",
      opencodeVersionRef: "opencode-1.15.6",
      flowdeskPackageVersionRef: "flowdesk-0.1.1",
      registryHash: "hash-registry-1",
      policyPackHash: "hash-policy-1",
      authAccountBoundaryRef: "account-1"
    });
    assert.equal(selected.state, "pair_ready", selected.errors.join("; "));
    assert.equal(selected.cache?.entries[0].provider_qualified_model_id, "claude/claude-opus-4-5");
    assert.equal(selected.cache?.entries[0].availability_ref, "availability-live-1");
    assert.equal(selected.cacheRefreshPlan?.cache_id, "cache-from-acquisition-1");
  });
});

test("session evidence cache materialization blocks ambiguous acquisition and duplicate targets before writes", () => {
  withEvidenceTree((rootDir) => {
    writeEvidenceFile(rootDir, sessionEvidenceRecordPath(workflowId, "exact_model_availability_cache_provider_acquisition_result", "provider-acquisition-one"), JSON.stringify(exactModelAvailabilityCacheProviderAcquisitionResultRecord({ result_id: "provider-acquisition-result-1" })));
    writeEvidenceFile(rootDir, sessionEvidenceRecordPath(workflowId, "exact_model_availability_cache_provider_acquisition_result", "provider-acquisition-two"), JSON.stringify(exactModelAvailabilityCacheProviderAcquisitionResultRecord({ result_id: "provider-acquisition-result-2", availability_ref: "availability-live-2" })));
    const reloaded = reloadFlowDeskSessionEvidenceV1({ workflowId, rootDir });
    const ambiguous = materializeFlowDeskExactModelCacheEvidenceFromProviderAcquisitionEvidenceV1({
      reloadedEvidence: reloaded,
      workflowId,
      targetCacheEvidenceId: "cache-from-acquisition-1",
      targetCacheRefreshPlanEvidenceId: "cache-refresh-from-acquisition-1",
      localDate: "2026-05-19",
      activeProfileRef: "profile-1",
      opencodeVersionRef: "opencode-1.15.6",
      flowdeskPackageVersionRef: "flowdesk-0.1.1",
      registryHash: "hash-registry-1",
      policyPackHash: "hash-policy-1",
      authAccountBoundaryRef: "account-1",
      rootDir
    });
    assert.equal(ambiguous.state, "blocked");
    assert.ok(ambiguous.blocked_labels.includes("provider_acquisition_evidence_ambiguous"));
    assert.equal(ambiguous.writeIntents.length, 0);
    assert.equal(reloadFlowDeskSessionEvidenceV1({ workflowId, rootDir }).entries.length, 2);
  });

  withEvidenceTree((rootDir) => {
    writeEvidenceFile(rootDir, sessionEvidenceRecordPath(workflowId, "exact_model_availability_cache_provider_acquisition_result", "provider-acquisition-good"), JSON.stringify(exactModelAvailabilityCacheProviderAcquisitionResultRecord()));
    writeEvidenceFile(rootDir, sessionEvidenceRecordPath(workflowId, "exact_model_availability_cache", "cache-from-acquisition-1"), JSON.stringify(exactModelAvailabilityCacheRecord({ cache_id: "cache-from-acquisition-1" })));
    const reloaded = reloadFlowDeskSessionEvidenceV1({ workflowId, rootDir });
    const duplicate = materializeFlowDeskExactModelCacheEvidenceFromProviderAcquisitionEvidenceV1({
      reloadedEvidence: reloaded,
      workflowId,
      providerAcquisitionEvidenceId: "provider-acquisition-good",
      targetCacheEvidenceId: "cache-from-acquisition-1",
      targetCacheRefreshPlanEvidenceId: "cache-refresh-from-acquisition-1",
      cacheId: "cache-from-acquisition-1",
      entryId: "entry-from-acquisition-1",
      localDate: "2026-05-19",
      activeProfileRef: "profile-1",
      opencodeVersionRef: "opencode-1.15.6",
      flowdeskPackageVersionRef: "flowdesk-0.1.1",
      registryHash: "hash-registry-1",
      policyPackHash: "hash-policy-1",
      authAccountBoundaryRef: "account-1",
      rootDir
    });
    assert.equal(duplicate.state, "blocked");
    assert.ok(duplicate.blocked_labels.includes("target_cache_evidence_duplicate"));
    assert.equal(duplicate.writeIntents.length, 0);
    const after = reloadFlowDeskSessionEvidenceV1({ workflowId, rootDir });
    assert.equal(after.entries.length, 2);
    assert.equal(after.entries.filter((entry) => entry.evidenceClass === "exact_model_availability_cache_refresh_plan").length, 0);
  });
});

test("session evidence selector blocks missing ambiguous or drifted exact-model cache evidence", () => {
  withEvidenceTree((rootDir) => {
    writeEvidenceFile(rootDir, sessionEvidenceRecordPath(workflowId, "exact_model_availability_cache", "cache-good"), JSON.stringify(exactModelAvailabilityCacheRecord()));
    writeEvidenceFile(rootDir, sessionEvidenceRecordPath(workflowId, "exact_model_availability_cache_refresh_plan", "cache-refresh-drift"), JSON.stringify(exactModelAvailabilityCacheRefreshPlanRecord({ expected_policy_pack_hash: "hash-policy-other" })));
    const reloaded = reloadFlowDeskSessionEvidenceV1({ workflowId, rootDir });
    const drift = selectFlowDeskExactModelCacheEvidencePairV1({
      reloadedEvidence: reloaded,
      localDate: "2026-05-19",
      activeProfileRef: "profile-1",
      opencodeVersionRef: "opencode-1.15.6",
      flowdeskPackageVersionRef: "flowdesk-0.1.1",
      registryHash: "hash-registry-1",
      policyPackHash: "hash-policy-1",
      authAccountBoundaryRef: "account-1"
    });
    assert.equal(drift.state, "blocked");
    assert.ok(drift.blocked_labels.includes("cache_refresh_pair_missing"));
  });

  withEvidenceTree((rootDir) => {
    writeEvidenceFile(rootDir, sessionEvidenceRecordPath(workflowId, "exact_model_availability_cache", "cache-good"), JSON.stringify(exactModelAvailabilityCacheRecord()));
    writeEvidenceFile(rootDir, sessionEvidenceRecordPath(workflowId, "exact_model_availability_cache_refresh_plan", "cache-refresh-one"), JSON.stringify(exactModelAvailabilityCacheRefreshPlanRecord()));
    writeEvidenceFile(rootDir, sessionEvidenceRecordPath(workflowId, "exact_model_availability_cache_refresh_plan", "cache-refresh-two"), JSON.stringify(exactModelAvailabilityCacheRefreshPlanRecord()));
    const reloaded = reloadFlowDeskSessionEvidenceV1({ workflowId, rootDir });
    const ambiguous = selectFlowDeskExactModelCacheEvidencePairV1({
      reloadedEvidence: reloaded,
      localDate: "2026-05-19",
      activeProfileRef: "profile-1",
      opencodeVersionRef: "opencode-1.15.6",
      flowdeskPackageVersionRef: "flowdesk-0.1.1",
      registryHash: "hash-registry-1",
      policyPackHash: "hash-policy-1",
      authAccountBoundaryRef: "account-1"
    });
    assert.equal(ambiguous.state, "blocked");
    assert.ok(ambiguous.blocked_labels.includes("cache_refresh_pair_ambiguous"));
    assert.equal(ambiguous.cache, undefined);
  });
});

test("session evidence can plan reviewer fanout from selected cache evidence", () => {
  withEvidenceTree((rootDir) => {
    writeEvidenceFile(rootDir, sessionEvidenceRecordPath(workflowId, "exact_model_availability_cache", "cache-good"), JSON.stringify(exactModelAvailabilityCacheRecord()));
    writeEvidenceFile(rootDir, sessionEvidenceRecordPath(workflowId, "exact_model_availability_cache_refresh_plan", "cache-refresh-good"), JSON.stringify(exactModelAvailabilityCacheRefreshPlanRecord()));
    const reloaded = reloadFlowDeskSessionEvidenceV1({ workflowId, rootDir });
    const plan = planFlowDeskReviewerFanoutFromReloadedCacheEvidenceV1({
      reloadedEvidence: reloaded,
      localDate: "2026-05-19",
      activeProfileRef: "profile-1",
      opencodeVersionRef: "opencode-1.15.6",
      flowdeskPackageVersionRef: "flowdesk-0.1.1",
      registryHash: "hash-registry-1",
      policyPackHash: "hash-policy-1",
      authAccountBoundaryRef: "account-1",
      workflowId,
      attemptId: "attempt-1",
      parentSessionRef: "ses-parent-1",
      agentRef: "agent-reviewer",
      requestedAt: "2026-05-19T00:01:00.000Z",
      preLaunchAuditRef: "audit-pre-launch-1",
      laneLaunchApprovalRef: "approval-lane-launch-1"
    });
    assert.equal(plan.state, "fanout_ready", plan.errors.join("; "));
    assert.equal(plan.selection.state, "pair_ready");
    assert.equal(plan.revalidation.state, "revalidated");
    assert.equal(plan.fanoutPlan.state, "fanout_ready");
    assert.equal(plan.fanoutPlan.runtime_lane_launch_requests.length, 3);
    assert.deepEqual(plan.fanoutPlan.planned_perspectives, ["policy_security", "architecture", "verification_implementation"]);
    assert.equal(plan.dispatch_authority_enabled, false);
    assert.equal(plan.fanoutPlan.launch_attempted, false);
    assert.equal(plan.fanoutPlan.approval_inferred, false);
    assert.equal(plan.providerCall, false);
    assert.equal(plan.actualLaneLaunch, false);
    assert.equal(plan.runtimeExecution, false);
  });
});

test("session evidence blocks reviewer fanout when selected cache evidence is missing or ambiguous", () => {
  withEvidenceTree((rootDir) => {
    writeEvidenceFile(rootDir, sessionEvidenceRecordPath(workflowId, "exact_model_availability_cache", "cache-good"), JSON.stringify(exactModelAvailabilityCacheRecord()));
    writeEvidenceFile(rootDir, sessionEvidenceRecordPath(workflowId, "exact_model_availability_cache_refresh_plan", "cache-refresh-drift"), JSON.stringify(exactModelAvailabilityCacheRefreshPlanRecord({ expected_policy_pack_hash: "hash-policy-other" })));
    const reloaded = reloadFlowDeskSessionEvidenceV1({ workflowId, rootDir });
    const blocked = planFlowDeskReviewerFanoutFromReloadedCacheEvidenceV1({
      reloadedEvidence: reloaded,
      localDate: "2026-05-19",
      activeProfileRef: "profile-1",
      opencodeVersionRef: "opencode-1.15.6",
      flowdeskPackageVersionRef: "flowdesk-0.1.1",
      registryHash: "hash-registry-1",
      policyPackHash: "hash-policy-1",
      authAccountBoundaryRef: "account-1",
      workflowId,
      attemptId: "attempt-1",
      parentSessionRef: "ses-parent-1",
      agentRef: "agent-reviewer",
      requestedAt: "2026-05-19T00:01:00.000Z"
    });
    assert.equal(blocked.state, "blocked");
    assert.equal(blocked.selection.state, "blocked");
    assert.ok(blocked.blocked_labels.includes("cache_refresh_pair_missing"));
    assert.ok(blocked.revalidation.blocked_labels.includes("cache_evidence_pair_selection_blocked"));
    assert.ok(blocked.fanoutPlan.blocked_labels.includes("assignment_revalidation_blocked"));
    assert.equal(blocked.fanoutPlan.runtime_lane_launch_requests.length, 0);
    assert.equal(blocked.providerCall, false);
    assert.equal(blocked.actualLaneLaunch, false);
  });

  withEvidenceTree((rootDir) => {
    writeEvidenceFile(rootDir, sessionEvidenceRecordPath(workflowId, "exact_model_availability_cache", "cache-good"), JSON.stringify(exactModelAvailabilityCacheRecord()));
    writeEvidenceFile(rootDir, sessionEvidenceRecordPath(workflowId, "exact_model_availability_cache_refresh_plan", "cache-refresh-one"), JSON.stringify(exactModelAvailabilityCacheRefreshPlanRecord()));
    writeEvidenceFile(rootDir, sessionEvidenceRecordPath(workflowId, "exact_model_availability_cache_refresh_plan", "cache-refresh-two"), JSON.stringify(exactModelAvailabilityCacheRefreshPlanRecord()));
    const reloaded = reloadFlowDeskSessionEvidenceV1({ workflowId, rootDir });
    const ambiguous = planFlowDeskReviewerFanoutFromReloadedCacheEvidenceV1({
      reloadedEvidence: reloaded,
      localDate: "2026-05-19",
      activeProfileRef: "profile-1",
      opencodeVersionRef: "opencode-1.15.6",
      flowdeskPackageVersionRef: "flowdesk-0.1.1",
      registryHash: "hash-registry-1",
      policyPackHash: "hash-policy-1",
      authAccountBoundaryRef: "account-1",
      workflowId,
      attemptId: "attempt-1",
      parentSessionRef: "ses-parent-1",
      agentRef: "agent-reviewer",
      requestedAt: "2026-05-19T00:01:00.000Z"
    });
    assert.equal(ambiguous.state, "blocked");
    assert.ok(ambiguous.blocked_labels.includes("cache_refresh_pair_ambiguous"));
    assert.equal(ambiguous.fanoutPlan.runtime_lane_launch_requests.length, 0);
  });
});

test("session evidence materializes runtime launch plans from reviewer fanout evidence", () => {
  withEvidenceTree((rootDir) => {
    writeEvidenceFile(rootDir, sessionEvidenceRecordPath(workflowId, "reviewer_fanout_plan", "fanout-ready"), JSON.stringify(reviewerFanoutPlanRecord()));
    const reloaded = reloadFlowDeskSessionEvidenceV1({ workflowId, rootDir });
    const result = materializeFlowDeskRuntimeLaneLaunchPlansFromReviewerFanoutEvidenceV1({
      reloadedEvidence: reloaded,
      workflowId,
      reviewerFanoutEvidenceId: "fanout-ready",
      targetLaunchPlanEvidenceIds: ["launch-plan-policy", "launch-plan-architecture", "launch-plan-verification"],
      sdkClientAvailable: true,
      durableEvidenceRootRef: "evidence-root-workflow-1",
      rootDir
    });
    assert.equal(result.state, "materialized", result.errors.join("; "));
    assert.equal(result.launchPlans.length, 3);
    assert.equal(result.launchPlans.every((plan) => plan.state === "launch_ready"), true);
    assert.equal(result.launchPlans.every((plan) => plan.launch_attempted === false), true);
    assert.equal(result.launchPlans.every((plan) => plan.providerCall === false), true);
    assert.equal(result.launchPlans.every((plan) => plan.actualLaneLaunch === false), true);
    assert.equal(result.launchPlans.every((plan) => plan.runtimeExecution === false), true);

    const after = reloadFlowDeskSessionEvidenceV1({ workflowId, rootDir });
    assert.equal(after.ok, true, after.errors.join("; "));
    const launchPlans = after.entries.filter((entry) => entry.evidenceClass === "runtime_lane_launch_plan");
    assert.equal(launchPlans.length, 3);
    assert.deepEqual(new Set(launchPlans.map((entry) => entry.evidenceId)), new Set(["launch-plan-policy", "launch-plan-architecture", "launch-plan-verification"]));
  });
});

test("session evidence blocks runtime launch plan materialization before launch preconditions or duplicate targets", () => {
  withEvidenceTree((rootDir) => {
    writeEvidenceFile(rootDir, sessionEvidenceRecordPath(workflowId, "reviewer_fanout_plan", "fanout-ready"), JSON.stringify(reviewerFanoutPlanRecord()));
    const reloaded = reloadFlowDeskSessionEvidenceV1({ workflowId, rootDir });
    const missingSdk = materializeFlowDeskRuntimeLaneLaunchPlansFromReviewerFanoutEvidenceV1({
      reloadedEvidence: reloaded,
      workflowId,
      reviewerFanoutEvidenceId: "fanout-ready",
      targetLaunchPlanEvidenceIds: ["launch-plan-policy", "launch-plan-architecture", "launch-plan-verification"],
      durableEvidenceRootRef: "evidence-root-workflow-1",
      rootDir
    });
    assert.equal(missingSdk.state, "blocked");
    assert.ok(missingSdk.blocked_labels.includes("sdk_client_unavailable"));
    assert.equal(reloadFlowDeskSessionEvidenceV1({ workflowId, rootDir }).entries.filter((entry) => entry.evidenceClass === "runtime_lane_launch_plan").length, 0);

    const first = materializeFlowDeskRuntimeLaneLaunchPlansFromReviewerFanoutEvidenceV1({
      reloadedEvidence: reloaded,
      workflowId,
      reviewerFanoutEvidenceId: "fanout-ready",
      targetLaunchPlanEvidenceIds: ["launch-plan-policy", "launch-plan-architecture", "launch-plan-verification"],
      sdkClientAvailable: true,
      durableEvidenceRootRef: "evidence-root-workflow-1",
      rootDir
    });
    assert.equal(first.state, "materialized", first.errors.join("; "));
    const duplicate = materializeFlowDeskRuntimeLaneLaunchPlansFromReviewerFanoutEvidenceV1({
      reloadedEvidence: reloadFlowDeskSessionEvidenceV1({ workflowId, rootDir }),
      workflowId,
      reviewerFanoutEvidenceId: "fanout-ready",
      targetLaunchPlanEvidenceIds: ["launch-plan-policy", "launch-plan-architecture", "launch-plan-verification"],
      sdkClientAvailable: true,
      durableEvidenceRootRef: "evidence-root-workflow-1",
      rootDir
    });
    assert.equal(duplicate.state, "blocked");
    assert.ok(duplicate.blocked_labels.includes("target_runtime_launch_plan_evidence_duplicate"));
    assert.equal(reloadFlowDeskSessionEvidenceV1({ workflowId, rootDir }).entries.filter((entry) => entry.evidenceClass === "runtime_lane_launch_plan").length, 3);
  });
});

test("session evidence reload validates controlled conformance doc write evidence", () => {
  withEvidenceTree((rootDir) => {
    writeEvidenceFile(rootDir, sessionEvidenceRecordPath(workflowId, "controlled_conformance_doc_write", "controlled-doc-write-good"), JSON.stringify(controlledConformanceDocWriteRecord()));
    writeEvidenceFile(rootDir, sessionEvidenceRecordPath(workflowId, "controlled_conformance_doc_write", "controlled-doc-write-forged"), JSON.stringify(controlledConformanceDocWriteRecord({ providerCall: true })));
    writeEvidenceFile(rootDir, sessionEvidenceRecordPath(workflowId, "controlled_conformance_doc_write", "controlled-doc-write-path"), JSON.stringify(controlledConformanceDocWriteRecord({ artifact_path: "docs/conformance/other.md" })));
    const result = reloadFlowDeskSessionEvidenceV1({ workflowId, rootDir });
    assert.equal(result.entries.length, 1);
    assert.equal(result.entries[0].evidenceClass, "controlled_conformance_doc_write");
    assert.equal(result.blocked.length, 2);
    const reasons = result.blocked.map((entry) => entry.reason).join("|");
    assert.match(reasons, /cannot enable external|artifact_path/);
  });
});

test("session evidence reload validates controlled redacted audit export write evidence", () => {
  withEvidenceTree((rootDir) => {
    writeEvidenceFile(rootDir, sessionEvidenceRecordPath(workflowId, "controlled_redacted_audit_export_write", "controlled-audit-export-write-good"), JSON.stringify(controlledRedactedAuditExportWriteRecord()));
    writeEvidenceFile(rootDir, sessionEvidenceRecordPath(workflowId, "controlled_redacted_audit_export_write", "controlled-audit-export-write-forged"), JSON.stringify(controlledRedactedAuditExportWriteRecord({ providerCall: true })));
    writeEvidenceFile(rootDir, sessionEvidenceRecordPath(workflowId, "controlled_redacted_audit_export_write", "controlled-audit-export-write-path"), JSON.stringify(controlledRedactedAuditExportWriteRecord({ artifact_path: `.flowdesk/sessions/${workflowId}/redacted-audit/other.json` })));
    const result = reloadFlowDeskSessionEvidenceV1({ workflowId, rootDir });
    assert.equal(result.entries.length, 1);
    assert.equal(result.entries[0].evidenceClass, "controlled_redacted_audit_export_write");
    assert.equal(result.blocked.length, 2);
    const reasons = result.blocked.map((entry) => entry.reason).join("|");
    assert.match(reasons, /cannot enable external|artifact_path/);
  });
});

test("session evidence reload validates controlled workspace file write evidence", () => {
  withEvidenceTree((rootDir) => {
    writeEvidenceFile(rootDir, sessionEvidenceRecordPath(workflowId, "controlled_workspace_file_write", "controlled-workspace-write-good"), JSON.stringify(controlledWorkspaceFileWriteRecord()));
    writeEvidenceFile(rootDir, sessionEvidenceRecordPath(workflowId, "controlled_workspace_file_write", "controlled-workspace-write-forged"), JSON.stringify(controlledWorkspaceFileWriteRecord({ providerCall: true })));
    writeEvidenceFile(rootDir, sessionEvidenceRecordPath(workflowId, "controlled_workspace_file_write", "controlled-workspace-write-path"), JSON.stringify(controlledWorkspaceFileWriteRecord({ target_file_path: "../escape.md" })));
    const result = reloadFlowDeskSessionEvidenceV1({ workflowId, rootDir });
    assert.equal(result.entries.length, 1);
    assert.equal(result.entries[0].evidenceClass, "controlled_workspace_file_write");
    assert.equal(result.blocked.length, 2);
    const reasons = result.blocked.map((entry) => entry.reason).join("|");
    assert.match(reasons, /cannot enable external|traversal/);
  });
});

test("session evidence reload validates reviewer verdict and lifecycle evidence", () => {
  withEvidenceTree((rootDir) => {
    writeEvidenceFile(rootDir, sessionEvidenceRecordPath(workflowId, "reviewer_verdict", "verdict-good"), JSON.stringify(reviewerVerdictRecord()));
    writeEvidenceFile(rootDir, sessionEvidenceRecordPath(workflowId, "reviewer_verdict", "verdict-forged"), JSON.stringify(reviewerVerdictRecord({ dispatch_authority_enabled: true })));
    writeEvidenceFile(rootDir, sessionEvidenceRecordPath(workflowId, "reviewer_fanout_plan", "fanout-good"), JSON.stringify(reviewerFanoutPlanRecord()));
    writeEvidenceFile(rootDir, sessionEvidenceRecordPath(workflowId, "reviewer_fanout_plan", "fanout-forged"), JSON.stringify(reviewerFanoutPlanRecord({ actualLaneLaunch: true })));
    writeEvidenceFile(rootDir, sessionEvidenceRecordPath(workflowId, "runtime_lane_launch_plan", "launch-plan-good"), JSON.stringify(runtimeLaneLaunchPlanRecord()));
    writeEvidenceFile(rootDir, sessionEvidenceRecordPath(workflowId, "runtime_lane_launch_plan", "launch-plan-forged"), JSON.stringify(runtimeLaneLaunchPlanRecord({ launch_attempted: true })));
    writeEvidenceFile(rootDir, sessionEvidenceRecordPath(workflowId, "lane_lifecycle", "lane-good"), JSON.stringify(laneLifecycleRecord()));
    writeEvidenceFile(rootDir, sessionEvidenceRecordPath(workflowId, "lane_lifecycle", "lane-no-output-forged"), JSON.stringify(laneLifecycleRecord({ state: "no_output", output_ref: undefined })));
    writeEvidenceFile(rootDir, sessionEvidenceRecordPath(workflowId, "reviewer_lane_conformance", "conformance-good"), JSON.stringify(reviewerLaneConformanceRecord()));
    writeEvidenceFile(rootDir, sessionEvidenceRecordPath(workflowId, "reviewer_lane_conformance", "conformance-forged"), JSON.stringify(reviewerLaneConformanceRecord({ hard_chat_authority_claimed: true })));
    const result = reloadFlowDeskSessionEvidenceV1({ workflowId, rootDir });
    assert.equal(result.entries.length, 5);
    assert.deepEqual(new Set(result.entries.map((entry) => entry.evidenceClass)), new Set(["reviewer_verdict", "reviewer_fanout_plan", "runtime_lane_launch_plan", "lane_lifecycle", "reviewer_lane_conformance"]));
    assert.equal(result.blocked.length, 5);
    assert.match(result.blocked.map((entry) => entry.reason).join("|"), /dispatch_authority_enabled|cannot launch lanes|cannot attempt launch|no-output lane lifecycle records cannot carry|hard chat authority/);
  });
});

test("session evidence reload validates dispatch idempotency snapshots", () => {
  withEvidenceTree((rootDir) => {
    writeEvidenceFile(rootDir, sessionEvidenceRecordPath(workflowId, "dispatch_idempotency", "idempotency-good"), JSON.stringify(dispatchIdempotencyRecord()));
    writeEvidenceFile(rootDir, sessionEvidenceRecordPath(workflowId, "dispatch_idempotency", "idempotency-forged"), JSON.stringify(dispatchIdempotencyRecord({ providerCall: true })));
    const result = reloadFlowDeskSessionEvidenceV1({ workflowId, rootDir });
    assert.equal(result.entries.length, 1);
    assert.equal(result.entries[0].evidenceClass, "dispatch_idempotency");
    assert.equal(result.blocked.length, 1);
    assert.match(result.blocked[0].reason, /cannot enable runtime authority/);
  });
});

test("session evidence materializes prepared dispatch idempotency reservations", () => {
  withEvidenceTree((rootDir) => {
    const reservation = prepareFlowDeskDispatchIdempotencyReservationV1({
      workflowId,
      attemptId: "attempt-1",
      idempotencyKey: "idempotency-1",
      snapshotRef: "idempotency-snapshot-1",
      reservedAt: "2026-05-19T00:01:00.000Z"
    });
    assert.equal(reservation.reservation_prepared, true, reservation.errors.join("; "));
    assert.ok(reservation.snapshot);
    const prepared = prepareFlowDeskSessionEvidenceWriteIntentV1({ workflowId, evidenceId: "idempotency-snapshot-1", record: reservation.snapshot });
    assert.equal(prepared.ok, true, prepared.errors.join("; "));
    assert.ok(prepared.writeIntent);
    const applied = applyFlowDeskSessionEvidenceWriteIntentsV1(rootDir, [prepared.writeIntent]);
    assert.equal(applied.ok, true, applied.errors.join("; "));
    const reloaded = reloadFlowDeskSessionEvidenceV1({ workflowId, rootDir });
    assert.equal(reloaded.ok, true, reloaded.errors.join("; "));
    assert.equal(reloaded.entries.length, 1);
    assert.equal(reloaded.entries[0].evidenceClass, "dispatch_idempotency");
    assert.equal((reloaded.entries[0].record.entries as Array<{ state: string }>)[0].state, "reserved");
  });
});

test("session evidence reload validates configured_verification, sanitized_auth_capture, external_auth_provider_policy, and production_approval shapes", () => {
  withEvidenceTree((rootDir) => {
    const verificationGood = createFlowDeskConfiguredVerificationResultV1({
      verificationRef: "verification-good",
      workflowId,
      result: "passed",
      producedAt: now,
      sourceRef: "configured-verification-source-good",
      checkLabels: ["release_gate"],
      evidenceRefs: ["configured-verification-evidence-good"]
    });
    const captureGood = createFlowDeskSanitizedAuthCaptureResultV1({
      sanitizedAuthCaptureRef: "sanitized-auth-capture-good",
      durableCaptureRef: "durable-capture-good",
      workflowId,
      providerFamily: "claude",
      providerQualifiedModelId: "claude/claude-opus-4-5",
      authProfileRef: "auth-profile-good",
      authEvidenceRef: "auth-evidence-good",
      credentialScopeRef: "principal-scope-claude",
      accountBoundaryRef: "account-boundary-good",
      sanitizerRef: "sanitizer-good",
      sourceRef: "source-good",
      result: "passed",
      capturedAt: now,
      metadataLabels: ["release_gate"]
    });
    const policyGood = createFlowDeskExternalAuthProviderPolicyResultV1({
      externalAuthPolicyRef: "external-auth-policy-good",
      providerPolicyRef: "provider-policy-good",
      workflowId,
      providerFamily: "claude",
      providerQualifiedModelId: "claude/claude-opus-4-5",
      authProfileRef: "auth-profile-good",
      authEvidenceRef: "auth-evidence-good",
      credentialScopeRef: "principal-scope-claude",
      accountBoundaryRef: "account-boundary-good",
      sanitizerRef: "sanitizer-good",
      sourceRef: "source-good",
      result: "passed",
      sanitizedAt: now,
      metadataLabels: ["release_gate"]
    });
    const decisionGood = createFlowDeskProductionApprovalDecisionV1({
      approvalId: "approval-good",
      workflowId,
      decision: "approve",
      createdAt: now,
      requiredEvidenceRefs: ["approval-evidence-good"],
      missingEvidenceLabels: [],
      uncertaintyLabels: []
    });
    writeEvidenceFile(rootDir, sessionEvidenceRecordPath(workflowId, "configured_verification", "verification-good"), JSON.stringify(verificationGood));
    writeEvidenceFile(rootDir, sessionEvidenceRecordPath(workflowId, "configured_verification", "verification-forged"), JSON.stringify({ ...verificationGood, provider_call_made: true }));
    writeEvidenceFile(rootDir, sessionEvidenceRecordPath(workflowId, "sanitized_auth_capture", "capture-good"), JSON.stringify(captureGood));
    writeEvidenceFile(rootDir, sessionEvidenceRecordPath(workflowId, "sanitized_auth_capture", "capture-forged"), JSON.stringify({ ...captureGood, provider_call_made: true }));
    writeEvidenceFile(rootDir, sessionEvidenceRecordPath(workflowId, "external_auth_provider_policy", "policy-good"), JSON.stringify(policyGood));
    writeEvidenceFile(rootDir, sessionEvidenceRecordPath(workflowId, "external_auth_provider_policy", "policy-forged"), JSON.stringify({ ...policyGood, provider_call_made: true }));
    writeEvidenceFile(rootDir, sessionEvidenceRecordPath(workflowId, "production_approval", "decision-good"), JSON.stringify(decisionGood));
    writeEvidenceFile(rootDir, sessionEvidenceRecordPath(workflowId, "production_approval", "decision-forged"), JSON.stringify({ ...decisionGood, decision: "auto_approved" }));
    const result = reloadFlowDeskSessionEvidenceV1({ workflowId, rootDir });
    const accepted = result.entries.map((entry) => entry.evidenceClass).sort();
    assert.deepEqual(accepted, [
      "configured_verification",
      "external_auth_provider_policy",
      "production_approval",
      "sanitized_auth_capture"
    ]);
    const blockedClasses = result.blocked.map((blocked) => blocked.evidenceClass).sort();
    assert.deepEqual(blockedClasses, [
      "configured_verification",
      "external_auth_provider_policy",
      "production_approval",
      "sanitized_auth_capture"
    ]);
  });
});

test("session evidence reload validates durable production approval sources", () => {
  withEvidenceTree((rootDir) => {
    writeEvidenceFile(rootDir, sessionEvidenceRecordPath(workflowId, "production_approval_source", "approval-good"), JSON.stringify(productionApprovalSourceRecord()));
    writeEvidenceFile(rootDir, sessionEvidenceRecordPath(workflowId, "production_approval_source", "approval-forged"), JSON.stringify(productionApprovalSourceRecord({ dispatch_authority_enabled: true })));
    writeEvidenceFile(rootDir, sessionEvidenceRecordPath(workflowId, "production_approval_source", "approval-profile"), JSON.stringify(productionApprovalSourceRecord({ profile_ref: "profile-other" })));
    const result = reloadFlowDeskSessionEvidenceV1({ workflowId, rootDir, expectedProfileRef: "principal-scope-claude" });
    assert.equal(result.entries.length, 1);
    assert.equal(result.entries[0].evidenceClass, "production_approval_source");
    assert.equal(result.blocked.length, 2);
    const reasons = result.blocked.map((blocked) => blocked.reason).join("|");
    assert.match(reasons, /cannot enable dispatch authority/);
    assert.match(reasons, /profile_ref mismatch/);
  });
});

test("session evidence apply prevalidates forged intents before writing any entries", () => {
  withEvidenceTree((rootDir) => {
    const first = prepareFlowDeskSessionEvidenceWriteIntentV1({ workflowId, evidenceId: "evidence-1", record: usageAuthorityRecord() });
    const forged = prepareFlowDeskSessionEvidenceWriteIntentV1({ workflowId, evidenceId: "evidence-2", record: runtimeEchoRecord() });
    assert.ok(first.writeIntent);
    assert.ok(forged.writeIntent);
    const applied = applyFlowDeskSessionEvidenceWriteIntentsV1(rootDir, [
      first.writeIntent,
      { ...forged.writeIntent, path: sessionEvidenceRecordPath(workflowId, "runtime_echo", "evidence-other") }
    ]);
    assert.equal(applied.ok, false);
    assert.equal(applied.writtenPaths.length, 0);
    assert.match(applied.errors.join("; "), /path does not match/);

    const reloaded = reloadFlowDeskSessionEvidenceV1({ workflowId, rootDir });
    assert.equal(reloaded.entries.length, 0);
  });
});

test("session evidence apply rejects duplicate target paths before writing", () => {
  withEvidenceTree((rootDir) => {
    const first = prepareFlowDeskSessionEvidenceWriteIntentV1({ workflowId, evidenceId: "evidence-1", record: usageAuthorityRecord() });
    const second = prepareFlowDeskSessionEvidenceWriteIntentV1({ workflowId, evidenceId: "evidence-1", record: usageAuthorityRecord({ authority_ref: "authority-ref-2" }) });
    assert.ok(first.writeIntent);
    assert.ok(second.writeIntent);
    const duplicateTarget = applyFlowDeskSessionEvidenceWriteIntentsV1(rootDir, [first.writeIntent, second.writeIntent]);
    assert.equal(duplicateTarget.ok, false);
    assert.match(duplicateTarget.errors.join("; "), /duplicate target path/);
    assert.deepEqual(duplicateTarget.writtenPaths, []);
  });
});

test("session evidence apply rejects escaping temp paths", () => {
  withEvidenceTree((rootDir) => {
    const prepared = prepareFlowDeskSessionEvidenceWriteIntentV1({ workflowId, evidenceId: "evidence-1", record: usageAuthorityRecord() });
    assert.ok(prepared.writeIntent);
    const applied = applyFlowDeskSessionEvidenceWriteIntentsV1(rootDir, [{ ...prepared.writeIntent, tempPath: `${prepared.writeIntent.path}.tmp-../../escape` }]);
    assert.equal(applied.ok, false);
    assert.deepEqual(applied.writtenPaths, []);
  });
});

test("session evidence reload accepts a valid oi_session_summary record", () => {
  withEvidenceTree((rootDir) => {
    writeEvidenceFile(rootDir, sessionEvidenceRecordPath(workflowId, "oi_session_summary", "summary-good"), JSON.stringify(oiSessionSummaryRecord()));
    const result = reloadFlowDeskSessionEvidenceV1({ workflowId, rootDir });
    assert.equal(result.ok, true, result.errors.join("; "));
    assert.equal(result.entries.length, 1);
    assert.equal(result.entries[0].evidenceClass, "oi_session_summary");
    assert.equal(result.entries[0].evidenceId, "summary-good");
    assert.equal(result.blocked.length, 0);
    assert.equal(result.providerCall, false);
    assert.equal(result.actualLaneLaunch, false);
    assert.equal(result.runtimeExecution, false);
  });
});

test("session evidence reload rejects oi_session_summary with forged authority flag", () => {
  withEvidenceTree((rootDir) => {
    writeEvidenceFile(rootDir, sessionEvidenceRecordPath(workflowId, "oi_session_summary", "summary-forged"), JSON.stringify(oiSessionSummaryRecord({ dispatch_authority_enabled: true })));
    const result = reloadFlowDeskSessionEvidenceV1({ workflowId, rootDir });
    assert.equal(result.entries.length, 0);
    assert.equal(result.blocked.length, 1);
    assert.match(result.blocked[0].reason, /advisory-only|dispatch|authority/i);
    assert.equal(result.providerCall, false);
    assert.equal(result.actualLaneLaunch, false);
  });
});

test("session evidence write intent rejects oi_session_summary with unknown schema_version", () => {
  const result = prepareFlowDeskSessionEvidenceWriteIntentV1({
    workflowId,
    evidenceId: "summary-bad-schema",
    record: oiSessionSummaryRecord({ schema_version: "flowdesk.oi_session_summary.v2" })
  });
  assert.equal(result.ok, false);
  assert.ok(result.errors.some((e) => /schema_version|not a managed|oi_session_summary/.test(e)), `expected schema error but got: ${result.errors.join("; ")}`);
});

function withEvidenceTree(callback: (rootDir: string) => void): void {
  const rootDir = mkdtempSync(join(tmpdir(), "flowdesk-evidence-"));
  try {
    callback(rootDir);
  } finally {
    rmSync(rootDir, { recursive: true, force: true });
  }
}

function writeEvidenceFile(rootDir: string, relativePath: string, content: string): void {
  const absolute = join(rootDir, relativePath);
  mkdirSync(join(absolute, ".."), { recursive: true });
  writeFileSync(absolute, content, "utf8");
}

test("session evidence reload returns empty entries when the directory does not exist", () => {
  withEvidenceTree((rootDir) => {
    const result = reloadFlowDeskSessionEvidenceV1({ workflowId, rootDir });
    assert.equal(result.ok, true);
    assert.deepEqual(result.entries, []);
    assert.deepEqual(result.blocked, []);
    assert.equal(result.realOpenCodeDispatch, false);
  });
});

test("session evidence reload reads validated records and ignores valid foreign files", () => {
  withEvidenceTree((rootDir) => {
    writeEvidenceFile(rootDir, sessionEvidenceRecordPath(workflowId, "usage_authority", "evidence-1"), JSON.stringify(usageAuthorityRecord()));
    writeEvidenceFile(rootDir, sessionEvidenceRecordPath(workflowId, "runtime_echo", "evidence-1"), JSON.stringify(runtimeEchoRecord()));
    writeEvidenceFile(rootDir, sessionEvidenceRecordPath(workflowId, "telemetry_correlation", "evidence-1"), JSON.stringify(telemetryRecord()));
    const result = reloadFlowDeskSessionEvidenceV1({ workflowId, rootDir });
    assert.equal(result.ok, true, result.errors.join("; "));
    assert.equal(result.entries.length, 3);
    const classes = new Set(result.entries.map((entry) => entry.evidenceClass));
    assert.deepEqual([...classes].sort(), ["runtime_echo", "telemetry_correlation", "usage_authority"]);
  });
});

test("session evidence reload fails closed on malformed JSON and schema mismatch", () => {
  withEvidenceTree((rootDir) => {
    writeEvidenceFile(rootDir, sessionEvidenceRecordPath(workflowId, "usage_authority", "evidence-malformed"), "{not json");
    writeEvidenceFile(rootDir, sessionEvidenceRecordPath(workflowId, "runtime_echo", "evidence-mismatch"), JSON.stringify(usageAuthorityRecord()));
    writeEvidenceFile(rootDir, sessionEvidenceRecordPath(workflowId, "telemetry_correlation", "evidence-workflow"), JSON.stringify(telemetryRecord({ workflow_id: "workflow-other" })));
    const result = reloadFlowDeskSessionEvidenceV1({ workflowId, rootDir });
    assert.equal(result.entries.length, 0);
    assert.equal(result.blocked.length, 3);
    const reasons = result.blocked.map((blocked) => blocked.reason).join("|");
    assert.match(reasons, /JSON|json|parse/);
    assert.match(reasons, /schema_version/);
    assert.match(reasons, /workflow_id mismatch/);
    assert.equal(result.realOpenCodeDispatch, false);
    assert.equal(result.actualLaneLaunch, false);
  });
});

test("session evidence reload rejects path-shaped evidence_id and root escape", () => {
  withEvidenceTree((rootDir) => {
    const traversalFile = join(rootDir, sessionEvidenceDirectoryPath(workflowId, "usage_authority"), "..escape.json");
    mkdirSync(join(traversalFile, ".."), { recursive: true });
    writeFileSync(traversalFile, JSON.stringify(usageAuthorityRecord()), "utf8");
    const result = reloadFlowDeskSessionEvidenceV1({ workflowId, rootDir });
    assert.equal(result.entries.length, 0);
    assert.equal(result.blocked.length, 1);
    assert.match(result.blocked[0].reason, /not schema-safe|outside 3..128|must not contain paths/);
  });
});

test("session evidence reload fails closed when evidence root is a symlink to outside", () => {
  withEvidenceTree((rootDir) => {
    const evidenceDir = join(rootDir, sessionEvidenceDirectoryPath(workflowId, "telemetry_correlation"));
    mkdirSync(join(evidenceDir, ".."), { recursive: true });
    const outside = mkdtempSync(join(tmpdir(), "flowdesk-evidence-outside-"));
    try {
      writeFileSync(join(outside, "evidence-outside.json"), JSON.stringify(telemetryRecord()), "utf8");
      symlinkSync(outside, evidenceDir, "dir");
      const result = reloadFlowDeskSessionEvidenceV1({ workflowId, rootDir });
      assert.equal(result.entries.length, 0);
      assert.equal(result.errors.length === 0 ? result.blocked.length > 0 : true, true);
    } finally {
      rmSync(outside, { recursive: true, force: true });
    }
  });
});

test("session evidence reload can reject stale and cross-profile evidence", () => {
  withEvidenceTree((rootDir) => {
    writeEvidenceFile(rootDir, sessionEvidenceRecordPath(workflowId, "usage_authority", "evidence-stale"), JSON.stringify(usageAuthorityRecord({ expires_at: "2026-05-19T00:01:00.000Z" })));
    writeEvidenceFile(rootDir, sessionEvidenceRecordPath(workflowId, "runtime_echo", "evidence-profile"), JSON.stringify(runtimeEchoRecord({ auth_profile_ref: "profile-other", expires_at: "2026-05-22T00:01:00.000Z" })));
    const result = reloadFlowDeskSessionEvidenceV1({ workflowId, rootDir, rejectStaleAt: "2026-05-20T00:00:00.000Z", expectedProfileRef: "principal-scope-claude" });
    assert.equal(result.entries.length, 0);
    assert.equal(result.blocked.length, 2);
    const reasons = result.blocked.map((blocked) => blocked.reason).join("|");
    assert.match(reasons, /stale/);
    assert.match(reasons, /profile_ref mismatch/);
  });
});

test("session evidence reload blocks redaction failures and reports inventory", () => {
  withEvidenceTree((rootDir) => {
    writeEvidenceFile(rootDir, sessionEvidenceRecordPath(workflowId, "telemetry_correlation", "evidence-redacted"), JSON.stringify(telemetryRecord({ source_refs: ["Bearer secret-token"] })));
    const result = reloadFlowDeskSessionEvidenceV1({ workflowId, rootDir });
    assert.equal(result.entries.length, 0);
    assert.equal(result.blocked.length, 1);
    assert.match(result.blocked[0].reason, /forbidden raw payload|token|credential-shaped/i);

    const inventory = summarizeFlowDeskSessionEvidenceInventoryV1(workflowId, result);
    assert.equal(inventory.schema_version, "flowdesk.session_evidence_inventory.v1");
    assert.equal(inventory.total_entries, 0);
    assert.equal(inventory.total_blocked, 1);
    assert.equal(inventory.providerCall, false);
    const telemetry = inventory.classes.find((entry) => entry.evidenceClass === "telemetry_correlation");
    assert.equal(telemetry?.blocked, 1);
    assert.match(telemetry?.lastBlockedReason ?? "", /forbidden raw payload|token|credential-shaped/i);
  });
});

// ─── R3-S2.3: New evidence class tests ───────────────────────────────────────

function blockDecompositionRecord(overrides: Record<string, unknown> = {}) {
  return {
    schema_version: "flowdesk.block_decomposition.v1",
    decomposition_id: "decomp-1",
    parent_block_id: "block-parent-1",
    parent_block_scoring_ref: "scoring-ref-parent-1",
    trigger_score: 52,
    trigger_condition_met: "score_gte_50",
    trigger_dimensions_met: ["scope"],
    sub_blocks: [
      {
        sub_block_id: "sub-block-a-1",
        sub_block_label: "sub-block-a",
        estimated_scope: 5,
        estimated_complexity: 4,
        estimated_coupling: 3,
        estimated_authority_sensitivity: 2,
        estimated_novelty: 3,
        estimated_category: "implementation",
        estimated_block_score: 28.5,
      },
      {
        sub_block_id: "sub-block-b-1",
        sub_block_label: "sub-block-b",
        estimated_scope: 4,
        estimated_complexity: 3,
        estimated_coupling: 2,
        estimated_authority_sensitivity: 1,
        estimated_novelty: 2,
        estimated_category: "verification",
        estimated_block_score: 20.0,
      },
    ],
    current_depth: 0,
    max_depth: 1,
    coverage_review_quorum_required: 1,
    coverage_verdict_refs: [],
    structural_coverage_pass: false,
    status: "draft",
    decomposition_model_selection_ref: "model-sel-decomp-1",
    non_inheriting_parent_authority: true,
    advisory_only: true,
    non_authorizing: true,
    release_gate: "operational_intelligence_later_gate",
    dispatch_authority_enabled: false,
    approval_authority_enabled: false,
    provider_authority_enabled: false,
    runtime_authority_enabled: false,
    external_write_authority_enabled: false,
    remote_write_authority_enabled: false,
    fallback_authority_enabled: false,
    lane_launch_authority_enabled: false,
    write_authority_enabled: false,
    hard_chat_authority_enabled: false,
    model_selection_authority_enabled: false,
    ranking_authority_enabled: false,
    ...overrides,
  };
}

function blockDecompositionFailureRecord(overrides: Record<string, unknown> = {}) {
  return {
    schema_version: "flowdesk.block_decomposition_failure.v1",
    failure_id: "failure-decomp-1",
    decomposition_attempt_id: "attempt-decomp-1",
    parent_block_scoring_ref: "scoring-ref-failure-parent-1",
    failure_reason: "model_error",
    failed_at: now,
    retry_allowed: true,
    advisory_only: true,
    non_authorizing: true,
    release_gate: "operational_intelligence_later_gate",
    dispatch_authority_enabled: false,
    approval_authority_enabled: false,
    provider_authority_enabled: false,
    runtime_authority_enabled: false,
    external_write_authority_enabled: false,
    remote_write_authority_enabled: false,
    fallback_authority_enabled: false,
    lane_launch_authority_enabled: false,
    write_authority_enabled: false,
    hard_chat_authority_enabled: false,
    model_selection_authority_enabled: false,
    ranking_authority_enabled: false,
    ...overrides,
  };
}

function blockScoreReconciliationRecord(overrides: Record<string, unknown> = {}) {
  return {
    schema_version: "flowdesk.block_score_reconciliation.v1",
    reconciliation_id: "reconcile-1",
    decomposition_ref: "decomp-ref-reconcile-1",
    sub_block_id: "sub-block-reconcile-1",
    fresh_scoring_ref: "scoring-ref-fresh-1",
    diverged_dimensions: ["scope"],
    dimension_deltas: { scope: 1.5 },
    max_divergence: 1.5,
    authority_sensitivity_increased: false,
    action_required: "accept_fresh",
    advisory_only: true,
    non_authorizing: true,
    release_gate: "operational_intelligence_later_gate",
    dispatch_authority_enabled: false,
    approval_authority_enabled: false,
    provider_authority_enabled: false,
    runtime_authority_enabled: false,
    external_write_authority_enabled: false,
    remote_write_authority_enabled: false,
    fallback_authority_enabled: false,
    lane_launch_authority_enabled: false,
    write_authority_enabled: false,
    hard_chat_authority_enabled: false,
    model_selection_authority_enabled: false,
    ranking_authority_enabled: false,
    ...overrides,
  };
}

function proposalGeneratorConfigRecord(overrides: Record<string, unknown> = {}) {
  return {
    schema_version: "flowdesk.proposal_generator_config.v1",
    config_id: "config-propgen-1",
    block_id: "block-propgen-1",
    block_scoring_ref: "scoring-ref-propgen-1",
    workflow_id: workflowId,
    is_sub_block: false,
    decompose_threshold_met: false,
    review_tier: "dual",
    review_tier_basis: "standard-dual-review",
    cost_budget_hint: "moderate",
    generation_strategy: "parallel",
    proposal_model_selection_ref: "model-sel-propgen-1",
    advisory_only: true,
    non_authorizing: true,
    release_gate: "operational_intelligence_later_gate",
    dispatch_authority_enabled: false,
    approval_authority_enabled: false,
    provider_authority_enabled: false,
    runtime_authority_enabled: false,
    external_write_authority_enabled: false,
    remote_write_authority_enabled: false,
    fallback_authority_enabled: false,
    lane_launch_authority_enabled: false,
    write_authority_enabled: false,
    hard_chat_authority_enabled: false,
    model_selection_authority_enabled: false,
    ranking_authority_enabled: false,
    ...overrides,
  };
}

function blockHierarchyRecord(overrides: Record<string, unknown> = {}) {
  return {
    schema_version: "flowdesk.block_hierarchy.v1",
    hierarchy_id: "hierarchy-1",
    root_block_id: "block-root-1",
    workflow_id: workflowId,
    revision_id: 1,
    nodes: [
      {
        block_id: "block-root-1",
        depth: 0,
        node_status: "pending",
      },
    ],
    total_nodes: 1,
    max_depth: 1,
    status: "pending",
    advisory_only: true,
    non_authorizing: true,
    release_gate: "operational_intelligence_later_gate",
    dispatch_authority_enabled: false,
    approval_authority_enabled: false,
    provider_authority_enabled: false,
    runtime_authority_enabled: false,
    external_write_authority_enabled: false,
    remote_write_authority_enabled: false,
    fallback_authority_enabled: false,
    lane_launch_authority_enabled: false,
    write_authority_enabled: false,
    hard_chat_authority_enabled: false,
    model_selection_authority_enabled: false,
    ranking_authority_enabled: false,
    ...overrides,
  };
}

test("session evidence reload accepts a valid block_decomposition record", () => {
  withEvidenceTree((rootDir) => {
    writeEvidenceFile(rootDir, sessionEvidenceRecordPath(workflowId, "block_decomposition", "decomp-good-1"), JSON.stringify(blockDecompositionRecord()));
    const result = reloadFlowDeskSessionEvidenceV1({ workflowId, rootDir });
    assert.equal(result.ok, true, result.errors.join("; "));
    assert.equal(result.entries.length, 1);
    assert.equal(result.entries[0].evidenceClass, "block_decomposition");
    assert.equal(result.entries[0].evidenceId, "decomp-good-1");
    assert.equal(result.blocked.length, 0);
    assert.equal(result.providerCall, false);
    assert.equal(result.actualLaneLaunch, false);
    assert.equal(result.runtimeExecution, false);
  });
});

test("session evidence reload rejects block_decomposition with forged authority flag", () => {
  withEvidenceTree((rootDir) => {
    writeEvidenceFile(rootDir, sessionEvidenceRecordPath(workflowId, "block_decomposition", "decomp-forged-1"), JSON.stringify(blockDecompositionRecord({ dispatch_authority_enabled: true })));
    const result = reloadFlowDeskSessionEvidenceV1({ workflowId, rootDir });
    assert.equal(result.entries.length, 0);
    assert.equal(result.blocked.length, 1);
    assert.match(result.blocked[0].reason, /dispatch_authority_enabled must be false|advisory-only|authority/i);
    assert.equal(result.providerCall, false);
    assert.equal(result.actualLaneLaunch, false);
  });
});

test("session evidence reload accepts a valid block_decomposition_failure record", () => {
  withEvidenceTree((rootDir) => {
    writeEvidenceFile(rootDir, sessionEvidenceRecordPath(workflowId, "block_decomposition_failure", "failure-good-1"), JSON.stringify(blockDecompositionFailureRecord()));
    const result = reloadFlowDeskSessionEvidenceV1({ workflowId, rootDir });
    assert.equal(result.ok, true, result.errors.join("; "));
    assert.equal(result.entries.length, 1);
    assert.equal(result.entries[0].evidenceClass, "block_decomposition_failure");
    assert.equal(result.entries[0].evidenceId, "failure-good-1");
    assert.equal(result.blocked.length, 0);
    assert.equal(result.providerCall, false);
    assert.equal(result.actualLaneLaunch, false);
    assert.equal(result.runtimeExecution, false);
  });
});

test("session evidence reload rejects block_decomposition_failure with forged authority flag", () => {
  withEvidenceTree((rootDir) => {
    writeEvidenceFile(rootDir, sessionEvidenceRecordPath(workflowId, "block_decomposition_failure", "failure-forged-1"), JSON.stringify(blockDecompositionFailureRecord({ dispatch_authority_enabled: true })));
    const result = reloadFlowDeskSessionEvidenceV1({ workflowId, rootDir });
    assert.equal(result.entries.length, 0);
    assert.equal(result.blocked.length, 1);
    assert.match(result.blocked[0].reason, /dispatch_authority_enabled must be false|advisory-only|authority/i);
    assert.equal(result.providerCall, false);
    assert.equal(result.actualLaneLaunch, false);
  });
});

test("session evidence reload accepts a valid block_score_reconciliation record", () => {
  withEvidenceTree((rootDir) => {
    writeEvidenceFile(rootDir, sessionEvidenceRecordPath(workflowId, "block_score_reconciliation", "reconcile-good-1"), JSON.stringify(blockScoreReconciliationRecord()));
    const result = reloadFlowDeskSessionEvidenceV1({ workflowId, rootDir });
    assert.equal(result.ok, true, result.errors.join("; "));
    assert.equal(result.entries.length, 1);
    assert.equal(result.entries[0].evidenceClass, "block_score_reconciliation");
    assert.equal(result.entries[0].evidenceId, "reconcile-good-1");
    assert.equal(result.blocked.length, 0);
    assert.equal(result.providerCall, false);
    assert.equal(result.actualLaneLaunch, false);
    assert.equal(result.runtimeExecution, false);
  });
});

test("session evidence reload rejects block_score_reconciliation with forged authority flag", () => {
  withEvidenceTree((rootDir) => {
    writeEvidenceFile(rootDir, sessionEvidenceRecordPath(workflowId, "block_score_reconciliation", "reconcile-forged-1"), JSON.stringify(blockScoreReconciliationRecord({ dispatch_authority_enabled: true })));
    const result = reloadFlowDeskSessionEvidenceV1({ workflowId, rootDir });
    assert.equal(result.entries.length, 0);
    assert.equal(result.blocked.length, 1);
    assert.match(result.blocked[0].reason, /dispatch_authority_enabled must be false|advisory-only|authority/i);
    assert.equal(result.providerCall, false);
    assert.equal(result.actualLaneLaunch, false);
  });
});

test("session evidence reload accepts a valid proposal_generator_config record", () => {
  withEvidenceTree((rootDir) => {
    writeEvidenceFile(rootDir, sessionEvidenceRecordPath(workflowId, "proposal_generator_config", "config-good-1"), JSON.stringify(proposalGeneratorConfigRecord()));
    const result = reloadFlowDeskSessionEvidenceV1({ workflowId, rootDir });
    assert.equal(result.ok, true, result.errors.join("; "));
    assert.equal(result.entries.length, 1);
    assert.equal(result.entries[0].evidenceClass, "proposal_generator_config");
    assert.equal(result.entries[0].evidenceId, "config-good-1");
    assert.equal(result.blocked.length, 0);
    assert.equal(result.providerCall, false);
    assert.equal(result.actualLaneLaunch, false);
    assert.equal(result.runtimeExecution, false);
  });
});

test("session evidence reload rejects proposal_generator_config with forged authority flag", () => {
  withEvidenceTree((rootDir) => {
    writeEvidenceFile(rootDir, sessionEvidenceRecordPath(workflowId, "proposal_generator_config", "config-forged-1"), JSON.stringify(proposalGeneratorConfigRecord({ dispatch_authority_enabled: true })));
    const result = reloadFlowDeskSessionEvidenceV1({ workflowId, rootDir });
    assert.equal(result.entries.length, 0);
    assert.equal(result.blocked.length, 1);
    assert.match(result.blocked[0].reason, /dispatch_authority_enabled must be false|advisory-only|authority/i);
    assert.equal(result.providerCall, false);
    assert.equal(result.actualLaneLaunch, false);
  });
});

test("session evidence reload accepts a valid block_hierarchy record", () => {
  withEvidenceTree((rootDir) => {
    writeEvidenceFile(rootDir, sessionEvidenceRecordPath(workflowId, "block_hierarchy", "hierarchy-good-1"), JSON.stringify(blockHierarchyRecord()));
    const result = reloadFlowDeskSessionEvidenceV1({ workflowId, rootDir });
    assert.equal(result.ok, true, result.errors.join("; "));
    assert.equal(result.entries.length, 1);
    assert.equal(result.entries[0].evidenceClass, "block_hierarchy");
    assert.equal(result.entries[0].evidenceId, "hierarchy-good-1");
    assert.equal(result.blocked.length, 0);
    assert.equal(result.providerCall, false);
    assert.equal(result.actualLaneLaunch, false);
    assert.equal(result.runtimeExecution, false);
  });
});

test("session evidence reload rejects block_hierarchy with forged authority flag", () => {
  withEvidenceTree((rootDir) => {
    writeEvidenceFile(rootDir, sessionEvidenceRecordPath(workflowId, "block_hierarchy", "hierarchy-forged-1"), JSON.stringify(blockHierarchyRecord({ dispatch_authority_enabled: true })));
    const result = reloadFlowDeskSessionEvidenceV1({ workflowId, rootDir });
    assert.equal(result.entries.length, 0);
    assert.equal(result.blocked.length, 1);
    assert.match(result.blocked[0].reason, /dispatch_authority_enabled must be false|advisory-only|authority/i);
    assert.equal(result.providerCall, false);
    assert.equal(result.actualLaneLaunch, false);
  });
});
