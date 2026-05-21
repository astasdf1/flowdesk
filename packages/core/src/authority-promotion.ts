import type { FlowDeskDispatchAttemptPrecallEvaluationV1 } from "./dispatch-attempt-manifest.js";
import {
	type FlowDeskFallbackDecisionV1,
	validateFlowDeskFallbackDecisionV1,
} from "./fallback-decision.js";
import type { GuardBoundaryDecisionV1 } from "./guard-boundary.js";
import {
	type FlowDeskProductionApprovalActionTypeV1,
	type FlowDeskProductionApprovalSourceV1,
	validateFlowDeskProductionApprovalSourceV1,
} from "./production-approval-source.js";
import {
	FLOWDESK_TOP_TIER_REVIEW_PERSPECTIVES,
	type FlowDeskTopTierReviewVerdictV1,
} from "./release1-contracts.js";
import {
	invalid,
	type ValidationResult,
	valid,
	validateNoForbiddenRawPayloads,
	validateOpaqueId,
	validateOpaqueRef,
	validateTopTierReviewVerdictV1,
} from "./validators.js";

export const FLOWDESK_CONTROLLED_EXTERNAL_WRITE_TARGET_KINDS = [
	"redacted_audit_export",
	"release_conformance_doc",
] as const;
export type FlowDeskControlledExternalWriteTargetKindV1 =
	(typeof FLOWDESK_CONTROLLED_EXTERNAL_WRITE_TARGET_KINDS)[number];

export interface FlowDeskControlledExternalWriteRequestV1 {
	schema_version: "flowdesk.controlled_external_write_request.v1";
	request_id: string;
	workflow_id: string;
	attempt_id: string;
	target_kind: FlowDeskControlledExternalWriteTargetKindV1;
	target_ref: string;
	redaction_policy_ref: string;
	content_hash_ref: string;
	pre_write_audit_ref: string;
	dry_run_ref: string;
	created_at: string;
	external_write_authority_enabled: false;
	dispatch_authority_enabled: false;
	providerCall: false;
	actualLaneLaunch: false;
	runtimeExecution: false;
}

export interface FlowDeskAuthorityPromotionResultV1 extends ValidationResult {
	schema_version: "flowdesk.authority_promotion_result.v1";
	workflow_id?: string;
	attempt_id?: string;
	promotion_kind:
		| "managed_dispatch_beta"
		| "reviewer_typed_verdict_acceptance"
		| "fallback_reselection_regate"
		| "external_write";
	state:
		| "managed_dispatch_beta_authority_enabled"
		| "typed_verdicts_accepted"
		| "reselection_regate_authority_enabled"
		| "external_write_authority_enabled"
		| "blocked";
	accepted_verdict_ids?: string[];
	accepted_perspectives?: string[];
	target_kind?: FlowDeskControlledExternalWriteTargetKindV1;
	target_ref?: string;
	managed_dispatch_beta_authority_enabled: boolean;
	typed_reviewer_verdict_acceptance_enabled: boolean;
	fallback_reselection_regate_authority_enabled: boolean;
	external_write_authority_enabled: boolean;
	dispatch_authority_enabled: false;
	automatic_fallback_authorized: false;
	realOpenCodeDispatch: false;
	providerCall: false;
	actualLaneLaunch: false;
	runtimeExecution: false;
}

const disabledPromotionAuthority = {
	managed_dispatch_beta_authority_enabled: false,
	typed_reviewer_verdict_acceptance_enabled: false,
	fallback_reselection_regate_authority_enabled: false,
	external_write_authority_enabled: false,
	dispatch_authority_enabled: false as const,
	automatic_fallback_authorized: false as const,
	realOpenCodeDispatch: false as const,
	providerCall: false as const,
	actualLaneLaunch: false as const,
	runtimeExecution: false as const,
};

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

function validateHashRef(value: unknown, label: string): ValidationResult {
	const ref = validateOpaqueRef(value, label);
	if (!ref.ok) return ref;
	return typeof value === "string" && /^(hash-|sha256-)/.test(value)
		? valid()
		: invalid(`${label} must be a hash-bound opaque ref`);
}

function validateForbiddenAuthorityFields(
	value: Record<string, unknown>,
	allowed: readonly string[],
	label: string,
): ValidationResult {
	const forbidden = [
		"approve_dispatch",
		"guard_approved_dispatch",
		"fallback_authorized",
		"automatic_provider_call",
		"lane_launch_authority_enabled",
		"github_write_authority_enabled",
		"storage_write_authority_enabled",
		"connector_write_authority_enabled",
	].filter((key) => key in value && !allowed.includes(key));
	return forbidden.length === 0
		? valid()
		: invalid(`${label} cannot carry authority-smuggling fields: ${forbidden.join(",")}`);
}

