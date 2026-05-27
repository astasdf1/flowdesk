/**
 * FlowDesk Workflow Orchestrator
 * Chains: Author → Assign → Schedule → Synthesize
 * All authority flags remain false throughout.
 */
import {
	reloadFlowDeskSessionEvidenceV1,
	type FlowDeskTaskGraphV1,
	type FlowDeskTaskModelSelectionV1,
} from "@flowdesk/core";
import { type FlowDeskAgentTaskInputV1 } from "./agent-task-runner.js";
import { executeFlowDeskWorkflowAuthorToolV1 } from "./workflow-author-tool.js";
import { executeFlowDeskWorkflowAssignToolV1 } from "./workflow-assign-tool.js";
import { executeFlowDeskWorkflowSchedulerV1 } from "./workflow-scheduler.js";
import { executeFlowDeskWorkflowSynthesisToolV1 } from "./workflow-synthesis-tool.js";
import { loadFlowDeskTuiUsageSnapshotViewV1 } from "./tui-usage-snapshot.js";

export interface FlowDeskWorkflowOrchestratorInputV1 {
	workflowId?: string;
	goalSummary: string;
	parentSessionId: string;
	rootDir: string;
	client: FlowDeskAgentTaskInputV1["client"];
	providerQualifiedModelId: string;
	agentName: string;
}

export interface FlowDeskWorkflowOrchestratorResultV1 {
	status:
		| "orchestration_completed"
		| "orchestration_incomplete"
		| "blocked_before_orchestration";
	workflowId?: string;
	taskCount?: number;
	executedTaskIds?: string[];
	synthesisId?: string;
	conflictDetected?: boolean;
	summaryForUser: string;
	redactedBlockReason?: string;
	safeNextActions: readonly string[];
	authority: {
		realOpenCodeDispatch: false;
		providerCall: false;
		runtimeExecution: false;
		actualLaneLaunch: false;
		fallbackAuthority: false;
		hardCancelOrNoReplyAuthority: false;
	};
}

const SAFE_AUTHORITY = {
	realOpenCodeDispatch: false,
	providerCall: false,
	runtimeExecution: false,
	actualLaneLaunch: false,
	fallbackAuthority: false,
	hardCancelOrNoReplyAuthority: false,
} as const;

function blocked(reason: string, workflowId?: string): FlowDeskWorkflowOrchestratorResultV1 {
	return {
		status: "blocked_before_orchestration",
		workflowId,
		redactedBlockReason: reason,
		summaryForUser: `FlowDesk orchestration blocked: ${reason}`,
		safeNextActions: ["/flowdesk-status", "/flowdesk-doctor"],
		authority: SAFE_AUTHORITY,
	};
}

