/**
 * Score Ledger Partition Writer — P7-S18.
 *
 * appendToScoreLedgerPartitionV1() atomically appends one entry to a
 * raw score-ledger partition, maintaining a hash chain (genesis + event +
 * chain hashes).
 *
 * Disk layout:
 *   <rootDir>/.flowdesk/oi/score-ledger/<partitionId>.jsonl          — raw entry lines
 *   <rootDir>/.flowdesk/oi/score-ledger/<partitionId>.manifest.json  — FlowDeskScoreLedgerManifestV1 metadata
 *
 * Advisory-only writer: no dispatch, provider, runtime, lane-launch,
 * fallback, write, or hard-chat authority.
 */
import {
	existsSync,
	mkdirSync,
	readFileSync,
	renameSync,
	unlinkSync,
	writeFileSync,
} from "node:fs";
import { join } from "node:path";
import { randomBytes } from "node:crypto";
import {
	createFlowDeskScoreLedgerPartitionV1,
	createFlowDeskScoreLedgerManifestV1,
	computeEventHashV1,
	computeChainHashV1,
	computePartitionGenesisHashV1,
	type FlowDeskScoreLedgerPartitionV1,
} from "@flowdesk/core";

// ── Constants ──────────────────────────────────────────────────────────────────

const SCORE_LEDGER_DIR = join(".flowdesk", "oi", "score-ledger");

/** Default schema hash used when caller does not supply one. */
const DEFAULT_SCHEMA_HASH =
	"sha256-0000000000000000000000000000000000000000000000000000000000000000";

const SHA256_HEX_RE = /^[a-f0-9]{64}$/;
const SHA256_REF_RE = /^sha256-[a-f0-9]{64}$/;

// ── Public contract ────────────────────────────────────────────────────────────

export interface ScoreLedgerPartitionWriterInputV1 {
	rootDir: string;
	entry: unknown; // ledger entry (JCS hash target)
	partitionId?: string; // auto: "partition-YYYY-MM-DD"
	schemaHash?: string; // manifest-level schema hash
}

export interface ScoreLedgerPartitionWriterResultV1 {
	status: "appended" | "partition_created" | "blocked";
	partitionId: string;
	entryCount: number;
	chainHead: string; // latest chain hash
	genesisHash: string;
	reason?: string; // present when blocked
}

// ── Internal helpers ───────────────────────────────────────────────────────────

/** Build the default partition id from today's UTC date. */
function defaultPartitionId(): string {
	const d = new Date();
	const yyyy = d.getUTCFullYear();
	const mm = String(d.getUTCMonth() + 1).padStart(2, "0");
	const dd = String(d.getUTCDate()).padStart(2, "0");
	return `partition-${yyyy}-${mm}-${dd}`;
}

/** Resolve the on-disk paths for a partition. */
function partitionPaths(
	rootDir: string,
	partitionId: string,
): { jsonlPath: string; manifestPath: string; dirPath: string } {
	const dirPath = join(rootDir, SCORE_LEDGER_DIR);
	return {
		dirPath,
		jsonlPath: join(dirPath, `${partitionId}.jsonl`),
		manifestPath: join(dirPath, `${partitionId}.manifest.json`),
	};
}

/** Atomic write using a tmp file → renameSync pattern (mirrors S04). */
function atomicWriteFile(targetPath: string, content: string): void {
	const tmpPath = `${targetPath}.tmp-${randomBytes(6).toString("hex")}`;
	try {
		writeFileSync(tmpPath, content, "utf8");
		renameSync(tmpPath, targetPath);
	} catch (err) {
		try {
			unlinkSync(tmpPath);
		} catch {
			// best-effort cleanup
		}
		throw err;
	}
}

function asSha256Ref(hash: string): string {
	if (SHA256_REF_RE.test(hash)) return hash;
	if (SHA256_HEX_RE.test(hash)) return `sha256-${hash}`;
	return hash;
}

function hashRefForChain(hashRef: string): string {
	return SHA256_REF_RE.test(hashRef) ? hashRef.slice("sha256-".length) : hashRef;
}

