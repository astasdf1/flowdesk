import assert from "node:assert/strict";
import { mkdirSync, mkdtempSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import {
  applyFlowDeskSessionEvidenceWriteIntentsV1,
  FLOWDESK_SESSION_EVIDENCE_CLASSES,
  prepareFlowDeskDispatchIdempotencyReservationV1,
  prepareFlowDeskSessionEvidenceWriteIntentV1,
  reloadFlowDeskSessionEvidenceV1,
  selectFlowDeskExactModelCacheEvidencePairV1,
  sessionEvidenceDirectoryPath,
  sessionEvidenceRecordPath,
  summarizeFlowDeskSessionEvidenceInventoryV1
} from "./index.js";

const workflowId = "workflow-evidence-1";

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
    lane_plan_ref: "lane-plan-policy-security-1",
    binding_ref: "binding-reviewer-1",
    perspective: "policy_security",
    source: "claude_opus",
    created_at: "2026-05-19T00:02:00.000Z",
    redaction_version: "redaction-v1",
    findings: [],
    evidence_refs: ["lane-evidence-policy-security-1"],
    uncertainty: "low",
    required_fixes: [],
    verdict_label: "pass",
    safe_next_actions: ["/flowdesk-status"],
    dispatch_authority_enabled: false,
    ...overrides
  };
}

function reviewerFanoutPlanRecord(overrides: Record<string, unknown> = {}) {
  return {
    schema_version: "flowdesk.reviewer_fanout_plan.v1",
    ok: true,
    errors: [],
    workflow_id: workflowId,
    attempt_id: "attempt-1",
    cache_id: "cache-1",
    state: "fanout_ready",
    blocked_labels: [],
    required_perspectives: ["policy_security", "architecture", "verification_implementation"],
    planned_perspectives: ["policy_security", "architecture", "verification_implementation"],
    runtime_lane_launch_requests: ["policy_security", "architecture", "verification_implementation"].map((perspective) => ({
      schema_version: "flowdesk.runtime_lane_launch_request.v1",
      launch_request_id: `reviewer-launch-attempt-1-${perspective}`,
      workflow_id: workflowId,
      attempt_id: "attempt-1",
      lane_id: `reviewer-lane-attempt-1-${perspective}`,
      parent_session_ref: "ses-parent-1",
      agent_ref: "agent-reviewer",
      provider_qualified_model_id: "claude/claude-opus-4-5",
      launch_reason: "reviewer_fanout",
      pre_launch_audit_ref: "audit-pre-launch-1",
      lane_launch_approval_ref: "approval-lane-launch-1",
      requested_at: "2026-05-19T00:01:00.000Z",
      timeout_ms: 30000,
      orphan_max_age_ms: 60000,
      retry_budget: 1,
      dispatch_authority_enabled: false,
      providerCall: false,
      actualLaneLaunch: false,
      runtimeExecution: false
    })),
    max_concurrent_lane_count: 3,
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

function exactModelAvailabilityCacheRefreshPlanRecord(overrides: Record<string, unknown> = {}) {
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
    const records = [usageAuthorityRecord(), runtimeEchoRecord(), telemetryRecord(), productionApprovalSourceRecord(), dispatchIdempotencyRecord(), preDispatchAuditRecord(), exactModelAvailabilityCacheRecord(), exactModelAvailabilityCacheRefreshPlanRecord(), reviewerVerdictRecord(), reviewerFanoutPlanRecord(), laneLifecycleRecord(), reviewerLaneConformanceRecord(), controlledConformanceDocWriteRecord(), controlledRedactedAuditExportWriteRecord()];
    const intents = records.map((record, index) => {
      const prepared = prepareFlowDeskSessionEvidenceWriteIntentV1({ workflowId, evidenceId: `evidence-${index + 1}`, record });
      assert.equal(prepared.ok, true, prepared.errors.join("; "));
      assert.ok(prepared.writeIntent);
      return prepared.writeIntent;
    });

    const applied = applyFlowDeskSessionEvidenceWriteIntentsV1(rootDir, intents);
    assert.equal(applied.ok, true, applied.errors.join("; "));
    assert.equal(applied.writtenPaths.length, 14);
    assert.equal(applied.providerCall, false);
    assert.equal(applied.runtimeExecution, false);

    const reloaded = reloadFlowDeskSessionEvidenceV1({ workflowId, rootDir });
    assert.equal(reloaded.ok, true, reloaded.errors.join("; "));
    assert.equal(reloaded.entries.length, 14);
    assert.deepEqual(new Set(reloaded.entries.map((entry) => entry.evidenceClass)), new Set(["usage_authority", "runtime_echo", "telemetry_correlation", "production_approval_source", "dispatch_idempotency", "pre_dispatch_audit", "exact_model_availability_cache", "exact_model_availability_cache_refresh_plan", "reviewer_verdict", "reviewer_fanout_plan", "lane_lifecycle", "reviewer_lane_conformance", "controlled_conformance_doc_write", "controlled_redacted_audit_export_write"]));
  });
});

