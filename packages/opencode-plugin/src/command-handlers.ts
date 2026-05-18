import type {
  DebugSectionV1,
  DoctorFailureCategoryV1,
  DoctorSectionResultV1,
  FlowDeskAbortRequestV1,
  FlowDeskAbortResponseV1,
  FlowDeskDoctorRequestV1,
  FlowDeskDoctorResponseV1,
  FlowDeskExportDebugRequestV1,
  FlowDeskExportDebugResponseV1,
  FlowDeskFakeRuntimeCommandInputV1,
  FlowDeskGuardedDryRunCommandInputV1,
  FlowDeskPlanCommandInputV1,
  FlowDeskRelease1MinimumToolName,
  FlowDeskResumeRequestV1,
  FlowDeskResumeResponseV1,
  FlowDeskRetryPlanningInputV1,
  FlowDeskRunRequestV1,
  FlowDeskStatusCommandInputV1,
  FlowDeskUsageRequestV1,
  FlowDeskUsageResponseV1,
  ValidationResult
} from "@flowdesk/core";
import {
  evaluateFlowDeskFakeRuntimeCommandV1,
  evaluateFlowDeskGuardedDryRunCommandV1,
  evaluateFlowDeskPlanCommandV1,
  evaluateFlowDeskRetryPlanningV1,
  evaluateFlowDeskStatusCommandV1,
  FLOWDESK_RELEASE_1_COMMAND_MANIFEST,
  getDoctorFailureCategoryOutcomeV1,
  invalid,
  valid,
  validateDoctorRequestV1,
  validateSchemaArtifactValue
} from "@flowdesk/core";
import { getFlowDeskRelease1HandlerReadiness, getFlowDeskRelease1ProductionReadinessSummary } from "./tool-stubs.js";

export type FlowDeskCommandBackedHandlerModeV1 = "command_backed_core_evaluator" | "command_backed_diagnostic_handler" | "missing_evaluator_input" | "request_schema_invalid" | "schema_only_pending";

export interface FlowDeskCommandBackedRunHandlerContextV1 {
  guardedDryRun?: Omit<FlowDeskGuardedDryRunCommandInputV1, "commandName" | "request">;
  fakeRuntime?: Omit<FlowDeskFakeRuntimeCommandInputV1, "commandName" | "request">;
}

export interface FlowDeskCommandBackedHandlerContextV1 {
  plan?: Omit<FlowDeskPlanCommandInputV1, "request">;
  run?: FlowDeskCommandBackedRunHandlerContextV1;
  status?: Omit<FlowDeskStatusCommandInputV1, "request">;
  retry?: Omit<FlowDeskRetryPlanningInputV1, "request">;
  diagnostic?: {
    nowIso?: string;
    deleteAfterIso?: string;
    sourceRef?: string;
    providerHealthSnapshotRef?: string;
  };
}

export interface FlowDeskCommandBackedHandlerResultV1 extends ValidationResult {
  toolName: FlowDeskRelease1MinimumToolName;
  handlerMode: FlowDeskCommandBackedHandlerModeV1;
  requestSchemaValid: boolean;
  responseSchemaValid: boolean;
  coreEvaluationOk: boolean;
  response?: unknown;
  productionRegistrationEligible: false;
  realOpenCodeDispatch: false;
  actualLaneLaunch: false;
  providerCall: false;
  runtimeExecution: false;
  fallbackAuthority: false;
  hardCancelOrNoReplyAuthority: false;
}

const disabledAuthority = {
  productionRegistrationEligible: false,
  realOpenCodeDispatch: false,
  actualLaneLaunch: false,
  providerCall: false,
  runtimeExecution: false,
  fallbackAuthority: false,
  hardCancelOrNoReplyAuthority: false
} as const;

function result(mode: FlowDeskCommandBackedHandlerModeV1, toolName: FlowDeskRelease1MinimumToolName, requestResult: ValidationResult, responseResult: ValidationResult, response: unknown, coreEvaluationOk: boolean): FlowDeskCommandBackedHandlerResultV1 {
  const errors = [...requestResult.errors, ...responseResult.errors];
  const validation = errors.length === 0 ? valid() : invalid(...errors);
  return {
    ...validation,
    toolName,
    handlerMode: mode,
    requestSchemaValid: requestResult.ok,
    responseSchemaValid: responseResult.ok,
    coreEvaluationOk,
    ...(response === undefined ? {} : { response }),
    ...disabledAuthority
  };
}

