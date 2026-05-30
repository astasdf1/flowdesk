import type { FlowDeskExternalAuthProviderPolicyResultV1 } from "./external-auth-policy.js";
import { validateFlowDeskExternalAuthProviderPolicyResultV1 } from "./external-auth-policy.js";
import type { FlowDeskConfiguredVerificationResultV1 } from "./production-verification.js";
import { validateFlowDeskConfiguredVerificationResultV1 } from "./production-verification.js";
import type { FlowDeskSanitizedAuthCaptureResultV1 } from "./sanitized-auth-capture.js";
import { validateFlowDeskSanitizedAuthCaptureResultV1 } from "./sanitized-auth-capture.js";
import type { FlowDeskSessionEvidenceReloadResultV1 } from "./session-evidence.js";
import type { FlowDeskSessionEvidenceClass } from "./state-paths.js";
import {
	invalid,
	type ValidationResult,
	valid,
	validateNoForbiddenRawPayloads,
	validateOpaqueId,
	validateOpaqueRef,
} from "./validators.js";

export const FLOWDESK_PRODUCTION_ENABLEMENT_STATES = [
	"disabled",
	"blocked",
	"configured",
	"approved",
	"dispatch_capable",
] as const;
export type FlowDeskProductionEnablementStateV1 =
	(typeof FLOWDESK_PRODUCTION_ENABLEMENT_STATES)[number];

export const FLOWDESK_PRODUCTION_ENABLEMENT_BLOCKER_LABELS = [
	"session_evidence_reload_failed",
	"session_evidence_blocked_records",
	"usage_authority_missing",
	"runtime_echo_missing",
	"telemetry_correlation_missing",
	"pre_dispatch_audit_missing",
	"configured_verification_missing",
	"configured_verification_result_missing",
	"configured_verification_invalid",
	"configured_verification_failed",
	"sanitized_auth_capture_result_missing",
	"sanitized_auth_capture_invalid",
	"sanitized_auth_capture_failed",
	"external_auth_policy_missing",
	"provider_policy_missing",
	"external_auth_provider_policy_result_missing",
	"external_auth_provider_policy_invalid",
	"external_auth_provider_policy_failed",
	"provider_health_snapshot_missing",
	"provider_health_snapshot_not_fresh",
	"provider_health_snapshot_not_dispatchable",
	"production_approval_source_missing",
	"dispatch_idempotency_missing",
	"pre_dispatch_audit_mismatched",
	"dispatch_idempotency_reservation_missing",
	"approval_missing",
	"approval_denied",
	"approval_mismatched",
	"approval_required_refs_missing",
	"lane_conformance_missing",
] as const;
export type FlowDeskProductionEnablementBlockerLabelV1 =
	(typeof FLOWDESK_PRODUCTION_ENABLEMENT_BLOCKER_LABELS)[number];

export const FLOWDESK_PRODUCTION_UNCERTAINTY_LABELS = [
	"opencode_subtask_lifecycle_unproven",
	"injected_sdk_runtime_echo_partial",
	"external_auth_plugin_introspection_partial",
	"hard_chat_cancel_or_no_reply_unproven",
	"flowdesk_created_telemetry_correlation",
] as const;
export type FlowDeskProductionUncertaintyLabelV1 =
	(typeof FLOWDESK_PRODUCTION_UNCERTAINTY_LABELS)[number];

export interface FlowDeskProductionApprovalDecisionV1 {
	schema_version: "flowdesk.production_approval_decision.v1";
	approval_id: string;
	workflow_id: string;
	decision: "approve" | "deny";
	created_at: string;
	required_evidence_refs: string[];
	missing_evidence_labels: FlowDeskProductionEnablementBlockerLabelV1[];
	uncertainty_labels: FlowDeskProductionUncertaintyLabelV1[];
	safe_next_actions: string[];
	dispatch_authority_enabled: false;
}

export interface FlowDeskProductionApprovalDecisionInputV1 {
	approvalId: string;
	workflowId: string;
	decision: "approve" | "deny";
	createdAt: string;
	requiredEvidenceRefs: string[];
	missingEvidenceLabels?: FlowDeskProductionEnablementBlockerLabelV1[];
	uncertaintyLabels?: FlowDeskProductionUncertaintyLabelV1[];
}

export interface FlowDeskProductionEnablementInputV1 {
	workflowId: string;
	evidenceReload: FlowDeskSessionEvidenceReloadResultV1;
	preDispatchAuditRef?: string;
	configuredVerificationRef?: string;
	configuredVerificationResult?: FlowDeskConfiguredVerificationResultV1;
	sanitizedAuthCaptureRef?: string;
	sanitizedAuthCaptureResult?: FlowDeskSanitizedAuthCaptureResultV1;
	externalAuthPolicyRef?: string;
	providerPolicyRef?: string;
	externalAuthProviderPolicyResult?: FlowDeskExternalAuthProviderPolicyResultV1;
	laneConformanceRefs?: string[];
	allowIncompleteConformance?: boolean;
	approvalDecision?: FlowDeskProductionApprovalDecisionV1;
	attemptId?: string;
	idempotencyKey?: string;
}

export interface FlowDeskProductionEnablementEvaluationV1
	extends ValidationResult {
	schema_version: "flowdesk.production_enablement_evaluation.v1";
	workflow_id: string;
	state: FlowDeskProductionEnablementStateV1;
	blocker_labels: FlowDeskProductionEnablementBlockerLabelV1[];
	uncertainty_labels: FlowDeskProductionUncertaintyLabelV1[];
	evidence_refs: string[];
	doctor_state_ref: string;
	managed_dispatch_ready: boolean;
	dispatch_authority_enabled: false;
	default_release1_non_dispatch_preserved: true;
	safe_next_actions: string[];
	configured_verification_result?: FlowDeskConfiguredVerificationResultV1["result"];
	configured_verification_ref?: string;
	sanitized_auth_capture_result?: FlowDeskSanitizedAuthCaptureResultV1["result"];
	sanitized_auth_capture_ref?: string;
	external_auth_provider_policy_result?: FlowDeskExternalAuthProviderPolicyResultV1["result"];
	external_auth_policy_ref?: string;
	provider_policy_ref?: string;
	approval_decision?: FlowDeskProductionApprovalDecisionV1["decision"];
	approval_ref?: string;
}

