import {
	applyFlowDeskSessionEvidenceWriteIntentsV1,
	buildFlowDeskLaneHeartbeatRecordV1,
	type FlowDeskLaneHeartbeatStateV1,
	prepareFlowDeskSessionEvidenceWriteIntentV1,
	reloadFlowDeskSessionEvidenceV1,
} from "@flowdesk/core";

export interface FlowDeskLaneHeartbeatWriteRequestV1 {
	rootDir: string;
	workflowId: string;
	attemptId: string;
	laneId: string;
	parentSessionRef: string;
	agentRef: string;
	providerQualifiedModelId: string;
	state: FlowDeskLaneHeartbeatStateV1;
	progressSummaryLabel?: string;
	progressRef?: string;
	expectedIntervalMs?: number;
	heartbeatSeq?: number;
	observedAt?: string;
}

export interface FlowDeskLaneHeartbeatWriteResultV1 {
	status:
		| "lane_heartbeat_recorded"
		| "blocked_before_lane_heartbeat";
	rootDir?: string;
	workflowId?: string;
	attemptId?: string;
	laneId?: string;
	heartbeatId?: string;
	heartbeatSeq?: number;
	observedAt?: string;
	expectedNextHeartbeatAt?: string;
	writeAttempted: boolean;
	evidenceReloaded: boolean;
	redactedBlockReason?: string;
	safeNextActions: readonly ("/flowdesk-status" | "/flowdesk-doctor")[];
	authority: {
		realOpenCodeDispatch: false;
		providerCall: false;
		runtimeExecution: false;
		actualLaneLaunch: false;
		fallbackAuthority: false;
		hardCancelOrNoReplyAuthority: false;
		toolAuthority: false;
		laneHeartbeatPersisted: boolean;
	};
}

function authority(persisted: boolean): FlowDeskLaneHeartbeatWriteResultV1["authority"] {
	return {
		realOpenCodeDispatch: false,
		providerCall: false,
		runtimeExecution: false,
		actualLaneLaunch: false,
		fallbackAuthority: false,
		hardCancelOrNoReplyAuthority: false,
		toolAuthority: false,
		laneHeartbeatPersisted: persisted,
	};
}

function safeActions(): FlowDeskLaneHeartbeatWriteResultV1["safeNextActions"] {
	return ["/flowdesk-status", "/flowdesk-doctor"];
}

function blocked(
	request: FlowDeskLaneHeartbeatWriteRequestV1,
	reason: string,
): FlowDeskLaneHeartbeatWriteResultV1 {
	return {
		status: "blocked_before_lane_heartbeat",
		rootDir: request.rootDir,
		workflowId: request.workflowId,
		attemptId: request.attemptId,
		laneId: request.laneId,
		writeAttempted: false,
		evidenceReloaded: false,
		redactedBlockReason: reason,
		safeNextActions: safeActions(),
		authority: authority(false),
	};
}

function nextHeartbeatSeqFromReload(
	reload: ReturnType<typeof reloadFlowDeskSessionEvidenceV1>,
	laneId: string,
): number {
	let maxSeq = 0;
	for (const entry of reload.entries) {
		if (entry.evidenceClass !== "lane_heartbeat") continue;
		const record = entry.record;
		if (typeof record.lane_id !== "string" || record.lane_id !== laneId)
			continue;
		const seq =
			typeof record.heartbeat_seq === "number" &&
			Number.isFinite(record.heartbeat_seq)
				? record.heartbeat_seq
				: 0;
		if (seq > maxSeq) maxSeq = seq;
	}
	return maxSeq + 1;
}