function responseSchemaResult(toolName: FlowDeskRelease1MinimumToolName, response: unknown): ValidationResult {
  const manifestEntry = FLOWDESK_RELEASE_1_COMMAND_MANIFEST.find((entry) => entry.toolName === toolName);
  if (manifestEntry === undefined) return invalid("toolName is not a Release 1 minimum tool");
  return validateSchemaArtifactValue(manifestEntry.responseSchemaId, response);
}

function requestSchemaResult(toolName: FlowDeskRelease1MinimumToolName, request: unknown): ValidationResult {
  const manifestEntry = FLOWDESK_RELEASE_1_COMMAND_MANIFEST.find((entry) => entry.toolName === toolName);
  if (manifestEntry === undefined) return invalid("toolName is not a Release 1 minimum tool");
  const artifactResult = validateSchemaArtifactValue(manifestEntry.requestSchemaId, request);
  if (toolName === "flowdesk_doctor") {
    const semanticResult = validateDoctorRequestV1(request);
    const errors = [...artifactResult.errors, ...semanticResult.errors];
    return errors.length === 0 ? valid() : invalid(...errors);
  }
  return artifactResult;
}

function requestId(request: { request_id?: unknown }): string {
  return typeof request.request_id === "string" && request.request_id.length > 0 ? request.request_id : "request-unknown";
}

function safeDiagnosticId(prefix: string, request: { request_id?: unknown }): string {
  const suffix = requestId(request)
    .replaceAll(/[^A-Za-z0-9_.:-]/g, "-")
    .slice(0, 80);
  return `${prefix}-${suffix.length > 0 ? suffix : "request-unknown"}`;
}

function diagnosticNow(context: FlowDeskCommandBackedHandlerContextV1): string {
  return context.diagnostic?.nowIso ?? "2026-05-17T00:00:00.000Z";
}

function diagnosticDeleteAfter(context: FlowDeskCommandBackedHandlerContextV1): string {
  return context.diagnostic?.deleteAfterIso ?? "2026-05-18T00:00:00.000Z";
}

function doctorCategoryFor(request: FlowDeskDoctorRequestV1): DoctorFailureCategoryV1 {
  if (request.check_scope === "usage" || request.check_scope === "provider_health") return "degraded_mode_warning";
  if (request.check_scope === "install" || request.check_scope === "policy") return "informational";
  return "dispatch_blocking";
}

function doctorSectionFor(category: DoctorFailureCategoryV1, request: FlowDeskDoctorRequestV1) {
  const runId = safeDiagnosticId("doctor-run", request);
  const section: DoctorSectionResultV1["section"] = category === "degraded_mode_warning" ? "provider_usage_readiness" : category === "informational" && request.check_scope === "policy" ? "policy_project_safety" : category === "informational" ? "migration_cleanup" : "opencode_plugin_compatibility";
  const outcome = getDoctorFailureCategoryOutcomeV1(category);
  const productionReadiness = getFlowDeskRelease1ProductionReadinessSummary();
  return {
    schema_version: "flowdesk.doctor_section_result.v1" as const,
    run_id: runId,
    section,
    category,
    summary: category === "dispatch_blocking" ? `FlowDesk Release 1 production readiness remains blocked by ${productionReadiness.blockedChecks} non-dispatch prerequisite checks.` : category === "degraded_mode_warning" ? "FlowDesk reports provider usage and health as diagnostic-only unless fresh official evidence is available." : "FlowDesk doctor completed a redacted diagnostic scaffold check without production mutation.",
    safe_next_actions: [...outcome.safe_next_actions],
    refs: [`doctor-${category}-ref`, `production-readiness-blocked-${productionReadiness.blockedChecks}`],
    redaction_version: "redaction-v1"
  };
}

function evaluateDoctorDiagnostic(request: FlowDeskDoctorRequestV1): FlowDeskDoctorResponseV1 {
  const category = doctorCategoryFor(request);
  const outcome = getDoctorFailureCategoryOutcomeV1(category);
  const providerHealth = category === "degraded_mode_warning" ? {
    provider_family: "unknown" as const,
    availability_state: "unknown" as const,
    failure_class: "telemetry_ambiguous" as const,
    dispatchability: "non_dispatchable" as const,
    safe_remediation: "Use FlowDesk usage, status, and doctor diagnostics without provider fallback or dispatch."
  } : {
    provider_family: "unknown" as const,
    availability_state: "unknown" as const,
    failure_class: "none" as const,
    dispatchability: "non_dispatchable" as const,
    safe_remediation: "Use FlowDesk status and export-debug for redacted diagnostic follow-up."
  };
  return {
    schema_version: "flowdesk.doctor.response.v1",
    ok: category !== "dispatch_blocking",
    status: category === "dispatch_blocking" ? "blocked" : category === "degraded_mode_warning" ? "degraded" : "diagnostic_only",
    safe_next_actions: [...outcome.safe_next_actions],
    user_message: request.persist_report ? "FlowDesk doctor prepared a redacted diagnostic report reference only; no filesystem write occurred in this handler." : "FlowDesk doctor completed a redacted diagnostic check without production registration, provider calls, or runtime execution.",
    doctor_results: [doctorSectionFor(category, request)],
    provider_health_summary: providerHealth,
    compatibility_ref: safeDiagnosticId("compatibility", request),
    disabled_modes: [...outcome.disabled_modes]
  };
}

