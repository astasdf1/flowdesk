/**
 * Federated score registry publication contracts.
 * P7-S13.5 submodule: federated (Phase 8 scaffold)
 * P8-S3: federated registry connector capability + preflight contracts
 * P8-S4: federated registry connector gate evaluator (always-false, blocked-by-default)
 */
import {
	type ValidationResult,
	valid,
	invalid,
	validateNoForbiddenRawPayloads,
	validateOpaqueId,
	validateOpaqueRef,
	isRecord,
	rejectUnknownProperties,
	validateTimestamp,
	validateRegistryPublicationAuthorityFlags,
	validateHashRef,
} from "./shared.js";

import {
	type FlowDeskAdvisoryScoreLedgerEntryV1,
	validateFlowDeskAdvisoryScoreLedgerEntryV1,
} from "./evaluation-events.js";

// ─── Interfaces ───────────────────────────────────────────────────────────────

export interface FlowDeskFederatedScoreRegistryPublicationRequestV1 {
	schema_version: "flowdesk.federated_score_registry_publication_request.v1";
	request_id: string;
	workflow_id: string;
	registry_ref: string;
	ledger_entry_refs: string[];
	requested_at: string;
	federated_registry_publication_opt_in: boolean;
	connector_gate_ref?: string;
	connector_gate_satisfied: false;
	remote_write_blocked_by_default: true;
	remote_write_attempted: false;
	non_authorizing: true;
	advisory_only: true;
	dispatch_authority_enabled: false;
	approval_authority_enabled: false;
	provider_authority_enabled: false;
	runtime_authority_enabled: false;
	external_write_authority_enabled: false;
	remote_write_authority_enabled: false;
	fallback_authority_enabled: false;
	lane_launch_authority_enabled: false;
}

export interface FlowDeskFederatedScoreRegistryPublicationIntentV1 {
	schema_version: "flowdesk.federated_score_registry_publication_intent.v1";
	publication_intent_id: string;
	request_id: string;
	workflow_id: string;
	registry_ref: string;
	ledger_entry_refs: string[];
	ledger_entry_count: number;
	requested_at: string;
	state: "blocked";
	blocked_labels: string[];
	federated_registry_publication_opt_in: boolean;
	connector_gate_ref?: string;
	connector_gate_satisfied: false;
	remote_write_blocked_by_default: true;
	remote_write_attempted: false;
	local_ledger_compatible: true;
	non_authorizing: true;
	advisory_only: true;
	dispatch_authority_enabled: false;
	approval_authority_enabled: false;
	provider_authority_enabled: false;
	runtime_authority_enabled: false;
	external_write_authority_enabled: false;
	remote_write_authority_enabled: false;
	fallback_authority_enabled: false;
	lane_launch_authority_enabled: false;
}

export interface FlowDeskFederatedScoreRegistryPublicationIntentResultV1 {
	ok: boolean;
	errors: string[];
	intent?: FlowDeskFederatedScoreRegistryPublicationIntentV1;
}

// ─── Creator ──────────────────────────────────────────────────────────────────

export function createFlowDeskFederatedScoreRegistryPublicationIntentV1(input: {
	publicationIntentId: string;
	requestId: string;
	workflowId: string;
	registryRef: string;
	ledgerEntries: FlowDeskAdvisoryScoreLedgerEntryV1[];
	requestedAt: string;
	federatedRegistryPublicationOptIn?: boolean;
	connectorGateRef?: string;
}): FlowDeskFederatedScoreRegistryPublicationIntentResultV1 {
	const errors: string[] = [];
	errors.push(...validateOpaqueId(input.publicationIntentId, "publication_intent_id").errors);
	errors.push(...validateOpaqueId(input.requestId, "request_id").errors);
	errors.push(...validateOpaqueId(input.workflowId, "workflow_id").errors);
	errors.push(...validateOpaqueRef(input.registryRef, "registry_ref").errors);
	errors.push(...validateTimestamp(input.requestedAt, "requested_at").errors);
	if (input.connectorGateRef !== undefined) errors.push(...validateOpaqueRef(input.connectorGateRef, "connector_gate_ref").errors);
	if (!Array.isArray(input.ledgerEntries) || input.ledgerEntries.length === 0) errors.push("ledgerEntries must be a non-empty array");
	else for (const [index, entry] of input.ledgerEntries.entries()) {
		const validation = validateFlowDeskAdvisoryScoreLedgerEntryV1(entry);
		if (!validation.ok) errors.push(...validation.errors.map((error) => `ledgerEntries[${index}]: ${error}`));
		if (entry.workflow_id !== input.workflowId) errors.push(`ledgerEntries[${index}] workflow_id must match publication workflow_id`);
		if (entry.local_only !== true || entry.non_authorizing !== true || entry.advisory_only !== true) errors.push(`ledgerEntries[${index}] must be local advisory non-authorizing ledger entry`);
	}
	if (errors.length > 0) return { ok: false, errors };
	const optedIn = input.federatedRegistryPublicationOptIn === true;
	const blockedLabels = optedIn
		? ["connector-gate-not-supplied-or-not-enabled", "remote-write-blocked-by-default"]
		: ["federated-registry-publication-opt-in-missing", "remote-write-blocked-by-default"];
	return { ok: true, errors: [], intent: {
		schema_version: "flowdesk.federated_score_registry_publication_intent.v1",
		publication_intent_id: input.publicationIntentId,
		request_id: input.requestId,
		workflow_id: input.workflowId,
		registry_ref: input.registryRef,
		ledger_entry_refs: input.ledgerEntries.map((entry) => entry.ledger_entry_id),
		ledger_entry_count: input.ledgerEntries.length,
		requested_at: input.requestedAt,
		state: "blocked",
		blocked_labels: blockedLabels,
		federated_registry_publication_opt_in: optedIn,
		...(input.connectorGateRef === undefined ? {} : { connector_gate_ref: input.connectorGateRef }),
		connector_gate_satisfied: false,
		remote_write_blocked_by_default: true,
		remote_write_attempted: false,
		local_ledger_compatible: true,
		non_authorizing: true,
		advisory_only: true,
		dispatch_authority_enabled: false,
		approval_authority_enabled: false,
		provider_authority_enabled: false,
		runtime_authority_enabled: false,
		external_write_authority_enabled: false,
		remote_write_authority_enabled: false,
		fallback_authority_enabled: false,
		lane_launch_authority_enabled: false,
	} };
}

