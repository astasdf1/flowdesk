import {
	invalid,
	type ValidationResult,
	valid,
	validateNoForbiddenRawPayloads,
	validateOpaqueId,
	validateOpaqueRef,
} from "./validators.js";
import { FLOWDESK_REMOTE_WRITE_CONNECTOR_KINDS, type FlowDeskRemoteWriteConnectorKindV1 } from "./remote-write-connector-gate.js";

export const FLOWDESK_CONNECTOR_TARGET_KINDS = [
	"github_issue",
	"github_pr_comment",
	"http_endpoint",
	"cloud_storage_object",
	"database_record",
	"custom_mcp_connector",
	"external_ledger_entry",
] as const;
export type FlowDeskConnectorTargetKindV1 =
	(typeof FLOWDESK_CONNECTOR_TARGET_KINDS)[number];

export const FLOWDESK_CONNECTOR_INSTALL_POLICIES = [
	"disabled",
	"approval_required",
] as const;
export type FlowDeskConnectorInstallPolicyV1 =
	(typeof FLOWDESK_CONNECTOR_INSTALL_POLICIES)[number];

export interface FlowDeskConnectorProfileV1 {
	schema_version: "flowdesk.connector_profile.v1";
	profile_id: string;
	connector_kind: FlowDeskRemoteWriteConnectorKindV1;
	active_profile_ref: string;
	allowed_target_kinds: FlowDeskConnectorTargetKindV1[];
	required_tool_refs: string[];
	auth_scope_refs: string[];
	recipe_playbook_refs: string[];
	install_policy: FlowDeskConnectorInstallPolicyV1;
	rollback_ref: string;
	doctor_status_ref: string;
	gateway_execution_authority_enabled: false;
	remote_write_authority_enabled: false;
	external_write_authority_enabled: false;
	dispatch_authority_enabled: false;
}

export interface FlowDeskConnectorRecipeRefV1 {
	schema_version: "flowdesk.connector_recipe_ref.v1";
	recipe_ref: string;
	connector_profile_ref: string;
	connector_kind: FlowDeskRemoteWriteConnectorKindV1;
	target_kind: FlowDeskConnectorTargetKindV1;
	operation_label: string;
	playbook_ref: string;
	content_hash_required: true;
	dry_run_required: true;
	raw_locator_allowed: false;
	gateway_execution_authority_enabled: false;
	remote_write_authority_enabled: false;
	dispatch_authority_enabled: false;
}

function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === "object" && value !== null && !Array.isArray(value);
}

function rejectUnknownProperties(record: Record<string, unknown>, allowed: readonly string[], label: string): ValidationResult {
	const unknown = Object.keys(record).filter((key) => !allowed.includes(key));
	return unknown.length === 0 ? valid() : invalid(`${label} unknown properties: ${unknown.join(",")}`);
}

function refs(value: unknown, label: string, options: { minItems?: number; maxItems?: number } = {}): ValidationResult {
	if (!Array.isArray(value)) return invalid(`${label} must be an array`);
	const errors: string[] = [];
	const minItems = options.minItems ?? 1;
	if (value.length < minItems) errors.push(`${label} must include at least ${minItems} item(s)`);
	if (options.maxItems !== undefined && value.length > options.maxItems) errors.push(`${label} exceeds max items ${options.maxItems}`);
	for (const [index, ref] of value.entries()) errors.push(...validateOpaqueRef(ref, `${label}[${index}]`).errors);
	return errors.length === 0 ? valid() : invalid(...errors);
}

function isConnectorKind(value: unknown): value is FlowDeskRemoteWriteConnectorKindV1 {
	return typeof value === "string" && (FLOWDESK_REMOTE_WRITE_CONNECTOR_KINDS as readonly string[]).includes(value);
}

function isTargetKind(value: unknown): value is FlowDeskConnectorTargetKindV1 {
	return typeof value === "string" && (FLOWDESK_CONNECTOR_TARGET_KINDS as readonly string[]).includes(value);
}

