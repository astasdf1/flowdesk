import assert from "node:assert/strict";
import test from "node:test";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { executeFlowDeskAgentTaskV1, abortFlowDeskAgentTaskV1, AGENT_TASK_CHILD_SESSION_SCHEMA_VERSION, isFlowDeskHeavyFirstTokenModelV1 } from "./agent-task-runner.js";
import { flowDeskTextLooksLikeRefusalOrErrorV1 } from "./agent-task-output.js";
import { deriveFlowDeskLaneToolStateV1, monitorChildSessionsV1 } from "./stall-recovery.js";
import { applyFlowDeskSessionEvidenceWriteIntentsV1, prepareFlowDeskSessionEvidenceWriteIntentV1, reloadFlowDeskSessionEvidenceV1 } from "@flowdesk/core";
import type { FlowDeskManagedDispatchBetaOpenCodeClientV1 } from "./managed-dispatch-adapter.js";

function makeClient(overrides: Partial<{
	create: (o: unknown) => unknown;
	prompt: (o: unknown) => unknown;
	promptAsync: (o: unknown) => unknown;
	messages: (o: unknown) => Promise<unknown>;
	abort: (o: unknown) => Promise<void>;
}>): FlowDeskManagedDispatchBetaOpenCodeClientV1 {
	return {
		session: {
			create: overrides.create ?? (async () => ({ id: "ses-child-test-01" })),
			prompt: overrides.prompt ?? (async () => ({})),
			...(overrides.promptAsync === undefined ? {} : { promptAsync: overrides.promptAsync }),
			messages: overrides.messages ?? (async () => []),
			abort: overrides.abort ?? (async () => {}),
		},
	} as unknown as FlowDeskManagedDispatchBetaOpenCodeClientV1;
}

function writeTurnCompletedProgress(input: {
	root: string;
	workflowId: string;
	laneId: string;
	taskId: string;
	observedAtMs: number;
	messageId?: string;
}): void {
	const progress = prepareFlowDeskSessionEvidenceWriteIntentV1({
		workflowId: input.workflowId,
		evidenceId: `agent-task-progress-turn-completed-${input.laneId}-${input.observedAtMs}`,
		record: {
			schema_version: "flowdesk.agent_task_progress.v1",
			workflow_id: input.workflowId,
			lane_id: input.laneId,
			task_id: input.taskId,
			agent_ref: "agent-test",
			provider_qualified_model_id: "openai/gpt-5.5",
			progress_seq: 2,
			observed_at: new Date(input.observedAtMs).toISOString(),
			phase: "waiting",
			progress_label: `agent task turn completed msgid=${input.messageId ?? "msg-test-turn"} created=${input.observedAtMs - 100} completed=${input.observedAtMs}`,
			progress_ref: `progress-turn-completed-${input.laneId}`,
			redaction_version: "v1",
			dispatch_authority_enabled: false,
		},
	});
	assert.equal(progress.ok, true, progress.errors?.join("; "));
	assert.equal(applyFlowDeskSessionEvidenceWriteIntentsV1(input.root, [progress.writeIntent as never]).ok, true);
}

function writeToolStateProgress(input: {
	root: string;
	workflowId: string;
	laneId: string;
	taskId: string;
	observedAtMs: number;
	state: "running" | "settled" | "error";
	callId?: string;
}): void {
	const progress = prepareFlowDeskSessionEvidenceWriteIntentV1({
		workflowId: input.workflowId,
		evidenceId: `agent-task-progress-tool-${input.state}-${input.laneId}-${input.observedAtMs}`,
		record: {
			schema_version: "flowdesk.agent_task_progress.v1",
			workflow_id: input.workflowId,
			lane_id: input.laneId,
			task_id: input.taskId,
			agent_ref: "agent-test",
			provider_qualified_model_id: "openai/gpt-5.5",
			progress_seq: 3,
			observed_at: new Date(input.observedAtMs).toISOString(),
			phase: "waiting",
			progress_label: `agent task tool ${input.state} callid=${input.callId ?? "call-test-tool"}`,
			progress_ref: `progress-tool-${input.state}-${input.laneId}`,
			redaction_version: "v1",
			dispatch_authority_enabled: false,
		},
	});
	assert.equal(progress.ok, true, progress.errors?.join("; "));
	assert.equal(applyFlowDeskSessionEvidenceWriteIntentsV1(input.root, [progress.writeIntent as never]).ok, true);
}

test("asyncMode returns task_launched immediately after lane launch", async () => {
	const root = mkdtempSync(join(tmpdir(), "flowdesk-async-lane-"));
	try {
		const client = makeClient({});
		const result = await executeFlowDeskAgentTaskV1({
			workflowId: "workflow-async-test",
			taskId: "task-async-1",
			laneId: "lane-async-1",
			agentRef: "agent-test",
			providerQualifiedModelId: "openai/gpt-5.5",
			promptText: "hello",
			parentSessionId: "parent-test",
			rootDir: root,
			client,
			asyncMode: true,
			_launchTimeoutMs: 5_000,
			_messagesTimeoutMs: 100,
		});

		assert.equal(result.status, "task_launched");
		if (result.status !== "task_launched") return;
		assert.equal(result.laneId, "lane-async-1");
		assert.ok(typeof result.childSessionId === "string");

		// child session evidence should be written
		const reloaded = reloadFlowDeskSessionEvidenceV1({ rootDir: root, workflowId: "workflow-async-test" });
		assert.ok(reloaded.ok);
		const childEvidence = reloaded.entries.find(e => e.evidenceClass === "agent_task_child_session");
		assert.ok(childEvidence, "child session evidence should be written");
		assert.equal((childEvidence?.record as Record<string, unknown>).schema_version, AGENT_TASK_CHILD_SESSION_SCHEMA_VERSION);
		assert.equal((childEvidence?.record as Record<string, unknown>).lane_id, "lane-async-1");
		assert.equal((childEvidence?.record as Record<string, unknown>).nudge_count, 0);
		assert.equal((childEvidence?.record as Record<string, unknown>).nudge_quiet_period_ms, 10_000);
		assert.equal((childEvidence?.record as Record<string, unknown>).last_activity_at, (childEvidence?.record as Record<string, unknown>).created_at);
		const subtaskCache = JSON.parse(readFileSync(join(root, ".flowdesk", "ui", "subtask-activity-sidebar.json"), "utf8")) as Record<string, unknown>;
		assert.equal(subtaskCache.schema_version, "flowdesk.subtask_activity_sidebar_cache.v1");
		const rows = subtaskCache.rows as Array<Record<string, unknown>>;
		assert.equal(rows[0]?.workflowId, "workflow-async-test");
		assert.equal(rows[0]?.laneId, "lane-async-1");
		assert.equal(rows[0]?.state, "running");
		assert.equal(rows[0]?.classification, "progressing_normal");
	} finally {
		rmSync(root, { recursive: true, force: true });
	}
});

test("async watchdog uses persisted custom nudge quiet period", async () => {
	const root = mkdtempSync(join(tmpdir(), "flowdesk-async-nudge-period-"));
	try {
		let promptCalls = 0;
		const client = makeClient({
			promptAsync: async () => { promptCalls++; return {}; },
			prompt: async () => { promptCalls++; return {}; },
			messages: async () => [],
		});
		await executeFlowDeskAgentTaskV1({
			workflowId: "workflow-async-nudge-period-1",
			taskId: "task-async-nudge-period-1",
			laneId: "lane-async-nudge-period-1",
			agentRef: "agent-test",
			providerQualifiedModelId: "openai/gpt-5.5",
			promptText: "hello",
			parentSessionId: "parent-test",
			rootDir: root,
			client,
			asyncMode: true,
			_nudgeQuietPeriodMs: 60_000,
			_launchTimeoutMs: 5_000,
			_messagesTimeoutMs: 100,
		});

		const first = reloadFlowDeskSessionEvidenceV1({ rootDir: root, workflowId: "workflow-async-nudge-period-1" });
		const child = first.entries.find(e => e.evidenceClass === "agent_task_child_session")?.record as Record<string, unknown> | undefined;
		assert.equal(child?.nudge_quiet_period_ms, 60_000);
		const createdAt = String(child?.created_at);
		const monResult = await monitorChildSessionsV1({
			rootDir: root,
			workflowId: "workflow-async-nudge-period-1",
			client,
			now: new Date(Date.parse(createdAt) + 20_000),
			maxNudges: 2,
			abortThresholdMs: 100_000,
		});

		assert.equal(monResult.lanesNudged, 0);
		assert.equal(promptCalls, 1, "watchdog should not nudge before persisted custom quiet period");
	} finally {
		rmSync(root, { recursive: true, force: true });
	}
});

test("agent-task launch failure refreshes completion cache to terminal", async () => {
	const root = mkdtempSync(join(tmpdir(), "flowdesk-agent-task-launch-failed-"));
	try {
		const client = makeClient({
			create: () => ({}),
		});
		const result = await executeFlowDeskAgentTaskV1({
			workflowId: "workflow-launch-failed-1",
			taskId: "task-launch-failed-1",
			laneId: "lane-launch-failed-1",
			agentRef: "agent-test",
			providerQualifiedModelId: "openai/gpt-5.5",
			promptText: "hello",
			parentSessionId: "parent-test",
			rootDir: root,
			client,
			asyncMode: false,
			_launchTimeoutMs: 5_000,
			_messagesTimeoutMs: 100,
		});

		assert.equal(result.status, "task_failed");
		assert.equal(result.failureCategory, "sdk_create_failed");

		const reloaded = reloadFlowDeskSessionEvidenceV1({ rootDir: root, workflowId: "workflow-launch-failed-1" });
		assert.ok(reloaded.ok);
		assert.equal(reloaded.entries.some((entry) => entry.evidenceClass === "task_failed"), true);

		const subtaskCache = JSON.parse(readFileSync(join(root, ".flowdesk", "ui", "subtask-activity-sidebar.json"), "utf8")) as Record<string, unknown>;
		const rows = subtaskCache.rows as Array<Record<string, unknown>>;
		const row = rows.find((entry) => entry.workflowId === "workflow-launch-failed-1");
		assert.equal(row?.workflowId, "workflow-launch-failed-1");
		assert.equal(row?.state, "invocation_failed");
		assert.equal(row?.classification, "terminal");
	} finally {
		rmSync(root, { recursive: true, force: true });
	}
});

test("agent-task surfaces a provider dispatch error distinctly from sdk_create_failed", async () => {
	const root = mkdtempSync(join(tmpdir(), "flowdesk-agent-task-provider-dispatch-"));
	try {
		// Child session creates fine, but the prompt call returns a provider/runtime
		// error response (mirrors an in-process SDK server rejecting an anthropic
		// prompt with UnknownError while the session was created successfully).
		const client = makeClient({
			create: async () => ({ id: "ses-child-provider-err-01" }),
			promptAsync: async () => ({
				error: { name: "UnknownError", data: { message: "Unexpected server error.", ref: "err_test" } },
			}),
		});
		const result = await executeFlowDeskAgentTaskV1({
			workflowId: "workflow-provider-dispatch-1",
			taskId: "task-provider-dispatch-1",
			laneId: "lane-provider-dispatch-1",
			agentRef: "agent-test",
			providerQualifiedModelId: "anthropic/claude-opus-4-7",
			promptText: "hello",
			parentSessionId: "parent-test",
			rootDir: root,
			client,
			asyncMode: false,
			_launchTimeoutMs: 5_000,
			_messagesTimeoutMs: 100,
		});

		assert.equal(result.status, "task_failed");
		if (result.status !== "task_failed") return;
		assert.equal(result.failureCategory, "provider_dispatch_error");
		assert.match(result.redactedReason, /provider rejected the lane dispatch/);

		const reloaded = reloadFlowDeskSessionEvidenceV1({ rootDir: root, workflowId: "workflow-provider-dispatch-1" });
		assert.ok(reloaded.ok);
		const failed = reloaded.entries.find((entry) => entry.evidenceClass === "task_failed");
		assert.ok(failed, "task_failed evidence should be written");
		assert.equal((failed?.record as Record<string, unknown>).failure_category, "provider_dispatch_error");
	} finally {
		rmSync(root, { recursive: true, force: true });
	}
});

test("failed agent-task lane writes redacted log index row for MessageAbortedError", async () => {
	const root = mkdtempSync(join(tmpdir(), "flowdesk-agent-task-log-index-aborted-"));
	try {
		const rawPrompt = "RAW_SECRET_PROMPT_TEXT should not appear in the log index";
		const aborted = new Error("Message aborted by OpenCode");
		aborted.name = "MessageAbortedError";
		const client = makeClient({
			create: async () => ({ id: "ses-child-aborted-01" }),
			promptAsync: async () => { throw aborted; },
		});
		const result = await executeFlowDeskAgentTaskV1({
			workflowId: "workflow-log-index-aborted-1",
			taskId: "task-log-index-aborted-1",
			laneId: "lane-log-index-aborted-1",
			agentRef: "agent-test",
			providerQualifiedModelId: "openai/gpt-5.5",
			promptText: rawPrompt,
			parentSessionId: "parent-test",
			rootDir: root,
			client,
			asyncMode: false,
			_launchTimeoutMs: 5_000,
			_messagesTimeoutMs: 100,
		});

		assert.equal(result.status, "task_failed");
		const logIndexText = readFileSync(join(root, ".flowdesk", "ui", "agent-task-log-index.json"), "utf8");
		assert.equal(logIndexText.includes(rawPrompt), false, "log index must not persist raw prompt text");
		const logIndex = JSON.parse(logIndexText) as Record<string, unknown>;
		assert.equal(logIndex.schema_version, "flowdesk.agent_task_log_index.v1");
		const rows = logIndex.rows as Array<Record<string, unknown>>;
		const row = rows.find((entry) => entry.laneId === "lane-log-index-aborted-1");
		assert.ok(row, "failed lane should have a log index row");
		assert.equal(row?.workflowId, "workflow-log-index-aborted-1");
		assert.equal(row?.taskId, "task-log-index-aborted-1");
		assert.equal(row?.childSessionId, "ses-child-aborted-01");
		assert.equal(row?.parentSessionRef, "ses-parent-test");
		assert.equal(row?.agentRef, "agent-test");
		assert.equal(row?.providerQualifiedModelId, "openai/gpt-5.5");
		assert.equal(row?.nudgeCount, 0, "nudge_count=0 must be preserved");
		assert.equal(typeof row?.createdAt, "string");
		assert.equal(typeof row?.terminalAt, "string");
		assert.equal(typeof row?.taskFailedRef, "string");
		assert.equal(typeof row?.lifecycleRef, "string");
		assert.deepEqual(row?.sessionErrorLabels, ["provider_dispatch_error", "MessageAbortedError"]);
		const progressEvents = row?.progressEvents as Array<Record<string, unknown>>;
		assert.ok(progressEvents.some((event) => event.label === "agent task lane launch started"));
	} finally {
		rmSync(root, { recursive: true, force: true });
	}
});

