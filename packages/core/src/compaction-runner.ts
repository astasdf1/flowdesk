import { createHash, randomUUID } from "node:crypto";
import {
	existsSync,
	lstatSync,
	mkdirSync,
	readdirSync,
	readFileSync,
	realpathSync,
	rmSync,
	statSync,
	unlinkSync,
	writeFileSync,
} from "node:fs";
import { gzipSync } from "node:zlib";
import { basename, dirname, join, resolve, sep } from "node:path";
import { homedir } from "node:os";
import { validateFlowDeskLedgerRetentionPolicyV1, type FlowDeskLedgerRetentionPolicyV1 } from "./operational-intelligence/routing-advisory.js";

export interface FlowDeskCompactionEvidenceV1 {
	schema_version: "flowdesk.compaction_evidence.v1";
	compactionId: string;
	compactionTriggeredAt: string;
	compactionCompletedAt: string | null;
	filesProcessed: { removed: number; archived: number; errors: number };
	ageFilterApplied: { minAgeMs: number; ttlDays: number };
	merkleRootBefore: string;
	merkleRootAfter: string;
	failedReason?: string;
	// Phase 8b additive fields (R-NEW-1 lock-path unification + script ledger support).
	// All optional; omitted entries remain valid evidence for back-compat callers.
	records_preserved_due_to_pending_gate_promotion?: number;
	lock_path?: string;
	records_quarantined?: number;
	compaction_run_id?: string;
}

/**
 * Canonical FlowDesk compaction lock path under a durable state root.
 *
 * Phase 8b R-NEW-1: both the federated-registry connector (publisher pre-check)
 * and the standalone `scripts/compact-flowdesk-ledger.mjs` runner reference this
 * single helper so the publisher lock and the script lock cannot drift.
 */
export function flowDeskCompactionLockPathV1(stateRoot: string): string {
	return join(stateRoot, ".locks", "compaction.lock");
}

export interface FlowDeskCompactionControlV1 {
	compactionEnabled: boolean;
	compactionAgeThresholdDays: number;
	lastCompactionEvidence?: string;
}

export interface FlowDeskCompactionHealthV1 {
	compactionEnabled: boolean;
	lastCompactionTime: string | null;
	lastCompactionResult: { filesRemoved: number; archived: number; errors: number };
	merkleRootMatch: boolean;
	lastCompactionEvidence?: string;
}

export interface FlowDeskCompactAgentTaskProgressFilesOptionsV1 {
	stateRoot: string;
	ttlDays: number;
	dryRun: boolean;
	lockTimeoutMs: number;
	now?: Date;
	deleteFile?: (path: string) => void;
}

const DAY_MS = 86_400_000;
const LOCK_STALE_TTL_MS = 60_000;
const PROGRESS_FILE_RE = /^agent-task-progress-[A-Za-z0-9_.:-]+\.json$/;

function emptyHash(): string {
	return createHash("sha256").update("", "utf8").digest("hex");
}

function merkleRootForFilenames(filenames: readonly string[]): string {
	if (filenames.length === 0) return emptyHash();
	return createHash("sha256").update([...filenames].sort().join("\n"), "utf8").digest("hex");
}

function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === "object" && value !== null && !Array.isArray(value);
}

function redactedReason(reason: string): string {
	return reason.replaceAll(/[\\/][^\s:,;]*/g, "[redacted-path]").slice(0, 240);
}

