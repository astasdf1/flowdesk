import { invalid, type ValidationResult, valid, validateNoForbiddenRawPayloads, validateOpaqueId, validateOpaqueRef } from "./validators.js";

export interface FlowDeskOperationalIntelligenceScoreV1 {
	schema_version: "flowdesk.operational_intelligence_score.v1";
	score_id: string;
	workflow_id: string;
	candidate_ref: string;
	hard_filter_state: "passed" | "blocked";
	blocked_labels: string[];
	advisory_score: number;
	score_reason_ref: string;
	advisory_only: true;
	dispatch_authority_enabled: false;
	approval_authority_enabled: false;
	provider_authority_enabled: false;
	runtime_authority_enabled: false;
	external_write_authority_enabled: false;
	fallback_authority_enabled: false;
	lane_launch_authority_enabled: false;
}

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

export interface FlowDeskReferencePackV1 {
	schema_version: "flowdesk.reference_pack.v1";
	pack_id: string;
	workflow_id: string;
	source_refs: string[];
	source_hash_refs: string[];
	specialist_signoff: false;
	professional_advice: false;
	advisory_only: true;
	external_write_authority_enabled: false;
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

function rejectUnknownProperties(record: Record<string, unknown>, allowed: readonly string[], label: string): ValidationResult {
	const unknown = Object.keys(record).filter((key) => !allowed.includes(key));
	return unknown.length === 0 ? valid() : invalid(`${label} unknown properties: ${unknown.join(",")}`);
}

function validateBoundedLabel(value: unknown, label: string): ValidationResult {
	if (typeof value !== "string" || value.length < 1 || value.length > 120) return invalid(`${label} must be a bounded 1..120 string`);
	if (/\p{C}/u.test(value)) return invalid(`${label} must not contain control characters`);
	return validateNoForbiddenRawPayloads(value, label);
}

function validateAdvisoryAuthorityFlags(record: Record<string, unknown>, label: string): ValidationResult {
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

function validateHardFilterFields(record: { hard_filter_state?: unknown; blocked_labels?: unknown; advisory_score?: unknown }, label: string): ValidationResult {
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

export function createFlowDeskOperationalIntelligenceScoreV1(input: {
	scoreId: string;
	workflowId: string;
	candidateRef: string;
	hardFiltersPassed: boolean;
	blockedLabels?: string[];
	advisoryScore: number;
	scoreReasonRef: string;
}): FlowDeskOperationalIntelligenceScoreV1 {
	return {
		schema_version: "flowdesk.operational_intelligence_score.v1",
		score_id: input.scoreId,
		workflow_id: input.workflowId,
		candidate_ref: input.candidateRef,
		hard_filter_state: input.hardFiltersPassed ? "passed" : "blocked",
		blocked_labels: [...(input.blockedLabels ?? [])],
		advisory_score: input.hardFiltersPassed ? input.advisoryScore : 0,
		score_reason_ref: input.scoreReasonRef,
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

export function validateFlowDeskOperationalIntelligenceScoreV1(value: unknown): ValidationResult {
	if (!isRecord(value)) return invalid("operational intelligence score must be an object");
	const record = value as Partial<FlowDeskOperationalIntelligenceScoreV1>;
	const errors: string[] = [];
	errors.push(...rejectUnknownProperties(record, [
		"schema_version",
		"score_id",
		"workflow_id",
		"candidate_ref",
		"hard_filter_state",
		"blocked_labels",
		"advisory_score",
		"score_reason_ref",
		"advisory_only",
		"dispatch_authority_enabled",
		"approval_authority_enabled",
		"provider_authority_enabled",
		"runtime_authority_enabled",
		"external_write_authority_enabled",
		"fallback_authority_enabled",
		"lane_launch_authority_enabled",
	], "operational intelligence score").errors);
	errors.push(...validateOpaqueId(record.score_id, "score_id").errors);
	errors.push(...validateOpaqueId(record.workflow_id, "workflow_id").errors);
	errors.push(...validateOpaqueRef(record.candidate_ref, "candidate_ref").errors);
	errors.push(...validateOpaqueRef(record.score_reason_ref, "score_reason_ref").errors);
	if (record.schema_version !== "flowdesk.operational_intelligence_score.v1") errors.push("score schema_version is invalid");
	if (record.hard_filter_state !== "passed" && record.hard_filter_state !== "blocked") errors.push("hard_filter_state is invalid");
	errors.push(...validateHardFilterFields(record, "operational intelligence score").errors);
	errors.push(...validateAdvisoryAuthorityFlags(record, "operational intelligence score").errors);
	errors.push(...validateNoForbiddenRawPayloads(record, "operational_intelligence_score").errors);
	return errors.length === 0 ? valid() : invalid(...errors);
}

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
		errors.push(...validateOpaqueRef(candidate.candidate_ref, `candidates[${index}].candidate_ref`).errors);
		errors.push(...validateBoundedLabel(candidate.candidate_label, `candidates[${index}].candidate_label`).errors);
		errors.push(...validateOpaqueRef(candidate.candidate_summary_ref, `candidates[${index}].candidate_summary_ref`).errors);
		errors.push(...validateHardFilterFields(candidate, `candidates[${index}]`).errors);
	}
	errors.push(...validateAdvisoryAuthorityFlags(record, "workflow plan proposal").errors);
	errors.push(...validateNoForbiddenRawPayloads(record, "workflow_plan_proposal").errors);
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

export function validateFlowDeskReferencePackV1(value: unknown): ValidationResult {
	if (!isRecord(value)) return invalid("reference pack must be an object");
	const record = value as Partial<FlowDeskReferencePackV1>;
	const errors: string[] = [];
	errors.push(...rejectUnknownProperties(record, [
		"schema_version",
		"pack_id",
		"workflow_id",
		"source_refs",
		"source_hash_refs",
		"specialist_signoff",
		"professional_advice",
		"advisory_only",
		"external_write_authority_enabled",
	], "reference pack").errors);
	errors.push(...validateOpaqueId(record.pack_id, "pack_id").errors);
	errors.push(...validateOpaqueId(record.workflow_id, "workflow_id").errors);
	errors.push(...refs(record.source_refs, "source_refs").errors);
	errors.push(...refs(record.source_hash_refs, "source_hash_refs").errors);
	if (Array.isArray(record.source_refs) && Array.isArray(record.source_hash_refs) && record.source_refs.length !== record.source_hash_refs.length) errors.push("source_refs and source_hash_refs must align one-to-one");
	if (record.schema_version !== "flowdesk.reference_pack.v1") errors.push("reference pack schema_version is invalid");
	if (record.specialist_signoff !== false || record.professional_advice !== false || record.advisory_only !== true || record.external_write_authority_enabled !== false) errors.push("reference pack cannot act as signoff or external write authority");
	errors.push(...validateNoForbiddenRawPayloads(record, "reference_pack").errors);
	return errors.length === 0 ? valid() : invalid(...errors);
}
