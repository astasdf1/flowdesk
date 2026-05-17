import assert from "node:assert/strict";
import test from "node:test";
import type { FlowDeskNonDispatchPermissionV1, FlowDeskPolicyPackV1, FlowDeskProjectConfigV1, FlowDeskRunRequestV1 } from "./index.js";
import { evaluateFlowDeskFakeRuntimeCommandV1, mergePolicyPacksV1, validateFlowDeskStateWriteIntent, validateLaneSummaryArtifactV1, validateRunResponseV1 } from "./index.js";

const now = "2026-05-17T00:00:00.000Z";

function retention(days = { session: 14, debug: 7, conformance: 30 }) {
  return {
    session_records_max_days: days.session,
    debug_staging_max_days: days.debug,
    conformance_summary_max_days: days.conformance,
    allow_user_longer_retention: false,
    deletion_behavior: "delete_after_expiry" as const
  };
}

function usagePolicy() {
  return {
    usage_freshness_ttl_minutes: 15,
    unknown_usage_dispatchability: "non_dispatchable" as const,
    stale_usage_dispatchability: "non_dispatchable" as const,
    refused_usage_dispatchability: "non_dispatchable" as const,
    shared_limit_suspected_dispatchability: "non_dispatchable" as const,
    fallback_derived_dispatchability: "non_dispatchable" as const,
    allow_local_history_source: false,
    allow_provider_console_scraping: false as const
  };
}

function healthPolicy() {
  return {
    health_freshness_ttl_minutes: 10,
    unavailable_dispatchability: "non_dispatchable" as const,
    degraded_dispatchability: "diagnostic_only" as const,
    opencode_go_usage_without_official_quota: "unknown" as const,
    z_ai_usage_without_official_quota: "unknown" as const,
    allow_automatic_provider_fallback: false as const
  };
}

function projectConfig(): FlowDeskProjectConfigV1 {
  return {
    schema_version: "flowdesk.project_config.v1",
    config_id: "config-123",
    created_at: now,
    updated_at: now,
    release_mode: "release1",
    project_root_ref: "project-root-123",
    config_hash: "config-hash-123",
    policy_pack_refs: ["policy-ref-123"],
    policy_pack_hashes: ["policy-hash-123"],
    chat_intake_mode: "steering",
    hook_harness_mode: "enforce",
    retention: retention(),
    usage_policy: usagePolicy(),
    provider_health_policy: healthPolicy(),
    disabled_modes: ["real_dispatch", "managed_fallback", "lane_launch", "hard_chat_blocking"],
    extension_namespaces: ["flowdesk.project"],
    audit_refs: ["audit-123"]
  };
}

function policyPack(): FlowDeskPolicyPackV1 {
  return {
    schema_version: "flowdesk.policy_pack.v1",
    policy_pack_id: "policy-123",
    policy_pack_hash: "policy-hash-123",
    name: "Starter policy",
    version: "1.0.0",
    source_ref: "policy-source-123",
    applies_to_release_modes: ["release1"],
    priority: 1,
    rules: [{ rule_id: "rule-approval-123", effect: "require_approval", target: "permission_class", summary_label: "Require typed approval for writes.", refs: ["approval-123"] }],
    hard_ban_refs: ["ban-123"],
    retention_override: retention({ session: 7, debug: 3, conformance: 14 }),
    usage_policy_override: { ...usagePolicy(), usage_freshness_ttl_minutes: 5 },
    provider_health_policy_override: { ...healthPolicy(), degraded_dispatchability: "non_dispatchable" },
    hook_policy_override: { chat_intake_mode: "steering", hook_harness_mode: "enforce", blocking_chat_intake_enabled: false, hard_no_reply_or_cancel_enabled: false },
    allowed_extension_namespaces: ["flowdesk.project"],
    redaction_baseline_ref: "redaction-123"
  };
}

function permission(overrides: Partial<FlowDeskNonDispatchPermissionV1> = {}): FlowDeskNonDispatchPermissionV1 {
  return {
    schema_version: "flowdesk.non_dispatch_permission.v1",
    permission_id: "permission-123",
    permission_class: "fake_runtime_write",
    workflow_id: "workflow-123",
    scope_ref: "scope-123",
    grant_source: "typed_confirmation",
    created_at: now,
    expires_at: "2026-05-18T00:00:00.000Z",
    config_hash: "config-hash-123",
    policy_pack_hash: "policy-hash-123",
    release_mode: "release1",
    audit_ref: "audit-123",
    ...overrides
  };
}

