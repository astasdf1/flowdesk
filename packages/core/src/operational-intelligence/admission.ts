/**
 * Admission decision contracts for the R3 operational intelligence gate.
 * P-OI-R3: Surplus usage gate → admission decision → fanout reservation → advisory variant result.
 *
 * All contracts are advisory-only with no dispatch, runtime, or authority grants.
 * release_gate: "operational_intelligence_later_gate"
 */
import {
	type ValidationResult,
	valid,
	invalid,
	validateNoForbiddenRawPayloads,
	validateOpaqueId,
	validateOpaqueRef,
	validateHashRef,
	validateTimestamp,
	validateBoundedLabel,
	isRecord,
	rejectUnknownProperties,
} from "./shared.js";
import type { FlowDeskScoreReuseDecisionLabelV1, FlowDeskFanoutCadenceDecisionLabelV1 } from "./gates.js";
import type { FlowDeskSurplusUsageDecisionLabelV1 } from "./gates.js";

// ─── CONTRACT 2: FlowDeskR3AdmissionDecisionV1 ───────────────────────────────

/**
 * Execution mode for the R3 operational intelligence fanout.
 */
export type FlowDeskR3ExecutionModeV1 =
	| "single_model"
	| "multi_variant_single_model"
	| "multi_model_fanout"
	| "skipped";

/**
 * Advisory-only admission decision combining surplus, reuse, and cadence gate results
 * to determine the execution mode for the R3 operational intelligence pipeline.
 */
export interface FlowDeskR3AdmissionDecisionV1 {
	schema_version: "flowdesk.r3_admission_decision.v1";
	decision_id: string;
	workflow_id: string;
	workflow_signature_ref: string;
	attempt_id: string;
	surplus_gate_ref: string;
	surplus_gate_verdict: FlowDeskSurplusUsageDecisionLabelV1;
	reuse_gate_ref: string;
	reuse_gate_decision: FlowDeskScoreReuseDecisionLabelV1;
	cadence_gate_ref: string;
	cadence_gate_decision: FlowDeskFanoutCadenceDecisionLabelV1;
	execution_mode: FlowDeskR3ExecutionModeV1;
	skip_reason?: string;
	reservation_id?: string;
	combined_snapshot_hash: string;
	decided_at: string;
	config_ref: string;
	release_gate: "operational_intelligence_later_gate";
	advisory_only: true;
	non_authorizing: true;
	dispatch_authority_enabled: false;
	approval_authority_enabled: false;
	provider_authority_enabled: false;
	runtime_authority_enabled: false;
	external_write_authority_enabled: false;
	remote_write_authority_enabled: false;
	fallback_authority_enabled: false;
	lane_launch_authority_enabled: false;
	write_authority_enabled: false;
	hard_chat_authority_enabled: false;
}

export interface FlowDeskR3AdmissionDecisionResultV1 {
	ok: boolean;
	errors: string[];
	decision?: FlowDeskR3AdmissionDecisionV1;
}

/**
 * Mode selection total-order (first match wins):
 * 1. surplus_gate_verdict !== "allow" → skipped
 * 2. reuse_gate_decision === "reuse" → skipped
 * 3. cadence_gate_decision === "blocked" → skipped
 * 4. cadence_gate_decision === "hold" → skipped
 * 5. cadence_gate_decision === "reduce" → multi_variant_single_model
 * 6. cadence_gate_decision === "allow" && reuse_gate_decision === "recompute" → multi_model_fanout
 * 7. else → single_model
 */
function deriveExecutionMode(
	surplusGateVerdict: FlowDeskSurplusUsageDecisionLabelV1,
	reuseGateDecision: FlowDeskScoreReuseDecisionLabelV1,
	cadenceGateDecision: FlowDeskFanoutCadenceDecisionLabelV1,
): FlowDeskR3ExecutionModeV1 {
	if (surplusGateVerdict !== "allow") return "skipped";
	if (reuseGateDecision === "reuse") return "skipped";
	if (cadenceGateDecision === "blocked") return "skipped";
	if (cadenceGateDecision === "hold") return "skipped";
	if (cadenceGateDecision === "reduce") return "multi_variant_single_model";
	if (cadenceGateDecision === "allow" && reuseGateDecision === "recompute") return "multi_model_fanout";
	return "single_model";
}

