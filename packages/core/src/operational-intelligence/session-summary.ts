/**
 * OI session summary contract.
 * P7-S13.5 submodule: session-summary
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
} from "./shared.js";

// ─── Types ────────────────────────────────────────────────────────────────────

/**
 * Advisory health label for the overall operational intelligence session.
 */
export type FlowDeskOIAdvisoryHealthLabelV1 = "healthy" | "degraded" | "stale" | "unknown";

/**
 * Pure advisory summary of operational intelligence activity for a single session.
 */
export interface FlowDeskOISessionSummaryV1 {
	schema_version: "flowdesk.oi_session_summary.v1";
	summary_id: string;
	session_ref: string;
	workflow_id: string;
	proposals_scored: number;
	reuse_gates_checked: number;
	fanout_gates_evaluated: number;
	ledger_entries_total: number;
	advisory_health_label: FlowDeskOIAdvisoryHealthLabelV1;
	captured_at: string;
	safe_next_actions: string[];
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

export interface FlowDeskOISessionSummaryResultV1 {
	ok: boolean;
	errors: string[];
	summary?: FlowDeskOISessionSummaryV1;
}

// ─── Creator ──────────────────────────────────────────────────────────────────

const oiHealthLabelsSet: readonly string[] = ["healthy", "degraded", "stale", "unknown"];

export function createFlowDeskOISessionSummaryV1(input: {
	summaryId: string;
	sessionRef: string;
	workflowId: string;
	proposalsScored: number;
	reuseGatesChecked: number;
	fanoutGatesEvaluated: number;
	ledgerEntriesTotal: number;
	advisoryHealthLabel: FlowDeskOIAdvisoryHealthLabelV1;
	capturedAt: string;
	safeNextActions: string[];
}): FlowDeskOISessionSummaryResultV1 {
	const errors: string[] = [];

	errors.push(...validateOpaqueId(input.summaryId, "summary_id").errors);
	errors.push(...validateOpaqueRef(input.sessionRef, "session_ref").errors);
	errors.push(...validateOpaqueId(input.workflowId, "workflow_id").errors);
	errors.push(...validateTimestamp(input.capturedAt, "captured_at").errors);

	if (typeof input.proposalsScored !== "number" || !Number.isInteger(input.proposalsScored) || input.proposalsScored < 0) {
		errors.push("proposals_scored must be a non-negative integer");
	}
	if (typeof input.reuseGatesChecked !== "number" || !Number.isInteger(input.reuseGatesChecked) || input.reuseGatesChecked < 0) {
		errors.push("reuse_gates_checked must be a non-negative integer");
	}
	if (typeof input.fanoutGatesEvaluated !== "number" || !Number.isInteger(input.fanoutGatesEvaluated) || input.fanoutGatesEvaluated < 0) {
		errors.push("fanout_gates_evaluated must be a non-negative integer");
	}
	if (typeof input.ledgerEntriesTotal !== "number" || !Number.isInteger(input.ledgerEntriesTotal) || input.ledgerEntriesTotal < 0) {
		errors.push("ledger_entries_total must be a non-negative integer");
	}

	if (typeof input.advisoryHealthLabel !== "string" || !oiHealthLabelsSet.includes(input.advisoryHealthLabel)) {
		errors.push("advisory_health_label must be 'healthy', 'degraded', 'stale', or 'unknown'");
	}

	if (!Array.isArray(input.safeNextActions) || input.safeNextActions.length === 0 || input.safeNextActions.length > 8) {
		errors.push("safe_next_actions must be a non-empty bounded array (1..8 entries)");
	} else {
		for (const [index, action] of input.safeNextActions.entries()) {
			errors.push(...validateOpaqueRef(action, `safe_next_actions[${index}]`).errors);
		}
	}

	if (errors.length > 0) return { ok: false, errors };

	const summary: FlowDeskOISessionSummaryV1 = {
		schema_version: "flowdesk.oi_session_summary.v1",
		summary_id: input.summaryId,
		session_ref: input.sessionRef,
		workflow_id: input.workflowId,
		proposals_scored: input.proposalsScored,
		reuse_gates_checked: input.reuseGatesChecked,
		fanout_gates_evaluated: input.fanoutGatesEvaluated,
		ledger_entries_total: input.ledgerEntriesTotal,
		advisory_health_label: input.advisoryHealthLabel,
		captured_at: input.capturedAt,
		safe_next_actions: [...input.safeNextActions],
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
	return { ok: true, errors: [], summary };
}

// ─── Validator ────────────────────────────────────────────────────────────────

const oiSessionSummaryAllowedProperties = [
	"schema_version",
	"summary_id",
	"session_ref",
	"workflow_id",
	"proposals_scored",
	"reuse_gates_checked",
	"fanout_gates_evaluated",
	"ledger_entries_total",
	"advisory_health_label",
	"captured_at",
	"safe_next_actions",
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

const oiHealthLabels: readonly string[] = ["healthy", "degraded", "stale", "unknown"];

export function validateFlowDeskOISessionSummaryV1(value: unknown): ValidationResult {
	if (!isRecord(value)) return invalid("OI session summary must be an object");
	const record = value as Record<string, unknown>;
	const errors: string[] = [];

	errors.push(...rejectUnknownProperties(record, oiSessionSummaryAllowedProperties, "OI session summary").errors);

	if (record.schema_version !== "flowdesk.oi_session_summary.v1") {
		errors.push("OI session summary schema_version is invalid");
	}

	errors.push(...validateOpaqueId(record.summary_id, "summary_id").errors);
	errors.push(...validateOpaqueRef(record.session_ref, "session_ref").errors);
	errors.push(...validateOpaqueId(record.workflow_id, "workflow_id").errors);
	errors.push(...validateTimestamp(record.captured_at, "captured_at").errors);

	if (typeof record.proposals_scored !== "number" || !Number.isInteger(record.proposals_scored) || record.proposals_scored < 0) {
		errors.push("proposals_scored must be a non-negative integer");
	}
	if (typeof record.reuse_gates_checked !== "number" || !Number.isInteger(record.reuse_gates_checked) || record.reuse_gates_checked < 0) {
		errors.push("reuse_gates_checked must be a non-negative integer");
	}
	if (typeof record.fanout_gates_evaluated !== "number" || !Number.isInteger(record.fanout_gates_evaluated) || record.fanout_gates_evaluated < 0) {
		errors.push("fanout_gates_evaluated must be a non-negative integer");
	}
	if (typeof record.ledger_entries_total !== "number" || !Number.isInteger(record.ledger_entries_total) || record.ledger_entries_total < 0) {
		errors.push("ledger_entries_total must be a non-negative integer");
	}

	if (typeof record.advisory_health_label !== "string" || !oiHealthLabels.includes(record.advisory_health_label)) {
		errors.push("advisory_health_label must be 'healthy', 'degraded', 'stale', or 'unknown'");
	}

	if (!Array.isArray(record.safe_next_actions) || record.safe_next_actions.length === 0 || record.safe_next_actions.length > 8) {
		errors.push("safe_next_actions must be a non-empty bounded array (1..8 entries)");
	} else {
		for (const [index, action] of record.safe_next_actions.entries()) {
			errors.push(...validateOpaqueRef(action, `safe_next_actions[${index}]`).errors);
		}
	}

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
		errors.push("OI session summary must remain advisory-only non-authorizing with no dispatch, approval, provider, runtime, external-write, remote-write, fallback, lane-launch, write, or hard-chat authority");
	}

	errors.push(...validateNoForbiddenRawPayloads(record, "oi_session_summary").errors);
	return errors.length === 0 ? valid() : invalid(...errors);
}
