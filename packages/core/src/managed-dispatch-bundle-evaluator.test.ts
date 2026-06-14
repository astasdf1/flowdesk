import assert from "node:assert/strict";
import test from "node:test";
import type {
	FlowDeskAuthorityPromotionResultV1,
	FlowDeskDefaultManagedDispatchAuthorizationV1,
	FlowDeskDefaultManagedDispatchPromotionReadinessV1,
	FlowDeskDispatchAttemptDurablePrecallEvaluationV1,
	FlowDeskManagedDispatchBundleEvaluatorInputV1,
	FlowDeskManagedDispatchBundleItemV1,
	FlowDeskManagedDispatchObservedTerminalEvidenceV1,
	FlowDeskProductionEnablementEvaluationV1,
	GuardBoundaryDecisionV1,
} from "./index.js";
import {
	evaluateFlowDeskManagedDispatchBundleV1,
	FLOWDESK_MANAGED_DISPATCH_BUNDLE_ITEMS,
} from "./index.js";

const workflowId = "workflow-bundle-1";
const attemptId = "attempt-bundle-1";

function production(
	overrides: Partial<FlowDeskProductionEnablementEvaluationV1> = {},
): FlowDeskProductionEnablementEvaluationV1 {
	return {
		schema_version: "flowdesk.production_enablement_evaluation.v1",
		workflow_id: workflowId,
		ok: true,
		errors: [],
		state: "dispatch_capable",
		blocker_labels: [],
		uncertainty_labels: [],
		evidence_refs: ["evidence-prod-1"],
		doctor_state_ref: "doctor-prod-1",
		managed_dispatch_ready: true,
		managed_dispatch_ready_basis: "all_evidence_present",
		dispatch_authority_enabled: false,
		default_release1_non_dispatch_preserved: true,
		safe_next_actions: ["/flowdesk-status"],
		configured_verification_result: "passed",
		configured_verification_ref: "verification-1",
		sanitized_auth_capture_result: "passed",
		sanitized_auth_capture_ref: "sanitized-auth-1",
		external_auth_provider_policy_result: "passed",
		external_auth_policy_ref: "external-auth-policy-1",
		provider_policy_ref: "provider-policy-1",
		approval_decision: "approve",
		approval_ref: "approval-1",
		plugin_satisfiable_gate_passed: true,
		...overrides,
	};
}

function authorization(
	overrides: Partial<FlowDeskDefaultManagedDispatchAuthorizationV1> = {},
): FlowDeskDefaultManagedDispatchAuthorizationV1 {
	return {
		schema_version: "flowdesk.default_managed_dispatch_authorization.v1",
		authorization_id: "authorization-1",
		workflow_id: workflowId,
		ok: true,
		errors: [],
		state: "authorized",
		blocked_labels: [],
		readiness_ref: "readiness-1",
		actor_ref: "actor-user-1",
		profile_ref: "profile-prod-1",
		release_gate_ref: "release-gate-1",
		rollback_ref: "rollback-1",
		created_at: "2026-06-15T00:00:00.000Z",
		expires_at: "2026-06-15T00:10:00.000Z",
		default_enablement_requested: true,
		kill_switch_state: "inactive",
		default_managed_dispatch_authority_enabled: true,
		dispatch_authority_enabled: false,
		providerCall: false,
		actualLaneLaunch: false,
		runtimeExecution: false,
		safe_next_actions: ["/flowdesk-status"],
		...overrides,
	};
}

function readiness(
	overrides: Partial<FlowDeskDefaultManagedDispatchPromotionReadinessV1> = {},
): FlowDeskDefaultManagedDispatchPromotionReadinessV1 {
	return {
		schema_version: "flowdesk.default_managed_dispatch_promotion_readiness.v1",
		workflow_id: workflowId,
		ok: true,
		errors: [],
		state: "default_candidate",
		blocked_labels: [],
		evidence_refs: ["durable-precall-1", "adapter-profile-1", "sdk-client-1", "release2-gate-1"],
		production_enablement_state: "dispatch_capable",
		managed_dispatch_ready: true,
		durable_precall_ready: true,
		adapter_available: true,
		sdk_client_available: true,
		doctor_status_ref: "doctor-readiness-1",
		default_dispatch_candidate: true,
		dispatch_authority_enabled: false,
		providerCall: false,
		actualLaneLaunch: false,
		runtimeExecution: false,
		safe_next_actions: ["/flowdesk-status"],
		release2_managed_dispatch_gate_ready: true,
		release2_gate_readiness_ref: "release2-gate-1",
		...overrides,
	};
}

