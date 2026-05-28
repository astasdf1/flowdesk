import {
	FLOWDESK_SESSION_RECORD_ROOT,
	FLOWDESK_WORKFLOW_STATE_ROOT,
} from "./release1-contracts.js";
import {
	invalid,
	type ValidationResult,
	validateNoForbiddenRawPayloads,
	validateOpaqueId,
} from "./validators.js";

export const FLOWDESK_WORKFLOW_ACTIVE_PATH =
	`${FLOWDESK_WORKFLOW_STATE_ROOT}/active.json` as const;

function assertOpaquePathSegment(value: string, label: string): string {
	const result = validateOpaqueId(value, label);
	if (!result.ok) throw new Error(result.errors.join("; "));
	return value;
}

export function validateFlowDeskRelativeStatePath(
	value: unknown,
	label = "state path",
): ValidationResult {
	if (typeof value !== "string") return invalid(`${label} must be a string`);
	if (!value.startsWith(".flowdesk/"))
		return invalid(`${label} must stay under .flowdesk`);
	if (
		value.startsWith("/") ||
		/^[A-Za-z]:[\\/]/.test(value) ||
		value.startsWith("~")
	)
		return invalid(`${label} must be relative`);
	if (
		value.includes("\\") ||
		value.includes("//") ||
		value.includes("/../") ||
		value.endsWith("/..") ||
		value.includes("/./")
	)
		return invalid(
			`${label} must not contain traversal or platform separators`,
		);
	return validateNoForbiddenRawPayloads(value, label);
}

export function workflowDirectoryPath(workflowId: string): string {
	return `${FLOWDESK_WORKFLOW_STATE_ROOT}/${assertOpaquePathSegment(workflowId, "workflow_id")}`;
}

export function workflowRecordPath(workflowId: string): string {
	return `${workflowDirectoryPath(workflowId)}/workflow.json`;
}

export function attemptRecordPath(
	workflowId: string,
	attemptId: string,
): string {
	return `${workflowDirectoryPath(workflowId)}/attempts/${assertOpaquePathSegment(attemptId, "attempt_id")}.json`;
}

export function checkpointRecordPath(
	workflowId: string,
	checkpointId: string,
): string {
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

export function redactedDebugSectionsDirectoryPath(sessionId: string): string {
	return `${redactedDebugDirectoryPath(sessionId)}/sections`;
}

export function redactedDebugSectionFilePath(
	sessionId: string,
	section: string,
): string {
	if (!/^[a-z][a-z0-9_]*$/.test(section))
		throw new Error("debug section must be a lowercase identifier");
	return `${redactedDebugSectionsDirectoryPath(sessionId)}/${section}.json`;
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
	"dispatch_idempotency",
	"pre_dispatch_audit",
	"exact_model_availability_cache",
	"exact_model_availability_cache_refresh_plan",
	"exact_model_availability_cache_acquisition_plan",
	"exact_model_availability_cache_provider_acquisition_result",
	"reviewer_verdict",
	"reviewer_fanout_plan",
	"runtime_lane_launch_plan",
	"lane_lifecycle",
	"reviewer_lane_conformance",
	"controlled_conformance_doc_write",
	"controlled_redacted_audit_export_write",
	"controlled_workspace_file_write",
	"fallback_regate_plan",
	"lane_heartbeat",
	"pending_abort_warning",
	"pending_abort_cancel",
	"provider_usage_snapshot",
	"reviewer_lane_context",
	"agent_task_context",
	"agent_task_progress",
	"agent_task_inconsistency",
	"agent_task_child_session",
	"pending_retry_plan",
	"retry_executed",
	"retry_failed",
	"task_result",
	"task_failed",
	"workflow_authoring_result",
	"task_graph",
	"task_agent_assignment",
	"task_model_selection",
	"workflow_synthesis_result",
	"workflow_dispatch_plan",
] as const;
export type FlowDeskSessionEvidenceClass =
	(typeof FLOWDESK_SESSION_EVIDENCE_CLASSES)[number];

const evidenceClassSegment: Record<FlowDeskSessionEvidenceClass, string> = {
	usage_authority: "usage-authority",
	runtime_echo: "runtime-echo",
	telemetry_correlation: "telemetry-correlation",
	configured_verification: "configured-verification",
	sanitized_auth_capture: "sanitized-auth-capture",
	external_auth_provider_policy: "external-auth-provider-policy",
	production_approval: "production-approval",
	production_approval_source: "production-approval-source",
	dispatch_idempotency: "dispatch-idempotency",
	pre_dispatch_audit: "pre-dispatch-audit",
	exact_model_availability_cache: "exact-model-availability-cache",
	exact_model_availability_cache_refresh_plan:
		"exact-model-availability-cache-refresh-plan",
	exact_model_availability_cache_acquisition_plan:
		"exact-model-availability-cache-acquisition-plan",
	exact_model_availability_cache_provider_acquisition_result:
		"exact-model-availability-cache-provider-acquisition-result",
	reviewer_verdict: "reviewer-verdict",
	reviewer_fanout_plan: "reviewer-fanout-plan",
	runtime_lane_launch_plan: "runtime-lane-launch-plan",
	lane_lifecycle: "lane-lifecycle",
	reviewer_lane_conformance: "reviewer-lane-conformance",
	controlled_conformance_doc_write: "controlled-conformance-doc-write",
	controlled_redacted_audit_export_write:
		"controlled-redacted-audit-export-write",
	controlled_workspace_file_write: "controlled-workspace-file-write",
	fallback_regate_plan: "fallback-regate-plan",
	lane_heartbeat: "lane-heartbeat",
	pending_abort_warning: "pending-abort-warning",
	pending_abort_cancel: "pending-abort-cancel",
	provider_usage_snapshot: "provider-usage-snapshot",
	reviewer_lane_context: "reviewer-lane-context",
	agent_task_context: "agent-task-context",
	agent_task_progress: "agent-task-progress",
	agent_task_inconsistency: "agent-task-inconsistency",
	agent_task_child_session: "agent-task-child-session",
	pending_retry_plan: "pending-retry-plan",
	retry_executed: "retry-executed",
	retry_failed: "retry-failed",
	task_result: "task-result",
	task_failed: "task-failed",
	workflow_authoring_result: "workflow-authoring-result",
	task_graph: "task-graph",
	task_agent_assignment: "task-agent-assignment",
	task_model_selection: "task-model-selection",
	workflow_synthesis_result: "workflow-synthesis-result",
	workflow_dispatch_plan: "workflow-dispatch-plan",
};

export function sessionEvidenceDirectoryPath(
	sessionId: string,
	evidenceClass: FlowDeskSessionEvidenceClass,
): string {
	return `${sessionDirectoryPath(sessionId)}/evidence/${evidenceClassSegment[evidenceClass]}`;
}

export function sessionEvidenceRecordPath(
	sessionId: string,
	evidenceClass: FlowDeskSessionEvidenceClass,
	evidenceId: string,
): string {
	return `${sessionEvidenceDirectoryPath(sessionId, evidenceClass)}/${assertOpaquePathSegment(evidenceId, "evidence_id")}.json`;
}

export function assertFlowDeskRelativeStatePath(
	value: string,
	label = "state path",
): string {
	const result = validateFlowDeskRelativeStatePath(value, label);
	if (!result.ok) throw new Error(result.errors.join("; "));
	return value;
}

export function isFlowDeskRelativeStatePath(value: unknown): boolean {
	return validateFlowDeskRelativeStatePath(value).ok;
}
