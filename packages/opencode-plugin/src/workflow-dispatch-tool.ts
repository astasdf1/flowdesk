import {
	applyFlowDeskSessionEvidenceWriteIntentsV1,
	evaluateFlowDeskWorkflowDispatchPlanningV1,
	type FlowDeskAgentRegistryRoleCategoryV1,
	type FlowDeskWorkflowDispatchSelectedAgentRoleV1,
	type FlowDeskWorkflowDispatchTaskV1,
	prepareFlowDeskSessionEvidenceWriteIntentV1,
	reloadFlowDeskSessionEvidenceV1,
} from "@flowdesk/core";
import { executeFlowDeskAgentTaskV1 } from "./agent-task-runner.js";
import type { FlowDeskManagedDispatchBetaOpenCodeClientV1 } from "./managed-dispatch-adapter.js";

export interface FlowDeskWorkflowDispatchToolConfigV1 {
	rootDir: string;
	client: FlowDeskManagedDispatchBetaOpenCodeClientV1;
}

export interface FlowDeskWorkflowDispatchTaskRequestV1 {
	agentRole?: string;
	summary?: string;
	promptText?: string;
	agentName?: string;
	providerQualifiedModelId?: string;
	outputContractRef?: string;
}

export interface FlowDeskWorkflowDispatchToolRequestV1 {
	workflowId?: string;
	goalSummary?: string;
	parentSessionId?: string;
	task?: FlowDeskWorkflowDispatchTaskRequestV1;
	developerModeAcknowledged?: boolean;
	allowProviderCall?: boolean;
	allowActualLaneLaunch?: boolean;
}

export interface FlowDeskWorkflowDispatchToolResultV1 {
	status:
		| "workflow_dispatch_completed"
		| "workflow_dispatch_incomplete"
		| "blocked_before_workflow_dispatch";
	rootDir?: string;
	workflowId?: string;
	planRevisionId?: string;
	parentSessionId?: string;
	laneId?: string;
	taskId?: string;
	taskResultEvidenceId?: string;
	/**
	 * ADVISORY capture metadata for the coordinator's substance judgement. The
	 * workflow dispatch tool only confirms that a lane captured text; it does NOT
	 * judge whether the text actually satisfies the task. The coordinator reads
	 * this to decide success/failure and whether to re-select a model and retry.
	 */
	captureAdvisory?: {
		outputKind?: string;
		completionStatus?: string;
		finalizationReason?: string;
		looksLikeRefusalOrError?: boolean;
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
		workflowDispatchPlanPersisted: boolean;
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

function safeNextActions(): FlowDeskWorkflowDispatchToolResultV1["safeNextActions"] {
	return ["/flowdesk-status", "/flowdesk-export-debug", "/flowdesk-doctor"];
}

function authority(input: {
	developerModeAcknowledged: boolean;
	planPersisted: boolean;
	actualLaneLaunchAttempted: boolean;
}): FlowDeskWorkflowDispatchToolResultV1["authority"] {
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
		developerModeAcknowledged: input.developerModeAcknowledged,
		workflowDispatchPlanPersisted: input.planPersisted,
		devModeActualLaneLaunchAttempted: input.actualLaneLaunchAttempted,
	};
}

function blocked(input: {
	config?: FlowDeskWorkflowDispatchToolConfigV1;
	request?: FlowDeskWorkflowDispatchToolRequestV1;
	reason: string;
	workflowId?: string;
	planRevisionId?: string;
	laneId?: string;
	taskId?: string;
	planPersisted?: boolean;
	actualLaneLaunchAttempted?: boolean;
}): FlowDeskWorkflowDispatchToolResultV1 {
	const workflowId = input.workflowId ?? input.request?.workflowId;
	return {
		status: "blocked_before_workflow_dispatch",
		...(input.config?.rootDir === undefined ? {} : { rootDir: input.config.rootDir }),
		...(workflowId === undefined ? {} : { workflowId }),
		...(input.planRevisionId === undefined ? {} : { planRevisionId: input.planRevisionId }),
		...(input.request?.parentSessionId === undefined ? {} : { parentSessionId: input.request.parentSessionId }),
		...(input.laneId === undefined ? {} : { laneId: input.laneId }),
		...(input.taskId === undefined ? {} : { taskId: input.taskId }),
		redactedBlockReason: input.reason,
		summaryForUser: `FlowDesk dev-mode workflow dispatch blocked: ${input.reason}.`,
		safeNextActions: safeNextActions(),
		authority: authority({
			developerModeAcknowledged: input.request?.developerModeAcknowledged === true,
			planPersisted: input.planPersisted === true,
			actualLaneLaunchAttempted: input.actualLaneLaunchAttempted === true,
		}),
	};
}

function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === "object" && value !== null && !Array.isArray(value);
}

