/**
 * Tests for P7-S06: FlowDeskFanoutCadenceDecisionV1 cadence control contract.
 *
 * Covers:
 *   1. allow — window headroom, no cooldown, no novelty/budget constraints
 *   2. blocked_cooldown — cooldown period has not elapsed
 *   3. blocked_window_cap — active + requested exceeds cap
 *   4. blocked_low_novelty — novelty score below threshold
 *   5. blocked_budget — estimated cost exceeds budget cap
 *   6. authority flags — all false on every decision variant
 *   7. blocked_window_cap on gate validation error (invalid input)
 *   8. allow with novelty/budget present but passing
 *   9. cooldown_remaining_seconds only present when in cooldown
 *  10. schema_version constant
 */
import assert from "node:assert/strict";
import test from "node:test";
import {
	evaluateFanoutCadenceDecisionV1,
	type FlowDeskFanoutCadenceGateInputV1,
	type FlowDeskFanoutCadenceDecisionOutcomeV1,
	type FlowDeskFanoutCadenceDecisionV1,
} from "./operational-intelligence/multi-model-fanout-cadence.js";

// ─── Shared test fixture helpers ──────────────────────────────────────────────

function baseInput(overrides: Partial<FlowDeskFanoutCadenceGateInputV1> = {}): FlowDeskFanoutCadenceGateInputV1 {
	return {
		gateId: "gate-cadence-test-001",
		workflowId: "workflow-test-001",
		requestedLaneCount: 1,
		maxConcurrentLanes: 4,
		activeLaneCount: 0,
		cadenceWindowSeconds: 60,
		cooldownSeconds: 0,
		secondsSinceLastBurst: 120,
		reasonRefs: ["reason-cadence-test-ref"],
		...overrides,
	};
}

const FIXED_NOW = "2026-06-11T00:00:00.000Z";

// ─── Test 1: allow — window headroom, no cooldown ─────────────────────────────

test("evaluateFanoutCadenceDecisionV1: allow when window has headroom and no cooldown", () => {
	const decision = evaluateFanoutCadenceDecisionV1({
		gateInput: baseInput({
			requestedLaneCount: 1,
			maxConcurrentLanes: 4,
			activeLaneCount: 2,
			cooldownSeconds: 0,
			secondsSinceLastBurst: 999,
		}),
		now: FIXED_NOW,
	});

	assert.equal(decision.schema_version, "flowdesk.fanout_cadence_decision.v1");
	assert.equal(decision.cadence_decision, "allow");
	assert.equal(decision.gate_satisfied, true);
	assert.equal(decision.redacted_block_reason, undefined);
	assert.equal(decision.cooldown_remaining_seconds, undefined);
	assert.equal(decision.rolling_window_requests, 2);
	assert.equal(decision.rolling_window_cap, 4);
	assert.equal(decision.rolling_window_seconds, 60);
});

// ─── Test 2: blocked_cooldown ─────────────────────────────────────────────────

test("evaluateFanoutCadenceDecisionV1: blocked_cooldown when cooldown has not elapsed", () => {
	const decision = evaluateFanoutCadenceDecisionV1({
		gateInput: baseInput({
			requestedLaneCount: 1,
			maxConcurrentLanes: 4,
			activeLaneCount: 0,
			cooldownSeconds: 30,
			secondsSinceLastBurst: 10,
		}),
		now: FIXED_NOW,
	});

	assert.equal(decision.cadence_decision, "blocked_cooldown");
	assert.equal(decision.gate_satisfied, false);
	assert.equal(typeof decision.redacted_block_reason, "string");
	// cooldown_remaining_seconds should be 30 - 10 = 20
	assert.ok(decision.cooldown_remaining_seconds !== undefined, "cooldown_remaining_seconds should be present");
	assert.ok(
		(decision.cooldown_remaining_seconds as number) > 0,
		"cooldown_remaining_seconds must be positive",
	);
	assert.equal(decision.cooldown_remaining_seconds, 20);
});

// ─── Test 3: blocked_window_cap ───────────────────────────────────────────────

test("evaluateFanoutCadenceDecisionV1: blocked_window_cap when active + requested exceeds max", () => {
	const decision = evaluateFanoutCadenceDecisionV1({
		gateInput: baseInput({
			requestedLaneCount: 3,
			maxConcurrentLanes: 4,
			activeLaneCount: 3, // 3 + 3 = 6 > 4
			cooldownSeconds: 0,
			secondsSinceLastBurst: 999,
		}),
		now: FIXED_NOW,
	});

	assert.equal(decision.cadence_decision, "blocked_window_cap");
	assert.equal(decision.gate_satisfied, false);
	assert.equal(typeof decision.redacted_block_reason, "string");
	assert.equal(decision.cooldown_remaining_seconds, undefined);
});

// ─── Test 4: blocked_low_novelty ─────────────────────────────────────────────

