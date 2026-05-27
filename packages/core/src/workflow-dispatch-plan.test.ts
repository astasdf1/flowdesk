import assert from "node:assert/strict";
import test from "node:test";
import type { FlowDeskAgentRegistryEntryV1, FlowDeskAgentRegistryV1, FlowDeskWorkflowDispatchPlanV1 } from "./index.js";
import {
	FLOWDESK_AGENT_REGISTRY_REQUIRED_FORBIDDEN_ACTIONS_V1,
	evaluateFlowDeskWorkflowDispatchPlanningV1,
	validateFlowDeskWorkflowDispatchPlanV1,
} from "./index.js";

function entry(overrides: Partial<FlowDeskAgentRegistryEntryV1> = {}): FlowDeskAgentRegistryEntryV1 {
	return {
		schema_version: "flowdesk.agent_registry_entry.v1",
		agent_id: "agent-code-backend",
		role_category: "implementation",
		release_gate: "release1_planning_only",
		description_label: "Backend implementation planning lane",
		use_when: ["backend command planning", "core contract planning"],
		do_not_use_when: ["security signoff", "model routing"],
		allowed_actions: ["read_bounded_context", "write_planning_summary"],
		forbidden_actions: [...FLOWDESK_AGENT_REGISTRY_REQUIRED_FORBIDDEN_ACTIONS_V1],
		permission_profile_ref: "permission-profile-readonly",
		input_contract_ref: "flowdesk.task_input.v1",
		output_contract_ref: "contract-task-result-v1",
		required_evidence_classes: ["task_result", "lane_lifecycle"],
		optional_evidence_classes: ["lane_heartbeat"],
		model_eligibility_policy_ref: "model-policy-planning-only",
		default_runtime_agent_ref: "agent-code-backend",
		fallback_allowed: false,
		dispatch_authority_enabled: false,
		redaction_version: "v1",
		...overrides,
	};
}

const registry: FlowDeskAgentRegistryV1 = {
	schema_version: "flowdesk.agent_registry.v1",
	registry_id: "agent-registry-release1",
	entries: [
		entry(),
		entry({
			agent_id: "agent-critical-reviewer",
			role_category: "review",
			description_label: "Critical review planning lane",
			output_contract_ref: "contract-reviewer-verdict-v1",
			required_evidence_classes: ["reviewer_verdict", "lane_lifecycle"],
			default_runtime_agent_ref: "agent-critical-reviewer",
		}),
		entry({
			agent_id: "agent-verifier-testing",
			role_category: "verification",
			description_label: "Verification planning lane",
			output_contract_ref: "contract-verification-result-v1",
			required_evidence_classes: ["verification_result", "lane_lifecycle"],
			default_runtime_agent_ref: "agent-verifier-testing",
		}),
	],
	dispatch_authority_enabled: false,
	redaction_version: "v1",
};

function plan(overrides: Partial<FlowDeskWorkflowDispatchPlanV1> & Record<string, unknown> = {}): FlowDeskWorkflowDispatchPlanV1 & Record<string, unknown> {
	return {
		schema_version: "flowdesk.workflow_dispatch_plan.v1",
		workflow_id: "workflow-123",
		plan_revision_id: "plan-123",
		requested_goal_summary: "Plan a bounded Release 1 core contract change.",
		selected_agent_roles: [
			{ agent_role: "implementation", agent_role_ref: "agent-code-backend", registry_entry_ref: "registry-entry-code-backend" },
			{ agent_role: "review", agent_role_ref: "agent-critical-reviewer", registry_entry_ref: "registry-entry-critical-reviewer" },
			{ agent_role: "verification", agent_role_ref: "agent-verifier-testing", registry_entry_ref: "registry-entry-verifier-testing" },
		],
		tasks: [
			{
				task_id: "task-contract",
				title: "Draft planning contract",
				summary: "Create schema-valid planning-only task graph records.",
				agent_role: "implementation",
				agent_role_ref: "agent-code-backend",
			},
			{
				task_id: "task-review",
				title: "Review safety boundary",
				summary: "Check that the plan remains non-authorizing and command-backed.",
				agent_role: "review",
				agent_role_ref: "agent-critical-reviewer",
				depends_on_task_ids: ["task-contract"],
			},
		],
		task_graph_summary: "Two planning tasks with review dependent on contract drafting.",
		model_selection_diagnostics: {
			diagnostic_refs: ["diagnostic-model-fit-123"],
			diagnostic_labels: ["planning only model fit noted"],
			scoring_authority_enabled: false,
			fallback_or_reselection_allowed: false,
		},
		release_gate: "release1_planning_only",
		dispatch_authority_enabled: false,
		provider_call_made: false,
		runtime_execution: false,
		actual_lane_launch: false,
		redaction_version: "v1",
		...overrides,
	};
}