export function createFlowDeskR3AdmissionDecisionV1(input: {
	decisionId: string;
	workflowId: string;
	workflowSignatureRef: string;
	attemptId: string;
	surplusGateRef: string;
	surplusGateVerdict: FlowDeskSurplusUsageDecisionLabelV1;
	reuseGateRef: string;
	reuseGateDecision: FlowDeskScoreReuseDecisionLabelV1;
	cadenceGateRef: string;
	cadenceGateDecision: FlowDeskFanoutCadenceDecisionLabelV1;
	combinedSnapshotHash: string;
	decidedAt: string;
	configRef: string;
	skipReason?: string;
	reservationId?: string;
}): FlowDeskR3AdmissionDecisionResultV1 {
	const errors: string[] = [];
	errors.push(...validateOpaqueId(input.decisionId, "decision_id").errors);
	errors.push(...validateOpaqueId(input.workflowId, "workflow_id").errors);
	errors.push(...validateOpaqueRef(input.workflowSignatureRef, "workflow_signature_ref").errors);
	errors.push(...validateOpaqueId(input.attemptId, "attempt_id").errors);
	errors.push(...validateOpaqueRef(input.surplusGateRef, "surplus_gate_ref").errors);
	errors.push(...validateOpaqueRef(input.reuseGateRef, "reuse_gate_ref").errors);
	errors.push(...validateOpaqueRef(input.cadenceGateRef, "cadence_gate_ref").errors);
	errors.push(...validateHashRef(input.combinedSnapshotHash, "combined_snapshot_hash").errors);
	errors.push(...validateTimestamp(input.decidedAt, "decided_at").errors);
	errors.push(...validateOpaqueRef(input.configRef, "config_ref").errors);

	const validSurplusVerdicts: readonly string[] = ["allow", "blocked_stale_usage", "blocked_alert_level", "blocked_insufficient_surplus"];
	if (!validSurplusVerdicts.includes(input.surplusGateVerdict)) errors.push("surplus_gate_verdict must be a valid FlowDeskSurplusUsageDecisionLabelV1");
	const validReuseDecisions: readonly string[] = ["reuse", "recompute", "blocked"];
	if (!validReuseDecisions.includes(input.reuseGateDecision)) errors.push("reuse_gate_decision must be a valid FlowDeskScoreReuseDecisionLabelV1");
	const validCadenceDecisions: readonly string[] = ["allow", "reduce", "hold", "blocked"];
	if (!validCadenceDecisions.includes(input.cadenceGateDecision)) errors.push("cadence_gate_decision must be a valid FlowDeskFanoutCadenceDecisionLabelV1");

	if (errors.length > 0) return { ok: false, errors };

	const executionMode = deriveExecutionMode(input.surplusGateVerdict, input.reuseGateDecision, input.cadenceGateDecision);

	// skip_reason: required iff skipped
	if (executionMode === "skipped" && !input.skipReason) errors.push("skip_reason is required when execution_mode is 'skipped'");
	if (executionMode !== "skipped" && input.skipReason !== undefined) errors.push("skip_reason must be absent when execution_mode is not 'skipped'");
	if (input.skipReason !== undefined) errors.push(...validateOpaqueRef(input.skipReason, "skip_reason").errors);

	// reservation_id: required iff multi_variant or multi_model_fanout
	const needsReservation = executionMode === "multi_variant_single_model" || executionMode === "multi_model_fanout";
	if (needsReservation && !input.reservationId) errors.push("reservation_id is required when execution_mode is 'multi_variant_single_model' or 'multi_model_fanout'");
	if (input.reservationId !== undefined) errors.push(...validateOpaqueRef(input.reservationId, "reservation_id").errors);

	if (errors.length > 0) return { ok: false, errors };

	const decision: FlowDeskR3AdmissionDecisionV1 = {
		schema_version: "flowdesk.r3_admission_decision.v1",
		decision_id: input.decisionId,
		workflow_id: input.workflowId,
		workflow_signature_ref: input.workflowSignatureRef,
		attempt_id: input.attemptId,
		surplus_gate_ref: input.surplusGateRef,
		surplus_gate_verdict: input.surplusGateVerdict,
		reuse_gate_ref: input.reuseGateRef,
		reuse_gate_decision: input.reuseGateDecision,
		cadence_gate_ref: input.cadenceGateRef,
		cadence_gate_decision: input.cadenceGateDecision,
		execution_mode: executionMode,
		...(input.skipReason !== undefined ? { skip_reason: input.skipReason } : {}),
		...(input.reservationId !== undefined ? { reservation_id: input.reservationId } : {}),
		combined_snapshot_hash: input.combinedSnapshotHash,
		decided_at: input.decidedAt,
		config_ref: input.configRef,
		release_gate: "operational_intelligence_later_gate",
		advisory_only: true,
		non_authorizing: true,
		dispatch_authority_enabled: false,
		approval_authority_enabled: false,
		provider_authority_enabled: false,
		runtime_authority_enabled: false,
		external_write_authority_enabled: false,
		remote_write_authority_enabled: false,
		fallback_authority_enabled: false,
		lane_launch_authority_enabled: false,
		write_authority_enabled: false,
		hard_chat_authority_enabled: false,
	};
	return { ok: true, errors: [], decision };
}

const r3AdmissionDecisionAllowedProperties = [
	"schema_version",
	"decision_id",
	"workflow_id",
	"workflow_signature_ref",
	"attempt_id",
	"surplus_gate_ref",
	"surplus_gate_verdict",
	"reuse_gate_ref",
	"reuse_gate_decision",
	"cadence_gate_ref",
	"cadence_gate_decision",
	"execution_mode",
	"skip_reason",
	"reservation_id",
	"combined_snapshot_hash",
	"decided_at",
	"config_ref",
	"release_gate",
	"advisory_only",
	"non_authorizing",
	"dispatch_authority_enabled",
	"approval_authority_enabled",
	"provider_authority_enabled",
	"runtime_authority_enabled",
	"external_write_authority_enabled",
	"remote_write_authority_enabled",
	"fallback_authority_enabled",
	"lane_launch_authority_enabled",
	"write_authority_enabled",
	"hard_chat_authority_enabled",
] as const;

const validExecutionModes: readonly string[] = ["single_model", "multi_variant_single_model", "multi_model_fanout", "skipped"];
const validSurplusVerdicts: readonly string[] = ["allow", "blocked_stale_usage", "blocked_alert_level", "blocked_insufficient_surplus"];
const validReuseDecisions: readonly string[] = ["reuse", "recompute", "blocked"];
const validCadenceDecisions: readonly string[] = ["allow", "reduce", "hold", "blocked"];