function validateStateRootSafety(stateRoot: string): { ok: true; canonical: string } | { ok: false; reason: string } {
	if (stateRoot.length === 0) return { ok: false, reason: "unsafe_state_root_empty" };
	if (stateRoot.includes(`${sep}..${sep}`) || stateRoot.endsWith(`${sep}..`)) return { ok: false, reason: "unsafe_state_root_traversal" };
	if (stateRoot !== resolve(stateRoot)) return { ok: false, reason: "unsafe_state_root_not_absolute" };
	if (stateRoot === sep) return { ok: false, reason: "unsafe_state_root_root_directory" };
	if (stateRoot === homedir()) return { ok: false, reason: "unsafe_state_root_home_directory" };
	try {
		const lst = lstatSync(stateRoot);
		if (!lst.isDirectory()) return { ok: false, reason: "unsafe_state_root_not_directory" };
		if (lst.isSymbolicLink()) return { ok: false, reason: "unsafe_state_root_symlink" };
		const canonical = realpathSync(stateRoot);
		if (canonical !== stateRoot) return { ok: false, reason: "unsafe_state_root_not_canonical" };
		const configured = process.env.FLOWDESK_STATE_ROOT;
		const resolvesToFlowDeskDirectory = basename(canonical) === ".flowdesk";
		if (configured !== undefined && configured.trim().length > 0) {
			const configuredResolved = realpathSync(resolve(configured));
			if (configuredResolved !== canonical && !resolvesToFlowDeskDirectory) return { ok: false, reason: "unsafe_state_root_mismatch_configured_root" };
		} else if (!resolvesToFlowDeskDirectory) {
			return { ok: false, reason: "unsafe_state_root_not_flowdesk_directory" };
		}
		return { ok: true, canonical };
	} catch {
		return { ok: false, reason: "unsafe_state_root_unreadable" };
	}
}

function writeCompactionEvidence(stateRoot: string, evidence: FlowDeskCompactionEvidenceV1): void {
	const target = join(stateRoot, `compaction-evidence-${evidence.compactionId}.json`);
	const temp = `${target}.tmp`;
	writeFileSync(temp, `${JSON.stringify(evidence, null, 2)}\n`, "utf8");
	if (existsSync(target)) throw new Error("compaction_evidence_already_exists");
	writeFileSync(target, readFileSync(temp));
	rmSync(temp, { force: true });
}

function safeEvidence(input: { compactionId: string; now: Date; ttlDays: number; failedReason?: string }): FlowDeskCompactionEvidenceV1 {
	return {
		schema_version: "flowdesk.compaction_evidence.v1",
		compactionId: input.compactionId,
		compactionTriggeredAt: input.now.toISOString(),
		compactionCompletedAt: input.failedReason === undefined ? input.now.toISOString() : null,
		filesProcessed: { removed: 0, archived: 0, errors: input.failedReason === undefined ? 0 : 1 },
		ageFilterApplied: { minAgeMs: Math.max(0, input.ttlDays) * DAY_MS, ttlDays: Math.max(0, input.ttlDays) },
		merkleRootBefore: emptyHash(),
		merkleRootAfter: emptyHash(),
		...(input.failedReason === undefined ? {} : { failedReason: input.failedReason }),
	};
}

function lockDir(stateRoot: string): string {
	return join(stateRoot, ".locks", "agent-task-progress-compaction.lock");
}

function lockIsStale(dir: string, now: Date): boolean {
	try {
		const parsed = JSON.parse(readFileSync(join(dir, "acquired_at.json"), "utf8")) as unknown;
		const acquiredAt = isRecord(parsed) && typeof parsed.acquired_at === "string" ? Date.parse(parsed.acquired_at) : NaN;
		return !Number.isFinite(acquiredAt) || now.getTime() - acquiredAt > LOCK_STALE_TTL_MS;
	} catch {
		return true;
	}
}

function tryAcquireLock(dir: string, now: Date): boolean {
	try {
		mkdirSync(dir);
		writeFileSync(join(dir, "acquired_at.json"), `${JSON.stringify({ acquired_at: now.toISOString() }, null, 2)}\n`, "utf8");
		return true;
	} catch {
		return false;
	}
}

async function acquireLock(stateRoot: string, timeoutMs: number, now: Date): Promise<() => void> {
	const dir = lockDir(stateRoot);
	mkdirSync(dirname(dir), { recursive: true });
	const deadline = Date.now() + Math.max(0, timeoutMs);
	for (;;) {
		if (tryAcquireLock(dir, now)) return () => rmSync(dir, { recursive: true, force: true });
		if (lockIsStale(dir, new Date())) {
			rmSync(dir, { recursive: true, force: true });
			if (tryAcquireLock(dir, now)) return () => rmSync(dir, { recursive: true, force: true });
		}
		if (Date.now() >= deadline) throw new Error("compaction_lock_timeout");
		await new Promise((resolveSleep) => setTimeout(resolveSleep, 25));
	}
}

