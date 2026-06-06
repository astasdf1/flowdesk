/**
 * Score reference pack and workflow signature index entry contracts.
 * P7-S13.5 submodule: score-reference
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

// ─── Score Reference Pack ─────────────────────────────────────────────────────

/**
 * Advisory-only contract bundling a bounded set of prior advisory score refs,
 * snapshot refs, and gate decision refs for a given workflow/task signature.
 */
export interface FlowDeskScoreReferencePackV1 {
	schema_version: "flowdesk.score_reference_pack.v1";
	reference_pack_id: string;
	workflow_id: string;
	task_signature_ref: string;
	score_refs: string[];
	snapshot_refs: string[];
	gate_decision_refs: string[];
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

export interface FlowDeskScoreReferencePackResultV1 {
	ok: boolean;
	errors: string[];
	pack?: FlowDeskScoreReferencePackV1;
}

export function createFlowDeskScoreReferencePackV1(input: {
	referencePackId: string;
	workflowId: string;
	taskSignatureRef: string;
	scoreRefs: string[];
	snapshotRefs?: string[];
	gateDecisionRefs?: string[];
	capturedAt: string;
	safeNextActions: string[];
}): FlowDeskScoreReferencePackResultV1 {
	const errors: string[] = [];

	errors.push(...validateOpaqueId(input.referencePackId, "reference_pack_id").errors);
	errors.push(...validateOpaqueId(input.workflowId, "workflow_id").errors);
	errors.push(...validateOpaqueRef(input.taskSignatureRef, "task_signature_ref").errors);
	errors.push(...validateTimestamp(input.capturedAt, "captured_at").errors);

	if (!Array.isArray(input.scoreRefs) || input.scoreRefs.length === 0 || input.scoreRefs.length > 20) {
		errors.push("score_refs must be a non-empty bounded array (1..20 entries)");
	} else {
		for (const [index, ref] of input.scoreRefs.entries()) {
			errors.push(...validateOpaqueRef(ref, `score_refs[${index}]`).errors);
		}
	}

	const snapshotRefs = input.snapshotRefs ?? [];
	if (!Array.isArray(snapshotRefs) || snapshotRefs.length > 10) {
		errors.push("snapshot_refs must be a bounded array (0..10 entries)");
	} else {
		for (const [index, ref] of snapshotRefs.entries()) {
			errors.push(...validateOpaqueRef(ref, `snapshot_refs[${index}]`).errors);
		}
	}

	const gateDecisionRefs = input.gateDecisionRefs ?? [];
	if (!Array.isArray(gateDecisionRefs) || gateDecisionRefs.length > 10) {
		errors.push("gate_decision_refs must be a bounded array (0..10 entries)");
	} else {
		for (const [index, ref] of gateDecisionRefs.entries()) {
			errors.push(...validateOpaqueRef(ref, `gate_decision_refs[${index}]`).errors);
		}
	}

	if (!Array.isArray(input.safeNextActions) || input.safeNextActions.length === 0 || input.safeNextActions.length > 8) {
		errors.push("safe_next_actions must be a non-empty bounded array (1..8 entries)");
	} else {
		for (const [index, action] of input.safeNextActions.entries()) {
			errors.push(...validateOpaqueRef(action, `safe_next_actions[${index}]`).errors);
		}
	}

	if (errors.length > 0) return { ok: false, errors };

	const pack: FlowDeskScoreReferencePackV1 = {
		schema_version: "flowdesk.score_reference_pack.v1",
		reference_pack_id: input.referencePackId,
		workflow_id: input.workflowId,
		task_signature_ref: input.taskSignatureRef,
		score_refs: [...input.scoreRefs],
		snapshot_refs: [...snapshotRefs],
		gate_decision_refs: [...gateDecisionRefs],
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
	return { ok: true, errors: [], pack };
}

const scoreReferencePackAllowedProperties = [
	"schema_version",
	"reference_pack_id",
	"workflow_id",
	"task_signature_ref",
	"score_refs",
	"snapshot_refs",
	"gate_decision_refs",
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

export function validateFlowDeskScoreReferencePackV1(value: unknown): ValidationResult {
	if (!isRecord(value)) return invalid("score reference pack must be an object");
	const record = value as Record<string, unknown>;
	const errors: string[] = [];

	errors.push(...rejectUnknownProperties(record, scoreReferencePackAllowedProperties, "score reference pack").errors);

	if (record.schema_version !== "flowdesk.score_reference_pack.v1") {
		errors.push("score reference pack schema_version is invalid");
	}

	errors.push(...validateOpaqueId(record.reference_pack_id, "reference_pack_id").errors);
	errors.push(...validateOpaqueId(record.workflow_id, "workflow_id").errors);
	errors.push(...validateOpaqueRef(record.task_signature_ref, "task_signature_ref").errors);
	errors.push(...validateTimestamp(record.captured_at, "captured_at").errors);

	if (!Array.isArray(record.score_refs) || record.score_refs.length === 0 || record.score_refs.length > 20) {
		errors.push("score_refs must be a non-empty bounded array (1..20 entries)");
	} else {
		for (const [index, ref] of record.score_refs.entries()) {
			errors.push(...validateOpaqueRef(ref, `score_refs[${index}]`).errors);
		}
	}

	if (!Array.isArray(record.snapshot_refs) || record.snapshot_refs.length > 10) {
		errors.push("snapshot_refs must be a bounded array (0..10 entries)");
	} else {
		for (const [index, ref] of record.snapshot_refs.entries()) {
			errors.push(...validateOpaqueRef(ref, `snapshot_refs[${index}]`).errors);
		}
	}

	if (!Array.isArray(record.gate_decision_refs) || record.gate_decision_refs.length > 10) {
		errors.push("gate_decision_refs must be a bounded array (0..10 entries)");
	} else {
		for (const [index, ref] of record.gate_decision_refs.entries()) {
			errors.push(...validateOpaqueRef(ref, `gate_decision_refs[${index}]`).errors);
		}
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
		errors.push("score reference pack must remain advisory-only non-authorizing with no dispatch, approval, provider, runtime, external-write, remote-write, fallback, lane-launch, write, or hard-chat authority");
	}

	errors.push(...validateNoForbiddenRawPayloads(record, "score_reference_pack").errors);
	return errors.length === 0 ? valid() : invalid(...errors);
}

// ─── Workflow Signature Index Entry ───────────────────────────────────────────

/**
 * Advisory-only contract representing a single index entry that maps a
 * workflow/task signature to its associated reference pack ref,
 * category-fit snapshot ref, and last-scored timestamp.
 */
export interface FlowDeskWorkflowSignatureIndexEntryV1 {
	schema_version: "flowdesk.workflow_signature_index_entry.v1";
	entry_id: string;
	workflow_id: string;
	task_signature_ref: string;
	reference_pack_ref?: string;
	category_fit_snapshot_ref?: string;
	last_scored_at?: string;
	created_at: string;
	advisory_only: true;
	non_authorizing: true;
	safe_next_actions: string[];
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

export interface FlowDeskWorkflowSignatureIndexEntryResultV1 {
	ok: boolean;
	errors: string[];
	entry?: FlowDeskWorkflowSignatureIndexEntryV1;
}

export function createFlowDeskWorkflowSignatureIndexEntryV1(input: {
	entryId: string;
	workflowId: string;
	taskSignatureRef: string;
	referencePackRef?: string;
	categoryFitSnapshotRef?: string;
	lastScoredAt?: string;
	createdAt: string;
	safeNextActions: string[];
}): FlowDeskWorkflowSignatureIndexEntryResultV1 {
	const errors: string[] = [];

	errors.push(...validateOpaqueId(input.entryId, "entry_id").errors);
	errors.push(...validateOpaqueId(input.workflowId, "workflow_id").errors);
	errors.push(...validateOpaqueRef(input.taskSignatureRef, "task_signature_ref").errors);
	errors.push(...validateTimestamp(input.createdAt, "created_at").errors);

	if (input.referencePackRef !== undefined) {
		errors.push(...validateOpaqueRef(input.referencePackRef, "reference_pack_ref").errors);
	}
	if (input.categoryFitSnapshotRef !== undefined) {
		errors.push(...validateOpaqueRef(input.categoryFitSnapshotRef, "category_fit_snapshot_ref").errors);
	}
	if (input.lastScoredAt !== undefined) {
		errors.push(...validateTimestamp(input.lastScoredAt, "last_scored_at").errors);
	}

	if (input.lastScoredAt !== undefined && Number.isFinite(Date.parse(input.lastScoredAt)) && Number.isFinite(Date.parse(input.createdAt))) {
		if (Date.parse(input.lastScoredAt) < Date.parse(input.createdAt)) {
			errors.push("last_scored_at must not precede created_at");
		}
	}

	if (!Array.isArray(input.safeNextActions) || input.safeNextActions.length === 0 || input.safeNextActions.length > 8) {
		errors.push("safe_next_actions must be a non-empty bounded array (1..8 entries)");
	} else {
		for (const [index, action] of input.safeNextActions.entries()) {
			errors.push(...validateOpaqueRef(action, `safe_next_actions[${index}]`).errors);
		}
	}

	if (errors.length > 0) return { ok: false, errors };

	const entry: FlowDeskWorkflowSignatureIndexEntryV1 = {
		schema_version: "flowdesk.workflow_signature_index_entry.v1",
		entry_id: input.entryId,
		workflow_id: input.workflowId,
		task_signature_ref: input.taskSignatureRef,
		...(input.referencePackRef === undefined ? {} : { reference_pack_ref: input.referencePackRef }),
		...(input.categoryFitSnapshotRef === undefined ? {} : { category_fit_snapshot_ref: input.categoryFitSnapshotRef }),
		...(input.lastScoredAt === undefined ? {} : { last_scored_at: input.lastScoredAt }),
		created_at: input.createdAt,
		advisory_only: true,
		non_authorizing: true,
		safe_next_actions: [...input.safeNextActions],
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
	return { ok: true, errors: [], entry };
}

const workflowSignatureIndexEntryAllowedProperties = [
	"schema_version",
	"entry_id",
	"workflow_id",
	"task_signature_ref",
	"reference_pack_ref",
	"category_fit_snapshot_ref",
	"last_scored_at",
	"created_at",
	"advisory_only",
	"non_authorizing",
	"safe_next_actions",
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

export function validateFlowDeskWorkflowSignatureIndexEntryV1(value: unknown): ValidationResult {
	if (!isRecord(value)) return invalid("workflow signature index entry must be an object");
	const record = value as Record<string, unknown>;
	const errors: string[] = [];

	errors.push(...rejectUnknownProperties(record, workflowSignatureIndexEntryAllowedProperties, "workflow signature index entry").errors);

	if (record.schema_version !== "flowdesk.workflow_signature_index_entry.v1") {
		errors.push("workflow signature index entry schema_version is invalid");
	}

	errors.push(...validateOpaqueId(record.entry_id, "entry_id").errors);
	errors.push(...validateOpaqueId(record.workflow_id, "workflow_id").errors);
	errors.push(...validateOpaqueRef(record.task_signature_ref, "task_signature_ref").errors);
	errors.push(...validateTimestamp(record.created_at, "created_at").errors);

	if (record.reference_pack_ref !== undefined) {
		errors.push(...validateOpaqueRef(record.reference_pack_ref, "reference_pack_ref").errors);
	}
	if (record.category_fit_snapshot_ref !== undefined) {
		errors.push(...validateOpaqueRef(record.category_fit_snapshot_ref, "category_fit_snapshot_ref").errors);
	}
	if (record.last_scored_at !== undefined) {
		errors.push(...validateTimestamp(record.last_scored_at, "last_scored_at").errors);
	}

	if (
		record.last_scored_at !== undefined
		&& typeof record.last_scored_at === "string"
		&& typeof record.created_at === "string"
		&& Number.isFinite(Date.parse(record.last_scored_at))
		&& Number.isFinite(Date.parse(record.created_at as string))
	) {
		if (Date.parse(record.last_scored_at) < Date.parse(record.created_at as string)) {
			errors.push("last_scored_at must not precede created_at");
		}
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
		errors.push("workflow signature index entry must remain advisory-only non-authorizing with no dispatch, approval, provider, runtime, external-write, remote-write, fallback, lane-launch, write, or hard-chat authority");
	}

	errors.push(...validateNoForbiddenRawPayloads(record, "workflow_signature_index_entry").errors);
	return errors.length === 0 ? valid() : invalid(...errors);
}
