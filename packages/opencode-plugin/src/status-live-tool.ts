import { existsSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import {
	FLOWDESK_SESSION_EVIDENCE_CLASSES,
	type FlowDeskLaneStallClassificationV1,
	type FlowDeskLaneStallProjectionResultV1,
	type FlowDeskSessionEvidenceClass,
	type FlowDeskSessionEvidenceReloadEntryV1,
	type FlowDeskSessionEvidenceReloadResultV1,
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

export interface FlowDeskStatusLiveConfigV1 {
	rootDir: string;
	maxWorkflows?: number;
	maxRecentEvidencePerClass?: number;
	laneHeartbeatLateThresholdMs?: number;
	laneHeartbeatStallThresholdMs?: number;
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
	laneStallProjection?: FlowDeskLaneStallProjectionResultV1;
	worstLaneStallClassification?: FlowDeskLaneStallClassificationV1;
	stalledLaneCount?: number;
	progressingLateLaneCount?: number;
	laneProgressCards?: readonly FlowDeskStatusLiveLaneProgressCardV1[];
}

export interface FlowDeskStatusLiveLaneProgressCardV1 {
	workflowId: string;
	laneId: string;
	attemptId?: string;
	state?: string;
	classification: FlowDeskLaneStallClassificationV1;
	secondsSinceLastSignal?: number;
	lastSignalSource?: string;
	agentRef?: string;
	providerQualifiedModelId?: string;
	verdictLabel?: "pass" | "changes_required" | "blocked" | "inconclusive";
	failureHint?: string;
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
	for (const entry of reload.entries) {
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
		const verdictLabel =
			meta?.verdictRef === undefined
				? undefined
				: verdictLabels.get(meta.verdictRef);
		return {
			workflowId,
			laneId: entry.laneId,
			attemptId: entry.attemptId,
			state: meta?.state ?? entry.lifecycleState,
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
			...(verdictLabel === undefined ? {} : { verdictLabel }),
			...(entry.failureHint === undefined
				? {}
				: { failureHint: entry.failureHint }),
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
		const reload = reloadFlowDeskSessionEvidenceV1({
			workflowId,
			rootDir,
		});
		const summary = summarizeWorkflow(workflowId, reload, maxRecentEvidencePerClass);
		const projectionReload = pruneNonTerminalLifecycleSnapshotsNoLongerValid(reload);
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
		summary.laneProgressCards = buildLaneProgressCards(
			workflowId,
			projectionReload,
			projection,
		);
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
	const worstLaneStallClassification: FlowDeskLaneStallClassificationV1 =
		workflows.some(
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

function buildStatusLiveSummaryForUser(input: {
	workflows: readonly FlowDeskStatusLiveWorkflowEvidenceSummaryV1[];
	worstLaneStallClassification: FlowDeskLaneStallClassificationV1;
	totalStalled: number;
	totalLate: number;
	requestedWorkflowId?: string;
}): string {
	const workflowsCount = input.workflows.length;
	if (workflowsCount === 0) {
		return input.requestedWorkflowId !== undefined
			? `FlowDesk status: no durable evidence for workflow ${input.requestedWorkflowId}.`
			: "FlowDesk status: no durable workflows found.";
	}
	const headline =
		input.totalStalled > 0
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
		return `- ${workflow.workflowId}: ${classification}, ${verdictText}, ${lifecycleText}${laneText}`;
	});

	return [headline, ...perWorkflow].join("\n");
}
