import assert from "node:assert/strict";
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { sessionEvidenceRecordPath } from "@flowdesk/core";
import { refreshFlowDeskCompletionUiCachesV1 } from "./completion-ui-cache.js";

test("completion UI cache derives useful task summaries from generic prompts", () => {
	const rootDir = mkdtempSync(join(tmpdir(), "flowdesk-completion-labels-"));
	try {
		const workflowId = "workflow-labels-1";
		const laneId = "lane-task-labels-1";
		writeEvidence(rootDir, workflowId, "agent_task_context", "context-labels-1", {
			schema_version: "flowdesk.agent_task_context.v1",
			workflow_id: workflowId,
			lane_id: laneId,
			task_id: "task-labels-1",
			agent_ref: "agent-reviewer-gpt-frontier",
			provider_qualified_model_id: "openai/gpt-5.5",
			parent_session_ref: "ses-parent-labels-1",
			prompt_text: "Architecture planning subtask for FlowDesk repo: TUI Next ready labels should be useful.",
			prompt_text_truncated: false,
			prompt_text_sha256: "a".repeat(64),
			redaction_version: "v1",
			created_at: "2026-05-29T00:00:00.000Z",
			dispatch_authority_enabled: false,
		});
		writeEvidence(rootDir, workflowId, "task_result", "task-result-labels-1", taskResult(workflowId, laneId, "task-labels-1"));

		refreshFlowDeskCompletionUiCachesV1({ rootDir, workflowId, observedAt: "2026-05-29T00:01:00.000Z" });

		const sidebar = JSON.parse(readFileSync(join(rootDir, ".flowdesk", "ui", "subtask-activity-sidebar.json"), "utf8")) as Record<string, unknown>;
		const rows = sidebar.rows as Array<Record<string, unknown>>;
		assert.equal(rows[0].taskSummary, "TUI Next ready labels");
		assert.equal(rows[0].parentSessionRef, "ses-parent-labels-1");
		const ready = JSON.parse(readFileSync(join(rootDir, ".flowdesk", "ui", "auto-next-ready.json"), "utf8")) as Record<string, unknown>;
		const workflows = ready.workflows as Array<Record<string, unknown>>;
		assert.deepEqual(workflows[0].taskSummaries, ["TUI Next ready labels"]);
		assert.equal(workflows[0].parentSessionRef, "ses-parent-labels-1");
	} finally {
		rmSync(rootDir, { recursive: true, force: true });
	}
});

test("completion UI cache keeps useful summary when prompt mentions dispatch_authority_enabled", () => {
	const rootDir = mkdtempSync(join(tmpdir(), "flowdesk-completion-dispatch-field-label-"));
	try {
		const workflowId = "workflow-labels-dispatch-field-1";
		const laneId = "lane-task-labels-dispatch-field-1";
		writeEvidence(rootDir, workflowId, "agent_task_context", "context-labels-dispatch-field-1", {
			schema_version: "flowdesk.agent_task_context.v1",
			workflow_id: workflowId,
			lane_id: laneId,
			task_id: "task-labels-dispatch-field-1",
			agent_ref: "agent-reviewer-gpt-frontier",
			provider_qualified_model_id: "openai/gpt-5.5",
			parent_session_ref: "ses-parent-labels-dispatch-field-1",
			prompt_text: "Fix sidebar label handling for dispatch_authority_enabled evidence rows.",
			prompt_text_truncated: false,
			prompt_text_sha256: "a".repeat(64),
			redaction_version: "v1",
			created_at: "2026-05-29T00:00:00.000Z",
			dispatch_authority_enabled: false,
		});
		writeEvidence(rootDir, workflowId, "task_result", "task-result-labels-dispatch-field-1", taskResult(workflowId, laneId, "task-labels-dispatch-field-1"));

		refreshFlowDeskCompletionUiCachesV1({ rootDir, workflowId, observedAt: "2026-05-29T00:01:00.000Z" });

		const sidebar = readCache(rootDir, "subtask-activity-sidebar.json");
		const rows = sidebar.rows as Array<Record<string, unknown>>;
		assert.equal(rows[0].taskSummary, "Fix sidebar label handlin");
		assert.notEqual(rows[0].taskSummary, undefined);
	} finally {
		rmSync(rootDir, { recursive: true, force: true });
	}
});

test("completion UI cache task summaries use at most five words", () => {
	const rootDir = mkdtempSync(join(tmpdir(), "flowdesk-completion-five-word-label-"));
	try {
		const workflowId = "workflow-labels-five-words-1";
		const laneId = "lane-task-labels-five-words-1";
		writeEvidence(rootDir, workflowId, "agent_task_context", "context-labels-five-words-1", {
			schema_version: "flowdesk.agent_task_context.v1",
			workflow_id: workflowId,
			lane_id: laneId,
			task_id: "task-labels-five-words-1",
			agent_ref: "agent-reviewer-gpt-frontier",
			provider_qualified_model_id: "openai/gpt-5.5",
			parent_session_ref: "ses-parent-labels-five-words-1",
			prompt_text: "Alpha beta gamma delta epsilon zeta eta theta.",
			prompt_text_truncated: false,
			prompt_text_sha256: "a".repeat(64),
			redaction_version: "v1",
			created_at: "2026-05-29T00:00:00.000Z",
			dispatch_authority_enabled: false,
		});
		writeEvidence(rootDir, workflowId, "task_result", "task-result-labels-five-words-1", taskResult(workflowId, laneId, "task-labels-five-words-1"));

		refreshFlowDeskCompletionUiCachesV1({ rootDir, workflowId, observedAt: "2026-05-29T00:01:00.000Z" });

		const sidebar = readCache(rootDir, "subtask-activity-sidebar.json");
		const rows = sidebar.rows as Array<Record<string, unknown>>;
		assert.equal(rows[0].taskSummary, "Alpha beta gamma delta ep");
		assert.ok(String(rows[0].taskSummary).split(/\s+/).length <= 5);
	} finally {
		rmSync(rootDir, { recursive: true, force: true });
	}
});

