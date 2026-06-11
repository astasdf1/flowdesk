/**
 * Score Ledger Partition Lifecycle — P7-S19.
 *
 * checkAndAdvancePartitionStateV1() reads the manifest for a single partition
 * and advances its state:
 *
 *   raw → sealed
 *     when age_seconds > sealing_window_seconds (default 86400, 24h)
 *     AND entry_count >= min_seal_threshold (default 100)
 *
 *   sealed → immutable
 *     when sealed_at + immutable_grace_period_seconds (default 604800, 7d) has elapsed
 *
 * advanceAllPartitionsV1() globs <rootDir>/.flowdesk/oi/score-ledger/*.manifest.json
 * and calls checkAndAdvancePartitionStateV1 for each.
 *
 * Advisory-only writer: no dispatch, provider, runtime, lane-launch,
 * fallback, hard-chat, or real-write authority.
 */
import {
	existsSync,
	mkdirSync,
	readFileSync,
	readdirSync,
	renameSync,
	unlinkSync,
	writeFileSync,
} from "node:fs";
import { join } from "node:path";
import { randomBytes } from "node:crypto";
import {
	type FlowDeskScoreLedgerPartitionStateV1,
	type FlowDeskScoreLedgerManifestV1,
	validateFlowDeskScoreLedgerManifestV1,
} from "@flowdesk/core";

// ── Constants ─────────────────────────────────────────────────────────────────

const SCORE_LEDGER_RELATIVE_DIR = join(".flowdesk", "oi", "score-ledger");

// ── Public contracts ──────────────────────────────────────────────────────────

export interface PartitionLifecycleCheckInputV1 {
	rootDir: string;
	partitionId: string;
	/** ISO timestamp override; defaults to new Date().toISOString() */
	now?: string;
}

export interface PartitionLifecycleCheckResultV1 {
	partitionId: string;
	previousState: FlowDeskScoreLedgerPartitionStateV1;
	newState: FlowDeskScoreLedgerPartitionStateV1;
	transitioned: boolean;
	/** Transition reason or reason for no transition */
	reason?: string;
}

// ── Internal helpers ──────────────────────────────────────────────────────────

/**
 * Derive the canonical manifest path for a given partition.
 */
function manifestPathFor(rootDir: string, partitionId: string): string {
	return join(rootDir, SCORE_LEDGER_RELATIVE_DIR, `${partitionId}.manifest.json`);
}

/**
 * Load and validate the manifest for a partition.
 * Returns null when the file does not exist or cannot be parsed/validated.
 */
function loadManifest(manifestPath: string): FlowDeskScoreLedgerManifestV1 | null {
	if (!existsSync(manifestPath)) return null;
	try {
		const raw = readFileSync(manifestPath, "utf8");
		const parsed: unknown = JSON.parse(raw);
		const validation = validateFlowDeskScoreLedgerManifestV1(parsed);
		if (!validation.ok) return null;
		return parsed as FlowDeskScoreLedgerManifestV1;
	} catch {
		return null;
	}
}

/**
 * Atomically write a manifest to disk: tmp-file → renameSync.
 * Returns true on success, false on any I/O error.
 */
function writeManifestAtomic(
	manifestPath: string,
	manifest: FlowDeskScoreLedgerManifestV1,
): boolean {
	// Ensure the parent directory exists.
	const parentDir = join(manifestPath, "..");
	try {
		mkdirSync(parentDir, { recursive: true });
	} catch {
		return false;
	}

	const tmpPath = `${manifestPath}.tmp-${randomBytes(6).toString("hex")}`;
	try {
		writeFileSync(tmpPath, JSON.stringify(manifest, null, 2), "utf8");
		renameSync(tmpPath, manifestPath);
		return true;
	} catch {
		// Best-effort cleanup of the temporary file.
		try {
			unlinkSync(tmpPath);
		} catch {
			// ignore cleanup failure
		}
		return false;
	}
}

/**
 * Seconds elapsed from `fromIso` to `toIso`.
 * Returns 0 if either timestamp is invalid.
 */
function elapsedSeconds(fromIso: string, toIso: string): number {
	const from = Date.parse(fromIso);
	const to = Date.parse(toIso);
	if (Number.isNaN(from) || Number.isNaN(to)) return 0;
	return Math.max(0, (to - from) / 1000);
}

// ── Main exports ──────────────────────────────────────────────────────────────

/**
 * Check the state of a single partition and advance it if transition conditions
 * are met.
 *
 * The manifest file must live at:
 *   <rootDir>/.flowdesk/oi/score-ledger/<partitionId>.manifest.json
 *
 * The manifest must be a valid FlowDeskScoreLedgerManifestV1 containing a
 * partition entry whose partition_id matches `partitionId`.
 *
 * Returns:
 *   transitioned: true  — state advanced and manifest updated on disk
 *   transitioned: false — no change; `reason` explains why
 */
