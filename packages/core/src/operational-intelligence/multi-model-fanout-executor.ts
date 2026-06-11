/**
 * Multi-Model Fanout Executor — R3-S5.
 *
 * executeMultiModelFanoutTestV1() is a pure function (NO IO, NO writes) that
 * runs a multi-model advisory scoring fanout using the high_assurance variant
 * against multiple model profiles using an already-reserved R3 fanout reservation.
 *
 * P7-S07 additive: accepts an optional cadenceDecision input.  When present and
 * cadenceDecision.cadence_decision !== "allow", ALL models are skipped with
 * eligibility_status: "skipped" and skip_reason set to the cadence_decision label.
 * The envelope execution_status becomes "failed" (reservation_consumed: false).
 * When cadenceDecision is absent the existing behaviour is unchanged.
 *
 * Release gate: operational_intelligence_later_gate
 * Advisory-only, non-authorizing.  No dispatch, provider, runtime, lane-launch,
 * fallback, write, or hard-chat authority is granted.
 */
import { randomUUID } from "node:crypto";
import type { FlowDeskWorkflowPlanProposalSetV1 } from "./proposals.js";
import type { FlowDeskR3FanoutReservationV1 } from "./admission.js";
import type { FlowDeskModelCapabilityProfileV1 } from "./model-capability-profile.js";
import { scoreWorkflowProposal } from "./scoring-engine.js";
import type { FlowDeskScoringEngineInputV1 } from "./scoring-engine.js";
import type { FlowDeskFanoutCadenceDecisionV1 } from "./multi-model-fanout-cadence.js";

// ─── Constants ─────────────────────────────────────────────────────────────────

const COMPOSITE_WEIGHTS = { proposal: 0.6, capability: 0.4 };
const TIE_THRESHOLD = 0.02;
const CONFIDENCE_HIGH = 0.15;
const CONFIDENCE_MEDIUM = 0.05;

// ─── Election confidence type ─────────────────────────────────────────────────

export type ElectionConfidence = "high" | "medium" | "low";

// ─── Per-model fanout result ──────────────────────────────────────────────────

export interface FlowDeskModelFanoutResultV1 {
	model_ref: string;
	provider_qualified_model_id: string;
	variant_id: "high_assurance";
	proposal_score: number;           // 0-1, from scoreWorkflowProposal
	capability_score: number;         // from model profile (complexity_handling_score / 10)
	composite_score: number;          // 0.6*proposal_score + 0.4*capability_score, clamped [0,1]
	evaluated_at: string;
	eligibility_status: "scored" | "skipped" | "error";
	skip_reason?: string;
	advisory_only: true;
}

// ─── Multi-model aggregation contract ────────────────────────────────────────

/**
 * Advisory-only aggregation of scores across multiple models for a single
 * high_assurance variant.  Never grants dispatch, provider, runtime, or any
 * other authority.
 */
export interface FlowDeskMultiModelAggregationV1 {
	schema_version: "flowdesk.multi_model_aggregation.v1";
	aggregation_id: string;
	best_model_ref: string;
	best_provider_qualified_model_id: string;
	best_composite_score: number;
	model_results: FlowDeskModelFanoutResultV1[];  // sorted desc by composite_score
	scored_model_count: number;
	skipped_model_count: number;
	score_delta: number;              // best - second_best (0 if only one scored)
	election_confidence: ElectionConfidence;
	tie_break_applied: boolean;
	tie_break_reason?: string;
	aggregated_at: string;
	advisory_only: true;
	non_authorizing: true;
	dispatch_authority_enabled: false;
}

// ─── Execution result envelope ────────────────────────────────────────────────

export interface FlowDeskMultiModelFanoutResultEnvelopeV1 {
	schema_version: "flowdesk.multi_model_fanout_result_envelope.v1";
	execution_id: string;
	execution_mode: "multi_model_fanout";
	admission_ref: string;
	reservation_ref: string;
	workflow_signature: string;
	variant_used: "high_assurance";
	aggregation: FlowDeskMultiModelAggregationV1;
	reservation_consumed: boolean;
	execution_status: "complete" | "partial" | "failed";
	failure_reason?: string;
	evaluated_at: string;
	advisory_only: true;
}

