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
		assert.equal(rows[0].taskSummary, "TUI Next");
		const ready = JSON.parse(readFileSync(join(rootDir, ".flowdesk", "ui", "auto-next-ready.json"), "utf8")) as Record<string, unknown>;
		const workflows = ready.workflows as Array<Record<string, unknown>>;
		assert.deepEqual(workflows[0].taskSummaries, ["TUI Next"]);
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

function taskResult(workflowId: string, laneId: string, taskId: string): Record<string, unknown> {
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
		created_at: "2026-05-29T00:01:00.000Z",
		dispatch_authority_enabled: false,
	};
}
