import type { FlowDeskAgentRegistryRoleCategoryV1, ValidationResult } from "@flowdesk/core";

export const FLOWDESK_ROUTE_DECISION_GUARD_SCHEMA_VERSION_V1 = "flowdesk.route_decision_guard.v1" as const;

export const FLOWDESK_TASK_CAPABILITIES_V1 = [
	"read_context",
	"implementation",
	"workspace_edit",
	"test_authoring",
	"verification",
	"test_execution_analysis",
] as const;

export type FlowDeskTaskCapabilityV1 = (typeof FLOWDESK_TASK_CAPABILITIES_V1)[number];

export const FLOWDESK_TASK_INTENTS_V1 = ["implementation", "test_authoring", "verification", "mixed_implementation_verification", "advisory"] as const;

export type FlowDeskTaskIntentV1 = (typeof FLOWDESK_TASK_INTENTS_V1)[number];

export const FLOWDESK_ROUTE_DECISIONS_V1 = [
	"routable",
	"blocked_no_capable_agent",
	"blocked_verifier_only_mismatch",
	"requires_split_implementation_and_verification",
] as const;

export type FlowDeskRouteDecisionV1 = (typeof FLOWDESK_ROUTE_DECISIONS_V1)[number];

export interface FlowDeskAgentCapabilityProjectionV1 {
	agent_id: string;
	runtime_agent_name: string;
	role_category: FlowDeskAgentRegistryRoleCategoryV1;
	capabilities: FlowDeskTaskCapabilityV1[];
	verifier_only: boolean;
	dispatch_authority_enabled: false;
	provider_call_made: false;
	runtime_execution: false;
	actual_lane_launch: false;
	open_code_internal_validation_claimed: false;
}

export interface FlowDeskTaskCapabilityClassificationV1 {
	intent: FlowDeskTaskIntentV1;
	required_capabilities: FlowDeskTaskCapabilityV1[];
	requires_implementation_capable_primary: boolean;
	requires_verification_capable_agent: boolean;
	dispatch_authority_enabled: false;
	provider_call_made: false;
	runtime_execution: false;
	actual_lane_launch: false;
	open_code_internal_validation_claimed: false;
}

export interface FlowDeskRouteDecisionGuardEvidenceV1 {
	schema_version: typeof FLOWDESK_ROUTE_DECISION_GUARD_SCHEMA_VERSION_V1;
	decision_id: string;
	task_summary_label: string;
	classified_intent: FlowDeskTaskIntentV1;
	required_capabilities: FlowDeskTaskCapabilityV1[];
	candidate_agent_ids: string[];
	selected_primary_agent_id?: string;
	decision: FlowDeskRouteDecisionV1;
	reason_label: string;
	dispatch_authority_enabled: false;
	provider_call_made: false;
	runtime_execution: false;
	actual_lane_launch: false;
	fallback_or_reselection_allowed: false;
	open_code_internal_validation_claimed: false;
	redaction_version: "v1";
}

export interface FlowDeskRouteDecisionEvaluationV1 {
	decision: FlowDeskRouteDecisionV1;
	classification: FlowDeskTaskCapabilityClassificationV1;
	candidates: FlowDeskAgentCapabilityProjectionV1[];
	selectedPrimaryAgentId?: string;
	reasonLabel: string;
	evidence: FlowDeskRouteDecisionGuardEvidenceV1;
}

const FALSE_AUTHORITY_FLAGS = {
	dispatch_authority_enabled: false,
	provider_call_made: false,
	runtime_execution: false,
	actual_lane_launch: false,
	open_code_internal_validation_claimed: false,
} as const;

const IMPLEMENTATION_CAPABILITIES: FlowDeskTaskCapabilityV1[] = ["read_context", "implementation", "workspace_edit"];
const TEST_AUTHORING_CAPABILITIES: FlowDeskTaskCapabilityV1[] = ["read_context", "implementation", "workspace_edit", "test_authoring"];
const VERIFICATION_CAPABILITIES: FlowDeskTaskCapabilityV1[] = ["read_context", "verification", "test_execution_analysis"];

