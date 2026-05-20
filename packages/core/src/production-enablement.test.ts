import assert from "node:assert/strict";
import test from "node:test";
import type { FlowDeskSessionEvidenceReloadResultV1 } from "./index.js";
import {
  createFlowDeskProductionApprovalDecisionV1,
  evaluateFlowDeskProductionEnablementV1,
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
    externalAuthPolicyRef: "external-auth-policy-1",
    providerPolicyRef: "provider-policy-1"
  };
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
    requiredEvidenceRefs: ["usage-authority-1", "runtime-echo-1", "telemetry-1", "audit-1", "verification-1", "external-auth-policy-1", "provider-policy-1", "lane-conformance-1"]
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
});

test("production enablement records incomplete conformance as non-blocking uncertainty when opted in", () => {
  const approval = createFlowDeskProductionApprovalDecisionV1({
    approvalId: "approval-2",
    workflowId,
    decision: "approve",
    createdAt: "2026-05-20T00:00:00.000Z",
    requiredEvidenceRefs: ["usage-authority-1", "runtime-echo-1", "telemetry-1", "audit-1", "verification-1", "external-auth-policy-1", "provider-policy-1"],
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

test("production enablement does not become dispatch-capable with malformed lane conformance refs", () => {
  const approval = createFlowDeskProductionApprovalDecisionV1({
    approvalId: "approval-4",
    workflowId,
    decision: "approve",
    createdAt: "2026-05-20T00:00:00.000Z",
    requiredEvidenceRefs: ["usage-authority-1", "runtime-echo-1", "telemetry-1", "audit-1", "verification-1", "external-auth-policy-1", "provider-policy-1"]
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
