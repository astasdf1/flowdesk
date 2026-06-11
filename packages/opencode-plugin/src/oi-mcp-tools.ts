/**
 * OI MCP Tools — P7-S10.
 *
 * Registers 5 advisory-only MCP tools for FlowDesk Operational Intelligence:
 *   1. flowdesk_oi_score_preview  — score a workflow proposal (no persistence)
 *   2. flowdesk_oi_threshold_gate — evaluate score reuse threshold gate
 *   3. flowdesk_oi_ledger_list    — list routing advisory ledger entries
 *   4. flowdesk_oi_ledger_compact — run advisory ledger compaction
 *   5. flowdesk_oi_session_summary — load recent OI session summaries
 *
 * All tools are advisory-only. None grant dispatch, provider, runtime,
 * lane-launch, fallback, write, or hard-chat authority.
 */

import { randomBytes } from "node:crypto";
import { tool } from "@opencode-ai/plugin";
import {
	scoreWorkflowProposal,
	createFlowDeskScoreReuseThresholdGateV1,
	compactFlowDeskAdvisoryLedgerV1,
	createFlowDeskLedgerRetentionPolicyV1,
	type FlowDeskScoringEngineInputV1,
	type FlowDeskLedgerCompactionTriggerReasonV1,
} from "@flowdesk/core";
import { loadRoutingAdvisoryLedgerV1 } from "./oi-ledger-reader.js";
import { loadRecentOISessionSummariesV1 } from "./oi-session-accumulator.js";

// ── Tool name constants (also exported from server.ts) ────────────────────────

export const flowdeskOIScorePreviewToolName = "flowdesk_oi_score_preview" as const;
export const flowdeskOIThresholdGateToolName = "flowdesk_oi_threshold_gate" as const;
export const flowdeskOILedgerListToolName = "flowdesk_oi_ledger_list" as const;
export const flowdeskOILedgerCompactToolName = "flowdesk_oi_ledger_compact" as const;
export const flowdeskOISessionSummaryToolName = "flowdesk_oi_session_summary" as const;

// ── Authority block (shared across all OI tool responses) ────────────────────

const OI_TOOL_AUTHORITY = {
	advisoryOnly: true,
	nonAuthorizing: true,
	dispatchAuthorityEnabled: false,
	approvalAuthorityEnabled: false,
	providerAuthorityEnabled: false,
	runtimeAuthorityEnabled: false,
	externalWriteAuthorityEnabled: false,
	remoteWriteAuthorityEnabled: false,
	fallbackAuthorityEnabled: false,
	laneLaunchAuthorityEnabled: false,
	writeAuthorityEnabled: false,
	hardChatAuthorityEnabled: false,
} as const;

// ── Internal helpers ──────────────────────────────────────────────────────────

const VALID_TRIGGER_REASONS: readonly FlowDeskLedgerCompactionTriggerReasonV1[] = [
	"count_limit",
	"size_limit",
	"manual",
];

function toTriggerReason(raw: string): FlowDeskLedgerCompactionTriggerReasonV1 {
	if (VALID_TRIGGER_REASONS.includes(raw as FlowDeskLedgerCompactionTriggerReasonV1)) {
		return raw as FlowDeskLedgerCompactionTriggerReasonV1;
	}
	return "manual";
}

// ── Factory ───────────────────────────────────────────────────────────────────

export interface FlowDeskOIOptInToolsConfigV1 {
	rootDir: string;
	oiConfig: {
		enabled: boolean;
		exposeMcpTools: boolean;
		persistAdvisoryEvidence: boolean;
	};
}

type FlowDeskOpenCodeTool = ReturnType<typeof tool>;

/**
 * Create all 5 OI MCP tools. Only called when oiConfig.exposeMcpTools is true
 * and rootDir is available. Returns a Record mapping tool name → tool.
 *
 * Advisory-only: no dispatch, provider, runtime, lane-launch, fallback,
 * write, or hard-chat authority granted by any result.
 */
