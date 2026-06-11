/**
 * P7-S20: Ledger rollup — sealed partition aggregate functions.
 *
 * Computes advisory-only statistical rollups from sealed/immutable ledger partitions.
 * Raw partitions are blocked. Cumulative sums are forbidden; only weighted means are used.
 *
 * ALL outputs are advisory_only: true, dispatch_authority_enabled: false.
 * No dispatch, provider, runtime, lane-launch, fallback, write, or hard-chat authority.
 */
import { createHash } from "node:crypto";

import {
	type FlowDeskRoutingAdvisoryLedgerEntryV1,
} from "./routing-advisory.js";
import { stableStringify } from "./shared.js";

// ─── Rollup result type ────────────────────────────────────────────────────────

export type FlowDeskLedgerRollupConfidenceBucketV1 = "low" | "medium" | "high" | "very_high";

export interface FlowDeskLedgerRollupResultV1 {
	schema_version: "flowdesk.ledger_rollup_result.v1";
	source_partition_ids: string[];
	sample_count: number;
	effective_sample_count: number;
	weighted_mean_score: number;
	confidence_bucket: FlowDeskLedgerRollupConfidenceBucketV1;
	p25: number;
	p50: number;
	p75: number;
	p90: number;
	decay_adjusted_mean: number;
	last_observation_at: string;
	scorer_concentration: number;
	negative_signal_count: number;
	rollup_hash: string;
	// Authority
	advisory_only: true;
	dispatch_authority_enabled: false;
	ranking_authority_enabled: false;
}

// ─── Blocked / error result types ────────────────────────────────────────────

export type FlowDeskLedgerRollupBlockedV1 =
	| { status: "blocked_raw_partition"; reason: string }
	| { status: "insufficient_data"; reason: string };

// ─── Helper: compute weighted mean with optional decay ───────────────────────

/**
 * Compute a weighted mean using per-entry weights and decay factors.
 * Each entry's effective weight = weight * exp(-ln(2) * age_days / (decay_factor ?? default_half_life))
 * Decay factor defaults to 1.0 (no decay beyond the provided weight).
 */
export function computeWeightedMeanV1(
	entries: Array<{ value: number; weight: number; age_days: number; decay_factor?: number }>,
): number {
	if (entries.length === 0) return 0;

	let totalWeight = 0;
	let weightedSum = 0;

	for (const entry of entries) {
		const decayFactor = entry.decay_factor ?? 1.0;
		// decay: weight * 2^(-age / decayFactor), where decayFactor is the half-life in days
		// When decayFactor === 1.0 (default), this is 2^(-age_days) — strong decay for simple callers.
		// For realistic use, callers pass decay_factor = half_life_days
		const effectiveWeight = entry.weight * Math.pow(2, -entry.age_days / decayFactor);
		totalWeight += effectiveWeight;
		weightedSum += entry.value * effectiveWeight;
	}

	if (totalWeight === 0) return 0;
	return weightedSum / totalWeight;
}

// ─── Helper: percentile ───────────────────────────────────────────────────────

/**
 * Compute a percentile value from an unsorted array.
 * Uses linear interpolation (type 7 in R notation).
 * percentile: 0..100
 */
export function computePercentileV1(values: number[], percentile: number): number {
	if (values.length === 0) return 0;
	if (values.length === 1) return values[0];

	const sorted = [...values].sort((a, b) => a - b);
	const p = Math.min(100, Math.max(0, percentile));
	const n = sorted.length;

	// Linear interpolation (type 7)
	const h = ((n - 1) * p) / 100;
	const lo = Math.floor(h);
	const hi = Math.ceil(h);
	if (lo === hi) return sorted[lo];
	return sorted[lo] + (sorted[hi] - sorted[lo]) * (h - lo);
}

// ─── Helper: effective sample size (Kish approximation) ──────────────────────

/**
 * Compute effective sample size using Kish's approximation:
 * ESS = (Σw_i)^2 / Σ(w_i^2)
 */