export function validateFlowDeskR3AdmissionDecisionV1(value: unknown): ValidationResult {
	if (!isRecord(value)) return invalid("r3 admission decision must be an object");
	const record = value as Record<string, unknown>;
	const errors: string[] = [];

	errors.push(...rejectUnknownProperties(record, r3AdmissionDecisionAllowedProperties, "r3 admission decision").errors);

	if (record.schema_version !== "flowdesk.r3_admission_decision.v1") errors.push("r3 admission decision schema_version is invalid");
	if (record.release_gate !== "operational_intelligence_later_gate") errors.push("r3 admission decision release_gate is invalid");

	errors.push(...validateOpaqueId(record.decision_id, "decision_id").errors);
	errors.push(...validateOpaqueId(record.workflow_id, "workflow_id").errors);
	errors.push(...validateOpaqueRef(record.workflow_signature_ref, "workflow_signature_ref").errors);
	errors.push(...validateOpaqueId(record.attempt_id, "attempt_id").errors);
	errors.push(...validateOpaqueRef(record.surplus_gate_ref, "surplus_gate_ref").errors);
	errors.push(...validateOpaqueRef(record.reuse_gate_ref, "reuse_gate_ref").errors);
	errors.push(...validateOpaqueRef(record.cadence_gate_ref, "cadence_gate_ref").errors);
	errors.push(...validateHashRef(record.combined_snapshot_hash, "combined_snapshot_hash").errors);
	errors.push(...validateTimestamp(record.decided_at, "decided_at").errors);
	errors.push(...validateOpaqueRef(record.config_ref, "config_ref").errors);

	if (typeof record.surplus_gate_verdict !== "string" || !validSurplusVerdicts.includes(record.surplus_gate_verdict)) errors.push("surplus_gate_verdict must be a valid FlowDeskSurplusUsageDecisionLabelV1");
	if (typeof record.reuse_gate_decision !== "string" || !validReuseDecisions.includes(record.reuse_gate_decision)) errors.push("reuse_gate_decision must be a valid FlowDeskScoreReuseDecisionLabelV1");
	if (typeof record.cadence_gate_decision !== "string" || !validCadenceDecisions.includes(record.cadence_gate_decision)) errors.push("cadence_gate_decision must be a valid FlowDeskFanoutCadenceDecisionLabelV1");
	if (typeof record.execution_mode !== "string" || !validExecutionModes.includes(record.execution_mode)) errors.push("execution_mode must be a valid FlowDeskR3ExecutionModeV1");

	// skip_reason cross-field
	if (record.execution_mode === "skipped" && record.skip_reason === undefined) errors.push("skip_reason is required when execution_mode is 'skipped'");
	if (record.execution_mode !== "skipped" && record.skip_reason !== undefined) errors.push("skip_reason must be absent when execution_mode is not 'skipped'");
	if (record.skip_reason !== undefined) errors.push(...validateOpaqueRef(record.skip_reason, "skip_reason").errors);

	// reservation_id cross-field
	const needsReservation = record.execution_mode === "multi_variant_single_model" || record.execution_mode === "multi_model_fanout";
	if (needsReservation && record.reservation_id === undefined) errors.push("reservation_id is required when execution_mode is 'multi_variant_single_model' or 'multi_model_fanout'");
	if (record.reservation_id !== undefined) errors.push(...validateOpaqueRef(record.reservation_id, "reservation_id").errors);

	// multi_model_fanout consistency
	if (record.execution_mode === "multi_model_fanout") {
		if (record.surplus_gate_verdict !== "allow") errors.push("execution_mode 'multi_model_fanout' requires surplus_gate_verdict='allow'");
		if (record.cadence_gate_decision !== "allow") errors.push("execution_mode 'multi_model_fanout' requires cadence_gate_decision='allow'");
		if (record.reuse_gate_decision !== "recompute") errors.push("execution_mode 'multi_model_fanout' requires reuse_gate_decision='recompute'");
	}

	// Authority flags
	if (record.advisory_only !== true
		|| record.non_authorizing !== true
		|| record.dispatch_authority_enabled !== false
		|| record.approval_authority_enabled !== false
		|| record.provider_authority_enabled !== false
		|| record.runtime_authority_enabled !== false
		|| record.external_write_authority_enabled !== false
		|| record.remote_write_authority_enabled !== false
		|| record.fallback_authority_enabled !== false
		|| record.lane_launch_authority_enabled !== false
		|| record.write_authority_enabled !== false
		|| record.hard_chat_authority_enabled !== false) {
		errors.push("r3 admission decision must remain advisory-only non-authorizing with no dispatch, approval, provider, runtime, external-write, remote-write, fallback, lane-launch, write, or hard-chat authority");
	}

	errors.push(...validateNoForbiddenRawPayloads(record, "r3_admission_decision").errors);
	return errors.length === 0 ? valid() : invalid(...errors);
}

// ─── CONTRACT 3: FlowDeskR3FanoutReservationV1 ───────────────────────────────

export type FlowDeskR3ReservationStatusV1 = "reserved" | "consumed" | "released" | "expired";

const RESERVATION_ID_PATTERN = /^res-[a-f0-9]{16,}$/;

export interface FlowDeskR3FanoutReservationV1 {
	schema_version: "flowdesk.r3_fanout_reservation.v1";
	reservation_id: string;
	attempt_id: string;
	workflow_id: string;
	admission_decision_ref: string;
	provider_family: "claude" | "openai" | "gemini";
	bucket_label: string;
	estimated_tokens_reserved: number;
	daily_hard_cap_tokens: number;
	tokens_already_reserved_today: number;
	daily_cap_check: "passed" | "blocked";
	daily_cap_blocked_labels: string[];
	reserved_at: string;
	expires_at: string;
	cadence_window_seconds: number;
	status: FlowDeskR3ReservationStatusV1;
	consumed_at?: string;
	released_at?: string;
	expired_at?: string;
	fsync_required: true;
	release_gate: "operational_intelligence_later_gate";
	advisory_only: true;
	non_authorizing: true;
	dispatch_authority_enabled: false;
	approval_authority_enabled: false;
	provider_authority_enabled: false;
	runtime_authority_enabled: false;
	external_write_authority_enabled: false;
	remote_write_authority_enabled: false;
	fallback_authority_enabled: false;
	lane_launch_authority_enabled: false;
	write_authority_enabled: false;
	hard_chat_authority_enabled: false;
}

export interface FlowDeskR3FanoutReservationResultV1 {
	ok: boolean;
	errors: string[];
	reservation?: FlowDeskR3FanoutReservationV1;
}

