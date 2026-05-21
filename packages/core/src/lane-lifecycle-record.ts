import {
	invalid,
	type ValidationResult,
	valid,
	validateConcreteProviderQualifiedModelId,
	validateNoForbiddenRawPayloads,
	validateOpaqueId,
	validateOpaqueRef,
} from "./validators.js";

export const FLOWDESK_LANE_LIFECYCLE_STATES = [
	"created",
	"running",
	"complete",
	"incomplete",
	"no_output",
	"missing_verdict",
	"aborted",
	"timeout",
	"late_output",
	"orphaned",
	"invocation_failed",
] as const;
export type FlowDeskLaneLifecycleStateV1 =
	(typeof FLOWDESK_LANE_LIFECYCLE_STATES)[number];

export interface FlowDeskLaneLifecycleRecordV1 {
	schema_version: "flowdesk.lane_lifecycle_record.v1";
	lane_id: string;
	workflow_id: string;
	attempt_id: string;
	parent_session_ref: string;
	child_session_ref?: string;
	message_ref?: string;
	background_task_ref?: string;
	continuation_session_ref?: string;
	agent_ref: string;
	provider_qualified_model_id: string;
	state: FlowDeskLaneLifecycleStateV1;
	verdict_ref?: string;
	output_ref?: string;
	runtime_echo_ref?: string;
	telemetry_ref?: string;
	timeout_ms: number;
	orphan_max_age_ms: number;
	retry_count: number;
	created_at: string;
	updated_at: string;
	dispatch_authority_enabled: false;
	providerCall: false;
	actualLaneLaunch: false;
	runtimeExecution: false;
}

function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === "object" && value !== null && !Array.isArray(value);
}

function timestamp(value: unknown, label: string): ValidationResult {
	return typeof value === "string" && Number.isFinite(Date.parse(value))
		? valid()
		: invalid(`${label} must be a parseable timestamp`);
}

function nonNegativeInt(value: unknown, label: string): ValidationResult {
	return typeof value === "number" && Number.isInteger(value) && value >= 0
		? valid()
		: invalid(`${label} must be a non-negative integer`);
}

export function validateFlowDeskLaneLifecycleRecordV1(
	value: unknown,
): ValidationResult {
	if (!isRecord(value)) return invalid("lane lifecycle record must be an object");
	const record = value as Partial<FlowDeskLaneLifecycleRecordV1>;
	const errors: string[] = [];
	const allowed = new Set([
		"schema_version",
		"lane_id",
		"workflow_id",
		"attempt_id",
		"parent_session_ref",
		"child_session_ref",
		"message_ref",
		"background_task_ref",
		"continuation_session_ref",
		"agent_ref",
		"provider_qualified_model_id",
		"state",
		"verdict_ref",
		"output_ref",
		"runtime_echo_ref",
		"telemetry_ref",
		"timeout_ms",
		"orphan_max_age_ms",
		"retry_count",
		"created_at",
		"updated_at",
		"dispatch_authority_enabled",
		"providerCall",
		"actualLaneLaunch",
		"runtimeExecution",
	]);
	for (const key of Object.keys(record))
		if (!allowed.has(key)) errors.push(`unknown properties: ${key}`);
	if (record.schema_version !== "flowdesk.lane_lifecycle_record.v1")
		errors.push("lane lifecycle schema_version is invalid");
	errors.push(...validateOpaqueId(record.lane_id, "lane_id").errors);
	errors.push(...validateOpaqueId(record.workflow_id, "workflow_id").errors);
	errors.push(...validateOpaqueId(record.attempt_id, "attempt_id").errors);
	errors.push(...validateOpaqueRef(record.parent_session_ref, "parent_session_ref").errors);
	for (const [value, label] of [
		[record.child_session_ref, "child_session_ref"],
		[record.message_ref, "message_ref"],
		[record.background_task_ref, "background_task_ref"],
		[record.continuation_session_ref, "continuation_session_ref"],
		[record.agent_ref, "agent_ref"],
		[record.verdict_ref, "verdict_ref"],
		[record.output_ref, "output_ref"],
		[record.runtime_echo_ref, "runtime_echo_ref"],
		[record.telemetry_ref, "telemetry_ref"],
	] as const)
		if (value !== undefined) errors.push(...validateOpaqueRef(value, label).errors);
	errors.push(
		...validateConcreteProviderQualifiedModelId(
			record.provider_qualified_model_id,
		).errors,
	);
	if (!(FLOWDESK_LANE_LIFECYCLE_STATES as readonly string[]).includes(record.state ?? ""))
		errors.push("lane lifecycle state is invalid");
	errors.push(...nonNegativeInt(record.timeout_ms, "timeout_ms").errors);
	errors.push(...nonNegativeInt(record.orphan_max_age_ms, "orphan_max_age_ms").errors);
	errors.push(...nonNegativeInt(record.retry_count, "retry_count").errors);
	errors.push(...timestamp(record.created_at, "created_at").errors);
	errors.push(...timestamp(record.updated_at, "updated_at").errors);
	if (record.retry_count !== undefined && record.retry_count > 2)
		errors.push("lane lifecycle retry_count exceeds bounded retry budget");
	if (record.state === "complete" && record.verdict_ref === undefined)
		errors.push("complete lane lifecycle records require verdict_ref");
	if (
		(record.state === "no_output" || record.state === "missing_verdict") &&
		record.verdict_ref !== undefined
	)
		errors.push("no-output or missing-verdict lanes cannot carry verdict_ref");
	if (
		record.background_task_ref !== undefined &&
		record.continuation_session_ref !== undefined &&
		record.background_task_ref === record.continuation_session_ref
	)
		errors.push("background and continuation refs must remain kind-separated");
	if (
		record.dispatch_authority_enabled !== false ||
		record.providerCall !== false ||
		record.actualLaneLaunch !== false ||
		record.runtimeExecution !== false
	)
		errors.push("lane lifecycle record cannot enable runtime authority");
	errors.push(...validateNoForbiddenRawPayloads(record, "lane_lifecycle_record").errors);
	return errors.length === 0 ? valid() : invalid(...errors);
}
