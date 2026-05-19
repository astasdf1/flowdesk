import { mapProviderFailureClassToDiagnosticOutcomeV1 } from "./provider-failures.js";
import type {
  FlowDeskProviderHealthSnapshotV1,
  FlowDeskUsageSnapshotV1,
  ProviderFailureClass,
  ProviderFamily,
  UsageUncertaintyFlagV1
} from "./release1-contracts.js";
import { invalid, type ValidationResult, valid, validateProviderHealthSnapshotV1, validateUsageSnapshotV1 } from "./validators.js";

export const PROVIDER_HEALTH_SOURCE_LABELS = ["opencode_config", "plugin_event", "doctor_probe", "usage_collector", "provider_smoke_test", "manual_report", "unknown"] as const;
export type ProviderHealthSourceLabelV1 = (typeof PROVIDER_HEALTH_SOURCE_LABELS)[number];

export const USAGE_SOURCE_LABELS = ["provider_api_truth", "local_observed_history", "response_usage_accounting", "diagnostic_probe", "inferred_estimate"] as const;
export type UsageSourceLabelV1 = (typeof USAGE_SOURCE_LABELS)[number];

export interface UnknownUsageSnapshotOptions {
  snapshotId: string;
  providerFamily: ProviderFamily;
  modelFamily?: string;
  observedAt?: string;
  sourceRef: string;
  uncertaintyFlags?: readonly UsageUncertaintyFlagV1[];
}

export interface ProviderHealthDiagnosticOptions {
  snapshotId: string;
  providerFamily: ProviderFamily;
  modelFamily?: string;
  observedAt: string;
  sourceRef: string;
  availabilityState?: FlowDeskProviderHealthSnapshotV1["availability_state"];
  failureClass?: ProviderFailureClass;
  telemetryRef?: string;
  safeRemediation?: string;
}

export type AuthReadinessRequiredProviderFamilyV1 = Exclude<ProviderFamily, "unknown" | "all">;

export interface AuthMissingProviderHealthOptions {
  snapshotId: string;
  providerFamily: AuthReadinessRequiredProviderFamilyV1;
  modelFamily?: string;
  observedAt: string;
  sourceRef: string;
}

export function providerFamilyRequiresAuthReadinessV1(providerFamily: ProviderFamily): providerFamily is AuthReadinessRequiredProviderFamilyV1 {
  return providerFamily !== "unknown" && providerFamily !== "all";
}

function providerLabel(providerFamily: AuthReadinessRequiredProviderFamilyV1): string {
  if (providerFamily === "claude") return "Claude";
  if (providerFamily === "openai") return "OpenAI";
  if (providerFamily === "gemini") return "Gemini";
  if (providerFamily === "opencode_go") return "OpenCode Go";
  if (providerFamily === "z_ai") return "z.ai";
  return "Provider";
}

export function createUnknownUsageSnapshotV1(options: UnknownUsageSnapshotOptions): FlowDeskUsageSnapshotV1 {
  return {
    schema_version: "flowdesk.usage_snapshot.v1",
    snapshot_id: options.snapshotId,
    provider_family: options.providerFamily,
    model_family: options.modelFamily ?? "unknown",
    freshness: "unknown",
    freshness_ttl: 0,
    reset_time: "unknown",
    reset_bucket: "unknown",
    dispatchability: "non_dispatchable",
    uncertainty_flags: [...new Set<UsageUncertaintyFlagV1>(["unknown", ...(options.uncertaintyFlags ?? [])])],
    source_ref: options.sourceRef
  };
}

export function createOpenCodeGoUnknownUsageSnapshotV1(snapshotId: string, sourceRef: string, modelFamily = "unknown"): FlowDeskUsageSnapshotV1 {
  return createUnknownUsageSnapshotV1({ snapshotId, providerFamily: "opencode_go", modelFamily, sourceRef });
}

export function createZAiUnknownUsageSnapshotV1(snapshotId: string, sourceRef: string, modelFamily = "unknown"): FlowDeskUsageSnapshotV1 {
  return createUnknownUsageSnapshotV1({ snapshotId, providerFamily: "z_ai", modelFamily, sourceRef });
}

