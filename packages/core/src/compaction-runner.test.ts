import assert from "node:assert/strict";
import { existsSync, lstatSync, mkdtempSync, mkdirSync, readFileSync, readdirSync, rmSync, symlinkSync, utimesSync, writeFileSync, realpathSync } from "node:fs";
import { tmpdir, homedir } from "node:os";
import { join, resolve } from "node:path";
import { gunzipSync } from "node:zlib";
import test from "node:test";
import { compactAgentTaskProgressFilesV1, createFlowDeskLedgerRetentionPolicyV1 } from "./index.js";

function tempStateRoot(): string {
	const parent = mkdtempSync(join(tmpdir(), "flowdesk-compaction-"));
	const root = join(parent, ".flowdesk");
	mkdirSync(root);
	return realpathSync(root);
}

function writePolicy(root: string, days = 1): void {
	writeFileSync(join(root, "ledger-retention-policy.json"), `${JSON.stringify(createFlowDeskLedgerRetentionPolicyV1({ max_score_age_days: days }), null, 2)}\n`, "utf8");
}

function progressDir(root: string): string {
	const dir = join(root, "sessions", "session-1", "evidence", "agent-task-progress");
	mkdirSync(dir, { recursive: true });
	return dir;
}

function writeProgress(root: string, name: string, old = true): string {
	const file = join(progressDir(root), name);
	writeFileSync(file, JSON.stringify({ schema_version: "flowdesk.agent_task_progress.v1", evidence_id: name }), "utf8");
	const when = old ? new Date("2026-01-01T00:00:00.000Z") : new Date("2026-01-03T23:00:00.000Z");
	utimesSync(file, when, when);
	return file;
}

async function run(root: string, extra: Partial<Parameters<typeof compactAgentTaskProgressFilesV1>[0]> = {}) {
	return compactAgentTaskProgressFilesV1({ stateRoot: root, ttlDays: 99, dryRun: false, lockTimeoutMs: 250, now: new Date("2026-01-04T00:00:00.000Z"), ...extra });
}

test("compaction path safety rejects root, home, symlinked root, and traversal paths", async () => {
	const root = tempStateRoot();
	const link = `${root}-link`;
	symlinkSync(root, link);
	assert.match((await run("/")).failedReason ?? "", /unsafe_state_root_root_directory/);
	assert.match((await run(homedir())).failedReason ?? "", /unsafe_state_root_home_directory/);
	assert.match((await run(link)).failedReason ?? "", /unsafe_state_root_symlink|unsafe_state_root_not_canonical|unsafe_state_root_not_directory/);
	assert.match((await run(`${root}/..`)).failedReason ?? "", /unsafe_state_root_traversal|not_canonical/);
	rmSync(resolve(root, ".."), { recursive: true, force: true });
});

test("compaction reads TTL from durable retention policy and fails closed when missing", async () => {
	const root = tempStateRoot();
	const stale = writeProgress(root, "agent-task-progress-lane-1.json");
	const missing = await run(root);
	assert.equal(missing.failedReason, "missing_ledger_retention_policy");
	assert.equal(existsSync(stale), true);
	writePolicy(root, 1);
	const ok = await run(root);
	assert.equal(ok.ageFilterApplied.ttlDays, 1);
	assert.equal(existsSync(stale), false);
	assert.equal(existsSync(join(root, `compaction-evidence-${ok.compactionId}.json`)), true);
	rmSync(resolve(root, ".."), { recursive: true, force: true });
});

test("exclusive lock causes concurrent compaction to fail gracefully when lock cannot be acquired", async () => {
	const root = tempStateRoot();
	writePolicy(root, 1);
	mkdirSync(join(root, ".locks", "agent-task-progress-compaction.lock"), { recursive: true });
	writeFileSync(join(root, ".locks", "agent-task-progress-compaction.lock", "acquired_at.json"), JSON.stringify({ acquired_at: new Date().toISOString() }), "utf8");
	const result = await run(root, { lockTimeoutMs: 10 });
	assert.match(result.failedReason ?? "", /compaction_lock_timeout/);
	rmSync(resolve(root, ".."), { recursive: true, force: true });
});

