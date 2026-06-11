/**
 * Tests for routing-advisory-pipeline.ts (P7-S05 + P7-S08).
 */
import assert from "node:assert/strict";
import {
	mkdtempSync,
	mkdirSync,
	readFileSync,
	rmSync,
	writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, test } from "node:test";
import { evaluateAndRecordRoutingAdvisoryV1, filterValidLedgerEntries } from "./routing-advisory-pipeline.js";
import type { FlowDeskRoutingAdvisoryLedgerEntryV1 } from "@flowdesk/core";

// ── Test helpers ──────────────────────────────────────────────────────────────

const tempDirs: string[] = [];

function makeTempDir(): string {
	const dir = mkdtempSync(join(tmpdir(), "flowdesk-rai-pipeline-"));
	tempDirs.push(dir);
	return dir;
}

afterEach(() => {
	for (const dir of tempDirs.splice(0)) {
		rmSync(dir, { recursive: true, force: true });
	}
});

function ledgerPath(rootDir: string): string {
	return join(rootDir, ".flowdesk", "oi", "routing-advisory.jsonl");
}

function seedLedger(
	rootDir: string,
	entries: FlowDeskRoutingAdvisoryLedgerEntryV1[],
): void {
	mkdirSync(join(rootDir, ".flowdesk", "oi"), { recursive: true });
	const jsonl = entries.map((e) => JSON.stringify(e)).join("\n") + "\n";
	writeFileSync(ledgerPath(rootDir), jsonl, "utf8");
}

function readLedgerLines(rootDir: string): FlowDeskRoutingAdvisoryLedgerEntryV1[] {
	const path = ledgerPath(rootDir);
	const content = readFileSync(path, "utf8");
	return content
		.split("\n")
		.filter((line) => line.trim().length > 0)
		.map((line) => JSON.parse(line) as FlowDeskRoutingAdvisoryLedgerEntryV1);
}

