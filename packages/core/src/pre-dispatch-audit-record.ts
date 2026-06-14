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
	attempt_id: string;
	binding_ref: string;
	verification_ref: string;
	approval_source_ref: string;
	idempotency_ref: string;
	evidence_bundle_refs: string[];
	redaction_validation_passed: true;
	auditor_observed_at: string;
	observed_at?: string;
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

function validateRequiredFields(
	value: Record<string, unknown>,
	fields: readonly string[],
): string[] {
	const missing = fields.filter((field) => !(field in value));
	return missing.length === 0
		? []
		: [`missing required fields: ${missing.join(",")}`];
}

function validateOpaqueRefArray(value: unknown, label: string): string[] {
	if (!Array.isArray(value)) return [`${label} must be an array`];
	return value.flatMap((entry, index) =>
		validateOpaqueRef(entry, `${label}[${index}]`).errors,
	);
}

export function validateFlowDeskPreDispatchAuditRecordV1(
	value: unknown,
): ValidationResult {
	if (!isRecord(value))
		return invalid("pre-dispatch audit record must be an object");
	const errors: string[] = [];
	const requiredFields = [
		"schema_version",
		"workflow_id",
		"pre_dispatch_audit_ref",
		"attempt_id",
		"binding_ref",
		"verification_ref",
		"approval_source_ref",
		"idempotency_ref",
		"evidence_bundle_refs",
		"redaction_validation_passed",
		"auditor_observed_at",
	] as const;
	const allowed = new Set([
		"schema_version",
		"workflow_id",
		"pre_dispatch_audit_ref",
		"attempt_id",
		"binding_ref",
		"verification_ref",
		"approval_source_ref",
		"idempotency_ref",
		"evidence_bundle_refs",
		"redaction_validation_passed",
		"auditor_observed_at",
		"observed_at",
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
	errors.push(...validateRequiredFields(value, requiredFields));
	if (value.schema_version !== "flowdesk.pre_dispatch_audit_record.v1")
		errors.push("pre-dispatch audit record schema_version is invalid");
	errors.push(...validateOpaqueId(value.workflow_id, "workflow_id").errors);
	errors.push(
		...validateOpaqueRef(
			value.pre_dispatch_audit_ref,
			"pre_dispatch_audit_ref",
		).errors,
	);
	if (value.observed_at !== undefined && !isParseableTimestamp(value.observed_at))
		errors.push("observed_at must be a parseable timestamp");
	if (!isParseableTimestamp(value.auditor_observed_at))
		errors.push("auditor_observed_at must be a parseable timestamp");
	if (value.redaction_validation_passed !== true)
		errors.push("redaction_validation_passed must be true");
	errors.push(...validateOpaqueRefArray(value.evidence_bundle_refs, "evidence_bundle_refs"));
	for (const [field, label] of [
		[value.attempt_id, "attempt_id"],
		[value.binding_ref, "binding_ref"],
		[value.verification_ref, "verification_ref"],
		[value.approval_source_ref, "approval_source_ref"],
		[value.idempotency_ref, "idempotency_ref"],
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
