import {
	invalid,
	type ValidationResult,
	valid,
	validateNoForbiddenRawPayloads,
} from "./validators.js";

export interface FlowDeskManagedDispatchEvidenceShapeValidationOptionsV1 {
	now?: number | string | Date;
	ttlSeconds?: number;
}

const DEFAULT_FRESHNESS_TTL_SECONDS = 300;
const REQUIRED_ATTESTATION_SCOPE = "plugin_observed_only";
const EXPLICIT_FORBIDDEN_RAW_FIELDS = new Set([
	"auth",
	"rawproviderpayload",
	"rawtranscript",
	"token",
]);

function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === "object" && value !== null && !Array.isArray(value);
}

function normalizeNow(now: FlowDeskManagedDispatchEvidenceShapeValidationOptionsV1["now"]): number {
	if (now === undefined) return Date.now();
	if (typeof now === "number") return now;
	if (now instanceof Date) return now.getTime();
	return Date.parse(now);
}

function validateRequiredFields(
	value: Record<string, unknown>,
	label: string,
): string[] {
	const requiredFields = ["schema_version", "observedAt", "attestation_scope"];
	const missing = requiredFields.filter((field) => !(field in value));
	return missing.length === 0
		? []
		: [`${label} missing required fields: ${missing.join(",")}`];
}

function validateAttestationScope(
	value: Record<string, unknown>,
	label: string,
): string[] {
	return value.attestation_scope === REQUIRED_ATTESTATION_SCOPE
		? []
		: [`${label} attestation_scope must be ${REQUIRED_ATTESTATION_SCOPE}`];
}

function validateFreshness(
	value: Record<string, unknown>,
	label: string,
	options?: FlowDeskManagedDispatchEvidenceShapeValidationOptionsV1,
): string[] {
	if (typeof value.observedAt !== "string" || value.observedAt.length === 0)
		return [`${label} observedAt is required`];
	const observedAt = Date.parse(value.observedAt);
	if (!Number.isFinite(observedAt))
		return [`${label} observedAt must be a parseable timestamp`];
	const now = normalizeNow(options?.now);
	if (!Number.isFinite(now)) return [`${label} validation now is invalid`];
	const ttlSeconds = options?.ttlSeconds ?? DEFAULT_FRESHNESS_TTL_SECONDS;
	if (!Number.isFinite(ttlSeconds) || ttlSeconds <= 0)
		return [`${label} freshness ttl must be positive`];
	if (observedAt > now) return [`${label} observedAt must not be in the future`];
	return now - observedAt <= ttlSeconds * 1_000
		? []
		: [`${label} is stale`];
}

function validateNoExplicitForbiddenRawFields(value: unknown, label: string): string[] {
	const errors: string[] = [];
	const visit = (current: unknown, path: string): void => {
		if (Array.isArray(current)) {
			current.forEach((item, index) => visit(item, `${path}[${index}]`));
			return;
		}
		if (!isRecord(current)) return;
		for (const [key, nested] of Object.entries(current)) {
			if (EXPLICIT_FORBIDDEN_RAW_FIELDS.has(key.toLowerCase()))
				errors.push(`${path}.${key} is a forbidden raw payload field`);
			visit(nested, `${path}.${key}`);
		}
	};
	visit(value, label);
	return errors;
}

function shapeOnly(
	value: unknown,
	expectedSchemaVersion: string,
	label: string,
	options?: FlowDeskManagedDispatchEvidenceShapeValidationOptionsV1,
): ValidationResult {
	if (!isRecord(value)) return invalid(`${label} must be an object`);
	const errors: string[] = [];
	errors.push(...validateRequiredFields(value, label));
	if (value.schema_version !== expectedSchemaVersion)
		errors.push(`${label} schema_version is invalid`);
	errors.push(...validateAttestationScope(value, label));
	errors.push(...validateFreshness(value, label, options));
	errors.push(...validateNoExplicitForbiddenRawFields(value, label));
	errors.push(...validateNoForbiddenRawPayloads(value, label).errors);
	return errors.length === 0 ? valid() : invalid(...errors);
}

export function validateFlowDeskManagedDispatchBetaUsageAuthorityShapeV1(
	value: unknown,
	options?: FlowDeskManagedDispatchEvidenceShapeValidationOptionsV1,
): ValidationResult {
	return shapeOnly(
		value,
		"flowdesk.managed_dispatch_beta.usage_authority_evidence.v1",
		"usage_authority_evidence",
		options,
	);
}

export function validateFlowDeskManagedDispatchBetaRuntimeEchoShapeV1(
	value: unknown,
	options?: FlowDeskManagedDispatchEvidenceShapeValidationOptionsV1,
): ValidationResult {
	return shapeOnly(
		value,
		"flowdesk.managed_dispatch_beta.runtime_echo_evidence.v1",
		"runtime_echo_evidence",
		options,
	);
}

export function validateFlowDeskManagedDispatchBetaTelemetryCorrelationShapeV1(
	value: unknown,
	options?: FlowDeskManagedDispatchEvidenceShapeValidationOptionsV1,
): ValidationResult {
	return shapeOnly(
		value,
		"flowdesk.managed_dispatch_beta.telemetry_correlation.v1",
		"telemetry_correlation_evidence",
		options,
	);
}
