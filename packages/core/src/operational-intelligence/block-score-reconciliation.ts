/**
 * Block score reconciliation contracts.
 * Operational intelligence later gate – advisory-only, non-authorizing.
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
} from "./shared.js";

export type FlowDeskBlockScoreReconciliationActionV1 =
	| "accept_fresh"
	| "re_decompose"
	| "require_review"
	| "escalate_authority";

// ─── CONTRACT: FlowDeskBlockScoreReconciliationV1 ─────────────────────────────

export interface FlowDeskBlockScoreReconciliationV1 {
	schema_version: "flowdesk.block_score_reconciliation.v1";
	reconciliation_id: string;
	decomposition_ref: string;
	sub_block_id: string;
	fresh_scoring_ref: string;
	diverged_dimensions: string[];
	dimension_deltas: Record<string, number>;
	max_divergence: number;
	authority_sensitivity_increased: boolean;
	action_required: FlowDeskBlockScoreReconciliationActionV1;
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

const RECONCILIATION_ALLOWED = [
	"schema_version", "reconciliation_id", "decomposition_ref", "sub_block_id",
	"fresh_scoring_ref", "diverged_dimensions", "dimension_deltas",
	"max_divergence", "authority_sensitivity_increased", "action_required",
	"advisory_only", "non_authorizing", "release_gate",
	"dispatch_authority_enabled", "approval_authority_enabled",
	"provider_authority_enabled", "runtime_authority_enabled",
	"external_write_authority_enabled", "remote_write_authority_enabled",
	"fallback_authority_enabled", "lane_launch_authority_enabled",
	"write_authority_enabled", "hard_chat_authority_enabled",
	"model_selection_authority_enabled", "ranking_authority_enabled",
] as const;

const VALID_ACTIONS: readonly FlowDeskBlockScoreReconciliationActionV1[] = [
	"accept_fresh", "re_decompose", "require_review", "escalate_authority"
];

function deriveActionRequired(
	authoritySensitivityIncreased: boolean,
	maxDivergence: number
): FlowDeskBlockScoreReconciliationActionV1 {
	if (authoritySensitivityIncreased) return "escalate_authority";
	if (maxDivergence >= 5) return "escalate_authority";
	if (maxDivergence >= 3) return "require_review";
	return "accept_fresh";
}

export function validateFlowDeskBlockScoreReconciliationV1(value: unknown): ValidationResult {
	if (!isRecord(value)) return invalid("block score reconciliation must be an object");
	const record = value as Record<string, unknown>;
	const errors: string[] = [];

	errors.push(...rejectUnknownProperties(record, RECONCILIATION_ALLOWED, "block score reconciliation").errors);
	if (record.schema_version !== "flowdesk.block_score_reconciliation.v1")
		errors.push("schema_version must be flowdesk.block_score_reconciliation.v1");
	errors.push(...validateOpaqueId(record.reconciliation_id, "reconciliation_id").errors);
	errors.push(...validateOpaqueRef(record.decomposition_ref, "decomposition_ref").errors);
	errors.push(...validateOpaqueId(record.sub_block_id, "sub_block_id").errors);
	errors.push(...validateOpaqueRef(record.fresh_scoring_ref, "fresh_scoring_ref").errors);

	if (!Array.isArray(record.diverged_dimensions))
		errors.push("diverged_dimensions must be an array");

	if (!isRecord(record.dimension_deltas))
		errors.push("dimension_deltas must be an object");
	else {
		for (const [k, v] of Object.entries(record.dimension_deltas)) {
			if (typeof v !== "number" || !Number.isFinite(v))
				errors.push(`dimension_deltas.${k} must be a finite number`);
		}
	}

	if (typeof record.max_divergence !== "number" || !Number.isFinite(record.max_divergence))
		errors.push("max_divergence must be a finite number");

	if (typeof record.authority_sensitivity_increased !== "boolean")
		errors.push("authority_sensitivity_increased must be a boolean");

	if (typeof record.action_required !== "string" || !VALID_ACTIONS.includes(record.action_required as FlowDeskBlockScoreReconciliationActionV1))
		errors.push(`action_required must be one of: ${VALID_ACTIONS.join(", ")}`);

	// Validate derived action_required is consistent
	if (
		typeof record.authority_sensitivity_increased === "boolean" &&
		typeof record.max_divergence === "number" &&
		Number.isFinite(record.max_divergence) &&
		typeof record.action_required === "string"
	) {
		const expectedAction = deriveActionRequired(record.authority_sensitivity_increased, record.max_divergence);
		if (record.action_required !== expectedAction)
			errors.push(`action_required '${record.action_required}' is inconsistent with authority_sensitivity_increased=${record.authority_sensitivity_increased} and max_divergence=${record.max_divergence}; expected '${expectedAction}'`);
	}

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

	errors.push(...validateNoForbiddenRawPayloads(record, "block score reconciliation").errors);

	return errors.length === 0 ? valid() : invalid(...errors);
}

export type FlowDeskBlockScoreReconciliationV1Result = {
	ok: true;
	errors: [];
	reconciliation: FlowDeskBlockScoreReconciliationV1;
} | {
	ok: false;
	errors: string[];
	reconciliation: undefined;
};

export function createFlowDeskBlockScoreReconciliationV1(input: {
	reconciliationId: string;
	decompositionRef: string;
	subBlockId: string;
	freshScoringRef: string;
	divergedDimensions: string[];
	dimensionDeltas: Record<string, number>;
	authoritySensitivityIncreased: boolean;
}): FlowDeskBlockScoreReconciliationV1Result {
	const errors: string[] = [];

	const deltaValues = Object.values(input.dimensionDeltas);
	const maxDivergence = deltaValues.length > 0
		? Math.max(...deltaValues.map((v) => Math.abs(v)))
		: 0;

	if (errors.length > 0) return { ok: false, errors, reconciliation: undefined };

	const actionRequired = deriveActionRequired(input.authoritySensitivityIncreased, maxDivergence);

	const reconciliation: FlowDeskBlockScoreReconciliationV1 = {
		schema_version: "flowdesk.block_score_reconciliation.v1",
		reconciliation_id: input.reconciliationId,
		decomposition_ref: input.decompositionRef,
		sub_block_id: input.subBlockId,
		fresh_scoring_ref: input.freshScoringRef,
		diverged_dimensions: input.divergedDimensions,
		dimension_deltas: input.dimensionDeltas,
		max_divergence: maxDivergence,
		authority_sensitivity_increased: input.authoritySensitivityIncreased,
		action_required: actionRequired,
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

	return { ok: true, errors: [], reconciliation };
}
