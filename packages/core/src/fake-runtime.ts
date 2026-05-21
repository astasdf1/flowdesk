import { preparePreRunAuditWriteIntent } from "./audit.js";
import { type FlowDeskRelease1MinimumPortableCommandName, getFlowDeskCommandManifestEntry } from "./command-manifest.js";
import { validateNonDispatchPermissionV1 } from "./config-policy.js";
import { evaluateGuardBoundaryV1, type GuardBoundaryDecisionV1, type GuardBoundaryInputV1 } from "./guard-boundary.js";
import { createFlowDeskLaneObservabilityArtifactV1, validateFlowDeskLaneObservabilityArtifactV1 } from "./lane-observability.js";
import type { FlowDeskAttemptRecordV1, FlowDeskAuditEventV1, FlowDeskAuditRecordV1, FlowDeskLaneObservabilityArtifactV1, FlowDeskLaneRecordV1, FlowDeskLaneSummaryArtifactV1, FlowDeskNonDispatchPermissionV1, FlowDeskRunRequestV1, FlowDeskRunResponseV1, FlowDeskVerificationSummaryArtifactV1, IsoTimestamp, OpaqueId, OpaqueRef, RedactedErrorCategory, SafeNextAction } from "./release1-contracts.js";
import type { FlowDeskStateWriteIntent } from "./state-store.js";
import { prepareAttemptRecordWriteIntent, prepareLaneRecordWriteIntent } from "./state-store.js";
import { laneRecordToStatusLaneSummaryV1 } from "./status.js";
import { type ValidationResult, validateLaneSummaryArtifactV1, validateOpaqueId, validateRunRequestV1, validateRunResponseV1, validateSchemaArtifactValue } from "./validators.js";

export interface FlowDeskFakeRuntimeCommandInputV1 {
  commandName: FlowDeskRelease1MinimumPortableCommandName;
  request: FlowDeskRunRequestV1;
  guardBoundary: Omit<GuardBoundaryInputV1, "operation" | "workflowId">;
  auditWritePermission: FlowDeskNonDispatchPermissionV1;
  stateWritePermission: FlowDeskNonDispatchPermissionV1;
  sessionId: OpaqueId;
  attemptId: OpaqueId;
  auditEventId: OpaqueId;
  outcomeAuditEventId: OpaqueId;
  nowIso: IsoTimestamp;
  decisionRef: OpaqueRef;
  routeRef: OpaqueRef;
  commandShapeHash: string;
  runResultRef: OpaqueRef;
  runtimeEchoEvidenceRef: OpaqueRef;
  verificationSummaryRef: OpaqueRef;
  outcomeAuditRef: OpaqueRef;
  redactionVersion: string;
  laneId?: OpaqueId;
  laneTaskRef?: OpaqueRef;
  laneSummaryRef?: OpaqueRef;
  laneObservabilityRef?: OpaqueRef;
  laneEventRef?: OpaqueRef;
  laneDebugRef?: OpaqueRef;
}

export interface FlowDeskFakeRuntimeEvidenceRefsV1 {
  plan_revision_id: OpaqueId;
  route_ref: OpaqueRef;
  guard_decision_ref: OpaqueRef;
  command_shape_hash: string;
  runtime_capability_ref: OpaqueRef;
  fake_runtime_result_ref: OpaqueRef;
  runtime_echo_evidence_ref: OpaqueRef;
  verification_summary_ref: OpaqueRef;
  pre_run_audit_ref: OpaqueRef;
  request_schema_id: "flowdesk.run.request.v1";
  response_schema_id: "flowdesk.run.response.v1";
}

