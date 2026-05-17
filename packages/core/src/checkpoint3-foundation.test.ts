import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";
import type { FlowDeskNonDispatchPermissionV1, FlowDeskPolicyPackV1, FlowDeskProjectConfigV1 } from "./index.js";
import {
  createOpenCodeGoUnknownProviderHealthSnapshotV1,
  createOpenCodeGoUnknownUsageSnapshotV1,
  createProviderHealthDiagnosticSnapshotV1,
  createUnknownUsageSnapshotV1,
  createZAiUnknownProviderHealthSnapshotV1,
  createZAiUnknownUsageSnapshotV1,
  evaluateGuardBoundaryV1,
  mergePolicyPacksV1,
  rejectMergedUsageProviderAuthorityV1,
  validateEffectivePolicyV1,
  validateNonDispatchPermissionV1,
  validatePolicyPackV1,
  validateProjectConfigV1,
  validateProviderHealthSnapshotV1,
  validateUsageAndProviderHealthSeparatedV1,
  validateUsageSnapshotV1
} from "./index.js";

const now = "2026-05-17T00:00:00.000Z";

function retention(days = { session: 14, debug: 7, conformance: 30 }) {
  return {
    session_records_max_days: days.session,
    debug_staging_max_days: days.debug,
    conformance_summary_max_days: days.conformance,
    allow_user_longer_retention: false,
    deletion_behavior: "delete_after_expiry" as const
  };
}

function usagePolicy() {
  return {
    usage_freshness_ttl_minutes: 15,
    unknown_usage_dispatchability: "non_dispatchable" as const,
    stale_usage_dispatchability: "non_dispatchable" as const,
    refused_usage_dispatchability: "non_dispatchable" as const,
    shared_limit_suspected_dispatchability: "non_dispatchable" as const,
    fallback_derived_dispatchability: "non_dispatchable" as const,
    allow_local_history_source: false,
    allow_provider_console_scraping: false as const
  };
}

function healthPolicy() {
  return {
    health_freshness_ttl_minutes: 10,
    unavailable_dispatchability: "non_dispatchable" as const,
    degraded_dispatchability: "diagnostic_only" as const,
    opencode_go_usage_without_official_quota: "unknown" as const,
    z_ai_usage_without_official_quota: "unknown" as const,
    allow_automatic_provider_fallback: false as const
  };
}

function projectConfig(): FlowDeskProjectConfigV1 {
  return {
    schema_version: "flowdesk.project_config.v1" as const,
    config_id: "config-123",
    created_at: now,
    updated_at: now,
    release_mode: "release1" as const,
    project_root_ref: "project-root-123",
    config_hash: "config-hash-123",
    policy_pack_refs: ["policy-ref-123"],
    policy_pack_hashes: ["policy-hash-123"],
    chat_intake_mode: "steering" as const,
    hook_harness_mode: "enforce" as const,
    retention: retention(),
    usage_policy: usagePolicy(),
    provider_health_policy: healthPolicy(),
    disabled_modes: ["real_dispatch", "managed_fallback", "lane_launch", "hard_chat_blocking"],
    extension_namespaces: ["flowdesk.project"],
    audit_refs: ["audit-123"]
  };
}

function policyPack(): FlowDeskPolicyPackV1 {
  return {
    schema_version: "flowdesk.policy_pack.v1" as const,
    policy_pack_id: "policy-123",
    policy_pack_hash: "policy-hash-123",
    name: "Starter policy",
    version: "1.0.0",
    source_ref: "policy-source-123",
    applies_to_release_modes: ["release1"] as const,
    priority: 1,
    rules: [
      { rule_id: "rule-ban-123", effect: "deny" as const, target: "provider_family" as const, summary_label: "Hard-ban unsafe provider family.", refs: ["ban-123"] },
      { rule_id: "rule-approval-123", effect: "require_approval" as const, target: "permission_class" as const, summary_label: "Require typed approval for writes.", refs: ["approval-123"] }
    ],
    hard_ban_refs: ["ban-123"],
    retention_override: retention({ session: 7, debug: 3, conformance: 14 }),
    usage_policy_override: { ...usagePolicy(), usage_freshness_ttl_minutes: 5 },
    provider_health_policy_override: { ...healthPolicy(), degraded_dispatchability: "non_dispatchable" as const },
    hook_policy_override: { chat_intake_mode: "steering" as const, hook_harness_mode: "enforce" as const, blocking_chat_intake_enabled: false as const, hard_no_reply_or_cancel_enabled: false as const },
    allowed_extension_namespaces: ["flowdesk.project"],
    redaction_baseline_ref: "redaction-123"
  };
}

