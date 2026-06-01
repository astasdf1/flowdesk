import { reloadFlowDeskSessionEvidenceV1 } from "@flowdesk/core";
import { executeFlowDeskAgentTaskV1 } from "./agent-task-runner.js";
import type { FlowDeskManagedDispatchBetaOpenCodeClientV1 } from "./managed-dispatch-adapter.js";

export interface FlowDeskAutoContinueExecutionToolConfigV1 {
	rootDir: string;
	client: FlowDeskManagedDispatchBetaOpenCodeClientV1;
}

export interface FlowDeskAutoContinueExecutionTaskPayloadV1 {
	taskId?: string;
	promptText?: string;
	agentName?: string;
	providerQualifiedModelId?: string;
	outputContractRef?: string;
}

export interface FlowDeskAutoContinueExecutionToolRequestV1 {
	workflowId?: string;
	parentSessionId?: string;
	task?: FlowDeskAutoContinueExecutionTaskPayloadV1;
	developerModeAcknowledged?: boolean;
	allowProviderCall?: boolean;
	allowActualLaneLaunch?: boolean;
	allowAutoContinueExecution?: boolean;
}

export interface FlowDeskAutoContinueExecutionToolResultV1 {
	status:
		| "auto_continue_execution_completed"
		| "auto_continue_execution_incomplete"
		| "blocked_before_auto_continue_execution";
	rootDir?: string;
	workflowId?: string;
	planRevisionId?: string;
	parentSessionId?: string;
	laneId?: string;
	taskId?: string;
	taskResultEvidenceId?: string;
	pendingTaskCount: number;
	completedTaskCount: number;
	redactedBlockReason?: string;
	summaryForUser: string;
	safeNextActions: readonly ("/flowdesk-status" | "/flowdesk-export-debug" | "/flowdesk-doctor")[];
	authority: {
		realOpenCodeDispatch: false;
		providerCall: boolean;
		runtimeExecution: boolean;
		actualLaneLaunch: boolean;
		fallbackAuthority: false;
		hardCancelOrNoReplyAuthority: false;
		toolAuthority: false;
		dispatchAuthorityEnabled: false;
		defaultRelease1DispatchAuthority: false;
		developerModeAcknowledged: boolean;
		autoContinueExecutionOptIn: boolean;
		autoContinuationExecuted: boolean;
		workflowDispatchPlanReloaded: boolean;
		devModeActualLaneLaunchAttempted: boolean;
	};
}

const authoritySmugglingKeys = new Set([
	"fallbackAuthority",
	"providerFallback",
	"providerReselection",
	"realOpenCodeDispatch",
	"runtimeExecution",
	"toolAuthority",
	"writeApply",
	"controlledWrite",
]);

const forbiddenTextPattern = /\b(?:fallback|reselection|reselect|retry\s+with\s+(?:another|different)|switch\s+(?:provider|model)|controlled\s+write|write\s+apply|apply\s+write|apply\s+changes|write\s+files?|edit\s+files?|modify\s+files?|opencode\s+run|hidden\s+injection|omo)\b/i;

function safeNextActions(): FlowDeskAutoContinueExecutionToolResultV1["safeNextActions"] {
	return ["/flowdesk-status", "/flowdesk-export-debug", "/flowdesk-doctor"];
}

function authority(input: {
	request?: FlowDeskAutoContinueExecutionToolRequestV1;
	planReloaded: boolean;
	actualLaneLaunchAttempted: boolean;
}): FlowDeskAutoContinueExecutionToolResultV1["authority"] {
	return {
		realOpenCodeDispatch: false,
		providerCall: input.actualLaneLaunchAttempted,
		runtimeExecution: input.actualLaneLaunchAttempted,
		actualLaneLaunch: input.actualLaneLaunchAttempted,
		fallbackAuthority: false,
		hardCancelOrNoReplyAuthority: false,
		toolAuthority: false,
		dispatchAuthorityEnabled: false,
		defaultRelease1DispatchAuthority: false,
		developerModeAcknowledged: input.request?.developerModeAcknowledged === true,
		autoContinueExecutionOptIn: input.request?.allowAutoContinueExecution === true,
		autoContinuationExecuted: input.actualLaneLaunchAttempted,
		workflowDispatchPlanReloaded: input.planReloaded,
		devModeActualLaneLaunchAttempted: input.actualLaneLaunchAttempted,
	};
}

