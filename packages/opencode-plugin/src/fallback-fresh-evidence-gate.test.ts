import assert from "node:assert/strict";
import test from "node:test";
import { evaluateFallbackFreshEvidenceGate } from "./fallback-fresh-evidence-gate.js";

const now = new Date("2026-06-05T12:00:00.000Z");
const observedAt = "2026-06-05T11:59:30.000Z";

function baseInput() {
	return {
		previousAttemptId: "attempt-previous",
		newAttemptId: "attempt-new",
		fallbackApproval: {
			approvalId: "approval-fallback-1",
			actionType: "fallback_reselection",
			attemptId: "attempt-new",
			observedAt,
		},
		providerUsageObservedAt: observedAt,
		providerHealthObservedAt: observedAt,
		maxEvidenceAgeMs: 60_000,
		now,
	};
}

test("new attempt with fresh approval, usage, and health allows", () => {
	const result = evaluateFallbackFreshEvidenceGate(baseInput());

	assert.equal(result.status, "allowed");
	assert.equal(result.fallbackAllowed, true);
	assert.equal(result.reason, "fallback_fresh_evidence_validated");
	assert.equal(result.redactedBlockReason, undefined);
	assert.deepEqual(result.authority, {
		fallbackAuthority: false,
		dispatchAuthorityEnabled: false,
		providerCall: false,
		runtimeExecution: false,
	});
});

test("same attempt blocks", () => {
	const result = evaluateFallbackFreshEvidenceGate({
		...baseInput(),
		newAttemptId: "attempt-previous",
		fallbackApproval: {
			...baseInput().fallbackApproval,
			attemptId: "attempt-previous",
		},
	});

	assert.equal(result.status, "blocked");
	assert.equal(result.fallbackAllowed, false);
	assert.equal(result.reason, "fallback_requires_new_attempt_id");
	assert.equal(result.redactedBlockReason, "fallback_requires_new_attempt_id");
});

test("missing approval blocks", () => {
	const result = evaluateFallbackFreshEvidenceGate({
		...baseInput(),
		fallbackApproval: undefined,
	});

	assert.equal(result.status, "blocked");
	assert.equal(result.reason, "fallback_approval_missing");
	assert.equal(result.redactedBlockReason, "fallback_approval_missing");
});

test("wrong action type blocks", () => {
	const result = evaluateFallbackFreshEvidenceGate({
		...baseInput(),
		fallbackApproval: {
			...baseInput().fallbackApproval,
			actionType: "dispatch_approval",
		},
	});

	assert.equal(result.status, "blocked");
	assert.equal(result.reason, "fallback_approval_wrong_action_type");
	assert.equal(result.redactedBlockReason, "fallback_approval_wrong_action_type");
});

test("approval attempt mismatch blocks", () => {
	const result = evaluateFallbackFreshEvidenceGate({
		...baseInput(),
		fallbackApproval: {
			...baseInput().fallbackApproval,
			attemptId: "attempt-other",
		},
	});

	assert.equal(result.status, "blocked");
	assert.equal(result.reason, "fallback_approval_attempt_mismatch");
	assert.equal(result.redactedBlockReason, "fallback_approval_attempt_mismatch");
});

test("consumed approval blocks", () => {
	const result = evaluateFallbackFreshEvidenceGate({
		...baseInput(),
		fallbackApproval: {
			...baseInput().fallbackApproval,
			consumed: true,
		},
	});

	assert.equal(result.status, "blocked");
	assert.equal(result.reason, "fallback_approval_already_consumed");
	assert.equal(result.redactedBlockReason, "fallback_approval_already_consumed");
});

test("stale approval evidence blocks", () => {
	const result = evaluateFallbackFreshEvidenceGate({
		...baseInput(),
		fallbackApproval: {
			...baseInput().fallbackApproval,
			observedAt: "2026-06-05T11:58:59.999Z",
		},
	});

	assert.equal(result.status, "blocked");
	assert.equal(result.reason, "evidence_stale");
	assert.equal(result.redactedBlockReason, "evidence_stale");
});

test("stale usage blocks", () => {
	const result = evaluateFallbackFreshEvidenceGate({
		...baseInput(),
		providerUsageObservedAt: "2026-06-05T11:58:59.999Z",
	});

	assert.equal(result.status, "blocked");
	assert.equal(result.reason, "provider_usage_stale");
	assert.equal(result.redactedBlockReason, "provider_usage_stale");
});

test("stale health blocks", () => {
	const result = evaluateFallbackFreshEvidenceGate({
		...baseInput(),
		providerHealthObservedAt: "2026-06-05T11:58:59.999Z",
	});

	assert.equal(result.status, "blocked");
	assert.equal(result.reason, "provider_health_stale");
	assert.equal(result.redactedBlockReason, "provider_health_stale");
});

test("future timestamp blocks", () => {
	const result = evaluateFallbackFreshEvidenceGate({
		...baseInput(),
		fallbackApproval: {
			...baseInput().fallbackApproval,
			observedAt: "2026-06-05T12:00:05.001Z",
		},
	});

	assert.equal(result.status, "blocked");
	assert.equal(result.reason, "observed_at_from_future");
	assert.equal(result.redactedBlockReason, "observed_at_from_future");
});
