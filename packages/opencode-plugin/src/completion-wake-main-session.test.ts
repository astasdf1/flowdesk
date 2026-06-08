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
		assert.equal((prompts[0] as { body: { parts: Array<{ text: string }> } }).body.parts[0]?.text, "[FlowDesk:done] workflow-main-wake. Check /flowdesk-status.");
		assert.doesNotMatch(JSON.stringify(prompts[0]), /Review API|FlowDesk synthesis ready/);

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

test("completion wake main-session consumer skips while another consumer holds the lock", async () => {
	const root = mkdtempSync(join(tmpdir(), "flowdesk-main-wake-lock-"));
	try {
		const uiDir = join(root, ".flowdesk", "ui");
		mkdirSync(uiDir, { recursive: true });
		writeFileSync(join(uiDir, "completion-wake-ready.json"), `${JSON.stringify({
			schema_version: "flowdesk.completion_wake_ready_cache.v1",
			observed_at: "2026-06-04T00:00:00.000Z",
			expires_at: "2026-06-04T00:02:00.000Z",
			rows: [{
				workflowId: "workflow-main-wake-lock",
				parentSessionRef: "ses-ses_parent123",
				completionKind: "auto_next_ready",
				readyAt: "2026-06-04T00:00:30.000Z",
				dedupeKey: "ses-ses_parent123\u0000workflow-main-wake-lock",
				consumptionKey: "ses-ses_parent123:workflow-main-wake-lock:2026-06-04T00:00:30.000Z:1:0",
				consumed: false,
				taskSummaries: ["Lock test"],
				notificationLabel: "FlowDesk synthesis ready",
			}],
		}, null, 2)}\n`, "utf8");
		const lockDir = join(uiDir, "completion-wake-consumer.lock");
		mkdirSync(lockDir);
		writeFileSync(join(lockDir, "acquired_at.json"), `${JSON.stringify({ acquired_at: "2026-06-04T00:00:30.000Z" }, null, 2)}\n`, "utf8");
		const prompts: unknown[] = [];
		const result = await consumeFlowDeskCompletionWakeForMainSessionV1({
			config: { enabled: true, rootDir: root, agentName: "flowdesk-main", providerQualifiedModelId: "openai/gpt-5.5" },
			client: { session: { promptAsync: async (options: unknown) => { prompts.push(options); return {}; } } },
			now: new Date("2026-06-04T00:01:00.000Z"),
		});
		assert.equal(result.status, "main_session_wake_skipped");
		assert.equal(result.skippedReason, "wake_consumer_lock_active");
		assert.equal(prompts.length, 0);
	} finally {
		rmSync(root, { recursive: true, force: true });
	}
});

test("completion wake main-session consumer reacquires and processes when lock is stale", async () => {
	const root = mkdtempSync(join(tmpdir(), "flowdesk-main-wake-stale-lock-"));
	try {
		const uiDir = join(root, ".flowdesk", "ui");
		mkdirSync(uiDir, { recursive: true });
		writeFileSync(join(uiDir, "completion-wake-ready.json"), `${JSON.stringify({
			schema_version: "flowdesk.completion_wake_ready_cache.v1",
			observed_at: "2026-06-04T00:00:00.000Z",
			expires_at: "2026-06-04T00:02:00.000Z",
			rows: [{
				workflowId: "workflow-main-wake-stale-lock",
				parentSessionRef: "ses-ses_parent123",
				completionKind: "auto_next_ready",
				readyAt: "2026-06-04T00:00:30.000Z",
				dedupeKey: "ses-ses_parent123\u0000workflow-main-wake-stale-lock",
				consumptionKey: "ses-ses_parent123:workflow-main-wake-stale-lock:2026-06-04T00:00:30.000Z:1:0",
				consumed: false,
				taskSummaries: ["Stale lock test"],
				notificationLabel: "FlowDesk synthesis ready",
			}],
		}, null, 2)}\n`, "utf8");
		const lockDir = join(uiDir, "completion-wake-consumer.lock");
		mkdirSync(lockDir);
		writeFileSync(join(lockDir, "acquired_at.json"), `${JSON.stringify({ acquired_at: "2026-06-04T00:00:00.000Z" }, null, 2)}\n`, "utf8");
		const prompts: unknown[] = [];
		const result = await consumeFlowDeskCompletionWakeForMainSessionV1({
			config: { enabled: true, rootDir: root, agentName: "flowdesk-main", providerQualifiedModelId: "openai/gpt-5.5" },
			client: { session: { promptAsync: async (options: unknown) => { prompts.push(options); return {}; } } },
			now: new Date("2026-06-04T00:01:01.000Z"),
		});
		assert.equal(result.status, "main_session_wake_completed");
		assert.equal(result.wakeSucceeded, 1);
		assert.equal(result.retryScheduled, 0);
		assert.equal(prompts.length, 1);
		const ready = JSON.parse(readFileSync(join(uiDir, "completion-wake-ready.json"), "utf8")) as { rows: Array<{ consumed?: boolean; consumedAt?: string; consumedBy?: string }> };
		assert.equal(ready.rows[0]?.consumed, true);
		assert.equal(ready.rows[0]?.consumedAt, "2026-06-04T00:01:01.000Z");
		assert.equal(ready.rows[0]?.consumedBy, "main_session_prompt");
	} finally {
		rmSync(root, { recursive: true, force: true });
	}
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
		assert.equal((prompts[0] as { body: { parts: Array<{ text: string }> } }).body.parts[0]?.text, "[FlowDesk:permission] workflow-permission-wake. Check /flowdesk-status.");
		assert.doesNotMatch(JSON.stringify(prompts[0]), /Permission check|FlowDesk lane awaiting OpenCode permission/);
	} finally {
		rmSync(root, { recursive: true, force: true });
	}
});

