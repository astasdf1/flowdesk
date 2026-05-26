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

export const VALID_TASK_FAILURE_CATEGORIES = new Set([
	"sdk_create_failed",
	"sdk_prompt_timeout",
	"no_response",
	"response_too_large",
	"unknown",
]);

const TASK_RESULT_MAX_TEXT = 32_768;

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
