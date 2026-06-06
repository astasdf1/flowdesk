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

export type FlowDeskOptimizerScoreDimensionNameV1 = "goal_fit" | "safety" | "simplicity_fit" | "detail_fit" | "taxonomy_fit" | "verification_coverage" | "risk" | "dependency_impact" | "confidence" | "cost" | "latency" | "model_diversity";

export interface FlowDeskOptimizerScoreDimensionV1 {
	dimension: FlowDeskOptimizerScoreDimensionNameV1;
	score: number;
	weight: number;
	reason_ref: string;
}

export interface FlowDeskOptimizerProposalScoreV1 {
	schema_version: "flowdesk.optimizer_proposal_score.v1";
	score_id: string;
	workflow_id: string;
	proposal_id: string;
	candidate_ref: string;
	hard_filter_state: "passed" | "blocked";
	blocked_labels: string[];
	score_dimensions: FlowDeskOptimizerScoreDimensionV1[];
	advisory_score: number;
	advisory_only: true;
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

export function createFlowDeskOptimizerProposalScoreV1(input: {
	scoreId: string;
	workflowId: string;
	proposalId: string;
	candidateRef: string;
	hardFiltersPassed: boolean;
	blockedLabels?: string[];
	scoreDimensions: FlowDeskOptimizerScoreDimensionV1[];
	advisoryScore: number;
}): FlowDeskOptimizerProposalScoreV1 {
	return {
		schema_version: "flowdesk.optimizer_proposal_score.v1",
		score_id: input.scoreId,
		workflow_id: input.workflowId,
		proposal_id: input.proposalId,
		candidate_ref: input.candidateRef,
		hard_filter_state: input.hardFiltersPassed ? "passed" : "blocked",
		blocked_labels: [...(input.blockedLabels ?? [])],
		score_dimensions: input.scoreDimensions.map(d => ({ ...d })),
		advisory_score: input.hardFiltersPassed ? input.advisoryScore : 0,
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

const optimizerDimensionNames = [
	"goal_fit", "safety", "simplicity_fit", "detail_fit", "taxonomy_fit", "verification_coverage", "risk", "dependency_impact", "confidence", "cost", "latency", "model_diversity"
] as const;

function validateOptimizerScoreDimensions(value: unknown, label: string): ValidationResult {
	if (!Array.isArray(value)) return invalid(`${label} must be an array`);
	if (value.length === 0 || value.length > 12) return invalid(`${label} must be a non-empty bounded array`);
	const errors: string[] = [];
	const seen = new Set<string>();
	for (const [index, dimension] of value.entries()) {
		if (!isRecord(dimension)) {
			errors.push(`${label}[${index}] must be an object`);
			continue;
		}
		errors.push(...rejectUnknownProperties(dimension, ["dimension", "score", "weight", "reason_ref"], `${label}[${index}]`).errors);
		if (typeof dimension.dimension !== "string" || !(optimizerDimensionNames as readonly string[]).includes(dimension.dimension)) errors.push(`${label}[${index}].dimension is invalid`);
		else if (seen.has(dimension.dimension)) errors.push(`${label}[${index}].dimension must not duplicate ${dimension.dimension}`);
		else seen.add(dimension.dimension);
		if (typeof dimension.score !== "number" || !Number.isFinite(dimension.score) || dimension.score < 0 || dimension.score > 100) errors.push(`${label}[${index}].score must be 0..100`);
		if (typeof dimension.weight !== "number" || !Number.isFinite(dimension.weight) || dimension.weight < 0 || dimension.weight > 1) errors.push(`${label}[${index}].weight must be 0..1`);
		errors.push(...validateOpaqueRef(dimension.reason_ref, `${label}[${index}].reason_ref`).errors);
	}
	return errors.length === 0 ? valid() : invalid(...errors);
}

export function validateFlowDeskOptimizerProposalScoreV1(value: unknown): ValidationResult {
	if (!isRecord(value)) return invalid("optimizer proposal score must be an object");
	const record = value as Partial<FlowDeskOptimizerProposalScoreV1>;
	const errors: string[] = [];
	errors.push(...rejectUnknownProperties(record, [
		"schema_version",
		"score_id",
		"workflow_id",
		"proposal_id",
		"candidate_ref",
		"hard_filter_state",
		"blocked_labels",
		"score_dimensions",
		"advisory_score",
		"advisory_only",
		"dispatch_authority_enabled",
		"approval_authority_enabled",
		"provider_authority_enabled",
		"runtime_authority_enabled",
		"external_write_authority_enabled",
		"fallback_authority_enabled",
		"lane_launch_authority_enabled",
	], "optimizer proposal score").errors);
	errors.push(...validateOpaqueId(record.score_id, "score_id").errors);
	errors.push(...validateOpaqueId(record.workflow_id, "workflow_id").errors);
	errors.push(...validateOpaqueId(record.proposal_id, "proposal_id").errors);
	errors.push(...validateOpaqueRef(record.candidate_ref, "candidate_ref").errors);
	if (record.schema_version !== "flowdesk.optimizer_proposal_score.v1") errors.push("optimizer proposal score schema_version is invalid");
	errors.push(...validateHardFilterFields(record, "optimizer proposal score").errors);
	errors.push(...validateOptimizerScoreDimensions(record.score_dimensions, "score_dimensions").errors);
	errors.push(...validateAdvisoryAuthorityFlags(record, "optimizer proposal score").errors);
	errors.push(...validateNoForbiddenRawPayloads(record, "optimizer_proposal_score").errors);
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

// ─── P7-S5: Normalized Score Aggregation ────────────────────────────────────

/**
 * Aggregated normalized score produced from a set of `FlowDeskOptimizerProposalScoreV1`
 * score-dimension entries.  The resulting `normalized_score` is bounded 0..100 and is
 * computed by a weighted-average of the input dimensions, subject to a strict-minimum
 * rule that pins the aggregation to 0 when any dimension score falls below its declared
 * minimum threshold.
 *
 * All authority flags are disabled.  This contract is advisory-only and does not grant
 * dispatch, provider, runtime, lane-launch, fallback, write, or hard-chat authority.
 */
export interface FlowDeskNormalizedScoreAggregationV1 {
	schema_version: "flowdesk.normalized_score_aggregation.v1";
	aggregation_id: string;
	workflow_id: string;
	source_score_id: string;
	/** Dimension-level entries contributing to the aggregation. */
	dimension_scores: FlowDeskOptimizerScoreDimensionV1[];
	/** Weighted-average normalized score, 0..100.  Zeroed when any strict minimum is breached. */
	normalized_score: number;
	/** Total weight sum used for the weighted average (must be > 0). */
	total_weight: number;
	/** True when at least one dimension breached its strict minimum threshold. */
	strict_minimum_breached: boolean;
	/** Hard-filter pass/block state mirrored from the source score. */
	hard_filter_state: "passed" | "blocked";
	/** Human-readable rationale ref for why the aggregation produced this score. */
	aggregation_reason_ref: string;
	/** ISO 8601 timestamp at which the aggregation was computed. */
	aggregated_at: string;
	advisory_only: true;
	release_gate: "operational_intelligence_later_gate";
	dispatch_authority_enabled: false;
	approval_authority_enabled: false;
	provider_authority_enabled: false;
	runtime_authority_enabled: false;
	external_write_authority_enabled: false;
	fallback_authority_enabled: false;
	lane_launch_authority_enabled: false;
	write_authority_enabled: false;
	hard_chat_authority_enabled: false;
}

export interface FlowDeskNormalizedScoreAggregationResultV1 {
	ok: boolean;
	errors: string[];
	aggregation?: FlowDeskNormalizedScoreAggregationV1;
}

/**
 * Compute a weighted-average normalized score from a set of optimizer dimension scores.
 *
 * Strict minimum: if `strictMinimumThreshold` is supplied and any dimension score
 * is strictly below that threshold, the aggregated `normalized_score` is zeroed and
 * `strict_minimum_breached` is set to `true`.
 */
export function createFlowDeskNormalizedScoreAggregationV1(input: {
	aggregationId: string;
	workflowId: string;
	sourceScoreId: string;
	dimensionScores: FlowDeskOptimizerScoreDimensionV1[];
	hardFilterState: "passed" | "blocked";
	aggregationReasonRef: string;
	aggregatedAt: string;
	/** Optional per-dimension strict minimum (0..100).  Any dimension below this zeroes the score. */
	strictMinimumThreshold?: number;
}): FlowDeskNormalizedScoreAggregationResultV1 {
	const errors: string[] = [];
	errors.push(...validateOpaqueId(input.aggregationId, "aggregation_id").errors);
	errors.push(...validateOpaqueId(input.workflowId, "workflow_id").errors);
	errors.push(...validateOpaqueId(input.sourceScoreId, "source_score_id").errors);
	errors.push(...validateOpaqueRef(input.aggregationReasonRef, "aggregation_reason_ref").errors);
	errors.push(...validateTimestamp(input.aggregatedAt, "aggregated_at").errors);
	errors.push(...validateOptimizerScoreDimensions(input.dimensionScores, "dimension_scores").errors);
	if (input.hardFilterState !== "passed" && input.hardFilterState !== "blocked") errors.push("hard_filter_state must be 'passed' or 'blocked'");
	if (input.strictMinimumThreshold !== undefined && (typeof input.strictMinimumThreshold !== "number" || !Number.isFinite(input.strictMinimumThreshold) || input.strictMinimumThreshold < 0 || input.strictMinimumThreshold > 100)) errors.push("strictMinimumThreshold must be 0..100");
	if (errors.length > 0) return { ok: false, errors };

	const totalWeight = input.dimensionScores.reduce((sum, d) => sum + d.weight, 0);
	if (totalWeight <= 0) return { ok: false, errors: ["total weight of dimension_scores must be > 0"] };

	// Weighted-average aggregation
	const rawScore = input.dimensionScores.reduce((sum, d) => sum + d.score * (d.weight / totalWeight), 0);
	const clampedScore = Math.min(100, Math.max(0, rawScore));

	// Strict-minimum rule
	const threshold = input.strictMinimumThreshold ?? 0;
	const strictMinimumBreached = input.dimensionScores.some((d) => d.score < threshold);

	// Hard-filter block also zeroes the score
	const normalizedScore = (strictMinimumBreached || input.hardFilterState === "blocked") ? 0 : Math.round(clampedScore * 100) / 100;

	const aggregation: FlowDeskNormalizedScoreAggregationV1 = {
		schema_version: "flowdesk.normalized_score_aggregation.v1",
		aggregation_id: input.aggregationId,
		workflow_id: input.workflowId,
		source_score_id: input.sourceScoreId,
		dimension_scores: input.dimensionScores.map((d) => ({ ...d })),
		normalized_score: normalizedScore,
		total_weight: Math.round(totalWeight * 1e9) / 1e9,
		strict_minimum_breached: strictMinimumBreached,
		hard_filter_state: input.hardFilterState,
		aggregation_reason_ref: input.aggregationReasonRef,
		aggregated_at: input.aggregatedAt,
		advisory_only: true,
		release_gate: "operational_intelligence_later_gate",
		dispatch_authority_enabled: false,
		approval_authority_enabled: false,
		provider_authority_enabled: false,
		runtime_authority_enabled: false,
		external_write_authority_enabled: false,
		fallback_authority_enabled: false,
		lane_launch_authority_enabled: false,
		write_authority_enabled: false,
		hard_chat_authority_enabled: false,
	};
	return { ok: true, errors: [], aggregation };
}

const normalizedScoreAggregationAllowedProperties = [
	"schema_version",
	"aggregation_id",
	"workflow_id",
	"source_score_id",
	"dimension_scores",
	"normalized_score",
	"total_weight",
	"strict_minimum_breached",
	"hard_filter_state",
	"aggregation_reason_ref",
	"aggregated_at",
	"advisory_only",
	"release_gate",
	"dispatch_authority_enabled",
	"approval_authority_enabled",
	"provider_authority_enabled",
	"runtime_authority_enabled",
	"external_write_authority_enabled",
	"fallback_authority_enabled",
	"lane_launch_authority_enabled",
	"write_authority_enabled",
	"hard_chat_authority_enabled",
] as const;

export function validateFlowDeskNormalizedScoreAggregationV1(value: unknown): ValidationResult {
	if (!isRecord(value)) return invalid("normalized score aggregation must be an object");
	const record = value as Record<string, unknown>;
	const errors: string[] = [];

	// Closed schema: reject unknown properties
	errors.push(...rejectUnknownProperties(record, normalizedScoreAggregationAllowedProperties, "normalized score aggregation").errors);

	if (record.schema_version !== "flowdesk.normalized_score_aggregation.v1") errors.push("normalized score aggregation schema_version is invalid");
	if (record.release_gate !== "operational_intelligence_later_gate") errors.push("normalized score aggregation release_gate is invalid");

	errors.push(...validateOpaqueId(record.aggregation_id, "aggregation_id").errors);
	errors.push(...validateOpaqueId(record.workflow_id, "workflow_id").errors);
	errors.push(...validateOpaqueId(record.source_score_id, "source_score_id").errors);
	errors.push(...validateOpaqueRef(record.aggregation_reason_ref, "aggregation_reason_ref").errors);
	errors.push(...validateTimestamp(record.aggregated_at, "aggregated_at").errors);

	// Validate dimension_scores
	errors.push(...validateOptimizerScoreDimensions(record.dimension_scores, "dimension_scores").errors);

	// Validate normalized_score: bounded 0..100
	if (typeof record.normalized_score !== "number" || !Number.isFinite(record.normalized_score) || record.normalized_score < 0 || record.normalized_score > 100) {
		errors.push("normalized_score must be a finite number 0..100");
	}

	// Validate total_weight: must be > 0
	if (typeof record.total_weight !== "number" || !Number.isFinite(record.total_weight) || record.total_weight <= 0) {
		errors.push("total_weight must be a positive finite number");
	}

	// Validate strict_minimum_breached
	if (typeof record.strict_minimum_breached !== "boolean") {
		errors.push("strict_minimum_breached must be a boolean");
	}

	// Validate hard_filter_state
	if (record.hard_filter_state !== "passed" && record.hard_filter_state !== "blocked") {
		errors.push("hard_filter_state must be 'passed' or 'blocked'");
	}

	// Consistency: blocked hard filter or strict_minimum_breached must zero the score
	if ((record.hard_filter_state === "blocked" || record.strict_minimum_breached === true) && record.normalized_score !== 0) {
		errors.push("normalized_score must be 0 when hard_filter_state is 'blocked' or strict_minimum_breached is true");
	}

	// Authority flags — all explicitly disabled, advisory_only required
	if (record.advisory_only !== true
		|| record.dispatch_authority_enabled !== false
		|| record.approval_authority_enabled !== false
		|| record.provider_authority_enabled !== false
		|| record.runtime_authority_enabled !== false
		|| record.external_write_authority_enabled !== false
		|| record.fallback_authority_enabled !== false
		|| record.lane_launch_authority_enabled !== false
		|| record.write_authority_enabled !== false
		|| record.hard_chat_authority_enabled !== false) {
		errors.push("normalized score aggregation must remain advisory-only with no dispatch, approval, provider, runtime, external-write, fallback, lane-launch, write, or hard-chat authority");
	}

	errors.push(...validateNoForbiddenRawPayloads(record, "normalized_score_aggregation").errors);
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

// ─── P7-S6: Score Reuse Threshold Gate ──────────────────────────────────────

/**
 * Advisory decision label for whether an existing score/aggregation can be
 * reused, must be recomputed, or is blocked from any use.
 *
 * - `reuse`: the existing score is fresh enough and context-consistent; consumers
 *   MAY reuse it without recomputing.
 * - `recompute`: the existing score is stale or context has drifted; consumers
 *   SHOULD trigger a recomputation before relying on the score.
 * - `blocked`: the gate cannot reach a reuse/recompute decision (e.g., missing
 *   required inputs, hard-filter failure).  Consumers MUST treat the score as
 *   unusable.
 */
export type FlowDeskScoreReuseDecisionLabelV1 = "reuse" | "recompute" | "blocked";

/**
 * Advisory-only contract encoding a bounded reuse vs recompute decision for an
 * existing `FlowDeskOptimizerProposalScoreV1` or
 * `FlowDeskNormalizedScoreAggregationV1`.
 *
 * All authority flags are disabled.  This record never grants dispatch, provider,
 * runtime, lane-launch, fallback, write, remote-write, or hard-chat authority.
 */
export interface FlowDeskScoreReuseThresholdGateV1 {
	schema_version: "flowdesk.score_reuse_threshold_gate.v1";
	gate_id: string;
	workflow_id: string;
	/** Opaque reference to the score being evaluated for reuse. */
	previous_score_ref: string;
	/** Hash of the context at the time the previous score was computed. */
	previous_context_hash: string;
	/** Hash of the context at the time this gate is evaluated. */
	current_context_hash: string;
	/** Age of the previous score in seconds at gate evaluation time.  Must be >= 0. */
	score_age_seconds: number;
	/** Maximum acceptable age in seconds for score reuse.  Must be > 0. */
	max_age_threshold_seconds: number;
	/** Minimum advisory score required for the "reuse" decision (0..100).  Default 0. */
	min_score_threshold: number;
	/** Advisory score of the previous score record (0..100). */
	previous_advisory_score: number;
	/** True when the context hashes match (no context drift). */
	context_match: boolean;
	/** True when score_age_seconds <= max_age_threshold_seconds. */
	within_age_threshold: boolean;
	/** True when previous_advisory_score >= min_score_threshold. */
	above_min_score: boolean;
	/** The gate decision. */
	gate_decision: FlowDeskScoreReuseDecisionLabelV1;
	/** Human-readable rationale refs for the gate decision.  Non-empty. */
	reason_refs: string[];
	/** ISO 8601 timestamp at which this gate was evaluated. */
	evaluated_at: string;
	advisory_only: true;
	non_authorizing: true;
	release_gate: "operational_intelligence_later_gate";
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
}

export interface FlowDeskScoreReuseThresholdGateResultV1 {
	ok: boolean;
	errors: string[];
	gate?: FlowDeskScoreReuseThresholdGateV1;
}

/**
 * Evaluate whether an existing advisory score can be reused.
 *
 * Decision rules (evaluated in order):
 * 1. If `blocked` (any input validation error or previousAdvisoryScore is on a
 *    blocked hard filter, or contextMatch is forced false due to hash mismatch
 *    and context is explicitly provided as mismatched): decision = "blocked".
 * 2. If context hashes differ OR score age exceeds threshold OR advisory score
 *    is below min threshold: decision = "recompute".
 * 3. Otherwise: decision = "reuse".
 */
export function createFlowDeskScoreReuseThresholdGateV1(input: {
	gateId: string;
	workflowId: string;
	previousScoreRef: string;
	previousContextHash: string;
	currentContextHash: string;
	scoreAgeSeconds: number;
	maxAgeThresholdSeconds: number;
	minScoreThreshold?: number;
	previousAdvisoryScore: number;
	reasonRefs: string[];
	evaluatedAt: string;
}): FlowDeskScoreReuseThresholdGateResultV1 {
	const errors: string[] = [];
	errors.push(...validateOpaqueId(input.gateId, "gate_id").errors);
	errors.push(...validateOpaqueId(input.workflowId, "workflow_id").errors);
	errors.push(...validateOpaqueRef(input.previousScoreRef, "previous_score_ref").errors);
	errors.push(...validateHashRef(input.previousContextHash, "previous_context_hash").errors);
	errors.push(...validateHashRef(input.currentContextHash, "current_context_hash").errors);
	errors.push(...validateTimestamp(input.evaluatedAt, "evaluated_at").errors);
	if (typeof input.scoreAgeSeconds !== "number" || !Number.isFinite(input.scoreAgeSeconds) || input.scoreAgeSeconds < 0) errors.push("score_age_seconds must be a non-negative finite number");
	if (typeof input.maxAgeThresholdSeconds !== "number" || !Number.isFinite(input.maxAgeThresholdSeconds) || input.maxAgeThresholdSeconds <= 0) errors.push("max_age_threshold_seconds must be a positive finite number");
	const minScoreThreshold = input.minScoreThreshold ?? 0;
	if (typeof minScoreThreshold !== "number" || !Number.isFinite(minScoreThreshold) || minScoreThreshold < 0 || minScoreThreshold > 100) errors.push("min_score_threshold must be 0..100");
	if (typeof input.previousAdvisoryScore !== "number" || !Number.isFinite(input.previousAdvisoryScore) || input.previousAdvisoryScore < 0 || input.previousAdvisoryScore > 100) errors.push("previous_advisory_score must be 0..100");
	if (!Array.isArray(input.reasonRefs) || input.reasonRefs.length === 0) errors.push("reason_refs must be a non-empty array");
	else for (const [index, ref] of input.reasonRefs.entries()) errors.push(...validateOpaqueRef(ref, `reason_refs[${index}]`).errors);
	if (errors.length > 0) return { ok: false, errors };

	const contextMatch = input.previousContextHash === input.currentContextHash;
	const withinAgeThreshold = input.scoreAgeSeconds <= input.maxAgeThresholdSeconds;
	const aboveMinScore = input.previousAdvisoryScore >= minScoreThreshold;

	let gateDecision: FlowDeskScoreReuseDecisionLabelV1;
	if (!contextMatch || !withinAgeThreshold || !aboveMinScore) {
		gateDecision = "recompute";
	} else {
		gateDecision = "reuse";
	}

	const gate: FlowDeskScoreReuseThresholdGateV1 = {
		schema_version: "flowdesk.score_reuse_threshold_gate.v1",
		gate_id: input.gateId,
		workflow_id: input.workflowId,
		previous_score_ref: input.previousScoreRef,
		previous_context_hash: input.previousContextHash,
		current_context_hash: input.currentContextHash,
		score_age_seconds: input.scoreAgeSeconds,
		max_age_threshold_seconds: input.maxAgeThresholdSeconds,
		min_score_threshold: minScoreThreshold,
		previous_advisory_score: input.previousAdvisoryScore,
		context_match: contextMatch,
		within_age_threshold: withinAgeThreshold,
		above_min_score: aboveMinScore,
		gate_decision: gateDecision,
		reason_refs: [...input.reasonRefs],
		evaluated_at: input.evaluatedAt,
		advisory_only: true,
		non_authorizing: true,
		release_gate: "operational_intelligence_later_gate",
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
	};
	return { ok: true, errors: [], gate };
}

const scoreReuseThresholdGateAllowedProperties = [
	"schema_version",
	"gate_id",
	"workflow_id",
	"previous_score_ref",
	"previous_context_hash",
	"current_context_hash",
	"score_age_seconds",
	"max_age_threshold_seconds",
	"min_score_threshold",
	"previous_advisory_score",
	"context_match",
	"within_age_threshold",
	"above_min_score",
	"gate_decision",
	"reason_refs",
	"evaluated_at",
	"advisory_only",
	"non_authorizing",
	"release_gate",
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
] as const;

const scoreReuseDecisionLabels: readonly string[] = ["reuse", "recompute", "blocked"];

export function validateFlowDeskScoreReuseThresholdGateV1(value: unknown): ValidationResult {
	if (!isRecord(value)) return invalid("score reuse threshold gate must be an object");
	const record = value as Record<string, unknown>;
	const errors: string[] = [];

	// Closed schema: reject unknown properties
	errors.push(...rejectUnknownProperties(record, scoreReuseThresholdGateAllowedProperties, "score reuse threshold gate").errors);

	if (record.schema_version !== "flowdesk.score_reuse_threshold_gate.v1") errors.push("score reuse threshold gate schema_version is invalid");
	if (record.release_gate !== "operational_intelligence_later_gate") errors.push("score reuse threshold gate release_gate is invalid");

	errors.push(...validateOpaqueId(record.gate_id, "gate_id").errors);
	errors.push(...validateOpaqueId(record.workflow_id, "workflow_id").errors);
	errors.push(...validateOpaqueRef(record.previous_score_ref, "previous_score_ref").errors);
	errors.push(...validateHashRef(record.previous_context_hash, "previous_context_hash").errors);
	errors.push(...validateHashRef(record.current_context_hash, "current_context_hash").errors);
	errors.push(...validateTimestamp(record.evaluated_at, "evaluated_at").errors);

	// Numeric range checks
	if (typeof record.score_age_seconds !== "number" || !Number.isFinite(record.score_age_seconds) || record.score_age_seconds < 0) errors.push("score_age_seconds must be a non-negative finite number");
	if (typeof record.max_age_threshold_seconds !== "number" || !Number.isFinite(record.max_age_threshold_seconds) || record.max_age_threshold_seconds <= 0) errors.push("max_age_threshold_seconds must be a positive finite number");
	if (typeof record.min_score_threshold !== "number" || !Number.isFinite(record.min_score_threshold) || record.min_score_threshold < 0 || record.min_score_threshold > 100) errors.push("min_score_threshold must be 0..100");
	if (typeof record.previous_advisory_score !== "number" || !Number.isFinite(record.previous_advisory_score) || record.previous_advisory_score < 0 || record.previous_advisory_score > 100) errors.push("previous_advisory_score must be 0..100");

	// Boolean fields
	if (typeof record.context_match !== "boolean") errors.push("context_match must be a boolean");
	if (typeof record.within_age_threshold !== "boolean") errors.push("within_age_threshold must be a boolean");
	if (typeof record.above_min_score !== "boolean") errors.push("above_min_score must be a boolean");

	// gate_decision
	if (typeof record.gate_decision !== "string" || !scoreReuseDecisionLabels.includes(record.gate_decision)) errors.push("gate_decision must be 'reuse', 'recompute', or 'blocked'");

	// reason_refs
	if (!Array.isArray(record.reason_refs) || record.reason_refs.length === 0) errors.push("reason_refs must be a non-empty array");
	else for (const [index, ref] of record.reason_refs.entries()) errors.push(...validateOpaqueRef(ref, `reason_refs[${index}]`).errors);

	// Consistency: reuse decision requires all three sub-conditions to be true
	if (record.gate_decision === "reuse" && (record.context_match !== true || record.within_age_threshold !== true || record.above_min_score !== true)) {
		errors.push("gate_decision 'reuse' requires context_match, within_age_threshold, and above_min_score to all be true");
	}

	// Consistency: blocked decision is reserved for validation failures; a fully
	// valid record produced by the creator can only be "reuse" or "recompute".
	// Validators must reject "blocked" when all three sub-conditions are actually
	// evaluable (i.e., this is a well-formed record — the creator never emits "blocked").
	// We enforce: if gate_decision=blocked then at least one sub-condition must
	// also be false (or the record is inconsistent, since blocked means unusable inputs).
	if (record.gate_decision === "blocked"
		&& record.context_match === true
		&& record.within_age_threshold === true
		&& record.above_min_score === true) {
		errors.push("gate_decision 'blocked' is inconsistent: all sub-conditions are true but gate claims blocked");
	}

	// Authority flags — all explicitly disabled
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
		|| record.hard_chat_authority_enabled !== false) {
		errors.push("score reuse threshold gate must remain advisory-only non-authorizing with no dispatch, approval, provider, runtime, external-write, remote-write, fallback, lane-launch, write, or hard-chat authority");
	}

	errors.push(...validateNoForbiddenRawPayloads(record, "score_reuse_threshold_gate").errors);
	return errors.length === 0 ? valid() : invalid(...errors);
}

// ─── P7-S7: Fanout Cadence Gate ──────────────────────────────────────────────

/**
 * Advisory decision label for whether a proposed multi-lane fanout/cadence is
 * within safe bounds.
 *
 * - `allow`:   Proposed fanout is within all declared constraints; consumers MAY
 *              proceed as requested.
 * - `reduce`:  Proposed lane count or cadence exceeds a soft advisory bound;
 *              consumers SHOULD reduce concurrency or widen the cadence window.
 * - `hold`:    The gate cannot safely advise proceed or reduce (e.g., active lane
 *              count or cooldown constraint is violated); consumers MUST pause.
 * - `blocked`: A hard constraint is violated (e.g., requested count > max) or
 *              input validation failed; consumers MUST NOT proceed.
 */
export type FlowDeskFanoutCadenceDecisionLabelV1 = "allow" | "reduce" | "hold" | "blocked";

/**
 * Advisory-only contract encoding a bounded fanout/cadence gate decision for a
 * proposed multi-lane execution.
 *
 * All authority flags are disabled.  This record never grants dispatch, provider,
 * runtime, lane-launch, fallback, write, remote-write, or hard-chat authority.
 */
export interface FlowDeskFanoutCadenceGateV1 {
	schema_version: "flowdesk.fanout_cadence_gate.v1";
	gate_id: string;
	workflow_id: string;
	/** Number of lanes proposed for the next fanout burst.  Must be >= 1. */
	requested_lane_count: number;
	/** Advisory maximum concurrent lanes permitted.  Must be >= 1. */
	max_concurrent_lanes: number;
	/** Number of lanes currently active at gate evaluation time.  Must be >= 0. */
	active_lane_count: number;
	/** Cadence window in seconds within which the cooldown applies.  Must be >= 0. */
	cadence_window_seconds: number;
	/** Minimum required cooldown in seconds between fanout bursts.  Must be >= 0. */
	cooldown_seconds: number;
	/** Seconds elapsed since the last fanout burst was initiated.  Must be >= 0. */
	seconds_since_last_burst: number;
	/** Advisory risk labels for the proposed fanout (may be empty). */
	risk_labels: string[];
	/** Opaque references to the dependency records influencing this gate (may be empty). */
	dependency_refs: string[];
	/** Human-readable rationale refs for the gate decision.  Non-empty. */
	reason_refs: string[];
	/** The gate decision. */
	gate_decision: FlowDeskFanoutCadenceDecisionLabelV1;
	/** ISO 8601 timestamp at which this gate was evaluated. */
	evaluated_at: string;
	advisory_only: true;
	non_authorizing: true;
	release_gate: "operational_intelligence_later_gate";
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
}

export interface FlowDeskFanoutCadenceGateResultV1 {
	ok: boolean;
	errors: string[];
	gate?: FlowDeskFanoutCadenceGateV1;
}

/**
 * Evaluate whether a proposed multi-lane fanout is within safe advisory bounds.
 *
 * Decision rules (evaluated in priority order):
 * 1. `blocked`:  requested_lane_count > max_concurrent_lanes, OR any input
 *                validation error.
 * 2. `hold`:     active_lane_count + requested_lane_count > max_concurrent_lanes
 *                (would exceed max if launched now), OR seconds_since_last_burst <
 *                cooldown_seconds (cooldown not yet elapsed).
 * 3. `reduce`:   requested_lane_count > (max_concurrent_lanes / 2) — soft advisory
 *                half-capacity bound.
 * 4. `allow`:    All constraints pass.
 */
export function createFlowDeskFanoutCadenceGateV1(input: {
	gateId: string;
	workflowId: string;
	requestedLaneCount: number;
	maxConcurrentLanes: number;
	activeLaneCount: number;
	cadenceWindowSeconds: number;
	cooldownSeconds: number;
	secondsSinceLastBurst: number;
	riskLabels?: string[];
	dependencyRefs?: string[];
	reasonRefs: string[];
	evaluatedAt: string;
}): FlowDeskFanoutCadenceGateResultV1 {
	const errors: string[] = [];
	errors.push(...validateOpaqueId(input.gateId, "gate_id").errors);
	errors.push(...validateOpaqueId(input.workflowId, "workflow_id").errors);
	errors.push(...validateTimestamp(input.evaluatedAt, "evaluated_at").errors);

	// Numeric range checks
	if (typeof input.requestedLaneCount !== "number" || !Number.isInteger(input.requestedLaneCount) || input.requestedLaneCount < 1) errors.push("requested_lane_count must be a positive integer >= 1");
	if (typeof input.maxConcurrentLanes !== "number" || !Number.isInteger(input.maxConcurrentLanes) || input.maxConcurrentLanes < 1) errors.push("max_concurrent_lanes must be a positive integer >= 1");
	if (typeof input.activeLaneCount !== "number" || !Number.isInteger(input.activeLaneCount) || input.activeLaneCount < 0) errors.push("active_lane_count must be a non-negative integer");
	if (typeof input.cadenceWindowSeconds !== "number" || !Number.isFinite(input.cadenceWindowSeconds) || input.cadenceWindowSeconds < 0) errors.push("cadence_window_seconds must be a non-negative finite number");
	if (typeof input.cooldownSeconds !== "number" || !Number.isFinite(input.cooldownSeconds) || input.cooldownSeconds < 0) errors.push("cooldown_seconds must be a non-negative finite number");
	if (typeof input.secondsSinceLastBurst !== "number" || !Number.isFinite(input.secondsSinceLastBurst) || input.secondsSinceLastBurst < 0) errors.push("seconds_since_last_burst must be a non-negative finite number");

	// risk_labels: optional; if provided each entry must be a bounded opaque label
	const riskLabels = input.riskLabels ?? [];
	if (!Array.isArray(riskLabels)) errors.push("risk_labels must be an array");
	else for (const [index, label] of riskLabels.entries()) errors.push(...validateOpaqueRef(label, `risk_labels[${index}]`).errors);

	// dependency_refs: optional; if provided each entry must be an opaque ref
	const dependencyRefs = input.dependencyRefs ?? [];
	if (!Array.isArray(dependencyRefs)) errors.push("dependency_refs must be an array");
	else for (const [index, ref] of dependencyRefs.entries()) errors.push(...validateOpaqueRef(ref, `dependency_refs[${index}]`).errors);

	// reason_refs: required non-empty array of opaque refs
	if (!Array.isArray(input.reasonRefs) || input.reasonRefs.length === 0) errors.push("reason_refs must be a non-empty array");
	else for (const [index, ref] of input.reasonRefs.entries()) errors.push(...validateOpaqueRef(ref, `reason_refs[${index}]`).errors);

	if (errors.length > 0) return { ok: false, errors };

	// Decision logic
	let gateDecision: FlowDeskFanoutCadenceDecisionLabelV1;

	// Rule 1: Hard blocked — requested exceeds absolute maximum
	if (input.requestedLaneCount > input.maxConcurrentLanes) {
		gateDecision = "blocked";
	}
	// Rule 2: Hold — would exceed capacity when added to active, or cooldown not elapsed
	else if (
		(input.activeLaneCount + input.requestedLaneCount) > input.maxConcurrentLanes ||
		(input.cooldownSeconds > 0 && input.secondsSinceLastBurst < input.cooldownSeconds)
	) {
		gateDecision = "hold";
	}
	// Rule 3: Reduce — soft advisory half-capacity bound
	else if (input.requestedLaneCount > Math.floor(input.maxConcurrentLanes / 2)) {
		gateDecision = "reduce";
	}
	// Rule 4: All clear
	else {
		gateDecision = "allow";
	}

	const gate: FlowDeskFanoutCadenceGateV1 = {
		schema_version: "flowdesk.fanout_cadence_gate.v1",
		gate_id: input.gateId,
		workflow_id: input.workflowId,
		requested_lane_count: input.requestedLaneCount,
		max_concurrent_lanes: input.maxConcurrentLanes,
		active_lane_count: input.activeLaneCount,
		cadence_window_seconds: input.cadenceWindowSeconds,
		cooldown_seconds: input.cooldownSeconds,
		seconds_since_last_burst: input.secondsSinceLastBurst,
		risk_labels: [...riskLabels],
		dependency_refs: [...dependencyRefs],
		reason_refs: [...input.reasonRefs],
		gate_decision: gateDecision,
		evaluated_at: input.evaluatedAt,
		advisory_only: true,
		non_authorizing: true,
		release_gate: "operational_intelligence_later_gate",
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
	};
	return { ok: true, errors: [], gate };
}

const fanoutCadenceGateAllowedProperties = [
	"schema_version",
	"gate_id",
	"workflow_id",
	"requested_lane_count",
	"max_concurrent_lanes",
	"active_lane_count",
	"cadence_window_seconds",
	"cooldown_seconds",
	"seconds_since_last_burst",
	"risk_labels",
	"dependency_refs",
	"reason_refs",
	"gate_decision",
	"evaluated_at",
	"advisory_only",
	"non_authorizing",
	"release_gate",
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
] as const;

const fanoutCadenceDecisionLabels: readonly string[] = ["allow", "reduce", "hold", "blocked"];

export function validateFlowDeskFanoutCadenceGateV1(value: unknown): ValidationResult {
	if (!isRecord(value)) return invalid("fanout cadence gate must be an object");
	const record = value as Record<string, unknown>;
	const errors: string[] = [];

	// Closed schema: reject unknown properties
	errors.push(...rejectUnknownProperties(record, fanoutCadenceGateAllowedProperties, "fanout cadence gate").errors);

	if (record.schema_version !== "flowdesk.fanout_cadence_gate.v1") errors.push("fanout cadence gate schema_version is invalid");
	if (record.release_gate !== "operational_intelligence_later_gate") errors.push("fanout cadence gate release_gate is invalid");

	errors.push(...validateOpaqueId(record.gate_id, "gate_id").errors);
	errors.push(...validateOpaqueId(record.workflow_id, "workflow_id").errors);
	errors.push(...validateTimestamp(record.evaluated_at, "evaluated_at").errors);

	// Numeric range checks
	if (typeof record.requested_lane_count !== "number" || !Number.isInteger(record.requested_lane_count) || record.requested_lane_count < 1) errors.push("requested_lane_count must be a positive integer >= 1");
	if (typeof record.max_concurrent_lanes !== "number" || !Number.isInteger(record.max_concurrent_lanes) || record.max_concurrent_lanes < 1) errors.push("max_concurrent_lanes must be a positive integer >= 1");
	if (typeof record.active_lane_count !== "number" || !Number.isInteger(record.active_lane_count) || record.active_lane_count < 0) errors.push("active_lane_count must be a non-negative integer");
	if (typeof record.cadence_window_seconds !== "number" || !Number.isFinite(record.cadence_window_seconds) || record.cadence_window_seconds < 0) errors.push("cadence_window_seconds must be a non-negative finite number");
	if (typeof record.cooldown_seconds !== "number" || !Number.isFinite(record.cooldown_seconds) || record.cooldown_seconds < 0) errors.push("cooldown_seconds must be a non-negative finite number");
	if (typeof record.seconds_since_last_burst !== "number" || !Number.isFinite(record.seconds_since_last_burst) || record.seconds_since_last_burst < 0) errors.push("seconds_since_last_burst must be a non-negative finite number");

	// risk_labels: array, each entry opaque ref
	if (!Array.isArray(record.risk_labels)) errors.push("risk_labels must be an array");
	else for (const [index, label] of record.risk_labels.entries()) errors.push(...validateOpaqueRef(label, `risk_labels[${index}]`).errors);

	// dependency_refs: array, each entry opaque ref
	if (!Array.isArray(record.dependency_refs)) errors.push("dependency_refs must be an array");
	else for (const [index, ref] of record.dependency_refs.entries()) errors.push(...validateOpaqueRef(ref, `dependency_refs[${index}]`).errors);

	// reason_refs: non-empty array of opaque refs
	if (!Array.isArray(record.reason_refs) || record.reason_refs.length === 0) errors.push("reason_refs must be a non-empty array");
	else for (const [index, ref] of (record.reason_refs as unknown[]).entries()) errors.push(...validateOpaqueRef(ref, `reason_refs[${index}]`).errors);

	// gate_decision
	if (typeof record.gate_decision !== "string" || !fanoutCadenceDecisionLabels.includes(record.gate_decision)) {
		errors.push("gate_decision must be 'allow', 'reduce', 'hold', or 'blocked'");
	}

	// Consistency: allow decision requires requested <= max, active+requested <= max, cooldown elapsed
	if (record.gate_decision === "allow") {
		if (typeof record.requested_lane_count === "number" && typeof record.max_concurrent_lanes === "number" &&
			record.requested_lane_count > record.max_concurrent_lanes) {
			errors.push("gate_decision 'allow' is inconsistent: requested_lane_count exceeds max_concurrent_lanes");
		}
		if (typeof record.active_lane_count === "number" && typeof record.requested_lane_count === "number" &&
			typeof record.max_concurrent_lanes === "number" &&
			(record.active_lane_count + record.requested_lane_count) > record.max_concurrent_lanes) {
			errors.push("gate_decision 'allow' is inconsistent: active_lane_count + requested_lane_count exceeds max_concurrent_lanes");
		}
		if (typeof record.cooldown_seconds === "number" && record.cooldown_seconds > 0 &&
			typeof record.seconds_since_last_burst === "number" &&
			record.seconds_since_last_burst < record.cooldown_seconds) {
			errors.push("gate_decision 'allow' is inconsistent: cooldown has not yet elapsed");
		}
	}

	// Consistency: blocked decision requires requested > max
	if (record.gate_decision === "blocked") {
		if (typeof record.requested_lane_count === "number" && typeof record.max_concurrent_lanes === "number" &&
			record.requested_lane_count <= record.max_concurrent_lanes &&
			typeof record.active_lane_count === "number" &&
			(record.active_lane_count + record.requested_lane_count) <= record.max_concurrent_lanes &&
			typeof record.cooldown_seconds === "number" &&
			typeof record.seconds_since_last_burst === "number" &&
			(record.cooldown_seconds === 0 || record.seconds_since_last_burst >= record.cooldown_seconds)) {
			errors.push("gate_decision 'blocked' is inconsistent: all constraints pass but gate claims blocked");
		}
	}

	// Authority flags — all explicitly disabled, advisory_only and non_authorizing required
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
		|| record.hard_chat_authority_enabled !== false) {
		errors.push("fanout cadence gate must remain advisory-only non-authorizing with no dispatch, approval, provider, runtime, external-write, remote-write, fallback, lane-launch, write, or hard-chat authority");
	}

	errors.push(...validateNoForbiddenRawPayloads(record, "fanout_cadence_gate").errors);
	return errors.length === 0 ? valid() : invalid(...errors);
}

// ─── P7-S8: Local Ledger Snapshot ────────────────────────────────────────────

/**
 * Pure advisory snapshot of the local operational-intelligence ledger state.
 *
 * Captures bounded metadata about the in-memory or durable ledger (entry count,
 * oldest/newest entry refs, staleness, content hash summary) **without** performing
 * actual I/O, runtime ledger access, or persistence.
 *
 * All authority flags are disabled.  This contract is advisory-only, non-authorizing,
 * and never grants dispatch, provider, runtime, lane-launch, fallback, write,
 * remote-write, or hard-chat authority.
 */
export interface FlowDeskLocalLedgerSnapshotV1 {
	schema_version: "flowdesk.local_ledger_snapshot.v1";
	snapshot_id: string;
	workflow_id: string;
	/** ISO 8601 timestamp at which this snapshot was captured. */
	captured_at: string;
	/** Number of ledger entries at capture time. Must be >= 0. */
	entry_count: number;
	/** Opaque reference to the oldest entry in the ledger (absent when entry_count=0). */
	oldest_entry_ref?: string;
	/** Opaque reference to the newest entry in the ledger (absent when entry_count=0). */
	newest_entry_ref?: string;
	/** sha256-<hex> content hash summary of all ledger entries (absent when entry_count=0). */
	content_hash_summary?: string;
	/** Staleness of the snapshot in seconds relative to its captured_at time. Must be >= 0. */
	staleness_seconds: number;
	/** Advisory safe next actions for consumers of this snapshot. */
	safe_next_actions: string[];
	advisory_only: true;
	non_authorizing: true;
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
}

export interface FlowDeskLocalLedgerSnapshotResultV1 {
	ok: boolean;
	errors: string[];
	snapshot?: FlowDeskLocalLedgerSnapshotV1;
}

/**
 * Create an advisory local ledger snapshot.
 *
 * No I/O is performed.  The caller supplies all field values derived from
 * whatever in-memory or already-decoded ledger state they have available.
 *
 * Consistency rules enforced:
 * - `oldest_entry_ref` and `newest_entry_ref` must both be absent when
 *   `entry_count` is 0 (you cannot have refs with an empty ledger).
 * - `content_hash_summary` must be absent when `entry_count` is 0.
 * - `oldest_entry_ref` and `newest_entry_ref` must both be present or both absent.
 */
export function createFlowDeskLocalLedgerSnapshotV1(input: {
	snapshotId: string;
	workflowId: string;
	capturedAt: string;
	entryCount: number;
	oldestEntryRef?: string;
	newestEntryRef?: string;
	contentHashSummary?: string;
	stalenessSeconds: number;
	safeNextActions: string[];
}): FlowDeskLocalLedgerSnapshotResultV1 {
	const errors: string[] = [];
	errors.push(...validateOpaqueId(input.snapshotId, "snapshot_id").errors);
	errors.push(...validateOpaqueId(input.workflowId, "workflow_id").errors);
	errors.push(...validateTimestamp(input.capturedAt, "captured_at").errors);

	if (typeof input.entryCount !== "number" || !Number.isInteger(input.entryCount) || input.entryCount < 0) {
		errors.push("entry_count must be a non-negative integer");
	}
	if (typeof input.stalenessSeconds !== "number" || !Number.isFinite(input.stalenessSeconds) || input.stalenessSeconds < 0) {
		errors.push("staleness_seconds must be a non-negative finite number");
	}

	if (input.oldestEntryRef !== undefined) errors.push(...validateOpaqueRef(input.oldestEntryRef, "oldest_entry_ref").errors);
	if (input.newestEntryRef !== undefined) errors.push(...validateOpaqueRef(input.newestEntryRef, "newest_entry_ref").errors);

	if (input.contentHashSummary !== undefined) {
		errors.push(...validateHashRef(input.contentHashSummary, "content_hash_summary").errors);
	}

	if (!Array.isArray(input.safeNextActions) || input.safeNextActions.length === 0 || input.safeNextActions.length > 8) {
		errors.push("safe_next_actions must be a non-empty bounded array (1..8 entries)");
	} else {
		for (const [index, action] of input.safeNextActions.entries()) {
			errors.push(...validateOpaqueRef(action, `safe_next_actions[${index}]`).errors);
		}
	}

	// Consistency: entry_count=0 must not carry entry refs or content hash
	const entryCountZero = typeof input.entryCount === "number" && input.entryCount === 0;
	if (entryCountZero && input.oldestEntryRef !== undefined) errors.push("oldest_entry_ref must be absent when entry_count is 0");
	if (entryCountZero && input.newestEntryRef !== undefined) errors.push("newest_entry_ref must be absent when entry_count is 0");
	if (entryCountZero && input.contentHashSummary !== undefined) errors.push("content_hash_summary must be absent when entry_count is 0");

	// Consistency: entry refs must appear together (both present or both absent)
	const hasOldest = input.oldestEntryRef !== undefined;
	const hasNewest = input.newestEntryRef !== undefined;
	if (hasOldest !== hasNewest) errors.push("oldest_entry_ref and newest_entry_ref must both be present or both absent");

	if (errors.length > 0) return { ok: false, errors };

	const snapshot: FlowDeskLocalLedgerSnapshotV1 = {
		schema_version: "flowdesk.local_ledger_snapshot.v1",
		snapshot_id: input.snapshotId,
		workflow_id: input.workflowId,
		captured_at: input.capturedAt,
		entry_count: input.entryCount,
		...(input.oldestEntryRef !== undefined ? { oldest_entry_ref: input.oldestEntryRef } : {}),
		...(input.newestEntryRef !== undefined ? { newest_entry_ref: input.newestEntryRef } : {}),
		...(input.contentHashSummary !== undefined ? { content_hash_summary: input.contentHashSummary } : {}),
		staleness_seconds: input.stalenessSeconds,
		safe_next_actions: [...input.safeNextActions],
		advisory_only: true,
		non_authorizing: true,
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
	};
	return { ok: true, errors: [], snapshot };
}

const localLedgerSnapshotAllowedProperties = [
	"schema_version",
	"snapshot_id",
	"workflow_id",
	"captured_at",
	"entry_count",
	"oldest_entry_ref",
	"newest_entry_ref",
	"content_hash_summary",
	"staleness_seconds",
	"safe_next_actions",
	"advisory_only",
	"non_authorizing",
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
] as const;

export function validateFlowDeskLocalLedgerSnapshotV1(value: unknown): ValidationResult {
	if (!isRecord(value)) return invalid("local ledger snapshot must be an object");
	const record = value as Record<string, unknown>;
	const errors: string[] = [];

	// Closed schema: reject unknown properties
	errors.push(...rejectUnknownProperties(record, localLedgerSnapshotAllowedProperties, "local ledger snapshot").errors);

	if (record.schema_version !== "flowdesk.local_ledger_snapshot.v1") errors.push("local ledger snapshot schema_version is invalid");

	errors.push(...validateOpaqueId(record.snapshot_id, "snapshot_id").errors);
	errors.push(...validateOpaqueId(record.workflow_id, "workflow_id").errors);
	errors.push(...validateTimestamp(record.captured_at, "captured_at").errors);

	// entry_count: non-negative integer
	if (typeof record.entry_count !== "number" || !Number.isInteger(record.entry_count) || record.entry_count < 0) {
		errors.push("entry_count must be a non-negative integer");
	}

	// staleness_seconds: non-negative finite number
	if (typeof record.staleness_seconds !== "number" || !Number.isFinite(record.staleness_seconds) || record.staleness_seconds < 0) {
		errors.push("staleness_seconds must be a non-negative finite number");
	}

	// Optional opaque refs
	if (record.oldest_entry_ref !== undefined) errors.push(...validateOpaqueRef(record.oldest_entry_ref, "oldest_entry_ref").errors);
	if (record.newest_entry_ref !== undefined) errors.push(...validateOpaqueRef(record.newest_entry_ref, "newest_entry_ref").errors);

	// Optional content hash summary
	if (record.content_hash_summary !== undefined) {
		errors.push(...validateHashRef(record.content_hash_summary, "content_hash_summary").errors);
	}

	// safe_next_actions: non-empty bounded array of opaque refs
	if (!Array.isArray(record.safe_next_actions) || record.safe_next_actions.length === 0 || record.safe_next_actions.length > 8) {
		errors.push("safe_next_actions must be a non-empty bounded array (1..8 entries)");
	} else {
		for (const [index, action] of record.safe_next_actions.entries()) {
			errors.push(...validateOpaqueRef(action, `safe_next_actions[${index}]`).errors);
		}
	}

	// Consistency: entry_count=0 must not carry entry refs or content hash
	if (typeof record.entry_count === "number" && record.entry_count === 0) {
		if (record.oldest_entry_ref !== undefined) errors.push("oldest_entry_ref must be absent when entry_count is 0");
		if (record.newest_entry_ref !== undefined) errors.push("newest_entry_ref must be absent when entry_count is 0");
		if (record.content_hash_summary !== undefined) errors.push("content_hash_summary must be absent when entry_count is 0");
	}

	// Consistency: entry refs must appear together (both present or both absent)
	const hasOldest = record.oldest_entry_ref !== undefined;
	const hasNewest = record.newest_entry_ref !== undefined;
	if (hasOldest !== hasNewest) errors.push("oldest_entry_ref and newest_entry_ref must both be present or both absent");

	// Authority flags — all explicitly disabled, advisory_only and non_authorizing required
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
		|| record.hard_chat_authority_enabled !== false) {
		errors.push("local ledger snapshot must remain advisory-only non-authorizing with no dispatch, approval, provider, runtime, external-write, remote-write, fallback, lane-launch, write, or hard-chat authority");
	}

	errors.push(...validateNoForbiddenRawPayloads(record, "local_ledger_snapshot").errors);
	return errors.length === 0 ? valid() : invalid(...errors);
}

// ─── P7-S9: Score Reference Pack ────────────────────────────────────────────

/**
 * Advisory-only contract bundling a bounded set of prior advisory score refs,
 * snapshot refs, and gate decision refs for a given workflow/task signature.
 *
 * Useful for downstream reuse threshold checks and aggregation.  No I/O,
 * runtime authority, or dispatch authority.
 */
export interface FlowDeskScoreReferencePackV1 {
	schema_version: "flowdesk.score_reference_pack.v1";
	reference_pack_id: string;
	workflow_id: string;
	task_signature_ref: string;
	/** Opaque advisory score refs (max 20). */
	score_refs: string[];
	/** Opaque snapshot refs (max 10). */
	snapshot_refs: string[];
	/** Opaque gate decision refs (max 10). */
	gate_decision_refs: string[];
	captured_at: string;
	safe_next_actions: string[];
	advisory_only: true;
	non_authorizing: true;
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
}

export interface FlowDeskScoreReferencePackResultV1 {
	ok: boolean;
	errors: string[];
	pack?: FlowDeskScoreReferencePackV1;
}

/**
 * Create an advisory score reference pack.
 *
 * No I/O is performed.  The caller supplies all field values.
 *
 * Limits enforced:
 * - `score_refs`: 1..20 entries
 * - `snapshot_refs`: 0..10 entries
 * - `gate_decision_refs`: 0..10 entries
 * - `safe_next_actions`: 1..8 entries
 */
export function createFlowDeskScoreReferencePackV1(input: {
	referencePackId: string;
	workflowId: string;
	taskSignatureRef: string;
	scoreRefs: string[];
	snapshotRefs?: string[];
	gateDecisionRefs?: string[];
	capturedAt: string;
	safeNextActions: string[];
}): FlowDeskScoreReferencePackResultV1 {
	const errors: string[] = [];

	errors.push(...validateOpaqueId(input.referencePackId, "reference_pack_id").errors);
	errors.push(...validateOpaqueId(input.workflowId, "workflow_id").errors);
	errors.push(...validateOpaqueRef(input.taskSignatureRef, "task_signature_ref").errors);
	errors.push(...validateTimestamp(input.capturedAt, "captured_at").errors);

	// score_refs: 1..20
	if (!Array.isArray(input.scoreRefs) || input.scoreRefs.length === 0 || input.scoreRefs.length > 20) {
		errors.push("score_refs must be a non-empty bounded array (1..20 entries)");
	} else {
		for (const [index, ref] of input.scoreRefs.entries()) {
			errors.push(...validateOpaqueRef(ref, `score_refs[${index}]`).errors);
		}
	}

	// snapshot_refs: 0..10
	const snapshotRefs = input.snapshotRefs ?? [];
	if (!Array.isArray(snapshotRefs) || snapshotRefs.length > 10) {
		errors.push("snapshot_refs must be a bounded array (0..10 entries)");
	} else {
		for (const [index, ref] of snapshotRefs.entries()) {
			errors.push(...validateOpaqueRef(ref, `snapshot_refs[${index}]`).errors);
		}
	}

	// gate_decision_refs: 0..10
	const gateDecisionRefs = input.gateDecisionRefs ?? [];
	if (!Array.isArray(gateDecisionRefs) || gateDecisionRefs.length > 10) {
		errors.push("gate_decision_refs must be a bounded array (0..10 entries)");
	} else {
		for (const [index, ref] of gateDecisionRefs.entries()) {
			errors.push(...validateOpaqueRef(ref, `gate_decision_refs[${index}]`).errors);
		}
	}

	// safe_next_actions: 1..8
	if (!Array.isArray(input.safeNextActions) || input.safeNextActions.length === 0 || input.safeNextActions.length > 8) {
		errors.push("safe_next_actions must be a non-empty bounded array (1..8 entries)");
	} else {
		for (const [index, action] of input.safeNextActions.entries()) {
			errors.push(...validateOpaqueRef(action, `safe_next_actions[${index}]`).errors);
		}
	}

	if (errors.length > 0) return { ok: false, errors };

	const pack: FlowDeskScoreReferencePackV1 = {
		schema_version: "flowdesk.score_reference_pack.v1",
		reference_pack_id: input.referencePackId,
		workflow_id: input.workflowId,
		task_signature_ref: input.taskSignatureRef,
		score_refs: [...input.scoreRefs],
		snapshot_refs: [...snapshotRefs],
		gate_decision_refs: [...gateDecisionRefs],
		captured_at: input.capturedAt,
		safe_next_actions: [...input.safeNextActions],
		advisory_only: true,
		non_authorizing: true,
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
	};
	return { ok: true, errors: [], pack };
}

const scoreReferencePackAllowedProperties = [
	"schema_version",
	"reference_pack_id",
	"workflow_id",
	"task_signature_ref",
	"score_refs",
	"snapshot_refs",
	"gate_decision_refs",
	"captured_at",
	"safe_next_actions",
	"advisory_only",
	"non_authorizing",
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
] as const;

export function validateFlowDeskScoreReferencePackV1(value: unknown): ValidationResult {
	if (!isRecord(value)) return invalid("score reference pack must be an object");
	const record = value as Record<string, unknown>;
	const errors: string[] = [];

	// Closed schema: reject unknown properties
	errors.push(...rejectUnknownProperties(record, scoreReferencePackAllowedProperties, "score reference pack").errors);

	if (record.schema_version !== "flowdesk.score_reference_pack.v1") {
		errors.push("score reference pack schema_version is invalid");
	}

	errors.push(...validateOpaqueId(record.reference_pack_id, "reference_pack_id").errors);
	errors.push(...validateOpaqueId(record.workflow_id, "workflow_id").errors);
	errors.push(...validateOpaqueRef(record.task_signature_ref, "task_signature_ref").errors);
	errors.push(...validateTimestamp(record.captured_at, "captured_at").errors);

	// score_refs: 1..20
	if (!Array.isArray(record.score_refs) || record.score_refs.length === 0 || record.score_refs.length > 20) {
		errors.push("score_refs must be a non-empty bounded array (1..20 entries)");
	} else {
		for (const [index, ref] of record.score_refs.entries()) {
			errors.push(...validateOpaqueRef(ref, `score_refs[${index}]`).errors);
		}
	}

	// snapshot_refs: 0..10
	if (!Array.isArray(record.snapshot_refs) || record.snapshot_refs.length > 10) {
		errors.push("snapshot_refs must be a bounded array (0..10 entries)");
	} else {
		for (const [index, ref] of record.snapshot_refs.entries()) {
			errors.push(...validateOpaqueRef(ref, `snapshot_refs[${index}]`).errors);
		}
	}

	// gate_decision_refs: 0..10
	if (!Array.isArray(record.gate_decision_refs) || record.gate_decision_refs.length > 10) {
		errors.push("gate_decision_refs must be a bounded array (0..10 entries)");
	} else {
		for (const [index, ref] of record.gate_decision_refs.entries()) {
			errors.push(...validateOpaqueRef(ref, `gate_decision_refs[${index}]`).errors);
		}
	}

	// safe_next_actions: 1..8
	if (!Array.isArray(record.safe_next_actions) || record.safe_next_actions.length === 0 || record.safe_next_actions.length > 8) {
		errors.push("safe_next_actions must be a non-empty bounded array (1..8 entries)");
	} else {
		for (const [index, action] of record.safe_next_actions.entries()) {
			errors.push(...validateOpaqueRef(action, `safe_next_actions[${index}]`).errors);
		}
	}

	// Authority flags — all explicitly disabled, advisory_only and non_authorizing required
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
		|| record.hard_chat_authority_enabled !== false) {
		errors.push("score reference pack must remain advisory-only non-authorizing with no dispatch, approval, provider, runtime, external-write, remote-write, fallback, lane-launch, write, or hard-chat authority");
	}

	errors.push(...validateNoForbiddenRawPayloads(record, "score_reference_pack").errors);
	return errors.length === 0 ? valid() : invalid(...errors);
}

// ─── P7-S10: Workflow Signature Index Entry ──────────────────────────────────

/**
 * Advisory-only contract representing a single index entry that maps a
 * workflow/task signature to its associated reference pack ref,
 * category-fit snapshot ref, and last-scored timestamp.
 *
 * Enables lightweight advisory lookups without triggering actual I/O or
 * dispatch.  No authority flags are enabled.
 */
export interface FlowDeskWorkflowSignatureIndexEntryV1 {
	schema_version: "flowdesk.workflow_signature_index_entry.v1";
	/** Opaque index entry identifier. */
	entry_id: string;
	/** Workflow this entry belongs to. */
	workflow_id: string;
	/** Opaque ref identifying the task/workflow signature. */
	task_signature_ref: string;
	/** Opaque ref to the associated reference pack (optional). */
	reference_pack_ref?: string;
	/** Opaque ref to the associated category-fit snapshot (optional). */
	category_fit_snapshot_ref?: string;
	/** ISO 8601 timestamp at which the entry was last scored (optional). */
	last_scored_at?: string;
	/** ISO 8601 timestamp at which this index entry was created. */
	created_at: string;
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
}

export interface FlowDeskWorkflowSignatureIndexEntryResultV1 {
	ok: boolean;
	errors: string[];
	entry?: FlowDeskWorkflowSignatureIndexEntryV1;
}

/**
 * Create an advisory workflow signature index entry.
 *
 * No I/O is performed.  The caller supplies all field values.
 */
export function createFlowDeskWorkflowSignatureIndexEntryV1(input: {
	entryId: string;
	workflowId: string;
	taskSignatureRef: string;
	referencePackRef?: string;
	categoryFitSnapshotRef?: string;
	lastScoredAt?: string;
	createdAt: string;
	safeNextActions: string[];
}): FlowDeskWorkflowSignatureIndexEntryResultV1 {
	const errors: string[] = [];

	errors.push(...validateOpaqueId(input.entryId, "entry_id").errors);
	errors.push(...validateOpaqueId(input.workflowId, "workflow_id").errors);
	errors.push(...validateOpaqueRef(input.taskSignatureRef, "task_signature_ref").errors);
	errors.push(...validateTimestamp(input.createdAt, "created_at").errors);

	if (input.referencePackRef !== undefined) {
		errors.push(...validateOpaqueRef(input.referencePackRef, "reference_pack_ref").errors);
	}
	if (input.categoryFitSnapshotRef !== undefined) {
		errors.push(...validateOpaqueRef(input.categoryFitSnapshotRef, "category_fit_snapshot_ref").errors);
	}
	if (input.lastScoredAt !== undefined) {
		errors.push(...validateTimestamp(input.lastScoredAt, "last_scored_at").errors);
	}

	// Timestamp consistency: last_scored_at must not precede created_at
	if (input.lastScoredAt !== undefined && Number.isFinite(Date.parse(input.lastScoredAt)) && Number.isFinite(Date.parse(input.createdAt))) {
		if (Date.parse(input.lastScoredAt) < Date.parse(input.createdAt)) {
			errors.push("last_scored_at must not precede created_at");
		}
	}

	// safe_next_actions: 1..8
	if (!Array.isArray(input.safeNextActions) || input.safeNextActions.length === 0 || input.safeNextActions.length > 8) {
		errors.push("safe_next_actions must be a non-empty bounded array (1..8 entries)");
	} else {
		for (const [index, action] of input.safeNextActions.entries()) {
			errors.push(...validateOpaqueRef(action, `safe_next_actions[${index}]`).errors);
		}
	}

	if (errors.length > 0) return { ok: false, errors };

	const entry: FlowDeskWorkflowSignatureIndexEntryV1 = {
		schema_version: "flowdesk.workflow_signature_index_entry.v1",
		entry_id: input.entryId,
		workflow_id: input.workflowId,
		task_signature_ref: input.taskSignatureRef,
		...(input.referencePackRef === undefined ? {} : { reference_pack_ref: input.referencePackRef }),
		...(input.categoryFitSnapshotRef === undefined ? {} : { category_fit_snapshot_ref: input.categoryFitSnapshotRef }),
		...(input.lastScoredAt === undefined ? {} : { last_scored_at: input.lastScoredAt }),
		created_at: input.createdAt,
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
	};
	return { ok: true, errors: [], entry };
}

const workflowSignatureIndexEntryAllowedProperties = [
	"schema_version",
	"entry_id",
	"workflow_id",
	"task_signature_ref",
	"reference_pack_ref",
	"category_fit_snapshot_ref",
	"last_scored_at",
	"created_at",
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
] as const;

// ─── P7-S11: OI Session Summary ──────────────────────────────────────────────

/**
 * Advisory health label for the overall operational intelligence session.
 *
 * - `healthy`:  All advisory subsystems reported without error; scores,
 *   reuse gates, and fanout gates evaluated normally.
 * - `degraded`: One or more subsystems reported partial or degraded output;
 *   consumers should treat scores as lower-confidence.
 * - `stale`:    Captured counters are out-of-date relative to actual activity;
 *   no fresh evaluation occurred within the expected window.
 * - `unknown`:  Insufficient information to classify the session health.
 */
export type FlowDeskOIAdvisoryHealthLabelV1 = "healthy" | "degraded" | "stale" | "unknown";

/**
 * Pure advisory summary of operational intelligence activity for a single session.
 *
 * Captures bounded counters (proposals scored, reuse gates checked, fanout gates
 * evaluated, ledger entries total) and an overall advisory health label — without
 * performing actual I/O, runtime access, or dispatch.
 *
 * All authority flags are disabled.  This contract is advisory-only, non-authorizing,
 * and never grants dispatch, provider, runtime, lane-launch, fallback, write,
 * remote-write, or hard-chat authority.
 */
export interface FlowDeskOISessionSummaryV1 {
	schema_version: "flowdesk.oi_session_summary.v1";
	/** Opaque identifier for this summary record. */
	summary_id: string;
	/** Opaque ref for the session this summary covers. */
	session_ref: string;
	/** Workflow this summary is associated with. */
	workflow_id: string;
	/** Number of proposals that were scored during this session. Must be >= 0. */
	proposals_scored: number;
	/** Number of reuse gate evaluations performed during this session. Must be >= 0. */
	reuse_gates_checked: number;
	/** Number of fanout gate evaluations performed during this session. Must be >= 0. */
	fanout_gates_evaluated: number;
	/** Total number of advisory score ledger entries at capture time. Must be >= 0. */
	ledger_entries_total: number;
	/** Overall advisory health classification for this session. */
	advisory_health_label: FlowDeskOIAdvisoryHealthLabelV1;
	/** ISO 8601 timestamp at which this summary was captured. */
	captured_at: string;
	/** Advisory safe next actions for consumers of this summary. */
	safe_next_actions: string[];
	advisory_only: true;
	non_authorizing: true;
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
}

export interface FlowDeskOISessionSummaryResultV1 {
	ok: boolean;
	errors: string[];
	summary?: FlowDeskOISessionSummaryV1;
}

/**
 * Create a pure advisory OI session summary.
 *
 * No I/O, runtime access, or dispatch is performed.  The caller supplies all
 * field values derived from whatever in-memory session-scoped OI state is available.
 */
export function createFlowDeskOISessionSummaryV1(input: {
	summaryId: string;
	sessionRef: string;
	workflowId: string;
	proposalsScored: number;
	reuseGatesChecked: number;
	fanoutGatesEvaluated: number;
	ledgerEntriesTotal: number;
	advisoryHealthLabel: FlowDeskOIAdvisoryHealthLabelV1;
	capturedAt: string;
	safeNextActions: string[];
}): FlowDeskOISessionSummaryResultV1 {
	const errors: string[] = [];

	errors.push(...validateOpaqueId(input.summaryId, "summary_id").errors);
	errors.push(...validateOpaqueRef(input.sessionRef, "session_ref").errors);
	errors.push(...validateOpaqueId(input.workflowId, "workflow_id").errors);
	errors.push(...validateTimestamp(input.capturedAt, "captured_at").errors);

	if (typeof input.proposalsScored !== "number" || !Number.isInteger(input.proposalsScored) || input.proposalsScored < 0) {
		errors.push("proposals_scored must be a non-negative integer");
	}
	if (typeof input.reuseGatesChecked !== "number" || !Number.isInteger(input.reuseGatesChecked) || input.reuseGatesChecked < 0) {
		errors.push("reuse_gates_checked must be a non-negative integer");
	}
	if (typeof input.fanoutGatesEvaluated !== "number" || !Number.isInteger(input.fanoutGatesEvaluated) || input.fanoutGatesEvaluated < 0) {
		errors.push("fanout_gates_evaluated must be a non-negative integer");
	}
	if (typeof input.ledgerEntriesTotal !== "number" || !Number.isInteger(input.ledgerEntriesTotal) || input.ledgerEntriesTotal < 0) {
		errors.push("ledger_entries_total must be a non-negative integer");
	}

	const oiHealthLabels: readonly string[] = ["healthy", "degraded", "stale", "unknown"];
	if (typeof input.advisoryHealthLabel !== "string" || !oiHealthLabels.includes(input.advisoryHealthLabel)) {
		errors.push("advisory_health_label must be 'healthy', 'degraded', 'stale', or 'unknown'");
	}

	if (!Array.isArray(input.safeNextActions) || input.safeNextActions.length === 0 || input.safeNextActions.length > 8) {
		errors.push("safe_next_actions must be a non-empty bounded array (1..8 entries)");
	} else {
		for (const [index, action] of input.safeNextActions.entries()) {
			errors.push(...validateOpaqueRef(action, `safe_next_actions[${index}]`).errors);
		}
	}

	if (errors.length > 0) return { ok: false, errors };

	const summary: FlowDeskOISessionSummaryV1 = {
		schema_version: "flowdesk.oi_session_summary.v1",
		summary_id: input.summaryId,
		session_ref: input.sessionRef,
		workflow_id: input.workflowId,
		proposals_scored: input.proposalsScored,
		reuse_gates_checked: input.reuseGatesChecked,
		fanout_gates_evaluated: input.fanoutGatesEvaluated,
		ledger_entries_total: input.ledgerEntriesTotal,
		advisory_health_label: input.advisoryHealthLabel,
		captured_at: input.capturedAt,
		safe_next_actions: [...input.safeNextActions],
		advisory_only: true,
		non_authorizing: true,
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
	};
	return { ok: true, errors: [], summary };
}

const oiSessionSummaryAllowedProperties = [
	"schema_version",
	"summary_id",
	"session_ref",
	"workflow_id",
	"proposals_scored",
	"reuse_gates_checked",
	"fanout_gates_evaluated",
	"ledger_entries_total",
	"advisory_health_label",
	"captured_at",
	"safe_next_actions",
	"advisory_only",
	"non_authorizing",
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
] as const;

const oiHealthLabels: readonly string[] = ["healthy", "degraded", "stale", "unknown"];

export function validateFlowDeskOISessionSummaryV1(value: unknown): ValidationResult {
	if (!isRecord(value)) return invalid("OI session summary must be an object");
	const record = value as Record<string, unknown>;
	const errors: string[] = [];

	// Closed schema: reject unknown properties
	errors.push(...rejectUnknownProperties(record, oiSessionSummaryAllowedProperties, "OI session summary").errors);

	if (record.schema_version !== "flowdesk.oi_session_summary.v1") {
		errors.push("OI session summary schema_version is invalid");
	}

	errors.push(...validateOpaqueId(record.summary_id, "summary_id").errors);
	errors.push(...validateOpaqueRef(record.session_ref, "session_ref").errors);
	errors.push(...validateOpaqueId(record.workflow_id, "workflow_id").errors);
	errors.push(...validateTimestamp(record.captured_at, "captured_at").errors);

	// Count fields: non-negative integers
	if (typeof record.proposals_scored !== "number" || !Number.isInteger(record.proposals_scored) || record.proposals_scored < 0) {
		errors.push("proposals_scored must be a non-negative integer");
	}
	if (typeof record.reuse_gates_checked !== "number" || !Number.isInteger(record.reuse_gates_checked) || record.reuse_gates_checked < 0) {
		errors.push("reuse_gates_checked must be a non-negative integer");
	}
	if (typeof record.fanout_gates_evaluated !== "number" || !Number.isInteger(record.fanout_gates_evaluated) || record.fanout_gates_evaluated < 0) {
		errors.push("fanout_gates_evaluated must be a non-negative integer");
	}
	if (typeof record.ledger_entries_total !== "number" || !Number.isInteger(record.ledger_entries_total) || record.ledger_entries_total < 0) {
		errors.push("ledger_entries_total must be a non-negative integer");
	}

	// advisory_health_label
	if (typeof record.advisory_health_label !== "string" || !oiHealthLabels.includes(record.advisory_health_label)) {
		errors.push("advisory_health_label must be 'healthy', 'degraded', 'stale', or 'unknown'");
	}

	// safe_next_actions: 1..8
	if (!Array.isArray(record.safe_next_actions) || record.safe_next_actions.length === 0 || record.safe_next_actions.length > 8) {
		errors.push("safe_next_actions must be a non-empty bounded array (1..8 entries)");
	} else {
		for (const [index, action] of record.safe_next_actions.entries()) {
			errors.push(...validateOpaqueRef(action, `safe_next_actions[${index}]`).errors);
		}
	}

	// Authority flags — all explicitly disabled, advisory_only and non_authorizing required
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
		|| record.hard_chat_authority_enabled !== false) {
		errors.push("OI session summary must remain advisory-only non-authorizing with no dispatch, approval, provider, runtime, external-write, remote-write, fallback, lane-launch, write, or hard-chat authority");
	}

