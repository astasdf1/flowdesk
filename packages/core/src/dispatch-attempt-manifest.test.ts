import assert from "node:assert/strict";
import test from "node:test";
import {
	consumeFlowDeskProductionApprovalSourceV1,
	evaluateFlowDeskDispatchAttemptPrecallV1,
	validateFlowDeskDispatchAttemptManifestV1,
	type FlowDeskDispatchAttemptManifestV1,
	type FlowDeskProductionApprovalSourceV1,
} from "./index.js";

function approval(): FlowDeskProductionApprovalSourceV1 {
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
	};
}

function consumedApproval(): FlowDeskProductionApprovalSourceV1 {
	const consumed = consumeFlowDeskProductionApprovalSourceV1({
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
		consumedAt: "2026-05-21T00:05:00.000Z",
	});
	assert.ok(consumed.consumed_approval);
	return consumed.consumed_approval;
}

function manifest(
	overrides: Partial<FlowDeskDispatchAttemptManifestV1> = {},
): FlowDeskDispatchAttemptManifestV1 {
	return {
		schema_version: "flowdesk.dispatch_attempt_manifest.v1",
		workflow_id: "workflow-1",
		attempt_id: "attempt-1",
		state: "approval_consumed",
		actor_ref: "actor-user-1",
		profile_ref: "profile-prod-1",
		provider_qualified_model_id: "claude/claude-opus-4-5",
		provider_binding_hash: "hash-provider-binding-1",
		evidence_bundle_hash: "hash-evidence-bundle-1",
		evidence_refs: ["usage-ref-1", "runtime-echo-1", "telemetry-1"],
		approval_ref: "approval-1",
		consumed_approval_ref: "approval-1",
		guard_decision_ref: "guard-decision-1",
		pre_dispatch_audit_ref: "audit-predispatch-1",
		pre_dispatch_audit_committed: true,
		idempotency_key: "idempotency-1",
		created_at: "2026-05-21T00:04:00.000Z",
		updated_at: "2026-05-21T00:05:00.000Z",
		dispatch_authority_enabled: false,
		realOpenCodeDispatch: false,
		actualLaneLaunch: false,
		providerCall: false,
		runtimeExecution: false,
		...overrides,
	};
}

test("dispatch attempt manifest validates a committed pre-call work unit", () => {
	const result = validateFlowDeskDispatchAttemptManifestV1(manifest(), "workflow-1");
	assert.equal(result.ok, true, result.errors.join("; "));
});

test("dispatch attempt manifest rejects authority smuggling and uncommitted sdk-ready state", () => {
	const result = validateFlowDeskDispatchAttemptManifestV1({
		...manifest({
			state: "sdk_call_permitted",
			consumed_approval_ref: undefined,
			pre_dispatch_audit_committed: false,
		}),
		providerCall: true,
		approve_dispatch: true,
	});
	assert.equal(result.ok, false);
	const errors = result.errors.join("|");
	assert.match(errors, /unknown properties: approve_dispatch/);
	assert.match(errors, /committed audit/);
	assert.match(errors, /cannot enable runtime authority/);
});

test("dispatch attempt pre-call evaluation permits only committed audit plus consumed scoped approval", () => {
	const result = evaluateFlowDeskDispatchAttemptPrecallV1({
		manifest: manifest(),
		consumedApproval: consumedApproval(),
	});
	assert.equal(result.ok, true, result.errors.join("; "));
	assert.equal(result.sdk_call_permitted, true);
	assert.equal(result.providerCall, false);
	assert.equal(result.dispatch_authority_enabled, false);
});

test("dispatch attempt pre-call evaluation blocks missing audit and approval drift", () => {
	const result = evaluateFlowDeskDispatchAttemptPrecallV1({
		manifest: manifest({
			pre_dispatch_audit_committed: false,
			provider_binding_hash: "hash-provider-binding-other",
		}),
		consumedApproval: consumedApproval(),
	});
	assert.equal(result.sdk_call_permitted, false);
	assert.equal(result.state, "blocked_before_sdk_call");
	assert.ok(result.blocked_labels.includes("pre_dispatch_audit_not_committed"));
	assert.ok(result.blocked_labels.includes("approval_provider_binding_mismatch"));
});
