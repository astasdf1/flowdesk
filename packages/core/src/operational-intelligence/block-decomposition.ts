/**
 * Block decomposition contracts.
 * Operational intelligence later gate – advisory-only, non-authorizing.
 */
import {
	type ValidationResult,
	valid,
	invalid,
	validateNoForbiddenRawPayloads,
	validateOpaqueId,
	validateOpaqueRef,
	validateBoundedLabel,
	isRecord,
	rejectUnknownProperties,
} from "./shared.js";

// ─── Sub-block estimate ────────────────────────────────────────────────────────

export interface FlowDeskSubBlockEstimateV1 {
	sub_block_id: string;
	sub_block_label: string;
	estimated_scope: number;       // 1-10
	estimated_complexity: number;  // 1-10
	estimated_coupling: number;    // 1-10
	estimated_authority_sensitivity: number; // 1-10
	estimated_novelty: number;     // 1-10
	estimated_category: string;
	estimated_block_score: number;
}

// ─── CONTRACT: FlowDeskBlockDecompositionV1 ───────────────────────────────────

export interface FlowDeskBlockDecompositionV1 {
	schema_version: "flowdesk.block_decomposition.v1";
	decomposition_id: string;
	parent_block_id: string;
	parent_block_scoring_ref: string;
	trigger_score: number;         // 14-60
	trigger_condition_met: "score_gte_50" | "score_gte_40_with_dimension";
	trigger_dimensions_met: string[];
	sub_blocks: FlowDeskSubBlockEstimateV1[];
	current_depth: number;         // 0-2
	max_depth: number;             // 1-2
	coverage_review_quorum_required: 1 | 2 | 3;
	coverage_verdict_refs: string[];
	structural_coverage_pass: boolean;
	status: "draft" | "coverage_pending" | "structural_coverage_passed" | "rejected";
	decomposition_model_selection_ref: string;
	non_inheriting_parent_authority: true;
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
	model_selection_authority_enabled: false;
	ranking_authority_enabled: false;
}

const DECOMPOSITION_ALLOWED = [
	"schema_version", "decomposition_id", "parent_block_id", "parent_block_scoring_ref",
	"trigger_score", "trigger_condition_met", "trigger_dimensions_met", "sub_blocks",
	"current_depth", "max_depth", "coverage_review_quorum_required",
	"coverage_verdict_refs", "structural_coverage_pass", "status",
	"decomposition_model_selection_ref", "non_inheriting_parent_authority",
	"advisory_only", "non_authorizing", "release_gate",
	"dispatch_authority_enabled", "approval_authority_enabled",
	"provider_authority_enabled", "runtime_authority_enabled",
	"external_write_authority_enabled", "remote_write_authority_enabled",
	"fallback_authority_enabled", "lane_launch_authority_enabled",
	"write_authority_enabled", "hard_chat_authority_enabled",
	"model_selection_authority_enabled", "ranking_authority_enabled",
] as const;

const SUB_BLOCK_ALLOWED = [
	"sub_block_id", "sub_block_label",
	"estimated_scope", "estimated_complexity", "estimated_coupling",
	"estimated_authority_sensitivity", "estimated_novelty",
	"estimated_category", "estimated_block_score",
] as const;

function validateSubBlock(value: unknown, label: string): ValidationResult {
	if (!isRecord(value)) return invalid(`${label} must be an object`);
	const record = value as Record<string, unknown>;
	const errors: string[] = [];
	errors.push(...rejectUnknownProperties(record, SUB_BLOCK_ALLOWED, label).errors);
	errors.push(...validateOpaqueId(record.sub_block_id, `${label}.sub_block_id`).errors);
	errors.push(...validateBoundedLabel(record.sub_block_label, `${label}.sub_block_label`).errors);
	for (const dim of ["estimated_scope", "estimated_complexity", "estimated_coupling", "estimated_authority_sensitivity", "estimated_novelty"] as const) {
		if (typeof record[dim] !== "number" || !Number.isInteger(record[dim]) || (record[dim] as number) < 1 || (record[dim] as number) > 10)
			errors.push(`${label}.${dim} must be an integer 1-10`);
	}
	if (typeof record.estimated_category !== "string" || record.estimated_category.length === 0)
		errors.push(`${label}.estimated_category must be a non-empty string`);
	if (typeof record.estimated_block_score !== "number" || !Number.isFinite(record.estimated_block_score))
		errors.push(`${label}.estimated_block_score must be a finite number`);
	return errors.length === 0 ? valid() : invalid(...errors);
}

