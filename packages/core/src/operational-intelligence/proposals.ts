/**
 * Workflow plan proposal contracts.
 * P7-S13.5 submodule: proposals
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
	validateAdvisoryAuthorityFlags,
	validateHardFilterFields,
} from "./shared.js";

// ─── Interfaces ───────────────────────────────────────────────────────────────

export interface FlowDeskWorkflowPlanProposalCandidateV1 {
	candidate_ref: string;
	candidate_label: string;
	candidate_summary_ref: string;
	hard_filter_state: "passed" | "blocked";
	blocked_labels: string[];
}

export interface FlowDeskWorkflowPlanProposalV1 {
	schema_version: "flowdesk.workflow_plan_proposal.v1";
	proposal_id: string;
	workflow_id: string;
	proposal_label: string;
	advisory_summary_ref: string;
	candidates: FlowDeskWorkflowPlanProposalCandidateV1[];
	created_at?: string;
	source?: string;
	source_ref?: string;
	variant?: "simple" | "standard" | "detailed" | "high_assurance";
	redacted_intake_refs?: string[];
	taxonomy_axes?: string[];
	taxonomy_refs?: string[];
	step_summary?: string;
	write_summary?: string;
	verification_summary?: string;
	rollback_summary?: string;
	cost_estimate_ref?: string;
	latency_estimate_ref?: string;
	provenance_refs?: string[];
	safe_next_actions?: string[];
	advisory_only: true;
	release_gate: "operational_intelligence_later_gate";
	dispatch_authority_enabled: false;
	approval_authority_enabled: false;
	provider_authority_enabled: false;
	runtime_authority_enabled: false;
	external_write_authority_enabled: false;
	fallback_authority_enabled: false;
	lane_launch_authority_enabled: false;
}

export interface FlowDeskWorkflowPlanProposalSetV1 {
	schema_version: "flowdesk.workflow_plan_proposal_set.v1";
	proposal_set_id: string;
	workflow_id: string;
	created_at: string;
	simple_proposal: FlowDeskWorkflowPlanProposalV1;
	standard_proposal: FlowDeskWorkflowPlanProposalV1;
	detailed_proposal: FlowDeskWorkflowPlanProposalV1;
	high_assurance_proposal: FlowDeskWorkflowPlanProposalV1;
	metadata_refs: string[];
	evidence_refs: string[];
	advisory_only: true;
	dispatch_authority_enabled: false;
	approval_authority_enabled: false;
	provider_authority_enabled: false;
	runtime_authority_enabled: false;
	external_write_authority_enabled: false;
	fallback_authority_enabled: false;
	lane_launch_authority_enabled: false;
}

export interface FlowDeskWorkflowPlanProposalScoreEventV1 {
	schema_version: "flowdesk.workflow_plan_proposal_score_event.v1";
	score_event_id: string;
	workflow_id: string;
	proposal_id: string;
	candidate_ref: string;
	score_kind: "advisory_workflow_plan_proposal";
	hard_filter_state: "passed" | "blocked";
	blocked_labels: string[];
	advisory_score: number;
	score_reason_ref: string;
	advisory_only: true;
	release_gate: "operational_intelligence_later_gate";
	dispatch_authority_enabled: false;
	approval_authority_enabled: false;
	provider_authority_enabled: false;
	runtime_authority_enabled: false;
	external_write_authority_enabled: false;
	fallback_authority_enabled: false;
	lane_launch_authority_enabled: false;
}

// ─── Creators ─────────────────────────────────────────────────────────────────

export function createFlowDeskWorkflowPlanProposalV1(input: {
	proposalId: string;
	workflowId: string;
	proposalLabel: string;
	advisorySummaryRef: string;
	candidates: Array<{
		candidateRef: string;
		candidateLabel: string;
		candidateSummaryRef: string;
		hardFiltersPassed: boolean;
		blockedLabels?: string[];
	}>;
	createdAt?: string;
	source?: string;
	sourceRef?: string;
	variant?: "simple" | "standard" | "detailed" | "high_assurance";
	redactedIntakeRefs?: string[];
	taxonomyAxes?: string[];
	taxonomyRefs?: string[];
	stepSummary?: string;
	writeSummary?: string;
	verificationSummary?: string;
	rollbackSummary?: string;
	costEstimateRef?: string;
	latencyEstimateRef?: string;
	provenanceRefs?: string[];
	safeNextActions?: string[];
}): FlowDeskWorkflowPlanProposalV1 {
	return {
		schema_version: "flowdesk.workflow_plan_proposal.v1",
		proposal_id: input.proposalId,
		workflow_id: input.workflowId,
		proposal_label: input.proposalLabel,
		advisory_summary_ref: input.advisorySummaryRef,
		candidates: input.candidates.map((candidate) => ({
			candidate_ref: candidate.candidateRef,
			candidate_label: candidate.candidateLabel,
			candidate_summary_ref: candidate.candidateSummaryRef,
			hard_filter_state: candidate.hardFiltersPassed ? "passed" : "blocked",
			blocked_labels: [...(candidate.blockedLabels ?? [])],
		})),
		created_at: input.createdAt,
		source: input.source,
		source_ref: input.sourceRef,
		variant: input.variant,
		redacted_intake_refs: input.redactedIntakeRefs ? [...input.redactedIntakeRefs] : undefined,
		taxonomy_axes: input.taxonomyAxes ? [...input.taxonomyAxes] : undefined,
		taxonomy_refs: input.taxonomyRefs ? [...input.taxonomyRefs] : undefined,
		step_summary: input.stepSummary,
		write_summary: input.writeSummary,
		verification_summary: input.verificationSummary,
		rollback_summary: input.rollbackSummary,
		cost_estimate_ref: input.costEstimateRef,
		latency_estimate_ref: input.latencyEstimateRef,
		provenance_refs: input.provenanceRefs ? [...input.provenanceRefs] : undefined,
		safe_next_actions: input.safeNextActions ? [...input.safeNextActions] : undefined,
		advisory_only: true,
		release_gate: "operational_intelligence_later_gate",
		dispatch_authority_enabled: false,
		approval_authority_enabled: false,
		provider_authority_enabled: false,
		runtime_authority_enabled: false,
		external_write_authority_enabled: false,
		fallback_authority_enabled: false,
		lane_launch_authority_enabled: false,
	};
}

export function createFlowDeskWorkflowPlanProposalSetV1(input: {
	proposalSetId: string;
	workflowId: string;
	createdAt: string;
	simpleProposal: FlowDeskWorkflowPlanProposalV1;
	standardProposal: FlowDeskWorkflowPlanProposalV1;
	detailedProposal: FlowDeskWorkflowPlanProposalV1;
	highAssuranceProposal: FlowDeskWorkflowPlanProposalV1;
	metadataRefs?: string[];
	evidenceRefs?: string[];
}): FlowDeskWorkflowPlanProposalSetV1 {
	return {
		schema_version: "flowdesk.workflow_plan_proposal_set.v1",
		proposal_set_id: input.proposalSetId,
		workflow_id: input.workflowId,
		created_at: input.createdAt,
		simple_proposal: input.simpleProposal,
		standard_proposal: input.standardProposal,
		detailed_proposal: input.detailedProposal,
		high_assurance_proposal: input.highAssuranceProposal,
		metadata_refs: input.metadataRefs ? [...input.metadataRefs] : [],
		evidence_refs: input.evidenceRefs ? [...input.evidenceRefs] : [],
		advisory_only: true,
		dispatch_authority_enabled: false,
		approval_authority_enabled: false,
		provider_authority_enabled: false,
		runtime_authority_enabled: false,
		external_write_authority_enabled: false,
		fallback_authority_enabled: false,
		lane_launch_authority_enabled: false,
	};
}

export function createFlowDeskWorkflowPlanProposalScoreEventV1(input: {
	scoreEventId: string;
	workflowId: string;
	proposalId: string;
	candidateRef: string;
	hardFiltersPassed: boolean;
	blockedLabels?: string[];
	advisoryScore: number;
	scoreReasonRef: string;
}): FlowDeskWorkflowPlanProposalScoreEventV1 {
	return {
		schema_version: "flowdesk.workflow_plan_proposal_score_event.v1",
		score_event_id: input.scoreEventId,
		workflow_id: input.workflowId,
		proposal_id: input.proposalId,
		candidate_ref: input.candidateRef,
		score_kind: "advisory_workflow_plan_proposal",
		hard_filter_state: input.hardFiltersPassed ? "passed" : "blocked",
		blocked_labels: [...(input.blockedLabels ?? [])],
		advisory_score: input.hardFiltersPassed ? input.advisoryScore : 0,
		score_reason_ref: input.scoreReasonRef,
		advisory_only: true,
		release_gate: "operational_intelligence_later_gate",
		dispatch_authority_enabled: false,
		approval_authority_enabled: false,
		provider_authority_enabled: false,
		runtime_authority_enabled: false,
		external_write_authority_enabled: false,
		fallback_authority_enabled: false,
		lane_launch_authority_enabled: false,
	};
}

// ─── Validators ───────────────────────────────────────────────────────────────

export function validateFlowDeskWorkflowPlanProposalV1(value: unknown): ValidationResult {
	if (!isRecord(value)) return invalid("workflow plan proposal must be an object");
	const record = value as Partial<FlowDeskWorkflowPlanProposalV1>;
	const errors: string[] = [];
	errors.push(...rejectUnknownProperties(record, [
		"schema_version",
		"proposal_id",
		"workflow_id",
		"proposal_label",
		"advisory_summary_ref",
		"candidates",
		"created_at",
		"source",
		"source_ref",
		"variant",
		"redacted_intake_refs",
		"taxonomy_axes",
		"taxonomy_refs",
		"step_summary",
		"write_summary",
		"verification_summary",
		"rollback_summary",
		"cost_estimate_ref",
		"latency_estimate_ref",
		"provenance_refs",
		"safe_next_actions",
		"advisory_only",
		"release_gate",
		"dispatch_authority_enabled",
		"approval_authority_enabled",
		"provider_authority_enabled",
		"runtime_authority_enabled",
		"external_write_authority_enabled",
		"fallback_authority_enabled",
		"lane_launch_authority_enabled",
	], "workflow plan proposal").errors);
	errors.push(...validateOpaqueId(record.proposal_id, "proposal_id").errors);
	errors.push(...validateOpaqueId(record.workflow_id, "workflow_id").errors);
	errors.push(...validateBoundedLabel(record.proposal_label, "proposal_label").errors);
	errors.push(...validateOpaqueRef(record.advisory_summary_ref, "advisory_summary_ref").errors);
	if (record.schema_version !== "flowdesk.workflow_plan_proposal.v1") errors.push("workflow plan proposal schema_version is invalid");
	if (record.release_gate !== "operational_intelligence_later_gate") errors.push("workflow plan proposal release_gate is invalid");
	if (!Array.isArray(record.candidates) || record.candidates.length === 0) errors.push("candidates must be a non-empty array");
	else for (const [index, candidate] of record.candidates.entries()) {
		if (!isRecord(candidate)) {
			errors.push(`candidates[${index}] must be an object`);
			continue;
		}
		errors.push(...rejectUnknownProperties(candidate, ["candidate_ref", "candidate_label", "candidate_summary_ref", "hard_filter_state", "blocked_labels"], `candidates[${index}]`).errors);
		errors.push(...validateOpaqueRef(candidate.candidate_ref as string, `candidates[${index}].candidate_ref`).errors);
		errors.push(...validateBoundedLabel(candidate.candidate_label as string, `candidates[${index}].candidate_label`).errors);
		errors.push(...validateOpaqueRef(candidate.candidate_summary_ref as string, `candidates[${index}].candidate_summary_ref`).errors);
		errors.push(...validateHardFilterFields(candidate, `candidates[${index}]`).errors);
	}
	if (record.created_at !== undefined && (typeof record.created_at !== "string" || isNaN(Date.parse(record.created_at)))) errors.push("created_at must be a valid ISO 8601 timestamp string");
	if (record.source !== undefined) errors.push(...validateBoundedLabel(record.source, "source").errors);
	if (record.source_ref !== undefined) errors.push(...validateOpaqueRef(record.source_ref, "source_ref").errors);
	if (record.variant !== undefined && !["simple", "standard", "detailed", "high_assurance"].includes(record.variant)) errors.push("variant must be simple, standard, detailed, or high_assurance");
	if (record.redacted_intake_refs !== undefined) {
		if (!Array.isArray(record.redacted_intake_refs)) errors.push("redacted_intake_refs must be an array of refs");
		else for (const ref of record.redacted_intake_refs) errors.push(...validateOpaqueRef(ref, "redacted_intake_refs").errors);
	}
	if (record.taxonomy_axes !== undefined) {
		if (!Array.isArray(record.taxonomy_axes)) errors.push("taxonomy_axes must be an array of axes");
		else for (const axis of record.taxonomy_axes) errors.push(...validateBoundedLabel(axis, "taxonomy_axes").errors);
	}
	if (record.taxonomy_refs !== undefined) {
		if (!Array.isArray(record.taxonomy_refs)) errors.push("taxonomy_refs must be an array of refs");
		else for (const ref of record.taxonomy_refs) errors.push(...validateOpaqueRef(ref, "taxonomy_refs").errors);
	}
	if (record.step_summary !== undefined) errors.push(...validateBoundedLabel(record.step_summary, "step_summary").errors);
	if (record.write_summary !== undefined) errors.push(...validateBoundedLabel(record.write_summary, "write_summary").errors);
	if (record.verification_summary !== undefined) errors.push(...validateBoundedLabel(record.verification_summary, "verification_summary").errors);
	if (record.rollback_summary !== undefined) errors.push(...validateBoundedLabel(record.rollback_summary, "rollback_summary").errors);
	if (record.cost_estimate_ref !== undefined) errors.push(...validateOpaqueRef(record.cost_estimate_ref, "cost_estimate_ref").errors);
	if (record.latency_estimate_ref !== undefined) errors.push(...validateOpaqueRef(record.latency_estimate_ref, "latency_estimate_ref").errors);
	if (record.provenance_refs !== undefined) {
		if (!Array.isArray(record.provenance_refs)) errors.push("provenance_refs must be an array of refs");
		else for (const ref of record.provenance_refs) errors.push(...validateOpaqueRef(ref, "provenance_refs").errors);
	}
	if (record.safe_next_actions !== undefined) {
		if (!Array.isArray(record.safe_next_actions)) errors.push("safe_next_actions must be an array");
		else for (const action of record.safe_next_actions) errors.push(...validateBoundedLabel(action, "safe_next_actions").errors);
	}
	errors.push(...validateAdvisoryAuthorityFlags(record, "workflow plan proposal").errors);
	errors.push(...validateNoForbiddenRawPayloads(record, "workflow_plan_proposal").errors);
	return errors.length === 0 ? valid() : invalid(...errors);
}

export function validateFlowDeskWorkflowPlanProposalSetV1(value: unknown): ValidationResult {
	if (!isRecord(value)) return invalid("workflow plan proposal set must be an object");
	const record = value as Partial<FlowDeskWorkflowPlanProposalSetV1>;
	const errors: string[] = [];
	errors.push(...rejectUnknownProperties(record, [
		"schema_version",
		"proposal_set_id",
		"workflow_id",
		"created_at",
		"simple_proposal",
		"standard_proposal",
		"detailed_proposal",
		"high_assurance_proposal",
		"metadata_refs",
		"evidence_refs",
		"advisory_only",
		"dispatch_authority_enabled",
		"approval_authority_enabled",
		"provider_authority_enabled",
		"runtime_authority_enabled",
		"external_write_authority_enabled",
		"fallback_authority_enabled",
		"lane_launch_authority_enabled",
	], "workflow plan proposal set").errors);

	if (record.schema_version !== "flowdesk.workflow_plan_proposal_set.v1") errors.push("workflow plan proposal set schema_version is invalid");
	errors.push(...validateOpaqueId(record.proposal_set_id, "proposal_set_id").errors);
	errors.push(...validateOpaqueId(record.workflow_id, "workflow_id").errors);

	if (typeof record.created_at !== "string" || isNaN(Date.parse(record.created_at))) {
		errors.push("created_at must be a valid ISO 8601 timestamp string");
	}

	const variants = [
		{ name: "simple_proposal", prop: record.simple_proposal, expectedVariant: "simple" },
		{ name: "standard_proposal", prop: record.standard_proposal, expectedVariant: "standard" },
		{ name: "detailed_proposal", prop: record.detailed_proposal, expectedVariant: "detailed" },
		{ name: "high_assurance_proposal", prop: record.high_assurance_proposal, expectedVariant: "high_assurance" }
	];

	for (const { name, prop, expectedVariant } of variants) {
		if (prop === undefined) {
			errors.push(`${name} is missing`);
		} else {
			const subErrors = validateFlowDeskWorkflowPlanProposalV1(prop).errors;
			errors.push(...subErrors.map(e => `${name}.${e}`));
			if (subErrors.length === 0 && (prop as FlowDeskWorkflowPlanProposalV1).variant !== expectedVariant) {
				errors.push(`${name} must have variant '${expectedVariant}'`);
			}
		}
	}

	if (record.metadata_refs !== undefined) {
		if (!Array.isArray(record.metadata_refs)) errors.push("metadata_refs must be an array of refs");
		else for (const ref of record.metadata_refs) errors.push(...validateOpaqueRef(ref, "metadata_refs").errors);
	}

	if (record.evidence_refs !== undefined) {
		if (!Array.isArray(record.evidence_refs)) errors.push("evidence_refs must be an array of refs");
		else for (const ref of record.evidence_refs) errors.push(...validateOpaqueRef(ref, "evidence_refs").errors);
	}

	errors.push(...validateAdvisoryAuthorityFlags(record, "workflow plan proposal set").errors);
	errors.push(...validateNoForbiddenRawPayloads(record, "workflow_plan_proposal_set").errors);

	return errors.length === 0 ? valid() : invalid(...errors);
}

export function validateFlowDeskWorkflowPlanProposalScoreEventV1(value: unknown): ValidationResult {
	if (!isRecord(value)) return invalid("workflow plan proposal score event must be an object");
	const record = value as Partial<FlowDeskWorkflowPlanProposalScoreEventV1>;
	const errors: string[] = [];
	errors.push(...rejectUnknownProperties(record, [
		"schema_version",
		"score_event_id",
		"workflow_id",
		"proposal_id",
		"candidate_ref",
		"score_kind",
		"hard_filter_state",
		"blocked_labels",
		"advisory_score",
		"score_reason_ref",
		"advisory_only",
		"release_gate",
		"dispatch_authority_enabled",
		"approval_authority_enabled",
		"provider_authority_enabled",
		"runtime_authority_enabled",
		"external_write_authority_enabled",
		"fallback_authority_enabled",
		"lane_launch_authority_enabled",
	], "workflow plan proposal score event").errors);
	errors.push(...validateOpaqueId(record.score_event_id, "score_event_id").errors);
	errors.push(...validateOpaqueId(record.workflow_id, "workflow_id").errors);
	errors.push(...validateOpaqueId(record.proposal_id, "proposal_id").errors);
	errors.push(...validateOpaqueRef(record.candidate_ref, "candidate_ref").errors);
	errors.push(...validateOpaqueRef(record.score_reason_ref, "score_reason_ref").errors);
	if (record.schema_version !== "flowdesk.workflow_plan_proposal_score_event.v1") errors.push("workflow plan proposal score event schema_version is invalid");
	if (record.score_kind !== "advisory_workflow_plan_proposal") errors.push("workflow plan proposal score event score_kind is invalid");
	if (record.release_gate !== "operational_intelligence_later_gate") errors.push("workflow plan proposal score event release_gate is invalid");
	errors.push(...validateHardFilterFields(record, "workflow plan proposal score event").errors);
	errors.push(...validateAdvisoryAuthorityFlags(record, "workflow plan proposal score event").errors);
	errors.push(...validateNoForbiddenRawPayloads(record, "workflow_plan_proposal_score_event").errors);
	return errors.length === 0 ? valid() : invalid(...errors);
}
