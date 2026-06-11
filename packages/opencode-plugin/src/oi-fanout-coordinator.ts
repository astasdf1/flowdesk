/**
 * OI Fanout Coordinator — P7-S07.
 *
 * runOIFanoutCoordinatorV1() composes the cadence gate decision with the
 * multi-model fanout executor to produce a single advisory coordinator result.
 *
 * Responsibilities:
 *   1. Evaluate cadence gate via evaluateFanoutCadenceDecisionV1.
 *   2. If cadence is not "allow" → return blocked_cadence immediately.
 *   3. If no model profiles supplied → return blocked_no_data.
 *   4. Otherwise execute multi-model fanout scoring via
 *      executeMultiModelFanoutTestV1, forwarding the cadenceDecision so the
 *      executor can record it on the envelope.
 *   5. Return advisory_completed with the aggregation result.
 *
 * ALL authority flags are permanently false.  This function is advisory-only.
 * No real provider dispatch, provider calls, lane launches, fallback, or
 * runtime execution is performed.
 *
 * Release gate: operational_intelligence_later_gate
 */
import {
	evaluateFanoutCadenceDecisionV1,
	executeMultiModelFanoutTestV1,
	type FlowDeskFanoutCadenceGateInputV1,
	type FlowDeskFanoutCadenceDecisionV1,
	type FlowDeskMultiModelAggregationV1,
	type FlowDeskModelCapabilityProfileV1,
	type FlowDeskWorkflowPlanProposalSetV1,
	type FlowDeskR3FanoutReservationV1,
} from "@flowdesk/core";

// ─── Input / Output contracts ─────────────────────────────────────────────────

export interface OIFanoutCoordinatorInputV1 {
	/** Stable workflow id */
	workflowId: string;
	/** Task id for this fanout run */
	taskId: string;
	/**
	 * Root directory for the FlowDesk project state.
	 * Passed through but not used for IO by this pure coordinator.
	 */
	rootDir: string;
	/** Cadence gate input to evaluate before running the fanout */
	cadenceInput: FlowDeskFanoutCadenceGateInputV1;
	/** Proposal set (high_assurance variant is used for all models) */
	proposalSet: FlowDeskWorkflowPlanProposalSetV1;
	/**
	 * Model capability profiles to score against.
	 * Minimum 2 profiles are required for a successful fanout.
	 * If empty or fewer than 2 profiles are supplied after cadence check,
	 * the coordinator returns blocked_no_data.
	 */
	selectedModels: FlowDeskModelCapabilityProfileV1[];
	/** Provider family string (e.g. "claude", "openai", "gemini") */
	providerFamily: string;
	/** Agent role string for scoring */
	agentRole: string;
	/**
	 * Fanout reservation from the R3 admission gate.
	 * Must have status "reserved" for a successful fanout execution.
	 */
	reservation: FlowDeskR3FanoutReservationV1;
	/** Admission decision ref (opaque) */
	admissionDecisionRef: string;
	/** Workflow signature ref (opaque) */
	workflowSignatureRef: string;
	/** Optional ISO timestamp for evaluations; defaults to now. */
	evaluatedAt?: string;
}

export interface OIFanoutCoordinatorResultV1 {
	/**
	 * Advisory outcome:
	 * - advisory_completed: cadence allowed and fanout scoring ran successfully.
	 * - blocked_cadence: cadence gate blocked the fanout (no scoring).
	 * - blocked_no_data: insufficient model profiles to proceed.
	 */
	status: "advisory_completed" | "blocked_cadence" | "blocked_no_data";
	/** The evaluated cadence decision (always present) */
	cadenceDecision: FlowDeskFanoutCadenceDecisionV1;
	/**
	 * Fanout aggregation result; only present when status is "advisory_completed"
	 * and the executor returned at least 2 scored models.
	 */
	fanoutResult?: FlowDeskMultiModelAggregationV1;
	/** Human-readable advisory summary; never contains raw prompts or secrets. */
	advisorySummary: string;

	// ── Authority flags (all permanently false) ────────────────────────────────
	/** Always true: this result is advisory only */
	advisory_only: true;
	/** Always false: no dispatch authority */
	dispatch_authority_enabled: false;
	/** Always false: no provider call authority */
	provider_call_authority_enabled: false;
	/** Always false: no real OpenCode dispatch */
	real_opencode_dispatch: false;
}

// ─── Main coordinator function ────────────────────────────────────────────────

