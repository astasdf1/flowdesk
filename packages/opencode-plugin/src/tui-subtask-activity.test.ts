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
			"…unning-1234567890 running/progressing_normal [status|export-debug]",
			"…failed-1234567890 invocation_failed/terminal [status|retry|resume|abort|export-debug]",
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
			"…o-next-ready-1234567890 2/2 done [status|export-debug]",
		]);
	} finally {
		rmSync(root, { recursive: true, force: true });
	}
});
