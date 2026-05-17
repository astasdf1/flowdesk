import { preparePreRunAuditWriteIntent } from "./audit.js";
import { getFlowDeskCommandManifestEntry, type FlowDeskRelease1MinimumPortableCommandName } from "./command-manifest.js";
import { evaluateGuardBoundaryV1, type GuardBoundaryDecisionV1, type GuardBoundaryInputV1 } from "./guard-boundary.js";
import type { FlowDeskAuditEventV1, FlowDeskAuditRecordV1, FlowDeskRunRequestV1, FlowDeskRunResponseV1, IsoTimestamp, OpaqueId, OpaqueRef, RedactedErrorCategory, SafeNextAction } from "./release1-contracts.js";
import type { FlowDeskStateWriteIntent } from "./state-store.js";
import { validateOpaqueId, validateRunRequestV1, validateRunResponseV1, type ValidationResult } from "./validators.js";

export interface FlowDeskGuardedDryRunCommandInputV1 {
  commandName: FlowDeskRelease1MinimumPortableCommandName;
  request: FlowDeskRunRequestV1;
  guardBoundary: Omit<GuardBoundaryInputV1, "operation" | "workflowId">;
  sessionId: OpaqueId;
  attemptId: OpaqueId;
  auditEventId: OpaqueId;
  nowIso: IsoTimestamp;
  decisionRef: OpaqueRef;
  routeRef: OpaqueRef;
  commandShapeHash: string;
  runResultRef: OpaqueRef;
  verificationSummaryRef: OpaqueRef;
  redactionVersion: string;
}

export interface FlowDeskGuardedDryRunPlanningEvidenceV1 {
  plan_revision_id: OpaqueId;
  route_ref: OpaqueRef;
  guard_decision_ref: OpaqueRef;
  command_shape_hash: string;
  pre_run_audit_ref: OpaqueRef;
  request_schema_id: "flowdesk.run.request.v1";
  response_schema_id: "flowdesk.run.response.v1";
}

