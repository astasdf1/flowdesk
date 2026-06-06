import { invalid, type ValidationResult, valid, validateNoForbiddenRawPayloads, validateOpaqueId, validateOpaqueRef } from "./validators.js";

export type FlowDeskEvaluationOutcomeLabelV1 = "accepted" | "rejected" | "neutral" | "blocked" | "inconclusive";
export type FlowDeskEvaluationScoreDimensionNameV1 = "correctness" | "safety" | "utility" | "cost" | "latency" | "policy_fit" | "redaction_fit";

export interface FlowDeskEvaluationScoreDimensionV1 {
	dimension: FlowDeskEvaluationScoreDimensionNameV1;
	score: number;
	weight: number;
	outcome_label: FlowDeskEvaluationOutcomeLabelV1;
	reason_ref: string;
}

export interface FlowDeskEvaluationEventV1 {
	schema_version: "flowdesk.evaluation_event.v1";
	evaluation_event_id: string;
	workflow_id: string;
	task_ref?: string;
	proposal_ref?: string;
	candidate_ref?: string;
	dedupe_ref: string;
	taxonomy_hash_ref: string;
	policy_hash_ref: string;
	redaction_hash_ref: string;
	scorer_ref: string;
	source_ref: string;
	observed_at: string;
	score_dimensions: FlowDeskEvaluationScoreDimensionV1[];
	overall_outcome_label: FlowDeskEvaluationOutcomeLabelV1;
	evidence_refs: string[];
	safe_next_actions: string[];
	local_only: true;
	append_only: true;
	non_authorizing: true;
	advisory_only: true;
	dispatch_authority_enabled: false;
	approval_authority_enabled: false;
	provider_authority_enabled: false;
	runtime_authority_enabled: false;
	external_write_authority_enabled: false;
	write_authority_enabled: false;
	remote_write_authority_enabled: false;
	fallback_authority_enabled: false;
	lane_launch_authority_enabled: false;
	hard_chat_authority_enabled: false;
}

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

export interface FlowDeskAdvisoryScoreLedgerEntryV1 {
	schema_version: "flowdesk.advisory_score_ledger_entry.v1";
	ledger_entry_id: string;
	workflow_id: string;
	sequence: number;
	previous_ledger_entry_id?: string;
	recorded_at: string;
	event_kind: "workflow_plan_proposal" | "workflow_plan_proposal_score_event" | "evaluation_event";
	event: FlowDeskWorkflowPlanProposalV1 | FlowDeskWorkflowPlanProposalScoreEventV1 | FlowDeskEvaluationEventV1;
	local_only: true;
	append_only: true;
	non_authorizing: true;
	advisory_only: true;
	dispatch_authority_enabled: false;
	approval_authority_enabled: false;
	provider_authority_enabled: false;
	runtime_authority_enabled: false;
	external_write_authority_enabled: false;
	fallback_authority_enabled: false;
	lane_launch_authority_enabled: false;
}

export interface FlowDeskAdvisoryScoreLedgerAppendIntentV1 {
	schema_version: "flowdesk.advisory_score_ledger_append_intent.v1";
	operation: "append_jsonl";
	serialization: "jsonl";
	ledger_scope: "local_advisory_score_events";
	ledger_entry_id: string;
	workflow_id: string;
	idempotency_key: string;
	append_line: string | null;
	idempotent_replay: boolean;
	expected_previous_ledger_entry_id?: string;
	current_entry_count: number;
	next_sequence: number;
	local_only: true;
	append_only: true;
	non_authorizing: true;
	advisory_only: true;
	dispatch_authority_enabled: false;
	approval_authority_enabled: false;
	provider_authority_enabled: false;
	runtime_authority_enabled: false;
	external_write_authority_enabled: false;
	fallback_authority_enabled: false;
	lane_launch_authority_enabled: false;
}

export interface FlowDeskAdvisoryScoreLedgerLineResultV1 {
	ok: boolean;
	errors: string[];
	line?: string;
}

export interface FlowDeskAdvisoryScoreLedgerDecodeResultV1 {
	ok: boolean;
	errors: string[];
	entry?: FlowDeskAdvisoryScoreLedgerEntryV1;
}

export interface FlowDeskAdvisoryScoreLedgerAppendIntentResultV1 {
	ok: boolean;
	errors: string[];
	intent?: FlowDeskAdvisoryScoreLedgerAppendIntentV1;
}

export interface FlowDeskFederatedScoreRegistryPublicationRequestV1 {
	schema_version: "flowdesk.federated_score_registry_publication_request.v1";
	request_id: string;
	workflow_id: string;
	registry_ref: string;
	ledger_entry_refs: string[];
	requested_at: string;
	federated_registry_publication_opt_in: boolean;
	connector_gate_ref?: string;
	connector_gate_satisfied: false;
	remote_write_blocked_by_default: true;
	remote_write_attempted: false;
	non_authorizing: true;
	advisory_only: true;
	dispatch_authority_enabled: false;
	approval_authority_enabled: false;
	provider_authority_enabled: false;
	runtime_authority_enabled: false;
	external_write_authority_enabled: false;
	remote_write_authority_enabled: false;
	fallback_authority_enabled: false;
	lane_launch_authority_enabled: false;
}