	errors.push(...validateNoForbiddenRawPayloads(record, "oi_session_summary").errors);
	return errors.length === 0 ? valid() : invalid(...errors);
}

// ─── P7-S12: Specialist Workflow Eligibility Gate ───────────────────────────

/**
 * Eligibility decision for routing a workflow/task to a specialist workflow lane.
 *
 * - `eligible`:   The task signature matches a known specialist category at
 *   sufficient confidence; consumers MAY route to a specialist lane.
 * - `ineligible`: The task signature does not meet the criteria for any
 *   specialist workflow category.
 * - `deferred`:   Evaluation cannot yet reach a confident decision; consumers
 *   SHOULD retry after additional context is available.
 * - `blocked`:    A hard constraint prevents evaluation (e.g., missing required
 *   inputs, policy violation, unknown category). At least one `blocking_label`
 *   must be present.  Consumers MUST NOT route to a specialist lane.
 */
export type FlowDeskSpecialistWorkflowEligibilityDecisionV1 = "eligible" | "ineligible" | "deferred" | "blocked";

/**
 * Known specialist workflow category labels.
 *
 * - `security`:   Security audits, threat model analysis, vulnerability research.
 * - `legal`:      Legal document review, compliance interpretation, IP analysis.
 * - `medical`:    Clinical decision support, medical literature review.
 * - `compliance`: Regulatory compliance checking, policy adherence verification.
 * - `unknown`:    Category could not be classified from available signatures.
 */
