/**
 * Operational intelligence score and reference pack contracts.
 * P7-S13.5 submodule: score-oi
 */
import {
	type ValidationResult,
	valid,
	invalid,
	validateNoForbiddenRawPayloads,
	validateOpaqueId,
	validateOpaqueRef,
	isRecord,
	refs,
	rejectUnknownProperties,
	validateAdvisoryAuthorityFlags,
	validateHardFilterFields,
} from "./shared.js";

// ─── Interfaces ───────────────────────────────────────────────────────────────

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

// ─── Creators ─────────────────────────────────────────────────────────────────

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

// ─── Validators ───────────────────────────────────────────────────────────────

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