test("heavy first-token model classification matches the operator policy", () => {
	// Heavy: Claude Opus, non-fast GPT-5.x main, Codex.
	assert.equal(isFlowDeskHeavyFirstTokenModelV1("anthropic/claude-opus-4-7"), true);
	assert.equal(isFlowDeskHeavyFirstTokenModelV1("openai/gpt-5.5"), true);
	assert.equal(isFlowDeskHeavyFirstTokenModelV1("openai/gpt-5.4"), true);
	assert.equal(isFlowDeskHeavyFirstTokenModelV1("openai/gpt-5.3-codex"), true);
	// Light/fast variants are never heavy.
	assert.equal(isFlowDeskHeavyFirstTokenModelV1("openai/gpt-5.4-mini"), false);
	assert.equal(isFlowDeskHeavyFirstTokenModelV1("openai/gpt-5.5-fast"), false);
	assert.equal(isFlowDeskHeavyFirstTokenModelV1("openai/gpt-5.3-codex-spark"), false);
	assert.equal(isFlowDeskHeavyFirstTokenModelV1("anthropic/claude-haiku-4-5"), false);
	assert.equal(isFlowDeskHeavyFirstTokenModelV1("google/gemini-3.1-flash-lite"), false);
	// Operator decision: gemini pro and sonnet are NOT heavy.
	assert.equal(isFlowDeskHeavyFirstTokenModelV1("google/gemini-3.1-pro-preview"), false);
	assert.equal(isFlowDeskHeavyFirstTokenModelV1("anthropic/claude-sonnet-4-6"), false);
	assert.equal(isFlowDeskHeavyFirstTokenModelV1(undefined), false);
});

test("heavy model captures a slow first token that exceeds the light quiet period", async () => {
	const root = mkdtempSync(join(tmpdir(), "flowdesk-heavy-first-token-"));
	try {
		// Emit the first assistant token only after several empty polls, so the
		// pre-first-token silence exceeds the short quiet period but stays within
		// the heavy grace window. With a heavy model, capture must still succeed.
		let polls = 0;
		const client = makeClient({
			create: async () => ({ id: "ses-heavy-first-token-01" }),
			promptAsync: async () => ({}),
			messages: async () => {
				polls++;
				if (polls < 4) return [];
				return [{ role: "assistant", parts: [{ type: "text", text: "slow heavy answer" }, { type: "step-finish", reason: "stop" }] }];
			},
		});
		const result = await executeFlowDeskAgentTaskV1({
			workflowId: "workflow-heavy-first-token-1",
			taskId: "task-heavy-first-token-1",
			laneId: "lane-heavy-first-token-1",
			agentRef: "agent-reviewer-claude-opus",
			providerQualifiedModelId: "anthropic/claude-opus-4-7",
			promptText: "hello",
			parentSessionId: "parent-test",
			rootDir: root,
			client,
			asyncMode: false,
			// Tiny quiet period so the test is fast; the heavy grace is derived
			// internally as max(quietPeriod, AGENT_TASK_HEAVY_FIRST_TOKEN_GRACE_MS),
			// but we shorten the messages cap so polls advance quickly.
			_nudgeQuietPeriodMs: 50,
			_heavyFirstTokenGraceMs: 1_200,
			_launchTimeoutMs: 5_000,
			_messagesTimeoutMs: 20,
		});

		assert.equal(result.status, "task_completed");
		if (result.status !== "task_completed") return;
		assert.equal(result.resultText, "slow heavy answer");
	} finally {
		rmSync(root, { recursive: true, force: true });
	}
});

test("sync capture timeout leaves launched child non-terminal for watchdog backfill", async () => {
	const root = mkdtempSync(join(tmpdir(), "flowdesk-sync-timeout-nonterminal-"));
	try {
		const client = makeClient({
			create: async () => ({ id: "ses-sync-timeout-child-01" }),
			promptAsync: async () => ({}),
			messages: async () => [],
		});
		const result = await executeFlowDeskAgentTaskV1({
			workflowId: "workflow-sync-timeout-nonterminal",
			taskId: "task-sync-timeout-nonterminal",
			laneId: "lane-sync-timeout-nonterminal",
			agentRef: "agent-test",
			providerQualifiedModelId: "openai/gpt-5.5",
			promptText: "work",
			parentSessionId: "parent-test",
			rootDir: root,
			client,
			asyncMode: false,
			_nudgeQuietPeriodMs: 20,
			_launchTimeoutMs: 5_000,
			_messagesTimeoutMs: 5,
		});

		assert.equal(result.status, "task_launched");
		if (result.status !== "task_launched") return;
		assert.equal(result.childSessionId, "ses-sync-timeout-child-01");

		const reloaded = reloadFlowDeskSessionEvidenceV1({
			rootDir: root,
			workflowId: "workflow-sync-timeout-nonterminal",
		});
		assert.ok(reloaded.ok);
		assert.equal(
			reloaded.entries.some((entry) => entry.evidenceClass === "task_failed"),
			false,
			"bounded sync capture must not materialize premature task_failed/no_response while child session exists",
		);
		assert.equal(
			reloaded.entries.some(
				(entry) =>
					entry.evidenceClass === "lane_lifecycle" &&
					(entry.record as Record<string, unknown>).state === "no_output",
			),
			false,
			"bounded sync capture must not terminalize no_output while child session can still be backfilled",
		);
		assert.equal(
			reloaded.entries.some((entry) => entry.evidenceClass === "agent_task_child_session"),
			true,
			"child session index must remain for watchdog/status backfill",
		);
	} finally {
		rmSync(root, { recursive: true, force: true });
	}
});

test("agent task launch prefers promptAsync when available", async () => {
	const root = mkdtempSync(join(tmpdir(), "flowdesk-agent-task-promptasync-"));
	try {
		const calls: string[] = [];
		const client = makeClient({
			prompt: () => { calls.push("prompt"); return {}; },
			promptAsync: () => { calls.push("promptAsync"); return {}; },
		});
		const result = await executeFlowDeskAgentTaskV1({
			workflowId: "workflow-promptasync-test",
			taskId: "task-promptasync-1",
			laneId: "lane-promptasync-1",
			agentRef: "agent-test",
			providerQualifiedModelId: "openai/gpt-5.5",
			promptText: "hello",
			parentSessionId: "parent-test",
			rootDir: root,
			client,
			asyncMode: true,
			_launchTimeoutMs: 5_000,
			_messagesTimeoutMs: 100,
		});

		assert.equal(result.status, "task_launched");
		assert.deepEqual(calls, ["promptAsync"]);
	} finally {
		rmSync(root, { recursive: true, force: true });
	}
});

test("monitorChildSessions collects result when child session has text", async () => {
	const root = mkdtempSync(join(tmpdir(), "flowdesk-monitor-result-"));
	try {
		// First launch in asyncMode to write evidence
		const client = makeClient({
			messages: async () => ([{ role: "assistant", parts: [{ type: "text", text: "final answer here" }, { type: "step-finish", reason: "stop" }] }]),
		});
		await executeFlowDeskAgentTaskV1({
			workflowId: "workflow-monitor-1",
			taskId: "task-m1",
			laneId: "lane-m1",
			agentRef: "agent-test",
			providerQualifiedModelId: "openai/gpt-5.5",
			promptText: "analyze",
			parentSessionId: "parent-1",
			rootDir: root,
			client,
			asyncMode: true,
			_launchTimeoutMs: 5_000,
			_messagesTimeoutMs: 100,
		});

		const monResult = await monitorChildSessionsV1({
			rootDir: root,
			workflowId: "workflow-monitor-1",
			client,
			now: new Date(),
		});

		assert.equal(monResult.lanesPolled, 1);
		assert.equal(monResult.lanesCompleted, 1);
		assert.equal(monResult.lanesNudged, 0);
		assert.equal(monResult.lanesAborted, 0);

		// task_result evidence should be written
		const reloaded = reloadFlowDeskSessionEvidenceV1({ rootDir: root, workflowId: "workflow-monitor-1" });
		assert.ok(reloaded.ok);
		const taskResult = reloaded.entries.find(e => e.evidenceClass === "task_result");
		assert.ok(taskResult, "task_result evidence should be written");
		const autoNextCache = JSON.parse(readFileSync(join(root, ".flowdesk", "ui", "auto-next-ready.json"), "utf8")) as Record<string, unknown>;
		assert.equal(autoNextCache.schema_version, "flowdesk.auto_next_ready_cache.v1");
		const workflows = autoNextCache.workflows as Array<Record<string, unknown>>;
		assert.equal(workflows[0]?.workflowId, "workflow-monitor-1");
		const subtaskCache = JSON.parse(readFileSync(join(root, ".flowdesk", "ui", "subtask-activity-sidebar.json"), "utf8")) as Record<string, unknown>;
		assert.equal(subtaskCache.schema_version, "flowdesk.subtask_activity_sidebar_cache.v1");
	} finally {
		rmSync(root, { recursive: true, force: true });
	}
});

test("monitorChildSessions gates final text capture when a tool is running", async () => {
	const root = mkdtempSync(join(tmpdir(), "flowdesk-monitor-final-tool-running-"));
	try {
		const workflowId = "workflow-monitor-final-tool-running";
		const taskId = "task-final-tool-running";
		const laneId = "lane-final-tool-running";
		await executeFlowDeskAgentTaskV1({
			workflowId,
			taskId,
			laneId,
			agentRef: "agent-test",
			providerQualifiedModelId: "openai/gpt-5.5",
			promptText: "analyze",
			parentSessionId: "parent-1",
			rootDir: root,
			client: makeClient({}),
			asyncMode: true,
			_launchTimeoutMs: 5_000,
			_messagesTimeoutMs: 100,
		});
		const initial = reloadFlowDeskSessionEvidenceV1({ rootDir: root, workflowId });
		const child = initial.entries.find(e => e.evidenceClass === "agent_task_child_session")?.record as Record<string, unknown> | undefined;
		const createdAtMs = Date.parse(String(child?.created_at));
		writeToolStateProgress({ root, workflowId, laneId, taskId, observedAtMs: createdAtMs + 1_000, state: "running", callId: "call-running" });

		const monResult = await monitorChildSessionsV1({
			rootDir: root,
			workflowId,
			client: makeClient({
				messages: async () => ([{ role: "assistant", parts: [
					{ type: "text", text: "final text while a tool is still running" },
					{ type: "tool", callID: "call-running", state: { status: "running" } },
					{ type: "step-finish", reason: "stop" },
				] }]),
			}),
			now: new Date(createdAtMs + 2_000),
			staleToolMs: 60_000,
		});

		assert.equal(monResult.lanesCompleted, 0);
		const reloaded = reloadFlowDeskSessionEvidenceV1({ rootDir: root, workflowId });
		assert.ok(reloaded.ok);
		assert.equal(reloaded.entries.some(e => e.evidenceClass === "task_result"), false);
		const finalization = reloaded.entries.find(e => e.evidenceClass === "session_finalization_evidence")?.record as Record<string, unknown> | undefined;
		assert.equal(finalization?.decision, "blocked_running_tools");
		assert.equal(finalization?.safe_capture_ready, false);
		assert.equal("result_text" in (finalization ?? {}), false);
		const review = reloaded.entries.find(e => e.evidenceClass === "agent_task_progress" && String((e.record as Record<string, unknown>).progress_label).includes("session finalization blocked: running_tools_present"));
		assert.ok(review, "blocked capture should request coordinator review without raw text");
	} finally {
		rmSync(root, { recursive: true, force: true });
	}
});

test("monitorChildSessions does not auto-capture final text when tool state is unknown", async () => {
	const root = mkdtempSync(join(tmpdir(), "flowdesk-monitor-final-tool-unknown-"));
	try {
		const workflowId = "workflow-monitor-final-tool-unknown";
		const taskId = "task-final-tool-unknown";
		const laneId = "lane-final-tool-unknown";
		await executeFlowDeskAgentTaskV1({
			workflowId,
			taskId,
			laneId,
			agentRef: "agent-test",
			providerQualifiedModelId: "openai/gpt-5.5",
			promptText: "analyze",
			parentSessionId: "parent-1",
			rootDir: root,
			client: makeClient({}),
			asyncMode: true,
			_launchTimeoutMs: 5_000,
			_messagesTimeoutMs: 100,
		});
		const initial = reloadFlowDeskSessionEvidenceV1({ rootDir: root, workflowId });
		const child = initial.entries.find(e => e.evidenceClass === "agent_task_child_session")?.record as Record<string, unknown> | undefined;
		const createdAtMs = Date.parse(String(child?.created_at));
		writeToolStateProgress({ root, workflowId, laneId, taskId, observedAtMs: createdAtMs + 1_000, state: "running", callId: "call-unknown" });

		const monResult = await monitorChildSessionsV1({
			rootDir: root,
			workflowId,
			client: makeClient({
				messages: async () => ([{ role: "assistant", parts: [
					{ type: "text", text: "final text while tool settle state is unknown" },
					{ type: "step-finish", reason: "stop" },
				] }]),
			}),
			now: new Date(createdAtMs + 5_000),
			staleToolMs: 1_000,
		});

		assert.equal(monResult.lanesCompleted, 0);
		const reloaded = reloadFlowDeskSessionEvidenceV1({ rootDir: root, workflowId });
		assert.ok(reloaded.ok);
		assert.equal(reloaded.entries.some(e => e.evidenceClass === "task_result"), false);
		const finalization = reloaded.entries.find(e => e.evidenceClass === "session_finalization_evidence")?.record as Record<string, unknown> | undefined;
		assert.equal(finalization?.decision, "requires_review");
		assert.equal(finalization?.block_reason, "tool_state_unknown");
		assert.equal(finalization?.safe_capture_ready, false);
	} finally {
		rmSync(root, { recursive: true, force: true });
	}
});

