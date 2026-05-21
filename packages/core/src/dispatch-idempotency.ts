import {
	invalid,
	type ValidationResult,
	valid,
	validateNoForbiddenRawPayloads,
	validateOpaqueId,
	validateOpaqueRef,
} from "./validators.js";

export const FLOWDESK_DISPATCH_IDEMPOTENCY_ENTRY_STATES = [
	"reserved",
	"sdk_call_permitted",
	"dispatch_completed",
	"dispatch_failed",
	"quarantined",
] as const;
export type FlowDeskDispatchIdempotencyEntryStateV1 =
	(typeof FLOWDESK_DISPATCH_IDEMPOTENCY_ENTRY_STATES)[number];

export interface FlowDeskDispatchIdempotencyLedgerEntryV1 {
	attempt_id: string;
	idempotency_key: string;
	state: FlowDeskDispatchIdempotencyEntryStateV1;
	recorded_at: string;
}

export interface FlowDeskDispatchIdempotencySnapshotV1 {
	schema_version: "flowdesk.dispatch_idempotency_snapshot.v1";
	workflow_id: string;
	snapshot_ref: string;
	observed_at: string;
	entries: FlowDeskDispatchIdempotencyLedgerEntryV1[];
	dispatch_authority_enabled: false;
	realOpenCodeDispatch: false;
	actualLaneLaunch: false;
	providerCall: false;
	runtimeExecution: false;
}

export interface FlowDeskDispatchIdempotencyReplayEvaluationV1
	extends ValidationResult {
	schema_version: "flowdesk.dispatch_idempotency_replay_evaluation.v1";
	workflow_id?: string;
	attempt_id?: string;
	state: "unique" | "replay_blocked";
	replay_safe: boolean;
	blocked_labels: string[];
	dispatch_authority_enabled: false;
	realOpenCodeDispatch: false;
	actualLaneLaunch: false;
	providerCall: false;
	runtimeExecution: false;
}

export interface FlowDeskDispatchIdempotencyReservationResultV1
	extends ValidationResult {
	schema_version: "flowdesk.dispatch_idempotency_reservation_result.v1";
	workflow_id?: string;
	attempt_id?: string;
	snapshot_ref?: string;
	state: "reservation_prepared" | "blocked_before_reservation";
	reservation_prepared: boolean;
	blocked_labels: string[];
	snapshot?: FlowDeskDispatchIdempotencySnapshotV1;
	dispatch_authority_enabled: false;
	realOpenCodeDispatch: false;
	actualLaneLaunch: false;
	providerCall: false;
	runtimeExecution: false;
}

export interface FlowDeskDispatchIdempotencyStateUpdateResultV1
	extends ValidationResult {
	schema_version: "flowdesk.dispatch_idempotency_state_update_result.v1";
	workflow_id?: string;
	attempt_id?: string;
	snapshot_ref?: string;
	state: "state_update_prepared" | "blocked_before_state_update";
	state_update_prepared: boolean;
	blocked_labels: string[];
	snapshot?: FlowDeskDispatchIdempotencySnapshotV1;
	dispatch_authority_enabled: false;
	realOpenCodeDispatch: false;
	actualLaneLaunch: false;
	providerCall: false;
	runtimeExecution: false;
}

const disabledAuthority = {
	dispatch_authority_enabled: false as const,
	realOpenCodeDispatch: false as const,
	actualLaneLaunch: false as const,
	providerCall: false as const,
	runtimeExecution: false as const,
};

function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === "object" && value !== null && !Array.isArray(value);
}

function validateTimestamp(value: unknown, label: string): ValidationResult {
	return typeof value === "string" && Number.isFinite(Date.parse(value))
		? valid()
		: invalid(`${label} must be a parseable timestamp`);
}