function validateGuardBoundaryDecisionV1(value: unknown): ValidationResult {
	if (!isRecord(value)) return invalid("guard boundary decision must be an object");
	const errors: string[] = [];
	errors.push(
		...rejectUnknownProperties(
			value,
			[
				"status",
				"reason_category",
				"redacted_reason",
				"required_checks",
				"safe_next_actions",
			],
			"guard boundary decision",
		).errors,
	);
	if (!["blocked", "eligible", "diagnostic_only"].includes(String(value.status)))
		errors.push("guard boundary status is invalid");
	if (typeof value.reason_category !== "string" || value.reason_category.length === 0)
		errors.push("guard boundary reason_category is required");
	if (typeof value.redacted_reason !== "string" || value.redacted_reason.length === 0)
		errors.push("guard boundary redacted_reason is required");
	if (!Array.isArray(value.required_checks)) {
		errors.push("guard boundary required_checks must be an array");
	} else {
		for (const [index, check] of value.required_checks.entries()) {
			if (!isRecord(check)) {
				errors.push(`guard boundary required_checks[${index}] must be an object`);
				continue;
			}
			errors.push(
				...rejectUnknownProperties(
					check,
					["check", "result", "ref"],
					`guard boundary required_checks[${index}]`,
				).errors,
			);
			if (typeof check.check !== "string" || check.check.length === 0)
				errors.push(`guard boundary required_checks[${index}].check is invalid`);
			if (!["pass", "fail", "unknown"].includes(String(check.result)))
				errors.push(`guard boundary required_checks[${index}].result is invalid`);
			if (check.ref !== undefined)
				errors.push(
					...validateOpaqueRef(
						check.ref,
						`guard boundary required_checks[${index}].ref`,
					).errors,
				);
		}
	}
	if (!Array.isArray(value.safe_next_actions))
		errors.push("guard boundary safe_next_actions must be an array");
	errors.push(...validateForbiddenAuthorityFields(value, [], "guard boundary decision").errors);
	errors.push(...validateNoForbiddenRawPayloads(value, "guard_boundary_decision").errors);
	return errors.length === 0 ? valid() : invalid(...errors);
}

function hasPassedGuardCheck(
	decision: GuardBoundaryDecisionV1,
	checkName: string,
	ref: string,
): boolean {
	return decision.required_checks.some(
		(check) => check.check === checkName && check.result === "pass" && check.ref === ref,
	);
}

function validatePrecallEvaluationV1(
	value: unknown,
): ValidationResult {
	if (!isRecord(value)) return invalid("precall evaluation must be an object");
	const record = value as Partial<FlowDeskDispatchAttemptPrecallEvaluationV1>;
	const errors: string[] = [];
	errors.push(
		...rejectUnknownProperties(
			record,
			[
				"schema_version",
				"workflow_id",
				"attempt_id",
				"ok",
				"errors",
				"state",
				"sdk_call_permitted",
				"blocked_labels",
				"dispatch_authority_enabled",
				"realOpenCodeDispatch",
				"actualLaneLaunch",
				"providerCall",
				"runtimeExecution",
			],
			"precall evaluation",
		).errors,
	);
	if (record.schema_version !== "flowdesk.dispatch_attempt_precall_evaluation.v1")
		errors.push("precall evaluation schema_version is invalid");
	if (record.workflow_id !== undefined)
		errors.push(...validateOpaqueId(record.workflow_id, "precall workflow_id").errors);
	if (record.attempt_id !== undefined)
		errors.push(...validateOpaqueId(record.attempt_id, "precall attempt_id").errors);
	if (typeof record.ok !== "boolean") errors.push("precall ok must be boolean");
	if (!Array.isArray(record.errors)) errors.push("precall errors must be an array");
	if (record.state !== "sdk_call_permitted" && record.state !== "blocked_before_sdk_call")
		errors.push("precall state is invalid");
	if (typeof record.sdk_call_permitted !== "boolean")
		errors.push("precall sdk_call_permitted must be boolean");
	if (!Array.isArray(record.blocked_labels)) {
		errors.push("precall blocked_labels must be an array");
	} else {
		for (const [index, label] of record.blocked_labels.entries())
			errors.push(...validateOpaqueRef(label, `precall blocked_labels[${index}]`).errors);
	}
	if (
		record.dispatch_authority_enabled !== false ||
		record.realOpenCodeDispatch !== false ||
		record.actualLaneLaunch !== false ||
		record.providerCall !== false ||
		record.runtimeExecution !== false
	)
		errors.push("precall evaluation cannot enable runtime authority");
	errors.push(...validateForbiddenAuthorityFields(record, [], "precall evaluation").errors);
	errors.push(...validateNoForbiddenRawPayloads(record, "precall_evaluation").errors);
	return errors.length === 0 ? valid() : invalid(...errors);
}

