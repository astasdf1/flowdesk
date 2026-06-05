import assert from "node:assert/strict";
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import {
	formatFlowDeskTuiAutoNextReadyCompactLines,
	formatFlowDeskTuiCompletionWakeNoticeCompactLines,
	formatFlowDeskTuiLatestSynthesisCompactLines,
	formatFlowDeskTuiSubtaskActivityCompactLines,
	loadFlowDeskTuiAutoNextReadyViewV1,
	loadFlowDeskTuiCompletionWakeNoticeViewV1,
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

test("TUI subtask activity renders effective nudge count from cache", () => {
	const root = mkdtempSync(join(tmpdir(), "flowdesk-tui-subtasks-nudge-"));
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
					{ workflowId: "workflow-nudge", laneId: "lane-task-nudge", taskId: "task-nudge", state: "running", classification: "progressing_normal", startedAt: "2026-05-29T00:00:00.000Z", nudgeCount: 1, rawNudgeCount: 2, recoveryActionRefs: ["/flowdesk-status"] },
				],
			}, null, 2)}\n`,
			"utf8",
		);

		const view = loadFlowDeskTuiSubtaskActivityViewV1({ rootDir: root, now: () => new Date("2026-05-29T00:01:00.000Z") });
		assert.equal(view.rows[0]?.nudgeCount, 1);
		assert.equal(view.rows[0]?.rawNudgeCount, 2);
		assert.deepEqual(formatFlowDeskTuiSubtaskActivityCompactLines(view), [
			"Subtasks:",
			"… 09:00 task nudge n1",
		]);
	} finally {
		rmSync(root, { recursive: true, force: true });
	}
});

test("TUI subtask activity truncates sidebar task summaries to 25 chars and 5 words", () => {
	const root = mkdtempSync(join(tmpdir(), "flowdesk-tui-subtasks-label-width-"));
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
					{ workflowId: "workflow-label-width", laneId: "lane-task-label-width", taskSummary: "123456789012345678901234567890", state: "running", classification: "progressing_normal", startedAt: "2026-05-29T00:00:00.000Z", recoveryActionRefs: ["/flowdesk-status"] },
				],
			}, null, 2)}\n`,
			"utf8",
		);

		const view = loadFlowDeskTuiSubtaskActivityViewV1({ rootDir: root, now: () => new Date("2026-05-29T00:01:00.000Z") });
		assert.deepEqual(formatFlowDeskTuiSubtaskActivityCompactLines(view), [
			"Subtasks:",
			"… 09:00 1234567890123456789012345",
		]);

		const wordLimitedRoot = mkdtempSync(join(tmpdir(), "flowdesk-tui-subtasks-label-words-"));
		const wordLimitedUiDir = join(wordLimitedRoot, ".flowdesk", "ui");
		mkdirSync(wordLimitedUiDir, { recursive: true });
		writeFileSync(
			join(wordLimitedUiDir, "subtask-activity-sidebar.json"),
			`${JSON.stringify({
				schema_version: "flowdesk.subtask_activity_sidebar_cache.v1",
				observed_at: "2026-05-29T00:00:00.000Z",
				expires_at: "2026-05-29T00:02:00.000Z",
				rows: [
					{ workflowId: "workflow-label-words", laneId: "lane-task-label-words", taskSummary: "one two three four five six", state: "running", classification: "progressing_normal", startedAt: "2026-05-29T00:00:00.000Z", recoveryActionRefs: ["/flowdesk-status"] },
				],
			}, null, 2)}\n`,
			"utf8",
		);
		try {
			const wordLimitedView = loadFlowDeskTuiSubtaskActivityViewV1({ rootDir: wordLimitedRoot, now: () => new Date("2026-05-29T00:01:00.000Z") });
			assert.deepEqual(formatFlowDeskTuiSubtaskActivityCompactLines(wordLimitedView), [
				"Subtasks:",
				"… 09:00 one two three four five",
			]);
		} finally {
			rmSync(wordLimitedRoot, { recursive: true, force: true });
		}
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