export function checkAndAdvancePartitionStateV1(
	input: PartitionLifecycleCheckInputV1,
): PartitionLifecycleCheckResultV1 {
	const { rootDir, partitionId } = input;
	const now = input.now ?? new Date().toISOString();

	const manifestPath = manifestPathFor(rootDir, partitionId);

	// ── Step 1: Load manifest ──────────────────────────────────────────────────
	const manifest = loadManifest(manifestPath);
	if (manifest === null) {
		return {
			partitionId,
			previousState: "raw",
			newState: "raw",
			transitioned: false,
			reason: "manifest_not_found",
		};
	}

	// ── Step 2: Locate the matching partition entry ────────────────────────────
	const partition = manifest.partitions.find((p) => p.partition_id === partitionId);
	if (!partition) {
		return {
			partitionId,
			previousState: "raw",
			newState: "raw",
			transitioned: false,
			reason: "partition_not_found_in_manifest",
		};
	}

	const previousState = partition.state;

	// ── Step 3: Already immutable → no change ─────────────────────────────────
	if (previousState === "immutable") {
		return {
			partitionId,
			previousState,
			newState: "immutable",
			transitioned: false,
			reason: "already_immutable",
		};
	}

	// ── Step 4: raw → sealed ───────────────────────────────────────────────────
	if (previousState === "raw") {
		const ageSeconds = elapsedSeconds(partition.created_at, now);
		const ageMet = ageSeconds > partition.sealing_window_seconds;
		const countMet = partition.entry_count >= partition.min_seal_threshold;

		if (!ageMet || !countMet) {
			const missing: string[] = [];
			if (!ageMet) {
				missing.push(
					`age_seconds(${Math.floor(ageSeconds)}) <= sealing_window_seconds(${partition.sealing_window_seconds})`,
				);
			}
			if (!countMet) {
				missing.push(
					`entry_count(${partition.entry_count}) < min_seal_threshold(${partition.min_seal_threshold})`,
				);
			}
			return {
				partitionId,
				previousState: "raw",
				newState: "raw",
				transitioned: false,
				reason: `conditions_not_met: ${missing.join("; ")}`,
			};
		}

		// Advance raw → sealed
		const updatedPartition = { ...partition, state: "sealed" as const, sealed_at: now };
		const updatedManifest: FlowDeskScoreLedgerManifestV1 = {
			...manifest,
			partitions: manifest.partitions.map((p) =>
				p.partition_id === partitionId ? updatedPartition : p,
			),
			updated_at: now,
		};

		if (!writeManifestAtomic(manifestPath, updatedManifest)) {
			return {
				partitionId,
				previousState: "raw",
				newState: "raw",
				transitioned: false,
				reason: "write_failed",
			};
		}

		return {
			partitionId,
			previousState: "raw",
			newState: "sealed",
			transitioned: true,
			reason: `raw_to_sealed: age_seconds(${Math.floor(ageSeconds)}) > sealing_window_seconds(${partition.sealing_window_seconds}), entry_count(${partition.entry_count}) >= min_seal_threshold(${partition.min_seal_threshold})`,
		};
	}

	// ── Step 5: sealed → immutable ────────────────────────────────────────────
	// previousState is "sealed" (only remaining case after raw and immutable)
	if (!partition.sealed_at) {
		return {
			partitionId,
			previousState: "sealed",
			newState: "sealed",
			transitioned: false,
			reason: "sealed_at_missing",
		};
	}

	const graceElapsedSeconds = elapsedSeconds(partition.sealed_at, now);
	if (graceElapsedSeconds <= partition.immutable_grace_period_seconds) {
		return {
			partitionId,
			previousState: "sealed",
			newState: "sealed",
			transitioned: false,
			reason: `conditions_not_met: grace_elapsed_seconds(${Math.floor(graceElapsedSeconds)}) <= immutable_grace_period_seconds(${partition.immutable_grace_period_seconds})`,
		};
	}

	// Advance sealed → immutable
	const updatedPartition = {
		...partition,
		state: "immutable" as const,
		immutable_at: now,
	};
	const updatedManifest: FlowDeskScoreLedgerManifestV1 = {
		...manifest,
		partitions: manifest.partitions.map((p) =>
			p.partition_id === partitionId ? updatedPartition : p,
		),
		updated_at: now,
	};

	if (!writeManifestAtomic(manifestPath, updatedManifest)) {
		return {
			partitionId,
			previousState: "sealed",
			newState: "sealed",
			transitioned: false,
			reason: "write_failed",
		};
	}

	return {
		partitionId,
		previousState: "sealed",
		newState: "immutable",
		transitioned: true,
		reason: `sealed_to_immutable: grace_elapsed_seconds(${Math.floor(graceElapsedSeconds)}) > immutable_grace_period_seconds(${partition.immutable_grace_period_seconds})`,
	};
}

/**
 * Advance all partitions found under
 *   <rootDir>/.flowdesk/oi/score-ledger/*.manifest.json
 *
 * Each manifest filename must follow the pattern `<partitionId>.manifest.json`.
 *
 * Already-immutable partitions are visited and included in results
 * (reason: "already_immutable"), allowing callers to build a full inventory.
 *
 * Returns an empty array when the score-ledger directory does not exist or
 * cannot be read.
 */
export function advanceAllPartitionsV1(input: {
	rootDir: string;
	now?: string;
}): PartitionLifecycleCheckResultV1[] {
	const { rootDir } = input;
	const now = input.now ?? new Date().toISOString();

	const scoreledgerDir = join(rootDir, SCORE_LEDGER_RELATIVE_DIR);
	if (!existsSync(scoreledgerDir)) return [];

	let entries: string[];
	try {
		entries = readdirSync(scoreledgerDir);
	} catch {
		return [];
	}

	const results: PartitionLifecycleCheckResultV1[] = [];

	for (const fileName of entries) {
		if (!fileName.endsWith(".manifest.json")) continue;

		// partitionId = filename with ".manifest.json" suffix removed
		const partitionId = fileName.slice(0, -".manifest.json".length);
		if (!partitionId) continue;

		const result = checkAndAdvancePartitionStateV1({ rootDir, partitionId, now });
		results.push(result);
	}

	return results;
}
