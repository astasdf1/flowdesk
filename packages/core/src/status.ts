import { validateFlowDeskDefaultManagedDispatchPromotionReadinessV1, type FlowDeskDefaultManagedDispatchPromotionReadinessV1 } from "./production-enablement.js";
import { mapProviderFailureClassToDiagnosticOutcomeV1 } from "./provider-failures.js";
import type {
  BlockerSummaryV1,
  FlowDeskAttemptRecordV1,
  FlowDeskCheckpointRecordV1,
  FlowDeskLaneRecordV1,
  FlowDeskProviderHealthSnapshotV1,
  FlowDeskStatusLaneSummaryV1,
  FlowDeskStatusRequestV1,
  FlowDeskStatusResponseV1,
  FlowDeskStatusSummaryArtifactV1,
  FlowDeskWorkflowActiveV1,
  FlowDeskWorkflowRecordV1,
  OpaqueId,
  OpaqueRef,
  ProviderHealthSummaryV1,
  RedactedErrorCategory,
  SafeNextAction,
  ToolStatus
} from "./release1-contracts.js";
import {
  invalid,
  type ValidationResult,
  valid,
  validateAttemptRecordV1,
  validateCheckpointRecordV1,
  validateLaneRecordV1,
  validateOpaqueId,
  validateOpaqueRef,
  validateProviderHealthSnapshotV1,
  validateProviderHealthSummaryV1,
  validateStatusLaneSummaryV1,
  validateStatusRequestV1,
  validateStatusResponseV1,
  validateStatusSummaryArtifactV1,
  validateWorkflowActiveV1,
  validateWorkflowRecordV1
} from "./validators.js";

export interface LaneRecordStatusConversionOptionsV1 {
  planRevisionId?: OpaqueId;
  logRef?: OpaqueRef;
}

export interface FlowDeskStatusCommandInputV1 {
  request: FlowDeskStatusRequestV1;
  active?: FlowDeskWorkflowActiveV1;
  workflow?: FlowDeskWorkflowRecordV1;
  currentAttempt?: FlowDeskAttemptRecordV1;
  checkpoint?: FlowDeskCheckpointRecordV1;
  laneRecords?: readonly FlowDeskLaneRecordV1[];
  laneSummaries?: readonly FlowDeskStatusLaneSummaryV1[];
  providerHealthSnapshot?: FlowDeskProviderHealthSnapshotV1;
  providerHealthSummary?: ProviderHealthSummaryV1;
  defaultManagedDispatchPromotionReadiness?: FlowDeskDefaultManagedDispatchPromotionReadinessV1;
  statusSummaryArtifact?: FlowDeskStatusSummaryArtifactV1;
  auditRef?: OpaqueRef;
  debugRef?: OpaqueRef;
  laneRefs?: readonly OpaqueRef[];
  now?: number;
}

export interface FlowDeskStatusCommandEvaluationV1 extends ValidationResult {
  response: FlowDeskStatusResponseV1;
  laneSummaries: FlowDeskStatusLaneSummaryV1[];
  providerHealthSummary: ProviderHealthSummaryV1;
}

const statusAndDebugActions = ["/flowdesk-status", "/flowdesk-export-debug"] as const;
const redactedStatusRemediation = "Refresh durable workflow state and inspect redacted debug output before taking recovery actions.";
const recoveryBlockingLaneFailures = new Set(["correlation_lost", "telemetry_unavailable"]);

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function uniqueActions(actions: readonly SafeNextAction[]): SafeNextAction[] {
  return [...new Set(actions)].slice(0, 8);
}

function providerUnknownSummary(): ProviderHealthSummaryV1 {
  const diagnostic = mapProviderFailureClassToDiagnosticOutcomeV1("telemetry_ambiguous");
  return {
    provider_family: "unknown",
    availability_state: diagnostic.availability_state,
    failure_class: diagnostic.failure_class,
    dispatchability: diagnostic.dispatchability,
    safe_remediation: diagnostic.safe_remediation
  };
}

