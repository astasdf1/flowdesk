import assert from "node:assert/strict";
import test from "node:test";
import {
	prepareFlowDeskFakeRemoteConnectorWriteV1,
	validateFlowDeskFakeRemoteConnectorWriteResultV1,
} from "./fake-remote-connector-adapter.js";
import type { FlowDeskProductionApprovalSourceV1 } from "./production-approval-source.js";
import type {
	FlowDeskRemoteWriteConnectorCapabilityV1,
	FlowDeskRemoteWritePlanV1,
} from "./remote-write-connector-gate.js";

const now = "2026-05-22T00:00:00.000Z";

function capability(
	overrides: Partial<FlowDeskRemoteWriteConnectorCapabilityV1> = {},
): FlowDeskRemoteWriteConnectorCapabilityV1 {
	return {
		schema_version: "flowdesk.remote_write_connector_capability.v1",
		capability_id: "capability-github-1",
		connector_kind: "github_pr_comment",
		connector_ref: "github-connector-1",
		active_profile_ref: "profile-1",
		discovered_at: now,
		required_tool_refs: ["tool-fake-remote-connector"],
		installed_tool_refs: ["tool-fake-remote-connector"],
		missing_tool_refs: [],
		auth_scope_ref: "auth-scope-github-repo-1",
		capability_state: "available",
		safe_installation_available: false,
		remote_write_authority_enabled: false,
		external_write_authority_enabled: false,
		dispatch_authority_enabled: false,
		providerCall: false,
		actualLaneLaunch: false,
		runtimeExecution: false,
		...overrides,
	};
}

function writePlan(overrides: Partial<FlowDeskRemoteWritePlanV1> = {}): FlowDeskRemoteWritePlanV1 {
	return {
		schema_version: "flowdesk.remote_write_plan.v1",
		write_plan_id: "remote-write-plan-1",
		workflow_id: "workflow-1",
		attempt_id: "attempt-1",
		connector_kind: "github_pr_comment",
		connector_ref: "github-connector-1",
		target_ref: "github-target-repo-1-pr-7",
		content_hash_ref: "sha256-content-1",
		redaction_policy_ref: "redaction-policy-1",
		auth_scope_ref: "auth-scope-github-repo-1",
		capability_ref: "capability-github-1",
		pre_write_audit_ref: "audit-pre-write-1",
		idempotency_key_ref: "idempotency-remote-write-1",
		expected_remote_ref_shape: "github_url",
		created_at: now,
		remote_write_attempted: false,
		remote_write_authority_enabled: false,
		external_write_authority_enabled: false,
		dispatch_authority_enabled: false,
		providerCall: false,
		actualLaneLaunch: false,
		runtimeExecution: false,
		...overrides,
	};
}

function consumedApproval(overrides: Partial<FlowDeskProductionApprovalSourceV1> = {}): FlowDeskProductionApprovalSourceV1 {
	return {
		schema_version: "flowdesk.production_approval_source.v1",
		approval_id: "approval-remote-write-1",
		workflow_id: "workflow-1",
		attempt_id: "attempt-1",
		action_type: "external_write",
		issuer_boundary: "external_user_confirmation",
		approval_method: "typed_phrase",
		actor_ref: "actor-1",
		profile_ref: "profile-1",
		provider_qualified_model_id: "openai/gpt-5.4-mini-fast",
		provider_binding_hash: "sha256-provider-binding-1",
		evidence_bundle_hash: "sha256-evidence-bundle-1",
		guard_decision_ref: "guard-1",
		issuance_audit_ref: "audit-issued-1",
		nonce_ref: "nonce-1",
		issued_at: now,
		expires_at: "2026-05-22T01:00:00.000Z",
		revoked: false,
		consumed_at: "2026-05-22T00:01:00.000Z",
		consumed_by_attempt_id: "attempt-1",
		consumption_audit_ref: "audit-consumed-1",
		consume_strategy: "atomic_compare_and_swap_required",
		dispatch_authority_enabled: false,
		...overrides,
	};
}

test("fake remote connector records only fake write evidence after readiness", () => {
	const result = prepareFlowDeskFakeRemoteConnectorWriteV1({
		capability: capability(),
		writePlan: writePlan(),
		consumedApproval: consumedApproval(),
		redactedRemoteRef: "fake-remote-github-pr-comment-1",
	});

	assert.equal(result.state, "fake_write_recorded");
	assert.equal(result.fake_remote_write_attempted, true);
	assert.equal(result.remote_write_attempted, false);
	assert.equal(result.connector_write_attempted, false);
	assert.equal(result.github_write_attempted, false);
	assert.equal(result.external_write_authority_enabled, false);
	assert.equal(result.redacted_remote_ref, "fake-remote-github-pr-comment-1");
	assert.equal(validateFlowDeskFakeRemoteConnectorWriteResultV1(result).ok, true);
});

test("fake remote connector blocks missing tools, wrong approval, and raw refs", () => {
	const blocked = prepareFlowDeskFakeRemoteConnectorWriteV1({
		capability: capability({ capability_state: "missing_tools", installed_tool_refs: [], missing_tool_refs: ["tool-fake-remote-connector"] }),
		writePlan: writePlan({ auth_scope_ref: "auth-scope-other" }),
		consumedApproval: consumedApproval({ action_type: "managed_dispatch_beta", consumed_at: undefined }),
		redactedRemoteRef: "https://github.com/org/repo/pull/7#comment",
	});

	assert.equal(blocked.state, "blocked");
	assert.equal(blocked.fake_remote_write_attempted, false);
	assert.equal(blocked.remote_write_attempted, false);
	assert.deepEqual(
		new Set(blocked.blocked_labels),
		new Set([
			"approval_invalid",
			"connector_not_available",
			"auth_scope_mismatch",
			"approval_action_mismatch",
			"approval_not_consumed",
			"redacted_remote_ref_invalid",
		]),
	);
});

test("fake remote connector result validator rejects real write authority smuggling", () => {
	const valid = prepareFlowDeskFakeRemoteConnectorWriteV1({
		capability: capability(),
		writePlan: writePlan(),
		consumedApproval: consumedApproval(),
		redactedRemoteRef: "fake-remote-github-pr-comment-1",
	});
	const forged = validateFlowDeskFakeRemoteConnectorWriteResultV1({
		...valid,
		remote_write_attempted: true,
		connector_write_attempted: true,
		providerCall: true,
	});

	assert.equal(forged.ok, false);
	assert.match(forged.errors.join("|"), /cannot enable real remote/);
});
