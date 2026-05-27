import assert from "node:assert/strict";
import test from "node:test";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { executeFlowDeskAgentTaskV1, AGENT_TASK_CHILD_SESSION_SCHEMA_VERSION } from "./agent-task-runner.js";
import { monitorChildSessionsV1 } from "./stall-recovery.js";
import { reloadFlowDeskSessionEvidenceV1 } from "@flowdesk/core";
import type { FlowDeskManagedDispatchBetaOpenCodeClientV1 } from "./managed-dispatch-adapter.js";

function makeClient(overrides: Partial<{
	prompt: (o: unknown) => unknown;
	messages: (o: unknown) => Promise<unknown>;
	abort: (o: unknown) => Promise<void>;
}>): FlowDeskManagedDispatchBetaOpenCodeClientV1 {
	return {
		session: {
			create: async () => ({ id: "ses-child-test-01" }),
			prompt: overrides.prompt ?? (async () => ({})),
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

test("monitorChildSessions collects result when child session has text", async () => {
	const root = mkdtempSync(join(tmpdir(), "flowdesk-monitor-result-"));
	try {
		// First launch in asyncMode to write evidence
		const client = makeClient({
			messages: async () => ([{ role: "assistant", parts: [{ type: "text", text: "final answer here" }] }]),
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
			messages: async () => ([{ role: "assistant", parts: [{ type: "text", text: "done" }] }]),
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
