import assert from "node:assert/strict";
import test from "node:test";
import { eventIsFinalizationRelevant } from "./event-hook-observer.js";

test("V11.3 eventIsFinalizationRelevant: finalization-relevant events poke the watchdog", () => {
	// Terminal/idle/error session events are finalization-relevant.
	assert.equal(eventIsFinalizationRelevant("session.error", undefined), true);
	assert.equal(eventIsFinalizationRelevant("session.idle", undefined), true);
	assert.equal(eventIsFinalizationRelevant("session.status", undefined), true);
	// Turn-completed (assistant message.updated with time.completed) — relevant.
	assert.equal(
		eventIsFinalizationRelevant("message.updated", "agent task turn completed msgid=m created=1 completed=2"),
		true,
	);
	// Tool settled / terminal step — relevant (a tool finishing can unblock capture).
	assert.equal(
		eventIsFinalizationRelevant("message.part.updated", "agent task tool settled callid=A"),
		true,
	);
	assert.equal(
		eventIsFinalizationRelevant("message.part.updated", "agent task terminal step event observed"),
		true,
	);
});

test("V11.3 eventIsFinalizationRelevant: streaming/ambient churn does NOT poke the watchdog", () => {
	// Plain assistant message.updated (no turn-completed) must not poke — would flood.
	assert.equal(eventIsFinalizationRelevant("message.updated", "agent task message.updated event observed"), false);
	// Streaming message parts must not poke.
	assert.equal(eventIsFinalizationRelevant("message.part.updated", "agent task message part event observed"), false);
	// A tool just starting (still running) is not finalization-relevant.
	assert.equal(eventIsFinalizationRelevant("message.part.updated", "agent task tool running callid=A"), false);
	// Ambient session churn.
	assert.equal(eventIsFinalizationRelevant("session.updated", "agent task session.updated event observed"), false);
	assert.equal(eventIsFinalizationRelevant("session.diff", "agent task session.diff event observed"), false);
	// Unknown / undefined.
	assert.equal(eventIsFinalizationRelevant(undefined, undefined), false);
	assert.equal(eventIsFinalizationRelevant("message.part.updated", undefined), false);
});
