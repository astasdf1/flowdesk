/**
 * Specialist workflow eligibility gate contract.
 * P7-S13.5 submodule: specialist
 */
import {
	type ValidationResult,
	valid,
	invalid,
	validateNoForbiddenRawPayloads,
	validateOpaqueId,
	validateOpaqueRef,
	isRecord,
	rejectUnknownProperties,
	validateBoundedLabel,
	validateTimestamp,
} from "./shared.js";

// ─── Types ────────────────────────────────────────────────────────────────────

/**
 * Eligibility decision for routing a workflow/task to a specialist workflow lane.
 */
export type FlowDeskSpecialistWorkflowEligibilityDecisionV1 = "eligible" | "ineligible" | "deferred" | "blocked";

/**
 * Known specialist workflow category labels.
 */
export type FlowDeskSpecialistCategoryV1 = "security" | "legal" | "medical" | "compliance" | "unknown";

export type FlowDeskSpecialistSourceDomainV1 = "patent" | "medical_device";

export type FlowDeskSpecialistFindingStatusV1 = "complete" | "partial" | "inconclusive" | "blocked";

export type FlowDeskHumanReviewSignoffStatusV1 = "pending" | "signed_off" | "rejected" | "not_required_invalid";

/**
 * Pure advisory eligibility gate encoding whether a given workflow/task
 * signature qualifies for routing to a specialist workflow lane.
 */
export interface FlowDeskSpecialistWorkflowEligibilityV1 {
	schema_version: "flowdesk.specialist_workflow_eligibility.v1";
	eligibility_id: string;
	workflow_id: string;
	task_signature_ref: string;
	eligibility_decision: FlowDeskSpecialistWorkflowEligibilityDecisionV1;
	specialist_category: FlowDeskSpecialistCategoryV1;
	confidence_score: number;
	reason_refs: string[];
	blocking_labels: string[];
	evaluated_at: string;
	advisory_only: true;
	non_authorizing: true;
	safe_next_actions: string[];
	dispatch_authority_enabled: false;
	approval_authority_enabled: false;
	provider_authority_enabled: false;
	runtime_authority_enabled: false;
	external_write_authority_enabled: false;
	remote_write_authority_enabled: false;
	fallback_authority_enabled: false;
	lane_launch_authority_enabled: false;
	write_authority_enabled: false;
	hard_chat_authority_enabled: false;
	routing_authority_enabled: false;
	model_selection_authority_enabled: false;
}

export interface FlowDeskSpecialistSourceEntryV1 {
	source_ref: string;
	source_domain: FlowDeskSpecialistSourceDomainV1;
	source_type: "statute" | "regulation" | "guidance" | "database" | "standard" | "reference_pack";
	jurisdiction_ref: string;
	approved_for_reference_pack: true;
	source_hash_ref: string;
}

export interface FlowDeskSpecialistSourceRegisterV1 {
	schema_version: "flowdesk.specialist_source_register.v1";
	register_id: string;
	workflow_id: string;
	source_domain: FlowDeskSpecialistSourceDomainV1;
	source_entries: FlowDeskSpecialistSourceEntryV1[];
	curation_policy_ref: string;
	approved_by_ref: string;
	approved_at: string;
	advisory_only: true;
	non_authorizing: true;
	safe_next_actions: string[];
	dispatch_authority_enabled: false;
	approval_authority_enabled: false;
	provider_authority_enabled: false;
	runtime_authority_enabled: false;
	external_write_authority_enabled: false;
	remote_write_authority_enabled: false;
	fallback_authority_enabled: false;
	lane_launch_authority_enabled: false;
	write_authority_enabled: false;
	hard_chat_authority_enabled: false;
	routing_authority_enabled: false;
	model_selection_authority_enabled: false;
}