// ─── Validators ───────────────────────────────────────────────────────────────

export function validateFlowDeskFederatedScoreRegistryPublicationIntentV1(value: unknown): ValidationResult {
	if (!isRecord(value)) return invalid("federated score registry publication intent must be an object");
	const record = value as Partial<FlowDeskFederatedScoreRegistryPublicationIntentV1>;
	const errors: string[] = [];
	errors.push(...rejectUnknownProperties(record, [
		"schema_version",
		"publication_intent_id",
		"request_id",
		"workflow_id",
		"registry_ref",
		"ledger_entry_refs",
		"ledger_entry_count",
		"requested_at",
		"state",
		"blocked_labels",
		"federated_registry_publication_opt_in",
		"connector_gate_ref",
		"connector_gate_satisfied",
		"remote_write_blocked_by_default",
		"remote_write_attempted",
		"local_ledger_compatible",
		"non_authorizing",
		"advisory_only",
		"dispatch_authority_enabled",
		"approval_authority_enabled",
		"provider_authority_enabled",
		"runtime_authority_enabled",
		"external_write_authority_enabled",
		"remote_write_authority_enabled",
		"fallback_authority_enabled",
		"lane_launch_authority_enabled",
	], "federated score registry publication intent").errors);
	if (record.schema_version !== "flowdesk.federated_score_registry_publication_intent.v1") errors.push("federated score registry publication intent schema_version is invalid");
	errors.push(...validateOpaqueId(record.publication_intent_id, "publication_intent_id").errors);
	errors.push(...validateOpaqueId(record.request_id, "request_id").errors);
	errors.push(...validateOpaqueId(record.workflow_id, "workflow_id").errors);
	errors.push(...validateOpaqueRef(record.registry_ref, "registry_ref").errors);
	errors.push(...validateTimestamp(record.requested_at, "requested_at").errors);
	if (record.connector_gate_ref !== undefined) errors.push(...validateOpaqueRef(record.connector_gate_ref, "connector_gate_ref").errors);
	if (record.state !== "blocked") errors.push("federated score registry publication intent state must remain blocked");
	if (typeof record.federated_registry_publication_opt_in !== "boolean") errors.push("federated_registry_publication_opt_in must be boolean");
	if (record.local_ledger_compatible !== true) errors.push("federated score registry publication intent must remain compatible with local ledger entries");
	if (!Array.isArray(record.ledger_entry_refs) || record.ledger_entry_refs.length === 0) errors.push("ledger_entry_refs must be a non-empty array");
	else for (const [index, ref] of record.ledger_entry_refs.entries()) errors.push(...validateOpaqueRef(ref, `ledger_entry_refs[${index}]`).errors);
	if (typeof record.ledger_entry_count !== "number" || !Number.isInteger(record.ledger_entry_count) || record.ledger_entry_count < 1) errors.push("ledger_entry_count must be a positive integer");
	if (Array.isArray(record.ledger_entry_refs) && record.ledger_entry_count !== record.ledger_entry_refs.length) errors.push("ledger_entry_count must match ledger_entry_refs length");
	if (!Array.isArray(record.blocked_labels) || record.blocked_labels.length === 0) errors.push("blocked_labels must be a non-empty array");
	else for (const [index, label] of record.blocked_labels.entries()) errors.push(...validateOpaqueRef(label, `blocked_labels[${index}]`).errors);
	if (record.federated_registry_publication_opt_in === false && Array.isArray(record.blocked_labels) && !record.blocked_labels.includes("federated-registry-publication-opt-in-missing")) errors.push("missing opt-in must be represented in blocked_labels");
	if (record.federated_registry_publication_opt_in === true && Array.isArray(record.blocked_labels) && !record.blocked_labels.includes("remote-write-blocked-by-default")) errors.push("explicit opt-in must still keep remote-write blocked by default");
	errors.push(...validateRegistryPublicationAuthorityFlags(record, "federated score registry publication intent").errors);
	errors.push(...validateNoForbiddenRawPayloads(record, "federated_score_registry_publication_intent").errors);
	return errors.length === 0 ? valid() : invalid(...errors);
}

export function validateFlowDeskFederatedScoreRegistryPublicationRequestV1(value: unknown): ValidationResult {
	if (!isRecord(value)) return invalid("federated score registry publication request must be an object");
	const record = value as Partial<FlowDeskFederatedScoreRegistryPublicationRequestV1>;
	const errors: string[] = [];
	errors.push(...rejectUnknownProperties(record, [
		"schema_version",
		"request_id",
		"workflow_id",
		"registry_ref",
		"ledger_entry_refs",
		"requested_at",
		"federated_registry_publication_opt_in",
		"connector_gate_ref",
		"connector_gate_satisfied",
		"remote_write_blocked_by_default",
		"remote_write_attempted",
		"non_authorizing",
		"advisory_only",
		"dispatch_authority_enabled",
		"approval_authority_enabled",
		"provider_authority_enabled",
		"runtime_authority_enabled",
		"external_write_authority_enabled",
		"remote_write_authority_enabled",
		"fallback_authority_enabled",
		"lane_launch_authority_enabled",
	], "federated score registry publication request").errors);
	if (record.schema_version !== "flowdesk.federated_score_registry_publication_request.v1") errors.push("federated score registry publication request schema_version is invalid");
	errors.push(...validateOpaqueId(record.request_id, "request_id").errors);
	errors.push(...validateOpaqueId(record.workflow_id, "workflow_id").errors);
	errors.push(...validateOpaqueRef(record.registry_ref, "registry_ref").errors);
	errors.push(...validateTimestamp(record.requested_at, "requested_at").errors);
	if (record.connector_gate_ref !== undefined) errors.push(...validateOpaqueRef(record.connector_gate_ref, "connector_gate_ref").errors);
	if (typeof record.federated_registry_publication_opt_in !== "boolean") errors.push("federated_registry_publication_opt_in must be boolean");
	if (!Array.isArray(record.ledger_entry_refs) || record.ledger_entry_refs.length === 0) errors.push("ledger_entry_refs must be a non-empty array");
	else for (const [index, ref] of record.ledger_entry_refs.entries()) errors.push(...validateOpaqueRef(ref, `ledger_entry_refs[${index}]`).errors);
	errors.push(...validateRegistryPublicationAuthorityFlags(record, "federated score registry publication request").errors);
	errors.push(...validateNoForbiddenRawPayloads(record, "federated_score_registry_publication_request").errors);
	return errors.length === 0 ? valid() : invalid(...errors);
}