/**
 * runOIFanoutCoordinatorV1 — pure advisory OI fanout coordinator.
 *
 * Composes cadence evaluation and multi-model fanout scoring into a single
 * advisory result.  Never throws; errors are surfaced as blocked_no_data or
 * blocked_cadence status.
 *
 * Advisory-only, non-authorizing. No dispatch, provider, runtime, lane-launch,
 * fallback, write, or hard-chat authority is granted.
 */
export function runOIFanoutCoordinatorV1(
	input: OIFanoutCoordinatorInputV1,
): OIFanoutCoordinatorResultV1 {
	const evaluatedAt = input.evaluatedAt ?? new Date().toISOString();

	// ── Step 1: Evaluate cadence gate ──────────────────────────────────────────

	let cadenceDecision: FlowDeskFanoutCadenceDecisionV1;
	try {
		cadenceDecision = evaluateFanoutCadenceDecisionV1({
			gateInput: input.cadenceInput,
			now: evaluatedAt,
		});
	} catch {
		// evaluateFanoutCadenceDecisionV1 should never throw; be defensive.
		// Return a synthetic blocked_window_cap decision.
		cadenceDecision = {
			schema_version: "flowdesk.fanout_cadence_decision.v1",
			cadence_decision: "blocked_window_cap",
			gate_satisfied: false,
			redacted_block_reason: "cadence-evaluator-threw",
			rolling_window_requests: 0,
			rolling_window_cap: 0,
			rolling_window_seconds: 0,
			advisory_only: true,
			dispatch_authority_enabled: false,
			provider_call_authority_enabled: false,
		};
	}

	// ── Step 2: If cadence is not "allow", return blocked_cadence ─────────────

	if (cadenceDecision.cadence_decision !== "allow") {
		return {
			status: "blocked_cadence",
			cadenceDecision,
			advisorySummary: `OI fanout blocked by cadence gate: ${cadenceDecision.cadence_decision}`,
			advisory_only: true,
			dispatch_authority_enabled: false,
			provider_call_authority_enabled: false,
			real_opencode_dispatch: false,
		};
	}

	// ── Step 3: Validate model data sufficiency ────────────────────────────────

	if (!input.selectedModels || input.selectedModels.length < 2) {
		return {
			status: "blocked_no_data",
			cadenceDecision,
			advisorySummary: `OI fanout blocked: insufficient model profiles (need >= 2, got ${input.selectedModels?.length ?? 0})`,
			advisory_only: true,
			dispatch_authority_enabled: false,
			provider_call_authority_enabled: false,
			real_opencode_dispatch: false,
		};
	}

	// ── Step 4: Execute multi-model fanout scoring ─────────────────────────────

	let fanoutResult: FlowDeskMultiModelAggregationV1 | undefined;
	let advisorySummary: string;
	let finalStatus: OIFanoutCoordinatorResultV1["status"] = "advisory_completed";

	try {
		const envelopeResult = executeMultiModelFanoutTestV1({
			execution_mode: "multi_model_fanout",
			workflow_id: input.workflowId,
			attempt_id: input.taskId,
			workflow_signature_ref: input.workflowSignatureRef,
			admission_decision_ref: input.admissionDecisionRef,
			reservation: input.reservation,
			proposalSet: input.proposalSet,
			selectedModels: input.selectedModels,
			provider_family: input.providerFamily,
			agent_role: input.agentRole,
			cadenceDecision,
			executed_at: evaluatedAt,
		});

		if (envelopeResult.execution_status === "failed") {
			// Executor returned a failed envelope — surface as blocked_no_data
			finalStatus = "blocked_no_data";
			advisorySummary = `OI fanout executor failed: ${envelopeResult.failure_reason ?? "unknown"}`;
		} else {
			// complete or partial — fanout scoring ran
			fanoutResult = envelopeResult.aggregation;
			advisorySummary = `OI fanout advisory completed: best_model=${fanoutResult.best_model_ref} score=${fanoutResult.best_composite_score} confidence=${fanoutResult.election_confidence}`;
		}
	} catch {
		// executeMultiModelFanoutTestV1 should never throw; be defensive.
		finalStatus = "blocked_no_data";
		advisorySummary = "OI fanout executor threw unexpectedly";
	}

	// ── Step 5: Return result ──────────────────────────────────────────────────

	return {
		status: finalStatus,
		cadenceDecision,
		...(fanoutResult !== undefined ? { fanoutResult } : {}),
		advisorySummary,
		advisory_only: true,
		dispatch_authority_enabled: false,
		provider_call_authority_enabled: false,
		real_opencode_dispatch: false,
	};
}
