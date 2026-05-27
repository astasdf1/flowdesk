import {
	invalid,
	type ValidationResult,
	valid,
	validateOpaqueId,
	validateOpaqueRef,
} from "./validators.js";

export interface FlowDeskControlledWorkspaceFileWriteRecordV1 {
	schema_version: "flowdesk.controlled_workspace_file_write.v1";
	ledger_entry_id: string;
	workflow_id: string;
	user_approval_ref: string;
	target_file_path: string;
	expected_content_sha256_ref?: string;
	previous_content_sha256_ref?: string;
	replacement_content_sha256_ref: string;
	reason_summary: string;
	materialized_at: string;
	dev_beta_explicit_opt_in: true;
	developer_mode_acknowledged: true;
	allow_controlled_write: true;
	local_only: true;
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

function validateSha256Ref(value: unknown, label: string): ValidationResult {
	if (typeof value !== "string") return invalid(`${label} must be a string`);
	return /^sha256-[a-f0-9]{64}$/.test(value)
		? valid()
		: invalid(`${label} must be sha256-<64 lowercase hex>`);
}

export function validateControlledWorkspaceRelativeFilePath(
	value: unknown,
	label = "target_file_path",
): ValidationResult {
	if (typeof value !== "string" || value.trim().length === 0)
		return invalid(`${label} must be a non-empty string`);
	if (value.length > 500) return invalid(`${label} exceeds max length 500`);
	if (
		value.startsWith("/") ||
		/^[A-Za-z]:[\\/]/.test(value) ||
		value.startsWith("~") ||
		value.includes("\\") ||
		value.includes("//") ||
		value === "." ||
		value === ".." ||
		value.startsWith("../") ||
		value.includes("/../") ||
		value.endsWith("/..") ||
		value.startsWith("./") ||
		value.includes("/./")
	)
		return invalid(`${label} must be relative and must not contain traversal or platform separators`);
	if (value.endsWith("/")) return invalid(`${label} must reference a file, not a directory`);
	if (value.split("/").some((segment) => segment.length === 0))
		return invalid(`${label} contains an empty path segment`);
	return valid();
}

function validateReasonSummary(value: unknown): ValidationResult {
	if (typeof value !== "string" || value.trim().length === 0)
		return invalid("reason_summary must be a non-empty string");
	if (value.length > 500) return invalid("reason_summary exceeds max length 500");
	if (/\b(system prompt|developer message|transcript|provider payload|api[_-]?key|bearer\s+[A-Za-z0-9]|token[:=]|credential|secret)\b/i.test(value))
		return invalid("reason_summary contains forbidden raw or credential-shaped marker");
	return valid();
}

export function validateFlowDeskControlledWorkspaceFileWriteRecordV1(
	value: unknown,
): ValidationResult {
	if (!isRecord(value))
		return invalid("controlled workspace file write record must be an object");
	const record = value as Partial<FlowDeskControlledWorkspaceFileWriteRecordV1>;
	const allowed = [
		"schema_version",
		"ledger_entry_id",
		"workflow_id",
		"user_approval_ref",
		"target_file_path",
		"expected_content_sha256_ref",
		"previous_content_sha256_ref",
		"replacement_content_sha256_ref",
		"reason_summary",
		"materialized_at",
		"dev_beta_explicit_opt_in",
		"developer_mode_acknowledged",
		"allow_controlled_write",
		"local_only",
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
	const errors: string[] = [];
	errors.push(
		...rejectUnknownProperties(
			record,
			allowed,
			"controlled workspace file write record",
		).errors,
	);
	if (record.schema_version !== "flowdesk.controlled_workspace_file_write.v1")
		errors.push("controlled workspace file write record schema_version is invalid");
	errors.push(...validateOpaqueId(record.ledger_entry_id, "ledger_entry_id").errors);
	errors.push(...validateOpaqueId(record.workflow_id, "workflow_id").errors);
	errors.push(...validateOpaqueRef(record.user_approval_ref, "user_approval_ref").errors);
	errors.push(...validateControlledWorkspaceRelativeFilePath(record.target_file_path).errors);
	if (record.expected_content_sha256_ref !== undefined)
		errors.push(...validateSha256Ref(record.expected_content_sha256_ref, "expected_content_sha256_ref").errors);
	if (record.previous_content_sha256_ref !== undefined)
		errors.push(...validateSha256Ref(record.previous_content_sha256_ref, "previous_content_sha256_ref").errors);
	errors.push(...validateSha256Ref(record.replacement_content_sha256_ref, "replacement_content_sha256_ref").errors);
	errors.push(...validateReasonSummary(record.reason_summary).errors);
	errors.push(...validateTimestamp(record.materialized_at, "materialized_at").errors);
	if (
		record.dev_beta_explicit_opt_in !== true ||
		record.developer_mode_acknowledged !== true ||
		record.allow_controlled_write !== true ||
		record.local_only !== true ||
		record.writeAttempted !== true
	)
		errors.push("controlled workspace file write must be explicit dev beta, acknowledged, local-only, and attempted");
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
		errors.push("controlled workspace file write cannot enable external, dispatch, fallback, tool, provider, runtime, lane, or hard-chat authority");
	return errors.length === 0 ? valid() : invalid(...errors);
}
