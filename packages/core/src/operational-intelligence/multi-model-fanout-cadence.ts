/**
 * P7-S06: FlowDeskFanoutCadenceDecisionV1 — cadence control contract.
 *
 * Wraps the existing FlowDeskFanoutCadenceGateV1 (from gates.ts) into a richer
 * cadence decision envelope that surfaces rolling-window cap, cooldown, novelty,
 * and budget dimensions separately.
 *
 * Advisory-only, non-authorizing. No dispatch, provider, runtime, lane-launch,
 * fallback, write, or hard-chat authority is granted.
 *
 * Release gate: operational_intelligence_later_gate
 * Additive: gates.ts is NOT modified.
 */

import { createFlowDeskFanoutCadenceGateV1 } from "./gates.js";

// ─── Input type ───────────────────────────────────────────────────────────────

/**
 * Input contract for evaluateFanoutCadenceDecisionV1.
 *
 * Mirrors the parameters of createFlowDeskFanoutCadenceGateV1 and adds
 * optional novelty and budget dimensions.
 */
export interface FlowDeskFanoutCadenceGateInputV1 {
	/** Opaque gate id */
	gateId: string;
	/** Opaque workflow id */
	workflowId: string;
	/** Number of lanes being requested in this burst */
	requestedLaneCount: number;
	/** Maximum lanes allowed concurrently (rolling-window cap) */
	maxConcurrentLanes: number;
	/** Currently active lane count within the rolling window */
	activeLaneCount: number;
	/** Rolling window size in seconds */
	cadenceWindowSeconds: number;
	/** Required cooldown between bursts in seconds (0 = no cooldown) */
	cooldownSeconds: number;
	/** Seconds elapsed since the most recent burst started */
	secondsSinceLastBurst: number;
	/** Optional opaque risk label refs */
	riskLabels?: string[];
	/** Optional opaque dependency refs */
	dependencyRefs?: string[];
	/** Non-empty array of opaque reason refs */
	reasonRefs: string[];
	/** Optional novelty score in [0, 1]; omit to skip novelty gating */
	noveltyScore?: number;
	/** Optional novelty threshold in [0, 1]; noveltyScore must be >= this to pass */
	noveltyThreshold?: number;
	/** Optional estimated cost in abstract cost units; omit to skip budget gating */
	estimatedCostUnits?: number;
	/** Optional budget cap in abstract cost units; estimatedCostUnits must be <= this to pass */
	budgetCapUnits?: number;
}

// ─── Decision type ────────────────────────────────────────────────────────────

/**
 * Advisory cadence decision label for the enriched cadence decision contract.
 *
 * - allow: all constraints pass; fanout may proceed (advisory only).
 * - blocked_cooldown: cooldown period has not elapsed.
 * - blocked_window_cap: rolling-window cap would be exceeded.
 * - blocked_low_novelty: novelty score is below the threshold.
 * - blocked_budget: estimated cost exceeds the budget cap.
 *
 * Note: distinct from FlowDeskFanoutCadenceDecisionLabelV1 in gates.ts which
 * uses the gate-internal labels (allow|reduce|hold|blocked).
 */
export type FlowDeskFanoutCadenceDecisionOutcomeV1 =
	| "allow"
	| "blocked_cooldown"
	| "blocked_window_cap"
	| "blocked_low_novelty"
	| "blocked_budget";

/**
 * Advisory-only cadence decision wrapping the existing fanout cadence gate
 * result and adding rolling-window, cooldown, novelty, and budget details.
 *
 * All authority flags are permanently false; this record is advisory only.
 */
export interface FlowDeskFanoutCadenceDecisionV1 {
	schema_version: "flowdesk.fanout_cadence_decision.v1";

	/** Top-level advisory decision */
	cadence_decision: FlowDeskFanoutCadenceDecisionOutcomeV1;

	/** Whether the underlying cadence gate was satisfied */
	gate_satisfied: boolean;

	/** Redacted block reason when cadence_decision is not "allow" */
	redacted_block_reason?: string;

	// ── Rolling-window cap ──────────────────────────────────────────────────
	/** Number of active requests/lanes counted in the rolling window */
	rolling_window_requests: number;
	/** Maximum requests/lanes allowed in the rolling window */
	rolling_window_cap: number;
	/** Rolling window duration in seconds */
	rolling_window_seconds: number;

	// ── Cooldown ───────────────────────────────────────────────────────────
	/** Remaining cooldown in seconds; present only when in cooldown */
	cooldown_remaining_seconds?: number;

	// ── Novelty ────────────────────────────────────────────────────────────
	/** Novelty score in [0, 1]; present when input supplied noveltyScore */
	novelty_score?: number;
	/** Novelty threshold in [0, 1]; present when input supplied noveltyThreshold */
	novelty_threshold?: number;

