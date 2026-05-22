import {
	invalid,
	type ValidationResult,
	valid,
	validateConcreteProviderQualifiedModelId,
	validateNoForbiddenRawPayloads,
	validateOpaqueId,
	validateOpaqueRef,
} from "./validators.js";

export const FLOWDESK_PERMISSION_ASK_DECISIONS = [
	"ask",
	"deny",
	"allow",
] as const;
export type FlowDeskPermissionAskDecisionStatusV1 =
	(typeof FLOWDESK_PERMISSION_ASK_DECISIONS)[number];

export const FLOWDESK_PERMISSION_DENY_REASONS = [
	"non_dispatch_release1_default",
	"policy_pack_forbid",
	"guard_unapproved",
	"hard_chat_authority_required",
	"redacted_unsafe_action",
	"raw_payload_forbidden",
	"missing_durable_evidence",
] as const;
export type FlowDeskPermissionDenyReasonV1 =
	(typeof FLOWDESK_PERMISSION_DENY_REASONS)[number];

export interface FlowDeskPermissionAskDecisionV1 {
	schema_version: "flowdesk.permission_ask_decision.v1";
	decision_id: string;
	workflow_id: string;
	attempt_id: string;
	session_ref: string;
	requested_permission_kind_ref: string;
	policy_pack_ref: string;
	status: FlowDeskPermissionAskDecisionStatusV1;
	deny_reason?: FlowDeskPermissionDenyReasonV1;
	observed_at: string;
	dispatch_authority_enabled: false;
	providerCall: false;
	actualLaneLaunch: false;
	runtimeExecution: false;
	hardCancelOrNoReplyAuthority: false;
}

export const FLOWDESK_SESSION_ABORT_REASONS = [
	"user_requested_abort",
	"guard_revoked",
	"approval_expired",
	"policy_violation_detected",
	"stale_evidence_detected",
	"orphan_lane_cleanup",
	"provider_failure_terminal",
] as const;
export type FlowDeskSessionAbortReasonV1 =
	(typeof FLOWDESK_SESSION_ABORT_REASONS)[number];

export interface FlowDeskSessionAbortDecisionV1 {
	schema_version: "flowdesk.session_abort_decision.v1";
	decision_id: string;
	workflow_id: string;
	attempt_id: string;
	session_ref: string;
	abort_reason: FlowDeskSessionAbortReasonV1;
	policy_pack_ref: string;
	guard_decision_ref: string;
	pre_abort_audit_ref: string;
	created_at: string;
	dispatch_authority_enabled: false;
	providerCall: false;
	actualLaneLaunch: false;
	runtimeExecution: false;
	hardCancelOrNoReplyAuthority: false;
	session_abort_authorized: true;
}

export const FLOWDESK_PROMPT_NO_REPLY_REASONS = [
	"context_commit_only",
	"audit_breadcrumb_only",
	"recovery_state_only",
	"fallback_pre_reset_only",
] as const;
export type FlowDeskPromptNoReplyReasonV1 =
	(typeof FLOWDESK_PROMPT_NO_REPLY_REASONS)[number];

export interface FlowDeskPromptNoReplyDecisionV1 {
	schema_version: "flowdesk.prompt_no_reply_decision.v1";
	decision_id: string;
	workflow_id: string;
	attempt_id: string;
	session_ref: string;
	agent_ref: string;
	provider_qualified_model_id: string;
	no_reply_reason: FlowDeskPromptNoReplyReasonV1;
	policy_pack_ref: string;
	guard_decision_ref: string;
	pre_call_audit_ref: string;
	created_at: string;
	dispatch_authority_enabled: false;
	providerCall: true;
	actualLaneLaunch: false;
	runtimeExecution: true;
	hardCancelOrNoReplyAuthority: false;
	prompt_no_reply_authorized: true;
}

function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === "object" && value !== null && !Array.isArray(value);
}

function rejectUnknown(
	value: Record<string, unknown>,
	allowed: readonly string[],
	label: string,
): ValidationResult {
	const errors: string[] = [];
	for (const key of Object.keys(value))
		if (!allowed.includes(key))
			errors.push(`${label} has unknown property ${key}`);
	return errors.length === 0 ? valid() : invalid(...errors);
}

const PERMISSION_DECISION_FIELDS = [
	"schema_version",
	"decision_id",
	"workflow_id",
	"attempt_id",
	"session_ref",
	"requested_permission_kind_ref",
	"policy_pack_ref",
	"status",
	"deny_reason",
	"observed_at",
	"dispatch_authority_enabled",
	"providerCall",
	"actualLaneLaunch",
	"runtimeExecution",
	"hardCancelOrNoReplyAuthority",
] as const;

