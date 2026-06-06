/**
 * Task block scoring and design spec quality contracts.
 * P7-S13.5 submodule: task-block-scoring
 */
import {
	type ValidationResult,
	valid,
	invalid,
	validateNoForbiddenRawPayloads,
	validateOpaqueId,
	validateOpaqueRef,
	validateBoundedLabel,
	validateTimestamp,
	isRecord,
	rejectUnknownProperties,
} from "./shared.js";

// ─── CONTRACT 1: FlowDeskTaskBlockScoringV1 ───────────────────────────────────

export type FlowDeskTaskBlockCategoryV1 =
	| "schema_only"
	| "implementation"
	| "integration"
	| "orchestration"
	| "security_boundary"
	| "design";

export type FlowDeskTaskBlockModelTierV1 =
	| "flash_lite"
	| "flash"
	| "sonnet"
	| "opus"
	| "opus_multi_model";

export interface FlowDeskTaskBlockScoringV1 {
	schema_version: "flowdesk.task_block_scoring.v1";
	block_id: string;
	block_label: string;
	scored_at: string;
	scope: number;
	category: FlowDeskTaskBlockCategoryV1;
	complexity: number;
	coupling: number;
	authority_sensitivity: number;
	novelty: number;
	category_score: number;
	block_score: number;
	recommended_model_tier: FlowDeskTaskBlockModelTierV1;
	design_first_required: boolean;
	multi_model_design_required: boolean;
	readiness_check_passed: boolean;
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

const CATEGORY_SCORE_LOOKUP: Record<FlowDeskTaskBlockCategoryV1, number> = {
	schema_only: 4,
	implementation: 6,
	integration: 6,
	orchestration: 8,
	security_boundary: 10,
	design: 10,
};

function getModelTierFromScore(score: number): FlowDeskTaskBlockModelTierV1 {
	if (score >= 53) return "opus_multi_model";
	if (score >= 43) return "opus";
	if (score >= 29) return "sonnet";
	if (score >= 21) return "flash";
	return "flash_lite";
}

export function createFlowDeskTaskBlockScoringV1(input: {
	blockId: string;
	blockLabel: string;
	scoredAt: string;
	scope: number;
	category: FlowDeskTaskBlockCategoryV1;
	complexity: number;
	coupling: number;
	authoritySensitivity: number;
	novelty: number;
	readinessCheckPassed: boolean;
}): { ok: boolean; errors: string[]; scoring?: FlowDeskTaskBlockScoringV1 } {
	const errors: string[] = [];

	const validateRange = (val: number, label: string) => {
		if (!Number.isInteger(val) || val < 1 || val > 10) {
			errors.push(`${label} must be an integer 1-10`);
		}
	};

	validateRange(input.scope, "scope");
	validateRange(input.complexity, "complexity");
	validateRange(input.coupling, "coupling");
	validateRange(input.authoritySensitivity, "authoritySensitivity");
	validateRange(input.novelty, "novelty");

	if (!CATEGORY_SCORE_LOOKUP[input.category]) {
		errors.push(`invalid category: ${input.category}`);
	}

	if (errors.length > 0) return { ok: false, errors };

	const categoryScore = CATEGORY_SCORE_LOOKUP[input.category];
	const blockScore = input.scope + categoryScore + input.complexity + input.coupling + input.authoritySensitivity + input.novelty;
	const recommendedModelTier = getModelTierFromScore(blockScore);
	const designFirstRequired = input.novelty >= 8 || input.authoritySensitivity >= 8 || blockScore >= 50;
	const multiModelDesignRequired = blockScore >= 54;

	const scoring: FlowDeskTaskBlockScoringV1 = {
		schema_version: "flowdesk.task_block_scoring.v1",
		block_id: input.blockId,
		block_label: input.blockLabel,
		scored_at: input.scoredAt,
		scope: input.scope,
		category: input.category,
		complexity: input.complexity,
		coupling: input.coupling,
		authority_sensitivity: input.authoritySensitivity,
		novelty: input.novelty,
		category_score: categoryScore,
		block_score: blockScore,
		recommended_model_tier: recommendedModelTier,
		design_first_required: designFirstRequired,
		multi_model_design_required: multiModelDesignRequired,
		readiness_check_passed: input.readinessCheckPassed,
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

	return { ok: true, errors: [], scoring };
}

export function validateFlowDeskTaskBlockScoringV1(value: unknown): ValidationResult {
	if (!isRecord(value)) return invalid("task block scoring must be an object");
	const record = value as Record<string, unknown>;
	const errors: string[] = [];

	const allowed = [
		"schema_version", "block_id", "block_label", "scored_at", "scope", "category",
		"complexity", "coupling", "authority_sensitivity", "novelty", "category_score",
		"block_score", "recommended_model_tier", "design_first_required", "multi_model_design_required",
		"readiness_check_passed", "advisory_only", "non_authorizing", "release_gate",
		"dispatch_authority_enabled", "approval_authority_enabled", "provider_authority_enabled",
		"runtime_authority_enabled", "external_write_authority_enabled", "remote_write_authority_enabled",
		"fallback_authority_enabled", "lane_launch_authority_enabled", "write_authority_enabled",
		"hard_chat_authority_enabled"
	];

	errors.push(...rejectUnknownProperties(record, allowed, "task block scoring").errors);
	errors.push(...validateOpaqueId(record.block_id, "block_id").errors);
	errors.push(...validateBoundedLabel(record.block_label, "block_label").errors);
	errors.push(...validateTimestamp(record.scored_at, "scored_at").errors);

	if (record.schema_version !== "flowdesk.task_block_scoring.v1") errors.push("invalid schema_version");
	if (record.release_gate !== "operational_intelligence_later_gate") errors.push("invalid release_gate");

	const scope = record.scope as number;
	const categoryScore = record.category_score as number;
	const complexity = record.complexity as number;
	const coupling = record.coupling as number;
	const authoritySensitivity = record.authority_sensitivity as number;
	const novelty = record.novelty as number;
	const blockScore = record.block_score as number;

	if (blockScore !== (scope + categoryScore + complexity + coupling + authoritySensitivity + novelty)) {
		errors.push("block_score inconsistent with component sum");
	}

	const expectedTier = getModelTierFromScore(blockScore);
	if (record.recommended_model_tier !== expectedTier) {
		errors.push(`recommended_model_tier ${record.recommended_model_tier} inconsistent with block_score ${blockScore}`);
	}

	const expectedDesignFirst = novelty >= 8 || authoritySensitivity >= 8 || blockScore >= 50;
	if (record.design_first_required !== expectedDesignFirst) {
		errors.push("design_first_required inconsistency");
	}

	const expectedMultiModel = blockScore >= 54;
	if (record.multi_model_design_required !== expectedMultiModel) {
		errors.push("multi_model_design_required inconsistency");
	}

	if (record.advisory_only !== true) errors.push("advisory_only must be true");
	if (record.non_authorizing !== true) errors.push("non_authorizing must be true");
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

	errors.push(...validateNoForbiddenRawPayloads(record, "task block scoring").errors);

	return errors.length === 0 ? valid() : invalid(...errors);
}

// ─── CONTRACT 2: FlowDeskDesignSpecQualityV1 ──────────────────────────────────

export interface FlowDeskDesignSpecQualityV1 {
	schema_version: "flowdesk.design_spec_quality.v1";
	scored_design_ref: string;
	block_scoring_ref: string;
	completeness: number;
	precision: number;
	security_coverage: number;
	consistency: number;
	implementability: number;
	total_score: number;
	passes_threshold: boolean;
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

export function createFlowDeskDesignSpecQualityV1(input: {
	scoredDesignRef: string;
	blockScoringRef: string;
	completeness: number;
	precision: number;
	securityCoverage: number;
	consistency: number;
	implementability: number;
}): { ok: boolean; errors: string[]; quality?: FlowDeskDesignSpecQualityV1 } {
	const errors: string[] = [];

	const validateMetric = (val: number, label: string) => {
		if (!Number.isInteger(val) || val < 0 || val > 20) {
			errors.push(`${label} must be an integer 0-20`);
		}
	};

	validateMetric(input.completeness, "completeness");
	validateMetric(input.precision, "precision");
	validateMetric(input.securityCoverage, "securityCoverage");
	validateMetric(input.consistency, "consistency");
	validateMetric(input.implementability, "implementability");

	if (errors.length > 0) return { ok: false, errors };

	const totalScore = input.completeness + input.precision + input.securityCoverage + input.consistency + input.implementability;
	const passesThreshold = totalScore >= 80;

	const quality: FlowDeskDesignSpecQualityV1 = {
		schema_version: "flowdesk.design_spec_quality.v1",
		scored_design_ref: input.scoredDesignRef,
		block_scoring_ref: input.blockScoringRef,
		completeness: input.completeness,
		precision: input.precision,
		security_coverage: input.securityCoverage,
		consistency: input.consistency,
		implementability: input.implementability,
		total_score: totalScore,
		passes_threshold: passesThreshold,
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

	return { ok: true, errors: [], quality };
}

export function validateFlowDeskDesignSpecQualityV1(value: unknown): ValidationResult {
	if (!isRecord(value)) return invalid("design spec quality must be an object");
	const record = value as Record<string, unknown>;
	const errors: string[] = [];

	const allowed = [
		"schema_version", "scored_design_ref", "block_scoring_ref", "completeness",
		"precision", "security_coverage", "consistency", "implementability",
		"total_score", "passes_threshold", "advisory_only", "non_authorizing",
		"release_gate", "dispatch_authority_enabled", "approval_authority_enabled",
		"provider_authority_enabled", "runtime_authority_enabled", "external_write_authority_enabled",
		"remote_write_authority_enabled", "fallback_authority_enabled", "lane_launch_authority_enabled",
		"write_authority_enabled", "hard_chat_authority_enabled"
	];

	errors.push(...rejectUnknownProperties(record, allowed, "design spec quality").errors);
	errors.push(...validateOpaqueRef(record.scored_design_ref, "scored_design_ref").errors);
	errors.push(...validateOpaqueRef(record.block_scoring_ref, "block_scoring_ref").errors);

	if (record.schema_version !== "flowdesk.design_spec_quality.v1") errors.push("invalid schema_version");
	if (record.release_gate !== "operational_intelligence_later_gate") errors.push("invalid release_gate");

	const totalScore = (record.completeness as number) + (record.precision as number) + (record.security_coverage as number) + (record.consistency as number) + (record.implementability as number);
	if (record.total_score !== totalScore) {
		errors.push("total_score inconsistent with sum of metrics");
	}

	if (record.passes_threshold !== (totalScore >= 80)) {
		errors.push("passes_threshold inconsistency");
	}

	if (record.advisory_only !== true) errors.push("advisory_only must be true");
	if (record.non_authorizing !== true) errors.push("non_authorizing must be true");
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

	errors.push(...validateNoForbiddenRawPayloads(record, "design spec quality").errors);

	return errors.length === 0 ? valid() : invalid(...errors);
}