function permission(expiresAt = "2026-05-18T00:00:00.000Z", permissionClass: FlowDeskNonDispatchPermissionV1["permission_class"] = "fake_runtime_write"): FlowDeskNonDispatchPermissionV1 {
  return {
    schema_version: "flowdesk.non_dispatch_permission.v1" as const,
    permission_id: "permission-123",
    permission_class: permissionClass,
    workflow_id: "workflow-123",
    scope_ref: "scope-123",
    grant_source: "typed_confirmation" as const,
    created_at: now,
    expires_at: expiresAt,
    config_hash: "config-hash-123",
    policy_pack_hash: "policy-hash-123",
    release_mode: "release1" as const,
    audit_ref: "audit-123"
  };
}

test("config, policy pack, effective policy, and non-dispatch permission validate", () => {
  const config = projectConfig();
  const pack = policyPack();
  assert.equal(validateProjectConfigV1(config, { expectedConfigHash: "config-hash-123" }).ok, true);
  assert.equal(validatePolicyPackV1(pack, { expectedPolicyPackHashes: ["policy-hash-123"] }).ok, true);
  const effective = mergePolicyPacksV1(config, [pack], { effectivePolicyId: "effective-123", computedAt: now, auditRef: "audit-123" });
  assert.equal(validateEffectivePolicyV1(effective, { expectedConfigHash: "config-hash-123", expectedPolicyPackHashes: ["policy-hash-123"] }).ok, true);
  assert.equal(validateNonDispatchPermissionV1(permission(), { expectedConfigHash: "config-hash-123", expectedPolicyPackHashes: ["policy-hash-123"], expectedPermissionClass: "fake_runtime_write", expectedScopeRef: "scope-123", now: Date.parse(now) }).ok, true);
});

test("config and policy validators reject Release 1 escalation paths", () => {
  const config = projectConfig();
  assert.equal(validateProjectConfigV1({ ...config, release_mode: "managed_dispatch_beta" }).ok, false);
  assert.equal(validateProjectConfigV1({ ...config, provider_health_policy: { ...healthPolicy(), allow_automatic_provider_fallback: true } }).ok, false);
  assert.equal(validateProjectConfigV1({ ...config, hook_policy: { hard_no_reply_or_cancel_enabled: true } }).ok, false);
  assert.equal(validateProjectConfigV1({ ...config, usage_policy: { ...usagePolicy(), allow_provider_console_scraping: true } }).ok, false);
  assert.equal(validateProjectConfigV1({ ...config, disabled_modes: ["real_dispatch", "managed_fallback", "hard_chat_blocking"] }).ok, false);
  assert.equal(validateProjectConfigV1({ ...config, extension_namespaces: ["omc.runtime"] }).ok, false);
  assert.equal(validateProjectConfigV1({ ...config, project_root_ref: "/Users/raw/path" }).ok, false);
  assert.equal(validateProjectConfigV1({ ...config, config_hash: "other-hash" }, { expectedConfigHash: "config-hash-123" }).ok, false);

  const pack = policyPack();
  assert.equal(validatePolicyPackV1({ ...pack, source_ref: "omc-policy-import" }).ok, false);
  assert.equal(validatePolicyPackV1({ ...pack, rules: [{ rule_id: "rule-allow-123", effect: "allow", target: "permission_class", summary_label: "Approve execution.", refs: [] }] }).ok, false);
  assert.equal(validatePolicyPackV1({ ...pack, retention_override: retention({ session: 30, debug: 14, conformance: 60 }) }).ok, false);
  assert.equal(validatePolicyPackV1({ ...pack, hook_policy_override: { chat_intake_mode: "steering", hook_harness_mode: "observe", blocking_chat_intake_enabled: false, hard_no_reply_or_cancel_enabled: false } }).ok, false);
  assert.equal(validatePolicyPackV1({ ...pack, hook_policy_override: { chat_intake_mode: "observe_only", hook_harness_mode: "observe", blocking_chat_intake_enabled: false, hard_no_reply_or_cancel_enabled: false } }).ok, false);
  assert.equal(validatePolicyPackV1({ ...pack, hook_policy_override: { chat_intake_mode: "off", hook_harness_mode: "off", blocking_chat_intake_enabled: false, hard_no_reply_or_cancel_enabled: false } }).ok, false);
  assert.equal(validatePolicyPackV1({ ...pack, unexpected: true }).ok, false);
});

