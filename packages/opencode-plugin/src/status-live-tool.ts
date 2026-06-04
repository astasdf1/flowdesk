import { existsSync, readdirSync, statSync } from "node:fs";
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
	finalizingAbsoluteMaxMs?: number;
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
	latestWorkflowSynthesisId?: string;
	latestWorkflowSynthesisTasksSummarized?: number;
	latestWorkflowSynthesisConflictDetected?: boolean;
	latestWorkflowSynthesisSummaryPreview?: string;
	latestWorkflowDispatchPlanRevisionId?: string;
	latestWorkflowDispatchPlanTaskCount?: number;
	laneStallProjection?: FlowDeskLaneStallProjectionResultV1;
	worstLaneStallClassification?: FlowDeskLaneStallClassificationV1;
	stalledLaneCount?: number;
	progressingLateLaneCount?: number;
	inconsistentFinalizingWithoutTerminalLaneCount?: number;
	toolRunOverdueObservedLaneCount?: number;
	laneProgressCards?: readonly FlowDeskStatusLiveLaneProgressCardV1[];
	subtaskActivityRows?: readonly FlowDeskStatusLiveSubtaskActivityRowV1[];
	captureFailureDiagnostics?: readonly FlowDeskStatusLiveCaptureFailureDiagnosticV1[];
	laneProgressAggregate?: {
		expected: number;
		terminal: number;
		taskResult: number;
		failed: number;
		awaitingPermission: number;
		normalCompleted: number;
		autoNextStepEligible: boolean;
		nextActionAvailable: boolean;
		nextActionKind?: "synthesis" | "collect_result" | "repair_summary" | "salvage_or_verify" | "retry_or_debug";
		nextActionRefs: readonly ("/flowdesk-status" | "/flowdesk-export-debug")[];
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
	rawNudgeCount?: number;
	lastNudgeAt?: string;
	lastActivityAt?: string;
	nudgeQuietPeriodMs?: number;
	progressPhase?: string;
	progressLabel?: string;
	progressObservedAt?: string;
	verdictLabel?: "pass" | "changes_required" | "blocked" | "inconclusive";
	completionStatus?: string;
	outputKind?: string;
	usableForSynthesis?: boolean;
	failureHint?: string;
	captureFailureDiagnostic?: FlowDeskStatusLiveCaptureFailureDiagnosticV1;
	statusCommandRef: "/flowdesk-status";
	debugCommandRef: "/flowdesk-export-debug";
}

