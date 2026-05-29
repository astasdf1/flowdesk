import assert from "node:assert/strict";
import test from "node:test";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { executeFlowDeskAgentTaskV1, AGENT_TASK_CHILD_SESSION_SCHEMA_VERSION } from "./agent-task-runner.js";
import { monitorChildSessionsV1 } from "./stall-recovery.js";
import { applyFlowDeskSessionEvidenceWriteIntentsV1, prepareFlowDeskSessionEvidenceWriteIntentV1, reloadFlowDeskSessionEvidenceV1 } from "@flowdesk/core";
import type { FlowDeskManagedDispatchBetaOpenCodeClientV1 } from "./managed-dispatch-adapter.js";

function makeClient(overrides: Partial<{
	prompt: (o: unknown) => unknown;
	promptAsync: (o: unknown) => unknown;
	messages: (o: unknown) => Promise<unknown>;
	abort: (o: unknown) => Promise<void>;
}>): FlowDeskManagedDispatchBetaOpenCodeClientV1 {
	return {
		session: {
			create: async () => ({ id: "ses-child-test-01" }),
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

		// Simulate 25 seconds of silence
		const futureNow = new Date(Date.now() + 25_000);
		const monResult = await monitorChildSessionsV1({
			rootDir: root,
			workflowId: "workflow-nudge-1",
			client,
			now: futureNow,
			nudgeQuietPeriodMs: 20_000,
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
	} finally {
		rmSync(root, { recursive: true, force: true });
	}
});
