import {
	FLOWDESK_AGENT_REGISTRY_ROLE_CATEGORIES_V1,
	FLOWDESK_AGENT_REGISTRY_SCHEMA_VERSION_V1,
	type FlowDeskAgentRegistryRoleCategoryV1,
	type FlowDeskAgentRegistryV1,
	validateFlowDeskAgentRegistryV1,
} from "./agent-registry.js";
import type { OpaqueId, OpaqueRef } from "./release1-contracts.js";
import {
	invalid,
	type ValidationResult,
	valid,
	validateNoForbiddenRawPayloads,
	validateOpaqueId,
	validateOpaqueRef,
} from "./validators.js";

export const FLOWDESK_WORKFLOW_DISPATCH_PLAN_SCHEMA_VERSION_V1 = "flowdesk.workflow_dispatch_plan.v1" as const;

export interface FlowDeskWorkflowDispatchSelectedAgentRoleV1 {
	agent_role: FlowDeskAgentRegistryRoleCategoryV1;
	agent_role_ref?: OpaqueRef;
	registry_entry_ref?: OpaqueRef;
}

export interface FlowDeskWorkflowDispatchTaskV1 {
	task_id: OpaqueId;
	title: string;
	summary: string;
	agent_role: FlowDeskAgentRegistryRoleCategoryV1;
	agent_role_ref?: OpaqueRef;
	depends_on_task_ids?: OpaqueId[];
}

export interface FlowDeskWorkflowDispatchModelSelectionDiagnosticsV1 {
	diagnostic_refs: OpaqueRef[];
	diagnostic_labels: string[];
	scoring_authority_enabled: false;
	fallback_or_reselection_allowed: false;
}

export interface FlowDeskWorkflowDispatchPlanV1 {
	schema_version: typeof FLOWDESK_WORKFLOW_DISPATCH_PLAN_SCHEMA_VERSION_V1;
	workflow_id: OpaqueId;
	plan_revision_id: OpaqueId;
	requested_goal_summary: string;
	selected_agent_roles: FlowDeskWorkflowDispatchSelectedAgentRoleV1[];
	tasks: FlowDeskWorkflowDispatchTaskV1[];
	task_graph_summary: string;
	model_selection_diagnostics: FlowDeskWorkflowDispatchModelSelectionDiagnosticsV1;
	release_gate: "release1_planning_only";
	dispatch_authority_enabled: false;
	provider_call_made: false;
	runtime_execution: false;
	actual_lane_launch: false;
	redaction_version: "v1";
}

export interface FlowDeskWorkflowDispatchPlanInputV1 {
	workflowId: OpaqueId;
	planRevisionId: OpaqueId;
	requestedGoalSummary: string;
	selectedAgentRoles: FlowDeskWorkflowDispatchSelectedAgentRoleV1[];
	tasks: FlowDeskWorkflowDispatchTaskV1[];
	taskGraphSummary: string;
	modelSelectionDiagnosticRefs?: OpaqueRef[];
	modelSelectionDiagnosticLabels?: string[];
	registry?: FlowDeskAgentRegistryV1;
}

export interface FlowDeskWorkflowDispatchPlanEvaluationV1 extends ValidationResult {
	plan?: FlowDeskWorkflowDispatchPlanV1;
	runtime: {
		realOpenCodeDispatch: false;
		actualLaneLaunch: false;
		providerCall: false;
		runtimeExecution: false;
		automaticFallbackOrReselection: false;
	};
}

const inertRuntime = {
	realOpenCodeDispatch: false,
	actualLaneLaunch: false,
	providerCall: false,
	runtimeExecution: false,
	automaticFallbackOrReselection: false,
} as const;

const PLAN_ALLOWED_KEYS = new Set([
	"schema_version",
	"workflow_id",
	"plan_revision_id",
	"requested_goal_summary",
	"selected_agent_roles",
	"tasks",
	"task_graph_summary",
	"model_selection_diagnostics",
	"release_gate",
	"dispatch_authority_enabled",
	"provider_call_made",
	"runtime_execution",
	"actual_lane_launch",
	"redaction_version",
]);

const SELECTED_ROLE_ALLOWED_KEYS = new Set(["agent_role", "agent_role_ref", "registry_entry_ref"]);
const TASK_ALLOWED_KEYS = new Set(["task_id", "title", "summary", "agent_role", "agent_role_ref", "depends_on_task_ids"]);
const DIAGNOSTICS_ALLOWED_KEYS = new Set(["diagnostic_refs", "diagnostic_labels", "scoring_authority_enabled", "fallback_or_reselection_allowed"]);