export function validateFlowDeskConnectorProfileV1(value: unknown): ValidationResult {
	if (!isRecord(value)) return invalid("connector profile must be an object");
	const record = value as Partial<FlowDeskConnectorProfileV1>;
	const errors: string[] = [];
	errors.push(...rejectUnknownProperties(record, [
		"schema_version",
		"profile_id",
		"connector_kind",
		"active_profile_ref",
		"allowed_target_kinds",
		"required_tool_refs",
		"auth_scope_refs",
		"recipe_playbook_refs",
		"install_policy",
		"rollback_ref",
		"doctor_status_ref",
		"gateway_execution_authority_enabled",
		"remote_write_authority_enabled",
		"external_write_authority_enabled",
		"dispatch_authority_enabled",
	], "connector profile").errors);
	errors.push(...validateOpaqueId(record.profile_id, "profile_id").errors);
	if (!isConnectorKind(record.connector_kind)) errors.push("connector profile connector_kind is invalid");
	errors.push(...validateOpaqueRef(record.active_profile_ref, "active_profile_ref").errors);
	if (!Array.isArray(record.allowed_target_kinds) || record.allowed_target_kinds.length === 0) errors.push("allowed_target_kinds must be a non-empty array");
	else for (const [index, targetKind] of record.allowed_target_kinds.entries())
		if (!isTargetKind(targetKind)) errors.push(`allowed_target_kinds[${index}] is invalid`);
	errors.push(...refs(record.required_tool_refs, "required_tool_refs", { maxItems: 12 }).errors);
	errors.push(...refs(record.auth_scope_refs, "auth_scope_refs", { maxItems: 8 }).errors);
	errors.push(...refs(record.recipe_playbook_refs, "recipe_playbook_refs", { maxItems: 12 }).errors);
	if (!(FLOWDESK_CONNECTOR_INSTALL_POLICIES as readonly string[]).includes(record.install_policy ?? "")) errors.push("install_policy is invalid");
	for (const [value, label] of [[record.rollback_ref, "rollback_ref"], [record.doctor_status_ref, "doctor_status_ref"]] as const)
		errors.push(...validateOpaqueRef(value, label).errors);
	if (record.schema_version !== "flowdesk.connector_profile.v1") errors.push("connector profile schema_version is invalid");
	if (record.gateway_execution_authority_enabled !== false || record.remote_write_authority_enabled !== false || record.external_write_authority_enabled !== false || record.dispatch_authority_enabled !== false) errors.push("connector profile cannot enable execution authority");
	errors.push(...validateNoForbiddenRawPayloads(record, "connector_profile").errors);
	return errors.length === 0 ? valid() : invalid(...errors);
}

export function validateFlowDeskConnectorRecipeRefV1(value: unknown): ValidationResult {
	if (!isRecord(value)) return invalid("connector recipe ref must be an object");
	const record = value as Partial<FlowDeskConnectorRecipeRefV1>;
	const errors: string[] = [];
	errors.push(...rejectUnknownProperties(record, [
		"schema_version",
		"recipe_ref",
		"connector_profile_ref",
		"connector_kind",
		"target_kind",
		"operation_label",
		"playbook_ref",
		"content_hash_required",
		"dry_run_required",
		"raw_locator_allowed",
		"gateway_execution_authority_enabled",
		"remote_write_authority_enabled",
		"dispatch_authority_enabled",
	], "connector recipe ref").errors);
	errors.push(...validateOpaqueRef(record.recipe_ref, "recipe_ref").errors);
	errors.push(...validateOpaqueRef(record.connector_profile_ref, "connector_profile_ref").errors);
	if (!isConnectorKind(record.connector_kind)) errors.push("connector recipe connector_kind is invalid");
	if (!isTargetKind(record.target_kind)) errors.push("connector recipe target_kind is invalid");
	errors.push(...validateOpaqueRef(record.operation_label, "operation_label").errors);
	errors.push(...validateOpaqueRef(record.playbook_ref, "playbook_ref").errors);
	if (record.schema_version !== "flowdesk.connector_recipe_ref.v1") errors.push("connector recipe schema_version is invalid");
	if (record.content_hash_required !== true || record.dry_run_required !== true || record.raw_locator_allowed !== false) errors.push("connector recipe must require hash, dry-run, and no raw locators");
	if (record.gateway_execution_authority_enabled !== false || record.remote_write_authority_enabled !== false || record.dispatch_authority_enabled !== false) errors.push("connector recipe cannot enable execution authority");
	errors.push(...validateNoForbiddenRawPayloads(record, "connector_recipe_ref").errors);
	return errors.length === 0 ? valid() : invalid(...errors);
}
