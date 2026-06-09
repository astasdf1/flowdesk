import assert from "node:assert/strict";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import test from "node:test";

// ASSERTION: Ensure no "/Users/" literal appears in completion-wake-main-session.ts and event-hook-observer.ts.

const previousWakeDiag = process.env.FLOWDESK_WAKE_DIAG;

process.env.FLOWDESK_WAKE_DIAG = "1";

test("FLOWDESK_WAKE_DIAG diagnostic log paths use real homedir", async () => {
	const diagRoot = join(homedir(), ".flowdesk", "test-diag");
	mkdirSync(diagRoot, { recursive: true });
	const root = mkdtempSync(join(diagRoot, "flowdesk-homedir-guard-"));
	const wakeDispatchDiagPath = join(homedir(), ".flowdesk", "wake-dispatch-diag.log");
	rmSync(wakeDispatchDiagPath, { force: true });

	try {
		const { consumeFlowDeskCompletionWakeForMainSessionV1 } = await import("./completion-wake-main-session.js");
		const { observeFlowDeskOpenCodeEventV1 } = await import("./event-hook-observer.js");

		const flowdeskRoot = join(root, "workspace");
		const uiDir = join(flowdeskRoot, ".flowdesk", "ui");
		mkdirSync(uiDir, { recursive: true });
		writeFileSync(join(uiDir, "completion-wake-ready.json"), `${JSON.stringify({
			schema_version: "flowdesk.completion_wake_ready_cache.v1",
			observed_at: "2026-06-09T00:00:00.000Z",
			expires_at: "2026-06-09T00:02:00.000Z",
			rows: [{
				workflowId: "workflow-homedir-guard",
				parentSessionRef: "ses-ses_parent123",
				completionKind: "task_result",
				readyAt: "2026-06-09T00:00:30.000Z",
				dedupeKey: "ses-ses_parent123\u0000workflow-homedir-guard",
				consumptionKey: "ses-ses_parent123:workflow-homedir-guard:2026-06-09T00:00:30.000Z:1:0",
				consumed: false,
			}],
		}, null, 2)}\n`, "utf8");

		const result = await consumeFlowDeskCompletionWakeForMainSessionV1({
			config: { enabled: true, rootDir: flowdeskRoot, agentName: "flowdesk-main", providerQualifiedModelId: "openai/gpt-5.5" },
			client: { session: { promptAsync: async () => ({ ok: true }) } },
			now: new Date("2026-06-09T00:01:00.000Z"),
		});
		assert.equal(result.status, "main_session_wake_completed");
		await observeFlowDeskOpenCodeEventV1({
			rootDir: flowdeskRoot,
			event: { type: "session.idle", properties: { sessionID: "ses_child123" } },
		});
	} finally {
		if (previousWakeDiag === undefined) delete process.env.FLOWDESK_WAKE_DIAG;
		else process.env.FLOWDESK_WAKE_DIAG = previousWakeDiag;
		rmSync(wakeDispatchDiagPath, { force: true });
		rmSync(root, { recursive: true, force: true });
	}
});
