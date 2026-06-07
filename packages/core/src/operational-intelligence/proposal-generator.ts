/**
 * Proposal generator function for R3-S2.
 * Bridges FlowDeskProposalGeneratorConfigV1 → FlowDeskWorkflowPlanProposalSetV1.
 * This is a PLANNING function — it does not make provider calls.
 * It creates a FlowDeskWorkflowPlanProposalSetV1 with placeholder proposal
 * structures that the downstream execution engine will populate.
 *
 * Does NOT make provider calls. Does NOT authorize dispatch.
 */

import type { FlowDeskProposalGeneratorConfigV1 } from "./proposal-generator-config.js";
import {
	createFlowDeskWorkflowPlanProposalV1,
	createFlowDeskWorkflowPlanProposalSetV1,
	validateFlowDeskWorkflowPlanProposalSetV1,
	type FlowDeskWorkflowPlanProposalSetV1,
} from "./proposals.js";

export interface FlowDeskProposalGenerationInputV1 {
	config: FlowDeskProposalGeneratorConfigV1;
	workflowId: string;
	blockScoringRef: string;    // OpaqueRef to FlowDeskTaskBlockScoringV1
	proposalSetId: string;      // OpaqueId for the new set
	createdAt: string;           // ISO timestamp
}

export interface FlowDeskProposalGenerationResultV1 {
	ok: boolean;
	errors: string[];
	proposalSet?: FlowDeskWorkflowPlanProposalSetV1;
}

/**
 * Creates a FlowDeskWorkflowPlanProposalSetV1 planning record from a
 * FlowDeskProposalGeneratorConfigV1. This is advisory-only — it creates
 * the structural placeholder for four variants (simple/standard/detailed/
 * high_assurance) that will be populated by execution lanes.
 *
 * Does NOT make provider calls. Does NOT authorize dispatch.
 */
export function planFlowDeskWorkflowPlanProposalSetV1(
	input: FlowDeskProposalGenerationInputV1,
): FlowDeskProposalGenerationResultV1 {
	const errors: string[] = [];

	// Validate config is present and has the right schema
	if (
		!input.config ||
		input.config.schema_version !== "flowdesk.proposal_generator_config.v1"
	) {
		errors.push("config must be a valid FlowDeskProposalGeneratorConfigV1");
	}
	if (!input.workflowId) errors.push("workflowId is required");
	if (!input.blockScoringRef) errors.push("blockScoringRef is required");
	if (!input.proposalSetId) errors.push("proposalSetId is required");
	if (!input.createdAt) errors.push("createdAt is required");

	if (errors.length > 0) return { ok: false, errors };

	// Map review tier + cost hint to candidate evidence ref
	const tierToEvidenceRef = (tier: string) =>
		`evidence-${tier}-${input.proposalSetId}`;

	// Create four variants using createFlowDeskWorkflowPlanProposalV1
	const variants = ["simple", "standard", "detailed", "high_assurance"] as const;
	const proposals = variants.map((variant) =>
		createFlowDeskWorkflowPlanProposalV1({
			proposalId: `proposal-${variant}-${input.proposalSetId}`,
			workflowId: input.workflowId,
			proposalLabel: `${variant}-placeholder`,
			advisorySummaryRef: `summary-${variant}-${input.proposalSetId}`,
			candidates: [
				{
					candidateRef: input.config.proposal_model_selection_ref,
					candidateLabel: `${variant}-candidate`,
					candidateSummaryRef: `summary-${variant}-${input.proposalSetId}`,
					hardFiltersPassed: true,
				},
			],
			provenanceRefs: [
				input.blockScoringRef,
				tierToEvidenceRef(input.config.review_tier),
			],
			variant,
		}),
	);

	const [simple, standard, detailed, highAssurance] = proposals;

	const proposalSet = createFlowDeskWorkflowPlanProposalSetV1({
		proposalSetId: input.proposalSetId,
		workflowId: input.workflowId,
		createdAt: input.createdAt,
		simpleProposal: simple,
		standardProposal: standard,
		detailedProposal: detailed,
		highAssuranceProposal: highAssurance,
		metadataRefs: [input.config.config_id],
		evidenceRefs: [input.blockScoringRef],
	});

	// Validate the constructed set
	const validation = validateFlowDeskWorkflowPlanProposalSetV1(proposalSet);
	if (!validation.ok) {
		return { ok: false, errors: validation.errors };
	}

	return { ok: true, errors: [], proposalSet };
}
