import type {
  DisabledModeV1,
  FlowDeskEffectivePolicyV1,
  FlowDeskHookPolicyV1,
  FlowDeskNonDispatchPermissionV1,
  FlowDeskPolicyPackV1,
  FlowDeskPolicyRuleV1,
  FlowDeskProjectConfigV1,
  FlowDeskProviderHealthPolicyV1,
  FlowDeskRetentionPolicyV1,
  FlowDeskUsagePolicyV1,
  HookHarnessModeV1
} from "./release1-contracts.js";
import {
  CHAT_INTAKE_MODES,
  DISABLED_MODES,
  HOOK_HARNESS_MODES,
  NON_DISPATCH_PERMISSION_CLASSES,
  POLICY_EFFECTS,
  POLICY_RULE_TARGETS,
  RELEASE_MODES
} from "./release1-contracts.js";
import {
  invalid,
  type ValidationResult,
  valid,
  validateNoForbiddenRawPayloads,
  validateOpaqueId,
  validateOpaqueRef,
  validateSchemaArtifactValue
} from "./validators.js";

export interface ConfigPolicyValidationOptions {
  expectedConfigHash?: string;
  expectedPolicyPackHashes?: readonly string[];
  registeredExtensionNamespaces?: readonly string[];
  now?: number;
  expectedWorkflowId?: string;
  expectedScopeRef?: string;
  expectedAuditRef?: string;
  expectedPermissionClass?: FlowDeskNonDispatchPermissionV1["permission_class"];
  requireWorkflowId?: boolean;
  requireAuditRef?: boolean;
  forbiddenGrantSources?: readonly FlowDeskNonDispatchPermissionV1["grant_source"][];
}

export interface MergePolicyPackOptions {
  effectivePolicyId: string;
  computedAt: string;
  auditRef: string;
  registeredExtensionNamespaces?: readonly string[];
}

