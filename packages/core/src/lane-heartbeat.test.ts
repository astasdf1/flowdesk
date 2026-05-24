import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import {
	applyFlowDeskSessionEvidenceWriteIntentsV1,
	buildFlowDeskLaneHeartbeatRecordV1,
	prepareFlowDeskSessionEvidenceWriteIntentV1,
	projectFlowDeskLaneStallV1,
	reloadFlowDeskSessionEvidenceV1,
	validateFlowDeskLaneHeartbeatRecordV1,
} from "./index.js";

const workflowId = "workflow-heartbeat-test";
const attemptId = "attempt-heartbeat-test";
const laneId = "lane-heartbeat-test";
const baseInput = {
	workflowId,
	attemptId,
	laneId,
	heartbeatSeq: 1,
	state: "running" as const,
	observedAt: "2026-05-24T12:00:00.000Z",
	parentSessionRef: "ses-heartbeat-parent",
	agentRef: "agent-heartbeat",
	providerQualifiedModelId: "openai/gpt-5.4-mini-fast",
};

test("heartbeat builder produces a validated lane heartbeat record with default interval", () => {
	const result = buildFlowDeskLaneHeartbeatRecordV1(baseInput);
	assert.equal(result.ok, true);
	if (!result.ok) return;
	const record = result.record;
	assert.equal(record.schema_version, "flowdesk.lane_heartbeat.v1");
	assert.equal(record.heartbeat_id, "heartbeat-lane-heartbeat-test-00000001");
	assert.equal(record.observed_at, "2026-05-24T12:00:00.000Z");
	assert.equal(record.expected_next_heartbeat_at, "2026-05-24T12:02:00.000Z");
	assert.equal(record.dispatch_authority_enabled, false);
	assert.equal(record.providerCall, false);
	assert.equal(record.actualLaneLaunch, false);
	assert.equal(record.runtimeExecution, false);
});

test("heartbeat builder clamps absurdly low intervals to the minimum", () => {
	const result = buildFlowDeskLaneHeartbeatRecordV1({
		...baseInput,
		expectedIntervalMs: 1_000,
	});
	assert.equal(result.ok, true);
	if (!result.ok) return;
	assert.equal(
		result.record.expected_next_heartbeat_at,
		"2026-05-24T12:00:10.000Z",
	);
});

test("heartbeat validator rejects authority smuggling and forbidden state values", () => {
	const result = buildFlowDeskLaneHeartbeatRecordV1(baseInput);
	assert.equal(result.ok, true);
	if (!result.ok) return;
	const record = result.record;
	assert.equal(
		validateFlowDeskLaneHeartbeatRecordV1({
			...record,
			providerCall: true,
		}).ok,
		false,
	);
	assert.equal(
		validateFlowDeskLaneHeartbeatRecordV1({
			...record,
			state: "complete",
		}).ok,
		false,
	);
	assert.equal(
		validateFlowDeskLaneHeartbeatRecordV1({
			...record,
			expected_next_heartbeat_at: record.observed_at,
		}).ok,
		false,
	);
});

test("heartbeat evidence persists through the session evidence writer and reload", () => {
	const root = mkdtempSync(join(tmpdir(), "flowdesk-lane-heartbeat-"));
	try {
		const result = buildFlowDeskLaneHeartbeatRecordV1(baseInput);
		assert.equal(result.ok, true);
		if (!result.ok) return;
		const prepared = prepareFlowDeskSessionEvidenceWriteIntentV1({
			workflowId,
			evidenceId: result.record.heartbeat_id,
			record: result.record as unknown as Record<string, unknown>,
		});
		assert.equal(prepared.ok, true, prepared.errors.join("; "));
		const applied = applyFlowDeskSessionEvidenceWriteIntentsV1(root, [
			prepared.writeIntent as never,
		]);
		assert.equal(applied.ok, true, applied.errors.join("; "));
		const reload = reloadFlowDeskSessionEvidenceV1({
			workflowId,
			rootDir: root,
		});
		assert.equal(reload.ok, true);
		const heartbeatEntries = reload.entries.filter(
			(entry) => entry.evidenceClass === "lane_heartbeat",
		);
		assert.equal(heartbeatEntries.length, 1);
		assert.equal(
			heartbeatEntries[0].evidenceId,
			"heartbeat-lane-heartbeat-test-00000001",
		);
	} finally {
		rmSync(root, { recursive: true, force: true });
	}
});

test("stall projection uses heartbeat evidence to keep a lane progressing_normal", () => {
	const observedAt = "2026-05-24T12:10:00.000Z";
	const observedAtMs = Date.parse(observedAt);
	const lifecycleEntry = {
		evidenceClass: "lane_lifecycle" as const,
		evidenceId: "lifecycle-heartbeat-stale",
		path: ".flowdesk/sessions/workflow-heartbeat-test/lane_lifecycle/lifecycle-heartbeat-stale.json",
		record: {
			schema_version: "flowdesk.lane_lifecycle_record.v1",
			lane_id: laneId,
			workflow_id: workflowId,
			attempt_id: attemptId,
			parent_session_ref: "ses-heartbeat-parent",
			agent_ref: "agent-heartbeat",
			provider_qualified_model_id: "openai/gpt-5.4-mini-fast",
			state: "running",
			timeout_ms: 60_000,
			orphan_max_age_ms: 600_000,
			retry_count: 0,
			created_at: new Date(observedAtMs - 9 * 60_000).toISOString(),
			updated_at: new Date(observedAtMs - 9 * 60_000).toISOString(),
			dispatch_authority_enabled: false,
			providerCall: false,
			actualLaneLaunch: false,
			runtimeExecution: false,
		},
	};
	const fresh = buildFlowDeskLaneHeartbeatRecordV1({
		...baseInput,
		heartbeatSeq: 4,
		observedAt: new Date(observedAtMs - 30_000).toISOString(),
	});
	assert.equal(fresh.ok, true);
	if (!fresh.ok) return;
	const heartbeatEntry = {
		evidenceClass: "lane_heartbeat" as const,
		evidenceId: fresh.record.heartbeat_id,
		path: `.flowdesk/sessions/${workflowId}/lane_heartbeat/${fresh.record.heartbeat_id}.json`,
		record: fresh.record as unknown as Record<string, unknown>,
	};
	const reload = {
		ok: true,
		errors: [],
		entries: [lifecycleEntry, heartbeatEntry],
		blocked: [],
		realOpenCodeDispatch: false as const,
		actualLaneLaunch: false as const,
		providerCall: false as const,
		runtimeExecution: false as const,
	};
	const projection = projectFlowDeskLaneStallV1({
		workflowId,
		observedAt,
		reload,
	});
	assert.equal(projection.entries.length, 1);
	const entry = projection.entries[0];
	assert.equal(entry.classification, "progressing_normal");
	assert.equal(entry.lastSignalSource, "lane_heartbeat");
	assert.equal(entry.lastHeartbeatSeq, 4);
	assert.equal(entry.abnormal, false);
	assert.equal(projection.worstClassification, "progressing_normal");
	assert.equal(projection.totalStalledLanes, 0);
});
