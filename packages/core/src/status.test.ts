import assert from "node:assert/strict";
import test from "node:test";
import type {
  FlowDeskAttemptRecordV1,
  FlowDeskCheckpointRecordV1,
  FlowDeskLaneRecordV1,
  FlowDeskProviderHealthSnapshotV1,
  FlowDeskStatusRequestV1,
  FlowDeskStatusSummaryArtifactV1,
  FlowDeskWorkflowActiveV1,
  FlowDeskWorkflowRecordV1,
  ProviderFailureClass,
  ResumeModeV1
} from "./index.js";
import {
  buildFlowDeskStatusResponseV1,
  buildFlowDeskStatusSummaryArtifactV1,
  evaluateFlowDeskStatusCommandV1,
  laneRecordToStatusLaneSummaryV1,
  PROVIDER_FAILURE_CLASSES,
  providerHealthSnapshotToSummaryV1,
  validateProviderHealthSummaryV1,
  validateStatusLaneSummaryV1,
  validateStatusRequestV1,
  validateStatusResponseV1,
  validateStatusSummaryArtifactV1
} from "./index.js";

const now = "2026-05-17T00:00:00.000Z";
const later = "2026-05-18T00:00:00.000Z";
const workflowId = "workflow-123";
const attemptId = "attempt-123";
const checkpointId = "checkpoint-123";

function request(overrides: Partial<FlowDeskStatusRequestV1> = {}): FlowDeskStatusRequestV1 {
  return {
    schema_version: "flowdesk.status.request.v1",
    request_id: "request-123",
    input_mode: "test_fixture",
    workflow_id: workflowId,
    detail_level: "summary",
    ...overrides
  };
}

function active(overrides: Partial<FlowDeskWorkflowActiveV1> = {}): FlowDeskWorkflowActiveV1 {
  return {
    schema_version: "flowdesk.workflow_active.v1",
    active_workflow_id: workflowId,
    active_attempt_id: attemptId,
    state: "complete",
    updated_at: now,
    status_summary_ref: "status-summary-123",
    audit_refs: ["audit-123"],
    ...overrides
  };
}

function workflow(overrides: Partial<FlowDeskWorkflowRecordV1> = {}): FlowDeskWorkflowRecordV1 {
  return {
    schema_version: "flowdesk.workflow_record.v1",
    workflow_id: workflowId,
    session_ref: "session-ref-123",
    created_at: now,
    updated_at: now,
    state: "complete",
    latest_plan_revision_id: "plan-123",
    current_step_id: "step-123",
    project_root_ref: "project-root-ref-123",
    config_hash: "config-hash-123",
    policy_pack_id: "policy-123",
    policy_pack_hash: "policy-hash-123",
    current_attempt_id: attemptId,
    attempt_refs: ["attempt-ref-123"],
    checkpoint_refs: [],
    lane_refs: ["lane-ref-123"],
    latest_lane_summary_refs: ["lane-summary-123"],
    audit_refs: ["audit-123"],
    status_summary_ref: "status-summary-123",
    artifact_disposition: "quarantined",
    safe_next_actions: ["/flowdesk-status"],
    ...overrides
  };
}

function attempt(overrides: Partial<FlowDeskAttemptRecordV1> = {}): FlowDeskAttemptRecordV1 {
  return {
    schema_version: "flowdesk.attempt_record.v1",
    attempt_id: attemptId,
    workflow_id: workflowId,
    step_id: "step-123",
    created_at: now,
    updated_at: now,
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
    safe_next_actions: ["/flowdesk-status", "/flowdesk-export-debug"],
    ...overrides
  };
}

function laneRecord(overrides: Partial<FlowDeskLaneRecordV1> = {}): FlowDeskLaneRecordV1 {
  return {
    schema_version: "flowdesk.lane_record.v1",
    lane_id: "lane-123",
    workflow_id: workflowId,
    plan_revision_id: "plan-123",
    attempt_id: attemptId,
    task_ref: "task-123",
    lane_class: "verification",
    state: "completed",
    created_at: now,
    started_at: now,
    updated_at: now,
    completed_at: now,
    safe_next_action: "/flowdesk-status",
    refs: ["lane-summary-123"],
    event_refs: ["event-123"],
    audit_refs: ["audit-123"],
    debug_ref: "debug-123",
    ...overrides
  };
}

