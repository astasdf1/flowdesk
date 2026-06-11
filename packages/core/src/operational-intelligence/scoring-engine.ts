/**
 * Minimal OI scoring engine — P7-S14.
 *
 * scoreWorkflowProposal() computes real advisory dimension scores from available
 * evidence (primarily provider usage snapshots) rather than requiring callers to
 * supply pre-computed numbers.
 *
 * ALL outputs are advisory-only.  No dispatch, provider, runtime, lane-launch,
 * fallback, write, or hard-chat authority is granted by any result returned here.
 */
import {
	type FlowDeskOIAdvisoryHealthLabelV1,
	validateOpaqueId,
	validateOpaqueRef,
} from "./shared.js";
import {
	type FlowDeskOptimizerProposalScoreV1,
	type FlowDeskOptimizerScoreDimensionV1,
	createFlowDeskOptimizerProposalScoreV1,
} from "./score-dimensions.js";
import { type FlowDeskUsageSustainabilitySignalV1 } from "../schemas/index.js";
import {
	type FlowDeskTaskBlockScoringV1,
	validateFlowDeskTaskBlockScoringV1,
} from "./task-block-scoring.js";

// ─── Public input / output contracts ─────────────────────────────────────────

export interface FlowDeskScoringEngineInputV1 {
	workflowId: string;
	proposalId: string;
	candidateRef: string;    // opaque ref identifying the model candidate
	agentRole: string;       // e.g. "implementation", "security"
	providerFamily: string;  // e.g. "claude", "openai", "gemini"
	usageRemainingPercent?: number;   // 0..100 from provider_usage_snapshot
	alertLevel?: "ok" | "warning" | "critical" | "exhausted" | "stale" | "unknown";
	resetBucketSeconds?: number;      // seconds until quota reset
	activeConurrentLanes?: number;    // current active lane count (note: typo preserved from spec)
	maxConcurrentLanes?: number;      // configured max (default 5)
	requestedLaneCount?: number;      // how many lanes requested
	contextWindowTokens?: number;     // optional model context window hint
	blockScoring?: FlowDeskTaskBlockScoringV1;  // optional block scoring for judgment 1 (real calc)
	variantId?: "simple" | "standard" | "detailed" | "high_assurance";  // variant for detail_fit/simplicity_fit weight
	proposalSetContext?: {
		distinctProviderFamilyCount?: number;  // for model_diversity calculation
	};
}

export interface FlowDeskScoringEngineResultV1 {
	ok: boolean;
	errors: string[];
	score?: FlowDeskOptimizerProposalScoreV1;
	healthLabel: FlowDeskOIAdvisoryHealthLabelV1;
	audit_usage_sustainability_applied?: boolean;
}

export interface FlowDeskScoringEngineContextV1 {
	usageSustainabilitySignal?: FlowDeskUsageSustainabilitySignalV1;
	resetWindowDurationMs?: number;
}

export type FlowDeskUsageScoreResultV1 =
	| { penalty: number; appliedBecause: string }
	| { penalty: 0; reason: "signal_missing" | "stale" | "signal_uncertainty" | "invalid_window" | "warm_up_period" };

const USAGE_SCORE_MAX_PENALTY = 40;
const USAGE_SCORE_WARM_UP_ELAPSED_PERCENT = 5;

function clampPercent(value: number): number {
	return Math.min(100, Math.max(0, value));
}

// ─── Internal scoring helpers ─────────────────────────────────────────────────

/** Count how many optional evidence fields are present. */
function countAvailableInputs(input: FlowDeskScoringEngineInputV1): number {
	let count = 0;
	if (input.usageRemainingPercent !== undefined) count++;
	if (input.alertLevel !== undefined) count++;
	if (input.resetBucketSeconds !== undefined) count++;
	if (input.activeConurrentLanes !== undefined) count++;
	if (input.maxConcurrentLanes !== undefined) count++;
	if (input.requestedLaneCount !== undefined) count++;
	if (input.contextWindowTokens !== undefined) count++;
	if (input.blockScoring !== undefined) count++;
	if (input.variantId !== undefined) count++;
	if (input.proposalSetContext?.distinctProviderFamilyCount !== undefined) count++;
	return count;
}

/**
 * Compute cost score from alertLevel + usageRemainingPercent.
 * exhausted/critical → low (20-40), warning → mid (50-70), ok → high (80-100).
 */
