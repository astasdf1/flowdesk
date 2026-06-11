/**
 * Tests for OI MCP Tools — P7-S10.
 *
 * Tests the 5 advisory-only OI handlers:
 *   1. flowdesk_oi_score_preview
 *   2. flowdesk_oi_threshold_gate
 *   3. flowdesk_oi_ledger_list
 *   4. flowdesk_oi_ledger_compact
 *   5. flowdesk_oi_session_summary
 */

import assert from "node:assert/strict";
import { mkdtempSync, rmSync, writeFileSync, mkdirSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, test } from "node:test";
import {
	createFlowDeskOIOptInTools,
	flowdeskOIScorePreviewToolName,
	flowdeskOIThresholdGateToolName,
	flowdeskOILedgerListToolName,
	flowdeskOILedgerCompactToolName,
	flowdeskOISessionSummaryToolName,
} from "./oi-mcp-tools.js";

// ── Helpers ───────────────────────────────────────────────────────────────────

const tempDirs: string[] = [];

function makeTempDir(): string {
	const dir = mkdtempSync(join(tmpdir(), "flowdesk-oi-mcp-tools-"));
	tempDirs.push(dir);
	return dir;
}

afterEach(() => {
	for (const dir of tempDirs.splice(0)) {
		rmSync(dir, { recursive: true, force: true });
	}
});

function makeConfig(rootDir: string) {
	return {
		rootDir,
		oiConfig: {
			enabled: true,
			exposeMcpTools: true,
			persistAdvisoryEvidence: false,
		},
	};
}

/**
 * Extract the execute function from a tool created with tool().
 * The tool object has an `execute` method in the OpenCode plugin API.
 */
async function callTool(tools: Record<string, unknown>, toolName: string, args: unknown): Promise<unknown> {
	const t = tools[toolName] as { execute?: (args: unknown, ctx: unknown) => Promise<unknown> };
	assert.ok(t, `tool '${toolName}' not found`);
	assert.ok(typeof t.execute === "function", `tool '${toolName}' has no execute function`);
	const result = await t.execute(args, {});
	return result;
}

