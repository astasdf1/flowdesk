import {
	invalid,
	type ValidationResult,
	valid,
	validateNoForbiddenRawPayloads,
	validateOpaqueId,
} from "./validators.js";

export interface FlowDeskTaskResultV1 {
	schema_version: "flowdesk.task_result.v1";
	workflow_id: string;
	lane_id: string;
	task_id: string;
	agent_ref: string;
	provider_qualified_model_id: string;
	task_prompt_sha256: string;
	result_text: string;
	result_text_truncated: boolean;
	result_text_sha256: string;
	completion_status?: "final" | "partial";
	output_kind?: "final_answer" | "partial_findings" | "process_notes" | "tool_trace_only" | "empty";
	usable_for_synthesis?: boolean;
	missing_contract?: boolean;
	created_at: string;
	dispatch_authority_enabled: false;
}

export interface FlowDeskTaskFailedV1 {
	schema_version: "flowdesk.task_failed.v1";
	workflow_id: string;
	lane_id: string;
	task_id: string;
	agent_ref: string;
	provider_qualified_model_id: string;
	failure_category:
		| "sdk_create_failed"
		| "sdk_prompt_timeout"
		| "network_interrupted"
		| "no_response"
		| "response_too_large"
		| "unknown";
	redacted_reason: string;
	created_at: string;
	dispatch_authority_enabled: false;
}

export interface FlowDeskAgentTaskProgressV1 {
	schema_version: "flowdesk.agent_task_progress.v1";
	workflow_id: string;
	lane_id: string;
	task_id: string;
	agent_ref: string;
	provider_qualified_model_id: string;
	progress_seq: number;
	observed_at: string;
	phase: "started" | "waiting" | "nudged" | "awaiting_permission" | "retrying" | "finalizing" | "failed";
	progress_label: string;
	progress_ref: string;
	redaction_version: "v1";
	dispatch_authority_enabled: false;
}

export interface FlowDeskAgentTaskInconsistencyV1 {
	schema_version: "flowdesk.agent_task_inconsistency.v1";
	workflow_id: string;
	attempt_id: string;
	lane_id: string;
	task_id: string;
	last_progress_seq: number;
	last_progress_observed_at: string;
	inconsistency_kind: "finalizing_without_terminal";
	grace_window_ms: number;
	grace_source_label: string;
	observed_at: string;
	safe_next_actions: readonly (
		| "/flowdesk-status"
		| "/flowdesk-abort"
		| "/flowdesk-retry"
		| "/flowdesk-doctor"
		| "/flowdesk-export-debug"
	)[];
	redaction_version: "v1";
	dispatch_authority_enabled: false;
}

export const VALID_TASK_FAILURE_CATEGORIES = new Set([
	"sdk_create_failed",
	"sdk_prompt_timeout",
	"network_interrupted",
	"no_response",
	"response_too_large",
	"unknown",
]);

const TASK_RESULT_MAX_TEXT = 32_768;
const AGENT_TASK_PROGRESS_MAX_LABEL = 120;
const AGENT_TASK_INCONSISTENCY_MAX_GRACE_LABEL = 120;
const VALID_AGENT_TASK_PROGRESS_PHASES = new Set([
	"started",
	"waiting",
	"nudged",
	"awaiting_permission",
	"retrying",
	"finalizing",
	"failed",
]);
const VALID_AGENT_TASK_INCONSISTENCY_KINDS = new Set([
	"finalizing_without_terminal",
]);
const VALID_AGENT_TASK_INCONSISTENCY_ACTIONS = new Set([
	"/flowdesk-status",
	"/flowdesk-abort",
	"/flowdesk-retry",
	"/flowdesk-doctor",
	"/flowdesk-export-debug",
]);
const VALID_TASK_RESULT_COMPLETION_STATUS = new Set(["final", "partial"]);
const VALID_TASK_RESULT_OUTPUT_KIND = new Set(["final_answer", "partial_findings", "process_notes", "tool_trace_only", "empty"]);

