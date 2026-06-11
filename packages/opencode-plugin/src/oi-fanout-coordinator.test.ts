/**
 * Tests for P7-S07: OI Fanout Coordinator (oi-fanout-coordinator.ts).
 *
 * Covers:
 *   1. cadence allow → fanout scoring advisory_completed
 *   2. cadence blocked_cooldown → blocked_cadence returned
 *   3. authority flags all false on every result variant
 *   4. provider_call_authority_enabled always false
 *   5. blocked_no_data when fewer than 2 model profiles provided
 *   6. cadenceDecision forwarded to executor (executor records skip_reason)
 */
import assert from "node:assert/strict";
import test from "node:test";
import {
	createFlowDeskModelCapabilityProfileV1,
	createFlowDeskR3FanoutReservationV1,
	createFlowDeskWorkflowPlanProposalV1,
	createFlowDeskWorkflowPlanProposalSetV1,
	type FlowDeskModelCapabilityProfileV1,
	type FlowDeskR3FanoutReservationV1,
	type FlowDeskWorkflowPlanProposalSetV1,
	type FlowDeskFanoutCadenceGateInputV1,
} from "@flowdesk/core";
import {
	runOIFanoutCoordinatorV1,
	type OIFanoutCoordinatorInputV1,
} from "./oi-fanout-coordinator.js";

// ─── Shared fixtures ──────────────────────────────────────────────────────────

const FIXED_NOW = "2026-06-11T00:00:00.000Z";
const FIXED_RESERVED_AT = "2026-06-11T00:00:00.000Z";
const FIXED_EXPIRES_AT = "2026-06-11T00:10:00.000Z"; // +10min > cadenceWindowSeconds=60s

function makeModelProfile(opts: {
	profileId: string;
	modelRef: string;
	providerQualifiedModelId: string;
	complexityHandlingScore?: number;
}): FlowDeskModelCapabilityProfileV1 {
	const result = createFlowDeskModelCapabilityProfileV1({
		profileId: opts.profileId,
		modelRef: opts.modelRef,
		providerQualifiedModelId: opts.providerQualifiedModelId,
		scoredAt: FIXED_NOW,
		categoryFitness: {
			schema_only: 7,
			implementation: 8,
			integration: 7,
			orchestration: 7,
			security_boundary: 7,
			design: 7,
		},
		complexityHandlingScore: opts.complexityHandlingScore ?? 7,
		authoritySensitivityScore: 6,
		evidenceRefs: ["evidence-test-oi-coord"],
		freshnessTtlSeconds: 604800,
	});
	assert.ok(result.ok, `createFlowDeskModelCapabilityProfileV1 failed: ${result.errors?.join("; ")}`);
	return result.profile!;
}

function makeReservation(overrides?: Partial<Parameters<typeof createFlowDeskR3FanoutReservationV1>[0]>): FlowDeskR3FanoutReservationV1 {
	const result = createFlowDeskR3FanoutReservationV1({
		reservationId: "res-abc123def4567890",
		attemptId: "attempt-oi-coord-test",
		workflowId: "workflow-oi-coord-test",
		admissionDecisionRef: "admission-ref-oi-coord",
		providerFamily: "claude",
		bucketLabel: "bucket-oi-coord",
		estimatedTokensReserved: 1000,
		dailyHardCapTokens: 100000,
		tokensAlreadyReservedToday: 0,
		reservedAt: FIXED_RESERVED_AT,
		expiresAt: FIXED_EXPIRES_AT,
		cadenceWindowSeconds: 60,
		status: "reserved",
		...overrides,
	});
	assert.ok(result.ok, `makeReservation failed: ${result.errors?.join("; ")}`);
	return result.reservation!;
}

function makeProposalSet(workflowId = "workflow-oi-coord-test"): FlowDeskWorkflowPlanProposalSetV1 {
	const makeProposal = (variant: "simple" | "standard" | "detailed" | "high_assurance") =>
		createFlowDeskWorkflowPlanProposalV1({
			proposalId: `proposal-coord-${variant}`,
			workflowId,
			proposalLabel: `${variant} proposal`,
			advisorySummaryRef: `summary-ref-coord-${variant}`,
			candidates: [
				{
					candidateRef: "candidate-coord-1",
					candidateLabel: "test-candidate",
					candidateSummaryRef: "summary-candidate-coord",
					hardFiltersPassed: true,
					blockedLabels: [],
				},
			],
			variant,
		});

	return createFlowDeskWorkflowPlanProposalSetV1({
		proposalSetId: "proposal-set-coord-1",
		workflowId,
		createdAt: FIXED_NOW,
		simpleProposal: makeProposal("simple"),
		standardProposal: makeProposal("standard"),
		detailedProposal: makeProposal("detailed"),
		highAssuranceProposal: makeProposal("high_assurance"),
		metadataRefs: ["metadata-ref-coord"],
		evidenceRefs: ["evidence-ref-coord"],
	});
}

