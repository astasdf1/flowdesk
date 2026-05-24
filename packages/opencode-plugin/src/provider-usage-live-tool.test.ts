import assert from "node:assert/strict";
import test from "node:test";
import { executeFlowDeskProviderUsageLiveV1 } from "./provider-usage-live-tool.js";

const fixedNow = () => new Date("2026-05-24T00:00:00.000Z");

const validAlertLevels = new Set([
	"ok",
	"warning",
	"critical",
	"exhausted",
	"stale",
	"unknown",
]);

test("provider usage live result includes per-row alertLevel and overall recommendation", async () => {
	const result = await executeFlowDeskProviderUsageLiveV1({
		config: {
			providers: ["claude", "openai", "gemini"],
			homeDir: "/tmp/flowdesk-no-such-dir-for-tests",
		},
		request: { providerFamily: "all" },
		now: fixedNow,
	});
	assert.equal(result.status, "provider_usage_live_collected");
	assert.equal(result.resolvedProviderFamilies.length, 3);
	for (const row of result.providers) {
		assert.equal(typeof row.alertLevel, "string");
		assert.ok(
			validAlertLevels.has(row.alertLevel),
			`unexpected alertLevel: ${row.alertLevel}`,
		);
		assert.equal(typeof row.recommendation, "string");
		assert.ok(row.recommendation.length > 0);
	}
	assert.ok(validAlertLevels.has(result.worstAlertLevel));
	assert.equal(typeof result.overallRecommendation, "string");
	assert.ok(result.overallRecommendation.length > 0);
});

test("provider usage live result blocks before collector when no provider family is configured", async () => {
	const result = await executeFlowDeskProviderUsageLiveV1({
		config: { providers: [] },
		request: { providerFamily: "all" },
		now: fixedNow,
	});
	assert.equal(result.status, "blocked_before_provider_usage_live");
	assert.equal(result.worstAlertLevel, "unknown");
	assert.match(
		result.overallRecommendation,
		/at least one of claude\/openai\/gemini/i,
	);
});
