/**
 * Shared internal helpers for the operational-intelligence submodules.
 * These are module-private utilities; they are NOT re-exported from the barrel.
 */
import { type ValidationResult, valid, invalid, validateNoForbiddenRawPayloads, validateOpaqueId, validateOpaqueRef } from "../validators.js";

export { type ValidationResult, valid, invalid, validateNoForbiddenRawPayloads, validateOpaqueId, validateOpaqueRef };

export function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function refs(value: unknown, label: string): ValidationResult {
	if (!Array.isArray(value) || value.length === 0) return invalid(`${label} must be a non-empty array`);
	const errors: string[] = [];
	for (const [index, ref] of value.entries()) errors.push(...validateOpaqueRef(ref, `${label}[${index}]`).errors);
	return errors.length === 0 ? valid() : invalid(...errors);
}

export function rejectUnknownProperties(record: Record<string, unknown>, allowed: readonly string[], label: string): ValidationResult {
	const unknown = Object.keys(record).filter((key) => !allowed.includes(key));
	return unknown.length === 0 ? valid() : invalid(`${label} unknown properties: ${unknown.join(",")}`);
}

export function validateBoundedLabel(value: unknown, label: string): ValidationResult {
	if (typeof value !== "string" || value.length < 1 || value.length > 120) return invalid(`${label} must be a bounded 1..120 string`);
	if (/\p{C}/u.test(value)) return invalid(`${label} must not contain control characters`);
	return validateNoForbiddenRawPayloads(value, label);
}

export function validateTimestamp(value: unknown, label: string): ValidationResult {
	return typeof value === "string" && value.length > 0 && Number.isFinite(Date.parse(value)) ? valid() : invalid(`${label} must be a parseable timestamp`);
}

export function stableStringify(value: unknown): string {
	if (Array.isArray(value)) return `[${value.map((item) => stableStringify(item)).join(",")}]`;
	if (isRecord(value)) {
		const keys = Object.keys(value).sort();
		return `{${keys.map((key) => `${JSON.stringify(key)}:${stableStringify(value[key])}`).join(",")}}`;
	}
	return JSON.stringify(value) ?? "null";
}

export function validateAdvisoryAuthorityFlags(record: Record<string, unknown>, label: string): ValidationResult {
	return record.advisory_only === true
		&& record.dispatch_authority_enabled === false
		&& record.approval_authority_enabled === false
		&& record.provider_authority_enabled === false
		&& record.runtime_authority_enabled === false
		&& record.external_write_authority_enabled === false
		&& record.fallback_authority_enabled === false
		&& record.lane_launch_authority_enabled === false
		? valid()
		: invalid(`${label} must remain advisory-only with no dispatch, approval, provider, runtime, external-write, fallback, or lane-launch authority`);
}

export function validateRegistryPublicationAuthorityFlags(record: Record<string, unknown>, label: string): ValidationResult {
	return validateAdvisoryAuthorityFlags(record, label).ok
		&& record.non_authorizing === true
		&& record.remote_write_authority_enabled === false
		&& record.remote_write_attempted === false
		&& record.remote_write_blocked_by_default === true
		&& record.connector_gate_satisfied === false
		? valid()
		: invalid(`${label} must remain non-authorizing with connector gate unsatisfied and no dispatch, approval, provider, runtime, external-write, remote-write, fallback, or lane-launch authority`);
}

export function validateEvaluationAuthorityFlags(record: Record<string, unknown>, label: string): ValidationResult {
	return record.local_only === true
		&& record.append_only === true
		&& record.non_authorizing === true
		&& record.advisory_only === true
		&& record.dispatch_authority_enabled === false
		&& record.approval_authority_enabled === false
		&& record.provider_authority_enabled === false
		&& record.runtime_authority_enabled === false
		&& record.external_write_authority_enabled === false
		&& record.write_authority_enabled === false
		&& record.remote_write_authority_enabled === false
		&& record.fallback_authority_enabled === false
		&& record.lane_launch_authority_enabled === false
		&& record.hard_chat_authority_enabled === false
		? valid()
		: invalid(`${label} must remain local append-only advisory-only with no dispatch, approval, provider, runtime, lane, fallback, write, remote-write, or hard-chat authority`);
}

export function validateHashRef(value: unknown, label: string): ValidationResult {
	if (typeof value !== "string") return invalid(`${label} must be a string`);
	if (/^sha256-[a-f0-9]{64}$/.test(value)) return valid();
	if (/^hash-[A-Za-z0-9][A-Za-z0-9_.:-]{1,122}$/.test(value) && !value.includes("..")) return valid();
	return invalid(`${label} must be hash-<schema-safe-ref> or sha256-<64 lowercase hex>`);
}

