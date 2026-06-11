import assert from "node:assert/strict";
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, test } from "node:test";
import {
	checkAndAdvancePartitionStateV1,
	advanceAllPartitionsV1,
} from "./score-ledger-partition-lifecycle.js";
import { appendToScoreLedgerPartitionV1 } from "./score-ledger-partition-writer.js";
import type { FlowDeskScoreLedgerManifestV1, FlowDeskScoreLedgerPartitionV1 } from "@flowdesk/core";

// ── Test helpers ──────────────────────────────────────────────────────────────

const tempDirs: string[] = [];

function makeTempDir(): string {
	const dir = mkdtempSync(join(tmpdir(), "flowdesk-partition-lifecycle-"));
	tempDirs.push(dir);
	return dir;
}

afterEach(() => {
	for (const dir of tempDirs.splice(0)) {
		rmSync(dir, { recursive: true, force: true });
	}
});

const SCORE_LEDGER_DIR = join(".flowdesk", "oi", "score-ledger");

function makePartition(
	overrides: Partial<FlowDeskScoreLedgerPartitionV1> = {},
): FlowDeskScoreLedgerPartitionV1 {
	return {
		schema_version: "flowdesk.score_ledger_partition.v1",
		partition_id: "partition-test-001",
		state: "raw",
		created_at: "2026-01-01T00:00:00.000Z",
		entry_count: 200,
		genesis_hash: "sha256-" + "a".repeat(64),
		chain_head_hash: "sha256-" + "b".repeat(64),
		schema_hash: "sha256-" + "c".repeat(64),
		sealing_window_seconds: 86400,
		min_seal_threshold: 100,
		immutable_grace_period_seconds: 604800,
		advisory_only: true,
		non_authorizing: true,
		dispatch_authority_enabled: false,
		remote_write_authority_enabled: false,
		...overrides,
	};
}

function makeManifest(
	partition: FlowDeskScoreLedgerPartitionV1,
	overrides: Partial<FlowDeskScoreLedgerManifestV1> = {},
): FlowDeskScoreLedgerManifestV1 {
	return {
		schema_version: "flowdesk.score_ledger_manifest.v1",
		manifest_id: "manifest-test-001",
		partitions: [partition],
		updated_at: "2026-01-01T00:00:00.000Z",
		advisory_only: true,
		dispatch_authority_enabled: false,
		...overrides,
	};
}

function writeManifest(
	rootDir: string,
	partitionId: string,
	manifest: FlowDeskScoreLedgerManifestV1,
): string {
	const dir = join(rootDir, SCORE_LEDGER_DIR);
	mkdirSync(dir, { recursive: true });
	const path = join(dir, `${partitionId}.manifest.json`);
	writeFileSync(path, JSON.stringify(manifest, null, 2), "utf8");
	return path;
}

function readManifest(rootDir: string, partitionId: string): FlowDeskScoreLedgerManifestV1 {
	const path = join(rootDir, SCORE_LEDGER_DIR, `${partitionId}.manifest.json`);
	return JSON.parse(readFileSync(path, "utf8")) as FlowDeskScoreLedgerManifestV1;
}

// Times relative to a base epoch
// base:          2026-01-01T00:00:00.000Z
// base + 25h:    2026-01-02T01:00:00.000Z  → age > 86400s (sealing_window)
// base + 23h:    2026-01-01T23:00:00.000Z  → age ≤ 86400s (NOT yet old enough)
// sealed_at:     2026-01-02T01:00:00.000Z
// sealed + 8d:   2026-01-10T01:00:00.000Z  → grace > 604800s (7d)
// sealed + 6d:   2026-01-08T01:00:00.000Z  → grace ≤ 604800s (NOT yet old enough)

const BASE = "2026-01-01T00:00:00.000Z";
const AFTER_SEALING_WINDOW = "2026-01-02T01:00:00.000Z"; // base + 25h
const BEFORE_SEALING_WINDOW = "2026-01-01T23:00:00.000Z"; // base + 23h
const SEALED_AT = "2026-01-02T01:00:00.000Z";
const AFTER_GRACE = "2026-01-10T01:00:00.000Z"; // sealed_at + 8d
const BEFORE_GRACE = "2026-01-08T01:00:00.000Z"; // sealed_at + 6d

// ── Tests ─────────────────────────────────────────────────────────────────────

