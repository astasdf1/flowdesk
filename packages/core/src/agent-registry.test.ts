import assert from "node:assert/strict";
import test from "node:test";
import type { FlowDeskAgentRegistryEntryV1 } from "./agent-registry.js";
import {
	FLOWDESK_AGENT_REGISTRY_REQUIRED_FORBIDDEN_ACTIONS_V1,
	validateFlowDeskAgentRegistryEntryV1,
	validateFlowDeskAgentRegistryV1,
} from "./agent-registry.js";

function entry(overrides: Partial<FlowDeskAgentRegistryEntryV1> & Record<string, unknown> = {}): FlowDeskAgentRegistryEntryV1 & Record<string, unknown> {
	return {
		schema_version: "flowdesk.agent_registry_entry.v1",
		agent_id: "agent-security-policy",
		role_category: "security",
		release_gate: "release1_planning_only",
		description_label: "Security and policy review lane",
		use_when: ["permission boundary review", "redaction policy review"],
		do_not_use_when: ["frontend visual polish", "implementation patch authoring"],
		allowed_actions: ["read_bounded_context", "write_redacted_findings"],
		forbidden_actions: [...FLOWDESK_AGENT_REGISTRY_REQUIRED_FORBIDDEN_ACTIONS_V1],
		permission_profile_ref: "permission-profile-readonly",
		input_contract_ref: "flowdesk.policy_review_input.v1",
		output_contract_ref: "contract-policy-review-result-v1",
		required_evidence_classes: ["policy_review_result", "lane_lifecycle"],
		optional_evidence_classes: ["lane_heartbeat"],
		model_eligibility_policy_ref: "model-policy-security-review",
		default_runtime_agent_ref: "agent-security-policy",
		fallback_allowed: false,
		dispatch_authority_enabled: false,
		redaction_version: "v1",
		...overrides,
	};
}

test("agent registry entry accepts a valid minimal FlowDesk-owned entry", () => {
	const result = validateFlowDeskAgentRegistryEntryV1(entry());
	assert.equal(result.ok, true, result.errors.join("; "));
});

test("agent registry entry rejects unknown properties", () => {
	const result = validateFlowDeskAgentRegistryEntryV1(entry({ approve_dispatch: true }));
	assert.equal(result.ok, false);
	assert.ok(result.errors.some((error) => /unknown property/.test(error)));
});

test("agent registry entry rejects invalid agent ids", () => {
	for (const agent_id of ["security-policy", "agent-Security", "omo-agent-security", "agent-security_policy", "agent-"]) {
		const result = validateFlowDeskAgentRegistryEntryV1(entry({ agent_id }));
		assert.equal(result.ok, false, agent_id);
	}
});

test("agent registry entry rejects invalid release gates", () => {
	const result = validateFlowDeskAgentRegistryEntryV1(entry({ release_gate: "release1_dispatch_ready" as FlowDeskAgentRegistryEntryV1["release_gate"] }));
	assert.equal(result.ok, false);
	assert.ok(result.errors.some((error) => /release_gate/.test(error)));
});

test("agent registry entry rejects invalid role categories and output contract refs", () => {
	const roleResult = validateFlowDeskAgentRegistryEntryV1(entry({ role_category: "security_policy" as FlowDeskAgentRegistryEntryV1["role_category"] }));
	assert.equal(roleResult.ok, false);
	assert.ok(roleResult.errors.some((error) => /role_category/.test(error)));

	const outputResult = validateFlowDeskAgentRegistryEntryV1(entry({ output_contract_ref: "flowdesk.task_result.v1" as FlowDeskAgentRegistryEntryV1["output_contract_ref"] }));
	assert.equal(outputResult.ok, false);
	assert.ok(outputResult.errors.some((error) => /output_contract_ref/.test(error)));
});

test("agent registry entry rejects authority smuggling in descriptive fields", () => {
	const result = validateFlowDeskAgentRegistryEntryV1(entry({ allowed_actions: ["approve dispatch after review"] }));
	assert.equal(result.ok, false);
	assert.ok(result.errors.some((error) => /authority-smuggling/.test(error)));
});

test("agent registry entry rejects fallback_allowed true", () => {
	const result = validateFlowDeskAgentRegistryEntryV1(entry({ fallback_allowed: true as false }));
	assert.equal(result.ok, false);
	assert.ok(result.errors.some((error) => /fallback_allowed/.test(error)));
});

test("agent registry entry rejects dispatch_authority_enabled true", () => {
	const result = validateFlowDeskAgentRegistryEntryV1(entry({ dispatch_authority_enabled: true as false }));
	assert.equal(result.ok, false);
	assert.ok(result.errors.some((error) => /dispatch_authority_enabled/.test(error)));
});