export type FlowDeskSpecialistCategoryV1 = "security" | "legal" | "medical" | "compliance" | "unknown";

/**
 * Pure advisory eligibility gate encoding whether a given workflow/task
 * signature qualifies for routing to a specialist workflow lane.
 *
 * This contract is advisory-only and non-authorizing: it records the eligibility
 * decision but does NOT perform routing, dispatch, or provider selection.
 *
 * All authority flags are disabled.  This contract never grants dispatch, provider,
 * runtime, lane-launch, fallback, write, remote-write, or hard-chat authority.
 */
export interface FlowDeskSpecialistWorkflowEligibilityV1 {
	schema_version: "flowdesk.specialist_workflow_eligibility.v1";
	/** Opaque identifier for this eligibility record. */
	eligibility_id: string;
	/** Workflow this eligibility decision is associated with. */
	workflow_id: string;
	/** Opaque ref identifying the task/workflow signature being evaluated. */
	task_signature_ref: string;
	/** The eligibility decision. */
	eligibility_decision: FlowDeskSpecialistWorkflowEligibilityDecisionV1;
	/** Specialist workflow category that was matched or evaluated. */
	specialist_category: FlowDeskSpecialistCategoryV1;
	/**
	 * Advisory confidence score for the eligibility decision (0..100 integer).
	 * Higher values indicate higher confidence that the decision is correct.
	 */
	confidence_score: number;
	/** Opaque reason refs (max 10) providing rationale for the decision. */
	reason_refs: string[];
	/**
	 * Schema-safe blocking labels (max 10) explaining why the decision is
	 * `blocked`.  Must be non-empty when `eligibility_decision` is `blocked`.
	 */
	blocking_labels: string[];
	/** ISO 8601 timestamp at which this eligibility was evaluated. */
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

/**
 * Create a pure advisory specialist workflow eligibility record.
 *
 * No routing, dispatch, or provider selection is performed.  The caller supplies
 * all field values.
 *
 * Consistency rules enforced:
 * - `confidence_score` must be an integer 0..100.
 * - `reason_refs` must be an array of 0..10 opaque refs.
 * - `blocking_labels` must be present and non-empty when `eligibility_decision` is `blocked`.
 * - `safe_next_actions` must have 1..8 entries.
 * - `eligibility_decision` must be a valid decision label.
 * - `specialist_category` must be a valid category label.
 */
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

