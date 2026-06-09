import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import {
	reloadFlowDeskSessionEvidenceV1,
	type FlowDeskSessionEvidenceReloadEntryV1,
} from "@flowdesk/core";

type UiRow = {
	workflowId: string;
	laneId: string;
	taskId?: string;
	parentSessionRef?: string;
	state?: string;
	classification: "progressing_normal" | "progressing_late" | "stalled" | "terminal" | "inconsistent_finalizing_without_terminal" | "unknown";
	progressPhase?: string;
	startedAt?: string;
	completedAt?: string;
	durationMs?: number;
	lastObservedAt?: string;
	nudgeCount?: number;
	rawNudgeCount?: number;
	lastNudgeAt?: string;
	lastActivityAt?: string;
	nudgeQuietPeriodMs?: number;
	completionStatus?: string;
	outputKind?: string;
	usableForSynthesis?: boolean;
	taskSummary?: string;
	progressLabel?: string;
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

type CompletionWakeReadyRow = {
	workflowId: string;
	parentSessionRef?: string;
	completionKind: "task_result" | "task_failed" | "auto_next_ready" | "awaiting_permission" | "diagnostic_attention";
	readyAt: string;
	dedupeKey: string;
	consumptionKey: string;
	consumed: boolean;
	consumedAt?: string;
	laneIds: readonly string[];
	taskIds: readonly string[];
	taskResultRefs: readonly string[];
	taskFailedRefs: readonly string[];
	taskSummaries: readonly string[];
	notificationLabel: string;
	nextActionRefs: readonly ("/flowdesk-status" | "/flowdesk-export-debug")[];
	/** Parent/main-session model snapshot; wake consumer prefers this over config fallback. */
	parentWakeProviderQualifiedModelId?: string;
};

type AgentTaskLogIndexRow = {
	workflowId: string;
	laneId: string;
	taskId?: string;
	childSessionId?: string;
	childSessionRef?: string;
	parentSessionRef?: string;
	agentRef?: string;
	providerQualifiedModelId?: string;
	createdAt?: string;
	terminalAt?: string;
	nudgeCount: number;
	lastNudgeAt?: string;
	progressEvents: readonly { label: string; phase?: string; observedAt: string; progressRef?: string }[];
	sessionErrorLabels: readonly string[];
	taskResultRef?: string;
	taskFailedRef?: string;
	lifecycleRef?: string;
	openCodeLocalSessionRefs: { childSessionId?: string; sessionDiffPath?: string };
};

const SIDEBAR_TASK_LABEL_MAX_WORDS = 5;
const SIDEBAR_TASK_LABEL_MAX_CHARS = 25;
const FORBIDDEN_SUMMARY_MARKERS = /system prompt|provider payload|raw token|hidden injection|opencode\srun|dispatch\.authority|fallback\.authority|reselect\.authority/i;
const SUBTASK_ACTIVITY_CACHE_GLOBAL_ROW_LIMIT = 100;
const SUBTASK_ACTIVITY_CACHE_SESSION_PROTECTED_ROW_LIMIT = 20;

const SIDEBAR_TASK_SUMMARY_STOP_WORDS = new Set([
	"only",
	"in",
	"the",
	"a",
	"an",
	"of",
	"to",
	"and",
	"or",
	"for",
	"with",
	"from",
	"by",
	"is",
	"are",
	"was",
	"were",
	"be",
	"do",
	"does",
	"at",
	"on",
	"as",
	"it",
	"its",
	"this",
	"that",
	"just",
	"run",
]);

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
	"review",
	"summarize",
	"should",
	"be",
	"am",
	"is",
	"are",
	"was",
	"were",
	"been",
	"being",
	"do",
	"does",
	"did",
	"have",
	"has",
	"had",
	"will",
	"would",
	"can",
	"could",
	"may",
	"might",
	"must",
	"shall",
	"safely",
	"useful",
]);

function getString(record: Record<string, unknown>, key: string): string | undefined {
	const value = record[key];
	return typeof value === "string" && value.length > 0 ? value : undefined;
}

function firstStringField(key: string, ...records: readonly (Record<string, unknown> | undefined)[]): string | undefined {
	for (const record of records) {
		if (record === undefined) continue;
		const value = getString(record, key);
		if (value !== undefined) return value;
	}
	return undefined;
}