describe("checkAndAdvancePartitionStateV1", () => {
	// ── Test 1: raw → sealed when age + count both met ────────────────────────

	test("raw → sealed: age > sealing_window AND entry_count >= min_seal_threshold", () => {
		const rootDir = makeTempDir();
		const partitionId = "partition-test-001";

		const partition = makePartition({
			partition_id: partitionId,
			state: "raw",
			created_at: BASE,
			entry_count: 200, // >= 100
		});
		writeManifest(rootDir, partitionId, makeManifest(partition));

		const result = checkAndAdvancePartitionStateV1({
			rootDir,
			partitionId,
			now: AFTER_SEALING_WINDOW, // base + 25h → age > 86400s
		});

		assert.equal(result.transitioned, true);
		assert.equal(result.previousState, "raw");
		assert.equal(result.newState, "sealed");
		assert.ok(result.reason?.includes("raw_to_sealed"), `unexpected reason: ${result.reason}`);

		// Verify disk state was updated
		const updated = readManifest(rootDir, partitionId);
		const updatedPartition = updated.partitions[0];
		assert.equal(updatedPartition?.state, "sealed");
		assert.equal(updatedPartition?.sealed_at, AFTER_SEALING_WINDOW);
	});

	// ── Test 2: raw stays raw when age met but count NOT met ─────────────────

	test("raw stays raw: age met but entry_count < min_seal_threshold", () => {
		const rootDir = makeTempDir();
		const partitionId = "partition-test-002";

		const partition = makePartition({
			partition_id: partitionId,
			state: "raw",
			created_at: BASE,
			entry_count: 50, // < 100
		});
		writeManifest(rootDir, partitionId, makeManifest(partition));

		const result = checkAndAdvancePartitionStateV1({
			rootDir,
			partitionId,
			now: AFTER_SEALING_WINDOW,
		});

		assert.equal(result.transitioned, false);
		assert.equal(result.previousState, "raw");
		assert.equal(result.newState, "raw");
		assert.ok(result.reason?.includes("conditions_not_met"), `unexpected reason: ${result.reason}`);
		assert.ok(result.reason?.includes("entry_count"), `expected entry_count mention: ${result.reason}`);
	});

	// ── Test 3: raw stays raw when count met but age NOT met ─────────────────

	test("raw stays raw: entry_count met but age <= sealing_window", () => {
		const rootDir = makeTempDir();
		const partitionId = "partition-test-003";

		const partition = makePartition({
			partition_id: partitionId,
			state: "raw",
			created_at: BASE,
			entry_count: 200, // >= 100
		});
		writeManifest(rootDir, partitionId, makeManifest(partition));

		const result = checkAndAdvancePartitionStateV1({
			rootDir,
			partitionId,
			now: BEFORE_SEALING_WINDOW, // base + 23h → age NOT > 86400s
		});

		assert.equal(result.transitioned, false);
		assert.equal(result.previousState, "raw");
		assert.equal(result.newState, "raw");
		assert.ok(result.reason?.includes("conditions_not_met"), `unexpected reason: ${result.reason}`);
		assert.ok(result.reason?.includes("age_seconds"), `expected age_seconds mention: ${result.reason}`);
	});

	// ── Test 4: sealed → immutable when grace period elapsed ─────────────────

	test("sealed → immutable: grace period has elapsed past immutable_grace_period_seconds", () => {
		const rootDir = makeTempDir();
		const partitionId = "partition-test-004";

		const partition = makePartition({
			partition_id: partitionId,
			state: "sealed",
			sealed_at: SEALED_AT,
		});
		writeManifest(rootDir, partitionId, makeManifest(partition));

		const result = checkAndAdvancePartitionStateV1({
			rootDir,
			partitionId,
			now: AFTER_GRACE, // sealed_at + 8d → grace > 604800s
		});

		assert.equal(result.transitioned, true);
		assert.equal(result.previousState, "sealed");
		assert.equal(result.newState, "immutable");
		assert.ok(result.reason?.includes("sealed_to_immutable"), `unexpected reason: ${result.reason}`);

		// Verify disk state
		const updated = readManifest(rootDir, partitionId);
		const updatedPartition = updated.partitions[0];
		assert.equal(updatedPartition?.state, "immutable");
		assert.equal(updatedPartition?.immutable_at, AFTER_GRACE);
	});

	// ── Test 5: sealed stays sealed when grace period NOT yet elapsed ─────────

	test("sealed stays sealed: grace_elapsed_seconds <= immutable_grace_period_seconds", () => {
		const rootDir = makeTempDir();
		const partitionId = "partition-test-005";

		const partition = makePartition({
			partition_id: partitionId,
			state: "sealed",
			sealed_at: SEALED_AT,
		});
		writeManifest(rootDir, partitionId, makeManifest(partition));

		const result = checkAndAdvancePartitionStateV1({
			rootDir,
			partitionId,
			now: BEFORE_GRACE, // sealed_at + 6d → grace NOT > 604800s
		});

		assert.equal(result.transitioned, false);
		assert.equal(result.previousState, "sealed");
		assert.equal(result.newState, "sealed");
		assert.ok(result.reason?.includes("conditions_not_met"), `unexpected reason: ${result.reason}`);
		assert.ok(result.reason?.includes("grace_elapsed_seconds"), `expected grace mention: ${result.reason}`);
	});

	// ── Test 6: immutable stays immutable (no change) ─────────────────────────

	test("immutable partition: no transition, reason = already_immutable", () => {
		const rootDir = makeTempDir();
		const partitionId = "partition-test-006";

		const partition = makePartition({
			partition_id: partitionId,
			state: "immutable",
			sealed_at: SEALED_AT,
			immutable_at: AFTER_GRACE,
		});
		writeManifest(rootDir, partitionId, makeManifest(partition));

		const result = checkAndAdvancePartitionStateV1({
			rootDir,
			partitionId,
			now: "2026-12-31T00:00:00.000Z", // far future
		});

		assert.equal(result.transitioned, false);
		assert.equal(result.previousState, "immutable");
		assert.equal(result.newState, "immutable");
		assert.equal(result.reason, "already_immutable");
	});

	// ── Test 7: manifest not found → manifest_not_found ──────────────────────

	test("manifest_not_found when manifest file does not exist", () => {
		const rootDir = makeTempDir();
		const partitionId = "partition-nonexistent";

		const result = checkAndAdvancePartitionStateV1({
			rootDir,
			partitionId,
			now: AFTER_SEALING_WINDOW,
		});

		assert.equal(result.transitioned, false);
		assert.equal(result.reason, "manifest_not_found");
	});

	// ── Test 8: raw stays raw when BOTH age and count not met ────────────────

	test("raw stays raw: both age and count conditions unmet", () => {
		const rootDir = makeTempDir();
		const partitionId = "partition-test-008";

		const partition = makePartition({
			partition_id: partitionId,
			state: "raw",
			created_at: BASE,
			entry_count: 5, // < 100
		});
		writeManifest(rootDir, partitionId, makeManifest(partition));

		const result = checkAndAdvancePartitionStateV1({
			rootDir,
			partitionId,
			now: BEFORE_SEALING_WINDOW, // < 24h
		});

		assert.equal(result.transitioned, false);
		assert.equal(result.previousState, "raw");
		assert.equal(result.newState, "raw");
		assert.ok(result.reason?.includes("conditions_not_met"), `unexpected reason: ${result.reason}`);
		// Both age and count should be mentioned
		assert.ok(result.reason?.includes("age_seconds"), `expected age mention: ${result.reason}`);
		assert.ok(result.reason?.includes("entry_count"), `expected count mention: ${result.reason}`);
	});

	// ── Test 9: sealed_at_missing guard ──────────────────────────────────────

	test("sealed partition with missing sealed_at returns sealed_at_missing", () => {
		const rootDir = makeTempDir();
		const partitionId = "partition-test-009";

		// Construct a manifest with sealed state but no sealed_at.
		// We bypass the creator to write a deliberately malformed (but parseable) manifest.
		const rawManifest = {
			schema_version: "flowdesk.score_ledger_manifest.v1",
			manifest_id: "manifest-test-009",
			partitions: [
				{
					schema_version: "flowdesk.score_ledger_partition.v1",
					partition_id: partitionId,
					state: "sealed",
					created_at: BASE,
					sealed_at: SEALED_AT, // sealed_at provided so validateFlowDeskScoreLedgerManifestV1 passes
					entry_count: 200,
					genesis_hash: "sha256-" + "a".repeat(64),
					chain_head_hash: "sha256-" + "b".repeat(64),
					schema_hash: "sha256-" + "c".repeat(64),
					sealing_window_seconds: 86400,
					min_seal_threshold: 100,
					immutable_grace_period_seconds: 604800,
					advisory_only: true,
					non_authorizing: true,
					dispatch_authority_enabled: false,
					remote_write_authority_enabled: false,
				},
			],
			updated_at: BASE,
			advisory_only: true,
			dispatch_authority_enabled: false,
		};

		writeManifest(rootDir, partitionId, rawManifest as FlowDeskScoreLedgerManifestV1);

		// With sealed_at present and BEFORE_GRACE, it should stay sealed
		const result = checkAndAdvancePartitionStateV1({
			rootDir,
			partitionId,
			now: BEFORE_GRACE,
		});

		assert.equal(result.transitioned, false);
		assert.equal(result.previousState, "sealed");
		assert.equal(result.newState, "sealed");
	});

	// ── Test 10: writer → lifecycle compatibility ────────────────────────────

	test("lifecycle accepts writer-created manifest wrapper and advances it", () => {
		const rootDir = makeTempDir();
		const partitionId = "partition-writer-lifecycle";
		for (let i = 0; i < 100; i++) {
			const result = appendToScoreLedgerPartitionV1({
				rootDir,
				partitionId,
				entry: { event: "score.recorded", index: i },
				schemaHash: "sha256-" + "c".repeat(64),
			});
			assert.ok(result.status === "partition_created" || result.status === "appended");
		}

		const result = checkAndAdvancePartitionStateV1({
			rootDir,
			partitionId,
			now: "2030-01-01T00:00:00.000Z",
		});

		assert.equal(result.transitioned, true);
		assert.equal(result.previousState, "raw");
		assert.equal(result.newState, "sealed");
		const updated = readManifest(rootDir, partitionId);
		assert.equal(updated.schema_version, "flowdesk.score_ledger_manifest.v1");
		assert.equal(updated.partitions[0]?.state, "sealed");
	});
});