const DEFAULT_REGISTERED_EXTENSION_NAMESPACES = ["flowdesk.core", "flowdesk.project"] as const;
const DEFAULT_DISABLED_RELEASE1_MODES: readonly DisabledModeV1[] = ["real_dispatch", "managed_fallback", "lane_launch", "hard_chat_blocking"];
const SAFE_HOOK_POLICY: FlowDeskHookPolicyV1 = {
  chat_intake_mode: "steering",
  hook_harness_mode: "enforce",
  blocking_chat_intake_enabled: false,
  hard_no_reply_or_cancel_enabled: false
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function combine(results: ValidationResult[]): ValidationResult {
  const errors = results.flatMap((result) => result.errors);
  return errors.length === 0 ? valid() : invalid(...errors);
}

function rejectUnknownProperties(value: Record<string, unknown>, allowed: readonly string[], label: string): ValidationResult {
  const unknown = Object.keys(value).filter((key) => !allowed.includes(key));
  return unknown.length === 0 ? valid() : invalid(`${label} unknown properties: ${unknown.join(",")}`);
}

function isEnumValue(value: unknown, allowed: readonly string[]): boolean {
  return typeof value === "string" && allowed.includes(value);
}

function validateTimestamp(value: unknown, label: string): ValidationResult {
  return typeof value === "string" && Number.isFinite(Date.parse(value)) ? valid() : invalid(`${label} must be a timestamp`);
}

function validateHash(value: unknown, label: string): ValidationResult {
  if (typeof value !== "string" || value.length < 3 || value.length > 128) return invalid(`${label} must be a bounded hash`);
  if (!/^[A-Za-z0-9][A-Za-z0-9_.:-]*$/.test(value)) return invalid(`${label} is not schema-safe`);
  return validateNoForbiddenRawPayloads(value, label);
}

function validateNoLegacyPolicyImport(value: unknown, label: string): ValidationResult {
  return typeof value === "string" && /\b(omo|omc|dex|conductor|external-policy|policy-import)\b/i.test(value) ? invalid(`${label} imports legacy or arbitrary external policy`) : valid();
}

function validateHashArray(value: unknown, label: string): ValidationResult {
  if (!Array.isArray(value)) return invalid(`${label} must be an array`);
  return combine(value.map((item, index) => validateHash(item, `${label}[${index}]`)));
}

function validateRefArray(value: unknown, label: string): ValidationResult {
  if (!Array.isArray(value)) return invalid(`${label} must be an array`);
  return combine(value.map((item, index) => validateOpaqueRef(item, `${label}[${index}]`)));
}

function validateDisabledModes(value: unknown, label: string): ValidationResult {
  if (!Array.isArray(value)) return invalid(`${label} must be an array`);
  return combine(value.map((item, index) => (isEnumValue(item, DISABLED_MODES) ? valid() : invalid(`${label}[${index}] is invalid`))));
}

function validateExtensionNamespaces(value: unknown, options?: ConfigPolicyValidationOptions): ValidationResult {
  if (!Array.isArray(value)) return invalid("extension_namespaces must be an array");
  const registered = new Set(options?.registeredExtensionNamespaces ?? DEFAULT_REGISTERED_EXTENSION_NAMESPACES);
  const errors: string[] = [];
  value.forEach((item, index) => {
    if (typeof item !== "string" || !/^[a-z][a-z0-9]*(\.[a-z][a-z0-9]*)+$/.test(item)) errors.push(`extension_namespaces[${index}] is not schema-safe`);
    if (typeof item === "string" && /\b(omo|omc|dex|conductor)\b/i.test(item)) errors.push(`extension_namespaces[${index}] imports a legacy namespace`);
    if (typeof item === "string" && !registered.has(item)) errors.push(`extension_namespaces[${index}] is not registered`);
  });
  return errors.length === 0 ? valid() : invalid(...errors);
}

function validateRetentionPolicy(value: unknown, label = "retention", allowLongerExplicitConfig = false): ValidationResult {
  if (!isRecord(value)) return invalid(`${label} must be an object`);
  const session = value.session_records_max_days;
  const debug = value.debug_staging_max_days;
  const conformance = value.conformance_summary_max_days;
  const allowLonger = value.allow_user_longer_retention === true;
  return combine([
    rejectUnknownProperties(value, ["session_records_max_days", "debug_staging_max_days", "conformance_summary_max_days", "allow_user_longer_retention", "deletion_behavior"], label),
    typeof session === "number" && session >= 0 ? valid() : invalid(`${label}.session_records_max_days is invalid`),
    typeof debug === "number" && debug >= 0 ? valid() : invalid(`${label}.debug_staging_max_days is invalid`),
    typeof conformance === "number" && conformance >= 0 ? valid() : invalid(`${label}.conformance_summary_max_days is invalid`),
    typeof value.allow_user_longer_retention === "boolean" ? valid() : invalid(`${label}.allow_user_longer_retention must be boolean`),
    isEnumValue(value.deletion_behavior, ["delete_after_expiry", "keep_until_policy_expiry", "manual_cleanup_only"]) ? valid() : invalid(`${label}.deletion_behavior is invalid`),
    !allowLonger && ((session as number) > 14 || (debug as number) > 7 || (conformance as number) > 30) ? invalid(`${label} exceeds Release 1 default retention without explicit user config`) : valid(),
    allowLonger && !allowLongerExplicitConfig ? invalid(`${label} cannot lengthen retention from Policy Pack`) : valid()
  ]);
}

function validateUsagePolicy(value: unknown, label = "usage_policy"): ValidationResult {
  if (!isRecord(value)) return invalid(`${label} must be an object`);
  return combine([
    rejectUnknownProperties(value, ["usage_freshness_ttl_minutes", "unknown_usage_dispatchability", "stale_usage_dispatchability", "refused_usage_dispatchability", "shared_limit_suspected_dispatchability", "fallback_derived_dispatchability", "allow_local_history_source", "allow_provider_console_scraping"], label),
    typeof value.usage_freshness_ttl_minutes === "number" && value.usage_freshness_ttl_minutes >= 0 ? valid() : invalid(`${label}.usage_freshness_ttl_minutes is invalid`),
    value.unknown_usage_dispatchability === "non_dispatchable" ? valid() : invalid(`${label}.unknown_usage_dispatchability must fail closed`),
    value.stale_usage_dispatchability === "non_dispatchable" ? valid() : invalid(`${label}.stale_usage_dispatchability must fail closed`),
    value.refused_usage_dispatchability === "non_dispatchable" ? valid() : invalid(`${label}.refused_usage_dispatchability must fail closed`),
    value.shared_limit_suspected_dispatchability === "non_dispatchable" ? valid() : invalid(`${label}.shared_limit_suspected_dispatchability must fail closed`),
    value.fallback_derived_dispatchability === "non_dispatchable" ? valid() : invalid(`${label}.fallback_derived_dispatchability must fail closed`),
    typeof value.allow_local_history_source === "boolean" ? valid() : invalid(`${label}.allow_local_history_source must be boolean`),
    value.allow_provider_console_scraping === false ? valid() : invalid(`${label}.allow_provider_console_scraping must be false`)
  ]);
}

function validateProviderHealthPolicy(value: unknown, label = "provider_health_policy"): ValidationResult {
  if (!isRecord(value)) return invalid(`${label} must be an object`);
  return combine([
    rejectUnknownProperties(value, ["health_freshness_ttl_minutes", "unavailable_dispatchability", "degraded_dispatchability", "opencode_go_usage_without_official_quota", "z_ai_usage_without_official_quota", "allow_automatic_provider_fallback"], label),
    typeof value.health_freshness_ttl_minutes === "number" && value.health_freshness_ttl_minutes >= 0 ? valid() : invalid(`${label}.health_freshness_ttl_minutes is invalid`),
    value.unavailable_dispatchability === "non_dispatchable" ? valid() : invalid(`${label}.unavailable_dispatchability must fail closed`),
    isEnumValue(value.degraded_dispatchability, ["diagnostic_only", "non_dispatchable"]) ? valid() : invalid(`${label}.degraded_dispatchability is invalid`),
    value.opencode_go_usage_without_official_quota === "unknown" ? valid() : invalid(`${label}.opencode_go_usage_without_official_quota must be unknown`),
    value.z_ai_usage_without_official_quota === "unknown" ? valid() : invalid(`${label}.z_ai_usage_without_official_quota must be unknown`),
    value.allow_automatic_provider_fallback === false ? valid() : invalid(`${label}.allow_automatic_provider_fallback must be false`)
  ]);
}

function validateHookPolicy(value: unknown, label = "hook_policy"): ValidationResult {
  if (!isRecord(value)) return invalid(`${label} must be an object`);
  return combine([
    rejectUnknownProperties(value, ["chat_intake_mode", "hook_harness_mode", "blocking_chat_intake_enabled", "hard_no_reply_or_cancel_enabled"], label),
    isEnumValue(value.chat_intake_mode, CHAT_INTAKE_MODES) ? valid() : invalid(`${label}.chat_intake_mode is invalid`),
    isEnumValue(value.hook_harness_mode, HOOK_HARNESS_MODES) ? valid() : invalid(`${label}.hook_harness_mode is invalid`),
    value.blocking_chat_intake_enabled === false ? valid() : invalid(`${label}.blocking_chat_intake_enabled must be false`),
    value.hard_no_reply_or_cancel_enabled === false ? valid() : invalid(`${label}.hard_no_reply_or_cancel_enabled must be false`)
  ]);
}

function validatePolicyRule(value: unknown, label: string): ValidationResult {
  if (!isRecord(value)) return invalid(`${label} must be an object`);
  return combine([
    rejectUnknownProperties(value, ["rule_id", "effect", "target", "summary_label", "refs"], label),
    validateOpaqueId(value.rule_id, `${label}.rule_id`),
    isEnumValue(value.effect, POLICY_EFFECTS) ? valid() : invalid(`${label}.effect is invalid`),
    isEnumValue(value.target, POLICY_RULE_TARGETS) ? valid() : invalid(`${label}.target is invalid`),
    value.effect === "allow" ? invalid(`${label}.effect cannot grant authority in Release 1`) : valid(),
    typeof value.summary_label === "string" && value.summary_label.length > 0 && value.summary_label.length <= 160 ? validateNoForbiddenRawPayloads(value.summary_label, `${label}.summary_label`) : invalid(`${label}.summary_label is invalid`),
    validateRefArray(value.refs, `${label}.refs`)
  ]);
}

function validatePolicyRules(value: unknown): ValidationResult {
  if (!Array.isArray(value)) return invalid("rules must be an array");
  return combine(value.map((rule, index) => validatePolicyRule(rule, `rules[${index}]`)));
}

function validateModeSafety(disabledModes: unknown, hookHarnessMode?: unknown): ValidationResult {
  const modes = new Set(Array.isArray(disabledModes) ? disabledModes : []);
  const errors: string[] = [];
  for (const mode of DEFAULT_DISABLED_RELEASE1_MODES) {
    if (!modes.has(mode)) errors.push(`Release 1 must disable ${mode}`);
  }
  if ((hookHarnessMode === "off" || hookHarnessMode === "observe") && !modes.has("chat_routed")) errors.push("non-enforcing hook harness cannot leave chat_routed managed behavior enabled");
  return errors.length === 0 ? valid() : invalid(...errors);
}

export function validateProjectConfigV1(value: unknown, options?: ConfigPolicyValidationOptions): ValidationResult {
  if (!isRecord(value)) return invalid("project config must be an object");
  return combine([
    validateSchemaArtifactValue("flowdesk.project_config.v1", value),
    validateOpaqueId(value.config_id, "config_id"),
    validateTimestamp(value.created_at, "created_at"),
    validateTimestamp(value.updated_at, "updated_at"),
    value.release_mode === "release1" ? valid() : invalid("project config release_mode must be release1"),
    validateOpaqueRef(value.project_root_ref, "project_root_ref"),
    validateHash(value.config_hash, "config_hash"),
    options?.expectedConfigHash !== undefined && value.config_hash !== options.expectedConfigHash ? invalid("config_hash mismatch") : valid(),
    validateRefArray(value.policy_pack_refs, "policy_pack_refs"),
    validateHashArray(value.policy_pack_hashes, "policy_pack_hashes"),
    isEnumValue(value.chat_intake_mode, CHAT_INTAKE_MODES) ? valid() : invalid("chat_intake_mode is invalid"),
    isEnumValue(value.hook_harness_mode, HOOK_HARNESS_MODES) ? valid() : invalid("hook_harness_mode is invalid"),
    validateRetentionPolicy(value.retention, "retention", true),
    validateUsagePolicy(value.usage_policy),
    validateProviderHealthPolicy(value.provider_health_policy),
    validateDisabledModes(value.disabled_modes, "disabled_modes"),
    validateModeSafety(value.disabled_modes, value.hook_harness_mode),
    validateExtensionNamespaces(value.extension_namespaces, options),
    validateRefArray(value.audit_refs, "audit_refs")
  ]);
}

export function assertProjectConfigV1(value: unknown, options?: ConfigPolicyValidationOptions): asserts value is FlowDeskProjectConfigV1 {
  const result = validateProjectConfigV1(value, options);
  if (!result.ok) throw new Error(result.errors.join("; "));
}

export function validatePolicyPackV1(value: unknown, options?: ConfigPolicyValidationOptions): ValidationResult {
  if (!isRecord(value)) return invalid("policy pack must be an object");
  const appliesTo = Array.isArray(value.applies_to_release_modes) ? value.applies_to_release_modes : [];
  return combine([
    validateSchemaArtifactValue("flowdesk.policy_pack.v1", value),
    validateOpaqueId(value.policy_pack_id, "policy_pack_id"),
    validateHash(value.policy_pack_hash, "policy_pack_hash"),
    options?.expectedPolicyPackHashes !== undefined && !options.expectedPolicyPackHashes.includes(String(value.policy_pack_hash)) ? invalid("policy_pack_hash mismatch") : valid(),
    typeof value.name === "string" && value.name.length > 0 && value.name.length <= 128 ? validateNoForbiddenRawPayloads(value.name, "name") : invalid("name is invalid"),
    typeof value.version === "string" && value.version.length > 0 && value.version.length <= 64 ? validateNoForbiddenRawPayloads(value.version, "version") : invalid("version is invalid"),
    validateOpaqueRef(value.source_ref, "source_ref"),
    validateNoLegacyPolicyImport(value.source_ref, "source_ref"),
    Array.isArray(value.applies_to_release_modes) ? combine(value.applies_to_release_modes.map((mode, index) => (isEnumValue(mode, RELEASE_MODES) ? valid() : invalid(`applies_to_release_modes[${index}] is invalid`)))) : invalid("applies_to_release_modes must be an array"),
    appliesTo.includes("release1") ? valid() : invalid("policy pack must include release1 compatibility to affect Release 1"),
    typeof value.priority === "number" ? valid() : invalid("priority is invalid"),
    validatePolicyRules(value.rules),
    validateRefArray(value.hard_ban_refs, "hard_ban_refs"),
    value.retention_override === undefined ? valid() : validateRetentionPolicy(value.retention_override, "retention_override", false),
    value.usage_policy_override === undefined ? valid() : validateUsagePolicy(value.usage_policy_override, "usage_policy_override"),
    value.provider_health_policy_override === undefined ? valid() : validateProviderHealthPolicy(value.provider_health_policy_override, "provider_health_policy_override"),
    value.hook_policy_override === undefined ? valid() : validateHookPolicy(value.hook_policy_override, "hook_policy_override"),
    isRecord(value.hook_policy_override) && value.hook_policy_override.hook_harness_mode !== "enforce" ? invalid("hook_policy_override cannot weaken hook containment from enforce") : valid(),
    validateExtensionNamespaces(value.allowed_extension_namespaces, options),
    validateOpaqueRef(value.redaction_baseline_ref, "redaction_baseline_ref")
  ]);
}

export function assertPolicyPackV1(value: unknown, options?: ConfigPolicyValidationOptions): asserts value is FlowDeskPolicyPackV1 {
  const result = validatePolicyPackV1(value, options);
  if (!result.ok) throw new Error(result.errors.join("; "));
}

export function validateEffectivePolicyV1(value: unknown, options?: ConfigPolicyValidationOptions): ValidationResult {
  if (!isRecord(value)) return invalid("effective policy must be an object");
  return combine([
    validateSchemaArtifactValue("flowdesk.effective_policy.v1", value),
    validateOpaqueId(value.effective_policy_id, "effective_policy_id"),
    validateHash(value.config_hash, "config_hash"),
    options?.expectedConfigHash !== undefined && value.config_hash !== options.expectedConfigHash ? invalid("config_hash mismatch") : valid(),
    validateHashArray(value.policy_pack_hashes, "policy_pack_hashes"),
    options?.expectedPolicyPackHashes !== undefined && JSON.stringify(value.policy_pack_hashes) !== JSON.stringify([...options.expectedPolicyPackHashes]) ? invalid("policy_pack_hashes mismatch") : valid(),
    validateTimestamp(value.computed_at, "computed_at"),
    value.release_mode === "release1" ? valid() : invalid("effective policy release_mode must be release1"),
    validateDisabledModes(value.disabled_modes, "disabled_modes"),
    validateModeSafety(value.disabled_modes, isRecord(value.hook_policy) ? value.hook_policy.hook_harness_mode : undefined),
    validateRetentionPolicy(value.retention, "retention", true),
    validateUsagePolicy(value.usage_policy),
    validateProviderHealthPolicy(value.provider_health_policy),
    validateHookPolicy(value.hook_policy),
    validatePolicyRules(value.rules),
    validateOpaqueRef(value.audit_ref, "audit_ref")
  ]);
}

export function assertEffectivePolicyV1(value: unknown, options?: ConfigPolicyValidationOptions): asserts value is FlowDeskEffectivePolicyV1 {
  const result = validateEffectivePolicyV1(value, options);
  if (!result.ok) throw new Error(result.errors.join("; "));
}

export function validateNonDispatchPermissionV1(value: unknown, options?: ConfigPolicyValidationOptions): ValidationResult {
  if (!isRecord(value)) return invalid("non-dispatch permission must be an object");
  const expiresAt = typeof value.expires_at === "string" ? Date.parse(value.expires_at) : Number.NaN;
  return combine([
    validateSchemaArtifactValue("flowdesk.non_dispatch_permission.v1", value),
    validateOpaqueId(value.permission_id, "permission_id"),
    isEnumValue(value.permission_class, NON_DISPATCH_PERMISSION_CLASSES) ? valid() : invalid("permission_class is invalid"),
    options?.expectedPermissionClass !== undefined && value.permission_class !== options.expectedPermissionClass ? invalid("permission_class mismatch") : valid(),
    value.workflow_id === undefined ? valid() : validateOpaqueId(value.workflow_id, "workflow_id"),
    options?.requireWorkflowId === true && value.workflow_id === undefined ? invalid("workflow_id is required for scoped non-dispatch permission") : valid(),
    options?.expectedWorkflowId !== undefined && value.workflow_id !== options.expectedWorkflowId ? invalid("workflow_id mismatch") : valid(),
    validateOpaqueRef(value.scope_ref, "scope_ref"),
    options?.expectedScopeRef !== undefined && value.scope_ref !== options.expectedScopeRef ? invalid("scope_ref mismatch") : valid(),
    isEnumValue(value.grant_source, ["bootstrap", "guard_rule", "typed_confirmation", "policy_pack"]) ? valid() : invalid("grant_source is invalid"),
    options?.forbiddenGrantSources?.includes(value.grant_source as FlowDeskNonDispatchPermissionV1["grant_source"]) === true ? invalid("grant_source is not allowed for this Guard boundary") : valid(),
    validateTimestamp(value.created_at, "created_at"),
    validateTimestamp(value.expires_at, "expires_at"),
    options?.now !== undefined && Number.isFinite(expiresAt) && expiresAt <= options.now ? invalid("non-dispatch permission is expired") : valid(),
    validateHash(value.config_hash, "config_hash"),
    options?.expectedConfigHash !== undefined && value.config_hash !== options.expectedConfigHash ? invalid("config_hash mismatch") : valid(),
    validateHash(value.policy_pack_hash, "policy_pack_hash"),
    options?.expectedPolicyPackHashes !== undefined && !options.expectedPolicyPackHashes.includes(String(value.policy_pack_hash)) ? invalid("policy_pack_hash mismatch") : valid(),
    value.release_mode === "release1" ? valid() : invalid("non-dispatch permission release_mode must be release1 for Release 1 use"),
    options?.requireAuditRef === true && value.audit_ref === undefined ? invalid("audit_ref is required for scoped non-dispatch permission") : valid(),
    value.audit_ref === undefined ? valid() : validateOpaqueRef(value.audit_ref, "audit_ref"),
    options?.expectedAuditRef !== undefined && value.audit_ref !== options.expectedAuditRef ? invalid("audit_ref mismatch") : valid()
  ]);
}

export function assertNonDispatchPermissionV1(value: unknown, options?: ConfigPolicyValidationOptions): asserts value is FlowDeskNonDispatchPermissionV1 {
  const result = validateNonDispatchPermissionV1(value, options);
  if (!result.ok) throw new Error(result.errors.join("; "));
}

function shortestRetention(base: FlowDeskRetentionPolicyV1, override?: FlowDeskRetentionPolicyV1): FlowDeskRetentionPolicyV1 {
  if (override === undefined) return { ...base };
  return {
    session_records_max_days: Math.min(base.session_records_max_days, override.session_records_max_days),
    debug_staging_max_days: Math.min(base.debug_staging_max_days, override.debug_staging_max_days),
    conformance_summary_max_days: Math.min(base.conformance_summary_max_days, override.conformance_summary_max_days),
    allow_user_longer_retention: base.allow_user_longer_retention && override.allow_user_longer_retention,
    deletion_behavior: base.deletion_behavior === "delete_after_expiry" || override.deletion_behavior === "delete_after_expiry" ? "delete_after_expiry" : override.deletion_behavior
  };
}

function narrowUsagePolicy(base: FlowDeskUsagePolicyV1, override?: FlowDeskUsagePolicyV1): FlowDeskUsagePolicyV1 {
  return override === undefined ? { ...base } : { ...base, usage_freshness_ttl_minutes: Math.min(base.usage_freshness_ttl_minutes, override.usage_freshness_ttl_minutes), allow_local_history_source: base.allow_local_history_source && override.allow_local_history_source };
}

function narrowHealthPolicy(base: FlowDeskProviderHealthPolicyV1, override?: FlowDeskProviderHealthPolicyV1): FlowDeskProviderHealthPolicyV1 {
  return override === undefined ? { ...base } : { ...base, health_freshness_ttl_minutes: Math.min(base.health_freshness_ttl_minutes, override.health_freshness_ttl_minutes), degraded_dispatchability: base.degraded_dispatchability === "non_dispatchable" || override.degraded_dispatchability === "non_dispatchable" ? "non_dispatchable" : "diagnostic_only" };
}

function narrowHookPolicy(base: FlowDeskHookPolicyV1, override?: FlowDeskHookPolicyV1): FlowDeskHookPolicyV1 {
  if (override === undefined) return { ...base };
  const hookOrder: Record<HookHarnessModeV1, number> = { enforce: 0, observe: 1, off: 2 };
  const hook_harness_mode = hookOrder[override.hook_harness_mode] > hookOrder[base.hook_harness_mode] ? override.hook_harness_mode : base.hook_harness_mode;
  return { ...base, chat_intake_mode: override.chat_intake_mode === "off" ? "off" : base.chat_intake_mode, hook_harness_mode, blocking_chat_intake_enabled: false, hard_no_reply_or_cancel_enabled: false };
}

export function mergePolicyPacksV1(config: FlowDeskProjectConfigV1, policyPacks: readonly FlowDeskPolicyPackV1[], options: MergePolicyPackOptions): FlowDeskEffectivePolicyV1 {
  const extensionRegistry = options.registeredExtensionNamespaces ?? DEFAULT_REGISTERED_EXTENSION_NAMESPACES;
  assertProjectConfigV1(config, { expectedConfigHash: config.config_hash, registeredExtensionNamespaces: extensionRegistry });
  for (const pack of policyPacks) assertPolicyPackV1(pack, { registeredExtensionNamespaces: extensionRegistry });
  const disabledModes = new Set<DisabledModeV1>([...DEFAULT_DISABLED_RELEASE1_MODES, ...config.disabled_modes]);
  let retention = { ...config.retention };
  let usagePolicy = { ...config.usage_policy };
  let providerHealthPolicy = { ...config.provider_health_policy };
  let hookPolicy: FlowDeskHookPolicyV1 = { ...SAFE_HOOK_POLICY, chat_intake_mode: config.chat_intake_mode, hook_harness_mode: config.hook_harness_mode };
  const rules: FlowDeskPolicyRuleV1[] = [];
  for (const pack of [...policyPacks].sort((a, b) => a.priority - b.priority)) {
    retention = shortestRetention(retention, pack.retention_override);
    usagePolicy = narrowUsagePolicy(usagePolicy, pack.usage_policy_override);
    providerHealthPolicy = narrowHealthPolicy(providerHealthPolicy, pack.provider_health_policy_override);
    hookPolicy = narrowHookPolicy(hookPolicy, pack.hook_policy_override);
    for (const rule of pack.rules) {
      rules.push({ ...rule, refs: [...rule.refs] });
      if (rule.effect === "disable_mode" && isEnumValue(rule.target, ["release_mode", "tool", "provider_family", "agent_profile", "extension"])) disabledModes.add("workflow_optimization");
      if (rule.effect === "require_approval") disabledModes.add("real_dispatch");
    }
  }
  return {
    schema_version: "flowdesk.effective_policy.v1",
    effective_policy_id: options.effectivePolicyId,
    config_hash: config.config_hash,
    policy_pack_hashes: policyPacks.map((pack) => pack.policy_pack_hash),
    computed_at: options.computedAt,
    release_mode: "release1",
    disabled_modes: [...disabledModes],
    retention,
    usage_policy: usagePolicy,
    provider_health_policy: providerHealthPolicy,
    hook_policy: hookPolicy,
    rules,
    audit_ref: options.auditRef
  };
}