export const FLOWDESK_STATIC_AGENT_CAPABILITY_REGISTRY_V1: readonly FlowDeskAgentCapabilityProjectionV1[] = [
	projection("flowdesk-code-backend", "implementation", [...TEST_AUTHORING_CAPABILITIES, "verification", "test_execution_analysis"]),
	projection("flowdesk-code-frontend", "implementation", [...IMPLEMENTATION_CAPABILITIES, "test_authoring"]),
	projection("flowdesk-code-language-specialist", "implementation", [...TEST_AUTHORING_CAPABILITIES, "verification", "test_execution_analysis"]),
	projection("flowdesk-migration-refactor", "migration", [...IMPLEMENTATION_CAPABILITIES, "test_authoring"]),
	projection("flowdesk-docs-writer", "documentation", ["read_context", "implementation", "workspace_edit"]),
	projection("flowdesk-explorer-researcher", "exploration", ["read_context"]),
	projection("flowdesk-critical-reviewer", "review", ["read_context", "verification"]),
	projection("flowdesk-architecture", "architecture", ["read_context", "verification"]),
	projection("flowdesk-security-policy", "security", ["read_context", "verification"]),
	projection("flowdesk-performance", "performance", ["read_context", "verification"]),
	projection("flowdesk-algorithm-architect", "architecture", ["read_context", "verification"]),
	projection("flowdesk-oracle-decision", "decision", ["read_context", "verification"]),
	projection("flowdesk-verifier-testing", "verification", VERIFICATION_CAPABILITIES),
	projection("flowdesk-release-package-verifier", "verification", VERIFICATION_CAPABILITIES),
] as const;

function projection(
	runtimeAgentName: string,
	roleCategory: FlowDeskAgentRegistryRoleCategoryV1,
	capabilities: FlowDeskTaskCapabilityV1[],
): FlowDeskAgentCapabilityProjectionV1 {
	const uniqueCapabilities = [...new Set(capabilities)];
	const hasImplementation = uniqueCapabilities.includes("implementation") || uniqueCapabilities.includes("workspace_edit") || uniqueCapabilities.includes("test_authoring");
	return {
		agent_id: `agent-${runtimeAgentName.replace(/^flowdesk-/, "")}`,
		runtime_agent_name: runtimeAgentName,
		role_category: roleCategory,
		capabilities: uniqueCapabilities,
		verifier_only: !hasImplementation && (uniqueCapabilities.includes("verification") || roleCategory === "verification"),
		...FALSE_AUTHORITY_FLAGS,
	};
}

function emptyAuthorityClassification(intent: FlowDeskTaskIntentV1, requiredCapabilities: FlowDeskTaskCapabilityV1[]): FlowDeskTaskCapabilityClassificationV1 {
	return {
		intent,
		required_capabilities: [...new Set(requiredCapabilities)],
		requires_implementation_capable_primary: requiredCapabilities.some((capability) => capability === "implementation" || capability === "workspace_edit" || capability === "test_authoring"),
		requires_verification_capable_agent: requiredCapabilities.includes("verification") || requiredCapabilities.includes("test_execution_analysis"),
		...FALSE_AUTHORITY_FLAGS,
	};
}

export function classifyFlowDeskTaskCapabilitiesV1(taskSummary: string): FlowDeskTaskCapabilityClassificationV1 {
	const text = taskSummary.toLowerCase();
	const hasVerification = /\b(?:verify|verification|validate|test(?:ing|s)?|build|typecheck|assert|scenario|evidence|review)\b/.test(text);
	const hasTestAuthoring = /\b(?:add|create|write|implement|update|fix|patch|edit|author)\b.{0,40}\b(?:test|tests|scenario|assertion|fixture)\b|\b(?:test|tests|scenario|assertion|fixture)\b.{0,40}\b(?:add|create|write|implement|update|fix|patch|edit|author)\b/.test(text);
	const hasImplementation = /\b(?:implement|implementation|edit|modify|update|fix|patch|refactor|code|change|write|add)\b/.test(text) || hasTestAuthoring;
	const explicitlyRequestsPostImplementationVerification = /\b(?:run|execute|verify|validate|typecheck|build)\b.{0,40}\b(?:test|tests|scenario|assertion|fixture|change|implementation|patch)\b|\b(?:test|tests|scenario|assertion|fixture|change|implementation|patch)\b.{0,40}\b(?:run|execute|verify|validate|typecheck|build)\b/.test(text);

	if (hasImplementation && hasVerification && (!hasTestAuthoring || explicitlyRequestsPostImplementationVerification)) {
		return emptyAuthorityClassification("mixed_implementation_verification", [...TEST_AUTHORING_CAPABILITIES, "verification", "test_execution_analysis"]);
	}
	if (hasTestAuthoring) return emptyAuthorityClassification("test_authoring", TEST_AUTHORING_CAPABILITIES);
	if (hasImplementation) return emptyAuthorityClassification("implementation", IMPLEMENTATION_CAPABILITIES);
	if (hasVerification) return emptyAuthorityClassification("verification", VERIFICATION_CAPABILITIES);
	return emptyAuthorityClassification("advisory", ["read_context"]);
}

