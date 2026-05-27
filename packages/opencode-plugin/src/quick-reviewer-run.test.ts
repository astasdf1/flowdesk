import assert from "node:assert/strict";
import test from "node:test";
import { reloadFlowDeskSessionEvidenceV1, validateTopTierReviewVerdictV1 } from "@flowdesk/core";
import { executeFlowDeskQuickReviewerRunV1, normalizeQuickReviewerSourceLabelV1 } from "./quick-reviewer-run.js";

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
	assert.doesNotMatch(prompts[0], /Replace this placeholder/);
	assert.match(prompts[0], /required_fix_label/);
	const template = JSON.parse(prompts[0].split("\n").at(-1) ?? "{}");
	assert.equal(template.findings[0].required_fix_label, "none");
	const templateValidation = validateTopTierReviewVerdictV1(template);
	assert.equal(templateValidation.ok, true, templateValidation.errors.join("; "));
});

test("quick reviewer run sanitizes explicit reviewer source labels", async () => {
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
		sourceLabel: "55 GPT-Frontier!!",
		allowProviderCall: true,
		developerModeAcknowledged: true,
		parentSessionId: "parent-session-1",
		perspectives: ["architecture"],
	});
	assert.equal(result.status, "quick_reviewer_run_incomplete");
	assert.equal(normalizeQuickReviewerSourceLabelV1("!!!"), "gpt_frontier");
	assert.equal(JSON.parse(prompts[0].split("\n").at(-1) ?? "{}").source, "reviewer_55_gpt_frontier");
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

test("quick reviewer run completes a requested single-perspective subset", async () => {
	const sessionMessages = new Map<string, unknown[]>();
	let createdSessionId = "";
	const result = await executeFlowDeskQuickReviewerRunV1({
		client: {
			session: {
				async create(options: { parentID?: string }) {
					createdSessionId = options.parentID === undefined ? "parent-session-1" : "child-session-verification";
					return { id: createdSessionId };
				},
				async prompt(options: { sessionID?: string; parts?: Array<{ text?: string }>; body?: { parts?: Array<{ text?: string }> } }) {
					const sessionId = String(options.sessionID ?? "child-session-verification");
					const promptText = String(options.parts?.[0]?.text ?? options.body?.parts?.[0]?.text ?? "");
					const template = JSON.parse(promptText.split("\n").at(-1) ?? "{}");
					sessionMessages.set(sessionId, [
						{
							info: { role: "assistant" },
							parts: [
								{
									type: "text",
									text: JSON.stringify({ ...template, verdict_label: "pass", uncertainty: "low" }),
								},
							],
						},
					]);
					return { id: "message-verification" };
				},
				async messages(options: { sessionID?: string; path?: { id?: string } }) {
					return sessionMessages.get(String(options.sessionID ?? options.path?.id ?? "")) ?? [];
				},
			},
		} as never,
		prompt: "Review only this verification implementation detail.",
		providerQualifiedModelId: "gemini/gemini-3.1-pro-preview",
		runtimeAgent: "reviewer-gemini-pro",
		allowProviderCall: true,
		developerModeAcknowledged: true,
		parentSessionId: "parent-session-1",
		perspectives: ["verification_implementation"],
		completionWait: { pollIntervalMs: 25, maxWaitMs: 500, quietPeriodMs: 0, stableSampleCount: 2 },
	});

	assert.equal(result.status, "quick_reviewer_run_completed");
	assert.equal(result.acceptanceStatus, "verdicts_accepted");
	assert.equal(result.durableLinkageStatus, "durable_verdicts_accepted");
	assert.deepEqual(result.acceptedPerspectives, ["verification_implementation"]);
	assert.equal(result.linkedVerdictCount, 1);
	assert.equal(result.linkedLifecycleCount, 1);
	assert.match(String(result.summaryForUser), /1\/1 perspectives accepted/);
	assert.equal(createdSessionId, "child-session-verification");
});

test("quick reviewer run waits for final assistant JSON instead of earlier prose", async () => {
	const sessionMessages = new Map<string, unknown[]>();
	const result = await executeFlowDeskQuickReviewerRunV1({
		client: {
			session: {
				async create(options: { parentID?: string }) {
					return { id: options.parentID === undefined ? "parent-session-1" : "child-session-architecture" };
				},
				async prompt(options: { sessionID?: string; parts?: Array<{ text?: string }>; body?: { parts?: Array<{ text?: string }> } }) {
					const sessionId = String(options.sessionID ?? "child-session-architecture");
					const promptText = String(options.parts?.[0]?.text ?? options.body?.parts?.[0]?.text ?? "");
					const template = JSON.parse(promptText.split("\n").at(-1) ?? "{}");
					sessionMessages.set(sessionId, [
						{ info: { role: "assistant" }, parts: [{ type: "text", text: "I will inspect this now." }] },
						{ info: { role: "assistant" }, parts: [{ type: "text", text: JSON.stringify({ ...template, verdict_label: "pass", uncertainty: "low", findings: [], required_fixes: [] }) }] },
					]);
					return { id: "message-architecture" };
				},
				async messages(options: { sessionID?: string; path?: { id?: string } }) {
					return sessionMessages.get(String(options.sessionID ?? options.path?.id ?? "")) ?? [];
				},
			},
		} as never,
		prompt: "Review architecture.",
		providerQualifiedModelId: "openai/gpt-5.5",
		runtimeAgent: "reviewer-gpt-frontier",
		allowProviderCall: true,
		developerModeAcknowledged: true,
		parentSessionId: "parent-session-1",
		perspectives: ["architecture"],
		completionWait: { pollIntervalMs: 25, maxWaitMs: 500, quietPeriodMs: 0, stableSampleCount: 2 },
	});
	assert.equal(result.status, "quick_reviewer_run_completed");
	assert.deepEqual(result.acceptedPerspectives, ["architecture"]);
});

