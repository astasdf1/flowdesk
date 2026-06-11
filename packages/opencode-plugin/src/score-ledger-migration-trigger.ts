/**
 * Score Ledger Migration Trigger — P7-S26.
 *
 * evaluateMigrationTriggerV1() detects schema/policy hash changes and produces
 * a MigrationManifestV1 identifying affected partitions and invalidated chain heads.
 *
 * Disk layout scanned:
 *   <rootDir>/.flowdesk/oi/score-ledger/*.manifest.json  — per-partition manifest files
 *
 * Migration manifest written to:
 *   <rootDir>/.flowdesk/oi/score-ledger-migrations/<migration_id>.json
 *
 * Advisory-only: no dispatch, provider, runtime, lane-launch,
 * fallback, hard-chat, or real execution authority.
 */
import {
	existsSync,
	mkdirSync,
	readdirSync,
	readFileSync,
	renameSync,
	unlinkSync,
	writeFileSync,
} from "node:fs";
import { join } from "node:path";
import { randomBytes } from "node:crypto";

// ── Path constants ─────────────────────────────────────────────────────────────

const SCORE_LEDGER_DIR = join(".flowdesk", "oi", "score-ledger");
const SCORE_LEDGER_MIGRATIONS_DIR = join(".flowdesk", "oi", "score-ledger-migrations");

// ── Public contracts ───────────────────────────────────────────────────────────

export interface MigrationTriggerInputV1 {
	rootDir: string;
	previousSchemaHash: string;
	currentSchemaHash: string;
	previousPolicyHash?: string;
	currentPolicyHash?: string;
	/** ISO timestamp override; defaults to new Date().toISOString() */
	now?: string;
}

export interface MigrationManifestV1 {
	schema_version: "flowdesk.score_ledger_migration_manifest.v1";
	migration_id: string;
	previous_schema_hash: string;
	current_schema_hash: string;
	previous_policy_hash?: string;
	current_policy_hash?: string;
	affected_partition_ids: string[];
	migration_required: boolean;
	migration_trigger_reason:
		| "schema_hash_changed"
		| "policy_hash_changed"
		| "both_changed"
		| "no_change";
	trusted_chain_head_invalidated: boolean;
	created_at: string;
	advisory_only: true;
	dispatch_authority_enabled: false;
}

// ── Internal helpers ───────────────────────────────────────────────────────────

/**
 * Determine the migration_trigger_reason from hash comparisons.
 */
function determineTriggerReason(
	previousSchemaHash: string,
	currentSchemaHash: string,
	previousPolicyHash: string | undefined,
	currentPolicyHash: string | undefined,
): MigrationManifestV1["migration_trigger_reason"] {
	const schemaChanged = previousSchemaHash !== currentSchemaHash;
	const policyChanged =
		previousPolicyHash !== undefined &&
		currentPolicyHash !== undefined &&
		previousPolicyHash !== currentPolicyHash;

	if (schemaChanged && policyChanged) return "both_changed";
	if (schemaChanged) return "schema_hash_changed";
	if (policyChanged) return "policy_hash_changed";
	return "no_change";
}

/**
 * Extract the state from a raw manifest JSON value.
 *
 * Supports two disk formats:
 *   1. FlowDeskScoreLedgerPartitionV1 — direct partition object with `state` field
 *   2. FlowDeskScoreLedgerManifestV1  — wrapper with `partitions[]` array
 *
 * Returns the state string if extractable, or null otherwise.
 */
function extractPartitionState(
	raw: unknown,
): "raw" | "sealed" | "immutable" | null {
	if (typeof raw !== "object" || raw === null) return null;
	const record = raw as Record<string, unknown>;

	// Format 1: direct partition (FlowDeskScoreLedgerPartitionV1)
	if (record.schema_version === "flowdesk.score_ledger_partition.v1") {
		const state = record.state;
		if (state === "raw" || state === "sealed" || state === "immutable")
			return state;
		return null;
	}

	// Format 2: manifest wrapper (FlowDeskScoreLedgerManifestV1)
	if (record.schema_version === "flowdesk.score_ledger_manifest.v1") {
		const partitions = record.partitions;
		if (!Array.isArray(partitions) || partitions.length === 0) return null;
		// Use the first partition's state as representative
		const first = partitions[0] as Record<string, unknown>;
		const state = first?.state;
		if (state === "raw" || state === "sealed" || state === "immutable")
			return state;
		return null;
	}

	// Unknown format: try to read `state` directly as a fallback
	const state = record.state;
	if (state === "raw" || state === "sealed" || state === "immutable")
		return state;
	return null;
}

/**
 * Scan <rootDir>/.flowdesk/oi/score-ledger/*.manifest.json.
 * Returns an array of { partitionId, state } for all readable partitions.
 * Files that cannot be read or parsed are silently skipped.
 */