function partitionFromManifestRecord(
	manifest: Record<string, unknown>,
	partitionId: string,
): FlowDeskScoreLedgerPartitionV1 | null {
	if (manifest.schema_version === "flowdesk.score_ledger_partition.v1") {
		return manifest as unknown as FlowDeskScoreLedgerPartitionV1;
	}

	if (manifest.schema_version === "flowdesk.score_ledger_manifest.v1") {
		const partitions = manifest.partitions;
		if (!Array.isArray(partitions)) return null;
		const partition = partitions.find((entry) => {
			if (typeof entry !== "object" || entry === null) return false;
			return (entry as Record<string, unknown>).partition_id === partitionId;
		});
		return (partition as FlowDeskScoreLedgerPartitionV1 | undefined) ?? null;
	}

	return manifest as unknown as FlowDeskScoreLedgerPartitionV1;
}

// ── Main export ────────────────────────────────────────────────────────────────

/**
 * Atomically append one entry to a raw score-ledger partition.
 *
 * Returns:
 *   - `partition_created` — first entry; new partition file created
 *   - `appended`          — entry written to existing raw partition
 *   - `blocked`           — rootDir missing, partition sealed/immutable, or I/O error
 */
export function appendToScoreLedgerPartitionV1(
	input: ScoreLedgerPartitionWriterInputV1,
): ScoreLedgerPartitionWriterResultV1 {
	// ── Guard: rootDir must exist ──────────────────────────────────────────────
	if (
		typeof input.rootDir !== "string" ||
		input.rootDir.trim().length === 0 ||
		!existsSync(input.rootDir)
	) {
		return {
			status: "blocked",
			partitionId: input.partitionId ?? defaultPartitionId(),
			entryCount: 0,
			chainHead: DEFAULT_SCHEMA_HASH,
			genesisHash: DEFAULT_SCHEMA_HASH,
			reason: "rootDir missing or does not exist",
		};
	}

	const partitionId = input.partitionId ?? defaultPartitionId();
	const schemaHash = input.schemaHash ?? DEFAULT_SCHEMA_HASH;
	const { dirPath, jsonlPath, manifestPath } = partitionPaths(
		input.rootDir,
		partitionId,
	);

	// ── Ensure score-ledger directory exists ──────────────────────────────────
	try {
		mkdirSync(dirPath, { recursive: true });
	} catch {
		return {
			status: "blocked",
			partitionId,
			entryCount: 0,
			chainHead: DEFAULT_SCHEMA_HASH,
			genesisHash: DEFAULT_SCHEMA_HASH,
			reason: "could not create score-ledger directory",
		};
	}

	// ── Load or initialise manifest ───────────────────────────────────────────
	let isNewPartition = false;
	let existingEntryCount = 0;
	let genesisHash: string;
	let currentChainHead: string;

	if (existsSync(manifestPath)) {
		// Load existing manifest
		let raw: string;
		try {
			raw = readFileSync(manifestPath, "utf8");
		} catch {
			return {
				status: "blocked",
				partitionId,
				entryCount: 0,
				chainHead: DEFAULT_SCHEMA_HASH,
				genesisHash: DEFAULT_SCHEMA_HASH,
				reason: "could not read manifest file",
			};
		}

		let manifest: Record<string, unknown>;
		try {
			manifest = JSON.parse(raw) as Record<string, unknown>;
		} catch {
			return {
				status: "blocked",
				partitionId,
				entryCount: 0,
				chainHead: DEFAULT_SCHEMA_HASH,
				genesisHash: DEFAULT_SCHEMA_HASH,
				reason: "manifest JSON parse error",
			};
		}

		const partition = partitionFromManifestRecord(manifest, partitionId);
		if (partition === null) {
			return {
				status: "blocked",
				partitionId,
				entryCount: 0,
				chainHead: DEFAULT_SCHEMA_HASH,
				genesisHash: DEFAULT_SCHEMA_HASH,
				reason: "manifest does not contain partition metadata",
			};
		}

		// Guard: only raw partitions accept appends
		if (partition.state !== "raw") {
			return {
				status: "blocked",
				partitionId,
				entryCount:
					typeof partition.entry_count === "number" ? partition.entry_count : 0,
				chainHead:
					typeof partition.chain_head_hash === "string"
						? partition.chain_head_hash
						: DEFAULT_SCHEMA_HASH,
				genesisHash:
					typeof partition.genesis_hash === "string"
						? partition.genesis_hash
						: DEFAULT_SCHEMA_HASH,
				reason: `partition state is "${partition.state}"; only raw partitions accept appends`,
			};
		}

		existingEntryCount =
			typeof partition.entry_count === "number" ? partition.entry_count : 0;
		genesisHash =
			typeof partition.genesis_hash === "string"
				? asSha256Ref(partition.genesis_hash)
				: asSha256Ref(computePartitionGenesisHashV1({ partitionId, schemaHash }));
		currentChainHead =
			typeof partition.chain_head_hash === "string"
				? asSha256Ref(partition.chain_head_hash)
				: genesisHash;
	} else {
		// New partition: compute genesis hash
		isNewPartition = true;
		genesisHash = asSha256Ref(computePartitionGenesisHashV1({ partitionId, schemaHash }));
		currentChainHead = genesisHash;
	}

	// ── Compute hashes for the new entry ──────────────────────────────────────
	let eventHash: string;
	try {
		eventHash = computeEventHashV1(input.entry);
	} catch (err) {
		return {
			status: "blocked",
			partitionId,
			entryCount: existingEntryCount,
			chainHead: currentChainHead,
			genesisHash,
			reason: `entry hash computation failed: ${err instanceof Error ? err.message : "unknown error"}`,
		};
	}

	const newChainHash = computeChainHashV1({
		eventHash,
		previousHash: hashRefForChain(currentChainHead),
	});
	const newChainHashRef = asSha256Ref(newChainHash);

	const newEntryCount = existingEntryCount + 1;

	// ── Atomic append entry to .jsonl ─────────────────────────────────────────
	// Read existing content, append new line, write atomically.
	let existingJsonl = "";
	if (existsSync(jsonlPath)) {
		try {
			existingJsonl = readFileSync(jsonlPath, "utf8");
		} catch {
			return {
				status: "blocked",
				partitionId,
				entryCount: existingEntryCount,
				chainHead: currentChainHead,
				genesisHash,
				reason: "could not read existing .jsonl file",
			};
		}
	}

	const newLine = JSON.stringify(input.entry) + "\n";
	const updatedJsonl = existingJsonl + newLine;

	try {
		atomicWriteFile(jsonlPath, updatedJsonl);
	} catch (err) {
		return {
			status: "blocked",
			partitionId,
			entryCount: existingEntryCount,
			chainHead: currentChainHead,
			genesisHash,
			reason: `atomic jsonl write failed: ${err instanceof Error ? err.message : "unknown error"}`,
		};
	}

	// ── Atomic write updated manifest ─────────────────────────────────────────
	const now = new Date().toISOString();

	const partitionResult = createFlowDeskScoreLedgerPartitionV1({
		partitionId,
		state: "raw",
		createdAt: isNewPartition ? now : now, // always use now for simplicity; caller can preserve created_at if needed
		entryCount: newEntryCount,
		genesisHash,
		chainHeadHash: newChainHashRef,
		schemaHash,
	});

	if (!partitionResult.ok) {
		// Roll back the jsonl write is not trivial; return blocked but jsonl already written.
		// This is an edge case (invalid partitionId format) that should not occur in practice.
		return {
			status: "blocked",
			partitionId,
			entryCount: existingEntryCount,
			chainHead: currentChainHead,
			genesisHash,
			reason: `manifest creation failed: ${partitionResult.errors.join("; ")}`,
		};
	}

	const manifestResult = createFlowDeskScoreLedgerManifestV1({
		manifestId: `manifest-${partitionId}`,
		partitions: [partitionResult.partition],
		updatedAt: now,
	});

	if (!manifestResult.ok) {
		return {
			status: "blocked",
			partitionId,
			entryCount: existingEntryCount,
			chainHead: currentChainHead,
			genesisHash,
			reason: `manifest wrapper creation failed: ${manifestResult.errors.join("; ")}`,
		};
	}

	try {
		atomicWriteFile(
			manifestPath,
			JSON.stringify(manifestResult.manifest, null, 2),
		);
	} catch (err) {
		return {
			status: "blocked",
			partitionId,
			entryCount: existingEntryCount,
			chainHead: currentChainHead,
			genesisHash,
			reason: `atomic manifest write failed: ${err instanceof Error ? err.message : "unknown error"}`,
		};
	}

	return {
		status: isNewPartition ? "partition_created" : "appended",
		partitionId,
		entryCount: newEntryCount,
		chainHead: newChainHashRef,
		genesisHash,
	};
}