test("quick reviewer run terminalizes completion timeout lanes", async () => {
	const result = await executeFlowDeskQuickReviewerRunV1({
		client: {
			session: {
				async create(options: { parentID?: string }) {
					return { id: options.parentID === undefined ? "parent-session-1" : "child-session-timeout" };
				},
				async prompt() {
					return { id: "message-timeout" };
				},
				async messages() {
					return [];
				},
			},
		} as never,
		prompt: "Review but never answer.",
		providerQualifiedModelId: "openai/gpt-5.5",
		runtimeAgent: "reviewer-gpt-frontier",
		allowProviderCall: true,
		developerModeAcknowledged: true,
		parentSessionId: "parent-session-1",
		perspectives: ["architecture"],
		completionWait: { pollIntervalMs: 25, maxWaitMs: 75, quietPeriodMs: 0, stableSampleCount: 2 },
	});
	assert.equal(result.status, "quick_reviewer_run_incomplete");
	assert.equal(result.lanes[0].observationStatus, "completion_timeout");
	assert.equal(result.lanes[0].completeLifecycle, "timeout");
	const reloaded = reloadFlowDeskSessionEvidenceV1({ workflowId: String(result.workflowId), rootDir: String(result.rootDir) });
	assert.equal(reloaded.ok, true);
	assert.ok(reloaded.entries.some((entry) => entry.evidenceClass === "lane_lifecycle" && entry.record.state === "timeout"));
});

test("quick reviewer run supports per-perspective multi-model bindings", async () => {
	const prompts: string[] = [];
	const promptOptions: Array<{ agent?: string; model?: Record<string, unknown> }> = [];
	const result = await executeFlowDeskQuickReviewerRunV1({
		client: {
			session: {
				async create() {
					return { id: "child-session-1" };
				},
				async prompt(options: { agent?: string; model?: Record<string, unknown>; parts?: Array<{ text?: string }>; body?: { parts?: Array<{ text?: string }> } }) {
					promptOptions.push({ agent: options.agent, model: options.model });
					prompts.push(String(options.parts?.[0]?.text ?? options.body?.parts?.[0]?.text ?? ""));
					return { id: "message-multi-model" };
				},
			},
		} as never,
		prompt: "Review this change with distinct reviewer bindings.",
		bindings: [
			{
				perspective: "policy_security",
				providerQualifiedModelId: "claude/claude-opus-4-5",
				runtimeAgent: "reviewer-claude-opus",
			},
			{
				perspective: "architecture",
				providerQualifiedModelId: "openai/gpt-5.5",
				runtimeAgent: "reviewer-gpt-frontier",
			},
			{
				perspective: "verification_implementation",
				providerQualifiedModelId: "gemini/gemini-3.1-pro",
				runtimeAgent: "reviewer-gemini-pro",
			},
		],
		allowProviderCall: true,
		developerModeAcknowledged: true,
		parentSessionId: "parent-session-1",
	});
	assert.equal(result.status, "quick_reviewer_run_incomplete");
	assert.equal(result.lanes.length, 3);
	assert.deepEqual(
		result.lanes.map((lane) => [lane.perspective, lane.runtimeAgent, lane.providerQualifiedModelId]),
		[
			["policy_security", "reviewer-claude-opus", "claude/claude-opus-4-5"],
			["architecture", "reviewer-gpt-frontier", "openai/gpt-5.5"],
			["verification_implementation", "reviewer-gemini-pro", "gemini/gemini-3.1-pro"],
		],
	);
	assert.match(String(result.summaryForUser), /3 reviewer bindings/);
	assert.equal(prompts.length, 3);
	assert.equal(JSON.parse(prompts[0].split("\n").at(-1) ?? "{}").source, "claude_opus");
	assert.equal(JSON.parse(prompts[1].split("\n").at(-1) ?? "{}").source, "gpt_frontier");
	assert.equal(JSON.parse(prompts[2].split("\n").at(-1) ?? "{}").source, "gemini_pro");
	assert.deepEqual(
		promptOptions.map((option) => option.agent),
		["reviewer-claude-opus", "reviewer-gpt-frontier", "reviewer-gemini-pro"],
	);
});
