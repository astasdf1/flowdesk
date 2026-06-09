import type { FlowDeskTopTierReviewPerspective } from "./release1-contracts.js";
import {
	invalid,
	type ValidationResult,
	valid,
	validateNoForbiddenRawPayloads,
	validateOpaqueId,
} from "./validators.js";

export type { FlowDeskTopTierReviewPerspective };

export type DisabledAutoRetryReason =
	| "opt_in_false"
	| "guard_unverified"
	| "context_missing"
	| "context_redaction_invalid"
	| "cap_reached"
	| "sdk_unavailable"
	| "invariant_violated"
	| "concurrent_retry_in_progress"
	| "lane_not_terminal_aborted";

export interface FlowDeskReviewerLaneContextV1 {
	schema_version: "flowdesk.reviewer_lane_context.v1";
	workflow_id: string;
	lane_id: string;
	lane_plan_ref: string;
	perspective: FlowDeskTopTierReviewPerspective;
	agent_ref: string;
	provider_qualified_model_id: string;
	parent_session_ref: string;
	original_attempt_id: string;
	prompt_text: string;
	prompt_text_truncated: boolean;
	prompt_text_sha256: string;
	redaction_version: string;
	created_at: string;
	dispatch_authority_enabled: false;
}

export interface FlowDeskAgentTaskContextV1 {
	schema_version: "flowdesk.agent_task_context.v1";
	workflow_id: string;
	lane_id: string;
	task_id: string;
	agent_ref: string;
	provider_qualified_model_id: string;
	parent_session_ref: string;
	/** Model of parent/main session at task launch time, used by wake consumer to match model. */
	recorded_parent_provider_qualified_model_id?: string;
	/** @deprecated Use recorded_parent_provider_qualified_model_id. */
	parent_wake_provider_qualified_model_id?: string;
	prompt_text: string;
	prompt_text_truncated: boolean;
	prompt_text_sha256: string;
	redaction_version: string;
	created_at: string;
	dispatch_authority_enabled: false;
}

export interface FlowDeskPendingRetryPlanV1 {
	schema_version: "flowdesk.pending_retry_plan.v1";
	workflow_id: string;
	original_lane_id: string;
	new_lane_id: string;
	retry_attempt: number;
	context_evidence_id: string;
	abort_evidence_id: string;
	status: "pending" | "launched" | "failed" | "cancelled" | "superseded" | "expired";
	created_at: string;
	expires_at: string;
	dispatch_authority_enabled: false;
}

export interface FlowDeskRetryExecutedV1 {
	schema_version: "flowdesk.retry_executed.v1";
	workflow_id: string;
	original_lane_id: string;
	new_lane_id: string;
	retry_attempt: number;
	retry_kind?: "reviewer_lane" | "agent_task";
	perspective?: FlowDeskTopTierReviewPerspective;
	task_id?: string;
	provider_qualified_model_id: string;
	new_parent_session_ref: string;
	original_attempt_id?: string;
	created_at: string;
	dispatch_authority_enabled: false;
}

export interface FlowDeskRetryFailedV1 {
	schema_version: "flowdesk.retry_failed.v1";
	workflow_id: string;
	original_lane_id: string;
	new_lane_id?: string;
	retry_attempt: number;
	failure_category:
		| DisabledAutoRetryReason
		| "sdk_create_failed"
		| "sdk_prompt_rejected"
		| "indeterminate_launch";
	redacted_reason: string;
	created_at: string;
	dispatch_authority_enabled: false;
}

export type FlowDeskAutoRetryResultV1 =
	| { status: "auto_retry_not_configured"; reason: "opt_in_false" }
	| { status: "auto_retry_disabled"; reason: DisabledAutoRetryReason; retriesUsed?: number }
	| { status: "retry_launched"; newLaneId: string; pendingRetryEvidenceId: string }
	| { status: "retry_failed"; failureCategory: string; redactedReason: string };

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

function optionalProviderQualifiedModelId(value: unknown, label: string): ValidationResult {
	if (value === undefined) return valid();
	if (typeof value !== "string") return invalid(`${label} must be a provider-qualified model id string`);
	const trimmed = value.trim();
	if (trimmed.length === 0 || trimmed.length > 128) return invalid(`${label} must be a bounded provider-qualified model id string`);
	if (!/^[^\s/]+\/[^\s/]+$/.test(trimmed)) return invalid(`${label} must use provider/model format`);
	return valid();
}

