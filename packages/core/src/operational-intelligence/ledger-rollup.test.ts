/**
 * Tests for ledger-rollup.ts (P7-S20).
 * Tests run via node:test with node:assert/strict.
 */
import assert from "node:assert/strict";
import test from "node:test";

import {
	computeWeightedMeanV1,
	computePercentileV1,
	computeEffectiveSampleSizeV1,
	computeDecayAdjustedMeanV1,
	computeLedgerRollupV1,
	type FlowDeskLedgerRollupResultV1,
	type FlowDeskLedgerRollupBlockedV1,
} from "./ledger-rollup.js";

import type { FlowDeskRoutingAdvisoryLedgerEntryV1 } from "./routing-advisory.js";

// ─── Helpers ──────────────────────────────────────────────────────────────────

function makeEntry(
	overrides: Partial<FlowDeskRoutingAdvisoryLedgerEntryV1> & {
		recorded_at?: string;
		weighted_score?: number;
	} = {},
): FlowDeskRoutingAdvisoryLedgerEntryV1 {
	return {
		signature_ref: "sig-test-001",
		model_ref: "model-ref-a",
		weighted_score: 0.75,
		recorded_at: "2026-06-11T10:00:00.000Z",
		...overrides,
	};
}

function makeEntries(count: number, baseScore = 0.7): FlowDeskRoutingAdvisoryLedgerEntryV1[] {
	return Array.from({ length: count }, (_, i) => makeEntry({
		weighted_score: baseScore,
		recorded_at: new Date(Date.UTC(2026, 5, 10, 10, i)).toISOString(),
	}));
}

// ─── Test 1: sealed partition → normal rollup ─────────────────────────────────

test("computeLedgerRollupV1: sealed partition produces a valid rollup", () => {
	const entries = makeEntries(10, 0.8);
	const result = computeLedgerRollupV1({
		entries,
		partitionState: "sealed",
		partitionIds: ["partition-001"],
	});

	assert.ok(!("status" in result), `expected rollup result, got: ${JSON.stringify(result)}`);
	const rollup = result as FlowDeskLedgerRollupResultV1;

	assert.equal(rollup.schema_version, "flowdesk.ledger_rollup_result.v1");
	assert.equal(rollup.sample_count, 10);
	assert.ok(rollup.effective_sample_count > 0, "effective_sample_count must be positive");
	assert.ok(rollup.weighted_mean_score > 0, "weighted_mean_score must be positive");
	assert.deepEqual(rollup.source_partition_ids, ["partition-001"]);

	// Authority flags
	assert.equal(rollup.advisory_only, true);
	assert.equal(rollup.dispatch_authority_enabled, false);
	assert.equal(rollup.ranking_authority_enabled, false);

	// Percentiles must be in increasing order
	assert.ok(rollup.p25 <= rollup.p50, "p25 <= p50");
	assert.ok(rollup.p50 <= rollup.p75, "p50 <= p75");
	assert.ok(rollup.p75 <= rollup.p90, "p75 <= p90");

	// Rollup hash must match sha256 format
	assert.ok(rollup.rollup_hash.startsWith("sha256-"), "rollup_hash must be sha256-prefixed");
	assert.equal(rollup.rollup_hash.length, 71, "sha256- + 64 hex chars = 71 chars");
});

// ─── Test 2: immutable partition → normal rollup ──────────────────────────────

test("computeLedgerRollupV1: immutable partition produces a valid rollup", () => {
	const entries = makeEntries(5, 0.6);
	const result = computeLedgerRollupV1({
		entries,
		partitionState: "immutable",
		partitionIds: ["partition-002"],
	});

	assert.ok(!("status" in result), "expected rollup result for immutable partition");
	const rollup = result as FlowDeskLedgerRollupResultV1;
	assert.equal(rollup.sample_count, 5);
	assert.equal(rollup.advisory_only, true);
	assert.equal(rollup.dispatch_authority_enabled, false);
});

// ─── Test 3: raw partition → blocked_raw_partition ────────────────────────────

test("computeLedgerRollupV1: raw partition state is immediately blocked", () => {
	const entries = makeEntries(10, 0.7);
	const result = computeLedgerRollupV1({
		entries,
		partitionState: "raw" as "sealed", // force raw through type cast
		partitionIds: ["partition-raw-001"],
	});

	assert.ok("status" in result, "expected blocked result");
	const blocked = result as FlowDeskLedgerRollupBlockedV1;
	assert.equal(blocked.status, "blocked_raw_partition");
	assert.ok(blocked.reason.length > 0, "blocked result must have a reason");
});

// ─── Test 4: insufficient data (< 3 entries) → insufficient_data ─────────────

