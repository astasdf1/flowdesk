import {
	type FlowDeskProductionApprovalSourceV1,
	validateFlowDeskProductionApprovalSourceV1,
} from "./production-approval-source.js";
import {
	invalid,
	type ValidationResult,
	valid,
	validateNoForbiddenRawPayloads,
	validateOpaqueId,
	validateOpaqueRef,
} from "./validators.js";

export const FLOWDESK_REMOTE_WRITE_CONNECTOR_KINDS = [
	"github_issue",
	"github_pr_comment",
	"http_endpoint",
	"cloud_storage_object",
	"database_record",
	"custom_mcp_connector",
	"external_ledger_entry",
] as const;
export type FlowDeskRemoteWriteConnectorKindV1 =
	(typeof FLOWDESK_REMOTE_WRITE_CONNECTOR_KINDS)[number];

export interface FlowDeskRemoteWriteConnectorCapabilityV1 {
	schema_version: "flowdesk.remote_write_connector_capability.v1";
	capability_id: string;
	connector_kind: FlowDeskRemoteWriteConnectorKindV1;
	connector_ref: string;
	active_profile_ref: string;
	discovered_at: string;
	required_tool_refs: string[];
	installed_tool_refs: string[];
	missing_tool_refs: string[];
	auth_scope_ref: string;
	capability_state: "available" | "missing_tools" | "auth_missing" | "blocked";
	safe_installation_available: boolean;
	installation_plan_ref?: string;
	remote_write_authority_enabled: false;
	external_write_authority_enabled: false;
	dispatch_authority_enabled: false;
	providerCall: false;
	actualLaneLaunch: false;
	runtimeExecution: false;
}

export interface FlowDeskRemoteWriteConnectorInstallPlanV1 {
	schema_version: "flowdesk.remote_write_connector_install_plan.v1";
	installation_plan_id: string;
	capability_ref: string;
	connector_kind: FlowDeskRemoteWriteConnectorKindV1;
	active_profile_ref: string;
	requested_tool_refs: string[];
	package_source_ref: string;
	expected_version_ref: string;
	rollback_ref: string;
	created_at: string;
	requires_user_approval: true;
	approved_for_install: false;
	remote_write_authority_enabled: false;
	external_write_authority_enabled: false;
	dispatch_authority_enabled: false;
}

export interface FlowDeskRemoteWritePlanV1 {
	schema_version: "flowdesk.remote_write_plan.v1";
	write_plan_id: string;
	workflow_id: string;
	attempt_id: string;
	connector_kind: FlowDeskRemoteWriteConnectorKindV1;
	connector_ref: string;
	target_ref: string;
	content_hash_ref: string;
	redaction_policy_ref: string;
	auth_scope_ref: string;
	capability_ref: string;
	pre_write_audit_ref: string;
	idempotency_key_ref: string;
	expected_remote_ref_shape: "github_url" | "opaque_remote_ref" | "object_ref" | "row_ref" | "ledger_ref";
	created_at: string;
	remote_write_attempted: false;
	remote_write_authority_enabled: false;
	external_write_authority_enabled: false;
	dispatch_authority_enabled: false;
	providerCall: false;
	actualLaneLaunch: false;
	runtimeExecution: false;
}

export interface FlowDeskRemoteWriteConnectorExecutionReadinessV1 extends ValidationResult {
	schema_version: "flowdesk.remote_write_connector_execution_readiness.v1";
	workflow_id?: string;
	attempt_id?: string;
	connector_kind?: FlowDeskRemoteWriteConnectorKindV1;
	state: "ready" | "blocked";
	blocked_labels: string[];
	remote_write_connector_ready: boolean;
	remote_write_attempted: false;
	remote_write_authority_enabled: false;
	external_write_authority_enabled: false;
	dispatch_authority_enabled: false;
	providerCall: false;
	actualLaneLaunch: false;
	runtimeExecution: false;
}

const disabledRemoteWriteAuthority = {
	remote_write_authority_enabled: false as const,
	external_write_authority_enabled: false as const,
	dispatch_authority_enabled: false as const,
	providerCall: false as const,
	actualLaneLaunch: false as const,
	runtimeExecution: false as const,
};

function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === "object" && value !== null && !Array.isArray(value);
}

function rejectUnknownProperties(
	value: Record<string, unknown>,
	allowed: readonly string[],
	label: string,
): ValidationResult {
	const unknown = Object.keys(value).filter((key) => !allowed.includes(key));
	return unknown.length === 0
		? valid()
		: invalid(`${label} unknown properties: ${unknown.join(",")}`);
}

