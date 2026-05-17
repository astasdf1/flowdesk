import type {
  FlowDeskLaneRecordV1,
  FlowDeskLaneSummaryArtifactV1,
  FlowDeskPlanRequestV1,
  FlowDeskPlanResponseV1,
  FlowDeskPlanSummaryArtifactV1,
  FlowDeskWorkflowPlanV1,
  GuardCheckV1,
  IsoTimestamp,
  OpaqueId,
  OpaqueRef,
  WorkflowTaxonomyV1
} from "./release1-contracts.js";
import type { FlowDeskStateWriteIntent } from "./state-store.js";
import { prepareLaneRecordWriteIntent } from "./state-store.js";
import { laneRecordToStatusLaneSummaryV1 } from "./status.js";
import type { ValidationResult } from "./validators.js";
import {
  invalid,
  valid,
  validateLaneSummaryArtifactV1,
  validateOpaqueId,
  validatePlanRequestV1,
  validatePlanResponseV1,
  validatePlanSummaryArtifactV1,
  validateWorkflowPlanV1
} from "./validators.js";

export interface FlowDeskPlanCommandInputV1 {
  request: FlowDeskPlanRequestV1;
  sessionId: OpaqueId;
  workflowId: OpaqueId;
  planRevisionId: OpaqueId;
  planningStepId: OpaqueId;
  laneId: OpaqueId;
  laneTaskRef: OpaqueRef;
  laneSummaryRef: OpaqueRef;
  laneEventRef: OpaqueRef;
  auditRef: OpaqueRef;
  routeRef: OpaqueRef;
  nowIso: IsoTimestamp;
  taxonomy: WorkflowTaxonomyV1;
}

export interface FlowDeskPlanCommandEvaluationV1 extends ValidationResult {
  response: FlowDeskPlanResponseV1;
  workflowPlan?: FlowDeskWorkflowPlanV1;
  planSummaryArtifact?: FlowDeskPlanSummaryArtifactV1;
  laneRecord?: FlowDeskLaneRecordV1;
  laneSummaryArtifact?: FlowDeskLaneSummaryArtifactV1;
  laneRecordIntent?: FlowDeskStateWriteIntent<FlowDeskLaneRecordV1>;
  runtime: {
    realOpenCodeDispatch: false;
    actualLaneLaunch: false;
    providerCall: false;
    automaticFallbackOrReselection: false;
    hardCancelOrNoReply: false;
    stateWriteApplied: false;
  };
}

const inertRuntime = {
  realOpenCodeDispatch: false,
  actualLaneLaunch: false,
  providerCall: false,
  automaticFallbackOrReselection: false,
  hardCancelOrNoReply: false,
  stateWriteApplied: false
} as const;

function resultErrors(...results: ValidationResult[]): string[] {
  return results.flatMap((result) => result.errors);
}

function riskTier(riskHint: string): FlowDeskPlanSummaryArtifactV1["risk_tier"] {
  if (/\b(blocked|unsafe|later-gate|real dispatch|provider call|fallback|hard cancel)\b/i.test(riskHint)) return "blocked";
  if (/\b(high|security|migration|cross-module|provider|dispatch)\b/i.test(riskHint)) return "high";
  if (/\b(medium|multi|several|integration)\b/i.test(riskHint)) return "medium";
  return "low";
}

function blockedResponse(planRevisionId: OpaqueId): FlowDeskPlanResponseV1 {
  return {
    schema_version: "flowdesk.plan.response.v1",
    ok: false,
    status: "blocked",
    safe_next_actions: ["/flowdesk-doctor", "/flowdesk-status"],
    user_message: "FlowDesk blocked plan authoring before any delegated lane record was prepared.",
    plan_revision_id: planRevisionId,
    delegated_authoring_summary: "Plan authoring failed closed with redacted diagnostics only.",
    required_approvals: [],
    guard_precheck: { result: "blocked", required_checks: [{ check: "redaction", result: "fail" }], refs: [] },
    error: {
      category: "schema",
      safe_remediation: "Retry with a schema-valid redacted plan request or run /flowdesk-doctor."
    }
  };
}

function approvalChecks(auditRef: OpaqueRef, routeRef: OpaqueRef): { requiredApprovals: OpaqueRef[]; guardPrecheck: FlowDeskPlanResponseV1["guard_precheck"] } {
  const requiredCheck: GuardCheckV1 = { check: "approval", result: "unknown", ref: auditRef };
  return {
    requiredApprovals: [auditRef],
    guardPrecheck: { result: "requires_approval", required_checks: [requiredCheck], refs: [auditRef, routeRef] }
  };
}

