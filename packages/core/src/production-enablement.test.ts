import assert from "node:assert/strict";
import test from "node:test";
import type { FlowDeskRelease2Phase6AClosureEvidenceV1, FlowDeskSessionEvidenceReloadResultV1 } from "./index.js";
import {
  createFlowDeskConfiguredVerificationResultV1,
  createFlowDeskExternalAuthProviderPolicyResultV1,
  createFlowDeskProductionApprovalDecisionV1,
  createFlowDeskSanitizedAuthCaptureResultV1,
  authorizeFlowDeskDefaultManagedDispatchV1,
  evaluateFlowDeskDefaultManagedDispatchPromotionReadinessV1,
  evaluateFlowDeskRelease2ManagedDispatchGatePromotionReadinessV1,
  evaluateFlowDeskProductionEnablementV1,
  validateFlowDeskDefaultManagedDispatchAuthorizationV1,
  validateFlowDeskDefaultManagedDispatchPromotionReadinessV1,
  validateFlowDeskRelease2ManagedDispatchGatePromotionReadinessV1,
  validateFlowDeskRelease2Phase6AClosureEvidenceV1,
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
      },
      {
        evidenceClass: "provider_health_snapshot",
        evidenceId: "evidence-provider-health-1",
        path: ".flowdesk/sessions/workflow-prod-1/evidence/provider-health-snapshot/evidence-provider-health-1.json",
        record: {
          schema_version: "flowdesk.provider_health_snapshot.v1",
          snapshot_id: "provider-health-1",
          provider_family: "claude",
          observed_at: "2026-05-20T00:00:00.000Z",
          freshness: "fresh",
          freshness_ttl: "5m",
          source_surface: "test",
          availability_state: "healthy",
          failure_class: "none",
          dispatchability: "dispatchable",
          source_ref: "provider-health-source-1",
          safe_remediation: ["/flowdesk-status"]
        }
      },
      {
        evidenceClass: "pre_dispatch_audit",
        evidenceId: "evidence-pre-dispatch-audit-1",
        path: ".flowdesk/sessions/workflow-prod-1/evidence/pre-dispatch-audit/evidence-pre-dispatch-audit-1.json",
        record: {
          schema_version: "flowdesk.pre_dispatch_audit_record.v1",
          workflow_id: workflowId,
          pre_dispatch_audit_ref: "audit-1",
          observed_at: "2026-05-20T00:00:00.000Z",
          attempt_id: "attempt-prod-1",
          approval_ref: "approval-1",
          dispatch_authority_enabled: false,
          providerCall: false,
          actualLaneLaunch: false,
          runtimeExecution: false
        }
      },
      {
        evidenceClass: "production_approval_source",
        evidenceId: "evidence-production-approval-source-1",
        path: ".flowdesk/sessions/workflow-prod-1/evidence/production-approval-source/evidence-production-approval-source-1.json",
        record: {
          schema_version: "flowdesk.production_approval_source.v1",
          approval_id: "approval-source-1",
          workflow_id: workflowId,
          attempt_id: "attempt-prod-1",
          action_type: "managed_dispatch_beta",
          issuer_boundary: "external_user_confirmation",
          approval_method: "typed_phrase",
          actor_ref: "actor-user-1",
          profile_ref: "profile-dev-1",
          provider_qualified_model_id: "claude/sonnet-4",
          provider_binding_hash: "hash-provider-binding-1",
          evidence_bundle_hash: "hash-evidence-bundle-1",
          guard_decision_ref: "guard-decision-1",
          issuance_audit_ref: "issuance-audit-1",
          nonce_ref: "nonce-1",
          issued_at: "2026-05-20T00:00:00.000Z",
          expires_at: "2026-05-20T00:10:00.000Z",
          revoked: false,
          consume_strategy: "atomic_compare_and_swap_required",
          dispatch_authority_enabled: false
        }
      },
      {
        evidenceClass: "dispatch_idempotency",
        evidenceId: "evidence-dispatch-idempotency-1",
        path: ".flowdesk/sessions/workflow-prod-1/evidence/dispatch-idempotency/evidence-dispatch-idempotency-1.json",
        record: {
          schema_version: "flowdesk.dispatch_idempotency_snapshot.v1",
          workflow_id: workflowId,
          snapshot_ref: "idempotency-1",
          observed_at: "2026-05-20T00:00:00.000Z",
          entries: [
            {
              attempt_id: "attempt-prod-1",
              idempotency_key: "idempotency-key-1",
              state: "reserved",
              recorded_at: "2026-05-20T00:00:00.000Z"
            }
          ],
          dispatch_authority_enabled: false,
          realOpenCodeDispatch: false,
          actualLaneLaunch: false,
          providerCall: false,
          runtimeExecution: false
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

function phase6AClosure(overrides: Record<string, unknown> = {}): FlowDeskRelease2Phase6AClosureEvidenceV1 {
  return {
    schema_version: "flowdesk.release2_phase6a_closure_evidence.v1",
    closure_ref: "phase6a-closure-1",
    workflow_id: workflowId,
    phase: "phase_6a",
    result: "passed",
    closed_at: "2026-06-06T00:00:00.000Z",
    expires_at: "2026-06-07T00:00:00.000Z",
    closure_labels: [
      "plugin_sdk_compatibility_closed",
      "fanout_cap_cache_enforcement_closed",
      "reviewer_fanout_smoke_closed"
    ],
    evidence_refs: [
      "phase6a-plugin-sdk-compat-1",
      "phase6a-fanout-cache-1",
      "phase6a-reviewer-smoke-1"
    ],
    dispatch_authority_enabled: false,
    fallback_authority_enabled: false,
    hard_chat_authority_enabled: false,
    external_write_authority_enabled: false,
    providerCall: false,
    actualLaneLaunch: false,
    runtimeExecution: false,
    ...overrides
  } as FlowDeskRelease2Phase6AClosureEvidenceV1;
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
    attemptId: "attempt-prod-1",
    idempotencyKey: "idempotency-key-1",
    laneConformanceRefs: ["lane-conformance-1"],
    approvalDecision: approval
  });

  assert.equal(result.ok, true, result.errors.join("; "));
  assert.equal(result.state, "dispatch_capable");
  assert.deepEqual(result.blocker_labels, []);
  assert.equal(result.managed_dispatch_ready, true);
  assert.equal(result.managed_dispatch_ready_basis, "all_evidence_present");
  assert.equal(result.dispatch_authority_enabled, false, "diagnostic readiness is not dispatch authorization");
  assert.equal(result.approval_decision, "approve");
  assert.equal(result.approval_ref, "approval-1");
});

