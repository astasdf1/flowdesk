import type {
  FlowDeskHookHarnessRequestV1,
  FlowDeskHookHarnessResponseV1,
  HookHarnessCapabilityV1,
  SafeNextAction
} from "./release1-contracts.js";
import type { ValidationResult } from "./validators.js";
import { invalid, valid, validateHookHarnessRequestV1, validateHookHarnessResponseV1, validateOpaqueId, validateOpaqueRef } from "./validators.js";

export interface FlowDeskHookHarnessEvaluationV1 extends ValidationResult {
  response: FlowDeskHookHarnessResponseV1;
}

const safeManualActions = ["/flowdesk-doctor", "/flowdesk-status", "/flowdesk-export-debug"] as const;
const offFallbackActions = ["/flowdesk-doctor", "/flowdesk-status", "/flowdesk-export-debug"] as const;
const privilegedCapabilities = new Set<HookHarnessCapabilityV1>([
  "privileged_automation",
  "real_dispatch",
  "provider_call",
  "lane_launch",
  "managed_fallback",
  "hard_chat_control"
]);
const unsafeLaterGatePattern = /\b(real[\s_-]*(?:opencode[\s_-]*)?dispatch|realOpenCodeDispatch|actual[\s_-]*lane[\s_-]*launch|actualLaneLaunch|provider[\s_-]*(?:call|request|api)|providerCall|automatic[\s_-]*(?:fallback|reselection)|automaticFallbackOrReselection|fallback[\s_-]*(?:provider|model|authority)|fallbackAuthority|reselect(?:ion)?|hard[\s_-]*(?:cancel|stop|no[\s_-]*reply)|hardCancelOrNoReply|noReply|no[\s_-]*reply|cancel:\s*true|stop:\s*true|opencode[\s_-]*run)\b/i;
const unsafeShellExecutionPattern = /(?:\$\(|\$\{|`|\b(?:shell[\s_-]*interpolation|command[\s_-]*template[\s_-]*interpolation|pre[\s_-]*hook[\s_-]*(?:execution|exec|run)|before[\s_-]*hook[\s_-]*(?:execution|exec|run))\b)/i;

function uniqueActions(actions: readonly SafeNextAction[]): SafeNextAction[] {
  return [...new Set(actions)].slice(0, 8);
}

function redactedAttemptRef(request: Partial<FlowDeskHookHarnessRequestV1> | undefined): string {
  const candidate = request?.redacted_attempt_ref;
  return typeof candidate === "string" && validateOpaqueRef(candidate, "redacted_attempt_ref").ok ? candidate : "attempt-redacted";
}

function baseResponse(request: Partial<FlowDeskHookHarnessRequestV1> | undefined, fields: Omit<FlowDeskHookHarnessResponseV1, "schema_version" | "request_id" | "hook_harness_mode" | "redacted_attempt_ref" | "privileged_automation_enabled" | "dispatch_authorized" | "guard_bypassed" | "fallback_authorized" | "hard_chat_authority">): FlowDeskHookHarnessResponseV1 {
  return {
    schema_version: "flowdesk.hook_harness.response.v1",
    request_id: validateOpaqueId(request?.request_id, "request_id").ok ? request?.request_id ?? "request-redacted" : "request-redacted",
    hook_harness_mode: request?.hook_harness_mode === "observe" || request?.hook_harness_mode === "off" ? request.hook_harness_mode : "enforce",
    redacted_attempt_ref: redactedAttemptRef(request),
    privileged_automation_enabled: false,
    dispatch_authorized: false,
    guard_bypassed: false,
    fallback_authorized: false,
    hard_chat_authority: false,
    ...fields
  };
}

function schemaFailedResponse(request: Partial<FlowDeskHookHarnessRequestV1> | undefined): FlowDeskHookHarnessResponseV1 {
  return baseResponse({ ...request, hook_harness_mode: "enforce" }, {
    ok: false,
    decision: "deny",
    diagnostic_observations: ["Hook harness input failed redacted schema validation."],
    safe_next_actions: [...safeManualActions],
    user_message: "FlowDesk blocked this hook harness request before evaluation because the redacted contract was invalid.",
    managed_automation_enabled: false,
    mutation_applied: false,
    denial_applied: true
  });
}

function classifyCommandActions(summary: string, capability: HookHarnessCapabilityV1): SafeNextAction[] {
  if (/\b(status|progress|checkpoint)\b/i.test(summary)) return ["/flowdesk-status"];
  if (/\b(doctor|diagnos(?:e|tic)|compatibility|health)\b/i.test(summary)) return ["/flowdesk-doctor"];
  if (/\b(resume|continue from checkpoint)\b/i.test(summary)) return ["/flowdesk-status", "/flowdesk-resume"];
  if (/\b(retry|try again)\b/i.test(summary)) return ["/flowdesk-status", "/flowdesk-retry"];
  if (/\b(abort|cancel workflow|stop workflow)\b/i.test(summary)) return ["/flowdesk-status", "/flowdesk-abort"];
  if (/\b(usage|quota|limit)\b/i.test(summary)) return ["/flowdesk-usage", "/flowdesk-doctor"];
  if (/\b(debug export|export debug|debug bundle|logs?)\b/i.test(summary)) return ["/flowdesk-export-debug", "/flowdesk-status"];
  if (capability === "managed_plan" || capability === "command_backed_flow") return ["/flowdesk-plan", "/flowdesk-status"];
  return ["/flowdesk-status", "/flowdesk-doctor"];
}

function isUnsafeLaterGate(request: FlowDeskHookHarnessRequestV1): boolean {
  return request.requested_capability === "unknown" || privilegedCapabilities.has(request.requested_capability) || unsafeLaterGatePattern.test(request.attempt_summary) || unsafeShellExecutionPattern.test(request.attempt_summary);
}

function lacksManagedConformanceProof(request: FlowDeskHookHarnessRequestV1): boolean {
  return request.hook_harness_mode === "enforce" && request.requested_capability !== "safe_manual" && request.conformance_ref === undefined;
}

export function buildFlowDeskHookHarnessResponseV1(request: FlowDeskHookHarnessRequestV1): FlowDeskHookHarnessResponseV1 {
  if (!validateHookHarnessRequestV1(request).ok) return schemaFailedResponse(request);

  if (request.hook_harness_mode === "observe") {
    return baseResponse(request, {
      ok: true,
      decision: "observe",
      diagnostic_observations: [isUnsafeLaterGate(request) ? "Observed a later-gate or privileged automation attempt without containment authority." : "Observed a safe manual or command-backed request."],
      safe_next_actions: [...safeManualActions],
      user_message: "FlowDesk hook harness is observing only; it did not mutate, deny, authorize dispatch, or claim containment authority.",
      managed_automation_enabled: false,
      mutation_applied: false,
      denial_applied: false
    });
  }

  if (request.hook_harness_mode === "off") {
    return baseResponse(request, {
      ok: true,
      decision: "off_fallback",
      diagnostic_observations: ["Managed hook harness automation is off; Guard remains required for privileged behavior."],
      safe_next_actions: [...offFallbackActions],
      user_message: "Managed FlowDesk automation is off. Safe manual setup, status, diagnostics, and fallback commands remain available.",
      managed_automation_enabled: false,
      mutation_applied: false,
      denial_applied: false
    });
  }

  if (isUnsafeLaterGate(request) || lacksManagedConformanceProof(request)) {
    return baseResponse(request, {
      ok: false,
      decision: "deny",
      diagnostic_observations: [lacksManagedConformanceProof(request) ? "Denied managed hook automation without conformance evidence." : "Denied an unsafe later-gate, unknown, shell-execution, or privileged automation attempt."],
      safe_next_actions: [...safeManualActions],
      user_message: "FlowDesk denied this hook attempt because Release 1 cannot perform real dispatch, provider calls, lane launch, automatic fallback, or hard chat control.",
      managed_automation_enabled: false,
      mutation_applied: false,
      denial_applied: true
    });
  }

  const safeActions = classifyCommandActions(request.attempt_summary, request.requested_capability);
  return baseResponse(request, {
    ok: true,
    decision: request.requested_capability === "safe_manual" ? "allow_safe_manual" : "route_command",
    diagnostic_observations: ["Routed to a safe command-backed Release 1 action without dispatch authority."],
    safe_next_actions: uniqueActions(safeActions),
    user_message: "FlowDesk routed this hook attempt to safe Release 1 command-backed behavior.",
    managed_automation_enabled: request.requested_capability !== "safe_manual",
    mutation_applied: request.requested_capability !== "safe_manual",
    denial_applied: false
  });
}

export function evaluateFlowDeskHookHarnessV1(request: FlowDeskHookHarnessRequestV1): FlowDeskHookHarnessEvaluationV1 {
  const response = buildFlowDeskHookHarnessResponseV1(request);
  const responseResult = validateHookHarnessResponseV1(response);
  if (!responseResult.ok) return { ...invalid(...responseResult.errors), response };
  return { ...valid(), response };
}
