import { existsSync, mkdirSync, readdirSync, statSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import {
	applyFlowDeskSessionEvidenceWriteIntentsV1,
	FLOWDESK_SESSION_EVIDENCE_CLASSES,
	type FlowDeskAgentTaskInconsistencyV1,
	type FlowDeskLaneStallClassificationV1,
	type FlowDeskLaneStallProjectionResultV1,
	type FlowDeskSessionEvidenceClass,
	type FlowDeskSessionEvidenceReloadEntryV1,
	type FlowDeskSessionEvidenceReloadResultV1,
	prepareFlowDeskSessionEvidenceWriteIntentV1,
	projectFlowDeskLaneStallV1,
	reloadFlowDeskSessionEvidenceV1,
} from "@flowdesk/core";
import { backfillTerminalAgentTaskFailedLanesV1 } from "./stall-recovery.js";

const FLOWDESK_LANE_STALL_TERMINAL_STATES = new Set([
	"complete",
	"incomplete",
	"no_output",
	"missing_verdict",
	"tool_calls_only_no_verdict",
	"aborted",
	"timeout",
	"late_output",
	"orphaned",
	"invocation_failed",
]);

function laneLifecycleStateIsTerminal(state: string): boolean {
	return FLOWDESK_LANE_STALL_TERMINAL_STATES.has(state);
}

function getLaneLifecycleRecordField(
	record: Record<string, unknown>,
	field: "lane_id" | "state" | "updated_at" | "created_at",
): string | undefined {
	const value = record[field];
	return typeof value === "string" && value.length > 0 ? value : undefined;
}

function collectLatestTerminalLifecycleSnapshotByLane(
	reload: FlowDeskSessionEvidenceReloadResultV1,
): Map<
	string,
	{ laneId: string; state: string; evidenceId: string; updatedAtMs: number; updatedAt: string }
> {
	const byLane = new Map<
		string,
		{ laneId: string; state: string; evidenceId: string; updatedAtMs: number; updatedAt: string }
	>();
	for (const entry of reload.entries) {
		if (entry.evidenceClass !== "lane_lifecycle") continue;
		const laneId = getLaneLifecycleRecordField(
			entry.record,
			"lane_id",
		);
		const state = getLaneLifecycleRecordField(entry.record, "state");
		if (laneId === undefined || state === undefined) continue;
		if (!laneLifecycleStateIsTerminal(state)) continue;
		const updatedAt =
			getLaneLifecycleRecordField(entry.record, "updated_at") ??
			getLaneLifecycleRecordField(entry.record, "created_at");
		if (updatedAt === undefined) continue;
		const updatedAtMs = Date.parse(updatedAt);
		if (!Number.isFinite(updatedAtMs)) continue;
		const current = {
			laneId,
			state,
			evidenceId: entry.evidenceId,
			updatedAt,
			updatedAtMs,
		};
		const existing = byLane.get(laneId);
		if (
			existing === undefined ||
			updatedAtMs > existing.updatedAtMs ||
			(updatedAtMs === existing.updatedAtMs &&
				current.evidenceId > existing.evidenceId)
		) {
			byLane.set(laneId, current);
		}
	}
	return byLane;
}

function pruneNonTerminalLifecycleSnapshotsNoLongerValid(
	reload: FlowDeskSessionEvidenceReloadResultV1,
): FlowDeskSessionEvidenceReloadResultV1 {
	const latestTerminalByLane = collectLatestTerminalLifecycleSnapshotByLane(reload);
	if (latestTerminalByLane.size === 0) return reload;

	const entries = reload.entries.filter((entry) => {
		if (entry.evidenceClass !== "lane_lifecycle") return true;
		const laneId = getLaneLifecycleRecordField(entry.record, "lane_id");
		const state = getLaneLifecycleRecordField(entry.record, "state");
		if (laneId === undefined || state === undefined) return true;
		if (!laneLifecycleStateIsTerminal(state)) {
			const terminal = latestTerminalByLane.get(laneId);
			if (terminal === undefined) return true;
			const updatedAt =
				getLaneLifecycleRecordField(entry.record, "updated_at") ??
				getLaneLifecycleRecordField(entry.record, "created_at");
			if (updatedAt === undefined) return true;
			const updatedAtMs = Date.parse(updatedAt);
			if (!Number.isFinite(updatedAtMs)) return true;
			// If a terminal lifecycle state for the lane is present at the same time
			// or later, keep the terminal signal and do not let stale active states
			// dominate projections.
			if (updatedAtMs <= terminal.updatedAtMs) return false;
		}
		return true;
	});

	if (entries.length === reload.entries.length) return reload;
	return { ...reload, entries };
}

function pruneInconsistencySnapshotsNoLongerValid(
	reload: FlowDeskSessionEvidenceReloadResultV1,
): FlowDeskSessionEvidenceReloadResultV1 {
	const terminalLaneIds = new Set<string>();
	for (const entry of reload.entries) {
		if (entry.evidenceClass === "task_result" || entry.evidenceClass === "task_failed") {
			const laneId = getLaneLifecycleRecordField(entry.record, "lane_id");
			if (laneId !== undefined) terminalLaneIds.add(laneId);
		}
	}
	if (terminalLaneIds.size === 0) return reload;
	const entries = reload.entries.filter((entry) => {
		if (entry.evidenceClass !== "agent_task_inconsistency") return true;
		const laneId = getLaneLifecycleRecordField(entry.record, "lane_id");
		return laneId === undefined || !terminalLaneIds.has(laneId);
	});
	if (entries.length === reload.entries.length) return reload;
	return { ...reload, entries };
}

export interface FlowDeskStatusLiveConfigV1 {
	rootDir: string;
	maxWorkflows?: number;
	maxRecentEvidencePerClass?: number;
	laneHeartbeatLateThresholdMs?: number;
	laneHeartbeatStallThresholdMs?: number;
	agentTaskFinalizingInconsistencyGraceMs?: number;
}

export interface FlowDeskStatusLiveRequestV1 {
	workflowId?: string;
}

export interface FlowDeskStatusLiveWorkflowEvidenceSummaryV1 {
	workflowId: string;
	reloadOk: boolean;
	blockedCount: number;
	evidenceCounts: Partial<Record<FlowDeskSessionEvidenceClass, number>>;
	recentEvidenceRefs: Partial<Record<FlowDeskSessionEvidenceClass, string[]>>;
	latestReviewerVerdictLabels: readonly (
		| "pass"
		| "changes_required"
		| "blocked"
		| "inconclusive"
	)[];
	latestLaneLifecycleStates: readonly string[];
	latestRegatePlanState?: string;
	latestProviderAcquisitionStatus?: string;
	latestProviderUsageDispatchability?: string;
	latestProviderUsageFreshness?: string;
	latestProviderUsageResetBucket?: string;
	providerUsageSnapshotCount?: number;
	latestWorkflowAuthoringStatus?: string;
	latestWorkflowAuthoringGoalSummary?: string;
	latestTaskGraphTaskCount?: number;
	latestTaskGraphEdgeCount?: number;
	latestTaskAgentAssignmentCount?: number;
	latestTaskModelSelectionStatus?: string;
	latestTaskModelSelectionBlockedLabels?: readonly string[];
	latestWorkflowSynthesisTasksSummarized?: number;
	latestWorkflowSynthesisConflictDetected?: boolean;
	latestWorkflowDispatchPlanRevisionId?: string;
	latestWorkflowDispatchPlanTaskCount?: number;
	laneStallProjection?: FlowDeskLaneStallProjectionResultV1;
	worstLaneStallClassification?: FlowDeskLaneStallClassificationV1;
	stalledLaneCount?: number;
	progressingLateLaneCount?: number;
	inconsistentFinalizingWithoutTerminalLaneCount?: number;
	laneProgressCards?: readonly FlowDeskStatusLiveLaneProgressCardV1[];
	subtaskActivityRows?: readonly FlowDeskStatusLiveSubtaskActivityRowV1[];
	laneProgressAggregate?: {
		expected: number;
		terminal: number;
		taskResult: number;
		failed: number;
		awaitingPermission: number;
		normalCompleted: number;
		autoNextStepEligible: boolean;
	};
}

export interface FlowDeskStatusLiveLaneProgressCardV1 {
	workflowId: string;
	laneId: string;
	taskId?: string;
	attemptId?: string;
	state?: string;
	classification: FlowDeskLaneStallClassificationV1;
	secondsSinceLastSignal?: number;
	lastSignalSource?: string;
	agentRef?: string;
	providerQualifiedModelId?: string;
	promptPreview?: string;
	promptTextTruncated?: boolean;
	nudgeCount?: number;
	progressPhase?: string;
	progressLabel?: string;
	progressObservedAt?: string;
	verdictLabel?: "pass" | "changes_required" | "blocked" | "inconclusive";
	completionStatus?: string;
	outputKind?: string;
	usableForSynthesis?: boolean;
	failureHint?: string;
	statusCommandRef: "/flowdesk-status";
	debugCommandRef: "/flowdesk-export-debug";
}

export interface FlowDeskStatusLiveSubtaskActivityRowV1 {
	workflowId: string;
	laneId: string;
	taskId?: string;
	attemptId?: string;
	state?: string;
	classification: FlowDeskLaneStallClassificationV1;
	progressPhase?: string;
	progressLabel?: string;
	lastObservedAt?: string;
	nudgeCount?: number;
	completionStatus?: string;
	outputKind?: string;
	usableForSynthesis?: boolean;
	verdictLabel?: "pass" | "changes_required" | "blocked" | "inconclusive";
	failureHint?: string;
	recoveryActionRefs?: readonly (
		| "/flowdesk-status"
		| "/flowdesk-retry"
		| "/flowdesk-resume"
		| "/flowdesk-abort"
		| "/flowdesk-export-debug"
	)[];
	statusCommandRef: "/flowdesk-status";
	debugCommandRef: "/flowdesk-export-debug";
}

export interface FlowDeskStatusLiveResultV1 {
	status: "status_live_collected" | "blocked_before_status_live";
	observedAt: string;
	rootDir: string;
	requestedWorkflowId?: string;
	resolvedWorkflowIds: readonly string[];
	workflows: readonly FlowDeskStatusLiveWorkflowEvidenceSummaryV1[];
	worstLaneStallClassification?: FlowDeskLaneStallClassificationV1;
	totalStalledLaneCount?: number;
	totalProgressingLateLaneCount?: number;
	totalInconsistentFinalizingWithoutTerminalLaneCount?: number;
	redactedBlockReason?: string;
	summaryForUser?: string;
	safeNextActions: readonly (
		| "/flowdesk-status"
		| "/flowdesk-doctor"
		| "/flowdesk-export-debug"
	)[];
	authority: {
		realOpenCodeDispatch: false;
		providerCall: false;
		runtimeExecution: false;
		actualLaneLaunch: false;
		fallbackAuthority: false;
		hardCancelOrNoReplyAuthority: false;
		toolAuthority: false;
		statusEvidenceObserved: boolean;
	};
}

const FLOWDESK_SESSION_RECORD_ROOT = ".flowdesk/sessions";

function blockedAuthority() {
	return {
		realOpenCodeDispatch: false as const,
		providerCall: false as const,
		runtimeExecution: false as const,
		actualLaneLaunch: false as const,
		fallbackAuthority: false as const,
		hardCancelOrNoReplyAuthority: false as const,
		toolAuthority: false as const,
		statusEvidenceObserved: false,
	};
}

function safeNextActions(): readonly (
	| "/flowdesk-status"
	| "/flowdesk-doctor"
	| "/flowdesk-export-debug"
)[] {
	return ["/flowdesk-status", "/flowdesk-doctor", "/flowdesk-export-debug"];
}

function listSessionWorkflowIds(rootDir: string, max: number): string[] {
	const sessionsDir = join(rootDir, FLOWDESK_SESSION_RECORD_ROOT);
	if (!existsSync(sessionsDir)) return [];
	let entries: string[];
	try {
		entries = readdirSync(sessionsDir);
	} catch {
		return [];
	}
	const workflowEntries: { name: string; mtimeMs: number }[] = [];
	for (const name of entries) {
		const candidatePath = join(sessionsDir, name);
		let stat: ReturnType<typeof statSync>;
		try {
			stat = statSync(candidatePath);
		} catch {
			continue;
		}
		if (!stat.isDirectory()) continue;
		workflowEntries.push({ name, mtimeMs: stat.mtimeMs });
	}
	workflowEntries.sort((a, b) => b.mtimeMs - a.mtimeMs);
	return workflowEntries.slice(0, max).map((entry) => entry.name);
}

function getStringField(
	record: Record<string, unknown>,
	key: string,
): string | undefined {
	const value = record[key];
	return typeof value === "string" ? value : undefined;
}

function getPositiveIntegerField(
	record: Record<string, unknown>,
	key: string,
): number | undefined {
	const value = record[key];
	return typeof value === "number" && Number.isInteger(value) && value > 0
		? value
		: undefined;
}

const DEFAULT_AGENT_TASK_FINALIZING_INCONSISTENCY_GRACE_MS = 90_000;
const MIN_AGENT_TASK_FINALIZING_INCONSISTENCY_GRACE_MS = 30_000;
const MAX_AGENT_TASK_FINALIZING_INCONSISTENCY_GRACE_MS = 600_000;

function clampFinalizingInconsistencyGraceMs(value: number | undefined): number {
	if (typeof value !== "number" || !Number.isFinite(value) || value <= 0)
		return DEFAULT_AGENT_TASK_FINALIZING_INCONSISTENCY_GRACE_MS;
	return Math.min(
		MAX_AGENT_TASK_FINALIZING_INCONSISTENCY_GRACE_MS,
		Math.max(MIN_AGENT_TASK_FINALIZING_INCONSISTENCY_GRACE_MS, Math.floor(value)),
	);
}

function finalizingInconsistencyEvidenceId(laneId: string): string {
	return `agent-task-inconsistency-${laneId}-finalizing-without-terminal`;
}

function materializeFinalizingWithoutTerminalInconsistencies(input: {
	workflowId: string;
	rootDir: string;
	reload: FlowDeskSessionEvidenceReloadResultV1;
	observedAt: string;
	graceMs: number;
}): boolean {
	const observedAtMs = Date.parse(input.observedAt);
	if (!Number.isFinite(observedAtMs)) return false;
	const terminalLaneIds = new Set<string>();
	const existingInconsistencyIds = new Set<string>();
	const attemptIdByLane = new Map<string, string>();
	const taskIdByLane = new Map<string, string>();
	const latestActiveSignalByLane = new Map<string, number>();
	const latestFinalizingByLane = new Map<
		string,
		{
			laneId: string;
			attemptId?: string;
			taskId?: string;
			progressSeq?: number;
			observedAt: string;
			observedAtMs: number;
		}
	>();
	for (const entry of input.reload.entries) {
		const laneId = getStringField(entry.record, "lane_id");
		if (laneId !== undefined) {
			if (entry.evidenceClass === "lane_lifecycle" || entry.evidenceClass === "lane_heartbeat") {
				const attemptId = getStringField(entry.record, "attempt_id");
				if (attemptId !== undefined) attemptIdByLane.set(laneId, attemptId);
				const state = getStringField(entry.record, "state");
				const observedAt =
					getStringField(entry.record, "updated_at") ??
					getStringField(entry.record, "observed_at") ??
					getStringField(entry.record, "created_at");
				const observedAtMs = observedAt === undefined ? NaN : Date.parse(observedAt);
				if (
					(state === "created" ||
						state === "running" ||
						state === "awaiting_dependency" ||
						state === "cooldown") &&
					Number.isFinite(observedAtMs)
				) {
					const current = latestActiveSignalByLane.get(laneId);
					if (current === undefined || observedAtMs > current)
						latestActiveSignalByLane.set(laneId, observedAtMs);
				}
			}
			if (entry.evidenceClass === "agent_task_context") {
				const taskId = getStringField(entry.record, "task_id");
				if (taskId !== undefined) taskIdByLane.set(laneId, taskId);
			}
		}
		if (entry.evidenceClass === "task_result" || entry.evidenceClass === "task_failed") {
			if (laneId !== undefined) terminalLaneIds.add(laneId);
			continue;
		}
		if (entry.evidenceClass === "agent_task_inconsistency") {
			existingInconsistencyIds.add(entry.evidenceId);
			continue;
		}
		if (entry.evidenceClass !== "agent_task_progress") continue;
		if (laneId === undefined) continue;
		if (getStringField(entry.record, "phase") !== "finalizing") continue;
		const progressObservedAt = getStringField(entry.record, "observed_at");
		if (progressObservedAt === undefined) continue;
		const progressObservedAtMs = Date.parse(progressObservedAt);
		if (!Number.isFinite(progressObservedAtMs)) continue;
		const current = latestFinalizingByLane.get(laneId);
		if (current !== undefined && current.observedAtMs > progressObservedAtMs)
			continue;
		latestFinalizingByLane.set(laneId, {
			laneId,
			attemptId: attemptIdByLane.get(laneId),
			taskId: getStringField(entry.record, "task_id"),
			progressSeq: getPositiveIntegerField(entry.record, "progress_seq"),
			observedAt: progressObservedAt,
			observedAtMs: progressObservedAtMs,
		});
	}
	const intents: NonNullable<ReturnType<typeof prepareFlowDeskSessionEvidenceWriteIntentV1>["writeIntent"]>[] = [];
	for (const progress of latestFinalizingByLane.values()) {
		if (terminalLaneIds.has(progress.laneId)) continue;
		const activeSignalMs = latestActiveSignalByLane.get(progress.laneId);
		const finalizingAgeMs = observedAtMs - progress.observedAtMs;
		const activeSignalAgeMs =
			activeSignalMs === undefined ? 0 : observedAtMs - activeSignalMs;
		if (finalizingAgeMs < input.graceMs && activeSignalAgeMs < input.graceMs)
			continue;
		const attemptId = progress.attemptId ?? attemptIdByLane.get(progress.laneId);
		const taskId = progress.taskId ?? taskIdByLane.get(progress.laneId);
		const progressSeq = progress.progressSeq;
		if (attemptId === undefined || taskId === undefined || progressSeq === undefined)
			continue;
		const evidenceId = finalizingInconsistencyEvidenceId(progress.laneId);
		if (existingInconsistencyIds.has(evidenceId)) continue;
		const record: FlowDeskAgentTaskInconsistencyV1 = {
			schema_version: "flowdesk.agent_task_inconsistency.v1",
			workflow_id: input.workflowId,
			attempt_id: attemptId,
			lane_id: progress.laneId,
			task_id: taskId,
			last_progress_seq: progressSeq,
			last_progress_observed_at: progress.observedAt,
			inconsistency_kind: "finalizing_without_terminal",
			grace_window_ms: input.graceMs,
			grace_source_label:
				input.graceMs === DEFAULT_AGENT_TASK_FINALIZING_INCONSISTENCY_GRACE_MS
					? "default_status_live_finalizing_inconsistency_grace"
					: "configured_status_live_finalizing_inconsistency_grace",
			observed_at: input.observedAt,
			safe_next_actions: [
				"/flowdesk-status",
				"/flowdesk-abort",
				"/flowdesk-retry",
				"/flowdesk-doctor",
				"/flowdesk-export-debug",
			],
			redaction_version: "v1",
			dispatch_authority_enabled: false,
		};
		const prepared = prepareFlowDeskSessionEvidenceWriteIntentV1({
			workflowId: input.workflowId,
			evidenceId,
			record,
		});
		if (prepared.ok && prepared.writeIntent !== undefined)
			intents.push(prepared.writeIntent);
	}
	if (intents.length === 0) return false;
	const applied = applyFlowDeskSessionEvidenceWriteIntentsV1(input.rootDir, intents);
	return applied.ok && applied.writtenPaths.length > 0;
}

function compactPromptPreview(value: string | undefined, max = 96): string | undefined {
	if (value === undefined) return undefined;
	const compact = value.replace(/\s+/g, " ").trim();
	if (compact.length === 0) return undefined;
	return compact.length > max ? `${compact.slice(0, Math.max(0, max - 1))}…` : compact;
}

function summarizeWorkflow(
	workflowId: string,
	reload: FlowDeskSessionEvidenceReloadResultV1,
	maxRecent: number,
): FlowDeskStatusLiveWorkflowEvidenceSummaryV1 {
	const counts: Partial<Record<FlowDeskSessionEvidenceClass, number>> = {};
	const recent: Partial<Record<FlowDeskSessionEvidenceClass, string[]>> = {};
	const reviewerVerdictLabels: (
		| "pass"
		| "changes_required"
		| "blocked"
		| "inconclusive"
	)[] = [];
	const laneLifecycleStates: string[] = [];
	let regatePlanState: string | undefined;
	let providerAcquisitionStatus: string | undefined;
	let workflowAuthoringStatus: string | undefined;
	let workflowAuthoringGoalSummary: string | undefined;
	let taskGraphTaskCount: number | undefined;
	let taskGraphEdgeCount: number | undefined;
	let taskAgentAssignmentCount: number | undefined;
	let taskModelSelectionStatus: string | undefined;
	let taskModelSelectionBlockedLabels: string[] | undefined;
	let workflowSynthesisTasksSummarized: number | undefined;
	let workflowSynthesisConflictDetected: boolean | undefined;
	let workflowDispatchPlanRevisionId: string | undefined;
	let workflowDispatchPlanTaskCount: number | undefined;

	for (const evidenceClass of FLOWDESK_SESSION_EVIDENCE_CLASSES) {
		const classEntries = reload.entries.filter(
			(entry: FlowDeskSessionEvidenceReloadEntryV1) =>
				entry.evidenceClass === evidenceClass,
		);
		if (classEntries.length === 0) continue;
		counts[evidenceClass] = classEntries.length;
		recent[evidenceClass] = classEntries
			.slice(-maxRecent)
			.map((entry) => entry.evidenceId);

		if (evidenceClass === "reviewer_verdict") {
			for (const entry of classEntries.slice(-maxRecent)) {
				const label = getStringField(entry.record, "verdict_label");
				if (
					label === "pass" ||
					label === "changes_required" ||
					label === "blocked" ||
					label === "inconclusive"
				)
					reviewerVerdictLabels.push(label);
			}
		}
		if (evidenceClass === "lane_lifecycle") {
			for (const entry of classEntries.slice(-maxRecent)) {
				const state = getStringField(entry.record, "state");
				if (state !== undefined) laneLifecycleStates.push(state);
			}
		}
		if (evidenceClass === "fallback_regate_plan") {
			const last = classEntries[classEntries.length - 1];
			if (last !== undefined) {
				const state = getStringField(last.record, "state");
				if (state !== undefined) regatePlanState = state;
			}
		}
		if (
			evidenceClass ===
			"exact_model_availability_cache_provider_acquisition_result"
		) {
			const last = classEntries[classEntries.length - 1];
			if (last !== undefined) {
				const acquisitionStatus =
					getStringField(last.record, "status") ??
					getStringField(last.record, "state");
				if (acquisitionStatus !== undefined)
					providerAcquisitionStatus = acquisitionStatus;
			}
		}
		if (evidenceClass === "workflow_authoring_result") {
			const last = classEntries[classEntries.length - 1];
			if (last !== undefined) {
				workflowAuthoringStatus = getStringField(last.record, "status");
				workflowAuthoringGoalSummary = getStringField(last.record, "goal_summary");
			}
		}
		if (evidenceClass === "task_graph") {
			const last = classEntries[classEntries.length - 1];
			if (last !== undefined) {
				const nodes = last.record.nodes;
				const edges = last.record.edges;
				if (Array.isArray(nodes)) taskGraphTaskCount = nodes.length;
				if (Array.isArray(edges)) taskGraphEdgeCount = edges.length;
			}
		}
		if (evidenceClass === "task_agent_assignment") {
			taskAgentAssignmentCount = classEntries.length;
		}
		if (evidenceClass === "task_model_selection") {
			const last = classEntries[classEntries.length - 1];
			if (last !== undefined) {
				taskModelSelectionStatus = getStringField(last.record, "selection_status");
				const blockedLabels = last.record.blocked_labels;
				if (Array.isArray(blockedLabels)) {
					taskModelSelectionBlockedLabels = blockedLabels.filter(
						(label): label is string => typeof label === "string",
					);
				}
			}
		}
		if (evidenceClass === "workflow_synthesis_result") {
			const last = classEntries[classEntries.length - 1];
			if (last !== undefined) {
				const tasks = last.record.tasks_summarized;
				if (typeof tasks === "number") workflowSynthesisTasksSummarized = tasks;
				workflowSynthesisConflictDetected = last.record.conflict_detected === true;
			}
		}
		if (evidenceClass === "workflow_dispatch_plan") {
			const last = classEntries[classEntries.length - 1];
			if (last !== undefined) {
				workflowDispatchPlanRevisionId = getStringField(
					last.record,
					"plan_revision_id",
				);
				const tasks = last.record.tasks;
				if (Array.isArray(tasks)) workflowDispatchPlanTaskCount = tasks.length;
			}
		}
	}

	const providerUsageSummary = summarizeLatestProviderUsageSnapshot(
		reload.entries,
	);

	return {
		workflowId,
		reloadOk: reload.ok,
		blockedCount: reload.blocked.length,
		evidenceCounts: counts,
		recentEvidenceRefs: recent,
		latestReviewerVerdictLabels: reviewerVerdictLabels,
		latestLaneLifecycleStates: laneLifecycleStates,
		...(regatePlanState !== undefined
			? { latestRegatePlanState: regatePlanState }
			: {}),
		...(providerAcquisitionStatus !== undefined
			? { latestProviderAcquisitionStatus: providerAcquisitionStatus }
			: {}),
		...(providerUsageSummary.dispatchability !== undefined
			? {
					latestProviderUsageDispatchability:
						providerUsageSummary.dispatchability,
				}
			: {}),
		...(providerUsageSummary.freshness !== undefined
			? { latestProviderUsageFreshness: providerUsageSummary.freshness }
			: {}),
		...(providerUsageSummary.resetBucket !== undefined
			? { latestProviderUsageResetBucket: providerUsageSummary.resetBucket }
			: {}),
		...(providerUsageSummary.count > 0
			? { providerUsageSnapshotCount: providerUsageSummary.count }
			: {}),
		...(workflowAuthoringStatus !== undefined
			? { latestWorkflowAuthoringStatus: workflowAuthoringStatus }
			: {}),
		...(workflowAuthoringGoalSummary !== undefined
			? { latestWorkflowAuthoringGoalSummary: workflowAuthoringGoalSummary }
			: {}),
		...(taskGraphTaskCount !== undefined
			? { latestTaskGraphTaskCount: taskGraphTaskCount }
			: {}),
		...(taskGraphEdgeCount !== undefined
			? { latestTaskGraphEdgeCount: taskGraphEdgeCount }
			: {}),
		...(taskAgentAssignmentCount !== undefined
			? { latestTaskAgentAssignmentCount: taskAgentAssignmentCount }
			: {}),
		...(taskModelSelectionStatus !== undefined
			? { latestTaskModelSelectionStatus: taskModelSelectionStatus }
			: {}),
		...(taskModelSelectionBlockedLabels !== undefined
			? { latestTaskModelSelectionBlockedLabels: taskModelSelectionBlockedLabels }
			: {}),
		...(workflowSynthesisTasksSummarized !== undefined
			? { latestWorkflowSynthesisTasksSummarized: workflowSynthesisTasksSummarized }
			: {}),
		...(workflowSynthesisConflictDetected !== undefined
			? { latestWorkflowSynthesisConflictDetected: workflowSynthesisConflictDetected }
			: {}),
		...(workflowDispatchPlanRevisionId !== undefined
			? {
					latestWorkflowDispatchPlanRevisionId:
						workflowDispatchPlanRevisionId,
				}
			: {}),
		...(workflowDispatchPlanTaskCount !== undefined
			? { latestWorkflowDispatchPlanTaskCount: workflowDispatchPlanTaskCount }
			: {}),
	};
}

function buildLaneProgressCards(
	workflowId: string,
	reload: FlowDeskSessionEvidenceReloadResultV1,
	projection: FlowDeskLaneStallProjectionResultV1,
): readonly FlowDeskStatusLiveLaneProgressCardV1[] {
	const lifecycleMeta = new Map<
		string,
		{
			updatedAtMs: number;
			state?: string;
			agentRef?: string;
			providerQualifiedModelId?: string;
			verdictRef?: string;
		}
	>();
	const verdictLabels = new Map<
		string,
		"pass" | "changes_required" | "blocked" | "inconclusive"
	>();
	const taskResultLaneIds = new Set<string>();
	const taskResultByLane = new Map<
		string,
		{
			taskId?: string;
			completionStatus?: string;
			outputKind?: string;
			usableForSynthesis?: boolean;
		}
	>();
	const agentTaskContextByLane = new Map<
		string,
		{ taskId?: string; promptPreview?: string; promptTextTruncated?: boolean }
	>();
	const childSessionByLane = new Map<string, { nudgeCount?: number }>();
	const agentTaskProgressByLane = new Map<
		string,
		{ observedAtMs: number; phase?: string; label?: string; observedAt?: string }
	>();
	for (const entry of reload.entries) {
		if (entry.evidenceClass === "agent_task_progress") {
			const laneId = getStringField(entry.record, "lane_id");
			if (laneId !== undefined) {
				const observedAt = getStringField(entry.record, "observed_at");
				const observedAtMs = observedAt === undefined ? 0 : Date.parse(observedAt);
				const current = agentTaskProgressByLane.get(laneId);
				if (current === undefined || current.observedAtMs <= observedAtMs) {
					agentTaskProgressByLane.set(laneId, {
						observedAtMs: Number.isFinite(observedAtMs) ? observedAtMs : 0,
						phase: getStringField(entry.record, "phase"),
						label: getStringField(entry.record, "progress_label"),
						observedAt,
					});
				}
			}
			continue;
		}
		if (entry.evidenceClass === "agent_task_context") {
			const laneId = getStringField(entry.record, "lane_id");
			if (laneId !== undefined) {
				agentTaskContextByLane.set(laneId, {
					taskId: getStringField(entry.record, "task_id"),
					promptPreview: compactPromptPreview(getStringField(entry.record, "prompt_text")),
					promptTextTruncated: entry.record.prompt_text_truncated === true,
				});
			}
			continue;
		}
		if (entry.evidenceClass === "agent_task_child_session") {
			const laneId = getStringField(entry.record, "lane_id");
			const nudgeCount = entry.record.nudge_count;
			if (laneId !== undefined) {
				childSessionByLane.set(laneId, {
					...(typeof nudgeCount === "number" && Number.isFinite(nudgeCount)
						? { nudgeCount }
						: {}),
				});
			}
			continue;
		}
		if (entry.evidenceClass === "task_result") {
			const laneId = getStringField(entry.record, "lane_id");
			if (laneId !== undefined) {
				taskResultLaneIds.add(laneId);
				taskResultByLane.set(laneId, {
					taskId: getStringField(entry.record, "task_id"),
					completionStatus: getStringField(entry.record, "completion_status"),
					outputKind: getStringField(entry.record, "output_kind"),
					...(typeof entry.record.usable_for_synthesis === "boolean"
						? { usableForSynthesis: entry.record.usable_for_synthesis }
						: {}),
				});
			}
			continue;
		}
		if (entry.evidenceClass === "reviewer_verdict") {
			const label = getStringField(entry.record, "verdict_label");
			if (
				label === "pass" ||
				label === "changes_required" ||
				label === "blocked" ||
				label === "inconclusive"
			)
				verdictLabels.set(entry.evidenceId, label);
		}
		if (entry.evidenceClass !== "lane_lifecycle") continue;
		const laneId = getStringField(entry.record, "lane_id");
		if (laneId === undefined) continue;
		const updatedAtRaw =
			getStringField(entry.record, "updated_at") ??
			getStringField(entry.record, "created_at");
		const updatedAtMs = updatedAtRaw === undefined ? 0 : Date.parse(updatedAtRaw);
		const current = lifecycleMeta.get(laneId);
		if (current !== undefined && current.updatedAtMs > updatedAtMs) continue;
		lifecycleMeta.set(laneId, {
			updatedAtMs: Number.isFinite(updatedAtMs) ? updatedAtMs : 0,
			state: getStringField(entry.record, "state"),
			agentRef: getStringField(entry.record, "agent_ref"),
			providerQualifiedModelId: getStringField(
				entry.record,
				"provider_qualified_model_id",
			),
			verdictRef: getStringField(entry.record, "verdict_ref"),
		});
	}
	return projection.entries.slice(0, 6).map((entry) => {
		const meta = lifecycleMeta.get(entry.laneId);
		const context = agentTaskContextByLane.get(entry.laneId);
		const childSession = childSessionByLane.get(entry.laneId);
		const progress = agentTaskProgressByLane.get(entry.laneId);
		const taskResult = taskResultByLane.get(entry.laneId);
		const projectedState = meta?.state === "incomplete" && taskResultLaneIds.has(entry.laneId)
			? "task_result"
			: (meta?.state ?? entry.lifecycleState);
		const taskId = context?.taskId ?? taskResult?.taskId;
		const verdictLabel =
			meta?.verdictRef === undefined
				? undefined
				: verdictLabels.get(meta.verdictRef);
		return {
			workflowId,
			laneId: entry.laneId,
			...(taskId === undefined ? {} : { taskId }),
			attemptId: entry.attemptId,
			state: projectedState,
			classification: entry.classification,
			...(entry.secondsSinceLastSignal === undefined
				? {}
				: { secondsSinceLastSignal: entry.secondsSinceLastSignal }),
			...(entry.lastSignalSource === undefined
				? {}
				: { lastSignalSource: entry.lastSignalSource }),
			...(meta?.agentRef === undefined ? {} : { agentRef: meta.agentRef }),
			...(meta?.providerQualifiedModelId === undefined
				? {}
				: { providerQualifiedModelId: meta.providerQualifiedModelId }),
			...(context?.promptPreview === undefined ? {} : { promptPreview: context.promptPreview }),
			...(context?.promptTextTruncated === undefined ? {} : { promptTextTruncated: context.promptTextTruncated }),
			...(childSession?.nudgeCount === undefined ? {} : { nudgeCount: childSession.nudgeCount }),
			...(progress?.phase === undefined ? {} : { progressPhase: progress.phase }),
			...(progress?.label === undefined ? {} : { progressLabel: progress.label }),
			...(progress?.observedAt === undefined ? {} : { progressObservedAt: progress.observedAt }),
			...(verdictLabel === undefined ? {} : { verdictLabel }),
			...(taskResult?.completionStatus === undefined
				? {}
				: { completionStatus: taskResult.completionStatus }),
			...(taskResult?.outputKind === undefined
				? {}
				: { outputKind: taskResult.outputKind }),
			...(taskResult?.usableForSynthesis === undefined
				? {}
				: { usableForSynthesis: taskResult.usableForSynthesis }),
			...(entry.failureHint === undefined
				? {}
				: { failureHint: entry.failureHint }),
			statusCommandRef: "/flowdesk-status" as const,
			debugCommandRef: "/flowdesk-export-debug" as const,
		};
	});
}

function buildLaneProgressAggregate(cards: readonly FlowDeskStatusLiveLaneProgressCardV1[]): NonNullable<FlowDeskStatusLiveWorkflowEvidenceSummaryV1["laneProgressAggregate"]> {
	const expected = cards.length;
	const terminal = cards.filter(card => card.classification === "terminal").length;
	const taskResult = cards.filter(card => card.state === "task_result").length;
	const failed = cards.filter(card => card.failureHint !== undefined || card.state === "invocation_failed" || card.state === "task_failed").length;
	const awaitingPermission = cards.filter(card => card.progressPhase === "awaiting_permission").length;
	const normalCompleted = cards.filter(card =>
		card.state === "task_result" &&
		card.classification === "terminal" &&
		card.completionStatus !== "partial" &&
		card.usableForSynthesis !== false &&
		card.failureHint === undefined,
	).length;
	return {
		expected,
		terminal,
		taskResult,
		failed,
		awaitingPermission,
		normalCompleted,
		autoNextStepEligible: expected > 0 && normalCompleted === expected,
	};
}

function buildSubtaskActivityRows(
	cards: readonly FlowDeskStatusLiveLaneProgressCardV1[],
): readonly FlowDeskStatusLiveSubtaskActivityRowV1[] {
	return cards.map((card) => {
		const recoveryActionRefs =
			card.failureHint !== undefined ||
			card.classification === "stalled" ||
			card.classification === "progressing_late"
				? (["/flowdesk-status", "/flowdesk-retry", "/flowdesk-resume", "/flowdesk-abort", "/flowdesk-export-debug"] as const)
				: (["/flowdesk-status", "/flowdesk-export-debug"] as const);
		return {
			workflowId: card.workflowId,
			laneId: card.laneId,
			...(card.taskId === undefined ? {} : { taskId: card.taskId }),
			...(card.attemptId === undefined ? {} : { attemptId: card.attemptId }),
			...(card.state === undefined ? {} : { state: card.state }),
			classification: card.classification,
			...(card.progressPhase === undefined ? {} : { progressPhase: card.progressPhase }),
			...(card.progressLabel === undefined ? {} : { progressLabel: card.progressLabel }),
			...(card.progressObservedAt === undefined ? {} : { lastObservedAt: card.progressObservedAt }),
			...(card.nudgeCount === undefined ? {} : { nudgeCount: card.nudgeCount }),
			...(card.completionStatus === undefined ? {} : { completionStatus: card.completionStatus }),
			...(card.outputKind === undefined ? {} : { outputKind: card.outputKind }),
			...(card.usableForSynthesis === undefined ? {} : { usableForSynthesis: card.usableForSynthesis }),
			...(card.verdictLabel === undefined ? {} : { verdictLabel: card.verdictLabel }),
			...(card.failureHint === undefined ? {} : { failureHint: card.failureHint }),
			recoveryActionRefs,
			statusCommandRef: "/flowdesk-status" as const,
			debugCommandRef: "/flowdesk-export-debug" as const,
		};
	});
}

function summarizeLatestProviderUsageSnapshot(
	entries: readonly FlowDeskSessionEvidenceReloadEntryV1[],
): {
	count: number;
	dispatchability?: string;
	freshness?: string;
	resetBucket?: string;
} {
	const snapshots = entries.filter(
		(entry) => entry.evidenceClass === "provider_usage_snapshot",
	);
	if (snapshots.length === 0) return { count: 0 };
	const last = snapshots[snapshots.length - 1];
	if (last === undefined) return { count: snapshots.length };
	return {
		count: snapshots.length,
		dispatchability: getStringField(last.record, "dispatchability"),
		freshness: getStringField(last.record, "freshness"),
		resetBucket: getStringField(last.record, "reset_bucket"),
	};
}

export async function executeFlowDeskStatusLiveV1(input: {
	config: FlowDeskStatusLiveConfigV1;
	request?: FlowDeskStatusLiveRequestV1;
	now?: () => Date;
}): Promise<FlowDeskStatusLiveResultV1> {
	const observedAt = (input.now ? input.now() : new Date()).toISOString();
	const rootDir = input.config.rootDir;
	const requestedWorkflowId = input.request?.workflowId?.trim();
	const maxWorkflows = Math.max(input.config.maxWorkflows ?? 5, 1);
	const maxRecentEvidencePerClass = Math.max(
		input.config.maxRecentEvidencePerClass ?? 3,
		1,
	);

	if (typeof rootDir !== "string" || rootDir.trim().length === 0) {
		return {
			status: "blocked_before_status_live",
			observedAt,
			rootDir: rootDir ?? "",
			...(requestedWorkflowId ? { requestedWorkflowId } : {}),
			resolvedWorkflowIds: [],
			workflows: [],
			redactedBlockReason:
				"status live tool requires a durable state root directory",
			safeNextActions: safeNextActions(),
			authority: blockedAuthority(),
		};
	}

	const workflowIds =
		requestedWorkflowId !== undefined && requestedWorkflowId.length > 0
			? [requestedWorkflowId]
			: listSessionWorkflowIds(rootDir, maxWorkflows);

	if (workflowIds.length === 0) {
		return {
			status: "blocked_before_status_live",
			observedAt,
			rootDir,
			...(requestedWorkflowId ? { requestedWorkflowId } : {}),
			resolvedWorkflowIds: [],
			workflows: [],
			redactedBlockReason:
				requestedWorkflowId !== undefined && requestedWorkflowId.length > 0
					? `no durable session evidence for workflow ${requestedWorkflowId}`
					: "no durable session workflows found under the configured durable state root",
			safeNextActions: safeNextActions(),
			authority: blockedAuthority(),
		};
	}

	const workflows: FlowDeskStatusLiveWorkflowEvidenceSummaryV1[] = [];
	for (const workflowId of workflowIds) {
		backfillTerminalAgentTaskFailedLanesV1({
			workflowId,
			rootDir,
			now: new Date(observedAt),
		});
		let reload = reloadFlowDeskSessionEvidenceV1({
			workflowId,
			rootDir,
		});
		const graceMs = clampFinalizingInconsistencyGraceMs(
			input.config.agentTaskFinalizingInconsistencyGraceMs,
		);
		const wroteInconsistency = materializeFinalizingWithoutTerminalInconsistencies({
			workflowId,
			rootDir,
			reload,
			observedAt,
			graceMs,
		});
		if (wroteInconsistency) {
			reload = reloadFlowDeskSessionEvidenceV1({
				workflowId,
				rootDir,
			});
		}
		const summary = summarizeWorkflow(workflowId, reload, maxRecentEvidencePerClass);
		const projectionReload = pruneInconsistencySnapshotsNoLongerValid(pruneNonTerminalLifecycleSnapshotsNoLongerValid(reload));
		const projection = projectFlowDeskLaneStallV1({
			workflowId,
			reload: projectionReload,
			observedAt,
			...(input.config.laneHeartbeatLateThresholdMs === undefined
				? {}
				: { lateThresholdMs: input.config.laneHeartbeatLateThresholdMs }),
			...(input.config.laneHeartbeatStallThresholdMs === undefined
				? {}
				: { stallThresholdMs: input.config.laneHeartbeatStallThresholdMs }),
		});
		summary.laneStallProjection = projection;
		summary.worstLaneStallClassification = projection.worstClassification;
		summary.stalledLaneCount = projection.totalStalledLanes;
		summary.progressingLateLaneCount = projection.totalLateLanes;
		summary.inconsistentFinalizingWithoutTerminalLaneCount =
			projection.totalInconsistentLanes;
		summary.laneProgressCards = buildLaneProgressCards(
			workflowId,
			projectionReload,
			projection,
		);
		summary.subtaskActivityRows = buildSubtaskActivityRows(summary.laneProgressCards);
		summary.laneProgressAggregate = buildLaneProgressAggregate(summary.laneProgressCards);
		workflows.push(summary);
	}

	const observed = workflows.some((summary) =>
		Object.values(summary.evidenceCounts).some(
			(count) => typeof count === "number" && count > 0,
		),
	);

	const totalStalled = workflows.reduce(
		(sum, summary) => sum + (summary.stalledLaneCount ?? 0),
		0,
	);
	const totalLate = workflows.reduce(
		(sum, summary) => sum + (summary.progressingLateLaneCount ?? 0),
		0,
	);
	const totalInconsistent = workflows.reduce(
		(sum, summary) =>
			sum + (summary.inconsistentFinalizingWithoutTerminalLaneCount ?? 0),
		0,
	);
	const worstLaneStallClassification: FlowDeskLaneStallClassificationV1 =
		workflows.some(
			(summary) =>
				summary.worstLaneStallClassification ===
				"inconsistent_finalizing_without_terminal",
		)
			? "inconsistent_finalizing_without_terminal"
			: workflows.some(
			(summary) => summary.worstLaneStallClassification === "stalled",
		)
			? "stalled"
			: workflows.some(
						(summary) =>
							summary.worstLaneStallClassification === "progressing_late",
					)
				? "progressing_late"
				: workflows.some(
							(summary) =>
								summary.worstLaneStallClassification === "progressing_normal",
						)
					? "progressing_normal"
					: workflows.some(
								(summary) =>
									summary.worstLaneStallClassification === "terminal",
							)
						? "terminal"
						: "unknown";

	const summaryForUser = buildStatusLiveSummaryForUser({
		workflows,
		worstLaneStallClassification,
		totalStalled,
		totalLate,
		totalInconsistent,
		requestedWorkflowId,
	});

	materializeSubtaskActivitySidebarCacheV1({
		rootDir,
		observedAt,
		workflows,
	});

	return {
		status: "status_live_collected",
		observedAt,
		rootDir,
		...(requestedWorkflowId ? { requestedWorkflowId } : {}),
		resolvedWorkflowIds: workflowIds,
		workflows,
		worstLaneStallClassification,
		totalStalledLaneCount: totalStalled,
		totalProgressingLateLaneCount: totalLate,
		totalInconsistentFinalizingWithoutTerminalLaneCount: totalInconsistent,
		summaryForUser,
		safeNextActions: safeNextActions(),
		authority: {
			realOpenCodeDispatch: false,
			providerCall: false,
			runtimeExecution: false,
			actualLaneLaunch: false,
			fallbackAuthority: false,
			hardCancelOrNoReplyAuthority: false,
			toolAuthority: false,
			statusEvidenceObserved: observed,
		},
	};
}

function materializeSubtaskActivitySidebarCacheV1(input: {
	rootDir: string;
	observedAt: string;
	workflows: readonly FlowDeskStatusLiveWorkflowEvidenceSummaryV1[];
}): void {
	try {
		const rows = input.workflows.flatMap((workflow) => workflow.subtaskActivityRows ?? []).slice(0, 8);
		const uiDir = join(input.rootDir, ".flowdesk", "ui");
		mkdirSync(uiDir, { recursive: true });
		writeFileSync(
			join(uiDir, "subtask-activity-sidebar.json"),
			`${JSON.stringify(
				{
					schema_version: "flowdesk.subtask_activity_sidebar_cache.v1",
					observed_at: input.observedAt,
					expires_at: new Date(Date.parse(input.observedAt) + 120_000).toISOString(),
					rows,
					authority: {
						displayOnly: true,
						realOpenCodeDispatch: false,
						providerCall: false,
						runtimeExecution: false,
						fallbackAuthority: false,
						hardCancelOrNoReplyAuthority: false,
					},
				},
				null,
				2,
			)}\n`,
			"utf8",
		);
	} catch {
		// The sidebar cache is a best-effort display artifact only.
	}
}

function buildStatusLiveSummaryForUser(input: {
	workflows: readonly FlowDeskStatusLiveWorkflowEvidenceSummaryV1[];
	worstLaneStallClassification: FlowDeskLaneStallClassificationV1;
	totalStalled: number;
	totalLate: number;
	totalInconsistent: number;
	requestedWorkflowId?: string;
}): string {
	const workflowsCount = input.workflows.length;
	if (workflowsCount === 0) {
		return input.requestedWorkflowId !== undefined
			? `FlowDesk status: no durable evidence for workflow ${input.requestedWorkflowId}.`
			: "FlowDesk status: no durable workflows found.";
	}
	const headline =
		input.totalInconsistent > 0
			? `FlowDesk status: ${workflowsCount} workflow(s); ${input.totalInconsistent} finalizing-without-terminal inconsistent lane(s) require manual recovery.`
			: input.totalStalled > 0
			? `FlowDesk status: ${workflowsCount} workflow(s); worst classification stalled (${input.totalStalled} stalled, ${input.totalLate} progressing-late).`
			: input.totalLate > 0
				? `FlowDesk status: ${workflowsCount} workflow(s); ${input.totalLate} progressing-late, no stalled lanes.`
				: input.worstLaneStallClassification === "terminal"
					? `FlowDesk status: ${workflowsCount} workflow(s); all observed lanes terminal/complete.`
					: input.worstLaneStallClassification === "progressing_normal"
						? `FlowDesk status: ${workflowsCount} workflow(s); active lanes progressing_normal.`
						: `FlowDesk status: ${workflowsCount} workflow(s); worst classification ${input.worstLaneStallClassification}.`;

	const perWorkflow = input.workflows.slice(0, 3).map((workflow) => {
		const verdictLabels = workflow.latestReviewerVerdictLabels;
		const verdictText =
			verdictLabels.length > 0
				? `verdicts=${verdictLabels.join("/")}`
				: "verdicts=(none)";
		const lifecycleStates = workflow.latestLaneLifecycleStates;
		const lifecycleText =
			lifecycleStates.length > 0
				? `lifecycle=${lifecycleStates.slice(0, 3).join("/")}`
				: "lifecycle=(none)";
		const planText =
			workflow.latestWorkflowDispatchPlanRevisionId !== undefined
				? `workflow_plan=${workflow.latestWorkflowDispatchPlanRevisionId} tasks=${workflow.latestWorkflowDispatchPlanTaskCount ?? "unknown"}`
				: workflow.latestTaskGraphTaskCount !== undefined
					? `planning_slice=${workflow.latestWorkflowAuthoringStatus ?? "unknown"} tasks=${workflow.latestTaskGraphTaskCount} assignments=${workflow.latestTaskAgentAssignmentCount ?? 0} model=${workflow.latestTaskModelSelectionStatus ?? "unknown"}${workflow.latestWorkflowSynthesisTasksSummarized !== undefined ? ` synthesis=${workflow.latestWorkflowSynthesisTasksSummarized} tasks${workflow.latestWorkflowSynthesisConflictDetected ? " (conflict)" : ""}` : ""}`
					: "workflow_plan=(none)";
		const classification = workflow.worstLaneStallClassification ?? "unknown";
		const lanePreview = (workflow.laneProgressCards ?? [])
			.slice(0, 2)
			.map((lane) => {
				const age =
					lane.secondsSinceLastSignal === undefined
						? "unknown"
						: `~${Math.floor(lane.secondsSinceLastSignal / 60)}m`;
				return `${lane.laneId}:${lane.state ?? "unknown"}/${lane.classification}/last=${age}`;
			})
			.join(", ");
		const laneText = lanePreview.length > 0 ? `, lanes=${lanePreview}` : "";
		const subtaskPreview = (workflow.subtaskActivityRows ?? [])
			.slice(0, 3)
			.map((row) => {
				const actions = (row.recoveryActionRefs ?? [])
					.slice(0, 5)
					.map((action) => action.replace("/flowdesk-", ""))
					.join("|");
				const compact = `${row.laneId}:${row.state ?? "unknown"}/${row.classification}${actions.length > 0 ? `[${actions}]` : ""}`;
				return compact.length > 96 ? `${compact.slice(0, 95)}…` : compact;
			})
			.join("; ");
		const subtaskText = subtaskPreview.length > 0 ? `, subtasks=${subtaskPreview}` : "";
		return `- ${workflow.workflowId}: ${classification}, ${verdictText}, ${lifecycleText}, ${planText}${laneText}${subtaskText}`;
	});

	return [headline, ...perWorkflow].join("\n");
}