test("completion UI cache running async lane (child-session only, no context) still carries parentSessionRef for session scoping", () => {
	// Regression: in async mode a RUNNING lane has an agent_task_child_session
	// record (carrying parent_session_ref) and only a RUNNING lane_lifecycle, but
	// NO agent_task_context yet. Before the fix the row's parentSessionRef was
	// derived only from context/terminal-lifecycle, so it was undefined and the
	// session-scoped TUI sidebar filtered the running subtask out — it only became
	// visible after the lane terminated. The row must carry parentSessionRef now.
	const rootDir = mkdtempSync(join(tmpdir(), "flowdesk-completion-running-parent-"));
	try {
		const workflowId = "workflow-running-parent-1";
		const laneId = "lane-task-running-parent-1";
		writeEvidence(rootDir, workflowId, "agent_task_child_session", "child-running-parent-1", {
			schema_version: "flowdesk.agent_task_child_session.v1",
			workflow_id: workflowId,
			lane_id: laneId,
			task_id: "task-running-parent-1",
			child_session_id: "ses-child-running-parent-1",
			parent_session_ref: "ses-ses_running_parent_1",
			provider_qualified_model_id: "openai/gpt-5.5",
			agent_ref: "agent-flowdesk-verifier-testing",
			nudge_count: 0,
			last_nudge_at: null,
			created_at: "2026-05-29T00:00:00.000Z",
			dispatch_authority_enabled: false,
		});
		writeEvidence(rootDir, workflowId, "lane_lifecycle", "lifecycle-running-parent-1", {
			schema_version: "flowdesk.lane_lifecycle_record.v1",
			lane_id: laneId,
			workflow_id: workflowId,
			attempt_id: "attempt-running-parent-1",
			parent_session_ref: "ses-ses_running_parent_1",
			agent_ref: "agent-flowdesk-verifier-testing",
			provider_qualified_model_id: "openai/gpt-5.5",
			state: "running",
			timeout_ms: 60_000,
			orphan_max_age_ms: 600_000,
			retry_count: 0,
			created_at: "2026-05-29T00:00:00.000Z",
			updated_at: "2026-05-29T00:00:00.000Z",
			spawned_by: "flowdesk",
			durability: "best_effort_no_dir_fsync",
			dispatch_authority_enabled: false,
			providerCall: false,
			actualLaneLaunch: false,
			runtimeExecution: false,
		});

		refreshFlowDeskCompletionUiCachesV1({ rootDir, workflowId, observedAt: "2026-05-29T00:00:30.000Z" });

		const sidebar = JSON.parse(readFileSync(join(rootDir, ".flowdesk", "ui", "subtask-activity-sidebar.json"), "utf8")) as Record<string, unknown>;
		const rows = sidebar.rows as Array<Record<string, unknown>>;
		const row = rows.find((r) => r.laneId === laneId);
		assert.ok(row, "running lane row must exist in sidebar cache");
		assert.equal(row?.state, "running");
		assert.equal(row?.parentSessionRef, "ses-ses_running_parent_1", "running row must carry parentSessionRef from child-session");
	} finally {
		rmSync(rootDir, { recursive: true, force: true });
	}
});

test("completion UI cache omits task summaries with forbidden markers", () => {
	const rootDir = mkdtempSync(join(tmpdir(), "flowdesk-completion-redacted-labels-"));
	try {
		const workflowId = "workflow-labels-redacted-1";
		const laneId = "lane-task-labels-redacted-1";
		writeEvidence(rootDir, workflowId, "agent_task_context", "context-labels-redacted-1", {
			schema_version: "flowdesk.agent_task_context.v1",
			workflow_id: workflowId,
			lane_id: laneId,
			task_id: "task-labels-redacted-1",
			agent_ref: "agent-reviewer-gpt-frontier",
			provider_qualified_model_id: "openai/gpt-5.5",
			parent_session_ref: "ses-parent-labels-1",
			prompt_text: "Summarize provider payload details safely.",
			prompt_text_truncated: false,
			prompt_text_sha256: "a".repeat(64),
			redaction_version: "v1",
			created_at: "2026-05-29T00:00:00.000Z",
			dispatch_authority_enabled: false,
		});
		writeEvidence(rootDir, workflowId, "task_result", "task-result-labels-redacted-1", taskResult(workflowId, laneId, "task-labels-redacted-1"));

		refreshFlowDeskCompletionUiCachesV1({ rootDir, workflowId, observedAt: "2026-05-29T00:01:00.000Z" });

		const sidebar = JSON.parse(readFileSync(join(rootDir, ".flowdesk", "ui", "subtask-activity-sidebar.json"), "utf8")) as Record<string, unknown>;
		const rows = sidebar.rows as Array<Record<string, unknown>>;
		assert.equal("taskSummary" in rows[0], false);
		const ready = JSON.parse(readFileSync(join(rootDir, ".flowdesk", "ui", "auto-next-ready.json"), "utf8")) as Record<string, unknown>;
		const workflows = ready.workflows as Array<Record<string, unknown>>;
		assert.deepEqual(workflows[0].taskSummaries, []);
	} finally {
		rmSync(rootDir, { recursive: true, force: true });
	}
});

