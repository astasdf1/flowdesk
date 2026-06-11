/**
 * Tests for score-ledger-hash-chain.ts
 * P7-S17: Genesis/event/previous hash chain computation.
 */

import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import test from "node:test";
import { canonicalJCSHash } from "../shared/jcs.js";
import {
	buildPartitionHashChainV1,
	computeChainHashV1,
	computeEventHashV1,
	computePartitionGenesisHashV1,
	verifyPartitionHashChainV1,
} from "./score-ledger-hash-chain.js";

// ─── computePartitionGenesisHashV1 ───────────────────────────────────────────

test("P7-S17 genesis hash: deterministic (same input → same output)", () => {
	const input = { partitionId: "partition-abc", schemaHash: "deadbeef01234567deadbeef01234567deadbeef01234567deadbeef01234567" };
	const hash1 = computePartitionGenesisHashV1(input);
	const hash2 = computePartitionGenesisHashV1(input);
	assert.equal(hash1, hash2, "genesis hash must be deterministic");
});

test("P7-S17 genesis hash: produces 64-character lowercase hex string", () => {
	const hash = computePartitionGenesisHashV1({
		partitionId: "partition-xyz",
		schemaHash: "0000000000000000000000000000000000000000000000000000000000000000",
	});
	assert.equal(typeof hash, "string");
	assert.equal(hash.length, 64);
	assert.match(hash, /^[0-9a-f]{64}$/);
});

test("P7-S17 genesis hash: uses correct formula (sha256 of prefix+partitionId+schemaHash)", () => {
	const partitionId = "partition-1";
	const schemaHash = "aabbccddaabbccddaabbccddaabbccddaabbccddaabbccddaabbccddaabbccdd";
	const prefix = "flowdesk.partition.genesis.v1";
	const expected = createHash("sha256")
		.update(prefix + partitionId + schemaHash, "utf8")
		.digest("hex");
	const actual = computePartitionGenesisHashV1({ partitionId, schemaHash });
	assert.equal(actual, expected, "genesis hash must use sha256(prefix+partitionId+schemaHash)");
});

test("P7-S17 genesis hash: custom schemaVersion changes the hash", () => {
	const input = { partitionId: "partition-2", schemaHash: "aabb0000aabb0000aabb0000aabb0000aabb0000aabb0000aabb0000aabb0000" };
	const defaultHash = computePartitionGenesisHashV1(input);
	const customHash = computePartitionGenesisHashV1({ ...input, schemaVersion: "flowdesk.partition.genesis.v2" });
	assert.notEqual(defaultHash, customHash, "different schemaVersion must produce different genesis hash");
});

test("P7-S17 genesis hash: different partitionId produces different hash", () => {
	const schemaHash = "ffff0000ffff0000ffff0000ffff0000ffff0000ffff0000ffff0000ffff0000";
	const h1 = computePartitionGenesisHashV1({ partitionId: "partition-A", schemaHash });
	const h2 = computePartitionGenesisHashV1({ partitionId: "partition-B", schemaHash });
	assert.notEqual(h1, h2, "different partitionId must produce different genesis hash");
});

// ─── computeEventHashV1 ───────────────────────────────────────────────────────

test("P7-S17 event hash: equals canonicalJCSHash result for same entry", () => {
	const entry = { workflow_id: "wf-1", score: 0.9, at: "2026-06-11T00:00:00.000Z" };
	const expected = canonicalJCSHash(entry);
	const actual = computeEventHashV1(entry);
	assert.equal(actual, expected, "event hash must equal canonicalJCSHash of entry");
});

test("P7-S17 event hash: deterministic for same input", () => {
	const entry = { a: 1, b: [2, 3], c: null };
	const h1 = computeEventHashV1(entry);
	const h2 = computeEventHashV1(entry);
	assert.equal(h1, h2, "event hash must be deterministic");
});

test("P7-S17 event hash: key order does not affect result (JCS canonical)", () => {
	const h1 = computeEventHashV1({ a: 1, b: 2 });
	const h2 = computeEventHashV1({ b: 2, a: 1 });
	assert.equal(h1, h2, "key order must not affect event hash (JCS canonicalization)");
});

// ─── computeChainHashV1 ───────────────────────────────────────────────────────

