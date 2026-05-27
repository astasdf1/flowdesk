import {
	applyFlowDeskSessionEvidenceWriteIntentsV1,
	evaluateFlowDeskWorkflowDispatchPlanningV1,
	type FlowDeskAgentRegistryRoleCategoryV1,
	type FlowDeskWorkflowDispatchSelectedAgentRoleV1,
	type FlowDeskWorkflowDispatchTaskV1,
	prepareFlowDeskSessionEvidenceWriteIntentV1,
	reloadFlowDeskSessionEvidenceV1,
} from "@flowdesk/core";

export interface FlowDeskWorkflowDispatchPlanToolConfigV1 {
	rootDir: string;
}

export interface FlowDeskWorkflowDispatchPlanToolTaskRequestV1 {
	agentRole?: string;
	title?: string;
	summary?: string;
	agentRoleRef?: string;
	dependsOnTaskIds?: string[];
}

export interface FlowDeskWorkflowDispatchPlanToolRequestV1 {
	workflowId?: string;
	goalSummary?: string;
	selectedAgentRoles?: string[];
	tasks?: FlowDeskWorkflowDispatchPlanToolTaskRequestV1[];
}

export interface FlowDeskWorkflowDispatchPlanToolResultV1 {
	status:
		| "workflow_dispatch_plan_recorded"
		| "blocked_before_workflow_dispatch_plan";
	rootDir?: string;
	workflowId?: string;
	planRevisionId?: string;
	selectedAgentRoleCount: number;
	taskCount: number;
	writeAttempted: boolean;
	evidenceReloaded: boolean;
	summaryForUser: string;
	redactedBlockReason?: string;
	safeNextActions: readonly ("/flowdesk-status" | "/flowdesk-plan" | "/flowdesk-doctor")[];
	authority: {
		realOpenCodeDispatch: false;
		providerCall: false;
		runtimeExecution: false;
		actualLaneLaunch: false;
		fallbackAuthority: false;
		hardCancelOrNoReplyAuthority: false;
		toolAuthority: false;
		dispatchAuthorityEnabled: false;
		workflowDispatchPlanPersisted: boolean;
	};
}

const authoritySmugglingKeys = new Set([
	"allowProviderCall",
	"actualLaneLaunch",
	"dispatchAuthorityEnabled",
	"fallbackAuthority",
	"providerCall",
	"realOpenCodeDispatch",
	"runtimeExecution",
	"toolAuthority",
]);

function authority(persisted: boolean): FlowDeskWorkflowDispatchPlanToolResultV1["authority"] {
	return {
		realOpenCodeDispatch: false,
		providerCall: false,
		runtimeExecution: false,
		actualLaneLaunch: false,
		fallbackAuthority: false,
		hardCancelOrNoReplyAuthority: false,
		toolAuthority: false,
		dispatchAuthorityEnabled: false,
		workflowDispatchPlanPersisted: persisted,
	};
}

function safeNextActions(): FlowDeskWorkflowDispatchPlanToolResultV1["safeNextActions"] {
	return ["/flowdesk-status", "/flowdesk-plan", "/flowdesk-doctor"];
}

function blocked(input: {
	config: FlowDeskWorkflowDispatchPlanToolConfigV1;
	request?: FlowDeskWorkflowDispatchPlanToolRequestV1;
	reason: string;
	workflowId?: string;
	planRevisionId?: string;
	roleCount?: number;
	taskCount?: number;
}): FlowDeskWorkflowDispatchPlanToolResultV1 {
	const workflowId = input.workflowId ?? input.request?.workflowId;
	return {
		status: "blocked_before_workflow_dispatch_plan",
		rootDir: input.config.rootDir,
		...(workflowId === undefined ? {} : { workflowId }),
		...(input.planRevisionId === undefined
			? {}
			: { planRevisionId: input.planRevisionId }),
		selectedAgentRoleCount: input.roleCount ?? 0,
		taskCount: input.taskCount ?? 0,
		writeAttempted: false,
		evidenceReloaded: false,
		summaryForUser: `FlowDesk workflow dispatch planning blocked: ${input.reason}`,
		redactedBlockReason: input.reason,
		safeNextActions: safeNextActions(),
		authority: authority(false),
	};
}