test("completion UI cache writes provider-free completion wake-ready row for synthesis-ready results", () => {
	const rootDir = mkdtempSync(join(tmpdir(), "flowdesk-completion-wake-ready-"));
	try {
		const workflowId = "workflow-wake-ready-1";
		const laneId = "lane-task-wake-ready-1";
		writeEvidence(rootDir, workflowId, "agent_task_context", "context-wake-ready-1", {
			schema_version: "flowdesk.agent_task_context.v1",
			workflow_id: workflowId,
			lane_id: laneId,
			task_id: "task-wake-ready-1",
			agent_ref: "agent-reviewer-gpt-frontier",
			provider_qualified_model_id: "openai/gpt-5.5",
			parent_wake_provider_qualified_model_id: "anthropic/claude-opus-4-20250514",
			parent_session_provider_qualified_model_id: "openai/gpt-5.5-main",
			parent_session_ref: "ses-parent-wake-ready-1",
			prompt_text: "Review wake ready notification metadata only; do not dispatch anything.",
			prompt_text_truncated: false,
			prompt_text_sha256: "a".repeat(64),
			redaction_version: "v1",
			created_at: "2026-05-29T00:00:00.000Z",
			dispatch_authority_enabled: false,
		});
		writeEvidence(rootDir, workflowId, "task_result", "task-result-wake-ready-1", taskResult(workflowId, laneId, "task-wake-ready-1", "2026-05-29T00:02:00.000Z"));

		refreshFlowDeskCompletionUiCachesV1({ rootDir, workflowId, observedAt: "2026-05-29T00:02:01.000Z" });

		const wake = readCache(rootDir, "completion-wake-ready.json");
		assert.equal(wake.schema_version, "flowdesk.completion_wake_ready_cache.v1");
		const rows = wake.rows as Array<Record<string, unknown>>;
		assert.equal(rows.length, 1);
		assert.equal(rows[0].workflowId, workflowId);
		assert.equal(rows[0].parentSessionRef, "ses-parent-wake-ready-1");
		assert.equal(rows[0].completionKind, "auto_next_ready");
		assert.equal(rows[0].readyAt, "2026-05-29T00:02:00.000Z");
		assert.equal(rows[0].dedupeKey, `ses-parent-wake-ready-1\u0000${workflowId}`);
		assert.equal(rows[0].consumptionKey, `ses-parent-wake-ready-1:${workflowId}:2026-05-29T00:02:00.000Z:1:0`);
		assert.equal(rows[0].consumed, false);
		assert.deepEqual(rows[0].taskResultRefs, ["task-wake-ready-1"]);
		assert.deepEqual(rows[0].taskFailedRefs, []);
		assert.deepEqual(rows[0].nextActionRefs, ["/flowdesk-status", "/flowdesk-export-debug"]);
		assert.deepEqual(wake.authority, {
			displayOnly: true,
			realOpenCodeDispatch: false,
			parentPromptInjection: false,
			providerCall: false,
			runtimeExecution: false,
			actualLaneLaunch: false,
			fallbackAuthority: false,
			hardCancelOrNoReplyAuthority: false,
		});
		assert.equal(JSON.stringify(wake).includes("prompt_text"), false, "wake-ready cache must not persist raw prompt text");
		assert.equal(JSON.stringify(wake).includes("do not dispatch anything"), false, "wake-ready cache must not persist raw prompt content");
		// Wake-ready row must include the parent/main wake model, not the lane model.
		assert.equal(rows[0].parentWakeProviderQualifiedModelId, "anthropic/claude-opus-4-20250514", "wake-ready row must persist parent wake model from evidence");
		assert.equal("wakeProviderQualifiedModelId" in rows[0], false, "wake-ready row must not persist the old lane-model field");
	} finally {
		rmSync(rootDir, { recursive: true, force: true });
	}
});

test("completion UI cache workflow wake-ready row inherits parentSessionRef from child-session when context omits it", () => {
	const rootDir = mkdtempSync(join(tmpdir(), "flowdesk-completion-wake-parent-child-"));
	try {
		const workflowId = "workflow-wake-parent-child-1";
		const laneId = "lane-task-wake-parent-child-1";
		const taskId = "task-wake-parent-child-1";
		writeEvidence(rootDir, workflowId, "agent_task_context", "context-wake-parent-child-1", {
			...agentTaskContext(workflowId, laneId, taskId, "2026-06-06T00:00:00.000Z"),
			parent_session_ref: undefined,
		});
		writeEvidence(rootDir, workflowId, "agent_task_child_session", "child-wake-parent-child-1", {
			schema_version: "flowdesk.agent_task_child_session.v1",
			workflow_id: workflowId,
			lane_id: laneId,
			task_id: taskId,
			child_session_id: "ses-child-wake-parent-child-1",
			parent_session_ref: "ses-parent-wake-parent-child-1",
			provider_qualified_model_id: "openai/gpt-5.5",
			agent_ref: "agent-reviewer-gpt-frontier",
			nudge_count: 0,
			last_nudge_at: null,
			created_at: "2026-06-06T00:00:01.000Z",
			dispatch_authority_enabled: false,
		});
		writeEvidence(rootDir, workflowId, "task_result", "task-result-wake-parent-child-1", taskResult(workflowId, laneId, taskId, "2026-06-06T00:02:00.000Z"));

		refreshFlowDeskCompletionUiCachesV1({ rootDir, workflowId, observedAt: "2026-06-06T00:02:01.000Z" });

		const wake = readCache(rootDir, "completion-wake-ready.json");
		const rows = wake.rows as Array<Record<string, unknown>>;
		assert.equal(rows.length, 1);
		assert.equal(rows[0].workflowId, workflowId);
		assert.equal(rows[0].parentSessionRef, "ses-parent-wake-parent-child-1");
		assert.equal(rows[0].dedupeKey, `ses-parent-wake-parent-child-1\u0000${workflowId}`);
		assert.equal(rows[0].consumptionKey, `ses-parent-wake-parent-child-1:${workflowId}:2026-06-06T00:02:00.000Z:1:0`);
	} finally {
		rmSync(rootDir, { recursive: true, force: true });
	}
});

