import assert from "node:assert/strict";
import test from "node:test";
import {
  createFlowDeskReviewerLaneConformanceObservationV1,
  validateFlowDeskReviewerLaneConformanceObservationV1
} from "./index.js";

function observation(overrides: Partial<Parameters<typeof createFlowDeskReviewerLaneConformanceObservationV1>[0]> = {}) {
  return createFlowDeskReviewerLaneConformanceObservationV1({
    observation_id: "observation-1",
    workflow_id: "workflow-review-1",
    lane_id: "lane-review-1",
    binding_ref: "binding-claude-opus",
    lane_plan_ref: "lane-plan-policy-security",
    channel: "injected_sdk_client",
    agent_id: "reviewer",
    provider_qualified_model_id: "claude/claude-opus-4-5",
    perspective: "policy_security",
    prompt_hash_ref: "input-hash-1",
    output_ref: "review-output-1",
    runtime_echo_ref: "runtime-echo-1",
    telemetry_ref: "telemetry-1",
    parent_task_ref: "parent-task-1",
    subtask_ref: "subtask-1",
    observed_at: "2026-05-20T00:00:00.000Z",
    runtimeEchoObserved: true,
    telemetryObserved: true,
    parentChildRelationObserved: true,
    ...overrides
  });
}

test("reviewer lane conformance observation records observed runtime separation without dispatch authority", () => {
  const result = observation();
  assert.equal(result.status, "observed");
  assert.deepEqual(result.uncertainty_labels, []);
  assert.equal(result.dispatch_authority_enabled, false);
  assert.equal(result.hard_chat_authority_claimed, false);
  assert.equal(validateFlowDeskReviewerLaneConformanceObservationV1(result).ok, true);
});

test("reviewer lane conformance supports same-model multi-perspective observations", () => {
  const policy = observation({ observation_id: "observation-policy", lane_id: "lane-policy", lane_plan_ref: "lane-plan-policy", perspective: "policy_security", output_ref: "review-output-policy" });
  const architecture = observation({ observation_id: "observation-architecture", lane_id: "lane-architecture", lane_plan_ref: "lane-plan-architecture", perspective: "architecture", output_ref: "review-output-architecture" });

  assert.equal(policy.provider_qualified_model_id, architecture.provider_qualified_model_id);
  assert.notEqual(policy.lane_id, architecture.lane_id);
  assert.notEqual(policy.output_ref, architecture.output_ref);
  assert.equal(validateFlowDeskReviewerLaneConformanceObservationV1(policy).ok, true);
  assert.equal(validateFlowDeskReviewerLaneConformanceObservationV1(architecture).ok, true);
});

test("reviewer lane conformance records partial runtime proof as uncertainty instead of blocking construction", () => {
  const result = observation({
    runtime_echo_ref: undefined,
    parent_task_ref: undefined,
    subtask_ref: undefined,
    runtimeEchoObserved: false,
    parentChildRelationObserved: false
  });
  assert.equal(result.status, "partial");
  assert.ok(result.uncertainty_labels.includes("runtime_echo_partial"));
  assert.ok(result.uncertainty_labels.includes("parent_child_relation_unproven"));
  assert.equal(validateFlowDeskReviewerLaneConformanceObservationV1(result).ok, true);
});

test("reviewer lane conformance validator rejects authority smuggling and malformed bindings", () => {
  const authority = validateFlowDeskReviewerLaneConformanceObservationV1({ ...observation(), dispatch_authority_enabled: true });
  assert.equal(authority.ok, false);
  assert.match(authority.errors.join("; "), /dispatch authority/);

  const wrongAgent = validateFlowDeskReviewerLaneConformanceObservationV1({ ...observation(), agent_id: "build" });
  assert.equal(wrongAgent.ok, false);

  const rawPath = validateFlowDeskReviewerLaneConformanceObservationV1({ ...observation(), output_ref: "/Users/me/raw-output" });
  assert.equal(rawPath.ok, false);
});
