import type { ProviderFamily } from "./release1-contracts.js";
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

export const FLOWDESK_EXTERNAL_AUTH_PROVIDER_POLICY_RESULTS = [
	"passed",
	"failed",
] as const;
export type FlowDeskExternalAuthProviderPolicyResultLabelV1 =
	(typeof FLOWDESK_EXTERNAL_AUTH_PROVIDER_POLICY_RESULTS)[number];

export interface FlowDeskExternalAuthProviderPolicyResultV1 {
	schema_version: "flowdesk.external_auth_provider_policy_result.v1";
	external_auth_policy_ref: string;
	provider_policy_ref: string;
	workflow_id: string;
	provider_family: ProviderFamily;
	provider_qualified_model_id: string;
	auth_profile_ref: string;
	auth_evidence_ref: string;
	credential_scope_ref: string;
	account_boundary_ref: string;
	sanitizer_ref: string;
	source_ref: string;
	result: FlowDeskExternalAuthProviderPolicyResultLabelV1;
	sanitized_at: string;
	metadata_labels: string[];
	evidence_refs: string[];
	raw_auth_object_persisted: false;
	token_material_persisted: false;
	provider_call_made: false;
	runtime_execution_made: false;
	actual_lane_launch_made: false;
	dispatch_authority_enabled: false;
	safe_next_actions: string[];
}