export interface FlowDeskSpecialistFindingV1 {
	schema_version: "flowdesk.specialist_finding.v1";
	finding_id: string;
	workflow_id: string;
	task_ref: string;
	specialist_category: FlowDeskSpecialistCategoryV1;
	source_register_ref: string;
	reference_pack_refs: string[];
	finding_summary_ref: string;
	finding_status: FlowDeskSpecialistFindingStatusV1;
	confidence_score: number;
	uncertainty_labels: string[];
	generated_at: string;
	human_review_required: true;
	final_professional_decision: false;
	product_decision_authority_enabled: false;
	advisory_only: true;
	non_authorizing: true;
	safe_next_actions: string[];
	dispatch_authority_enabled: false;
	approval_authority_enabled: false;
	provider_authority_enabled: false;
	runtime_authority_enabled: false;
	external_write_authority_enabled: false;
	remote_write_authority_enabled: false;
	fallback_authority_enabled: false;
	lane_launch_authority_enabled: false;
	write_authority_enabled: false;
	hard_chat_authority_enabled: false;
	routing_authority_enabled: false;
	model_selection_authority_enabled: false;
}

export interface FlowDeskHumanReviewBoundaryV1 {
	schema_version: "flowdesk.human_review_boundary.v1";
	boundary_id: string;
	workflow_id: string;
	finding_ref: string;
	human_review_required: true;
	signoff_status: FlowDeskHumanReviewSignoffStatusV1;
	human_reviewer_ref?: string;
	human_signoff_ref?: string;
	signoff_recorded_at?: string;
	product_decision_use_allowed_without_human_signoff: false;
	final_professional_decision: false;
	professional_decision_authority_enabled: false;
	advisory_only: true;
	non_authorizing: true;
	safe_next_actions: string[];
	dispatch_authority_enabled: false;
	approval_authority_enabled: false;
	provider_authority_enabled: false;
	runtime_authority_enabled: false;
	external_write_authority_enabled: false;
	remote_write_authority_enabled: false;
	fallback_authority_enabled: false;
	lane_launch_authority_enabled: false;
	write_authority_enabled: false;
	hard_chat_authority_enabled: false;
	routing_authority_enabled: false;
	model_selection_authority_enabled: false;
}

export interface FlowDeskSpecialistWorkflowEligibilityResultV1 {
	ok: boolean;
	errors: string[];
	eligibility?: FlowDeskSpecialistWorkflowEligibilityV1;
}

export interface FlowDeskSpecialistSourceRegisterResultV1 {
	ok: boolean;
	errors: string[];
	register?: FlowDeskSpecialistSourceRegisterV1;
}

export interface FlowDeskSpecialistFindingResultV1 {
	ok: boolean;
	errors: string[];
	finding?: FlowDeskSpecialistFindingV1;
}

export interface FlowDeskHumanReviewBoundaryResultV1 {
	ok: boolean;
	errors: string[];
	boundary?: FlowDeskHumanReviewBoundaryV1;
}

// ─── Constants ────────────────────────────────────────────────────────────────

const specialistEligibilityDecisions: readonly string[] = ["eligible", "ineligible", "deferred", "blocked"];
const specialistCategories: readonly string[] = ["security", "legal", "medical", "compliance", "unknown"];
const specialistSourceDomains: readonly string[] = ["patent", "medical_device"];
const specialistSourceTypes: readonly string[] = ["statute", "regulation", "guidance", "database", "standard", "reference_pack"];
const specialistFindingStatuses: readonly string[] = ["complete", "partial", "inconclusive", "blocked"];
const humanReviewSignoffStatuses: readonly string[] = ["pending", "signed_off", "rejected", "not_required_invalid"];

const specialistAuthorityAllowedProperties = [
	"advisory_only",
	"non_authorizing",
	"safe_next_actions",
	"dispatch_authority_enabled",
	"approval_authority_enabled",
	"provider_authority_enabled",
	"runtime_authority_enabled",
	"external_write_authority_enabled",
	"remote_write_authority_enabled",
	"fallback_authority_enabled",
	"lane_launch_authority_enabled",
	"write_authority_enabled",
	"hard_chat_authority_enabled",
	"routing_authority_enabled",
	"model_selection_authority_enabled",
] as const;

const specialistWorkflowEligibilityAllowedProperties = [
	"schema_version",
	"eligibility_id",
	"workflow_id",
	"task_signature_ref",
	"eligibility_decision",
	"specialist_category",
	"confidence_score",
	"reason_refs",
	"blocking_labels",
	"evaluated_at",
	"advisory_only",
	"non_authorizing",
	"safe_next_actions",
	"dispatch_authority_enabled",
	"approval_authority_enabled",
	"provider_authority_enabled",
	"runtime_authority_enabled",
	"external_write_authority_enabled",
	"remote_write_authority_enabled",
	"fallback_authority_enabled",
	"lane_launch_authority_enabled",
	"write_authority_enabled",
	"hard_chat_authority_enabled",
	"routing_authority_enabled",
	"model_selection_authority_enabled",
] as const;