function evaluateResumeDiagnostic(request: FlowDeskResumeRequestV1): FlowDeskResumeResponseV1 {
  const statusOnly = request.resume_mode === "status_only";
  return {
    schema_version: "flowdesk.resume.response.v1",
    ok: true,
    status: statusOnly ? "diagnostic_only" : "recovery_available",
    safe_next_actions: ["/flowdesk-status", "/flowdesk-export-debug"],
    user_message: statusOnly ? "FlowDesk kept recovery in status-only mode. No lane resume occurred." : "FlowDesk prepared a non-dispatch recovery decision that requires fresh checks before any resume action.",
    resume_decision: statusOnly ? "status_only" : "requires_fresh_checks",
    required_fresh_checks: [
      { check: "checkpoint", required: true, ref: request.checkpoint_id },
      { check: "audit", required: true },
      { check: "provider_health", required: true },
      { check: "usage", required: true }
    ]
  };
}

function evaluateAbortDiagnostic(request: FlowDeskAbortRequestV1): FlowDeskAbortResponseV1 {
  void request;
  return {
    schema_version: "flowdesk.abort.response.v1",
    ok: false,
    status: "blocked",
    safe_next_actions: ["/flowdesk-status", "/flowdesk-export-debug"],
    user_message: "FlowDesk recorded an abort diagnostic without hard chat cancellation, no-reply authority, lane launch, or provider interaction.",
    cancellation_state: "cancel_failed",
    remaining_safe_actions: ["/flowdesk-status", "/flowdesk-export-debug"]
  };
}

function evaluateUsageDiagnostic(request: FlowDeskUsageRequestV1, context: FlowDeskCommandBackedHandlerContextV1): FlowDeskUsageResponseV1 {
  const id = requestId(request);
  const usageSnapshotRef = `usage-${id}`;
  return {
    schema_version: "flowdesk.usage.response.v1",
    ok: true,
    status: "diagnostic_only",
    safe_next_actions: ["/flowdesk-doctor", "/flowdesk-status", "/flowdesk-export-debug"],
    user_message: request.refresh ? "FlowDesk reported usage as unknown without provider calls or persisted refresh." : "FlowDesk reported cached usage availability as unknown and non-dispatchable.",
    usage_snapshot_ref: usageSnapshotRef,
    provider_health_snapshot_ref: context.diagnostic?.providerHealthSnapshotRef ?? `health-${id}`,
    freshness: "unknown",
    dispatchability: "non_dispatchable",
    uncertainty_flags: ["unknown"]
  };
}

function debugSection(exportId: string, section: DebugSectionV1) {
  return {
    schema_version: "flowdesk.debug_section_summary.v1" as const,
    export_id: exportId,
    section,
    ref: `debug-${section.replaceAll("_", "-")}-123`,
    redaction_status: "passed" as const,
    warning_count: 0,
    excluded_categories: []
  };
}

function evaluateExportDebugDiagnostic(request: FlowDeskExportDebugRequestV1, context: FlowDeskCommandBackedHandlerContextV1): FlowDeskExportDebugResponseV1 {
  const exportId = `export-${requestId(request)}`;
  const includedSections = request.include_sections.map((section) => debugSection(exportId, section));
  return {
    schema_version: "flowdesk.export_debug.response.v1",
    ok: true,
    status: "diagnostic_only",
    safe_next_actions: ["/flowdesk-status"],
    user_message: "FlowDesk prepared redacted debug section refs only. No raw logs, provider payloads, or absolute paths are included.",
    export_manifest_ref: `manifest-${exportId}`,
    included_sections: includedSections,
    delete_after: request.retention_hint === "delete_after_export" ? diagnosticNow(context) : diagnosticDeleteAfter(context)
  };
}