function providerHealthDispatchabilityForDisplay(snapshot: FlowDeskProviderHealthSnapshotV1): ProviderHealthSummaryV1["dispatchability"] {
  if (snapshot.availability_state === "healthy" && snapshot.failure_class === "none" && snapshot.freshness === "fresh") return "diagnostic_only";
  if (snapshot.availability_state === "degraded") return "diagnostic_only";
  return "non_dispatchable";
}

export function providerHealthSnapshotToSummaryV1(snapshot: FlowDeskProviderHealthSnapshotV1): ProviderHealthSummaryV1 {
  return {
    provider_family: snapshot.provider_family,
    ...(snapshot.model_family === undefined ? {} : { model_family: snapshot.model_family }),
    availability_state: snapshot.availability_state,
    failure_class: snapshot.failure_class,
    dispatchability: providerHealthDispatchabilityForDisplay(snapshot),
    safe_remediation: snapshot.safe_remediation,
    snapshot_ref: snapshot.snapshot_id
  };
}

export function laneRecordToStatusLaneSummaryV1(record: FlowDeskLaneRecordV1, options: LaneRecordStatusConversionOptionsV1 = {}): FlowDeskStatusLaneSummaryV1 {
  const planRevisionId = record.plan_revision_id ?? options.planRevisionId ?? "plan-unknown";
  return {
    lane_id: record.lane_id,
    workflow_id: record.workflow_id,
    plan_revision_id: planRevisionId,
    ...(record.attempt_id === undefined ? {} : { attempt_id: record.attempt_id }),
    task_ref: record.task_ref,
    lane_class: record.lane_class,
    state: record.state,
    ...(record.failure_class === undefined ? {} : { failure_class: record.failure_class }),
    ...(record.invocation_ref_kind === undefined ? {} : { invocation_ref_kind: record.invocation_ref_kind }),
    ...(record.retry_count === undefined ? {} : { retry_count: record.retry_count }),
    ...(record.verdict_status === undefined ? {} : { verdict_status: record.verdict_status }),
    safe_next_action: record.safe_next_action,
    refs: [...record.refs],
    created_at: record.created_at,
    ...(record.started_at === undefined ? {} : { started_at: record.started_at }),
    updated_at: record.updated_at,
    ...(record.completed_at === undefined ? {} : { completed_at: record.completed_at }),
    event_refs: [...record.event_refs],
    audit_refs: [...record.audit_refs],
		...(options.logRef === undefined ? {} : { log_ref: options.logRef }),
		...(record.observability_ref === undefined
			? {}
			: { observability_ref: record.observability_ref }),
		...(record.debug_ref === undefined ? {} : { debug_ref: record.debug_ref })
	};
}

function statusForWorkflowState(workflow: FlowDeskWorkflowRecordV1, checkpoint: FlowDeskCheckpointRecordV1 | undefined, recoveryAllowsResumeRetry: boolean): ToolStatus {
  if (checkpoint !== undefined && (checkpoint.resume_mode === "abort_only" || (checkpoint.resume_mode !== "status_only" && recoveryAllowsResumeRetry))) return "recovery_available";
  if (workflow.state === "blocked" || workflow.state === "verification_failed" || workflow.state === "retry_pending") return "blocked";
  return "ready";
}

function providerHealthAllowsResumeRetry(summary: ProviderHealthSummaryV1): boolean {
  return summary.provider_family !== "unknown" && summary.availability_state !== "unknown" && summary.availability_state !== "unavailable" && summary.failure_class === "none" && summary.dispatchability !== "non_dispatchable";
}

function laneCorrelationAllowsResumeRetry(workflow: FlowDeskWorkflowRecordV1, laneSummaries: readonly FlowDeskStatusLaneSummaryV1[]): boolean {
  if (laneSummaries.some((summary) => summary.state === "correlation_lost")) return false;
  if (laneSummaries.some((summary) => summary.failure_class !== undefined && recoveryBlockingLaneFailures.has(summary.failure_class))) return false;
  const hasLaneRefs = workflow.lane_refs.length > 0 || workflow.latest_lane_summary_refs.length > 0;
  if (!hasLaneRefs) return true;
  const authoritativeRefs = new Set([...workflow.lane_refs, ...workflow.latest_lane_summary_refs]);
  return laneSummaries.length > 0 && laneSummaries.every((summary) => summary.refs.some((ref) => authoritativeRefs.has(ref)));
}

