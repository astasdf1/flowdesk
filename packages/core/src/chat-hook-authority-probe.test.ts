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

test("chat hook probe blocks hard-control gaps that are not fail-closed", () => {
	const timeoutGap = createFlowDeskChatHookAuthorityProbeV1({
		probeId: "chat-probe-timeout-gap",
		chatHookRef: "chat-message-hook-timeout-gap",
		observedAt: "2026-05-21T00:00:00.000Z",
		mutationObserved: true,
		throwBlocksReply: false,
		noReplySupported: false,
		cancelOrStopSupported: false,
		duplicateAssistantReplyObserved: false,
		// timeout/null and malformed-return behavior are unknown, so hard chat authority is blocked.
	});
	assert.equal(timeoutGap.outcome, "blocked");
	assert.equal(timeoutGap.hardCancelOrNoReplyAuthority, false);
	assert.ok(
		timeoutGap.failure_labels.includes("timeout_or_null_not_fail_closed"),
	);
	assert.ok(
		timeoutGap.failure_labels.includes("malformed_return_not_fail_closed"),
	);
	assert.equal(validateFlowDeskChatHookAuthorityProbeV1(timeoutGap).ok, true);

	const duplicateReply = createFlowDeskChatHookAuthorityProbeV1({
		probeId: "chat-probe-duplicate-reply",
		chatHookRef: "chat-message-hook-duplicate-reply",
		observedAt: "2026-05-21T00:00:00.000Z",
		mutationObserved: true,
		throwBlocksReply: true,
		noReplySupported: true,
		cancelOrStopSupported: true,
		duplicateAssistantReplyObserved: true,
		timeoutOrNullFailClosed: true,
		malformedReturnFailClosed: true,
	});
	assert.equal(duplicateReply.outcome, "blocked");
	assert.equal(duplicateReply.hardCancelOrNoReplyAuthority, false);
	assert.ok(
		duplicateReply.failure_labels.includes("duplicate_assistant_reply_observed"),
	);
	assert.equal(validateFlowDeskChatHookAuthorityProbeV1(duplicateReply).ok, true);
});

test("chat hook probe validator rejects inconsistent steering-only and blocked states", () => {
	const blockedWithoutLabels = {
		...createFlowDeskChatHookAuthorityProbeV1({
			probeId: "chat-probe-empty-blocked",
			chatHookRef: "chat-message-hook-empty-blocked",
			observedAt: "2026-05-21T00:00:00.000Z",
			mutationObserved: true,
		}),
		failure_labels: [],
	};
	assert.equal(validateFlowDeskChatHookAuthorityProbeV1(blockedWithoutLabels).ok, false);

	const forgedSteering = {
		...createFlowDeskChatHookAuthorityProbeV1({
			probeId: "chat-probe-forged-steering",
			chatHookRef: "chat-message-hook-forged-steering",
			observedAt: "2026-05-21T00:00:00.000Z",
			mutationObserved: true,
		}),
		outcome: "steering_only",
	};
	const result = validateFlowDeskChatHookAuthorityProbeV1(forgedSteering);
	assert.equal(result.ok, false);
	assert.match(result.errors.join("|"), /steering_only requires/);
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