test("completion wake main-session consumer uses minimal failure and attention wake prompts", async () => {
	for (const scenario of [
		{ completionKind: "task_failed", workflowId: "workflow-failed-wake", label: "Failure details", expected: "[FlowDesk:failed] workflow-failed-wake. Check /flowdesk-status." },
		{ completionKind: "diagnostic_attention", workflowId: "workflow-attention-wake", label: "Diagnostic details", expected: "[FlowDesk:attention] workflow-attention-wake. Check /flowdesk-status." },
	] as const) {
		const root = mkdtempSync(join(tmpdir(), "flowdesk-minimal-wake-"));
		try {
			const uiDir = join(root, ".flowdesk", "ui");
			mkdirSync(uiDir, { recursive: true });
			writeFileSync(join(uiDir, "completion-wake-ready.json"), `${JSON.stringify({
				schema_version: "flowdesk.completion_wake_ready_cache.v1",
				observed_at: "2026-06-04T00:00:00.000Z",
				expires_at: "2026-06-04T00:02:00.000Z",
				rows: [{
					workflowId: scenario.workflowId,
					parentSessionRef: "ses-ses_parent123",
					completionKind: scenario.completionKind,
					readyAt: "2026-06-04T00:00:30.000Z",
					dedupeKey: `ses-ses_parent123\u0000${scenario.workflowId}`,
					consumptionKey: `ses-ses_parent123:${scenario.workflowId}:2026-06-04T00:00:30.000Z:1`,
					consumed: false,
					taskSummaries: [scenario.label],
					notificationLabel: scenario.label,
				}],
			}, null, 2)}\n`, "utf8");
			const prompts: unknown[] = [];
			const result = await consumeFlowDeskCompletionWakeForMainSessionV1({
				config: { enabled: true, rootDir: root, agentName: "flowdesk-main", providerQualifiedModelId: "openai/gpt-5.5" },
				client: { session: { promptAsync: async (options: unknown) => { prompts.push(options); return {}; } } },
				now: new Date("2026-06-04T00:01:00.000Z"),
			});
			assert.equal(result.status, "main_session_wake_completed");
			assert.equal((prompts[0] as { body: { parts: Array<{ text: string }> } }).body.parts[0]?.text, scenario.expected);
			assert.doesNotMatch(JSON.stringify(prompts[0]), new RegExp(scenario.label));
		} finally {
			rmSync(root, { recursive: true, force: true });
		}
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
			now: new Date("2026-06-04T00:01:00.000Z"),
		});
		assert.equal(result.status, "main_session_wake_completed");
		assert.equal(prompts.length, 2);
		assert.equal((prompts[0] as { path: { id: string } }).path.id, "ses_parent123");
		assert.equal((prompts[1] as { sessionID: string }).sessionID, "ses_parent123");
		assert.deepEqual((prompts[0] as { body: { model?: unknown } }).body.model, { providerID: "openai", modelID: "gpt-5.5" });
		assert.deepEqual((prompts[1] as { body: { model?: unknown } }).body.model, { providerID: "openai", modelID: "gpt-5.5" });
	} finally {
		rmSync(root, { recursive: true, force: true });
	}
});