export function getFlowDeskAgentCapabilityProjectionV1(agentIdOrRuntimeName: string): FlowDeskAgentCapabilityProjectionV1 | undefined {
	return FLOWDESK_STATIC_AGENT_CAPABILITY_REGISTRY_V1.find(
		(agent) => agent.agent_id === agentIdOrRuntimeName || agent.runtime_agent_name === agentIdOrRuntimeName,
	);
}

export function evaluateFlowDeskRouteDecisionGuardV1(input: {
	decisionId: string;
	taskSummary: string;
	candidateAgentIds: string[];
}): FlowDeskRouteDecisionEvaluationV1 {
	const classification = classifyFlowDeskTaskCapabilitiesV1(input.taskSummary);
	const candidates = input.candidateAgentIds.flatMap((agentId) => {
		const projection = getFlowDeskAgentCapabilityProjectionV1(agentId);
		return projection === undefined ? [] : [projection];
	});
	const candidateIds = candidates.map((candidate) => candidate.agent_id);
	const capableCandidates = candidates.filter((candidate) => hasAllCapabilities(candidate, classification.required_capabilities));
	const implementationCandidates = candidates.filter(isImplementationCapable);
	const verificationCandidates = candidates.filter((candidate) => hasAnyCapability(candidate, ["verification", "test_execution_analysis"]));

	let decision: FlowDeskRouteDecisionV1;
	let selectedPrimaryAgentId: string | undefined;
	let reasonLabel: string;

	if (candidates.length === 0) {
		decision = "blocked_no_capable_agent";
		reasonLabel = "no_registered_candidate_agent";
	} else if (classification.intent === "mixed_implementation_verification" && implementationCandidates.length === 0 && verificationCandidates.length > 0) {
		decision = "requires_split_implementation_and_verification";
		reasonLabel = "mixed_task_has_verification_candidate_but_no_implementation_primary";
	} else if (classification.requires_implementation_capable_primary && candidates.every((candidate) => candidate.verifier_only)) {
		decision = "blocked_verifier_only_mismatch";
		reasonLabel = "implementation_or_test_authoring_task_cannot_route_to_verifier_only_agent";
	} else if (classification.intent === "mixed_implementation_verification" && implementationCandidates.length > 0 && !capableCandidates.some((candidate) => candidate.agent_id === implementationCandidates[0]?.agent_id)) {
		decision = "requires_split_implementation_and_verification";
		selectedPrimaryAgentId = implementationCandidates[0]?.agent_id;
		reasonLabel = "mixed_task_requires_separate_verification_lane";
	} else if (capableCandidates.length > 0) {
		decision = "routable";
		selectedPrimaryAgentId = capableCandidates[0]?.agent_id;
		reasonLabel = "candidate_satisfies_required_capabilities";
	} else {
		decision = "blocked_no_capable_agent";
		reasonLabel = "no_candidate_satisfies_required_capabilities";
	}

	const evidence: FlowDeskRouteDecisionGuardEvidenceV1 = {
		schema_version: FLOWDESK_ROUTE_DECISION_GUARD_SCHEMA_VERSION_V1,
		decision_id: input.decisionId,
		task_summary_label: boundLabel(input.taskSummary),
		classified_intent: classification.intent,
		required_capabilities: classification.required_capabilities,
		candidate_agent_ids: candidateIds,
		selected_primary_agent_id: selectedPrimaryAgentId,
		decision,
		reason_label: reasonLabel,
		...FALSE_AUTHORITY_FLAGS,
		fallback_or_reselection_allowed: false,
		redaction_version: "v1",
	};

	return { decision, classification, candidates, selectedPrimaryAgentId, reasonLabel, evidence };
}

function hasAllCapabilities(candidate: FlowDeskAgentCapabilityProjectionV1, requiredCapabilities: readonly FlowDeskTaskCapabilityV1[]): boolean {
	return requiredCapabilities.every((capability) => candidate.capabilities.includes(capability));
}

function hasAnyCapability(candidate: FlowDeskAgentCapabilityProjectionV1, capabilities: readonly FlowDeskTaskCapabilityV1[]): boolean {
	return capabilities.some((capability) => candidate.capabilities.includes(capability));
}