test("monitorChildSessions writes task_result when final text is idle with no running tools", async () => {
	const root = mkdtempSync(join(tmpdir(), "flowdesk-monitor-final-safe-gate-"));
	try {
		const workflowId = "workflow-monitor-final-safe-gate";
		const taskId = "task-final-safe-gate";
		const laneId = "lane-final-safe-gate";
		await executeFlowDeskAgentTaskV1({
			workflowId,
			taskId,
			laneId,
			agentRef: "agent-test",
			providerQualifiedModelId: "openai/gpt-5.5",
			promptText: "analyze",
			parentSessionId: "parent-1",
			rootDir: root,
			client: makeClient({}),
			asyncMode: true,
			_launchTimeoutMs: 5_000,
			_messagesTimeoutMs: 100,
		});
		const monResult = await monitorChildSessionsV1({
			rootDir: root,
			workflowId,
			client: makeClient({
				messages: async () => ([{ role: "assistant", parts: [
					{ type: "text", text: "safe final text after idle and no tools" },
					{ type: "step-finish", reason: "stop" },
				] }]),
			}),
			now: new Date("2026-06-01T00:05:00.000Z"),
		});

		assert.equal(monResult.lanesCompleted, 1);
		const reloaded = reloadFlowDeskSessionEvidenceV1({ rootDir: root, workflowId });
		assert.ok(reloaded.ok);
		const taskResult = reloaded.entries.find(e => e.evidenceClass === "task_result")?.record as Record<string, unknown> | undefined;
		assert.equal(taskResult?.result_text, "safe final text after idle and no tools");
		const finalization = reloaded.entries.find(e => e.evidenceClass === "session_finalization_evidence")?.record as Record<string, unknown> | undefined;
		assert.equal(finalization?.decision, "safe_capture_ready");
		assert.equal(finalization?.safe_capture_ready, true);
		assert.equal(finalization?.observed_text_char_count, "safe final text after idle and no tools".length);
	} finally {
		rmSync(root, { recursive: true, force: true });
	}
});

test("monitorChildSessions backfills finalizing_without_terminal lane when child has terminal final text", async () => {
	const root = mkdtempSync(join(tmpdir(), "flowdesk-monitor-finalizing-backfill-"));
	try {
		const workflowId = "workflow-monitor-finalizing-backfill";
		const laneId = "lane-finalizing-backfill";
		const taskId = "task-finalizing-backfill";
		await executeFlowDeskAgentTaskV1({
			workflowId,
			taskId,
			laneId,
			agentRef: "agent-test",
			providerQualifiedModelId: "openai/gpt-5.5",
			promptText: "analyze",
			parentSessionId: "parent-1",
			rootDir: root,
			client: makeClient({}),
			asyncMode: true,
			_launchTimeoutMs: 5_000,
			_messagesTimeoutMs: 100,
		});

		const staleAt = "2026-06-01T00:00:00.000Z";
		const progress = prepareFlowDeskSessionEvidenceWriteIntentV1({
			workflowId,
			evidenceId: "agent-task-progress-finalizing-backfill",
			record: {
				schema_version: "flowdesk.agent_task_progress.v1",
				workflow_id: workflowId,
				lane_id: laneId,
				task_id: taskId,
				agent_ref: "agent-test",
				provider_qualified_model_id: "openai/gpt-5.5",
				progress_seq: 99,
				observed_at: staleAt,
				phase: "finalizing",
				progress_label: "async agent task stuck finalizing_without_terminal",
				progress_ref: "progress-finalizing-backfill-99",
				redaction_version: "v1",
				dispatch_authority_enabled: false,
			},
		});
		const inconsistency = prepareFlowDeskSessionEvidenceWriteIntentV1({
			workflowId,
			evidenceId: "agent-task-inconsistency-finalizing-backfill",
			record: {
				schema_version: "flowdesk.agent_task_inconsistency.v1",
				workflow_id: workflowId,
				attempt_id: `attempt-${laneId}`,
				lane_id: laneId,
				task_id: taskId,
				last_progress_seq: 99,
				last_progress_observed_at: staleAt,
				inconsistency_kind: "finalizing_without_terminal",
				grace_window_ms: 30_000,
				grace_source_label: "test",
				observed_at: staleAt,
				safe_next_actions: ["/flowdesk-status", "/flowdesk-abort", "/flowdesk-retry", "/flowdesk-doctor", "/flowdesk-export-debug"],
				redaction_version: "v1",
				dispatch_authority_enabled: false,
			},
		});
		assert.equal(progress.ok, true, progress.errors?.join("; "));
		assert.equal(inconsistency.ok, true, inconsistency.errors?.join("; "));
		assert.equal(applyFlowDeskSessionEvidenceWriteIntentsV1(root, [progress.writeIntent as never, inconsistency.writeIntent as never]).ok, true);

		const monResult = await monitorChildSessionsV1({
			rootDir: root,
			workflowId,
			client: makeClient({
				messages: async () => ([{ role: "assistant", parts: [{ type: "text", text: "final backfilled answer" }, { type: "step-finish", reason: "stop" }] }]),
			}),
			now: new Date("2026-06-01T00:01:00.000Z"),
		});

		assert.equal(monResult.lanesCompleted, 1);
		const reloaded = reloadFlowDeskSessionEvidenceV1({ rootDir: root, workflowId });
		assert.ok(reloaded.ok);
		assert.equal(reloaded.entries.some(e => e.evidenceClass === "agent_task_inconsistency"), true);
		const taskResult = reloaded.entries.find(e => e.evidenceClass === "task_result")?.record as Record<string, unknown> | undefined;
		assert.equal(taskResult?.result_text, "final backfilled answer");
		const terminalLifecycle = reloaded.entries.find(e => e.evidenceClass === "lane_lifecycle" && (e.record as Record<string, unknown>).lane_id === laneId && (e.record as Record<string, unknown>).state === "incomplete");
		assert.ok(terminalLifecycle, "terminal lifecycle should be backfilled despite prior inconsistency");
	} finally {
		rmSync(root, { recursive: true, force: true });
	}
});

test("monitorChildSessions writes terminal lifecycle for task_result without reviewer verdict", async () => {
	const root = mkdtempSync(join(tmpdir(), "flowdesk-monitor-no-verdict-lifecycle-"));
	try {
		const workflowId = "workflow-monitor-no-verdict-lifecycle";
		const laneId = "lane-no-verdict-lifecycle";
		await executeFlowDeskAgentTaskV1({
			workflowId,
			taskId: "task-no-verdict-lifecycle",
			laneId,
			agentRef: "agent-test",
			providerQualifiedModelId: "openai/gpt-5.5",
			promptText: "analyze",
			parentSessionId: "parent-1",
			rootDir: root,
			client: makeClient({}),
			asyncMode: true,
			_launchTimeoutMs: 5_000,
			_messagesTimeoutMs: 100,
		});

		await monitorChildSessionsV1({
			rootDir: root,
			workflowId,
			client: makeClient({
				messages: async () => ([{ role: "assistant", parts: [{ type: "text", text: "plain non-json final answer" }, { type: "step-finish", reason: "stop" }] }]),
			}),
			now: new Date("2026-06-01T00:02:00.000Z"),
		});

		const reloaded = reloadFlowDeskSessionEvidenceV1({ rootDir: root, workflowId });
		assert.ok(reloaded.ok);
		assert.equal(reloaded.entries.some(e => e.evidenceClass === "reviewer_verdict"), false);
		assert.equal(reloaded.entries.filter(e => e.evidenceClass === "task_result").length, 1);
		const terminalLifecycle = reloaded.entries.find(e => e.evidenceClass === "lane_lifecycle" && (e.record as Record<string, unknown>).lane_id === laneId && (e.record as Record<string, unknown>).state === "incomplete");
		assert.ok(terminalLifecycle, "plain task_result should still terminalize lifecycle");
		assert.equal((terminalLifecycle.record as Record<string, unknown>).verdict_ref, undefined);
	} finally {
		rmSync(root, { recursive: true, force: true });
	}
});

test("monitorChildSessions is idempotent after task_result backfill", async () => {
	const root = mkdtempSync(join(tmpdir(), "flowdesk-monitor-idempotent-result-"));
	try {
		const workflowId = "workflow-monitor-idempotent-result";
		const laneId = "lane-idempotent-result";
		await executeFlowDeskAgentTaskV1({
			workflowId,
			taskId: "task-idempotent-result",
			laneId,
			agentRef: "agent-test",
			providerQualifiedModelId: "openai/gpt-5.5",
			promptText: "analyze",
			parentSessionId: "parent-1",
			rootDir: root,
			client: makeClient({}),
			asyncMode: true,
			_launchTimeoutMs: 5_000,
			_messagesTimeoutMs: 100,
		});

		const monitorClient = makeClient({
			messages: async () => ([{ role: "assistant", parts: [{ type: "text", text: "idempotent final answer" }, { type: "step-finish", reason: "stop" }] }]),
		});
		await monitorChildSessionsV1({ rootDir: root, workflowId, client: monitorClient, now: new Date("2026-06-01T00:03:00.000Z") });
		const second = await monitorChildSessionsV1({ rootDir: root, workflowId, client: monitorClient, now: new Date("2026-06-01T00:04:00.000Z") });

		assert.equal(second.lanesPolled, 0, "task_result-backed lane should be terminal on later monitor cycles");
		const reloaded = reloadFlowDeskSessionEvidenceV1({ rootDir: root, workflowId });
		assert.ok(reloaded.ok);
		assert.equal(reloaded.entries.filter(e => e.evidenceClass === "task_result").length, 1);
		assert.equal(reloaded.entries.filter(e => e.evidenceClass === "lane_lifecycle" && (e.record as Record<string, unknown>).lane_id === laneId && (e.record as Record<string, unknown>).state === "incomplete").length, 1);
	} finally {
		rmSync(root, { recursive: true, force: true });
	}
});

test("monitorChildSessions preserves marker-like task_result text", async () => {
	const root = mkdtempSync(join(tmpdir(), "flowdesk-monitor-sanitize-"));
	try {
		const launchClient = makeClient({});
		await executeFlowDeskAgentTaskV1({
			workflowId: "workflow-monitor-sanitize",
			taskId: "task-sanitize-watchdog",
			laneId: "lane-sanitize-watchdog",
			agentRef: "agent-test",
			providerQualifiedModelId: "openai/gpt-5.5",
			promptText: "analyze",
			parentSessionId: "parent-1",
			rootDir: root,
			client: launchClient,
			asyncMode: true,
			_launchTimeoutMs: 5_000,
			_messagesTimeoutMs: 100,
		});

		const monitorClient = makeClient({
			messages: async () => ([{ role: "assistant", parts: [{ type: "text", text: "I saw the prompt and packages/core/src/example.ts plus /Users/example/project details." }, { type: "step-finish", reason: "stop" }] }]),
		});
		const monResult = await monitorChildSessionsV1({
			rootDir: root,
			workflowId: "workflow-monitor-sanitize",
			client: monitorClient,
			now: new Date(),
		});

		assert.equal(monResult.lanesCompleted, 1);
		const reloaded = reloadFlowDeskSessionEvidenceV1({ rootDir: root, workflowId: "workflow-monitor-sanitize" });
		assert.ok(reloaded.ok);
		const taskResult = reloaded.entries.find(e => e.evidenceClass === "task_result");
		assert.ok(taskResult, "task_result evidence should be written");
		const record = taskResult.record as Record<string, unknown>;
		assert.equal(typeof record.result_text, "string");
		assert.equal(record.result_text, "I saw the prompt and packages/core/src/example.ts plus /Users/example/project details.");
		assert.equal(record.result_text_truncated, false);
		assert.equal(reloaded.entries.some(e => e.evidenceClass === "task_failed"), false);
	} finally {
		rmSync(root, { recursive: true, force: true });
	}
});

test("refusal/error advisory detector flags refusals but not normal answers", () => {
	assert.equal(flowDeskTextLooksLikeRefusalOrErrorV1("I cannot help with that request."), true);
	assert.equal(flowDeskTextLooksLikeRefusalOrErrorV1("Error: rate limit exceeded"), true);
	assert.equal(flowDeskTextLooksLikeRefusalOrErrorV1("Here is the analysis: the function looks correct."), false);
	assert.equal(flowDeskTextLooksLikeRefusalOrErrorV1("   "), false);
	assert.equal(flowDeskTextLooksLikeRefusalOrErrorV1(undefined), false);
});

test("capture records advisory finalization_reason and refusal flag without dropping the result", async () => {
	const root = mkdtempSync(join(tmpdir(), "flowdesk-capture-advisory-"));
	try {
		const client = makeClient({
			messages: async () => ([{ role: "assistant", parts: [
				{ type: "text", text: "I cannot complete this task as specified." },
				{ type: "step-finish", reason: "stop" },
			] }]),
		});
		const result = await executeFlowDeskAgentTaskV1({
			workflowId: "workflow-capture-advisory",
			taskId: "task-capture-advisory",
			laneId: "lane-capture-advisory",
			agentRef: "agent-test",
			providerQualifiedModelId: "openai/gpt-5.5",
			promptText: "work",
			parentSessionId: "parent-1",
			rootDir: root,
			client,
			_launchTimeoutMs: 5_000,
			_messagesTimeoutMs: 100,
		});
		// Capture never drops a refusal-looking answer: it is still task_completed.
		assert.equal(result.status, "task_completed");
		const reloaded = reloadFlowDeskSessionEvidenceV1({ rootDir: root, workflowId: "workflow-capture-advisory" });
		const record = reloaded.entries.find(e => e.evidenceClass === "task_result")?.record as Record<string, unknown>;
		assert.ok(record);
		assert.equal(record.missing_contract, false);
		assert.equal(record.finalization_reason, "terminal_marker");
		assert.equal(record.looks_like_refusal_or_error, true);
	} finally {
		rmSync(root, { recursive: true, force: true });
	}
});

