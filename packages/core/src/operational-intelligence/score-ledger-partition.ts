/**
 * Score ledger partition lifecycle contract.
 * P7-S15: Partition state transitions, manifest contracts, and trusted chain head validation.
 * Additive, advisory-only, non-authorizing, all authority flags false.
 */
import {
	type ValidationResult,
	valid,
	invalid,
	validateNoForbiddenRawPayloads,
	validateOpaqueId,
	validateHashRef,
	isRecord,
	rejectUnknownProperties,
	validateTimestamp,
} from "./shared.js";

// ─── Partition State Union ────────────────────────────────────────────────────

export type FlowDeskScoreLedgerPartitionStateV1 = "raw" | "sealed" | "immutable";

// ─── CONTRACT: FlowDeskScoreLedgerPartitionV1 ──────────────────────────────────

export interface FlowDeskScoreLedgerPartitionV1 {
	schema_version: "flowdesk.score_ledger_partition.v1";
	partition_id: string;           // opaque id
	state: FlowDeskScoreLedgerPartitionStateV1;
	created_at: string;             // ISO timestamp
	sealed_at?: string;             // ISO timestamp
	immutable_at?: string;          // ISO timestamp
	entry_count: number;            // 0+
	genesis_hash: string;           // sha256-<64 hex> or hash-<ref>
	chain_head_hash: string;        // sha256-<64 hex> or hash-<ref>
	schema_hash: string;            // sha256-<64 hex> or hash-<ref>
	sealing_window_seconds: number; // default 86400 (24h)
	min_seal_threshold: number;     // default 100
	immutable_grace_period_seconds: number; // default 604800 (7d)
	// authority flags – all false
	advisory_only: true;
	non_authorizing: true;
	dispatch_authority_enabled: false;
	remote_write_authority_enabled: false;
}

const PARTITION_ALLOWED = [
	"schema_version", "partition_id", "state",
	"created_at", "sealed_at", "immutable_at",
	"entry_count", "genesis_hash", "chain_head_hash", "schema_hash",
	"sealing_window_seconds", "min_seal_threshold", "immutable_grace_period_seconds",
	"advisory_only", "non_authorizing", "dispatch_authority_enabled", "remote_write_authority_enabled",
] as const;

export function validateFlowDeskScoreLedgerPartitionV1(value: unknown): ValidationResult {
	if (!isRecord(value)) return invalid("partition must be an object");
	const record = value as Record<string, unknown>;
	const errors: string[] = [];

	errors.push(...rejectUnknownProperties(record, PARTITION_ALLOWED, "partition").errors);

	if (record.schema_version !== "flowdesk.score_ledger_partition.v1")
		errors.push("partition schema_version must be flowdesk.score_ledger_partition.v1");

	errors.push(...validateOpaqueId(record.partition_id, "partition_id").errors);

	const state = record.state;
	const validStates: FlowDeskScoreLedgerPartitionStateV1[] = ["raw", "sealed", "immutable"];
	if (typeof state !== "string" || !validStates.includes(state as FlowDeskScoreLedgerPartitionStateV1))
		errors.push("state must be one of: raw, sealed, immutable");

	// Timestamp validations
	errors.push(...validateTimestamp(record.created_at, "created_at").errors);

	if (record.sealed_at !== undefined)
		errors.push(...validateTimestamp(record.sealed_at, "sealed_at").errors);

	if (record.immutable_at !== undefined)
		errors.push(...validateTimestamp(record.immutable_at, "immutable_at").errors);

	// Entry count must be non-negative integer
	const entryCount = record.entry_count;
	if (typeof entryCount !== "number" || !Number.isInteger(entryCount) || entryCount < 0)
		errors.push("entry_count must be a non-negative integer");

	// Hash validations
	errors.push(...validateHashRef(record.genesis_hash, "genesis_hash").errors);
	errors.push(...validateHashRef(record.chain_head_hash, "chain_head_hash").errors);
	errors.push(...validateHashRef(record.schema_hash, "schema_hash").errors);

	// Numeric validations
	const sealingWindow = record.sealing_window_seconds;
	if (typeof sealingWindow !== "number" || !Number.isInteger(sealingWindow) || sealingWindow <= 0)
		errors.push("sealing_window_seconds must be a positive integer");

	const minThreshold = record.min_seal_threshold;
	if (typeof minThreshold !== "number" || !Number.isInteger(minThreshold) || minThreshold <= 0)
		errors.push("min_seal_threshold must be a positive integer");

	const gracePeriod = record.immutable_grace_period_seconds;
	if (typeof gracePeriod !== "number" || !Number.isInteger(gracePeriod) || gracePeriod <= 0)
		errors.push("immutable_grace_period_seconds must be a positive integer");

	// State transition validation
	if (state === "sealed" && !record.sealed_at)
		errors.push("sealed state requires sealed_at timestamp");
	if (state === "immutable" && !record.immutable_at)
		errors.push("immutable state requires immutable_at timestamp");

	// Authority flags
	if (record.advisory_only !== true) errors.push("advisory_only must be true");
	if (record.non_authorizing !== true) errors.push("non_authorizing must be true");
	if (record.dispatch_authority_enabled !== false) errors.push("dispatch_authority_enabled must be false");
	if (record.remote_write_authority_enabled !== false) errors.push("remote_write_authority_enabled must be false");

	errors.push(...validateNoForbiddenRawPayloads(record, "partition").errors);

	return errors.length === 0 ? valid() : invalid(...errors);
}