export interface FlowDeskExternalAuthProviderPolicyResultInputV1 {
	externalAuthPolicyRef: string;
	providerPolicyRef: string;
	workflowId: string;
	providerFamily: ProviderFamily;
	providerQualifiedModelId: string;
	authProfileRef: string;
	authEvidenceRef: string;
	credentialScopeRef: string;
	accountBoundaryRef: string;
	sanitizerRef: string;
	sourceRef: string;
	result: FlowDeskExternalAuthProviderPolicyResultLabelV1;
	sanitizedAt: string;
	metadataLabels: string[];
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

export function createFlowDeskExternalAuthProviderPolicyResultV1(
	input: FlowDeskExternalAuthProviderPolicyResultInputV1,
): FlowDeskExternalAuthProviderPolicyResultV1 {
	return {
		schema_version: "flowdesk.external_auth_provider_policy_result.v1",
		external_auth_policy_ref: input.externalAuthPolicyRef,
		provider_policy_ref: input.providerPolicyRef,
		workflow_id: input.workflowId,
		provider_family: input.providerFamily,
		provider_qualified_model_id: input.providerQualifiedModelId,
		auth_profile_ref: input.authProfileRef,
		auth_evidence_ref: input.authEvidenceRef,
		credential_scope_ref: input.credentialScopeRef,
		account_boundary_ref: input.accountBoundaryRef,
		sanitizer_ref: input.sanitizerRef,
		source_ref: input.sourceRef,
		result: input.result,
		sanitized_at: input.sanitizedAt,
		metadata_labels: [...input.metadataLabels],
		evidence_refs: [...(input.evidenceRefs ?? [])],
		raw_auth_object_persisted: false,
		token_material_persisted: false,
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

export function validateFlowDeskExternalAuthProviderPolicyResultV1(
	value: unknown,
	expectedWorkflowId?: string,
	expectedExternalAuthPolicyRef?: string,
	expectedProviderPolicyRef?: string,
): ValidationResult {
	if (!isRecord(value))
		return invalid("external auth provider policy result must be an object");
	const errors: string[] = [];
	const allowed = new Set([
		"schema_version",
		"external_auth_policy_ref",
		"provider_policy_ref",
		"workflow_id",
		"provider_family",
		"provider_qualified_model_id",
		"auth_profile_ref",
		"auth_evidence_ref",
		"credential_scope_ref",
		"account_boundary_ref",
		"sanitizer_ref",
		"source_ref",
		"result",
		"sanitized_at",
		"metadata_labels",
		"evidence_refs",
		"raw_auth_object_persisted",
		"token_material_persisted",
		"provider_call_made",
		"runtime_execution_made",
		"actual_lane_launch_made",
		"dispatch_authority_enabled",
		"safe_next_actions",
	]);
	for (const key of Object.keys(value))
		if (!allowed.has(key)) errors.push(`unknown properties: ${key}`);
	if (value.schema_version !== "flowdesk.external_auth_provider_policy_result.v1")
		errors.push("external auth provider policy schema_version is invalid");
	errors.push(
		...validateOpaqueRef(
			value.external_auth_policy_ref,
			"external_auth_policy_ref",
		).errors,
	);
	errors.push(...validateOpaqueRef(value.provider_policy_ref, "provider_policy_ref").errors);
	errors.push(...validateOpaqueId(value.workflow_id, "workflow_id").errors);
	if (
		expectedExternalAuthPolicyRef !== undefined &&
		value.external_auth_policy_ref !== expectedExternalAuthPolicyRef
	)
		errors.push("external auth policy ref mismatch");
	if (
		expectedProviderPolicyRef !== undefined &&
		value.provider_policy_ref !== expectedProviderPolicyRef
	)
		errors.push("provider policy ref mismatch");
	if (expectedWorkflowId !== undefined && value.workflow_id !== expectedWorkflowId)
		errors.push("external auth provider policy workflow_id mismatch");
	errors.push(...validateProviderFamily(value.provider_family).errors);
	if (value.provider_family === "unknown" || value.provider_family === "all")
		errors.push("provider_family must be concrete for policy evaluation");
	errors.push(
		...validateConcreteProviderQualifiedModelId(
			value.provider_qualified_model_id,
			"provider_qualified_model_id",
		).errors,
	);
	if (
		typeof value.provider_qualified_model_id === "string" &&
		typeof value.provider_family === "string" &&
		!value.provider_qualified_model_id.startsWith(`${value.provider_family}/`)
	)
		errors.push("provider_qualified_model_id must match provider_family");
	for (const [field, label] of [
		[value.auth_profile_ref, "auth_profile_ref"],
		[value.auth_evidence_ref, "auth_evidence_ref"],
		[value.credential_scope_ref, "credential_scope_ref"],
		[value.account_boundary_ref, "account_boundary_ref"],
		[value.sanitizer_ref, "sanitizer_ref"],
		[value.source_ref, "source_ref"],
	] as const)
		errors.push(...validateOpaqueRef(field, label).errors);
	if (
		!(
			FLOWDESK_EXTERNAL_AUTH_PROVIDER_POLICY_RESULTS as readonly string[]
		).includes(String(value.result))
	)
		errors.push("external auth provider policy result is invalid");
	if (!isParseableTimestamp(value.sanitized_at))
		errors.push("external auth provider policy sanitized_at is invalid");
	errors.push(
		...validateBoundedLabelArray(value.metadata_labels, "metadata_labels", 20)
			.errors,
	);
	errors.push(...validateRefArray(value.evidence_refs, "evidence_refs", 20).errors);
	if (value.raw_auth_object_persisted !== false)
		errors.push("raw auth objects cannot be persisted");
	if (value.token_material_persisted !== false)
		errors.push("token material cannot be persisted");
	if (value.provider_call_made !== false)
		errors.push("external auth provider policy cannot make provider calls");
	if (value.runtime_execution_made !== false)
		errors.push("external auth provider policy cannot make runtime execution");
	if (value.actual_lane_launch_made !== false)
		errors.push("external auth provider policy cannot launch lanes");
	if (value.dispatch_authority_enabled !== false)
		errors.push("external auth provider policy cannot enable dispatch authority");
	errors.push(...validateSafeActions(value.safe_next_actions).errors);
	errors.push(
		...validateNoForbiddenRawPayloads(
			value,
			"external_auth_provider_policy_result",
		).errors,
	);
	return errors.length === 0 ? valid() : invalid(...errors);
}