// ---------------------------------------------------------------------------
// Local helpers
// ---------------------------------------------------------------------------

function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === "object" && value !== null && !Array.isArray(value);
}

function timestamp(value: unknown, label: string): ValidationResult {
	return typeof value === "string" && Number.isFinite(Date.parse(value))
		? valid()
		: invalid(`${label} must be a parseable timestamp`);
}

function exactString(value: unknown, expected: string, label: string): ValidationResult {
	return value === expected ? valid() : invalid(`${label} must be ${expected}`);
}

function nonEmptyString(value: unknown, label: string): ValidationResult {
	return typeof value === "string" && value.trim().length > 0
		? valid()
		: invalid(`${label} must be a non-empty string`);
}

function idStartsWith(value: unknown, prefix: string, label: string): ValidationResult {
	if (typeof value !== "string" || value.trim().length === 0)
		return invalid(`${label} must be a non-empty string`);
	return value.startsWith(prefix)
		? valid()
		: invalid(`${label} must start with "${prefix}"`);
}

function boundedString(value: unknown, label: string, max: number): ValidationResult {
	if (typeof value !== "string" || value.trim().length === 0)
		return invalid(`${label} must be a non-empty string`);
	if (value.length > max) return invalid(`${label} exceeds ${max} chars`);
	return valid();
}

function safeNextActions(value: unknown): ValidationResult {
	if (!Array.isArray(value)) return invalid("safe_next_actions must be an array");
	if (value.length === 0 || value.length > 5)
		return invalid("safe_next_actions must contain 1-5 actions");
	const errors: string[] = [];
	for (const action of value) {
		if (
			typeof action !== "string" ||
			!VALID_AGENT_TASK_INCONSISTENCY_ACTIONS.has(action)
		)
			errors.push("safe_next_actions contains an invalid action");
	}
	return errors.length === 0 ? valid() : invalid(...errors);
}

// ---------------------------------------------------------------------------
// Validators
// ---------------------------------------------------------------------------

export function validateFlowDeskTaskResultV1(value: unknown): ValidationResult {
	if (!isRecord(value)) return invalid("task result must be an object");
	const record = value as Partial<FlowDeskTaskResultV1>;
	const errors: string[] = [];
	const allowed = new Set([
		"schema_version",
		"workflow_id",
		"lane_id",
		"task_id",
		"agent_ref",
		"provider_qualified_model_id",
		"task_prompt_sha256",
		"result_text",
		"result_text_truncated",
		"result_text_sha256",
		"completion_status",
		"output_kind",
		"usable_for_synthesis",
		"missing_contract",
		"created_at",
		"dispatch_authority_enabled",
	]);
	for (const key of Object.keys(record)) if (!allowed.has(key)) errors.push(`unknown property: ${key}`);
	errors.push(...exactString(record.schema_version, "flowdesk.task_result.v1", "schema_version").errors);
	errors.push(...validateOpaqueId(record.workflow_id, "workflow_id").errors);
	errors.push(...validateOpaqueId(record.lane_id, "lane_id").errors);
	errors.push(...idStartsWith(record.task_id, "task-", "task_id").errors);
	errors.push(...nonEmptyString(record.agent_ref, "agent_ref").errors);
	errors.push(...nonEmptyString(record.provider_qualified_model_id, "provider_qualified_model_id").errors);
	errors.push(...nonEmptyString(record.task_prompt_sha256, "task_prompt_sha256").errors);
	if (typeof record.result_text !== "string")
		errors.push("result_text must be a string");
	else if (record.result_text.length > TASK_RESULT_MAX_TEXT)
		errors.push(`result_text exceeds ${TASK_RESULT_MAX_TEXT} chars`);
	if (typeof record.result_text_truncated !== "boolean")
		errors.push("result_text_truncated must be a boolean");
	errors.push(...nonEmptyString(record.result_text_sha256, "result_text_sha256").errors);
	if (record.completion_status !== undefined && !VALID_TASK_RESULT_COMPLETION_STATUS.has(record.completion_status))
		errors.push("completion_status must be final or partial");
	if (record.output_kind !== undefined && !VALID_TASK_RESULT_OUTPUT_KIND.has(record.output_kind))
		errors.push("output_kind is invalid");
	if (record.usable_for_synthesis !== undefined && typeof record.usable_for_synthesis !== "boolean")
		errors.push("usable_for_synthesis must be a boolean");
	if (record.missing_contract !== undefined && typeof record.missing_contract !== "boolean")
		errors.push("missing_contract must be a boolean");
	errors.push(...timestamp(record.created_at, "created_at").errors);
	if (record.dispatch_authority_enabled !== false)
		errors.push("task result cannot enable dispatch authority");
	const { result_text: _resultText, ...metadataForRawPayloadValidation } = record as Record<string, unknown>;
	errors.push(...validateNoForbiddenRawPayloads(metadataForRawPayloadValidation, "task_result").errors);
	return errors.length === 0 ? valid() : invalid(...errors);
}

