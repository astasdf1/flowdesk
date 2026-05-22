import {
	invalid,
	type ValidationResult,
	valid,
	validateNoForbiddenRawPayloads,
	validateOpaqueId,
	validateOpaqueRef,
} from "./validators.js";

export const FLOWDESK_ADVISORY_FORBIDDEN_CONSUMERS = [
	"guard",
	"approval",
	"dispatch",
	"verification",
	"external_write",
	"reviewer_verdict_acceptance",
] as const;
export type FlowDeskAdvisoryForbiddenConsumerV1 =
	(typeof FLOWDESK_ADVISORY_FORBIDDEN_CONSUMERS)[number];

export interface FlowDeskAdvisoryOutputFirewallV1 {
	schema_version: "flowdesk.advisory_output_firewall.v1";
	advisory_ref: string;
	workflow_id: string;
	source_schema_version: string;
	allowed_consumer_refs: string[];
	forbidden_consumers: FlowDeskAdvisoryForbiddenConsumerV1[];
	advisory_only: true;
	guard_authority_enabled: false;
	approval_authority_enabled: false;
	dispatch_authority_enabled: false;
	verification_authority_enabled: false;
	external_write_authority_enabled: false;
}

export interface FlowDeskFederatedRegistryStateV1 {
	schema_version: "flowdesk.federated_registry_state.v1";
	registry_state_id: string;
	workflow_id: string;
	state: "disabled" | "documentation_only";
	policy_ref: string;
	remote_upload_enabled: false;
	remote_download_enabled: false;
	planning_influence_enabled: false;
	ranking_influence_enabled: false;
	guard_influence_enabled: false;
	approval_influence_enabled: false;
	dispatch_influence_enabled: false;
	external_write_authority_enabled: false;
}

function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === "object" && value !== null && !Array.isArray(value);
}

function rejectUnknownProperties(record: Record<string, unknown>, allowed: readonly string[], label: string): ValidationResult {
	const unknown = Object.keys(record).filter((key) => !allowed.includes(key));
	return unknown.length === 0 ? valid() : invalid(`${label} unknown properties: ${unknown.join(",")}`);
}

function refs(value: unknown, label: string): ValidationResult {
	if (!Array.isArray(value)) return invalid(`${label} must be an array`);
	const errors: string[] = [];
	for (const [index, ref] of value.entries()) errors.push(...validateOpaqueRef(ref, `${label}[${index}]`).errors);
	return errors.length === 0 ? valid() : invalid(...errors);
}

export function validateFlowDeskAdvisoryOutputFirewallV1(value: unknown): ValidationResult {
	if (!isRecord(value)) return invalid("advisory output firewall must be an object");
	const record = value as Partial<FlowDeskAdvisoryOutputFirewallV1>;
	const errors: string[] = [];
	errors.push(...rejectUnknownProperties(record, [
		"schema_version",
		"advisory_ref",
		"workflow_id",
		"source_schema_version",
		"allowed_consumer_refs",
		"forbidden_consumers",
		"advisory_only",
		"guard_authority_enabled",
		"approval_authority_enabled",
		"dispatch_authority_enabled",
		"verification_authority_enabled",
		"external_write_authority_enabled",
	], "advisory output firewall").errors);
	errors.push(...validateOpaqueRef(record.advisory_ref, "advisory_ref").errors);
	errors.push(...validateOpaqueId(record.workflow_id, "workflow_id").errors);
	if (typeof record.source_schema_version !== "string" || !/^flowdesk\.[a-z0-9_.-]+\.v1$/.test(record.source_schema_version)) errors.push("source_schema_version is invalid");
	errors.push(...refs(record.allowed_consumer_refs, "allowed_consumer_refs").errors);
	if (!Array.isArray(record.forbidden_consumers)) errors.push("forbidden_consumers must be an array");
	else {
		for (const consumer of FLOWDESK_ADVISORY_FORBIDDEN_CONSUMERS)
			if (!record.forbidden_consumers.includes(consumer)) errors.push(`forbidden_consumers must include ${consumer}`);
		for (const [index, consumer] of record.forbidden_consumers.entries())
			if (!(FLOWDESK_ADVISORY_FORBIDDEN_CONSUMERS as readonly string[]).includes(consumer)) errors.push(`forbidden_consumers[${index}] is invalid`);
	}
	if (record.schema_version !== "flowdesk.advisory_output_firewall.v1") errors.push("advisory output firewall schema_version is invalid");
	if (record.advisory_only !== true || record.guard_authority_enabled !== false || record.approval_authority_enabled !== false || record.dispatch_authority_enabled !== false || record.verification_authority_enabled !== false || record.external_write_authority_enabled !== false) errors.push("advisory output firewall cannot enable authority");
	errors.push(...validateNoForbiddenRawPayloads(record, "advisory_output_firewall").errors);
	return errors.length === 0 ? valid() : invalid(...errors);
}

export function validateFlowDeskFederatedRegistryStateV1(value: unknown): ValidationResult {
	if (!isRecord(value)) return invalid("federated registry state must be an object");
	const record = value as Partial<FlowDeskFederatedRegistryStateV1>;
	const errors: string[] = [];
	errors.push(...rejectUnknownProperties(record, [
		"schema_version",
		"registry_state_id",
		"workflow_id",
		"state",
		"policy_ref",
		"remote_upload_enabled",
		"remote_download_enabled",
		"planning_influence_enabled",
		"ranking_influence_enabled",
		"guard_influence_enabled",
		"approval_influence_enabled",
		"dispatch_influence_enabled",
		"external_write_authority_enabled",
	], "federated registry state").errors);
	errors.push(...validateOpaqueId(record.registry_state_id, "registry_state_id").errors);
	errors.push(...validateOpaqueId(record.workflow_id, "workflow_id").errors);
	errors.push(...validateOpaqueRef(record.policy_ref, "policy_ref").errors);
	if (record.schema_version !== "flowdesk.federated_registry_state.v1") errors.push("federated registry state schema_version is invalid");
	if (record.state !== "disabled" && record.state !== "documentation_only") errors.push("federated registry state is invalid");
	if (record.remote_upload_enabled !== false || record.remote_download_enabled !== false || record.planning_influence_enabled !== false || record.ranking_influence_enabled !== false || record.guard_influence_enabled !== false || record.approval_influence_enabled !== false || record.dispatch_influence_enabled !== false || record.external_write_authority_enabled !== false) errors.push("federated registry state cannot enable sharing or influence");
	errors.push(...validateNoForbiddenRawPayloads(record, "federated_registry_state").errors);
	return errors.length === 0 ? valid() : invalid(...errors);
}
