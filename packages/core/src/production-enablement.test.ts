import assert from "node:assert/strict";
import test from "node:test";
import type { FlowDeskSessionEvidenceReloadResultV1 } from "./index.js";
import {
  createFlowDeskConfiguredVerificationResultV1,
  createFlowDeskExternalAuthProviderPolicyResultV1,
  createFlowDeskProductionApprovalDecisionV1,
  createFlowDeskSanitizedAuthCaptureResultV1,
  authorizeFlowDeskDefaultManagedDispatchV1,
  evaluateFlowDeskDefaultManagedDispatchPromotionReadinessV1,
  evaluateFlowDeskProductionEnablementV1,
  validateFlowDeskDefaultManagedDispatchAuthorizationV1,
  validateFlowDeskDefaultManagedDispatchPromotionReadinessV1,
  validateFlowDeskProductionApprovalDecisionV1
} from "./index.js";

const workflowId = "workflow-prod-1";

function reloadResult(overrides: Partial<FlowDeskSessionEvidenceReloadResultV1> = {}): FlowDeskSessionEvidenceReloadResultV1 {
  return {
    ok: true,
    errors: [],
    blocked: [],
    entries: [
      {
        evidenceClass: "usage_authority",
        evidenceId: "evidence-usage-1",
        path: ".flowdesk/sessions/workflow-prod-1/evidence/usage-authority/evidence-usage-1.json",
        record: {
          schema_version: "flowdesk.managed_dispatch_beta.usage_authority_evidence.v1",
          authority_ref: "usage-authority-1"
        }
      },
      {
        evidenceClass: "runtime_echo",
        evidenceId: "evidence-runtime-1",
        path: ".flowdesk/sessions/workflow-prod-1/evidence/runtime-echo/evidence-runtime-1.json",
        record: {
          schema_version: "flowdesk.managed_dispatch_beta.runtime_echo_evidence.v1",
          runtime_echo_ref: "runtime-echo-1"
        }
      },
      {
        evidenceClass: "telemetry_correlation",
        evidenceId: "evidence-telemetry-1",
        path: ".flowdesk/sessions/workflow-prod-1/evidence/telemetry-correlation/evidence-telemetry-1.json",
        record: {
          schema_version: "flowdesk.managed_dispatch_beta.telemetry_correlation.v1",
          telemetry_ref: "telemetry-1"
        }
      }
    ],
    realOpenCodeDispatch: false,
    actualLaneLaunch: false,
    providerCall: false,
    runtimeExecution: false,
    ...overrides
  };
}

function baseRefs() {
  return {
    preDispatchAuditRef: "audit-1",
    configuredVerificationRef: "verification-1",
    configuredVerificationResult: createFlowDeskConfiguredVerificationResultV1({
      verificationRef: "verification-1",
      workflowId,
      result: "passed",
      producedAt: "2026-05-20T00:00:00.000Z",
      sourceRef: "configured-verification-source-1",
      checkLabels: ["typecheck", "unit-tests"],
      evidenceRefs: ["verification-evidence-1"]
    }),
    sanitizedAuthCaptureRef: "sanitized-auth-capture-1",
    sanitizedAuthCaptureResult: createFlowDeskSanitizedAuthCaptureResultV1({
      sanitizedAuthCaptureRef: "sanitized-auth-capture-1",
      durableCaptureRef: "durable-auth-capture-1",
      workflowId,
      providerFamily: "claude",
      providerQualifiedModelId: "claude/sonnet-4",
      authProfileRef: "auth-profile-claude",
      authEvidenceRef: "auth-evidence-claude",
      credentialScopeRef: "principal-scope-claude",
      accountBoundaryRef: "account-boundary-claude",
      sanitizerRef: "sanitizer-claude-auth-plugin-v1",
      sourceRef: "external-auth-source-1",
      result: "passed",
      capturedAt: "2026-05-20T00:00:00.000Z",
      metadataLabels: ["raw-plugin-object-redacted", "scope-bound"],
      evidenceRefs: ["sanitized-auth-capture-evidence-1"]
    }),
    externalAuthPolicyRef: "external-auth-policy-1",
    providerPolicyRef: "provider-policy-1",
    externalAuthProviderPolicyResult: createFlowDeskExternalAuthProviderPolicyResultV1({
      externalAuthPolicyRef: "external-auth-policy-1",
      providerPolicyRef: "provider-policy-1",
      workflowId,
      providerFamily: "claude",
      providerQualifiedModelId: "claude/sonnet-4",
      authProfileRef: "auth-profile-claude",
      authEvidenceRef: "auth-evidence-claude",
      credentialScopeRef: "principal-scope-claude",
      accountBoundaryRef: "account-boundary-claude",
      sanitizerRef: "sanitizer-claude-auth-plugin-v1",
      sourceRef: "external-auth-source-1",
      result: "passed",
      sanitizedAt: "2026-05-20T00:00:00.000Z",
      metadataLabels: ["account-boundary-bound", "scope-bound"],
      evidenceRefs: ["external-auth-policy-evidence-1"]
    })
  };
}

