export const FLOWDESK_SESSION_FINALIZATION_OBSERVATION_SCHEMA_VERSION =
	"flowdesk.session_finalization_observation.v1" as const;
export const FLOWDESK_SESSION_FINALIZATION_EVIDENCE_SCHEMA_VERSION =
	"flowdesk.session_finalization_evidence.v1" as const;

export type FlowDeskSessionFinalTextKind =
	| "assistant_final_text"
	| "process_notes"
	| "tool_trace_only"
	| "empty";

export type FlowDeskSessionIdleState = "confirmed_idle" | "bounded_quiescence_confirmed" | "not_idle" | "unknown";
export type FlowDeskSessionRunningToolsState =
	| "none_running_confirmed"
	| "running_confirmed"
	| "none_confirmed"
	| "tools_running"
	| "unknown";
export type FlowDeskSessionFinalizationConfidence = "high" | "medium" | "low";
export type FlowDeskSessionFinalizationBodyCaptureState = "not_requested" | "awaiting_body_capture";

export type FlowDeskSessionFinalizationDecision =
	| "safe_capture_ready"
	| "awaiting_body_capture"
	| "blocked_text_absent"
	| "blocked_session_not_idle"
	| "blocked_running_tools"
	| "requires_review";

export type FlowDeskSessionFinalizationBlockReason =
	| "none"
	| "blocked_text_absent"
	| "session_not_idle"
	| "running_tools_present"
	| "tool_state_unknown"
	| "idle_state_unknown"
	| "confidence_low"
	| "unsupported_final_text_kind";

export interface FlowDeskSessionFinalizationAuthorityFlags {
	dispatch_authority_enabled: false;
	provider_call_made: false;
	runtime_execution: false;
	actual_lane_launch: false;
	fallback_authority_enabled: false;
	write_authority_enabled: false;
}

export interface FlowDeskSessionFinalizationObservationProjection
	extends FlowDeskSessionFinalizationAuthorityFlags {
	schema_version: typeof FLOWDESK_SESSION_FINALIZATION_OBSERVATION_SCHEMA_VERSION;
	projection_source: "flowdesk_session_finalization_pure_evaluator";
	session_ref: string | undefined;
	observed_text_ref?: string | undefined;
	observed_text_char_count?: number | undefined;
	final_text_kind: FlowDeskSessionFinalTextKind;
	session_idle_state: FlowDeskSessionIdleState;
	running_tools_state: FlowDeskSessionRunningToolsState;
	confidence: FlowDeskSessionFinalizationConfidence;
	step_finish_observed: boolean;
	body_capture_state?: FlowDeskSessionFinalizationBodyCaptureState | undefined;
	opencode_internal_validation_performed: false;
	redaction_version: "v1";
}

export interface FlowDeskSessionFinalizationEvidence
	extends FlowDeskSessionFinalizationAuthorityFlags {
	schema_version: typeof FLOWDESK_SESSION_FINALIZATION_EVIDENCE_SCHEMA_VERSION;
	evidence_source: "flowdesk_session_finalization_pure_evaluator";
	decision: FlowDeskSessionFinalizationDecision;
	block_reason: FlowDeskSessionFinalizationBlockReason;
	observed_text_ref?: string | undefined;
	observed_text_char_count?: number | undefined;
	safe_capture_ready: boolean;
	usable_for_synthesis: boolean;
	requires_review: boolean;
	observation: FlowDeskSessionFinalizationObservationProjection;
	opencode_internal_validation_performed: false;
	redaction_version: "v1";
}

export interface BuildFlowDeskSessionFinalizationObservationInput {
	sessionRef?: string | undefined;
	observedTextRef?: string | undefined;
	observedTextCharCount?: number | undefined;
	finalTextKind?: FlowDeskSessionFinalTextKind;
	sessionIdleState?: FlowDeskSessionIdleState;
	runningToolsState?: FlowDeskSessionRunningToolsState;
	confidence?: FlowDeskSessionFinalizationConfidence;
	stepFinishObserved?: boolean;
	bodyCaptureState?: FlowDeskSessionFinalizationBodyCaptureState | undefined;
}

const FLOWDESK_SESSION_FINALIZATION_SAFE_AUTHORITY: FlowDeskSessionFinalizationAuthorityFlags = {
	dispatch_authority_enabled: false,
	provider_call_made: false,
	runtime_execution: false,
	actual_lane_launch: false,
	fallback_authority_enabled: false,
	write_authority_enabled: false,
};