export interface FlowDeskFakeRuntimeCommandEvaluationV1 extends ValidationResult {
  commandName: FlowDeskRelease1MinimumPortableCommandName;
  guardDecision: GuardBoundaryDecisionV1;
  response: FlowDeskRunResponseV1;
  evidenceRefs?: FlowDeskFakeRuntimeEvidenceRefsV1;
  verificationSummaryArtifact?: FlowDeskVerificationSummaryArtifactV1;
  laneRecord?: FlowDeskLaneRecordV1;
  laneSummaryArtifact?: FlowDeskLaneSummaryArtifactV1;
  laneObservabilityArtifact?: FlowDeskLaneObservabilityArtifactV1;
  preRunAuditIntent?: FlowDeskStateWriteIntent<FlowDeskAuditRecordV1>;
  outcomeAuditIntent?: FlowDeskStateWriteIntent<FlowDeskAuditRecordV1>;
  attemptRecordIntent?: FlowDeskStateWriteIntent<FlowDeskAttemptRecordV1>;
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

function validateBoundPermission(input: FlowDeskFakeRuntimeCommandInputV1, permission: FlowDeskNonDispatchPermissionV1, permissionClass: FlowDeskNonDispatchPermissionV1["permission_class"]): ValidationResult {
  return validateNonDispatchPermissionV1(permission, {
    expectedConfigHash: input.guardBoundary.configHash,
    expectedPolicyPackHashes: input.guardBoundary.policy?.policy_pack_hashes,
    expectedPermissionClass: permissionClass,
    expectedWorkflowId: input.request.workflow_id,
    expectedScopeRef: input.guardBoundary.scopeRef,
    expectedAuditRef: input.guardBoundary.auditRef,
    requireWorkflowId: true,
    requireAuditRef: true,
    forbiddenGrantSources: ["policy_pack"],
    now: input.guardBoundary.now
  });
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

function redactedError(category: RedactedErrorCategory, safeRemediation: string): FlowDeskRunResponseV1["error"] {
  return { category, safe_remediation: safeRemediation };
}

function optionalFakeRuntimeLane(input: FlowDeskFakeRuntimeCommandInputV1, workflowId: OpaqueId): { laneRecord?: FlowDeskLaneRecordV1; laneSummaryArtifact?: FlowDeskLaneSummaryArtifactV1; laneObservabilityArtifact?: FlowDeskLaneObservabilityArtifactV1; laneRecordIntent?: FlowDeskStateWriteIntent<FlowDeskLaneRecordV1>; errors: string[] } {
  const provided = [input.laneId, input.laneTaskRef, input.laneSummaryRef, input.laneObservabilityRef, input.laneEventRef].filter((value) => value !== undefined).length;
  if (provided === 0) return { errors: [] };
  if (provided !== 5) return { errors: ["fake-runtime lane output requires lane id, task ref, summary ref, observability ref, and event ref together"] };
  const laneRecord: FlowDeskLaneRecordV1 = {
    schema_version: "flowdesk.lane_record.v1",
    lane_id: input.laneId as OpaqueId,
    workflow_id: workflowId,
    plan_revision_id: input.request.plan_revision_id,
    attempt_id: input.attemptId,
    task_ref: input.laneTaskRef as OpaqueRef,
    lane_class: "verification",
    state: "completed",
    created_at: input.nowIso,
    started_at: input.nowIso,
    updated_at: input.nowIso,
    completed_at: input.nowIso,
    safe_next_action: "/flowdesk-status",
    refs: [input.laneSummaryRef as OpaqueRef, input.laneObservabilityRef as OpaqueRef],
    event_refs: [input.laneEventRef as OpaqueRef],
    audit_refs: [input.guardBoundary.auditRef ?? input.decisionRef],
    observability_ref: input.laneObservabilityRef as OpaqueRef,
    ...(input.laneDebugRef === undefined ? {} : { debug_ref: input.laneDebugRef })
  };
  const laneSummaryArtifact: FlowDeskLaneSummaryArtifactV1 = {
    schema_version: "flowdesk.lane_summary.v1",
    ...laneRecordToStatusLaneSummaryV1(laneRecord, { planRevisionId: input.request.plan_revision_id })
  };
  const laneObservabilityArtifact = createFlowDeskLaneObservabilityArtifactV1({
    observabilityId: input.laneObservabilityRef as OpaqueRef,
    statusSummaryRef: input.laneSummaryRef as OpaqueRef,
    laneSummary: laneSummaryArtifact,
    observabilityLevel: "openable_refs",
    inspectionState: "inspectable",
    detailRef: input.laneSummaryRef as OpaqueRef,
    debugRef: input.laneDebugRef,
    redactionStatus: "passed"
  });
  const laneSummaryResult = validateLaneSummaryArtifactV1(laneSummaryArtifact);
  const laneObservabilityResult = validateFlowDeskLaneObservabilityArtifactV1(laneObservabilityArtifact);
  const laneIntentResult = prepareLaneRecordWriteIntent(input.sessionId, laneRecord);
  return {
    laneRecord,
    laneSummaryArtifact,
    laneObservabilityArtifact,
    laneRecordIntent: laneIntentResult.writeIntent,
    errors: [...laneSummaryResult.errors, ...laneObservabilityResult.errors, ...laneIntentResult.errors]
  };
}

function responseFor(input: FlowDeskFakeRuntimeCommandInputV1, ok: boolean, status: FlowDeskRunResponseV1["status"], userMessage: string, safeNextActions: SafeNextAction[], error?: FlowDeskRunResponseV1["error"]): FlowDeskRunResponseV1 {
  return {
    schema_version: "flowdesk.run.response.v1",
    ok,
    status,
    safe_next_actions: safeNextActions,
    user_message: userMessage,
    ...(error === undefined ? {} : { error }),
    run_result_ref: input.runResultRef,
    verification_summary_ref: input.verificationSummaryRef,
    artifact_disposition: ok ? "quarantined" : "none"
  };
}

function blockedDecision(category: RedactedErrorCategory, reason: string): GuardBoundaryDecisionV1 {
  return {
    status: "blocked",
    reason_category: category,
    redacted_reason: reason,
    required_checks: [],
    safe_next_actions: ["/flowdesk-doctor", "/flowdesk-status"]
  };
}

export function evaluateFlowDeskFakeRuntimeCommandV1(input: FlowDeskFakeRuntimeCommandInputV1): FlowDeskFakeRuntimeCommandEvaluationV1 {
  const manifestEntry = getFlowDeskCommandManifestEntry(input.commandName);
  const requestResult = validateRunRequestV1(input.request);
  const idErrors = resultErrors(
    validateOpaqueId(input.sessionId, "session_id"),
    validateOpaqueId(input.attemptId, "attempt_id"),
    validateOpaqueId(input.auditEventId, "audit_event_id"),
    validateOpaqueId(input.outcomeAuditEventId, "outcome_audit_event_id"),
    validateOpaqueId(input.decisionRef, "decision_ref"),
    validateOpaqueId(input.routeRef, "route_ref"),
    validateOpaqueId(input.commandShapeHash, "command_shape_hash"),
    validateOpaqueId(input.runResultRef, "run_result_ref"),
    validateOpaqueId(input.runtimeEchoEvidenceRef, "runtime_echo_evidence_ref"),
    validateOpaqueId(input.verificationSummaryRef, "verification_summary_ref"),
    validateOpaqueId(input.outcomeAuditRef, "outcome_audit_ref")
  );
  const baseErrors = [...requestResult.errors, ...idErrors];

  if (manifestEntry === undefined || input.commandName !== "/flowdesk-run" || manifestEntry.toolName !== "flowdesk_run") baseErrors.push("fake-runtime evaluator only accepts the /flowdesk-run command");
  if (manifestEntry !== undefined && (manifestEntry.actualLaneLaunch || manifestEntry.providerCall || manifestEntry.dispatchApprovalEligible || manifestEntry.fallbackAuthority || manifestEntry.hardCancelOrNoReplyAuthority)) baseErrors.push("command manifest is not inert for Release 1 fake-runtime evaluation");
  if (input.request.run_mode !== "fake-runtime") baseErrors.push("fake-runtime evaluator requires run_mode fake-runtime");
  if (input.request.workflow_id === undefined) baseErrors.push("fake-runtime evaluator requires workflow_id for guard binding");

  if (baseErrors.length > 0) {
    const guardDecision = blockedDecision("schema", "Run command request failed closed before Guard evaluation.");
    const response = responseFor(input, false, "blocked", "FlowDesk blocked this fake-runtime request before execution planning.", ["/flowdesk-doctor", "/flowdesk-status"], redactedError("schema", "Run doctor or status, then retry with a schema-valid fake-runtime request."));
    const responseResult = validateRunResponseV1(response);
    return { ok: false, errors: [...baseErrors, ...responseResult.errors], commandName: input.commandName, guardDecision, response, runtime: inertRuntime };
  }

  const workflowId = input.request.workflow_id;
  if (workflowId === undefined) {
    const guardDecision = blockedDecision("schema", "Run command request failed closed before Guard evaluation.");
    const response = responseFor(input, false, "blocked", "FlowDesk blocked this fake-runtime request before execution planning.", ["/flowdesk-doctor", "/flowdesk-status"], redactedError("schema", "Run doctor or status, then retry with an explicitly scoped fake-runtime request."));
    const responseResult = validateRunResponseV1(response);
    return { ok: false, errors: responseResult.errors, commandName: input.commandName, guardDecision, response, runtime: inertRuntime };
  }
  const guardDecision = evaluateGuardBoundaryV1({ ...input.guardBoundary, operation: "fake-runtime", workflowId });
  if (guardDecision.status !== "eligible") {
    const response = responseFor(input, false, "blocked", guardDecision.redacted_reason, [...guardDecision.safe_next_actions], redactedError(guardDecision.reason_category, "Use FlowDesk doctor or status to refresh the missing fake-runtime evidence."));
    const responseResult = validateRunResponseV1(response);
    return { ok: false, errors: responseResult.errors, commandName: input.commandName, guardDecision, response, runtime: inertRuntime };
  }
  const runtimeCapabilityRef = input.guardBoundary.runtimeCapabilityRef;
  if (runtimeCapabilityRef === undefined) {
    const response = responseFor(input, false, "blocked", "FlowDesk blocked this fake-runtime request because runtime capability evidence is unavailable.", ["/flowdesk-doctor", "/flowdesk-status"], redactedError("conformance", "Refresh runtime capability evidence before retrying fake-runtime."));
    const responseResult = validateRunResponseV1(response);
    return { ok: false, errors: responseResult.errors, commandName: input.commandName, guardDecision: blockedDecision("conformance", "Runtime capability evidence is required."), response, runtime: inertRuntime };
  }

  const auditPermissionResult = validateBoundPermission(input, input.auditWritePermission, "audit_write");
  const statePermissionResult = validateBoundPermission(input, input.stateWritePermission, "state_write");
  const supplementalPermissionErrors = [...auditPermissionResult.errors, ...statePermissionResult.errors];
  if (supplementalPermissionErrors.length > 0) {
    const response = responseFor(input, false, "blocked", "FlowDesk blocked this fake-runtime request because required audit or state write permission is unavailable.", ["/flowdesk-doctor", "/flowdesk-status"], redactedError("policy", "Refresh scoped audit_write and state_write permissions before retrying fake-runtime."));
    const responseResult = validateRunResponseV1(response);
    return { ok: false, errors: [...supplementalPermissionErrors, ...responseResult.errors], commandName: input.commandName, guardDecision: blockedDecision("policy", "Scoped audit_write and state_write permissions are required."), response, runtime: inertRuntime };
  }

  const auditEvent: FlowDeskAuditEventV1 = {
    schema_version: "flowdesk.audit_event.v1",
    event_id: input.auditEventId,
    event_type: "pre_run_fake_runtime",
    workflow_id: workflowId,
    attempt_id: input.attemptId,
    ...(input.request.step_id === undefined ? {} : { step_id: input.request.step_id }),
    created_at: input.nowIso,
    actor_class: "flowdesk",
    decision_ref: input.decisionRef,
    redaction_version: input.redactionVersion,
    summary_label: "Fake runtime planned without real dispatch.",
    artifact_refs: [input.runResultRef, input.runtimeEchoEvidenceRef, input.verificationSummaryRef]
  };
  const auditIntentResult = preparePreRunAuditWriteIntent(input.sessionId, auditEvent, {
    auditRef: input.guardBoundary.auditRef ?? input.decisionRef,
    evidenceRefs: [input.routeRef, input.decisionRef, input.guardBoundary.conformanceRef, input.guardBoundary.runtimeCapabilityRef, input.runtimeEchoEvidenceRef].filter((ref): ref is string => ref !== undefined)
  });

  if (!auditIntentResult.ok || auditIntentResult.writeIntent === undefined) {
    const response = responseFor(input, false, "blocked", "FlowDesk blocked this fake-runtime request because pre-run audit evidence could not be prepared.", ["/flowdesk-doctor", "/flowdesk-status"], redactedError("audit", "Refresh audit evidence before retrying fake-runtime."));
    const responseResult = validateRunResponseV1(response);
    return { ok: false, errors: [...auditIntentResult.errors, ...responseResult.errors], commandName: input.commandName, guardDecision: blockedDecision("audit", "Pre-run audit evidence preparation failed."), response, runtime: inertRuntime };
  }

  const verificationSummaryArtifact: FlowDeskVerificationSummaryArtifactV1 = {
    schema_version: "flowdesk.verification_summary.v1",
    verification_id: input.verificationSummaryRef,
    workflow_id: workflowId,
    attempt_id: input.attemptId,
    result: "passed",
    check_labels: ["fake-runtime-deterministic", "no-real-dispatch", "redacted-audit-intent"],
    artifact_refs: [input.runResultRef, input.runtimeEchoEvidenceRef],
    safe_next_actions: ["/flowdesk-status", "/flowdesk-export-debug"]
  };
  const verificationResult = validateSchemaArtifactValue("flowdesk.verification_summary.v1", verificationSummaryArtifact);
  if (!verificationResult.ok) {
    const response = responseFor(input, false, "blocked", "FlowDesk blocked this fake-runtime request because verification summary evidence could not be prepared.", ["/flowdesk-doctor", "/flowdesk-status"], redactedError("state", "Refresh fake-runtime verification evidence before retrying."));
    const responseResult = validateRunResponseV1(response);
    return { ok: false, errors: [...verificationResult.errors, ...responseResult.errors], commandName: input.commandName, guardDecision: blockedDecision("state", "Verification summary evidence preparation failed."), response, runtime: inertRuntime };
  }

  const outcomeAuditEvent: FlowDeskAuditEventV1 = {
    schema_version: "flowdesk.audit_event.v1",
    event_id: input.outcomeAuditEventId,
    event_type: "fake_runtime_outcome_audit",
    workflow_id: workflowId,
    attempt_id: input.attemptId,
    ...(input.request.step_id === undefined ? {} : { step_id: input.request.step_id }),
    created_at: input.nowIso,
    actor_class: "flowdesk",
    decision_ref: input.decisionRef,
    redaction_version: input.redactionVersion,
    summary_label: "Fake runtime outcome recorded without real dispatch.",
    artifact_refs: [input.runResultRef, input.runtimeEchoEvidenceRef, input.verificationSummaryRef]
  };
  const outcomeAuditResult = preparePreRunAuditWriteIntent(input.sessionId, { ...outcomeAuditEvent, event_type: "pre_run_fake_runtime_outcome_audit" }, {
    auditRef: input.outcomeAuditRef,
    evidenceRefs: [input.routeRef, input.decisionRef, runtimeCapabilityRef, input.runtimeEchoEvidenceRef, input.verificationSummaryRef]
  });
  if (!outcomeAuditResult.ok || outcomeAuditResult.writeIntent === undefined) {
    const response = responseFor(input, false, "blocked", "FlowDesk blocked this fake-runtime request because outcome audit evidence could not be prepared.", ["/flowdesk-doctor", "/flowdesk-status"], redactedError("audit", "Refresh outcome audit evidence before retrying fake-runtime."));
    const responseResult = validateRunResponseV1(response);
    return { ok: false, errors: [...outcomeAuditResult.errors, ...responseResult.errors], commandName: input.commandName, guardDecision: blockedDecision("audit", "Outcome audit evidence preparation failed."), response, runtime: inertRuntime };
  }

  const attemptRecord: FlowDeskAttemptRecordV1 = {
    schema_version: "flowdesk.attempt_record.v1",
    attempt_id: input.attemptId,
    workflow_id: workflowId,
    ...(input.request.step_id === undefined ? {} : { step_id: input.request.step_id }),
    created_at: input.nowIso,
    updated_at: input.nowIso,
    run_mode: "fake-runtime",
    state_at_start: "ready_to_run",
    state_at_end: "complete",
    attempt_state: "complete",
    guard_decision_ref: input.decisionRef,
    non_dispatch_permission_ref: input.guardBoundary.nonDispatchPermission?.permission_id,
    command_shape_hash: input.commandShapeHash,
    runtime_capability_ref: runtimeCapabilityRef,
    pre_run_audit_ref: input.guardBoundary.auditRef ?? input.decisionRef,
    runtime_echo_validation: "not_applicable",
    verification_ref: input.verificationSummaryRef,
    artifact_disposition: "quarantined",
    outcome_audit_ref: input.outcomeAuditRef,
    safe_next_actions: ["/flowdesk-status", "/flowdesk-export-debug"]
  };
  const attemptResult = prepareAttemptRecordWriteIntent(attemptRecord);
  if (!attemptResult.ok || attemptResult.writeIntent === undefined) {
    const response = responseFor(input, false, "blocked", "FlowDesk blocked this fake-runtime request because authoritative attempt state could not be prepared.", ["/flowdesk-doctor", "/flowdesk-status"], redactedError("state", "Refresh workflow attempt state evidence before retrying fake-runtime."));
    const responseResult = validateRunResponseV1(response);
    return { ok: false, errors: [...attemptResult.errors, ...responseResult.errors], commandName: input.commandName, guardDecision: blockedDecision("state", "Attempt state preparation failed."), response, runtime: inertRuntime };
  }

  const laneOutput = optionalFakeRuntimeLane(input, workflowId);
  if (laneOutput.errors.length > 0) {
    const response = responseFor(input, false, "blocked", "FlowDesk blocked this fake-runtime request because lane summary evidence could not be prepared.", ["/flowdesk-doctor", "/flowdesk-status"], redactedError("state", "Refresh redacted lane summary evidence before retrying fake-runtime."));
    const responseResult = validateRunResponseV1(response);
    return { ok: false, errors: [...laneOutput.errors, ...responseResult.errors], commandName: input.commandName, guardDecision: blockedDecision("state", "Lane summary evidence preparation failed."), response, runtime: inertRuntime };
  }

  const response = responseFor(input, true, "fake_runtime_complete", "FlowDesk completed deterministic fake-runtime evaluation. No OpenCode dispatch, lane launch, provider call, fallback, cancellation authority, or state write occurred.", ["/flowdesk-status", "/flowdesk-export-debug"], undefined);
  const responseResult = validateRunResponseV1(response);
  const evidenceRefs: FlowDeskFakeRuntimeEvidenceRefsV1 = {
    plan_revision_id: input.request.plan_revision_id,
    route_ref: input.routeRef,
    guard_decision_ref: input.decisionRef,
    command_shape_hash: input.commandShapeHash,
    runtime_capability_ref: runtimeCapabilityRef,
    fake_runtime_result_ref: input.runResultRef,
    runtime_echo_evidence_ref: input.runtimeEchoEvidenceRef,
    verification_summary_ref: input.verificationSummaryRef,
    pre_run_audit_ref: input.guardBoundary.auditRef ?? input.decisionRef,
    request_schema_id: "flowdesk.run.request.v1",
    response_schema_id: "flowdesk.run.response.v1"
  };
  return {
    ok: responseResult.ok,
    errors: responseResult.errors,
    commandName: input.commandName,
    guardDecision,
    response,
    evidenceRefs,
    verificationSummaryArtifact,
    laneRecord: laneOutput.laneRecord,
    laneSummaryArtifact: laneOutput.laneSummaryArtifact,
    laneObservabilityArtifact: laneOutput.laneObservabilityArtifact,
    preRunAuditIntent: auditIntentResult.writeIntent,
    outcomeAuditIntent: outcomeAuditResult.writeIntent,
    attemptRecordIntent: attemptResult.writeIntent,
    laneRecordIntent: laneOutput.laneRecordIntent,
    runtime: inertRuntime
  };
}
