import assert from "node:assert/strict";
import test from "node:test";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { executeFlowDeskAgentTaskV1, AGENT_TASK_CHILD_SESSION_SCHEMA_VERSION, isFlowDeskHeavyFirstTokenModelV1 } from "./agent-task-runner.js";
import { flowDeskTextLooksLikeRefusalOrErrorV1 } from "./agent-task-output.js";
import { monitorChildSessionsV1 } from "./stall-recovery.js";
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
			lane_plan_ref: "lane-plan-sync-agent-task",
			binding_ref: "binding-sync-agent-task",
			perspective: "architecture",
			source: "gpt_frontier",
			created_at: "2026-05-31T00:00:00.000Z",
			redaction_version: "v1",
			findings: [],
			evidence_refs: ["evidence-sync-agent-task"],
			uncertainty: "low",
			required_fixes: [],
			verdict_label: "pass",
			safe_next_actions: ["/flowdesk-status"],
			dispatch_authority_enabled: false,
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

test("monitorChildSessions reads current SDK messages response shapes", async () => {
	const root = mkdtempSync(join(tmpdir(), "flowdesk-monitor-current-shape-"));
	try {
		const seenOptions: unknown[] = [];
		const launchClient = makeClient({});
		await executeFlowDeskAgentTaskV1({
			workflowId: "workflow-monitor-current-shape",
			taskId: "task-current-shape",
			laneId: "lane-current-shape",
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
				if ((options as Record<string, unknown>).sessionID !== undefined) return { error: { message: "legacy shape" } };
				return { data: { messages: [{ info: { role: "assistant" }, parts: [{ type: "text", text: "current shape done" }, { type: "step-finish", reason: "stop" }] }] } };
			},
		});
		const monResult = await monitorChildSessionsV1({
			rootDir: root,
			workflowId: "workflow-monitor-current-shape",
			client: monitorClient,
			now: new Date(),
		});

		assert.equal(monResult.lanesCompleted, 1);
		assert.ok(seenOptions.some((option) => (option as Record<string, unknown>).sessionID !== undefined));
		assert.ok(seenOptions.some((option) => typeof (option as Record<string, unknown>).path === "object"));
		const reloaded = reloadFlowDeskSessionEvidenceV1({ rootDir: root, workflowId: "workflow-monitor-current-shape" });
		const taskResult = reloaded.entries.find(e => e.evidenceClass === "task_result");
		assert.equal((taskResult?.record as Record<string, unknown>).result_text, "current shape done");
		const progress = reloaded.entries.find(e => e.evidenceClass === "agent_task_progress" && (e.record as Record<string, unknown>).phase === "finalizing");
		assert.equal((progress?.record as Record<string, unknown>).progress_label, "async agent task result captured by watchdog");
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

test("monitorChildSessions sends noReply nudge after quiet period", async () => {
	const root = mkdtempSync(join(tmpdir(), "flowdesk-monitor-nudge-"));
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

		// Simulate 25 seconds of silence. Isolate the legacy raw noReply nudge
		// path: enable the raw-nudge capability gate and disable idle
		// continuation injection (which is the new default recovery).
		const futureNow = new Date(Date.now() + 25_000);
		const monResult = await monitorChildSessionsV1({
			rootDir: root,
			workflowId: "workflow-nudge-1",
			client,
			now: futureNow,
			nudgeQuietPeriodMs: 20_000,
			allowRawPromptNoReplyNudge: true,
			maxIdleContinuations: 0,
		});

		assert.equal(monResult.lanesNudged, 1);
		// noReply must appear in at least one prompt call (watchdog nudge)
		assert.ok(nudged.length > 0);
		const hasNoReplyNudge = nudged.some(n => (n as Record<string, unknown>).noReply === true);
		assert.ok(hasNoReplyNudge, "at least one prompt call must use noReply: true");
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

test("monitorChildSessions aborts lane after exhausting nudges and abort threshold", async () => {
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