function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === "object" && value !== null && !Array.isArray(value);
}

function stableToken(value: string, fallback: string): string {
	const token = value.replaceAll(/[^A-Za-z0-9_.:-]/g, "-").slice(0, 96);
	return token.length >= 3 ? token : fallback;
}

function hasAuthoritySmuggling(value: unknown): boolean {
	if (!isRecord(value)) return false;
	for (const [key, entry] of Object.entries(value)) {
		if (authoritySmugglingKeys.has(key) && entry !== false && entry !== undefined)
			return true;
		if (isRecord(entry) && hasAuthoritySmuggling(entry)) return true;
		if (Array.isArray(entry) && entry.some((item) => hasAuthoritySmuggling(item)))
			return true;
	}
	return false;
}

function normalizeRequest(value: unknown): FlowDeskWorkflowDispatchPlanToolRequestV1 {
	if (!isRecord(value)) return {};
	return {
		...(typeof value.workflowId === "string"
			? { workflowId: value.workflowId }
			: {}),
		...(typeof value.goalSummary === "string"
			? { goalSummary: value.goalSummary }
			: {}),
		...(Array.isArray(value.selectedAgentRoles)
			? {
					selectedAgentRoles: value.selectedAgentRoles.filter(
						(role): role is string => typeof role === "string",
					),
				}
			: {}),
		...(Array.isArray(value.tasks)
			? {
					tasks: value.tasks.filter(isRecord).map((task) => ({
						...(typeof task.agentRole === "string"
							? { agentRole: task.agentRole }
							: {}),
						...(typeof task.title === "string" ? { title: task.title } : {}),
						...(typeof task.summary === "string"
							? { summary: task.summary }
							: {}),
						...(typeof task.agentRoleRef === "string"
							? { agentRoleRef: task.agentRoleRef }
							: {}),
						...(Array.isArray(task.dependsOnTaskIds)
							? {
									dependsOnTaskIds: task.dependsOnTaskIds.filter(
										(id): id is string => typeof id === "string",
									),
								}
							: {}),
					})),
				}
			: {}),
	};
}