function validateTimestamp(value: unknown, label: string): ValidationResult {
	return typeof value === "string" && Number.isFinite(Date.parse(value))
		? valid()
		: invalid(`${label} must be a parseable timestamp`);
}

function validateHashRef(value: unknown, label: string): ValidationResult {
	const ref = validateOpaqueRef(value, label);
	if (!ref.ok) return ref;
	return typeof value === "string" && /^(hash-|sha256-)/.test(value)
		? valid()
		: invalid(`${label} must be a hash-bound opaque ref`);
}

function validateConnectorKind(value: unknown, label = "connector_kind"): ValidationResult {
	return typeof value === "string" &&
		(FLOWDESK_REMOTE_WRITE_CONNECTOR_KINDS as readonly string[]).includes(value)
		? valid()
		: invalid(`${label} is invalid`);
}

function validateOpaqueRefArray(value: unknown, label: string): ValidationResult {
	if (!Array.isArray(value)) return invalid(`${label} must be an array`);
	const errors: string[] = [];
	if (value.length > 20) errors.push(`${label} exceeds max items 20`);
	for (const [index, item] of value.entries())
		errors.push(...validateOpaqueRef(item, `${label}[${index}]`).errors);
	return errors.length === 0 ? valid() : invalid(...errors);
}

function validateNoRawRemoteTarget(value: unknown, label: string): ValidationResult {
	if (typeof value !== "string") return validateOpaqueRef(value, label);
	const errors = validateOpaqueRef(value, label).errors;
	if (/^(https?:|git@|ssh:|s3:|gs:|postgres:|mysql:|sqlite:)/i.test(value))
		errors.push(`${label} must be an opaque connector ref, not a raw remote locator`);
	if (/[/\\]|\.git\b|\.sql\b|\.db\b|token|secret/i.test(value))
		errors.push(`${label} must not contain raw paths, repo locators, database files, or secrets`);
	return errors.length === 0 ? valid() : invalid(...errors);
}

export function validateFlowDeskRemoteWriteConnectorCapabilityV1(value: unknown): ValidationResult {
	if (!isRecord(value)) return invalid("remote write connector capability must be an object");
	const record = value as Partial<FlowDeskRemoteWriteConnectorCapabilityV1>;
	const errors: string[] = [];
	const allowed = [
		"schema_version",
		"capability_id",
		"connector_kind",
		"connector_ref",
		"active_profile_ref",
		"discovered_at",
		"required_tool_refs",
		"installed_tool_refs",
		"missing_tool_refs",
		"auth_scope_ref",
		"capability_state",
		"safe_installation_available",
		"installation_plan_ref",
		"remote_write_authority_enabled",
		"external_write_authority_enabled",
		"dispatch_authority_enabled",
		"providerCall",
		"actualLaneLaunch",
		"runtimeExecution",
	] as const;
	errors.push(...rejectUnknownProperties(record, allowed, "remote write connector capability").errors);
	if (record.schema_version !== "flowdesk.remote_write_connector_capability.v1")
		errors.push("remote write connector capability schema_version is invalid");
	errors.push(...validateOpaqueId(record.capability_id, "capability_id").errors);
	errors.push(...validateConnectorKind(record.connector_kind).errors);
	for (const [ref, label] of [
		[record.connector_ref, "connector_ref"],
		[record.active_profile_ref, "active_profile_ref"],
		[record.auth_scope_ref, "auth_scope_ref"],
	] as const)
		errors.push(...validateOpaqueRef(ref, label).errors);
	if (record.installation_plan_ref !== undefined)
		errors.push(...validateOpaqueRef(record.installation_plan_ref, "installation_plan_ref").errors);
	errors.push(...validateTimestamp(record.discovered_at, "discovered_at").errors);
	for (const [refs, label] of [
		[record.required_tool_refs, "required_tool_refs"],
		[record.installed_tool_refs, "installed_tool_refs"],
		[record.missing_tool_refs, "missing_tool_refs"],
	] as const)
		errors.push(...validateOpaqueRefArray(refs, label).errors);
	if (!Array.isArray(record.required_tool_refs) || record.required_tool_refs.length === 0)
		errors.push("required_tool_refs must be non-empty");
	if (!["available", "missing_tools", "auth_missing", "blocked"].includes(String(record.capability_state)))
		errors.push("capability_state is invalid");
	if (typeof record.safe_installation_available !== "boolean")
		errors.push("safe_installation_available must be boolean");
	if (record.capability_state === "available" && Array.isArray(record.missing_tool_refs) && record.missing_tool_refs.length > 0)
		errors.push("available connector capability cannot have missing tools");
	if (record.capability_state === "missing_tools" && record.safe_installation_available === true && record.installation_plan_ref === undefined)
		errors.push("missing tools with safe installation available require installation_plan_ref");
	if (
		record.remote_write_authority_enabled !== false ||
		record.external_write_authority_enabled !== false ||
		record.dispatch_authority_enabled !== false ||
		record.providerCall !== false ||
		record.actualLaneLaunch !== false ||
		record.runtimeExecution !== false
	)
		errors.push("remote connector capability cannot enable write, dispatch, provider, lane, or runtime authority");
	errors.push(...validateNoForbiddenRawPayloads(record, "remote_write_connector_capability").errors);
	return errors.length === 0 ? valid() : invalid(...errors);
}

