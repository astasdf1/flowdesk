/**
 * Tests for score-ledger-migration-trigger.ts — P7-S26.
 */
import assert from "node:assert/strict";
import {
	existsSync,
	mkdirSync,
	mkdtempSync,
	readFileSync,
	readdirSync,
	rmSync,
	writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, test } from "node:test";
import {
	evaluateMigrationTriggerV1,
	type MigrationManifestV1,
	type MigrationTriggerInputV1,
} from "./score-ledger-migration-trigger.js";
import { appendToScoreLedgerPartitionV1 } from "./score-ledger-partition-writer.js";
import { checkAndAdvancePartitionStateV1 } from "./score-ledger-partition-lifecycle.js";

// ── Test helpers ───────────────────────────────────────────────────────────────

const tempDirs: string[] = [];

function makeTempDir(): string {
	const dir = mkdtempSync(join(tmpdir(), "flowdesk-migration-trigger-"));
	tempDirs.push(dir);
	return dir;
}

afterEach(() => {
	for (const dir of tempDirs.splice(0)) {
		rmSync(dir, { recursive: true, force: true });
	}
});

const SCORE_LEDGER_DIR = join(".flowdesk", "oi", "score-ledger");
const MIGRATIONS_DIR = join(".flowdesk", "oi", "score-ledger-migrations");

const HASH_A =
	"sha256-aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa";
const HASH_B =
	"sha256-bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb";
const HASH_C =
	"sha256-cccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccc";
const HASH_D =
	"sha256-dddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddd";

const FIXED_NOW = "2026-06-11T10:00:00.000Z";

/**
 * Write a minimal FlowDeskScoreLedgerPartitionV1 manifest file.
 */
function writePartitionManifest(
	rootDir: string,
	partitionId: string,
	state: "raw" | "sealed" | "immutable",
): void {
	const dir = join(rootDir, SCORE_LEDGER_DIR);
	mkdirSync(dir, { recursive: true });
	const manifest = {
		schema_version: "flowdesk.score_ledger_partition.v1",
		partition_id: partitionId,
		state,
		created_at: "2026-01-01T00:00:00.000Z",
		sealed_at: state !== "raw" ? "2026-01-02T01:00:00.000Z" : undefined,
		immutable_at: state === "immutable" ? "2026-01-10T01:00:00.000Z" : undefined,
		entry_count: 200,
		genesis_hash: HASH_A,
		chain_head_hash: HASH_B,
		schema_hash: HASH_A,
		sealing_window_seconds: 86400,
		min_seal_threshold: 100,
		immutable_grace_period_seconds: 604800,
		advisory_only: true,
		non_authorizing: true,
		dispatch_authority_enabled: false,
		remote_write_authority_enabled: false,
	};
	writeFileSync(
		join(dir, `${partitionId}.manifest.json`),
		JSON.stringify(manifest, null, 2),
		"utf8",
	);
}

/**
 * Write a FlowDeskScoreLedgerManifestV1 wrapper-style manifest.
 */
function writeManifestWrapperFile(
	rootDir: string,
	partitionId: string,
	state: "raw" | "sealed" | "immutable",
): void {
	const dir = join(rootDir, SCORE_LEDGER_DIR);
	mkdirSync(dir, { recursive: true });
	const wrapper = {
		schema_version: "flowdesk.score_ledger_manifest.v1",
		manifest_id: `manifest-${partitionId}`,
		partitions: [
			{
				schema_version: "flowdesk.score_ledger_partition.v1",
				partition_id: partitionId,
				state,
				created_at: "2026-01-01T00:00:00.000Z",
				sealed_at: state !== "raw" ? "2026-01-02T01:00:00.000Z" : undefined,
				immutable_at:
					state === "immutable" ? "2026-01-10T01:00:00.000Z" : undefined,
				entry_count: 150,
				genesis_hash: HASH_C,
				chain_head_hash: HASH_D,
				schema_hash: HASH_C,
				sealing_window_seconds: 86400,
				min_seal_threshold: 100,
				immutable_grace_period_seconds: 604800,
				advisory_only: true,
				non_authorizing: true,
				dispatch_authority_enabled: false,
				remote_write_authority_enabled: false,
			},
		],
		updated_at: "2026-06-01T00:00:00.000Z",
		advisory_only: true,
		dispatch_authority_enabled: false,
	};
	writeFileSync(
		join(dir, `${partitionId}.manifest.json`),
		JSON.stringify(wrapper, null, 2),
		"utf8",
	);
}

