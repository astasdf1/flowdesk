import assert from "node:assert/strict";
import test from "node:test";
import {
	selectModelForTask,
	buildUsageMapFromProviders,
	type ProviderUsageInput,
} from "./model-selection-engine.js";

function usage(family: ProviderUsageInput["providerFamily"], pct: number | null, alert: ProviderUsageInput["alertLevel"] = "ok"): ProviderUsageInput {
	return { providerFamily: family, remainingPercent: pct, alertLevel: alert };
}

test("model selection picks heavy model for security role when usage is healthy", () => {
	const usageMap = buildUsageMapFromProviders([
		{ providerFamily: "claude", remainingPercent: 90, alertLevel: "ok" },
		{ providerFamily: "openai", remainingPercent: 85, alertLevel: "ok" },
		{ providerFamily: "gemini", remainingPercent: 50, alertLevel: "ok" },
	]);
	const result = selectModelForTask("security", usageMap);
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
		const result = selectModelForTask("security", usageMap);
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
		const result = selectModelForTask("architecture", usageMap);
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
	const result = selectModelForTask("implementation", usageMap);
	assert.equal(result, undefined);
});

test("model selection picks lighter models for documentation role", () => {
	const usageMap = buildUsageMapFromProviders([
		{ providerFamily: "claude", remainingPercent: 80, alertLevel: "ok" },
		{ providerFamily: "openai", remainingPercent: 80, alertLevel: "ok" },
		{ providerFamily: "gemini", remainingPercent: 0, alertLevel: "exhausted" },
	]);
	const result = selectModelForTask("documentation", usageMap);
	assert.ok(result, "should return a selection");
	assert.equal(result.candidate.tier, "light");
});

test("buildUsageMapFromProviders ignores unknown families", () => {
	const map = buildUsageMapFromProviders([
		{ providerFamily: "claude", remainingPercent: 70, alertLevel: "ok" },
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
		const result = selectModelForTask("architecture", usageMap);
		if (result?.candidate.providerFamily === "openai") openaiCount++;
	}
	// openai should win far more often due to weight difference
	assert.ok(openaiCount > 60, `high-usage provider should dominate, got ${openaiCount}/100`);
});

test("model selection prefers distinct models for each task independently", () => {
	const usageMap = buildUsageMapFromProviders([
		{ providerFamily: "claude", remainingPercent: 80, alertLevel: "ok" },
		{ providerFamily: "openai", remainingPercent: 80, alertLevel: "ok" },
		{ providerFamily: "gemini", remainingPercent: 80, alertLevel: "ok" },
	]);
	const roles = ["security", "implementation", "documentation"] as const;
  const selections = roles.map(role => selectModelForTask(role, usageMap));
  assert.ok(selections.every(s => s !== undefined), "all roles should get a selection");
});

test("model selection respects allowed model ids from working cache", () => {
	const usageMap = buildUsageMapFromProviders([
		{ providerFamily: "claude", remainingPercent: 80, alertLevel: "ok" },
		{ providerFamily: "openai", remainingPercent: 80, alertLevel: "ok" },
		{ providerFamily: "gemini", remainingPercent: 80, alertLevel: "ok" },
	]);
	const result = selectModelForTask("architecture", usageMap, { availableModelIds: ["openai/gpt-5.5"] });
	assert.ok(result);
	assert.equal(result?.candidate.providerQualifiedModelId, "openai/gpt-5.5");
});

test("Gemini model selection uses pro, flash, and flash-lite usage buckets separately", () => {
	const usageMap = buildUsageMapFromProviders([
		{ providerFamily: "claude", remainingPercent: 0, alertLevel: "exhausted" },
		{ providerFamily: "openai", remainingPercent: 0, alertLevel: "exhausted" },
		{
			providerFamily: "gemini",
			remainingPercent: 0,
			alertLevel: "exhausted",
			buckets: [
				{ resetBucket: "0% gemini-pro-daily", remainingPercent: 0, freshness: "fresh" },
				{ resetBucket: "80% gemini-flash-daily", remainingPercent: 80, freshness: "fresh" },
				{ resetBucket: "90% gemini-flash-lite-daily", remainingPercent: 90, freshness: "fresh" },
			],
		},
	]);

	assert.equal(usageMap.get("gemini-pro")?.alertLevel, "exhausted");
	assert.equal(usageMap.get("gemini-flash")?.remainingPercent, 80);
	assert.equal(usageMap.get("gemini-flash-lite")?.remainingPercent, 90);
	assert.equal(selectModelForTask("implementation", usageMap)?.candidate.usageKey, "gemini-flash");

	const liteOnlyUsageMap = new Map(usageMap);
	liteOnlyUsageMap.set("gemini-flash", usage("gemini", 0, "exhausted"));
	assert.equal(selectModelForTask("documentation", liteOnlyUsageMap)?.candidate.usageKey, "gemini-flash-lite");
});