export function validateFlowDeskPermissionAskDecisionV1(
	value: unknown,
): ValidationResult {
	if (!isRecord(value))
		return invalid("permission ask decision must be an object");
	const errors: string[] = [];
	errors.push(
		...rejectUnknown(value, PERMISSION_DECISION_FIELDS, "permission_ask_decision")
			.errors,
	);
	if (value.schema_version !== "flowdesk.permission_ask_decision.v1")
		errors.push("permission ask decision schema_version invalid");
	errors.push(...validateOpaqueId(value.decision_id, "decision_id").errors);
	errors.push(...validateOpaqueId(value.workflow_id, "workflow_id").errors);
	errors.push(...validateOpaqueId(value.attempt_id, "attempt_id").errors);
	errors.push(...validateOpaqueRef(value.session_ref, "session_ref").errors);
	errors.push(
		...validateOpaqueRef(
			value.requested_permission_kind_ref,
			"requested_permission_kind_ref",
		).errors,
	);
	errors.push(
		...validateOpaqueRef(value.policy_pack_ref, "policy_pack_ref").errors,
	);
	if (
		typeof value.status !== "string" ||
		!(FLOWDESK_PERMISSION_ASK_DECISIONS as readonly string[]).includes(
			value.status,
		)
	)
		errors.push("permission ask decision status invalid");
	if (value.status === "deny") {
		if (
			typeof value.deny_reason !== "string" ||
			!(FLOWDESK_PERMISSION_DENY_REASONS as readonly string[]).includes(
				value.deny_reason,
			)
		)
			errors.push("deny status requires a registered deny_reason");
	} else if (value.deny_reason !== undefined) {
		errors.push("deny_reason is only valid when status=deny");
	}
	if (typeof value.observed_at !== "string" || value.observed_at.length === 0)
		errors.push("observed_at must be a non-empty timestamp string");
	if (
		value.dispatch_authority_enabled !== false ||
		value.providerCall !== false ||
		value.actualLaneLaunch !== false ||
		value.runtimeExecution !== false ||
		value.hardCancelOrNoReplyAuthority !== false
	)
		errors.push("permission ask decision must keep authority flags false");
	errors.push(
		...validateNoForbiddenRawPayloads(value, "permission_ask_decision").errors,
	);
	return errors.length === 0 ? valid() : invalid(...errors);
}

const SESSION_ABORT_FIELDS = [
	"schema_version",
	"decision_id",
	"workflow_id",
	"attempt_id",
	"session_ref",
	"abort_reason",
	"policy_pack_ref",
	"guard_decision_ref",
	"pre_abort_audit_ref",
	"created_at",
	"dispatch_authority_enabled",
	"providerCall",
	"actualLaneLaunch",
	"runtimeExecution",
	"hardCancelOrNoReplyAuthority",
	"session_abort_authorized",
] as const;

export function validateFlowDeskSessionAbortDecisionV1(
	value: unknown,
): ValidationResult {
	if (!isRecord(value))
		return invalid("session abort decision must be an object");
	const errors: string[] = [];
	errors.push(
		...rejectUnknown(value, SESSION_ABORT_FIELDS, "session_abort_decision")
			.errors,
	);
	if (value.schema_version !== "flowdesk.session_abort_decision.v1")
		errors.push("session abort decision schema_version invalid");
	errors.push(...validateOpaqueId(value.decision_id, "decision_id").errors);
	errors.push(...validateOpaqueId(value.workflow_id, "workflow_id").errors);
	errors.push(...validateOpaqueId(value.attempt_id, "attempt_id").errors);
	errors.push(...validateOpaqueRef(value.session_ref, "session_ref").errors);
	if (
		typeof value.abort_reason !== "string" ||
		!(FLOWDESK_SESSION_ABORT_REASONS as readonly string[]).includes(
			value.abort_reason,
		)
	)
		errors.push("session abort_reason invalid");
	errors.push(
		...validateOpaqueRef(value.policy_pack_ref, "policy_pack_ref").errors,
	);
	errors.push(
		...validateOpaqueRef(value.guard_decision_ref, "guard_decision_ref")
			.errors,
	);
	errors.push(
		...validateOpaqueRef(
			value.pre_abort_audit_ref,
			"pre_abort_audit_ref",
		).errors,
	);
	if (typeof value.created_at !== "string" || value.created_at.length === 0)
		errors.push("created_at must be a non-empty timestamp string");
	if (
		value.dispatch_authority_enabled !== false ||
		value.providerCall !== false ||
		value.actualLaneLaunch !== false ||
		value.runtimeExecution !== false ||
		value.hardCancelOrNoReplyAuthority !== false
	)
		errors.push("session abort decision must keep dispatch authority false");
	if (value.session_abort_authorized !== true)
		errors.push("session abort decision must set session_abort_authorized=true");
	errors.push(
		...validateNoForbiddenRawPayloads(value, "session_abort_decision").errors,
	);
	return errors.length === 0 ? valid() : invalid(...errors);
}

const PROMPT_NO_REPLY_FIELDS = [
	"schema_version",
	"decision_id",
	"workflow_id",
	"attempt_id",
	"session_ref",
	"agent_ref",
	"provider_qualified_model_id",
	"no_reply_reason",
	"policy_pack_ref",
	"guard_decision_ref",
	"pre_call_audit_ref",
	"created_at",
	"dispatch_authority_enabled",
	"providerCall",
	"actualLaneLaunch",
	"runtimeExecution",
	"hardCancelOrNoReplyAuthority",
	"prompt_no_reply_authorized",
] as const;

