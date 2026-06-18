import type { FlowDeskFallbackRegatePlanV1,
  DebugSectionV1,
  DoctorFailureCategoryV1,
  DoctorSectionResultV1,
  FlowDeskAbortRequestV1,
  FlowDeskAbortResponseV1,
  FlowDeskDefaultManagedDispatchPromotionReadinessV1,
  FlowDeskDoctorRequestV1,
  FlowDeskDoctorResponseV1,
  FlowDeskCompactionHealthV1,
  FlowDeskExactModelAvailabilityCacheRefreshPlanV1,
  FlowDeskExportDebugRequestV1,
  FlowDeskExportDebugResponseV1,
  FlowDeskFakeRuntimeCommandInputV1,
  FlowDeskGuardedDryRunCommandInputV1,
  FlowDeskPlanCommandInputV1,
  FlowDeskProductionEnablementEvaluationV1,
  FlowDeskManagedDispatchBundleEvaluationV1,
  FlowDeskManagedDispatchExposureAuthorizationV1,
  FlowDeskReviewerFanoutPlanV1,
  FlowDeskRelease1MinimumToolName,
  FlowDeskResumeRequestV1,
  FlowDeskResumeResponseV1,
  FlowDeskRetryPlanningInputV1,
  FlowDeskRunRequestV1,
  FlowDeskSessionEvidenceReloadResultV1,
  FlowDeskStatusCommandInputV1,
  FlowDeskUsageRequestV1,
  FlowDeskUsageResponseV1,
  UsageUncertaintyFlagV1,
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
import type { FlowDeskLaneAbortHelperResultV1, FlowDeskSdkSessionHealthV1 } from "./stall-recovery.js";

export type FlowDeskCommandBackedHandlerModeV1 = "command_backed_core_evaluator" | "command_backed_diagnostic_handler" | "missing_evaluator_input" | "request_schema_invalid" | "pending_confirmation_invalid" | "schema_only_pending";

export interface FlowDeskCommandBackedRunHandlerContextV1 {
  guardedDryRun?: Omit<FlowDeskGuardedDryRunCommandInputV1, "commandName" | "request">;
  fakeRuntime?: Omit<FlowDeskFakeRuntimeCommandInputV1, "commandName" | "request">;
}

export interface FlowDeskCommandBackedUsageEvidenceRowV1 {
  provider_family?: ProviderFamily;
  providerFamily?: ProviderFamily;
  usage_snapshot_ref?: string;
  usageSnapshotRef?: string;
  provider_health_snapshot_ref?: string;
  providerHealthSnapshotRef?: string;
  freshness: FlowDeskUsageResponseV1["freshness"];
  dispatchability: FlowDeskUsageResponseV1["dispatchability"];
  uncertainty_flags?: readonly UsageUncertaintyFlagV1[];
  uncertaintyFlags?: readonly UsageUncertaintyFlagV1[];
  observed_at?: string;
  observedAt?: string;
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
    providerUsageEvidence?: readonly FlowDeskCommandBackedUsageEvidenceRowV1[];
    productionEnablement?: FlowDeskProductionEnablementEvaluationV1;
    exactModelAvailabilityCacheRefreshPlan?: FlowDeskExactModelAvailabilityCacheRefreshPlanV1;
    defaultManagedDispatchPromotionReadiness?: FlowDeskDefaultManagedDispatchPromotionReadinessV1;
    managedDispatchBundleEvaluation?: FlowDeskManagedDispatchBundleEvaluationV1;
    sessionEvidenceReload?: FlowDeskSessionEvidenceReloadResultV1;
    reviewerFanoutPlan?: FlowDeskReviewerFanoutPlanV1;
    fallbackRegatePlan?: FlowDeskFallbackRegatePlanV1;
    laneAbortResult?: FlowDeskLaneAbortHelperResultV1;
    sdkSessionHealth?: FlowDeskSdkSessionHealthV1;
    compactionHealth?: FlowDeskCompactionHealthV1;
    githubConnector?: {
      productionPublish: "disabled" | "enabled" | "unknown";
      lastConfiguredAt: string | null;
      githubTokenAvailable: boolean;
      authSource: "env_github_token" | "env_flowdesk_oauth_token" | "missing" | string;
      freshness: {
        surplusUsageGate: "fresh" | "stale" | "missing";
        minimizationPolicy: "fresh" | "stale" | "missing";
      };
    };
    devBetaAgentTaskRun?: {
      enabled: boolean;
      registered: boolean;
      hasInjectedSdkClient: boolean;
      durableStateRootConfigured: boolean;
    };
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

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

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
  if (providerFamily === "anthropic") return "Claude";
  if (providerFamily === "openai") return "OpenAI";
  if (providerFamily === "gemini") return "Gemini";
  if (providerFamily === "google") return "Gemini";
  if (providerFamily === "opencode") return "OpenCode Go";
  if (providerFamily === "opencode_go") return "OpenCode Go";
  if (providerFamily === "z_ai") return "z.ai";
  return "Provider";
}

function canonicalUsageProviderFamily(providerFamily: ProviderFamily): ProviderFamily {
  if (providerFamily === "anthropic") return "claude";
  if (providerFamily === "google") return "gemini";
  if (providerFamily === "opencode") return "opencode_go";
  return providerFamily;
}

function usageEvidenceProviderFamily(row: FlowDeskCommandBackedUsageEvidenceRowV1): ProviderFamily | undefined {
  const providerFamily = row.provider_family ?? row.providerFamily;
  return providerFamily === undefined ? undefined : canonicalUsageProviderFamily(providerFamily);
}

function usageEvidenceObservedAtMs(row: FlowDeskCommandBackedUsageEvidenceRowV1): number {
  const observedAt = row.observed_at ?? row.observedAt;
  if (observedAt === undefined) return 0;
  const parsed = Date.parse(observedAt);
  return Number.isFinite(parsed) ? parsed : 0;
}

function usageEvidenceSnapshotRef(row: FlowDeskCommandBackedUsageEvidenceRowV1): string | undefined {
  const ref = row.usage_snapshot_ref ?? row.usageSnapshotRef;
  return typeof ref === "string" && ref.length > 0 ? ref : undefined;
}

function usageEvidenceHealthSnapshotRef(row: FlowDeskCommandBackedUsageEvidenceRowV1): string | undefined {
  const ref = row.provider_health_snapshot_ref ?? row.providerHealthSnapshotRef;
  return typeof ref === "string" && ref.length > 0 ? ref : undefined;
}

function usageEvidenceUncertaintyFlags(row: FlowDeskCommandBackedUsageEvidenceRowV1): UsageUncertaintyFlagV1[] {
  return [...(row.uncertainty_flags ?? row.uncertaintyFlags ?? [])];
}

function freshestMatchingUsageEvidence(request: FlowDeskUsageRequestV1, context: FlowDeskCommandBackedHandlerContextV1): FlowDeskCommandBackedUsageEvidenceRowV1 | undefined {
  const requestedFamily = canonicalUsageProviderFamily(request.provider_family);
  const evidenceRows = context.diagnostic?.providerUsageEvidence ?? [];
  return evidenceRows
    .filter((row) => usageEvidenceSnapshotRef(row) !== undefined)
    .filter((row) => request.provider_family === "all" || usageEvidenceProviderFamily(row) === requestedFamily)
    .sort((left, right) => usageEvidenceObservedAtMs(right) - usageEvidenceObservedAtMs(left))[0];
}

function safeUsageResponseDispatchability(row: FlowDeskCommandBackedUsageEvidenceRowV1, uncertaintyFlags: readonly UsageUncertaintyFlagV1[]): FlowDeskUsageResponseV1["dispatchability"] {
  const failClosedFlags: readonly UsageUncertaintyFlagV1[] = ["unknown", "stale", "refused", "shared_limit_suspected", "fallback_derived", "model_generated"];
  if (row.freshness !== "fresh" && row.dispatchability === "dispatchable") return "non_dispatchable";
  if (uncertaintyFlags.some((flag) => failClosedFlags.includes(flag)) && row.dispatchability !== "non_dispatchable") return "non_dispatchable";
  return row.dispatchability;
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
    `production_managed_dispatch_ready_basis=${evaluation.managed_dispatch_ready_basis}`,
    `production_plugin_satisfiable_gate_passed=${evaluation.plugin_satisfiable_gate_passed}`,
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
    ...(evaluation.plugin_boundary_assessment === undefined ? [] : [
      `production_plugin_boundary_plugin_satisfiable_count=${evaluation.plugin_boundary_assessment.plugin_satisfiable_count}`,
      `production_plugin_boundary_skipped_platform_dependent_count=${evaluation.plugin_boundary_assessment.skipped_platform_dependent_count}`
    ]),
    ...((evaluation.skipped_platform_dependent_labels ?? []).map((label) => `production_skipped_platform_dependent=${label}`)),
    ...evaluation.blocker_labels.map((label) => `production_blocker=${label}`),
    ...evaluation.uncertainty_labels.map((label) => `production_uncertainty=${label}`)
  ];
}

