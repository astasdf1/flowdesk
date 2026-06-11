/**
 * OI Ledger Writer — P7-S04.
 *
 * appendRoutingAdvisoryEntryV1() atomically appends a FlowDeskRoutingAdvisoryLedgerEntryV1
 * to `.flowdesk/oi/routing-advisory.jsonl`, with:
 *   - O_EXCL lock file for mutual exclusion (fail-open on lock contention)
 *   - Dedup by (signature_ref, model_ref, recorded_at) composite key
 *   - Compaction trigger when entry count > 1000 or file size > 2MB
 *   - POSIX-atomic tmp-file → renameSync write pattern
 *
 * Advisory-only writer: no dispatch, provider, runtime, lane-launch,
 * fallback, write, or hard-chat authority.
 */
import { mkdirSync, openSync, closeSync, existsSync, readFileSync, writeFileSync, renameSync, unlinkSync } from "node:fs";
import { join } from "node:path";
import { randomBytes } from "node:crypto";
import {
	compactFlowDeskAdvisoryLedgerV1,
	createFlowDeskLedgerRetentionPolicyV1,
	decodeFlowDeskRoutingAdvisoryLedgerJsonlV1,
	type FlowDeskLedgerRetentionPolicyV1,
	type FlowDeskRoutingAdvisoryLedgerEntryV1,
} from "@flowdesk/core";

// ── Constants ─────────────────────────────────────────────────────────────────

const LEDGER_RELATIVE_PATH = join(".flowdesk", "oi", "routing-advisory.jsonl");
const LOCK_RELATIVE_PATH = join(".flowdesk", "oi", "routing-advisory.jsonl.lock");

/** Compaction triggers */
const COMPACTION_ENTRY_THRESHOLD = 1000;
const COMPACTION_SIZE_THRESHOLD_BYTES = 2 * 1024 * 1024; // 2 MB

// ── Public contract ───────────────────────────────────────────────────────────

export interface OILedgerAppendInputV1 {
	rootDir: string;
	entry: FlowDeskRoutingAdvisoryLedgerEntryV1;
	retentionPolicy?: FlowDeskLedgerRetentionPolicyV1;
	/** ISO timestamp override; defaults to new Date().toISOString() */
	now?: string;
}

export interface OILedgerAppendResultV1 {
	status: "appended" | "skipped_dedup" | "blocked";
	ledgerPath?: string;
	reason?: string;
	compactionTriggered?: boolean;
}

// ── Internal helpers ──────────────────────────────────────────────────────────

/**
 * Encode entries as JSONL (one stable-serialised line per entry, terminated
 * with a trailing newline). Returns an empty string for an empty array to
 * match the compaction module's own encoder.
 */
function encodeJsonl(entries: readonly FlowDeskRoutingAdvisoryLedgerEntryV1[]): string {
	if (entries.length === 0) return "";
	return `${entries.map((e) => JSON.stringify(e)).join("\n")}\n`;
}

/**
 * Derive a stable dedup key for an entry.
 * FlowDeskRoutingAdvisoryLedgerEntryV1 has no separate id field, so we use
 * the three natural key fields.
 */
function entryDedupKey(e: FlowDeskRoutingAdvisoryLedgerEntryV1): string {
	return `${e.signature_ref}|${e.model_ref}|${e.recorded_at}`;
}

/**
 * Acquire the O_EXCL lock file.
 * Returns the file descriptor on success, or -1 if the lock is held.
 */
function tryAcquireLock(lockPath: string): number {
	try {
		const fd = openSync(lockPath, "wx");
		return fd;
	} catch {
		return -1;
	}
}

/**
 * Release the lock file. Best-effort; never throws.
 */
function releaseLock(lockPath: string, fd: number): void {
	try {
		closeSync(fd);
	} catch {
		// best-effort close
	}
	try {
		unlinkSync(lockPath);
	} catch {
		// best-effort unlink
	}
}

// ── Main export ───────────────────────────────────────────────────────────────

/**
 * Atomically append one routing advisory ledger entry.
 *
 * Returns:
 *   - `appended`      — entry written successfully
 *   - `skipped_dedup` — entry with identical (signature_ref, model_ref, recorded_at) already present
 *   - `blocked`       — lock contention, missing rootDir, or unrecoverable I/O error (fail-open)
 */
