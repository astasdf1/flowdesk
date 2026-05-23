import type { FlowDeskTopTierReviewPerspective } from "./release1-contracts.js";
import type { FlowDeskRuntimeLaneLaunchRequestV1 } from "./runtime-lane-productization.js";
import { validateFlowDeskRuntimeLaneLaunchRequestV1 } from "./runtime-lane-productization.js";
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

export interface FlowDeskExactModelAvailabilityCacheRefreshPlanV1 extends ValidationResult {
	schema_version: "flowdesk.exact_model_availability_cache_refresh_plan.v1";
	state: "cache_hit" | "refresh_required" | "blocked";
	blocked_labels: string[];
	refresh_reason_labels: string[];
	expected_local_date: string;
	expected_active_profile_ref: string;
	expected_opencode_version_ref: string;
	expected_flowdesk_package_version_ref: string;
	expected_registry_hash: string;
	expected_policy_pack_hash: string;
	expected_auth_account_boundary_ref: string;
	cache_id?: string;
	cache_local_date?: string;
	cache_active_profile_ref?: string;
	cache_opencode_version_ref?: string;
	cache_flowdesk_package_version_ref?: string;
	cache_registry_hash?: string;
	cache_policy_pack_hash?: string;
	cache_auth_account_boundary_ref?: string;
	discovery_required: boolean;
	refresh_required: boolean;
	cache_usable_for_assignment: boolean;
	discovery_attempted: false;
	refresh_attempted: false;
	dispatch_authority_enabled: false;
	providerCall: false;
	actualLaneLaunch: false;
	runtimeExecution: false;
}

export interface FlowDeskExactModelAvailabilityCacheAcquisitionPlanV1 extends ValidationResult {
	schema_version: "flowdesk.exact_model_availability_cache_acquisition_plan.v1";
	state: "acquisition_not_needed" | "acquisition_planned" | "blocked";
	blocked_labels: string[];
	acquisition_reason_labels: string[];
	refresh_plan_ok: boolean;
	refresh_plan_state: "cache_hit" | "refresh_required" | "blocked" | "invalid";
	refresh_plan_cache_id?: string;
	acquisition_required: boolean;
	cache_usable_for_assignment: boolean;
	acquisition_attempted: false;
	discovery_attempted: false;
	refresh_attempted: false;
	dispatch_authority_enabled: false;
	providerCall: false;
	actualLaneLaunch: false;
	runtimeExecution: false;
}

export interface FlowDeskExactModelAvailabilityCacheProviderAcquisitionResultV1 extends ValidationResult {
	schema_version: "flowdesk.exact_model_availability_cache_provider_acquisition_result.v1";
	result_id: string;
	state: "availability_acquired" | "blocked";
	blocked_labels: string[];
	acquisition_plan_ok: boolean;
	acquisition_plan_state: "acquisition_not_needed" | "acquisition_planned" | "blocked" | "invalid";
	local_date: string;
	active_profile_ref: string;
	opencode_version_ref: string;
	flowdesk_package_version_ref: string;
	registry_hash: string;
	policy_pack_hash: string;
	auth_account_boundary_ref: string;
	provider_family: "claude" | "openai" | "gemini" | "opencode_go" | "z_ai";
	provider_identity_ref: string;
	provider_qualified_model_id: string;
	model_family: string;
	availability_ref: string;
	pre_call_audit_ref: string;
	idempotency_ref: string;
	live_test_run_ref: string;
	redaction_proof_ref: string;
	sanitized_provider_result_ref?: string;
	observed_at: string;
	available: boolean;
	highest_tier_eligible: boolean;
	acquisition_attempted: boolean;
	discovery_attempted: boolean;
	refresh_attempted: false;
	dispatch_authority_enabled: false;
	providerCall: boolean;
	actualLaneLaunch: false;
	runtimeExecution: false;
}

export interface FlowDeskExactModelAvailabilityCacheMaterializationContextV1 {
	localDate?: string;
	activeProfileRef?: string;
	opencodeVersionRef?: string;
	flowdeskPackageVersionRef?: string;
	registryHash?: string;
	policyPackHash?: string;
	authAccountBoundaryRef?: string;
}

