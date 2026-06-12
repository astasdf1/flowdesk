export const FLOWDESK_PLUGIN_ADAPTER_OUTPUT_OBSERVATION_SCHEMA_VERSION_V2 =
	"flowdesk.plugin_adapter_output_observation.v2" as const;
export const FLOWDESK_PLUGIN_ADAPTER_CAPTURE_FINALIZATION_SCHEMA_VERSION_V2 =
	"flowdesk.plugin_adapter_capture_finalization.v2" as const;

export type FlowDeskPluginAdapterObservationOutputKindV2 =
	| "final_text"
	| "tool_trace_only"
	| "empty";

export type FlowDeskPluginAdapterCaptureFinalizationDecisionV2 =
	| "final_text_captured"
	| "awaiting_body_capture"
	| "late_final_text_captured"
	| "no_output"
	| "tool_trace_only";

export type FlowDeskPluginAdapterCaptureFinalizationStateV2 =
	| "initial"
	| "additive";

export interface FlowDeskPluginAdapterRetryStateV2 {
	attempt_count: number;
	max_attempts: number;
	next_action: "retry_body_capture" | "stop";
}

export interface FlowDeskPluginAdapterAuthorityFlagsV2 {
	dispatch_authority_enabled: false;
	provider_call_made: false;
	runtime_execution: false;
	actual_lane_launch: false;
	fallback_authority_enabled: false;
	write_authority_enabled: false;
}

export interface FlowDeskPluginAdapterOutputObservationV2
	extends FlowDeskPluginAdapterAuthorityFlagsV2 {
	schema_version: typeof FLOWDESK_PLUGIN_ADAPTER_OUTPUT_OBSERVATION_SCHEMA_VERSION_V2;
	observation_source: "flowdesk_plugin_adapter";
	latest_text: string | undefined;
	terminal_marker_observed: boolean;
	terminal_reason: string | undefined;
	text_part_count: number;
	reasoning_part_count: number;
	message_count: number;
	tool_trace_part_count: number;
	has_running_tool: boolean;
	output_kind: FlowDeskPluginAdapterObservationOutputKindV2;
	usable_for_synthesis: boolean;
	opencode_internal_validation_performed: false;
	redaction_version: "v1";
}

export interface FlowDeskPluginAdapterCaptureFinalizationV2
	extends FlowDeskPluginAdapterAuthorityFlagsV2 {
	schema_version: typeof FLOWDESK_PLUGIN_ADAPTER_CAPTURE_FINALIZATION_SCHEMA_VERSION_V2;
	finalization_source: "flowdesk_plugin_adapter";
	decision: FlowDeskPluginAdapterCaptureFinalizationDecisionV2;
	finalization_state: FlowDeskPluginAdapterCaptureFinalizationStateV2;
	captured_text: string | undefined;
	usable_for_synthesis: boolean;
	retry_state: FlowDeskPluginAdapterRetryStateV2 | undefined;
	terminal_marker_observed: boolean;
	tool_trace_part_count: number;
	opencode_internal_validation_performed: false;
	redaction_version: "v1";
}

export interface FlowDeskPluginAdapterValidationResultV2 {
	ok: boolean;
	errors: string[];
}

export interface BuildFlowDeskPluginAdapterOutputObservationV2Input {
	latestText?: string | undefined;
	terminalMarkerObserved?: boolean;
	terminalReason?: string | undefined;
	textPartCount?: number;
	reasoningPartCount?: number;
	messageCount?: number;
	toolTracePartCount?: number;
	hasRunningTool?: boolean;
}

export interface FinalizeFlowDeskPluginAdapterCaptureV2Input {
	observation: FlowDeskPluginAdapterOutputObservationV2;
	previousFinalization?: FlowDeskPluginAdapterCaptureFinalizationV2;
	attemptCount?: number;
	maxAttempts?: number;
}

