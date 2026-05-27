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
	validatePlanningOpaqueRefArray,
	validatePlanningSafeText,
	validatePlanningTimestamp,
} from "./planning-evidence-common.js";

export const FLOWDESK_WORKFLOW_AUTHORING_RESULT_SCHEMA_VERSION_V1 = "flowdesk.workflow_authoring_result.v1" as const;

export type FlowDeskWorkflowAuthoringStatusV1 = "authored" | "blocked" | "needs_clarification";

export interface FlowDeskWorkflowAuthoringResultV1 {
	schema_version: typeof FLOWDESK_WORKFLOW_AUTHORING_RESULT_SCHEMA_VERSION_V1;
	workflow_id: OpaqueId;
	authoring_result_id: OpaqueId;
	goal_summary: string;
	scope_summary: string;
	output_summary: string;
	risk_summary: string;
	status: FlowDeskWorkflowAuthoringStatusV1;
	created_at: string;
	evidence_refs: OpaqueRef[];
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
	"authoring_result_id",
	"goal_summary",
	"scope_summary",
	"output_summary",
	"risk_summary",
	"status",
	"created_at",
	"evidence_refs",
	"release_gate",
	...FLOWDESK_PLANNING_AUTHORITY_KEYS_V1,
	"redaction_version",
]);

const REQUIRED_KEYS = [
	"schema_version",
	"workflow_id",
	"authoring_result_id",
	"goal_summary",
	"scope_summary",
	"output_summary",
	"risk_summary",
	"status",
	"created_at",
	"evidence_refs",
	"release_gate",
	...FLOWDESK_PLANNING_AUTHORITY_KEYS_V1,
	"redaction_version",
] as const;

const STATUSES = new Set<FlowDeskWorkflowAuthoringStatusV1>([
	"authored",
	"blocked",
	"needs_clarification",
]);

export function validateFlowDeskWorkflowAuthoringResultV1(value: unknown): ValidationResult {
	if (!isPlanningEvidenceRecord(value)) return invalid("workflow authoring result must be an object");
	const errors: string[] = [];
	errors.push(...rejectUnknownPlanningProperties(value, ALLOWED_KEYS, "workflow authoring result"));
	errors.push(...requirePlanningKeys(value, REQUIRED_KEYS, "workflow authoring result"));
	if (value.schema_version !== FLOWDESK_WORKFLOW_AUTHORING_RESULT_SCHEMA_VERSION_V1)
		errors.push(`schema_version must be ${FLOWDESK_WORKFLOW_AUTHORING_RESULT_SCHEMA_VERSION_V1}`);
	errors.push(...validatePlanningOpaqueId(value.workflow_id, "workflow_id").errors);
	errors.push(...validatePlanningOpaqueId(value.authoring_result_id, "authoring_result_id").errors);
	errors.push(...validatePlanningSafeText(value.goal_summary, "goal_summary", 500).errors);
	errors.push(...validatePlanningSafeText(value.scope_summary, "scope_summary", 500).errors);
	errors.push(...validatePlanningSafeText(value.output_summary, "output_summary", 500).errors);
	errors.push(...validatePlanningSafeText(value.risk_summary, "risk_summary", 500).errors);
	if (!STATUSES.has(value.status as FlowDeskWorkflowAuthoringStatusV1))
		errors.push("status is invalid");
	errors.push(...validatePlanningTimestamp(value.created_at, "created_at").errors);
	errors.push(...validatePlanningOpaqueRefArray(value.evidence_refs, "evidence_refs", 16).errors);
	if (value.release_gate !== "release1_planning_only") errors.push("release_gate must be release1_planning_only");
	if (value.redaction_version !== "v1") errors.push("redaction_version must be v1");
	errors.push(...validatePlanningAuthorityFalse(value, "workflow_authoring_result"));
	errors.push(...validatePlanningNoForbiddenPayloads(value, "workflow_authoring_result").errors);
	return errors.length === 0 ? valid() : invalid(...errors);
}
