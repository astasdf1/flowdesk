/**
 * Synthetic E2E integration test for the Release 3 OI score-ledger process.
 *
 * This intentionally stays local and advisory-only:
 * score-like entries -> score-ledger partition append -> lifecycle seal -> rollup
 * -> GitHub publisher dry-run boundary. No network, dispatch, fallback, or real
 * remote write authority is exercised.
 */
import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";

import {
	computeLedgerRollupV1,
	type FlowDeskLedgerRollupResultV1,
	type FlowDeskRoutingAdvisoryLedgerEntryV1,
	type FlowDeskScoreLedgerManifestV1,
	type FlowDeskScoreLedgerPartitionV1,
} from "@flowdesk/core";
import { appendToScoreLedgerPartitionV1 } from "./score-ledger-partition-writer.js";
import { checkAndAdvancePartitionStateV1 } from "./score-ledger-partition-lifecycle.js";
import { publishScoreLedgerPartitionToGitHubV1 } from "./score-ledger-github-publisher.js";

const PARTITION_ID = "partition-e2e-2026-06-11";
const SCHEMA_HASH = "sha256-" + "e".repeat(64);

function partitionDir(rootDir: string): string {
	return join(rootDir, ".flowdesk", "oi", "score-ledger");
}

function jsonlPath(rootDir: string): string {
	return join(partitionDir(rootDir), `${PARTITION_ID}.jsonl`);
}

function manifestPath(rootDir: string): string {
	return join(partitionDir(rootDir), `${PARTITION_ID}.manifest.json`);
}

function readJsonlEntries(rootDir: string): FlowDeskRoutingAdvisoryLedgerEntryV1[] {
	return readFileSync(jsonlPath(rootDir), "utf8")
		.split("\n")
		.filter((line) => line.trim().length > 0)
		.map((line) => JSON.parse(line) as FlowDeskRoutingAdvisoryLedgerEntryV1);
}

function readManifest(rootDir: string): FlowDeskScoreLedgerManifestV1 {
	return JSON.parse(readFileSync(manifestPath(rootDir), "utf8")) as FlowDeskScoreLedgerManifestV1;
}

function makeEntry(index: number): FlowDeskRoutingAdvisoryLedgerEntryV1 {
	return {
		signature_ref: "signature-e2e-score-ledger",
		model_ref: index % 2 === 0 ? "openai/gpt-5.4-mini-fast" : "google/gemini-3.1-flash-lite-preview",
		weighted_score: 0.65 + (index % 5) * 0.03,
		recorded_at: new Date(Date.UTC(2026, 5, 10, 12, index % 60, Math.floor(index / 60))).toISOString(),
	};
}

test("synthetic OI score-ledger flow reaches rollup and publisher dry-run without authority promotion", async () => {
	const rootDir = mkdtempSync(join(tmpdir(), "flowdesk-score-ledger-e2e-"));
	try {
		let lastAppendStatus: string | undefined;
		for (let i = 0; i < 100; i += 1) {
			const result = appendToScoreLedgerPartitionV1({
				rootDir,
				partitionId: PARTITION_ID,
				schemaHash: SCHEMA_HASH,
				entry: makeEntry(i),
			});
			lastAppendStatus = result.status;
			assert.notEqual(result.status, "blocked", result.reason);
			assert.equal(result.partitionId, PARTITION_ID);
			assert.equal(result.entryCount, i + 1);
			assert.match(result.chainHead, /^sha256-[a-f0-9]{64}$/);
		}
		assert.equal(lastAppendStatus, "appended");

		const rawEntries = readJsonlEntries(rootDir);
		assert.equal(rawEntries.length, 100);

		let manifest = readManifest(rootDir);
		let partition = manifest.partitions.find((item) => item.partition_id === PARTITION_ID);
		assert.ok(partition !== undefined, "partition must exist in manifest after append");
		assert.equal(partition.state, "raw");
		assert.equal(partition.entry_count, 100);
		assert.equal(partition.advisory_only, true);
		assert.equal(partition.dispatch_authority_enabled, false);
		assert.equal(partition.remote_write_authority_enabled, false);

		const lifecycle = checkAndAdvancePartitionStateV1({
			rootDir,
			partitionId: PARTITION_ID,
			now: new Date(Date.now() + 48 * 60 * 60 * 1000).toISOString(),
		});
		assert.equal(lifecycle.previousState, "raw");
		assert.equal(lifecycle.newState, "sealed");
		assert.equal(lifecycle.transitioned, true);

		manifest = readManifest(rootDir);
		partition = manifest.partitions.find((item) => item.partition_id === PARTITION_ID);
		assert.ok(partition !== undefined, "partition must remain in manifest after lifecycle advance");
		assert.equal(partition.state, "sealed");
		assert.equal(partition.advisory_only, true);
		assert.equal(partition.dispatch_authority_enabled, false);
		assert.equal(partition.remote_write_authority_enabled, false);

		const rollup = computeLedgerRollupV1({
			entries: rawEntries,
			partitionState: partition.state,
			partitionIds: [PARTITION_ID],
		});
		assert.ok(!("status" in rollup), `expected rollup result, got ${JSON.stringify(rollup)}`);
		const rollupResult = rollup as FlowDeskLedgerRollupResultV1;
		assert.equal(rollupResult.schema_version, "flowdesk.ledger_rollup_result.v1");
		assert.equal(rollupResult.sample_count, 100);
		assert.deepEqual(rollupResult.source_partition_ids, [PARTITION_ID]);
		assert.equal(rollupResult.advisory_only, true);
		assert.equal(rollupResult.dispatch_authority_enabled, false);
		assert.equal(rollupResult.ranking_authority_enabled, false);
		assert.match(rollupResult.rollup_hash, /^sha256-[a-f0-9]{64}$/);

		const publish = await publishScoreLedgerPartitionToGitHubV1({
			partition: partition as FlowDeskScoreLedgerPartitionV1,
			partitionJsonl: readFileSync(jsonlPath(rootDir), "utf8"),
			target: {
				kind: "github_pr_comment",
				owner: "flowdesk",
				repo: "registry",
				issueNumber: 42,
			},
			allowActualRemoteWrite: false,
			durableStateRoot: rootDir,
		});
		assert.equal(publish.status, "dry_run_recorded");
		assert.equal(publish.partitionId, PARTITION_ID);
		assert.equal(publish.partitionState, "sealed");
		assert.equal(publish.authority.advisoryOnlyRecord, true);
		assert.equal(publish.authority.remoteWriteAuthorityEnabledInRecord, false);
		assert.equal(publish.authority.dispatchAuthorityEnabled, false);
		assert.equal(publish.authority.laneLaunchAuthorityEnabled, false);
	} finally {
		rmSync(rootDir, { recursive: true, force: true });
	}
});