// ─── P8-S4: Federated registry connector gate evaluator ──────────────────────

/**
 * Input for the federated registry connector gate evaluator.
 * All ref fields are opaque — no raw paths, prompts, or provider payloads.
 */
export interface FlowDeskFederatedGateEvaluationInputV1 {
	capabilityDescriptorRef?: string;   // opaque ref — if present, must be schema-safe
	intentRef?: string;                 // opaque ref to publication intent
	workflowId: string;
	attemptId: string;
	threatModelDocRef?: string;         // opaque ref to threat model doc
	privacyReviewRef?: string;          // opaque ref to privacy review (not yet available)
	securityAuditRef?: string;          // opaque ref to security audit (not yet available)
}

/**
 * Result of the federated registry connector gate evaluator.
 * gate_satisfied is ALWAYS false — this is a diagnostic evaluator, not an authorization function.
 * All authority flags are structural false literals; none can be changed at runtime.
 */
export interface FlowDeskFederatedGateEvaluationResultV1 {
	schema_version: "flowdesk.federated_gate_evaluation.v1";
	evaluation_id: string;
	workflow_id: string;
	attempt_id: string;
	gate_satisfied: false;              // literal false — NEVER true in this evaluator
	redacted_block_reasons: readonly string[];  // why gate cannot be satisfied right now
	missing_evidence_labels: readonly string[]; // what evidence would be needed for a future gate
	evaluated_at: string;
	advisory_only: true;
	non_authorizing: true;
	connector_gate_promotion_authorized: false;
	remote_write_authority_enabled: false;
	dispatch_authority_enabled: false;
}

/**
 * Evaluate whether a federated registry connector gate could theoretically be satisfied.
 * This evaluator ALWAYS returns gate_satisfied: false — it is a diagnostic function only.
 * It never throws; any input produces a valid result.
 */
export function evaluateFlowDeskFederatedRegistryConnectorGateV1(
	input: FlowDeskFederatedGateEvaluationInputV1
): FlowDeskFederatedGateEvaluationResultV1 {
	const redactedBlockReasons: string[] = [
		"connector_gate_promotion_not_yet_authorized",
	];
	const missingEvidenceLabels: string[] = [
		"flowdesk.federated_registry_connector_capability.v1",
	];

	if (input.privacyReviewRef === undefined) {
		redactedBlockReasons.push("privacy_review_evidence_missing");
		missingEvidenceLabels.push("privacy_review_record");
	}
	if (input.securityAuditRef === undefined) {
		redactedBlockReasons.push("security_audit_evidence_missing");
		missingEvidenceLabels.push("security_audit_record");
	}
	if (input.capabilityDescriptorRef === undefined) {
		redactedBlockReasons.push("connector_capability_descriptor_missing");
	}

	return {
		schema_version: "flowdesk.federated_gate_evaluation.v1",
		evaluation_id: `eval-${input.workflowId}-${input.attemptId}`,
		workflow_id: input.workflowId,
		attempt_id: input.attemptId,
		gate_satisfied: false,
		redacted_block_reasons: redactedBlockReasons,
		missing_evidence_labels: missingEvidenceLabels,
		evaluated_at: new Date().toISOString(),
		advisory_only: true,
		non_authorizing: true,
		connector_gate_promotion_authorized: false,
		remote_write_authority_enabled: false,
		dispatch_authority_enabled: false,
	};
}

/**
 * Validates a FlowDeskFederatedGateEvaluationResultV1.
 * Rejects any attempt to set gate_satisfied or authority flags to true (authority smuggling).
 */