test("effective policy enforces non-enforcing hook containment safe disablement", () => {
  const effective = mergePolicyPacksV1(projectConfig(), [policyPack()], { effectivePolicyId: "effective-123", computedAt: now, auditRef: "audit-123" });
  const observeWithoutDisablement = { ...effective, hook_policy: { ...effective.hook_policy, hook_harness_mode: "observe" as const } };
  assert.equal(validateEffectivePolicyV1(observeWithoutDisablement).ok, false);
  const offWithoutDisablement = { ...effective, hook_policy: { ...effective.hook_policy, chat_intake_mode: "off" as const, hook_harness_mode: "off" as const } };
  assert.equal(validateEffectivePolicyV1(offWithoutDisablement).ok, false);
  const offWithSafeDisablement = { ...offWithoutDisablement, disabled_modes: [...effective.disabled_modes, "chat_routed" as const] };
  assert.equal(validateEffectivePolicyV1(offWithSafeDisablement).ok, true);
});

test("merge uses trusted extension namespace registry instead of config self-registration", () => {
  const config = { ...projectConfig(), extension_namespaces: ["evil.project"] };
  assert.equal(validateProjectConfigV1(config).ok, false);
  assert.throws(() => mergePolicyPacksV1(config, [policyPack()], { effectivePolicyId: "effective-123", computedAt: now, auditRef: "audit-123" }));
  assert.doesNotThrow(() => mergePolicyPacksV1(config, [policyPack()], { effectivePolicyId: "effective-123", computedAt: now, auditRef: "audit-123", registeredExtensionNamespaces: ["evil.project", "flowdesk.project"] }));
});

test("Policy Pack merge is monotonic and constraint-only", () => {
  const effective = mergePolicyPacksV1(projectConfig(), [policyPack()], { effectivePolicyId: "effective-123", computedAt: now, auditRef: "audit-123" });
  assert.equal(effective.release_mode, "release1");
  assert.equal(effective.retention.session_records_max_days, 7);
  assert.equal(effective.retention.debug_staging_max_days, 3);
  assert.equal(effective.usage_policy.usage_freshness_ttl_minutes, 5);
  assert.equal(effective.provider_health_policy.degraded_dispatchability, "non_dispatchable");
  assert.ok(effective.disabled_modes.includes("real_dispatch"));
  assert.ok(effective.rules.some((rule) => rule.effect === "require_approval"));
  assert.equal(effective.rules.some((rule) => rule.effect === "allow"), false);
});

test("non-dispatch permissions fail when expired, stale, mismatched, or later-release", () => {
  assert.equal(validateNonDispatchPermissionV1(permission("2026-05-16T00:00:00.000Z"), { now: Date.parse(now) }).ok, false);
  assert.equal(validateNonDispatchPermissionV1({ ...permission(), config_hash: "old-config-hash" }, { expectedConfigHash: "config-hash-123" }).ok, false);
  assert.equal(validateNonDispatchPermissionV1({ ...permission(), policy_pack_hash: "old-policy-hash" }, { expectedPolicyPackHashes: ["policy-hash-123"] }).ok, false);
  assert.equal(validateNonDispatchPermissionV1({ ...permission(), release_mode: "managed_dispatch_beta" }).ok, false);
  assert.equal(validateNonDispatchPermissionV1({ ...permission(), permission_class: "real_dispatch" }).ok, false);
});

