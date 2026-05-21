import assert from "node:assert/strict";
import test from "node:test";
import {
	consumeFlowDeskProductionApprovalSourceV1,
	validateFlowDeskProductionApprovalSourceV1,
	type FlowDeskProductionApprovalSourceV1,
} from "./index.js";

function approval(
	overrides: Partial<FlowDeskProductionApprovalSourceV1> = {},
): FlowDeskProductionApprovalSourceV1 {
	return {
		schema_version: "flowdesk.production_approval_source.v1",
		approval_id: "approval-1",
		workflow_id: "workflow-1",
		attempt_id: "attempt-1",
		action_type: "managed_dispatch_beta",
		issuer_boundary: "external_user_confirmation",
		approval_method: "typed_phrase",
		actor_ref: "actor-user-1",
		profile_ref: "profile-prod-1",
		provider_qualified_model_id: "claude/claude-opus-4-5",
		provider_binding_hash: "hash-provider-binding-1",
		evidence_bundle_hash: "hash-evidence-bundle-1",
		guard_decision_ref: "guard-decision-1",
		issuance_audit_ref: "audit-issuance-1",
		nonce_ref: "nonce-1",
		issued_at: "2026-05-21T00:00:00.000Z",
		expires_at: "2026-05-21T00:10:00.000Z",
		revoked: false,
		consume_strategy: "atomic_compare_and_swap_required",
		dispatch_authority_enabled: false,
		...overrides,
	};
}

test("production approval source validates scoped non-authorizing issuance", () => {
	const result = validateFlowDeskProductionApprovalSourceV1(
		approval(),
		"workflow-1",
	);
	assert.equal(result.ok, true, result.errors.join("; "));
});

test("production approval source rejects forged authority, aliases, and unknown properties", () => {
	const forged = validateFlowDeskProductionApprovalSourceV1({
		...approval(),
		provider_qualified_model_id: "claude/latest",
		dispatch_authority_enabled: true,
		approve_dispatch: true,
	});
	assert.equal(forged.ok, false);
	const errors = forged.errors.join("|");
	assert.match(errors, /unknown properties: approve_dispatch/);
	assert.match(errors, /concrete non-alias/);
	assert.match(errors, /cannot enable dispatch authority/);
});

test("production approval source enforces issuer method and consumption timing", () => {
	const incompatibleTypedPhrase = validateFlowDeskProductionApprovalSourceV1(
		approval({ issuer_boundary: "external_signed_intent" }),
	);
	assert.equal(incompatibleTypedPhrase.ok, false);
	assert.match(incompatibleTypedPhrase.errors.join("; "), /typed_phrase/);

	const incompatibleSignedIntent = validateFlowDeskProductionApprovalSourceV1(
		approval({ approval_method: "signed_intent" }),
	);
	assert.equal(incompatibleSignedIntent.ok, false);
	assert.match(incompatibleSignedIntent.errors.join("; "), /signed_intent/);

	const earlyConsume = consumeFlowDeskProductionApprovalSourceV1({
		approval: approval(),
		workflowId: "workflow-1",
		attemptId: "attempt-1",
		actionType: "managed_dispatch_beta",
		actorRef: "actor-user-1",
		profileRef: "profile-prod-1",
		providerQualifiedModelId: "claude/claude-opus-4-5",
		providerBindingHash: "hash-provider-binding-1",
		evidenceBundleHash: "hash-evidence-bundle-1",
		guardDecisionRef: "guard-decision-1",
		consumptionAuditRef: "audit-consumption-1",
		consumedAt: "2026-05-20T23:59:00.000Z",
	});
	assert.equal(earlyConsume.ok, false);
	assert.match(earlyConsume.errors.join("; "), /after issued_at/);

	const reusedAudit = consumeFlowDeskProductionApprovalSourceV1({
		approval: approval(),
		workflowId: "workflow-1",
		attemptId: "attempt-1",
		actionType: "managed_dispatch_beta",
		actorRef: "actor-user-1",
		profileRef: "profile-prod-1",
		providerQualifiedModelId: "claude/claude-opus-4-5",
		providerBindingHash: "hash-provider-binding-1",
		evidenceBundleHash: "hash-evidence-bundle-1",
		guardDecisionRef: "guard-decision-1",
		consumptionAuditRef: "audit-issuance-1",
		consumedAt: "2026-05-21T00:05:00.000Z",
	});
	assert.equal(reusedAudit.ok, false);
	assert.match(reusedAudit.errors.join("; "), /differ from issuance audit/);
});