function providerHealth(overrides: Partial<FlowDeskProviderHealthSnapshotV1> = {}): FlowDeskProviderHealthSnapshotV1 {
  return {
    schema_version: "flowdesk.provider_health_snapshot.v1",
    snapshot_id: "health-123",
    provider_family: "opencode_go",
    model_family: "unknown",
    observed_at: now,
    freshness: "fresh",
    freshness_ttl: 5,
    source_surface: "doctor_probe",
    availability_state: "healthy",
    failure_class: "none",
    dispatchability: "diagnostic_only",
    source_ref: "health-source-123",
    safe_remediation: "Run /flowdesk-doctor to refresh provider diagnostics.",
    ...overrides
  };
}

function checkpoint(resumeMode: ResumeModeV1): FlowDeskCheckpointRecordV1 {
  return {
    schema_version: "flowdesk.checkpoint_record.v1",
    checkpoint_id: checkpointId,
    workflow_id: workflowId,
    attempt_id: attemptId,
    current_step_id: "step-123",
    created_at: now,
    expires_at: later,
    resume_mode: resumeMode,
    required_fresh_checks: [{ check: "audit", required: true, ref: "audit-123" }],
    audit_refs: ["audit-123"],
    artifact_refs: ["artifact-123"],
    reason: resumeMode === "retry" ? "retryable_failure" : "planned_pause",
    safe_next_actions: ["/flowdesk-status"]
  };
}

function statusInput(overrides: Partial<Parameters<typeof buildFlowDeskStatusResponseV1>[0]> = {}): Parameters<typeof buildFlowDeskStatusResponseV1>[0] {
  return {
    request: request(),
    active: active(),
    workflow: workflow(),
    currentAttempt: attempt(),
    laneRecords: [laneRecord()],
    providerHealthSnapshot: providerHealth(),
    auditRef: "audit-123",
    debugRef: "debug-123",
    now: Date.parse(now),
    ...overrides
  };
}

test("status builder returns schema-valid summary after fake-runtime complete workflow state", () => {
  const result = evaluateFlowDeskStatusCommandV1(statusInput());
  assert.equal(result.ok, true);
  assert.equal(validateStatusResponseV1(result.response).ok, true);
  assert.equal(result.response.ok, true);
  assert.equal(result.response.status, "ready");
  assert.equal(result.response.workflow_state, "complete");
  assert.equal(result.response.current_step_id, "step-123");
  assert.equal(result.response.lane_summaries.length, 1);
  assert.equal(result.response.lane_refs, undefined);
  assert.deepEqual(result.response.safe_next_actions, ["/flowdesk-status", "/flowdesk-export-debug"]);
});

test("lane record conversion produces display-only summaries with opaque debug refs", () => {
  const summary = laneRecordToStatusLaneSummaryV1(laneRecord(), { logRef: "log-123" });
  assert.equal((summary as { schema_version?: unknown }).schema_version, undefined);
  assert.equal(summary.debug_ref, "debug-123");
  assert.equal(summary.log_ref, "log-123");
  assert.deepEqual(summary.refs, ["lane-summary-123"]);
  assert.equal(validateStatusLaneSummaryV1(summary).ok, true);

  const withLaneRefs = buildFlowDeskStatusResponseV1(statusInput({ request: request({ detail_level: "lane_refs" }) }));
  assert.deepEqual(withLaneRefs.lane_refs, ["lane-ref-123"]);
  assert.equal(withLaneRefs.lane_summaries.length, 1);
});

test("unknown and degraded provider health stay diagnostic and non-authorizing", () => {
  const unknown = providerHealthSnapshotToSummaryV1(providerHealth({ freshness: "unknown", freshness_ttl: 0, availability_state: "unknown", failure_class: "telemetry_ambiguous", dispatchability: "non_dispatchable" }));
  assert.equal(unknown.availability_state, "unknown");
  assert.equal(unknown.dispatchability, "non_dispatchable");
  assert.equal(validateProviderHealthSummaryV1(unknown).ok, true);

  const degraded = providerHealthSnapshotToSummaryV1(providerHealth({ availability_state: "degraded", failure_class: "none", dispatchability: "diagnostic_only" }));
  assert.equal(degraded.availability_state, "degraded");
  assert.equal(degraded.dispatchability, "diagnostic_only");
  assert.equal(validateProviderHealthSummaryV1(degraded).ok, true);
});

