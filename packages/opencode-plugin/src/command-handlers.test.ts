import assert from "node:assert/strict";
import test from "node:test";
import type {
  FlowDeskAttemptRecordV1,
  FlowDeskFds1FixtureCatalogEntryV1,
  FlowDeskLaneRecordV1,
  FlowDeskPlanCommandInputV1,
  FlowDeskProviderHealthSnapshotV1,
  FlowDeskRelease1MinimumToolName,
  FlowDeskStatusCommandInputV1,
  FlowDeskWorkflowActiveV1,
  FlowDeskWorkflowRecordV1,
  WorkflowTaxonomyV1
} from "@flowdesk/core";
import { FLOWDESK_FDS1_FIXTURE_CATALOG } from "@flowdesk/core";
import type { FlowDeskCommandBackedHandlerResultV1 } from "./index.js";
import { evaluateFlowDeskCommandBackedHandlerV1 } from "./index.js";

const nowIso = "2026-05-17T00:00:00.000Z";

const taxonomy: WorkflowTaxonomyV1 = {
  primary_category: "coding",
  difficulty_drivers: ["bounded Release 1 command handler test"],
  coupling_scope: "few_files",
  algorithmic_hardness: "low",
  architecture_hardness: "low",
  migration_state_hardness: "none",
  domain_uncertainty: "low",
  verification_hardness: "low",
  operational_risk: "low",
  policy_professional_boundary: "ordinary"
};

function requestFixture(toolName: FlowDeskRelease1MinimumToolName, category: "valid.minimal" | "invalid.unknown-property" = "valid.minimal"): Readonly<Record<string, unknown>> {
  const fixture = FLOWDESK_FDS1_FIXTURE_CATALOG.find((entry): entry is FlowDeskFds1FixtureCatalogEntryV1 => entry.toolName === toolName && entry.schemaKind === "tool_request");
  assert.ok(fixture, toolName);
  return fixture.categories[category].sample;
}

function workflowIdFrom(request: Readonly<Record<string, unknown>>): string {
  return typeof request.workflow_id === "string" ? request.workflow_id : "workflow-123";
}

function assertNoRuntimeAuthority(result: FlowDeskCommandBackedHandlerResultV1): void {
  assert.equal(result.productionRegistrationEligible, false);
  assert.equal(result.realOpenCodeDispatch, false);
  assert.equal(result.actualLaneLaunch, false);
  assert.equal(result.providerCall, false);
  assert.equal(result.runtimeExecution, false);
  assert.equal(result.fallbackAuthority, false);
  assert.equal(result.hardCancelOrNoReplyAuthority, false);
}

function planContext(request: Readonly<Record<string, unknown>>): Omit<FlowDeskPlanCommandInputV1, "request"> {
  const workflowId = workflowIdFrom(request);
  return {
    sessionId: "session-123",
    workflowId,
    planRevisionId: "plan-123",
    planningStepId: "step-plan-123",
    laneId: "lane-plan-123",
    laneTaskRef: "task-plan-123",
    laneSummaryRef: "lane-summary-123",
    laneEventRef: "event-plan-123",
    auditRef: "audit-123",
    routeRef: "route-123",
    nowIso,
    taxonomy
  };
}

function active(workflowId: string): FlowDeskWorkflowActiveV1 {
  return {
    schema_version: "flowdesk.workflow_active.v1",
    active_workflow_id: workflowId,
    active_attempt_id: "attempt-123",
    state: "complete",
    updated_at: nowIso,
    status_summary_ref: "status-summary-123",
    audit_refs: ["audit-123"]
  };
}

function workflow(workflowId: string): FlowDeskWorkflowRecordV1 {
  return {
    schema_version: "flowdesk.workflow_record.v1",
    workflow_id: workflowId,
    session_ref: "session-ref-123",
    created_at: nowIso,
    updated_at: nowIso,
    state: "complete",
    latest_plan_revision_id: "plan-123",
    current_step_id: "step-123",
    project_root_ref: "project-root-ref-123",
    config_hash: "config-hash-123",
    policy_pack_id: "policy-123",
    policy_pack_hash: "policy-hash-123",
    current_attempt_id: "attempt-123",
    attempt_refs: ["attempt-ref-123"],
    checkpoint_refs: [],
    lane_refs: ["lane-ref-123"],
    latest_lane_summary_refs: ["lane-summary-123"],
    audit_refs: ["audit-123"],
    status_summary_ref: "status-summary-123",
    artifact_disposition: "quarantined",
    safe_next_actions: ["/flowdesk-status"]
  };
}

function attempt(workflowId: string): FlowDeskAttemptRecordV1 {
  return {
    schema_version: "flowdesk.attempt_record.v1",
    attempt_id: "attempt-123",
    workflow_id: workflowId,
    step_id: "step-123",
    created_at: nowIso,
    updated_at: nowIso,
    run_mode: "fake-runtime",
    state_at_start: "ready_to_run",
    state_at_end: "complete",
    attempt_state: "complete",
    guard_decision_ref: "guard-123",
    command_shape_hash: "command-shape-hash-123",
    pre_run_audit_ref: "audit-pre-123",
    runtime_echo_validation: "not_applicable",
    verification_ref: "verification-123",
    artifact_disposition: "quarantined",
    outcome_audit_ref: "audit-outcome-123",
    safe_next_actions: ["/flowdesk-status", "/flowdesk-export-debug"]
  };
}