const specialistSourceEntryAllowedProperties = [
	"source_ref",
	"source_domain",
	"source_type",
	"jurisdiction_ref",
	"approved_for_reference_pack",
	"source_hash_ref",
] as const;

const specialistSourceRegisterAllowedProperties = [
	"schema_version",
	"register_id",
	"workflow_id",
	"source_domain",
	"source_entries",
	"curation_policy_ref",
	"approved_by_ref",
	"approved_at",
	...specialistAuthorityAllowedProperties,
] as const;

const specialistFindingAllowedProperties = [
	"schema_version",
	"finding_id",
	"workflow_id",
	"task_ref",
	"specialist_category",
	"source_register_ref",
	"reference_pack_refs",
	"finding_summary_ref",
	"finding_status",
	"confidence_score",
	"uncertainty_labels",
	"generated_at",
	"human_review_required",
	"final_professional_decision",
	"product_decision_authority_enabled",
	...specialistAuthorityAllowedProperties,
] as const;

const humanReviewBoundaryAllowedProperties = [
	"schema_version",
	"boundary_id",
	"workflow_id",
	"finding_ref",
	"human_review_required",
	"signoff_status",
	"human_reviewer_ref",
	"human_signoff_ref",
	"signoff_recorded_at",
	"product_decision_use_allowed_without_human_signoff",
	"final_professional_decision",
	"professional_decision_authority_enabled",
	...specialistAuthorityAllowedProperties,
] as const;

// ─── Creator ──────────────────────────────────────────────────────────────────

export function createFlowDeskSpecialistWorkflowEligibilityV1(input: {
	eligibilityId: string;
	workflowId: string;
	taskSignatureRef: string;
	eligibilityDecision: FlowDeskSpecialistWorkflowEligibilityDecisionV1;
	specialistCategory: FlowDeskSpecialistCategoryV1;
	confidenceScore: number;
	reasonRefs?: string[];
	blockingLabels?: string[];
	evaluatedAt: string;
	safeNextActions: string[];
}): FlowDeskSpecialistWorkflowEligibilityResultV1 {
	const errors: string[] = [];

	errors.push(...validateOpaqueId(input.eligibilityId, "eligibility_id").errors);
	errors.push(...validateOpaqueId(input.workflowId, "workflow_id").errors);
	errors.push(...validateOpaqueRef(input.taskSignatureRef, "task_signature_ref").errors);
	errors.push(...validateTimestamp(input.evaluatedAt, "evaluated_at").errors);

	if (typeof input.eligibilityDecision !== "string" || !specialistEligibilityDecisions.includes(input.eligibilityDecision)) {
		errors.push("eligibility_decision must be 'eligible', 'ineligible', 'deferred', or 'blocked'");
	}

	if (typeof input.specialistCategory !== "string" || !specialistCategories.includes(input.specialistCategory)) {
		errors.push("specialist_category must be 'security', 'legal', 'medical', 'compliance', or 'unknown'");
	}

	if (typeof input.confidenceScore !== "number" || !Number.isInteger(input.confidenceScore) || input.confidenceScore < 0 || input.confidenceScore > 100) {
		errors.push("confidence_score must be an integer 0..100");
	}

	const reasonRefs = input.reasonRefs ?? [];
	if (!Array.isArray(reasonRefs) || reasonRefs.length > 10) {
		errors.push("reason_refs must be a bounded array (0..10 entries)");
	} else {
		for (const [index, ref] of reasonRefs.entries()) {
			errors.push(...validateOpaqueRef(ref, `reason_refs[${index}]`).errors);
		}
	}

	const blockingLabels = input.blockingLabels ?? [];
	if (!Array.isArray(blockingLabels) || blockingLabels.length > 10) {
		errors.push("blocking_labels must be a bounded array (0..10 entries)");
	} else {
		for (const [index, label] of blockingLabels.entries()) {
			errors.push(...validateOpaqueRef(label, `blocking_labels[${index}]`).errors);
		}
	}

	if (input.eligibilityDecision === "blocked" && Array.isArray(blockingLabels) && blockingLabels.length === 0) {
		errors.push("blocking_labels must be non-empty when eligibility_decision is 'blocked'");
	}

	if (!Array.isArray(input.safeNextActions) || input.safeNextActions.length === 0 || input.safeNextActions.length > 8) {
		errors.push("safe_next_actions must be a non-empty bounded array (1..8 entries)");
	} else {
		for (const [index, action] of input.safeNextActions.entries()) {
			errors.push(...validateOpaqueRef(action, `safe_next_actions[${index}]`).errors);
		}
	}

	if (errors.length > 0) return { ok: false, errors };

	const eligibility: FlowDeskSpecialistWorkflowEligibilityV1 = {
		schema_version: "flowdesk.specialist_workflow_eligibility.v1",
		eligibility_id: input.eligibilityId,
		workflow_id: input.workflowId,
		task_signature_ref: input.taskSignatureRef,
		eligibility_decision: input.eligibilityDecision,
		specialist_category: input.specialistCategory,
		confidence_score: input.confidenceScore,
		reason_refs: [...reasonRefs],
		blocking_labels: [...blockingLabels],
		evaluated_at: input.evaluatedAt,
		advisory_only: true,
		non_authorizing: true,
		safe_next_actions: [...input.safeNextActions],
		dispatch_authority_enabled: false,
		approval_authority_enabled: false,
		provider_authority_enabled: false,
		runtime_authority_enabled: false,
		external_write_authority_enabled: false,
		remote_write_authority_enabled: false,
		fallback_authority_enabled: false,
		lane_launch_authority_enabled: false,
		write_authority_enabled: false,
		hard_chat_authority_enabled: false,
		routing_authority_enabled: false,
		model_selection_authority_enabled: false,
	};
	return { ok: true, errors: [], eligibility };
}