test("executeFlowDeskAgentTaskV1 preserves synchronous marker-like task_result text", async () => {
	const root = mkdtempSync(join(tmpdir(), "flowdesk-sync-sanitize-"));
	try {
		const client = makeClient({
			messages: async () => ([{ role: "assistant", parts: [{ type: "text", text: "Final mentions developer message and src/index.ts but should persist." }, { type: "step-finish", reason: "stop" }] }]),
		});
		const result = await executeFlowDeskAgentTaskV1({
			workflowId: "workflow-sync-sanitize",
			taskId: "task-sync-sanitize",
			laneId: "lane-sync-sanitize",
			agentRef: "agent-test",
			providerQualifiedModelId: "openai/gpt-5.5",
			promptText: "work",
			parentSessionId: "parent-1",
			rootDir: root,
			client,
			_launchTimeoutMs: 5_000,
			_messagesTimeoutMs: 100,
		});

		assert.equal(result.status, "task_completed");
		const reloaded = reloadFlowDeskSessionEvidenceV1({ rootDir: root, workflowId: "workflow-sync-sanitize" });
		assert.ok(reloaded.ok);
		const taskResult = reloaded.entries.find(e => e.evidenceClass === "task_result");
		assert.ok(taskResult, "synchronous task_result evidence should be written");
		const record = taskResult.record as Record<string, unknown>;
		assert.equal(record.result_text, "Final mentions developer message and src/index.ts but should persist.");
		assert.equal(record.result_text_truncated, false);
	} finally {
		rmSync(root, { recursive: true, force: true });
	}
});

test("executeFlowDeskAgentTaskV1 materializes typed reviewer verdict and complete lifecycle", async () => {
	const root = mkdtempSync(join(tmpdir(), "flowdesk-sync-reviewer-verdict-"));
	try {
		const verdict = {
			schema_version: "flowdesk.top_tier_review_verdict.v1",
			verdict_id: "verdict-sync-agent-task",
			workflow_id: "workflow-sync-reviewer-verdict",
			attempt_id: "attempt-sync-agent-task",
			lane_id: "lane-sync-reviewer-verdict",
			lane_plan_ref: "lane-plan-sync-agent-task",
			binding_ref: "binding-sync-agent-task",
			perspective: "architecture",
			source: "gpt_frontier",
			created_at: "2026-05-31T00:00:00.000Z",
			scored_at: "2026-05-31T00:00:00.000Z",
			redaction_version: "v1",
			findings: [],
			evidence_refs: ["evidence-sync-agent-task"],
			uncertainty: "low",
			required_fixes: [],
			verdict_label: "pass",
			safe_next_actions: ["/flowdesk-status"],
			dispatch_authority_enabled: false,
			guard_replacement_authority_enabled: false,
		};
		const client = makeClient({
			messages: async () => ([{ role: "assistant", parts: [{ type: "text", text: JSON.stringify(verdict) }, { type: "step-finish", reason: "stop" }] }]),
		});
		const result = await executeFlowDeskAgentTaskV1({
			workflowId: "workflow-sync-reviewer-verdict",
			taskId: "task-sync-reviewer-verdict",
			laneId: "lane-sync-reviewer-verdict",
			agentRef: "agent-reviewer-gpt-frontier",
			providerQualifiedModelId: "openai/gpt-5.5",
			promptText: "return typed verdict",
			parentSessionId: "parent-1",
			rootDir: root,
			client,
			_launchTimeoutMs: 5_000,
			_messagesTimeoutMs: 100,
		});

		assert.equal(result.status, "task_completed");
		const reloaded = reloadFlowDeskSessionEvidenceV1({ rootDir: root, workflowId: "workflow-sync-reviewer-verdict" });
		assert.ok(reloaded.ok);
		assert.equal(reloaded.entries.some(e => e.evidenceClass === "reviewer_verdict" && e.evidenceId === "verdict-sync-agent-task"), true);
		const completeLifecycle = reloaded.entries.find(e => e.evidenceClass === "lane_lifecycle" && (e.record as Record<string, unknown>).verdict_ref === "verdict-sync-agent-task");
		assert.ok(completeLifecycle, "complete verdict-linked lifecycle should be written");
		assert.equal((completeLifecycle.record as Record<string, unknown>).state, "complete");
	} finally {
		rmSync(root, { recursive: true, force: true });
	}
});

test("monitorChildSessions reads structured session.messages shape before flat fallback", async () => {
	const root = mkdtempSync(join(tmpdir(), "flowdesk-monitor-structured-shape-"));
	try {
		const seenOptions: unknown[] = [];
		const launchClient = makeClient({});
		await executeFlowDeskAgentTaskV1({
			workflowId: "workflow-monitor-structured-shape",
			taskId: "task-structured-shape",
			laneId: "lane-structured-shape",
			agentRef: "agent-test",
			providerQualifiedModelId: "openai/gpt-5.5",
			promptText: "analyze",
			parentSessionId: "parent-1",
			rootDir: root,
			client: launchClient,
			asyncMode: true,
			_launchTimeoutMs: 5_000,
			_messagesTimeoutMs: 100,
		});

		const monitorClient = makeClient({
			messages: async (options) => {
				seenOptions.push(options);
				const record = options as Record<string, unknown>;
				if (typeof record.path === "object" && record.path !== null && (record.path as Record<string, unknown>).id === "ses-child-test-01") {
					return { data: { messages: [{ info: { role: "assistant" }, parts: [{ type: "text", text: "structured shape done" }, { type: "step-finish", reason: "stop" }] }] } };
				}
				throw new Error("flat sessionID shape should not be needed");
			},
		});
		const monResult = await monitorChildSessionsV1({
			rootDir: root,
			workflowId: "workflow-monitor-structured-shape",
			client: monitorClient,
			now: new Date(),
		});

		assert.equal(monResult.lanesCompleted, 1);
		assert.equal(seenOptions.some((option) => (option as Record<string, unknown>).sessionID !== undefined), false);
		assert.equal(seenOptions.some((option) => typeof (option as Record<string, unknown>).path === "object"), true);
		const reloaded = reloadFlowDeskSessionEvidenceV1({ rootDir: root, workflowId: "workflow-monitor-structured-shape" });
		const taskResult = reloaded.entries.find(e => e.evidenceClass === "task_result");
		assert.equal((taskResult?.record as Record<string, unknown>).result_text, "structured shape done");
		assert.equal((taskResult?.record as Record<string, unknown>).finalization_reason, "terminal_marker");
		const progress = reloaded.entries.find(e => e.evidenceClass === "agent_task_progress" && (e.record as Record<string, unknown>).phase === "finalizing");
		assert.equal((progress?.record as Record<string, unknown>).progress_label, "async agent task result captured by watchdog");
	} finally {
		rmSync(root, { recursive: true, force: true });
	}
});

test("monitorChildSessions falls back to flat session.messages shape after structured SDK error", async () => {
	const root = mkdtempSync(join(tmpdir(), "flowdesk-monitor-flat-fallback-"));
	try {
		const seenOptions: unknown[] = [];
		await executeFlowDeskAgentTaskV1({
			workflowId: "workflow-monitor-flat-fallback",
			taskId: "task-flat-fallback",
			laneId: "lane-flat-fallback",
			agentRef: "agent-test",
			providerQualifiedModelId: "openai/gpt-5.5",
			promptText: "analyze",
			parentSessionId: "parent-1",
			rootDir: root,
			client: makeClient({}),
			asyncMode: true,
			_launchTimeoutMs: 5_000,
			_messagesTimeoutMs: 100,
		});

		const monitorClient = makeClient({
			messages: async (options) => {
				seenOptions.push(options);
				const record = options as Record<string, unknown>;
				if (typeof record.path === "object") return { error: { name: "NotFound", message: "structured shape unavailable" } };
				if (record.sessionID === "ses-child-test-01") {
					return [{ role: "assistant", parts: [{ type: "text", text: "flat fallback done" }, { type: "step-finish", reason: "stop" }] }];
				}
				return [];
			},
		});
		const monResult = await monitorChildSessionsV1({
			rootDir: root,
			workflowId: "workflow-monitor-flat-fallback",
			client: monitorClient,
			now: new Date(),
		});

		assert.equal(monResult.lanesCompleted, 1);
		assert.equal(seenOptions.some((option) => typeof (option as Record<string, unknown>).path === "object"), true);
		assert.equal(seenOptions.some((option) => (option as Record<string, unknown>).sessionID === "ses-child-test-01"), true);
		const reloaded = reloadFlowDeskSessionEvidenceV1({ rootDir: root, workflowId: "workflow-monitor-flat-fallback" });
		const taskResult = reloaded.entries.find(e => e.evidenceClass === "task_result");
		assert.equal((taskResult?.record as Record<string, unknown>).result_text, "flat fallback done");
		assert.equal((taskResult?.record as Record<string, unknown>).finalization_reason, "terminal_marker");
	} finally {
		rmSync(root, { recursive: true, force: true });
	}
});

test("executeFlowDeskAgentTaskV1 captures single-message SDK response with step-finish", async () => {
	const root = mkdtempSync(join(tmpdir(), "flowdesk-sync-single-message-"));
	try {
		const client = makeClient({
			messages: async () => ({
				info: { role: "assistant" },
				parts: [{ type: "text", text: "single message final answer" }, { type: "step-finish", reason: "stop" }],
			}),
		});
		const result = await executeFlowDeskAgentTaskV1({
			workflowId: "workflow-sync-single-message",
			taskId: "task-sync-single-message",
			laneId: "lane-sync-single-message",
			agentRef: "agent-test",
			providerQualifiedModelId: "openai/gpt-5.5",
			promptText: "work",
			parentSessionId: "parent-1",
			rootDir: root,
			client,
			_launchTimeoutMs: 5_000,
			_messagesTimeoutMs: 100,
		});

		assert.equal(result.status, "task_completed");
		const reloaded = reloadFlowDeskSessionEvidenceV1({ rootDir: root, workflowId: "workflow-sync-single-message" });
		assert.ok(reloaded.ok);
		const taskResult = reloaded.entries.find(e => e.evidenceClass === "task_result");
		assert.equal((taskResult?.record as Record<string, unknown>).result_text, "single message final answer");
		assert.equal((taskResult?.record as Record<string, unknown>).finalization_reason, "terminal_marker");
	} finally {
		rmSync(root, { recursive: true, force: true });
	}
});

test("monitorChildSessions captures single-message SDK response with step-finish", async () => {
	const root = mkdtempSync(join(tmpdir(), "flowdesk-monitor-single-message-"));
	try {
		const launchClient = makeClient({});
		await executeFlowDeskAgentTaskV1({
			workflowId: "workflow-monitor-single-message",
			taskId: "task-monitor-single-message",
			laneId: "lane-monitor-single-message",
			agentRef: "agent-test",
			providerQualifiedModelId: "openai/gpt-5.5",
			promptText: "analyze",
			parentSessionId: "parent-1",
			rootDir: root,
			client: launchClient,
			asyncMode: true,
			_launchTimeoutMs: 5_000,
			_messagesTimeoutMs: 100,
		});

		const monitorClient = makeClient({
			messages: async () => ({
				info: { role: "assistant" },
				parts: [{ type: "text", text: "watchdog single message final answer" }, { type: "step-finish", reason: "stop" }],
			}),
		});
		const monResult = await monitorChildSessionsV1({
			rootDir: root,
			workflowId: "workflow-monitor-single-message",
			client: monitorClient,
			now: new Date(),
		});

		assert.equal(monResult.lanesCompleted, 1);
		const reloaded = reloadFlowDeskSessionEvidenceV1({ rootDir: root, workflowId: "workflow-monitor-single-message" });
		assert.ok(reloaded.ok);
		const taskResult = reloaded.entries.find(e => e.evidenceClass === "task_result");
		assert.equal((taskResult?.record as Record<string, unknown>).result_text, "watchdog single message final answer");
		assert.equal((taskResult?.record as Record<string, unknown>).finalization_reason, "terminal_marker");
		assert.equal(reloaded.entries.some(e => e.evidenceClass === "agent_task_inconsistency"), false);
	} finally {
		rmSync(root, { recursive: true, force: true });
	}
});

