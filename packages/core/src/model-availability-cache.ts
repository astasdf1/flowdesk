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