function nonEmptyRef(value: string | undefined): string | undefined {
	return typeof value === "string" && value.trim().length > 0 ? value : undefined;
}

function positiveCharCount(value: number | undefined): number | undefined {
	if (typeof value !== "number" || !Number.isFinite(value)) {
		return undefined;
	}
	const count = Math.floor(value);
	return count > 0 ? count : undefined;
}

function hasObservedText(observation: FlowDeskSessionFinalizationObservationProjection): boolean {
	return observation.observed_text_ref !== undefined || (observation.observed_text_char_count ?? 0) > 0;
}

export function buildFlowDeskSessionFinalizationObservation(
	input: BuildFlowDeskSessionFinalizationObservationInput,
): FlowDeskSessionFinalizationObservationProjection {
	const observedTextRef = nonEmptyRef(input.observedTextRef);
	const observedTextCharCount = positiveCharCount(input.observedTextCharCount);
	const textPresent = observedTextRef !== undefined || observedTextCharCount !== undefined;
	const finalTextKind = input.finalTextKind ?? (textPresent ? "assistant_final_text" : "empty");

	return {
		schema_version: FLOWDESK_SESSION_FINALIZATION_OBSERVATION_SCHEMA_VERSION,
		projection_source: "flowdesk_session_finalization_pure_evaluator",
		session_ref: input.sessionRef,
		observed_text_ref: observedTextRef,
		observed_text_char_count: observedTextCharCount,
		final_text_kind: finalTextKind,
		session_idle_state: input.sessionIdleState ?? "unknown",
		running_tools_state: input.runningToolsState ?? "unknown",
		confidence: input.confidence ?? "low",
		step_finish_observed: input.stepFinishObserved ?? false,
		body_capture_state: input.bodyCaptureState,
		opencode_internal_validation_performed: false,
		redaction_version: "v1",
		...FLOWDESK_SESSION_FINALIZATION_SAFE_AUTHORITY,
	};
}

export function evaluateFlowDeskSessionFinalizationEvidence(
	observation: FlowDeskSessionFinalizationObservationProjection,
): FlowDeskSessionFinalizationEvidence {
	const textPresent = hasObservedText(observation);
	let decision: FlowDeskSessionFinalizationDecision;
	let blockReason: FlowDeskSessionFinalizationBlockReason;

	if (!textPresent) {
		decision = observation.body_capture_state === "awaiting_body_capture" ? "awaiting_body_capture" : "blocked_text_absent";
		blockReason = "blocked_text_absent";
	} else if (observation.final_text_kind !== "assistant_final_text") {
		decision = "requires_review";
		blockReason = "unsupported_final_text_kind";
	} else if (observation.session_idle_state === "unknown") {
		decision = "requires_review";
		blockReason = "idle_state_unknown";
	} else if (observation.session_idle_state !== "confirmed_idle" && observation.session_idle_state !== "bounded_quiescence_confirmed") {
		decision = "blocked_session_not_idle";
		blockReason = "session_not_idle";
} else if (observation.running_tools_state === "unknown") {
		decision = "requires_review";
		blockReason = "tool_state_unknown";
	} else if (observation.running_tools_state === "tools_running" || observation.running_tools_state === "running_confirmed") {
		decision = "blocked_running_tools";
		blockReason = "running_tools_present";
	} else if (observation.running_tools_state !== "none_running_confirmed" && observation.running_tools_state !== "none_confirmed") {
		decision = "requires_review";
		blockReason = "tool_state_unknown";
	} else if (observation.confidence === "low") {
		decision = "requires_review";
		blockReason = "confidence_low";
	} else {
		decision = "safe_capture_ready";
		blockReason = "none";
	}

	const safeCaptureReady = decision === "safe_capture_ready";

	return {
		schema_version: FLOWDESK_SESSION_FINALIZATION_EVIDENCE_SCHEMA_VERSION,
		evidence_source: "flowdesk_session_finalization_pure_evaluator",
		decision,
		block_reason: blockReason,
		observed_text_ref: safeCaptureReady ? observation.observed_text_ref : undefined,
		observed_text_char_count: safeCaptureReady ? observation.observed_text_char_count : undefined,
		safe_capture_ready: safeCaptureReady,
		usable_for_synthesis: safeCaptureReady,
		requires_review: decision === "requires_review",
		observation,
		opencode_internal_validation_performed: false,
		redaction_version: "v1",
		...FLOWDESK_SESSION_FINALIZATION_SAFE_AUTHORITY,
	};
}
