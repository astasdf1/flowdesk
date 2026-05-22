import assert from "node:assert/strict";
import test from "node:test";
import {
	planFlowDeskRuntimeLaneLaunchV1,
	projectFlowDeskRuntimeLaneLifecycleV1,
	validateFlowDeskRuntimeLaneLaunchPlanV1,
	validateFlowDeskRuntimeLaneLaunchRequestV1,
	type FlowDeskLaneLifecycleRecordV1,
	type FlowDeskRuntimeLaneLaunchRequestV1,
} from "./index.js";

function request(
	overrides: Partial<FlowDeskRuntimeLaneLaunchRequestV1> = {},
): FlowDeskRuntimeLaneLaunchRequestV1 {
	return {
		schema_version: "flowdesk.runtime_lane_launch_request.v1",
		launch_request_id: "launch-request-1",
		workflow_id: "workflow-1",
		attempt_id: "attempt-1",
		lane_id: "lane-1",
		parent_session_ref: "ses-parent-1",
		agent_ref: "agent-reviewer",
		provider_qualified_model_id: "claude/claude-opus-4-5",
		launch_reason: "reviewer_fanout",
		pre_launch_audit_ref: "audit-pre-launch-1",
		lane_launch_approval_ref: "approval-lane-launch-1",
		requested_at: "2026-05-22T00:00:00.000Z",
		timeout_ms: 30000,
		orphan_max_age_ms: 60000,
		retry_budget: 1,
		dispatch_authority_enabled: false,
		providerCall: false,
		actualLaneLaunch: false,
		runtimeExecution: false,
		...overrides,
	};
}

function lifecycle(
	overrides: Partial<FlowDeskLaneLifecycleRecordV1> = {},
): FlowDeskLaneLifecycleRecordV1 {
	return {
		schema_version: "flowdesk.lane_lifecycle_record.v1",
		lane_id: "lane-1",
		workflow_id: "workflow-1",
		attempt_id: "attempt-1",
		parent_session_ref: "ses-parent-1",
		child_session_ref: "ses-child-1",
		message_ref: "msg-1",
		agent_ref: "agent-reviewer",
		provider_qualified_model_id: "claude/claude-opus-4-5",
		state: "complete",
		verdict_ref: "verdict-1",
		output_ref: "output-1",
		runtime_echo_ref: "echo-1",
		telemetry_ref: "telemetry-1",
		timeout_ms: 30000,
		orphan_max_age_ms: 60000,
		retry_count: 0,
		created_at: "2026-05-22T00:00:00.000Z",
		updated_at: "2026-05-22T00:01:00.000Z",
		dispatch_authority_enabled: false,
		providerCall: false,
		actualLaneLaunch: false,
		runtimeExecution: false,
		...overrides,
	};
}

test("runtime lane launch request validates exact non-authorizing binding", () => {
	assert.equal(validateFlowDeskRuntimeLaneLaunchRequestV1(request()).ok, true);
	const invalidAlias = validateFlowDeskRuntimeLaneLaunchRequestV1(
		request({ provider_qualified_model_id: "claude/latest" }),
	);
	assert.equal(invalidAlias.ok, false);
	assert.match(invalidAlias.errors.join("; "), /concrete non-alias/);
	const authoritySmuggling = validateFlowDeskRuntimeLaneLaunchRequestV1({
		...request(),
		actualLaneLaunch: true,
	});
	assert.equal(authoritySmuggling.ok, false);
	assert.match(authoritySmuggling.errors.join("; "), /cannot enable/);
});

test("runtime lane launch plan blocks until all launch preconditions are present", () => {
	const blocked = planFlowDeskRuntimeLaneLaunchV1({ request: request({ pre_launch_audit_ref: undefined }) });
	assert.equal(blocked.state, "blocked");
	assert.equal(blocked.launch_attempted, false);
	assert.equal(blocked.actualLaneLaunch, false);
	assert.match(blocked.blocked_labels.join("; "), /pre_launch_audit_missing/);
	assert.match(blocked.blocked_labels.join("; "), /sdk_client_unavailable/);

	const ready = planFlowDeskRuntimeLaneLaunchV1({
		request: request(),
		sdkClientAvailable: true,
		durableEvidenceRootRef: "evidence-root-workflow-1",
	});
	assert.equal(ready.state, "launch_ready");
	assert.equal(ready.exact_binding_confirmed, true);
	assert.equal(ready.launch_attempted, false);
	assert.equal(ready.providerCall, false);
	assert.equal(validateFlowDeskRuntimeLaneLaunchPlanV1(ready).ok, true);
});

test("runtime lane lifecycle projection never infers approval from lane output", () => {
	const ready = planFlowDeskRuntimeLaneLaunchV1({
		request: request(),
		sdkClientAvailable: true,
		durableEvidenceRootRef: "evidence-root-workflow-1",
	});
	const complete = projectFlowDeskRuntimeLaneLifecycleV1({ plan: ready, lifecycle: lifecycle() });
	assert.equal(complete.projection_state, "complete_with_verdict");
	assert.equal(complete.approval_inferred, false);
	assert.equal(complete.verdict_ref, "verdict-1");

	const missingVerdict = projectFlowDeskRuntimeLaneLifecycleV1({
		plan: ready,
		lifecycle: lifecycle({
			state: "missing_verdict",
			verdict_ref: undefined,
		}),
	});
	assert.equal(missingVerdict.projection_state, "terminal_non_approval");
	assert.equal(missingVerdict.approval_inferred, false);
	assert.equal(missingVerdict.verdict_ref, undefined);
});
