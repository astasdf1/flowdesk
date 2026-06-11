import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import {
	eventIsFinalizationRelevant,
	findIndexedFlowDeskEventHookBindingForTests,
	observeFlowDeskOpenCodeEventV1,
	primeFlowDeskEventHookBindingIndexForTests,
	resetFlowDeskEventHookBindingIndexForTests,
} from "./event-hook-observer.js";

test("V11.3 eventIsFinalizationRelevant: terminal events trigger bounded capture", () => {
	// 1. Task success completion — session.idle (sidebar: done)
	assert.equal(eventIsFinalizationRelevant("session.idle", undefined), true);
	// 2. Task full failure — session.error (sidebar: failed)
	assert.equal(eventIsFinalizationRelevant("session.error", undefined), true);
	// 3. Tool use timeout — tool error (sidebar: attention)
	assert.equal(eventIsFinalizationRelevant("message.part.updated", "agent task tool error callid=A"), true);
	// 4. Assistant turn completed — bounded capture can persist task_result.
	assert.equal(eventIsFinalizationRelevant("message.updated", "agent task turn completed msgid=m created=1 completed=2"), true);
	// 5. Terminal step — bounded capture can observe final output after step finish.
	assert.equal(eventIsFinalizationRelevant("message.part.updated", "agent task terminal step event observed"), true);
});

test("V11.3 eventIsFinalizationRelevant: everything else is ambient churn — NO wake", () => {
	// session.status (idle/busy/retry) — was burst cause, now excluded.
	assert.equal(eventIsFinalizationRelevant("session.status", undefined), false);
	// Turn-completed is finalization-relevant for bounded capture, covered above.
	// Tool settled (normal tool completion) — was the primary burst cause, now excluded.
	assert.equal(eventIsFinalizationRelevant("message.part.updated", "agent task tool settled callid=A"), false);
	// Terminal step is finalization-relevant for bounded capture, covered above.
	// Plain assistant message.updated (no turn-completed) — ambient.
	assert.equal(eventIsFinalizationRelevant("message.updated", "agent task message.updated event observed"), false);
	// Streaming message parts — ambient.
	assert.equal(eventIsFinalizationRelevant("message.part.updated", "agent task message part event observed"), false);
	// Tool just starting (still running) — ambient.
	assert.equal(eventIsFinalizationRelevant("message.part.updated", "agent task tool running callid=A"), false);
	// Ambient session churn.
	assert.equal(eventIsFinalizationRelevant("session.updated", "agent task session.updated event observed"), false);
	assert.equal(eventIsFinalizationRelevant("session.diff", "agent task session.diff event observed"), false);
	// Unknown / undefined.
	assert.equal(eventIsFinalizationRelevant(undefined, undefined), false);
	assert.equal(eventIsFinalizationRelevant("message.part.updated", undefined), false);
});

function tempRoot(): string {
	return mkdtempSync(join(tmpdir(), "flowdesk-event-hook-"));
}

function writeChildSessionBinding(rootDir: string, workflowId: string, binding: Record<string, unknown>): void {
	const evidenceDir = join(rootDir, ".flowdesk", "sessions", workflowId, "evidence", "agent-task-child-session");
	mkdirSync(evidenceDir, { recursive: true });
	writeFileSync(join(evidenceDir, `${binding.lane_id}.json`), JSON.stringify(binding), "utf8");
}

test("event hook uses indexed child-session binding without requiring evidence scan", async () => {
	resetFlowDeskEventHookBindingIndexForTests();
	const rootDir = tempRoot();
	try {
		primeFlowDeskEventHookBindingIndexForTests(rootDir, {
			workflowId: "workflow-indexed",
			laneId: "lane-indexed",
			taskId: "task-indexed",
			childSessionId: "child-indexed",
			parentSessionRef: "ses-parent",
			agentRef: "agent-test",
			providerQualifiedModelId: "openai/gpt-5.5",
		});
		const result = await observeFlowDeskOpenCodeEventV1({
			rootDir,
			event: { type: "session.idle", properties: { sessionID: "child-indexed" } },
		});
		assert.equal(result.matched, true);
		assert.equal(result.workflowId, "workflow-indexed");
		assert.equal(result.laneId, "lane-indexed");
		assert.equal(result.taskId, "task-indexed");
		assert.equal(result.finalizationRelevant, true);
		assert.equal(result.evidenceWritten, 1);
	} finally {
		rmSync(rootDir, { recursive: true, force: true });
		resetFlowDeskEventHookBindingIndexForTests();
	}
});

test("event hook fallback scan populates the binding index for sibling child sessions", async () => {
	resetFlowDeskEventHookBindingIndexForTests();
	const rootDir = tempRoot();
	try {
		writeChildSessionBinding(rootDir, "workflow-scan", {
			child_session_id: "child-a",
			lane_id: "lane-a",
			task_id: "task-a",
			agent_ref: "agent-test",
			provider_qualified_model_id: "openai/gpt-5.5",
			parent_session_ref: "ses-parent",
		});
		writeChildSessionBinding(rootDir, "workflow-scan", {
			child_session_id: "child-b",
			lane_id: "lane-b",
			task_id: "task-b",
			agent_ref: "agent-test",
			provider_qualified_model_id: "openai/gpt-5.5",
			parent_session_ref: "ses-parent",
		});

		const first = await observeFlowDeskOpenCodeEventV1({
			rootDir,
			event: { type: "session.status", properties: { sessionID: "child-a", status: { type: "busy" } } },
		});
		assert.equal(first.matched, true);
		assert.equal(first.laneId, "lane-a");
		assert.equal(findIndexedFlowDeskEventHookBindingForTests(rootDir, "child-b")?.laneId, "lane-b");

		rmSync(join(rootDir, ".flowdesk", "sessions", "workflow-scan", "evidence", "agent-task-child-session"), { recursive: true, force: true });
		const second = await observeFlowDeskOpenCodeEventV1({
			rootDir,
			event: { type: "session.idle", properties: { sessionID: "child-b" } },
		});
		assert.equal(second.matched, true);
		assert.equal(second.laneId, "lane-b");
		assert.equal(second.finalizationRelevant, true);
	} finally {
		rmSync(rootDir, { recursive: true, force: true });
		resetFlowDeskEventHookBindingIndexForTests();
	}
});
