import assert from "node:assert/strict";
import test from "node:test";
import type { FlowDeskHookHarnessRequestV1 } from "./index.js";
import {
  buildFlowDeskHookHarnessResponseV1,
  evaluateFlowDeskHookHarnessV1,
  validateHookHarnessRequestV1,
  validateHookHarnessResponseV1
} from "./index.js";

function request(overrides: Partial<FlowDeskHookHarnessRequestV1> = {}): FlowDeskHookHarnessRequestV1 {
  return {
    schema_version: "flowdesk.hook_harness.request.v1",
    request_id: "request-123",
    hook_harness_mode: "enforce",
    attempt_kind: "chat",
    requested_capability: "command_backed_flow",
    redacted_attempt_ref: "attempt-redacted-123",
    attempt_summary: "implement a guarded command-backed dashboard improvement",
    chat_intake_mode: "steering",
    conformance_ref: "conformance-123",
    ...overrides
  };
}

test("hook harness enforce routes safe requests without dispatch authority", () => {
  const result = evaluateFlowDeskHookHarnessV1(request({ requested_capability: "managed_plan" }));
  assert.equal(result.ok, true);
  assert.equal(validateHookHarnessResponseV1(result.response).ok, true);
  assert.equal(result.response.ok, true);
  assert.equal(result.response.decision, "route_command");
  assert.deepEqual(result.response.safe_next_actions, ["/flowdesk-plan", "/flowdesk-status"]);
  assert.equal(result.response.managed_automation_enabled, true);
  assert.equal(result.response.mutation_applied, true);
  assert.equal(result.response.privileged_automation_enabled, false);
  assert.equal(result.response.dispatch_authorized, false);
  assert.equal(result.response.guard_bypassed, false);
  assert.equal(result.response.fallback_authorized, false);
  assert.equal(result.response.hard_chat_authority, false);
});

test("hook harness enforce denies later-gate runtime authority", () => {
  const response = buildFlowDeskHookHarnessResponseV1(
    request({
      requested_capability: "real_dispatch",
      attempt_summary: "perform real dispatch with actual lane launch, automatic provider fallback, and noReply control"
    })
  );
  assert.equal(validateHookHarnessResponseV1(response).ok, true);
  assert.equal(response.ok, false);
  assert.equal(response.decision, "deny");
  assert.equal(response.denial_applied, true);
  assert.equal(response.safe_next_actions.includes("/flowdesk-run"), false);
  assert.equal(response.dispatch_authorized, false);
  assert.equal(response.fallback_authorized, false);
  assert.equal(response.hard_chat_authority, false);
});

test("hook harness observe mode records diagnostics without containment authority", () => {
  const response = buildFlowDeskHookHarnessResponseV1(request({ hook_harness_mode: "observe", requested_capability: "lane_launch", attempt_summary: "attempt actual lane launch" }));
  assert.equal(validateHookHarnessResponseV1(response).ok, true);
  assert.equal(response.ok, true);
  assert.equal(response.decision, "observe");
  assert.equal(response.managed_automation_enabled, false);
  assert.equal(response.mutation_applied, false);
  assert.equal(response.denial_applied, false);
  assert.equal(response.dispatch_authorized, false);
  assert.equal(response.guard_bypassed, false);
});

test("hook harness off mode leaves only safe manual fallback", () => {
  const response = buildFlowDeskHookHarnessResponseV1(request({ hook_harness_mode: "off", requested_capability: "real_dispatch", attempt_summary: "run real dispatch" }));
  assert.equal(validateHookHarnessResponseV1(response).ok, true);
  assert.equal(response.ok, true);
  assert.equal(response.decision, "off_fallback");
  assert.deepEqual(response.safe_next_actions, ["/flowdesk-doctor", "/flowdesk-status", "/flowdesk-export-debug"]);
  assert.equal(response.managed_automation_enabled, false);
  assert.equal(response.mutation_applied, false);
  assert.equal(response.denial_applied, false);
  assert.equal(response.dispatch_authorized, false);
  assert.equal(response.guard_bypassed, false);
});

