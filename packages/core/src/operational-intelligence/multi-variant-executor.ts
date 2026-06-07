/**
 * Multi-Variant Executor — R3-S4.
 *
 * executeMultiVariantTestV1() is a pure function (NO IO, NO writes) that
 * runs a 4-variant advisory scoring fanout against a proposal set using
 * an already-reserved R3 fanout reservation.
 *
 * Release gate: operational_intelligence_later_gate
 * Advisory-only, non-authorizing.  No dispatch, provider, runtime, lane-launch,
 * fallback, write, or hard-chat authority is granted.
 */
import { randomUUID } from "node:crypto";
import type { FlowDeskWorkflowPlanProposalSetV1 } from "./proposals.js";
import type { FlowDeskR3FanoutReservationV1 } from "./admission.js";
import { createFlowDeskAdvisoryVariantResultV1 } from "./admission.js";
import type { FlowDeskAdvisoryVariantResultV1 } from "./admission.js";
import { scoreWorkflowProposal } from "./scoring-engine.js";
import type { FlowDeskScoringEngineInputV1 } from "./scoring-engine.js";
import { createFlowDeskR3ReservationLifecycleEventV1 } from "./r3-reservation-lifecycle-event.js";
import type { FlowDeskR3ReservationLifecycleEventV1 } from "./r3-reservation-lifecycle-event.js";
import type { FlowDeskWorkflowSignatureIndexEntryV1 } from "./score-reference.js";
import { createFlowDeskWorkflowSignatureIndexEntryV1 } from "./score-reference.js";
import type { FlowDeskBlockScoreReconciliationV1 } from "./block-score-reconciliation.js";

// ─── Variant label types ──────────────────────────────────────────────────────

export type VariantLabel = "simple" | "standard" | "detailed" | "high_assurance";

// ─── Per-variant score summary ────────────────────────────────────────────────

export interface PerVariantScoreSummary {
	variant_label: VariantLabel;
	raw_score: number;
	normalized_score: number;
	rank: 1 | 2 | 3 | 4;
}

// ─── Multi-variant aggregation contract ──────────────────────────────────────

/**
 * Advisory-only aggregation of scores across 4 variants for a single model.
 * Never grants dispatch, provider, runtime, or any other authority.
 */
export interface FlowDeskMultiVariantAggregationV1 {
	schema_version: "flowdesk.multi_variant_aggregation.v1";
	aggregation_id: string;
	source_variant_result_refs: string[];
	per_variant_scores: Record<VariantLabel, PerVariantScoreSummary>;
	best_variant_label: VariantLabel;
	best_variant_normalized_score: number;
	mean_normalized_score: number;
	score_spread: number;
	aggregation_strategy: "single_model_multi_variant";
	model_profile_ref: string;
	aggregated_at: string;
	advisory_only: true;
	non_authorizing: true;
	dispatch_authority_enabled: false;
}

// ─── Execution result contract ────────────────────────────────────────────────

export interface ExecuteMultiVariantTestV1Result {
	execution_id: string;
	schema_version: "flowdesk.multi_variant_test_result.v1";
	variantResults: FlowDeskAdvisoryVariantResultV1[];
	reconciliations: FlowDeskBlockScoreReconciliationV1[];
	aggregation: FlowDeskMultiVariantAggregationV1;
	lifecycleEvent: FlowDeskR3ReservationLifecycleEventV1;
	signatureIndexUpdate: FlowDeskWorkflowSignatureIndexEntryV1;
	errors: Array<{ code: string; variant_label?: VariantLabel; message: string; fatal: boolean }>;
	advisory_only: true;
}

// ─── Input contract ───────────────────────────────────────────────────────────

export interface ExecuteMultiVariantTestV1Input {
	/** Must be "multi_variant_single_model" */
	execution_mode: string;
	/** The workflow id for this execution */
	workflow_id: string;
	/** The attempt id for this execution */
	attempt_id: string;
	/** Workflow signature ref (opaque ref) */
	workflow_signature_ref: string;
	/** Admission decision ref (opaque ref) */
	admission_decision_ref: string;
	/** The reservation from the R3 admission gate; must have status "reserved" */
	reservation: FlowDeskR3FanoutReservationV1;
	/** The proposal set with all four variant proposals */
	proposalSet: FlowDeskWorkflowPlanProposalSetV1;
	/** Model profile ref to use for all variants */
	model_profile_ref: string;
	/** Provider family for scoring (e.g. "claude", "openai", "gemini") */
	provider_family: string;
	/** Agent role for scoring */
	agent_role: string;
	/** Optional scoring engine inputs (usage / alert level etc.) */
	scoring_input_overrides?: Partial<Pick<
		FlowDeskScoringEngineInputV1,
		"usageRemainingPercent" | "alertLevel" | "resetBucketSeconds" | "activeConurrentLanes" | "maxConcurrentLanes" | "requestedLaneCount" | "contextWindowTokens"
	>>;
	/** ISO timestamp when execution began */
	executed_at?: string;
}