export const FLOWDESK_DEFAULT_MANAGED_DISPATCH_PROMOTION_STATES = [
	"blocked",
	"configured",
	"default_candidate",
] as const;
export type FlowDeskDefaultManagedDispatchPromotionStateV1 =
	(typeof FLOWDESK_DEFAULT_MANAGED_DISPATCH_PROMOTION_STATES)[number];

export const FLOWDESK_DEFAULT_MANAGED_DISPATCH_PROMOTION_BLOCKER_LABELS = [
	"production_enablement_not_dispatch_capable",
	"production_enablement_errors_present",
	"durable_precall_missing",
	"adapter_unavailable",
	"sdk_client_unavailable",
	"default_release_enablement_missing",
	"promotion_uncertainty_present",
] as const;
export type FlowDeskDefaultManagedDispatchPromotionBlockerLabelV1 =
	(typeof FLOWDESK_DEFAULT_MANAGED_DISPATCH_PROMOTION_BLOCKER_LABELS)[number];

export const FLOWDESK_DEFAULT_MANAGED_DISPATCH_AUTHORIZATION_STATES = [
	"blocked",
	"authorized",
] as const;
export type FlowDeskDefaultManagedDispatchAuthorizationStateV1 =
	(typeof FLOWDESK_DEFAULT_MANAGED_DISPATCH_AUTHORIZATION_STATES)[number];

export const FLOWDESK_DEFAULT_MANAGED_DISPATCH_AUTHORIZATION_BLOCKER_LABELS = [
	"readiness_not_candidate",
	"default_enablement_not_requested",
	"kill_switch_active",
	"authorization_expired",
	"authorization_ref_invalid",
] as const;
export type FlowDeskDefaultManagedDispatchAuthorizationBlockerLabelV1 =
	(typeof FLOWDESK_DEFAULT_MANAGED_DISPATCH_AUTHORIZATION_BLOCKER_LABELS)[number];

export interface FlowDeskDefaultManagedDispatchPromotionReadinessInputV1 {
	productionEnablement: FlowDeskProductionEnablementEvaluationV1;
	durablePrecallRef?: string;
	adapterProfileRef?: string;
	sdkClientRef?: string;
	defaultReleaseEnablementRef?: string;
	allowUncertainty?: boolean;
}

export interface FlowDeskDefaultManagedDispatchPromotionReadinessV1
	extends ValidationResult {
	schema_version: "flowdesk.default_managed_dispatch_promotion_readiness.v1";
	workflow_id: string;
	state: FlowDeskDefaultManagedDispatchPromotionStateV1;
	blocked_labels: FlowDeskDefaultManagedDispatchPromotionBlockerLabelV1[];
	evidence_refs: string[];
	production_enablement_state: FlowDeskProductionEnablementStateV1;
	managed_dispatch_ready: boolean;
	durable_precall_ready: boolean;
	adapter_available: boolean;
	sdk_client_available: boolean;
	doctor_status_ref: string;
	default_dispatch_candidate: boolean;
	dispatch_authority_enabled: false;
	providerCall: false;
	actualLaneLaunch: false;
	runtimeExecution: false;
	safe_next_actions: string[];
	release_enablement_ref?: string;
}

export interface FlowDeskDefaultManagedDispatchAuthorizationInputV1 {
	authorizationId: string;
	readiness: FlowDeskDefaultManagedDispatchPromotionReadinessV1;
	actorRef: string;
	profileRef: string;
	releaseGateRef: string;
	rollbackRef: string;
	createdAt: string;
	expiresAt: string;
	defaultEnablementRequested: boolean;
	killSwitchState: "inactive" | "active";
	now?: number;
}

export interface FlowDeskDefaultManagedDispatchAuthorizationV1
	extends ValidationResult {
	schema_version: "flowdesk.default_managed_dispatch_authorization.v1";
	authorization_id: string;
	workflow_id: string;
	state: FlowDeskDefaultManagedDispatchAuthorizationStateV1;
	blocked_labels: FlowDeskDefaultManagedDispatchAuthorizationBlockerLabelV1[];
	readiness_ref: string;
	actor_ref: string;
	profile_ref: string;
	release_gate_ref: string;
	rollback_ref: string;
	created_at: string;
	expires_at: string;
	default_enablement_requested: boolean;
	kill_switch_state: "inactive" | "active";
	default_managed_dispatch_authority_enabled: boolean;
	dispatch_authority_enabled: false;
	providerCall: false;
	actualLaneLaunch: false;
	runtimeExecution: false;
	safe_next_actions: string[];
}

const REQUIRED_SESSION_EVIDENCE_CLASSES: FlowDeskSessionEvidenceClass[] = [
	"usage_authority",
	"runtime_echo",
	"telemetry_correlation",
];

const REQUIRED_PRECALL_EVIDENCE_CLASSES: Array<[
	FlowDeskSessionEvidenceClass,
	FlowDeskProductionEnablementBlockerLabelV1,
]> = [
	["pre_dispatch_audit", "pre_dispatch_audit_missing"],
	["production_approval_source", "production_approval_source_missing"],
	["dispatch_idempotency", "dispatch_idempotency_missing"],
];

function unique<T>(items: readonly T[]): T[] {
	return [...new Set(items)];
}

function validateRef(
	value: string | undefined,
	label: string,
): ValidationResult {
	return value === undefined
		? invalid(`${label} is required`)
		: validateOpaqueRef(value, label);
}

function validTimestamp(value: string): boolean {
	return Number.isFinite(Date.parse(value));
}

