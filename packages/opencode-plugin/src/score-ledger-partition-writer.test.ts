/**
 * Tests for score-ledger-partition-writer.ts — P7-S18.
 */
import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, rmSync, writeFileSync, mkdirSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, test } from "node:test";
import {
	appendToScoreLedgerPartitionV1,
	type ScoreLedgerPartitionWriterInputV1,
} from "./score-ledger-partition-writer.js";
import {
	computeEventHashV1,
	computeChainHashV1,
	computePartitionGenesisHashV1,
	validateFlowDeskScoreLedgerManifestV1,
} from "@flowdesk/core";

// ── Test helpers ──────────────────────────────────────────────────────────────

const tempDirs: string[] = [];

function makeTempDir(): string {
	const dir = mkdtempSync(join(tmpdir(), "flowdesk-score-ledger-writer-"));
	tempDirs.push(dir);
	return dir;
}

afterEach(() => {
	for (const dir of tempDirs.splice(0)) {
		rmSync(dir, { recursive: true, force: true });
	}
});

function partitionDir(rootDir: string): string {
	return join(rootDir, ".flowdesk", "oi", "score-ledger");
}

function jsonlPath(rootDir: string, partitionId: string): string {
	return join(partitionDir(rootDir), `${partitionId}.jsonl`);
}

function manifestPath(rootDir: string, partitionId: string): string {
	return join(partitionDir(rootDir), `${partitionId}.manifest.json`);
}

function readManifest(rootDir: string, partitionId: string): Record<string, unknown> {
	const raw = readFileSync(manifestPath(rootDir, partitionId), "utf8");
	return JSON.parse(raw) as Record<string, unknown>;
}

function readJsonlLines(rootDir: string, partitionId: string): unknown[] {
	const raw = readFileSync(jsonlPath(rootDir, partitionId), "utf8");
	return raw
		.split("\n")
		.filter((line) => line.trim().length > 0)
		.map((line) => JSON.parse(line) as unknown);
}

const FIXED_PARTITION_ID = "partition-2026-06-11";
const SCHEMA_HASH =
	"sha256-abcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890";

