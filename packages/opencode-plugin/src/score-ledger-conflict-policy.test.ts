/**
 * Tests for score-ledger-conflict-policy.ts — P7-S23.
 *
 * Covers:
 *   resolveEventIdConflictV1     – same hash, newer hash, quarantine
 *   detectDuplicatePartitionV1   – same_id, same_genesis, none
 *   evaluatePartitionRetentionV1 – archive, delete, keep (pending_gate_promotion)
 */
import assert from "node:assert/strict";
import { describe, test } from "node:test";
import {
	resolveEventIdConflictV1,
	detectDuplicatePartitionV1,
	evaluatePartitionRetentionV1,
} from "./score-ledger-conflict-policy.js";
import type { FlowDeskScoreLedgerPartitionV1 } from "@flowdesk/core";
import { createFlowDeskLedgerRetentionPolicyV1 } from "@flowdesk/core";

// ── Test helpers ──────────────────────────────────────────────────────────────

const HASH_A = "sha256-" + "a".repeat(64);
const HASH_B = "sha256-" + "b".repeat(64);
const HASH_C = "sha256-" + "c".repeat(64);
const HASH_D = "sha256-" + "d".repeat(64);

function makePartition(
	overrides: Partial<FlowDeskScoreLedgerPartitionV1> = {},
): FlowDeskScoreLedgerPartitionV1 {
	return {
		schema_version: "flowdesk.score_ledger_partition.v1",
		partition_id: "partition-test-001",
		state: "raw",
		created_at: "2026-01-01T00:00:00.000Z",
		entry_count: 0,
		genesis_hash: HASH_A,
		chain_head_hash: HASH_B,
		schema_hash: HASH_C,
		sealing_window_seconds: 86400,
		min_seal_threshold: 100,
		immutable_grace_period_seconds: 604800,
		advisory_only: true,
		non_authorizing: true,
		dispatch_authority_enabled: false,
		remote_write_authority_enabled: false,
		...overrides,
	};
}

// ─── resolveEventIdConflictV1 ────────────────────────────────────────────────

describe("resolveEventIdConflictV1", () => {
	// ── Test 1: same hash → skip_duplicate ──────────────────────────────────
	test("identical hashes → skip_duplicate", () => {
		const result = resolveEventIdConflictV1({
			existingEventHash: HASH_A,
			incomingEventHash: HASH_A,
			existingRecordedAt: "2026-01-01T00:00:00.000Z",
			incomingRecordedAt: "2026-01-01T00:01:00.000Z",
		});

		assert.equal(result.resolution, "skip_duplicate");
		assert.ok(result.reason.length > 0);
		assert.ok(
			result.reason.includes("identical") || result.reason.includes("duplicate"),
			`expected 'identical' or 'duplicate' in reason: ${result.reason}`,
		);
	});

	// ── Test 2: different hash + incoming newer → replace_if_newer ──────────
	test("different hashes + incoming is strictly newer → replace_if_newer", () => {
		const result = resolveEventIdConflictV1({
			existingEventHash: HASH_A,
			incomingEventHash: HASH_B,
			existingRecordedAt: "2026-01-01T00:00:00.000Z",
			incomingRecordedAt: "2026-01-02T00:00:00.000Z",
		});

		assert.equal(result.resolution, "replace_if_newer");
		assert.ok(result.reason.includes("newer") || result.reason.includes("incoming_is_newer"),
			`expected 'newer' in reason: ${result.reason}`);
	});

	// ── Test 3: different hash + incoming older → quarantine ─────────────────
	test("different hashes + incoming is older → quarantine", () => {
		const result = resolveEventIdConflictV1({
			existingEventHash: HASH_A,
			incomingEventHash: HASH_B,
			existingRecordedAt: "2026-01-02T00:00:00.000Z",
			incomingRecordedAt: "2026-01-01T00:00:00.000Z",
		});

		assert.equal(result.resolution, "quarantine");
		assert.ok(result.reason.length > 0);
	});

	// ── Test 4: different hash + equal timestamps → quarantine ───────────────
	test("different hashes + equal timestamps → quarantine", () => {
		const result = resolveEventIdConflictV1({
			existingEventHash: HASH_A,
			incomingEventHash: HASH_B,
			existingRecordedAt: "2026-01-01T00:00:00.000Z",
			incomingRecordedAt: "2026-01-01T00:00:00.000Z",
		});

		assert.equal(result.resolution, "quarantine");
	});

	// ── Test 5: unparseable existing timestamp → quarantine ──────────────────
	test("different hashes + unparseable existing timestamp → quarantine", () => {
		const result = resolveEventIdConflictV1({
			existingEventHash: HASH_A,
			incomingEventHash: HASH_B,
			existingRecordedAt: "not-a-valid-timestamp",
			incomingRecordedAt: "2026-01-02T00:00:00.000Z",
		});

		assert.equal(result.resolution, "quarantine");
		assert.ok(
			result.reason.includes("parsed") || result.reason.includes("indeterminate"),
			`reason should mention parsing or ordering: ${result.reason}`,
		);
	});

	// ── Test 6: unparseable incoming timestamp → quarantine ──────────────────
	test("different hashes + unparseable incoming timestamp → quarantine", () => {
		const result = resolveEventIdConflictV1({
			existingEventHash: HASH_A,
			incomingEventHash: HASH_B,
			existingRecordedAt: "2026-01-01T00:00:00.000Z",
			incomingRecordedAt: "bad-date",
		});

		assert.equal(result.resolution, "quarantine");
	});
});