function stableToken(value: string, fallback: string): string {
	const token = value.replaceAll(/[^A-Za-z0-9_.:-]/g, "-").slice(0, 96);
	return token.length >= 3 ? token : fallback;
}

function hasForbiddenAuthority(value: unknown): boolean {
	if (typeof value === "string") return forbiddenTextPattern.test(value);
	if (!isRecord(value)) return false;
	for (const [key, entry] of Object.entries(value)) {
		if (authoritySmugglingKeys.has(key) && entry !== false && entry !== undefined)
			return true;
		if (hasForbiddenAuthority(entry)) return true;
	}
	return false;
}

function normalizeRequest(value: unknown): FlowDeskWorkflowDispatchToolRequestV1 {
	if (!isRecord(value)) return {};
	const task = isRecord(value.task) ? value.task : undefined;
	return {
		...(typeof value.workflowId === "string" ? { workflowId: value.workflowId } : {}),
		...(typeof value.goalSummary === "string" ? { goalSummary: value.goalSummary } : {}),
		...(typeof value.parentSessionId === "string" ? { parentSessionId: value.parentSessionId } : {}),
		...(task === undefined
			? {}
			: {
					task: {
						...(typeof task.agentRole === "string" ? { agentRole: task.agentRole } : {}),
						...(typeof task.summary === "string" ? { summary: task.summary } : {}),
						...(typeof task.promptText === "string" ? { promptText: task.promptText } : {}),
						...(typeof task.agentName === "string" ? { agentName: task.agentName } : {}),
						...(typeof task.providerQualifiedModelId === "string" ? { providerQualifiedModelId: task.providerQualifiedModelId } : {}),
						...(typeof task.outputContractRef === "string" ? { outputContractRef: task.outputContractRef } : {}),
					},
				}),
		developerModeAcknowledged: value.developerModeAcknowledged === true,
		allowProviderCall: value.allowProviderCall === true,
		allowActualLaneLaunch: value.allowActualLaneLaunch === true,
	};
}