test("completion UI cache writes wake-ready row for final partial_findings task_result", () => {
	const rootDir = mkdtempSync(join(tmpdir(), "flowdesk-completion-partial-findings-wake-"));
	try {
		const workflowId = "workflow-partial-findings-wake-1";
		const laneId = "lane-partial-findings-wake-1";
		const taskId = "task-partial-findings-wake-1";
		writeEvidence(rootDir, workflowId, "agent_task_context", "context-partial-findings-wake-1", {
			...agentTaskContext(workflowId, laneId, taskId, "2026-06-05T00:00:00.000Z"),
			parent_session_ref: "ses-parent-partial-findings-wake-1",
			prompt_text: "Summarize cache wake behavior for partial findings results.",
		});
		writeEvidence(rootDir, workflowId, "lane_lifecycle", "lifecycle-partial-findings-wake-1", {
			...laneLifecycle(workflowId, laneId, taskId, "complete", "2026-06-05T00:02:00.000Z"),
			parent_session_ref: "ses-parent-partial-findings-wake-1",
		});
		writeEvidence(rootDir, workflowId, "task_result", "task-result-partial-findings-wake-1", {
			...taskResult(workflowId, laneId, taskId, "2026-06-05T00:02:00.000Z"),
			completion_status: "final",
			output_kind: "partial_findings",
			usable_for_synthesis: true,
		});

		refreshFlowDeskCompletionUiCachesV1({ rootDir, workflowId, observedAt: "2026-06-05T00:02:01.000Z" });

		const sidebar = readCache(rootDir, "subtask-activity-sidebar.json");
		const sidebarRows = sidebar.rows as Array<Record<string, unknown>>;
		const sidebarRow = sidebarRows.find((row) => row.workflowId === workflowId && row.laneId === laneId);
		assert.equal(sidebarRow?.state, "task_result");
		assert.equal(sidebarRow?.completionStatus, "final");
		assert.equal(sidebarRow?.outputKind, "partial_findings");
		assert.equal(sidebarRow?.usableForSynthesis, true);

		const wake = readCache(rootDir, "completion-wake-ready.json");
		const rows = wake.rows as Array<Record<string, unknown>>;
		const row = rows.find((candidate) => candidate.workflowId === workflowId && (candidate.completionKind === "auto_next_ready" || candidate.completionKind === "task_result"));
		assert.ok(row, "final partial_findings task_result should create a wake-ready row");
		assert.equal(row!.parentSessionRef, "ses-parent-partial-findings-wake-1");
		assert.equal(row!.completionKind, "auto_next_ready");
		assert.deepEqual(row!.laneIds, [laneId]);
		assert.deepEqual(row!.taskIds, [taskId]);
		assert.deepEqual(row!.taskResultRefs, [taskId]);
		assert.deepEqual(row!.taskFailedRefs, []);
		assert.deepEqual(row!.taskSummaries, ["cache wake behavior parti"]);
		assert.equal(JSON.stringify(wake).includes("prompt_text"), false, "wake-ready cache must not persist raw prompt text");
		assert.equal(JSON.stringify(wake).includes("partial findings results"), false, "wake-ready cache must not persist raw prompt content");
	} finally {
		rmSync(rootDir, { recursive: true, force: true });
	}
});

test("completion UI cache wake-ready row falls back to parent session model snapshot and ignores lane model", () => {
	const rootDir = mkdtempSync(join(tmpdir(), "flowdesk-completion-wake-model-"));
	try {
		const workflowId = "workflow-wake-model-1";
		const completedLaneId = "lane-task-wake-model-1";
		const runningLaneId = "lane-task-wake-running-model-1";
		writeEvidence(rootDir, workflowId, "agent_task_context", "context-wake-model-1", {
			...agentTaskContext(workflowId, completedLaneId, "task-wake-model-1", "2026-06-05T00:00:00.000Z"),
			parent_session_ref: "ses-parent-wake-model-1",
			provider_qualified_model_id: "anthropic/claude-sonnet-4-20250514",
			parent_session_provider_qualified_model_id: "anthropic/claude-opus-4-20250514",
		});
		writeEvidence(rootDir, workflowId, "task_result", "task-result-wake-model-1", taskResult(workflowId, completedLaneId, "task-wake-model-1", "2026-06-05T00:02:00.000Z"));
		writeEvidence(rootDir, workflowId, "agent_task_child_session", "child-wake-running-model-1", {
			schema_version: "flowdesk.agent_task_child_session.v1",
			workflow_id: workflowId,
			lane_id: runningLaneId,
			task_id: "task-wake-running-model-1",
			child_session_id: "ses-child-wake-running-model-1",
			parent_session_ref: "ses-parent-wake-model-1",
			provider_qualified_model_id: "openai/gpt-5.5",
			agent_ref: "agent-flowdesk-verifier-testing",
			nudge_count: 0,
			last_nudge_at: null,
			created_at: "2026-06-05T00:01:00.000Z",
			dispatch_authority_enabled: false,
		});

		refreshFlowDeskCompletionUiCachesV1({ rootDir, workflowId, observedAt: "2026-06-05T00:02:01.000Z" });

		const wake = readCache(rootDir, "completion-wake-ready.json");
		const rows = wake.rows as Array<Record<string, unknown>>;
		assert.equal(rows.length, 1);
		assert.equal(rows[0].workflowId, workflowId);
		assert.equal(rows[0].parentWakeProviderQualifiedModelId, "anthropic/claude-opus-4-20250514", "wake row must use parent session snapshot, not completed lane model");
		assert.equal("wakeProviderQualifiedModelId" in rows[0], false, "wake row must not persist the old lane-model field");
	} finally {
		rmSync(rootDir, { recursive: true, force: true });
	}
});

test("completion UI cache writes lane-scoped wake-ready row when one delegated lane completes before workflow is fully terminal", () => {
	const rootDir = mkdtempSync(join(tmpdir(), "flowdesk-completion-lane-wake-ready-"));
	try {
		const workflowId = "workflow-lane-wake-ready-1";
		const completedLaneId = "lane-task-lane-wake-ready-1";
		const runningLaneId = "lane-task-lane-wake-running-1";
		writeEvidence(rootDir, workflowId, "agent_task_context", "context-lane-wake-ready-1", {
			...agentTaskContext(workflowId, completedLaneId, "task-lane-wake-ready-1", "2026-05-29T00:00:00.000Z"),
			parent_session_ref: "ses-parent-lane-wake-ready-1",
			prompt_text: "Review completion wake presentation metadata",
		});
		writeEvidence(rootDir, workflowId, "task_result", "task-result-lane-wake-ready-1", taskResult(workflowId, completedLaneId, "task-lane-wake-ready-1", "2026-05-29T00:02:00.000Z"));
		writeEvidence(rootDir, workflowId, "agent_task_child_session", "child-lane-wake-running-1", {
			schema_version: "flowdesk.agent_task_child_session.v1",
			workflow_id: workflowId,
			lane_id: runningLaneId,
			task_id: "task-lane-wake-running-1",
			child_session_id: "ses-child-lane-wake-running-1",
			parent_session_ref: "ses-parent-lane-wake-ready-1",
			provider_qualified_model_id: "openai/gpt-5.5",
			agent_ref: "agent-flowdesk-verifier-testing",
			nudge_count: 0,
			last_nudge_at: null,
			created_at: "2026-05-29T00:01:00.000Z",
			dispatch_authority_enabled: false,
		});

		refreshFlowDeskCompletionUiCachesV1({ rootDir, workflowId, observedAt: "2026-05-29T00:02:01.000Z" });

		const autoNext = readCache(rootDir, "auto-next-ready.json");
		assert.deepEqual(autoNext.workflows, [], "workflow must not be auto-next-ready while another lane is still running");
		const wake = readCache(rootDir, "completion-wake-ready.json");
		const rows = wake.rows as Array<Record<string, unknown>>;
		assert.equal(rows.length, 1);
		assert.equal(rows[0].workflowId, workflowId);
		assert.equal(rows[0].parentSessionRef, "ses-parent-lane-wake-ready-1");
		assert.equal(rows[0].completionKind, "task_result");
		assert.equal(rows[0].readyAt, "2026-05-29T00:02:00.000Z");
		assert.equal(rows[0].dedupeKey, `ses-parent-lane-wake-ready-1\u0000${workflowId}\u0000${completedLaneId}`);
		assert.deepEqual(rows[0].laneIds, [completedLaneId]);
		assert.deepEqual(rows[0].taskIds, ["task-lane-wake-ready-1"]);
		assert.deepEqual(rows[0].taskResultRefs, ["task-lane-wake-ready-1"]);
		assert.equal(rows[0].notificationLabel, "FlowDesk lane result ready");
		assert.equal("parentWakeProviderQualifiedModelId" in rows[0], false, "wake row must omit parent wake model when only lane model evidence exists");
		assert.equal("wakeProviderQualifiedModelId" in rows[0], false, "wake row must not fall back to lane model");
	} finally {
		rmSync(rootDir, { recursive: true, force: true });
	}
});

