import assert from "node:assert/strict";
import test from "node:test";
import {
	planFlowDeskConnectorGatewayInvocationV1,
	validateFlowDeskConnectorGatewayInvocationPlanV1,
	type FlowDeskConnectorProfileV1,
	type FlowDeskConnectorRecipeRefV1,
	type FlowDeskRemoteWriteConnectorExecutionReadinessV1,
	type FlowDeskRemoteWritePlanV1,
} from "./index.js";

function profile(overrides: Partial<FlowDeskConnectorProfileV1> = {}): FlowDeskConnectorProfileV1 {
	return {
		schema_version: "flowdesk.connector_profile.v1",
		profile_id: "connector-profile-1",
		connector_kind: "github_issue",
		active_profile_ref: "profile-active-1",
		allowed_target_kinds: ["github_issue"],
		required_tool_refs: ["tool-gh-cli"],
		auth_scope_refs: ["auth-scope-github-issues"],
		recipe_playbook_refs: ["playbook-github-issue-comment"],
		install_policy: "approval_required",
		rollback_ref: "rollback-gh-cli",
		doctor_status_ref: "doctor-connector-github",
		gateway_execution_authority_enabled: false,
		remote_write_authority_enabled: false,
		external_write_authority_enabled: false,
		dispatch_authority_enabled: false,
		...overrides,
	};
}

function recipe(overrides: Partial<FlowDeskConnectorRecipeRefV1> = {}): FlowDeskConnectorRecipeRefV1 {
	return {
		schema_version: "flowdesk.connector_recipe_ref.v1",
		recipe_ref: "recipe-github-issue-comment",
		connector_profile_ref: "connector-profile-1",
		connector_kind: "github_issue",
		target_kind: "github_issue",
		operation_label: "append-comment",
		playbook_ref: "playbook-github-issue-comment",
		content_hash_required: true,
		dry_run_required: true,
		raw_locator_allowed: false,
		gateway_execution_authority_enabled: false,
		remote_write_authority_enabled: false,
		dispatch_authority_enabled: false,
		...overrides,
	};
}

function writePlan(overrides: Partial<FlowDeskRemoteWritePlanV1> = {}): FlowDeskRemoteWritePlanV1 {
	return {
		schema_version: "flowdesk.remote_write_plan.v1",
		write_plan_id: "write-plan-1",
		workflow_id: "workflow-1",
		attempt_id: "attempt-1",
		connector_kind: "github_issue",
		connector_ref: "connector-github-issues",
		target_ref: "target-issue-1",
		content_hash_ref: "hash-content-1",
		redaction_policy_ref: "redaction-policy-1",
		auth_scope_ref: "auth-scope-github-issues",
		capability_ref: "capability-github-issues",
		pre_write_audit_ref: "audit-pre-write-1",
		idempotency_key_ref: "idempotency-write-1",
		expected_remote_ref_shape: "github_url",
		created_at: "2026-05-22T00:00:00.000Z",
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

function readiness(overrides: Partial<FlowDeskRemoteWriteConnectorExecutionReadinessV1> = {}): FlowDeskRemoteWriteConnectorExecutionReadinessV1 {
	return {
		schema_version: "flowdesk.remote_write_connector_execution_readiness.v1",
		workflow_id: "workflow-1",
		attempt_id: "attempt-1",
		connector_kind: "github_issue",
		ok: true,
		errors: [],
		state: "ready",
		blocked_labels: [],
		remote_write_connector_ready: true,
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

test("connector gateway plans a non-authorizing invocation only after profile recipe and readiness align", () => {
	const plan = planFlowDeskConnectorGatewayInvocationV1({
		profile: profile(),
		recipe: recipe(),
		writePlan: writePlan(),
		readiness: readiness(),
	});
	assert.equal(plan.state, "gateway_ready");
	assert.equal(plan.gateway_execution_attempted, false);
	assert.equal(plan.remote_write_attempted, false);
	assert.equal(validateFlowDeskConnectorGatewayInvocationPlanV1(plan).ok, true);
});

test("connector gateway blocks profile recipe mismatch and unavailable readiness", () => {
	const plan = planFlowDeskConnectorGatewayInvocationV1({
		profile: profile(),
		recipe: recipe({ connector_profile_ref: "connector-profile-other" }),
		writePlan: writePlan(),
		readiness: readiness({ state: "blocked", remote_write_connector_ready: false, blocked_labels: ["connector_not_available"] }),
	});
	assert.equal(plan.state, "blocked");
	assert.match(plan.blocked_labels.join(";"), /profile_recipe_ref_mismatch/);
	assert.match(plan.blocked_labels.join(";"), /remote_write_readiness_not_ready/);
	assert.equal(plan.gateway_execution_attempted, false);
});

test("connector gateway blocks disallowed targets and authority smuggling", () => {
	const disallowedTarget = planFlowDeskConnectorGatewayInvocationV1({
		profile: profile({ allowed_target_kinds: ["github_pr_comment"] }),
		recipe: recipe(),
		writePlan: writePlan(),
		readiness: readiness(),
	});
	assert.equal(disallowedTarget.state, "blocked");
	assert.match(disallowedTarget.blocked_labels.join(";"), /target_kind_not_allowed/);

	const smuggled = validateFlowDeskConnectorGatewayInvocationPlanV1({ ...disallowedTarget, gateway_execution_attempted: true });
	assert.equal(smuggled.ok, false);
	assert.match(smuggled.errors.join("; "), /cannot attempt execution/);
});