// ---------------------------------------------------------------------------
// Validators
// ---------------------------------------------------------------------------

const VALID_PERSPECTIVES = new Set([
	"policy_security",
	"architecture",
	"verification_implementation",
]);

const VALID_PENDING_RETRY_PLAN_STATUSES = new Set([
	"pending",
	"launched",
	"failed",
	"cancelled",
	"superseded",
	"expired",
]);

const VALID_RETRY_FAILED_CATEGORIES = new Set<string>([
	"opt_in_false",
	"guard_unverified",
	"context_missing",
	"context_redaction_invalid",
	"cap_reached",
	"sdk_unavailable",
	"invariant_violated",
	"concurrent_retry_in_progress",
	"lane_not_terminal_aborted",
	"sdk_create_failed",
	"sdk_prompt_rejected",
	"indeterminate_launch",
]);

export function validateFlowDeskReviewerLaneContextV1(value: unknown): ValidationResult {
	if (!isRecord(value)) return invalid("reviewer lane context must be an object");
	const record = value as Partial<FlowDeskReviewerLaneContextV1>;
	const errors: string[] = [];
	const allowed = new Set([
		"schema_version",
		"workflow_id",
		"lane_id",
		"lane_plan_ref",
		"perspective",
		"agent_ref",
		"provider_qualified_model_id",
		"parent_session_ref",
		"original_attempt_id",
		"prompt_text",
		"prompt_text_truncated",
		"prompt_text_sha256",
		"redaction_version",
		"created_at",
		"dispatch_authority_enabled",
	]);
	for (const key of Object.keys(record)) if (!allowed.has(key)) errors.push(`unknown property: ${key}`);
	errors.push(...exactString(record.schema_version, "flowdesk.reviewer_lane_context.v1", "schema_version").errors);
	errors.push(...validateOpaqueId(record.workflow_id, "workflow_id").errors);
	errors.push(...validateOpaqueId(record.lane_id, "lane_id").errors);
	errors.push(...nonEmptyString(record.lane_plan_ref, "lane_plan_ref").errors);
	if (!VALID_PERSPECTIVES.has(record.perspective ?? ""))
		errors.push("perspective must be a valid FlowDeskTopTierReviewPerspective");
	errors.push(...nonEmptyString(record.agent_ref, "agent_ref").errors);
	errors.push(...nonEmptyString(record.provider_qualified_model_id, "provider_qualified_model_id").errors);
	errors.push(...nonEmptyString(record.parent_session_ref, "parent_session_ref").errors);
	errors.push(...nonEmptyString(record.original_attempt_id, "original_attempt_id").errors);
	if (typeof record.prompt_text !== "string")
		errors.push("prompt_text must be a string");
	if (typeof record.prompt_text_truncated !== "boolean")
		errors.push("prompt_text_truncated must be a boolean");
	errors.push(...nonEmptyString(record.prompt_text_sha256, "prompt_text_sha256").errors);
	errors.push(...nonEmptyString(record.redaction_version, "redaction_version").errors);
	errors.push(...timestamp(record.created_at, "created_at").errors);
	if (record.dispatch_authority_enabled !== false)
		errors.push("reviewer lane context cannot enable dispatch authority");
	errors.push(...validateNoForbiddenRawPayloads(record, "reviewer_lane_context").errors);
	return errors.length === 0 ? valid() : invalid(...errors);
}

