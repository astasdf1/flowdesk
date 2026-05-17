import assert from "node:assert/strict";
import test from "node:test";
import type { FlowDeskNonDispatchPermissionV1, FlowDeskPolicyPackV1, FlowDeskProjectConfigV1, FlowDeskRunRequestV1 } from "./index.js";
import { evaluateFlowDeskGuardedDryRunCommandV1, mergePolicyPacksV1, validateRunResponseV1 } from "./index.js";

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
    permission_class: "audit_write",
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

function request(overrides: Partial<FlowDeskRunRequestV1> = {}): FlowDeskRunRequestV1 {
  return {
    schema_version: "flowdesk.run.request.v1",
    request_id: "request-123",
    input_mode: "test_fixture",
    workflow_id: "workflow-123",
    run_mode: "guarded-dry-run",
    plan_revision_id: "plan-123",
    step_id: "step-123",
    ...overrides
  };
}

function evaluationInput(overrides: Partial<Parameters<typeof evaluateFlowDeskGuardedDryRunCommandV1>[0]> = {}): Parameters<typeof evaluateFlowDeskGuardedDryRunCommandV1>[0] {
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
    sessionId: "session-123",
    attemptId: "attempt-123",
    auditEventId: "event-123",
    nowIso: now,
    decisionRef: "decision-123",
    routeRef: "route-123",
    commandShapeHash: "command-shape-hash-123",
    runResultRef: "run-result-123",
    verificationSummaryRef: "verification-123",
    redactionVersion: "redaction-v1",
    ...overrides
  };
}

test("guarded dry-run evaluator returns schema-valid inert success with only planned audit intent", () => {
  const result = evaluateFlowDeskGuardedDryRunCommandV1(evaluationInput());
  assert.equal(result.ok, true);
  assert.equal(result.guardDecision.status, "eligible");
  assert.equal(validateRunResponseV1(result.response).ok, true);
  assert.equal(result.response.status, "dry_run_complete");
  assert.equal(result.response.artifact_disposition, "none");
  assert.deepEqual(result.planningEvidence, {
    plan_revision_id: "plan-123",
    route_ref: "route-123",
    guard_decision_ref: "decision-123",
    command_shape_hash: "command-shape-hash-123",
    pre_run_audit_ref: "audit-123",
    request_schema_id: "flowdesk.run.request.v1",
    response_schema_id: "flowdesk.run.response.v1"
  });
  assert.ok(result.preRunAuditIntent);
  assert.equal(result.preRunAuditIntent.operation, "append_jsonl");
  assert.equal(result.preRunAuditIntent.schemaId, "flowdesk.audit_record.v1");
  assert.equal(result.preRunAuditIntent.path, ".flowdesk/sessions/session-123/audit.jsonl");
  assert.deepEqual(result.preRunAuditIntent.record.evidence_refs, ["route-123", "decision-123", "conformance-123", "runtime-123"]);
  assert.deepEqual(result.runtime, {
    realOpenCodeDispatch: false,
    actualLaneLaunch: false,
    providerCall: false,
    automaticFallbackOrReselection: false,
    hardCancelOrNoReply: false,
    stateWriteApplied: false
  });
});

test("guarded dry-run evaluator rejects missing audit, permission, and runtime evidence", () => {
  const missingPermission = evaluateFlowDeskGuardedDryRunCommandV1(evaluationInput({ guardBoundary: { ...evaluationInput().guardBoundary, nonDispatchPermission: undefined } }));
  assert.equal(missingPermission.ok, false);
  assert.equal(missingPermission.guardDecision.status, "blocked");
  assert.equal(missingPermission.runtime.realOpenCodeDispatch, false);

  const missingAudit = evaluateFlowDeskGuardedDryRunCommandV1(evaluationInput({ guardBoundary: { ...evaluationInput().guardBoundary, auditRef: undefined } }));
  assert.equal(missingAudit.ok, false);
  assert.equal(missingAudit.guardDecision.status, "blocked");

  const missingRuntime = evaluateFlowDeskGuardedDryRunCommandV1(evaluationInput({ guardBoundary: { ...evaluationInput().guardBoundary, runtimeCapabilityRef: undefined } }));
  assert.equal(missingRuntime.ok, false);
  assert.equal(missingRuntime.guardDecision.status, "blocked");
});

test("guarded dry-run evaluator rejects forged authority and non-dry-run command requests", () => {
  const forgedPermission = evaluateFlowDeskGuardedDryRunCommandV1(evaluationInput({ guardBoundary: { ...evaluationInput().guardBoundary, nonDispatchPermission: permission({ grant_source: "policy_pack" }) } }));
  assert.equal(forgedPermission.ok, false);
  assert.equal(forgedPermission.guardDecision.status, "blocked");

  const fakeRuntimeRequest = evaluateFlowDeskGuardedDryRunCommandV1(evaluationInput({ request: request({ run_mode: "fake-runtime" }) }));
  assert.equal(fakeRuntimeRequest.ok, false);
  assert.match(fakeRuntimeRequest.errors.join(";"), /guarded-dry-run/);
  assert.equal(fakeRuntimeRequest.runtime.actualLaneLaunch, false);

  const stateWritePermission = evaluateFlowDeskGuardedDryRunCommandV1(evaluationInput({ guardBoundary: { ...evaluationInput().guardBoundary, nonDispatchPermission: permission({ permission_class: "state_write" }) } }));
  assert.equal(stateWritePermission.ok, false);
  assert.equal(stateWritePermission.guardDecision.status, "blocked");
});
