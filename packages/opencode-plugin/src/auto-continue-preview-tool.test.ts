import assert from "node:assert/strict";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { sessionEvidenceRecordPath } from "@flowdesk/core";
import { executeFlowDeskAutoContinuePreviewToolV1 } from "./auto-continue-preview-tool.js";
import { executeFlowDeskWorkflowDispatchPlanToolV1 } from "./workflow-dispatch-plan-tool.js";

test("auto-continue preview reports next pending durable plan task without execution authority", () => {
	const rootDir = mkdtempSync(join(tmpdir(), "flowdesk-auto-continue-preview-"));
	try {
		const workflowId = "workflow-auto-continue-preview-1";
		const plan = executeFlowDeskWorkflowDispatchPlanToolV1({
			config: { rootDir },
			request: {
				workflowId,
				goalSummary: "Continue durable planned work",
				tasks: [
					{ agentRole: "implementation", title: "First task", summary: "Already completed" },
					{ agentRole: "implementation", title: "Second task", summary: "Document item details" },
				],
			},
			now: () => new Date("2026-05-29T00:00:00.000Z"),
		});
		assert.equal(plan.status, "workflow_dispatch_plan_recorded", plan.summaryForUser);
		const completedTaskId = `task-1-${workflowId}`;
		const nextTaskId = `task-2-${workflowId}`;
		writeEvidence(rootDir, workflowId, "task_result", "task-result-one", {
			schema_version: "flowdesk.task_result.v1",
			workflow_id: workflowId,
			lane_id: "lane-one",
			task_id: completedTaskId,
			agent_ref: "agent-test",
			provider_qualified_model_id: "openai/gpt-5.5",
			task_prompt_sha256: "a".repeat(64),
			result_text: "done",
			result_text_truncated: false,
			result_text_sha256: "b".repeat(64),
			completion_status: "final",
			output_kind: "final_answer",
			usable_for_synthesis: true,
			created_at: "2026-05-29T00:00:00.000Z",
			dispatch_authority_enabled: false,
		});

		const result = executeFlowDeskAutoContinuePreviewToolV1({ config: { rootDir }, request: { workflowId, maxSteps: 3 } });
		assert.equal(result.status, "auto_continue_preview_ready");
		assert.equal(result.nextTaskId, nextTaskId);
		assert.equal(result.nextTaskTitle, "Second task");
		assert.equal(result.pendingTaskCount, 1);
		assert.equal(result.completedTaskCount, 1);
		assert.equal(result.maxSteps, 3);
		assert.equal(result.authority.autoContinuationExecuted, false);
		assert.equal(result.authority.providerCall, false);
		assert.equal(result.authority.actualLaneLaunch, false);
		assert.equal(result.authority.previewOnly, true);
	} finally {
		rmSync(rootDir, { recursive: true, force: true });
	}
});

test("auto-continue preview blocks without durable workflow plan", () => {
	const rootDir = mkdtempSync(join(tmpdir(), "flowdesk-auto-continue-preview-missing-"));
	try {
		const result = executeFlowDeskAutoContinuePreviewToolV1({ config: { rootDir }, request: { workflowId: "workflow-missing" } });
		assert.equal(result.status, "blocked_before_auto_continue_preview");
		assert.equal(result.redactedBlockReason, "no workflow_dispatch_plan evidence found");
		assert.equal(result.authority.autoContinuationExecuted, false);
	} finally {
		rmSync(rootDir, { recursive: true, force: true });
	}
});

