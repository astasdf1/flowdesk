/**
 * Score ledger hash chain computation.
 * P7-S17: Genesis/event/previous hash chain calculator.
 *
 * All functions are pure (no I/O, no side effects).
 * Uses node:crypto SHA-256 and JCS canonicalization from shared/jcs.ts.
 *
 * Hash chain structure:
 *   genesis_hash    = sha256(prefix + partitionId + schemaHash)
 *   event_hash[n]   = sha256(canonicalize_jcs(entry[n]))
 *   chain_hash[0]   = sha256(event_hash[0] + genesis_hash)
 *   chain_hash[n]   = sha256(event_hash[n] + chain_hash[n-1])
 */

import { createHash } from "node:crypto";
import { canonicalJCSHash } from "../shared/jcs.js";

// ─── Genesis hash ─────────────────────────────────────────────────────────────

/**
 * Compute a partition genesis hash.
 *
 * genesis = sha256(schemaVersion || partitionId || schemaHash)
 *
 * Default schemaVersion: "flowdesk.partition.genesis.v1"
 *
 * Returns a 64-character lowercase hex string.
 */
export function computePartitionGenesisHashV1(input: {
	partitionId: string;
	schemaHash: string;
	schemaVersion?: string;
}): string {
	const prefix = input.schemaVersion ?? "flowdesk.partition.genesis.v1";
	return createHash("sha256")
		.update(prefix + input.partitionId + input.schemaHash, "utf8")
		.digest("hex");
}

// ─── Event hash ──────────────────────────────────────────────────────────────

/**
 * Compute a single event hash using JCS canonicalization.
 *
 * event_hash = sha256(canonicalize_jcs(entry))
 *
 * Returns a 64-character lowercase hex string.
 * Throws on the same inputs that canonicalJCSHash throws on.
 */
export function computeEventHashV1(entry: unknown): string {
	return canonicalJCSHash(entry);
}

// ─── Chain hash ───────────────────────────────────────────────────────────────

/**
 * Compute the chain hash for position n.
 *
 * chain_hash[n] = sha256(event_hash[n] + chain_hash[n-1])
 * chain_hash[0] = sha256(event_hash[0] + genesis_hash)
 *
 * Both inputs are hex strings; they are concatenated as strings before hashing.
 * Returns a 64-character lowercase hex string.
 */
export function computeChainHashV1(input: {
	eventHash: string;
	previousHash: string; // genesis_hash for the first entry
}): string {
	return createHash("sha256")
		.update(input.eventHash + input.previousHash, "utf8")
		.digest("hex");
}

// ─── Full chain builder ───────────────────────────────────────────────────────

/**
 * Build a full hash chain for a sequence of entries.
 *
 * Returns an array of { eventHash, chainHash } for each entry, in order.
 * - For an empty entries array, returns an empty array.
 * - Position 0 uses genesisHash as the previousHash.
 * - Each subsequent position uses chain_hash[n-1] as previousHash.
 */
export function buildPartitionHashChainV1(input: {
	entries: unknown[];
	genesisHash: string;
}): Array<{ eventHash: string; chainHash: string }> {
	const { entries, genesisHash } = input;
	const result: Array<{ eventHash: string; chainHash: string }> = [];

	let previousHash = genesisHash;

	for (const entry of entries) {
		const eventHash = computeEventHashV1(entry);
		const chainHash = computeChainHashV1({ eventHash, previousHash });
		result.push({ eventHash, chainHash });
		previousHash = chainHash;
	}

	return result;
}

// ─── Chain verifier ───────────────────────────────────────────────────────────

/**
 * Verify the integrity of a recorded hash chain.
 *
 * Re-computes the chain from scratch and compares it to the recorded chain.
 * Returns { valid: true } if all hashes match.
 * Returns { valid: false, failedAtIndex: number, reason: string } at the first
 * mismatch — where failedAtIndex is the 0-based index of the failing entry.
 *
 * Rules:
 * - Empty entries with an empty recordedChain → { valid: true }
 * - Length mismatch → { valid: false, failedAtIndex: 0, reason: ... }
 */
export function verifyPartitionHashChainV1(input: {
	entries: unknown[];
	genesisHash: string;
	recordedChain: Array<{ eventHash: string; chainHash: string }>;
}): { valid: true } | { valid: false; failedAtIndex: number; reason: string } {
	const { entries, genesisHash, recordedChain } = input;

	// Empty entries and empty chain → trivially valid
	if (entries.length === 0 && recordedChain.length === 0) {
		return { valid: true };
	}

	// Length mismatch
	if (entries.length !== recordedChain.length) {
		return {
			valid: false,
			failedAtIndex: 0,
			reason: `entries length (${entries.length}) does not match recordedChain length (${recordedChain.length})`,
		};
	}

	let previousHash = genesisHash;

	for (let i = 0; i < entries.length; i++) {
		const expectedEventHash = computeEventHashV1(entries[i]);
		const expectedChainHash = computeChainHashV1({
			eventHash: expectedEventHash,
			previousHash,
		});

		const recorded = recordedChain[i];

		if (recorded.eventHash !== expectedEventHash) {
			return {
				valid: false,
				failedAtIndex: i,
				reason: `event hash mismatch at index ${i}: expected ${expectedEventHash}, got ${recorded.eventHash}`,
			};
		}

		if (recorded.chainHash !== expectedChainHash) {
			return {
				valid: false,
				failedAtIndex: i,
				reason: `chain hash mismatch at index ${i}: expected ${expectedChainHash}, got ${recorded.chainHash}`,
			};
		}

		previousHash = expectedChainHash;
	}

	return { valid: true };
}
