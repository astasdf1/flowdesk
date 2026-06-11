import assert from "node:assert/strict";
import test from "node:test";
import {
	resolveUsageAwareProviderQualifiedModelId,
	type UsageAwareModelResolverInputV1,
	type UsageAwareModelResolverUsageSnapshotV1,
} from "./index.js";

function snap(
	providerFamily: string,
	alertLevel: UsageAwareModelResolverUsageSnapshotV1["alertLevel"],
	remainingPercent: number,
	dispatchability: UsageAwareModelResolverUsageSnapshotV1["dispatchability"] = "dispatchable",
): UsageAwareModelResolverUsageSnapshotV1 {
	return { providerFamily, alertLevel, remainingPercent, dispatchability };
}

test("1. requested model family is ok → no override", () => {
	const input: UsageAwareModelResolverInputV1 = {
		requestedModelId: "anthropic/claude-opus-4-7",
		usageSnapshots: [
			snap("claude", "ok", 80),
			snap("openai", "warning", 30),
		],
		availableModelIds: ["anthropic/claude-opus-4-7", "openai/gpt-5.5"],
	};
	const result = resolveUsageAwareProviderQualifiedModelId(input);
	assert.equal(result.resolvedModelId, "anthropic/claude-opus-4-7");
	assert.equal(result.overrideApplied, false);
	assert.equal(result.originalModelId, "anthropic/claude-opus-4-7");
	assert.equal(result.overrideReason, undefined);
	assert.equal(result.fallbackToOriginal, undefined);
});

test("2. exhausted family + allowCrossFamily:true → cross-family override picked", () => {
	const input: UsageAwareModelResolverInputV1 = {
		requestedModelId: "anthropic/claude-opus-4-7",
		usageSnapshots: [
			snap("claude", "exhausted", 0),
			snap("openai", "ok", 60),
			snap("gemini", "warning", 25),
		],
		availableModelIds: [
			"openai/gpt-5.5",
			"gemini/gemini-pro",
			"anthropic/claude-opus-4-7",
		],
		allowCrossFamily: true,
	};
	const result = resolveUsageAwareProviderQualifiedModelId(input);
	assert.equal(result.overrideApplied, true);
	assert.equal(result.overrideReason, "exhausted");
	assert.equal(result.originalModelId, "anthropic/claude-opus-4-7");
	assert.equal(result.resolvedModelId, "openai/gpt-5.5");
	assert.notEqual(result.fallbackToOriginal, true);
});

test("3. exhausted family + allowCrossFamily:false → fallbackToOriginal", () => {
	const input: UsageAwareModelResolverInputV1 = {
		requestedModelId: "anthropic/claude-opus-4-7",
		usageSnapshots: [
			snap("claude", "exhausted", 0),
			snap("openai", "ok", 60),
		],
		availableModelIds: ["openai/gpt-5.5"],
		allowCrossFamily: false,
	};
	const result = resolveUsageAwareProviderQualifiedModelId(input);
	assert.equal(result.overrideApplied, false);
	assert.equal(result.resolvedModelId, "anthropic/claude-opus-4-7");
	assert.equal(result.fallbackToOriginal, true);
	assert.ok(typeof result.fallbackToOriginalReason === "string");
});

test("4. all families exhausted → fallbackToOriginal: true", () => {
	const input: UsageAwareModelResolverInputV1 = {
		requestedModelId: "anthropic/claude-opus-4-7",
		usageSnapshots: [
			snap("claude", "exhausted", 0),
			snap("openai", "exhausted", 0),
			snap("gemini", "exhausted", 0),
		],
		availableModelIds: [
			"anthropic/claude-opus-4-7",
			"openai/gpt-5.5",
			"gemini/gemini-pro",
		],
	};
	const result = resolveUsageAwareProviderQualifiedModelId(input);
	assert.equal(result.overrideApplied, false);
	assert.equal(result.resolvedModelId, "anthropic/claude-opus-4-7");
	assert.equal(result.fallbackToOriginal, true);
});

test("5. unrecognized requested model family → no override", () => {
	const input: UsageAwareModelResolverInputV1 = {
		requestedModelId: "opencode/some-internal-model",
		usageSnapshots: [
			snap("claude", "ok", 80),
			snap("openai", "ok", 80),
		],
		availableModelIds: ["anthropic/claude-opus-4-7", "openai/gpt-5.5"],
	};
	const result = resolveUsageAwareProviderQualifiedModelId(input);
	assert.equal(result.overrideApplied, false);
	assert.equal(result.resolvedModelId, "opencode/some-internal-model");
	assert.equal(result.fallbackToOriginal, undefined);
});

