/**
 * Score Ledger Conflict Policy — P7-S23.
 *
 * Provides pure advisory conflict-resolution and retention-policy evaluation
 * for the FlowDesk score ledger:
 *
 *   - resolveEventIdConflictV1   — duplicate event_id detection (same/newer hash)
 *   - detectDuplicatePartitionV1 — same_id / same_genesis fork detection
 *   - evaluatePartitionRetentionV1 — keep / archive / delete based on policy
 *
 * Advisory-only: no IO, no dispatch, no write, no provider, no runtime authority.
 */
import type { FlowDeskScoreLedgerPartitionV1 } from "@flowdesk/core";
import type { FlowDeskLedgerRetentionPolicyV1 } from "@flowdesk/core";

// ─── Event-id conflict resolution ────────────────────────────────────────────

/**
 * Resolution decision returned for an event_id collision.
 *
 * - `skip_duplicate`   — hashes are identical; the incoming event is an exact
 *                        duplicate and should be dropped.
 * - `replace_if_newer` — hashes differ and the incoming event has a strictly
 *                        later recorded_at; the existing record may be replaced.
 * - `quarantine`       — hashes differ but temporal ordering is ambiguous
 *                        (equal timestamps, unparseable timestamps, or other
 *                        indeterminate state); quarantine for manual review.
 */
export interface EventIdConflictResolutionV1 {
	resolution: "skip_duplicate" | "replace_if_newer" | "quarantine";
	reason: string;
}

/**
 * Determine how to handle an event_id collision between an existing record and
 * an incoming event.
 *
 * Logic:
 *   1. Same hash → skip_duplicate (bit-identical event)
 *   2. Different hash, incoming recorded_at strictly later → replace_if_newer
 *   3. Otherwise → quarantine (temporal ordering cannot be established)
 */
export function resolveEventIdConflictV1(input: {
	existingEventHash: string;
	incomingEventHash: string;
	existingRecordedAt: string;
	incomingRecordedAt: string;
}): EventIdConflictResolutionV1 {
	const { existingEventHash, incomingEventHash, existingRecordedAt, incomingRecordedAt } = input;

	// ── Case 1: identical hash → exact duplicate ──────────────────────────────
	if (existingEventHash === incomingEventHash) {
		return {
			resolution: "skip_duplicate",
			reason: "event_hashes_identical: incoming event is a bit-exact duplicate",
		};
	}

	// ── Case 2: different hash → compare timestamps ───────────────────────────
	const existingMs = Date.parse(existingRecordedAt);
	const incomingMs = Date.parse(incomingRecordedAt);

	if (!Number.isFinite(existingMs) || !Number.isFinite(incomingMs)) {
		return {
			resolution: "quarantine",
			reason:
				"temporal_ordering_indeterminate: one or both recorded_at timestamps could not be parsed",
		};
	}

	if (incomingMs > existingMs) {
		return {
			resolution: "replace_if_newer",
			reason: `incoming_is_newer: incoming recorded_at(${incomingRecordedAt}) > existing recorded_at(${existingRecordedAt})`,
		};
	}

	// Incoming is older or equal in time but hashes differ → quarantine
	return {
		resolution: "quarantine",
		reason:
			`temporal_ordering_indeterminate: hashes differ but incoming recorded_at(${incomingRecordedAt}) is not strictly newer than existing recorded_at(${existingRecordedAt})`,
	};
}

// ─── Duplicate partition detection ───────────────────────────────────────────

/**
 * Conflict type returned by detectDuplicatePartitionV1.
 *
 * - `same_id`      — a partition with the exact same partition_id already exists.
 * - `same_genesis` — a partition with the same genesis_hash but a different id
 *                    exists (fork detection).
 * - `none`         — no duplicate detected.
 */
export type PartitionConflictTypeV1 = "same_id" | "same_genesis" | "none";

/**
 * Check whether `incomingPartitionId` / `incomingGenesisHash` conflicts with any
 * entry in `existingPartitions`.
 *
 * Precedence: same_id is checked first; if the id is unique, genesis_hash is
 * checked for fork detection.
 */
export function detectDuplicatePartitionV1(input: {
	existingPartitions: FlowDeskScoreLedgerPartitionV1[];
	incomingPartitionId: string;
	incomingGenesisHash: string;
}): { isDuplicate: boolean; conflictType?: PartitionConflictTypeV1 } {
	const { existingPartitions, incomingPartitionId, incomingGenesisHash } = input;

	// ── Same partition_id ─────────────────────────────────────────────────────
	const sameId = existingPartitions.some((p) => p.partition_id === incomingPartitionId);
	if (sameId) {
		return { isDuplicate: true, conflictType: "same_id" };
	}

	// ── Same genesis_hash but different id (fork) ─────────────────────────────
	const sameGenesis = existingPartitions.some((p) => p.genesis_hash === incomingGenesisHash);
	if (sameGenesis) {
		return { isDuplicate: true, conflictType: "same_genesis" };
	}

	return { isDuplicate: false, conflictType: "none" };
}