function baseInput(
	rootDir: string,
	entry: unknown = { event: "test", value: 1 },
): ScoreLedgerPartitionWriterInputV1 {
	return {
		rootDir,
		entry,
		partitionId: FIXED_PARTITION_ID,
		schemaHash: SCHEMA_HASH,
	};
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe("appendToScoreLedgerPartitionV1", () => {
	// ── Test 1: first entry creates partition ────────────────────────────────
	test("first entry append → partition_created, entryCount=1", () => {
		const rootDir = makeTempDir();
		const entry = { event: "score.recorded", score: 0.9 };

		const result = appendToScoreLedgerPartitionV1(baseInput(rootDir, entry));

		assert.equal(result.status, "partition_created");
		assert.equal(result.partitionId, FIXED_PARTITION_ID);
		assert.equal(result.entryCount, 1);
		assert.equal(typeof result.chainHead, "string");
		assert.equal(typeof result.genesisHash, "string");
		assert.match(result.chainHead, /^sha256-[a-f0-9]{64}$/, "chainHead must be sha256-ref");
		assert.match(result.genesisHash, /^sha256-[a-f0-9]{64}$/, "genesisHash must be sha256-ref");

		// Verify files created on disk
		const lines = readJsonlLines(rootDir, FIXED_PARTITION_ID);
		assert.equal(lines.length, 1);
		assert.deepEqual(lines[0], entry);

		const manifest = readManifest(rootDir, FIXED_PARTITION_ID);
		assert.equal(manifest.schema_version, "flowdesk.score_ledger_manifest.v1");
		const validation = validateFlowDeskScoreLedgerManifestV1(manifest);
		assert.equal(validation.ok, true, validation.ok ? undefined : validation.errors.join("; "));
		const [partition] = manifest.partitions as Record<string, unknown>[];
		assert.equal(partition?.partition_id, FIXED_PARTITION_ID);
		assert.equal(partition?.state, "raw");
		assert.equal(partition?.entry_count, 1);
		assert.equal(partition?.genesis_hash, result.genesisHash);
		assert.equal(partition?.chain_head_hash, result.chainHead);
	});

	// ── Test 2: second entry increments count ────────────────────────────────
	test("second entry append → appended, entryCount=2", () => {
		const rootDir = makeTempDir();
		const entry1 = { event: "score.recorded", score: 0.8 };
		const entry2 = { event: "score.recorded", score: 0.9 };

		const r1 = appendToScoreLedgerPartitionV1(baseInput(rootDir, entry1));
		assert.equal(r1.status, "partition_created");
		assert.equal(r1.entryCount, 1);

		const r2 = appendToScoreLedgerPartitionV1(baseInput(rootDir, entry2));
		assert.equal(r2.status, "appended");
		assert.equal(r2.entryCount, 2);
		assert.equal(r2.genesisHash, r1.genesisHash, "genesis_hash must not change");
		assert.notEqual(r2.chainHead, r1.chainHead, "chainHead must change after second entry");

		const lines = readJsonlLines(rootDir, FIXED_PARTITION_ID);
		assert.equal(lines.length, 2);
		assert.deepEqual(lines[0], entry1);
		assert.deepEqual(lines[1], entry2);
	});

	// ── Test 3: chain_head_hash matches computeChainHashV1 ───────────────────
	test("chain_head_hash matches expected computeChainHashV1 result", () => {
		const rootDir = makeTempDir();
		const entry = { event: "score.recorded", score: 0.75 };

		const result = appendToScoreLedgerPartitionV1(baseInput(rootDir, entry));
		assert.equal(result.status, "partition_created");

		// Recompute expected hashes
		const expectedGenesisHash = computePartitionGenesisHashV1({
			partitionId: FIXED_PARTITION_ID,
			schemaHash: SCHEMA_HASH,
		});
		const expectedEventHash = computeEventHashV1(entry);
		const expectedChainHash = computeChainHashV1({
			eventHash: expectedEventHash,
			previousHash: expectedGenesisHash,
		});

		assert.equal(result.genesisHash, `sha256-${expectedGenesisHash}`);
		assert.equal(result.chainHead, `sha256-${expectedChainHash}`);
	});

	// ── Test 4: chain accumulates correctly over 3 entries ───────────────────
	test("chain head accumulates correctly over multiple entries", () => {
		const rootDir = makeTempDir();
		const entries = [
			{ event: "e1", v: 1 },
			{ event: "e2", v: 2 },
			{ event: "e3", v: 3 },
		];

		// Pre-compute expected chain
		const genesisHash = computePartitionGenesisHashV1({
			partitionId: FIXED_PARTITION_ID,
			schemaHash: SCHEMA_HASH,
		});

		let expectedChainHead = genesisHash;
		const results = [];
		for (const entry of entries) {
			const r = appendToScoreLedgerPartitionV1(baseInput(rootDir, entry));
			results.push(r);

			const eventHash = computeEventHashV1(entry);
			expectedChainHead = computeChainHashV1({
				eventHash,
				previousHash: expectedChainHead,
			});
		}

		// Final chain head from writer must match manually computed value
		assert.equal(results[2].chainHead, `sha256-${expectedChainHead}`);
		assert.equal(results[2].entryCount, 3);

		// All entries in jsonl
		const lines = readJsonlLines(rootDir, FIXED_PARTITION_ID);
		assert.equal(lines.length, 3);
	});

	// ── Test 5: sealed manifest → blocked ────────────────────────────────────
	test("sealed manifest → blocked", () => {
		const rootDir = makeTempDir();
		const partitionId = FIXED_PARTITION_ID;

		// Create the directory and write a sealed manifest directly
		mkdirSync(partitionDir(rootDir), { recursive: true });
		const sealedManifest = {
			schema_version: "flowdesk.score_ledger_partition.v1",
			partition_id: partitionId,
			state: "sealed",
			created_at: "2026-06-01T00:00:00.000Z",
			sealed_at: "2026-06-02T00:00:00.000Z",
			entry_count: 10,
			genesis_hash: "aabbcc".repeat(10) + "aabb",
			chain_head_hash: "ddeeff".repeat(10) + "ddee",
			schema_hash: SCHEMA_HASH,
			sealing_window_seconds: 86400,
			min_seal_threshold: 100,
			immutable_grace_period_seconds: 604800,
			advisory_only: true,
			non_authorizing: true,
			dispatch_authority_enabled: false,
			remote_write_authority_enabled: false,
		};
		writeFileSync(
			manifestPath(rootDir, partitionId),
			JSON.stringify(sealedManifest, null, 2),
			"utf8",
		);

		const result = appendToScoreLedgerPartitionV1(
			baseInput(rootDir, { event: "test" }),
		);

		assert.equal(result.status, "blocked");
		assert.ok(
			typeof result.reason === "string" && result.reason.length > 0,
			"reason must be non-empty string",
		);
		assert.ok(
			result.reason?.includes("sealed") || result.reason?.includes("raw"),
			`reason should mention state: ${result.reason}`,
		);
	});

	// ── Test 6: immutable manifest → blocked ─────────────────────────────────
	test("immutable manifest → blocked", () => {
		const rootDir = makeTempDir();
		const partitionId = FIXED_PARTITION_ID;

		mkdirSync(partitionDir(rootDir), { recursive: true });
		const immutableManifest = {
			schema_version: "flowdesk.score_ledger_partition.v1",
			partition_id: partitionId,
			state: "immutable",
			created_at: "2026-05-01T00:00:00.000Z",
			sealed_at: "2026-05-02T00:00:00.000Z",
			immutable_at: "2026-05-09T00:00:00.000Z",
			entry_count: 200,
			genesis_hash: "112233".repeat(10) + "1122",
			chain_head_hash: "445566".repeat(10) + "4455",
			schema_hash: SCHEMA_HASH,
			sealing_window_seconds: 86400,
			min_seal_threshold: 100,
			immutable_grace_period_seconds: 604800,
			advisory_only: true,
			non_authorizing: true,
			dispatch_authority_enabled: false,
			remote_write_authority_enabled: false,
		};
		writeFileSync(
			manifestPath(rootDir, partitionId),
			JSON.stringify(immutableManifest, null, 2),
			"utf8",
		);

		const result = appendToScoreLedgerPartitionV1(
			baseInput(rootDir, { event: "test" }),
		);

		assert.equal(result.status, "blocked");
		assert.ok(
			result.reason?.includes("immutable") || result.reason?.includes("raw"),
			`reason should mention state: ${result.reason}`,
		);
	});

	// ── Test 7: rootDir does not exist → blocked ──────────────────────────────
	test("rootDir missing → blocked", () => {
		const result = appendToScoreLedgerPartitionV1({
			rootDir: "/non/existent/path/that/does/not/exist",
			entry: { event: "test" },
			partitionId: FIXED_PARTITION_ID,
		});

		assert.equal(result.status, "blocked");
		assert.ok(
			typeof result.reason === "string" && result.reason.length > 0,
		);
	});

	// ── Test 8: empty rootDir string → blocked ────────────────────────────────
	test("empty rootDir string → blocked", () => {
		const result = appendToScoreLedgerPartitionV1({
			rootDir: "",
			entry: { event: "test" },
			partitionId: FIXED_PARTITION_ID,
		});
		assert.equal(result.status, "blocked");
	});

	// ── Test 9: auto partitionId defaults to date-based id ───────────────────
	test("omitting partitionId uses date-based default", () => {
		const rootDir = makeTempDir();
		const result = appendToScoreLedgerPartitionV1({
			rootDir,
			entry: { event: "test", score: 1.0 },
		});

		assert.ok(
			result.status === "partition_created" || result.status === "appended",
		);
		// partitionId should match the pattern "partition-YYYY-MM-DD"
		assert.ok(
			/^partition-\d{4}-\d{2}-\d{2}$/.test(result.partitionId),
			`expected date-based partitionId, got ${result.partitionId}`,
		);
	});

	// ── Test 10: manifest is valid FlowDeskScoreLedgerManifestV1 ─────────────
	test("manifest on disk has wrapper schema_version and authority flags", () => {
		const rootDir = makeTempDir();
		appendToScoreLedgerPartitionV1(baseInput(rootDir, { val: 42 }));

		const manifest = readManifest(rootDir, FIXED_PARTITION_ID);
		assert.equal(manifest.schema_version, "flowdesk.score_ledger_manifest.v1");
		assert.equal(manifest.advisory_only, true);
		assert.equal(manifest.dispatch_authority_enabled, false);
		const [partition] = manifest.partitions as Record<string, unknown>[];
		assert.equal(partition?.non_authorizing, true);
		assert.equal(partition?.remote_write_authority_enabled, false);
	});

	// ── Test 11: lifecycle-compatible manifest wrapper ───────────────────────
	test("writer manifest is accepted by lifecycle validator", () => {
		const rootDir = makeTempDir();
		const result = appendToScoreLedgerPartitionV1(baseInput(rootDir, { val: 43 }));
		assert.equal(result.status, "partition_created");

		const manifest = readManifest(rootDir, FIXED_PARTITION_ID);
		const validation = validateFlowDeskScoreLedgerManifestV1(manifest);
		assert.equal(validation.ok, true, validation.ok ? undefined : validation.errors.join("; "));
	});
});