function validateEntry(value: unknown, index: number): ValidationResult {
	if (!isRecord(value)) return invalid(`entries[${index}] must be an object`);
	const record = value as Partial<FlowDeskDispatchIdempotencyLedgerEntryV1>;
	const errors: string[] = [];
	const allowed = new Set(["attempt_id", "idempotency_key", "state", "recorded_at"]);
	for (const key of Object.keys(record))
		if (!allowed.has(key)) errors.push(`entries[${index}] unknown properties: ${key}`);
	errors.push(...validateOpaqueId(record.attempt_id, `entries[${index}].attempt_id`).errors);
	errors.push(...validateOpaqueRef(record.idempotency_key, `entries[${index}].idempotency_key`).errors);
	if (
		typeof record.state !== "string" ||
		!(FLOWDESK_DISPATCH_IDEMPOTENCY_ENTRY_STATES as readonly string[]).includes(record.state)
	)
		errors.push(`entries[${index}].state is invalid`);
	errors.push(...validateTimestamp(record.recorded_at, `entries[${index}].recorded_at`).errors);
	errors.push(...validateNoForbiddenRawPayloads(record, `entries[${index}]`).errors);
	return errors.length === 0 ? valid() : invalid(...errors);
}

export function validateFlowDeskDispatchIdempotencySnapshotV1(
	value: unknown,
	expectedWorkflowId?: string,
): ValidationResult {
	if (!isRecord(value)) return invalid("dispatch idempotency snapshot must be an object");
	const record = value as Partial<FlowDeskDispatchIdempotencySnapshotV1>;
	const errors: string[] = [];
	const allowed = new Set([
		"schema_version",
		"workflow_id",
		"snapshot_ref",
		"observed_at",
		"entries",
		"dispatch_authority_enabled",
		"realOpenCodeDispatch",
		"actualLaneLaunch",
		"providerCall",
		"runtimeExecution",
	]);
	for (const key of Object.keys(record))
		if (!allowed.has(key)) errors.push(`unknown properties: ${key}`);
	if (record.schema_version !== "flowdesk.dispatch_idempotency_snapshot.v1")
		errors.push("dispatch idempotency snapshot schema_version is invalid");
	errors.push(...validateOpaqueId(record.workflow_id, "workflow_id").errors);
	if (expectedWorkflowId !== undefined && record.workflow_id !== expectedWorkflowId)
		errors.push("dispatch idempotency snapshot workflow_id mismatch");
	errors.push(...validateOpaqueRef(record.snapshot_ref, "snapshot_ref").errors);
	errors.push(...validateTimestamp(record.observed_at, "observed_at").errors);
	if (!Array.isArray(record.entries)) {
		errors.push("entries must be an array");
	} else {
		if (record.entries.length > 200) errors.push("entries must be bounded to 200");
		const seenAttempts = new Set<string>();
		const seenIdempotencyKeys = new Set<string>();
		for (const [index, entry] of record.entries.entries()) {
			errors.push(...validateEntry(entry, index).errors);
			if (isRecord(entry) && typeof entry.attempt_id === "string") {
				if (seenAttempts.has(entry.attempt_id))
					errors.push(`entries[${index}].attempt_id is duplicated`);
				seenAttempts.add(entry.attempt_id);
			}
			if (isRecord(entry) && typeof entry.idempotency_key === "string") {
				if (seenIdempotencyKeys.has(entry.idempotency_key))
					errors.push(`entries[${index}].idempotency_key is duplicated`);
				seenIdempotencyKeys.add(entry.idempotency_key);
			}
		}
	}
	if (
		record.dispatch_authority_enabled !== false ||
		record.realOpenCodeDispatch !== false ||
		record.actualLaneLaunch !== false ||
		record.providerCall !== false ||
		record.runtimeExecution !== false
	)
		errors.push("dispatch idempotency snapshot cannot enable runtime authority");
	errors.push(...validateNoForbiddenRawPayloads(record, "dispatch_idempotency_snapshot").errors);
	return errors.length === 0 ? valid() : invalid(...errors);
}

