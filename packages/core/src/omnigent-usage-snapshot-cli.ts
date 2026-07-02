#!/usr/bin/env node
import { mkdirSync, renameSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";
import {
	collectManagedDispatchBetaUsageEvidenceV1,
	type FlowDeskProviderUsageAcquisitionConfigV1,
	type FlowDeskProviderUsageCollectorResultV1,
	type FlowDeskProviderUsageCollectorTargetV1,
} from "./provider-usage-collector.js";
import {
	buildFlowDeskOmnigentUsageBridgeSnapshotV1,
	type FlowDeskOmnigentUsageBridgeFamilyV1,
	type FlowDeskOmnigentUsageBridgeInputV1,
} from "./omnigent-usage-snapshot.js";

// flowdesk-omnigent-usage-snapshot: run the OpenCode-track live usage
// collectors (Claude OAuth usage, Codex live usage, Gemini Code Assist quota)
// and emit the strict allowlist snapshot the Omnigent selector accepts via
// FLOWDESK_OMNIGENT_PROVIDER_USAGE_PATH / _JSON. Advisory input only — this
// reads locally-stored provider auth the same way the OpenCode live tool
// does, performs no dispatch, and never prints credentials (output is the
// bounded snapshot only).
//
// Usage:
//   flowdesk-omnigent-usage-snapshot [--providers claude,openai,gemini]
//                                    [--out <path>] [--home <dir>] [--pretty]
// Without --out the snapshot is written to stdout.

const ALL_FAMILIES: readonly FlowDeskOmnigentUsageBridgeFamilyV1[] = ["claude", "openai", "gemini"];

interface CliArgs {
	families: readonly FlowDeskOmnigentUsageBridgeFamilyV1[];
	outPath?: string;
	homeDir?: string;
	pretty: boolean;
}

function parseArgs(argv: readonly string[]): CliArgs | { error: string } {
	let families: readonly FlowDeskOmnigentUsageBridgeFamilyV1[] = ALL_FAMILIES;
	let outPath: string | undefined;
	let homeDir: string | undefined;
	let pretty = false;
	for (let index = 0; index < argv.length; index += 1) {
		const arg = argv[index];
		if (arg === "--pretty") {
			pretty = true;
		} else if (arg === "--providers" || arg === "--out" || arg === "--home") {
			const value = argv[index + 1];
			if (value === undefined || value.startsWith("--")) return { error: `${arg} requires a value` };
			index += 1;
			if (arg === "--out") outPath = value;
			else if (arg === "--home") homeDir = value;
			else {
				const parsed = value.split(",").map((item) => item.trim()).filter((item) => item.length > 0);
				if (parsed.length === 0 || parsed.some((item) => !(ALL_FAMILIES as readonly string[]).includes(item))) {
					return { error: `--providers must be a comma list of: ${ALL_FAMILIES.join(",")}` };
				}
				families = parsed as FlowDeskOmnigentUsageBridgeFamilyV1[];
			}
		} else {
			return { error: `unknown argument: ${arg}` };
		}
	}
	return { families, outPath, homeDir, pretty };
}

function targetFor(family: FlowDeskOmnigentUsageBridgeFamilyV1, observedAt: string): FlowDeskProviderUsageCollectorTargetV1 {
	const modelFamily = family === "openai" ? "gpt-5.5" : family === "gemini" ? "gemini-pro" : "sonnet-4";
	const safeStamp = observedAt.replace(/[^0-9A-Za-z]/g, "");
	return {
		providerFamily: family,
		providerQualifiedModelId: `${family}/${modelFamily}`,
		modelFamily,
		usageSnapshotId: `omnigent-usage-bridge-${family}-${safeStamp}`,
		authorityRef: `omnigent-usage-bridge-authority-${family}-${safeStamp}`,
		sourceRef: `omnigent-usage-bridge-source-${family}-${safeStamp}`,
		conformanceRef: `omnigent-usage-bridge-conformance-${family}-${safeStamp}`,
		redactedEvidenceRefs: [`omnigent-usage-bridge-evidence-${family}-${safeStamp}`],
		observedAt,
		freshnessTtlMinutes: 5,
	};
}

async function collectFamily(
	family: FlowDeskOmnigentUsageBridgeFamilyV1,
	observedAt: string,
	homeDir: string | undefined,
): Promise<FlowDeskOmnigentUsageBridgeInputV1> {
	const acquisition: FlowDeskProviderUsageAcquisitionConfigV1 = {
		enabled: true,
		providers: [family],
		claudeOAuthUsage: true,
		codexLiveUsage: true,
		geminiQuota: true,
		...(homeDir !== undefined ? { homeDir } : {}),
	};
	let result: FlowDeskProviderUsageCollectorResultV1 | undefined;
	try {
		result = await collectManagedDispatchBetaUsageEvidenceV1(targetFor(family, observedAt), acquisition, {
			fetch: async (url, init) => {
				const response = await fetch(url, { method: init.method, headers: init.headers, ...(init.body !== undefined ? { body: init.body } : {}) });
				return { ok: response.ok, status: response.status, json: () => response.json(), text: () => response.text() };
			},
		});
	} catch {
		result = undefined; // per-family failure degrades to alert_level "unknown"
	}
	return { family, result };
}

export async function runFlowDeskOmnigentUsageSnapshotCliV1(argv: readonly string[]): Promise<number> {
	const parsed = parseArgs(argv);
	if ("error" in parsed) {
		process.stderr.write(`flowdesk-omnigent-usage-snapshot: ${parsed.error}\n`);
		return 2;
	}
	const capturedAt = new Date().toISOString();
	const inputs = await Promise.all(parsed.families.map((family) => collectFamily(family, capturedAt, parsed.homeDir)));
	const snapshot = buildFlowDeskOmnigentUsageBridgeSnapshotV1(inputs, { capturedAt });
	const payload = `${JSON.stringify(snapshot, undefined, parsed.pretty ? 2 : undefined)}\n`;
	if (parsed.outPath === undefined) {
		process.stdout.write(payload);
		return 0;
	}
	// Atomic write so a selector reading FLOWDESK_OMNIGENT_PROVIDER_USAGE_PATH
	// mid-refresh never observes a truncated snapshot.
	mkdirSync(dirname(parsed.outPath), { recursive: true });
	const tmpPath = `${parsed.outPath}.${process.pid}.tmp`;
	writeFileSync(tmpPath, payload, "utf8");
	renameSync(tmpPath, parsed.outPath);
	process.stderr.write(`flowdesk-omnigent-usage-snapshot: wrote ${parsed.outPath}\n`);
	return 0;
}

const invokedDirectly = process.argv[1] !== undefined && import.meta.url === new URL(`file://${process.argv[1]}`).href;
if (invokedDirectly) {
	runFlowDeskOmnigentUsageSnapshotCliV1(process.argv.slice(2)).then(
		(code) => {
			process.exitCode = code;
		},
		(error: unknown) => {
			process.stderr.write(`flowdesk-omnigent-usage-snapshot: ${String(error)}\n`);
			process.exitCode = 1;
		},
	);
}
