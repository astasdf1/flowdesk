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
	external_write_authority_enabled: false;
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
		external_write_authority_enabled: false,
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
		"external_write_authority_enabled",
	], "operational intelligence score").errors);
	errors.push(...validateOpaqueId(record.score_id, "score_id").errors);
	errors.push(...validateOpaqueId(record.workflow_id, "workflow_id").errors);
	errors.push(...validateOpaqueRef(record.candidate_ref, "candidate_ref").errors);
	errors.push(...validateOpaqueRef(record.score_reason_ref, "score_reason_ref").errors);
	if (record.schema_version !== "flowdesk.operational_intelligence_score.v1") errors.push("score schema_version is invalid");
	if (record.hard_filter_state !== "passed" && record.hard_filter_state !== "blocked") errors.push("hard_filter_state is invalid");
	if (!Array.isArray(record.blocked_labels)) errors.push("blocked_labels must be an array");
	else for (const [index, label] of record.blocked_labels.entries())
		errors.push(...validateOpaqueRef(label, `blocked_labels[${index}]`).errors);
	if (typeof record.advisory_score !== "number" || record.advisory_score < 0 || record.advisory_score > 100) errors.push("advisory_score must be 0..100");
	if (record.hard_filter_state === "blocked" && record.advisory_score !== 0) errors.push("blocked hard filters must zero advisory_score");
	if (record.advisory_only !== true || record.dispatch_authority_enabled !== false || record.approval_authority_enabled !== false || record.external_write_authority_enabled !== false) errors.push("operational intelligence must remain advisory-only");
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
	if (record.schema_version !== "flowdesk.reference_pack.v1") errors.push("reference pack schema_version is invalid");
	if (record.specialist_signoff !== false || record.professional_advice !== false || record.advisory_only !== true || record.external_write_authority_enabled !== false) errors.push("reference pack cannot act as signoff or external write authority");
	errors.push(...validateNoForbiddenRawPayloads(record, "reference_pack").errors);
	return errors.length === 0 ? valid() : invalid(...errors);
}
