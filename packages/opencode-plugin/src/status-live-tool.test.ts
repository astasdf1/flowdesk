import assert from "node:assert/strict";
import { existsSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { sessionEvidenceRecordPath } from "@flowdesk/core";
import { executeFlowDeskStatusLiveV1 } from "./status-live-tool.js";

function writeEvidence(rootDir: string, workflowId: string, evidenceClass: string, evidenceId: string, record: Record<string, unknown>): void {
	const relativePath = sessionEvidenceRecordPath(workflowId, evidenceClass as never, evidenceId);
	const absolutePath = join(rootDir, relativePath);
	mkdirSync(join(absolutePath, ".."), { recursive: true });
	writeFileSync(absolutePath, JSON.stringify(record), "utf8");
}

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
		assert.deepEqual(result.authorityCapabilitySummary?.availableNow, ["display_only", "local_preview", "command_backed_guarded"]);
		assert.deepEqual(result.authorityCapabilitySummary?.laterGated, ["managed_dispatch", "managed_fallback", "tui_actions", "hard_chat_control"]);
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

test("status live does not show progress observed after terminal lifecycle", async () => {
	const rootDir = mkdtempSync(join(tmpdir(), "flowdesk-status-terminal-progress-"));
	try {
		const workflowId = "workflow-status-terminal-progress";
		const laneId = "lane-status-terminal-progress";
		writeEvidence(rootDir, workflowId, "agent_task_context", "agent-task-context-terminal-progress", {
			schema_version: "flowdesk.agent_task_context.v1",
			workflow_id: workflowId,
			lane_id: laneId,
			task_id: "task-status-terminal-progress",
			agent_ref: "agent-reviewer-gpt-frontier",
			provider_qualified_model_id: "openai/gpt-5.5",
			parent_session_ref: "ses-parent",
			prompt_text: "Inspect status projection ordering",
			prompt_text_truncated: false,
			prompt_text_sha256: "sha256-test",
			redaction_version: "v1",
			created_at: "2026-05-27T00:00:00.000Z",
			dispatch_authority_enabled: false,
		});
		writeEvidence(rootDir, workflowId, "lane_lifecycle", "lifecycle-terminal-progress", {
			schema_version: "flowdesk.lane_lifecycle_record.v1",
			workflow_id: workflowId,
			lane_id: laneId,
			attempt_id: "attempt-terminal-progress",
			parent_session_ref: "ses-parent",
			agent_ref: "agent-reviewer-gpt-frontier",
			provider_qualified_model_id: "openai/gpt-5.5",
			state: "invocation_failed",
			timeout_ms: 0,
			orphan_max_age_ms: 0,
			retry_count: 0,
			created_at: "2026-05-27T00:00:00.000Z",
			updated_at: "2026-05-27T00:01:00.000Z",
			dispatch_authority_enabled: false,
			providerCall: false,
			actualLaneLaunch: false,
			runtimeExecution: false,
		});
		writeEvidence(rootDir, workflowId, "agent_task_progress", "agent-task-progress-late-after-terminal", {
			schema_version: "flowdesk.agent_task_progress.v1",
			workflow_id: workflowId,
			lane_id: laneId,
			task_id: "task-status-terminal-progress",
			agent_ref: "agent-reviewer-gpt-frontier",
			provider_qualified_model_id: "openai/gpt-5.5",
			progress_seq: 99,
			observed_at: "2026-05-27T00:02:00.000Z",
			phase: "waiting",
			progress_label: "agent task message.updated event observed",
			progress_ref: `progress-${laneId}-99`,
			redaction_version: "v1",
			dispatch_authority_enabled: false,
		});

		const result = await executeFlowDeskStatusLiveV1({
			config: { rootDir },
			request: { workflowId },
			now: () => new Date("2026-05-27T00:03:00.000Z"),
		});

		const card = result.workflows[0].laneProgressCards?.[0] as Record<string, unknown> | undefined;
		assert.equal(card?.state, "invocation_failed");
		assert.equal(card?.progressObservedAt, undefined);
		assert.equal(card?.progressLabel, undefined);
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

test("status live materializes finalizing-without-terminal inconsistency idempotently", async () => {
	const rootDir = mkdtempSync(join(tmpdir(), "flowdesk-status-inconsistent-"));
	try {
		const workflowId = "workflow-status-inconsistent-1";
		const laneId = "lane-task-inconsistent-1";
		const records = [
			{
				evidenceClass: "lane_lifecycle" as const,
				evidenceId: "lifecycle-running-inconsistent-1",
				record: {
					schema_version: "flowdesk.lane_lifecycle_record.v1",
					lane_id: laneId,
					workflow_id: workflowId,
					attempt_id: "attempt-task-inconsistent-1",
					parent_session_ref: "ses-status-parent-1",
					agent_ref: "agent-reviewer-gpt-frontier",
					provider_qualified_model_id: "openai/gpt-5.5",
					state: "running",
					timeout_ms: 60_000,
					orphan_max_age_ms: 600_000,
					retry_count: 0,
					created_at: "2026-05-27T00:00:00.000Z",
					updated_at: "2026-05-27T00:00:30.000Z",
					dispatch_authority_enabled: false,
					providerCall: false,
					actualLaneLaunch: false,
					runtimeExecution: false,
				},
			},
			{
				evidenceClass: "agent_task_progress" as const,
				evidenceId: "agent-task-progress-inconsistent-3",
				record: {
					schema_version: "flowdesk.agent_task_progress.v1",
					workflow_id: workflowId,
					lane_id: laneId,
					task_id: "task-inconsistent-1",
					agent_ref: "agent-reviewer-gpt-frontier",
					provider_qualified_model_id: "openai/gpt-5.5",
					progress_seq: 3,
					observed_at: "2026-05-27T00:01:00.000Z",
					phase: "finalizing",
					progress_label: "async agent task result captured by watchdog",
					progress_ref: "progress-lane-task-inconsistent-1-3",
					redaction_version: "v1",
					dispatch_authority_enabled: false,
				},
			},
		];
		for (const item of records) {
			const relativePath = sessionEvidenceRecordPath(workflowId, item.evidenceClass, item.evidenceId);
			const absolutePath = join(rootDir, relativePath);
			mkdirSync(join(absolutePath, ".."), { recursive: true });
			writeFileSync(absolutePath, JSON.stringify(item.record), "utf8");
		}

		const first = await executeFlowDeskStatusLiveV1({
			config: { rootDir, agentTaskFinalizingInconsistencyGraceMs: 90_000 },
			request: { workflowId },
			now: () => new Date("2026-05-27T00:03:00.000Z"),
		});
		assert.equal(first.status, "status_live_collected");
		assert.equal(first.workflows[0].evidenceCounts.agent_task_inconsistency, 1);
		assert.equal(first.workflows[0].worstLaneStallClassification, "inconsistent_finalizing_without_terminal");
		assert.equal(first.totalInconsistentFinalizingWithoutTerminalLaneCount, 1);
		assert.match(first.summaryForUser ?? "", /finalizing-without-terminal inconsistent/);
		assert.equal(first.authority.actualLaneLaunch, false);

		const second = await executeFlowDeskStatusLiveV1({
			config: { rootDir, agentTaskFinalizingInconsistencyGraceMs: 90_000 },
			request: { workflowId },
			now: () => new Date("2026-05-27T00:04:00.000Z"),
		});
		assert.equal(second.workflows[0].evidenceCounts.agent_task_inconsistency, 1);
	} finally {
		rmSync(rootDir, { recursive: true, force: true });
	}
});

test("status live does not materialize inconsistency when finalizing has task_result", async () => {
	const rootDir = mkdtempSync(join(tmpdir(), "flowdesk-status-finalizing-result-"));
	try {
		const workflowId = "workflow-status-finalizing-result-1";
		const laneId = "lane-task-finalizing-result-1";
		writeStatusRecord(rootDir, workflowId, "lane_lifecycle", "lifecycle-running-finalizing-result-1", runningLifecycle(workflowId, laneId, "attempt-finalizing-result-1"));
		writeStatusRecord(rootDir, workflowId, "agent_task_progress", "agent-task-progress-finalizing-result-3", finalizingProgress(workflowId, laneId, "task-finalizing-result-1", 3));
		writeStatusRecord(rootDir, workflowId, "agent_task_inconsistency", "agent-task-inconsistency-finalizing-result-legacy", {
			schema_version: "flowdesk.agent_task_inconsistency.v1",
			workflow_id: workflowId,
			attempt_id: "attempt-finalizing-result-1",
			lane_id: laneId,
			task_id: "task-finalizing-result-1",
			last_progress_seq: 3,
			last_progress_observed_at: "2026-05-27T00:01:30.000Z",
			inconsistency_kind: "finalizing_without_terminal",
			grace_window_ms: 90_000,
			grace_source_label: "test_legacy_inconsistency",
			observed_at: "2026-05-27T00:02:00.000Z",
			safe_next_actions: ["/flowdesk-status"],
			redaction_version: "v1",
			dispatch_authority_enabled: false,
		});
		writeStatusRecord(rootDir, workflowId, "task_result", "task-result-finalizing-result-1", {
			schema_version: "flowdesk.task_result.v1",
			workflow_id: workflowId,
			lane_id: laneId,
			task_id: "task-finalizing-result-1",
			agent_ref: "agent-reviewer-gpt-frontier",
			provider_qualified_model_id: "openai/gpt-5.5",
			task_prompt_sha256: "a".repeat(64),
			result_text: "done",
			result_text_truncated: false,
			result_text_sha256: "b".repeat(64),
			completion_status: "partial",
			output_kind: "process_notes",
			usable_for_synthesis: true,
			created_at: "2026-05-27T00:01:30.000Z",
			dispatch_authority_enabled: false,
		});

		const result = await executeFlowDeskStatusLiveV1({
			config: { rootDir, agentTaskFinalizingInconsistencyGraceMs: 90_000 },
			request: { workflowId },
			now: () => new Date("2026-05-27T00:03:00.000Z"),
		});
		assert.equal(result.workflows[0].evidenceCounts.agent_task_inconsistency, 1);
		assert.equal(result.totalInconsistentFinalizingWithoutTerminalLaneCount, 0);
		assert.equal(result.totalStalledLaneCount, 0);
		assert.equal(result.workflows[0].laneProgressCards?.[0]?.state, "task_result");
		assert.equal(result.workflows[0].laneProgressCards?.[0]?.completionStatus, "partial");
		assert.equal(result.workflows[0].laneProgressCards?.[0]?.outputKind, "process_notes");
		assert.equal(result.workflows[0].laneProgressCards?.[0]?.usableForSynthesis, true);
		assert.equal(result.workflows[0].laneProgressCards?.[0]?.classification, "terminal");
		assert.equal(result.workflows[0].subtaskActivityRows?.length, 1);
		assert.equal(result.workflows[0].subtaskActivityRows?.[0]?.laneId, laneId);
		assert.equal(result.workflows[0].subtaskActivityRows?.[0]?.taskId, "task-finalizing-result-1");
		assert.equal(result.workflows[0].subtaskActivityRows?.[0]?.state, "task_result");
		assert.equal(result.workflows[0].subtaskActivityRows?.[0]?.classification, "terminal");
		assert.equal(result.workflows[0].subtaskActivityRows?.[0]?.progressPhase, "finalizing");
		assert.equal(result.workflows[0].subtaskActivityRows?.[0]?.completionStatus, "partial");
		assert.equal(result.workflows[0].subtaskActivityRows?.[0]?.outputKind, "process_notes");
		assert.equal(result.workflows[0].subtaskActivityRows?.[0]?.usableForSynthesis, true);
		assert.deepEqual(result.workflows[0].subtaskActivityRows?.[0]?.recoveryActionRefs, ["/flowdesk-status", "/flowdesk-export-debug"]);
		assert.equal(result.workflows[0].subtaskActivityRows?.[0]?.statusCommandRef, "/flowdesk-status");
		assert.equal(result.workflows[0].subtaskActivityRows?.[0]?.debugCommandRef, "/flowdesk-export-debug");
		assert.doesNotMatch(result.summaryForUser ?? "", /, lanes=/);
		assert.match(result.summaryForUser ?? "", /subtasks=lane-task-finalizing-result-1:task_result\/terminal\[status\|export-debug\]/);
		assert.equal(
			existsSync(join(rootDir, ".flowdesk", "ui", "subtask-activity-sidebar.json")),
			false,
			"status-live must not refresh TUI caches; completion paths own no-status cache updates",
		);
		assert.equal(result.workflows[0].laneProgressAggregate?.expected, 1);
		assert.equal(result.workflows[0].laneProgressAggregate?.normalCompleted, 0);
		assert.equal(result.workflows[0].laneProgressAggregate?.autoNextStepEligible, false);
	} finally {
		rmSync(rootDir, { recursive: true, force: true });
	}
});

test("status live does not materialize inconsistency when finalizing has task_failed", async () => {
	const rootDir = mkdtempSync(join(tmpdir(), "flowdesk-status-finalizing-failed-"));
	try {
		const workflowId = "workflow-status-finalizing-failed-1";
		const laneId = "lane-task-finalizing-failed-1";
		writeStatusRecord(rootDir, workflowId, "lane_lifecycle", "lifecycle-running-finalizing-failed-1", runningLifecycle(workflowId, laneId, "attempt-finalizing-failed-1"));
		writeStatusRecord(rootDir, workflowId, "agent_task_progress", "agent-task-progress-finalizing-failed-3", finalizingProgress(workflowId, laneId, "task-finalizing-failed-1", 3));
		writeStatusRecord(rootDir, workflowId, "task_failed", "task-failed-finalizing-failed-1", {
			schema_version: "flowdesk.task_failed.v1",
			workflow_id: workflowId,
			lane_id: laneId,
			task_id: "task-finalizing-failed-1",
			agent_ref: "agent-reviewer-gpt-frontier",
			provider_qualified_model_id: "openai/gpt-5.5",
			failure_category: "unknown",
			redacted_reason: "watchdog could not persist task_result evidence",
			created_at: "2026-05-27T00:01:30.000Z",
			dispatch_authority_enabled: false,
		});

		const result = await executeFlowDeskStatusLiveV1({
			config: { rootDir, agentTaskFinalizingInconsistencyGraceMs: 90_000 },
			request: { workflowId },
			now: () => new Date("2026-05-27T00:03:00.000Z"),
		});
		assert.equal(result.workflows[0].evidenceCounts.agent_task_inconsistency, undefined);
		assert.equal(result.totalInconsistentFinalizingWithoutTerminalLaneCount, 0);
		assert.equal(result.totalStalledLaneCount, 0);
		assert.equal(result.workflows[0].laneProgressCards?.[0]?.state, "invocation_failed");
		assert.deepEqual(result.workflows[0].subtaskActivityRows?.[0]?.recoveryActionRefs, [
			"/flowdesk-status",
			"/flowdesk-retry",
			"/flowdesk-resume",
			"/flowdesk-abort",
			"/flowdesk-export-debug",
		]);
		assert.doesNotMatch(result.summaryForUser ?? "", /, lanes=/);
		assert.match(result.summaryForUser ?? "", /subtasks=lane-task-finalizing-failed-1:invocation_failed\/terminal\[status\|retry\|resume\|abort\|export-debug\]/);
	} finally {
		rmSync(rootDir, { recursive: true, force: true });
	}
});

test("status live reports auto-next readiness without materializing TUI cache", async () => {
	const rootDir = mkdtempSync(join(tmpdir(), "flowdesk-status-auto-next-"));
	try {
		const workflowId = "workflow-status-auto-next-1";
		const laneId = "lane-task-auto-next-1";
		writeStatusRecord(rootDir, workflowId, "lane_lifecycle", "lifecycle-running-auto-next-1", runningLifecycle(workflowId, laneId, "attempt-auto-next-1"));
		writeStatusRecord(rootDir, workflowId, "task_result", "task-result-auto-next-1", {
			schema_version: "flowdesk.task_result.v1",
			workflow_id: workflowId,
			lane_id: laneId,
			task_id: "task-auto-next-1",
			agent_ref: "agent-reviewer-gpt-frontier",
			provider_qualified_model_id: "openai/gpt-5.5",
			task_prompt_sha256: "a".repeat(64),
			result_text: "done",
			result_text_truncated: false,
			result_text_sha256: "b".repeat(64),
			completion_status: "final",
			output_kind: "final_answer",
			usable_for_synthesis: true,
			created_at: "2026-05-27T00:01:30.000Z",
			dispatch_authority_enabled: false,
		});

		const result = await executeFlowDeskStatusLiveV1({
			config: { rootDir, agentTaskFinalizingInconsistencyGraceMs: 90_000 },
			request: { workflowId },
			now: () => new Date("2026-05-27T00:03:00.000Z"),
		});
		assert.equal(result.workflows[0].laneProgressAggregate?.autoNextStepEligible, true);
		assert.equal(result.workflows[0].laneProgressAggregate?.nextActionAvailable, true);
		assert.equal(result.workflows[0].laneProgressAggregate?.nextActionKind, "synthesis");
		assert.deepEqual(result.workflows[0].laneProgressAggregate?.nextActionRefs, ["/flowdesk-status", "/flowdesk-export-debug"]);
		assert.equal(result.workflows[0].latestLaneLifecycleStates.includes("running"), false);
		assert.match(result.summaryForUser ?? "", /auto_next=ready/);
		assert.match(result.summaryForUser ?? "", /next_action=synthesis_ready/);
		assert.doesNotMatch(result.summaryForUser ?? "", /lifecycle=running/);
		assert.doesNotMatch(result.summaryForUser ?? "", /lifecycle=incomplete/);
		assert.match(result.summaryForUser ?? "", /lane_state=task_result\/terminal/);
		assert.doesNotMatch(result.summaryForUser ?? "", /, lanes=/);
		assert.equal(
			existsSync(join(rootDir, ".flowdesk", "ui", "auto-next-ready.json")),
			false,
			"status-live must not refresh TUI caches; completion paths own no-status cache updates",
		);

		const second = await executeFlowDeskStatusLiveV1({
			config: { rootDir, agentTaskFinalizingInconsistencyGraceMs: 90_000 },
			request: { workflowId },
			now: () => new Date("2026-05-27T00:03:10.000Z"),
		});
		assert.equal(second.workflows[0].laneProgressAggregate?.autoNextStepEligible, true);
		assert.equal(second.workflows[0].evidenceCounts.workflow_synthesis_result, undefined);
	} finally {
		rmSync(rootDir, { recursive: true, force: true });
	}
});

test("status live suppresses synthesis-ready next action after synthesis evidence exists", async () => {
	const rootDir = mkdtempSync(join(tmpdir(), "flowdesk-status-synthesis-done-"));
	try {
		const workflowId = "workflow-status-synthesis-done-1";
		const laneId = "lane-task-synthesis-done-1";
		writeStatusRecord(rootDir, workflowId, "lane_lifecycle", "lifecycle-running-synthesis-done-1", runningLifecycle(workflowId, laneId, "attempt-synthesis-done-1"));
		writeStatusRecord(rootDir, workflowId, "task_result", "task-result-synthesis-done-1", {
			schema_version: "flowdesk.task_result.v1",
			workflow_id: workflowId,
			lane_id: laneId,
			task_id: "task-synthesis-done-1",
			agent_ref: "agent-reviewer-gpt-frontier",
			provider_qualified_model_id: "openai/gpt-5.5",
			task_prompt_sha256: "a".repeat(64),
			result_text: "done",
			result_text_truncated: false,
			result_text_sha256: "b".repeat(64),
			completion_status: "final",
			output_kind: "final_answer",
			usable_for_synthesis: true,
			created_at: "2026-05-27T00:01:30.000Z",
			dispatch_authority_enabled: false,
		});
		writeStatusRecord(rootDir, workflowId, "workflow_synthesis_result", "synthesis-done-1", {
			schema_version: "flowdesk.workflow_synthesis_result.v1",
			workflow_id: workflowId,
			synthesis_id: "synthesis-done-1",
			tasks_summarized: 1,
			task_refs: ["task-synthesis-done-1"],
			conflict_detected: true,
			synthesis_summary: "Synthesis already recorded.",
			safe_next_actions: ["/flowdesk-status", "/flowdesk-export-debug"],
		});

		const result = await executeFlowDeskStatusLiveV1({
			config: { rootDir, agentTaskFinalizingInconsistencyGraceMs: 90_000 },
			request: { workflowId },
			now: () => new Date("2026-05-27T00:03:00.000Z"),
		});
		assert.equal(result.workflows[0].latestWorkflowSynthesisId, "synthesis-done-1");
		assert.equal(result.workflows[0].latestWorkflowSynthesisTasksSummarized, 1);
		assert.equal(result.workflows[0].laneProgressAggregate?.autoNextStepEligible, false);
		assert.equal(result.workflows[0].laneProgressAggregate?.nextActionAvailable, false);
		assert.equal(result.workflows[0].latestWorkflowSynthesisSummaryPreview, "Synthesis already recorded.");
		assert.equal(result.workflows[0].latestLaneLifecycleStates.includes("running"), false);
		assert.doesNotMatch(result.summaryForUser ?? "", /lifecycle=running/);
		assert.doesNotMatch(result.summaryForUser ?? "", /lifecycle=incomplete/);
		assert.match(result.summaryForUser ?? "", /lane_state=task_result\/terminal/);
		assert.doesNotMatch(result.summaryForUser ?? "", /, lanes=/);
		assert.doesNotMatch(result.summaryForUser ?? "", /next_action=synthesis_ready/);
		assert.equal(result.workflows[0].latestWorkflowSynthesisConflictDetected, true);
		assert.match(result.summaryForUser ?? "", /synthesis=1 tasks conflict=detected/);
		assert.match(result.summaryForUser ?? "", /preview="Synthesis already recorded\."/);
		assert.doesNotMatch(result.summaryForUser ?? "", /workflow_plan=\(none\)/);
	} finally {
		rmSync(rootDir, { recursive: true, force: true });
	}
});

test("status live reports effective nudge count and last activity from progress", async () => {
	const rootDir = mkdtempSync(join(tmpdir(), "flowdesk-status-nudge-effective-"));
	try {
		const workflowId = "workflow-status-nudge-1";
		const laneId = "lane-status-nudge-1";
		writeStatusRecord(rootDir, workflowId, "lane_lifecycle", "lifecycle-status-nudge-1", runningLifecycle(workflowId, laneId, "attempt-status-nudge-1"));
		writeStatusRecord(rootDir, workflowId, "agent_task_child_session", "agent-task-child-session-status-nudge-1", {
			schema_version: "flowdesk.agent_task_child_session.v1",
			workflow_id: workflowId,
			lane_id: laneId,
			task_id: "task-status-nudge-1",
			child_session_id: "child-status-nudge-1",
			parent_session_ref: "ses-status-parent-1",
			provider_qualified_model_id: "openai/gpt-5.5",
			agent_ref: "agent-reviewer-gpt-frontier",
			nudge_count: 2,
			last_nudge_at: "2026-05-27T00:00:40.000Z",
			nudge_quiet_period_ms: 45_000,
			last_activity_at: "2026-05-27T00:00:40.000Z",
			created_at: "2026-05-27T00:00:00.000Z",
			dispatch_authority_enabled: false,
		});
		writeStatusRecord(rootDir, workflowId, "agent_task_progress", "agent-task-progress-status-nudge-waiting", {
			schema_version: "flowdesk.agent_task_progress.v1",
			workflow_id: workflowId,
			lane_id: laneId,
			task_id: "task-status-nudge-1",
			agent_ref: "agent-reviewer-gpt-frontier",
			provider_qualified_model_id: "openai/gpt-5.5",
			progress_seq: 4,
			observed_at: "2026-05-27T00:00:55.000Z",
			phase: "waiting",
			progress_label: "agent task message.updated event observed",
			progress_ref: "progress-lane-status-nudge-1-4",
			redaction_version: "v1",
			dispatch_authority_enabled: false,
		});

		const result = await executeFlowDeskStatusLiveV1({
			config: { rootDir },
			request: { workflowId },
			now: () => new Date("2026-05-27T00:01:00.000Z"),
		});

		const card = result.workflows[0].laneProgressCards?.[0];
		assert.equal(card?.nudgeCount, 0);
		assert.equal(card?.rawNudgeCount, 2);
		assert.equal(card?.lastNudgeAt, "2026-05-27T00:00:40.000Z");
		assert.equal(card?.lastActivityAt, "2026-05-27T00:00:55.000Z");
		assert.equal(card?.nudgeQuietPeriodMs, 45_000);
		const row = result.workflows[0].subtaskActivityRows?.[0];
		assert.equal(row?.nudgeCount, 0);
		assert.equal(row?.rawNudgeCount, 2);
		assert.equal(row?.lastActivityAt, "2026-05-27T00:00:55.000Z");
	} finally {
		rmSync(rootDir, { recursive: true, force: true });
	}
});

function writeStatusRecord(
	rootDir: string,
	workflowId: string,
	evidenceClass: Parameters<typeof sessionEvidenceRecordPath>[1],
	evidenceId: string,
	record: Record<string, unknown>,
): void {
	const relativePath = sessionEvidenceRecordPath(workflowId, evidenceClass, evidenceId);
	const absolutePath = join(rootDir, relativePath);
	mkdirSync(join(absolutePath, ".."), { recursive: true });
	writeFileSync(absolutePath, JSON.stringify(record), "utf8");
}

function runningLifecycle(workflowId: string, laneId: string, attemptId: string): Record<string, unknown> {
	return {
		schema_version: "flowdesk.lane_lifecycle_record.v1",
		lane_id: laneId,
		workflow_id: workflowId,
		attempt_id: attemptId,
		parent_session_ref: "ses-status-parent-1",
		agent_ref: "agent-reviewer-gpt-frontier",
		provider_qualified_model_id: "openai/gpt-5.5",
		state: "running",
		timeout_ms: 60_000,
		orphan_max_age_ms: 600_000,
		retry_count: 0,
		created_at: "2026-05-27T00:00:00.000Z",
		updated_at: "2026-05-27T00:00:30.000Z",
		dispatch_authority_enabled: false,
		providerCall: false,
		actualLaneLaunch: false,
		runtimeExecution: false,
	};
}

function finalizingProgress(workflowId: string, laneId: string, taskId: string, seq: number): Record<string, unknown> {
	return {
		schema_version: "flowdesk.agent_task_progress.v1",
		workflow_id: workflowId,
		lane_id: laneId,
		task_id: taskId,
		agent_ref: "agent-reviewer-gpt-frontier",
		provider_qualified_model_id: "openai/gpt-5.5",
		progress_seq: seq,
		observed_at: "2026-05-27T00:01:00.000Z",
		phase: "finalizing",
		progress_label: "async agent task result captured by watchdog",
		progress_ref: `progress-${laneId}-${seq}`,
		redaction_version: "v1",
		dispatch_authority_enabled: false,
	};
}