test("monitorChildSessions keeps empty turn_completed awaiting body capture before retry window expires", async () => {
	const root = mkdtempSync(join(tmpdir(), "flowdesk-monitor-turn-empty-awaiting-"));
	try {
		const workflowId = "workflow-monitor-turn-empty-awaiting";
		const laneId = "lane-turn-empty-awaiting";
		const taskId = "task-turn-empty-awaiting";
		await executeFlowDeskAgentTaskV1({
			workflowId,
			taskId,
			laneId,
			agentRef: "agent-test",
			providerQualifiedModelId: "openai/gpt-5.5",
			promptText: "analyze",
			parentSessionId: "parent-1",
			rootDir: root,
			client: makeClient({}),
			asyncMode: true,
			_launchTimeoutMs: 5_000,
			_messagesTimeoutMs: 100,
		});

		const initial = reloadFlowDeskSessionEvidenceV1({ rootDir: root, workflowId });
		const child = initial.entries.find(e => e.evidenceClass === "agent_task_child_session")?.record as Record<string, unknown> | undefined;
		const createdAtMs = Date.parse(String(child?.created_at));
		const turnCompletedAtMs = createdAtMs + 1_000;
		writeTurnCompletedProgress({ root, workflowId, laneId, taskId, observedAtMs: turnCompletedAtMs });

		const monResult = await monitorChildSessionsV1({
			rootDir: root,
			workflowId,
			client: makeClient({
				messages: async () => ({
					info: { role: "assistant" },
					parts: [{ type: "step-finish", reason: "stop" }],
				}),
			}),
			now: new Date(turnCompletedAtMs + 500),
			bodyRetryMax: 2,
			finalizingAbsoluteMaxMs: 60_000,
		});

		assert.equal(monResult.lanesCompleted, 0);
		assert.equal(monResult.lanesAborted, 0);
		assert.equal(monResult.lanesAwaitingCapture, 1);
		const reloaded = reloadFlowDeskSessionEvidenceV1({ rootDir: root, workflowId });
		assert.equal(reloaded.entries.some(e => e.evidenceClass === "task_result"), false);
		assert.equal(reloaded.entries.some(e => e.evidenceClass === "task_failed"), false, "empty turn_completed must not terminalize before retry/absolute windows expire");
		const finalizationEvidence = reloaded.entries.filter(e => e.evidenceClass === "session_finalization_evidence");
		assert.equal(finalizationEvidence.length, 1, "empty step-finish should write one finalization evidence record");
		const finalizationRecord = finalizationEvidence[0]?.record as Record<string, unknown>;
		assert.equal(finalizationRecord.decision, "awaiting_body_capture");
		assert.equal(finalizationRecord.safe_capture_ready, false);
		assert.equal(finalizationRecord.dispatch_authority_enabled, false);
		assert.equal(finalizationRecord.provider_call_made, false);
		assert.equal(finalizationRecord.runtime_execution, false);
		assert.equal(finalizationRecord.actual_lane_launch, false);
		assert.equal(finalizationRecord.fallback_authority_enabled, false);
		assert.equal(finalizationRecord.write_authority_enabled, false);
		assert.equal(finalizationRecord.opencode_internal_validation_performed, false);
		assert.equal("result_text" in finalizationRecord, false, "finalization evidence must not store raw text");
		const childAfter = reloaded.entries.find(e => e.evidenceClass === "agent_task_child_session")?.record as Record<string, unknown> | undefined;
		assert.equal(childAfter?.awaiting_body_capture_attempts, 1);
		assert.equal(childAfter?.capture_failure_diagnostic_reason, "awaiting_body_capture_empty");

		await monitorChildSessionsV1({
			rootDir: root,
			workflowId,
			client: makeClient({
				messages: async () => ({
					info: { role: "assistant" },
					parts: [{ type: "step-finish", reason: "stop" }],
				}),
			}),
			now: new Date(turnCompletedAtMs + 1_500),
			bodyRetryMax: 2,
			finalizingAbsoluteMaxMs: 60_000,
		});
		const afterSecond = reloadFlowDeskSessionEvidenceV1({ rootDir: root, workflowId });
		assert.equal(afterSecond.entries.filter(e => e.evidenceClass === "session_finalization_evidence").length, 1, "same awaiting transition should not duplicate finalization evidence");
		assert.equal(afterSecond.entries.some(e => e.evidenceClass === "task_result"), false);
		assert.equal(afterSecond.entries.some(e => e.evidenceClass === "task_failed"), false);
	} finally {
		rmSync(root, { recursive: true, force: true });
	}
});

test("monitorChildSessions persists late body after initial empty turn_completed", async () => {
	const root = mkdtempSync(join(tmpdir(), "flowdesk-monitor-turn-empty-late-body-"));
	try {
		const workflowId = "workflow-monitor-turn-empty-late-body";
		const laneId = "lane-turn-empty-late-body";
		const taskId = "task-turn-empty-late-body";
		await executeFlowDeskAgentTaskV1({
			workflowId,
			taskId,
			laneId,
			agentRef: "agent-test",
			providerQualifiedModelId: "openai/gpt-5.5",
			promptText: "analyze",
			parentSessionId: "parent-1",
			rootDir: root,
			client: makeClient({}),
			asyncMode: true,
			_launchTimeoutMs: 5_000,
			_messagesTimeoutMs: 100,
		});

		const initial = reloadFlowDeskSessionEvidenceV1({ rootDir: root, workflowId });
		const child = initial.entries.find(e => e.evidenceClass === "agent_task_child_session")?.record as Record<string, unknown> | undefined;
		const createdAtMs = Date.parse(String(child?.created_at));
		const turnCompletedAtMs = createdAtMs + 1_000;
		writeTurnCompletedProgress({ root, workflowId, laneId, taskId, observedAtMs: turnCompletedAtMs });

		const emptyClient = makeClient({
			messages: async () => ({ info: { role: "assistant" }, parts: [{ type: "step-finish", reason: "stop" }] }),
		});
		const first = await monitorChildSessionsV1({
			rootDir: root,
			workflowId,
			client: emptyClient,
			now: new Date(turnCompletedAtMs + 500),
			bodyRetryMax: 2,
			finalizingAbsoluteMaxMs: 60_000,
		});
		assert.equal(first.lanesAwaitingCapture, 1);

		const lateBodyClient = makeClient({
			messages: async () => ({
				info: { role: "assistant" },
				parts: [{ type: "text", text: "late final answer after empty turn_completed" }, { type: "step-finish", reason: "stop" }],
			}),
		});
		const second = await monitorChildSessionsV1({
			rootDir: root,
			workflowId,
			client: lateBodyClient,
			now: new Date(turnCompletedAtMs + 2_500),
			bodyRetryMax: 2,
			finalizingAbsoluteMaxMs: 60_000,
		});

		assert.equal(second.lanesCompleted, 1);
		assert.equal(second.lanesAborted, 0);
		const reloaded = reloadFlowDeskSessionEvidenceV1({ rootDir: root, workflowId });
		assert.equal(reloaded.entries.some(e => e.evidenceClass === "task_failed"), false);
		const taskResult = reloaded.entries.find(e => e.evidenceClass === "task_result")?.record as Record<string, unknown> | undefined;
		assert.equal(taskResult?.result_text, "late final answer after empty turn_completed");
		assert.equal(taskResult?.finalization_reason, "terminal_marker");
		assert.equal(taskResult?.capture_status, "captured");
		const finalizationEvidence = reloaded.entries.filter(e => e.evidenceClass === "session_finalization_evidence");
		assert.equal(finalizationEvidence.length, 2, "awaiting and safe-capture transitions should both be represented");
		const safeEvidence = finalizationEvidence
			.map(e => e.record as Record<string, unknown>)
			.find(record => record.decision === "safe_capture_ready");
		assert.ok(safeEvidence, "safe final text observation should write finalization evidence");
		assert.equal(safeEvidence?.safe_capture_ready, true);
		assert.equal(safeEvidence?.usable_for_synthesis, true);
		assert.equal(safeEvidence?.observed_text_char_count, "late final answer after empty turn_completed".length);
		assert.match(String(safeEvidence?.observed_text_ref), /^observed-text-sha256-[a-f0-9]{64}$/);
		assert.equal("result_text" in safeEvidence!, false, "safe finalization evidence must not store raw text");
		assert.equal(String(JSON.stringify(safeEvidence)).includes("late final answer after empty turn_completed"), false);
		assert.equal(safeEvidence?.dispatch_authority_enabled, false);
		assert.equal(safeEvidence?.provider_call_made, false);
		assert.equal(safeEvidence?.runtime_execution, false);
		assert.equal(safeEvidence?.actual_lane_launch, false);
		assert.equal(safeEvidence?.fallback_authority_enabled, false);
		assert.equal(safeEvidence?.write_authority_enabled, false);
		assert.equal(safeEvidence?.opencode_internal_validation_performed, false);
	} finally {
		rmSync(root, { recursive: true, force: true });
	}
});

test("monitorChildSessions does not terminalize no_output only because empty turn_completed retry budget expires", async () => {
	const root = mkdtempSync(join(tmpdir(), "flowdesk-monitor-turn-empty-terminal-"));
	try {
		const workflowId = "workflow-monitor-turn-empty-terminal";
		const laneId = "lane-turn-empty-terminal";
		const taskId = "task-turn-empty-terminal";
		await executeFlowDeskAgentTaskV1({
			workflowId,
			taskId,
			laneId,
			agentRef: "agent-test",
			providerQualifiedModelId: "openai/gpt-5.5",
			promptText: "analyze",
			parentSessionId: "parent-1",
			rootDir: root,
			client: makeClient({}),
			asyncMode: true,
			_launchTimeoutMs: 5_000,
			_messagesTimeoutMs: 100,
		});

		const initial = reloadFlowDeskSessionEvidenceV1({ rootDir: root, workflowId });
		const child = initial.entries.find(e => e.evidenceClass === "agent_task_child_session")?.record as Record<string, unknown> | undefined;
		const createdAtMs = Date.parse(String(child?.created_at));
		const turnCompletedAtMs = createdAtMs + 1_000;
		writeTurnCompletedProgress({ root, workflowId, laneId, taskId, observedAtMs: turnCompletedAtMs });

		const emptyClient = makeClient({
			messages: async () => ({ info: { role: "assistant" }, parts: [{ type: "step-finish", reason: "stop" }] }),
			promptAsync: async () => { throw new Error("repair prompt unavailable in test"); },
		});
		const first = await monitorChildSessionsV1({
			rootDir: root,
			workflowId,
			client: emptyClient,
			now: new Date(turnCompletedAtMs + 500),
			bodyRetryMax: 1,
			finalizingAbsoluteMaxMs: 60_000,
		});
		assert.equal(first.lanesAwaitingCapture, 1);
		let reloaded = reloadFlowDeskSessionEvidenceV1({ rootDir: root, workflowId });
		assert.equal(reloaded.entries.some(e => e.evidenceClass === "task_failed"), false, "first empty turn_completed remains repairable");

		const second = await monitorChildSessionsV1({
			rootDir: root,
			workflowId,
			client: emptyClient,
			now: new Date(turnCompletedAtMs + 3_000),
			bodyRetryMax: 1,
			finalizingAbsoluteMaxMs: 60_000,
		});

		assert.equal(second.lanesAborted, 0);
		reloaded = reloadFlowDeskSessionEvidenceV1({ rootDir: root, workflowId });
		assert.equal(reloaded.entries.some(e => e.evidenceClass === "task_result"), false);
		assert.equal(reloaded.entries.some(e => e.evidenceClass === "task_failed"), false, "step-finish plus empty body is not terminal no_output by itself");
		const childAfter = reloaded.entries.find(e => e.evidenceClass === "agent_task_child_session")?.record as Record<string, unknown> | undefined;
		assert.ok(
			childAfter?.capture_failure_diagnostic_reason === "awaiting_session_quiescence_empty" ||
			childAfter?.capture_failure_diagnostic_reason === "turn_completed_empty_repair_prompt",
			"empty step-finish should stay pending/repairable instead of terminalizing",
		);

		const lateBodyClient = makeClient({
			messages: async () => ({ info: { role: "assistant" }, parts: [{ type: "text", text: "final text after exhausted empty step-finish retries" }, { type: "step-finish", reason: "stop" }] }),
		});
		const third = await monitorChildSessionsV1({
			rootDir: root,
			workflowId,
			client: lateBodyClient,
			now: new Date(turnCompletedAtMs + 4_000),
			bodyRetryMax: 1,
			finalizingAbsoluteMaxMs: 60_000,
		});
		assert.equal(third.lanesCompleted, 1);
		reloaded = reloadFlowDeskSessionEvidenceV1({ rootDir: root, workflowId });
		const taskResult = reloaded.entries.find(e => e.evidenceClass === "task_result")?.record as Record<string, unknown> | undefined;
		assert.equal(taskResult?.result_text, "final text after exhausted empty step-finish retries");
		assert.equal(reloaded.entries.some(e => e.evidenceClass === "task_failed"), false);
	} finally {
		rmSync(root, { recursive: true, force: true });
	}
});