function blocked(input: {
	config?: FlowDeskAutoContinueExecutionToolConfigV1;
	request?: FlowDeskAutoContinueExecutionToolRequestV1;
	reason: string;
	workflowId?: string;
	planRevisionId?: string;
	laneId?: string;
	taskId?: string;
	pendingTaskCount?: number;
	completedTaskCount?: number;
	planReloaded?: boolean;
	actualLaneLaunchAttempted?: boolean;
}): FlowDeskAutoContinueExecutionToolResultV1 {
	const workflowId = input.workflowId ?? input.request?.workflowId;
	return {
		status: "blocked_before_auto_continue_execution",
		...(input.config?.rootDir === undefined ? {} : { rootDir: input.config.rootDir }),
		...(workflowId === undefined ? {} : { workflowId }),
		...(input.planRevisionId === undefined ? {} : { planRevisionId: input.planRevisionId }),
		...(input.request?.parentSessionId === undefined ? {} : { parentSessionId: input.request.parentSessionId }),
		...(input.laneId === undefined ? {} : { laneId: input.laneId }),
		...(input.taskId === undefined ? {} : { taskId: input.taskId }),
		pendingTaskCount: input.pendingTaskCount ?? 0,
		completedTaskCount: input.completedTaskCount ?? 0,
		redactedBlockReason: input.reason,
		summaryForUser: `FlowDesk auto-continue execution blocked: ${input.reason}.`,
		safeNextActions: safeNextActions(),
		authority: authority({
			request: input.request,
			planReloaded: input.planReloaded === true,
			actualLaneLaunchAttempted: input.actualLaneLaunchAttempted === true,
		}),
	};
}

function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === "object" && value !== null && !Array.isArray(value);
}

function stringField(record: Record<string, unknown>, key: string): string | undefined {
	const value = record[key];
	return typeof value === "string" && value.trim().length > 0 ? value : undefined;
}

function stableToken(value: string, fallback: string): string {
	const token = value.replaceAll(/[^A-Za-z0-9_.:-]/g, "-").slice(0, 96);
	return token.length >= 3 ? token : fallback;
}

function hasForbiddenAuthority(value: unknown): boolean {
	if (typeof value === "string") return forbiddenTextPattern.test(value);
	if (!isRecord(value)) return false;
	for (const [key, entry] of Object.entries(value)) {
		if (authoritySmugglingKeys.has(key) && entry !== false && entry !== undefined) return true;
		if (hasForbiddenAuthority(entry)) return true;
	}
	return false;
}

function normalizeRequest(value: unknown): FlowDeskAutoContinueExecutionToolRequestV1 {
	if (!isRecord(value)) return {};
	const task = isRecord(value.task) ? value.task : undefined;
	return {
		...(typeof value.workflowId === "string" ? { workflowId: value.workflowId } : {}),
		...(typeof value.parentSessionId === "string" ? { parentSessionId: value.parentSessionId } : {}),
		...(task === undefined ? {} : {
			task: {
				...(typeof task.taskId === "string" ? { taskId: task.taskId } : {}),
				...(typeof task.promptText === "string" ? { promptText: task.promptText } : {}),
				...(typeof task.agentName === "string" ? { agentName: task.agentName } : {}),
				...(typeof task.providerQualifiedModelId === "string" ? { providerQualifiedModelId: task.providerQualifiedModelId } : {}),
				...(typeof task.outputContractRef === "string" ? { outputContractRef: task.outputContractRef } : {}),
			},
		}),
		developerModeAcknowledged: value.developerModeAcknowledged === true,
		allowProviderCall: value.allowProviderCall === true,
		allowActualLaneLaunch: value.allowActualLaneLaunch === true,
		allowAutoContinueExecution: value.allowAutoContinueExecution === true,
	};
}