export function evaluateFlowDeskCommandBackedHandlerV1(toolName: FlowDeskRelease1MinimumToolName, request: unknown, context: FlowDeskCommandBackedHandlerContextV1 = {}): FlowDeskCommandBackedHandlerResultV1 {
  const readiness = getFlowDeskRelease1HandlerReadiness().find((entry) => entry.toolName === toolName);
  const requestResult = requestSchemaResult(toolName, request);
  if (!requestResult.ok) return result("request_schema_invalid", toolName, requestResult, invalid("response unavailable when request schema is invalid"), undefined, false);

  if (toolName === "flowdesk_doctor") {
    const response = evaluateDoctorDiagnostic(request as FlowDeskDoctorRequestV1);
    return result("command_backed_diagnostic_handler", toolName, requestResult, responseSchemaResult(toolName, response), response, true);
  }

  if (toolName === "flowdesk_plan") {
    if (context.plan === undefined) return result("missing_evaluator_input", toolName, requestResult, invalid("plan evaluator input is required"), undefined, false);
    const evaluation = evaluateFlowDeskPlanCommandV1({ ...context.plan, request: request as FlowDeskPlanCommandInputV1["request"] });
    return result("command_backed_core_evaluator", toolName, requestResult, responseSchemaResult(toolName, evaluation.response), evaluation.response, evaluation.ok);
  }

  if (toolName === "flowdesk_run") {
    const runRequest = request as FlowDeskRunRequestV1;
    if (runRequest.run_mode === "guarded-dry-run") {
      if (context.run?.guardedDryRun === undefined) return result("missing_evaluator_input", toolName, requestResult, invalid("guarded dry-run evaluator input is required"), undefined, false);
      const evaluation = evaluateFlowDeskGuardedDryRunCommandV1({ ...context.run.guardedDryRun, commandName: "/flowdesk-run", request: runRequest });
      return result("command_backed_core_evaluator", toolName, requestResult, responseSchemaResult(toolName, evaluation.response), evaluation.response, evaluation.ok);
    }
    if (context.run?.fakeRuntime === undefined) return result("missing_evaluator_input", toolName, requestResult, invalid("fake-runtime evaluator input is required"), undefined, false);
    const evaluation = evaluateFlowDeskFakeRuntimeCommandV1({ ...context.run.fakeRuntime, commandName: "/flowdesk-run", request: runRequest });
    return result("command_backed_core_evaluator", toolName, requestResult, responseSchemaResult(toolName, evaluation.response), evaluation.response, evaluation.ok);
  }

  if (toolName === "flowdesk_status") {
    if (context.status === undefined) return result("missing_evaluator_input", toolName, requestResult, invalid("status evaluator input is required"), undefined, false);
    const evaluation = evaluateFlowDeskStatusCommandV1({ ...context.status, request: request as FlowDeskStatusCommandInputV1["request"] });
    return result("command_backed_core_evaluator", toolName, requestResult, responseSchemaResult(toolName, evaluation.response), evaluation.response, evaluation.ok);
  }

  if (toolName === "flowdesk_retry") {
    if (context.retry === undefined) return result("missing_evaluator_input", toolName, requestResult, invalid("retry evaluator input is required"), undefined, false);
    const evaluation = evaluateFlowDeskRetryPlanningV1({ ...context.retry, request: request as FlowDeskRetryPlanningInputV1["request"] });
    return result("command_backed_core_evaluator", toolName, requestResult, responseSchemaResult(toolName, evaluation.response), evaluation.response, evaluation.ok);
  }

  if (toolName === "flowdesk_resume") {
    const response = evaluateResumeDiagnostic(request as FlowDeskResumeRequestV1);
    return result("command_backed_diagnostic_handler", toolName, requestResult, responseSchemaResult(toolName, response), response, true);
  }

  if (toolName === "flowdesk_abort") {
    const response = evaluateAbortDiagnostic(request as FlowDeskAbortRequestV1);
    return result("command_backed_diagnostic_handler", toolName, requestResult, responseSchemaResult(toolName, response), response, true);
  }

  if (toolName === "flowdesk_usage") {
    const response = evaluateUsageDiagnostic(request as FlowDeskUsageRequestV1, context);
    return result("command_backed_diagnostic_handler", toolName, requestResult, responseSchemaResult(toolName, response), response, true);
  }

  if (toolName === "flowdesk_export_debug") {
    const response = evaluateExportDebugDiagnostic(request as FlowDeskExportDebugRequestV1, context);
    return result("command_backed_diagnostic_handler", toolName, requestResult, responseSchemaResult(toolName, response), response, true);
  }

  if (readiness?.handlerReadiness !== "core_evaluator_available") return result("schema_only_pending", toolName, requestResult, invalid("core evaluator adapter is not implemented for this handler yet"), undefined, false);
  return result("schema_only_pending", toolName, requestResult, invalid("core evaluator adapter is not implemented for this handler yet"), undefined, false);
}