export interface FlowDeskGuardedDryRunCommandEvaluationV1 extends ValidationResult {
  commandName: FlowDeskRelease1MinimumPortableCommandName;
  guardDecision: GuardBoundaryDecisionV1;
  response: FlowDeskRunResponseV1;
  planningEvidence?: FlowDeskGuardedDryRunPlanningEvidenceV1;
  preRunAuditIntent?: FlowDeskStateWriteIntent<FlowDeskAuditRecordV1>;
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

function redactedError(category: RedactedErrorCategory, safeRemediation: string): FlowDeskRunResponseV1["error"] {
  return { category, safe_remediation: safeRemediation };
}

function responseFor(input: FlowDeskGuardedDryRunCommandInputV1, ok: boolean, status: FlowDeskRunResponseV1["status"], userMessage: string, safeNextActions: SafeNextAction[], error?: FlowDeskRunResponseV1["error"]): FlowDeskRunResponseV1 {
  return {
    schema_version: "flowdesk.run.response.v1",
    ok,
    status,
    safe_next_actions: safeNextActions,
    user_message: userMessage,
    ...(error === undefined ? {} : { error }),
    run_result_ref: input.runResultRef,
    verification_summary_ref: input.verificationSummaryRef,
    artifact_disposition: "none"
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

export function evaluateFlowDeskGuardedDryRunCommandV1(input: FlowDeskGuardedDryRunCommandInputV1): FlowDeskGuardedDryRunCommandEvaluationV1 {
  const manifestEntry = getFlowDeskCommandManifestEntry(input.commandName);
  const requestResult = validateRunRequestV1(input.request);
  const idErrors = resultErrors(
    validateOpaqueId(input.sessionId, "session_id"),
    validateOpaqueId(input.attemptId, "attempt_id"),
    validateOpaqueId(input.auditEventId, "audit_event_id"),
    validateOpaqueId(input.decisionRef, "decision_ref"),
    validateOpaqueId(input.routeRef, "route_ref"),
    validateOpaqueId(input.commandShapeHash, "command_shape_hash"),
    validateOpaqueId(input.runResultRef, "run_result_ref"),
    validateOpaqueId(input.verificationSummaryRef, "verification_summary_ref")
  );
  const baseErrors = [...requestResult.errors, ...idErrors];

  if (manifestEntry === undefined || input.commandName !== "/flowdesk-run" || manifestEntry.toolName !== "flowdesk_run") baseErrors.push("guarded dry-run evaluator only accepts the /flowdesk-run command");
  if (manifestEntry !== undefined && (manifestEntry.actualLaneLaunch || manifestEntry.providerCall || manifestEntry.dispatchApprovalEligible || manifestEntry.fallbackAuthority || manifestEntry.hardCancelOrNoReplyAuthority)) baseErrors.push("command manifest is not inert for Release 1 dry-run evaluation");
  if (input.request.run_mode !== "guarded-dry-run") baseErrors.push("guarded dry-run evaluator requires run_mode guarded-dry-run");
  if (input.request.workflow_id === undefined) baseErrors.push("guarded dry-run evaluator requires workflow_id for guard binding");

  if (baseErrors.length > 0) {
    const guardDecision = blockedDecision("schema", "Run command request failed closed before Guard evaluation.");
    const response = responseFor(input, false, "blocked", "FlowDesk blocked this dry-run before execution planning.", ["/flowdesk-doctor", "/flowdesk-status"], redactedError("schema", "Run doctor or status, then retry with a schema-valid guarded dry-run request."));
    const responseResult = validateRunResponseV1(response);
    return { ok: false, errors: [...baseErrors, ...responseResult.errors], commandName: input.commandName, guardDecision, response, runtime: inertRuntime };
  }

  const guardDecision = evaluateGuardBoundaryV1({ ...input.guardBoundary, operation: "guarded-dry-run", workflowId: input.request.workflow_id });
  if (guardDecision.status !== "eligible") {
    const response = responseFor(input, false, "blocked", guardDecision.redacted_reason, [...guardDecision.safe_next_actions], redactedError(guardDecision.reason_category, "Use FlowDesk doctor or status to refresh the missing non-dispatch evidence."));
    const responseResult = validateRunResponseV1(response);
    return { ok: false, errors: responseResult.errors, commandName: input.commandName, guardDecision, response, runtime: inertRuntime };
  }

  const auditEvent: FlowDeskAuditEventV1 = {
    schema_version: "flowdesk.audit_event.v1",
    event_id: input.auditEventId,
    event_type: "pre_run_guarded_dry_run",
    workflow_id: input.request.workflow_id,
    attempt_id: input.attemptId,
    ...(input.request.step_id === undefined ? {} : { step_id: input.request.step_id }),
    created_at: input.nowIso,
    actor_class: "flowdesk",
    decision_ref: input.decisionRef,
    redaction_version: input.redactionVersion,
    summary_label: "Guarded dry-run planned without dispatch.",
    artifact_refs: [input.runResultRef, input.verificationSummaryRef]
  };
  const auditIntentResult = preparePreRunAuditWriteIntent(input.sessionId, auditEvent, {
    auditRef: input.guardBoundary.auditRef ?? input.decisionRef,
    evidenceRefs: [input.routeRef, input.decisionRef, input.guardBoundary.conformanceRef, input.guardBoundary.runtimeCapabilityRef].filter((ref): ref is string => ref !== undefined)
  });

  if (!auditIntentResult.ok || auditIntentResult.writeIntent === undefined) {
    const response = responseFor(input, false, "blocked", "FlowDesk blocked this dry-run because pre-run audit evidence could not be prepared.", ["/flowdesk-doctor", "/flowdesk-status"], redactedError("audit", "Refresh audit evidence before retrying the guarded dry-run."));
    const responseResult = validateRunResponseV1(response);
    return { ok: false, errors: [...auditIntentResult.errors, ...responseResult.errors], commandName: input.commandName, guardDecision: blockedDecision("audit", "Pre-run audit evidence preparation failed."), response, runtime: inertRuntime };
  }

  const response = responseFor(input, true, "dry_run_complete", "FlowDesk completed an inert guarded dry-run plan. No OpenCode dispatch, lane launch, provider call, fallback, cancellation authority, or state write occurred.", ["/flowdesk-status", "/flowdesk-export-debug"], undefined);
  const responseResult = validateRunResponseV1(response);
  const planningEvidence: FlowDeskGuardedDryRunPlanningEvidenceV1 = {
    plan_revision_id: input.request.plan_revision_id,
    route_ref: input.routeRef,
    guard_decision_ref: input.decisionRef,
    command_shape_hash: input.commandShapeHash,
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
    planningEvidence,
    preRunAuditIntent: auditIntentResult.writeIntent,
    runtime: inertRuntime
  };
}
