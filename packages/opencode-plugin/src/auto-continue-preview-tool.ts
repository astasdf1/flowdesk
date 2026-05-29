import { reloadFlowDeskSessionEvidenceV1 } from "@flowdesk/core";

export interface FlowDeskAutoContinuePreviewToolConfigV1 {
	rootDir: string;
}

export interface FlowDeskAutoContinuePreviewToolRequestV1 {
	workflowId?: string;
	maxSteps?: number;
}

export interface FlowDeskAutoContinuePreviewToolResultV1 {
	status: "auto_continue_preview_ready" | "blocked_before_auto_continue_preview";
	workflowId?: string;
	nextTaskId?: string;
	nextTaskTitle?: string;
	nextTaskSummary?: string;
	pendingTaskCount: number;
	completedTaskCount: number;
	maxSteps: number;
	summaryForUser: string;
	redactedBlockReason?: string;
	safeNextActions: readonly ("/flowdesk-status" | "/flowdesk-plan" | "/flowdesk-doctor" | "/flowdesk-run")[];
	authority: {
		realOpenCodeDispatch: false;
		providerCall: false;
		runtimeExecution: false;
		actualLaneLaunch: false;
		fallbackAuthority: false;
		hardCancelOrNoReplyAuthority: false;
		toolAuthority: false;
		autoContinuationExecuted: false;
		previewOnly: true;
	};
}

const SAFE_AUTHORITY = {
	realOpenCodeDispatch: false,
	providerCall: false,
	runtimeExecution: false,
	actualLaneLaunch: false,
	fallbackAuthority: false,
	hardCancelOrNoReplyAuthority: false,
	toolAuthority: false,
	autoContinuationExecuted: false,
	previewOnly: true,
} as const;

function safeNextActions(): FlowDeskAutoContinuePreviewToolResultV1["safeNextActions"] {
	return ["/flowdesk-status", "/flowdesk-plan", "/flowdesk-doctor", "/flowdesk-run"];
}

function blocked(input: {
	workflowId?: string;
	reason: string;
	maxSteps: number;
}): FlowDeskAutoContinuePreviewToolResultV1 {
	return {
		status: "blocked_before_auto_continue_preview",
		...(input.workflowId === undefined ? {} : { workflowId: input.workflowId }),
		pendingTaskCount: 0,
		completedTaskCount: 0,
		maxSteps: input.maxSteps,
		redactedBlockReason: input.reason,
		summaryForUser: `FlowDesk auto-continue preview blocked: ${input.reason}`,
		safeNextActions: safeNextActions(),
		authority: SAFE_AUTHORITY,
	};
}

function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === "object" && value !== null && !Array.isArray(value);
}

function stringField(record: Record<string, unknown>, key: string): string | undefined {
	const value = record[key];
	return typeof value === "string" && value.trim().length > 0 ? value : undefined;
}

function clampText(value: string | undefined, max = 160): string | undefined {
	if (value === undefined) return undefined;
	const compact = value.replace(/\s+/g, " ").trim();
	if (compact.length === 0) return undefined;
	return compact.length > max ? `${compact.slice(0, max - 1)}…` : compact;
}

function maxStepsFrom(value: number | undefined): number {
	if (typeof value !== "number" || !Number.isFinite(value) || value <= 0) return 1;
	return Math.min(5, Math.max(1, Math.floor(value)));
}

export function executeFlowDeskAutoContinuePreviewToolV1(input: {
	config: FlowDeskAutoContinuePreviewToolConfigV1;
	request?: FlowDeskAutoContinuePreviewToolRequestV1;
}): FlowDeskAutoContinuePreviewToolResultV1 {
	const workflowId = input.request?.workflowId?.trim();
	const maxSteps = maxStepsFrom(input.request?.maxSteps);
	if (!workflowId) return blocked({ reason: "workflowId is required", maxSteps });
	if (!input.config.rootDir?.trim()) return blocked({ workflowId, reason: "durable state root is required", maxSteps });

	const reload = reloadFlowDeskSessionEvidenceV1({ rootDir: input.config.rootDir, workflowId });
	if (!reload.ok) return blocked({ workflowId, reason: "session evidence reload failed", maxSteps });
	const planEntries = reload.entries.filter((entry) => entry.evidenceClass === "workflow_dispatch_plan");
	const latestPlan = planEntries[planEntries.length - 1];
	if (latestPlan === undefined) return blocked({ workflowId, reason: "no workflow_dispatch_plan evidence found", maxSteps });
	const tasksRaw = latestPlan.record.tasks;
	if (!Array.isArray(tasksRaw)) return blocked({ workflowId, reason: "workflow dispatch plan has no task list", maxSteps });
	const tasks: Array<{ taskId: string; title?: string; summary?: string }> = [];
	for (const rawTask of tasksRaw) {
		if (!isRecord(rawTask)) continue;
		const taskId = stringField(rawTask, "task_id");
		if (taskId === undefined) continue;
		const title = clampText(stringField(rawTask, "title"), 96);
		const summary = clampText(stringField(rawTask, "summary"), 180);
		tasks.push({
			taskId,
			...(title === undefined ? {} : { title }),
			...(summary === undefined ? {} : { summary }),
		});
	}
	if (tasks.length === 0) return blocked({ workflowId, reason: "workflow dispatch plan has no valid tasks", maxSteps });

	const completedTaskIds = new Set<string>();
	for (const entry of reload.entries) {
		if (entry.evidenceClass !== "task_result") continue;
		const taskId = stringField(entry.record, "task_id");
		if (taskId !== undefined) completedTaskIds.add(taskId);
	}
	const pending = tasks.filter((task) => !completedTaskIds.has(task.taskId));
	if (pending.length === 0) {
		return {
			status: "auto_continue_preview_ready",
			workflowId,
			pendingTaskCount: 0,
			completedTaskCount: completedTaskIds.size,
			maxSteps,
			summaryForUser: "FlowDesk auto-continue preview: no pending planned tasks remain.",
			safeNextActions: ["/flowdesk-status", "/flowdesk-doctor"],
			authority: SAFE_AUTHORITY,
		};
	}
	const next = pending[0];
	return {
		status: "auto_continue_preview_ready",
		workflowId,
		nextTaskId: next.taskId,
		...(next.title === undefined ? {} : { nextTaskTitle: next.title }),
		...(next.summary === undefined ? {} : { nextTaskSummary: next.summary }),
		pendingTaskCount: pending.length,
		completedTaskCount: completedTaskIds.size,
		maxSteps,
		summaryForUser: `FlowDesk auto-continue preview: next planned task is ${next.taskId}${next.title === undefined ? "" : ` (${next.title})`}. Preview only: no provider call, dispatch, lane launch, fallback, or TUI action was executed.`,
		safeNextActions: safeNextActions(),
		authority: SAFE_AUTHORITY,
	};
}
