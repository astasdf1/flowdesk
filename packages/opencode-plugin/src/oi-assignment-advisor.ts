/**
 * OI Assignment Advisor — P7-S15.
 *
 * buildOIAssignmentAdvisoryV1() annotates workflow assignment evidence with OI
 * advisory data AFTER selectModelForTask() has already returned its result.
 *
 * The scoring output is advisory-only.  It MUST NOT influence model selection,
 * routing, dispatch, provider switching, or any runtime execution.
 *
 * All authority flags are false.  No dispatch, provider, runtime, lane-launch,
 * fallback, write, or hard-chat authority is granted.
 */
import {
	type FlowDeskOIAdvisoryHealthLabelV1,
	scoreWorkflowProposal,
} from "@flowdesk/core";

// ─── Public input / output contracts ─────────────────────────────────────────

export interface OIAssignmentAdvisoryInputV1 {
	workflowId: string;
	taskId: string;
	agentRole: string;
	selectedCandidateRef: string;   // opaque ref for selected model
	providerFamily: string;
	usageRemainingPercent?: number;
	alertLevel?: "ok" | "warning" | "critical" | "exhausted" | "stale" | "unknown";
	resetBucketSeconds?: number;
	activeLaneCount?: number;
	maxLaneCount?: number;
	oiEnabled: boolean;             // from operationalIntelligenceConfigFromOptions
}

export interface OIAssignmentAdvisoryResultV1 {
	included: boolean;
	healthLabel: FlowDeskOIAdvisoryHealthLabelV1;
	scoreRef?: string;              // opaque ref to durable score evidence (if persisted)
	advisoryScore?: number;         // 0..100
	hardFilterState?: string;       // "passed" | "blocked"
	skippedReason?: string;         // why OI was skipped
}

// ─── Main advisory function ───────────────────────────────────────────────────

/**
 * Build an OI advisory annotation for a workflow assignment.
 *
 * Must be called AFTER selectModelForTask() has returned its result.
 * The returned advisory MUST NOT be fed back into selectModelForTask()
 * or used for routing, dispatch, fallback, or model reselection.
 *
 * Never throws.  On any internal error the result is degraded/skipped.
 *
 * Authority: advisory-only.  No dispatch, provider, runtime, lane-launch,
 * fallback, write, or hard-chat authority is granted.
 */
export function buildOIAssignmentAdvisoryV1(
	input: OIAssignmentAdvisoryInputV1,
): OIAssignmentAdvisoryResultV1 {
	// If OI is disabled by configuration, return early without scoring.
	if (!input.oiEnabled) {
		return {
			included: false,
			healthLabel: "disabled_by_config",
			skippedReason: "oi_disabled",
		};
	}

	// Guard: workflowId and taskId must be non-empty to form a valid proposalId.
	if (!input.workflowId?.trim() || !input.taskId?.trim()) {
		return {
			included: false,
			healthLabel: "missing_source_evidence",
			skippedReason: "missing_workflow_or_task_id",
		};
	}

	// Guard: selectedCandidateRef must look like an opaque ref (starts with a
	// recognizable prefix) so scoreWorkflowProposal can validate it.
	if (!input.selectedCandidateRef?.trim()) {
		return {
			included: false,
			healthLabel: "missing_source_evidence",
			skippedReason: "missing_candidate_ref",
		};
	}

	// Guard: providerFamily must be non-empty.
	if (!input.providerFamily?.trim()) {
		return {
			included: false,
			healthLabel: "missing_source_evidence",
			skippedReason: "missing_provider_family",
		};
	}

	// Build a proposalId that is stable for this (workflowId, taskId) pair.
	const proposalId = `proposal-${input.workflowId}-${input.taskId}`;

	// Delegate to the scoring engine — advisory-only, never modifies selection.
	let scoringResult: ReturnType<typeof scoreWorkflowProposal>;
	try {
		scoringResult = scoreWorkflowProposal({
			workflowId: input.workflowId,
			proposalId,
			candidateRef: input.selectedCandidateRef,
			agentRole: input.agentRole,
			providerFamily: input.providerFamily,
			...(input.usageRemainingPercent !== undefined ? { usageRemainingPercent: input.usageRemainingPercent } : {}),
			...(input.alertLevel !== undefined ? { alertLevel: input.alertLevel } : {}),
			...(input.resetBucketSeconds !== undefined ? { resetBucketSeconds: input.resetBucketSeconds } : {}),
			...(input.activeLaneCount !== undefined ? { activeConurrentLanes: input.activeLaneCount } : {}),
			...(input.maxLaneCount !== undefined ? { maxConcurrentLanes: input.maxLaneCount } : {}),
		});
	} catch {
		// scoreWorkflowProposal should never throw, but be defensive.
		return {
			included: false,
			healthLabel: "unknown",
			skippedReason: "scoring_engine_threw",
		};
	}

	if (!scoringResult.ok || !scoringResult.score) {
		// Scoring failed validation — return degraded advisory without blocking.
		return {
			included: true,
			healthLabel: "degraded",
			skippedReason: "scoring_engine_validation_failed",
		};
	}

	const score = scoringResult.score;
	const hardFilterState: "passed" | "blocked" = score.hard_filter_state;

	// scoreRef is the score_id from the engine — acts as an opaque evidence ref.
	const scoreRef = score.score_id;

	return {
		included: true,
		healthLabel: scoringResult.healthLabel,
		scoreRef,
		advisoryScore: score.advisory_score,
		hardFilterState,
	};
}