export function validateFlowDeskBlockDecompositionV1(value: unknown): ValidationResult {
	if (!isRecord(value)) return invalid("block decomposition must be an object");
	const record = value as Record<string, unknown>;
	const errors: string[] = [];

	errors.push(...rejectUnknownProperties(record, DECOMPOSITION_ALLOWED, "block decomposition").errors);
	if (record.schema_version !== "flowdesk.block_decomposition.v1")
		errors.push("block decomposition schema_version must be flowdesk.block_decomposition.v1");
	errors.push(...validateOpaqueId(record.decomposition_id, "decomposition_id").errors);
	errors.push(...validateOpaqueId(record.parent_block_id, "parent_block_id").errors);
	errors.push(...validateOpaqueRef(record.parent_block_scoring_ref, "parent_block_scoring_ref").errors);

	const triggerScore = record.trigger_score;
	if (typeof triggerScore !== "number" || !Number.isInteger(triggerScore) || triggerScore < 14 || triggerScore > 60)
		errors.push("trigger_score must be an integer 14-60");

	if (record.trigger_condition_met !== "score_gte_50" && record.trigger_condition_met !== "score_gte_40_with_dimension")
		errors.push("trigger_condition_met must be 'score_gte_50' or 'score_gte_40_with_dimension'");

	if (!Array.isArray(record.trigger_dimensions_met))
		errors.push("trigger_dimensions_met must be an array");

	// sub_blocks: 2..6
	if (!Array.isArray(record.sub_blocks) || record.sub_blocks.length < 2 || record.sub_blocks.length > 6)
		errors.push("sub_blocks must be an array of 2..6 items");
	else {
		for (const [i, sb] of record.sub_blocks.entries())
			errors.push(...validateSubBlock(sb, `sub_blocks[${i}]`).errors);
	}

	const currentDepth = record.current_depth;
	const maxDepth = record.max_depth;
	if (typeof currentDepth !== "number" || !Number.isInteger(currentDepth) || currentDepth < 0 || currentDepth > 2)
		errors.push("current_depth must be an integer 0-2");
	if (typeof maxDepth !== "number" || !Number.isInteger(maxDepth) || maxDepth < 1 || maxDepth > 2)
		errors.push("max_depth must be an integer 1-2");

	// REJECT current_depth >= max_depth
	if (typeof currentDepth === "number" && typeof maxDepth === "number" && Number.isInteger(currentDepth) && Number.isInteger(maxDepth)) {
		if (currentDepth >= maxDepth)
			errors.push("current_depth must be less than max_depth (cannot decompose at or beyond depth cap)");
	}

	const quorum = record.coverage_review_quorum_required;
	if (quorum !== 1 && quorum !== 2 && quorum !== 3)
		errors.push("coverage_review_quorum_required must be 1, 2, or 3");

	if (!Array.isArray(record.coverage_verdict_refs))
		errors.push("coverage_verdict_refs must be an array");
	else {
		for (const [i, ref] of (record.coverage_verdict_refs as unknown[]).entries())
			errors.push(...validateOpaqueRef(ref, `coverage_verdict_refs[${i}]`).errors);
	}

	const structuralPass = record.structural_coverage_pass;
	if (typeof structuralPass !== "boolean")
		errors.push("structural_coverage_pass must be a boolean");

	// REJECT structural_coverage_pass=true if verdict_refs.length < quorum_required
	if (structuralPass === true && Array.isArray(record.coverage_verdict_refs) && typeof quorum === "number") {
		if ((record.coverage_verdict_refs as unknown[]).length < quorum)
			errors.push("structural_coverage_pass cannot be true with fewer verdict_refs than quorum_required");
	}

	const validStatuses = ["draft", "coverage_pending", "structural_coverage_passed", "rejected"] as const;
	if (typeof record.status !== "string" || !validStatuses.includes(record.status as typeof validStatuses[number]))
		errors.push("status must be one of: draft, coverage_pending, structural_coverage_passed, rejected");

	// REJECT structural_coverage_pass=true if status !== "structural_coverage_passed"
	if (structuralPass === true && record.status !== "structural_coverage_passed")
		errors.push("structural_coverage_pass=true requires status='structural_coverage_passed'");

	errors.push(...validateOpaqueRef(record.decomposition_model_selection_ref, "decomposition_model_selection_ref").errors);

	if (record.non_inheriting_parent_authority !== true)
		errors.push("non_inheriting_parent_authority must be true (literal)");

	// Authority flags
	if (record.advisory_only !== true) errors.push("advisory_only must be true");
	if (record.non_authorizing !== true) errors.push("non_authorizing must be true");
	if (record.release_gate !== "operational_intelligence_later_gate") errors.push("release_gate must be operational_intelligence_later_gate");
	if (record.dispatch_authority_enabled !== false) errors.push("dispatch_authority_enabled must be false");
	if (record.approval_authority_enabled !== false) errors.push("approval_authority_enabled must be false");
	if (record.provider_authority_enabled !== false) errors.push("provider_authority_enabled must be false");
	if (record.runtime_authority_enabled !== false) errors.push("runtime_authority_enabled must be false");
	if (record.external_write_authority_enabled !== false) errors.push("external_write_authority_enabled must be false");
	if (record.remote_write_authority_enabled !== false) errors.push("remote_write_authority_enabled must be false");
	if (record.fallback_authority_enabled !== false) errors.push("fallback_authority_enabled must be false");
	if (record.lane_launch_authority_enabled !== false) errors.push("lane_launch_authority_enabled must be false");
	if (record.write_authority_enabled !== false) errors.push("write_authority_enabled must be false");
	if (record.hard_chat_authority_enabled !== false) errors.push("hard_chat_authority_enabled must be false");
	if (record.model_selection_authority_enabled !== false) errors.push("model_selection_authority_enabled must be false");
	if (record.ranking_authority_enabled !== false) errors.push("ranking_authority_enabled must be false");

	errors.push(...validateNoForbiddenRawPayloads(record, "block decomposition").errors);

	return errors.length === 0 ? valid() : invalid(...errors);
}