test("usage and provider-health helpers fail closed and remain separate", () => {
  for (const flag of ["unknown", "stale", "refused", "shared_limit_suspected", "fallback_derived", "model_generated"] as const) {
    const snapshot = createUnknownUsageSnapshotV1({ snapshotId: `usage-${flag}`, providerFamily: "claude", sourceRef: "source-123", uncertaintyFlags: [flag] });
    assert.equal(validateUsageSnapshotV1(snapshot).ok, true);
    assert.equal(snapshot.dispatchability, "non_dispatchable");
  }
  const health = createProviderHealthDiagnosticSnapshotV1({ snapshotId: "health-123", providerFamily: "claude", observedAt: now, sourceRef: "source-123", availabilityState: "unavailable", failureClass: "provider_unavailable" });
  assert.equal(validateProviderHealthSnapshotV1(health).ok, true);
  assert.notEqual(health.dispatchability, "dispatchable");
  assert.equal(validateUsageAndProviderHealthSeparatedV1(createUnknownUsageSnapshotV1({ snapshotId: "usage-123", providerFamily: "claude", sourceRef: "source-123" }), health).ok, true);
  assert.equal(validateUsageAndProviderHealthSeparatedV1(createUnknownUsageSnapshotV1({ snapshotId: "usage-other-123", providerFamily: "openai", sourceRef: "source-123" }), health).ok, false);
  assert.equal(rejectMergedUsageProviderAuthorityV1({ usage_snapshot_ref: "usage-123", provider_health_snapshot_ref: "health-123" }).ok, true);
  assert.equal(rejectMergedUsageProviderAuthorityV1({ usage_snapshot: { snapshot_id: "usage-123" }, provider_health_snapshot: { snapshot_id: "health-123" } }).ok, false);
  assert.equal(rejectMergedUsageProviderAuthorityV1({ authority: { usage_snapshot: { snapshot_id: "usage-123" }, provider_health_snapshot: { snapshot_id: "health-123" } } }).ok, false);
});

test("OpenCode Go and z.ai helpers report unknown non-dispatchable diagnostics without quota evidence", () => {
  for (const snapshot of [createOpenCodeGoUnknownUsageSnapshotV1("usage-go-123", "source-123"), createZAiUnknownUsageSnapshotV1("usage-zai-123", "source-123")]) {
    assert.equal(validateUsageSnapshotV1(snapshot).ok, true);
    assert.equal(snapshot.freshness, "unknown");
    assert.equal(snapshot.dispatchability, "non_dispatchable");
  }
  for (const health of [createOpenCodeGoUnknownProviderHealthSnapshotV1("health-go-123", "source-123", now), createZAiUnknownProviderHealthSnapshotV1("health-zai-123", "source-123", now)]) {
    assert.equal(validateProviderHealthSnapshotV1(health).ok, true);
    assert.equal(health.availability_state, "unknown");
    assert.notEqual(health.dispatchability, "dispatchable");
  }
});

test("Guard boundary blocks real dispatch and requires non-dispatch audit preconditions", () => {
  const policy = mergePolicyPacksV1(projectConfig(), [policyPack()], { effectivePolicyId: "effective-123", computedAt: now, auditRef: "audit-123" });
  const real = evaluateGuardBoundaryV1({ operation: "real-opencode-dispatch", configHash: "config-hash-123", policy, auditRef: "audit-123", conformanceRef: "conformance-123" });
  assert.equal(real.status, "blocked");
  assert.match(real.redacted_reason, /blocks real OpenCode dispatch/);
  const missingPermission = evaluateGuardBoundaryV1({ operation: "fake-runtime", configHash: "config-hash-123", workflowId: "workflow-123", scopeRef: "scope-123", policy, auditRef: "audit-123", runtimeCapabilityRef: "runtime-123" });
  assert.equal(missingPermission.status, "blocked");
  const missingAudit = evaluateGuardBoundaryV1({ operation: "fake-runtime", configHash: "config-hash-123", workflowId: "workflow-123", scopeRef: "scope-123", policy, runtimeCapabilityRef: "runtime-123", nonDispatchPermission: permission(), now: Date.parse(now) });
  assert.equal(missingAudit.status, "blocked");
  const missingRuntime = evaluateGuardBoundaryV1({ operation: "fake-runtime", configHash: "config-hash-123", workflowId: "workflow-123", scopeRef: "scope-123", policy, auditRef: "audit-123", nonDispatchPermission: permission(), now: Date.parse(now) });
  assert.equal(missingRuntime.status, "blocked");
  const dryRunPermission = permission("2026-05-18T00:00:00.000Z", "audit_write");
  const dryRunMissingPermission = evaluateGuardBoundaryV1({ operation: "guarded-dry-run", configHash: "config-hash-123", workflowId: "workflow-123", scopeRef: "scope-123", policy, auditRef: "audit-123", runtimeCapabilityRef: "runtime-123" });
  assert.equal(dryRunMissingPermission.status, "blocked");
  const dryRunMissingAudit = evaluateGuardBoundaryV1({ operation: "guarded-dry-run", configHash: "config-hash-123", workflowId: "workflow-123", scopeRef: "scope-123", policy, runtimeCapabilityRef: "runtime-123", nonDispatchPermission: dryRunPermission, now: Date.parse(now) });
  assert.equal(dryRunMissingAudit.status, "blocked");
  const dryRunMissingRuntime = evaluateGuardBoundaryV1({ operation: "guarded-dry-run", configHash: "config-hash-123", workflowId: "workflow-123", scopeRef: "scope-123", policy, auditRef: "audit-123", nonDispatchPermission: dryRunPermission, now: Date.parse(now) });
  assert.equal(dryRunMissingRuntime.status, "blocked");
  const dryRunEligible = evaluateGuardBoundaryV1({ operation: "guarded-dry-run", configHash: "config-hash-123", workflowId: "workflow-123", scopeRef: "scope-123", policy, auditRef: "audit-123", runtimeCapabilityRef: "runtime-123", nonDispatchPermission: dryRunPermission, now: Date.parse(now) });
  assert.equal(dryRunEligible.status, "eligible");
  const dryRunStateWriteOnly = evaluateGuardBoundaryV1({ operation: "guarded-dry-run", configHash: "config-hash-123", workflowId: "workflow-123", scopeRef: "scope-123", policy, auditRef: "audit-123", runtimeCapabilityRef: "runtime-123", nonDispatchPermission: permission("2026-05-18T00:00:00.000Z", "state_write"), now: Date.parse(now) });
  assert.equal(dryRunStateWriteOnly.status, "blocked");
  const eligible = evaluateGuardBoundaryV1({ operation: "fake-runtime", configHash: "config-hash-123", workflowId: "workflow-123", scopeRef: "scope-123", policy, auditRef: "audit-123", runtimeCapabilityRef: "runtime-123", nonDispatchPermission: permission(), now: Date.parse(now) });
  assert.equal(eligible.status, "eligible");
});