export interface FlowDeskExactModelAvailabilityCacheMaterializationResultV1 extends ValidationResult {
	state: "cache_materialized" | "blocked";
	blocked_labels: string[];
	cache?: FlowDeskExactModelAvailabilityCacheV1;
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

export interface FlowDeskReviewerAssignmentRevalidationV1 extends ValidationResult {
	schema_version: "flowdesk.reviewer_assignment_revalidation.v1";
	cache_id?: string;
	state: "revalidated" | "blocked";
	blocked_labels: string[];
	expected_local_date: string;
	expected_active_profile_ref: string;
	expected_opencode_version_ref: string;
	expected_flowdesk_package_version_ref: string;
	expected_registry_hash: string;
	expected_policy_pack_hash: string;
	expected_auth_account_boundary_ref: string;
	cache_local_date?: string;
	cache_active_profile_ref?: string;
	cache_opencode_version_ref?: string;
	cache_flowdesk_package_version_ref?: string;
	cache_registry_hash?: string;
	cache_policy_pack_hash?: string;
	cache_auth_account_boundary_ref?: string;
	eligible_bindings: Array<{
		entry_id: string;
		provider_qualified_model_id: string;
	}>;
	dispatch_authority_enabled: false;
	providerCall: false;
	actualLaneLaunch: false;
	runtimeExecution: false;
}

export interface FlowDeskReviewerFanoutPlanV1 extends ValidationResult {
	schema_version: "flowdesk.reviewer_fanout_plan.v1";
	workflow_id: string;
	attempt_id: string;
	cache_id?: string;
	state: "fanout_ready" | "blocked";
	blocked_labels: string[];
	required_perspectives: FlowDeskTopTierReviewPerspective[];
	planned_perspectives: FlowDeskTopTierReviewPerspective[];
	runtime_lane_launch_requests: FlowDeskRuntimeLaneLaunchRequestV1[];
	max_concurrent_lane_count: number;
	runtime_launch_plan_required: true;
	lane_launch_approval_required: true;
	launch_attempted: false;
	approval_inferred: false;
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

const disabledReviewerRuntimeAuthority = {
	dispatch_authority_enabled: false as const,
	providerCall: false as const,
	actualLaneLaunch: false as const,
	runtimeExecution: false as const,
};

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

function validateLocalDate(value: unknown, label: string): ValidationResult {
	return typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value)
		? valid()
		: invalid(`${label} must be YYYY-MM-DD`);
}

function validateTimestamp(value: unknown, label: string): ValidationResult {
	return typeof value === "string" && Number.isFinite(Date.parse(value))
		? valid()
		: invalid(`${label} must be a parseable timestamp`);
}

function unique(values: string[]): string[] {
	return [...new Set(values)];
}

function eligibleEntries(cache: FlowDeskExactModelAvailabilityCacheV1): FlowDeskExactModelAvailabilityEntryV1[] {
	return cache.entries
		.filter((entry) => entry.registered && entry.available && entry.highest_tier_eligible)
		.sort((left, right) => {
			const leftKey = `${left.provider_family}/${left.provider_qualified_model_id}/${left.entry_id}`;
			const rightKey = `${right.provider_family}/${right.provider_qualified_model_id}/${right.entry_id}`;
			return leftKey.localeCompare(rightKey);
		});
}

function validatePerspectiveArray(value: unknown, label: string): ValidationResult {
	if (!Array.isArray(value) || value.length === 0) return invalid(`${label} must be a non-empty array`);
	const errors: string[] = [];
	for (const [index, perspective] of value.entries())
		if (!perspectives.includes(perspective)) errors.push(`${label}[${index}] is invalid`);
	if (new Set(value).size !== value.length) errors.push(`${label} must not contain duplicate perspectives`);
	return errors.length === 0 ? valid() : invalid(...errors);
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

export function planFlowDeskExactModelAvailabilityCacheRefreshV1(input: {
	cache?: FlowDeskExactModelAvailabilityCacheV1;
	localDate: string;
	activeProfileRef: string;
	opencodeVersionRef: string;
	flowdeskPackageVersionRef: string;
	registryHash: string;
	policyPackHash: string;
	authAccountBoundaryRef: string;
}): FlowDeskExactModelAvailabilityCacheRefreshPlanV1 {
	const errors: string[] = [];
	const blockedLabels: string[] = [];
	const refreshReasonLabels: string[] = [];
	errors.push(...validateLocalDate(input.localDate, "expected_local_date").errors);
	errors.push(...validateOpaqueRef(input.activeProfileRef, "expected_active_profile_ref").errors);
	errors.push(...validateOpaqueRef(input.opencodeVersionRef, "expected_opencode_version_ref").errors);
	errors.push(...validateOpaqueRef(input.flowdeskPackageVersionRef, "expected_flowdesk_package_version_ref").errors);
	errors.push(...validateHash(input.registryHash, "expected_registry_hash").errors);
	errors.push(...validateHash(input.policyPackHash, "expected_policy_pack_hash").errors);
	errors.push(...validateOpaqueRef(input.authAccountBoundaryRef, "expected_auth_account_boundary_ref").errors);
	const cacheResult = input.cache === undefined ? valid() : validateFlowDeskExactModelAvailabilityCacheV1(input.cache);
	if (!cacheResult.ok) {
		errors.push(...cacheResult.errors);
		blockedLabels.push("cache_invalid");
	} else if (input.cache === undefined) refreshReasonLabels.push("cache_missing");
	else {
		if (input.cache.local_date !== input.localDate) refreshReasonLabels.push("cache_not_same_day");
		if (input.cache.active_profile_ref !== input.activeProfileRef) refreshReasonLabels.push("active_profile_changed");
		if (input.cache.opencode_version_ref !== input.opencodeVersionRef) refreshReasonLabels.push("opencode_version_changed");
		if (input.cache.flowdesk_package_version_ref !== input.flowdeskPackageVersionRef)
			refreshReasonLabels.push("flowdesk_package_version_changed");
		if (input.cache.registry_hash !== input.registryHash) refreshReasonLabels.push("registry_hash_changed");
		if (input.cache.policy_pack_hash !== input.policyPackHash) refreshReasonLabels.push("policy_pack_hash_changed");
		if (input.cache.auth_account_boundary_ref !== input.authAccountBoundaryRef)
			refreshReasonLabels.push("auth_account_boundary_changed");
	}
	if (errors.length > 0 && blockedLabels.length === 0) blockedLabels.push("refresh_context_invalid");
	const hasRefreshReasons = refreshReasonLabels.length > 0;
	const state = blockedLabels.length > 0 ? "blocked" : hasRefreshReasons ? "refresh_required" : "cache_hit";
	return {
		schema_version: "flowdesk.exact_model_availability_cache_refresh_plan.v1",
		ok: errors.length === 0,
		errors,
		state,
		blocked_labels: unique(blockedLabels),
		refresh_reason_labels: unique(refreshReasonLabels),
		expected_local_date: input.localDate,
		expected_active_profile_ref: input.activeProfileRef,
		expected_opencode_version_ref: input.opencodeVersionRef,
		expected_flowdesk_package_version_ref: input.flowdeskPackageVersionRef,
		expected_registry_hash: input.registryHash,
		expected_policy_pack_hash: input.policyPackHash,
		expected_auth_account_boundary_ref: input.authAccountBoundaryRef,
		cache_id: input.cache?.cache_id,
		cache_local_date: input.cache?.local_date,
		cache_active_profile_ref: input.cache?.active_profile_ref,
		cache_opencode_version_ref: input.cache?.opencode_version_ref,
		cache_flowdesk_package_version_ref: input.cache?.flowdesk_package_version_ref,
		cache_registry_hash: input.cache?.registry_hash,
		cache_policy_pack_hash: input.cache?.policy_pack_hash,
		cache_auth_account_boundary_ref: input.cache?.auth_account_boundary_ref,
		discovery_required: state !== "cache_hit",
		refresh_required: state === "refresh_required",
		cache_usable_for_assignment: state === "cache_hit",
		discovery_attempted: false,
		refresh_attempted: false,
		...disabledReviewerRuntimeAuthority,
	};
}

export function validateFlowDeskExactModelAvailabilityCacheRefreshPlanV1(value: unknown): ValidationResult {
	if (!isRecord(value)) return invalid("exact model availability cache refresh plan must be an object");
	const record = value as Partial<FlowDeskExactModelAvailabilityCacheRefreshPlanV1>;
	const errors: string[] = [];
	errors.push(...rejectUnknownProperties(record, [
		"schema_version",
		"ok",
		"errors",
		"state",
		"blocked_labels",
		"refresh_reason_labels",
		"expected_local_date",
		"expected_active_profile_ref",
		"expected_opencode_version_ref",
		"expected_flowdesk_package_version_ref",
		"expected_registry_hash",
		"expected_policy_pack_hash",
		"expected_auth_account_boundary_ref",
		"cache_id",
		"cache_local_date",
		"cache_active_profile_ref",
		"cache_opencode_version_ref",
		"cache_flowdesk_package_version_ref",
		"cache_registry_hash",
		"cache_policy_pack_hash",
		"cache_auth_account_boundary_ref",
		"discovery_required",
		"refresh_required",
		"cache_usable_for_assignment",
		"discovery_attempted",
		"refresh_attempted",
		"dispatch_authority_enabled",
		"providerCall",
		"actualLaneLaunch",
		"runtimeExecution",
	], "availability cache refresh plan").errors);
	if (record.schema_version !== "flowdesk.exact_model_availability_cache_refresh_plan.v1")
		errors.push("availability cache refresh plan schema_version is invalid");
	if (record.state !== "cache_hit" && record.state !== "refresh_required" && record.state !== "blocked")
		errors.push("availability cache refresh plan state is invalid");
	for (const [value, label] of [[record.blocked_labels, "blocked_labels"], [record.refresh_reason_labels, "refresh_reason_labels"]] as const) {
		if (!Array.isArray(value)) errors.push(`${label} must be an array`);
		else for (const [index, item] of value.entries()) errors.push(...validateOpaqueId(item, `${label}[${index}]`).errors);
	}
	if (record.state === "cache_hit" && ((record.blocked_labels?.length ?? 0) > 0 || (record.refresh_reason_labels?.length ?? 0) > 0))
		errors.push("cache_hit refresh plan cannot carry blockers or refresh reasons");
	if (record.state === "refresh_required" && (record.refresh_reason_labels?.length ?? 0) === 0)
		errors.push("refresh_required plan requires refresh reasons");
	if (record.state === "blocked" && (record.blocked_labels?.length ?? 0) === 0)
		errors.push("blocked refresh plan requires blocked labels");
	errors.push(...validateLocalDate(record.expected_local_date, "expected_local_date").errors);
	errors.push(...validateHash(record.expected_registry_hash, "expected_registry_hash").errors);
	errors.push(...validateHash(record.expected_policy_pack_hash, "expected_policy_pack_hash").errors);
	for (const [field, label] of [
		[record.expected_active_profile_ref, "expected_active_profile_ref"],
		[record.expected_opencode_version_ref, "expected_opencode_version_ref"],
		[record.expected_flowdesk_package_version_ref, "expected_flowdesk_package_version_ref"],
		[record.expected_auth_account_boundary_ref, "expected_auth_account_boundary_ref"],
		[record.cache_active_profile_ref, "cache_active_profile_ref"],
		[record.cache_opencode_version_ref, "cache_opencode_version_ref"],
		[record.cache_flowdesk_package_version_ref, "cache_flowdesk_package_version_ref"],
		[record.cache_auth_account_boundary_ref, "cache_auth_account_boundary_ref"],
	] as const)
		if (field !== undefined) errors.push(...validateOpaqueRef(field, label).errors);
	if (record.cache_id !== undefined) errors.push(...validateOpaqueId(record.cache_id, "cache_id").errors);
	if (record.cache_local_date !== undefined) errors.push(...validateLocalDate(record.cache_local_date, "cache_local_date").errors);
	if (record.cache_registry_hash !== undefined) errors.push(...validateHash(record.cache_registry_hash, "cache_registry_hash").errors);
	if (record.cache_policy_pack_hash !== undefined) errors.push(...validateHash(record.cache_policy_pack_hash, "cache_policy_pack_hash").errors);
	if (record.discovery_required !== (record.state !== "cache_hit")) errors.push("discovery_required must match non-cache-hit state");
	if (record.refresh_required !== (record.state === "refresh_required")) errors.push("refresh_required must match refresh_required state");
	if (record.cache_usable_for_assignment !== (record.state === "cache_hit")) errors.push("cache_usable_for_assignment must match cache_hit state");
	if (
		record.discovery_attempted !== false ||
		record.refresh_attempted !== false ||
		record.dispatch_authority_enabled !== false ||
		record.providerCall !== false ||
		record.actualLaneLaunch !== false ||
		record.runtimeExecution !== false
	)
		errors.push("availability cache refresh plan cannot attempt discovery, refresh, launch, provider call, or runtime authority");
	errors.push(...validateNoForbiddenRawPayloads(record, "exact_model_availability_cache_refresh_plan").errors);
	return errors.length === 0 ? valid() : invalid(...errors);
}

export function planFlowDeskExactModelAvailabilityCacheAcquisitionV1(input: {
	refreshPlan: FlowDeskExactModelAvailabilityCacheRefreshPlanV1;
}): FlowDeskExactModelAvailabilityCacheAcquisitionPlanV1 {
	const refreshResult = validateFlowDeskExactModelAvailabilityCacheRefreshPlanV1(input.refreshPlan);
	const errors = refreshResult.errors.map((error) => `refresh_plan: ${error}`);
	const blockedLabels: string[] = [];
	const acquisitionReasonLabels: string[] = [];
	let refreshPlanState: FlowDeskExactModelAvailabilityCacheAcquisitionPlanV1["refresh_plan_state"] = "invalid";
	if (!refreshResult.ok) blockedLabels.push("refresh_plan_invalid");
	else {
		refreshPlanState = input.refreshPlan.state;
		if (input.refreshPlan.state === "blocked") blockedLabels.push("refresh_plan_blocked");
		if (input.refreshPlan.state === "refresh_required") acquisitionReasonLabels.push(...input.refreshPlan.refresh_reason_labels);
	}
	const state = !refreshResult.ok || blockedLabels.length > 0
		? "blocked"
		: input.refreshPlan.state === "cache_hit"
			? "acquisition_not_needed"
			: "acquisition_planned";
	return {
		schema_version: "flowdesk.exact_model_availability_cache_acquisition_plan.v1",
		ok: errors.length === 0,
		errors,
		state,
		blocked_labels: unique(blockedLabels),
		acquisition_reason_labels: state === "acquisition_planned" ? unique(acquisitionReasonLabels) : [],
		refresh_plan_ok: refreshResult.ok,
		refresh_plan_state: refreshPlanState,
		refresh_plan_cache_id: refreshResult.ok ? input.refreshPlan.cache_id : undefined,
		acquisition_required: state === "acquisition_planned",
		cache_usable_for_assignment: state === "acquisition_not_needed",
		acquisition_attempted: false,
		discovery_attempted: false,
		refresh_attempted: false,
		...disabledReviewerRuntimeAuthority,
	};
}

export function validateFlowDeskExactModelAvailabilityCacheAcquisitionPlanV1(value: unknown): ValidationResult {
	if (!isRecord(value)) return invalid("exact model availability cache acquisition plan must be an object");
	const record = value as Partial<FlowDeskExactModelAvailabilityCacheAcquisitionPlanV1>;
	const errors: string[] = [];
	errors.push(...rejectUnknownProperties(record, [
		"schema_version",
		"ok",
		"errors",
		"state",
		"blocked_labels",
		"acquisition_reason_labels",
		"refresh_plan_ok",
		"refresh_plan_state",
		"refresh_plan_cache_id",
		"acquisition_required",
		"cache_usable_for_assignment",
		"acquisition_attempted",
		"discovery_attempted",
		"refresh_attempted",
		"dispatch_authority_enabled",
		"providerCall",
		"actualLaneLaunch",
		"runtimeExecution",
	], "availability cache acquisition plan").errors);
	if (record.schema_version !== "flowdesk.exact_model_availability_cache_acquisition_plan.v1")
		errors.push("availability cache acquisition plan schema_version is invalid");
	if (record.state !== "acquisition_not_needed" && record.state !== "acquisition_planned" && record.state !== "blocked")
		errors.push("availability cache acquisition plan state is invalid");
	for (const [value, label] of [[record.blocked_labels, "blocked_labels"], [record.acquisition_reason_labels, "acquisition_reason_labels"]] as const) {
		if (!Array.isArray(value)) errors.push(`${label} must be an array`);
		else for (const [index, item] of value.entries()) errors.push(...validateOpaqueId(item, `${label}[${index}]`).errors);
	}
	if (typeof record.refresh_plan_ok !== "boolean") errors.push("refresh_plan_ok must be boolean");
	if (
		record.refresh_plan_state !== "cache_hit" &&
		record.refresh_plan_state !== "refresh_required" &&
		record.refresh_plan_state !== "blocked" &&
		record.refresh_plan_state !== "invalid"
	)
		errors.push("refresh_plan_state is invalid");
	if (record.refresh_plan_cache_id !== undefined)
		errors.push(...validateOpaqueId(record.refresh_plan_cache_id, "refresh_plan_cache_id").errors);
	if (record.refresh_plan_state === "invalid" && record.refresh_plan_ok !== false)
		errors.push("invalid refresh plan state must report refresh_plan_ok false");
	if (record.refresh_plan_state !== "invalid" && record.refresh_plan_ok !== true)
		errors.push("non-invalid refresh plan state must report refresh_plan_ok true");
	if (
		record.state === "acquisition_not_needed" &&
		((record.blocked_labels?.length ?? 0) > 0 || (record.acquisition_reason_labels?.length ?? 0) > 0)
	)
		errors.push("acquisition_not_needed plan cannot carry blockers or acquisition reasons");
	if (record.state === "acquisition_not_needed" && record.refresh_plan_state !== "cache_hit")
		errors.push("acquisition_not_needed plan requires cache_hit refresh plan state");
	if (record.state === "acquisition_planned" && (record.acquisition_reason_labels?.length ?? 0) === 0)
		errors.push("acquisition_planned plan requires acquisition reasons");
	if (record.state === "acquisition_planned" && (record.blocked_labels?.length ?? 0) > 0)
		errors.push("acquisition_planned plan cannot carry blockers");
	if (record.state === "acquisition_planned" && record.refresh_plan_state !== "refresh_required")
		errors.push("acquisition_planned plan requires refresh_required refresh plan state");
	if (record.state === "blocked" && (record.blocked_labels?.length ?? 0) === 0)
		errors.push("blocked acquisition plan requires blocked labels");
	if (record.state === "blocked" && (record.acquisition_reason_labels?.length ?? 0) > 0)
		errors.push("blocked acquisition plan cannot carry acquisition reasons");
	if (
		record.state === "blocked" &&
		record.refresh_plan_state !== "blocked" &&
		record.refresh_plan_state !== "invalid"
	)
		errors.push("blocked acquisition plan requires blocked or invalid refresh plan state");
	if (record.acquisition_required !== (record.state === "acquisition_planned"))
		errors.push("acquisition_required must match acquisition_planned state");
	if (record.cache_usable_for_assignment !== (record.state === "acquisition_not_needed"))
		errors.push("cache_usable_for_assignment must match acquisition_not_needed state");
	if (
		record.acquisition_attempted !== false ||
		record.discovery_attempted !== false ||
		record.refresh_attempted !== false ||
		record.dispatch_authority_enabled !== false ||
		record.providerCall !== false ||
		record.actualLaneLaunch !== false ||
		record.runtimeExecution !== false
	)
		errors.push("availability cache acquisition plan cannot attempt discovery, refresh, acquisition, launch, provider call, or runtime authority");
	errors.push(...validateNoForbiddenRawPayloads(record, "exact_model_availability_cache_acquisition_plan").errors);
	return errors.length === 0 ? valid() : invalid(...errors);
}

export function recordFlowDeskExactModelAvailabilityCacheProviderAcquisitionResultV1(input: {
	acquisitionPlan: FlowDeskExactModelAvailabilityCacheAcquisitionPlanV1;
	resultId: string;
	localDate: string;
	activeProfileRef: string;
	opencodeVersionRef: string;
	flowdeskPackageVersionRef: string;
	registryHash: string;
	policyPackHash: string;
	authAccountBoundaryRef: string;
	providerFamily: FlowDeskExactModelAvailabilityCacheProviderAcquisitionResultV1["provider_family"];
	providerIdentityRef: string;
	providerQualifiedModelId: string;
	modelFamily: string;
	availabilityRef: string;
	preCallAuditRef: string;
	idempotencyRef: string;
	liveTestRunRef: string;
	redactionProofRef: string;
	sanitizedProviderResultRef?: string;
	observedAt: string;
	outcome: "available" | "unavailable" | "blocked";
	highestTierEligible?: boolean;
	blockedLabels?: string[];
	providerCall?: boolean;
}): FlowDeskExactModelAvailabilityCacheProviderAcquisitionResultV1 {
	const planResult = validateFlowDeskExactModelAvailabilityCacheAcquisitionPlanV1(input.acquisitionPlan);
	const inputErrors: string[] = [];
	inputErrors.push(...validateOpaqueId(input.resultId, "result_id").errors);
	inputErrors.push(...validateLocalDate(input.localDate, "local_date").errors);
	inputErrors.push(...validateOpaqueRef(input.activeProfileRef, "active_profile_ref").errors);
	inputErrors.push(...validateOpaqueRef(input.opencodeVersionRef, "opencode_version_ref").errors);
	inputErrors.push(...validateOpaqueRef(input.flowdeskPackageVersionRef, "flowdesk_package_version_ref").errors);
	inputErrors.push(...validateHash(input.registryHash, "registry_hash").errors);
	inputErrors.push(...validateHash(input.policyPackHash, "policy_pack_hash").errors);
	inputErrors.push(...validateOpaqueRef(input.authAccountBoundaryRef, "auth_account_boundary_ref").errors);
	inputErrors.push(...validateProviderFamily(input.providerFamily).errors);
	if (!(FLOWDESK_EXACT_MODEL_PROVIDER_FAMILIES as readonly string[]).includes(input.providerFamily))
		inputErrors.push("provider_family is not exact-model eligible");
	inputErrors.push(...validateOpaqueRef(input.providerIdentityRef, "provider_identity_ref").errors);
	inputErrors.push(...validateConcreteProviderQualifiedModelId(input.providerQualifiedModelId).errors);
	if (input.providerQualifiedModelId.split("/")[0] !== input.providerFamily)
		inputErrors.push("provider_family must match provider_qualified_model_id");
	inputErrors.push(...validateOpaqueId(input.modelFamily, "model_family").errors);
	inputErrors.push(...validateOpaqueRef(input.availabilityRef, "availability_ref").errors);
	inputErrors.push(...validateOpaqueRef(input.preCallAuditRef, "pre_call_audit_ref").errors);
	inputErrors.push(...validateOpaqueRef(input.idempotencyRef, "idempotency_ref").errors);
	inputErrors.push(...validateOpaqueRef(input.liveTestRunRef, "live_test_run_ref").errors);
	inputErrors.push(...validateOpaqueRef(input.redactionProofRef, "redaction_proof_ref").errors);
	if (input.sanitizedProviderResultRef !== undefined)
		inputErrors.push(...validateOpaqueRef(input.sanitizedProviderResultRef, "sanitized_provider_result_ref").errors);
	inputErrors.push(...validateTimestamp(input.observedAt, "observed_at").errors);
	if (input.blockedLabels !== undefined)
		for (const [index, label] of input.blockedLabels.entries())
			inputErrors.push(...validateOpaqueId(label, `blocked_labels[${index}]`).errors);

	const blockedLabels = [...(input.blockedLabels ?? [])];
	let acquisitionPlanState: FlowDeskExactModelAvailabilityCacheProviderAcquisitionResultV1["acquisition_plan_state"] = "invalid";
	if (!planResult.ok) blockedLabels.push("acquisition_plan_invalid");
	else {
		acquisitionPlanState = input.acquisitionPlan.state;
		if (input.acquisitionPlan.state !== "acquisition_planned") blockedLabels.push("acquisition_plan_not_planned");
	}
	if (inputErrors.length > 0) blockedLabels.push("provider_acquisition_context_invalid");
	if (input.outcome === "blocked" && blockedLabels.length === 0) blockedLabels.push("provider_acquisition_blocked");

	const planAllowsProviderCall = planResult.ok && input.acquisitionPlan.state === "acquisition_planned" && inputErrors.length === 0;
	const acquisitionAttempted = planAllowsProviderCall && (input.outcome !== "blocked" || input.providerCall === true);
	const providerCall = input.providerCall === false
		? false
		: acquisitionAttempted || (input.providerCall === true && planAllowsProviderCall);
	const state = planAllowsProviderCall && input.outcome !== "blocked" ? "availability_acquired" : "blocked";
	const available = state === "availability_acquired" && input.outcome === "available";

	const record: FlowDeskExactModelAvailabilityCacheProviderAcquisitionResultV1 = {
		schema_version: "flowdesk.exact_model_availability_cache_provider_acquisition_result.v1",
		ok: planResult.ok && inputErrors.length === 0 && blockedLabels.length === 0,
		errors: [...planResult.errors.map((error) => `acquisition_plan: ${error}`), ...inputErrors],
		result_id: input.resultId,
		state,
		blocked_labels: unique(blockedLabels),
		acquisition_plan_ok: planResult.ok,
		acquisition_plan_state: acquisitionPlanState,
		local_date: input.localDate,
		active_profile_ref: input.activeProfileRef,
		opencode_version_ref: input.opencodeVersionRef,
		flowdesk_package_version_ref: input.flowdeskPackageVersionRef,
		registry_hash: input.registryHash,
		policy_pack_hash: input.policyPackHash,
		auth_account_boundary_ref: input.authAccountBoundaryRef,
		provider_family: input.providerFamily,
		provider_identity_ref: input.providerIdentityRef,
		provider_qualified_model_id: input.providerQualifiedModelId,
		model_family: input.modelFamily,
		availability_ref: input.availabilityRef,
		pre_call_audit_ref: input.preCallAuditRef,
		idempotency_ref: input.idempotencyRef,
		live_test_run_ref: input.liveTestRunRef,
		redaction_proof_ref: input.redactionProofRef,
		sanitized_provider_result_ref: input.sanitizedProviderResultRef,
		observed_at: input.observedAt,
		available,
		highest_tier_eligible: available && input.highestTierEligible === true,
		acquisition_attempted: acquisitionAttempted,
		discovery_attempted: acquisitionAttempted,
		refresh_attempted: false,
		dispatch_authority_enabled: false,
		providerCall,
		actualLaneLaunch: false,
		runtimeExecution: false,
	};
	const validation = validateFlowDeskExactModelAvailabilityCacheProviderAcquisitionResultV1(record);
	return validation.ok ? record : { ...record, ok: false, errors: unique([...record.errors, ...validation.errors]) };
}

export function validateFlowDeskExactModelAvailabilityCacheProviderAcquisitionResultV1(value: unknown): ValidationResult {
	if (!isRecord(value)) return invalid("exact model availability cache provider acquisition result must be an object");
	const record = value as Partial<FlowDeskExactModelAvailabilityCacheProviderAcquisitionResultV1>;
	const errors: string[] = [];
	errors.push(...rejectUnknownProperties(record, [
		"schema_version",
		"ok",
		"errors",
		"result_id",
		"state",
		"blocked_labels",
		"acquisition_plan_ok",
		"acquisition_plan_state",
		"local_date",
		"active_profile_ref",
		"opencode_version_ref",
		"flowdesk_package_version_ref",
		"registry_hash",
		"policy_pack_hash",
		"auth_account_boundary_ref",
		"provider_family",
		"provider_identity_ref",
		"provider_qualified_model_id",
		"model_family",
		"availability_ref",
		"pre_call_audit_ref",
		"idempotency_ref",
		"live_test_run_ref",
		"redaction_proof_ref",
		"sanitized_provider_result_ref",
		"observed_at",
		"available",
		"highest_tier_eligible",
		"acquisition_attempted",
		"discovery_attempted",
		"refresh_attempted",
		"dispatch_authority_enabled",
		"providerCall",
		"actualLaneLaunch",
		"runtimeExecution",
	], "availability cache provider acquisition result").errors);
	if (record.schema_version !== "flowdesk.exact_model_availability_cache_provider_acquisition_result.v1")
		errors.push("availability cache provider acquisition result schema_version is invalid");
	if (record.state !== "availability_acquired" && record.state !== "blocked")
		errors.push("availability cache provider acquisition result state is invalid");
	if (!Array.isArray(record.blocked_labels)) errors.push("blocked_labels must be an array");
	else for (const [index, label] of record.blocked_labels.entries())
		errors.push(...validateOpaqueId(label, `blocked_labels[${index}]`).errors);
	if (typeof record.acquisition_plan_ok !== "boolean") errors.push("acquisition_plan_ok must be boolean");
	if (
		record.acquisition_plan_state !== "acquisition_not_needed" &&
		record.acquisition_plan_state !== "acquisition_planned" &&
		record.acquisition_plan_state !== "blocked" &&
		record.acquisition_plan_state !== "invalid"
	)
		errors.push("acquisition_plan_state is invalid");
	if (record.acquisition_plan_state === "invalid" && record.acquisition_plan_ok !== false)
		errors.push("invalid acquisition plan state must report acquisition_plan_ok false");
	if (record.acquisition_plan_state !== "invalid" && record.acquisition_plan_ok !== true)
		errors.push("non-invalid acquisition plan state must report acquisition_plan_ok true");
	for (const [value, label] of [
		[record.result_id, "result_id"],
		[record.model_family, "model_family"],
	] as const)
		errors.push(...validateOpaqueId(value, label).errors);
	errors.push(...validateLocalDate(record.local_date, "local_date").errors);
	for (const [value, label] of [
		[record.active_profile_ref, "active_profile_ref"],
		[record.opencode_version_ref, "opencode_version_ref"],
		[record.flowdesk_package_version_ref, "flowdesk_package_version_ref"],
		[record.auth_account_boundary_ref, "auth_account_boundary_ref"],
		[record.provider_identity_ref, "provider_identity_ref"],
		[record.availability_ref, "availability_ref"],
		[record.pre_call_audit_ref, "pre_call_audit_ref"],
		[record.idempotency_ref, "idempotency_ref"],
		[record.live_test_run_ref, "live_test_run_ref"],
		[record.redaction_proof_ref, "redaction_proof_ref"],
		[record.sanitized_provider_result_ref, "sanitized_provider_result_ref"],
	] as const)
		if (value !== undefined) errors.push(...validateOpaqueRef(value, label).errors);
	errors.push(...validateHash(record.registry_hash, "registry_hash").errors);
	errors.push(...validateHash(record.policy_pack_hash, "policy_pack_hash").errors);
	errors.push(...validateProviderFamily(record.provider_family).errors);
	if (typeof record.provider_family === "string" && !(FLOWDESK_EXACT_MODEL_PROVIDER_FAMILIES as readonly string[]).includes(record.provider_family))
		errors.push("provider_family is not exact-model eligible");
	errors.push(...validateConcreteProviderQualifiedModelId(record.provider_qualified_model_id).errors);
	if (typeof record.provider_qualified_model_id === "string" && typeof record.provider_family === "string") {
		const provider = record.provider_qualified_model_id.split("/")[0];
		if (provider !== record.provider_family) errors.push("provider_family must match provider_qualified_model_id");
	}
	errors.push(...validateTimestamp(record.observed_at, "observed_at").errors);
	for (const key of ["available", "highest_tier_eligible", "acquisition_attempted", "discovery_attempted", "providerCall"] as const)
		if (typeof record[key] !== "boolean") errors.push(`${key} must be boolean`);
	if (record.state === "availability_acquired") {
		if ((record.blocked_labels?.length ?? 0) > 0) errors.push("availability_acquired result cannot carry blockers");
		if (record.acquisition_plan_state !== "acquisition_planned") errors.push("availability_acquired result requires acquisition_planned input");
		if (record.acquisition_attempted !== true || record.discovery_attempted !== true)
			errors.push("availability_acquired result must record provider acquisition attempt");
		if (record.sanitized_provider_result_ref === undefined)
			errors.push("availability_acquired result requires sanitized_provider_result_ref");
	}
	if (record.state === "blocked" && (record.blocked_labels?.length ?? 0) === 0)
		errors.push("blocked provider acquisition result requires blocked labels");
	if (record.providerCall === true && (record.acquisition_attempted !== true || record.discovery_attempted !== true))
		errors.push("providerCall requires acquisition and discovery attempts");
	if (record.highest_tier_eligible === true && record.available !== true)
		errors.push("highest_tier_eligible requires available true");
	if (
		record.refresh_attempted !== false ||
		record.dispatch_authority_enabled !== false ||
		record.actualLaneLaunch !== false ||
		record.runtimeExecution !== false
	)
		errors.push("provider acquisition result cannot refresh cache, launch lanes, authorize dispatch, or run runtime execution");
	errors.push(...validateNoForbiddenRawPayloads(record, "exact_model_availability_cache_provider_acquisition_result").errors);
	return errors.length === 0 ? valid() : invalid(...errors);
}

export function materializeFlowDeskExactModelAvailabilityCacheFromProviderAcquisitionResultV1(input: {
	providerAcquisitionResult: unknown;
	cacheId?: string;
	entryId?: string;
	expectedContext?: FlowDeskExactModelAvailabilityCacheMaterializationContextV1;
}): FlowDeskExactModelAvailabilityCacheMaterializationResultV1 {
	const errors: string[] = [];
	const blockedLabels: string[] = [];
	const validation = validateFlowDeskExactModelAvailabilityCacheProviderAcquisitionResultV1(input.providerAcquisitionResult);
	if (!validation.ok) {
		errors.push(...validation.errors.map((error) => `provider_acquisition_result: ${error}`));
		blockedLabels.push("provider_acquisition_result_invalid");
	}
	const record = validation.ok
		? input.providerAcquisitionResult as FlowDeskExactModelAvailabilityCacheProviderAcquisitionResultV1
		: undefined;
	if (record !== undefined) {
		if (record.ok !== true) blockedLabels.push("provider_acquisition_result_not_ok");
		if (record.state !== "availability_acquired") blockedLabels.push("provider_acquisition_not_acquired");
		if (record.available !== true) blockedLabels.push("provider_model_unavailable");
		if (record.highest_tier_eligible !== true) blockedLabels.push("provider_model_not_highest_tier_eligible");
		if (record.providerCall !== true) blockedLabels.push("provider_acquisition_metadata_only");
		if (record.acquisition_attempted !== true) blockedLabels.push("provider_acquisition_not_attempted");
		if (record.discovery_attempted !== true) blockedLabels.push("provider_discovery_not_attempted");
		if (record.sanitized_provider_result_ref === undefined) blockedLabels.push("sanitized_provider_result_ref_missing");
		for (const [actual, expected, label] of [
			[record.local_date, input.expectedContext?.localDate, "local_date"],
			[record.active_profile_ref, input.expectedContext?.activeProfileRef, "active_profile_ref"],
			[record.opencode_version_ref, input.expectedContext?.opencodeVersionRef, "opencode_version_ref"],
			[record.flowdesk_package_version_ref, input.expectedContext?.flowdeskPackageVersionRef, "flowdesk_package_version_ref"],
			[record.registry_hash, input.expectedContext?.registryHash, "registry_hash"],
			[record.policy_pack_hash, input.expectedContext?.policyPackHash, "policy_pack_hash"],
			[record.auth_account_boundary_ref, input.expectedContext?.authAccountBoundaryRef, "auth_account_boundary_ref"],
		] as const)
			if (expected !== undefined && actual !== expected) blockedLabels.push(`${label}_drift`);
	}
	const cacheId = input.cacheId ?? (record === undefined ? undefined : `cache-${record.result_id}`);
	const entryId = input.entryId ?? (record === undefined ? undefined : `entry-${record.result_id}`);
	if (record !== undefined && cacheId !== undefined) errors.push(...validateOpaqueId(cacheId, "cache_id").errors);
	if (record !== undefined && entryId !== undefined) errors.push(...validateOpaqueId(entryId, "entry_id").errors);
	if (errors.length > 0 && !blockedLabels.includes("provider_acquisition_result_invalid"))
		blockedLabels.push("cache_materialization_context_invalid");
	const canMaterialize = record !== undefined && errors.length === 0 && blockedLabels.length === 0 && cacheId !== undefined && entryId !== undefined;
	const cache: FlowDeskExactModelAvailabilityCacheV1 | undefined = canMaterialize
		? {
			schema_version: "flowdesk.exact_model_availability_cache.v1",
			cache_id: cacheId,
			local_date: record.local_date,
			active_profile_ref: record.active_profile_ref,
			opencode_version_ref: record.opencode_version_ref,
			flowdesk_package_version_ref: record.flowdesk_package_version_ref,
			registry_hash: record.registry_hash,
			policy_pack_hash: record.policy_pack_hash,
			auth_account_boundary_ref: record.auth_account_boundary_ref,
			entries: [{
				entry_id: entryId,
				provider_family: record.provider_family,
				provider_identity_ref: record.provider_identity_ref,
				provider_qualified_model_id: record.provider_qualified_model_id,
				model_family: record.model_family,
				registered: true,
				available: true,
				highest_tier_eligible: true,
				availability_ref: record.availability_ref,
			}],
			dispatch_authority_enabled: false,
			providerCall: false,
			actualLaneLaunch: false,
			runtimeExecution: false,
		}
		: undefined;
	if (cache !== undefined) {
		const cacheValidation = validateFlowDeskExactModelAvailabilityCacheV1(cache);
		if (!cacheValidation.ok) {
			errors.push(...cacheValidation.errors.map((error) => `materialized_cache: ${error}`));
			blockedLabels.push("materialized_cache_invalid");
		}
	}
	const ready = cache !== undefined && errors.length === 0 && blockedLabels.length === 0;
	return {
		ok: ready,
		errors,
		state: ready ? "cache_materialized" : "blocked",
		blocked_labels: unique(blockedLabels),
		...(ready ? { cache } : {}),
		...disabledReviewerRuntimeAuthority,
	};
}

export function revalidateFlowDeskReviewerAssignmentsV1(input: {
	cache: FlowDeskExactModelAvailabilityCacheV1;
	localDate: string;
	activeProfileRef: string;
	opencodeVersionRef: string;
	flowdeskPackageVersionRef: string;
	registryHash: string;
	policyPackHash: string;
	authAccountBoundaryRef: string;
}): FlowDeskReviewerAssignmentRevalidationV1 {
	const cacheResult = validateFlowDeskExactModelAvailabilityCacheV1(input.cache);
	const errors = [...cacheResult.errors];
	const blockedLabels: string[] = [];
	if (!cacheResult.ok) blockedLabels.push("cache_invalid");
	errors.push(...validateLocalDate(input.localDate, "expected_local_date").errors);
	errors.push(...validateOpaqueRef(input.activeProfileRef, "expected_active_profile_ref").errors);
	errors.push(...validateOpaqueRef(input.opencodeVersionRef, "expected_opencode_version_ref").errors);
	errors.push(...validateOpaqueRef(input.flowdeskPackageVersionRef, "expected_flowdesk_package_version_ref").errors);
	errors.push(...validateHash(input.registryHash, "expected_registry_hash").errors);
	errors.push(...validateHash(input.policyPackHash, "expected_policy_pack_hash").errors);
	errors.push(...validateOpaqueRef(input.authAccountBoundaryRef, "expected_auth_account_boundary_ref").errors);
	if (input.cache.local_date !== input.localDate) blockedLabels.push("cache_not_same_day");
	if (input.cache.active_profile_ref !== input.activeProfileRef) blockedLabels.push("active_profile_drift");
	if (input.cache.opencode_version_ref !== input.opencodeVersionRef) blockedLabels.push("opencode_version_drift");
	if (input.cache.flowdesk_package_version_ref !== input.flowdeskPackageVersionRef)
		blockedLabels.push("flowdesk_package_version_drift");
	if (input.cache.registry_hash !== input.registryHash) blockedLabels.push("registry_hash_drift");
	if (input.cache.policy_pack_hash !== input.policyPackHash) blockedLabels.push("policy_pack_hash_drift");
	if (input.cache.auth_account_boundary_ref !== input.authAccountBoundaryRef)
		blockedLabels.push("auth_account_boundary_drift");
	const eligible = cacheResult.ok ? eligibleEntries(input.cache) : [];
	if (cacheResult.ok && eligible.length === 0) {
		const registeredAvailable = input.cache.entries.some((entry) => entry.registered && entry.available);
		blockedLabels.push(registeredAvailable ? "registered_available_lower_tier_only" : "no_registered_available_highest_tier_models");
	}
	const ready = errors.length === 0 && blockedLabels.length === 0;
	return {
		schema_version: "flowdesk.reviewer_assignment_revalidation.v1",
		ok: errors.length === 0,
		errors,
		cache_id: input.cache.cache_id,
		state: ready ? "revalidated" : "blocked",
		blocked_labels: unique(blockedLabels),
		expected_local_date: input.localDate,
		expected_active_profile_ref: input.activeProfileRef,
		expected_opencode_version_ref: input.opencodeVersionRef,
		expected_flowdesk_package_version_ref: input.flowdeskPackageVersionRef,
		expected_registry_hash: input.registryHash,
		expected_policy_pack_hash: input.policyPackHash,
		expected_auth_account_boundary_ref: input.authAccountBoundaryRef,
		cache_local_date: input.cache.local_date,
		cache_active_profile_ref: input.cache.active_profile_ref,
		cache_opencode_version_ref: input.cache.opencode_version_ref,
		cache_flowdesk_package_version_ref: input.cache.flowdesk_package_version_ref,
		cache_registry_hash: input.cache.registry_hash,
		cache_policy_pack_hash: input.cache.policy_pack_hash,
		cache_auth_account_boundary_ref: input.cache.auth_account_boundary_ref,
		eligible_bindings: ready
			? eligible.map((entry) => ({
				entry_id: entry.entry_id,
				provider_qualified_model_id: entry.provider_qualified_model_id,
			}))
			: [],
		...disabledReviewerRuntimeAuthority,
	};
}

export function revalidateFlowDeskReviewerAssignmentsFromCacheEvidenceV1(input: {
	cache: FlowDeskExactModelAvailabilityCacheV1;
	cacheRefreshPlan: FlowDeskExactModelAvailabilityCacheRefreshPlanV1;
	localDate: string;
	activeProfileRef: string;
	opencodeVersionRef: string;
	flowdeskPackageVersionRef: string;
	registryHash: string;
	policyPackHash: string;
	authAccountBoundaryRef: string;
}): FlowDeskReviewerAssignmentRevalidationV1 {
	const base = revalidateFlowDeskReviewerAssignmentsV1(input);
	const refreshResult = validateFlowDeskExactModelAvailabilityCacheRefreshPlanV1(input.cacheRefreshPlan);
	const evidenceBlockedLabels: string[] = [];
	if (!refreshResult.ok) evidenceBlockedLabels.push("cache_refresh_plan_invalid");
	if (input.cacheRefreshPlan.state !== "cache_hit") evidenceBlockedLabels.push("cache_refresh_not_cache_hit");
	if (input.cacheRefreshPlan.cache_usable_for_assignment !== true)
		evidenceBlockedLabels.push("cache_refresh_not_usable_for_assignment");
	if (input.cacheRefreshPlan.cache_id !== input.cache.cache_id) evidenceBlockedLabels.push("cache_refresh_cache_id_mismatch");
	for (const [planValue, expectedValue] of [
		[input.cacheRefreshPlan.expected_local_date, input.localDate],
		[input.cacheRefreshPlan.expected_active_profile_ref, input.activeProfileRef],
		[input.cacheRefreshPlan.expected_opencode_version_ref, input.opencodeVersionRef],
		[input.cacheRefreshPlan.expected_flowdesk_package_version_ref, input.flowdeskPackageVersionRef],
		[input.cacheRefreshPlan.expected_registry_hash, input.registryHash],
		[input.cacheRefreshPlan.expected_policy_pack_hash, input.policyPackHash],
		[input.cacheRefreshPlan.expected_auth_account_boundary_ref, input.authAccountBoundaryRef],
	] as const)
		if (planValue !== expectedValue) evidenceBlockedLabels.push("cache_refresh_expected_context_drift");
	for (const [planValue, cacheValue] of [
		[input.cacheRefreshPlan.cache_local_date, input.cache.local_date],
		[input.cacheRefreshPlan.cache_active_profile_ref, input.cache.active_profile_ref],
		[input.cacheRefreshPlan.cache_opencode_version_ref, input.cache.opencode_version_ref],
		[input.cacheRefreshPlan.cache_flowdesk_package_version_ref, input.cache.flowdesk_package_version_ref],
		[input.cacheRefreshPlan.cache_registry_hash, input.cache.registry_hash],
		[input.cacheRefreshPlan.cache_policy_pack_hash, input.cache.policy_pack_hash],
		[input.cacheRefreshPlan.cache_auth_account_boundary_ref, input.cache.auth_account_boundary_ref],
	] as const)
		if (planValue !== cacheValue) evidenceBlockedLabels.push("cache_refresh_cache_context_drift");
	const ready = base.state === "revalidated" && evidenceBlockedLabels.length === 0;
	const errors = [...base.errors, ...refreshResult.errors.map((error) => `cache_refresh_plan: ${error}`)];
	return {
		...base,
		ok: base.ok && refreshResult.ok,
		errors,
		state: ready ? "revalidated" : "blocked",
		blocked_labels: unique([...base.blocked_labels, ...evidenceBlockedLabels]),
		eligible_bindings: ready ? base.eligible_bindings : [],
	};
}

export function validateFlowDeskReviewerAssignmentRevalidationV1(value: unknown): ValidationResult {
	if (!isRecord(value)) return invalid("reviewer assignment revalidation must be an object");
	const record = value as Partial<FlowDeskReviewerAssignmentRevalidationV1>;
	const errors: string[] = [];
	errors.push(...rejectUnknownProperties(record, [
		"schema_version",
		"ok",
		"errors",
		"cache_id",
		"state",
		"blocked_labels",
		"expected_local_date",
		"expected_active_profile_ref",
		"expected_opencode_version_ref",
		"expected_flowdesk_package_version_ref",
		"expected_registry_hash",
		"expected_policy_pack_hash",
		"expected_auth_account_boundary_ref",
		"cache_local_date",
		"cache_active_profile_ref",
		"cache_opencode_version_ref",
		"cache_flowdesk_package_version_ref",
		"cache_registry_hash",
		"cache_policy_pack_hash",
		"cache_auth_account_boundary_ref",
		"eligible_bindings",
		"dispatch_authority_enabled",
		"providerCall",
		"actualLaneLaunch",
		"runtimeExecution",
	], "reviewer assignment revalidation").errors);
	if (record.schema_version !== "flowdesk.reviewer_assignment_revalidation.v1")
		errors.push("reviewer assignment revalidation schema_version is invalid");
	if (record.cache_id !== undefined) errors.push(...validateOpaqueId(record.cache_id, "cache_id").errors);
	if (record.state !== "revalidated" && record.state !== "blocked")
		errors.push("reviewer assignment revalidation state is invalid");
	if (!Array.isArray(record.blocked_labels)) errors.push("blocked_labels must be an array");
	else for (const [index, label] of record.blocked_labels.entries())
		errors.push(...validateOpaqueId(label, `blocked_labels[${index}]`).errors);
	if (record.state === "revalidated" && (record.blocked_labels?.length ?? 0) > 0)
		errors.push("revalidated assignment cannot carry blocked labels");
	if (record.state === "blocked" && (record.blocked_labels?.length ?? 0) === 0)
		errors.push("blocked revalidation requires blocked labels");
	errors.push(...validateLocalDate(record.expected_local_date, "expected_local_date").errors);
	for (const [field, label] of [
		[record.expected_active_profile_ref, "expected_active_profile_ref"],
		[record.expected_opencode_version_ref, "expected_opencode_version_ref"],
		[record.expected_flowdesk_package_version_ref, "expected_flowdesk_package_version_ref"],
		[record.expected_auth_account_boundary_ref, "expected_auth_account_boundary_ref"],
		[record.cache_active_profile_ref, "cache_active_profile_ref"],
		[record.cache_opencode_version_ref, "cache_opencode_version_ref"],
		[record.cache_flowdesk_package_version_ref, "cache_flowdesk_package_version_ref"],
		[record.cache_auth_account_boundary_ref, "cache_auth_account_boundary_ref"],
	] as const)
		if (field !== undefined) errors.push(...validateOpaqueRef(field, label).errors);
	errors.push(...validateHash(record.expected_registry_hash, "expected_registry_hash").errors);
	errors.push(...validateHash(record.expected_policy_pack_hash, "expected_policy_pack_hash").errors);
	if (record.cache_local_date !== undefined) errors.push(...validateLocalDate(record.cache_local_date, "cache_local_date").errors);
	if (record.cache_registry_hash !== undefined) errors.push(...validateHash(record.cache_registry_hash, "cache_registry_hash").errors);
	if (record.cache_policy_pack_hash !== undefined) errors.push(...validateHash(record.cache_policy_pack_hash, "cache_policy_pack_hash").errors);
	if (!Array.isArray(record.eligible_bindings)) errors.push("eligible_bindings must be an array");
	else {
		if (record.state === "revalidated" && record.eligible_bindings.length === 0)
			errors.push("revalidated assignment requires eligible bindings");
		for (const [index, binding] of record.eligible_bindings.entries()) {
			if (!isRecord(binding)) {
				errors.push(`eligible_bindings[${index}] must be an object`);
				continue;
			}
			errors.push(...rejectUnknownProperties(binding, ["entry_id", "provider_qualified_model_id"], `eligible_bindings[${index}]`).errors);
			errors.push(...validateOpaqueId(binding.entry_id, `eligible_bindings[${index}].entry_id`).errors);
			errors.push(...validateConcreteProviderQualifiedModelId(binding.provider_qualified_model_id, `eligible_bindings[${index}].provider_qualified_model_id`).errors);
		}
	}
	if (
		record.dispatch_authority_enabled !== false ||
		record.providerCall !== false ||
		record.actualLaneLaunch !== false ||
		record.runtimeExecution !== false
	)
		errors.push("reviewer assignment revalidation cannot enable runtime authority");
	errors.push(...validateNoForbiddenRawPayloads(record, "reviewer_assignment_revalidation").errors);
	return errors.length === 0 ? valid() : invalid(...errors);
}

export function planFlowDeskReviewerFanoutV1(input: {
	revalidation: FlowDeskReviewerAssignmentRevalidationV1;
	workflowId: string;
	attemptId: string;
	parentSessionRef: string;
	agentRef: string;
	requestedAt: string;
	requestedPerspectives?: FlowDeskTopTierReviewPerspective[];
	maxConcurrentLaneCount?: number;
	timeoutMs?: number;
	orphanMaxAgeMs?: number;
	retryBudget?: number;
	preLaunchAuditRef?: string;
	laneLaunchApprovalRef?: string;
}): FlowDeskReviewerFanoutPlanV1 {
	const errors = validateFlowDeskReviewerAssignmentRevalidationV1(input.revalidation).errors;
	const blockedLabels: string[] = [];
	if (errors.length > 0 || input.revalidation.state !== "revalidated")
		blockedLabels.push("assignment_revalidation_blocked", ...input.revalidation.blocked_labels);
	errors.push(...validateOpaqueId(input.workflowId, "workflow_id").errors);
	errors.push(...validateOpaqueId(input.attemptId, "attempt_id").errors);
	errors.push(...validateOpaqueRef(input.parentSessionRef, "parent_session_ref").errors);
	errors.push(...validateOpaqueRef(input.agentRef, "agent_ref").errors);
	if (typeof input.requestedAt !== "string" || !Number.isFinite(Date.parse(input.requestedAt)))
		errors.push("requested_at must be a parseable timestamp");
	const requiredPerspectives = input.requestedPerspectives ?? perspectives;
	errors.push(...validatePerspectiveArray(requiredPerspectives, "required_perspectives").errors);
	const maxConcurrentLaneCount = input.maxConcurrentLaneCount ?? Math.min(3, requiredPerspectives.length);
	if (!Number.isInteger(maxConcurrentLaneCount) || maxConcurrentLaneCount < 1 || maxConcurrentLaneCount > requiredPerspectives.length)
		errors.push("max_concurrent_lane_count must be a bounded positive integer");
	const timeoutMs = input.timeoutMs ?? 30000;
	const orphanMaxAgeMs = input.orphanMaxAgeMs ?? 60000;
	const retryBudget = input.retryBudget ?? 1;
	if (!Number.isInteger(timeoutMs) || timeoutMs < 0 || timeoutMs > 600000) errors.push("timeout_ms must be bounded");
	if (!Number.isInteger(orphanMaxAgeMs) || orphanMaxAgeMs < 0 || orphanMaxAgeMs > 3600000)
		errors.push("orphan_max_age_ms must be bounded");
	if (!Number.isInteger(retryBudget) || retryBudget < 0 || retryBudget > 2) errors.push("retry_budget must be bounded");
	const ready = errors.length === 0 && blockedLabels.length === 0;
	const bindings = input.revalidation.eligible_bindings;
	const runtimeRequests: FlowDeskRuntimeLaneLaunchRequestV1[] = ready
		? requiredPerspectives.map((perspective, index) => {
			const binding = bindings[index % bindings.length];
			return {
				schema_version: "flowdesk.runtime_lane_launch_request.v1",
				launch_request_id: `reviewer-launch-${input.attemptId}-${perspective}`,
				workflow_id: input.workflowId,
				attempt_id: input.attemptId,
				lane_id: `reviewer-lane-${input.attemptId}-${perspective}`,
				parent_session_ref: input.parentSessionRef,
				agent_ref: input.agentRef,
				provider_qualified_model_id: binding.provider_qualified_model_id,
				launch_reason: "reviewer_fanout",
				pre_launch_audit_ref: input.preLaunchAuditRef,
				lane_launch_approval_ref: input.laneLaunchApprovalRef,
				requested_at: input.requestedAt,
				timeout_ms: timeoutMs,
				orphan_max_age_ms: orphanMaxAgeMs,
				retry_budget: retryBudget,
				...disabledReviewerRuntimeAuthority,
			};
		})
		: [];
	for (const [index, request] of runtimeRequests.entries())
		errors.push(...validateFlowDeskRuntimeLaneLaunchRequestV1(request).errors.map((error) => `runtime_lane_launch_requests[${index}].${error}`));
	const finalReady = errors.length === 0 && blockedLabels.length === 0 && runtimeRequests.length === requiredPerspectives.length;
	return {
		schema_version: "flowdesk.reviewer_fanout_plan.v1",
		ok: errors.length === 0,
		errors,
		workflow_id: input.workflowId,
		attempt_id: input.attemptId,
		cache_id: input.revalidation.cache_id,
		state: finalReady ? "fanout_ready" : "blocked",
		blocked_labels: unique(blockedLabels),
		required_perspectives: [...requiredPerspectives],
		planned_perspectives: finalReady ? [...requiredPerspectives] : [],
		runtime_lane_launch_requests: runtimeRequests,
		max_concurrent_lane_count: maxConcurrentLaneCount,
		runtime_launch_plan_required: true,
		lane_launch_approval_required: true,
		launch_attempted: false,
		approval_inferred: false,
		...disabledReviewerRuntimeAuthority,
	};
}

export function validateFlowDeskReviewerFanoutPlanV1(value: unknown): ValidationResult {
	if (!isRecord(value)) return invalid("reviewer fanout plan must be an object");
	const record = value as Partial<FlowDeskReviewerFanoutPlanV1>;
	const errors: string[] = [];
	errors.push(...rejectUnknownProperties(record, [
		"schema_version",
		"ok",
		"errors",
		"workflow_id",
		"attempt_id",
		"cache_id",
		"state",
		"blocked_labels",
		"required_perspectives",
		"planned_perspectives",
		"runtime_lane_launch_requests",
		"max_concurrent_lane_count",
		"runtime_launch_plan_required",
		"lane_launch_approval_required",
		"launch_attempted",
		"approval_inferred",
		"dispatch_authority_enabled",
		"providerCall",
		"actualLaneLaunch",
		"runtimeExecution",
	], "reviewer fanout plan").errors);
	if (record.schema_version !== "flowdesk.reviewer_fanout_plan.v1") errors.push("reviewer fanout plan schema_version is invalid");
	errors.push(...validateOpaqueId(record.workflow_id, "workflow_id").errors);
	errors.push(...validateOpaqueId(record.attempt_id, "attempt_id").errors);
	if (record.cache_id !== undefined) errors.push(...validateOpaqueId(record.cache_id, "cache_id").errors);
	if (record.state !== "fanout_ready" && record.state !== "blocked") errors.push("reviewer fanout plan state is invalid");
	if (!Array.isArray(record.blocked_labels)) errors.push("blocked_labels must be an array");
	else for (const [index, label] of record.blocked_labels.entries())
		errors.push(...validateOpaqueId(label, `blocked_labels[${index}]`).errors);
	if (record.state === "fanout_ready" && (record.blocked_labels?.length ?? 0) > 0)
		errors.push("fanout_ready plan cannot carry blocked labels");
	if (record.state === "blocked" && (record.blocked_labels?.length ?? 0) === 0)
		errors.push("blocked fanout plan requires blocked labels");
	errors.push(...validatePerspectiveArray(record.required_perspectives, "required_perspectives").errors);
	if (!Array.isArray(record.planned_perspectives)) errors.push("planned_perspectives must be an array");
	else if (record.state === "fanout_ready" || record.planned_perspectives.length > 0)
		errors.push(...validatePerspectiveArray(record.planned_perspectives, "planned_perspectives").errors);
	if (record.state === "fanout_ready") {
		const required = record.required_perspectives ?? [];
		const planned = record.planned_perspectives ?? [];
		if (required.length !== planned.length || required.some((perspective) => !planned.includes(perspective)))
			errors.push("fanout_ready plan must cover every required perspective");
	}
	if (!Array.isArray(record.runtime_lane_launch_requests)) errors.push("runtime_lane_launch_requests must be an array");
	else {
		if (record.state === "fanout_ready" && record.runtime_lane_launch_requests.length !== (record.required_perspectives?.length ?? 0))
			errors.push("fanout_ready plan requires one launch request per perspective");
		for (const [index, request] of record.runtime_lane_launch_requests.entries())
			errors.push(...validateFlowDeskRuntimeLaneLaunchRequestV1(request).errors.map((error) => `runtime_lane_launch_requests[${index}].${error}`));
	}
	if (typeof record.max_concurrent_lane_count !== "number" || !Number.isInteger(record.max_concurrent_lane_count) || record.max_concurrent_lane_count < 1)
		errors.push("max_concurrent_lane_count must be a positive integer");
	if (record.runtime_launch_plan_required !== true || record.lane_launch_approval_required !== true)
		errors.push("reviewer fanout plan must require runtime launch plan and lane launch approval");
	if (
		record.launch_attempted !== false ||
		record.approval_inferred !== false ||
		record.dispatch_authority_enabled !== false ||
		record.providerCall !== false ||
		record.actualLaneLaunch !== false ||
		record.runtimeExecution !== false
	)
		errors.push("reviewer fanout plan cannot launch lanes, infer approval, or enable authority");
	errors.push(...validateNoForbiddenRawPayloads(record, "reviewer_fanout_plan").errors);
	return errors.length === 0 ? valid() : invalid(...errors);
}