test("production enablement skips platform-dependent proof gaps after plugin-satisfiable evidence passes", () => {
  const approval = createFlowDeskProductionApprovalDecisionV1({
    approvalId: "approval-1",
    workflowId,
    decision: "approve",
    createdAt: "2026-05-20T00:00:00.000Z",
    requiredEvidenceRefs: [
      "audit-1",
      "verification-1",
      "sanitized-auth-capture-1",
      "external-auth-policy-1",
      "provider-policy-1"
    ]
  });
  const fullReload = reloadResult();
  const result = evaluateFlowDeskProductionEnablementV1({
    workflowId,
    evidenceReload: reloadResult({
      entries: fullReload.entries.filter(
        (entry) =>
          entry.evidenceClass !== "usage_authority" &&
          entry.evidenceClass !== "runtime_echo" &&
          entry.evidenceClass !== "telemetry_correlation"
      )
    }),
    ...baseRefs(),
    attemptId: "attempt-prod-1",
    idempotencyKey: "idempotency-key-1",
    approvalDecision: approval
  });

  assert.equal(result.ok, true, result.errors.join("; "));
  assert.equal(result.state, "dispatch_capable");
  assert.equal(result.managed_dispatch_ready, true);
  assert.equal(
    result.managed_dispatch_ready_basis,
    "plugin_satisfiable_with_platform_dependent_skipped"
  );
  assert.equal(result.plugin_satisfiable_gate_passed, true);
  assert.deepEqual(result.blocker_labels, [
    "usage_authority_missing",
    "runtime_echo_missing",
    "telemetry_correlation_missing",
    "lane_conformance_missing"
  ]);
  assert.deepEqual(result.skipped_platform_dependent_labels, result.blocker_labels);
  assert.equal(
    result.plugin_boundary_assessment?.only_platform_dependent_blockers_remain,
    true
  );
  assert.equal(
    result.plugin_boundary_assessment?.skipped_platform_dependent_count,
    4
  );
  assert.equal(result.dispatch_authority_enabled, false);
});

