import assert from "node:assert/strict";
import test from "node:test";

import {
	evaluateFlowDeskRouteDecisionGuardV1,
	validateFlowDeskRouteDecisionGuardEvidenceV1,
} from "./route-decision-guard.js";

test("edit task with verifier-only candidate is blocked", () => {
	const result = evaluateFlowDeskRouteDecisionGuardV1({
		decisionId: "decision-edit-verifier-only",
		taskSummary: "Edit the route guard TypeScript code to block unsafe agent routing.",
		candidateAgentIds: ["flowdesk-verifier-testing"],
	});

	assert.equal(result.classification.intent, "implementation");
	assert.equal(result.decision, "blocked_verifier_only_mismatch");
	assert.equal(validateFlowDeskRouteDecisionGuardEvidenceV1(result.evidence).ok, true);
	assert.equal(result.evidence.dispatch_authority_enabled, false);
	assert.equal(result.evidence.provider_call_made, false);
	assert.equal(result.evidence.runtime_execution, false);
	assert.equal(result.evidence.actual_lane_launch, false);
	assert.equal(result.evidence.open_code_internal_validation_claimed, false);
});

test("test authoring task with verifier-only candidate is blocked", () => {
	const result = evaluateFlowDeskRouteDecisionGuardV1({
		decisionId: "decision-test-verifier-only",
		taskSummary: "Write focused scenario tests for the route decision guard.",
		candidateAgentIds: ["flowdesk-verifier-testing"],
	});

	assert.equal(result.classification.intent, "test_authoring");
	assert.equal(result.decision, "blocked_verifier_only_mismatch");
	assert.deepEqual(result.classification.required_capabilities, ["read_context", "implementation", "workspace_edit", "test_authoring"]);
	assert.equal(validateFlowDeskRouteDecisionGuardEvidenceV1(result.evidence).ok, true);
});

test("verify-only task can route to verifier agent", () => {
	const result = evaluateFlowDeskRouteDecisionGuardV1({
		decisionId: "decision-verify-only",
		taskSummary: "Verify the focused tests and analyze the build evidence.",
		candidateAgentIds: ["flowdesk-verifier-testing"],
	});

	assert.equal(result.classification.intent, "verification");
	assert.equal(result.decision, "routable");
	assert.equal(result.selectedPrimaryAgentId, "agent-verifier-testing");
	assert.equal(validateFlowDeskRouteDecisionGuardEvidenceV1(result.evidence).ok, true);
});

test("mixed implement and verify task requires implementation-capable primary or split", () => {
	const verifierOnly = evaluateFlowDeskRouteDecisionGuardV1({
		decisionId: "decision-mixed-verifier-only",
		taskSummary: "Implement the route guard and verify it with focused tests.",
		candidateAgentIds: ["flowdesk-verifier-testing"],
	});
	assert.equal(verifierOnly.classification.intent, "mixed_implementation_verification");
	assert.equal(verifierOnly.decision, "requires_split_implementation_and_verification");
	assert.equal(validateFlowDeskRouteDecisionGuardEvidenceV1(verifierOnly.evidence).ok, true);

	const implementationPrimary = evaluateFlowDeskRouteDecisionGuardV1({
		decisionId: "decision-mixed-impl-primary",
		taskSummary: "Implement the route guard and verify it with focused tests.",
		candidateAgentIds: ["flowdesk-code-language-specialist", "flowdesk-verifier-testing"],
	});
	assert.equal(implementationPrimary.decision, "routable");
	assert.equal(implementationPrimary.selectedPrimaryAgentId, "agent-code-language-specialist");
	assert.equal(validateFlowDeskRouteDecisionGuardEvidenceV1(implementationPrimary.evidence).ok, true);
});

test("route decision guard evidence validator rejects authority claims", () => {
	const result = evaluateFlowDeskRouteDecisionGuardV1({
		decisionId: "decision-authority-flags",
		taskSummary: "Verify the route decision guard.",
		candidateAgentIds: ["flowdesk-verifier-testing"],
	});
	const validation = validateFlowDeskRouteDecisionGuardEvidenceV1({
		...result.evidence,
		provider_call_made: true,
	});
	assert.equal(validation.ok, false);
	assert.ok(validation.errors.some((error) => /provider_call_made must be false/.test(error)));
});