test("evaluateFanoutCadenceDecisionV1: blocked_low_novelty when novelty score is below threshold", () => {
	const decision = evaluateFanoutCadenceDecisionV1({
		gateInput: baseInput({
			requestedLaneCount: 1,
			maxConcurrentLanes: 4,
			activeLaneCount: 0,
			cooldownSeconds: 0,
			secondsSinceLastBurst: 999,
			noveltyScore: 0.2,
			noveltyThreshold: 0.5,
		}),
		now: FIXED_NOW,
	});

	assert.equal(decision.cadence_decision, "blocked_low_novelty");
	assert.equal(decision.gate_satisfied, false);
	assert.equal(typeof decision.redacted_block_reason, "string");
	assert.equal(decision.novelty_score, 0.2);
	assert.equal(decision.novelty_threshold, 0.5);
});

// ─── Test 5: blocked_budget ───────────────────────────────────────────────────

test("evaluateFanoutCadenceDecisionV1: blocked_budget when estimated cost exceeds budget cap", () => {
	const decision = evaluateFanoutCadenceDecisionV1({
		gateInput: baseInput({
			requestedLaneCount: 1,
			maxConcurrentLanes: 4,
			activeLaneCount: 0,
			cooldownSeconds: 0,
			secondsSinceLastBurst: 999,
			estimatedCostUnits: 150,
			budgetCapUnits: 100,
		}),
		now: FIXED_NOW,
	});

	assert.equal(decision.cadence_decision, "blocked_budget");
	assert.equal(decision.gate_satisfied, false);
	assert.equal(typeof decision.redacted_block_reason, "string");
	assert.equal(decision.estimated_cost_units, 150);
	assert.equal(decision.budget_cap_units, 100);
});

// ─── Test 6: authority flags all false ────────────────────────────────────────

test("evaluateFanoutCadenceDecisionV1: authority flags are always false on allow", () => {
	const allow = evaluateFanoutCadenceDecisionV1({
		gateInput: baseInput(),
		now: FIXED_NOW,
	});
	assert.equal(allow.advisory_only, true);
	assert.equal(allow.dispatch_authority_enabled, false);
	assert.equal(allow.provider_call_authority_enabled, false);
});

test("evaluateFanoutCadenceDecisionV1: authority flags are always false on blocked_cooldown", () => {
	const blocked = evaluateFanoutCadenceDecisionV1({
		gateInput: baseInput({ cooldownSeconds: 30, secondsSinceLastBurst: 5 }),
		now: FIXED_NOW,
	});
	assert.equal(blocked.advisory_only, true);
	assert.equal(blocked.dispatch_authority_enabled, false);
	assert.equal(blocked.provider_call_authority_enabled, false);
});

test("evaluateFanoutCadenceDecisionV1: authority flags are always false on blocked_window_cap", () => {
	const blocked = evaluateFanoutCadenceDecisionV1({
		gateInput: baseInput({ requestedLaneCount: 5, maxConcurrentLanes: 4, activeLaneCount: 0 }),
		now: FIXED_NOW,
	});
	assert.equal(blocked.cadence_decision, "blocked_window_cap");
	assert.equal(blocked.advisory_only, true);
	assert.equal(blocked.dispatch_authority_enabled, false);
	assert.equal(blocked.provider_call_authority_enabled, false);
});

test("evaluateFanoutCadenceDecisionV1: authority flags are always false on blocked_low_novelty", () => {
	const blocked = evaluateFanoutCadenceDecisionV1({
		gateInput: baseInput({ noveltyScore: 0.1, noveltyThreshold: 0.8 }),
		now: FIXED_NOW,
	});
	assert.equal(blocked.advisory_only, true);
	assert.equal(blocked.dispatch_authority_enabled, false);
	assert.equal(blocked.provider_call_authority_enabled, false);
});

test("evaluateFanoutCadenceDecisionV1: authority flags are always false on blocked_budget", () => {
	const blocked = evaluateFanoutCadenceDecisionV1({
		gateInput: baseInput({ estimatedCostUnits: 200, budgetCapUnits: 50 }),
		now: FIXED_NOW,
	});
	assert.equal(blocked.advisory_only, true);
	assert.equal(blocked.dispatch_authority_enabled, false);
	assert.equal(blocked.provider_call_authority_enabled, false);
});

// ─── Test 7: blocked_window_cap on gate validation error ─────────────────────

test("evaluateFanoutCadenceDecisionV1: blocked_window_cap on gate validation failure (empty reasonRefs)", () => {
	const decision = evaluateFanoutCadenceDecisionV1({
		gateInput: baseInput({ reasonRefs: [] }), // gate requires non-empty reasonRefs
		now: FIXED_NOW,
	});

	assert.equal(decision.cadence_decision, "blocked_window_cap");
	assert.equal(decision.gate_satisfied, false);
	assert.equal(typeof decision.redacted_block_reason, "string");
	assert.equal(decision.advisory_only, true);
	assert.equal(decision.dispatch_authority_enabled, false);
	assert.equal(decision.provider_call_authority_enabled, false);
});