test("production enablement fails closed when provider health is missing, stale, or non-dispatchable", () => {
  const approval = createFlowDeskProductionApprovalDecisionV1({
    approvalId: "approval-1",
    workflowId,
    decision: "approve",
    createdAt: "2026-05-20T00:00:00.000Z",
    requiredEvidenceRefs: ["usage-authority-1", "runtime-echo-1", "telemetry-1", "audit-1", "verification-1", "sanitized-auth-capture-1", "external-auth-policy-1", "provider-policy-1", "lane-conformance-1"]
  });
  const healthyReload = reloadResult();
  const withoutHealth = evaluateFlowDeskProductionEnablementV1({
    workflowId,
    evidenceReload: reloadResult({ entries: healthyReload.entries.filter((entry) => entry.evidenceClass !== "provider_health_snapshot") }),
    ...baseRefs(),
    laneConformanceRefs: ["lane-conformance-1"],
    approvalDecision: approval
  });
  assert.equal(withoutHealth.state, "blocked");
  assert.ok(withoutHealth.blocker_labels.includes("provider_health_snapshot_missing"));
  assert.equal(withoutHealth.managed_dispatch_ready, false);

  const withReusableUsageSnapshot = evaluateFlowDeskProductionEnablementV1({
    workflowId,
    evidenceReload: reloadResult({
      entries: [
        ...healthyReload.entries.filter((entry) => entry.evidenceClass !== "provider_health_snapshot"),
        {
          evidenceClass: "provider_usage_snapshot",
          evidenceId: "provider-usage-snapshot-claude-20260520T000000000Z",
          path: ".flowdesk/sessions/workflow-prod-1/evidence/provider-usage-snapshot/provider-usage-snapshot-claude-20260520T000000000Z.json",
          record: {
            schema_version: "flowdesk.usage_snapshot.v1",
            snapshot_id: "usage-live-claude-20260520T000000000Z",
            provider_family: "claude",
            model_family: "sonnet-4",
            freshness: "fresh",
            freshness_ttl: 5,
            reset_time: "2026-05-20T05:00:00.000Z",
            reset_bucket: "80% until reset",
            dispatchability: "dispatchable",
            uncertainty_flags: [],
            source_ref: "usage-live-source-claude-20260520T000000000Z"
          }
        }
      ]
    }),
    ...baseRefs(),
    attemptId: "attempt-prod-1",
    idempotencyKey: "idempotency-key-1",
    laneConformanceRefs: ["lane-conformance-1"],
    approvalDecision: approval
  });
  assert.equal(withReusableUsageSnapshot.state, "dispatch_capable");
  assert.equal(withReusableUsageSnapshot.managed_dispatch_ready, true);
  assert.equal(withReusableUsageSnapshot.blocker_labels.includes("provider_health_snapshot_missing"), false);

  const staleHealth = evaluateFlowDeskProductionEnablementV1({
    workflowId,
    evidenceReload: reloadResult({
      entries: healthyReload.entries.map((entry) =>
        entry.evidenceClass === "provider_health_snapshot"
          ? {
              ...entry,
              record: {
                ...entry.record,
                freshness: "stale",
                availability_state: "unknown",
                failure_class: "telemetry_ambiguous",
                dispatchability: "non_dispatchable"
              }
            }
          : entry
      )
    }),
    ...baseRefs(),
    laneConformanceRefs: ["lane-conformance-1"],
    approvalDecision: approval
  });
  assert.ok(staleHealth.blocker_labels.includes("provider_health_snapshot_not_fresh"));
  assert.ok(staleHealth.blocker_labels.includes("provider_health_snapshot_not_dispatchable"));
  assert.equal(staleHealth.managed_dispatch_ready, false);

  const diagnosticHealth = evaluateFlowDeskProductionEnablementV1({
    workflowId,
    evidenceReload: reloadResult({
      entries: healthyReload.entries.map((entry) =>
        entry.evidenceClass === "provider_health_snapshot"
          ? {
              ...entry,
              record: {
                ...entry.record,
                availability_state: "degraded",
                failure_class: "telemetry_ambiguous",
                dispatchability: "diagnostic_only"
              }
            }
          : entry
      )
    }),
    ...baseRefs(),
    laneConformanceRefs: ["lane-conformance-1"],
    approvalDecision: approval
  });
  assert.deepEqual(diagnosticHealth.blocker_labels, ["provider_health_snapshot_not_dispatchable"]);
  assert.equal(diagnosticHealth.state, "blocked");
});

