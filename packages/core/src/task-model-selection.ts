import type { OpaqueId, OpaqueRef, ProviderFamily } from "./release1-contracts.js";
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
	validatePlanningSafeLabelArray,
	validatePlanningSafeText,
	validatePlanningTimestamp,
} from "./planning-evidence-common.js";
import { validateConcreteProviderQualifiedModelId, validateProviderFamily } from "./validators.js";

export const FLOWDESK_TASK_MODEL_SELECTION_SCHEMA_VERSION_V1 = "flowdesk.task_model_selection.v1" as const;

export type FlowDeskTaskModelSelectionStatusV1 = "selected" | "blocked" | "non_dispatchable";
export type FlowDeskTaskModelAvailabilityLabelV1 = "available" | "unavailable" | "unknown" | "non_dispatchable";
export type FlowDeskTaskModelFreshnessV1 = "fresh" | "stale" | "unknown";

export interface FlowDeskTaskModelSelectionV1 {
	schema_version: typeof FLOWDESK_TASK_MODEL_SELECTION_SCHEMA_VERSION_V1;
	workflow_id: OpaqueId;
	task_id: OpaqueId;
	selection_id: OpaqueId;
	provider_family: ProviderFamily;
	provider_qualified_model_id: string;
	attempted_provider_qualified_model_ids?: string[];
	usage_snapshot_ref: OpaqueRef;
	usage_snapshot_freshness: FlowDeskTaskModelFreshnessV1;
	provider_health_ref: OpaqueRef;
	provider_health_label: "ok" | "warning" | "critical" | "exhausted" | "unknown";
	exact_model_availability_ref: OpaqueRef;
	exact_model_availability_label: FlowDeskTaskModelAvailabilityLabelV1;
	fit_label: string;
	performance_label: string;
	selection_status: FlowDeskTaskModelSelectionStatusV1;
	blocked_labels: string[];
	fallback_allowed: false;
	reselection_allowed: false;
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
	"selection_id",
	"provider_family",
	"provider_qualified_model_id",
	"attempted_provider_qualified_model_ids",
	"usage_snapshot_ref",
	"usage_snapshot_freshness",
	"provider_health_ref",
	"provider_health_label",
	"exact_model_availability_ref",
	"exact_model_availability_label",
	"fit_label",
	"performance_label",
	"selection_status",
	"blocked_labels",
	"fallback_allowed",
	"reselection_allowed",
	"created_at",
	"release_gate",
	...FLOWDESK_PLANNING_AUTHORITY_KEYS_V1,
	"redaction_version",
]);

const REQUIRED_KEYS = [
	"schema_version",
	"workflow_id",
	"task_id",
	"selection_id",
	"provider_family",
	"provider_qualified_model_id",
	"usage_snapshot_ref",
	"usage_snapshot_freshness",
	"provider_health_ref",
	"provider_health_label",
	"exact_model_availability_ref",
	"exact_model_availability_label",
	"fit_label",
	"performance_label",
	"selection_status",
	"blocked_labels",
	"fallback_allowed",
	"reselection_allowed",
	"created_at",
	"release_gate",
	...FLOWDESK_PLANNING_AUTHORITY_KEYS_V1,
	"redaction_version",
] as const;

const FRESHNESS = new Set<FlowDeskTaskModelFreshnessV1>(["fresh", "stale", "unknown"]);
const HEALTH = new Set(["ok", "warning", "critical", "exhausted", "unknown"]);
const AVAILABILITY = new Set<FlowDeskTaskModelAvailabilityLabelV1>(["available", "unavailable", "unknown", "non_dispatchable"]);
const STATUSES = new Set<FlowDeskTaskModelSelectionStatusV1>(["selected", "blocked", "non_dispatchable"]);

