import { createHash } from "node:crypto";
import {
	invalid,
	type ValidationResult,
	valid,
	validateConcreteProviderQualifiedModelId,
	validateNoForbiddenRawPayloads,
	validateOpaqueId,
	validateOpaqueRef,
} from "./validators.js";

export const FLOWDESK_PRODUCTION_APPROVAL_ACTION_TYPES = [
	"managed_dispatch_beta",
	"active_profile_mutation",
	"external_write",
	"lane_launch",
	"reviewer_fanout",
	"fallback_reselection",
] as const;
export type FlowDeskProductionApprovalActionTypeV1 =
	(typeof FLOWDESK_PRODUCTION_APPROVAL_ACTION_TYPES)[number];

export const FLOWDESK_PRODUCTION_APPROVAL_METHODS = [
	"typed_phrase",
	"signed_intent",
] as const;
export type FlowDeskProductionApprovalMethodV1 =
	(typeof FLOWDESK_PRODUCTION_APPROVAL_METHODS)[number];

export const FLOWDESK_PRODUCTION_APPROVAL_ISSUER_BOUNDARIES = [
	"external_user_confirmation",
	"external_signed_intent",
] as const;
export type FlowDeskProductionApprovalIssuerBoundaryV1 =
	(typeof FLOWDESK_PRODUCTION_APPROVAL_ISSUER_BOUNDARIES)[number];

export interface FlowDeskProductionApprovalSourceV1 {
	schema_version: "flowdesk.production_approval_source.v1";
	approval_id: string;
	workflow_id: string;
	attempt_id: string;
	action_type: FlowDeskProductionApprovalActionTypeV1;
	issuer_boundary: FlowDeskProductionApprovalIssuerBoundaryV1;
	approval_method: FlowDeskProductionApprovalMethodV1;
	actor_ref: string;
	profile_ref: string;
	provider_qualified_model_id: string;
	provider_binding_hash: string;
	evidence_bundle_hash: string;
	guard_decision_ref: string;
	issuance_audit_ref: string;
	nonce_ref: string;
	issued_at: string;
	expires_at: string;
	revoked: boolean;
	consumed_at?: string;
	consumed_by_attempt_id?: string;
	consumption_audit_ref?: string;
	consume_strategy: "atomic_compare_and_swap_required";
	dispatch_authority_enabled: false;
}

export interface FlowDeskProductionApprovalConsumeInputV1 {
	approval: FlowDeskProductionApprovalSourceV1;
	workflowId: string;
	attemptId: string;
	actionType: FlowDeskProductionApprovalActionTypeV1;
	actorRef: string;
	profileRef: string;
	providerQualifiedModelId: string;
	providerBindingHash: string;
	evidenceBundleHash: string;
	guardDecisionRef: string;
	consumptionAuditRef: string;
	consumedAt: string;
}

export interface FlowDeskProductionApprovalConsumeResultV1
	extends ValidationResult {
	schema_version: "flowdesk.production_approval_consume_result.v1";
	approval_id?: string;
	state: "consumed" | "blocked";
	consumed_approval?: FlowDeskProductionApprovalSourceV1;
	consume_strategy: "atomic_compare_and_swap_required";
	dispatch_authority_enabled: false;
	realOpenCodeDispatch: false;
	actualLaneLaunch: false;
	providerCall: false;
	runtimeExecution: false;
}

const disabledApprovalAuthority = {
	dispatch_authority_enabled: false as const,
	realOpenCodeDispatch: false as const,
	actualLaneLaunch: false as const,
	providerCall: false as const,
	runtimeExecution: false as const,
};