function laneRecord(workflowId: string): FlowDeskLaneRecordV1 {
  return {
    schema_version: "flowdesk.lane_record.v1",
    lane_id: "lane-123",
    workflow_id: workflowId,
    plan_revision_id: "plan-123",
    attempt_id: "attempt-123",
    task_ref: "task-123",
    lane_class: "verification",
    state: "completed",
    created_at: nowIso,
    started_at: nowIso,
    updated_at: nowIso,
    completed_at: nowIso,
    safe_next_action: "/flowdesk-status",
    refs: ["lane-summary-123"],
    event_refs: ["event-123"],
    audit_refs: ["audit-123"],
    debug_ref: "debug-123"
  };
}

function providerHealth(): FlowDeskProviderHealthSnapshotV1 {
  return {
    schema_version: "flowdesk.provider_health_snapshot.v1",
    snapshot_id: "health-123",
    provider_family: "opencode_go",
    model_family: "unknown",
    observed_at: nowIso,
    freshness: "fresh",
    freshness_ttl: 5,
    source_surface: "doctor_probe",
    availability_state: "healthy",
    failure_class: "none",
    dispatchability: "diagnostic_only",
    source_ref: "health-source-123",
    safe_remediation: "Run /flowdesk-doctor to refresh provider diagnostics."
  };
}

function statusContext(request: Readonly<Record<string, unknown>>): Omit<FlowDeskStatusCommandInputV1, "request"> {
  const workflowId = workflowIdFrom(request);
  return {
    active: active(workflowId),
    workflow: workflow(workflowId),
    currentAttempt: attempt(workflowId),
    laneRecords: [laneRecord(workflowId)],
    providerHealthSnapshot: providerHealth(),
    auditRef: "audit-123",
    debugRef: "debug-123",
    now: Date.parse(nowIso)
  };
}

test("command-backed handlers execute core evaluators for schema-valid requests without runtime authority", () => {
  const planRequest = requestFixture("flowdesk_plan");
  const statusRequest = requestFixture("flowdesk_status");
  const retryRequest = requestFixture("flowdesk_retry");
  const cases: readonly [FlowDeskRelease1MinimumToolName, Readonly<Record<string, unknown>>, Parameters<typeof evaluateFlowDeskCommandBackedHandlerV1>[2]][] = [
    ["flowdesk_plan", planRequest, { plan: planContext(planRequest) }],
    ["flowdesk_status", statusRequest, { status: statusContext(statusRequest) }],
    ["flowdesk_retry", retryRequest, { retry: { providerHealthSnapshot: providerHealth(), newAttemptId: "attempt-retry-123", auditRef: "audit-123", debugRef: "debug-123" } }]
  ];

  for (const [toolName, request, context] of cases) {
    const result = evaluateFlowDeskCommandBackedHandlerV1(toolName, request, context);
    assert.equal(result.handlerMode, "command_backed_core_evaluator", toolName);
    assert.equal(result.ok, true, toolName);
    assert.equal(result.requestSchemaValid, true, toolName);
    assert.equal(result.responseSchemaValid, true, toolName);
    assert.equal(result.coreEvaluationOk, true, toolName);
    assert.notEqual(result.response, undefined, toolName);
    assertNoRuntimeAuthority(result);
  }
});

test("command-backed handlers fail closed before evaluator execution for unknown request properties", () => {
  const request = requestFixture("flowdesk_plan", "invalid.unknown-property");
  const result = evaluateFlowDeskCommandBackedHandlerV1("flowdesk_plan", request, { plan: planContext(request) });
  assert.equal(result.handlerMode, "request_schema_invalid");
  assert.equal(result.ok, false);
  assert.equal(result.requestSchemaValid, false);
  assert.equal(result.responseSchemaValid, false);
  assert.equal(result.coreEvaluationOk, false);
  assert.equal(result.response, undefined);
  assertNoRuntimeAuthority(result);
});

test("command-backed handlers require evaluator input for core-backed tools", () => {
  const request = requestFixture("flowdesk_status");
  const result = evaluateFlowDeskCommandBackedHandlerV1("flowdesk_status", request);
  assert.equal(result.handlerMode, "missing_evaluator_input");
  assert.equal(result.ok, false);
  assert.equal(result.requestSchemaValid, true);
  assert.equal(result.responseSchemaValid, false);
  assert.equal(result.coreEvaluationOk, false);
  assert.equal(result.response, undefined);
  assertNoRuntimeAuthority(result);
});

test("schema-only pending handlers remain non-dispatch pending after request validation", () => {
  const request = requestFixture("flowdesk_usage");
  const result = evaluateFlowDeskCommandBackedHandlerV1("flowdesk_usage", request);
  assert.equal(result.handlerMode, "schema_only_pending");
  assert.equal(result.ok, false);
  assert.equal(result.requestSchemaValid, true);
  assert.equal(result.responseSchemaValid, false);
  assert.equal(result.coreEvaluationOk, false);
  assert.equal(result.response, undefined);
  assertNoRuntimeAuthority(result);
});
