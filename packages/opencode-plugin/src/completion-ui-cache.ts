import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import {
	reloadFlowDeskSessionEvidenceV1,
	type FlowDeskSessionEvidenceReloadEntryV1,
} from "@flowdesk/core";

type UiRow = {
	workflowId: string;
	laneId: string;
	taskId?: string;
	state?: string;
	classification: "progressing_normal" | "progressing_late" | "stalled" | "terminal" | "unknown";
	progressPhase?: string;
	lastObservedAt?: string;
	completionStatus?: string;
	outputKind?: string;
	usableForSynthesis?: boolean;
	taskSummary?: string;
	recoveryActionRefs: readonly string[];
	statusCommandRef: "/flowdesk-status";
	debugCommandRef: "/flowdesk-export-debug";
};

type SynthesisCacheRow = {
	workflowId: string;
	synthesisId: string;
	tasksSummarized: number;
	conflictDetected: boolean;
	summaryPreview: string;
	observedAt: string;
};

const FORBIDDEN_SUMMARY_MARKERS = /system prompt|provider payload|raw token|hidden injection|opencode\srun|dispatch|fallback|reselect/i;

const GENERIC_TASK_SUMMARY_WORDS = new Set([
	"architecture",
	"architectural",
	"verification",
	"implementation",
	"planning",
	"subtask",
	"task",
	"agent",
	"lane",
	"for",
	"flowdesk",
	"repo",
	"repository",
	"please",
	"goal",
	"inspect",
	"assess",
	"propose",
]);

function getString(record: Record<string, unknown>, key: string): string | undefined {
	const value = record[key];
	return typeof value === "string" && value.length > 0 ? value : undefined;
}

function latestByLane(entries: readonly FlowDeskSessionEvidenceReloadEntryV1[], evidenceClass: string): Map<string, FlowDeskSessionEvidenceReloadEntryV1> {
	const byLane = new Map<string, FlowDeskSessionEvidenceReloadEntryV1>();
	for (const entry of entries) {
		if (entry.evidenceClass !== evidenceClass) continue;
		const laneId = getString(entry.record, "lane_id");
		if (laneId === undefined) continue;
		byLane.set(laneId, entry);
	}
	return byLane;
}

function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === "object" && value !== null && !Array.isArray(value);
}

function readJsonRecord(path: string): Record<string, unknown> | undefined {
	try {
		if (!existsSync(path)) return undefined;
		const parsed = JSON.parse(readFileSync(path, "utf8")) as unknown;
		return isRecord(parsed) ? parsed : undefined;
	} catch {
		return undefined;
	}
}

function observedTime(value: unknown): number {
	return typeof value === "string" && Number.isFinite(Date.parse(value)) ? Date.parse(value) : 0;
}

function compactTaskSummary(value: string | undefined): string | undefined {
	if (value === undefined) return undefined;
	const firstSentence = value
		.replace(/Respond with exactly[\s\S]*$/i, "")
		.replace(/Return only[\s\S]*$/i, "")
		.replace(/\s+/g, " ")
		.trim();
	const source = firstSentence.length > 0 ? firstSentence : value.replace(/\s+/g, " ").trim();
	if (FORBIDDEN_SUMMARY_MARKERS.test(source)) return undefined;
	const words = source.match(/[\p{L}\p{N}][\p{L}\p{N}_-]*/gu) ?? [];
	const usefulWords = words.filter((word) => !GENERIC_TASK_SUMMARY_WORDS.has(word.toLocaleLowerCase()));
	const labelWords = usefulWords.length > 0 ? usefulWords : words;
	const joined = labelWords.slice(0, 2).join(" ");
	const compact = (joined.length > 0 ? joined : source).replace(/[^\p{L}\p{N}_ -]/gu, "").trim();
	return compact.length > 0 ? compact.slice(0, 10) : undefined;
}

function safeSummaryPreview(value: string | undefined): string | undefined {
	if (value === undefined) return undefined;
	const compact = value.replace(/\s+/g, " ").trim();
	if (compact.length === 0 || FORBIDDEN_SUMMARY_MARKERS.test(compact)) return undefined;
	return compact.length > 80 ? `${compact.slice(0, 79)}…` : compact;
}

function mergeRowsByWorkflowLane(input: {
	existing: unknown;
	workflowId: string;
	rows: readonly UiRow[];
}): readonly UiRow[] {
	const merged = new Map<string, UiRow>();
	if (Array.isArray(input.existing)) {
		for (const row of input.existing) {
			if (!isRecord(row)) continue;
			const workflowId = getString(row, "workflowId");
			const laneId = getString(row, "laneId");
			if (workflowId === undefined || laneId === undefined || workflowId === input.workflowId) continue;
			merged.set(`${workflowId}\u0000${laneId}`, row as UiRow);
		}
	}
	for (const row of input.rows) merged.set(`${row.workflowId}\u0000${row.laneId}`, row);
	return [...merged.values()]
		.sort((left, right) => observedTime(right.lastObservedAt) - observedTime(left.lastObservedAt))
		.slice(0, 8);
}