// ─── Validator ────────────────────────────────────────────────────────────────

export function validateFlowDeskSpecialistWorkflowEligibilityV1(value: unknown): ValidationResult {
	if (!isRecord(value)) return invalid("specialist workflow eligibility must be an object");
	const record = value as Record<string, unknown>;
	const errors: string[] = [];

	errors.push(...rejectUnknownProperties(record, specialistWorkflowEligibilityAllowedProperties, "specialist workflow eligibility").errors);

	if (record.schema_version !== "flowdesk.specialist_workflow_eligibility.v1") {
		errors.push("specialist workflow eligibility schema_version is invalid");
	}

	errors.push(...validateOpaqueId(record.eligibility_id, "eligibility_id").errors);
	errors.push(...validateOpaqueId(record.workflow_id, "workflow_id").errors);
	errors.push(...validateOpaqueRef(record.task_signature_ref, "task_signature_ref").errors);
	errors.push(...validateTimestamp(record.evaluated_at, "evaluated_at").errors);

	if (typeof record.eligibility_decision !== "string" || !specialistEligibilityDecisions.includes(record.eligibility_decision)) {
		errors.push("eligibility_decision must be 'eligible', 'ineligible', 'deferred', or 'blocked'");
	}

	if (typeof record.specialist_category !== "string" || !specialistCategories.includes(record.specialist_category)) {
		errors.push("specialist_category must be 'security', 'legal', 'medical', 'compliance', or 'unknown'");
	}

	if (typeof record.confidence_score !== "number" || !Number.isInteger(record.confidence_score) || record.confidence_score < 0 || record.confidence_score > 100) {
		errors.push("confidence_score must be an integer 0..100");
	}

	if (!Array.isArray(record.reason_refs) || (record.reason_refs as unknown[]).length > 10) {
		errors.push("reason_refs must be a bounded array (0..10 entries)");
	} else {
		for (const [index, ref] of (record.reason_refs as unknown[]).entries()) {
			errors.push(...validateOpaqueRef(ref, `reason_refs[${index}]`).errors);
		}
	}

	if (!Array.isArray(record.blocking_labels) || (record.blocking_labels as unknown[]).length > 10) {
		errors.push("blocking_labels must be a bounded array (0..10 entries)");
	} else {
		for (const [index, label] of (record.blocking_labels as unknown[]).entries()) {
			errors.push(...validateOpaqueRef(label, `blocking_labels[${index}]`).errors);
		}
	}

	if (record.eligibility_decision === "blocked" && Array.isArray(record.blocking_labels) && record.blocking_labels.length === 0) {
		errors.push("blocking_labels must be non-empty when eligibility_decision is 'blocked'");
	}

	if (!Array.isArray(record.safe_next_actions) || record.safe_next_actions.length === 0 || record.safe_next_actions.length > 8) {
		errors.push("safe_next_actions must be a non-empty bounded array (1..8 entries)");
	} else {
		for (const [index, action] of (record.safe_next_actions as unknown[]).entries()) {
			errors.push(...validateOpaqueRef(action, `safe_next_actions[${index}]`).errors);
		}
	}

	if (record.advisory_only !== true
		|| record.non_authorizing !== true
		|| record.dispatch_authority_enabled !== false
		|| record.approval_authority_enabled !== false
		|| record.provider_authority_enabled !== false
		|| record.runtime_authority_enabled !== false
		|| record.external_write_authority_enabled !== false
		|| record.remote_write_authority_enabled !== false
		|| record.fallback_authority_enabled !== false
		|| record.lane_launch_authority_enabled !== false
		|| record.write_authority_enabled !== false
		|| record.hard_chat_authority_enabled !== false
		|| record.routing_authority_enabled !== false
		|| record.model_selection_authority_enabled !== false) {
		errors.push("specialist workflow eligibility must remain advisory-only non-authorizing with no dispatch, approval, provider, runtime, external-write, remote-write, fallback, lane-launch, write, hard-chat, routing, or model-selection authority");
	}

	errors.push(...validateNoForbiddenRawPayloads(record, "specialist_workflow_eligibility").errors);
	return errors.length === 0 ? valid() : invalid(...errors);
}

