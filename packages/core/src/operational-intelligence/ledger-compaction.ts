/**
 * R3-S6.5: Ledger retention/compaction snapshots.
 * Pure advisory logic only: no IO, no writes, no dispatch/model-selection authority.
 */
import { createHash } from "node:crypto";

import {
	type ValidationResult,
	valid,
	invalid,
	validateNoForbiddenRawPayloads,
	validateOpaqueId,
	validateOpaqueRef,
	validateTimestamp,
	validateHashRef,
	isRecord,
	rejectUnknownProperties,
	stableStringify,
} from "./shared.js";

import {
	type FlowDeskLedgerRetentionPolicyV1,
	type FlowDeskRoutingAdvisoryLedgerEntryV1,
	createFlowDeskLedgerRetentionPolicyV1,
	validateFlowDeskLedgerRetentionPolicyV1,
} from "./routing-advisory.js";

export type FlowDeskLedgerCompactionTriggerReasonV1 = "size_limit" | "count_limit" | "manual";

export interface FlowDeskLedgerCompactionSnapshotV1 {
	schema_version: "flowdesk.ledger_compaction_snapshot.v1";
	compaction_id: string;
	policy_ref: string;
	workflow_id?: string;
	original_entry_count: number;
	retained_entry_count: number;
	pruned_entry_count: number;
	pruned_ttl_count: number;
	pruned_cap_count: number;
	pending_gate_promotion_preserved_count: number;
	byte_size_pre: number;
	byte_size_post: number;
	trigger_reason: FlowDeskLedgerCompactionTriggerReasonV1;
	ledger_hash_before: string;
	ledger_hash_after: string;
	compacted_at: string;
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
	model_selection_authority_enabled: false;
	ranking_authority_enabled: false;
}

export interface FlowDeskLedgerCompactionResultV1 {
	ok: boolean;
	errors: string[];
	retainedEntries?: FlowDeskRoutingAdvisoryLedgerEntryV1[];
	snapshot?: FlowDeskLedgerCompactionSnapshotV1;
}

export interface FlowDeskRoutingAdvisoryLedgerDecodeResultV1 {
	ok: boolean;
	errors: string[];
	entries?: FlowDeskRoutingAdvisoryLedgerEntryV1[];
}

type DecodedRoutingEntry = FlowDeskRoutingAdvisoryLedgerEntryV1 & {
	sequence?: unknown;
	previous_ledger_entry_id?: unknown;
};

const AUTHORITY_FLAGS = {
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
	model_selection_authority_enabled: false,
	ranking_authority_enabled: false,
} as const;

const SNAPSHOT_ALLOWED = [
	"schema_version",
	"compaction_id",
	"policy_ref",
	"workflow_id",
	"original_entry_count",
	"retained_entry_count",
	"pruned_entry_count",
	"pruned_ttl_count",
	"pruned_cap_count",
	"pending_gate_promotion_preserved_count",
	"byte_size_pre",
	"byte_size_post",
	"trigger_reason",
	"ledger_hash_before",
	"ledger_hash_after",
	"compacted_at",
	...Object.keys(AUTHORITY_FLAGS),
] as const;

const triggerReasons: readonly string[] = ["size_limit", "count_limit", "manual"];

function validateAuthorityFlags(record: Record<string, unknown>, label: string): string[] {
	const errors: string[] = [];
	for (const [key, expected] of Object.entries(AUTHORITY_FLAGS)) if (record[key] !== expected) errors.push(`${label}.${key} must be ${String(expected)}`);
	return errors;
}

function encodeRoutingLedgerJsonl(entries: readonly FlowDeskRoutingAdvisoryLedgerEntryV1[]): string {
	if (entries.length === 0) return "";
	return `${entries.map((entry) => stableStringify(entry)).join("\n")}\n`;
}

function sha256Jsonl(jsonl: string): string {
	return `sha256-${createHash("sha256").update(jsonl, "utf8").digest("hex")}`;
}

function byteSize(value: string): number {
	return Buffer.byteLength(value, "utf8");
}

function validateDecodedRoutingEntry(entry: unknown, label: string): string[] {
	const errors: string[] = [];
	if (!isRecord(entry)) return [`${label} must be an object`];
	const record = entry as Record<string, unknown>;
	if (typeof record.signature_ref !== "string" || record.signature_ref.length === 0) errors.push(`${label}.signature_ref must be a non-empty string`);
	if (typeof record.model_ref !== "string" || record.model_ref.length === 0) errors.push(`${label}.model_ref must be a non-empty string`);
	if (typeof record.weighted_score !== "number" || !Number.isFinite(record.weighted_score)) errors.push(`${label}.weighted_score must be a finite number`);
	errors.push(...validateTimestamp(record.recorded_at, `${label}.recorded_at`).errors);
	errors.push(...validateNoForbiddenRawPayloads(record, label).errors);
	return errors;
}