test("hook harness validators reject forged authority fields and mode drift", () => {
  const response = buildFlowDeskHookHarnessResponseV1(request());
  assert.equal(validateHookHarnessResponseV1({ ...response, dispatch_authorized: true }).ok, false);
  assert.equal(validateHookHarnessResponseV1({ ...response, privileged_automation_enabled: true }).ok, false);
  assert.equal(validateHookHarnessResponseV1({ ...response, guard_bypassed: true }).ok, false);
  assert.equal(validateHookHarnessResponseV1({ ...response, fallback_authorized: true }).ok, false);
  assert.equal(validateHookHarnessResponseV1({ ...response, hard_chat_authority: true }).ok, false);
  assert.equal(validateHookHarnessResponseV1({ ...response, hook_harness_mode: "observe", mutation_applied: true }).ok, false);
  assert.equal(validateHookHarnessResponseV1({ ...response, hook_harness_mode: "observe", decision: "observe", managed_automation_enabled: false, mutation_applied: false, safe_next_actions: ["/flowdesk-run"] }).ok, false);
  assert.equal(validateHookHarnessResponseV1({ ...response, hook_harness_mode: "off", decision: "off_fallback", managed_automation_enabled: false, mutation_applied: false, safe_next_actions: ["/flowdesk-plan"] }).ok, false);
  assert.equal(validateHookHarnessResponseV1({ ...response, decision: "deny", safe_next_actions: ["/flowdesk-run"] }).ok, false);
});

test("hook harness enforce fails closed for unknown capability and missing conformance", () => {
  const unknown = buildFlowDeskHookHarnessResponseV1(request({ requested_capability: "unknown" }));
  assert.equal(validateHookHarnessResponseV1(unknown).ok, true);
  assert.equal(unknown.ok, false);
  assert.equal(unknown.decision, "deny");
  assert.equal(unknown.managed_automation_enabled, false);
  assert.equal(unknown.mutation_applied, false);

  const missingConformance = buildFlowDeskHookHarnessResponseV1(request({ conformance_ref: undefined }));
  assert.equal(validateHookHarnessResponseV1(missingConformance).ok, true);
  assert.equal(missingConformance.ok, false);
  assert.equal(missingConformance.decision, "deny");
  assert.equal(missingConformance.managed_automation_enabled, false);

  const safeManualWithoutConformance = buildFlowDeskHookHarnessResponseV1(request({ requested_capability: "safe_manual", conformance_ref: undefined }));
  assert.equal(validateHookHarnessResponseV1(safeManualWithoutConformance).ok, true);
  assert.equal(safeManualWithoutConformance.ok, true);
  assert.equal(safeManualWithoutConformance.decision, "allow_safe_manual");
  assert.equal(safeManualWithoutConformance.managed_automation_enabled, false);
});

test("hook harness blocks shell interpolation and pre-hook execution forms", () => {
  for (const attemptSummary of ["run shell interpolation $(rm -rf project)", "use $" + "{UNSAFE_COMMAND} before hook", "pre-hook execution should launch a tool"] as const) {
    const response = buildFlowDeskHookHarnessResponseV1(request({ attempt_kind: "shell", attempt_summary: attemptSummary }));
    assert.equal(validateHookHarnessResponseV1(response).ok, true);
    assert.equal(response.ok, false);
    assert.equal(response.decision, "deny");
    assert.equal(response.safe_next_actions.includes("/flowdesk-run"), false);
  }
});

test("hook harness request redaction fails closed without reflecting raw input", () => {
  const rawRequest = {
    ...request({ hook_harness_mode: "off" }),
    request_id: "bad request id",
    attempt_summary: "system prompt: raw provider response",
    provider_payload: "raw provider response"
  } as unknown as FlowDeskHookHarnessRequestV1;
  assert.equal(validateHookHarnessRequestV1(rawRequest).ok, false);
  const response = buildFlowDeskHookHarnessResponseV1(rawRequest);
  assert.equal(validateHookHarnessResponseV1(response).ok, true);
  assert.equal(response.ok, false);
  assert.equal(response.hook_harness_mode, "enforce");
  const text = JSON.stringify(response);
  assert.equal(/provider_payload|raw provider|system prompt|bad request id/i.test(text), false);
});
