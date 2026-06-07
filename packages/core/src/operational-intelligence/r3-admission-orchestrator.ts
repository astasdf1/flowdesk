/**
 * R3 Admission Orchestrator: evaluateR3AdmissionV1
 * Composes surplus gate, reuse gate, and cadence gate into a single admission decision
 * and creates a fanout reservation when appropriate.
 *
 * Gate evaluation order matches deriveExecutionMode in admission.ts:
 *   1. Surplus gate (blocked → skipped)
 *   2. Reuse gate (reuse → skipped)
 *   3. Cadence gate (blocked/hold → skipped, reduce → multi_variant, allow → multi_model/single_model)
 *
 * All outputs are advisory-only with no dispatch, runtime, or authority grants.
 * release_gate: "operational_intelligence_later_gate"
 */
import {
	type FlowDeskScoreReuseThresholdGateV1,
	type FlowDeskSurplusUsageGateV1,
	type FlowDeskFanoutCadenceGateV1,
	createFlowDeskScoreReuseThresholdGateV1,
	createFlowDeskSurplusUsageGateV1,
	createFlowDeskFanoutCadenceGateV1,
} from "./gates.js";
import {
	type FlowDeskR3AdmissionDecisionV1,
	type FlowDeskR3FanoutReservationV1,
	createFlowDeskR3AdmissionDecisionV1,
	createFlowDeskR3FanoutReservationV1,
} from "./admission.js";
import type { FlowDeskTaskBlockScoringV1 } from "./task-block-scoring.js";

// ─── Input / Output interfaces ─────────────────────────────────────────────────

export interface FlowDeskR3AdmissionOrchestrationInputV1 {
	workflowId: string;
	attemptId: string;
	workflowSignatureRef: string;
	blockScoring: FlowDeskTaskBlockScoringV1;
	// Reuse gate inputs
	previousScoreRef: string;
	previousContextHash: string;
	currentContextHash: string;
	scoreAgeSeconds: number;
	maxAgeThresholdSeconds: number;
	previousAdvisoryScore: number;
	reasonRefsReuse: string[];
	// Surplus gate inputs
	usageSnapshotRef: string;
	usageSnapshotHash: string;
	snapshotCapturedAt: string;
	providerFamily: "claude" | "openai" | "gemini";
	bucketLabel: string;
	remainingPercent: number;
	surplusThresholdPercent: number;
	alertLevel: "ok" | "warning" | "critical" | "exhausted" | "stale" | "unknown";
	maxSnapshotAgeSeconds: number;
	reasonRefsSurplus: string[];
	// Cadence gate inputs
	requestedLaneCount: number;
	maxConcurrentLanes: number;
	activeLaneCount: number;
	cadenceWindowSeconds: number;
	cooldownSeconds: number;
	secondsSinceLastBurst: number;
	reasonRefsCadence: string[];
	// Reservation inputs
	estimatedTokensReserved: number;
	dailyHardCapTokens: number;
	reservationTtlSeconds: number;
	// Config
	configRef: string;
	evaluatedAt: string; // ISO timestamp
}

export interface FlowDeskR3AdmissionOrchestrationResultV1 {
	status: "admission_reserved" | "admission_skipped" | "blocked_before_admission";
	admissionDecision?: FlowDeskR3AdmissionDecisionV1;
	reservation?: FlowDeskR3FanoutReservationV1;
	reuseGate?: FlowDeskScoreReuseThresholdGateV1;
	surplusGate?: FlowDeskSurplusUsageGateV1;
	cadenceGate?: FlowDeskFanoutCadenceGateV1;
	errors: string[];
	advisory_only: true;
	non_authorizing: true;
	dispatch_authority_enabled: false;
}

// ─── ID generation helpers ─────────────────────────────────────────────────────

function makeOpaqueId(prefix: string): string {
	const hex = Array.from({ length: 16 }, () => Math.floor(Math.random() * 16).toString(16)).join("");
	return `${prefix}-${hex}`;
}

function makeReservationId(): string {
	const hex = Array.from({ length: 16 }, () => Math.floor(Math.random() * 16).toString(16)).join("");
	return `res-${hex}`;
}

// ─── Orchestrator ──────────────────────────────────────────────────────────────

/**
 * evaluateR3AdmissionV1 — compose surplus → reuse → cadence gates into a single
 * advisory admission decision and optional fanout reservation.
 *
 * Gate evaluation order (mirrors deriveExecutionMode in admission.ts):
 *   1. surplus_gate_verdict !== "allow" → skipped
 *   2. reuse_gate_decision === "reuse" → skipped
 *   3. cadence_gate_decision === "blocked" → skipped
 *   4. cadence_gate_decision === "hold" → skipped
 *   5. cadence_gate_decision === "reduce" → multi_variant_single_model (reservation created)
 *   6. cadence_gate_decision === "allow" && reuse_gate_decision === "recompute" → multi_model_fanout (reservation created)
 *   7. else → single_model (no reservation)
 */
