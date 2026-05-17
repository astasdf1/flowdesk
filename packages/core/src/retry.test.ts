import assert from "node:assert/strict";
import test from "node:test";
import type { FlowDeskProviderHealthSnapshotV1, FlowDeskRetryRequestV1, ProviderFailureClass } from "./index.js";
import { evaluateFlowDeskRetryPlanningV1, PROVIDER_FAILURE_CLASSES, validateRetryResponseV1 } from "./index.js";

const now = "2026-05-17T00:00:00.000Z";

function retryRequest(overrides: Partial<FlowDeskRetryRequestV1> = {}): FlowDeskRetryRequestV1 {
  return {
    schema_version: "flowdesk.retry.request.v1",
    request_id: "retry-request-123",
    input_mode: "test_fixture",
    workflow_id: "workflow-123",
    attempt_id: "attempt-123",
    retry_reason: "verification failed after fake-runtime diagnostics",
    ...overrides
  };
}

function providerHealth(failureClass: ProviderFailureClass, overrides: Partial<FlowDeskProviderHealthSnapshotV1> = {}): FlowDeskProviderHealthSnapshotV1 {
  const healthy = failureClass === "none";
  const modelUnavailable = failureClass === "model_unavailable";
  const unknown = failureClass === "telemetry_ambiguous" || failureClass === "transport_timeout";
  return {
    schema_version: "flowdesk.provider_health_snapshot.v1",
    snapshot_id: `health-${failureClass.replaceAll("_", "-")}`,
    provider_family: "opencode_go",
    model_family: modelUnavailable ? "model-ref-123" : "unknown",
    observed_at: now,
    freshness: healthy ? "fresh" : "unknown",
    freshness_ttl: healthy ? 5 : 0,
    source_surface: "doctor_probe",
    availability_state: healthy ? "healthy" : unknown ? "unknown" : modelUnavailable ? "unavailable" : "degraded",
    failure_class: failureClass,
    dispatchability: healthy ? "diagnostic_only" : "non_dispatchable",
    source_ref: "health-source-123",
    safe_remediation: "Run /flowdesk-doctor for redacted provider diagnostics.",
    ...overrides
  };
}

test("retry planning blocks provider failure classes as diagnostic-only without fallback or reselection", () => {
  for (const failureClass of PROVIDER_FAILURE_CLASSES.filter((candidate) => candidate !== "none")) {
    const evaluation = evaluateFlowDeskRetryPlanningV1({ request: retryRequest(), providerHealthSnapshot: providerHealth(failureClass), newAttemptId: `retry-${failureClass.replaceAll("_", "-")}` });
    assert.equal(validateRetryResponseV1(evaluation.response).ok, true, failureClass);
    assert.equal(evaluation.response.ok, false, failureClass);
    assert.equal(evaluation.response.retry_state, "diagnostic_only", failureClass);
    assert.notEqual(evaluation.response.status, "ready", failureClass);
    assert.equal(evaluation.response.safe_next_actions.includes("/flowdesk-run"), false, failureClass);
    assert.equal(evaluation.response.safe_next_actions.includes("/flowdesk-resume"), false, failureClass);
    assert.equal(JSON.stringify(evaluation.response).includes("fallback"), false, failureClass);
    assert.equal(JSON.stringify(evaluation.response).includes("reselect"), false, failureClass);
    assert.equal(evaluation.dispatch_authorized, false);
    assert.equal(evaluation.fallback_authorized, false);
    assert.equal(evaluation.provider_call_authorized, false);
    assert.equal(evaluation.hard_chat_authority, false);
  }
});

test("retry planning remains pure planning for healthy provider health", () => {
  const evaluation = evaluateFlowDeskRetryPlanningV1({ request: retryRequest(), providerHealthSnapshot: providerHealth("none"), newAttemptId: "attempt-retry-123", auditRef: "audit-123", debugRef: "debug-123" });
  assert.equal(evaluation.ok, true);
  assert.equal(evaluation.response.retry_state, "planned");
  assert.equal(evaluation.response.status, "diagnostic_only");
  assert.deepEqual(evaluation.response.safe_next_actions, ["/flowdesk-status", "/flowdesk-export-debug"]);
  assert.equal(validateRetryResponseV1(evaluation.response).ok, true);
  assert.equal(evaluation.dispatch_authorized, false);
  assert.equal(evaluation.fallback_authorized, false);
  assert.equal(evaluation.provider_call_authorized, false);
  assert.equal(evaluation.hard_chat_authority, false);
});

test("retry planning surfaces request and provider-health validation blockers without planned state", () => {
  const invalidRequest = retryRequest({ retry_reason: "fallback to another provider" });
  const requestEvaluation = evaluateFlowDeskRetryPlanningV1({ request: invalidRequest, providerHealthSnapshot: providerHealth("none") });
  assert.equal(requestEvaluation.ok, false);
  assert.equal(requestEvaluation.response.ok, false);
  assert.notEqual(requestEvaluation.response.retry_state, "planned");
  assert.ok(requestEvaluation.errors.some((error) => error.includes("retry_reason")));

  const invalidHealth = providerHealth("none", { safe_remediation: "Use automatic fallback or reselection." });
  const healthEvaluation = evaluateFlowDeskRetryPlanningV1({ request: retryRequest(), providerHealthSnapshot: invalidHealth });
  assert.equal(healthEvaluation.ok, false);
  assert.equal(healthEvaluation.response.ok, false);
  assert.notEqual(healthEvaluation.response.retry_state, "planned");
  assert.ok(healthEvaluation.errors.some((error) => error.includes("fallback") || error.includes("reselection")));
});

test("retry planning failure responses do not echo unsafe ids or refs", () => {
  const unsafeAttemptId = "attempt/../../raw-path";
  const evaluation = evaluateFlowDeskRetryPlanningV1({
    request: retryRequest({ attempt_id: unsafeAttemptId }),
    providerHealthSnapshot: providerHealth("none", { snapshot_id: "health/../../raw-path" }),
    newAttemptId: "/Users/example/raw-attempt" as never,
    auditRef: "/Users/example/raw-audit",
    debugRef: "debug-123"
  });
  assert.equal(evaluation.ok, false);
  assert.equal(validateRetryResponseV1(evaluation.response).ok, true);
  assert.equal(evaluation.response.new_attempt_id, "attempt-retry-plan");
  assert.equal(evaluation.response.workflow_id, "workflow-123");
  assert.equal(evaluation.response.audit_ref, undefined);
  assert.equal(evaluation.response.debug_ref, "debug-123");
  assert.equal(JSON.stringify(evaluation.response).includes(unsafeAttemptId), false);
  assert.equal(JSON.stringify(evaluation.response).includes("/Users/example"), false);
  assert.notEqual(evaluation.response.retry_state, "planned");
});

test("retry planning treats malformed provider health summaries as unknown diagnostics", () => {
  const evaluation = evaluateFlowDeskRetryPlanningV1({
    request: retryRequest(),
    providerHealthSummary: {
      provider_family: "opencode_go",
      availability_state: "healthy",
      failure_class: "raw_provider_failure",
      dispatchability: "diagnostic_only",
      safe_remediation: "Run /flowdesk-doctor for redacted provider diagnostics."
    } as never
  });
  assert.equal(evaluation.ok, false);
  assert.equal(validateRetryResponseV1(evaluation.response).ok, true);
  assert.equal(evaluation.providerHealthSummary.provider_family, "unknown");
  assert.equal(evaluation.response.retry_state, "diagnostic_only");
});
