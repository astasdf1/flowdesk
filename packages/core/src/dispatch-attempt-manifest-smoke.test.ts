import assert from "node:assert/strict";
import test from "node:test";
import {
	consumeFlowDeskProductionApprovalSourceV1,
	evaluateFlowDeskDispatchAttemptDurablePrecallV1,
	type FlowDeskDispatchAttemptManifestV1,
	type FlowDeskDispatchIdempotencySnapshotV1,
	type FlowDeskProductionApprovalSourceV1,
	type FlowDeskSessionEvidenceReloadResultV1,
} from "./index.js";

function approval(): FlowDeskProductionApprovalSourceV1 {
	return {
		schema_version: "flowdesk.production_approval_source.v1",
		approval_id: "approval-smoke-1",
		workflow_id: "workflow-smoke-1",
		attempt_id: "attempt-smoke-1",
		action_type: "managed_dispatch_beta",
		issuer_boundary: "external_user_confirmation",
		approval_method: "typed_phrase",
		actor_ref: "actor-smoke-1",
		profile_ref: "profile-smoke-1",
		provider_qualified_model_id: "claude/claude-opus-4-5",
		provider_binding_hash: "hash-provider-binding-smoke-1",
		evidence_bundle_hash: "hash-evidence-bundle-smoke-1",
		guard_decision_ref: "guard-decision-smoke-1",
		issuance_audit_ref: "audit-issuance-smoke-1",
		nonce_ref: "nonce-smoke-1",
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
		workflowId: "workflow-smoke-1",
		attemptId: "attempt-smoke-1",
		actionType: "managed_dispatch_beta",
		actorRef: "actor-smoke-1",
		profileRef: "profile-smoke-1",
		providerQualifiedModelId: "claude/claude-opus-4-5",
		providerBindingHash: "hash-provider-binding-smoke-1",
		evidenceBundleHash: "hash-evidence-bundle-smoke-1",
		guardDecisionRef: "guard-decision-smoke-1",
		consumptionAuditRef: "audit-consumption-smoke-1",
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
		workflow_id: "workflow-smoke-1",
		attempt_id: "attempt-smoke-1",
		state: "approval_consumed",
		actor_ref: "actor-smoke-1",
		profile_ref: "profile-smoke-1",
		provider_qualified_model_id: "claude/claude-opus-4-5",
		provider_binding_hash: "hash-provider-binding-smoke-1",
		evidence_bundle_hash: "hash-evidence-bundle-smoke-1",
		evidence_refs: ["usage-smoke-1", "runtime-echo-smoke-1"],
		approval_ref: "approval-smoke-1",
		consumed_approval_ref: "approval-smoke-1",
		guard_decision_ref: "guard-decision-smoke-1",
		pre_dispatch_audit_ref: "audit-predispatch-smoke-1",
		pre_dispatch_audit_committed: true,
		idempotency_key: "idempotency-smoke-1",
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

function idempotencySnapshot(
	entries: FlowDeskDispatchIdempotencySnapshotV1["entries"] = [],
): FlowDeskDispatchIdempotencySnapshotV1 {
	return {
		schema_version: "flowdesk.dispatch_idempotency_snapshot.v1",
		workflow_id: "workflow-smoke-1",
		snapshot_ref: "idempotency-snapshot-smoke-1",
		observed_at: "2026-05-21T00:04:00.000Z",
		entries,
		dispatch_authority_enabled: false,
		realOpenCodeDispatch: false,
		actualLaneLaunch: false,
		providerCall: false,
		runtimeExecution: false,
	};
}

function reloadedEvidence(
	overrides: Partial<FlowDeskSessionEvidenceReloadResultV1> = {},
): FlowDeskSessionEvidenceReloadResultV1 {
	return {
		ok: true,
		errors: [],
		blocked: [],
		realOpenCodeDispatch: false,
		actualLaneLaunch: false,
		providerCall: false,
		runtimeExecution: false,
		entries: [
			{
				evidenceClass: "production_approval_source",
				evidenceId: "approval-source-smoke-1",
				record: consumedApproval() as unknown as Record<string, unknown>,
				path: ".flowdesk/sessions/workflow-smoke-1/evidence/production-approval-source/approval-source-smoke-1.json",
			},
			{
				evidenceClass: "pre_dispatch_audit",
				evidenceId: "audit-predispatch-smoke-1",
				record: {
					pre_dispatch_audit_ref: "audit-predispatch-smoke-1",
					workflow_id: "workflow-smoke-1",
					attempt_id: "attempt-smoke-1",
				},
				path: ".flowdesk/sessions/workflow-smoke-1/evidence/pre-dispatch-audit/audit-predispatch-smoke-1.json",
			},
			{
				evidenceClass: "dispatch_idempotency",
				evidenceId: "idempotency-snapshot-smoke-1",
				record: idempotencySnapshot() as unknown as Record<string, unknown>,
				path: ".flowdesk/sessions/workflow-smoke-1/evidence/dispatch-idempotency/idempotency-snapshot-smoke-1.json",
			},
		],
		...overrides,
	};
}

test("smoke: durable pre-call passes when audit and idempotency provenance match", () => {
	const result = evaluateFlowDeskDispatchAttemptDurablePrecallV1({
		manifest: manifest(),
		reloadedEvidence: reloadedEvidence(),
	});

	assert.equal(result.ok, true, result.errors.join("; "));
	assert.equal(result.sdk_call_permitted, true);
	assert.equal(result.state, "sdk_call_permitted");
});

test("smoke: durable pre-call blocks missing audit ref", () => {
	const base = reloadedEvidence();
	const result = evaluateFlowDeskDispatchAttemptDurablePrecallV1({
		manifest: manifest(),
		reloadedEvidence: {
			...base,
			entries: base.entries.filter(
				(entry) => entry.evidenceClass !== "pre_dispatch_audit",
			),
		},
	});

	assert.equal(result.sdk_call_permitted, false);
	assert.ok(result.blocked_labels.includes("reloaded_pre_dispatch_audit_missing"));
});

test("smoke: durable pre-call blocks missing idempotency ref", () => {
	const base = reloadedEvidence();
	const result = evaluateFlowDeskDispatchAttemptDurablePrecallV1({
		manifest: manifest(),
		reloadedEvidence: {
			...base,
			entries: base.entries.filter(
				(entry) => entry.evidenceClass !== "dispatch_idempotency",
			),
		},
	});

	assert.equal(result.sdk_call_permitted, false);
	assert.ok(result.blocked_labels.includes("reloaded_idempotency_snapshot_missing"));
});

test("smoke: durable pre-call blocks audit workflow and attempt mismatch", () => {
	const base = reloadedEvidence();
	const result = evaluateFlowDeskDispatchAttemptDurablePrecallV1({
		manifest: manifest(),
		reloadedEvidence: {
			...base,
			entries: base.entries.map((entry) =>
				entry.evidenceClass === "pre_dispatch_audit"
					? {
							...entry,
							record: {
								...entry.record,
								workflow_id: "workflow-smoke-other",
								attempt_id: "attempt-smoke-other",
							},
						}
					: entry,
			),
		},
	});

	assert.equal(result.sdk_call_permitted, false);
	assert.ok(
		result.blocked_labels.includes(
			"reloaded_pre_dispatch_audit_workflow_attempt_mismatch",
		),
	);
});

test("smoke: durable pre-call blocks duplicate idempotency reservation replay", () => {
	const base = reloadedEvidence();
	const result = evaluateFlowDeskDispatchAttemptDurablePrecallV1({
		manifest: manifest(),
		reloadedEvidence: {
			...base,
			entries: base.entries.map((entry) =>
				entry.evidenceClass === "dispatch_idempotency"
					? {
							...entry,
							record: idempotencySnapshot([
								{
									attempt_id: "attempt-smoke-1",
									idempotency_key: "idempotency-smoke-1",
									state: "reserved",
									recorded_at: "2026-05-21T00:04:30.000Z",
								},
							]) as unknown as Record<string, unknown>,
						}
					: entry,
			),
		},
	});

	assert.equal(result.sdk_call_permitted, false);
	assert.ok(result.blocked_labels.includes("idempotency_attempt_already_recorded"));
	assert.ok(result.blocked_labels.includes("idempotency_idempotency_key_reused"));
});
