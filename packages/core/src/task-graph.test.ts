import assert from "node:assert/strict";
import test from "node:test";
import { validateFlowDeskTaskGraphV1 } from "./index.js";

function graph(overrides: Record<string, unknown> = {}) {
	return {
		schema_version: "flowdesk.task_graph.v1",
		workflow_id: "workflow-graph-1",
		task_graph_id: "task-graph-1",
		nodes: [
			{ task_id: "task-plan", title: "Plan", summary: "Create planning evidence." },
			{ task_id: "task-review", title: "Review", summary: "Review planning evidence." },
		],
		edges: [{ from_task_id: "task-plan", to_task_id: "task-review", relation: "depends_on" }],
		graph_summary: "Review depends on planning.",
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

test("task graph accepts a DAG", () => {
	const result = validateFlowDeskTaskGraphV1(graph());
	assert.equal(result.ok, true, result.errors.join("; "));
});

test("task graph rejects duplicate, missing, self, and cyclic dependencies", () => {
	assert.match(validateFlowDeskTaskGraphV1(graph({ nodes: [graph().nodes[0], graph().nodes[0]] })).errors.join("|"), /duplicate task id/);
	assert.match(validateFlowDeskTaskGraphV1(graph({ edges: [{ from_task_id: "task-missing", to_task_id: "task-review", relation: "depends_on" }] })).errors.join("|"), /missing dependency/);
	assert.match(validateFlowDeskTaskGraphV1(graph({ edges: [{ from_task_id: "task-plan", to_task_id: "task-plan", relation: "depends_on" }] })).errors.join("|"), /self dependency/);
	assert.match(validateFlowDeskTaskGraphV1(graph({ edges: [{ from_task_id: "task-plan", to_task_id: "task-review", relation: "depends_on" }, { from_task_id: "task-review", to_task_id: "task-plan", relation: "depends_on" }] })).errors.join("|"), /cycle/);
});

test("task graph rejects raw markers and authority flags", () => {
	assert.equal(validateFlowDeskTaskGraphV1(graph({ graph_summary: "provider payload evidence" })).ok, false);
	assert.equal(validateFlowDeskTaskGraphV1(graph({ provider_call_made: true })).ok, false);
});
