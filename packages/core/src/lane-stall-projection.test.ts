import assert from "node:assert/strict";
import test from "node:test";
import type {
	FlowDeskLaneLifecycleRecordV1,
	FlowDeskSessionEvidenceReloadEntryV1,
	FlowDeskSessionEvidenceReloadResultV1,
} from "./index.js";
import { projectFlowDeskLaneStallV1 } from "./index.js";

const workflowId = "workflow-stall-test";
const observedAt = "2026-05-24T12:00:00.000Z";
const observedAtMs = Date.parse(observedAt);

function lifecycle(
	overrides: Partial<FlowDeskLaneLifecycleRecordV1>,
): FlowDeskLaneLifecycleRecordV1 {
	return {
		schema_version: "flowdesk.lane_lifecycle_record.v1",
		lane_id: "lane-stall-1",
		workflow_id: workflowId,
		attempt_id: "attempt-stall-1",
		parent_session_ref: "ses-stall-parent-1",
		agent_ref: "agent-reviewer",
		provider_qualified_model_id: "openai/gpt-5.4-mini-fast",
		state: "running",
		timeout_ms: 60_000,
		orphan_max_age_ms: 600_000,
		retry_count: 0,
		created_at: new Date(observedAtMs - 60_000).toISOString(),
		updated_at: new Date(observedAtMs - 60_000).toISOString(),
		dispatch_authority_enabled: false,
		providerCall: false,
		actualLaneLaunch: false,
		runtimeExecution: false,
		...overrides,
	};
}

function entry(
	record: FlowDeskLaneLifecycleRecordV1,
	evidenceId: string,
): FlowDeskSessionEvidenceReloadEntryV1 {
	return {
		evidenceClass: "lane_lifecycle",
		evidenceId,
		path: `.flowdesk/sessions/${workflowId}/lane_lifecycle/${evidenceId}.json`,
		record: record as unknown as Record<string, unknown>,
	};
}

function reload(
	entries: FlowDeskSessionEvidenceReloadEntryV1[],
): FlowDeskSessionEvidenceReloadResultV1 {
	return {
		ok: true,
		errors: [],
		entries,
		blocked: [],
		realOpenCodeDispatch: false,
		actualLaneLaunch: false,
		providerCall: false,
		runtimeExecution: false,
	};
}

test("lane stall projection classifies a fresh running lane as progressing_normal", () => {
	const result = projectFlowDeskLaneStallV1({
		workflowId,
		observedAt,
		reload: reload([
			entry(
				lifecycle({
					updated_at: new Date(observedAtMs - 30_000).toISOString(),
				}),
				"lifecycle-fresh",
			),
		]),
	});
	assert.equal(result.entries.length, 1);
	assert.equal(result.entries[0].classification, "progressing_normal");
	assert.equal(result.entries[0].abnormal, false);
	assert.equal(result.worstClassification, "progressing_normal");
	assert.equal(result.totalActiveLanes, 1);
	assert.equal(result.totalStalledLanes, 0);
});

test("lane stall projection classifies a 3-minute idle running lane as progressing_late", () => {
	const result = projectFlowDeskLaneStallV1({
		workflowId,
		observedAt,
		reload: reload([
			entry(
				lifecycle({
					updated_at: new Date(observedAtMs - 3 * 60_000).toISOString(),
				}),
				"lifecycle-late",
			),
		]),
	});
	assert.equal(result.entries[0].classification, "progressing_late");
	assert.equal(result.entries[0].abnormal, true);
	assert.equal(result.totalLateLanes, 1);
	assert.equal(result.worstClassification, "progressing_late");
	assert.ok(
		result.entries[0].safeNextActions.includes("/flowdesk-status"),
	);
});

test("lane stall projection classifies a 7-minute idle running lane as stalled", () => {
	const result = projectFlowDeskLaneStallV1({
		workflowId,
		observedAt,
		reload: reload([
			entry(
				lifecycle({
					updated_at: new Date(observedAtMs - 7 * 60_000).toISOString(),
				}),
				"lifecycle-stalled",
			),
		]),
	});
	assert.equal(result.entries[0].classification, "stalled");
	assert.equal(result.entries[0].abnormal, true);
	assert.equal(result.totalStalledLanes, 1);
	assert.equal(result.worstClassification, "stalled");
	assert.ok(result.entries[0].safeNextActions.includes("/flowdesk-retry"));
	assert.ok(result.entries[0].safeNextActions.includes("/flowdesk-abort"));
});

test("lane stall projection treats complete and aborted lanes as terminal", () => {
	const result = projectFlowDeskLaneStallV1({
		workflowId,
		observedAt,
		reload: reload([
			entry(
				lifecycle({
					lane_id: "lane-complete",
					state: "complete",
					verdict_ref: "verdict-complete",
					child_session_ref: "ses-child-1",
					message_ref: "msg-child-1",
					output_ref: "output-complete-1",
					runtime_echo_ref: "echo-complete-1",
					telemetry_ref: "telemetry-complete-1",
					updated_at: new Date(observedAtMs - 12 * 60_000).toISOString(),
				}),
				"lifecycle-complete",
			),
			entry(
				lifecycle({
					lane_id: "lane-aborted",
					state: "aborted",
					updated_at: new Date(observedAtMs - 15 * 60_000).toISOString(),
				}),
				"lifecycle-aborted",
			),
		]),
	});
	assert.equal(result.totalTerminalLanes, 2);
	assert.equal(result.totalStalledLanes, 0);
	for (const item of result.entries) {
		assert.equal(item.classification, "terminal");
		assert.equal(item.abnormal, false);
	}
});

test("lane stall projection keeps only the latest lifecycle per lane id", () => {
	const oldEntry = entry(
		lifecycle({
			updated_at: new Date(observedAtMs - 10 * 60_000).toISOString(),
		}),
		"lifecycle-old",
	);
	const recentEntry = entry(
		lifecycle({
			updated_at: new Date(observedAtMs - 30_000).toISOString(),
		}),
		"lifecycle-recent",
	);
	const result = projectFlowDeskLaneStallV1({
		workflowId,
		observedAt,
		reload: reload([oldEntry, recentEntry]),
	});
	assert.equal(result.entries.length, 1);
	assert.equal(result.entries[0].classification, "progressing_normal");
	assert.equal(result.entries[0].lastSignalEvidenceId, "lifecycle-recent");
});

test("lane stall projection attaches a failure hint for invocation_failed lanes", () => {
	const result = projectFlowDeskLaneStallV1({
		workflowId,
		observedAt,
		reload: reload([
			entry(
				lifecycle({
					lane_id: "lane-invocation-failed",
					state: "invocation_failed",
					updated_at: new Date(observedAtMs - 30_000).toISOString(),
				}),
				"lifecycle-invocation-failed",
			),
		]),
	});
	assert.equal(result.entries[0].classification, "terminal");
	assert.equal(result.entries[0].failureHint, "invocation_failed");
});

test("lane stall projection enforces a minimum late threshold and stall above it", () => {
	const result = projectFlowDeskLaneStallV1({
		workflowId,
		observedAt,
		lateThresholdMs: 1_000,
		stallThresholdMs: 1_000,
		reload: reload([
			entry(
				lifecycle({
					updated_at: new Date(observedAtMs - 30_000).toISOString(),
				}),
				"lifecycle-stalled-tight",
			),
		]),
	});
	assert.equal(result.lateThresholdMs, 10_000);
	assert.ok(result.stallThresholdMs > result.lateThresholdMs);
	assert.equal(result.entries[0].classification, "stalled");
});