test("monitorChildSessions records overdue tool diagnostic without aborting or failing lane", async () => {
	const root = mkdtempSync(join(tmpdir(), "flowdesk-monitor-tool-overdue-"));
	try {
		const workflowId = "workflow-monitor-tool-overdue";
		const laneId = "lane-tool-overdue";
		const taskId = "task-tool-overdue";
		let abortCalls = 0;
		await executeFlowDeskAgentTaskV1({
			workflowId,
			taskId,
			laneId,
			agentRef: "agent-test",
			providerQualifiedModelId: "openai/gpt-5.5",
			promptText: "analyze",
			parentSessionId: "parent-1",
			rootDir: root,
			client: makeClient({}),
			asyncMode: true,
			_launchTimeoutMs: 5_000,
			_messagesTimeoutMs: 100,
		});

		const initial = reloadFlowDeskSessionEvidenceV1({ rootDir: root, workflowId });
		const child = initial.entries.find(e => e.evidenceClass === "agent_task_child_session")?.record as Record<string, unknown> | undefined;
		const openedAt = new Date(Date.parse(String(child?.created_at)) + 1_000).toISOString();
		const progress = prepareFlowDeskSessionEvidenceWriteIntentV1({
			workflowId,
			evidenceId: "agent-task-progress-tool-overdue-running",
			record: {
				schema_version: "flowdesk.agent_task_progress.v1",
				workflow_id: workflowId,
				lane_id: laneId,
				task_id: taskId,
				agent_ref: "agent-test",
				provider_qualified_model_id: "openai/gpt-5.5",
				progress_seq: 2,
				observed_at: openedAt,
				phase: "waiting",
				progress_label: "agent task tool running callid=glob-call-overdue-1",
				progress_ref: "progress-tool-overdue-running",
				redaction_version: "v1",
				dispatch_authority_enabled: false,
			},
		});
		assert.equal(progress.ok, true, progress.errors?.join("; "));
		assert.equal(applyFlowDeskSessionEvidenceWriteIntentsV1(root, [progress.writeIntent as never]).ok, true);

		const monitorClient = makeClient({
			messages: async () => ({
				info: { role: "assistant" },
				parts: [{ type: "tool", callID: "glob-call-overdue-1", state: { status: "running" } }],
			}),
			abort: async () => { abortCalls++; },
		});
		const monResult = await monitorChildSessionsV1({
			rootDir: root,
			workflowId,
			client: monitorClient,
			now: new Date(Date.parse(openedAt) + 65_000),
			staleToolMs: 60_000,
			unknownStateMaxMs: 1_000,
			absoluteLaneAgeMs: 61_000,
			abortThresholdMs: 1_000,
		});

		assert.equal(monResult.lanesPolled, 1);
		assert.equal(monResult.lanesAborted, 0);
		assert.equal(abortCalls, 0, "watchdog must not abort solely because tool state is unknown/overdue");
		const reloaded = reloadFlowDeskSessionEvidenceV1({ rootDir: root, workflowId });
		assert.ok(reloaded.ok);
		assert.equal(reloaded.entries.some(e => e.evidenceClass === "task_failed"), false);
		assert.equal(reloaded.entries.some(e => e.evidenceClass === "lane_lifecycle" && (e.record as Record<string, unknown>).state !== "running"), false);
		const inconsistency = reloaded.entries.find(e => e.evidenceClass === "agent_task_inconsistency")?.record as Record<string, unknown> | undefined;
		assert.equal(inconsistency?.inconsistency_kind, "tool_run_overdue_observed");
		assert.match(String(inconsistency?.grace_source_label), /underlying child abort not confirmed/);
		assert.equal(inconsistency?.grace_window_ms, 60_000);
		const diagnosticProgress = reloaded.entries.find(e => e.evidenceClass === "agent_task_progress" && String((e.record as Record<string, unknown>).progress_label).includes("tool_run_overdue_observed"));
		assert.ok(diagnosticProgress, "overdue tool diagnostic progress should be written");
		const childAfterDiagnostic = reloaded.entries.find(e => e.evidenceClass === "agent_task_child_session")?.record as Record<string, unknown> | undefined;
		assert.equal(childAfterDiagnostic?.capture_failure_diagnostic_reason, "tool_run_overdue_observed");
		assert.equal(childAfterDiagnostic?.capture_failure_running_tool_call_id, "glob-call-overdue-1");
		assert.equal(childAfterDiagnostic?.capture_failure_running_tool_status, "running");
		const wakeCache = JSON.parse(readFileSync(join(root, ".flowdesk", "ui", "completion-wake-ready.json"), "utf8")) as Record<string, unknown>;
		const wakeRows = wakeCache.rows as Array<Record<string, unknown>>;
		const diagnosticWake = wakeRows.find(row => row.completionKind === "diagnostic_attention");
		assert.ok(diagnosticWake, "stale tool diagnostic should enqueue one advisory main wake row");
		assert.equal(diagnosticWake.notificationLabel, "FlowDesk lane diagnostic attention requested");
		assert.equal(wakeRows.filter(row => row.completionKind === "awaiting_permission").length, 0, "stale tool attention must remain distinct from permission awaiting");

		await monitorChildSessionsV1({
			rootDir: root,
			workflowId,
			client: monitorClient,
			now: new Date(Date.parse(openedAt) + 70_000),
			staleToolMs: 60_000,
			abortThresholdMs: 1_000,
		});
		const reloadedAgain = reloadFlowDeskSessionEvidenceV1({ rootDir: root, workflowId });
		assert.equal(reloadedAgain.entries.filter(e => e.evidenceClass === "agent_task_inconsistency").length, 1);
		assert.equal(reloadedAgain.entries.filter(e => e.evidenceClass === "agent_task_progress" && String((e.record as Record<string, unknown>).progress_label).includes("tool_run_overdue_observed")).length, 1);
		const wakeCacheAgain = JSON.parse(readFileSync(join(root, ".flowdesk", "ui", "completion-wake-ready.json"), "utf8")) as Record<string, unknown>;
		const wakeRowsAgain = wakeCacheAgain.rows as Array<Record<string, unknown>>;
		assert.equal(wakeRowsAgain.filter(row => row.completionKind === "diagnostic_attention").length, 1, "duplicate stale tool events must not spam wake rows");
	} finally {
		rmSync(root, { recursive: true, force: true });
	}
});

test("monitorChildSessions wakes coordinator for aborted tool snapshot without auto-terminalizing", async () => {
	const root = mkdtempSync(join(tmpdir(), "flowdesk-monitor-tool-error-reconcile-"));
	try {
		const workflowId = "workflow-monitor-tool-error-reconcile";
		const laneId = "lane-tool-error-reconcile";
		const taskId = "task-tool-error-reconcile";
		let abortCalls = 0;
		await executeFlowDeskAgentTaskV1({
			workflowId,
			taskId,
			laneId,
			agentRef: "agent-test",
			providerQualifiedModelId: "openai/gpt-5.5",
			promptText: "analyze",
			parentSessionId: "parent-1",
			rootDir: root,
			client: makeClient({}),
			asyncMode: true,
			_launchTimeoutMs: 5_000,
			_messagesTimeoutMs: 100,
		});

		const initial = reloadFlowDeskSessionEvidenceV1({ rootDir: root, workflowId });
		const child = initial.entries.find(e => e.evidenceClass === "agent_task_child_session")?.record as Record<string, unknown> | undefined;
		const openedAt = new Date(Date.parse(String(child?.created_at)) + 1_000).toISOString();
		const progress = prepareFlowDeskSessionEvidenceWriteIntentV1({
			workflowId,
			evidenceId: "agent-task-progress-tool-error-reconcile-running",
			record: {
				schema_version: "flowdesk.agent_task_progress.v1",
				workflow_id: workflowId,
				lane_id: laneId,
				task_id: taskId,
				agent_ref: "agent-test",
				provider_qualified_model_id: "openai/gpt-5.5",
				progress_seq: 2,
				observed_at: openedAt,
				phase: "waiting",
				progress_label: "agent task tool running callid=bash-call-aborted-1",
				progress_ref: "progress-tool-error-reconcile-running",
				redaction_version: "v1",
				dispatch_authority_enabled: false,
			},
		});
		assert.equal(progress.ok, true, progress.errors?.join("; "));
		assert.equal(applyFlowDeskSessionEvidenceWriteIntentsV1(root, [progress.writeIntent as never]).ok, true);

		const monitorClient = makeClient({
			messages: async () => ({
				info: { role: "assistant" },
				parts: [{
					type: "tool",
					callID: "bash-call-aborted-1",
					state: { status: "error" },
					error: { name: "MessageAbortedError", message: "Tool execution aborted" },
				}],
			}),
			abort: async () => { abortCalls++; },
		});
		const monResult = await monitorChildSessionsV1({
			rootDir: root,
			workflowId,
			client: monitorClient,
			now: new Date(Date.parse(openedAt) + 65_000),
			staleToolMs: 60_000,
			absoluteLaneAgeMs: 600_000,
			abortThresholdMs: 1_000,
		});

		assert.equal(monResult.lanesPolled, 1);
		assert.equal(monResult.lanesAborted, 0);
		assert.equal(abortCalls, 0, "snapshot reconciliation must not add abort/runtime authority");

		const reloaded = reloadFlowDeskSessionEvidenceV1({ rootDir: root, workflowId });
		assert.ok(reloaded.ok);
		// Wake-only: no task_failed, no terminal lifecycle — coordinator judges
		assert.equal(reloaded.entries.some(e => e.evidenceClass === "task_failed"), false, "tool error/aborted must not auto-write task_failed; coordinator decides");
		assert.equal(reloaded.entries.some(e => e.evidenceClass === "lane_lifecycle" && (e.record as Record<string, unknown>).state === "no_output"), false, "tool error/aborted must not auto-write terminal lifecycle");
		const progressRecords = reloaded.entries
			.filter(e => e.evidenceClass === "agent_task_progress")
			.map(e => e.record as Record<string, unknown>);
		assert.equal(progressRecords.some(rec => String(rec.progress_label).includes("tool error callid=bash-call-aborted-1") || String(rec.progress_label).includes("tool_execution_aborted")), true, "bounded diagnostic progress should close the call id or record attention");
		const toolTransitions = progressRecords
			.filter(rec => typeof rec.observed_at === "string" && typeof rec.progress_label === "string" && String(rec.progress_label).startsWith("agent task tool "))
			.map(rec => ({ observedAtMs: Date.parse(String(rec.observed_at)), label: String(rec.progress_label) }))
			.sort((a, b) => a.observedAtMs - b.observedAtMs);
		const toolState = deriveFlowDeskLaneToolStateV1({
			transitions: toolTransitions,
			nowMs: Date.parse(openedAt) + 65_000,
			staleToolMs: 60_000,
		});
		assert.equal(toolState.toolRunningNow, false);
		assert.equal(toolState.toolStateUnknown, false);
		for (const entry of reloaded.entries) {
			const record = entry.record as Record<string, unknown>;
			assert.notEqual(record.dispatch_authority_enabled, true);
			assert.notEqual(record.fallback_authority_enabled, true);
			assert.notEqual(record.write_authority_enabled, true);
			assert.notEqual(record.hard_chat_authority_enabled, true);
		}
	} finally {
		rmSync(root, { recursive: true, force: true });
	}
});

test("monitorChildSessions blocks final text capture before overdue tool diagnostic when tool state is unknown", async () => {
	const root = mkdtempSync(join(tmpdir(), "flowdesk-monitor-tool-overdue-final-"));
	try {
		const workflowId = "workflow-monitor-tool-overdue-final";
		const laneId = "lane-tool-overdue-final";
		const taskId = "task-tool-overdue-final";
		await executeFlowDeskAgentTaskV1({
			workflowId,
			taskId,
			laneId,
			agentRef: "agent-test",
			providerQualifiedModelId: "openai/gpt-5.5",
			promptText: "analyze",
			parentSessionId: "parent-1",
			rootDir: root,
			client: makeClient({}),
			asyncMode: true,
			_launchTimeoutMs: 5_000,
			_messagesTimeoutMs: 100,
		});
		const initial = reloadFlowDeskSessionEvidenceV1({ rootDir: root, workflowId });
		const child = initial.entries.find(e => e.evidenceClass === "agent_task_child_session")?.record as Record<string, unknown> | undefined;
		const openedAt = new Date(Date.parse(String(child?.created_at)) + 1_000).toISOString();
		const progress = prepareFlowDeskSessionEvidenceWriteIntentV1({
			workflowId,
			evidenceId: "agent-task-progress-tool-overdue-final-running",
			record: {
				schema_version: "flowdesk.agent_task_progress.v1",
				workflow_id: workflowId,
				lane_id: laneId,
				task_id: taskId,
				agent_ref: "agent-test",
				provider_qualified_model_id: "openai/gpt-5.5",
				progress_seq: 2,
				observed_at: openedAt,
				phase: "waiting",
				progress_label: "agent task tool running callid=call-overdue-final-1",
				progress_ref: "progress-tool-overdue-final-running",
				redaction_version: "v1",
				dispatch_authority_enabled: false,
			},
		});
		assert.equal(progress.ok, true, progress.errors?.join("; "));
		assert.equal(applyFlowDeskSessionEvidenceWriteIntentsV1(root, [progress.writeIntent as never]).ok, true);

		const monResult = await monitorChildSessionsV1({
			rootDir: root,
			workflowId,
			client: makeClient({
				messages: async () => ([{ role: "assistant", parts: [{ type: "text", text: "final after tool" }, { type: "step-finish", reason: "stop" }] }]),
			}),
			now: new Date(Date.parse(openedAt) + 65_000),
			staleToolMs: 60_000,
			abortThresholdMs: 1_000,
		});

		assert.equal(monResult.lanesCompleted, 0);
		const reloaded = reloadFlowDeskSessionEvidenceV1({ rootDir: root, workflowId });
		assert.equal(reloaded.entries.some(e => e.evidenceClass === "task_result"), false);
		const finalization = reloaded.entries.find(e => e.evidenceClass === "session_finalization_evidence")?.record as Record<string, unknown> | undefined;
		assert.equal(finalization?.decision, "requires_review");
		assert.equal(finalization?.block_reason, "tool_state_unknown");
		assert.equal(finalization?.safe_capture_ready, false);
	} finally {
		rmSync(root, { recursive: true, force: true });
	}
});

test("monitorChildSessions waits for terminal marker and ignores reasoning parts", async () => {
	const root = mkdtempSync(join(tmpdir(), "flowdesk-monitor-terminal-aware-"));
	try {
		const launchClient = makeClient({});
		await executeFlowDeskAgentTaskV1({
			workflowId: "workflow-monitor-terminal-aware",
			taskId: "task-terminal-aware",
			laneId: "lane-terminal-aware",
			agentRef: "agent-test",
			providerQualifiedModelId: "openai/gpt-5.5",
			promptText: "analyze",
			parentSessionId: "parent-1",
			rootDir: root,
			client: launchClient,
			asyncMode: true,
			_launchTimeoutMs: 5_000,
			_messagesTimeoutMs: 100,
		});

		const monitorClient = makeClient({
			messages: async () => ([{ role: "assistant", parts: [
				{ type: "reasoning", text: "I am planning the answer" },
				{ type: "text", text: "FINAL_TERMINAL_AWARE_OK" },
				{ type: "step-finish", reason: "stop" },
			] }]),
		});
		const monResult = await monitorChildSessionsV1({
			rootDir: root,
			workflowId: "workflow-monitor-terminal-aware",
			client: monitorClient,
			now: new Date(),
		});

		assert.equal(monResult.lanesCompleted, 1);
		const reloaded = reloadFlowDeskSessionEvidenceV1({ rootDir: root, workflowId: "workflow-monitor-terminal-aware" });
		const taskResult = reloaded.entries.find(e => e.evidenceClass === "task_result");
		assert.equal((taskResult?.record as Record<string, unknown>).result_text, "FINAL_TERMINAL_AWARE_OK");
		assert.equal((taskResult?.record as Record<string, unknown>).completion_status, "final");
	} finally {
		rmSync(root, { recursive: true, force: true });
	}
});