function checkpointActions(checkpoint: FlowDeskCheckpointRecordV1 | undefined, recoveryAllowsResumeRetry: boolean): SafeNextAction[] {
  if (checkpoint === undefined) return [...statusAndDebugActions];
  if (checkpoint.resume_mode === "resume") return recoveryAllowsResumeRetry ? uniqueActions([...statusAndDebugActions, "/flowdesk-resume"]) : [...statusAndDebugActions];
  if (checkpoint.resume_mode === "retry") return recoveryAllowsResumeRetry ? uniqueActions([...statusAndDebugActions, "/flowdesk-retry"]) : [...statusAndDebugActions];
  if (checkpoint.resume_mode === "abort_only") return uniqueActions([...statusAndDebugActions, "/flowdesk-abort"]);
  return [...statusAndDebugActions];
}

function failClosedActions(includeAbort: boolean): SafeNextAction[] {
  return includeAbort ? ["/flowdesk-status", "/flowdesk-export-debug", "/flowdesk-abort"] : [...statusAndDebugActions];
}

function redactedError(category: RedactedErrorCategory, safeRemediation: string): FlowDeskStatusResponseV1["error"] {
  return { category, safe_remediation: safeRemediation };
}

function promotionReadinessBlockerSummary(readiness: FlowDeskDefaultManagedDispatchPromotionReadinessV1): BlockerSummaryV1 | undefined {
  if (readiness.default_dispatch_candidate) return undefined;
  return {
    category: "conformance",
    summary: `Default managed dispatch promotion is ${readiness.state}; real provider execution remains blocked until promotion readiness is a default candidate.`,
    safe_remediation: "Run /flowdesk-doctor and refresh durable managed-dispatch evidence before enabling default provider execution.",
    refs: [
      readiness.doctor_status_ref,
      `default_dispatch_candidate=${readiness.default_dispatch_candidate}`,
      `managed_dispatch_ready=${readiness.managed_dispatch_ready}`,
      `durable_precall_ready=${readiness.durable_precall_ready}`,
      `adapter_available=${readiness.adapter_available}`,
      `sdk_client_available=${readiness.sdk_client_available}`,
      ...readiness.blocked_labels.map((label) => `promotion_blocker=${label}`),
    ].slice(0, 20),
  };
}

function failClosedResponse(input: Partial<FlowDeskStatusCommandInputV1> | undefined, category: RedactedErrorCategory, message: string, includeAbort = false): FlowDeskStatusResponseV1 {
  const requestWorkflowId = input?.request?.workflow_id;
  const activeWorkflowId = input?.active?.active_workflow_id;
  const workflowIdCandidate = input?.workflow?.workflow_id ?? activeWorkflowId ?? requestWorkflowId;
  const workflowId = validateOpaqueId(workflowIdCandidate, "workflow_id").ok ? workflowIdCandidate : undefined;
  const debugRef = validateOpaqueRef(input?.debugRef, "debug_ref").ok ? input?.debugRef : undefined;
  const blocker: BlockerSummaryV1 = {
    category,
    summary: "FlowDesk status failed closed because authoritative workflow state is missing, stale, corrupt, or ambiguous.",
    safe_remediation: redactedStatusRemediation,
    refs: []
  };
  return {
    schema_version: "flowdesk.status.response.v1",
    ok: false,
    status: "blocked",
    ...(workflowId === undefined ? {} : { workflow_id: workflowId }),
    safe_next_actions: failClosedActions(includeAbort),
    user_message: message,
    ...(debugRef === undefined ? {} : { debug_ref: debugRef }),
    workflow_state: "blocked",
    lane_summaries: [],
    provider_health_summary: providerUnknownSummary(),
    blocker,
    error: redactedError(category, redactedStatusRemediation)
  };
}

function detailAllowsDebugRefs(detailLevel: FlowDeskStatusRequestV1["detail_level"]): boolean {
  return detailLevel === "diagnostic" || detailLevel === "debug_refs" || detailLevel === "lane_refs";
}

function appendResultErrors(errors: string[], label: string, result: ValidationResult): void {
  if (!result.ok) errors.push(...result.errors.map((error) => `${label}: ${error}`));
}