function loadRetentionPolicy(stateRoot: string): FlowDeskLedgerRetentionPolicyV1 | undefined {
	const stack = [stateRoot];
	while (stack.length > 0) {
		const dir = stack.pop()!;
		for (const entry of readdirSync(dir)) {
			if (entry === "archive" || entry === ".locks") continue;
			const path = join(dir, entry);
			const lst = lstatSync(path);
			if (lst.isSymbolicLink()) continue;
			if (lst.isDirectory()) stack.push(path);
			else if (lst.isFile() && entry.endsWith(".json")) {
				try {
					const parsed = JSON.parse(readFileSync(path, "utf8")) as unknown;
					if (isRecord(parsed) && parsed.schema_version === "flowdesk.ledger_retention_policy.v1" && validateFlowDeskLedgerRetentionPolicyV1(parsed).ok) return parsed as unknown as FlowDeskLedgerRetentionPolicyV1;
				} catch {
					// ignore malformed unrelated json artifacts
				}
			}
		}
	}
	return undefined;
}

function listProgressFiles(stateRoot: string): Array<{ path: string; filename: string; mtimeMs: number }> {
	const files: Array<{ path: string; filename: string; mtimeMs: number }> = [];
	const stack = [stateRoot];
	while (stack.length > 0) {
		const dir = stack.pop()!;
		for (const entry of readdirSync(dir)) {
			if (entry === "archive" || entry === ".locks") continue;
			const path = join(dir, entry);
			const lst = lstatSync(path);
			if (lst.isSymbolicLink()) continue;
			if (lst.isDirectory()) stack.push(path);
			else if (lst.isFile() && entry.startsWith("agent-task-progress-")) {
				if (!PROGRESS_FILE_RE.test(entry)) throw new Error(`unknown_agent_task_progress_pattern:${entry.replaceAll(/[^A-Za-z0-9_.:-]/g, "-")}`);
				files.push({ path, filename: entry, mtimeMs: lst.mtimeMs });
			}
		}
	}
	return files;
}

function remainingProgressFilenames(stateRoot: string): string[] {
	return listProgressFiles(stateRoot).map((file) => file.filename);
}