export interface FlowDeskFederatedScoreRegistryPublicationIntentV1 {
	schema_version: "flowdesk.federated_score_registry_publication_intent.v1";
	publication_intent_id: string;
	request_id: string;
	workflow_id: string;
	registry_ref: string;
	ledger_entry_refs: string[];
	ledger_entry_count: number;
	requested_at: string;
	state: "blocked";
	blocked_labels: string[];
	federated_registry_publication_opt_in: boolean;
	connector_gate_ref?: string;
	connector_gate_satisfied: false;
	remote_write_blocked_by_default: true;
	remote_write_attempted: false;
	local_ledger_compatible: true;
	non_authorizing: true;
	advisory_only: true;
	dispatch_authority_enabled: false;
	approval_authority_enabled: false;
	provider_authority_enabled: false;
	runtime_authority_enabled: false;
	external_write_authority_enabled: false;
	remote_write_authority_enabled: false;
	fallback_authority_enabled: false;
	lane_launch_authority_enabled: false;
}

export interface FlowDeskFederatedScoreRegistryPublicationIntentResultV1 {
	ok: boolean;
	errors: string[];
	intent?: FlowDeskFederatedScoreRegistryPublicationIntentV1;
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

export interface FlowDeskCategoryFitSnapshotV1 {
	schema_version: "flowdesk.category_fit_snapshot.v1";
	snapshot_id: string;
	workflow_id: string;
	task_signature_ref: string;
	category_signature_ref: string;
	sample_count: number;
	fitness_score: number;
	freshness_timestamp: string;
	evidence_refs: string[];
	safe_next_actions: string[];
	advisory_only: true;
	dispatch_authority_enabled: false;
	approval_authority_enabled: false;
	provider_authority_enabled: false;
	runtime_authority_enabled: false;
	fallback_authority_enabled: false;
	external_write_authority_enabled: false;
	remote_write_authority_enabled: false;
	lane_launch_authority_enabled: false;
	hard_chat_authority_enabled: false;
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

function validateTimestamp(value: unknown, label: string): ValidationResult {
	return typeof value === "string" && value.length > 0 && Number.isFinite(Date.parse(value)) ? valid() : invalid(`${label} must be a parseable timestamp`);
}

function stableStringify(value: unknown): string {
	if (Array.isArray(value)) return `[${value.map((item) => stableStringify(item)).join(",")}]`;
	if (isRecord(value)) {
		const keys = Object.keys(value).sort();
		return `{${keys.map((key) => `${JSON.stringify(key)}:${stableStringify(value[key])}`).join(",")}}`;
	}
	return JSON.stringify(value) ?? "null";
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

function validateRegistryPublicationAuthorityFlags(record: Record<string, unknown>, label: string): ValidationResult {
	return validateAdvisoryAuthorityFlags(record, label).ok
		&& record.non_authorizing === true
		&& record.remote_write_authority_enabled === false
		&& record.remote_write_attempted === false
		&& record.remote_write_blocked_by_default === true
		&& record.connector_gate_satisfied === false
		? valid()
		: invalid(`${label} must remain non-authorizing with connector gate unsatisfied and no dispatch, approval, provider, runtime, external-write, remote-write, fallback, or lane-launch authority`);
}

function validateEvaluationAuthorityFlags(record: Record<string, unknown>, label: string): ValidationResult {
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

function validateHashRef(value: unknown, label: string): ValidationResult {
	if (typeof value !== "string") return invalid(`${label} must be a string`);
	if (/^sha256-[a-f0-9]{64}$/.test(value)) return valid();
	if (/^hash-[A-Za-z0-9][A-Za-z0-9_.:-]{1,122}$/.test(value) && !value.includes("..")) return valid();
	return invalid(`${label} must be hash-<schema-safe-ref> or sha256-<64 lowercase hex>`);
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

const evaluationDimensionNames = ["correctness", "safety", "utility", "cost", "latency", "policy_fit", "redaction_fit"] as const;
const evaluationOutcomeLabels = ["accepted", "rejected", "neutral", "blocked", "inconclusive"] as const;

function validateEvaluationOutcomeLabel(value: unknown, label: string): ValidationResult {
	return typeof value === "string" && (evaluationOutcomeLabels as readonly string[]).includes(value) ? valid() : invalid(`${label} is invalid`);
}

function validateEvaluationScoreDimensions(value: unknown, label: string): ValidationResult {
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

export function createFlowDeskCategoryFitSnapshotV1(input: {
	snapshotId: string;
	workflowId: string;
	taskSignatureRef: string;
	categorySignatureRef: string;
	sampleCount: number;
	fitnessScore: number;
	freshnessTimestamp: string;
	evidenceRefs: string[];
	safeNextActions: string[];
}): FlowDeskCategoryFitSnapshotV1 {
	return {
		schema_version: "flowdesk.category_fit_snapshot.v1",
		snapshot_id: input.snapshotId,
		workflow_id: input.workflowId,
		task_signature_ref: input.taskSignatureRef,
		category_signature_ref: input.categorySignatureRef,
		sample_count: input.sampleCount,
		fitness_score: input.fitnessScore,
		freshness_timestamp: input.freshnessTimestamp,
		evidence_refs: [...input.evidenceRefs],
		safe_next_actions: [...input.safeNextActions],
		advisory_only: true,
		dispatch_authority_enabled: false,
		approval_authority_enabled: false,
		provider_authority_enabled: false,
		runtime_authority_enabled: false,
		fallback_authority_enabled: false,
		external_write_authority_enabled: false,
		remote_write_authority_enabled: false,
		lane_launch_authority_enabled: false,
		hard_chat_authority_enabled: false,
	};
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

export function createFlowDeskEvaluationEventV1(input: {
	evaluationEventId: string;
	workflowId: string;
	taskRef?: string;
	proposalRef?: string;
	candidateRef?: string;
	dedupeRef: string;
	taxonomyHashRef: string;
	policyHashRef: string;
	redactionHashRef: string;
	scorerRef: string;
	sourceRef: string;
	observedAt: string;
	scoreDimensions: FlowDeskEvaluationScoreDimensionV1[];
	overallOutcomeLabel: FlowDeskEvaluationOutcomeLabelV1;
	evidenceRefs: string[];
	safeNextActions: string[];
}): FlowDeskEvaluationEventV1 {
	return {
		schema_version: "flowdesk.evaluation_event.v1",
		evaluation_event_id: input.evaluationEventId,
		workflow_id: input.workflowId,
		...(input.taskRef === undefined ? {} : { task_ref: input.taskRef }),
		...(input.proposalRef === undefined ? {} : { proposal_ref: input.proposalRef }),
		...(input.candidateRef === undefined ? {} : { candidate_ref: input.candidateRef }),
		dedupe_ref: input.dedupeRef,
		taxonomy_hash_ref: input.taxonomyHashRef,
		policy_hash_ref: input.policyHashRef,
		redaction_hash_ref: input.redactionHashRef,
		scorer_ref: input.scorerRef,
		source_ref: input.sourceRef,
		observed_at: input.observedAt,
		score_dimensions: input.scoreDimensions.map((dimension) => ({ ...dimension })),
		overall_outcome_label: input.overallOutcomeLabel,
		evidence_refs: [...input.evidenceRefs],
		safe_next_actions: [...input.safeNextActions],
		local_only: true,
		append_only: true,
		non_authorizing: true,
		advisory_only: true,
		dispatch_authority_enabled: false,
		approval_authority_enabled: false,
		provider_authority_enabled: false,
		runtime_authority_enabled: false,
		external_write_authority_enabled: false,
		write_authority_enabled: false,
		remote_write_authority_enabled: false,
		fallback_authority_enabled: false,
		lane_launch_authority_enabled: false,
		hard_chat_authority_enabled: false,
	};
}

export function createFlowDeskAdvisoryScoreLedgerEntryV1(input: {
	ledgerEntryId: string;
	workflowId: string;
	sequence: number;
	previousLedgerEntryId?: string;
	recordedAt: string;
	event: FlowDeskWorkflowPlanProposalV1 | FlowDeskWorkflowPlanProposalScoreEventV1 | FlowDeskEvaluationEventV1;
}): FlowDeskAdvisoryScoreLedgerEntryV1 {
	const eventKind = input.event.schema_version === "flowdesk.workflow_plan_proposal.v1"
		? "workflow_plan_proposal"
		: input.event.schema_version === "flowdesk.workflow_plan_proposal_score_event.v1"
			? "workflow_plan_proposal_score_event"
			: "evaluation_event";
	return {
		schema_version: "flowdesk.advisory_score_ledger_entry.v1",
		ledger_entry_id: input.ledgerEntryId,
		workflow_id: input.workflowId,
		sequence: input.sequence,
		...(input.previousLedgerEntryId === undefined ? {} : { previous_ledger_entry_id: input.previousLedgerEntryId }),
		recorded_at: input.recordedAt,
		event_kind: eventKind,
		event: input.event,
		local_only: true,
		append_only: true,
		non_authorizing: true,
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

export function validateFlowDeskCategoryFitSnapshotV1(value: unknown): ValidationResult {
	if (!isRecord(value)) return invalid("category fit snapshot must be an object");
	const record = value as Partial<FlowDeskCategoryFitSnapshotV1>;
	const errors: string[] = [];
	errors.push(...rejectUnknownProperties(record, [
		"schema_version",
		"snapshot_id",
		"workflow_id",
		"task_signature_ref",
		"category_signature_ref",
		"sample_count",
		"fitness_score",
		"freshness_timestamp",
		"evidence_refs",
		"safe_next_actions",
		"advisory_only",
		"dispatch_authority_enabled",
		"approval_authority_enabled",
		"provider_authority_enabled",
		"runtime_authority_enabled",
		"fallback_authority_enabled",
		"external_write_authority_enabled",
		"remote_write_authority_enabled",
		"lane_launch_authority_enabled",
		"hard_chat_authority_enabled",
	], "category fit snapshot").errors);
	if (record.schema_version !== "flowdesk.category_fit_snapshot.v1") errors.push("category fit snapshot schema_version is invalid");
	errors.push(...validateOpaqueId(record.snapshot_id, "snapshot_id").errors);
	errors.push(...validateOpaqueId(record.workflow_id, "workflow_id").errors);
	errors.push(...validateOpaqueRef(record.task_signature_ref, "task_signature_ref").errors);
	errors.push(...validateOpaqueRef(record.category_signature_ref, "category_signature_ref").errors);
	if (typeof record.sample_count !== "number" || !Number.isInteger(record.sample_count) || record.sample_count < 0) errors.push("sample_count must be a non-negative integer");
	if (typeof record.fitness_score !== "number" || !Number.isFinite(record.fitness_score) || record.fitness_score < 0 || record.fitness_score > 100) errors.push("fitness_score must be 0..100");
	errors.push(...validateTimestamp(record.freshness_timestamp, "freshness_timestamp").errors);
	errors.push(...refs(record.evidence_refs, "evidence_refs").errors);
	if (!Array.isArray(record.safe_next_actions) || record.safe_next_actions.length === 0 || record.safe_next_actions.length > 8) errors.push("safe_next_actions must be a non-empty bounded array");
	else for (const [index, action] of record.safe_next_actions.entries()) errors.push(...validateOpaqueRef(action, `safe_next_actions[${index}]`).errors);
	if (record.advisory_only !== true
		|| record.dispatch_authority_enabled !== false
		|| record.approval_authority_enabled !== false
		|| record.provider_authority_enabled !== false
		|| record.runtime_authority_enabled !== false
		|| record.fallback_authority_enabled !== false
		|| record.external_write_authority_enabled !== false
		|| record.remote_write_authority_enabled !== false
		|| record.lane_launch_authority_enabled !== false
		|| record.hard_chat_authority_enabled !== false) errors.push("category fit snapshot must remain advisory-only with no authority");
	errors.push(...validateNoForbiddenRawPayloads(record, "category_fit_snapshot").errors);
	return errors.length === 0 ? valid() : invalid(...errors);
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

export function validateFlowDeskEvaluationEventV1(value: unknown): ValidationResult {
	if (!isRecord(value)) return invalid("evaluation event must be an object");
	const record = value as Partial<FlowDeskEvaluationEventV1>;
	const errors: string[] = [];
	errors.push(...rejectUnknownProperties(record, [
		"schema_version",
		"evaluation_event_id",
		"workflow_id",
		"task_ref",
		"proposal_ref",
		"candidate_ref",
		"dedupe_ref",
		"taxonomy_hash_ref",
		"policy_hash_ref",
		"redaction_hash_ref",
		"scorer_ref",
		"source_ref",
		"observed_at",
		"score_dimensions",
		"overall_outcome_label",
		"evidence_refs",
		"safe_next_actions",
		"local_only",
		"append_only",
		"non_authorizing",
		"advisory_only",
		"dispatch_authority_enabled",
		"approval_authority_enabled",
		"provider_authority_enabled",
		"runtime_authority_enabled",
		"external_write_authority_enabled",
		"write_authority_enabled",
		"remote_write_authority_enabled",
		"fallback_authority_enabled",
		"lane_launch_authority_enabled",
		"hard_chat_authority_enabled",
	], "evaluation event").errors);
	if (record.schema_version !== "flowdesk.evaluation_event.v1") errors.push("evaluation event schema_version is invalid");
	errors.push(...validateOpaqueId(record.evaluation_event_id, "evaluation_event_id").errors);
	errors.push(...validateOpaqueId(record.workflow_id, "workflow_id").errors);
	if (record.task_ref !== undefined) errors.push(...validateOpaqueRef(record.task_ref, "task_ref").errors);
	if (record.proposal_ref !== undefined) errors.push(...validateOpaqueRef(record.proposal_ref, "proposal_ref").errors);
	if (record.candidate_ref !== undefined) errors.push(...validateOpaqueRef(record.candidate_ref, "candidate_ref").errors);
	if (record.task_ref === undefined && record.proposal_ref === undefined && record.candidate_ref === undefined) errors.push("evaluation event requires at least one task_ref, proposal_ref, or candidate_ref");
	errors.push(...validateOpaqueRef(record.dedupe_ref, "dedupe_ref").errors);
	errors.push(...validateHashRef(record.taxonomy_hash_ref, "taxonomy_hash_ref").errors);
	errors.push(...validateHashRef(record.policy_hash_ref, "policy_hash_ref").errors);
	errors.push(...validateHashRef(record.redaction_hash_ref, "redaction_hash_ref").errors);
	errors.push(...validateOpaqueRef(record.scorer_ref, "scorer_ref").errors);
	errors.push(...validateOpaqueRef(record.source_ref, "source_ref").errors);
	errors.push(...validateTimestamp(record.observed_at, "observed_at").errors);
	errors.push(...validateEvaluationScoreDimensions(record.score_dimensions, "score_dimensions").errors);
	errors.push(...validateEvaluationOutcomeLabel(record.overall_outcome_label, "overall_outcome_label").errors);
	errors.push(...refs(record.evidence_refs, "evidence_refs").errors);
	if (!Array.isArray(record.safe_next_actions) || record.safe_next_actions.length === 0 || record.safe_next_actions.length > 8) errors.push("safe_next_actions must be a non-empty bounded array");
	else for (const [index, action] of record.safe_next_actions.entries()) errors.push(...validateOpaqueRef(action, `safe_next_actions[${index}]`).errors);
	errors.push(...validateEvaluationAuthorityFlags(record, "evaluation event").errors);
	errors.push(...validateNoForbiddenRawPayloads(record, "evaluation_event").errors);
	return errors.length === 0 ? valid() : invalid(...errors);
}

export function validateFlowDeskAdvisoryScoreLedgerEntryV1(value: unknown): ValidationResult {
	if (!isRecord(value)) return invalid("advisory score ledger entry must be an object");
	const record = value as Partial<FlowDeskAdvisoryScoreLedgerEntryV1>;
	const errors: string[] = [];
	errors.push(...rejectUnknownProperties(record, [
		"schema_version",
		"ledger_entry_id",
		"workflow_id",
		"sequence",
		"previous_ledger_entry_id",
		"recorded_at",
		"event_kind",
		"event",
		"local_only",
		"append_only",
		"non_authorizing",
		"advisory_only",
		"dispatch_authority_enabled",
		"approval_authority_enabled",
		"provider_authority_enabled",
		"runtime_authority_enabled",
		"external_write_authority_enabled",
		"fallback_authority_enabled",
		"lane_launch_authority_enabled",
	], "advisory score ledger entry").errors);
	errors.push(...validateOpaqueId(record.ledger_entry_id, "ledger_entry_id").errors);
	errors.push(...validateOpaqueId(record.workflow_id, "workflow_id").errors);
	if (record.previous_ledger_entry_id !== undefined) errors.push(...validateOpaqueId(record.previous_ledger_entry_id, "previous_ledger_entry_id").errors);
	if (record.schema_version !== "flowdesk.advisory_score_ledger_entry.v1") errors.push("advisory score ledger entry schema_version is invalid");
	if (typeof record.sequence !== "number" || !Number.isInteger(record.sequence) || record.sequence < 0) errors.push("advisory score ledger entry sequence must be a non-negative integer");
	if (record.sequence === 0 && record.previous_ledger_entry_id !== undefined) errors.push("first advisory score ledger entry must not carry previous_ledger_entry_id");
	if (typeof record.sequence === "number" && record.sequence > 0 && record.previous_ledger_entry_id === undefined) errors.push("non-initial advisory score ledger entry requires previous_ledger_entry_id");
	errors.push(...validateTimestamp(record.recorded_at, "recorded_at").errors);
	if (record.local_only !== true || record.append_only !== true || record.non_authorizing !== true) errors.push("advisory score ledger entry must remain local-only, append-only, and non-authorizing");
	errors.push(...validateAdvisoryAuthorityFlags(record, "advisory score ledger entry").errors);
	if (record.event_kind === "workflow_plan_proposal") {
		errors.push(...validateFlowDeskWorkflowPlanProposalV1(record.event).errors.map((error) => `event.${error}`));
		if (isRecord(record.event) && record.event.workflow_id !== record.workflow_id) errors.push("advisory score ledger entry workflow_id must match proposal event workflow_id");
	} else if (record.event_kind === "workflow_plan_proposal_score_event") {
		errors.push(...validateFlowDeskWorkflowPlanProposalScoreEventV1(record.event).errors.map((error) => `event.${error}`));
		if (isRecord(record.event) && record.event.workflow_id !== record.workflow_id) errors.push("advisory score ledger entry workflow_id must match score event workflow_id");
	} else if (record.event_kind === "evaluation_event") {
		errors.push(...validateFlowDeskEvaluationEventV1(record.event).errors.map((error) => `event.${error}`));
		if (isRecord(record.event) && record.event.workflow_id !== record.workflow_id) errors.push("advisory score ledger entry workflow_id must match evaluation event workflow_id");
	} else errors.push("advisory score ledger entry event_kind is invalid");
	errors.push(...validateNoForbiddenRawPayloads(record, "advisory_score_ledger_entry").errors);
	return errors.length === 0 ? valid() : invalid(...errors);
}

export function encodeFlowDeskAdvisoryScoreLedgerEntryJsonlLine(entry: FlowDeskAdvisoryScoreLedgerEntryV1): FlowDeskAdvisoryScoreLedgerLineResultV1 {
	const validation = validateFlowDeskAdvisoryScoreLedgerEntryV1(entry);
	if (!validation.ok) return { ok: false, errors: validation.errors };
	const line = stableStringify(entry);
	return line.includes("\n") || line.includes("\r") ? { ok: false, errors: ["advisory score ledger JSONL line must be single-line"] } : { ok: true, errors: [], line };
}

export function decodeFlowDeskAdvisoryScoreLedgerEntryJsonlLine(line: string): FlowDeskAdvisoryScoreLedgerDecodeResultV1 {
	if (typeof line !== "string" || line.length === 0) return { ok: false, errors: ["advisory score ledger JSONL line must be non-empty"] };
	if (line.includes("\n") || line.includes("\r")) return { ok: false, errors: ["advisory score ledger JSONL line must be single-line"] };
	let parsed: unknown;
	try {
		parsed = JSON.parse(line);
	} catch {
		return { ok: false, errors: ["advisory score ledger JSONL line is malformed JSON"] };
	}
	const validation = validateFlowDeskAdvisoryScoreLedgerEntryV1(parsed);
	return validation.ok ? { ok: true, errors: [], entry: parsed as FlowDeskAdvisoryScoreLedgerEntryV1 } : { ok: false, errors: validation.errors };
}

export function decodeFlowDeskAdvisoryScoreLedgerJsonl(jsonl: string): FlowDeskAdvisoryScoreLedgerDecodeResultV1[] {
	if (jsonl.length === 0) return [];
	return jsonl.split("\n").filter((line, index, lines) => line.length > 0 || index < lines.length - 1).map((line) => decodeFlowDeskAdvisoryScoreLedgerEntryJsonlLine(line));
}

export function createFlowDeskAdvisoryScoreLedgerAppendIntentV1(input: {
	existingJsonl: string;
	entry: FlowDeskAdvisoryScoreLedgerEntryV1;
	idempotencyKey: string;
}): FlowDeskAdvisoryScoreLedgerAppendIntentResultV1 {
	const errors: string[] = [];
	errors.push(...validateOpaqueId(input.idempotencyKey, "idempotency_key").errors);
	const encoded = encodeFlowDeskAdvisoryScoreLedgerEntryJsonlLine(input.entry);
	if (!encoded.ok || encoded.line === undefined) errors.push(...encoded.errors);
	const decoded = decodeFlowDeskAdvisoryScoreLedgerJsonl(input.existingJsonl);
	const entries: FlowDeskAdvisoryScoreLedgerEntryV1[] = [];
	for (const [index, result] of decoded.entries()) {
		if (!result.ok || result.entry === undefined) errors.push(...result.errors.map((error) => `existingJsonl[${index}]: ${error}`));
		else entries.push(result.entry);
	}
	if (errors.length > 0 || encoded.line === undefined) return { ok: false, errors };
	for (const [index, entry] of entries.entries()) {
		if (entry.sequence !== index) errors.push(`existingJsonl[${index}] sequence must equal append order`);
		if (index === 0 && entry.previous_ledger_entry_id !== undefined) errors.push("existingJsonl[0] must not carry previous_ledger_entry_id");
		if (index > 0 && entry.previous_ledger_entry_id !== entries[index - 1]?.ledger_entry_id) errors.push(`existingJsonl[${index}] previous_ledger_entry_id must match prior entry`);
	}
	const last = entries.at(-1);
	const duplicate = entries.find((entry) => entry.ledger_entry_id === input.entry.ledger_entry_id);
	if (duplicate !== undefined) {
		const duplicateLine = encodeFlowDeskAdvisoryScoreLedgerEntryJsonlLine(duplicate).line;
		if (duplicateLine !== encoded.line) errors.push("advisory score ledger duplicate ledger_entry_id does not match existing entry");
		if (errors.length > 0) return { ok: false, errors };
		return { ok: true, errors: [], intent: {
			schema_version: "flowdesk.advisory_score_ledger_append_intent.v1",
			operation: "append_jsonl",
			serialization: "jsonl",
			ledger_scope: "local_advisory_score_events",
			ledger_entry_id: input.entry.ledger_entry_id,
			workflow_id: input.entry.workflow_id,
			idempotency_key: input.idempotencyKey,
			append_line: null,
			idempotent_replay: true,
			...(input.entry.previous_ledger_entry_id === undefined ? {} : { expected_previous_ledger_entry_id: input.entry.previous_ledger_entry_id }),
			current_entry_count: entries.length,
			next_sequence: entries.length,
			local_only: true,
			append_only: true,
			non_authorizing: true,
			advisory_only: true,
			dispatch_authority_enabled: false,
			approval_authority_enabled: false,
			provider_authority_enabled: false,
			runtime_authority_enabled: false,
			external_write_authority_enabled: false,
			fallback_authority_enabled: false,
			lane_launch_authority_enabled: false,
		} };
	}
	const expectedSequence = entries.length;
	if (input.entry.sequence !== expectedSequence) errors.push("advisory score ledger append sequence must continue current JSONL order");
	if (last === undefined && input.entry.previous_ledger_entry_id !== undefined) errors.push("first advisory score ledger append must not expect a previous entry");
	if (last !== undefined && input.entry.previous_ledger_entry_id !== last.ledger_entry_id) errors.push("advisory score ledger append previous_ledger_entry_id must match current tail");
	if (errors.length > 0) return { ok: false, errors };
	return { ok: true, errors: [], intent: {
		schema_version: "flowdesk.advisory_score_ledger_append_intent.v1",
		operation: "append_jsonl",
		serialization: "jsonl",
		ledger_scope: "local_advisory_score_events",
		ledger_entry_id: input.entry.ledger_entry_id,
		workflow_id: input.entry.workflow_id,
		idempotency_key: input.idempotencyKey,
		append_line: encoded.line,
		idempotent_replay: false,
		...(input.entry.previous_ledger_entry_id === undefined ? {} : { expected_previous_ledger_entry_id: input.entry.previous_ledger_entry_id }),
		current_entry_count: entries.length,
		next_sequence: entries.length + 1,
		local_only: true,
		append_only: true,
		non_authorizing: true,
		advisory_only: true,
		dispatch_authority_enabled: false,
		approval_authority_enabled: false,
		provider_authority_enabled: false,
		runtime_authority_enabled: false,
		external_write_authority_enabled: false,
		fallback_authority_enabled: false,
		lane_launch_authority_enabled: false,
	} };
}

export function createFlowDeskFederatedScoreRegistryPublicationIntentV1(input: {
	publicationIntentId: string;
	requestId: string;
	workflowId: string;
	registryRef: string;
	ledgerEntries: FlowDeskAdvisoryScoreLedgerEntryV1[];
	requestedAt: string;
	federatedRegistryPublicationOptIn?: boolean;
	connectorGateRef?: string;
}): FlowDeskFederatedScoreRegistryPublicationIntentResultV1 {
	const errors: string[] = [];
	errors.push(...validateOpaqueId(input.publicationIntentId, "publication_intent_id").errors);
	errors.push(...validateOpaqueId(input.requestId, "request_id").errors);
	errors.push(...validateOpaqueId(input.workflowId, "workflow_id").errors);
	errors.push(...validateOpaqueRef(input.registryRef, "registry_ref").errors);
	errors.push(...validateTimestamp(input.requestedAt, "requested_at").errors);
	if (input.connectorGateRef !== undefined) errors.push(...validateOpaqueRef(input.connectorGateRef, "connector_gate_ref").errors);
	if (!Array.isArray(input.ledgerEntries) || input.ledgerEntries.length === 0) errors.push("ledgerEntries must be a non-empty array");
	else for (const [index, entry] of input.ledgerEntries.entries()) {
		const validation = validateFlowDeskAdvisoryScoreLedgerEntryV1(entry);
		if (!validation.ok) errors.push(...validation.errors.map((error) => `ledgerEntries[${index}]: ${error}`));
		if (entry.workflow_id !== input.workflowId) errors.push(`ledgerEntries[${index}] workflow_id must match publication workflow_id`);
		if (entry.local_only !== true || entry.non_authorizing !== true || entry.advisory_only !== true) errors.push(`ledgerEntries[${index}] must be local advisory non-authorizing ledger entry`);
	}
	if (errors.length > 0) return { ok: false, errors };
	const optedIn = input.federatedRegistryPublicationOptIn === true;
	const blockedLabels = optedIn
		? ["connector-gate-not-supplied-or-not-enabled", "remote-write-blocked-by-default"]
		: ["federated-registry-publication-opt-in-missing", "remote-write-blocked-by-default"];
	return { ok: true, errors: [], intent: {
		schema_version: "flowdesk.federated_score_registry_publication_intent.v1",
		publication_intent_id: input.publicationIntentId,
		request_id: input.requestId,
		workflow_id: input.workflowId,
		registry_ref: input.registryRef,
		ledger_entry_refs: input.ledgerEntries.map((entry) => entry.ledger_entry_id),
		ledger_entry_count: input.ledgerEntries.length,
		requested_at: input.requestedAt,
		state: "blocked",
		blocked_labels: blockedLabels,
		federated_registry_publication_opt_in: optedIn,
		...(input.connectorGateRef === undefined ? {} : { connector_gate_ref: input.connectorGateRef }),
		connector_gate_satisfied: false,
		remote_write_blocked_by_default: true,
		remote_write_attempted: false,
		local_ledger_compatible: true,
		non_authorizing: true,
		advisory_only: true,
		dispatch_authority_enabled: false,
		approval_authority_enabled: false,
		provider_authority_enabled: false,
		runtime_authority_enabled: false,
		external_write_authority_enabled: false,
		remote_write_authority_enabled: false,
		fallback_authority_enabled: false,
		lane_launch_authority_enabled: false,
	} };
}

export function validateFlowDeskFederatedScoreRegistryPublicationIntentV1(value: unknown): ValidationResult {
	if (!isRecord(value)) return invalid("federated score registry publication intent must be an object");
	const record = value as Partial<FlowDeskFederatedScoreRegistryPublicationIntentV1>;
	const errors: string[] = [];
	errors.push(...rejectUnknownProperties(record, [
		"schema_version",
		"publication_intent_id",
		"request_id",
		"workflow_id",
		"registry_ref",
		"ledger_entry_refs",
		"ledger_entry_count",
		"requested_at",
		"state",
		"blocked_labels",
		"federated_registry_publication_opt_in",
		"connector_gate_ref",
		"connector_gate_satisfied",
		"remote_write_blocked_by_default",
		"remote_write_attempted",
		"local_ledger_compatible",
		"non_authorizing",
		"advisory_only",
		"dispatch_authority_enabled",
		"approval_authority_enabled",
		"provider_authority_enabled",
		"runtime_authority_enabled",
		"external_write_authority_enabled",
		"remote_write_authority_enabled",
		"fallback_authority_enabled",
		"lane_launch_authority_enabled",
	], "federated score registry publication intent").errors);
	if (record.schema_version !== "flowdesk.federated_score_registry_publication_intent.v1") errors.push("federated score registry publication intent schema_version is invalid");
	errors.push(...validateOpaqueId(record.publication_intent_id, "publication_intent_id").errors);
	errors.push(...validateOpaqueId(record.request_id, "request_id").errors);
	errors.push(...validateOpaqueId(record.workflow_id, "workflow_id").errors);
	errors.push(...validateOpaqueRef(record.registry_ref, "registry_ref").errors);
	errors.push(...validateTimestamp(record.requested_at, "requested_at").errors);
	if (record.connector_gate_ref !== undefined) errors.push(...validateOpaqueRef(record.connector_gate_ref, "connector_gate_ref").errors);
	if (record.state !== "blocked") errors.push("federated score registry publication intent state must remain blocked");
	if (typeof record.federated_registry_publication_opt_in !== "boolean") errors.push("federated_registry_publication_opt_in must be boolean");
	if (record.local_ledger_compatible !== true) errors.push("federated score registry publication intent must remain compatible with local ledger entries");
	if (!Array.isArray(record.ledger_entry_refs) || record.ledger_entry_refs.length === 0) errors.push("ledger_entry_refs must be a non-empty array");
	else for (const [index, ref] of record.ledger_entry_refs.entries()) errors.push(...validateOpaqueRef(ref, `ledger_entry_refs[${index}]`).errors);
	if (typeof record.ledger_entry_count !== "number" || !Number.isInteger(record.ledger_entry_count) || record.ledger_entry_count < 1) errors.push("ledger_entry_count must be a positive integer");
	if (Array.isArray(record.ledger_entry_refs) && record.ledger_entry_count !== record.ledger_entry_refs.length) errors.push("ledger_entry_count must match ledger_entry_refs length");
	if (!Array.isArray(record.blocked_labels) || record.blocked_labels.length === 0) errors.push("blocked_labels must be a non-empty array");
	else for (const [index, label] of record.blocked_labels.entries()) errors.push(...validateOpaqueRef(label, `blocked_labels[${index}]`).errors);
	if (record.federated_registry_publication_opt_in === false && Array.isArray(record.blocked_labels) && !record.blocked_labels.includes("federated-registry-publication-opt-in-missing")) errors.push("missing opt-in must be represented in blocked_labels");
	if (record.federated_registry_publication_opt_in === true && Array.isArray(record.blocked_labels) && !record.blocked_labels.includes("remote-write-blocked-by-default")) errors.push("explicit opt-in must still keep remote-write blocked by default");
	errors.push(...validateRegistryPublicationAuthorityFlags(record, "federated score registry publication intent").errors);
	errors.push(...validateNoForbiddenRawPayloads(record, "federated_score_registry_publication_intent").errors);
	return errors.length === 0 ? valid() : invalid(...errors);
}

export function validateFlowDeskFederatedScoreRegistryPublicationRequestV1(value: unknown): ValidationResult {
	if (!isRecord(value)) return invalid("federated score registry publication request must be an object");
	const record = value as Partial<FlowDeskFederatedScoreRegistryPublicationRequestV1>;
	const errors: string[] = [];
	errors.push(...rejectUnknownProperties(record, [
		"schema_version",
		"request_id",
		"workflow_id",
		"registry_ref",
		"ledger_entry_refs",
		"requested_at",
		"federated_registry_publication_opt_in",
		"connector_gate_ref",
		"connector_gate_satisfied",
		"remote_write_blocked_by_default",
		"remote_write_attempted",
		"non_authorizing",
		"advisory_only",
		"dispatch_authority_enabled",
		"approval_authority_enabled",
		"provider_authority_enabled",
		"runtime_authority_enabled",
		"external_write_authority_enabled",
		"remote_write_authority_enabled",
		"fallback_authority_enabled",
		"lane_launch_authority_enabled",
	], "federated score registry publication request").errors);
	if (record.schema_version !== "flowdesk.federated_score_registry_publication_request.v1") errors.push("federated score registry publication request schema_version is invalid");
	errors.push(...validateOpaqueId(record.request_id, "request_id").errors);
	errors.push(...validateOpaqueId(record.workflow_id, "workflow_id").errors);
	errors.push(...validateOpaqueRef(record.registry_ref, "registry_ref").errors);
	errors.push(...validateTimestamp(record.requested_at, "requested_at").errors);
	if (record.connector_gate_ref !== undefined) errors.push(...validateOpaqueRef(record.connector_gate_ref, "connector_gate_ref").errors);
	if (typeof record.federated_registry_publication_opt_in !== "boolean") errors.push("federated_registry_publication_opt_in must be boolean");
	if (!Array.isArray(record.ledger_entry_refs) || record.ledger_entry_refs.length === 0) errors.push("ledger_entry_refs must be a non-empty array");
	else for (const [index, ref] of record.ledger_entry_refs.entries()) errors.push(...validateOpaqueRef(ref, `ledger_entry_refs[${index}]`).errors);
	errors.push(...validateRegistryPublicationAuthorityFlags(record, "federated score registry publication request").errors);
	errors.push(...validateNoForbiddenRawPayloads(record, "federated_score_registry_publication_request").errors);
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
