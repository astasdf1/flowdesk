import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { FLOWDESK_OMNIGENT_DEFAULT_REGISTRY_V1, selectFlowDeskOmnigentAgentModelV1, validateFlowDeskOmnigentSelectionV1 } from "./index.js";

interface ParityCase {
	name: string;
	request: Record<string, unknown>;
	expected: {
		task_role: string;
		selection_status: string;
		confidence: string;
		agent?: string;
		harness?: string;
		model?: string | null;
		provider_family?: string;
		blocked_labels?: string[];
		reason_codes_include: string[];
	};
}

const parityCases = JSON.parse(readFileSync("packages/omnigent-tool/tests/fixtures/omnigent_selection_parity_cases.json", "utf8")) as ParityCase[];
const registryArtifact = JSON.parse(readFileSync("packages/omnigent-tool/src/flowdesk_omnigent/omnigent_selector_registry.v1.json", "utf8")) as {
	schema_version: string;
	authority: string;
	roles: typeof FLOWDESK_OMNIGENT_DEFAULT_REGISTRY_V1;
};

test("omnigent TypeScript registry matches shared registry artifact", () => {
	assert.equal(registryArtifact.schema_version, "flowdesk.omnigent_selector_registry.v1");
	assert.equal(registryArtifact.authority, "advisory_registry_only");
	assert.deepEqual(registryArtifact.roles, FLOWDESK_OMNIGENT_DEFAULT_REGISTRY_V1);
});

test("omnigent selection matches Python/TypeScript parity golden cases", () => {
	for (const parityCase of parityCases) {
		const result = selectFlowDeskOmnigentAgentModelV1(parityCase.request, new Date("2026-06-26T00:00:00.000Z"));
		assert.equal(result.schema_version, "flowdesk.omnigent_selection.v1", parityCase.name);
		assert.equal(result.authority, "advisory_selection_only", parityCase.name);
		assert.equal(result.task_id, parityCase.request.task_id, parityCase.name);
		assert.equal(result.task_role, parityCase.expected.task_role, parityCase.name);
		assert.equal(result.selection_status, parityCase.expected.selection_status, parityCase.name);
		assert.equal(result.confidence, parityCase.expected.confidence, parityCase.name);
		for (const key of ["agent", "harness", "model", "provider_family"] as const) {
			if (key in parityCase.expected) assert.deepEqual(result[key], parityCase.expected[key], parityCase.name);
		}
		if (parityCase.expected.blocked_labels) assert.deepEqual(result.blocked_labels, parityCase.expected.blocked_labels, parityCase.name);
		for (const reasonCode of parityCase.expected.reason_codes_include) assert.ok(result.reason_codes.includes(reasonCode), `${parityCase.name}: ${reasonCode}`);
	}
});

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

test("omnigent selection promotes high-complexity implementation to reasoning model", () => {
	const result = selectFlowDeskOmnigentAgentModelV1(
		{ task_id: "task-implementation-high", task_role: "implementation", task_complexity: "high", allowed_provider_families: ["claude", "openai"] },
		new Date("2026-06-26T00:00:00.000Z"),
	);
	assert.equal(result.selection_status, "selected");
	assert.equal(result.provider_family, "claude");
	assert.equal(result.harness, "claude-sdk");
	assert.equal(result.model, "claude-sonnet-4-6");
	assert.match(result.reason_codes.join("|"), /task_tier_prefers_reasoning_model/);
});

test("omnigent selection promotes high-level architecture phase to reasoning model", () => {
	const result = selectFlowDeskOmnigentAgentModelV1(
		{ task_id: "task-architecture-tier", task_role: "architecture", task_phase: "high_level_design", allowed_provider_families: ["claude", "openai"] },
		new Date("2026-06-26T00:00:00.000Z"),
	);
	assert.equal(result.selection_status, "selected");
	assert.equal(result.provider_family, "claude");
	assert.equal(result.harness, "claude-sdk");
	assert.equal(result.model, "claude-sonnet-4-6");
});

test("omnigent selection still falls back when preferred reasoning provider is unavailable", () => {
	const result = selectFlowDeskOmnigentAgentModelV1(
		{
			task_id: "task-tier-usage-fallback",
			task_role: "implementation",
			task_complexity: "critical",
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
