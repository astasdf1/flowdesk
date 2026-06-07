/**
 * R3-S6: Routing advisory + ledger retention.
 * Pure read-side advisory logic only: no IO, no dispatch/model-selection authority.
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

export interface FlowDeskLedgerRetentionPolicyV1 {
	schema_version: "flowdesk.ledger_retention_policy.v1";
	max_score_age_days: number;
	max_ledger_entries_per_signature: number;
	prune_mode: "ttl_then_cap";
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
	model_selection_authority_enabled: false;
	ranking_authority_enabled: false;
}

export interface FlowDeskRoutingInfluencePolicyV1 {
	schema_version: "flowdesk.routing_influence_policy.v1";
	enabled: boolean;
	min_sample_threshold: number;
	tie_quota_delta_percent: 0;
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
	model_selection_authority_enabled: false;
	ranking_authority_enabled: false;
}

export interface FlowDeskRoutingAdvisoryModelSummaryV1 {
	model_ref: string;
	weighted_score: number;
	sample_count: number;
}

export interface FlowDeskRoutingAdvisoryEvaluationV1 {
	schema_version: "flowdesk.routing_advisory_evaluation.v1";
	evaluation_id: string;
	signature_ref: string;
	evaluated_at: string;
	model_summaries: FlowDeskRoutingAdvisoryModelSummaryV1[];
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
	model_selection_authority_enabled: false;
	ranking_authority_enabled: false;
}

export interface FlowDeskRoutingAdvisoryLedgerEntryV1 {
	signature_ref: string;
	model_ref: string;
	weighted_score: number;
	recorded_at: string;
}

const AUTHORITY_FLAGS = {
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
	model_selection_authority_enabled: false,
	ranking_authority_enabled: false,
} as const;

export function createFlowDeskLedgerRetentionPolicyV1(input: Partial<Pick<FlowDeskLedgerRetentionPolicyV1, "max_score_age_days" | "max_ledger_entries_per_signature">> = {}): FlowDeskLedgerRetentionPolicyV1 {
	return {
		schema_version: "flowdesk.ledger_retention_policy.v1",
		max_score_age_days: input.max_score_age_days ?? 14,
		max_ledger_entries_per_signature: input.max_ledger_entries_per_signature ?? 20,
		prune_mode: "ttl_then_cap",
		...AUTHORITY_FLAGS,
	};
}

export function createFlowDeskRoutingInfluencePolicyV1(input: { enabled: boolean; min_sample_threshold?: number }): FlowDeskRoutingInfluencePolicyV1 {
	return {
		schema_version: "flowdesk.routing_influence_policy.v1",
		enabled: input.enabled,
		min_sample_threshold: input.min_sample_threshold ?? 5,
		tie_quota_delta_percent: 0,
		...AUTHORITY_FLAGS,
	};
}

export function evaluateOIRoutingAdvisoryV1(
	entries: readonly FlowDeskRoutingAdvisoryLedgerEntryV1[],
	signature: string,
	retentionPolicy: FlowDeskLedgerRetentionPolicyV1 = createFlowDeskLedgerRetentionPolicyV1(),
	_influencePolicy: FlowDeskRoutingInfluencePolicyV1 = createFlowDeskRoutingInfluencePolicyV1({ enabled: false }),
	evaluatedAt: string,
): FlowDeskRoutingAdvisoryEvaluationV1 {
	const evaluatedAtMs = Date.parse(evaluatedAt);
	const maxAgeMs = retentionPolicy.max_score_age_days * 24 * 60 * 60 * 1000;
	const retained = entries
		.filter((entry) => entry.signature_ref === signature)
		.filter((entry) => Number.isFinite(Date.parse(entry.recorded_at)) && evaluatedAtMs - Date.parse(entry.recorded_at) <= maxAgeMs)
		.sort((a, b) => Date.parse(b.recorded_at) - Date.parse(a.recorded_at))
		.slice(0, retentionPolicy.max_ledger_entries_per_signature);

	const byModel = new Map<string, { total: number; count: number }>();
	for (const entry of retained) {
		const score = Math.max(0, Math.min(1, entry.weighted_score));
		const current = byModel.get(entry.model_ref) ?? { total: 0, count: 0 };
		current.total += score;
		current.count += 1;
		byModel.set(entry.model_ref, current);
	}

	const modelSummaries = [...byModel.entries()]
		.map(([model_ref, aggregate]) => ({
			model_ref,
			weighted_score: aggregate.count === 0 ? 0 : aggregate.total / aggregate.count,
			sample_count: aggregate.count,
		}))
		.sort((a, b) => a.model_ref.localeCompare(b.model_ref));

	return {
		schema_version: "flowdesk.routing_advisory_evaluation.v1",
		evaluation_id: `routing-advisory-${signature}-${evaluatedAt}`.replace(/[^A-Za-z0-9_.:-]/g, "-"),
		signature_ref: signature,
		evaluated_at: evaluatedAt,
		model_summaries: modelSummaries,
		...AUTHORITY_FLAGS,
	};
}

const POLICY_ALLOWED = ["schema_version", "max_score_age_days", "max_ledger_entries_per_signature", "prune_mode", ...Object.keys(AUTHORITY_FLAGS)] as const;
const INFLUENCE_ALLOWED = ["schema_version", "enabled", "min_sample_threshold", "tie_quota_delta_percent", ...Object.keys(AUTHORITY_FLAGS)] as const;
const EVALUATION_ALLOWED = ["schema_version", "evaluation_id", "signature_ref", "evaluated_at", "model_summaries", ...Object.keys(AUTHORITY_FLAGS)] as const;

function validateAuthorityFlags(record: Record<string, unknown>, label: string): string[] {
	const errors: string[] = [];
	for (const [key, expected] of Object.entries(AUTHORITY_FLAGS)) if (record[key] !== expected) errors.push(`${label}.${key} must be ${String(expected)}`);
	return errors;
}

export function validateFlowDeskLedgerRetentionPolicyV1(value: unknown): ValidationResult {
	if (!isRecord(value)) return invalid("ledger retention policy must be an object");
	const record = value as Record<string, unknown>;
	const errors: string[] = [];
	errors.push(...rejectUnknownProperties(record, POLICY_ALLOWED, "ledger retention policy").errors);
	if (record.schema_version !== "flowdesk.ledger_retention_policy.v1") errors.push("invalid schema_version");
	if (!Number.isInteger(record.max_score_age_days) || (record.max_score_age_days as number) < 1) errors.push("max_score_age_days must be a positive integer");
	if (!Number.isInteger(record.max_ledger_entries_per_signature) || (record.max_ledger_entries_per_signature as number) < 1) errors.push("max_ledger_entries_per_signature must be a positive integer");
	if (record.prune_mode !== "ttl_then_cap") errors.push("prune_mode must be ttl_then_cap");
	errors.push(...validateAuthorityFlags(record, "ledger retention policy"));
	errors.push(...validateNoForbiddenRawPayloads(record, "ledger retention policy").errors);
	return errors.length === 0 ? valid() : invalid(...errors);
}

export function validateFlowDeskRoutingInfluencePolicyV1(value: unknown): ValidationResult {
	if (!isRecord(value)) return invalid("routing influence policy must be an object");
	const record = value as Record<string, unknown>;
	const errors: string[] = [];
	errors.push(...rejectUnknownProperties(record, INFLUENCE_ALLOWED, "routing influence policy").errors);
	if (record.schema_version !== "flowdesk.routing_influence_policy.v1") errors.push("invalid schema_version");
	if (typeof record.enabled !== "boolean") errors.push("enabled must be a boolean");
	if (!Number.isInteger(record.min_sample_threshold) || (record.min_sample_threshold as number) < 1) errors.push("min_sample_threshold must be a positive integer");
	if (record.tie_quota_delta_percent !== 0) errors.push("tie_quota_delta_percent must be 0");
	errors.push(...validateAuthorityFlags(record, "routing influence policy"));
	errors.push(...validateNoForbiddenRawPayloads(record, "routing influence policy").errors);
	return errors.length === 0 ? valid() : invalid(...errors);
}

export function validateFlowDeskRoutingAdvisoryEvaluationV1(value: unknown): ValidationResult {
	if (!isRecord(value)) return invalid("routing advisory evaluation must be an object");
	const record = value as Record<string, unknown>;
	const errors: string[] = [];
	errors.push(...rejectUnknownProperties(record, EVALUATION_ALLOWED, "routing advisory evaluation").errors);
	if (record.schema_version !== "flowdesk.routing_advisory_evaluation.v1") errors.push("invalid schema_version");
	errors.push(...validateOpaqueId(record.evaluation_id, "evaluation_id").errors);
	errors.push(...validateOpaqueRef(record.signature_ref, "signature_ref").errors);
	errors.push(...validateTimestamp(record.evaluated_at, "evaluated_at").errors);
	if (!Array.isArray(record.model_summaries)) errors.push("model_summaries must be an array");
	else for (const [index, summary] of record.model_summaries.entries()) {
		if (!isRecord(summary)) errors.push(`model_summaries[${index}] must be an object`);
		else {
			const summaryRecord = summary as Record<string, unknown>;
			errors.push(...validateOpaqueRef(summaryRecord.model_ref, `model_summaries[${index}].model_ref`).errors);
			if (typeof summaryRecord.weighted_score !== "number" || summaryRecord.weighted_score < 0 || summaryRecord.weighted_score > 1) errors.push(`model_summaries[${index}].weighted_score must be 0..1`);
			if (!Number.isInteger(summaryRecord.sample_count) || typeof summaryRecord.sample_count !== "number" || summaryRecord.sample_count < 0) errors.push(`model_summaries[${index}].sample_count must be a non-negative integer`);
		}
	}
	errors.push(...validateAuthorityFlags(record, "routing advisory evaluation"));
	errors.push(...validateNoForbiddenRawPayloads(record, "routing advisory evaluation").errors);
	return errors.length === 0 ? valid() : invalid(...errors);
}
