import assert from "node:assert/strict";
import test from "node:test";
import type { FlowDeskTaskGraphV1, FlowDeskTaskModelSelectionV1 } from "@flowdesk/core";
import { executeFlowDeskWorkflowSchedulerV1 } from "./workflow-scheduler.js";
import type { FlowDeskAgentTaskResultV1 } from "./agent-task-runner.js";

const graph: FlowDeskTaskGraphV1 = {
	schema_version: "flowdesk.task_graph.v1",
	workflow_id: "workflow-1",
	task_graph_id: "graph-1",
	nodes: [
		{ task_id: "task-a", title: "A", summary: "first" },
		{ task_id: "task-b", title: "B", summary: "second" },
	],
	edges: [{ from_task_id: "task-a", to_task_id: "task-b", relation: "depends_on" }],
	graph_summary: "test",
	created_at: "2026-05-27T00:00:00.000Z",
	release_gate: "release1_planning_only",
	dispatch_authority_enabled: false,
	provider_call_made: false,
	runtime_execution: false,
	actual_lane_launch: false,
	write_authority_enabled: false,
	redaction_version: "v1",
};

function selection(task_id: string): FlowDeskTaskModelSelectionV1 {
	return {
		schema_version: "flowdesk.task_model_selection.v1",
		workflow_id: "workflow-1",
		task_id,
		selection_id: `sel-${task_id}`,
		provider_family: "openai",
		provider_qualified_model_id: "openai/gpt-5.5",
		usage_snapshot_ref: "u-1",
		usage_snapshot_freshness: "fresh",
		provider_health_ref: "h-1",
		provider_health_label: "ok",
		exact_model_availability_ref: "m-1",
		exact_model_availability_label: "available",
		fit_label: "strong_fit",
		performance_label: "headroom_ok",
		selection_status: "selected",
		blocked_labels: [],
		fallback_allowed: false,
		reselection_allowed: false,
		created_at: "2026-05-27T00:00:00.000Z",
		release_gate: "release1_planning_only",
		dispatch_authority_enabled: false,
		provider_call_made: false,
		runtime_execution: false,
		actual_lane_launch: false,
		write_authority_enabled: false,
		redaction_version: "v1",
	};
}

test("workflow scheduler executes tasks sequentially in dependency order", async () => {
	const executed: string[] = [];
	const result = await executeFlowDeskWorkflowSchedulerV1({
		taskGraph: graph,
		modelSelections: [selection("task-a"), selection("task-b")],
		parentSessionId: "ses-1",
		rootDir: "/tmp",
		client: {} as any,
		agentRef: "agent-1",
		runAgentTask: async (input) => {
			executed.push(input.taskId);
			return { status: "task_completed", taskResultEvidenceId: `result-${input.taskId}` } as FlowDeskAgentTaskResultV1;
		},
	});

	assert.equal(result.status, "workflow_completed");
	assert.deepEqual(executed, ["task-a", "task-b"]);
	const bResult = result.results["task-b"];
	assert.ok(bResult && bResult.status === "task_completed");
	assert.equal(bResult.taskResultEvidenceId, "result-task-b");
});

test("workflow scheduler halts on missing model selection", async () => {
	const executed: string[] = [];
	const result = await executeFlowDeskWorkflowSchedulerV1({
		taskGraph: graph,
		modelSelections: [selection("task-a")], // Missing task-b
		parentSessionId: "ses-1",
		rootDir: "/tmp",
		client: {} as any,
		agentRef: "agent-1",
		runAgentTask: async (input) => {
			executed.push(input.taskId);
			return { status: "task_completed", taskResultEvidenceId: `result-${input.taskId}` } as FlowDeskAgentTaskResultV1;
		},
	});

	assert.equal(result.status, "workflow_incomplete");
	assert.deepEqual(executed, ["task-a"]); // A runs, B fails
	assert.match(result.redactedReason!, /missing selected model/);
});

test("workflow scheduler halts on task failure", async () => {
	const executed: string[] = [];
	const result = await executeFlowDeskWorkflowSchedulerV1({
		taskGraph: graph,
		modelSelections: [selection("task-a"), selection("task-b")],
		parentSessionId: "ses-1",
		rootDir: "/tmp",
		client: {} as any,
		agentRef: "agent-1",
		runAgentTask: async (input) => {
			executed.push(input.taskId);
			return { status: "task_failed", redactedReason: "test failure" } as FlowDeskAgentTaskResultV1;
		},
	});

	assert.equal(result.status, "workflow_incomplete");
	assert.deepEqual(executed, ["task-a"]); // A fails, B never runs
	assert.equal(result.redactedReason, "test failure");
});
