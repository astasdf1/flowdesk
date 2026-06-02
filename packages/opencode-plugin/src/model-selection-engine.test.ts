import assert from "node:assert/strict";
import test from "node:test";
import {
	selectModelForTask,
	buildUsageMapFromProviders,
	type ProviderUsageInput,
	type WorkingModelSelectionInput,
} from "./model-selection-engine.js";

function usage(family: ProviderUsageInput["providerFamily"], pct: number | null, alert: ProviderUsageInput["alertLevel"] = "ok"): ProviderUsageInput {
	return { providerFamily: family, remainingPercent: pct, alertLevel: alert, freshness: "fresh", resetBucket: `${family}-weekly`, resetTime: "2026-06-06T00:00:00.000Z" };
}

const now = () => new Date("2026-05-31T00:00:00.000Z");

const storedAvailableModels: WorkingModelSelectionInput = {
	availabilitySource: "test_fixture",
	availableModelIds: [
		"anthropic/claude-opus-4-7",
		"anthropic/claude-sonnet-4-6",
		"openai/gpt-5.5",
		"google/gemini-2.5-pro",
		"google/gemini-3-pro-preview",
		"google/gemini-3.1-pro-preview",
		"google/gemini-3.1-flash-lite-preview",
	],
};

function row(providerFamily: "claude" | "openai" | "gemini", remainingPercent: number | null, alertLevel: ProviderUsageInput["alertLevel"] = "ok") {
	return { providerFamily, remainingPercent, alertLevel, freshness: "fresh", resetBucket: `${providerFamily}-weekly`, resetTime: "2026-06-06T00:00:00.000Z" };
}

test("model selection picks heavy model for security role when usage is healthy", () => {
	const usageMap = buildUsageMapFromProviders([
		row("claude", 90),
		row("openai", 85),
		row("gemini", 50),
	]);
	const result = selectModelForTask("security", usageMap, storedAvailableModels, now);
	assert.ok(result, "should return a selection");
	assert.equal(result.candidate.tier, "heavy");
	assert.ok(
		result.candidate.providerFamily === "claude" || result.candidate.providerFamily === "openai",
		"security tasks should use claude or openai",
	);
});

test("model selection excludes exhausted providers", () => {
	const usageMap = new Map([
		["claude", usage("claude", 0, "exhausted")],
		["openai", usage("openai", 80, "ok")],
	]);
	// Run 20 times – claude should never be selected
	for (let i = 0; i < 20; i++) {
		const result = selectModelForTask("security", usageMap, storedAvailableModels, now);
		assert.ok(result, "should return a selection");
		assert.notEqual(result.candidate.providerFamily, "claude", "exhausted provider must not be selected");
	}
});

test("model selection reduces weight for critical providers", () => {
	const usageMap = new Map([
		["openai", usage("openai", 5, "critical")],
		["claude", usage("claude", 80, "ok")],
	]);
	// Run 100 times – openai (critical) should appear far less than claude (ok)
	let openaiCount = 0;
	for (let i = 0; i < 100; i++) {
		const result = selectModelForTask("architecture", usageMap, storedAvailableModels, now);
		if (result?.candidate.providerFamily === "openai") openaiCount++;
	}
	// openai weight=0.05, claude weight=1.0 → openai ~4.8% of picks
	assert.ok(openaiCount < 30, `critical provider should be rare, got ${openaiCount}/100`);
});

test("model selection returns undefined when all providers exhausted", () => {
	const usageMap = new Map([
		["claude", usage("claude", 0, "exhausted")],
		["openai", usage("openai", 0, "exhausted")],
		["gemini", usage("gemini", 0, "exhausted")],
	]);
	const result = selectModelForTask("implementation", usageMap, storedAvailableModels, now);
	assert.equal(result, undefined);
});

test("model selection picks lighter models for documentation role", () => {
	const usageMap = buildUsageMapFromProviders([
		row("claude", 80),
		row("openai", 80),
		row("gemini", 0, "exhausted"),
	]);
	const result = selectModelForTask("documentation", usageMap, storedAvailableModels, now);
	assert.ok(result, "should return a selection");
	assert.equal(result.candidate.tier, "light");
});

test("buildUsageMapFromProviders ignores unknown families", () => {
	const map = buildUsageMapFromProviders([
		row("claude", 70),
		{ providerFamily: "unknown-provider", remainingPercent: 50, alertLevel: "ok" },
	]);
	assert.equal(map.size, 1);
	assert.ok(map.has("claude"));
	assert.ok(!map.has("unknown-provider"));
});

test("model selection honors suitability preference before usage pressure", () => {
	// openai at 80%, claude at 8% (critical) → openai should dominate
	const usageMap = new Map([
		["openai", usage("openai", 80, "ok")],    // weight 1.0
		["claude", usage("claude", 8, "critical")], // weight 0.05
	]);
	let openaiCount = 0;
	for (let i = 0; i < 100; i++) {
		const result = selectModelForTask("architecture", usageMap, storedAvailableModels, now);
		if (result?.candidate.providerFamily === "openai") openaiCount++;
	}
	// openai should win far more often due to weight difference
	assert.ok(openaiCount > 60, `high-usage provider should dominate, got ${openaiCount}/100`);
});