test("6. availableModelIds empty → fallbackToOriginal", () => {
	const input: UsageAwareModelResolverInputV1 = {
		requestedModelId: "anthropic/claude-opus-4-7",
		usageSnapshots: [
			snap("claude", "exhausted", 0),
			snap("openai", "ok", 60),
		],
		availableModelIds: [],
	};
	const result = resolveUsageAwareProviderQualifiedModelId(input);
	assert.equal(result.overrideApplied, false);
	assert.equal(result.resolvedModelId, "anthropic/claude-opus-4-7");
	assert.equal(result.fallbackToOriginal, true);
});

test("7. allowCrossFamily defaults to true when omitted", () => {
	const input: UsageAwareModelResolverInputV1 = {
		requestedModelId: "anthropic/claude-opus-4-7",
		usageSnapshots: [
			snap("claude", "exhausted", 0),
			snap("openai", "ok", 70),
		],
		availableModelIds: ["openai/gpt-5.5"],
		// allowCrossFamily intentionally omitted
	};
	const result = resolveUsageAwareProviderQualifiedModelId(input);
	assert.equal(result.overrideApplied, true);
	assert.equal(result.providerBindingChangedBeforeLaunch, true);
	assert.equal(result.preLaunchModelSubstitution, true);
	assert.equal(result.modelSubstitutionKind, "pre_launch_preferred_model_substitution");
	assert.equal(result.resolvedModelId, "openai/gpt-5.5");
	assert.equal(result.overrideReason, "exhausted");
});

test("8. critical alertLevel also triggers override search", () => {
	const input: UsageAwareModelResolverInputV1 = {
		requestedModelId: "anthropic/claude-opus-4-7",
		usageSnapshots: [
			snap("claude", "critical", 5),
			snap("openai", "ok", 70),
		],
		availableModelIds: ["openai/gpt-5.5"],
	};
	const result = resolveUsageAwareProviderQualifiedModelId(input);
	assert.equal(result.overrideApplied, true);
	assert.equal(result.overrideReason, "critical");
	assert.equal(result.resolvedModelId, "openai/gpt-5.5");
});

test("9. priority: ok family wins over warning family", () => {
	const input: UsageAwareModelResolverInputV1 = {
		requestedModelId: "anthropic/claude-opus-4-7",
		usageSnapshots: [
			snap("claude", "exhausted", 0),
			snap("openai", "warning", 90), // higher remaining but warning
			snap("gemini", "ok", 40), // lower remaining but ok
		],
		availableModelIds: ["openai/gpt-5.5", "gemini/gemini-pro"],
	};
	const result = resolveUsageAwareProviderQualifiedModelId(input);
	assert.equal(result.overrideApplied, true);
	assert.equal(result.resolvedModelId, "gemini/gemini-pro");
});

test("10. same alertLevel → higher remainingPercent wins", () => {
	const input: UsageAwareModelResolverInputV1 = {
		requestedModelId: "anthropic/claude-opus-4-7",
		usageSnapshots: [
			snap("claude", "exhausted", 0),
			snap("openai", "ok", 30),
			snap("gemini", "ok", 80),
		],
		availableModelIds: ["openai/gpt-5.5", "gemini/gemini-pro"],
	};
	const result = resolveUsageAwareProviderQualifiedModelId(input);
	assert.equal(result.overrideApplied, true);
	assert.equal(result.resolvedModelId, "gemini/gemini-pro");
});

test("11. non_dispatchable alertLevel ok still triggers override", () => {
	const input: UsageAwareModelResolverInputV1 = {
		requestedModelId: "anthropic/claude-opus-4-7",
		usageSnapshots: [
			// alertLevel says ok, but dispatchability says non_dispatchable
			snap("claude", "ok", 80, "non_dispatchable"),
			snap("openai", "ok", 70),
		],
		availableModelIds: ["openai/gpt-5.5"],
	};
	const result = resolveUsageAwareProviderQualifiedModelId(input);
	assert.equal(result.overrideApplied, true);
	assert.equal(result.overrideReason, "non_dispatchable");
	assert.equal(result.resolvedModelId, "openai/gpt-5.5");
});

