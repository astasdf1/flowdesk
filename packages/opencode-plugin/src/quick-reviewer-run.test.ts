import assert from "node:assert/strict";
import test from "node:test";
import { validateTopTierReviewVerdictV1 } from "@flowdesk/core";
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

test("quick reviewer run prompt starts from a neutral verdict template", async () => {
	const prompts: string[] = [];
	const result = await executeFlowDeskQuickReviewerRunV1({
		client: {
			session: {
				async create() {
					return { id: "child-session-1" };
				},
				async prompt(options: { parts?: Array<{ text?: string }>; body?: { parts?: Array<{ text?: string }> } }) {
					prompts.push(String(options.parts?.[0]?.text ?? options.body?.parts?.[0]?.text ?? ""));
					return { id: "child-session-1" };
				},
			},
		} as never,
		prompt: "Review this change neutrally.",
		providerQualifiedModelId: "openai/gpt-5.4-mini-fast",
		runtimeAgent: "reviewer-gpt-frontier",
		allowProviderCall: true,
		developerModeAcknowledged: true,
		parentSessionId: "parent-session-1",
		perspectives: ["architecture"],
	});
	assert.equal(result.status, "quick_reviewer_run_incomplete");
	assert.equal(prompts.length, 1);
	assert.match(prompts[0], /verdict_label":"inconclusive"/);
	assert.match(prompts[0], /Choose verdict_label neutrally/);
	assert.doesNotMatch(prompts[0], /If you find a real issue change only verdict_label/);
	const template = JSON.parse(prompts[0].split("\n").at(-1) ?? "{}");
	const templateValidation = validateTopTierReviewVerdictV1(template);
	assert.equal(templateValidation.ok, true, templateValidation.errors.join("; "));
});

test("quick reviewer run derives reviewer source labels from concrete bindings", async () => {
	const prompts: string[] = [];
	const result = await executeFlowDeskQuickReviewerRunV1({
		client: {
			session: {
				async create() {
					return { id: "child-session-1" };
				},
				async prompt(options: { parts?: Array<{ text?: string }>; body?: { parts?: Array<{ text?: string }> } }) {
					prompts.push(String(options.parts?.[0]?.text ?? options.body?.parts?.[0]?.text ?? ""));
					return { id: "child-session-1" };
				},
			},
		} as never,
		prompt: "Review this change neutrally.",
		providerQualifiedModelId: "claude/claude-opus-4-5",
		runtimeAgent: "reviewer-claude-opus",
		allowProviderCall: true,
		developerModeAcknowledged: true,
		parentSessionId: "parent-session-1",
		perspectives: ["policy_security"],
	});
	assert.equal(result.status, "quick_reviewer_run_incomplete");
	assert.equal(prompts.length, 1);
	const template = JSON.parse(prompts[0].split("\n").at(-1) ?? "{}");
	assert.equal(template.source, "claude_opus");
	const templateValidation = validateTopTierReviewVerdictV1(template);
	assert.equal(templateValidation.ok, true, templateValidation.errors.join("; "));
});
