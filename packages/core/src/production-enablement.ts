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
	"external_auth_policy_missing",
	"provider_policy_missing",
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
	externalAuthPolicyRef?: string;
	providerPolicyRef?: string;
	laneConformanceRefs?: string[];
	allowIncompleteConformance?: boolean;
	approvalDecision?: FlowDeskProductionApprovalDecisionV1;
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
}

const REQUIRED_SESSION_EVIDENCE_CLASSES: FlowDeskSessionEvidenceClass[] = [
	"usage_authority",
	"runtime_echo",
	"telemetry_correlation",
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
				: entry.evidenceClass === "runtime_echo"
					? "runtime_echo_ref"
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

function missingRequiredApprovalRefs(
	approval: FlowDeskProductionApprovalDecisionV1,
	evidenceRefs: readonly string[],
): string[] {
	const available = new Set(evidenceRefs);
	return approval.required_evidence_refs.filter((ref) => !available.has(ref));
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
		["provider_policy_missing", input.providerPolicyRef, "provider_policy_ref"],
	];
	for (const [blocker, ref, label] of requiredRefs) {
		const refResult = validateRef(ref, label);
		if (!refResult.ok) {
			blockerLabels.push(blocker);
			errors.push(...refResult.errors);
		}
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
			input.externalAuthPolicyRef,
			input.providerPolicyRef,
			...laneConformanceRefs,
		].filter((ref): ref is string => typeof ref === "string"),
	);

	const approval = input.approvalDecision;
	if (approval === undefined) {
		if (blockerLabels.length === 0) blockerLabels.push("approval_missing");
	} else {
		const approvalResult = validateFlowDeskProductionApprovalDecisionV1(
			approval,
			input.workflowId,
		);
		errors.push(...approvalResult.errors);
		if (!approvalResult.ok) blockerLabels.push("approval_mismatched");
		if (approval.decision !== "approve") blockerLabels.push("approval_denied");
		if (approval.missing_evidence_labels.length > 0)
			blockerLabels.push(...approval.missing_evidence_labels);
		const missingRefs = missingRequiredApprovalRefs(approval, evidenceRefs);
		if (missingRefs.length > 0)
			blockerLabels.push("approval_required_refs_missing");
		uncertaintyLabels.push(...approval.uncertainty_labels);
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
		safe_next_actions:
			state === "dispatch_capable"
				? ["/flowdesk-status"]
				: ["/flowdesk-doctor", "/flowdesk-status"],
	};
}