export function validateFlowDeskFederatedGateEvaluationResultV1(value: unknown): ValidationResult {
	if (!isRecord(value)) return invalid("federated gate evaluation result must be an object");
	const record = value as Partial<FlowDeskFederatedGateEvaluationResultV1>;
	const errors: string[] = [];
	errors.push(...rejectUnknownProperties(record, [
		"schema_version",
		"evaluation_id",
		"workflow_id",
		"attempt_id",
		"gate_satisfied",
		"redacted_block_reasons",
		"missing_evidence_labels",
		"evaluated_at",
		"advisory_only",
		"non_authorizing",
		"connector_gate_promotion_authorized",
		"remote_write_authority_enabled",
		"dispatch_authority_enabled",
	], "federated gate evaluation result").errors);
	if (record.schema_version !== "flowdesk.federated_gate_evaluation.v1") errors.push("federated gate evaluation result schema_version is invalid");
	errors.push(...validateOpaqueId(record.evaluation_id, "evaluation_id").errors);
	errors.push(...validateOpaqueId(record.workflow_id, "workflow_id").errors);
	errors.push(...validateOpaqueId(record.attempt_id, "attempt_id").errors);
	errors.push(...validateTimestamp(record.evaluated_at, "evaluated_at").errors);
	// Structural authority checks — these must always be false/true literals
	if (record.gate_satisfied !== false) errors.push("federated gate evaluation result gate_satisfied must always be false (authority smuggling rejected)");
	if (record.advisory_only !== true) errors.push("federated gate evaluation result advisory_only must be true");
	if (record.non_authorizing !== true) errors.push("federated gate evaluation result non_authorizing must be true");
	if (record.connector_gate_promotion_authorized !== false) errors.push("federated gate evaluation result connector_gate_promotion_authorized must be false (authority smuggling rejected)");
	if (record.remote_write_authority_enabled !== false) errors.push("federated gate evaluation result remote_write_authority_enabled must be false (authority smuggling rejected)");
	if (record.dispatch_authority_enabled !== false) errors.push("federated gate evaluation result dispatch_authority_enabled must be false (authority smuggling rejected)");
	// Validate redacted_block_reasons — must be non-empty and include the mandatory reason
	if (!Array.isArray(record.redacted_block_reasons) || record.redacted_block_reasons.length === 0) {
		errors.push("federated gate evaluation result redacted_block_reasons must be a non-empty array");
	} else {
		if (!record.redacted_block_reasons.includes("connector_gate_promotion_not_yet_authorized")) {
			errors.push("federated gate evaluation result redacted_block_reasons must include connector_gate_promotion_not_yet_authorized");
		}
		for (const [index, reason] of record.redacted_block_reasons.entries()) {
			errors.push(...validateOpaqueRef(reason, `redacted_block_reasons[${index}]`).errors);
		}
	}
	// Validate missing_evidence_labels — must be non-empty and include the mandatory capability label
	if (!Array.isArray(record.missing_evidence_labels) || record.missing_evidence_labels.length === 0) {
		errors.push("federated gate evaluation result missing_evidence_labels must be a non-empty array");
	} else {
		if (!record.missing_evidence_labels.includes("flowdesk.federated_registry_connector_capability.v1")) {
			errors.push("federated gate evaluation result missing_evidence_labels must include flowdesk.federated_registry_connector_capability.v1");
		}
	}
	errors.push(...validateNoForbiddenRawPayloads(record, "federated_gate_evaluation_result").errors);
	return errors.length === 0 ? valid() : invalid(...errors);
}

// ─── P8-S3: Federated Registry Connector Capability ──────────────────────────

/** Narrowed connector kinds supported by federated registry operations. */
export type FlowDeskFederatedConnectorKindV1 = "github_issue" | "github_pr_comment";

const FEDERATED_CONNECTOR_KINDS: readonly FlowDeskFederatedConnectorKindV1[] = ["github_issue", "github_pr_comment"];

export type FlowDeskFederatedConnectorCapabilityStateV1 = "available" | "missing_tools" | "auth_missing" | "blocked";

export interface FlowDeskFederatedRegistryConnectorCapabilityV1 {
	schema_version: "flowdesk.federated_registry_connector_capability.v1";
	capability_descriptor_id: string;
	capability_ref: string;
	connector_kind: FlowDeskFederatedConnectorKindV1;
	connector_profile_ref: string;
	registry_ref: string;
	auth_scope_ref: string;
	target_kind: FlowDeskFederatedConnectorKindV1;
	tool_ref: string;
	capability_state: FlowDeskFederatedConnectorCapabilityStateV1;
	content_format_ref: string;
	dry_run_supported: boolean;
	discovered_at: string;
	connector_gate_satisfiable: boolean;
	remote_write_blocked_by_default: true;
	remote_write_authority_enabled: false;
	external_write_authority_enabled: false;
	dispatch_authority_enabled: false;
	providerCall: false;
	actualLaneLaunch: false;
	runtimeExecution: false;
}

export interface FlowDeskFederatedRegistryConnectorCapabilityResultV1 {
	ok: boolean;
	errors: string[];
	capability?: FlowDeskFederatedRegistryConnectorCapabilityV1;
}

export function createFlowDeskFederatedRegistryConnectorCapabilityV1(input: {
	capabilityDescriptorId: string;
	capabilityRef: string;
	connectorKind: FlowDeskFederatedConnectorKindV1;
	connectorProfileRef: string;
	registryRef: string;
	authScopeRef: string;
	targetKind: FlowDeskFederatedConnectorKindV1;
	toolRef: string;
	capabilityState: FlowDeskFederatedConnectorCapabilityStateV1;
	contentFormatRef: string;
	dryRunSupported: boolean;
	discoveredAt: string;
}): FlowDeskFederatedRegistryConnectorCapabilityResultV1 {
	const errors: string[] = [];
	errors.push(...validateOpaqueId(input.capabilityDescriptorId, "capability_descriptor_id").errors);
	errors.push(...validateOpaqueRef(input.capabilityRef, "capability_ref").errors);
	if (!FEDERATED_CONNECTOR_KINDS.includes(input.connectorKind)) errors.push("connector_kind must be github_issue or github_pr_comment");
	errors.push(...validateOpaqueRef(input.connectorProfileRef, "connector_profile_ref").errors);
	errors.push(...validateOpaqueRef(input.registryRef, "registry_ref").errors);
	errors.push(...validateOpaqueRef(input.authScopeRef, "auth_scope_ref").errors);
	if (!FEDERATED_CONNECTOR_KINDS.includes(input.targetKind)) errors.push("target_kind must be github_issue or github_pr_comment");
	errors.push(...validateOpaqueRef(input.toolRef, "tool_ref").errors);
	if (!["available", "missing_tools", "auth_missing", "blocked"].includes(input.capabilityState)) errors.push("capability_state is invalid");
	errors.push(...validateOpaqueRef(input.contentFormatRef, "content_format_ref").errors);
	errors.push(...validateTimestamp(input.discoveredAt, "discovered_at").errors);
	if (typeof input.dryRunSupported !== "boolean") errors.push("dry_run_supported must be boolean");
	if (errors.length > 0) return { ok: false, errors };
	const connectorGateSatisfiable = input.capabilityState === "available" && input.dryRunSupported === true;
	return {
		ok: true,
		errors: [],
		capability: {
			schema_version: "flowdesk.federated_registry_connector_capability.v1",
			capability_descriptor_id: input.capabilityDescriptorId,
			capability_ref: input.capabilityRef,
			connector_kind: input.connectorKind,
			connector_profile_ref: input.connectorProfileRef,
			registry_ref: input.registryRef,
			auth_scope_ref: input.authScopeRef,
			target_kind: input.targetKind,
			tool_ref: input.toolRef,
			capability_state: input.capabilityState,
			content_format_ref: input.contentFormatRef,
			dry_run_supported: input.dryRunSupported,
			discovered_at: input.discoveredAt,
			connector_gate_satisfiable: connectorGateSatisfiable,
			remote_write_blocked_by_default: true,
			remote_write_authority_enabled: false,
			external_write_authority_enabled: false,
			dispatch_authority_enabled: false,
			providerCall: false,
			actualLaneLaunch: false,
			runtimeExecution: false,
		},
	};
}