const AUTHORITY_SMUGGLING_PATTERN = /\b(?:approve(?:d|s)?|approval|authorize(?:d|s)?|authorization|guard(?:ed)?\s+approval|dispatch(?:able|ed|es)?|dispatch\s*-?authority|real\s*-?(?:opencode\s*-?)?dispatch|provider\s*-?(?:call|payload|response)|runtime\s*-?execution|runtime[-_\s]*lane[-_\s]*launch|actual\s*-?lane\s*-?launch|lane\s*-?launch|fallback|reselection|reselect|retry\s+with\s+(?:another|different)|switch\s+(?:provider|model)|no\s*-?reply|hard\s*-?(?:cancel|stop)|opencode\s+run|hidden\s+injection)\b/i;

function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === "object" && value !== null && !Array.isArray(value);
}

function rejectUnknownProperties(value: Record<string, unknown>, allowed: ReadonlySet<string>, label: string): string[] {
	return Object.keys(value)
		.filter((key) => !allowed.has(key))
		.map((key) => `${label} has unknown property: ${key}`);
}

function requireKeys(value: Record<string, unknown>, keys: readonly string[], label: string): string[] {
	return keys.filter((key) => !(key in value)).map((key) => `${label} missing required field: ${key}`);
}

function safeText(value: unknown, label: string, maxLength: number): ValidationResult {
	if (typeof value !== "string" || value.trim().length === 0) return invalid(`${label} must be a non-empty string`);
	if (value.length > maxLength) return invalid(`${label} exceeds ${maxLength} chars`);
	const redaction = validateNoForbiddenRawPayloads(value, label);
	if (!redaction.ok) return redaction;
	return AUTHORITY_SMUGGLING_PATTERN.test(value) ? invalid(`${label} contains authority-smuggling language`) : valid();
}

function role(value: unknown, label: string): ValidationResult {
	return typeof value === "string" && FLOWDESK_AGENT_REGISTRY_ROLE_CATEGORIES_V1.includes(value as FlowDeskAgentRegistryRoleCategoryV1)
		? valid()
		: invalid(`${label} is not a registered FlowDesk agent role category`);
}

function agentRoleRef(value: unknown, label: string): ValidationResult {
	if (value === undefined) return valid();
	if (typeof value !== "string" || !/^agent-[a-z0-9]+(?:-[a-z0-9]+)*$/.test(value)) {
		return invalid(`${label} must be a stable lowercase agent ref`);
	}
	return validateNoForbiddenRawPayloads(value, label);
}

function opaqueRefArray(value: unknown, label: string, maxItems: number): ValidationResult {
	if (!Array.isArray(value)) return invalid(`${label} must be an array`);
	if (value.length > maxItems) return invalid(`${label} exceeds ${maxItems} items`);
	const errors = value.flatMap((item, index) => validateOpaqueRef(item, `${label}[${index}]`).errors);
	return errors.length === 0 ? valid() : invalid(...errors);
}

function safeLabelArray(value: unknown, label: string, maxItems: number): ValidationResult {
	if (!Array.isArray(value)) return invalid(`${label} must be an array`);
	if (value.length > maxItems) return invalid(`${label} exceeds ${maxItems} items`);
	const errors = value.flatMap((item, index) => safeText(item, `${label}[${index}]`, 120).errors);
	return errors.length === 0 ? valid() : invalid(...errors);
}

function validateSelectedAgentRole(value: unknown, label: string): ValidationResult {
	if (!isRecord(value)) return invalid(`${label} must be an object`);
	const errors: string[] = [];
	errors.push(...rejectUnknownProperties(value, SELECTED_ROLE_ALLOWED_KEYS, label));
	errors.push(...requireKeys(value, ["agent_role"], label));
	errors.push(...role(value.agent_role, `${label}.agent_role`).errors);
	errors.push(...agentRoleRef(value.agent_role_ref, `${label}.agent_role_ref`).errors);
	errors.push(...(value.registry_entry_ref === undefined ? [] : validateOpaqueRef(value.registry_entry_ref, `${label}.registry_entry_ref`).errors));
	errors.push(...validateNoForbiddenRawPayloads(value, label).errors);
	return errors.length === 0 ? valid() : invalid(...errors);
}

