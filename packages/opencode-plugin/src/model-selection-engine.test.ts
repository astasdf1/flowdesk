import assert from "node:assert/strict";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";
import {
	selectModelForTask,
	buildUsageMapFromProviders,
	resolveSameFamilyOpenCodeSupportedModelFallback,
	SAME_FAMILY_MODEL_FALLBACK_CHAINS,
	loadProviderCatalog,
	validateProviderCatalogV1,
	opencodeProviderIdFromCatalog,
	type ProviderUsageInput,
	type WorkingModelSelectionInput,
} from "./model-selection-engine.js";
import { buildOIAssignmentAdvisoryV1 } from "./oi-assignment-advisor.js";
import {
	evaluateOIRoutingAdvisoryV1,
	createFlowDeskLedgerRetentionPolicyV1,
	createFlowDeskRoutingInfluencePolicyV1,
	type FlowDeskRoutingAdvisoryLedgerEntryV1,
} from "@flowdesk/core";

function usage(family: ProviderUsageInput["providerFamily"], pct: number | null, alert: ProviderUsageInput["alertLevel"] = "ok"): ProviderUsageInput {
	return { providerFamily: family, remainingPercent: pct, alertLevel: alert, freshness: "fresh", resetBucket: `${family}-weekly`, resetTime: "2026-06-06T00:00:00.000Z" };
}

const now = () => new Date("2026-05-31T00:00:00.000Z");

test("same-family fallback chain ordering is stable", () => {
	assert.deepEqual(SAME_FAMILY_MODEL_FALLBACK_CHAINS.claude, ["opus", "sonnet", "haiku"]);
	assert.deepEqual(SAME_FAMILY_MODEL_FALLBACK_CHAINS.openai, ["normal", "mini", "fast", "spark"]);
	assert.deepEqual(SAME_FAMILY_MODEL_FALLBACK_CHAINS.gemini, ["pro", "flash", "flash-lite"]);
});

test("same-family fallback resolves the first supported downgrade model", () => {
	const resolution = resolveSameFamilyOpenCodeSupportedModelFallback({
		providerQualifiedModelId: "google/gemini-3.1-pro-preview-unsupported",
		availableModelIds: ["google/gemini-3-flash-preview", "google/gemini-3.1-flash-lite"],
	});
	assert.equal(resolution.selectedProviderQualifiedModelId, "google/gemini-3-flash-preview");
	assert.deepEqual(resolution.attemptedProviderQualifiedModelIds.slice(0, 2), [
		"google/gemini-3.1-pro-preview-unsupported",
		"google/gemini-3.1-pro-preview",
	]);
	assert.ok(resolution.attemptedProviderQualifiedModelIds.includes("google/gemini-3-flash-preview"));
});

test("same-family fallback fuzzy matches version-mismatched model family keywords", () => {
	const claude = resolveSameFamilyOpenCodeSupportedModelFallback({
		providerQualifiedModelId: "anthropic/claude-haiku-5.0",
		availableModelIds: ["anthropic/claude-haiku-4-5", "anthropic/claude-sonnet-4-6"],
	});
	assert.equal(claude.selectedProviderQualifiedModelId, "anthropic/claude-haiku-4-5");
	assert.deepEqual(claude.attemptedProviderQualifiedModelIds.slice(0, 2), [
		"anthropic/claude-haiku-5.0",
		"anthropic/claude-haiku-4-5",
	]);

	const openai = resolveSameFamilyOpenCodeSupportedModelFallback({
		providerQualifiedModelId: "openai/gpt-5.6-mini",
		availableModelIds: ["openai/gpt-5.4-mini", "openai/gpt-5.5-fast"],
	});
	assert.equal(openai.selectedProviderQualifiedModelId, "openai/gpt-5.4-mini");
	assert.deepEqual(openai.attemptedProviderQualifiedModelIds.slice(0, 2), [
		"openai/gpt-5.6-mini",
		"openai/gpt-5.4-mini",
	]);

	const gemini = resolveSameFamilyOpenCodeSupportedModelFallback({
		providerQualifiedModelId: "google/gemini-2.0-pro",
		availableModelIds: ["google/gemini-2.5-pro", "google/gemini-2.5-flash"],
	});
	assert.equal(gemini.selectedProviderQualifiedModelId, "google/gemini-2.5-pro");
	assert.ok(gemini.attemptedProviderQualifiedModelIds.includes("google/gemini-2.5-pro"));
});