export function appendRoutingAdvisoryEntryV1(
	input: OILedgerAppendInputV1,
): OILedgerAppendResultV1 {
	// ── Guard: rootDir must exist ──────────────────────────────────────────────
	if (
		typeof input.rootDir !== "string" ||
		input.rootDir.trim().length === 0 ||
		!existsSync(input.rootDir)
	) {
		return {
			status: "blocked",
			reason: "rootDir missing or does not exist",
		};
	}

	const ledgerPath = join(input.rootDir, LEDGER_RELATIVE_PATH);
	const lockPath = join(input.rootDir, LOCK_RELATIVE_PATH);
	const ledgerDir = join(input.rootDir, ".flowdesk", "oi");
	const now = input.now ?? new Date().toISOString();

	// ── Acquire lock (O_EXCL, fail-open) ─────────────────────────────────────
	let lockFd: number;
	try {
		mkdirSync(ledgerDir, { recursive: true });
	} catch {
		return { status: "blocked", reason: "could not create ledger directory" };
	}

	lockFd = tryAcquireLock(lockPath);
	if (lockFd === -1) {
		return {
			status: "blocked",
			reason: "lock file held by another writer",
		};
	}

	try {
		// ── Read existing entries ──────────────────────────────────────────────
		let existingEntries: FlowDeskRoutingAdvisoryLedgerEntryV1[] = [];
		let existingJsonl = "";

		if (existsSync(ledgerPath)) {
			try {
				existingJsonl = readFileSync(ledgerPath, "utf8");
				const decoded = decodeFlowDeskRoutingAdvisoryLedgerJsonlV1(existingJsonl);
				if (decoded.ok && decoded.entries) {
					existingEntries = decoded.entries;
				}
			} catch {
				// Treat as empty ledger — do not block on decode failure
				existingEntries = [];
				existingJsonl = "";
			}
		}

		// ── Dedup check ────────────────────────────────────────────────────────
		const incomingKey = entryDedupKey(input.entry);
		const isDuplicate = existingEntries.some(
			(e) => entryDedupKey(e) === incomingKey,
		);
		if (isDuplicate) {
			return {
				status: "skipped_dedup",
				ledgerPath,
				reason: "entry with same (signature_ref, model_ref, recorded_at) already present",
				compactionTriggered: false,
			};
		}

		// ── Build new entry list ───────────────────────────────────────────────
		const newEntries: FlowDeskRoutingAdvisoryLedgerEntryV1[] = [
			...existingEntries,
			input.entry,
		];

		// ── Compaction trigger ─────────────────────────────────────────────────
		let finalEntries = newEntries;
		let compactionTriggered = false;

		const currentSizeBytes = Buffer.byteLength(existingJsonl, "utf8");
		const shouldCompact =
			newEntries.length > COMPACTION_ENTRY_THRESHOLD ||
			currentSizeBytes > COMPACTION_SIZE_THRESHOLD_BYTES;

		if (shouldCompact) {
			const triggerReason =
				newEntries.length > COMPACTION_ENTRY_THRESHOLD
					? "count_limit"
					: "size_limit";

			const policy =
				input.retentionPolicy ?? createFlowDeskLedgerRetentionPolicyV1();

			const compactionResult = compactFlowDeskAdvisoryLedgerV1({
				entries: newEntries,
				policy,
				policyRef: "policy-ref-default",
				compactionId: `compaction-${randomBytes(8).toString("hex")}`,
				triggerReason,
				compactedAt: now,
			});

			if (compactionResult.ok && compactionResult.retainedEntries !== undefined) {
				finalEntries = compactionResult.retainedEntries;
				compactionTriggered = true;
			}
			// If compaction fails, fall through with uncompacted entries (fail-open)
		}

		// ── Atomic write: tmp → rename ─────────────────────────────────────────
		const tmpPath = `${ledgerPath}.tmp-${randomBytes(6).toString("hex")}`;
		const newJsonl = encodeJsonl(finalEntries);

		try {
			writeFileSync(tmpPath, newJsonl, "utf8");
			renameSync(tmpPath, ledgerPath);
		} catch (writeError) {
			// Best-effort cleanup of temp file
			try {
				unlinkSync(tmpPath);
			} catch {
				// ignore
			}
			return {
				status: "blocked",
				reason: `atomic write failed: ${writeError instanceof Error ? writeError.message : "unknown error"}`,
			};
		}

		return {
			status: "appended",
			ledgerPath,
			compactionTriggered,
		};
	} finally {
		releaseLock(lockPath, lockFd);
	}
}