export function validateFlowDeskPromptNoReplyDecisionV1(
	value: unknown,
): ValidationResult {
	if (!isRecord(value))
		return invalid("prompt no-reply decision must be an object");
	const errors: string[] = [];
	errors.push(
		...rejectUnknown(value, PROMPT_NO_REPLY_FIELDS, "prompt_no_reply_decision")
			.errors,
	);
	if (value.schema_version !== "flowdesk.prompt_no_reply_decision.v1")
		errors.push("prompt no-reply decision schema_version invalid");
	errors.push(...validateOpaqueId(value.decision_id, "decision_id").errors);
	errors.push(...validateOpaqueId(value.workflow_id, "workflow_id").errors);
	errors.push(...validateOpaqueId(value.attempt_id, "attempt_id").errors);
	errors.push(...validateOpaqueRef(value.session_ref, "session_ref").errors);
	errors.push(...validateOpaqueRef(value.agent_ref, "agent_ref").errors);
	errors.push(
		...validateConcreteProviderQualifiedModelId(
			value.provider_qualified_model_id,
			"provider_qualified_model_id",
		).errors,
	);
	if (
		typeof value.no_reply_reason !== "string" ||
		!(FLOWDESK_PROMPT_NO_REPLY_REASONS as readonly string[]).includes(
			value.no_reply_reason,
		)
	)
		errors.push("prompt no_reply_reason invalid");
	errors.push(
		...validateOpaqueRef(value.policy_pack_ref, "policy_pack_ref").errors,
	);
	errors.push(
		...validateOpaqueRef(value.guard_decision_ref, "guard_decision_ref")
			.errors,
	);
	errors.push(
		...validateOpaqueRef(value.pre_call_audit_ref, "pre_call_audit_ref")
			.errors,
	);
	if (typeof value.created_at !== "string" || value.created_at.length === 0)
		errors.push("created_at must be a non-empty timestamp string");
	if (
		value.dispatch_authority_enabled !== false ||
		value.actualLaneLaunch !== false ||
		value.hardCancelOrNoReplyAuthority !== false
	)
		errors.push(
			"prompt no-reply decision must keep dispatch/lane/hard-chat authority false",
		);
	if (value.providerCall !== true || value.runtimeExecution !== true)
		errors.push(
			"prompt no-reply decision must record providerCall=true and runtimeExecution=true",
		);
	if (value.prompt_no_reply_authorized !== true)
		errors.push(
			"prompt no-reply decision must set prompt_no_reply_authorized=true",
		);
	errors.push(
		...validateNoForbiddenRawPayloads(value, "prompt_no_reply_decision")
			.errors,
	);
	return errors.length === 0 ? valid() : invalid(...errors);
}

export interface FlowDeskPermissionAskInputV1 {
	decisionId: string;
	workflowId: string;
	attemptId: string;
	sessionRef: string;
	requestedPermissionKindRef: string;
	policyPackRef: string;
	observedAt: string;
	policyAllows?: boolean;
	guardApproved?: boolean;
	requiresHardChatAuthority?: boolean;
	durableEvidenceMissing?: boolean;
	rawPayloadDetected?: boolean;
}

export function evaluateFlowDeskPermissionAskDecisionV1(
	input: FlowDeskPermissionAskInputV1,
): FlowDeskPermissionAskDecisionV1 {
	const denyReason: FlowDeskPermissionDenyReasonV1 | undefined =
		input.rawPayloadDetected === true
			? "raw_payload_forbidden"
			: input.requiresHardChatAuthority === true
				? "hard_chat_authority_required"
				: input.durableEvidenceMissing === true
					? "missing_durable_evidence"
					: input.policyAllows === false
						? "policy_pack_forbid"
						: input.guardApproved === false
							? "guard_unapproved"
							: input.policyAllows === undefined &&
								  input.guardApproved === undefined
								? "non_dispatch_release1_default"
								: undefined;
	const status: FlowDeskPermissionAskDecisionStatusV1 =
		denyReason !== undefined
			? "deny"
			: input.guardApproved === true && input.policyAllows === true
				? "allow"
				: "ask";
	return {
		schema_version: "flowdesk.permission_ask_decision.v1",
		decision_id: input.decisionId,
		workflow_id: input.workflowId,
		attempt_id: input.attemptId,
		session_ref: input.sessionRef,
		requested_permission_kind_ref: input.requestedPermissionKindRef,
		policy_pack_ref: input.policyPackRef,
		status,
		...(denyReason === undefined ? {} : { deny_reason: denyReason }),
		observed_at: input.observedAt,
		dispatch_authority_enabled: false,
		providerCall: false,
		actualLaneLaunch: false,
		runtimeExecution: false,
		hardCancelOrNoReplyAuthority: false,
	};
}
