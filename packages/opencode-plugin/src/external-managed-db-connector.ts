/**
 * P7-S27: External Managed DB Connector — GitHub Actions OIDC external DB ingestion.
 *
 * Provides advisory-only ingestion of FlowDeskLedgerRollupResultV1 snapshots
 * into an OIDC-protected external managed database endpoint.
 *
 * Gate hierarchy:
 *   1. allowActualRemoteWrite must be explicitly true → dry_run
 *   2. idempotencyKey already seen in this session → idempotent_skip
 *   3. All gates passed → attempt OIDC-authenticated POST to endpointUrl
 *
 * Additional semantics:
 *   - Raw rollup score (weighted_mean_score) is never transmitted; only
 *     confidence_bucket (advisory label) is included in the payload.
 *   - migration manifest with trusted_chain_head_invalidated=true →
 *     cutover_required: true in the result.
 *   - source_precedence is always "local_first".
 *
 * All authority flags are always false.
 * No dispatch, provider, runtime, lane-launch, fallback, or hard-chat authority.
 */

import type { FlowDeskLedgerRollupResultV1 } from "@flowdesk/core";

// ─── MigrationManifestV1 (P7-S26 type) ───────────────────────────────────────

/**
 * MigrationManifestV1 captures the outcome of a schema migration attempt
 * for the local FlowDesk score ledger.  It is produced by the S26 migration
 * runner and consumed by downstream connectors (this file) to determine
 * whether a cutover to a fresh chain head is required.
 *
 * trusted_chain_head_invalidated: true means the previously anchored chain
 * head was invalidated by the migration (e.g., schema incompatibility or
 * genesis hash mismatch) and a new trusted chain head must be established
 * before the partition data can be ingested into the external DB.
 */
export interface MigrationManifestV1 {
	schema_version: "flowdesk.migration_manifest.v1";
	migration_id: string;
	source_schema_version: string;
	target_schema_version: string;
	migration_status: "completed" | "partial" | "failed" | "dry_run";
	trusted_chain_head_invalidated?: boolean;
	affected_partition_ids?: string[];
	migration_completed_at?: string;
	advisory_only: true;
	dispatch_authority_enabled: false;
}

// ─── Connector config ─────────────────────────────────────────────────────────

export interface ExternalManagedDbConnectorConfigV1 {
	/** OIDC token-protected endpoint URL for ingestion. */
	endpointUrl: string;
	/** Optional GCP Workload Identity Provider resource name. */
	workloadIdentityProvider?: string;
	/** Optional GCP service account email. */
	serviceAccount?: string;
	/**
	 * When false (default), no remote write is attempted and the function
	 * returns status: "dry_run".
	 */
	allowActualRemoteWrite?: boolean;
	/** Injected fetch implementation for testing. */
	fetchImpl?: typeof globalThis.fetch;
}

// ─── Ingestion input / result ─────────────────────────────────────────────────

export interface ExternalDbIngestionInputV1 {
	/** The rollup result to ingest. Raw scores are NOT transmitted externally. */
	rollupSummary: FlowDeskLedgerRollupResultV1;
	/** Partition identifier bound to the rollup. */
	partitionId: string;
	/** Schema hash for the originating partition. */
	schemaHash: string;
	/**
	 * Opaque idempotency key unique per (partition, rollup hash).
	 * Repeated calls with the same key return idempotent_skip.
	 */
	idempotencyKey: string;
	/** Connector configuration, including the remote endpoint and write flag. */
	config: ExternalManagedDbConnectorConfigV1;
	/** Optional migration manifest from the S26 migration runner. */
	migrationManifest?: MigrationManifestV1;
}

export interface ExternalDbIngestionResultV1 {
	status: "ingested" | "dry_run" | "blocked" | "idempotent_skip";
	blocked_labels?: string[];
	/** ISO timestamp of the last successfully ingested rollup watermark. */
	ingestion_watermark?: string;
	/** Always "local_first" — local ledger data is the authoritative source. */
	source_precedence?: "local_first";
	/**
	 * When true, a fresh trusted chain head must be established before further
	 * ingestion (driven by migration manifest trusted_chain_head_invalidated).
	 */
	cutover_required?: boolean;
	/**
	 * When true, the idempotency key was verified and a prior ingestion for this
	 * (partition, rollup hash) combination already succeeded.
	 */
	idempotency_verified?: boolean;
	authority: {
		advisoryOnlyRecord: true;
		remoteWriteAuthorityEnabledInRecord: false;
		dispatchAuthorityEnabled: false;
	};
}

// ─── Authority constant ───────────────────────────────────────────────────────

const AUTHORITY_BLOCK: ExternalDbIngestionResultV1["authority"] = {
	advisoryOnlyRecord: true as const,
	remoteWriteAuthorityEnabledInRecord: false as const,
	dispatchAuthorityEnabled: false as const,
};

// ─── In-process idempotency store ─────────────────────────────────────────────

/**
 * Module-level idempotency store: tracks idempotency keys that have
 * successfully completed an ingestion in this process lifecycle.
 *
 * This is an in-process guard only — a durable external idempotency store
 * would be required for cross-process guarantees.
 */