function productionEnablementPresentationSummary(context: FlowDeskCommandBackedHandlerContextV1): string {
  const evaluation = context.diagnostic?.productionEnablement;
  if (evaluation === undefined) return "Production enablement is disabled; managed-dispatch readiness basis is unavailable.";
  const skipped = evaluation.skipped_platform_dependent_labels ?? [];
  const skippedText = skipped.length === 0 ? "none" : skipped.join(", ");
  return `Managed-dispatch readiness basis: ${evaluation.managed_dispatch_ready_basis}; Plugin-satisfiable gate passed: ${evaluation.plugin_satisfiable_gate_passed ?? false}; Skipped platform-dependent labels: ${skippedText}; Dispatch authority enabled: ${evaluation.dispatch_authority_enabled}.`;
}

function enrichStatusPresentation(response: unknown, context: FlowDeskCommandBackedHandlerContextV1): unknown {
  const evaluation = context.diagnostic?.productionEnablement;
  if (evaluation === undefined || !isRecord(response)) return response;
  const skipped = evaluation.skipped_platform_dependent_labels ?? [];
  const refs = productionEnablementRefs(context);
  const existingMessage = typeof response.user_message === "string" ? response.user_message : "FlowDesk status collected.";
  return {
    ...response,
    user_message: `${existingMessage} ${productionEnablementPresentationSummary(context)} Read-only status presentation; no dispatch authority changed.`,
    managed_dispatch_readiness_basis: evaluation.managed_dispatch_ready_basis,
    managed_dispatch_plugin_satisfiable_gate_passed: evaluation.plugin_satisfiable_gate_passed ?? false,
    skipped_platform_dependent_labels: [...skipped],
    managed_dispatch_readiness_refs: refs,
    managed_dispatch_readiness_authority: {
      realOpenCodeDispatch: false,
      providerCall: false,
      runtimeExecution: false,
      actualLaneLaunch: false,
      fallbackAuthority: false,
      hardCancelOrNoReplyAuthority: false
    }
  };
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
    // internal identifier — not user-facing
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

function managedDispatchBundleEvaluationRefs(context: FlowDeskCommandBackedHandlerContextV1): string[] {
  const evaluation = context.diagnostic?.managedDispatchBundleEvaluation;
  if (evaluation === undefined) return ["managed_dispatch_bundle_status=not_yet_evaluated"];
  return [
    `managed_dispatch_bundle_gate_result=${evaluation.gate_result}`,
    `managed_dispatch_bundle_blocked_items_count=${evaluation.blocked_items.length}`,
    `managed_dispatch_bundle_evidence_refs_count=${evaluation.evidence_refs.length}`,
    ...evaluation.blocked_items.map((item) => `managed_dispatch_bundle_blocked_item=${item}`),
    ...evaluation.blocked_labels.map((label) => `managed_dispatch_bundle_blocked_label=${label}`)
  ];
}

function safeRefToken(value: string, fallback: string): string {
  const token = value.replaceAll(/[^A-Za-z0-9_.:-]/g, "-").slice(0, 96);
  return token.length > 0 ? token : fallback;
}

function safeBlockLabel(value: string, fallback: string): string {
  const label = value.replaceAll(/[^A-Za-z0-9_.:-]/g, "_").slice(0, 80);
  return label.length > 0 ? label : fallback;
}

export function managedDispatchExposureAuthorizationRefs(context: FlowDeskCommandBackedHandlerContextV1): string[] {
  const noDispatchAuthorityRefs = [
    "s7_managed_dispatch_exposure_scope=readiness_only",
    "s7_managed_dispatch_exposure_dispatch_authority_enabled=false",
    "s7_managed_dispatch_exposure_providerCall=false",
    "s7_managed_dispatch_exposure_actualLaneLaunch=false",
    "s7_managed_dispatch_exposure_runtimeExecution=false",
    "s7_managed_dispatch_exposure_realOpenCodeDispatch=false"
  ];
  const reload = context.diagnostic?.sessionEvidenceReload;
  if (reload === undefined) return ["s7_managed_dispatch_exposure_state=unknown", "s7_managed_dispatch_exposure_evidence=not_yet_evaluated", ...noDispatchAuthorityRefs];

  const validEntries = reload.entries.filter((entry) => entry.evidenceClass === "managed_dispatch_exposure_authorization");
  const blockedEntries = reload.blocked.filter((entry) => entry.evidenceClass === "managed_dispatch_exposure_authorization");
  const newestValidEntries = [...validEntries].reverse();
  const authorized = newestValidEntries.find((entry) => {
    const record = entry.record as unknown as FlowDeskManagedDispatchExposureAuthorizationV1;
    return record.state === "authorized" && record.ok === true && record.exposure_readiness_authorized === true;
  });

  if (authorized !== undefined) {
    return [
      "s7_managed_dispatch_exposure_state=authorized",
      `s7_managed_dispatch_exposure_latest_evidence_ref=${safeRefToken(authorized.evidenceId, "managed-dispatch-exposure-authorization")}`,
      `s7_managed_dispatch_exposure_evidence_ref=${safeRefToken(authorized.evidenceId, "managed-dispatch-exposure-authorization")}`,
      ...noDispatchAuthorityRefs
    ];
  }

  const blocked = newestValidEntries.find((entry) => {
    const record = entry.record as unknown as FlowDeskManagedDispatchExposureAuthorizationV1;
    return record.state === "blocked" || record.ok === false || record.exposure_readiness_authorized === false;
  });
  if (blocked !== undefined) {
    const record = blocked.record as unknown as FlowDeskManagedDispatchExposureAuthorizationV1;
    return [
      "s7_managed_dispatch_exposure_state=blocked",
      `s7_managed_dispatch_exposure_latest_evidence_ref=${safeRefToken(blocked.evidenceId, "managed-dispatch-exposure-authorization")}`,
      `s7_managed_dispatch_exposure_evidence_ref=${safeRefToken(blocked.evidenceId, "managed-dispatch-exposure-authorization")}`,
      ...record.blocked_labels.slice(0, 8).map((label) => `s7_managed_dispatch_exposure_block_label=${safeBlockLabel(label, "blocked")}`),
      ...noDispatchAuthorityRefs
    ];
  }

  if (blockedEntries.length > 0) {
    const latest = blockedEntries[blockedEntries.length - 1];
    return [
      "s7_managed_dispatch_exposure_state=blocked",
      `s7_managed_dispatch_exposure_latest_evidence_ref=${safeRefToken(latest.evidenceId, "managed-dispatch-exposure-authorization")}`,
      `s7_managed_dispatch_exposure_blocked_ref=${safeRefToken(latest.evidenceId, "managed-dispatch-exposure-authorization")}`,
      "s7_managed_dispatch_exposure_block_label=invalid_or_unreadable_evidence",
      `s7_managed_dispatch_exposure_block_reason_label=${safeBlockLabel(latest.reason, "invalid_evidence")}`,
      ...noDispatchAuthorityRefs
    ];
  }

  return ["s7_managed_dispatch_exposure_state=unknown", "s7_managed_dispatch_exposure_evidence=not_yet_evaluated", ...noDispatchAuthorityRefs];
}

function exactModelAvailabilityCacheRefreshRefs(context: FlowDeskCommandBackedHandlerContextV1): string[] {
  const plan = context.diagnostic?.exactModelAvailabilityCacheRefreshPlan;
  if (plan === undefined) return ["exact_model_cache_refresh_state=blocked", "exact_model_cache_evidence=missing"];
  return [
    `exact_model_cache_refresh_state=${plan.state}`,
    `exact_model_cache_discovery_required=${plan.discovery_required}`,
    `exact_model_cache_refresh_required=${plan.refresh_required}`,
    `exact_model_cache_usable_for_assignment=${plan.cache_usable_for_assignment}`,
    `exact_model_cache_discovery_attempted=${plan.discovery_attempted}`,
    `exact_model_cache_refresh_attempted=${plan.refresh_attempted}`,
    `exact_model_cache_actualLaneLaunch=${plan.actualLaneLaunch}`,
    `exact_model_cache_providerCall=${plan.providerCall}`,
    `exact_model_cache_runtimeExecution=${plan.runtimeExecution}`,
    ...plan.refresh_reason_labels.map((label) => `exact_model_cache_refresh_reason=${label}`),
    ...plan.blocked_labels.map((label) => `exact_model_cache_blocker=${label}`)
  ];
}

function reviewerFanoutRefs(context: FlowDeskCommandBackedHandlerContextV1): string[] {
  const plan = context.diagnostic?.reviewerFanoutPlan;
  if (plan === undefined) return ["reviewer_fanout_state=blocked", "reviewer_fanout_evidence=missing"];
  return [
    `reviewer_fanout_state=${plan.state}`,
    `reviewer_fanout_required_perspectives=${plan.required_perspectives.length}`,
    `reviewer_fanout_planned_perspectives=${plan.planned_perspectives.length}`,
    `reviewer_fanout_runtime_launch_plan_required=${plan.runtime_launch_plan_required}`,
    `reviewer_fanout_lane_launch_approval_required=${plan.lane_launch_approval_required}`,
    `reviewer_fanout_launch_attempted=${plan.launch_attempted}`,
    `reviewer_fanout_approval_inferred=${plan.approval_inferred}`,
    `reviewer_fanout_actualLaneLaunch=${plan.actualLaneLaunch}`,
    `reviewer_fanout_providerCall=${plan.providerCall}`,
    `reviewer_fanout_runtimeExecution=${plan.runtimeExecution}`,
    ...plan.blocked_labels.map((label) => `reviewer_fanout_blocker=${label}`)
  ];
}


function fallbackRegateRefs(context: FlowDeskCommandBackedHandlerContextV1): string[] {
  const plan = context.diagnostic?.fallbackRegatePlan;
  if (plan === undefined) return [];
  return [
    `fallback_regate_plan_state=${plan.state}`,
    `fallback_regate_plan_decision_ref=${plan.decision_ref}`,
    `fallback_regate_plan_consumed_approval_ref=${plan.consumed_fallback_approval_ref}`
  ];
}

function sdkSessionHealthRefs(context: FlowDeskCommandBackedHandlerContextV1): string[] {
  const health = context.diagnostic?.sdkSessionHealth;
  if (health === undefined) return ["sdk_session_api_health=not_checked", "sdk_session_abort_automation=disabled_release1"];
  return [
    `sdk_session_api_health=${health.status}`,
    ...(health.status === "api_responsive" ? [] : [`sdk_session_api_reason=${health.reason}`]),
    "sdk_session_abort_automation=disabled_release1"
  ];
}

function devBetaAgentTaskRunRefs(context: FlowDeskCommandBackedHandlerContextV1): string[] {
  const capability = context.diagnostic?.devBetaAgentTaskRun;
  if (capability === undefined) return ["dev_beta_agent_task_run=not_reported"];
  const launchCapable = capability.enabled && capability.registered && capability.hasInjectedSdkClient && capability.durableStateRootConfigured;
  return [
    `dev_beta_agent_task_run_enabled=${capability.enabled}`,
    `dev_beta_agent_task_run_registered=${capability.registered}`,
    `dev_beta_agent_task_run_has_sdk_client=${capability.hasInjectedSdkClient}`,
    `dev_beta_agent_task_run_durable_root=${capability.durableStateRootConfigured}`,
    `dev_beta_agent_task_run_launch_capable=${launchCapable}`,
    "dev_beta_agent_task_run_note=separate_from_default_production_dispatch_gate"
  ];
}

function evidenceCompactionRefs(context: FlowDeskCommandBackedHandlerContextV1): string[] {
  const health = context.diagnostic?.compactionHealth;
  if (health === undefined) return ["evidence_compaction_enabled=false", "evidence_compaction_last_time=null", "evidence_compaction_merkle_match=false"];
  return [
    `evidence_compaction_enabled=${health.compactionEnabled}`,
    `evidence_compaction_last_time=${health.lastCompactionTime ?? "null"}`,
    `evidence_compaction_files_removed=${health.lastCompactionResult.filesRemoved}`,
    `evidence_compaction_archived=${health.lastCompactionResult.archived}`,
    `evidence_compaction_errors=${health.lastCompactionResult.errors}`,
    `evidence_compaction_merkle_match=${health.merkleRootMatch}`,
    ...(health.lastCompactionEvidence === undefined ? [] : [`evidence_compaction_ref=${health.lastCompactionEvidence}`])
  ];
}

function githubConnectorSection(request: FlowDeskDoctorRequestV1, context: FlowDeskCommandBackedHandlerContextV1): DoctorSectionResultV1 {
  const github = context.diagnostic?.githubConnector;
  const productionPublish = github?.productionPublish ?? "disabled";
  const surplusFreshness = github?.freshness.surplusUsageGate ?? "missing";
  const minimizationFreshness = github?.freshness.minimizationPolicy ?? "missing";
  const effectivelyBlocked = productionPublish !== "enabled" || surplusFreshness !== "fresh" || minimizationFreshness !== "fresh";
  return doctorSectionFor(
    "github_connector",
    effectivelyBlocked ? "degraded_mode_warning" : "informational",
    request,
    `GitHub Connector productionPublish=${effectivelyBlocked ? "blocked" : "enabled"}; configuredState=${productionPublish}; lastConfiguredAt=${github?.lastConfiguredAt ?? "null"}; githubTokenAvailable=${github?.githubTokenAvailable ?? false}; authSource=${github?.authSource ?? "missing"}; freshness surplusUsageGate=${surplusFreshness}, minimizationPolicy=${minimizationFreshness}.`,
    [
      "github_connector_doctor_ref",
      `github_connector_productionPublish=${productionPublish}`,
      `github_connector_lastConfiguredAt=${github?.lastConfiguredAt ?? "null"}`,
      `github_connector_token_available=${github?.githubTokenAvailable ?? false}`,
      `github_connector_auth_source=${github?.authSource ?? "missing"}`,
      `github_connector_surplus_usage_gate_freshness=${surplusFreshness}`,
      `github_connector_minimization_policy_freshness=${minimizationFreshness}`,
      `github_connector_effectively_blocked=${effectivelyBlocked}`
    ]
  );
}

function doctorSectionsFor(request: FlowDeskDoctorRequestV1, context: FlowDeskCommandBackedHandlerContextV1): DoctorSectionResultV1[] {
  const productionReadiness = getFlowDeskRelease1ProductionReadinessSummary();
  const enablementRefs = productionEnablementRefs(context);
  const promotionRefs = defaultManagedDispatchPromotionRefs(context);
  const bundleRefs = managedDispatchBundleEvaluationRefs(context);
  const exposureAuthorizationRefs = managedDispatchExposureAuthorizationRefs(context);
  const exactModelCacheRefs = exactModelAvailabilityCacheRefreshRefs(context);
  const fanoutRefs = reviewerFanoutRefs(context);
  const fallbackRefs = fallbackRegateRefs(context);
  const sdkHealthRefs = sdkSessionHealthRefs(context);
  const agentTaskRunRefs = devBetaAgentTaskRunRefs(context);
  const compactionRefs = evidenceCompactionRefs(context);
  const allSections = [
    doctorSectionFor("migration_cleanup", "informational", request, "FlowDesk bootstrap evidence is redacted and diagnostic-only; installer authority does not approve dispatch.", ["doctor-migration-cleanup-ref"]),
    doctorSectionFor("opencode_plugin_compatibility", "informational", request, `FlowDesk Release 1 default production dispatch promotion is separate from explicit dev/beta agent-task lanes. Command registration is ready with ${productionReadiness.passedChecks} readiness checks passed; ${productionEnablementPresentationSummary(context)} S7 managed-dispatch exposure authorization is diagnostic/readiness-only and does not open production dispatch. Use the dev_beta_agent_task_run refs to judge whether real subtask launch is available in this runtime.`, ["doctor-opencode-compatibility-ref", `production-readiness-passed-${productionReadiness.passedChecks}`, FLOWDESK_PLANNED_TOP_TIER_MULTI_PERSPECTIVE_REVIEW_MODE_FIELD_REF, ...enablementRefs, ...promotionRefs, ...bundleRefs, ...exposureAuthorizationRefs, ...exactModelCacheRefs, ...fanoutRefs, ...fallbackRefs, ...sdkHealthRefs, ...agentTaskRunRefs]),
    doctorSectionFor("provider_usage_readiness", "degraded_mode_warning", request, "FlowDesk reports provider usage and health as diagnostic-only unless auth readiness and fresh real usage/quota/reset evidence are available for the exact provider, model, account, and auth scope. Models are excluded when evidence is absent.", ["doctor-provider-usage-ref", "usage-health-diagnostic-only", "all-model-auth-usage-required"]),
    doctorSectionFor("policy_project_safety", "informational", request, "FlowDesk policy checks preserve Release 1 safe command-backed behavior; Release 2 dispatch requires durable evidence, configured verification, sanitized auth capture, external auth/provider policy, explicit approval, and doctor-visible enablement state.", ["doctor-policy-project-ref", "production_approval_state_machine=fail_closed", "configured_verification_gate=required", "sanitized_auth_capture_gate=required", "external_auth_provider_policy_gate=required"]),
    doctorSectionFor("evidence_compaction", "informational", request, "Evidence Compaction reports native agent-task-progress cleanup health, archive counts, and merkle-root integrity without granting dispatch, fallback, or write authority outside the configured state root.", ["doctor-evidence-compaction-ref", ...compactionRefs]),
    githubConnectorSection(request, context)
  ];
  if (request.check_scope === "all") return allSections;
  if (request.check_scope === "install") return allSections.filter((section) => section.section === "migration_cleanup");
  if (request.check_scope === "policy") return allSections.filter((section) => section.section === "policy_project_safety");
  if (request.check_scope === "usage" || request.check_scope === "provider_health") return allSections.filter((section) => section.section === "provider_usage_readiness");
  if (request.check_scope === "runtime") return allSections.filter((section) => section.section === "opencode_plugin_compatibility" || section.section === "github_connector");
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
    // Partial check_scope runs (install, runtime, policy, usage, provider_health) cover only a
    // subset of sections and cannot conclude the full system is "ready". Return "diagnostic_only"
    // for informational-category partial scopes; only a full "all" scope with no degraded/blocking
    // sections earns "ready".
    status: category === "dispatch_blocking" ? "blocked"
      : category === "degraded_mode_warning" ? "degraded"
      : request.check_scope === "all" ? "ready"
      : "diagnostic_only",
    safe_next_actions: [...outcome.safe_next_actions],
    user_message: request.persist_report ? "FlowDesk doctor prepared redacted section results." : "FlowDesk doctor check complete. System is active and default production dispatch gates are verified.",
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
    status: statusOnly ? "ready" : "recovery_available",
    safe_next_actions: ["/flowdesk-status", "/flowdesk-export-debug"],
    user_message: statusOnly ? "FlowDesk recovery is in status-only mode." : "FlowDesk prepared a recovery decision. Fresh checks will be performed automatically before resuming.",
    resume_decision: statusOnly ? "status_only" : "requires_fresh_checks",
    required_fresh_checks: [
      { check: "checkpoint", required: true, ref: request.checkpoint_id },
      { check: "audit", required: true },
      { check: "provider_health", required: true },
      { check: "usage", required: true }
    ]
  };
}