test("completion wake main-session consumer queues wake even when session reports active", async () => {
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
		let statusCalls = 0;
		const result = await consumeFlowDeskCompletionWakeForMainSessionV1({
			config: { enabled: true, rootDir: root, agentName: "flowdesk-main", providerQualifiedModelId: "openai/gpt-5.5" },
			client: { session: { status: async () => { statusCalls += 1; return { state: "busy" }; }, promptAsync: async (options: unknown) => { prompts.push(options); return {}; } } },
			now: new Date("2026-06-04T00:01:00.000Z"),
		});
		assert.equal(result.status, "main_session_wake_completed");
		assert.equal(result.wakeSucceeded, 1);
		assert.equal(result.retryScheduled, 0);
		assert.equal(prompts.length, 1);
		assert.equal(statusCalls, 0);
		const ready = JSON.parse(readFileSync(join(uiDir, "completion-wake-ready.json"), "utf8")) as { rows: Array<{ consumed?: boolean; consumedAt?: string; consumedBy?: string; retryCount?: number; retryScheduledAt?: string }> };
		assert.equal(ready.rows[0]?.consumed, true);
		assert.equal(ready.rows[0]?.consumedAt, "2026-06-04T00:01:00.000Z");
		assert.equal(ready.rows[0]?.consumedBy, "main_session_prompt");
		assert.equal(ready.rows[0]?.retryCount, 2);
		assert.equal(ready.rows[0]?.retryScheduledAt, undefined);
	} finally {
		rmSync(root, { recursive: true, force: true });
	}
});

test("completion wake main-session consumer omits noReply while preserving burst cap", async () => {
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
			now: new Date("2026-06-04T00:01:00.000Z"),
		});
		// Only 1 wake dispatched per cycle (burst cap). The second row stays unconsumed.
		assert.equal(result.wakeSucceeded, 1);
		assert.equal(prompts.length, 1);
		const body = (prompts[0] as { body: Record<string, unknown> }).body;
		assert.equal("noReply" in body, false);
		assert.equal((body.parts as Array<{ text: string }>)[0]?.text, "[FlowDesk:attention] workflow-main-wake-diagnostic. Check /flowdesk-status.");
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

test("completion wake main-session consumer uses parent wake model over config fallback", async () => {
	const root = mkdtempSync(join(tmpdir(), "flowdesk-main-wake-rowmodel-"));
	try {
		const uiDir = join(root, ".flowdesk", "ui");
		mkdirSync(uiDir, { recursive: true });
		writeFileSync(join(uiDir, "completion-wake-ready.json"), `${JSON.stringify({
			schema_version: "flowdesk.completion_wake_ready_cache.v1",
			observed_at: "2026-06-05T00:00:00.000Z",
			expires_at: "2026-06-05T00:02:00.000Z",
			rows: [{
				workflowId: "workflow-rowmodel-wake",
				parentSessionRef: "ses-ses_parent123",
				completionKind: "task_result",
				readyAt: "2026-06-05T00:00:30.000Z",
				dedupeKey: "ses-ses_parent123\u0000workflow-rowmodel-wake",
				consumptionKey: "ses-ses_parent123:workflow-rowmodel-wake:2026-06-05T00:00:30.000Z:1:0",
				consumed: false,
				taskSummaries: [],
				notificationLabel: "FlowDesk task completed",
				parentWakeProviderQualifiedModelId: "anthropic/claude-opus-4-20250514",
			}],
		}, null, 2)}\n`, "utf8");
		const prompts: unknown[] = [];
		const result = await consumeFlowDeskCompletionWakeForMainSessionV1({
			config: { enabled: true, rootDir: root, agentName: "flowdesk-main", providerQualifiedModelId: "openai/gpt-5.5" },
			client: { session: { promptAsync: async (options: unknown) => { prompts.push(options); return {}; } } },
			now: new Date("2026-06-05T00:01:00.000Z"),
		});
		assert.equal(result.status, "main_session_wake_completed");
		assert.equal(result.wakeSucceeded, 1);
		assert.equal(prompts.length, 1);
		const body = (prompts[0] as { body: Record<string, unknown> }).body;
		assert.deepEqual(body.model, { providerID: "anthropic", modelID: "claude-opus-4-20250514" });
		assert.equal((body.parts as Array<{ text: string }>)[0]?.text, "[FlowDesk:done] workflow-rowmodel-wake. Check /flowdesk-status.");
	} finally {
		rmSync(root, { recursive: true, force: true });
	}
});

