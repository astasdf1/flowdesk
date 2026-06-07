/**
 * R3 Reservation Lifecycle Event contract.
 * Records transitions between reservation states (reserved → consumed/released/expired).
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
	validateTimestamp,
	isRecord,
	rejectUnknownProperties,
} from "./shared.js";

// ─── Type Definitions ──────────────────────────────────────────────────────────

export type FlowDeskR3ReservationLifecycleEventKindV1 = "consumed" | "released" | "expired";

const validEventKinds: readonly string[] = ["consumed", "released", "expired"];
const validPreviousStatuses: readonly string[] = ["reserved", "consumed", "released", "expired"];
const validNextStatuses: readonly string[] = ["consumed", "released", "expired"];
// Terminal states that cannot be a previous_status
const terminalStates = new Set<string>(["consumed", "released", "expired"]);

// ─── Contract ─────────────────────────────────────────────────────────────────

/**
 * Advisory-only contract recording a single reservation lifecycle transition.
 * Transitions must start from "reserved" status and move to a terminal state.
 */
export interface FlowDeskR3ReservationLifecycleEventV1 {
	schema_version: "flowdesk.r3_reservation_lifecycle_event.v1";
	event_id: string;
	reservation_id: string;
	workflow_id: string;
	attempt_id: string;
	previous_status: "reserved";
	next_status: FlowDeskR3ReservationLifecycleEventKindV1;
	event_kind: FlowDeskR3ReservationLifecycleEventKindV1;
	event_at: string;
	day_key: string;
	reason_ref: string;
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

export interface FlowDeskR3ReservationLifecycleEventResultV1 {
	ok: boolean;
	errors: string[];
	event?: FlowDeskR3ReservationLifecycleEventV1;
}

// ─── day_key validation ────────────────────────────────────────────────────────

const DAY_KEY_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

function validateDayKey(value: unknown, label: string): ValidationResult {
	if (typeof value !== "string" || !DAY_KEY_PATTERN.test(value)) {
		return invalid(`${label} must match YYYY-MM-DD`);
	}
	// Also check it's a real date
	const parsed = Date.parse(value);
	if (!Number.isFinite(parsed)) return invalid(`${label} must be a valid date in YYYY-MM-DD format`);
	return valid();
}

function deriveDayKey(eventAt: string): string {
	const d = new Date(eventAt);
	const year = d.getUTCFullYear();
	const month = String(d.getUTCMonth() + 1).padStart(2, "0");
	const day = String(d.getUTCDate()).padStart(2, "0");
	return `${year}-${month}-${day}`;
}

// ─── Factory function ──────────────────────────────────────────────────────────

export function createFlowDeskR3ReservationLifecycleEventV1(input: {
	eventId: string;
	reservationId: string;
	workflowId: string;
	attemptId: string;
	previousStatus: string;
	nextStatus: string;
	eventKind: string;
	eventAt: string;
	reasonRef: string;
}): FlowDeskR3ReservationLifecycleEventResultV1 {
	const errors: string[] = [];

	errors.push(...validateOpaqueId(input.eventId, "event_id").errors);
	errors.push(...validateOpaqueRef(input.reservationId, "reservation_id").errors);
	errors.push(...validateOpaqueId(input.workflowId, "workflow_id").errors);
	errors.push(...validateOpaqueId(input.attemptId, "attempt_id").errors);
	errors.push(...validateTimestamp(input.eventAt, "event_at").errors);
	errors.push(...validateOpaqueRef(input.reasonRef, "reason_ref").errors);

	// Validate previous_status: must be "reserved" (not terminal)
	if (!validPreviousStatuses.includes(input.previousStatus)) {
		errors.push(`previous_status must be one of: ${validPreviousStatuses.join(", ")}`);
	} else if (input.previousStatus !== "reserved") {
		errors.push("previous_status must be 'reserved' — terminal states cannot be transitioned from");
	}

	// Validate next_status
	if (!validNextStatuses.includes(input.nextStatus)) {
		errors.push(`next_status must be one of: ${validNextStatuses.join(", ")}`);
	}

	// Validate event_kind
	if (!validEventKinds.includes(input.eventKind)) {
		errors.push(`event_kind must be one of: ${validEventKinds.join(", ")}`);
	}

	// next_status must match event_kind
	if (validNextStatuses.includes(input.nextStatus) && validEventKinds.includes(input.eventKind) && input.nextStatus !== input.eventKind) {
		errors.push("next_status must match event_kind");
	}

	if (errors.length > 0) return { ok: false, errors };

	// Derive day_key from event_at
	let dayKey: string;
	try {
		dayKey = deriveDayKey(input.eventAt);
	} catch {
		return { ok: false, errors: ["event_at could not be converted to day_key"] };
	}

	const event: FlowDeskR3ReservationLifecycleEventV1 = {
		schema_version: "flowdesk.r3_reservation_lifecycle_event.v1",
		event_id: input.eventId,
		reservation_id: input.reservationId,
		workflow_id: input.workflowId,
		attempt_id: input.attemptId,
		previous_status: "reserved",
		next_status: input.nextStatus as FlowDeskR3ReservationLifecycleEventKindV1,
		event_kind: input.eventKind as FlowDeskR3ReservationLifecycleEventKindV1,
		event_at: input.eventAt,
		day_key: dayKey,
		reason_ref: input.reasonRef,
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
	return { ok: true, errors: [], event };
}

// ─── Allowed properties ────────────────────────────────────────────────────────

const r3ReservationLifecycleEventAllowedProperties = [
	"schema_version",
	"event_id",
	"reservation_id",
	"workflow_id",
	"attempt_id",
	"previous_status",
	"next_status",
	"event_kind",
	"event_at",
	"day_key",
	"reason_ref",
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

// ─── Validator ─────────────────────────────────────────────────────────────────

export function validateFlowDeskR3ReservationLifecycleEventV1(value: unknown): ValidationResult {
	if (!isRecord(value)) return invalid("r3 reservation lifecycle event must be an object");
	const record = value as Record<string, unknown>;
	const errors: string[] = [];

	errors.push(...rejectUnknownProperties(record, r3ReservationLifecycleEventAllowedProperties, "r3 reservation lifecycle event").errors);

	if (record.schema_version !== "flowdesk.r3_reservation_lifecycle_event.v1") {
		errors.push("r3 reservation lifecycle event schema_version is invalid");
	}
	if (record.release_gate !== "operational_intelligence_later_gate") {
		errors.push("r3 reservation lifecycle event release_gate is invalid");
	}

	errors.push(...validateOpaqueId(record.event_id, "event_id").errors);
	errors.push(...validateOpaqueRef(record.reservation_id, "reservation_id").errors);
	errors.push(...validateOpaqueId(record.workflow_id, "workflow_id").errors);
	errors.push(...validateOpaqueId(record.attempt_id, "attempt_id").errors);
	errors.push(...validateTimestamp(record.event_at, "event_at").errors);
	errors.push(...validateOpaqueRef(record.reason_ref, "reason_ref").errors);
	errors.push(...validateDayKey(record.day_key, "day_key").errors);

	// previous_status: must be "reserved"; terminal states cannot be previous_status
	if (typeof record.previous_status !== "string") {
		errors.push("previous_status must be a string");
	} else if (!validPreviousStatuses.includes(record.previous_status)) {
		errors.push(`previous_status must be one of: ${validPreviousStatuses.join(", ")}`);
	} else if (record.previous_status !== "reserved") {
		errors.push("previous_status must be 'reserved' — terminal states cannot be transitioned from");
	}

	// next_status validation
	if (typeof record.next_status !== "string" || !validNextStatuses.includes(record.next_status)) {
		errors.push(`next_status must be one of: ${validNextStatuses.join(", ")}`);
	}

	// event_kind validation
	if (typeof record.event_kind !== "string" || !validEventKinds.includes(record.event_kind)) {
		errors.push(`event_kind must be one of: ${validEventKinds.join(", ")}`);
	}

	// next_status must match event_kind
	if (typeof record.next_status === "string" && typeof record.event_kind === "string" &&
		validNextStatuses.includes(record.next_status) && validEventKinds.includes(record.event_kind) &&
		record.next_status !== record.event_kind) {
		errors.push("next_status must match event_kind");
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
		errors.push("r3 reservation lifecycle event must remain advisory-only non-authorizing with no dispatch, approval, provider, runtime, external-write, remote-write, fallback, lane-launch, write, or hard-chat authority");
	}

	errors.push(...validateNoForbiddenRawPayloads(record, "r3_reservation_lifecycle_event").errors);
	return errors.length === 0 ? valid() : invalid(...errors);
}
