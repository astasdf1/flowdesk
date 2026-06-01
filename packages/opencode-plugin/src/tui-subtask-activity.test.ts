import assert from "node:assert/strict";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import {
	formatFlowDeskTuiAutoNextReadyCompactLines,
	formatFlowDeskTuiLatestSynthesisCompactLines,
	formatFlowDeskTuiSubtaskActivityCompactLines,
	loadFlowDeskTuiAutoNextReadyViewV1,
	loadFlowDeskTuiLatestSynthesisViewV1,
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
							taskSummary: "Repo scan",
							state: "running",
							classification: "progressing_normal",
							startedAt: "2026-05-29T00:00:00.000Z",
							recoveryActionRefs: ["/flowdesk-status", "/flowdesk-export-debug"],
						},
						{
							workflowId: "workflow-one",
							laneId: "lane-task-failed-1234567890",
							state: "invocation_failed",
							classification: "terminal",
							startedAt: "2026-05-29T00:00:00.000Z",
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
			"… 09:00 Repo scan",
			"✕ 09:00 task d-1234567890",
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

test("TUI subtask activity view filters rows by current parent session when configured", () => {
	const root = mkdtempSync(join(tmpdir(), "flowdesk-tui-subtasks-session-"));
	try {
		const uiDir = join(root, ".flowdesk", "ui");
		mkdirSync(uiDir, { recursive: true });
		writeFileSync(
			join(uiDir, "subtask-activity-sidebar.json"),
			`${JSON.stringify({
				schema_version: "flowdesk.subtask_activity_sidebar_cache.v1",
				observed_at: "2026-05-29T00:00:00.000Z",
				expires_at: "2026-05-29T00:02:00.000Z",
				rows: [
					{ workflowId: "workflow-current", laneId: "lane-task-current", taskId: "task-current", parentSessionRef: "ses-current", state: "task_result", classification: "terminal", recoveryActionRefs: ["/flowdesk-status"] },
					{ workflowId: "workflow-other", laneId: "lane-task-other", taskId: "task-other", parentSessionRef: "ses-other", state: "task_result", classification: "terminal", recoveryActionRefs: ["/flowdesk-status"] },
				],
			}, null, 2)}\n`,
			"utf8",
		);

		const unfiltered = loadFlowDeskTuiSubtaskActivityViewV1({ rootDir: root, now: () => new Date("2026-05-29T00:01:00.000Z") });
		assert.equal(unfiltered.rows.length, 2);

		const filtered = loadFlowDeskTuiSubtaskActivityViewV1({ rootDir: root, currentParentSessionRef: "ses-current", now: () => new Date("2026-05-29T00:01:00.000Z") });
		assert.equal(filtered.rows.length, 1);
		assert.equal(filtered.rows[0]?.workflowId, "workflow-current");
	} finally {
		rmSync(root, { recursive: true, force: true });
	}
});

test("TUI subtask activity view matches raw and FlowDesk-wrapped session refs", () => {
	const root = mkdtempSync(join(tmpdir(), "flowdesk-tui-subtasks-session-wrap-"));
	try {
		const uiDir = join(root, ".flowdesk", "ui");
		mkdirSync(uiDir, { recursive: true });
		writeFileSync(
			join(uiDir, "subtask-activity-sidebar.json"),
			`${JSON.stringify({
				schema_version: "flowdesk.subtask_activity_sidebar_cache.v1",
				observed_at: "2026-05-29T00:00:00.000Z",
				expires_at: "2026-05-29T00:02:00.000Z",
				rows: [
					{ workflowId: "workflow-current", laneId: "lane-task-current", taskId: "task-current", parentSessionRef: "ses-ses_current", state: "running", classification: "progressing_normal", recoveryActionRefs: ["/flowdesk-status"] },
					{ workflowId: "workflow-other", laneId: "lane-task-other", taskId: "task-other", parentSessionRef: "ses-other", state: "running", classification: "progressing_normal", recoveryActionRefs: ["/flowdesk-status"] },
				],
			}, null, 2)}\n`,
			"utf8",
		);

		const filtered = loadFlowDeskTuiSubtaskActivityViewV1({ rootDir: root, currentParentSessionRef: "ses_current", now: () => new Date("2026-05-29T00:01:00.000Z") });
		assert.equal(filtered.rows.length, 1);
		assert.equal(filtered.rows[0]?.workflowId, "workflow-current");
	} finally {
		rmSync(root, { recursive: true, force: true });
	}
});

test("TUI subtask activity view does not leak cached rows when session filter has no match", () => {
	const root = mkdtempSync(join(tmpdir(), "flowdesk-tui-subtasks-session-fallback-"));
	try {
		const uiDir = join(root, ".flowdesk", "ui");
		mkdirSync(uiDir, { recursive: true });
		writeFileSync(
			join(uiDir, "subtask-activity-sidebar.json"),
			`${JSON.stringify({
				schema_version: "flowdesk.subtask_activity_sidebar_cache.v1",
				observed_at: "2026-05-29T00:00:00.000Z",
				expires_at: "2026-05-29T00:02:00.000Z",
				rows: [
					{ workflowId: "workflow-unscoped", laneId: "lane-task-unscoped", taskId: "task-unscoped", state: "running", classification: "progressing_normal", recoveryActionRefs: ["/flowdesk-status"] },
				],
			}, null, 2)}\n`,
			"utf8",
		);

		const view = loadFlowDeskTuiSubtaskActivityViewV1({ rootDir: root, currentParentSessionRef: "ses-current", now: () => new Date("2026-05-29T00:01:00.000Z") });
		assert.equal(view.rows.length, 0);
		assert.equal(view.redactedReason, "no subtask activity rows cached");
	} finally {
		rmSync(root, { recursive: true, force: true });
	}
});

test("TUI auto-next ready view does not leak cached workflows when session filter has no match", () => {
	const root = mkdtempSync(join(tmpdir(), "flowdesk-tui-auto-next-session-no-leak-"));
	try {
		const uiDir = join(root, ".flowdesk", "ui");
		mkdirSync(uiDir, { recursive: true });
		writeFileSync(
			join(uiDir, "auto-next-ready.json"),
			`${JSON.stringify({
				schema_version: "flowdesk.auto_next_ready_cache.v1",
				observed_at: "2026-05-29T00:00:00.000Z",
				expires_at: "2026-05-29T00:02:00.000Z",
				workflows: [
					{ workflowId: "workflow-other", parentSessionRef: "ses-other", laneProgressAggregate: { expected: 1, normalCompleted: 1, nextActionAvailable: true, nextActionKind: "synthesis" }, taskResultRefs: ["task-other"], taskSummaries: ["Other"] },
				],
			}, null, 2)}\n`,
			"utf8",
		);

		const view = loadFlowDeskTuiAutoNextReadyViewV1({ rootDir: root, currentParentSessionRef: "ses-current", now: () => new Date("2026-05-29T00:01:00.000Z") });
		assert.equal(view.workflows.length, 0);
		assert.equal(view.redactedReason, "no auto-next ready workflows cached");
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
			{ workflowId: "w", laneId: "lane-task-done-1", taskId: "task-done-1", taskSummary: "Review API", state: "task_result", classification: "terminal", startedAt: "2026-05-29T00:05:00.000Z", recoveryActionRefs: ["/flowdesk-status", "/flowdesk-export-debug"] },
			{ workflowId: "w", laneId: "lane-task-final-1", taskId: "task-final-1", state: "running", classification: "progressing_normal", progressPhase: "finalizing", recoveryActionRefs: ["/flowdesk-status", "/flowdesk-export-debug"] },
			{ workflowId: "w", laneId: "lane-task-perm-1", taskId: "task-perm-1", state: "running", classification: "progressing_normal", progressPhase: "awaiting_permission", recoveryActionRefs: ["/flowdesk-status"] },
			{ workflowId: "w", laneId: "lane-task-slow-1", taskId: "task-slow-1", state: "running", classification: "progressing_late", recoveryActionRefs: ["/flowdesk-status", "/flowdesk-export-debug"] },
			{ workflowId: "w", laneId: "lane-task-stall-1", taskId: "task-stall-1", state: "running", classification: "stalled", recoveryActionRefs: ["/flowdesk-status", "/flowdesk-retry", "/flowdesk-resume", "/flowdesk-abort"] },
		],
	}, 5);
	assert.deepEqual(lines, [
		"Subtasks:",
		"! --:-- task perm-1",
		"!! --:-- task stall-1",
		"! --:-- task slow-1",
		"… --:-- task final-1",
		"✓ 09:05 Review API",
	]);
});