test("computeLedgerRollupV1: fewer than 3 entries produces insufficient_data", () => {
	const cases = [0, 1, 2];
	for (const count of cases) {
		const entries = makeEntries(count, 0.8);
		const result = computeLedgerRollupV1({
			entries,
			partitionState: "sealed",
			partitionIds: ["partition-small"],
		});
		assert.ok("status" in result, `expected blocked result for ${count} entries`);
		const blocked = result as FlowDeskLedgerRollupBlockedV1;
		assert.equal(blocked.status, "insufficient_data", `expected insufficient_data for ${count} entries`);
		assert.ok(blocked.reason.includes(String(count)), `reason should mention entry count: ${blocked.reason}`);
	}
});

// ─── Test 5: weighted_mean is NOT cumulative sum ──────────────────────────────

test("computeLedgerRollupV1: weighted_mean_score is NOT cumulative sum / n", () => {
	// Create entries with clearly different ages so decay affects the mean
	const now = new Date("2026-06-11T10:00:00.000Z");
	const entries: FlowDeskRoutingAdvisoryLedgerEntryV1[] = [
		// Recent entries (low age) → high weight
		makeEntry({ weighted_score: 0.9, recorded_at: now.toISOString(), model_ref: "model-ref-a" }),
		makeEntry({ weighted_score: 0.9, recorded_at: now.toISOString(), model_ref: "model-ref-a" }),
		// Old entries (high age, 60 days ago) → low weight due to decay
		makeEntry({
			weighted_score: 0.1,
			recorded_at: new Date(now.getTime() - 60 * 24 * 60 * 60 * 1000).toISOString(),
			model_ref: "model-ref-b",
		}),
		makeEntry({
			weighted_score: 0.1,
			recorded_at: new Date(now.getTime() - 60 * 24 * 60 * 60 * 1000).toISOString(),
			model_ref: "model-ref-b",
		}),
	];

	const result = computeLedgerRollupV1({
		entries,
		partitionState: "sealed",
		partitionIds: ["partition-sum-test"],
		halfLifeDays: 30,
	});

	assert.ok(!("status" in result), "expected valid rollup");
	const rollup = result as FlowDeskLedgerRollupResultV1;

	// Cumulative sum would be (0.9+0.9+0.1+0.1)*100/4 = 50
	const naiveMean = entries.reduce((sum, e) => sum + e.weighted_score * 100, 0) / entries.length;
	assert.ok(
		Math.abs(rollup.weighted_mean_score - naiveMean) > 1,
		`weighted_mean_score (${rollup.weighted_mean_score.toFixed(4)}) should differ from naive mean (${naiveMean}) due to decay`,
	);

	// Weighted mean should be higher than naive mean because recent high-score entries have more weight
	assert.ok(
		rollup.weighted_mean_score > naiveMean,
		`decay-weighted mean (${rollup.weighted_mean_score.toFixed(4)}) should exceed naive mean (${naiveMean}) when recent entries score higher`,
	);

	// Also verify: sum ≠ mean * n (sanity check that it's not a simple sum)
	const impliedSum = rollup.weighted_mean_score * entries.length;
	const actualSum = entries.reduce((sum, e) => sum + e.weighted_score * 100, 0);
	assert.ok(
		Math.abs(impliedSum - actualSum) > 0.01,
		`weighted mean * n (${impliedSum.toFixed(4)}) must not equal raw sum (${actualSum.toFixed(4)})`,
	);
});

// ─── Test 6: confidence_bucket boundary values ────────────────────────────────

test("computeLedgerRollupV1: confidence_bucket follows effective sample size thresholds", () => {
	// For uniform weights (all same age = 0), ESS = n.
	// Use halfLifeDays = 1e9 to approximate "no decay" so ESS ≈ n.
	const NO_DECAY = 1_000_000; // effectively no decay for age < 100 days

	function rollupWithN(n: number) {
		const entries = Array.from({ length: n }, (_, i) =>
			makeEntry({
				weighted_score: 0.7,
				recorded_at: new Date(Date.UTC(2026, 5, 11, 10, 0, i)).toISOString(),
			}),
		);
		const result = computeLedgerRollupV1({
			entries,
			partitionState: "sealed",
			partitionIds: ["partition-bucket-test"],
			halfLifeDays: NO_DECAY,
		});
		assert.ok(!("status" in result));
		return result as FlowDeskLedgerRollupResultV1;
	}

	// n < 5 → low (we need n >= 3 for valid rollup)
	const r3 = rollupWithN(3);
	assert.equal(r3.confidence_bucket, "low", "3 entries → low confidence");

	const r4 = rollupWithN(4);
	assert.equal(r4.confidence_bucket, "low", "4 entries → low confidence");

	// n = 5 → medium
	const r5 = rollupWithN(5);
	assert.equal(r5.confidence_bucket, "medium", "5 entries → medium confidence");

	// n = 20 → high
	const r20 = rollupWithN(20);
	assert.equal(r20.confidence_bucket, "high", "20 entries → high confidence");

	// n = 50 → very_high
	const r50 = rollupWithN(50);
	assert.equal(r50.confidence_bucket, "very_high", "50 entries → very_high confidence");

	// n = 100 → very_high
	const r100 = rollupWithN(100);
	assert.equal(r100.confidence_bucket, "very_high", "100 entries → very_high confidence");
});