export function validateFlowDeskFederatedRegistryConnectorCapabilityV1(value: unknown): ValidationResult {
	if (!isRecord(value)) return invalid("federated registry connector capability must be an object");
	const record = value as Partial<FlowDeskFederatedRegistryConnectorCapabilityV1>;
	const errors: string[] = [];
	errors.push(...rejectUnknownProperties(record, [
		"schema_version",
		"capability_descriptor_id",
		"capability_ref",
		"connector_kind",
		"connector_profile_ref",
		"registry_ref",
		"auth_scope_ref",
		"target_kind",
		"tool_ref",
		"capability_state",
		"content_format_ref",
		"dry_run_supported",
		"discovered_at",
		"connector_gate_satisfiable",
		"remote_write_blocked_by_default",
		"remote_write_authority_enabled",
		"external_write_authority_enabled",
		"dispatch_authority_enabled",
		"providerCall",
		"actualLaneLaunch",
		"runtimeExecution",
	], "federated registry connector capability").errors);
	if (record.schema_version !== "flowdesk.federated_registry_connector_capability.v1") errors.push("federated registry connector capability schema_version is invalid");
	errors.push(...validateOpaqueId(record.capability_descriptor_id, "capability_descriptor_id").errors);
	errors.push(...validateOpaqueRef(record.capability_ref, "capability_ref").errors);
	if (!FEDERATED_CONNECTOR_KINDS.includes(record.connector_kind as FlowDeskFederatedConnectorKindV1)) errors.push("connector_kind must be github_issue or github_pr_comment");
	errors.push(...validateOpaqueRef(record.connector_profile_ref, "connector_profile_ref").errors);
	errors.push(...validateOpaqueRef(record.registry_ref, "registry_ref").errors);
	errors.push(...validateOpaqueRef(record.auth_scope_ref, "auth_scope_ref").errors);
	if (!FEDERATED_CONNECTOR_KINDS.includes(record.target_kind as FlowDeskFederatedConnectorKindV1)) errors.push("target_kind must be github_issue or github_pr_comment");
	errors.push(...validateOpaqueRef(record.tool_ref, "tool_ref").errors);
	if (!["available", "missing_tools", "auth_missing", "blocked"].includes(record.capability_state ?? "")) errors.push("capability_state is invalid");
	errors.push(...validateOpaqueRef(record.content_format_ref, "content_format_ref").errors);
	errors.push(...validateTimestamp(record.discovered_at, "discovered_at").errors);
	if (typeof record.dry_run_supported !== "boolean") errors.push("dry_run_supported must be boolean");
	// connector_gate_satisfiable must be false when capability_state !== "available"
	if (record.capability_state !== "available" && record.connector_gate_satisfiable !== false) errors.push("connector_gate_satisfiable must be false when capability_state is not available");
	if (record.capability_state === "available" && typeof record.connector_gate_satisfiable !== "boolean") errors.push("connector_gate_satisfiable must be boolean");
	// Authority flags - all must be false literals
	if (record.remote_write_blocked_by_default !== true) errors.push("remote_write_blocked_by_default must be true");
	if (record.remote_write_authority_enabled !== false) errors.push("remote_write_authority_enabled must be false (authority smuggling rejected)");
	if (record.external_write_authority_enabled !== false) errors.push("external_write_authority_enabled must be false (authority smuggling rejected)");
	if (record.dispatch_authority_enabled !== false) errors.push("dispatch_authority_enabled must be false (authority smuggling rejected)");
	if (record.providerCall !== false) errors.push("providerCall must be false (authority smuggling rejected)");
	if (record.actualLaneLaunch !== false) errors.push("actualLaneLaunch must be false (authority smuggling rejected)");
	if (record.runtimeExecution !== false) errors.push("runtimeExecution must be false (authority smuggling rejected)");
	errors.push(...validateNoForbiddenRawPayloads(record, "federated_registry_connector_capability").errors);
	return errors.length === 0 ? valid() : invalid(...errors);
}

// ─── P8-S3: Federated Registry Publication Preflight ─────────────────────────

export type FlowDeskFederatedPreflightStateV1 = "preflight_passed" | "blocked";

export interface FlowDeskFederatedRegistryPublicationPreflightV1 {
	schema_version: "flowdesk.federated_registry_publication_preflight.v1";
	preflight_id: string;
	publication_intent_ref: string;
	capability_descriptor_ref: string;
	workflow_id: string;
	attempt_id: string;
	registry_ref: string;
	connector_kind: FlowDeskFederatedConnectorKindV1;
	target_ref: string;
	content_hash_ref: string;
	redaction_policy_ref: string;
	auth_scope_ref: string;
	dry_run_required: true;
	content_format_ref: string;
	idempotency_key_ref: string;
	pre_write_audit_ref: string;
	preflight_state: FlowDeskFederatedPreflightStateV1;
	blocked_labels: string[];
	connector_gate_satisfied: false;
	remote_write_blocked_by_default: true;
	remote_write_attempted: false;
	preflight_only: true;
	non_authorizing: true;
	advisory_only: true;
	created_at: string;
	remote_write_authority_enabled: false;
	external_write_authority_enabled: false;
	dispatch_authority_enabled: false;
	providerCall: false;
	actualLaneLaunch: false;
	runtimeExecution: false;
}

export interface FlowDeskFederatedRegistryPublicationPreflightResultV1 {
	ok: boolean;
	errors: string[];
	preflight?: FlowDeskFederatedRegistryPublicationPreflightV1;
}