function terminalEvidencePresent(input: {
	rootDir: string;
	workflowId: string;
	laneId: string;
	taskId: string;
	completed: boolean;
}): boolean {
	const reload = reloadFlowDeskSessionEvidenceV1({ workflowId: input.workflowId, rootDir: input.rootDir });
	if (!reload.ok || reload.blocked.length > 0) return false;
	const terminalLifecycle = reload.entries.some(
		(entry) =>
			entry.evidenceClass === "lane_lifecycle" &&
			entry.record.lane_id === input.laneId &&
			["complete", "incomplete", "no_output", "invocation_failed", "task_failed", "aborted", "timeout"].includes(String(entry.record.state)),
	);
	const terminalTaskEvidence = reload.entries.some(
		(entry) =>
			entry.record.task_id === input.taskId &&
			entry.evidenceClass === (input.completed ? "task_result" : "task_failed"),
	);
	return terminalLifecycle && terminalTaskEvidence;
}

export async function executeFlowDeskAutoContinueExecutionToolV1(input: {
	config: FlowDeskAutoContinueExecutionToolConfigV1;
	request?: FlowDeskAutoContinueExecutionToolRequestV1;
	rawInput?: unknown;
}): Promise<FlowDeskAutoContinueExecutionToolResultV1> {
	const request = input.request ?? normalizeRequest(input.rawInput);
	if (typeof input.config.rootDir !== "string" || input.config.rootDir.trim().length === 0)
		return blocked({ config: input.config, request, reason: "autoContinueExecution requires a durable state root directory" });
	if (request.developerModeAcknowledged !== true)
		return blocked({ config: input.config, request, reason: "developerModeAcknowledged=true is required" });
	if (request.allowProviderCall !== true || request.allowActualLaneLaunch !== true || request.allowAutoContinueExecution !== true)
		return blocked({ config: input.config, request, reason: "allowProviderCall=true, allowActualLaneLaunch=true, and allowAutoContinueExecution=true are required" });
	if (hasForbiddenAuthority(input.rawInput ?? request))
		return blocked({ config: input.config, request, reason: "request contains fallback/reselection, write/apply, or authority-smuggling wording" });
	const workflowId = request.workflowId?.trim();
	if (!workflowId) return blocked({ config: input.config, request, reason: "workflowId is required" });
	if (typeof request.parentSessionId !== "string" || request.parentSessionId.trim().length === 0)
		return blocked({ config: input.config, request, workflowId, reason: "parentSessionId is required" });
	const taskRequest = request.task;
	if (taskRequest === undefined) return blocked({ config: input.config, request, workflowId, reason: "explicit executable task payload is required" });
	if (typeof taskRequest.taskId !== "string" || taskRequest.taskId.trim().length === 0)
		return blocked({ config: input.config, request, workflowId, reason: "task.taskId is required" });
	if (typeof taskRequest.promptText !== "string" || taskRequest.promptText.trim().length === 0)
		return blocked({ config: input.config, request, workflowId, reason: "task.promptText is required" });
	if (typeof taskRequest.agentName !== "string" || taskRequest.agentName.trim().length === 0)
		return blocked({ config: input.config, request, workflowId, reason: "task.agentName is required" });
	if (typeof taskRequest.providerQualifiedModelId !== "string" || !taskRequest.providerQualifiedModelId.includes("/"))
		return blocked({ config: input.config, request, workflowId, reason: "task.providerQualifiedModelId must be a concrete provider/model id" });
	if ((taskRequest.outputContractRef ?? "contract-task-result-v1") !== "contract-task-result-v1")
		return blocked({ config: input.config, request, workflowId, reason: "only outputContractRef=contract-task-result-v1 is supported" });

	const reload = reloadFlowDeskSessionEvidenceV1({ rootDir: input.config.rootDir, workflowId });
	if (!reload.ok || reload.blocked.length > 0)
		return blocked({ config: input.config, request, workflowId, reason: "session evidence reload failed" });
	const planEntries = reload.entries.filter((entry) => entry.evidenceClass === "workflow_dispatch_plan");
	const latestPlan = planEntries[planEntries.length - 1];
	if (latestPlan === undefined)
		return blocked({ config: input.config, request, workflowId, reason: "no workflow_dispatch_plan evidence found" });
	const tasksRaw = latestPlan.record.tasks;
	if (!Array.isArray(tasksRaw))
		return blocked({ config: input.config, request, workflowId, planRevisionId: latestPlan.evidenceId, reason: "workflow dispatch plan has no task list", planReloaded: true });
	const tasks: Array<{ taskId: string; agentRoleRef?: string }> = [];
	for (const rawTask of tasksRaw) {
		if (!isRecord(rawTask)) continue;
		const taskId = stringField(rawTask, "task_id");
		if (taskId === undefined) continue;
		tasks.push({ taskId, ...(stringField(rawTask, "agent_role_ref") === undefined ? {} : { agentRoleRef: stringField(rawTask, "agent_role_ref") }) });
	}
	if (tasks.length === 0)
		return blocked({ config: input.config, request, workflowId, planRevisionId: latestPlan.evidenceId, reason: "workflow dispatch plan has no valid tasks", planReloaded: true });
	const completedTaskIds = new Set<string>();
	for (const entry of reload.entries) {
		if (entry.evidenceClass !== "task_result") continue;
		const taskId = stringField(entry.record, "task_id");
		if (taskId !== undefined) completedTaskIds.add(taskId);
	}
	const pending = tasks.filter((task) => !completedTaskIds.has(task.taskId));
	if (pending.length === 0)
		return blocked({ config: input.config, request, workflowId, planRevisionId: latestPlan.evidenceId, reason: "no pending planned tasks remain", pendingTaskCount: 0, completedTaskCount: completedTaskIds.size, planReloaded: true });
	const next = pending[0];
	if (taskRequest.taskId.trim() !== next.taskId)
		return blocked({ config: input.config, request, workflowId, planRevisionId: latestPlan.evidenceId, taskId: taskRequest.taskId.trim(), reason: `task.taskId must match first pending durable plan task ${next.taskId}`, pendingTaskCount: pending.length, completedTaskCount: completedTaskIds.size, planReloaded: true });

	const laneId = stableToken(`lane-auto-continue-${next.taskId}`, "lane-auto-continue-task");
	const agentRef = stableToken((taskRequest.agentName.startsWith("agent-") ? taskRequest.agentName : `agent-${taskRequest.agentName}`).toLowerCase(), next.agentRoleRef ?? "agent-flowdesk-auto-continue");
	const taskResult = await executeFlowDeskAgentTaskV1({
		workflowId,
		taskId: next.taskId,
		laneId,
		agentRef,
		providerQualifiedModelId: taskRequest.providerQualifiedModelId,
		promptText: taskRequest.promptText,
		parentSessionId: request.parentSessionId,
		rootDir: input.config.rootDir,
		client: input.config.client,
		outputContract: "final_assistant_text",
	});
	const completed = taskResult.status === "task_completed";
	const terminalVerified = terminalEvidencePresent({ rootDir: input.config.rootDir, workflowId, laneId, taskId: next.taskId, completed });
	if (!terminalVerified)
		return blocked({ config: input.config, request, workflowId, planRevisionId: latestPlan.evidenceId, laneId, taskId: next.taskId, pendingTaskCount: pending.length, completedTaskCount: completedTaskIds.size, reason: "terminal lifecycle or task evidence reload verification failed", planReloaded: true, actualLaneLaunchAttempted: true });

	return {
		status: completed ? "auto_continue_execution_completed" : "auto_continue_execution_incomplete",
		rootDir: input.config.rootDir,
		workflowId,
		planRevisionId: latestPlan.evidenceId,
		parentSessionId: request.parentSessionId,
		laneId,
		taskId: next.taskId,
		...(completed ? { taskResultEvidenceId: taskResult.taskResultEvidenceId } : { redactedBlockReason: taskResult.status === "task_failed" ? taskResult.redactedReason : taskResult.status === "task_launched" ? "async mode" : "unknown" }),
		pendingTaskCount: pending.length,
		completedTaskCount: completedTaskIds.size,
		summaryForUser: completed
			? `FlowDesk auto-continue execution completed one explicit opt-in step for ${workflowId}. Default Release 1 dispatch authority remains disabled; no fallback execution was attempted.`
			: `FlowDesk auto-continue execution launched one explicit opt-in step but captured no result. Default Release 1 dispatch authority remains disabled; no fallback execution was attempted.`,
		safeNextActions: safeNextActions(),
		authority: authority({ request, planReloaded: true, actualLaneLaunchAttempted: true }),
	};
}