function scanPartitionManifests(
	rootDir: string,
): Array<{ partitionId: string; state: "raw" | "sealed" | "immutable" }> {
	const scoreLedgerDir = join(rootDir, SCORE_LEDGER_DIR);
	if (!existsSync(scoreLedgerDir)) return [];

	let fileNames: string[];
	try {
		fileNames = readdirSync(scoreLedgerDir);
	} catch {
		return [];
	}

	const results: Array<{
		partitionId: string;
		state: "raw" | "sealed" | "immutable";
	}> = [];

	for (const fileName of fileNames) {
		if (!fileName.endsWith(".manifest.json")) continue;

		const partitionId = fileName.slice(0, -".manifest.json".length);
		if (!partitionId) continue;

		const filePath = join(scoreLedgerDir, fileName);
		let parsed: unknown;
		try {
			const raw = readFileSync(filePath, "utf8");
			parsed = JSON.parse(raw);
		} catch {
			continue;
		}

		const state = extractPartitionState(parsed);
		if (state === null) continue;

		results.push({ partitionId, state });
	}

	return results;
}

/**
 * Atomically write the migration manifest to:
 *   <rootDir>/.flowdesk/oi/score-ledger-migrations/<migration_id>.json
 *
 * Returns true on success, false on I/O error.
 */
function writeMigrationManifest(
	rootDir: string,
	manifest: MigrationManifestV1,
): boolean {
	const dir = join(rootDir, SCORE_LEDGER_MIGRATIONS_DIR);
	try {
		mkdirSync(dir, { recursive: true });
	} catch {
		return false;
	}

	const targetPath = join(dir, `${manifest.migration_id}.json`);
	const tmpPath = `${targetPath}.tmp-${randomBytes(6).toString("hex")}`;
	try {
		writeFileSync(tmpPath, JSON.stringify(manifest, null, 2), "utf8");
		renameSync(tmpPath, targetPath);
		return true;
	} catch {
		try {
			unlinkSync(tmpPath);
		} catch {
			// best-effort cleanup
		}
		return false;
	}
}

// ── Main export ────────────────────────────────────────────────────────────────

/**
 * Evaluate whether schema/policy hash changes require a migration and, when
 * they do, identify which partitions are affected.
 *
 * Affected partitions are those whose state is NOT "raw" (i.e., "sealed" or
 * "immutable"), since raw partitions can still accept new writes under the
 * current schema and do not need migration intervention.
 *
 * If any affected partition is "immutable", `trusted_chain_head_invalidated`
 * is set to true, indicating that chain head re-verification is required.
 *
 * When no hashes changed, returns a no_change manifest without scanning disk
 * or writing any file.
 *
 * The resulting MigrationManifestV1 is written to:
 *   <rootDir>/.flowdesk/oi/score-ledger-migrations/<migration_id>.json
 *
 * Advisory-only: all authority flags are false.
 */
export function evaluateMigrationTriggerV1(
	input: MigrationTriggerInputV1,
): MigrationManifestV1 {
	const now = input.now ?? new Date().toISOString();
	const migrationId = `migration-${randomBytes(8).toString("hex")}`;

	const triggerReason = determineTriggerReason(
		input.previousSchemaHash,
		input.currentSchemaHash,
		input.previousPolicyHash,
		input.currentPolicyHash,
	);

	// ── No change: return immediately without disk I/O ─────────────────────────
	if (triggerReason === "no_change") {
		const manifest: MigrationManifestV1 = {
			schema_version: "flowdesk.score_ledger_migration_manifest.v1",
			migration_id: migrationId,
			previous_schema_hash: input.previousSchemaHash,
			current_schema_hash: input.currentSchemaHash,
			previous_policy_hash: input.previousPolicyHash,
			current_policy_hash: input.currentPolicyHash,
			affected_partition_ids: [],
			migration_required: false,
			migration_trigger_reason: "no_change",
			trusted_chain_head_invalidated: false,
			created_at: now,
			advisory_only: true,
			dispatch_authority_enabled: false,
		};
		return manifest;
	}

	// ── Hash(es) changed: scan partitions ─────────────────────────────────────
	const allPartitions = scanPartitionManifests(input.rootDir);

	// Affected = sealed or immutable (state !== "raw")
	const affectedPartitions = allPartitions.filter((p) => p.state !== "raw");
	const affectedPartitionIds = affectedPartitions.map((p) => p.partitionId);

	// Chain head invalidated if any affected partition is immutable
	const trustedChainHeadInvalidated = affectedPartitions.some(
		(p) => p.state === "immutable",
	);

	const migrationRequired = affectedPartitionIds.length > 0;

	const manifest: MigrationManifestV1 = {
		schema_version: "flowdesk.score_ledger_migration_manifest.v1",
		migration_id: migrationId,
		previous_schema_hash: input.previousSchemaHash,
		current_schema_hash: input.currentSchemaHash,
		previous_policy_hash: input.previousPolicyHash,
		current_policy_hash: input.currentPolicyHash,
		affected_partition_ids: affectedPartitionIds,
		migration_required: migrationRequired,
		migration_trigger_reason: triggerReason,
		trusted_chain_head_invalidated: trustedChainHeadInvalidated,
		created_at: now,
		advisory_only: true,
		dispatch_authority_enabled: false,
	};

	// Write migration manifest to disk (best-effort; result not returned to caller)
	writeMigrationManifest(input.rootDir, manifest);

	return manifest;
}