function hasPendingGatePromotionPublicationState(entry: FlowDeskRoutingAdvisoryLedgerEntryV1): boolean {
	if (!isRecord(entry)) return false;
	const record = entry as Record<string, unknown>;
	const schemaVersion = record.schema_version;
	const publicationState = record.publication_state ?? record.publicationState;
	return typeof schemaVersion === "string" && schemaVersion.includes("publication_result") && publicationState === "pending_gate_promotion";
}

export function compactFlowDeskAdvisoryLedgerV1(input: {
	entries: readonly FlowDeskRoutingAdvisoryLedgerEntryV1[];
	policy?: FlowDeskLedgerRetentionPolicyV1;
	policyRef: string;
	compactionId: string;
	workflowId?: string;
	triggerReason: FlowDeskLedgerCompactionTriggerReasonV1;
	compactedAt: string;
}): FlowDeskLedgerCompactionResultV1 {
	const policy = input.policy ?? createFlowDeskLedgerRetentionPolicyV1();
	const errors: string[] = [];
	errors.push(...validateFlowDeskLedgerRetentionPolicyV1(policy).errors);
	errors.push(...validateOpaqueRef(input.policyRef, "policy_ref").errors);
	errors.push(...validateOpaqueId(input.compactionId, "compaction_id").errors);
	if (input.workflowId !== undefined) errors.push(...validateOpaqueId(input.workflowId, "workflow_id").errors);
	if (!triggerReasons.includes(input.triggerReason)) errors.push("trigger_reason is invalid");
	errors.push(...validateTimestamp(input.compactedAt, "compacted_at").errors);

	for (const [index, entry] of input.entries.entries()) {
		const record = entry as DecodedRoutingEntry;
		if (record.sequence !== undefined || record.previous_ledger_entry_id !== undefined) errors.push(`entries[${index}] linked ledger fields are unsupported by R3-S6.5 compaction`);
		errors.push(...validateDecodedRoutingEntry(entry, `entries[${index}]`));
	}
	if (errors.length > 0) return { ok: false, errors };

	const originalJsonl = encodeRoutingLedgerJsonl(input.entries);
	const compactedAtMs = Date.parse(input.compactedAt);
	const maxAgeMs = policy.max_score_age_days * 24 * 60 * 60 * 1000;
	const cutoffMs = compactedAtMs - maxAgeMs;

	const pendingGatePromotionPreserved = new Set<FlowDeskRoutingAdvisoryLedgerEntryV1>();
	const ttlRetained: FlowDeskRoutingAdvisoryLedgerEntryV1[] = [];
	let prunedTtlCount = 0;
	for (const entry of input.entries) {
		if (Date.parse(entry.recorded_at) < cutoffMs) {
			if (hasPendingGatePromotionPublicationState(entry)) {
				pendingGatePromotionPreserved.add(entry);
				ttlRetained.push(entry);
			} else {
				prunedTtlCount += 1;
			}
		} else ttlRetained.push(entry);
	}

	const keepBySignature = new Map<string, Set<FlowDeskRoutingAdvisoryLedgerEntryV1>>();
	const bySignature = new Map<string, FlowDeskRoutingAdvisoryLedgerEntryV1[]>();
	for (const entry of ttlRetained) {
		const bucket = bySignature.get(entry.signature_ref) ?? [];
		bucket.push(entry);
		bySignature.set(entry.signature_ref, bucket);
	}
	for (const [signature, entries] of bySignature.entries()) {
		const capRetained = new Set(entries
			.map((entry, originalIndex) => ({ entry, originalIndex }))
			.sort((a, b) => Date.parse(b.entry.recorded_at) - Date.parse(a.entry.recorded_at) || a.originalIndex - b.originalIndex)
			.slice(0, policy.max_ledger_entries_per_signature)
			.map(({ entry }) => entry));
		for (const entry of entries) {
			if (hasPendingGatePromotionPublicationState(entry) && !capRetained.has(entry)) {
				pendingGatePromotionPreserved.add(entry);
				capRetained.add(entry);
			}
		}
		keepBySignature.set(signature, capRetained);
	}

	const retainedEntries = ttlRetained.filter((entry) => keepBySignature.get(entry.signature_ref)?.has(entry) === true);
	const prunedCapCount = ttlRetained.length - retainedEntries.length;
	const retainedJsonl = encodeRoutingLedgerJsonl(retainedEntries);
	const snapshot: FlowDeskLedgerCompactionSnapshotV1 = {
		schema_version: "flowdesk.ledger_compaction_snapshot.v1",
		compaction_id: input.compactionId,
		policy_ref: input.policyRef,
		...(input.workflowId === undefined ? {} : { workflow_id: input.workflowId }),
		original_entry_count: input.entries.length,
		retained_entry_count: retainedEntries.length,
		pruned_entry_count: prunedTtlCount + prunedCapCount,
		pruned_ttl_count: prunedTtlCount,
		pruned_cap_count: prunedCapCount,
		pending_gate_promotion_preserved_count: pendingGatePromotionPreserved.size,
		byte_size_pre: byteSize(originalJsonl),
		byte_size_post: byteSize(retainedJsonl),
		trigger_reason: input.triggerReason,
		ledger_hash_before: sha256Jsonl(originalJsonl),
		ledger_hash_after: sha256Jsonl(retainedJsonl),
		compacted_at: input.compactedAt,
		...AUTHORITY_FLAGS,
	};

	const snapshotValidation = validateFlowDeskLedgerCompactionSnapshotV1(snapshot);
	if (!snapshotValidation.ok) return { ok: false, errors: snapshotValidation.errors };
	return { ok: true, errors: [], retainedEntries, snapshot };
}