export function createFlowDeskProductionApprovalDecisionV1(
	input: FlowDeskProductionApprovalDecisionInputV1,
): FlowDeskProductionApprovalDecisionV1 {
	return {
		schema_version: "flowdesk.production_approval_decision.v1",
		approval_id: input.approvalId,
		workflow_id: input.workflowId,
		decision: input.decision,
		created_at: input.createdAt,
		required_evidence_refs: [...input.requiredEvidenceRefs],
		missing_evidence_labels: [...(input.missingEvidenceLabels ?? [])],
		uncertainty_labels: [...(input.uncertaintyLabels ?? [])],
		safe_next_actions:
			input.decision === "approve"
				? ["/flowdesk-status"]
				: ["/flowdesk-doctor", "/flowdesk-status"],
		dispatch_authority_enabled: false,
	};
}

export function validateFlowDeskProductionApprovalDecisionV1(
	value: unknown,
	expectedWorkflowId?: string,
): ValidationResult {
	if (typeof value !== "object" || value === null || Array.isArray(value))
		return invalid("production approval decision must be an object");
	const record = value as Partial<FlowDeskProductionApprovalDecisionV1>;
	const errors: string[] = [];
	const allowed = new Set([
		"schema_version",
		"approval_id",
		"workflow_id",
		"decision",
		"created_at",
		"required_evidence_refs",
		"missing_evidence_labels",
		"uncertainty_labels",
		"safe_next_actions",
		"dispatch_authority_enabled",
	]);
	for (const key of Object.keys(record))
		if (!allowed.has(key)) errors.push(`unknown properties: ${key}`);
	if (record.schema_version !== "flowdesk.production_approval_decision.v1")
		errors.push("approval schema_version is invalid");
	errors.push(...validateOpaqueId(record.approval_id, "approval_id").errors);
	errors.push(...validateOpaqueId(record.workflow_id, "workflow_id").errors);
	if (
		expectedWorkflowId !== undefined &&
		record.workflow_id !== expectedWorkflowId
	)
		errors.push("approval workflow_id mismatch");
	if (record.decision !== "approve" && record.decision !== "deny")
		errors.push("approval decision is invalid");
	if (
		typeof record.created_at !== "string" ||
		!validTimestamp(record.created_at)
	)
		errors.push("approval created_at must be a parseable timestamp");
	if (!Array.isArray(record.required_evidence_refs))
		errors.push("required_evidence_refs must be an array");
	else
		for (const [index, ref] of record.required_evidence_refs.entries())
			errors.push(
				...validateOpaqueRef(ref, `required_evidence_refs[${index}]`).errors,
			);
	if (!Array.isArray(record.missing_evidence_labels))
		errors.push("missing_evidence_labels must be an array");
	else
		for (const label of record.missing_evidence_labels)
			if (
				!(
					FLOWDESK_PRODUCTION_ENABLEMENT_BLOCKER_LABELS as readonly string[]
				).includes(label)
			)
				errors.push(`missing_evidence_label is invalid: ${label}`);
	if (!Array.isArray(record.uncertainty_labels))
		errors.push("uncertainty_labels must be an array");
	else
		for (const label of record.uncertainty_labels)
			if (
				!(FLOWDESK_PRODUCTION_UNCERTAINTY_LABELS as readonly string[]).includes(
					label,
				)
			)
				errors.push(`uncertainty_label is invalid: ${label}`);
	if (!Array.isArray(record.safe_next_actions))
		errors.push("safe_next_actions must be an array");
	if (record.dispatch_authority_enabled !== false)
		errors.push("approval decision cannot enable dispatch authority");
	errors.push(
		...validateNoForbiddenRawPayloads(record, "production_approval_decision")
			.errors,
	);
	return errors.length === 0 ? valid() : invalid(...errors);
}

function evidenceRefsFromReload(
	reload: FlowDeskSessionEvidenceReloadResultV1,
): string[] {
	return reload.entries.map((entry) => {
		const refKey =
			entry.evidenceClass === "usage_authority"
				? "authority_ref"
				: entry.evidenceClass === "provider_usage_snapshot"
					? "snapshot_id"
				: entry.evidenceClass === "runtime_echo"
					? "runtime_echo_ref"
					: entry.evidenceClass === "provider_health_snapshot"
						? "snapshot_id"
						: entry.evidenceClass === "pre_dispatch_audit"
							? "pre_dispatch_audit_ref"
							: entry.evidenceClass === "production_approval_source"
								? "approval_id"
								: entry.evidenceClass === "dispatch_idempotency"
									? "snapshot_ref"
						: "telemetry_ref";
		const ref = entry.record[refKey];
		return typeof ref === "string" && validateOpaqueRef(ref, refKey).ok
			? ref
			: entry.evidenceId;
	});
}

function hasEvidenceClass(
	reload: FlowDeskSessionEvidenceReloadResultV1,
	evidenceClass: FlowDeskSessionEvidenceClass,
): boolean {
	return reload.entries.some((entry) => entry.evidenceClass === evidenceClass);
}

function providerHealthSnapshotBlockers(
	reload: FlowDeskSessionEvidenceReloadResultV1,
): FlowDeskProductionEnablementBlockerLabelV1[] {
	const healthEntries = reload.entries.filter(
		(entry) => entry.evidenceClass === "provider_health_snapshot",
	);
	const usageEntries = reload.entries.filter(
		(entry) => entry.evidenceClass === "provider_usage_snapshot",
	);
	const hasFreshDispatchableUsage = usageEntries.some((entry) => {
		const record = entry.record;
		return record.freshness === "fresh" && record.dispatchability === "dispatchable";
	});
	if (hasFreshDispatchableUsage) return [];
	if (healthEntries.length === 0) return ["provider_health_snapshot_missing"];
	const hasFreshDispatchable = healthEntries.some((entry) => {
		const record = entry.record;
		return (
			record.freshness === "fresh" &&
			record.dispatchability === "dispatchable" &&
			record.availability_state === "healthy" &&
			record.failure_class === "none"
		);
	});
	if (hasFreshDispatchable) return [];
	const blockers: FlowDeskProductionEnablementBlockerLabelV1[] = [];
	if (!healthEntries.some((entry) => entry.record.freshness === "fresh"))
		blockers.push("provider_health_snapshot_not_fresh");
	if (!healthEntries.some((entry) => entry.record.dispatchability === "dispatchable"))
		blockers.push("provider_health_snapshot_not_dispatchable");
	if (blockers.length === 0) blockers.push("provider_health_snapshot_not_dispatchable");
	return blockers;
}

