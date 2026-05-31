import {
	invalid,
	type ValidationResult,
	valid,
	validateConcreteProviderQualifiedModelId,
	validateNoForbiddenRawPayloads,
	validateOpaqueId,
	validateOpaqueRef,
} from "./validators.js";

// ── Observed (un-attested) runtime echo evidence ────────────────────────────
//
// This is the HONEST, in-scope runtime-echo evidence FlowDesk can actually
// produce today. It is deliberately NOT the managed-dispatch
// `flowdesk.managed_dispatch_beta.runtime_echo_evidence.v1` (which requires
// runtime_echo_mode="trusted"+trusted=true and is consumed by the production
// Guard boundary). Two independent multi-model design reviews concluded that
// emitting trusted from a caller-supplied observation is "trusted laundering",
// and that genuine trusted echo needs a real OpenCode runtime attestation that
// OpenCode does not expose. So this issuer:
//
//  - reads the lane's OWN durable session evidence (it does NOT accept a
//    caller-supplied "it matched" boolean as the trust anchor),
//  - verifies the runtime-reported provider/model equals the requested binding,
//  - verifies a per-attempt challenge nonce was echoed in the observed output,
//  - emits runtime_echo_mode="untrusted" with attestation_strength
//    ="observed_unattested" so nothing can be re-interpreted upstream as a
//    production-grade trusted echo,
//  - never enables any dispatch/runtime/lane/provider authority.
//
// It is suitable for diagnostics, observability, and audit — NOT for satisfying
// the production managed-dispatch trusted-echo gate.

export const FLOWDESK_OBSERVED_RUNTIME_ECHO_ATTESTATION_STRENGTH =
	"observed_unattested" as const;

export const FLOWDESK_OBSERVED_RUNTIME_ECHO_UNCERTAINTY_LABELS = [
	"observed_runtime_binding_not_cryptographically_attested",
	"observed_echo_not_valid_for_production_trusted_gate",
] as const;

export interface FlowDeskObservedRuntimeEchoEvidenceV1 {
	schema_version: "flowdesk.observed_runtime_echo_evidence.v1";
	observed_echo_ref: string;
	workflow_id: string;
	attempt_id: string;
	lane_id: string;
	provider_family: string;
	requested_provider_qualified_model_id: string;
	observed_provider_qualified_model_id: string;
	child_session_ref: string;
	observed_message_ref: string;
	challenge_nonce_ref: string;
	challenge_echo_observed: true;
	model_binding_match: true;
	runtime_echo_mode: "untrusted";
	attestation_strength: "observed_unattested";
	uncertainty_labels: string[];
	observed_at: string;
	dispatch_authority_enabled: false;
	realOpenCodeDispatch: false;
	actualLaneLaunch: false;
	providerCall: false;
	runtimeExecution: false;
}

/**
 * A minimal projection of the lane's reloaded durable evidence that the issuer
 * verifies itself. The caller must pass values it READ from durable evidence /
 * the live SDK response, not assertions; the issuer still re-checks every
 * trust-bearing relationship here rather than trusting a single boolean.
 */
export interface FlowDeskObservedRuntimeEchoInputV1 {
	workflowId: string;
	attemptId: string;
	laneId: string;
	providerFamily: string;
	requestedProviderQualifiedModelId: string;
	/** Read from the runtime/session record, NOT a caller assertion of "match". */
	observedProviderQualifiedModelId: string;
	/** Real child session ref (ses-...) observed from the launch. */
	childSessionRef: string;
	/** Real assistant message ref observed from session.messages. */
	observedMessageRef: string;
	/** Opaque ref of the per-attempt challenge nonce embedded in the approved prompt. */
	challengeNonceRef: string;
	/** The exact challenge nonce string the issuer expects to find echoed. */
	expectedChallengeNonce: string;
	/** The observed assistant output text the issuer searches for the nonce itself. */
	observedAssistantText: string;
	observedAt: string;
}

export interface FlowDeskObservedRuntimeEchoResultV1 extends ValidationResult {
	schema_version: "flowdesk.observed_runtime_echo_result.v1";
	state: "issued_observed" | "blocked";
	evidence?: FlowDeskObservedRuntimeEchoEvidenceV1;
	attestation_strength: "observed_unattested";
	uncertainty_labels: string[];
	dispatch_authority_enabled: false;
	realOpenCodeDispatch: false;
	actualLaneLaunch: false;
	providerCall: false;
	runtimeExecution: false;
}

