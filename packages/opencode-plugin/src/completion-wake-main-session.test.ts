import assert from "node:assert/strict";
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { consumeFlowDeskCompletionWakeForMainSessionV1 } from "./completion-wake-main-session.js";

test("completion wake main-session consumer uses primary path prompt shape and marks consumed", async () => {
	const root = mkdtempSync(join(tmpdir(), "flowdesk-main-wake-"));
	try {
		const uiDir = join(root, ".flowdesk", "ui");
		mkdirSync(uiDir, { recursive: true });
		writeFileSync(join(uiDir, "completion-wake-ready.json"), `${JSON.stringify({
			schema_version: "flowdesk.completion_wake_ready_cache.v1",
			observed_at: "2026-06-02T00:00:00.000Z",
			expires_at: "2026-06-02T00:02:00.000Z",
			rows: [{
				workflowId: "workflow-main-wake",
				parentSessionRef: "ses-ses_parent123",
				completionKind: "auto_next_ready",
				readyAt: "2026-06-02T00:00:30.000Z",
				dedupeKey: "ses-ses_parent123\u0000workflow-main-wake",
				consumptionKey: "ses-ses_parent123:workflow-main-wake:2026-06-02T00:00:30.000Z:1:0",
				consumed: false,
				taskSummaries: ["Review API"],
				notificationLabel: "FlowDesk synthesis ready",
			}],
		}, null, 2)}\n`, "utf8");
		const prompts: unknown[] = [];
		const result = await consumeFlowDeskCompletionWakeForMainSessionV1({
			config: { enabled: true, rootDir: root, agentName: "flowdesk-main", providerQualifiedModelId: "openai/gpt-5.5", directory: "/workspace/flowdesk" },
			client: { session: { promptAsync: async (options: unknown) => { prompts.push(options); return {}; } } },
			now: new Date("2026-06-02T00:01:00.000Z"),
		});
		assert.equal(result.status, "main_session_wake_completed");
		assert.equal(result.wakeSucceeded, 1);
		assert.equal(result.retryScheduled, 0);
		assert.equal(prompts.length, 1);
		assert.equal((prompts[0] as { path: { id: string } }).path.id, "ses_parent123");
		assert.equal((prompts[0] as { query: { directory: string } }).query.directory, "/workspace/flowdesk");
		assert.equal((prompts[0] as { body: { noReply: boolean } }).body.noReply, false);
		assert.match(JSON.stringify(prompts[0]), /FlowDesk completion wake signal/);

		const ready = JSON.parse(readFileSync(join(uiDir, "completion-wake-ready.json"), "utf8")) as { rows: Array<{ consumed?: boolean; consumedAt?: string; consumedBy?: string }> };
		assert.equal(ready.rows[0]?.consumed, true);
		assert.equal(ready.rows[0]?.consumedAt, "2026-06-02T00:01:00.000Z");
		assert.equal(ready.rows[0]?.consumedBy, "main_session_prompt");
	} finally {
		rmSync(root, { recursive: true, force: true });
	}
});

test("completion wake main-session consumer skips when prompt client is unavailable", async () => {
	const result = await consumeFlowDeskCompletionWakeForMainSessionV1({
		config: { enabled: true, rootDir: "/tmp/flowdesk-missing", agentName: "flowdesk-main", providerQualifiedModelId: "openai/gpt-5.5" },
		client: undefined,
	});
	assert.equal(result.status, "main_session_wake_skipped");
	assert.equal(result.retryScheduled, 0);
	assert.equal(result.skippedReason, "opencode_sdk_client_unavailable");
});