// ─── Specialist Source Registers And Findings ────────────────────────────────

function validateSpecialistSafeNextActions(value: unknown, label: string): ValidationResult {
	if (!Array.isArray(value) || value.length === 0 || value.length > 8) return invalid(`${label} must be a non-empty bounded array (1..8 entries)`);
	const errors: string[] = [];
	for (const [index, action] of value.entries()) errors.push(...validateOpaqueRef(action, `${label}[${index}]`).errors);
	return errors.length === 0 ? valid() : invalid(...errors);
}

function validateSpecialistAuthorityFlags(record: Record<string, unknown>, label: string): ValidationResult {
	return record.advisory_only === true
		&& record.non_authorizing === true
		&& record.dispatch_authority_enabled === false
		&& record.approval_authority_enabled === false
		&& record.provider_authority_enabled === false
		&& record.runtime_authority_enabled === false
		&& record.external_write_authority_enabled === false
		&& record.remote_write_authority_enabled === false
		&& record.fallback_authority_enabled === false
		&& record.lane_launch_authority_enabled === false
		&& record.write_authority_enabled === false
		&& record.hard_chat_authority_enabled === false
		&& record.routing_authority_enabled === false
		&& record.model_selection_authority_enabled === false
		? valid()
		: invalid(`${label} must remain advisory-only non-authorizing with no dispatch, approval, provider, runtime, external-write, remote-write, fallback, lane-launch, write, hard-chat, routing, or model-selection authority`);
}

function specialistAuthorityFlags(): Pick<FlowDeskSpecialistSourceRegisterV1, typeof specialistAuthorityAllowedProperties[number]> {
	return {
		advisory_only: true,
		non_authorizing: true,
		safe_next_actions: [],
		dispatch_authority_enabled: false,
		approval_authority_enabled: false,
		provider_authority_enabled: false,
		runtime_authority_enabled: false,
		external_write_authority_enabled: false,
		remote_write_authority_enabled: false,
		fallback_authority_enabled: false,
		lane_launch_authority_enabled: false,
		write_authority_enabled: false,
		hard_chat_authority_enabled: false,
		routing_authority_enabled: false,
		model_selection_authority_enabled: false,
	};
}