test("compaction only matches agent-task-progress files and leaves unrelated files untouched", async () => {
	const root = tempStateRoot();
	writePolicy(root, 1);
	const stale = writeProgress(root, "agent-task-progress-lane-2.json");
	const other = join(progressDir(root), "task-result-lane-2.json");
	writeFileSync(other, "{}", "utf8");
	const result = await run(root);
	assert.equal(result.filesProcessed.removed, 1);
	assert.equal(existsSync(stale), false);
	assert.equal(existsSync(other), true);
	rmSync(resolve(root, ".."), { recursive: true, force: true });
});

test("dry-run reports stale files without deleting or archiving them", async () => {
	const root = tempStateRoot();
	writePolicy(root, 1);
	const stale = writeProgress(root, "agent-task-progress-dry-run.json");
	const result = await run(root, { dryRun: true });
	assert.equal(result.filesProcessed.removed, 1);
	assert.equal(result.filesProcessed.archived, 0);
	assert.equal(existsSync(stale), true);
	assert.equal(existsSync(join(root, "archive", result.compactionId)), false);
	rmSync(resolve(root, ".."), { recursive: true, force: true });
});

test("execute archives gzip files, deletes originals, and changes merkle roots", async () => {
	const root = tempStateRoot();
	writePolicy(root, 1);
	const stale = writeProgress(root, "agent-task-progress-execute.json");
	const result = await run(root);
	assert.equal(result.filesProcessed.archived, 1);
	assert.equal(result.filesProcessed.removed, 1);
	assert.notEqual(result.merkleRootBefore, result.merkleRootAfter);
	assert.equal(existsSync(stale), false);
	const archiveFile = join(root, "archive", result.compactionId, "agent-task-progress-execute.json.gz");
	assert.equal(existsSync(archiveFile), true);
	assert.match(gunzipSync(readFileSync(archiveFile)).toString("utf8"), /flowdesk.agent_task_progress.v1/);
	rmSync(resolve(root, ".."), { recursive: true, force: true });
});

test("merkle root integrity and durable evidence record are preserved", async () => {
	const root = tempStateRoot();
	writePolicy(root, 1);
	writeProgress(root, "agent-task-progress-integrity.json");
	const result = await run(root);
	assert.match(result.merkleRootBefore, /^[a-f0-9]{64}$/);
	assert.match(result.merkleRootAfter, /^[a-f0-9]{64}$/);
	const evidencePath = join(root, `compaction-evidence-${result.compactionId}.json`);
	const saved = JSON.parse(readFileSync(evidencePath, "utf8"));
	assert.equal(saved.schema_version, "flowdesk.compaction_evidence.v1");
	assert.equal(saved.merkleRootBefore, result.merkleRootBefore);
	assert.equal(lstatSync(evidencePath).isFile(), true);
	rmSync(resolve(root, ".."), { recursive: true, force: true });
});

test("partial delete failure records error count and continues remaining files", async () => {
	const root = tempStateRoot();
	writePolicy(root, 1);
	const fail = writeProgress(root, "agent-task-progress-delete-fail.json");
	const ok = writeProgress(root, "agent-task-progress-delete-ok.json");
	const result = await run(root, { deleteFile: (path) => { if (path === fail) throw new Error("simulated delete failure"); rmSync(path); } });
	assert.equal(result.filesProcessed.errors, 1);
	assert.equal(result.filesProcessed.removed, 1);
	assert.equal(result.failedReason, "partial_failure: 1 files");
	assert.equal(existsSync(fail), true);
	assert.equal(existsSync(ok), false);
	const archiveEntries = readdirSync(join(root, "archive", result.compactionId));
	assert.equal(archiveEntries.length, 2);
	rmSync(resolve(root, ".."), { recursive: true, force: true });
});
