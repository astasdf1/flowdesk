import { mapProviderFailureClassToDiagnosticOutcomeV1 } from "./provider-failures.js";
import type { FlowDeskProviderHealthSnapshotV1, FlowDeskRetryRequestV1, FlowDeskRetryResponseV1, GuardCheckV1, OpaqueId, ProviderHealthSummaryV1, SafeNextAction } from "./release1-contracts.js";
import { providerHealthSnapshotToSummaryV1 } from "./status.js";
import { invalid, type ValidationResult, valid, validateOpaqueId, validateOpaqueRef, validateProviderHealthSnapshotV1, validateProviderHealthSummaryV1, validateRetryRequestV1, validateRetryResponseV1 } from "./validators.js";

export interface FlowDeskRetryPlanningInputV1 {
  request: FlowDeskRetryRequestV1;
  providerHealthSnapshot?: FlowDeskProviderHealthSnapshotV1;
  providerHealthSummary?: ProviderHealthSummaryV1;
  newAttemptId?: OpaqueId;
  auditRef?: string;
  debugRef?: string;
}

export interface FlowDeskRetryPlanningEvaluationV1 extends ValidationResult {
  response: FlowDeskRetryResponseV1;
  providerHealthSummary: ProviderHealthSummaryV1;
  dispatch_authorized: false;
  fallback_authorized: false;
  provider_call_authorized: false;
  hard_chat_authority: false;
}

const retryDiagnosticsOnlyActions = ["/flowdesk-doctor", "/flowdesk-usage", "/flowdesk-status", "/flowdesk-retry", "/flowdesk-export-debug"] as const satisfies readonly SafeNextAction[];
const retryPlanActions = ["/flowdesk-status", "/flowdesk-export-debug"] as const satisfies readonly SafeNextAction[];

function unknownProviderSummary(): ProviderHealthSummaryV1 {
  const diagnostic = mapProviderFailureClassToDiagnosticOutcomeV1("telemetry_ambiguous");
  return {
    provider_family: "unknown",
    availability_state: diagnostic.availability_state,
    failure_class: diagnostic.failure_class,
    dispatchability: diagnostic.dispatchability,
    safe_remediation: diagnostic.safe_remediation
  };
}

function requiredGuardChecks(ref?: string): GuardCheckV1[] {
  return [
    { check: "provider_health", result: "unknown", ...(ref === undefined ? {} : { ref }) },
    { check: "usage", result: "unknown" },
    { check: "runtime_compatibility", result: "unknown" },
    { check: "audit", result: "unknown" }
  ];
}

function safeOpaqueId(value: unknown, label: string): string | undefined {
  return validateOpaqueId(value, label).ok ? (value as string) : undefined;
}

function safeOpaqueRef(value: unknown, label: string): string | undefined {
  return validateOpaqueRef(value, label).ok ? (value as string) : undefined;
}

function resolveRetryAttemptId(input: FlowDeskRetryPlanningInputV1): OpaqueId {
  const explicitAttemptId = safeOpaqueId(input.newAttemptId, "new_attempt_id");
  if (explicitAttemptId !== undefined) return explicitAttemptId;
  const sourceAttemptId = safeOpaqueId(input.request?.attempt_id, "attempt_id");
  const derivedAttemptId = sourceAttemptId === undefined ? undefined : `${sourceAttemptId}-retry-plan`;
  return safeOpaqueId(derivedAttemptId, "new_attempt_id") ?? "attempt-retry-plan";
}

function resolveProviderHealthSummary(input: FlowDeskRetryPlanningInputV1): { summary: ProviderHealthSummaryV1; errors: string[] } {
  if (input.providerHealthSummary !== undefined) {
    const result = validateProviderHealthSummaryV1(input.providerHealthSummary);
    return { summary: result.ok ? input.providerHealthSummary : unknownProviderSummary(), errors: result.ok ? [] : result.errors };
  }
  if (input.providerHealthSnapshot !== undefined) {
    const result = validateProviderHealthSnapshotV1(input.providerHealthSnapshot);
    return { summary: result.ok ? providerHealthSnapshotToSummaryV1(input.providerHealthSnapshot) : unknownProviderSummary(), errors: result.ok ? [] : result.errors };
  }
  return { summary: unknownProviderSummary(), errors: [] };
}

function providerHealthAllowsRetryPlanning(summary: ProviderHealthSummaryV1): boolean {
  return summary.failure_class === "none" && summary.availability_state === "healthy" && summary.dispatchability !== "non_dispatchable";
}

