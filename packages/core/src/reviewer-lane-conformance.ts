import type {
	FlowDeskTopTierReviewerLaneProbeChannel,
	FlowDeskTopTierReviewPerspective,
} from "./release1-contracts.js";
import {
	invalid,
	type ValidationResult,
	valid,
	validateNoForbiddenRawPayloads,
	validateOpaqueId,
	validateOpaqueRef,
	validateProviderQualifiedModelId,
} from "./validators.js";

export const FLOWDESK_REVIEWER_LANE_CONFORMANCE_STATUSES = [
	"observed",
	"partial",
	"unproven",
	"invalid",
] as const;
export type FlowDeskReviewerLaneConformanceStatusV1 =
	(typeof FLOWDESK_REVIEWER_LANE_CONFORMANCE_STATUSES)[number];

export interface FlowDeskReviewerLaneConformanceObservationV1 {
	schema_version: "flowdesk.top_tier_reviewer_lane_conformance_observation.v1";
	observation_id: string;
	workflow_id: string;
	lane_id: string;
	binding_ref: string;
	lane_plan_ref: string;
	channel: FlowDeskTopTierReviewerLaneProbeChannel;
	agent_id: "reviewer";
	provider_qualified_model_id: string;
	perspective: FlowDeskTopTierReviewPerspective;
	prompt_hash_ref: string;
	output_ref: string;
	runtime_echo_ref?: string;
	telemetry_ref?: string;
	parent_task_ref?: string;
	subtask_ref?: string;
	status: FlowDeskReviewerLaneConformanceStatusV1;
	uncertainty_labels: string[];
	observed_at: string;
	dispatch_authority_enabled: false;
	hard_chat_authority_claimed: false;
}

export interface FlowDeskReviewerLaneConformanceInputV1
	extends Omit<
		FlowDeskReviewerLaneConformanceObservationV1,
		| "schema_version"
		| "status"
		| "uncertainty_labels"
		| "dispatch_authority_enabled"
		| "hard_chat_authority_claimed"
	> {
	runtimeEchoObserved?: boolean;
	telemetryObserved?: boolean;
	parentChildRelationObserved?: boolean;
}

const PERSPECTIVES = [
	"policy_security",
	"architecture",
	"verification_implementation",
] as const;
const CHANNELS = ["subtask_true_command_lane", "injected_sdk_client"] as const;

function timestampOk(value: string): boolean {
	return Number.isFinite(Date.parse(value));
}

export function createFlowDeskReviewerLaneConformanceObservationV1(
	input: FlowDeskReviewerLaneConformanceInputV1,
): FlowDeskReviewerLaneConformanceObservationV1 {
	const {
		runtimeEchoObserved,
		telemetryObserved,
		parentChildRelationObserved,
		...observation
	} = input;
	const uncertainty = [
		runtimeEchoObserved === true ? undefined : "runtime_echo_partial",
		telemetryObserved === true ? undefined : "telemetry_partial",
		parentChildRelationObserved === true
			? undefined
			: "parent_child_relation_unproven",
	].filter((label): label is string => typeof label === "string");
	const hasRequiredRuntimeRefs =
		runtimeEchoObserved === true && telemetryObserved === true;
	const hasParentChild = parentChildRelationObserved === true;
	const status: FlowDeskReviewerLaneConformanceStatusV1 =
		hasRequiredRuntimeRefs && hasParentChild
			? "observed"
			: uncertainty.length < 3
				? "partial"
				: "unproven";
	return {
		schema_version:
			"flowdesk.top_tier_reviewer_lane_conformance_observation.v1",
		...observation,
		status,
		uncertainty_labels: uncertainty,
		dispatch_authority_enabled: false,
		hard_chat_authority_claimed: false,
	};
}

