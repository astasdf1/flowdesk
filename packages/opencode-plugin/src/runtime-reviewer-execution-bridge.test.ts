import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import {
	applyFlowDeskSessionEvidenceWriteIntentsV1,
	consumeFlowDeskProductionApprovalSourceV1,
	prepareFlowDeskSessionEvidenceWriteIntentV1,
	reloadFlowDeskSessionEvidenceV1,
} from "@flowdesk/core";
import { executeFlowDeskRuntimeReviewerExecutionBridgeV1 } from "./runtime-reviewer-execution-bridge.js";

const workflowId = "workflow-runtime-reviewer-bridge-focused";
const attemptId = "attempt-runtime-reviewer-bridge-focused";
const observedAt = "2026-05-17T00:05:00.000Z";
const perspective = "policy_security";

function runtimeLaneLaunchPlanRecord(overrides: Record<string, unknown> = {}) {
	return {
		schema_version: "flowdesk.runtime_lane_launch_plan.v1",
		ok: true,
		errors: [],
		launch_request_id: "launch-request-runtime-reviewer-bridge-focused",
		workflow_id: workflowId,
		attempt_id: attemptId,
		lane_id: "lane-runtime-reviewer-bridge-focused",
		state: "launch_ready",
		blocked_labels: [],
		parent_session_ref: "ses-parent-runtime-reviewer-bridge-focused",
		agent_ref: "agent-reviewer-gpt-frontier",
		provider_qualified_model_id: "openai/gpt-5.4-mini-fast",
		launch_reason: "reviewer_fanout",
		pre_launch_audit_ref: "audit-runtime-reviewer-bridge-focused",
		lane_launch_approval_ref: "approval-runtime-reviewer-bridge-focused",
		durable_evidence_root_ref: "evidence-root-runtime-reviewer-bridge-focused",
		lifecycle_evidence_class: "lane_lifecycle",
		exact_binding_confirmed: true,
		sdk_client_required: true,
		launch_attempted: false,
		dispatch_authority_enabled: false,
		providerCall: false,
		actualLaneLaunch: false,
		runtimeExecution: false,
		...overrides,
	};
}

function reviewerVerdictRecord() {
	return {
		schema_version: "flowdesk.top_tier_review_verdict.v1",
		verdict_id: "verdict-runtime-reviewer-bridge-focused",
		workflow_id: workflowId,
		attempt_id: attemptId,
		lane_id: "lane-runtime-reviewer-bridge-focused",
		lane_plan_ref: "lane-plan-runtime-reviewer-bridge-focused",
		binding_ref: "binding-runtime-reviewer-bridge-focused",
		perspective,
		source: "gpt_frontier",
		created_at: observedAt,
		scored_at: observedAt,
		redaction_version: "redaction-v1",
		findings: [],
		evidence_refs: ["evidence-runtime-reviewer-bridge-focused"],
		uncertainty: "low",
		required_fixes: [],
		verdict_label: "pass",
		safe_next_actions: ["/flowdesk-status"],
		dispatch_authority_enabled: false,
		guard_replacement_authority_enabled: false,
	};
}