export function validateFlowDeskLedgerCompactionSnapshotV1(value: unknown): ValidationResult {
	if (!isRecord(value)) return invalid("ledger compaction snapshot must be an object");
	const record = value as Record<string, unknown>;
	const errors: string[] = [];
	errors.push(...rejectUnknownProperties(record, SNAPSHOT_ALLOWED, "ledger compaction snapshot").errors);
	if (record.schema_version !== "flowdesk.ledger_compaction_snapshot.v1") errors.push("invalid schema_version");
	errors.push(...validateOpaqueId(record.compaction_id, "compaction_id").errors);
	errors.push(...validateOpaqueRef(record.policy_ref, "policy_ref").errors);
	if (record.workflow_id !== undefined) errors.push(...validateOpaqueId(record.workflow_id, "workflow_id").errors);
	for (const field of ["original_entry_count", "retained_entry_count", "pruned_entry_count", "pruned_ttl_count", "pruned_cap_count", "pending_gate_promotion_preserved_count", "byte_size_pre", "byte_size_post"] as const) {
		if (!Number.isInteger(record[field]) || (record[field] as number) < 0) errors.push(`${field} must be a non-negative integer`);
	}
	if (typeof record.original_entry_count === "number" && typeof record.retained_entry_count === "number" && typeof record.pruned_entry_count === "number" && record.original_entry_count !== record.retained_entry_count + record.pruned_entry_count) errors.push("original_entry_count must equal retained_entry_count + pruned_entry_count");
	if (typeof record.pruned_entry_count === "number" && typeof record.pruned_ttl_count === "number" && typeof record.pruned_cap_count === "number" && record.pruned_entry_count !== record.pruned_ttl_count + record.pruned_cap_count) errors.push("pruned_entry_count must equal pruned_ttl_count + pruned_cap_count");
	if (!triggerReasons.includes(record.trigger_reason as string)) errors.push("trigger_reason is invalid");
	errors.push(...validateHashRef(record.ledger_hash_before, "ledger_hash_before").errors);
	errors.push(...validateHashRef(record.ledger_hash_after, "ledger_hash_after").errors);
	errors.push(...validateTimestamp(record.compacted_at, "compacted_at").errors);
	errors.push(...validateAuthorityFlags(record, "ledger compaction snapshot"));
	errors.push(...validateNoForbiddenRawPayloads(record, "ledger compaction snapshot").errors);
	return errors.length === 0 ? valid() : invalid(...errors);
}

function* iterateJsonlLines(jsonl: string): Generator<{ line: string; lineNumber: number }> {
	let start = 0;
	let lineNumber = 1;
	for (let index = 0; index < jsonl.length; index += 1) {
		if (jsonl[index] !== "\n") continue;
		yield { line: jsonl.slice(start, index), lineNumber };
		start = index + 1;
		lineNumber += 1;
	}
	if (start < jsonl.length) yield { line: jsonl.slice(start), lineNumber };
}

export function decodeFlowDeskRoutingAdvisoryLedgerJsonlV1(jsonl: string): FlowDeskRoutingAdvisoryLedgerDecodeResultV1 {
	const entries: FlowDeskRoutingAdvisoryLedgerEntryV1[] = [];
	const errors: string[] = [];
	if (typeof jsonl !== "string") return { ok: false, errors: ["routing advisory ledger JSONL must be a string"] };
	for (const { line, lineNumber } of iterateJsonlLines(jsonl)) {
		if (line.length === 0) continue;
		if (line.includes("\r")) {
			errors.push(`line ${lineNumber}: routing advisory ledger JSONL line must not contain carriage returns`);
			continue;
		}
		let parsed: unknown;
		try {
			parsed = JSON.parse(line);
		} catch {
			errors.push(`line ${lineNumber}: routing advisory ledger JSONL line is malformed JSON`);
			continue;
		}
		const entryErrors = validateDecodedRoutingEntry(parsed, `line ${lineNumber}`);
		if (entryErrors.length > 0) errors.push(...entryErrors);
		else entries.push(parsed as FlowDeskRoutingAdvisoryLedgerEntryV1);
	}
	return errors.length === 0 ? { ok: true, errors: [], entries } : { ok: false, errors };
}