function validateSpecialistSourceEntryV1(value: unknown, label: string): ValidationResult {
	if (!isRecord(value)) return invalid(`${label} must be an object`);
	const record = value as Record<string, unknown>;
	const errors: string[] = [];
	errors.push(...rejectUnknownProperties(record, specialistSourceEntryAllowedProperties, label).errors);
	errors.push(...validateOpaqueRef(record.source_ref, `${label}.source_ref`).errors);
	if (typeof record.source_domain !== "string" || !specialistSourceDomains.includes(record.source_domain)) errors.push(`${label}.source_domain must be 'patent' or 'medical_device'`);
	if (typeof record.source_type !== "string" || !specialistSourceTypes.includes(record.source_type)) errors.push(`${label}.source_type is invalid`);
	errors.push(...validateOpaqueRef(record.jurisdiction_ref, `${label}.jurisdiction_ref`).errors);
	if (record.approved_for_reference_pack !== true) errors.push(`${label}.approved_for_reference_pack must be true`);
	errors.push(...validateOpaqueRef(record.source_hash_ref, `${label}.source_hash_ref`).errors);
	return errors.length === 0 ? valid() : invalid(...errors);
}

export function createFlowDeskSpecialistSourceRegisterV1(input: {
	registerId: string;
	workflowId: string;
	sourceDomain: FlowDeskSpecialistSourceDomainV1;
	sourceEntries: FlowDeskSpecialistSourceEntryV1[];
	curationPolicyRef: string;
	approvedByRef: string;
	approvedAt: string;
	safeNextActions: string[];
}): FlowDeskSpecialistSourceRegisterResultV1 {
	const register: FlowDeskSpecialistSourceRegisterV1 = {
		schema_version: "flowdesk.specialist_source_register.v1",
		register_id: input.registerId,
		workflow_id: input.workflowId,
		source_domain: input.sourceDomain,
		source_entries: input.sourceEntries.map((entry) => ({ ...entry })),
		curation_policy_ref: input.curationPolicyRef,
		approved_by_ref: input.approvedByRef,
		approved_at: input.approvedAt,
		...specialistAuthorityFlags(),
		safe_next_actions: [...input.safeNextActions],
	};
	const validation = validateFlowDeskSpecialistSourceRegisterV1(register);
	return validation.ok ? { ok: true, errors: [], register } : { ok: false, errors: validation.errors };
}

export function validateFlowDeskSpecialistSourceRegisterV1(value: unknown): ValidationResult {
	if (!isRecord(value)) return invalid("specialist source register must be an object");
	const record = value as Record<string, unknown>;
	const errors: string[] = [];
	errors.push(...rejectUnknownProperties(record, specialistSourceRegisterAllowedProperties, "specialist source register").errors);
	if (record.schema_version !== "flowdesk.specialist_source_register.v1") errors.push("specialist source register schema_version is invalid");
	errors.push(...validateOpaqueId(record.register_id, "register_id").errors);
	errors.push(...validateOpaqueId(record.workflow_id, "workflow_id").errors);
	if (typeof record.source_domain !== "string" || !specialistSourceDomains.includes(record.source_domain)) errors.push("source_domain must be 'patent' or 'medical_device'");
	if (!Array.isArray(record.source_entries) || record.source_entries.length === 0 || record.source_entries.length > 20) {
		errors.push("source_entries must be a non-empty bounded array (1..20 entries)");
	} else {
		for (const [index, entry] of record.source_entries.entries()) {
			errors.push(...validateSpecialistSourceEntryV1(entry, `source_entries[${index}]`).errors);
			if (isRecord(entry) && entry.source_domain !== record.source_domain) errors.push(`source_entries[${index}].source_domain must match register source_domain`);
		}
	}
	errors.push(...validateOpaqueRef(record.curation_policy_ref, "curation_policy_ref").errors);
	errors.push(...validateOpaqueRef(record.approved_by_ref, "approved_by_ref").errors);
	errors.push(...validateTimestamp(record.approved_at, "approved_at").errors);
	errors.push(...validateSpecialistSafeNextActions(record.safe_next_actions, "safe_next_actions").errors);
	errors.push(...validateSpecialistAuthorityFlags(record, "specialist source register").errors);
	errors.push(...validateNoForbiddenRawPayloads(record, "specialist_source_register").errors);
	return errors.length === 0 ? valid() : invalid(...errors);
}