// ─── detectDuplicatePartitionV1 ──────────────────────────────────────────────

describe("detectDuplicatePartitionV1", () => {
	// ── Test 7: same partition_id → same_id duplicate ────────────────────────
	test("existing partition with same partition_id → isDuplicate=true, same_id", () => {
		const existing = [makePartition({ partition_id: "partition-aaa", genesis_hash: HASH_A })];

		const result = detectDuplicatePartitionV1({
			existingPartitions: existing,
			incomingPartitionId: "partition-aaa",
			incomingGenesisHash: HASH_B,
		});

		assert.equal(result.isDuplicate, true);
		assert.equal(result.conflictType, "same_id");
	});

	// ── Test 8: different id but same genesis_hash → same_genesis (fork) ─────
	test("same genesis_hash, different partition_id → isDuplicate=true, same_genesis", () => {
		const existing = [makePartition({ partition_id: "partition-aaa", genesis_hash: HASH_A })];

		const result = detectDuplicatePartitionV1({
			existingPartitions: existing,
			incomingPartitionId: "partition-bbb",
			incomingGenesisHash: HASH_A,
		});

		assert.equal(result.isDuplicate, true);
		assert.equal(result.conflictType, "same_genesis");
	});

	// ── Test 9: no conflict → isDuplicate=false, none ────────────────────────
	test("unique id and unique genesis_hash → isDuplicate=false, none", () => {
		const existing = [makePartition({ partition_id: "partition-aaa", genesis_hash: HASH_A })];

		const result = detectDuplicatePartitionV1({
			existingPartitions: existing,
			incomingPartitionId: "partition-bbb",
			incomingGenesisHash: HASH_B,
		});

		assert.equal(result.isDuplicate, false);
		assert.equal(result.conflictType, "none");
	});

	// ── Test 10: empty existing list → no duplicate ───────────────────────────
	test("empty existing partitions → isDuplicate=false, none", () => {
		const result = detectDuplicatePartitionV1({
			existingPartitions: [],
			incomingPartitionId: "partition-new",
			incomingGenesisHash: HASH_A,
		});

		assert.equal(result.isDuplicate, false);
		assert.equal(result.conflictType, "none");
	});

	// ── Test 11: same_id check takes priority over same_genesis ──────────────
	test("same id AND same genesis → reports same_id (id check has priority)", () => {
		const existing = [makePartition({ partition_id: "partition-aaa", genesis_hash: HASH_A })];

		const result = detectDuplicatePartitionV1({
			existingPartitions: existing,
			incomingPartitionId: "partition-aaa",
			incomingGenesisHash: HASH_A,
		});

		assert.equal(result.isDuplicate, true);
		assert.equal(result.conflictType, "same_id");
	});
});

// ─── evaluatePartitionRetentionV1 ────────────────────────────────────────────

