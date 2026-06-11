/**
 * Tests for rollup-static-export.ts (P7-S25).
 *
 * Test cases:
 *   1. HTML contains no raw score values — only confidence_bucket label
 *   2. FORBIDDEN_RAW_PAYLOAD_MARKERS present in rollup → throws error
 *   3. HTML contains advisory_only comment
 *   4. Result authority flags: advisory_only=true, dispatch_authority_enabled=false
 *   5. HTML includes confidence_bucket, sample_count, last_observation_at
 *   6. Custom pageTitle appears in HTML
 *   7. All four confidence bucket labels render correctly
 *   8. HTML escaping on confidence_bucket (XSS safety)
 */
import assert from "node:assert/strict";
import { test } from "node:test";
import type { FlowDeskLedgerRollupResultV1 } from "@flowdesk/core";
import {
	generateRollupStaticPageV1,
	type RollupStaticExportInputV1,
	type RollupStaticExportResultV1,
} from "./rollup-static-export.js";

// ── Helpers ───────────────────────────────────────────────────────────────────

function makeRollup(
	overrides: Partial<FlowDeskLedgerRollupResultV1> = {},
): FlowDeskLedgerRollupResultV1 {
	return {
		schema_version: "flowdesk.ledger_rollup_result.v1",
		source_partition_ids: ["partition-001"],
		sample_count: 42,
		effective_sample_count: 38.5,
		weighted_mean_score: 72.3,
		confidence_bucket: "high",
		p25: 60.1,
		p50: 71.8,
		p75: 80.5,
		p90: 88.2,
		decay_adjusted_mean: 70.9,
		last_observation_at: "2026-06-01T12:00:00.000Z",
		scorer_concentration: 0.25,
		negative_signal_count: 3,
		rollup_hash: "sha256-" + "a".repeat(64),
		advisory_only: true,
		dispatch_authority_enabled: false,
		ranking_authority_enabled: false,
		...overrides,
	};
}

function makeInput(
	overrides: Partial<RollupStaticExportInputV1> = {},
): RollupStaticExportInputV1 {
	return {
		rollup: makeRollup(),
		pageTitle: "FlowDesk Score Ledger Summary",
		generatedAt: "2026-06-11T09:00:00.000Z",
		...overrides,
	};
}

// ── Test 1: HTML contains no raw score values ─────────────────────────────────

test("generateRollupStaticPageV1 does not expose raw numeric score values in HTML", () => {
	const rollup = makeRollup({
		weighted_mean_score: 72.3456789,
		p25: 60.123,
		p50: 71.876,
		p75: 80.555,
		p90: 88.222,
		decay_adjusted_mean: 70.999,
		scorer_concentration: 0.123456,
	});
	const result = generateRollupStaticPageV1({ rollup });

	// None of the raw score numbers should appear in the output HTML
	assert.ok(!result.html.includes("72.3456789"), "weighted_mean_score must not appear");
	assert.ok(!result.html.includes("60.123"), "p25 must not appear");
	assert.ok(!result.html.includes("71.876"), "p50 must not appear");
	assert.ok(!result.html.includes("80.555"), "p75 must not appear");
	assert.ok(!result.html.includes("88.222"), "p90 must not appear");
	assert.ok(!result.html.includes("70.999"), "decay_adjusted_mean must not appear");
	assert.ok(!result.html.includes("0.123456"), "scorer_concentration must not appear");

	// The confidence_bucket label SHOULD appear
	assert.ok(result.html.includes("High"), "confidence_bucket label 'High' must appear");
});

// ── Test 2: FORBIDDEN_RAW_PAYLOAD_MARKERS in rollup → throws error ─────────────

test("generateRollupStaticPageV1 throws when rollup contains FORBIDDEN_RAW_PAYLOAD_MARKERS", () => {
	// We need to inject a forbidden marker into the rollup. The forbidden markers
	// include "token", "credential", "secret", "raw_prompt", etc.
	// We inject by casting to bypass type safety — the guard must catch it.
	const rollupWithForbidden = makeRollup() as FlowDeskLedgerRollupResultV1 & {
		credential?: string;
	};
	// Attach a forbidden field via object spread
	const tainted = { ...rollupWithForbidden, credential: "should-not-appear" };

	assert.throws(
		() => generateRollupStaticPageV1({ rollup: tainted as unknown as FlowDeskLedgerRollupResultV1 }),
		(err: unknown) => {
			assert.ok(err instanceof Error, "Expected Error");
			assert.ok(
				err.message.includes("forbidden raw payload marker"),
				`Expected forbidden marker message, got: ${err.message}`,
			);
			return true;
		},
	);
});

// ── Test 3: HTML contains advisory_only comment ────────────────────────────────

test("generateRollupStaticPageV1 includes advisory_only comment in HTML", () => {
	const result = generateRollupStaticPageV1(makeInput());

	assert.ok(
		result.html.includes("advisory_only: true"),
		"HTML must contain advisory_only: true comment",
	);
	assert.ok(
		result.html.includes("dispatch_authority_enabled: false"),
		"HTML must contain dispatch_authority_enabled: false comment",
	);
});

// ── Test 4: Result authority flags are correct ────────────────────────────────