export type FlowDeskBlockDecompositionV1Result = {
	ok: true;
	errors: [];
	decomposition: FlowDeskBlockDecompositionV1;
} | {
	ok: false;
	errors: string[];
	decomposition: undefined;
};

export function createFlowDeskBlockDecompositionV1(input: {
	decompositionId: string;
	parentBlockId: string;
	parentBlockScoringRef: string;
	triggerScore: number;
	triggerConditionMet: "score_gte_50" | "score_gte_40_with_dimension";
	triggerDimensionsMet: string[];
	subBlocks: FlowDeskSubBlockEstimateV1[];
	currentDepth: number;
	maxDepth: number;
	coverageReviewQuorumRequired: 1 | 2 | 3;
	coverageVerdictRefs: string[];
	structuralCoveragePass: boolean;
	status: "draft" | "coverage_pending" | "structural_coverage_passed" | "rejected";
	decompositionModelSelectionRef: string;
}): FlowDeskBlockDecompositionV1Result {
	const errors: string[] = [];

	if (input.subBlocks.length < 2 || input.subBlocks.length > 6)
		errors.push("sub_blocks must have 2..6 items");
	if (input.currentDepth >= input.maxDepth)
		errors.push("current_depth must be less than max_depth");
	if (input.structuralCoveragePass && input.coverageVerdictRefs.length < input.coverageReviewQuorumRequired)
		errors.push("structural_coverage_pass cannot be true with fewer verdict_refs than quorum_required");
	if (input.structuralCoveragePass && input.status !== "structural_coverage_passed")
		errors.push("structural_coverage_pass=true requires status='structural_coverage_passed'");

	if (errors.length > 0) return { ok: false, errors, decomposition: undefined };

	const decomposition: FlowDeskBlockDecompositionV1 = {
		schema_version: "flowdesk.block_decomposition.v1",
		decomposition_id: input.decompositionId,
		parent_block_id: input.parentBlockId,
		parent_block_scoring_ref: input.parentBlockScoringRef,
		trigger_score: input.triggerScore,
		trigger_condition_met: input.triggerConditionMet,
		trigger_dimensions_met: input.triggerDimensionsMet,
		sub_blocks: input.subBlocks,
		current_depth: input.currentDepth,
		max_depth: input.maxDepth,
		coverage_review_quorum_required: input.coverageReviewQuorumRequired,
		coverage_verdict_refs: input.coverageVerdictRefs,
		structural_coverage_pass: input.structuralCoveragePass,
		status: input.status,
		decomposition_model_selection_ref: input.decompositionModelSelectionRef,
		non_inheriting_parent_authority: true,
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
		model_selection_authority_enabled: false,
		ranking_authority_enabled: false,
	};

	return { ok: true, errors: [], decomposition };
}
