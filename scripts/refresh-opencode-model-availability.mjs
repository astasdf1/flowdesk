#!/usr/bin/env node

import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");

const args = process.argv.slice(2);

function readValue(name, fallback) {
  const index = args.indexOf(name);
  if (index < 0 || index + 1 >= args.length) return fallback;
  return args[index + 1];
}

function readInteger(name, fallback) {
  const parsed = Number.parseInt(readValue(name, `${fallback}`), 10);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function parseModelIds(text) {
  return [...new Set(text.split(/\r?\n/).map((line) => line.trim()).filter((line) => /^[A-Za-z0-9._-]+\/[A-Za-z0-9._-]+$/.test(line)))].sort((a, b) => a.localeCompare(b));
}

function shouldExcludeModelId(modelId) {
  return /-image(?:-|$)/i.test(modelId);
}

function shouldSkipAsUnsupported(modelId, previousSnapshot) {
  const previousEntry = previousSnapshot?.results?.find((entry) => entry?.model_id === modelId);
  if (!previousEntry) return false;
  const reason = `${previousEntry.reason ?? ""} ${previousEntry.output_excerpt ?? ""}`.toLowerCase();
  return (
    reason.includes("api 404") ||
    reason.includes("requested entity was not found") ||
    reason.includes("provider not found") ||
    reason.includes("model not found") ||
    reason.includes("not supported")
  );
}

function classifyPreviousUnavailability(modelId, previousSnapshot) {
  const previousEntry = previousSnapshot?.results?.find((entry) => entry?.model_id === modelId);
  if (!previousEntry) return "unknown";
  const reason = `${previousEntry.reason ?? ""} ${previousEntry.output_excerpt ?? ""}`.toLowerCase();
  if (
    reason.includes("api 404") ||
    reason.includes("requested entity was not found") ||
    reason.includes("provider not found") ||
    reason.includes("model not found") ||
    reason.includes("not supported")
  ) {
    return "unsupported";
  }
  if (reason.includes("fast mode is not enabled") || reason.includes("credentials are expired") || reason.includes("bad request")) {
    return "temporary_or_account_specific";
  }
  return "temporary_or_account_specific";
}

function redact(text, limit = 240) {
  const normalized = text.replace(/\r/g, "").trim();
  if (!normalized) return "";
  return normalized.length > limit ? `${normalized.slice(0, limit - 1)}…` : normalized;
}

function parseJsonLines(text) {
  const events = [];
  const nonJsonLines = [];
  for (const rawLine of text.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line) continue;
    try {
      events.push(JSON.parse(line));
    } catch {
      nonJsonLines.push(line);
    }
  }
  return { events, nonJsonLines };
}

function familyBlockMapFromCatalog(catalogText) {
  const blocks = new Map();
  if (/Claude credentials are expired/i.test(catalogText) || /opencode-claude-auth/i.test(catalogText)) {
    blocks.set("anthropic", {
      reason: "provider_credentials_unavailable",
      output_excerpt: redact(
        catalogText
          .split(/\r?\n/)
          .find((line) => /Claude credentials are expired/i.test(line) || /opencode-claude-auth/i.test(line)) ??
          "Claude credentials are expired",
      ),
    });
  }
  return blocks;
}