export function createFlowDeskFederatedRegistryPublicationPreflightV1(input: {
	preflightId: string;
	publicationIntentRef: string;
	capabilityDescriptorRef: string;
	workflowId: string;
	attemptId: string;
	registryRef: string;
	connectorKind: FlowDeskFederatedConnectorKindV1;
	targetRef: string;
	contentHashRef: string;
	redactionPolicyRef: string;
	authScopeRef: string;
	contentFormatRef: string;
	idempotencyKeyRef: string;
	preWriteAuditRef: string;
	preflightState: FlowDeskFederatedPreflightStateV1;
	blockedLabels: string[];
	createdAt: string;
}): FlowDeskFederatedRegistryPublicationPreflightResultV1 {
	const errors: string[] = [];
	errors.push(...validateOpaqueId(input.preflightId, "preflight_id").errors);
	errors.push(...validateOpaqueRef(input.publicationIntentRef, "publication_intent_ref").errors);
	errors.push(...validateOpaqueRef(input.capabilityDescriptorRef, "capability_descriptor_ref").errors);
	errors.push(...validateOpaqueId(input.workflowId, "workflow_id").errors);
	errors.push(...validateOpaqueId(input.attemptId, "attempt_id").errors);
	errors.push(...validateOpaqueRef(input.registryRef, "registry_ref").errors);
	if (!FEDERATED_CONNECTOR_KINDS.includes(input.connectorKind)) errors.push("connector_kind must be github_issue or github_pr_comment");
	errors.push(...validateOpaqueRef(input.targetRef, "target_ref").errors);
	errors.push(...validateHashRef(input.contentHashRef, "content_hash_ref").errors);
	errors.push(...validateOpaqueRef(input.redactionPolicyRef, "redaction_policy_ref").errors);
	errors.push(...validateOpaqueRef(input.authScopeRef, "auth_scope_ref").errors);
	errors.push(...validateOpaqueRef(input.contentFormatRef, "content_format_ref").errors);
	errors.push(...validateOpaqueRef(input.idempotencyKeyRef, "idempotency_key_ref").errors);
	errors.push(...validateOpaqueRef(input.preWriteAuditRef, "pre_write_audit_ref").errors);
	if (!["preflight_passed", "blocked"].includes(input.preflightState)) errors.push("preflight_state is invalid");
	if (!Array.isArray(input.blockedLabels)) errors.push("blocked_labels must be an array");
	else if (input.preflightState === "blocked" && input.blockedLabels.length === 0) errors.push("blocked preflight must carry blocked_labels");
	errors.push(...validateTimestamp(input.createdAt, "created_at").errors);
	if (errors.length > 0) return { ok: false, errors };
	return {
		ok: true,
		errors: [],
		preflight: {
			schema_version: "flowdesk.federated_registry_publication_preflight.v1",
			preflight_id: input.preflightId,
			publication_intent_ref: input.publicationIntentRef,
			capability_descriptor_ref: input.capabilityDescriptorRef,
			workflow_id: input.workflowId,
			attempt_id: input.attemptId,
			registry_ref: input.registryRef,
			connector_kind: input.connectorKind,
			target_ref: input.targetRef,
			content_hash_ref: input.contentHashRef,
			redaction_policy_ref: input.redactionPolicyRef,
			auth_scope_ref: input.authScopeRef,
			dry_run_required: true,
			content_format_ref: input.contentFormatRef,
			idempotency_key_ref: input.idempotencyKeyRef,
			pre_write_audit_ref: input.preWriteAuditRef,
			preflight_state: input.preflightState,
			blocked_labels: input.blockedLabels,
			connector_gate_satisfied: false,
			remote_write_blocked_by_default: true,
			remote_write_attempted: false,
			preflight_only: true,
			non_authorizing: true,
			advisory_only: true,
			created_at: input.createdAt,
			remote_write_authority_enabled: false,
			external_write_authority_enabled: false,
			dispatch_authority_enabled: false,
			providerCall: false,
			actualLaneLaunch: false,
			runtimeExecution: false,
		},
	};
}