function mergeReadyWorkflows(input: {
	existing: unknown;
	workflowId: string;
	workflow: Record<string, unknown> | undefined;
}): readonly Record<string, unknown>[] {
	const merged = new Map<string, Record<string, unknown>>();
	if (Array.isArray(input.existing)) {
		for (const workflow of input.existing) {
			if (!isRecord(workflow)) continue;
			const workflowId = getString(workflow, "workflowId");
			if (workflowId === undefined || workflowId === input.workflowId) continue;
			merged.set(workflowId, workflow);
		}
	}
	if (input.workflow !== undefined) merged.set(input.workflowId, input.workflow);
	return [...merged.values()]
		.sort((left, right) => observedTime(right.readyAt) - observedTime(left.readyAt))
		.slice(0, 8);
}

function mergeSynthesisRows(input: {
	existing: unknown;
	workflowId: string;
	row: SynthesisCacheRow | undefined;
}): readonly SynthesisCacheRow[] {
	const merged = new Map<string, SynthesisCacheRow>();
	if (Array.isArray(input.existing)) {
		for (const row of input.existing) {
			if (!isRecord(row)) continue;
			const workflowId = getString(row, "workflowId");
			const synthesisId = getString(row, "synthesisId");
			const summaryPreview = getString(row, "summaryPreview");
			const observedAt = getString(row, "observedAt");
			if (workflowId === undefined || synthesisId === undefined || summaryPreview === undefined || observedAt === undefined || workflowId === input.workflowId) continue;
			merged.set(workflowId, {
				workflowId,
				synthesisId,
				tasksSummarized: typeof row.tasksSummarized === "number" ? row.tasksSummarized : 0,
				conflictDetected: row.conflictDetected === true,
				summaryPreview,
				observedAt,
			});
		}
	}
	if (input.row !== undefined) merged.set(input.workflowId, input.row);
	return [...merged.values()]
		.sort((left, right) => observedTime(right.observedAt) - observedTime(left.observedAt))
		.slice(0, 5);
}

