import {
	invalid,
	type ValidationResult,
	valid,
	validateNoForbiddenRawPayloads,
} from "./validators.js";

function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === "object" && value !== null && !Array.isArray(value);
}

function shapeOnly(
	value: unknown,
	expectedSchemaVersion: string,
	label: string,
): ValidationResult {
	if (!isRecord(value)) return invalid(`${label} must be an object`);
	const errors: string[] = [];
	if (value.schema_version !== expectedSchemaVersion)
		errors.push(`${label} schema_version is invalid`);
	errors.push(...validateNoForbiddenRawPayloads(value, label).errors);
	return errors.length === 0 ? valid() : invalid(...errors);
}

export function validateFlowDeskManagedDispatchBetaUsageAuthorityShapeV1(
	value: unknown,
): ValidationResult {
	return shapeOnly(
		value,
		"flowdesk.managed_dispatch_beta.usage_authority_evidence.v1",
		"usage_authority_evidence",
	);
}

export function validateFlowDeskManagedDispatchBetaRuntimeEchoShapeV1(
	value: unknown,
): ValidationResult {
	return shapeOnly(
		value,
		"flowdesk.managed_dispatch_beta.runtime_echo_evidence.v1",
		"runtime_echo_evidence",
	);
}

export function validateFlowDeskManagedDispatchBetaTelemetryCorrelationShapeV1(
	value: unknown,
): ValidationResult {
	return shapeOnly(
		value,
		"flowdesk.managed_dispatch_beta.telemetry_correlation.v1",
		"telemetry_correlation_evidence",
	);
}