export function validateFlowDeskFederatedRegistryPublicationPreflightV1(value: unknown): ValidationResult {
	if (!isRecord(value)) return invalid("federated registry publication preflight must be an object");
	const record = value as Partial<FlowDeskFederatedRegistryPublicationPreflightV1>;
	const errors: string[] = [];
	errors.push(...rejectUnknownProperties(record, [
		"schema_version",
		"preflight_id",
		"publication_intent_ref",
		"capability_descriptor_ref",
		"workflow_id",
		"attempt_id",
		"registry_ref",
		"connector_kind",
		"target_ref",
		"content_hash_ref",
		"redaction_policy_ref",
		"auth_scope_ref",
		"dry_run_required",
		"content_format_ref",
		"idempotency_key_ref",
		"pre_write_audit_ref",
		"preflight_state",
		"blocked_labels",
		"connector_gate_satisfied",
		"remote_write_blocked_by_default",
		"remote_write_attempted",
		"preflight_only",
		"non_authorizing",
		"advisory_only",
		"created_at",
		"remote_write_authority_enabled",
		"external_write_authority_enabled",
		"dispatch_authority_enabled",
		"providerCall",
		"actualLaneLaunch",
		"runtimeExecution",
	], "federated registry publication preflight").errors);
	if (record.schema_version !== "flowdesk.federated_registry_publication_preflight.v1") errors.push("federated registry publication preflight schema_version is invalid");
	errors.push(...validateOpaqueId(record.preflight_id, "preflight_id").errors);
	errors.push(...validateOpaqueRef(record.publication_intent_ref, "publication_intent_ref").errors);
	errors.push(...validateOpaqueRef(record.capability_descriptor_ref, "capability_descriptor_ref").errors);
	errors.push(...validateOpaqueId(record.workflow_id, "workflow_id").errors);
	errors.push(...validateOpaqueId(record.attempt_id, "attempt_id").errors);
	errors.push(...validateOpaqueRef(record.registry_ref, "registry_ref").errors);
	if (!FEDERATED_CONNECTOR_KINDS.includes(record.connector_kind as FlowDeskFederatedConnectorKindV1)) errors.push("connector_kind must be github_issue or github_pr_comment");
	errors.push(...validateOpaqueRef(record.target_ref, "target_ref").errors);
	errors.push(...validateHashRef(record.content_hash_ref, "content_hash_ref").errors);
	errors.push(...validateOpaqueRef(record.redaction_policy_ref, "redaction_policy_ref").errors);
	errors.push(...validateOpaqueRef(record.auth_scope_ref, "auth_scope_ref").errors);
	errors.push(...validateOpaqueRef(record.content_format_ref, "content_format_ref").errors);
	errors.push(...validateOpaqueRef(record.idempotency_key_ref, "idempotency_key_ref").errors);
	errors.push(...validateOpaqueRef(record.pre_write_audit_ref, "pre_write_audit_ref").errors);
	if (!["preflight_passed", "blocked"].includes(record.preflight_state ?? "")) errors.push("preflight_state is invalid");
	if (!Array.isArray(record.blocked_labels)) errors.push("blocked_labels must be an array");
	else if (record.preflight_state === "blocked" && record.blocked_labels.length === 0) errors.push("blocked preflight must carry blocked_labels");
	errors.push(...validateTimestamp(record.created_at, "created_at").errors);
	// Invariant literals
	if (record.connector_gate_satisfied !== false) errors.push("connector_gate_satisfied must be false (authority smuggling rejected)");
	if (record.remote_write_blocked_by_default !== true) errors.push("remote_write_blocked_by_default must be true");
	if (record.remote_write_attempted !== false) errors.push("remote_write_attempted must be false");
	if (record.preflight_only !== true) errors.push("preflight_only must be true");
	if (record.non_authorizing !== true) errors.push("non_authorizing must be true");
	if (record.advisory_only !== true) errors.push("advisory_only must be true");
	if (record.dry_run_required !== true) errors.push("dry_run_required must be true");
	// Authority flags
	if (record.remote_write_authority_enabled !== false) errors.push("remote_write_authority_enabled must be false (authority smuggling rejected)");
	if (record.external_write_authority_enabled !== false) errors.push("external_write_authority_enabled must be false (authority smuggling rejected)");
	if (record.dispatch_authority_enabled !== false) errors.push("dispatch_authority_enabled must be false (authority smuggling rejected)");
	if (record.providerCall !== false) errors.push("providerCall must be false (authority smuggling rejected)");
	if (record.actualLaneLaunch !== false) errors.push("actualLaneLaunch must be false (authority smuggling rejected)");
	if (record.runtimeExecution !== false) errors.push("runtimeExecution must be false (authority smuggling rejected)");
	errors.push(...validateNoForbiddenRawPayloads(record, "federated_registry_publication_preflight").errors);
	return errors.length === 0 ? valid() : invalid(...errors);
}

// ─── P8-S3: GitHub Dry-Run Publication Result ─────────────────────────────────