export function validateFlowDeskTaskFailedV1(value: unknown): ValidationResult {
	if (!isRecord(value)) return invalid("task failed record must be an object");
	const record = value as Partial<FlowDeskTaskFailedV1>;
	const errors: string[] = [];
	const allowed = new Set([
		"schema_version",
		"workflow_id",
		"lane_id",
		"task_id",
		"agent_ref",
		"provider_qualified_model_id",
		"failure_category",
		"redacted_reason",
		"created_at",
		"dispatch_authority_enabled",
	]);
	for (const key of Object.keys(record)) if (!allowed.has(key)) errors.push(`unknown property: ${key}`);
	errors.push(...exactString(record.schema_version, "flowdesk.task_failed.v1", "schema_version").errors);
	errors.push(...validateOpaqueId(record.workflow_id, "workflow_id").errors);
	errors.push(...validateOpaqueId(record.lane_id, "lane_id").errors);
	errors.push(...idStartsWith(record.task_id, "task-", "task_id").errors);
	errors.push(...nonEmptyString(record.agent_ref, "agent_ref").errors);
	errors.push(...nonEmptyString(record.provider_qualified_model_id, "provider_qualified_model_id").errors);
	if (!VALID_TASK_FAILURE_CATEGORIES.has(record.failure_category ?? ""))
		errors.push("failure_category is invalid");
	errors.push(...nonEmptyString(record.redacted_reason, "redacted_reason").errors);
	errors.push(...timestamp(record.created_at, "created_at").errors);
	if (record.dispatch_authority_enabled !== false)
		errors.push("task failed record cannot enable dispatch authority");
	errors.push(...validateNoForbiddenRawPayloads(record, "task_failed").errors);
	return errors.length === 0 ? valid() : invalid(...errors);
}

