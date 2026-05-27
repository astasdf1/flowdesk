import assert from "node:assert/strict";
import test from "node:test";
import { validateFlowDeskWorkflowAuthoringResultV1 } from "./index.js";

function record(overrides: Record<string, unknown> = {}) {
	return {
		schema_version: "flowdesk.workflow_authoring_result.v1",
		workflow_id: "workflow-authoring-1",
		authoring_result_id: "authoring-result-1",
		goal_summary: "Plan a bounded Release 1 documentation update.",
		scope_summary: "Planning evidence only with no runtime work.",
		output_summary: "Task graph and selection records are ready for review.",
		risk_summary: "Safety risk is limited to malformed durable planning evidence.",
		status: "authored",
		created_at: "2026-05-27T00:00:00.000Z",
		evidence_refs: ["evidence-task-graph-1"],
		release_gate: "release1_planning_only",
		dispatch_authority_enabled: false,
		provider_call_made: false,
		runtime_execution: false,
		actual_lane_launch: false,
		write_authority_enabled: false,
		redaction_version: "v1",
		...overrides,
	};
}

test("workflow authoring result accepts bounded planning-only evidence", () => {
	const result = validateFlowDeskWorkflowAuthoringResultV1(record());
	assert.equal(result.ok, true, result.errors.join("; "));
});

test("workflow authoring result rejects unknown properties, raw markers, and authority", () => {
	assert.equal(validateFlowDeskWorkflowAuthoringResultV1(record({ extra: "nope" })).ok, false);
	assert.equal(validateFlowDeskWorkflowAuthoringResultV1(record({ goal_summary: "contains system prompt marker" })).ok, false);
	const authority = validateFlowDeskWorkflowAuthoringResultV1(record({ dispatch_authority_enabled: true }));
	assert.equal(authority.ok, false);
	assert.match(authority.errors.join("|"), /dispatch_authority_enabled/);
});