function validateRedactedTargetLabel(value: unknown, label: string): ValidationResult {
	if (typeof value !== "string" || value.length < 1 || value.length > 500) return invalid(`${label} must be a bounded 1..500 string`);
	// Reject raw URLs – must be a human-readable label like "issue #NNN in org/repo"
	if (/https?:\/\//i.test(value)) return invalid(`${label} must not contain raw URLs`);
	return validateNoForbiddenRawPayloads(value, label);
}

function validateRedactedContentPreview(value: unknown, label: string): ValidationResult {
	if (typeof value !== "string" || value.length < 1 || value.length > 500) return invalid(`${label} must be a bounded 1..500 string`);
	return validateNoForbiddenRawPayloads(value, label);
}

export type FlowDeskGitHubDryRunStateV1 = "dry_run_recorded" | "blocked";

export interface FlowDeskGitHubDryRunPublicationResultV1 {
	schema_version: "flowdesk.github_dry_run_publication_result.v1";
	dry_run_result_id: string;
	preflight_ref: string;
	write_plan_ref: string;
	workflow_id: string;
	attempt_id: string;
	connector_kind: FlowDeskFederatedConnectorKindV1;
	redacted_target_label: string;
	redacted_content_preview: string;
	content_hash_ref: string;
	dry_run_state: FlowDeskGitHubDryRunStateV1;
	blocked_labels: string[];
	fake_remote_write_attempted: boolean;
	would_produce_ref_shape: "github_url";
	remote_write_attempted: false;
	github_write_attempted: false;
	connector_write_attempted: false;
	remote_write_authority_enabled: false;
	external_write_authority_enabled: false;
	dispatch_authority_enabled: false;
	providerCall: false;
	actualLaneLaunch: false;
	runtimeExecution: false;
}

export interface FlowDeskGitHubDryRunPublicationResultResultV1 {
	ok: boolean;
	errors: string[];
	result?: FlowDeskGitHubDryRunPublicationResultV1;
}

export function createFlowDeskGitHubDryRunPublicationResultV1(input: {
	dryRunResultId: string;
	preflightRef: string;
	writePlanRef: string;
	workflowId: string;
	attemptId: string;
	connectorKind: FlowDeskFederatedConnectorKindV1;
	redactedTargetLabel: string;
	redactedContentPreview: string;
	contentHashRef: string;
	dryRunState: FlowDeskGitHubDryRunStateV1;
	blockedLabels: string[];
	fakeRemoteWriteAttempted: boolean;
}): FlowDeskGitHubDryRunPublicationResultResultV1 {
	const errors: string[] = [];
	errors.push(...validateOpaqueId(input.dryRunResultId, "dry_run_result_id").errors);
	errors.push(...validateOpaqueRef(input.preflightRef, "preflight_ref").errors);
	errors.push(...validateOpaqueRef(input.writePlanRef, "write_plan_ref").errors);
	errors.push(...validateOpaqueId(input.workflowId, "workflow_id").errors);
	errors.push(...validateOpaqueId(input.attemptId, "attempt_id").errors);
	if (!FEDERATED_CONNECTOR_KINDS.includes(input.connectorKind)) errors.push("connector_kind must be github_issue or github_pr_comment");
	errors.push(...validateRedactedTargetLabel(input.redactedTargetLabel, "redacted_target_label").errors);
	errors.push(...validateRedactedContentPreview(input.redactedContentPreview, "redacted_content_preview").errors);
	errors.push(...validateHashRef(input.contentHashRef, "content_hash_ref").errors);
	if (!["dry_run_recorded", "blocked"].includes(input.dryRunState)) errors.push("dry_run_state is invalid");
	if (!Array.isArray(input.blockedLabels)) errors.push("blocked_labels must be an array");
	else if (input.dryRunState === "blocked" && input.blockedLabels.length === 0) errors.push("blocked dry-run must carry blocked_labels");
	if (typeof input.fakeRemoteWriteAttempted !== "boolean") errors.push("fake_remote_write_attempted must be boolean");
	if (errors.length > 0) return { ok: false, errors };
	return {
		ok: true,
		errors: [],
		result: {
			schema_version: "flowdesk.github_dry_run_publication_result.v1",
			dry_run_result_id: input.dryRunResultId,
			preflight_ref: input.preflightRef,
			write_plan_ref: input.writePlanRef,
			workflow_id: input.workflowId,
			attempt_id: input.attemptId,
			connector_kind: input.connectorKind,
			redacted_target_label: input.redactedTargetLabel,
			redacted_content_preview: input.redactedContentPreview,
			content_hash_ref: input.contentHashRef,
			dry_run_state: input.dryRunState,
			blocked_labels: input.blockedLabels,
			fake_remote_write_attempted: input.fakeRemoteWriteAttempted,
			would_produce_ref_shape: "github_url",
			remote_write_attempted: false,
			github_write_attempted: false,
			connector_write_attempted: false,
			remote_write_authority_enabled: false,
			external_write_authority_enabled: false,
			dispatch_authority_enabled: false,
			providerCall: false,
			actualLaneLaunch: false,
			runtimeExecution: false,
		},
	};
}

export function validateFlowDeskGitHubDryRunPublicationResultV1(value: unknown): ValidationResult {
	if (!isRecord(value)) return invalid("github dry-run publication result must be an object");
	const record = value as Partial<FlowDeskGitHubDryRunPublicationResultV1>;
	const errors: string[] = [];
	errors.push(...rejectUnknownProperties(record, [
		"schema_version",
		"dry_run_result_id",
		"preflight_ref",
		"write_plan_ref",
		"workflow_id",
		"attempt_id",
		"connector_kind",
		"redacted_target_label",
		"redacted_content_preview",
		"content_hash_ref",
		"dry_run_state",
		"blocked_labels",
		"fake_remote_write_attempted",
		"would_produce_ref_shape",
		"remote_write_attempted",
		"github_write_attempted",
		"connector_write_attempted",
		"remote_write_authority_enabled",
		"external_write_authority_enabled",
		"dispatch_authority_enabled",
		"providerCall",
		"actualLaneLaunch",
		"runtimeExecution",
	], "github dry-run publication result").errors);
	if (record.schema_version !== "flowdesk.github_dry_run_publication_result.v1") errors.push("github dry-run publication result schema_version is invalid");
	errors.push(...validateOpaqueId(record.dry_run_result_id, "dry_run_result_id").errors);
	errors.push(...validateOpaqueRef(record.preflight_ref, "preflight_ref").errors);
	errors.push(...validateOpaqueRef(record.write_plan_ref, "write_plan_ref").errors);
	errors.push(...validateOpaqueId(record.workflow_id, "workflow_id").errors);
	errors.push(...validateOpaqueId(record.attempt_id, "attempt_id").errors);
	if (!FEDERATED_CONNECTOR_KINDS.includes(record.connector_kind as FlowDeskFederatedConnectorKindV1)) errors.push("connector_kind must be github_issue or github_pr_comment");
	errors.push(...validateRedactedTargetLabel(record.redacted_target_label, "redacted_target_label").errors);
	errors.push(...validateRedactedContentPreview(record.redacted_content_preview, "redacted_content_preview").errors);
	errors.push(...validateHashRef(record.content_hash_ref, "content_hash_ref").errors);
	if (!["dry_run_recorded", "blocked"].includes(record.dry_run_state ?? "")) errors.push("dry_run_state is invalid");
	if (!Array.isArray(record.blocked_labels)) errors.push("blocked_labels must be an array");
	else if (record.dry_run_state === "blocked" && record.blocked_labels.length === 0) errors.push("blocked dry-run must carry blocked_labels");
	if (typeof record.fake_remote_write_attempted !== "boolean") errors.push("fake_remote_write_attempted must be boolean");
	// Invariant literals
	if (record.would_produce_ref_shape !== "github_url") errors.push("would_produce_ref_shape must be github_url");
	// Authority flags
	if (record.remote_write_attempted !== false) errors.push("remote_write_attempted must be false (authority smuggling rejected)");
	if (record.github_write_attempted !== false) errors.push("github_write_attempted must be false (authority smuggling rejected)");
	if (record.connector_write_attempted !== false) errors.push("connector_write_attempted must be false (authority smuggling rejected)");
	if (record.remote_write_authority_enabled !== false) errors.push("remote_write_authority_enabled must be false (authority smuggling rejected)");
	if (record.external_write_authority_enabled !== false) errors.push("external_write_authority_enabled must be false (authority smuggling rejected)");
	if (record.dispatch_authority_enabled !== false) errors.push("dispatch_authority_enabled must be false (authority smuggling rejected)");
	if (record.providerCall !== false) errors.push("providerCall must be false (authority smuggling rejected)");
	if (record.actualLaneLaunch !== false) errors.push("actualLaneLaunch must be false (authority smuggling rejected)");
	if (record.runtimeExecution !== false) errors.push("runtimeExecution must be false (authority smuggling rejected)");
	errors.push(...validateNoForbiddenRawPayloads(record, "github_dry_run_publication_result").errors);
	return errors.length === 0 ? valid() : invalid(...errors);
}