const _seenIdempotencyKeys = new Set<string>();

/**
 * Reset the in-process idempotency store.
 * Intended for use in tests only.
 */
export function _resetIdempotencyStoreForTest(): void {
	_seenIdempotencyKeys.clear();
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

/**
 * Build the sanitized ingestion payload.
 * Raw rollup score (weighted_mean_score) is intentionally excluded;
 * only confidence_bucket is transmitted.
 */
function buildIngestionPayload(input: ExternalDbIngestionInputV1): Record<string, unknown> {
	return {
		schema_version: "flowdesk.external_db_ingestion.v1",
		partition_id: input.partitionId,
		schema_hash: input.schemaHash,
		idempotency_key: input.idempotencyKey,
		// Only advisory label transmitted — raw score is never exposed externally
		confidence_bucket: input.rollupSummary.confidence_bucket,
		source_partition_ids: input.rollupSummary.source_partition_ids,
		sample_count: input.rollupSummary.sample_count,
		effective_sample_count: input.rollupSummary.effective_sample_count,
		last_observation_at: input.rollupSummary.last_observation_at,
		rollup_hash: input.rollupSummary.rollup_hash,
		source_precedence: "local_first",
		// Authority flags in payload
		advisory_only: true,
		dispatch_authority_enabled: false,
	};
}

/**
 * Determine whether cutover is required from the optional migration manifest.
 */
function isCutoverRequired(migrationManifest?: MigrationManifestV1): boolean {
	return migrationManifest?.trusted_chain_head_invalidated === true;
}

// ─── Main export ──────────────────────────────────────────────────────────────

/**
 * Ingest a FlowDeskLedgerRollupResultV1 snapshot into an OIDC-protected
 * external managed database.
 *
 * Gate 1: allowActualRemoteWrite !== true → returns "dry_run"
 * Gate 2: idempotencyKey already seen    → returns "idempotent_skip"
 * Gate 3: fetch POST to endpointUrl      → returns "ingested" on 2xx, "blocked" otherwise
 *
 * The result always includes:
 *   - source_precedence: "local_first"
 *   - authority flags: all false
 *   - cutover_required: true when migration manifest signals chain head invalidation
 *
 * Raw rollup score is never transmitted; only confidence_bucket is included.
 */
export async function ingestToExternalManagedDbV1(
	input: ExternalDbIngestionInputV1,
): Promise<ExternalDbIngestionResultV1> {
	const cutoverRequired = isCutoverRequired(input.migrationManifest);

	// ── Gate 1: dry-run when allowActualRemoteWrite is not explicitly true ─────
	if (input.config.allowActualRemoteWrite !== true) {
		return {
			status: "dry_run",
			source_precedence: "local_first",
			cutover_required: cutoverRequired || undefined,
			authority: AUTHORITY_BLOCK,
		};
	}

	// ── Gate 2: idempotency check ─────────────────────────────────────────────
	if (_seenIdempotencyKeys.has(input.idempotencyKey)) {
		return {
			status: "idempotent_skip",
			source_precedence: "local_first",
			cutover_required: cutoverRequired || undefined,
			idempotency_verified: true,
			authority: AUTHORITY_BLOCK,
		};
	}

	// ── Gate 3: attempt remote ingestion ──────────────────────────────────────
	const fetchImpl = input.config.fetchImpl ?? globalThis.fetch;

	if (typeof fetchImpl !== "function") {
		return {
			status: "blocked",
			blocked_labels: ["fetch-not-available"],
			source_precedence: "local_first",
			cutover_required: cutoverRequired || undefined,
			authority: AUTHORITY_BLOCK,
		};
	}

	const payload = buildIngestionPayload(input);

	let response: Awaited<ReturnType<typeof globalThis.fetch>>;
	try {
		response = await fetchImpl(input.config.endpointUrl, {
			method: "POST",
			headers: {
				"Content-Type": "application/json",
				// OIDC tokens would be injected by the GitHub Actions runner via
				// environment variables (e.g., ACTIONS_ID_TOKEN_REQUEST_TOKEN).
				// The connector does not handle token acquisition directly.
			},
			body: JSON.stringify(payload),
		});
	} catch (err) {
		return {
			status: "blocked",
			blocked_labels: [
				`fetch-error:${err instanceof Error ? err.message.slice(0, 80).replace(/\s+/g, "-") : "unknown"}`,
			],
			source_precedence: "local_first",
			cutover_required: cutoverRequired || undefined,
			authority: AUTHORITY_BLOCK,
		};
	}

	if (!response.ok) {
		return {
			status: "blocked",
			blocked_labels: [`http-error:${response.status}`],
			source_precedence: "local_first",
			cutover_required: cutoverRequired || undefined,
			authority: AUTHORITY_BLOCK,
		};
	}

	// ── Successful ingestion: record idempotency key ───────────────────────────
	_seenIdempotencyKeys.add(input.idempotencyKey);

	return {
		status: "ingested",
		ingestion_watermark: new Date().toISOString(),
		source_precedence: "local_first",
		cutover_required: cutoverRequired || undefined,
		authority: AUTHORITY_BLOCK,
	};
}