test("Guard boundary binds non-dispatch permissions to workflow scope audit and source", () => {
  const policy = mergePolicyPacksV1(projectConfig(), [policyPack()], { effectivePolicyId: "effective-123", computedAt: now, auditRef: "audit-123" });
  const base = { operation: "fake-runtime" as const, configHash: "config-hash-123", workflowId: "workflow-123", scopeRef: "scope-123", policy, auditRef: "audit-123", runtimeCapabilityRef: "runtime-123", now: Date.parse(now) };
  assert.equal(evaluateGuardBoundaryV1({ ...base, nonDispatchPermission: { ...permission(), scope_ref: "wrong-scope" } }).status, "blocked");
  assert.equal(evaluateGuardBoundaryV1({ ...base, nonDispatchPermission: { ...permission(), workflow_id: "workflow-other" } }).status, "blocked");
  const { workflow_id: _workflowId, ...missingWorkflow } = permission();
  assert.equal(evaluateGuardBoundaryV1({ ...base, nonDispatchPermission: missingWorkflow }).status, "blocked");
  const { audit_ref: _auditRef, ...missingAuditRef } = permission();
  assert.equal(evaluateGuardBoundaryV1({ ...base, nonDispatchPermission: missingAuditRef }).status, "blocked");
  assert.equal(evaluateGuardBoundaryV1({ ...base, nonDispatchPermission: { ...permission(), audit_ref: "audit-other" } }).status, "blocked");
  assert.equal(evaluateGuardBoundaryV1({ ...base, nonDispatchPermission: { ...permission(), grant_source: "policy_pack" } }).status, "blocked");
  assert.equal(evaluateGuardBoundaryV1({ ...base, nonDispatchPermission: permission() }).status, "eligible");
});

test("core source does not introduce OMO/OMC dependencies, subprocess dispatch, or plugin registration", () => {
  const sourceDir = new URL(".", import.meta.url);
  const sourceText = readdirSync(sourceDir)
    .filter((name) => name.endsWith(".ts") && !name.endsWith(".test.ts"))
    .map((name) => readFileSync(join(sourceDir.pathname, name), "utf8"))
    .join("\n");
  assert.doesNotMatch(sourceText, /from ["'](?:child_process|node:child_process)["']/);
  assert.doesNotMatch(sourceText, /\b(?:spawn|exec|execFile)\s*\(/);
  assert.doesNotMatch(sourceText, /opencode\s+run/);
  assert.doesNotMatch(sourceText, /@oh-my-claudecode|oh-my-claudecode|omo\/|omc\//i);
  assert.doesNotMatch(sourceText, /productionToolRegistration\s*:\s*["']enabled["']/);
});