export function validateFlowDeskRemoteWriteConnectorInstallPlanV1(value: unknown): ValidationResult {
	if (!isRecord(value)) return invalid("remote write connector install plan must be an object");
	const record = value as Partial<FlowDeskRemoteWriteConnectorInstallPlanV1>;
	const errors: string[] = [];
	const allowed = [
		"schema_version",
		"installation_plan_id",
		"capability_ref",
		"connector_kind",
		"active_profile_ref",
		"requested_tool_refs",
		"package_source_ref",
		"expected_version_ref",
		"rollback_ref",
		"created_at",
		"requires_user_approval",
		"approved_for_install",
		"remote_write_authority_enabled",
		"external_write_authority_enabled",
		"dispatch_authority_enabled",
	] as const;
	errors.push(...rejectUnknownProperties(record, allowed, "remote write connector install plan").errors);
	if (record.schema_version !== "flowdesk.remote_write_connector_install_plan.v1")
		errors.push("remote write connector install plan schema_version is invalid");
	errors.push(...validateOpaqueId(record.installation_plan_id, "installation_plan_id").errors);
	errors.push(...validateConnectorKind(record.connector_kind).errors);
	for (const [ref, label] of [
		[record.capability_ref, "capability_ref"],
		[record.active_profile_ref, "active_profile_ref"],
		[record.package_source_ref, "package_source_ref"],
		[record.expected_version_ref, "expected_version_ref"],
		[record.rollback_ref, "rollback_ref"],
	] as const)
		errors.push(...validateOpaqueRef(ref, label).errors);
	errors.push(...validateOpaqueRefArray(record.requested_tool_refs, "requested_tool_refs").errors);
	if (!Array.isArray(record.requested_tool_refs) || record.requested_tool_refs.length === 0)
		errors.push("requested_tool_refs must be non-empty");
	errors.push(...validateTimestamp(record.created_at, "created_at").errors);
	if (record.requires_user_approval !== true)
		errors.push("remote connector installation must require user approval");
	if (record.approved_for_install !== false)
		errors.push("install plans are plans only and must not pre-approve installation");
	if (
		record.remote_write_authority_enabled !== false ||
		record.external_write_authority_enabled !== false ||
		record.dispatch_authority_enabled !== false
	)
		errors.push("remote connector install plan cannot enable write or dispatch authority");
	errors.push(...validateNoForbiddenRawPayloads(record, "remote_write_connector_install_plan").errors);
	return errors.length === 0 ? valid() : invalid(...errors);
}

