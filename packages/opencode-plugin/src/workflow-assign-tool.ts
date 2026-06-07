import { randomBytes } from "node:crypto";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
	validateFlowDeskTaskAgentAssignmentV1,
	validateFlowDeskTaskModelSelectionV1,
	applyFlowDeskSessionEvidenceWriteIntentsV1,
	prepareFlowDeskSessionEvidenceWriteIntentV1,
	reloadFlowDeskSessionEvidenceV1,
	evaluateOIRoutingAdvisoryV1,
	createFlowDeskRoutingInfluencePolicyV1,
	createFlowDeskLedgerRetentionPolicyV1,
	type FlowDeskAgentRegistryRoleCategoryV1,
} from "@flowdesk/core";
import type { FlowDeskTuiUsageProviderRowV1 } from "./tui-usage-snapshot.js";
import { selectModelForTask, buildUsageMapFromProviders } from "./model-selection-engine.js";
import { buildOIAssignmentAdvisoryV1, type OIAssignmentAdvisoryInputV1 } from "./oi-assignment-advisor.js";
import { loadRoutingAdvisoryLedgerV1 } from "./oi-ledger-reader.js";

export interface FlowDeskWorkflowAssignToolResultV1 {
	status: "assignments_written" | "blocked_before_assignments";
	workflowId?: string;
	assignmentCount?: number;
	evidenceRefs?: string[];
	redactedBlockReason?: string;
	summaryForUser: string;
	safeNextActions: readonly string[];
	authority: {
		realOpenCodeDispatch: false;
		providerCall: false;
		runtimeExecution: false;
		actualLaneLaunch: false;
		fallbackAuthority: false;
	};
	/**
	 * OI advisory metadata collected AFTER model selection.
	 * Advisory-only: never influences selection, routing, dispatch, or fallback.
	 */
	oiAdvisory?: readonly {
		taskId: string;
		included: boolean;
		healthLabel: string;
		advisoryScore?: number;
		hardFilterState?: string;
		skippedReason?: string;
	}[];
}

const SAFE_AUTHORITY = { realOpenCodeDispatch: false, providerCall: false, runtimeExecution: false, actualLaneLaunch: false, fallbackAuthority: false } as const;

function blocked(reason: string, workflowId?: string): FlowDeskWorkflowAssignToolResultV1 {
	return { status: "blocked_before_assignments", workflowId, redactedBlockReason: reason, summaryForUser: `Blocked: ${reason}`, safeNextActions: ["/flowdesk-status", "/flowdesk-doctor"], authority: SAFE_AUTHORITY };
}

function loadWorkingModelIds(rootDir: string): string[] {
	const snapshotPath = join(rootDir, "model-availability/working-models.json");
	const raw = JSON.parse(readFileSync(snapshotPath, "utf8")) as Record<string, unknown>;
	const ids = raw.available_model_ids;
	return Array.isArray(ids) ? ids.filter((value): value is string => typeof value === "string" && value.includes("/")).filter((value, index, array) => array.indexOf(value) === index) : [];
}