export function createFlowDeskR3FanoutReservationV1(input: {
	reservationId: string;
	attemptId: string;
	workflowId: string;
	admissionDecisionRef: string;
	providerFamily: string;
	bucketLabel: string;
	estimatedTokensReserved: number;
	dailyHardCapTokens: number;
	tokensAlreadyReservedToday: number;
	reservedAt: string;
	expiresAt: string;
	cadenceWindowSeconds: number;
	status: FlowDeskR3ReservationStatusV1;
	consumedAt?: string;
	releasedAt?: string;
	expiredAt?: string;
}): FlowDeskR3FanoutReservationResultV1 {
	const errors: string[] = [];

	if (!RESERVATION_ID_PATTERN.test(input.reservationId)) errors.push("reservation_id must match /^res-[a-f0-9]{16,}$/");
	errors.push(...validateOpaqueId(input.attemptId, "attempt_id").errors);
	errors.push(...validateOpaqueId(input.workflowId, "workflow_id").errors);
	errors.push(...validateOpaqueRef(input.admissionDecisionRef, "admission_decision_ref").errors);

	if (!["claude", "openai", "gemini"].includes(input.providerFamily)) errors.push("provider_family must be 'claude', 'openai', or 'gemini' (not 'unknown')");
	errors.push(...validateOpaqueRef(input.bucketLabel, "bucket_label").errors);

	if (!Number.isInteger(input.estimatedTokensReserved) || input.estimatedTokensReserved <= 0) errors.push("estimated_tokens_reserved must be a positive integer");
	if (!Number.isInteger(input.dailyHardCapTokens) || input.dailyHardCapTokens < 1000 || input.dailyHardCapTokens > 10_000_000) errors.push("daily_hard_cap_tokens must be a positive integer in range [1000, 10_000_000]");
	if (!Number.isInteger(input.tokensAlreadyReservedToday) || input.tokensAlreadyReservedToday < 0) errors.push("tokens_already_reserved_today must be a non-negative integer");

	errors.push(...validateTimestamp(input.reservedAt, "reserved_at").errors);
	errors.push(...validateTimestamp(input.expiresAt, "expires_at").errors);

	if (typeof input.cadenceWindowSeconds !== "number" || !Number.isFinite(input.cadenceWindowSeconds) || input.cadenceWindowSeconds <= 0) errors.push("cadence_window_seconds must be a finite positive number");

	const validStatuses: readonly string[] = ["reserved", "consumed", "released", "expired"];
	if (!validStatuses.includes(input.status)) errors.push("status must be one of: reserved, consumed, released, expired");

	// Daily cap check
	const dailyCapped = Number.isInteger(input.tokensAlreadyReservedToday) && Number.isInteger(input.estimatedTokensReserved) && Number.isInteger(input.dailyHardCapTokens)
		&& (input.tokensAlreadyReservedToday + input.estimatedTokensReserved > input.dailyHardCapTokens);
	const dailyCapCheck: "passed" | "blocked" = dailyCapped ? "blocked" : "passed";
	const dailyCapBlockedLabels = dailyCapped ? ["daily-hard-cap-exceeded"] : [];

	// Status-specific optional fields
	if (input.status === "consumed") {
		if (!input.consumedAt) errors.push("consumed_at is required when status is 'consumed'");
		else errors.push(...validateTimestamp(input.consumedAt, "consumed_at").errors);
	}
	if (input.status === "released") {
		if (!input.releasedAt) errors.push("released_at is required when status is 'released'");
		else errors.push(...validateTimestamp(input.releasedAt, "released_at").errors);
	}
	if (input.status === "expired") {
		if (!input.expiredAt) errors.push("expired_at is required when status is 'expired'");
		else errors.push(...validateTimestamp(input.expiredAt, "expired_at").errors);
	}

	// Verify expires_at >= reserved_at + cadence_window_seconds
	if (errors.filter(e => e.includes("reserved_at") || e.includes("expires_at") || e.includes("cadence_window")).length === 0) {
		const reservedAtMs = Date.parse(input.reservedAt);
		const expiresAtMs = Date.parse(input.expiresAt);
		const minExpiresAt = reservedAtMs + input.cadenceWindowSeconds * 1000;
		if (expiresAtMs < minExpiresAt) errors.push("expires_at must be >= reserved_at + cadence_window_seconds");
	}

	if (errors.length > 0) return { ok: false, errors };

	const reservation: FlowDeskR3FanoutReservationV1 = {
		schema_version: "flowdesk.r3_fanout_reservation.v1",
		reservation_id: input.reservationId,
		attempt_id: input.attemptId,
		workflow_id: input.workflowId,
		admission_decision_ref: input.admissionDecisionRef,
		provider_family: input.providerFamily as "claude" | "openai" | "gemini",
		bucket_label: input.bucketLabel,
		estimated_tokens_reserved: input.estimatedTokensReserved,
		daily_hard_cap_tokens: input.dailyHardCapTokens,
		tokens_already_reserved_today: input.tokensAlreadyReservedToday,
		daily_cap_check: dailyCapCheck,
		daily_cap_blocked_labels: dailyCapBlockedLabels,
		reserved_at: input.reservedAt,
		expires_at: input.expiresAt,
		cadence_window_seconds: input.cadenceWindowSeconds,
		status: input.status,
		...(input.consumedAt !== undefined ? { consumed_at: input.consumedAt } : {}),
		...(input.releasedAt !== undefined ? { released_at: input.releasedAt } : {}),
		...(input.expiredAt !== undefined ? { expired_at: input.expiredAt } : {}),
		fsync_required: true,
		release_gate: "operational_intelligence_later_gate",
		advisory_only: true,
		non_authorizing: true,
		dispatch_authority_enabled: false,
		approval_authority_enabled: false,
		provider_authority_enabled: false,
		runtime_authority_enabled: false,
		external_write_authority_enabled: false,
		remote_write_authority_enabled: false,
		fallback_authority_enabled: false,
		lane_launch_authority_enabled: false,
		write_authority_enabled: false,
		hard_chat_authority_enabled: false,
	};
	return { ok: true, errors: [], reservation };
}

