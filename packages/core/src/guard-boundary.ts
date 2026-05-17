import { validateEffectivePolicyV1, validateNonDispatchPermissionV1 } from "./config-policy.js";
import type {
  FlowDeskEffectivePolicyV1,
  FlowDeskNonDispatchPermissionV1,
  FlowDeskProviderHealthSnapshotV1,
  FlowDeskUsageSnapshotV1,
  GuardCheckV1,
  GuardRequestV1,
  OpaqueRef,
  RedactedErrorCategory
} from "./release1-contracts.js";
import { validateProviderHealthSnapshotV1, validateUsageSnapshotV1 } from "./validators.js";

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
