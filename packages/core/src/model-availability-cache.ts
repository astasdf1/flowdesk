import type { FlowDeskTopTierReviewPerspective } from "./release1-contracts.js";
import {
	invalid,
	type ValidationResult,
	valid,
	validateConcreteProviderQualifiedModelId,
	validateNoForbiddenRawPayloads,
	validateOpaqueId,
	validateOpaqueRef,
	validateProviderFamily,
} from "./validators.js";

const FLOWDESK_EXACT_MODEL_PROVIDER_FAMILIES = ["claude", "openai", "gemini", "opencode_go", "z_ai"] as const;

export interface FlowDeskExactModelAvailabilityEntryV1 {
	entry_id: string;
	provider_family: "claude" | "openai" | "gemini" | "opencode_go" | "z_ai";
	provider_identity_ref: string;
	provider_qualified_model_id: string;
	model_family: string;
	registered: boolean;
	available: boolean;
	highest_tier_eligible: boolean;
	availability_ref: string;
}

export interface FlowDeskExactModelAvailabilityCacheV1 {
	schema_version: "flowdesk.exact_model_availability_cache.v1";
	cache_id: string;
	local_date: string;
	active_profile_ref: string;
	opencode_version_ref: string;
	flowdesk_package_version_ref: string;
	registry_hash: string;
	policy_pack_hash: string;
	auth_account_boundary_ref: string;
	entries: FlowDeskExactModelAvailabilityEntryV1[];
	dispatch_authority_enabled: false;
	providerCall: false;
	actualLaneLaunch: false;
	runtimeExecution: false;
}

export interface FlowDeskReviewerAssignmentPlanV1 extends ValidationResult {
	schema_version: "flowdesk.reviewer_assignment_plan.v1";
	cache_id: string;
	state: "ready" | "blocked";
	lane_bindings: Array<{
		perspective: FlowDeskTopTierReviewPerspective;
		entry_id: string;
		provider_qualified_model_id: string;
	}>;
	blocked_labels: string[];
	dispatch_authority_enabled: false;
	providerCall: false;
	actualLaneLaunch: false;
	runtimeExecution: false;
}

const perspectives: FlowDeskTopTierReviewPerspective[] = [
	"policy_security",
	"architecture",
	"verification_implementation",
];

function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === "object" && value !== null && !Array.isArray(value);
}

function validateHash(value: unknown, label: string): ValidationResult {
	const ref = validateOpaqueRef(value, label);
	if (!ref.ok) return ref;
	return typeof value === "string" && /^(hash-|sha256-)/.test(value)
		? valid()
		: invalid(`${label} must be hash-bound`);
}

function rejectUnknownProperties(record: Record<string, unknown>, allowed: readonly string[], label: string): ValidationResult {
	const unknown = Object.keys(record).filter((key) => !allowed.includes(key));
	return unknown.length === 0 ? valid() : invalid(`${label} unknown properties: ${unknown.join(",")}`);
}