export async function executeFlowDeskWorkflowOrchestratorV1(
	input: FlowDeskWorkflowOrchestratorInputV1,
): Promise<FlowDeskWorkflowOrchestratorResultV1> {
	// Validate inputs
	if (!input.goalSummary?.trim()) return blocked("goalSummary is required");
	if (!input.parentSessionId?.trim()) return blocked("parentSessionId is required");
	if (!input.rootDir?.trim()) return blocked("rootDir is required");
	if (!input.providerQualifiedModelId?.includes("/")) return blocked("providerQualifiedModelId must be concrete");
	if (!input.agentName?.trim()) return blocked("agentName is required");

	// ── Step 1: Author — decompose goal into task graph ────────────────────
	const authorResult = await executeFlowDeskWorkflowAuthorToolV1({
		workflowId: input.workflowId,
		goalSummary: input.goalSummary,
		parentSessionId: input.parentSessionId,
		rootDir: input.rootDir,
		client: input.client,
		providerQualifiedModelId: input.providerQualifiedModelId,
		agentName: input.agentName,
	});

	if (authorResult.status !== "workflow_authoring_completed" || !authorResult.workflowId || !authorResult.taskCount) {
		return {
			status: "orchestration_incomplete",
			workflowId: authorResult.workflowId,
			redactedBlockReason: authorResult.redactedBlockReason ?? "authoring did not complete",
			summaryForUser: `FlowDesk orchestration stopped at authoring: ${authorResult.redactedBlockReason ?? "unknown"}`,
			safeNextActions: ["/flowdesk-status"],
			authority: SAFE_AUTHORITY,
		};
	}

	const workflowId = authorResult.workflowId;

	// ── Step 2: Assign — pick agents/models per task from usage ────────────
	const usageView = loadFlowDeskTuiUsageSnapshotViewV1({
		rootDir: input.rootDir,
		workflowId: "workflow-provider-usage-live",
	});

	const assignResult = executeFlowDeskWorkflowAssignToolV1({
		workflowId,
		rootDir: input.rootDir,
		sidebarCacheRows: usageView.providers.filter(p => p.connected) as Parameters<typeof executeFlowDeskWorkflowAssignToolV1>[0]["sidebarCacheRows"],
	});

	if (assignResult.status !== "assignments_written") {
		return {
			status: "orchestration_incomplete",
			workflowId,
			redactedBlockReason: assignResult.redactedBlockReason ?? "assignment did not complete",
			summaryForUser: `FlowDesk orchestration stopped at assignment: ${assignResult.redactedBlockReason ?? "unknown"}`,
			safeNextActions: ["/flowdesk-status"],
			authority: SAFE_AUTHORITY,
		};
	}

	// ── Step 3: Schedule — execute tasks in DAG order ─────────────────────
	const reload = reloadFlowDeskSessionEvidenceV1({ workflowId, rootDir: input.rootDir });
	if (!reload.ok) return {
		status: "orchestration_incomplete",
		workflowId,
		redactedBlockReason: "evidence reload failed before scheduling",
		summaryForUser: "FlowDesk orchestration stopped: could not reload evidence before scheduling.",
		safeNextActions: ["/flowdesk-status"],
		authority: SAFE_AUTHORITY,
	};

	const graphEntry = reload.entries.find(e => e.evidenceClass === "task_graph");
	const selectionEntries = reload.entries.filter(e => e.evidenceClass === "task_model_selection");

	if (!graphEntry) return {
		status: "orchestration_incomplete",
		workflowId,
		redactedBlockReason: "task_graph evidence not found after authoring",
		summaryForUser: "FlowDesk orchestration stopped: task graph evidence missing.",
		safeNextActions: ["/flowdesk-status"],
		authority: SAFE_AUTHORITY,
	};

	const taskGraph = graphEntry.record as unknown as FlowDeskTaskGraphV1;
	const modelSelections = selectionEntries.map(e => e.record as unknown as FlowDeskTaskModelSelectionV1);

	const schedulerResult = await executeFlowDeskWorkflowSchedulerV1({
		taskGraph,
		modelSelections,
		parentSessionId: input.parentSessionId,
		rootDir: input.rootDir,
		client: input.client,
		agentRef: `agent-${input.agentName.toLowerCase().replace(/[^a-z0-9-]/g, "-")}`,
	});

	if (schedulerResult.status !== "workflow_completed") {
		return {
			status: "orchestration_incomplete",
			workflowId,
			taskCount: authorResult.taskCount,
			executedTaskIds: schedulerResult.executedTaskIds,
			redactedBlockReason: schedulerResult.redactedReason ?? "scheduler did not complete all tasks",
			summaryForUser: `FlowDesk orchestration stopped at execution (${schedulerResult.executedTaskIds.length}/${authorResult.taskCount} tasks done): ${schedulerResult.redactedReason ?? "unknown"}`,
			safeNextActions: ["/flowdesk-status"],
			authority: SAFE_AUTHORITY,
		};
	}

	// ── Step 4: Synthesize — aggregate task results ────────────────────────
	const synthesisResult = await executeFlowDeskWorkflowSynthesisToolV1({
		workflowId,
		rootDir: input.rootDir,
		client: input.client,
		parentSessionId: input.parentSessionId,
		providerQualifiedModelId: input.providerQualifiedModelId,
		agentName: input.agentName,
	});

	if (synthesisResult.status !== "workflow_synthesis_completed") {
		return {
			status: "orchestration_incomplete",
			workflowId,
			taskCount: authorResult.taskCount,
			executedTaskIds: schedulerResult.executedTaskIds,
			redactedBlockReason: synthesisResult.redactedBlockReason ?? "synthesis did not complete",
			summaryForUser: `FlowDesk tasks completed but synthesis stopped: ${synthesisResult.redactedBlockReason ?? "unknown"}`,
			safeNextActions: ["/flowdesk-status"],
			authority: SAFE_AUTHORITY,
		};
	}

	return {
		status: "orchestration_completed",
		workflowId,
		taskCount: authorResult.taskCount,
		executedTaskIds: schedulerResult.executedTaskIds,
		synthesisId: synthesisResult.synthesisId,
		conflictDetected: synthesisResult.conflictDetected,
		summaryForUser: synthesisResult.summaryForUser,
		safeNextActions: ["/flowdesk-status", "/flowdesk-export-debug"],
		authority: SAFE_AUTHORITY,
	};
}