function computeCostScore(input: FlowDeskScoringEngineInputV1): number {
	const { alertLevel, usageRemainingPercent } = input;

	if (alertLevel === "exhausted") return 20;
	if (alertLevel === "critical") {
		// Scale within critical range: remaining 0-25 → score 25-40
		if (usageRemainingPercent !== undefined) {
			return Math.round(25 + (usageRemainingPercent / 25) * 15);
		}
		return 30;
	}
	if (alertLevel === "warning") {
		// Scale within warning range: remaining 25-60 → score 50-70
		if (usageRemainingPercent !== undefined) {
			const t = Math.min(1, Math.max(0, (usageRemainingPercent - 25) / 35));
			return Math.round(50 + t * 20);
		}
		return 60;
	}
	if (alertLevel === "ok") {
		// Scale within ok range: remaining 60-100 → score 80-100
		if (usageRemainingPercent !== undefined) {
			const t = Math.min(1, Math.max(0, (usageRemainingPercent - 60) / 40));
			return Math.round(80 + t * 20);
		}
		return 90;
	}
	// stale, unknown, or no alertLevel: use usageRemainingPercent if available
	if (usageRemainingPercent !== undefined) {
		return Math.round(20 + (usageRemainingPercent / 100) * 60);
	}
	return 65; // neutral placeholder
}

/**
 * Compute latency score from resetBucketSeconds + alertLevel.
 * Long reset window when critical/exhausted → lower score.
 */
function computeLatencyScore(input: FlowDeskScoringEngineInputV1): number {
	const { alertLevel, resetBucketSeconds } = input;

	if (alertLevel === "exhausted") {
		// Exhausted: blocked anyway, latency score reflects the long wait
		if (resetBucketSeconds !== undefined && resetBucketSeconds > 0) {
			// Longer reset → worse score: 3600s+ → 30, near 0s → 60
			const penalty = Math.min(30, Math.round((resetBucketSeconds / 3600) * 30));
			return Math.max(20, 60 - penalty);
		}
		return 30;
	}
	if (alertLevel === "critical") {
		if (resetBucketSeconds !== undefined && resetBucketSeconds > 0) {
			const penalty = Math.min(20, Math.round((resetBucketSeconds / 3600) * 20));
			return Math.max(40, 65 - penalty);
		}
		return 55;
	}
	// ok / warning / stale / unknown: base score 75, minor discount for long wait
	if (resetBucketSeconds !== undefined && resetBucketSeconds > 0) {
		const discount = Math.min(15, Math.round((resetBucketSeconds / 7200) * 15));
		return Math.max(60, 75 - discount);
	}
	return 75;
}

/**
 * Compute a bounded advisory burn-rate penalty from an independent quota signal.
 *
 * This function intentionally does not participate in quota governance decisions:
 * it never blocks, never zeroes out a provider, and never grants dispatch,
 * fallback, provider, runtime, or lane-launch authority.
 */
export function computeUsageScore(
	signal: FlowDeskUsageSustainabilitySignalV1,
	resetWindowDurationMs: number,
): FlowDeskUsageScoreResultV1 {
	if (!signal) return { penalty: 0, reason: "signal_missing" };
	if (signal.reset_window_kind === "unknown") return { penalty: 0, reason: "invalid_window" };
	if (typeof resetWindowDurationMs !== "number" || !Number.isFinite(resetWindowDurationMs) || resetWindowDurationMs <= 0) {
		return { penalty: 0, reason: "invalid_window" };
	}
	if (signal.uncertainty !== "confident") {
		return { penalty: 0, reason: signal.uncertainty === "stale" ? "stale" : "signal_uncertainty" };
	}
	if (typeof signal.remaining_percent !== "number" || !Number.isFinite(signal.remaining_percent)
		|| typeof signal.elapsed_percent !== "number" || !Number.isFinite(signal.elapsed_percent)) {
		return { penalty: 0, reason: "invalid_window" };
	}

	const elapsedPercent = clampPercent(signal.elapsed_percent);
	if (elapsedPercent < USAGE_SCORE_WARM_UP_ELAPSED_PERCENT) {
		return { penalty: 0, reason: "warm_up_period" };
	}

	const remainingPercent = clampPercent(signal.remaining_percent);
	const elapsedDenominator = Math.min(100, Math.max(1, elapsedPercent));
	const burnRate = (100 - remainingPercent) / elapsedDenominator;
	if (!Number.isFinite(burnRate) || burnRate <= 1.0) {
		return { penalty: 0, reason: "invalid_window" };
	}

	const penalty = Math.min(USAGE_SCORE_MAX_PENALTY, Math.floor(burnRate * 20));
	const roundedBurnRate = Math.round(burnRate * 10) / 10;
	return {
		penalty,
		appliedBecause: `burn_rate_${roundedBurnRate}x_${signal.reset_window_kind}_window`,
	};
}