const r3FanoutReservationAllowedProperties = [
	"schema_version",
	"reservation_id",
	"attempt_id",
	"workflow_id",
	"admission_decision_ref",
	"provider_family",
	"bucket_label",
	"estimated_tokens_reserved",
	"daily_hard_cap_tokens",
	"tokens_already_reserved_today",
	"daily_cap_check",
	"daily_cap_blocked_labels",
	"reserved_at",
	"expires_at",
	"cadence_window_seconds",
	"status",
	"consumed_at",
	"released_at",
	"expired_at",
	"fsync_required",
	"release_gate",
	"advisory_only",
	"non_authorizing",
	"dispatch_authority_enabled",
	"approval_authority_enabled",
	"provider_authority_enabled",
	"runtime_authority_enabled",
	"external_write_authority_enabled",
	"remote_write_authority_enabled",
	"fallback_authority_enabled",
	"lane_launch_authority_enabled",
	"write_authority_enabled",
	"hard_chat_authority_enabled",
] as const;

const validReservationStatuses: readonly string[] = ["reserved", "consumed", "released", "expired"];
const validReservationProviderFamilies: readonly string[] = ["claude", "openai", "gemini"];

export function validateFlowDeskR3FanoutReservationV1(value: unknown): ValidationResult {
	if (!isRecord(value)) return invalid("r3 fanout reservation must be an object");
	const record = value as Record<string, unknown>;
	const errors: string[] = [];

	errors.push(...rejectUnknownProperties(record, r3FanoutReservationAllowedProperties, "r3 fanout reservation").errors);

	if (record.schema_version !== "flowdesk.r3_fanout_reservation.v1") errors.push("r3 fanout reservation schema_version is invalid");
	if (record.release_gate !== "operational_intelligence_later_gate") errors.push("r3 fanout reservation release_gate is invalid");

	if (typeof record.reservation_id !== "string" || !RESERVATION_ID_PATTERN.test(record.reservation_id)) errors.push("reservation_id must match /^res-[a-f0-9]{16,}$/");
	errors.push(...validateOpaqueId(record.attempt_id, "attempt_id").errors);
	errors.push(...validateOpaqueId(record.workflow_id, "workflow_id").errors);
	errors.push(...validateOpaqueRef(record.admission_decision_ref, "admission_decision_ref").errors);

	if (typeof record.provider_family !== "string" || !validReservationProviderFamilies.includes(record.provider_family)) errors.push("provider_family must be 'claude', 'openai', or 'gemini' (not 'unknown')");
	errors.push(...validateOpaqueRef(record.bucket_label, "bucket_label").errors);

	if (!Number.isInteger(record.estimated_tokens_reserved) || (record.estimated_tokens_reserved as number) <= 0) errors.push("estimated_tokens_reserved must be a positive integer");
	if (!Number.isInteger(record.daily_hard_cap_tokens) || (record.daily_hard_cap_tokens as number) < 1000 || (record.daily_hard_cap_tokens as number) > 10_000_000) errors.push("daily_hard_cap_tokens must be a positive integer in range [1000, 10_000_000]");
	if (!Number.isInteger(record.tokens_already_reserved_today) || (record.tokens_already_reserved_today as number) < 0) errors.push("tokens_already_reserved_today must be a non-negative integer");

	// daily cap check consistency
	if (typeof record.daily_cap_check === "string" && typeof record.estimated_tokens_reserved === "number" && typeof record.tokens_already_reserved_today === "number" && typeof record.daily_hard_cap_tokens === "number") {
		const wouldExceed = record.tokens_already_reserved_today + record.estimated_tokens_reserved > record.daily_hard_cap_tokens;
		if (wouldExceed && record.daily_cap_check !== "blocked") errors.push("daily_cap_check must be 'blocked' when tokens_already_reserved_today + estimated_tokens_reserved > daily_hard_cap_tokens");
	}

	errors.push(...validateTimestamp(record.reserved_at, "reserved_at").errors);
	errors.push(...validateTimestamp(record.expires_at, "expires_at").errors);

	if (typeof record.cadence_window_seconds !== "number" || !Number.isFinite(record.cadence_window_seconds) || record.cadence_window_seconds <= 0) errors.push("cadence_window_seconds must be a finite positive number");

	// expires_at >= reserved_at + cadence_window_seconds
	if (typeof record.reserved_at === "string" && typeof record.expires_at === "string" && typeof record.cadence_window_seconds === "number") {
		const reservedAtMs = Date.parse(record.reserved_at as string);
		const expiresAtMs = Date.parse(record.expires_at as string);
		if (Number.isFinite(reservedAtMs) && Number.isFinite(expiresAtMs) && Number.isFinite(record.cadence_window_seconds)) {
			const minExpiresAt = reservedAtMs + (record.cadence_window_seconds as number) * 1000;
			if (expiresAtMs < minExpiresAt) errors.push("expires_at must be >= reserved_at + cadence_window_seconds");
		}
	}

	if (typeof record.status !== "string" || !validReservationStatuses.includes(record.status)) errors.push("status must be one of: reserved, consumed, released, expired");

	if (record.status === "consumed" && record.consumed_at === undefined) errors.push("consumed_at is required when status is 'consumed'");
	if (record.consumed_at !== undefined) errors.push(...validateTimestamp(record.consumed_at, "consumed_at").errors);
	if (record.status === "released" && record.released_at === undefined) errors.push("released_at is required when status is 'released'");
	if (record.released_at !== undefined) errors.push(...validateTimestamp(record.released_at, "released_at").errors);
	if (record.status === "expired" && record.expired_at === undefined) errors.push("expired_at is required when status is 'expired'");
	if (record.expired_at !== undefined) errors.push(...validateTimestamp(record.expired_at, "expired_at").errors);

	if (record.fsync_required !== true) errors.push("fsync_required must be true");

	if (!Array.isArray(record.daily_cap_blocked_labels)) errors.push("daily_cap_blocked_labels must be an array");
	else for (const [index, lbl] of (record.daily_cap_blocked_labels as unknown[]).entries()) errors.push(...validateOpaqueRef(lbl, `daily_cap_blocked_labels[${index}]`).errors);

	// Authority flags
	if (record.advisory_only !== true
		|| record.non_authorizing !== true
		|| record.dispatch_authority_enabled !== false
		|| record.approval_authority_enabled !== false
		|| record.provider_authority_enabled !== false
		|| record.runtime_authority_enabled !== false
		|| record.external_write_authority_enabled !== false
		|| record.remote_write_authority_enabled !== false
		|| record.fallback_authority_enabled !== false
		|| record.lane_launch_authority_enabled !== false
		|| record.write_authority_enabled !== false
		|| record.hard_chat_authority_enabled !== false) {
		errors.push("r3 fanout reservation must remain advisory-only non-authorizing with no dispatch, approval, provider, runtime, external-write, remote-write, fallback, lane-launch, write, or hard-chat authority");
	}

	// Exclude numeric token-count fields from raw payload key scan (they are schema-safe numeric counters)
	const { estimated_tokens_reserved: _etr, daily_hard_cap_tokens: _dhct, tokens_already_reserved_today: _tart, ...recordForPayloadCheck } = record;
	errors.push(...validateNoForbiddenRawPayloads(recordForPayloadCheck, "r3_fanout_reservation").errors);
	return errors.length === 0 ? valid() : invalid(...errors);
}

