/**
 * FlowDeskBlockSelectionCriteriaV1
 * P7-S13.7: Block selection criteria contract derived from task block scoring.
 * Advisory-only, non-authorizing, release_gate: operational_intelligence_later_gate.
 */
import {
	type ValidationResult,
	valid,
	invalid,
	validateNoForbiddenRawPayloads,
	validateOpaqueId,
	validateOpaqueRef,
	validateTimestamp,
	isRecord,
	rejectUnknownProperties,
} from "./shared.js";
import {
	type FlowDeskTaskBlockScoringV1,
	type FlowDeskTaskBlockCategoryV1,
} from "./task-block-scoring.js";
import type { FlowDeskModelSelectionPurposeV1 } from "./model-selection-result.js";

// Re-export for consumers
export type { FlowDeskTaskBlockCategoryV1 };

// ─── Category score lookup (same as task-block-scoring) ───────────────────────

const CATEGORY_SCORE_LOOKUP: Record<FlowDeskTaskBlockCategoryV1, number> = {
	schema_only: 4,
	implementation: 6,
	integration: 6,
	orchestration: 8,
	security_boundary: 10,
	design: 10,
};

const VALID_CATEGORIES: readonly FlowDeskTaskBlockCategoryV1[] = [
	"schema_only",
	"implementation",
	"integration",
	"orchestration",
	"security_boundary",
	"design",
];

// ─── Derivation algorithm ─────────────────────────────────────────────────────

/**
 * Derive min_category_fitness_required from block scoring fields.
 * First match wins:
 *   1. authority_sensitivity >= 8 → 8
 *   2. category in {security_boundary, design} → 8
 *   3. else → max(2, floor(category_score / 2) + 2)
 */
function deriveMinCategoryFitness(category: FlowDeskTaskBlockCategoryV1, authoritySensitivity: number): number {
	if (authoritySensitivity >= 8) return 8;
	if (category === "security_boundary" || category === "design") return 8;
	const categoryScore = CATEGORY_SCORE_LOOKUP[category];
	return Math.max(2, Math.floor(categoryScore / 2) + 2);
}

// ─── CONTRACT: FlowDeskBlockSelectionCriteriaV1 ───────────────────────────────

