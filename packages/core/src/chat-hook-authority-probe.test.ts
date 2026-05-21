import assert from "node:assert/strict";
import test from "node:test";
import {
	createFlowDeskChatHookAuthorityProbeV1,
	validateFlowDeskChatHookAuthorityProbeV1,
} from "./index.js";

test("chat hook probe records steering-only when hard control is unproven", () => {
	const result = createFlowDeskChatHookAuthorityProbeV1({
		probeId: "chat-probe-1",
		chatHookRef: "chat-message-hook-1",
		observedAt: "2026-05-21T00:00:00.000Z",
		mutationObserved: true,
		throwBlocksReply: false,
		noReplySupported: false,
		cancelOrStopSupported: false,
		timeoutOrNullFailClosed: true,
		malformedReturnFailClosed: true,
		evidenceRefs: ["chat-evidence-1"],
	});
	assert.equal(result.outcome, "steering_only");
	assert.equal(result.hardCancelOrNoReplyAuthority, false);
	assert.ok(result.failure_labels.includes("no_reply_unproven"));
	assert.equal(validateFlowDeskChatHookAuthorityProbeV1(result).ok, true);
});

test("chat hook hard-control proof still cannot set authority field", () => {
	const result = createFlowDeskChatHookAuthorityProbeV1({
		probeId: "chat-probe-2",
		chatHookRef: "chat-message-hook-2",
		observedAt: "2026-05-21T00:00:00.000Z",
		mutationObserved: true,
		throwBlocksReply: true,
		noReplySupported: true,
		cancelOrStopSupported: true,
		duplicateAssistantReplyObserved: false,
		timeoutOrNullFailClosed: true,
		malformedReturnFailClosed: true,
	});
	assert.equal(result.outcome, "hard_control_proven");
	assert.equal(result.hardCancelOrNoReplyAuthority, false);
	assert.equal(validateFlowDeskChatHookAuthorityProbeV1(result).ok, true);
});

test("chat hook probe rejects malformed hard-control and authority smuggling", () => {
	const forged = {
		...createFlowDeskChatHookAuthorityProbeV1({
			probeId: "chat-probe-3",
			chatHookRef: "chat-message-hook-3",
			observedAt: "2026-05-21T00:00:00.000Z",
			mutationObserved: true,
		}),
		outcome: "hard_control_proven",
		hardCancelOrNoReplyAuthority: true,
		noReply: true,
	};
	const result = validateFlowDeskChatHookAuthorityProbeV1(forged);
	assert.equal(result.ok, false);
	assert.match(result.errors.join("|"), /unknown properties|hard chat authority|requires all/);
});