function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isEnum(value: unknown, allowed: readonly string[]): boolean {
	return typeof value === "string" && allowed.includes(value);
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

export function validateFlowDeskProductionApprovalSourceV1(
	value: unknown,
	expectedWorkflowId?: string,
): ValidationResult {
	if (!isRecord(value)) return invalid("production approval source must be an object");
	const record = value as Partial<FlowDeskProductionApprovalSourceV1>;
	const errors: string[] = [];
	const allowed = new Set([
		"schema_version",
		"approval_id",
		"workflow_id",
		"attempt_id",
		"action_type",
		"issuer_boundary",
		"approval_method",
		"actor_ref",
		"profile_ref",
		"provider_qualified_model_id",
		"provider_binding_hash",
		"evidence_bundle_hash",
		"guard_decision_ref",
		"issuance_audit_ref",
		"nonce_ref",
		"issued_at",
		"expires_at",
		"revoked",
		"consumed_at",
		"consumed_by_attempt_id",
		"consumption_audit_ref",
		"consume_strategy",
		"dispatch_authority_enabled",
	]);
	for (const key of Object.keys(record))
		if (!allowed.has(key)) errors.push(`unknown properties: ${key}`);
	if (record.schema_version !== "flowdesk.production_approval_source.v1")
		errors.push("approval source schema_version is invalid");
	errors.push(...validateOpaqueId(record.approval_id, "approval_id").errors);
	errors.push(...validateOpaqueId(record.workflow_id, "workflow_id").errors);
	if (expectedWorkflowId !== undefined && record.workflow_id !== expectedWorkflowId)
		errors.push("approval source workflow_id mismatch");
	errors.push(...validateOpaqueId(record.attempt_id, "attempt_id").errors);
	if (!isEnum(record.action_type, FLOWDESK_PRODUCTION_APPROVAL_ACTION_TYPES))
		errors.push("approval source action_type is invalid");
	if (
		!isEnum(
			record.issuer_boundary,
			FLOWDESK_PRODUCTION_APPROVAL_ISSUER_BOUNDARIES,
		)
	)
		errors.push("approval source issuer_boundary is invalid");
	if (!isEnum(record.approval_method, FLOWDESK_PRODUCTION_APPROVAL_METHODS))
		errors.push("approval source approval_method is invalid");
	if (
		record.approval_method === "typed_phrase" &&
		record.issuer_boundary !== "external_user_confirmation"
	)
		errors.push("typed_phrase approvals require external_user_confirmation issuer boundary");
	if (
		record.approval_method === "signed_intent" &&
		record.issuer_boundary !== "external_signed_intent"
	)
		errors.push("signed_intent approvals require external_signed_intent issuer boundary");
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
	errors.push(
		...validateOpaqueRef(record.guard_decision_ref, "guard_decision_ref").errors,
	);
	errors.push(
		...validateOpaqueRef(record.issuance_audit_ref, "issuance_audit_ref").errors,
	);
	errors.push(...validateOpaqueRef(record.nonce_ref, "nonce_ref").errors);
	errors.push(...validateTimestamp(record.issued_at, "issued_at").errors);
	errors.push(...validateTimestamp(record.expires_at, "expires_at").errors);
	if (
		typeof record.issued_at === "string" &&
		typeof record.expires_at === "string" &&
		Number.isFinite(Date.parse(record.issued_at)) &&
		Number.isFinite(Date.parse(record.expires_at)) &&
		Date.parse(record.expires_at) <= Date.parse(record.issued_at)
	)
		errors.push("approval source expires_at must be after issued_at");
	if (typeof record.revoked !== "boolean")
		errors.push("approval source revoked must be boolean");
	if (record.consumed_at !== undefined)
		errors.push(...validateTimestamp(record.consumed_at, "consumed_at").errors);
	if (record.consumed_by_attempt_id !== undefined)
		errors.push(
			...validateOpaqueId(
				record.consumed_by_attempt_id,
				"consumed_by_attempt_id",
			).errors,
		);
	if (record.consumption_audit_ref !== undefined)
		errors.push(
			...validateOpaqueRef(record.consumption_audit_ref, "consumption_audit_ref")
				.errors,
		);
	if (
		record.consumed_by_attempt_id !== undefined &&
		record.attempt_id !== undefined &&
		record.consumed_by_attempt_id !== record.attempt_id
	)
		errors.push("approval source consumed_by_attempt_id must match attempt_id");
	if (
		record.consumption_audit_ref !== undefined &&
		record.consumption_audit_ref === record.issuance_audit_ref
	)
		errors.push("approval source consumption audit must differ from issuance audit");
	if (
		typeof record.issued_at === "string" &&
		typeof record.consumed_at === "string" &&
		Number.isFinite(Date.parse(record.issued_at)) &&
		Number.isFinite(Date.parse(record.consumed_at)) &&
		Date.parse(record.consumed_at) <= Date.parse(record.issued_at)
	)
		errors.push("approval source consumed_at must be after issued_at");
	const hasAnyConsumption =
		record.consumed_at !== undefined ||
		record.consumed_by_attempt_id !== undefined ||
		record.consumption_audit_ref !== undefined;
	const hasAllConsumption =
		record.consumed_at !== undefined &&
		record.consumed_by_attempt_id !== undefined &&
		record.consumption_audit_ref !== undefined;
	if (hasAnyConsumption && !hasAllConsumption)
		errors.push("approval source consumption fields must be complete");
	if (record.consume_strategy !== "atomic_compare_and_swap_required")
		errors.push("approval source consume_strategy is invalid");
	if (record.dispatch_authority_enabled !== false)
		errors.push("approval source cannot enable dispatch authority");
	errors.push(
		...validateNoForbiddenRawPayloads(record, "production_approval_source")
			.errors,
	);
	return errors.length === 0 ? valid() : invalid(...errors);
}

export function consumeFlowDeskProductionApprovalSourceV1(
	input: FlowDeskProductionApprovalConsumeInputV1,
): FlowDeskProductionApprovalConsumeResultV1 {
	const errors: string[] = [];
	const approvalResult = validateFlowDeskProductionApprovalSourceV1(
		input.approval,
		input.workflowId,
	);
	errors.push(...approvalResult.errors);
	errors.push(...validateOpaqueId(input.workflowId, "workflow_id").errors);
	errors.push(...validateOpaqueId(input.attemptId, "attempt_id").errors);
	errors.push(...validateOpaqueRef(input.actorRef, "actor_ref").errors);
	errors.push(...validateOpaqueRef(input.profileRef, "profile_ref").errors);
	errors.push(
		...validateConcreteProviderQualifiedModelId(
			input.providerQualifiedModelId,
		).errors,
	);
	errors.push(
		...validateHashRef(input.providerBindingHash, "provider_binding_hash")
			.errors,
	);
	errors.push(
		...validateHashRef(input.evidenceBundleHash, "evidence_bundle_hash").errors,
	);
	errors.push(
		...validateOpaqueRef(input.guardDecisionRef, "guard_decision_ref").errors,
	);
	errors.push(
		...validateOpaqueRef(input.consumptionAuditRef, "consumption_audit_ref")
			.errors,
	);
	errors.push(...validateTimestamp(input.consumedAt, "consumed_at").errors);
	if (!isEnum(input.actionType, FLOWDESK_PRODUCTION_APPROVAL_ACTION_TYPES))
		errors.push("approval consume action_type is invalid");
	if (input.approval.consumed_at !== undefined)
		errors.push("approval source already consumed");
	if (input.approval.revoked) errors.push("approval source is revoked");
	if (input.approval.attempt_id !== input.attemptId)
		errors.push("approval source attempt_id mismatch");
	if (input.approval.action_type !== input.actionType)
		errors.push("approval source action_type mismatch");
	if (input.approval.actor_ref !== input.actorRef)
		errors.push("approval source actor_ref mismatch");
	if (input.approval.profile_ref !== input.profileRef)
		errors.push("approval source profile_ref mismatch");
	if (input.approval.provider_qualified_model_id !== input.providerQualifiedModelId)
		errors.push("approval source model binding mismatch");
	if (input.approval.provider_binding_hash !== input.providerBindingHash)
		errors.push("approval source provider binding hash mismatch");
	if (input.approval.evidence_bundle_hash !== input.evidenceBundleHash)
		errors.push("approval source evidence bundle hash mismatch");
	if (input.approval.guard_decision_ref !== input.guardDecisionRef)
		errors.push("approval source guard decision mismatch");
	if (
		Number.isFinite(Date.parse(input.consumedAt)) &&
		Number.isFinite(Date.parse(input.approval.issued_at)) &&
		Date.parse(input.consumedAt) <= Date.parse(input.approval.issued_at)
	)
		errors.push("approval source consumed_at must be after issued_at");
	if (input.consumptionAuditRef === input.approval.issuance_audit_ref)
		errors.push("approval source consumption audit must differ from issuance audit");
	if (
		Number.isFinite(Date.parse(input.consumedAt)) &&
		Number.isFinite(Date.parse(input.approval.expires_at)) &&
		Date.parse(input.consumedAt) >= Date.parse(input.approval.expires_at)
	)
		errors.push("approval source is expired");

	if (errors.length > 0)
		return {
			schema_version: "flowdesk.production_approval_consume_result.v1",
			approval_id: input.approval.approval_id,
			ok: false,
			errors,
			state: "blocked",
			consume_strategy: "atomic_compare_and_swap_required",
			...disabledApprovalAuthority,
		};

	return {
		schema_version: "flowdesk.production_approval_consume_result.v1",
		approval_id: input.approval.approval_id,
		ok: true,
		errors: [],
		state: "consumed",
		consumed_approval: {
			...input.approval,
			consumed_at: input.consumedAt,
			consumed_by_attempt_id: input.attemptId,
			consumption_audit_ref: input.consumptionAuditRef,
		},
		consume_strategy: "atomic_compare_and_swap_required",
		...disabledApprovalAuthority,
	};
}

// ── Production approval issuer ──────────────────────────────────────────────
//
// Issues a flowdesk.production_approval_source.v1 ONLY after a genuine external
// human confirmation, binding the approval to the exact attempt, model, and the
// ACTUAL reloaded durable evidence bundle. This is a pure function: it computes
// the evidence_bundle_hash and provider_binding_hash itself (never trusting a
// caller-supplied hash), enforces gate-required evidence presence, and fails
// closed on any missing input. Issuing NEVER enables dispatch authority; the
// issued record still has dispatch_authority_enabled=false and must be consumed
// (atomic CAS) and pass the downstream production-enablement gate before any
// real dispatch. No client secret or raw payload is ever stored.

/** Maximum approval TTL: 30 minutes. Short by design to limit replay windows. */
const FLOWDESK_PRODUCTION_APPROVAL_MAX_TTL_MS = 30 * 60_000;
/** Allowed clock skew when validating issuedAt against now. */
const FLOWDESK_PRODUCTION_APPROVAL_CLOCK_SKEW_MS = 2 * 60_000;

export interface FlowDeskProductionApprovalEvidenceEntryV1 {
	evidenceClass: string;
	evidenceId: string;
	path: string;
	record: Record<string, unknown>;
}

export interface FlowDeskProductionApprovalIssueInputV1 {
	workflowId: string;
	attemptId: string;
	actionType: FlowDeskProductionApprovalActionTypeV1;
	actorRef: string;
	profileRef: string;
	providerQualifiedModelId: string;
	/** The real reloaded durable evidence entries for this workflow/attempt. */
	evidenceEntries: readonly FlowDeskProductionApprovalEvidenceEntryV1[];
	/**
	 * Evidence classes the downstream production gate requires. Must be derived
	 * from gate policy by the caller's gate layer, not arbitrary. Issuance fails
	 * closed if any required class is absent from evidenceEntries.
	 */
	requiredEvidenceClasses: readonly string[];
	/** Genuine external human confirmation. */
	confirmation: {
		method: FlowDeskProductionApprovalMethodV1;
		issuerBoundary: FlowDeskProductionApprovalIssuerBoundaryV1;
		expectedPhrase: string;
		providedPhrase: string;
	};
	guardDecisionRef: string;
	issuanceAuditRef: string;
	nonceRef: string;
	issuedAt: string;
	ttlMs: number;
	/** Current time for skew validation; defaults to issuedAt. */
	now?: string;
}

export interface FlowDeskProductionApprovalIssueResultV1 extends ValidationResult {
	schema_version: "flowdesk.production_approval_issue_result.v1";
	state: "issued" | "blocked";
	approval?: FlowDeskProductionApprovalSourceV1;
	evidence_bundle_hash?: string;
	provider_binding_hash?: string;
	dispatch_authority_enabled: false;
	realOpenCodeDispatch: false;
	actualLaneLaunch: false;
	providerCall: false;
	runtimeExecution: false;
}

const disabledIssueAuthority = {
	dispatch_authority_enabled: false as const,
	realOpenCodeDispatch: false as const,
	actualLaneLaunch: false as const,
	providerCall: false as const,
	runtimeExecution: false as const,
};

function stableStringify(value: unknown): string {
	if (Array.isArray(value)) return `[${value.map(stableStringify).join(",")}]`;
	if (value !== null && typeof value === "object") {
		const rec = value as Record<string, unknown>;
		const keys = Object.keys(rec).sort();
		return `{${keys.map((k) => `${JSON.stringify(k)}:${stableStringify(rec[k])}`).join(",")}}`;
	}
	return JSON.stringify(value) ?? "null";
}

/**
 * Canonical evidence-bundle hash: a stable digest over each entry's
 * class + id + path + canonical record digest, sorted deterministically. This
 * binds the approval to the exact content of the reloaded evidence (per the
 * architecture review), not merely entry ids, so tampered/replayed evidence
 * content changes the hash.
 */
export function computeFlowDeskEvidenceBundleHashV1(
	entries: readonly FlowDeskProductionApprovalEvidenceEntryV1[],
): string {
	const lines = entries
		.map((e) => {
			const recordDigest = createHash("sha256")
				.update(stableStringify(e.record), "utf8")
				.digest("hex");
			return `${e.evidenceClass}\u001f${e.evidenceId}\u001f${e.path}\u001f${recordDigest}`;
		})
		.sort();
	return `sha256-${createHash("sha256").update(lines.join("\n"), "utf8").digest("hex").slice(0, 32)}`;
}

/**
 * Provider binding hash: binds the approval to the concrete model id AND the
 * action scope (action_type, workflow_id, attempt_id, profile_ref) so an
 * approval cannot be replayed across actions or attempts.
 */
export function computeFlowDeskProviderBindingHashV1(input: {
	providerQualifiedModelId: string;
	actionType: string;
	workflowId: string;
	attemptId: string;
	profileRef: string;
}): string {
	const material = [
		input.providerQualifiedModelId,
		input.actionType,
		input.workflowId,
		input.attemptId,
		input.profileRef,
	].join("\u001f");
	return `sha256-${createHash("sha256").update(material, "utf8").digest("hex").slice(0, 32)}`;
}

function blockedIssue(...errors: string[]): FlowDeskProductionApprovalIssueResultV1 {
	return {
		schema_version: "flowdesk.production_approval_issue_result.v1",
		ok: false,
		errors,
		state: "blocked",
		...disabledIssueAuthority,
	};
}

export function issueFlowDeskProductionApprovalSourceV1(
	input: FlowDeskProductionApprovalIssueInputV1,
): FlowDeskProductionApprovalIssueResultV1 {
	const errors: string[] = [];
	errors.push(...validateOpaqueId(input.workflowId, "workflow_id").errors);
	errors.push(...validateOpaqueId(input.attemptId, "attempt_id").errors);
	errors.push(...validateOpaqueRef(input.actorRef, "actor_ref").errors);
	errors.push(...validateOpaqueRef(input.profileRef, "profile_ref").errors);
	errors.push(
		...validateConcreteProviderQualifiedModelId(input.providerQualifiedModelId)
			.errors,
	);
	errors.push(...validateOpaqueRef(input.guardDecisionRef, "guard_decision_ref").errors);
	errors.push(...validateOpaqueRef(input.issuanceAuditRef, "issuance_audit_ref").errors);
	errors.push(...validateOpaqueRef(input.nonceRef, "nonce_ref").errors);
	if (!isEnum(input.actionType, FLOWDESK_PRODUCTION_APPROVAL_ACTION_TYPES))
		errors.push("issue action_type is invalid");

	// Human confirmation: typed phrase must match exactly and pair with the
	// external_user_confirmation boundary (signed_intent pairs with signed boundary).
	const conf = input.confirmation;
	if (!isEnum(conf?.method, FLOWDESK_PRODUCTION_APPROVAL_METHODS))
		errors.push("issue confirmation method is invalid");
	if (!isEnum(conf?.issuerBoundary, FLOWDESK_PRODUCTION_APPROVAL_ISSUER_BOUNDARIES))
		errors.push("issue confirmation issuer_boundary is invalid");
	if (conf?.method === "typed_phrase" && conf.issuerBoundary !== "external_user_confirmation")
		errors.push("typed_phrase issuance requires external_user_confirmation boundary");
	if (conf?.method === "signed_intent" && conf.issuerBoundary !== "external_signed_intent")
		errors.push("signed_intent issuance requires external_signed_intent boundary");
	if (typeof conf?.expectedPhrase !== "string" || conf.expectedPhrase.trim().length < 8)
		errors.push("issue expected confirmation phrase must be a non-trivial string");
	else if (conf.providedPhrase !== conf.expectedPhrase)
		errors.push("issue confirmation phrase mismatch");

	// TTL bounds.
	if (typeof input.ttlMs !== "number" || !Number.isFinite(input.ttlMs) || input.ttlMs <= 0)
		errors.push("issue ttlMs must be a positive number");
	else if (input.ttlMs > FLOWDESK_PRODUCTION_APPROVAL_MAX_TTL_MS)
		errors.push("issue ttlMs exceeds the maximum approval TTL");

	// issuedAt validity + skew.
	const issuedAtMs = Date.parse(input.issuedAt);
	if (!Number.isFinite(issuedAtMs)) errors.push("issue issued_at must be a parseable timestamp");
	const nowMs = input.now !== undefined ? Date.parse(input.now) : issuedAtMs;
	if (input.now !== undefined && !Number.isFinite(nowMs))
		errors.push("issue now must be a parseable timestamp");
	if (
		Number.isFinite(issuedAtMs) &&
		Number.isFinite(nowMs) &&
		Math.abs(nowMs - issuedAtMs) > FLOWDESK_PRODUCTION_APPROVAL_CLOCK_SKEW_MS
	)
		errors.push("issue issued_at is outside the allowed clock skew from now");

	// Gate-required evidence presence — fail closed if any required class absent.
	if (!Array.isArray(input.evidenceEntries) || input.evidenceEntries.length === 0)
		errors.push("issue evidence bundle is empty");
	if (!Array.isArray(input.requiredEvidenceClasses) || input.requiredEvidenceClasses.length === 0)
		errors.push("issue requiredEvidenceClasses must be provided by the gate layer");
	const presentClasses = new Set(
		(input.evidenceEntries ?? []).map((e) => e?.evidenceClass),
	);
	for (const required of input.requiredEvidenceClasses ?? []) {
		if (!presentClasses.has(required))
			errors.push(`issue missing required evidence class: ${required}`);
	}

	if (errors.length > 0) return blockedIssue(...errors);

	const evidenceBundleHash = computeFlowDeskEvidenceBundleHashV1(input.evidenceEntries);
	const providerBindingHash = computeFlowDeskProviderBindingHashV1({
		providerQualifiedModelId: input.providerQualifiedModelId,
		actionType: input.actionType,
		workflowId: input.workflowId,
		attemptId: input.attemptId,
		profileRef: input.profileRef,
	});
	const expiresAt = new Date(issuedAtMs + input.ttlMs).toISOString();

	const approval: FlowDeskProductionApprovalSourceV1 = {
		schema_version: "flowdesk.production_approval_source.v1",
		approval_id: `approval-${input.attemptId}-${input.nonceRef}`.slice(0, 120),
		workflow_id: input.workflowId,
		attempt_id: input.attemptId,
		action_type: input.actionType,
		issuer_boundary: conf.issuerBoundary,
		approval_method: conf.method,
		actor_ref: input.actorRef,
		profile_ref: input.profileRef,
		provider_qualified_model_id: input.providerQualifiedModelId,
		provider_binding_hash: providerBindingHash,
		evidence_bundle_hash: evidenceBundleHash,
		guard_decision_ref: input.guardDecisionRef,
		issuance_audit_ref: input.issuanceAuditRef,
		nonce_ref: input.nonceRef,
		issued_at: input.issuedAt,
		expires_at: expiresAt,
		revoked: false,
		consume_strategy: "atomic_compare_and_swap_required",
		dispatch_authority_enabled: false,
	};

	// The issued record must itself pass full validation (defense in depth).
	const validation = validateFlowDeskProductionApprovalSourceV1(approval, input.workflowId);
	if (!validation.ok)
		return blockedIssue(...validation.errors.map((e) => `issued approval invalid: ${e}`));

	return {
		schema_version: "flowdesk.production_approval_issue_result.v1",
		ok: true,
		errors: [],
		state: "issued",
		approval,
		evidence_bundle_hash: evidenceBundleHash,
		provider_binding_hash: providerBindingHash,
		...disabledIssueAuthority,
	};
}