export function validateHardFilterFields(record: { hard_filter_state?: unknown; blocked_labels?: unknown; advisory_score?: unknown }, label: string): ValidationResult {
	const errors: string[] = [];
	if (record.hard_filter_state !== "passed" && record.hard_filter_state !== "blocked") errors.push(`${label} hard_filter_state is invalid`);
	if (!Array.isArray(record.blocked_labels)) errors.push(`${label} blocked_labels must be an array`);
	else for (const [index, blockedLabel] of record.blocked_labels.entries())
		errors.push(...validateOpaqueRef(blockedLabel, `${label} blocked_labels[${index}]`).errors);
	if (record.advisory_score !== undefined && (typeof record.advisory_score !== "number" || record.advisory_score < 0 || record.advisory_score > 100)) errors.push(`${label} advisory_score must be 0..100`);
	if (record.hard_filter_state === "passed" && Array.isArray(record.blocked_labels) && record.blocked_labels.length > 0) errors.push(`${label} passed hard filters cannot carry blocked_labels`);
	if (record.hard_filter_state === "blocked" && Array.isArray(record.blocked_labels) && record.blocked_labels.length === 0) errors.push(`${label} blocked hard filters require blocked_labels`);
	if (record.hard_filter_state === "blocked" && record.advisory_score !== undefined && record.advisory_score !== 0) errors.push(`${label} blocked hard filters must zero advisory_score`);
	return errors.length === 0 ? valid() : invalid(...errors);
}

export const evaluationDimensionNames = ["correctness", "safety", "utility", "cost", "latency", "policy_fit", "redaction_fit"] as const;
export const evaluationOutcomeLabels = ["accepted", "rejected", "neutral", "blocked", "inconclusive"] as const;

export function validateEvaluationOutcomeLabel(value: unknown, label: string): ValidationResult {
	return typeof value === "string" && (evaluationOutcomeLabels as readonly string[]).includes(value) ? valid() : invalid(`${label} is invalid`);
}

export function validateEvaluationScoreDimensions(value: unknown, label: string): ValidationResult {
	if (!Array.isArray(value) || value.length === 0 || value.length > 12) return invalid(`${label} must be a non-empty bounded array`);
	const errors: string[] = [];
	const seen = new Set<string>();
	for (const [index, dimension] of value.entries()) {
		if (!isRecord(dimension)) {
			errors.push(`${label}[${index}] must be an object`);
			continue;
		}
		errors.push(...rejectUnknownProperties(dimension, ["dimension", "score", "weight", "outcome_label", "reason_ref"], `${label}[${index}]`).errors);
		if (typeof dimension.dimension !== "string" || !(evaluationDimensionNames as readonly string[]).includes(dimension.dimension)) errors.push(`${label}[${index}].dimension is invalid`);
		else if (seen.has(dimension.dimension)) errors.push(`${label}[${index}].dimension must not duplicate ${dimension.dimension}`);
		else seen.add(dimension.dimension);
		if (typeof dimension.score !== "number" || !Number.isFinite(dimension.score) || dimension.score < 0 || dimension.score > 100) errors.push(`${label}[${index}].score must be 0..100`);
		if (typeof dimension.weight !== "number" || !Number.isFinite(dimension.weight) || dimension.weight < 0 || dimension.weight > 1) errors.push(`${label}[${index}].weight must be 0..1`);
		errors.push(...validateEvaluationOutcomeLabel(dimension.outcome_label, `${label}[${index}].outcome_label`).errors);
		errors.push(...validateOpaqueRef(dimension.reason_ref, `${label}[${index}].reason_ref`).errors);
	}
	return errors.length === 0 ? valid() : invalid(...errors);
}

export const optimizerDimensionNames = [
	"goal_fit", "safety", "simplicity_fit", "detail_fit", "taxonomy_fit", "verification_coverage", "risk", "dependency_impact", "confidence", "cost", "latency", "model_diversity"
] as const;

export function validateOptimizerScoreDimensions(value: unknown, label: string): ValidationResult {
	if (!Array.isArray(value)) return invalid(`${label} must be an array`);
	if (value.length === 0 || value.length > 12) return invalid(`${label} must be a non-empty bounded array`);
	const errors: string[] = [];
	const seen = new Set<string>();
	for (const [index, dimension] of value.entries()) {
		if (!isRecord(dimension)) {
			errors.push(`${label}[${index}] must be an object`);
			continue;
		}
		errors.push(...rejectUnknownProperties(dimension, ["dimension", "score", "weight", "reason_ref"], `${label}[${index}]`).errors);
		if (typeof dimension.dimension !== "string" || !(optimizerDimensionNames as readonly string[]).includes(dimension.dimension)) errors.push(`${label}[${index}].dimension is invalid`);
		else if (seen.has(dimension.dimension)) errors.push(`${label}[${index}].dimension must not duplicate ${dimension.dimension}`);
		else seen.add(dimension.dimension);
		if (typeof dimension.score !== "number" || !Number.isFinite(dimension.score) || dimension.score < 0 || dimension.score > 100) errors.push(`${label}[${index}].score must be 0..100`);
		if (typeof dimension.weight !== "number" || !Number.isFinite(dimension.weight) || dimension.weight < 0 || dimension.weight > 1) errors.push(`${label}[${index}].weight must be 0..1`);
		errors.push(...validateOpaqueRef(dimension.reason_ref, `${label}[${index}].reason_ref`).errors);
	}
	return errors.length === 0 ? valid() : invalid(...errors);
}