function validateStatusInput(input: Partial<FlowDeskStatusCommandInputV1> | undefined): string[] {
  const errors: string[] = [];
  if (!isRecord(input)) return ["status input is malformed"];
  const now = input.now ?? Date.now();
  appendResultErrors(errors, "request", validateStatusRequestV1(input.request));
  if (input.active === undefined) errors.push("authoritative workflow active record is required");
  else appendResultErrors(errors, "active", validateWorkflowActiveV1(input.active));
  if (input.workflow === undefined) errors.push("authoritative workflow record is required");
  else appendResultErrors(errors, "workflow", validateWorkflowRecordV1(input.workflow));
  if (input.currentAttempt !== undefined) appendResultErrors(errors, "attempt", validateAttemptRecordV1(input.currentAttempt));
  if (input.checkpoint !== undefined) appendResultErrors(errors, "checkpoint", validateCheckpointRecordV1(input.checkpoint));
  if (input.statusSummaryArtifact !== undefined) appendResultErrors(errors, "status_summary", validateStatusSummaryArtifactV1(input.statusSummaryArtifact));
  if (input.providerHealthSnapshot !== undefined) appendResultErrors(errors, "provider_health_snapshot", validateProviderHealthSnapshotV1(input.providerHealthSnapshot));
  if (input.providerHealthSummary !== undefined) appendResultErrors(errors, "provider_health_summary", validateProviderHealthSummaryV1(input.providerHealthSummary));
  if (input.defaultManagedDispatchPromotionReadiness !== undefined) appendResultErrors(errors, "default_managed_dispatch_promotion_readiness", validateFlowDeskDefaultManagedDispatchPromotionReadinessV1(input.defaultManagedDispatchPromotionReadiness, input.workflow?.workflow_id ?? input.active?.active_workflow_id ?? input.request?.workflow_id));
  if (input.auditRef !== undefined) appendResultErrors(errors, "audit_ref", validateOpaqueRef(input.auditRef, "audit_ref"));
  if (input.debugRef !== undefined) appendResultErrors(errors, "debug_ref", validateOpaqueRef(input.debugRef, "debug_ref"));
  for (const [index, laneRef] of (input.laneRefs ?? []).entries()) appendResultErrors(errors, `lane_refs[${index}]`, validateOpaqueRef(laneRef, `lane_refs[${index}]`));
  for (const [index, record] of (input.laneRecords ?? []).entries()) appendResultErrors(errors, `lane_records[${index}]`, validateLaneRecordV1(record));
  for (const [index, summary] of (input.laneSummaries ?? []).entries()) appendResultErrors(errors, `lane_summaries[${index}]`, validateStatusLaneSummaryV1(summary));

  const activeWorkflowId = input.active?.active_workflow_id;
  const activeAttemptId = input.active?.active_attempt_id;
  const workflow = input.workflow;
  const requestWorkflowId = input.request?.workflow_id;
  if (requestWorkflowId !== undefined && activeWorkflowId !== undefined && requestWorkflowId !== activeWorkflowId) errors.push("request workflow id does not match active workflow");
  if (workflow !== undefined && requestWorkflowId !== undefined && requestWorkflowId !== workflow.workflow_id) errors.push("request workflow id does not match workflow record");
  if (workflow !== undefined && activeWorkflowId !== undefined && activeWorkflowId !== workflow.workflow_id) errors.push("active workflow id does not match workflow record");
  if (workflow !== undefined && input.active !== undefined && input.active.state !== workflow.state) errors.push("active workflow state does not match workflow record state");
  if (input.active !== undefined && input.active.state !== "idle" && activeWorkflowId === undefined) errors.push("non-idle active state requires active workflow id");

  const expectedAttemptId = activeAttemptId ?? workflow?.current_attempt_id ?? input.checkpoint?.attempt_id;
  if (expectedAttemptId !== undefined && input.currentAttempt === undefined) errors.push("authoritative current attempt record is required");
  if (input.currentAttempt !== undefined) {
    if (workflow !== undefined && input.currentAttempt.workflow_id !== workflow.workflow_id) errors.push("attempt workflow id does not match workflow record");
    if (activeAttemptId !== undefined && input.currentAttempt.attempt_id !== activeAttemptId) errors.push("attempt id does not match active record");
    if (workflow?.current_attempt_id !== undefined && input.currentAttempt.attempt_id !== workflow.current_attempt_id) errors.push("attempt id does not match workflow current attempt");
  }

  if (workflow?.latest_checkpoint_id !== undefined && input.checkpoint === undefined) errors.push("latest checkpoint record is required");
  if (input.checkpoint !== undefined) {
    if (workflow !== undefined && input.checkpoint.workflow_id !== workflow.workflow_id) errors.push("checkpoint workflow id does not match workflow record");
    if (workflow?.latest_checkpoint_id !== undefined && input.checkpoint.checkpoint_id !== workflow.latest_checkpoint_id) errors.push("checkpoint id does not match workflow latest checkpoint");
    if (input.checkpoint.attempt_id !== undefined && input.currentAttempt !== undefined && input.checkpoint.attempt_id !== input.currentAttempt.attempt_id) errors.push("checkpoint attempt id does not match current attempt");
    const expiresAt = Date.parse(input.checkpoint.expires_at);
    if (!Number.isFinite(expiresAt) || expiresAt <= now) errors.push("checkpoint is stale or has invalid expiry");
  }

  if (input.statusSummaryArtifact !== undefined && workflow !== undefined) {
    if (input.statusSummaryArtifact.workflow_id !== workflow.workflow_id) errors.push("status summary workflow id does not match workflow record");
    if (input.statusSummaryArtifact.state !== workflow.state) errors.push("status summary state does not match workflow record");
    if (input.statusSummaryArtifact.checkpoint_id !== undefined && input.checkpoint !== undefined && input.statusSummaryArtifact.checkpoint_id !== input.checkpoint.checkpoint_id) errors.push("status summary checkpoint id does not match checkpoint record");
  }

  for (const record of input.laneRecords ?? []) {
    if (workflow !== undefined && record.workflow_id !== workflow.workflow_id) errors.push("lane record workflow id does not match workflow record");
    if (input.currentAttempt?.attempt_id !== undefined && record.attempt_id !== undefined && record.attempt_id !== input.currentAttempt.attempt_id) errors.push("lane record attempt id does not match current attempt");
    if (workflow !== undefined && workflow.latest_lane_summary_refs.length > 0 && !record.refs.some((ref) => workflow.latest_lane_summary_refs.includes(ref))) errors.push("lane record refs do not match workflow latest lane summaries");
  }
  for (const summary of input.laneSummaries ?? []) {
    if (workflow !== undefined && summary.workflow_id !== workflow.workflow_id) errors.push("lane summary workflow id does not match workflow record");
    if (input.currentAttempt?.attempt_id !== undefined && summary.attempt_id !== undefined && summary.attempt_id !== input.currentAttempt.attempt_id) errors.push("lane summary attempt id does not match current attempt");
    if (workflow !== undefined && workflow.latest_lane_summary_refs.length > 0 && !summary.refs.some((ref) => workflow.latest_lane_summary_refs.includes(ref))) errors.push("lane summary refs do not match workflow latest lane summaries");
  }
  return errors;
}