// ─── CONTRACT 4: FlowDeskAdvisoryVariantResultV1 ─────────────────────────────

export type FlowDeskAdvisoryVariantOutcomeClassV1 =
	| "completed_ok"
	| "completed_degraded"
	| "timeout"
	| "provider_error"
	| "policy_blocked";

/** Deny-list: these fields must never be present in advisory variant results */
const advisoryVariantDenyListFields = [
	"task_result_id",
	"result_payload",
	"verdict",
	"accepted_for_synthesis",
	"primary_task_result_ref",
	"synthesis_input_ref",
] as const;

export interface FlowDeskAdvisoryVariantResultV1 {
	schema_version: "flowdesk.advisory_variant_result.v1";
	variant_result_id: string;
	admission_decision_ref: string;
	reservation_ref: string;
	workflow_id: string;
	attempt_id: string;
	workflow_signature_ref: string;
	/** HARD ANTI-BLUR MARKER — must always be "advisory_variant_test" */
	execution_purpose: "advisory_variant_test";
	variant_id: string;
	variant_index: number;
	variant_total: number;
	model_ref: string;
	provider_family: "claude" | "openai" | "gemini";
	proposal_ref: string;
	normalized_score_ref?: string;
	outcome_class: FlowDeskAdvisoryVariantOutcomeClassV1;
	outcome_reason_refs: string[];
	bounded_summary_label: string;
	duration_ms: number;
	provider_token_usage_estimate: number;
	started_at: string;
	completed_at: string;
	/** Second anti-blur layer */
	not_consumable_as_primary_task_result: true;
	advisory_only: true;
	non_authorizing: true;
	release_gate: "operational_intelligence_later_gate";
	dispatch_authority_enabled: false;
	approval_authority_enabled: false;
	provider_authority_enabled: false;
	runtime_authority_enabled: false;
	external_write_authority_enabled: false;
	remote_write_authority_enabled: false;
	fallback_authority_enabled: false;
	lane_launch_authority_enabled: false;
	write_authority_enabled: false;
	hard_chat_authority_enabled: false;
}

export interface FlowDeskAdvisoryVariantResultResultV1 {
	ok: boolean;
	errors: string[];
	result?: FlowDeskAdvisoryVariantResultV1;
}