export function validateFlowDeskTaskModelSelectionV1(value: unknown): ValidationResult {
	if (!isPlanningEvidenceRecord(value)) return invalid("task model selection must be an object");
	const errors: string[] = [];
	errors.push(...rejectUnknownPlanningProperties(value, ALLOWED_KEYS, "task model selection"));
	errors.push(...requirePlanningKeys(value, REQUIRED_KEYS, "task model selection"));
	if (value.schema_version !== FLOWDESK_TASK_MODEL_SELECTION_SCHEMA_VERSION_V1) errors.push(`schema_version must be ${FLOWDESK_TASK_MODEL_SELECTION_SCHEMA_VERSION_V1}`);
	errors.push(...validatePlanningOpaqueId(value.workflow_id, "workflow_id").errors);
	errors.push(...validatePlanningOpaqueId(value.task_id, "task_id").errors);
	errors.push(...validatePlanningOpaqueId(value.selection_id, "selection_id").errors);
	errors.push(...validateProviderFamily(value.provider_family).errors);
	errors.push(...validateConcreteProviderQualifiedModelId(value.provider_qualified_model_id, "provider_qualified_model_id").errors);
	if (value.attempted_provider_qualified_model_ids !== undefined) {
		if (!Array.isArray(value.attempted_provider_qualified_model_ids)) {
			errors.push("attempted_provider_qualified_model_ids must be an array");
		} else if (value.attempted_provider_qualified_model_ids.length > 16) {
			errors.push("attempted_provider_qualified_model_ids exceeds 16 items");
		} else {
			for (const [index, modelId] of value.attempted_provider_qualified_model_ids.entries()) {
				errors.push(...validateConcreteProviderQualifiedModelId(modelId, `attempted_provider_qualified_model_ids[${index}]`).errors);
			}
		}
	}
	if (typeof value.provider_family === "string" && typeof value.provider_qualified_model_id === "string" && !value.provider_qualified_model_id.startsWith(`${value.provider_family}/`)) errors.push("provider_qualified_model_id must match provider_family");
	errors.push(...validatePlanningOpaqueRef(value.usage_snapshot_ref, "usage_snapshot_ref").errors);
	if (!FRESHNESS.has(value.usage_snapshot_freshness as FlowDeskTaskModelFreshnessV1)) errors.push("usage_snapshot_freshness is invalid");
	errors.push(...validatePlanningOpaqueRef(value.provider_health_ref, "provider_health_ref").errors);
	if (!HEALTH.has(value.provider_health_label as string)) errors.push("provider_health_label is invalid");
	errors.push(...validatePlanningOpaqueRef(value.exact_model_availability_ref, "exact_model_availability_ref").errors);
	if (!AVAILABILITY.has(value.exact_model_availability_label as FlowDeskTaskModelAvailabilityLabelV1)) errors.push("exact_model_availability_label is invalid");
	errors.push(...validatePlanningSafeText(value.fit_label, "fit_label", 120).errors);
	errors.push(...validatePlanningSafeText(value.performance_label, "performance_label", 120).errors);
	if (!STATUSES.has(value.selection_status as FlowDeskTaskModelSelectionStatusV1)) errors.push("selection_status is invalid");
	errors.push(...validatePlanningSafeLabelArray(value.blocked_labels, "blocked_labels", 16).errors);
	if (value.fallback_allowed !== false) errors.push("fallback_allowed must be false");
	if (value.reselection_allowed !== false) errors.push("reselection_allowed must be false");
	if (value.provider_family === "gemini" && value.exact_model_availability_label === "non_dispatchable" && value.selection_status !== "blocked" && value.selection_status !== "non_dispatchable") errors.push("non-dispatchable Gemini must be represented as blocked or non_dispatchable");
	errors.push(...validatePlanningTimestamp(value.created_at, "created_at").errors);
	if (value.release_gate !== "release1_planning_only") errors.push("release_gate must be release1_planning_only");
	if (value.redaction_version !== "v1") errors.push("redaction_version must be v1");
	errors.push(...validatePlanningAuthorityFalse(value, "task_model_selection"));
	errors.push(...validatePlanningNoForbiddenPayloads(value, "task_model_selection").errors);
	return errors.length === 0 ? valid() : invalid(...errors);
}