test("missing, session-only, and mismatched workflow state fail closed", () => {
  const sessionOnly = buildFlowDeskStatusResponseV1(statusInput({ request: request({ workflow_id: undefined }), active: undefined, workflow: undefined, currentAttempt: undefined, laneRecords: [laneRecord()] }));
  assert.equal(sessionOnly.ok, false);
  assert.deepEqual(sessionOnly.safe_next_actions, ["/flowdesk-status", "/flowdesk-export-debug"]);
  assert.equal(sessionOnly.lane_summaries.length, 0);
  assert.equal(validateStatusSummaryArtifactV1(buildFlowDeskStatusSummaryArtifactV1(sessionOnly)).ok, false);

  const mismatched = buildFlowDeskStatusResponseV1(statusInput({ active: active({ active_workflow_id: "workflow-other" }) }));
  assert.equal(mismatched.ok, false);
  assert.equal(validateStatusResponseV1(mismatched).ok, true);
  assert.equal(mismatched.safe_next_actions.includes("/flowdesk-resume"), false);
  assert.equal(mismatched.safe_next_actions.includes("/flowdesk-retry"), false);
  assert.equal(mismatched.safe_next_actions.includes("/flowdesk-abort"), true);
});

test("fail-closed status output redacts validator details and malformed input", () => {
  const rawRequest = {
    ...request(),
    provider_payload: "raw provider response",
    "/Users/example/raw.log": "system prompt: leak instructions"
  } as unknown as FlowDeskStatusRequestV1;
  const reflectedInput = buildFlowDeskStatusResponseV1(statusInput({ request: rawRequest }));
  const reflectedText = JSON.stringify(reflectedInput);
  assert.equal(reflectedInput.ok, false);
  assert.equal(validateStatusResponseV1(reflectedInput).ok, true);
  assert.equal(/provider_payload|raw provider|system prompt|Users|raw\.log/i.test(reflectedText), false);
  assert.equal(reflectedInput.error?.safe_remediation, "Refresh durable workflow state and inspect redacted debug output before taking recovery actions.");

  const malformed = buildFlowDeskStatusResponseV1(undefined as unknown as Parameters<typeof buildFlowDeskStatusResponseV1>[0]);
  assert.equal(malformed.ok, false);
  assert.deepEqual(malformed.safe_next_actions, ["/flowdesk-status", "/flowdesk-export-debug"]);
  assert.equal(validateStatusResponseV1(malformed).ok, true);
});

test("checkpoint resume modes map only to conservative recovery actions", () => {
  const modes: Record<ResumeModeV1, readonly string[]> = {
    resume: ["/flowdesk-status", "/flowdesk-export-debug", "/flowdesk-resume"],
    retry: ["/flowdesk-status", "/flowdesk-export-debug", "/flowdesk-retry"],
    abort_only: ["/flowdesk-status", "/flowdesk-export-debug", "/flowdesk-abort"],
    status_only: ["/flowdesk-status", "/flowdesk-export-debug"]
  };
  for (const [mode, actions] of Object.entries(modes) as [ResumeModeV1, readonly string[]][]) {
    const response = buildFlowDeskStatusResponseV1(
      statusInput({
        active: active({ state: "blocked" }),
        workflow: workflow({ state: "blocked", latest_checkpoint_id: checkpointId, checkpoint_refs: ["checkpoint-ref-123"] }),
        currentAttempt: attempt({ attempt_state: "blocked", state_at_end: "blocked" }),
        checkpoint: checkpoint(mode)
      })
    );
    assert.equal(validateStatusResponseV1(response).ok, true);
    assert.equal(response.checkpoint_id, checkpointId);
    assert.deepEqual(response.safe_next_actions, actions);
  }
});