function consumedReviewerFanoutApprovalRecord() {
	const result = consumeFlowDeskProductionApprovalSourceV1({
		approval: {
			schema_version: "flowdesk.production_approval_source.v1",
			approval_id: "approval-runtime-reviewer-bridge-focused",
			workflow_id: workflowId,
			attempt_id: attemptId,
			action_type: "reviewer_fanout",
			issuer_boundary: "external_user_confirmation",
			approval_method: "typed_phrase",
			actor_ref: "actor-runtime-reviewer-bridge-focused",
			profile_ref: "profile-runtime-reviewer-bridge-focused",
			provider_qualified_model_id: "openai/gpt-5.4-mini-fast",
			provider_binding_hash: "hash-provider-runtime-reviewer-bridge-focused",
			evidence_bundle_hash: "hash-evidence-runtime-reviewer-bridge-focused",
			guard_decision_ref: "guard-runtime-reviewer-bridge-focused",
			issuance_audit_ref: "audit-issuance-runtime-reviewer-bridge-focused",
			nonce_ref: "nonce-runtime-reviewer-bridge-focused",
			issued_at: "2026-05-17T00:00:00.000Z",
			expires_at: "2026-05-17T00:10:00.000Z",
			revoked: false,
			consume_strategy: "atomic_compare_and_swap_required",
			dispatch_authority_enabled: false,
		},
		workflowId,
		attemptId,
		actionType: "reviewer_fanout",
		actorRef: "actor-runtime-reviewer-bridge-focused",
		profileRef: "profile-runtime-reviewer-bridge-focused",
		providerQualifiedModelId: "openai/gpt-5.4-mini-fast",
		providerBindingHash: "hash-provider-runtime-reviewer-bridge-focused",
		evidenceBundleHash: "hash-evidence-runtime-reviewer-bridge-focused",
		guardDecisionRef: "guard-runtime-reviewer-bridge-focused",
		consumptionAuditRef: "audit-consumption-runtime-reviewer-bridge-focused",
		consumedAt: observedAt,
	});
	assert.ok(result.consumed_approval, result.errors.join("; "));
	return result.consumed_approval;
}

function runtimeReviewerExecutionExpectation() {
	return {
		launchPlanEvidenceId: "launch-plan-runtime-reviewer-bridge-focused",
		lanePlanRef: "lane-plan-runtime-reviewer-bridge-focused",
		bindingRef: "binding-runtime-reviewer-bridge-focused",
		perspective,
		promptText: "Return typed FlowDesk reviewer verdict for policy_security.",
		runningLifecycleEvidenceId: "lifecycle-running-runtime-reviewer-bridge-focused",
		completeLifecycleEvidenceId: "lifecycle-complete-runtime-reviewer-bridge-focused",
		reviewerVerdictEvidenceId: "reviewer-verdict-runtime-reviewer-bridge-focused",
		outputRef: "output-runtime-reviewer-bridge-focused",
		runtimeEchoRef: "runtime-echo-runtime-reviewer-bridge-focused",
		telemetryRef: "telemetry-runtime-reviewer-bridge-focused",
	};
}

function writeLaunchPlan(root: string, overrides: Record<string, unknown> = {}) {
	const prepared = prepareFlowDeskSessionEvidenceWriteIntentV1({
		workflowId,
		evidenceId: "launch-plan-runtime-reviewer-bridge-focused",
		record: runtimeLaneLaunchPlanRecord(overrides),
	});
	assert.equal(prepared.ok, true, prepared.errors.join("; "));
	assert.ok(prepared.writeIntent);
	const applied = applyFlowDeskSessionEvidenceWriteIntentsV1(root, [prepared.writeIntent]);
	assert.equal(applied.ok, true, applied.errors.join("; "));
}

type Outcome = "pass" | "missing_verdict" | "invocation_failed";

function fakeReviewerExecutionClient(outcome: Outcome) {
	const createCalls: unknown[] = [];
	const promptCalls: unknown[] = [];
	const messageCalls: unknown[] = [];
	return {
		client: {
			session: {
				async create(options: unknown) {
					createCalls.push(options);
					return { id: "child-runtime-reviewer-bridge-focused" };
				},
				async prompt(options: unknown) {
					promptCalls.push(options);
					return { info: { id: "message-runtime-reviewer-bridge-focused" } };
				},
				async messages(options: unknown) {
					messageCalls.push(options);
					if (outcome === "invocation_failed") throw new Error("messages failed");
					return [
						{
							info: { id: "message-runtime-reviewer-bridge-focused", role: "assistant", status: "complete" },
							parts: [
								{
									type: "text",
									text: outcome === "pass"
										? JSON.stringify(reviewerVerdictRecord())
										: "review complete without a typed verdict",

								},
							],
						},
					];
				},
			},
		},
		createCalls,
		promptCalls,
		messageCalls,
	};
}

