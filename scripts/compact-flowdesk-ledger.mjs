#!/usr/bin/env node
/**
 * FlowDesk ledger compaction runner (Phase 8b).
 *
 * Standalone Node script that walks a configured FlowDesk durable state root,
 * removes expired ledger / progress records under the retention policy TTL,
 * and writes a redacted `flowdesk.compaction_evidence.v1` record. Designed to
 * be invoked manually or from cron / CI; never from inside the plugin runtime.
 *
 * Hard rules:
 *   1. Uses only `node:fs` (no `child_process.exec` / spawn).
 *   2. `--root` is resolved + realpath'd; rejected on `..` segments, symlinks,
 *      `/`, `$HOME`, or non-`.flowdesk/` basename.
 *   3. `.git` and `node_modules` are hard-denied directory names anywhere
 *      under the root walk, regardless of nesting.
 *   4. TTL source of truth is `flowdesk.ledger_retention_policy.v1` (the
 *      single durable policy document). `--max-age-days` may only NARROW
 *      that TTL (i.e. delete more aggressively); it may never widen it.
 *   5. Exclusive lock at `<root>/.locks/compaction.lock` (atomic mkdir-style
 *      flock pattern). Lock held → exit 0 with skip message (NOT an error,
 *      so cron concurrent runs are safe).
 *   6. Records whose JSON payload carries `publication_state === "pending_gate_promotion"`
 *      are unconditionally preserved (federated publication contract).
 *   7. Records that fail deletion are MOVED to
 *      `<root>/quarantine/<timestamp>-<sha>/` instead of being lost.
 *   8. `flowdesk.compaction_evidence.v1` written under the root with the new
 *      Phase 8b fields (compaction_run_id, lock_path, records_quarantined,
 *      records_preserved_due_to_pending_gate_promotion).
 *
 * Authority: this script does NOT grant dispatch / fallback / provider /
 * remote-write / lane-launch authority. It only performs local file-system
 * compaction under the configured durable state root.
 */

import {
	closeSync,
	existsSync,
	lstatSync,
	mkdirSync,
	openSync,
	readdirSync,
	readFileSync,
	realpathSync,
	renameSync,
	rmSync,
	statSync,
	unlinkSync,
	writeFileSync,
} from "node:fs";
import { createHash, randomUUID } from "node:crypto";
import { homedir } from "node:os";
import { basename, join, resolve, sep } from "node:path";
import { argv, exit, stderr, stdout } from "node:process";

const DAY_MS = 86_400_000;
const HARD_DENY_DIR_NAMES = new Set([".git", "node_modules"]);

/** Parse CLI args (minimal, no third-party). */
function parseArgs(args) {
	const out = { root: undefined, maxAgeDays: undefined, dryRun: false };
	for (let i = 0; i < args.length; i += 1) {
		const arg = args[i];
		if (arg === "--root") {
			out.root = args[i + 1];
			i += 1;
		} else if (arg === "--max-age-days") {
			out.maxAgeDays = Number(args[i + 1]);
			i += 1;
		} else if (arg === "--dry-run") {
			out.dryRun = true;
		} else if (arg === "--help" || arg === "-h") {
			out.help = true;
		}
	}
	return out;
}

function printHelp() {
	stdout.write([
		"Usage: node scripts/compact-flowdesk-ledger.mjs --root <durable-state-root> [--max-age-days N] [--dry-run]",
		"",
		"  --root           Absolute, canonical path to the FlowDesk durable state root (.flowdesk).",
		"  --max-age-days   Optional narrowing TTL; must be <= the policy TTL.",
		"  --dry-run        Walk the root and report what would be removed; do not delete.",
		"",
		"Exits 0 on success or when the lock is already held by another runner.",
		"Exits non-zero on validation / IO / safety failures.",
		"",
	].join("\n"));
}

/** Strict root-path safety validation; mirrors compaction-runner.ts. */
function validateRoot(rawRoot) {
	if (typeof rawRoot !== "string" || rawRoot.length === 0) return { ok: false, reason: "root_missing" };
	if (rawRoot.includes(`${sep}..${sep}`) || rawRoot.endsWith(`${sep}..`)) {
		return { ok: false, reason: "root_contains_traversal" };
	}
	const resolved = resolve(rawRoot);
	// If resolve() changed the path it means the input contained traversal
	// segments, relative segments, or was not canonical → refuse.
	if (resolved !== rawRoot) return { ok: false, reason: "root_not_absolute" };
	if (resolved === sep) return { ok: false, reason: "root_is_filesystem_root" };
	if (resolved === homedir()) return { ok: false, reason: "root_is_home_directory" };
	let canonical;
	try {
		const lst = lstatSync(resolved);
		// Reject symlinks first so a symlinked directory is refused before the
		// isDirectory() check (which would otherwise return root_not_directory).
		if (lst.isSymbolicLink()) return { ok: false, reason: "root_is_symlink" };
		if (!lst.isDirectory()) return { ok: false, reason: "root_not_directory" };
		canonical = realpathSync(resolved);
	} catch {
		return { ok: false, reason: "root_unreadable" };
	}
	if (canonical !== resolved) return { ok: false, reason: "root_not_canonical" };
	if (basename(canonical) !== ".flowdesk") return { ok: false, reason: "root_basename_not_flowdesk" };
	return { ok: true, canonical };
}