function isImplementationCapable(candidate: FlowDeskAgentCapabilityProjectionV1): boolean {
	return hasAnyCapability(candidate, ["implementation", "workspace_edit", "test_authoring"]);
}

function boundLabel(value: string): string {
	const trimmed = value.trim().replace(/\s+/g, " ");
	return trimmed.length <= 200 ? trimmed : `${trimmed.slice(0, 197)}...`;
}

function valid(): ValidationResult {
	return { ok: true, errors: [] };
}

function invalid(...errors: string[]): ValidationResult {
	return { ok: false, errors };
}

function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === "object" && value !== null && !Array.isArray(value);
}

const EVIDENCE_KEYS = new Set([
	"schema_version",
	"decision_id",
	"task_summary_label",
	"classified_intent",
	"required_capabilities",
	"candidate_agent_ids",
	"selected_primary_agent_id",
	"decision",
	"reason_label",
	"dispatch_authority_enabled",
	"provider_call_made",
	"runtime_execution",
	"actual_lane_launch",
	"fallback_or_reselection_allowed",
	"open_code_internal_validation_claimed",
	"redaction_version",
]);

export function validateFlowDeskRouteDecisionGuardEvidenceV1(value: unknown): ValidationResult {
	if (!isRecord(value)) return invalid("route decision guard evidence must be an object");
	const errors: string[] = [];
	for (const key of Object.keys(value)) {
		if (!EVIDENCE_KEYS.has(key)) errors.push(`route decision guard evidence has unknown property: ${key}`);
	}
	for (const key of ["schema_version", "decision_id", "task_summary_label", "classified_intent", "required_capabilities", "candidate_agent_ids", "decision", "reason_label", "dispatch_authority_enabled", "provider_call_made", "runtime_execution", "actual_lane_launch", "fallback_or_reselection_allowed", "open_code_internal_validation_claimed", "redaction_version"]) {
		if (!(key in value)) errors.push(`route decision guard evidence missing required field: ${key}`);
	}
	if (value.schema_version !== FLOWDESK_ROUTE_DECISION_GUARD_SCHEMA_VERSION_V1) errors.push(`schema_version must be ${FLOWDESK_ROUTE_DECISION_GUARD_SCHEMA_VERSION_V1}`);
	if (typeof value.decision_id !== "string" || !/^[a-z0-9]+(?:[-_][a-z0-9]+)*$/i.test(value.decision_id)) errors.push("decision_id must be a bounded opaque id");
	if (typeof value.task_summary_label !== "string" || value.task_summary_label.trim().length === 0 || value.task_summary_label.length > 200) errors.push("task_summary_label must be a non-empty bounded label");
	if (!FLOWDESK_TASK_INTENTS_V1.includes(value.classified_intent as FlowDeskTaskIntentV1)) errors.push("classified_intent is not allowed");
	if (!FLOWDESK_ROUTE_DECISIONS_V1.includes(value.decision as FlowDeskRouteDecisionV1)) errors.push("decision is not allowed");
	if (typeof value.reason_label !== "string" || !/^[a-z0-9]+(?:_[a-z0-9]+)*$/.test(value.reason_label)) errors.push("reason_label must be a bounded snake_case label");
	validateStringArray(value.required_capabilities, "required_capabilities", FLOWDESK_TASK_CAPABILITIES_V1, errors);
	validateStringArray(value.candidate_agent_ids, "candidate_agent_ids", undefined, errors);
	if (value.selected_primary_agent_id !== undefined && typeof value.selected_primary_agent_id !== "string") errors.push("selected_primary_agent_id must be a string when present");
	for (const key of ["dispatch_authority_enabled", "provider_call_made", "runtime_execution", "actual_lane_launch", "fallback_or_reselection_allowed", "open_code_internal_validation_claimed"]) {
		if (value[key] !== false) errors.push(`${key} must be false`);
	}
	if (value.redaction_version !== "v1") errors.push("redaction_version must be v1");
	return errors.length === 0 ? valid() : invalid(...errors);
}

function validateStringArray(value: unknown, label: string, allowed: readonly string[] | undefined, errors: string[]): void {
	if (!Array.isArray(value)) {
		errors.push(`${label} must be an array`);
		return;
	}
	if (value.length > 16) errors.push(`${label} exceeds 16 items`);
	value.forEach((item, index) => {
		if (typeof item !== "string" || item.trim().length === 0) {
			errors.push(`${label}[${index}] must be a non-empty string`);
		} else if (allowed !== undefined && !allowed.includes(item)) {
			errors.push(`${label}[${index}] is not allowed`);
		}
	});
}