export function buildFlowDeskPlanArtifactsV1(input: FlowDeskPlanCommandInputV1): Omit<FlowDeskPlanCommandEvaluationV1, "ok" | "errors"> {
  const { requiredApprovals, guardPrecheck } = approvalChecks(input.auditRef, input.routeRef);
  const stepTitle = "Command-backed Release 1 planning summary";
  const workflowPlan: FlowDeskWorkflowPlanV1 = {
    schema_version: "flowdesk.workflow_plan.v1",
    plan_revision_id: input.planRevisionId,
    workflow_id: input.workflowId,
    created_at: input.nowIso,
    taxonomy: input.taxonomy,
    steps: [
      {
        step_id: input.planningStepId,
        title: stepTitle,
        state: "ready_to_run",
        lane_class: "planning_draft",
        requires_guard: true,
        required_fresh_checks: [{ check: "audit", required: true, ref: input.auditRef }]
      }
    ],
    required_approvals: guardPrecheck.required_checks,
    verification_summary: "Plan is command-backed and cannot dispatch in Release 1."
  };
  const planSummaryArtifact: FlowDeskPlanSummaryArtifactV1 = {
    schema_version: "flowdesk.plan_summary.v1",
    plan_revision_id: input.planRevisionId,
    workflow_id: input.workflowId,
    created_at: input.nowIso,
    goal_summary: input.request.goal_summary,
    scope_summary: input.request.scope_summary,
    risk_tier: riskTier(input.request.risk_hint),
    required_approvals: guardPrecheck.required_checks,
    step_summary_refs: [input.laneSummaryRef],
    verification_summary: "Delegated authoring is represented as redacted lane records only."
  };
  const laneRecord: FlowDeskLaneRecordV1 = {
    schema_version: "flowdesk.lane_record.v1",
    lane_id: input.laneId,
    workflow_id: input.workflowId,
    plan_revision_id: input.planRevisionId,
    task_ref: input.laneTaskRef,
    lane_class: "planning_draft",
    state: "completed",
    created_at: input.nowIso,
    started_at: input.nowIso,
    updated_at: input.nowIso,
    completed_at: input.nowIso,
    safe_next_action: "/flowdesk-status",
    refs: [input.laneSummaryRef],
    event_refs: [input.laneEventRef],
    audit_refs: [input.auditRef]
  };
  const laneSummaryArtifact: FlowDeskLaneSummaryArtifactV1 = {
    schema_version: "flowdesk.lane_summary.v1",
    ...laneRecordToStatusLaneSummaryV1(laneRecord, { planRevisionId: input.planRevisionId })
  };
  const response: FlowDeskPlanResponseV1 = {
    schema_version: "flowdesk.plan.response.v1",
    ok: true,
    status: "ready",
    workflow_id: input.workflowId,
    audit_ref: input.auditRef,
    safe_next_actions: ["/flowdesk-run", "/flowdesk-status"],
    user_message: "FlowDesk prepared a command-backed Release 1 plan. No dispatch or lane launch occurred.",
    plan_revision_id: input.planRevisionId,
    delegated_authoring_summary: "Delegated workflow authoring was recorded as an inert planning lane summary.",
    required_approvals: requiredApprovals,
    guard_precheck: guardPrecheck
  };
  const laneRecordIntent = prepareLaneRecordWriteIntent(input.sessionId, laneRecord).writeIntent;
  return { response, workflowPlan, planSummaryArtifact, laneRecord, laneSummaryArtifact, laneRecordIntent, runtime: inertRuntime };
}

export function evaluateFlowDeskPlanCommandV1(input: FlowDeskPlanCommandInputV1): FlowDeskPlanCommandEvaluationV1 {
  const planRevisionResult = validateOpaqueId(input.planRevisionId, "plan_revision_id");
  const requestResult = validatePlanRequestV1(input.request);
  const idErrors = resultErrors(
    validateOpaqueId(input.sessionId, "session_id"),
    validateOpaqueId(input.workflowId, "workflow_id"),
    planRevisionResult,
    validateOpaqueId(input.planningStepId, "planning_step_id"),
    validateOpaqueId(input.laneId, "lane_id"),
    validateOpaqueId(input.laneTaskRef, "lane_task_ref"),
    validateOpaqueId(input.laneSummaryRef, "lane_summary_ref"),
    validateOpaqueId(input.laneEventRef, "lane_event_ref"),
    validateOpaqueId(input.auditRef, "audit_ref"),
    validateOpaqueId(input.routeRef, "route_ref")
  );
  const baseErrors = [...requestResult.errors, ...idErrors];
  if (input.request.workflow_id !== undefined && input.request.workflow_id !== input.workflowId) baseErrors.push("plan request workflow id does not match workflow id");
  if (baseErrors.length > 0) {
    const response = blockedResponse(planRevisionResult.ok ? input.planRevisionId : "plan-blocked");
    const responseResult = validatePlanResponseV1(response);
    return { ok: false, errors: [...baseErrors, ...responseResult.errors], response, runtime: inertRuntime };
  }

  const artifacts = buildFlowDeskPlanArtifactsV1(input);
  const validationErrors = resultErrors(
    validatePlanResponseV1(artifacts.response),
    validateWorkflowPlanV1(artifacts.workflowPlan),
    validatePlanSummaryArtifactV1(artifacts.planSummaryArtifact),
    validateLaneSummaryArtifactV1(artifacts.laneSummaryArtifact),
    artifacts.laneRecordIntent === undefined ? invalid("lane record write intent is required") : valid()
  );
  if (validationErrors.length > 0) return { ok: false, errors: validationErrors, ...artifacts };
  return { ok: true, errors: [], ...artifacts };
}
