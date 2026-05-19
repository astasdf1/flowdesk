import { validateEffectivePolicyV1, validateNonDispatchPermissionV1 } from "./config-policy.js";
import type {
  FlowDeskConformanceRuntimeMetadataV1,
  FlowDeskEffectivePolicyV1,
  FlowDeskManagedDispatchBetaBindingEvidenceV1,
  FlowDeskManagedDispatchBetaPolicyV1,
  FlowDeskManagedDispatchBetaRuntimeEchoEvidenceV1,
  FlowDeskManagedDispatchBetaTelemetryCorrelationV1,
  FlowDeskNonDispatchPermissionV1,
  FlowDeskProviderHealthSnapshotV1,
  FlowDeskUsageSnapshotV1,
  GuardApprovedDispatchV1,
  GuardCheckV1,
  GuardRequestV1,
  OpaqueRef,
  RedactedErrorCategory
} from "./release1-contracts.js";
import {
  validateManagedDispatchBetaApprovalFreshnessV1,
  validateManagedDispatchBetaBindingEvidenceV1,
  validateManagedDispatchBetaPolicyV1,
  validateManagedDispatchBetaProviderHealthEvidenceV1,
  validateManagedDispatchBetaRuntimeEchoEvidenceV1,
  validateManagedDispatchBetaTelemetryCorrelationV1,
  validateManagedDispatchBetaUsageEvidenceV1,
  validateOpaqueRef,
  validateProviderHealthSnapshotV1,
  validateUsageSnapshotV1
} from "./validators.js";

export type GuardBoundaryOperationV1 = "real-opencode-dispatch" | "guarded-dry-run" | "fake-runtime" | "command-steering";
export type GuardBoundaryStatusV1 = "blocked" | "eligible" | "diagnostic_only";

export interface GuardBoundaryInputV1 {
  operation: GuardBoundaryOperationV1;
  configHash?: string;
  workflowId?: string;
  scopeRef?: OpaqueRef;
  policy?: FlowDeskEffectivePolicyV1;
  usageSnapshot?: FlowDeskUsageSnapshotV1;
  providerHealthSnapshot?: FlowDeskProviderHealthSnapshotV1;
  auditRef?: OpaqueRef;
  conformanceRef?: OpaqueRef;
  runtimeCapabilityRef?: OpaqueRef;
  nonDispatchPermission?: FlowDeskNonDispatchPermissionV1;
  now?: number;
}

export interface GuardBoundaryDecisionV1 {
  status: GuardBoundaryStatusV1;
  reason_category: RedactedErrorCategory;
  redacted_reason: string;
  required_checks: GuardCheckV1[];
  safe_next_actions: readonly ["/flowdesk-doctor", "/flowdesk-status"];
}

export interface ManagedDispatchBetaBoundaryInputV1 {
  configHash: string;
  policyPackHashes: readonly string[];
  workflowId: string;
  stepId: string;
  attemptId: string;
  betaPolicy?: FlowDeskManagedDispatchBetaPolicyV1;
  guardApproval?: GuardApprovedDispatchV1;
  bindingEvidence?: FlowDeskManagedDispatchBetaBindingEvidenceV1;
  usageSnapshot?: FlowDeskUsageSnapshotV1;
  providerHealthSnapshot?: FlowDeskProviderHealthSnapshotV1;
  runtimeEchoEvidence?: FlowDeskManagedDispatchBetaRuntimeEchoEvidenceV1;
  conformanceRuntimeMetadata?: FlowDeskConformanceRuntimeMetadataV1;
  telemetryCorrelation?: FlowDeskManagedDispatchBetaTelemetryCorrelationV1;
  preDispatchAuditRef?: OpaqueRef;
  configuredVerificationRef?: OpaqueRef;
  fallbackOrReselectionAllowed?: boolean;
  hardChatAuthorityAllowed?: boolean;
  ambiguityQuarantined?: boolean;
  now?: number;
}

function fail(check: GuardCheckV1["check"], ref?: string): GuardCheckV1 {
  return { check, result: "fail", ...(ref === undefined ? {} : { ref }) };
}

function pass(check: GuardCheckV1["check"], ref?: string): GuardCheckV1 {
  return { check, result: "pass", ...(ref === undefined ? {} : { ref }) };
}