export function validateFlowDeskRemoteWritePlanV1(value: unknown): ValidationResult {
	if (!isRecord(value)) return invalid("remote write plan must be an object");
	const record = value as Partial<FlowDeskRemoteWritePlanV1>;
	const errors: string[] = [];
	const allowed = [
		"schema_version",
		"write_plan_id",
		"workflow_id",
		"attempt_id",
		"connector_kind",
		"connector_ref",
		"target_ref",
		"content_hash_ref",
		"redaction_policy_ref",
		"auth_scope_ref",
		"capability_ref",
		"pre_write_audit_ref",
		"idempotency_key_ref",
		"expected_remote_ref_shape",
		"created_at",
		"remote_write_attempted",
		"remote_write_authority_enabled",
		"external_write_authority_enabled",
		"dispatch_authority_enabled",
		"providerCall",
		"actualLaneLaunch",
		"runtimeExecution",
	] as const;
	errors.push(...rejectUnknownProperties(record, allowed, "remote write plan").errors);
	if (record.schema_version !== "flowdesk.remote_write_plan.v1")
		errors.push("remote write plan schema_version is invalid");
	errors.push(...validateOpaqueId(record.write_plan_id, "write_plan_id").errors);
	errors.push(...validateOpaqueId(record.workflow_id, "workflow_id").errors);
	errors.push(...validateOpaqueId(record.attempt_id, "attempt_id").errors);
	errors.push(...validateConnectorKind(record.connector_kind).errors);
	for (const [ref, label] of [
		[record.connector_ref, "connector_ref"],
		[record.target_ref, "target_ref"],
		[record.redaction_policy_ref, "redaction_policy_ref"],
		[record.auth_scope_ref, "auth_scope_ref"],
		[record.capability_ref, "capability_ref"],
		[record.pre_write_audit_ref, "pre_write_audit_ref"],
		[record.idempotency_key_ref, "idempotency_key_ref"],
	] as const)
		errors.push(...validateNoRawRemoteTarget(ref, label).errors);
	errors.push(...validateHashRef(record.content_hash_ref, "content_hash_ref").errors);
	if (!["github_url", "opaque_remote_ref", "object_ref", "row_ref", "ledger_ref"].includes(String(record.expected_remote_ref_shape)))
		errors.push("expected_remote_ref_shape is invalid");
	errors.push(...validateTimestamp(record.created_at, "created_at").errors);
	if (
		record.remote_write_attempted !== false ||
		record.remote_write_authority_enabled !== false ||
		record.external_write_authority_enabled !== false ||
		record.dispatch_authority_enabled !== false ||
		record.providerCall !== false ||
		record.actualLaneLaunch !== false ||
		record.runtimeExecution !== false
	)
		errors.push("remote write plan cannot attempt writes or enable authority");
	errors.push(...validateNoForbiddenRawPayloads(record, "remote_write_plan").errors);
	return errors.length === 0 ? valid() : invalid(...errors);
}

export function evaluateFlowDeskRemoteWriteConnectorExecutionReadinessV1(input: {
	capability: FlowDeskRemoteWriteConnectorCapabilityV1;
	writePlan: FlowDeskRemoteWritePlanV1;
	consumedApproval: FlowDeskProductionApprovalSourceV1;
}): FlowDeskRemoteWriteConnectorExecutionReadinessV1 {
	const errors: string[] = [];
	const blockedLabels: string[] = [];
	const capabilityResult = validateFlowDeskRemoteWriteConnectorCapabilityV1(input.capability);
	const planResult = validateFlowDeskRemoteWritePlanV1(input.writePlan);
	const approvalResult = validateFlowDeskProductionApprovalSourceV1(input.consumedApproval);
	errors.push(...capabilityResult.errors, ...planResult.errors, ...approvalResult.errors);
	if (!capabilityResult.ok) blockedLabels.push("capability_invalid");
	if (!planResult.ok) blockedLabels.push("write_plan_invalid");
	if (!approvalResult.ok) blockedLabels.push("approval_invalid");
	if (input.capability.capability_state !== "available") blockedLabels.push("connector_not_available");
	if (input.capability.connector_kind !== input.writePlan.connector_kind) blockedLabels.push("connector_kind_mismatch");
	if (input.capability.connector_ref !== input.writePlan.connector_ref) blockedLabels.push("connector_ref_mismatch");
	if (input.capability.auth_scope_ref !== input.writePlan.auth_scope_ref) blockedLabels.push("auth_scope_mismatch");
	if (input.capability.capability_id !== input.writePlan.capability_ref) blockedLabels.push("capability_ref_mismatch");
	if (input.consumedApproval.action_type !== "external_write") blockedLabels.push("approval_action_mismatch");
	if (input.consumedApproval.workflow_id !== input.writePlan.workflow_id) blockedLabels.push("approval_workflow_mismatch");
	if (input.consumedApproval.consumed_by_attempt_id !== input.writePlan.attempt_id) blockedLabels.push("approval_attempt_mismatch");
	if (input.consumedApproval.consumed_at === undefined || input.consumedApproval.consumption_audit_ref === undefined)
		blockedLabels.push("approval_not_consumed");
	const ready = errors.length === 0 && blockedLabels.length === 0;
	return {
		schema_version: "flowdesk.remote_write_connector_execution_readiness.v1",
		workflow_id: input.writePlan.workflow_id,
		attempt_id: input.writePlan.attempt_id,
		connector_kind: input.writePlan.connector_kind,
		ok: errors.length === 0,
		errors,
		state: ready ? "ready" : "blocked",
		blocked_labels: [...new Set(blockedLabels)],
		remote_write_connector_ready: ready,
		remote_write_attempted: false,
		...disabledRemoteWriteAuthority,
	};
}