// ─── Input contract ───────────────────────────────────────────────────────────

export interface ExecuteMultiModelFanoutTestV1Input {
	/** Must be "multi_model_fanout" */
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
	/** The proposal set — the high_assurance_proposal is used for all models */
	proposalSet: FlowDeskWorkflowPlanProposalSetV1;
	/** Model profiles to score against (minimum 2) */
	selectedModels: FlowDeskModelCapabilityProfileV1[];
	/** Provider family for scoring (e.g. "claude", "openai", "gemini") */
	provider_family: string;
	/** Agent role for scoring */
	agent_role: string;
	/** Optional scoring engine inputs (usage / alert level etc.) */
	scoring_input_overrides?: Partial<Pick<
		FlowDeskScoringEngineInputV1,
		| "usageRemainingPercent"
		| "alertLevel"
		| "resetBucketSeconds"
		| "activeConurrentLanes"
		| "maxConcurrentLanes"
		| "requestedLaneCount"
		| "contextWindowTokens"
	>>;
	/**
	 * Optional cadence decision from evaluateFanoutCadenceDecisionV1 (P7-S07).
	 * When present and cadence_decision !== "allow", ALL models are skipped and
	 * the envelope is returned as failed (reservation_consumed: false).
	 * When absent, existing scoring behaviour applies unchanged.
	 */
	cadenceDecision?: FlowDeskFanoutCadenceDecisionV1;
	/** ISO timestamp when execution began */
	executed_at?: string;
}

// ─── Internal helper: clamp 0..1 ─────────────────────────────────────────────

function clampUnit(value: number): number {
	return Math.max(0, Math.min(1, value));
}

// ─── Internal helper: round to 4 decimal places ───────────────────────────────

function round4(value: number): number {
	return Math.round(value * 10000) / 10000;
}

// ─── Failed envelope sentinel ──────────────────────────────────────────────────

function failedEnvelope(
	execution_id: string,
	admission_ref: string,
	reservation_ref: string,
	workflow_signature: string,
	failure_reason: string,
	evaluated_at: string,
): FlowDeskMultiModelFanoutResultEnvelopeV1 {
	const placeholderAggregation: FlowDeskMultiModelAggregationV1 = {
		schema_version: "flowdesk.multi_model_aggregation.v1",
		aggregation_id: `agg-failed-${execution_id}`,
		best_model_ref: "model-ref-unknown",
		best_provider_qualified_model_id: "unknown/unknown",
		best_composite_score: 0,
		model_results: [],
		scored_model_count: 0,
		skipped_model_count: 0,
		score_delta: 0,
		election_confidence: "low",
		tie_break_applied: false,
		aggregated_at: evaluated_at,
		advisory_only: true,
		non_authorizing: true,
		dispatch_authority_enabled: false,
	};

	return {
		schema_version: "flowdesk.multi_model_fanout_result_envelope.v1",
		execution_id,
		execution_mode: "multi_model_fanout",
		admission_ref,
		reservation_ref,
		workflow_signature,
		variant_used: "high_assurance",
		aggregation: placeholderAggregation,
		reservation_consumed: false,
		execution_status: "failed",
		failure_reason,
		evaluated_at,
		advisory_only: true,
	};
}

// ─── Main executor function ───────────────────────────────────────────────────

/**
 * executeMultiModelFanoutTestV1 — pure advisory multi-model scoring executor.
 *
 * Steps:
 * 1. Validate inputs: execution_mode, reservation.status, selectedModels >= 2,
 *    no duplicate model_refs.
 * 2. Use the high_assurance variant from proposalSet for all models.
 * 3. Score each model via scoreWorkflowProposal(). Read capability_score from
 *    model profile (complexity_handling_score normalized to 0-1 via /10).
 *    composite_score = clamp(0.6 * proposal_score + 0.4 * capability_score, 0, 1).
 * 4. If scored < 2 → return failed envelope (reservation_consumed: false).
 * 5. Sort by composite_score desc, elect best.
 * 6. Tie-break (delta < TIE_THRESHOLD): higher capability_score wins; on tie
 *    first in selectedModels order wins.
 * 7. Determine election_confidence from delta.
 * 8. Return envelope with reservation_consumed: true (caller persists state change).
 *
 * Advisory-only, non-authorizing. Never throws.
 */
