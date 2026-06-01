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
	parentSessionRef?: string;
	state?: string;
	classification: FlowDeskTuiSubtaskActivityClassificationV1;
	progressPhase?: string;
	startedAt?: string;
	lastObservedAt?: string;
	taskSummary?: string;
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
	parentSessionRef?: string;
	expected: number;
	completed: number;
	taskResultRefs: readonly string[];
	taskSummaries: readonly string[];
	nextActionKind?: "synthesis";
	nextActionAvailable: boolean;
}

export interface FlowDeskTuiAutoNextReadyViewV1 {
	status: "loaded" | "missing" | "stale" | "blocked";
	observedAt: string;
	rootDir: string;
	workflows: readonly FlowDeskTuiAutoNextReadyWorkflowV1[];
	redactedReason?: string;
	safeNextActions: readonly ("/flowdesk-status" | "/flowdesk-export-debug" | "/flowdesk-doctor")[];
}

export interface FlowDeskTuiLatestSynthesisRowV1 {
	workflowId: string;
	synthesisId: string;
	tasksSummarized: number;
	conflictDetected: boolean;
	summaryPreview: string;
	observedAt: string;
}

export interface FlowDeskTuiLatestSynthesisViewV1 {
	status: "loaded" | "missing" | "stale" | "blocked";
	observedAt: string;
	rootDir: string;
	syntheses: readonly FlowDeskTuiLatestSynthesisRowV1[];
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

function sessionRefMatches(rowParentSessionRef: string | undefined, currentParentSessionRef: string | undefined): boolean {
	if (currentParentSessionRef === undefined || currentParentSessionRef.length === 0) return true;
	if (rowParentSessionRef === undefined || rowParentSessionRef.length === 0) return false;
	if (rowParentSessionRef === currentParentSessionRef) return true;
	if (!currentParentSessionRef.startsWith("ses-") && rowParentSessionRef === `ses-${currentParentSessionRef}`) return true;
	if (!rowParentSessionRef.startsWith("ses-") && `ses-${rowParentSessionRef}` === currentParentSessionRef) return true;
	return false;
}

function rowsForCurrentSession<T extends { parentSessionRef?: string }>(
	rows: readonly T[],
	currentParentSessionRef: string | undefined,
): readonly T[] {
	if (currentParentSessionRef === undefined || currentParentSessionRef.length === 0) return rows;
	const scoped = rows.filter((row) => sessionRefMatches(row.parentSessionRef, currentParentSessionRef));
	// When OpenCode tells us which session owns this sidebar slot, fail closed to
	// that session. Falling back to global cached rows leaks subtasks from other
	// chats into the current sidebar and also hides parent-binding regressions.
	return scoped;
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
		...(stringField(record, "parentSessionRef") === undefined ? {} : { parentSessionRef: stringField(record, "parentSessionRef") }),
		...(stringField(record, "state") === undefined ? {} : { state: stringField(record, "state") }),
		classification,
		...(stringField(record, "progressPhase") === undefined ? {} : { progressPhase: stringField(record, "progressPhase") }),
		...(stringField(record, "startedAt") === undefined ? {} : { startedAt: stringField(record, "startedAt") }),
		...(stringField(record, "lastObservedAt") === undefined ? {} : { lastObservedAt: stringField(record, "lastObservedAt") }),
		...(stringField(record, "taskSummary") === undefined ? {} : { taskSummary: stringField(record, "taskSummary")?.slice(0, 20) }),
		recoveryActionRefs,
	};
}

