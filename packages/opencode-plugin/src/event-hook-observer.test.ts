import assert from "node:assert/strict";
import test from "node:test";
import { eventIsFinalizationRelevant } from "./event-hook-observer.js";

test("V11.3 eventIsFinalizationRelevant: only 3 events trigger wake prompt injection", () => {
	// 1. Task success completion — session.idle (sidebar: done)
	assert.equal(eventIsFinalizationRelevant("session.idle", undefined), true);
	// 2. Task full failure — session.error (sidebar: failed)
	assert.equal(eventIsFinalizationRelevant("session.error", undefined), true);
	// 3. Tool use timeout — tool error (sidebar: attention)
	assert.equal(eventIsFinalizationRelevant("message.part.updated", "agent task tool error callid=A"), true);
});

test("V11.3 eventIsFinalizationRelevant: everything else is ambient churn — NO wake", () => {
	// session.status (idle/busy/retry) — was burst cause, now excluded.
	assert.equal(eventIsFinalizationRelevant("session.status", undefined), false);
	// Turn-completed — was burst cause, now excluded.
	assert.equal(eventIsFinalizationRelevant("message.updated", "agent task turn completed msgid=m created=1 completed=2"), false);
	// Tool settled (normal tool completion) — was the primary burst cause, now excluded.
	assert.equal(eventIsFinalizationRelevant("message.part.updated", "agent task tool settled callid=A"), false);
	// Terminal step — ambient stream event, now excluded.
	assert.equal(eventIsFinalizationRelevant("message.part.updated", "agent task terminal step event observed"), false);
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