function baseInput(rootDir: string): MigrationTriggerInputV1 {
	return {
		rootDir,
		previousSchemaHash: HASH_A,
		currentSchemaHash: HASH_B,
		now: FIXED_NOW,
	};
}

function readMigrationManifest(
	rootDir: string,
	migrationId: string,
): MigrationManifestV1 {
	const path = join(rootDir, MIGRATIONS_DIR, `${migrationId}.json`);
	return JSON.parse(readFileSync(path, "utf8")) as MigrationManifestV1;
}

// ── Tests ──────────────────────────────────────────────────────────────────────

describe("evaluateMigrationTriggerV1", () => {
	// ── Test 1: no_change when schema hashes are identical ───────────────────

	test("schema hash unchanged and no policy hash → no_change, migration_required false", () => {
		const rootDir = makeTempDir();

		// Write a sealed partition to confirm it is NOT scanned when no change
		writePartitionManifest(rootDir, "partition-sealed-001", "sealed");

		const result = evaluateMigrationTriggerV1({
			rootDir,
			previousSchemaHash: HASH_A,
			currentSchemaHash: HASH_A, // same hash
			now: FIXED_NOW,
		});

		assert.equal(result.migration_trigger_reason, "no_change");
		assert.equal(result.migration_required, false);
		assert.deepEqual(result.affected_partition_ids, []);
		assert.equal(result.trusted_chain_head_invalidated, false);
		assert.equal(result.schema_version, "flowdesk.score_ledger_migration_manifest.v1");
		assert.equal(result.advisory_only, true);
		assert.equal(result.dispatch_authority_enabled, false);
		assert.equal(result.created_at, FIXED_NOW);

		// No migration file written for no_change
		const migrationsDir = join(rootDir, MIGRATIONS_DIR);
		assert.equal(existsSync(migrationsDir), false);
	});

	// ── Test 2: schema_hash_changed → affected sealed/immutable partitions ────

	test("schema hash changed → schema_hash_changed, affected non-raw partitions listed", () => {
		const rootDir = makeTempDir();

		writePartitionManifest(rootDir, "partition-raw-001", "raw");
		writePartitionManifest(rootDir, "partition-sealed-001", "sealed");
		writePartitionManifest(rootDir, "partition-sealed-002", "sealed");

		const result = evaluateMigrationTriggerV1({
			...baseInput(rootDir),
			previousSchemaHash: HASH_A,
			currentSchemaHash: HASH_B,
		});

		assert.equal(result.migration_trigger_reason, "schema_hash_changed");
		assert.equal(result.migration_required, true);
		assert.equal(result.trusted_chain_head_invalidated, false); // no immutable partitions

		// Only sealed/immutable are affected; raw is excluded
		assert.ok(
			!result.affected_partition_ids.includes("partition-raw-001"),
			"raw partition must not be in affected_partition_ids",
		);
		assert.ok(
			result.affected_partition_ids.includes("partition-sealed-001"),
			"sealed partition must be in affected_partition_ids",
		);
		assert.ok(
			result.affected_partition_ids.includes("partition-sealed-002"),
			"sealed partition must be in affected_partition_ids",
		);
		assert.equal(result.affected_partition_ids.length, 2);

		// Migration manifest written to disk
		const written = readMigrationManifest(rootDir, result.migration_id);
		assert.equal(
			written.schema_version,
			"flowdesk.score_ledger_migration_manifest.v1",
		);
		assert.equal(written.migration_id, result.migration_id);
		assert.equal(written.migration_trigger_reason, "schema_hash_changed");
	});

	// ── Test 3: immutable partition → trusted_chain_head_invalidated true ─────

	test("immutable partition exists → trusted_chain_head_invalidated true", () => {
		const rootDir = makeTempDir();

		writePartitionManifest(rootDir, "partition-raw-001", "raw");
		writePartitionManifest(rootDir, "partition-sealed-001", "sealed");
		writePartitionManifest(rootDir, "partition-immutable-001", "immutable");

		const result = evaluateMigrationTriggerV1({
			...baseInput(rootDir),
			previousSchemaHash: HASH_A,
			currentSchemaHash: HASH_B,
		});

		assert.equal(result.migration_trigger_reason, "schema_hash_changed");
		assert.equal(result.migration_required, true);
		assert.equal(result.trusted_chain_head_invalidated, true);

		assert.ok(
			result.affected_partition_ids.includes("partition-sealed-001"),
			"sealed partition must be affected",
		);
		assert.ok(
			result.affected_partition_ids.includes("partition-immutable-001"),
			"immutable partition must be affected",
		);
		assert.ok(
			!result.affected_partition_ids.includes("partition-raw-001"),
			"raw partition must not be affected",
		);
		assert.equal(result.affected_partition_ids.length, 2);
	});

	// ── Test 4: policy hash only changed → policy_hash_changed ───────────────

	test("policy hash only changed → policy_hash_changed, affected partitions returned", () => {
		const rootDir = makeTempDir();

		writePartitionManifest(rootDir, "partition-sealed-001", "sealed");
		writePartitionManifest(rootDir, "partition-raw-001", "raw");

		const result = evaluateMigrationTriggerV1({
			rootDir,
			previousSchemaHash: HASH_A,
			currentSchemaHash: HASH_A, // schema hash unchanged
			previousPolicyHash: HASH_C,
			currentPolicyHash: HASH_D, // policy hash changed
			now: FIXED_NOW,
		});

		assert.equal(result.migration_trigger_reason, "policy_hash_changed");
		assert.equal(result.migration_required, true);
		assert.ok(
			result.affected_partition_ids.includes("partition-sealed-001"),
			"sealed partition must be affected",
		);
		assert.ok(
			!result.affected_partition_ids.includes("partition-raw-001"),
			"raw partition must not be affected",
		);
	});

	// ── Test 5: both schema and policy hash changed → both_changed ────────────

	test("both schema and policy hash changed → both_changed", () => {
		const rootDir = makeTempDir();

		writePartitionManifest(rootDir, "partition-immutable-001", "immutable");

		const result = evaluateMigrationTriggerV1({
			rootDir,
			previousSchemaHash: HASH_A,
			currentSchemaHash: HASH_B,
			previousPolicyHash: HASH_C,
			currentPolicyHash: HASH_D,
			now: FIXED_NOW,
		});

		assert.equal(result.migration_trigger_reason, "both_changed");
		assert.equal(result.migration_required, true);
		assert.equal(result.trusted_chain_head_invalidated, true);
		assert.ok(
			result.affected_partition_ids.includes("partition-immutable-001"),
			"immutable partition must be affected",
		);
	});

	// ── Test 6: no partitions on disk → migration_required false ──────────────

	test("schema changed but no partitions on disk → migration_required false, empty affected list", () => {
		const rootDir = makeTempDir();

		// Score-ledger dir does not exist at all
		const result = evaluateMigrationTriggerV1({
			rootDir,
			previousSchemaHash: HASH_A,
			currentSchemaHash: HASH_B,
			now: FIXED_NOW,
		});

		assert.equal(result.migration_trigger_reason, "schema_hash_changed");
		assert.equal(result.migration_required, false);
		assert.deepEqual(result.affected_partition_ids, []);
		assert.equal(result.trusted_chain_head_invalidated, false);
	});

	// ── Test 7: all partitions are raw → migration_required false ─────────────

	test("schema changed but all partitions are raw → migration_required false", () => {
		const rootDir = makeTempDir();

		writePartitionManifest(rootDir, "partition-raw-001", "raw");
		writePartitionManifest(rootDir, "partition-raw-002", "raw");

		const result = evaluateMigrationTriggerV1({
			rootDir,
			previousSchemaHash: HASH_A,
			currentSchemaHash: HASH_B,
			now: FIXED_NOW,
		});

		assert.equal(result.migration_trigger_reason, "schema_hash_changed");
		assert.equal(result.migration_required, false);
		assert.deepEqual(result.affected_partition_ids, []);
		assert.equal(result.trusted_chain_head_invalidated, false);
	});

	// ── Test 8: migration manifest has correct authority flags ─────────────────

	test("migration manifest always has advisory_only=true and dispatch_authority_enabled=false", () => {
		const rootDir = makeTempDir();
		writePartitionManifest(rootDir, "partition-sealed-001", "sealed");

		const result = evaluateMigrationTriggerV1(baseInput(rootDir));

		assert.equal(result.advisory_only, true);
		assert.equal(result.dispatch_authority_enabled, false);
		assert.equal(result.schema_version, "flowdesk.score_ledger_migration_manifest.v1");
		assert.ok(result.migration_id.startsWith("migration-"), `expected migration- prefix, got ${result.migration_id}`);
	});

	// ── Test 9: manifest wrapper format (FlowDeskScoreLedgerManifestV1) ────────

	test("manifest wrapper format (FlowDeskScoreLedgerManifestV1) is correctly detected", () => {
		const rootDir = makeTempDir();

		// Write a sealed partition in wrapper format (as used by S19 lifecycle)
		writeManifestWrapperFile(rootDir, "partition-wrapper-sealed", "sealed");

		const result = evaluateMigrationTriggerV1({
			rootDir,
			previousSchemaHash: HASH_A,
			currentSchemaHash: HASH_B,
			now: FIXED_NOW,
		});

		assert.equal(result.migration_trigger_reason, "schema_hash_changed");
		assert.equal(result.migration_required, true);
		assert.ok(
			result.affected_partition_ids.includes("partition-wrapper-sealed"),
			"wrapper-format sealed partition must be in affected_partition_ids",
		);
	});

	// ── Test 10: migration file written atomically to migrations dir ───────────

	test("migration file is written to .flowdesk/oi/score-ledger-migrations/ and is valid JSON", () => {
		const rootDir = makeTempDir();
		writePartitionManifest(rootDir, "partition-sealed-001", "sealed");

		const result = evaluateMigrationTriggerV1(baseInput(rootDir));

		const migrationsDir = join(rootDir, MIGRATIONS_DIR);
		assert.ok(existsSync(migrationsDir), "migrations directory must be created");

		const files = readdirSync(migrationsDir);
		assert.equal(files.length, 1);
		assert.equal(files[0], `${result.migration_id}.json`);

		const written = readMigrationManifest(rootDir, result.migration_id);
		assert.equal(written.migration_id, result.migration_id);
		assert.deepEqual(
			written.affected_partition_ids,
			result.affected_partition_ids,
		);
		assert.equal(written.advisory_only, true);
		assert.equal(written.dispatch_authority_enabled, false);
	});

	// ── Test 11: policy hash same (not changed) → no_change ───────────────────

	test("policy hashes identical and schema identical → no_change", () => {
		const rootDir = makeTempDir();
		writePartitionManifest(rootDir, "partition-sealed-001", "sealed");

		const result = evaluateMigrationTriggerV1({
			rootDir,
			previousSchemaHash: HASH_A,
			currentSchemaHash: HASH_A,
			previousPolicyHash: HASH_C,
			currentPolicyHash: HASH_C, // same
			now: FIXED_NOW,
		});

		assert.equal(result.migration_trigger_reason, "no_change");
		assert.equal(result.migration_required, false);
	});

	// ── Test 12: only one policyHash provided (not both) → no policy change ───

	test("only one policy hash provided (not both) → policy change not detected", () => {
		const rootDir = makeTempDir();
		writePartitionManifest(rootDir, "partition-sealed-001", "sealed");

		// Previous policy hash provided but current is missing → not a policy change
		const result = evaluateMigrationTriggerV1({
			rootDir,
			previousSchemaHash: HASH_A,
			currentSchemaHash: HASH_A, // no schema change
			previousPolicyHash: HASH_C,
			// currentPolicyHash omitted
			now: FIXED_NOW,
		});

		// No schema change and policy change not detected (missing currentPolicyHash)
		assert.equal(result.migration_trigger_reason, "no_change");
	});

	// ── Test 13: writer → lifecycle → migration compatibility ────────────────

	test("writer-created manifest advanced by lifecycle is scanned by migration trigger", () => {
		const rootDir = makeTempDir();
		const partitionId = "partition-writer-lifecycle-migration";
		for (let i = 0; i < 100; i++) {
			const appendResult = appendToScoreLedgerPartitionV1({
				rootDir,
				partitionId,
				entry: { event: "score.recorded", index: i },
				schemaHash: HASH_A,
			});
			assert.ok(appendResult.status === "partition_created" || appendResult.status === "appended");
		}

		const lifecycleResult = checkAndAdvancePartitionStateV1({
			rootDir,
			partitionId,
			now: "2030-01-01T00:00:00.000Z",
		});
		assert.equal(lifecycleResult.newState, "sealed");

		const migrationResult = evaluateMigrationTriggerV1({
			rootDir,
			previousSchemaHash: HASH_A,
			currentSchemaHash: HASH_B,
			now: FIXED_NOW,
		});

		assert.equal(migrationResult.migration_trigger_reason, "schema_hash_changed");
		assert.ok(migrationResult.affected_partition_ids.includes(partitionId));
	});
});