test("monitorChildSessions does not finalize non-terminal candidate before abort threshold", async () => {
	const root = mkdtempSync(join(tmpdir(), "flowdesk-monitor-nonterminal-"));
	try {
		const launchClient = makeClient({});
		await executeFlowDeskAgentTaskV1({
			workflowId: "workflow-monitor-nonterminal",
			taskId: "task-nonterminal",
			laneId: "lane-nonterminal",
			agentRef: "agent-test",
			providerQualifiedModelId: "openai/gpt-5.5",
			promptText: "analyze",
			parentSessionId: "parent-1",
			rootDir: root,
			client: launchClient,
			asyncMode: true,
			_launchTimeoutMs: 5_000,
			_messagesTimeoutMs: 100,
		});

		const monitorClient = makeClient({
			messages: async () => ([{ role: "assistant", parts: [{ type: "text", text: "candidate only" }] }]),
		});
		const monResult = await monitorChildSessionsV1({
			rootDir: root,
			workflowId: "workflow-monitor-nonterminal",
			client: monitorClient,
			now: new Date(),
		});

		assert.equal(monResult.lanesCompleted, 0);
		const reloaded = reloadFlowDeskSessionEvidenceV1({ rootDir: root, workflowId: "workflow-monitor-nonterminal" });
		assert.equal(reloaded.entries.some(e => e.evidenceClass === "task_result"), false);
	} finally {
		rmSync(root, { recursive: true, force: true });
	}
});

test("monitorChildSessions does not write finalizing progress when task_result persistence fails", async () => {
	const root = mkdtempSync(join(tmpdir(), "flowdesk-monitor-result-write-fail-"));
	try {
		const launchClient = makeClient({});
		await executeFlowDeskAgentTaskV1({
			workflowId: "workflow-monitor-result-write-fail",
			taskId: "task-write-fail",
			laneId: "lane-write-fail",
			agentRef: "agent-test",
			providerQualifiedModelId: "openai/gpt-5.5",
			promptText: "analyze",
			parentSessionId: "parent-1",
			rootDir: root,
			client: launchClient,
			asyncMode: true,
			_launchTimeoutMs: 5_000,
			_messagesTimeoutMs: 100,
		});

		const monitorClient = makeClient({
			messages: async () => ([{ role: "assistant", parts: [{ type: "text", text: "done but cannot persist" }, { type: "step-finish", reason: "stop" }] }]),
		});
		const monResult = await monitorChildSessionsV1({
			rootDir: root,
			workflowId: "workflow-monitor-result-write-fail",
			client: monitorClient,
			now: new Date(),
			_forceTaskResultWriteFailureForTest: true,
		});

		assert.equal(monResult.lanesPolled, 1);
		assert.equal(monResult.lanesCompleted, 0);
		const reloaded = reloadFlowDeskSessionEvidenceV1({ rootDir: root, workflowId: "workflow-monitor-result-write-fail" });
		assert.equal(reloaded.entries.some(e => e.evidenceClass === "task_result"), false);
		const taskFailed = reloaded.entries.find(e => e.evidenceClass === "task_failed");
		assert.ok(taskFailed, "task_failed evidence should be written when task_result cannot persist");
		assert.equal((taskFailed.record as Record<string, unknown>).redacted_reason, "watchdog could not persist task_result evidence");
		const finalizing = reloaded.entries.find(e => e.evidenceClass === "agent_task_progress" && (e.record as Record<string, unknown>).phase === "finalizing");
		assert.equal(finalizing, undefined, "finalizing progress must not be written without task_result evidence");
		const failed = reloaded.entries.find(e => e.evidenceClass === "agent_task_progress" && (e.record as Record<string, unknown>).phase === "failed");
		assert.equal((failed?.record as Record<string, unknown>).progress_label, "async agent task result persistence failed");
	} finally {
		rmSync(root, { recursive: true, force: true });
	}
});

test("V11.4: monitorChildSessions does NOT send a silence-based nudge (nudge branch removed)", async () => {
	const root = mkdtempSync(join(tmpdir(), "flowdesk-monitor-no-nudge-"));
	try {
		const nudged: unknown[] = [];
		const client = makeClient({
			messages: async () => [],  // no response
			prompt: (o) => { nudged.push(o); return {}; },
		});
		await executeFlowDeskAgentTaskV1({
			workflowId: "workflow-nudge-1",
			taskId: "task-n1",
			laneId: "lane-n1",
			agentRef: "agent-test",
			providerQualifiedModelId: "openai/gpt-5.5",
			promptText: "work",
			parentSessionId: "parent-1",
			rootDir: root,
			client,
			asyncMode: true,
			_launchTimeoutMs: 5_000,
			_messagesTimeoutMs: 100,
		});

		// 25s of silence — past the old 20s nudge quiet period but below the 30s
		// abort threshold. V11.4 removed the silence-based nudge branch, so even
		// with allowRawPromptNoReplyNudge=true no nudge is sent and the lane is
		// not yet aborted. (Even if it were sent, it was a no-op by default.)
		const futureNow = new Date(Date.now() + 25_000);
		const monResult = await monitorChildSessionsV1({
			rootDir: root,
			workflowId: "workflow-nudge-1",
			client,
			now: futureNow,
			nudgeQuietPeriodMs: 20_000,
			abortThresholdMs: 30_000,
			allowRawPromptNoReplyNudge: true,
			maxIdleContinuations: 0,
		});

		assert.equal(monResult.lanesNudged, 0, "V11.4: no silence-based nudge");
		assert.equal(monResult.lanesAborted, 0, "below abort threshold");
		const hasNoReplyNudge = nudged.some(n => (n as Record<string, unknown>).noReply === true);
		assert.equal(hasNoReplyNudge, false, "no noReply nudge prompt may be sent");
	} finally {
		rmSync(root, { recursive: true, force: true });
	}
});

test("monitorChildSessions suspends nudge and abort while awaiting permission", async () => {
	const root = mkdtempSync(join(tmpdir(), "flowdesk-monitor-permission-wait-"));
	try {
		const nudged: unknown[] = [];
		const aborted: unknown[] = [];
		const client = makeClient({
			messages: async () => [],
			prompt: (o) => { nudged.push(o); return {}; },
			abort: async (o) => { aborted.push(o); },
		});
		await executeFlowDeskAgentTaskV1({
			workflowId: "workflow-permission-wait-1",
			taskId: "task-pw1",
			laneId: "lane-pw1",
			agentRef: "agent-test",
			providerQualifiedModelId: "openai/gpt-5.5",
			promptText: "work",
			parentSessionId: "parent-1",
			rootDir: root,
			client,
			asyncMode: true,
			_launchTimeoutMs: 5_000,
			_messagesTimeoutMs: 100,
		});
		nudged.length = 0;
		const prepared = prepareFlowDeskSessionEvidenceWriteIntentV1({
			workflowId: "workflow-permission-wait-1",
			evidenceId: "agent-task-progress-lane-pw1-permission-wait-test",
			record: {
				schema_version: "flowdesk.agent_task_progress.v1",
				workflow_id: "workflow-permission-wait-1",
				lane_id: "lane-pw1",
				task_id: "task-pw1",
				agent_ref: "agent-test",
				provider_qualified_model_id: "openai/gpt-5.5",
				progress_seq: 99,
				observed_at: new Date(Date.now() + 1_000).toISOString(),
				phase: "awaiting_permission",
				progress_label: "agent task awaiting OpenCode permission response",
				progress_ref: "progress-lane-pw1-permission-wait-test",
				redaction_version: "v1",
				dispatch_authority_enabled: false,
			},
		});
		assert.equal(prepared.ok, true, prepared.errors.join("; "));
		assert.equal(applyFlowDeskSessionEvidenceWriteIntentsV1(root, [prepared.writeIntent as never]).ok, true);

		const monResult = await monitorChildSessionsV1({
			rootDir: root,
			workflowId: "workflow-permission-wait-1",
			client,
			now: new Date(Date.now() + 120_000),
			nudgeQuietPeriodMs: 20_000,
			abortThresholdMs: 60_000,
		});

		assert.equal(monResult.lanesNudged, 0);
		assert.equal(monResult.lanesAborted, 0);
		assert.equal(nudged.length, 0);
		assert.equal(aborted.length, 0);
	} finally {
		rmSync(root, { recursive: true, force: true });
	}
});

test("monitorChildSessions aborts a stuck lane once silence exceeds the abort threshold (V11.4: no nudge budget required)", async () => {
	const root = mkdtempSync(join(tmpdir(), "flowdesk-monitor-abort-"));
	try {
		const aborted: unknown[] = [];
		const client = makeClient({
			messages: async () => [],
			abort: async (o) => { aborted.push(o); },
		});
		await executeFlowDeskAgentTaskV1({
			workflowId: "workflow-abort-1",
			taskId: "task-a1",
			laneId: "lane-a1",
			agentRef: "agent-test",
			providerQualifiedModelId: "openai/gpt-5.5",
			promptText: "work",
			parentSessionId: "parent-1",
			rootDir: root,
			client,
			asyncMode: true,
			_launchTimeoutMs: 5_000,
			_messagesTimeoutMs: 100,
		});

		// Use a very short quiet period (1ms) so we hit 2 nudges quickly, then abort
		const t1 = new Date(Date.now() + 10);
		await monitorChildSessionsV1({ rootDir: root, workflowId: "workflow-abort-1", client, now: t1, nudgeQuietPeriodMs: 1, maxNudges: 2, abortThresholdMs: 100_000 });
		const t2 = new Date(Date.now() + 20);
		await monitorChildSessionsV1({ rootDir: root, workflowId: "workflow-abort-1", client, now: t2, nudgeQuietPeriodMs: 1, maxNudges: 2, abortThresholdMs: 100_000 });

		// Now trigger abort with 70s total age and maxNudges reached
		const monResult = await monitorChildSessionsV1({
			rootDir: root,
			workflowId: "workflow-abort-1",
			client,
			now: new Date(Date.now() + 70_000),
			nudgeQuietPeriodMs: 20_000,
			maxNudges: 2,
			abortThresholdMs: 60_000,
		});

		assert.equal(monResult.lanesAborted, 1);
		assert.ok(aborted.length > 0, "session.abort should have been called");
		assert.deepEqual(aborted[0], { path: { id: "ses-child-test-01" } });

		// task_failed evidence should be written
		const reloaded2 = reloadFlowDeskSessionEvidenceV1({ rootDir: root, workflowId: "workflow-abort-1" });
		const taskFailed = reloaded2.entries.find(e => e.evidenceClass === "task_failed");
		assert.ok(taskFailed, "task_failed evidence should be written after abort");
		assert.equal((taskFailed?.record as Record<string, unknown>).failure_category, "sdk_prompt_timeout");
		const subtaskCache = JSON.parse(readFileSync(join(root, ".flowdesk", "ui", "subtask-activity-sidebar.json"), "utf8")) as Record<string, unknown>;
		const rows = subtaskCache.rows as Array<Record<string, unknown>>;
		const row = rows.find((entry) => entry.workflowId === "workflow-abort-1");
		assert.equal(row?.workflowId, "workflow-abort-1");
		assert.equal(row?.state, "invocation_failed");
		assert.equal(row?.classification, "terminal");
	} finally {
		rmSync(root, { recursive: true, force: true });
	}
});

test("monitorChildSessions skips terminal lanes", async () => {
	const root = mkdtempSync(join(tmpdir(), "flowdesk-monitor-terminal-"));
	try {
		const client = makeClient({ messages: async () => [] });
		await executeFlowDeskAgentTaskV1({
			workflowId: "workflow-terminal-1",
			taskId: "task-t1",
			laneId: "lane-t1",
			agentRef: "agent-test",
			providerQualifiedModelId: "openai/gpt-5.5",
			promptText: "work",
			parentSessionId: "parent-1",
			rootDir: root,
			client,
			asyncMode: true,
			_launchTimeoutMs: 5_000,
			_messagesTimeoutMs: 100,
		});

		// Run monitor to collect result (first cycle)
		const clientWithResult = makeClient({
			messages: async () => ([{ role: "assistant", parts: [{ type: "text", text: "done" }, { type: "step-finish", reason: "stop" }] }]),
		});
		await monitorChildSessionsV1({ rootDir: root, workflowId: "workflow-terminal-1", client: clientWithResult, now: new Date() });

		// Second cycle — lane is terminal now, should be skipped
		const monResult = await monitorChildSessionsV1({
			rootDir: root,
			workflowId: "workflow-terminal-1",
			client: clientWithResult,
			now: new Date(),
		});
		assert.equal(monResult.lanesPolled, 0, "terminal lane should be skipped");
	} finally {
		rmSync(root, { recursive: true, force: true });
	}
});

