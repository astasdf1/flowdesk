import type { FlowDeskTaskResultV1 } from "./task-result.js";
import {
	invalid,
	type ValidationResult,
	valid,
	validateNoForbiddenRawPayloads,
} from "./validators.js";
import { validateFlowDeskTaskResultV1 } from "./task-result.js";

export const FLOWDESK_S7_EXPOSURE_AUTHORIZATION_SCHEMA_VERSION =
	"flowdesk.managed_dispatch_exposure_authorization.v1" as const;

export const FLOWDESK_S7_REQUIRED_S6_TUPLE = {
	workflow_id: "workflow-s6-low-risk-managed-dispatch-live-smoke-20260615",
	lane_id: "lane-task-mqej90wn",
	task_id: "task-mqej90wn",
	result_evidence_id: "task-result-task-mqej90wn-watchdog-60b75cc0",
	sentinel: "S6_LIVE_SMOKE_OK_20260615",
	progress_snapshot_workflow_id: "workflow-s6-progress-snapshot-update-20260615",
} as const;

export const FLOWDESK_S7_EXPOSURE_AUTHORITY_FALSE_FLAGS = [
	"dispatch_authority_enabled",
	"fallback_authority_enabled",
	"external_write_authority_enabled",
	"hard_chat_authority_enabled",
	"no_reply_authority_enabled",
	"opencode_internal_authority_enabled",
	"providerCall",
	"actualLaneLaunch",
	"runtimeExecution",
	"realOpenCodeDispatch",
] as const;

export type FlowDeskManagedDispatchExposureAuthorizationBlockedLabelV1 =
	| "task_result_missing"
	| "task_result_invalid"
	| "s6_workflow_mismatched"
	| "s6_lane_mismatched"
	| "s6_task_mismatched"
	| "s6_result_evidence_mismatched"
	| "s6_sentinel_mismatched"
	| "s6_progress_snapshot_workflow_mismatched"
	| "s6_task_result_stale"
	| "s7_authorization_expired"
	| "negative_authority_not_explicit";

export interface FlowDeskManagedDispatchExposureAuthorizationV1 {
	schema_version: typeof FLOWDESK_S7_EXPOSURE_AUTHORIZATION_SCHEMA_VERSION;
	workflow_id: string;
	state: "authorized" | "blocked";
	ok: boolean;
	blocked_labels: FlowDeskManagedDispatchExposureAuthorizationBlockedLabelV1[];
	exposure_readiness_authorized: boolean;
	authorization_scope: "managed_dispatch_exposure_readiness_only";
	required_s6_workflow_id: string;
	required_s6_lane_id: string;
	required_s6_task_id: string;
	required_s6_result_evidence_id: string;
	required_s6_sentinel: string;
	progress_snapshot_workflow_id: string;
	task_result_created_at?: string;
	created_at: string;
	expires_at: string;
	redaction_version: "v1";
	dispatch_authority_enabled: false;
	fallback_authority_enabled: false;
	external_write_authority_enabled: false;
	hard_chat_authority_enabled: false;
	no_reply_authority_enabled: false;
	opencode_internal_authority_enabled: false;
	providerCall: false;
	actualLaneLaunch: false;
	runtimeExecution: false;
	realOpenCodeDispatch: false;
}

export interface EvaluateFlowDeskManagedDispatchExposureAuthorizationInputV1 {
	taskResultEvidence?: FlowDeskTaskResultV1 | unknown;
	taskResultEvidenceId?: string;
	progressSnapshotWorkflowId?: string;
	now?: string | number | Date;
	maxTaskResultAgeMs?: number;
	expiresAt?: string;
}

const DEFAULT_MAX_TASK_RESULT_AGE_MS = 24 * 60 * 60 * 1000;
const DEFAULT_AUTHORIZATION_TTL_MS = 10 * 60 * 1000;

function timestampMs(value: unknown): number | undefined {
	if (typeof value !== "string" && typeof value !== "number" && !(value instanceof Date)) return undefined;
	const parsed = typeof value === "number" ? value : value instanceof Date ? value.getTime() : Date.parse(value);
	return Number.isFinite(parsed) ? parsed : undefined;
}

function unique<T extends string>(items: readonly T[]): T[] {
	return [...new Set(items)];
}

function pushIf(labels: FlowDeskManagedDispatchExposureAuthorizationBlockedLabelV1[], condition: boolean, label: FlowDeskManagedDispatchExposureAuthorizationBlockedLabelV1): void {
	if (condition) labels.push(label);
}