// ─── Sentinel (fatal-error) result ───────────────────────────────────────────

function fatalSentinel(
	execution_id: string,
	errors: Array<{ code: string; variant_label?: VariantLabel; message: string; fatal: boolean }>,
): ExecuteMultiVariantTestV1Result {
	// Return a minimal valid-shell result with the fatal errors.
	// Aggregation, lifecycleEvent, and signatureIndexUpdate are left as
	// empty/placeholder objects — callers must check errors[].fatal before use.
	const placeholderAggregation: FlowDeskMultiVariantAggregationV1 = {
		schema_version: "flowdesk.multi_variant_aggregation.v1",
		aggregation_id: `agg-fatal-${execution_id}`,
		source_variant_result_refs: [],
		per_variant_scores: {} as Record<VariantLabel, PerVariantScoreSummary>,
		best_variant_label: "simple",
		best_variant_normalized_score: 0,
		mean_normalized_score: 0,
		score_spread: 0,
		aggregation_strategy: "single_model_multi_variant",
		model_profile_ref: "model-ref-unknown",
		aggregated_at: new Date().toISOString(),
		advisory_only: true,
		non_authorizing: true,
		dispatch_authority_enabled: false,
	};

	return {
		execution_id,
		schema_version: "flowdesk.multi_variant_test_result.v1",
		variantResults: [],
		reconciliations: [],
		aggregation: placeholderAggregation,
		// Placeholder lifecycle event - callers must not rely on this when fatal
		lifecycleEvent: {} as FlowDeskR3ReservationLifecycleEventV1,
		// Placeholder signature index - callers must not rely on this when fatal
		signatureIndexUpdate: {} as FlowDeskWorkflowSignatureIndexEntryV1,
		errors,
		advisory_only: true,
	};
}

// ─── Internal helper: clamp score ────────────────────────────────────────────

function clampScore(score: number): number {
	return Math.max(0, Math.min(100, score));
}

// ─── Variant label → proposal key map ────────────────────────────────────────

const VARIANT_ORDER: VariantLabel[] = ["simple", "standard", "detailed", "high_assurance"];

function getProposalForVariant(
	proposalSet: FlowDeskWorkflowPlanProposalSetV1,
	label: VariantLabel,
) {
	switch (label) {
		case "simple": return proposalSet.simple_proposal;
		case "standard": return proposalSet.standard_proposal;
		case "detailed": return proposalSet.detailed_proposal;
		case "high_assurance": return proposalSet.high_assurance_proposal;
	}
}

// ─── Main executor function ───────────────────────────────────────────────────

/**
 * executeMultiVariantTestV1 — pure advisory multi-variant scoring executor.
 *
 * Steps:
 * 1. Validate inputs: execution_mode and reservation.status.
 * 2. For each of 4 variants: score, clamp, build advisory variant result.
 * 3. If < 2 variants scored successfully → fatal error, return sentinel.
 * 4. Build aggregation: rank by normalized score desc, compute mean and spread.
 * 5. Create lifecycle event: reserved → consumed.
 * 6. Create signature index update pointing at best variant result.
 * 7. Return all records (caller persists).
 *
 * Advisory-only, non-authorizing.  Never throws; returns ok=false-style errors
 * in the returned errors array.
 */