export function executeMultiModelFanoutTestV1(
	input: ExecuteMultiModelFanoutTestV1Input,
): FlowDeskMultiModelFanoutResultEnvelopeV1 {
	const execution_id = randomUUID();
	const evaluatedAt = input.executed_at ?? new Date().toISOString();

	const admissionRef = input.admission_decision_ref;
	const reservationRef = input.reservation.reservation_id;
	const workflowSignature = input.workflow_signature_ref;

	// ── Step 1: Input validation ───────────────────────────────────────────────

	if (input.execution_mode !== "multi_model_fanout") {
		return failedEnvelope(
			execution_id, admissionRef, reservationRef, workflowSignature,
			`execution_mode must be 'multi_model_fanout', got '${input.execution_mode}'`,
			evaluatedAt,
		);
	}

	if (input.reservation.status !== "reserved") {
		return failedEnvelope(
			execution_id, admissionRef, reservationRef, workflowSignature,
			`reservation.status must be 'reserved', got '${input.reservation.status}'`,
			evaluatedAt,
		);
	}

	if (!input.selectedModels || input.selectedModels.length < 2) {
		return failedEnvelope(
			execution_id, admissionRef, reservationRef, workflowSignature,
			`selectedModels must have at least 2 models, got ${input.selectedModels?.length ?? 0}`,
			evaluatedAt,
		);
	}

	// Check for duplicate model_refs
	const seenModelRefs = new Set<string>();
	for (const m of input.selectedModels) {
		if (seenModelRefs.has(m.model_ref)) {
			return failedEnvelope(
				execution_id, admissionRef, reservationRef, workflowSignature,
				`duplicate model_ref detected: '${m.model_ref}'`,
				evaluatedAt,
			);
		}
		seenModelRefs.add(m.model_ref);
	}

	// ── Step 1b: Cadence gate check (P7-S07) ──────────────────────────────────
	// If a cadenceDecision was supplied and is not "allow", skip all models and
	// return a failed envelope.  The reservation is NOT consumed.

	if (input.cadenceDecision !== undefined && input.cadenceDecision.cadence_decision !== "allow") {
		const skipReason = input.cadenceDecision.cadence_decision;
		const skippedResults: FlowDeskModelFanoutResultV1[] = input.selectedModels.map((m) => ({
			model_ref: m.model_ref,
			provider_qualified_model_id: m.provider_qualified_model_id,
			variant_id: "high_assurance",
			proposal_score: 0,
			capability_score: 0,
			composite_score: 0,
			evaluated_at: evaluatedAt,
			eligibility_status: "skipped",
			skip_reason: skipReason,
			advisory_only: true,
		}));

		const cadencePlaceholderAggregation: FlowDeskMultiModelAggregationV1 = {
			schema_version: "flowdesk.multi_model_aggregation.v1",
			aggregation_id: `agg-cadence-blocked-${execution_id}`,
			best_model_ref: "model-ref-unknown",
			best_provider_qualified_model_id: "unknown/unknown",
			best_composite_score: 0,
			model_results: skippedResults,
			scored_model_count: 0,
			skipped_model_count: skippedResults.length,
			score_delta: 0,
			election_confidence: "low",
			tie_break_applied: false,
			aggregated_at: evaluatedAt,
			advisory_only: true,
			non_authorizing: true,
			dispatch_authority_enabled: false,
		};

		return {
			schema_version: "flowdesk.multi_model_fanout_result_envelope.v1",
			execution_id,
			execution_mode: "multi_model_fanout",
			admission_ref: admissionRef,
			reservation_ref: reservationRef,
			workflow_signature: workflowSignature,
			variant_used: "high_assurance",
			aggregation: cadencePlaceholderAggregation,
			reservation_consumed: false,
			execution_status: "failed",
			failure_reason: `cadence_blocked:${skipReason}`,
			evaluated_at: evaluatedAt,
			advisory_only: true,
		};
	}

	// ── Step 2: Get high_assurance proposal ───────────────────────────────────

	const highAssuranceProposal = input.proposalSet.high_assurance_proposal;

	// ── Step 3: Score each model ───────────────────────────────────────────────

	const modelResults: FlowDeskModelFanoutResultV1[] = [];
	let skippedCount = 0;

	for (const modelProfile of input.selectedModels) {
		// Build scoring engine input for this model
		const scoringInput: FlowDeskScoringEngineInputV1 = {
			workflowId: input.workflow_id,
			proposalId: highAssuranceProposal.proposal_id,
			candidateRef: modelProfile.model_ref,
			agentRole: input.agent_role,
			providerFamily: input.provider_family,
			...(input.scoring_input_overrides ?? {}),
		};

		let proposalScore: number;
		let eligibilityStatus: "scored" | "skipped" | "error";
		let skipReason: string | undefined;

		try {
			const scoreResult = scoreWorkflowProposal(scoringInput);

			if (!scoreResult.ok || !scoreResult.score) {
				eligibilityStatus = "error";
				skipReason = `scoring failed: ${scoreResult.errors.join("; ")}`;
				skippedCount++;

				modelResults.push({
					model_ref: modelProfile.model_ref,
					provider_qualified_model_id: modelProfile.provider_qualified_model_id,
					variant_id: "high_assurance",
					proposal_score: 0,
					capability_score: 0,
					composite_score: 0,
					evaluated_at: evaluatedAt,
					eligibility_status: "error",
					skip_reason: skipReason,
					advisory_only: true,
				});
				continue;
			}

			// advisory_score is 0..100; normalize to 0..1
			proposalScore = clampUnit(scoreResult.score.advisory_score / 100);
			eligibilityStatus = "scored";
		} catch (_err) {
			eligibilityStatus = "error";
			skipReason = "unexpected scoring error";
			skippedCount++;

			modelResults.push({
				model_ref: modelProfile.model_ref,
				provider_qualified_model_id: modelProfile.provider_qualified_model_id,
				variant_id: "high_assurance",
				proposal_score: 0,
				capability_score: 0,
				composite_score: 0,
				evaluated_at: evaluatedAt,
				eligibility_status: "error",
				skip_reason: skipReason,
				advisory_only: true,
			});
			continue;
		}

		// capability_score: complexity_handling_score is 1..10; normalize to 0..1
		const capabilityScore = clampUnit(modelProfile.complexity_handling_score / 10);

		// composite_score = clamp(0.6 * proposal_score + 0.4 * capability_score, 0, 1)
		const compositeScore = clampUnit(
			COMPOSITE_WEIGHTS.proposal * proposalScore + COMPOSITE_WEIGHTS.capability * capabilityScore,
		);

		modelResults.push({
			model_ref: modelProfile.model_ref,
			provider_qualified_model_id: modelProfile.provider_qualified_model_id,
			variant_id: "high_assurance",
			proposal_score: round4(proposalScore),
			capability_score: round4(capabilityScore),
			composite_score: round4(compositeScore),
			evaluated_at: evaluatedAt,
			eligibility_status: "scored",
			advisory_only: true,
		});
	}

	// ── Step 4: Require at least 2 scored models ──────────────────────────────

	const scoredResults = modelResults.filter((r) => r.eligibility_status === "scored");
	if (scoredResults.length < 2) {
		return failedEnvelope(
			execution_id, admissionRef, reservationRef, workflowSignature,
			`at least 2 models must score successfully, but only ${scoredResults.length} did`,
			evaluatedAt,
		);
	}

	// ── Step 5: Sort by composite_score desc, elect best ─────────────────────

	// Sort scored results descending by composite_score.
	// Preserve original index for tie-breaking by first-in-order.
	const scoredWithIndex = scoredResults.map((r) => ({
		result: r,
		originalIndex: input.selectedModels.findIndex((m) => m.model_ref === r.model_ref),
		capabilityScore: input.selectedModels.find((m) => m.model_ref === r.model_ref)?.complexity_handling_score ?? 0,
	}));

	// Primary sort: composite_score desc
	scoredWithIndex.sort((a, b) => {
		const scoreDiff = b.result.composite_score - a.result.composite_score;
		if (Math.abs(scoreDiff) > Number.EPSILON) return scoreDiff > 0 ? 1 : -1;
		// Tie: stable sort by original index (secondary stable sort)
		return a.originalIndex - b.originalIndex;
	});

	// ── Step 6: Tie-break ─────────────────────────────────────────────────────

	const best = scoredWithIndex[0]!;
	const second = scoredWithIndex[1]!;

	const delta = round4(best.result.composite_score - second.result.composite_score);
	let tieBreakApplied = false;
	let tieBreakReason: string | undefined;

	if (delta < TIE_THRESHOLD) {
		tieBreakApplied = true;
		// If different capability scores → higher capability wins
		if (best.capabilityScore !== second.capabilityScore) {
			// Re-elect if second has higher capability
			if (second.capabilityScore > best.capabilityScore) {
				// Swap best and second
				scoredWithIndex[0] = second;
				scoredWithIndex[1] = best;
			}
			tieBreakReason = "capability_score_wins";
		} else {
			// Same capability → first in selectedModels order wins (already sorted by originalIndex)
			// The initial stable sort by originalIndex already handles this, but we still flag it
			// Re-sort by original index among tied composite + tied capability
			if (best.originalIndex > second.originalIndex) {
				scoredWithIndex[0] = second;
				scoredWithIndex[1] = best;
			}
			tieBreakReason = "first_in_profile_order";
		}
	}

	// ── Step 7: Election confidence from delta ─────────────────────────────────

	let electionConfidence: ElectionConfidence;
	if (delta >= CONFIDENCE_HIGH) {
		electionConfidence = "high";
	} else if (delta >= CONFIDENCE_MEDIUM) {
		electionConfidence = "medium";
	} else {
		electionConfidence = "low";
	}

	// ── Step 8: Build aggregation ─────────────────────────────────────────────

	// Full sorted model_results: scored (sorted desc) then non-scored
	const sortedScoredResults = scoredWithIndex.map((s) => s.result);
	const nonScoredResults = modelResults.filter((r) => r.eligibility_status !== "scored");
	const allResultsSorted = [...sortedScoredResults, ...nonScoredResults];

	const winner = scoredWithIndex[0]!.result;
	const execution_status: "complete" | "partial" =
		skippedCount === 0 ? "complete" : "partial";

	const aggregation: FlowDeskMultiModelAggregationV1 = {
		schema_version: "flowdesk.multi_model_aggregation.v1",
		aggregation_id: `agg-${execution_id}`,
		best_model_ref: winner.model_ref,
		best_provider_qualified_model_id: winner.provider_qualified_model_id,
		best_composite_score: winner.composite_score,
		model_results: allResultsSorted,
		scored_model_count: scoredResults.length,
		skipped_model_count: skippedCount,
		score_delta: delta,
		election_confidence: electionConfidence,
		tie_break_applied: tieBreakApplied,
		...(tieBreakApplied && tieBreakReason !== undefined ? { tie_break_reason: tieBreakReason } : {}),
		aggregated_at: evaluatedAt,
		advisory_only: true,
		non_authorizing: true,
		dispatch_authority_enabled: false,
	};

	// ── Step 9: Return envelope with reservation_consumed: true ───────────────

	return {
		schema_version: "flowdesk.multi_model_fanout_result_envelope.v1",
		execution_id,
		execution_mode: "multi_model_fanout",
		admission_ref: admissionRef,
		reservation_ref: reservationRef,
		workflow_signature: workflowSignature,
		variant_used: "high_assurance",
		aggregation,
		reservation_consumed: true,
		execution_status,
		evaluated_at: evaluatedAt,
		advisory_only: true,
	};
}
