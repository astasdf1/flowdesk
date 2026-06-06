/**
 * Local ledger snapshot contract.
 * P7-S13.5 submodule: ledger
 */
import {
	type ValidationResult,
	valid,
	invalid,
	validateNoForbiddenRawPayloads,
	validateOpaqueId,
	validateOpaqueRef,
	isRecord,
	rejectUnknownProperties,
	validateTimestamp,
	validateHashRef,
} from "./shared.js";

// ─── Interface ────────────────────────────────────────────────────────────────

/**
 * Pure advisory snapshot of the local operational-intelligence ledger state.
 */
export interface FlowDeskLocalLedgerSnapshotV1 {
	schema_version: "flowdesk.local_ledger_snapshot.v1";
	snapshot_id: string;
	workflow_id: string;
	captured_at: string;
	entry_count: number;
	oldest_entry_ref?: string;
	newest_entry_ref?: string;
	content_hash_summary?: string;
	staleness_seconds: number;
	safe_next_actions: string[];
	advisory_only: true;
	non_authorizing: true;
	dispatch_authority_enabled: false;
	approval_authority_enabled: false;
	provider_authority_enabled: false;
	runtime_authority_enabled: false;
	external_write_authority_enabled: false;
	remote_write_authority_enabled: false;
	fallback_authority_enabled: false;
	lane_launch_authority_enabled: false;
	write_authority_enabled: false;
	hard_chat_authority_enabled: false;
}

export interface FlowDeskLocalLedgerSnapshotResultV1 {
	ok: boolean;
	errors: string[];
	snapshot?: FlowDeskLocalLedgerSnapshotV1;
}

// ─── Creator ──────────────────────────────────────────────────────────────────

export function createFlowDeskLocalLedgerSnapshotV1(input: {
	snapshotId: string;
	workflowId: string;
	capturedAt: string;
	entryCount: number;
	oldestEntryRef?: string;
	newestEntryRef?: string;
	contentHashSummary?: string;
	stalenessSeconds: number;
	safeNextActions: string[];
}): FlowDeskLocalLedgerSnapshotResultV1 {
	const errors: string[] = [];
	errors.push(...validateOpaqueId(input.snapshotId, "snapshot_id").errors);
	errors.push(...validateOpaqueId(input.workflowId, "workflow_id").errors);
	errors.push(...validateTimestamp(input.capturedAt, "captured_at").errors);

	if (typeof input.entryCount !== "number" || !Number.isInteger(input.entryCount) || input.entryCount < 0) {
		errors.push("entry_count must be a non-negative integer");
	}
	if (typeof input.stalenessSeconds !== "number" || !Number.isFinite(input.stalenessSeconds) || input.stalenessSeconds < 0) {
		errors.push("staleness_seconds must be a non-negative finite number");
	}

	if (input.oldestEntryRef !== undefined) errors.push(...validateOpaqueRef(input.oldestEntryRef, "oldest_entry_ref").errors);
	if (input.newestEntryRef !== undefined) errors.push(...validateOpaqueRef(input.newestEntryRef, "newest_entry_ref").errors);

	if (input.contentHashSummary !== undefined) {
		errors.push(...validateHashRef(input.contentHashSummary, "content_hash_summary").errors);
	}

	if (!Array.isArray(input.safeNextActions) || input.safeNextActions.length === 0 || input.safeNextActions.length > 8) {
		errors.push("safe_next_actions must be a non-empty bounded array (1..8 entries)");
	} else {
		for (const [index, action] of input.safeNextActions.entries()) {
			errors.push(...validateOpaqueRef(action, `safe_next_actions[${index}]`).errors);
		}
	}

	const entryCountZero = typeof input.entryCount === "number" && input.entryCount === 0;
	if (entryCountZero && input.oldestEntryRef !== undefined) errors.push("oldest_entry_ref must be absent when entry_count is 0");
	if (entryCountZero && input.newestEntryRef !== undefined) errors.push("newest_entry_ref must be absent when entry_count is 0");
	if (entryCountZero && input.contentHashSummary !== undefined) errors.push("content_hash_summary must be absent when entry_count is 0");

	const hasOldest = input.oldestEntryRef !== undefined;
	const hasNewest = input.newestEntryRef !== undefined;
	if (hasOldest !== hasNewest) errors.push("oldest_entry_ref and newest_entry_ref must both be present or both absent");

	if (errors.length > 0) return { ok: false, errors };

	const snapshot: FlowDeskLocalLedgerSnapshotV1 = {
		schema_version: "flowdesk.local_ledger_snapshot.v1",
		snapshot_id: input.snapshotId,
		workflow_id: input.workflowId,
		captured_at: input.capturedAt,
		entry_count: input.entryCount,
		...(input.oldestEntryRef !== undefined ? { oldest_entry_ref: input.oldestEntryRef } : {}),
		...(input.newestEntryRef !== undefined ? { newest_entry_ref: input.newestEntryRef } : {}),
		...(input.contentHashSummary !== undefined ? { content_hash_summary: input.contentHashSummary } : {}),
		staleness_seconds: input.stalenessSeconds,
		safe_next_actions: [...input.safeNextActions],
		advisory_only: true,
		non_authorizing: true,
		dispatch_authority_enabled: false,
		approval_authority_enabled: false,
		provider_authority_enabled: false,
		runtime_authority_enabled: false,
		external_write_authority_enabled: false,
		remote_write_authority_enabled: false,
		fallback_authority_enabled: false,
		lane_launch_authority_enabled: false,
		write_authority_enabled: false,
		hard_chat_authority_enabled: false,
	};
	return { ok: true, errors: [], snapshot };
}