export function evaluateFlowDeskDispatchIdempotencyReplayV1(input: {
	workflowId: string;
	attemptId: string;
	idempotencyKey: string;
	snapshot?: FlowDeskDispatchIdempotencySnapshotV1;
}): FlowDeskDispatchIdempotencyReplayEvaluationV1 {
	const errors: string[] = [];
	const blockedLabels: string[] = [];
	errors.push(...validateOpaqueId(input.workflowId, "workflow_id").errors);
	errors.push(...validateOpaqueId(input.attemptId, "attempt_id").errors);
	errors.push(...validateOpaqueRef(input.idempotencyKey, "idempotency_key").errors);
	if (input.snapshot === undefined) {
		blockedLabels.push("idempotency_snapshot_missing");
	} else {
		const snapshot = validateFlowDeskDispatchIdempotencySnapshotV1(input.snapshot, input.workflowId);
		errors.push(...snapshot.errors);
		if (!snapshot.ok) blockedLabels.push("idempotency_snapshot_invalid");
		const entries = Array.isArray(input.snapshot.entries)
			? input.snapshot.entries
			: [];
		for (const entry of entries) {
			if (entry.attempt_id === input.attemptId)
				blockedLabels.push("attempt_already_recorded");
			if (entry.idempotency_key === input.idempotencyKey)
				blockedLabels.push("idempotency_key_reused");
		}
	}
	const uniqueBlockedLabels = [...new Set(blockedLabels)];
	const replaySafe = errors.length === 0 && uniqueBlockedLabels.length === 0;
	return {
		schema_version: "flowdesk.dispatch_idempotency_replay_evaluation.v1",
		workflow_id: input.workflowId,
		attempt_id: input.attemptId,
		ok: errors.length === 0,
		errors,
		state: replaySafe ? "unique" : "replay_blocked",
		replay_safe: replaySafe,
		blocked_labels: uniqueBlockedLabels,
		...disabledAuthority,
	};
}

export function prepareFlowDeskDispatchIdempotencyReservationV1(input: {
	workflowId: string;
	attemptId: string;
	idempotencyKey: string;
	snapshotRef: string;
	reservedAt: string;
	existingSnapshot?: FlowDeskDispatchIdempotencySnapshotV1;
}): FlowDeskDispatchIdempotencyReservationResultV1 {
	const errors: string[] = [];
	const blockedLabels: string[] = [];
	errors.push(...validateOpaqueId(input.workflowId, "workflow_id").errors);
	errors.push(...validateOpaqueId(input.attemptId, "attempt_id").errors);
	errors.push(...validateOpaqueRef(input.idempotencyKey, "idempotency_key").errors);
	errors.push(...validateOpaqueRef(input.snapshotRef, "snapshot_ref").errors);
	errors.push(...validateTimestamp(input.reservedAt, "reserved_at").errors);
	const existingEntries = input.existingSnapshot?.entries ?? [];
	if (input.existingSnapshot !== undefined) {
		const existing = validateFlowDeskDispatchIdempotencySnapshotV1(
			input.existingSnapshot,
			input.workflowId,
		);
		errors.push(...existing.errors);
		if (!existing.ok) blockedLabels.push("existing_snapshot_invalid");
	}
	const replay = evaluateFlowDeskDispatchIdempotencyReplayV1({
		workflowId: input.workflowId,
		attemptId: input.attemptId,
		idempotencyKey: input.idempotencyKey,
		snapshot: input.existingSnapshot ?? {
			schema_version: "flowdesk.dispatch_idempotency_snapshot.v1",
			workflow_id: input.workflowId,
			snapshot_ref: input.snapshotRef,
			observed_at: input.reservedAt,
			entries: [],
			...disabledAuthority,
		},
	});
	errors.push(...replay.errors);
	if (!replay.replay_safe)
		blockedLabels.push(
			...replay.blocked_labels.map((label) => `reservation_${label}`),
		);
	const uniqueBlockedLabels = [...new Set(blockedLabels)];
	let snapshot: FlowDeskDispatchIdempotencySnapshotV1 | undefined;
	if (errors.length === 0 && uniqueBlockedLabels.length === 0) {
		const candidate: FlowDeskDispatchIdempotencySnapshotV1 = {
			schema_version: "flowdesk.dispatch_idempotency_snapshot.v1",
			workflow_id: input.workflowId,
			snapshot_ref: input.snapshotRef,
			observed_at: input.reservedAt,
			entries: [
				...existingEntries,
				{
					attempt_id: input.attemptId,
					idempotency_key: input.idempotencyKey,
					state: "reserved",
					recorded_at: input.reservedAt,
				},
			],
			...disabledAuthority,
		};
		const candidateValidation = validateFlowDeskDispatchIdempotencySnapshotV1(
			candidate,
			input.workflowId,
		);
		errors.push(...candidateValidation.errors);
		if (candidateValidation.ok) {
			snapshot = candidate;
		} else {
			uniqueBlockedLabels.push("reservation_snapshot_invalid");
		}
	}
	const prepared = errors.length === 0 && uniqueBlockedLabels.length === 0;
	return {
		schema_version: "flowdesk.dispatch_idempotency_reservation_result.v1",
		workflow_id: input.workflowId,
		attempt_id: input.attemptId,
		snapshot_ref: input.snapshotRef,
		ok: errors.length === 0,
		errors,
		state: prepared ? "reservation_prepared" : "blocked_before_reservation",
		reservation_prepared: prepared,
		blocked_labels: uniqueBlockedLabels,
		...(snapshot === undefined ? {} : { snapshot }),
		...disabledAuthority,
	};
}

