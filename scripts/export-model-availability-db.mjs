#!/usr/bin/env node
// Converts docs/model-availability/opencode-model-availability.json into a
// SQLite database (model-availability.db) and copies it to:
//   1. packages/opencode-plugin/data/  — bundled with npm publish
//   2. $FLOWDESK_DURABLE_STATE_ROOT/model-availability/  — runtime gate (local dev)
//
// Merge semantics (--merge flag, default when a previous DB exists):
//   Only rows that were actually probed in this snapshot are updated.
//   Models skipped due to missing subscription or temporary failure retain
//   their previous availability status from the existing DB.
//   This allows contributors with different provider subscriptions to each
//   update only the models they can reach, and the cumulative DB grows
//   richer over time as it is uploaded to GitHub and pulled by others.
//
// --publish flag:
//   After DB export, upload the DB as a GitHub release asset.
//   Requires: GITHUB_TOKEN env var, FLOWDESK_PUBLISH_REPO env var (owner/repo),
//             FLOWDESK_PUBLISH_TAG env var (release tag, e.g. v0.0.1-model-availability).
//   Uses the Phase 8c productionPublish gate pattern: the upload is only
//   attempted when --publish is present AND GITHUB_TOKEN is set.
//
// --dry-run flag (used with --publish):
//   Compute and print the sha256 of the exported DB without uploading.
//
// Run after: npm run models:refresh
// Requires: Node >= 22.5 (built-in node:sqlite)