export function buildFlowDeskStatusResponseV1(input: FlowDeskStatusCommandInputV1): FlowDeskStatusResponseV1 {
  const inputErrors = validateStatusInput(input);
  if (inputErrors.length > 0) {
    const includeAbort = input?.active?.active_workflow_id !== undefined || input?.workflow?.workflow_id !== undefined;
    return failClosedResponse(input, "state", "FlowDesk could not produce an authoritative status because durable workflow state is missing or ambiguous.", includeAbort);
  }

  const workflow = input.workflow as FlowDeskWorkflowRecordV1;
  const detailLevel = input.request.detail_level ?? "summary";
  const providerHealthSummary = input.providerHealthSummary ?? (input.providerHealthSnapshot === undefined ? providerUnknownSummary() : providerHealthSnapshotToSummaryV1(input.providerHealthSnapshot));
  const laneSummaries = [
    ...(input.laneSummaries ?? []),
    ...(input.laneRecords ?? []).map((record) => laneRecordToStatusLaneSummaryV1(record, { planRevisionId: workflow.latest_plan_revision_id }))
  ];
  const checkpoint = input.checkpoint;
  const recoveryAllowsResumeRetry = providerHealthAllowsResumeRetry(providerHealthSummary) && laneCorrelationAllowsResumeRetry(workflow, laneSummaries);
  const currentStepId = workflow.current_step_id ?? input.currentAttempt?.step_id ?? checkpoint?.current_step_id;
  const auditRef = input.auditRef ?? (detailAllowsDebugRefs(detailLevel) ? workflow.audit_refs[0] : undefined);
  const laneRefs = detailLevel === "lane_refs" ? [...(input.laneRefs ?? workflow.lane_refs)] : undefined;
  const promotionBlocker = input.defaultManagedDispatchPromotionReadiness === undefined ? undefined : promotionReadinessBlockerSummary(input.defaultManagedDispatchPromotionReadiness);
  const response: FlowDeskStatusResponseV1 = {
    schema_version: "flowdesk.status.response.v1",
    ok: true,
    status: statusForWorkflowState(workflow, checkpoint, recoveryAllowsResumeRetry),
    workflow_id: workflow.workflow_id,
    safe_next_actions: checkpointActions(checkpoint, recoveryAllowsResumeRetry),
    user_message: `FlowDesk status is ${workflow.state}.`,
    ...(auditRef === undefined ? {} : { audit_ref: auditRef }),
    ...(detailAllowsDebugRefs(detailLevel) && input.debugRef !== undefined ? { debug_ref: input.debugRef } : {}),
    ...(laneRefs === undefined ? {} : { lane_refs: laneRefs }),
    workflow_state: workflow.state,
    ...(currentStepId === undefined ? {} : { current_step_id: currentStepId }),
    lane_summaries: laneSummaries,
    provider_health_summary: providerHealthSummary,
    ...(workflow.blocker_summary === undefined && promotionBlocker === undefined ? {} : { blocker: workflow.blocker_summary ?? promotionBlocker }),
    ...(checkpoint === undefined ? {} : { checkpoint_id: checkpoint.checkpoint_id })
  };
  const responseResult = validateStatusResponseV1(response);
  if (!responseResult.ok) return failClosedResponse(input, "schema", "FlowDesk status display failed schema validation and was blocked before recovery actions were suggested.", true);
  return response;
}