test("TUI subtask activity view matches double-wrapped ses-ses_ row against raw current session (sidebar running-visibility regression)", () => {
	const root = mkdtempSync(join(tmpdir(), "flowdesk-tui-subtasks-double-wrap-"));
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
					// Real evidence stores parent_session_ref as the FlowDesk wrapper of
					// the raw OpenCode id, i.e. `ses-` + `ses_...` => double-token
					// `ses-ses_...`. The running lane must remain visible while the TUI
					// passes the raw `ses_...` current session id.
					{ workflowId: "workflow-running", laneId: "lane-task-running", taskId: "task-running", parentSessionRef: "ses-ses_17f8b9f7affe", state: "running", classification: "progressing_normal", recoveryActionRefs: ["/flowdesk-status"] },
					{ workflowId: "workflow-other", laneId: "lane-task-other", taskId: "task-other", parentSessionRef: "ses-ses_other", state: "running", classification: "progressing_normal", recoveryActionRefs: ["/flowdesk-status"] },
				],
			}, null, 2)}\n`,
			"utf8",
		);

		// raw current id matches the double-wrapped row, other session stays scoped out
		const rawCurrent = loadFlowDeskTuiSubtaskActivityViewV1({ rootDir: root, currentParentSessionRef: "ses_17f8b9f7affe", now: () => new Date("2026-05-29T00:01:00.000Z") });
		assert.equal(rawCurrent.rows.length, 1);
		assert.equal(rawCurrent.rows[0]?.workflowId, "workflow-running");

		// single-wrapped current id also matches the double-wrapped row
		const singleWrappedCurrent = loadFlowDeskTuiSubtaskActivityViewV1({ rootDir: root, currentParentSessionRef: "ses-ses_17f8b9f7affe", now: () => new Date("2026-05-29T00:01:00.000Z") });
		assert.equal(singleWrappedCurrent.rows.length, 1);
		assert.equal(singleWrappedCurrent.rows[0]?.workflowId, "workflow-running");
	} finally {
		rmSync(root, { recursive: true, force: true });
	}
});

test("TUI subtask activity view does not collapse distinct sessions to the same canonical core (no cross-session leak)", () => {
	const root = mkdtempSync(join(tmpdir(), "flowdesk-tui-subtasks-no-collision-"));
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
					{ workflowId: "workflow-a", laneId: "lane-a", taskId: "task-a", parentSessionRef: "ses-ses_aaa", state: "running", classification: "progressing_normal", recoveryActionRefs: ["/flowdesk-status"] },
					{ workflowId: "workflow-b", laneId: "lane-b", taskId: "task-b", parentSessionRef: "ses-ses_bbb", state: "running", classification: "progressing_normal", recoveryActionRefs: ["/flowdesk-status"] },
				],
			}, null, 2)}\n`,
			"utf8",
		);

		// Current session aaa must see ONLY workflow-a, never workflow-b. Canonical
		// strips only leading `ses-` wrapper layers, so the raw `ses_aaa`/`ses_bbb`
		// cores stay distinct and the fail-closed scope does not leak.
		const view = loadFlowDeskTuiSubtaskActivityViewV1({ rootDir: root, currentParentSessionRef: "ses_aaa", now: () => new Date("2026-05-29T00:01:00.000Z") });
		assert.equal(view.rows.length, 1);
		assert.equal(view.rows[0]?.workflowId, "workflow-a");
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
		"✓ 09:05 Review API",
		"! --:-- task perm-1",
		"!! --:-- task stall-1",
		"! --:-- task slow-1",
		"… --:-- task final-1",
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

test("TUI subtask activity keeps completed rows ordered and displayed by start time metadata", () => {
	const view = {
		status: "loaded" as const,
		observedAt: "2026-05-29T00:00:00.000Z",
		rootDir: ".flowdesk",
		safeNextActions: ["/flowdesk-status", "/flowdesk-export-debug", "/flowdesk-doctor"] as const,
		rows: [
			{ workflowId: "w", laneId: "lane-task-old-start", taskId: "task-old-start", taskSummary: "Old start", state: "task_result", classification: "terminal" as const, startedAt: "2026-05-29T00:01:00.000Z", completedAt: "2026-05-29T00:10:00.000Z", durationMs: 540_000, lastObservedAt: "2026-05-29T00:10:00.000Z", recoveryActionRefs: ["/flowdesk-status", "/flowdesk-export-debug"] },
			{ workflowId: "w", laneId: "lane-task-new-start", taskId: "task-new-start", taskSummary: "New start", state: "running", classification: "progressing_normal" as const, startedAt: "2026-05-29T00:05:00.000Z", lastObservedAt: "2026-05-29T00:06:00.000Z", recoveryActionRefs: ["/flowdesk-status", "/flowdesk-export-debug"] },
		],
	};

	assert.deepEqual(formatFlowDeskTuiSubtaskActivityCompactLines(view, 5), [
		"Subtasks:",
		"… 09:05 New start",
		"✓ 09:01 Old start",
	]);
	assert.equal(view.rows[0].completedAt, "2026-05-29T00:10:00.000Z");
	assert.equal(view.rows[0].durationMs, 540_000);
});

test("TUI subtask activity compact lines keep titles compact enough for one line", () => {
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
		"… 09:13 Investigate password rese",
	]);
});

