/**
 * Tests for external-managed-db-connector.ts (P7-S27).
 *
 * Test cases:
 *   1. allowActualRemoteWrite=false (default) → dry_run
 *   2. allowActualRemoteWrite=true + mock 2xx → ingested
 *   3. idempotencyKey duplicate → idempotent_skip
 *   4. migrationManifest.trusted_chain_head_invalidated=true → cutover_required: true
 *   5. authority flags always false (dry_run path)
 *   6. authority flags always false (ingested path)
 *   7. allowActualRemoteWrite=true + mock 4xx → blocked with http-error label
 *   8. allowActualRemoteWrite=true + fetch throws → blocked with fetch-error label
 *   9. source_precedence is always "local_first"
 *  10. Raw weighted_mean_score is NOT sent in the payload body
 */
import assert from "node:assert/strict";
import { afterEach, test } from "node:test";
import type { FlowDeskLedgerRollupResultV1 } from "@flowdesk/core";
import {
	ingestToExternalManagedDbV1,
	_resetIdempotencyStoreForTest,
	type ExternalDbIngestionInputV1,
	type MigrationManifestV1,
} from "./external-managed-db-connector.js";

// ── Helpers ──────────────────────────────────────────────────────────────────

afterEach(() => {
	_resetIdempotencyStoreForTest();
});

function makeRollupSummary(
	overrides: Partial<FlowDeskLedgerRollupResultV1> = {},
): FlowDeskLedgerRollupResultV1 {
	return {
		schema_version: "flowdesk.ledger_rollup_result.v1",
		source_partition_ids: ["partition-2026-01-01"],
		sample_count: 50,
		effective_sample_count: 45,
		weighted_mean_score: 0.78,
		confidence_bucket: "high",
		p25: 0.55,
		p50: 0.75,
		p75: 0.88,
		p90: 0.93,
		decay_adjusted_mean: 0.76,
		last_observation_at: "2026-06-01T12:00:00.000Z",
		scorer_concentration: 0.22,
		negative_signal_count: 3,
		rollup_hash: "sha256-" + "a".repeat(64),
		advisory_only: true,
		dispatch_authority_enabled: false,
		ranking_authority_enabled: false,
		...overrides,
	};
}

function makeInput(
	overrides: Partial<ExternalDbIngestionInputV1> = {},
): ExternalDbIngestionInputV1 {
	return {
		rollupSummary: makeRollupSummary(),
		partitionId: "partition-2026-01-01",
		schemaHash: "sha256-" + "c".repeat(64),
		idempotencyKey: "idem-key-001",
		config: {
			endpointUrl: "https://db.example.com/ingest",
			allowActualRemoteWrite: false,
		},
		...overrides,
	};
}

function makeMockFetch(statusCode = 200) {
	const calls: Array<{ url: string; body: unknown }> = [];
	const fetchImpl = async (url: string, init: { body?: string }) => {
		calls.push({ url, body: init?.body ? JSON.parse(init.body) : undefined });
		return {
			ok: statusCode >= 200 && statusCode < 300,
			status: statusCode,
			json: async () => ({ ingested: true }),
		};
	};
	return { fetchImpl: fetchImpl as unknown as typeof globalThis.fetch, calls };
}

function makeMigrationManifest(
	overrides: Partial<MigrationManifestV1> = {},
): MigrationManifestV1 {
	return {
		schema_version: "flowdesk.migration_manifest.v1",
		migration_id: "migration-001",
		source_schema_version: "v1",
		target_schema_version: "v2",
		migration_status: "completed",
		advisory_only: true,
		dispatch_authority_enabled: false,
		...overrides,
	};
}

// ── Test 1: allowActualRemoteWrite=false → dry_run ───────────────────────────

test("ingestToExternalManagedDbV1 returns dry_run when allowActualRemoteWrite is false", async () => {
	const result = await ingestToExternalManagedDbV1(makeInput());

	assert.equal(result.status, "dry_run");
	assert.equal(result.source_precedence, "local_first");
	assert.equal(result.ingestion_watermark, undefined);
});

// ── Test 2: allowActualRemoteWrite=true + mock 2xx → ingested ────────────────

test("ingestToExternalManagedDbV1 returns ingested when allowActualRemoteWrite=true and fetch succeeds", async () => {
	const { fetchImpl, calls } = makeMockFetch(200);

	const result = await ingestToExternalManagedDbV1(
		makeInput({
			config: {
				endpointUrl: "https://db.example.com/ingest",
				allowActualRemoteWrite: true,
				fetchImpl,
			},
		}),
	);

	assert.equal(result.status, "ingested");
	assert.equal(result.source_precedence, "local_first");
	assert.ok(typeof result.ingestion_watermark === "string", "ingestion_watermark should be set");
	assert.ok(Date.parse(result.ingestion_watermark!) > 0, "ingestion_watermark should be parseable ISO");
	assert.equal(calls.length, 1, "fetch should have been called once");
	assert.equal(calls[0]!.url, "https://db.example.com/ingest");
});