	// ── Budget ─────────────────────────────────────────────────────────────
	/** Estimated cost in abstract cost units; present when input supplied estimatedCostUnits */
	estimated_cost_units?: number;
	/** Budget cap in abstract cost units; present when input supplied budgetCapUnits */
	budget_cap_units?: number;

	// ── Authority (all permanently false) ─────────────────────────────────
	/** Always true: this record is advisory only */
	advisory_only: true;
	/** Always false: no dispatch authority */
	dispatch_authority_enabled: false;
	/** Always false: no provider call authority */
	provider_call_authority_enabled: false;
}

// ─── Evaluator ────────────────────────────────────────────────────────────────

/**
 * evaluateFanoutCadenceDecisionV1 — pure, advisory cadence decision evaluator.
 *
 * Wraps createFlowDeskFanoutCadenceGateV1 and layers on:
 * - Explicit cooldown tracking (blocked_cooldown)
 * - Explicit window-cap tracking (blocked_window_cap)
 * - Optional novelty gating (blocked_low_novelty)
 * - Optional budget gating (blocked_budget)
 *
 * Decision precedence (first match wins):
 *   1. blocked_cooldown — cooldown not elapsed
 *   2. blocked_window_cap — active + requested > cap  OR  requested > cap
 *   3. blocked_low_novelty — noveltyScore < noveltyThreshold
 *   4. blocked_budget — estimatedCostUnits > budgetCapUnits
 *   5. allow — all constraints pass
 *
 * Never throws; returns a blocked_window_cap decision on gate input errors
 * (gate validation failures indicate a capacity/constraint concern).
 *
 * Advisory-only, non-authorizing.
 *
 * @param params.gateInput - The cadence gate input parameters.
 * @param params.now - Optional ISO timestamp override; defaults to new Date().toISOString().
 */
export function evaluateFanoutCadenceDecisionV1(params: {
	gateInput: FlowDeskFanoutCadenceGateInputV1;
	now?: string;
}): FlowDeskFanoutCadenceDecisionV1 {
	const { gateInput } = params;
	const now = params.now ?? new Date().toISOString();

	// ── Invoke the underlying cadence gate ────────────────────────────────────
	const gateResult = createFlowDeskFanoutCadenceGateV1({
		gateId: gateInput.gateId,
		workflowId: gateInput.workflowId,
		requestedLaneCount: gateInput.requestedLaneCount,
		maxConcurrentLanes: gateInput.maxConcurrentLanes,
		activeLaneCount: gateInput.activeLaneCount,
		cadenceWindowSeconds: gateInput.cadenceWindowSeconds,
		cooldownSeconds: gateInput.cooldownSeconds,
		secondsSinceLastBurst: gateInput.secondsSinceLastBurst,
		riskLabels: gateInput.riskLabels,
		dependencyRefs: gateInput.dependencyRefs,
		reasonRefs: gateInput.reasonRefs,
		evaluatedAt: now,
	});

	// On gate validation failure, treat as window-cap block (conservative fail-closed)
	if (!gateResult.ok || !gateResult.gate) {
		return {
			schema_version: "flowdesk.fanout_cadence_decision.v1",
			cadence_decision: "blocked_window_cap",
			gate_satisfied: false,
			redacted_block_reason: "gate-input-validation-failed",
			rolling_window_requests: sanitizeCount(gateInput.activeLaneCount),
			rolling_window_cap: sanitizeCount(gateInput.maxConcurrentLanes),
			rolling_window_seconds: sanitizeSeconds(gateInput.cadenceWindowSeconds),
			advisory_only: true,
			dispatch_authority_enabled: false,
			provider_call_authority_enabled: false,
		};
	}

	const gate = gateResult.gate;

	// ── Extract raw numbers from gate for window tracking ─────────────────────
	const rollingWindowRequests = gate.active_lane_count;
	const rollingWindowCap = gate.max_concurrent_lanes;
	const rollingWindowSeconds = gate.cadence_window_seconds;

	// ── Compute cooldown remaining ─────────────────────────────────────────────
	const cooldownRemaining =
		gate.cooldown_seconds > 0 && gate.seconds_since_last_burst < gate.cooldown_seconds
			? gate.cooldown_seconds - gate.seconds_since_last_burst
			: undefined;

	// ── Derive gate_satisfied from gate decision ───────────────────────────────
	// The underlying gate uses: "allow" or "reduce" = effectively satisfied;
	// "hold" or "blocked" = not satisfied.
	const gateSatisfied =
		gate.gate_decision === "allow" || gate.gate_decision === "reduce";

	// ── Decision: precedence evaluation ───────────────────────────────────────

	// 1. blocked_cooldown: cooldown not elapsed
	if (cooldownRemaining !== undefined && cooldownRemaining > 0) {
		return buildDecision({
			cadenceDecision: "blocked_cooldown",
			gateSatisfied: false,
			redactedBlockReason: "cooldown-not-elapsed",
			rollingWindowRequests,
			rollingWindowCap,
			rollingWindowSeconds,
			cooldownRemainingSeconds: Math.max(0, cooldownRemaining),
			gateInput,
		});
	}

	// 2. blocked_window_cap: requests + active would exceed cap, or requested > cap
	const wouldExceedCap =
		gate.requested_lane_count > gate.max_concurrent_lanes ||
		gate.active_lane_count + gate.requested_lane_count > gate.max_concurrent_lanes;

	if (wouldExceedCap) {
		return buildDecision({
			cadenceDecision: "blocked_window_cap",
			gateSatisfied: false,
			redactedBlockReason: "rolling-window-cap-exceeded",
			rollingWindowRequests,
			rollingWindowCap,
			rollingWindowSeconds,
			gateInput,
		});
	}

	// 3. blocked_low_novelty: noveltyScore present and below threshold
	if (
		gateInput.noveltyScore !== undefined &&
		gateInput.noveltyThreshold !== undefined &&
		gateInput.noveltyScore < gateInput.noveltyThreshold
	) {
		return buildDecision({
			cadenceDecision: "blocked_low_novelty",
			gateSatisfied: false,
			redactedBlockReason: "novelty-below-threshold",
			rollingWindowRequests,
			rollingWindowCap,
			rollingWindowSeconds,
			gateInput,
		});
	}

	// 4. blocked_budget: estimatedCostUnits exceeds budgetCapUnits
	if (
		gateInput.estimatedCostUnits !== undefined &&
		gateInput.budgetCapUnits !== undefined &&
		gateInput.estimatedCostUnits > gateInput.budgetCapUnits
	) {
		return buildDecision({
			cadenceDecision: "blocked_budget",
			gateSatisfied: false,
			redactedBlockReason: "estimated-cost-exceeds-budget",
			rollingWindowRequests,
			rollingWindowCap,
			rollingWindowSeconds,
			gateInput,
		});
	}

	// 5. allow — all constraints pass
	return buildDecision({
		cadenceDecision: "allow",
		gateSatisfied,
		rollingWindowRequests,
		rollingWindowCap,
		rollingWindowSeconds,
		gateInput,
	});
}

