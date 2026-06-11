import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdirSync, mkdtempSync, readdirSync, readFileSync, realpathSync, rmSync, symlinkSync, utimesSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";
import { createFlowDeskLedgerRetentionPolicyV1 } from "./index.js";

// Tests for scripts/compact-flowdesk-ledger.mjs (Phase 8b). The script is a
// standalone .mjs runner under the workspace `scripts/` folder; the tests
// invoke it through `node` and inspect the durable evidence + filesystem
// effects under a temp `.flowdesk/` directory.

const SCRIPT_PATH = (() => {
	// __dirname at runtime (post-build): packages/core/dist
	const here = dirname(fileURLToPath(import.meta.url));
	// repo root is three levels up from dist (.../packages/core/dist → repo root)
	return resolve(here, "..", "..", "..", "scripts", "compact-flowdesk-ledger.mjs");
})();

function tempFlowDeskRoot(): { parent: string; root: string } {
	const parent = mkdtempSync(join(tmpdir(), "flowdesk-compaction-script-"));
	const root = join(parent, ".flowdesk");
	mkdirSync(root);
	return { parent, root: realpathSync(root) };
}

function writePolicy(root: string, days = 1): void {
	writeFileSync(
		join(root, "ledger-retention-policy.json"),
		JSON.stringify(createFlowDeskLedgerRetentionPolicyV1({ max_score_age_days: days }), null, 2) + "\n",
		"utf8",
	);
}

function writeAgedJson(filePath: string, payload: unknown, daysOld: number): void {
	mkdirSync(dirname(filePath), { recursive: true });
	writeFileSync(filePath, JSON.stringify(payload, null, 2) + "\n", "utf8");
	const when = new Date(Date.now() - daysOld * 86_400_000);
	utimesSync(filePath, when, when);
}

function runScript(args: string[]): { status: number | null; stdout: string; stderr: string } {
	const result = spawnSync(process.execPath, [SCRIPT_PATH, ...args], { encoding: "utf8" });
	return { status: result.status, stdout: result.stdout, stderr: result.stderr };
}

function loadLatestEvidence(root: string): Record<string, unknown> | undefined {
	const entries = readdirSync(root).filter((entry) => /^compaction-evidence-compaction-.*\.json$/.test(entry));
	if (entries.length === 0) return undefined;
	entries.sort();
	const last = entries[entries.length - 1];
	if (last === undefined) return undefined;
	return JSON.parse(readFileSync(join(root, last), "utf8")) as Record<string, unknown>;
}

test("test_compaction_refuses_pending_gate_promotion_records: never deletes pending_gate_promotion entries", () => {
	const { parent, root } = tempFlowDeskRoot();
	try {
		writePolicy(root, 1);

		// Stale pending_gate_promotion publication result (older than TTL).
		const protectedPath = join(root, "sessions", "session-1", "publication-result-pending.json");
		writeAgedJson(protectedPath, {
			schema_version: "flowdesk.federated_publication_result.v1",
			publication_state: "pending_gate_promotion",
			publication_result_id: "pub-1",
		}, 10);

		// Stale ordinary record (older than TTL, no pending_gate_promotion) — must be removed.
		const deletablePath = join(root, "sessions", "session-1", "ordinary-stale.json");
		writeAgedJson(deletablePath, {
			schema_version: "flowdesk.routing_advisory_evaluation.v1",
			evaluation_id: "eval-1",
		}, 10);

		const result = runScript(["--root", root]);
		assert.equal(result.status, 0, `stderr=${result.stderr}`);

		// Pending-gate-promotion record must survive.
		assert.equal(readdirSync(join(root, "sessions", "session-1")).includes("publication-result-pending.json"), true);
		// Ordinary stale record must be removed.
		assert.equal(readdirSync(join(root, "sessions", "session-1")).includes("ordinary-stale.json"), false);

		const evidence = loadLatestEvidence(root);
		assert.ok(evidence, "compaction evidence must be persisted");
		assert.equal(evidence.schema_version, "flowdesk.compaction_evidence.v1");
		assert.equal(typeof evidence.compaction_run_id, "string");
		assert.equal(typeof evidence.lock_path, "string");
		assert.equal((evidence.lock_path as string).endsWith(join(".locks", "compaction.lock")), true);
		assert.equal(evidence.records_preserved_due_to_pending_gate_promotion, 1);
		assert.equal(typeof evidence.records_quarantined, "number");
	} finally {
		rmSync(parent, { recursive: true, force: true });
	}
});

test("test_compaction_path_traversal_rejected: refuses ..-paths, symlinks, and non-flowdesk roots", () => {
	const { parent, root } = tempFlowDeskRoot();
	try {
		// 1) Path containing literal ".." segments → refused (the script does NOT
		// silently normalize traversal). Use string concatenation so node's
		// path.join doesn't collapse the ".." before the script sees it.
		const traversalPath = `${root}/../.flowdesk`;
		const traversal = runScript(["--root", traversalPath]);
		assert.notEqual(traversal.status, 0);
		assert.match(traversal.stderr, /root_(contains_traversal|not_absolute|basename_not_flowdesk|not_canonical)/);

		// 2) Symlinked root → refused.
		const linkPath = `${root}-link`;
		symlinkSync(root, linkPath);
		const symlinked = runScript(["--root", linkPath]);
		assert.notEqual(symlinked.status, 0);
		assert.match(symlinked.stderr, /root_(is_symlink|not_canonical|basename_not_flowdesk)/);

		// 3) Non-.flowdesk basename → refused.
		const wrongBase = mkdtempSync(join(tmpdir(), "flowdesk-not-flowdesk-"));
		const wrongRoot = realpathSync(wrongBase);
		const wrong = runScript(["--root", wrongRoot]);
		assert.notEqual(wrong.status, 0);
		assert.match(wrong.stderr, /root_basename_not_flowdesk/);
		rmSync(wrongBase, { recursive: true, force: true });

		// 4) Filesystem root "/" → refused.
		const filesystemRoot = runScript(["--root", "/"]);
		assert.notEqual(filesystemRoot.status, 0);
		assert.match(filesystemRoot.stderr, /root_is_filesystem_root|root_basename_not_flowdesk/);
	} finally {
		rmSync(parent, { recursive: true, force: true });
	}
});