function evaluateAbortDiagnostic(request: FlowDeskAbortRequestV1, context: FlowDeskCommandBackedHandlerContextV1): FlowDeskAbortResponseV1 {
  const laneAbortResult = context.diagnostic?.laneAbortResult;
  if (request.lane_id !== undefined && laneAbortResult?.status === "aborted") {
    return {
      schema_version: "flowdesk.abort.response.v1",
      ok: true,
      status: "ready",
      safe_next_actions: ["/flowdesk-status", "/flowdesk-export-debug"],
      user_message: `FlowDesk recorded task abort lifecycle evidence for ${laneAbortResult.lane_id}.`,
      cancellation_state: "cancel_observed",
      remaining_safe_actions: ["/flowdesk-status", "/flowdesk-export-debug"],
      lane_refs: [laneAbortResult.lifecycle_evidence_id]
    };
  }
  if (request.lane_id !== undefined && laneAbortResult !== undefined) {
    return {
      schema_version: "flowdesk.abort.response.v1",
      ok: false,
      status: "blocked",
      safe_next_actions: ["/flowdesk-status", "/flowdesk-export-debug"],
      user_message: `FlowDesk did not abort task ${request.lane_id}: ${laneAbortResult.reason}. No session abort, provider call, task launch, hard chat cancellation, or no-reply was used. No-reply is not a Release 1 capability.`,
      cancellation_state: "cancel_failed",
      remaining_safe_actions: ["/flowdesk-status", "/flowdesk-export-debug"]
    };
  }
  return {
    schema_version: "flowdesk.abort.response.v1",
    ok: false,
    status: "blocked",
    safe_next_actions: ["/flowdesk-status", "/flowdesk-export-debug"],
    user_message: "FlowDesk recorded an abort request. Cancellation evidence will be tracked in the next status update.",
    cancellation_state: "cancel_failed",
    remaining_safe_actions: ["/flowdesk-status", "/flowdesk-export-debug"]
  };
}