function approvedProductionEnablement() {
  const approval = createFlowDeskProductionApprovalDecisionV1({
    approvalId: "approval-1",
    workflowId,
    decision: "approve",
    createdAt: "2026-05-20T00:00:00.000Z",
    requiredEvidenceRefs: ["usage-authority-1", "runtime-echo-1", "telemetry-1", "audit-1", "verification-1", "sanitized-auth-capture-1", "external-auth-policy-1", "provider-policy-1", "lane-conformance-1"]
  });
  return evaluateFlowDeskProductionEnablementV1({
    workflowId,
    evidenceReload: reloadResult(),
    ...baseRefs(),
    laneConformanceRefs: ["lane-conformance-1"],
    approvalDecision: approval
  });
}

function candidatePromotionReadiness() {
  return evaluateFlowDeskDefaultManagedDispatchPromotionReadinessV1({
    productionEnablement: approvedProductionEnablement(),
    durablePrecallRef: "durable-precall-1",
    adapterProfileRef: "adapter-profile-1",
    sdkClientRef: "sdk-client-1",
    defaultReleaseEnablementRef: "default-release-enable-1"
  });
}

test("production enablement reports configured state when all evidence is present but approval is missing", () => {
  const result = evaluateFlowDeskProductionEnablementV1({
    workflowId,
    evidenceReload: reloadResult(),
    ...baseRefs(),
    laneConformanceRefs: ["lane-conformance-1"]
  });

  assert.equal(result.ok, true, result.errors.join("; "));
  assert.equal(result.state, "configured");
  assert.deepEqual(result.blocker_labels, ["approval_missing"]);
  assert.equal(result.managed_dispatch_ready, false);
  assert.equal(result.dispatch_authority_enabled, false);
  assert.equal(result.default_release1_non_dispatch_preserved, true);
});

test("production enablement becomes dispatch-capable only after explicit approval and required refs", () => {
  const approval = createFlowDeskProductionApprovalDecisionV1({
    approvalId: "approval-1",
    workflowId,
    decision: "approve",
    createdAt: "2026-05-20T00:00:00.000Z",
    requiredEvidenceRefs: ["usage-authority-1", "runtime-echo-1", "telemetry-1", "audit-1", "verification-1", "sanitized-auth-capture-1", "external-auth-policy-1", "provider-policy-1", "lane-conformance-1"]
  });

  const validation = validateFlowDeskProductionApprovalDecisionV1(approval, workflowId);
  assert.equal(validation.ok, true, validation.errors.join("; "));

  const result = evaluateFlowDeskProductionEnablementV1({
    workflowId,
    evidenceReload: reloadResult(),
    ...baseRefs(),
    laneConformanceRefs: ["lane-conformance-1"],
    approvalDecision: approval
  });

  assert.equal(result.ok, true, result.errors.join("; "));
  assert.equal(result.state, "dispatch_capable");
  assert.deepEqual(result.blocker_labels, []);
  assert.equal(result.managed_dispatch_ready, true);
  assert.equal(result.dispatch_authority_enabled, false, "diagnostic readiness is not dispatch authorization");
  assert.equal(result.approval_decision, "approve");
  assert.equal(result.approval_ref, "approval-1");
});

