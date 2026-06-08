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

test("completion UI cache task summaries strip common stop words before word limiting", () => {
	const rootDir = mkdtempSync(join(tmpdir(), "flowdesk-completion-stop-word-label-"));
	try {
		const workflowId = "workflow-labels-stop-words-1";
		const cases = [
			{
				laneId: "lane-task-labels-stop-command-1",
				taskId: "task-labels-stop-command-1",
				promptText: "Run `git log -1 --oneline` and return the result",
			},
			{
				laneId: "lane-task-labels-stop-fix-1",
				taskId: "task-labels-stop-fix-1",
				promptText: "Fix only in packages/opencode-plugin/src/completion-ui-cache.ts",
			},
			{
				laneId: "lane-task-labels-stop-fallback-1",
				taskId: "task-labels-stop-fallback-1",
				promptText: "only in the and or",
			},
		];

		for (const [index, entry] of cases.entries()) {
			writeEvidence(rootDir, workflowId, "agent_task_context", `context-labels-stop-${index + 1}`, {
				schema_version: "flowdesk.agent_task_context.v1",
				workflow_id: workflowId,
				lane_id: entry.laneId,
				task_id: entry.taskId,
				agent_ref: "agent-reviewer-gpt-frontier",
				provider_qualified_model_id: "openai/gpt-5.5",
				parent_session_ref: "ses-parent-labels-stop-1",
				prompt_text: entry.promptText,
				prompt_text_truncated: false,
				prompt_text_sha256: "a".repeat(64),
				redaction_version: "v1",
				created_at: `2026-05-29T00:00:0${index}.000Z`,
				dispatch_authority_enabled: false,
			});
			writeEvidence(rootDir, workflowId, "task_result", `task-result-labels-stop-${index + 1}`, taskResult(workflowId, entry.laneId, entry.taskId));
		}

		refreshFlowDeskCompletionUiCachesV1({ rootDir, workflowId, observedAt: "2026-05-29T00:01:00.000Z" });

		const sidebar = readCache(rootDir, "subtask-activity-sidebar.json");
		const rows = sidebar.rows as Array<Record<string, unknown>>;
		const commandRow = rows.find((row) => row.laneId === "lane-task-labels-stop-command-1");
		assert.ok(commandRow, "command row exists");
		assert.match(String(commandRow.taskSummary), /^git log -1 --oneline/);
		assert.doesNotMatch(String(commandRow.taskSummary), /^Run\b/i);

		const fixRow = rows.find((row) => row.laneId === "lane-task-labels-stop-fix-1");
		assert.ok(fixRow, "fix row exists");
		assert.match(String(fixRow.taskSummary), /^Fix\b/);
		assert.doesNotMatch(String(fixRow.taskSummary), /\bonly\b/i);
		assert.doesNotMatch(String(fixRow.taskSummary), /\bin\b/i);

		const fallbackRow = rows.find((row) => row.laneId === "lane-task-labels-stop-fallback-1");
		assert.ok(fallbackRow, "fallback row exists");
		assert.equal(fallbackRow.taskSummary, "only in the and or");
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
		const taskId = "task-wake-ready-1";
		writeEvidence(rootDir, workflowId, "agent_task_context", "context-wake-ready-1", {
			schema_version: "flowdesk.agent_task_context.v1",
			workflow_id: workflowId,
			lane_id: laneId,
			task_id: taskId,
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
		writeEvidence(rootDir, workflowId, "task_result", "task-result-wake-ready-1", taskResult(workflowId, laneId, taskId, "2026-05-29T00:02:00.000Z"));

		refreshFlowDeskCompletionUiCachesV1({ rootDir, workflowId, observedAt: "2026-05-29T00:02:01.000Z" });

		const wake = readCache(rootDir, "completion-wake-ready.json");
		assert.equal(wake.schema_version, "flowdesk.completion_wake_ready_cache.v1");
		const rows = wake.rows as Array<Record<string, unknown>>;
		// Task-unit: one row per lane, not a workflow-level aggregate.
		assert.equal(rows.length, 1);
		assert.equal(rows[0].workflowId, workflowId);
		assert.equal(rows[0].parentSessionRef, "ses-parent-wake-ready-1");
		// Single usable task_result lane → auto_next_ready at task level.
		assert.equal(rows[0].completionKind, "auto_next_ready");
		assert.equal(rows[0].readyAt, "2026-05-29T00:02:00.000Z");
		// Task-unit dedupeKey includes laneId.
		assert.equal(rows[0].dedupeKey, `ses-parent-wake-ready-1\u0000${workflowId}\u0000${laneId}`);
		assert.equal(rows[0].consumed, false);
		assert.deepEqual(rows[0].taskResultRefs, [taskId]);
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

test("completion UI cache task-unit wake-ready row inherits parentSessionRef from child-session when context omits it", () => {
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
		// Task-unit dedupeKey includes laneId.
		assert.equal(rows[0].dedupeKey, `ses-parent-wake-parent-child-1\u0000${workflowId}\u0000${laneId}`);
	} finally {
		rmSync(rootDir, { recursive: true, force: true });
	}
});

test("completion UI cache partitions task-unit wake-ready rows by lane (one row per lane)", () => {
	const rootDir = mkdtempSync(join(tmpdir(), "flowdesk-completion-wake-origin-partition-"));
	try {
		const workflowId = "workflow-wake-origin-partition-1";
		const lanes = [
			{
				laneId: "lane-wake-origin-partition-a",
				taskId: "task-wake-origin-partition-a",
				parentSessionRef: "ses-parent-wake-origin-a",
				createdAt: "2026-06-08T00:00:00.000Z",
				readyAt: "2026-06-08T00:02:00.000Z",
			},
			{
				laneId: "lane-wake-origin-partition-b",
				taskId: "task-wake-origin-partition-b",
				parentSessionRef: "ses-parent-wake-origin-b",
				createdAt: "2026-06-08T00:00:01.000Z",
				readyAt: "2026-06-08T00:02:01.000Z",
			},
		];

		for (const lane of lanes) {
			writeEvidence(rootDir, workflowId, "agent_task_context", `context-${lane.taskId}`, {
				...agentTaskContext(workflowId, lane.laneId, lane.taskId, lane.createdAt),
				parent_session_ref: lane.parentSessionRef,
			});
			writeEvidence(rootDir, workflowId, "task_result", `result-${lane.taskId}`, taskResult(workflowId, lane.laneId, lane.taskId, lane.readyAt));
		}

		refreshFlowDeskCompletionUiCachesV1({ rootDir, workflowId, observedAt: "2026-06-08T00:02:02.000Z" });

		const wake = readCache(rootDir, "completion-wake-ready.json");
		const rows = (wake.rows as Array<Record<string, unknown>>)
			.filter((row) => row.workflowId === workflowId)
			.sort((a, b) => String(a.parentSessionRef).localeCompare(String(b.parentSessionRef)));
		// Task-unit: one row per lane, so 2 lanes → 2 rows even across same session.
		assert.equal(rows.length, 2, "task-unit wake-ready must produce one row per terminal lane");

		for (const lane of lanes) {
			const row = rows.find((candidate) => candidate.parentSessionRef === lane.parentSessionRef);
			assert.ok(row, `wake-ready row exists for ${lane.parentSessionRef}`);
			assert.equal(row!.completionKind, "auto_next_ready");
			// Task-unit dedupeKey includes laneId.
			assert.equal(row!.dedupeKey, `${lane.parentSessionRef}\u0000${workflowId}\u0000${lane.laneId}`);
			assert.deepEqual(row!.laneIds, [lane.laneId]);
			assert.deepEqual(row!.taskIds, [lane.taskId]);
			assert.deepEqual(row!.taskResultRefs, [lane.taskId]);
			assert.equal((row!.laneIds as string[]).every((laneId) => laneId === lane.laneId), true, "wake-ready row must list only the single lane");
		}
	} finally {
		rmSync(rootDir, { recursive: true, force: true });
	}
});

test("completion UI cache emits one task-unit wake-ready row per lane from the same origin", () => {
	const rootDir = mkdtempSync(join(tmpdir(), "flowdesk-completion-wake-same-origin-many-"));
	try {
		const workflowId = "workflow-wake-same-origin-many-1";
		const parentSessionRef = "ses-parent-wake-same-origin-many-a";
		const lanes = Array.from({ length: 5 }, (_, index) => ({
			laneId: `lane-wake-same-origin-many-${index + 1}`,
			taskId: `task-wake-same-origin-many-${index + 1}`,
			parentSessionRef,
			source: "context" as const,
			createdAt: `2026-06-08T01:00:0${index}.000Z`,
			readyAt: `2026-06-08T01:02:0${index}.000Z`,
		}));
		for (const lane of lanes) seedTerminalWakeLane(rootDir, workflowId, lane);

		refreshFlowDeskCompletionUiCachesV1({ rootDir, workflowId, observedAt: "2026-06-08T01:02:10.000Z" });

		const rows = wakeRowsForWorkflow(rootDir, workflowId);
		// Task-unit: 5 lanes → 5 rows, one per lane.
		assert.equal(rows.length, 5, "task-unit wake-ready must produce one row per terminal lane");
		for (const lane of lanes) {
			const row = rows.find((r) => Array.isArray(r.laneIds) && (r.laneIds as string[]).includes(lane.laneId));
			assert.ok(row, `row exists for lane ${lane.laneId}`);
			assert.equal(row!.parentSessionRef, parentSessionRef);
			assert.equal(row!.completionKind, "auto_next_ready");
			assert.equal(row!.dedupeKey, `${parentSessionRef}\u0000${workflowId}\u0000${lane.laneId}`);
			assertWakeRowMembership(row!, [lane.laneId], [lane.taskId], [lane.taskId], []);
		}
	} finally {
		rmSync(rootDir, { recursive: true, force: true });
	}
});

test("completion UI cache emits one task-unit wake-ready row per lane across two origin sessions", () => {
	const rootDir = mkdtempSync(join(tmpdir(), "flowdesk-completion-wake-two-origins-"));
	try {
		const workflowId = "workflow-wake-two-origins-1";
		const lanes = [
			{ laneId: "lane-wake-two-origins-a1", taskId: "task-wake-two-origins-a1", parentSessionRef: "ses-parent-wake-two-origins-a", source: "agent_task_child_session" as const, createdAt: "2026-06-08T02:00:00.000Z", readyAt: "2026-06-08T02:02:00.000Z" },
			{ laneId: "lane-wake-two-origins-a2", taskId: "task-wake-two-origins-a2", parentSessionRef: "ses-parent-wake-two-origins-a", source: "agent_task_child_session" as const, createdAt: "2026-06-08T02:00:01.000Z", readyAt: "2026-06-08T02:02:01.000Z" },
			{ laneId: "lane-wake-two-origins-b1", taskId: "task-wake-two-origins-b1", parentSessionRef: "ses-parent-wake-two-origins-b", source: "agent_task_child_session" as const, createdAt: "2026-06-08T02:00:02.000Z", readyAt: "2026-06-08T02:02:02.000Z" },
		];
		for (const lane of lanes) seedTerminalWakeLane(rootDir, workflowId, lane);

		refreshFlowDeskCompletionUiCachesV1({ rootDir, workflowId, observedAt: "2026-06-08T02:02:10.000Z" });

		const rows = wakeRowsForWorkflow(rootDir, workflowId);
		// Task-unit: 3 lanes → 3 rows regardless of how many origin sessions.
		assert.equal(rows.length, 3, "task-unit wake-ready must produce one row per terminal lane");
		for (const lane of lanes) {
			const row = rows.find((r) => Array.isArray(r.laneIds) && (r.laneIds as string[]).includes(lane.laneId));
			assert.ok(row, `row exists for lane ${lane.laneId}`);
			assert.equal(row!.parentSessionRef, lane.parentSessionRef, "each row must be scoped to its own origin session");
			assertWakeRowMembership(row!, [lane.laneId], [lane.taskId], [lane.taskId], []);
		}
	} finally {
		rmSync(rootDir, { recursive: true, force: true });
	}
});

test("completion UI cache scopes task-unit wake-ready dedupe and consumption keys per lane", () => {
	const rootDir = mkdtempSync(join(tmpdir(), "flowdesk-completion-wake-three-origins-"));
	try {
		const workflowId = "workflow-wake-three-origins-1";
		const lanes = [
			{ laneId: "lane-wake-three-origins-a", taskId: "task-wake-three-origins-a", parentSessionRef: "ses-parent-wake-three-origins-a", source: "lane_lifecycle" as const, createdAt: "2026-06-08T03:00:00.000Z", readyAt: "2026-06-08T03:02:00.000Z", failed: true },
			{ laneId: "lane-wake-three-origins-b", taskId: "task-wake-three-origins-b", parentSessionRef: "ses-parent-wake-three-origins-b", source: "lane_lifecycle" as const, createdAt: "2026-06-08T03:00:01.000Z", readyAt: "2026-06-08T03:02:01.000Z", failed: true },
			{ laneId: "lane-wake-three-origins-c", taskId: "task-wake-three-origins-c", parentSessionRef: "ses-parent-wake-three-origins-c", source: "lane_lifecycle" as const, createdAt: "2026-06-08T03:00:02.000Z", readyAt: "2026-06-08T03:02:02.000Z", failed: true },
		];
		for (const lane of lanes) seedTerminalWakeLane(rootDir, workflowId, lane);

		refreshFlowDeskCompletionUiCachesV1({ rootDir, workflowId, observedAt: "2026-06-08T03:02:10.000Z" });

		const rows = wakeRowsForWorkflow(rootDir, workflowId);
		// Task-unit: 3 lanes → 3 rows, each with its own laneId-scoped dedupeKey.
		assert.equal(rows.length, 3, "task-unit wake-ready must produce one row per terminal lane");
		assert.equal(new Set(rows.map((row) => row.dedupeKey)).size, 3, "dedupeKey must be distinct per lane");
		assert.equal(new Set(rows.map((row) => row.consumptionKey)).size, 3, "consumptionKey must be distinct per lane");
		for (const lane of lanes) {
			const row = rows.find((candidate) => Array.isArray(candidate.laneIds) && (candidate.laneIds as string[]).includes(lane.laneId));
			assert.ok(row, `wake-ready row exists for lane ${lane.laneId}`);
			// Task-unit dedupeKey includes laneId.
			assert.equal(row!.dedupeKey, `${lane.parentSessionRef}\u0000${workflowId}\u0000${lane.laneId}`);
			assert.match(String(row!.consumptionKey), new RegExp(`^${lane.parentSessionRef}:${workflowId}:${lane.laneId}:`));
			assert.equal(row!.completionKind, "task_failed");
			assertWakeRowMembership(row!, [lane.laneId], [lane.taskId], [], [lane.taskId]);
		}
	} finally {
		rmSync(rootDir, { recursive: true, force: true });
	}
});

test("completion UI cache emits one task-unit wake-ready row per lane including legacy no-origin lanes", () => {
	const rootDir = mkdtempSync(join(tmpdir(), "flowdesk-completion-wake-no-origin-residual-"));
	try {
		const workflowId = "workflow-wake-no-origin-residual-1";
		const lanes = [
			{ laneId: "lane-wake-no-origin-a", taskId: "task-wake-no-origin-a", parentSessionRef: "ses-parent-wake-no-origin-a", source: "context" as const, createdAt: "2026-06-08T04:00:00.000Z", readyAt: "2026-06-08T04:02:00.000Z" },
			{ laneId: "lane-wake-no-origin-b", taskId: "task-wake-no-origin-b", parentSessionRef: "ses-parent-wake-no-origin-b", source: "context" as const, createdAt: "2026-06-08T04:00:01.000Z", readyAt: "2026-06-08T04:02:01.000Z" },
			{ laneId: "lane-wake-no-origin-legacy-1", taskId: "task-wake-no-origin-legacy-1", source: "none" as const, createdAt: "2026-06-08T04:00:02.000Z", readyAt: "2026-06-08T04:02:02.000Z" },
			{ laneId: "lane-wake-no-origin-legacy-2", taskId: "task-wake-no-origin-legacy-2", source: "none" as const, createdAt: "2026-06-08T04:00:03.000Z", readyAt: "2026-06-08T04:02:03.000Z" },
		];
		for (const lane of lanes) seedTerminalWakeLane(rootDir, workflowId, lane);

		refreshFlowDeskCompletionUiCachesV1({ rootDir, workflowId, observedAt: "2026-06-08T04:02:10.000Z" });

		const rows = wakeRowsForWorkflow(rootDir, workflowId);
		// Task-unit: 4 lanes → 4 rows. No-origin (no parentSessionRef) lanes each get their own row.
		assert.equal(rows.length, 4, "task-unit wake-ready must produce one row per terminal lane");
		for (const lane of lanes) {
			const row = rows.find((r) => Array.isArray(r.laneIds) && (r.laneIds as string[]).includes(lane.laneId));
			assert.ok(row, `row exists for lane ${lane.laneId}`);
			if ("parentSessionRef" in lane) {
				assert.equal(row!.parentSessionRef, lane.parentSessionRef);
			}
			assertWakeRowMembership(row!, [lane.laneId], [lane.taskId], [lane.taskId], []);
		}
	} finally {
		rmSync(rootDir, { recursive: true, force: true });
	}
});

test("completion UI cache keeps success and failure completion kinds per task-unit lane row", () => {
	const rootDir = mkdtempSync(join(tmpdir(), "flowdesk-completion-wake-success-failure-split-"));
	try {
		const workflowId = "workflow-wake-success-failure-split-1";
		const lanes = [
			{ laneId: "lane-wake-failure-origin-a", taskId: "task-wake-failure-origin-a", parentSessionRef: "ses-parent-wake-failure-origin-a", source: "context" as const, createdAt: "2026-06-08T05:00:00.000Z", readyAt: "2026-06-08T05:02:00.000Z", failed: true },
			{ laneId: "lane-wake-success-origin-b1", taskId: "task-wake-success-origin-b1", parentSessionRef: "ses-parent-wake-success-origin-b", source: "context" as const, createdAt: "2026-06-08T05:00:01.000Z", readyAt: "2026-06-08T05:02:01.000Z" },
			{ laneId: "lane-wake-success-origin-b2", taskId: "task-wake-success-origin-b2", parentSessionRef: "ses-parent-wake-success-origin-b", source: "context" as const, createdAt: "2026-06-08T05:00:02.000Z", readyAt: "2026-06-08T05:02:02.000Z" },
		];
		for (const lane of lanes) seedTerminalWakeLane(rootDir, workflowId, lane);

		refreshFlowDeskCompletionUiCachesV1({ rootDir, workflowId, observedAt: "2026-06-08T05:02:10.000Z" });

		const rows = wakeRowsForWorkflow(rootDir, workflowId);
		// Task-unit: 3 lanes → 3 rows, each independently judged.
		assert.equal(rows.length, 3);
		const failedRow = rows.find((r) => Array.isArray(r.laneIds) && (r.laneIds as string[]).includes("lane-wake-failure-origin-a"));
		const successB1 = rows.find((r) => Array.isArray(r.laneIds) && (r.laneIds as string[]).includes("lane-wake-success-origin-b1"));
		const successB2 = rows.find((r) => Array.isArray(r.laneIds) && (r.laneIds as string[]).includes("lane-wake-success-origin-b2"));
		assert.ok(failedRow);
		assert.ok(successB1);
		assert.ok(successB2);
		assert.equal(failedRow!.completionKind, "task_failed", "failed lane must produce task_failed row");
		assert.equal(failedRow!.notificationLabel, "FlowDesk lane completed with failure");
		assertWakeRowMembership(failedRow!, ["lane-wake-failure-origin-a"], ["task-wake-failure-origin-a"], [], ["task-wake-failure-origin-a"]);
		assert.equal(successB1!.completionKind, "auto_next_ready", "success lane must produce auto_next_ready row");
		assert.equal(successB2!.completionKind, "auto_next_ready", "success lane must produce auto_next_ready row");
		assertWakeRowMembership(successB1!, ["lane-wake-success-origin-b1"], ["task-wake-success-origin-b1"], ["task-wake-success-origin-b1"], []);
		assertWakeRowMembership(successB2!, ["lane-wake-success-origin-b2"], ["task-wake-success-origin-b2"], ["task-wake-success-origin-b2"], []);
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
		// Task-unit: a usable task_result lane is auto_next_ready at the task level.
		assert.equal(rows[0].completionKind, "auto_next_ready");
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

test("completion UI cache rematerializes consumed task-unit task_failed wake when a new lane is consumed", () => {
	const rootDir = mkdtempSync(join(tmpdir(), "flowdesk-completion-failure-wake-carryover-"));
	try {
		const workflowId = "workflow-failure-wake-carryover-1";
		const failedLaneId = "lane-failure-wake-carryover-1";
		const failedTaskId = "task-failure-wake-carryover-1";
		const parentSessionRef = "ses-parent-failure-wake-carryover-1";

		writeEvidence(rootDir, workflowId, "agent_task_context", "context-failure-wake-carryover-1", {
			...agentTaskContext(workflowId, failedLaneId, failedTaskId, "2026-06-08T00:00:00.000Z"),
			parent_session_ref: parentSessionRef,
		});
		writeEvidence(rootDir, workflowId, "task_failed", "task-failed-wake-carryover-1", taskFailed(workflowId, failedLaneId, failedTaskId, "2026-06-08T00:02:00.000Z"));
		refreshFlowDeskCompletionUiCachesV1({ rootDir, workflowId, observedAt: "2026-06-08T00:02:01.000Z" });

		const wakePath = join(rootDir, ".flowdesk", "ui", "completion-wake-ready.json");
		const initialWake = readCache(rootDir, "completion-wake-ready.json");
		const initialRows = initialWake.rows as Array<Record<string, unknown>>;
		// Task-unit: one failed lane → one task_failed row.
		assert.equal(initialRows.length, 1);
		assert.equal(initialRows[0].completionKind, "task_failed");
		assert.deepEqual(initialRows[0].taskFailedRefs, [failedTaskId]);
		// Mark the row consumed.
		writeFileSync(wakePath, `${JSON.stringify({
			...initialWake,
			rows: initialRows.map((row) => ({
				...row,
				consumed: true,
				consumedAt: "2026-06-08T00:02:30.000Z",
			})),
		}, null, 2)}\n`, "utf8");

		// Add a new success lane and refresh — the failed lane row stays consumed
		// (same dedupeKey, same consumptionKey), new success lane gets a fresh row.
		const newSuccessLaneId = "lane-success-wake-carryover-new";
		const newSuccessTaskId = "task-success-wake-carryover-new";
		writeEvidence(rootDir, workflowId, "agent_task_context", "context-success-wake-carryover-new", {
			...agentTaskContext(workflowId, newSuccessLaneId, newSuccessTaskId, "2026-06-08T00:00:30.000Z"),
			parent_session_ref: parentSessionRef,
		});
		writeEvidence(rootDir, workflowId, "task_result", "task-result-wake-carryover-new", taskResult(workflowId, newSuccessLaneId, newSuccessTaskId, "2026-06-08T00:03:00.000Z"));
		refreshFlowDeskCompletionUiCachesV1({ rootDir, workflowId, observedAt: "2026-06-08T00:03:01.000Z" });

		const refreshedWake = readCache(rootDir, "completion-wake-ready.json");
		const refreshedRows = refreshedWake.rows as Array<Record<string, unknown>>;
		// Task-unit: failed row (consumed, unchanged) + new success row.
		assert.equal(refreshedRows.length, 2, "task-unit: consumed failed row stays plus new success lane row");
		const failedRow = refreshedRows.find((r) => Array.isArray(r.taskFailedRefs) && (r.taskFailedRefs as string[]).includes(failedTaskId));
		const successRow = refreshedRows.find((r) => Array.isArray(r.taskResultRefs) && (r.taskResultRefs as string[]).includes(newSuccessTaskId));
		assert.ok(failedRow, "failed task row must persist");
		assert.ok(successRow, "new success task row must appear");
		assert.equal(failedRow!.consumed, true, "already-consumed failed row must remain consumed");
		assert.equal(successRow!.consumed, false, "new success row must be unconsumed");
	} finally {
		rmSync(rootDir, { recursive: true, force: true });
	}
});

test("completion UI cache emits task-unit wake rows that survive cache cap across many lanes", () => {
	const rootDir = mkdtempSync(join(tmpdir(), "flowdesk-completion-success-wake-grow-"));
	try {
		const workflowId = "workflow-success-wake-grow-1";
		const parentSessionRef = "ses-parent-success-wake-grow-1";
		// Task-unit: each lane gets its own row; the cache caps at 8 rows.
		// Write 5 lanes to stay within the cap and verify all get their own row.
		const count = 5;
		for (let index = 0; index < count; index += 1) {
			const laneId = `lane-success-wake-grow-${index.toString().padStart(2, "0")}`;
			const taskId = `task-success-wake-grow-${index.toString().padStart(2, "0")}`;
			writeEvidence(rootDir, workflowId, "agent_task_context", `context-success-wake-grow-${index}`, {
				...agentTaskContext(workflowId, laneId, taskId, `2026-06-08T00:00:${index.toString().padStart(2, "0")}.000Z`),
				parent_session_ref: parentSessionRef,
			});
			writeEvidence(rootDir, workflowId, "task_result", `task-result-success-wake-grow-${index}`, {
				...taskResult(workflowId, laneId, taskId, `2026-06-08T00:01:${index.toString().padStart(2, "0")}.000Z`),
				usable_for_synthesis: false,
			});
		}
		refreshFlowDeskCompletionUiCachesV1({ rootDir, workflowId, observedAt: "2026-06-08T00:02:00.000Z" });

		const initialWake = readCache(rootDir, "completion-wake-ready.json");
		const initialRows = initialWake.rows as Array<Record<string, unknown>>;
		// Task-unit: 5 lanes → 5 rows, each with one taskResultRef, all task_result.
		assert.equal(initialRows.length, count, "task-unit wake-ready must produce one row per lane");
		for (const row of initialRows) {
			assert.equal(row.completionKind, "task_result");
			assert.equal((row.taskResultRefs as string[]).length, 1);
		}
		// After marking all consumed, add a new lane and verify new row appears.
		const wakePath = join(rootDir, ".flowdesk", "ui", "completion-wake-ready.json");
		writeFileSync(wakePath, `${JSON.stringify({
			...initialWake,
			rows: initialRows.map((row) => ({ ...row, consumed: true, consumedAt: "2026-06-08T00:02:30.000Z" })),
		}, null, 2)}\n`, "utf8");

		const newLaneId = "lane-success-wake-grow-new";
		const newTaskId = "task-success-wake-grow-new";
		writeEvidence(rootDir, workflowId, "agent_task_context", "context-success-wake-grow-new", {
			...agentTaskContext(workflowId, newLaneId, newTaskId, "2026-06-08T00:00:32.000Z"),
			parent_session_ref: parentSessionRef,
		});
		writeEvidence(rootDir, workflowId, "task_result", "task-result-success-wake-grow-new", {
			...taskResult(workflowId, newLaneId, newTaskId, "2026-06-08T00:01:32.000Z"),
			usable_for_synthesis: false,
		});
		refreshFlowDeskCompletionUiCachesV1({ rootDir, workflowId, observedAt: "2026-06-08T00:03:00.000Z" });

		const refreshedWake = readCache(rootDir, "completion-wake-ready.json");
		const refreshedRows = refreshedWake.rows as Array<Record<string, unknown>>;
		const newRow = refreshedRows.find((r) => Array.isArray(r.taskResultRefs) && (r.taskResultRefs as string[]).includes(newTaskId));
		assert.ok(newRow, "new task lane must produce a new unconsumed wake row");
		assert.equal(newRow!.consumed, false, "new task row must be unconsumed");
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


type WakeOriginSource = "context" | "agent_task_child_session" | "lane_lifecycle" | "none";

type WakeLaneSeed = {
	laneId: string;
	taskId: string;
	parentSessionRef?: string;
	source: WakeOriginSource;
	createdAt: string;
	readyAt: string;
	failed?: boolean;
};

function seedTerminalWakeLane(rootDir: string, workflowId: string, lane: WakeLaneSeed): void {
	if (lane.source !== "none") {
		writeEvidence(rootDir, workflowId, "agent_task_context", `context-${lane.taskId}`, {
			...agentTaskContext(workflowId, lane.laneId, lane.taskId, lane.createdAt),
			parent_session_ref: lane.source === "context" ? lane.parentSessionRef : undefined,
			prompt_text: `Review wake partition fixture ${lane.taskId}`,
		});
	}
	if (lane.source === "agent_task_child_session") {
		writeEvidence(rootDir, workflowId, "agent_task_child_session", `child-${lane.taskId}`, {
			schema_version: "flowdesk.agent_task_child_session.v1",
			workflow_id: workflowId,
			lane_id: lane.laneId,
			task_id: lane.taskId,
			child_session_id: `ses-child-${lane.laneId}`,
			parent_session_ref: lane.parentSessionRef,
			provider_qualified_model_id: "openai/gpt-5.5",
			agent_ref: "agent-reviewer-gpt-frontier",
			nudge_count: 0,
			last_nudge_at: null,
			created_at: lane.createdAt,
			dispatch_authority_enabled: false,
		});
	}
	if (lane.source === "lane_lifecycle") {
		writeEvidence(rootDir, workflowId, "lane_lifecycle", `lifecycle-${lane.taskId}`, {
			...laneLifecycle(workflowId, lane.laneId, lane.taskId, lane.failed === true ? "invocation_failed" : "complete", lane.readyAt),
			parent_session_ref: lane.parentSessionRef,
		});
	}
	writeEvidence(
		rootDir,
		workflowId,
		lane.failed === true ? "task_failed" : "task_result",
		`${lane.failed === true ? "task-failed" : "task-result"}-${lane.taskId}`,
		lane.failed === true
			? taskFailed(workflowId, lane.laneId, lane.taskId, lane.readyAt)
			: taskResult(workflowId, lane.laneId, lane.taskId, lane.readyAt),
	);
}

function wakeRowsForWorkflow(rootDir: string, workflowId: string): Array<Record<string, unknown>> {
	const wake = readCache(rootDir, "completion-wake-ready.json");
	return (wake.rows as Array<Record<string, unknown>>).filter((row) => row.workflowId === workflowId);
}

function wakeRowsByParent(rows: Array<Record<string, unknown>>): Map<string, Record<string, unknown>> {
	const result = new Map<string, Record<string, unknown>>();
	for (const row of rows) result.set(typeof row.parentSessionRef === "string" ? row.parentSessionRef : "global", row);
	return result;
}

function assertWakeRowMembership(
	row: Record<string, unknown>,
	laneIds: readonly string[],
	taskIds: readonly string[],
	taskResultRefs: readonly string[],
	taskFailedRefs: readonly string[],
): void {
	assert.deepEqual([...(row.laneIds as string[])].sort(), [...laneIds].sort());
	assert.deepEqual([...(row.taskIds as string[])].sort(), [...taskIds].sort());
	assert.deepEqual([...(row.taskResultRefs as string[])].sort(), [...taskResultRefs].sort());
	assert.deepEqual([...(row.taskFailedRefs as string[])].sort(), [...taskFailedRefs].sort());
}

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