test("generateRollupStaticPageV1 result has advisory_only=true and dispatch_authority_enabled=false", () => {
	const result: RollupStaticExportResultV1 = generateRollupStaticPageV1(makeInput());

	assert.equal(result.advisory_only, true);
	assert.equal(result.dispatch_authority_enabled, false);
	assert.equal(result.redactionApplied, true);
	// Verify the TypeScript literal types are enforced at runtime values
	assert.strictEqual(result.advisory_only, true as const);
	assert.strictEqual(result.dispatch_authority_enabled, false as const);
});

// ── Test 5: HTML includes confidence_bucket, sample_count, last_observation_at ──

test("generateRollupStaticPageV1 HTML includes safe fields: confidence_bucket, sample_count, last_observation_at", () => {
	const rollup = makeRollup({
		confidence_bucket: "medium",
		sample_count: 17,
		last_observation_at: "2026-05-15T08:30:00.000Z",
	});
	const result = generateRollupStaticPageV1({ rollup });

	// confidence_bucket display label
	assert.ok(result.html.includes("Medium"), "confidence_bucket label 'Medium' must appear");
	// sample_count
	assert.ok(result.html.includes("17"), "sample_count 17 must appear in HTML");
	// last_observation_at
	assert.ok(
		result.html.includes("2026-05-15T08:30:00.000Z"),
		"last_observation_at must appear in HTML",
	);
});

// ── Test 6: Custom pageTitle appears in HTML ───────────────────────────────────

test("generateRollupStaticPageV1 uses custom pageTitle when provided", () => {
	const result = generateRollupStaticPageV1({
		rollup: makeRollup(),
		pageTitle: "My Custom Ledger Report",
	});

	assert.ok(
		result.html.includes("My Custom Ledger Report"),
		"Custom pageTitle must appear in HTML",
	);
	// Default title must NOT appear
	assert.ok(
		!result.html.includes("FlowDesk Score Ledger Summary"),
		"Default title must not appear when custom title is set",
	);
});

// ── Test 7: All four confidence bucket labels render correctly ────────────────

test("generateRollupStaticPageV1 renders all four confidence bucket display labels", () => {
	const buckets: Array<[FlowDeskLedgerRollupResultV1["confidence_bucket"], string]> = [
		["low", "Low"],
		["medium", "Medium"],
		["high", "High"],
		["very_high", "Very High"],
	];

	for (const [bucket, expectedLabel] of buckets) {
		const result = generateRollupStaticPageV1({
			rollup: makeRollup({ confidence_bucket: bucket }),
		});
		assert.ok(
			result.html.includes(expectedLabel),
			`Bucket "${bucket}" must render as "${expectedLabel}"`,
		);
		// Raw bucket key should NOT appear as a standalone data value —
		// only the display label is permitted. Note: "high" may appear as
		// part of a CSS class name; we only check the display table cell.
		// Verify the display table cell has the label, not just a CSS artifact.
		assert.ok(
			result.html.includes(`>${expectedLabel}<`),
			`Bucket "${bucket}" display label must appear in a cell: >${expectedLabel}<`,
		);
	}
});

// ── Test 8: HTML escaping on user-visible content ─────────────────────────────

test("generateRollupStaticPageV1 HTML-escapes the pageTitle against XSS", () => {
	const xssTitle = '<script>alert("xss")</script>';
	const result = generateRollupStaticPageV1({
		rollup: makeRollup(),
		pageTitle: xssTitle,
	});

	// The raw script tag must not appear unescaped
	assert.ok(
		!result.html.includes("<script>"),
		"Raw <script> tag must not appear in HTML output",
	);
	// The escaped form should appear
	assert.ok(
		result.html.includes("&lt;script&gt;"),
		"HTML-escaped form of <script> must appear",
	);
});

// ── Test 9: Default pageTitle used when none provided ─────────────────────────

test("generateRollupStaticPageV1 uses default pageTitle when none provided", () => {
	const result = generateRollupStaticPageV1({ rollup: makeRollup() });

	assert.ok(
		result.html.includes("FlowDesk Score Ledger Summary"),
		"Default pageTitle must appear when not provided",
	);
});

// ── Test 10: HTML is well-formed minimal document ─────────────────────────────

test("generateRollupStaticPageV1 produces a minimal valid HTML document structure", () => {
	const result = generateRollupStaticPageV1(makeInput());

	assert.ok(result.html.startsWith("<!DOCTYPE html>"), "Must start with DOCTYPE");
	assert.ok(result.html.includes("<html"), "Must contain <html>");
	assert.ok(result.html.includes("<head>"), "Must contain <head>");
	assert.ok(result.html.includes("<body>"), "Must contain <body>");
	assert.ok(result.html.includes("</html>"), "Must contain </html>");
	assert.ok(result.html.includes("<style>"), "Must contain inline <style>");
	// No external resource references
	assert.ok(!result.html.includes("<link"), "Must not contain <link> tags (no external CSS)");
	assert.ok(!result.html.includes("<script"), "Must not contain <script> tags");
	assert.ok(!result.html.includes("http://"), "Must not contain external http:// URLs");
	assert.ok(!result.html.includes("https://"), "Must not contain external https:// URLs");
});