function guard(
	overrides: Partial<GuardBoundaryDecisionV1> = {},
): GuardBoundaryDecisionV1 {
	return {
		status: "eligible",
		reason_category: "runtime",
		redacted_reason: "eligible",
		required_checks: [
			{ check: "policy", result: "pass", ref: "policy-1" },
			{ check: "conformance", result: "pass", ref: "binding-1" },
			{ check: "usage", result: "pass", ref: "usage-1" },
			{ check: "provider_health", result: "pass", ref: "provider-health-1" },
			{ check: "runtime_compatibility", result: "pass", ref: "runtime-capability-1" },
			{ check: "approval", result: "pass", ref: "guard-approval-1" },
			{ check: "audit", result: "pass", ref: "audit-1" },
		],
		safe_next_actions: ["/flowdesk-doctor", "/flowdesk-status"],
		...overrides,
	};
}

function precall(
	overrides: Partial<FlowDeskDispatchAttemptDurablePrecallEvaluationV1> = {},
): FlowDeskDispatchAttemptDurablePrecallEvaluationV1 {
	return {
		schema_version: "flowdesk.dispatch_attempt_precall_evaluation.v1",
		workflow_id: workflowId,
		attempt_id: attemptId,
		ok: true,
		errors: [],
		state: "sdk_call_permitted",
		sdk_call_permitted: true,
		blocked_labels: [],
		dispatch_authority_enabled: false,
		realOpenCodeDispatch: false,
		actualLaneLaunch: false,
		providerCall: false,
		runtimeExecution: false,
		durable_provenance_required: true,
		reloaded_approval_source_ref: "approval-source-1",
		reloaded_pre_dispatch_audit_ref: "audit-1",
		reloaded_idempotency_snapshot_ref: "idempotency-1",
		...overrides,
	};
}

function promotion(
	overrides: Partial<FlowDeskAuthorityPromotionResultV1> = {},
): FlowDeskAuthorityPromotionResultV1 {
	return {
		schema_version: "flowdesk.authority_promotion_result.v1",
		workflow_id: workflowId,
		attempt_id: attemptId,
		promotion_kind: "managed_dispatch_beta",
		state: "managed_dispatch_beta_authority_enabled",
		ok: true,
		errors: [],
		managed_dispatch_beta_authority_enabled: true,
		typed_reviewer_verdict_acceptance_enabled: false,
		fallback_reselection_regate_authority_enabled: false,
		external_write_authority_enabled: false,
		dispatch_authority_enabled: false,
		automatic_fallback_authorized: false,
		realOpenCodeDispatch: false,
		providerCall: false,
		actualLaneLaunch: false,
		runtimeExecution: false,
		...overrides,
	};
}

function terminal(
	overrides: Partial<FlowDeskManagedDispatchObservedTerminalEvidenceV1> = {},
): FlowDeskManagedDispatchObservedTerminalEvidenceV1 {
	return {
		terminal_lifecycle_observed: true,
		terminal_result_or_status_observed: true,
		terminal_state: "complete",
		evidence_refs: ["lifecycle-1", "task-result-1", "status-1"],
		...overrides,
	};
}

function passingInput(
	overrides: Partial<FlowDeskManagedDispatchBundleEvaluatorInputV1> = {},
): FlowDeskManagedDispatchBundleEvaluatorInputV1 {
	return {
		productionEnablement: production(),
		defaultAuthorization: authorization(),
		promotionReadiness: readiness(),
		guardBoundaryDecision: guard(),
		durablePrecallEvaluation: precall(),
		authorityPromotion: promotion(),
		observedTerminalEvidence: terminal(),
		...overrides,
	};
}