test("default managed dispatch promotion readiness remains diagnostic and non-authorizing", () => {
  const production = approvedProductionEnablement();
  const blocked = evaluateFlowDeskDefaultManagedDispatchPromotionReadinessV1({
    productionEnablement: production
  });

  assert.equal(blocked.ok, true, blocked.errors.join("; "));
  assert.equal(blocked.state, "configured");
  assert.equal(blocked.default_dispatch_candidate, false);
  assert.ok(blocked.blocked_labels.includes("durable_precall_missing"));
  assert.ok(blocked.blocked_labels.includes("adapter_unavailable"));
  assert.ok(blocked.blocked_labels.includes("sdk_client_unavailable"));
  assert.ok(blocked.blocked_labels.includes("default_release_enablement_missing"));
  assert.equal(blocked.dispatch_authority_enabled, false);
  assert.equal(blocked.providerCall, false);
  assert.equal(blocked.actualLaneLaunch, false);
  assert.equal(blocked.runtimeExecution, false);

  const candidate = evaluateFlowDeskDefaultManagedDispatchPromotionReadinessV1({
    productionEnablement: production,
    durablePrecallRef: "durable-precall-1",
    adapterProfileRef: "adapter-profile-1",
    sdkClientRef: "sdk-client-1",
    defaultReleaseEnablementRef: "default-release-enable-1"
  });
  assert.equal(candidate.state, "default_candidate");
  assert.equal(candidate.default_dispatch_candidate, true);
  assert.deepEqual(candidate.blocked_labels, []);
  assert.equal(candidate.dispatch_authority_enabled, false, "candidate readiness is still not dispatch authority");
  assert.equal(candidate.release_enablement_ref, "default-release-enable-1");
  const validation = validateFlowDeskDefaultManagedDispatchPromotionReadinessV1(candidate, workflowId);
  assert.equal(validation.ok, true, validation.errors.join("; "));
});

test("default managed dispatch promotion readiness rejects forged authority fields", () => {
  const production = approvedProductionEnablement();
  const candidate = evaluateFlowDeskDefaultManagedDispatchPromotionReadinessV1({
    productionEnablement: production,
    durablePrecallRef: "durable-precall-1",
    adapterProfileRef: "adapter-profile-1",
    sdkClientRef: "sdk-client-1",
    defaultReleaseEnablementRef: "default-release-enable-1"
  });
  const validation = validateFlowDeskDefaultManagedDispatchPromotionReadinessV1({
    ...candidate,
    dispatch_authority_enabled: true,
    providerCall: true,
    unsafe_extra_field: "unsafe"
  });
  assert.equal(validation.ok, false);
  assert.ok(validation.errors.some((error) => error.includes("cannot enable dispatch authority")));
  assert.ok(validation.errors.some((error) => error.includes("cannot make provider calls")));
  assert.ok(validation.errors.some((error) => error.includes("unknown properties")));
});

test("default managed dispatch authorization requires candidate readiness and kill switch inactive", () => {
  const readiness = candidatePromotionReadiness();
  const authorized = authorizeFlowDeskDefaultManagedDispatchV1({
    authorizationId: "default-auth-1",
    readiness,
    actorRef: "actor-ops-1",
    profileRef: "profile-prod-1",
    releaseGateRef: "release-gate-1",
    rollbackRef: "rollback-1",
    createdAt: "2026-05-22T00:00:00.000Z",
    expiresAt: "2026-05-23T00:00:00.000Z",
    defaultEnablementRequested: true,
    killSwitchState: "inactive",
    now: Date.parse("2026-05-22T01:00:00.000Z")
  });
  assert.equal(authorized.ok, true, authorized.errors.join("; "));
  assert.equal(authorized.state, "authorized");
  assert.equal(authorized.default_managed_dispatch_authority_enabled, true);
  assert.equal(authorized.dispatch_authority_enabled, false, "default authorization cannot replace per-attempt dispatch gates");
  assert.equal(authorized.providerCall, false);
  assert.equal(authorized.actualLaneLaunch, false);
  assert.equal(authorized.runtimeExecution, false);
  const validation = validateFlowDeskDefaultManagedDispatchAuthorizationV1(authorized, workflowId);
  assert.equal(validation.ok, true, validation.errors.join("; "));

  const blocked = authorizeFlowDeskDefaultManagedDispatchV1({
    authorizationId: "default-auth-2",
    readiness,
    actorRef: "actor-ops-1",
    profileRef: "profile-prod-1",
    releaseGateRef: "release-gate-1",
    rollbackRef: "rollback-1",
    createdAt: "2026-05-22T00:00:00.000Z",
    expiresAt: "2026-05-23T00:00:00.000Z",
    defaultEnablementRequested: true,
    killSwitchState: "active",
    now: Date.parse("2026-05-22T01:00:00.000Z")
  });
  assert.equal(blocked.state, "blocked");
  assert.equal(blocked.default_managed_dispatch_authority_enabled, false);
  assert.ok(blocked.blocked_labels.includes("kill_switch_active"));
});

