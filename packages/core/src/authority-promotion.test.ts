import assert from "node:assert/strict";
import test from "node:test";
import type {
	FlowDeskControlledExternalWriteRequestV1,
	FlowDeskDispatchAttemptPrecallEvaluationV1,
	FlowDeskFallbackDecisionV1,
	FlowDeskProductionApprovalSourceV1,
	FlowDeskTopTierReviewVerdictV1,
	GuardBoundaryDecisionV1,
} from "./index.js";
import {
	consumeFlowDeskProductionApprovalSourceV1,
	promoteFlowDeskExternalWriteAuthorityV1,
	promoteFlowDeskFallbackReselectionRegateV1,
	promoteFlowDeskManagedDispatchBetaAuthorityV1,
	promoteFlowDeskReviewerTypedVerdictsV1,
	validateFlowDeskControlledExternalWriteRequestV1,
} from "./index.js";

function approval(
	actionType: FlowDeskProductionApprovalSourceV1["action_type"],
	overrides: Partial<FlowDeskProductionApprovalSourceV1> = {},
): FlowDeskProductionApprovalSourceV1 {
	return {
		schema_version: "flowdesk.production_approval_source.v1",
		approval_id: `approval-${actionType}`,
		workflow_id: "workflow-1",
		attempt_id: "attempt-1",
		action_type: actionType,
		issuer_boundary: "external_user_confirmation",
		approval_method: "typed_phrase",
		actor_ref: "actor-user-1",
		profile_ref: "profile-prod-1",
		provider_qualified_model_id: "claude/claude-opus-4-5",
		provider_binding_hash: "hash-provider-binding-1",
		evidence_bundle_hash: "hash-evidence-bundle-1",
		guard_decision_ref: "guard-decision-1",
		issuance_audit_ref: `audit-issuance-${actionType}`,
		nonce_ref: `nonce-${actionType}`,
		issued_at: "2026-05-21T00:00:00.000Z",
		expires_at: "2026-05-21T00:10:00.000Z",
		revoked: false,
		consume_strategy: "atomic_compare_and_swap_required",
		dispatch_authority_enabled: false,
		...overrides,
	};
}

function consumedApproval(
	actionType: FlowDeskProductionApprovalSourceV1["action_type"],
	overrides: Partial<FlowDeskProductionApprovalSourceV1> = {},
): FlowDeskProductionApprovalSourceV1 {
	const source = approval(actionType, overrides);
	const consumed = consumeFlowDeskProductionApprovalSourceV1({
		approval: source,
		workflowId: source.workflow_id,
		attemptId: source.attempt_id,
		actionType: source.action_type,
		actorRef: source.actor_ref,
		profileRef: source.profile_ref,
		providerQualifiedModelId: source.provider_qualified_model_id,
		providerBindingHash: source.provider_binding_hash,
		evidenceBundleHash: source.evidence_bundle_hash,
		guardDecisionRef: source.guard_decision_ref,
		consumptionAuditRef: `audit-consumption-${actionType}`,
		consumedAt: "2026-05-21T00:05:00.000Z",
	});
	assert.ok(consumed.consumed_approval, consumed.errors.join("; "));
	return consumed.consumed_approval;
}

function guardDecision(
	overrides: Partial<GuardBoundaryDecisionV1> = {},
): GuardBoundaryDecisionV1 {
	return {
		status: "eligible",
		reason_category: "runtime",
		redacted_reason: "eligible managed dispatch beta gate",
		required_checks: [
			{ check: "audit", result: "pass", ref: "audit-predispatch-1" },
			{ check: "conformance", result: "pass", ref: "conformance-runtime-1" },
			{ check: "approval", result: "pass", ref: "guard-decision-1" },
		],
		safe_next_actions: ["/flowdesk-doctor", "/flowdesk-status"],
		...overrides,
	};
}

function precall(
	overrides: Partial<FlowDeskDispatchAttemptPrecallEvaluationV1> = {},
): FlowDeskDispatchAttemptPrecallEvaluationV1 {
	return {
		schema_version: "flowdesk.dispatch_attempt_precall_evaluation.v1",
		workflow_id: "workflow-1",
		attempt_id: "attempt-1",
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
		...overrides,
	};
}

