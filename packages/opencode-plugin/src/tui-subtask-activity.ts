import { readFileSync } from "node:fs";
import { join } from "node:path";

export type FlowDeskTuiSubtaskActivityClassificationV1 =
	| "progressing_normal"
	| "progressing_late"
	| "stalled"
	| "terminal"
	| "inconsistent_finalizing_without_terminal"
	| "unknown";

export interface FlowDeskTuiSubtaskActivityRowV1 {
	workflowId: string;
	laneId: string;
	taskId?: string;
	state?: string;
	classification: FlowDeskTuiSubtaskActivityClassificationV1;
	progressPhase?: string;
	lastObservedAt?: string;
	recoveryActionRefs: readonly string[];
}

export interface FlowDeskTuiSubtaskActivityViewV1 {
	status: "loaded" | "missing" | "stale" | "blocked";
	observedAt: string;
	rootDir: string;
	rows: readonly FlowDeskTuiSubtaskActivityRowV1[];
	redactedReason?: string;
	safeNextActions: readonly ("/flowdesk-status" | "/flowdesk-export-debug" | "/flowdesk-doctor")[];
}

export interface FlowDeskTuiAutoNextReadyWorkflowV1 {
	workflowId: string;
	expected: number;
	completed: number;
	taskResultRefs: readonly string[];
}

export interface FlowDeskTuiAutoNextReadyViewV1 {
	status: "loaded" | "missing" | "stale" | "blocked";
	observedAt: string;
	rootDir: string;
	workflows: readonly FlowDeskTuiAutoNextReadyWorkflowV1[];
	redactedReason?: string;
	safeNextActions: readonly ("/flowdesk-status" | "/flowdesk-export-debug" | "/flowdesk-doctor")[];
}

function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === "object" && value !== null && !Array.isArray(value);
}

function safeRootDir(value: string | undefined): string {
	if (typeof value === "string" && value.trim().length > 0) return value;
	const home = process.env.HOME;
	return typeof home === "string" && home.length > 0 ? join(home, ".flowdesk") : ".flowdesk";
}

function isClassification(value: unknown): value is FlowDeskTuiSubtaskActivityClassificationV1 {
	return (
		value === "progressing_normal" ||
		value === "progressing_late" ||
		value === "stalled" ||
		value === "terminal" ||
		value === "inconsistent_finalizing_without_terminal" ||
		value === "unknown"
	);
}

function stringField(record: Record<string, unknown>, key: string): string | undefined {
	const value = record[key];
	return typeof value === "string" && value.length > 0 ? value : undefined;
}

function rowFromRecord(record: Record<string, unknown>): FlowDeskTuiSubtaskActivityRowV1 | undefined {
	const workflowId = stringField(record, "workflowId");
	const laneId = stringField(record, "laneId");
	if (workflowId === undefined || laneId === undefined) return undefined;
	const classification = isClassification(record.classification) ? record.classification : "unknown";
	const recoveryActionRefs = Array.isArray(record.recoveryActionRefs)
		? record.recoveryActionRefs.filter((value): value is string => typeof value === "string")
		: ["/flowdesk-status", "/flowdesk-export-debug"];
	return {
		workflowId,
		laneId,
		...(stringField(record, "taskId") === undefined ? {} : { taskId: stringField(record, "taskId") }),
		...(stringField(record, "state") === undefined ? {} : { state: stringField(record, "state") }),
		classification,
		...(stringField(record, "progressPhase") === undefined ? {} : { progressPhase: stringField(record, "progressPhase") }),
		...(stringField(record, "lastObservedAt") === undefined ? {} : { lastObservedAt: stringField(record, "lastObservedAt") }),
		recoveryActionRefs,
	};
}

export function loadFlowDeskTuiSubtaskActivityViewV1(input: {
	rootDir?: string;
	now?: () => Date;
} = {}): FlowDeskTuiSubtaskActivityViewV1 {
	const observedAt = (input.now ? input.now() : new Date()).toISOString();
	const nowMs = Date.parse(observedAt);
	const rootDir = safeRootDir(input.rootDir);
	try {
		const cache = JSON.parse(readFileSync(join(rootDir, ".flowdesk", "ui", "subtask-activity-sidebar.json"), "utf8")) as unknown;
		if (!isRecord(cache) || cache.schema_version !== "flowdesk.subtask_activity_sidebar_cache.v1") {
			return {
				status: "missing",
				observedAt,
				rootDir,
				rows: [],
				redactedReason: "subtask activity sidebar cache missing",
				safeNextActions: ["/flowdesk-status", "/flowdesk-export-debug", "/flowdesk-doctor"],
			};
		}
		const expiresAtMs = typeof cache.expires_at === "string" ? Date.parse(cache.expires_at) : Number.NaN;
		const rows = Array.isArray(cache.rows)
			? cache.rows.filter(isRecord).map(rowFromRecord).filter((row): row is FlowDeskTuiSubtaskActivityRowV1 => row !== undefined)
			: [];
		return {
			status: Number.isFinite(expiresAtMs) && expiresAtMs <= nowMs ? "stale" : "loaded",
			observedAt: typeof cache.observed_at === "string" ? cache.observed_at : observedAt,
			rootDir,
			rows,
			...(rows.length === 0 ? { redactedReason: "no subtask activity rows cached" } : {}),
			safeNextActions: ["/flowdesk-status", "/flowdesk-export-debug", "/flowdesk-doctor"],
		};
	} catch {
		return {
			status: "missing",
			observedAt,
			rootDir,
			rows: [],
			redactedReason: "subtask activity sidebar cache unavailable",
			safeNextActions: ["/flowdesk-status", "/flowdesk-export-debug", "/flowdesk-doctor"],
		};
	}
}

