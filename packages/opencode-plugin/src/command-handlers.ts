import type {
  DebugSectionV1,
  DoctorFailureCategoryV1,
  DoctorSectionResultV1,
  FlowDeskAbortRequestV1,
  FlowDeskAbortResponseV1,
  FlowDeskDefaultManagedDispatchPromotionReadinessV1,
  FlowDeskDoctorRequestV1,
  FlowDeskDoctorResponseV1,
  FlowDeskExportDebugRequestV1,
  FlowDeskExportDebugResponseV1,
  FlowDeskFakeRuntimeCommandInputV1,
  FlowDeskGuardedDryRunCommandInputV1,
  FlowDeskPlanCommandInputV1,
  FlowDeskProductionEnablementEvaluationV1,
  FlowDeskRelease1MinimumToolName,
  FlowDeskResumeRequestV1,
  FlowDeskResumeResponseV1,
  FlowDeskRetryPlanningInputV1,
  FlowDeskRunRequestV1,
  FlowDeskStatusCommandInputV1,
  FlowDeskUsageRequestV1,
  FlowDeskUsageResponseV1,
  ProviderFamily,
  ValidationResult
} from "@flowdesk/core";
import {
  createAuthMissingProviderHealthSnapshotV1,
  evaluateFlowDeskFakeRuntimeCommandV1,
  evaluateFlowDeskGuardedDryRunCommandV1,
  evaluateFlowDeskPlanCommandV1,
  evaluateFlowDeskRetryPlanningV1,
  evaluateFlowDeskStatusCommandV1,
  FLOWDESK_PLANNED_TOP_TIER_MULTI_PERSPECTIVE_REVIEW_MODE_FIELD_REF,
  FLOWDESK_RELEASE_1_COMMAND_MANIFEST,
  getDoctorFailureCategoryOutcomeV1,
  invalid,
  providerFamilyRequiresAuthReadinessV1,
  valid,
  validateDoctorRequestV1,
  validateSchemaArtifactValue
} from "@flowdesk/core";
import { getFlowDeskRelease1HandlerReadiness, getFlowDeskRelease1ProductionReadinessSummary } from "./tool-stubs.js";

export type FlowDeskCommandBackedHandlerModeV1 = "command_backed_core_evaluator" | "command_backed_diagnostic_handler" | "missing_evaluator_input" | "request_schema_invalid" | "pending_confirmation_invalid" | "schema_only_pending";

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
    productionEnablement?: FlowDeskProductionEnablementEvaluationV1;
    defaultManagedDispatchPromotionReadiness?: FlowDeskDefaultManagedDispatchPromotionReadinessV1;
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

function authRequiredProviderLabel(providerFamily: ProviderFamily): string {
  if (providerFamily === "claude") return "Claude";
  if (providerFamily === "openai") return "OpenAI";
  if (providerFamily === "gemini") return "Gemini";
  if (providerFamily === "opencode_go") return "OpenCode Go";
  if (providerFamily === "z_ai") return "z.ai";
  return "Provider";
}

function doctorSectionFor(section: DoctorSectionResultV1["section"], category: DoctorFailureCategoryV1, request: FlowDeskDoctorRequestV1, summary: string, refs: readonly string[]) {
  const runId = safeDiagnosticId("doctor-run", request);
  const outcome = getDoctorFailureCategoryOutcomeV1(category);
  return {
    schema_version: "flowdesk.doctor_section_result.v1" as const,
    run_id: runId,
    section,
    category,
    summary,
    safe_next_actions: [...outcome.safe_next_actions],
    refs: [...refs],
    redaction_version: "redaction-v1"
  };
}