// ── Test 3: duplicate idempotencyKey → idempotent_skip ───────────────────────

test("ingestToExternalManagedDbV1 returns idempotent_skip on duplicate idempotencyKey", async () => {
	const { fetchImpl } = makeMockFetch(200);
	const input = makeInput({
		config: {
			endpointUrl: "https://db.example.com/ingest",
			allowActualRemoteWrite: true,
			fetchImpl,
		},
	});

	// First call should succeed
	const first = await ingestToExternalManagedDbV1(input);
	assert.equal(first.status, "ingested", "First call should ingest");

	// Second call with same idempotency key should skip
	const second = await ingestToExternalManagedDbV1(input);
	assert.equal(second.status, "idempotent_skip");
	assert.equal(second.idempotency_verified, true);
	assert.equal(second.source_precedence, "local_first");
});

// ── Test 4: trusted_chain_head_invalidated=true → cutover_required: true ─────

test("ingestToExternalManagedDbV1 sets cutover_required when migration manifest invalidates chain head", async () => {
	const manifest = makeMigrationManifest({ trusted_chain_head_invalidated: true });

	// dry_run path also returns cutover_required
	const dryRunResult = await ingestToExternalManagedDbV1(
		makeInput({ migrationManifest: manifest }),
	);
	assert.equal(dryRunResult.status, "dry_run");
	assert.equal(dryRunResult.cutover_required, true);

	// ingested path also returns cutover_required
	const { fetchImpl } = makeMockFetch(200);
	const ingestedResult = await ingestToExternalManagedDbV1(
		makeInput({
			idempotencyKey: "idem-key-002",
			migrationManifest: manifest,
			config: {
				endpointUrl: "https://db.example.com/ingest",
				allowActualRemoteWrite: true,
				fetchImpl,
			},
		}),
	);
	assert.equal(ingestedResult.status, "ingested");
	assert.equal(ingestedResult.cutover_required, true);
});

// ── Test 5: authority flags always false (dry_run) ───────────────────────────

test("ingestToExternalManagedDbV1 authority flags are always false in dry_run", async () => {
	const result = await ingestToExternalManagedDbV1(makeInput());

	assert.equal(result.authority.advisoryOnlyRecord, true);
	assert.equal(result.authority.remoteWriteAuthorityEnabledInRecord, false);
	assert.equal(result.authority.dispatchAuthorityEnabled, false);
});

// ── Test 6: authority flags always false (ingested) ──────────────────────────

test("ingestToExternalManagedDbV1 authority flags are always false in ingested result", async () => {
	const { fetchImpl } = makeMockFetch(200);

	const result = await ingestToExternalManagedDbV1(
		makeInput({
			idempotencyKey: "idem-key-003",
			config: {
				endpointUrl: "https://db.example.com/ingest",
				allowActualRemoteWrite: true,
				fetchImpl,
			},
		}),
	);

	assert.equal(result.status, "ingested");
	assert.equal(result.authority.advisoryOnlyRecord, true);
	assert.equal(result.authority.remoteWriteAuthorityEnabledInRecord, false);
	assert.equal(result.authority.dispatchAuthorityEnabled, false);
});

// ── Test 7: mock 4xx → blocked with http-error label ─────────────────────────

test("ingestToExternalManagedDbV1 returns blocked with http-error label on non-2xx response", async () => {
	const { fetchImpl } = makeMockFetch(503);

	const result = await ingestToExternalManagedDbV1(
		makeInput({
			config: {
				endpointUrl: "https://db.example.com/ingest",
				allowActualRemoteWrite: true,
				fetchImpl,
			},
		}),
	);

	assert.equal(result.status, "blocked");
	assert.ok(Array.isArray(result.blocked_labels));
	assert.ok(
		result.blocked_labels!.some((l) => l.startsWith("http-error:")),
		`Expected http-error label, got: ${JSON.stringify(result.blocked_labels)}`,
	);
	assert.equal(result.authority.remoteWriteAuthorityEnabledInRecord, false);
	assert.equal(result.authority.dispatchAuthorityEnabled, false);
});

// ── Test 8: fetch throws → blocked with fetch-error label ────────────────────