test("provider health ambiguity suppresses event-dependent resume and retry actions", () => {
  for (const mode of ["resume", "retry"] as ResumeModeV1[]) {
    const response = buildFlowDeskStatusResponseV1(
      statusInput({
        active: active({ state: "blocked" }),
        workflow: workflow({ state: "blocked", latest_checkpoint_id: checkpointId, checkpoint_refs: ["checkpoint-ref-123"] }),
        currentAttempt: attempt({ attempt_state: "blocked", state_at_end: "blocked" }),
        checkpoint: checkpoint(mode),
        providerHealthSnapshot: providerHealth({ availability_state: "unknown", freshness: "unknown", freshness_ttl: 0, failure_class: "telemetry_ambiguous", dispatchability: "non_dispatchable" })
      })
    );
    assert.equal(validateStatusResponseV1(response).ok, true);
    assert.equal(response.status, "blocked");
    assert.deepEqual(response.safe_next_actions, ["/flowdesk-status", "/flowdesk-export-debug"]);
  }
});

test("status suppresses unsafe retry and resume for every provider failure class", () => {
  for (const failureClass of PROVIDER_FAILURE_CLASSES.filter((candidate): candidate is Exclude<ProviderFailureClass, "none"> => candidate !== "none")) {
    const response = buildFlowDeskStatusResponseV1(
      statusInput({
        active: active({ state: "blocked" }),
        workflow: workflow({ state: "blocked", latest_checkpoint_id: checkpointId, checkpoint_refs: ["checkpoint-ref-123"] }),
        currentAttempt: attempt({ attempt_state: "blocked", state_at_end: "blocked" }),
        checkpoint: checkpoint("retry"),
        providerHealthSnapshot: providerHealth({ availability_state: failureClass === "telemetry_ambiguous" || failureClass === "transport_timeout" ? "unknown" : "unavailable", freshness: "unknown", freshness_ttl: 0, failure_class: failureClass, dispatchability: "non_dispatchable" })
      })
    );
    assert.equal(validateStatusResponseV1(response).ok, true, failureClass);
    assert.equal(response.safe_next_actions.includes("/flowdesk-retry"), false, failureClass);
    assert.equal(response.safe_next_actions.includes("/flowdesk-resume"), false, failureClass);
    assert.equal(response.safe_next_actions.includes("/flowdesk-run"), false, failureClass);
    assert.notEqual(response.provider_health_summary.dispatchability, "dispatchable", failureClass);
  }
});

test("lane correlation loss suppresses event-dependent resume and retry actions", () => {
  for (const failureClass of ["correlation_lost", "telemetry_unavailable"] as const) {
    const response = buildFlowDeskStatusResponseV1(
      statusInput({
        active: active({ state: "blocked" }),
        workflow: workflow({ state: "blocked", latest_checkpoint_id: checkpointId, checkpoint_refs: ["checkpoint-ref-123"] }),
        currentAttempt: attempt({ attempt_state: "blocked", state_at_end: "blocked" }),
        checkpoint: checkpoint("retry"),
        laneRecords: [laneRecord({ failure_class: failureClass })]
      })
    );
    assert.equal(validateStatusResponseV1(response).ok, true);
    assert.equal(response.status, "blocked");
    assert.deepEqual(response.safe_next_actions, ["/flowdesk-status", "/flowdesk-export-debug"]);
  }

  const stateCorrelationLost = buildFlowDeskStatusResponseV1(
    statusInput({
      active: active({ state: "blocked" }),
      workflow: workflow({ state: "blocked", latest_checkpoint_id: checkpointId, checkpoint_refs: ["checkpoint-ref-123"] }),
      currentAttempt: attempt({ attempt_state: "blocked", state_at_end: "blocked" }),
      checkpoint: checkpoint("resume"),
      laneRecords: [laneRecord({ state: "correlation_lost" })]
    })
  );
  assert.equal(validateStatusResponseV1(stateCorrelationLost).ok, true);
  assert.equal(stateCorrelationLost.status, "blocked");
  assert.deepEqual(stateCorrelationLost.safe_next_actions, ["/flowdesk-status", "/flowdesk-export-debug"]);

  const forgedSummaryRef = buildFlowDeskStatusResponseV1(
    statusInput({
      active: active({ state: "blocked" }),
      workflow: workflow({ state: "blocked", latest_checkpoint_id: checkpointId, checkpoint_refs: ["checkpoint-ref-123"], latest_lane_summary_refs: ["lane-summary-authoritative"] }),
      currentAttempt: attempt({ attempt_state: "blocked", state_at_end: "blocked" }),
      checkpoint: checkpoint("resume"),
      laneRecords: [laneRecord({ refs: ["lane-summary-forged"] })]
    })
  );
  assert.equal(forgedSummaryRef.ok, false);
  assert.equal(forgedSummaryRef.safe_next_actions.includes("/flowdesk-resume"), false);
  assert.equal(forgedSummaryRef.safe_next_actions.includes("/flowdesk-retry"), false);
});