test("completion UI cache wake-ready rows are parent scoped and duplicate refreshes are monotonic", () => {
	const rootDir = mkdtempSync(join(tmpdir(), "flowdesk-completion-wake-scope-"));
	try {
		const workflowA = "workflow-wake-scope-a";
		const workflowB = "workflow-wake-scope-b";
		writeEvidence(rootDir, workflowA, "agent_task_context", "context-wake-scope-a", {
			...agentTaskContext(workflowA, "lane-wake-scope-a", "task-wake-scope-a", "2026-05-29T00:01:00.000Z"),
			parent_session_ref: "ses-parent-wake-scope-a",
		});
		writeEvidence(rootDir, workflowA, "task_result", "task-result-wake-scope-a", taskResult(workflowA, "lane-wake-scope-a", "task-wake-scope-a", "2026-05-29T00:03:00.000Z"));
		refreshFlowDeskCompletionUiCachesV1({ rootDir, workflowId: workflowA, observedAt: "2026-05-29T00:03:01.000Z" });
		refreshFlowDeskCompletionUiCachesV1({ rootDir, workflowId: workflowA, observedAt: "2026-05-29T00:02:01.000Z" });

		writeEvidence(rootDir, workflowB, "agent_task_context", "context-wake-scope-b", {
			...agentTaskContext(workflowB, "lane-wake-scope-b", "task-wake-scope-b", "2026-05-29T00:04:00.000Z"),
			parent_session_ref: "ses-parent-wake-scope-b",
		});
		writeEvidence(rootDir, workflowB, "task_failed", "task-failed-wake-scope-b", taskFailed(workflowB, "lane-wake-scope-b", "task-wake-scope-b", "2026-05-29T00:05:00.000Z"));
		refreshFlowDeskCompletionUiCachesV1({ rootDir, workflowId: workflowB, observedAt: "2026-05-29T00:05:01.000Z" });

		const wake = readCache(rootDir, "completion-wake-ready.json");
		const rows = wake.rows as Array<Record<string, unknown>>;
		assert.equal(rows.length, 2);
		const rowA = rows.find((row) => row.workflowId === workflowA);
		const rowB = rows.find((row) => row.workflowId === workflowB);
		assert.ok(rowA);
		assert.ok(rowB);
		assert.equal(rowA!.parentSessionRef, "ses-parent-wake-scope-a");
		assert.equal(rowB!.parentSessionRef, "ses-parent-wake-scope-b");
		assert.equal(rowA!.completionKind, "auto_next_ready");
		assert.equal(rowB!.completionKind, "task_failed");
		assert.equal(rowA!.readyAt, "2026-05-29T00:03:00.000Z");
		assert.equal(wake.observed_at, "2026-05-29T00:05:01.000Z");
		assert.equal(rows.filter((row) => row.workflowId === workflowA).length, 1, "duplicate refresh must not add another wake-ready row");
		assert.equal(typeof rowA!.consumptionKey, "string");
		assert.equal(typeof rowB!.consumptionKey, "string");
	} finally {
		rmSync(rootDir, { recursive: true, force: true });
	}
});

test("completion UI cache keeps only the hundred newest subtask sidebar rows globally", () => {
	const rootDir = mkdtempSync(join(tmpdir(), "flowdesk-completion-row-limit-"));
	try {
		for (let index = 0; index < 101; index += 1) {
			const workflowId = `workflow-row-limit-${index}`;
			const laneId = `lane-task-row-limit-${index}`;
			const taskId = `task-row-limit-${index}`;
			const createdAt = new Date(Date.UTC(2026, 4, 29, 0, index, 0)).toISOString();
			writeEvidence(rootDir, workflowId, "agent_task_context", `context-row-limit-${index}`, {
				schema_version: "flowdesk.agent_task_context.v1",
				workflow_id: workflowId,
				lane_id: laneId,
				task_id: taskId,
				agent_ref: "agent-reviewer-gpt-frontier",
				provider_qualified_model_id: "openai/gpt-5.5",
				parent_session_ref: "ses-parent-row-limit",
				prompt_text: `Review row limit ${index}`,
				prompt_text_truncated: false,
				prompt_text_sha256: "a".repeat(64),
				redaction_version: "v1",
				created_at: createdAt,
				dispatch_authority_enabled: false,
			});
			writeEvidence(rootDir, workflowId, "task_result", `task-result-row-limit-${index}`, taskResult(workflowId, laneId, taskId, createdAt));
			refreshFlowDeskCompletionUiCachesV1({ rootDir, workflowId, observedAt: createdAt });
		}

		const sidebar = JSON.parse(readFileSync(join(rootDir, ".flowdesk", "ui", "subtask-activity-sidebar.json"), "utf8")) as Record<string, unknown>;
		const rows = sidebar.rows as Array<Record<string, unknown>>;
		assert.equal(rows.length, 100);
		assert.equal(rows[0].workflowId, "workflow-row-limit-100");
		assert.equal(rows[99].workflowId, "workflow-row-limit-1");
		assert.equal(rows.some((row) => row.workflowId === "workflow-row-limit-0"), false);
	} finally {
		rmSync(rootDir, { recursive: true, force: true });
	}
});