export function evaluateFlowDeskManagedDispatchExposureAuthorizationV1(
	input: EvaluateFlowDeskManagedDispatchExposureAuthorizationInputV1,
): FlowDeskManagedDispatchExposureAuthorizationV1 {
	const nowMs = timestampMs(input.now) ?? Date.now();
	const createdAt = new Date(nowMs).toISOString();
	const expiresAt = input.expiresAt ?? new Date(nowMs + DEFAULT_AUTHORIZATION_TTL_MS).toISOString();
	const labels: FlowDeskManagedDispatchExposureAuthorizationBlockedLabelV1[] = [];
	const taskResult = input.taskResultEvidence;

	if (taskResult === undefined) {
		labels.push("task_result_missing");
	} else {
		const taskValidation = validateFlowDeskTaskResultV1(taskResult);
		if (!taskValidation.ok) labels.push("task_result_invalid");
	}

	if (taskResult !== undefined && typeof taskResult === "object" && taskResult !== null && !Array.isArray(taskResult)) {
		const record = taskResult as Partial<FlowDeskTaskResultV1>;
		pushIf(labels, record.workflow_id !== FLOWDESK_S7_REQUIRED_S6_TUPLE.workflow_id, "s6_workflow_mismatched");
		pushIf(labels, record.lane_id !== FLOWDESK_S7_REQUIRED_S6_TUPLE.lane_id, "s6_lane_mismatched");
		pushIf(labels, record.task_id !== FLOWDESK_S7_REQUIRED_S6_TUPLE.task_id, "s6_task_mismatched");
		pushIf(labels, typeof record.result_text !== "string" || !record.result_text.includes(FLOWDESK_S7_REQUIRED_S6_TUPLE.sentinel), "s6_sentinel_mismatched");

		const taskCreatedMs = timestampMs(record.created_at);
		const maxAgeMs = input.maxTaskResultAgeMs ?? DEFAULT_MAX_TASK_RESULT_AGE_MS;
		pushIf(labels, taskCreatedMs === undefined || nowMs - taskCreatedMs > maxAgeMs || taskCreatedMs > nowMs, "s6_task_result_stale");
	}

	pushIf(labels, input.taskResultEvidenceId !== FLOWDESK_S7_REQUIRED_S6_TUPLE.result_evidence_id, "s6_result_evidence_mismatched");
	pushIf(labels, input.progressSnapshotWorkflowId !== FLOWDESK_S7_REQUIRED_S6_TUPLE.progress_snapshot_workflow_id, "s6_progress_snapshot_workflow_mismatched");
	pushIf(labels, timestampMs(expiresAt) === undefined || (timestampMs(expiresAt) ?? 0) <= nowMs, "s7_authorization_expired");

	const blockedLabels = unique(labels);
	const ok = blockedLabels.length === 0;
	const taskResultCreatedAt =
		taskResult !== undefined && typeof taskResult === "object" && taskResult !== null && !Array.isArray(taskResult)
			? (taskResult as Partial<FlowDeskTaskResultV1>).created_at
			: undefined;

	return {
		schema_version: FLOWDESK_S7_EXPOSURE_AUTHORIZATION_SCHEMA_VERSION,
		workflow_id: FLOWDESK_S7_REQUIRED_S6_TUPLE.workflow_id,
		state: ok ? "authorized" : "blocked",
		ok,
		blocked_labels: blockedLabels,
		exposure_readiness_authorized: ok,
		authorization_scope: "managed_dispatch_exposure_readiness_only",
		required_s6_workflow_id: FLOWDESK_S7_REQUIRED_S6_TUPLE.workflow_id,
		required_s6_lane_id: FLOWDESK_S7_REQUIRED_S6_TUPLE.lane_id,
		required_s6_task_id: FLOWDESK_S7_REQUIRED_S6_TUPLE.task_id,
		required_s6_result_evidence_id: FLOWDESK_S7_REQUIRED_S6_TUPLE.result_evidence_id,
		required_s6_sentinel: FLOWDESK_S7_REQUIRED_S6_TUPLE.sentinel,
		progress_snapshot_workflow_id: FLOWDESK_S7_REQUIRED_S6_TUPLE.progress_snapshot_workflow_id,
		...(taskResultCreatedAt === undefined ? {} : { task_result_created_at: taskResultCreatedAt }),
		created_at: createdAt,
		expires_at: expiresAt,
		redaction_version: "v1",
		dispatch_authority_enabled: false,
		fallback_authority_enabled: false,
		external_write_authority_enabled: false,
		hard_chat_authority_enabled: false,
		no_reply_authority_enabled: false,
		opencode_internal_authority_enabled: false,
		providerCall: false,
		actualLaneLaunch: false,
		runtimeExecution: false,
		realOpenCodeDispatch: false,
	};
}

