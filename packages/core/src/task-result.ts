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
	phase: "started" | "waiting" | "nudged" | "finalizing" | "failed";
	progress_label: string;
	progress_ref: string;
	redaction_version: "v1";
	dispatch_authority_enabled: false;
}

export const VALID_TASK_FAILURE_CATEGORIES = new Set([
	"sdk_create_failed",
	"sdk_prompt_timeout",
	"no_response",
	"response_too_large",
	"unknown",
]);

const TASK_RESULT_MAX_TEXT = 32_768;
const AGENT_TASK_PROGRESS_MAX_LABEL = 120;
const VALID_AGENT_TASK_PROGRESS_PHASES = new Set([
	"started",
	"waiting",
	"nudged",
	"finalizing",
	"failed",
]);

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
	errors.push(...timestamp(record.created_at, "created_at").errors);
	if (record.dispatch_authority_enabled !== false)
		errors.push("task result cannot enable dispatch authority");
	errors.push(...validateNoForbiddenRawPayloads(record, "task_result").errors);
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