test("TUI subtask activity compact lines distinguish duplicate summaries with start times", () => {
	const lines = formatFlowDeskTuiSubtaskActivityCompactLines({
		status: "loaded",
		observedAt: "2026-05-29T00:00:00.000Z",
		rootDir: ".flowdesk",
		safeNextActions: ["/flowdesk-status", "/flowdesk-export-debug", "/flowdesk-doctor"],
		rows: [
			{ workflowId: "w", laneId: "lane-task-smoke-111111", taskId: "task-smoke-111111", taskSummary: "Live smoke", state: "task_result", classification: "terminal", startedAt: "2026-05-29T00:11:00.000Z", recoveryActionRefs: ["/flowdesk-status", "/flowdesk-export-debug"] },
			{ workflowId: "w", laneId: "lane-task-smoke-222222", taskId: "task-smoke-222222", taskSummary: "Live smoke", state: "task_result", classification: "terminal", startedAt: "2026-05-29T00:12:00.000Z", recoveryActionRefs: ["/flowdesk-status", "/flowdesk-export-debug"] },
		],
	}, 5);
	assert.deepEqual(lines, [
		"Subtasks:",
		"✓ 09:12 Live smoke",
		"✓ 09:11 Live smoke",
	]);
});

test("TUI subtask activity compact lines keep four-word titles up to forty chars", () => {
	const lines = formatFlowDeskTuiSubtaskActivityCompactLines({
		status: "loaded",
		observedAt: "2026-05-29T00:00:00.000Z",
		rootDir: ".flowdesk",
		safeNextActions: ["/flowdesk-status", "/flowdesk-export-debug", "/flowdesk-doctor"],
		rows: [
			{ workflowId: "w", laneId: "lane-task-title-1", taskId: "task-title-1", taskSummary: "Investigate password reset delivery pipeline", state: "running", classification: "progressing_normal", startedAt: "2026-05-29T00:13:00.000Z", recoveryActionRefs: ["/flowdesk-status"] },
		],
	}, 5);
	assert.deepEqual(lines, [
		"Subtasks:",
		"… 09:13 Investigate password reset delivery pipe",
	]);
});