/** Walk root, skipping deny-listed and symlink entries. */
function* walkSafely(dir) {
	let entries;
	try {
		entries = readdirSync(dir);
	} catch {
		return;
	}
	for (const entry of entries) {
		if (HARD_DENY_DIR_NAMES.has(entry)) continue;
		if (entry === ".locks" || entry === "archive" || entry === "quarantine") continue;
		const full = join(dir, entry);
		let st;
		try {
			st = lstatSync(full);
		} catch {
			continue;
		}
		if (st.isSymbolicLink()) continue;
		if (st.isDirectory()) {
			yield* walkSafely(full);
		} else if (st.isFile()) {
			yield { path: full, name: entry, mtimeMs: st.mtimeMs };
		}
	}
}

/** Locate flowdesk.ledger_retention_policy.v1 under the root. */
function loadRetentionPolicy(root) {
	for (const file of walkSafely(root)) {
		if (!file.name.endsWith(".json")) continue;
		try {
			const parsed = JSON.parse(readFileSync(file.path, "utf8"));
			if (parsed && typeof parsed === "object" && parsed.schema_version === "flowdesk.ledger_retention_policy.v1") {
				if (typeof parsed.max_score_age_days === "number" && Number.isFinite(parsed.max_score_age_days) && parsed.max_score_age_days > 0) {
					return parsed;
				}
			}
		} catch {
			// ignore unrelated / malformed json artifacts
		}
	}
	return undefined;
}

/** Atomic lock acquisition: open with O_EXCL semantics via writeFile + wx. */
function tryAcquireLock(lockPath) {
	try {
		mkdirSync(join(lockPath, ".."), { recursive: true });
		const fd = openSync(lockPath, "wx");
		writeFileSync(fd, JSON.stringify({
			acquired_at: new Date().toISOString(),
			pid: process.pid,
		}, null, 2) + "\n");
		closeSync(fd);
		return true;
	} catch {
		return false;
	}
}

function releaseLock(lockPath) {
	try { unlinkSync(lockPath); } catch { /* best-effort */ }
}

/** Detect a record that must NEVER be deleted: federated publication still pending gate promotion. */
function isPendingGatePromotion(parsedJson) {
	if (!parsedJson || typeof parsedJson !== "object") return false;
	const schemaVersion = parsedJson.schema_version;
	const publicationState = parsedJson.publication_state ?? parsedJson.publicationState;
	return typeof schemaVersion === "string" &&
		schemaVersion.includes("publication_result") &&
		publicationState === "pending_gate_promotion";
}

function quarantineRecord(root, file) {
	const sha = createHash("sha256").update(file.path, "utf8").digest("hex").slice(0, 16);
	const stamp = new Date().toISOString().replace(/[:.]/g, "-");
	const qDir = join(root, "quarantine", `${stamp}-${sha}`);
	mkdirSync(qDir, { recursive: true });
	const target = join(qDir, file.name);
	renameSync(file.path, target);
	return target;
}

function shortHash(value) {
	return createHash("sha256").update(value, "utf8").digest("hex");
}