test("auto-continue preview blocks terminal incomplete durable task evidence instead of re-pending it", () => {
	const rootDir = mkdtempSync(join(tmpdir(), "flowdesk-auto-continue-preview-failed-"));
	try {
		const workflowId = "workflow-auto-continue-preview-failed-1";
		const plan = executeFlowDeskWorkflowDispatchPlanToolV1({
			config: { rootDir },
			request: {
				workflowId,
				goalSummary: "Continue durable planned work",
				tasks: [
					{ agentRole: "implementation", title: "Failed task", summary: "Already failed" },
					{ agentRole: "implementation", title: "Later task", summary: "Should not be surfaced first" },
				],
			},
			now: () => new Date("2026-05-29T00:00:00.000Z"),
		});
		assert.equal(plan.status, "workflow_dispatch_plan_recorded", plan.summaryForUser);
		const failedTaskId = `task-1-${workflowId}`;
		writeEvidence(rootDir, workflowId, "task_failed", "task-failed-one", {
			schema_version: "flowdesk.task_failed.v1",
			workflow_id: workflowId,
			lane_id: "lane-failed-one",
			task_id: failedTaskId,
			agent_ref: "agent-test",
			provider_qualified_model_id: "openai/gpt-5.5",
			failure_category: "unknown",
			redacted_reason: "sdk invocation failed",
			created_at: "2026-05-29T00:00:00.000Z",
			dispatch_authority_enabled: false,
		});

		const result = executeFlowDeskAutoContinuePreviewToolV1({ config: { rootDir }, request: { workflowId } });
		assert.equal(result.status, "blocked_before_auto_continue_preview");
		assert.equal(result.nextTaskId, undefined);
		assert.equal(result.pendingTaskCount, 1);
		assert.equal(result.completedTaskCount, 0);
		assert.equal(result.blockedTaskCount, 1);
		assert.match(String(result.redactedBlockReason), /terminal incomplete evidence: task_failed/);
		assert.equal(result.safeNextActions.includes("/flowdesk-retry"), true);
	} finally {
		rmSync(rootDir, { recursive: true, force: true });
	}
});

test("auto-continue preview treats task_result as completed even when older failure evidence exists", () => {
	const rootDir = mkdtempSync(join(tmpdir(), "flowdesk-auto-continue-preview-completed-wins-"));
	try {
		const workflowId = "workflow-auto-continue-preview-completed-wins-1";
		const plan = executeFlowDeskWorkflowDispatchPlanToolV1({
			config: { rootDir },
			request: {
				workflowId,
				goalSummary: "Continue durable planned work",
				tasks: [{ agentRole: "implementation", title: "Completed task", summary: "Done" }],
			},
			now: () => new Date("2026-05-29T00:00:00.000Z"),
		});
		assert.equal(plan.status, "workflow_dispatch_plan_recorded", plan.summaryForUser);
		const taskId = `task-1-${workflowId}`;
		writeEvidence(rootDir, workflowId, "task_failed", "task-failed-old", {
			schema_version: "flowdesk.task_failed.v1",
			workflow_id: workflowId,
			lane_id: "lane-one",
			task_id: taskId,
			failure_category: "invocation_failed",
			redacted_reason: "old failure",
			created_at: "2026-05-29T00:00:00.000Z",
		});
		writeEvidence(rootDir, workflowId, "task_result", "task-result-new", {
			schema_version: "flowdesk.task_result.v1",
			workflow_id: workflowId,
			lane_id: "lane-one",
			task_id: taskId,
			agent_ref: "agent-test",
			provider_qualified_model_id: "openai/gpt-5.5",
			task_prompt_sha256: "a".repeat(64),
			result_text: "done",
			result_text_truncated: false,
			result_text_sha256: "b".repeat(64),
			completion_status: "final",
			output_kind: "final_answer",
			usable_for_synthesis: true,
			created_at: "2026-05-29T00:01:00.000Z",
			dispatch_authority_enabled: false,
		});

		const result = executeFlowDeskAutoContinuePreviewToolV1({ config: { rootDir }, request: { workflowId } });
		assert.equal(result.status, "auto_continue_preview_ready", result.summaryForUser);
		assert.equal(result.pendingTaskCount, 0);
		assert.equal(result.completedTaskCount, 1);
		assert.equal(result.blockedTaskCount, undefined);
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