function assertNoExecutionAuthority(result: Record<string, unknown>) {
	const authority = result.authority as Record<string, unknown> | undefined;
	assert.ok(authority);
	assert.notEqual(authority.dispatch_authority_enabled, true);
	assert.equal(authority.realOpenCodeDispatch, false);
	assert.notEqual(authority.fallback_authority_enabled, true);
	assert.equal(authority.fallbackAuthority, false);
	assert.equal(authority.providerCall, false);
	assert.equal(authority.actualLaneLaunch, false);
	assert.equal(authority.runtimeExecution, false);
}

function assertNoEvidenceAuthority(root: string) {
	const reloaded = reloadFlowDeskSessionEvidenceV1({ workflowId, rootDir: root });
	assert.equal(reloaded.ok, true, reloaded.errors.join("; "));
	for (const entry of reloaded.entries) {
		const record = entry.record as Record<string, unknown>;
		assert.notEqual(record.dispatch_authority_enabled, true, `${entry.evidenceId} dispatch authority`);
		assert.notEqual(record.fallback_authority_enabled, true, `${entry.evidenceId} fallback authority`);
		assert.notEqual(record.providerCall, true, `${entry.evidenceId} providerCall`);
		assert.notEqual(record.actualLaneLaunch, true, `${entry.evidenceId} actualLaneLaunch`);
		assert.notEqual(record.runtimeExecution, true, `${entry.evidenceId} runtimeExecution`);
	}
	return reloaded;
}

async function executeBridgeOutcome(root: string, outcome: Outcome) {
	writeLaunchPlan(root);
	const fake = fakeReviewerExecutionClient(outcome);
	const result = await executeFlowDeskRuntimeReviewerExecutionBridgeV1({
		client: fake.client as never,
		rootDir: root,
		request: {
			workflowId,
			attemptId,
			parentSessionId: "parent-runtime-reviewer-bridge-focused",
			allowActualLaneLaunch: true,
			observedAt,
			consumedReviewerFanoutApproval: consumedReviewerFanoutApprovalRecord(),
			verdictExpectations: [runtimeReviewerExecutionExpectation()],
			completionWait: { pollIntervalMs: 25, maxWaitMs: 75, quietPeriodMs: 0, stableSampleCount: 2 },
		},
	});
	return { result, fake };
}

test("runtime reviewer execution bridge records a typed pass verdict with schema version", async () => {
	const root = mkdtempSync(join(tmpdir(), "flowdesk-runtime-reviewer-bridge-pass-"));
	try {
		const { result, fake } = await executeBridgeOutcome(root, "pass");
		assert.equal(result.status, "runtime_reviewer_execution_completed");
		assert.equal(result.acceptanceStatus, "verdicts_accepted");
		assert.equal(result.durableLinkageStatus, "durable_verdicts_accepted");
		assert.equal(fake.createCalls.length, 1);
		assert.equal(fake.promptCalls.length, 1);
		assert.equal(fake.messageCalls.length, 1);
		assertNoExecutionAuthority(result);
		const reloaded = assertNoEvidenceAuthority(root);
		const verdictEntry = reloaded.entries.find((entry) => entry.evidenceClass === "reviewer_verdict");
		assert.ok(verdictEntry);
		assert.equal(verdictEntry.record.schema_version, "flowdesk.top_tier_review_verdict.v1");
	} finally {
		rmSync(root, { recursive: true, force: true });
	}
});