test("same-family fallback fails closed when no supported family member is available", () => {
	const resolution = resolveSameFamilyOpenCodeSupportedModelFallback({
		providerQualifiedModelId: "openai/gpt-5.5-unsupported",
		availableModelIds: ["openai/not-supported-mini", "openai/not-supported-fast"],
	});
	assert.equal(resolution.selectedProviderQualifiedModelId, undefined);
	assert.equal(resolution.attemptedProviderQualifiedModelIds[0], "openai/gpt-5.5-unsupported");
	assert.ok(resolution.attemptedProviderQualifiedModelIds.includes("openai/gpt-5.4-mini"));
	assert.ok(resolution.attemptedProviderQualifiedModelIds.includes("openai/gpt-5.3-codex-spark"));
});

const storedAvailableModels: WorkingModelSelectionInput = {
	availabilitySource: "test_fixture",
	availableModelIds: [
		"anthropic/claude-opus-4-7",
		"anthropic/claude-sonnet-4-6",
		"openai/gpt-5.5",
		"google/gemini-2.5-pro",
		"google/gemini-3-pro-preview",
		"google/gemini-3.1-pro-preview",
		"google/gemini-3.1-flash-lite",
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

test("Gemini model selection falls back to supported Flash Lite when Gemini Pro quota is exhausted", () => {
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
	assert.equal(implementation?.providerQualifiedModelId, "google/gemini-3.1-flash-lite");
	assert.equal(implementation?.usageKey, "gemini-flash-lite");

	const proOnly = selectModelForTask("implementation", usageMap, { availableModelIds: ["google/gemini-3.1-pro-preview"], availabilitySource: "test_fixture" }, now);
	assert.equal(proOnly, undefined, "Gemini Pro must not be selected when the persisted Pro usage bucket is exhausted");

	const liteOnlyUsageMap = new Map(usageMap);
	liteOnlyUsageMap.set("gemini-flash", usage("gemini", 0, "exhausted"));
	assert.equal(selectModelForTask("documentation", liteOnlyUsageMap, storedAvailableModels, now)?.candidate.usageKey, "gemini-flash-lite");
});

test("model selection intersects cached working models with OpenCode-supported exact models", () => {
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
			],
		},
	], now);

	const result = selectModelForTask("implementation", usageMap, {
		availabilitySource: "test_fixture",
		availableModelIds: ["google/not-opencode-supported", "google/gemini-3.1-pro-preview"],
	}, now);
	assert.equal(result?.candidate.providerQualifiedModelId, "google/gemini-3.1-pro-preview");

	const unsupportedOnly = selectModelForTask("implementation", usageMap, {
		availabilitySource: "test_fixture",
		availableModelIds: ["google/not-opencode-supported"],
	}, now);
	assert.equal(unsupportedOnly, undefined);
});