test("agent registry entry accepts valid role output and evidence combinations", () => {
	const validEntries = [
		entry({
			agent_id: "agent-critical-reviewer",
			role_category: "review",
			output_contract_ref: "contract-reviewer-verdict-v1",
			required_evidence_classes: ["reviewer_verdict", "lane_lifecycle"],
			default_runtime_agent_ref: "agent-critical-reviewer",
		}),
		entry({
			agent_id: "agent-advisory-reviewer",
			role_category: "review",
			output_contract_ref: "contract-task-result-v1",
			required_evidence_classes: ["task_result", "lane_lifecycle"],
			default_runtime_agent_ref: "agent-advisory-reviewer",
		}),
		entry({
			agent_id: "agent-verifier-testing",
			role_category: "verification",
			output_contract_ref: "contract-verification-result-v1",
			required_evidence_classes: ["verification_result", "lane_lifecycle"],
			default_runtime_agent_ref: "agent-verifier-testing",
		}),
		entry({
			agent_id: "agent-code-backend",
			role_category: "implementation",
			release_gate: "release1_planning_only",
			output_contract_ref: "contract-task-result-v1",
			required_evidence_classes: ["task_result", "lane_lifecycle"],
			default_runtime_agent_ref: "agent-code-backend",
		}),
	];

	for (const validEntry of validEntries) {
		const result = validateFlowDeskAgentRegistryEntryV1(validEntry);
		assert.equal(result.ok, true, result.errors.join("; "));
	}
});

test("agent registry entry rejects role evidence mismatches", () => {
	const advisoryReviewWithVerdict = validateFlowDeskAgentRegistryEntryV1(
		entry({ role_category: "review", output_contract_ref: "contract-task-result-v1", required_evidence_classes: ["reviewer_verdict", "lane_lifecycle"] }),
	);
	assert.equal(advisoryReviewWithVerdict.ok, false);
	assert.ok(advisoryReviewWithVerdict.errors.some((error) => /advisory/.test(error)));

	const verificationWithoutLifecycle = validateFlowDeskAgentRegistryEntryV1(
		entry({ role_category: "verification", output_contract_ref: "contract-verification-result-v1", required_evidence_classes: ["verification_result"] }),
	);
	assert.equal(verificationWithoutLifecycle.ok, false);
	assert.ok(verificationWithoutLifecycle.errors.some((error) => /lane_lifecycle/.test(error)));

	const implementationReadOnly = validateFlowDeskAgentRegistryEntryV1(
		entry({ role_category: "implementation", release_gate: "later_gate_read_only", output_contract_ref: "contract-task-result-v1", required_evidence_classes: ["task_result", "lane_lifecycle"] }),
	);
	assert.equal(implementationReadOnly.ok, false);
	assert.ok(implementationReadOnly.errors.some((error) => /implementation role/.test(error)));
});

test("agent registry entry rejects unsupported evidence classes and missing terminal evidence", () => {
	const unsupported = validateFlowDeskAgentRegistryEntryV1(entry({ required_evidence_classes: ["patch_evidence", "lane_lifecycle"] as FlowDeskAgentRegistryEntryV1["required_evidence_classes"] }));
	assert.equal(unsupported.ok, false);
	assert.ok(unsupported.errors.some((error) => /evidence class/.test(error)));

	const missingTerminal = validateFlowDeskAgentRegistryEntryV1(entry({ required_evidence_classes: ["lane_heartbeat"] }));
	assert.equal(missingTerminal.ok, false);
	assert.ok(missingTerminal.errors.some((error) => /terminal evidence/.test(error)));
});

test("agent registry entry rejects authority strings in output and permission refs", () => {
	const outputResult = validateFlowDeskAgentRegistryEntryV1(entry({ output_contract_ref: "contract-guard-approval-v1" as FlowDeskAgentRegistryEntryV1["output_contract_ref"] }));
	assert.equal(outputResult.ok, false);
	assert.ok(outputResult.errors.some((error) => /authority-smuggling|not allowed/.test(error)));

	const permissionResult = validateFlowDeskAgentRegistryEntryV1(entry({ permission_profile_ref: "permission-dispatch-approval-authority" }));
	assert.equal(permissionResult.ok, false);
	assert.ok(permissionResult.errors.some((error) => /authority|Guard approval|dispatch approval/.test(error)));
});

test("agent registry entry rejects missing required forbidden action", () => {
	const result = validateFlowDeskAgentRegistryEntryV1(entry({ forbidden_actions: ["hidden_injection", "nested_opencode_run", "authority_claims"] }));
	assert.equal(result.ok, false);
	assert.ok(result.errors.some((error) => /automatic_fallback_reselection/.test(error)));
});

test("agent registry entry rejects raw payload markers in labels and arrays", () => {
	const labelResult = validateFlowDeskAgentRegistryEntryV1(entry({ description_label: "Summarize system prompt content" }));
	assert.equal(labelResult.ok, false);

	const arrayResult = validateFlowDeskAgentRegistryEntryV1(entry({ use_when: ["review transcript from provider"] }));
	assert.equal(arrayResult.ok, false);
});

test("agent registry accepts multiple valid entries", () => {
	const result = validateFlowDeskAgentRegistryV1({
		schema_version: "flowdesk.agent_registry.v1",
		registry_id: "agent-registry-release1",
		entries: [
			entry(),
			entry({
				agent_id: "agent-verifier-testing",
				role_category: "verification",
				description_label: "Verification and test planning lane",
				output_contract_ref: "contract-verification-result-v1",
				required_evidence_classes: ["task_result", "lane_lifecycle"],
				default_runtime_agent_ref: "agent-verifier-testing",
			}),
		],
		dispatch_authority_enabled: false,
		redaction_version: "v1",
	});
	assert.equal(result.ok, true, result.errors.join("; "));
});