import { DatabaseSync } from "node:sqlite";
import { createHash } from "node:crypto";
import { readFileSync, mkdirSync, copyFileSync, existsSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

// ── CLI flag parsing ──────────────────────────────────────────────────────────
const args = process.argv.slice(2);
const flagPublish = args.includes("--publish");
const flagDryRun = args.includes("--dry-run");

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const snapshotPath = resolve(repoRoot, "docs/model-availability/opencode-model-availability.json");
const packageDataDir = resolve(repoRoot, "packages/opencode-plugin/data");
const packageDbOutput = resolve(packageDataDir, "model-availability.db");

const durableStateRoot = process.env.FLOWDESK_DURABLE_STATE_ROOT ?? `${process.env.HOME ?? ""}/.flowdesk`;
const durableDir = resolve(durableStateRoot, "model-availability");
const durableDbOutput = resolve(durableDir, "model-availability.db");

// ── parse snapshot ────────────────────────────────────────────────────────────
const snapshot = JSON.parse(readFileSync(snapshotPath, "utf8"));

// results[] contains only models that were actually probed this run.
// skipped_unsupported_model_ids and previous_temporary_unavailable_model_ids
// were intentionally not probed — we must not overwrite their DB rows.
const probedResults = Array.isArray(snapshot.results) ? snapshot.results : [];
const probedModelIds = new Set(probedResults.map((r) => r.model_id));

const catalogModelIds = Array.isArray(snapshot.catalog_model_ids) ? snapshot.catalog_model_ids : [];
const selectedModelIds = Array.isArray(snapshot.selected_model_ids) ? snapshot.selected_model_ids : [];
const excludedModelIds = Array.isArray(snapshot.excluded_model_ids) ? snapshot.excluded_model_ids : [];
// available_model_ids is derived only from probed results — correct to use as-is.
const availableModelIds = Array.isArray(snapshot.available_model_ids) ? snapshot.available_model_ids : [];

// ── helpers ───────────────────────────────────────────────────────────────────
function createSchema(db) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS snapshot (
      id              INTEGER PRIMARY KEY CHECK (id = 1),
      schema_version  TEXT NOT NULL,
      observed_at     TEXT NOT NULL,
      source_command  TEXT,
      probe_command   TEXT,
      timeout_ms      INTEGER
    );

    CREATE TABLE IF NOT EXISTS models (
      model_id        TEXT PRIMARY KEY,
      provider_family TEXT NOT NULL,
      status          TEXT NOT NULL,
      available       INTEGER NOT NULL DEFAULT 0,
      reason          TEXT,
      duration_ms     INTEGER,
      exit_code       INTEGER,
      output_excerpt  TEXT,
      started_at      TEXT,
      finished_at     TEXT,
      last_probed_at  TEXT
    );

    CREATE INDEX IF NOT EXISTS idx_models_available       ON models (available);
    CREATE INDEX IF NOT EXISTS idx_models_provider_family ON models (provider_family);
    CREATE INDEX IF NOT EXISTS idx_models_status          ON models (status);

    CREATE TABLE IF NOT EXISTS model_sets (
      set_name  TEXT NOT NULL,
      model_id  TEXT NOT NULL,
      PRIMARY KEY (set_name, model_id)
    );

    CREATE INDEX IF NOT EXISTS idx_model_sets_name ON model_sets (set_name);
  `);

  // Migrate: add last_probed_at if it doesn't exist yet (schema v2).
  const cols = db.prepare("PRAGMA table_info(models)").all().map((r) => r.name);
  if (!cols.includes("last_probed_at")) {
    db.exec("ALTER TABLE models ADD COLUMN last_probed_at TEXT");
  }
}

function upsertSnapshot(db) {
  db.prepare(`
    INSERT OR REPLACE INTO snapshot (id, schema_version, observed_at, source_command, probe_command, timeout_ms)
    VALUES (1, ?, ?, ?, ?, ?)
  `).run(
    snapshot.schema_version ?? "flowdesk.opencode_model_availability_snapshot.v1",
    snapshot.observed_at ?? new Date().toISOString(),
    snapshot.source_command ?? null,
    snapshot.probe_command ?? null,
    snapshot.timeout_ms ?? null,
  );
}

// ── open or create the package DB ─────────────────────────────────────────────
mkdirSync(packageDataDir, { recursive: true });
const db = new DatabaseSync(packageDbOutput);
createSchema(db);

// ── merge: update only probed rows, leave unprobed rows untouched ─────────────
//
// INSERT OR REPLACE would delete + reinsert, losing any columns not in the
// new snapshot. Use INSERT ... ON CONFLICT DO UPDATE instead so we touch
// only the columns we have fresh data for.
const upsertModel = db.prepare(`
  INSERT INTO models
    (model_id, provider_family, status, available, reason, duration_ms,
     exit_code, output_excerpt, started_at, finished_at, last_probed_at)
  VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  ON CONFLICT(model_id) DO UPDATE SET
    provider_family = excluded.provider_family,
    status          = excluded.status,
    available       = excluded.available,
    reason          = excluded.reason,
    duration_ms     = excluded.duration_ms,
    exit_code       = excluded.exit_code,
    output_excerpt  = excluded.output_excerpt,
    started_at      = excluded.started_at,
    finished_at     = excluded.finished_at,
    last_probed_at  = excluded.last_probed_at
`);

let updatedCount = 0;
let skippedCount = 0;

for (const entry of probedResults) {
  upsertModel.run(
    entry.model_id,
    entry.provider_family ?? entry.model_id.split("/")[0] ?? "unknown",
    entry.status ?? "unknown",
    entry.available ? 1 : 0,
    entry.reason ?? null,
    entry.duration_ms ?? null,
    entry.exit_code ?? null,
    entry.output_excerpt ?? null,
    entry.started_at ?? null,
    entry.finished_at ?? null,
    snapshot.observed_at ?? new Date().toISOString(),
  );
  updatedCount++;
}

// Count how many catalog models were NOT probed (skipped/unsubscribed).
for (const id of catalogModelIds) {
  if (!probedModelIds.has(id)) skippedCount++;
}

// Snapshot metadata.
upsertSnapshot(db);

// model_sets: rebuild only the sets derived from this run.
// We do NOT wipe the whole table — instead we upsert per set so that
// catalog/selected/excluded sets reflect the current opencode catalog,
// while the available set is rebuilt from this run's probe results only.
const insertSet = db.prepare(`INSERT OR IGNORE INTO model_sets (set_name, model_id) VALUES (?, ?)`);
for (const id of catalogModelIds)  insertSet.run("catalog",  id);
for (const id of selectedModelIds) insertSet.run("selected", id);
for (const id of excludedModelIds) insertSet.run("excluded", id);

// Rebuild the available set: remove stale available entries for models
// that were probed this run (they may have flipped unavailable), keep
// everything else.
db.prepare(`
  DELETE FROM model_sets
  WHERE set_name = 'available'
    AND model_id IN (SELECT model_id FROM models WHERE last_probed_at = ?)
`).run(snapshot.observed_at ?? new Date().toISOString());

for (const id of availableModelIds) insertSet.run("available", id);

db.close();

// ── copy to durable state root ─────────────────────────────────────────────────
mkdirSync(durableDir, { recursive: true });
copyFileSync(packageDbOutput, durableDbOutput);

// ── summary ───────────────────────────────────────────────────────────────────
const totalInDb = (() => {
  const db2 = new DatabaseSync(packageDbOutput, { open: true });
  const row = db2.prepare("SELECT COUNT(*) as n FROM models").get();
  db2.close();
  return row.n;
})();

process.stdout.write(
  [
    `merged model-availability.db:`,
    `  probed & updated : ${updatedCount} models (${availableModelIds.length} available)`,
    `  skipped (no probe): ${skippedCount} models — existing DB rows preserved`,
    `  total in DB      : ${totalInDb} models`,
    `  package=${packageDbOutput}`,
    `  durable=${durableDbOutput}`,
  ].join("\n") + "\n",
);

// ── --publish / --dry-run ─────────────────────────────────────────────────────
if (flagPublish || flagDryRun) {
  // Compute sha256 of the exported DB.
  const dbBytes = readFileSync(packageDbOutput);
  const sha256Hex = createHash("sha256").update(dbBytes).digest("hex");

  if (flagDryRun) {
    process.stdout.write(
      [
        `[dry-run] model-availability.db sha256:`,
        `  sha256=${sha256Hex}`,
        `  source=${packageDbOutput}`,
        `  upload would target: ${process.env.FLOWDESK_PUBLISH_REPO ?? "<FLOWDESK_PUBLISH_REPO not set>"} @ tag ${process.env.FLOWDESK_PUBLISH_TAG ?? "<FLOWDESK_PUBLISH_TAG not set>"}`,
      ].join("\n") + "\n",
    );
  }

  if (flagPublish && !flagDryRun) {
    // productionPublish gate: GITHUB_TOKEN must be present.
    const githubToken =
      (typeof process.env.GITHUB_TOKEN === "string" && process.env.GITHUB_TOKEN.trim().length > 0)
        ? process.env.GITHUB_TOKEN.trim()
        : undefined;
    if (githubToken === undefined) {
      process.stderr.write(
        "[publish] BLOCKED: GITHUB_TOKEN is not set. Set GITHUB_TOKEN to enable asset upload.\n",
      );
      process.exit(1);
    }

    const publishRepo = typeof process.env.FLOWDESK_PUBLISH_REPO === "string"
      ? process.env.FLOWDESK_PUBLISH_REPO.trim()
      : "";
    const publishTag = typeof process.env.FLOWDESK_PUBLISH_TAG === "string"
      ? process.env.FLOWDESK_PUBLISH_TAG.trim()
      : "";

    if (publishRepo.length === 0 || !publishRepo.includes("/")) {
      process.stderr.write(
        "[publish] BLOCKED: FLOWDESK_PUBLISH_REPO must be set to 'owner/repo'.\n",
      );
      process.exit(1);
    }
    if (publishTag.length === 0) {
      process.stderr.write(
        "[publish] BLOCKED: FLOWDESK_PUBLISH_TAG must be set to the release tag (e.g. v0.0.1-model-availability).\n",
      );
      process.exit(1);
    }

    const [owner, repo] = publishRepo.split("/");

    // Step 1: Look up the release id for the given tag.
    const releaseUrl = `https://api.github.com/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/releases/tags/${encodeURIComponent(publishTag)}`;
    const releaseResp = await fetch(releaseUrl, {
      headers: {
        Accept: "application/vnd.github+json",
        Authorization: `Bearer ${githubToken}`,
        "User-Agent": "flowdesk-opencode-plugin",
        "X-GitHub-Api-Version": "2022-11-28",
      },
    });
    if (!releaseResp.ok) {
      process.stderr.write(
        `[publish] FAILED: Could not fetch release for tag '${publishTag}': HTTP ${releaseResp.status}\n`,
      );
      process.exit(1);
    }
    const releasePayload = await releaseResp.json();
    const uploadUrl = typeof releasePayload.upload_url === "string"
      ? releasePayload.upload_url.replace(/\{.*\}$/, "")
      : undefined;
    if (typeof uploadUrl !== "string" || uploadUrl.length === 0) {
      process.stderr.write(
        `[publish] FAILED: No upload_url found in release response for tag '${publishTag}'.\n`,
      );
      process.exit(1);
    }

    // Step 2: Upload the DB as a binary asset.
    const assetName = "model-availability.db";
    const uploadEndpoint = `${uploadUrl}?name=${encodeURIComponent(assetName)}`;
    const uploadResp = await fetch(uploadEndpoint, {
      method: "POST",
      headers: {
        Accept: "application/vnd.github+json",
        Authorization: `Bearer ${githubToken}`,
        "Content-Type": "application/octet-stream",
        "User-Agent": "flowdesk-opencode-plugin",
        "X-GitHub-Api-Version": "2022-11-28",
      },
      body: dbBytes,
    });
    if (!uploadResp.ok) {
      const errorText = await uploadResp.text().catch(() => "(non-text response)");
      process.stderr.write(
        `[publish] FAILED: Asset upload returned HTTP ${uploadResp.status}: ${errorText.slice(0, 200)}\n`,
      );
      process.exit(1);
    }
    const uploadPayload = await uploadResp.json();
    const browserDownloadUrl = typeof uploadPayload.browser_download_url === "string"
      ? uploadPayload.browser_download_url
      : undefined;

    process.stdout.write(
      [
        `[publish] model-availability.db uploaded:`,
        `  sha256=${sha256Hex}`,
        `  tag=${publishTag}`,
        `  repo=${publishRepo}`,
        ...(browserDownloadUrl !== undefined ? [`  url=${browserDownloadUrl}`] : []),
      ].join("\n") + "\n",
    );
  }
}