const FLOWDESK_PLUGIN_ADAPTER_SAFE_AUTHORITY_V2: FlowDeskPluginAdapterAuthorityFlagsV2 = {
	dispatch_authority_enabled: false,
	provider_call_made: false,
	runtime_execution: false,
	actual_lane_launch: false,
	fallback_authority_enabled: false,
	write_authority_enabled: false,
};

const FLOWDESK_PLUGIN_ADAPTER_AUTHORITY_KEYS_V2 = Object.keys(
	FLOWDESK_PLUGIN_ADAPTER_SAFE_AUTHORITY_V2,
) as Array<keyof FlowDeskPluginAdapterAuthorityFlagsV2>;

function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === "object" && value !== null && !Array.isArray(value);
}

function boundedInteger(value: number | undefined, fallback: number, min: number, max: number): number {
	if (!Number.isFinite(value)) return fallback;
	return Math.max(min, Math.min(Math.trunc(value as number), max));
}

function nonEmptyText(value: string | undefined): string | undefined {
	return typeof value === "string" && value.trim().length > 0 ? value : undefined;
}

function validateFlowDeskPluginAdapterAuthorityV2(value: Record<string, unknown>, label: string): string[] {
	const errors: string[] = [];
	for (const key of FLOWDESK_PLUGIN_ADAPTER_AUTHORITY_KEYS_V2) {
		if (value[key] !== false) errors.push(`${label}.${key} must be false`);
	}
	if (value.opencode_internal_validation_performed !== false) {
		errors.push(`${label}.opencode_internal_validation_performed must be false`);
	}
	return errors;
}

export function buildFlowDeskPluginAdapterOutputObservationV2(
	input: BuildFlowDeskPluginAdapterOutputObservationV2Input,
): FlowDeskPluginAdapterOutputObservationV2 {
	const latestText = nonEmptyText(input.latestText);
	const toolTracePartCount = boundedInteger(input.toolTracePartCount, 0, 0, 10_000);
	const outputKind: FlowDeskPluginAdapterObservationOutputKindV2 = latestText !== undefined
		? "final_text"
		: toolTracePartCount > 0
			? "tool_trace_only"
			: "empty";

	return {
		schema_version: FLOWDESK_PLUGIN_ADAPTER_OUTPUT_OBSERVATION_SCHEMA_VERSION_V2,
		observation_source: "flowdesk_plugin_adapter",
		latest_text: latestText,
		terminal_marker_observed: input.terminalMarkerObserved ?? false,
		terminal_reason: input.terminalReason,
		text_part_count: boundedInteger(input.textPartCount, latestText === undefined ? 0 : 1, 0, 10_000),
		reasoning_part_count: boundedInteger(input.reasoningPartCount, 0, 0, 10_000),
		message_count: boundedInteger(input.messageCount, 0, 0, 10_000),
		tool_trace_part_count: toolTracePartCount,
		has_running_tool: input.hasRunningTool ?? false,
		output_kind: outputKind,
		usable_for_synthesis: outputKind === "final_text",
		opencode_internal_validation_performed: false,
		redaction_version: "v1",
		...FLOWDESK_PLUGIN_ADAPTER_SAFE_AUTHORITY_V2,
	};
}

