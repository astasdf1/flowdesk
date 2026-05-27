import {
	invalid,
	type ValidationResult,
	valid,
	validateNoForbiddenRawPayloads,
	validateOpaqueId,
	validateOpaqueRef,
} from "./validators.js";

export { invalid, type ValidationResult, valid } from "./validators.js";

export const FLOWDESK_PLANNING_AUTHORITY_KEYS_V1 = [
	"dispatch_authority_enabled",
	"provider_call_made",
	"runtime_execution",
	"actual_lane_launch",
	"write_authority_enabled",
] as const;

const AUTHORITY_TRUE_KEYS = new Set([
	...FLOWDESK_PLANNING_AUTHORITY_KEYS_V1,
	"realOpenCodeDispatch",
	"providerCall",
	"actualLaneLaunch",
	"runtimeExecution",
	"fallbackAuthority",
	"toolAuthority",
	"hardCancelOrNoReplyAuthority",
	"fallback_allowed",
	"reselection_allowed",
]);

const AUTHORITY_SMUGGLING_PATTERN = /\b(?:approve(?:d|s)?|approval|authorize(?:d|s)?|authorization|guard(?:ed)?\s+approval|dispatch(?:able|ed|es)?|dispatch\s*-?authority|real\s*-?(?:opencode\s*-?)?dispatch|provider\s*-?(?:call|payload|response)|runtime\s*-?execution|runtime[-_\s]*lane[-_\s]*launch|actual\s*-?lane\s*-?launch|lane\s*-?launch|fallback|reselection|reselect|retry\s+with\s+(?:another|different)|switch\s+(?:provider|model)|no\s*-?reply|hard\s*-?(?:cancel|stop)|opencode\s+run|hidden\s+injection)\b/i;

export function isPlanningEvidenceRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function rejectUnknownPlanningProperties(
	value: Record<string, unknown>,
	allowed: ReadonlySet<string>,
	label: string,
): string[] {
	return Object.keys(value)
		.filter((key) => !allowed.has(key))
		.map((key) => `${label} has unknown property: ${key}`);
}

export function requirePlanningKeys(
	value: Record<string, unknown>,
	keys: readonly string[],
	label: string,
): string[] {
	return keys
		.filter((key) => !(key in value))
		.map((key) => `${label} missing required field: ${key}`);
}

export function validatePlanningSafeText(
	value: unknown,
	label: string,
	maxLength: number,
	options: { allowEmpty?: boolean; allowAuthorityWords?: boolean } = {},
): ValidationResult {
	if (typeof value !== "string") return invalid(`${label} must be a string`);
	if (!options.allowEmpty && value.trim().length === 0)
		return invalid(`${label} must be a non-empty string`);
	if (value.length > maxLength) return invalid(`${label} exceeds ${maxLength} chars`);
	const redaction = validateNoForbiddenRawPayloads(value, label);
	if (!redaction.ok) return redaction;
	if (!options.allowAuthorityWords && AUTHORITY_SMUGGLING_PATTERN.test(value)) {
		return invalid(`${label} contains authority-smuggling language`);
	}
	return valid();
}

export function validatePlanningTimestamp(value: unknown, label: string): ValidationResult {
	if (typeof value !== "string" || value.length === 0)
		return invalid(`${label} must be a timestamp string`);
	return Number.isFinite(Date.parse(value))
		? valid()
		: invalid(`${label} must be a parseable timestamp`);
}

export function validatePlanningOpaqueId(value: unknown, label: string): ValidationResult {
	return validateOpaqueId(value, label);
}

export function validatePlanningOpaqueRef(value: unknown, label: string): ValidationResult {
	return validateOpaqueRef(value, label);
}

export function validatePlanningOpaqueRefArray(
	value: unknown,
	label: string,
	maxItems: number,
): ValidationResult {
	if (!Array.isArray(value)) return invalid(`${label} must be an array`);
	if (value.length > maxItems) return invalid(`${label} exceeds ${maxItems} items`);
	const errors = value.flatMap((item, index) =>
		validateOpaqueRef(item, `${label}[${index}]`).errors,
	);
	return errors.length === 0 ? valid() : invalid(...errors);
}

export function validatePlanningSafeLabelArray(
	value: unknown,
	label: string,
	maxItems: number,
): ValidationResult {
	if (!Array.isArray(value)) return invalid(`${label} must be an array`);
	if (value.length > maxItems) return invalid(`${label} exceeds ${maxItems} items`);
	const errors = value.flatMap((item, index) =>
		validatePlanningSafeText(item, `${label}[${index}]`, 120).errors,
	);
	return errors.length === 0 ? valid() : invalid(...errors);
}

export function validatePlanningAuthorityFalse(
	value: Record<string, unknown>,
	label: string,
): string[] {
	const errors: string[] = [];
	for (const key of FLOWDESK_PLANNING_AUTHORITY_KEYS_V1) {
		if (value[key] !== false) errors.push(`${label}.${key} must be false`);
	}
	for (const [key, nested] of Object.entries(value)) {
		if (AUTHORITY_TRUE_KEYS.has(key) && nested === true) {
			errors.push(`${label}.${key} cannot be true`);
		}
	}
	return errors;
}

export function validatePlanningNoForbiddenPayloads(
	value: unknown,
	label: string,
): ValidationResult {
	return validateNoForbiddenRawPayloads(value, label);
}