function reloadedPreDispatchAuditMatches(
	reload: FlowDeskSessionEvidenceReloadResultV1,
	input: FlowDeskProductionEnablementInputV1,
): boolean {
	return reload.entries.some((entry) => {
		if (entry.evidenceClass !== "pre_dispatch_audit") return false;
		const record = entry.record;
		if (record.workflow_id !== input.workflowId) return false;
		if (record.pre_dispatch_audit_ref !== input.preDispatchAuditRef) return false;
		if (input.attemptId !== undefined && record.attempt_id !== input.attemptId)
			return false;
		if (
			input.approvalDecision !== undefined &&
			record.approval_ref !== undefined &&
			record.approval_ref !== input.approvalDecision.approval_id
		)
			return false;
		return true;
	});
}

function reloadedIdempotencyHasReservation(
	reload: FlowDeskSessionEvidenceReloadResultV1,
	attemptId: string | undefined,
	idempotencyKey: string | undefined,
): boolean {
	if (attemptId === undefined && idempotencyKey === undefined) return true;
	return reload.entries.some((entry) => {
		if (entry.evidenceClass !== "dispatch_idempotency") return false;
		const entries = entry.record.entries;
		if (!Array.isArray(entries)) return false;
		return entries.some((ledgerEntry) => {
			if (typeof ledgerEntry !== "object" || ledgerEntry === null)
				return false;
			const record = ledgerEntry as Record<string, unknown>;
			return (
				record.state === "reserved" &&
				(attemptId === undefined || record.attempt_id === attemptId) &&
				(idempotencyKey === undefined || record.idempotency_key === idempotencyKey)
			);
		});
	});
}

function missingRequiredApprovalRefs(
	approval: FlowDeskProductionApprovalDecisionV1,
	evidenceRefs: readonly string[],
): string[] {
	const available = new Set(evidenceRefs);
	return approval.required_evidence_refs.filter((ref) => !available.has(ref));
}

function optionalOpaqueRef(
	value: string | undefined,
	label: string,
): ValidationResult {
	return value === undefined ? valid() : validateOpaqueRef(value, label);
}

function validDate(value: string): boolean {
	return Number.isFinite(Date.parse(value));
}

export function evaluateFlowDeskDefaultManagedDispatchPromotionReadinessV1(
	input: FlowDeskDefaultManagedDispatchPromotionReadinessInputV1,
): FlowDeskDefaultManagedDispatchPromotionReadinessV1 {
	const errors: string[] = [];
	const blockedLabels: FlowDeskDefaultManagedDispatchPromotionBlockerLabelV1[] = [];
	const production = input.productionEnablement;
	errors.push(...validateOpaqueId(production.workflow_id, "workflow_id").errors);
	if (!production.ok || production.errors.length > 0)
		blockedLabels.push("production_enablement_errors_present");
	if (production.state !== "dispatch_capable" || !production.managed_dispatch_ready)
		blockedLabels.push("production_enablement_not_dispatch_capable");
	if (
		production.uncertainty_labels.length > 0 &&
		input.allowUncertainty !== true
	)
		blockedLabels.push("promotion_uncertainty_present");

	const durablePrecallResult = optionalOpaqueRef(
		input.durablePrecallRef,
		"durable_precall_ref",
	);
	const adapterProfileResult = optionalOpaqueRef(
		input.adapterProfileRef,
		"adapter_profile_ref",
	);
	const sdkClientResult = optionalOpaqueRef(input.sdkClientRef, "sdk_client_ref");
	const defaultReleaseResult = optionalOpaqueRef(
		input.defaultReleaseEnablementRef,
		"default_release_enablement_ref",
	);
	errors.push(
		...durablePrecallResult.errors,
		...adapterProfileResult.errors,
		...sdkClientResult.errors,
		...defaultReleaseResult.errors,
	);
	if (!durablePrecallResult.ok || input.durablePrecallRef === undefined)
		blockedLabels.push("durable_precall_missing");
	if (!adapterProfileResult.ok || input.adapterProfileRef === undefined)
		blockedLabels.push("adapter_unavailable");
	if (!sdkClientResult.ok || input.sdkClientRef === undefined)
		blockedLabels.push("sdk_client_unavailable");
	if (!defaultReleaseResult.ok || input.defaultReleaseEnablementRef === undefined)
		blockedLabels.push("default_release_enablement_missing");

	const uniqueBlockers = unique(blockedLabels);
	const candidate = errors.length === 0 && uniqueBlockers.length === 0;
	const state: FlowDeskDefaultManagedDispatchPromotionStateV1 = candidate
		? "default_candidate"
		: production.state === "dispatch_capable" && production.ok
			? "configured"
			: "blocked";
	const evidenceRefs = unique(
		[
			...production.evidence_refs,
			input.durablePrecallRef,
			input.adapterProfileRef,
			input.sdkClientRef,
			input.defaultReleaseEnablementRef,
		].filter((ref): ref is string => typeof ref === "string"),
	);
	return {
		schema_version: "flowdesk.default_managed_dispatch_promotion_readiness.v1",
		workflow_id: production.workflow_id,
		ok: errors.length === 0,
		errors,
		state,
		blocked_labels: uniqueBlockers,
		evidence_refs: evidenceRefs,
		production_enablement_state: production.state,
		managed_dispatch_ready: production.managed_dispatch_ready,
		durable_precall_ready: input.durablePrecallRef !== undefined && durablePrecallResult.ok,
		adapter_available: input.adapterProfileRef !== undefined && adapterProfileResult.ok,
		sdk_client_available: input.sdkClientRef !== undefined && sdkClientResult.ok,
		doctor_status_ref: `default-managed-dispatch-${state}`,
		default_dispatch_candidate: candidate,
		dispatch_authority_enabled: false,
		providerCall: false,
		actualLaneLaunch: false,
		runtimeExecution: false,
		safe_next_actions: candidate
			? ["/flowdesk-status"]
			: ["/flowdesk-doctor", "/flowdesk-status"],
		...(input.defaultReleaseEnablementRef === undefined
			? {}
			: { release_enablement_ref: input.defaultReleaseEnablementRef }),
	};
}