export function finalizeFlowDeskPluginAdapterCaptureV2(
	input: FinalizeFlowDeskPluginAdapterCaptureV2Input,
): FlowDeskPluginAdapterCaptureFinalizationV2 {
	const maxAttempts = boundedInteger(input.maxAttempts, 2, 0, 5);
	const attemptCount = boundedInteger(input.attemptCount, 0, 0, maxAttempts);
	const observation = input.observation;
	const text = nonEmptyText(observation.latest_text);
	const isLateBodyCapture = input.previousFinalization?.decision === "awaiting_body_capture" && text !== undefined;

	const retry_state: FlowDeskPluginAdapterRetryStateV2 | undefined =
		observation.terminal_marker_observed && text === undefined
			? {
				attempt_count: attemptCount,
				max_attempts: maxAttempts,
				next_action: attemptCount >= maxAttempts ? "stop" : "retry_body_capture",
			}
			: undefined;

	let decision: FlowDeskPluginAdapterCaptureFinalizationDecisionV2;
	if (text !== undefined) decision = isLateBodyCapture ? "late_final_text_captured" : "final_text_captured";
	else if (observation.output_kind === "tool_trace_only" || observation.tool_trace_part_count > 0) decision = "tool_trace_only";
	// A terminal/step-finish marker without body is only a finalization-relevant
	// hint. It must not become terminal no_output by itself; callers need an
	// independent failure/timeout/cap signal before writing terminal no_output.
	else if (observation.terminal_marker_observed) decision = "awaiting_body_capture";
	else decision = "no_output";

	return {
		schema_version: FLOWDESK_PLUGIN_ADAPTER_CAPTURE_FINALIZATION_SCHEMA_VERSION_V2,
		finalization_source: "flowdesk_plugin_adapter",
		decision,
		finalization_state: isLateBodyCapture ? "additive" : "initial",
		captured_text: text,
		usable_for_synthesis: decision === "final_text_captured" || decision === "late_final_text_captured",
		retry_state,
		terminal_marker_observed: observation.terminal_marker_observed,
		tool_trace_part_count: observation.tool_trace_part_count,
		opencode_internal_validation_performed: false,
		redaction_version: "v1",
		...FLOWDESK_PLUGIN_ADAPTER_SAFE_AUTHORITY_V2,
	};
}

export function validateFlowDeskPluginAdapterOutputObservationV2(
	value: unknown,
): FlowDeskPluginAdapterValidationResultV2 {
	if (!isRecord(value)) return { ok: false, errors: ["plugin adapter output observation must be an object"] };
	const errors: string[] = [];
	if (value.schema_version !== FLOWDESK_PLUGIN_ADAPTER_OUTPUT_OBSERVATION_SCHEMA_VERSION_V2) {
		errors.push(`schema_version must be ${FLOWDESK_PLUGIN_ADAPTER_OUTPUT_OBSERVATION_SCHEMA_VERSION_V2}`);
	}
	if (value.observation_source !== "flowdesk_plugin_adapter") {
		errors.push("observation_source must be flowdesk_plugin_adapter");
	}
	if (value.output_kind !== "final_text" && value.output_kind !== "tool_trace_only" && value.output_kind !== "empty") {
		errors.push("output_kind is invalid");
	}
	errors.push(...validateFlowDeskPluginAdapterAuthorityV2(value, "plugin_adapter_output_observation"));
	return { ok: errors.length === 0, errors };
}

export function validateFlowDeskPluginAdapterCaptureFinalizationV2(
	value: unknown,
): FlowDeskPluginAdapterValidationResultV2 {
	if (!isRecord(value)) return { ok: false, errors: ["plugin adapter capture finalization must be an object"] };
	const errors: string[] = [];
	if (value.schema_version !== FLOWDESK_PLUGIN_ADAPTER_CAPTURE_FINALIZATION_SCHEMA_VERSION_V2) {
		errors.push(`schema_version must be ${FLOWDESK_PLUGIN_ADAPTER_CAPTURE_FINALIZATION_SCHEMA_VERSION_V2}`);
	}
	if (value.finalization_source !== "flowdesk_plugin_adapter") {
		errors.push("finalization_source must be flowdesk_plugin_adapter");
	}
	const decisions = new Set<FlowDeskPluginAdapterCaptureFinalizationDecisionV2>([
		"final_text_captured",
		"awaiting_body_capture",
		"late_final_text_captured",
		"no_output",
		"tool_trace_only",
	]);
	if (!decisions.has(value.decision as FlowDeskPluginAdapterCaptureFinalizationDecisionV2)) {
		errors.push("decision is invalid");
	}
	if (value.finalization_state !== "initial" && value.finalization_state !== "additive") {
		errors.push("finalization_state is invalid");
	}
	errors.push(...validateFlowDeskPluginAdapterAuthorityV2(value, "plugin_adapter_capture_finalization"));
	return { ok: errors.length === 0, errors };
}
