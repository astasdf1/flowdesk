/**
 * Proposal generator configuration contracts.
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

export type FlowDeskProposalReviewTierV1 = "single" | "dual" | "triple";
export type FlowDeskProposalCostBudgetHintV1 = "minimal" | "moderate" | "thorough";
export type FlowDeskProposalGenerationStrategyV1 = "parallel" | "sequential";

// ─── CONTRACT: FlowDeskProposalGeneratorConfigV1 ──────────────────────────────

export interface FlowDeskProposalGeneratorConfigV1 {
	schema_version: "flowdesk.proposal_generator_config.v1";
	config_id: string;
	block_id: string;
	block_scoring_ref: string;
	workflow_id: string;
	decomposition_ref?: string;
	is_sub_block: boolean;
	decompose_threshold_met: boolean;
	decompose_trigger_arm?: string;
	review_tier: FlowDeskProposalReviewTierV1;
	review_tier_basis: string;
	cost_budget_hint: FlowDeskProposalCostBudgetHintV1;
	generation_strategy: FlowDeskProposalGenerationStrategyV1;
	proposal_model_selection_ref: string;
	proposal_set_ref?: string;
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

const CONFIG_ALLOWED = [
	"schema_version", "config_id", "block_id", "block_scoring_ref", "workflow_id",
	"decomposition_ref", "is_sub_block", "decompose_threshold_met",
	"decompose_trigger_arm", "review_tier", "review_tier_basis",
	"cost_budget_hint", "generation_strategy",
	"proposal_model_selection_ref", "proposal_set_ref",
	"advisory_only", "non_authorizing", "release_gate",
	"dispatch_authority_enabled", "approval_authority_enabled",
	"provider_authority_enabled", "runtime_authority_enabled",
	"external_write_authority_enabled", "remote_write_authority_enabled",
	"fallback_authority_enabled", "lane_launch_authority_enabled",
	"write_authority_enabled", "hard_chat_authority_enabled",
	"model_selection_authority_enabled", "ranking_authority_enabled",
] as const;

const VALID_REVIEW_TIERS: readonly FlowDeskProposalReviewTierV1[] = ["single", "dual", "triple"];
const VALID_COST_HINTS: readonly FlowDeskProposalCostBudgetHintV1[] = ["minimal", "moderate", "thorough"];
const VALID_STRATEGIES: readonly FlowDeskProposalGenerationStrategyV1[] = ["parallel", "sequential"];

export function validateFlowDeskProposalGeneratorConfigV1(value: unknown): ValidationResult {
	if (!isRecord(value)) return invalid("proposal generator config must be an object");
	const record = value as Record<string, unknown>;
	const errors: string[] = [];

	errors.push(...rejectUnknownProperties(record, CONFIG_ALLOWED, "proposal generator config").errors);
	if (record.schema_version !== "flowdesk.proposal_generator_config.v1")
		errors.push("schema_version must be flowdesk.proposal_generator_config.v1");

	errors.push(...validateOpaqueId(record.config_id, "config_id").errors);
	errors.push(...validateOpaqueId(record.block_id, "block_id").errors);
	errors.push(...validateOpaqueRef(record.block_scoring_ref, "block_scoring_ref").errors);
	errors.push(...validateOpaqueId(record.workflow_id, "workflow_id").errors);

	if (record.decomposition_ref !== undefined)
		errors.push(...validateOpaqueRef(record.decomposition_ref, "decomposition_ref").errors);

	if (typeof record.is_sub_block !== "boolean")
		errors.push("is_sub_block must be a boolean");

	if (typeof record.decompose_threshold_met !== "boolean")
		errors.push("decompose_threshold_met must be a boolean");

	if (record.decompose_trigger_arm !== undefined) {
		if (typeof record.decompose_trigger_arm !== "string" || record.decompose_trigger_arm.length === 0)
			errors.push("decompose_trigger_arm must be a non-empty string when present");
	}

	if (typeof record.review_tier !== "string" || !VALID_REVIEW_TIERS.includes(record.review_tier as FlowDeskProposalReviewTierV1))
		errors.push(`review_tier must be one of: ${VALID_REVIEW_TIERS.join(", ")}`);

	if (typeof record.review_tier_basis !== "string" || record.review_tier_basis.length === 0)
		errors.push("review_tier_basis must be a non-empty string");

	if (typeof record.cost_budget_hint !== "string" || !VALID_COST_HINTS.includes(record.cost_budget_hint as FlowDeskProposalCostBudgetHintV1))
		errors.push(`cost_budget_hint must be one of: ${VALID_COST_HINTS.join(", ")}`);

	if (typeof record.generation_strategy !== "string" || !VALID_STRATEGIES.includes(record.generation_strategy as FlowDeskProposalGenerationStrategyV1))
		errors.push(`generation_strategy must be one of: ${VALID_STRATEGIES.join(", ")}`);

	errors.push(...validateOpaqueRef(record.proposal_model_selection_ref, "proposal_model_selection_ref").errors);

	if (record.proposal_set_ref !== undefined)
		errors.push(...validateOpaqueRef(record.proposal_set_ref, "proposal_set_ref").errors);

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

	errors.push(...validateNoForbiddenRawPayloads(record, "proposal generator config").errors);

	return errors.length === 0 ? valid() : invalid(...errors);
}

export type FlowDeskProposalGeneratorConfigV1Result = {
	ok: true;
	errors: [];
	config: FlowDeskProposalGeneratorConfigV1;
} | {
	ok: false;
	errors: string[];
	config: undefined;
};

export function createFlowDeskProposalGeneratorConfigV1(input: {
	configId: string;
	blockId: string;
	blockScoringRef: string;
	workflowId: string;
	decompositionRef?: string;
	isSubBlock: boolean;
	decomposeThresholdMet: boolean;
	decomposeTriggerArm?: string;
	reviewTier: FlowDeskProposalReviewTierV1;
	reviewTierBasis: string;
	costBudgetHint: FlowDeskProposalCostBudgetHintV1;
	generationStrategy: FlowDeskProposalGenerationStrategyV1;
	proposalModelSelectionRef: string;
	proposalSetRef?: string;
}): FlowDeskProposalGeneratorConfigV1Result {
	const errors: string[] = [];

	if (!VALID_REVIEW_TIERS.includes(input.reviewTier))
		errors.push(`review_tier must be one of: ${VALID_REVIEW_TIERS.join(", ")}`);
	if (!VALID_COST_HINTS.includes(input.costBudgetHint))
		errors.push(`cost_budget_hint must be one of: ${VALID_COST_HINTS.join(", ")}`);
	if (!VALID_STRATEGIES.includes(input.generationStrategy))
		errors.push(`generation_strategy must be one of: ${VALID_STRATEGIES.join(", ")}`);

	if (errors.length > 0) return { ok: false, errors, config: undefined };

	const config: FlowDeskProposalGeneratorConfigV1 = {
		schema_version: "flowdesk.proposal_generator_config.v1",
		config_id: input.configId,
		block_id: input.blockId,
		block_scoring_ref: input.blockScoringRef,
		workflow_id: input.workflowId,
		...(input.decompositionRef !== undefined ? { decomposition_ref: input.decompositionRef } : {}),
		is_sub_block: input.isSubBlock,
		decompose_threshold_met: input.decomposeThresholdMet,
		...(input.decomposeTriggerArm !== undefined ? { decompose_trigger_arm: input.decomposeTriggerArm } : {}),
		review_tier: input.reviewTier,
		review_tier_basis: input.reviewTierBasis,
		cost_budget_hint: input.costBudgetHint,
		generation_strategy: input.generationStrategy,
		proposal_model_selection_ref: input.proposalModelSelectionRef,
		...(input.proposalSetRef !== undefined ? { proposal_set_ref: input.proposalSetRef } : {}),
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

	return { ok: true, errors: [], config };
}
