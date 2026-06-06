/**
 * Score dimension contracts: optimizer proposal score and normalized score aggregation.
 * P7-S13.5 submodule: score-dimensions
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
	validateAdvisoryAuthorityFlags,
	validateHardFilterFields,
	validateOptimizerScoreDimensions,
} from "./shared.js";

// ─── Types ────────────────────────────────────────────────────────────────────

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

// ─── Creators ─────────────────────────────────────────────────────────────────

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

// ─── Validators ────────────────────────────────────────────────────────────────

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
