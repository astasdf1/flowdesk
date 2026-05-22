import {
	type FlowDeskConnectorProfileV1,
	type FlowDeskConnectorRecipeRefV1,
	validateFlowDeskConnectorProfileV1,
	validateFlowDeskConnectorRecipeRefV1,
} from "./connector-profile.js";
import {
	type FlowDeskRemoteWriteConnectorExecutionReadinessV1,
	type FlowDeskRemoteWritePlanV1,
	validateFlowDeskRemoteWritePlanV1,
} from "./remote-write-connector-gate.js";
import {
	invalid,
	type ValidationResult,
	valid,
	validateNoForbiddenRawPayloads,
	validateOpaqueRef,
} from "./validators.js";

export interface FlowDeskConnectorGatewayInvocationPlanV1 extends ValidationResult {
	schema_version: "flowdesk.connector_gateway_invocation_plan.v1";
	workflow_id?: string;
	attempt_id?: string;
	state: "gateway_ready" | "blocked";
	blocked_labels: string[];
	connector_profile_ref?: string;
	connector_recipe_ref?: string;
	connector_kind?: string;
	target_ref?: string;
	content_hash_ref?: string;
	pre_write_audit_ref?: string;
	idempotency_key_ref?: string;
	gateway_execution_attempted: false;
	remote_write_attempted: false;
	connector_write_attempted: false;
	remote_write_authority_enabled: false;
	external_write_authority_enabled: false;
	dispatch_authority_enabled: false;
	providerCall: false;
	actualLaneLaunch: false;
	runtimeExecution: false;
}

