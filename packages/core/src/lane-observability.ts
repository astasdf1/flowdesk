import type {
	FlowDeskLaneObservabilityArtifactV1,
	FlowDeskStatusLaneSummaryV1,
	LaneInspectionStateV1,
	LaneObservabilityLevelV1,
	SafeNextAction,
} from "./release1-contracts.js";
import {
	LANE_INSPECTION_STATES,
	LANE_OBSERVABILITY_LEVELS,
	PERSISTED_LANE_STATES,
	SAFE_NEXT_ACTIONS,
} from "./release1-contracts.js";
import {
	invalid,
	type ValidationResult,
	valid,
	validateNoForbiddenRawPayloads,
	validateOpaqueId,
	validateOpaqueRef,
} from "./validators.js";

export interface FlowDeskLaneObservabilityInputV1 {
	observabilityId: string;
	statusSummaryRef: string;
	laneSummary: FlowDeskStatusLaneSummaryV1;
	observabilityLevel?: LaneObservabilityLevelV1;
	inspectionState?: LaneInspectionStateV1;
	requestedBindingRef?: string;
	observedBindingRef?: string;
	parentSessionRef?: string;
	childSessionRef?: string;
	messageRef?: string;
	outputRef?: string;
	detailRef?: string;
	debugRef?: string;
	inspectActions?: SafeNextAction[];
	redactionStatus?: FlowDeskLaneObservabilityArtifactV1["redaction_status"];
}

const DEFAULT_INSPECT_ACTIONS: SafeNextAction[] = [
	"/flowdesk-status",
	"/flowdesk-export-debug",
];

function uniqueActions(actions: readonly SafeNextAction[]): SafeNextAction[] {
	return [...new Set(actions)].slice(0, 8);
}

function optionalRef(
	value: string | undefined,
	label: string,
	errors: string[],
): value is string {
	if (value === undefined) return false;
	errors.push(...validateOpaqueRef(value, label).errors);
	return true;
}

export function createFlowDeskLaneObservabilityArtifactV1(
	input: FlowDeskLaneObservabilityInputV1,
): FlowDeskLaneObservabilityArtifactV1 {
	const inspectActions = uniqueActions(input.inspectActions ?? DEFAULT_INSPECT_ACTIONS);
	const debugRef = input.debugRef ?? input.laneSummary.debug_ref;
	return {
		schema_version: "flowdesk.lane_observability.v1",
		observability_id: input.observabilityId,
		workflow_id: input.laneSummary.workflow_id,
		lane_id: input.laneSummary.lane_id,
		status_summary_ref: input.statusSummaryRef,
		observability_level: input.observabilityLevel ?? "openable_refs",
		inspection_state: input.inspectionState ?? "inspectable",
		lane_state: input.laneSummary
			.state as FlowDeskLaneObservabilityArtifactV1["lane_state"],
		...(input.requestedBindingRef === undefined
			? {}
			: { requested_binding_ref: input.requestedBindingRef }),
		...(input.observedBindingRef === undefined
			? {}
			: { observed_binding_ref: input.observedBindingRef }),
		...(input.parentSessionRef === undefined
			? {}
			: { parent_session_ref: input.parentSessionRef }),
		...(input.childSessionRef === undefined
			? {}
			: { child_session_ref: input.childSessionRef }),
		...(input.messageRef === undefined ? {} : { message_ref: input.messageRef }),
		...(input.outputRef === undefined ? {} : { output_ref: input.outputRef }),
		...(input.detailRef === undefined ? {} : { detail_ref: input.detailRef }),
		...(debugRef === undefined ? {} : { debug_ref: debugRef }),
		inspect_actions: inspectActions,
		redaction_status: input.redactionStatus ?? "passed",
		created_at: input.laneSummary.created_at,
		updated_at: input.laneSummary.updated_at,
		dispatch_authority_enabled: false,
		provider_call_made: false,
		runtime_execution: false,
		hard_chat_authority_claimed: false,
	};
}