// ─── Test 7: scorer_concentration (Herfindahl-Hirschman index) ───────────────

test("computeLedgerRollupV1: scorer_concentration reflects HHI correctly", () => {
	// All entries from a single scorer → HHI = 1.0 (monopoly)
	const monopolyEntries = makeEntries(10, 0.7); // all model_ref = "model-ref-a"
	const monopolyResult = computeLedgerRollupV1({
		entries: monopolyEntries,
		partitionState: "sealed",
		partitionIds: ["partition-hhi-mono"],
	});
	assert.ok(!("status" in monopolyResult));
	const monoRollup = monopolyResult as FlowDeskLedgerRollupResultV1;
	assert.ok(
		Math.abs(monoRollup.scorer_concentration - 1.0) < 1e-10,
		`monopoly HHI should be 1.0, got ${monoRollup.scorer_concentration}`,
	);

	// Two scorers with equal share → HHI = 0.5
	const dualEntries: FlowDeskRoutingAdvisoryLedgerEntryV1[] = [
		...Array.from({ length: 5 }, (_, i) => makeEntry({ model_ref: "model-ref-a", recorded_at: new Date(Date.UTC(2026, 5, 11, 10, i)).toISOString() })),
		...Array.from({ length: 5 }, (_, i) => makeEntry({ model_ref: "model-ref-b", recorded_at: new Date(Date.UTC(2026, 5, 11, 11, i)).toISOString() })),
	];
	const dualResult = computeLedgerRollupV1({
		entries: dualEntries,
		partitionState: "sealed",
		partitionIds: ["partition-hhi-dual"],
	});
	assert.ok(!("status" in dualResult));
	const dualRollup = dualResult as FlowDeskLedgerRollupResultV1;
	assert.ok(
		Math.abs(dualRollup.scorer_concentration - 0.5) < 1e-10,
		`dual equal HHI should be 0.5, got ${dualRollup.scorer_concentration}`,
	);

	// Four scorers with equal share → HHI = 0.25
	const quadEntries: FlowDeskRoutingAdvisoryLedgerEntryV1[] = [
		...Array.from({ length: 3 }, (_, i) => makeEntry({ model_ref: "model-ref-a", recorded_at: new Date(Date.UTC(2026, 5, 11, 8, i)).toISOString() })),
		...Array.from({ length: 3 }, (_, i) => makeEntry({ model_ref: "model-ref-b", recorded_at: new Date(Date.UTC(2026, 5, 11, 9, i)).toISOString() })),
		...Array.from({ length: 3 }, (_, i) => makeEntry({ model_ref: "model-ref-c", recorded_at: new Date(Date.UTC(2026, 5, 11, 10, i)).toISOString() })),
		...Array.from({ length: 3 }, (_, i) => makeEntry({ model_ref: "model-ref-d", recorded_at: new Date(Date.UTC(2026, 5, 11, 11, i)).toISOString() })),
	];
	const quadResult = computeLedgerRollupV1({
		entries: quadEntries,
		partitionState: "sealed",
		partitionIds: ["partition-hhi-quad"],
	});
	assert.ok(!("status" in quadResult));
	const quadRollup = quadResult as FlowDeskLedgerRollupResultV1;
	assert.ok(
		Math.abs(quadRollup.scorer_concentration - 0.25) < 1e-10,
		`quad equal HHI should be 0.25, got ${quadRollup.scorer_concentration}`,
	);
});

// ─── Test 8: computeWeightedMeanV1 unit test ──────────────────────────────────

test("computeWeightedMeanV1: returns correct weighted mean with equal weights/ages", () => {
	// All same age and weight → result should equal simple mean
	const entries = [
		{ value: 60, weight: 1, age_days: 0, decay_factor: 1000 },
		{ value: 80, weight: 1, age_days: 0, decay_factor: 1000 },
		{ value: 100, weight: 1, age_days: 0, decay_factor: 1000 },
	];
	const result = computeWeightedMeanV1(entries);
	// decay_factor=1000, age_days=0 → weight = 2^0 = 1 for all → simple mean = 80
	assert.ok(Math.abs(result - 80) < 1e-10, `expected ~80, got ${result}`);
});

test("computeWeightedMeanV1: returns 0 for empty array", () => {
	assert.equal(computeWeightedMeanV1([]), 0);
});