export function recordFlowDeskLaneHeartbeatV1(
	request: FlowDeskLaneHeartbeatWriteRequestV1,
): FlowDeskLaneHeartbeatWriteResultV1 {
	if (typeof request.rootDir !== "string" || request.rootDir.trim().length === 0)
		return blocked(request, "rootDir is required");
	if (
		typeof request.workflowId !== "string" ||
		request.workflowId.trim().length === 0
	)
		return blocked(request, "workflowId is required");
	if (
		typeof request.attemptId !== "string" ||
		request.attemptId.trim().length === 0
	)
		return blocked(request, "attemptId is required");
	if (
		typeof request.laneId !== "string" ||
		request.laneId.trim().length === 0
	)
		return blocked(request, "laneId is required");
	const observedAt = request.observedAt ?? new Date().toISOString();
	const reload = reloadFlowDeskSessionEvidenceV1({
		workflowId: request.workflowId,
		rootDir: request.rootDir,
	});
	if (!reload.ok || reload.blocked.length > 0)
		return blocked(request, "session evidence reload failed before heartbeat write");
	const heartbeatSeq =
		typeof request.heartbeatSeq === "number" && request.heartbeatSeq > 0
			? Math.floor(request.heartbeatSeq)
			: nextHeartbeatSeqFromReload(reload, request.laneId);
	const built = buildFlowDeskLaneHeartbeatRecordV1({
		workflowId: request.workflowId,
		attemptId: request.attemptId,
		laneId: request.laneId,
		heartbeatSeq,
		state: request.state,
		observedAt,
		parentSessionRef: request.parentSessionRef,
		agentRef: request.agentRef,
		providerQualifiedModelId: request.providerQualifiedModelId,
		...(request.progressRef === undefined
			? {}
			: { progressRef: request.progressRef }),
		...(request.progressSummaryLabel === undefined
			? {}
			: { progressSummaryLabel: request.progressSummaryLabel }),
		...(request.expectedIntervalMs === undefined
			? {}
			: { expectedIntervalMs: request.expectedIntervalMs }),
	});
	if (!built.ok)
		return blocked(
			request,
			built.errors.join(", ") || "lane heartbeat record build failed",
		);
	const prepared = prepareFlowDeskSessionEvidenceWriteIntentV1({
		workflowId: request.workflowId,
		evidenceId: built.record.heartbeat_id,
		record: built.record as unknown as Record<string, unknown>,
	});
	if (!prepared.ok || prepared.writeIntent === undefined)
		return blocked(
			request,
			prepared.errors.join(", ") ||
				"lane heartbeat write intent preparation failed",
		);
	if (
		reload.entries.some(
			(entry) =>
				entry.evidenceClass === "lane_heartbeat" &&
				entry.evidenceId === built.record.heartbeat_id,
		)
	)
		return blocked(
			request,
			"lane heartbeat evidence id already exists; pick a fresh sequence",
		);
	const applied = applyFlowDeskSessionEvidenceWriteIntentsV1(request.rootDir, [
		prepared.writeIntent,
	]);
	if (!applied.ok)
		return blocked(
			request,
			applied.errors.join(", ") || "lane heartbeat write failed",
		);
	const reloadAfter = reloadFlowDeskSessionEvidenceV1({
		workflowId: request.workflowId,
		rootDir: request.rootDir,
	});
	const persisted =
		reloadAfter.ok &&
		reloadAfter.entries.some(
			(entry) =>
				entry.evidenceClass === "lane_heartbeat" &&
				entry.evidenceId === built.record.heartbeat_id,
		);
	if (!persisted)
		return blocked(request, "lane heartbeat reload verification failed");
	return {
		status: "lane_heartbeat_recorded",
		rootDir: request.rootDir,
		workflowId: request.workflowId,
		attemptId: request.attemptId,
		laneId: request.laneId,
		heartbeatId: built.record.heartbeat_id,
		heartbeatSeq: built.record.heartbeat_seq,
		observedAt: built.record.observed_at,
		expectedNextHeartbeatAt: built.record.expected_next_heartbeat_at,
		writeAttempted: true,
		evidenceReloaded: true,
		safeNextActions: safeActions(),
		authority: authority(true),
	};
}