export function validateFlowDeskAgentTaskContextV1(value: unknown): ValidationResult {
	if (!isRecord(value)) return invalid("agent task context must be an object");
	const record = value as Partial<FlowDeskAgentTaskContextV1>;
	const errors: string[] = [];
	const allowed = new Set([
		"schema_version",
		"workflow_id",
		"lane_id",
		"task_id",
		"agent_ref",
		"provider_qualified_model_id",
		"parent_session_ref",
		"recorded_parent_provider_qualified_model_id",
		"parent_wake_provider_qualified_model_id",
		"prompt_text",
		"prompt_text_truncated",
		"prompt_text_sha256",
		"redaction_version",
		"created_at",
		"dispatch_authority_enabled",
	]);
	for (const key of Object.keys(record)) if (!allowed.has(key)) errors.push(`unknown property: ${key}`);
	errors.push(...exactString(record.schema_version, "flowdesk.agent_task_context.v1", "schema_version").errors);
	errors.push(...validateOpaqueId(record.workflow_id, "workflow_id").errors);
	errors.push(...validateOpaqueId(record.lane_id, "lane_id").errors);
	errors.push(...nonEmptyString(record.task_id, "task_id").errors);
	errors.push(...nonEmptyString(record.agent_ref, "agent_ref").errors);
	errors.push(...nonEmptyString(record.provider_qualified_model_id, "provider_qualified_model_id").errors);
	errors.push(...nonEmptyString(record.parent_session_ref, "parent_session_ref").errors);
	errors.push(...optionalProviderQualifiedModelId(record.recorded_parent_provider_qualified_model_id, "recorded_parent_provider_qualified_model_id").errors);
	errors.push(...optionalProviderQualifiedModelId(record.parent_wake_provider_qualified_model_id, "parent_wake_provider_qualified_model_id").errors);
	if (typeof record.prompt_text !== "string")
		errors.push("prompt_text must be a string");
	else if (record.prompt_text.length > 32_768)
		errors.push("prompt_text exceeds 32768 chars");
	if (typeof record.prompt_text_truncated !== "boolean")
		errors.push("prompt_text_truncated must be a boolean");
	errors.push(...nonEmptyString(record.prompt_text_sha256, "prompt_text_sha256").errors);
	errors.push(...nonEmptyString(record.redaction_version, "redaction_version").errors);
	errors.push(...timestamp(record.created_at, "created_at").errors);
	if (record.dispatch_authority_enabled !== false)
		errors.push("agent task context cannot enable dispatch authority");
	// prompt_text is user-authored task description and legitimately contains file
	// paths like "packages/opencode-plugin/src/server.ts". Validate the rest of the
	// record for forbidden raw payloads but exempt prompt_text so agent_task_context
	// evidence is not silently rejected and the sidebar can derive a task summary.
	const { prompt_text: _promptText, prompt_text_sha256: _promptSha, ...metadataForRawPayloadValidation } = record as Record<string, unknown>;
	errors.push(...validateNoForbiddenRawPayloads(metadataForRawPayloadValidation, "agent_task_context").errors);
	return errors.length === 0 ? valid() : invalid(...errors);
}

export function validateFlowDeskPendingRetryPlanV1(value: unknown): ValidationResult {
	if (!isRecord(value)) return invalid("pending retry plan must be an object");
	const record = value as Partial<FlowDeskPendingRetryPlanV1>;
	const errors: string[] = [];
	const allowed = new Set([
		"schema_version",
		"workflow_id",
		"original_lane_id",
		"new_lane_id",
		"retry_attempt",
		"context_evidence_id",
		"abort_evidence_id",
		"status",
		"created_at",
		"expires_at",
		"dispatch_authority_enabled",
	]);
	for (const key of Object.keys(record)) if (!allowed.has(key)) errors.push(`unknown property: ${key}`);
	errors.push(...exactString(record.schema_version, "flowdesk.pending_retry_plan.v1", "schema_version").errors);
	errors.push(...validateOpaqueId(record.workflow_id, "workflow_id").errors);
	errors.push(...validateOpaqueId(record.original_lane_id, "original_lane_id").errors);
	errors.push(...validateOpaqueId(record.new_lane_id, "new_lane_id").errors);
	if (typeof record.retry_attempt !== "number" || !Number.isInteger(record.retry_attempt) || record.retry_attempt < 1)
		errors.push("retry_attempt must be an integer >= 1");
	errors.push(...nonEmptyString(record.context_evidence_id, "context_evidence_id").errors);
	errors.push(...nonEmptyString(record.abort_evidence_id, "abort_evidence_id").errors);
	if (!VALID_PENDING_RETRY_PLAN_STATUSES.has(record.status ?? ""))
		errors.push("pending retry plan status is invalid");
	errors.push(...timestamp(record.created_at, "created_at").errors);
	errors.push(...timestamp(record.expires_at, "expires_at").errors);
	if (record.dispatch_authority_enabled !== false)
		errors.push("pending retry plan cannot enable dispatch authority");
	errors.push(...validateNoForbiddenRawPayloads(record, "pending_retry_plan").errors);
	return errors.length === 0 ? valid() : invalid(...errors);
}