function productionEnablementRefs(context: FlowDeskCommandBackedHandlerContextV1): string[] {
  const evaluation = context.diagnostic?.productionEnablement;
  if (evaluation === undefined) return ["production_enablement_state=disabled", "production_evidence_persistence=implemented_core_contract"];
  return [
    `production_enablement_state=${evaluation.state}`,
    `production_enablement_doctor_ref=${evaluation.doctor_state_ref}`,
    `production_managed_dispatch_ready=${evaluation.managed_dispatch_ready}`,
    `production_dispatch_authority_enabled=${evaluation.dispatch_authority_enabled}`,
    ...(evaluation.configured_verification_result === undefined ? [] : [`production_configured_verification_result=${evaluation.configured_verification_result}`]),
    ...(evaluation.configured_verification_ref === undefined ? [] : [`production_configured_verification_ref=${evaluation.configured_verification_ref}`]),
    ...(evaluation.sanitized_auth_capture_result === undefined ? [] : [`production_sanitized_auth_capture_result=${evaluation.sanitized_auth_capture_result}`]),
    ...(evaluation.sanitized_auth_capture_ref === undefined ? [] : [`production_sanitized_auth_capture_ref=${evaluation.sanitized_auth_capture_ref}`]),
    ...(evaluation.external_auth_provider_policy_result === undefined ? [] : [`production_external_auth_provider_policy_result=${evaluation.external_auth_provider_policy_result}`]),
    ...(evaluation.external_auth_policy_ref === undefined ? [] : [`production_external_auth_policy_ref=${evaluation.external_auth_policy_ref}`]),
    ...(evaluation.provider_policy_ref === undefined ? [] : [`production_provider_policy_ref=${evaluation.provider_policy_ref}`]),
    ...(evaluation.approval_decision === undefined ? [] : [`production_approval_decision=${evaluation.approval_decision}`]),
    ...(evaluation.approval_ref === undefined ? [] : [`production_approval_ref=${evaluation.approval_ref}`]),
    ...evaluation.blocker_labels.map((label) => `production_blocker=${label}`),
    ...evaluation.uncertainty_labels.map((label) => `production_uncertainty=${label}`)
  ];
}

function defaultManagedDispatchPromotionRefs(context: FlowDeskCommandBackedHandlerContextV1): string[] {
  const readiness = context.diagnostic?.defaultManagedDispatchPromotionReadiness;
  if (readiness === undefined) return ["default_dispatch_candidate=false", "default_dispatch_promotion_state=blocked"];
  return [
    `default_dispatch_promotion_state=${readiness.state}`,
    `default_dispatch_candidate=${readiness.default_dispatch_candidate}`,
    `default_dispatch_doctor_status_ref=${readiness.doctor_status_ref}`,
    `default_dispatch_production_enablement_state=${readiness.production_enablement_state}`,
    `default_dispatch_managed_dispatch_ready=${readiness.managed_dispatch_ready}`,
    `default_dispatch_durable_precall_ready=${readiness.durable_precall_ready}`,
    `default_dispatch_adapter_available=${readiness.adapter_available}`,
    `default_dispatch_sdk_client_available=${readiness.sdk_client_available}`,
    `default_dispatch_authority_enabled=${readiness.dispatch_authority_enabled}`,
    `default_dispatch_providerCall=${readiness.providerCall}`,
    `default_dispatch_actualLaneLaunch=${readiness.actualLaneLaunch}`,
    `default_dispatch_runtimeExecution=${readiness.runtimeExecution}`,
    ...(readiness.release_enablement_ref === undefined ? [] : [`default_dispatch_release_enablement_ref=${readiness.release_enablement_ref}`]),
    ...readiness.blocked_labels.map((label) => `default_dispatch_blocker=${label}`)
  ];
}