export function validateFlowDeskLaneObservabilityArtifactV1(
	value: unknown,
): ValidationResult {
	if (typeof value !== "object" || value === null || Array.isArray(value))
		return invalid("lane observability artifact must be an object");
	const record = value as Partial<FlowDeskLaneObservabilityArtifactV1>;
	const errors: string[] = [];
	const allowed = new Set([
		"schema_version",
		"observability_id",
		"workflow_id",
		"lane_id",
		"status_summary_ref",
		"observability_level",
		"inspection_state",
		"lane_state",
		"requested_binding_ref",
		"observed_binding_ref",
		"parent_session_ref",
		"child_session_ref",
		"message_ref",
		"output_ref",
		"detail_ref",
		"debug_ref",
		"inspect_actions",
		"redaction_status",
		"created_at",
		"updated_at",
		"dispatch_authority_enabled",
		"provider_call_made",
		"runtime_execution",
		"hard_chat_authority_claimed",
	]);
	for (const key of Object.keys(record))
		if (!allowed.has(key)) errors.push(`unknown properties: ${key}`);
	if (record.schema_version !== "flowdesk.lane_observability.v1")
		errors.push("lane observability schema_version is invalid");
	errors.push(
		...validateOpaqueId(record.observability_id, "observability_id").errors,
		...validateOpaqueId(record.workflow_id, "workflow_id").errors,
		...validateOpaqueId(record.lane_id, "lane_id").errors,
		...validateOpaqueRef(record.status_summary_ref, "status_summary_ref").errors,
	);
	if (!LANE_OBSERVABILITY_LEVELS.includes(record.observability_level as never))
		errors.push("observability_level is invalid");
	if (!LANE_INSPECTION_STATES.includes(record.inspection_state as never))
		errors.push("inspection_state is invalid");
	if (!PERSISTED_LANE_STATES.includes(record.lane_state as never))
		errors.push("lane_state is invalid or future-gated");
	for (const [value, label] of [
		[record.requested_binding_ref, "requested_binding_ref"],
		[record.observed_binding_ref, "observed_binding_ref"],
		[record.parent_session_ref, "parent_session_ref"],
		[record.child_session_ref, "child_session_ref"],
		[record.message_ref, "message_ref"],
		[record.output_ref, "output_ref"],
		[record.detail_ref, "detail_ref"],
		[record.debug_ref, "debug_ref"],
	] as const) {
		optionalRef(value, label, errors);
	}
	if (!Array.isArray(record.inspect_actions))
		errors.push("inspect_actions must be an array");
	else {
		if (record.inspect_actions.length === 0 || record.inspect_actions.length > 8)
			errors.push("inspect_actions must contain 1..8 actions");
		for (const action of record.inspect_actions)
			if (!SAFE_NEXT_ACTIONS.includes(action as never))
				errors.push(`inspect_action is invalid: ${action}`);
	}
	if (!["passed", "partial", "blocked"].includes(record.redaction_status ?? ""))
		errors.push("redaction_status is invalid");
	if (
		typeof record.created_at !== "string" ||
		!Number.isFinite(Date.parse(record.created_at))
	)
		errors.push("created_at must be parseable");
	if (
		typeof record.updated_at !== "string" ||
		!Number.isFinite(Date.parse(record.updated_at))
	)
		errors.push("updated_at must be parseable");
	if (record.dispatch_authority_enabled !== false)
		errors.push("lane observability cannot enable dispatch authority");
	if (record.provider_call_made !== false)
		errors.push("lane observability cannot claim provider calls");
	if (record.runtime_execution !== false)
		errors.push("lane observability cannot claim runtime execution");
	if (record.hard_chat_authority_claimed !== false)
		errors.push("lane observability cannot claim hard chat authority");
	errors.push(
		...validateNoForbiddenRawPayloads(record, "lane_observability").errors,
	);
	return errors.length === 0 ? valid() : invalid(...errors);
}