test("completion UI cache preserves twenty rows for an older parent session when another session is busy", () => {
	const rootDir = mkdtempSync(join(tmpdir(), "flowdesk-completion-session-retention-"));
	try {
		for (let index = 0; index < 20; index += 1) {
			const workflowId = `workflow-session-older-${index}`;
			const laneId = `lane-task-session-older-${index}`;
			const taskId = `task-session-older-${index}`;
			const createdAt = new Date(Date.UTC(2026, 4, 29, 0, index, 0)).toISOString();
			writeEvidence(rootDir, workflowId, "agent_task_context", `context-session-older-${index}`, {
				schema_version: "flowdesk.agent_task_context.v1",
				workflow_id: workflowId,
				lane_id: laneId,
				task_id: taskId,
				agent_ref: "agent-reviewer-gpt-frontier",
				provider_qualified_model_id: "openai/gpt-5.5",
				parent_session_ref: "ses-parent-session-older",
				prompt_text: `Review older session retention ${index}`,
				prompt_text_truncated: false,
				prompt_text_sha256: "a".repeat(64),
				redaction_version: "v1",
				created_at: createdAt,
				dispatch_authority_enabled: false,
			});
			writeEvidence(rootDir, workflowId, "task_result", `task-result-session-older-${index}`, taskResult(workflowId, laneId, taskId, createdAt));
			refreshFlowDeskCompletionUiCachesV1({ rootDir, workflowId, observedAt: createdAt });
		}

		for (let index = 0; index < 100; index += 1) {
			const workflowId = `workflow-session-busy-${index}`;
			const laneId = `lane-task-session-busy-${index}`;
			const taskId = `task-session-busy-${index}`;
			const createdAt = new Date(Date.UTC(2026, 4, 29, 1, index, 0)).toISOString();
			writeEvidence(rootDir, workflowId, "agent_task_context", `context-session-busy-${index}`, {
				schema_version: "flowdesk.agent_task_context.v1",
				workflow_id: workflowId,
				lane_id: laneId,
				task_id: taskId,
				agent_ref: "agent-reviewer-gpt-frontier",
				provider_qualified_model_id: "openai/gpt-5.5",
				parent_session_ref: "ses-parent-session-busy",
				prompt_text: `Review busy session retention ${index}`,
				prompt_text_truncated: false,
				prompt_text_sha256: "a".repeat(64),
				redaction_version: "v1",
				created_at: createdAt,
				dispatch_authority_enabled: false,
			});
			writeEvidence(rootDir, workflowId, "task_result", `task-result-session-busy-${index}`, taskResult(workflowId, laneId, taskId, createdAt));
			refreshFlowDeskCompletionUiCachesV1({ rootDir, workflowId, observedAt: createdAt });
		}

		const sidebar = readCache(rootDir, "subtask-activity-sidebar.json");
		const rows = sidebar.rows as Array<Record<string, unknown>>;
		const olderRows = rows.filter((row) => row.parentSessionRef === "ses-parent-session-older");
		const busyRows = rows.filter((row) => row.parentSessionRef === "ses-parent-session-busy");
		assert.equal(rows.length, 100);
		assert.equal(olderRows.length, 20, "older parent session should retain its twenty rows despite newer busy-session rows");
		assert.equal(busyRows.length, 80, "global cap should still bound total retained rows to one hundred");
		for (let index = 0; index < 20; index += 1) {
			assert.ok(olderRows.some((row) => row.workflowId === `workflow-session-older-${index}`), `older session row ${index} should survive`);
		}
	} finally {
		rmSync(rootDir, { recursive: true, force: true });
	}
});

test("completion UI cache updates sidebar and clears auto-next for terminal failures without task_result", () => {
	const rootDir = mkdtempSync(join(tmpdir(), "flowdesk-completion-failure-no-result-"));
	try {
		const workflowId = "workflow-failure-no-result-1";
		const laneNoOutput = "lane-failure-no-output-1";
		const laneTaskFailed = "lane-failure-task-failed-1";
		writeEvidence(rootDir, workflowId, "lane_lifecycle", "lifecycle-no-output-1", laneLifecycle(workflowId, laneNoOutput, "task-no-output-1", "no_output", "2026-05-29T00:02:00.000Z"));
		writeEvidence(rootDir, workflowId, "task_failed", "task-failed-1", taskFailed(workflowId, laneTaskFailed, "task-failed-1", "2026-05-29T00:03:00.000Z"));

		refreshFlowDeskCompletionUiCachesV1({ rootDir, workflowId, observedAt: "2026-05-29T00:04:00.000Z" });

		const sidebar = readCache(rootDir, "subtask-activity-sidebar.json");
		const rows = sidebar.rows as Array<Record<string, unknown>>;
		const noOutputRow = rows.find((row) => row.laneId === laneNoOutput);
		const failedRow = rows.find((row) => row.laneId === laneTaskFailed);
		assert.equal(noOutputRow?.state, "no_output");
		assert.equal(noOutputRow?.classification, "terminal");
		assert.equal(failedRow?.state, "invocation_failed");
		assert.equal(failedRow?.classification, "terminal");

		const ready = readCache(rootDir, "auto-next-ready.json");
		assert.deepEqual(ready.workflows, []);
		assert.equal(ready.observed_at, "2026-05-29T00:04:00.000Z");
	} finally {
		rmSync(rootDir, { recursive: true, force: true });
	}
});

test("completion UI cache keeps terminal row when context arrives after terminal lifecycle", () => {
	const rootDir = mkdtempSync(join(tmpdir(), "flowdesk-completion-order-inversion-"));
	try {
		const workflowId = "workflow-order-inversion-1";
		const laneId = "lane-order-inversion-1";
		writeEvidence(rootDir, workflowId, "lane_lifecycle", "lifecycle-order-terminal-1", laneLifecycle(workflowId, laneId, "task-order-inversion-1", "invocation_failed", "2026-05-29T00:05:00.000Z"));
		refreshFlowDeskCompletionUiCachesV1({ rootDir, workflowId, observedAt: "2026-05-29T00:05:01.000Z" });

		writeEvidence(rootDir, workflowId, "agent_task_context", "context-order-late-1", agentTaskContext(workflowId, laneId, "task-order-inversion-1", "2026-05-29T00:01:00.000Z"));
		refreshFlowDeskCompletionUiCachesV1({ rootDir, workflowId, observedAt: "2026-05-29T00:04:00.000Z" });

		const sidebar = readCache(rootDir, "subtask-activity-sidebar.json");
		const rows = sidebar.rows as Array<Record<string, unknown>>;
		assert.equal(rows[0].state, "invocation_failed");
		assert.equal(rows[0].classification, "terminal");
		assert.equal(rows[0].parentSessionRef, "ses-parent-order-inversion-1");
		assert.equal(sidebar.observed_at, "2026-05-29T00:05:01.000Z");
	} finally {
		rmSync(rootDir, { recursive: true, force: true });
	}
});