function assertOnlyBlocked(
	item: FlowDeskManagedDispatchBundleItemV1,
	input: FlowDeskManagedDispatchBundleEvaluatorInputV1,
): void {
	const result = evaluateFlowDeskManagedDispatchBundleV1(input);
	assert.equal(result.gate_result, "blocked");
	assert.deepEqual(result.blocked_items, [item]);
	assert.equal(result.items.find((entry) => entry.item === item)?.status, "blocked");
}

test("managed dispatch bundle evaluator passes when all 12 items pass", () => {
	const result = evaluateFlowDeskManagedDispatchBundleV1(passingInput());
	assert.equal(result.gate_result, "pass");
	assert.equal(result.managed_dispatch_bundle_passed, true);
	assert.equal(result.items.length, 12);
	assert.deepEqual(
		result.items.map((entry) => entry.item),
		[...FLOWDESK_MANAGED_DISPATCH_BUNDLE_ITEMS],
	);
	assert.deepEqual(result.blocked_items, []);
	assert.equal(result.dispatch_authority_enabled, false);
	assert.equal(result.providerCall, false);
});

test("managed dispatch bundle evaluator blocks each item individually", () => {
	const cases: Array<[
		FlowDeskManagedDispatchBundleItemV1,
		FlowDeskManagedDispatchBundleEvaluatorInputV1,
	]> = [
		[
			"configured_authorization",
			passingInput({
				defaultAuthorization: authorization({
					state: "blocked",
					default_managed_dispatch_authority_enabled: false,
				}),
			}),
		],
		[
			"concrete_binding_policy_eligibility",
			passingInput({
				guardBoundaryDecision: guard({
					required_checks: [
						{ check: "policy", result: "fail", ref: "policy-1" },
						{ check: "conformance", result: "pass", ref: "binding-1" },
						{ check: "usage", result: "pass", ref: "usage-1" },
						{ check: "provider_health", result: "pass", ref: "provider-health-1" },
						{ check: "runtime_compatibility", result: "pass", ref: "runtime-capability-1" },
						{ check: "approval", result: "pass", ref: "guard-approval-1" },
					],
				}),
			}),
		],
		[
			"fresh_usage_provider_health",
			passingInput({
				productionEnablement: production({
					blocker_labels: ["provider_health_snapshot_not_fresh"],
				}),
			}),
		],
		[
			"sanitized_auth_capture",
			passingInput({
				productionEnablement: production({
					sanitized_auth_capture_result: "failed",
				}),
			}),
		],
		[
			"external_auth_provider_policy",
			passingInput({
				productionEnablement: production({
					external_auth_provider_policy_result: "failed",
				}),
			}),
		],
		[
			"configured_verification_sdk_compatibility",
			passingInput({
				productionEnablement: production({ configured_verification_result: "failed" }),
			}),
		],
		[
			"consumed_guard_user_approval",
			passingInput({
				durablePrecallEvaluation: precall({
					state: "blocked_before_sdk_call",
					sdk_call_permitted: false,
				}),
			}),
		],
		[
			"durable_pre_dispatch_audit",
			passingInput({
				durablePrecallEvaluation: precall({
					// Use a label that only affects durable_pre_dispatch_audit, not durable_reload_cross_reference_validation
					blocked_labels: ["pre_dispatch_audit_not_committed"],
				}),
			}),
		],
		[
			"dispatch_idempotency_reservation",
			passingInput({
				durablePrecallEvaluation: precall({
					// Use a label that only affects idempotency, not durable_reload_cross_reference_validation
					blocked_labels: ["idempotency_replay_blocked"],
				}),
			}),
		],
		[
			"intended_sdk_dispatch_path_adapter_capability",
			passingInput({
				promotionReadiness: readiness({ sdk_client_available: false }),
			}),
		],
		[
			"observed_lifecycle_result_status_terminal",
			passingInput({
				observedTerminalEvidence: terminal({ terminal_state: "unknown" }),
			}),
		],
		[
			"durable_reload_cross_reference_validation",
			passingInput({
				// item 12 requires reloaded_approval_source_ref !== undefined.
				// Items 7/8/9 do not check this ref, so they remain passing.
				durablePrecallEvaluation: precall({
					reloaded_approval_source_ref: undefined,
				}),
			}),
		],
	];

	assert.equal(cases.length, 12);
	for (const [item, input] of cases) assertOnlyBlocked(item, input);
});