export type FlowDeskScoreLedgerPartitionResultV1 = {
	ok: true;
	errors: [];
	partition: FlowDeskScoreLedgerPartitionV1;
} | {
	ok: false;
	errors: string[];
	partition: undefined;
};

export function createFlowDeskScoreLedgerPartitionV1(input: {
	partitionId: string;
	state: FlowDeskScoreLedgerPartitionStateV1;
	createdAt: string;
	sealedAt?: string;
	immutableAt?: string;
	entryCount: number;
	genesisHash: string;
	chainHeadHash: string;
	schemaHash: string;
	sealingWindowSeconds?: number;
	minSealThreshold?: number;
	immutableGracePeriodSeconds?: number;
}): FlowDeskScoreLedgerPartitionResultV1 {
	const errors: string[] = [];

	if (input.state === "sealed" && !input.sealedAt)
		errors.push("sealed state requires sealedAt timestamp");
	if (input.state === "immutable" && !input.immutableAt)
		errors.push("immutable state requires immutableAt timestamp");

	if (errors.length > 0) return { ok: false, errors, partition: undefined };

	const partition: FlowDeskScoreLedgerPartitionV1 = {
		schema_version: "flowdesk.score_ledger_partition.v1",
		partition_id: input.partitionId,
		state: input.state,
		created_at: input.createdAt,
		sealed_at: input.sealedAt,
		immutable_at: input.immutableAt,
		entry_count: input.entryCount,
		genesis_hash: input.genesisHash,
		chain_head_hash: input.chainHeadHash,
		schema_hash: input.schemaHash,
		sealing_window_seconds: input.sealingWindowSeconds ?? 86400,
		min_seal_threshold: input.minSealThreshold ?? 100,
		immutable_grace_period_seconds: input.immutableGracePeriodSeconds ?? 604800,
		advisory_only: true,
		non_authorizing: true,
		dispatch_authority_enabled: false,
		remote_write_authority_enabled: false,
	};

	return { ok: true, errors: [], partition };
}

// ─── CONTRACT: FlowDeskScoreLedgerManifestV1 ──────────────────────────────────

export interface FlowDeskScoreLedgerManifestV1 {
	schema_version: "flowdesk.score_ledger_manifest.v1";
	manifest_id: string;
	partitions: FlowDeskScoreLedgerPartitionV1[];
	trusted_chain_head?: FlowDeskTrustedChainHeadV1;
	updated_at: string;             // ISO timestamp
	advisory_only: true;
	dispatch_authority_enabled: false;
}

const MANIFEST_ALLOWED = [
	"schema_version", "manifest_id", "partitions", "trusted_chain_head", "updated_at",
	"advisory_only", "dispatch_authority_enabled",
] as const;

