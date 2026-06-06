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

// ─── P8-S7: Federated Data Minimization Policy ───────────────────────────────

/**
 * Advisory-only data minimization policy for federated score registry publication.
 * All strip_* and publish_* fields are structural literal contracts enforced at validation time.
 * advisory_only and non_authorizing are always true; no dispatch or remote-write authority.
 */
export interface FlowDeskFederatedDataMinimizationPolicyV1 {
	schema_version: "flowdesk.federated_data_minimization_policy.v1";
	policy_id: string;
	workflow_id: string;
	/** Raw workflowId is never published — hash only. */
	strip_workflow_id: true;
	/** Raw proposalId is never published — hash only. */
	strip_proposal_id: true;
	/** Task descriptions are stripped before publication. */
	strip_task_descriptions: true;
	/** Model identity is stripped; model names are never published. */
	strip_model_names: true;
	/** Exact scores are converted to bucketed ranges before publication. */
	publish_dimension_scores_as_buckets: true;
	/** Bucket size in score units. Must be 25 (4 buckets: 0-24, 25-49, 50-74, 75-100). */
	score_bucket_size: 25;
	/** Timestamp resolution published. Must be "day" — no sub-day precision published. */
	publish_timestamp_resolution: "day";
	/** Algorithm used for canonical workflow ref derivation. */
	canonical_workflow_ref_algorithm: "sha256";
	/** Minimum cohort size required for publication. Must be >= 10. */
	k_anonymity_threshold: number;
	created_at: string;
	advisory_only: true;
	non_authorizing: true;
	remote_write_authority_enabled: false;
	dispatch_authority_enabled: false;
}

export interface FlowDeskFederatedDataMinimizationPolicyResultV1 {
	ok: boolean;
	errors: string[];
	policy?: FlowDeskFederatedDataMinimizationPolicyV1;
}

export function createFlowDeskFederatedDataMinimizationPolicyV1(input: {
	policyId: string;
	workflowId: string;
	kAnonymityThreshold: number;
	createdAt: string;
}): FlowDeskFederatedDataMinimizationPolicyResultV1 {
	const errors: string[] = [];
	errors.push(...validateOpaqueId(input.policyId, "policy_id").errors);
	errors.push(...validateOpaqueId(input.workflowId, "workflow_id").errors);
	errors.push(...validateTimestamp(input.createdAt, "created_at").errors);
	if (typeof input.kAnonymityThreshold !== "number" || !Number.isInteger(input.kAnonymityThreshold) || input.kAnonymityThreshold < 10) {
		errors.push("k_anonymity_threshold must be an integer >= 10");
	}
	if (errors.length > 0) return { ok: false, errors };
	return {
		ok: true,
		errors: [],
		policy: {
			schema_version: "flowdesk.federated_data_minimization_policy.v1",
			policy_id: input.policyId,
			workflow_id: input.workflowId,
			strip_workflow_id: true,
			strip_proposal_id: true,
			strip_task_descriptions: true,
			strip_model_names: true,
			publish_dimension_scores_as_buckets: true,
			score_bucket_size: 25,
			publish_timestamp_resolution: "day",
			canonical_workflow_ref_algorithm: "sha256",
			k_anonymity_threshold: input.kAnonymityThreshold,
			created_at: input.createdAt,
			advisory_only: true,
			non_authorizing: true,
			remote_write_authority_enabled: false,
			dispatch_authority_enabled: false,
		},
	};
}