export function createFlowDeskAdvisoryVariantResultV1(input: {
	variantResultId: string;
	admissionDecisionRef: string;
	reservationRef: string;
	workflowId: string;
	attemptId: string;
	workflowSignatureRef: string;
	variantId: string;
	variantIndex: number;
	variantTotal: number;
	modelRef: string;
	providerFamily: string;
	proposalRef: string;
	normalizedScoreRef?: string;
	outcomeClass: FlowDeskAdvisoryVariantOutcomeClassV1;
	outcomeReasonRefs: string[];
	boundedSummaryLabel: string;
	durationMs: number;
	providerTokenUsageEstimate: number;
	startedAt: string;
	completedAt: string;
}): FlowDeskAdvisoryVariantResultResultV1 {
	const errors: string[] = [];

	errors.push(...validateOpaqueId(input.variantResultId, "variant_result_id").errors);
	errors.push(...validateOpaqueRef(input.admissionDecisionRef, "admission_decision_ref").errors);
	errors.push(...validateOpaqueRef(input.reservationRef, "reservation_ref").errors);
	errors.push(...validateOpaqueId(input.workflowId, "workflow_id").errors);
	errors.push(...validateOpaqueId(input.attemptId, "attempt_id").errors);
	errors.push(...validateOpaqueRef(input.workflowSignatureRef, "workflow_signature_ref").errors);
	errors.push(...validateOpaqueId(input.variantId, "variant_id").errors);
	errors.push(...validateOpaqueRef(input.modelRef, "model_ref").errors);
	errors.push(...validateOpaqueRef(input.proposalRef, "proposal_ref").errors);

	if (!["claude", "openai", "gemini"].includes(input.providerFamily)) errors.push("provider_family must be 'claude', 'openai', or 'gemini'");

	if (!Number.isInteger(input.variantIndex) || input.variantIndex < 0 || input.variantIndex > 7) errors.push("variant_index must be a non-negative integer 0..7");
	if (!Number.isInteger(input.variantTotal) || input.variantTotal < 1 || input.variantTotal > 8) errors.push("variant_total must be a positive integer 1..8");
	if (errors.filter(e => e.includes("variant_index") || e.includes("variant_total")).length === 0 && input.variantIndex >= input.variantTotal) errors.push("variant_index must be < variant_total");

	const validOutcomeClasses: readonly string[] = ["completed_ok", "completed_degraded", "timeout", "provider_error", "policy_blocked"];
	if (!validOutcomeClasses.includes(input.outcomeClass)) errors.push("outcome_class must be a valid FlowDeskAdvisoryVariantOutcomeClassV1");

	if (!Array.isArray(input.outcomeReasonRefs) || input.outcomeReasonRefs.length < 1 || input.outcomeReasonRefs.length > 16) errors.push("outcome_reason_refs must be a non-empty array with 1..16 elements");
	else for (const [index, ref] of input.outcomeReasonRefs.entries()) errors.push(...validateOpaqueRef(ref, `outcome_reason_refs[${index}]`).errors);

	errors.push(...validateBoundedLabel(input.boundedSummaryLabel, "bounded_summary_label").errors);

	if (typeof input.durationMs !== "number" || !Number.isFinite(input.durationMs) || input.durationMs < 0) errors.push("duration_ms must be a non-negative finite number");
	if (!Number.isInteger(input.providerTokenUsageEstimate) || input.providerTokenUsageEstimate < 0) errors.push("provider_token_usage_estimate must be a non-negative integer");

	errors.push(...validateTimestamp(input.startedAt, "started_at").errors);
	errors.push(...validateTimestamp(input.completedAt, "completed_at").errors);

	// completed_at >= started_at
	if (errors.filter(e => e.includes("started_at") || e.includes("completed_at")).length === 0) {
		if (Date.parse(input.completedAt) < Date.parse(input.startedAt)) errors.push("completed_at must be >= started_at");
	}

	// outcome_class cross-field checks
	if (input.outcomeClass === "completed_ok" && !input.normalizedScoreRef) errors.push("normalized_score_ref is required when outcome_class is 'completed_ok'");
	if (input.outcomeClass === "policy_blocked" && input.normalizedScoreRef !== undefined) errors.push("normalized_score_ref must be absent when outcome_class is 'policy_blocked'");
	if (input.normalizedScoreRef !== undefined) errors.push(...validateOpaqueRef(input.normalizedScoreRef, "normalized_score_ref").errors);

	if (errors.length > 0) return { ok: false, errors };

	const result: FlowDeskAdvisoryVariantResultV1 = {
		schema_version: "flowdesk.advisory_variant_result.v1",
		variant_result_id: input.variantResultId,
		admission_decision_ref: input.admissionDecisionRef,
		reservation_ref: input.reservationRef,
		workflow_id: input.workflowId,
		attempt_id: input.attemptId,
		workflow_signature_ref: input.workflowSignatureRef,
		execution_purpose: "advisory_variant_test",
		variant_id: input.variantId,
		variant_index: input.variantIndex,
		variant_total: input.variantTotal,
		model_ref: input.modelRef,
		provider_family: input.providerFamily as "claude" | "openai" | "gemini",
		proposal_ref: input.proposalRef,
		...(input.normalizedScoreRef !== undefined ? { normalized_score_ref: input.normalizedScoreRef } : {}),
		outcome_class: input.outcomeClass,
		outcome_reason_refs: [...input.outcomeReasonRefs],
		bounded_summary_label: input.boundedSummaryLabel,
		duration_ms: input.durationMs,
		provider_token_usage_estimate: input.providerTokenUsageEstimate,
		started_at: input.startedAt,
		completed_at: input.completedAt,
		not_consumable_as_primary_task_result: true,
		advisory_only: true,
		non_authorizing: true,
		release_gate: "operational_intelligence_later_gate",
		dispatch_authority_enabled: false,
		approval_authority_enabled: false,
		provider_authority_enabled: false,
		runtime_authority_enabled: false,
		external_write_authority_enabled: false,
		remote_write_authority_enabled: false,
		fallback_authority_enabled: false,
		lane_launch_authority_enabled: false,
		write_authority_enabled: false,
		hard_chat_authority_enabled: false,
	};
	return { ok: true, errors: [], result };
}

const advisoryVariantResultAllowedProperties = [
	"schema_version",
	"variant_result_id",
	"admission_decision_ref",
	"reservation_ref",
	"workflow_id",
	"attempt_id",
	"workflow_signature_ref",
	"execution_purpose",
	"variant_id",
	"variant_index",
	"variant_total",
	"model_ref",
	"provider_family",
	"proposal_ref",
	"normalized_score_ref",
	"outcome_class",
	"outcome_reason_refs",
	"bounded_summary_label",
	"duration_ms",
	"provider_token_usage_estimate",
	"started_at",
	"completed_at",
	"not_consumable_as_primary_task_result",
	"advisory_only",
	"non_authorizing",
	"release_gate",
	"dispatch_authority_enabled",
	"approval_authority_enabled",
	"provider_authority_enabled",
	"runtime_authority_enabled",
	"external_write_authority_enabled",
	"remote_write_authority_enabled",
	"fallback_authority_enabled",
	"lane_launch_authority_enabled",
	"write_authority_enabled",
	"hard_chat_authority_enabled",
] as const;

const validOutcomeClasses: readonly string[] = ["completed_ok", "completed_degraded", "timeout", "provider_error", "policy_blocked"];
const validAdvisoryVariantProviderFamilies: readonly string[] = ["claude", "openai", "gemini"];