test("completion wake consumer treats awaiting permission as advisory attention only", async () => {
	const root = mkdtempSync(join(tmpdir(), "flowdesk-permission-wake-"));
	try {
		const uiDir = join(root, ".flowdesk", "ui");
		mkdirSync(uiDir, { recursive: true });
		writeFileSync(join(uiDir, "completion-wake-ready.json"), `${JSON.stringify({
			schema_version: "flowdesk.completion_wake_ready_cache.v1",
			observed_at: "2026-06-04T00:00:00.000Z",
			expires_at: "2026-06-04T00:02:00.000Z",
			rows: [{
				workflowId: "workflow-permission-wake",
				parentSessionRef: "ses-ses_parent123",
				completionKind: "awaiting_permission",
				readyAt: "2026-06-04T00:00:30.000Z",
				dedupeKey: "ses-ses_parent123\u0000workflow-permission-wake\u0000awaiting_permission",
				consumptionKey: "ses-ses_parent123:workflow-permission-wake:awaiting_permission:2026-06-04T00:00:30.000Z:1",
				consumed: false,
				taskSummaries: ["Permission check"],
				notificationLabel: "FlowDesk lane awaiting OpenCode permission",
			}],
		}, null, 2)}\n`, "utf8");
		const prompts: unknown[] = [];
		const result = await consumeFlowDeskCompletionWakeForMainSessionV1({
			config: { enabled: true, rootDir: root, agentName: "flowdesk-main", providerQualifiedModelId: "openai/gpt-5.5" },
			client: { session: { promptAsync: async (options: unknown) => { prompts.push(options); return {}; } } },
			now: new Date("2026-06-04T00:01:00.000Z"),
		});
		assert.equal(result.status, "main_session_wake_completed");
		assert.equal(prompts.length, 1);
		const prompt = JSON.stringify(prompts[0]);
		assert.match(prompt, /awaiting an OpenCode permission response/);
		assert.match(prompt, /approve or deny through OpenCode's permission UI/);
		assert.match(prompt, /Do not auto-approve, auto-deny, retry, fallback, dispatch, write, or hard-cancel/);
	} finally {
		rmSync(root, { recursive: true, force: true });
	}
});

test("completion wake main-session consumer falls back to flat prompt shape on primary error", async () => {
	const root = mkdtempSync(join(tmpdir(), "flowdesk-main-wake-shape-"));
	try {
		const uiDir = join(root, ".flowdesk", "ui");
		mkdirSync(uiDir, { recursive: true });
		writeFileSync(join(uiDir, "completion-wake-ready.json"), `${JSON.stringify({
			schema_version: "flowdesk.completion_wake_ready_cache.v1",
			observed_at: "2026-06-04T00:00:00.000Z",
			expires_at: "2026-06-04T00:02:00.000Z",
			rows: [{
				workflowId: "workflow-main-wake-shape",
				parentSessionRef: "ses-ses_parent123",
				completionKind: "awaiting_permission",
				readyAt: "2026-06-04T00:00:30.000Z",
				dedupeKey: "ses-ses_parent123\u0000workflow-main-wake-shape\u0000awaiting_permission",
				consumptionKey: "ses-ses_parent123:workflow-main-wake-shape:awaiting_permission:2026-06-04T00:00:30.000Z:1",
				consumed: false,
				taskSummaries: [],
				notificationLabel: "FlowDesk lane awaiting OpenCode permission",
			}],
		}, null, 2)}\n`, "utf8");
		const prompts: unknown[] = [];
		const result = await consumeFlowDeskCompletionWakeForMainSessionV1({
			config: { enabled: true, rootDir: root, agentName: "flowdesk-main", providerQualifiedModelId: "openai/gpt-5.5" },
			client: { session: { promptAsync: async (options: unknown) => {
				prompts.push(options);
				if ((options as { path?: { id: string } }).path !== undefined) throw new Error("path unsupported");
				return {};
			} } },
		});
		assert.equal(result.status, "main_session_wake_completed");
		assert.equal(prompts.length, 2);
		assert.equal((prompts[0] as { path: { id: string } }).path.id, "ses_parent123");
		assert.equal((prompts[1] as { sessionID: string }).sessionID, "ses_parent123");
	} finally {
		rmSync(root, { recursive: true, force: true });
	}
});

test("completion wake main-session consumer schedules retry without consuming active sessions", async () => {
	const root = mkdtempSync(join(tmpdir(), "flowdesk-main-wake-active-"));
	try {
		const uiDir = join(root, ".flowdesk", "ui");
		mkdirSync(uiDir, { recursive: true });
		writeFileSync(join(uiDir, "completion-wake-ready.json"), `${JSON.stringify({
			schema_version: "flowdesk.completion_wake_ready_cache.v1",
			observed_at: "2026-06-04T00:00:00.000Z",
			expires_at: "2026-06-04T00:02:00.000Z",
			rows: [{
				workflowId: "workflow-main-wake-active",
				parentSessionRef: "ses-ses_parent123",
				completionKind: "auto_next_ready",
				readyAt: "2026-06-04T00:00:30.000Z",
				dedupeKey: "ses-ses_parent123\u0000workflow-main-wake-active",
				consumptionKey: "ses-ses_parent123:workflow-main-wake-active:2026-06-04T00:00:30.000Z:1",
				consumed: false,
				retryCount: 2,
				taskSummaries: [],
				notificationLabel: "FlowDesk synthesis ready",
			}],
		}, null, 2)}\n`, "utf8");
		const prompts: unknown[] = [];
		const result = await consumeFlowDeskCompletionWakeForMainSessionV1({
			config: { enabled: true, rootDir: root, agentName: "flowdesk-main", providerQualifiedModelId: "openai/gpt-5.5" },
			client: { session: { status: async () => ({ state: "busy" }), promptAsync: async (options: unknown) => { prompts.push(options); return {}; } } },
			now: new Date("2026-06-04T00:01:00.000Z"),
		});
		assert.equal(result.status, "main_session_wake_completed");
		assert.equal(result.wakeSucceeded, 0);
		assert.equal(result.retryScheduled, 1);
		assert.equal(prompts.length, 0);
		const ready = JSON.parse(readFileSync(join(uiDir, "completion-wake-ready.json"), "utf8")) as { rows: Array<{ consumed?: boolean; retryCount?: number; retryScheduledAt?: string }> };
		assert.equal(ready.rows[0]?.consumed, false);
		assert.equal(ready.rows[0]?.retryCount, 3);
		assert.equal(ready.rows[0]?.retryScheduledAt, "2026-06-04T00:01:00.000Z");
	} finally {
		rmSync(root, { recursive: true, force: true });
	}
});

test("completion wake main-session consumer sets noReply by completion kind", async () => {
	const root = mkdtempSync(join(tmpdir(), "flowdesk-main-wake-noreply-"));
	try {
		const uiDir = join(root, ".flowdesk", "ui");
		mkdirSync(uiDir, { recursive: true });
		writeFileSync(join(uiDir, "completion-wake-ready.json"), `${JSON.stringify({
			schema_version: "flowdesk.completion_wake_ready_cache.v1",
			observed_at: "2026-06-04T00:00:00.000Z",
			expires_at: "2026-06-04T00:02:00.000Z",
			rows: [
				{
					workflowId: "workflow-main-wake-result",
					parentSessionRef: "ses-ses_parent123",
					completionKind: "task_result",
					readyAt: "2026-06-04T00:00:30.000Z",
					dedupeKey: "ses-ses_parent123\u0000workflow-main-wake-result",
					consumptionKey: "ses-ses_parent123:workflow-main-wake-result:2026-06-04T00:00:30.000Z:1",
					consumed: false,
					taskSummaries: [],
					notificationLabel: "FlowDesk result ready",
				},
				{
					workflowId: "workflow-main-wake-diagnostic",
					parentSessionRef: "ses-ses_parent123",
					completionKind: "diagnostic_attention",
					readyAt: "2026-06-04T00:00:31.000Z",
					dedupeKey: "ses-ses_parent123\u0000workflow-main-wake-diagnostic",
					consumptionKey: "ses-ses_parent123:workflow-main-wake-diagnostic:2026-06-04T00:00:31.000Z:1",
					consumed: false,
					taskSummaries: [],
					notificationLabel: "FlowDesk diagnostic attention",
				},
			],
		}, null, 2)}\n`, "utf8");
		const prompts: unknown[] = [];
		const result = await consumeFlowDeskCompletionWakeForMainSessionV1({
			config: { enabled: true, rootDir: root, agentName: "flowdesk-main", providerQualifiedModelId: "openai/gpt-5.5" },
			client: { session: { promptAsync: async (options: unknown) => { prompts.push(options); return {}; } } },
		});
		assert.equal(result.wakeSucceeded, 2);
		assert.equal((prompts[0] as { body: { noReply: boolean } }).body.noReply, false);
		assert.equal((prompts[1] as { body: { noReply: boolean } }).body.noReply, true);
	} finally {
		rmSync(root, { recursive: true, force: true });
	}
});

test("completion wake main-session consumer stops retrying at retry cap", async () => {
	const root = mkdtempSync(join(tmpdir(), "flowdesk-main-wake-cap-"));
	try {
		const uiDir = join(root, ".flowdesk", "ui");
		mkdirSync(uiDir, { recursive: true });
		writeFileSync(join(uiDir, "completion-wake-ready.json"), `${JSON.stringify({
			schema_version: "flowdesk.completion_wake_ready_cache.v1",
			observed_at: "2026-06-04T00:00:00.000Z",
			expires_at: "2026-06-04T00:02:00.000Z",
			rows: [{
				workflowId: "workflow-main-wake-cap",
				parentSessionRef: "ses-ses_parent123",
				completionKind: "auto_next_ready",
				readyAt: "2026-06-04T00:00:30.000Z",
				dedupeKey: "ses-ses_parent123\u0000workflow-main-wake-cap",
				consumptionKey: "ses-ses_parent123:workflow-main-wake-cap:2026-06-04T00:00:30.000Z:1",
				consumed: false,
				retryCount: 10,
				taskSummaries: [],
				notificationLabel: "FlowDesk synthesis ready",
			}],
		}, null, 2)}\n`, "utf8");
		const prompts: unknown[] = [];
		const result = await consumeFlowDeskCompletionWakeForMainSessionV1({
			config: { enabled: true, rootDir: root, agentName: "flowdesk-main", providerQualifiedModelId: "openai/gpt-5.5" },
			client: { session: { promptAsync: async (options: unknown) => { prompts.push(options); return {}; } } },
			now: new Date("2026-06-04T00:01:00.000Z"),
		});
		assert.equal(result.wakeSucceeded, 0);
		assert.equal(result.retryScheduled, 0);
		assert.equal(prompts.length, 0);
		const ready = JSON.parse(readFileSync(join(uiDir, "completion-wake-ready.json"), "utf8")) as { rows: Array<{ consumed?: boolean; consumedBy?: string }> };
		assert.equal(ready.rows[0]?.consumed, true);
		assert.equal(ready.rows[0]?.consumedBy, "main_session_prompt_retry_cap");
	} finally {
		rmSync(root, { recursive: true, force: true });
	}
});
