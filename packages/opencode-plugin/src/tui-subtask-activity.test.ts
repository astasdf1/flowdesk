import assert from "node:assert/strict";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import {
	formatFlowDeskTuiAutoNextReadyCompactLines,
	formatFlowDeskTuiSubtaskActivityCompactLines,
	loadFlowDeskTuiAutoNextReadyViewV1,
	loadFlowDeskTuiSubtaskActivityViewV1,
} from "./tui-subtask-activity.js";

test("TUI subtask activity view renders cached read-only rows", () => {
	const root = mkdtempSync(join(tmpdir(), "flowdesk-tui-subtasks-"));
	try {
		const uiDir = join(root, ".flowdesk", "ui");
		mkdirSync(uiDir, { recursive: true });
		writeFileSync(
			join(uiDir, "subtask-activity-sidebar.json"),
			`${JSON.stringify(
				{
					schema_version: "flowdesk.subtask_activity_sidebar_cache.v1",
					observed_at: "2026-05-29T00:00:00.000Z",
					expires_at: "2026-05-29T00:02:00.000Z",
					rows: [
						{
							workflowId: "workflow-one",
							laneId: "lane-task-running-1234567890",
							state: "running",
							classification: "progressing_normal",
							recoveryActionRefs: ["/flowdesk-status", "/flowdesk-export-debug"],
						},
						{
							workflowId: "workflow-one",
							laneId: "lane-task-failed-1234567890",
							state: "invocation_failed",
							classification: "terminal",
							recoveryActionRefs: ["/flowdesk-status", "/flowdesk-retry", "/flowdesk-resume", "/flowdesk-abort", "/flowdesk-export-debug"],
						},
					],
				},
				null,
				2,
			)}\n`,
			"utf8",
		);

		const view = loadFlowDeskTuiSubtaskActivityViewV1({
			rootDir: root,
			now: () => new Date("2026-05-29T00:01:00.000Z"),
		});
		assert.equal(view.status, "loaded");
		assert.equal(view.rows.length, 2);
		assert.deepEqual(formatFlowDeskTuiSubtaskActivityCompactLines(view), [
			"Subtasks:",
			"… Running task g-1234567890 [status|export]",
			"✕ Failed task d-1234567890 [status|retry|resume|abort|export]",
		]);
	} finally {
		rmSync(root, { recursive: true, force: true });
	}
});

test("TUI subtask activity view degrades to command fallback when cache is absent", () => {
	const root = mkdtempSync(join(tmpdir(), "flowdesk-tui-subtasks-missing-"));
	try {
		const view = loadFlowDeskTuiSubtaskActivityViewV1({ rootDir: root });
		assert.equal(view.status, "missing");
		assert.deepEqual(formatFlowDeskTuiSubtaskActivityCompactLines(view), ["Subtasks: run /flowdesk-status"]);
	} finally {
		rmSync(root, { recursive: true, force: true });
	}
});

test("TUI subtask activity compact lines use friendly labels for key states", () => {
	const lines = formatFlowDeskTuiSubtaskActivityCompactLines({
		status: "loaded",
		observedAt: "2026-05-29T00:00:00.000Z",
		rootDir: ".flowdesk",
		safeNextActions: ["/flowdesk-status", "/flowdesk-export-debug", "/flowdesk-doctor"],
		rows: [
			{ workflowId: "w", laneId: "lane-task-done-1", taskId: "task-done-1", state: "task_result", classification: "terminal", recoveryActionRefs: ["/flowdesk-status", "/flowdesk-export-debug"] },
			{ workflowId: "w", laneId: "lane-task-final-1", taskId: "task-final-1", state: "running", classification: "progressing_normal", progressPhase: "finalizing", recoveryActionRefs: ["/flowdesk-status", "/flowdesk-export-debug"] },
			{ workflowId: "w", laneId: "lane-task-perm-1", taskId: "task-perm-1", state: "running", classification: "progressing_normal", progressPhase: "awaiting_permission", recoveryActionRefs: ["/flowdesk-status"] },
			{ workflowId: "w", laneId: "lane-task-slow-1", taskId: "task-slow-1", state: "running", classification: "progressing_late", recoveryActionRefs: ["/flowdesk-status", "/flowdesk-export-debug"] },
			{ workflowId: "w", laneId: "lane-task-stall-1", taskId: "task-stall-1", state: "running", classification: "stalled", recoveryActionRefs: ["/flowdesk-status", "/flowdesk-retry", "/flowdesk-resume", "/flowdesk-abort"] },
		],
	}, 5);
	assert.deepEqual(lines, [
		"Subtasks:",
		"! Needs permission task perm-1 [status]",
		"!! Stalled task stall-1 [status|retry|resume|abort]",
		"! Slow task slow-1 [status|export]",
		"… Finalizing task final-1 [status|export]",
		"✓ Done task done-1 [status|export]",
	]);
});

test("TUI auto-next ready view renders cached ready workflows", () => {
	const root = mkdtempSync(join(tmpdir(), "flowdesk-tui-auto-next-"));
	try {
		const uiDir = join(root, ".flowdesk", "ui");
		mkdirSync(uiDir, { recursive: true });
		writeFileSync(
			join(uiDir, "auto-next-ready.json"),
			`${JSON.stringify({
				schema_version: "flowdesk.auto_next_ready_cache.v1",
				observed_at: "2026-05-29T00:00:00.000Z",
				expires_at: "2026-05-29T00:02:00.000Z",
				workflows: [{
					workflowId: "workflow-auto-next-ready-1234567890",
					laneProgressAggregate: { expected: 2, normalCompleted: 2, autoNextStepEligible: true },
					taskResultRefs: ["task-a", "task-b"],
				}],
			}, null, 2)}\n`,
			"utf8",
		);
		const view = loadFlowDeskTuiAutoNextReadyViewV1({ rootDir: root, now: () => new Date("2026-05-29T00:01:00.000Z") });
		assert.equal(view.status, "loaded");
		assert.equal(view.workflows.length, 1);
		assert.deepEqual(formatFlowDeskTuiAutoNextReadyCompactLines(view), [
			"Auto-next ready:",
			"✓ 2/2 done …o-next-ready-1234567890 [status|export]",
		]);
	} finally {
		rmSync(root, { recursive: true, force: true });
	}
});
