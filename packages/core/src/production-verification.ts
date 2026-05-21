import {
	invalid,
	type ValidationResult,
	valid,
	validateNoForbiddenRawPayloads,
	validateOpaqueId,
	validateOpaqueRef,
} from "./validators.js";

export const FLOWDESK_CONFIGURED_VERIFICATION_RESULTS = [
	"passed",
	"failed",
] as const;
export type FlowDeskConfiguredVerificationResultLabelV1 =
	(typeof FLOWDESK_CONFIGURED_VERIFICATION_RESULTS)[number];

export interface FlowDeskConfiguredVerificationResultV1 {
	schema_version: "flowdesk.configured_verification_result.v1";
	verification_ref: string;
	workflow_id: string;
	result: FlowDeskConfiguredVerificationResultLabelV1;
	produced_at: string;
	source_ref: string;
	check_labels: string[];
	evidence_refs: string[];
	raw_output_redacted: true;
	provider_call_made: false;
	runtime_execution_made: false;
	actual_lane_launch_made: false;
	dispatch_authority_enabled: false;
	safe_next_actions: string[];
}

export interface FlowDeskConfiguredVerificationResultInputV1 {
	verificationRef: string;
	workflowId: string;
	result: FlowDeskConfiguredVerificationResultLabelV1;
	producedAt: string;
	sourceRef: string;
	checkLabels: string[];
	evidenceRefs?: string[];
}

function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isParseableTimestamp(value: unknown): value is string {
	return typeof value === "string" && Number.isFinite(Date.parse(value));
}

function validateBoundedLabelArray(
	value: unknown,
	label: string,
	maxItems: number,
): ValidationResult {
	const errors: string[] = [];
	if (!Array.isArray(value)) return invalid(`${label} must be an array`);
	if (value.length === 0) errors.push(`${label} must not be empty`);
	if (value.length > maxItems) errors.push(`${label} has too many entries`);
	for (const [index, item] of value.entries()) {
		if (typeof item !== "string" || item.length === 0 || item.length > 80)
			errors.push(`${label}[${index}] is invalid`);
		else if (!/^[A-Za-z0-9_.:-]+$/.test(item))
			errors.push(`${label}[${index}] contains unsupported characters`);
	}
	return errors.length === 0 ? valid() : invalid(...errors);
}

function validateRefArray(
	value: unknown,
	label: string,
	maxItems: number,
): ValidationResult {
	const errors: string[] = [];
	if (!Array.isArray(value)) return invalid(`${label} must be an array`);
	if (value.length > maxItems) errors.push(`${label} has too many entries`);
	for (const [index, item] of value.entries())
		errors.push(...validateOpaqueRef(item, `${label}[${index}]`).errors);
	return errors.length === 0 ? valid() : invalid(...errors);
}

function validateSafeActions(value: unknown): ValidationResult {
	const errors: string[] = [];
	if (!Array.isArray(value)) return invalid("safe_next_actions must be an array");
	if (value.length === 0) errors.push("safe_next_actions must not be empty");
	if (value.length > 5) errors.push("safe_next_actions has too many entries");
	for (const [index, action] of value.entries()) {
		if (typeof action !== "string" || !action.startsWith("/flowdesk-"))
			errors.push(`safe_next_actions[${index}] is invalid`);
	}
	return errors.length === 0 ? valid() : invalid(...errors);
}

export function createFlowDeskConfiguredVerificationResultV1(
	input: FlowDeskConfiguredVerificationResultInputV1,
): FlowDeskConfiguredVerificationResultV1 {
	return {
		schema_version: "flowdesk.configured_verification_result.v1",
		verification_ref: input.verificationRef,
		workflow_id: input.workflowId,
		result: input.result,
		produced_at: input.producedAt,
		source_ref: input.sourceRef,
		check_labels: [...input.checkLabels],
		evidence_refs: [...(input.evidenceRefs ?? [])],
		raw_output_redacted: true,
		provider_call_made: false,
		runtime_execution_made: false,
		actual_lane_launch_made: false,
		dispatch_authority_enabled: false,
		safe_next_actions:
			input.result === "passed"
				? ["/flowdesk-status"]
				: ["/flowdesk-doctor", "/flowdesk-status"],
	};
}

export function validateFlowDeskConfiguredVerificationResultV1(
	value: unknown,
	expectedWorkflowId?: string,
	expectedVerificationRef?: string,
): ValidationResult {
	if (!isRecord(value))
		return invalid("configured verification result must be an object");
	const errors: string[] = [];
	const allowed = new Set([
		"schema_version",
		"verification_ref",
		"workflow_id",
		"result",
		"produced_at",
		"source_ref",
		"check_labels",
		"evidence_refs",
		"raw_output_redacted",
		"provider_call_made",
		"runtime_execution_made",
		"actual_lane_launch_made",
		"dispatch_authority_enabled",
		"safe_next_actions",
	]);
	for (const key of Object.keys(value))
		if (!allowed.has(key)) errors.push(`unknown properties: ${key}`);
	if (value.schema_version !== "flowdesk.configured_verification_result.v1")
		errors.push("configured verification schema_version is invalid");
	errors.push(...validateOpaqueRef(value.verification_ref, "verification_ref").errors);
	errors.push(...validateOpaqueId(value.workflow_id, "workflow_id").errors);
	if (
		expectedVerificationRef !== undefined &&
		value.verification_ref !== expectedVerificationRef
	)
		errors.push("configured verification ref mismatch");
	if (expectedWorkflowId !== undefined && value.workflow_id !== expectedWorkflowId)
		errors.push("configured verification workflow_id mismatch");
	if (
		!(FLOWDESK_CONFIGURED_VERIFICATION_RESULTS as readonly string[]).includes(
			String(value.result),
		)
	)
		errors.push("configured verification result is invalid");
	if (!isParseableTimestamp(value.produced_at))
		errors.push("configured verification produced_at is invalid");
	errors.push(...validateOpaqueRef(value.source_ref, "source_ref").errors);
	errors.push(
		...validateBoundedLabelArray(value.check_labels, "check_labels", 20).errors,
	);
	errors.push(...validateRefArray(value.evidence_refs, "evidence_refs", 20).errors);
	if (value.raw_output_redacted !== true)
		errors.push("raw_output_redacted must be true");
	if (value.provider_call_made !== false)
		errors.push("configured verification cannot make provider calls");
	if (value.runtime_execution_made !== false)
		errors.push("configured verification cannot make runtime execution");
	if (value.actual_lane_launch_made !== false)
		errors.push("configured verification cannot launch lanes");
	if (value.dispatch_authority_enabled !== false)
		errors.push("configured verification cannot enable dispatch authority");
	errors.push(...validateSafeActions(value.safe_next_actions).errors);
	errors.push(
		...validateNoForbiddenRawPayloads(value, "configured_verification_result")
			.errors,
	);
	return errors.length === 0 ? valid() : invalid(...errors);
}