test("completion wake main-session consumer falls back to config model when parent wake model is invalid", async () => {
	const root = mkdtempSync(join(tmpdir(), "flowdesk-main-wake-badmodel-"));
	try {
		const uiDir = join(root, ".flowdesk", "ui");
		mkdirSync(uiDir, { recursive: true });
		writeFileSync(join(uiDir, "completion-wake-ready.json"), `${JSON.stringify({
			schema_version: "flowdesk.completion_wake_ready_cache.v1",
			observed_at: "2026-06-05T00:00:00.000Z",
			expires_at: "2026-06-05T00:02:00.000Z",
			rows: [{
				workflowId: "workflow-badmodel-wake",
				parentSessionRef: "ses-ses_parent123",
				completionKind: "task_result",
				readyAt: "2026-06-05T00:00:30.000Z",
				dedupeKey: "ses-ses_parent123\u0000workflow-badmodel-wake",
				consumptionKey: "ses-ses_parent123:workflow-badmodel-wake:2026-06-05T00:00:30.000Z:1:0",
				consumed: false,
				taskSummaries: [],
				notificationLabel: "FlowDesk task completed",
				parentWakeProviderQualifiedModelId: "invalid-no-slash",
			}],
		}, null, 2)}\n`, "utf8");
		const prompts: unknown[] = [];
		const result = await consumeFlowDeskCompletionWakeForMainSessionV1({
			config: { enabled: true, rootDir: root, agentName: "flowdesk-main", providerQualifiedModelId: "openai/gpt-5.5" },
			client: { session: { promptAsync: async (options: unknown) => { prompts.push(options); return {}; } } },
			now: new Date("2026-06-05T00:01:00.000Z"),
		});
		assert.equal(result.status, "main_session_wake_completed");
		assert.equal(result.wakeSucceeded, 1);
		assert.equal(prompts.length, 1);
		const body = (prompts[0] as { body: Record<string, unknown> }).body;
		assert.deepEqual(body.model, { providerID: "openai", modelID: "gpt-5.5" });
		assert.equal((body.parts as Array<{ text: string }>)[0]?.text, "[FlowDesk:done] workflow-badmodel-wake. Check /flowdesk-status.");
	} finally {
		rmSync(root, { recursive: true, force: true });
	}
});

test("completion wake main-session consumer defaults when both row model and config model are invalid", async () => {
	const root = mkdtempSync(join(tmpdir(), "flowdesk-main-wake-nomodel-"));
	try {
		const uiDir = join(root, ".flowdesk", "ui");
		mkdirSync(uiDir, { recursive: true });
		writeFileSync(join(uiDir, "completion-wake-ready.json"), `${JSON.stringify({
			schema_version: "flowdesk.completion_wake_ready_cache.v1",
			observed_at: "2026-06-05T00:00:00.000Z",
			expires_at: "2026-06-05T00:02:00.000Z",
			rows: [{
				workflowId: "workflow-nomodel-wake",
				parentSessionRef: "ses-ses_parent123",
				completionKind: "task_result",
				readyAt: "2026-06-05T00:00:30.000Z",
				dedupeKey: "ses-ses_parent123\u0000workflow-nomodel-wake",
				consumptionKey: "ses-ses_parent123:workflow-nomodel-wake:2026-06-05T00:00:30.000Z:1:0",
				consumed: false,
				taskSummaries: [],
				notificationLabel: "FlowDesk task completed",
				parentWakeProviderQualifiedModelId: "also-invalid",
			}],
		}, null, 2)}\n`, "utf8");
		const prompts: unknown[] = [];
		const result = await consumeFlowDeskCompletionWakeForMainSessionV1({
			// Config model is also invalid (no slash), so no explicit model is sent.
			config: { enabled: true, rootDir: root, agentName: "flowdesk-main", providerQualifiedModelId: "broken" },
			client: { session: { promptAsync: async (options: unknown) => { prompts.push(options); return {}; } } },
			now: new Date("2026-06-05T00:01:00.000Z"),
		});
		assert.equal(result.status, "main_session_wake_completed");
		assert.equal(result.wakeSucceeded, 1);
		assert.equal(prompts.length, 1);
		assert.equal("model" in (prompts[0] as { body: Record<string, unknown> }).body, false);
		const ready = JSON.parse(readFileSync(join(uiDir, "completion-wake-ready.json"), "utf8")) as { rows: Array<{ consumed?: boolean; consumedBy?: string }> };
		assert.equal(ready.rows[0]?.consumed, true);
		assert.equal(ready.rows[0]?.consumedBy, "main_session_prompt");
	} finally {
		rmSync(root, { recursive: true, force: true });
	}
});
