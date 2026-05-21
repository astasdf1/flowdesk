import {
	evaluateFlowDeskDispatchIdempotencyReplayV1,
	validateFlowDeskDispatchIdempotencySnapshotV1,
	type FlowDeskDispatchIdempotencySnapshotV1,
} from "./dispatch-idempotency.js";
import {
	validateFlowDeskProductionApprovalSourceV1,
	type FlowDeskProductionApprovalSourceV1,
} from "./production-approval-source.js";
import type { FlowDeskSessionEvidenceReloadResultV1 } from "./session-evidence.js";
import {
	invalid,
	type ValidationResult,
	valid,
	validateConcreteProviderQualifiedModelId,
	validateNoForbiddenRawPayloads,
	validateOpaqueId,
	validateOpaqueRef,
} from "./validators.js";

export const FLOWDESK_DISPATCH_ATTEMPT_STATES = [
	"planned",
	"audit_committed",
	"approval_consumed",
	"sdk_call_permitted",
	"dispatch_failed",
	"quarantined",
] as const;
export type FlowDeskDispatchAttemptStateV1 =
	(typeof FLOWDESK_DISPATCH_ATTEMPT_STATES)[number];

export interface FlowDeskDispatchAttemptManifestV1 {
	schema_version: "flowdesk.dispatch_attempt_manifest.v1";
	workflow_id: string;
	attempt_id: string;
	state: FlowDeskDispatchAttemptStateV1;
	actor_ref: string;
	profile_ref: string;
	provider_qualified_model_id: string;
	provider_binding_hash: string;
	evidence_bundle_hash: string;
	evidence_refs: string[];
	approval_ref: string;
	consumed_approval_ref?: string;
	guard_decision_ref: string;
	pre_dispatch_audit_ref: string;
	pre_dispatch_audit_committed: boolean;
	idempotency_key: string;
	created_at: string;
	updated_at: string;
	dispatch_authority_enabled: false;
	realOpenCodeDispatch: false;
	actualLaneLaunch: false;
	providerCall: false;
	runtimeExecution: false;
}

export interface FlowDeskDispatchAttemptPrecallEvaluationV1
	extends ValidationResult {
	schema_version: "flowdesk.dispatch_attempt_precall_evaluation.v1";
	workflow_id?: string;
	attempt_id?: string;
	state: "sdk_call_permitted" | "blocked_before_sdk_call";
	sdk_call_permitted: boolean;
	blocked_labels: string[];
	dispatch_authority_enabled: false;
	realOpenCodeDispatch: false;
	actualLaneLaunch: false;
	providerCall: false;
	runtimeExecution: false;
}

export interface FlowDeskDispatchAttemptDurablePrecallEvaluationV1
	extends FlowDeskDispatchAttemptPrecallEvaluationV1 {
	durable_provenance_required: true;
	reloaded_approval_source_ref?: string;
	reloaded_pre_dispatch_audit_ref?: string;
	reloaded_idempotency_snapshot_ref?: string;
}

const disabledDispatchAuthority = {
	dispatch_authority_enabled: false as const,
	realOpenCodeDispatch: false as const,
	actualLaneLaunch: false as const,
	providerCall: false as const,
	runtimeExecution: false as const,
};