test("TUI subtask activity compact lines prefer newer rows before state priority", () => {
	const lines = formatFlowDeskTuiSubtaskActivityCompactLines({
		status: "loaded",
		observedAt: "2026-05-29T00:00:00.000Z",
		rootDir: ".flowdesk",
		safeNextActions: ["/flowdesk-status", "/flowdesk-export-debug", "/flowdesk-doctor"],
		rows: [
			{ workflowId: "w", laneId: "lane-task-old-done", taskId: "task-old-done", taskSummary: "Old done", state: "task_result", classification: "terminal", progressPhase: "finalizing", lastObservedAt: "2026-05-29T00:01:00.000Z", recoveryActionRefs: ["/flowdesk-status", "/flowdesk-export-debug"] },
			{ workflowId: "w", laneId: "lane-task-new-run", taskId: "task-new-run", taskSummary: "New run", state: "running", classification: "progressing_normal", progressPhase: "waiting", lastObservedAt: "2026-05-29T00:02:00.000Z", recoveryActionRefs: ["/flowdesk-status", "/flowdesk-export-debug"] },
		],
	}, 5);
	assert.deepEqual(lines, [
		"Subtasks:",
		"… 09:02 New run",
		"✓ 09:01 Old done",
	]);
});

test("TUI subtask activity compact lines mark stale cache freshness", () => {
	assert.deepEqual(formatFlowDeskTuiSubtaskActivityCompactLines({
		status: "stale",
		observedAt: "2026-05-29T00:00:00.000Z",
		rootDir: ".flowdesk",
		safeNextActions: ["/flowdesk-status", "/flowdesk-export-debug", "/flowdesk-doctor"],
		rows: [],
	}), ["Subtasks: cache stale; run /flowdesk-status"]);

	assert.deepEqual(formatFlowDeskTuiSubtaskActivityCompactLines({
		status: "stale",
		observedAt: "2026-05-29T00:00:00.000Z",
		rootDir: ".flowdesk",
		safeNextActions: ["/flowdesk-status", "/flowdesk-export-debug", "/flowdesk-doctor"],
		rows: [
			{ workflowId: "w", laneId: "lane-task-running-1", taskSummary: "Repo scan", state: "running", classification: "progressing_normal", recoveryActionRefs: ["/flowdesk-status"] },
		],
	}), [
		"Subtasks (stale):",
		"… --:-- Repo scan",
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
					parentSessionRef: "ses-current",
					laneProgressAggregate: { expected: 2, normalCompleted: 2, autoNextStepEligible: true, nextActionAvailable: true, nextActionKind: "synthesis" },
					taskResultRefs: ["task-a", "task-b"],
					taskSummaries: ["Review API"],
					nextActionKind: "synthesis",
				}],
			}, null, 2)}\n`,
			"utf8",
		);
		const view = loadFlowDeskTuiAutoNextReadyViewV1({ rootDir: root, now: () => new Date("2026-05-29T00:01:00.000Z") });
		assert.equal(view.status, "loaded");
		assert.equal(view.workflows.length, 1);
		assert.deepEqual(formatFlowDeskTuiAutoNextReadyCompactLines(view), []);
	} finally {
		rmSync(root, { recursive: true, force: true });
	}
});

test("TUI auto-next ready view filters workflows by current parent session when configured", () => {
	const root = mkdtempSync(join(tmpdir(), "flowdesk-tui-auto-next-session-"));
	try {
		const uiDir = join(root, ".flowdesk", "ui");
		mkdirSync(uiDir, { recursive: true });
		writeFileSync(
			join(uiDir, "auto-next-ready.json"),
			`${JSON.stringify({
				schema_version: "flowdesk.auto_next_ready_cache.v1",
				observed_at: "2026-05-29T00:00:00.000Z",
				expires_at: "2026-05-29T00:02:00.000Z",
				workflows: [
					{ workflowId: "workflow-current", parentSessionRef: "ses-current", laneProgressAggregate: { expected: 1, normalCompleted: 1, nextActionAvailable: true, nextActionKind: "synthesis" }, taskResultRefs: ["task-current"], taskSummaries: ["Current"] },
					{ workflowId: "workflow-other", parentSessionRef: "ses-other", laneProgressAggregate: { expected: 1, normalCompleted: 1, nextActionAvailable: true, nextActionKind: "synthesis" }, taskResultRefs: ["task-other"], taskSummaries: ["Other"] },
				],
			}, null, 2)}\n`,
			"utf8",
		);

		const unfiltered = loadFlowDeskTuiAutoNextReadyViewV1({ rootDir: root, now: () => new Date("2026-05-29T00:01:00.000Z") });
		assert.equal(unfiltered.workflows.length, 2);

		const filtered = loadFlowDeskTuiAutoNextReadyViewV1({ rootDir: root, currentParentSessionRef: "ses-current", now: () => new Date("2026-05-29T00:01:00.000Z") });
		assert.equal(filtered.workflows.length, 1);
		assert.equal(filtered.workflows[0]?.workflowId, "workflow-current");
	} finally {
		rmSync(root, { recursive: true, force: true });
	}
});

test("TUI auto-next ready compact lines mark stale cache freshness", () => {
	assert.deepEqual(formatFlowDeskTuiAutoNextReadyCompactLines({
		status: "stale",
		observedAt: "2026-05-29T00:00:00.000Z",
		rootDir: ".flowdesk",
		safeNextActions: ["/flowdesk-status", "/flowdesk-export-debug", "/flowdesk-doctor"],
		workflows: [{
			workflowId: "workflow-stale-ready",
			expected: 1,
			completed: 1,
			taskResultRefs: ["task-result-1"],
			taskSummaries: ["Review API"],
			nextActionKind: "synthesis",
			nextActionAvailable: true,
		}],
	}), []);
});

test("TUI latest synthesis view renders cached display-only synthesis", () => {
	const root = mkdtempSync(join(tmpdir(), "flowdesk-tui-synthesis-"));
	try {
		const uiDir = join(root, ".flowdesk", "ui");
		mkdirSync(uiDir, { recursive: true });
		writeFileSync(
			join(uiDir, "latest-synthesis.json"),
			`${JSON.stringify({
				schema_version: "flowdesk.latest_synthesis_cache.v1",
				observed_at: "2026-05-29T00:00:00.000Z",
				expires_at: "2026-05-29T00:02:00.000Z",
				syntheses: [{
					workflowId: "workflow-synthesis-1",
					synthesisId: "synthesis-1",
					tasksSummarized: 1,
					conflictDetected: false,
					summaryPreview: "Provider-free synthesis preview complete.",
					observedAt: "2026-05-29T00:00:00.000Z",
				}],
				authority: { displayOnly: true, realOpenCodeDispatch: false, providerCall: false, runtimeExecution: false, actualLaneLaunch: false, fallbackAuthority: false, hardCancelOrNoReplyAuthority: false },
			}, null, 2)}\n`,
			"utf8",
		);
		const view = loadFlowDeskTuiLatestSynthesisViewV1({ rootDir: root, now: () => new Date("2026-05-29T00:01:00.000Z") });
		assert.equal(view.status, "loaded");
		assert.equal(view.syntheses.length, 1);
		assert.deepEqual(formatFlowDeskTuiLatestSynthesisCompactLines(view), [
			"Synthesis:",
			"✓ 1 task Provider-free synthesis pre…",
		]);
	} finally {
		rmSync(root, { recursive: true, force: true });
	}
});
