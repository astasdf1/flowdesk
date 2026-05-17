import assert from "node:assert/strict";
import test from "node:test";
import type { FlowDeskPlanRequestV1, WorkflowTaxonomyV1 } from "./index.js";
import {
  evaluateFlowDeskPlanCommandV1,
  validateFlowDeskStateWriteIntent,
  validateLaneSummaryArtifactV1,
  validatePlanRequestV1,
  validatePlanResponseV1,
  validatePlanSummaryArtifactV1,
  validateWorkflowPlanV1
} from "./index.js";

const now = "2026-05-17T00:00:00.000Z";

const taxonomy: WorkflowTaxonomyV1 = {
  primary_category: "coding",
  difficulty_drivers: ["bounded Release 1 planning"],
  coupling_scope: "few_files",
  algorithmic_hardness: "low",
  architecture_hardness: "low",
  migration_state_hardness: "none",
  domain_uncertainty: "low",
  verification_hardness: "low",
  operational_risk: "low",
  policy_professional_boundary: "ordinary"
};

function request(overrides: Partial<FlowDeskPlanRequestV1> = {}): FlowDeskPlanRequestV1 {
  return {
    schema_version: "flowdesk.plan.request.v1",
    request_id: "request-123",
    input_mode: "test_fixture",
    workflow_id: "workflow-123",
    goal_summary: "Add a guarded command-backed status improvement.",
    scope_summary: "Core-only Release 1 planning artifacts.",
    risk_hint: "low",
    ...overrides
  };
}

function input(overrides: Partial<Parameters<typeof evaluateFlowDeskPlanCommandV1>[0]> = {}): Parameters<typeof evaluateFlowDeskPlanCommandV1>[0] {
  return {
    request: request(),
    sessionId: "session-123",
    workflowId: "workflow-123",
    planRevisionId: "plan-123",
    planningStepId: "step-plan-123",
    laneId: "lane-plan-123",
    laneTaskRef: "task-plan-123",
    laneSummaryRef: "lane-summary-123",
    laneEventRef: "event-plan-123",
    auditRef: "audit-123",
    routeRef: "route-123",
    nowIso: now,
    taxonomy,
    ...overrides
  };
}

test("plan evaluator returns schema-valid delegated authoring records without runtime authority", () => {
  const result = evaluateFlowDeskPlanCommandV1(input());
  assert.equal(result.ok, true);
  assert.equal(validatePlanResponseV1(result.response).ok, true);
  assert.equal(validateWorkflowPlanV1(result.workflowPlan).ok, true);
  assert.equal(validatePlanSummaryArtifactV1(result.planSummaryArtifact).ok, true);
  assert.equal(validateLaneSummaryArtifactV1(result.laneSummaryArtifact).ok, true);
  assert.equal(result.response.plan_revision_id, "plan-123");
  assert.deepEqual(result.response.safe_next_actions, ["/flowdesk-run", "/flowdesk-status"]);
  assert.equal(result.response.guard_precheck.result, "requires_approval");
  assert.equal(result.workflowPlan?.steps[0]?.lane_class, "planning_draft");
  assert.equal(result.laneRecord?.state, "completed");
  assert.equal(result.laneRecord?.safe_next_action, "/flowdesk-status");
  assert.ok(result.laneRecordIntent);
  assert.equal(validateFlowDeskStateWriteIntent(result.laneRecordIntent).ok, true);
  assert.deepEqual(result.runtime, {
    realOpenCodeDispatch: false,
    actualLaneLaunch: false,
    providerCall: false,
    automaticFallbackOrReselection: false,
    hardCancelOrNoReply: false,
    stateWriteApplied: false
  });
});

test("plan evaluator fails closed for raw or mismatched requests", () => {
  assert.equal(validatePlanRequestV1({ ...request(), goal_summary: "system prompt: raw provider response" }).ok, false);
  const result = evaluateFlowDeskPlanCommandV1(input({ request: request({ workflow_id: "workflow-other" }) }));
  assert.equal(result.ok, false);
  assert.equal(result.response.ok, false);
  assert.equal(result.response.safe_next_actions.includes("/flowdesk-run"), false);
  assert.equal(validatePlanResponseV1(result.response).ok, true);
  assert.equal(JSON.stringify(result.response).includes("workflow-other"), false);

  const malformedTaxonomy = { ...taxonomy, primary_category: "real_dispatch" } as unknown as WorkflowTaxonomyV1;
  const malformedResult = evaluateFlowDeskPlanCommandV1(input({ taxonomy: malformedTaxonomy }));
  assert.equal(malformedResult.ok, false);
  assert.equal(malformedResult.response.ok, true);
  assert.equal(malformedResult.errors.some((error) => error.includes("taxonomy.primary_category")), true);
});

test("plan artifacts reject future runtime authority and raw refs", () => {
  const result = evaluateFlowDeskPlanCommandV1(input({ request: request({ risk_hint: "real dispatch blocked" }) }));
  assert.equal(result.ok, true);
  assert.equal(result.planSummaryArtifact?.risk_tier, "blocked");
  assert.equal(validateLaneSummaryArtifactV1({ ...result.laneSummaryArtifact, debug_ref: "/Users/example/raw.log" }).ok, false);
  const text = JSON.stringify(result);
  assert.equal(/fallbackAuthority|hard_cancel_proven|provider payload|raw provider|system prompt/i.test(text), false);
  assert.equal(result.runtime.realOpenCodeDispatch, false);
  assert.equal(result.runtime.actualLaneLaunch, false);
  assert.equal(result.runtime.providerCall, false);
});
