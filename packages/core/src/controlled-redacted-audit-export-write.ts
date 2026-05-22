import {
	invalid,
	type ValidationResult,
	valid,
	validateNoForbiddenRawPayloads,
	validateOpaqueId,
	validateOpaqueRef,
} from "./validators.js";

export interface FlowDeskControlledRedactedAuditExportWriteRecordV1 {
	schema_version: "flowdesk.controlled_redacted_audit_export_write.v1";
	ledger_entry_id: string;
	request_id: string;
	workflow_id: string;
	attempt_id: string;
	target_kind: "redacted_audit_export";
	target_ref: string;
	approval_id: string;
	actor_ref: string;
	profile_ref: string;
	evidence_bundle_hash: string;
	guard_decision_ref: string;
	issuance_audit_ref: string;
	consumption_audit_ref: string;
	redaction_policy_ref: string;
	content_hash_ref: string;
	pre_write_audit_ref: string;
	dry_run_ref: string;
	artifact_ref: string;
	artifact_path: string;
	artifact_sha256_ref: string;
	materialized_at: string;
	local_only: true;
	redacted: true;
	writeAttempted: true;
	remoteWriteAttempted: false;
	githubWriteAttempted: false;
	connectorWriteAttempted: false;
	storageWriteAttempted: false;
	databaseWriteAttempted: false;
	urlWriteAttempted: false;
	rawPathWriteAttempted: false;
	dispatch_authority_enabled: false;
	realOpenCodeDispatch: false;
	providerCall: false;
	actualLaneLaunch: false;
	runtimeExecution: false;
	fallbackAuthority: false;
	toolAuthority: false;
	hardCancelOrNoReplyAuthority: false;
}

function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === "object" && value !== null && !Array.isArray(value);
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

function validateArtifactPath(path: unknown, workflowId: unknown, targetRef: unknown): ValidationResult {
	if (typeof path !== "string") return invalid("artifact_path must be a string");
	if (typeof workflowId !== "string") return invalid("workflow_id must be a string");
	if (typeof targetRef !== "string") return invalid("target_ref must be a string");
	if (path !== `.flowdesk/sessions/${workflowId}/redacted-audit/${targetRef}.json`)
		return invalid("artifact_path must be the controlled redacted audit export path for workflow_id and target_ref");
	if (
		path.startsWith("/") ||
		/^[A-Za-z]:[\\/]/.test(path) ||
		path.startsWith("~") ||
		path.includes("\\") ||
		path.includes("//") ||
		path.includes("/../") ||
		path.endsWith("/..") ||
		path.includes("/./")
	)
		return invalid("artifact_path must be a relative .flowdesk path without traversal");
	return validateNoForbiddenRawPayloads(path, "artifact_path");
}

export function validateFlowDeskControlledRedactedAuditExportWriteRecordV1(
	value: unknown,
): ValidationResult {
	if (!isRecord(value))
		return invalid("controlled redacted audit export write record must be an object");
	const record = value as Partial<FlowDeskControlledRedactedAuditExportWriteRecordV1>;
	const errors: string[] = [];
	const allowed = [
		"schema_version",
		"ledger_entry_id",
		"request_id",
		"workflow_id",
		"attempt_id",
		"target_kind",
		"target_ref",
		"approval_id",
		"actor_ref",
		"profile_ref",
		"evidence_bundle_hash",
		"guard_decision_ref",
		"issuance_audit_ref",
		"consumption_audit_ref",
		"redaction_policy_ref",
		"content_hash_ref",
		"pre_write_audit_ref",
		"dry_run_ref",
		"artifact_ref",
		"artifact_path",
		"artifact_sha256_ref",
		"materialized_at",
		"local_only",
		"redacted",
		"writeAttempted",
		"remoteWriteAttempted",
		"githubWriteAttempted",
		"connectorWriteAttempted",
		"storageWriteAttempted",
		"databaseWriteAttempted",
		"urlWriteAttempted",
		"rawPathWriteAttempted",
		"dispatch_authority_enabled",
		"realOpenCodeDispatch",
		"providerCall",
		"actualLaneLaunch",
		"runtimeExecution",
		"fallbackAuthority",
		"toolAuthority",
		"hardCancelOrNoReplyAuthority",
	] as const;
	errors.push(
		...rejectUnknownProperties(
			record,
			allowed,
			"controlled redacted audit export write record",
		).errors,
	);
	if (record.schema_version !== "flowdesk.controlled_redacted_audit_export_write.v1")
		errors.push("controlled redacted audit export write record schema_version is invalid");
	for (const [valueToCheck, label] of [
		[record.ledger_entry_id, "ledger_entry_id"],
		[record.request_id, "request_id"],
		[record.workflow_id, "workflow_id"],
		[record.attempt_id, "attempt_id"],
	] as const)
		errors.push(...validateOpaqueId(valueToCheck, label).errors);
	if (record.target_kind !== "redacted_audit_export")
		errors.push("target_kind must be redacted_audit_export");
	for (const [valueToCheck, label] of [
		[record.target_ref, "target_ref"],
		[record.approval_id, "approval_id"],
		[record.actor_ref, "actor_ref"],
		[record.profile_ref, "profile_ref"],
		[record.guard_decision_ref, "guard_decision_ref"],
		[record.issuance_audit_ref, "issuance_audit_ref"],
		[record.consumption_audit_ref, "consumption_audit_ref"],
		[record.redaction_policy_ref, "redaction_policy_ref"],
		[record.pre_write_audit_ref, "pre_write_audit_ref"],
		[record.dry_run_ref, "dry_run_ref"],
		[record.artifact_ref, "artifact_ref"],
	] as const)
		errors.push(...validateOpaqueRef(valueToCheck, label).errors);
	errors.push(...validateHashRef(record.evidence_bundle_hash, "evidence_bundle_hash").errors);
	errors.push(...validateHashRef(record.content_hash_ref, "content_hash_ref").errors);
	errors.push(...validateHashRef(record.artifact_sha256_ref, "artifact_sha256_ref").errors);
	errors.push(
		...validateArtifactPath(record.artifact_path, record.workflow_id, record.target_ref).errors,
	);
	errors.push(...validateTimestamp(record.materialized_at, "materialized_at").errors);
	if (record.content_hash_ref !== record.artifact_sha256_ref)
		errors.push("content_hash_ref must match artifact_sha256_ref");
	if (record.local_only !== true || record.redacted !== true || record.writeAttempted !== true)
		errors.push("controlled redacted audit export write must be local-only, redacted, and attempted");
	if (
		record.remoteWriteAttempted !== false ||
		record.githubWriteAttempted !== false ||
		record.connectorWriteAttempted !== false ||
		record.storageWriteAttempted !== false ||
		record.databaseWriteAttempted !== false ||
		record.urlWriteAttempted !== false ||
		record.rawPathWriteAttempted !== false ||
		record.dispatch_authority_enabled !== false ||
		record.realOpenCodeDispatch !== false ||
		record.providerCall !== false ||
		record.actualLaneLaunch !== false ||
		record.runtimeExecution !== false ||
		record.fallbackAuthority !== false ||
		record.toolAuthority !== false ||
		record.hardCancelOrNoReplyAuthority !== false
	)
		errors.push("controlled redacted audit export write cannot enable external, dispatch, fallback, tool, or hard-chat authority");
	errors.push(
		...validateNoForbiddenRawPayloads(
			record,
			"controlled_redacted_audit_export_write_record",
		).errors,
	);
	return errors.length === 0 ? valid() : invalid(...errors);
}