export function validateFlowDeskExactModelAvailabilityCacheV1(value: unknown): ValidationResult {
	if (!isRecord(value)) return invalid("exact model availability cache must be an object");
	const record = value as Partial<FlowDeskExactModelAvailabilityCacheV1>;
	const errors: string[] = [];
	errors.push(...rejectUnknownProperties(record, [
		"schema_version",
		"cache_id",
		"local_date",
		"active_profile_ref",
		"opencode_version_ref",
		"flowdesk_package_version_ref",
		"registry_hash",
		"policy_pack_hash",
		"auth_account_boundary_ref",
		"entries",
		"dispatch_authority_enabled",
		"providerCall",
		"actualLaneLaunch",
		"runtimeExecution",
	], "availability cache").errors);
	errors.push(...validateOpaqueId(record.cache_id, "cache_id").errors);
	if (record.schema_version !== "flowdesk.exact_model_availability_cache.v1")
		errors.push("availability cache schema_version is invalid");
	if (typeof record.local_date !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(record.local_date))
		errors.push("local_date must be YYYY-MM-DD");
	for (const [value, label] of [
		[record.active_profile_ref, "active_profile_ref"],
		[record.opencode_version_ref, "opencode_version_ref"],
		[record.flowdesk_package_version_ref, "flowdesk_package_version_ref"],
		[record.auth_account_boundary_ref, "auth_account_boundary_ref"],
	] as const)
		errors.push(...validateOpaqueRef(value, label).errors);
	errors.push(...validateHash(record.registry_hash, "registry_hash").errors);
	errors.push(...validateHash(record.policy_pack_hash, "policy_pack_hash").errors);
	if (!Array.isArray(record.entries) || record.entries.length === 0)
		errors.push("availability cache entries must be non-empty");
	else
		for (const [index, entry] of record.entries.entries()) {
			if (!isRecord(entry)) {
				errors.push(`entries[${index}] must be an object`);
				continue;
			}
			errors.push(...rejectUnknownProperties(entry, [
				"entry_id",
				"provider_family",
				"provider_identity_ref",
				"provider_qualified_model_id",
				"model_family",
				"registered",
				"available",
				"highest_tier_eligible",
				"availability_ref",
			], `entries[${index}]`).errors);
			errors.push(...validateOpaqueId(entry.entry_id, `entries[${index}].entry_id`).errors);
			errors.push(...validateProviderFamily(entry.provider_family).errors.map((error) => `entries[${index}].${error}`));
			if (!(FLOWDESK_EXACT_MODEL_PROVIDER_FAMILIES as readonly string[]).includes(entry.provider_family))
				errors.push(`entries[${index}].provider_family is not exact-model eligible`);
			errors.push(...validateOpaqueRef(entry.provider_identity_ref, `entries[${index}].provider_identity_ref`).errors);
			errors.push(...validateConcreteProviderQualifiedModelId(entry.provider_qualified_model_id).errors);
			if (typeof entry.provider_qualified_model_id === "string" && typeof entry.provider_family === "string") {
				const provider = entry.provider_qualified_model_id.split("/")[0];
				if (provider !== entry.provider_family) errors.push(`entries[${index}].provider_family must match provider_qualified_model_id`);
			}
			errors.push(...validateOpaqueId(entry.model_family, `entries[${index}].model_family`).errors);
			for (const key of ["registered", "available", "highest_tier_eligible"] as const)
				if (typeof entry[key] !== "boolean") errors.push(`entries[${index}].${key} must be boolean`);
			errors.push(...validateOpaqueRef(entry.availability_ref, `entries[${index}].availability_ref`).errors);
		}
	if (
		record.dispatch_authority_enabled !== false ||
		record.providerCall !== false ||
		record.actualLaneLaunch !== false ||
		record.runtimeExecution !== false
	)
		errors.push("availability cache cannot enable runtime authority");
	errors.push(...validateNoForbiddenRawPayloads(record, "exact_model_availability_cache").errors);
	return errors.length === 0 ? valid() : invalid(...errors);
}

export function planFlowDeskReviewerAssignmentsV1(input: {
	cache: FlowDeskExactModelAvailabilityCacheV1;
	localDate: string;
}): FlowDeskReviewerAssignmentPlanV1 {
	const errors = validateFlowDeskExactModelAvailabilityCacheV1(input.cache).errors;
	const blockedLabels: string[] = [];
	if (errors.length > 0) blockedLabels.push("cache_invalid");
	if (input.cache.local_date !== input.localDate) blockedLabels.push("cache_not_same_day");
	const eligible = input.cache.entries.filter((entry) => entry.registered && entry.available && entry.highest_tier_eligible);
	if (eligible.length === 0) blockedLabels.push("no_registered_available_highest_tier_models");
	const canBind = errors.length === 0 && blockedLabels.length === 0;
	const lane_bindings = !canBind ? [] : perspectives.map((perspective, index) => {
		const entry = eligible[index % eligible.length];
		return { perspective, entry_id: entry.entry_id, provider_qualified_model_id: entry.provider_qualified_model_id };
	});
	const ready = canBind;
	return {
		schema_version: "flowdesk.reviewer_assignment_plan.v1",
		cache_id: input.cache.cache_id,
		ok: errors.length === 0,
		errors,
		state: ready ? "ready" : "blocked",
		lane_bindings,
		blocked_labels: blockedLabels,
		dispatch_authority_enabled: false,
		providerCall: false,
		actualLaneLaunch: false,
		runtimeExecution: false,
	};
}