export function validateFlowDeskReviewerLaneConformanceObservationV1(
	value: unknown,
): ValidationResult {
	if (typeof value !== "object" || value === null || Array.isArray(value))
		return invalid("reviewer lane conformance observation must be an object");
	const record = value as Partial<FlowDeskReviewerLaneConformanceObservationV1>;
	const errors: string[] = [];
	const allowed = new Set([
		"schema_version",
		"observation_id",
		"workflow_id",
		"lane_id",
		"binding_ref",
		"lane_plan_ref",
		"channel",
		"agent_id",
		"provider_qualified_model_id",
		"perspective",
		"prompt_hash_ref",
		"output_ref",
		"runtime_echo_ref",
		"telemetry_ref",
		"parent_task_ref",
		"subtask_ref",
		"status",
		"uncertainty_labels",
		"observed_at",
		"dispatch_authority_enabled",
		"hard_chat_authority_claimed",
	]);
	for (const key of Object.keys(record))
		if (!allowed.has(key)) errors.push(`unknown properties: ${key}`);
	if (
		record.schema_version !==
		"flowdesk.top_tier_reviewer_lane_conformance_observation.v1"
	)
		errors.push("lane conformance observation schema_version is invalid");
	errors.push(
		...validateOpaqueId(record.observation_id, "observation_id").errors,
	);
	errors.push(...validateOpaqueId(record.workflow_id, "workflow_id").errors);
	errors.push(...validateOpaqueId(record.lane_id, "lane_id").errors);
	errors.push(...validateOpaqueRef(record.binding_ref, "binding_ref").errors);
	errors.push(
		...validateOpaqueRef(record.lane_plan_ref, "lane_plan_ref").errors,
	);
	if (!(CHANNELS as readonly string[]).includes(record.channel ?? ""))
		errors.push("channel is invalid");
	if (record.agent_id !== "reviewer")
		errors.push("agent_id must be canonical reviewer");
	errors.push(
		...validateProviderQualifiedModelId(record.provider_qualified_model_id)
			.errors,
	);
	if (!(PERSPECTIVES as readonly string[]).includes(record.perspective ?? ""))
		errors.push("perspective is invalid");
	errors.push(
		...validateOpaqueRef(record.prompt_hash_ref, "review_input_hash_ref")
			.errors,
	);
	errors.push(...validateOpaqueRef(record.output_ref, "output_ref").errors);
	for (const [key, label] of [
		[record.runtime_echo_ref, "runtime_echo_ref"],
		[record.telemetry_ref, "telemetry_ref"],
		[record.parent_task_ref, "parent_task_ref"],
		[record.subtask_ref, "subtask_ref"],
	] as const) {
		if (key !== undefined) errors.push(...validateOpaqueRef(key, label).errors);
	}
	if (
		!(
			FLOWDESK_REVIEWER_LANE_CONFORMANCE_STATUSES as readonly string[]
		).includes(record.status ?? "")
	)
		errors.push("status is invalid");
	if (!Array.isArray(record.uncertainty_labels))
		errors.push("uncertainty_labels must be an array");
	else
		for (const [index, label] of record.uncertainty_labels.entries()) {
			if (typeof label !== "string" || label.length === 0 || label.length > 120)
				errors.push(`uncertainty_labels[${index}] must be a bounded string`);
		}
	if (
		typeof record.observed_at !== "string" ||
		!timestampOk(record.observed_at)
	)
		errors.push("observed_at must be a parseable timestamp");
	if (record.dispatch_authority_enabled !== false)
		errors.push(
			"lane conformance observation cannot enable dispatch authority",
		);
	if (record.hard_chat_authority_claimed !== false)
		errors.push(
			"lane conformance observation cannot claim hard chat authority",
		);
	for (const [key, value] of Object.entries(record)) {
		if (key === "prompt_hash_ref") continue;
		errors.push(
			...validateNoForbiddenRawPayloads(
				value,
				`reviewer_lane_conformance_observation.${key}`,
			).errors,
		);
	}
	return errors.length === 0 ? valid() : invalid(...errors);
}
