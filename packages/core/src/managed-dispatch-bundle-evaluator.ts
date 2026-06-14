import type { FlowDeskAuthorityPromotionResultV1 } from "./authority-promotion.js";
import type { FlowDeskDispatchAttemptDurablePrecallEvaluationV1 } from "./dispatch-attempt-manifest.js";
import type { GuardBoundaryDecisionV1 } from "./guard-boundary.js";
import type {
	FlowDeskDefaultManagedDispatchAuthorizationV1,
	FlowDeskDefaultManagedDispatchPromotionReadinessV1,
	FlowDeskProductionEnablementEvaluationV1,
} from "./production-enablement.js";

export const FLOWDESK_MANAGED_DISPATCH_BUNDLE_ITEMS = [
	"configured_authorization",
	"concrete_binding_policy_eligibility",
	"fresh_usage_provider_health",
	"sanitized_auth_capture",
	"external_auth_provider_policy",
	"configured_verification_sdk_compatibility",
	"consumed_guard_user_approval",
	"durable_pre_dispatch_audit",
	"dispatch_idempotency_reservation",
	"intended_sdk_dispatch_path_adapter_capability",
	"observed_lifecycle_result_status_terminal",
	"durable_reload_cross_reference_validation",
] as const;

export type FlowDeskManagedDispatchBundleItemV1 =
	(typeof FLOWDESK_MANAGED_DISPATCH_BUNDLE_ITEMS)[number];

export type FlowDeskManagedDispatchBundleItemStatusV1 = "pass" | "blocked";

export interface FlowDeskManagedDispatchObservedTerminalEvidenceV1 {
	terminal_lifecycle_observed: boolean;
	terminal_result_or_status_observed: boolean;
	terminal_state: "complete" | "failed" | "blocked" | "unknown";
	evidence_refs: string[];
}

export interface FlowDeskManagedDispatchBundleItemEvaluationV1 {
	item: FlowDeskManagedDispatchBundleItemV1;
	status: FlowDeskManagedDispatchBundleItemStatusV1;
	blocked_label?: `${FlowDeskManagedDispatchBundleItemV1}_blocked`;
	evidence_refs: string[];
}

export interface FlowDeskManagedDispatchBundleEvaluatorInputV1 {
	productionEnablement: FlowDeskProductionEnablementEvaluationV1;
	defaultAuthorization: FlowDeskDefaultManagedDispatchAuthorizationV1;
	promotionReadiness: FlowDeskDefaultManagedDispatchPromotionReadinessV1;
	guardBoundaryDecision: GuardBoundaryDecisionV1;
	durablePrecallEvaluation: FlowDeskDispatchAttemptDurablePrecallEvaluationV1;
	authorityPromotion: FlowDeskAuthorityPromotionResultV1;
	observedTerminalEvidence: FlowDeskManagedDispatchObservedTerminalEvidenceV1;
}

export interface FlowDeskManagedDispatchBundleEvaluationV1 {
	schema_version: "flowdesk.managed_dispatch_bundle_evaluation.v1";
	workflow_id?: string;
	attempt_id?: string;
	gate_result: "pass" | "blocked";
	managed_dispatch_bundle_passed: boolean;
	items: FlowDeskManagedDispatchBundleItemEvaluationV1[];
	blocked_items: FlowDeskManagedDispatchBundleItemV1[];
	blocked_labels: Array<`${FlowDeskManagedDispatchBundleItemV1}_blocked`>;
	evidence_refs: string[];
	dispatch_authority_enabled: false;
	fallback_authority_enabled: false;
	hard_chat_authority_enabled: false;
	external_write_authority_enabled: false;
	providerCall: false;
	actualLaneLaunch: false;
	runtimeExecution: false;
}

function unique(items: readonly string[]): string[] {
	return [...new Set(items)];
}

function guardHasPassedCheck(
	decision: GuardBoundaryDecisionV1,
	check: string,
): boolean {
	return decision.required_checks.some(
		(entry) => entry.check === check && entry.result === "pass",
	);
}