test("default managed dispatch authorization rejects forged provider-call authority", () => {
  const authorized = authorizeFlowDeskDefaultManagedDispatchV1({
    authorizationId: "default-auth-3",
    readiness: candidatePromotionReadiness(),
    actorRef: "actor-ops-1",
    profileRef: "profile-prod-1",
    releaseGateRef: "release-gate-1",
    rollbackRef: "rollback-1",
    createdAt: "2026-05-22T00:00:00.000Z",
    expiresAt: "2026-05-23T00:00:00.000Z",
    defaultEnablementRequested: true,
    killSwitchState: "inactive",
    now: Date.parse("2026-05-22T01:00:00.000Z")
  });
  const validation = validateFlowDeskDefaultManagedDispatchAuthorizationV1({
    ...authorized,
    dispatch_authority_enabled: true,
    providerCall: true,
    actualLaneLaunch: true,
    runtimeExecution: true,
    raw_extra: "unsafe"
  });
  assert.equal(validation.ok, false);
  assert.ok(validation.errors.some((error) => error.includes("generic dispatch authority")));
  assert.ok(validation.errors.some((error) => error.includes("cannot make provider calls")));
  assert.ok(validation.errors.some((error) => error.includes("unknown properties")));
});

test("production enablement reports valid approval diagnostics without dispatch authority", () => {
  const denied = createFlowDeskProductionApprovalDecisionV1({
    approvalId: "approval-denied-1",
    workflowId,
    decision: "deny",
    createdAt: "2026-05-20T00:00:00.000Z",
    requiredEvidenceRefs: ["usage-authority-1", "runtime-echo-1", "telemetry-1", "audit-1", "verification-1", "sanitized-auth-capture-1", "external-auth-policy-1", "provider-policy-1", "lane-conformance-1"]
  });
  const deniedResult = evaluateFlowDeskProductionEnablementV1({
    workflowId,
    evidenceReload: reloadResult(),
    ...baseRefs(),
    laneConformanceRefs: ["lane-conformance-1"],
    approvalDecision: denied
  });
  assert.equal(deniedResult.state, "blocked");
  assert.ok(deniedResult.blocker_labels.includes("approval_denied"));
  assert.equal(deniedResult.managed_dispatch_ready, false);
  assert.equal(deniedResult.dispatch_authority_enabled, false);
  assert.equal(deniedResult.approval_decision, "deny");
  assert.equal(deniedResult.approval_ref, "approval-denied-1");

  const drift = createFlowDeskProductionApprovalDecisionV1({
    approvalId: "approval-drift-1",
    workflowId,
    decision: "approve",
    createdAt: "2026-05-20T00:00:00.000Z",
    requiredEvidenceRefs: ["missing-required-ref"]
  });
  const driftResult = evaluateFlowDeskProductionEnablementV1({
    workflowId,
    evidenceReload: reloadResult(),
    ...baseRefs(),
    laneConformanceRefs: ["lane-conformance-1"],
    approvalDecision: drift
  });
  assert.equal(driftResult.state, "blocked");
  assert.ok(driftResult.blocker_labels.includes("approval_required_refs_missing"));
  assert.equal(driftResult.managed_dispatch_ready, false);
  assert.equal(driftResult.approval_decision, "approve");
  assert.equal(driftResult.approval_ref, "approval-drift-1");
});

test("production enablement does not echo invalid approval artifacts", () => {
  const invalidApproval = evaluateFlowDeskProductionEnablementV1({
    workflowId,
    evidenceReload: reloadResult(),
    ...baseRefs(),
    laneConformanceRefs: ["lane-conformance-1"],
    approvalDecision: {
      schema_version: "flowdesk.production_approval_decision.v1",
      approval_id: "approval-forged-1",
      workflow_id: "workflow-other",
      decision: "approve",
      created_at: "2026-05-20T00:00:00.000Z",
      required_evidence_refs: "leaky-approval-ref",
      missing_evidence_labels: [],
      uncertainty_labels: [],
      safe_next_actions: ["/flowdesk-status"],
      dispatch_authority_enabled: true
    } as never
  });
  assert.equal(invalidApproval.state, "blocked");
  assert.ok(invalidApproval.blocker_labels.includes("approval_mismatched"));
  assert.equal(invalidApproval.approval_decision, undefined);
  assert.equal(invalidApproval.approval_ref, undefined);
  assert.ok(!invalidApproval.evidence_refs.includes("leaky-approval-ref"));
});