function boundaryDecision(status: GuardBoundaryStatusV1, reason_category: RedactedErrorCategory, redacted_reason: string, required_checks: GuardCheckV1[]): GuardBoundaryDecisionV1 {
  return { status, reason_category, redacted_reason, required_checks, safe_next_actions: ["/flowdesk-doctor", "/flowdesk-status"] };
}

export function evaluateGuardBoundaryV1(input: GuardBoundaryInputV1): GuardBoundaryDecisionV1 {
  const checks: GuardCheckV1[] = [];
  if (input.policy === undefined || input.configHash === undefined) {
    checks.push(fail("policy"));
    return boundaryDecision("blocked", "policy", "Missing validated Release 1 config or effective policy.", checks);
  }
  const policyResult = validateEffectivePolicyV1(input.policy, { expectedConfigHash: input.configHash });
  if (!policyResult.ok) {
    checks.push(fail("policy"));
    return boundaryDecision("blocked", "policy", "Effective policy failed closed validation.", checks);
  }
  checks.push(pass("policy"));

  if (input.operation === "real-opencode-dispatch") {
    checks.push(fail("conformance", input.conformanceRef), fail("audit", input.auditRef), fail("approval"));
    return boundaryDecision("blocked", "policy", "Release 1 blocks real OpenCode dispatch regardless of diagnostic evidence.", checks);
  }

  if (input.operation === "command-steering") {
    return boundaryDecision("diagnostic_only", "runtime", "Command steering is diagnostic and command-backed only.", checks);
  }

  const permission = input.nonDispatchPermission;
  if (permission === undefined) {
    checks.push(fail("approval"));
    return boundaryDecision("blocked", "policy", "Guard-approved non-dispatch permission is required.", checks);
  }
  if (input.workflowId === undefined || input.scopeRef === undefined) {
    checks.push(fail("approval"));
    return boundaryDecision("blocked", "policy", "Guard boundary requires explicit workflow and scope binding.", checks);
  }
  const expectedPermissionClass = input.operation === "fake-runtime" ? "fake_runtime_write" : "audit_write";
  const permissionResult = validateNonDispatchPermissionV1(permission, {
    expectedConfigHash: input.configHash,
    expectedPolicyPackHashes: input.policy.policy_pack_hashes,
    expectedPermissionClass,
    expectedWorkflowId: input.workflowId,
    expectedScopeRef: input.scopeRef,
    expectedAuditRef: input.auditRef,
    requireWorkflowId: true,
    requireAuditRef: true,
    forbiddenGrantSources: ["policy_pack"],
    now: input.now
  });
  if (!permissionResult.ok) {
    checks.push(fail("approval"));
    return boundaryDecision("blocked", "policy", "Non-dispatch permission is missing, stale, mismatched, or out of scope.", checks);
  }
  checks.push(pass("approval", permission.audit_ref));

  if (input.auditRef === undefined) {
    checks.push(fail("audit"));
    return boundaryDecision("blocked", "audit", "Durable redacted audit reference is required before dry-run or fake-runtime writes.", checks);
  }
  checks.push(pass("audit", input.auditRef));

  if (input.runtimeCapabilityRef === undefined) {
    checks.push(fail("conformance", input.conformanceRef));
    return boundaryDecision("blocked", "conformance", "Runtime capability evidence is required for guarded dry-run or fake-runtime.", checks);
  }
  checks.push(pass("conformance", input.conformanceRef), pass("runtime_compatibility", input.runtimeCapabilityRef));
  return boundaryDecision("eligible", "runtime", "Eligible only for Release 1 non-dispatch guarded execution.", checks);
}

