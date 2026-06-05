import assert from "node:assert/strict";
import test from "node:test";
import { eventIsFinalizationRelevant } from "./event-hook-observer.js";

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