test("production enablement records incomplete conformance as non-blocking uncertainty when opted in", () => {
  const approval = createFlowDeskProductionApprovalDecisionV1({
    approvalId: "approval-2",
    workflowId,
    decision: "approve",
    createdAt: "2026-05-20T00:00:00.000Z",
    requiredEvidenceRefs: ["usage-authority-1", "runtime-echo-1", "telemetry-1", "audit-1", "verification-1", "sanitized-auth-capture-1", "external-auth-policy-1", "provider-policy-1"],
    uncertaintyLabels: ["opencode_subtask_lifecycle_unproven"]
  });

  const result = evaluateFlowDeskProductionEnablementV1({
    workflowId,
    evidenceReload: reloadResult(),
    ...baseRefs(),
    allowIncompleteConformance: true,
    approvalDecision: approval
  });

  assert.equal(result.state, "dispatch_capable");
  assert.equal(result.managed_dispatch_ready, true);
  assert.deepEqual(result.blocker_labels, []);
  assert.ok(result.uncertainty_labels.includes("opencode_subtask_lifecycle_unproven"));
  assert.ok(result.uncertainty_labels.includes("injected_sdk_runtime_echo_partial"));
});

test("production enablement fails closed for broken reload, missing policy refs, denied approval, and required-ref drift", () => {
  const approval = createFlowDeskProductionApprovalDecisionV1({
    approvalId: "approval-3",
    workflowId,
    decision: "deny",
    createdAt: "2026-05-20T00:00:00.000Z",
    requiredEvidenceRefs: ["missing-ref-1"],
    missingEvidenceLabels: ["configured_verification_missing"]
  });

  const result = evaluateFlowDeskProductionEnablementV1({
    workflowId,
    evidenceReload: reloadResult({ ok: false, errors: ["reload failed"], blocked: [{ evidenceClass: "usage_authority", evidenceId: "bad", reason: "bad", path: "bad" }] }),
    preDispatchAuditRef: "audit-1",
    approvalDecision: approval
  });

  assert.equal(result.state, "blocked");
  assert.equal(result.managed_dispatch_ready, false);
  assert.ok(result.blocker_labels.includes("session_evidence_reload_failed"));
  assert.ok(result.blocker_labels.includes("session_evidence_blocked_records"));
  assert.ok(result.blocker_labels.includes("configured_verification_missing"));
  assert.ok(result.blocker_labels.includes("external_auth_policy_missing"));
  assert.ok(result.blocker_labels.includes("provider_policy_missing"));
  assert.ok(result.blocker_labels.includes("approval_denied"));
  assert.ok(result.blocker_labels.includes("approval_required_refs_missing"));
});

test("production enablement fails closed when configured verification result is missing, failed, or mismatched", () => {
  const missing = evaluateFlowDeskProductionEnablementV1({
    workflowId,
    evidenceReload: reloadResult(),
    preDispatchAuditRef: "audit-1",
    configuredVerificationRef: "verification-1",
    externalAuthPolicyRef: "external-auth-policy-1",
    providerPolicyRef: "provider-policy-1",
    laneConformanceRefs: ["lane-conformance-1"]
  });
  assert.equal(missing.state, "blocked");
  assert.ok(missing.blocker_labels.includes("configured_verification_result_missing"));

  const failed = evaluateFlowDeskProductionEnablementV1({
    workflowId,
    evidenceReload: reloadResult(),
    ...baseRefs(),
    configuredVerificationResult: createFlowDeskConfiguredVerificationResultV1({
      verificationRef: "verification-1",
      workflowId,
      result: "failed",
      producedAt: "2026-05-20T00:00:00.000Z",
      sourceRef: "configured-verification-source-1",
      checkLabels: ["unit-tests"],
      evidenceRefs: ["verification-evidence-1"]
    }),
    laneConformanceRefs: ["lane-conformance-1"]
  });
  assert.equal(failed.state, "blocked");
  assert.ok(failed.blocker_labels.includes("configured_verification_failed"));

  const mismatched = evaluateFlowDeskProductionEnablementV1({
    workflowId,
    evidenceReload: reloadResult(),
    ...baseRefs(),
    configuredVerificationResult: createFlowDeskConfiguredVerificationResultV1({
      verificationRef: "verification-other",
      workflowId,
      result: "passed",
      producedAt: "2026-05-20T00:00:00.000Z",
      sourceRef: "configured-verification-source-1",
      checkLabels: ["unit-tests"]
    }),
    laneConformanceRefs: ["lane-conformance-1"]
  });
  assert.equal(mismatched.state, "blocked");
  assert.ok(mismatched.blocker_labels.includes("configured_verification_invalid"));
});