test("production enablement fails closed without durable pre-call approval source and idempotency evidence", () => {
  const approval = createFlowDeskProductionApprovalDecisionV1({
    approvalId: "approval-1",
    workflowId,
    decision: "approve",
    createdAt: "2026-05-20T00:00:00.000Z",
    requiredEvidenceRefs: ["usage-authority-1", "runtime-echo-1", "telemetry-1", "audit-1", "verification-1", "sanitized-auth-capture-1", "external-auth-policy-1", "provider-policy-1", "lane-conformance-1"]
  });
  const fullReload = reloadResult();
  const missingPrecall = evaluateFlowDeskProductionEnablementV1({
    workflowId,
    evidenceReload: reloadResult({
      entries: fullReload.entries.filter(
        (entry) =>
          entry.evidenceClass !== "pre_dispatch_audit" &&
          entry.evidenceClass !== "production_approval_source" &&
          entry.evidenceClass !== "dispatch_idempotency"
      )
    }),
    ...baseRefs(),
    laneConformanceRefs: ["lane-conformance-1"],
    approvalDecision: approval
  });

  assert.equal(missingPrecall.state, "blocked");
  assert.ok(missingPrecall.blocker_labels.includes("pre_dispatch_audit_missing"));
  assert.ok(missingPrecall.blocker_labels.includes("production_approval_source_missing"));
  assert.ok(missingPrecall.blocker_labels.includes("dispatch_idempotency_missing"));
  assert.equal(missingPrecall.managed_dispatch_ready, false);
  assert.equal(missingPrecall.dispatch_authority_enabled, false);
});