export function loadFlowDeskTuiAutoNextReadyViewV1(input: {
	rootDir?: string;
	now?: () => Date;
} = {}): FlowDeskTuiAutoNextReadyViewV1 {
	const observedAt = (input.now ? input.now() : new Date()).toISOString();
	const nowMs = Date.parse(observedAt);
	const rootDir = safeRootDir(input.rootDir);
	try {
		const cache = JSON.parse(readFileSync(join(rootDir, ".flowdesk", "ui", "auto-next-ready.json"), "utf8")) as unknown;
		if (!isRecord(cache) || cache.schema_version !== "flowdesk.auto_next_ready_cache.v1") {
			return { status: "missing", observedAt, rootDir, workflows: [], redactedReason: "auto-next ready cache missing", safeNextActions: ["/flowdesk-status", "/flowdesk-export-debug", "/flowdesk-doctor"] };
		}
		const expiresAtMs = typeof cache.expires_at === "string" ? Date.parse(cache.expires_at) : Number.NaN;
		const workflows = Array.isArray(cache.workflows)
			? cache.workflows.filter(isRecord).map((workflow): FlowDeskTuiAutoNextReadyWorkflowV1 | undefined => {
				const workflowId = stringField(workflow, "workflowId");
				if (workflowId === undefined) return undefined;
				const aggregate = isRecord(workflow.laneProgressAggregate) ? workflow.laneProgressAggregate : {};
				const expected = typeof aggregate.expected === "number" && Number.isFinite(aggregate.expected) ? aggregate.expected : 0;
				const completed = typeof aggregate.normalCompleted === "number" && Number.isFinite(aggregate.normalCompleted) ? aggregate.normalCompleted : 0;
				const taskResultRefs = Array.isArray(workflow.taskResultRefs) ? workflow.taskResultRefs.filter((value): value is string => typeof value === "string") : [];
				return { workflowId, expected, completed, taskResultRefs };
			}).filter((workflow): workflow is FlowDeskTuiAutoNextReadyWorkflowV1 => workflow !== undefined)
			: [];
		return {
			status: Number.isFinite(expiresAtMs) && expiresAtMs <= nowMs ? "stale" : "loaded",
			observedAt: typeof cache.observed_at === "string" ? cache.observed_at : observedAt,
			rootDir,
			workflows,
			...(workflows.length === 0 ? { redactedReason: "no auto-next ready workflows cached" } : {}),
			safeNextActions: ["/flowdesk-status", "/flowdesk-export-debug", "/flowdesk-doctor"],
		};
	} catch {
		return { status: "missing", observedAt, rootDir, workflows: [], redactedReason: "auto-next ready cache unavailable", safeNextActions: ["/flowdesk-status", "/flowdesk-export-debug", "/flowdesk-doctor"] };
	}
}

function shortTaskLabel(row: FlowDeskTuiSubtaskActivityRowV1): string {
	const source = row.taskId ?? row.laneId;
	const compact = source.replace(/^task-/, "").replace(/^lane-task-/, "");
	return `task ${compact.length <= 12 ? compact : compact.slice(-12)}`;
}

function actionLabels(actions: readonly string[]): string {
	return actions.map((action) => action.replace(/^\/flowdesk-export-debug$/, "export").replace(/^\/flowdesk-/, "")).join("|");
}

function displayState(row: FlowDeskTuiSubtaskActivityRowV1): string {
	if (row.progressPhase === "awaiting_permission") return "! Needs permission";
	if (row.classification === "stalled") return "!! Stalled";
	if (row.classification === "progressing_late") return "! Slow";
	if (row.classification === "inconsistent_finalizing_without_terminal") return "! Needs check";
	if (row.state === "invocation_failed" || row.state === "task_failed") return "✕ Failed";
	if (row.state === "task_result" && row.classification === "terminal") return "✓ Done";
	if (row.progressPhase === "finalizing") return "… Finalizing";
	if (row.state === "running" || row.classification === "progressing_normal") return "… Running";
	return "? Unknown";
}

export function formatFlowDeskTuiSubtaskActivityCompactLines(
	view: FlowDeskTuiSubtaskActivityViewV1,
	limit = 3,
): readonly string[] {
	if (view.rows.length === 0) return [view.status === "loaded" ? "Subtasks: none" : "Subtasks: run /flowdesk-status"];
	const lines = ["Subtasks:"];
	for (const row of view.rows.slice(0, Math.max(1, limit))) {
		lines.push(`${displayState(row)} ${shortTaskLabel(row)} [${actionLabels(row.recoveryActionRefs)}]`);
	}
	if (view.rows.length > limit) lines.push(`… ${view.rows.length - limit} more`);
	return lines;
}

export function formatFlowDeskTuiAutoNextReadyCompactLines(
	view: FlowDeskTuiAutoNextReadyViewV1,
	limit = 2,
): readonly string[] {
	if (view.workflows.length === 0) return [];
	const lines = ["Auto-next ready:"];
	for (const workflow of view.workflows.slice(0, Math.max(1, limit))) {
		const workflowLabel = workflow.workflowId.length <= 24 ? workflow.workflowId : `…${workflow.workflowId.slice(-23)}`;
		lines.push(`✓ ${workflow.completed}/${workflow.expected} done ${workflowLabel} [status|export]`);
	}
	if (view.workflows.length > limit) lines.push(`… ${view.workflows.length - limit} more ready`);
	return lines;
}