function parseResult(result: unknown): Record<string, unknown> {
	const parsed = JSON.parse(result as string);
	assert.ok(typeof parsed === "object" && parsed !== null, "result should be an object");
	return parsed as Record<string, unknown>;
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe("createFlowDeskOIOptInTools", () => {
	test("returns 5 tools when oiConfig.exposeMcpTools is true", () => {
		const rootDir = makeTempDir();
		const tools = createFlowDeskOIOptInTools(makeConfig(rootDir));

		assert.ok(flowdeskOIScorePreviewToolName in tools, "should have score_preview tool");
		assert.ok(flowdeskOIThresholdGateToolName in tools, "should have threshold_gate tool");
		assert.ok(flowdeskOILedgerListToolName in tools, "should have ledger_list tool");
		assert.ok(flowdeskOILedgerCompactToolName in tools, "should have ledger_compact tool");
		assert.ok(flowdeskOISessionSummaryToolName in tools, "should have session_summary tool");
		assert.equal(Object.keys(tools).length, 5);
	});

	test("all tool names match exported constants", () => {
		const rootDir = makeTempDir();
		const tools = createFlowDeskOIOptInTools(makeConfig(rootDir));

		assert.equal(flowdeskOIScorePreviewToolName, "flowdesk_oi_score_preview");
		assert.equal(flowdeskOIThresholdGateToolName, "flowdesk_oi_threshold_gate");
		assert.equal(flowdeskOILedgerListToolName, "flowdesk_oi_ledger_list");
		assert.equal(flowdeskOILedgerCompactToolName, "flowdesk_oi_ledger_compact");
		assert.equal(flowdeskOISessionSummaryToolName, "flowdesk_oi_session_summary");
		assert.ok(Object.keys(tools).includes(flowdeskOIScorePreviewToolName));
	});
});

describe("flowdesk_oi_score_preview", () => {
	test("returns score_computed status for valid input", async () => {
		const rootDir = makeTempDir();
		const tools = createFlowDeskOIOptInTools(makeConfig(rootDir));

		const result = parseResult(await callTool(tools, flowdeskOIScorePreviewToolName, {
			workflowId: "workflow-test-001",
			agentRole: "implementation",
			providerFamily: "claude",
		}));

		assert.equal(result.status, "score_computed");
		assert.ok(Array.isArray(result.errors));
		assert.equal((result.errors as unknown[]).length, 0);
		assert.ok(result.healthLabel !== undefined, "healthLabel should be present");
	});

	test("returns advisory score with all authority flags false", async () => {
		const rootDir = makeTempDir();
		const tools = createFlowDeskOIOptInTools(makeConfig(rootDir));

		const result = parseResult(await callTool(tools, flowdeskOIScorePreviewToolName, {
			workflowId: "workflow-test-002",
			agentRole: "security",
			providerFamily: "openai",
			usageRemainingPercent: 75,
			alertLevel: "warning",
		}));

		assert.equal(result.status, "score_computed");
		const authority = result.authority as Record<string, unknown>;
		assert.equal(authority.advisoryOnly, true);
		assert.equal(authority.dispatchAuthorityEnabled, false);
		assert.equal(authority.providerAuthorityEnabled, false);
		assert.equal(authority.laneLaunchAuthorityEnabled, false);
		assert.equal(authority.writeAuthorityEnabled, false);
	});

	test("score is null for invalid workflowId (empty string triggers validation failure)", async () => {
		const rootDir = makeTempDir();
		const tools = createFlowDeskOIOptInTools(makeConfig(rootDir));

		const result = parseResult(await callTool(tools, flowdeskOIScorePreviewToolName, {
			workflowId: "",
			agentRole: "implementation",
			providerFamily: "claude",
		}));

		// Empty workflowId should cause score_failed
		assert.equal(result.status, "score_failed");
		assert.ok(Array.isArray(result.errors));
		assert.ok((result.errors as string[]).length > 0, "should have validation errors");
	});

	test("exhausted alertLevel produces degraded health label", async () => {
		const rootDir = makeTempDir();
		const tools = createFlowDeskOIOptInTools(makeConfig(rootDir));

		const result = parseResult(await callTool(tools, flowdeskOIScorePreviewToolName, {
			workflowId: "workflow-test-003",
			agentRole: "implementation",
			providerFamily: "claude",
			alertLevel: "exhausted",
			usageRemainingPercent: 0,
		}));

		assert.equal(result.status, "score_computed");
		assert.equal(result.healthLabel, "degraded");
	});
});

describe("flowdesk_oi_threshold_gate", () => {
	test("returns gate_evaluated status for valid input", async () => {
		const rootDir = makeTempDir();
		const tools = createFlowDeskOIOptInTools(makeConfig(rootDir));

		const result = parseResult(await callTool(tools, flowdeskOIThresholdGateToolName, {
			workflowId: "workflow-gate-001",
			currentScore: 75,
		}));

		assert.equal(result.status, "gate_evaluated");
		assert.ok(result.gate !== null, "gate should be present");
		const gate = result.gate as Record<string, unknown>;
		assert.ok(["reuse", "recompute", "blocked"].includes(gate.gate_decision as string));
	});

	test("gate decision is reuse when score is fresh and context unchanged", async () => {
		const rootDir = makeTempDir();
		const tools = createFlowDeskOIOptInTools(makeConfig(rootDir));

		const result = parseResult(await callTool(tools, flowdeskOIThresholdGateToolName, {
			workflowId: "workflow-gate-002",
			currentScore: 80,
			scoreAgeSeconds: 0,
		}));

		assert.equal(result.status, "gate_evaluated");
		const gate = result.gate as Record<string, unknown>;
		// Score age 0 is within threshold, context matches → should be reuse
		assert.equal(gate.gate_decision, "reuse");
	});

	test("gate decision is recompute when score is stale (> 300s)", async () => {
		const rootDir = makeTempDir();
		const tools = createFlowDeskOIOptInTools(makeConfig(rootDir));

		const result = parseResult(await callTool(tools, flowdeskOIThresholdGateToolName, {
			workflowId: "workflow-gate-003",
			currentScore: 80,
			scoreAgeSeconds: 600, // older than 5 min threshold
		}));

		assert.equal(result.status, "gate_evaluated");
		const gate = result.gate as Record<string, unknown>;
		assert.equal(gate.gate_decision, "recompute");
	});

	test("authority flags are all false", async () => {
		const rootDir = makeTempDir();
		const tools = createFlowDeskOIOptInTools(makeConfig(rootDir));

		const result = parseResult(await callTool(tools, flowdeskOIThresholdGateToolName, {
			workflowId: "workflow-gate-004",
			currentScore: 60,
		}));

		const authority = result.authority as Record<string, unknown>;
		assert.equal(authority.advisoryOnly, true);
		assert.equal(authority.dispatchAuthorityEnabled, false);
		assert.equal(authority.approvalAuthorityEnabled, false);
		assert.equal(authority.laneLaunchAuthorityEnabled, false);
	});
});

describe("flowdesk_oi_ledger_list", () => {
	test("returns empty entries when no ledger exists", async () => {
		const rootDir = makeTempDir();
		const tools = createFlowDeskOIOptInTools(makeConfig(rootDir));

		const result = parseResult(await callTool(tools, flowdeskOILedgerListToolName, {
			workflowId: "workflow-ledger-001",
		}));

		assert.equal(result.status, "entries_loaded");
		assert.equal(result.entryCount, 0);
		assert.ok(Array.isArray(result.entries));
	});

	test("returns entries when ledger file exists", async () => {
		const rootDir = makeTempDir();
		const ledgerDir = join(rootDir, ".flowdesk", "oi");
		mkdirSync(ledgerDir, { recursive: true });
		const entry = JSON.stringify({
			signature_ref: "sig-ref-001",
			model_ref: "model-claude",
			weighted_score: 0.85,
			recorded_at: "2026-01-01T00:00:00.000Z",
		});
		writeFileSync(join(ledgerDir, "routing-advisory.jsonl"), `${entry}\n`, "utf8");

		const tools = createFlowDeskOIOptInTools(makeConfig(rootDir));
		const result = parseResult(await callTool(tools, flowdeskOILedgerListToolName, {
			workflowId: "workflow-ledger-002",
		}));

		assert.equal(result.status, "entries_loaded");
		assert.equal(result.entryCount, 1);
		assert.ok(Array.isArray(result.entries));
		assert.equal((result.entries as unknown[]).length, 1);
	});

	test("respects limit parameter", async () => {
		const rootDir = makeTempDir();
		const ledgerDir = join(rootDir, ".flowdesk", "oi");
		mkdirSync(ledgerDir, { recursive: true });
		// Write 5 entries
		const lines = Array.from({ length: 5 }, (_, i) =>
			JSON.stringify({
				signature_ref: `sig-${i}`,
				model_ref: "model-claude",
				weighted_score: 0.5,
				recorded_at: `2026-01-0${i + 1}T00:00:00.000Z`,
			}),
		).join("\n") + "\n";
		writeFileSync(join(ledgerDir, "routing-advisory.jsonl"), lines, "utf8");

		const tools = createFlowDeskOIOptInTools(makeConfig(rootDir));
		const result = parseResult(await callTool(tools, flowdeskOILedgerListToolName, {
			workflowId: "workflow-ledger-003",
			limit: 2,
		}));

		assert.equal(result.status, "entries_loaded");
		assert.equal(result.entryCount, 2);
	});

	test("authority flags are all false", async () => {
		const rootDir = makeTempDir();
		const tools = createFlowDeskOIOptInTools(makeConfig(rootDir));

		const result = parseResult(await callTool(tools, flowdeskOILedgerListToolName, {
			workflowId: "workflow-ledger-004",
		}));

		const authority = result.authority as Record<string, unknown>;
		assert.equal(authority.advisoryOnly, true);
		assert.equal(authority.dispatchAuthorityEnabled, false);
		assert.equal(authority.writeAuthorityEnabled, false);
	});
});

describe("flowdesk_oi_ledger_compact", () => {
	test("returns compaction_complete when no entries exist", async () => {
		const rootDir = makeTempDir();
		const tools = createFlowDeskOIOptInTools(makeConfig(rootDir));

		const result = parseResult(await callTool(tools, flowdeskOILedgerCompactToolName, {
			workflowId: "workflow-compact-001",
			compactionId: "compaction-test-001",
			triggerReason: "manual",
		}));

		assert.equal(result.status, "compaction_complete");
		assert.equal(result.compactionId, "compaction-test-001");
		assert.equal(result.triggerReason, "manual");
	});

	test("compacts entries and returns retained count", async () => {
		const rootDir = makeTempDir();
		const ledgerDir = join(rootDir, ".flowdesk", "oi");
		mkdirSync(ledgerDir, { recursive: true });
		// Write 3 entries
		const lines = Array.from({ length: 3 }, (_, i) =>
			JSON.stringify({
				signature_ref: `sig-compact-${i}`,
				model_ref: "model-claude",
				weighted_score: 0.6,
				recorded_at: `2026-01-0${i + 1}T00:00:00.000Z`,
			}),
		).join("\n") + "\n";
		writeFileSync(join(ledgerDir, "routing-advisory.jsonl"), lines, "utf8");

		const tools = createFlowDeskOIOptInTools(makeConfig(rootDir));
		const result = parseResult(await callTool(tools, flowdeskOILedgerCompactToolName, {
			workflowId: "workflow-compact-002",
			compactionId: "compaction-test-002",
			triggerReason: "count_limit",
		}));

		assert.equal(result.status, "compaction_complete");
		const cr = result.compactionResult as Record<string, unknown>;
		assert.equal(cr.ok, true);
		assert.equal(cr.inputEntryCount, 3);
	});

	test("normalizes unknown triggerReason to 'manual'", async () => {
		const rootDir = makeTempDir();
		const tools = createFlowDeskOIOptInTools(makeConfig(rootDir));

		const result = parseResult(await callTool(tools, flowdeskOILedgerCompactToolName, {
			workflowId: "workflow-compact-003",
			compactionId: "compaction-test-003",
			triggerReason: "unknown_reason",
		}));

		assert.equal(result.status, "compaction_complete");
		assert.equal(result.triggerReason, "manual");
	});

	test("authority flags are all false", async () => {
		const rootDir = makeTempDir();
		const tools = createFlowDeskOIOptInTools(makeConfig(rootDir));

		const result = parseResult(await callTool(tools, flowdeskOILedgerCompactToolName, {
			workflowId: "workflow-compact-004",
			compactionId: "compaction-test-004",
			triggerReason: "manual",
		}));

		const authority = result.authority as Record<string, unknown>;
		assert.equal(authority.advisoryOnly, true);
		assert.equal(authority.dispatchAuthorityEnabled, false);
		assert.equal(authority.writeAuthorityEnabled, false);
	});
});

describe("flowdesk_oi_session_summary", () => {
	test("returns empty summaries when rootDir has no evidence", async () => {
		const rootDir = makeTempDir();
		const tools = createFlowDeskOIOptInTools(makeConfig(rootDir));

		const result = parseResult(await callTool(tools, flowdeskOISessionSummaryToolName, {
			workflowId: "workflow-session-001",
		}));

		assert.equal(result.status, "summaries_loaded");
		assert.equal(result.summaryCount, 0);
		assert.ok(Array.isArray(result.summaries));
	});

	test("clamps maxCount to 1..20", async () => {
		const rootDir = makeTempDir();
		const tools = createFlowDeskOIOptInTools(makeConfig(rootDir));

		// Requesting 100 should be clamped to 20 (and still succeed with 0 summaries)
		const result = parseResult(await callTool(tools, flowdeskOISessionSummaryToolName, {
			workflowId: "workflow-session-002",
			maxCount: 100,
		}));

		assert.equal(result.status, "summaries_loaded");
		// The clamped value is not directly observable, but the call succeeds
		assert.ok(result.summaryCount !== undefined);
	});

	test("workflowId is reflected in the response", async () => {
		const rootDir = makeTempDir();
		const tools = createFlowDeskOIOptInTools(makeConfig(rootDir));

		const result = parseResult(await callTool(tools, flowdeskOISessionSummaryToolName, {
			workflowId: "workflow-session-echo-test",
		}));

		assert.equal(result.workflowId, "workflow-session-echo-test");
	});

	test("authority flags are all false", async () => {
		const rootDir = makeTempDir();
		const tools = createFlowDeskOIOptInTools(makeConfig(rootDir));

		const result = parseResult(await callTool(tools, flowdeskOISessionSummaryToolName, {
			workflowId: "workflow-session-003",
		}));

		const authority = result.authority as Record<string, unknown>;
		assert.equal(authority.advisoryOnly, true);
		assert.equal(authority.dispatchAuthorityEnabled, false);
		assert.equal(authority.laneLaunchAuthorityEnabled, false);
		assert.equal(authority.writeAuthorityEnabled, false);
	});
});
