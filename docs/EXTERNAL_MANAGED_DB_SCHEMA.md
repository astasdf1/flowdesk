# External Managed DB Schema — P7-S27

This document describes the GitHub Actions OIDC-based external database
ingestion connector for FlowDesk score ledger rollup snapshots.

**Authority note:** All operations in this connector are advisory-only.
No dispatch, provider, runtime, lane-launch, fallback, or hard-chat authority
is ever granted. Authority flags are always false.

---

## 1. Overview

The external managed DB connector (`external-managed-db-connector.ts`)
transmits summarised FlowDesk score ledger rollup snapshots to an
OIDC-protected external database endpoint. The connector is designed for
use in GitHub Actions workflows where the runner obtains OIDC tokens
automatically from the GitHub Actions identity provider.

Key design constraints:

- **Local-first**: the local FlowDesk score ledger is the authoritative
  data source. The external DB is a secondary, advisory-only mirror.
  `source_precedence` is always `"local_first"`.
- **No raw score exposure**: raw `weighted_mean_score` values are never
  transmitted externally. Only the advisory `confidence_bucket` label
  (`"low"`, `"medium"`, `"high"`, `"very_high"`) is included.
- **Idempotent replay**: a per-process in-memory idempotency store ensures
  that repeated calls with the same `(partition, rollup hash)` key
  return `idempotent_skip` instead of sending a duplicate write.
- **Explicit write gate**: `allowActualRemoteWrite` must be explicitly
  `true`; the default is `false` (dry-run).
- **Migration cutover signal**: when a S26 `MigrationManifestV1` is
  provided with `trusted_chain_head_invalidated: true`, the result
  carries `cutover_required: true` to signal that a fresh trusted chain
  head must be established before further ingestion.

---

## 2. GitHub Actions OIDC Integration

### 2.1 Workflow permissions

Add the minimum required OIDC permissions to the GitHub Actions workflow:

```yaml
permissions:
  contents: read
  id-token: write   # required for OIDC token acquisition
```

### 2.2 Token acquisition

The GitHub Actions runner provides OIDC tokens via the environment
variables `ACTIONS_ID_TOKEN_REQUEST_TOKEN` and
`ACTIONS_ID_TOKEN_REQUEST_URL`. Callers of `ingestToExternalManagedDbV1`
are responsible for exchanging these into a bearer token and passing a
fetch implementation that injects the `Authorization: Bearer <token>`
header.

The connector itself does **not** handle token acquisition. This is
intentional: the token lifecycle belongs to the Actions runner, not
the FlowDesk plugin.

Example wrapper:

```typescript
import { ingestToExternalManagedDbV1 } from "./external-managed-db-connector.js";

async function fetchWithOIDC(url: string, init: RequestInit): Promise<Response> {
  const token = await getOIDCToken(); // caller-supplied
  return fetch(url, {
    ...init,
    headers: {
      ...((init.headers as Record<string, string>) ?? {}),
      Authorization: `Bearer ${token}`,
    },
  });
}

const result = await ingestToExternalManagedDbV1({
  rollupSummary,
  partitionId,
  schemaHash,
  idempotencyKey,
  config: {
    endpointUrl: "https://managed-db.example.com/ingest",
    workloadIdentityProvider: "projects/123/locations/global/workloadIdentityPools/...",
    serviceAccount: "flowdesk-ingest@my-project.iam.gserviceaccount.com",
    allowActualRemoteWrite: true,
    fetchImpl: fetchWithOIDC,
  },
});
```

---

## 3. Ingestion Watermark

The `ingestion_watermark` field in `ExternalDbIngestionResultV1` is an
ISO-8601 timestamp recorded at the moment of successful ingestion (HTTP
2xx response). It is set by the connector and reflects the wall-clock
time of the ingestion, not the `last_observation_at` of the rollup data.

Use cases:
- Staleness detection: compare `ingestion_watermark` to `last_observation_at`
  to detect large gaps between data collection and ingestion.
