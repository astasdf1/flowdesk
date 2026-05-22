import assert from "node:assert/strict";
import test from "node:test";
import {
	validateFlowDeskConnectorProfileV1,
	validateFlowDeskConnectorRecipeRefV1,
	type FlowDeskConnectorProfileV1,
	type FlowDeskConnectorRecipeRefV1,
} from "./index.js";

function profile(overrides: Partial<FlowDeskConnectorProfileV1> = {}): FlowDeskConnectorProfileV1 {
	return {
		schema_version: "flowdesk.connector_profile.v1",
		profile_id: "connector-profile-1",
		connector_kind: "github_issue",
		active_profile_ref: "profile-active-1",
		allowed_target_kinds: ["github_issue", "github_pr_comment"],
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

test("connector profile and recipe refs validate without execution authority", () => {
	assert.equal(validateFlowDeskConnectorProfileV1(profile()).ok, true);
	assert.equal(validateFlowDeskConnectorRecipeRefV1(recipe()).ok, true);
});

test("connector profile rejects raw locators, invalid targets, and authority smuggling", () => {
	const rawProfile = validateFlowDeskConnectorProfileV1(profile({ active_profile_ref: "https://example.com/repo" }));
	assert.equal(rawProfile.ok, false);
	assert.match(rawProfile.errors.join("; "), /raw path|raw payload|schema-safe|credential|raw/);

	const invalidTarget = validateFlowDeskConnectorProfileV1(profile({ allowed_target_kinds: ["raw_url" as never] }));
	assert.equal(invalidTarget.ok, false);
	assert.match(invalidTarget.errors.join("; "), /allowed_target_kinds/);

	const smuggled = validateFlowDeskConnectorProfileV1({ ...profile(), gateway_execution_authority_enabled: true });
	assert.equal(smuggled.ok, false);
	assert.match(smuggled.errors.join("; "), /execution authority/);
});

test("connector recipe requires dry-run hash binding and forbids raw locators", () => {
	const missingDryRun = validateFlowDeskConnectorRecipeRefV1(recipe({ dry_run_required: false as never }));
	assert.equal(missingDryRun.ok, false);
	assert.match(missingDryRun.errors.join("; "), /dry-run/);

	const rawAllowed = validateFlowDeskConnectorRecipeRefV1(recipe({ raw_locator_allowed: true as never }));
	assert.equal(rawAllowed.ok, false);
	assert.match(rawAllowed.errors.join("; "), /raw locators/);

	const rawPlaybook = validateFlowDeskConnectorRecipeRefV1(recipe({ playbook_ref: "src/playbooks/github.md" }));
	assert.equal(rawPlaybook.ok, false);
	assert.match(rawPlaybook.errors.join("; "), /path|schema-safe/);
});