function consumedApprovalErrors(
	approval: FlowDeskProductionApprovalSourceV1 | undefined,
	workflowId: string,
	attemptId: string,
	actionType: FlowDeskProductionApprovalActionTypeV1,
): string[] {
	if (approval === undefined) return ["consumed approval is required"];
	const errors: string[] = [];
	const result = validateFlowDeskProductionApprovalSourceV1(approval, workflowId);
	errors.push(...result.errors);
	if (approval.action_type !== actionType) errors.push("approval action_type mismatch");
	if (approval.workflow_id !== workflowId) errors.push("approval workflow_id mismatch");
	if (approval.attempt_id !== attemptId) errors.push("approval attempt_id mismatch");
	if (approval.consumed_at === undefined) errors.push("approval must be consumed");
	if (approval.consumed_by_attempt_id !== attemptId)
		errors.push("approval consumed_by_attempt_id mismatch");
	if (approval.consumption_audit_ref === undefined)
		errors.push("approval consumption_audit_ref is required");
	if (approval.revoked) errors.push("approval is revoked");
	return errors;
}

function blockedResult(
	promotionKind: FlowDeskAuthorityPromotionResultV1["promotion_kind"],
	errors: string[],
	workflowId?: string,
	attemptId?: string,
): FlowDeskAuthorityPromotionResultV1 {
	return {
		schema_version: "flowdesk.authority_promotion_result.v1",
		workflow_id: workflowId,
		attempt_id: attemptId,
		promotion_kind: promotionKind,
		state: "blocked",
		ok: false,
		errors,
		...disabledPromotionAuthority,
	};
}

export function promoteFlowDeskManagedDispatchBetaAuthorityV1(input: {
	guardDecision: GuardBoundaryDecisionV1;
	precallEvaluation: FlowDeskDispatchAttemptPrecallEvaluationV1;
	consumedApproval: FlowDeskProductionApprovalSourceV1;
	auditRef: string;
	conformanceRef: string;
}): FlowDeskAuthorityPromotionResultV1 {
	const workflowId = input.precallEvaluation.workflow_id;
	const attemptId = input.precallEvaluation.attempt_id;
	const errors: string[] = [];
	errors.push(...validateGuardBoundaryDecisionV1(input.guardDecision).errors);
	errors.push(...validatePrecallEvaluationV1(input.precallEvaluation).errors);
	errors.push(...validateOpaqueRef(input.auditRef, "audit_ref").errors);
	errors.push(...validateOpaqueRef(input.conformanceRef, "conformance_ref").errors);
	if (workflowId === undefined) errors.push("precall workflow_id is required");
	if (attemptId === undefined) errors.push("precall attempt_id is required");
	if (input.guardDecision.status !== "eligible")
		errors.push("guard boundary must be eligible");
	if (!hasPassedGuardCheck(input.guardDecision, "audit", input.auditRef))
		errors.push("guard boundary must include matching passed audit ref");
	if (!hasPassedGuardCheck(input.guardDecision, "conformance", input.conformanceRef))
		errors.push("guard boundary must include matching passed conformance ref");
	if (input.precallEvaluation.ok !== true)
		errors.push("precall evaluation must be ok");
	if (input.precallEvaluation.state !== "sdk_call_permitted")
		errors.push("precall evaluation must be sdk_call_permitted");
	if (input.precallEvaluation.sdk_call_permitted !== true)
		errors.push("precall sdk_call_permitted must be true");
	if ((input.precallEvaluation.blocked_labels?.length ?? 0) !== 0)
		errors.push("precall evaluation must not carry blocked labels");
	if (workflowId !== undefined && attemptId !== undefined)
		errors.push(
			...consumedApprovalErrors(
				input.consumedApproval,
				workflowId,
				attemptId,
				"managed_dispatch_beta",
			),
		);
	if (errors.length > 0)
		return blockedResult("managed_dispatch_beta", errors, workflowId, attemptId);
	return {
		schema_version: "flowdesk.authority_promotion_result.v1",
		workflow_id: workflowId,
		attempt_id: attemptId,
		promotion_kind: "managed_dispatch_beta",
		state: "managed_dispatch_beta_authority_enabled",
		ok: true,
		errors: [],
		...disabledPromotionAuthority,
		managed_dispatch_beta_authority_enabled: true,
	};
}