export function validateFlowDeskFederatedDataMinimizationPolicyV1(value: unknown): ValidationResult {
	if (!isRecord(value)) return invalid("federated data minimization policy must be an object");
	const record = value as Partial<FlowDeskFederatedDataMinimizationPolicyV1>;
	const errors: string[] = [];
	errors.push(...rejectUnknownProperties(record, [
		"schema_version",
		"policy_id",
		"workflow_id",
		"strip_workflow_id",
		"strip_proposal_id",
		"strip_task_descriptions",
		"strip_model_names",
		"publish_dimension_scores_as_buckets",
		"score_bucket_size",
		"publish_timestamp_resolution",
		"canonical_workflow_ref_algorithm",
		"k_anonymity_threshold",
		"created_at",
		"advisory_only",
		"non_authorizing",
		"remote_write_authority_enabled",
		"dispatch_authority_enabled",
	], "federated data minimization policy").errors);
	if (record.schema_version !== "flowdesk.federated_data_minimization_policy.v1") errors.push("federated data minimization policy schema_version is invalid");
	errors.push(...validateOpaqueId(record.policy_id, "policy_id").errors);
	errors.push(...validateOpaqueId(record.workflow_id, "workflow_id").errors);
	errors.push(...validateTimestamp(record.created_at, "created_at").errors);
	// Structural literal fields — all must be exact literals (closed schema)
	if (record.strip_workflow_id !== true) errors.push("strip_workflow_id must be true (authority smuggling rejected)");
	if (record.strip_proposal_id !== true) errors.push("strip_proposal_id must be true (authority smuggling rejected)");
	if (record.strip_task_descriptions !== true) errors.push("strip_task_descriptions must be true (authority smuggling rejected)");
	if (record.strip_model_names !== true) errors.push("strip_model_names must be true (authority smuggling rejected)");
	if (record.publish_dimension_scores_as_buckets !== true) errors.push("publish_dimension_scores_as_buckets must be true (authority smuggling rejected)");
	if (record.score_bucket_size !== 25) errors.push("score_bucket_size must be 25 (4 buckets: 0-24, 25-49, 50-74, 75-100)");
	if (record.publish_timestamp_resolution !== "day") errors.push("publish_timestamp_resolution must be \"day\"");
	if (record.canonical_workflow_ref_algorithm !== "sha256") errors.push("canonical_workflow_ref_algorithm must be \"sha256\"");
	// k_anonymity_threshold numeric check
	if (typeof record.k_anonymity_threshold !== "number" || !Number.isInteger(record.k_anonymity_threshold) || record.k_anonymity_threshold < 10) {
		errors.push("k_anonymity_threshold must be an integer >= 10");
	}
	// Authority flags — must all be false/true literals
	if (record.advisory_only !== true) errors.push("advisory_only must be true");
	if (record.non_authorizing !== true) errors.push("non_authorizing must be true");
	if (record.remote_write_authority_enabled !== false) errors.push("remote_write_authority_enabled must be false (authority smuggling rejected)");
	if (record.dispatch_authority_enabled !== false) errors.push("dispatch_authority_enabled must be false (authority smuggling rejected)");
	errors.push(...validateNoForbiddenRawPayloads(record, "federated_data_minimization_policy").errors);
	return errors.length === 0 ? valid() : invalid(...errors);
}

// ─── P8-S7: Federated Canonical Workflow Ref ──────────────────────────────────

/**
 * One-way opaque canonical workflow ref for federated publication.
 * source_hash_ref = SHA-256(installationId + workflowId) — raw workflowId never stored.
 * reversible and source_workflow_id_exposed are always false (closed literals).
 */
export interface FlowDeskFederatedCanonicalWorkflowRefV1 {
	schema_version: "flowdesk.federated_canonical_workflow_ref.v1";
	canonical_ref_id: string;
	/** SHA-256(installationId + workflowId) — opaque, one-way hash; raw workflowId never stored. */
	source_hash_ref: string;
	/** Algorithm used. Must always be "sha256". */
	algorithm: "sha256";
	/** Fields that were hashed. Must include both "installation_id" and "workflow_id". */
	input_fields_hashed: readonly ("installation_id" | "workflow_id")[];
	created_at: string;
	/** Reversal is structurally impossible — hash is one-way. */
	reversible: false;
	/** Raw workflowId is never exposed in this record. */
	source_workflow_id_exposed: false;
	advisory_only: true;
	non_authorizing: true;
	remote_write_authority_enabled: false;
}

export interface FlowDeskFederatedCanonicalWorkflowRefResultV1 {
	ok: boolean;
	errors: string[];
	canonicalRef?: FlowDeskFederatedCanonicalWorkflowRefV1;
}

/** Allowed input_fields_hashed values. */
const CANONICAL_WORKFLOW_REF_REQUIRED_FIELDS: ReadonlyArray<"installation_id" | "workflow_id"> = ["installation_id", "workflow_id"];