function validateTask(value: unknown, label: string): ValidationResult {
	if (!isRecord(value)) return invalid(`${label} must be an object`);
	const errors: string[] = [];
	errors.push(...rejectUnknownProperties(value, TASK_ALLOWED_KEYS, label));
	errors.push(...requireKeys(value, ["task_id", "title", "summary", "agent_role"], label));
	errors.push(...validateOpaqueId(value.task_id, `${label}.task_id`).errors);
	errors.push(...safeText(value.title, `${label}.title`, 160).errors);
	errors.push(...safeText(value.summary, `${label}.summary`, 500).errors);
	errors.push(...role(value.agent_role, `${label}.agent_role`).errors);
	errors.push(...agentRoleRef(value.agent_role_ref, `${label}.agent_role_ref`).errors);
	if (value.depends_on_task_ids !== undefined) {
		if (!Array.isArray(value.depends_on_task_ids)) errors.push(`${label}.depends_on_task_ids must be an array`);
		else if (value.depends_on_task_ids.length > 16) errors.push(`${label}.depends_on_task_ids exceeds 16 items`);
		else errors.push(...value.depends_on_task_ids.flatMap((id, index) => validateOpaqueId(id, `${label}.depends_on_task_ids[${index}]`).errors));
	}
	errors.push(...validateNoForbiddenRawPayloads(value, label).errors);
	return errors.length === 0 ? valid() : invalid(...errors);
}

function validateDiagnostics(value: unknown): ValidationResult {
	if (!isRecord(value)) return invalid("model_selection_diagnostics must be an object");
	const errors: string[] = [];
	errors.push(...rejectUnknownProperties(value, DIAGNOSTICS_ALLOWED_KEYS, "model_selection_diagnostics"));
	errors.push(...requireKeys(value, ["diagnostic_refs", "diagnostic_labels", "scoring_authority_enabled", "fallback_or_reselection_allowed"], "model_selection_diagnostics"));
	errors.push(...opaqueRefArray(value.diagnostic_refs, "model_selection_diagnostics.diagnostic_refs", 8).errors);
	errors.push(...safeLabelArray(value.diagnostic_labels, "model_selection_diagnostics.diagnostic_labels", 8).errors);
	if (value.scoring_authority_enabled !== false) errors.push("model_selection_diagnostics.scoring_authority_enabled must be false");
	if (value.fallback_or_reselection_allowed !== false) errors.push("model_selection_diagnostics.fallback_or_reselection_allowed must be false");
	errors.push(...validateNoForbiddenRawPayloads(value, "model_selection_diagnostics").errors);
	return errors.length === 0 ? valid() : invalid(...errors);
}

function registryErrors(value: FlowDeskWorkflowDispatchPlanV1, registry: FlowDeskAgentRegistryV1 | undefined): string[] {
	if (registry === undefined) return [];
	const errors = validateFlowDeskAgentRegistryV1(registry).errors.map((error) => `agent_registry: ${error}`);
	if (registry.schema_version !== FLOWDESK_AGENT_REGISTRY_SCHEMA_VERSION_V1 || !Array.isArray(registry.entries)) return errors;
	const byAgent = new Map(registry.entries.map((entry) => [entry.agent_id, entry]));
	const availableRoles = new Set(registry.entries.map((entry) => entry.role_category));

	for (const [index, selected] of value.selected_agent_roles.entries()) {
		if (!availableRoles.has(selected.agent_role)) errors.push(`selected_agent_roles[${index}].agent_role is not present in the supplied registry`);
		if (selected.agent_role_ref !== undefined) {
			const entry = byAgent.get(selected.agent_role_ref);
			if (entry === undefined) errors.push(`selected_agent_roles[${index}].agent_role_ref is not present in the supplied registry`);
			else if (entry.role_category !== selected.agent_role) errors.push(`selected_agent_roles[${index}].agent_role_ref does not match agent_role`);
		}
	}

	for (const [index, task] of value.tasks.entries()) {
		if (!availableRoles.has(task.agent_role)) errors.push(`tasks[${index}].agent_role is not present in the supplied registry`);
		if (task.agent_role_ref !== undefined) {
			const entry = byAgent.get(task.agent_role_ref);
			if (entry === undefined) errors.push(`tasks[${index}].agent_role_ref is not present in the supplied registry`);
			else if (entry.role_category !== task.agent_role) errors.push(`tasks[${index}].agent_role_ref does not match agent_role`);
		}
	}

	return errors;
}