export function computeEffectiveSampleSizeV1(weights: number[]): number {
	if (weights.length === 0) return 0;

	const sumW = weights.reduce((acc, w) => acc + w, 0);
	const sumW2 = weights.reduce((acc, w) => acc + w * w, 0);

	if (sumW2 === 0) return 0;
	return (sumW * sumW) / sumW2;
}

// ─── Helper: decay-adjusted mean ─────────────────────────────────────────────

/**
 * Compute a decay-adjusted mean using exponential decay with a half-life.
 * Each entry's weight is 2^(-age_days / half_life_days).
 */
export function computeDecayAdjustedMeanV1(
	entries: Array<{ value: number; age_days: number; half_life_days: number }>,
): number {
	if (entries.length === 0) return 0;

	let totalWeight = 0;
	let weightedSum = 0;

	for (const entry of entries) {
		const halfLife = Math.max(0.001, entry.half_life_days);
		const w = Math.pow(2, -entry.age_days / halfLife);
		totalWeight += w;
		weightedSum += entry.value * w;
	}

	if (totalWeight === 0) return 0;
	return weightedSum / totalWeight;
}

// ─── Helper: confidence bucket ───────────────────────────────────────────────

// Small epsilon to guard against floating-point rounding at exact thresholds.
// e.g. Kish ESS for 5 equal-weight entries may compute as 4.9999... not 5.0.
const CONFIDENCE_EPSILON = 1e-6;

function toConfidenceBucket(effectiveSampleCount: number): FlowDeskLedgerRollupConfidenceBucketV1 {
	if (effectiveSampleCount >= 50 - CONFIDENCE_EPSILON) return "very_high";
	if (effectiveSampleCount >= 20 - CONFIDENCE_EPSILON) return "high";
	if (effectiveSampleCount >= 5 - CONFIDENCE_EPSILON) return "medium";
	return "low";
}

// ─── Helper: Herfindahl-Hirschman index for scorer concentration ──────────────

/**
 * Compute Herfindahl-Hirschman index (HHI) for scorer concentration.
 * HHI = Σ(share_i^2), where share_i = count_i / total_count.
 * Returns 0..1 (1 = monopoly, 1/n = perfect competition).
 */
function computeScorerConcentration(entries: FlowDeskRoutingAdvisoryLedgerEntryV1[]): number {
	if (entries.length === 0) return 0;

	// Count by model_ref (treated as scorer id)
	const countByScorer = new Map<string, number>();
	for (const entry of entries) {
		countByScorer.set(entry.model_ref, (countByScorer.get(entry.model_ref) ?? 0) + 1);
	}

	const total = entries.length;
	let hhi = 0;
	for (const count of countByScorer.values()) {
		const share = count / total;
		hhi += share * share;
	}

	return hhi;
}

// ─── Helper: sha256 rollup hash ───────────────────────────────────────────────

function computeRollupHash(
	partitionIds: string[],
	sampleCount: number,
	weightedMeanScore: number,
	lastObservationAt: string,
): string {
	const canonical = stableStringify({
		partition_ids: [...partitionIds].sort(),
		sample_count: sampleCount,
		weighted_mean_score: weightedMeanScore,
		last_observation_at: lastObservationAt,
	});
	return `sha256-${createHash("sha256").update(canonical, "utf8").digest("hex")}`;
}

// ─── Main rollup function ─────────────────────────────────────────────────────

/**
 * Compute a ledger rollup from sealed/immutable partitions.
 *
 * Blocks raw partitions immediately (status: "blocked_raw_partition").
 * Requires at least 3 entries (status: "insufficient_data" otherwise).
 *
 * Uses weighted mean only — never cumulative sum. The weighted_mean_score
 * is guaranteed to satisfy: weighted_mean_score ≠ Σscores (unless n=1).
 *
 * Advisory-only: no dispatch, provider, runtime, fallback, lane-launch,
 * write, hard-chat, or ranking authority.
 */