export function executeMultiVariantTestV1(
	input: ExecuteMultiVariantTestV1Input,
): ExecuteMultiVariantTestV1Result {
	const execution_id = randomUUID();
	const executedAt = input.executed_at ?? new Date().toISOString();

	// ── Step 1: Input validation ───────────────────────────────────────────────

	if (input.execution_mode !== "multi_variant_single_model") {
		return fatalSentinel(execution_id, [{
			code: "INVALID_EXECUTION_MODE",
			message: `execution_mode must be 'multi_variant_single_model', got '${input.execution_mode}'`,
			fatal: true,
		}]);
	}

	if (input.reservation.status !== "reserved") {
		return fatalSentinel(execution_id, [{
			code: "RESERVATION_NOT_RESERVED",
			message: `reservation.status must be 'reserved', got '${input.reservation.status}'`,
			fatal: true,
		}]);
	}

	// ── Step 2: Score each of the 4 variants ──────────────────────────────────

	const variantResults: FlowDeskAdvisoryVariantResultV1[] = [];
	const perVariantScoresMap: Partial<Record<VariantLabel, PerVariantScoreSummary>> = {};
	const variantResultIds: string[] = [];
	const errors: Array<{ code: string; variant_label?: VariantLabel; message: string; fatal: boolean }> = [];

	for (let i = 0; i < VARIANT_ORDER.length; i++) {
		const label = VARIANT_ORDER[i] as VariantLabel;
		const proposal = getProposalForVariant(input.proposalSet, label);

		// Build scoring engine input
		const scoringInput: FlowDeskScoringEngineInputV1 = {
			workflowId: input.workflow_id,
			proposalId: proposal.proposal_id,
			candidateRef: input.model_profile_ref,
			agentRole: input.agent_role,
			providerFamily: input.provider_family,
			...(input.scoring_input_overrides ?? {}),
		};

		const scoreResult = scoreWorkflowProposal(scoringInput);

		if (!scoreResult.ok || !scoreResult.score) {
			// Non-fatal per-variant failure — record the error and continue
			errors.push({
				code: "VARIANT_SCORE_FAILED",
				variant_label: label,
				message: `Scoring failed for variant '${label}': ${scoreResult.errors.join("; ")}`,
				fatal: false,
			});
			continue;
		}

		// Clamp raw score
		const rawScore = clampScore(scoreResult.score.advisory_score);
		const normalizedScore = rawScore / 100;

		// Create variant result id
		const variantResultId = `variant-result-${execution_id}-${i}`;
		const variantId = `variant-${label}-${execution_id}`;
		const normalizedScoreRef = `score-ref-${variantResultId}`;

		// Build the advisory variant result
		const variantResultOutput = createFlowDeskAdvisoryVariantResultV1({
			variantResultId,
			admissionDecisionRef: input.admission_decision_ref,
			reservationRef: input.reservation.reservation_id,
			workflowId: input.workflow_id,
			attemptId: input.attempt_id,
			workflowSignatureRef: input.workflow_signature_ref,
			variantId,
			variantIndex: i,
			variantTotal: 4,
			modelRef: input.model_profile_ref,
			providerFamily: input.provider_family,
			proposalRef: proposal.proposal_id,
			normalizedScoreRef,
			outcomeClass: "completed_ok",
			outcomeReasonRefs: [`reason-scoring-ok-${label}`],
			boundedSummaryLabel: `variant-${label}-score-${rawScore}`,
			durationMs: 0,
			providerTokenUsageEstimate: 0,
			startedAt: executedAt,
			completedAt: executedAt,
		});

		if (!variantResultOutput.ok || !variantResultOutput.result) {
			errors.push({
				code: "VARIANT_RESULT_BUILD_FAILED",
				variant_label: label,
				message: `Failed to build variant result for '${label}': ${variantResultOutput.errors.join("; ")}`,
				fatal: false,
			});
			continue;
		}

		variantResults.push(variantResultOutput.result);
		variantResultIds.push(variantResultId);
		perVariantScoresMap[label] = {
			variant_label: label,
			raw_score: rawScore,
			normalized_score: normalizedScore,
			rank: 1, // will be assigned after sorting
		};
	}

	// ── Step 3: Fatal if < 2 variants scored ──────────────────────────────────

	const scoredLabels = Object.keys(perVariantScoresMap) as VariantLabel[];
	if (scoredLabels.length < 2) {
		const fatalErrors: Array<{ code: string; variant_label?: VariantLabel; message: string; fatal: boolean }> = [
			...errors,
			{
				code: "INSUFFICIENT_VARIANT_SCORES",
				message: `At least 2 variants must score successfully, but only ${scoredLabels.length} did`,
				fatal: true,
			},
		];
		return fatalSentinel(execution_id, fatalErrors);
	}

	// ── Step 4: Build aggregation ─────────────────────────────────────────────

	// Sort variants by normalized score descending → assign ranks
	const sortedLabels = scoredLabels.sort(
		(a, b) => (perVariantScoresMap[b]?.normalized_score ?? 0) - (perVariantScoresMap[a]?.normalized_score ?? 0),
	);

	// Assign ranks 1..N  (only up to 4 variants can exist)
	for (let r = 0; r < sortedLabels.length; r++) {
		const entry = perVariantScoresMap[sortedLabels[r] as VariantLabel];
		if (entry) {
			entry.rank = (r + 1) as 1 | 2 | 3 | 4;
		}
	}

	// Fill missing variants with placeholder ranks so the type is complete
	for (const v of VARIANT_ORDER) {
		if (!(v in perVariantScoresMap)) {
			perVariantScoresMap[v] = {
				variant_label: v,
				raw_score: 0,
				normalized_score: 0,
				rank: 4,
			};
		}
	}

	const perVariantScores = perVariantScoresMap as Record<VariantLabel, PerVariantScoreSummary>;

	const bestLabel = sortedLabels[0] as VariantLabel;
	const bestScore = perVariantScores[bestLabel].normalized_score;
	const worstScore = perVariantScores[sortedLabels[sortedLabels.length - 1] as VariantLabel].normalized_score;

	const mean =
		scoredLabels.reduce((sum, l) => sum + (perVariantScores[l]?.normalized_score ?? 0), 0) / scoredLabels.length;

	const spread = bestScore - worstScore;

	const aggregation: FlowDeskMultiVariantAggregationV1 = {
		schema_version: "flowdesk.multi_variant_aggregation.v1",
		aggregation_id: `agg-${execution_id}`,
		source_variant_result_refs: variantResultIds,
		per_variant_scores: perVariantScores,
		best_variant_label: bestLabel,
		best_variant_normalized_score: Math.round(bestScore * 10000) / 10000,
		mean_normalized_score: Math.round(mean * 10000) / 10000,
		score_spread: Math.round(spread * 10000) / 10000,
		aggregation_strategy: "single_model_multi_variant",
		model_profile_ref: input.model_profile_ref,
		aggregated_at: executedAt,
		advisory_only: true,
		non_authorizing: true,
		dispatch_authority_enabled: false,
	};

	// ── Step 5: Create lifecycle event: reserved → consumed ───────────────────

	const lifecycleEventOutput = createFlowDeskR3ReservationLifecycleEventV1({
		eventId: `lifecycle-${execution_id}`,
		reservationId: input.reservation.reservation_id,
		workflowId: input.workflow_id,
		attemptId: input.attempt_id,
		previousStatus: "reserved",
		nextStatus: "consumed",
		eventKind: "consumed",
		eventAt: executedAt,
		reasonRef: `reason-multi-variant-consumed-${execution_id}`,
	});

	if (!lifecycleEventOutput.ok || !lifecycleEventOutput.event) {
		return fatalSentinel(execution_id, [
			...errors,
			{
				code: "LIFECYCLE_EVENT_BUILD_FAILED",
				message: `Failed to create lifecycle event: ${lifecycleEventOutput.errors.join("; ")}`,
				fatal: true,
			},
		]);
	}

	// ── Step 6: Create signature index update pointing at best variant ─────────

	// The best variant result's result id serves as the signature index entry id
	const bestVariantResultId = variantResultIds[sortedLabels.indexOf(bestLabel)];
	const signatureIndexOutput = createFlowDeskWorkflowSignatureIndexEntryV1({
		entryId: `sig-index-${execution_id}`,
		workflowId: input.workflow_id,
		taskSignatureRef: input.workflow_signature_ref,
		referencePackRef: bestVariantResultId ?? `ref-${bestLabel}-${execution_id}`,
		lastScoredAt: executedAt,
		createdAt: executedAt,
		safeNextActions: [`review-oi-results-${execution_id}`],
	});

	if (!signatureIndexOutput.ok || !signatureIndexOutput.entry) {
		return fatalSentinel(execution_id, [
			...errors,
			{
				code: "SIGNATURE_INDEX_BUILD_FAILED",
				message: `Failed to create signature index entry: ${signatureIndexOutput.errors.join("; ")}`,
				fatal: true,
			},
		]);
	}

	// ── Step 7: Return all records ────────────────────────────────────────────

	return {
		execution_id,
		schema_version: "flowdesk.multi_variant_test_result.v1",
		variantResults,
		reconciliations: [], // no block-score reconciliation needed in the pure executor
		aggregation,
		lifecycleEvent: lifecycleEventOutput.event,
		signatureIndexUpdate: signatureIndexOutput.entry,
		errors,
		advisory_only: true,
	};
}
