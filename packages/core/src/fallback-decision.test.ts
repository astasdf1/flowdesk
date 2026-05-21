import assert from "node:assert/strict";
import test from "node:test";
import { validateFlowDeskFallbackDecisionV1, type FlowDeskFallbackDecisionV1 } from "./index.js";

function decision(overrides: Partial<FlowDeskFallbackDecisionV1> = {}): FlowDeskFallbackDecisionV1 {
	return {
		schema_version: "flowdesk.fallback_decision.v1",
		decision_id: "fallback-1",
		workflow_id: "workflow-1",
		parent_attempt_id: "attempt-1",
		new_attempt_id: "attempt-2",
		from_provider_qualified_model_id: "claude/claude-opus-4-5",
		to_provider_qualified_model_id: "openai/gpt-5.5",
		reason_label: "provider_unhealthy",
		depth: 1,
		max_depth: 2,
		fresh_evidence_refs: ["usage-2", "health-2", "echo-2"],
		fresh_guard_decision_ref: "guard-2",
		fresh_approval_ref: "approval-2",
		fresh_pre_dispatch_audit_ref: "audit-2",
		policy_eligibility_ref: "policy-2",
		runtime_compatibility_ref: "runtime-2",
		state: "requires_full_regate",
		automatic_fallback_authorized: false,
		dispatch_authority_enabled: false,
		providerCall: false,
		actualLaneLaunch: false,
		runtimeExecution: false,
		...overrides,
	};
}

test("fallback decision requires new attempt and full fresh gate refs", () => {
	assert.equal(validateFlowDeskFallbackDecisionV1(decision()).ok, true);
});

test("fallback decision rejects same attempt, chained depth, and authority", () => {
	const result = validateFlowDeskFallbackDecisionV1(decision({ parent_attempt_id: "attempt-1", new_attempt_id: "attempt-1", depth: 2, state: "requires_full_regate", automatic_fallback_authorized: true as unknown as false }));
	assert.equal(result.ok, false);
	assert.match(result.errors.join("|"), /new attempt|max-depth|runtime authority/);
});

test("fallback decision rejects missing or fallback-derived fresh evidence", () => {
	const missingFresh = validateFlowDeskFallbackDecisionV1(decision({ fresh_evidence_refs: ["usage-2"] }));
	assert.equal(missingFresh.ok, false);
	assert.match(missingFresh.errors.join("; "), /fresh usage, health, and runtime/);

	const derived = validateFlowDeskFallbackDecisionV1(decision({ fresh_evidence_refs: ["usage-2", "health-2", "fallback-derived-echo"] }));
	assert.equal(derived.ok, false);
	assert.match(derived.errors.join("; "), /fallback-derived/);

	const zeroDepth = validateFlowDeskFallbackDecisionV1(decision({ depth: 0 }));
	assert.equal(zeroDepth.ok, false);
	assert.match(zeroDepth.errors.join("; "), /depth/);
});