function verdict(
	perspective: FlowDeskTopTierReviewVerdictV1["perspective"],
	overrides: Partial<FlowDeskTopTierReviewVerdictV1> = {},
): FlowDeskTopTierReviewVerdictV1 {
	return {
		schema_version: "flowdesk.top_tier_review_verdict.v1",
		verdict_id: `verdict-${perspective}`,
		workflow_id: "workflow-1",
		lane_plan_ref: `lane-plan-${perspective}`,
		binding_ref: "binding-claude_opus",
		perspective,
		source: "claude_opus",
		created_at: "2026-05-21T00:00:00.000Z",
		redaction_version: "redaction-v1",
		findings: [],
		evidence_refs: [`review-evidence-${perspective}`],
		uncertainty: "low",
		required_fixes: [],
		verdict_label: "pass",
		safe_next_actions: ["/flowdesk-status"],
		dispatch_authority_enabled: false,
		...overrides,
	};
}

function canonicalVerdicts(): FlowDeskTopTierReviewVerdictV1[] {
	return [
		verdict("policy_security"),
		verdict("architecture"),
		verdict("verification_implementation"),
	];
}

function fallbackDecision(
	overrides: Partial<FlowDeskFallbackDecisionV1> = {},
): FlowDeskFallbackDecisionV1 {
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
		fresh_approval_ref: "approval-fallback_reselection",
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

function externalWriteRequest(
	overrides: Partial<FlowDeskControlledExternalWriteRequestV1> = {},
): FlowDeskControlledExternalWriteRequestV1 {
	return {
		schema_version: "flowdesk.controlled_external_write_request.v1",
		request_id: "external-write-1",
		workflow_id: "workflow-1",
		attempt_id: "attempt-1",
		target_kind: "redacted_audit_export",
		target_ref: "redacted-audit-export-1",
		redaction_policy_ref: "redaction-policy-1",
		content_hash_ref: "hash-content-1",
		pre_write_audit_ref: "audit-prewrite-1",
		dry_run_ref: "dry-run-1",
		created_at: "2026-05-21T00:00:00.000Z",
		external_write_authority_enabled: false,
		dispatch_authority_enabled: false,
		providerCall: false,
		actualLaneLaunch: false,
		runtimeExecution: false,
		...overrides,
	};
}

test("managed dispatch promotion enables only scoped beta authority", () => {
	const result = promoteFlowDeskManagedDispatchBetaAuthorityV1({
		guardDecision: guardDecision(),
		precallEvaluation: precall(),
		consumedApproval: consumedApproval("managed_dispatch_beta"),
		auditRef: "audit-predispatch-1",
		conformanceRef: "conformance-runtime-1",
	});
	assert.equal(result.ok, true, result.errors.join("; "));
	assert.equal(result.state, "managed_dispatch_beta_authority_enabled");
	assert.equal(result.managed_dispatch_beta_authority_enabled, true);
	assert.equal(result.dispatch_authority_enabled, false);
	assert.equal(result.realOpenCodeDispatch, false);
	assert.equal(result.providerCall, false);
	assert.equal(result.actualLaneLaunch, false);
});

test("managed dispatch promotion blocks missing evidence, wrong action, and smuggled authority", () => {
	const missingEvidence = promoteFlowDeskManagedDispatchBetaAuthorityV1({
		guardDecision: guardDecision({ required_checks: [{ check: "audit", result: "pass", ref: "audit-predispatch-1" }] }),
		precallEvaluation: precall({ sdk_call_permitted: false, state: "blocked_before_sdk_call", blocked_labels: ["approval_missing"] }),
		consumedApproval: consumedApproval("managed_dispatch_beta"),
		auditRef: "audit-predispatch-1",
		conformanceRef: "conformance-runtime-1",
	});
	assert.equal(missingEvidence.ok, false);
	assert.match(missingEvidence.errors.join("|"), /conformance|sdk_call_permitted|blocked labels/);

	const wrongAction = promoteFlowDeskManagedDispatchBetaAuthorityV1({
		guardDecision: guardDecision(),
		precallEvaluation: precall(),
		consumedApproval: consumedApproval("reviewer_fanout"),
		auditRef: "audit-predispatch-1",
		conformanceRef: "conformance-runtime-1",
	});
	assert.equal(wrongAction.ok, false);
	assert.match(wrongAction.errors.join("; "), /action_type mismatch/);

	const smuggled = promoteFlowDeskManagedDispatchBetaAuthorityV1({
		guardDecision: { ...guardDecision(), approve_dispatch: true } as unknown as GuardBoundaryDecisionV1,
		precallEvaluation: precall(),
		consumedApproval: consumedApproval("managed_dispatch_beta"),
		auditRef: "audit-predispatch-1",
		conformanceRef: "conformance-runtime-1",
	});
	assert.equal(smuggled.ok, false);
	assert.match(smuggled.errors.join("; "), /authority-smuggling|unknown properties/);
});

test("reviewer typed verdict promotion accepts only all canonical passing low-uncertainty verdicts", () => {
	const result = promoteFlowDeskReviewerTypedVerdictsV1({
		workflowId: "workflow-1",
		attemptId: "attempt-1",
		verdicts: canonicalVerdicts(),
		consumedApproval: consumedApproval("reviewer_fanout"),
	});
	assert.equal(result.ok, true, result.errors.join("; "));
	assert.equal(result.state, "typed_verdicts_accepted");
	assert.equal(result.typed_reviewer_verdict_acceptance_enabled, true);
	assert.equal(result.managed_dispatch_beta_authority_enabled, false);
	assert.equal(result.external_write_authority_enabled, false);
	assert.deepEqual(result.accepted_perspectives, ["policy_security", "architecture", "verification_implementation"]);
});

test("reviewer typed verdict promotion blocks non-pass, inconclusive, duplicate, missing, and wrong approval", () => {
	const nonPass = promoteFlowDeskReviewerTypedVerdictsV1({
		workflowId: "workflow-1",
		attemptId: "attempt-1",
		verdicts: canonicalVerdicts().map((entry) => entry.perspective === "architecture" ? verdict("architecture", { verdict_label: "changes_required" }) : entry),
		consumedApproval: consumedApproval("reviewer_fanout"),
	});
	assert.equal(nonPass.ok, false);
	assert.match(nonPass.errors.join("; "), /verdict_label must be pass/);

	const inconclusive = promoteFlowDeskReviewerTypedVerdictsV1({
		workflowId: "workflow-1",
		attemptId: "attempt-1",
		verdicts: canonicalVerdicts().map((entry) => entry.perspective === "policy_security" ? verdict("policy_security", { verdict_label: "inconclusive", uncertainty: "high" }) : entry),
		consumedApproval: consumedApproval("reviewer_fanout"),
	});
	assert.equal(inconclusive.ok, false);
	assert.match(inconclusive.errors.join("; "), /verdict_label must be pass|uncertainty must be low/);

	const duplicate = promoteFlowDeskReviewerTypedVerdictsV1({
		workflowId: "workflow-1",
		attemptId: "attempt-1",
		verdicts: [verdict("policy_security"), verdict("policy_security", { verdict_id: "verdict-duplicate" }), verdict("architecture")],
		consumedApproval: consumedApproval("reviewer_fanout"),
	});
	assert.equal(duplicate.ok, false);
	assert.match(duplicate.errors.join("; "), /perspective must be distinct|missing required reviewer perspective/);

	const missing = promoteFlowDeskReviewerTypedVerdictsV1({
		workflowId: "workflow-1",
		attemptId: "attempt-1",
		verdicts: [verdict("policy_security"), verdict("architecture")],
		consumedApproval: consumedApproval("reviewer_fanout"),
	});
	assert.equal(missing.ok, false);
	assert.match(missing.errors.join("; "), /missing required reviewer perspective/);

	const malformed = promoteFlowDeskReviewerTypedVerdictsV1({
		workflowId: "workflow-1",
		attemptId: "attempt-1",
		verdicts: "not-an-array" as unknown as FlowDeskTopTierReviewVerdictV1[],
		consumedApproval: consumedApproval("reviewer_fanout"),
	});
	assert.equal(malformed.ok, false);
	assert.match(malformed.errors.join("; "), /verdicts must be an array/);

	const malformedEntry = promoteFlowDeskReviewerTypedVerdictsV1({
		workflowId: "workflow-1",
		attemptId: "attempt-1",
		verdicts: [{ verdict_id: "not-enough" } as unknown as FlowDeskTopTierReviewVerdictV1],
		consumedApproval: consumedApproval("reviewer_fanout"),
	});
	assert.equal(malformedEntry.ok, false);
	assert.match(malformedEntry.errors.join("; "), /schema_version|missing required reviewer perspective/);

	const wrongApproval = promoteFlowDeskReviewerTypedVerdictsV1({
		workflowId: "workflow-1",
		attemptId: "attempt-1",
		verdicts: canonicalVerdicts(),
		consumedApproval: consumedApproval("external_write"),
	});
	assert.equal(wrongApproval.ok, false);
	assert.match(wrongApproval.errors.join("; "), /action_type mismatch/);
});

test("fallback reselection promotion enables only regate authority", () => {
	const result = promoteFlowDeskFallbackReselectionRegateV1({
		decision: fallbackDecision(),
		consumedApproval: consumedApproval("fallback_reselection", { attempt_id: "attempt-2" }),
	});
	assert.equal(result.ok, true, result.errors.join("; "));
	assert.equal(result.state, "reselection_regate_authority_enabled");
	assert.equal(result.fallback_reselection_regate_authority_enabled, true);
	assert.equal(result.automatic_fallback_authorized, false);
	assert.equal(result.providerCall, false);
	assert.equal(result.actualLaneLaunch, false);
});

test("fallback reselection promotion blocks terminal max-depth and automatic fallback", () => {
	const terminal = promoteFlowDeskFallbackReselectionRegateV1({
		decision: fallbackDecision({ depth: 2, state: "blocked_terminal" }),
		consumedApproval: consumedApproval("fallback_reselection", { attempt_id: "attempt-2" }),
	});
	assert.equal(terminal.ok, false);
	assert.match(terminal.errors.join("; "), /requires_full_regate/);

	const automatic = promoteFlowDeskFallbackReselectionRegateV1({
		decision: fallbackDecision({ automatic_fallback_authorized: true as unknown as false }),
		consumedApproval: consumedApproval("fallback_reselection", { attempt_id: "attempt-2" }),
	});
	assert.equal(automatic.ok, false);
	assert.match(automatic.errors.join("; "), /automatic fallback|runtime authority/);
});

test("external write promotion accepts only controlled redacted targets", () => {
	const request = externalWriteRequest({ target_kind: "release_conformance_doc", target_ref: "release-conformance-doc-1" });
	const validation = validateFlowDeskControlledExternalWriteRequestV1(request);
	assert.equal(validation.ok, true, validation.errors.join("; "));

	const result = promoteFlowDeskExternalWriteAuthorityV1({
		request,
		consumedApproval: consumedApproval("external_write"),
	});
	assert.equal(result.ok, true, result.errors.join("; "));
	assert.equal(result.state, "external_write_authority_enabled");
	assert.equal(result.external_write_authority_enabled, true);
	assert.equal(result.target_kind, "release_conformance_doc");
	assert.equal(result.dispatch_authority_enabled, false);
	assert.equal(result.providerCall, false);
});

test("external write promotion rejects forbidden targets, missing refs, approval mismatch, raw payloads, and smuggling", () => {
	const forbiddenTarget = validateFlowDeskControlledExternalWriteRequestV1(externalWriteRequest({ target_kind: "github_repo" as FlowDeskControlledExternalWriteRequestV1["target_kind"] }));
	assert.equal(forbiddenTarget.ok, false);
	assert.match(forbiddenTarget.errors.join("; "), /target_kind/);

	const rawPath = validateFlowDeskControlledExternalWriteRequestV1(externalWriteRequest({ target_ref: "github/path-target" }));
	assert.equal(rawPath.ok, false);
	assert.match(rawPath.errors.join("; "), /GitHub|raw path marker/);

	const missingDryRun = validateFlowDeskControlledExternalWriteRequestV1({ ...externalWriteRequest(), dry_run_ref: undefined });
	assert.equal(missingDryRun.ok, false);
	assert.match(missingDryRun.errors.join("; "), /dry_run_ref/);

	const rawPayload = validateFlowDeskControlledExternalWriteRequestV1(externalWriteRequest({ target_ref: "provider-payload-export" }));
	assert.equal(rawPayload.ok, false);
	assert.match(rawPayload.errors.join("; "), /raw payload|prompt-like/);

	const smuggled = validateFlowDeskControlledExternalWriteRequestV1({ ...externalWriteRequest(), github_write_authority_enabled: true });
	assert.equal(smuggled.ok, false);
	assert.match(smuggled.errors.join("; "), /authority-smuggling|unknown properties/);

	const mismatch = promoteFlowDeskExternalWriteAuthorityV1({
		request: externalWriteRequest(),
		consumedApproval: consumedApproval("managed_dispatch_beta"),
	});
	assert.equal(mismatch.ok, false);
	assert.match(mismatch.errors.join("; "), /action_type mismatch/);
});