test("monitorChildSessions promotes UI row to terminal when lane has only lane_lifecycle invocation_failed (no task_result, no task_failed)", async () => {
	const root = mkdtempSync(join(tmpdir(), "flowdesk-monitor-lifecycle-only-terminal-"));
	try {
		const workflowId = "workflow-lifecycle-only-terminal-1";
		const laneId = "lane-lifecycle-only-terminal-1";
		const taskId = "task-lifecycle-only-terminal-1";
		// Launch the lane so an agent_task_child_session record exists and is
		// reachable from monitorChildSessionsV1's childRecords iteration.
		await executeFlowDeskAgentTaskV1({
			workflowId,
			taskId,
			laneId,
			agentRef: "agent-test",
			providerQualifiedModelId: "openai/gpt-5.5",
			promptText: "work",
			parentSessionId: "parent-lifecycle-only-1",
			rootDir: root,
			client: makeClient({ messages: async () => [] }),
			asyncMode: true,
			_launchTimeoutMs: 5_000,
			_messagesTimeoutMs: 100,
		});

		// Simulate the reviewer-execution-bridge style outcome: a terminal
		// lane_lifecycle=invocation_failed evidence with NO task_result and NO
		// task_failed companion. Before the fix this leaves the sidebar row stuck
		// at state=running / classification=progressing_normal.
		const lifecyclePrepared = prepareFlowDeskSessionEvidenceWriteIntentV1({
			workflowId,
			evidenceId: `lifecycle-task-terminal-${laneId}-only-lifecycle`,
			record: {
				schema_version: "flowdesk.lane_lifecycle_record.v1",
				workflow_id: workflowId,
				attempt_id: `attempt-${laneId}`,
				lane_id: laneId,
				parent_session_ref: "ses-parent-lifecycle-only-1",
				agent_ref: "agent-test",
				provider_qualified_model_id: "openai/gpt-5.5",
				state: "invocation_failed",
				timeout_ms: 0,
				orphan_max_age_ms: 0,
				retry_count: 0,
				created_at: "2026-05-29T00:00:00.000Z",
				updated_at: "2026-05-29T00:00:00.000Z",
				dispatch_authority_enabled: false,
				providerCall: false,
				actualLaneLaunch: false,
				runtimeExecution: false,
			},
		});
		assert.equal(lifecyclePrepared.ok, true, lifecyclePrepared.errors?.join("; "));
		if (!lifecyclePrepared.ok || lifecyclePrepared.writeIntent === undefined) return;
		const lifecycleApplied = applyFlowDeskSessionEvidenceWriteIntentsV1(root, [lifecyclePrepared.writeIntent]);
		assert.equal(lifecycleApplied.ok, true);

		// Confirm no task_result / task_failed evidence is present — this is the
		// pre-condition for the regression.
		const beforeReload = reloadFlowDeskSessionEvidenceV1({ rootDir: root, workflowId });
		assert.equal(beforeReload.entries.filter(e => e.evidenceClass === "task_result").length, 0);
		assert.equal(beforeReload.entries.filter(e => e.evidenceClass === "task_failed").length, 0);
		assert.equal(
			beforeReload.entries.some(e => e.evidenceClass === "lane_lifecycle" && (e.record as Record<string, unknown>).state === "invocation_failed"),
			true,
		);

		const monResult = await monitorChildSessionsV1({
			rootDir: root,
			workflowId,
			client: makeClient({ messages: async () => [] }),
			now: new Date("2026-05-29T00:05:00.000Z"),
		});
		// The lane is already terminal-by-lifecycle, so monitor must not re-poll it.
		assert.equal(monResult.lanesPolled, 0, "lifecycle-only terminal lane should be treated as terminal and skipped");

		// The completion UI cache must reflect the terminal/failed classification
		// even though no task_result and no task_failed evidence exist.
		const subtaskCache = JSON.parse(readFileSync(join(root, ".flowdesk", "ui", "subtask-activity-sidebar.json"), "utf8")) as Record<string, unknown>;
		const rows = subtaskCache.rows as Array<Record<string, unknown>>;
		const row = rows.find((entry) => entry.workflowId === workflowId && entry.laneId === laneId);
		assert.ok(row, "sidebar row must be present for the lifecycle-only terminal lane");
		assert.equal(row?.state, "invocation_failed", "state must reflect lifecycle terminal even without task_failed evidence");
		assert.equal(row?.classification, "terminal", "classification must be terminal (not progressing_normal)");
		assert.equal(row?.progressPhase, "failed");
		// Recovery actions must include retry/resume/abort because the row is a
		// terminal-without-success.
		const actions = row?.recoveryActionRefs as string[] | undefined;
		assert.ok(actions?.includes("/flowdesk-retry"), "failed recovery actions must include /flowdesk-retry");
		assert.ok(actions?.includes("/flowdesk-abort"), "failed recovery actions must include /flowdesk-abort");

		// The workflow must NOT be marked auto-next-ready because the lane is not
		// task_result-backed.
		const autoNextCache = JSON.parse(readFileSync(join(root, ".flowdesk", "ui", "auto-next-ready.json"), "utf8")) as Record<string, unknown>;
		const workflows = autoNextCache.workflows as Array<Record<string, unknown>>;
		assert.equal(
			workflows.some((w) => w.workflowId === workflowId),
			false,
			"lifecycle-only terminal lane must not appear in auto-next ready workflows",
		);
	} finally {
		rmSync(root, { recursive: true, force: true });
	}
});

test("monitorChildSessions skips lanes with task_result even when lifecycle is still running", async () => {
	const root = mkdtempSync(join(tmpdir(), "flowdesk-monitor-terminal-result-"));
	try {
		const workflowId = "workflow-terminal-result-1";
		await executeFlowDeskAgentTaskV1({
			workflowId,
			taskId: "task-terminal-result-1",
			laneId: "lane-terminal-result-1",
			agentRef: "agent-test",
			providerQualifiedModelId: "openai/gpt-5.5",
			promptText: "work",
			parentSessionId: "parent-1",
			rootDir: root,
			client: makeClient({ messages: async () => [] }),
			asyncMode: true,
			_launchTimeoutMs: 5_000,
			_messagesTimeoutMs: 100,
		});

		const prepared = prepareFlowDeskSessionEvidenceWriteIntentV1({
			workflowId,
			evidenceId: "task-result-terminal-result-1",
			record: {
				schema_version: "flowdesk.task_result.v1",
				workflow_id: workflowId,
				lane_id: "lane-terminal-result-1",
				task_id: "task-terminal-result-1",
				agent_ref: "agent-test",
				provider_qualified_model_id: "openai/gpt-5.5",
				task_prompt_sha256: "a".repeat(64),
				result_text: "already done",
				result_text_truncated: false,
				result_text_sha256: "b".repeat(64),
				created_at: "2026-05-29T00:00:00.000Z",
				dispatch_authority_enabled: false,
			},
		});
		assert.equal(prepared.ok, true, prepared.errors?.join("; "));
		if (!prepared.ok || prepared.writeIntent === undefined) return;
		const applied = applyFlowDeskSessionEvidenceWriteIntentsV1(root, [prepared.writeIntent]);
		assert.equal(applied.ok, true);

		const monResult = await monitorChildSessionsV1({
			rootDir: root,
			workflowId,
			client: makeClient({
				messages: async () => ([{ role: "assistant", parts: [{ type: "text", text: "duplicate" }, { type: "step-finish", reason: "stop" }] }]),
			}),
			now: new Date("2026-05-29T00:05:00.000Z"),
		});
		assert.equal(monResult.lanesPolled, 0, "task_result-backed lane should be skipped even if lifecycle still says running");
		const reloaded = reloadFlowDeskSessionEvidenceV1({ rootDir: root, workflowId });
		assert.equal(reloaded.entries.filter(e => e.evidenceClass === "task_result").length, 1);
		const autoNextCache = JSON.parse(readFileSync(join(root, ".flowdesk", "ui", "auto-next-ready.json"), "utf8")) as Record<string, unknown>;
		const workflows = autoNextCache.workflows as Array<Record<string, unknown>>;
		assert.equal(workflows[0]?.workflowId, workflowId);
		const aggregate = workflows[0]?.laneProgressAggregate as Record<string, unknown>;
		assert.equal(aggregate.nextActionAvailable, true);
		assert.equal(aggregate.nextActionKind, "synthesis");
	} finally {
		rmSync(root, { recursive: true, force: true });
	}
});

test("monitorChildSessions refreshes UI cache for terminal lanes without task_result", async () => {
	const root = mkdtempSync(join(tmpdir(), "flowdesk-monitor-terminal-failed-"));
	try {
		const workflowId = "workflow-terminal-failed-1";
		await executeFlowDeskAgentTaskV1({
			workflowId,
			taskId: "task-terminal-failed-1",
			laneId: "lane-terminal-failed-1",
			agentRef: "agent-test",
			providerQualifiedModelId: "openai/gpt-5.5",
			promptText: "work",
			parentSessionId: "parent-1",
			rootDir: root,
			client: makeClient({ messages: async () => [] }),
			asyncMode: true,
			_launchTimeoutMs: 5_000,
			_messagesTimeoutMs: 100,
		});

		const prepared = prepareFlowDeskSessionEvidenceWriteIntentV1({
			workflowId,
			evidenceId: "task-failed-terminal-failed-1",
			record: {
				schema_version: "flowdesk.task_failed.v1",
				workflow_id: workflowId,
				lane_id: "lane-terminal-failed-1",
				task_id: "task-terminal-failed-1",
				agent_ref: "agent-test",
				provider_qualified_model_id: "openai/gpt-5.5",
				failure_category: "sdk_create_failed",
				redacted_reason: "crash",
				created_at: "2026-05-29T00:00:00.000Z",
				dispatch_authority_enabled: false,
			},
		});
		assert.equal(prepared.ok, true, prepared.errors?.join("; "));
		if (!prepared.ok || prepared.writeIntent === undefined) return;
		const applied = applyFlowDeskSessionEvidenceWriteIntentsV1(root, [prepared.writeIntent]);
		assert.equal(applied.ok, true);

		// Remove any existing UI cache
		rmSync(join(root, ".flowdesk", "ui"), { recursive: true, force: true });

		const monResult = await monitorChildSessionsV1({
			rootDir: root,
			workflowId,
			client: makeClient({ messages: async () => [] }),
			now: new Date("2026-05-29T00:05:00.000Z"),
		});
		assert.equal(monResult.lanesPolled, 0, "task_failed-backed lane should be skipped");
		
		const sidebarStr = readFileSync(join(root, ".flowdesk", "ui", "subtask-activity-sidebar.json"), "utf8");
		const sidebar = JSON.parse(sidebarStr) as Record<string, unknown>;
		const rows = sidebar.rows as Array<Record<string, unknown>>;
		assert.equal(rows[0]?.laneId, "lane-terminal-failed-1");
		assert.equal(rows[0]?.state, "invocation_failed", "row should be cached as terminal (invocation_failed)");
		assert.equal(rows[0]?.classification, "terminal");
	} finally {
		rmSync(root, { recursive: true, force: true });
	}
});

test("abortFlowDeskAgentTaskV1 calls session.abort and writes task_failed + terminal lifecycle evidence", async () => {
	const root = mkdtempSync(join(tmpdir(), "flowdesk-abort-task-"));
	try {
		let abortCalls = 0;
		let abortOptions: unknown;
		const client = makeClient({
			abort: async (o: unknown) => { abortCalls += 1; abortOptions = o; },
		});
		// Launch async lane first to populate child session evidence
		const launched = await executeFlowDeskAgentTaskV1({
			workflowId: "workflow-abort-test-1",
			taskId: "task-abort-test-1",
			laneId: "lane-abort-test-1",
			agentRef: "agent-test",
			providerQualifiedModelId: "openai/gpt-5.5",
			promptText: "hello",
			parentSessionId: "parent-abort-test",
			rootDir: root,
			client,
			asyncMode: true,
			_launchTimeoutMs: 5_000,
			_messagesTimeoutMs: 100,
		});
		assert.equal(launched.status, "task_launched");
		const childSessionId = launched.status === "task_launched" ? launched.childSessionId : "";

		// Now abort
		const abortResult = await abortFlowDeskAgentTaskV1({
			rootDir: root,
			workflowId: "workflow-abort-test-1",
			taskId: "task-abort-test-1",
			reason: "coordinator requested abort",
			client,
		});

		assert.equal(abortResult.status, "aborted");
		assert.equal(abortCalls, 1, "session.abort must have been called once");
		assert.deepEqual(abortOptions, { path: { id: childSessionId } }, "task abort must route to the structured typed session abort adapter payload");

		// Verify task_failed evidence written
		const reloaded = reloadFlowDeskSessionEvidenceV1({ rootDir: root, workflowId: "workflow-abort-test-1" });
		assert.ok(reloaded.ok);
		const failed = reloaded.entries.find((e) => e.evidenceClass === "task_failed");
		assert.ok(failed, "task_failed evidence must exist");
		// failure_category is "unknown" (coordinator-initiated abort maps to unknown per schema)
		assert.equal((failed.record as Record<string, unknown>).failure_category, "unknown");
		assert.ok(String((failed.record as Record<string, unknown>).redacted_reason).includes("coordinator_abort"));

		// Verify lane_lifecycle evidence written (invocation_failed is the mapped state)
		const lifecycle = reloaded.entries.find(
			(e) => e.evidenceClass === "lane_lifecycle" &&
			(e.record as Record<string, unknown>).state === "invocation_failed",
		);
		assert.ok(lifecycle, "terminal lane_lifecycle evidence must exist");

		// Verify sidebar cache updated
		const sidebarRaw = readFileSync(join(root, ".flowdesk", "ui", "subtask-activity-sidebar.json"), "utf8");
		const sidebar = JSON.parse(sidebarRaw) as Record<string, unknown>;
		const rows = (sidebar.rows as Array<Record<string, unknown>>);
		const row = rows.find((r) => r.laneId === "lane-abort-test-1");
		assert.ok(row, "sidebar row must exist");
		assert.equal(row?.classification, "terminal");
	} finally {
		rmSync(root, { recursive: true, force: true });
	}
});

test("abortFlowDeskAgentTaskV1 returns abort_skipped when client.session.abort is missing", async () => {
	const root = mkdtempSync(join(tmpdir(), "flowdesk-abort-skipped-"));
	try {
		// Client without abort method
		const clientWithoutAbort = {
			session: {
				create: async () => ({ id: "ses-no-abort-01" }),
				prompt: async () => ({}),
				messages: async () => [],
			},
		} as unknown as FlowDeskManagedDispatchBetaOpenCodeClientV1;

		// First launch a lane so evidence exists to look up
		await executeFlowDeskAgentTaskV1({
			workflowId: "workflow-abort-skipped-1", taskId: "task-abort-skipped-1",
			laneId: "lane-abort-skipped-1", agentRef: "agent-test",
			providerQualifiedModelId: "openai/gpt-5.5", promptText: "hello",
			parentSessionId: "parent-skip", rootDir: root, client: clientWithoutAbort,
			asyncMode: true, _launchTimeoutMs: 5_000, _messagesTimeoutMs: 100,
		});

		const result = await abortFlowDeskAgentTaskV1({
			rootDir: root,
			workflowId: "workflow-abort-skipped-1",
			taskId: "task-abort-skipped-1",
			reason: "test abort with no SDK abort support",
			client: clientWithoutAbort,
		});

		assert.equal(result.status, "abort_skipped");
		// Evidence should still be written even when SDK abort is unavailable
		const reloaded = reloadFlowDeskSessionEvidenceV1({ rootDir: root, workflowId: "workflow-abort-skipped-1" });
		assert.ok(reloaded.ok);
		const failed = reloaded.entries.find((e) => e.evidenceClass === "task_failed");
		assert.ok(failed, "task_failed evidence must be written even on abort_skipped");
	} finally {
		rmSync(root, { recursive: true, force: true });
	}
});