export function createFlowDeskSpecialistFindingV1(input: {
	findingId: string;
	workflowId: string;
	taskRef: string;
	specialistCategory: FlowDeskSpecialistCategoryV1;
	sourceRegisterRef: string;
	referencePackRefs: string[];
	findingSummaryRef: string;
	findingStatus: FlowDeskSpecialistFindingStatusV1;
	confidenceScore: number;
	uncertaintyLabels?: string[];
	generatedAt: string;
	safeNextActions: string[];
}): FlowDeskSpecialistFindingResultV1 {
	const finding: FlowDeskSpecialistFindingV1 = {
		schema_version: "flowdesk.specialist_finding.v1",
		finding_id: input.findingId,
		workflow_id: input.workflowId,
		task_ref: input.taskRef,
		specialist_category: input.specialistCategory,
		source_register_ref: input.sourceRegisterRef,
		reference_pack_refs: [...input.referencePackRefs],
		finding_summary_ref: input.findingSummaryRef,
		finding_status: input.findingStatus,
		confidence_score: input.confidenceScore,
		uncertainty_labels: [...(input.uncertaintyLabels ?? [])],
		generated_at: input.generatedAt,
		human_review_required: true,
		final_professional_decision: false,
		product_decision_authority_enabled: false,
		...specialistAuthorityFlags(),
		safe_next_actions: [...input.safeNextActions],
	};
	const validation = validateFlowDeskSpecialistFindingV1(finding);
	return validation.ok ? { ok: true, errors: [], finding } : { ok: false, errors: validation.errors };
}

export function validateFlowDeskSpecialistFindingV1(value: unknown): ValidationResult {
	if (!isRecord(value)) return invalid("specialist finding must be an object");
	const record = value as Record<string, unknown>;
	const errors: string[] = [];
	errors.push(...rejectUnknownProperties(record, specialistFindingAllowedProperties, "specialist finding").errors);
	if (record.schema_version !== "flowdesk.specialist_finding.v1") errors.push("specialist finding schema_version is invalid");
	errors.push(...validateOpaqueId(record.finding_id, "finding_id").errors);
	errors.push(...validateOpaqueId(record.workflow_id, "workflow_id").errors);
	errors.push(...validateOpaqueRef(record.task_ref, "task_ref").errors);
	if (typeof record.specialist_category !== "string" || !specialistCategories.includes(record.specialist_category)) errors.push("specialist_category must be 'security', 'legal', 'medical', 'compliance', or 'unknown'");
	errors.push(...validateOpaqueRef(record.source_register_ref, "source_register_ref").errors);
	if (!Array.isArray(record.reference_pack_refs) || record.reference_pack_refs.length === 0 || record.reference_pack_refs.length > 10) {
		errors.push("reference_pack_refs must be a non-empty bounded array (1..10 entries)");
	} else {
		for (const [index, ref] of record.reference_pack_refs.entries()) errors.push(...validateOpaqueRef(ref, `reference_pack_refs[${index}]`).errors);
	}
	errors.push(...validateOpaqueRef(record.finding_summary_ref, "finding_summary_ref").errors);
	if (typeof record.finding_status !== "string" || !specialistFindingStatuses.includes(record.finding_status)) errors.push("finding_status is invalid");
	if (typeof record.confidence_score !== "number" || !Number.isInteger(record.confidence_score) || record.confidence_score < 0 || record.confidence_score > 100) errors.push("confidence_score must be an integer 0..100");
	if (!Array.isArray(record.uncertainty_labels) || record.uncertainty_labels.length > 10) {
		errors.push("uncertainty_labels must be a bounded array (0..10 entries)");
	} else {
		for (const [index, label] of record.uncertainty_labels.entries()) errors.push(...validateBoundedLabel(label, `uncertainty_labels[${index}]`).errors);
	}
	errors.push(...validateTimestamp(record.generated_at, "generated_at").errors);
	if (record.human_review_required !== true) errors.push("human_review_required must be true");
	if (record.final_professional_decision !== false) errors.push("final_professional_decision must be false");
	if (record.product_decision_authority_enabled !== false) errors.push("product_decision_authority_enabled must be false");
	errors.push(...validateSpecialistSafeNextActions(record.safe_next_actions, "safe_next_actions").errors);
	errors.push(...validateSpecialistAuthorityFlags(record, "specialist finding").errors);
	errors.push(...validateNoForbiddenRawPayloads(record, "specialist_finding").errors);
	return errors.length === 0 ? valid() : invalid(...errors);
}