test("P7-S17 chain hash: deterministic (same inputs → same output)", () => {
	const eventHash = "aaaa0000aaaa0000aaaa0000aaaa0000aaaa0000aaaa0000aaaa0000aaaa0000";
	const previousHash = "bbbb1111bbbb1111bbbb1111bbbb1111bbbb1111bbbb1111bbbb1111bbbb1111";
	const h1 = computeChainHashV1({ eventHash, previousHash });
	const h2 = computeChainHashV1({ eventHash, previousHash });
	assert.equal(h1, h2, "chain hash must be deterministic");
});

test("P7-S17 chain hash: uses sha256(eventHash + previousHash) string concatenation", () => {
	const eventHash = "cccc2222cccc2222cccc2222cccc2222cccc2222cccc2222cccc2222cccc2222";
	const previousHash = "dddd3333dddd3333dddd3333dddd3333dddd3333dddd3333dddd3333dddd3333";
	const expected = createHash("sha256")
		.update(eventHash + previousHash, "utf8")
		.digest("hex");
	const actual = computeChainHashV1({ eventHash, previousHash });
	assert.equal(actual, expected, "chain hash must be sha256(eventHash + previousHash)");
});

test("P7-S17 chain hash: order-dependent (swapping inputs changes hash)", () => {
	const hashA = "aaaa0000aaaa0000aaaa0000aaaa0000aaaa0000aaaa0000aaaa0000aaaa0000";
	const hashB = "bbbb1111bbbb1111bbbb1111bbbb1111bbbb1111bbbb1111bbbb1111bbbb1111";
	const h1 = computeChainHashV1({ eventHash: hashA, previousHash: hashB });
	const h2 = computeChainHashV1({ eventHash: hashB, previousHash: hashA });
	assert.notEqual(h1, h2, "chain hash must be order-dependent");
});

// ─── buildPartitionHashChainV1 ────────────────────────────────────────────────

test("P7-S17 buildPartitionHashChainV1: builds 3-entry chain correctly", () => {
	const genesisHash = "genesis0000000000000000000000000000000000000000000000000000000000";
	const entries = [
		{ seq: 1, value: "alpha" },
		{ seq: 2, value: "beta" },
		{ seq: 3, value: "gamma" },
	];

	const chain = buildPartitionHashChainV1({ entries, genesisHash });

	assert.equal(chain.length, 3, "chain must have 3 entries");

	// Verify entry 0 manually
	const evt0 = computeEventHashV1(entries[0]);
	const ch0 = computeChainHashV1({ eventHash: evt0, previousHash: genesisHash });
	assert.equal(chain[0].eventHash, evt0, "entry 0: event hash must match");
	assert.equal(chain[0].chainHash, ch0, "entry 0: chain hash must match");

	// Verify entry 1 (depends on chain[0].chainHash)
	const evt1 = computeEventHashV1(entries[1]);
	const ch1 = computeChainHashV1({ eventHash: evt1, previousHash: ch0 });
	assert.equal(chain[1].eventHash, evt1, "entry 1: event hash must match");
	assert.equal(chain[1].chainHash, ch1, "entry 1: chain hash must match");

	// Verify entry 2 (depends on chain[1].chainHash)
	const evt2 = computeEventHashV1(entries[2]);
	const ch2 = computeChainHashV1({ eventHash: evt2, previousHash: ch1 });
	assert.equal(chain[2].eventHash, evt2, "entry 2: event hash must match");
	assert.equal(chain[2].chainHash, ch2, "entry 2: chain hash must match");
});

test("P7-S17 buildPartitionHashChainV1: empty entries returns empty array", () => {
	const chain = buildPartitionHashChainV1({
		entries: [],
		genesisHash: "genesis0000000000000000000000000000000000000000000000000000000000",
	});
	assert.deepEqual(chain, [], "empty entries must produce empty chain");
});

test("P7-S17 buildPartitionHashChainV1: single entry chain", () => {
	const genesisHash = "genesis1111111111111111111111111111111111111111111111111111111111";
	const entries = [{ id: "evt-1" }];
	const chain = buildPartitionHashChainV1({ entries, genesisHash });
	assert.equal(chain.length, 1);
	const expectedEventHash = computeEventHashV1(entries[0]);
	const expectedChainHash = computeChainHashV1({ eventHash: expectedEventHash, previousHash: genesisHash });
	assert.equal(chain[0].eventHash, expectedEventHash);
	assert.equal(chain[0].chainHash, expectedChainHash);
});

// ─── verifyPartitionHashChainV1 ──────────────────────────────────────────────