export function executeFlowDeskWorkflowDispatchPlanToolV1(input: {
	config: FlowDeskWorkflowDispatchPlanToolConfigV1;
	request?: FlowDeskWorkflowDispatchPlanToolRequestV1;
	rawInput?: unknown;
	now?: () => Date;
}): FlowDeskWorkflowDispatchPlanToolResultV1 {
	const request = input.request ?? normalizeRequest(input.rawInput);
	if (typeof input.config.rootDir !== "string" || input.config.rootDir.trim().length === 0)
		return blocked({
			config: input.config,
			request,
			reason: "workflowDispatchPlanTool requires a durable state root directory",
		});
	if (hasAuthoritySmuggling(input.rawInput ?? request))
		return blocked({
			config: input.config,
			request,
			reason: "request contains dispatch/provider/runtime authority fields",
		});
	if (typeof request.goalSummary !== "string" || request.goalSummary.trim().length === 0)
		return blocked({
			config: input.config,
			request,
			reason: "goalSummary is required",
		});
	if (!Array.isArray(request.tasks) || request.tasks.length === 0)
		return blocked({
			config: input.config,
			request,
			reason: "at least one task is required",
		});

	const observed = input.now ? input.now() : new Date();
	const stamp = observed.toISOString().replaceAll(/[-:.]/g, "").replace("Z", "Z");
	const workflowId = stableToken(
		request.workflowId ?? `workflow-dispatch-plan-${stamp}`,
		`workflow-dispatch-plan-${stamp}`,
	);
	const planRevisionId = stableToken(
		`workflow-dispatch-plan-${workflowId}-${stamp}`,
		`workflow-dispatch-plan-${stamp}`,
	);
	const tasks: FlowDeskWorkflowDispatchTaskV1[] = request.tasks.map((task, index) => ({
		task_id: stableToken(`task-${index + 1}-${workflowId}`, `task-${index + 1}`),
		title: task.title ?? `Task ${index + 1}`,
		summary: task.summary ?? "FlowDesk planning task summary not provided.",
		agent_role: (task.agentRole ?? "implementation") as FlowDeskAgentRegistryRoleCategoryV1,
		...(task.agentRoleRef === undefined ? {} : { agent_role_ref: task.agentRoleRef }),
		...(task.dependsOnTaskIds === undefined
			? {}
			: { depends_on_task_ids: task.dependsOnTaskIds }),
	}));
	const selectedRoles = new Set([
		...(request.selectedAgentRoles ?? []),
		...tasks.map((task) => task.agent_role),
	]);
	const selectedAgentRoles: FlowDeskWorkflowDispatchSelectedAgentRoleV1[] = [
		...selectedRoles,
	].map((role) => ({ agent_role: role as FlowDeskAgentRegistryRoleCategoryV1 }));
	const evaluation = evaluateFlowDeskWorkflowDispatchPlanningV1({
		workflowId,
		planRevisionId,
		requestedGoalSummary: request.goalSummary,
		selectedAgentRoles,
		tasks,
		taskGraphSummary: `Planning-only workflow graph with ${tasks.length} task(s).`,
		modelSelectionDiagnosticLabels: ["planning_only_no_provider_call"],
	});
	if (!evaluation.ok || evaluation.plan === undefined)
		return blocked({
			config: input.config,
			request,
			reason: evaluation.errors.join(", ") || "workflow dispatch plan validation failed",
			workflowId,
			planRevisionId,
			roleCount: selectedAgentRoles.length,
			taskCount: tasks.length,
		});

	const reload = reloadFlowDeskSessionEvidenceV1({ workflowId, rootDir: input.config.rootDir });
	if (!reload.ok || reload.blocked.length > 0)
		return blocked({
			config: input.config,
			request,
			reason: "session evidence reload failed before workflow dispatch plan write",
			workflowId,
			planRevisionId,
			roleCount: selectedAgentRoles.length,
			taskCount: tasks.length,
		});
	if (reload.entries.some((entry) => entry.evidenceId === planRevisionId))
		return blocked({
			config: input.config,
			request,
			reason: "workflow dispatch plan evidence id already exists",
			workflowId,
			planRevisionId,
			roleCount: selectedAgentRoles.length,
			taskCount: tasks.length,
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
			roleCount: selectedAgentRoles.length,
			taskCount: tasks.length,
		});
	const applied = applyFlowDeskSessionEvidenceWriteIntentsV1(input.config.rootDir, [
		prepared.writeIntent,
	]);
	if (!applied.ok)
		return blocked({
			config: input.config,
			request,
			reason: applied.errors.join(", ") || "workflow dispatch plan evidence write failed",
			workflowId,
			planRevisionId,
			roleCount: selectedAgentRoles.length,
			taskCount: tasks.length,
		});
	const reloadAfter = reloadFlowDeskSessionEvidenceV1({
		workflowId,
		rootDir: input.config.rootDir,
	});
	const persisted =
		reloadAfter.ok &&
		reloadAfter.entries.some(
			(entry) =>
				entry.evidenceClass === "workflow_dispatch_plan" &&
				entry.evidenceId === planRevisionId,
		);
	if (!persisted)
		return blocked({
			config: input.config,
			request,
			reason: "workflow dispatch plan reload verification failed",
			workflowId,
			planRevisionId,
			roleCount: selectedAgentRoles.length,
			taskCount: tasks.length,
		});

	return {
		status: "workflow_dispatch_plan_recorded",
		rootDir: input.config.rootDir,
		workflowId,
		planRevisionId,
		selectedAgentRoleCount: selectedAgentRoles.length,
		taskCount: tasks.length,
		writeAttempted: true,
		evidenceReloaded: true,
		summaryForUser: `FlowDesk workflow dispatch plan recorded for ${selectedAgentRoles.length} role(s) and ${tasks.length} task(s). Planning only: no dispatch, provider call, runtime execution, lane launch, or fallback authority was opened.`,
		safeNextActions: safeNextActions(),
		authority: authority(true),
	};
}