export function validateFlowDeskDefaultManagedDispatchPromotionReadinessV1(
	value: unknown,
	expectedWorkflowId?: string,
): ValidationResult {
	if (typeof value !== "object" || value === null || Array.isArray(value))
		return invalid("default managed dispatch promotion readiness must be an object");
	const record = value as Partial<FlowDeskDefaultManagedDispatchPromotionReadinessV1>;
	const errors: string[] = [];
	const allowed = new Set([
		"schema_version",
		"workflow_id",
		"ok",
		"errors",
		"state",
		"blocked_labels",
		"evidence_refs",
		"production_enablement_state",
		"managed_dispatch_ready",
		"durable_precall_ready",
		"adapter_available",
		"sdk_client_available",
		"doctor_status_ref",
		"default_dispatch_candidate",
		"dispatch_authority_enabled",
		"providerCall",
		"actualLaneLaunch",
		"runtimeExecution",
		"safe_next_actions",
		"release_enablement_ref",
	]);
	for (const key of Object.keys(record))
		if (!allowed.has(key)) errors.push(`unknown properties: ${key}`);
	if (
		record.schema_version !==
		"flowdesk.default_managed_dispatch_promotion_readiness.v1"
	)
		errors.push("promotion readiness schema_version is invalid");
	errors.push(...validateOpaqueId(record.workflow_id, "workflow_id").errors);
	if (expectedWorkflowId !== undefined && record.workflow_id !== expectedWorkflowId)
		errors.push("promotion readiness workflow_id mismatch");
	if (typeof record.ok !== "boolean") errors.push("ok must be boolean");
	if (!Array.isArray(record.errors)) errors.push("errors must be an array");
	if (
		!(FLOWDESK_DEFAULT_MANAGED_DISPATCH_PROMOTION_STATES as readonly string[]).includes(
			String(record.state),
		)
	)
		errors.push("promotion readiness state is invalid");
	if (!Array.isArray(record.blocked_labels))
		errors.push("blocked_labels must be an array");
	else
		for (const label of record.blocked_labels)
			if (
				!(
					FLOWDESK_DEFAULT_MANAGED_DISPATCH_PROMOTION_BLOCKER_LABELS as readonly string[]
				).includes(label)
			)
				errors.push(`blocked_label is invalid: ${label}`);
	if (!Array.isArray(record.evidence_refs))
		errors.push("evidence_refs must be an array");
	else
		for (const [index, ref] of record.evidence_refs.entries())
			errors.push(...validateOpaqueRef(ref, `evidence_refs[${index}]`).errors);
	if (
		!(FLOWDESK_PRODUCTION_ENABLEMENT_STATES as readonly string[]).includes(
			String(record.production_enablement_state),
		)
	)
		errors.push("production_enablement_state is invalid");
	for (const key of [
		"managed_dispatch_ready",
		"durable_precall_ready",
		"adapter_available",
		"sdk_client_available",
		"default_dispatch_candidate",
	] as const)
		if (typeof record[key] !== "boolean") errors.push(`${key} must be boolean`);
	errors.push(
		...validateOpaqueRef(record.doctor_status_ref, "doctor_status_ref").errors,
	);
	if (record.dispatch_authority_enabled !== false)
		errors.push("promotion readiness cannot enable dispatch authority");
	if (record.providerCall !== false)
		errors.push("promotion readiness cannot make provider calls");
	if (record.actualLaneLaunch !== false)
		errors.push("promotion readiness cannot launch lanes");
	if (record.runtimeExecution !== false)
		errors.push("promotion readiness cannot execute runtime");
	if (!Array.isArray(record.safe_next_actions))
		errors.push("safe_next_actions must be an array");
	if (record.release_enablement_ref !== undefined)
		errors.push(
			...validateOpaqueRef(record.release_enablement_ref, "release_enablement_ref")
				.errors,
		);
	errors.push(
		...validateNoForbiddenRawPayloads(record, "default_managed_dispatch_promotion_readiness")
			.errors,
	);
	return errors.length === 0 ? valid() : invalid(...errors);
}