export function validateFlowDeskManagedDispatchExposureAuthorizationV1(value: unknown): ValidationResult {
	if (typeof value !== "object" || value === null || Array.isArray(value)) return invalid("managed dispatch exposure authorization must be an object");
	const record = value as Partial<FlowDeskManagedDispatchExposureAuthorizationV1> & Record<string, unknown>;
	const errors: string[] = [];
	const allowed = new Set([
		"schema_version",
		"workflow_id",
		"state",
		"ok",
		"blocked_labels",
		"exposure_readiness_authorized",
		"authorization_scope",
		"required_s6_workflow_id",
		"required_s6_lane_id",
		"required_s6_task_id",
		"required_s6_result_evidence_id",
		"required_s6_sentinel",
		"progress_snapshot_workflow_id",
		"task_result_created_at",
		"created_at",
		"expires_at",
		"redaction_version",
		...FLOWDESK_S7_EXPOSURE_AUTHORITY_FALSE_FLAGS,
	]);
	for (const key of Object.keys(record)) if (!allowed.has(key)) errors.push(`unknown property: ${key}`);

	if (record.schema_version !== FLOWDESK_S7_EXPOSURE_AUTHORIZATION_SCHEMA_VERSION) errors.push("schema_version must be flowdesk.managed_dispatch_exposure_authorization.v1");
	if (record.workflow_id !== FLOWDESK_S7_REQUIRED_S6_TUPLE.workflow_id) errors.push("workflow_id must match required S6 workflow");
	if (record.state !== "authorized" && record.state !== "blocked") errors.push("state must be authorized or blocked");
	if (typeof record.ok !== "boolean") errors.push("ok must be a boolean");
	if (!Array.isArray(record.blocked_labels)) errors.push("blocked_labels must be an array");
	else {
		for (const label of record.blocked_labels) {
			if (typeof label !== "string") errors.push("blocked_labels entries must be strings");
		}
	}
	if (typeof record.exposure_readiness_authorized !== "boolean") errors.push("exposure_readiness_authorized must be a boolean");
	if (record.authorization_scope !== "managed_dispatch_exposure_readiness_only") errors.push("authorization_scope must be managed_dispatch_exposure_readiness_only");
	if (record.required_s6_workflow_id !== FLOWDESK_S7_REQUIRED_S6_TUPLE.workflow_id) errors.push("required_s6_workflow_id mismatch");
	if (record.required_s6_lane_id !== FLOWDESK_S7_REQUIRED_S6_TUPLE.lane_id) errors.push("required_s6_lane_id mismatch");
	if (record.required_s6_task_id !== FLOWDESK_S7_REQUIRED_S6_TUPLE.task_id) errors.push("required_s6_task_id mismatch");
	if (record.required_s6_result_evidence_id !== FLOWDESK_S7_REQUIRED_S6_TUPLE.result_evidence_id) errors.push("required_s6_result_evidence_id mismatch");
	if (record.required_s6_sentinel !== FLOWDESK_S7_REQUIRED_S6_TUPLE.sentinel) errors.push("required_s6_sentinel mismatch");
	if (record.progress_snapshot_workflow_id !== FLOWDESK_S7_REQUIRED_S6_TUPLE.progress_snapshot_workflow_id) errors.push("progress_snapshot_workflow_id mismatch");
	if (record.task_result_created_at !== undefined && timestampMs(record.task_result_created_at) === undefined) errors.push("task_result_created_at must be a parseable timestamp");
	if (timestampMs(record.created_at) === undefined) errors.push("created_at must be a parseable timestamp");
	if (timestampMs(record.expires_at) === undefined) errors.push("expires_at must be a parseable timestamp");
	if (record.redaction_version !== "v1") errors.push("redaction_version must be v1");
	for (const flag of FLOWDESK_S7_EXPOSURE_AUTHORITY_FALSE_FLAGS) {
		if (record[flag] !== false) errors.push(`negative authority not explicit: ${flag}`);
	}
	if (record.ok === true && record.state !== "authorized") errors.push("ok=true requires state=authorized");
	if (record.ok === false && record.state !== "blocked") errors.push("ok=false requires state=blocked");
	if (record.exposure_readiness_authorized !== record.ok) errors.push("exposure_readiness_authorized must match ok");
	if (record.ok === true && Array.isArray(record.blocked_labels) && record.blocked_labels.length !== 0) errors.push("authorized record cannot contain blocked_labels");
	if (record.ok === false && Array.isArray(record.blocked_labels) && record.blocked_labels.length === 0) errors.push("blocked record must contain blocked_labels");
	if (errors.some((error) => error.startsWith("negative authority not explicit")) && Array.isArray(record.blocked_labels) && !record.blocked_labels.includes("negative_authority_not_explicit")) {
		errors.push("blocked_labels must include negative_authority_not_explicit");
	}
	errors.push(...validateNoForbiddenRawPayloads(record, "managed_dispatch_exposure_authorization").errors);
	return errors.length === 0 ? valid() : invalid(...errors);
}
