import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";
import type { FlowDeskTopTierReviewerLaneProbeRequestV1 } from "./index.js";
import {
  FLOWDESK_TOP_TIER_REVIEWER_LANE_PROBE_CHANNELS,
  evaluateFlowDeskTopTierReviewerLaneProbeV1,
  validateTopTierReviewerLaneProbeResultV1
} from "./index.js";

function request(overrides: Partial<FlowDeskTopTierReviewerLaneProbeRequestV1> = {}): FlowDeskTopTierReviewerLaneProbeRequestV1 {
  return {
    schema_version: "flowdesk.top_tier_reviewer_lane_probe.request.v1",
    probe_id: "probe-1",
    binding_ref: "binding-claude_opus",
    lane_plan_ref: "lane-plan-policy_security",
    channel: "subtask_true_command_lane",
    agent_id: "reviewer",
    provider_qualified_model_id: "claude/claude-opus-4-5",
    perspective: "policy_security",
    auth_evidence_ref: "auth-evidence-claude_opus",
    usage_evidence_ref: "usage-evidence-claude_opus",
    quota_evidence_ref: "quota-evidence-claude_opus",
    provider_health_ref: "health-evidence-claude_opus",
    runtime_echo_ref: "echo-evidence-claude_opus",
    telemetry_ref: "telemetry-evidence-claude_opus",
    policy_pack_eligibility_ref: "policy-claude_opus",
    redaction_version: "redaction-v1",
    fake_runtime: true,
    dispatch_authority_enabled: false,
    ...overrides
  };
}

test("reviewer lane probe returns probe_pass for valid requests on both channels", () => {
  for (const channel of FLOWDESK_TOP_TIER_REVIEWER_LANE_PROBE_CHANNELS) {
    const result = evaluateFlowDeskTopTierReviewerLaneProbeV1(request({ channel, probe_id: `probe-${channel}` }));
    assert.equal(result.outcome, "probe_pass", channel);
    assert.equal(result.channel, channel);
    assert.equal(result.provider_call_made, false);
    assert.equal(result.lane_launch_made, false);
    assert.equal(result.dispatch_authority_enabled, false);
    assert.equal(validateTopTierReviewerLaneProbeResultV1(result).ok, true);
  }
});

test("reviewer lane probe fails closed when each individual evidence is missing", () => {
  const missingEvidence = ["auth", "usage", "quota", "provider_health", "runtime_echo", "telemetry"] as const;
  for (const slot of missingEvidence) {
    const result = evaluateFlowDeskTopTierReviewerLaneProbeV1(request(), { forceFailure: { label: `missing_${slot}`, missingEvidence: slot } });
    assert.equal(result.outcome, "probe_fail_closed", slot);
    assert.equal(result.failure_label, `missing_${slot}`, slot);
    assert.equal(result.provider_call_made, false);
    assert.equal(result.lane_launch_made, false);
    assert.equal(validateTopTierReviewerLaneProbeResultV1(result).ok, true);
  }
});

test("reviewer lane probe rejects alias model ids and silent lower-tier substitution", () => {
  const aliasModel = evaluateFlowDeskTopTierReviewerLaneProbeV1(request({ provider_qualified_model_id: "claude/latest" }));
  assert.equal(aliasModel.outcome, "probe_invalid");
  assert.equal(aliasModel.provider_call_made, false);

  const unknownProvider = evaluateFlowDeskTopTierReviewerLaneProbeV1(request({ provider_qualified_model_id: "unknown/some-model" as string }));
  assert.equal(unknownProvider.outcome, "probe_invalid");

  const camelModel = evaluateFlowDeskTopTierReviewerLaneProbeV1(request({ provider_qualified_model_id: "claude/Default" }));
  assert.equal(camelModel.outcome, "probe_invalid");
});

test("reviewer lane probe rejects requests that try to claim runtime authority", () => {
  const dispatchClaim = evaluateFlowDeskTopTierReviewerLaneProbeV1({ ...request(), dispatch_authority_enabled: true as unknown as false });
  assert.equal(dispatchClaim.outcome, "probe_invalid");

  const realRuntime = evaluateFlowDeskTopTierReviewerLaneProbeV1({ ...request(), fake_runtime: false as unknown as true });
  assert.equal(realRuntime.outcome, "probe_invalid");

  const guardClaim = evaluateFlowDeskTopTierReviewerLaneProbeV1({ ...request(), guard_approved_dispatch: "guard-1" } as Record<string, unknown>);
  assert.equal(guardClaim.outcome, "probe_invalid");

  const wrongAgent = evaluateFlowDeskTopTierReviewerLaneProbeV1(request({ agent_id: "executor" as unknown as "reviewer" }));
  assert.equal(wrongAgent.outcome, "probe_invalid");
});

test("reviewer lane probe rejects unknown channels and perspectives", () => {
  const unknownChannel = evaluateFlowDeskTopTierReviewerLaneProbeV1(request({ channel: "opencode_run_subprocess" as unknown as FlowDeskTopTierReviewerLaneProbeRequestV1["channel"] }));
  assert.equal(unknownChannel.outcome, "probe_invalid");

  const unknownPerspective = evaluateFlowDeskTopTierReviewerLaneProbeV1(request({ perspective: "release_engineering" as unknown as FlowDeskTopTierReviewerLaneProbeRequestV1["perspective"] }));
  assert.equal(unknownPerspective.outcome, "probe_invalid");
});

test("reviewer lane probe supports same-model multi-perspective fan-out without losing lane separation", () => {
  const perspectives = ["policy_security", "architecture", "verification_implementation"] as const;
  const results = perspectives.map((perspective) =>
    evaluateFlowDeskTopTierReviewerLaneProbeV1(request({
      probe_id: `probe-${perspective}`,
      binding_ref: "binding-claude_opus",
      lane_plan_ref: `lane-plan-${perspective}`,
      perspective
    }))
  );
  for (const result of results) {
    assert.equal(result.outcome, "probe_pass");
    assert.equal(result.provider_qualified_model_id, "claude/claude-opus-4-5");
    assert.equal(result.binding_ref, "binding-claude_opus");
    assert.equal(result.dispatch_authority_enabled, false);
    assert.equal(result.provider_call_made, false);
    assert.equal(result.lane_launch_made, false);
  }
  assert.equal(new Set(results.map((result) => result.probe_id)).size, perspectives.length, "each perspective must have a distinct probe id");
  assert.equal(new Set(results.map((result) => result.perspective)).size, perspectives.length, "each perspective must remain distinct");
  assert.equal(new Set(results.map((result) => result.lane_plan_ref)).size, perspectives.length, "each perspective must have a distinct lane plan ref");
  assert.equal(new Set(results.map((result) => result.binding_ref)).size, 1, "same model may share one binding ref without collapsing lanes");
  assert.equal(new Set(results.map((result) => result.evidence_refs.join(":"))).size, 1, "shared model should produce identical evidence ref set across perspectives");
});

test("reviewer lane probe build does not import opencode runtime, sdk client, or child process surfaces", () => {
  const probeBuild = readFileSync(join(import.meta.dirname, "top-tier-reviewer-lane-probe.js"), "utf8");
  for (const forbidden of ["@opencode-ai/sdk", "node:child_process", "require(\"child_process\")", "execFile", "spawn(", "opencode run"]) {
    assert.equal(probeBuild.includes(forbidden), false, `probe build must not reference ${forbidden}`);
  }
});
