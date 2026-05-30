#!/usr/bin/env node

import { readFileSync, mkdirSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const snapshotPath = resolve(repoRoot, "docs/model-availability/opencode-model-availability.json");
const mdOutput = resolve(repoRoot, "docs/model-availability/working-models.md");
const jsonOutput = resolve(repoRoot, "docs/model-availability/working-models.json");
const dbRootOutput = resolve(process.env.FLOWDESK_DURABLE_STATE_ROOT ?? `${process.env.HOME ?? ""}/.flowdesk`, "model-availability/working-models.json");

const snapshot = JSON.parse(readFileSync(snapshotPath, "utf8"));
const available = Array.isArray(snapshot.available_model_ids) ? snapshot.available_model_ids : [];
const results = Array.isArray(snapshot.results) ? snapshot.results : [];

const availableDetails = available
  .map((modelId) => results.find((entry) => entry.model_id === modelId))
  .filter(Boolean)
  .map((entry) => ({
    model_id: entry.model_id,
    provider_family: entry.provider_family,
    duration_ms: entry.duration_ms,
    final_text: entry.final_text,
    observed_at: snapshot.observed_at,
  }));

const payload = {
  schema_version: "flowdesk.working_model_snapshot.v1",
  observed_at: snapshot.observed_at,
  source_snapshot: "docs/model-availability/opencode-model-availability.json",
  available_model_ids: available,
  available_model_details: availableDetails,
};

mkdirSync(dirname(mdOutput), { recursive: true });
writeFileSync(jsonOutput, `${JSON.stringify(payload, null, 2)}\n`, "utf8");
mkdirSync(dirname(dbRootOutput), { recursive: true });
writeFileSync(dbRootOutput, `${JSON.stringify(payload, null, 2)}\n`, "utf8");

const lines = [];
lines.push(`# Working OpenCode models`);
lines.push("");
lines.push(`Observed at: ${payload.observed_at}`);
lines.push(`Source snapshot: ${payload.source_snapshot}`);
lines.push(`Available models: ${available.length}`);
lines.push("");
for (const modelId of available) lines.push(`- \`${modelId}\``);
lines.push("");
writeFileSync(mdOutput, `${lines.join("\n")}\n`, "utf8");

process.stdout.write(
  [
    `wrote ${available.length} working models`,
    `json=${jsonOutput}`,
    `markdown=${mdOutput}`,
  ].join("\n") + "\n",
);
