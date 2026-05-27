import assert from "node:assert/strict";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { sessionEvidenceRecordPath } from "@flowdesk/core";
import { executeFlowDeskStatusLiveV1 } from "./status-live-tool.js";

test("status live reports durable workflow dispatch planning evidence", async () => {
	const rootDir = mkdtempSync(join(tmpdir(), "flowdesk-status-plan-"));
	try {
		const workflowId = "workflow-status-plan-1";
		const relativePath = sessionEvidenceRecordPath(
			workflowId,
			"workflow_dispatch_plan",
			"workflow-plan-1",
		);
		const absolutePath = join(rootDir, relativePath);
		mkdirSync(join(absolutePath, ".."), { recursive: true });
		writeFileSync(
			absolutePath,
			JSON.stringify({
				schema_version: "flowdesk.workflow_dispatch_plan.v1",
				workflow_id: workflowId,
				plan_revision_id: "plan-revision-status-1",
				requested_goal_summary: "Prepare a bounded documentation update",
				selected_agent_roles: [
					{ agent_role: "documentation", agent_role_ref: "agent-docs" },
				],
				tasks: [
					{
						task_id: "task-docs-1",
						title: "Review documentation notes",
						summary:
							"Summarize the bounded documentation change needed for the release note",
						agent_role: "documentation",
						agent_role_ref: "agent-docs",
					},
				],
				task_graph_summary: "One documentation task with no dependencies",
				model_selection_diagnostics: {
					diagnostic_refs: ["diagnostic-plan-1"],
					diagnostic_labels: ["planning_only"],
					scoring_authority_enabled: false,
					fallback_or_reselection_allowed: false,
				},
				release_gate: "release1_planning_only",
				dispatch_authority_enabled: false,
				provider_call_made: false,
				runtime_execution: false,
				actual_lane_launch: false,
				redaction_version: "v1",
			}),
			"utf8",
		);

		const result = await executeFlowDeskStatusLiveV1({
			config: { rootDir },
			request: { workflowId },
			now: () => new Date("2026-05-27T00:00:00.000Z"),
		});

		assert.equal(result.status, "status_live_collected");
		assert.equal(result.authority.realOpenCodeDispatch, false);
		assert.equal(result.authority.providerCall, false);
		assert.equal(result.authority.runtimeExecution, false);
		assert.equal(result.authority.actualLaneLaunch, false);
		assert.equal(result.workflows[0].evidenceCounts.workflow_dispatch_plan, 1);
		assert.equal(
			result.workflows[0].latestWorkflowDispatchPlanRevisionId,
			"plan-revision-status-1",
		);
		assert.equal(result.workflows[0].latestWorkflowDispatchPlanTaskCount, 1);
		assert.match(result.summaryForUser ?? "", /workflow_plan=plan-revision-status-1 tasks=1/);
	} finally {
		rmSync(rootDir, { recursive: true, force: true });
	}
});