test("12. stale alertLevel triggers override with stale reason", () => {
	const input: UsageAwareModelResolverInputV1 = {
		requestedModelId: "anthropic/claude-opus-4-7",
		usageSnapshots: [
			snap("claude", "stale", 50),
			snap("openai", "ok", 70),
		],
		availableModelIds: ["openai/gpt-5.5"],
	};
	const result = resolveUsageAwareProviderQualifiedModelId(input);
	assert.equal(result.overrideApplied, true);
	assert.equal(result.overrideReason, "stale");
	assert.equal(result.resolvedModelId, "openai/gpt-5.5");
});

test("13. claude/* prefix variant is recognized as claude family", () => {
	const input: UsageAwareModelResolverInputV1 = {
		requestedModelId: "claude/sonnet-4",
		usageSnapshots: [
			snap("claude", "exhausted", 0),
			snap("openai", "ok", 70),
		],
		availableModelIds: ["openai/gpt-5.5"],
	};
	const result = resolveUsageAwareProviderQualifiedModelId(input);
	assert.equal(result.overrideApplied, true);
	assert.equal(result.resolvedModelId, "openai/gpt-5.5");
});

test("14. google/* prefix variant is recognized as gemini family", () => {
	const input: UsageAwareModelResolverInputV1 = {
		requestedModelId: "google/gemini-pro",
		usageSnapshots: [
			snap("gemini", "exhausted", 0),
			snap("openai", "ok", 70),
		],
		availableModelIds: ["openai/gpt-5.5"],
	};
	const result = resolveUsageAwareProviderQualifiedModelId(input);
	assert.equal(result.overrideApplied, true);
	assert.equal(result.resolvedModelId, "openai/gpt-5.5");
});

test("15. no snapshot for requested family → fail-open pass-through", () => {
	const input: UsageAwareModelResolverInputV1 = {
		requestedModelId: "anthropic/claude-opus-4-7",
		usageSnapshots: [snap("openai", "ok", 70)],
		availableModelIds: ["openai/gpt-5.5"],
	};
	const result = resolveUsageAwareProviderQualifiedModelId(input);
	assert.equal(result.overrideApplied, false);
	assert.equal(result.resolvedModelId, "anthropic/claude-opus-4-7");
	assert.equal(result.fallbackToOriginal, undefined);
});

test("16. allowCrossFamily:false with same-family available model still falls back (no same-family alt logic)", () => {
	// When the requested family itself is unhealthy and cross-family is disabled,
	// no alternative is selected (since the same family is the unhealthy one).
	const input: UsageAwareModelResolverInputV1 = {
		requestedModelId: "anthropic/claude-opus-4-7",
		usageSnapshots: [snap("claude", "exhausted", 0)],
		availableModelIds: ["anthropic/claude-sonnet-4"],
		allowCrossFamily: false,
	};
	const result = resolveUsageAwareProviderQualifiedModelId(input);
	assert.equal(result.overrideApplied, false);
	assert.equal(result.resolvedModelId, "anthropic/claude-opus-4-7");
	assert.equal(result.fallbackToOriginal, true);
});

test("17. resolver never throws on empty inputs", () => {
	const result = resolveUsageAwareProviderQualifiedModelId({
		requestedModelId: "anthropic/claude-opus-4-7",
		usageSnapshots: [],
		availableModelIds: [],
	});
	assert.equal(result.overrideApplied, false);
	assert.equal(result.providerBindingChangedBeforeLaunch, false);
	assert.equal(result.preLaunchModelSubstitution, false);
	assert.equal(result.modelSubstitutionKind, "none");
	assert.equal(result.resolvedModelId, "anthropic/claude-opus-4-7");
});

test("18. pre-launch substitution labels do not imply managed fallback/reselection", () => {
	const result = resolveUsageAwareProviderQualifiedModelId({
		requestedModelId: "anthropic/claude-opus-4-7",
		usageSnapshots: [
			snap("claude", "critical", 3),
			snap("gemini", "ok", 82),
		],
		availableModelIds: ["gemini/gemini-pro"],
	});
	assert.equal(result.overrideApplied, true);
	assert.equal(result.providerBindingChangedBeforeLaunch, true);
	assert.equal(result.preLaunchModelSubstitution, true);
	assert.equal(result.modelSubstitutionKind, "pre_launch_preferred_model_substitution");
	assert.equal(result.resolvedModelId, "gemini/gemini-pro");
});