export function computeLedgerRollupV1(input: {
	entries: FlowDeskRoutingAdvisoryLedgerEntryV1[];
	partitionState: "sealed" | "immutable";
	partitionIds: string[];
	halfLifeDays?: number;
}): FlowDeskLedgerRollupResultV1 | FlowDeskLedgerRollupBlockedV1 {
	const { entries, partitionState, partitionIds } = input;
	const halfLifeDays = input.halfLifeDays ?? 30;

	// Block raw partitions
	if ((partitionState as string) === "raw") {
		return {
			status: "blocked_raw_partition",
			reason: "raw partitions are not eligible for rollup; only sealed or immutable partitions are allowed",
		};
	}

	// Require minimum sample count
	if (entries.length < 3) {
		return {
			status: "insufficient_data",
			reason: `rollup requires at least 3 entries, but only ${entries.length} provided`,
		};
	}

	// Determine the "now" reference from last recorded_at (latest entry)
	const sortedByTime = [...entries].sort(
		(a, b) => Date.parse(b.recorded_at) - Date.parse(a.recorded_at),
	);
	const lastObservationAt = sortedByTime[0].recorded_at;
	const nowMs = Date.parse(lastObservationAt);

	// Build weighted mean inputs for each entry
	// age_days is relative to the most recent observation
	const weightedInputs = entries.map((entry) => {
		const recordedMs = Date.parse(entry.recorded_at);
		const ageDays = Math.max(0, (nowMs - recordedMs) / (1000 * 60 * 60 * 24));
		const value = Math.max(0, Math.min(100, entry.weighted_score * 100)); // normalize to 0..100
		return {
			value,
			weight: 1.0,
			age_days: ageDays,
			decay_factor: halfLifeDays,
		};
	});

	// Compute weighted mean (uses decay, NOT cumulative sum)
	const weightedMeanScore = computeWeightedMeanV1(weightedInputs);

	// Compute effective decay weights for ESS
	const decayWeights = weightedInputs.map((e) =>
		1.0 * Math.pow(2, -e.age_days / (e.decay_factor ?? halfLifeDays)),
	);
	const effectiveSampleCount = computeEffectiveSampleSizeV1(decayWeights);

	// Compute percentiles on raw score values (0..100 normalized)
	const rawValues = weightedInputs.map((e) => e.value);
	const p25 = computePercentileV1(rawValues, 25);
	const p50 = computePercentileV1(rawValues, 50);
	const p75 = computePercentileV1(rawValues, 75);
	const p90 = computePercentileV1(rawValues, 90);

	// Compute decay-adjusted mean using half_life_days
	const decayInputs = weightedInputs.map((e) => ({
		value: e.value,
		age_days: e.age_days,
		half_life_days: halfLifeDays,
	}));
	const decayAdjustedMean = computeDecayAdjustedMeanV1(decayInputs);

	// Confidence bucket
	const confidenceBucket = toConfidenceBucket(effectiveSampleCount);

	// Scorer concentration (HHI)
	const scorerConcentration = computeScorerConcentration(entries);

	// Negative signal count: score < 40 (i.e., weighted_score < 0.40)
	const negativeSignalCount = entries.filter((e) => e.weighted_score * 100 < 40).length;

	// Rollup hash
	const rollupHash = computeRollupHash(
		partitionIds,
		entries.length,
		weightedMeanScore,
		lastObservationAt,
	);

	return {
		schema_version: "flowdesk.ledger_rollup_result.v1",
		source_partition_ids: [...partitionIds],
		sample_count: entries.length,
		effective_sample_count: effectiveSampleCount,
		weighted_mean_score: weightedMeanScore,
		confidence_bucket: confidenceBucket,
		p25,
		p50,
		p75,
		p90,
		decay_adjusted_mean: decayAdjustedMean,
		last_observation_at: lastObservationAt,
		scorer_concentration: scorerConcentration,
		negative_signal_count: negativeSignalCount,
		rollup_hash: rollupHash,
		// Authority
		advisory_only: true,
		dispatch_authority_enabled: false,
		ranking_authority_enabled: false,
	};
}