export function createProviderHealthDiagnosticSnapshotV1(options: ProviderHealthDiagnosticOptions): FlowDeskProviderHealthSnapshotV1 {
  const availability = options.availabilityState ?? "unknown";
  const failure = options.failureClass ?? (availability === "unknown" ? "telemetry_ambiguous" : "none");
  const diagnostic = mapProviderFailureClassToDiagnosticOutcomeV1(failure);
  return {
    schema_version: "flowdesk.provider_health_snapshot.v1",
    snapshot_id: options.snapshotId,
    provider_family: options.providerFamily,
    ...(options.modelFamily === undefined ? {} : { model_family: options.modelFamily }),
    observed_at: options.observedAt,
    freshness: availability === "healthy" && failure === "none" ? "fresh" : "unknown",
    freshness_ttl: availability === "healthy" && failure === "none" ? 5 : 0,
    source_surface: "doctor_probe",
    availability_state: availability,
    failure_class: failure,
    ...(options.telemetryRef === undefined ? {} : { telemetry_ref: options.telemetryRef }),
    dispatchability: availability === "healthy" && failure === "none" ? "diagnostic_only" : diagnostic.dispatchability,
    source_ref: options.sourceRef,
    safe_remediation: options.safeRemediation ?? diagnostic.safe_remediation
  };
}

export function createAuthMissingProviderHealthSnapshotV1(options: AuthMissingProviderHealthOptions): FlowDeskProviderHealthSnapshotV1 {
  const label = providerLabel(options.providerFamily);
  return createProviderHealthDiagnosticSnapshotV1({
    snapshotId: options.snapshotId,
    providerFamily: options.providerFamily,
    modelFamily: options.modelFamily,
    observedAt: options.observedAt,
    sourceRef: options.sourceRef,
    availabilityState: "unavailable",
    failureClass: "auth_missing",
    safeRemediation: `${label} models are excluded until auth readiness and real usage/quota/reset evidence are proven outside FlowDesk.`
  });
}

export function createOpenCodeGoUnknownProviderHealthSnapshotV1(snapshotId: string, sourceRef: string, observedAt: string, modelFamily = "unknown"): FlowDeskProviderHealthSnapshotV1 {
  return createProviderHealthDiagnosticSnapshotV1({ snapshotId, providerFamily: "opencode_go", modelFamily, observedAt, sourceRef, availabilityState: "unknown", failureClass: "telemetry_ambiguous" });
}

export function createZAiUnknownProviderHealthSnapshotV1(snapshotId: string, sourceRef: string, observedAt: string, modelFamily = "unknown"): FlowDeskProviderHealthSnapshotV1 {
  return createProviderHealthDiagnosticSnapshotV1({ snapshotId, providerFamily: "z_ai", modelFamily, observedAt, sourceRef, availabilityState: "unknown", failureClass: "telemetry_ambiguous" });
}

export function validateUsageAndProviderHealthSeparatedV1(usage: unknown, providerHealth: unknown): ValidationResult {
  const usageResult = validateUsageSnapshotV1(usage);
  const healthResult = validateProviderHealthSnapshotV1(providerHealth);
  if (!usageResult.ok || !healthResult.ok) return invalid(...usageResult.errors, ...healthResult.errors);
  const usageRecord = usage as FlowDeskUsageSnapshotV1;
  const healthRecord = providerHealth as FlowDeskProviderHealthSnapshotV1;
  if (usageRecord.provider_family !== healthRecord.provider_family && usageRecord.provider_family !== "all" && healthRecord.provider_family !== "all") return invalid("usage/provider health provider families do not match");
  return valid();
}

export function rejectMergedUsageProviderAuthorityV1(value: unknown): ValidationResult {
  if (typeof value !== "object" || value === null || Array.isArray(value)) return invalid("authority object must be a record");
  const visit = (record: Record<string, unknown>): boolean => {
    const hasUsage = "usage_snapshot" in record || "usage_policy" in record;
    const hasHealth = "provider_health_snapshot" in record || "provider_health_policy" in record;
    if (hasUsage && hasHealth) return true;
    return Object.values(record).some((nested) => typeof nested === "object" && nested !== null && !Array.isArray(nested) && visit(nested as Record<string, unknown>));
  };
  return visit(value as Record<string, unknown>) ? invalid("usage and provider health must not be merged into one authority object") : valid();
}