export function evaluateFlowDeskStatusCommandV1(input: FlowDeskStatusCommandInputV1): FlowDeskStatusCommandEvaluationV1 {
  const response = buildFlowDeskStatusResponseV1(input);
  const responseResult = validateStatusResponseV1(response);
  const laneSummaries = response.lane_summaries;
  const providerHealthSummary = response.provider_health_summary;
  if (!responseResult.ok) return { ...invalid(...responseResult.errors), response, laneSummaries, providerHealthSummary };
  return { ...valid(), response, laneSummaries, providerHealthSummary };
}

export function buildFlowDeskStatusSummaryArtifactV1(response: FlowDeskStatusResponseV1, options: { statusSummaryRef?: OpaqueRef; usageSummaryRef?: OpaqueRef; providerHealthSummaryRef?: OpaqueRef } = {}): FlowDeskStatusSummaryArtifactV1 {
  return {
    schema_version: "flowdesk.status_summary.v1",
    workflow_id: response.workflow_id ?? "",
    state: response.workflow_state,
    ...(response.current_step_id === undefined ? {} : { current_step_id: response.current_step_id }),
    ...(response.blocker === undefined ? {} : { blocker_summary: response.blocker }),
    lane_summary_refs: response.lane_summaries.flatMap((summary) => summary.refs).slice(0, 20),
    ...(options.usageSummaryRef === undefined ? {} : { usage_summary_ref: options.usageSummaryRef }),
    ...(options.providerHealthSummaryRef === undefined ? {} : { provider_health_summary_ref: options.providerHealthSummaryRef }),
    ...(response.checkpoint_id === undefined ? {} : { checkpoint_id: response.checkpoint_id }),
    safe_next_actions: response.safe_next_actions,
    audit_refs: response.audit_ref === undefined ? [] : [response.audit_ref],
    ...(response.debug_ref === undefined ? {} : { debug_ref: response.debug_ref })
  };
}