// ─── Test 8: allow with novelty and budget present but passing ────────────────

test("evaluateFanoutCadenceDecisionV1: allow when novelty and budget both pass", () => {
	const decision = evaluateFanoutCadenceDecisionV1({
		gateInput: baseInput({
			requestedLaneCount: 1,
			maxConcurrentLanes: 4,
			activeLaneCount: 0,
			cooldownSeconds: 0,
			secondsSinceLastBurst: 999,
			noveltyScore: 0.9,
			noveltyThreshold: 0.5,
			estimatedCostUnits: 40,
			budgetCapUnits: 100,
		}),
		now: FIXED_NOW,
	});

	assert.equal(decision.cadence_decision, "allow");
	assert.equal(decision.gate_satisfied, true);
	// optional fields should be present (passed in)
	assert.equal(decision.novelty_score, 0.9);
	assert.equal(decision.novelty_threshold, 0.5);
	assert.equal(decision.estimated_cost_units, 40);
	assert.equal(decision.budget_cap_units, 100);
});

// ─── Test 9: cooldown_remaining_seconds absent on allow ──────────────────────

test("evaluateFanoutCadenceDecisionV1: cooldown_remaining_seconds absent on allow", () => {
	const decision = evaluateFanoutCadenceDecisionV1({
		gateInput: baseInput({
			cooldownSeconds: 30,
			secondsSinceLastBurst: 60, // cooldown has elapsed
		}),
		now: FIXED_NOW,
	});

	// cooldown elapsed: secondsSinceLastBurst >= cooldownSeconds
	assert.equal(decision.cadence_decision, "allow");
	assert.equal(decision.cooldown_remaining_seconds, undefined);
});

// ─── Test 10: schema_version constant ────────────────────────────────────────

test("evaluateFanoutCadenceDecisionV1: schema_version is always flowdesk.fanout_cadence_decision.v1", () => {
	const variants: FlowDeskFanoutCadenceGateInputV1[] = [
		baseInput(),
		baseInput({ cooldownSeconds: 30, secondsSinceLastBurst: 5 }),
		baseInput({ requestedLaneCount: 10, maxConcurrentLanes: 4, activeLaneCount: 0 }),
		baseInput({ noveltyScore: 0.1, noveltyThreshold: 0.9 }),
		baseInput({ estimatedCostUnits: 500, budgetCapUnits: 10 }),
	];

	for (const gateInput of variants) {
		const decision = evaluateFanoutCadenceDecisionV1({ gateInput, now: FIXED_NOW });
		assert.equal(
			decision.schema_version,
			"flowdesk.fanout_cadence_decision.v1",
			`schema_version must be constant for decision: ${decision.cadence_decision}`,
		);
	}
});

// ─── Test 11: precedence — cooldown wins over window_cap ─────────────────────

test("evaluateFanoutCadenceDecisionV1: blocked_cooldown takes precedence over blocked_window_cap", () => {
	// Both cooldown AND cap would trigger, but cooldown comes first
	const decision = evaluateFanoutCadenceDecisionV1({
		gateInput: baseInput({
			requestedLaneCount: 5, // exceeds max
			maxConcurrentLanes: 4,
			activeLaneCount: 4,
			cooldownSeconds: 60,
			secondsSinceLastBurst: 10, // also in cooldown
		}),
		now: FIXED_NOW,
	});

	assert.equal(decision.cadence_decision, "blocked_cooldown");
});

// ─── Test 12: precedence — window_cap wins over low_novelty ──────────────────

test("evaluateFanoutCadenceDecisionV1: blocked_window_cap takes precedence over blocked_low_novelty", () => {
	const decision = evaluateFanoutCadenceDecisionV1({
		gateInput: baseInput({
			requestedLaneCount: 5,
			maxConcurrentLanes: 4,
			activeLaneCount: 0,
			cooldownSeconds: 0,
			noveltyScore: 0.1,
			noveltyThreshold: 0.9,
		}),
		now: FIXED_NOW,
	});

	assert.equal(decision.cadence_decision, "blocked_window_cap");
});

// ─── Test 13: rolling window fields reflect input values ─────────────────────

test("evaluateFanoutCadenceDecisionV1: rolling window fields reflect input values", () => {
	const decision = evaluateFanoutCadenceDecisionV1({
		gateInput: baseInput({
			activeLaneCount: 1,
			maxConcurrentLanes: 8,
			cadenceWindowSeconds: 120,
		}),
		now: FIXED_NOW,
	});

	assert.equal(decision.rolling_window_requests, 1);
	assert.equal(decision.rolling_window_cap, 8);
	assert.equal(decision.rolling_window_seconds, 120);
});