async function main() {
	const args = parseArgs(argv.slice(2));
	if (args.help) {
		printHelp();
		return 0;
	}
	const safety = validateRoot(args.root);
	if (!safety.ok) {
		stderr.write(`compact-flowdesk-ledger: refused (${safety.reason})\n`);
		return 2;
	}
	const root = safety.canonical;
	const lockPath = join(root, ".locks", "compaction.lock");

	// Concurrency guard: lock held → exit 0 with a skip note (NOT error).
	if (existsSync(lockPath)) {
		stdout.write(`compact-flowdesk-ledger: lock already held at ${lockPath}; skipping.\n`);
		return 0;
	}
	if (!tryAcquireLock(lockPath)) {
		stdout.write(`compact-flowdesk-ledger: could not acquire lock at ${lockPath}; skipping.\n`);
		return 0;
	}

	const compactionId = `compaction-${randomUUID()}`;
	const compactionRunId = `${Date.now().toString(36)}-${randomUUID()}`;
	const triggeredAt = new Date();
	let evidence;
	try {
		const policy = loadRetentionPolicy(root);
		if (!policy) {
			evidence = {
				schema_version: "flowdesk.compaction_evidence.v1",
				compactionId,
				compactionTriggeredAt: triggeredAt.toISOString(),
				compactionCompletedAt: null,
				filesProcessed: { removed: 0, archived: 0, errors: 1 },
				ageFilterApplied: { minAgeMs: 0, ttlDays: 0 },
				merkleRootBefore: shortHash(""),
				merkleRootAfter: shortHash(""),
				failedReason: "missing_ledger_retention_policy",
				compaction_run_id: compactionRunId,
				lock_path: lockPath,
				records_quarantined: 0,
				records_preserved_due_to_pending_gate_promotion: 0,
			};
			stderr.write("compact-flowdesk-ledger: refused (missing_ledger_retention_policy)\n");
			return 3;
		}

		const policyTtlDays = policy.max_score_age_days;
		// Narrowing-only: CLI override must be <= policy TTL (delete sooner, not later).
		let effectiveTtlDays = policyTtlDays;
		if (typeof args.maxAgeDays === "number" && Number.isFinite(args.maxAgeDays) && args.maxAgeDays > 0) {
			if (args.maxAgeDays > policyTtlDays) {
				stderr.write(`compact-flowdesk-ledger: refused (--max-age-days ${args.maxAgeDays} > policy ${policyTtlDays}; narrowing only)\n`);
				return 4;
			}
			effectiveTtlDays = args.maxAgeDays;
		}
		const minAgeMs = effectiveTtlDays * DAY_MS;
		const cutoff = triggeredAt.getTime() - minAgeMs;

		const allFiles = Array.from(walkSafely(root));
		const namesBefore = allFiles.map((file) => file.name).sort();
		const merkleRootBefore = shortHash(namesBefore.join("\n"));

		const counts = { removed: 0, archived: 0, errors: 0, quarantined: 0, preserved: 0 };

		for (const file of allFiles) {
			if (file.mtimeMs >= cutoff) continue;
			// Read once for pending-gate-promotion check.
			let parsed;
			try {
				parsed = JSON.parse(readFileSync(file.path, "utf8"));
			} catch {
				parsed = undefined;
			}
			if (parsed && isPendingGatePromotion(parsed)) {
				counts.preserved += 1;
				continue;
			}
			if (args.dryRun) {
				counts.removed += 1;
				continue;
			}
			try {
				unlinkSync(file.path);
				counts.removed += 1;
			} catch {
				try {
					quarantineRecord(root, file);
					counts.quarantined += 1;
				} catch {
					counts.errors += 1;
				}
			}
		}

		// Recompute remaining file names for merkle-root-after.
		const remaining = Array.from(walkSafely(root)).map((file) => file.name).sort();
		const merkleRootAfter = shortHash(remaining.join("\n"));

		evidence = {
			schema_version: "flowdesk.compaction_evidence.v1",
			compactionId,
			compactionTriggeredAt: triggeredAt.toISOString(),
			compactionCompletedAt: new Date().toISOString(),
			filesProcessed: { removed: counts.removed, archived: counts.archived, errors: counts.errors },
			ageFilterApplied: { minAgeMs, ttlDays: effectiveTtlDays },
			merkleRootBefore,
			merkleRootAfter,
			compaction_run_id: compactionRunId,
			lock_path: lockPath,
			records_quarantined: counts.quarantined,
			records_preserved_due_to_pending_gate_promotion: counts.preserved,
			...(counts.errors > 0 ? { failedReason: `partial_failure: ${counts.errors} files` } : {}),
		};
		return 0;
	} catch (error) {
		const message = error instanceof Error ? error.message : "compaction_failed";
		evidence = {
			schema_version: "flowdesk.compaction_evidence.v1",
			compactionId,
			compactionTriggeredAt: triggeredAt.toISOString(),
			compactionCompletedAt: null,
			filesProcessed: { removed: 0, archived: 0, errors: 1 },
			ageFilterApplied: { minAgeMs: 0, ttlDays: 0 },
			merkleRootBefore: shortHash(""),
			merkleRootAfter: shortHash(""),
			failedReason: message.replaceAll(/[\\/][^\s:,;]*/g, "[redacted-path]").slice(0, 240),
			compaction_run_id: compactionRunId,
			lock_path: lockPath,
			records_quarantined: 0,
			records_preserved_due_to_pending_gate_promotion: 0,
		};
		stderr.write(`compact-flowdesk-ledger: failed (${evidence.failedReason})\n`);
		return 5;
	} finally {
		if (evidence) {
			try {
				const evidencePath = join(root, `compaction-evidence-${compactionId}.json`);
				writeFileSync(evidencePath, JSON.stringify(evidence, null, 2) + "\n", "utf8");
				stdout.write(`compact-flowdesk-ledger: wrote ${evidencePath}\n`);
			} catch (writeErr) {
				stderr.write(`compact-flowdesk-ledger: could not persist evidence (${writeErr instanceof Error ? writeErr.message : "write_failed"})\n`);
			}
		}
		releaseLock(lockPath);
	}
}

main().then((code) => exit(code), (err) => {
	stderr.write(`compact-flowdesk-ledger: unexpected (${err instanceof Error ? err.message : "unknown"})\n`);
	exit(1);
});