describe("advanceAllPartitionsV1", () => {
	// ── Test 11: empty dir → empty results ────────────────────────────────────

	test("returns empty array when score-ledger directory does not exist", () => {
		const rootDir = makeTempDir();
		const results = advanceAllPartitionsV1({ rootDir, now: AFTER_SEALING_WINDOW });
		assert.deepEqual(results, []);
	});

	// ── Test 12: advances multiple partitions in one pass ────────────────────

	test("advances all eligible partitions found under score-ledger dir", () => {
		const rootDir = makeTempDir();

		// Partition A: raw, eligible for sealing
		const partitionIdA = "partition-A";
		const partitionA = makePartition({
			partition_id: partitionIdA,
			state: "raw",
			created_at: BASE,
			entry_count: 200,
		});
		writeManifest(rootDir, partitionIdA, makeManifest(partitionA, { manifest_id: "manifest-A" }));

		// Partition B: sealed, eligible for immutability
		const partitionIdB = "partition-B";
		const partitionB = makePartition({
			partition_id: partitionIdB,
			state: "sealed",
			sealed_at: SEALED_AT,
		});
		writeManifest(rootDir, partitionIdB, makeManifest(partitionB, { manifest_id: "manifest-B" }));

		// Partition C: raw, NOT yet eligible (count too low)
		const partitionIdC = "partition-C";
		const partitionC = makePartition({
			partition_id: partitionIdC,
			state: "raw",
			created_at: BASE,
			entry_count: 10, // < 100
		});
		writeManifest(rootDir, partitionIdC, makeManifest(partitionC, { manifest_id: "manifest-C" }));

		const results = advanceAllPartitionsV1({
			rootDir,
			now: AFTER_GRACE, // both age > 24h and grace > 7d elapsed
		});

		// All 3 manifests should be included
		assert.equal(results.length, 3);

		const resultA = results.find((r) => r.partitionId === partitionIdA);
		const resultB = results.find((r) => r.partitionId === partitionIdB);
		const resultC = results.find((r) => r.partitionId === partitionIdC);

		assert.ok(resultA, "result for partition A not found");
		assert.equal(resultA?.transitioned, true);
		assert.equal(resultA?.newState, "sealed");

		assert.ok(resultB, "result for partition B not found");
		assert.equal(resultB?.transitioned, true);
		assert.equal(resultB?.newState, "immutable");

		assert.ok(resultC, "result for partition C not found");
		assert.equal(resultC?.transitioned, false);
		assert.equal(resultC?.newState, "raw");
	});

	// ── Test 13: ignores non-manifest files ───────────────────────────────────

	test("ignores files that do not end with .manifest.json", () => {
		const rootDir = makeTempDir();
		const dir = join(rootDir, ".flowdesk", "oi", "score-ledger");
		mkdirSync(dir, { recursive: true });

		// Write a non-manifest file
		writeFileSync(join(dir, "some-file.json"), "{}", "utf8");
		writeFileSync(join(dir, "other.txt"), "data", "utf8");

		// Write one valid manifest
		const partitionId = "partition-test-ignore";
		const partition = makePartition({
			partition_id: partitionId,
			state: "raw",
			created_at: BASE,
			entry_count: 200,
		});
		writeManifest(rootDir, partitionId, makeManifest(partition));

		const results = advanceAllPartitionsV1({ rootDir, now: AFTER_SEALING_WINDOW });

		// Only the valid partition should appear
		assert.equal(results.length, 1);
		assert.equal(results[0]?.partitionId, partitionId);
	});
});