// ─── Internal helpers ─────────────────────────────────────────────────────────

interface BuildDecisionParams {
	cadenceDecision: FlowDeskFanoutCadenceDecisionOutcomeV1;
	gateSatisfied: boolean;
	redactedBlockReason?: string;
	rollingWindowRequests: number;
	rollingWindowCap: number;
	rollingWindowSeconds: number;
	cooldownRemainingSeconds?: number;
	gateInput: FlowDeskFanoutCadenceGateInputV1;
}

function buildDecision(params: BuildDecisionParams): FlowDeskFanoutCadenceDecisionV1 {
	const {
		cadenceDecision,
		gateSatisfied,
		redactedBlockReason,
		rollingWindowRequests,
		rollingWindowCap,
		rollingWindowSeconds,
		cooldownRemainingSeconds,
		gateInput,
	} = params;

	const decision: FlowDeskFanoutCadenceDecisionV1 = {
		schema_version: "flowdesk.fanout_cadence_decision.v1",
		cadence_decision: cadenceDecision,
		gate_satisfied: gateSatisfied,
		rolling_window_requests: rollingWindowRequests,
		rolling_window_cap: rollingWindowCap,
		rolling_window_seconds: rollingWindowSeconds,
		advisory_only: true,
		dispatch_authority_enabled: false,
		provider_call_authority_enabled: false,
	};

	if (redactedBlockReason !== undefined) {
		decision.redacted_block_reason = redactedBlockReason;
	}

	if (cooldownRemainingSeconds !== undefined) {
		decision.cooldown_remaining_seconds = cooldownRemainingSeconds;
	}

	if (gateInput.noveltyScore !== undefined) {
		decision.novelty_score = gateInput.noveltyScore;
	}

	if (gateInput.noveltyThreshold !== undefined) {
		decision.novelty_threshold = gateInput.noveltyThreshold;
	}

	if (gateInput.estimatedCostUnits !== undefined) {
		decision.estimated_cost_units = gateInput.estimatedCostUnits;
	}

	if (gateInput.budgetCapUnits !== undefined) {
		decision.budget_cap_units = gateInput.budgetCapUnits;
	}

	return decision;
}

/** Clamp a potentially-invalid number to a non-negative integer for display */
function sanitizeCount(value: unknown): number {
	if (typeof value === "number" && Number.isFinite(value) && value >= 0) {
		return Math.floor(value);
	}
	return 0;
}

/** Clamp a potentially-invalid number to a non-negative finite for display */
function sanitizeSeconds(value: unknown): number {
	if (typeof value === "number" && Number.isFinite(value) && value >= 0) {
		return value;
	}
	return 0;
}