const disabledEchoAuthority = {
	dispatch_authority_enabled: false as const,
	realOpenCodeDispatch: false as const,
	actualLaneLaunch: false as const,
	providerCall: false as const,
	runtimeExecution: false as const,
};

function isParseableTimestamp(value: unknown): value is string {
	return typeof value === "string" && Number.isFinite(Date.parse(value));
}

function blockedEcho(...errors: string[]): FlowDeskObservedRuntimeEchoResultV1 {
	return {
		schema_version: "flowdesk.observed_runtime_echo_result.v1",
		ok: false,
		errors,
		state: "blocked",
		attestation_strength: FLOWDESK_OBSERVED_RUNTIME_ECHO_ATTESTATION_STRENGTH,
		uncertainty_labels: [...FLOWDESK_OBSERVED_RUNTIME_ECHO_UNCERTAINTY_LABELS],
		...disabledEchoAuthority,
	};
}

/**
 * Issue an OBSERVED (un-attested) runtime echo. Fails closed unless the issuer
 * itself confirms, from the supplied observation, that:
 *   - the runtime-reported model equals the requested binding (byte-exact), and
 *   - the per-attempt challenge nonce actually appears in the observed output.
 * It NEVER emits a production-grade trusted echo.
 */
export function issueFlowDeskObservedRuntimeEchoV1(
	input: FlowDeskObservedRuntimeEchoInputV1,
): FlowDeskObservedRuntimeEchoResultV1 {
	const errors: string[] = [];
	errors.push(...validateOpaqueId(input.workflowId, "workflow_id").errors);
	errors.push(...validateOpaqueId(input.attemptId, "attempt_id").errors);
	errors.push(...validateOpaqueId(input.laneId, "lane_id").errors);
	errors.push(
		...validateConcreteProviderQualifiedModelId(
			input.requestedProviderQualifiedModelId,
		).errors,
	);
	errors.push(
		...validateConcreteProviderQualifiedModelId(
			input.observedProviderQualifiedModelId,
		).errors,
	);
	errors.push(...validateOpaqueRef(input.childSessionRef, "child_session_ref").errors);
	errors.push(...validateOpaqueRef(input.observedMessageRef, "observed_message_ref").errors);
	errors.push(...validateOpaqueRef(input.challengeNonceRef, "challenge_nonce_ref").errors);

	if (typeof input.providerFamily !== "string" || input.providerFamily.trim().length === 0)
		errors.push("provider_family is required");
	if (!isParseableTimestamp(input.observedAt))
		errors.push("observed_at must be a parseable timestamp");

	// Trust-bearing checks the issuer performs ITSELF (not caller booleans):
	// 1) byte-exact model binding match (no normalization).
	const modelMatch =
		typeof input.observedProviderQualifiedModelId === "string" &&
		typeof input.requestedProviderQualifiedModelId === "string" &&
		input.observedProviderQualifiedModelId ===
			input.requestedProviderQualifiedModelId;
	if (!modelMatch)
		errors.push("observed model binding does not byte-exactly match requested binding");

	// 2) the per-attempt challenge nonce must actually appear in the observed
	// assistant output. The issuer searches the text itself; it does not accept
	// a caller "echoed=true" flag. Require a non-trivial nonce to avoid
	// accidental/parrot matches.
	const nonce = input.expectedChallengeNonce;
	if (typeof nonce !== "string" || nonce.trim().length < 16)
		errors.push("expected challenge nonce must be a non-trivial string (>=16 chars)");
	const challengeEchoObserved =
		typeof nonce === "string" &&
		nonce.trim().length >= 16 &&
		typeof input.observedAssistantText === "string" &&
		input.observedAssistantText.includes(nonce);
	if (!challengeEchoObserved)
		errors.push("challenge nonce was not observed in the assistant output");

	if (errors.length > 0) return blockedEcho(...errors);

	const evidence: FlowDeskObservedRuntimeEchoEvidenceV1 = {
		schema_version: "flowdesk.observed_runtime_echo_evidence.v1",
		observed_echo_ref: `observed-echo-${input.attemptId}-${input.challengeNonceRef}`.slice(0, 120),
		workflow_id: input.workflowId,
		attempt_id: input.attemptId,
		lane_id: input.laneId,
		provider_family: input.providerFamily,
		requested_provider_qualified_model_id: input.requestedProviderQualifiedModelId,
		observed_provider_qualified_model_id: input.observedProviderQualifiedModelId,
		child_session_ref: input.childSessionRef,
		observed_message_ref: input.observedMessageRef,
		challenge_nonce_ref: input.challengeNonceRef,
		challenge_echo_observed: true,
		model_binding_match: true,
		runtime_echo_mode: "untrusted",
		attestation_strength: FLOWDESK_OBSERVED_RUNTIME_ECHO_ATTESTATION_STRENGTH,
		uncertainty_labels: [...FLOWDESK_OBSERVED_RUNTIME_ECHO_UNCERTAINTY_LABELS],
		observed_at: input.observedAt,
		...disabledEchoAuthority,
	};

	// Defense in depth: the emitted record must not carry any forbidden raw
	// payload markers (we never persist the raw assistant text or nonce body).
	const redaction = validateNoForbiddenRawPayloads(
		evidence as unknown as Record<string, unknown>,
		"observed_runtime_echo_evidence",
	);
	if (!redaction.ok)
		return blockedEcho(...redaction.errors.map((e) => `observed echo redaction: ${e}`));

	return {
		schema_version: "flowdesk.observed_runtime_echo_result.v1",
		ok: true,
		errors: [],
		state: "issued_observed",
		evidence,
		attestation_strength: FLOWDESK_OBSERVED_RUNTIME_ECHO_ATTESTATION_STRENGTH,
		uncertainty_labels: [...FLOWDESK_OBSERVED_RUNTIME_ECHO_UNCERTAINTY_LABELS],
		...disabledEchoAuthority,
	};
}

