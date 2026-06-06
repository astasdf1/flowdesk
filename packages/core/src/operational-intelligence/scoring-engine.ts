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
}

export interface FlowDeskScoringEngineResultV1 {
	ok: boolean;
	errors: string[];
	score?: FlowDeskOptimizerProposalScoreV1;
	healthLabel: FlowDeskOIAdvisoryHealthLabelV1;
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
 * Compute confidence score based on how many evidence inputs are available.
 * all inputs (7) → 80, partial (3-6) → 60, minimal (0-2) → 40.
 */
function computeConfidenceScore(input: FlowDeskScoringEngineInputV1): number {
	const available = countAvailableInputs(input);
	if (available >= 7) return 80;
	if (available >= 3) return 60;
	return 40;
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

	// Score ID: deterministic from workflowId + proposalId + candidateRef
	const scoreId = `score-engine-${input.workflowId}-${input.proposalId}`;

	const dimensions: FlowDeskOptimizerScoreDimensionV1[] = [
		{ dimension: "cost", score: costScore, weight: 1, reason_ref: "reason-cost-usage-snapshot" },
		{ dimension: "latency", score: latencyScore, weight: 1, reason_ref: "reason-latency-reset-bucket" },
		{ dimension: "model_diversity", score: 70, weight: 1, reason_ref: "reason-model-diversity-placeholder" },
		{ dimension: "confidence", score: confidenceScore, weight: 1, reason_ref: "reason-confidence-input-completeness" },
		{ dimension: "safety", score: 80, weight: 1, reason_ref: "reason-safety-neutral-placeholder" },
		{ dimension: "goal_fit", score: 70, weight: 1, reason_ref: "reason-goal-fit-placeholder" },
		{ dimension: "simplicity_fit", score: 65, weight: 1, reason_ref: "reason-simplicity-fit-placeholder" },
		{ dimension: "detail_fit", score: 65, weight: 1, reason_ref: "reason-detail-fit-placeholder" },
		{ dimension: "taxonomy_fit", score: 65, weight: 1, reason_ref: "reason-taxonomy-fit-placeholder" },
		{ dimension: "verification_coverage", score: 65, weight: 1, reason_ref: "reason-verification-coverage-placeholder" },
		{ dimension: "risk", score: 65, weight: 1, reason_ref: "reason-risk-placeholder" },
		{ dimension: "dependency_impact", score: 65, weight: 1, reason_ref: "reason-dependency-impact-placeholder" },
	];

	// Advisory score: average of all dimensions (rounded)
	const advisoryScore = Math.round(
		dimensions.reduce((sum, d) => sum + d.score, 0) / dimensions.length,
	);

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

	return { ok: true, errors: [], score, healthLabel };
}