test("session evidence reload validates exact-model cache and refresh-plan evidence", () => {
  withEvidenceTree((rootDir) => {
    writeEvidenceFile(rootDir, sessionEvidenceRecordPath(workflowId, "exact_model_availability_cache", "cache-good"), JSON.stringify(exactModelAvailabilityCacheRecord()));
    writeEvidenceFile(rootDir, sessionEvidenceRecordPath(workflowId, "exact_model_availability_cache", "cache-forged"), JSON.stringify(exactModelAvailabilityCacheRecord({ providerCall: true })));
    writeEvidenceFile(rootDir, sessionEvidenceRecordPath(workflowId, "exact_model_availability_cache_refresh_plan", "cache-refresh-good"), JSON.stringify(exactModelAvailabilityCacheRefreshPlanRecord()));
    writeEvidenceFile(rootDir, sessionEvidenceRecordPath(workflowId, "exact_model_availability_cache_refresh_plan", "cache-refresh-forged"), JSON.stringify(exactModelAvailabilityCacheRefreshPlanRecord({ refresh_attempted: true })));
    const result = reloadFlowDeskSessionEvidenceV1({ workflowId, rootDir });
    assert.equal(result.entries.length, 2);
    assert.deepEqual(new Set(result.entries.map((entry) => entry.evidenceClass)), new Set(["exact_model_availability_cache", "exact_model_availability_cache_refresh_plan"]));
    assert.equal(result.blocked.length, 2);
    assert.match(result.blocked.map((entry) => entry.reason).join("|"), /cannot enable runtime authority|cannot attempt discovery/);
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

test("session evidence reload validates reviewer verdict and lifecycle evidence", () => {
  withEvidenceTree((rootDir) => {
    writeEvidenceFile(rootDir, sessionEvidenceRecordPath(workflowId, "reviewer_verdict", "verdict-good"), JSON.stringify(reviewerVerdictRecord()));
    writeEvidenceFile(rootDir, sessionEvidenceRecordPath(workflowId, "reviewer_verdict", "verdict-forged"), JSON.stringify(reviewerVerdictRecord({ dispatch_authority_enabled: true })));
    writeEvidenceFile(rootDir, sessionEvidenceRecordPath(workflowId, "reviewer_fanout_plan", "fanout-good"), JSON.stringify(reviewerFanoutPlanRecord()));
    writeEvidenceFile(rootDir, sessionEvidenceRecordPath(workflowId, "reviewer_fanout_plan", "fanout-forged"), JSON.stringify(reviewerFanoutPlanRecord({ actualLaneLaunch: true })));
    writeEvidenceFile(rootDir, sessionEvidenceRecordPath(workflowId, "lane_lifecycle", "lane-good"), JSON.stringify(laneLifecycleRecord()));
    writeEvidenceFile(rootDir, sessionEvidenceRecordPath(workflowId, "lane_lifecycle", "lane-no-output-forged"), JSON.stringify(laneLifecycleRecord({ state: "no_output", output_ref: undefined })));
    writeEvidenceFile(rootDir, sessionEvidenceRecordPath(workflowId, "reviewer_lane_conformance", "conformance-good"), JSON.stringify(reviewerLaneConformanceRecord()));
    writeEvidenceFile(rootDir, sessionEvidenceRecordPath(workflowId, "reviewer_lane_conformance", "conformance-forged"), JSON.stringify(reviewerLaneConformanceRecord({ hard_chat_authority_claimed: true })));
    const result = reloadFlowDeskSessionEvidenceV1({ workflowId, rootDir });
    assert.equal(result.entries.length, 4);
    assert.deepEqual(new Set(result.entries.map((entry) => entry.evidenceClass)), new Set(["reviewer_verdict", "reviewer_fanout_plan", "lane_lifecycle", "reviewer_lane_conformance"]));
    assert.equal(result.blocked.length, 4);
    assert.match(result.blocked.map((entry) => entry.reason).join("|"), /dispatch_authority_enabled|cannot launch lanes|no-output lane lifecycle records cannot carry|hard chat authority/);
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