export function authorizeFlowDeskDefaultManagedDispatchV1(
	input: FlowDeskDefaultManagedDispatchAuthorizationInputV1,
): FlowDeskDefaultManagedDispatchAuthorizationV1 {
	const errors: string[] = [];
	const blockedLabels: FlowDeskDefaultManagedDispatchAuthorizationBlockerLabelV1[] = [];
	const readinessValidation = validateFlowDeskDefaultManagedDispatchPromotionReadinessV1(
		input.readiness,
	);
	errors.push(
		...validateOpaqueId(input.authorizationId, "authorization_id").errors,
		...readinessValidation.errors,
		...validateOpaqueRef(input.actorRef, "actor_ref").errors,
		...validateOpaqueRef(input.profileRef, "profile_ref").errors,
		...validateOpaqueRef(input.releaseGateRef, "release_gate_ref").errors,
		...validateOpaqueRef(input.rollbackRef, "rollback_ref").errors,
	);
	if (!readinessValidation.ok || !input.readiness.default_dispatch_candidate)
		blockedLabels.push("readiness_not_candidate");
	if (!input.defaultEnablementRequested)
		blockedLabels.push("default_enablement_not_requested");
	if (input.killSwitchState === "active") blockedLabels.push("kill_switch_active");
	else if (input.killSwitchState !== "inactive") {
		blockedLabels.push("authorization_ref_invalid");
		errors.push("kill_switch_state is invalid");
	}
	if (!validDate(input.createdAt) || !validDate(input.expiresAt)) {
		blockedLabels.push("authorization_ref_invalid");
		errors.push("authorization timestamps must be parseable");
	} else if (Date.parse(input.expiresAt) <= (input.now ?? Date.now()))
		blockedLabels.push("authorization_expired");
	const uniqueBlockers = unique(blockedLabels);
	const authorityEnabled = errors.length === 0 && uniqueBlockers.length === 0;
	return {
		schema_version: "flowdesk.default_managed_dispatch_authorization.v1",
		authorization_id: input.authorizationId,
		workflow_id: input.readiness.workflow_id,
		ok: errors.length === 0,
		errors,
		state: authorityEnabled ? "authorized" : "blocked",
		blocked_labels: uniqueBlockers,
		readiness_ref: input.readiness.doctor_status_ref,
		actor_ref: input.actorRef,
		profile_ref: input.profileRef,
		release_gate_ref: input.releaseGateRef,
		rollback_ref: input.rollbackRef,
		created_at: input.createdAt,
		expires_at: input.expiresAt,
		default_enablement_requested: input.defaultEnablementRequested,
		kill_switch_state: input.killSwitchState,
		default_managed_dispatch_authority_enabled: authorityEnabled,
		dispatch_authority_enabled: false,
		providerCall: false,
		actualLaneLaunch: false,
		runtimeExecution: false,
		safe_next_actions: authorityEnabled
			? ["/flowdesk-status"]
			: ["/flowdesk-doctor", "/flowdesk-status"],
	};
}

export function validateFlowDeskDefaultManagedDispatchAuthorizationV1(
	value: unknown,
	expectedWorkflowId?: string,
): ValidationResult {
	if (typeof value !== "object" || value === null || Array.isArray(value))
		return invalid("default managed dispatch authorization must be an object");
	const record = value as Partial<FlowDeskDefaultManagedDispatchAuthorizationV1>;
	const errors: string[] = [];
	const allowed = new Set([
		"schema_version",
		"authorization_id",
		"workflow_id",
		"ok",
		"errors",
		"state",
		"blocked_labels",
		"readiness_ref",
		"actor_ref",
		"profile_ref",
		"release_gate_ref",
		"rollback_ref",
		"created_at",
		"expires_at",
		"default_enablement_requested",
		"kill_switch_state",
		"default_managed_dispatch_authority_enabled",
		"dispatch_authority_enabled",
		"providerCall",
		"actualLaneLaunch",
		"runtimeExecution",
		"safe_next_actions",
	]);
	for (const key of Object.keys(record))
		if (!allowed.has(key)) errors.push(`unknown properties: ${key}`);
	if (record.schema_version !== "flowdesk.default_managed_dispatch_authorization.v1")
		errors.push("default managed dispatch authorization schema_version is invalid");
	errors.push(
		...validateOpaqueId(record.authorization_id, "authorization_id").errors,
		...validateOpaqueId(record.workflow_id, "workflow_id").errors,
		...validateOpaqueRef(record.readiness_ref, "readiness_ref").errors,
		...validateOpaqueRef(record.actor_ref, "actor_ref").errors,
		...validateOpaqueRef(record.profile_ref, "profile_ref").errors,
		...validateOpaqueRef(record.release_gate_ref, "release_gate_ref").errors,
		...validateOpaqueRef(record.rollback_ref, "rollback_ref").errors,
	);
	if (expectedWorkflowId !== undefined && record.workflow_id !== expectedWorkflowId)
		errors.push("default managed dispatch authorization workflow_id mismatch");
	if (typeof record.ok !== "boolean") errors.push("ok must be boolean");
	if (!Array.isArray(record.errors)) errors.push("errors must be an array");
	if (
		!(FLOWDESK_DEFAULT_MANAGED_DISPATCH_AUTHORIZATION_STATES as readonly string[]).includes(
			String(record.state),
		)
	)
		errors.push("authorization state is invalid");
	if (!Array.isArray(record.blocked_labels))
		errors.push("blocked_labels must be an array");
	else
		for (const label of record.blocked_labels)
			if (
				!(
					FLOWDESK_DEFAULT_MANAGED_DISPATCH_AUTHORIZATION_BLOCKER_LABELS as readonly string[]
				).includes(label)
			)
				errors.push(`authorization blocked_label is invalid: ${label}`);
	if (typeof record.created_at !== "string" || !validDate(record.created_at))
		errors.push("created_at must be parseable");
	if (typeof record.expires_at !== "string" || !validDate(record.expires_at))
		errors.push("expires_at must be parseable");
	if (typeof record.default_enablement_requested !== "boolean")
		errors.push("default_enablement_requested must be boolean");
	if (record.kill_switch_state !== "inactive" && record.kill_switch_state !== "active")
		errors.push("kill_switch_state is invalid");
	if (typeof record.default_managed_dispatch_authority_enabled !== "boolean")
		errors.push("default_managed_dispatch_authority_enabled must be boolean");
	if (
		record.state !== "authorized" &&
		record.default_managed_dispatch_authority_enabled === true
	)
		errors.push("blocked authorization cannot enable default managed dispatch");
	if (record.dispatch_authority_enabled !== false)
		errors.push("default authorization cannot set generic dispatch authority");
	if (record.providerCall !== false)
		errors.push("default authorization cannot make provider calls");
	if (record.actualLaneLaunch !== false)
		errors.push("default authorization cannot launch lanes");
	if (record.runtimeExecution !== false)
		errors.push("default authorization cannot execute runtime");
	if (!Array.isArray(record.safe_next_actions))
		errors.push("safe_next_actions must be an array");
	errors.push(
		...validateNoForbiddenRawPayloads(record, "default_managed_dispatch_authorization")
			.errors,
	);
	return errors.length === 0 ? valid() : invalid(...errors);
}