/**
 * Compute confidence score based on how many evidence inputs are available.
 * all inputs (7) → 80, partial (3-6) → 60, minimal (0-2) → 40.
 * blockScoring presence grants an additional +2 (max still 100).
 */
function computeConfidenceScore(input: FlowDeskScoringEngineInputV1): number {
	const available = countAvailableInputs(input);
	let base: number;
	if (available >= 7) base = 80;
	else if (available >= 3) base = 60;
	else base = 40;
	const blockScoringBonus = input.blockScoring !== undefined ? 2 : 0;
	return Math.min(100, base + blockScoringBonus);
}

// ─── Judgment-1 dimension calculators (blockScoring-based) ───────────────────

/**
 * goal_fit: scope=5 is optimal, penalty grows toward either extreme.
 * scope 1..10 → score 0..100, clamped.
 */
function computeGoalFitScore(scope: number): number {
	return Math.max(0, Math.min(100, Math.round(100 - Math.abs(scope - 5) * 8)));
}

/** taxonomy_fit: category-based lookup into a curated fit table. */
const CATEGORY_FIT: Record<string, number> = {
	schema_only: 85,
	implementation: 80,
	integration: 75,
	orchestration: 70,
	security_boundary: 70,
	design: 60,
};

function computeTaxonomyFitScore(category: string): number {
	const base = CATEGORY_FIT[category];
	return base !== undefined ? base : 65; // neutral fallback for unknown category
}

/**
 * verification_coverage: higher authority_sensitivity means harder to verify
 * fully, so score decreases linearly.  Range 1..10 → score 95..50.
 */
function computeVerificationCoverageScore(authoritySensitivity: number): number {
	return Math.max(0, Math.min(100, Math.round(100 - authoritySensitivity * 5)));
}

/**
 * risk: composite of novelty, coupling, authority_sensitivity.
 * All three inputs increase risk; novelty is weighted heaviest.
 */
function computeRiskScore(novelty: number, coupling: number, authoritySensitivity: number): number {
	return Math.max(0, Math.min(100, Math.round(100 - (novelty * 5 + coupling * 3 + authoritySensitivity * 2) / 2)));
}

/**
 * dependency_impact: coupling-driven.  High coupling means larger blast radius.
 * Range 1..10 → score 92..20.
 */
function computeDependencyImpactScore(coupling: number): number {
	return Math.max(0, Math.min(100, Math.round(100 - coupling * 8)));
}

/**
 * model_diversity: more distinct provider families → higher score.
 * 0 families → 25, 1 → 50, 2 → 75, 3+ → 100.
 */
function computeModelDiversityScore(distinctProviderFamilyCount: number): number {
	return Math.min(100, distinctProviderFamilyCount * 25 + 25);
}

/**
 * safety: authority_sensitivity drives safety concern.
 * Range 1..10 → score 92..20.
 */
function computeSafetyScore(authoritySensitivity: number): number {
	return Math.max(0, Math.min(100, Math.round(100 - authoritySensitivity * 8)));
}

/**
 * simplicity_fit: lower complexity + smaller scope → more suitable for simple
 * variants.  variantId="simple" amplifies the reward for low complexity/scope.
 */
function computeSimplicityFitScore(
	complexity: number,
	scope: number,
	variantId?: string,
): number {
	// Base: 100 minus complexity (weight 5) minus scope distance from 1 (weight 3)
	const base = 100 - complexity * 5 - (scope - 1) * 3;
	const boost = variantId === "simple" ? 10 : variantId === "high_assurance" || variantId === "detailed" ? -10 : 0;
	return Math.max(0, Math.min(100, Math.round(base + boost)));
}

/**
 * detail_fit: higher complexity + larger scope → more appropriate for detailed
 * variants.  variantId="high_assurance"/"detailed" amplifies the reward.
 */
function computeDetailFitScore(
	complexity: number,
	scope: number,
	variantId?: string,
): number {
	// Base: starts at 50, grows with complexity and scope
	const base = 50 + complexity * 3 + (scope - 1) * 2;
	const boost = variantId === "high_assurance" || variantId === "detailed" ? 10 : variantId === "simple" ? -10 : 0;
	return Math.max(0, Math.min(100, Math.round(base + boost)));
}

