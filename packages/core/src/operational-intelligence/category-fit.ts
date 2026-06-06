/**
 * Category fit snapshot contracts.
 * P7-S13.5 submodule: category-fit
 */
import {
	type ValidationResult,
	valid,
	invalid,
	validateNoForbiddenRawPayloads,
	validateOpaqueId,
	validateOpaqueRef,
	isRecord,
	refs,
	rejectUnknownProperties,
	validateTimestamp,
} from "./shared.js";

// ─── Interface ────────────────────────────────────────────────────────────────

export interface FlowDeskCategoryFitSnapshotV1 {
	schema_version: "flowdesk.category_fit_snapshot.v1";
	snapshot_id: string;
	workflow_id: string;
	task_signature_ref: string;
	category_signature_ref: string;
	sample_count: number;
	fitness_score: number;
	freshness_timestamp: string;
	evidence_refs: string[];
	safe_next_actions: string[];
	advisory_only: true;
	dispatch_authority_enabled: false;
	approval_authority_enabled: false;
	provider_authority_enabled: false;
	runtime_authority_enabled: false;
	fallback_authority_enabled: false;
	external_write_authority_enabled: false;
	remote_write_authority_enabled: false;
	lane_launch_authority_enabled: false;
	hard_chat_authority_enabled: false;
}

// ─── Creator ──────────────────────────────────────────────────────────────────

export function createFlowDeskCategoryFitSnapshotV1(input: {
	snapshotId: string;
	workflowId: string;
	taskSignatureRef: string;
	categorySignatureRef: string;
	sampleCount: number;
	fitnessScore: number;
	freshnessTimestamp: string;
	evidenceRefs: string[];
	safeNextActions: string[];
}): FlowDeskCategoryFitSnapshotV1 {
	return {
		schema_version: "flowdesk.category_fit_snapshot.v1",
		snapshot_id: input.snapshotId,
		workflow_id: input.workflowId,
		task_signature_ref: input.taskSignatureRef,
		category_signature_ref: input.categorySignatureRef,
		sample_count: input.sampleCount,
		fitness_score: input.fitnessScore,
		freshness_timestamp: input.freshnessTimestamp,
		evidence_refs: [...input.evidenceRefs],
		safe_next_actions: [...input.safeNextActions],
		advisory_only: true,
		dispatch_authority_enabled: false,
		approval_authority_enabled: false,
		provider_authority_enabled: false,
		runtime_authority_enabled: false,
		fallback_authority_enabled: false,
		external_write_authority_enabled: false,
		remote_write_authority_enabled: false,
		lane_launch_authority_enabled: false,
		hard_chat_authority_enabled: false,
	};
}

// ─── Validator ────────────────────────────────────────────────────────────────

export function validateFlowDeskCategoryFitSnapshotV1(value: unknown): ValidationResult {
	if (!isRecord(value)) return invalid("category fit snapshot must be an object");
	const record = value as Partial<FlowDeskCategoryFitSnapshotV1>;
	const errors: string[] = [];
	errors.push(...rejectUnknownProperties(record, [
		"schema_version",
		"snapshot_id",
		"workflow_id",
		"task_signature_ref",
		"category_signature_ref",
		"sample_count",
		"fitness_score",
		"freshness_timestamp",
		"evidence_refs",
		"safe_next_actions",
		"advisory_only",
		"dispatch_authority_enabled",
		"approval_authority_enabled",
		"provider_authority_enabled",
		"runtime_authority_enabled",
		"fallback_authority_enabled",
		"external_write_authority_enabled",
		"remote_write_authority_enabled",
		"lane_launch_authority_enabled",
		"hard_chat_authority_enabled",
	], "category fit snapshot").errors);
	if (record.schema_version !== "flowdesk.category_fit_snapshot.v1") errors.push("category fit snapshot schema_version is invalid");
	errors.push(...validateOpaqueId(record.snapshot_id, "snapshot_id").errors);
	errors.push(...validateOpaqueId(record.workflow_id, "workflow_id").errors);
	errors.push(...validateOpaqueRef(record.task_signature_ref, "task_signature_ref").errors);
	errors.push(...validateOpaqueRef(record.category_signature_ref, "category_signature_ref").errors);
	if (typeof record.sample_count !== "number" || !Number.isInteger(record.sample_count) || record.sample_count < 0) errors.push("sample_count must be a non-negative integer");
	if (typeof record.fitness_score !== "number" || !Number.isFinite(record.fitness_score) || record.fitness_score < 0 || record.fitness_score > 100) errors.push("fitness_score must be 0..100");
	errors.push(...validateTimestamp(record.freshness_timestamp, "freshness_timestamp").errors);
	errors.push(...refs(record.evidence_refs, "evidence_refs").errors);
	if (!Array.isArray(record.safe_next_actions) || record.safe_next_actions.length === 0 || record.safe_next_actions.length > 8) errors.push("safe_next_actions must be a non-empty bounded array");
	else for (const [index, action] of record.safe_next_actions.entries()) errors.push(...validateOpaqueRef(action, `safe_next_actions[${index}]`).errors);
	if (record.advisory_only !== true
		|| record.dispatch_authority_enabled !== false
		|| record.approval_authority_enabled !== false
		|| record.provider_authority_enabled !== false
		|| record.runtime_authority_enabled !== false
		|| record.fallback_authority_enabled !== false
		|| record.external_write_authority_enabled !== false
		|| record.remote_write_authority_enabled !== false
		|| record.lane_launch_authority_enabled !== false
		|| record.hard_chat_authority_enabled !== false) errors.push("category fit snapshot must remain advisory-only with no authority");
	errors.push(...validateNoForbiddenRawPayloads(record, "category_fit_snapshot").errors);
	return errors.length === 0 ? valid() : invalid(...errors);
}
