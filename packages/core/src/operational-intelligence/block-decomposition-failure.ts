/**
 * Block decomposition failure contracts.
 * Operational intelligence later gate – advisory-only, non-authorizing.
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

export type FlowDeskBlockDecompositionFailureReasonV1 =
	| "model_error"
	| "validator_rejected"
	| "coverage_review_failed"
	| "depth_cap_exceeded"
	| "budget_exhausted"
	| "orchestration_error";

// ─── CONTRACT: FlowDeskBlockDecompositionFailureV1 ────────────────────────────

export interface FlowDeskBlockDecompositionFailureV1 {
	schema_version: "flowdesk.block_decomposition_failure.v1";
	failure_id: string;
	decomposition_attempt_id: string;         // MUST be distinct from parent attempt_id
	parent_block_scoring_ref: string;
	partial_decomposition_ref?: string;
	failure_reason: FlowDeskBlockDecompositionFailureReasonV1;
	failure_detail_ref?: string;
	failed_at: string;                        // ISO timestamp
	retry_allowed: boolean;
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
	model_selection_authority_enabled: false;
	ranking_authority_enabled: false;
}

const FAILURE_ALLOWED = [
	"schema_version", "failure_id", "decomposition_attempt_id",
	"parent_block_scoring_ref", "partial_decomposition_ref",
	"failure_reason", "failure_detail_ref", "failed_at", "retry_allowed",
	"advisory_only", "non_authorizing", "release_gate",
	"dispatch_authority_enabled", "approval_authority_enabled",
	"provider_authority_enabled", "runtime_authority_enabled",
	"external_write_authority_enabled", "remote_write_authority_enabled",
	"fallback_authority_enabled", "lane_launch_authority_enabled",
	"write_authority_enabled", "hard_chat_authority_enabled",
	"model_selection_authority_enabled", "ranking_authority_enabled",
] as const;

const VALID_FAILURE_REASONS: readonly FlowDeskBlockDecompositionFailureReasonV1[] = [
	"model_error",
	"validator_rejected",
	"coverage_review_failed",
	"depth_cap_exceeded",
	"budget_exhausted",
	"orchestration_error",
];

export function validateFlowDeskBlockDecompositionFailureV1(value: unknown): ValidationResult {
	if (!isRecord(value)) return invalid("block decomposition failure must be an object");
	const record = value as Record<string, unknown>;
	const errors: string[] = [];

	errors.push(...rejectUnknownProperties(record, FAILURE_ALLOWED, "block decomposition failure").errors);
	if (record.schema_version !== "flowdesk.block_decomposition_failure.v1")
		errors.push("schema_version must be flowdesk.block_decomposition_failure.v1");

	errors.push(...validateOpaqueId(record.failure_id, "failure_id").errors);
	errors.push(...validateOpaqueId(record.decomposition_attempt_id, "decomposition_attempt_id").errors);

	// decomposition_attempt_id MUST be distinct from failure_id (as proxy for parent attempt_id check)
	if (
		typeof record.failure_id === "string" &&
		typeof record.decomposition_attempt_id === "string" &&
		record.failure_id === record.decomposition_attempt_id
	) {
		errors.push("decomposition_attempt_id must be distinct from failure_id");
	}

	errors.push(...validateOpaqueRef(record.parent_block_scoring_ref, "parent_block_scoring_ref").errors);

	if (record.partial_decomposition_ref !== undefined)
		errors.push(...validateOpaqueRef(record.partial_decomposition_ref, "partial_decomposition_ref").errors);

	if (
		typeof record.failure_reason !== "string" ||
		!VALID_FAILURE_REASONS.includes(record.failure_reason as FlowDeskBlockDecompositionFailureReasonV1)
	)
		errors.push(`failure_reason must be one of: ${VALID_FAILURE_REASONS.join(", ")}`);

	if (record.failure_detail_ref !== undefined)
		errors.push(...validateOpaqueRef(record.failure_detail_ref, "failure_detail_ref").errors);

	errors.push(...validateTimestamp(record.failed_at, "failed_at").errors);

	if (typeof record.retry_allowed !== "boolean")
		errors.push("retry_allowed must be a boolean");

	// Authority flags
	if (record.advisory_only !== true) errors.push("advisory_only must be true");
	if (record.non_authorizing !== true) errors.push("non_authorizing must be true");
	if (record.release_gate !== "operational_intelligence_later_gate") errors.push("release_gate must be operational_intelligence_later_gate");
	if (record.dispatch_authority_enabled !== false) errors.push("dispatch_authority_enabled must be false");
	if (record.approval_authority_enabled !== false) errors.push("approval_authority_enabled must be false");
	if (record.provider_authority_enabled !== false) errors.push("provider_authority_enabled must be false");
	if (record.runtime_authority_enabled !== false) errors.push("runtime_authority_enabled must be false");
	if (record.external_write_authority_enabled !== false) errors.push("external_write_authority_enabled must be false");
	if (record.remote_write_authority_enabled !== false) errors.push("remote_write_authority_enabled must be false");
	if (record.fallback_authority_enabled !== false) errors.push("fallback_authority_enabled must be false");
	if (record.lane_launch_authority_enabled !== false) errors.push("lane_launch_authority_enabled must be false");
	if (record.write_authority_enabled !== false) errors.push("write_authority_enabled must be false");
	if (record.hard_chat_authority_enabled !== false) errors.push("hard_chat_authority_enabled must be false");
	if (record.model_selection_authority_enabled !== false) errors.push("model_selection_authority_enabled must be false");
	if (record.ranking_authority_enabled !== false) errors.push("ranking_authority_enabled must be false");

	errors.push(...validateNoForbiddenRawPayloads(record, "block decomposition failure").errors);

	return errors.length === 0 ? valid() : invalid(...errors);
}

export type FlowDeskBlockDecompositionFailureV1Result = {
	ok: true;
	errors: [];
	failure: FlowDeskBlockDecompositionFailureV1;
} | {
	ok: false;
	errors: string[];
	failure: undefined;
};

export function createFlowDeskBlockDecompositionFailureV1(input: {
	failureId: string;
	decompositionAttemptId: string;
	parentBlockScoringRef: string;
	partialDecompositionRef?: string;
	failureReason: FlowDeskBlockDecompositionFailureReasonV1;
	failureDetailRef?: string;
	failedAt: string;
	retryAllowed: boolean;
}): FlowDeskBlockDecompositionFailureV1Result {
	const errors: string[] = [];

	if (input.failureId === input.decompositionAttemptId)
		errors.push("decomposition_attempt_id must be distinct from failure_id");

	if (errors.length > 0) return { ok: false, errors, failure: undefined };

	const failure: FlowDeskBlockDecompositionFailureV1 = {
		schema_version: "flowdesk.block_decomposition_failure.v1",
		failure_id: input.failureId,
		decomposition_attempt_id: input.decompositionAttemptId,
		parent_block_scoring_ref: input.parentBlockScoringRef,
		...(input.partialDecompositionRef !== undefined ? { partial_decomposition_ref: input.partialDecompositionRef } : {}),
		failure_reason: input.failureReason,
		...(input.failureDetailRef !== undefined ? { failure_detail_ref: input.failureDetailRef } : {}),
		failed_at: input.failedAt,
		retry_allowed: input.retryAllowed,
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
		model_selection_authority_enabled: false,
		ranking_authority_enabled: false,
	};

	return { ok: true, errors: [], failure };
}