function doctorSectionsFor(request: FlowDeskDoctorRequestV1, context: FlowDeskCommandBackedHandlerContextV1): DoctorSectionResultV1[] {
  const productionReadiness = getFlowDeskRelease1ProductionReadinessSummary();
  const enablementRefs = productionEnablementRefs(context);
  const promotionRefs = defaultManagedDispatchPromotionRefs(context);
  const allSections = [
    doctorSectionFor("migration_cleanup", "informational", request, "FlowDesk bootstrap evidence is redacted and diagnostic-only; installer authority does not approve dispatch.", ["doctor-migration-cleanup-ref"]),
    doctorSectionFor("opencode_plugin_compatibility", "informational", request, `FlowDesk Release 1 non-dispatch command registration is ready with ${productionReadiness.passedChecks} readiness checks passed; default managed dispatch promotion is diagnostic-only until a candidate gate is visible.`, ["doctor-opencode-compatibility-ref", `production-readiness-passed-${productionReadiness.passedChecks}`, FLOWDESK_PLANNED_TOP_TIER_MULTI_PERSPECTIVE_REVIEW_MODE_FIELD_REF, ...enablementRefs, ...promotionRefs]),
    doctorSectionFor("provider_usage_readiness", "degraded_mode_warning", request, "FlowDesk reports provider usage and health as diagnostic-only unless auth readiness and fresh real usage/quota/reset evidence are available for the exact provider, model, account, and auth scope. Models are excluded when evidence is absent.", ["doctor-provider-usage-ref", "usage-health-diagnostic-only", "all-model-auth-usage-required"]),
    doctorSectionFor("policy_project_safety", "informational", request, "FlowDesk policy checks preserve Release 1 safe command-backed behavior; Release 2 dispatch requires durable evidence, configured verification, sanitized auth capture, external auth/provider policy, explicit approval, and doctor-visible enablement state.", ["doctor-policy-project-ref", "production_approval_state_machine=fail_closed", "configured_verification_gate=required", "sanitized_auth_capture_gate=required", "external_auth_provider_policy_gate=required"])
  ];
  if (request.check_scope === "all") return allSections;
  if (request.check_scope === "install") return allSections.filter((section) => section.section === "migration_cleanup");
  if (request.check_scope === "policy") return allSections.filter((section) => section.section === "policy_project_safety");
  if (request.check_scope === "usage" || request.check_scope === "provider_health") return allSections.filter((section) => section.section === "provider_usage_readiness");
  return allSections.filter((section) => section.section === "opencode_plugin_compatibility");
}

function mostSevereDoctorCategory(sections: readonly DoctorSectionResultV1[]): DoctorFailureCategoryV1 {
  if (sections.some((section) => section.category === "dispatch_blocking")) return "dispatch_blocking";
  if (sections.some((section) => section.category === "chat_mode_disable")) return "chat_mode_disable";
  if (sections.some((section) => section.category === "degraded_mode_warning")) return "degraded_mode_warning";
  return "informational";
}

function evaluateDoctorDiagnostic(request: FlowDeskDoctorRequestV1, context: FlowDeskCommandBackedHandlerContextV1): FlowDeskDoctorResponseV1 {
  const doctorSections = doctorSectionsFor(request, context);
  const category = mostSevereDoctorCategory(doctorSections);
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
    user_message: request.persist_report ? "FlowDesk doctor prepared redacted section results only; no filesystem write occurred in this handler." : "FlowDesk doctor checked Release 1 install, compatibility, provider usage, and policy readiness without real dispatch, provider calls, or runtime execution.",
    doctor_results: doctorSections,
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
  const authMissingHealth = providerFamilyRequiresAuthReadinessV1(request.provider_family)
    ? createAuthMissingProviderHealthSnapshotV1({
      snapshotId: `health-auth-missing-${request.provider_family}-${id}`,
      providerFamily: request.provider_family,
      observedAt: diagnosticNow(context),
      sourceRef: context.diagnostic?.sourceRef ?? "flowdesk-auth-readiness-diagnostic"
    })
    : undefined;
  return {
    schema_version: "flowdesk.usage.response.v1",
    ok: true,
    status: "diagnostic_only",
    safe_next_actions: ["/flowdesk-doctor", "/flowdesk-status", "/flowdesk-export-debug"],
    user_message: authMissingHealth !== undefined
      ? `${authRequiredProviderLabel(request.provider_family)} models are excluded until auth readiness and real usage/quota/reset evidence are available for the exact provider/model/account scope; FlowDesk made no provider call.`
      : request.refresh ? "FlowDesk reported usage as unknown without provider calls or persisted refresh." : "FlowDesk reported cached usage availability as unknown and non-dispatchable.",
    usage_snapshot_ref: usageSnapshotRef,
    provider_health_snapshot_ref: authMissingHealth?.snapshot_id ?? context.diagnostic?.providerHealthSnapshotRef ?? `health-${id}`,
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
    const response = evaluateDoctorDiagnostic(request as FlowDeskDoctorRequestV1, context);
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
		if (runRequest.run_mode === "managed-dispatch") return result("missing_evaluator_input", toolName, requestResult, invalid("managed-dispatch requires server-level default managed-dispatch route authorization"), undefined, false);
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