/** cadence gate input that will produce "allow" */
function allowCadenceInput(): FlowDeskFanoutCadenceGateInputV1 {
	return {
		gateId: "gate-coord-test-allow",
		workflowId: "workflow-oi-coord-test",
		requestedLaneCount: 1,
		maxConcurrentLanes: 4,
		activeLaneCount: 0,
		cadenceWindowSeconds: 60,
		cooldownSeconds: 0,
		secondsSinceLastBurst: 999,
		reasonRefs: ["reason-coord-allow"],
	};
}

/** cadence gate input that will produce "blocked_cooldown" */
function cooldownCadenceInput(): FlowDeskFanoutCadenceGateInputV1 {
	return {
		gateId: "gate-coord-test-cooldown",
		workflowId: "workflow-oi-coord-test",
		requestedLaneCount: 1,
		maxConcurrentLanes: 4,
		activeLaneCount: 0,
		cadenceWindowSeconds: 60,
		cooldownSeconds: 30,
		secondsSinceLastBurst: 10,  // only 10s elapsed; 20s cooldown remaining
		reasonRefs: ["reason-coord-cooldown"],
	};
}

function baseCoordinatorInput(overrides: Partial<OIFanoutCoordinatorInputV1> = {}): OIFanoutCoordinatorInputV1 {
	return {
		workflowId: "workflow-oi-coord-test",
		taskId: "task-oi-coord-test",
		rootDir: "/tmp/flowdesk-test",
		cadenceInput: allowCadenceInput(),
		proposalSet: makeProposalSet(),
		selectedModels: [
			makeModelProfile({ profileId: "coord-model-a", modelRef: "coord-model-a", providerQualifiedModelId: "anthropic/claude-coord-a", complexityHandlingScore: 9 }),
			makeModelProfile({ profileId: "coord-model-b", modelRef: "coord-model-b", providerQualifiedModelId: "openai/gpt-coord-b", complexityHandlingScore: 7 }),
		],
		providerFamily: "claude",
		agentRole: "implementation",
		reservation: makeReservation(),
		admissionDecisionRef: "admission-ref-oi-coord",
		workflowSignatureRef: "sig-ref-oi-coord",
		evaluatedAt: FIXED_NOW,
		...overrides,
	};
}

// ─── Test 1: cadence allow → advisory_completed ────────────────────────────────

test("OI Fanout Coordinator: cadence allow → advisory_completed with fanout scores", () => {
	const result = runOIFanoutCoordinatorV1(baseCoordinatorInput());

	assert.equal(result.status, "advisory_completed", `expected advisory_completed, got ${result.status}`);
	assert.ok(result.fanoutResult !== undefined, "fanoutResult should be present when advisory_completed");
	assert.equal(result.cadenceDecision.cadence_decision, "allow");
	assert.equal(result.cadenceDecision.gate_satisfied, true);

	// Fanout aggregation checks
	const agg = result.fanoutResult!;
	assert.equal(agg.schema_version, "flowdesk.multi_model_aggregation.v1");
	assert.ok(agg.scored_model_count >= 2, `expected >= 2 scored models, got ${agg.scored_model_count}`);
	assert.ok(agg.best_composite_score >= 0 && agg.best_composite_score <= 1, "best_composite_score must be in [0,1]");
	// Model A (complexity=9) should win over model B (complexity=7)
	assert.equal(agg.best_model_ref, "coord-model-a", `expected coord-model-a to win, got ${agg.best_model_ref}`);
});

// ─── Test 2: cadence blocked_cooldown → blocked_cadence ───────────────────────

test("OI Fanout Coordinator: cadence blocked_cooldown → blocked_cadence (no fanout)", () => {
	const result = runOIFanoutCoordinatorV1(baseCoordinatorInput({
		cadenceInput: cooldownCadenceInput(),
	}));

	assert.equal(result.status, "blocked_cadence", `expected blocked_cadence, got ${result.status}`);
	assert.equal(result.fanoutResult, undefined, "fanoutResult must be absent when blocked_cadence");
	assert.equal(result.cadenceDecision.cadence_decision, "blocked_cooldown");
	assert.equal(result.cadenceDecision.gate_satisfied, false);
	assert.ok(
		result.cadenceDecision.cooldown_remaining_seconds !== undefined,
		"cooldown_remaining_seconds should be present",
	);
	assert.ok(typeof result.advisorySummary === "string" && result.advisorySummary.length > 0);
});