test("completion UI cache handles duplicate terminal signals idempotently and monotonically", () => {
	const rootDir = mkdtempSync(join(tmpdir(), "flowdesk-completion-duplicates-"));
	try {
		const workflowId = "workflow-duplicates-1";
		const laneId = "lane-duplicates-1";
		writeEvidence(rootDir, workflowId, "task_failed", "task-failed-duplicates-new", taskFailed(workflowId, laneId, "task-duplicates-1", "2026-05-29T00:06:00.000Z"));
		refreshFlowDeskCompletionUiCachesV1({ rootDir, workflowId, observedAt: "2026-05-29T00:06:01.000Z" });
		writeEvidence(rootDir, workflowId, "task_failed", "task-failed-duplicates-old", taskFailed(workflowId, laneId, "task-duplicates-1", "2026-05-29T00:05:00.000Z"));
		refreshFlowDeskCompletionUiCachesV1({ rootDir, workflowId, observedAt: "2026-05-29T00:05:01.000Z" });

		const sidebar = readCache(rootDir, "subtask-activity-sidebar.json");
		const rows = sidebar.rows as Array<Record<string, unknown>>;
		const duplicateRows = rows.filter((row) => row.workflowId === workflowId && row.laneId === laneId);
		assert.equal(duplicateRows.length, 1);
		assert.equal(duplicateRows[0].state, "invocation_failed");
		assert.equal(duplicateRows[0].lastObservedAt, "2026-05-29T00:06:00.000Z");
		assert.equal(sidebar.observed_at, "2026-05-29T00:06:01.000Z");
	} finally {
		rmSync(rootDir, { recursive: true, force: true });
	}
});

test("completion UI cache preserves agent-task log index rows across workflow refreshes", () => {
	const rootDir = mkdtempSync(join(tmpdir(), "flowdesk-agent-task-log-index-merge-"));
	try {
		const workflowA = "workflow-log-index-a";
		const workflowB = "workflow-log-index-b";
		writeEvidence(rootDir, workflowA, "task_result", "task-result-a", taskResult(workflowA, "lane-log-a", "task-log-a", "2026-05-29T00:01:00.000Z"));
		refreshFlowDeskCompletionUiCachesV1({ rootDir, workflowId: workflowA, observedAt: "2026-05-29T00:01:01.000Z" });
		writeEvidence(rootDir, workflowB, "task_result", "task-result-b", taskResult(workflowB, "lane-log-b", "task-log-b", "2026-05-29T00:02:00.000Z"));
		refreshFlowDeskCompletionUiCachesV1({ rootDir, workflowId: workflowB, observedAt: "2026-05-29T00:02:01.000Z" });

		const logIndex = readCache(rootDir, "agent-task-log-index.json");
		const rows = logIndex.rows as Array<Record<string, unknown>>;
		assert.ok(rows.some((row) => row.workflowId === workflowA && row.laneId === "lane-log-a"), "older workflow row should be retained");
		assert.ok(rows.some((row) => row.workflowId === workflowB && row.laneId === "lane-log-b"), "newer workflow row should be added");
	} finally {
		rmSync(rootDir, { recursive: true, force: true });
	}
});

test("completion UI cache preserves terminal row start time and stores completion duration", () => {
	const rootDir = mkdtempSync(join(tmpdir(), "flowdesk-completion-terminal-times-"));
	try {
		const workflowId = "workflow-terminal-times-1";
		const laneId = "lane-terminal-times-1";
		const taskId = "task-terminal-times-1";
		writeEvidence(rootDir, workflowId, "agent_task_context", "context-terminal-times-1", agentTaskContext(workflowId, laneId, taskId, "2026-05-29T00:01:00.000Z"));
		writeEvidence(rootDir, workflowId, "task_result", "task-result-terminal-times-1", taskResult(workflowId, laneId, taskId, "2026-05-29T00:04:30.000Z"));

		refreshFlowDeskCompletionUiCachesV1({ rootDir, workflowId, observedAt: "2026-05-29T00:04:31.000Z" });

		const sidebar = readCache(rootDir, "subtask-activity-sidebar.json");
		const rows = sidebar.rows as Array<Record<string, unknown>>;
		const row = rows.find((candidate) => candidate.workflowId === workflowId && candidate.laneId === laneId);
		assert.ok(row, "terminal row preserved");
		assert.equal(row!.state, "task_result");
		assert.equal(row!.startedAt, "2026-05-29T00:01:00.000Z");
		assert.equal(row!.completedAt, "2026-05-29T00:04:30.000Z");
		assert.equal(row!.lastObservedAt, "2026-05-29T00:04:30.000Z");
		assert.equal(row!.durationMs, 210_000);
	} finally {
		rmSync(rootDir, { recursive: true, force: true });
	}
});