export async function compactAgentTaskProgressFilesV1(options: FlowDeskCompactAgentTaskProgressFilesOptionsV1): Promise<FlowDeskCompactionEvidenceV1> {
	const now = options.now ?? new Date();
	const compactionId = `compaction-${randomUUID()}`;
	const safety = validateStateRootSafety(options.stateRoot);
	if (!safety.ok) return safeEvidence({ compactionId, now, ttlDays: options.ttlDays, failedReason: safety.reason });
	const stateRoot = safety.canonical;
	let release: (() => void) | undefined;
	try {
		release = await acquireLock(stateRoot, options.lockTimeoutMs, now);
		const policy = loadRetentionPolicy(stateRoot);
		if (policy === undefined) {
			const evidence = safeEvidence({ compactionId, now, ttlDays: options.ttlDays, failedReason: "missing_ledger_retention_policy" });
			writeCompactionEvidence(stateRoot, evidence);
			return evidence;
		}
		const ttlDays = policy.max_score_age_days;
		const minAgeMs = ttlDays * DAY_MS;
		const all = listProgressFiles(stateRoot);
		const before = merkleRootForFilenames(all.map((file) => file.filename));
		const cutoff = now.getTime() - minAgeMs;
		const stale = all.filter((file) => file.mtimeMs < cutoff);
		release();
		release = undefined;
		const filesProcessed = { removed: 0, archived: 0, errors: 0 };
		if (!options.dryRun) {
			const archiveDir = join(stateRoot, "archive", compactionId);
			mkdirSync(archiveDir, { recursive: true });
			for (const file of stale) {
				try {
					const current = lstatSync(file.path);
					if (!current.isFile() || current.isSymbolicLink()) throw new Error("not_regular_file");
					writeFileSync(join(archiveDir, `${file.filename}.gz`), gzipSync(readFileSync(file.path)));
					filesProcessed.archived += 1;
				} catch {
					filesProcessed.errors += 1;
				}
			}
			release = await acquireLock(stateRoot, options.lockTimeoutMs, new Date());
			for (const file of stale) {
				try {
					const current = lstatSync(file.path);
					if (!current.isFile() || current.isSymbolicLink()) throw new Error("not_regular_file");
					(options.deleteFile ?? unlinkSync)(file.path);
					filesProcessed.removed += 1;
				} catch (error) {
					filesProcessed.errors += 1;
					void redactedReason(error instanceof Error ? error.message : "delete_failed");
				}
			}
		}
		const after = merkleRootForFilenames(remainingProgressFilenames(stateRoot));
		const evidence: FlowDeskCompactionEvidenceV1 = {
			schema_version: "flowdesk.compaction_evidence.v1",
			compactionId,
			compactionTriggeredAt: now.toISOString(),
			compactionCompletedAt: new Date().toISOString(),
			filesProcessed: options.dryRun ? { removed: stale.length, archived: 0, errors: 0 } : filesProcessed,
			ageFilterApplied: { minAgeMs, ttlDays },
			merkleRootBefore: before,
			merkleRootAfter: after,
			...(filesProcessed.errors > 0 ? { failedReason: `partial_failure: ${filesProcessed.errors} files` } : {}),
		};
		writeCompactionEvidence(stateRoot, evidence);
		return evidence;
	} catch (error) {
		const evidence = safeEvidence({ compactionId, now, ttlDays: options.ttlDays, failedReason: redactedReason(error instanceof Error ? error.message : "compaction_failed") });
		try { writeCompactionEvidence(stateRoot, evidence); } catch { /* fail closed without delete */ }
		return evidence;
	} finally {
		if (release !== undefined) release();
	}
}

export function loadFlowDeskCompactionHealthV1(stateRoot: string, compactionEnabled = false): FlowDeskCompactionHealthV1 {
	const base = { compactionEnabled, lastCompactionTime: null, lastCompactionResult: { filesRemoved: 0, archived: 0, errors: 0 }, merkleRootMatch: true };
	try {
		const safety = validateStateRootSafety(stateRoot);
		if (!safety.ok) return { ...base, merkleRootMatch: false };
		const records = readdirSync(safety.canonical)
			.filter((entry) => /^compaction-evidence-compaction-[A-Za-z0-9-]+\.json$/.test(entry))
			.map((entry) => ({ entry, path: join(safety.canonical, entry), stat: statSync(join(safety.canonical, entry)) }))
			.sort((a, b) => b.stat.mtimeMs - a.stat.mtimeMs);
		const latest = records[0];
		if (latest === undefined) return base;
		const parsed = JSON.parse(readFileSync(latest.path, "utf8")) as unknown;
		if (!isRecord(parsed)) return { ...base, merkleRootMatch: false };
		return {
			compactionEnabled,
			lastCompactionTime: typeof parsed.compactionCompletedAt === "string" ? parsed.compactionCompletedAt : null,
			lastCompactionResult: {
				filesRemoved: isRecord(parsed.filesProcessed) && typeof parsed.filesProcessed.removed === "number" ? parsed.filesProcessed.removed : 0,
				archived: isRecord(parsed.filesProcessed) && typeof parsed.filesProcessed.archived === "number" ? parsed.filesProcessed.archived : 0,
				errors: isRecord(parsed.filesProcessed) && typeof parsed.filesProcessed.errors === "number" ? parsed.filesProcessed.errors : 0,
			},
			merkleRootMatch: typeof parsed.merkleRootAfter === "string" && parsed.merkleRootAfter === merkleRootForFilenames(remainingProgressFilenames(safety.canonical)),
			lastCompactionEvidence: latest.entry.replace(/\.json$/, ""),
		};
	} catch {
		return { ...base, merkleRootMatch: false };
	}
}
