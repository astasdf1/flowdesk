import type { FlowDeskAuditEventV1, FlowDeskAuditRecordV1, OpaqueRef } from "./release1-contracts.js";
import { prepareAuditRecordWriteIntent, type FlowDeskStatePrepareResult } from "./state-store.js";
import { invalid, validateAuditEventV1, validateAuditRecordV1, validateOpaqueId, validateOpaqueRef, valid, type ValidationResult } from "./validators.js";

export interface FlowDeskAuditRecordOptions {
  auditRef: OpaqueRef;
  checkpointId?: string;
  evidenceRefs?: OpaqueRef[];
}

function validateRefArray(values: readonly string[] | undefined, label: string, maxItems: number): ValidationResult {
  if (values === undefined) return valid();
  if (!Array.isArray(values)) return invalid(`${label} must be an array`);
  const errors: string[] = [];
  if (values.length > maxItems) errors.push(`${label} exceeds max items ${maxItems}`);
  values.forEach((value, index) => {
    errors.push(...validateOpaqueRef(value, `${label}[${index}]`).errors);
  });
  return errors.length === 0 ? valid() : invalid(...errors);
}

export function auditEventToAuditRecord(event: FlowDeskAuditEventV1, options: FlowDeskAuditRecordOptions): FlowDeskStatePrepareResult<FlowDeskAuditRecordV1> {
  const eventResult = validateAuditEventV1(event);
  if (!eventResult.ok) return eventResult;
  const optionResult = validateRefArray(options.evidenceRefs, "evidence_refs", 20);
  if (!optionResult.ok) return optionResult;
  const auditRefResult = validateOpaqueRef(options.auditRef, "audit_ref");
  if (!auditRefResult.ok) return auditRefResult;
  if (options.checkpointId !== undefined) {
    const checkpointResult = validateOpaqueId(options.checkpointId, "checkpoint_id");
    if (!checkpointResult.ok) return checkpointResult;
  }
  const record: FlowDeskAuditRecordV1 = {
    schema_version: "flowdesk.audit_record.v1",
    audit_ref: options.auditRef,
    event_id: event.event_id,
    workflow_id: event.workflow_id,
    attempt_id: event.attempt_id,
    step_id: event.step_id,
    checkpoint_id: options.checkpointId,
    event_type: event.event_type,
    created_at: event.created_at,
    actor_class: event.actor_class,
    summary_label: event.summary_label,
    policy_ref: event.policy_ref,
    decision_ref: event.decision_ref,
    evidence_refs: [...(options.evidenceRefs ?? [])],
    artifact_refs: [...event.artifact_refs],
    redaction_version: event.redaction_version
  };
  const recordResult = validateAuditRecordV1(record);
  return recordResult.ok ? { ...recordResult, record } : recordResult;
}

export function prepareAuditEventWriteIntent(sessionId: string, event: FlowDeskAuditEventV1, options: FlowDeskAuditRecordOptions): FlowDeskStatePrepareResult<FlowDeskAuditRecordV1> {
  const recordResult = auditEventToAuditRecord(event, options);
  if (!recordResult.ok || recordResult.record === undefined) return recordResult;
  return prepareAuditRecordWriteIntent(sessionId, recordResult.record);
}

export function preparePreRunAuditWriteIntent(sessionId: string, event: FlowDeskAuditEventV1, options: FlowDeskAuditRecordOptions): FlowDeskStatePrepareResult<FlowDeskAuditRecordV1> {
  if (!event.event_type.includes("pre") || (!event.event_type.includes("run") && !event.event_type.includes("dispatch"))) return invalid("pre-run audit event_type must identify pre-run or pre-dispatch audit");
  if (event.workflow_id === undefined || event.attempt_id === undefined) return invalid("pre-run audit requires workflow_id and attempt_id");
  return prepareAuditEventWriteIntent(sessionId, event, options);
}
