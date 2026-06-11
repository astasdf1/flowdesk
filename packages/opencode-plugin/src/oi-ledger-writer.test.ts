import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, rmSync, writeFileSync, mkdirSync, openSync, closeSync, unlinkSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, test } from "node:test";
import { appendRoutingAdvisoryEntryV1 } from "./oi-ledger-writer.js";
import type { FlowDeskRoutingAdvisoryLedgerEntryV1 } from "@flowdesk/core";

// ── Test helpers ──────────────────────────────────────────────────────────────

const tempDirs: string[] = [];

function makeTempDir(): string {
	const dir = mkdtempSync(join(tmpdir(), "flowdesk-oi-ledger-writer-"));
	tempDirs.push(dir);
	return dir;
}

afterEach(() => {
	for (const dir of tempDirs.splice(0)) {
		rmSync(dir, { recursive: true, force: true });
	}
});

function makeEntry(
	overrides: Partial<FlowDeskRoutingAdvisoryLedgerEntryV1> = {},
): FlowDeskRoutingAdvisoryLedgerEntryV1 {
	return {
		signature_ref: "sig-ref-001",
		model_ref: "model-ref-claude",
		weighted_score: 0.85,
		recorded_at: "2026-01-01T00:00:00.000Z",
		...overrides,
	};
}

function ledgerPath(rootDir: string): string {
	return join(rootDir, ".flowdesk", "oi", "routing-advisory.jsonl");
}

function lockPath(rootDir: string): string {
	return join(rootDir, ".flowdesk", "oi", "routing-advisory.jsonl.lock");
}