- Audit trail: include `ingestion_watermark` in compaction evidence
  to show when the remote mirror was last refreshed.

---

## 4. Cutover Procedure

When a S26 migration produces a `MigrationManifestV1` with
`trusted_chain_head_invalidated: true`, the connector returns
`cutover_required: true`. The recommended procedure is:

1. **Stop ingestion**: do not attempt further `ingestToExternalManagedDbV1`
   calls until the cutover is complete.
2. **Establish a new trusted chain head**: run the S26 migration runner
   with the updated schema and obtain a fresh `FlowDeskTrustedChainHeadV1`.
3. **Re-anchor the partition**: seal and re-anchor the affected partitions
   under the new chain head.
4. **Resume ingestion**: once the new chain head is anchored, resume
   normal ingestion with a fresh `idempotencyKey` (the old key space
   is no longer valid after a cutover).

The external DB endpoint should be designed to accept a
`trusted_chain_head_ref` in the ingestion payload and reject writes
that reference an invalidated chain head.

---

## 5. Idempotent Replay Guarantee

The connector maintains an in-process `Set<string>` of seen idempotency
keys. On the second call with the same key, `idempotent_skip` is returned
without making a network request.

**Scope**: in-process only. For cross-process or cross-run idempotency,
the external DB endpoint must implement its own deduplication using
the `idempotency_key` field in the ingestion payload
(`flowdesk.external_db_ingestion.v1`).

**Key construction**: callers should derive the key as a stable function
of `(partition_id, rollup_hash)` so that the same rollup snapshot always
produces the same key:

```typescript
const idempotencyKey = `ingest-${partitionId}-${rollupSummary.rollup_hash.slice(0, 16)}`;
```

---

## 6. Migration Manifest Connection

The S26 `MigrationManifestV1` links the migration runner output to the
connector. Its schema version is `"flowdesk.migration_manifest.v1"`.

Fields consumed by the connector:

| Field                             | Effect in connector                                      |
|-----------------------------------|----------------------------------------------------------|
| `trusted_chain_head_invalidated`  | `true` → `cutover_required: true` in ingestion result   |
| `affected_partition_ids`          | informational only; not used in gate logic               |
| `migration_status`                | informational only; not used in gate logic               |

The connector does not validate the manifest against a schema; it reads
`trusted_chain_head_invalidated` as a simple boolean field and treats
any truthy value as requiring cutover.

---

## 7. Ingestion Payload Schema

The connector transmits the following JSON payload to the endpoint:

```json
{
  "schema_version": "flowdesk.external_db_ingestion.v1",
  "partition_id": "<string>",
  "schema_hash": "<sha256-hex>",
  "idempotency_key": "<opaque string>",
  "confidence_bucket": "low|medium|high|very_high",
  "source_partition_ids": ["<string>"],
  "sample_count": 50,
  "effective_sample_count": 45,
  "last_observation_at": "<ISO-8601>",
  "rollup_hash": "<sha256-hex>",
  "source_precedence": "local_first",
  "advisory_only": true,
  "dispatch_authority_enabled": false
}
```

Fields deliberately excluded:

- `weighted_mean_score` — raw score; never transmitted externally
- `p25`, `p50`, `p75`, `p90` — raw percentile values; not transmitted
- `decay_adjusted_mean` — raw value; not transmitted
- `scorer_concentration` — raw value; not transmitted
- `negative_signal_count` — raw value; not transmitted

---

## 8. Safety Properties

- `allowActualRemoteWrite` defaults to `false`. No network calls are made
  unless the caller explicitly opts in.
- Raw rollup scores are never included in the transmitted payload.
- `source_precedence: "local_first"` is immutable and cannot be overridden.
- Authority flags (`advisoryOnlyRecord: true`, `remoteWriteAuthorityEnabledInRecord: false`,
  `dispatchAuthorityEnabled: false`) are always false in every result path.
- The idempotency store is reset between test runs via
  `_resetIdempotencyStoreForTest()` (test-only export).