export function refreshFlowDeskCompletionUiCachesV1(input: {
	rootDir: string;
	workflowId: string;
	observedAt?: string;
}): void {
	try {
		const observedAt = input.observedAt ?? new Date().toISOString();
		const reload = reloadFlowDeskSessionEvidenceV1({ rootDir: input.rootDir, workflowId: input.workflowId });
		if (!reload.ok) return;
		const resultByLane = latestByLane(reload.entries, "task_result");
		const failedByLane = latestByLane(reload.entries, "task_failed");
		const contextByLane = latestByLane(reload.entries, "agent_task_context");
		const synthesisEntries = reload.entries.filter((entry) => entry.evidenceClass === "workflow_synthesis_result");
		const latestSynthesisEntry = synthesisEntries[synthesisEntries.length - 1];
		const synthesisAlreadyRecorded = latestSynthesisEntry !== undefined;
		const laneIds = new Set<string>([...contextByLane.keys(), ...resultByLane.keys(), ...failedByLane.keys()]);
		const rows: UiRow[] = [...laneIds].map((laneId) => {
			const result = resultByLane.get(laneId)?.record;
			const failed = failedByLane.get(laneId)?.record;
			const context = contextByLane.get(laneId)?.record;
			const taskId = getString(result ?? failed ?? context ?? {}, "task_id");
			const taskSummary = compactTaskSummary(getString(context ?? {}, "prompt_text"));
			const state = result !== undefined ? "task_result" : failed !== undefined ? "invocation_failed" : "running";
			const actions = failed !== undefined
				? ["/flowdesk-status", "/flowdesk-retry", "/flowdesk-resume", "/flowdesk-abort", "/flowdesk-export-debug"]
				: ["/flowdesk-status", "/flowdesk-export-debug"];
			return {
				workflowId: input.workflowId,
				laneId,
				...(taskId === undefined ? {} : { taskId }),
				state,
				classification: result !== undefined || failed !== undefined ? "terminal" : "progressing_normal",
				progressPhase: result !== undefined ? "finalizing" : failed !== undefined ? "failed" : "waiting",
				lastObservedAt: getString(result ?? failed ?? context ?? {}, "created_at") ?? observedAt,
				...(getString(result ?? {}, "completion_status") === undefined ? {} : { completionStatus: getString(result ?? {}, "completion_status") }),
				...(getString(result ?? {}, "output_kind") === undefined ? {} : { outputKind: getString(result ?? {}, "output_kind") }),
				...(typeof result?.usable_for_synthesis === "boolean" ? { usableForSynthesis: result.usable_for_synthesis } : {}),
				...(taskSummary === undefined ? {} : { taskSummary }),
				recoveryActionRefs: actions,
				statusCommandRef: "/flowdesk-status",
				debugCommandRef: "/flowdesk-export-debug",
			};
		});
		const uiDir = join(input.rootDir, ".flowdesk", "ui");
		mkdirSync(uiDir, { recursive: true });
		const sidebarCachePath = join(uiDir, "subtask-activity-sidebar.json");
		const autoNextCachePath = join(uiDir, "auto-next-ready.json");
		const synthesisCachePath = join(uiDir, "latest-synthesis.json");
		const existingSidebar = readJsonRecord(sidebarCachePath);
		const existingAutoNext = readJsonRecord(autoNextCachePath);
		const existingSynthesis = readJsonRecord(synthesisCachePath);
		const sidebarRows = mergeRowsByWorkflowLane({
			existing: existingSidebar?.rows,
			workflowId: input.workflowId,
			rows,
		});
		writeFileSync(join(uiDir, "subtask-activity-sidebar.json"), `${JSON.stringify({
			schema_version: "flowdesk.subtask_activity_sidebar_cache.v1",
			observed_at: observedAt,
			expires_at: new Date(Date.parse(observedAt) + 120_000).toISOString(),
			rows: sidebarRows,
			authority: { displayOnly: true, realOpenCodeDispatch: false, providerCall: false, runtimeExecution: false, fallbackAuthority: false, hardCancelOrNoReplyAuthority: false },
		}, null, 2)}\n`, "utf8");

		const ready = !synthesisAlreadyRecorded && rows.length > 0 && rows.every((row) => row.state === "task_result" && row.completionStatus !== "partial" && row.usableForSynthesis !== false);
		const readyAt = rows.reduce((max, row) => Math.max(max, observedTime(row.lastObservedAt)), 0);
		const readyWorkflow = ready ? {
			workflowId: input.workflowId,
			readyAt: Number.isFinite(readyAt) && readyAt > 0 ? new Date(readyAt).toISOString() : observedAt,
			laneProgressAggregate: { expected: rows.length, terminal: rows.length, taskResult: rows.length, failed: 0, awaitingPermission: 0, normalCompleted: rows.length, autoNextStepEligible: true, nextActionAvailable: true, nextActionKind: "synthesis", nextActionRefs: ["/flowdesk-status", "/flowdesk-export-debug"] },
			taskResultRefs: rows.map((row) => row.taskId ?? row.laneId).slice(0, 32),
			taskSummaries: rows.map((row) => row.taskSummary).filter((value): value is string => typeof value === "string" && value.length > 0).slice(0, 3),
			nextActionKind: "synthesis",
			nextActionRefs: ["/flowdesk-status", "/flowdesk-export-debug"],
		} : undefined;
		const readyWorkflows = mergeReadyWorkflows({
			existing: existingAutoNext?.workflows,
			workflowId: input.workflowId,
			workflow: readyWorkflow,
		});
		writeFileSync(join(uiDir, "auto-next-ready.json"), `${JSON.stringify({
			schema_version: "flowdesk.auto_next_ready_cache.v1",
			observed_at: observedAt,
			expires_at: new Date(Date.parse(observedAt) + 120_000).toISOString(),
			workflows: readyWorkflows,
			authority: { displayOnly: true, realOpenCodeDispatch: false, providerCall: false, runtimeExecution: false, fallbackAuthority: false, hardCancelOrNoReplyAuthority: false },
		}, null, 2)}\n`, "utf8");

		const synthesisRecord = latestSynthesisEntry?.record;
		const synthesisId = synthesisRecord === undefined ? undefined : getString(synthesisRecord, "synthesis_id") ?? latestSynthesisEntry?.evidenceId;
		const summaryPreview = synthesisRecord === undefined ? undefined : safeSummaryPreview(getString(synthesisRecord, "synthesis_summary"));
		const synthesisRow = synthesisRecord !== undefined && synthesisId !== undefined && summaryPreview !== undefined ? {
			workflowId: input.workflowId,
			synthesisId,
			tasksSummarized: typeof synthesisRecord.tasks_summarized === "number" ? synthesisRecord.tasks_summarized : 0,
			conflictDetected: synthesisRecord.conflict_detected === true,
			summaryPreview,
			observedAt,
		} : undefined;
		const synthesisRows = mergeSynthesisRows({
			existing: existingSynthesis?.syntheses,
			workflowId: input.workflowId,
			row: synthesisRow,
		});
		writeFileSync(synthesisCachePath, `${JSON.stringify({
			schema_version: "flowdesk.latest_synthesis_cache.v1",
			observed_at: observedAt,
			expires_at: new Date(Date.parse(observedAt) + 120_000).toISOString(),
			syntheses: synthesisRows,
			authority: { displayOnly: true, realOpenCodeDispatch: false, providerCall: false, runtimeExecution: false, actualLaneLaunch: false, fallbackAuthority: false, hardCancelOrNoReplyAuthority: false },
		}, null, 2)}\n`, "utf8");
	} catch {
		// Display cache refresh is best-effort only.
	}
}