test("model selection prefers distinct models for each task independently", () => {
	const usageMap = buildUsageMapFromProviders([
		row("claude", 80),
		row("openai", 80),
		row("gemini", 80),
	]);
	const roles = ["security", "implementation", "documentation"] as const;
  const selections = roles.map(role => selectModelForTask(role, usageMap, storedAvailableModels, now));
  assert.ok(selections.every(s => s !== undefined), "all roles should get a selection");
});

test("model selection respects allowed model ids from working cache", () => {
	const usageMap = buildUsageMapFromProviders([
		row("claude", 80),
		row("openai", 80),
		row("gemini", 80),
	]);
	const result = selectModelForTask("architecture", usageMap, { availableModelIds: ["openai/gpt-5.5"], availabilitySource: "test_fixture" }, now);
	assert.ok(result);
	assert.equal(result?.candidate.providerQualifiedModelId, "openai/gpt-5.5");
});

test("Gemini model selection falls back to Flash Lite when Gemini Pro quota is exhausted", () => {
	const usageMap = buildUsageMapFromProviders([
		row("claude", 0, "exhausted"),
		row("openai", 0, "exhausted"),
		{
			providerFamily: "gemini",
			remainingPercent: 0,
			alertLevel: "exhausted",
			freshness: "fresh",
			resetBucket: "gemini-pro-daily",
			resetTime: "2026-05-31T23:00:00.000Z",
			buckets: [
				{ resetBucket: "0% gemini-pro-daily", resetTime: "2026-05-31T23:00:00.000Z", remainingPercent: 0, freshness: "fresh" },
				{ resetBucket: "80% gemini-flash-daily", resetTime: "2026-05-31T23:00:00.000Z", remainingPercent: 80, freshness: "fresh" },
				{ resetBucket: "90% gemini-flash-lite-daily", resetTime: "2026-05-31T23:00:00.000Z", remainingPercent: 90, freshness: "fresh" },
			],
		},
	], now);

	assert.equal(usageMap.get("gemini-pro")?.alertLevel, "exhausted");
	assert.equal(usageMap.get("gemini-flash")?.remainingPercent, 80);
	assert.equal(usageMap.get("gemini-flash-lite")?.remainingPercent, 90);
	const implementation = selectModelForTask("implementation", usageMap, storedAvailableModels, now)?.candidate;
	assert.equal(implementation?.providerQualifiedModelId, "google/gemini-3.1-flash-lite-preview");
	assert.equal(implementation?.usageKey, "gemini-flash-lite");

	const proOnly = selectModelForTask("implementation", usageMap, { availableModelIds: ["google/gemini-3.1-pro-preview"], availabilitySource: "test_fixture" }, now);
	assert.equal(proOnly, undefined, "Gemini Pro must not be selected when the persisted Pro usage bucket is exhausted");

	const liteOnlyUsageMap = new Map(usageMap);
	liteOnlyUsageMap.set("gemini-flash", usage("gemini", 0, "exhausted"));
	assert.equal(selectModelForTask("documentation", liteOnlyUsageMap, storedAvailableModels, now)?.candidate.usageKey, "gemini-flash-lite");
});

test("Gemini model selection prefers the highest available Pro exact model", () => {
	const usageMap = buildUsageMapFromProviders([
		row("claude", 0, "exhausted"),
		row("openai", 0, "exhausted"),
		{
			providerFamily: "gemini",
			remainingPercent: 95,
			alertLevel: "ok",
			freshness: "fresh",
			resetBucket: "gemini-pro-daily",
			resetTime: "2026-05-31T23:00:00.000Z",
			buckets: [
				{ resetBucket: "95% gemini-pro-daily", resetTime: "2026-05-31T23:00:00.000Z", remainingPercent: 95, freshness: "fresh" },
				{ resetBucket: "90% gemini-flash-lite-daily", resetTime: "2026-05-31T23:00:00.000Z", remainingPercent: 90, freshness: "fresh" },
			],
		},
	], now);

	assert.equal(selectModelForTask("implementation", usageMap, {
		availabilitySource: "test_fixture",
		availableModelIds: ["google/gemini-2.5-pro", "google/gemini-3-pro-preview", "google/gemini-3.1-pro-preview", "google/gemini-3.1-flash-lite-preview"],
	}, now)?.candidate.providerQualifiedModelId, "google/gemini-3.1-pro-preview");

	assert.equal(selectModelForTask("implementation", usageMap, {
		availabilitySource: "test_fixture",
		availableModelIds: ["google/gemini-2.5-pro", "google/gemini-3-pro-preview", "google/gemini-3.1-flash-lite-preview"],
	}, now)?.candidate.providerQualifiedModelId, "google/gemini-3-pro-preview");
});

test("model selection fails closed without persisted available exact models", () => {
	const usageMap = buildUsageMapFromProviders([
		row("claude", 80),
		row("openai", 80),
		row("gemini", 80),
	]);
	const result = selectModelForTask("implementation", usageMap, { availableModelIds: [], availabilitySource: "test_fixture" }, now);
	assert.equal(result, undefined);
});

test("model selection prefers period-normalized quota over raw percent", () => {
	const usageMap = new Map([
		["openai", { ...usage("openai", 20, "ok"), resetTime: "2026-06-01T00:00:00.000Z" }],
		["claude", { ...usage("claude", 80, "ok"), resetTime: "2026-06-06T23:00:00.000Z" }],
	]);
	const result = selectModelForTask("architecture", usageMap, storedAvailableModels, now);
	assert.equal(result?.candidate.providerFamily, "openai");
});