export function validateFlowDeskRetryExecutedV1(value: unknown): ValidationResult {
	if (!isRecord(value)) return invalid("retry executed record must be an object");
	const record = value as Partial<FlowDeskRetryExecutedV1>;
	const errors: string[] = [];
	const allowed = new Set([
		"schema_version",
		"workflow_id",
		"original_lane_id",
		"new_lane_id",
		"retry_attempt",
		"retry_kind",
		"perspective",
		"task_id",
		"provider_qualified_model_id",
		"new_parent_session_ref",
		"original_attempt_id",
		"created_at",
		"dispatch_authority_enabled",
	]);
	for (const key of Object.keys(record)) if (!allowed.has(key)) errors.push(`unknown property: ${key}`);
	errors.push(...exactString(record.schema_version, "flowdesk.retry_executed.v1", "schema_version").errors);
	errors.push(...validateOpaqueId(record.workflow_id, "workflow_id").errors);
	errors.push(...validateOpaqueId(record.original_lane_id, "original_lane_id").errors);
	errors.push(...validateOpaqueId(record.new_lane_id, "new_lane_id").errors);
	if (typeof record.retry_attempt !== "number" || !Number.isInteger(record.retry_attempt) || record.retry_attempt < 1)
		errors.push("retry_attempt must be an integer >= 1");
	if (record.retry_kind !== undefined && record.retry_kind !== "reviewer_lane" && record.retry_kind !== "agent_task")
		errors.push("retry_kind must be reviewer_lane or agent_task");
	if (record.retry_kind === "agent_task") {
		errors.push(...nonEmptyString(record.task_id, "task_id").errors);
		if (record.perspective !== undefined)
			errors.push("agent_task retry_executed must not include perspective");
	} else if (!VALID_PERSPECTIVES.has(record.perspective ?? "")) {
		errors.push("perspective must be a valid FlowDeskTopTierReviewPerspective");
	}
	errors.push(...nonEmptyString(record.provider_qualified_model_id, "provider_qualified_model_id").errors);
	errors.push(...nonEmptyString(record.new_parent_session_ref, "new_parent_session_ref").errors);
	if (record.retry_kind !== "agent_task")
		errors.push(...nonEmptyString(record.original_attempt_id, "original_attempt_id").errors);
	errors.push(...timestamp(record.created_at, "created_at").errors);
	if (record.dispatch_authority_enabled !== false)
		errors.push("retry executed record cannot enable dispatch authority");
	errors.push(...validateNoForbiddenRawPayloads(record, "retry_executed").errors);
	return errors.length === 0 ? valid() : invalid(...errors);
}

export function validateFlowDeskRetryFailedV1(value: unknown): ValidationResult {
	if (!isRecord(value)) return invalid("retry failed record must be an object");
	const record = value as Partial<FlowDeskRetryFailedV1>;
	const errors: string[] = [];
	const allowed = new Set([
		"schema_version",
		"workflow_id",
		"original_lane_id",
		"new_lane_id",
		"retry_attempt",
		"failure_category",
		"redacted_reason",
		"created_at",
		"dispatch_authority_enabled",
	]);
	for (const key of Object.keys(record)) if (!allowed.has(key)) errors.push(`unknown property: ${key}`);
	errors.push(...exactString(record.schema_version, "flowdesk.retry_failed.v1", "schema_version").errors);
	errors.push(...validateOpaqueId(record.workflow_id, "workflow_id").errors);
	errors.push(...validateOpaqueId(record.original_lane_id, "original_lane_id").errors);
	// new_lane_id is optional (may be absent if SDK call failed before create)
	if (record.new_lane_id !== undefined) {
		errors.push(...validateOpaqueId(record.new_lane_id, "new_lane_id").errors);
	}
	if (typeof record.retry_attempt !== "number" || !Number.isInteger(record.retry_attempt) || record.retry_attempt < 1)
		errors.push("retry_attempt must be an integer >= 1");
	if (!VALID_RETRY_FAILED_CATEGORIES.has(record.failure_category ?? ""))
		errors.push("failure_category is invalid");
	errors.push(...nonEmptyString(record.redacted_reason, "redacted_reason").errors);
	errors.push(...timestamp(record.created_at, "created_at").errors);
	if (record.dispatch_authority_enabled !== false)
		errors.push("retry failed record cannot enable dispatch authority");
	errors.push(...validateNoForbiddenRawPayloads(record, "retry_failed").errors);
	return errors.length === 0 ? valid() : invalid(...errors);
}
