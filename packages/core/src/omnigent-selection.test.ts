import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { FLOWDESK_OMNIGENT_DEFAULT_REGISTRY_V1, HARNESSES_BY_FAMILY, selectFlowDeskOmnigentAgentModelV1, validateFlowDeskOmnigentSelectionV1 } from "./index.js";

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

const CLAUDE_MODEL_SET = new Set(["claude-opus-4-8", "claude-sonnet-5", "claude-sonnet-4-6", "claude-haiku-4-5"]);
const OPENAI_GPT56_MODEL_SET = new Set(["openai/gpt-5.6", "openai/gpt-5.6-terra", "openai/gpt-5.6-luna"]);

test("omnigent TypeScript registry matches shared registry artifact", () => {
	assert.equal(registryArtifact.schema_version, "flowdesk.omnigent_selector_registry.v1");
	assert.equal(registryArtifact.authority, "advisory_registry_only");
	assert.deepEqual(registryArtifact.roles, FLOWDESK_OMNIGENT_DEFAULT_REGISTRY_V1);
});

test("omnigent registry exposes all Claude variants per agent role", () => {
	for (const [role, entries] of Object.entries(FLOWDESK_OMNIGENT_DEFAULT_REGISTRY_V1)) {
		if (role === "gemini_experimental") continue;
		const claudeModels = new Set(entries.filter((entry) => entry.provider_family === "claude").map((entry) => entry.model).filter((model): model is string => typeof model === "string"));
		assert.deepEqual(claudeModels, new Set([...CLAUDE_MODEL_SET, "claude-fable-5"]), role);
		assert.ok(entries.some((entry) => entry.provider_family === "openai" && entry.model === null), `${role} must retain an OpenAI fallback`);
	}
});

test("omnigent registry exposes GPT-5.6 variants in every non-gemini role", () => {
	for (const [role, entries] of Object.entries(FLOWDESK_OMNIGENT_DEFAULT_REGISTRY_V1)) {
		if (role === "gemini_experimental") continue;
		const openaiModels = new Set(entries.filter((entry) => entry.provider_family === "openai").map((entry) => entry.model).filter((model): model is string => typeof model === "string"));
		for (const modelId of OPENAI_GPT56_MODEL_SET) {
			assert.ok(openaiModels.has(modelId), `${role} is missing ${modelId}`);
		}
	}
});

test("omnigent registry harness is coupled to model family for every entry", () => {
	for (const [role, entries] of Object.entries(FLOWDESK_OMNIGENT_DEFAULT_REGISTRY_V1)) {
		for (const entry of entries) {
			const allowedHarnesses = HARNESSES_BY_FAMILY[entry.provider_family];
			assert.ok(allowedHarnesses, `${role}: unknown provider_family ${entry.provider_family}`);
			assert.ok(allowedHarnesses.includes(entry.harness), `${role}: harness ${entry.harness} is not valid for family ${entry.provider_family}`);
		}
	}
});

test("omnigent registry exposes a dedicated Gemini agent", () => {
	const entries = FLOWDESK_OMNIGENT_DEFAULT_REGISTRY_V1.gemini_experimental;
	assert.equal(entries.length, 4);
	assert.equal(entries[0].agent, "gemini-agent");
	assert.equal(entries[0].harness, "antigravity-native");
	assert.equal(entries[0].provider_family, "gemini");
	assert.equal(entries[0].model, "google/gemini-3.1-flash-lite");
	assert.deepEqual(new Set(entries.map((entry) => entry.model_tier)), new Set(["flash-lite", "flash", "pro"]));
	assert.ok(entries.some((entry) => entry.model === "gemini-3.5-flash"));
});

