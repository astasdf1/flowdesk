import assert from "node:assert/strict";
import test from "node:test";
import {
	evaluateBindingPolicyRevalidation,
	isFreshEvidence,
} from "./binding-policy-revalidation.js";

const now = new Date("2026-06-05T12:00:00.000Z");
const observedAt = "2026-06-05T11:59:30.000Z";

function baseInput() {
	return {
		expectedPolicyHash: "sha256-expected",
		observedPolicyHash: "sha256-expected",
		policyObservedAt: observedAt,
		maxPolicyAgeMs: 60_000,
		now,
		providerQualifiedModelId: "openai/gpt-5.5",
		allowedProviderQualifiedModelIds: ["openai/gpt-5.5", "anthropic/claude-opus-4-7"] as const,
	};
}

test("fresh evidence allowed", () => {
	assert.deepEqual(isFreshEvidence({ observedAt, now, maxAgeMs: 60_000 }), {
		fresh: true,
		reason: "fresh",
	});
});

test("missing observed policy hash blocks", () => {
	const result = evaluateBindingPolicyRevalidation({
		...baseInput(),
		observedPolicyHash: undefined,
	});

	assert.equal(result.status, "blocked");
	assert.equal(result.dispatchAllowed, false);
	assert.equal(result.reason, "policy_hash_missing");
	assert.equal(result.redactedBlockReason, "policy_hash_missing");
	assert.deepEqual(result.authority, {
		dispatchAuthorityEnabled: false,
		providerCall: false,
		runtimeExecution: false,
		fallbackAuthority: false,
	});
});

test("hash mismatch blocks", () => {
	const result = evaluateBindingPolicyRevalidation({
		...baseInput(),
		observedPolicyHash: "sha256-other",
	});

	assert.equal(result.status, "blocked");
	assert.equal(result.dispatchAllowed, false);
	assert.equal(result.reason, "policy_hash_mismatch");
	assert.equal(result.redactedBlockReason, "policy_hash_mismatch");
});

test("stale policy evidence blocks", () => {
	const result = evaluateBindingPolicyRevalidation({
		...baseInput(),
		policyObservedAt: "2026-06-05T11:58:59.999Z",
		maxPolicyAgeMs: 60_000,
	});

	assert.equal(result.status, "blocked");
	assert.equal(result.dispatchAllowed, false);
	assert.equal(result.reason, "evidence_stale");
	assert.equal(result.redactedBlockReason, "evidence_stale");
});

test("future timestamp beyond skew blocks", () => {
	const result = evaluateBindingPolicyRevalidation({
		...baseInput(),
		policyObservedAt: "2026-06-05T12:00:05.001Z",
	});

	assert.equal(result.status, "blocked");
	assert.equal(result.dispatchAllowed, false);
	assert.equal(result.reason, "observed_at_from_future");
	assert.equal(result.redactedBlockReason, "observed_at_from_future");
});

test("exact provider allowlist mismatch blocks", () => {
	const result = evaluateBindingPolicyRevalidation({
		...baseInput(),
		providerQualifiedModelId: "openai/gpt-5.5-fast",
	});

	assert.equal(result.status, "blocked");
	assert.equal(result.dispatchAllowed, false);
	assert.equal(result.reason, "provider_model_not_allowed");
	assert.equal(result.redactedBlockReason, "provider_model_not_allowed");
});

test("exact provider allowlist match allows", () => {
	const result = evaluateBindingPolicyRevalidation(baseInput());

	assert.equal(result.status, "allowed");
	assert.equal(result.dispatchAllowed, true);
	assert.equal(result.reason, "binding_policy_revalidated");
	assert.equal(result.redactedBlockReason, undefined);
	assert.deepEqual(result.authority, {
		dispatchAuthorityEnabled: false,
		providerCall: false,
		runtimeExecution: false,
		fallbackAuthority: false,
	});
});