test("ingestToExternalManagedDbV1 returns blocked with fetch-error label when fetch throws", async () => {
	const throwingFetch = async (_url: string, _init: unknown): Promise<Response> => {
		throw new Error("Network timeout");
	};

	const result = await ingestToExternalManagedDbV1(
		makeInput({
			config: {
				endpointUrl: "https://db.example.com/ingest",
				allowActualRemoteWrite: true,
				fetchImpl: throwingFetch as unknown as typeof globalThis.fetch,
			},
		}),
	);

	assert.equal(result.status, "blocked");
	assert.ok(Array.isArray(result.blocked_labels));
	assert.ok(
		result.blocked_labels!.some((l) => l.startsWith("fetch-error:")),
		`Expected fetch-error label, got: ${JSON.stringify(result.blocked_labels)}`,
	);
});

// ── Test 9: source_precedence is always "local_first" ────────────────────────

test("ingestToExternalManagedDbV1 always sets source_precedence to local_first", async () => {
	// dry_run
	const dryRun = await ingestToExternalManagedDbV1(makeInput());
	assert.equal(dryRun.source_precedence, "local_first");

	// blocked (http error)
	const { fetchImpl: errorFetch } = makeMockFetch(400);
	const blocked = await ingestToExternalManagedDbV1(
		makeInput({
			idempotencyKey: "idem-key-004",
			config: {
				endpointUrl: "https://db.example.com/ingest",
				allowActualRemoteWrite: true,
				fetchImpl: errorFetch,
			},
		}),
	);
	assert.equal(blocked.source_precedence, "local_first");

	// ingested
	const { fetchImpl: okFetch } = makeMockFetch(201);
	const ingested = await ingestToExternalManagedDbV1(
		makeInput({
			idempotencyKey: "idem-key-005",
			config: {
				endpointUrl: "https://db.example.com/ingest",
				allowActualRemoteWrite: true,
				fetchImpl: okFetch,
			},
		}),
	);
	assert.equal(ingested.source_precedence, "local_first");
});

// ── Test 10: raw weighted_mean_score is NOT in the transmitted payload ─────────

test("ingestToExternalManagedDbV1 does not expose raw weighted_mean_score in the payload", async () => {
	const calls: Array<{ url: string; body: Record<string, unknown> }> = [];
	const spyFetch = async (url: string, init: { body?: string }): Promise<Response> => {
		calls.push({ url, body: init?.body ? (JSON.parse(init.body) as Record<string, unknown>) : {} });
		return {
			ok: true,
			status: 200,
			json: async () => ({ ingested: true }),
		} as Response;
	};

	const rollup = makeRollupSummary({ weighted_mean_score: 0.99, confidence_bucket: "very_high" });

	await ingestToExternalManagedDbV1(
		makeInput({
			idempotencyKey: "idem-key-006",
			rollupSummary: rollup,
			config: {
				endpointUrl: "https://db.example.com/ingest",
				allowActualRemoteWrite: true,
				fetchImpl: spyFetch as unknown as typeof globalThis.fetch,
			},
		}),
	);

	assert.equal(calls.length, 1, "fetch should have been called once");
	const body = calls[0]!.body;

	// Raw score must NOT be present
	assert.ok(
		!("weighted_mean_score" in body),
		`weighted_mean_score should not appear in payload, body keys: ${Object.keys(body).join(", ")}`,
	);

	// Confidence bucket (advisory label) MUST be present
	assert.equal(body["confidence_bucket"], "very_high");

	// advisory_only and dispatch_authority_enabled must be false in payload
	assert.equal(body["advisory_only"], true);
	assert.equal(body["dispatch_authority_enabled"], false);
});

// ── Test 11: migration manifest without invalidation → cutover_required absent ─

test("ingestToExternalManagedDbV1 does not set cutover_required when manifest has no invalidation", async () => {
	const manifest = makeMigrationManifest({ trusted_chain_head_invalidated: false });

	const result = await ingestToExternalManagedDbV1(
		makeInput({ migrationManifest: manifest }),
	);

	assert.equal(result.status, "dry_run");
	// cutover_required should be absent (undefined) when not invalidated
	assert.equal(result.cutover_required, undefined);
});

// ── Test 12: idempotent_skip does not reset on different key ──────────────────

test("ingestToExternalManagedDbV1 idempotency is key-scoped and allows different keys", async () => {
	const { fetchImpl } = makeMockFetch(200);

	const firstResult = await ingestToExternalManagedDbV1(
		makeInput({
			idempotencyKey: "key-alpha",
			config: {
				endpointUrl: "https://db.example.com/ingest",
				allowActualRemoteWrite: true,
				fetchImpl,
			},
		}),
	);
	assert.equal(firstResult.status, "ingested");

	// Different key should NOT be skipped
	const secondResult = await ingestToExternalManagedDbV1(
		makeInput({
			idempotencyKey: "key-beta",
			config: {
				endpointUrl: "https://db.example.com/ingest",
				allowActualRemoteWrite: true,
				fetchImpl,
			},
		}),
	);
	assert.equal(secondResult.status, "ingested", "Different idempotency key should ingest independently");
});
