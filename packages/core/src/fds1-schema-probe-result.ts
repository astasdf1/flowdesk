import {
	invalid,
	type ValidationResult,
	valid,
	validateNoForbiddenRawPayloads,
	validateOpaqueId,
	validateOpaqueRef,
} from "./validators.js";

export const FLOWDESK_FDS1_SCHEMA_PROBE_OUTCOMES = [
	"probe_pass",
	"probe_blocked",
	"probe_invalid",
] as const;
export type FlowDeskFds1SchemaProbeOutcomeV1 =
	(typeof FLOWDESK_FDS1_SCHEMA_PROBE_OUTCOMES)[number];

export interface FlowDeskFds1SchemaProbeResultV1 {
	schema_version: "flowdesk.fds1_schema_probe_result.v1";
	probe_id: string;
	tool_name: string;
	request_schema_ref: string;
	response_schema_ref: string;
	outcome: FlowDeskFds1SchemaProbeOutcomeV1;
	observed_at: string;
	unknown_property_rejected: boolean;
	malformed_event_rejected: boolean;
	provider_facing_conversion_checked: boolean;
	runtime_validator_checked: boolean;
	failure_labels: string[];
	evidence_refs: string[];
	dispatch_authority_enabled: false;
	providerCall: false;
	runtimeExecution: false;
	actualLaneLaunch: false;
}

function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === "object" && value !== null && !Array.isArray(value);
}

function validateStringArray(value: unknown, label: string): ValidationResult {
	if (!Array.isArray(value)) return invalid(`${label} must be an array`);
	const errors: string[] = [];
	for (const [index, item] of value.entries()) {
		if (typeof item !== "string" || item.length === 0 || item.length > 160)
			errors.push(`${label}[${index}] must be a bounded string`);
		errors.push(...validateNoForbiddenRawPayloads(item, `${label}[${index}]`).errors);
	}
	return errors.length === 0 ? valid() : invalid(...errors);
}

export function createFlowDeskFds1SchemaProbeResultV1(input: {
	probeId: string;
	toolName: string;
	requestSchemaRef: string;
	responseSchemaRef: string;
	observedAt: string;
	unknownPropertyRejected: boolean;
	malformedEventRejected: boolean;
	providerFacingConversionChecked: boolean;
	runtimeValidatorChecked: boolean;
	failureLabels?: string[];
	evidenceRefs?: string[];
}): FlowDeskFds1SchemaProbeResultV1 {
	const failureLabels = [...(input.failureLabels ?? [])];
	if (!input.unknownPropertyRejected)
		failureLabels.push("unknown_property_not_rejected");
	if (!input.malformedEventRejected)
		failureLabels.push("malformed_event_not_rejected");
	if (!input.providerFacingConversionChecked)
		failureLabels.push("provider_facing_conversion_unchecked");
	if (!input.runtimeValidatorChecked)
		failureLabels.push("runtime_validator_unchecked");
	const outcome: FlowDeskFds1SchemaProbeOutcomeV1 =
		failureLabels.length === 0 ? "probe_pass" : "probe_blocked";
	return {
		schema_version: "flowdesk.fds1_schema_probe_result.v1",
		probe_id: input.probeId,
		tool_name: input.toolName,
		request_schema_ref: input.requestSchemaRef,
		response_schema_ref: input.responseSchemaRef,
		outcome,
		observed_at: input.observedAt,
		unknown_property_rejected: input.unknownPropertyRejected,
		malformed_event_rejected: input.malformedEventRejected,
		provider_facing_conversion_checked: input.providerFacingConversionChecked,
		runtime_validator_checked: input.runtimeValidatorChecked,
		failure_labels: [...new Set(failureLabels)],
		evidence_refs: [...(input.evidenceRefs ?? [])],
		dispatch_authority_enabled: false,
		providerCall: false,
		runtimeExecution: false,
		actualLaneLaunch: false,
	};
}

export function validateFlowDeskFds1SchemaProbeResultV1(
	value: unknown,
): ValidationResult {
	if (!isRecord(value)) return invalid("FDS-1 schema probe result must be an object");
	const record = value as Partial<FlowDeskFds1SchemaProbeResultV1>;
	const errors: string[] = [];
	const allowed = new Set([
		"schema_version",
		"probe_id",
		"tool_name",
		"request_schema_ref",
		"response_schema_ref",
		"outcome",
		"observed_at",
		"unknown_property_rejected",
		"malformed_event_rejected",
		"provider_facing_conversion_checked",
		"runtime_validator_checked",
		"failure_labels",
		"evidence_refs",
		"dispatch_authority_enabled",
		"providerCall",
		"runtimeExecution",
		"actualLaneLaunch",
	]);
	for (const key of Object.keys(record))
		if (!allowed.has(key)) errors.push(`unknown properties: ${key}`);
	if (record.schema_version !== "flowdesk.fds1_schema_probe_result.v1")
		errors.push("FDS-1 probe schema_version is invalid");
	errors.push(...validateOpaqueId(record.probe_id, "probe_id").errors);
	errors.push(...validateOpaqueRef(record.tool_name, "tool_name").errors);
	errors.push(
		...validateOpaqueRef(record.request_schema_ref, "request_schema_ref").errors,
	);
	errors.push(
		...validateOpaqueRef(record.response_schema_ref, "response_schema_ref").errors,
	);
	if (
		!(FLOWDESK_FDS1_SCHEMA_PROBE_OUTCOMES as readonly string[]).includes(
			record.outcome ?? "",
		)
	)
		errors.push("FDS-1 probe outcome is invalid");
	if (
		typeof record.observed_at !== "string" ||
		!Number.isFinite(Date.parse(record.observed_at))
	)
		errors.push("observed_at must be parseable");
	for (const key of [
		"unknown_property_rejected",
		"malformed_event_rejected",
		"provider_facing_conversion_checked",
		"runtime_validator_checked",
	] as const)
		if (typeof record[key] !== "boolean") errors.push(`${key} must be boolean`);
	errors.push(...validateStringArray(record.failure_labels, "failure_labels").errors);
	errors.push(...validateStringArray(record.evidence_refs, "evidence_refs").errors);
	if (
		record.outcome === "probe_pass" &&
		(record.unknown_property_rejected !== true ||
			record.malformed_event_rejected !== true ||
			record.provider_facing_conversion_checked !== true ||
			record.runtime_validator_checked !== true ||
			(record.failure_labels?.length ?? 0) > 0)
	)
		errors.push("FDS-1 probe_pass requires all checks and no failures");
	if (
		record.dispatch_authority_enabled !== false ||
		record.providerCall !== false ||
		record.runtimeExecution !== false ||
		record.actualLaneLaunch !== false
	)
		errors.push("FDS-1 probe cannot enable runtime authority");
	errors.push(...validateNoForbiddenRawPayloads(record, "fds1_schema_probe_result").errors);
	return errors.length === 0 ? valid() : invalid(...errors);
}