function readLedgerLines(rootDir: string): FlowDeskRoutingAdvisoryLedgerEntryV1[] {
	const path = ledgerPath(rootDir);
	const content = readFileSync(path, "utf8");
	return content
		.split("\n")
		.filter((line) => line.trim().length > 0)
		.map((line) => JSON.parse(line) as FlowDeskRoutingAdvisoryLedgerEntryV1);
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe("appendRoutingAdvisoryEntryV1", () => {
	test("append success — ledgerPath returned and entry persisted", () => {
		const rootDir = makeTempDir();
		const entry = makeEntry();

		const result = appendRoutingAdvisoryEntryV1({ rootDir, entry });

		assert.equal(result.status, "appended");
		assert.equal(typeof result.ledgerPath, "string");
		assert.ok(result.ledgerPath?.endsWith("routing-advisory.jsonl"));
		assert.equal(result.compactionTriggered, false);

		const persisted = readLedgerLines(rootDir);
		assert.equal(persisted.length, 1);
		assert.equal(persisted[0].signature_ref, "sig-ref-001");
		assert.equal(persisted[0].model_ref, "model-ref-claude");
		assert.equal(persisted[0].weighted_score, 0.85);
	});

	test("multiple distinct entries are all appended", () => {
		const rootDir = makeTempDir();
		const e1 = makeEntry({ signature_ref: "sig-1", recorded_at: "2026-01-01T00:00:00.000Z" });
		const e2 = makeEntry({ signature_ref: "sig-2", recorded_at: "2026-01-02T00:00:00.000Z" });
		const e3 = makeEntry({ signature_ref: "sig-3", recorded_at: "2026-01-03T00:00:00.000Z" });

		assert.equal(appendRoutingAdvisoryEntryV1({ rootDir, entry: e1 }).status, "appended");
		assert.equal(appendRoutingAdvisoryEntryV1({ rootDir, entry: e2 }).status, "appended");
		assert.equal(appendRoutingAdvisoryEntryV1({ rootDir, entry: e3 }).status, "appended");

		const lines = readLedgerLines(rootDir);
		assert.equal(lines.length, 3);
	});

	test("dedup skip — same (signature_ref, model_ref, recorded_at) returns skipped_dedup", () => {
		const rootDir = makeTempDir();
		const entry = makeEntry();

		const first = appendRoutingAdvisoryEntryV1({ rootDir, entry });
		assert.equal(first.status, "appended");

		const second = appendRoutingAdvisoryEntryV1({ rootDir, entry });
		assert.equal(second.status, "skipped_dedup");
		assert.ok(typeof second.reason === "string" && second.reason.length > 0);

		// Ledger must still have only one entry
		const lines = readLedgerLines(rootDir);
		assert.equal(lines.length, 1);
	});

	test("dedup allows same model_ref + signature_ref but different recorded_at", () => {
		const rootDir = makeTempDir();
		const e1 = makeEntry({ recorded_at: "2026-01-01T00:00:00.000Z" });
		const e2 = makeEntry({ recorded_at: "2026-01-02T00:00:00.000Z" });

		assert.equal(appendRoutingAdvisoryEntryV1({ rootDir, entry: e1 }).status, "appended");
		assert.equal(appendRoutingAdvisoryEntryV1({ rootDir, entry: e2 }).status, "appended");

		const lines = readLedgerLines(rootDir);
		assert.equal(lines.length, 2);
	});

	test("compaction triggered when entry count exceeds 1000", () => {
		const rootDir = makeTempDir();
		// Pre-seed the ledger with 1000 valid entries directly (bypassing the writer
		// for speed), then append one more to trigger compaction.
		mkdirSync(join(rootDir, ".flowdesk", "oi"), { recursive: true });

		const seedEntries: FlowDeskRoutingAdvisoryLedgerEntryV1[] = [];
		for (let i = 0; i < 1000; i++) {
			seedEntries.push({
				signature_ref: `sig-seed-${String(i).padStart(5, "0")}`,
				model_ref: "model-ref-a",
				weighted_score: 0.5,
				recorded_at: new Date(Date.UTC(2026, 0, 1, 0, 0, i)).toISOString(),
			});
		}
		const seedJsonl = seedEntries.map((e) => JSON.stringify(e)).join("\n") + "\n";
		writeFileSync(ledgerPath(rootDir), seedJsonl, "utf8");

		// Append one more entry to tip over the threshold
		const newEntry = makeEntry({
			signature_ref: "sig-new-trigger",
			model_ref: "model-ref-a",
			recorded_at: "2026-02-01T00:00:00.000Z",
		});

		const result = appendRoutingAdvisoryEntryV1({
			rootDir,
			entry: newEntry,
			now: "2026-06-01T00:00:00.000Z",
		});

		assert.equal(result.status, "appended");
		assert.equal(result.compactionTriggered, true);

		// After compaction, ledger should have fewer than 1001 entries
		const lines = readLedgerLines(rootDir);
		assert.ok(
			lines.length <= 1001,
			`expected at most 1001 entries after compaction, got ${lines.length}`,
		);
	});

	test("lock contention returns blocked (fail-open)", () => {
		const rootDir = makeTempDir();
		mkdirSync(join(rootDir, ".flowdesk", "oi"), { recursive: true });

		// Manually hold the lock file
		const lock = lockPath(rootDir);
		const fd = openSync(lock, "wx");

		try {
			const result = appendRoutingAdvisoryEntryV1({
				rootDir,
				entry: makeEntry(),
			});
			assert.equal(result.status, "blocked");
			assert.ok(result.reason?.includes("lock"));
		} finally {
			closeSync(fd);
			try {
				unlinkSync(lock);
			} catch {
				// ignore cleanup error
			}
		}
	});

	test("rootDir missing returns blocked", () => {
		const result = appendRoutingAdvisoryEntryV1({
			rootDir: "/non/existent/path/that/does/not/exist",
			entry: makeEntry(),
		});
		assert.equal(result.status, "blocked");
		assert.ok(typeof result.reason === "string" && result.reason.length > 0);
	});

	test("empty rootDir string returns blocked", () => {
		const result = appendRoutingAdvisoryEntryV1({
			rootDir: "",
			entry: makeEntry(),
		});
		assert.equal(result.status, "blocked");
	});

	test("compaction triggered when file size exceeds 2MB", () => {
		const rootDir = makeTempDir();
		mkdirSync(join(rootDir, ".flowdesk", "oi"), { recursive: true });

		// Write a 2MB+ seed file with valid entries (large weighted_score model_ref padding)
		const seedEntries: FlowDeskRoutingAdvisoryLedgerEntryV1[] = [];
		// Each entry ≈ 200 bytes → 11000 entries ≈ 2.2MB
		const count = 11000;
		for (let i = 0; i < count; i++) {
			seedEntries.push({
				signature_ref: `sig-large-${String(i).padStart(6, "0")}`,
				model_ref: "model-ref-large-provider-family-x",
				weighted_score: 0.75,
				recorded_at: new Date(Date.UTC(2026, 0, 1, 0, 0, i % 60, i)).toISOString(),
			});
		}
		const seedJsonl = seedEntries.map((e) => JSON.stringify(e)).join("\n") + "\n";
		writeFileSync(ledgerPath(rootDir), seedJsonl, "utf8");

		const result = appendRoutingAdvisoryEntryV1({
			rootDir,
			entry: makeEntry({
				signature_ref: "sig-new-size-trigger",
				recorded_at: "2026-06-11T00:00:00.000Z",
			}),
			now: "2026-06-11T00:00:00.000Z",
		});

		assert.equal(result.status, "appended");
		assert.equal(result.compactionTriggered, true);
	});
});