function probeModel(modelId, prompt, timeoutMs) {
  const startedAt = new Date();
  const result = spawnSync(
    "opencode",
    ["run", "--model", modelId, "--format", "json", "--title", `FlowDesk model probe ${modelId}`, prompt],
    {
      cwd: repoRoot,
      encoding: "utf8",
      maxBuffer: 20 * 1024 * 1024,
      timeout: timeoutMs,
      env: process.env,
    },
  );
  const finishedAt = new Date();
  const stdout = result.stdout ?? "";
  const stderr = result.stderr ?? "";
  const { events, nonJsonLines } = parseJsonLines(`${stdout}\n${stderr}`);
  const textEvents = events.filter((event) => event?.type === "text" && event?.part?.type === "text" && typeof event.part.text === "string");
  const finalText = textEvents.length > 0 ? textEvents[textEvents.length - 1].part.text : "";
  const finishEvent = [...events].reverse().find((event) => event?.type === "step_finish");
  const finishedCleanly = result.status === 0 && finishEvent?.part?.reason === "stop" && textEvents.length > 0;
  const timedOut = result.error?.code === "ETIMEDOUT" || result.signal === "SIGTERM";

  let status = "unavailable";
  let reason = finishedCleanly ? "final_answer_received" : "run_failed";
  if (finishedCleanly) {
    status = "available";
  } else if (timedOut) {
    status = "timeout";
    reason = "probe_timed_out";
  } else if (/provider not found/i.test(stderr) || /model not found/i.test(stderr) || /credentials are expired/i.test(stdout) || /credentials are expired/i.test(stderr)) {
    reason = "provider_or_credentials_unavailable";
  } else if (finishEvent?.part?.reason) {
    reason = `step_finish:${finishEvent.part.reason}`;
  }

  return {
    model_id: modelId,
    provider_family: modelId.split("/")[0] ?? "unknown",
    status,
    reason,
    available: status === "available",
    exit_code: typeof result.status === "number" ? result.status : null,
    signal: result.signal ?? null,
    duration_ms: finishedAt.getTime() - startedAt.getTime(),
    final_text: finalText,
    output_excerpt: redact(nonJsonLines.filter((line) => !/^\{/.test(line)).join(" | ") || stderr || stdout),
    started_at: startedAt.toISOString(),
    finished_at: finishedAt.toISOString(),
  };
}

function buildMarkdown(snapshot) {
  const available = snapshot.results.filter((entry) => entry.available);
  const unavailable = snapshot.results.filter((entry) => !entry.available);
  const excluded = snapshot.excluded_model_ids ?? [];
  const lines = [];
  lines.push(`# OpenCode model availability snapshot`);
  lines.push("");
  lines.push(`Observed at: ${snapshot.observed_at}`);
  lines.push(`Source: ${snapshot.source_command}`);
  lines.push(`Probe: ${snapshot.probe_command}`);
  lines.push(`Timeout: ${snapshot.timeout_ms}ms`);
  lines.push(`Catalog count: ${snapshot.catalog_model_ids.length}`);
  lines.push(`Available: ${available.length}`);
  lines.push(`Unavailable: ${unavailable.length}`);
  lines.push("");
  lines.push(`## Available models (${available.length})`);
  for (const entry of available) lines.push(`- \`${entry.model_id}\` (${entry.duration_ms}ms)`);
  lines.push("");
  lines.push(`## Unavailable models (${unavailable.length})`);
  for (const entry of unavailable) lines.push(`- \`${entry.model_id}\` — ${entry.output_excerpt || entry.reason}`);
  lines.push("");
  lines.push(`## Excluded models (${excluded.length})`);
  for (const modelId of excluded) lines.push(`- \`${modelId}\` — excluded by script filter`);
  lines.push("");
  lines.push(`## Canonical available provider models`);
  const providerModels = available.filter((entry) => entry.provider_family !== "opencode");
  if (providerModels.length === 0) {
    lines.push(`- none`);
  } else {
    for (const entry of providerModels) lines.push(`- \`${entry.model_id}\``);
  }
  lines.push("");
  return lines.join("\n");
}

function main() {
  const timeoutMs = readInteger("--timeout-ms", 15000);
  const limit = readInteger("--limit", 0);
  const prompt = readValue("--prompt", "Reply with exactly OK.");
  const jsonOutput = resolve(repoRoot, readValue("--output", "docs/model-availability/opencode-model-availability.json"));
  const markdownOutput = resolve(repoRoot, readValue("--markdown-output", "docs/model-availability/opencode-model-availability.md"));
  const previousSnapshot = existsSync(jsonOutput)
    ? JSON.parse(readFileSync(jsonOutput, "utf8"))
    : undefined;

  const catalog = spawnSync("opencode", ["models"], {
    cwd: repoRoot,
    encoding: "utf8",
    maxBuffer: 8 * 1024 * 1024,
    env: process.env,
  });

  if (catalog.error) throw new Error(`Failed to read opencode models: ${catalog.error.message}`);

  const catalogText = `${catalog.stdout ?? ""}\n${catalog.stderr ?? ""}`;
  const modelIds = parseModelIds(catalogText);
  const familyBlocks = familyBlockMapFromCatalog(catalogText);
  const excludedModelIds = modelIds.filter((modelId) => shouldExcludeModelId(modelId));
  const skippedUnsupportedModelIds = modelIds.filter((modelId) => shouldSkipAsUnsupported(modelId, previousSnapshot));
  const previousTemporaryUnavailableModelIds = modelIds.filter(
    (modelId) => !skippedUnsupportedModelIds.includes(modelId) && classifyPreviousUnavailability(modelId, previousSnapshot) === "temporary_or_account_specific",
  );
  const selectedModelIds = (limit > 0 ? modelIds.slice(0, limit) : modelIds).filter(
    (modelId) => !shouldExcludeModelId(modelId) && !shouldSkipAsUnsupported(modelId, previousSnapshot),
  );
  const results = [];

  for (const modelId of selectedModelIds) {
    const family = modelId.split("/")[0] ?? "unknown";
    const familyBlock = familyBlocks.get(family);
    process.stderr.write(`probing ${modelId}\n`);
    if (familyBlock) {
      results.push({
        model_id: modelId,
        provider_family: family,
        status: "blocked",
        reason: familyBlock.reason,
        available: false,
        exit_code: null,
        signal: null,
        duration_ms: 0,
        final_text: "",
        output_excerpt: familyBlock.output_excerpt,
        started_at: new Date().toISOString(),
        finished_at: new Date().toISOString(),
      });
      process.stderr.write(`blocked ${modelId}: ${familyBlock.reason}\n`);
      continue;
    }
    const result = probeModel(modelId, prompt, timeoutMs);
    results.push(result);
    process.stderr.write(`${result.available ? "ok" : "fail"} ${modelId}: ${result.reason}\n`);
  }

  const snapshot = {
    schema_version: "flowdesk.opencode_model_availability_snapshot.v1",
    observed_at: new Date().toISOString(),
    source_command: "opencode models",
    probe_command: "opencode run --format json --model <model> 'Reply with exactly OK.'",
    timeout_ms: timeoutMs,
    catalog_model_ids: modelIds,
    selected_model_ids: selectedModelIds,
    excluded_model_ids: excludedModelIds,
    results,
    available_model_ids: results.filter((entry) => entry.available).map((entry) => entry.model_id),
    unavailable_model_ids: results.filter((entry) => !entry.available).map((entry) => entry.model_id),
    skipped_unsupported_model_ids: skippedUnsupportedModelIds,
    previous_temporary_unavailable_model_ids: previousTemporaryUnavailableModelIds,
  };

  mkdirSync(dirname(jsonOutput), { recursive: true });
  writeFileSync(jsonOutput, `${JSON.stringify(snapshot, null, 2)}\n`, "utf8");
  writeFileSync(markdownOutput, `${buildMarkdown(snapshot)}\n`, "utf8");

  process.stdout.write(
    [
      `updated ${snapshot.available_model_ids.length}/${snapshot.selected_model_ids.length} available models`,
      `json=${jsonOutput}`,
      `markdown=${markdownOutput}`,
    ].join("\n") + "\n",
  );
}

main();