export function prepareFlowDeskDispatchIdempotencyStateUpdateV1(input: {
	workflowId: string;
	attemptId: string;
	idempotencyKey: string;
	snapshotRef: string;
	recordedAt: string;
	nextState: FlowDeskDispatchIdempotencyEntryStateV1;
	existingSnapshot?: FlowDeskDispatchIdempotencySnapshotV1;
}): FlowDeskDispatchIdempotencyStateUpdateResultV1 {
	const errors: string[] = [];
	const blockedLabels: string[] = [];
	errors.push(...validateOpaqueId(input.workflowId, "workflow_id").errors);
	errors.push(...validateOpaqueId(input.attemptId, "attempt_id").errors);
	errors.push(...validateOpaqueRef(input.idempotencyKey, "idempotency_key").errors);
	errors.push(...validateOpaqueRef(input.snapshotRef, "snapshot_ref").errors);
	errors.push(...validateTimestamp(input.recordedAt, "recorded_at").errors);
	if (
		!(FLOWDESK_DISPATCH_IDEMPOTENCY_ENTRY_STATES as readonly string[]).includes(
			input.nextState,
		) ||
		input.nextState === "reserved"
	)
		errors.push("next_state must be a terminal or post-reservation state");
	if (input.existingSnapshot === undefined) {
		blockedLabels.push("existing_snapshot_missing");
	} else {
		const existing = validateFlowDeskDispatchIdempotencySnapshotV1(
			input.existingSnapshot,
			input.workflowId,
		);
		errors.push(...existing.errors);
		if (!existing.ok) blockedLabels.push("existing_snapshot_invalid");
	}
	const entries = input.existingSnapshot?.entries ?? [];
	const matchingIndex = entries.findIndex(
		(entry) =>
			entry.attempt_id === input.attemptId &&
			entry.idempotency_key === input.idempotencyKey,
	);
	if (matchingIndex === -1) blockedLabels.push("idempotency_entry_missing");
	const uniqueBlockedLabels = [...new Set(blockedLabels)];
	let snapshot: FlowDeskDispatchIdempotencySnapshotV1 | undefined;
	if (errors.length === 0 && uniqueBlockedLabels.length === 0) {
		const updatedEntries = entries.map((entry, index) =>
			index === matchingIndex
				? { ...entry, state: input.nextState, recorded_at: input.recordedAt }
				: entry,
		);
		const candidate: FlowDeskDispatchIdempotencySnapshotV1 = {
			schema_version: "flowdesk.dispatch_idempotency_snapshot.v1",
			workflow_id: input.workflowId,
			snapshot_ref: input.snapshotRef,
			observed_at: input.recordedAt,
			entries: updatedEntries,
			...disabledAuthority,
		};
		const candidateValidation = validateFlowDeskDispatchIdempotencySnapshotV1(
			candidate,
			input.workflowId,
		);
		errors.push(...candidateValidation.errors);
		if (candidateValidation.ok) {
			snapshot = candidate;
		} else {
			uniqueBlockedLabels.push("state_update_snapshot_invalid");
		}
	}
	const prepared = errors.length === 0 && uniqueBlockedLabels.length === 0;
	return {
		schema_version: "flowdesk.dispatch_idempotency_state_update_result.v1",
		workflow_id: input.workflowId,
		attempt_id: input.attemptId,
		snapshot_ref: input.snapshotRef,
		ok: errors.length === 0,
		errors,
		state: prepared ? "state_update_prepared" : "blocked_before_state_update",
		state_update_prepared: prepared,
		blocked_labels: uniqueBlockedLabels,
		...(snapshot === undefined ? {} : { snapshot }),
		...disabledAuthority,
	};
}
