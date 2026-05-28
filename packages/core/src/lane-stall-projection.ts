import type {
	FlowDeskSessionEvidenceReloadEntryV1,
	FlowDeskSessionEvidenceReloadResultV1,
} from "./session-evidence.js";

export const FLOWDESK_LANE_HEARTBEAT_DEFAULT_LATE_MS = 1 * 60 * 1000;
export const FLOWDESK_LANE_HEARTBEAT_DEFAULT_STALL_MS = 3 * 60 * 1000;
export const FLOWDESK_LANE_HEARTBEAT_MIN_LATE_MS = 10_000;

const ACTIVE_LIFECYCLE_STATES = new Set([
	"created",
	"running",
	"awaiting_dependency",
	"cooldown",
]);

const TERMINAL_LIFECYCLE_STATES = new Set([
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

export type FlowDeskLaneStallClassificationV1 =
	| "inconsistent_finalizing_without_terminal"
	| "progressing_normal"
	| "progressing_late"
	| "stalled"
	| "terminal"
	| "unknown";

export interface FlowDeskLaneStallProjectionEntryV1 {
	workflowId: string;
	laneId: string;
	attemptId?: string;
	classification: FlowDeskLaneStallClassificationV1;
	lifecycleState?: string;
	lastSignalAt?: string;
	lastSignalEvidenceId?: string;
	lastSignalSource?: "lane_lifecycle" | "lane_heartbeat";
	lastHeartbeatSeq?: number;
	expectedNextHeartbeatAt?: string;
	expectedNextHeartbeatOverdue?: boolean;
	secondsPastExpectedNextHeartbeat?: number;
	secondsSinceLastSignal?: number;
	abnormal: boolean;
	failureHint?: string;
	safeNextActions: readonly (
		| "/flowdesk-status"
		| "/flowdesk-retry"
		| "/flowdesk-resume"
		| "/flowdesk-abort"
		| "/flowdesk-doctor"
		| "/flowdesk-export-debug"
	)[];
}

export interface FlowDeskLaneStallProjectionResultV1 {
	schema_version: "flowdesk.lane_stall_projection.v1";
	observedAt: string;
	lateThresholdMs: number;
	stallThresholdMs: number;
	totalActiveLanes: number;
	totalLateLanes: number;
	totalStalledLanes: number;
	totalInconsistentLanes: number;
	totalTerminalLanes: number;
	worstClassification: FlowDeskLaneStallClassificationV1;
	entries: FlowDeskLaneStallProjectionEntryV1[];
}

interface LifecycleSnapshot {
	workflowId: string;
	laneId: string;
	attemptId?: string;
	state: string;
	updatedAt: string;
	updatedAtMs: number;
	evidenceId: string;
	signalSource: "lane_lifecycle" | "lane_heartbeat";
	heartbeatSeq?: number;
	expectedNextHeartbeatAt?: string;
}

function pickLatestSnapshotForLane(
	entries: FlowDeskSessionEvidenceReloadEntryV1[],
	workflowId: string,
	accept: (entry: LifecycleSnapshot) => boolean,
): Map<string, LifecycleSnapshot> {
	const selected = new Map<string, LifecycleSnapshot>();
	for (const entry of entries) {
		let snapshot: LifecycleSnapshot | undefined;
		if (isLifecycleEntry(entry)) {
			snapshot = lifecycleSnapshotFromEntry(entry, workflowId);
		} else if (isHeartbeatEntry(entry)) {
			snapshot = heartbeatSnapshotFromEntry(entry, workflowId);
		}
		if (snapshot === undefined || !accept(snapshot)) continue;
		const previous = selected.get(snapshot.laneId);
		if (previous === undefined || shouldPreferSnapshot(snapshot, previous)) {
			selected.set(snapshot.laneId, snapshot);
		}
	}
	return selected;
}

function isTerminalLifecycleState(snapshot: LifecycleSnapshot): boolean {
	return TERMINAL_LIFECYCLE_STATES.has(snapshot.state);
}

function lifecyclePriority(state: string): number {
	if (TERMINAL_LIFECYCLE_STATES.has(state)) return 3;
	if (ACTIVE_LIFECYCLE_STATES.has(state)) return 2;
	return 1;
}

function shouldPreferSnapshot(
	current: LifecycleSnapshot,
	previous: LifecycleSnapshot,
): boolean {
	if (current.updatedAtMs !== previous.updatedAtMs)
		return current.updatedAtMs > previous.updatedAtMs;
	const currentPriority = lifecyclePriority(current.state);
	const previousPriority = lifecyclePriority(previous.state);
	if (currentPriority !== previousPriority) return currentPriority > previousPriority;
	if (current.signalSource !== previous.signalSource)
		return current.signalSource === "lane_lifecycle";
	if (
		current.signalSource === "lane_heartbeat" &&
		current.heartbeatSeq !== undefined &&
		previous.heartbeatSeq !== undefined
	)
		return current.heartbeatSeq > previous.heartbeatSeq;
	return current.evidenceId > previous.evidenceId;
}

function getStringField(
	record: Record<string, unknown>,
	key: string,
): string | undefined {
	const value = record[key];
	return typeof value === "string" && value.length > 0 ? value : undefined;
}

function isLifecycleEntry(
	entry: FlowDeskSessionEvidenceReloadEntryV1,
): boolean {
	return entry.evidenceClass === "lane_lifecycle";
}

function isHeartbeatEntry(
	entry: FlowDeskSessionEvidenceReloadEntryV1,
): boolean {
	return entry.evidenceClass === "lane_heartbeat";
}

function isInconsistencyEntry(
	entry: FlowDeskSessionEvidenceReloadEntryV1,
): boolean {
	return entry.evidenceClass === "agent_task_inconsistency";
}

function lifecycleSnapshotFromEntry(
	entry: FlowDeskSessionEvidenceReloadEntryV1,
	workflowId: string,
): LifecycleSnapshot | undefined {
	const record = entry.record;
	const laneId = getStringField(record, "lane_id");
	const state = getStringField(record, "state");
	const updatedAt =
		getStringField(record, "updated_at") ?? getStringField(record, "created_at");
	if (laneId === undefined || state === undefined || updatedAt === undefined)
		return undefined;
	const parsed = Date.parse(updatedAt);
	if (!Number.isFinite(parsed)) return undefined;
	return {
		workflowId,
		laneId,
		attemptId: getStringField(record, "attempt_id"),
		state,
		updatedAt,
		updatedAtMs: parsed,
		evidenceId: entry.evidenceId,
		signalSource: "lane_lifecycle",
	};
}

function heartbeatSnapshotFromEntry(
	entry: FlowDeskSessionEvidenceReloadEntryV1,
	workflowId: string,
): LifecycleSnapshot | undefined {
	const record = entry.record;
	const laneId = getStringField(record, "lane_id");
	const state = getStringField(record, "state");
	const observedAt = getStringField(record, "observed_at");
	if (laneId === undefined || state === undefined || observedAt === undefined)
		return undefined;
	const parsed = Date.parse(observedAt);
	if (!Number.isFinite(parsed)) return undefined;
	const heartbeatSeqValue = record.heartbeat_seq;
	const heartbeatSeq =
		typeof heartbeatSeqValue === "number" && Number.isFinite(heartbeatSeqValue)
			? heartbeatSeqValue
			: undefined;
	const expectedNext = getStringField(record, "expected_next_heartbeat_at");
	return {
		workflowId,
		laneId,
		attemptId: getStringField(record, "attempt_id"),
		state,
		updatedAt: observedAt,
		updatedAtMs: parsed,
		evidenceId: entry.evidenceId,
		signalSource: "lane_heartbeat",
		...(heartbeatSeq === undefined ? {} : { heartbeatSeq }),
		...(expectedNext === undefined ? {} : { expectedNextHeartbeatAt: expectedNext }),
	};
}

function pickLatestLifecyclePerLane(
	reload: FlowDeskSessionEvidenceReloadResultV1,
	workflowId: string,
): Map<string, LifecycleSnapshot> {
	const latestByLane = pickLatestSnapshotForLane(
		reload.entries,
		workflowId,
		() => true,
	);

	// Safety pass: avoid stale active states being surfaced when a terminal
	// lifecycle evidence exists for the same lane with same-or-newer timestamp.
	const latestTerminalByLane = pickLatestSnapshotForLane(
		reload.entries,
		workflowId,
		isTerminalLifecycleState,
	);
	for (const [laneId, terminalSnapshot] of latestTerminalByLane) {
		const activeSnapshot = latestByLane.get(laneId);
		if (
			activeSnapshot !== undefined &&
			shouldPreferSnapshot(terminalSnapshot, activeSnapshot)
		)
			latestByLane.set(laneId, terminalSnapshot);
	}

	return latestByLane;
}

function pickFinalizingWithoutTerminalInconsistencies(
	reload: FlowDeskSessionEvidenceReloadResultV1,
): Map<string, { evidenceId: string; observedAt?: string; observedAtMs: number }> {
	const selected = new Map<string, { evidenceId: string; observedAt?: string; observedAtMs: number }>();
	for (const entry of reload.entries) {
		if (!isInconsistencyEntry(entry)) continue;
		if (getStringField(entry.record, "inconsistency_kind") !== "finalizing_without_terminal") continue;
		const laneId = getStringField(entry.record, "lane_id");
		if (laneId === undefined) continue;
		const observedAt = getStringField(entry.record, "observed_at");
		const observedAtMs = observedAt === undefined ? 0 : Date.parse(observedAt);
		const snapshot = {
			evidenceId: entry.evidenceId,
			observedAt,
			observedAtMs: Number.isFinite(observedAtMs) ? observedAtMs : 0,
		};
		const previous = selected.get(laneId);
		if (
			previous === undefined ||
			snapshot.observedAtMs > previous.observedAtMs ||
			(snapshot.observedAtMs === previous.observedAtMs && snapshot.evidenceId > previous.evidenceId)
		) {
			selected.set(laneId, snapshot);
		}
	}
	return selected;
}

function classify(
	snapshot: LifecycleSnapshot,
	observedAtMs: number,
	lateMs: number,
	stallMs: number,
): {
	classification: FlowDeskLaneStallClassificationV1;
	secondsSinceLastSignal: number;
} {
	if (TERMINAL_LIFECYCLE_STATES.has(snapshot.state))
		return {
			classification: "terminal",
			secondsSinceLastSignal: Math.max(
				0,
				Math.floor((observedAtMs - snapshot.updatedAtMs) / 1000),
			),
		};
	if (!ACTIVE_LIFECYCLE_STATES.has(snapshot.state))
		return {
			classification: "unknown",
			secondsSinceLastSignal: Math.max(
				0,
				Math.floor((observedAtMs - snapshot.updatedAtMs) / 1000),
			),
		};
	const elapsedMs = Math.max(0, observedAtMs - snapshot.updatedAtMs);
	if (elapsedMs > stallMs)
		return {
			classification: "stalled",
			secondsSinceLastSignal: Math.floor(elapsedMs / 1000),
		};
	if (elapsedMs > lateMs)
		return {
			classification: "progressing_late",
			secondsSinceLastSignal: Math.floor(elapsedMs / 1000),
		};
	return {
		classification: "progressing_normal",
		secondsSinceLastSignal: Math.floor(elapsedMs / 1000),
	};
}

function safeActionsFor(
	classification: FlowDeskLaneStallClassificationV1,
): FlowDeskLaneStallProjectionEntryV1["safeNextActions"] {
	if (classification === "inconsistent_finalizing_without_terminal")
		return [
			"/flowdesk-status",
			"/flowdesk-abort",
			"/flowdesk-retry",
			"/flowdesk-doctor",
			"/flowdesk-export-debug",
		];
	if (classification === "stalled")
		return [
			"/flowdesk-status",
			"/flowdesk-retry",
			"/flowdesk-resume",
			"/flowdesk-abort",
			"/flowdesk-doctor",
			"/flowdesk-export-debug",
		];
	if (classification === "progressing_late")
		return ["/flowdesk-status", "/flowdesk-doctor", "/flowdesk-export-debug"];
	if (classification === "terminal" || classification === "unknown")
		return ["/flowdesk-status"];
	return ["/flowdesk-status"];
}

function failureHintFor(state: string): string | undefined {
	if (state === "invocation_failed") return "invocation_failed";
	if (state === "timeout") return "transport_timeout";
	if (state === "orphaned") return "correlation_lost";
	if (state === "aborted") return "abnormal_exit";
	return undefined;
}

function projectionWorstClassification(
	entries: readonly FlowDeskLaneStallProjectionEntryV1[],
): FlowDeskLaneStallClassificationV1 {
	if (entries.some((entry) => entry.classification === "inconsistent_finalizing_without_terminal"))
		return "inconsistent_finalizing_without_terminal";
	if (entries.some((entry) => entry.classification === "stalled"))
		return "stalled";
	if (entries.some((entry) => entry.classification === "progressing_late"))
		return "progressing_late";
	if (entries.some((entry) => entry.classification === "progressing_normal"))
		return "progressing_normal";
	if (entries.some((entry) => entry.classification === "terminal"))
		return "terminal";
	return "unknown";
}

export function projectFlowDeskLaneStallV1(input: {
	workflowId: string;
	reload: FlowDeskSessionEvidenceReloadResultV1;
	observedAt: string;
	lateThresholdMs?: number;
	stallThresholdMs?: number;
}): FlowDeskLaneStallProjectionResultV1 {
	const observedAtMs = Date.parse(input.observedAt);
	const lateThresholdMs =
		typeof input.lateThresholdMs === "number" && input.lateThresholdMs > 0
			? Math.max(input.lateThresholdMs, FLOWDESK_LANE_HEARTBEAT_MIN_LATE_MS)
			: FLOWDESK_LANE_HEARTBEAT_DEFAULT_LATE_MS;
	const stallThresholdMs =
		typeof input.stallThresholdMs === "number" && input.stallThresholdMs > 0
			? Math.max(input.stallThresholdMs, lateThresholdMs + 1_000)
			: Math.max(FLOWDESK_LANE_HEARTBEAT_DEFAULT_STALL_MS, lateThresholdMs + 1_000);
	if (!Number.isFinite(observedAtMs))
		return {
			schema_version: "flowdesk.lane_stall_projection.v1",
			observedAt: input.observedAt,
			lateThresholdMs,
			stallThresholdMs,
			totalActiveLanes: 0,
			totalLateLanes: 0,
			totalStalledLanes: 0,
			totalInconsistentLanes: 0,
			totalTerminalLanes: 0,
			worstClassification: "unknown",
			entries: [],
		};
	const latestByLane = pickLatestLifecyclePerLane(input.reload, input.workflowId);
	const inconsistenciesByLane = pickFinalizingWithoutTerminalInconsistencies(input.reload);
	const entries: FlowDeskLaneStallProjectionEntryV1[] = [];
	let totalActive = 0;
	let totalLate = 0;
	let totalStalled = 0;
	let totalInconsistent = 0;
	let totalTerminal = 0;
	for (const snapshot of latestByLane.values()) {
		const base = classify(
			snapshot,
			observedAtMs,
			lateThresholdMs,
			stallThresholdMs,
		);
		const inconsistency = inconsistenciesByLane.get(snapshot.laneId);
		const classification: FlowDeskLaneStallClassificationV1 =
			inconsistency === undefined
				? base.classification
				: "inconsistent_finalizing_without_terminal";
		const secondsSinceLastSignal = base.secondsSinceLastSignal;
		if (classification === "progressing_normal") totalActive += 1;
		if (classification === "progressing_late") {
			totalActive += 1;
			totalLate += 1;
		}
		if (classification === "stalled") {
			totalActive += 1;
			totalStalled += 1;
		}
		if (classification === "inconsistent_finalizing_without_terminal")
			totalInconsistent += 1;
		if (classification === "terminal") totalTerminal += 1;
		const failureHint = failureHintFor(snapshot.state);
		let expectedNextHeartbeatOverdue: boolean | undefined;
		let secondsPastExpectedNextHeartbeat: number | undefined;
		if (snapshot.expectedNextHeartbeatAt !== undefined) {
			const expectedMs = Date.parse(snapshot.expectedNextHeartbeatAt);
			if (Number.isFinite(expectedMs)) {
				const deltaMs = observedAtMs - expectedMs;
				expectedNextHeartbeatOverdue = deltaMs > 0;
				if (deltaMs > 0)
					secondsPastExpectedNextHeartbeat = Math.floor(deltaMs / 1000);
			}
		}
		entries.push({
			workflowId: snapshot.workflowId,
			laneId: snapshot.laneId,
			...(snapshot.attemptId === undefined
				? {}
				: { attemptId: snapshot.attemptId }),
			classification,
			lifecycleState: snapshot.state,
			lastSignalAt: snapshot.updatedAt,
			lastSignalEvidenceId: inconsistency?.evidenceId ?? snapshot.evidenceId,
			lastSignalSource: snapshot.signalSource,
			...(snapshot.heartbeatSeq === undefined
				? {}
				: { lastHeartbeatSeq: snapshot.heartbeatSeq }),
			...(snapshot.expectedNextHeartbeatAt === undefined
				? {}
				: { expectedNextHeartbeatAt: snapshot.expectedNextHeartbeatAt }),
			...(expectedNextHeartbeatOverdue === undefined
				? {}
				: { expectedNextHeartbeatOverdue }),
			...(secondsPastExpectedNextHeartbeat === undefined
				? {}
				: { secondsPastExpectedNextHeartbeat }),
			secondsSinceLastSignal,
			abnormal:
				classification === "stalled" ||
				classification === "progressing_late" ||
				classification === "inconsistent_finalizing_without_terminal",
			...(classification === "inconsistent_finalizing_without_terminal"
				? { failureHint: "finalizing_without_terminal" }
				: failureHint === undefined
					? {}
					: { failureHint }),
			safeNextActions: safeActionsFor(classification),
		});
	}
	entries.sort((a, b) => {
		const order: Record<FlowDeskLaneStallClassificationV1, number> = {
			inconsistent_finalizing_without_terminal: 0,
			stalled: 1,
			progressing_late: 2,
			progressing_normal: 3,
			terminal: 4,
			unknown: 5,
		};
		const byOrder = order[a.classification] - order[b.classification];
		if (byOrder !== 0) return byOrder;
		const aSeconds = a.secondsSinceLastSignal ?? 0;
		const bSeconds = b.secondsSinceLastSignal ?? 0;
		return bSeconds - aSeconds;
	});
	return {
		schema_version: "flowdesk.lane_stall_projection.v1",
		observedAt: input.observedAt,
		lateThresholdMs,
		stallThresholdMs,
		totalActiveLanes: totalActive,
		totalLateLanes: totalLate,
		totalStalledLanes: totalStalled,
		totalInconsistentLanes: totalInconsistent,
		totalTerminalLanes: totalTerminal,
		worstClassification: projectionWorstClassification(entries),
		entries,
	};
}