function makeEntry(
	overrides: Partial<FlowDeskRoutingAdvisoryLedgerEntryV1> = {},
): FlowDeskRoutingAdvisoryLedgerEntryV1 {
	return {
		signature_ref: "signature-default",
		model_ref: "model-ref-test",
		weighted_score: 0.8,
		recorded_at: "2026-01-01T00:00:00.000Z",
		...overrides,
	};
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe("evaluateAndRecordRoutingAdvisoryV1", () => {
	// ── Test 1: skipped_no_rootdir ──────────────────────────────────────────

	test("returns skipped_no_rootdir when rootDir is empty string", () => {
		const result = evaluateAndRecordRoutingAdvisoryV1({
			workflowId: "workflow-test-1",
			taskId: "task-001",
			rootDir: "",
			currentScore: 75,
		});
		assert.equal(result.status, "skipped_no_rootdir");
		assert.equal(result.advisory_only, true);
		assert.equal(result.dispatch_authority_enabled, false);
	});

	test("returns skipped_no_rootdir when rootDir is whitespace only", () => {
		const result = evaluateAndRecordRoutingAdvisoryV1({
			workflowId: "workflow-test-2",
			taskId: "task-002",
			rootDir: "   ",
			currentScore: 50,
		});
		assert.equal(result.status, "skipped_no_rootdir");
		assert.equal(result.advisory_only, true);
		assert.equal(result.dispatch_authority_enabled, false);
	});

	// ── Test 2: skipped_no_score ────────────────────────────────────────────

	test("returns skipped_no_score when currentScore is undefined", () => {
		const rootDir = makeTempDir();
		const result = evaluateAndRecordRoutingAdvisoryV1({
			workflowId: "workflow-test-3",
			taskId: "task-003",
			rootDir,
			// currentScore intentionally omitted
		});
		assert.equal(result.status, "skipped_no_score");
		assert.equal(result.advisory_only, true);
		assert.equal(result.dispatch_authority_enabled, false);
	});

	test("returns skipped_no_score when currentScore is NaN", () => {
		const rootDir = makeTempDir();
		const result = evaluateAndRecordRoutingAdvisoryV1({
			workflowId: "workflow-test-4",
			taskId: "task-004",
			rootDir,
			currentScore: NaN,
		});
		assert.equal(result.status, "skipped_no_score");
		assert.equal(result.advisory_only, true);
		assert.equal(result.dispatch_authority_enabled, false);
	});

	// ── Test 3: gate recompute → new_advisory_appended (no prior entries) ───

	test("appends new entry when no prior ledger entries exist (minSampleCount not met)", () => {
		const rootDir = makeTempDir();
		const result = evaluateAndRecordRoutingAdvisoryV1({
			workflowId: "workflow-test-5",
			taskId: "task-005",
			rootDir,
			currentScore: 80,
			signatureRef: "signature-test-5",
			now: "2026-06-11T00:00:00.000Z",
		});
		assert.equal(result.status, "new_advisory_appended");
		assert.equal(result.gateDecision, "recompute");
		assert.equal(result.advisory_only, true);
		assert.equal(result.dispatch_authority_enabled, false);

		// Verify the entry was written
		const lines = readLedgerLines(rootDir);
		assert.ok(lines.length >= 1, "at least one entry should have been written");
		const written = lines.find((e) => e.signature_ref === "signature-test-5");
		assert.ok(written !== undefined, "entry with matching signature_ref expected");
		// weighted_score should be currentScore / 100 = 0.8
		assert.ok(
			Math.abs((written?.weighted_score ?? 0) - 0.8) < 0.001,
			`expected weighted_score ~0.8, got ${written?.weighted_score}`,
		);
	});

	// ── Test 4: gate reuse → reuse_advisory, append NOT called ─────────────

	test("returns reuse_advisory and does NOT append when gate decides reuse", () => {
		const rootDir = makeTempDir();
		const now = "2026-06-11T12:00:00.000Z";
		// Seed enough entries (>= minSampleCount=3) with matching context hash
		// and recent timestamps so the gate will decide "reuse".
		// Since createFlowDeskScoreReuseThresholdGateV1 requires contextMatch AND
		// withinAgeThreshold AND aboveMinScore for "reuse", we ensure:
		//   - context_hash on entries matches currentContextHash
		//   - timestamps are very recent (within maxAgeThresholdSeconds)
		//   - weighted_score * 100 > 0 (above min_score_threshold)
		const recentTime = new Date(
			Date.parse(now) - 60 * 1000, // 60 seconds ago
		).toISOString();
		const entries: (FlowDeskRoutingAdvisoryLedgerEntryV1 & { context_hash?: string })[] = [
			{ ...makeEntry({ signature_ref: "signature-reuse", recorded_at: recentTime, weighted_score: 0.85 }), context_hash: "hash-match-ctx" },
			{ ...makeEntry({ signature_ref: "signature-reuse", recorded_at: recentTime, model_ref: "model-ref-b", weighted_score: 0.80 }), context_hash: "hash-match-ctx" },
			{ ...makeEntry({ signature_ref: "signature-reuse", recorded_at: recentTime, model_ref: "model-ref-c", weighted_score: 0.75 }), context_hash: "hash-match-ctx" },
		];
		// Use different recorded_at to avoid dedup
		entries[1] = { ...entries[1], recorded_at: new Date(Date.parse(recentTime) - 1000).toISOString() };
		entries[2] = { ...entries[2], recorded_at: new Date(Date.parse(recentTime) - 2000).toISOString() };
		seedLedger(rootDir, entries as FlowDeskRoutingAdvisoryLedgerEntryV1[]);

		const countBefore = readLedgerLines(rootDir).length;

		const result = evaluateAndRecordRoutingAdvisoryV1({
			workflowId: "workflow-reuse",
			taskId: "task-reuse",
			rootDir,
			currentScore: 85,
			signatureRef: "signature-reuse",
			currentContextHash: "hash-match-ctx",
			maxAgeThresholdSeconds: 3600, // 1 hour — entries are 60s old
			minSampleCount: 3,
			now,
		});

		assert.equal(result.status, "reuse_advisory");
		assert.equal(result.gateDecision, "reuse");
		assert.equal(result.advisory_only, true);
		assert.equal(result.dispatch_authority_enabled, false);

		// Ledger must NOT have been appended
		const countAfter = readLedgerLines(rootDir).length;
		assert.equal(
			countAfter,
			countBefore,
			`ledger should not be modified on reuse (before=${countBefore}, after=${countAfter})`,
		);
	});

	// ── Test 5: gate recompute → new_advisory_appended (stale context) ──────

	test("appends new entry when context hash does not match (gate recompute)", () => {
		const rootDir = makeTempDir();
		const now = "2026-06-11T12:00:00.000Z";
		const recentTime = new Date(Date.parse(now) - 30 * 1000).toISOString();

		// Seed entries with a DIFFERENT context hash → context_match=false → recompute
		const entries: (FlowDeskRoutingAdvisoryLedgerEntryV1 & { context_hash?: string })[] = [
			{ ...makeEntry({ signature_ref: "signature-ctx-mismatch", recorded_at: recentTime }), context_hash: "hash-old-ctx" },
			{ ...makeEntry({ signature_ref: "signature-ctx-mismatch", model_ref: "model-ref-b", recorded_at: new Date(Date.parse(recentTime) - 1000).toISOString() }), context_hash: "hash-old-ctx" },
			{ ...makeEntry({ signature_ref: "signature-ctx-mismatch", model_ref: "model-ref-c", recorded_at: new Date(Date.parse(recentTime) - 2000).toISOString() }), context_hash: "hash-old-ctx" },
		];
		seedLedger(rootDir, entries as FlowDeskRoutingAdvisoryLedgerEntryV1[]);
		const countBefore = readLedgerLines(rootDir).length;

		const result = evaluateAndRecordRoutingAdvisoryV1({
			workflowId: "workflow-ctx-mismatch",
			taskId: "task-ctx-mismatch",
			rootDir,
			currentScore: 70,
			signatureRef: "signature-ctx-mismatch",
			currentContextHash: "hash-new-ctx", // different from seeded "hash-old-ctx"
			maxAgeThresholdSeconds: 3600,
			minSampleCount: 3,
			now,
		});

		assert.equal(result.status, "new_advisory_appended");
		assert.equal(result.gateDecision, "recompute");
		assert.equal(result.advisory_only, true);
		assert.equal(result.dispatch_authority_enabled, false);

		// Ledger should have grown by 1
		const countAfter = readLedgerLines(rootDir).length;
		assert.equal(countAfter, countBefore + 1, `expected ${countBefore + 1} entries, got ${countAfter}`);
	});

	// ── Test 6: authority flags always false ─────────────────────────────────

	test("authority flags are always false for all result statuses", () => {
		const rootDir = makeTempDir();

		// Test skipped_no_rootdir
		const r1 = evaluateAndRecordRoutingAdvisoryV1({
			workflowId: "wf-auth-1", taskId: "t-1", rootDir: "", currentScore: 50,
		});
		assert.equal(r1.advisory_only, true);
		assert.equal(r1.dispatch_authority_enabled, false);

		// Test skipped_no_score
		const r2 = evaluateAndRecordRoutingAdvisoryV1({
			workflowId: "wf-auth-2", taskId: "t-2", rootDir,
		});
		assert.equal(r2.advisory_only, true);
		assert.equal(r2.dispatch_authority_enabled, false);

		// Test new_advisory_appended
		const r3 = evaluateAndRecordRoutingAdvisoryV1({
			workflowId: "wf-auth-3", taskId: "t-3", rootDir, currentScore: 60,
		});
		assert.equal(r3.advisory_only, true);
		assert.equal(r3.dispatch_authority_enabled, false);
	});

	// ── Test 7: recompute when minSampleCount not met even with valid entry ──

	test("always recomputes (appends) when sample count < minSampleCount", () => {
		const rootDir = makeTempDir();
		const now = "2026-06-11T10:00:00.000Z";
		const recentTime = new Date(Date.parse(now) - 10 * 1000).toISOString();

		// Only 2 entries but minSampleCount=3 → must recompute
		const entries: (FlowDeskRoutingAdvisoryLedgerEntryV1 & { context_hash?: string })[] = [
			{ ...makeEntry({ signature_ref: "signature-minsample", recorded_at: recentTime }), context_hash: "hash-same-ctx" },
			{ ...makeEntry({ signature_ref: "signature-minsample", model_ref: "model-ref-b", recorded_at: new Date(Date.parse(recentTime) - 500).toISOString() }), context_hash: "hash-same-ctx" },
		];
		seedLedger(rootDir, entries as FlowDeskRoutingAdvisoryLedgerEntryV1[]);
		const countBefore = readLedgerLines(rootDir).length;

		const result = evaluateAndRecordRoutingAdvisoryV1({
			workflowId: "workflow-minsample",
			taskId: "task-minsample",
			rootDir,
			currentScore: 90,
			signatureRef: "signature-minsample",
			currentContextHash: "hash-same-ctx",
			maxAgeThresholdSeconds: 3600,
			minSampleCount: 3, // need 3, only have 2
			now,
		});

		assert.equal(result.status, "new_advisory_appended");
		assert.equal(result.gateDecision, "recompute");
		assert.equal(result.advisory_only, true);
		assert.equal(result.dispatch_authority_enabled, false);
		assert.equal(readLedgerLines(rootDir).length, countBefore + 1);
	});

	// ── Test 8: recompute when age threshold exceeded ────────────────────────

	test("recomputes when ledger entry is older than maxAgeThresholdSeconds", () => {
		const rootDir = makeTempDir();
		const now = "2026-06-11T10:00:00.000Z";
		// Entries are 2 hours old but maxAgeThresholdSeconds = 3600 (1h)
		const oldTime = new Date(Date.parse(now) - 2 * 3600 * 1000).toISOString();

		const entries: (FlowDeskRoutingAdvisoryLedgerEntryV1 & { context_hash?: string })[] = [
			{ ...makeEntry({ signature_ref: "signature-stale", recorded_at: oldTime }), context_hash: "hash-same" },
			{ ...makeEntry({ signature_ref: "signature-stale", model_ref: "model-ref-b", recorded_at: new Date(Date.parse(oldTime) - 500).toISOString() }), context_hash: "hash-same" },
			{ ...makeEntry({ signature_ref: "signature-stale", model_ref: "model-ref-c", recorded_at: new Date(Date.parse(oldTime) - 1000).toISOString() }), context_hash: "hash-same" },
		];
		seedLedger(rootDir, entries as FlowDeskRoutingAdvisoryLedgerEntryV1[]);
		const countBefore = readLedgerLines(rootDir).length;

		const result = evaluateAndRecordRoutingAdvisoryV1({
			workflowId: "workflow-stale",
			taskId: "task-stale",
			rootDir,
			currentScore: 75,
			signatureRef: "signature-stale",
			currentContextHash: "hash-same",
			maxAgeThresholdSeconds: 3600, // 1h, but entries are 2h old
			minSampleCount: 3,
			now,
		});

		assert.equal(result.status, "new_advisory_appended");
		assert.equal(result.gateDecision, "recompute");
		assert.equal(result.advisory_only, true);
		assert.equal(result.dispatch_authority_enabled, false);
		assert.equal(readLedgerLines(rootDir).length, countBefore + 1);
	});

	// ── Test 9: ledgerEntryCount reflects current state ───────────────────────

	test("ledgerEntryCount reflects state before and after append", () => {
		const rootDir = makeTempDir();
		const now = "2026-06-11T12:00:00.000Z";

		// No prior entries
		const result1 = evaluateAndRecordRoutingAdvisoryV1({
			workflowId: "workflow-count-1",
			taskId: "task-count-1",
			rootDir,
			currentScore: 65,
			signatureRef: "signature-count",
			now,
		});
		assert.equal(result1.status, "new_advisory_appended");
		assert.equal(result1.ledgerEntryCount, 1, "ledgerEntryCount should be 1 after first append");

		// Second append
		const result2 = evaluateAndRecordRoutingAdvisoryV1({
			workflowId: "workflow-count-2",
			taskId: "task-count-2",
			rootDir,
			currentScore: 70,
			signatureRef: "signature-count",
			now: new Date(Date.parse(now) + 1000).toISOString(),
		});
		assert.equal(result2.status, "new_advisory_appended");
		assert.ok(
			(result2.ledgerEntryCount ?? 0) >= 2,
			`expected ledgerEntryCount >= 2, got ${result2.ledgerEntryCount}`,
		);
	});
});

// ── P7-S08: filterValidLedgerEntries fail-closed gate tests ────────────────────

describe("filterValidLedgerEntries (P7-S08 fail-closed gate)", () => {
	// ── Test S08-1: malformed entry is excluded, valid entries pass through ───
	// Note: loadRoutingAdvisoryLedgerV1 already filters truly malformed JSONL entries
	// (missing required fields, non-string types) via decodeFlowDeskRoutingAdvisoryLedgerJsonlV1.
	// filterValidLedgerEntries adds an additional layer for entries that pass basic
	// parsing but have semantic issues (out-of-range scores, forbidden payloads,
	// schema_hash mismatches).
	//
	// We test filterValidLedgerEntries directly with schema-invalid entries and also
	// verify that out-of-range weighted_score entries (which pass the loader's
	// structural check) are excluded by filterValidLedgerEntries.

	test("malformed entries are excluded and valid entries pass through (unit-level filter test)", () => {
		const validEntry = makeEntry({ signature_ref: "signature-s08", weighted_score: 0.75 });
		// Malformed: weighted_score is not a number (directly calling filter, bypassing loader)
		const malformedEntry = {
			signature_ref: "signature-s08",
			model_ref: "model-ref-bad",
			weighted_score: "not-a-number", // invalid type — caught by schema validation
			recorded_at: "2026-01-01T00:00:00.000Z",
		} as unknown as FlowDeskRoutingAdvisoryLedgerEntryV1;

		// Direct unit test of filterValidLedgerEntries
		const directResult = filterValidLedgerEntries([validEntry, malformedEntry]);
		assert.equal(directResult.valid.length, 1, "only 1 valid entry expected");
		assert.equal(directResult.excluded.length, 1, "1 excluded entry expected");
		assert.equal(directResult.excluded[0]?.reason, "schema_validation_failed", "exclusion reason must be schema_validation_failed");
		assert.equal(directResult.excluded[0]?.index, 1, "excluded index must be 1");
		assert.deepEqual(directResult.valid[0], validEntry, "valid entry must pass through unchanged");

		// Pipeline integration: out-of-range weighted_score passes loader but is caught
		// by filterValidLedgerEntries (weighted_score: 1.5 → advisory_score 150 > 100)
		const rootDir = makeTempDir();
		const now = "2026-06-11T12:00:00.000Z";
		// Seed valid-structured but out-of-range score entries (pass disk loader, fail filter)
		const outOfRangeEntry = makeEntry({
			signature_ref: "signature-s08-oor",
			weighted_score: 1.5, // 1.5 * 100 = 150 > 100 → score_out_of_range
		});
		seedLedger(rootDir, [outOfRangeEntry]);

		const pipelineResult = evaluateAndRecordRoutingAdvisoryV1({
			workflowId: "workflow-s08-1",
			taskId: "task-s08-1",
			rootDir,
			currentScore: 75,
			signatureRef: "signature-s08-oor",
			now,
		});
		// Pipeline should proceed and report excludedEntryCount=1
		assert.ok(
			pipelineResult.status === "new_advisory_appended" || pipelineResult.status === "reuse_advisory",
			`expected pipeline to proceed, got ${pipelineResult.status}`,
		);
		assert.equal(
			pipelineResult.excludedEntryCount,
			1,
			`expected excludedEntryCount=1, got ${pipelineResult.excludedEntryCount}`,
		);
		assert.ok(
			Array.isArray(pipelineResult.excludedReasons) && pipelineResult.excludedReasons.includes("score_out_of_range"),
			`excludedReasons should include score_out_of_range, got ${JSON.stringify(pipelineResult.excludedReasons)}`,
		);
	});

	// ── Test S08-2: schema_hash mismatch entry is excluded ───────────────────

	test("entry with schema_hash mismatch is excluded when schemaHash option is provided", () => {
		const matchingEntry: FlowDeskRoutingAdvisoryLedgerEntryV1 & { schema_hash?: string } = {
			...makeEntry({ signature_ref: "signature-hash-check", weighted_score: 0.6 }),
			schema_hash: "hash-correct-schema",
		};
		const mismatchEntry: FlowDeskRoutingAdvisoryLedgerEntryV1 & { schema_hash?: string } = {
			...makeEntry({ signature_ref: "signature-hash-check", model_ref: "model-ref-b", weighted_score: 0.7 }),
			schema_hash: "hash-wrong-schema", // different from expected
		};
		const noHashEntry = makeEntry({ signature_ref: "signature-hash-check", model_ref: "model-ref-c" });

		const result = filterValidLedgerEntries(
			[matchingEntry, mismatchEntry, noHashEntry] as FlowDeskRoutingAdvisoryLedgerEntryV1[],
			{ schemaHash: "hash-correct-schema" },
		);

		// matchingEntry: schema_hash matches → valid
		// mismatchEntry: schema_hash doesn't match → excluded
		// noHashEntry: no schema_hash field → not checked → valid
		assert.equal(result.valid.length, 2, "expected 2 valid entries (matching + no-hash)");
		assert.equal(result.excluded.length, 1, "expected 1 excluded entry (mismatch)");
		assert.equal(result.excluded[0]?.reason, "schema_hash_mismatch", "exclusion reason must be schema_hash_mismatch");
		assert.equal(result.excluded[0]?.index, 1, "excluded index must be 1 (the mismatch entry)");
	});

	// ── Test S08-3: all entries excluded → pipeline forced to recompute ────────
	// Seeds entries with out-of-range weighted_score (e.g. 5.0 → 500 > 100).
	// These pass decodeFlowDeskRoutingAdvisoryLedgerJsonlV1 (only checks finite number)
	// but are excluded by filterValidLedgerEntries' range check.
	// With 0 valid samples < minSampleCount=3, the pipeline must recompute (fail-closed).

	test("when all entries are excluded (out-of-range scores), pipeline forces recompute (fail-closed)", () => {
		const rootDir = makeTempDir();
		const now = "2026-06-11T12:00:00.000Z";

		// Seed 3 entries with out-of-range weighted_score:
		// weighted_score = 5.0 → advisory_score = 500, which is > 100 → score_out_of_range
		// These pass the JSONL loader (finite number) but fail filterValidLedgerEntries.
		const entries: FlowDeskRoutingAdvisoryLedgerEntryV1[] = [
			makeEntry({ signature_ref: "signature-failclosed", weighted_score: 5.0, recorded_at: new Date(Date.parse(now) - 10000).toISOString() }),
			makeEntry({ signature_ref: "signature-failclosed", model_ref: "model-ref-b", weighted_score: 3.0, recorded_at: new Date(Date.parse(now) - 20000).toISOString() }),
			makeEntry({ signature_ref: "signature-failclosed", model_ref: "model-ref-c", weighted_score: 2.5, recorded_at: new Date(Date.parse(now) - 30000).toISOString() }),
		];
		seedLedger(rootDir, entries);

		const result = evaluateAndRecordRoutingAdvisoryV1({
			workflowId: "workflow-failclosed",
			taskId: "task-failclosed",
			rootDir,
			currentScore: 80,
			signatureRef: "signature-failclosed",
			currentContextHash: "hash-context-fc",
			maxAgeThresholdSeconds: 3600,
			minSampleCount: 3,
			now,
		});

		// All 3 entries excluded → 0 valid signature entries < minSampleCount=3 → recompute
		assert.equal(result.status, "new_advisory_appended", "fail-closed: all excluded must force recompute");
		assert.equal(result.gateDecision, "recompute", "gate decision must be recompute");
		assert.equal(result.excludedEntryCount, 3, "all 3 entries must be excluded");
		assert.ok(
			Array.isArray(result.excludedReasons) && result.excludedReasons.includes("score_out_of_range"),
			`excludedReasons should include score_out_of_range, got ${JSON.stringify(result.excludedReasons)}`,
		);
		assert.equal(result.advisory_only, true);
		assert.equal(result.dispatch_authority_enabled, false);
	});
});
