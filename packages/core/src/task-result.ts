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
	/**
	 * ADVISORY ONLY. How the capture layer decided this text was the result.
	 * Never a success/failure gate — the coordinator judges substance.
	 */
	finalization_reason?: "terminal_marker" | "finish_reason" | "stable_idle" | "timeout_partial" | "nudge_exhausted_partial";
	/**
	 * ADVISORY ONLY. The captured text superficially looks like a refusal or an
	 * error message. The coordinator must consult this when judging substance,
	 * but capture never drops the result because of it.
	 */
	looks_like_refusal_or_error?: boolean;
	/** Additive capture-safety metadata. Advisory only; conservative synthesis gate. */
	capture_status?: "captured" | "uncertain" | "no_output";
	capture_confidence?: "high" | "medium" | "low" | "none";
	observed_text_kind?: "final_answer" | "partial_findings" | "process_notes" | "tool_trace_only" | "empty";
	final_body_observed?: boolean;
	terminal_marker_observed?: boolean;
	requires_coordinator_review?: boolean;
	safe_for_auto_synthesis?: boolean;
	display_as_uncertain_result?: boolean;
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
		| "provider_dispatch_error"
		| "sdk_prompt_timeout"
		| "network_interrupted"
		| "no_response"
		| "tool_execution_aborted"
		| "response_too_large"
		| "unknown";
	redacted_reason: string;
	redacted_error_details?: string;
	/** Additive capture-safety metadata for capture-path failures. Advisory only. */
	capture_status?: "captured" | "uncertain" | "no_output";
	capture_confidence?: "high" | "medium" | "low" | "none";
	observed_text_kind?: "final_answer" | "partial_findings" | "process_notes" | "tool_trace_only" | "empty";
	final_body_observed?: boolean;
	terminal_marker_observed?: boolean;
	requires_coordinator_review?: boolean;
	safe_for_auto_synthesis?: boolean;
	display_as_uncertain_result?: boolean;
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
	inconsistency_kind: "finalizing_without_terminal" | "tool_run_overdue_observed";
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

/**
 * The coordinator's substance judgement of a captured lane result, plus its
 * bounded decision to accept / re-select+retry / abandon. This is the
 * "judgement layer" record in the capture/judgement split: capture lanes only
 * surface text + advisory metadata, and the main coordinator records here why a
 * result was judged success/failure and whether it re-selected a different model.
 *
 * This is NOT managed fallback/reselection authority: it is usage-aware
 * pre-launch routing that mints a NEW attempt and launches a fresh lane. All
 * dispatch/fallback authority flags stay false; retries are capped.
 */
export interface FlowDeskCoordinatorRetryDecisionV1 {
	schema_version: "flowdesk.coordinator_retry_decision.v1";
	workflow_id: string;
	judged_lane_id: string;
	judged_task_id: string;
	judged_attempt_id: string;
	judged_outcome: "success" | "failure" | "partial";
	/** Bounded redacted reason label, e.g. "refusal_text", "off_topic", "empty_capture". */
	judged_reason_label: string;
	/** Advisory inputs the judgement was based on (copied from task_result). */
	observed_output_kind?: string;
	observed_completion_status?: string;
	observed_finalization_reason?: string;
	observed_looks_like_refusal_or_error?: boolean;
	decision: "accept" | "retry_reselect" | "abandon";
	/** 1-based count of this decision among retries for the judged task. */
	retry_seq: number;
	/** Policy cap on coordinator-driven retries (<= 2). */
	max_retries: number;
	/** Present only when decision = retry_reselect. */
	reselected_provider_qualified_model_id?: string;
	reselected_agent_ref?: string;
	/** Fresh attempt id minted for the retry lane (present when retry_reselect). */
	new_attempt_id?: string;
	/** Fixed label affirming this is pre-launch routing, not managed fallback. */
	reselection_basis: "usage_aware_routing";
	observed_at: string;
	redaction_version: "v1";
	dispatch_authority_enabled: false;
	/** Explicitly NOT managed fallback/reselection authority. */
	fallback_authority: false;
}