test("python golden selection examples validate against the core schema", () => {
	// Golden bridge for Phase 3 evidence alignment: the fixture holds REAL
	// Python selector outputs (dynamic fields pinned); every one of them must
	// satisfy the core validator, so the Python response shape and the core
	// schema cannot drift apart silently.
	const golden = JSON.parse(readFileSync("packages/omnigent-tool/tests/fixtures/omnigent_selection_golden_examples.json", "utf8")) as Record<string, unknown>;
	const names = Object.keys(golden);
	assert.ok(names.length >= 4, names.join(","));
	for (const name of names) {
		const validation = validateFlowDeskOmnigentSelectionV1(golden[name]);
		assert.ok(validation.ok, `${name}: ${validation.errors.join("; ")}`);
	}
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
	assert.equal(result.harness, "claude-native");
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

test("omnigent selection can choose Codex fast model tier", () => {
	const result = selectFlowDeskOmnigentAgentModelV1(
		{ task_id: "task-codex-fast", task_role: "implementation", allowed_provider_families: ["openai"], model_tier: "fast" },
		new Date("2026-06-26T00:00:00.000Z"),
	);
	assert.equal(result.selection_status, "selected");
	assert.equal(result.provider_family, "openai");
	assert.equal(result.harness, "codex");
	assert.equal(result.model, "openai/gpt-5.4-mini-fast");
	assert.match(result.reason_codes.join("|"), /model_tier_preference_applied/);
	assert.match(result.reason_codes.join("|"), /model_family_compatible/);
});

test("omnigent selection can choose Claude Sonnet 5 model tier", () => {
	const result = selectFlowDeskOmnigentAgentModelV1(
		{ task_id: "task-claude-sonnet-5", task_role: "architecture", allowed_provider_families: ["claude"], model_tier: "sonnet" },
		new Date("2026-06-26T00:00:00.000Z"),
	);
	assert.equal(result.selection_status, "selected");
	assert.equal(result.provider_family, "claude");
	assert.equal(result.harness, "claude-native");
	assert.equal(result.model, "claude-sonnet-5");
	assert.match(result.reason_codes.join("|"), /model_tier_preference_applied/);
});

test("omnigent selection can choose Codex spark model tier", () => {
	const result = selectFlowDeskOmnigentAgentModelV1(
		{ task_id: "task-codex-spark", task_role: "general", allowed_provider_families: ["openai"], model_tier: "spark" },
		new Date("2026-06-26T00:00:00.000Z"),
	);
	assert.equal(result.selection_status, "selected");
	assert.equal(result.agent, "general-agent");
	assert.equal(result.harness, "codex");
	assert.equal(result.model, "openai/gpt-5.3-codex-spark");
});

test("omnigent selection can choose GPT-5.6 Luna preferred model", () => {
	const result = selectFlowDeskOmnigentAgentModelV1(
		{ task_id: "task-gpt56-luna", task_role: "implementation", allowed_provider_families: ["openai"], preferred_model: "openai/gpt-5.6-luna" },
		new Date("2026-06-26T00:00:00.000Z"),
	);
	assert.equal(result.selection_status, "selected");
	assert.equal(result.provider_family, "openai");
	assert.equal(result.harness, "codex");
	assert.equal(result.model, "openai/gpt-5.6-luna");
});

test("omnigent selection can choose GPT-5.6 Terra preferred model", () => {
	const result = selectFlowDeskOmnigentAgentModelV1(
		{ task_id: "task-gpt56-terra", task_role: "architecture", allowed_provider_families: ["openai"], preferred_model: "openai/gpt-5.6-terra" },
		new Date("2026-06-26T00:00:00.000Z"),
	);
	assert.equal(result.selection_status, "selected");
	assert.equal(result.provider_family, "openai");
	assert.equal(result.harness, "codex");
	assert.equal(result.model, "openai/gpt-5.6-terra");
});

test("omnigent selection can choose Claude Fable 5 preferred model", () => {
	const result = selectFlowDeskOmnigentAgentModelV1(
		{ task_id: "task-claude-fable-5", task_role: "policy_security", allowed_provider_families: ["claude"], preferred_model: "claude-fable-5" },
		new Date("2026-06-26T00:00:00.000Z"),
	);
	assert.equal(result.selection_status, "selected");
	assert.equal(result.provider_family, "claude");
	assert.equal(result.harness, "claude-native");
	assert.equal(result.model, "claude-fable-5");
});

test("omnigent selection can choose exact preferred model", () => {
	const result = selectFlowDeskOmnigentAgentModelV1(
		{ task_id: "task-codex-preferred", task_role: "architecture", allowed_provider_families: ["openai"], preferred_model: "openai/gpt-5.4" },
		new Date("2026-06-26T00:00:00.000Z"),
	);
	assert.equal(result.selection_status, "selected");
	assert.equal(result.model, "openai/gpt-5.4");
	assert.match(result.reason_codes.join("|"), /preferred_model_applied/);
});

test("omnigent selection can choose Gemini pro model tier", () => {
	const result = selectFlowDeskOmnigentAgentModelV1(
		{ task_id: "task-gemini-pro", task_role: "gemini_experimental", allowed_provider_families: ["gemini"], model_tier: "pro" },
		new Date("2026-06-26T00:00:00.000Z"),
	);
	assert.equal(result.selection_status, "selected");
	assert.equal(result.agent, "gemini-agent");
	assert.equal(result.harness, "antigravity-native");
	assert.equal(result.model, "google/gemini-3.1-pro-preview");
	assert.match(result.reason_codes.join("|"), /model_tier_preference_applied/);
});

test("omnigent selection can choose Gemini 3.5 Flash model tier", () => {
	const result = selectFlowDeskOmnigentAgentModelV1(
		{ task_id: "task-gemini-35-flash", task_role: "gemini_experimental", allowed_provider_families: ["gemini"], model_tier: "flash" },
		new Date("2026-06-26T00:00:00.000Z"),
	);
	assert.equal(result.selection_status, "selected");
	assert.equal(result.agent, "gemini-agent");
	assert.equal(result.harness, "antigravity-native");
	assert.equal(result.model, "gemini-3.5-flash");
	assert.match(result.reason_codes.join("|"), /model_tier_preference_applied/);
});

test("omnigent selection defaults to allowing Gemini for Gemini-only roles", () => {
	const result = selectFlowDeskOmnigentAgentModelV1({ task_id: "task-gemini-default", task_role: "gemini_experimental" }, new Date("2026-06-26T00:00:00.000Z"));
	assert.equal(result.selection_status, "selected");
	assert.equal(result.agent, "gemini-agent");
	assert.equal(result.harness, "antigravity-native");
	assert.equal(result.provider_family, "gemini");
});

test("omnigent selection promotes high-complexity implementation to reasoning model", () => {
	const result = selectFlowDeskOmnigentAgentModelV1(
		{ task_id: "task-implementation-high", task_role: "implementation", task_complexity: "high", allowed_provider_families: ["claude", "openai"] },
		new Date("2026-06-26T00:00:00.000Z"),
	);
	assert.equal(result.selection_status, "selected");
	assert.equal(result.provider_family, "claude");
	assert.equal(result.harness, "claude-native");
	assert.equal(result.model, "claude-sonnet-5");
	assert.match(result.reason_codes.join("|"), /task_tier_prefers_reasoning_model/);
});

test("omnigent selection promotes high-level architecture phase to reasoning model", () => {
	const result = selectFlowDeskOmnigentAgentModelV1(
		{ task_id: "task-architecture-tier", task_role: "architecture", task_phase: "high_level_design", allowed_provider_families: ["claude", "openai"] },
		new Date("2026-06-26T00:00:00.000Z"),
	);
	assert.equal(result.selection_status, "selected");
	assert.equal(result.provider_family, "claude");
	assert.equal(result.harness, "claude-native");
	assert.equal(result.model, "claude-sonnet-5");
});

test("omnigent selection promotes critical verification to Claude Haiku", () => {
	const result = selectFlowDeskOmnigentAgentModelV1(
		{ task_id: "task-verification-tier", task_role: "verification", task_complexity: "critical", allowed_provider_families: ["claude", "openai"] },
		new Date("2026-06-26T00:00:00.000Z"),
	);
	assert.equal(result.selection_status, "selected");
	assert.equal(result.provider_family, "claude");
	assert.equal(result.harness, "claude-native");
	assert.equal(result.model, "claude-haiku-4-5");
	assert.match(result.reason_codes.join("|"), /task_tier_prefers_reasoning_model/);
});

test("omnigent selection can route verification to Gemini Flash Lite", () => {
	const result = selectFlowDeskOmnigentAgentModelV1(
		{ task_id: "task-verification-gemini", task_role: "verification", allowed_provider_families: ["gemini"] },
		new Date("2026-06-26T00:00:00.000Z"),
	);
	assert.equal(result.selection_status, "selected");
	assert.equal(result.agent, "verification-agent");
	assert.equal(result.harness, "antigravity-native");
	assert.equal(result.model, "google/gemini-3.1-flash-lite");
	assert.equal(result.provider_family, "gemini");
	assert.match(result.reason_codes.join("|"), /model_family_compatible/);
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

test("omnigent selection blocks unknown role and routes Gemini to a dedicated agent", () => {
	assert.equal(selectFlowDeskOmnigentAgentModelV1({ task_id: "task-x", task_role: "missing" }).selection_status, "blocked");
	const result = selectFlowDeskOmnigentAgentModelV1({ task_id: "task-g", task_role: "gemini_experimental", allowed_provider_families: ["gemini"] });
	assert.equal(result.selection_status, "selected");
	assert.equal(result.agent, "gemini-agent");
	assert.equal(result.harness, "antigravity-native");
	assert.equal(result.model, "google/gemini-3.1-flash-lite");
	assert.equal(result.provider_family, "gemini");
	assert.match(result.reason_codes.join("|"), /role_gemini_experimental_prefers_gemini_native/);
});

test("omnigent selection validator rejects raw task description", () => {
	const result = selectFlowDeskOmnigentAgentModelV1({ task_id: "task-y", task_role: "verification" }) as unknown as Record<string, unknown>;
	result.task_description = "raw prompt must not be mirrored";
	assert.equal(validateFlowDeskOmnigentSelectionV1(result).ok, false);
});