export function createFlowDeskFederatedCanonicalWorkflowRefV1(input: {
	canonicalRefId: string;
	sourceHashRef: string;
	createdAt: string;
}): FlowDeskFederatedCanonicalWorkflowRefResultV1 {
	const errors: string[] = [];
	errors.push(...validateOpaqueId(input.canonicalRefId, "canonical_ref_id").errors);
	errors.push(...validateHashRef(input.sourceHashRef, "source_hash_ref").errors);
	// Reject if source_hash_ref contains raw workflowId patterns (e.g. "workflow-")
	if (typeof input.sourceHashRef === "string" && /workflow-/i.test(input.sourceHashRef)) {
		errors.push("source_hash_ref must be an opaque hash — raw workflowId markers rejected");
	}
	errors.push(...validateNoForbiddenRawPayloads(input.sourceHashRef, "source_hash_ref").errors);
	errors.push(...validateTimestamp(input.createdAt, "created_at").errors);
	if (errors.length > 0) return { ok: false, errors };
	return {
		ok: true,
		errors: [],
		canonicalRef: {
			schema_version: "flowdesk.federated_canonical_workflow_ref.v1",
			canonical_ref_id: input.canonicalRefId,
			source_hash_ref: input.sourceHashRef,
			algorithm: "sha256",
			input_fields_hashed: ["installation_id", "workflow_id"],
			created_at: input.createdAt,
			reversible: false,
			source_workflow_id_exposed: false,
			advisory_only: true,
			non_authorizing: true,
			remote_write_authority_enabled: false,
		},
	};
}

