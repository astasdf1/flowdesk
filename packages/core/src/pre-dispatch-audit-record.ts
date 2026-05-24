import {
	invalid,
	type ValidationResult,
	valid,
	validateNoForbiddenRawPayloads,
	validateOpaqueId,
	validateOpaqueRef,
} from "./validators.js";

export interface FlowDeskPreDispatchAuditRecordV1 {
	schema_version: "flowdesk.pre_dispatch_audit_record.v1";
	workflow_id: string;
	pre_dispatch_audit_ref: string;
	observed_at: string;
	attempt_id?: string;
	plan_revision_id?: string;
	approval_ref?: string;
	policy_pack_hash?: string;
	dispatch_authority_enabled?: false;
	providerCall?: false;
	actualLaneLaunch?: false;
	runtimeExecution?: false;
}

function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isParseableTimestamp(value: unknown): value is string {
	return typeof value === "string" && Number.isFinite(Date.parse(value));
}

export function validateFlowDeskPreDispatchAuditRecordV1(
	value: unknown,
): ValidationResult {
	if (!isRecord(value))
		return invalid("pre-dispatch audit record must be an object");
	const errors: string[] = [];
	const allowed = new Set([
		"schema_version",
		"workflow_id",
		"pre_dispatch_audit_ref",
		"observed_at",
		"attempt_id",
		"plan_revision_id",
		"approval_ref",
		"policy_pack_hash",
		"dispatch_authority_enabled",
		"providerCall",
		"actualLaneLaunch",
		"runtimeExecution",
	]);
	for (const key of Object.keys(value))
		if (!allowed.has(key)) errors.push(`unknown properties: ${key}`);
	if (value.schema_version !== "flowdesk.pre_dispatch_audit_record.v1")
		errors.push("pre-dispatch audit record schema_version is invalid");
	errors.push(...validateOpaqueId(value.workflow_id, "workflow_id").errors);
	errors.push(
		...validateOpaqueRef(
			value.pre_dispatch_audit_ref,
			"pre_dispatch_audit_ref",
		).errors,
	);
	if (!isParseableTimestamp(value.observed_at))
		errors.push("observed_at must be a parseable timestamp");
	for (const [field, label] of [
		[value.attempt_id, "attempt_id"],
		[value.plan_revision_id, "plan_revision_id"],
		[value.approval_ref, "approval_ref"],
		[value.policy_pack_hash, "policy_pack_hash"],
	] as const) {
		if (field === undefined) continue;
		errors.push(...validateOpaqueRef(field, label).errors);
	}
	if (
		value.dispatch_authority_enabled !== undefined &&
		value.dispatch_authority_enabled !== false
	)
		errors.push(
			"pre-dispatch audit record cannot enable dispatch authority",
		);
	for (const [field, label] of [
		[value.providerCall, "providerCall"],
		[value.actualLaneLaunch, "actualLaneLaunch"],
		[value.runtimeExecution, "runtimeExecution"],
	] as const) {
		if (field === undefined) continue;
		if (field !== false)
			errors.push(
				`pre-dispatch audit record cannot claim ${label}=true`,
			);
	}
	errors.push(
		...validateNoForbiddenRawPayloads(value, "pre_dispatch_audit_record").errors,
	);
	return errors.length === 0 ? valid() : invalid(...errors);
}