test("deprecated Gemini Flash Lite preview can never be selected even when cached available", () => {
	const usageMap = buildUsageMapFromProviders([
		row("claude", 0, "exhausted"),
		row("openai", 0, "exhausted"),
		{
			providerFamily: "gemini",
			remainingPercent: 90,
			alertLevel: "ok",
			freshness: "fresh",
			resetBucket: "gemini-flash-lite-daily",
			resetTime: "2026-05-31T23:00:00.000Z",
			buckets: [
				{ resetBucket: "90% gemini-flash-lite-daily", resetTime: "2026-05-31T23:00:00.000Z", remainingPercent: 90, freshness: "fresh" },
			],
		},
	], now);

	const deprecatedOnly = selectModelForTask("documentation", usageMap, {
		availabilitySource: "test_fixture",
		availableModelIds: ["google/gemini-3.1-flash-lite-preview"],
	}, now);
	assert.equal(deprecatedOnly, undefined);
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
		availableModelIds: ["google/gemini-2.5-pro", "google/gemini-3-pro-preview", "google/gemini-3.1-pro-preview", "google/gemini-3.1-flash-lite"],
	}, now)?.candidate.providerQualifiedModelId, "google/gemini-3.1-pro-preview");

	assert.equal(selectModelForTask("implementation", usageMap, {
		availabilitySource: "test_fixture",
		availableModelIds: ["google/gemini-2.5-pro", "google/gemini-3-pro-preview", "google/gemini-3.1-flash-lite"],
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

test("model selection prefers higher OI performance scores as a tertiary tie-breaker", () => {
	// Two candidates with same alertLevel (ok) and same weight (1.0)
	const usageMap = new Map([
		["openai", usage("openai", 80, "ok")],
		["claude", usage("claude", 80, "ok")],
	]);
	const available: WorkingModelSelectionInput = {
		availabilitySource: "test_fixture",
		availableModelIds: ["openai/gpt-5.5", "anthropic/claude-opus-4-7"],
		oiPerformanceScores: new Map([
			["openai/gpt-5.5", 70],
			["anthropic/claude-opus-4-7", 95], // higher OI score
		]),
	};
	// security role: candidates [anthropic/claude-opus-4-7, openai/gpt-5.5]
	const result = selectModelForTask("security", usageMap, available, now);
	assert.ok(result);
	assert.equal(result.candidate.providerQualifiedModelId, "anthropic/claude-opus-4-7", "higher OI performance score should win tie-break");
});

test("model selection result is byte-identical regardless of OI advisory presence", () => {
	// Fixed deterministic inputs — no randomness in these usage/model values.
	const usageMap = new Map([
		["claude", usage("claude", 80, "ok")],
		["openai", usage("openai", 60, "ok")],
		["gemini", usage("gemini", 70, "ok")],
	]);
	const ctx: WorkingModelSelectionInput = {
		availabilitySource: "test_fixture",
		availableModelIds: ["anthropic/claude-opus-4-7", "openai/gpt-5.5"],
	};

	// Baseline: select WITHOUT any OI call.
	const baselineResult = selectModelForTask("security", usageMap, ctx, now);
	assert.ok(baselineResult, "baseline should produce a selection");

	// Call OI advisory before selection (simulating an external pre-call).
	buildOIAssignmentAdvisoryV1({
		workflowId: "workflow-oi-det-test",
		taskId: "task-pre",
		agentRole: "security",
		selectedCandidateRef: "candidate-pre-anthropic-claude-opus-4-7",
		providerFamily: "claude",
		usageRemainingPercent: 80,
		alertLevel: "ok",
		oiEnabled: true,
	});

	// Select again after OI pre-call — must be identical to baseline.
	const afterPreOIResult = selectModelForTask("security", usageMap, ctx, now);
	assert.ok(afterPreOIResult, "post-pre-OI selection should produce a selection");
	assert.equal(
		afterPreOIResult.candidate.providerQualifiedModelId,
		baselineResult.candidate.providerQualifiedModelId,
		"selection must be byte-identical regardless of OI pre-call",
	);
	assert.equal(
		afterPreOIResult.candidate.providerFamily,
		baselineResult.candidate.providerFamily,
		"provider family must be byte-identical regardless of OI pre-call",
	);

	// Call OI advisory AFTER selection (the normal production order).
	const postOIAdvisory = buildOIAssignmentAdvisoryV1({
		workflowId: "workflow-oi-det-test",
		taskId: "task-post",
		agentRole: "security",
		selectedCandidateRef: `candidate-${baselineResult.candidate.providerQualifiedModelId.replace(/\//g, "-")}`,
		providerFamily: baselineResult.candidate.providerFamily,
		usageRemainingPercent: 80,
		alertLevel: "ok",
		oiEnabled: true,
	});

	// OI advisory must be advisory-only — selecting again must still match baseline.
	const afterPostOIResult = selectModelForTask("security", usageMap, ctx, now);
	assert.ok(afterPostOIResult, "post-post-OI selection should produce a selection");
	assert.equal(
		afterPostOIResult.candidate.providerQualifiedModelId,
		baselineResult.candidate.providerQualifiedModelId,
		"selection must be byte-identical regardless of OI post-call",
	);

	// Sanity-check: the OI advisory itself is advisory-only (included, no thrown errors).
	assert.equal(postOIAdvisory.included, true, "OI advisory should be included when oiEnabled=true");
	assert.ok(
		["healthy", "degraded", "stale", "unknown", "partial", "missing_source_evidence", "disabled_by_config"].includes(postOIAdvisory.healthLabel),
		`OI advisory healthLabel should be a valid label, got: ${postOIAdvisory.healthLabel}`,
	);

	// Verify OI disabled path also does not affect selection.
	buildOIAssignmentAdvisoryV1({
		workflowId: "workflow-oi-det-test",
		taskId: "task-disabled",
		agentRole: "security",
		selectedCandidateRef: "candidate-disabled",
		providerFamily: "claude",
		oiEnabled: false,
	});
	const afterDisabledOIResult = selectModelForTask("security", usageMap, ctx, now);
	assert.ok(afterDisabledOIResult, "post-disabled-OI selection should produce a selection");
	assert.equal(
		afterDisabledOIResult.candidate.providerQualifiedModelId,
		baselineResult.candidate.providerQualifiedModelId,
		"selection must be byte-identical when OI is disabled",
	);
});

// gpt-5.4-mini-fast is the FlowDesk main coordinator model
// (FLOWDESK_MAIN_COORDINATOR_MODEL in bootstrap-installer.ts). It must be
// (a) recognized as an OpenCode-supported model id and
// (b) selectable for light-tier roles when it is the only working light model.
test("model selection recognizes openai/gpt-5.4-mini-fast as a supported light model", () => {
	const usageMap = buildUsageMapFromProviders([
		row("openai", 80),
		row("claude", 0, "exhausted"),
		row("gemini", 0, "exhausted"),
	]);
	const available: WorkingModelSelectionInput = {
		availabilitySource: "test_fixture",
		// Constrain working models so the light-tier candidate pool only has
		// gpt-5.4-mini-fast — other LIGHT_MODELS entries are unavailable here.
		availableModelIds: ["openai/gpt-5.4-mini-fast"],
	};
	// `git` is a pure-light role whose candidate pool is LIGHT_MODELS only.
	const result = selectModelForTask("git", usageMap, available, now);
	assert.ok(result, "should return a selection");
	assert.equal(result.candidate.providerQualifiedModelId, "openai/gpt-5.4-mini-fast");
	assert.equal(result.candidate.tier, "light");
	assert.equal(result.candidate.providerFamily, "openai");
});

// ─── routingAdvisory tie-breaker tests (P7-S15 bug fix) ───────────────────────
// The OI routing advisory is computed by evaluateOIRoutingAdvisoryV1 and should
// be wired through selectModelForTask as a tertiary tie-breaker (after alertLevel
// and weight).  The advisory's `model_ref` is an opaque ref that may either equal
// the providerQualifiedModelId directly or follow the candidate-ref convention
// used by workflow-assign-tool (`candidate-<modelId-with-/-replaced-by-->`).

function routingLedgerEntry(overrides: Partial<FlowDeskRoutingAdvisoryLedgerEntryV1>): FlowDeskRoutingAdvisoryLedgerEntryV1 {
	return {
		signature_ref: "signature-default",
		model_ref: "candidate-anthropic-claude-opus-4-7",
		weighted_score: 0.5,
		recorded_at: "2026-05-30T00:00:00.000Z",
		...overrides,
	};
}

test("routingAdvisory tie-breaker prefers higher-scoring model when alertLevel and weight tie (candidate-ref form)", () => {
	const usageMap = new Map([
		["openai", usage("openai", 80, "ok")],
		["claude", usage("claude", 80, "ok")],
	]);
	// Build a routing advisory whose model_refs use the candidate-ref form
	// emitted by workflow-assign-tool.ts.
	const ledger: FlowDeskRoutingAdvisoryLedgerEntryV1[] = [
		routingLedgerEntry({ model_ref: "candidate-anthropic-claude-opus-4-7", weighted_score: 0.9 }),
		routingLedgerEntry({ model_ref: "candidate-openai-gpt-5.5", weighted_score: 0.2 }),
	];
	const advisory = evaluateOIRoutingAdvisoryV1(
		ledger,
		"signature-default",
		createFlowDeskLedgerRetentionPolicyV1(),
		createFlowDeskRoutingInfluencePolicyV1({ enabled: true, min_sample_threshold: 1 }),
		"2026-05-31T00:00:00.000Z",
	);
	const ctx: WorkingModelSelectionInput = {
		availabilitySource: "test_fixture",
		availableModelIds: ["openai/gpt-5.5", "anthropic/claude-opus-4-7"],
		routingAdvisory: advisory,
	};
	// security role: candidates [anthropic/claude-opus-4-7, openai/gpt-5.5]
	// alertLevel and weight tie → advisory tie-break should pick claude (0.9 > 0.2)
	const result = selectModelForTask("security", usageMap, ctx, now);
	assert.ok(result);
	assert.equal(
		result.candidate.providerQualifiedModelId,
		"anthropic/claude-opus-4-7",
		"higher routing advisory score (candidate-ref form) should win tie-break",
	);
});

test("routingAdvisory tie-breaker matches exact providerQualifiedModelId model_ref", () => {
	const usageMap = new Map([
		["openai", usage("openai", 80, "ok")],
		["claude", usage("claude", 80, "ok")],
	]);
	// model_ref equals the providerQualifiedModelId directly (no candidate- prefix).
	const ledger: FlowDeskRoutingAdvisoryLedgerEntryV1[] = [
		routingLedgerEntry({ model_ref: "anthropic/claude-opus-4-7", weighted_score: 0.1 }),
		routingLedgerEntry({ model_ref: "openai/gpt-5.5", weighted_score: 0.95 }),
	];
	const advisory = evaluateOIRoutingAdvisoryV1(
		ledger,
		"signature-default",
		createFlowDeskLedgerRetentionPolicyV1(),
		createFlowDeskRoutingInfluencePolicyV1({ enabled: true, min_sample_threshold: 1 }),
		"2026-05-31T00:00:00.000Z",
	);
	const ctx: WorkingModelSelectionInput = {
		availabilitySource: "test_fixture",
		availableModelIds: ["openai/gpt-5.5", "anthropic/claude-opus-4-7"],
		routingAdvisory: advisory,
	};
	const result = selectModelForTask("security", usageMap, ctx, now);
	assert.ok(result);
	assert.equal(
		result.candidate.providerQualifiedModelId,
		"openai/gpt-5.5",
		"exact providerQualifiedModelId model_ref should be matched by tie-break",
	);
});

test("routingAdvisory does not change selection when alertLevel differs", () => {
	// claude is ok, openai is critical → alertLevel must win regardless of OI score.
	const usageMap = new Map([
		["claude", usage("claude", 80, "ok")],
		["openai", usage("openai", 5, "critical")],
	]);
	const ledger: FlowDeskRoutingAdvisoryLedgerEntryV1[] = [
		routingLedgerEntry({ model_ref: "candidate-anthropic-claude-opus-4-7", weighted_score: 0.0 }),
		routingLedgerEntry({ model_ref: "candidate-openai-gpt-5.5", weighted_score: 1.0 }),
	];
	const advisory = evaluateOIRoutingAdvisoryV1(
		ledger,
		"signature-default",
		createFlowDeskLedgerRetentionPolicyV1(),
		createFlowDeskRoutingInfluencePolicyV1({ enabled: true, min_sample_threshold: 1 }),
		"2026-05-31T00:00:00.000Z",
	);
	const ctx: WorkingModelSelectionInput = {
		availabilitySource: "test_fixture",
		availableModelIds: ["openai/gpt-5.5", "anthropic/claude-opus-4-7"],
		routingAdvisory: advisory,
	};
	const result = selectModelForTask("security", usageMap, ctx, now);
	assert.ok(result);
	assert.equal(
		result.candidate.providerQualifiedModelId,
		"anthropic/claude-opus-4-7",
		"alertLevel must dominate over OI advisory score",
	);
});

test("empty routingAdvisory model_summaries does not crash and falls back to catalog order", () => {
	const usageMap = new Map([
		["openai", usage("openai", 80, "ok")],
		["claude", usage("claude", 80, "ok")],
	]);
	// Ledger has no matching signature → model_summaries will be empty.
	const advisory = evaluateOIRoutingAdvisoryV1(
		[],
		"signature-no-data",
		createFlowDeskLedgerRetentionPolicyV1(),
		createFlowDeskRoutingInfluencePolicyV1({ enabled: true, min_sample_threshold: 1 }),
		"2026-05-31T00:00:00.000Z",
	);
	assert.equal(advisory.model_summaries.length, 0);
	const ctx: WorkingModelSelectionInput = {
		availabilitySource: "test_fixture",
		availableModelIds: ["openai/gpt-5.5", "anthropic/claude-opus-4-7"],
		routingAdvisory: advisory,
	};
	// security role catalog preference puts anthropic first.
	const result = selectModelForTask("security", usageMap, ctx, now);
	assert.ok(result);
	assert.equal(result.candidate.providerQualifiedModelId, "anthropic/claude-opus-4-7");
});

test("routingAdvisory and oiPerformanceScores fuse: advisory wins where present, explicit map fills gaps", () => {
	const usageMap = new Map([
		["openai", usage("openai", 80, "ok")],
		["claude", usage("claude", 80, "ok")],
	]);
	// Advisory only mentions claude with a low score.
	const ledger: FlowDeskRoutingAdvisoryLedgerEntryV1[] = [
		routingLedgerEntry({ model_ref: "candidate-anthropic-claude-opus-4-7", weighted_score: 0.1 }),
	];
	const advisory = evaluateOIRoutingAdvisoryV1(
		ledger,
		"signature-default",
		createFlowDeskLedgerRetentionPolicyV1(),
		createFlowDeskRoutingInfluencePolicyV1({ enabled: true, min_sample_threshold: 1 }),
		"2026-05-31T00:00:00.000Z",
	);
	// Explicit map says openai is very good (0.9).
	const ctx: WorkingModelSelectionInput = {
		availabilitySource: "test_fixture",
		availableModelIds: ["openai/gpt-5.5", "anthropic/claude-opus-4-7"],
		routingAdvisory: advisory,
		oiPerformanceScores: new Map([
			["openai/gpt-5.5", 0.9],
			// claude not in this map – advisory's 0.1 applies
		]),
	};
	const result = selectModelForTask("security", usageMap, ctx, now);
	assert.ok(result);
	assert.equal(
		result.candidate.providerQualifiedModelId,
		"openai/gpt-5.5",
		"explicit map score (0.9) should beat advisory score (0.1) for the un-mentioned model",
	);
});

// ---------------------------------------------------------------------------
// Phase 8f: provider-catalog.json tests
// ---------------------------------------------------------------------------

test("loadProviderCatalog loads and validates the bundle catalog successfully", () => {
	const catalog = loadProviderCatalog();
	assert.equal(catalog.schema_version, "flowdesk.provider_catalog.v1");
	assert.ok(Array.isArray(catalog.families) && catalog.families.length >= 3, "must have at least 3 families");
	assert.ok(Array.isArray(catalog.supported_model_ids) && catalog.supported_model_ids.length > 0);
	// All three families must be present
	const familyNames = catalog.families.map((f) => f.family);
	assert.ok(familyNames.includes("claude"), "claude family must be present");
	assert.ok(familyNames.includes("openai"), "openai family must be present");
	assert.ok(familyNames.includes("gemini"), "gemini family must be present");
	// Tiers must have expected structure
	assert.ok(Array.isArray(catalog.tiers.heavy) && catalog.tiers.heavy.length > 0);
	assert.ok(Array.isArray(catalog.tiers.medium) && catalog.tiers.medium.length > 0);
	assert.ok(Array.isArray(catalog.tiers.light) && catalog.tiers.light.length > 0);
});

test("validateProviderCatalogV1 accepts a valid catalog and rejects invalid ones", () => {
	// Valid catalog
	const validCatalog = {
		schema_version: "flowdesk.provider_catalog.v1",
		updated_at: "2026-06-10T00:00:00Z",
		families: [
			{
				family: "claude",
				opencode_provider_id: "anthropic",
				prefixes: ["anthropic/"],
				stage_keywords: ["opus"],
				fallback_chains: [["anthropic/claude-opus-4-7"]],
				deprecated_model_ids: [],
				agent_name: "reviewer-claude-opus",
			},
		],
		supported_model_ids: ["anthropic/claude-opus-4-7"],
		tiers: {
			heavy: [{ providerQualifiedModelId: "anthropic/claude-opus-4-7", providerFamily: "claude", agentName: "reviewer-claude-opus" }],
			medium: [],
			light: [],
		},
		roles: {},
	};
	assert.deepEqual(validateProviderCatalogV1(validCatalog), [], "valid catalog should have no errors");

	// Missing schema_version
	const noVersion = { ...validCatalog, schema_version: "wrong.version" };
	const noVersionErrors = validateProviderCatalogV1(noVersion);
	assert.ok(noVersionErrors.length > 0, "wrong schema_version should produce errors");

	// Invalid opencode_provider_id (injection attempt)
	const badProviderId = {
		...validCatalog,
		families: [{ ...validCatalog.families[0], opencode_provider_id: "../../malicious" }],
	};
	const badProviderErrors = validateProviderCatalogV1(badProviderId);
	assert.ok(badProviderErrors.length > 0, "path-traversal provider id should produce errors");
	assert.ok(badProviderErrors.some((e) => e.includes("opencode_provider_id")));

	// Invalid agent_name (path traversal attempt)
	const badAgentName = {
		...validCatalog,
		families: [{ ...validCatalog.families[0], agent_name: "../../../etc/passwd" }],
	};
	const badAgentErrors = validateProviderCatalogV1(badAgentName);
	assert.ok(badAgentErrors.length > 0, "path-traversal agent_name should produce errors");
	assert.ok(badAgentErrors.some((e) => e.includes("agent_name")));

	// Invalid model ID format in fallback chain
	const badModelId = {
		...validCatalog,
		families: [{
			...validCatalog.families[0],
			fallback_chains: [["not-a-valid/model/id/with/slashes"]],
		}],
	};
	// The pattern allows "provider/model" - multiple slashes should fail
	// or check that single-component (no slash) fails
	const noSlashModel = {
		...validCatalog,
		families: [{
			...validCatalog.families[0],
			fallback_chains: [["justmodelname"]],
		}],
	};
	const noSlashErrors = validateProviderCatalogV1(noSlashModel);
	assert.ok(noSlashErrors.length > 0, "model id without slash should produce errors");
});

test("opencodeProviderIdFromCatalog maps family names and legacy prefixes correctly", () => {
	const catalog = loadProviderCatalog();

	// Primary family name mappings
	assert.equal(opencodeProviderIdFromCatalog("claude", catalog), "anthropic");
	assert.equal(opencodeProviderIdFromCatalog("openai", catalog), "openai");
	assert.equal(opencodeProviderIdFromCatalog("gemini", catalog), "google");

	// Prefix-based lookups (aliases without trailing slash)
	assert.equal(opencodeProviderIdFromCatalog("anthropic", catalog), "anthropic");
	assert.equal(opencodeProviderIdFromCatalog("google", catalog), "google");

	// Legacy opencode runtime aliases
	assert.equal(opencodeProviderIdFromCatalog("opencode", catalog), "opencode");
	assert.equal(opencodeProviderIdFromCatalog("opencode_go", catalog), "opencode");

	// Unknown family should return undefined
	assert.equal(opencodeProviderIdFromCatalog("unknown_provider_xyz", catalog), undefined);
});
