import assert from "node:assert/strict";
import { existsSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import {
  activeAttemptLockPath,
  applyWriteIntentsToDurableState,
  applyWriteIntentsToInMemoryState,
  attemptRecordPath,
  auditEventToAuditRecord,
  checkpointRecordPath,
  createFlowDeskStateWritePlan,
  FLOWDESK_WORKFLOW_ACTIVE_PATH,
  type FlowDeskStateWriteIntent,
  getRelease1ProductionToolRegistry,
  loadFlowDeskDurableWorkflowState,
  prepareActiveAttemptLockWriteIntent,
  prepareAttemptRecordWriteIntent,
  prepareAuditEventWriteIntent,
  prepareAuditRecordWriteIntent,
  prepareCheckpointRecordWriteIntent,
  prepareDebugExportManifestWriteIntent,
  prepareDebugSectionFileWriteIntent,
  prepareLaneRecordWriteIntent,
  preparePreRunAuditWriteIntent,
  prepareWorkflowActiveWriteIntent,
  prepareWorkflowRecordWriteIntent,
  redactedDebugManifestPath,
  redactedDebugSectionFilePath,
  sessionAuditPath,
  sessionLanesPath,
  validateAuditEventV1,
  validateDebugExportManifestV1,
  validateFlowDeskRelativeStatePath,
  validateNoForbiddenRawPayloads,
  workflowDirectoryPath,
  workflowRecordPath
} from "./index.js";

const now = "2026-05-17T00:00:00.000Z";
const later = "2026-05-18T00:00:00.000Z";
const validationClock = Date.parse(now);
const sessionId = "session-123";
const workflowId = "workflow-123";
const attemptId = "attempt-123";
const checkpointId = "checkpoint-123";

function workflowActive() {
  return {
    schema_version: "flowdesk.workflow_active.v1" as const,
    active_workflow_id: workflowId,
    active_attempt_id: attemptId,
    state: "running" as const,
    updated_at: now,
    status_summary_ref: "status-123",
    audit_refs: ["audit-123"]
  };
}

function workflowRecord() {
  return {
    schema_version: "flowdesk.workflow_record.v1" as const,
    workflow_id: workflowId,
    session_ref: "session-ref-123",
    created_at: now,
    updated_at: now,
    state: "running" as const,
    latest_plan_revision_id: "plan-123",
    current_step_id: "step-123",
    project_root_ref: "project-root-ref-123",
    config_hash: "config-hash-123",
    policy_pack_id: "policy-123",
    policy_pack_hash: "policy-hash-123",
    current_attempt_id: attemptId,
    latest_checkpoint_id: checkpointId,
    attempt_refs: ["attempt-ref-123"],
    checkpoint_refs: ["checkpoint-ref-123"],
    lane_refs: ["lane-ref-123"],
    latest_lane_summary_refs: ["lane-summary-123"],
    audit_refs: ["audit-123"],
    status_summary_ref: "status-123",
    artifact_disposition: "quarantined" as const,
    safe_next_actions: ["/flowdesk-status" as const]
  };
}

function attemptRecord() {
  return {
    schema_version: "flowdesk.attempt_record.v1" as const,
    attempt_id: attemptId,
    workflow_id: workflowId,
    step_id: "step-123",
    created_at: now,
    updated_at: now,
    run_mode: "fake-runtime" as const,
    state_at_start: "ready_to_run" as const,
    state_at_end: "running" as const,
    attempt_state: "running" as const,
    guard_decision_ref: "guard-123",
    non_dispatch_permission_ref: "permission-123",
    command_shape_hash: "command-shape-hash-123",
    usage_snapshot_ref: "usage-123",
    provider_health_snapshot_ref: "health-123",
    runtime_capability_ref: "runtime-123",
    pre_run_audit_ref: "audit-pre-123",
    runtime_echo_validation: "not_applicable" as const,
    verification_ref: "verification-123",
    artifact_disposition: "none" as const,
    outcome_audit_ref: "audit-outcome-123",
    safe_next_actions: ["/flowdesk-status" as const]
  };
}

function checkpointRecord() {
  return {
    schema_version: "flowdesk.checkpoint_record.v1" as const,
    checkpoint_id: checkpointId,
    workflow_id: workflowId,
    attempt_id: attemptId,
    current_step_id: "step-123",
    created_at: now,
    expires_at: later,
    resume_mode: "resume" as const,
    required_fresh_checks: [{ check: "audit" as const, required: true, ref: "audit-123" }],
    audit_refs: ["audit-123"],
    artifact_refs: ["artifact-123"],
    reason: "planned_pause" as const,
    safe_next_actions: ["/flowdesk-resume" as const]
  };
}

function activeLock() {
  return {
    schema_version: "flowdesk.active_attempt_lock.v1" as const,
    workflow_id: workflowId,
    attempt_id: attemptId,
    owner_ref: "owner-123",
    acquired_at: now,
    expires_at: later,
    heartbeat_at: now,
    recovery_state: "active" as const,
    audit_ref: "audit-123"
  };
}

function laneRecord() {
  return {
    schema_version: "flowdesk.lane_record.v1" as const,
    lane_id: "lane-123",
    workflow_id: workflowId,
    plan_revision_id: "plan-123",
    attempt_id: attemptId,
    task_ref: "task-123",
    lane_class: "verification" as const,
    state: "completed" as const,
    created_at: now,
    started_at: now,
    updated_at: now,
    completed_at: now,
    safe_next_action: "/flowdesk-status" as const,
    refs: ["lane-summary-123"],
    event_refs: ["event-123"],
    audit_refs: ["audit-123"],
    debug_ref: "debug-123"
  };
}

function auditRecord() {
  return {
    schema_version: "flowdesk.audit_record.v1" as const,
    audit_ref: "audit-123",
    event_id: "event-123",
    workflow_id: workflowId,
    attempt_id: attemptId,
    step_id: "step-123",
    checkpoint_id: checkpointId,
    event_type: "workflow_status_recorded",
    created_at: now,
    actor_class: "flowdesk" as const,
    summary_label: "status recorded",
    policy_ref: "policy-ref-123",
    decision_ref: "decision-123",
    evidence_refs: ["evidence-123"],
    artifact_refs: ["artifact-123"],
    redaction_version: "redaction-v1"
  };
}

function debugSectionFile() {
  return {
    schema_version: "flowdesk.debug_section_file.v1" as const,
    export_id: "export-123",
    section: "doctor" as const,
    ref: "debug-section-file-export-123-doctor",
    workflow_id: workflowId,
    session_ref: "session-ref-123",
    generated_at: now,
    redaction_version: "redaction-v1",
    redaction_status: "passed" as const,
    warning_count: 0,
    excluded_categories: [],
    source_refs: ["debug-export-request"],
    summary_labels: ["flowdesk debug section doctor"],
    audit_refs: ["audit-123"]
  };
}

function debugManifest() {
  return {
    schema_version: "flowdesk.debug_export_manifest.v1" as const,
    export_id: "export-123",
    manifest_ref: "manifest-123",
    workflow_id: workflowId,
    session_ref: "session-ref-123",
    created_at: now,
    delete_after: later,
    included_sections: [
      {
        schema_version: "flowdesk.debug_section_summary.v1" as const,
        export_id: "export-123",
        section: "workflow_state" as const,
        ref: "debug-section-123",
        redaction_status: "passed" as const,
        warning_count: 0,
        excluded_categories: []
      }
    ],
    redaction_version: "redaction-v1",
    source_refs: ["source-123"],
    file_count: 1,
    byte_count: 128,
    warnings: ["redacted summaries only"],
    deletion_state: "pending" as const,
    audit_refs: ["audit-123"]
  };
}

function auditEvent() {
  return {
    schema_version: "flowdesk.audit_event.v1" as const,
    event_id: "event-123",
    event_type: "pre_run_audit_prepared",
    workflow_id: workflowId,
    attempt_id: attemptId,
    step_id: "step-123",
    created_at: now,
    actor_class: "flowdesk" as const,
    policy_ref: "policy-ref-123",
    decision_ref: "decision-123",
    redaction_version: "redaction-v1",
    summary_label: "pre run audit prepared",
    artifact_refs: ["artifact-123"]
  };
}

test("Checkpoint 2 path builders produce relative .flowdesk paths and reject path-ish ids", () => {
  assert.equal(FLOWDESK_WORKFLOW_ACTIVE_PATH, ".flowdesk/workflows/active.json");
  assert.equal(workflowDirectoryPath(workflowId), ".flowdesk/workflows/workflow-123");
  assert.equal(workflowRecordPath(workflowId), ".flowdesk/workflows/workflow-123/workflow.json");
  assert.equal(attemptRecordPath(workflowId, attemptId), ".flowdesk/workflows/workflow-123/attempts/attempt-123.json");
  assert.equal(checkpointRecordPath(workflowId, checkpointId), ".flowdesk/workflows/workflow-123/checkpoints/checkpoint-123.json");
  assert.equal(activeAttemptLockPath(workflowId), ".flowdesk/workflows/workflow-123/locks/active-attempt.lock");
  assert.equal(sessionLanesPath(sessionId), ".flowdesk/sessions/session-123/lanes.jsonl");
  assert.equal(sessionAuditPath(sessionId), ".flowdesk/sessions/session-123/audit.jsonl");
  assert.equal(redactedDebugManifestPath(sessionId), ".flowdesk/sessions/session-123/redacted-debug/manifest.json");
  assert.equal(redactedDebugSectionFilePath(sessionId, "doctor"), ".flowdesk/sessions/session-123/redacted-debug/sections/doctor.json");
  assert.throws(() => redactedDebugSectionFilePath(sessionId, "../escape"));
  assert.equal(validateFlowDeskRelativeStatePath("/Users/example/.flowdesk/workflows/active.json").ok, false);
  assert.throws(() => workflowRecordPath("../workflow-123"));
  assert.throws(() => sessionAuditPath(".flowdesk/sessions/raw"));
});

test("valid persisted workflow and redacted session records prepare deterministic write intents", () => {
  const preparations = [
    prepareWorkflowActiveWriteIntent(workflowActive(), { workflowId, attemptId }),
    prepareWorkflowRecordWriteIntent(workflowRecord()),
    prepareAttemptRecordWriteIntent(attemptRecord()),
    prepareCheckpointRecordWriteIntent(checkpointRecord(), { source: "durable_workflow_state" }),
    prepareActiveAttemptLockWriteIntent(activeLock(), validationClock),
    prepareLaneRecordWriteIntent(sessionId, laneRecord()),
    prepareAuditRecordWriteIntent(sessionId, auditRecord()),
    prepareDebugExportManifestWriteIntent(sessionId, debugManifest()),
    prepareDebugSectionFileWriteIntent(sessionId, debugSectionFile())
  ];
  assert.ok(preparations.every((preparation) => preparation.ok));
  const intents = preparations.map((preparation) => preparation.writeIntent).filter((intent) => intent !== undefined);
  assert.equal(intents.length, 9);
  assert.equal(intents[0]?.authority, "authoritative_workflow_state");
  assert.equal(intents[5]?.authority, "redacted_session_support");
  assert.equal(intents[8]?.path, ".flowdesk/sessions/session-123/redacted-debug/sections/doctor.json");
  assert.ok(intents.every((intent) => intent.path.startsWith(".flowdesk/")));
  assert.ok(intents.every((intent) => !intent.path.startsWith("/")));
  assert.ok(intents.every((intent) => intent.atomicity.strategy === "temp_then_rename_intent"));

  const plan = createFlowDeskStateWritePlan(intents, { now: validationClock });
  assert.equal(plan.ok, true);
  assert.equal(plan.plan?.intents.length, 9);
  const memoryState = applyWriteIntentsToInMemoryState(intents, undefined, { now: validationClock });
  assert.equal(memoryState.has(".flowdesk/workflows/active.json"), true);
  assert.equal(memoryState.has(".flowdesk/sessions/session-123/redacted-debug/sections/doctor.json"), true);
  assert.match(memoryState.get(".flowdesk/sessions/session-123/audit.jsonl") ?? "", /"audit_ref":"audit-123"/);
});

test("debug section files persist as durable redacted JSON per section", () => {
  const root = mkdtempSync(join(tmpdir(), "flowdesk-debug-section-"));
  try {
    const manifestIntent = prepareDebugExportManifestWriteIntent(sessionId, debugManifest()).writeIntent;
    const sectionIntent = prepareDebugSectionFileWriteIntent(sessionId, debugSectionFile()).writeIntent;
    assert.ok(manifestIntent);
    assert.ok(sectionIntent);

    const applied = applyWriteIntentsToDurableState(root, [manifestIntent, sectionIntent], { now: validationClock });
    assert.equal(applied.ok, true);

    const manifestPath = join(root, ".flowdesk/sessions/session-123/redacted-debug/manifest.json");
    const sectionPath = join(root, ".flowdesk/sessions/session-123/redacted-debug/sections/doctor.json");
    assert.equal(existsSync(manifestPath), true);
    assert.equal(existsSync(sectionPath), true);

    const section = JSON.parse(readFileSync(sectionPath, "utf8")) as Record<string, unknown>;
    assert.equal(section.schema_version, "flowdesk.debug_section_file.v1");
    assert.equal(section.section, "doctor");
    assert.equal(section.redaction_status, "passed");
    assert.equal(/raw|payload|transcript|credential|secret|token|\/Users/.test(JSON.stringify(section)), false);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("validated write intents materialize durable .flowdesk files atomically", () => {
  const root = mkdtempSync(join(tmpdir(), "flowdesk-state-"));
  try {
    const workflowIntent = prepareWorkflowRecordWriteIntent(workflowRecord()).writeIntent;
    const laneIntent = prepareLaneRecordWriteIntent(sessionId, laneRecord()).writeIntent;
    assert.ok(workflowIntent);
    assert.ok(laneIntent);

    const first = applyWriteIntentsToDurableState(root, [workflowIntent, laneIntent], { now: validationClock });
    assert.equal(first.ok, true);
    assert.deepEqual(first.writtenPaths, [".flowdesk/workflows/workflow-123/workflow.json", ".flowdesk/sessions/session-123/lanes.jsonl"]);
    assert.equal(first.realOpenCodeDispatch, false);
    assert.equal(first.providerCall, false);

    const workflowPath = join(root, ".flowdesk/workflows/workflow-123/workflow.json");
    const lanesPath = join(root, ".flowdesk/sessions/session-123/lanes.jsonl");
    assert.equal(existsSync(workflowPath), true);
    assert.equal(JSON.parse(readFileSync(workflowPath, "utf8")).workflow_id, workflowId);
    assert.match(readFileSync(lanesPath, "utf8"), /"lane_id":"lane-123"/);

    const second = applyWriteIntentsToDurableState(root, [laneIntent], { now: validationClock });
    assert.equal(second.ok, true);
    assert.equal(readFileSync(lanesPath, "utf8").trim().split("\n").length, 2);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("durable workflow state reloads validated workflow and lane records", () => {
  const root = mkdtempSync(join(tmpdir(), "flowdesk-state-load-"));
  try {
    const activeIntent = prepareWorkflowActiveWriteIntent(workflowActive(), { workflowId, attemptId }).writeIntent;
    const workflowIntent = prepareWorkflowRecordWriteIntent(workflowRecord()).writeIntent;
    const attemptIntent = prepareAttemptRecordWriteIntent(attemptRecord()).writeIntent;
    const laneIntent = prepareLaneRecordWriteIntent(sessionId, laneRecord()).writeIntent;
    assert.ok(activeIntent);
    assert.ok(workflowIntent);
    assert.ok(attemptIntent);
    assert.ok(laneIntent);
    const written = applyWriteIntentsToDurableState(root, [activeIntent, workflowIntent, attemptIntent, laneIntent], { now: validationClock });
    assert.equal(written.ok, true);

    const loaded = loadFlowDeskDurableWorkflowState(root, { workflowId, sessionId, now: validationClock });
    assert.equal(loaded.ok, true);
    assert.equal(loaded.snapshot?.active?.active_workflow_id, workflowId);
    assert.equal(loaded.snapshot?.workflow?.workflow_id, workflowId);
    assert.equal(loaded.snapshot?.currentAttempt?.attempt_id, attemptId);
    assert.equal(loaded.snapshot?.laneRecords.length, 1);
    assert.equal(loaded.realOpenCodeDispatch, false);
    assert.equal(loaded.runtimeExecution, false);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("durable workflow state reload fails closed on malformed persisted records", () => {
  const root = mkdtempSync(join(tmpdir(), "flowdesk-state-load-malformed-"));
  try {
    const activeIntent = prepareWorkflowActiveWriteIntent(workflowActive(), { workflowId, attemptId }).writeIntent;
    const workflowIntent = prepareWorkflowRecordWriteIntent(workflowRecord()).writeIntent;
    assert.ok(activeIntent);
    assert.ok(workflowIntent);
    const written = applyWriteIntentsToDurableState(root, [activeIntent, workflowIntent], { now: validationClock });
    assert.equal(written.ok, true);
    writeFileSync(join(root, workflowRecordPath(workflowId)), JSON.stringify({ ...workflowRecord(), raw_prompt: "system prompt leak" }), "utf8");

    const loaded = loadFlowDeskDurableWorkflowState(root, { workflowId, sessionId, now: validationClock });
    assert.equal(loaded.ok, false);
    assert.equal(loaded.providerCall, false);
    assert.equal(loaded.actualLaneLaunch, false);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("invalid persisted records fail closed before write intents", () => {
  assert.equal(prepareWorkflowRecordWriteIntent({ ...workflowRecord(), unknown: true } as never).ok, false);
  assert.equal(prepareAuditRecordWriteIntent(sessionId, { ...auditRecord(), provider_payload: "raw" } as never).ok, false);
  assert.equal(prepareDebugExportManifestWriteIntent(sessionId, { ...debugManifest(), warnings: ["see /Users/example/raw.log"] }).ok, false);
  assert.equal(prepareDebugSectionFileWriteIntent(sessionId, { ...debugSectionFile(), summary_labels: ["see /Users/example/raw.log"] }).ok, false);
  assert.equal(prepareDebugSectionFileWriteIntent(sessionId, { ...debugSectionFile(), section: "doctor", active_workflow_id: workflowId } as never).ok, false);
  assert.equal(prepareWorkflowActiveWriteIntent({ ...workflowActive(), active_workflow_id: "workflow-other" }, { workflowId }).ok, false);
  assert.equal(prepareCheckpointRecordWriteIntent(checkpointRecord(), { source: "event_only" }).ok, false);
  assert.equal(prepareActiveAttemptLockWriteIntent({ ...activeLock(), expires_at: "2026-05-16T00:00:00.000Z" }, Date.parse(now)).ok, false);
  assert.equal(prepareActiveAttemptLockWriteIntent({ ...activeLock(), recovery_state: "corrupt" }, Date.parse(now)).ok, false);
  assert.equal(prepareLaneRecordWriteIntent(sessionId, { ...laneRecord(), state: "hard_cancel_proven" } as never).ok, false);
  assert.equal(prepareLaneRecordWriteIntent(sessionId, { ...laneRecord(), active_workflow_id: workflowId } as never).ok, false);
});

test("write plans and in-memory application reject forged unvalidated intents", () => {
  const validIntent = prepareWorkflowRecordWriteIntent(workflowRecord()).writeIntent;
  assert.ok(validIntent);
  const forgedRawRecord: FlowDeskStateWriteIntent = {
    ...validIntent,
    record: { ...workflowRecord(), raw_prompt: "system prompt: leak private task" }
  };
  assert.equal(createFlowDeskStateWritePlan([forgedRawRecord]).ok, false);
  assert.throws(() => applyWriteIntentsToInMemoryState([forgedRawRecord]));
});

test("durable state materialization rejects forged or unsafe write intents", () => {
  const root = mkdtempSync(join(tmpdir(), "flowdesk-state-unsafe-"));
  try {
    const validIntent = prepareWorkflowRecordWriteIntent(workflowRecord()).writeIntent;
    assert.ok(validIntent);
    const forged = { ...validIntent, path: "../outside.json" };
    const result = applyWriteIntentsToDurableState(root, [forged], { now: validationClock });
    assert.equal(result.ok, false);
    assert.equal(result.writtenPaths?.length ?? 0, 0);
    assert.equal(result.runtimeExecution, false);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("write plans reject mismatched schema, authority, operation, and path families", () => {
  const workflowIntent = prepareWorkflowRecordWriteIntent(workflowRecord()).writeIntent;
  const laneIntent = prepareLaneRecordWriteIntent(sessionId, laneRecord()).writeIntent;
  const auditIntent = prepareAuditRecordWriteIntent(sessionId, auditRecord()).writeIntent;
  const debugIntent = prepareDebugExportManifestWriteIntent(sessionId, debugManifest()).writeIntent;
  assert.ok(workflowIntent);
  assert.ok(laneIntent);
  assert.ok(auditIntent);
  assert.ok(debugIntent);

  assert.equal(createFlowDeskStateWritePlan([{ ...workflowIntent, schemaId: "flowdesk.audit_record.v1" }]).ok, false);
  assert.equal(createFlowDeskStateWritePlan([{ ...workflowIntent, authority: "redacted_session_support" }]).ok, false);
  assert.equal(createFlowDeskStateWritePlan([{ ...workflowIntent, operation: "append_jsonl", serialization: "jsonl" }]).ok, false);
  assert.equal(createFlowDeskStateWritePlan([{ ...workflowIntent, path: ".flowdesk/workflows/workflow-other/workflow.json" }]).ok, false);
  assert.equal(createFlowDeskStateWritePlan([{ ...laneIntent, operation: "write_json", serialization: "json" }]).ok, false);
  assert.equal(createFlowDeskStateWritePlan([{ ...auditIntent, path: ".flowdesk/sessions/session-123/lanes.jsonl" }]).ok, false);
  assert.equal(createFlowDeskStateWritePlan([{ ...debugIntent, path: ".flowdesk/workflows/workflow-123/workflow.json" }]).ok, false);
});

test("checkpoint write intents require durable source and validate nested fresh checks", () => {
  assert.equal(prepareCheckpointRecordWriteIntent(checkpointRecord(), undefined as never).ok, false);
  assert.equal(prepareCheckpointRecordWriteIntent(checkpointRecord(), { source: "event_only" }).ok, false);
  assert.equal(prepareCheckpointRecordWriteIntent(checkpointRecord(), { source: "durable_workflow_state" }).ok, true);
  assert.equal(prepareCheckpointRecordWriteIntent({ ...checkpointRecord(), required_fresh_checks: [{ check: "audit", required: true, ref: "audit-123", unknown: true }] } as never, { source: "durable_workflow_state" }).ok, false);
  assert.equal(prepareCheckpointRecordWriteIntent({ ...checkpointRecord(), required_fresh_checks: [{ check: "provider_quota", required: true }] } as never, { source: "durable_workflow_state" }).ok, false);
  assert.equal(prepareCheckpointRecordWriteIntent({ ...checkpointRecord(), required_fresh_checks: [{ check: "audit", required: "yes" }] } as never, { source: "durable_workflow_state" }).ok, false);
  assert.equal(prepareCheckpointRecordWriteIntent({ ...checkpointRecord(), required_fresh_checks: [{ check: "audit", required: true, ref: "/etc/passwd" }] } as never, { source: "durable_workflow_state" }).ok, false);
});

test("active attempt locks require parseable timestamps", () => {
  assert.equal(prepareActiveAttemptLockWriteIntent({ ...activeLock(), acquired_at: "not-a-date" }, Date.parse(now)).ok, false);
  assert.equal(prepareActiveAttemptLockWriteIntent({ ...activeLock(), expires_at: "not-a-date" }, Date.parse(now)).ok, false);
  assert.equal(prepareActiveAttemptLockWriteIntent({ ...activeLock(), heartbeat_at: "not-a-date" }, Date.parse(now)).ok, false);
});

test("redaction rejects common absolute paths while preserving FlowDesk command actions", () => {
  assert.equal(validateNoForbiddenRawPayloads({ summary: "/etc/passwd" }).ok, false);
  assert.equal(validateNoForbiddenRawPayloads({ summary: "/var/log/raw.log" }).ok, false);
  assert.equal(validateNoForbiddenRawPayloads({ summary: "/private/tmp/raw" }).ok, false);
  assert.equal(validateNoForbiddenRawPayloads({ safe_next_actions: ["/flowdesk-status"] }).ok, true);
});

test("audit event lifecycle converts only redacted events into audit records and pre-run intents", () => {
  const event = auditEvent();
  assert.equal(validateAuditEventV1(event).ok, true);
  const record = auditEventToAuditRecord(event, { auditRef: "audit-from-event-123", evidenceRefs: ["evidence-123"] });
  assert.equal(record.ok, true);
  assert.equal(record.record?.audit_ref, "audit-from-event-123");
  assert.deepEqual(record.record?.evidence_refs, ["evidence-123"]);
  const intent = prepareAuditEventWriteIntent(sessionId, event, { auditRef: "audit-from-event-123" });
  assert.equal(intent.ok, true);
  assert.equal(intent.writeIntent?.path, ".flowdesk/sessions/session-123/audit.jsonl");
  assert.equal(preparePreRunAuditWriteIntent(sessionId, event, { auditRef: "audit-prepared-123" }).ok, true);
  assert.equal(validateAuditEventV1({ ...event, payload: { provider_payload: "raw" } }).ok, false);
  assert.equal(validateAuditEventV1({ ...event, summary_label: "system prompt: reveal hidden instructions" }).ok, false);
  assert.equal(preparePreRunAuditWriteIntent(sessionId, { ...event, event_type: "workflow_completed" }, { auditRef: "audit-prepared-123" }).ok, false);
});

test("debug export manifest accepts redacted section summaries only", () => {
  assert.equal(validateDebugExportManifestV1(debugManifest()).ok, true);
  const providerFailureManifest = {
    ...debugManifest(),
    included_sections: [
      { ...debugManifest().included_sections[0], redaction_status: "partial" as const, warning_count: 3, excluded_categories: ["provider_health" as const, "provider_api" as const, "model_availability" as const] }
    ],
    warnings: ["provider diagnostics are represented through redacted refs and excluded categories"]
  };
  assert.equal(validateDebugExportManifestV1(providerFailureManifest).ok, true);
  assert.equal(JSON.stringify(providerFailureManifest).includes("provider_payload"), false);
  assert.equal(JSON.stringify(providerFailureManifest).includes("provider_response"), false);
  const blockedSectionManifest = {
    ...debugManifest(),
    included_sections: [{ ...debugManifest().included_sections[0], redaction_status: "blocked" as const, warning_count: 1, excluded_categories: ["redaction" as const] }],
    warnings: ["debug section omitted because redaction blocked unsafe content"]
  };
  assert.equal(validateDebugExportManifestV1(blockedSectionManifest).ok, true);
  assert.equal(validateDebugExportManifestV1({ ...debugManifest(), deletion_state: "deleted", deletion_proof_ref: "deletion-proof-123" }).ok, true);
  assert.equal(validateDebugExportManifestV1({ ...debugManifest(), deletion_state: "deleted" }).ok, false);
  assert.equal(validateDebugExportManifestV1({ ...debugManifest(), deletion_state: "partial", partial_deletion_warning: "manual cleanup required for redacted staged files" }).ok, true);
  assert.equal(validateDebugExportManifestV1({ ...debugManifest(), deletion_state: "partial" }).ok, false);
  assert.equal(validateDebugExportManifestV1({ ...debugManifest(), deletion_state: "retained_by_policy" }).ok, true);
  assert.equal(validateDebugExportManifestV1({ ...debugManifest(), source_refs: ["not an opaque ref"] }).ok, false);
  assert.equal(validateDebugExportManifestV1({ ...debugManifest(), included_sections: [{ ...debugManifest().included_sections[0], payload: "raw logs" }] }).ok, false);
  assert.equal(validateDebugExportManifestV1({ ...providerFailureManifest, included_sections: [{ ...providerFailureManifest.included_sections[0], provider_payload: "raw provider response" }] }).ok, false);
  assert.equal(validateDebugExportManifestV1({ ...debugManifest(), included_sections: [{ ...debugManifest().included_sections[0], warning_count: Infinity }] }).ok, false);
  assert.equal(validateDebugExportManifestV1({ ...debugManifest(), included_sections: [{ ...debugManifest().included_sections[0], warning_count: 1.5 }] }).ok, false);
  assert.equal(validateDebugExportManifestV1({ ...debugManifest(), file_count: Infinity }).ok, false);
  assert.equal(validateDebugExportManifestV1({ ...debugManifest(), file_count: 1.5 }).ok, false);
  assert.equal(validateDebugExportManifestV1({ ...debugManifest(), byte_count: Infinity }).ok, false);
  assert.equal(validateDebugExportManifestV1({ ...debugManifest(), byte_count: 1.5 }).ok, false);
  assert.equal(validateDebugExportManifestV1({ ...debugManifest(), partial_deletion_warning: "manual cleanup under /tmp/raw" }).ok, false);
  assert.equal(validateDebugExportManifestV1({ ...debugManifest(), partial_deletion_warning: 123 }).ok, false);
});

test("core foundation has no OMO/OMC runtime dependency, nested opencode run, or child process launch", () => {
  const corePackage = JSON.parse(readFileSync(new URL("../package.json", import.meta.url), "utf8")) as { dependencies?: Record<string, string>; devDependencies?: Record<string, string> };
  const dependencyNames = Object.keys({ ...(corePackage.dependencies ?? {}), ...(corePackage.devDependencies ?? {}) }).join(" ").toLowerCase();
  assert.equal(/\b(omo|omc|oh-my-claudecode)\b/.test(dependencyNames), false);

  const sourceDir = new URL("../src/", import.meta.url);
  const sourceText = readdirSync(sourceDir)
    .filter((entry) => entry.endsWith(".ts") && !entry.endsWith(".test.ts") && entry !== "agent-profiles.ts")
    .map((entry) => readFileSync(new URL(entry, sourceDir), "utf8"))
    .join("\n");
  assert.equal(/opencode\s+run/.test(sourceText), false);
  assert.equal(/node:child_process|child_process|\bspawn\s*\(|\bexec\s*\(/.test(sourceText), false);
  assert.ok(getRelease1ProductionToolRegistry().length > 0);
});