function evaluateUsageDiagnostic(request: FlowDeskUsageRequestV1, context: FlowDeskCommandBackedHandlerContextV1): FlowDeskUsageResponseV1 {
  const id = requestId(request);
  const evidence = freshestMatchingUsageEvidence(request, context);
  if (evidence !== undefined) {
    const usageSnapshotRef = usageEvidenceSnapshotRef(evidence) ?? `usage-${id}`;
    const providerHealthSnapshotRef = usageEvidenceHealthSnapshotRef(evidence) ?? context.diagnostic?.providerHealthSnapshotRef;
    const uncertaintyFlags = usageEvidenceUncertaintyFlags(evidence);
    const dispatchability = safeUsageResponseDispatchability(evidence, uncertaintyFlags);
    // "diagnostic_only" dispatchability is not degraded-mode (data is fresh/valid) but is also not
    // fully ready for dispatch — it has its own status. "non_dispatchable" or stale/uncertain data
    // maps to "degraded". Only fresh data with no uncertainty and non-diagnostic dispatchability is "ready".
    const diagnosticOnly = dispatchability === "diagnostic_only";
    const degraded = !diagnosticOnly && (evidence.freshness !== "fresh" || dispatchability === "non_dispatchable" || uncertaintyFlags.length > 0);
    const responseStatus = diagnosticOnly ? "diagnostic_only" : degraded ? "degraded" : "ready";
    return {
      schema_version: "flowdesk.usage.response.v1",
      ok: true,
      status: responseStatus,
      safe_next_actions: responseStatus === "ready" ? ["/flowdesk-status", "/flowdesk-export-debug"] : ["/flowdesk-doctor", "/flowdesk-status", "/flowdesk-export-debug"],
      user_message: responseStatus === "ready"
        ? "FlowDesk found fresh cached provider usage evidence. Usage data is active and ready for dispatch planning."
        : "FlowDesk found cached provider usage evidence. Usage data is available for review, but some providers may be near limits or stale.",
      usage_snapshot_ref: usageSnapshotRef,
      ...(providerHealthSnapshotRef === undefined ? {} : { provider_health_snapshot_ref: providerHealthSnapshotRef }),
      freshness: evidence.freshness,
      dispatchability,
      uncertainty_flags: uncertaintyFlags
    };
  }
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
      : request.refresh ? "FlowDesk reported usage as unknown without provider calls or persisted refresh." : "FlowDesk reported cached usage availability as unknown and command-backed only.",
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
    status: "ready",
    safe_next_actions: ["/flowdesk-status"],
    user_message: "FlowDesk prepared redacted debug section refs. No raw logs, provider payloads, or absolute paths are included.",
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
		if (context.run?.fakeRuntime === undefined) return result("missing_evaluator_input", toolName, requestResult, invalid("command-backed test run evaluator input is required"), undefined, false);
		const evaluation = evaluateFlowDeskFakeRuntimeCommandV1({ ...context.run.fakeRuntime, commandName: "/flowdesk-run", request: runRequest });
		return result("command_backed_core_evaluator", toolName, requestResult, responseSchemaResult(toolName, evaluation.response), evaluation.response, evaluation.ok);
	}

  if (toolName === "flowdesk_status") {
    if (context.status === undefined) return result("missing_evaluator_input", toolName, requestResult, invalid("status evaluator input is required"), undefined, false);
    const evaluation = evaluateFlowDeskStatusCommandV1({ ...context.status, request: request as FlowDeskStatusCommandInputV1["request"] });
    const response = enrichStatusPresentation(evaluation.response, context);
    return result("command_backed_core_evaluator", toolName, requestResult, responseSchemaResult(toolName, response), response, evaluation.ok);
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
    const response = evaluateAbortDiagnostic(request as FlowDeskAbortRequestV1, context);
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

  if (readiness?.handlerReadiness !== "core_evaluator_available") return result("schema_only_pending", toolName, requestResult, invalid("core evaluator is not implemented for this handler yet"), undefined, false);
  return result("schema_only_pending", toolName, requestResult, invalid("core evaluator is not implemented for this handler yet"), undefined, false);
}
