import type { FlowDeskTaskGraphV1, FlowDeskTaskModelSelectionV1 } from "@flowdesk/core";
import { executeFlowDeskAgentTaskV1, type FlowDeskAgentTaskInputV1, type FlowDeskAgentTaskResultV1 } from "./agent-task-runner.js";

export interface FlowDeskWorkflowSchedulerInputV1 {
	taskGraph: FlowDeskTaskGraphV1;
	modelSelections: FlowDeskTaskModelSelectionV1[];
	parentSessionId: string;
	rootDir: string;
	client: FlowDeskAgentTaskInputV1["client"];
	agentRef: string;
	runAgentTask?: (input: FlowDeskAgentTaskInputV1) => Promise<FlowDeskAgentTaskResultV1>;
}

export interface FlowDeskWorkflowSchedulerResultV1 {
	status: "workflow_completed" | "workflow_incomplete";
	executedTaskIds: string[];
	results: Record<string, FlowDeskAgentTaskResultV1>;
	redactedReason?: string;
}

export async function executeFlowDeskWorkflowSchedulerV1(
	input: FlowDeskWorkflowSchedulerInputV1,
): Promise<FlowDeskWorkflowSchedulerResultV1> {
	const run = input.runAgentTask ?? executeFlowDeskAgentTaskV1;
	const nodes = input.taskGraph.nodes;
	const selections = new Map(input.modelSelections.map((selection) => [selection.task_id, selection]));
	const deps = new Map<string, Set<string>>(nodes.map((node) => [node.task_id, new Set<string>()]));

	for (const edge of input.taskGraph.edges) {
		if (edge.relation === "depends_on") deps.get(edge.to_task_id)?.add(edge.from_task_id);
	}

	const done = new Set<string>();
	const executedTaskIds: string[] = [];
	const results: Record<string, FlowDeskAgentTaskResultV1> = {};

	while (done.size < nodes.length) {
		const next = nodes.find((node) => !done.has(node.task_id) && [...(deps.get(node.task_id) ?? [])].every((id) => done.has(id)));
		if (!next) return { status: "workflow_incomplete", executedTaskIds, results, redactedReason: "task graph dependency cycle or missing dependency" };

		const selection = selections.get(next.task_id);
		if (!selection || selection.selection_status !== "selected") {
			return { status: "workflow_incomplete", executedTaskIds, results, redactedReason: `missing selected model for ${next.task_id}` };
		}

		const result = await run({
			workflowId: input.taskGraph.workflow_id,
			taskId: next.task_id,
			laneId: `lane-${next.task_id}`,
			agentRef: input.agentRef,
			providerQualifiedModelId: selection.provider_qualified_model_id,
			promptText: `${next.title}\n\n${next.summary}`,
			parentSessionId: input.parentSessionId,
			rootDir: input.rootDir,
			client: input.client,
			outputContract: "final_assistant_text",
		});

		results[next.task_id] = result;
		executedTaskIds.push(next.task_id);
		if (result.status !== "task_completed") {
			const reason = result.status === "task_failed" ? result.redactedReason
				: result.status === "task_launched" ? `async lane launched: ${result.laneId}` : "unknown";
			return { status: "workflow_incomplete", executedTaskIds, results, redactedReason: reason };
		}
		done.add(next.task_id);
	}

	return { status: "workflow_completed", executedTaskIds, results };
}