	// eligibility_decision
	if (typeof input.eligibilityDecision !== "string" || !specialistEligibilityDecisions.includes(input.eligibilityDecision)) {
		errors.push("eligibility_decision must be 'eligible', 'ineligible', 'deferred', or 'blocked'");
	}

	// specialist_category
	if (typeof input.specialistCategory !== "string" || !specialistCategories.includes(input.specialistCategory)) {
		errors.push("specialist_category must be 'security', 'legal', 'medical', 'compliance', or 'unknown'");
	}

	// confidence_score: integer 0..100
	if (typeof input.confidenceScore !== "number" || !Number.isInteger(input.confidenceScore) || input.confidenceScore < 0 || input.confidenceScore > 100) {
		errors.push("confidence_score must be an integer 0..100");
	}

	// reason_refs: 0..10
	const reasonRefs = input.reasonRefs ?? [];
	if (!Array.isArray(reasonRefs) || reasonRefs.length > 10) {
		errors.push("reason_refs must be a bounded array (0..10 entries)");
	} else {
		for (const [index, ref] of reasonRefs.entries()) {
			errors.push(...validateOpaqueRef(ref, `reason_refs[${index}]`).errors);
		}
	}

	// blocking_labels: 0..10; required non-empty when decision is blocked
	const blockingLabels = input.blockingLabels ?? [];
	if (!Array.isArray(blockingLabels) || blockingLabels.length > 10) {
		errors.push("blocking_labels must be a bounded array (0..10 entries)");
	} else {
		for (const [index, label] of blockingLabels.entries()) {
			errors.push(...validateOpaqueRef(label, `blocking_labels[${index}]`).errors);
		}
	}