// ─── Test 9: computePercentileV1 unit test ────────────────────────────────────

test("computePercentileV1: calculates correct percentiles", () => {
	const values = [10, 20, 30, 40, 50, 60, 70, 80, 90, 100];

	// p50 of [10..100] step 10 = 55 (linear interpolation between 50 and 60)
	const p50 = computePercentileV1(values, 50);
	assert.ok(Math.abs(p50 - 55) < 1e-10, `p50 expected 55, got ${p50}`);

	// p0 → min = 10
	const p0 = computePercentileV1(values, 0);
	assert.ok(Math.abs(p0 - 10) < 1e-10, `p0 expected 10, got ${p0}`);

	// p100 → max = 100
	const p100 = computePercentileV1(values, 100);
	assert.ok(Math.abs(p100 - 100) < 1e-10, `p100 expected 100, got ${p100}`);

	// Empty → 0
	assert.equal(computePercentileV1([], 50), 0);

	// Single element
	assert.equal(computePercentileV1([42], 50), 42);
});

// ─── Test 10: computeEffectiveSampleSizeV1 unit test ─────────────────────────

test("computeEffectiveSampleSizeV1: Kish approximation for equal weights", () => {
	// Equal weights → ESS = n
	const weights = [1, 1, 1, 1, 1];
	const ess = computeEffectiveSampleSizeV1(weights);
	assert.ok(Math.abs(ess - 5) < 1e-10, `expected ESS=5, got ${ess}`);

	// Single weight → ESS = 1
	const essOne = computeEffectiveSampleSizeV1([2]);
	assert.ok(Math.abs(essOne - 1) < 1e-10, `expected ESS=1, got ${essOne}`);

	// Highly unequal → ESS much less than n
	const unequal = [100, 1, 1, 1, 1];
	const essUnequal = computeEffectiveSampleSizeV1(unequal);
	assert.ok(essUnequal < 5, `unequal weights ESS (${essUnequal}) should be < n=5`);
	assert.ok(essUnequal > 1, `unequal weights ESS should be > 1`);

	// Empty → 0
	assert.equal(computeEffectiveSampleSizeV1([]), 0);
});

// ─── Test 11: negative_signal_count ──────────────────────────────────────────

test("computeLedgerRollupV1: negative_signal_count counts entries with score < 40", () => {
	const entries: FlowDeskRoutingAdvisoryLedgerEntryV1[] = [
		makeEntry({ weighted_score: 0.10, recorded_at: "2026-06-11T08:00:00.000Z" }), // 10 → negative
		makeEntry({ weighted_score: 0.25, recorded_at: "2026-06-11T08:01:00.000Z" }), // 25 → negative
		makeEntry({ weighted_score: 0.39, recorded_at: "2026-06-11T08:02:00.000Z" }), // 39 → negative
		makeEntry({ weighted_score: 0.40, recorded_at: "2026-06-11T08:03:00.000Z" }), // 40 → NOT negative
		makeEntry({ weighted_score: 0.80, recorded_at: "2026-06-11T08:04:00.000Z" }), // 80 → NOT negative
	];

	const result = computeLedgerRollupV1({
		entries,
		partitionState: "sealed",
		partitionIds: ["partition-neg-test"],
	});

	assert.ok(!("status" in result));
	const rollup = result as FlowDeskLedgerRollupResultV1;
	assert.equal(rollup.negative_signal_count, 3, "3 entries have score < 40");
});

// ─── Test 12: computeDecayAdjustedMeanV1 unit test ────────────────────────────

test("computeDecayAdjustedMeanV1: half-life decay applied correctly", () => {
	// Two entries: same value, one at age 0, one at age = half_life
	// Weight at age 0 = 1.0, weight at age = half_life = 0.5
	// Mean = (100 * 1 + 100 * 0.5) / (1 + 0.5) = 100
	const entries = [
		{ value: 100, age_days: 0, half_life_days: 7 },
		{ value: 100, age_days: 7, half_life_days: 7 },
	];
	const result = computeDecayAdjustedMeanV1(entries);
	assert.ok(Math.abs(result - 100) < 1e-10, `expected ~100, got ${result}`);

	// Two different values: high recent score, low old score
	const mixed = [
		{ value: 90, age_days: 0, half_life_days: 30 },
		{ value: 10, age_days: 60, half_life_days: 30 }, // weight = 2^(-2) = 0.25
	];
	const mixedResult = computeDecayAdjustedMeanV1(mixed);
	// w0=1, w1=0.25 → (90*1 + 10*0.25) / (1 + 0.25) = 92.5 / 1.25 = 74
	assert.ok(Math.abs(mixedResult - 74) < 1e-10, `expected ~74, got ${mixedResult}`);

	// Empty → 0
	assert.equal(computeDecayAdjustedMeanV1([]), 0);
});