export function promoteFlowDeskReviewerTypedVerdictsV1(input: {
	workflowId: string;
	attemptId: string;
	verdicts: readonly FlowDeskTopTierReviewVerdictV1[];
	consumedApproval: FlowDeskProductionApprovalSourceV1;
}): FlowDeskAuthorityPromotionResultV1 {
	const errors: string[] = [];
	errors.push(...validateOpaqueId(input.workflowId, "workflow_id").errors);
	errors.push(...validateOpaqueId(input.attemptId, "attempt_id").errors);
	errors.push(
		...consumedApprovalErrors(
			input.consumedApproval,
			input.workflowId,
			input.attemptId,
			"reviewer_fanout",
		),
	);
	const verdicts = Array.isArray(input.verdicts) ? input.verdicts : [];
	if (!Array.isArray(input.verdicts)) errors.push("verdicts must be an array");
	const seenVerdictIds = new Set<string>();
	const seenPerspectives = new Set<string>();
	for (const [index, verdict] of verdicts.entries()) {
		const result = validateTopTierReviewVerdictV1(verdict);
		errors.push(...result.errors.map((error) => `verdicts[${index}]: ${error}`));
		if (!isRecord(verdict)) continue;
		const record = verdict as Partial<FlowDeskTopTierReviewVerdictV1>;
		if (record.workflow_id !== input.workflowId)
			errors.push(`verdicts[${index}] workflow_id mismatch`);
		if (record.verdict_label !== "pass")
			errors.push(`verdicts[${index}] verdict_label must be pass`);
		if (record.uncertainty !== "low")
			errors.push(`verdicts[${index}] uncertainty must be low`);
		if (!Array.isArray(record.evidence_refs) || record.evidence_refs.length === 0)
			errors.push(`verdicts[${index}] evidence_refs must be non-empty`);
		if (typeof record.verdict_id === "string") {
			if (seenVerdictIds.has(record.verdict_id))
				errors.push(`verdicts[${index}] verdict_id must be distinct`);
			seenVerdictIds.add(record.verdict_id);
		}
		if (typeof record.perspective === "string") {
			if (seenPerspectives.has(record.perspective))
				errors.push(`verdicts[${index}] perspective must be distinct`);
			seenPerspectives.add(record.perspective);
		}
	}
	for (const perspective of FLOWDESK_TOP_TIER_REVIEW_PERSPECTIVES) {
		if (!seenPerspectives.has(perspective))
			errors.push(`missing required reviewer perspective: ${perspective}`);
	}
	if (verdicts.length !== FLOWDESK_TOP_TIER_REVIEW_PERSPECTIVES.length)
		errors.push("verdicts must contain exactly the canonical perspectives");
	if (errors.length > 0)
		return blockedResult(
			"reviewer_typed_verdict_acceptance",
			errors,
			input.workflowId,
			input.attemptId,
		);
	return {
		schema_version: "flowdesk.authority_promotion_result.v1",
		workflow_id: input.workflowId,
		attempt_id: input.attemptId,
		promotion_kind: "reviewer_typed_verdict_acceptance",
		state: "typed_verdicts_accepted",
		ok: true,
		errors: [],
		accepted_verdict_ids: verdicts.map((verdict) => verdict.verdict_id),
		accepted_perspectives: [...FLOWDESK_TOP_TIER_REVIEW_PERSPECTIVES],
		...disabledPromotionAuthority,
		typed_reviewer_verdict_acceptance_enabled: true,
	};
}

export function promoteFlowDeskFallbackReselectionRegateV1(input: {
	decision: FlowDeskFallbackDecisionV1;
	consumedApproval: FlowDeskProductionApprovalSourceV1;
}): FlowDeskAuthorityPromotionResultV1 {
	const errors: string[] = [];
	const decisionResult = validateFlowDeskFallbackDecisionV1(input.decision);
	errors.push(...decisionResult.errors);
	if (input.decision.state !== "requires_full_regate")
		errors.push("fallback decision state must be requires_full_regate");
	if (input.decision.automatic_fallback_authorized !== false)
		errors.push("automatic fallback must not be authorized");
	errors.push(
		...consumedApprovalErrors(
			input.consumedApproval,
			input.decision.workflow_id,
			input.decision.new_attempt_id,
			"fallback_reselection",
		),
	);
	if (input.consumedApproval.approval_id !== input.decision.fresh_approval_ref)
		errors.push("fallback approval ref mismatch");
	if (errors.length > 0)
		return blockedResult(
			"fallback_reselection_regate",
			errors,
			input.decision.workflow_id,
			input.decision.new_attempt_id,
		);
	return {
		schema_version: "flowdesk.authority_promotion_result.v1",
		workflow_id: input.decision.workflow_id,
		attempt_id: input.decision.new_attempt_id,
		promotion_kind: "fallback_reselection_regate",
		state: "reselection_regate_authority_enabled",
		ok: true,
		errors: [],
		...disabledPromotionAuthority,
		fallback_reselection_regate_authority_enabled: true,
	};
}