function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isState(value: unknown): value is FlowDeskDispatchAttemptStateV1 {
	return (
		typeof value === "string" &&
		(FLOWDESK_DISPATCH_ATTEMPT_STATES as readonly string[]).includes(value)
	);
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

function validateRefs(value: unknown, label: string): ValidationResult {
	if (!Array.isArray(value)) return invalid(`${label} must be an array`);
	const errors: string[] = [];
	for (const [index, ref] of value.entries())
		errors.push(...validateOpaqueRef(ref, `${label}[${index}]`).errors);
	return errors.length === 0 ? valid() : invalid(...errors);
}

export function validateFlowDeskDispatchAttemptManifestV1(
	value: unknown,
	expectedWorkflowId?: string,
): ValidationResult {
	if (!isRecord(value)) return invalid("dispatch attempt manifest must be an object");
	const record = value as Partial<FlowDeskDispatchAttemptManifestV1>;
	const errors: string[] = [];
	const allowed = new Set([
		"schema_version",
		"workflow_id",
		"attempt_id",
		"state",
		"actor_ref",
		"profile_ref",
		"provider_qualified_model_id",
		"provider_binding_hash",
		"evidence_bundle_hash",
		"evidence_refs",
		"approval_ref",
		"consumed_approval_ref",
		"guard_decision_ref",
		"pre_dispatch_audit_ref",
		"pre_dispatch_audit_committed",
		"idempotency_key",
		"created_at",
		"updated_at",
		"dispatch_authority_enabled",
		"realOpenCodeDispatch",
		"actualLaneLaunch",
		"providerCall",
		"runtimeExecution",
	]);
	for (const key of Object.keys(record))
		if (!allowed.has(key)) errors.push(`unknown properties: ${key}`);
	if (record.schema_version !== "flowdesk.dispatch_attempt_manifest.v1")
		errors.push("dispatch manifest schema_version is invalid");
	errors.push(...validateOpaqueId(record.workflow_id, "workflow_id").errors);
	if (expectedWorkflowId !== undefined && record.workflow_id !== expectedWorkflowId)
		errors.push("dispatch manifest workflow_id mismatch");
	errors.push(...validateOpaqueId(record.attempt_id, "attempt_id").errors);
	if (!isState(record.state)) errors.push("dispatch manifest state is invalid");
	errors.push(...validateOpaqueRef(record.actor_ref, "actor_ref").errors);
	errors.push(...validateOpaqueRef(record.profile_ref, "profile_ref").errors);
	errors.push(
		...validateConcreteProviderQualifiedModelId(
			record.provider_qualified_model_id,
		).errors,
	);
	errors.push(
		...validateHashRef(record.provider_binding_hash, "provider_binding_hash")
			.errors,
	);
	errors.push(
		...validateHashRef(record.evidence_bundle_hash, "evidence_bundle_hash")
			.errors,
	);
	errors.push(...validateRefs(record.evidence_refs, "evidence_refs").errors);
	errors.push(...validateOpaqueRef(record.approval_ref, "approval_ref").errors);
	if (record.consumed_approval_ref !== undefined)
		errors.push(
			...validateOpaqueRef(record.consumed_approval_ref, "consumed_approval_ref")
				.errors,
		);
	errors.push(
		...validateOpaqueRef(record.guard_decision_ref, "guard_decision_ref").errors,
	);
	errors.push(
		...validateOpaqueRef(record.pre_dispatch_audit_ref, "pre_dispatch_audit_ref")
			.errors,
	);
	if (typeof record.pre_dispatch_audit_committed !== "boolean")
		errors.push("pre_dispatch_audit_committed must be boolean");
	errors.push(...validateOpaqueRef(record.idempotency_key, "idempotency_key").errors);
	errors.push(...validateTimestamp(record.created_at, "created_at").errors);
	errors.push(...validateTimestamp(record.updated_at, "updated_at").errors);
	if (
		(record.state === "approval_consumed" || record.state === "sdk_call_permitted") &&
		(record.consumed_approval_ref === undefined ||
			record.pre_dispatch_audit_committed !== true)
	)
		errors.push(
			"approval-consumed manifests require consumed approval and committed audit",
		);
	if (
		record.state === "planned" &&
		(record.consumed_approval_ref !== undefined ||
			record.pre_dispatch_audit_committed === true)
	)
		errors.push("planned manifests cannot carry consumed approval or committed audit");
	if (record.state === "audit_committed" && record.pre_dispatch_audit_committed !== true)
		errors.push("audit_committed manifests require committed audit");
	if (
		typeof record.created_at === "string" &&
		typeof record.updated_at === "string" &&
		Number.isFinite(Date.parse(record.created_at)) &&
		Number.isFinite(Date.parse(record.updated_at)) &&
		Date.parse(record.updated_at) < Date.parse(record.created_at)
	)
		errors.push("dispatch manifest updated_at cannot be before created_at");
	if (
		record.dispatch_authority_enabled !== false ||
		record.realOpenCodeDispatch !== false ||
		record.actualLaneLaunch !== false ||
		record.providerCall !== false ||
		record.runtimeExecution !== false
	)
		errors.push("dispatch manifest cannot enable runtime authority");
	errors.push(
		...validateNoForbiddenRawPayloads(record, "dispatch_attempt_manifest").errors,
	);
	return errors.length === 0 ? valid() : invalid(...errors);
}

export function evaluateFlowDeskDispatchAttemptPrecallV1(input: {
	manifest: FlowDeskDispatchAttemptManifestV1;
	consumedApproval?: FlowDeskProductionApprovalSourceV1;
}): FlowDeskDispatchAttemptPrecallEvaluationV1 {
	const errors: string[] = [];
	const blockedLabels: string[] = [];
	const manifestResult = validateFlowDeskDispatchAttemptManifestV1(input.manifest);
	errors.push(...manifestResult.errors);
	if (!manifestResult.ok) blockedLabels.push("manifest_invalid");
	if (input.manifest.pre_dispatch_audit_committed !== true)
		blockedLabels.push("pre_dispatch_audit_not_committed");
	if (input.manifest.consumed_approval_ref === undefined)
		blockedLabels.push("approval_not_consumed");
	if (
		input.manifest.state !== "approval_consumed" &&
		input.manifest.state !== "sdk_call_permitted"
	)
		blockedLabels.push("manifest_state_not_precall_ready");
	if (input.consumedApproval === undefined) {
		blockedLabels.push("consumed_approval_missing");
	} else {
		const approvalResult = validateFlowDeskProductionApprovalSourceV1(
			input.consumedApproval,
			input.manifest.workflow_id,
		);
		errors.push(...approvalResult.errors);
		if (!approvalResult.ok) blockedLabels.push("consumed_approval_invalid");
		if (input.consumedApproval.consumed_at === undefined)
			blockedLabels.push("approval_not_consumed");
		if (input.consumedApproval.approval_id !== input.manifest.approval_ref)
			blockedLabels.push("approval_ref_mismatch");
		if (
			input.consumedApproval.consumed_by_attempt_id !==
			input.manifest.attempt_id
		)
			blockedLabels.push("approval_attempt_mismatch");
		if (input.consumedApproval.actor_ref !== input.manifest.actor_ref)
			blockedLabels.push("approval_actor_mismatch");
		if (input.consumedApproval.profile_ref !== input.manifest.profile_ref)
			blockedLabels.push("approval_profile_mismatch");
		if (
			input.consumedApproval.provider_qualified_model_id !==
			input.manifest.provider_qualified_model_id
		)
			blockedLabels.push("approval_model_mismatch");
		if (
			input.consumedApproval.provider_binding_hash !==
			input.manifest.provider_binding_hash
		)
			blockedLabels.push("approval_provider_binding_mismatch");
		if (
			input.consumedApproval.evidence_bundle_hash !==
			input.manifest.evidence_bundle_hash
		)
			blockedLabels.push("approval_evidence_bundle_mismatch");
		if (
			input.consumedApproval.guard_decision_ref !==
			input.manifest.guard_decision_ref
		)
			blockedLabels.push("approval_guard_mismatch");
	}
	const uniqueBlockedLabels = [...new Set(blockedLabels)];
	const permitted = errors.length === 0 && uniqueBlockedLabels.length === 0;
	return {
		schema_version: "flowdesk.dispatch_attempt_precall_evaluation.v1",
		workflow_id: input.manifest.workflow_id,
		attempt_id: input.manifest.attempt_id,
		ok: errors.length === 0,
		errors,
		state: permitted ? "sdk_call_permitted" : "blocked_before_sdk_call",
		sdk_call_permitted: permitted,
		blocked_labels: uniqueBlockedLabels,
		...disabledDispatchAuthority,
	};
}

function getRecordString(
	record: Record<string, unknown>,
	key: string,
): string | undefined {
	const value = record[key];
	return typeof value === "string" ? value : undefined;
}

export function evaluateFlowDeskDispatchAttemptDurablePrecallV1(input: {
	manifest: FlowDeskDispatchAttemptManifestV1;
	reloadedEvidence: FlowDeskSessionEvidenceReloadResultV1;
}): FlowDeskDispatchAttemptDurablePrecallEvaluationV1 {
	const durableErrors: string[] = [];
	const durableBlockedLabels: string[] = [];
	if (!input.reloadedEvidence.ok) {
		durableErrors.push(...input.reloadedEvidence.errors);
		durableBlockedLabels.push("session_evidence_reload_invalid");
	}
	if (input.reloadedEvidence.blocked.length > 0)
		durableBlockedLabels.push("session_evidence_contains_blocked_entries");

	const approvalEntry = input.reloadedEvidence.entries.find(
		(entry) =>
			entry.evidenceClass === "production_approval_source" &&
			getRecordString(entry.record, "approval_id") === input.manifest.approval_ref,
	);
	const approvalValidation = approvalEntry
		? validateFlowDeskProductionApprovalSourceV1(
				approvalEntry.record,
				input.manifest.workflow_id,
			)
		: undefined;
	if (approvalEntry === undefined) {
		durableBlockedLabels.push("reloaded_approval_source_missing");
	} else if (!approvalValidation?.ok) {
		durableErrors.push(...(approvalValidation?.errors ?? []));
		durableBlockedLabels.push("reloaded_approval_source_invalid");
	}

	const consumedApproval = approvalValidation?.ok
		? (approvalEntry?.record as unknown as FlowDeskProductionApprovalSourceV1)
		: undefined;
	const auditEntry = input.reloadedEvidence.entries.find(
		(entry) =>
			entry.evidenceClass === "pre_dispatch_audit" &&
			(entry.evidenceId === input.manifest.pre_dispatch_audit_ref ||
				getRecordString(entry.record, "pre_dispatch_audit_ref") ===
					input.manifest.pre_dispatch_audit_ref ||
				getRecordString(entry.record, "audit_ref") ===
					input.manifest.pre_dispatch_audit_ref),
	);
	if (auditEntry === undefined)
		durableBlockedLabels.push("reloaded_pre_dispatch_audit_missing");
	const idempotencyEntry = input.reloadedEvidence.entries.find(
		(entry) => entry.evidenceClass === "dispatch_idempotency",
	);
	const idempotencySnapshot = idempotencyEntry?.record as
		| FlowDeskDispatchIdempotencySnapshotV1
		| undefined;
	if (idempotencyEntry === undefined) {
		durableBlockedLabels.push("reloaded_idempotency_snapshot_missing");
	} else {
		const snapshotValidation = validateFlowDeskDispatchIdempotencySnapshotV1(
			idempotencyEntry.record,
			input.manifest.workflow_id,
		);
		if (!snapshotValidation.ok) {
			durableErrors.push(...snapshotValidation.errors);
			durableBlockedLabels.push("reloaded_idempotency_snapshot_invalid");
		}
	}
	const replay = evaluateFlowDeskDispatchIdempotencyReplayV1({
		workflowId: input.manifest.workflow_id,
		attemptId: input.manifest.attempt_id,
		idempotencyKey: input.manifest.idempotency_key,
		snapshot: idempotencySnapshot,
	});
	durableErrors.push(...replay.errors);
	if (!replay.replay_safe)
		durableBlockedLabels.push(
			...replay.blocked_labels.map((label) => `idempotency_${label}`),
		);

	const base = evaluateFlowDeskDispatchAttemptPrecallV1({
		manifest: input.manifest,
		consumedApproval,
	});
	const errors = [...base.errors, ...durableErrors];
	const blockedLabels = [
		...new Set([...base.blocked_labels, ...durableBlockedLabels]),
	];
	const permitted = errors.length === 0 && blockedLabels.length === 0;
	return {
		...base,
		ok: errors.length === 0,
		errors,
		state: permitted ? "sdk_call_permitted" : "blocked_before_sdk_call",
		sdk_call_permitted: permitted,
		blocked_labels: blockedLabels,
		durable_provenance_required: true,
		...(approvalEntry === undefined
			? {}
			: { reloaded_approval_source_ref: approvalEntry.evidenceId }),
		...(auditEntry === undefined
			? {}
			: { reloaded_pre_dispatch_audit_ref: auditEntry.evidenceId }),
		...(idempotencyEntry === undefined
			? {}
			: { reloaded_idempotency_snapshot_ref: idempotencyEntry.evidenceId }),
	};
}