export function validateFlowDeskFederatedCanonicalWorkflowRefV1(value: unknown): ValidationResult {
	if (!isRecord(value)) return invalid("federated canonical workflow ref must be an object");
	const record = value as Partial<FlowDeskFederatedCanonicalWorkflowRefV1>;
	const errors: string[] = [];
	errors.push(...rejectUnknownProperties(record, [
		"schema_version",
		"canonical_ref_id",
		"source_hash_ref",
		"algorithm",
		"input_fields_hashed",
		"created_at",
		"reversible",
		"source_workflow_id_exposed",
		"advisory_only",
		"non_authorizing",
		"remote_write_authority_enabled",
	], "federated canonical workflow ref").errors);
	if (record.schema_version !== "flowdesk.federated_canonical_workflow_ref.v1") errors.push("federated canonical workflow ref schema_version is invalid");
	errors.push(...validateOpaqueId(record.canonical_ref_id, "canonical_ref_id").errors);
	errors.push(...validateHashRef(record.source_hash_ref, "source_hash_ref").errors);
	// Reject raw workflowId markers in source_hash_ref
	if (typeof record.source_hash_ref === "string" && /workflow-/i.test(record.source_hash_ref)) {
		errors.push("source_hash_ref must be an opaque hash — raw workflowId markers rejected");
	}
	errors.push(...validateTimestamp(record.created_at, "created_at").errors);
	// Structural literal fields
	if (record.algorithm !== "sha256") errors.push("algorithm must be \"sha256\"");
	if (record.reversible !== false) errors.push("reversible must be false (hash is one-way; authority smuggling rejected)");
	if (record.source_workflow_id_exposed !== false) errors.push("source_workflow_id_exposed must be false (raw workflowId must never be exposed)");
	// input_fields_hashed: must be an array containing both required fields
	if (!Array.isArray(record.input_fields_hashed)) {
		errors.push("input_fields_hashed must be an array");
	} else {
		for (const required of CANONICAL_WORKFLOW_REF_REQUIRED_FIELDS) {
			if (!record.input_fields_hashed.includes(required)) {
				errors.push(`input_fields_hashed must include "${required}"`);
			}
		}
		for (const [index, field] of record.input_fields_hashed.entries()) {
			if (field !== "installation_id" && field !== "workflow_id") {
				errors.push(`input_fields_hashed[${index}] must be "installation_id" or "workflow_id"`);
			}
		}
	}
	// Authority flags
	if (record.advisory_only !== true) errors.push("advisory_only must be true");
	if (record.non_authorizing !== true) errors.push("non_authorizing must be true");
	if (record.remote_write_authority_enabled !== false) errors.push("remote_write_authority_enabled must be false (authority smuggling rejected)");
	errors.push(...validateNoForbiddenRawPayloads(record, "federated_canonical_workflow_ref").errors);
	return errors.length === 0 ? valid() : invalid(...errors);
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

// ─── P8-S6a: OAuth/Consent Architecture Contracts ─────────────────────────────

/** Valid consent scope values for federated registry operations. */
export type FlowDeskFederatedConsentScopeV1 = "publish_scores" | "read_scores" | "post_pr_comments";

const FEDERATED_CONSENT_SCOPES: readonly FlowDeskFederatedConsentScopeV1[] = [
	"publish_scores",
	"read_scores",
	"post_pr_comments",
];

/**
 * Advisory-only consent record for federated registry operations.
 * Captures operator-granted consent with revocability and scope bounds.
 * Always revocable; never grants remote-write or dispatch authority.
 */
export interface FlowDeskFederatedConsentRecordV1 {
	schema_version: "flowdesk.federated_consent_record.v1";
	consent_record_id: string;
	workflow_id: string;
	consent_granted_at: string;                      // ISO timestamp
	consent_granted_by: string;                      // opaque ref — operator config ref
	target_registry_ref: string;                     // opaque ref to registry config
	revocable: true;                                 // literal — always revocable
	revoked: boolean;
	revoked_at?: string;                             // ISO timestamp if revoked
	consent_scope: readonly FlowDeskFederatedConsentScopeV1[];
	retention_days: number;                          // 1..365
	installation_id_hash_ref: string;               // opaque hash ref — never raw installation id
	advisory_only: true;
	non_authorizing: true;
	remote_write_authority_enabled: false;
	dispatch_authority_enabled: false;
}

export interface FlowDeskFederatedConsentRecordResultV1 {
	ok: boolean;
	errors: string[];
	record?: FlowDeskFederatedConsentRecordV1;
}

export function createFlowDeskFederatedConsentRecordV1(input: {
	consentRecordId: string;
	workflowId: string;
	consentGrantedAt: string;
	consentGrantedBy: string;
	targetRegistryRef: string;
	revoked: boolean;
	revokedAt?: string;
	consentScope: readonly FlowDeskFederatedConsentScopeV1[];
	retentionDays: number;
	installationIdHashRef: string;
}): FlowDeskFederatedConsentRecordResultV1 {
	const errors: string[] = [];
	errors.push(...validateOpaqueId(input.consentRecordId, "consent_record_id").errors);
	errors.push(...validateOpaqueId(input.workflowId, "workflow_id").errors);
	errors.push(...validateTimestamp(input.consentGrantedAt, "consent_granted_at").errors);
	errors.push(...validateOpaqueRef(input.consentGrantedBy, "consent_granted_by").errors);
	errors.push(...validateOpaqueRef(input.targetRegistryRef, "target_registry_ref").errors);
	// consent_scope must be non-empty and contain only valid values
	if (!Array.isArray(input.consentScope) || input.consentScope.length === 0) {
		errors.push("consent_scope must be a non-empty array");
	} else {
		for (const [index, scope] of input.consentScope.entries()) {
			if (!FEDERATED_CONSENT_SCOPES.includes(scope)) errors.push(`consent_scope[${index}] is invalid`);
		}
	}
	// retention_days must be 1..365
	if (typeof input.retentionDays !== "number" || !Number.isInteger(input.retentionDays) || input.retentionDays < 1 || input.retentionDays > 365) {
		errors.push("retention_days must be an integer in 1..365");
	}
	// installation_id_hash_ref must be a valid hash ref — never raw installation id
	errors.push(...validateHashRef(input.installationIdHashRef, "installation_id_hash_ref").errors);
	// revoked=true requires revoked_at
	if (input.revoked === true) {
		if (input.revokedAt === undefined) {
			errors.push("revoked_at is required when revoked is true");
		} else {
			errors.push(...validateTimestamp(input.revokedAt, "revoked_at").errors);
		}
	} else if (input.revokedAt !== undefined) {
		errors.push(...validateTimestamp(input.revokedAt, "revoked_at").errors);
	}
	if (errors.length > 0) return { ok: false, errors };
	const record: FlowDeskFederatedConsentRecordV1 = {
		schema_version: "flowdesk.federated_consent_record.v1",
		consent_record_id: input.consentRecordId,
		workflow_id: input.workflowId,
		consent_granted_at: input.consentGrantedAt,
		consent_granted_by: input.consentGrantedBy,
		target_registry_ref: input.targetRegistryRef,
		revocable: true,
		revoked: input.revoked,
		...(input.revokedAt !== undefined ? { revoked_at: input.revokedAt } : {}),
		consent_scope: input.consentScope,
		retention_days: input.retentionDays,
		installation_id_hash_ref: input.installationIdHashRef,
		advisory_only: true,
		non_authorizing: true,
		remote_write_authority_enabled: false,
		dispatch_authority_enabled: false,
	};
	return { ok: true, errors: [], record };
}

export function validateFlowDeskFederatedConsentRecordV1(value: unknown): ValidationResult {
	if (!isRecord(value)) return invalid("federated consent record must be an object");
	const record = value as Partial<FlowDeskFederatedConsentRecordV1>;
	const errors: string[] = [];
	errors.push(...rejectUnknownProperties(record, [
		"schema_version",
		"consent_record_id",
		"workflow_id",
		"consent_granted_at",
		"consent_granted_by",
		"target_registry_ref",
		"revocable",
		"revoked",
		"revoked_at",
		"consent_scope",
		"retention_days",
		"installation_id_hash_ref",
		"advisory_only",
		"non_authorizing",
		"remote_write_authority_enabled",
		"dispatch_authority_enabled",
	], "federated consent record").errors);
	if (record.schema_version !== "flowdesk.federated_consent_record.v1") errors.push("federated consent record schema_version is invalid");
	errors.push(...validateOpaqueId(record.consent_record_id, "consent_record_id").errors);
	errors.push(...validateOpaqueId(record.workflow_id, "workflow_id").errors);
	errors.push(...validateTimestamp(record.consent_granted_at, "consent_granted_at").errors);
	errors.push(...validateOpaqueRef(record.consent_granted_by, "consent_granted_by").errors);
	errors.push(...validateOpaqueRef(record.target_registry_ref, "target_registry_ref").errors);
	// revocable must be literal true
	if (record.revocable !== true) errors.push("federated consent record revocable must be true (consent is always revocable)");
	// revoked must be boolean
	if (typeof record.revoked !== "boolean") errors.push("revoked must be a boolean");
	// revoked=true requires revoked_at
	if (record.revoked === true) {
		if (record.revoked_at === undefined) {
			errors.push("revoked_at is required when revoked is true");
		} else {
			errors.push(...validateTimestamp(record.revoked_at, "revoked_at").errors);
		}
	} else if (record.revoked_at !== undefined) {
		errors.push(...validateTimestamp(record.revoked_at, "revoked_at").errors);
	}
	// consent_scope must be non-empty array of valid values
	if (!Array.isArray(record.consent_scope) || record.consent_scope.length === 0) {
		errors.push("consent_scope must be a non-empty array");
	} else {
		for (const [index, scope] of record.consent_scope.entries()) {
			if (!FEDERATED_CONSENT_SCOPES.includes(scope as FlowDeskFederatedConsentScopeV1)) errors.push(`consent_scope[${index}] is invalid`);
		}
	}
	// retention_days must be 1..365
	if (typeof record.retention_days !== "number" || !Number.isInteger(record.retention_days) || record.retention_days < 1 || record.retention_days > 365) {
		errors.push("retention_days must be an integer in 1..365");
	}
	// installation_id_hash_ref must be valid hash ref
	errors.push(...validateHashRef(record.installation_id_hash_ref, "installation_id_hash_ref").errors);
	// Authority literal invariants
	if (record.advisory_only !== true) errors.push("federated consent record advisory_only must be true");
	if (record.non_authorizing !== true) errors.push("federated consent record non_authorizing must be true");
	if (record.remote_write_authority_enabled !== false) errors.push("remote_write_authority_enabled must be false (authority smuggling rejected)");
	if (record.dispatch_authority_enabled !== false) errors.push("dispatch_authority_enabled must be false (authority smuggling rejected)");
	errors.push(...validateNoForbiddenRawPayloads(record, "federated_consent_record").errors);
	return errors.length === 0 ? valid() : invalid(...errors);
}

// ─── P8-S6a: GitHub OAuth Architecture Contract ────────────────────────────────

/** Valid auth states for the GitHub OAuth architecture descriptor. */
export type FlowDeskGitHubOAuthAuthStateV1 = "configured" | "missing" | "expired" | "revoked";

const GITHUB_OAUTH_AUTH_STATES: readonly FlowDeskGitHubOAuthAuthStateV1[] = [
	"configured",
	"missing",
	"expired",
	"revoked",
];

/** Raw token pattern prefixes that must never appear in token_ref. */
const RAW_TOKEN_PATTERNS: readonly RegExp[] = [
	/ghp_/i,
	/github_pat_/i,
	/\bBearer\b/i,
];

/**
 * Advisory-only GitHub OAuth architecture descriptor.
 * Captures the auth scope, storage policy, and state without transmitting
 * actual token values. token_ref is always opaque — never the raw token.
 * token_transmitted_in_evidence is a literal false — tokens are never in durable evidence.
 */
export interface FlowDeskGitHubOAuthArchitectureV1 {
	schema_version: "flowdesk.github_oauth_architecture.v1";
	architecture_id: string;
	auth_scope_ref: string;                         // opaque ref
	required_github_scopes: readonly ("repo" | "public_repo" | "read:org")[];
	token_storage: "config_file_only";              // literal — never in-memory plaintext, never logs
	token_ref: string;                              // opaque ref — NEVER the actual token value
	auth_state: FlowDeskGitHubOAuthAuthStateV1;
	dry_run_allowed_without_token: boolean;
	advisory_only: true;
	non_authorizing: true;
	provider_call_made: false;
	token_transmitted_in_evidence: false;           // literal — token never in durable evidence
	remote_write_authority_enabled: false;
	dispatch_authority_enabled: false;
}

export interface FlowDeskGitHubOAuthArchitectureResultV1 {
	ok: boolean;
	errors: string[];
	architecture?: FlowDeskGitHubOAuthArchitectureV1;
}

const VALID_GITHUB_SCOPES = ["repo", "public_repo", "read:org"] as const;

function validateTokenRef(tokenRef: unknown, label: string): ValidationResult {
	if (typeof tokenRef !== "string") return invalid(`${label} must be a string`);
	// Token ref must be an opaque ref (no raw token patterns)
	for (const pattern of RAW_TOKEN_PATTERNS) {
		if (pattern.test(tokenRef)) return invalid(`${label} must not contain raw token patterns (token smuggling rejected)`);
	}
	// Must also be a valid opaque ref
	return validateOpaqueRef(tokenRef, label);
}

export function createFlowDeskGitHubOAuthArchitectureV1(input: {
	architectureId: string;
	authScopeRef: string;
	requiredGithubScopes: readonly ("repo" | "public_repo" | "read:org")[];
	tokenRef: string;
	authState: FlowDeskGitHubOAuthAuthStateV1;
	dryRunAllowedWithoutToken: boolean;
}): FlowDeskGitHubOAuthArchitectureResultV1 {
	const errors: string[] = [];
	errors.push(...validateOpaqueId(input.architectureId, "architecture_id").errors);
	errors.push(...validateOpaqueRef(input.authScopeRef, "auth_scope_ref").errors);
	// required_github_scopes must be non-empty array of valid scope values
	if (!Array.isArray(input.requiredGithubScopes) || input.requiredGithubScopes.length === 0) {
		errors.push("required_github_scopes must be a non-empty array");
	} else {
		for (const [index, scope] of input.requiredGithubScopes.entries()) {
			if (!(VALID_GITHUB_SCOPES as readonly string[]).includes(scope)) errors.push(`required_github_scopes[${index}] is invalid`);
		}
	}
	// token_ref must be an opaque ref without raw token content
	errors.push(...validateTokenRef(input.tokenRef, "token_ref").errors);
	// auth_state must be valid
	if (!GITHUB_OAUTH_AUTH_STATES.includes(input.authState)) errors.push("auth_state is invalid");
	// dry_run_allowed_without_token must be boolean
	if (typeof input.dryRunAllowedWithoutToken !== "boolean") errors.push("dry_run_allowed_without_token must be boolean");
	if (errors.length > 0) return { ok: false, errors };
	const architecture: FlowDeskGitHubOAuthArchitectureV1 = {
		schema_version: "flowdesk.github_oauth_architecture.v1",
		architecture_id: input.architectureId,
		auth_scope_ref: input.authScopeRef,
		required_github_scopes: input.requiredGithubScopes,
		token_storage: "config_file_only",
		token_ref: input.tokenRef,
		auth_state: input.authState,
		dry_run_allowed_without_token: input.dryRunAllowedWithoutToken,
		advisory_only: true,
		non_authorizing: true,
		provider_call_made: false,
		token_transmitted_in_evidence: false,
		remote_write_authority_enabled: false,
		dispatch_authority_enabled: false,
	};
	return { ok: true, errors: [], architecture };
}

export function validateFlowDeskGitHubOAuthArchitectureV1(value: unknown): ValidationResult {
	if (!isRecord(value)) return invalid("github oauth architecture must be an object");
	const record = value as Partial<FlowDeskGitHubOAuthArchitectureV1>;
	const errors: string[] = [];
	errors.push(...rejectUnknownProperties(record, [
		"schema_version",
		"architecture_id",
		"auth_scope_ref",
		"required_github_scopes",
		"token_storage",
		"token_ref",
		"auth_state",
		"dry_run_allowed_without_token",
		"advisory_only",
		"non_authorizing",
		"provider_call_made",
		"token_transmitted_in_evidence",
		"remote_write_authority_enabled",
		"dispatch_authority_enabled",
	], "github oauth architecture").errors);
	if (record.schema_version !== "flowdesk.github_oauth_architecture.v1") errors.push("github oauth architecture schema_version is invalid");
	errors.push(...validateOpaqueId(record.architecture_id, "architecture_id").errors);
	errors.push(...validateOpaqueRef(record.auth_scope_ref, "auth_scope_ref").errors);
	// required_github_scopes must be non-empty array of valid values
	if (!Array.isArray(record.required_github_scopes) || record.required_github_scopes.length === 0) {
		errors.push("required_github_scopes must be a non-empty array");
	} else {
		for (const [index, scope] of record.required_github_scopes.entries()) {
			if (!(VALID_GITHUB_SCOPES as readonly string[]).includes(scope as string)) errors.push(`required_github_scopes[${index}] is invalid`);
		}
	}
	// token_storage must be literal "config_file_only"
	if (record.token_storage !== "config_file_only") errors.push("token_storage must be config_file_only");
	// token_ref must be an opaque ref without raw token content
	errors.push(...validateTokenRef(record.token_ref, "token_ref").errors);
	// auth_state must be valid
	if (!GITHUB_OAUTH_AUTH_STATES.includes(record.auth_state as FlowDeskGitHubOAuthAuthStateV1)) errors.push("auth_state is invalid");
	// dry_run_allowed_without_token must be boolean
	if (typeof record.dry_run_allowed_without_token !== "boolean") errors.push("dry_run_allowed_without_token must be boolean");
	// Structural authority literal invariants
	if (record.advisory_only !== true) errors.push("github oauth architecture advisory_only must be true");
	if (record.non_authorizing !== true) errors.push("github oauth architecture non_authorizing must be true");
	if (record.provider_call_made !== false) errors.push("provider_call_made must be false (authority smuggling rejected)");
	// token_transmitted_in_evidence must be literal false — token never in durable evidence
	if (record.token_transmitted_in_evidence !== false) errors.push("token_transmitted_in_evidence must be false (token smuggling rejected)");
	if (record.remote_write_authority_enabled !== false) errors.push("remote_write_authority_enabled must be false (authority smuggling rejected)");
	if (record.dispatch_authority_enabled !== false) errors.push("dispatch_authority_enabled must be false (authority smuggling rejected)");
	// Raw payload check: exclude the schema-approved token-named fields since they are intentional
	// schema fields, not forbidden markers. Their values are validated explicitly above:
	//   - token_ref: via validateTokenRef (rejects raw token patterns like ghp_, github_pat_, Bearer)
	//   - token_storage: literal "config_file_only" check
	//   - token_transmitted_in_evidence: literal false check
	//   - dry_run_allowed_without_token: boolean check (also contains "token" in key name)
	const {
		token_ref: _tokenRef,
		token_storage: _tokenStorage,
		token_transmitted_in_evidence: _tokenTx,
		dry_run_allowed_without_token: _dryRunWithoutToken,
		...recordWithoutTokenFields
	} = record as Record<string, unknown>;
	errors.push(...validateNoForbiddenRawPayloads(recordWithoutTokenFields, "github_oauth_architecture").errors);
	return errors.length === 0 ? valid() : invalid(...errors);
}
