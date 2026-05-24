import type {
	FlowDeskSessionEvidenceReloadEntryV1,
	FlowDeskSessionEvidenceReloadResultV1,
} from "./session-evidence.js";

export const FLOWDESK_LANE_HEARTBEAT_DEFAULT_LATE_MS = 2 * 60 * 1000;
export const FLOWDESK_LANE_HEARTBEAT_DEFAULT_STALL_MS = 5 * 60 * 1000;
export const FLOWDESK_LANE_HEARTBEAT_MIN_LATE_MS = 10_000;

const ACTIVE_LIFECYCLE_STATES = new Set([
	"created",
	"running",
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
	};
}

function pickLatestLifecyclePerLane(
	reload: FlowDeskSessionEvidenceReloadResultV1,
	workflowId: string,
): Map<string, LifecycleSnapshot> {
	const latestByLane = new Map<string, LifecycleSnapshot>();
	for (const entry of reload.entries) {
		if (!isLifecycleEntry(entry)) continue;
		const snapshot = lifecycleSnapshotFromEntry(entry, workflowId);
		if (snapshot === undefined) continue;
		const previous = latestByLane.get(snapshot.laneId);
		if (previous === undefined || snapshot.updatedAtMs > previous.updatedAtMs)
			latestByLane.set(snapshot.laneId, snapshot);
	}
	return latestByLane;
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
			totalTerminalLanes: 0,
			worstClassification: "unknown",
			entries: [],
		};
	const latestByLane = pickLatestLifecyclePerLane(input.reload, input.workflowId);
	const entries: FlowDeskLaneStallProjectionEntryV1[] = [];
	let totalActive = 0;
	let totalLate = 0;
	let totalStalled = 0;
	let totalTerminal = 0;
	for (const snapshot of latestByLane.values()) {
		const { classification, secondsSinceLastSignal } = classify(
			snapshot,
			observedAtMs,
			lateThresholdMs,
			stallThresholdMs,
		);
		if (classification === "progressing_normal") totalActive += 1;
		if (classification === "progressing_late") {
			totalActive += 1;
			totalLate += 1;
		}
		if (classification === "stalled") {
			totalActive += 1;
			totalStalled += 1;
		}
		if (classification === "terminal") totalTerminal += 1;
		const failureHint = failureHintFor(snapshot.state);
		entries.push({
			workflowId: snapshot.workflowId,
			laneId: snapshot.laneId,
			...(snapshot.attemptId === undefined
				? {}
				: { attemptId: snapshot.attemptId }),
			classification,
			lifecycleState: snapshot.state,
			lastSignalAt: snapshot.updatedAt,
			lastSignalEvidenceId: snapshot.evidenceId,
			secondsSinceLastSignal,
			abnormal:
				classification === "stalled" || classification === "progressing_late",
			...(failureHint === undefined ? {} : { failureHint }),
			safeNextActions: safeActionsFor(classification),
		});
	}
	entries.sort((a, b) => {
		const order: Record<FlowDeskLaneStallClassificationV1, number> = {
			stalled: 0,
			progressing_late: 1,
			progressing_normal: 2,
			terminal: 3,
			unknown: 4,
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
		totalTerminalLanes: totalTerminal,
		worstClassification: projectionWorstClassification(entries),
		entries,
	};
}
