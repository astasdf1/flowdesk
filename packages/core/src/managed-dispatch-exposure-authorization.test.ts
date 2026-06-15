import assert from "node:assert/strict";
import test from "node:test";
import {
	evaluateFlowDeskManagedDispatchExposureAuthorizationV1,
	FLOWDESK_S7_EXPOSURE_AUTHORITY_FALSE_FLAGS,
	FLOWDESK_S7_REQUIRED_S6_TUPLE,
	validateFlowDeskManagedDispatchExposureAuthorizationV1,
} from "./index.js";

const now = "2026-06-15T12:00:00.000Z";
const freshCreatedAt = "2026-06-15T11:55:00.000Z";

function taskResult(overrides: Record<string, unknown> = {}) {
	return {
		schema_version: "flowdesk.task_result.v1",
		workflow_id: FLOWDESK_S7_REQUIRED_S6_TUPLE.workflow_id,
		lane_id: FLOWDESK_S7_REQUIRED_S6_TUPLE.lane_id,
		task_id: FLOWDESK_S7_REQUIRED_S6_TUPLE.task_id,
		agent_ref: "agent-flowdesk-s6-smoke",
		provider_qualified_model_id: "openai/gpt-5.5",
		task_prompt_sha256: "sha256-s6-input-digest",
		result_text: `S6 completed. ${FLOWDESK_S7_REQUIRED_S6_TUPLE.sentinel}`,
		result_text_truncated: false,
		result_text_sha256: "sha256-s6-result",
		created_at: freshCreatedAt,
		dispatch_authority_enabled: false,
		...overrides,
	};
}

function evaluate(overrides: Record<string, unknown> = {}) {
	return evaluateFlowDeskManagedDispatchExposureAuthorizationV1({
		taskResultEvidence: taskResult(),
		taskResultEvidenceId: FLOWDESK_S7_REQUIRED_S6_TUPLE.result_evidence_id,
		progressSnapshotWorkflowId: FLOWDESK_S7_REQUIRED_S6_TUPLE.progress_snapshot_workflow_id,
		now,
		...overrides,
	});
}

test("managed dispatch exposure authorization accepts exact S6 tuple", () => {
	const result = evaluate();
	assert.equal(result.ok, true, result.blocked_labels.join("; "));
	assert.equal(result.state, "authorized");
	assert.equal(result.exposure_readiness_authorized, true);
	assert.deepEqual(result.blocked_labels, []);
	assert.equal(validateFlowDeskManagedDispatchExposureAuthorizationV1(result).ok, true);
});

test("managed dispatch exposure authorization blocks missing task_result", () => {
	const result = evaluate({ taskResultEvidence: undefined });
	assert.equal(result.ok, false);
	assert.ok(result.blocked_labels.includes("task_result_missing"));
});

test("managed dispatch exposure authorization blocks wrong lane/task/result/sentinel", () => {
	const result = evaluate({
		taskResultEvidence: taskResult({
			lane_id: "lane-task-wrong",
			task_id: "task-wrong",
			result_text: "S6 completed without sentinel",
		}),
		taskResultEvidenceId: "task-result-wrong",
	});
	assert.ok(result.blocked_labels.includes("s6_lane_mismatched"));
	assert.ok(result.blocked_labels.includes("s6_task_mismatched"));
	assert.ok(result.blocked_labels.includes("s6_result_evidence_mismatched"));
	assert.ok(result.blocked_labels.includes("s6_sentinel_mismatched"));
});

test("managed dispatch exposure authorization blocks stale and expired records", () => {
	const stale = evaluate({
		taskResultEvidence: taskResult({ created_at: "2026-06-13T00:00:00.000Z" }),
	});
	assert.ok(stale.blocked_labels.includes("s6_task_result_stale"));

	const expired = evaluate({ expiresAt: "2026-06-15T11:59:59.000Z" });
	assert.ok(expired.blocked_labels.includes("s7_authorization_expired"));
});

test("managed dispatch exposure authorization validator blocks missing or true negative authority flags", () => {
	const valid = evaluate();
	for (const flag of FLOWDESK_S7_EXPOSURE_AUTHORITY_FALSE_FLAGS) {
		const missing = { ...valid } as Record<string, unknown>;
		delete missing[flag];
		missing.ok = false;
		missing.state = "blocked";
		missing.exposure_readiness_authorized = false;
		missing.blocked_labels = ["negative_authority_not_explicit"];
		assert.equal(validateFlowDeskManagedDispatchExposureAuthorizationV1(missing).ok, false, `${flag} missing must block`);

		const enabled = { ...valid, [flag]: true, ok: false, state: "blocked", exposure_readiness_authorized: false, blocked_labels: ["negative_authority_not_explicit"] };
		assert.equal(validateFlowDeskManagedDispatchExposureAuthorizationV1(enabled).ok, false, `${flag} true must block`);
	}
});

test("managed dispatch exposure authorization output keeps non-exposure authority flags false", () => {
	const result = evaluate();
	assert.equal(result.fallback_authority_enabled, false);
	assert.equal(result.external_write_authority_enabled, false);
	assert.equal(result.hard_chat_authority_enabled, false);
	assert.equal(result.no_reply_authority_enabled, false);
	assert.equal(result.opencode_internal_authority_enabled, false);
	assert.equal(result.dispatch_authority_enabled, false);
	assert.equal(result.providerCall, false);
	assert.equal(result.actualLaneLaunch, false);
	assert.equal(result.runtimeExecution, false);
	assert.equal(result.realOpenCodeDispatch, false);
});