describe("evaluatePartitionRetentionV1", () => {
	const defaultPolicy = createFlowDeskLedgerRetentionPolicyV1({ max_score_age_days: 14 });

	// ── Test 12: immutable + old → archive with correct path ─────────────────
	test("immutable partition older than max_score_age_days → archive", () => {
		// Partition became immutable 30 days before now
		const immutableAt = "2026-05-12T00:00:00.000Z"; // 30 days before 2026-06-11
		const now = "2026-06-11T00:00:00.000Z";

		const partition = makePartition({
			partition_id: "partition-old-001",
			state: "immutable",
			immutable_at: immutableAt,
			sealed_at: "2026-05-11T00:00:00.000Z",
		});

		const result = evaluatePartitionRetentionV1({ partition, policy: defaultPolicy, now });

		assert.equal(result.action, "archive");
		assert.ok(typeof result.archivePath === "string", "archivePath must be set");
		assert.ok(
			result.archivePath.startsWith("archive/2026/"),
			`archivePath should start with archive/2026/: ${result.archivePath}`,
		);
		assert.ok(
			result.archivePath.includes("partition-old-001"),
			`archivePath should include partition_id: ${result.archivePath}`,
		);
		assert.ok(
			result.archivePath.endsWith(".jsonl"),
			`archivePath should end with .jsonl: ${result.archivePath}`,
		);
	});

	// ── Test 13: immutable + recent → keep ───────────────────────────────────
	test("immutable partition within max_score_age_days → keep", () => {
		// Partition became immutable 3 days before now
		const immutableAt = "2026-06-08T00:00:00.000Z";
		const now = "2026-06-11T00:00:00.000Z";

		const partition = makePartition({
			partition_id: "partition-fresh-001",
			state: "immutable",
			immutable_at: immutableAt,
		});

		const result = evaluatePartitionRetentionV1({ partition, policy: defaultPolicy, now });

		assert.equal(result.action, "keep");
		assert.equal(result.archivePath, undefined);
	});

	// ── Test 14: raw + stale (past 2x sealing_window) → delete ───────────────
	test("raw partition older than 2x sealing_window_seconds → delete", () => {
		// sealing_window = 86400s (24h), 2x = 172800s (48h)
		// created 3 days ago → past 2x window
		const createdAt = "2026-06-08T00:00:00.000Z"; // 3 days ago
		const now = "2026-06-11T00:00:00.000Z";

		const partition = makePartition({
			partition_id: "partition-stale-raw",
			state: "raw",
			created_at: createdAt,
			sealing_window_seconds: 86400,
		});

		const result = evaluatePartitionRetentionV1({ partition, policy: defaultPolicy, now });

		assert.equal(result.action, "delete");
		assert.ok(result.reason.includes("abandoned") || result.reason.includes("raw"),
			`reason should mention raw/abandoned: ${result.reason}`);
	});

	// ── Test 15: raw + fresh (within 2x sealing_window) → keep ───────────────
	test("raw partition within 2x sealing_window_seconds → keep", () => {
		// created 12 hours ago — within 2x86400s window
		const createdAt = "2026-06-10T12:00:00.000Z";
		const now = "2026-06-11T00:00:00.000Z";

		const partition = makePartition({
			partition_id: "partition-fresh-raw",
			state: "raw",
			created_at: createdAt,
			sealing_window_seconds: 86400,
		});

		const result = evaluatePartitionRetentionV1({ partition, policy: defaultPolicy, now });

		assert.equal(result.action, "keep");
	});

	// ── Test 16: pending_gate_promotion state → unconditional keep ────────────
	test("partition with state=pending_gate_promotion → keep regardless of age", () => {
		// Very old created_at — would normally trigger delete if raw
		const partition = makePartition({
			partition_id: "partition-pending-gate",
			// Cast to bypass TS type narrowing since pending_gate_promotion is not
			// yet in the FlowDeskScoreLedgerPartitionStateV1 union
			state: "pending_gate_promotion" as FlowDeskScoreLedgerPartitionV1["state"],
			created_at: "2020-01-01T00:00:00.000Z",
			sealing_window_seconds: 86400,
		});

		const result = evaluatePartitionRetentionV1({
			partition,
			policy: defaultPolicy,
			now: "2026-06-11T00:00:00.000Z",
		});

		assert.equal(result.action, "keep");
		assert.ok(
			result.reason.includes("pending_gate_promotion"),
			`reason should mention pending_gate_promotion: ${result.reason}`,
		);
	});

	// ── Test 17: sealed partition → keep (default) ────────────────────────────
	test("sealed partition → keep (not yet eligible for archive or delete)", () => {
		const partition = makePartition({
			partition_id: "partition-sealed-001",
			state: "sealed",
			sealed_at: "2026-06-01T00:00:00.000Z",
		});

		const result = evaluatePartitionRetentionV1({
			partition,
			policy: defaultPolicy,
			now: "2026-06-11T00:00:00.000Z",
		});

		assert.equal(result.action, "keep");
	});

	// ── Test 18: archive path uses year from `now` ────────────────────────────
	test("archive path year is derived from the `now` parameter, not immutable_at", () => {
		const partition = makePartition({
			partition_id: "partition-cross-year",
			state: "immutable",
			immutable_at: "2025-01-01T00:00:00.000Z",
		});

		const result = evaluatePartitionRetentionV1({
			partition,
			policy: defaultPolicy,
			now: "2026-06-11T00:00:00.000Z",
		});

		assert.equal(result.action, "archive");
		assert.ok(
			result.archivePath?.startsWith("archive/2026/"),
			`archivePath year must come from now (2026): ${result.archivePath}`,
		);
	});

	// ── Test 19: custom policy with short max_score_age_days ──────────────────
	test("custom policy: max_score_age_days=1 archives a 2-day-old immutable partition", () => {
		const shortPolicy = createFlowDeskLedgerRetentionPolicyV1({ max_score_age_days: 1 });
		const partition = makePartition({
			partition_id: "partition-short-ttl",
			state: "immutable",
			immutable_at: "2026-06-09T00:00:00.000Z", // 2 days ago
		});

		const result = evaluatePartitionRetentionV1({
			partition,
			policy: shortPolicy,
			now: "2026-06-11T00:00:00.000Z",
		});

		assert.equal(result.action, "archive");
	});
});