export interface FlowDeskStatusLiveCaptureFailureDiagnosticV1 {
	workflowId: string;
	laneId: string;
	childSessionId?: string;
	observedAt?: string;
	reason?: string;
	lastPartKind?: string;
	finalTextPresent?: boolean;
	stepFinishPresent?: boolean;
	runningToolCallId?: string;
	runningToolStatus?: string;
	recommendedNextAction?: "/flowdesk-status" | "/flowdesk-export-debug";
	redactionVersion?: string;
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
	rawNudgeCount?: number;
	lastNudgeAt?: string;
	lastActivityAt?: string;
	nudgeQuietPeriodMs?: number;
	completionStatus?: string;
	outputKind?: string;
	usableForSynthesis?: boolean;
	verdictLabel?: "pass" | "changes_required" | "blocked" | "inconclusive";
	failureHint?: string;
	captureFailureDiagnostic?: FlowDeskStatusLiveCaptureFailureDiagnosticV1;
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
	authorityCapabilitySummary?: {
		availableNow: readonly ("display_only" | "local_preview" | "command_backed_guarded")[];
		explicitDevBeta: readonly ("provider_task_lane" | "controlled_workspace_write")[];
		laterGated: readonly ("managed_dispatch" | "managed_fallback" | "tui_actions" | "hard_chat_control")[];
		unsupportedByDefault: readonly ("auto_provider_execution" | "automatic_reselection")[];
	};
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

function authorityCapabilitySummary(): NonNullable<FlowDeskStatusLiveResultV1["authorityCapabilitySummary"]> {
	return {
		availableNow: ["display_only", "local_preview", "command_backed_guarded"],
		explicitDevBeta: ["provider_task_lane", "controlled_workspace_write"],
		laterGated: ["managed_dispatch", "managed_fallback", "tui_actions", "hard_chat_control"],
		unsupportedByDefault: ["auto_provider_execution", "automatic_reselection"],
	};
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

const FORBIDDEN_SYNTHESIS_SUMMARY_MARKERS = /system prompt|provider payload|raw token|hidden injection|opencode\srun|dispatch|fallback|reselect/i;

function synthesisSummaryPreview(value: string | undefined): string | undefined {
	if (value === undefined) return undefined;
	const compact = value.replace(/\s+/g, " ").trim();
	if (compact.length === 0 || FORBIDDEN_SYNTHESIS_SUMMARY_MARKERS.test(compact)) return undefined;
	return compact.length > 160 ? `${compact.slice(0, 159)}…` : compact;
}

const DEFAULT_AGENT_TASK_FINALIZING_INCONSISTENCY_GRACE_MS = 90_000;
const MIN_AGENT_TASK_FINALIZING_INCONSISTENCY_GRACE_MS = 30_000;
const MAX_AGENT_TASK_FINALIZING_INCONSISTENCY_GRACE_MS = 600_000;
const DEFAULT_FINALIZING_ABSOLUTE_MAX_MS = 180_000;
const MIN_FINALIZING_ABSOLUTE_MAX_MS = 30_000;
const MAX_FINALIZING_ABSOLUTE_MAX_MS = 600_000;

function clampFinalizingInconsistencyGraceMs(value: number | undefined): number {
	if (typeof value !== "number" || !Number.isFinite(value) || value <= 0)
		return DEFAULT_AGENT_TASK_FINALIZING_INCONSISTENCY_GRACE_MS;
	return Math.min(
		MAX_AGENT_TASK_FINALIZING_INCONSISTENCY_GRACE_MS,
		Math.max(MIN_AGENT_TASK_FINALIZING_INCONSISTENCY_GRACE_MS, Math.floor(value)),
	);
}

function clampFinalizingAbsoluteMaxMs(value: number | undefined): number {
	if (typeof value !== "number" || !Number.isFinite(value) || value <= 0)
		return DEFAULT_FINALIZING_ABSOLUTE_MAX_MS;
	return Math.min(
		MAX_FINALIZING_ABSOLUTE_MAX_MS,
		Math.max(MIN_FINALIZING_ABSOLUTE_MAX_MS, Math.floor(value)),
	);
}

function finalizingInconsistencyEvidenceId(laneId: string): string {
	return `agent-task-inconsistency-${laneId}-finalizing-without-terminal`;
}

function agentTaskProgressExtendsFinalizingWait(label: string | undefined): boolean {
	if (label === undefined) return false;
	const normalized = label.toLowerCase();
	// Strong runtime/model activity observed after a finalizing candidate means the
	// response is still being written or the candidate was invalidated by more work.
	// These signals extend the idle wait, but never the absolute finalizing cap.
	if (normalized.startsWith("agent task tool running callid=")) return true;
	if (normalized.startsWith("agent task tool settled callid=")) return true;
	if (normalized.startsWith("agent task tool error callid=")) return true;
	if (normalized === "agent task message part event observed") return true;
	if (normalized === "agent task message.updated event observed") return true;
	if (normalized === "agent task terminal step event observed") return true;
	if (normalized.startsWith("agent task turn completed msgid=")) return true;
	// Ambient status/diff churn and watchdog-authored finalizing/nudge records do not
	// prove body progress and must not keep a lane alive indefinitely.
	return false;
}

function materializeFinalizingWithoutTerminalInconsistencies(input: {
	workflowId: string;
	rootDir: string;
	reload: FlowDeskSessionEvidenceReloadResultV1;
	observedAt: string;
	graceMs: number;
	finalizingAbsoluteMaxMs: number;
}): boolean {
	const observedAtMs = Date.parse(input.observedAt);
	if (!Number.isFinite(observedAtMs)) return false;
	const terminalLaneIds = new Set<string>();
	const existingInconsistencyIds = new Set<string>();
	const attemptIdByLane = new Map<string, string>();
	const taskIdByLane = new Map<string, string>();
	const latestActiveSignalByLane = new Map<string, number>();
	const latestFinalizingProgressSignalByLane = new Map<string, number>();
	const awaitingBodyCaptureSinceByLane = new Map<string, number>();
	const latestAwaitingPermissionByLane = new Map<string, number>();
	const latestPermissionResponseByLane = new Map<string, number>();
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
			if (entry.evidenceClass === "agent_task_child_session") {
				const awaitingSince = getStringField(entry.record, "awaiting_body_capture_since");
				const awaitingSinceMs = awaitingSince === undefined ? NaN : Date.parse(awaitingSince);
				const awaitingAttempts = entry.record.awaiting_body_capture_attempts;
				if (
					Number.isFinite(awaitingSinceMs) &&
					typeof awaitingAttempts === "number" &&
					awaitingAttempts > 0
				) {
					const current = awaitingBodyCaptureSinceByLane.get(laneId);
					if (current === undefined || awaitingSinceMs > current)
						awaitingBodyCaptureSinceByLane.set(laneId, awaitingSinceMs);
				}
			}
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
		const progressObservedAt = getStringField(entry.record, "observed_at");
		if (progressObservedAt === undefined) continue;
		const progressObservedAtMs = Date.parse(progressObservedAt);
		if (!Number.isFinite(progressObservedAtMs)) continue;
		const progressLabel = getStringField(entry.record, "progress_label");
		const progressPhase = getStringField(entry.record, "phase");
		if (progressPhase === "awaiting_permission") {
			const current = latestAwaitingPermissionByLane.get(laneId);
			if (current === undefined || progressObservedAtMs > current)
				latestAwaitingPermissionByLane.set(laneId, progressObservedAtMs);
		}
		if (progressPhase === "waiting" && progressLabel?.includes("permission response") === true) {
			const current = latestPermissionResponseByLane.get(laneId);
			if (current === undefined || progressObservedAtMs > current)
				latestPermissionResponseByLane.set(laneId, progressObservedAtMs);
		}
		if (agentTaskProgressExtendsFinalizingWait(progressLabel)) {
			const currentSignal = latestFinalizingProgressSignalByLane.get(laneId);
			if (currentSignal === undefined || progressObservedAtMs > currentSignal) {
				latestFinalizingProgressSignalByLane.set(laneId, progressObservedAtMs);
			}
		}
		if (progressPhase !== "finalizing") continue;
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
		const awaitingPermissionAt = latestAwaitingPermissionByLane.get(progress.laneId);
		const permissionResponseAt = latestPermissionResponseByLane.get(progress.laneId);
		if (awaitingPermissionAt !== undefined && (permissionResponseAt === undefined || awaitingPermissionAt > permissionResponseAt)) continue;
		const awaitingBodyCaptureSinceMs = awaitingBodyCaptureSinceByLane.get(progress.laneId);
		if (
			awaitingBodyCaptureSinceMs !== undefined &&
			observedAtMs - awaitingBodyCaptureSinceMs < input.finalizingAbsoluteMaxMs
		) {
			continue;
		}
		const activeSignalMs = latestActiveSignalByLane.get(progress.laneId);
		const finalizingProgressSignalMs = latestFinalizingProgressSignalByLane.get(progress.laneId);
		const finalizingAgeMs = observedAtMs - progress.observedAtMs;
		const activeSignalAgeMs =
			activeSignalMs === undefined ? 0 : observedAtMs - activeSignalMs;
		const progressSignalAgeMs =
			finalizingProgressSignalMs === undefined ? Number.POSITIVE_INFINITY : observedAtMs - finalizingProgressSignalMs;
		const progressSignalAfterFinalizing =
			finalizingProgressSignalMs !== undefined && finalizingProgressSignalMs > progress.observedAtMs;
		if (
			finalizingAgeMs < input.finalizingAbsoluteMaxMs &&
			progressSignalAfterFinalizing &&
			progressSignalAgeMs < input.graceMs
		) {
			continue;
		}
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
	let workflowSynthesisId: string | undefined;
	let workflowSynthesisTasksSummarized: number | undefined;
	let workflowSynthesisConflictDetected: boolean | undefined;
	let workflowSynthesisSummaryPreview: string | undefined;
	let workflowDispatchPlanRevisionId: string | undefined;
	let workflowDispatchPlanTaskCount: number | undefined;
	const toolRunOverdueLaneIds = new Set<string>();

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
				workflowSynthesisId = getStringField(last.record, "synthesis_id") ?? last.evidenceId;
				const tasks = last.record.tasks_summarized;
				if (typeof tasks === "number") workflowSynthesisTasksSummarized = tasks;
				workflowSynthesisConflictDetected = last.record.conflict_detected === true;
				workflowSynthesisSummaryPreview = synthesisSummaryPreview(getStringField(last.record, "synthesis_summary"));
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
		if (evidenceClass === "agent_task_inconsistency") {
			for (const entry of classEntries) {
				if (getStringField(entry.record, "inconsistency_kind") !== "tool_run_overdue_observed") continue;
				const laneId = getStringField(entry.record, "lane_id");
				if (laneId !== undefined) toolRunOverdueLaneIds.add(laneId);
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
		...(workflowSynthesisId !== undefined
			? { latestWorkflowSynthesisId: workflowSynthesisId }
			: {}),
		...(workflowSynthesisTasksSummarized !== undefined
			? { latestWorkflowSynthesisTasksSummarized: workflowSynthesisTasksSummarized }
			: {}),
		...(workflowSynthesisConflictDetected !== undefined
			? { latestWorkflowSynthesisConflictDetected: workflowSynthesisConflictDetected }
			: {}),
		...(workflowSynthesisSummaryPreview !== undefined
			? { latestWorkflowSynthesisSummaryPreview: workflowSynthesisSummaryPreview }
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
		...(toolRunOverdueLaneIds.size > 0
			? { toolRunOverdueObservedLaneCount: toolRunOverdueLaneIds.size }
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
	const childSessionByLane = new Map<string, {
		nudgeCount?: number;
		lastNudgeAt?: string;
		lastNudgeAtMs?: number;
		createdAt?: string;
		createdAtMs?: number;
		lastActivityAt?: string;
		nudgeQuietPeriodMs?: number;
		awaitingBodyCaptureSince?: string;
		awaitingBodyCaptureAttempts?: number;
		captureFailureDiagnostic?: FlowDeskStatusLiveCaptureFailureDiagnosticV1;
	}>();
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
			const lastNudgeAt = getStringField(entry.record, "last_nudge_at");
			const createdAt = getStringField(entry.record, "created_at");
			const lastActivityAt = getStringField(entry.record, "last_activity_at");
			const nudgeQuietPeriodMs = entry.record.nudge_quiet_period_ms;
			const awaitingBodyCaptureSince = getStringField(entry.record, "awaiting_body_capture_since");
			const awaitingBodyCaptureAttempts = entry.record.awaiting_body_capture_attempts;
			if (laneId !== undefined) {
				const diagnosticObservedAt = getStringField(entry.record, "capture_failure_diagnostic_observed_at");
				const recommendedNextActionRaw = getStringField(entry.record, "capture_failure_recommended_next_action");
				const recommendedNextAction: FlowDeskStatusLiveCaptureFailureDiagnosticV1["recommendedNextAction"] =
					recommendedNextActionRaw === "/flowdesk-status" || recommendedNextActionRaw === "/flowdesk-export-debug"
						? recommendedNextActionRaw
						: undefined;
				const captureFailureDiagnostic = diagnosticObservedAt === undefined
					? undefined
					: {
						workflowId,
						laneId,
						childSessionId: getStringField(entry.record, "capture_failure_child_session_id"),
						observedAt: diagnosticObservedAt,
						reason: getStringField(entry.record, "capture_failure_diagnostic_reason"),
						lastPartKind: getStringField(entry.record, "capture_failure_last_part_kind"),
						...(typeof entry.record.capture_failure_final_text_present === "boolean"
							? { finalTextPresent: entry.record.capture_failure_final_text_present }
							: {}),
						...(typeof entry.record.capture_failure_step_finish_present === "boolean"
							? { stepFinishPresent: entry.record.capture_failure_step_finish_present }
							: {}),
						runningToolCallId: getStringField(entry.record, "capture_failure_running_tool_call_id"),
						runningToolStatus: getStringField(entry.record, "capture_failure_running_tool_status"),
						...(recommendedNextAction === undefined ? {} : { recommendedNextAction }),
						redactionVersion: getStringField(entry.record, "capture_failure_redaction_version"),
					};
				childSessionByLane.set(laneId, {
					...(typeof nudgeCount === "number" && Number.isFinite(nudgeCount)
						? { nudgeCount }
						: {}),
					...(lastNudgeAt === undefined ? {} : { lastNudgeAt, lastNudgeAtMs: Date.parse(lastNudgeAt) }),
					...(createdAt === undefined ? {} : { createdAt, createdAtMs: Date.parse(createdAt) }),
					...(lastActivityAt === undefined ? {} : { lastActivityAt }),
					...(typeof nudgeQuietPeriodMs === "number" && Number.isFinite(nudgeQuietPeriodMs)
						? { nudgeQuietPeriodMs }
						: {}),
					...(awaitingBodyCaptureSince === undefined ? {} : { awaitingBodyCaptureSince }),
					...(typeof awaitingBodyCaptureAttempts === "number" && Number.isFinite(awaitingBodyCaptureAttempts)
						? { awaitingBodyCaptureAttempts }
						: {}),
					...(captureFailureDiagnostic === undefined ? {} : { captureFailureDiagnostic }),
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
		const terminalSignalMs = entry.classification === "terminal" ? (entry.lastSignalAt === undefined ? undefined : Date.parse(entry.lastSignalAt)) : undefined;
		const visibleProgress =
			terminalSignalMs !== undefined &&
			Number.isFinite(terminalSignalMs) &&
			progress !== undefined &&
			progress.observedAtMs > terminalSignalMs
				? undefined
				: progress;
		const effectiveProgress = visibleProgress ?? (
			childSession?.awaitingBodyCaptureSince !== undefined &&
			(childSession.awaitingBodyCaptureAttempts ?? 0) > 0
				? {
					observedAtMs: Date.parse(childSession.awaitingBodyCaptureSince),
					phase: "finalizing",
					label: "async agent task awaiting body capture after turn completed event",
					observedAt: childSession.awaitingBodyCaptureSince,
				}
				: undefined
		);
		const projectedState = taskResultLaneIds.has(entry.laneId)
			? "task_result"
			: (meta?.state ?? entry.lifecycleState);
		const taskId = context?.taskId ?? taskResult?.taskId;
		const rawNudgeCount = childSession?.nudgeCount;
		const lastNudgeAtMs = childSession?.lastNudgeAtMs;
		const progressAtMs = progress?.observedAtMs;
		const effectiveNudgeCount = rawNudgeCount === undefined
			? undefined
			: progressAtMs !== undefined && Number.isFinite(progressAtMs) && lastNudgeAtMs !== undefined && Number.isFinite(lastNudgeAtMs) && progressAtMs > lastNudgeAtMs
				? 0
				: rawNudgeCount;
		const activityMsCandidates = [
			childSession?.createdAtMs,
			lastNudgeAtMs,
			progressAtMs,
		].filter((value): value is number => typeof value === "number" && Number.isFinite(value));
		const derivedLastActivityAt = activityMsCandidates.length === 0
			? childSession?.lastActivityAt
			: new Date(Math.max(...activityMsCandidates)).toISOString();
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
			...(effectiveNudgeCount === undefined ? {} : { nudgeCount: effectiveNudgeCount }),
			...(rawNudgeCount === undefined || rawNudgeCount === effectiveNudgeCount ? {} : { rawNudgeCount }),
			...(childSession?.lastNudgeAt === undefined ? {} : { lastNudgeAt: childSession.lastNudgeAt }),
			...(derivedLastActivityAt === undefined ? {} : { lastActivityAt: derivedLastActivityAt }),
			...(childSession?.nudgeQuietPeriodMs === undefined ? {} : { nudgeQuietPeriodMs: childSession.nudgeQuietPeriodMs }),
			...(effectiveProgress?.phase === undefined ? {} : { progressPhase: effectiveProgress.phase }),
			...(effectiveProgress?.label === undefined ? {} : { progressLabel: effectiveProgress.label }),
			...(effectiveProgress?.observedAt === undefined ? {} : { progressObservedAt: effectiveProgress.observedAt }),
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
			...(childSession?.captureFailureDiagnostic === undefined
				? {}
				: { captureFailureDiagnostic: childSession.captureFailureDiagnostic }),
			statusCommandRef: "/flowdesk-status" as const,
			debugCommandRef: "/flowdesk-export-debug" as const,
		};
	});
}

function buildLaneProgressAggregate(
	cards: readonly FlowDeskStatusLiveLaneProgressCardV1[],
	synthesisAlreadyRecorded = false,
): NonNullable<FlowDeskStatusLiveWorkflowEvidenceSummaryV1["laneProgressAggregate"]> {
	const expected = cards.length;
	const terminal = cards.filter(card => card.classification === "terminal").length;
	const taskResult = cards.filter(card => card.state === "task_result").length;
	const failed = cards.filter(card => card.failureHint !== undefined || card.state === "invocation_failed" || card.state === "task_failed").length;
	const awaitingPermission = cards.filter(card => card.progressPhase === "awaiting_permission").length;
	const normalCompleted = cards.filter(card =>
		card.state === "task_result" &&
		card.classification === "terminal" &&
		card.completionStatus !== "partial" &&
		card.outputKind !== "process_notes" &&
		card.usableForSynthesis !== false &&
		card.failureHint === undefined,
	).length;
	const allTerminal = expected > 0 && terminal === expected;
	const needsRepairSummary = allTerminal && cards.some(card =>
		card.state === "task_result" &&
		(card.completionStatus === "partial" || card.outputKind === "process_notes" || card.usableForSynthesis === false),
	);
	const needsRetryOrDebug = allTerminal && !needsRepairSummary && cards.some(card =>
		card.state === "invocation_failed" || card.state === "task_failed" || card.failureHint !== undefined,
	);
	const needsSalvageOrVerify = allTerminal && !needsRepairSummary && !needsRetryOrDebug && cards.some(card =>
		card.state === "no_output" || card.progressLabel?.includes("turn completed empty") === true,
	);
	const nextActionKind = normalCompleted === expected && !synthesisAlreadyRecorded
		? "synthesis" as const
		: normalCompleted > 0 && !synthesisAlreadyRecorded
			? "collect_result" as const
		: needsRepairSummary
			? "repair_summary" as const
			: needsSalvageOrVerify
				? "salvage_or_verify" as const
				: needsRetryOrDebug
					? "retry_or_debug" as const
					: undefined;
	const nextActionReady = nextActionKind !== undefined;
	return {
		expected,
		terminal,
		taskResult,
		failed,
		awaitingPermission,
		normalCompleted,
		autoNextStepEligible: nextActionKind === "synthesis",
		nextActionAvailable: nextActionReady,
		...(nextActionKind === undefined ? {} : { nextActionKind }),
		nextActionRefs: ["/flowdesk-status", "/flowdesk-export-debug"],
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
			...(card.rawNudgeCount === undefined ? {} : { rawNudgeCount: card.rawNudgeCount }),
			...(card.lastNudgeAt === undefined ? {} : { lastNudgeAt: card.lastNudgeAt }),
			...(card.lastActivityAt === undefined ? {} : { lastActivityAt: card.lastActivityAt }),
			...(card.nudgeQuietPeriodMs === undefined ? {} : { nudgeQuietPeriodMs: card.nudgeQuietPeriodMs }),
			...(card.completionStatus === undefined ? {} : { completionStatus: card.completionStatus }),
			...(card.outputKind === undefined ? {} : { outputKind: card.outputKind }),
			...(card.usableForSynthesis === undefined ? {} : { usableForSynthesis: card.usableForSynthesis }),
			...(card.verdictLabel === undefined ? {} : { verdictLabel: card.verdictLabel }),
			...(card.failureHint === undefined ? {} : { failureHint: card.failureHint }),
			...(card.captureFailureDiagnostic === undefined ? {} : { captureFailureDiagnostic: card.captureFailureDiagnostic }),
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
			authorityCapabilitySummary: authorityCapabilitySummary(),
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
			authorityCapabilitySummary: authorityCapabilitySummary(),
			authority: blockedAuthority(),
		};
	}

	const workflows: FlowDeskStatusLiveWorkflowEvidenceSummaryV1[] = [];
	for (const workflowId of workflowIds) {
		backfillTerminalAgentTaskFailedLanesV1({
			workflowId,
			rootDir,
			now: new Date(observedAt),
			refreshCompletionUiCaches: false,
		});
		let reload = reloadFlowDeskSessionEvidenceV1({
			workflowId,
			rootDir,
		});
		let summary: FlowDeskStatusLiveWorkflowEvidenceSummaryV1;
		let projectionReload: FlowDeskSessionEvidenceReloadResultV1;
		let projection: FlowDeskLaneStallProjectionResultV1;
		const buildWorkflowSummary = () => {
			summary = summarizeWorkflow(workflowId, reload, maxRecentEvidencePerClass);
			projectionReload = pruneInconsistencySnapshotsNoLongerValid(pruneNonTerminalLifecycleSnapshotsNoLongerValid(reload));
			projection = projectFlowDeskLaneStallV1({
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
			const projectedLifecycleStates = projection.entries
				.map((entry) => entry.lifecycleState)
				.filter((state): state is string => typeof state === "string" && state.length > 0);
			if (projectedLifecycleStates.length > 0) {
				summary.latestLaneLifecycleStates = projectedLifecycleStates;
			}
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
			summary.captureFailureDiagnostics = summary.laneProgressCards
				.map((card) => card.captureFailureDiagnostic)
				.filter((diagnostic): diagnostic is FlowDeskStatusLiveCaptureFailureDiagnosticV1 => diagnostic !== undefined);
			summary.laneProgressAggregate = buildLaneProgressAggregate(
				summary.laneProgressCards,
				summary.latestWorkflowSynthesisTasksSummarized !== undefined,
			);
		};
		const graceMs = clampFinalizingInconsistencyGraceMs(
			input.config.agentTaskFinalizingInconsistencyGraceMs,
		);
		const finalizingAbsoluteMaxMs = clampFinalizingAbsoluteMaxMs(
			input.config.finalizingAbsoluteMaxMs,
		);
		const wroteInconsistency = materializeFinalizingWithoutTerminalInconsistencies({
			workflowId,
			rootDir,
			reload,
			observedAt,
			graceMs,
			finalizingAbsoluteMaxMs,
		});
		if (wroteInconsistency) {
			reload = reloadFlowDeskSessionEvidenceV1({
				workflowId,
				rootDir,
			});
		}
		buildWorkflowSummary();
		workflows.push(summary!);
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
	const totalToolRunOverdueObserved = workflows.reduce(
		(sum, summary) => sum + (summary.toolRunOverdueObservedLaneCount ?? 0),
		0,
	);
	const totalAwaitingPermission = workflows.reduce(
		(sum, summary) => sum + (summary.laneProgressAggregate?.awaitingPermission ?? 0),
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
		totalToolRunOverdueObserved,
		totalAwaitingPermission,
		requestedWorkflowId,
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
		authorityCapabilitySummary: authorityCapabilitySummary(),
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

function compactDiagnosticRef(value: string | undefined): string {
	if (value === undefined || value.length === 0) return "unknown";
	return value.length <= 12 ? value : `…${value.slice(-8)}`;
}

function buildStatusLiveSummaryForUser(input: {
	workflows: readonly FlowDeskStatusLiveWorkflowEvidenceSummaryV1[];
	worstLaneStallClassification: FlowDeskLaneStallClassificationV1;
	totalStalled: number;
	totalLate: number;
	totalInconsistent: number;
	totalToolRunOverdueObserved: number;
	totalAwaitingPermission: number;
	requestedWorkflowId?: string;
}): string {
	const workflowsCount = input.workflows.length;
	if (workflowsCount === 0) {
		return input.requestedWorkflowId !== undefined
			? `FlowDesk status: no durable evidence for workflow ${input.requestedWorkflowId}.`
			: "FlowDesk status: no durable workflows found.";
	}
	const headline =
		input.totalToolRunOverdueObserved > 0 && input.totalAwaitingPermission > 0
			? `FlowDesk status: ${workflowsCount} workflow(s); ${input.totalToolRunOverdueObserved} lane(s) have stale open-tool diagnostic attention and ${input.totalAwaitingPermission} lane(s) await OpenCode permission. Both are advisory; no permission was auto-approved and no result/failure/abort/retry/fallback was synthesized.`
		: input.totalToolRunOverdueObserved > 0
			? `FlowDesk status: ${workflowsCount} workflow(s); ${input.totalToolRunOverdueObserved} lane(s) have stale open-tool diagnostic attention. This is advisory only; no result/failure/abort/retry/fallback was synthesized.`
		: input.workflows.some((workflow) => (workflow.captureFailureDiagnostics ?? []).length > 0)
			? `FlowDesk status: ${workflowsCount} workflow(s); capture-failure diagnostics available in status/debug evidence.`
		: input.totalAwaitingPermission > 0
			? `FlowDesk status: ${workflowsCount} workflow(s); ${input.totalAwaitingPermission} lane(s) awaiting OpenCode permission attention. The user must approve or deny in OpenCode's permission UI; no permission was auto-approved.`
			: input.totalInconsistent > 0
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
		const projectedLaneStates = (workflow.laneProgressCards ?? [])
			.slice(0, 3)
			.map((lane) => `${lane.state ?? "unknown"}/${lane.classification}`);
		const lifecycleStates = projectedLaneStates.length > 0 ? projectedLaneStates : workflow.latestLaneLifecycleStates;
		const lifecycleText =
			lifecycleStates.length > 0
				? `${projectedLaneStates.length > 0 ? "lane_state" : "lifecycle"}=${lifecycleStates.slice(0, 3).join("/")}`
				: "lane_state=(none)";
		const synthesisPreview = workflow.latestWorkflowSynthesisSummaryPreview === undefined
			? ""
			: ` preview="${workflow.latestWorkflowSynthesisSummaryPreview.replace(/"/g, "'").slice(0, 96)}"`;
		const synthesisText = workflow.latestWorkflowSynthesisTasksSummarized !== undefined
			? ` synthesis=${workflow.latestWorkflowSynthesisTasksSummarized} tasks${workflow.latestWorkflowSynthesisConflictDetected ? " conflict=detected" : ""}${synthesisPreview}`
			: "";
		const autoNextText = workflow.laneProgressAggregate?.autoNextStepEligible === true ? " auto_next=ready" : "";
		const nextActionText = workflow.laneProgressAggregate?.nextActionAvailable === true
			? ` next_action=${workflow.laneProgressAggregate.nextActionKind ?? "available"}_ready`
			: "";
		const planText =
			workflow.latestWorkflowDispatchPlanRevisionId !== undefined
				? `workflow_plan=${workflow.latestWorkflowDispatchPlanRevisionId} tasks=${workflow.latestWorkflowDispatchPlanTaskCount ?? "unknown"}${synthesisText}${autoNextText}${nextActionText}`
				: workflow.latestTaskGraphTaskCount !== undefined
					? `planning_slice=${workflow.latestWorkflowAuthoringStatus ?? "unknown"} tasks=${workflow.latestTaskGraphTaskCount} assignments=${workflow.latestTaskAgentAssignmentCount ?? 0} model=${workflow.latestTaskModelSelectionStatus ?? "unknown"}${synthesisText}${autoNextText}${nextActionText}`
					: synthesisText.length > 0
						? `${synthesisText.trim()}${autoNextText}${nextActionText}`
						: `workflow_plan=(none)${autoNextText}${nextActionText}`;
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
		const subtaskPreview = (workflow.subtaskActivityRows ?? [])
			.slice(0, 3)
			.map((row) => {
				const actions = (row.recoveryActionRefs ?? [])
					.slice(0, 5)
					.map((action) => action.replace("/flowdesk-", ""))
					.join("|");
				const phase = row.progressPhase === "awaiting_permission" ? "/awaiting_permission" : "";
				const compact = `${row.laneId}:${row.state ?? "unknown"}/${row.classification}${phase}${actions.length > 0 ? `[${actions}]` : ""}`;
				return compact.length > 96 ? `${compact.slice(0, 95)}…` : compact;
			})
			.join("; ");
		const laneText = lanePreview.length > 0 && subtaskPreview.length === 0 ? `, lanes=${lanePreview}` : "";
		const subtaskText = subtaskPreview.length > 0 ? `, subtasks=${subtaskPreview}` : "";
		const captureDiagPreview = (workflow.captureFailureDiagnostics ?? [])
			.slice(0, 2)
			.map((diagnostic) => `${diagnostic.laneId}:child=${compactDiagnosticRef(diagnostic.childSessionId)}/part=${diagnostic.lastPartKind ?? "unknown"}/text=${diagnostic.finalTextPresent === true ? "yes" : "no"}/step_finish=${diagnostic.stepFinishPresent === true ? "yes" : "no"}/tool=${compactDiagnosticRef(diagnostic.runningToolCallId)}/${diagnostic.runningToolStatus ?? "none"}/next=${diagnostic.recommendedNextAction ?? "/flowdesk-export-debug"}`)
			.join("; ");
		const captureDiagText = captureDiagPreview.length > 0 ? `, capture_diag=${captureDiagPreview}` : "";
		return `- ${workflow.workflowId}: ${classification}, ${verdictText}, ${lifecycleText}, ${planText}${laneText}${subtaskText}${captureDiagText}`;
	});

	return [headline, ...perWorkflow].join("\n");
}
