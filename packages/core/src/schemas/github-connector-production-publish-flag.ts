import { invalid, type ValidationResult, valid, validateNoForbiddenRawPayloads, validateOpaqueRef, validateTimestamp } from "../validators.js";

export type FlowDeskGitHubConnectorProductionPublishStateV1 = "enabled" | "disabled" | "unknown";

export interface FlowDeskGitHubConnectorProductionPublishFlagV1 {
	schema_version: "flowdesk.github_connector_production_publish_flag.v1";
	state: FlowDeskGitHubConnectorProductionPublishStateV1;
	consumes_surplus_usage_gate_ref?: string;
	consumes_minimization_policy_ref?: string;
	consumes_guard_approval_ref?: string;
	created_at: string;
	advisory_only: true;
	non_authorizing: true;
	remote_write_authority_enabled: false;
	dispatch_authority_enabled: false;
	write_authority_enabled: false;
}

export interface FlowDeskGitHubConnectorProductionPublishFlagResultV1 {
	ok: boolean;
	errors: string[];
	flag?: FlowDeskGitHubConnectorProductionPublishFlagV1;
}

export function createFlowDeskGitHubConnectorProductionPublishFlagV1(input: {
	state?: FlowDeskGitHubConnectorProductionPublishStateV1;
	consumesSurplusUsageGateRef?: string;
	consumesMinimizationPolicyRef?: string;
	consumesGuardApprovalRef?: string;
	createdAt: string;
}): FlowDeskGitHubConnectorProductionPublishFlagResultV1 {
	const state = input.state ?? "disabled";
	const flag: FlowDeskGitHubConnectorProductionPublishFlagV1 = {
		schema_version: "flowdesk.github_connector_production_publish_flag.v1",
		state,
		...(input.consumesSurplusUsageGateRef === undefined ? {} : { consumes_surplus_usage_gate_ref: input.consumesSurplusUsageGateRef }),
		...(input.consumesMinimizationPolicyRef === undefined ? {} : { consumes_minimization_policy_ref: input.consumesMinimizationPolicyRef }),
		...(input.consumesGuardApprovalRef === undefined ? {} : { consumes_guard_approval_ref: input.consumesGuardApprovalRef }),
		created_at: input.createdAt,
		advisory_only: true,
		non_authorizing: true,
		remote_write_authority_enabled: false,
		dispatch_authority_enabled: false,
		write_authority_enabled: false,
	};
	const validation = validateFlowDeskGitHubConnectorProductionPublishFlagV1(flag);
	return validation.ok ? { ok: true, errors: [], flag } : { ok: false, errors: validation.errors };
}

export function validateFlowDeskGitHubConnectorProductionPublishFlagV1(value: unknown): ValidationResult {
	if (typeof value !== "object" || value === null || Array.isArray(value)) return invalid("production publish flag must be an object");
	const record = value as Partial<FlowDeskGitHubConnectorProductionPublishFlagV1>;
	const errors: string[] = [];
	const allowed = new Set([
		"schema_version",
		"state",
		"consumes_surplus_usage_gate_ref",
		"consumes_minimization_policy_ref",
		"consumes_guard_approval_ref",
		"created_at",
		"advisory_only",
		"non_authorizing",
		"remote_write_authority_enabled",
		"dispatch_authority_enabled",
		"write_authority_enabled",
	]);
	for (const key of Object.keys(record)) if (!allowed.has(key)) errors.push(`production publish flag has unknown property ${key}`);
	if (record.schema_version !== "flowdesk.github_connector_production_publish_flag.v1") errors.push("production publish flag schema_version is invalid");
	if (record.state !== "enabled" && record.state !== "disabled" && record.state !== "unknown") errors.push("production publish flag state is invalid");
	errors.push(...validateTimestamp(record.created_at, "created_at").errors);
	if (record.consumes_surplus_usage_gate_ref !== undefined) errors.push(...validateOpaqueRef(record.consumes_surplus_usage_gate_ref, "consumes_surplus_usage_gate_ref").errors);
	if (record.consumes_minimization_policy_ref !== undefined) errors.push(...validateOpaqueRef(record.consumes_minimization_policy_ref, "consumes_minimization_policy_ref").errors);
	if (record.consumes_guard_approval_ref !== undefined) errors.push(...validateOpaqueRef(record.consumes_guard_approval_ref, "consumes_guard_approval_ref").errors);
	if (record.state === "enabled") {
		if (record.consumes_surplus_usage_gate_ref === undefined) errors.push("consumes_surplus_usage_gate_ref is required when state=enabled");
		if (record.consumes_minimization_policy_ref === undefined) errors.push("consumes_minimization_policy_ref is required when state=enabled");
		if (record.consumes_guard_approval_ref === undefined) errors.push("consumes_guard_approval_ref is required when state=enabled");
	}
	if (record.advisory_only !== true) errors.push("advisory_only must be true");
	if (record.non_authorizing !== true) errors.push("non_authorizing must be true");
	if (record.remote_write_authority_enabled !== false) errors.push("remote_write_authority_enabled must be false");
	if (record.dispatch_authority_enabled !== false) errors.push("dispatch_authority_enabled must be false");
	if (record.write_authority_enabled !== false) errors.push("write_authority_enabled must be false");
	errors.push(...validateNoForbiddenRawPayloads(record, "github_connector_production_publish_flag").errors);
	return errors.length === 0 ? valid() : invalid(...errors);
}