function terminalEvidencePresent(input: {
	rootDir: string;
	workflowId: string;
	laneId: string;
	taskId: string;
	completed: boolean;
}): boolean {
	const reload = reloadFlowDeskSessionEvidenceV1({
		workflowId: input.workflowId,
		rootDir: input.rootDir,
	});
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

function captureAdvisoryFor(input: {
	rootDir: string;
	workflowId: string;
	laneId: string;
	taskId: string;
}): FlowDeskWorkflowDispatchToolResultV1["captureAdvisory"] | undefined {
	const reload = reloadFlowDeskSessionEvidenceV1({
		workflowId: input.workflowId,
		rootDir: input.rootDir,
	});
	if (!reload.ok || reload.blocked.length > 0) return undefined;
	const entry = reload.entries.find(
		(e) =>
			e.evidenceClass === "task_result" &&
			e.record.lane_id === input.laneId &&
			e.record.task_id === input.taskId,
	);
	if (entry === undefined) return undefined;
	const record = entry.record as Record<string, unknown>;
	return {
		...(typeof record.output_kind === "string" ? { outputKind: record.output_kind } : {}),
		...(typeof record.completion_status === "string" ? { completionStatus: record.completion_status } : {}),
		...(typeof record.finalization_reason === "string" ? { finalizationReason: record.finalization_reason } : {}),
		...(typeof record.looks_like_refusal_or_error === "boolean" ? { looksLikeRefusalOrError: record.looks_like_refusal_or_error } : {}),
	};
}

function planningLabel(value: string): string {
	return value
		.replaceAll(/real\s*-?(?:opencode\s*-?)?dispatch/gi, "explicit dev-mode workflow")
		.replaceAll(/dispatch(?:able|ed|es)?/gi, "workflow")
		.replaceAll(/provider\s*-?call/gi, "provider opt-in")
		.replaceAll(/runtime\s*-?execution/gi, "runtime opt-in")
		.replaceAll(/actual\s*-?lane\s*-?launch|lane\s*-?launch/gi, "lane opt-in")
		.slice(0, 500);
}

export async function executeFlowDeskWorkflowDispatchToolV1(input: {
	config: FlowDeskWorkflowDispatchToolConfigV1;
	request?: FlowDeskWorkflowDispatchToolRequestV1;
	rawInput?: unknown;
	now?: () => Date;
}): Promise<FlowDeskWorkflowDispatchToolResultV1> {
	const request = input.request ?? normalizeRequest(input.rawInput);
	if (typeof input.config.rootDir !== "string" || input.config.rootDir.trim().length === 0)
		return blocked({ config: input.config, request, reason: "workflowDispatch requires a durable state root directory" });
	if (request.developerModeAcknowledged !== true)
		return blocked({ config: input.config, request, reason: "developerModeAcknowledged=true is required" });
	if (request.allowProviderCall !== true || request.allowActualLaneLaunch !== true)
		return blocked({ config: input.config, request, reason: "allowProviderCall=true and allowActualLaneLaunch=true are required" });
	if (hasForbiddenAuthority(input.rawInput ?? request))
		return blocked({ config: input.config, request, reason: "request contains fallback/reselection, write/apply, or authority-smuggling wording" });
	if (typeof request.goalSummary !== "string" || request.goalSummary.trim().length === 0)
		return blocked({ config: input.config, request, reason: "goalSummary is required" });
	if (typeof request.parentSessionId !== "string" || request.parentSessionId.trim().length === 0)
		return blocked({ config: input.config, request, reason: "parentSessionId is required" });
	const taskRequest = request.task;
	if (taskRequest === undefined)
		return blocked({ config: input.config, request, reason: "exactly one task is required" });
	if (typeof taskRequest.promptText !== "string" || taskRequest.promptText.trim().length === 0)
		return blocked({ config: input.config, request, reason: "task.promptText is required" });
	if (typeof taskRequest.agentName !== "string" || taskRequest.agentName.trim().length === 0)
		return blocked({ config: input.config, request, reason: "task.agentName is required" });
	if (typeof taskRequest.providerQualifiedModelId !== "string" || !taskRequest.providerQualifiedModelId.includes("/"))
		return blocked({ config: input.config, request, reason: "task.providerQualifiedModelId must be a concrete provider/model id" });
	if ((taskRequest.outputContractRef ?? "contract-task-result-v1") !== "contract-task-result-v1")
		return blocked({ config: input.config, request, reason: "only outputContractRef=contract-task-result-v1 is supported" });

	const observed = input.now ? input.now() : new Date();
	const stamp = observed.toISOString().replaceAll(/[-:.]/g, "").replace("Z", "Z");
	const workflowId = stableToken(request.workflowId ?? `workflow-dispatch-${stamp}`, `workflow-dispatch-${stamp}`);
	const taskId = stableToken(`task-1-${workflowId}`, "task-1");
	const laneId = stableToken(`lane-${taskId}`, "lane-task-1");
	const planRevisionId = stableToken(`workflow-dispatch-plan-${workflowId}-${stamp}`, `workflow-dispatch-plan-${stamp}`);
	const agentRole = (taskRequest.agentRole ?? "implementation") as FlowDeskAgentRegistryRoleCategoryV1;
	const agentRef = stableToken(
		(taskRequest.agentName.startsWith("agent-") ? taskRequest.agentName : `agent-${taskRequest.agentName}`).toLowerCase(),
		"agent-flowdesk-task",
	);
	const taskSummary = planningLabel(taskRequest.summary ?? "FlowDesk dev-mode task summary not provided.");
	const tasks: FlowDeskWorkflowDispatchTaskV1[] = [
		{
			task_id: taskId,
			title: taskSummary.slice(0, 120) || "FlowDesk dev-mode task",
			summary: taskSummary,
			agent_role: agentRole,
			agent_role_ref: agentRef,
		},
	];
	const selectedAgentRoles: FlowDeskWorkflowDispatchSelectedAgentRoleV1[] = [
		{ agent_role: agentRole, agent_role_ref: agentRef },
	];
	const evaluation = evaluateFlowDeskWorkflowDispatchPlanningV1({
		workflowId,
		planRevisionId,
		requestedGoalSummary: planningLabel(request.goalSummary),
		selectedAgentRoles,
		tasks,
		taskGraphSummary: "Dev-mode one-task workflow graph. Planning evidence remains non-authorizing.",
		modelSelectionDiagnosticLabels: ["dev_mode_one_task"],
	});
	if (!evaluation.ok || evaluation.plan === undefined)
		return blocked({
			config: input.config,
			request,
			reason: evaluation.errors.join(", ") || "workflow dispatch plan validation failed",
			workflowId,
			planRevisionId,
			laneId,
			taskId,
		});
	const prepared = prepareFlowDeskSessionEvidenceWriteIntentV1({
		workflowId,
		evidenceId: planRevisionId,
		record: evaluation.plan as unknown as Record<string, unknown>,
	});
	if (!prepared.ok || prepared.writeIntent === undefined)
		return blocked({
			config: input.config,
			request,
			reason: prepared.errors.join(", ") || "workflow dispatch plan write intent preparation failed",
			workflowId,
			planRevisionId,
			laneId,
			taskId,
		});
	const applied = applyFlowDeskSessionEvidenceWriteIntentsV1(input.config.rootDir, [prepared.writeIntent]);
	if (!applied.ok)
		return blocked({
			config: input.config,
			request,
			reason: applied.errors.join(", ") || "workflow dispatch plan evidence write failed",
			workflowId,
			planRevisionId,
			laneId,
			taskId,
		});
	const planReload = reloadFlowDeskSessionEvidenceV1({ workflowId, rootDir: input.config.rootDir });
	const planPersisted = planReload.ok && planReload.entries.some((entry) => entry.evidenceClass === "workflow_dispatch_plan" && entry.evidenceId === planRevisionId);
	if (!planPersisted)
		return blocked({
			config: input.config,
			request,
			reason: "workflow dispatch plan reload verification failed",
			workflowId,
			planRevisionId,
			laneId,
			taskId,
		});

	const taskResult = await executeFlowDeskAgentTaskV1({
		workflowId,
		taskId,
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
	const terminalVerified = terminalEvidencePresent({
		rootDir: input.config.rootDir,
		workflowId,
		laneId,
		taskId,
		completed,
	});
	if (!terminalVerified)
		return blocked({
			config: input.config,
			request,
			reason: "terminal lifecycle or task evidence reload verification failed",
			workflowId,
			planRevisionId,
			laneId,
			taskId,
			planPersisted: true,
			actualLaneLaunchAttempted: true,
		});
	// Capture/judgement separation: if the lane captured any text we report it as
	// completed (captured) and surface advisory metadata. We do NOT mark the
	// dispatch incomplete just because the captured text "looks like" process
	// notes or lacks a strict format — the coordinator judges substance.
	const captureAdvisory = completed
		? captureAdvisoryFor({ rootDir: input.config.rootDir, workflowId, laneId, taskId })
		: undefined;

	return {
		status: completed ? "workflow_dispatch_completed" : "workflow_dispatch_incomplete",
		rootDir: input.config.rootDir,
		workflowId,
		planRevisionId,
		parentSessionId: request.parentSessionId,
		laneId,
		taskId,
		...(completed ? { taskResultEvidenceId: taskResult.taskResultEvidenceId } : { redactedBlockReason: taskResult.status === "task_failed" ? taskResult.redactedReason : taskResult.status === "task_launched" ? "async mode" : "unknown" }),
		...(captureAdvisory === undefined ? {} : { captureAdvisory }),
		summaryForUser: completed
			? `FlowDesk dev-mode workflow dispatch captured one lane result for ${workflowId} (advisory: ${captureAdvisory?.outputKind ?? "unknown"}${captureAdvisory?.looksLikeRefusalOrError ? ", looks-like-refusal/error" : ""}). The coordinator judges substance. Default Release 1 dispatch authority remains disabled.`
			: `FlowDesk dev-mode workflow dispatch launched one lane but captured no result: ${taskResult.status === "task_failed" ? taskResult.redactedReason : taskResult.status === "task_launched" ? "async lane launched" : "unknown"}. Default Release 1 dispatch authority remains disabled.`,
		safeNextActions: safeNextActions(),
		authority: authority({
			developerModeAcknowledged: true,
			planPersisted: true,
			actualLaneLaunchAttempted: true,
		}),
	};
}