export function evaluateRealDispatchPreconditionsV1(request: GuardRequestV1, usage?: FlowDeskUsageSnapshotV1, providerHealth?: FlowDeskProviderHealthSnapshotV1): GuardBoundaryDecisionV1 {
  const checks: GuardCheckV1[] = [];
  if (request.requested_operation !== "real-opencode-dispatch") return boundaryDecision("diagnostic_only", "runtime", "Request is not a real dispatch request.", checks);
  if (usage === undefined || !validateUsageSnapshotV1(usage).ok || usage.dispatchability !== "dispatchable") checks.push(fail("usage", request.usage_snapshot_ref));
  else checks.push(pass("usage", request.usage_snapshot_ref));
  if (providerHealth === undefined || !validateProviderHealthSnapshotV1(providerHealth).ok || providerHealth.dispatchability !== "dispatchable") checks.push(fail("provider_health", request.provider_health_snapshot_ref));
  else checks.push(pass("provider_health", request.provider_health_snapshot_ref));
  checks.push(fail("policy"));
  return boundaryDecision("blocked", "policy", "Release 1 real dispatch remains blocked even when diagnostic snapshots are present.", checks);
}

export function evaluateManagedDispatchBetaGuardBoundaryV1(input: ManagedDispatchBetaBoundaryInputV1): GuardBoundaryDecisionV1 {
  const checks: GuardCheckV1[] = [];
  const providerFamily = input.guardApproval?.provider_family;
  const providerQualifiedModelId = input.guardApproval?.provider_qualified_model_id;
  const usageSnapshotRef = input.usageSnapshot?.snapshot_id;
  const providerHealthSnapshotRef = input.providerHealthSnapshot?.snapshot_id;
  const runtimeCapabilityRef = input.guardApproval?.runtime_capability_ref ?? input.runtimeEchoEvidence?.runtime_capability_ref;
  const preDispatchAuditRef = input.preDispatchAuditRef;
  const evidenceOptions = {
    expectedConfigHash: input.configHash,
    expectedPolicyPackHashes: input.policyPackHashes,
    expectedWorkflowId: input.workflowId,
    expectedStepId: input.stepId,
    expectedAttemptId: input.attemptId,
    expectedProviderFamily: providerFamily,
    expectedProviderQualifiedModelId: providerQualifiedModelId,
    expectedUsageSnapshotRef: usageSnapshotRef,
    expectedProviderHealthSnapshotRef: providerHealthSnapshotRef,
    expectedRuntimeCapabilityRef: runtimeCapabilityRef,
    expectedPreDispatchAuditRef: preDispatchAuditRef,
    expectedConformanceRef: input.runtimeEchoEvidence?.conformance_ref,
    now: input.now
  };

  if (input.betaPolicy === undefined) {
    checks.push(fail("policy"));
    return boundaryDecision("blocked", "policy", "Managed-dispatch beta policy mode is required.", checks);
  }
  const policyResult = validateManagedDispatchBetaPolicyV1(input.betaPolicy, evidenceOptions);
  if (!policyResult.ok) {
    checks.push(fail("policy", input.betaPolicy.audit_ref));
    return boundaryDecision("blocked", "policy", "Managed-dispatch beta policy failed closed validation.", checks);
  }
  checks.push(pass("policy", input.betaPolicy.audit_ref));

  if (input.fallbackOrReselectionAllowed === true || input.hardChatAuthorityAllowed === true || input.ambiguityQuarantined !== true) {
    checks.push(fail("policy"));
    return boundaryDecision("blocked", "policy", "Managed-dispatch beta forbids fallback, hard chat authority, and non-quarantined ambiguity.", checks);
  }

  if (input.guardApproval === undefined) {
    checks.push(fail("approval"));
    return boundaryDecision("blocked", "policy", "GuardApprovedDispatch evidence is required.", checks);
  }
  const approvalResult = validateManagedDispatchBetaApprovalFreshnessV1(input.guardApproval, evidenceOptions);
  if (!approvalResult.ok) {
    checks.push(fail("approval"));
    return boundaryDecision("blocked", "policy", "GuardApprovedDispatch is stale, mismatched, replay-like, or malformed.", checks);
  }
  checks.push(pass("approval", input.guardApproval.guard_decision_id));

  if (input.bindingEvidence === undefined) {
    checks.push(fail("conformance"));
    return boundaryDecision("blocked", "conformance", "Trusted provider/model binding evidence is required.", checks);
  }
  const bindingResult = validateManagedDispatchBetaBindingEvidenceV1(input.bindingEvidence, evidenceOptions);
  if (!bindingResult.ok) {
    checks.push(fail("conformance", input.bindingEvidence.binding_ref));
    return boundaryDecision("blocked", "conformance", "Provider/model binding evidence is missing, untrusted, stale, or mismatched.", checks);
  }
  checks.push(pass("conformance", input.bindingEvidence.binding_ref));

  if (input.usageSnapshot === undefined) {
    checks.push(fail("usage", usageSnapshotRef));
    return boundaryDecision("blocked", "usage", "Fresh dispatchable usage evidence is required.", checks);
  }
  const usageResult = validateManagedDispatchBetaUsageEvidenceV1(input.usageSnapshot, evidenceOptions);
  if (!usageResult.ok) {
    checks.push(fail("usage", usageSnapshotRef));
    return boundaryDecision("blocked", "usage", "Usage evidence is missing, stale, ambiguous, or non-dispatchable.", checks);
  }
  checks.push(pass("usage", usageSnapshotRef));

  if (input.providerHealthSnapshot === undefined) {
    checks.push(fail("provider_health", providerHealthSnapshotRef));
    return boundaryDecision("blocked", "provider_health", "Fresh dispatchable provider health evidence is required.", checks);
  }
  const healthResult = validateManagedDispatchBetaProviderHealthEvidenceV1(input.providerHealthSnapshot, evidenceOptions);
  if (!healthResult.ok) {
    checks.push(fail("provider_health", providerHealthSnapshotRef));
    return boundaryDecision("blocked", "provider_health", "Provider health evidence is missing, stale, unhealthy, or non-dispatchable.", checks);
  }
  checks.push(pass("provider_health", providerHealthSnapshotRef));

  if (input.runtimeEchoEvidence === undefined || input.conformanceRuntimeMetadata === undefined) {
    checks.push(fail("runtime_compatibility", runtimeCapabilityRef), fail("conformance"));
    return boundaryDecision("blocked", "conformance", "Trusted runtime echo and conformance metadata are required.", checks);
  }
  const runtimeEchoResult = validateManagedDispatchBetaRuntimeEchoEvidenceV1(input.runtimeEchoEvidence, input.conformanceRuntimeMetadata, evidenceOptions);
  if (!runtimeEchoResult.ok) {
    checks.push(fail("runtime_compatibility", runtimeCapabilityRef), fail("conformance", input.runtimeEchoEvidence.conformance_ref));
    return boundaryDecision("blocked", "conformance", "Runtime echo or conformance metadata is untrusted, stale, mismatched, or insufficient.", checks);
  }
  checks.push(pass("runtime_compatibility", runtimeCapabilityRef), pass("conformance", input.runtimeEchoEvidence.conformance_ref));

  if (input.telemetryCorrelation === undefined) {
    checks.push(fail("conformance"));
    return boundaryDecision("blocked", "conformance", "Sufficient telemetry correlation evidence is required.", checks);
  }
  const telemetryResult = validateManagedDispatchBetaTelemetryCorrelationV1(input.telemetryCorrelation, evidenceOptions);
  if (!telemetryResult.ok) {
    checks.push(fail("conformance", input.telemetryCorrelation.telemetry_ref));
    return boundaryDecision("blocked", "conformance", "Telemetry correlation is insufficient, ambiguous, or mismatched.", checks);
  }
  checks.push(pass("conformance", input.telemetryCorrelation.telemetry_ref));

  if (preDispatchAuditRef === undefined || !validateOpaqueRef(preDispatchAuditRef, "pre_dispatch_audit_ref").ok || input.guardApproval.pre_dispatch_audit_ref !== preDispatchAuditRef) {
    checks.push(fail("audit", preDispatchAuditRef));
    return boundaryDecision("blocked", "audit", "Durable pre-dispatch audit reference is required and must match Guard approval.", checks);
  }
  checks.push(pass("audit", preDispatchAuditRef));

  if (input.configuredVerificationRef === undefined || !validateOpaqueRef(input.configuredVerificationRef, "configured_verification_ref").ok) {
    checks.push(fail("conformance"));
    return boundaryDecision("blocked", "conformance", "Configured verification reference is required before managed dispatch beta eligibility.", checks);
  }

  return boundaryDecision("eligible", "runtime", "Eligible for managed-dispatch beta only; evaluator does not perform dispatch.", checks);
}