test("production enablement does not echo or fold invalid configured verification artifacts", () => {
  const invalid = evaluateFlowDeskProductionEnablementV1({
    workflowId,
    evidenceReload: reloadResult(),
    preDispatchAuditRef: "audit-1",
    configuredVerificationRef: "verification-1",
    configuredVerificationResult: {
      ...baseRefs().configuredVerificationResult,
      verification_ref: "verification-other",
      evidence_refs: "leaky-evidence-ref",
      provider_call_made: true,
      runtime_execution_made: true,
      actual_lane_launch_made: true,
      dispatch_authority_enabled: true
    } as never,
    externalAuthPolicyRef: "external-auth-policy-1",
    providerPolicyRef: "provider-policy-1",
    laneConformanceRefs: ["lane-conformance-1"]
  });
  assert.equal(invalid.state, "blocked");
  assert.ok(invalid.blocker_labels.includes("configured_verification_invalid"));
  assert.ok(invalid.blocker_labels.includes("configured_verification_result_missing"));
  assert.equal(invalid.configured_verification_ref, undefined);
  assert.equal(invalid.configured_verification_result, undefined);
  assert.ok(!invalid.evidence_refs.includes("leaky-evidence-ref"));

  const resultWithoutRef = evaluateFlowDeskProductionEnablementV1({
    workflowId,
    evidenceReload: reloadResult(),
    preDispatchAuditRef: "audit-1",
    configuredVerificationResult: baseRefs().configuredVerificationResult,
    externalAuthPolicyRef: "external-auth-policy-1",
    providerPolicyRef: "provider-policy-1",
    laneConformanceRefs: ["lane-conformance-1"]
  });
  assert.equal(resultWithoutRef.state, "blocked");
  assert.ok(resultWithoutRef.blocker_labels.includes("configured_verification_missing"));
  assert.equal(resultWithoutRef.configured_verification_ref, undefined);
  assert.equal(resultWithoutRef.configured_verification_result, undefined);
  assert.ok(!resultWithoutRef.evidence_refs.includes("verification-evidence-1"));
});

test("production enablement fails closed for missing, failed, or mismatched sanitized auth capture results", () => {
  const missing = evaluateFlowDeskProductionEnablementV1({
    workflowId,
    evidenceReload: reloadResult(),
    preDispatchAuditRef: "audit-1",
    configuredVerificationRef: "verification-1",
    configuredVerificationResult: baseRefs().configuredVerificationResult,
    sanitizedAuthCaptureRef: "sanitized-auth-capture-1",
    externalAuthPolicyRef: "external-auth-policy-1",
    providerPolicyRef: "provider-policy-1",
    externalAuthProviderPolicyResult: baseRefs().externalAuthProviderPolicyResult,
    laneConformanceRefs: ["lane-conformance-1"]
  });
  assert.equal(missing.state, "blocked");
  assert.ok(missing.blocker_labels.includes("sanitized_auth_capture_result_missing"));

  const failed = evaluateFlowDeskProductionEnablementV1({
    workflowId,
    evidenceReload: reloadResult(),
    ...baseRefs(),
    sanitizedAuthCaptureResult: createFlowDeskSanitizedAuthCaptureResultV1({
      sanitizedAuthCaptureRef: "sanitized-auth-capture-1",
      durableCaptureRef: "durable-auth-capture-1",
      workflowId,
      providerFamily: "claude",
      providerQualifiedModelId: "claude/sonnet-4",
      authProfileRef: "auth-profile-claude",
      authEvidenceRef: "auth-evidence-claude",
      credentialScopeRef: "principal-scope-claude",
      accountBoundaryRef: "account-boundary-claude",
      sanitizerRef: "sanitizer-claude-auth-plugin-v1",
      sourceRef: "external-auth-source-1",
      result: "failed",
      capturedAt: "2026-05-20T00:00:00.000Z",
      metadataLabels: ["raw-plugin-object-unproven"],
      evidenceRefs: ["sanitized-auth-capture-evidence-1"]
    }),
    laneConformanceRefs: ["lane-conformance-1"]
  });
  assert.equal(failed.state, "blocked");
  assert.ok(failed.blocker_labels.includes("sanitized_auth_capture_failed"));

  const mismatched = evaluateFlowDeskProductionEnablementV1({
    workflowId,
    evidenceReload: reloadResult(),
    ...baseRefs(),
    sanitizedAuthCaptureResult: {
      ...baseRefs().sanitizedAuthCaptureResult,
      sanitized_auth_capture_ref: "sanitized-auth-capture-other"
    },
    laneConformanceRefs: ["lane-conformance-1"]
  });
  assert.equal(mismatched.state, "blocked");
  assert.ok(mismatched.blocker_labels.includes("sanitized_auth_capture_invalid"));
});