export function executeFlowDeskWorkflowAssignToolV1(input: {
	workflowId: string;
	rootDir: string;
	sidebarCacheRows?: FlowDeskTuiUsageProviderRowV1[];
}): FlowDeskWorkflowAssignToolResultV1 {
	if (!input.workflowId?.trim()) return blocked("workflowId is required");
	if (!input.rootDir?.trim()) return blocked("rootDir is required");

	const reload = reloadFlowDeskSessionEvidenceV1({ workflowId: input.workflowId, rootDir: input.rootDir });
	if (!reload.ok) return blocked("session evidence reload failed", input.workflowId);

	const graphEntry = reload.entries.find(e => e.evidenceClass === "task_graph");
	if (!graphEntry) return blocked("task_graph evidence not found – run author tool first", input.workflowId);

	const graph = graphEntry.record as Record<string, unknown>;
	const nodes = Array.isArray(graph.nodes) ? graph.nodes as Array<Record<string, unknown>> : [];
	if (nodes.length === 0) return blocked("task_graph has no nodes", input.workflowId);

	const rows = input.sidebarCacheRows ?? [];
	if (rows.length === 0) return blocked("no provider usage data available – run flowdesk_quota first", input.workflowId);
	let workingModelIds: string[];
	try {
		workingModelIds = loadWorkingModelIds(input.rootDir);
	} catch {
		return blocked("working-model cache missing – run models refresh first", input.workflowId);
	}
	if (workingModelIds.length === 0) return blocked("working-model cache empty – run models refresh first", input.workflowId);

	const taskSignatureRef = "signature-default"; // TODO: Derive real signature from task properties
	const routingLedger = loadRoutingAdvisoryLedgerV1(input.rootDir);
	const routingAdvisory = evaluateOIRoutingAdvisoryV1(
		routingLedger,
		taskSignatureRef,
		createFlowDeskLedgerRetentionPolicyV1(),
		createFlowDeskRoutingInfluencePolicyV1({ enabled: true, min_sample_threshold: 1 }),
		new Date().toISOString()
	);

	const oiPerformanceScores = new Map<string, number>();
	if (routingAdvisory.model_summaries) {
		for (const summary of routingAdvisory.model_summaries) {
			oiPerformanceScores.set(summary.model_ref, summary.weighted_score);
		}
	}

	const selectionNow = new Date();
	const createdAt = selectionNow.toISOString();
	const evidenceRefs: string[] = [];
	const writeIntents: ReturnType<typeof prepareFlowDeskSessionEvidenceWriteIntentV1>[] = [];
	const oiAdvisories: Array<{
		taskId: string;
		included: boolean;
		healthLabel: string;
		advisoryScore?: number;
		hardFilterState?: string;
		skippedReason?: string;
	}> = [];

	for (const node of nodes) {
		const taskId = typeof node.task_id === "string" ? node.task_id : "";
		const agentRole = typeof node.agent_role === "string" ? node.agent_role : "implementation";
		if (!taskId) continue;

		const usageMap = buildUsageMapFromProviders(rows, () => selectionNow);
		const selected = selectModelForTask(agentRole as FlowDeskAgentRegistryRoleCategoryV1, usageMap, { availableModelIds: workingModelIds, availabilitySource: "durable_cache", oiPerformanceScores }, () => selectionNow);
		if (!selected) return blocked(`no available provider for task ${taskId} (role: ${agentRole})`, input.workflowId);

		// ── OI Advisory annotation (AFTER selection — must not influence it) ─────
		// Advisory-only: result is metadata only; never fed back into selection.
		const selectedRow = rows.find(r => r.providerFamily === selected.candidate.providerFamily);
		const oiAdvisory = buildOIAssignmentAdvisoryV1({
			workflowId: input.workflowId,
			taskId,
			agentRole,
			selectedCandidateRef: `candidate-${selected.candidate.providerQualifiedModelId.replace(/\//g, "-")}`,
			providerFamily: selected.candidate.providerFamily,
			...(typeof selectedRow?.remainingPercent === "number" ? { usageRemainingPercent: selectedRow.remainingPercent } : {}),
			...(selectedRow?.alertLevel !== undefined ? { alertLevel: selectedRow.alertLevel as OIAssignmentAdvisoryInputV1["alertLevel"] } : {}),
			oiEnabled: true,
		});
		oiAdvisories.push({
			taskId,
			included: oiAdvisory.included,
			healthLabel: oiAdvisory.healthLabel,
			...(oiAdvisory.advisoryScore !== undefined ? { advisoryScore: oiAdvisory.advisoryScore } : {}),
			...(oiAdvisory.hardFilterState !== undefined ? { hardFilterState: oiAdvisory.hardFilterState } : {}),
			...(oiAdvisory.skippedReason !== undefined ? { skippedReason: oiAdvisory.skippedReason } : {}),
		});

		const assignmentId = `assignment-${randomBytes(4).toString("hex")}`;
		const selectionId = `selection-${randomBytes(4).toString("hex")}`;
		const agentName = selected.candidate.agentName;
		const modelId = selected.candidate.providerQualifiedModelId;
		const selectedFamily = selected.candidate.providerFamily;
		const selectedRemaining = rows.find(r => r.providerFamily === selectedFamily)?.remainingPercent ?? null;

		const assignmentRecord = {
			schema_version: "flowdesk.task_agent_assignment.v1",
			workflow_id: input.workflowId,
			task_id: taskId,
			assignment_id: assignmentId,
			agent_role: agentRole,
			agent_role_ref: `agent-${agentName}`,
			selected_agent_ref: agentName,
			selected_profile_ref: `profile-${agentName}`,
			compatibility_status: "compatible",
			fit_label: selected.candidate.tier === "heavy" ? "strong_fit" : "acceptable_fit",
			registry_evidence_ref: "registry-default",
			profile_evidence_ref: "profile-default",
			blocked_labels: [],
			created_at: createdAt,
			release_gate: "release1_planning_only",
			dispatch_authority_enabled: false,
			provider_call_made: false,
			runtime_execution: false,
			actual_lane_launch: false,
			write_authority_enabled: false,
			redaction_version: "v1",
		};

		const selectionRecord = {
			schema_version: "flowdesk.task_model_selection.v1",
			workflow_id: input.workflowId,
			task_id: taskId,
			selection_id: selectionId,
			provider_family: selectedFamily,
			provider_qualified_model_id: modelId,
			usage_snapshot_ref: `usage-${selectedFamily}-recent`,
			usage_snapshot_freshness: "fresh",
			provider_health_ref: `health-${selectedFamily}-recent`,
			provider_health_label: rows.find(r => r.providerFamily === selectedFamily)?.alertLevel === "ok" ? "ok" : "warning",
			exact_model_availability_ref: `avail-${selectedFamily}-recent`,
			exact_model_availability_label: "available",
			fit_label: selected.candidate.tier === "heavy" ? "strong_fit" : "acceptable_fit",
			performance_label: (selectedRemaining ?? 100) > 50 ? "headroom_ok" : "headroom_tight",
			selection_status: "selected",
			blocked_labels: [],
			fallback_allowed: false,
			reselection_allowed: false,
			created_at: createdAt,
			release_gate: "release1_planning_only",
			dispatch_authority_enabled: false,
			provider_call_made: false,
			runtime_execution: false,
			actual_lane_launch: false,
			write_authority_enabled: false,
			redaction_version: "v1",
		};

		if (!validateFlowDeskTaskAgentAssignmentV1(assignmentRecord).ok) return blocked(`assignment validation failed for ${taskId}`, input.workflowId);
		if (!validateFlowDeskTaskModelSelectionV1(selectionRecord).ok) return blocked(`model selection validation failed for ${taskId}`, input.workflowId);

		writeIntents.push(
			prepareFlowDeskSessionEvidenceWriteIntentV1({ workflowId: input.workflowId, evidenceId: assignmentId, record: assignmentRecord as unknown as Record<string, unknown> }),
			prepareFlowDeskSessionEvidenceWriteIntentV1({ workflowId: input.workflowId, evidenceId: selectionId, record: selectionRecord as unknown as Record<string, unknown> }),
		);
		evidenceRefs.push(assignmentId, selectionId);
	}

	if (writeIntents.some(i => !i.ok || !i.writeIntent)) return blocked("evidence write intent preparation failed", input.workflowId);
	const applied = applyFlowDeskSessionEvidenceWriteIntentsV1(input.rootDir, writeIntents.map(i => i.writeIntent!));
	if (!applied.ok) return blocked("evidence write failed", input.workflowId);

	return {
		status: "assignments_written",
		workflowId: input.workflowId,
		assignmentCount: nodes.length,
		evidenceRefs,
		summaryForUser: `FlowDesk assigned ${nodes.length} task(s) to agents/models using usage-weighted selection. Planning only: no dispatch authority opened.`,
		safeNextActions: ["/flowdesk-status", "/flowdesk-export-debug"],
		authority: SAFE_AUTHORITY,
		oiAdvisory: oiAdvisories,
	};
}