export function validateFlowDeskWorkflowDispatchPlanV1(value: unknown, options: { registry?: FlowDeskAgentRegistryV1 } = {}): ValidationResult {
	if (!isRecord(value)) return invalid("workflow dispatch plan must be an object");
	const errors: string[] = [];
	errors.push(...rejectUnknownProperties(value, PLAN_ALLOWED_KEYS, "workflow dispatch plan"));
	errors.push(...requireKeys(value, ["schema_version", "workflow_id", "plan_revision_id", "requested_goal_summary", "selected_agent_roles", "tasks", "task_graph_summary", "model_selection_diagnostics", "release_gate", "dispatch_authority_enabled", "provider_call_made", "runtime_execution", "actual_lane_launch", "redaction_version"], "workflow dispatch plan"));
	if (value.schema_version !== FLOWDESK_WORKFLOW_DISPATCH_PLAN_SCHEMA_VERSION_V1) errors.push(`schema_version must be ${FLOWDESK_WORKFLOW_DISPATCH_PLAN_SCHEMA_VERSION_V1}`);
	errors.push(...validateOpaqueId(value.workflow_id, "workflow_id").errors);
	errors.push(...validateOpaqueId(value.plan_revision_id, "plan_revision_id").errors);
	errors.push(...safeText(value.requested_goal_summary, "requested_goal_summary", 500).errors);
	if (!Array.isArray(value.selected_agent_roles) || value.selected_agent_roles.length === 0) errors.push("selected_agent_roles must be a non-empty array");
	else if (value.selected_agent_roles.length > 16) errors.push("selected_agent_roles exceeds 16 items");
	else errors.push(...value.selected_agent_roles.flatMap((selected, index) => validateSelectedAgentRole(selected, `selected_agent_roles[${index}]`).errors));
	if (!Array.isArray(value.tasks) || value.tasks.length === 0) errors.push("tasks must be a non-empty array");
	else if (value.tasks.length > 32) errors.push("tasks exceeds 32 items");
	else errors.push(...value.tasks.flatMap((task, index) => validateTask(task, `tasks[${index}]`).errors));
	errors.push(...safeText(value.task_graph_summary, "task_graph_summary", 500).errors);
	errors.push(...validateDiagnostics(value.model_selection_diagnostics).errors);
	if (value.release_gate !== "release1_planning_only") errors.push("release_gate must be release1_planning_only");
	if (value.dispatch_authority_enabled !== false) errors.push("dispatch_authority_enabled must be false");
	if (value.provider_call_made !== false) errors.push("provider_call_made must be false");
	if (value.runtime_execution !== false) errors.push("runtime_execution must be false");
	if (value.actual_lane_launch !== false) errors.push("actual_lane_launch must be false");
	if (value.redaction_version !== "v1") errors.push("redaction_version must be v1");
	errors.push(...validateNoForbiddenRawPayloads(value, "workflow_dispatch_plan").errors);
	if (errors.length === 0) errors.push(...registryErrors(value as unknown as FlowDeskWorkflowDispatchPlanV1, options.registry));
	return errors.length === 0 ? valid() : invalid(...errors);
}

export function evaluateFlowDeskWorkflowDispatchPlanningV1(input: FlowDeskWorkflowDispatchPlanInputV1): FlowDeskWorkflowDispatchPlanEvaluationV1 {
	const plan: FlowDeskWorkflowDispatchPlanV1 = {
		schema_version: FLOWDESK_WORKFLOW_DISPATCH_PLAN_SCHEMA_VERSION_V1,
		workflow_id: input.workflowId,
		plan_revision_id: input.planRevisionId,
		requested_goal_summary: input.requestedGoalSummary,
		selected_agent_roles: input.selectedAgentRoles,
		tasks: input.tasks,
		task_graph_summary: input.taskGraphSummary,
		model_selection_diagnostics: {
			diagnostic_refs: input.modelSelectionDiagnosticRefs ?? [],
			diagnostic_labels: input.modelSelectionDiagnosticLabels ?? [],
			scoring_authority_enabled: false,
			fallback_or_reselection_allowed: false,
		},
		release_gate: "release1_planning_only",
		dispatch_authority_enabled: false,
		provider_call_made: false,
		runtime_execution: false,
		actual_lane_launch: false,
		redaction_version: "v1",
	};
	const result = validateFlowDeskWorkflowDispatchPlanV1(plan, { registry: input.registry });
	return { ok: result.ok, errors: result.errors, plan: result.ok ? plan : undefined, runtime: inertRuntime };
}