test("runtime reviewer execution bridge keeps missing verdict from becoming approval", async () => {
	const root = mkdtempSync(join(tmpdir(), "flowdesk-runtime-reviewer-bridge-missing-"));
	try {
		const { result } = await executeBridgeOutcome(root, "missing_verdict");
		assert.equal(result.status, "runtime_reviewer_execution_incomplete");
		assert.equal(result.acceptanceStatus, "blocked_before_acceptance");
		assert.equal(result.durableLinkageStatus, "blocked_before_durable_acceptance");
		assert.equal(result.linkedVerdictCount, 0);
		assert.deepEqual(result.acceptedPerspectives, []);
		const lane = (result.lanes as Array<Record<string, unknown>>)[0];
		assert.equal(lane.observationStatus, "missing_verdict");
		assert.equal(lane.completeLifecycle, "missing_verdict");
		assertNoExecutionAuthority(result);
		assertNoEvidenceAuthority(root);
	} finally {
		rmSync(root, { recursive: true, force: true });
	}
});

test("runtime reviewer execution bridge classifies completion read failure as invocation_failed", async () => {
	const root = mkdtempSync(join(tmpdir(), "flowdesk-runtime-reviewer-bridge-failed-"));
	try {
		const { result } = await executeBridgeOutcome(root, "invocation_failed");
		assert.equal(result.status, "runtime_reviewer_execution_incomplete");
		assert.equal(result.acceptanceStatus, "blocked_before_acceptance");
		assert.equal(result.durableLinkageStatus, "blocked_before_durable_acceptance");
		assert.equal(result.linkedVerdictCount, 0);
		const lane = (result.lanes as Array<Record<string, unknown>>)[0];
		assert.equal(lane.observationStatus, "completion_wait_failed");
		assert.equal(lane.completeLifecycle, "invocation_failed");
		assertNoExecutionAuthority(result);
		assertNoEvidenceAuthority(root);
	} finally {
		rmSync(root, { recursive: true, force: true });
	}
});

test("runtime reviewer execution bridge blocks placeholder parent session before SDK calls", async () => {
	const root = mkdtempSync(join(tmpdir(), "flowdesk-runtime-reviewer-bridge-placeholder-parent-"));
	try {
		writeLaunchPlan(root, { parent_session_ref: "ses--7Bid-7D" });
		const fake = fakeReviewerExecutionClient("pass");
		const result = await executeFlowDeskRuntimeReviewerExecutionBridgeV1({
			client: fake.client as never,
			rootDir: root,
			request: {
				workflowId,
				attemptId,
				parentSessionId: "%7Bid%7D",
				allowActualLaneLaunch: true,
				observedAt,
				consumedReviewerFanoutApproval: consumedReviewerFanoutApprovalRecord(),
				verdictExpectations: [runtimeReviewerExecutionExpectation()],
				completionWait: { pollIntervalMs: 25, maxWaitMs: 75, quietPeriodMs: 0, stableSampleCount: 2 },
			},
		});
		assert.equal(result.status, "runtime_reviewer_execution_incomplete");
		assert.equal(fake.createCalls.length, 0);
		assert.equal(fake.promptCalls.length, 0);
		assert.equal(fake.messageCalls.length, 0);
		const lane = (result.lanes as Array<Record<string, unknown>>)[0];
		assert.equal(lane.launchStatus, "blocked_before_lane_launch");
		assert.doesNotMatch(JSON.stringify(result), /%7Bid%7D|Expected a string starting|Error:/);
		assertNoExecutionAuthority(result);
	} finally {
		rmSync(root, { recursive: true, force: true });
	}
});

test("runtime reviewer execution bridge authority flags remain disabled for pass missing verdict and failure", async () => {
	for (const outcome of ["pass", "missing_verdict", "invocation_failed"] as const) {
		const root = mkdtempSync(join(tmpdir(), `flowdesk-runtime-reviewer-bridge-authority-${outcome}-`));
		try {
			const { result } = await executeBridgeOutcome(root, outcome);
			assertNoExecutionAuthority(result);
			assertNoEvidenceAuthority(root);
		} finally {
			rmSync(root, { recursive: true, force: true });
		}
	}
});