export function createFlowDeskHumanReviewBoundaryV1(input: {
	boundaryId: string;
	workflowId: string;
	findingRef: string;
	signoffStatus: FlowDeskHumanReviewSignoffStatusV1;
	humanReviewerRef?: string;
	humanSignoffRef?: string;
	signoffRecordedAt?: string;
	safeNextActions: string[];
}): FlowDeskHumanReviewBoundaryResultV1 {
	const boundary: FlowDeskHumanReviewBoundaryV1 = {
		schema_version: "flowdesk.human_review_boundary.v1",
		boundary_id: input.boundaryId,
		workflow_id: input.workflowId,
		finding_ref: input.findingRef,
		human_review_required: true,
		signoff_status: input.signoffStatus,
		...(input.humanReviewerRef === undefined ? {} : { human_reviewer_ref: input.humanReviewerRef }),
		...(input.humanSignoffRef === undefined ? {} : { human_signoff_ref: input.humanSignoffRef }),
		...(input.signoffRecordedAt === undefined ? {} : { signoff_recorded_at: input.signoffRecordedAt }),
		product_decision_use_allowed_without_human_signoff: false,
		final_professional_decision: false,
		professional_decision_authority_enabled: false,
		...specialistAuthorityFlags(),
		safe_next_actions: [...input.safeNextActions],
	};
	const validation = validateFlowDeskHumanReviewBoundaryV1(boundary);
	return validation.ok ? { ok: true, errors: [], boundary } : { ok: false, errors: validation.errors };
}

export function validateFlowDeskHumanReviewBoundaryV1(value: unknown): ValidationResult {
	if (!isRecord(value)) return invalid("human review boundary must be an object");
	const record = value as Record<string, unknown>;
	const errors: string[] = [];
	errors.push(...rejectUnknownProperties(record, humanReviewBoundaryAllowedProperties, "human review boundary").errors);
	if (record.schema_version !== "flowdesk.human_review_boundary.v1") errors.push("human review boundary schema_version is invalid");
	errors.push(...validateOpaqueId(record.boundary_id, "boundary_id").errors);
	errors.push(...validateOpaqueId(record.workflow_id, "workflow_id").errors);
	errors.push(...validateOpaqueRef(record.finding_ref, "finding_ref").errors);
	if (record.human_review_required !== true) errors.push("human_review_required must be true");
	if (typeof record.signoff_status !== "string" || !humanReviewSignoffStatuses.includes(record.signoff_status)) errors.push("signoff_status is invalid");
	if (record.human_reviewer_ref !== undefined) errors.push(...validateOpaqueRef(record.human_reviewer_ref, "human_reviewer_ref").errors);
	if (record.human_signoff_ref !== undefined) errors.push(...validateOpaqueRef(record.human_signoff_ref, "human_signoff_ref").errors);
	if (record.signoff_recorded_at !== undefined) errors.push(...validateTimestamp(record.signoff_recorded_at, "signoff_recorded_at").errors);
	if (record.signoff_status === "signed_off") {
		errors.push(...validateOpaqueRef(record.human_reviewer_ref, "human_reviewer_ref").errors);
		errors.push(...validateOpaqueRef(record.human_signoff_ref, "human_signoff_ref").errors);
		errors.push(...validateTimestamp(record.signoff_recorded_at, "signoff_recorded_at").errors);
	}
	if (record.product_decision_use_allowed_without_human_signoff !== false) errors.push("product_decision_use_allowed_without_human_signoff must be false");
	if (record.final_professional_decision !== false) errors.push("final_professional_decision must be false");
	if (record.professional_decision_authority_enabled !== false) errors.push("professional_decision_authority_enabled must be false");
	errors.push(...validateSpecialistSafeNextActions(record.safe_next_actions, "safe_next_actions").errors);
	errors.push(...validateSpecialistAuthorityFlags(record, "human review boundary").errors);
	errors.push(...validateNoForbiddenRawPayloads(record, "human_review_boundary").errors);
	return errors.length === 0 ? valid() : invalid(...errors);
}