function auditWritePermission(overrides: Partial<FlowDeskNonDispatchPermissionV1> = {}): FlowDeskNonDispatchPermissionV1 {
  return permission({ permission_class: "audit_write", ...overrides });
}

function stateWritePermission(overrides: Partial<FlowDeskNonDispatchPermissionV1> = {}): FlowDeskNonDispatchPermissionV1 {
  return permission({ permission_class: "state_write", ...overrides });
}

function request(overrides: Partial<FlowDeskRunRequestV1> = {}): FlowDeskRunRequestV1 {
  return {
    schema_version: "flowdesk.run.request.v1",
    request_id: "request-123",
    input_mode: "test_fixture",
    workflow_id: "workflow-123",
    run_mode: "fake-runtime",
    plan_revision_id: "plan-123",
    step_id: "step-123",
    ...overrides
  };
}

function evaluationInput(overrides: Partial<Parameters<typeof evaluateFlowDeskFakeRuntimeCommandV1>[0]> = {}): Parameters<typeof evaluateFlowDeskFakeRuntimeCommandV1>[0] {
  const policy = mergePolicyPacksV1(projectConfig(), [policyPack()], { effectivePolicyId: "effective-123", computedAt: now, auditRef: "audit-123" });
  return {
    commandName: "/flowdesk-run",
    request: request(),
    guardBoundary: {
      configHash: "config-hash-123",
      scopeRef: "scope-123",
      policy,
      auditRef: "audit-123",
      conformanceRef: "conformance-123",
      runtimeCapabilityRef: "runtime-123",
      nonDispatchPermission: permission(),
      now: Date.parse(now)
    },
    auditWritePermission: auditWritePermission(),
    stateWritePermission: stateWritePermission(),
    sessionId: "session-123",
    attemptId: "attempt-123",
    auditEventId: "event-123",
    outcomeAuditEventId: "event-outcome-123",
    nowIso: now,
    decisionRef: "decision-123",
    routeRef: "route-123",
    commandShapeHash: "command-shape-hash-123",
    runResultRef: "fake-runtime-result-123",
    runtimeEchoEvidenceRef: "runtime-echo-ref-123",
    verificationSummaryRef: "verification-123",
    outcomeAuditRef: "audit-outcome-123",
    redactionVersion: "redaction-v1",
    ...overrides
  };
}

