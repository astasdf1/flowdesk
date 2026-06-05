import { readFileSync } from "node:fs";
import { join } from "node:path";
import { reloadFlowDeskSessionEvidenceV1 } from "@flowdesk/core";
import { executeFlowDeskAgentTaskV1 } from "./agent-task-runner.js";
import type { FlowDeskManagedDispatchBetaOpenCodeClientV1 } from "./managed-dispatch-adapter.js";

export interface FlowDeskAutoContinueExecutionToolConfigV1 {
	rootDir: string;
	client: FlowDeskManagedDispatchBetaOpenCodeClientV1;
	compatibilityGate?: {
		autoContinueExecutionEnabled?: boolean;
		devBetaActualLaneLaunch?: boolean;
		evidenceRef?: string;
		allowMissingEvidenceForDevMode?: boolean;
	};
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
	blockedTaskCount?: number;
	autoContinueCompatibilityGate?: {
		satisfied: boolean;
		devModeOverrideUsed: boolean;
		evidenceRef?: string;
	};
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
		autoContinueCompatibilityGateSatisfied: boolean;
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
	compatibilityGateSatisfied?: boolean;
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
		autoContinueCompatibilityGateSatisfied: input.compatibilityGateSatisfied === true,
	};
}

function compatibilityGateFromConfig(config: FlowDeskAutoContinueExecutionToolConfigV1): NonNullable<FlowDeskAutoContinueExecutionToolResultV1["autoContinueCompatibilityGate"]> {
	const gate = config.compatibilityGate;
	const explicitEvidence = typeof gate?.evidenceRef === "string" && gate.evidenceRef.trim().length > 0 ? gate.evidenceRef.trim() : undefined;
	const satisfied = gate?.autoContinueExecutionEnabled === true && gate.devBetaActualLaneLaunch === true && explicitEvidence !== undefined;
	const devModeOverrideUsed = satisfied !== true && gate?.allowMissingEvidenceForDevMode === true;
	return {
		satisfied: satisfied || devModeOverrideUsed,
		devModeOverrideUsed,
		...(explicitEvidence === undefined ? {} : { evidenceRef: explicitEvidence }),
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
	blockedTaskCount?: number;
	planReloaded?: boolean;
	actualLaneLaunchAttempted?: boolean;
	compatibilityGate?: FlowDeskAutoContinueExecutionToolResultV1["autoContinueCompatibilityGate"];
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
		...(input.blockedTaskCount === undefined ? {} : { blockedTaskCount: input.blockedTaskCount }),
		...(input.compatibilityGate === undefined ? {} : { autoContinueCompatibilityGate: input.compatibilityGate }),
		redactedBlockReason: input.reason,
		summaryForUser: `FlowDesk auto-continue execution blocked: ${input.reason}.`,
		safeNextActions: safeNextActions(),
		authority: authority({
			request: input.request,
			planReloaded: input.planReloaded === true,
			actualLaneLaunchAttempted: input.actualLaneLaunchAttempted === true,
			compatibilityGateSatisfied: input.compatibilityGate?.satisfied === true,
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

const BLOCKED_TASK_STATES = new Set([
	"task_failed",
	"aborted",
	"no_output",
	"missing_verdict",
	"invocation_failed",
	"timeout",
	"telemetry_ambiguous",
	"ambiguous",
	"incomplete",
]);

function evidenceTaskId(record: Record<string, unknown>): string | undefined {
	return stringField(record, "task_id") ?? stringField(record, "taskId");
}

function blockedStateFromRecord(record: Record<string, unknown>): string | undefined {
	for (const key of ["state", "status", "failure_class", "failure_category", "completion_status"]) {
		const value = stringField(record, key);
		if (value !== undefined && BLOCKED_TASK_STATES.has(value)) return value;
	}
	return undefined;
}

function tryReadRawRecord(rootDir: string, relativePath: string): Record<string, unknown> | undefined {
	try {
		const raw = readFileSync(join(rootDir, relativePath), "utf8");
		const parsed: unknown = JSON.parse(raw);
		return isRecord(parsed) ? parsed : undefined;
	} catch {
		return undefined;
	}
}

function classifyPlanTasks(input: {
	tasks: Array<{ taskId: string; agentRoleRef?: string }>;
	entries: Array<{ evidenceClass: string; record: Record<string, unknown> }>;
	blockedEntries?: Array<{ evidenceClass: string; evidenceId: string; reason: string; path: string }>;
	rootDir?: string;
}): {
	completedTaskIds: Set<string>;
	blockedByTaskId: Map<string, string>;
	pending: Array<{ taskId: string; agentRoleRef?: string }>;
} {
	const plannedTaskIds = new Set(input.tasks.map((task) => task.taskId));
	const completedTaskIds = new Set<string>();
	for (const entry of input.entries) {
		if (entry.evidenceClass !== "task_result") continue;
		const taskId = evidenceTaskId(entry.record);
		if (taskId !== undefined && plannedTaskIds.has(taskId)) completedTaskIds.add(taskId);
	}
	const blockedByTaskId = new Map<string, string>();
	const ambiguousBlockedStates: string[] = [];
	for (const entry of input.entries) {
		const taskId = evidenceTaskId(entry.record);
		const state = entry.evidenceClass === "task_failed" ? "task_failed" : blockedStateFromRecord(entry.record);
		if (taskId === undefined) {
			if (state !== undefined && (entry.evidenceClass === "lane_lifecycle" || entry.evidenceClass === "task_failed")) ambiguousBlockedStates.push(state);
			continue;
		}
		if (!plannedTaskIds.has(taskId) || completedTaskIds.has(taskId)) continue;
		if (state !== undefined) blockedByTaskId.set(taskId, state);
	}
	// Best-effort: also check schema-blocked lane_lifecycle/task_failed entries by re-reading raw JSON.
	// This allows detection of terminal/incomplete states even when the record fails schema validation.
	// No authority is granted from this path; it is classification only.
	if (input.rootDir !== undefined && input.blockedEntries !== undefined) {
		for (const blocked of input.blockedEntries) {
			if (blocked.evidenceClass !== "lane_lifecycle" && blocked.evidenceClass !== "task_failed") continue;
			const raw = tryReadRawRecord(input.rootDir, blocked.path);
			if (raw === undefined) continue;
			const taskId = evidenceTaskId(raw);
			const state = blocked.evidenceClass === "task_failed" ? "task_failed" : blockedStateFromRecord(raw);
			if (taskId === undefined) {
				if (state !== undefined) ambiguousBlockedStates.push(state);
				continue;
			}
			if (!plannedTaskIds.has(taskId) || completedTaskIds.has(taskId) || blockedByTaskId.has(taskId)) continue;
			if (state !== undefined) blockedByTaskId.set(taskId, state);
		}
	}
	if (blockedByTaskId.size === 0 && ambiguousBlockedStates.length > 0) {
		const firstUncompleted = input.tasks.find((task) => !completedTaskIds.has(task.taskId));
		if (firstUncompleted !== undefined) blockedByTaskId.set(firstUncompleted.taskId, ambiguousBlockedStates[0] ?? "ambiguous");
	}
	return {
		completedTaskIds,
		blockedByTaskId,
		pending: input.tasks.filter((task) => !completedTaskIds.has(task.taskId) && !blockedByTaskId.has(task.taskId)),
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
	const compatibilityGate = compatibilityGateFromConfig(input.config);
	if (compatibilityGate.satisfied !== true)
		return blocked({ config: input.config, request, reason: "autoContinueExecution local compatibility evidence is required", compatibilityGate });
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
	if (!reload.ok)
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
	const classification = classifyPlanTasks({ tasks, entries: reload.entries, blockedEntries: reload.blocked, rootDir: input.config.rootDir });
	const { completedTaskIds, blockedByTaskId, pending } = classification;
	if (blockedByTaskId.size > 0) {
		const [blockedTaskId, state] = blockedByTaskId.entries().next().value as [string, string];
		return blocked({
			config: input.config,
			request,
			workflowId,
			planRevisionId: latestPlan.evidenceId,
			taskId: blockedTaskId,
			reason: `planned task ${blockedTaskId} has terminal incomplete evidence: ${state}`,
			pendingTaskCount: pending.length,
			completedTaskCount: completedTaskIds.size,
			blockedTaskCount: blockedByTaskId.size,
			planReloaded: true,
			compatibilityGate,
		});
	}
	if (pending.length === 0)
		return blocked({ config: input.config, request, workflowId, planRevisionId: latestPlan.evidenceId, reason: "no pending planned tasks remain", pendingTaskCount: 0, completedTaskCount: completedTaskIds.size, planReloaded: true, compatibilityGate });
	const next = pending[0];
	if (taskRequest.taskId.trim() !== next.taskId)
		return blocked({ config: input.config, request, workflowId, planRevisionId: latestPlan.evidenceId, taskId: taskRequest.taskId.trim(), reason: `task.taskId must match first pending durable plan task ${next.taskId}`, pendingTaskCount: pending.length, completedTaskCount: completedTaskIds.size, planReloaded: true, compatibilityGate });

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
		return blocked({ config: input.config, request, workflowId, planRevisionId: latestPlan.evidenceId, laneId, taskId: next.taskId, pendingTaskCount: pending.length, completedTaskCount: completedTaskIds.size, reason: "terminal lifecycle or task evidence reload verification failed", planReloaded: true, actualLaneLaunchAttempted: true, compatibilityGate });

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
		autoContinueCompatibilityGate: compatibilityGate,
		summaryForUser: completed
			? `FlowDesk auto-continue execution completed one explicit opt-in step for ${workflowId}. Default Release 1 dispatch authority remains disabled; no fallback execution was attempted.`
			: `FlowDesk auto-continue execution launched one explicit opt-in step but captured no result. Default Release 1 dispatch authority remains disabled; no fallback execution was attempted.`,
		safeNextActions: safeNextActions(),
		authority: authority({ request, planReloaded: true, actualLaneLaunchAttempted: true, compatibilityGateSatisfied: compatibilityGate.satisfied }),
	};
}
