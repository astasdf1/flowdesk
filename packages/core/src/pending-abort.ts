import {
	invalid,
	type ValidationResult,
	valid,
	validateNoForbiddenRawPayloads,
	validateOpaqueId,
} from "./validators.js";

export interface FlowDeskPendingAbortWarningV1 {
	schema_version: "flowdesk.pending_abort_warning.v1";
	warning_id: string;
	workflow_id: string;
	lane_id: string;
	warning_issued_at: string;
	expires_at: string;
	cancel_command: string;
	status: "pending" | "cancelled" | "executed" | "tombstoned";
	dispatch_authority_enabled: false;
}

export interface FlowDeskPendingAbortCancelV1 {
	schema_version: "flowdesk.pending_abort_cancel.v1";
	cancel_id: string;
	warning_id_ref: string;
	workflow_id: string;
	lane_id: string;
	cancelled_at: string;
	cancel_reason: "user_requested_via_command";
	cancel_actor: "user";
	dispatch_authority_enabled: false;
}

function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === "object" && value !== null && !Array.isArray(value);
}

function timestamp(value: unknown, label: string): ValidationResult {
	return typeof value === "string" && Number.isFinite(Date.parse(value))
		? valid()
		: invalid(`${label} must be a parseable timestamp`);
}

function exactString(value: unknown, expected: string, label: string): ValidationResult {
	return value === expected ? valid() : invalid(`${label} must be ${expected}`);
}

export function validateFlowDeskPendingAbortWarningV1(value: unknown): ValidationResult {
	if (!isRecord(value)) return invalid("pending abort warning must be an object");
	const record = value as Partial<FlowDeskPendingAbortWarningV1>;
	const errors: string[] = [];
	const allowed = new Set([
		"schema_version",
		"warning_id",
		"workflow_id",
		"lane_id",
		"warning_issued_at",
		"expires_at",
		"cancel_command",
		"status",
		"dispatch_authority_enabled",
	]);
	for (const key of Object.keys(record)) if (!allowed.has(key)) errors.push(`unknown properties: ${key}`);
	errors.push(...exactString(record.schema_version, "flowdesk.pending_abort_warning.v1", "schema_version").errors);
	errors.push(...validateOpaqueId(record.warning_id, "warning_id").errors);
	errors.push(...validateOpaqueId(record.workflow_id, "workflow_id").errors);
	errors.push(...validateOpaqueId(record.lane_id, "lane_id").errors);
	errors.push(...timestamp(record.warning_issued_at, "warning_issued_at").errors);
	errors.push(...timestamp(record.expires_at, "expires_at").errors);
	if (typeof record.cancel_command !== "string" || !record.cancel_command.includes("/flowdesk-abort"))
		errors.push("cancel_command must be a /flowdesk-abort command string");
	if (!["pending", "cancelled", "executed", "tombstoned"].includes(record.status ?? ""))
		errors.push("pending abort warning status is invalid");
	if (record.dispatch_authority_enabled !== false)
		errors.push("pending abort warning cannot enable dispatch authority");
	errors.push(...validateNoForbiddenRawPayloads(record, "pending_abort_warning").errors);
	return errors.length === 0 ? valid() : invalid(...errors);
}

export function validateFlowDeskPendingAbortCancelV1(value: unknown): ValidationResult {
	if (!isRecord(value)) return invalid("pending abort cancel must be an object");
	const record = value as Partial<FlowDeskPendingAbortCancelV1>;
	const errors: string[] = [];
	const allowed = new Set([
		"schema_version",
		"cancel_id",
		"warning_id_ref",
		"workflow_id",
		"lane_id",
		"cancelled_at",
		"cancel_reason",
		"cancel_actor",
		"dispatch_authority_enabled",
	]);
	for (const key of Object.keys(record)) if (!allowed.has(key)) errors.push(`unknown properties: ${key}`);
	errors.push(...exactString(record.schema_version, "flowdesk.pending_abort_cancel.v1", "schema_version").errors);
	errors.push(...validateOpaqueId(record.cancel_id, "cancel_id").errors);
	errors.push(...validateOpaqueId(record.warning_id_ref, "warning_id_ref").errors);
	errors.push(...validateOpaqueId(record.workflow_id, "workflow_id").errors);
	errors.push(...validateOpaqueId(record.lane_id, "lane_id").errors);
	errors.push(...timestamp(record.cancelled_at, "cancelled_at").errors);
	errors.push(...exactString(record.cancel_reason, "user_requested_via_command", "cancel_reason").errors);
	errors.push(...exactString(record.cancel_actor, "user", "cancel_actor").errors);
	if (record.dispatch_authority_enabled !== false)
		errors.push("pending abort cancel cannot enable dispatch authority");
	errors.push(...validateNoForbiddenRawPayloads(record, "pending_abort_cancel").errors);
	return errors.length === 0 ? valid() : invalid(...errors);
}
