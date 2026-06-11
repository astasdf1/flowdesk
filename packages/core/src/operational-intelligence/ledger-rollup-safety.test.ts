/**
 * P7-S21: Ledger rollup safety tests.
 * Verifies Exit Criterion #8/#9: cumulative sum is forbidden, dispatch authority is blocked,
 * minimum sample size is enforced, and all authority flags are false.
 *
 * Tests run via node:test with node:assert/strict.
 */
import assert from "node:assert/strict";
import test from "node:test";

import {
	computeWeightedMeanV1,
	computeEffectiveSampleSizeV1,
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

// ════════════════════════════════════════════════════════════════════════════════
// SAFETY TEST 1: computeWeightedMeanV1 is NOT cumulative sum
// ════════════════════════════════════════════════════════════════════════════════

test("Safety #1: computeWeightedMeanV1 is not a cumulative sum divided by count", () => {
	// Create entries with distinct ages so decay significantly affects weights.
	// If the function were cumulative sum / n, it would simply average all values.
	// But with decay, recent entries should dominate.

	const entries = [
		// Three recent entries with high values (age ≈ 0 days)
		{ value: 90, weight: 1, age_days: 0, decay_factor: 30 },
		{ value: 90, weight: 1, age_days: 0.5, decay_factor: 30 },
		{ value: 90, weight: 1, age_days: 1, decay_factor: 30 },
		// One old entry with very low value (age = 60 days, weight ≈ 0.25)
		{ value: 10, weight: 1, age_days: 60, decay_factor: 30 },
	];

	const weightedMean = computeWeightedMeanV1(entries);

	// Naive cumulative sum / n = (90 + 90 + 90 + 10) / 4 = 70
	const naiveSum = (90 + 90 + 90 + 10) / 4;
	const naiveMean = naiveSum;

	// Decay-weighted mean should be > 70 because recent high values dominate
	assert.ok(
		weightedMean > naiveMean + 1, // threshold to ensure meaningful difference
		`weighted mean (${weightedMean.toFixed(2)}) should be significantly > naive mean (${naiveMean}) due to decay`,
	);

	// Also verify: weighted_mean ≠ raw_sum (cumulative sum proof)
	const rawSum = entries.reduce((sum, e) => sum + e.value * e.weight, 0);
	assert.ok(
		Math.abs(weightedMean - rawSum) > 0.1,
		`weighted mean (${weightedMean.toFixed(2)}) must not equal raw sum (${rawSum})`,
	);
});

// ════════════════════════════════════════════════════════════════════════════════
// SAFETY TEST 2: raw partition is immediately blocked
// ════════════════════════════════════════════════════════════════════════════════

test("Safety #2: computeLedgerRollupV1 blocks raw partition input", () => {
	const entries = makeEntries(10, 0.8);
	const result = computeLedgerRollupV1({
		entries,
		partitionState: "raw" as "sealed", // force raw through type cast
		partitionIds: ["partition-raw-001"],
	});

	assert.ok("status" in result, "expected blocked result for raw partition");
	const blocked = result as FlowDeskLedgerRollupBlockedV1;
	assert.equal(blocked.status, "blocked_raw_partition", "must block raw partition");
	assert.ok(blocked.reason.includes("raw"), "reason must mention raw");
});

// ════════════════════════════════════════════════════════════════════════════════
// SAFETY TEST 3: sealed partition produces valid rollup (success path)
// ════════════════════════════════════════════════════════════════════════════════

test("Safety #3: computeLedgerRollupV1 accepts sealed partition and produces valid result", () => {
	const entries = makeEntries(8, 0.75);
	const result = computeLedgerRollupV1({
		entries,
		partitionState: "sealed",
		partitionIds: ["partition-sealed-001"],
	});

	assert.ok(!("status" in result), "expected rollup result, not blocked");
	const rollup = result as FlowDeskLedgerRollupResultV1;

	assert.equal(rollup.schema_version, "flowdesk.ledger_rollup_result.v1");
	assert.equal(rollup.sample_count, 8);
	assert.ok(rollup.effective_sample_count > 0);
	assert.deepEqual(rollup.source_partition_ids, ["partition-sealed-001"]);
});

// ════════════════════════════════════════════════════════════════════════════════
// SAFETY TEST 4: all authority flags are false (dispatch protection)
// ════════════════════════════════════════════════════════════════════════════════

test("Safety #4: computeLedgerRollupV1 result has all authority flags false", () => {
	const entries = makeEntries(6, 0.7);
	const result = computeLedgerRollupV1({
		entries,
		partitionState: "sealed",
		partitionIds: ["partition-auth-test"],
	});

	assert.ok(!("status" in result), "expected rollup result");
	const rollup = result as FlowDeskLedgerRollupResultV1;

	// All authority flags must be explicitly false
	assert.equal(rollup.advisory_only, true, "must be advisory_only: true");
	assert.equal(rollup.dispatch_authority_enabled, false, "dispatch_authority_enabled must be false");
	assert.equal(rollup.ranking_authority_enabled, false, "ranking_authority_enabled must be false");

	// Verify the type enforces these as const
	const _mustBeTrue: true = rollup.advisory_only;
	const _mustBeFalse1: false = rollup.dispatch_authority_enabled;
	const _mustBeFalse2: false = rollup.ranking_authority_enabled;

	// Use these to prevent unused variable warnings
	void _mustBeTrue;
	void _mustBeFalse1;
	void _mustBeFalse2;
});

// ════════════════════════════════════════════════════════════════════════════════
// SAFETY TEST 5: rollup cannot be used to approve dispatch or bypass Guard
// ════════════════════════════════════════════════════════════════════════════════

test("Safety #5: computeLedgerRollupV1 cannot be used to approve dispatch or bypass Guard", () => {
	const entries = makeEntries(12, 0.85);
	const result = computeLedgerRollupV1({
		entries,
		partitionState: "sealed",
		partitionIds: ["partition-dispatch-test"],
	});

	assert.ok(!("status" in result));
	const rollup = result as FlowDeskLedgerRollupResultV1;

	// The advisory_only literal must be true, making this unusable for dispatch approval
	assert.strictEqual(rollup.advisory_only, true, "advisory_only must be literal true");
	assert.strictEqual(rollup.dispatch_authority_enabled, false, "dispatch_authority_enabled must be literal false");

	// Cannot mutate or reinterpret the result to gain dispatch authority
	// because the type contract enforces advisory_only: true as a const
	const canDispatch = rollup.dispatch_authority_enabled;
	assert.equal(canDispatch, false, "dispatch must remain disabled even after assertion");
});

// ════════════════════════════════════════════════════════════════════════════════
// SAFETY TEST 6: weighted distribution with multiple scorers reduces effective concentration
// ════════════════════════════════════════════════════════════════════════════════

test("Safety #6: multiple independent scorers have lower scorer_concentration than monopoly", () => {
	// Monopoly case: all entries from one scorer
	const monoEntries = makeEntries(5, 0.7); // all from "model-ref-a"
	const monoResult = computeLedgerRollupV1({
		entries: monoEntries,
		partitionState: "sealed",
		partitionIds: ["partition-mono"],
	});
	assert.ok(!("status" in monoResult));
	const monoRollup = monoResult as FlowDeskLedgerRollupResultV1;

	// Distributed case: entries from multiple scorers
	const distEntries: FlowDeskRoutingAdvisoryLedgerEntryV1[] = [
		makeEntry({ weighted_score: 0.7, recorded_at: "2026-06-11T10:00:00.000Z", model_ref: "model-x" }),
		makeEntry({ weighted_score: 0.7, recorded_at: "2026-06-11T10:01:00.000Z", model_ref: "model-y" }),
		makeEntry({ weighted_score: 0.7, recorded_at: "2026-06-11T10:02:00.000Z", model_ref: "model-z" }),
		makeEntry({ weighted_score: 0.7, recorded_at: "2026-06-11T10:03:00.000Z", model_ref: "model-w" }),
		makeEntry({ weighted_score: 0.7, recorded_at: "2026-06-11T10:04:00.000Z", model_ref: "model-v" }),
	];
	const distResult = computeLedgerRollupV1({
		entries: distEntries,
		partitionState: "sealed",
		partitionIds: ["partition-dist"],
	});
	assert.ok(!("status" in distResult));
	const distRollup = distResult as FlowDeskLedgerRollupResultV1;

	// Monopoly HHI should be higher than distributed HHI
	assert.ok(
		monoRollup.scorer_concentration > distRollup.scorer_concentration,
		`monopoly concentration (${monoRollup.scorer_concentration}) should be > distributed concentration (${distRollup.scorer_concentration})`,
	);
});

// ════════════════════════════════════════════════════════════════════════════════
// SAFETY TEST 7: scorer_concentration is between 0 and 1
// ════════════════════════════════════════════════════════════════════════════════

test("Safety #7: scorer_concentration is between 0 and 1 (valid HHI range)", () => {
	// Test multiple scorer distributions

	// Case 1: Single scorer (monopoly) → HHI = 1.0
	const monoEntries = makeEntries(10, 0.7); // all from "model-ref-a"
	const monoResult = computeLedgerRollupV1({
		entries: monoEntries,
		partitionState: "sealed",
		partitionIds: ["partition-mono"],
	});
	assert.ok(!("status" in monoResult));
	const monoRollup = monoResult as FlowDeskLedgerRollupResultV1;
	assert.ok(monoRollup.scorer_concentration >= 0 && monoRollup.scorer_concentration <= 1);
	assert.ok(Math.abs(monoRollup.scorer_concentration - 1.0) < 1e-10, "single scorer HHI should be 1.0");

	// Case 2: Three equal scorers → HHI = 1/3 ≈ 0.333
	const tripleEntries: FlowDeskRoutingAdvisoryLedgerEntryV1[] = [
		...Array.from({ length: 3 }, (_, i) => makeEntry({ model_ref: "model-a", recorded_at: new Date(Date.UTC(2026, 5, 11, 8, i)).toISOString() })),
		...Array.from({ length: 3 }, (_, i) => makeEntry({ model_ref: "model-b", recorded_at: new Date(Date.UTC(2026, 5, 11, 9, i)).toISOString() })),
		...Array.from({ length: 3 }, (_, i) => makeEntry({ model_ref: "model-c", recorded_at: new Date(Date.UTC(2026, 5, 11, 10, i)).toISOString() })),
	];
	const tripleResult = computeLedgerRollupV1({
		entries: tripleEntries,
		partitionState: "sealed",
		partitionIds: ["partition-triple"],
	});
	assert.ok(!("status" in tripleResult));
	const tripleRollup = tripleResult as FlowDeskLedgerRollupResultV1;
	assert.ok(tripleRollup.scorer_concentration >= 0 && tripleRollup.scorer_concentration <= 1);
	assert.ok(
		Math.abs(tripleRollup.scorer_concentration - 1 / 3) < 0.01,
		`three equal scorers HHI should be ~0.333, got ${tripleRollup.scorer_concentration}`,
	);
});

// ════════════════════════════════════════════════════════════════════════════════
// SAFETY TEST 8: confidence_bucket is a bounded label, not a raw score
// ════════════════════════════════════════════════════════════════════════════════

test("Safety #8: confidence_bucket is a bounded label, not a raw score", () => {
	const validBuckets = new Set(["low", "medium", "high", "very_high"]);

	// Test across different sample sizes to verify label consistency
	for (const n of [3, 5, 10, 20, 50]) {
		const entries = makeEntries(n, 0.7);
		const result = computeLedgerRollupV1({
			entries,
			partitionState: "sealed",
			partitionIds: ["partition-bucket-test"],
		});

		assert.ok(!("status" in result));
		const rollup = result as FlowDeskLedgerRollupResultV1;

		// Must be a string from the enum
		assert.ok(typeof rollup.confidence_bucket === "string", "confidence_bucket must be a string");
		assert.ok(
			validBuckets.has(rollup.confidence_bucket),
			`confidence_bucket must be one of [low, medium, high, very_high], got "${rollup.confidence_bucket}"`,
		);

		// Must NOT be a raw numeric score: test via type guard
		const bucket = rollup.confidence_bucket;
		const isValidLabel = bucket === "low" || bucket === "medium" || bucket === "high" || bucket === "very_high";
		assert.ok(isValidLabel, `confidence_bucket must match one of the valid label strings, got "${bucket}"`);
	}
});

// ════════════════════════════════════════════════════════════════════════════════
// SAFETY TEST 9: < 3 entries produces insufficient_data, blocking rollup
// ════════════════════════════════════════════════════════════════════════════════

test("Safety #9: computeLedgerRollupV1 returns insufficient_data for fewer than 3 entries", () => {
	// Test edge cases: 0, 1, 2 entries
	const testCases = [
		{ count: 0, label: "zero entries" },
		{ count: 1, label: "one entry" },
		{ count: 2, label: "two entries" },
	];

	for (const { count, label } of testCases) {
		const entries = makeEntries(count, 0.7);
		const result = computeLedgerRollupV1({
			entries,
			partitionState: "sealed",
			partitionIds: ["partition-insufficient"],
		});

		assert.ok("status" in result, `expected blocked result for ${label}`);
		const blocked = result as FlowDeskLedgerRollupBlockedV1;
		assert.equal(
			blocked.status,
			"insufficient_data",
			`${label} must produce insufficient_data status`,
		);
		assert.ok(blocked.reason.length > 0, `${label} must have a reason`);
		assert.ok(
			blocked.reason.includes(String(count)),
			`${label} reason must mention entry count`,
		);
	}

	// Verify that 3 entries IS sufficient (boundary)
	const borderlineEntries = makeEntries(3, 0.7);
	const borderlineResult = computeLedgerRollupV1({
		entries: borderlineEntries,
		partitionState: "sealed",
		partitionIds: ["partition-borderline"],
	});
	assert.ok(
		!("status" in borderlineResult),
		"3 entries should NOT produce insufficient_data",
	);
});

// ════════════════════════════════════════════════════════════════════════════════
// SAFETY TEST 10: rollup_hash is deterministic
// ════════════════════════════════════════════════════════════════════════════════

test("Safety #10: rollup_hash is deterministic for same input", () => {
	// Create a fixed set of entries
	const entries = [
		makeEntry({ weighted_score: 0.80, recorded_at: "2026-06-11T10:00:00.000Z", model_ref: "model-a" }),
		makeEntry({ weighted_score: 0.75, recorded_at: "2026-06-11T10:05:00.000Z", model_ref: "model-b" }),
		makeEntry({ weighted_score: 0.70, recorded_at: "2026-06-11T10:10:00.000Z", model_ref: "model-c" }),
		makeEntry({ weighted_score: 0.85, recorded_at: "2026-06-11T10:15:00.000Z", model_ref: "model-a" }),
	];

	// Compute rollup twice with identical input
	const result1 = computeLedgerRollupV1({
		entries: [...entries],
		partitionState: "sealed",
		partitionIds: ["partition-hash-test"],
	});
	const result2 = computeLedgerRollupV1({
		entries: [...entries],
		partitionState: "sealed",
		partitionIds: ["partition-hash-test"],
	});

	assert.ok(!("status" in result1) && !("status" in result2));
	const rollup1 = result1 as FlowDeskLedgerRollupResultV1;
	const rollup2 = result2 as FlowDeskLedgerRollupResultV1;

	assert.equal(
		rollup1.rollup_hash,
		rollup2.rollup_hash,
		`rollup_hash must be deterministic: ${rollup1.rollup_hash} vs ${rollup2.rollup_hash}`,
	);

	// Verify hash format: "sha256-" + 64 hex digits
	assert.ok(rollup1.rollup_hash.startsWith("sha256-"), "rollup_hash must be sha256-prefixed");
	assert.equal(rollup1.rollup_hash.length, 71, "sha256-<64 hex> = 71 chars total");
});

// ════════════════════════════════════════════════════════════════════════════════
// BONUS: ESS invariant (Kish formula validation)
// ════════════════════════════════════════════════════════════════════════════════

test("Bonus: effective_sample_count respects Kish approximation invariant", () => {
	// Direct unit test of Kish formula: ESS = (Σw)² / Σ(w²)
	const weights = [1, 1, 1, 2, 2]; // unequal weights to show ESS < n

	const ess = computeEffectiveSampleSizeV1(weights);
	const n = weights.length;
	const sumW = weights.reduce((a, b) => a + b);
	const sumW2 = weights.reduce((a, b) => a + b * b);
	const expectedEss = (sumW * sumW) / sumW2;

	assert.ok(Math.abs(ess - expectedEss) < 1e-10, `ESS computed incorrectly: ${ess} vs ${expectedEss}`);
	assert.ok(ess <= n, `ESS must never exceed sample count n=${n}, got ${ess}`);
});