test("production approval source consumes exactly once with full scope binding", () => {
	const source = approval();
	const consumed = consumeFlowDeskProductionApprovalSourceV1({
		approval: source,
		workflowId: "workflow-1",
		attemptId: "attempt-1",
		actionType: "managed_dispatch_beta",
		actorRef: "actor-user-1",
		profileRef: "profile-prod-1",
		providerQualifiedModelId: "claude/claude-opus-4-5",
		providerBindingHash: "hash-provider-binding-1",
		evidenceBundleHash: "hash-evidence-bundle-1",
		guardDecisionRef: "guard-decision-1",
		consumptionAuditRef: "audit-consumption-1",
		consumedAt: "2026-05-21T00:05:00.000Z",
	});
	assert.equal(consumed.ok, true, consumed.errors.join("; "));
	assert.equal(consumed.state, "consumed");
	assert.equal(consumed.providerCall, false);
	assert.equal(consumed.dispatch_authority_enabled, false);
	assert.equal(consumed.consumed_approval?.consumed_by_attempt_id, "attempt-1");

	const replay = consumeFlowDeskProductionApprovalSourceV1({
		approval: consumed.consumed_approval ?? source,
		workflowId: "workflow-1",
		attemptId: "attempt-1",
		actionType: "managed_dispatch_beta",
		actorRef: "actor-user-1",
		profileRef: "profile-prod-1",
		providerQualifiedModelId: "claude/claude-opus-4-5",
		providerBindingHash: "hash-provider-binding-1",
		evidenceBundleHash: "hash-evidence-bundle-1",
		guardDecisionRef: "guard-decision-1",
		consumptionAuditRef: "audit-consumption-2",
		consumedAt: "2026-05-21T00:06:00.000Z",
	});
	assert.equal(replay.ok, false);
	assert.match(replay.errors.join("; "), /already consumed/);
});

test("production approval source blocks drift, revocation, and expiry", () => {
	const drift = consumeFlowDeskProductionApprovalSourceV1({
		approval: approval(),
		workflowId: "workflow-1",
		attemptId: "attempt-2",
		actionType: "managed_dispatch_beta",
		actorRef: "actor-user-1",
		profileRef: "profile-prod-1",
		providerQualifiedModelId: "claude/claude-opus-4-5",
		providerBindingHash: "hash-provider-binding-1",
		evidenceBundleHash: "hash-evidence-bundle-1",
		guardDecisionRef: "guard-decision-1",
		consumptionAuditRef: "audit-consumption-1",
		consumedAt: "2026-05-21T00:05:00.000Z",
	});
	assert.equal(drift.ok, false);
	assert.match(drift.errors.join("; "), /attempt_id mismatch/);

	const revoked = consumeFlowDeskProductionApprovalSourceV1({
		approval: approval({ revoked: true }),
		workflowId: "workflow-1",
		attemptId: "attempt-1",
		actionType: "managed_dispatch_beta",
		actorRef: "actor-user-1",
		profileRef: "profile-prod-1",
		providerQualifiedModelId: "claude/claude-opus-4-5",
		providerBindingHash: "hash-provider-binding-1",
		evidenceBundleHash: "hash-evidence-bundle-1",
		guardDecisionRef: "guard-decision-1",
		consumptionAuditRef: "audit-consumption-1",
		consumedAt: "2026-05-21T00:05:00.000Z",
	});
	assert.equal(revoked.ok, false);
	assert.match(revoked.errors.join("; "), /revoked/);

	const expired = consumeFlowDeskProductionApprovalSourceV1({
		approval: approval(),
		workflowId: "workflow-1",
		attemptId: "attempt-1",
		actionType: "managed_dispatch_beta",
		actorRef: "actor-user-1",
		profileRef: "profile-prod-1",
		providerQualifiedModelId: "claude/claude-opus-4-5",
		providerBindingHash: "hash-provider-binding-1",
		evidenceBundleHash: "hash-evidence-bundle-1",
		guardDecisionRef: "guard-decision-1",
		consumptionAuditRef: "audit-consumption-1",
		consumedAt: "2026-05-21T00:10:00.000Z",
	});
	assert.equal(expired.ok, false);
	assert.match(expired.errors.join("; "), /expired/);
});

test("production approval source rejects consumed-state drift", () => {
	const result = validateFlowDeskProductionApprovalSourceV1(
		approval({
			consumed_at: "2026-05-21T00:05:00.000Z",
			consumed_by_attempt_id: "attempt-other",
			consumption_audit_ref: "audit-consumption-1",
		}),
	);
	assert.equal(result.ok, false);
	assert.match(result.errors.join("; "), /consumed_by_attempt_id/);
});
