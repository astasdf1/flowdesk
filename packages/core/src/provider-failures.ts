import type { ProviderFailureClass, ProviderHealthSummaryV1, RedactedErrorCategory, SafeNextAction, ToolStatus } from "./release1-contracts.js";
import { PROVIDER_FAILURE_CLASSES } from "./release1-contracts.js";

export interface ProviderFailureDiagnosticMappingV1 {
  failure_class: ProviderFailureClass;
  availability_state: ProviderHealthSummaryV1["availability_state"];
  dispatchability: ProviderHealthSummaryV1["dispatchability"];
  diagnostic_status: ToolStatus;
  retry_state: "planned" | "blocked" | "diagnostic_only";
  redacted_category: RedactedErrorCategory;
  safe_next_actions: SafeNextAction[];
  safe_remediation: string;
  dispatch_authorized: false;
  fallback_authorized: false;
  provider_call_authorized: false;
  hard_chat_authority: false;
}

const providerDiagnosticActions = ["/flowdesk-doctor", "/flowdesk-usage", "/flowdesk-status", "/flowdesk-export-debug"] as const satisfies readonly SafeNextAction[];
const modelDiagnosticActions = ["/flowdesk-doctor", "/flowdesk-status", "/flowdesk-export-debug"] as const satisfies readonly SafeNextAction[];
const retryDiagnosticActions = ["/flowdesk-doctor", "/flowdesk-usage", "/flowdesk-status", "/flowdesk-retry", "/flowdesk-export-debug"] as const satisfies readonly SafeNextAction[];
const noFailureActions = ["/flowdesk-status", "/flowdesk-usage", "/flowdesk-export-debug"] as const satisfies readonly SafeNextAction[];

const mappingByFailureClass: Record<ProviderFailureClass, Omit<ProviderFailureDiagnosticMappingV1, "failure_class" | "dispatch_authorized" | "fallback_authorized" | "provider_call_authorized" | "hard_chat_authority">> = {
  none: {
    availability_state: "healthy",
    dispatchability: "diagnostic_only",
    diagnostic_status: "diagnostic_only",
    retry_state: "planned",
    redacted_category: "provider_health",
    safe_next_actions: [...noFailureActions],
    safe_remediation: "Provider health has no recorded failure; continue with Release 1 diagnostic status checks."
  },
  auth_missing: {
    availability_state: "unavailable",
    dispatchability: "non_dispatchable",
    diagnostic_status: "blocked",
    retry_state: "diagnostic_only",
    redacted_category: "provider_api",
    safe_next_actions: [...providerDiagnosticActions],
    safe_remediation: "Run /flowdesk-doctor and provider setup checks; retry planning remains diagnostic-only until credentials are fixed."
  },
  auth_expired: {
    availability_state: "unavailable",
    dispatchability: "non_dispatchable",
    diagnostic_status: "blocked",
    retry_state: "diagnostic_only",
    redacted_category: "provider_api",
    safe_next_actions: [...providerDiagnosticActions],
    safe_remediation: "Run /flowdesk-doctor and refresh provider authentication outside FlowDesk before retry planning."
  },
  provider_unavailable: {
    availability_state: "unavailable",
    dispatchability: "non_dispatchable",
    diagnostic_status: "blocked",
    retry_state: "diagnostic_only",
    redacted_category: "provider_health",
    safe_next_actions: [...providerDiagnosticActions],
    safe_remediation: "Run /flowdesk-doctor and /flowdesk-usage to refresh redacted provider availability diagnostics."
  },
  rate_limited: {
    availability_state: "degraded",
    dispatchability: "non_dispatchable",
    diagnostic_status: "degraded",
    retry_state: "diagnostic_only",
    redacted_category: "provider_api",
    safe_next_actions: [...retryDiagnosticActions],
    safe_remediation: "Run /flowdesk-usage and /flowdesk-status; retry planning stays diagnostic-only until provider limits are fresh and healthy."
  },
  model_unavailable: {
    availability_state: "unavailable",
    dispatchability: "non_dispatchable",
    diagnostic_status: "blocked",
    retry_state: "diagnostic_only",
    redacted_category: "model_availability",
    safe_next_actions: [...modelDiagnosticActions],
    safe_remediation: "Run /flowdesk-doctor and inspect model availability diagnostics before planning another attempt."
  },
  transport_timeout: {
    availability_state: "unknown",
    dispatchability: "non_dispatchable",
    diagnostic_status: "degraded",
    retry_state: "diagnostic_only",
    redacted_category: "provider_api",
    safe_next_actions: [...retryDiagnosticActions],
    safe_remediation: "Run /flowdesk-doctor and /flowdesk-status to refresh transport diagnostics before retry planning."
  },
  provider_error: {
    availability_state: "degraded",
    dispatchability: "non_dispatchable",
    diagnostic_status: "degraded",
    retry_state: "diagnostic_only",
    redacted_category: "provider_api",
    safe_next_actions: [...providerDiagnosticActions],
    safe_remediation: "Run /flowdesk-doctor and inspect redacted provider API diagnostics before retry planning."
  },
  opencode_provider_load_failure: {
    availability_state: "unavailable",
    dispatchability: "non_dispatchable",
    diagnostic_status: "blocked",
    retry_state: "diagnostic_only",
    redacted_category: "provider_health",
    safe_next_actions: [...providerDiagnosticActions],
    safe_remediation: "Run /flowdesk-doctor to inspect OpenCode provider loading diagnostics before retry planning."
  },
  telemetry_ambiguous: {
    availability_state: "unknown",
    dispatchability: "non_dispatchable",
    diagnostic_status: "diagnostic_only",
    retry_state: "diagnostic_only",
    redacted_category: "provider_health",
    safe_next_actions: [...providerDiagnosticActions],
    safe_remediation: "Run /flowdesk-doctor and /flowdesk-status to refresh ambiguous provider telemetry."
  }
};

export function mapProviderFailureClassToDiagnosticOutcomeV1(failureClass: ProviderFailureClass): ProviderFailureDiagnosticMappingV1 {
  const mapping = mappingByFailureClass[failureClass];
  return {
    failure_class: failureClass,
    ...mapping,
    safe_next_actions: [...mapping.safe_next_actions],
    dispatch_authorized: false,
    fallback_authorized: false,
    provider_call_authorized: false,
    hard_chat_authority: false
  };
}

export function getProviderFailureDiagnosticMappingsV1(): ProviderFailureDiagnosticMappingV1[] {
  return PROVIDER_FAILURE_CLASSES.map((failureClass) => mapProviderFailureClassToDiagnosticOutcomeV1(failureClass));
}

export function providerFailureClassIsDiagnosticOnlyV1(failureClass: ProviderFailureClass): boolean {
  return failureClass !== "none";
}