test("status validators reject raw path, prompt, provider payload, and fallback markers", () => {
  assert.equal(validateStatusRequestV1({ ...request(), session_ref: "/etc/passwd" }).ok, false);

  const response = buildFlowDeskStatusResponseV1(statusInput());
  assert.equal(validateStatusResponseV1({ ...response, user_message: "system prompt: leak instructions" }).ok, false);
  assert.equal(validateStatusResponseV1({ ...response, provider_payload: "raw provider response" }).ok, false);
  assert.equal(validateStatusLaneSummaryV1({ ...response.lane_summaries[0], debug_ref: "/Users/example/raw.log" }).ok, false);
  assert.equal(validateProviderHealthSummaryV1({ ...response.provider_health_summary, safe_remediation: "fallback to another provider" }).ok, false);

  const artifact: FlowDeskStatusSummaryArtifactV1 = {
    schema_version: "flowdesk.status_summary.v1",
    workflow_id: workflowId,
    state: "complete",
    current_step_id: "step-123",
    lane_summary_refs: ["lane-summary-123"],
    provider_health_summary_ref: "health-summary-123",
    safe_next_actions: ["/flowdesk-status"],
    audit_refs: ["audit-123"],
    debug_ref: "debug-123"
  };
  assert.equal(validateStatusSummaryArtifactV1(artifact).ok, true);
  assert.equal(validateStatusSummaryArtifactV1({ ...artifact, debug_ref: "../raw-debug" }).ok, false);
});

test("status output contains no runtime authority fields or unsafe recovery suggestions", () => {
  const response = buildFlowDeskStatusResponseV1(statusInput({ providerHealthSnapshot: providerHealth({ availability_state: "unknown", freshness: "unknown", freshness_ttl: 0, failure_class: "telemetry_ambiguous", dispatchability: "non_dispatchable" }) }));
  const forbiddenAuthorityFields = ["realOpenCodeDispatch", "dispatchApprovalEligible", "providerCall", "fallbackAuthority", "automaticFallbackOrReselection", "actualLaneLaunch", "hardCancelOrNoReply", "noReply", "hard_cancel_proven"];
  const text = JSON.stringify(response);
  for (const marker of forbiddenAuthorityFields) assert.equal(text.includes(marker), false, marker);
  assert.equal(response.safe_next_actions.includes("/flowdesk-run"), false);
  assert.equal(response.safe_next_actions.includes("/flowdesk-abort"), false);
  assert.equal(/fallback|reselect|lane launch|hard cancel|provider call/i.test(response.user_message), false);
  assert.equal(validateStatusResponseV1(response).ok, true);
});

test("status summary artifact derives compact refs from status response", () => {
  const response = buildFlowDeskStatusResponseV1(statusInput({ auditRef: "audit-123", debugRef: "debug-123", request: request({ detail_level: "debug_refs" }) }));
  const artifact = buildFlowDeskStatusSummaryArtifactV1(response, { providerHealthSummaryRef: "health-summary-123" });
  assert.equal(artifact.schema_version, "flowdesk.status_summary.v1");
  assert.equal(artifact.workflow_id, workflowId);
  assert.deepEqual(artifact.lane_summary_refs, ["lane-summary-123"]);
  assert.deepEqual(artifact.audit_refs, ["audit-123"]);
  assert.equal(artifact.debug_ref, "debug-123");
  assert.equal(artifact.provider_health_summary_ref, "health-summary-123");
  assert.equal(validateStatusSummaryArtifactV1(artifact).ok, true);
});