test("production enablement does not echo or fold invalid sanitized auth capture artifacts", () => {
  const invalid = evaluateFlowDeskProductionEnablementV1({
    workflowId,
    evidenceReload: reloadResult(),
    preDispatchAuditRef: "audit-1",
    configuredVerificationRef: "verification-1",
    configuredVerificationResult: baseRefs().configuredVerificationResult,
    sanitizedAuthCaptureRef: "sanitized-auth-capture-1",
    sanitizedAuthCaptureResult: {
      ...baseRefs().sanitizedAuthCaptureResult,
      evidence_refs: "leaky-sanitized-auth-ref",
      raw_plugin_object_persisted: true,
      token_material_persisted: true,
      provider_call_made: true,
      dispatch_authority_enabled: true
    } as never,
    externalAuthPolicyRef: "external-auth-policy-1",
    providerPolicyRef: "provider-policy-1",
    externalAuthProviderPolicyResult: baseRefs().externalAuthProviderPolicyResult,
    laneConformanceRefs: ["lane-conformance-1"]
  });
  assert.equal(invalid.state, "blocked");
  assert.ok(invalid.blocker_labels.includes("sanitized_auth_capture_invalid"));
  assert.ok(invalid.blocker_labels.includes("sanitized_auth_capture_result_missing"));
  assert.equal(invalid.sanitized_auth_capture_result, undefined);
  assert.equal(invalid.sanitized_auth_capture_ref, undefined);
  assert.ok(!invalid.evidence_refs.includes("leaky-sanitized-auth-ref"));

  const aliasModel = evaluateFlowDeskProductionEnablementV1({
    workflowId,
    evidenceReload: reloadResult(),
    ...baseRefs(),
    sanitizedAuthCaptureResult: {
      ...baseRefs().sanitizedAuthCaptureResult,
      provider_qualified_model_id: "claude/latest",
      evidence_refs: ["alias-sanitized-auth-ref"]
    },
    laneConformanceRefs: ["lane-conformance-1"]
  });
  assert.equal(aliasModel.state, "blocked");
  assert.ok(aliasModel.blocker_labels.includes("sanitized_auth_capture_invalid"));
  assert.ok(aliasModel.blocker_labels.includes("sanitized_auth_capture_result_missing"));
  assert.equal(aliasModel.sanitized_auth_capture_result, undefined);
  assert.equal(aliasModel.sanitized_auth_capture_ref, undefined);
  assert.ok(!aliasModel.evidence_refs.includes("alias-sanitized-auth-ref"));
});

test("production enablement fails closed for missing, failed, or mismatched external auth provider policy results", () => {
  const missing = evaluateFlowDeskProductionEnablementV1({
    workflowId,
    evidenceReload: reloadResult(),
    preDispatchAuditRef: "audit-1",
    configuredVerificationRef: "verification-1",
    configuredVerificationResult: baseRefs().configuredVerificationResult,
    externalAuthPolicyRef: "external-auth-policy-1",
    providerPolicyRef: "provider-policy-1",
    laneConformanceRefs: ["lane-conformance-1"]
  });
  assert.equal(missing.state, "blocked");
  assert.ok(missing.blocker_labels.includes("external_auth_provider_policy_result_missing"));

  const failed = evaluateFlowDeskProductionEnablementV1({
    workflowId,
    evidenceReload: reloadResult(),
    ...baseRefs(),
    externalAuthProviderPolicyResult: createFlowDeskExternalAuthProviderPolicyResultV1({
      externalAuthPolicyRef: "external-auth-policy-1",
      providerPolicyRef: "provider-policy-1",
      workflowId,
      providerFamily: "claude",
      providerQualifiedModelId: "claude/sonnet-4",
      authProfileRef: "auth-profile-claude",
      authEvidenceRef: "auth-evidence-claude",
      credentialScopeRef: "principal-scope-claude",
      accountBoundaryRef: "account-boundary-claude",
      sanitizerRef: "sanitizer-claude-auth-plugin-v1",
      sourceRef: "external-auth-source-1",
      result: "failed",
      sanitizedAt: "2026-05-20T00:00:00.000Z",
      metadataLabels: ["scope-unproven"],
      evidenceRefs: ["external-auth-policy-evidence-1"]
    }),
    laneConformanceRefs: ["lane-conformance-1"]
  });
  assert.equal(failed.state, "blocked");
  assert.ok(failed.blocker_labels.includes("external_auth_provider_policy_failed"));

  const mismatched = evaluateFlowDeskProductionEnablementV1({
    workflowId,
    evidenceReload: reloadResult(),
    ...baseRefs(),
    externalAuthProviderPolicyResult: {
      ...baseRefs().externalAuthProviderPolicyResult,
      external_auth_policy_ref: "external-auth-policy-other"
    },
    laneConformanceRefs: ["lane-conformance-1"]
  });
  assert.equal(mismatched.state, "blocked");
  assert.ok(mismatched.blocker_labels.includes("external_auth_provider_policy_invalid"));
});

