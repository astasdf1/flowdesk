import { FLOWDESK_SESSION_RECORD_ROOT, FLOWDESK_WORKFLOW_STATE_ROOT } from "./release1-contracts.js";
import { invalid, validateNoForbiddenRawPayloads, validateOpaqueId, type ValidationResult } from "./validators.js";

export const FLOWDESK_WORKFLOW_ACTIVE_PATH = `${FLOWDESK_WORKFLOW_STATE_ROOT}/active.json` as const;

function assertOpaquePathSegment(value: string, label: string): string {
  const result = validateOpaqueId(value, label);
  if (!result.ok) throw new Error(result.errors.join("; "));
  return value;
}

export function validateFlowDeskRelativeStatePath(value: unknown, label = "state path"): ValidationResult {
  if (typeof value !== "string") return invalid(`${label} must be a string`);
  if (!value.startsWith(".flowdesk/")) return invalid(`${label} must stay under .flowdesk`);
  if (value.startsWith("/") || /^[A-Za-z]:[\\/]/.test(value) || value.startsWith("~")) return invalid(`${label} must be relative`);
  if (value.includes("\\") || value.includes("//") || value.includes("/../") || value.endsWith("/..") || value.includes("/./")) return invalid(`${label} must not contain traversal or platform separators`);
  return validateNoForbiddenRawPayloads(value, label);
}

export function workflowDirectoryPath(workflowId: string): string {
  return `${FLOWDESK_WORKFLOW_STATE_ROOT}/${assertOpaquePathSegment(workflowId, "workflow_id")}`;
}

export function workflowRecordPath(workflowId: string): string {
  return `${workflowDirectoryPath(workflowId)}/workflow.json`;
}

export function attemptRecordPath(workflowId: string, attemptId: string): string {
  return `${workflowDirectoryPath(workflowId)}/attempts/${assertOpaquePathSegment(attemptId, "attempt_id")}.json`;
}

export function checkpointRecordPath(workflowId: string, checkpointId: string): string {
  return `${workflowDirectoryPath(workflowId)}/checkpoints/${assertOpaquePathSegment(checkpointId, "checkpoint_id")}.json`;
}

export function activeAttemptLockPath(workflowId: string): string {
  return `${workflowDirectoryPath(workflowId)}/locks/active-attempt.lock`;
}

export function sessionDirectoryPath(sessionId: string): string {
  return `${FLOWDESK_SESSION_RECORD_ROOT}/${assertOpaquePathSegment(sessionId, "session_id")}`;
}

export function sessionLanesPath(sessionId: string): string {
  return `${sessionDirectoryPath(sessionId)}/lanes.jsonl`;
}

export function sessionAuditPath(sessionId: string): string {
  return `${sessionDirectoryPath(sessionId)}/audit.jsonl`;
}

export function redactedDebugDirectoryPath(sessionId: string): string {
  return `${sessionDirectoryPath(sessionId)}/redacted-debug`;
}

export function redactedDebugManifestPath(sessionId: string): string {
  return `${redactedDebugDirectoryPath(sessionId)}/manifest.json`;
}

export const FLOWDESK_SESSION_EVIDENCE_CLASSES = [
  "usage_authority",
  "runtime_echo",
  "telemetry_correlation",
  "configured_verification",
  "sanitized_auth_capture",
  "external_auth_provider_policy",
  "production_approval",
  "production_approval_source",
  "pre_dispatch_audit"
] as const;
export type FlowDeskSessionEvidenceClass = (typeof FLOWDESK_SESSION_EVIDENCE_CLASSES)[number];

const evidenceClassSegment: Record<FlowDeskSessionEvidenceClass, string> = {
  usage_authority: "usage-authority",
  runtime_echo: "runtime-echo",
  telemetry_correlation: "telemetry-correlation",
  configured_verification: "configured-verification",
  sanitized_auth_capture: "sanitized-auth-capture",
  external_auth_provider_policy: "external-auth-provider-policy",
  production_approval: "production-approval",
  production_approval_source: "production-approval-source",
  pre_dispatch_audit: "pre-dispatch-audit"
};

export function sessionEvidenceDirectoryPath(sessionId: string, evidenceClass: FlowDeskSessionEvidenceClass): string {
  return `${sessionDirectoryPath(sessionId)}/evidence/${evidenceClassSegment[evidenceClass]}`;
}

export function sessionEvidenceRecordPath(sessionId: string, evidenceClass: FlowDeskSessionEvidenceClass, evidenceId: string): string {
  return `${sessionEvidenceDirectoryPath(sessionId, evidenceClass)}/${assertOpaquePathSegment(evidenceId, "evidence_id")}.json`;
}

export function assertFlowDeskRelativeStatePath(value: string, label = "state path"): string {
  const result = validateFlowDeskRelativeStatePath(value, label);
  if (!result.ok) throw new Error(result.errors.join("; "));
  return value;
}

export function isFlowDeskRelativeStatePath(value: unknown): boolean {
  return validateFlowDeskRelativeStatePath(value).ok;
}
