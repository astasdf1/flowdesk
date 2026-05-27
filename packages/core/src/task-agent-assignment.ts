import type { FlowDeskAgentRegistryRoleCategoryV1 } from "./agent-registry.js";
import { FLOWDESK_AGENT_REGISTRY_ROLE_CATEGORIES_V1 } from "./agent-registry.js";
import type { OpaqueId, OpaqueRef } from "./release1-contracts.js";
import {
	FLOWDESK_PLANNING_AUTHORITY_KEYS_V1,
	invalid,
	isPlanningEvidenceRecord,
	rejectUnknownPlanningProperties,
	requirePlanningKeys,
	type ValidationResult,
	valid,
	validatePlanningAuthorityFalse,
	validatePlanningNoForbiddenPayloads,
	validatePlanningOpaqueId,
	validatePlanningOpaqueRef,
	validatePlanningOpaqueRefArray,
	validatePlanningSafeText,
	validatePlanningTimestamp,
} from "./planning-evidence-common.js";

export const FLOWDESK_TASK_AGENT_ASSIGNMENT_SCHEMA_VERSION_V1 = "flowdesk.task_agent_assignment.v1" as const;

export type FlowDeskTaskAgentCompatibilityStatusV1 = "compatible" | "blocked" | "unknown";

export interface FlowDeskTaskAgentAssignmentV1 {
	schema_version: typeof FLOWDESK_TASK_AGENT_ASSIGNMENT_SCHEMA_VERSION_V1;
	workflow_id: OpaqueId;
	task_id: OpaqueId;
	assignment_id: OpaqueId;
	agent_role: FlowDeskAgentRegistryRoleCategoryV1;
	agent_role_ref: OpaqueRef;
	selected_agent_ref: OpaqueRef;
	selected_profile_ref: OpaqueRef;
	compatibility_status: FlowDeskTaskAgentCompatibilityStatusV1;
	fit_label: string;
	registry_evidence_ref: OpaqueRef;
	profile_evidence_ref: OpaqueRef;
	blocked_labels: string[];
	created_at: string;
	release_gate: "release1_planning_only";
	dispatch_authority_enabled: false;
	provider_call_made: false;
	runtime_execution: false;
	actual_lane_launch: false;
	write_authority_enabled: false;
	redaction_version: "v1";
}

const ALLOWED_KEYS = new Set([
	"schema_version",
	"workflow_id",
	"task_id",
	"assignment_id",
	"agent_role",
	"agent_role_ref",
	"selected_agent_ref",
	"selected_profile_ref",
	"compatibility_status",
	"fit_label",
	"registry_evidence_ref",
	"profile_evidence_ref",
	"blocked_labels",
	"created_at",
	"release_gate",
	...FLOWDESK_PLANNING_AUTHORITY_KEYS_V1,
	"redaction_version",
]);

const REQUIRED_KEYS = [
	"schema_version",
	"workflow_id",
	"task_id",
	"assignment_id",
	"agent_role",
	"agent_role_ref",
	"selected_agent_ref",
	"selected_profile_ref",
	"compatibility_status",
	"fit_label",
	"registry_evidence_ref",
	"profile_evidence_ref",
	"blocked_labels",
	"created_at",
	"release_gate",
	...FLOWDESK_PLANNING_AUTHORITY_KEYS_V1,
	"redaction_version",
] as const;

const COMPATIBILITY_STATUSES = new Set<FlowDeskTaskAgentCompatibilityStatusV1>([
	"compatible",
	"blocked",
	"unknown",
]);

export function validateFlowDeskTaskAgentAssignmentV1(value: unknown): ValidationResult {
	if (!isPlanningEvidenceRecord(value)) return invalid("task agent assignment must be an object");
	const errors: string[] = [];
	errors.push(...rejectUnknownPlanningProperties(value, ALLOWED_KEYS, "task agent assignment"));
	errors.push(...requirePlanningKeys(value, REQUIRED_KEYS, "task agent assignment"));
	if (value.schema_version !== FLOWDESK_TASK_AGENT_ASSIGNMENT_SCHEMA_VERSION_V1) errors.push(`schema_version must be ${FLOWDESK_TASK_AGENT_ASSIGNMENT_SCHEMA_VERSION_V1}`);
	errors.push(...validatePlanningOpaqueId(value.workflow_id, "workflow_id").errors);
	errors.push(...validatePlanningOpaqueId(value.task_id, "task_id").errors);
	errors.push(...validatePlanningOpaqueId(value.assignment_id, "assignment_id").errors);
	if (!FLOWDESK_AGENT_REGISTRY_ROLE_CATEGORIES_V1.includes(value.agent_role as FlowDeskAgentRegistryRoleCategoryV1)) errors.push("agent_role is invalid");
	errors.push(...validatePlanningOpaqueRef(value.agent_role_ref, "agent_role_ref").errors);
	errors.push(...validatePlanningOpaqueRef(value.selected_agent_ref, "selected_agent_ref").errors);
	errors.push(...validatePlanningOpaqueRef(value.selected_profile_ref, "selected_profile_ref").errors);
	if (!COMPATIBILITY_STATUSES.has(value.compatibility_status as FlowDeskTaskAgentCompatibilityStatusV1)) errors.push("compatibility_status is invalid");
	errors.push(...validatePlanningSafeText(value.fit_label, "fit_label", 120).errors);
	errors.push(...validatePlanningOpaqueRef(value.registry_evidence_ref, "registry_evidence_ref").errors);
	errors.push(...validatePlanningOpaqueRef(value.profile_evidence_ref, "profile_evidence_ref").errors);
	errors.push(...validatePlanningOpaqueRefArray(value.blocked_labels, "blocked_labels", 12).errors);
	errors.push(...validatePlanningTimestamp(value.created_at, "created_at").errors);
	if (value.release_gate !== "release1_planning_only") errors.push("release_gate must be release1_planning_only");
	if (value.redaction_version !== "v1") errors.push("redaction_version must be v1");
	errors.push(...validatePlanningAuthorityFalse(value, "task_agent_assignment"));
	errors.push(...validatePlanningNoForbiddenPayloads(value, "task_agent_assignment").errors);
	return errors.length === 0 ? valid() : invalid(...errors);
}
