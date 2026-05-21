import {
	invalid,
	type ValidationResult,
	valid,
	validateConcreteProviderQualifiedModelId,
	validateNoForbiddenRawPayloads,
	validateOpaqueId,
	validateOpaqueRef,
} from "./validators.js";

export const FLOWDESK_FALLBACK_REASON_LABELS = [
	"provider_unhealthy",
	"quota_exhausted",
	"runtime_incompatible",
	"policy_ineligible",
	"manual_reselection_requested",
] as const;
export type FlowDeskFallbackReasonLabelV1 =
	(typeof FLOWDESK_FALLBACK_REASON_LABELS)[number];

export interface FlowDeskFallbackDecisionV1 {
	schema_version: "flowdesk.fallback_decision.v1";
	decision_id: string;
	workflow_id: string;
	parent_attempt_id: string;
	new_attempt_id: string;
	from_provider_qualified_model_id: string;
	to_provider_qualified_model_id: string;
	reason_label: FlowDeskFallbackReasonLabelV1;
	depth: number;
	max_depth: number;
	fresh_evidence_refs: string[];
	fresh_guard_decision_ref: string;
	fresh_approval_ref: string;
	fresh_pre_dispatch_audit_ref: string;
	policy_eligibility_ref: string;
	runtime_compatibility_ref: string;
	state: "requires_full_regate" | "blocked_terminal";
	automatic_fallback_authorized: false;
	dispatch_authority_enabled: false;
	providerCall: false;
	actualLaneLaunch: false;
	runtimeExecution: false;
}

function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === "object" && value !== null && !Array.isArray(value);
}

function refs(value: unknown, label: string): ValidationResult {
	if (!Array.isArray(value) || value.length === 0) return invalid(`${label} must be a non-empty array`);
	const errors: string[] = [];
	for (const [index, ref] of value.entries()) errors.push(...validateOpaqueRef(ref, `${label}[${index}]`).errors);
	return errors.length === 0 ? valid() : invalid(...errors);
}

export function validateFlowDeskFallbackDecisionV1(value: unknown): ValidationResult {
	if (!isRecord(value)) return invalid("fallback decision must be an object");
	const record = value as Partial<FlowDeskFallbackDecisionV1>;
	const errors: string[] = [];
	const allowed = new Set([
		"schema_version",
		"decision_id",
		"workflow_id",
		"parent_attempt_id",
		"new_attempt_id",
		"from_provider_qualified_model_id",
		"to_provider_qualified_model_id",
		"reason_label",
		"depth",
		"max_depth",
		"fresh_evidence_refs",
		"fresh_guard_decision_ref",
		"fresh_approval_ref",
		"fresh_pre_dispatch_audit_ref",
		"policy_eligibility_ref",
		"runtime_compatibility_ref",
		"state",
		"automatic_fallback_authorized",
		"dispatch_authority_enabled",
		"providerCall",
		"actualLaneLaunch",
		"runtimeExecution",
	]);
	for (const key of Object.keys(record)) if (!allowed.has(key)) errors.push(`unknown properties: ${key}`);
	errors.push(...validateOpaqueId(record.decision_id, "decision_id").errors);
	errors.push(...validateOpaqueId(record.workflow_id, "workflow_id").errors);
	errors.push(...validateOpaqueId(record.parent_attempt_id, "parent_attempt_id").errors);
	errors.push(...validateOpaqueId(record.new_attempt_id, "new_attempt_id").errors);
	errors.push(...validateConcreteProviderQualifiedModelId(record.from_provider_qualified_model_id).errors);
	errors.push(...validateConcreteProviderQualifiedModelId(record.to_provider_qualified_model_id).errors);
	if (record.schema_version !== "flowdesk.fallback_decision.v1") errors.push("fallback decision schema_version is invalid");
	if (!(FLOWDESK_FALLBACK_REASON_LABELS as readonly string[]).includes(record.reason_label ?? "")) errors.push("fallback reason_label is invalid");
	if (typeof record.depth !== "number" || !Number.isInteger(record.depth) || record.depth < 0) errors.push("fallback depth is invalid");
	if (record.max_depth !== 2) errors.push("fallback max_depth must be 2");
	if ((record.depth ?? 0) > (record.max_depth ?? 0)) errors.push("fallback depth exceeds max_depth");
	if (record.parent_attempt_id === record.new_attempt_id) errors.push("fallback must use a new attempt id");
	if (record.from_provider_qualified_model_id === record.to_provider_qualified_model_id) errors.push("fallback must change binding");
	errors.push(...refs(record.fresh_evidence_refs, "fresh_evidence_refs").errors);
	for (const [value, label] of [
		[record.fresh_guard_decision_ref, "fresh_guard_decision_ref"],
		[record.fresh_approval_ref, "fresh_approval_ref"],
		[record.fresh_pre_dispatch_audit_ref, "fresh_pre_dispatch_audit_ref"],
		[record.policy_eligibility_ref, "policy_eligibility_ref"],
		[record.runtime_compatibility_ref, "runtime_compatibility_ref"],
	] as const) errors.push(...validateOpaqueRef(value, label).errors);
	if (record.state !== "requires_full_regate" && record.state !== "blocked_terminal") errors.push("fallback state is invalid");
	if (record.depth === record.max_depth && record.state !== "blocked_terminal") errors.push("max-depth fallback must be terminal blocked");
	if (record.automatic_fallback_authorized !== false || record.dispatch_authority_enabled !== false || record.providerCall !== false || record.actualLaneLaunch !== false || record.runtimeExecution !== false) errors.push("fallback decision cannot enable runtime authority");
	errors.push(...validateNoForbiddenRawPayloads(record, "fallback_decision").errors);
	return errors.length === 0 ? valid() : invalid(...errors);
}
