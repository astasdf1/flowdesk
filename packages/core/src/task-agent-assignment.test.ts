import assert from "node:assert/strict";
import test from "node:test";
import { validateFlowDeskTaskAgentAssignmentV1 } from "./index.js";

function assignment(overrides: Record<string, unknown> = {}) {
	return {
		schema_version: "flowdesk.task_agent_assignment.v1",
		workflow_id: "workflow-agent-1",
		task_id: "task-plan",
		assignment_id: "assignment-1",
		agent_role: "implementation",
		agent_role_ref: "agent-role-implementation",
		selected_agent_ref: "agent-code-backend",
		selected_profile_ref: "profile-readonly",
		compatibility_status: "compatible",
		fit_label: "bounded core planning fit",
		registry_evidence_ref: "registry-evidence-1",
		profile_evidence_ref: "profile-evidence-1",
		blocked_labels: [],
		created_at: "2026-05-27T00:00:00.000Z",
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

test("task agent assignment accepts compatible planning assignment", () => {
	const result = validateFlowDeskTaskAgentAssignmentV1(assignment());
	assert.equal(result.ok, true, result.errors.join("; "));
});

test("task agent assignment rejects bad role, raw markers, unknown props, and authority", () => {
	assert.equal(validateFlowDeskTaskAgentAssignmentV1(assignment({ agent_role: "unknown-role" })).ok, false);
	assert.equal(validateFlowDeskTaskAgentAssignmentV1(assignment({ fit_label: "raw config copied" })).ok, false);
	assert.equal(validateFlowDeskTaskAgentAssignmentV1(assignment({ extra: "nope" })).ok, false);
	assert.equal(validateFlowDeskTaskAgentAssignmentV1(assignment({ actual_lane_launch: true })).ok, false);
});