// ─── Validator ────────────────────────────────────────────────────────────────

const localLedgerSnapshotAllowedProperties = [
	"schema_version",
	"snapshot_id",
	"workflow_id",
	"captured_at",
	"entry_count",
	"oldest_entry_ref",
	"newest_entry_ref",
	"content_hash_summary",
	"staleness_seconds",
	"safe_next_actions",
	"advisory_only",
	"non_authorizing",
	"dispatch_authority_enabled",
	"approval_authority_enabled",
	"provider_authority_enabled",
	"runtime_authority_enabled",
	"external_write_authority_enabled",
	"remote_write_authority_enabled",
	"fallback_authority_enabled",
	"lane_launch_authority_enabled",
	"write_authority_enabled",
	"hard_chat_authority_enabled",
] as const;

export function validateFlowDeskLocalLedgerSnapshotV1(value: unknown): ValidationResult {
	if (!isRecord(value)) return invalid("local ledger snapshot must be an object");
	const record = value as Record<string, unknown>;
	const errors: string[] = [];

	errors.push(...rejectUnknownProperties(record, localLedgerSnapshotAllowedProperties, "local ledger snapshot").errors);

	if (record.schema_version !== "flowdesk.local_ledger_snapshot.v1") errors.push("local ledger snapshot schema_version is invalid");

	errors.push(...validateOpaqueId(record.snapshot_id, "snapshot_id").errors);
	errors.push(...validateOpaqueId(record.workflow_id, "workflow_id").errors);
	errors.push(...validateTimestamp(record.captured_at, "captured_at").errors);

	if (typeof record.entry_count !== "number" || !Number.isInteger(record.entry_count) || record.entry_count < 0) {
		errors.push("entry_count must be a non-negative integer");
	}

	if (typeof record.staleness_seconds !== "number" || !Number.isFinite(record.staleness_seconds) || record.staleness_seconds < 0) {
		errors.push("staleness_seconds must be a non-negative finite number");
	}

	if (record.oldest_entry_ref !== undefined) errors.push(...validateOpaqueRef(record.oldest_entry_ref, "oldest_entry_ref").errors);
	if (record.newest_entry_ref !== undefined) errors.push(...validateOpaqueRef(record.newest_entry_ref, "newest_entry_ref").errors);

	if (record.content_hash_summary !== undefined) {
		errors.push(...validateHashRef(record.content_hash_summary, "content_hash_summary").errors);
	}

	if (!Array.isArray(record.safe_next_actions) || record.safe_next_actions.length === 0 || record.safe_next_actions.length > 8) {
		errors.push("safe_next_actions must be a non-empty bounded array (1..8 entries)");
	} else {
		for (const [index, action] of record.safe_next_actions.entries()) {
			errors.push(...validateOpaqueRef(action, `safe_next_actions[${index}]`).errors);
		}
	}

	if (typeof record.entry_count === "number" && record.entry_count === 0) {
		if (record.oldest_entry_ref !== undefined) errors.push("oldest_entry_ref must be absent when entry_count is 0");
		if (record.newest_entry_ref !== undefined) errors.push("newest_entry_ref must be absent when entry_count is 0");
		if (record.content_hash_summary !== undefined) errors.push("content_hash_summary must be absent when entry_count is 0");
	}

	const hasOldest = record.oldest_entry_ref !== undefined;
	const hasNewest = record.newest_entry_ref !== undefined;
	if (hasOldest !== hasNewest) errors.push("oldest_entry_ref and newest_entry_ref must both be present or both absent");

	if (record.advisory_only !== true
		|| record.non_authorizing !== true
		|| record.dispatch_authority_enabled !== false
		|| record.approval_authority_enabled !== false
		|| record.provider_authority_enabled !== false
		|| record.runtime_authority_enabled !== false
		|| record.external_write_authority_enabled !== false
		|| record.remote_write_authority_enabled !== false
		|| record.fallback_authority_enabled !== false
		|| record.lane_launch_authority_enabled !== false
		|| record.write_authority_enabled !== false
		|| record.hard_chat_authority_enabled !== false) {
		errors.push("local ledger snapshot must remain advisory-only non-authorizing with no dispatch, approval, provider, runtime, external-write, remote-write, fallback, lane-launch, write, or hard-chat authority");
	}

	errors.push(...validateNoForbiddenRawPayloads(record, "local_ledger_snapshot").errors);
	return errors.length === 0 ? valid() : invalid(...errors);
}