test("workflow dispatch planning evaluator accepts multiple registry-backed roles without runtime authority", () => {
	const result = evaluateFlowDeskWorkflowDispatchPlanningV1({
		workflowId: "workflow-123",
		planRevisionId: "plan-123",
		requestedGoalSummary: "Plan a bounded Release 1 core contract change.",
		selectedAgentRoles: plan().selected_agent_roles,
		tasks: plan().tasks,
		taskGraphSummary: "Two planning tasks with review dependent on contract drafting.",
		modelSelectionDiagnosticRefs: ["diagnostic-model-fit-123"],
		modelSelectionDiagnosticLabels: ["planning only model fit noted"],
		registry,
	});

	assert.equal(result.ok, true, result.errors.join("; "));
	assert.equal(validateFlowDeskWorkflowDispatchPlanV1(result.plan, { registry }).ok, true);
	assert.deepEqual(result.runtime, {
		realOpenCodeDispatch: false,
		actualLaneLaunch: false,
		providerCall: false,
		runtimeExecution: false,
		automaticFallbackOrReselection: false,
	});
	assert.equal(result.plan?.selected_agent_roles.length, 3);
	assert.equal(result.plan?.tasks[0]?.agent_role_ref, "agent-code-backend");
});

test("workflow dispatch plan rejects authority flags set true", () => {
	for (const key of ["dispatch_authority_enabled", "provider_call_made", "runtime_execution", "actual_lane_launch"] as const) {
		const result = validateFlowDeskWorkflowDispatchPlanV1(plan({ [key]: true }), { registry });
		assert.equal(result.ok, false, key);
		assert.ok(result.errors.some((error) => error.includes(key)), result.errors.join("; "));
	}
});

test("workflow dispatch plan rejects provider/model fallback wording", () => {
	const result = validateFlowDeskWorkflowDispatchPlanV1(
		plan({
			model_selection_diagnostics: {
				diagnostic_refs: ["diagnostic-model-fit-123"],
				diagnostic_labels: ["fallback to another provider if exhausted"],
				scoring_authority_enabled: false,
				fallback_or_reselection_allowed: false,
			},
		}),
		{ registry },
	);
	assert.equal(result.ok, false);
	assert.ok(result.errors.some((error) => /authority-smuggling/.test(error)));
});

test("workflow dispatch plan rejects invalid or registry-mismatched roles", () => {
	const invalidRole = validateFlowDeskWorkflowDispatchPlanV1(
		plan({ selected_agent_roles: [{ agent_role: "backend-code", agent_role_ref: "agent-code-backend" }] as unknown as FlowDeskWorkflowDispatchPlanV1["selected_agent_roles"] }),
		{ registry },
	);
	assert.equal(invalidRole.ok, false);
	assert.ok(invalidRole.errors.some((error) => /agent_role/.test(error)));

	const mismatchedRef = validateFlowDeskWorkflowDispatchPlanV1(
		plan({ selected_agent_roles: [{ agent_role: "review", agent_role_ref: "agent-code-backend" }] }),
		{ registry },
	);
	assert.equal(mismatchedRef.ok, false);
	assert.ok(mismatchedRef.errors.some((error) => /does not match agent_role/.test(error)));
});

test("workflow dispatch plan rejects runtime launch refs and dispatch authority smuggling", () => {
	const launchRef = validateFlowDeskWorkflowDispatchPlanV1(plan({ runtime_lane_launch_ref: "runtime-lane-launch-123" }), { registry });
	assert.equal(launchRef.ok, false);
	assert.ok(launchRef.errors.some((error) => /unknown property/.test(error)));

	const authorityText = validateFlowDeskWorkflowDispatchPlanV1(plan({ task_graph_summary: "Ready for real dispatch authority after planning." }), { registry });
	assert.equal(authorityText.ok, false);
	assert.ok(authorityText.errors.some((error) => /authority-smuggling/.test(error)));
});