export function validateFlowDeskAdvisoryVariantResultV1(value: unknown): ValidationResult {
	if (!isRecord(value)) return invalid("advisory variant result must be an object");
	const record = value as Record<string, unknown>;
	const errors: string[] = [];

	// Deny-list check first
	for (const denyField of advisoryVariantDenyListFields) {
		if (denyField in record) errors.push(`advisory variant result must not contain deny-listed field: '${denyField}'`);
	}

	errors.push(...rejectUnknownProperties(record, advisoryVariantResultAllowedProperties, "advisory variant result").errors);

	if (record.schema_version !== "flowdesk.advisory_variant_result.v1") errors.push("advisory variant result schema_version is invalid");
	if (record.release_gate !== "operational_intelligence_later_gate") errors.push("advisory variant result release_gate is invalid");

	// HARD ANTI-BLUR MARKER check
	if (record.execution_purpose !== "advisory_variant_test") errors.push("execution_purpose must be 'advisory_variant_test' (hard anti-blur marker)");
	if (record.not_consumable_as_primary_task_result !== true) errors.push("not_consumable_as_primary_task_result must be true (second anti-blur layer)");

	errors.push(...validateOpaqueId(record.variant_result_id, "variant_result_id").errors);
	errors.push(...validateOpaqueRef(record.admission_decision_ref, "admission_decision_ref").errors);
	errors.push(...validateOpaqueRef(record.reservation_ref, "reservation_ref").errors);
	errors.push(...validateOpaqueId(record.workflow_id, "workflow_id").errors);
	errors.push(...validateOpaqueId(record.attempt_id, "attempt_id").errors);
	errors.push(...validateOpaqueRef(record.workflow_signature_ref, "workflow_signature_ref").errors);
	errors.push(...validateOpaqueId(record.variant_id, "variant_id").errors);
	errors.push(...validateOpaqueRef(record.model_ref, "model_ref").errors);
	errors.push(...validateOpaqueRef(record.proposal_ref, "proposal_ref").errors);

	if (typeof record.provider_family !== "string" || !validAdvisoryVariantProviderFamilies.includes(record.provider_family)) errors.push("provider_family must be 'claude', 'openai', or 'gemini'");

	if (!Number.isInteger(record.variant_index) || (record.variant_index as number) < 0 || (record.variant_index as number) > 7) errors.push("variant_index must be a non-negative integer 0..7");
	if (!Number.isInteger(record.variant_total) || (record.variant_total as number) < 1 || (record.variant_total as number) > 8) errors.push("variant_total must be a positive integer 1..8");
	if (typeof record.variant_index === "number" && typeof record.variant_total === "number" && (record.variant_index as number) >= (record.variant_total as number)) errors.push("variant_index must be < variant_total");

	if (typeof record.outcome_class !== "string" || !validOutcomeClasses.includes(record.outcome_class)) errors.push("outcome_class must be a valid FlowDeskAdvisoryVariantOutcomeClassV1");

	if (!Array.isArray(record.outcome_reason_refs) || (record.outcome_reason_refs as unknown[]).length < 1 || (record.outcome_reason_refs as unknown[]).length > 16) errors.push("outcome_reason_refs must be a non-empty array with 1..16 elements");
	else for (const [index, ref] of (record.outcome_reason_refs as unknown[]).entries()) errors.push(...validateOpaqueRef(ref, `outcome_reason_refs[${index}]`).errors);

	errors.push(...validateBoundedLabel(record.bounded_summary_label, "bounded_summary_label").errors);

	if (typeof record.duration_ms !== "number" || !Number.isFinite(record.duration_ms) || record.duration_ms < 0) errors.push("duration_ms must be a non-negative finite number");
	if (!Number.isInteger(record.provider_token_usage_estimate) || (record.provider_token_usage_estimate as number) < 0) errors.push("provider_token_usage_estimate must be a non-negative integer");

	errors.push(...validateTimestamp(record.started_at, "started_at").errors);
	errors.push(...validateTimestamp(record.completed_at, "completed_at").errors);

	if (typeof record.started_at === "string" && typeof record.completed_at === "string") {
		if (Date.parse(record.completed_at as string) < Date.parse(record.started_at as string)) errors.push("completed_at must be >= started_at");
	}

	// outcome_class cross-field
	if (record.outcome_class === "completed_ok" && record.normalized_score_ref === undefined) errors.push("normalized_score_ref is required when outcome_class is 'completed_ok'");
	if (record.outcome_class === "policy_blocked" && record.normalized_score_ref !== undefined) errors.push("normalized_score_ref must be absent when outcome_class is 'policy_blocked'");
	if (record.normalized_score_ref !== undefined) errors.push(...validateOpaqueRef(record.normalized_score_ref, "normalized_score_ref").errors);

	// Authority flags
	if (record.advisory_only !== true
		|| record.non_authorizing !== true
		|| record.dispatch_authority_enabled !== false
		|| record.approval_authority_enabled !== false
		|| record.provider_authority_enabled !== false
		|| record.runtime_authority_enabled !== false
		|| record.external_write_authority_enabled !== false
		|| record.remote_write_authority_enabled !== false
		|| record.fallback_authority_enabled !== false
		|| record.lane_launch_authority_enabled !== false
		|| record.write_authority_enabled !== false
		|| record.hard_chat_authority_enabled !== false) {
		errors.push("advisory variant result must remain advisory-only non-authorizing with no dispatch, approval, provider, runtime, external-write, remote-write, fallback, lane-launch, write, or hard-chat authority");
	}

	// Exclude numeric token-usage estimate from raw payload key scan (schema-safe numeric counter)
	const { provider_token_usage_estimate: _ptue, ...recordForPayloadCheck } = record;
	errors.push(...validateNoForbiddenRawPayloads(recordForPayloadCheck, "advisory_variant_result").errors);
	return errors.length === 0 ? valid() : invalid(...errors);
}