export function evaluateFlowDeskProductionEnablementV1(
	input: FlowDeskProductionEnablementInputV1,
): FlowDeskProductionEnablementEvaluationV1 {
	const errors: string[] = [];
	errors.push(...validateOpaqueId(input.workflowId, "workflow_id").errors);
	const blockerLabels: FlowDeskProductionEnablementBlockerLabelV1[] = [];
	const uncertaintyLabels: FlowDeskProductionUncertaintyLabelV1[] = [];

	if (!input.evidenceReload.ok) {
		errors.push(...input.evidenceReload.errors);
		blockerLabels.push("session_evidence_reload_failed");
	}
	if (input.evidenceReload.blocked.length > 0)
		blockerLabels.push("session_evidence_blocked_records");
	for (const evidenceClass of REQUIRED_SESSION_EVIDENCE_CLASSES) {
		if (!hasEvidenceClass(input.evidenceReload, evidenceClass)) {
			blockerLabels.push(
				evidenceClass === "usage_authority"
					? "usage_authority_missing"
					: evidenceClass === "runtime_echo"
						? "runtime_echo_missing"
						: "telemetry_correlation_missing",
			);
		}
	}
	for (const [evidenceClass, blocker] of REQUIRED_PRECALL_EVIDENCE_CLASSES) {
		if (!hasEvidenceClass(input.evidenceReload, evidenceClass))
			blockerLabels.push(blocker);
	}
	blockerLabels.push(...providerHealthSnapshotBlockers(input.evidenceReload));
	if (
		input.preDispatchAuditRef !== undefined &&
		hasEvidenceClass(input.evidenceReload, "pre_dispatch_audit") &&
		!reloadedPreDispatchAuditMatches(input.evidenceReload, input)
	)
		blockerLabels.push("pre_dispatch_audit_mismatched");
	if (
		hasEvidenceClass(input.evidenceReload, "dispatch_idempotency") &&
		!reloadedIdempotencyHasReservation(
			input.evidenceReload,
			input.attemptId,
			input.idempotencyKey,
		)
	)
		blockerLabels.push("dispatch_idempotency_reservation_missing");
	if (input.attemptId !== undefined)
		errors.push(...validateOpaqueId(input.attemptId, "attempt_id").errors);
	if (input.idempotencyKey !== undefined)
		errors.push(...validateOpaqueRef(input.idempotencyKey, "idempotency_key").errors);

	const requiredRefs: Array<
		[FlowDeskProductionEnablementBlockerLabelV1, string | undefined, string]
	> = [
		[
			"pre_dispatch_audit_missing",
			input.preDispatchAuditRef,
			"pre_dispatch_audit_ref",
		],
		[
			"configured_verification_missing",
			input.configuredVerificationRef,
			"configured_verification_ref",
		],
		[
			"external_auth_policy_missing",
			input.externalAuthPolicyRef,
			"external_auth_policy_ref",
		],
		[
			"sanitized_auth_capture_result_missing",
			input.sanitizedAuthCaptureRef,
			"sanitized_auth_capture_ref",
		],
		["provider_policy_missing", input.providerPolicyRef, "provider_policy_ref"],
	];
	for (const [blocker, ref, label] of requiredRefs) {
		const refResult = validateRef(ref, label);
		if (!refResult.ok) {
			blockerLabels.push(blocker);
			errors.push(...refResult.errors);
		}
	}

	const configuredVerificationResult = input.configuredVerificationResult;
	let validConfiguredVerificationResult:
		| FlowDeskConfiguredVerificationResultV1
		| undefined;
	if (configuredVerificationResult !== undefined) {
		const verificationResult = validateFlowDeskConfiguredVerificationResultV1(
			configuredVerificationResult,
			input.workflowId,
			input.configuredVerificationRef,
		);
		errors.push(...verificationResult.errors);
		if (!verificationResult.ok) blockerLabels.push("configured_verification_invalid");
		else if (input.configuredVerificationRef !== undefined)
			validConfiguredVerificationResult = configuredVerificationResult;
		if (verificationResult.ok && configuredVerificationResult.result !== "passed")
			blockerLabels.push("configured_verification_failed");
	}
	if (input.configuredVerificationRef !== undefined) {
		if (validConfiguredVerificationResult === undefined) {
			blockerLabels.push("configured_verification_result_missing");
			if (configuredVerificationResult === undefined)
				errors.push("configured verification result is required");
		}
	}

	const sanitizedAuthCaptureResult = input.sanitizedAuthCaptureResult;
	let validSanitizedAuthCaptureResult:
		| FlowDeskSanitizedAuthCaptureResultV1
		| undefined;
	if (sanitizedAuthCaptureResult !== undefined) {
		const captureResult = validateFlowDeskSanitizedAuthCaptureResultV1(
			sanitizedAuthCaptureResult,
			input.workflowId,
			input.sanitizedAuthCaptureRef,
		);
		errors.push(...captureResult.errors);
		if (!captureResult.ok) blockerLabels.push("sanitized_auth_capture_invalid");
		else if (input.sanitizedAuthCaptureRef !== undefined)
			validSanitizedAuthCaptureResult = sanitizedAuthCaptureResult;
		if (captureResult.ok && sanitizedAuthCaptureResult.result !== "passed")
			blockerLabels.push("sanitized_auth_capture_failed");
	}
	if (input.sanitizedAuthCaptureRef !== undefined) {
		if (validSanitizedAuthCaptureResult === undefined) {
			blockerLabels.push("sanitized_auth_capture_result_missing");
			if (sanitizedAuthCaptureResult === undefined)
				errors.push("sanitized auth capture result is required");
		}
	}

	const externalAuthProviderPolicyResult = input.externalAuthProviderPolicyResult;
	let validExternalAuthProviderPolicyResult:
		| FlowDeskExternalAuthProviderPolicyResultV1
		| undefined;
	if (externalAuthProviderPolicyResult !== undefined) {
		const policyResult = validateFlowDeskExternalAuthProviderPolicyResultV1(
			externalAuthProviderPolicyResult,
			input.workflowId,
			input.externalAuthPolicyRef,
			input.providerPolicyRef,
		);
		errors.push(...policyResult.errors);
		if (!policyResult.ok)
			blockerLabels.push("external_auth_provider_policy_invalid");
		else if (
			input.externalAuthPolicyRef !== undefined &&
			input.providerPolicyRef !== undefined
		)
			validExternalAuthProviderPolicyResult = externalAuthProviderPolicyResult;
		if (policyResult.ok && externalAuthProviderPolicyResult.result !== "passed")
			blockerLabels.push("external_auth_provider_policy_failed");
	}
	if (
		input.externalAuthPolicyRef !== undefined &&
		input.providerPolicyRef !== undefined &&
		validExternalAuthProviderPolicyResult === undefined
	) {
		blockerLabels.push("external_auth_provider_policy_result_missing");
		if (externalAuthProviderPolicyResult === undefined)
			errors.push("external auth provider policy result is required");
	}

	const laneConformanceRefs = input.laneConformanceRefs ?? [];
	if (laneConformanceRefs.length === 0) {
		if (input.allowIncompleteConformance === true)
			uncertaintyLabels.push(
				"opencode_subtask_lifecycle_unproven",
				"injected_sdk_runtime_echo_partial",
			);
		else blockerLabels.push("lane_conformance_missing");
	} else {
		for (const [index, ref] of laneConformanceRefs.entries()) {
			const laneRefResult = validateOpaqueRef(
				ref,
				`lane_conformance_refs[${index}]`,
			);
			if (!laneRefResult.ok) blockerLabels.push("lane_conformance_missing");
			errors.push(...laneRefResult.errors);
		}
	}

	const evidenceRefs = unique(
		[
			...evidenceRefsFromReload(input.evidenceReload),
			input.preDispatchAuditRef,
			input.configuredVerificationRef,
			...(validConfiguredVerificationResult?.evidence_refs ?? []),
			input.sanitizedAuthCaptureRef,
			...(validSanitizedAuthCaptureResult?.evidence_refs ?? []),
			input.externalAuthPolicyRef,
			input.providerPolicyRef,
			...(validExternalAuthProviderPolicyResult?.evidence_refs ?? []),
			...laneConformanceRefs,
		].filter((ref): ref is string => typeof ref === "string"),
	);

	const approval = input.approvalDecision;
	let validApprovalDecision: FlowDeskProductionApprovalDecisionV1 | undefined;
	if (approval === undefined) {
		if (blockerLabels.length === 0) blockerLabels.push("approval_missing");
	} else {
		const approvalResult = validateFlowDeskProductionApprovalDecisionV1(
			approval,
			input.workflowId,
		);
		errors.push(...approvalResult.errors);
		if (!approvalResult.ok) blockerLabels.push("approval_mismatched");
		else {
			validApprovalDecision = approval;
			if (approval.decision !== "approve") blockerLabels.push("approval_denied");
			if (approval.missing_evidence_labels.length > 0)
				blockerLabels.push(...approval.missing_evidence_labels);
			const missingRefs = missingRequiredApprovalRefs(approval, evidenceRefs);
			if (missingRefs.length > 0)
				blockerLabels.push("approval_required_refs_missing");
			uncertaintyLabels.push(...approval.uncertainty_labels);
		}
	}

	const uniqueBlockers = unique(blockerLabels);
	const uniqueUncertainties = unique(uncertaintyLabels);
	const hasOnlyApprovalBlocker =
		uniqueBlockers.length === 1 && uniqueBlockers[0] === "approval_missing";
	const state: FlowDeskProductionEnablementStateV1 =
		errors.length > 0
			? "blocked"
			: uniqueBlockers.length === 0
			? "dispatch_capable"
			: hasOnlyApprovalBlocker
				? "configured"
				: approval?.decision === "approve" &&
						uniqueBlockers.every(
							(label) => label === "lane_conformance_missing",
						)
					? "approved"
					: "blocked";

	return {
		schema_version: "flowdesk.production_enablement_evaluation.v1",
		workflow_id: input.workflowId,
		ok: errors.length === 0,
		errors,
		state,
		blocker_labels: uniqueBlockers,
		uncertainty_labels: uniqueUncertainties,
		evidence_refs: evidenceRefs,
		doctor_state_ref: `production-enable-${state}`,
		managed_dispatch_ready: errors.length === 0 && state === "dispatch_capable",
		dispatch_authority_enabled: false,
		default_release1_non_dispatch_preserved: true,
		...(validConfiguredVerificationResult === undefined
			? {}
			: {
					configured_verification_result: validConfiguredVerificationResult.result,
					configured_verification_ref:
						validConfiguredVerificationResult.verification_ref,
				}),
		...(validExternalAuthProviderPolicyResult === undefined
			? {}
			: {
					external_auth_provider_policy_result:
						validExternalAuthProviderPolicyResult.result,
					external_auth_policy_ref:
						validExternalAuthProviderPolicyResult.external_auth_policy_ref,
					provider_policy_ref:
						validExternalAuthProviderPolicyResult.provider_policy_ref,
				}),
		...(validSanitizedAuthCaptureResult === undefined
			? {}
			: {
					sanitized_auth_capture_result: validSanitizedAuthCaptureResult.result,
					sanitized_auth_capture_ref:
						validSanitizedAuthCaptureResult.sanitized_auth_capture_ref,
				}),
		...(validApprovalDecision === undefined
			? {}
			: {
					approval_decision: validApprovalDecision.decision,
					approval_ref: validApprovalDecision.approval_id,
				}),
		safe_next_actions:
			state === "dispatch_capable"
				? ["/flowdesk-status"]
				: ["/flowdesk-doctor", "/flowdesk-status"],
	};
}