	// Consistency: blocked decision must have at least one blocking_label
	if (input.eligibilityDecision === "blocked" && Array.isArray(blockingLabels) && blockingLabels.length === 0) {
		errors.push("blocking_labels must be non-empty when eligibility_decision is 'blocked'");
	}

	// safe_next_actions: 1..8
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

export function validateFlowDeskSpecialistWorkflowEligibilityV1(value: unknown): ValidationResult {
	if (!isRecord(value)) return invalid("specialist workflow eligibility must be an object");
	const record = value as Record<string, unknown>;
	const errors: string[] = [];

	// Closed schema: reject unknown properties
	errors.push(...rejectUnknownProperties(record, specialistWorkflowEligibilityAllowedProperties, "specialist workflow eligibility").errors);

	if (record.schema_version !== "flowdesk.specialist_workflow_eligibility.v1") {
		errors.push("specialist workflow eligibility schema_version is invalid");
	}

	errors.push(...validateOpaqueId(record.eligibility_id, "eligibility_id").errors);
	errors.push(...validateOpaqueId(record.workflow_id, "workflow_id").errors);
	errors.push(...validateOpaqueRef(record.task_signature_ref, "task_signature_ref").errors);
	errors.push(...validateTimestamp(record.evaluated_at, "evaluated_at").errors);

	// eligibility_decision
	if (typeof record.eligibility_decision !== "string" || !specialistEligibilityDecisions.includes(record.eligibility_decision)) {
		errors.push("eligibility_decision must be 'eligible', 'ineligible', 'deferred', or 'blocked'");
	}

	// specialist_category
	if (typeof record.specialist_category !== "string" || !specialistCategories.includes(record.specialist_category)) {
		errors.push("specialist_category must be 'security', 'legal', 'medical', 'compliance', or 'unknown'");
	}

	// confidence_score: integer 0..100
	if (typeof record.confidence_score !== "number" || !Number.isInteger(record.confidence_score) || record.confidence_score < 0 || record.confidence_score > 100) {
		errors.push("confidence_score must be an integer 0..100");
	}

	// reason_refs: 0..10
	if (!Array.isArray(record.reason_refs) || (record.reason_refs as unknown[]).length > 10) {
		errors.push("reason_refs must be a bounded array (0..10 entries)");
	} else {
		for (const [index, ref] of (record.reason_refs as unknown[]).entries()) {
			errors.push(...validateOpaqueRef(ref, `reason_refs[${index}]`).errors);
		}
	}

	// blocking_labels: 0..10
	if (!Array.isArray(record.blocking_labels) || (record.blocking_labels as unknown[]).length > 10) {
		errors.push("blocking_labels must be a bounded array (0..10 entries)");
	} else {
		for (const [index, label] of (record.blocking_labels as unknown[]).entries()) {
			errors.push(...validateOpaqueRef(label, `blocking_labels[${index}]`).errors);
		}
	}

	// Consistency: blocked decision must have at least one blocking_label
	if (record.eligibility_decision === "blocked" && Array.isArray(record.blocking_labels) && record.blocking_labels.length === 0) {
		errors.push("blocking_labels must be non-empty when eligibility_decision is 'blocked'");
	}

	// safe_next_actions: 1..8
	if (!Array.isArray(record.safe_next_actions) || record.safe_next_actions.length === 0 || record.safe_next_actions.length > 8) {
		errors.push("safe_next_actions must be a non-empty bounded array (1..8 entries)");
	} else {
		for (const [index, action] of (record.safe_next_actions as unknown[]).entries()) {
			errors.push(...validateOpaqueRef(action, `safe_next_actions[${index}]`).errors);
		}
	}

	// Authority flags — all explicitly disabled, advisory_only and non_authorizing required
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

export function validateFlowDeskWorkflowSignatureIndexEntryV1(value: unknown): ValidationResult {
	if (!isRecord(value)) return invalid("workflow signature index entry must be an object");
	const record = value as Record<string, unknown>;
	const errors: string[] = [];

	// Closed schema: reject unknown properties
	errors.push(...rejectUnknownProperties(record, workflowSignatureIndexEntryAllowedProperties, "workflow signature index entry").errors);

	if (record.schema_version !== "flowdesk.workflow_signature_index_entry.v1") {
		errors.push("workflow signature index entry schema_version is invalid");
	}

	errors.push(...validateOpaqueId(record.entry_id, "entry_id").errors);
	errors.push(...validateOpaqueId(record.workflow_id, "workflow_id").errors);
	errors.push(...validateOpaqueRef(record.task_signature_ref, "task_signature_ref").errors);
	errors.push(...validateTimestamp(record.created_at, "created_at").errors);

	if (record.reference_pack_ref !== undefined) {
		errors.push(...validateOpaqueRef(record.reference_pack_ref, "reference_pack_ref").errors);
	}
	if (record.category_fit_snapshot_ref !== undefined) {
		errors.push(...validateOpaqueRef(record.category_fit_snapshot_ref, "category_fit_snapshot_ref").errors);
	}
	if (record.last_scored_at !== undefined) {
		errors.push(...validateTimestamp(record.last_scored_at, "last_scored_at").errors);
	}

	// Timestamp consistency: last_scored_at must not precede created_at
	if (
		record.last_scored_at !== undefined
		&& typeof record.last_scored_at === "string"
		&& typeof record.created_at === "string"
		&& Number.isFinite(Date.parse(record.last_scored_at))
		&& Number.isFinite(Date.parse(record.created_at as string))
	) {
		if (Date.parse(record.last_scored_at) < Date.parse(record.created_at as string)) {
			errors.push("last_scored_at must not precede created_at");
		}
	}

	// safe_next_actions: 1..8
	if (!Array.isArray(record.safe_next_actions) || record.safe_next_actions.length === 0 || record.safe_next_actions.length > 8) {
		errors.push("safe_next_actions must be a non-empty bounded array (1..8 entries)");
	} else {
		for (const [index, action] of record.safe_next_actions.entries()) {
			errors.push(...validateOpaqueRef(action, `safe_next_actions[${index}]`).errors);
		}
	}

	// Authority flags — all explicitly disabled, advisory_only and non_authorizing required
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
		|| record.hard_chat_authority_enabled !== false) {
		errors.push("workflow signature index entry must remain advisory-only non-authorizing with no dispatch, approval, provider, runtime, external-write, remote-write, fallback, lane-launch, write, or hard-chat authority");
	}

	errors.push(...validateNoForbiddenRawPayloads(record, "workflow_signature_index_entry").errors);
	return errors.length === 0 ? valid() : invalid(...errors);
}
