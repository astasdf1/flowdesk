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
		assert.equal(rows[0].taskSummary, "TUI Next ready label");
		assert.equal(rows[0].parentSessionRef, "ses-parent-labels-1");
		const ready = JSON.parse(readFileSync(join(rootDir, ".flowdesk", "ui", "auto-next-ready.json"), "utf8")) as Record<string, unknown>;
		const workflows = ready.workflows as Array<Record<string, unknown>>;
		assert.deepEqual(workflows[0].taskSummaries, ["TUI Next ready label"]);
		assert.equal(workflows[0].parentSessionRef, "ses-parent-labels-1");
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

test("completion UI cache keeps only the twenty newest subtask sidebar rows", () => {
	const rootDir = mkdtempSync(join(tmpdir(), "flowdesk-completion-row-limit-"));
	try {
		for (let index = 0; index < 21; index += 1) {
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
		assert.equal(rows.length, 20);
		assert.equal(rows[0].workflowId, "workflow-row-limit-20");
		assert.equal(rows[19].workflowId, "workflow-row-limit-1");
		assert.equal(rows.some((row) => row.workflowId === "workflow-row-limit-0"), false);
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
