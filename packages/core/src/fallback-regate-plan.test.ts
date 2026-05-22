import assert from "node:assert/strict";
import test from "node:test";
import {
	planFlowDeskFallbackRegateV1,
	type FlowDeskFallbackDecisionV1,
	type FlowDeskProductionApprovalSourceV1,
} from "./index.js";

function decision(
	overrides: Partial<FlowDeskFallbackDecisionV1> = {},
): FlowDeskFallbackDecisionV1 {
	return {
		schema_version: "flowdesk.fallback_decision.v1",
		decision_id: "fallback-1",
		workflow_id: "workflow-1",
		parent_attempt_id: "attempt-1",
		new_attempt_id: "attempt-2",
		from_provider_qualified_model_id: "claude/sonnet-4",
		to_provider_qualified_model_id: "openai/gpt-5.5",
		reason_label: "provider_unhealthy",
		depth: 1,
		max_depth: 2,
		fresh_evidence_refs: ["usage-fresh-1", "health-fresh-1", "runtime-fresh-1"],
		fresh_guard_decision_ref: "guard-fresh-1",
		fresh_approval_ref: "approval-fallback-1",
		fresh_pre_dispatch_audit_ref: "audit-fresh-1",
		policy_eligibility_ref: "policy-eligible-1",
		runtime_compatibility_ref: "runtime-compatible-1",
		state: "requires_full_regate",
		automatic_fallback_authorized: false,
		dispatch_authority_enabled: false,
		providerCall: false,
		actualLaneLaunch: false,
		runtimeExecution: false,
		...overrides,
	};
}

function consumedApproval(
	overrides: Partial<FlowDeskProductionApprovalSourceV1> = {},
): FlowDeskProductionApprovalSourceV1 {
	return {
		schema_version: "flowdesk.production_approval_source.v1",
		approval_id: "approval-fallback-1",
		workflow_id: "workflow-1",
		attempt_id: "attempt-2",
		action_type: "fallback_reselection",
		issuer_boundary: "external_user_confirmation",
		approval_method: "typed_phrase",
		actor_ref: "actor-user-1",
		profile_ref: "profile-prod-1",
		provider_qualified_model_id: "openai/gpt-5.5",
		provider_binding_hash: "hash-provider-binding-1",
		evidence_bundle_hash: "hash-evidence-bundle-1",
		guard_decision_ref: "guard-decision-1",
		issuance_audit_ref: "audit-issuance-1",
		nonce_ref: "nonce-1",
		issued_at: "2026-05-22T00:00:00.000Z",
		expires_at: "2026-05-22T01:00:00.000Z",
		revoked: false,
		consumed_at: "2026-05-22T00:05:00.000Z",
		consumed_by_attempt_id: "attempt-2",
		consumption_audit_ref: "audit-consumption-1",
		consume_strategy: "atomic_compare_and_swap_required",
		dispatch_authority_enabled: false,
		...overrides,
	};
}

test("fallback regate plan requires full fresh gate without switching providers", () => {
	const result = planFlowDeskFallbackRegateV1({
		decision: decision(),
		consumedApproval: consumedApproval(),
	});

	assert.equal(result.ok, true, result.errors.join("; "));
	assert.equal(result.state, "full_regate_required");
	assert.equal(result.workflow_id, "workflow-1");
	assert.equal(result.parent_attempt_id, "attempt-1");
	assert.equal(result.new_attempt_id, "attempt-2");
	assert.equal(result.required_guard_decision_ref, "guard-fresh-1");
	assert.equal(result.required_approval_ref, "approval-fallback-1");
	assert.equal(result.consumed_fallback_approval_ref, "approval-fallback-1");
	assert.deepEqual(result.required_fresh_evidence_refs, [
		"usage-fresh-1",
		"health-fresh-1",
		"runtime-fresh-1",
	]);
	assert.deepEqual(result.safe_next_actions, ["/flowdesk-status", "/flowdesk-run"]);
	assert.equal(result.automatic_fallback_authorized, false);
	assert.equal(result.provider_switch_attempted, false);
	assert.equal(result.dispatch_authority_enabled, false);
	assert.equal(result.realOpenCodeDispatch, false);
	assert.equal(result.providerCall, false);
	assert.equal(result.actualLaneLaunch, false);
	assert.equal(result.runtimeExecution, false);
});

test("fallback regate plan blocks terminal, approval drift, and fallback-derived evidence", () => {
	const terminal = planFlowDeskFallbackRegateV1({
		decision: decision({ depth: 2, state: "blocked_terminal" }),
		consumedApproval: consumedApproval(),
	});
	assert.equal(terminal.ok, false);
	assert.equal(terminal.state, "blocked");
	assert.deepEqual(terminal.safe_next_actions, ["/flowdesk-status"]);
	assert.equal(terminal.provider_switch_attempted, false);
	assert.match(terminal.errors.join("; "), /requires_full_regate|max-depth/);

	const approvalDrift = planFlowDeskFallbackRegateV1({
		decision: decision(),
		consumedApproval: consumedApproval({ approval_id: "approval-other-1" }),
	});
	assert.equal(approvalDrift.ok, false);
	assert.match(approvalDrift.errors.join("; "), /approval ref mismatch/);

	const fallbackDerived = planFlowDeskFallbackRegateV1({
		decision: decision({
			fresh_evidence_refs: ["usage-fresh-1", "health-fresh-1", "fallback-derived-runtime-1"],
		}),
		consumedApproval: consumedApproval(),
	});
	assert.equal(fallbackDerived.ok, false);
	assert.match(fallbackDerived.errors.join("; "), /fallback-derived/);
	assert.equal(fallbackDerived.providerCall, false);
});