export const VALID_TASK_FAILURE_CATEGORIES = new Set([
	"sdk_create_failed",
	"provider_dispatch_error",
	"sdk_prompt_timeout",
	"network_interrupted",
	"no_response",
	"tool_execution_aborted",
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
	"tool_run_overdue_observed",
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
const VALID_TASK_CAPTURE_STATUS = new Set(["captured", "uncertain", "no_output"]);
const VALID_TASK_CAPTURE_CONFIDENCE = new Set(["high", "medium", "low", "none"]);
const VALID_TASK_RESULT_FINALIZATION_REASON = new Set([
	"terminal_marker",
	"finish_reason",
	"stable_idle",
	"timeout_partial",
	"nudge_exhausted_partial",
]);
const VALID_COORDINATOR_JUDGED_OUTCOME = new Set(["success", "failure", "partial"]);
const VALID_COORDINATOR_DECISION = new Set(["accept", "retry_reselect", "abandon"]);
const COORDINATOR_RETRY_HARD_CAP = 2;
const COORDINATOR_REASON_MAX_LABEL = 120;

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
		"finalization_reason",
		"looks_like_refusal_or_error",
		"capture_status",
		"capture_confidence",
		"observed_text_kind",
		"final_body_observed",
		"terminal_marker_observed",
		"requires_coordinator_review",
		"safe_for_auto_synthesis",
		"display_as_uncertain_result",
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
	if (record.finalization_reason !== undefined && !VALID_TASK_RESULT_FINALIZATION_REASON.has(record.finalization_reason))
		errors.push("finalization_reason is invalid");
	if (record.looks_like_refusal_or_error !== undefined && typeof record.looks_like_refusal_or_error !== "boolean")
		errors.push("looks_like_refusal_or_error must be a boolean");
	if (record.capture_status !== undefined && !VALID_TASK_CAPTURE_STATUS.has(record.capture_status))
		errors.push("capture_status is invalid");
	if (record.capture_confidence !== undefined && !VALID_TASK_CAPTURE_CONFIDENCE.has(record.capture_confidence))
		errors.push("capture_confidence is invalid");
	if (record.observed_text_kind !== undefined && !VALID_TASK_RESULT_OUTPUT_KIND.has(record.observed_text_kind))
		errors.push("observed_text_kind is invalid");
	for (const [key, value] of Object.entries({
		final_body_observed: record.final_body_observed,
		terminal_marker_observed: record.terminal_marker_observed,
		requires_coordinator_review: record.requires_coordinator_review,
		safe_for_auto_synthesis: record.safe_for_auto_synthesis,
		display_as_uncertain_result: record.display_as_uncertain_result,
	})) {
		if (value !== undefined && typeof value !== "boolean") errors.push(`${key} must be a boolean`);
	}
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
		"redacted_error_details",
		"capture_status",
		"capture_confidence",
		"observed_text_kind",
		"final_body_observed",
		"terminal_marker_observed",
		"requires_coordinator_review",
		"safe_for_auto_synthesis",
		"display_as_uncertain_result",
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
	if (record.redacted_error_details !== undefined)
		errors.push(...nonEmptyString(record.redacted_error_details, "redacted_error_details").errors);
	if (record.capture_status !== undefined && !VALID_TASK_CAPTURE_STATUS.has(record.capture_status))
		errors.push("capture_status is invalid");
	if (record.capture_confidence !== undefined && !VALID_TASK_CAPTURE_CONFIDENCE.has(record.capture_confidence))
		errors.push("capture_confidence is invalid");
	if (record.observed_text_kind !== undefined && !VALID_TASK_RESULT_OUTPUT_KIND.has(record.observed_text_kind))
		errors.push("observed_text_kind is invalid");
	for (const [key, value] of Object.entries({
		final_body_observed: record.final_body_observed,
		terminal_marker_observed: record.terminal_marker_observed,
		requires_coordinator_review: record.requires_coordinator_review,
		safe_for_auto_synthesis: record.safe_for_auto_synthesis,
		display_as_uncertain_result: record.display_as_uncertain_result,
	})) {
		if (value !== undefined && typeof value !== "boolean") errors.push(`${key} must be a boolean`);
	}
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

export function validateFlowDeskCoordinatorRetryDecisionV1(value: unknown): ValidationResult {
	if (!isRecord(value)) return invalid("coordinator retry decision must be an object");
	const record = value as Partial<FlowDeskCoordinatorRetryDecisionV1>;
	const errors: string[] = [];
	const allowed = new Set([
		"schema_version",
		"workflow_id",
		"judged_lane_id",
		"judged_task_id",
		"judged_attempt_id",
		"judged_outcome",
		"judged_reason_label",
		"observed_output_kind",
		"observed_completion_status",
		"observed_finalization_reason",
		"observed_looks_like_refusal_or_error",
		"decision",
		"retry_seq",
		"max_retries",
		"reselected_provider_qualified_model_id",
		"reselected_agent_ref",
		"new_attempt_id",
		"reselection_basis",
		"observed_at",
		"redaction_version",
		"dispatch_authority_enabled",
		"fallback_authority",
	]);
	for (const key of Object.keys(record)) if (!allowed.has(key)) errors.push(`unknown property: ${key}`);
	errors.push(...exactString(record.schema_version, "flowdesk.coordinator_retry_decision.v1", "schema_version").errors);
	errors.push(...validateOpaqueId(record.workflow_id, "workflow_id").errors);
	errors.push(...validateOpaqueId(record.judged_lane_id, "judged_lane_id").errors);
	errors.push(...idStartsWith(record.judged_task_id, "task-", "judged_task_id").errors);
	errors.push(...validateOpaqueId(record.judged_attempt_id, "judged_attempt_id").errors);
	if (!VALID_COORDINATOR_JUDGED_OUTCOME.has(record.judged_outcome ?? ""))
		errors.push("judged_outcome is invalid");
	errors.push(...boundedString(record.judged_reason_label, "judged_reason_label", COORDINATOR_REASON_MAX_LABEL).errors);
	if (record.observed_output_kind !== undefined && typeof record.observed_output_kind !== "string")
		errors.push("observed_output_kind must be a string");
	if (record.observed_completion_status !== undefined && typeof record.observed_completion_status !== "string")
		errors.push("observed_completion_status must be a string");
	if (record.observed_finalization_reason !== undefined && typeof record.observed_finalization_reason !== "string")
		errors.push("observed_finalization_reason must be a string");
	if (record.observed_looks_like_refusal_or_error !== undefined && typeof record.observed_looks_like_refusal_or_error !== "boolean")
		errors.push("observed_looks_like_refusal_or_error must be a boolean");
	if (!VALID_COORDINATOR_DECISION.has(record.decision ?? ""))
		errors.push("decision is invalid");
	if (typeof record.max_retries !== "number" || !Number.isInteger(record.max_retries) || record.max_retries < 1 || record.max_retries > COORDINATOR_RETRY_HARD_CAP)
		errors.push(`max_retries must be an integer between 1 and ${COORDINATOR_RETRY_HARD_CAP}`);
	if (typeof record.retry_seq !== "number" || !Number.isInteger(record.retry_seq) || record.retry_seq < 1 || (typeof record.max_retries === "number" && record.retry_seq > record.max_retries))
		errors.push("retry_seq must be a positive integer within max_retries");
	if (record.decision === "retry_reselect") {
		errors.push(...nonEmptyString(record.reselected_provider_qualified_model_id, "reselected_provider_qualified_model_id").errors);
		errors.push(...nonEmptyString(record.reselected_agent_ref, "reselected_agent_ref").errors);
		errors.push(...validateOpaqueId(record.new_attempt_id, "new_attempt_id").errors);
	} else {
		if (record.reselected_provider_qualified_model_id !== undefined)
			errors.push("reselected_provider_qualified_model_id is only allowed when decision=retry_reselect");
		if (record.new_attempt_id !== undefined)
			errors.push("new_attempt_id is only allowed when decision=retry_reselect");
	}
	errors.push(...exactString(record.reselection_basis, "usage_aware_routing", "reselection_basis").errors);
	errors.push(...timestamp(record.observed_at, "observed_at").errors);
	errors.push(...exactString(record.redaction_version, "v1", "redaction_version").errors);
	if (record.dispatch_authority_enabled !== false)
		errors.push("coordinator retry decision cannot enable dispatch authority");
	if (record.fallback_authority !== false)
		errors.push("coordinator retry decision cannot claim managed fallback authority");
	errors.push(...validateNoForbiddenRawPayloads(record, "coordinator_retry_decision").errors);
	return errors.length === 0 ? valid() : invalid(...errors);
}

/**
 * Pure policy evaluator for the coordinator's judgement layer. Given a substance
 * judgement of a captured result plus how many retries already happened, it
 * returns a bounded, non-authorizing retry decision record. It never calls a
 * provider, launches a lane, or enables dispatch/fallback authority — the caller
 * persists this as audit evidence and (when decision=retry_reselect) launches a
 * fresh usage-aware lane under the new attempt id.
 */
export function evaluateFlowDeskCoordinatorRetryDecisionV1(input: {
	workflowId: string;
	judgedLaneId: string;
	judgedTaskId: string;
	judgedAttemptId: string;
	judgedOutcome: "success" | "failure" | "partial";
	judgedReasonLabel: string;
	observed?: {
		outputKind?: string;
		completionStatus?: string;
		finalizationReason?: string;
		looksLikeRefusalOrError?: boolean;
	};
	priorRetryCount: number;
	maxRetries?: number;
	reselection?: { providerQualifiedModelId: string; agentRef: string; newAttemptId: string };
	observedAt?: string;
}): FlowDeskCoordinatorRetryDecisionV1 {
	const maxRetries = Math.max(1, Math.min(COORDINATOR_RETRY_HARD_CAP, input.maxRetries ?? COORDINATOR_RETRY_HARD_CAP));
	const priorRetryCount = Math.max(0, Math.trunc(input.priorRetryCount));
	const canRetry =
		input.judgedOutcome !== "success" &&
		priorRetryCount < maxRetries &&
		input.reselection !== undefined &&
		input.reselection.providerQualifiedModelId.trim().length > 0 &&
		input.reselection.agentRef.trim().length > 0 &&
		input.reselection.newAttemptId.trim().length > 0;
	const decision: FlowDeskCoordinatorRetryDecisionV1["decision"] =
		input.judgedOutcome === "success" ? "accept" : canRetry ? "retry_reselect" : "abandon";
	const retrySeq = Math.min(maxRetries, priorRetryCount + 1);
	return {
		schema_version: "flowdesk.coordinator_retry_decision.v1",
		workflow_id: input.workflowId,
		judged_lane_id: input.judgedLaneId,
		judged_task_id: input.judgedTaskId,
		judged_attempt_id: input.judgedAttemptId,
		judged_outcome: input.judgedOutcome,
		judged_reason_label: input.judgedReasonLabel.replace(/\s+/g, " ").trim().slice(0, COORDINATOR_REASON_MAX_LABEL),
		...(input.observed?.outputKind === undefined ? {} : { observed_output_kind: input.observed.outputKind }),
		...(input.observed?.completionStatus === undefined ? {} : { observed_completion_status: input.observed.completionStatus }),
		...(input.observed?.finalizationReason === undefined ? {} : { observed_finalization_reason: input.observed.finalizationReason }),
		...(input.observed?.looksLikeRefusalOrError === undefined ? {} : { observed_looks_like_refusal_or_error: input.observed.looksLikeRefusalOrError }),
		decision,
		retry_seq: retrySeq,
		max_retries: maxRetries,
		...(decision === "retry_reselect" && input.reselection !== undefined
			? {
					reselected_provider_qualified_model_id: input.reselection.providerQualifiedModelId,
					reselected_agent_ref: input.reselection.agentRef,
					new_attempt_id: input.reselection.newAttemptId,
				}
			: {}),
		reselection_basis: "usage_aware_routing",
		observed_at: input.observedAt ?? new Date().toISOString(),
		redaction_version: "v1",
		dispatch_authority_enabled: false,
		fallback_authority: false,
	};
}
