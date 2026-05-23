import assert from "node:assert/strict";
import test from "node:test";
import { executeFlowDeskQuickReviewerRunV1 } from "./quick-reviewer-run.js";

function neverCalledClient() {
	return {
		client: {
			session: {
				create() {
					throw new Error("create should not be called when blocked");
				},
				prompt() {
					throw new Error("prompt should not be called when blocked");
				},
				messages() {
					throw new Error("messages should not be called when blocked");
				},
			},
		},
	};
}

test("quick reviewer run blocks without developerModeAcknowledged", async () => {
	const { client } = neverCalledClient();
	const result = await executeFlowDeskQuickReviewerRunV1({
		client: client as never,
		prompt: "Test prompt",
		providerQualifiedModelId: "openai/gpt-5.4-mini-fast",
		runtimeAgent: "reviewer-gpt-frontier",
		allowProviderCall: true,
		developerModeAcknowledged: false,
	});
	assert.equal(result.status, "blocked_before_quick_reviewer_run");
	assert.match(String(result.redactedBlockReason), /developerModeAcknowledged/);
});

test("quick reviewer run blocks without allowProviderCall", async () => {
	const { client } = neverCalledClient();
	const result = await executeFlowDeskQuickReviewerRunV1({
		client: client as never,
		prompt: "Test prompt",
		providerQualifiedModelId: "openai/gpt-5.4-mini-fast",
		runtimeAgent: "reviewer-gpt-frontier",
		allowProviderCall: false,
		developerModeAcknowledged: true,
	});
	assert.equal(result.status, "blocked_before_quick_reviewer_run");
	assert.match(String(result.redactedBlockReason), /allowProviderCall/);
});

test("quick reviewer run blocks for empty prompt", async () => {
	const { client } = neverCalledClient();
	const result = await executeFlowDeskQuickReviewerRunV1({
		client: client as never,
		prompt: "   ",
		providerQualifiedModelId: "openai/gpt-5.4-mini-fast",
		runtimeAgent: "reviewer-gpt-frontier",
		allowProviderCall: true,
		developerModeAcknowledged: true,
	});
	assert.equal(result.status, "blocked_before_quick_reviewer_run");
	assert.match(String(result.redactedBlockReason), /prompt is required/);
});

test("quick reviewer run blocks for alias provider-qualified model id", async () => {
	const { client } = neverCalledClient();
	const result = await executeFlowDeskQuickReviewerRunV1({
		client: client as never,
		prompt: "Test prompt",
		providerQualifiedModelId: "gpt-latest",
		runtimeAgent: "reviewer-gpt-frontier",
		allowProviderCall: true,
		developerModeAcknowledged: true,
	});
	assert.equal(result.status, "blocked_before_quick_reviewer_run");
	assert.match(String(result.redactedBlockReason), /provider\/model/);
});

test("quick reviewer run blocks for empty runtime agent", async () => {
	const { client } = neverCalledClient();
	const result = await executeFlowDeskQuickReviewerRunV1({
		client: client as never,
		prompt: "Test prompt",
		providerQualifiedModelId: "openai/gpt-5.4-mini-fast",
		runtimeAgent: "   ",
		allowProviderCall: true,
		developerModeAcknowledged: true,
	});
	assert.equal(result.status, "blocked_before_quick_reviewer_run");
	assert.match(String(result.redactedBlockReason), /runtimeAgent is required/);
});

test("quick reviewer run blocks when injected client lacks session.create and no parent session id is provided", async () => {
	const result = await executeFlowDeskQuickReviewerRunV1({
		client: { session: {} } as never,
		prompt: "Test prompt",
		providerQualifiedModelId: "openai/gpt-5.4-mini-fast",
		runtimeAgent: "reviewer-gpt-frontier",
		allowProviderCall: true,
		developerModeAcknowledged: true,
	});
	assert.equal(result.status, "blocked_before_quick_reviewer_run");
	assert.match(String(result.redactedBlockReason), /session.create/);
});
