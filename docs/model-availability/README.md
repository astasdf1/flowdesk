# OpenCode model availability snapshots

Run `npm run models:refresh` to refresh the latest OpenCode model availability snapshot and regenerate the SQLite DB.

`models:refresh` runs two scripts in sequence:

1. `scripts/refresh-opencode-model-availability.mjs` — probes each model via `opencode run` and writes results to `opencode-model-availability.json`
2. `scripts/export-model-availability-db.mjs` — converts the snapshot into `model-availability.db` (SQLite) using **merge semantics**: only models actually probed this run are updated; models skipped due to missing subscription are preserved from the existing DB

Output locations:

| File | Purpose |
|---|---|
| `docs/model-availability/opencode-model-availability.json` | Full probe results — source of truth |
| `docs/model-availability/opencode-model-availability.md` | Human-readable summary |
| `packages/opencode-plugin/data/model-availability.db` | Bundled with npm publish (fallback) |
| `<FLOWDESK_DURABLE_STATE_ROOT>/model-availability/model-availability.db` | Runtime gate (defaults to `~/.flowdesk/...`) |

The DB schema:

```sql
-- Snapshot metadata (single row)
snapshot (id, schema_version, observed_at, source_command, probe_command, timeout_ms)

-- All probed model results
models (model_id PK, provider_family, status, available, reason,
        duration_ms, exit_code, output_excerpt, started_at, finished_at, last_probed_at)

-- Set membership (catalog / selected / excluded / available)
model_sets (set_name, model_id)
```

`managed-dispatch-adapter.ts` and `workflow-assign-tool.ts` both query `model-availability.db` directly:

```sql
SELECT model_id FROM models WHERE available = 1
```

They prefer the durable state root copy; fall back to the package-bundled copy when the durable path does not exist.

Typical periodic schedule:

```bash
0 3 * * * cd /path/to/flowdesk && npm run models:refresh
```

Use `--limit N` for a quick smoke run and `--timeout-ms N` to tune the per-model probe window.
Use `--include-family anthropic,google` or `--exclude-family openai` when a provider quota bucket is critical and the refresh should avoid probing that provider while still keeping a redacted partial snapshot.

**Merge semantics:** Because different environments have different provider subscriptions, `export-model-availability-db.mjs` only overwrites rows for models that were actually probed (`results[]` in the snapshot). Models skipped due to account/subscription restrictions retain their previous `available` status from the existing DB. The `last_probed_at` column tracks which run updated each row.