export function validateFlowDeskAgentTaskProgressV1(value: unknown): ValidationResult {
	if (!isRecord(value)) return invalid("agent task progress must be an object");
	const record = value as Partial<FlowDeskAgentTaskProgressV1>;
	const errors: string[] = [];
	const allowed = new Set([
		"schema_version",
		"workflow_id",
		"lane_id",
		"task_id",
		"agent_ref",
		"provider_qualified_model_id",
		"progress_seq",
		"observed_at",
		"phase",
		"progress_label",
		"progress_ref",
		"redaction_version",
		"dispatch_authority_enabled",
	]);
	for (const key of Object.keys(record)) if (!allowed.has(key)) errors.push(`unknown property: ${key}`);
	errors.push(...exactString(record.schema_version, "flowdesk.agent_task_progress.v1", "schema_version").errors);
	errors.push(...validateOpaqueId(record.workflow_id, "workflow_id").errors);
	errors.push(...validateOpaqueId(record.lane_id, "lane_id").errors);
	errors.push(...idStartsWith(record.task_id, "task-", "task_id").errors);
	errors.push(...nonEmptyString(record.agent_ref, "agent_ref").errors);
	errors.push(...nonEmptyString(record.provider_qualified_model_id, "provider_qualified_model_id").errors);
	if (typeof record.progress_seq !== "number" || !Number.isInteger(record.progress_seq) || record.progress_seq < 1)
		errors.push("progress_seq must be a positive integer");
	errors.push(...timestamp(record.observed_at, "observed_at").errors);
	if (!VALID_AGENT_TASK_PROGRESS_PHASES.has(record.phase ?? "")) errors.push("phase is invalid");
	if (typeof record.progress_label !== "string" || record.progress_label.trim().length === 0)
		errors.push("progress_label must be a non-empty string");
	else if (record.progress_label.length > AGENT_TASK_PROGRESS_MAX_LABEL)
		errors.push(`progress_label exceeds ${AGENT_TASK_PROGRESS_MAX_LABEL} chars`);
	errors.push(...idStartsWith(record.progress_ref, "progress-", "progress_ref").errors);
	errors.push(...exactString(record.redaction_version, "v1", "redaction_version").errors);
	if (record.dispatch_authority_enabled !== false)
		errors.push("agent task progress cannot enable dispatch authority");
	errors.push(...validateNoForbiddenRawPayloads(record, "agent_task_progress").errors);
	return errors.length === 0 ? valid() : invalid(...errors);
}

export function validateFlowDeskAgentTaskInconsistencyV1(value: unknown): ValidationResult {
	if (!isRecord(value)) return invalid("agent task inconsistency must be an object");
	const record = value as Partial<FlowDeskAgentTaskInconsistencyV1>;
	const errors: string[] = [];
	const allowed = new Set([
		"schema_version",
		"workflow_id",
		"attempt_id",
		"lane_id",
		"task_id",
		"last_progress_seq",
		"last_progress_observed_at",
		"inconsistency_kind",
		"grace_window_ms",
		"grace_source_label",
		"observed_at",
		"safe_next_actions",
		"redaction_version",
		"dispatch_authority_enabled",
	]);
	for (const key of Object.keys(record)) if (!allowed.has(key)) errors.push(`unknown property: ${key}`);
	errors.push(...exactString(record.schema_version, "flowdesk.agent_task_inconsistency.v1", "schema_version").errors);
	errors.push(...validateOpaqueId(record.workflow_id, "workflow_id").errors);
	errors.push(...validateOpaqueId(record.attempt_id, "attempt_id").errors);
	errors.push(...validateOpaqueId(record.lane_id, "lane_id").errors);
	errors.push(...idStartsWith(record.task_id, "task-", "task_id").errors);
	if (typeof record.last_progress_seq !== "number" || !Number.isInteger(record.last_progress_seq) || record.last_progress_seq < 1)
		errors.push("last_progress_seq must be a positive integer");
	errors.push(...timestamp(record.last_progress_observed_at, "last_progress_observed_at").errors);
	if (!VALID_AGENT_TASK_INCONSISTENCY_KINDS.has(record.inconsistency_kind ?? ""))
		errors.push("inconsistency_kind is invalid");
	if (typeof record.grace_window_ms !== "number" || !Number.isInteger(record.grace_window_ms) || record.grace_window_ms < 30_000 || record.grace_window_ms > 600_000)
		errors.push("grace_window_ms must be an integer between 30000 and 600000");
	errors.push(...boundedString(record.grace_source_label, "grace_source_label", AGENT_TASK_INCONSISTENCY_MAX_GRACE_LABEL).errors);
	errors.push(...timestamp(record.observed_at, "observed_at").errors);
	errors.push(...safeNextActions(record.safe_next_actions).errors);
	errors.push(...exactString(record.redaction_version, "v1", "redaction_version").errors);
	if (record.dispatch_authority_enabled !== false)
		errors.push("agent task inconsistency cannot enable dispatch authority");
	errors.push(...validateNoForbiddenRawPayloads(record, "agent_task_inconsistency").errors);
	return errors.length === 0 ? valid() : invalid(...errors);
}