export interface FlowDeskBlockSelectionCriteriaV1 {
	schema_version: "flowdesk.block_selection_criteria.v1";
	criteria_id: string;
	block_scoring_ref: string;
	derived_at: string;
	min_category_fitness_required: number;
	min_complexity_handling_required: number;
	min_authority_score_required: number;
	allows_multi_model: boolean;
	requires_multi_model: boolean;
	source_block_id: string;
	source_block_score: number;
	source_category: string;
	source_complexity: number;
	source_authority_sensitivity: number;
	selection_purpose?: FlowDeskModelSelectionPurposeV1;
	// 12 authority flags + advisory + non-authorizing + release gate
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

const ALLOWED_FIELDS: readonly string[] = [
	"schema_version",
	"criteria_id",
	"block_scoring_ref",
	"derived_at",
	"min_category_fitness_required",
	"min_complexity_handling_required",
	"min_authority_score_required",
	"allows_multi_model",
	"requires_multi_model",
	"source_block_id",
	"source_block_score",
	"source_category",
	"source_complexity",
	"source_authority_sensitivity",
	"selection_purpose",
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
	"model_selection_authority_enabled",
	"ranking_authority_enabled",
];

export function createFlowDeskBlockSelectionCriteriaV1(input: {
	criteriaId: string;
	blockScoring: FlowDeskTaskBlockScoringV1;
	derivedAt: string;
	selectionPurpose?: FlowDeskModelSelectionPurposeV1;
}): { ok: boolean; errors: string[]; criteria?: FlowDeskBlockSelectionCriteriaV1 } {
	const errors: string[] = [];

	errors.push(...validateOpaqueId(input.criteriaId, "criteriaId").errors);
	errors.push(...validateTimestamp(input.derivedAt, "derivedAt").errors);

	const VALID_PURPOSES: readonly string[] = ["block_decomposition", "proposal_generation"];
	if (input.selectionPurpose !== undefined && !VALID_PURPOSES.includes(input.selectionPurpose)) {
		errors.push(`selectionPurpose must be one of: ${VALID_PURPOSES.join(", ")}`);
	}

	if (errors.length > 0) return { ok: false, errors };

	const block = input.blockScoring;
	const minCategoryFitness = deriveMinCategoryFitness(block.category, block.authority_sensitivity);
	const allowsMultiModel = block.block_score >= 50;
	const requiresMultiModel = block.block_score >= 54;

	const criteria: FlowDeskBlockSelectionCriteriaV1 = {
		schema_version: "flowdesk.block_selection_criteria.v1",
		criteria_id: input.criteriaId,
		block_scoring_ref: block.block_id,
		derived_at: input.derivedAt,
		min_category_fitness_required: minCategoryFitness,
		min_complexity_handling_required: block.complexity,
		min_authority_score_required: block.authority_sensitivity,
		allows_multi_model: allowsMultiModel,
		requires_multi_model: requiresMultiModel,
		source_block_id: block.block_id,
		source_block_score: block.block_score,
		source_category: block.category,
		source_complexity: block.complexity,
		source_authority_sensitivity: block.authority_sensitivity,
		...(input.selectionPurpose !== undefined ? { selection_purpose: input.selectionPurpose } : {}),
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

	return { ok: true, errors: [], criteria };
}

export function validateFlowDeskBlockSelectionCriteriaV1(value: unknown): ValidationResult {
	if (!isRecord(value)) return invalid("block selection criteria must be an object");
	const record = value as Record<string, unknown>;
	const errors: string[] = [];

	errors.push(...rejectUnknownProperties(record, ALLOWED_FIELDS, "block selection criteria").errors);

	if (record.schema_version !== "flowdesk.block_selection_criteria.v1") errors.push("invalid schema_version");
	if (record.release_gate !== "operational_intelligence_later_gate") errors.push("invalid release_gate");

	errors.push(...validateOpaqueId(record.criteria_id, "criteria_id").errors);
	errors.push(...validateOpaqueRef(record.block_scoring_ref, "block_scoring_ref").errors);
	errors.push(...validateTimestamp(record.derived_at, "derived_at").errors);

	const validateIntRange = (val: unknown, label: string, min: number, max: number) => {
		if (!Number.isInteger(val) || (val as number) < min || (val as number) > max) {
			errors.push(`${label} must be an integer ${min}-${max}`);
		}
	};

	validateIntRange(record.min_category_fitness_required, "min_category_fitness_required", 1, 10);
	validateIntRange(record.min_complexity_handling_required, "min_complexity_handling_required", 1, 10);
	validateIntRange(record.min_authority_score_required, "min_authority_score_required", 1, 10);

	if (typeof record.allows_multi_model !== "boolean") errors.push("allows_multi_model must be a boolean");
	if (typeof record.requires_multi_model !== "boolean") errors.push("requires_multi_model must be a boolean");

	// Cross-field: requires_multi_model → allows_multi_model must be true
	if (record.requires_multi_model === true && record.allows_multi_model !== true) {
		errors.push("requires_multi_model=true requires allows_multi_model=true");
	}

	errors.push(...validateOpaqueId(record.source_block_id, "source_block_id").errors);

	validateIntRange(record.source_block_score, "source_block_score", 14, 60);
	validateIntRange(record.source_complexity, "source_complexity", 1, 10);
	validateIntRange(record.source_authority_sensitivity, "source_authority_sensitivity", 1, 10);

	if (typeof record.source_category !== "string" || !(VALID_CATEGORIES as readonly string[]).includes(record.source_category)) {
		errors.push(`source_category must be one of: ${VALID_CATEGORIES.join(", ")}`);
	}

	// selection_purpose (optional)
	const VALID_PURPOSES_VALIDATION: readonly string[] = ["block_decomposition", "proposal_generation"];
	if (record.selection_purpose !== undefined) {
		if (typeof record.selection_purpose !== "string" || !VALID_PURPOSES_VALIDATION.includes(record.selection_purpose)) {
			errors.push(`selection_purpose must be one of: ${VALID_PURPOSES_VALIDATION.join(", ")}`);
		}
	}

	// Authority flags
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
	if (record.model_selection_authority_enabled !== false) errors.push("model_selection_authority_enabled must be false");
	if (record.ranking_authority_enabled !== false) errors.push("ranking_authority_enabled must be false");

	errors.push(...validateNoForbiddenRawPayloads(record, "block selection criteria").errors);

	return errors.length === 0 ? valid() : invalid(...errors);
}