const disabledGatewayAuthority = {
	gateway_execution_attempted: false as const,
	remote_write_attempted: false as const,
	connector_write_attempted: false as const,
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

function rejectUnknownProperties(record: Record<string, unknown>, allowed: readonly string[], label: string): ValidationResult {
	const unknown = Object.keys(record).filter((key) => !allowed.includes(key));
	return unknown.length === 0 ? valid() : invalid(`${label} unknown properties: ${unknown.join(",")}`);
}

export function validateFlowDeskConnectorGatewayInvocationPlanV1(value: unknown): ValidationResult {
	if (!isRecord(value)) return invalid("connector gateway invocation plan must be an object");
	const record = value as Partial<FlowDeskConnectorGatewayInvocationPlanV1>;
	const errors: string[] = [];
	errors.push(...rejectUnknownProperties(record, [
		"schema_version",
		"workflow_id",
		"attempt_id",
		"ok",
		"errors",
		"state",
		"blocked_labels",
		"connector_profile_ref",
		"connector_recipe_ref",
		"connector_kind",
		"target_ref",
		"content_hash_ref",
		"pre_write_audit_ref",
		"idempotency_key_ref",
		"gateway_execution_attempted",
		"remote_write_attempted",
		"connector_write_attempted",
		"remote_write_authority_enabled",
		"external_write_authority_enabled",
		"dispatch_authority_enabled",
		"providerCall",
		"actualLaneLaunch",
		"runtimeExecution",
	], "connector gateway invocation plan").errors);
	if (record.schema_version !== "flowdesk.connector_gateway_invocation_plan.v1") errors.push("connector gateway invocation plan schema_version is invalid");
	if (record.workflow_id !== undefined) errors.push(...validateOpaqueRef(record.workflow_id, "workflow_id").errors);
	if (record.attempt_id !== undefined) errors.push(...validateOpaqueRef(record.attempt_id, "attempt_id").errors);
	if (record.state !== "gateway_ready" && record.state !== "blocked") errors.push("connector gateway state is invalid");
	if (!Array.isArray(record.blocked_labels)) errors.push("blocked_labels must be an array");
	else for (const [index, label] of record.blocked_labels.entries()) errors.push(...validateOpaqueRef(label, `blocked_labels[${index}]`).errors);
	for (const [value, label] of [
		[record.connector_profile_ref, "connector_profile_ref"],
		[record.connector_recipe_ref, "connector_recipe_ref"],
		[record.target_ref, "target_ref"],
		[record.content_hash_ref, "content_hash_ref"],
		[record.pre_write_audit_ref, "pre_write_audit_ref"],
		[record.idempotency_key_ref, "idempotency_key_ref"],
	] as const)
		if (value !== undefined) errors.push(...validateOpaqueRef(value, label).errors);
	if (record.state === "gateway_ready" && (record.blocked_labels?.length ?? 0) > 0) errors.push("gateway_ready plan cannot carry blocked labels");
	if (record.state === "blocked" && (record.blocked_labels?.length ?? 0) === 0) errors.push("blocked gateway plan requires blocked labels");
	if (record.gateway_execution_attempted !== false || record.remote_write_attempted !== false || record.connector_write_attempted !== false || record.remote_write_authority_enabled !== false || record.external_write_authority_enabled !== false || record.dispatch_authority_enabled !== false || record.providerCall !== false || record.actualLaneLaunch !== false || record.runtimeExecution !== false) errors.push("connector gateway plan cannot attempt execution or enable authority");
	errors.push(...validateNoForbiddenRawPayloads(record, "connector_gateway_invocation_plan").errors);
	return errors.length === 0 ? valid() : invalid(...errors);
}

export function planFlowDeskConnectorGatewayInvocationV1(input: {
	profile: FlowDeskConnectorProfileV1;
	recipe: FlowDeskConnectorRecipeRefV1;
	writePlan: FlowDeskRemoteWritePlanV1;
	readiness: FlowDeskRemoteWriteConnectorExecutionReadinessV1;
}): FlowDeskConnectorGatewayInvocationPlanV1 {
	const errors: string[] = [];
	const blockedLabels: string[] = [];
	const profileResult = validateFlowDeskConnectorProfileV1(input.profile);
	const recipeResult = validateFlowDeskConnectorRecipeRefV1(input.recipe);
	const writePlanResult = validateFlowDeskRemoteWritePlanV1(input.writePlan);
	const readinessResult = validateFlowDeskConnectorGatewayReadinessShape(input.readiness);
	errors.push(...profileResult.errors, ...recipeResult.errors, ...writePlanResult.errors, ...readinessResult.errors);
	if (!profileResult.ok) blockedLabels.push("connector_profile_invalid");
	if (!recipeResult.ok) blockedLabels.push("connector_recipe_invalid");
	if (!writePlanResult.ok) blockedLabels.push("write_plan_invalid");
	if (!readinessResult.ok) blockedLabels.push("readiness_invalid");
	if (input.readiness.state !== "ready" || input.readiness.remote_write_connector_ready !== true) blockedLabels.push("remote_write_readiness_not_ready");
	if (input.profile.profile_id !== input.recipe.connector_profile_ref) blockedLabels.push("profile_recipe_ref_mismatch");
	if (input.profile.connector_kind !== input.recipe.connector_kind || input.profile.connector_kind !== input.writePlan.connector_kind) blockedLabels.push("connector_kind_mismatch");
	if (!input.profile.allowed_target_kinds.includes(input.recipe.target_kind)) blockedLabels.push("target_kind_not_allowed");
	if (input.writePlan.workflow_id !== input.readiness.workflow_id) blockedLabels.push("workflow_mismatch");
	if (input.writePlan.attempt_id !== input.readiness.attempt_id) blockedLabels.push("attempt_mismatch");
	if (input.writePlan.connector_kind !== input.readiness.connector_kind) blockedLabels.push("readiness_connector_mismatch");
	const ready = errors.length === 0 && blockedLabels.length === 0;
	return {
		schema_version: "flowdesk.connector_gateway_invocation_plan.v1",
		workflow_id: input.writePlan.workflow_id,
		attempt_id: input.writePlan.attempt_id,
		ok: errors.length === 0,
		errors,
		state: ready ? "gateway_ready" : "blocked",
		blocked_labels: [...new Set(blockedLabels)],
		connector_profile_ref: input.profile.profile_id,
		connector_recipe_ref: input.recipe.recipe_ref,
		connector_kind: input.writePlan.connector_kind,
		target_ref: input.writePlan.target_ref,
		content_hash_ref: input.writePlan.content_hash_ref,
		pre_write_audit_ref: input.writePlan.pre_write_audit_ref,
		idempotency_key_ref: input.writePlan.idempotency_key_ref,
		...disabledGatewayAuthority,
	};
}

function validateFlowDeskConnectorGatewayReadinessShape(value: unknown): ValidationResult {
	if (!isRecord(value)) return invalid("remote write readiness must be an object");
	const record = value as Partial<FlowDeskRemoteWriteConnectorExecutionReadinessV1>;
	const errors: string[] = [];
	if (record.schema_version !== "flowdesk.remote_write_connector_execution_readiness.v1") errors.push("readiness schema_version is invalid");
	if ((record as Record<string, unknown>).gateway_execution_attempted !== undefined) errors.push("readiness cannot predeclare gateway execution");
	if (record.remote_write_attempted !== false || record.remote_write_authority_enabled !== false || record.external_write_authority_enabled !== false || record.dispatch_authority_enabled !== false || record.providerCall !== false || record.actualLaneLaunch !== false || record.runtimeExecution !== false) errors.push("readiness cannot enable authority");
	errors.push(...validateNoForbiddenRawPayloads(record, "connector_gateway_readiness").errors);
	return errors.length === 0 ? valid() : invalid(...errors);
}