export function validateFlowDeskObservedRuntimeEchoEvidenceV1(
	value: unknown,
): ValidationResult {
	if (typeof value !== "object" || value === null || Array.isArray(value))
		return invalid("observed runtime echo evidence must be an object");
	const record = value as Record<string, unknown>;
	const errors: string[] = [];
	const allowed = new Set([
		"schema_version",
		"observed_echo_ref",
		"workflow_id",
		"attempt_id",
		"lane_id",
		"provider_family",
		"requested_provider_qualified_model_id",
		"observed_provider_qualified_model_id",
		"child_session_ref",
		"observed_message_ref",
		"challenge_nonce_ref",
		"challenge_echo_observed",
		"model_binding_match",
		"runtime_echo_mode",
		"attestation_strength",
		"uncertainty_labels",
		"observed_at",
		"dispatch_authority_enabled",
		"realOpenCodeDispatch",
		"actualLaneLaunch",
		"providerCall",
		"runtimeExecution",
	]);
	for (const key of Object.keys(record))
		if (!allowed.has(key)) errors.push(`unknown properties: ${key}`);
	if (record.schema_version !== "flowdesk.observed_runtime_echo_evidence.v1")
		errors.push("observed runtime echo evidence schema_version is invalid");
	if (record.runtime_echo_mode !== "untrusted")
		errors.push("observed runtime echo must not claim a trusted runtime echo mode");
	if (record.attestation_strength !== "observed_unattested")
		errors.push("observed runtime echo attestation_strength must be observed_unattested");
	if (record.challenge_echo_observed !== true)
		errors.push("observed runtime echo requires challenge_echo_observed=true");
	if (record.model_binding_match !== true)
		errors.push("observed runtime echo requires model_binding_match=true");
	for (const [field, label] of [
		[record.dispatch_authority_enabled, "dispatch_authority_enabled"],
		[record.realOpenCodeDispatch, "realOpenCodeDispatch"],
		[record.actualLaneLaunch, "actualLaneLaunch"],
		[record.providerCall, "providerCall"],
		[record.runtimeExecution, "runtimeExecution"],
	] as const) {
		if (field !== false) errors.push(`observed runtime echo cannot claim ${label}=true`);
	}
	errors.push(
		...validateNoForbiddenRawPayloads(record, "observed_runtime_echo_evidence").errors,
	);
	return errors.length === 0 ? valid() : invalid(...errors);
}