export function evaluateR3AdmissionV1(
	input: FlowDeskR3AdmissionOrchestrationInputV1,
): FlowDeskR3AdmissionOrchestrationResultV1 {
	const errors: string[] = [];

	// ── Compute snapshot_age_seconds from evaluatedAt vs snapshotCapturedAt ──
	let snapshotAgeSeconds = 0;
	const evaluatedAtMs = Date.parse(input.evaluatedAt);
	const snapshotCapturedAtMs = Date.parse(input.snapshotCapturedAt);
	if (Number.isFinite(evaluatedAtMs) && Number.isFinite(snapshotCapturedAtMs)) {
		snapshotAgeSeconds = Math.max(0, (evaluatedAtMs - snapshotCapturedAtMs) / 1000);
	}

	// ── Step 1: Evaluate surplus usage gate ────────────────────────────────────
	const surplusGateResult = createFlowDeskSurplusUsageGateV1({
		gateId: makeOpaqueId("gate"),
		workflowId: input.workflowId,
		snapshotRef: input.usageSnapshotRef,
		snapshotHash: input.usageSnapshotHash,
		snapshotCapturedAt: input.snapshotCapturedAt,
		evaluatedAt: input.evaluatedAt,
		snapshotAgeSeconds,
		maxSnapshotAgeSeconds: input.maxSnapshotAgeSeconds,
		providerFamily: input.providerFamily,
		bucketLabel: input.bucketLabel,
		remainingPercent: input.remainingPercent,
		surplusThresholdPercent: input.surplusThresholdPercent,
		alertLevel: input.alertLevel,
		reasonRefs: input.reasonRefsSurplus,
	});

	if (!surplusGateResult.ok || surplusGateResult.gate === undefined) {
		errors.push(...surplusGateResult.errors.map((e) => `surplus_gate: ${e}`));
		return {
			status: "blocked_before_admission",
			errors,
			advisory_only: true,
			non_authorizing: true,
			dispatch_authority_enabled: false,
		};
	}
	const surplusGate = surplusGateResult.gate;

	// ── Step 2: Evaluate score reuse gate ──────────────────────────────────────
	const reuseGateResult = createFlowDeskScoreReuseThresholdGateV1({
		gateId: makeOpaqueId("gate"),
		workflowId: input.workflowId,
		previousScoreRef: input.previousScoreRef,
		previousContextHash: input.previousContextHash,
		currentContextHash: input.currentContextHash,
		scoreAgeSeconds: input.scoreAgeSeconds,
		maxAgeThresholdSeconds: input.maxAgeThresholdSeconds,
		previousAdvisoryScore: input.previousAdvisoryScore,
		reasonRefs: input.reasonRefsReuse,
		evaluatedAt: input.evaluatedAt,
	});

	if (!reuseGateResult.ok || reuseGateResult.gate === undefined) {
		errors.push(...reuseGateResult.errors.map((e) => `reuse_gate: ${e}`));
		return {
			status: "blocked_before_admission",
			surplusGate,
			errors,
			advisory_only: true,
			non_authorizing: true,
			dispatch_authority_enabled: false,
		};
	}
	const reuseGate = reuseGateResult.gate;

	// ── Step 3: Evaluate fanout cadence gate ──────────────────────────────────
	const cadenceGateResult = createFlowDeskFanoutCadenceGateV1({
		gateId: makeOpaqueId("gate"),
		workflowId: input.workflowId,
		requestedLaneCount: input.requestedLaneCount,
		maxConcurrentLanes: input.maxConcurrentLanes,
		activeLaneCount: input.activeLaneCount,
		cadenceWindowSeconds: input.cadenceWindowSeconds,
		cooldownSeconds: input.cooldownSeconds,
		secondsSinceLastBurst: input.secondsSinceLastBurst,
		reasonRefs: input.reasonRefsCadence,
		evaluatedAt: input.evaluatedAt,
	});

	if (!cadenceGateResult.ok || cadenceGateResult.gate === undefined) {
		errors.push(...cadenceGateResult.errors.map((e) => `cadence_gate: ${e}`));
		return {
			status: "blocked_before_admission",
			surplusGate,
			reuseGate,
			errors,
			advisory_only: true,
			non_authorizing: true,
			dispatch_authority_enabled: false,
		};
	}
	const cadenceGate = cadenceGateResult.gate;

	// ── Step 4: Derive execution mode and skip reason ─────────────────────────
	// Gate order from admission.ts deriveExecutionMode:
	// 1. surplus_gate_verdict !== "allow" → skipped
	// 2. reuse_gate_decision === "reuse" → skipped
	// 3. cadence_gate_decision === "blocked" → skipped
	// 4. cadence_gate_decision === "hold" → skipped
	// 5. cadence_gate_decision === "reduce" → multi_variant_single_model
	// 6. cadence_gate_decision === "allow" && reuse_gate_decision === "recompute" → multi_model_fanout
	// 7. else → single_model

	const surplusVerdict = surplusGate.gate_verdict;
	const reuseDecision = reuseGate.gate_decision;
	const cadenceDecision = cadenceGate.gate_decision;

	let skipReason: string | undefined;
	if (surplusVerdict !== "allow") {
		skipReason = `skip-surplus-${surplusVerdict}`;
	} else if (reuseDecision === "reuse") {
		skipReason = "skip-reuse-gate-reuse";
	} else if (cadenceDecision === "blocked") {
		skipReason = "skip-cadence-blocked";
	} else if (cadenceDecision === "hold") {
		skipReason = "skip-cadence-hold";
	}

	const isSkipped = skipReason !== undefined;
	const needsReservation = !isSkipped && (cadenceDecision === "reduce" || cadenceDecision === "allow");

	// ── Step 5: Create reservation first (if needed) ──────────────────────────
	// Write order: reservation record → admission decision (per spec)
	let reservation: FlowDeskR3FanoutReservationV1 | undefined;
	let reservationId: string | undefined;

	if (needsReservation) {
		reservationId = makeReservationId();
		const reservedAt = input.evaluatedAt;
		const reservedAtMs = Date.parse(reservedAt);
		const expiresAtMs = reservedAtMs + input.reservationTtlSeconds * 1000;
		const expiresAt = new Date(expiresAtMs).toISOString();

		const reservationResult = createFlowDeskR3FanoutReservationV1({
			reservationId,
			attemptId: input.attemptId,
			workflowId: input.workflowId,
			admissionDecisionRef: `admission-decision-ref-pending-${reservationId}`,
			providerFamily: input.providerFamily,
			bucketLabel: input.bucketLabel,
			estimatedTokensReserved: input.estimatedTokensReserved,
			dailyHardCapTokens: input.dailyHardCapTokens,
			tokensAlreadyReservedToday: 0,
			reservedAt,
			expiresAt,
			cadenceWindowSeconds: input.cadenceWindowSeconds,
			status: "reserved",
		});

		if (!reservationResult.ok || reservationResult.reservation === undefined) {
			errors.push(...reservationResult.errors.map((e) => `reservation: ${e}`));
			return {
				status: "blocked_before_admission",
				surplusGate,
				reuseGate,
				cadenceGate,
				errors,
				advisory_only: true,
				non_authorizing: true,
				dispatch_authority_enabled: false,
			};
		}
		reservation = reservationResult.reservation;
	}

	// ── Step 6: Create admission decision ────────────────────────────────────
	const combinedSnapshotHash = surplusGate.snapshot_hash;

	const admissionResult = createFlowDeskR3AdmissionDecisionV1({
		decisionId: makeOpaqueId("decision"),
		workflowId: input.workflowId,
		workflowSignatureRef: input.workflowSignatureRef,
		attemptId: input.attemptId,
		surplusGateRef: surplusGate.gate_id,
		surplusGateVerdict: surplusVerdict,
		reuseGateRef: reuseGate.gate_id,
		reuseGateDecision: reuseDecision,
		cadenceGateRef: cadenceGate.gate_id,
		cadenceGateDecision: cadenceDecision,
		combinedSnapshotHash,
		decidedAt: input.evaluatedAt,
		configRef: input.configRef,
		...(isSkipped ? { skipReason } : {}),
		...(reservationId !== undefined ? { reservationId } : {}),
	});

	if (!admissionResult.ok || admissionResult.decision === undefined) {
		errors.push(...admissionResult.errors.map((e) => `admission_decision: ${e}`));
		return {
			status: "blocked_before_admission",
			surplusGate,
			reuseGate,
			cadenceGate,
			reservation,
			errors,
			advisory_only: true,
			non_authorizing: true,
			dispatch_authority_enabled: false,
		};
	}
	const admissionDecision = admissionResult.decision;

	// ── Step 7: Return result ──────────────────────────────────────────────────
	const status = isSkipped ? "admission_skipped" : "admission_reserved";

	return {
		status,
		admissionDecision,
		...(reservation !== undefined ? { reservation } : {}),
		reuseGate,
		surplusGate,
		cadenceGate,
		errors: [],
		advisory_only: true,
		non_authorizing: true,
		dispatch_authority_enabled: false,
	};
}