export function createFlowDeskOIOptInTools(
	input: FlowDeskOIOptInToolsConfigV1,
): Record<string, FlowDeskOpenCodeTool> {
	const { rootDir } = input;

	// ── 1. flowdesk_oi_score_preview ─────────────────────────────────────────

	const scorePreviewTool = tool({
		description: [
			"Compute an advisory FlowDesk OI proposal score from provider usage evidence.",
			"No persistence; score result is preview-only and advisory-only.",
			"WHEN TO USE: checking scoring output before deciding whether to persist a ledger entry, or inspecting dimension breakdowns for a workflow candidate.",
			"WHEN NOT TO USE: production dispatch, provider selection, lane launch, or any authority-bearing decision.",
			"INVOKE WITH: workflowId, agentRole, providerFamily, optional usageRemainingPercent, alertLevel.",
			"AFTER CALLING: inspect score.advisoryScore, healthLabel, and dimensions. All authority flags are false.",
		].join(" "),
		args: {
			workflowId: tool.schema.string().describe("Workflow id for the scoring context."),
			agentRole: tool.schema.string().describe("Agent role for the proposal (e.g. 'implementation', 'security')."),
			providerFamily: tool.schema.string().describe("Provider family for the proposal (e.g. 'claude', 'openai', 'gemini')."),
			usageRemainingPercent: tool.schema.number().optional().describe("Optional: remaining usage percent (0..100) from provider_usage_snapshot."),
			alertLevel: tool.schema.string().optional().describe("Optional: alert level from provider_usage_snapshot. One of: ok, warning, critical, exhausted, stale, unknown."),
		},
		async execute(args) {
			const { workflowId, agentRole, providerFamily, usageRemainingPercent, alertLevel } = args;

			// Derive stable proposalId and candidateRef from workflowId + agentRole + providerFamily
			const proposalId = `proposal-oi-preview-${workflowId}-${agentRole}`;
			const candidateRef = `candidate-${providerFamily}-${agentRole}`;

			const engineInput: FlowDeskScoringEngineInputV1 = {
				workflowId,
				proposalId,
				candidateRef,
				agentRole,
				providerFamily,
				...(usageRemainingPercent !== undefined ? { usageRemainingPercent } : {}),
				...(alertLevel !== undefined ? { alertLevel: alertLevel as FlowDeskScoringEngineInputV1["alertLevel"] } : {}),
			};

			const result = scoreWorkflowProposal(engineInput, {});

			return JSON.stringify({
				status: result.ok ? "score_computed" : "score_failed",
				errors: result.errors,
				healthLabel: result.healthLabel,
				score: result.score ?? null,
				audit_usage_sustainability_applied: result.audit_usage_sustainability_applied ?? false,
				authority: OI_TOOL_AUTHORITY,
			});
		},
	});

	// ── 2. flowdesk_oi_threshold_gate ────────────────────────────────────────

	const thresholdGateTool = tool({
		description: [
			"Evaluate a FlowDesk OI score-reuse threshold gate.",
			"Determines whether an existing score can be reused or must be recomputed.",
			"Advisory-only: result never grants dispatch, provider, or lane-launch authority.",
			"WHEN TO USE: checking whether a cached score is still valid before running a new scoring pass.",
			"INVOKE WITH: workflowId, currentScore, optional signatureRef, scoreAgeSeconds.",
			"AFTER CALLING: inspect gate_decision ('reuse', 'recompute', or 'blocked'). All authority flags are false.",
		].join(" "),
		args: {
			workflowId: tool.schema.string().describe("Workflow id for the gate evaluation."),
			signatureRef: tool.schema.string().optional().describe("Optional opaque signature ref for the previous score context."),
			currentScore: tool.schema.number().describe("Previous advisory score value (0..100)."),
			scoreAgeSeconds: tool.schema.number().optional().describe("Optional: age of the existing score in seconds. Defaults to 0."),
		},
		async execute(args) {
			const { workflowId, currentScore } = args;
			const signatureRef = args.signatureRef ?? `sig-oi-${workflowId}`;
			const scoreAgeSeconds = args.scoreAgeSeconds ?? 0;

			// Derive stable gate id
			const gateId = `gate-oi-threshold-${workflowId}-${randomBytes(4).toString("hex")}`;
			const evaluatedAt = new Date().toISOString();

			// Use same hash for context match when no prior context change is signalled
			const contextHash = `hash-${signatureRef}`;

			const result = createFlowDeskScoreReuseThresholdGateV1({
				gateId,
				workflowId,
				previousScoreRef: signatureRef,
				previousContextHash: contextHash,
				currentContextHash: contextHash,
				scoreAgeSeconds,
				maxAgeThresholdSeconds: 300, // 5 minutes default
				previousAdvisoryScore: Math.max(0, Math.min(100, currentScore)),
				reasonRefs: ["reason-oi-threshold-gate-mcp-tool"],
				evaluatedAt,
			});

			return JSON.stringify({
				status: result.ok ? "gate_evaluated" : "gate_failed",
				errors: result.errors,
				gate: result.gate ?? null,
				authority: OI_TOOL_AUTHORITY,
			});
		},
	});

	// ── 3. flowdesk_oi_ledger_list ────────────────────────────────────────────

	const ledgerListTool = tool({
		description: [
			"List routing advisory ledger entries for a workflow.",
			"Advisory-only read; no persistence, no dispatch, no write authority.",
			"WHEN TO USE: inspecting historical OI routing advisory scores for a workflow.",
			"INVOKE WITH: workflowId, optional limit (default 20, max 50).",
			"AFTER CALLING: inspect entries array with routing advisory metadata. All authority flags are false.",
		].join(" "),
		args: {
			workflowId: tool.schema.string().describe("Workflow id to list ledger entries for."),
			limit: tool.schema.number().optional().describe("Maximum number of entries to return. Default 20, max 50."),
		},
		async execute(args) {
			const limit = Math.max(1, Math.min(50, Math.floor(args.limit ?? 20)));

			// Load all entries; workflowId is advisory context only (ledger is workspace-scoped)
			let entries: unknown[] = [];
			let loadError: string | undefined;
			try {
				const all = loadRoutingAdvisoryLedgerV1(rootDir);
				entries = all.slice(0, limit);
			} catch (err) {
				loadError = err instanceof Error ? err.message : "unknown error";
			}

			return JSON.stringify({
				status: loadError !== undefined ? "load_failed" : "entries_loaded",
				...(loadError !== undefined ? { error: loadError } : {}),
				entryCount: entries.length,
				entries,
				authority: OI_TOOL_AUTHORITY,
			});
		},
	});

	// ── 4. flowdesk_oi_ledger_compact ────────────────────────────────────────

	const ledgerCompactTool = tool({
		description: [
			"Run advisory ledger compaction for the routing advisory ledger.",
			"Compacts entries using the default retention policy and records the result.",
			"Advisory-only: no dispatch, provider, runtime, or external write authority.",
			"WHEN TO USE: manually triggering ledger maintenance when entries are old or the ledger is large.",
			"INVOKE WITH: workflowId, compactionId, triggerReason (one of: count_limit, size_limit, manual).",
			"AFTER CALLING: inspect compactionResult for retained/pruned counts. All authority flags are false.",
		].join(" "),
		args: {
			workflowId: tool.schema.string().describe("Workflow id context for the compaction."),
			compactionId: tool.schema.string().describe("Stable opaque compaction id (e.g. 'compaction-manual-001')."),
			triggerReason: tool.schema.string().describe("Reason for triggering compaction. One of: count_limit, size_limit, manual."),
		},
		async execute(args) {
			const { workflowId, compactionId } = args;
			const triggerReason = toTriggerReason(args.triggerReason);

			let compactionResult: unknown;
			let loadError: string | undefined;

			try {
				const entries = loadRoutingAdvisoryLedgerV1(rootDir);
				const policy = createFlowDeskLedgerRetentionPolicyV1();
				const compactedAt = new Date().toISOString();

				const result = compactFlowDeskAdvisoryLedgerV1({
					entries,
					policy,
					policyRef: "policy-ref-default-mcp-compact",
					compactionId,
					workflowId: workflowId.trim().length > 0 ? workflowId : undefined,
					triggerReason,
					compactedAt,
				});

				compactionResult = {
					ok: result.ok,
					errors: result.errors,
					retainedCount: result.ok && result.retainedEntries !== undefined
						? result.retainedEntries.length
						: undefined,
					inputEntryCount: entries.length,
				};
			} catch (err) {
				loadError = err instanceof Error ? err.message : "unknown error";
			}

			return JSON.stringify({
				status: loadError !== undefined ? "compaction_failed" : "compaction_complete",
				...(loadError !== undefined ? { error: loadError } : {}),
				compactionId,
				workflowId,
				triggerReason,
				compactionResult: compactionResult ?? null,
				authority: OI_TOOL_AUTHORITY,
			});
		},
	});

	// ── 5. flowdesk_oi_session_summary ────────────────────────────────────────

	const sessionSummaryTool = tool({
		description: [
			"Load recent OI session summaries for a workflow.",
			"Summaries are sorted by captured_at descending (newest first).",
			"Advisory-only read; no persistence, no dispatch, no write authority.",
			"WHEN TO USE: reviewing recent OI operation counts (proposals scored, reuse gates checked, etc.) for a workflow.",
			"INVOKE WITH: workflowId, optional maxCount (default 5, max 20).",
			"AFTER CALLING: inspect summaries array with OI session metrics. All authority flags are false.",
		].join(" "),
		args: {
			workflowId: tool.schema.string().describe("Workflow id to load OI session summaries for."),
			maxCount: tool.schema.number().optional().describe("Maximum number of summaries to return. Default 5, max 20."),
		},
		async execute(args) {
			const { workflowId } = args;
			const maxCount = Math.max(1, Math.min(20, Math.floor(args.maxCount ?? 5)));

			let summaries: unknown[] = [];
			let loadError: string | undefined;

			try {
				summaries = await loadRecentOISessionSummariesV1({
					durableStateRoot: rootDir,
					workflowId,
					maxCount,
				});
			} catch (err) {
				loadError = err instanceof Error ? err.message : "unknown error";
			}

			return JSON.stringify({
				status: loadError !== undefined ? "load_failed" : "summaries_loaded",
				...(loadError !== undefined ? { error: loadError } : {}),
				workflowId,
				summaryCount: summaries.length,
				summaries,
				authority: OI_TOOL_AUTHORITY,
			});
		},
	});

	return {
		[flowdeskOIScorePreviewToolName]: scorePreviewTool,
		[flowdeskOIThresholdGateToolName]: thresholdGateTool,
		[flowdeskOILedgerListToolName]: ledgerListTool,
		[flowdeskOILedgerCompactToolName]: ledgerCompactTool,
		[flowdeskOISessionSummaryToolName]: sessionSummaryTool,
	};
}
