import assert from "node:assert/strict";
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { consumeFlowDeskCompletionWakeForMainSessionV1, type WakeNoticeInboxEntry } from "./completion-wake-main-session.js";

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
		assert.equal((body.parts as Array<{ text: string }>)[0]?.text, "[FlowDesk:done] workflow-main-wake-result. Check /flowdesk-status.");
	} finally {
		rmSync(root, { recursive: true, force: true });
	}
});

test("completion wake main-session consumer prefers the oldest unresolved ready row", async () => {
	const root = mkdtempSync(join(tmpdir(), "flowdesk-main-wake-oldest-first-"));
	try {
		const uiDir = join(root, ".flowdesk", "ui");
		mkdirSync(uiDir, { recursive: true });
		writeFileSync(join(uiDir, "completion-wake-ready.json"), `${JSON.stringify({
			schema_version: "flowdesk.completion_wake_ready_cache.v1",
			observed_at: "2026-06-04T00:00:00.000Z",
			expires_at: "2026-06-04T00:02:00.000Z",
			rows: [
				{
					workflowId: "workflow-old-success",
					parentSessionRef: "ses-ses_parent123",
					completionKind: "task_result",
					readyAt: "2026-06-04T00:00:30.000Z",
					dedupeKey: "ses-ses_parent123\u0000workflow-old-success",
					consumptionKey: "ses-ses_parent123:workflow-old-success:2026-06-04T00:00:30.000Z:1:0",
					consumed: false,
					taskSummaries: [],
					notificationLabel: "Old success ready",
				},
				{
					workflowId: "workflow-new-failure",
					parentSessionRef: "ses-ses_parent123",
					completionKind: "task_failed",
					readyAt: "2026-06-04T00:00:40.000Z",
					dedupeKey: "ses-ses_parent123\u0000workflow-new-failure",
					consumptionKey: "ses-ses_parent123:workflow-new-failure:2026-06-04T00:00:40.000Z:1:0",
					consumed: false,
					taskSummaries: [],
					notificationLabel: "New failure ready",
				},
			],
		}, null, 2)}\n`, "utf8");
		const prompts: unknown[] = [];
		const result = await consumeFlowDeskCompletionWakeForMainSessionV1({
			config: { enabled: true, rootDir: root, agentName: "flowdesk-main", providerQualifiedModelId: "openai/gpt-5.5" },
			client: { session: { promptAsync: async (options: unknown) => { prompts.push(options); return {}; } } },
			now: new Date("2026-06-04T00:01:00.000Z"),
		});
		assert.equal(result.status, "main_session_wake_completed");
		assert.equal(result.wakeSucceeded, 1);
		assert.equal(prompts.length, 1);
		assert.equal((prompts[0] as { body: { parts: Array<{ text: string }> } }).body.parts[0]?.text, "[FlowDesk:done] workflow-old-success. Check /flowdesk-status.");
		const ready = JSON.parse(readFileSync(join(uiDir, "completion-wake-ready.json"), "utf8")) as { rows: Array<{ workflowId: string; consumed?: boolean }> };
		const oldRow = ready.rows.find((row) => row.workflowId === "workflow-old-success");
		const newRow = ready.rows.find((row) => row.workflowId === "workflow-new-failure");
		assert.equal(oldRow?.consumed, true);
		assert.equal(newRow?.consumed, false);
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

test("wake notice inbox increments prompt attempts on repeated prompt resolve", async () => {
	const root = mkdtempSync(join(tmpdir(), "flowdesk-wake-inbox-attempts-"));
	try {
		const uiDir = join(root, ".flowdesk", "ui");
		mkdirSync(uiDir, { recursive: true });
		const noticeId = "ses-ses_parent888:workflow-ack-test:lane-ack:2026-06-24T11:00:30.000Z:task-ack:task_result";
		writeFileSync(join(uiDir, "main-session-wake-notifications.json"), `${JSON.stringify({
			schema_version: "flowdesk.main_session_wake_notifications.v1",
			observed_at: "2026-06-24T11:00:30.000Z",
			expires_at: "2026-06-24T11:02:30.000Z",
			notices: [{
				notice_id: noticeId,
				created_at: "2026-06-24T11:00:30.000Z",
				workflowId: "workflow-ack-test",
				completionKind: "task_result",
				notificationLabel: "Ack test notice",
				consumed: true,
				consumedAt: "2026-06-24T11:00:30.000Z",
				prompt_attempt_count: 2,
				user_acknowledged: false,
			}],
		}, null, 2)}\n`, "utf8");

		writeFileSync(join(uiDir, "completion-wake-ready.json"), `${JSON.stringify({
			schema_version: "flowdesk.completion_wake_ready_cache.v1",
			observed_at: "2026-06-24T11:00:00.000Z",
			expires_at: "2026-06-24T11:02:00.000Z",
			rows: [{
				workflowId: "workflow-ack-test",
				parentSessionRef: "ses-ses_parent888",
				completionKind: "task_result",
				readyAt: "2026-06-24T11:00:30.000Z",
				dedupeKey: "ses-ses_parent888\u0000workflow-ack-test\u0000lane-ack",
				consumptionKey: noticeId,
				consumed: false,
				taskSummaries: [],
				notificationLabel: "Ack test notice",
			}],
		}, null, 2)}\n`, "utf8");

		const result = await consumeFlowDeskCompletionWakeForMainSessionV1({
			config: { enabled: true, rootDir: root, agentName: "flowdesk-main", providerQualifiedModelId: "openai/gpt-5.5" },
			client: { session: { promptAsync: async () => ({}) } },
			now: new Date("2026-06-24T11:01:00.000Z"),
		});
		assert.equal(result.wakeSucceeded, 1);

		const inbox = JSON.parse(readFileSync(join(uiDir, "main-session-wake-notifications.json"), "utf8")) as { notices: WakeNoticeInboxEntry[] };
		assert.equal(inbox.notices.length, 1);
		const notice = inbox.notices[0];
		assert.ok(notice);
		assert.equal(notice?.prompt_attempt_count, 3);
		assert.equal(notice?.user_acknowledged, false);
		assert.equal(notice?.consumed, true);
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

// Wake model precedence chain (live session > parent-recorded > config > none):
//   - When session.messages() exposes a current model, it wins over both the
//     recorded wake row model and any configured wake model.
//   - When the live session model is unavailable and the row carries
//     `parentWakeProviderQualifiedModelId`, the row model wins over any
//     configured wake model — even when the configured model is valid.
//   - When both live and row models are missing/unparseable, fall back to the
//     `config.providerQualifiedModelId` resolved by
//     `completionWakeMainSessionConfigFromOptions()` (which defaults to the
//     `FLOWDESK_MAIN_COORDINATOR_MODEL` set by the bootstrap installer).
//   - When all candidates are missing/unparseable, omit the `model` body field so
//     OpenCode picks its own routing default.
test("completion wake precedence: row model wins over a valid config model", async () => {
	const root = mkdtempSync(join(tmpdir(), "flowdesk-main-wake-precedence-row-"));
	try {
		const uiDir = join(root, ".flowdesk", "ui");
		mkdirSync(uiDir, { recursive: true });
		writeFileSync(join(uiDir, "completion-wake-ready.json"), `${JSON.stringify({
			schema_version: "flowdesk.completion_wake_ready_cache.v1",
			observed_at: "2026-06-05T00:00:00.000Z",
			expires_at: "2026-06-05T00:02:00.000Z",
			rows: [{
				workflowId: "workflow-precedence-row",
				parentSessionRef: "ses-ses_parent123",
				completionKind: "task_result",
				readyAt: "2026-06-05T00:00:30.000Z",
				dedupeKey: "ses-ses_parent123\u0000workflow-precedence-row",
				consumptionKey: "ses-ses_parent123:workflow-precedence-row:2026-06-05T00:00:30.000Z:1:0",
				consumed: false,
				taskSummaries: [],
				notificationLabel: "FlowDesk task completed",
				// Row carries the parent's recorded coordinator model.
				parentWakeProviderQualifiedModelId: "openai/gpt-5.4-mini-fast",
			}],
		}, null, 2)}\n`, "utf8");
		const prompts: unknown[] = [];
		const result = await consumeFlowDeskCompletionWakeForMainSessionV1({
			// Config model is valid but DIFFERENT — row model must still win.
			config: { enabled: true, rootDir: root, agentName: "flowdesk-main", providerQualifiedModelId: "openai/gpt-5.5" },
			client: { session: { promptAsync: async (options: unknown) => { prompts.push(options); return {}; } } },
			now: new Date("2026-06-05T00:01:00.000Z"),
		});
		assert.equal(result.status, "main_session_wake_completed");
		assert.equal(result.wakeSucceeded, 1);
		assert.equal(prompts.length, 1);
		const body = (prompts[0] as { body: Record<string, unknown> }).body;
		assert.deepEqual(body.model, { providerID: "openai", modelID: "gpt-5.4-mini-fast" });
	} finally {
		rmSync(root, { recursive: true, force: true });
	}
});

test("completion wake precedence: live session messages model wins over row and config models", async () => {
	const root = mkdtempSync(join(tmpdir(), "flowdesk-main-wake-precedence-live-"));
	try {
		const uiDir = join(root, ".flowdesk", "ui");
		mkdirSync(uiDir, { recursive: true });
		writeFileSync(join(uiDir, "completion-wake-ready.json"), `${JSON.stringify({
			schema_version: "flowdesk.completion_wake_ready_cache.v1",
			observed_at: "2026-06-05T00:00:00.000Z",
			expires_at: "2026-06-05T00:02:00.000Z",
			rows: [{
				workflowId: "workflow-precedence-live",
				parentSessionRef: "ses-ses_parent123",
				completionKind: "task_result",
				readyAt: "2026-06-05T00:00:30.000Z",
				dedupeKey: "ses-ses_parent123\u0000workflow-precedence-live",
				consumptionKey: "ses-ses_parent123:workflow-precedence-live:2026-06-05T00:00:30.000Z:1:0",
				consumed: false,
				taskSummaries: [],
				notificationLabel: "FlowDesk task completed",
				parentWakeProviderQualifiedModelId: "anthropic/claude-opus-4-20250514",
			}],
		}, null, 2)}\n`, "utf8");
		const prompts: unknown[] = [];
		const messageCalls: unknown[] = [];
		const result = await consumeFlowDeskCompletionWakeForMainSessionV1({
			config: { enabled: true, rootDir: root, agentName: "flowdesk-main", providerQualifiedModelId: "openai/gpt-5.5" },
			client: { session: {
				messages: async (options: unknown) => {
					messageCalls.push(options);
					return { data: [
						{ info: { model: { providerID: "openai", modelID: "older" } } },
						{ info: { model: { providerID: "google", modelID: "gemini-2.5-pro" } } },
					] };
				},
				promptAsync: async (options: unknown) => { prompts.push(options); return {}; },
			} },
			now: new Date("2026-06-05T00:01:00.000Z"),
		});
		assert.equal(result.status, "main_session_wake_completed");
		assert.equal(result.wakeSucceeded, 1);
		assert.equal(messageCalls.length, 1);
		assert.equal((messageCalls[0] as { path: { id: string } }).path.id, "ses_parent123");
		const body = (prompts[0] as { body: Record<string, unknown> }).body;
		assert.deepEqual(body.model, { providerID: "google", modelID: "gemini-2.5-pro" });
	} finally {
		rmSync(root, { recursive: true, force: true });
	}
});

test("completion wake precedence: row model used when session messages throws", async () => {
	const root = mkdtempSync(join(tmpdir(), "flowdesk-main-wake-precedence-live-throws-"));
	try {
		const uiDir = join(root, ".flowdesk", "ui");
		mkdirSync(uiDir, { recursive: true });
		writeFileSync(join(uiDir, "completion-wake-ready.json"), `${JSON.stringify({
			schema_version: "flowdesk.completion_wake_ready_cache.v1",
			observed_at: "2026-06-05T00:00:00.000Z",
			expires_at: "2026-06-05T00:02:00.000Z",
			rows: [{
				workflowId: "workflow-precedence-live-throws",
				parentSessionRef: "ses-ses_parent123",
				completionKind: "task_result",
				readyAt: "2026-06-05T00:00:30.000Z",
				dedupeKey: "ses-ses_parent123\u0000workflow-precedence-live-throws",
				consumptionKey: "ses-ses_parent123:workflow-precedence-live-throws:2026-06-05T00:00:30.000Z:1:0",
				consumed: false,
				taskSummaries: [],
				notificationLabel: "FlowDesk task completed",
				parentWakeProviderQualifiedModelId: "anthropic/claude-opus-4-20250514",
			}],
		}, null, 2)}\n`, "utf8");
		const prompts: unknown[] = [];
		const result = await consumeFlowDeskCompletionWakeForMainSessionV1({
			config: { enabled: true, rootDir: root, agentName: "flowdesk-main", providerQualifiedModelId: "openai/gpt-5.5" },
			client: { session: {
				messages: async () => { throw new Error("messages unavailable"); },
				promptAsync: async (options: unknown) => { prompts.push(options); return {}; },
			} },
			now: new Date("2026-06-05T00:01:00.000Z"),
		});
		assert.equal(result.status, "main_session_wake_completed");
		assert.equal(result.wakeSucceeded, 1);
		const body = (prompts[0] as { body: Record<string, unknown> }).body;
		assert.deepEqual(body.model, { providerID: "anthropic", modelID: "claude-opus-4-20250514" });
	} finally {
		rmSync(root, { recursive: true, force: true });
	}
});

test("completion wake precedence: config model used when row recorded model is absent", async () => {
	const root = mkdtempSync(join(tmpdir(), "flowdesk-main-wake-precedence-config-"));
	try {
		const uiDir = join(root, ".flowdesk", "ui");
		mkdirSync(uiDir, { recursive: true });
		writeFileSync(join(uiDir, "completion-wake-ready.json"), `${JSON.stringify({
			schema_version: "flowdesk.completion_wake_ready_cache.v1",
			observed_at: "2026-06-05T00:00:00.000Z",
			expires_at: "2026-06-05T00:02:00.000Z",
			rows: [{
				workflowId: "workflow-precedence-config",
				parentSessionRef: "ses-ses_parent123",
				completionKind: "task_result",
				readyAt: "2026-06-05T00:00:30.000Z",
				dedupeKey: "ses-ses_parent123\u0000workflow-precedence-config",
				consumptionKey: "ses-ses_parent123:workflow-precedence-config:2026-06-05T00:00:30.000Z:1:0",
				consumed: false,
				taskSummaries: [],
				notificationLabel: "FlowDesk task completed",
				// Intentionally no parentWakeProviderQualifiedModelId field.
			}],
		}, null, 2)}\n`, "utf8");
		const prompts: unknown[] = [];
		const result = await consumeFlowDeskCompletionWakeForMainSessionV1({
			// Config model is the bootstrap-installer FLOWDESK_MAIN_COORDINATOR_MODEL default.
			config: { enabled: true, rootDir: root, agentName: "flowdesk-main", providerQualifiedModelId: "openai/gpt-5.4-mini-fast" },
			client: { session: { promptAsync: async (options: unknown) => { prompts.push(options); return {}; } } },
			now: new Date("2026-06-05T00:01:00.000Z"),
		});
		assert.equal(result.status, "main_session_wake_completed");
		assert.equal(result.wakeSucceeded, 1);
		assert.equal(prompts.length, 1);
		const body = (prompts[0] as { body: Record<string, unknown> }).body;
		assert.deepEqual(body.model, { providerID: "openai", modelID: "gpt-5.4-mini-fast" });
	} finally {
		rmSync(root, { recursive: true, force: true });
	}
});

// ---------------------------------------------------------------------------
// Phase 1 wake-notification reliability tests
// ---------------------------------------------------------------------------
//
// Test 1: Later wake notice does NOT erase a prior notice.
//         Confirms that additive merge preserves both entries.
//
// Test 2: Prompt resolve records a prompt attempt but does NOT set
//         user_acknowledged — proof that consumed=true ≠ user saw it.
//
// Test 3: status_live read path does not mutate/consume notices (covered in
//         status-live-tool.test.ts; see "wake notice inbox read-only").
// ---------------------------------------------------------------------------

test("wake notice inbox: later wake notice does not erase prior notice", async () => {
	const root = mkdtempSync(join(tmpdir(), "flowdesk-wake-inbox-merge-"));
	try {
		const uiDir = join(root, ".flowdesk", "ui");
		mkdirSync(uiDir, { recursive: true });

		// First wake notice: workflow A, lane result.
		writeFileSync(join(uiDir, "completion-wake-ready.json"), `${JSON.stringify({
			schema_version: "flowdesk.completion_wake_ready_cache.v1",
			observed_at: "2026-06-24T10:00:00.000Z",
			expires_at: "2026-06-24T10:02:00.000Z",
			rows: [{
				workflowId: "workflow-notice-A",
				parentSessionRef: "ses-ses_parent999",
				completionKind: "task_result",
				readyAt: "2026-06-24T10:00:30.000Z",
				dedupeKey: "ses-ses_parent999\u0000workflow-notice-A\u0000lane-A",
				consumptionKey: "ses-ses_parent999:workflow-notice-A:lane-A:2026-06-24T10:00:30.000Z:task-A:task_result",
				consumed: false,
				taskSummaries: [],
				notificationLabel: "Task A completed",
			}],
		}, null, 2)}\n`, "utf8");

		await consumeFlowDeskCompletionWakeForMainSessionV1({
			config: { enabled: true, rootDir: root, agentName: "flowdesk-main", providerQualifiedModelId: "openai/gpt-5.5" },
			client: { session: { promptAsync: async () => ({}) } },
			now: new Date("2026-06-24T10:01:00.000Z"),
		});

		// Verify first notice was written.
		const inbox1 = JSON.parse(readFileSync(join(uiDir, "main-session-wake-notifications.json"), "utf8")) as { notices: WakeNoticeInboxEntry[] };
		assert.equal(inbox1.notices.length, 1);
		assert.equal(inbox1.notices[0]?.workflowId, "workflow-notice-A");

		// Second wake notice: workflow B, different consumptionKey.
		// Reset the ready cache to contain only the second notice (simulates new event arriving).
		writeFileSync(join(uiDir, "completion-wake-ready.json"), `${JSON.stringify({
			schema_version: "flowdesk.completion_wake_ready_cache.v1",
			observed_at: "2026-06-24T10:05:00.000Z",
			expires_at: "2026-06-24T10:07:00.000Z",
			rows: [{
				workflowId: "workflow-notice-B",
				parentSessionRef: "ses-ses_parent999",
				completionKind: "task_failed",
				readyAt: "2026-06-24T10:05:00.000Z",
				dedupeKey: "ses-ses_parent999\u0000workflow-notice-B\u0000lane-B",
				consumptionKey: "ses-ses_parent999:workflow-notice-B:lane-B:2026-06-24T10:05:00.000Z:task-B:task_failed",
				consumed: false,
				taskSummaries: [],
				notificationLabel: "Task B failed",
			}],
		}, null, 2)}\n`, "utf8");

		await consumeFlowDeskCompletionWakeForMainSessionV1({
			config: { enabled: true, rootDir: root, agentName: "flowdesk-main", providerQualifiedModelId: "openai/gpt-5.5" },
			client: { session: { promptAsync: async () => ({}) } },
			now: new Date("2026-06-24T10:06:00.000Z"),
		});

		// Both notices must be present: prior notice was NOT erased.
		const inbox2 = JSON.parse(readFileSync(join(uiDir, "main-session-wake-notifications.json"), "utf8")) as { notices: WakeNoticeInboxEntry[] };
		assert.equal(inbox2.notices.length, 2, "Both wake notices must be present in the inbox after additive merge");
		const workflowIds = inbox2.notices.map((n) => n.workflowId).sort();
		assert.deepEqual(workflowIds, ["workflow-notice-A", "workflow-notice-B"], "Both workflow notices must survive merge");
	} finally {
		rmSync(root, { recursive: true, force: true });
	}
});

test("completion wake precedence: config model used when session messages are empty and row model is absent", async () => {
	const root = mkdtempSync(join(tmpdir(), "flowdesk-main-wake-precedence-live-empty-"));
	try {
		const uiDir = join(root, ".flowdesk", "ui");
		mkdirSync(uiDir, { recursive: true });
		writeFileSync(join(uiDir, "completion-wake-ready.json"), `${JSON.stringify({
			schema_version: "flowdesk.completion_wake_ready_cache.v1",
			observed_at: "2026-06-05T00:00:00.000Z",
			expires_at: "2026-06-05T00:02:00.000Z",
			rows: [{
				workflowId: "workflow-precedence-live-empty",
				parentSessionRef: "ses-ses_parent123",
				completionKind: "task_result",
				readyAt: "2026-06-05T00:00:30.000Z",
				dedupeKey: "ses-ses_parent123\u0000workflow-precedence-live-empty",
				consumptionKey: "ses-ses_parent123:workflow-precedence-live-empty:2026-06-05T00:00:30.000Z:1:0",
				consumed: false,
				taskSummaries: [],
				notificationLabel: "FlowDesk task completed",
			}],
		}, null, 2)}\n`, "utf8");
		const prompts: unknown[] = [];
		const result = await consumeFlowDeskCompletionWakeForMainSessionV1({
			config: { enabled: true, rootDir: root, agentName: "flowdesk-main", providerQualifiedModelId: "openai/gpt-5.5" },
			client: { session: {
				messages: async () => [],
				promptAsync: async (options: unknown) => { prompts.push(options); return {}; },
			} },
			now: new Date("2026-06-05T00:01:00.000Z"),
		});
		assert.equal(result.status, "main_session_wake_completed");
		assert.equal(result.wakeSucceeded, 1);
		const body = (prompts[0] as { body: Record<string, unknown> }).body;
		assert.deepEqual(body.model, { providerID: "openai", modelID: "gpt-5.5" });
	} finally {
		rmSync(root, { recursive: true, force: true });
	}
});