// ─── Partition retention decision ─────────────────────────────────────────────

/**
 * Retention action for a single partition.
 *
 * - `keep`    — the partition should be retained as-is.
 * - `archive` — the partition has aged past max_score_age_days while immutable
 *               and should be moved to the archive path.
 * - `delete`  — the partition is raw and has been abandoned far past its
 *               sealing window; it should be removed.
 */
export interface PartitionRetentionDecisionV1 {
	action: "keep" | "archive" | "delete";
	reason: string;
	/** Relative archive path: "archive/YYYY/partition-id.jsonl"
	 *  Only present when action === "archive".
	 */
	archivePath?: string;
}

/**
 * Evaluate whether a partition should be kept, archived, or deleted given the
 * current retention policy.
 *
 * Rules (in priority order):
 *
 *   1. `pending_gate_promotion` state → unconditional keep (never prune while
 *      awaiting gate promotion).
 *
 *   2. `immutable` + age > max_score_age_days → archive at
 *      "archive/YYYY/partition-id.jsonl" (year taken from `now`).
 *
 *   3. `raw` + age > sealing_window_seconds * 2 (long-abandoned) → delete.
 *
 *   4. All other cases → keep.
 */
export function evaluatePartitionRetentionV1(input: {
	partition: FlowDeskScoreLedgerPartitionV1;
	policy: FlowDeskLedgerRetentionPolicyV1;
	now: string;
}): PartitionRetentionDecisionV1 {
	const { partition, policy, now } = input;

	// ── Rule 1: pending_gate_promotion guard ──────────────────────────────────
	// The core partition state union is "raw" | "sealed" | "immutable".
	// A future extended state "pending_gate_promotion" may appear on the wire;
	// guard against it here so the partition is never pruned while awaiting
	// gate promotion. We cast via unknown to avoid TS type narrowing errors.
	const stateStr = (partition.state as unknown) as string;
	if (stateStr === "pending_gate_promotion") {
		return {
			action: "keep",
			reason: "pending_gate_promotion: partition must not be pruned while awaiting gate promotion",
		};
	}

	const nowMs = Date.parse(now);
	if (!Number.isFinite(nowMs)) {
		// Cannot evaluate age — keep conservatively
		return {
			action: "keep",
			reason: "temporal_evaluation_failed: now timestamp could not be parsed",
		};
	}

	// ── Rule 2: immutable + age > max_score_age_days → archive ───────────────
	if (partition.state === "immutable") {
		const referenceTimestamp = partition.immutable_at ?? partition.created_at;
		const referenceMs = Date.parse(referenceTimestamp);
		if (Number.isFinite(referenceMs)) {
			const ageMs = nowMs - referenceMs;
			const maxAgeMs = policy.max_score_age_days * 24 * 60 * 60 * 1000;
			if (ageMs > maxAgeMs) {
				// Archive path: "archive/YYYY/partition-id.jsonl"
				// Year is derived from `now`
				const year = new Date(nowMs).getUTCFullYear();
				const archivePath = `archive/${year}/${partition.partition_id}.jsonl`;
				return {
					action: "archive",
					reason:
						`immutable_age_exceeded: age_days(${Math.floor(ageMs / 86400000)}) > max_score_age_days(${policy.max_score_age_days})`,
					archivePath,
				};
			}
		}
		return {
			action: "keep",
			reason: `immutable_within_retention: age within max_score_age_days(${policy.max_score_age_days})`,
		};
	}

	// ── Rule 3: raw + abandoned past 2x sealing window → delete ──────────────
	if (partition.state === "raw") {
		const createdMs = Date.parse(partition.created_at);
		if (Number.isFinite(createdMs)) {
			const ageSeconds = Math.max(0, (nowMs - createdMs) / 1000);
			const abandonThreshold = partition.sealing_window_seconds * 2;
			if (ageSeconds > abandonThreshold) {
				return {
					action: "delete",
					reason:
						`raw_partition_abandoned: age_seconds(${Math.floor(ageSeconds)}) > sealing_window_seconds*2(${abandonThreshold})`,
				};
			}
		}
		return {
			action: "keep",
			reason: "raw_partition_within_sealing_window",
		};
	}

	// ── Rule 4: sealed (or any other state) → keep ───────────────────────────
	return {
		action: "keep",
		reason: `partition_state_keep: state(${partition.state}) does not meet archive or delete conditions`,
	};
}