export function validateFlowDeskScoreLedgerManifestV1(value: unknown): ValidationResult {
	if (!isRecord(value)) return invalid("manifest must be an object");
	const record = value as Record<string, unknown>;
	const errors: string[] = [];

	errors.push(...rejectUnknownProperties(record, MANIFEST_ALLOWED, "manifest").errors);

	if (record.schema_version !== "flowdesk.score_ledger_manifest.v1")
		errors.push("manifest schema_version must be flowdesk.score_ledger_manifest.v1");

	errors.push(...validateOpaqueId(record.manifest_id, "manifest_id").errors);

	if (!Array.isArray(record.partitions))
		errors.push("partitions must be an array");
	else {
		for (const [i, partition] of (record.partitions as unknown[]).entries()) {
			const partResult = validateFlowDeskScoreLedgerPartitionV1(partition);
			if (!partResult.ok) errors.push(...partResult.errors.map(e => `partitions[${i}]: ${e}`));
		}
	}

	if (record.trusted_chain_head !== undefined) {
		const chainHeadResult = validateFlowDeskTrustedChainHeadV1(record.trusted_chain_head);
		if (!chainHeadResult.ok) errors.push(...chainHeadResult.errors.map(e => `trusted_chain_head: ${e}`));
	}

	errors.push(...validateTimestamp(record.updated_at, "updated_at").errors);

	if (record.advisory_only !== true) errors.push("advisory_only must be true");
	if (record.dispatch_authority_enabled !== false) errors.push("dispatch_authority_enabled must be false");

	errors.push(...validateNoForbiddenRawPayloads(record, "manifest").errors);

	return errors.length === 0 ? valid() : invalid(...errors);
}

export type FlowDeskScoreLedgerManifestResultV1 = {
	ok: true;
	errors: [];
	manifest: FlowDeskScoreLedgerManifestV1;
} | {
	ok: false;
	errors: string[];
	manifest: undefined;
};

export function createFlowDeskScoreLedgerManifestV1(input: {
	manifestId: string;
	partitions: FlowDeskScoreLedgerPartitionV1[];
	updatedAt: string;
	trustedChainHead?: FlowDeskTrustedChainHeadV1;
}): FlowDeskScoreLedgerManifestResultV1 {
	const manifest: FlowDeskScoreLedgerManifestV1 = {
		schema_version: "flowdesk.score_ledger_manifest.v1",
		manifest_id: input.manifestId,
		partitions: input.partitions,
		trusted_chain_head: input.trustedChainHead,
		updated_at: input.updatedAt,
		advisory_only: true,
		dispatch_authority_enabled: false,
	};

	return { ok: true, errors: [], manifest };
}

// ─── CONTRACT: FlowDeskTrustedChainHeadV1 ────────────────────────────────────

export interface FlowDeskTrustedChainHeadV1 {
	schema_version: "flowdesk.trusted_chain_head.v1";
	partition_id: string;
	chain_head_hash: string;
	immutable_at: string;           // ISO timestamp
	advisory_only: true;
}

const CHAIN_HEAD_ALLOWED = [
	"schema_version", "partition_id", "chain_head_hash", "immutable_at", "advisory_only",
] as const;

export function validateFlowDeskTrustedChainHeadV1(value: unknown): ValidationResult {
	if (!isRecord(value)) return invalid("trusted chain head must be an object");
	const record = value as Record<string, unknown>;
	const errors: string[] = [];

	errors.push(...rejectUnknownProperties(record, CHAIN_HEAD_ALLOWED, "trusted chain head").errors);

	if (record.schema_version !== "flowdesk.trusted_chain_head.v1")
		errors.push("trusted chain head schema_version must be flowdesk.trusted_chain_head.v1");

	errors.push(...validateOpaqueId(record.partition_id, "partition_id").errors);
	errors.push(...validateHashRef(record.chain_head_hash, "chain_head_hash").errors);
	errors.push(...validateTimestamp(record.immutable_at, "immutable_at").errors);

	if (record.advisory_only !== true) errors.push("advisory_only must be true");

	errors.push(...validateNoForbiddenRawPayloads(record, "trusted chain head").errors);

	return errors.length === 0 ? valid() : invalid(...errors);
}

export type FlowDeskTrustedChainHeadResultV1 = {
	ok: true;
	errors: [];
	chainHead: FlowDeskTrustedChainHeadV1;
} | {
	ok: false;
	errors: string[];
	chainHead: undefined;
};

export function createFlowDeskTrustedChainHeadV1(input: {
	partitionId: string;
	chainHeadHash: string;
	immutableAt: string;
}): FlowDeskTrustedChainHeadResultV1 {
	const chainHead: FlowDeskTrustedChainHeadV1 = {
		schema_version: "flowdesk.trusted_chain_head.v1",
		partition_id: input.partitionId,
		chain_head_hash: input.chainHeadHash,
		immutable_at: input.immutableAt,
		advisory_only: true,
	};

	return { ok: true, errors: [], chainHead };
}