test("TUI subtask activity compact lines support a three-row sidebar cap", () => {
	const lines = formatFlowDeskTuiSubtaskActivityCompactLines({
		status: "loaded",
		observedAt: "2026-05-29T00:00:00.000Z",
		rootDir: ".flowdesk",
		safeNextActions: ["/flowdesk-status", "/flowdesk-export-debug", "/flowdesk-doctor"],
		rows: [
			{ workflowId: "w", laneId: "lane-task-one", taskId: "task-one", taskSummary: "One", state: "running", classification: "progressing_normal", lastObservedAt: "2026-05-29T00:01:00.000Z", recoveryActionRefs: ["/flowdesk-status"] },
			{ workflowId: "w", laneId: "lane-task-two", taskId: "task-two", taskSummary: "Two", state: "running", classification: "progressing_normal", lastObservedAt: "2026-05-29T00:02:00.000Z", recoveryActionRefs: ["/flowdesk-status"] },
			{ workflowId: "w", laneId: "lane-task-three", taskId: "task-three", taskSummary: "Three", state: "running", classification: "progressing_normal", lastObservedAt: "2026-05-29T00:03:00.000Z", recoveryActionRefs: ["/flowdesk-status"] },
			{ workflowId: "w", laneId: "lane-task-four", taskId: "task-four", taskSummary: "Four", state: "running", classification: "progressing_normal", lastObservedAt: "2026-05-29T00:04:00.000Z", recoveryActionRefs: ["/flowdesk-status"] },
		],
	}, 3);
	assert.deepEqual(lines, [
		"Subtasks:",
		"… 09:04 Four",
		"… 09:03 Three",
		"… 09:02 Two",
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

test("TUI completion wake consumer consumes ready rows and renders main-session notice", () => {
	const root = mkdtempSync(join(tmpdir(), "flowdesk-tui-wake-consumer-"));
	try {
		const uiDir = join(root, ".flowdesk", "ui");
		mkdirSync(uiDir, { recursive: true });
		writeFileSync(
			join(uiDir, "completion-wake-ready.json"),
			`${JSON.stringify({
				schema_version: "flowdesk.completion_wake_ready_cache.v1",
				observed_at: "2026-05-29T00:00:00.000Z",
				expires_at: "2026-05-29T00:02:00.000Z",
				rows: [{
					workflowId: "workflow-wake-current",
					parentSessionRef: "ses-current",
					completionKind: "auto_next_ready",
					readyAt: "2026-05-29T00:00:30.000Z",
					dedupeKey: "ses-current\u0000workflow-wake-current",
					consumptionKey: "ses-current:workflow-wake-current:2026-05-29T00:00:30.000Z:1:0",
					consumed: false,
					laneIds: ["lane-a"],
					taskResultRefs: ["task-a"],
					taskFailedRefs: [],
					taskSummaries: ["Review API"],
					notificationLabel: "FlowDesk synthesis ready",
					nextActionRefs: ["/flowdesk-status", "/flowdesk-export-debug"],
				}],
			}, null, 2)}\n`,
			"utf8",
		);

		const view = loadFlowDeskTuiCompletionWakeNoticeViewV1({ rootDir: root, currentParentSessionRef: "ses-current", now: () => new Date("2026-05-29T00:01:00.000Z") });
		assert.equal(view.status, "loaded");
		assert.equal(view.notices.length, 1);
		assert.deepEqual(formatFlowDeskTuiCompletionWakeNoticeCompactLines(view), ["FlowDesk ready:", "✓ continue: Review API"]);

		const ready = JSON.parse(readFileSync(join(uiDir, "completion-wake-ready.json"), "utf8")) as { rows: Array<{ consumed?: boolean; consumedAt?: string }> };
		assert.equal(ready.rows[0]?.consumed, true);
		assert.equal(ready.rows[0]?.consumedAt, "2026-05-29T00:01:00.000Z");

		const second = loadFlowDeskTuiCompletionWakeNoticeViewV1({ rootDir: root, currentParentSessionRef: "ses-current", now: () => new Date("2026-05-29T00:01:10.000Z") });
		assert.equal(second.notices.length, 1, "consumed notice remains visible from notification cache");
	} finally {
		rmSync(root, { recursive: true, force: true });
	}
});

test("TUI completion wake consumer does not consume other session rows", () => {
	const root = mkdtempSync(join(tmpdir(), "flowdesk-tui-wake-session-"));
	try {
		const uiDir = join(root, ".flowdesk", "ui");
		mkdirSync(uiDir, { recursive: true });
		writeFileSync(
			join(uiDir, "completion-wake-ready.json"),
			`${JSON.stringify({
				schema_version: "flowdesk.completion_wake_ready_cache.v1",
				observed_at: "2026-05-29T00:00:00.000Z",
				expires_at: "2026-05-29T00:02:00.000Z",
				rows: [{
					workflowId: "workflow-wake-other",
					parentSessionRef: "ses-other",
					completionKind: "auto_next_ready",
					readyAt: "2026-05-29T00:00:30.000Z",
					dedupeKey: "ses-other\u0000workflow-wake-other",
					consumptionKey: "ses-other:workflow-wake-other:2026-05-29T00:00:30.000Z:1:0",
					consumed: false,
					taskSummaries: ["Other"],
				}],
			}, null, 2)}\n`,
			"utf8",
		);
		const view = loadFlowDeskTuiCompletionWakeNoticeViewV1({ rootDir: root, currentParentSessionRef: "ses-current", now: () => new Date("2026-05-29T00:01:00.000Z") });
		assert.equal(view.notices.length, 0);
		const ready = JSON.parse(readFileSync(join(uiDir, "completion-wake-ready.json"), "utf8")) as { rows: Array<{ consumed?: boolean }> };
		assert.equal(ready.rows[0]?.consumed, false);
	} finally {
		rmSync(root, { recursive: true, force: true });
	}
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
