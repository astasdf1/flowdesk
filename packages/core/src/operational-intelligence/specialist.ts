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

export interface FlowDeskSpecialistWorkflowEligibilityResultV1 {
	ok: boolean;
	errors: string[];
	eligibility?: FlowDeskSpecialistWorkflowEligibilityV1;
}

// ─── Constants ────────────────────────────────────────────────────────────────

const specialistEligibilityDecisions: readonly string[] = ["eligible", "ineligible", "deferred", "blocked"];
const specialistCategories: readonly string[] = ["security", "legal", "medical", "compliance", "unknown"];

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