test("P7-S17 verifyPartitionHashChainV1: valid chain → { valid: true }", () => {
	const genesisHash = "genesis2222222222222222222222222222222222222222222222222222222222";
	const entries = [
		{ seq: 1, data: "foo" },
		{ seq: 2, data: "bar" },
		{ seq: 3, data: "baz" },
	];
	const recordedChain = buildPartitionHashChainV1({ entries, genesisHash });
	const result = verifyPartitionHashChainV1({ entries, genesisHash, recordedChain });
	assert.deepEqual(result, { valid: true }, "valid chain must verify successfully");
});

test("P7-S17 verifyPartitionHashChainV1: tampered middle entry → { valid: false, failedAtIndex: 1 }", () => {
	const genesisHash = "genesis3333333333333333333333333333333333333333333333333333333333";
	const entries = [
		{ seq: 1, data: "first" },
		{ seq: 2, data: "second" },
		{ seq: 3, data: "third" },
	];
	const recordedChain = buildPartitionHashChainV1({ entries, genesisHash });

	// Tamper with entry at index 1
	const tamperedEntries = [
		entries[0],
		{ seq: 2, data: "TAMPERED" }, // different content
		entries[2],
	];

	const result = verifyPartitionHashChainV1({ entries: tamperedEntries, genesisHash, recordedChain });
	assert.equal(result.valid, false, "tampered chain must fail verification");
	if (!result.valid) {
		assert.equal(result.failedAtIndex, 1, "failure must be reported at index 1");
	}
});

test("P7-S17 verifyPartitionHashChainV1: empty entries and empty chain → { valid: true }", () => {
	const result = verifyPartitionHashChainV1({
		entries: [],
		genesisHash: "genesis4444444444444444444444444444444444444444444444444444444444",
		recordedChain: [],
	});
	assert.deepEqual(result, { valid: true }, "empty entries with empty chain must be valid");
});

test("P7-S17 verifyPartitionHashChainV1: length mismatch → { valid: false, failedAtIndex: 0 }", () => {
	const genesisHash = "genesis5555555555555555555555555555555555555555555555555555555555";
	const entries = [{ seq: 1 }, { seq: 2 }];
	const recordedChain = buildPartitionHashChainV1({ entries, genesisHash });

	// Provide 3 entries but only 2 recorded chain entries
	const moreEntries = [{ seq: 1 }, { seq: 2 }, { seq: 3 }];
	const result = verifyPartitionHashChainV1({ entries: moreEntries, genesisHash, recordedChain });
	assert.equal(result.valid, false, "length mismatch must fail verification");
	if (!result.valid) {
		assert.equal(result.failedAtIndex, 0, "length mismatch must report failedAtIndex: 0");
	}
});

test("P7-S17 verifyPartitionHashChainV1: tampered chain hash (not event hash) → { valid: false }", () => {
	const genesisHash = "genesis6666666666666666666666666666666666666666666666666666666666";
	const entries = [{ seq: 1, data: "a" }, { seq: 2, data: "b" }];
	const recordedChain = buildPartitionHashChainV1({ entries, genesisHash });

	// Tamper the chainHash at index 0 (while keeping eventHash)
	const tamperedChain = [
		{ eventHash: recordedChain[0].eventHash, chainHash: "badbadbadbadbadbadbadbadbadbadbadbadbadbadbadbadbadbadbadbadbadb" },
		recordedChain[1],
	];

	const result = verifyPartitionHashChainV1({ entries, genesisHash, recordedChain: tamperedChain });
	assert.equal(result.valid, false, "tampered chain hash must fail verification");
	if (!result.valid) {
		assert.equal(result.failedAtIndex, 0, "tampered chain hash at index 0 must fail at index 0");
	}
});

test("P7-S17 verifyPartitionHashChainV1: chain is position-dependent (reorder entries fails)", () => {
	const genesisHash = "genesis7777777777777777777777777777777777777777777777777777777777";
	const entries = [{ seq: 1, data: "x" }, { seq: 2, data: "y" }, { seq: 3, data: "z" }];
	const recordedChain = buildPartitionHashChainV1({ entries, genesisHash });

	// Reorder entries to verify chain is order-sensitive
	const reorderedEntries = [entries[1], entries[0], entries[2]];
	const result = verifyPartitionHashChainV1({ entries: reorderedEntries, genesisHash, recordedChain });
	assert.equal(result.valid, false, "reordered entries must fail chain verification");
});
