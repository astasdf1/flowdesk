import assert from "node:assert/strict";
import test from "node:test";
import type { FlowDeskProductionApprovalSourceV1 } from "./production-approval-source.js";
import {
	evaluateFlowDeskConnectorDryRunReadinessV1,
	evaluateFlowDeskRemoteWriteConnectorExecutionReadinessV1,
	type FlowDeskRemoteWriteConnectorCapabilityV1,
	type FlowDeskRemoteWriteConnectorInstallPlanV1,
	type FlowDeskRemoteWritePlanV1,
	validateFlowDeskRemoteWriteConnectorCapabilityV1,
	validateFlowDeskRemoteWriteConnectorInstallPlanV1,
	validateFlowDeskRemoteWritePlanV1,
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
		required_tool_refs: ["tool-gh-cli"],
		installed_tool_refs: ["tool-gh-cli"],
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

function installPlan(
	overrides: Partial<FlowDeskRemoteWriteConnectorInstallPlanV1> = {},
): FlowDeskRemoteWriteConnectorInstallPlanV1 {
	return {
		schema_version: "flowdesk.remote_write_connector_install_plan.v1",
		installation_plan_id: "install-plan-1",
		capability_ref: "capability-github-1",
		connector_kind: "github_pr_comment",
		active_profile_ref: "profile-1",
		requested_tool_refs: ["tool-gh-cli"],
		package_source_ref: "package-source-gh-cli",
		expected_version_ref: "version-gh-2.0",
		rollback_ref: "rollback-remove-gh-cli",
		created_at: now,
		requires_user_approval: true,
		approved_for_install: false,
		remote_write_authority_enabled: false,
		external_write_authority_enabled: false,
		dispatch_authority_enabled: false,
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
		issued_at: "2026-05-22T00:00:00.000Z",
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

test("remote write connector capability and install plan validate discovery without authority", () => {
	assert.equal(validateFlowDeskRemoteWriteConnectorCapabilityV1(capability()).ok, true);
	assert.equal(validateFlowDeskRemoteWriteConnectorInstallPlanV1(installPlan()).ok, true);

	const missing = capability({
		capability_state: "missing_tools",
		installed_tool_refs: [],
		missing_tool_refs: ["tool-gh-cli"],
		safe_installation_available: true,
		installation_plan_ref: "install-plan-1",
	});
	assert.equal(validateFlowDeskRemoteWriteConnectorCapabilityV1(missing).ok, true);

	const unsafeInstall = validateFlowDeskRemoteWriteConnectorInstallPlanV1(
		installPlan({ approved_for_install: true as false }),
	);
	assert.equal(unsafeInstall.ok, false);
	assert.match(unsafeInstall.errors.join("|"), /must not pre-approve/);
});

test("remote write plan rejects raw remote locators and authority smuggling", () => {
	assert.equal(validateFlowDeskRemoteWritePlanV1(writePlan()).ok, true);

	const rawTarget = validateFlowDeskRemoteWritePlanV1(
		writePlan({ target_ref: "https://github.com/org/repo/pull/1" }),
	);
	assert.equal(rawTarget.ok, false);
	assert.match(rawTarget.errors.join("|"), /raw remote locator|raw path marker/);

	const forged = validateFlowDeskRemoteWritePlanV1(
		writePlan({ remote_write_attempted: true as false, remote_write_authority_enabled: true as false }),
	);
	assert.equal(forged.ok, false);
	assert.match(forged.errors.join("|"), /cannot attempt writes or enable authority/);
});

test("remote write connector readiness requires available connector and consumed external-write approval", () => {
	const ready = evaluateFlowDeskRemoteWriteConnectorExecutionReadinessV1({
		capability: capability(),
		writePlan: writePlan(),
		consumedApproval: consumedApproval(),
	});
	assert.equal(ready.state, "ready");
	assert.equal(ready.remote_write_connector_ready, true);
	assert.equal(ready.remote_write_attempted, false);
	assert.equal(ready.remote_write_authority_enabled, false);
	assert.equal(ready.external_write_authority_enabled, false);

	const blocked = evaluateFlowDeskRemoteWriteConnectorExecutionReadinessV1({
		capability: capability({ capability_state: "missing_tools", missing_tool_refs: ["tool-gh-cli"], installed_tool_refs: [] }),
		writePlan: writePlan({ auth_scope_ref: "auth-scope-other" }),
		consumedApproval: consumedApproval({ action_type: "managed_dispatch_beta", consumed_at: undefined }),
	});
	assert.equal(blocked.state, "blocked");
	assert.equal(blocked.remote_write_connector_ready, false);
	assert.deepEqual(
		new Set(blocked.blocked_labels),
		new Set([
			"approval_invalid",
			"connector_not_available",
			"auth_scope_mismatch",
			"approval_action_mismatch",
			"approval_not_consumed",
		]),
	);
});

test("connector dry-run readiness is ready when capability, install plan, write plan, and auth scope are present", () => {
	const readiness = evaluateFlowDeskConnectorDryRunReadinessV1({
		capability: capability(),
		installPlan: installPlan(),
		dryRunWritePlan: writePlan(),
	});

	assert.equal(readiness.gate_result, "dry_run_ready");
	assert.deepEqual(readiness.blocked_labels, []);
	assert.equal(readiness.capability_discovery_present, true);
	assert.equal(readiness.install_plan_present, true);
	assert.equal(readiness.dry_run_write_plan_present, true);
	assert.equal(readiness.auth_scope_ref_present, true);
	assert.equal(readiness.remote_write_attempted, false);
	assert.equal(readiness.dispatch_authority_enabled, false);
	assert.equal(readiness.providerCall, false);
	assert.equal(readiness.actualLaneLaunch, false);
	assert.equal(readiness.runtimeExecution, false);
});

test("connector dry-run readiness blocks when capability discovery is missing", () => {
	const readiness = evaluateFlowDeskConnectorDryRunReadinessV1({
		installPlan: installPlan(),
		dryRunWritePlan: writePlan(),
	});

	assert.equal(readiness.gate_result, "blocked");
	assert.equal(readiness.capability_discovery_present, false);
	assert.equal(readiness.remote_write_attempted, false);
	assert.ok(readiness.blocked_labels.includes("capability_discovery_missing"));
	assert.ok(readiness.blocked_labels.includes("auth_scope_ref_missing"));
});

test("connector dry-run readiness blocks when dry-run write plan is missing", () => {
	const readiness = evaluateFlowDeskConnectorDryRunReadinessV1({
		capability: capability(),
		installPlan: installPlan(),
	});

	assert.equal(readiness.gate_result, "blocked");
	assert.equal(readiness.dry_run_write_plan_present, false);
	assert.equal(readiness.remote_write_attempted, false);
	assert.ok(readiness.blocked_labels.includes("dry_run_write_plan_missing"));
	assert.ok(readiness.blocked_labels.includes("auth_scope_ref_missing"));
});

test("connector dry-run readiness never reports remote write attempted", () => {
	const readiness = evaluateFlowDeskConnectorDryRunReadinessV1({
		capability: capability(),
		installPlan: installPlan(),
		dryRunWritePlan: writePlan({ remote_write_attempted: true as false }),
	});

	assert.equal(readiness.gate_result, "blocked");
	assert.equal(readiness.remote_write_attempted, false);
	assert.equal(readiness.dispatch_authority_enabled, false);
	assert.equal(readiness.providerCall, false);
	assert.equal(readiness.actualLaneLaunch, false);
	assert.equal(readiness.runtimeExecution, false);
	assert.ok(readiness.blocked_labels.includes("dry_run_write_plan_invalid"));
});