test("production enablement fails closed when pre-call evidence drifts from target attempt", () => {
  const approval = createFlowDeskProductionApprovalDecisionV1({
    approvalId: "approval-1",
    workflowId,
    decision: "approve",
    createdAt: "2026-05-20T00:00:00.000Z",
    requiredEvidenceRefs: ["usage-authority-1", "runtime-echo-1", "telemetry-1", "audit-1", "verification-1", "sanitized-auth-capture-1", "external-auth-policy-1", "provider-policy-1", "lane-conformance-1"]
  });
  const drifted = evaluateFlowDeskProductionEnablementV1({
    workflowId,
    evidenceReload: reloadResult(),
    ...baseRefs(),
    attemptId: "attempt-prod-2",
    idempotencyKey: "idempotency-key-2",
    laneConformanceRefs: ["lane-conformance-1"],
    approvalDecision: approval
  });

  assert.equal(drifted.state, "blocked");
  assert.ok(drifted.blocker_labels.includes("pre_dispatch_audit_mismatched"));
  assert.ok(drifted.blocker_labels.includes("dispatch_idempotency_reservation_missing"));
  assert.equal(drifted.managed_dispatch_ready, false);
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

test("Release 2 managed dispatch gate promotion becomes eligible with Phase 6A closure refs and existing production preconditions", () => {
  const closure = phase6AClosure();
  const closureValidation = validateFlowDeskRelease2Phase6AClosureEvidenceV1(
    closure,
    workflowId,
    "phase6a-closure-1"
  );
  assert.equal(closureValidation.ok, true, closureValidation.errors.join("; "));

  const result = evaluateFlowDeskRelease2ManagedDispatchGatePromotionReadinessV1({
    productionEnablement: approvedProductionEnablement(),
    phase6AClosureEvidence: closure,
    expectedPhase6AClosureRef: "phase6a-closure-1",
    requiredPhase6AClosureRefs: [
      "phase6a-plugin-sdk-compat-1",
      "phase6a-fanout-cache-1",
      "phase6a-reviewer-smoke-1"
    ],
    now: Date.parse("2026-06-06T01:00:00.000Z")
  });

  assert.equal(result.ok, true, result.errors.join("; "));
  assert.equal(result.state, "eligible");
  assert.deepEqual(result.blocked_labels, []);
  assert.equal(result.release2_managed_dispatch_gate_ready, true);
  assert.equal(result.phase6a_closed, true);
  assert.equal(result.scoped_explicit_approval_present, true);
  assert.equal(result.fresh_evidence_present, true);
  assert.equal(result.phase6a_closure_ref, "phase6a-closure-1");
  assert.equal(result.dispatch_authority_enabled, false);
  assert.equal(result.fallback_authority_enabled, false);
  assert.equal(result.hard_chat_authority_enabled, false);
  assert.equal(result.external_write_authority_enabled, false);
  assert.equal(result.providerCall, false);
  assert.equal(result.actualLaneLaunch, false);
  assert.equal(result.runtimeExecution, false);
  const validation = validateFlowDeskRelease2ManagedDispatchGatePromotionReadinessV1(result, workflowId);
  assert.equal(validation.ok, true, validation.errors.join("; "));
});

test("Release 2 managed dispatch gate promotion blocks missing, stale, and mismatched Phase 6A closure refs", () => {
  const missing = evaluateFlowDeskRelease2ManagedDispatchGatePromotionReadinessV1({
    productionEnablement: approvedProductionEnablement(),
    now: Date.parse("2026-06-06T01:00:00.000Z")
  });
  assert.equal(missing.state, "blocked");
  assert.ok(missing.blocked_labels.includes("phase6a_closure_missing"));
  assert.equal(missing.release2_managed_dispatch_gate_ready, false);

  const stale = evaluateFlowDeskRelease2ManagedDispatchGatePromotionReadinessV1({
    productionEnablement: approvedProductionEnablement(),
    phase6AClosureEvidence: phase6AClosure({ expires_at: "2026-06-06T00:30:00.000Z" }),
    expectedPhase6AClosureRef: "phase6a-closure-1",
    now: Date.parse("2026-06-06T01:00:00.000Z")
  });
  assert.equal(stale.state, "blocked");
  assert.ok(stale.blocked_labels.includes("phase6a_closure_stale"));
  assert.equal(stale.fresh_evidence_present, false);

  const mismatched = evaluateFlowDeskRelease2ManagedDispatchGatePromotionReadinessV1({
    productionEnablement: approvedProductionEnablement(),
    phase6AClosureEvidence: phase6AClosure({ workflow_id: "workflow-other", closure_ref: "phase6a-closure-other" }),
    expectedPhase6AClosureRef: "phase6a-closure-1",
    requiredPhase6AClosureRefs: ["phase6a-plugin-sdk-compat-1", "phase6a-missing-ref-1"],
    now: Date.parse("2026-06-06T01:00:00.000Z")
  });
  assert.equal(mismatched.state, "blocked");
  assert.ok(mismatched.blocked_labels.includes("phase6a_closure_invalid"));
  assert.ok(mismatched.errors.some((error) => error.includes("workflow_id mismatch")));
  assert.ok(mismatched.errors.some((error) => error.includes("closure_ref mismatch")));
});

test("Release 2 managed dispatch gate promotion blocks authority smuggling and never enables fallback, hard-chat, or write authority", () => {
  const closureValidation = validateFlowDeskRelease2Phase6AClosureEvidenceV1({
    ...phase6AClosure(),
    dispatch_authority_enabled: true,
    fallback_authority_enabled: true,
    hard_chat_authority_enabled: true,
    external_write_authority_enabled: true,
    providerCall: true,
    noReply: true
  });
  assert.equal(closureValidation.ok, false);
  assert.ok(closureValidation.errors.some((error) => error.includes("cannot enable dispatch authority")));
  assert.ok(closureValidation.errors.some((error) => error.includes("cannot enable fallback authority")));
  assert.ok(closureValidation.errors.some((error) => error.includes("cannot enable hard chat authority")));
  assert.ok(closureValidation.errors.some((error) => error.includes("cannot enable external write authority")));
  assert.ok(closureValidation.errors.some((error) => error.includes("unknown properties")));

  const result = evaluateFlowDeskRelease2ManagedDispatchGatePromotionReadinessV1({
    productionEnablement: approvedProductionEnablement(),
    phase6AClosureEvidence: phase6AClosure(),
    now: Date.parse("2026-06-06T01:00:00.000Z")
  });
  const forgedReadinessValidation = validateFlowDeskRelease2ManagedDispatchGatePromotionReadinessV1({
    ...result,
    dispatch_authority_enabled: true,
    fallback_authority_enabled: true,
    hard_chat_authority_enabled: true,
    external_write_authority_enabled: true,
    actualLaneLaunch: true,
    raw_extra: "unsafe"
  });
  assert.equal(forgedReadinessValidation.ok, false);
  assert.ok(forgedReadinessValidation.errors.some((error) => error.includes("generic dispatch authority")));
  assert.ok(forgedReadinessValidation.errors.some((error) => error.includes("fallback authority")));
  assert.ok(forgedReadinessValidation.errors.some((error) => error.includes("hard chat authority")));
  assert.ok(forgedReadinessValidation.errors.some((error) => error.includes("external write authority")));
  assert.ok(forgedReadinessValidation.errors.some((error) => error.includes("unknown properties")));
});

test("Release 2 managed dispatch gate promotion does not bypass provider, policy, pre-call, approval, or idempotency checks", () => {
  const production = approvedProductionEnablement();
  const fullReload = reloadResult();
  const approval = createFlowDeskProductionApprovalDecisionV1({
    approvalId: "approval-1",
    workflowId,
    decision: "approve",
    createdAt: "2026-05-20T00:00:00.000Z",
    requiredEvidenceRefs: ["usage-authority-1", "runtime-echo-1", "telemetry-1", "audit-1", "verification-1", "sanitized-auth-capture-1", "external-auth-policy-1", "provider-policy-1", "lane-conformance-1"]
  });
  const blockedProduction = evaluateFlowDeskProductionEnablementV1({
    workflowId,
    evidenceReload: reloadResult({
      entries: fullReload.entries.filter(
        (entry) =>
          entry.evidenceClass !== "provider_health_snapshot" &&
          entry.evidenceClass !== "pre_dispatch_audit" &&
          entry.evidenceClass !== "dispatch_idempotency"
      )
    }),
    ...baseRefs(),
    attemptId: "attempt-prod-1",
    idempotencyKey: "idempotency-key-1",
    laneConformanceRefs: ["lane-conformance-1"],
    approvalDecision: approval
  });
  assert.equal(blockedProduction.managed_dispatch_ready, false);
  assert.ok(blockedProduction.blocker_labels.includes("provider_health_snapshot_missing"));
  assert.ok(blockedProduction.blocker_labels.includes("pre_dispatch_audit_missing"));
  assert.ok(blockedProduction.blocker_labels.includes("dispatch_idempotency_missing"));

  const result = evaluateFlowDeskRelease2ManagedDispatchGatePromotionReadinessV1({
    productionEnablement: blockedProduction,
    phase6AClosureEvidence: phase6AClosure(),
    now: Date.parse("2026-06-06T01:00:00.000Z")
  });
  assert.equal(production.state, "dispatch_capable", "control production fixture should remain dispatch capable");
  assert.equal(result.state, "blocked");
  assert.equal(result.release2_managed_dispatch_gate_ready, false);
  assert.ok(result.blocked_labels.includes("production_enablement_not_dispatch_capable"));
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
    approvalId: "approval-1",
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