export function validateFlowDeskControlledExternalWriteRequestV1(
	value: unknown,
): ValidationResult {
	if (!isRecord(value)) return invalid("controlled external write request must be an object");
	const record = value as Partial<FlowDeskControlledExternalWriteRequestV1>;
	const errors: string[] = [];
	const allowed = [
		"schema_version",
		"request_id",
		"workflow_id",
		"attempt_id",
		"target_kind",
		"target_ref",
		"redaction_policy_ref",
		"content_hash_ref",
		"pre_write_audit_ref",
		"dry_run_ref",
		"created_at",
		"external_write_authority_enabled",
		"dispatch_authority_enabled",
		"providerCall",
		"actualLaneLaunch",
		"runtimeExecution",
	] as const;
	errors.push(
		...rejectUnknownProperties(record, allowed, "controlled external write request")
			.errors,
	);
	errors.push(
		...validateForbiddenAuthorityFields(
			record,
			allowed,
			"controlled external write request",
		).errors,
	);
	if (record.schema_version !== "flowdesk.controlled_external_write_request.v1")
		errors.push("controlled external write request schema_version is invalid");
	errors.push(...validateOpaqueId(record.request_id, "request_id").errors);
	errors.push(...validateOpaqueId(record.workflow_id, "workflow_id").errors);
	errors.push(...validateOpaqueId(record.attempt_id, "attempt_id").errors);
	if (
		typeof record.target_kind !== "string" ||
		!(FLOWDESK_CONTROLLED_EXTERNAL_WRITE_TARGET_KINDS as readonly string[]).includes(
			record.target_kind,
		)
	)
		errors.push("target_kind is not controlled or allowed");
	for (const [ref, label] of [
		[record.target_ref, "target_ref"],
		[record.redaction_policy_ref, "redaction_policy_ref"],
		[record.pre_write_audit_ref, "pre_write_audit_ref"],
		[record.dry_run_ref, "dry_run_ref"],
	] as const)
		errors.push(...validateOpaqueRef(ref, label).errors);
	errors.push(...validateHashRef(record.content_hash_ref, "content_hash_ref").errors);
	errors.push(...validateTimestamp(record.created_at, "created_at").errors);
	if (
		typeof record.target_ref === "string" &&
		/(github|gitlab|connector|storage|bucket|blob|s3|gs|file|path|filesystem|database|sql|http|https|raw[_-]?payload|provider[_-]?payload|providerpayload)/i.test(
			record.target_ref,
		)
	)
		errors.push("target_ref must not identify GitHub, connector, storage, path, database, URL, or raw payload targets");
	if (
		record.external_write_authority_enabled !== false ||
		record.dispatch_authority_enabled !== false ||
		record.providerCall !== false ||
		record.actualLaneLaunch !== false ||
		record.runtimeExecution !== false
	)
		errors.push("controlled external write request cannot enable authority");
	errors.push(
		...validateNoForbiddenRawPayloads(record, "controlled_external_write_request")
			.errors,
	);
	return errors.length === 0 ? valid() : invalid(...errors);
}

export function promoteFlowDeskExternalWriteAuthorityV1(input: {
	request: FlowDeskControlledExternalWriteRequestV1;
	consumedApproval: FlowDeskProductionApprovalSourceV1;
}): FlowDeskAuthorityPromotionResultV1 {
	const errors: string[] = [];
	const requestResult = validateFlowDeskControlledExternalWriteRequestV1(
		input.request,
	);
	errors.push(...requestResult.errors);
	errors.push(
		...consumedApprovalErrors(
			input.consumedApproval,
			input.request.workflow_id,
			input.request.attempt_id,
			"external_write",
		),
	);
	if (errors.length > 0)
		return blockedResult(
			"external_write",
			errors,
			input.request.workflow_id,
			input.request.attempt_id,
		);
	return {
		schema_version: "flowdesk.authority_promotion_result.v1",
		workflow_id: input.request.workflow_id,
		attempt_id: input.request.attempt_id,
		promotion_kind: "external_write",
		state: "external_write_authority_enabled",
		ok: true,
		errors: [],
		target_kind: input.request.target_kind,
		target_ref: input.request.target_ref,
		...disabledPromotionAuthority,
		external_write_authority_enabled: true,
	};
}