test("completion UI cache produces one terminal row when task_failed precedes parent-ref-bearing lifecycle", () => {
	// Reproduces the merge-key bug: task_failed (no parent_session_ref) arrives
	// first, then lane_lifecycle=invocation_failed carrying parent_session_ref
	// arrives later. With the old `parentSessionRef ?? "global"` merge key,
	// the two writes produced two distinct sidebar rows for the same lane.
	const rootDir = mkdtempSync(join(tmpdir(), "flowdesk-completion-parentref-late-"));
	try {
		const workflowId = "workflow-parentref-late-1";
		const laneId = "lane-parentref-late-1";
		const taskId = "task-parentref-late-1";

		const failedNoParentRef = taskFailed(workflowId, laneId, taskId, "2026-05-29T00:02:00.000Z");
		writeEvidence(rootDir, workflowId, "task_failed", "task-failed-parentref-late-1", failedNoParentRef);
		refreshFlowDeskCompletionUiCachesV1({ rootDir, workflowId, observedAt: "2026-05-29T00:02:01.000Z" });

		// Later: lane_lifecycle=invocation_failed arrives with parent_session_ref.
		writeEvidence(
			rootDir,
			workflowId,
			"lane_lifecycle",
			"lifecycle-parentref-late-1",
			laneLifecycle(workflowId, laneId, taskId, "invocation_failed", "2026-05-29T00:03:00.000Z"),
		);
		refreshFlowDeskCompletionUiCachesV1({ rootDir, workflowId, observedAt: "2026-05-29T00:03:01.000Z" });

		const sidebar = readCache(rootDir, "subtask-activity-sidebar.json");
		const rows = sidebar.rows as Array<Record<string, unknown>>;
		const matched = rows.filter((row) => row.workflowId === workflowId && row.laneId === laneId);
		assert.equal(matched.length, 1, "exactly one sidebar row per lane regardless of parent_session_ref ordering");
		assert.equal(matched[0].classification, "terminal");
		assert.equal(matched[0].state, "invocation_failed");
		assert.equal(matched[0].parentSessionRef, "ses-parent-lifecycle-1");
	} finally {
		rmSync(rootDir, { recursive: true, force: true });
	}
});

test("completion UI cache classification never regresses from terminal to running", () => {
	// Locks in the monotonic terminal-rank invariant in choosePreferredRow:
	// a later refresh that only sees agent_task_context (running candidate)
	// MUST NOT downgrade an existing terminal row.
	const rootDir = mkdtempSync(join(tmpdir(), "flowdesk-completion-no-regress-"));
	try {
		const workflowId = "workflow-no-regress-1";
		const laneId = "lane-no-regress-1";
		const taskId = "task-no-regress-1";

		writeEvidence(
			rootDir,
			workflowId,
			"task_failed",
			"task-failed-no-regress-1",
			taskFailed(workflowId, laneId, taskId, "2026-05-29T00:04:00.000Z"),
		);
		refreshFlowDeskCompletionUiCachesV1({ rootDir, workflowId, observedAt: "2026-05-29T00:04:01.000Z" });

		// A later refresh sees an agent_task_context that is technically newer
		// but represents only a "running" candidate. The terminal row must hold.
		writeEvidence(
			rootDir,
			workflowId,
			"agent_task_context",
			"context-no-regress-late-1",
			agentTaskContext(workflowId, laneId, taskId, "2026-05-29T00:05:00.000Z"),
		);
		refreshFlowDeskCompletionUiCachesV1({ rootDir, workflowId, observedAt: "2026-05-29T00:05:01.000Z" });

		const sidebar = readCache(rootDir, "subtask-activity-sidebar.json");
		const rows = sidebar.rows as Array<Record<string, unknown>>;
		const row = rows.find((r) => r.workflowId === workflowId && r.laneId === laneId);
		assert.ok(row, "row preserved");
		assert.equal(row!.classification, "terminal");
		assert.equal(row!.state, "invocation_failed");
	} finally {
		rmSync(rootDir, { recursive: true, force: true });
	}
});

function writeEvidence(
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

function taskResult(workflowId: string, laneId: string, taskId: string, createdAt = "2026-05-29T00:01:00.000Z"): Record<string, unknown> {
	return {
		schema_version: "flowdesk.task_result.v1",
		workflow_id: workflowId,
		lane_id: laneId,
		task_id: taskId,
		agent_ref: "agent-reviewer-gpt-frontier",
		provider_qualified_model_id: "openai/gpt-5.5",
		task_prompt_sha256: "b".repeat(64),
		result_text: "done",
		result_text_truncated: false,
		result_text_sha256: "c".repeat(64),
		completion_status: "final",
		output_kind: "final_answer",
		usable_for_synthesis: true,
		created_at: createdAt,
		dispatch_authority_enabled: false,
	};
}

function readCache(rootDir: string, fileName: string): Record<string, unknown> {
	return JSON.parse(readFileSync(join(rootDir, ".flowdesk", "ui", fileName), "utf8")) as Record<string, unknown>;
}

function agentTaskContext(workflowId: string, laneId: string, taskId: string, createdAt: string): Record<string, unknown> {
	return {
		schema_version: "flowdesk.agent_task_context.v1",
		workflow_id: workflowId,
		lane_id: laneId,
		task_id: taskId,
		agent_ref: "agent-reviewer-gpt-frontier",
		provider_qualified_model_id: "openai/gpt-5.5",
		parent_session_ref: "ses-parent-order-inversion-1",
		prompt_text: "Verify order inversion recovery",
		prompt_text_truncated: false,
		prompt_text_sha256: "d".repeat(64),
		redaction_version: "v1",
		created_at: createdAt,
		dispatch_authority_enabled: false,
	};
}

function taskFailed(workflowId: string, laneId: string, taskId: string, createdAt: string): Record<string, unknown> {
	return {
		schema_version: "flowdesk.task_failed.v1",
		workflow_id: workflowId,
		lane_id: laneId,
		task_id: taskId,
		agent_ref: "agent-reviewer-gpt-frontier",
		provider_qualified_model_id: "openai/gpt-5.5",
		failure_category: "unknown",
		redacted_reason: "test terminal failure",
		created_at: createdAt,
		dispatch_authority_enabled: false,
	};
}

function laneLifecycle(workflowId: string, laneId: string, taskId: string, state: string, updatedAt: string): Record<string, unknown> {
	return {
		schema_version: "flowdesk.lane_lifecycle_record.v1",
		workflow_id: workflowId,
		lane_id: laneId,
		attempt_id: `attempt-${laneId}`,
		parent_session_ref: "ses-parent-lifecycle-1",
		child_session_ref: `ses-child-${laneId}`,
		agent_ref: "agent-reviewer-gpt-frontier",
		provider_qualified_model_id: "openai/gpt-5.5",
		state,
		timeout_ms: 60_000,
		orphan_max_age_ms: 600_000,
		retry_count: 0,
		created_at: updatedAt,
		updated_at: updatedAt,
		spawned_by: "flowdesk",
		durability: "best_effort_no_dir_fsync",
		dispatch_authority_enabled: false,
		providerCall: false,
		actualLaneLaunch: false,
		runtimeExecution: false,
	};
}