function latestByLane(entries: readonly FlowDeskSessionEvidenceReloadEntryV1[], evidenceClass: string): Map<string, FlowDeskSessionEvidenceReloadEntryV1> {
	const byLane = new Map<string, FlowDeskSessionEvidenceReloadEntryV1>();
	for (const entry of entries) {
		if (entry.evidenceClass !== evidenceClass) continue;
		const laneId = getString(entry.record, "lane_id");
		if (laneId === undefined) continue;
		const existing = byLane.get(laneId);
		const entryTime = observedTime(getString(entry.record, "updated_at") ?? getString(entry.record, "created_at") ?? getString(entry.record, "observed_at"));
		const existingTime = existing === undefined ? -1 : observedTime(getString(existing.record, "updated_at") ?? getString(existing.record, "created_at") ?? getString(existing.record, "observed_at"));
		if (existing === undefined || entryTime >= existingTime) byLane.set(laneId, entry);
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

function readRawAgentTaskContextByLane(rootDir: string, workflowId: string): Map<string, FlowDeskSessionEvidenceReloadEntryV1> {
	const byLane = new Map<string, FlowDeskSessionEvidenceReloadEntryV1>();
	try {
		const dir = join(rootDir, ".flowdesk", "sessions", workflowId, "evidence", "agent-task-context");
		if (!existsSync(dir)) return byLane;
		for (const name of readdirSync(dir)) {
			if (!name.endsWith(".json")) continue;
			const record = readJsonRecord(join(dir, name));
			if (record === undefined || record.schema_version !== "flowdesk.agent_task_context.v1") continue;
			if (getString(record, "workflow_id") !== workflowId) continue;
			const laneId = getString(record, "lane_id");
			if (laneId === undefined) continue;
			const relativePath = join(".flowdesk", "sessions", workflowId, "evidence", "agent-task-context", name);
			const candidate: FlowDeskSessionEvidenceReloadEntryV1 = {
				evidenceClass: "agent_task_context",
				evidenceId: name.slice(0, -".json".length),
				record,
				path: relativePath,
			};
			const existing = byLane.get(laneId);
			const candidateTime = observedTime(getString(record, "updated_at") ?? getString(record, "created_at") ?? getString(record, "observed_at"));
			const existingTime = existing === undefined ? -1 : observedTime(getString(existing.record, "updated_at") ?? getString(existing.record, "created_at") ?? getString(existing.record, "observed_at"));
			if (existing === undefined || candidateTime >= existingTime) byLane.set(laneId, candidate);
		}
	} catch {
		return byLane;
	}
	return byLane;
}

function mergeRawAgentTaskContextFields(input: {
	validated: Map<string, FlowDeskSessionEvidenceReloadEntryV1>;
	raw: Map<string, FlowDeskSessionEvidenceReloadEntryV1>;
}): Map<string, FlowDeskSessionEvidenceReloadEntryV1> {
	const merged = new Map(input.validated);
	for (const [laneId, raw] of input.raw) {
		const existing = merged.get(laneId);
		if (existing === undefined) {
			merged.set(laneId, raw);
			continue;
		}
		merged.set(laneId, { ...existing, record: { ...existing.record, ...raw.record } });
	}
	return merged;
}

function observedTime(value: unknown): number {
	return typeof value === "string" && Number.isFinite(Date.parse(value)) ? Date.parse(value) : 0;
}

function preferredStartedAt(existing: unknown, candidate: unknown): string | undefined {
	const existingMs = observedTime(existing);
	const candidateMs = observedTime(candidate);
	if (existingMs > 0 && (candidateMs === 0 || existingMs <= candidateMs) && typeof existing === "string") return existing;
	if (candidateMs > 0 && typeof candidate === "string") return candidate;
	return undefined;
}

function rowDisplayTime(row: UiRow): number {
	return observedTime(row.startedAt) || observedTime(row.lastObservedAt);
}

function withStableRowTimes(row: UiRow, previous?: UiRow): UiRow {
	const startedAt = preferredStartedAt(previous?.startedAt, row.startedAt);
	const completedAt = row.completedAt ?? previous?.completedAt;
	const startedMs = observedTime(startedAt);
	const completedMs = observedTime(completedAt);
	const durationMs = startedMs > 0 && completedMs > 0 && completedMs >= startedMs ? completedMs - startedMs : row.durationMs ?? previous?.durationMs;
	return {
		...row,
		...(startedAt === undefined ? {} : { startedAt }),
		...(completedAt === undefined ? {} : { completedAt }),
		...(durationMs === undefined ? {} : { durationMs }),
	};
}

function monotonicObservedAt(candidate: string, existing: unknown): string {
	const candidateMs = observedTime(candidate);
	const existingMs = observedTime(existing);
	if (existingMs > candidateMs && typeof existing === "string") return existing;
	return candidate;
}

function rowTerminalRank(row: UiRow): number {
	return row.classification === "terminal" || row.state === "task_result" || row.state === "invocation_failed" || row.state === "no_output" || row.state === "task_failed" ? 1 : 0;
}

function rowRichness(row: UiRow): number {
	return [row.taskId, row.parentSessionRef, row.taskSummary, row.completionStatus, row.outputKind]
		.filter((value) => typeof value === "string" && value.length > 0).length + (row.usableForSynthesis === undefined ? 0 : 1);
}

/**
 * Canonical row merge invariants:
 *   1. Terminal-rank MUST be monotonic. Once a lane row reaches terminal
 *      classification (task_result / invocation_failed / no_output /
 *      task_failed), no later candidate may regress it to progressing_normal
 *      regardless of timestamp ordering.
 *   2. Within the same terminal rank, the later `lastObservedAt` wins; ties
 *      break on row richness (more populated fields wins).
 *   3. Merging NEVER mutates the input `existing` or `candidate` objects —
 *      every returned row is a fresh object built via spread, so callers may
 *      keep references to the originals without surprise. (Race-safe: a
 *      concurrent reader of the previous cache copy cannot observe a torn row.)
 *   4. When the winning side is `existing`, its terminal-only fields
 *      (state, classification, progressPhase, completionStatus, outputKind,
 *      usableForSynthesis) are NEVER overwritten by undefined-bearing keys on
 *      the candidate.
 */
function choosePreferredRow(existing: UiRow | undefined, candidate: UiRow): UiRow {
	if (existing === undefined) return withStableRowTimes({ ...candidate });
	const existingRank = rowTerminalRank(existing);
	const candidateRank = rowTerminalRank(candidate);
	if (candidateRank > existingRank) return withStableRowTimes({ ...existing, ...candidate }, existing);
	if (candidateRank < existingRank) return withStableRowTimes({ ...existing });
	const existingTime = observedTime(existing.lastObservedAt);
	const candidateTime = observedTime(candidate.lastObservedAt);
	if (candidateTime > existingTime) return withStableRowTimes({ ...existing, ...candidate }, existing);
	if (candidateTime < existingTime) return withStableRowTimes({ ...existing });
	return rowRichness(candidate) >= rowRichness(existing) ? withStableRowTimes({ ...existing, ...candidate }, existing) : withStableRowTimes({ ...existing });
}

function choosePreferredWorkflow(existing: Record<string, unknown> | undefined, candidate: Record<string, unknown>): Record<string, unknown> {
	if (existing === undefined) return candidate;
	const existingTime = observedTime(existing.readyAt);
	const candidateTime = observedTime(candidate.readyAt);
	if (candidateTime > existingTime) return { ...existing, ...candidate };
	if (candidateTime < existingTime) return existing;
	return { ...existing, ...candidate };
}

function compactTaskSummary(value: string | undefined): string | undefined {
	if (value === undefined) return undefined;
	const firstSentence = value
		.replace(/Respond with exactly[\s\S]*$/i, "")
		.replace(/Return only[\s\S]*$/i, "")
		.replace(/\s+/g, " ")
		.trim();
	const source = firstSentence.length > 0 ? firstSentence : value.replace(/\s+/g, " ").trim();
	const words = source.split(/\s+/).map((word) => word.trim()).filter((word) => word.length > 0);
	const nonStopWords = words.filter((word) => !isSidebarTaskSummaryStopWord(word, words.length));
	if (words.length > 0 && nonStopWords.length === 0) return compactTaskSummaryWords(words, source);
	const wordsAfterStopWords = nonStopWords.length > 0 ? nonStopWords : words;
	const usefulWords = wordsAfterStopWords.filter((word) => !GENERIC_TASK_SUMMARY_WORDS.has(normalizedSummaryWord(word)));
	const labelWords = usefulWords.length > 0 ? usefulWords : wordsAfterStopWords;
	return compactTaskSummaryWords(labelWords, source);
}

function compactTaskSummaryWords(labelWords: readonly string[], source: string): string | undefined {
	const joined = labelWords.slice(0, SIDEBAR_TASK_LABEL_MAX_WORDS).join(" ");
	const compact = (joined.length > 0 ? joined : source).replace(/[^\p{L}\p{N}_ -]/gu, "").trim();
	if (compact.length === 0 || FORBIDDEN_SUMMARY_MARKERS.test(compact)) return undefined;
	return compact.slice(0, SIDEBAR_TASK_LABEL_MAX_CHARS);
}

function isSidebarTaskSummaryStopWord(word: string, totalWordCount: number): boolean {
	if (totalWordCount <= 1) return false;
	return SIDEBAR_TASK_SUMMARY_STOP_WORDS.has(normalizedSummaryWord(word));
}

function normalizedSummaryWord(word: string): string {
	return word.replace(/^[^\p{L}\p{N}_-]+|[^\p{L}\p{N}_-]+$/gu, "").toLocaleLowerCase();
}

function safeSummaryPreview(value: string | undefined): string | undefined {
	if (value === undefined) return undefined;
	const compact = value.replace(/\s+/g, " ").trim();
	if (compact.length === 0 || FORBIDDEN_SUMMARY_MARKERS.test(compact)) return undefined;
	return compact.length > 80 ? `${compact.slice(0, 79)}…` : compact;
}

function boundedLogLabel(value: string): string {
	const compact = value.replace(/\s+/g, " ").trim();
	return compact.length > 120 ? `${compact.slice(0, 119)}…` : compact;
}

function isUsableTerminalTaskResultRow(row: UiRow): boolean {
	return row.state === "task_result" && row.completionStatus !== "partial" && row.usableForSynthesis !== false;
}

function mergeRowsByWorkflowLane(input: {
	existing: unknown;
	workflowId: string;
	rows: readonly UiRow[];
}): readonly UiRow[] {
	// Invariant: merge key is (workflowId, laneId) only — NOT
	// (parentSessionRef, workflowId, laneId). A lane row may legitimately arrive
	// first with no `parent_session_ref` (e.g. a terminal `task_failed` without
	// a paired `agent_task_context`) and later be enriched once lifecycle/
	// context records that DO carry `parent_session_ref` arrive. Keying on
	// `parentSessionRef ?? "global"` would split that single logical lane into
	// two distinct sidebar rows, violating the "one row per lane" guarantee.
	const merged = new Map<string, UiRow>();
	if (Array.isArray(input.existing)) {
		for (const row of input.existing) {
			if (!isRecord(row)) continue;
			const workflowId = getString(row, "workflowId");
			const laneId = getString(row, "laneId");
			if (workflowId === undefined || laneId === undefined) continue;
			merged.set(`${workflowId}\u0000${laneId}`, row as UiRow);
		}
	}
	for (const row of input.rows) {
		const key = `${row.workflowId}\u0000${row.laneId}`;
		merged.set(key, choosePreferredRow(merged.get(key), row));
	}
	return retainSubtaskActivityRows([...merged.values()].sort((left, right) => rowDisplayTime(right) - rowDisplayTime(left)));
}

function retainSubtaskActivityRows(rowsNewestFirst: readonly UiRow[]): readonly UiRow[] {
	if (rowsNewestFirst.length <= SUBTASK_ACTIVITY_CACHE_GLOBAL_ROW_LIMIT) return rowsNewestFirst;

	const selected = new Set<string>();
	const selectedRows: UiRow[] = [];
	const rowsByParentSession = new Map<string, UiRow[]>();
	for (const row of rowsNewestFirst) {
		const parentSessionBucket = row.parentSessionRef ?? "global";
		const bucket = rowsByParentSession.get(parentSessionBucket) ?? [];
		bucket.push(row);
		rowsByParentSession.set(parentSessionBucket, bucket);
	}

	const selectRow = (row: UiRow): void => {
		if (selectedRows.length >= SUBTASK_ACTIVITY_CACHE_GLOBAL_ROW_LIMIT) return;
		const key = `${row.workflowId}\u0000${row.laneId}`;
		if (selected.has(key)) return;
		selected.add(key);
		selectedRows.push(row);
	};

	for (const bucket of rowsByParentSession.values()) {
		for (const row of bucket.slice(0, SUBTASK_ACTIVITY_CACHE_SESSION_PROTECTED_ROW_LIMIT)) {
			selectRow(row);
		}
	}
	for (const row of rowsNewestFirst) {
		selectRow(row);
	}

	return selectedRows.sort((left, right) => rowDisplayTime(right) - rowDisplayTime(left));
}

function mergeAgentTaskLogIndexRows(input: {
	existing: unknown;
	rows: readonly AgentTaskLogIndexRow[];
}): readonly AgentTaskLogIndexRow[] {
	const merged = new Map<string, AgentTaskLogIndexRow>();
	if (Array.isArray(input.existing)) {
		for (const row of input.existing) {
			if (!isRecord(row)) continue;
			const workflowId = getString(row, "workflowId");
			const laneId = getString(row, "laneId");
			if (workflowId === undefined || laneId === undefined) continue;
			merged.set(`${workflowId}\u0000${laneId}`, row as AgentTaskLogIndexRow);
		}
	}
	for (const row of input.rows) {
		merged.set(`${row.workflowId}\u0000${row.laneId}`, row);
	}
	return [...merged.values()]
		.sort((left, right) => observedTime(right.terminalAt ?? right.createdAt) - observedTime(left.terminalAt ?? left.createdAt))
		.slice(0, 50);
}

function mergeReadyWorkflows(input: {
	existing: unknown;
	workflowId: string;
	parentSessionRef?: string;
	workflow: Record<string, unknown> | undefined;
}): readonly Record<string, unknown>[] {
	const merged = new Map<string, Record<string, unknown>>();
	if (Array.isArray(input.existing)) {
		for (const workflow of input.existing) {
			if (!isRecord(workflow)) continue;
			const workflowId = getString(workflow, "workflowId");
			if (workflowId === undefined || workflowId === input.workflowId) continue;
			const parentSessionRef = getString(workflow, "parentSessionRef") ?? "global";
			merged.set(`${parentSessionRef}\u0000${workflowId}`, workflow);
		}
	}
	if (input.workflow !== undefined) {
		const key = `${input.parentSessionRef ?? "global"}\u0000${input.workflowId}`;
		merged.set(key, choosePreferredWorkflow(merged.get(key), input.workflow));
	}
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
			if (workflowId === undefined || synthesisId === undefined || summaryPreview === undefined || observedAt === undefined) continue;
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
	if (input.row !== undefined) {
		const existing = merged.get(input.workflowId);
		if (existing !== undefined && observedTime(input.row.observedAt) < observedTime(existing.observedAt)) {
			merged.set(input.workflowId, existing);
		} else {
			merged.set(input.workflowId, input.row);
		}
	}
	return [...merged.values()]
		.sort((left, right) => observedTime(right.observedAt) - observedTime(left.observedAt))
		.slice(0, 5);
}

function stableWakeIdentityFingerprint(row: CompletionWakeReadyRow): string {
	const stableList = (values: readonly string[]): readonly string[] => [...values].filter((value) => value.length > 0).sort();
	const parentScope = row.parentSessionRef ?? "global";
	const workflowLevelDedupeKey = `${parentScope}\u0000${row.workflowId}`;
	const appendWorkflowActions = (parts: unknown[]): unknown[] => {
		if (row.dedupeKey === workflowLevelDedupeKey && row.nextActionRefs.length > 0) parts.push(stableList(row.nextActionRefs));
		return parts;
	};
	if (row.completionKind === "task_result") {
		return JSON.stringify(appendWorkflowActions([
			row.workflowId,
			parentScope,
			row.completionKind,
			stableList(row.taskResultRefs),
			row.notificationLabel,
		]));
	}
	if (row.completionKind === "task_failed") {
		return JSON.stringify(appendWorkflowActions([
			row.workflowId,
			parentScope,
			row.completionKind,
			stableList(row.taskResultRefs),
			stableList(row.taskFailedRefs),
			row.notificationLabel,
		]));
	}
	const parts: unknown[] = [
		row.workflowId,
		parentScope,
		row.completionKind,
		stableList(row.laneIds),
		stableList(row.taskIds),
		stableList(row.taskResultRefs),
		stableList(row.taskFailedRefs),
		row.notificationLabel,
	];
	return JSON.stringify(appendWorkflowActions(parts));
}

function mergeCompletionWakeReadyRows(input: {
	existing: unknown;
	row: CompletionWakeReadyRow | undefined;
}): readonly CompletionWakeReadyRow[] {
	const merged = new Map<string, CompletionWakeReadyRow>();
	if (Array.isArray(input.existing)) {
		for (const row of input.existing) {
			if (!isRecord(row)) continue;
			const workflowId = getString(row, "workflowId");
			const readyAt = getString(row, "readyAt");
			const dedupeKey = getString(row, "dedupeKey");
			const consumptionKey = getString(row, "consumptionKey");
			const completionKind = getString(row, "completionKind");
			if (workflowId === undefined || readyAt === undefined || dedupeKey === undefined || consumptionKey === undefined) continue;
			if (completionKind !== "task_result" && completionKind !== "task_failed" && completionKind !== "auto_next_ready" && completionKind !== "awaiting_permission" && completionKind !== "diagnostic_attention") continue;
			const parentSessionRef = getString(row, "parentSessionRef");
			const wakeModel = getString(row, "parentWakeProviderQualifiedModelId");
			merged.set(dedupeKey, {
				workflowId,
				...(parentSessionRef === undefined ? {} : { parentSessionRef }),
				completionKind,
				readyAt,
				dedupeKey,
				consumptionKey,
				consumed: row.consumed === true,
				...(getString(row, "consumedAt") === undefined ? {} : { consumedAt: getString(row, "consumedAt") }),
				laneIds: Array.isArray(row.laneIds) ? row.laneIds.filter((value): value is string => typeof value === "string" && value.length > 0).slice(0, 32) : [],
				taskIds: Array.isArray(row.taskIds) ? row.taskIds.filter((value): value is string => typeof value === "string" && value.length > 0).slice(0, 32) : [],
				taskResultRefs: Array.isArray(row.taskResultRefs) ? row.taskResultRefs.filter((value): value is string => typeof value === "string" && value.length > 0) : [],
				taskFailedRefs: Array.isArray(row.taskFailedRefs) ? row.taskFailedRefs.filter((value): value is string => typeof value === "string" && value.length > 0) : [],
				taskSummaries: Array.isArray(row.taskSummaries) ? row.taskSummaries.filter((value): value is string => typeof value === "string" && value.length > 0 && !FORBIDDEN_SUMMARY_MARKERS.test(value)).map((value) => value.slice(0, SIDEBAR_TASK_LABEL_MAX_CHARS)).slice(0, 3) : [],
				notificationLabel: getString(row, "notificationLabel")?.slice(0, 80) ?? "FlowDesk completion ready",
				nextActionRefs: ["/flowdesk-status", "/flowdesk-export-debug"],
				...(wakeModel !== undefined && wakeModel.includes("/") ? { parentWakeProviderQualifiedModelId: wakeModel } : {}),
			});
		}
	}
	if (input.row !== undefined) {
		if (input.row.completionKind !== "awaiting_permission") {
			const parentScope = input.row.parentSessionRef ?? "global";
			merged.delete(`${parentScope}\u0000${input.row.workflowId}\u0000awaiting_permission`);
		}
		if (input.row.completionKind !== "diagnostic_attention") {
			const parentScope = input.row.parentSessionRef ?? "global";
			merged.delete(`${parentScope}\u0000${input.row.workflowId}\u0000diagnostic_attention`);
		}
		const existing = merged.get(input.row.dedupeKey);
		if (existing === undefined || observedTime(input.row.readyAt) >= observedTime(existing.readyAt)) {
			const consumedCarryover = existing?.consumed === true && (existing.consumptionKey === input.row.consumptionKey || stableWakeIdentityFingerprint(existing) === stableWakeIdentityFingerprint(input.row));
			merged.set(input.row.dedupeKey, consumedCarryover ? { ...input.row, consumed: true, ...(existing.consumedAt === undefined ? {} : { consumedAt: existing.consumedAt }) } : input.row);
		}
	}
	return [...merged.values()]
		.sort((left, right) => observedTime(right.readyAt) - observedTime(left.readyAt))
		.slice(0, 8);
}

function inheritedWakeParentSessionRef(input: {
	rows: readonly UiRow[];
	existingWakeRows: unknown;
	workflowId: string;
}): string | undefined {
	// Only consider VALID parent session refs. Failed lanes record a sentinel
	// "ses-invalid-parent-session-binding" ref; including those made the set size
	// > 1 and forced this helper to return undefined, which blanked the Global
	// wake row's parentSessionRef and silently dropped every wake. Filter the
	// sentinel out and pick the most frequent valid ref so a mix of healthy and
	// failed lanes still resolves the real parent session.
	const isValidParentRef = (value: string | undefined): value is string =>
		typeof value === "string" && value.length > 0 && !value.includes("invalid-parent-session-binding");
	const validRowRefs = input.rows.map((row) => row.parentSessionRef).filter(isValidParentRef);
	const pickMostFrequent = (refs: readonly string[]): string | undefined => {
		if (refs.length === 0) return undefined;
		const counts = new Map<string, number>();
		for (const ref of refs) counts.set(ref, (counts.get(ref) ?? 0) + 1);
		let best: string | undefined;
		let bestCount = 0;
		for (const [ref, count] of counts) {
			if (count > bestCount) { best = ref; bestCount = count; }
		}
		return best;
	};
	const fromRows = pickMostFrequent(validRowRefs);
	if (fromRows !== undefined) return fromRows;
	if (!Array.isArray(input.existingWakeRows)) return undefined;
	const existingRefs = input.existingWakeRows
		.filter((row): row is Record<string, unknown> => isRecord(row) && getString(row, "workflowId") === input.workflowId)
		.map((row) => getString(row, "parentSessionRef"))
		.filter(isValidParentRef);
	return pickMostFrequent(existingRefs);
}

function evidenceEntriesByLane(entries: readonly FlowDeskSessionEvidenceReloadEntryV1[], evidenceClass: string): Map<string, FlowDeskSessionEvidenceReloadEntryV1[]> {
	const byLane = new Map<string, FlowDeskSessionEvidenceReloadEntryV1[]>();
	for (const entry of entries) {
		if (entry.evidenceClass !== evidenceClass) continue;
		const laneId = getString(entry.record, "lane_id");
		if (laneId === undefined) continue;
		const current = byLane.get(laneId) ?? [];
		current.push(entry);
		byLane.set(laneId, current);
	}
	return byLane;
}

function childSessionIdFromRecord(record: Record<string, unknown> | undefined): string | undefined {
	const childSessionId = getString(record ?? {}, "child_session_id");
	if (childSessionId !== undefined) return childSessionId;
	const childSessionRef = getString(record ?? {}, "child_session_ref");
	return childSessionRef?.startsWith("ses-") ? childSessionRef.slice("ses-".length) : undefined;
}

function buildAgentTaskLogIndexRows(input: {
	workflowId: string;
	entries: readonly FlowDeskSessionEvidenceReloadEntryV1[];
	resultByLane: Map<string, FlowDeskSessionEvidenceReloadEntryV1>;
	failedByLane: Map<string, FlowDeskSessionEvidenceReloadEntryV1>;
	contextByLane: Map<string, FlowDeskSessionEvidenceReloadEntryV1>;
	childSessionByLane: Map<string, FlowDeskSessionEvidenceReloadEntryV1>;
	terminalLifecycleByLane: Map<string, FlowDeskSessionEvidenceReloadEntryV1>;
	laneIds: Set<string>;
}): AgentTaskLogIndexRow[] {
	const progressEntriesByLane = evidenceEntriesByLane(input.entries, "agent_task_progress");
	return [...input.laneIds].map((laneId) => {
		const resultEntry = input.resultByLane.get(laneId);
		const failedEntry = input.failedByLane.get(laneId);
		const contextEntry = input.contextByLane.get(laneId);
		const childSessionEntry = input.childSessionByLane.get(laneId);
		const lifecycleEntry = input.terminalLifecycleByLane.get(laneId);
		const result = resultEntry?.record;
		const failed = failedEntry?.record;
		const context = contextEntry?.record;
		const childSession = childSessionEntry?.record;
		const lifecycle = lifecycleEntry?.record;
		const progressEvents = (progressEntriesByLane.get(laneId) ?? [])
			.map((entry) => ({
				label: boundedLogLabel(getString(entry.record, "progress_label") ?? "agent task progress"),
				...(getString(entry.record, "phase") === undefined ? {} : { phase: getString(entry.record, "phase") }),
				observedAt: getString(entry.record, "observed_at") ?? getString(entry.record, "created_at") ?? new Date(0).toISOString(),
				...(getString(entry.record, "progress_ref") === undefined ? {} : { progressRef: getString(entry.record, "progress_ref") }),
			}))
			.sort((left, right) => observedTime(left.observedAt) - observedTime(right.observedAt))
			.slice(0, 50);
		const sessionErrorLabels = [
			getString(failed ?? {}, "failure_category"),
			getString(failed ?? {}, "redacted_error_details"),
		]
			.filter((value): value is string => typeof value === "string" && value.length > 0)
			.map((value) => boundedLogLabel(value))
			.slice(0, 8);
		const childSessionId = childSessionIdFromRecord(childSession) ?? childSessionIdFromRecord(lifecycle);
		const sessionDiffPath = getString(childSession ?? {}, "session_diff_path") ?? getString(lifecycle ?? {}, "session_diff_path");
		const nudgeCount = typeof childSession?.nudge_count === "number" && Number.isFinite(childSession.nudge_count) ? childSession.nudge_count : 0;
		const terminalAt = getString(result ?? failed ?? lifecycle ?? {}, "updated_at") ?? getString(result ?? failed ?? lifecycle ?? {}, "created_at");
		const parentSessionRef = firstStringField("parent_session_ref", context, childSession, lifecycle);
		return {
			workflowId: input.workflowId,
			laneId,
			...(getString(result ?? failed ?? context ?? childSession ?? lifecycle ?? {}, "task_id") === undefined ? {} : { taskId: getString(result ?? failed ?? context ?? childSession ?? lifecycle ?? {}, "task_id") }),
			...(childSessionId === undefined ? {} : { childSessionId }),
			...(getString(childSession ?? lifecycle ?? {}, "child_session_ref") === undefined ? {} : { childSessionRef: getString(childSession ?? lifecycle ?? {}, "child_session_ref") }),
			...(parentSessionRef === undefined ? {} : { parentSessionRef }),
			...(getString(result ?? failed ?? context ?? childSession ?? lifecycle ?? {}, "agent_ref") === undefined ? {} : { agentRef: getString(result ?? failed ?? context ?? childSession ?? lifecycle ?? {}, "agent_ref") }),
			...(getString(result ?? failed ?? context ?? childSession ?? lifecycle ?? {}, "provider_qualified_model_id") === undefined ? {} : { providerQualifiedModelId: getString(result ?? failed ?? context ?? childSession ?? lifecycle ?? {}, "provider_qualified_model_id") }),
			...(getString(context ?? childSession ?? lifecycle ?? {}, "created_at") === undefined ? {} : { createdAt: getString(context ?? childSession ?? lifecycle ?? {}, "created_at") }),
			...(terminalAt === undefined ? {} : { terminalAt }),
			nudgeCount,
			...(getString(childSession ?? {}, "last_nudge_at") === undefined ? {} : { lastNudgeAt: getString(childSession ?? {}, "last_nudge_at") }),
			progressEvents,
			sessionErrorLabels,
			...(resultEntry === undefined ? {} : { taskResultRef: resultEntry.evidenceId }),
			...(failedEntry === undefined ? {} : { taskFailedRef: failedEntry.evidenceId }),
			...(lifecycleEntry === undefined ? {} : { lifecycleRef: lifecycleEntry.evidenceId }),
			openCodeLocalSessionRefs: {
				...(childSessionId === undefined ? {} : { childSessionId }),
				...(sessionDiffPath === undefined ? {} : { sessionDiffPath }),
			},
		};
	})
		.sort((left, right) => observedTime(right.terminalAt ?? right.createdAt) - observedTime(left.terminalAt ?? left.createdAt))
		.slice(0, 50);
}

export function refreshFlowDeskCompletionUiCachesV1(input: {
	rootDir: string;
	workflowId: string;
	observedAt?: string;
}): void {
	try {
		const requestedObservedAt = input.observedAt ?? new Date().toISOString();
		const reload = reloadFlowDeskSessionEvidenceV1({ rootDir: input.rootDir, workflowId: input.workflowId });
		if (!reload.ok) return;
		const uiDir = join(input.rootDir, ".flowdesk", "ui");
		mkdirSync(uiDir, { recursive: true });
		const sidebarCachePath = join(uiDir, "subtask-activity-sidebar.json");
		const autoNextCachePath = join(uiDir, "auto-next-ready.json");
		const synthesisCachePath = join(uiDir, "latest-synthesis.json");
		const wakeReadyCachePath = join(uiDir, "completion-wake-ready.json");
		const agentTaskLogIndexPath = join(uiDir, "agent-task-log-index.json");
		const existingSidebar = readJsonRecord(sidebarCachePath);
		const existingAutoNext = readJsonRecord(autoNextCachePath);
		const existingSynthesis = readJsonRecord(synthesisCachePath);
		const existingWakeReady = readJsonRecord(wakeReadyCachePath);
		// Invariant: the file-level `observed_at` MUST be monotonic across every
		// previously persisted cache file. A back-dated/duplicate terminal event
		// (e.g. an older `task_failed` arriving after a newer one was already
		// merged) must never regress the visible `observed_at`. We fold in
		// sidebar, auto-next, synthesis, AND wake-ready observed_at so any one of them can
		// pin monotonicity.
		const existingSynthesisObservedAt = typeof existingSynthesis?.observed_at === "string" ? existingSynthesis.observed_at : requestedObservedAt;
		const observedAt = monotonicObservedAt(
			monotonicObservedAt(
				monotonicObservedAt(requestedObservedAt, existingSidebar?.observed_at),
				existingAutoNext?.observed_at,
			),
			monotonicObservedAt(existingSynthesisObservedAt, existingWakeReady?.observed_at),
		);
		const resultByLane = latestByLane(reload.entries, "task_result");
		const failedByLane = latestByLane(reload.entries, "task_failed");
		const contextByLane = mergeRawAgentTaskContextFields({
			validated: latestByLane(reload.entries, "agent_task_context"),
			raw: readRawAgentTaskContextByLane(input.rootDir, input.workflowId),
		});
		const progressByLane = latestByLane(reload.entries, "agent_task_progress");
		const childSessionByLane = latestByLane(reload.entries, "agent_task_child_session");
		const heartbeatByLane = latestByLane(reload.entries, "lane_heartbeat");
		// Some lanes reach a terminal state via lane_lifecycle alone (e.g. reviewer
		// execution bridge writes only lane_lifecycle=invocation_failed without a
		// task_failed companion). Pick the latest terminal lifecycle per lane so the
		// UI cache can promote those rows to terminal/failed instead of leaving them
		// stale at progressing_normal/running.
		const TERMINAL_LIFECYCLE_STATES = new Set(["complete", "invocation_failed", "no_output", "task_failed", "incomplete", "aborted", "timeout"]);
		const terminalLifecycleByLane = new Map<string, FlowDeskSessionEvidenceReloadEntryV1>();
		for (const entry of reload.entries) {
			if (entry.evidenceClass !== "lane_lifecycle") continue;
			const laneId = getString(entry.record, "lane_id");
			if (laneId === undefined) continue;
			const stateValue = entry.record.state;
			if (typeof stateValue !== "string" || !TERMINAL_LIFECYCLE_STATES.has(stateValue)) continue;
			const previous = terminalLifecycleByLane.get(laneId);
			if (previous === undefined || observedTime(getString(previous.record, "updated_at") ?? getString(previous.record, "created_at")) <= observedTime(getString(entry.record, "updated_at") ?? getString(entry.record, "created_at"))) {
				terminalLifecycleByLane.set(laneId, entry);
			}
		}
		const synthesisEntries = reload.entries.filter((entry) => entry.evidenceClass === "workflow_synthesis_result");
		const latestSynthesisEntry = synthesisEntries[synthesisEntries.length - 1];
		const synthesisAlreadyRecorded = latestSynthesisEntry !== undefined;
		const laneIds = new Set<string>([...contextByLane.keys(), ...resultByLane.keys(), ...failedByLane.keys(), ...terminalLifecycleByLane.keys(), ...progressByLane.keys(), ...childSessionByLane.keys(), ...heartbeatByLane.keys()]);
		const rows: UiRow[] = [...laneIds].map((laneId) => {
			const result = resultByLane.get(laneId)?.record;
			const failed = failedByLane.get(laneId)?.record;
			const context = contextByLane.get(laneId)?.record;
			const progress = progressByLane.get(laneId)?.record;
			const childSession = childSessionByLane.get(laneId)?.record;
			const heartbeat = heartbeatByLane.get(laneId)?.record;
			const lifecycle = terminalLifecycleByLane.get(laneId)?.record;
			const lifecycleState = typeof lifecycle?.state === "string" ? lifecycle.state : undefined;
			// A lane is terminal-without-success when lifecycle reports a non-complete
			// terminal state but no task_result and no task_failed evidence exists.
			const lifecycleTerminalFailureOnly = result === undefined && failed === undefined && lifecycleState !== undefined && lifecycleState !== "complete";
			const taskId = getString(result ?? failed ?? context ?? lifecycle ?? childSession ?? {}, "task_id");
			// parent_session_ref source priority must include the child-session record:
			// in async mode a running lane has a child-session record (which carries
			// parent_session_ref) but NOT yet an agent_task_context record, and only a
			// RUNNING lifecycle (terminalLifecycleByLane only holds terminal states).
			// Without childSession here, running rows were written with an undefined
			// parentSessionRef and the session-scoped TUI sidebar filtered them out,
			// so a launched subtask only became visible after it terminated. Including
			// childSession keeps running rows correctly scoped to the current session.
			const parentSessionRef = firstStringField("parent_session_ref", context, lifecycle, childSession, heartbeat);
			const taskSummary = compactTaskSummary(getString(context ?? {}, "prompt_text"));
			const state = result !== undefined
				? "task_result"
				: failed !== undefined
					? "invocation_failed"
					: lifecycleTerminalFailureOnly
						? lifecycleState as string
						: "running";
			const isTerminal = result !== undefined || failed !== undefined || lifecycleTerminalFailureOnly;
			const isFailedLike = failed !== undefined || lifecycleTerminalFailureOnly;
			const rawNudgeCount = typeof childSession?.nudge_count === "number" && Number.isFinite(childSession.nudge_count) ? childSession.nudge_count : undefined;
			const lastNudgeAt = getString(childSession ?? {}, "last_nudge_at");
			const lastNudgeAtMs = observedTime(lastNudgeAt);
			const progressObservedAt = getString(progress ?? {}, "observed_at");
			const progressAtMs = observedTime(progressObservedAt);
			const effectiveNudgeCount = rawNudgeCount === undefined
				? undefined
				: progressAtMs > 0 && lastNudgeAtMs > 0 && progressAtMs > lastNudgeAtMs
					? 0
					: rawNudgeCount;
			const childCreatedAt = getString(childSession ?? {}, "created_at");
			const activityMs = Math.max(observedTime(childCreatedAt), lastNudgeAtMs, progressAtMs);
			const lastActivityAt = activityMs > 0 ? new Date(activityMs).toISOString() : getString(childSession ?? {}, "last_activity_at");
			const nudgeQuietPeriodMs = typeof childSession?.nudge_quiet_period_ms === "number" && Number.isFinite(childSession.nudge_quiet_period_ms) ? childSession.nudge_quiet_period_ms : undefined;
			const rawProgressPhase = getString(progress ?? {}, "phase");
			const actions = isFailedLike
				? ["/flowdesk-status", "/flowdesk-retry", "/flowdesk-resume", "/flowdesk-abort", "/flowdesk-export-debug"]
				: rawProgressPhase === "awaiting_permission"
					? ["/flowdesk-status", "/flowdesk-export-debug"]
				: ["/flowdesk-status", "/flowdesk-export-debug"];
			const progressPhase = result !== undefined
				? "finalizing"
				: isFailedLike
					? "failed"
					: rawProgressPhase ?? "waiting";
			const startedAt = getString(context ?? {}, "created_at") ?? getString(childSession ?? {}, "created_at");
			const completedAt = isTerminal
				? getString(result ?? failed ?? lifecycle ?? {}, "updated_at") ?? getString(result ?? failed ?? lifecycle ?? {}, "created_at")
				: undefined;
			const startedMs = observedTime(startedAt);
			const completedMs = observedTime(completedAt);
			const durationMs = startedMs > 0 && completedMs > 0 && completedMs >= startedMs ? completedMs - startedMs : undefined;
			return {
				workflowId: input.workflowId,
				laneId,
				...(taskId === undefined ? {} : { taskId }),
				...(parentSessionRef === undefined ? {} : { parentSessionRef }),
				state,
				classification: isTerminal ? "terminal" : "progressing_normal",
				progressPhase,
				...(getString(progress ?? {}, "progress_label") === undefined ? {} : { progressLabel: getString(progress ?? {}, "progress_label") }),
				...(startedAt === undefined ? {} : { startedAt }),
				...(completedAt === undefined ? {} : { completedAt }),
				...(durationMs === undefined ? {} : { durationMs }),
				lastObservedAt: getString(result ?? failed ?? lifecycle ?? progress ?? context ?? childSession ?? {}, "updated_at") ?? getString(result ?? failed ?? lifecycle ?? progress ?? context ?? childSession ?? {}, "created_at") ?? getString(progress ?? {}, "observed_at") ?? observedAt,
				...(effectiveNudgeCount === undefined ? {} : { nudgeCount: effectiveNudgeCount }),
				...(rawNudgeCount === undefined || rawNudgeCount === effectiveNudgeCount ? {} : { rawNudgeCount }),
				...(lastNudgeAt === undefined ? {} : { lastNudgeAt }),
				...(lastActivityAt === undefined ? {} : { lastActivityAt }),
				...(nudgeQuietPeriodMs === undefined ? {} : { nudgeQuietPeriodMs }),
				...(getString(result ?? {}, "completion_status") === undefined ? {} : { completionStatus: getString(result ?? {}, "completion_status") }),
				...(getString(result ?? {}, "output_kind") === undefined ? {} : { outputKind: getString(result ?? {}, "output_kind") }),
				...(typeof result?.usable_for_synthesis === "boolean" ? { usableForSynthesis: result.usable_for_synthesis } : {}),
				...(taskSummary === undefined ? {} : { taskSummary }),
				recoveryActionRefs: actions,
				statusCommandRef: "/flowdesk-status",
				debugCommandRef: "/flowdesk-export-debug",
			};
		});
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

		const ready = !synthesisAlreadyRecorded && rows.length > 0 && rows.every(isUsableTerminalTaskResultRow);
		const readyAt = rows.reduce((max, row) => Math.max(max, observedTime(row.lastObservedAt)), 0);
		const parentSessionRef = inheritedWakeParentSessionRef({
			rows: sidebarRows.filter((row) => row.workflowId === input.workflowId),
			existingWakeRows: existingWakeReady?.rows,
			workflowId: input.workflowId,
		}) ?? inheritedWakeParentSessionRef({ rows, existingWakeRows: existingWakeReady?.rows, workflowId: input.workflowId });
		const readyWorkflow = ready ? {
			workflowId: input.workflowId,
			...(parentSessionRef === undefined ? {} : { parentSessionRef }),
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
			parentSessionRef,
			workflow: readyWorkflow,
		});
		writeFileSync(join(uiDir, "auto-next-ready.json"), `${JSON.stringify({
			schema_version: "flowdesk.auto_next_ready_cache.v1",
			observed_at: observedAt,
			expires_at: new Date(Date.parse(observedAt) + 120_000).toISOString(),
			workflows: readyWorkflows,
			authority: { displayOnly: true, realOpenCodeDispatch: false, providerCall: false, runtimeExecution: false, fallbackAuthority: false, hardCancelOrNoReplyAuthority: false },
		}, null, 2)}\n`, "utf8");

		const terminalComplete = rows.length > 0 && rows.every((row) => row.classification === "terminal");
		const awaitingPermissionRows = terminalComplete ? [] : rows.filter((row) => row.progressPhase === "awaiting_permission");
		const toolDiagnosticRows = terminalComplete || awaitingPermissionRows.length > 0 ? [] : rows.filter((row) => {
			const progressLabel = row.progressLabel ?? "";
			return progressLabel.includes("tool_run_overdue_observed") || progressLabel.includes("tool_execution_aborted_observed") || progressLabel.includes("coordinator_attention_observed");
		});
		const wakeReadyAt = terminalComplete
			? rows.reduce((max, row) => Math.max(max, observedTime(row.lastObservedAt)), 0)
			: awaitingPermissionRows.length > 0
				? awaitingPermissionRows.reduce((max, row) => Math.max(max, observedTime(row.lastObservedAt)), 0)
				: toolDiagnosticRows.reduce((max, row) => Math.max(max, observedTime(row.lastObservedAt)), 0);
		const wakeParentScope = parentSessionRef ?? "global";
		const wakeReadyIso = wakeReadyAt > 0 ? new Date(wakeReadyAt).toISOString() : observedAt;
		const permissionWakeDedupeKey = `${wakeParentScope}\u0000${input.workflowId}\u0000awaiting_permission`;
		const diagnosticWakeDedupeKey = `${wakeParentScope}\u0000${input.workflowId}\u0000diagnostic_attention`;
		const permissionWakeConsumptionKey = `${wakeParentScope}:${input.workflowId}:awaiting_permission:${wakeReadyIso}:${awaitingPermissionRows.length}`;
		const diagnosticWakeConsumptionKey = `${wakeParentScope}:${input.workflowId}:diagnostic_attention:${wakeReadyIso}:${toolDiagnosticRows.length}`;
		const terminalCompletedRows = rows.filter((row) => row.classification === "terminal" && (row.state === "task_result" || row.state === "invocation_failed" || row.state === "task_failed" || row.state === "no_output"));
	// Resolve the parent/main-session launch snapshot from evidence so wake
	// prompts route to the parent session's model, not the delegated lane model.
	// Priority: recorded parent model > legacy parent wake model. Do
	// NOT fall back to provider_qualified_model_id; that is the lane/task model.
	const parentWakeModelCandidates = [...contextByLane.values()]
		.map((entry) => getString(entry.record, "recorded_parent_provider_qualified_model_id") ?? getString(entry.record, "parent_wake_provider_qualified_model_id"))
		.filter((value): value is string => typeof value === "string" && value.includes("/"));
	const parentWakeModelId = parentWakeModelCandidates[0];
		const workflowWakeReadyRow: CompletionWakeReadyRow | undefined = !terminalComplete && awaitingPermissionRows.length > 0 ? {
			workflowId: input.workflowId,
			...(parentSessionRef === undefined ? {} : { parentSessionRef }),
			completionKind: "awaiting_permission",
			readyAt: wakeReadyIso,
			dedupeKey: permissionWakeDedupeKey,
			consumptionKey: permissionWakeConsumptionKey,
			consumed: false,
			laneIds: awaitingPermissionRows.map((row) => row.laneId).slice(0, 32),
			taskIds: awaitingPermissionRows.map((row) => row.taskId).filter((value): value is string => typeof value === "string" && value.length > 0).slice(0, 32),
			taskResultRefs: [],
			taskFailedRefs: [],
			taskSummaries: awaitingPermissionRows.map((row) => row.taskSummary).filter((value): value is string => typeof value === "string" && value.length > 0).slice(0, 3),
			notificationLabel: "FlowDesk lane awaiting OpenCode permission",
			nextActionRefs: ["/flowdesk-status", "/flowdesk-export-debug"],
			...(parentWakeModelId !== undefined ? { parentWakeProviderQualifiedModelId: parentWakeModelId } : {}),
		} : toolDiagnosticRows.length > 0 ? {
			workflowId: input.workflowId,
			...(parentSessionRef === undefined ? {} : { parentSessionRef }),
			completionKind: "diagnostic_attention",
			readyAt: wakeReadyIso,
			dedupeKey: diagnosticWakeDedupeKey,
			consumptionKey: diagnosticWakeConsumptionKey,
			consumed: false,
			laneIds: toolDiagnosticRows.map((row) => row.laneId).slice(0, 32),
			taskIds: toolDiagnosticRows.map((row) => row.taskId).filter((value): value is string => typeof value === "string" && value.length > 0).slice(0, 32),
			taskResultRefs: [],
			taskFailedRefs: [],
			taskSummaries: toolDiagnosticRows.map((row) => row.taskSummary).filter((value): value is string => typeof value === "string" && value.length > 0).slice(0, 3),
			notificationLabel: "FlowDesk lane diagnostic attention requested",
			nextActionRefs: ["/flowdesk-status", "/flowdesk-export-debug"],
			...(parentWakeModelId !== undefined ? { parentWakeProviderQualifiedModelId: parentWakeModelId } : {}),
		} : undefined;
		// Task-unit wake rows: emit one row per terminal lane regardless of whether
		// the workflow as a whole is complete. This replaces the old workflow-level
		// grouping (path A) so every task gets its own independent wake and verdict.
		const laneWakeRows: CompletionWakeReadyRow[] = terminalCompletedRows.map((row) => {
			const rowParentScope = row.parentSessionRef ?? "global";
			const rowReadyAt = row.lastObservedAt ?? observedAt;
			const rowFailed = row.state !== "task_result";
			// A task-unit row is synthesis-ready when it is the only usable terminal
			// result and synthesis has not yet been recorded. This mirrors the old
			// workflow-level groupReady logic but at the individual lane level.
			const rowReady = !synthesisAlreadyRecorded && isUsableTerminalTaskResultRow(row);
			const rowKind: CompletionWakeReadyRow["completionKind"] = rowFailed ? "task_failed" : rowReady ? "auto_next_ready" : "task_result";
			return {
				workflowId: input.workflowId,
				...(row.parentSessionRef === undefined ? {} : { parentSessionRef: row.parentSessionRef }),
				completionKind: rowKind,
				readyAt: rowReadyAt,
				dedupeKey: `${rowParentScope}\u0000${input.workflowId}\u0000${row.laneId}`,
				consumptionKey: `${rowParentScope}:${input.workflowId}:${row.laneId}:${rowReadyAt}:${row.taskId ?? row.laneId}:${row.state ?? "terminal"}`,
				consumed: false,
				laneIds: [row.laneId],
				taskIds: row.taskId === undefined ? [] : [row.taskId],
				taskResultRefs: row.state === "task_result" ? [row.taskId ?? row.laneId] : [],
				taskFailedRefs: rowFailed ? [row.taskId ?? row.laneId] : [],
				taskSummaries: row.taskSummary === undefined ? [] : [row.taskSummary],
				notificationLabel: rowFailed ? "FlowDesk lane completed with failure" : rowReady ? "FlowDesk lane result ready" : "FlowDesk lane result ready",
				nextActionRefs: ["/flowdesk-status", "/flowdesk-export-debug"],
				...(parentWakeModelId !== undefined ? { parentWakeProviderQualifiedModelId: parentWakeModelId } : {}),
			};
		});
		let wakeReadyRows: readonly CompletionWakeReadyRow[] = mergeCompletionWakeReadyRows({
			existing: existingWakeReady?.rows,
			row: workflowWakeReadyRow,
		});
		for (const row of laneWakeRows) {
			wakeReadyRows = mergeCompletionWakeReadyRows({ existing: wakeReadyRows, row });
		}
		if (workflowWakeReadyRow === undefined && terminalCompletedRows.length === 0) {
			const activeParentScopes = new Set(rows.map((row) => row.parentSessionRef ?? "global"));
			wakeReadyRows = wakeReadyRows.filter((row) => {
				if (row.workflowId !== input.workflowId) return true;
				if (row.completionKind !== "awaiting_permission" && row.completionKind !== "diagnostic_attention") return true;
				return !activeParentScopes.has(row.parentSessionRef ?? "global");
			});
		}
		writeFileSync(wakeReadyCachePath, `${JSON.stringify({
			schema_version: "flowdesk.completion_wake_ready_cache.v1",
			observed_at: observedAt,
			expires_at: new Date(Date.parse(observedAt) + 120_000).toISOString(),
			rows: wakeReadyRows,
			authority: { displayOnly: true, realOpenCodeDispatch: false, parentPromptInjection: false, providerCall: false, runtimeExecution: false, actualLaneLaunch: false, fallbackAuthority: false, hardCancelOrNoReplyAuthority: false },
		}, null, 2)}\n`, "utf8");

		const agentTaskLogRows = buildAgentTaskLogIndexRows({
			workflowId: input.workflowId,
			entries: reload.entries,
			resultByLane,
			failedByLane,
			contextByLane,
			childSessionByLane,
			terminalLifecycleByLane,
			laneIds,
		});
		const mergedAgentTaskLogRows = mergeAgentTaskLogIndexRows({
			existing: readJsonRecord(agentTaskLogIndexPath)?.rows,
			rows: agentTaskLogRows,
		});
		writeFileSync(agentTaskLogIndexPath, `${JSON.stringify({
			schema_version: "flowdesk.agent_task_log_index.v1",
			observed_at: observedAt,
			expires_at: new Date(Date.parse(observedAt) + 120_000).toISOString(),
			rows: mergedAgentTaskLogRows,
			authority: { displayOnly: true, redactedTimelineOnly: true, realOpenCodeDispatch: false, providerCall: false, runtimeExecution: false, actualLaneLaunch: false, storesRawPrompts: false, storesProviderPayloads: false },
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