test("fake-runtime evaluator returns schema-valid inert success with pre-run audit intent only", () => {
  const result = evaluateFlowDeskFakeRuntimeCommandV1(evaluationInput());
  assert.equal(result.ok, true);
  assert.equal(result.guardDecision.status, "eligible");
  assert.equal(validateRunResponseV1(result.response).ok, true);
  assert.equal(result.response.status, "fake_runtime_complete");
  assert.equal(result.response.artifact_disposition, "quarantined");
  assert.deepEqual(result.verificationSummaryArtifact, {
    schema_version: "flowdesk.verification_summary.v1",
    verification_id: "verification-123",
    workflow_id: "workflow-123",
    attempt_id: "attempt-123",
    result: "passed",
    check_labels: ["fake-runtime-deterministic", "no-real-dispatch", "redacted-audit-intent"],
    artifact_refs: ["fake-runtime-result-123", "runtime-echo-ref-123"],
    safe_next_actions: ["/flowdesk-status", "/flowdesk-export-debug"]
  });
  assert.deepEqual(result.evidenceRefs, {
    plan_revision_id: "plan-123",
    route_ref: "route-123",
    guard_decision_ref: "decision-123",
    command_shape_hash: "command-shape-hash-123",
    runtime_capability_ref: "runtime-123",
    fake_runtime_result_ref: "fake-runtime-result-123",
    runtime_echo_evidence_ref: "runtime-echo-ref-123",
    verification_summary_ref: "verification-123",
    pre_run_audit_ref: "audit-123",
    request_schema_id: "flowdesk.run.request.v1",
    response_schema_id: "flowdesk.run.response.v1"
  });
  assert.ok(result.preRunAuditIntent);
  assert.equal(result.preRunAuditIntent.operation, "append_jsonl");
  assert.equal(result.preRunAuditIntent.schemaId, "flowdesk.audit_record.v1");
  assert.equal(result.preRunAuditIntent.path, ".flowdesk/sessions/session-123/audit.jsonl");
  assert.equal(result.preRunAuditIntent.record.event_type, "pre_run_fake_runtime");
  assert.deepEqual(result.preRunAuditIntent.record.artifact_refs, ["fake-runtime-result-123", "runtime-echo-ref-123", "verification-123"]);
  assert.deepEqual(result.preRunAuditIntent.record.evidence_refs, ["route-123", "decision-123", "conformance-123", "runtime-123", "runtime-echo-ref-123"]);
  assert.equal(validateFlowDeskStateWriteIntent(result.preRunAuditIntent).ok, true);
  assert.ok(result.outcomeAuditIntent);
  assert.equal(result.outcomeAuditIntent.record.audit_ref, "audit-outcome-123");
  assert.equal(result.outcomeAuditIntent.record.event_type, "pre_run_fake_runtime_outcome_audit");
  assert.deepEqual(result.outcomeAuditIntent.record.evidence_refs, ["route-123", "decision-123", "runtime-123", "runtime-echo-ref-123", "verification-123"]);
  assert.equal(validateFlowDeskStateWriteIntent(result.outcomeAuditIntent).ok, true);
  assert.ok(result.attemptRecordIntent);
  assert.equal(result.attemptRecordIntent.operation, "write_json");
  assert.equal(result.attemptRecordIntent.schemaId, "flowdesk.attempt_record.v1");
  assert.equal(result.attemptRecordIntent.path, ".flowdesk/workflows/workflow-123/attempts/attempt-123.json");
  assert.equal(result.attemptRecordIntent.record.attempt_state, "complete");
  assert.equal(result.attemptRecordIntent.record.state_at_end, "complete");
  assert.equal(result.attemptRecordIntent.record.runtime_echo_validation, "not_applicable");
  assert.equal(result.attemptRecordIntent.record.outcome_audit_ref, "audit-outcome-123");
  assert.equal(validateFlowDeskStateWriteIntent(result.attemptRecordIntent).ok, true);
  assert.deepEqual(result.runtime, {
    realOpenCodeDispatch: false,
    actualLaneLaunch: false,
    providerCall: false,
    automaticFallbackOrReselection: false,
    hardCancelOrNoReply: false,
    stateWriteApplied: false
  });
});

test("fake-runtime can prepare inert lane records and lane summary artifacts", () => {
  const result = evaluateFlowDeskFakeRuntimeCommandV1(
    evaluationInput({
      laneId: "lane-runtime-123",
      laneTaskRef: "task-runtime-123",
      laneSummaryRef: "lane-summary-runtime-123",
      laneEventRef: "event-runtime-123",
      laneDebugRef: "debug-runtime-123"
    })
  );
  assert.equal(result.ok, true);
  assert.equal(result.laneRecord?.lane_class, "verification");
  assert.equal(result.laneRecord?.state, "completed");
  assert.equal(result.laneRecord?.safe_next_action, "/flowdesk-status");
  assert.equal(validateLaneSummaryArtifactV1(result.laneSummaryArtifact).ok, true);
  assert.ok(result.laneRecordIntent);
  assert.equal(result.laneRecordIntent.operation, "append_jsonl");
  assert.equal(result.laneRecordIntent.authority, "redacted_session_support");
  assert.equal(validateFlowDeskStateWriteIntent(result.laneRecordIntent).ok, true);
  assert.equal(result.runtime.actualLaneLaunch, false);
});

test("fake-runtime lane output fails closed when lane evidence is partial", () => {
  const result = evaluateFlowDeskFakeRuntimeCommandV1(evaluationInput({ laneId: "lane-runtime-123" }));
  assert.equal(result.ok, false);
  assert.equal(result.response.ok, false);
  assert.equal(result.response.safe_next_actions.includes("/flowdesk-run"), false);
  assert.equal(result.runtime.actualLaneLaunch, false);
});

