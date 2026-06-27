import assert from "node:assert/strict";
import test from "node:test";
import { selectFlowDeskOmnigentAgentModelV1, validateFlowDeskOmnigentSelectionV1 } from "./index.js";

test("omnigent selection picks Claude Opus for policy/security", () => {
	const result = selectFlowDeskOmnigentAgentModelV1({ task_id: "task-policy", task_role: "policy_security", allowed_provider_families: ["claude", "openai"] }, new Date("2026-06-26T00:00:00.000Z"));
	assert.equal(result.selection_status, "selected");
	assert.equal(result.agent, "policy-security-agent");
	assert.equal(result.harness, "claude-sdk");
	assert.equal(result.model, "claude-opus-4-8");
	assert.equal(result.authority, "advisory_selection_only");
	assert.equal(validateFlowDeskOmnigentSelectionV1(result).ok, true);
});

test("omnigent selection preserves Codex subscription default as null model", () => {
	const result = selectFlowDeskOmnigentAgentModelV1({ task_id: "task-architecture", task_role: "architecture", allowed_provider_families: ["openai"] }, new Date("2026-06-26T00:00:00.000Z"));
	assert.equal(result.selection_status, "selected");
	assert.equal(result.harness, "codex");
	assert.equal(result.model, null);
	assert.match(result.reason_codes.join("|"), /subscription_harness_default_model/);
});

test("omnigent selection skips exhausted primary provider using usage snapshot", () => {
	const result = selectFlowDeskOmnigentAgentModelV1(
		{
			task_id: "task-policy-usage",
			task_role: "policy_security",
			allowed_provider_families: ["claude", "openai"],
			provider_usage: {
				providers: [
					{ provider_family: "claude", alert_level: "exhausted", remaining_percent: 0 },
					{ provider_family: "openai", alert_level: "ok", remaining_percent: 70 },
				],
			},
		},
		new Date("2026-06-26T00:00:00.000Z"),
	);
	assert.equal(result.selection_status, "selected");
	assert.equal(result.provider_family, "openai");
	assert.equal(result.harness, "codex");
});

test("omnigent selection blocks when every allowed provider is unavailable", () => {
	const result = selectFlowDeskOmnigentAgentModelV1(
		{
			task_id: "task-usage-blocked",
			task_role: "architecture",
			allowed_provider_families: ["openai"],
			provider_usage: { openai: { alertLevel: "critical", remainingPercent: 1 } },
		},
		new Date("2026-06-26T00:00:00.000Z"),
	);
	assert.equal(result.selection_status, "blocked");
	assert.deepEqual(result.blocked_labels, ["provider_usage_unavailable"]);
});

test("omnigent selection blocks unknown role and non-dispatches Gemini", () => {
	assert.equal(selectFlowDeskOmnigentAgentModelV1({ task_id: "task-x", task_role: "missing" }).selection_status, "blocked");
	assert.equal(selectFlowDeskOmnigentAgentModelV1({ task_id: "task-g", task_role: "gemini_experimental" }).selection_status, "non_dispatchable");
});

test("omnigent selection validator rejects raw task description", () => {
	const result = selectFlowDeskOmnigentAgentModelV1({ task_id: "task-y", task_role: "verification" }) as unknown as Record<string, unknown>;
	result.task_description = "raw prompt must not be mirrored";
	assert.equal(validateFlowDeskOmnigentSelectionV1(result).ok, false);
});