function hasNoProductionBlocker(
	production: FlowDeskProductionEnablementEvaluationV1,
	blockedLabels: readonly string[],
): boolean {
	return blockedLabels.every(
		(label) => !production.blocker_labels.includes(label as never),
	);
}

function hasNoDurablePrecallBlocker(
	precall: FlowDeskDispatchAttemptDurablePrecallEvaluationV1,
	blockedLabelPrefixes: readonly string[],
): boolean {
	return blockedLabelPrefixes.every(
		(prefix) => !precall.blocked_labels.some((label) => label.startsWith(prefix)),
	);
}

function item(
	itemName: FlowDeskManagedDispatchBundleItemV1,
	passed: boolean,
	evidenceRefs: readonly string[],
): FlowDeskManagedDispatchBundleItemEvaluationV1 {
	return {
		item: itemName,
		status: passed ? "pass" : "blocked",
		...(passed ? {} : { blocked_label: `${itemName}_blocked` as const }),
		evidence_refs: unique(evidenceRefs),
	};
}

export function evaluateFlowDeskManagedDispatchBundleV1(
	input: FlowDeskManagedDispatchBundleEvaluatorInputV1,
): FlowDeskManagedDispatchBundleEvaluationV1 {
	const production = input.productionEnablement;
	const authorization = input.defaultAuthorization;
	const readiness = input.promotionReadiness;
	const guard = input.guardBoundaryDecision;
	const precall = input.durablePrecallEvaluation;
	const promotion = input.authorityPromotion;
	const terminal = input.observedTerminalEvidence;

	const evaluations: FlowDeskManagedDispatchBundleItemEvaluationV1[] = [
		item(
			"configured_authorization",
			authorization.ok === true &&
				authorization.state === "authorized" &&
				authorization.default_managed_dispatch_authority_enabled === true,
			[authorization.authorization_id, authorization.readiness_ref],
		),
		item(
			"concrete_binding_policy_eligibility",
			guard.status === "eligible" &&
				guardHasPassedCheck(guard, "policy") &&
				guardHasPassedCheck(guard, "conformance"),
			guard.required_checks.flatMap((check) => check.ref ?? []),
		),
		item(
			"fresh_usage_provider_health",
			guard.status === "eligible" &&
				guardHasPassedCheck(guard, "usage") &&
				guardHasPassedCheck(guard, "provider_health") &&
				hasNoProductionBlocker(production, [
					"usage_authority_missing",
					"provider_health_snapshot_missing",
					"provider_health_snapshot_not_fresh",
					"provider_health_snapshot_not_dispatchable",
				]),
			guard.required_checks
				.filter((check) => check.check === "usage" || check.check === "provider_health")
				.flatMap((check) => check.ref ?? []),
		),
		item(
			"sanitized_auth_capture",
			production.sanitized_auth_capture_result === "passed" &&
				production.sanitized_auth_capture_ref !== undefined &&
				hasNoProductionBlocker(production, [
					"sanitized_auth_capture_result_missing",
					"sanitized_auth_capture_invalid",
					"sanitized_auth_capture_failed",
				]),
			[production.sanitized_auth_capture_ref].filter(
				(ref): ref is string => ref !== undefined,
			),
		),
		item(
			"external_auth_provider_policy",
			production.external_auth_provider_policy_result === "passed" &&
				production.external_auth_policy_ref !== undefined &&
				production.provider_policy_ref !== undefined &&
				hasNoProductionBlocker(production, [
					"external_auth_policy_missing",
					"provider_policy_missing",
					"external_auth_provider_policy_result_missing",
					"external_auth_provider_policy_invalid",
					"external_auth_provider_policy_failed",
				]),
			[production.external_auth_policy_ref, production.provider_policy_ref].filter(
				(ref): ref is string => ref !== undefined,
			),
		),
		item(
			"configured_verification_sdk_compatibility",
			production.configured_verification_result === "passed" &&
				production.configured_verification_ref !== undefined &&
				guardHasPassedCheck(guard, "runtime_compatibility") &&
				hasNoProductionBlocker(production, [
					"configured_verification_missing",
					"configured_verification_result_missing",
					"configured_verification_invalid",
					"configured_verification_failed",
				]),
			[
				production.configured_verification_ref,
				...guard.required_checks
					.filter((check) => check.check === "runtime_compatibility")
					.flatMap((check) => check.ref ?? []),
			].filter((ref): ref is string => ref !== undefined),
		),
		item(
			"consumed_guard_user_approval",
			precall.sdk_call_permitted === true &&
				precall.state === "sdk_call_permitted" &&
				promotion.ok === true &&
				promotion.promotion_kind === "managed_dispatch_beta" &&
				promotion.managed_dispatch_beta_authority_enabled === true &&
				guardHasPassedCheck(guard, "approval"),
			guard.required_checks
				.filter((check) => check.check === "approval")
				.flatMap((check) => check.ref ?? []),
		),
		item(
			"durable_pre_dispatch_audit",
			precall.ok === true &&
				precall.reloaded_pre_dispatch_audit_ref !== undefined &&
				hasNoDurablePrecallBlocker(precall, [
					"pre_dispatch_audit_not_committed",
					"reloaded_pre_dispatch_audit_missing",
				]),
			[precall.reloaded_pre_dispatch_audit_ref].filter(
				(ref): ref is string => ref !== undefined,
			),
		),
		item(
			"dispatch_idempotency_reservation",
			precall.ok === true &&
				precall.reloaded_idempotency_snapshot_ref !== undefined &&
				hasNoDurablePrecallBlocker(precall, [
					"reloaded_idempotency_snapshot_missing",
					"reloaded_idempotency_snapshot_invalid",
					"idempotency_",
				]),
			[precall.reloaded_idempotency_snapshot_ref].filter(
				(ref): ref is string => ref !== undefined,
			),
		),
		item(
			"intended_sdk_dispatch_path_adapter_capability",
			readiness.ok === true &&
				readiness.default_dispatch_candidate === true &&
				readiness.adapter_available === true &&
				readiness.sdk_client_available === true &&
				readiness.durable_precall_ready === true &&
				readiness.release2_managed_dispatch_gate_ready === true,
			readiness.evidence_refs,
		),
		item(
			"observed_lifecycle_result_status_terminal",
			terminal.terminal_lifecycle_observed === true &&
				terminal.terminal_result_or_status_observed === true &&
				(terminal.terminal_state === "complete" || terminal.terminal_state === "failed"),
			terminal.evidence_refs,
		),
		item(
			"durable_reload_cross_reference_validation",
			production.ok === true &&
				readiness.ok === true &&
				precall.ok === true &&
				precall.durable_provenance_required === true &&
				precall.reloaded_approval_source_ref !== undefined &&
				precall.reloaded_pre_dispatch_audit_ref !== undefined &&
				precall.reloaded_idempotency_snapshot_ref !== undefined,
			[
				...production.evidence_refs,
				...readiness.evidence_refs,
				precall.reloaded_approval_source_ref,
				precall.reloaded_pre_dispatch_audit_ref,
				precall.reloaded_idempotency_snapshot_ref,
			].filter((ref): ref is string => ref !== undefined),
		),
	];

	const blockedItems = evaluations
		.filter((evaluation) => evaluation.status === "blocked")
		.map((evaluation) => evaluation.item);
	const blockedLabels = evaluations.flatMap((evaluation) =>
		evaluation.blocked_label === undefined ? [] : [evaluation.blocked_label],
	);

	return {
		schema_version: "flowdesk.managed_dispatch_bundle_evaluation.v1",
		workflow_id: production.workflow_id ?? readiness.workflow_id ?? precall.workflow_id,
		attempt_id: precall.attempt_id ?? promotion.attempt_id,
		gate_result: blockedItems.length === 0 ? "pass" : "blocked",
		managed_dispatch_bundle_passed: blockedItems.length === 0,
		items: evaluations,
		blocked_items: blockedItems,
		blocked_labels: blockedLabels,
		evidence_refs: unique(evaluations.flatMap((evaluation) => evaluation.evidence_refs)),
		dispatch_authority_enabled: false,
		fallback_authority_enabled: false,
		hard_chat_authority_enabled: false,
		external_write_authority_enabled: false,
		providerCall: false,
		actualLaneLaunch: false,
		runtimeExecution: false,
	};
}