// ─── Main engine function ─────────────────────────────────────────────────────

/**
 * scoreWorkflowProposal — compute an advisory FlowDeskOptimizerProposalScoreV1
 * from provider usage evidence.
 *
 * Advisory-only: no dispatch, provider, runtime, fallback, lane-launch, or
 * write authority is granted.  Never throws; returns ok:false on invalid input.
 */
export function scoreWorkflowProposal(
	input: FlowDeskScoringEngineInputV1,
	context: FlowDeskScoringEngineContextV1 = {},
): FlowDeskScoringEngineResultV1 {
	// ── Input validation ───────────────────────────────────────────────────────
	const errors: string[] = [];
	errors.push(...validateOpaqueId(input.workflowId, "workflowId").errors);
	errors.push(...validateOpaqueId(input.proposalId, "proposalId").errors);
	errors.push(...validateOpaqueRef(input.candidateRef, "candidateRef").errors);

	if (typeof input.agentRole !== "string" || input.agentRole.trim().length === 0) {
		errors.push("agentRole must be a non-empty string");
	}
	if (typeof input.providerFamily !== "string" || input.providerFamily.trim().length === 0) {
		errors.push("providerFamily must be a non-empty string");
	}
	if (input.usageRemainingPercent !== undefined) {
		if (typeof input.usageRemainingPercent !== "number" || !Number.isFinite(input.usageRemainingPercent) || input.usageRemainingPercent < 0 || input.usageRemainingPercent > 100) {
			errors.push("usageRemainingPercent must be 0..100");
		}
	}
	if (input.resetBucketSeconds !== undefined) {
		if (typeof input.resetBucketSeconds !== "number" || !Number.isFinite(input.resetBucketSeconds) || input.resetBucketSeconds < 0) {
			errors.push("resetBucketSeconds must be a non-negative number");
		}
	}
	if (input.activeConurrentLanes !== undefined) {
		if (typeof input.activeConurrentLanes !== "number" || !Number.isInteger(input.activeConurrentLanes) || input.activeConurrentLanes < 0) {
			errors.push("activeConurrentLanes must be a non-negative integer");
		}
	}
	if (input.maxConcurrentLanes !== undefined) {
		if (typeof input.maxConcurrentLanes !== "number" || !Number.isInteger(input.maxConcurrentLanes) || input.maxConcurrentLanes < 1) {
			errors.push("maxConcurrentLanes must be a positive integer");
		}
	}
	if (input.requestedLaneCount !== undefined) {
		if (typeof input.requestedLaneCount !== "number" || !Number.isInteger(input.requestedLaneCount) || input.requestedLaneCount < 0) {
			errors.push("requestedLaneCount must be a non-negative integer");
		}
	}
	if (input.contextWindowTokens !== undefined) {
		if (typeof input.contextWindowTokens !== "number" || !Number.isFinite(input.contextWindowTokens) || input.contextWindowTokens < 0) {
			errors.push("contextWindowTokens must be a non-negative number");
		}
	}

	const validAlertLevels = ["ok", "warning", "critical", "exhausted", "stale", "unknown"];
	if (input.alertLevel !== undefined && !validAlertLevels.includes(input.alertLevel)) {
		errors.push(`alertLevel must be one of: ${validAlertLevels.join(", ")}`);
	}

	if (input.blockScoring !== undefined) {
		const blockScoringValidation = validateFlowDeskTaskBlockScoringV1(input.blockScoring);
		if (!blockScoringValidation.ok) {
			errors.push(`blockScoring validation failed: ${blockScoringValidation.errors.join("; ")}`);
		}
	}

	if (input.variantId !== undefined) {
		const validVariants = ["simple", "standard", "detailed", "high_assurance"];
		if (!validVariants.includes(input.variantId)) {
			errors.push(`variantId must be one of: ${validVariants.join(", ")}`);
		}
	}

	if (input.proposalSetContext !== undefined) {
		if (typeof input.proposalSetContext !== "object" || input.proposalSetContext === null) {
			errors.push("proposalSetContext must be an object");
		} else {
			if (input.proposalSetContext.distinctProviderFamilyCount !== undefined) {
				if (typeof input.proposalSetContext.distinctProviderFamilyCount !== "number" || !Number.isInteger(input.proposalSetContext.distinctProviderFamilyCount) || input.proposalSetContext.distinctProviderFamilyCount < 0) {
					errors.push("proposalSetContext.distinctProviderFamilyCount must be a non-negative integer");
				}
			}
		}
	}

	if (errors.length > 0) {
		return { ok: false, errors, healthLabel: "unknown" };
	}

	// ── Determine hard filter state ────────────────────────────────────────────
	const isExhausted = input.alertLevel === "exhausted";
	const hardFiltersPassed = !isExhausted;
	const blockedLabels: string[] = isExhausted ? ["quota_exhausted"] : [];

	// ── Compute dimension scores ───────────────────────────────────────────────
	const costScore = computeCostScore(input);
	const latencyScore = computeLatencyScore(input);
	const confidenceScore = computeConfidenceScore(input);
	const usageScore = context.usageSustainabilitySignal
		? computeUsageScore(context.usageSustainabilitySignal, context.resetWindowDurationMs ?? 0)
		: undefined;
	const usagePenalty = usageScore && "appliedBecause" in usageScore ? usageScore.penalty : 0;
	const auditUsageSustainabilityApplied = usagePenalty > 0;

	// ── Variant-based weight adjustments for detail_fit and simplicity_fit ──────
	let detailFitWeight = 1;
	let simplicityFitWeight = 1;
	if (input.variantId) {
		// Adjust weights based on variant: detailed/high_assurance prioritize detail_fit
		if (input.variantId === "detailed" || input.variantId === "high_assurance") {
			detailFitWeight = 1.5;
			simplicityFitWeight = 0.7;
		} else if (input.variantId === "simple") {
			detailFitWeight = 0.7;
			simplicityFitWeight = 1.5;
		}
		// "standard" uses default weights (1.0 each)
	}

	// ── Model diversity score from provider family count ──────────────────────
	let modelDiversityScore: number;
	let modelDiversityReasonRef: string;
	if (input.proposalSetContext?.distinctProviderFamilyCount !== undefined) {
		modelDiversityScore = computeModelDiversityScore(input.proposalSetContext.distinctProviderFamilyCount);
		modelDiversityReasonRef = "reason-model-diversity-provider-count";
	} else {
		modelDiversityScore = 70;
		modelDiversityReasonRef = "reason-model-diversity-placeholder";
	}

	// Score ID: deterministic from workflowId + proposalId + candidateRef
	const scoreId = `score-engine-${input.workflowId}-${input.proposalId}`;

	// ── Judgment-1: real dimension calculation when blockScoring is available ──
	let safetyScore: number;
	let safetyReasonRef: string;
	let goalFitScore: number;
	let goalFitReasonRef: string;
	let simplicityFitScore: number;
	let simplicityFitReasonRef: string;
	let detailFitScore: number;
	let detailFitReasonRef: string;
	let taxonomyFitScore: number;
	let taxonomyFitReasonRef: string;
	let verificationCoverageScore: number;
	let verificationCoverageReasonRef: string;
	let riskScore: number;
	let riskReasonRef: string;
	let dependencyImpactScore: number;
	let dependencyImpactReasonRef: string;

	if (input.blockScoring !== undefined) {
		const bs = input.blockScoring;

		safetyScore = computeSafetyScore(bs.authority_sensitivity);
		safetyReasonRef = "reason-safety-block-scoring";

		goalFitScore = computeGoalFitScore(bs.scope);
		goalFitReasonRef = "reason-goal-fit-block-scoring";

		simplicityFitScore = computeSimplicityFitScore(bs.complexity, bs.scope, input.variantId);
		simplicityFitReasonRef = input.variantId
			? `reason-simplicity-fit-block-scoring-${input.variantId}`
			: "reason-simplicity-fit-block-scoring";

		detailFitScore = computeDetailFitScore(bs.complexity, bs.scope, input.variantId);
		detailFitReasonRef = input.variantId
			? `reason-detail-fit-block-scoring-${input.variantId}`
			: "reason-detail-fit-block-scoring";

		taxonomyFitScore = computeTaxonomyFitScore(bs.category);
		taxonomyFitReasonRef = "reason-taxonomy-fit-block-scoring";

		verificationCoverageScore = computeVerificationCoverageScore(bs.authority_sensitivity);
		verificationCoverageReasonRef = "reason-verification-coverage-block-scoring";

		riskScore = computeRiskScore(bs.novelty, bs.coupling, bs.authority_sensitivity);
		riskReasonRef = "reason-risk-block-scoring";

		dependencyImpactScore = computeDependencyImpactScore(bs.coupling);
		dependencyImpactReasonRef = "reason-dependency-impact-block-scoring";
	} else {
		// No blockScoring available — retain legacy placeholder values
		safetyScore = 80;
		safetyReasonRef = "reason-safety-neutral-placeholder-no-block-scoring";

		goalFitScore = 70;
		goalFitReasonRef = "reason-goal-fit-placeholder-no-block-scoring";

		simplicityFitScore = 65;
		simplicityFitReasonRef = input.variantId
			? `reason-simplicity-fit-variant-${input.variantId}-no-block-scoring`
			: "reason-simplicity-fit-placeholder-no-block-scoring";

		detailFitScore = 65;
		detailFitReasonRef = input.variantId
			? `reason-detail-fit-variant-${input.variantId}-no-block-scoring`
			: "reason-detail-fit-placeholder-no-block-scoring";

		taxonomyFitScore = 65;
		taxonomyFitReasonRef = "reason-taxonomy-fit-placeholder-no-block-scoring";

		verificationCoverageScore = 65;
		verificationCoverageReasonRef = "reason-verification-coverage-placeholder-no-block-scoring";

		riskScore = 65;
		riskReasonRef = "reason-risk-placeholder-no-block-scoring";

		dependencyImpactScore = 65;
		dependencyImpactReasonRef = "reason-dependency-impact-placeholder-no-block-scoring";
	}

	const dimensions: FlowDeskOptimizerScoreDimensionV1[] = [
		{ dimension: "cost", score: costScore, weight: 1, reason_ref: "reason-cost-usage-snapshot" },
		{ dimension: "latency", score: latencyScore, weight: 1, reason_ref: "reason-latency-reset-bucket" },
		{ dimension: "model_diversity", score: modelDiversityScore, weight: 1, reason_ref: modelDiversityReasonRef },
		{ dimension: "confidence", score: confidenceScore, weight: 1, reason_ref: "reason-confidence-input-completeness" },
		{ dimension: "safety", score: safetyScore, weight: 1, reason_ref: safetyReasonRef },
		{ dimension: "goal_fit", score: goalFitScore, weight: 1, reason_ref: goalFitReasonRef },
		{ dimension: "simplicity_fit", score: simplicityFitScore, weight: simplicityFitWeight, reason_ref: simplicityFitReasonRef },
		{ dimension: "detail_fit", score: detailFitScore, weight: detailFitWeight, reason_ref: detailFitReasonRef },
		{ dimension: "taxonomy_fit", score: taxonomyFitScore, weight: 1, reason_ref: taxonomyFitReasonRef },
		{ dimension: "verification_coverage", score: verificationCoverageScore, weight: 1, reason_ref: verificationCoverageReasonRef },
		{ dimension: "risk", score: riskScore, weight: 1, reason_ref: riskReasonRef },
		{ dimension: "dependency_impact", score: dependencyImpactScore, weight: 1, reason_ref: dependencyImpactReasonRef },
	];

	// Advisory score: weighted average of all dimensions, minus an optional bounded usage
	// sustainability penalty. The usage path stays separate from latency scoring.
	const totalWeight = dimensions.reduce((sum, d) => sum + d.weight, 0);
	const baseAdvisoryScore = Math.round(
		dimensions.reduce((sum, d) => sum + d.score * d.weight, 0) / totalWeight,
	);
	const advisoryScore = Math.max(0, baseAdvisoryScore - usagePenalty);

	// ── Build the FlowDeskOptimizerProposalScoreV1 ────────────────────────────
	const score = createFlowDeskOptimizerProposalScoreV1({
		scoreId,
		workflowId: input.workflowId,
		proposalId: input.proposalId,
		candidateRef: input.candidateRef,
		hardFiltersPassed,
		blockedLabels,
		scoreDimensions: dimensions,
		advisoryScore,
	});

	// ── Determine health label ─────────────────────────────────────────────────
	let healthLabel: FlowDeskOIAdvisoryHealthLabelV1;
	if (isExhausted) {
		healthLabel = "degraded";
	} else if (input.alertLevel === "stale" || input.alertLevel === "unknown") {
		healthLabel = "stale";
	} else {
		const available = countAvailableInputs(input);
		if (available < 2) {
			healthLabel = "partial";
		} else {
			// ok or warning with sufficient inputs
			healthLabel = "healthy";
		}
	}

	return {
		ok: true,
		errors: [],
		score,
		healthLabel,
		audit_usage_sustainability_applied: auditUsageSustainabilityApplied,
	};
}