test("fake-runtime evaluator requires fake_runtime_write permission and blocks missing evidence", () => {
  const auditWritePermission = evaluateFlowDeskFakeRuntimeCommandV1(evaluationInput({ guardBoundary: { ...evaluationInput().guardBoundary, nonDispatchPermission: permission({ permission_class: "audit_write" }) } }));
  assert.equal(auditWritePermission.ok, false);
  assert.equal(auditWritePermission.guardDecision.status, "blocked");
  assert.equal(auditWritePermission.preRunAuditIntent, undefined);

  const missingPermission = evaluateFlowDeskFakeRuntimeCommandV1(evaluationInput({ guardBoundary: { ...evaluationInput().guardBoundary, nonDispatchPermission: undefined } }));
  assert.equal(missingPermission.ok, false);
  assert.equal(missingPermission.guardDecision.status, "blocked");

  const missingAudit = evaluateFlowDeskFakeRuntimeCommandV1(evaluationInput({ guardBoundary: { ...evaluationInput().guardBoundary, auditRef: undefined } }));
  assert.equal(missingAudit.ok, false);
  assert.equal(missingAudit.guardDecision.status, "blocked");

  const missingRuntime = evaluateFlowDeskFakeRuntimeCommandV1(evaluationInput({ guardBoundary: { ...evaluationInput().guardBoundary, runtimeCapabilityRef: undefined } }));
  assert.equal(missingRuntime.ok, false);
  assert.equal(missingRuntime.guardDecision.status, "blocked");

  const missingAuditWrite = evaluateFlowDeskFakeRuntimeCommandV1(evaluationInput({ auditWritePermission: permission({ permission_class: "fake_runtime_write" }) }));
  assert.equal(missingAuditWrite.ok, false);
  assert.equal(missingAuditWrite.guardDecision.status, "blocked");
  assert.equal(missingAuditWrite.preRunAuditIntent, undefined);

  const missingStateWrite = evaluateFlowDeskFakeRuntimeCommandV1(evaluationInput({ stateWritePermission: permission({ permission_class: "fake_runtime_write" }) }));
  assert.equal(missingStateWrite.ok, false);
  assert.equal(missingStateWrite.guardDecision.status, "blocked");
  assert.equal(missingStateWrite.preRunAuditIntent, undefined);
});

test("fake-runtime evaluator rejects forged, stale, and mismatched permissions", () => {
  const forgedPermission = evaluateFlowDeskFakeRuntimeCommandV1(evaluationInput({ guardBoundary: { ...evaluationInput().guardBoundary, nonDispatchPermission: permission({ grant_source: "policy_pack" }) } }));
  assert.equal(forgedPermission.ok, false);
  assert.equal(forgedPermission.guardDecision.status, "blocked");

  const stalePermission = evaluateFlowDeskFakeRuntimeCommandV1(evaluationInput({ guardBoundary: { ...evaluationInput().guardBoundary, nonDispatchPermission: permission({ expires_at: "2026-05-16T00:00:00.000Z" }) } }));
  assert.equal(stalePermission.ok, false);
  assert.equal(stalePermission.guardDecision.status, "blocked");

  const mismatchedPermission = evaluateFlowDeskFakeRuntimeCommandV1(evaluationInput({ guardBoundary: { ...evaluationInput().guardBoundary, nonDispatchPermission: permission({ workflow_id: "workflow-other" }) } }));
  assert.equal(mismatchedPermission.ok, false);
  assert.equal(mismatchedPermission.guardDecision.status, "blocked");
});

test("fake-runtime evaluator rejects guarded-dry-run requests before Guard evaluation", () => {
  const dryRunRequest = evaluateFlowDeskFakeRuntimeCommandV1(evaluationInput({ request: request({ run_mode: "guarded-dry-run" }) }));
  assert.equal(dryRunRequest.ok, false);
  assert.equal(dryRunRequest.guardDecision.status, "blocked");
  assert.match(dryRunRequest.errors.join(";"), /fake-runtime/);
  assert.equal(dryRunRequest.preRunAuditIntent, undefined);
  assert.deepEqual(dryRunRequest.runtime, {
    realOpenCodeDispatch: false,
    actualLaneLaunch: false,
    providerCall: false,
    automaticFallbackOrReselection: false,
    hardCancelOrNoReply: false,
    stateWriteApplied: false
  });
});
