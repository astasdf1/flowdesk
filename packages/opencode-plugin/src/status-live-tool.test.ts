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

test("status live reports first planning evidence slice summaries", async () => {
	const rootDir = mkdtempSync(join(tmpdir(), "flowdesk-status-slice-"));
	try {
		const workflowId = "workflow-status-slice-1";
		const records = [
			{
				evidenceClass: "workflow_authoring_result" as const,
				evidenceId: "authoring-1",
				record: {
					schema_version: "flowdesk.workflow_authoring_result.v1",
					workflow_id: workflowId,
					authoring_result_id: "authoring-result-1",
					goal_summary: "Prepare a bounded documentation update",
					scope_summary: "Planning-only durable evidence records",
					output_summary: "Task graph and model selection summaries",
					risk_summary: "Malformed evidence could block reload",
					status: "authored",
					created_at: "2026-05-27T00:00:00.000Z",
					evidence_refs: ["task-graph-1"],
					release_gate: "release1_planning_only",
					dispatch_authority_enabled: false,
					provider_call_made: false,
					runtime_execution: false,
					actual_lane_launch: false,
					write_authority_enabled: false,
					redaction_version: "v1",
				},
			},
			{
				evidenceClass: "task_graph" as const,
				evidenceId: "graph-1",
				record: {
					schema_version: "flowdesk.task_graph.v1",
					workflow_id: workflowId,
					task_graph_id: "task-graph-1",
					nodes: [{ task_id: "task-docs-1", title: "Review docs", summary: "Summarize bounded documentation update" }],
					edges: [],
					graph_summary: "One documentation planning task",
					created_at: "2026-05-27T00:00:00.000Z",
					release_gate: "release1_planning_only",
					dispatch_authority_enabled: false,
					provider_call_made: false,
					runtime_execution: false,
					actual_lane_launch: false,
					write_authority_enabled: false,
					redaction_version: "v1",
				},
			},
			{
				evidenceClass: "task_agent_assignment" as const,
				evidenceId: "assignment-1",
				record: {
					schema_version: "flowdesk.task_agent_assignment.v1",
					workflow_id: workflowId,
					task_id: "task-docs-1",
					assignment_id: "assignment-docs-1",
					agent_role: "documentation",
					agent_role_ref: "agent-role-docs",
					selected_agent_ref: "agent-docs",
					selected_profile_ref: "profile-readonly",
					compatibility_status: "compatible",
					fit_label: "documentation planning fit",
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
				},
			},
			{
				evidenceClass: "task_model_selection" as const,
				evidenceId: "selection-1",
				record: {
					schema_version: "flowdesk.task_model_selection.v1",
					workflow_id: workflowId,
					task_id: "task-docs-1",
					selection_id: "selection-docs-1",
					provider_family: "gemini",
					provider_qualified_model_id: "gemini/gemini-pro-2.5",
					usage_snapshot_ref: "usage-snapshot-1",
					usage_snapshot_freshness: "fresh",
					provider_health_ref: "provider-health-1",
					provider_health_label: "ok",
					exact_model_availability_ref: "model-availability-1",
					exact_model_availability_label: "non_dispatchable",
					fit_label: "documentation planning fit",
					performance_label: "balanced",
					selection_status: "blocked",
					blocked_labels: ["non_dispatchable"],
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
				},
			},
		];
		for (const item of records) {
			const relativePath = sessionEvidenceRecordPath(workflowId, item.evidenceClass, item.evidenceId);
			const absolutePath = join(rootDir, relativePath);
			mkdirSync(join(absolutePath, ".."), { recursive: true });
			writeFileSync(absolutePath, JSON.stringify(item.record), "utf8");
		}

		const result = await executeFlowDeskStatusLiveV1({
			config: { rootDir },
			request: { workflowId },
			now: () => new Date("2026-05-27T00:00:00.000Z"),
		});

		assert.equal(result.status, "status_live_collected");
		const workflow = result.workflows[0];
		assert.equal(workflow.evidenceCounts.workflow_authoring_result, 1);
		assert.equal(workflow.evidenceCounts.task_graph, 1);
		assert.equal(workflow.evidenceCounts.task_agent_assignment, 1);
		assert.equal(workflow.evidenceCounts.task_model_selection, 1);
		assert.equal(workflow.latestWorkflowAuthoringStatus, "authored");
		assert.equal(workflow.latestTaskGraphTaskCount, 1);
		assert.equal(workflow.latestTaskAgentAssignmentCount, 1);
		assert.equal(workflow.latestTaskModelSelectionStatus, "blocked");
		assert.deepEqual(workflow.latestTaskModelSelectionBlockedLabels, ["non_dispatchable"]);
		assert.match(result.summaryForUser ?? "", /planning_slice=authored tasks=1 assignments=1 model=blocked/);
		assert.equal(result.authority.providerCall, false);
		assert.equal(result.authority.actualLaneLaunch, false);
	} finally {
		rmSync(rootDir, { recursive: true, force: true });
	}
});