// ─── Test 3: authority flags all false on allow path ─────────────────────────

test("OI Fanout Coordinator: authority flags all false on advisory_completed path", () => {
	const result = runOIFanoutCoordinatorV1(baseCoordinatorInput());

	assert.equal(result.advisory_only, true, "advisory_only must be true");
	assert.equal(result.dispatch_authority_enabled, false, "dispatch_authority_enabled must be false");
	assert.equal(result.provider_call_authority_enabled, false, "provider_call_authority_enabled must be false");
	assert.equal(result.real_opencode_dispatch, false, "real_opencode_dispatch must be false");

	// Cadence decision also has authority flags false
	assert.equal(result.cadenceDecision.advisory_only, true);
	assert.equal(result.cadenceDecision.dispatch_authority_enabled, false);
	assert.equal(result.cadenceDecision.provider_call_authority_enabled, false);
});

// ─── Test 4: provider_call_authority_enabled false on blocked_cadence path ───

test("OI Fanout Coordinator: provider_call_authority_enabled false on blocked_cadence path", () => {
	const result = runOIFanoutCoordinatorV1(baseCoordinatorInput({
		cadenceInput: cooldownCadenceInput(),
	}));

	assert.equal(result.provider_call_authority_enabled, false, "provider_call_authority_enabled must be false even when blocked");
	assert.equal(result.dispatch_authority_enabled, false);
	assert.equal(result.real_opencode_dispatch, false);
	assert.equal(result.advisory_only, true);
});

// ─── Test 5: blocked_no_data when fewer than 2 models ─────────────────────────

test("OI Fanout Coordinator: blocked_no_data when fewer than 2 model profiles", () => {
	// Zero models
	const zeroResult = runOIFanoutCoordinatorV1(baseCoordinatorInput({
		selectedModels: [],
	}));
	assert.equal(zeroResult.status, "blocked_no_data", `expected blocked_no_data with 0 models, got ${zeroResult.status}`);
	assert.equal(zeroResult.fanoutResult, undefined);
	assert.equal(zeroResult.advisory_only, true);
	assert.equal(zeroResult.dispatch_authority_enabled, false);
	assert.equal(zeroResult.provider_call_authority_enabled, false);
	assert.equal(zeroResult.real_opencode_dispatch, false);

	// One model (edge case)
	const oneResult = runOIFanoutCoordinatorV1(baseCoordinatorInput({
		selectedModels: [
			makeModelProfile({ profileId: "solo-model", modelRef: "solo-model", providerQualifiedModelId: "anthropic/claude-solo", complexityHandlingScore: 8 }),
		],
	}));
	assert.equal(oneResult.status, "blocked_no_data", `expected blocked_no_data with 1 model, got ${oneResult.status}`);
	assert.equal(oneResult.fanoutResult, undefined);
});

// ─── Test 6: cadenceDecision forwarded — executor records skip_reason ─────────

test("OI Fanout Coordinator: cadence blocked_window_cap produces blocked_cadence with correct decision label", () => {
	// window cap: active=3 + requested=2 > max=4
	const windowCapInput: FlowDeskFanoutCadenceGateInputV1 = {
		gateId: "gate-coord-window-cap",
		workflowId: "workflow-oi-coord-test",
		requestedLaneCount: 2,
		maxConcurrentLanes: 4,
		activeLaneCount: 3,
		cadenceWindowSeconds: 60,
		cooldownSeconds: 0,
		secondsSinceLastBurst: 999,
		reasonRefs: ["reason-window-cap"],
	};

	const result = runOIFanoutCoordinatorV1(baseCoordinatorInput({
		cadenceInput: windowCapInput,
	}));

	assert.equal(result.status, "blocked_cadence");
	assert.equal(result.cadenceDecision.cadence_decision, "blocked_window_cap");
	assert.equal(result.cadenceDecision.gate_satisfied, false);
	assert.equal(result.fanoutResult, undefined);

	// All authority flags still false
	assert.equal(result.advisory_only, true);
	assert.equal(result.dispatch_authority_enabled, false);
	assert.equal(result.provider_call_authority_enabled, false);
	assert.equal(result.real_opencode_dispatch, false);
});