export function buildFlowDeskRetryPlanningResponseV1(input: FlowDeskRetryPlanningInputV1): FlowDeskRetryResponseV1 {
  const safeInput = input ?? ({} as FlowDeskRetryPlanningInputV1);
  const requestResult = validateRetryRequestV1(safeInput.request);
  const { summary, errors: healthErrors } = resolveProviderHealthSummary(safeInput);
  const newAttemptId = resolveRetryAttemptId(safeInput);
  const workflowId = safeOpaqueId(safeInput.request?.workflow_id, "workflow_id");
  const auditRef = safeOpaqueRef(safeInput.auditRef, "audit_ref");
  const debugRef = safeOpaqueRef(safeInput.debugRef, "debug_ref");
  const providerFailureDiagnostic = mapProviderFailureClassToDiagnosticOutcomeV1(summary.failure_class);
  const blockedByProviderHealth = !providerHealthAllowsRetryPlanning(summary) || healthErrors.length > 0;
  const response: FlowDeskRetryResponseV1 = {
    schema_version: "flowdesk.retry.response.v1",
    ok: requestResult.ok && !blockedByProviderHealth,
    status: blockedByProviderHealth ? providerFailureDiagnostic.diagnostic_status : "diagnostic_only",
    ...(workflowId === undefined ? {} : { workflow_id: workflowId }),
    safe_next_actions: blockedByProviderHealth ? [...providerFailureDiagnostic.safe_next_actions] : [...retryPlanActions],
    user_message: blockedByProviderHealth ? "FlowDesk retry planning is diagnostic-only until provider health is safe and fresh." : "FlowDesk prepared a diagnostic retry plan without runtime execution.",
    ...(auditRef === undefined ? {} : { audit_ref: auditRef }),
    ...(debugRef === undefined ? {} : { debug_ref: debugRef }),
    ...(blockedByProviderHealth ? { error: { category: providerFailureDiagnostic.redacted_category, safe_remediation: providerFailureDiagnostic.safe_remediation } } : {}),
    new_attempt_id: newAttemptId,
    required_guard_checks: requiredGuardChecks(summary.snapshot_ref),
    retry_state: blockedByProviderHealth ? providerFailureDiagnostic.retry_state : "planned"
  };
  const responseResult = validateRetryResponseV1(response);
  if (!requestResult.ok || !responseResult.ok || healthErrors.length > 0) {
    return {
      schema_version: "flowdesk.retry.response.v1",
      ok: false,
      status: "blocked",
      ...(workflowId === undefined ? {} : { workflow_id: workflowId }),
      safe_next_actions: [...retryDiagnosticsOnlyActions],
      user_message: "FlowDesk retry planning is blocked until request and provider-health diagnostics are schema-safe.",
      ...(auditRef === undefined ? {} : { audit_ref: auditRef }),
      ...(debugRef === undefined ? {} : { debug_ref: debugRef }),
      error: { category: providerFailureDiagnostic.redacted_category, safe_remediation: providerFailureDiagnostic.safe_remediation },
      new_attempt_id: validateOpaqueId(newAttemptId, "new_attempt_id").ok ? newAttemptId : "attempt-retry-plan",
      required_guard_checks: requiredGuardChecks(summary.snapshot_ref),
      retry_state: "diagnostic_only"
    };
  }
  return response;
}

export function evaluateFlowDeskRetryPlanningV1(input: FlowDeskRetryPlanningInputV1): FlowDeskRetryPlanningEvaluationV1 {
  const safeInput = input ?? ({} as FlowDeskRetryPlanningInputV1);
  const requestResult = validateRetryRequestV1(safeInput.request);
  const response = buildFlowDeskRetryPlanningResponseV1(safeInput);
  const responseResult = validateRetryResponseV1(response);
  const { summary, errors: healthErrors } = resolveProviderHealthSummary(safeInput);
  const errors = [...requestResult.errors, ...responseResult.errors, ...healthErrors];
  if (errors.length > 0) {
    return { ...invalid(...errors), response, providerHealthSummary: summary, dispatch_authorized: false, fallback_authorized: false, provider_call_authorized: false, hard_chat_authority: false };
  }
  return { ...valid(), response, providerHealthSummary: summary, dispatch_authorized: false, fallback_authorized: false, provider_call_authorized: false, hard_chat_authority: false };
}
