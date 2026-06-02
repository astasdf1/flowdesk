import assert from "node:assert/strict";
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { consumeFlowDeskCompletionWakeForMainSessionV1 } from "./completion-wake-main-session.js";

test("completion wake main-session consumer sends one parent prompt and marks consumed", async () => {
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
			config: { enabled: true, rootDir: root, agentName: "flowdesk-main", providerQualifiedModelId: "openai/gpt-5.5" },
			client: { session: { promptAsync: async (options: unknown) => { prompts.push(options); return {}; } } },
			now: new Date("2026-06-02T00:01:00.000Z"),
		});
		assert.equal(result.status, "main_session_wake_completed");
		assert.equal(result.wakeSucceeded, 1);
		assert.equal(prompts.length, 1);
		assert.equal((prompts[0] as { path: { id: string } }).path.id, "ses_parent123");
		assert.match(JSON.stringify(prompts[0]), /FlowDesk completion wake signal/);
		assert.doesNotMatch(JSON.stringify(prompts[0]), /noReply/);

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
	assert.equal(result.skippedReason, "opencode_sdk_client_unavailable");
});
