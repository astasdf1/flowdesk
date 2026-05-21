import assert from "node:assert/strict";
import test from "node:test";
import { validateFlowDeskLaneLifecycleRecordV1, type FlowDeskLaneLifecycleRecordV1 } from "./index.js";

function record(overrides: Partial<FlowDeskLaneLifecycleRecordV1> = {}): FlowDeskLaneLifecycleRecordV1 {
	return {
		schema_version: "flowdesk.lane_lifecycle_record.v1",
		lane_id: "lane-1",
		workflow_id: "workflow-1",
		attempt_id: "attempt-1",
		parent_session_ref: "ses-parent-1",
		child_session_ref: "ses-child-1",
		message_ref: "msg-1",
		background_task_ref: "bg-1",
		continuation_session_ref: "ses-child-1",
		agent_ref: "agent-reviewer",
		provider_qualified_model_id: "claude/claude-opus-4-5",
		state: "complete",
		verdict_ref: "verdict-1",
		output_ref: "output-1",
		runtime_echo_ref: "echo-1",
		telemetry_ref: "telemetry-1",
		timeout_ms: 30000,
		orphan_max_age_ms: 60000,
		retry_count: 1,
		created_at: "2026-05-21T00:00:00.000Z",
		updated_at: "2026-05-21T00:01:00.000Z",
		dispatch_authority_enabled: false,
		providerCall: false,
		actualLaneLaunch: false,
		runtimeExecution: false,
		...overrides,
	};
}

test("lane lifecycle accepts complete records with verdict refs", () => {
	assert.equal(validateFlowDeskLaneLifecycleRecordV1(record()).ok, true);
});

test("lane lifecycle separates no-output and missing-verdict from approvals", () => {
	const noOutput = validateFlowDeskLaneLifecycleRecordV1(record({ state: "no_output", verdict_ref: undefined }));
	assert.equal(noOutput.ok, false);
	assert.match(noOutput.errors.join("; "), /output_ref/);
	const noOutputClean = validateFlowDeskLaneLifecycleRecordV1(record({ state: "no_output", verdict_ref: undefined, output_ref: undefined }));
	assert.equal(noOutputClean.ok, true, noOutputClean.errors.join("; "));
	const missingVerdict = validateFlowDeskLaneLifecycleRecordV1(record({ state: "missing_verdict", verdict_ref: undefined }));
	assert.equal(missingVerdict.ok, true, missingVerdict.errors.join("; "));
	const forged = validateFlowDeskLaneLifecycleRecordV1(record({ state: "missing_verdict", verdict_ref: "verdict-1" }));
	assert.equal(forged.ok, false);
	assert.match(forged.errors.join("; "), /cannot carry verdict_ref/);
});

test("lane lifecycle rejects incomplete complete lanes and failed-lane verdicts", () => {
	const incompleteComplete = validateFlowDeskLaneLifecycleRecordV1(record({ child_session_ref: undefined }));
	assert.equal(incompleteComplete.ok, false);
	assert.match(incompleteComplete.errors.join("; "), /complete lane lifecycle records require child/);

	const timedOutApproval = validateFlowDeskLaneLifecycleRecordV1(record({ state: "timeout", verdict_ref: "verdict-1" }));
	assert.equal(timedOutApproval.ok, false);
	assert.match(timedOutApproval.errors.join("; "), /failed lane lifecycle records cannot carry verdict_ref/);

	const collapsedParentChild = validateFlowDeskLaneLifecycleRecordV1(record({ child_session_ref: "ses-parent-1" }));
	assert.equal(collapsedParentChild.ok, false);
	assert.match(collapsedParentChild.errors.join("; "), /parent and child/);
});

test("lane lifecycle rejects ref-kind collapse and authority smuggling", () => {
	const bad = validateFlowDeskLaneLifecycleRecordV1({
		...record({ background_task_ref: "same-ref", continuation_session_ref: "same-ref", retry_count: 3 }),
		providerCall: true,
	});
	assert.equal(bad.ok, false);
	assert.match(bad.errors.join("|"), /kind prefix|kind-separated|retry_count|runtime authority/);
});

test("lane lifecycle rejects swapped ref kinds", () => {
	const swapped = validateFlowDeskLaneLifecycleRecordV1(record({
		background_task_ref: "ses-not-a-background-task",
		continuation_session_ref: "bg-not-a-session",
	}));
	assert.equal(swapped.ok, false);
	assert.match(swapped.errors.join("|"), /background_task_ref must use bg-|continuation_session_ref must use ses-/);
});