test("production enablement does not echo or fold invalid external auth provider policy artifacts", () => {
  const invalid = evaluateFlowDeskProductionEnablementV1({
    workflowId,
    evidenceReload: reloadResult(),
    preDispatchAuditRef: "audit-1",
    configuredVerificationRef: "verification-1",
    configuredVerificationResult: baseRefs().configuredVerificationResult,
    externalAuthPolicyRef: "external-auth-policy-1",
    providerPolicyRef: "provider-policy-1",
    externalAuthProviderPolicyResult: {
      ...baseRefs().externalAuthProviderPolicyResult,
      evidence_refs: "leaky-evidence-ref",
      token_material_persisted: true,
      provider_call_made: true,
      dispatch_authority_enabled: true
    } as never,
    laneConformanceRefs: ["lane-conformance-1"]
  });
  assert.equal(invalid.state, "blocked");
  assert.ok(invalid.blocker_labels.includes("external_auth_provider_policy_invalid"));
  assert.ok(invalid.blocker_labels.includes("external_auth_provider_policy_result_missing"));
  assert.equal(invalid.external_auth_provider_policy_result, undefined);
  assert.equal(invalid.external_auth_policy_ref, undefined);
  assert.equal(invalid.provider_policy_ref, undefined);
  assert.ok(!invalid.evidence_refs.includes("leaky-evidence-ref"));

  const aliasModel = evaluateFlowDeskProductionEnablementV1({
    workflowId,
    evidenceReload: reloadResult(),
    preDispatchAuditRef: "audit-1",
    configuredVerificationRef: "verification-1",
    configuredVerificationResult: baseRefs().configuredVerificationResult,
    externalAuthPolicyRef: "external-auth-policy-1",
    providerPolicyRef: "provider-policy-1",
    externalAuthProviderPolicyResult: {
      ...baseRefs().externalAuthProviderPolicyResult,
      provider_qualified_model_id: "claude/latest",
      evidence_refs: ["alias-model-evidence-ref"]
    },
    laneConformanceRefs: ["lane-conformance-1"]
  });
  assert.equal(aliasModel.state, "blocked");
  assert.ok(aliasModel.blocker_labels.includes("external_auth_provider_policy_invalid"));
  assert.ok(aliasModel.blocker_labels.includes("external_auth_provider_policy_result_missing"));
  assert.equal(aliasModel.external_auth_provider_policy_result, undefined);
  assert.equal(aliasModel.external_auth_policy_ref, undefined);
  assert.equal(aliasModel.provider_policy_ref, undefined);
  assert.ok(!aliasModel.evidence_refs.includes("alias-model-evidence-ref"));
});

test("production enablement does not become dispatch-capable with malformed lane conformance refs", () => {
  const approval = createFlowDeskProductionApprovalDecisionV1({
    approvalId: "approval-4",
    workflowId,
    decision: "approve",
    createdAt: "2026-05-20T00:00:00.000Z",
    requiredEvidenceRefs: ["usage-authority-1", "runtime-echo-1", "telemetry-1", "audit-1", "verification-1", "sanitized-auth-capture-1", "external-auth-policy-1", "provider-policy-1"]
  });

  const result = evaluateFlowDeskProductionEnablementV1({
    workflowId,
    evidenceReload: reloadResult(),
    ...baseRefs(),
    laneConformanceRefs: ["/tmp/raw-lane-ref"],
    approvalDecision: approval
  });

  assert.equal(result.ok, false);
  assert.equal(result.state, "blocked");
  assert.equal(result.managed_dispatch_ready, false);
  assert.ok(result.blocker_labels.includes("lane_conformance_missing"));
});