export function loadFlowDeskTuiSubtaskActivityViewV1(input: {
	rootDir?: string;
	currentParentSessionRef?: string;
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
		const loadedRows = Array.isArray(cache.rows)
			? cache.rows.filter(isRecord).map(rowFromRecord).filter((row): row is FlowDeskTuiSubtaskActivityRowV1 => row !== undefined)
			: [];
		const rows = rowsForCurrentSession(loadedRows, input.currentParentSessionRef);
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
	currentParentSessionRef?: string;
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
		const loadedWorkflows = Array.isArray(cache.workflows)
			? cache.workflows.filter(isRecord).map((workflow): FlowDeskTuiAutoNextReadyWorkflowV1 | undefined => {
				const workflowId = stringField(workflow, "workflowId");
				if (workflowId === undefined) return undefined;
				const parentSessionRef = stringField(workflow, "parentSessionRef");
				const aggregate = isRecord(workflow.laneProgressAggregate) ? workflow.laneProgressAggregate : {};
				const expected = typeof aggregate.expected === "number" && Number.isFinite(aggregate.expected) ? aggregate.expected : 0;
				const completed = typeof aggregate.normalCompleted === "number" && Number.isFinite(aggregate.normalCompleted) ? aggregate.normalCompleted : 0;
				const taskResultRefs = Array.isArray(workflow.taskResultRefs) ? workflow.taskResultRefs.filter((value): value is string => typeof value === "string") : [];
				const taskSummaries = Array.isArray(workflow.taskSummaries) ? workflow.taskSummaries.filter((value): value is string => typeof value === "string" && value.length > 0).map((value) => value.slice(0, 10)) : [];
				const nextActionKindRaw = typeof workflow.nextActionKind === "string" ? workflow.nextActionKind : aggregate.nextActionKind;
				const nextActionKind = nextActionKindRaw === "synthesis" ? "synthesis" as const : undefined;
				const nextActionAvailable = workflow.nextActionAvailable === true || aggregate.nextActionAvailable === true || nextActionKind !== undefined;
				return { workflowId, ...(parentSessionRef === undefined ? {} : { parentSessionRef }), expected, completed, taskResultRefs, taskSummaries, nextActionAvailable, ...(nextActionKind === undefined ? {} : { nextActionKind }) };
			}).filter((workflow): workflow is FlowDeskTuiAutoNextReadyWorkflowV1 => workflow !== undefined)
			: [];
		const workflows = rowsForCurrentSession(loadedWorkflows, input.currentParentSessionRef);
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

export function loadFlowDeskTuiLatestSynthesisViewV1(input: {
	rootDir?: string;
	now?: () => Date;
} = {}): FlowDeskTuiLatestSynthesisViewV1 {
	const observedAt = (input.now ? input.now() : new Date()).toISOString();
	const nowMs = Date.parse(observedAt);
	const rootDir = safeRootDir(input.rootDir);
	try {
		const cache = JSON.parse(readFileSync(join(rootDir, ".flowdesk", "ui", "latest-synthesis.json"), "utf8")) as unknown;
		if (!isRecord(cache) || cache.schema_version !== "flowdesk.latest_synthesis_cache.v1") {
			return { status: "missing", observedAt, rootDir, syntheses: [], redactedReason: "latest synthesis cache missing", safeNextActions: ["/flowdesk-status", "/flowdesk-export-debug", "/flowdesk-doctor"] };
		}
		const expiresAtMs = typeof cache.expires_at === "string" ? Date.parse(cache.expires_at) : Number.NaN;
		const syntheses = Array.isArray(cache.syntheses)
			? cache.syntheses.filter(isRecord).map((row): FlowDeskTuiLatestSynthesisRowV1 | undefined => {
				const workflowId = stringField(row, "workflowId");
				const synthesisId = stringField(row, "synthesisId");
				const summaryPreview = stringField(row, "summaryPreview");
				const rowObservedAt = stringField(row, "observedAt");
				if (workflowId === undefined || synthesisId === undefined || summaryPreview === undefined || rowObservedAt === undefined) return undefined;
				return {
					workflowId,
					synthesisId,
					tasksSummarized: typeof row.tasksSummarized === "number" && Number.isFinite(row.tasksSummarized) ? row.tasksSummarized : 0,
					conflictDetected: row.conflictDetected === true,
					summaryPreview: summaryPreview.slice(0, 80),
					observedAt: rowObservedAt,
				};
			}).filter((row): row is FlowDeskTuiLatestSynthesisRowV1 => row !== undefined)
			: [];
		return {
			status: Number.isFinite(expiresAtMs) && expiresAtMs <= nowMs ? "stale" : "loaded",
			observedAt: typeof cache.observed_at === "string" ? cache.observed_at : observedAt,
			rootDir,
			syntheses,
			...(syntheses.length === 0 ? { redactedReason: "no synthesis previews cached" } : {}),
			safeNextActions: ["/flowdesk-status", "/flowdesk-export-debug", "/flowdesk-doctor"],
		};
	} catch {
		return { status: "missing", observedAt, rootDir, syntheses: [], redactedReason: "latest synthesis cache unavailable", safeNextActions: ["/flowdesk-status", "/flowdesk-export-debug", "/flowdesk-doctor"] };
	}
}

function shortTaskLabel(row: FlowDeskTuiSubtaskActivityRowV1): string {
	if (row.taskSummary !== undefined && row.taskSummary.trim().length > 0) {
		return row.taskSummary.trim().slice(0, 20);
	}
	const source = row.taskId ?? row.laneId;
	const compact = source.replace(/^task-/, "").replace(/^lane-task-/, "");
	return `task ${compact.length <= 12 ? compact : compact.slice(-12)}`;
}

function shortStartTime(row: FlowDeskTuiSubtaskActivityRowV1): string {
	const source = row.startedAt ?? row.lastObservedAt;
	if (source === undefined) return "--:--";
	const parsed = Date.parse(source);
	if (!Number.isFinite(parsed)) return "--:--";
	const date = new Date(parsed);
	return `${String(date.getHours()).padStart(2, "0")}:${String(date.getMinutes()).padStart(2, "0")}`;
}

function displayState(row: FlowDeskTuiSubtaskActivityRowV1): string {
	if (row.progressPhase === "awaiting_permission") return "!";
	if (row.classification === "stalled") return "!!";
	if (row.classification === "progressing_late") return "!";
	if (row.classification === "inconsistent_finalizing_without_terminal") return "!";
	if (row.state === "invocation_failed" || row.state === "task_failed") return "✕";
	if (row.state === "task_result" && row.classification === "terminal") return "✓";
	if (row.progressPhase === "finalizing") return "…";
	if (row.state === "running" || row.classification === "progressing_normal") return "…";
	return "?";
}

function rowSortRank(row: FlowDeskTuiSubtaskActivityRowV1): number {
	if (row.progressPhase === "awaiting_permission") return 0;
	if (row.classification === "stalled") return 1;
	if (row.classification === "progressing_late") return 2;
	if (row.progressPhase === "finalizing") return 3;
	if (row.state === "running" || row.classification === "progressing_normal") return 4;
	if (row.state === "invocation_failed" || row.state === "task_failed") return 5;
	if (row.state === "task_result" && row.classification === "terminal") return 6;
	return 7;
}

function observedAtMs(row: FlowDeskTuiSubtaskActivityRowV1): number {
	if (row.lastObservedAt === undefined) return 0;
	const parsed = Date.parse(row.lastObservedAt);
	return Number.isFinite(parsed) ? parsed : 0;
}

function sortedRows(rows: readonly FlowDeskTuiSubtaskActivityRowV1[]): readonly FlowDeskTuiSubtaskActivityRowV1[] {
	return [...rows].sort((left, right) => {
		const byObservedAt = observedAtMs(right) - observedAtMs(left);
		if (byObservedAt !== 0) return byObservedAt;
		const byRank = rowSortRank(left) - rowSortRank(right);
		if (byRank !== 0) return byRank;
		return (right.taskId ?? right.laneId).localeCompare(left.taskId ?? left.laneId);
	});
}

export function formatFlowDeskTuiSubtaskActivityCompactLines(
	view: FlowDeskTuiSubtaskActivityViewV1,
	limit = 5,
): readonly string[] {
	if (view.rows.length === 0) {
		if (view.status === "loaded") return ["Subtasks: none"];
		if (view.status === "stale") return ["Subtasks: cache stale; run /flowdesk-status"];
		return ["Subtasks: run /flowdesk-status"];
	}
	const lines = [view.status === "stale" ? "Subtasks (stale):" : "Subtasks:"];
	const orderedRows = sortedRows(view.rows);
	for (const row of orderedRows.slice(0, Math.max(1, limit))) {
		lines.push(`${displayState(row)} ${shortStartTime(row)} ${shortTaskLabel(row)}`);
	}
	return lines;
}

export function formatFlowDeskTuiAutoNextReadyCompactLines(
	view: FlowDeskTuiAutoNextReadyViewV1,
	limit = 2,
): readonly string[] {
	return [];
}

export function formatFlowDeskTuiLatestSynthesisCompactLines(
	view: FlowDeskTuiLatestSynthesisViewV1,
	limit = 2,
): readonly string[] {
	if (view.syntheses.length === 0) return [];
	const lines = ["Synthesis:"];
	for (const row of view.syntheses.slice(0, Math.max(1, limit))) {
		const prefix = row.conflictDetected ? "!" : "✓";
		const preview = row.summaryPreview.length > 28 ? `${row.summaryPreview.slice(0, 27)}…` : row.summaryPreview;
		lines.push(`${prefix} ${row.tasksSummarized} task ${preview}`);
	}
	return lines;
}
