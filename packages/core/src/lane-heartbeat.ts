import {
	invalid,
	type ValidationResult,
	valid,
	validateConcreteProviderQualifiedModelId,
	validateNoForbiddenRawPayloads,
	validateOpaqueId,
	validateOpaqueRef,
} from "./validators.js";

export const FLOWDESK_LANE_HEARTBEAT_STATES = [
	"created",
	"running",
	"awaiting_dependency",
	"cooldown",
] as const;
export type FlowDeskLaneHeartbeatStateV1 =
	(typeof FLOWDESK_LANE_HEARTBEAT_STATES)[number];

export interface FlowDeskLaneHeartbeatRecordV1 {
	schema_version: "flowdesk.lane_heartbeat.v1";
	heartbeat_id: string;
	workflow_id: string;
	attempt_id: string;
	lane_id: string;
	heartbeat_seq: number;
	state: FlowDeskLaneHeartbeatStateV1;
	observed_at: string;
	expected_next_heartbeat_at: string;
	parent_session_ref: string;
	agent_ref: string;
	provider_qualified_model_id: string;
	progress_ref?: string;
	progress_summary_label?: string;
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

function refWithPrefix(
	value: unknown,
	label: string,
	prefixes: readonly string[],
): ValidationResult {
	const opaque = validateOpaqueRef(value, label);
	if (!opaque.ok) return opaque;
	const text = value as string;
	return prefixes.some((prefix) => text.startsWith(prefix))
		? valid()
		: invalid(`${label} must use ${prefixes.join("/")} kind prefix`);
}

function boundedString(
	value: unknown,
	label: string,
	maxLength: number,
): ValidationResult {
	if (value === undefined) return valid();
	if (typeof value !== "string") return invalid(`${label} must be a string`);
	if (value.length === 0 || value.length > maxLength)
		return invalid(`${label} must be a bounded non-empty string`);
	return valid();
}

export function validateFlowDeskLaneHeartbeatRecordV1(
	value: unknown,
): ValidationResult {
	if (!isRecord(value))
		return invalid("lane heartbeat record must be an object");
	const record = value as Partial<FlowDeskLaneHeartbeatRecordV1>;
	const errors: string[] = [];
	const allowed = new Set([
		"schema_version",
		"heartbeat_id",
		"workflow_id",
		"attempt_id",
		"lane_id",
		"heartbeat_seq",
		"state",
		"observed_at",
		"expected_next_heartbeat_at",
		"parent_session_ref",
		"agent_ref",
		"provider_qualified_model_id",
		"progress_ref",
		"progress_summary_label",
		"dispatch_authority_enabled",
		"providerCall",
		"actualLaneLaunch",
		"runtimeExecution",
	]);
	for (const key of Object.keys(record))
		if (!allowed.has(key)) errors.push(`unknown properties: ${key}`);
	if (record.schema_version !== "flowdesk.lane_heartbeat.v1")
		errors.push("lane heartbeat schema_version is invalid");
	errors.push(...validateOpaqueId(record.heartbeat_id, "heartbeat_id").errors);
	errors.push(...validateOpaqueId(record.workflow_id, "workflow_id").errors);
	errors.push(...validateOpaqueId(record.attempt_id, "attempt_id").errors);
	errors.push(...validateOpaqueId(record.lane_id, "lane_id").errors);
	errors.push(
		...refWithPrefix(record.parent_session_ref, "parent_session_ref", ["ses-"])
			.errors,
	);
	errors.push(
		...refWithPrefix(record.agent_ref, "agent_ref", ["agent-"]).errors,
	);
	if (record.progress_ref !== undefined)
		errors.push(
			...refWithPrefix(record.progress_ref, "progress_ref", [
				"progress-",
				"heartbeat-progress-",
			]).errors,
		);
	errors.push(
		...validateConcreteProviderQualifiedModelId(
			record.provider_qualified_model_id,
		).errors,
	);
	if (
		!(FLOWDESK_LANE_HEARTBEAT_STATES as readonly string[]).includes(
			record.state ?? "",
		)
	)
		errors.push("lane heartbeat state is invalid");
	errors.push(...nonNegativeInt(record.heartbeat_seq, "heartbeat_seq").errors);
	errors.push(...timestamp(record.observed_at, "observed_at").errors);
	errors.push(
		...timestamp(
			record.expected_next_heartbeat_at,
			"expected_next_heartbeat_at",
		).errors,
	);
	if (
		typeof record.observed_at === "string" &&
		typeof record.expected_next_heartbeat_at === "string"
	) {
		const observedMs = Date.parse(record.observed_at);
		const expectedMs = Date.parse(record.expected_next_heartbeat_at);
		if (Number.isFinite(observedMs) && Number.isFinite(expectedMs)) {
			if (expectedMs <= observedMs)
				errors.push(
					"expected_next_heartbeat_at must be strictly after observed_at",
				);
			else if (expectedMs - observedMs > 24 * 60 * 60 * 1000)
				errors.push(
					"expected_next_heartbeat_at must be within 24 hours of observed_at",
				);
		}
	}
	errors.push(
		...boundedString(
			record.progress_summary_label,
			"progress_summary_label",
			120,
		).errors,
	);
	if (
		record.dispatch_authority_enabled !== false ||
		record.providerCall !== false ||
		record.actualLaneLaunch !== false ||
		record.runtimeExecution !== false
	)
		errors.push("lane heartbeat record cannot enable runtime authority");
	errors.push(
		...validateNoForbiddenRawPayloads(record, "lane_heartbeat_record").errors,
	);
	return errors.length === 0 ? valid() : invalid(...errors);
}

export interface FlowDeskLaneHeartbeatInputV1 {
	workflowId: string;
	attemptId: string;
	laneId: string;
	heartbeatSeq: number;
	state: FlowDeskLaneHeartbeatStateV1;
	observedAt: string;
	parentSessionRef: string;
	agentRef: string;
	providerQualifiedModelId: string;
	progressRef?: string;
	progressSummaryLabel?: string;
	expectedIntervalMs?: number;
}

export const FLOWDESK_LANE_HEARTBEAT_DEFAULT_INTERVAL_MS = 2 * 60 * 1000;
export const FLOWDESK_LANE_HEARTBEAT_MIN_INTERVAL_MS = 10 * 1000;
export const FLOWDESK_LANE_HEARTBEAT_MAX_INTERVAL_MS = 24 * 60 * 60 * 1000;

export function buildFlowDeskLaneHeartbeatRecordV1(
	input: FlowDeskLaneHeartbeatInputV1,
): { ok: true; record: FlowDeskLaneHeartbeatRecordV1 } | { ok: false; errors: string[] } {
	const observedMs = Date.parse(input.observedAt);
	if (!Number.isFinite(observedMs))
		return { ok: false, errors: ["observedAt must be a parseable timestamp"] };
	const requestedInterval =
		typeof input.expectedIntervalMs === "number" && input.expectedIntervalMs > 0
			? input.expectedIntervalMs
			: FLOWDESK_LANE_HEARTBEAT_DEFAULT_INTERVAL_MS;
	const interval = Math.max(
		FLOWDESK_LANE_HEARTBEAT_MIN_INTERVAL_MS,
		Math.min(FLOWDESK_LANE_HEARTBEAT_MAX_INTERVAL_MS, requestedInterval),
	);
	const expectedNext = new Date(observedMs + interval).toISOString();
	const heartbeatId = `heartbeat-${input.laneId}-${input.heartbeatSeq
		.toString()
		.padStart(8, "0")}`;
	const record: FlowDeskLaneHeartbeatRecordV1 = {
		schema_version: "flowdesk.lane_heartbeat.v1",
		heartbeat_id: heartbeatId,
		workflow_id: input.workflowId,
		attempt_id: input.attemptId,
		lane_id: input.laneId,
		heartbeat_seq: input.heartbeatSeq,
		state: input.state,
		observed_at: new Date(observedMs).toISOString(),
		expected_next_heartbeat_at: expectedNext,
		parent_session_ref: input.parentSessionRef,
		agent_ref: input.agentRef,
		provider_qualified_model_id: input.providerQualifiedModelId,
		...(input.progressRef === undefined ? {} : { progress_ref: input.progressRef }),
		...(input.progressSummaryLabel === undefined
			? {}
			: { progress_summary_label: input.progressSummaryLabel }),
		dispatch_authority_enabled: false,
		providerCall: false,
		actualLaneLaunch: false,
		runtimeExecution: false,
	};
	const validation = validateFlowDeskLaneHeartbeatRecordV1(record);
	if (!validation.ok) return { ok: false, errors: validation.errors };
	return { ok: true, record };
}
