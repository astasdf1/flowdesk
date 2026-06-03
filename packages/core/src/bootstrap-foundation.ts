import { mkdirSync, renameSync, writeFileSync } from "node:fs";
import { dirname, resolve, sep } from "node:path";
import type {
  BootstrapPhaseV1,
  DisabledModeV1,
  DoctorFailureCategoryOutcomeV1,
  DoctorFailureCategoryV1,
  FlowDeskBootstrapBackupManifestV1,
  FlowDeskBootstrapInstallPlanV1,
  FlowDeskBootstrapReportV1,
  FlowDeskBootstrapRollbackPlanV1,
  FlowDeskBootstrapRollbackResultV1,
  FlowDeskCommandGenerationSummaryV1,
  FlowDeskConfigScaffoldSummaryV1,
  FlowDeskDoctorHandoffV1,
  FlowDeskDoctorReportV1,
  FlowDeskOmoCleanupSummaryV1,
  FlowDeskProfileMutationSummaryV1,
  OpaqueRef,
  SafeNextAction
} from "./release1-contracts.js";
import { BOOTSTRAP_FAILURE_CLASSES, BOOTSTRAP_MUTATION_STATUSES, BOOTSTRAP_PHASES, DISABLED_MODES, DOCTOR_FAILURE_CATEGORIES } from "./release1-contracts.js";
import { validateFlowDeskRelativeStatePath } from "./state-paths.js";
import { invalid, type ValidationResult, valid, validateNoForbiddenRawPayloads, validateOpaqueId, validateOpaqueRef, validateSchemaArtifactValue } from "./validators.js";

export type FlowDeskBootstrapArtifactV1 =
  | FlowDeskBootstrapInstallPlanV1
  | FlowDeskBootstrapBackupManifestV1
  | FlowDeskProfileMutationSummaryV1
  | FlowDeskOmoCleanupSummaryV1
  | FlowDeskCommandGenerationSummaryV1
  | FlowDeskConfigScaffoldSummaryV1
  | FlowDeskBootstrapRollbackPlanV1
  | FlowDeskBootstrapRollbackResultV1
  | FlowDeskBootstrapReportV1
  | FlowDeskDoctorHandoffV1
  | FlowDeskDoctorReportV1;

export type FlowDeskBootstrapSchemaIdV1 = FlowDeskBootstrapArtifactV1["schema_version"];

export interface FlowDeskBootstrapWriteIntent<TRecord = FlowDeskBootstrapArtifactV1> {
  operation: "write_json";
  path: string;
  schemaId: FlowDeskBootstrapSchemaIdV1;
  authority: "redacted_bootstrap_artifact";
  record: TRecord;
  serialization: "json";
  fsSafety: "validated_relative_flowdesk_path_only";
  atomicity: {
    strategy: "temp_then_rename_intent";
    tempPath: string;
  };
}

export interface FlowDeskBootstrapPrepareResult<TRecord = FlowDeskBootstrapArtifactV1> extends ValidationResult {
  record?: TRecord;
  writeIntent?: FlowDeskBootstrapWriteIntent<TRecord>;
}

export interface FlowDeskBootstrapDurableApplyResult extends ValidationResult {
  rootDir?: string;
  writtenPaths?: string[];
  bootstrapAuthority: "redacted_bootstrap_artifact";
  productionRegistrationEligible: false;
  dispatchApprovalEligible: false;
  realOpenCodeDispatch: false;
  actualLaneLaunch: false;
  providerCall: false;
  runtimeExecution: false;
}

export interface FlowDeskBootstrapTypedConfirmationBindingV1 {
  confirmation_ref: OpaqueRef;
  target_profile_ref: OpaqueRef;
  install_plan_ref: OpaqueRef;
  backup_manifest_ref: OpaqueRef;
  rollback_plan_ref: OpaqueRef;
  expires_at: string;
  actor_class: "user";
  consumed_by?: "profile_mutation" | "rollback" | "doctor_handoff";
  consumed_ref?: OpaqueRef;
}

export interface FlowDeskBootstrapFailureEvidenceV1 {
  installPlan: FlowDeskBootstrapInstallPlanV1;
  backupManifest?: FlowDeskBootstrapBackupManifestV1;
  profileMutation?: FlowDeskProfileMutationSummaryV1;
  omoCleanup?: FlowDeskOmoCleanupSummaryV1;
  commandGeneration?: FlowDeskCommandGenerationSummaryV1;
  configScaffold?: FlowDeskConfigScaffoldSummaryV1;
  rollbackPlan?: FlowDeskBootstrapRollbackPlanV1;
  rollbackResult?: FlowDeskBootstrapRollbackResultV1;
  bootstrapReport?: FlowDeskBootstrapReportV1;
  doctorHandoff?: FlowDeskDoctorHandoffV1;
  doctorReport?: FlowDeskDoctorReportV1;
  typedConfirmation?: FlowDeskBootstrapTypedConfirmationBindingV1;
  bootstrapAuthorityRequestedAfterDoctorPass?: boolean;
}

const BOOTSTRAP_SAFE_NEXT_ACTIONS = ["/flowdesk-doctor", "/flowdesk-usage", "/flowdesk-status", "/flowdesk-export-debug", "continue_chat", "ask_clarification"] as const satisfies readonly SafeNextAction[];
const DOCTOR_SAFE_NEXT_ACTIONS = ["/flowdesk-doctor", "/flowdesk-status", "/flowdesk-export-debug"] as const satisfies readonly SafeNextAction[];
const REQUIRED_DISABLED_BOOTSTRAP_MODES = ["real_dispatch", "managed_fallback", "lane_launch", "hard_chat_blocking"] as const satisfies readonly DisabledModeV1[];
const CHAT_DISABLED_MODES = ["chat_routed"] as const satisfies readonly DisabledModeV1[];
const DOCTOR_CATEGORY_OUTCOMES: Record<DoctorFailureCategoryV1, DoctorFailureCategoryOutcomeV1> = {
  dispatch_blocking: {
    category: "dispatch_blocking",
    disabled_modes: [...REQUIRED_DISABLED_BOOTSTRAP_MODES],
    safe_next_actions: [...DOCTOR_SAFE_NEXT_ACTIONS],
    managed_dispatch_allowed: false,
    privileged_automation_allowed: false,
    dispatch_authorized: false,
    fallback_authorized: false,
    guard_bypassed: false
  },
  chat_mode_disable: {
    category: "chat_mode_disable",
    disabled_modes: [...REQUIRED_DISABLED_BOOTSTRAP_MODES, ...CHAT_DISABLED_MODES],
    safe_next_actions: [...DOCTOR_SAFE_NEXT_ACTIONS],
    managed_dispatch_allowed: false,
    privileged_automation_allowed: false,
    dispatch_authorized: false,
    fallback_authorized: false,
    guard_bypassed: false
  },
  degraded_mode_warning: {
    category: "degraded_mode_warning",
    disabled_modes: [...REQUIRED_DISABLED_BOOTSTRAP_MODES],
    safe_next_actions: ["/flowdesk-doctor", "/flowdesk-status"],
    managed_dispatch_allowed: false,
    privileged_automation_allowed: false,
    dispatch_authorized: false,
    fallback_authorized: false,
    guard_bypassed: false
  },
  informational: {
    category: "informational",
    disabled_modes: [...REQUIRED_DISABLED_BOOTSTRAP_MODES],
    safe_next_actions: ["/flowdesk-status"],
    managed_dispatch_allowed: false,
    privileged_automation_allowed: false,
    dispatch_authorized: false,
    fallback_authorized: false,
    guard_bypassed: false
  }
};
const MUTATING_BOOTSTRAP_PHASES: readonly BootstrapPhaseV1[] = ["profile_mutation", "omo_cleanup", "command_generation", "config_scaffold"];
const BOOTSTRAP_REPORT_REF_FIELDS = ["backup_manifest_ref", "profile_mutation_ref", "omo_cleanup_ref", "command_generation_ref", "config_scaffold_ref", "rollback_plan_ref", "rollback_result_ref", "doctor_handoff_ref", "doctor_report_ref"] as const;
const disabledDurableBootstrapAuthority = {
  bootstrapAuthority: "redacted_bootstrap_artifact" as const,
  productionRegistrationEligible: false,
  dispatchApprovalEligible: false,
  realOpenCodeDispatch: false,
  actualLaneLaunch: false,
  providerCall: false,
  runtimeExecution: false
} as const;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isEnumValue(value: unknown, allowed: readonly string[]): boolean {
  return typeof value === "string" && allowed.includes(value);
}

function combine(results: readonly ValidationResult[]): ValidationResult {
  const errors = results.flatMap((result) => result.errors);
  return errors.length === 0 ? valid() : invalid(...errors);
}

function validateTimestamp(value: unknown, label: string): ValidationResult {
  return typeof value === "string" && Number.isFinite(Date.parse(value)) ? valid() : invalid(`${label} must be a timestamp`);
}

function validateHash(value: unknown, label: string): ValidationResult {
  if (typeof value !== "string" || value.length < 3 || value.length > 128) return invalid(`${label} must be a bounded hash`);
  if (!/^[A-Za-z0-9][A-Za-z0-9_.:-]*$/.test(value)) return invalid(`${label} is not schema-safe`);
  return validateNoForbiddenRawPayloads(value, label);
}

function validateRefArray(value: unknown, label: string, maxItems = 20): ValidationResult {
  if (!Array.isArray(value)) return invalid(`${label} must be an array`);
  const errors: string[] = [];
  if (value.length > maxItems) errors.push(`${label} exceeds max items ${maxItems}`);
  value.forEach((item, index) => {
    errors.push(...validateOpaqueRef(item, `${label}[${index}]`).errors);
  });
  return errors.length === 0 ? valid() : invalid(...errors);
}

function validateBootstrapSafeNextActions(value: unknown, label = "safe_next_actions"): ValidationResult {
  if (!Array.isArray(value)) return invalid(`${label} must be an array`);
  const errors: string[] = [];
  if (value.length > 4) errors.push(`${label} exceeds bootstrap max items 4`);
  value.forEach((item, index) => {
    if (!isEnumValue(item, BOOTSTRAP_SAFE_NEXT_ACTIONS)) errors.push(`${label}[${index}] is not a bootstrap-safe next action`);
  });
  return errors.length === 0 ? valid() : invalid(...errors);
}

export function getDoctorFailureCategoryOutcomeV1(category: DoctorFailureCategoryV1): DoctorFailureCategoryOutcomeV1 {
  return { ...DOCTOR_CATEGORY_OUTCOMES[category], disabled_modes: [...DOCTOR_CATEGORY_OUTCOMES[category].disabled_modes], safe_next_actions: [...DOCTOR_CATEGORY_OUTCOMES[category].safe_next_actions] };
}

export function buildDoctorSectionResultV1(input: Omit<FlowDeskDoctorReportV1["category_results"][number], "schema_version" | "safe_next_actions"> & { safe_next_actions?: readonly SafeNextAction[] }): FlowDeskDoctorReportV1["category_results"][number] {
  const outcome = getDoctorFailureCategoryOutcomeV1(input.category);
  return {
    schema_version: "flowdesk.doctor_section_result.v1",
    ...input,
    safe_next_actions: [...(input.safe_next_actions ?? outcome.safe_next_actions)]
  };
}

function validateDoctorSafeNextActions(value: unknown, label = "safe_next_actions"): ValidationResult {
  if (!Array.isArray(value)) return invalid(`${label} must be an array`);
  const errors: string[] = [];
  if (value.length > 3) errors.push(`${label} exceeds doctor max items 3`);
  value.forEach((item, index) => {
    if (!isEnumValue(item, DOCTOR_SAFE_NEXT_ACTIONS)) errors.push(`${label}[${index}] is not a doctor diagnostic or status action`);
  });
  return errors.length === 0 ? valid() : invalid(...errors);
}

function validateBootstrapStatus(value: unknown, label = "status"): ValidationResult {
  return isEnumValue(value, BOOTSTRAP_MUTATION_STATUSES) ? valid() : invalid(`${label} is invalid`);
}

function validateCount(value: unknown, label: string): ValidationResult {
  return typeof value === "number" && Number.isInteger(value) && Number.isFinite(value) && value >= 0 ? valid() : invalid(`${label} is invalid`);
}

function validateFreshCheck(value: unknown, label: string): ValidationResult {
  if (!isRecord(value)) return invalid(`${label} must be an object`);
  return combine([
    isEnumValue(value.check, ["usage", "provider_health", "policy", "runtime_capability", "checkpoint", "audit"]) ? valid() : invalid(`${label}.check is invalid`),
    typeof value.required === "boolean" ? valid() : invalid(`${label}.required must be boolean`),
    value.ref === undefined ? valid() : validateOpaqueRef(value.ref, `${label}.ref`),
    validateNoForbiddenRawPayloads(value, label)
  ]);
}

function validateFreshCheckArray(value: unknown, label: string, maxItems = 20): ValidationResult {
  if (!Array.isArray(value)) return invalid(`${label} must be an array`);
  const errors: string[] = [];
  if (value.length > maxItems) errors.push(`${label} exceeds max items ${maxItems}`);
  value.forEach((item, index) => {
    errors.push(...validateFreshCheck(item, `${label}[${index}]`).errors);
  });
  return errors.length === 0 ? valid() : invalid(...errors);
}

function validateDisabledModeContainment(value: unknown): ValidationResult {
  if (!Array.isArray(value)) return invalid("disabled_modes must be an array");
  const modes = new Set(value);
  const errors: string[] = [];
  value.forEach((mode, index) => {
    if (!isEnumValue(mode, DISABLED_MODES)) errors.push(`disabled_modes[${index}] is invalid`);
  });
  for (const mode of REQUIRED_DISABLED_BOOTSTRAP_MODES) {
    if (!modes.has(mode)) errors.push(`bootstrap report must keep ${mode} disabled`);
  }
  return errors.length === 0 ? valid() : invalid(...errors);
}

function validateBootstrapReportRefs(value: Record<string, unknown>): ValidationResult {
  return combine(BOOTSTRAP_REPORT_REF_FIELDS.map((field) => (value[field] === undefined ? valid() : validateOpaqueRef(value[field], field))));
}

function appendResultErrors(errors: string[], label: string, result: ValidationResult): void {
  if (!result.ok) errors.push(...result.errors.map((error) => `${label}: ${error}`));
}

function validateTypedConfirmationBinding(input: FlowDeskBootstrapFailureEvidenceV1): ValidationResult {
  const confirmation = input.typedConfirmation;
  if (confirmation === undefined) return invalid("typed confirmation binding is required for bootstrap mutation evidence");
  if (!isRecord(confirmation)) return invalid("typed confirmation binding must be an object");
  const errors: string[] = [];
  appendResultErrors(errors, "typed_confirmation.confirmation_ref", validateOpaqueRef(confirmation.confirmation_ref, "confirmation_ref"));
  appendResultErrors(errors, "typed_confirmation.target_profile_ref", validateOpaqueRef(confirmation.target_profile_ref, "target_profile_ref"));
  appendResultErrors(errors, "typed_confirmation.install_plan_ref", validateOpaqueRef(confirmation.install_plan_ref, "install_plan_ref"));
  appendResultErrors(errors, "typed_confirmation.backup_manifest_ref", validateOpaqueRef(confirmation.backup_manifest_ref, "backup_manifest_ref"));
  appendResultErrors(errors, "typed_confirmation.rollback_plan_ref", validateOpaqueRef(confirmation.rollback_plan_ref, "rollback_plan_ref"));
  appendResultErrors(errors, "typed_confirmation.expires_at", validateTimestamp(confirmation.expires_at, "expires_at"));
  if (confirmation.actor_class !== "user") errors.push("typed confirmation actor_class must be user");
  if (confirmation.consumed_by !== undefined && !isEnumValue(confirmation.consumed_by, ["profile_mutation", "rollback", "doctor_handoff"])) errors.push("typed confirmation consumed_by is invalid");
  if (confirmation.consumed_ref !== undefined) appendResultErrors(errors, "typed_confirmation.consumed_ref", validateOpaqueRef(confirmation.consumed_ref, "consumed_ref"));
  if (input.installPlan.confirmation_ref !== confirmation.confirmation_ref) errors.push("typed confirmation must match install plan confirmation_ref");
  if (input.installPlan.install_plan_id !== confirmation.install_plan_ref) errors.push("typed confirmation must bind the install plan");
  if (input.installPlan.target_profile_ref !== confirmation.target_profile_ref) errors.push("typed confirmation must bind the target profile");
  if (input.installPlan.rollback_plan_ref !== confirmation.rollback_plan_ref) errors.push("typed confirmation must bind the rollback plan");
  if (input.backupManifest === undefined) errors.push("typed confirmation requires a backup manifest before mutation");
  else if (!isRecord(input.backupManifest)) errors.push("typed confirmation backup manifest evidence must be an object");
  else if (input.backupManifest.backup_manifest_id !== confirmation.backup_manifest_ref) errors.push("typed confirmation must bind the backup manifest");
  if (input.rollbackPlan !== undefined && !isRecord(input.rollbackPlan)) errors.push("typed confirmation rollback plan evidence must be an object");
  else if (isRecord(input.rollbackPlan) && input.rollbackPlan.rollback_plan_id !== confirmation.rollback_plan_ref) errors.push("typed confirmation must match rollback plan evidence");
  return errors.length === 0 ? valid() : invalid(...errors);
}

function validateDoctorPassed(report: FlowDeskDoctorReportV1 | undefined): boolean {
  return isRecord(report) && Array.isArray(report.category_results) && report.category_results.every((result) => isRecord(result) && result.category !== "dispatch_blocking");
}

export function validateDoctorSectionResultV1(value: unknown): ValidationResult {
  if (!isRecord(value)) return invalid("doctor section result must be an object");
  return combine([
    validateSchemaArtifactValue("flowdesk.doctor_section_result.v1", value),
    validateOpaqueId(value.run_id, "run_id"),
    isEnumValue(value.section, ["migration_cleanup", "opencode_plugin_compatibility", "provider_usage_readiness", "policy_project_safety"]) ? valid() : invalid("doctor section is invalid"),
    isEnumValue(value.category, DOCTOR_FAILURE_CATEGORIES) ? valid() : invalid("doctor category is invalid"),
    typeof value.summary === "string" && value.summary.length > 0 && value.summary.length <= 500 ? validateNoForbiddenRawPayloads(value.summary, "summary") : invalid("summary is invalid"),
    validateDoctorSafeNextActions(value.safe_next_actions),
    validateRefArray(value.refs, "refs"),
    validateHash(value.redaction_version, "redaction_version")
  ]);
}

function validateDoctorReportCategoryContainment(value: Record<string, unknown>): ValidationResult {
  const results = Array.isArray(value.category_results) ? value.category_results.filter(isRecord) : [];
  const categories = new Set(results.map((result) => result.category));
  const disabledModes = new Set(Array.isArray(value.disabled_modes) ? value.disabled_modes : []);
  const errors: string[] = [];
  if (categories.has("chat_mode_disable") && !disabledModes.has("chat_routed")) errors.push("chat_mode_disable doctor reports must disable chat_routed mode");
  if (!categories.has("chat_mode_disable") && disabledModes.has("chat_routed")) errors.push("chat_routed mode may be disabled only for chat_mode_disable doctor results");
  if (categories.has("dispatch_blocking")) {
    for (const mode of REQUIRED_DISABLED_BOOTSTRAP_MODES) {
      if (!disabledModes.has(mode)) errors.push(`dispatch_blocking doctor reports must disable ${mode}`);
    }
  }
  const allowedModes = new Set<DisabledModeV1>([...REQUIRED_DISABLED_BOOTSTRAP_MODES, ...(categories.has("chat_mode_disable") ? CHAT_DISABLED_MODES : [])]);
  for (const mode of disabledModes) {
    if (isEnumValue(mode, DISABLED_MODES) && !allowedModes.has(mode as DisabledModeV1)) errors.push(`doctor category report must not disable unrelated mode ${String(mode)}`);
  }
  return errors.length === 0 ? valid() : invalid(...errors);
}

export function validateBootstrapInstallPlanV1(value: unknown): ValidationResult {
  if (!isRecord(value)) return invalid("bootstrap install plan must be an object");
  const phases = Array.isArray(value.planned_phases) ? value.planned_phases : [];
  const requiresMutationConfirmation = phases.some((phase) => MUTATING_BOOTSTRAP_PHASES.includes(phase as BootstrapPhaseV1));
  return combine([
    validateSchemaArtifactValue("flowdesk.bootstrap_install_plan.v1", value),
    validateOpaqueId(value.install_plan_id, "install_plan_id"),
    validateTimestamp(value.created_at, "created_at"),
    validateOpaqueRef(value.target_profile_ref, "target_profile_ref"),
    value.release_mode === "release1" ? valid() : invalid("bootstrap install plan release_mode must be release1"),
    Array.isArray(value.planned_phases) ? combine(value.planned_phases.map((phase, index) => (isEnumValue(phase, BOOTSTRAP_PHASES) ? valid() : invalid(`planned_phases[${index}] is invalid`)))) : invalid("planned_phases must be an array"),
    typeof value.requires_typed_confirmation === "boolean" ? valid() : invalid("requires_typed_confirmation must be boolean"),
    requiresMutationConfirmation && value.requires_typed_confirmation !== true ? invalid("mutating bootstrap phases require typed confirmation") : valid(),
    requiresMutationConfirmation && value.confirmation_ref === undefined ? invalid("mutating bootstrap phases require confirmation_ref") : valid(),
    value.confirmation_ref === undefined ? valid() : validateOpaqueRef(value.confirmation_ref, "confirmation_ref"),
    validateOpaqueRef(value.package_ref, "package_ref"),
    validateOpaqueRef(value.rollback_plan_ref, "rollback_plan_ref"),
    validateBootstrapSafeNextActions(value.safe_next_actions)
  ]);
}

export function validateBootstrapBackupManifestV1(value: unknown): ValidationResult {
  if (!isRecord(value)) return invalid("bootstrap backup manifest must be an object");
  return combine([
    validateSchemaArtifactValue("flowdesk.bootstrap_backup_manifest.v1", value),
    validateOpaqueId(value.backup_manifest_id, "backup_manifest_id"),
    validateTimestamp(value.created_at, "created_at"),
    validateOpaqueRef(value.target_profile_ref, "target_profile_ref"),
    validateOpaqueRef(value.backup_ref, "backup_ref"),
    validateHash(value.backup_hash, "backup_hash"),
    validateOpaqueRef(value.source_config_ref, "source_config_ref"),
    isEnumValue(value.credential_preservation_check, ["passed", "blocked", "not_applicable"]) ? valid() : invalid("credential_preservation_check is invalid"),
    typeof value.restore_eligible === "boolean" ? valid() : invalid("restore_eligible must be boolean"),
    value.credential_preservation_check === "blocked" && value.restore_eligible === true ? invalid("blocked credential preservation cannot be restore eligible") : valid(),
    validateOpaqueRef(value.audit_ref, "audit_ref")
  ]);
}

export function validateProfileMutationSummaryV1(value: unknown): ValidationResult {
  if (!isRecord(value)) return invalid("profile mutation summary must be an object");
  return combine([
    validateSchemaArtifactValue("flowdesk.profile_mutation_summary.v1", value),
    validateOpaqueId(value.mutation_id, "mutation_id"),
    validateOpaqueRef(value.target_profile_ref, "target_profile_ref"),
    validateBootstrapStatus(value.status),
    validateRefArray(value.changed_entry_refs, "changed_entry_refs"),
    validateRefArray(value.skipped_entry_refs, "skipped_entry_refs"),
    isEnumValue(value.provider_auth_preserved, ["passed", "blocked", "unknown"]) ? valid() : invalid("provider_auth_preserved is invalid"),
    value.unrelated_profile_mutation === false ? valid() : invalid("unrelated_profile_mutation must remain false"),
    validateOpaqueRef(value.backup_manifest_ref, "backup_manifest_ref"),
    validateOpaqueRef(value.audit_ref, "audit_ref")
  ]);
}

export function validateOmoCleanupSummaryV1(value: unknown): ValidationResult {
  if (!isRecord(value)) return invalid("cleanup summary must be an object");
  return combine([
    validateSchemaArtifactValue("flowdesk.omo_cleanup_summary.v1", value),
    validateOpaqueId(value.cleanup_id, "cleanup_id"),
    validateOpaqueRef(value.target_profile_ref, "target_profile_ref"),
    validateBootstrapStatus(value.status),
    validateCount(value.removed_ref_count, "removed_ref_count"),
    validateCount(value.retained_ref_count, "retained_ref_count"),
    validateCount(value.blocked_ref_count, "blocked_ref_count"),
    typeof value.omitted_legacy_runtime_imports === "boolean" ? valid() : invalid("omitted_legacy_runtime_imports must be boolean"),
    isEnumValue(value.provider_auth_preserved, ["passed", "blocked", "unknown"]) ? valid() : invalid("provider_auth_preserved is invalid"),
    validateOpaqueRef(value.backup_manifest_ref, "backup_manifest_ref"),
    validateOpaqueRef(value.audit_ref, "audit_ref")
  ]);
}

export function validateCommandGenerationSummaryV1(value: unknown): ValidationResult {
  if (!isRecord(value)) return invalid("command generation summary must be an object");
  return combine([
    validateSchemaArtifactValue("flowdesk.command_generation_summary.v1", value),
    validateOpaqueId(value.generation_id, "generation_id"),
    validateOpaqueRef(value.target_profile_ref, "target_profile_ref"),
    validateBootstrapStatus(value.status),
    validateRefArray(value.command_refs, "command_refs"),
    validateHash(value.template_hash, "template_hash"),
    isEnumValue(value.static_template_validation, ["passed", "blocked"]) ? valid() : invalid("static_template_validation is invalid"),
    value.static_template_validation === "passed" && value.status === "failed" ? invalid("failed command generation cannot have passed template validation") : valid(),
    value.alias_conformance_ref === undefined ? valid() : validateOpaqueRef(value.alias_conformance_ref, "alias_conformance_ref"),
    validateOpaqueRef(value.rollback_ref, "rollback_ref")
  ]);
}

export function validateConfigScaffoldSummaryV1(value: unknown): ValidationResult {
  if (!isRecord(value)) return invalid("config scaffold summary must be an object");
  return combine([
    validateSchemaArtifactValue("flowdesk.config_scaffold_summary.v1", value),
    validateOpaqueId(value.scaffold_id, "scaffold_id"),
    validateBootstrapStatus(value.status),
    validateOpaqueRef(value.config_ref, "config_ref"),
    validateHash(value.config_hash, "config_hash"),
    validateRefArray(value.policy_pack_refs, "policy_pack_refs"),
    Array.isArray(value.policy_pack_hashes) ? combine(value.policy_pack_hashes.map((hash, index) => validateHash(hash, `policy_pack_hashes[${index}]`))) : invalid("policy_pack_hashes must be an array"),
    validateOpaqueRef(value.audit_ref, "audit_ref")
  ]);
}

export function validateBootstrapRollbackPlanV1(value: unknown): ValidationResult {
  if (!isRecord(value)) return invalid("bootstrap rollback plan must be an object");
  return combine([
    validateSchemaArtifactValue("flowdesk.bootstrap_rollback_plan.v1", value),
    validateOpaqueId(value.rollback_plan_id, "rollback_plan_id"),
    validateOpaqueId(value.install_plan_id, "install_plan_id"),
    validateOpaqueRef(value.target_profile_ref, "target_profile_ref"),
    validateOpaqueRef(value.backup_manifest_ref, "backup_manifest_ref"),
    validateRefArray(value.reversible_phase_refs, "reversible_phase_refs"),
    validateRefArray(value.non_reversible_summary_refs, "non_reversible_summary_refs"),
    validateFreshCheckArray(value.restore_preconditions, "restore_preconditions"),
    validateBootstrapSafeNextActions(value.safe_next_actions)
  ]);
}

export function validateBootstrapRollbackResultV1(value: unknown): ValidationResult {
  if (!isRecord(value)) return invalid("bootstrap rollback result must be an object");
  return combine([
    validateSchemaArtifactValue("flowdesk.bootstrap_rollback_result.v1", value),
    validateOpaqueId(value.rollback_result_id, "rollback_result_id"),
    validateOpaqueId(value.rollback_plan_id, "rollback_plan_id"),
    validateTimestamp(value.completed_at, "completed_at"),
    isEnumValue(value.status, ["restored", "partial", "blocked", "failed"]) ? valid() : invalid("status is invalid"),
    validateCount(value.restored_ref_count, "restored_ref_count"),
    validateCount(value.skipped_ref_count, "skipped_ref_count"),
    validateCount(value.warning_count, "warning_count"),
    validateRefArray(value.audit_refs, "audit_refs"),
    validateBootstrapSafeNextActions(value.safe_next_actions)
  ]);
}

export function validateBootstrapReportV1(value: unknown): ValidationResult {
  if (!isRecord(value)) return invalid("bootstrap report must be an object");
  return combine([
    validateSchemaArtifactValue("flowdesk.bootstrap_report.v1", value),
    validateOpaqueId(value.report_id, "report_id"),
    validateOpaqueId(value.install_plan_id, "install_plan_id"),
    validateOpaqueRef(value.target_profile_ref, "target_profile_ref"),
    validateTimestamp(value.started_at, "started_at"),
    value.completed_at === undefined ? valid() : validateTimestamp(value.completed_at, "completed_at"),
    isEnumValue(value.final_phase, BOOTSTRAP_PHASES) ? valid() : invalid("final_phase is invalid"),
    isEnumValue(value.status, ["complete", "failed", "rolled_back", "partial"]) ? valid() : invalid("status is invalid"),
    value.failure_class === undefined ? valid() : isEnumValue(value.failure_class, BOOTSTRAP_FAILURE_CLASSES) ? valid() : invalid("failure_class is invalid"),
    validateBootstrapReportRefs(value),
    validateDisabledModeContainment(value.disabled_modes),
    validateBootstrapSafeNextActions(value.safe_next_actions),
    validateRefArray(value.audit_refs, "audit_refs")
  ]);
}

export function validateDoctorReportV1(value: unknown): ValidationResult {
  if (!isRecord(value)) return invalid("doctor report must be an object");
  return combine([
    validateSchemaArtifactValue("flowdesk.doctor_report.v1", value),
    validateOpaqueId(value.run_id, "run_id"),
    validateTimestamp(value.checked_at, "checked_at"),
    isEnumValue(value.profile, ["production", "development", "test"]) ? valid() : invalid("profile is invalid"),
    Array.isArray(value.category_results) ? combine(value.category_results.map((result) => validateDoctorSectionResultV1(result))) : invalid("category_results must be an array"),
    validateDisabledModeContainment(value.disabled_modes),
    validateDoctorReportCategoryContainment(value),
    validateOpaqueRef(value.compatibility_ref, "compatibility_ref"),
    validateDoctorSafeNextActions(value.safe_next_actions)
  ]);
}

export function validateDoctorHandoffV1(value: unknown): ValidationResult {
  if (!isRecord(value)) return invalid("doctor handoff must be an object");
  return combine([
    validateSchemaArtifactValue("flowdesk.doctor_handoff.v1", value),
    validateOpaqueId(value.handoff_id, "handoff_id"),
    validateTimestamp(value.created_at, "created_at"),
    validateOpaqueRef(value.install_plan_ref, "install_plan_ref"),
    validateOpaqueRef(value.bootstrap_report_ref, "bootstrap_report_ref"),
    value.config_ref === undefined ? valid() : validateOpaqueRef(value.config_ref, "config_ref"),
    value.compatibility_ref === undefined ? valid() : validateOpaqueRef(value.compatibility_ref, "compatibility_ref"),
    validateOpaqueRef(value.doctor_request_ref, "doctor_request_ref"),
    validateBootstrapSafeNextActions(value.safe_next_actions)
  ]);
}

export function validateBootstrapFailureEvidenceV1(value: unknown): ValidationResult {
  if (!isRecord(value)) return invalid("bootstrap failure evidence must be an object");
  const input = value as Partial<FlowDeskBootstrapFailureEvidenceV1>;
  const errors: string[] = [];
  if (input.installPlan === undefined) return invalid("bootstrap failure evidence requires installPlan");
  if (!isRecord(input.installPlan)) return invalid("bootstrap failure evidence installPlan must be an object");

  appendResultErrors(errors, "installPlan", validateBootstrapInstallPlanV1(input.installPlan));
  if (input.backupManifest !== undefined) appendResultErrors(errors, "backupManifest", validateBootstrapBackupManifestV1(input.backupManifest));
  if (input.profileMutation !== undefined) appendResultErrors(errors, "profileMutation", validateProfileMutationSummaryV1(input.profileMutation));
  if (input.omoCleanup !== undefined) appendResultErrors(errors, "omoCleanup", validateOmoCleanupSummaryV1(input.omoCleanup));
  if (input.commandGeneration !== undefined) appendResultErrors(errors, "commandGeneration", validateCommandGenerationSummaryV1(input.commandGeneration));
  if (input.configScaffold !== undefined) appendResultErrors(errors, "configScaffold", validateConfigScaffoldSummaryV1(input.configScaffold));
  if (input.rollbackPlan !== undefined) appendResultErrors(errors, "rollbackPlan", validateBootstrapRollbackPlanV1(input.rollbackPlan));
  if (input.rollbackResult !== undefined) appendResultErrors(errors, "rollbackResult", validateBootstrapRollbackResultV1(input.rollbackResult));
  if (input.bootstrapReport !== undefined) appendResultErrors(errors, "bootstrapReport", validateBootstrapReportV1(input.bootstrapReport));
  if (input.doctorHandoff !== undefined) appendResultErrors(errors, "doctorHandoff", validateDoctorHandoffV1(input.doctorHandoff));
  if (input.doctorReport !== undefined) appendResultErrors(errors, "doctorReport", validateDoctorReportV1(input.doctorReport));

  const backupManifest = isRecord(input.backupManifest) ? input.backupManifest : undefined;
  const profileMutation = isRecord(input.profileMutation) ? input.profileMutation : undefined;
  const omoCleanup = isRecord(input.omoCleanup) ? input.omoCleanup : undefined;
  const commandGeneration = isRecord(input.commandGeneration) ? input.commandGeneration : undefined;
  const rollbackPlan = isRecord(input.rollbackPlan) ? input.rollbackPlan : undefined;
  const rollbackResult = isRecord(input.rollbackResult) ? input.rollbackResult : undefined;
  const bootstrapReport = isRecord(input.bootstrapReport) ? input.bootstrapReport : undefined;
  const doctorHandoff = isRecord(input.doctorHandoff) ? input.doctorHandoff : undefined;

  const mutationArtifacts = [input.profileMutation, input.omoCleanup, input.commandGeneration, input.configScaffold].filter((artifact): artifact is NonNullable<typeof artifact> => artifact !== undefined);
  if (mutationArtifacts.length > 0) {
    if (input.backupManifest === undefined) errors.push("bootstrap mutation evidence requires backup-first manifest");
    appendResultErrors(errors, "typedConfirmation", validateTypedConfirmationBinding(input as FlowDeskBootstrapFailureEvidenceV1));
  }

  const targetProfileRef = input.installPlan.target_profile_ref;
  if (backupManifest !== undefined && backupManifest.target_profile_ref !== targetProfileRef) errors.push("backup manifest target profile must match install plan");
  for (const [label, artifact] of [
    ["profileMutation", profileMutation],
    ["omoCleanup", omoCleanup],
    ["commandGeneration", commandGeneration],
    ["rollbackPlan", rollbackPlan],
    ["bootstrapReport", bootstrapReport]
  ] as const) {
    if (artifact !== undefined && "target_profile_ref" in artifact && artifact.target_profile_ref !== targetProfileRef) errors.push(`${label} target profile must match install plan`);
  }

  const backupManifestId = backupManifest?.backup_manifest_id;
  if (profileMutation !== undefined && profileMutation.backup_manifest_ref !== backupManifestId) errors.push("profile mutation must reference the backup manifest");
  if (omoCleanup !== undefined && omoCleanup.backup_manifest_ref !== backupManifestId) errors.push("OMO cleanup must reference the backup manifest");
  if (rollbackPlan !== undefined) {
    if (input.backupManifest === undefined) errors.push("rollback plan requires backup manifest evidence");
    else if (rollbackPlan.backup_manifest_ref !== backupManifestId) errors.push("rollback plan must reference the backup manifest");
    if (rollbackPlan.install_plan_id !== input.installPlan.install_plan_id) errors.push("rollback plan must reference the install plan");
  }
  if (input.rollbackResult !== undefined && input.rollbackPlan === undefined) errors.push("rollback result requires rollback plan evidence");

  if (profileMutation?.status === "applied" && profileMutation.provider_auth_preserved !== "passed") errors.push("applied profile mutation must prove provider auth preservation");
  if (omoCleanup?.status === "applied" && omoCleanup.provider_auth_preserved !== "passed") errors.push("applied OMO cleanup must prove provider auth preservation");

  if (rollbackResult !== undefined && ["partial", "blocked", "failed"].includes(String(rollbackResult.status))) {
    if (rollbackResult.warning_count === 0 && rollbackResult.skipped_ref_count === 0) errors.push("partial or blocked rollback requires warning or skipped counts");
    if (!Array.isArray(rollbackResult.safe_next_actions) || !rollbackResult.safe_next_actions.some((action) => action === "/flowdesk-doctor" || action === "/flowdesk-export-debug")) errors.push("partial or blocked rollback must expose doctor or debug export guidance");
  }

  if (bootstrapReport !== undefined) {
    if (bootstrapReport.backup_manifest_ref !== undefined && bootstrapReport.backup_manifest_ref !== backupManifestId) errors.push("bootstrap report backup ref must match backup manifest");
    if (bootstrapReport.rollback_plan_ref !== undefined && bootstrapReport.rollback_plan_ref !== rollbackPlan?.rollback_plan_id) errors.push("bootstrap report rollback plan ref must match rollback plan");
    if (bootstrapReport.rollback_result_ref !== undefined && bootstrapReport.rollback_result_ref !== rollbackResult?.rollback_result_id) errors.push("bootstrap report rollback result ref must match rollback result");
    if (bootstrapReport.status === "complete") {
      if (input.doctorHandoff === undefined) errors.push("complete bootstrap report requires doctor handoff evidence");
      if (bootstrapReport.doctor_handoff_ref === undefined) errors.push("complete bootstrap report requires doctor_handoff_ref");
    }
  }

  if (doctorHandoff !== undefined) {
    if (doctorHandoff.install_plan_ref !== input.installPlan.install_plan_id) errors.push("doctor handoff must bind install plan");
    if (bootstrapReport !== undefined && doctorHandoff.bootstrap_report_ref !== bootstrapReport.report_id) errors.push("doctor handoff must bind bootstrap report");
  }

  if (validateDoctorPassed(input.doctorReport) && input.bootstrapAuthorityRequestedAfterDoctorPass === true) errors.push("bootstrap authority is closed after a passing doctor report");

  return errors.length === 0 ? valid() : invalid(...errors);
}

export function validateFlowDeskBootstrapArtifactV1(value: unknown): ValidationResult {
  if (!isRecord(value) || typeof value.schema_version !== "string") return invalid("bootstrap artifact schema_version is required");
  switch (value.schema_version) {
    case "flowdesk.bootstrap_install_plan.v1":
      return validateBootstrapInstallPlanV1(value);
    case "flowdesk.bootstrap_backup_manifest.v1":
      return validateBootstrapBackupManifestV1(value);
    case "flowdesk.profile_mutation_summary.v1":
      return validateProfileMutationSummaryV1(value);
    case "flowdesk.omo_cleanup_summary.v1":
      return validateOmoCleanupSummaryV1(value);
    case "flowdesk.command_generation_summary.v1":
      return validateCommandGenerationSummaryV1(value);
    case "flowdesk.config_scaffold_summary.v1":
      return validateConfigScaffoldSummaryV1(value);
    case "flowdesk.bootstrap_rollback_plan.v1":
      return validateBootstrapRollbackPlanV1(value);
    case "flowdesk.bootstrap_rollback_result.v1":
      return validateBootstrapRollbackResultV1(value);
    case "flowdesk.bootstrap_report.v1":
      return validateBootstrapReportV1(value);
    case "flowdesk.doctor_handoff.v1":
      return validateDoctorHandoffV1(value);
    case "flowdesk.doctor_report.v1":
      return validateDoctorReportV1(value);
    default:
      return invalid("unsupported bootstrap artifact schema_version");
  }
}

export function assertFlowDeskBootstrapArtifactV1(value: unknown): asserts value is FlowDeskBootstrapArtifactV1 {
  const result = validateFlowDeskBootstrapArtifactV1(value);
  if (!result.ok) throw new Error(result.errors.join("; "));
}

function bootstrapArtifactId(record: FlowDeskBootstrapArtifactV1): string {
  switch (record.schema_version) {
    case "flowdesk.bootstrap_install_plan.v1":
      return record.install_plan_id;
    case "flowdesk.bootstrap_backup_manifest.v1":
      return record.backup_manifest_id;
    case "flowdesk.profile_mutation_summary.v1":
      return record.mutation_id;
    case "flowdesk.omo_cleanup_summary.v1":
      return record.cleanup_id;
    case "flowdesk.command_generation_summary.v1":
      return record.generation_id;
    case "flowdesk.config_scaffold_summary.v1":
      return record.scaffold_id;
    case "flowdesk.bootstrap_rollback_plan.v1":
      return record.rollback_plan_id;
    case "flowdesk.bootstrap_rollback_result.v1":
      return record.rollback_result_id;
    case "flowdesk.bootstrap_report.v1":
      return record.report_id;
    case "flowdesk.doctor_handoff.v1":
      return record.handoff_id;
    case "flowdesk.doctor_report.v1":
      return record.run_id;
  }
}

function bootstrapArtifactPath(installPlanId: string, schemaId: FlowDeskBootstrapSchemaIdV1, artifactId: string): string {
  const schemaSlug = schemaId.replace(/^flowdesk\./, "").replace(/\.v1$/, "").replace(/_/g, "-");
  return `.flowdesk/bootstrap/${installPlanId}/${schemaSlug}/${artifactId}.json`;
}

function bootstrapRecordInstallPlanId(record: FlowDeskBootstrapArtifactV1): string | undefined {
  if ("install_plan_id" in record) return record.install_plan_id;
  if ("install_plan_ref" in record) return record.install_plan_ref;
  return undefined;
}

function canonicalPathForIntent(record: FlowDeskBootstrapArtifactV1, path: string): ValidationResult {
  const prefix = ".flowdesk/bootstrap/";
  if (!path.startsWith(prefix)) return invalid("bootstrap write intent path must stay under .flowdesk/bootstrap");
  const segments = path.slice(prefix.length).split("/");
  if (segments.length !== 3) return invalid("bootstrap write intent path must use canonical bootstrap artifact layout");
  const [installPlanId] = segments;
  const installPlanResult = validateOpaqueId(installPlanId, "bootstrap write intent install_plan_id");
  if (!installPlanResult.ok) return installPlanResult;
  const recordInstallPlanId = bootstrapRecordInstallPlanId(record);
  if (recordInstallPlanId !== undefined && installPlanId !== recordInstallPlanId) return invalid("bootstrap write intent install_plan_id must match record");
  const expectedPath = bootstrapArtifactPath(installPlanId, record.schema_version, bootstrapArtifactId(record));
  return path === expectedPath ? valid() : invalid("bootstrap write intent path must match record schema and artifact id");
}

function cloneRecord<TRecord>(record: TRecord): TRecord {
  return JSON.parse(JSON.stringify(record)) as TRecord;
}

export function prepareRedactedBootstrapArtifactWriteIntent<TRecord extends FlowDeskBootstrapArtifactV1>(installPlanId: string, record: TRecord): FlowDeskBootstrapPrepareResult<TRecord> {
  const installPlanResult = validateOpaqueId(installPlanId, "install_plan_id");
  if (!installPlanResult.ok) return installPlanResult;
  const recordResult = validateFlowDeskBootstrapArtifactV1(record);
  if (!recordResult.ok) return recordResult;
  const artifactId = bootstrapArtifactId(record);
  const artifactIdResult = validateOpaqueId(artifactId, "artifact_id");
  if (!artifactIdResult.ok) return artifactIdResult;
  const path = bootstrapArtifactPath(installPlanId, record.schema_version, artifactId);
  const pathResult = validateFlowDeskRelativeStatePath(path);
  if (!pathResult.ok) return pathResult;
  const tempPath = `${path}.tmp-${record.schema_version.replace(/[^A-Za-z0-9_.-]/g, "-")}`;
  const tempPathResult = validateFlowDeskRelativeStatePath(tempPath, "temp path");
  if (!tempPathResult.ok) return tempPathResult;
  const cloned = cloneRecord(record);
  return {
    ok: true,
    errors: [],
    record: cloned,
    writeIntent: {
      operation: "write_json",
      path,
      schemaId: record.schema_version,
      authority: "redacted_bootstrap_artifact",
      record: cloned,
      serialization: "json",
      fsSafety: "validated_relative_flowdesk_path_only",
      atomicity: {
        strategy: "temp_then_rename_intent",
        tempPath
      }
    }
  };
}

export function validateRedactedBootstrapArtifactWriteIntent(intent: unknown): ValidationResult {
  if (!isRecord(intent)) return invalid("bootstrap write intent must be an object");
  const errors: string[] = [];
  const unknown = Object.keys(intent).filter((key) => !["operation", "path", "schemaId", "authority", "record", "serialization", "fsSafety", "atomicity"].includes(key));
  if (unknown.length > 0) errors.push(`bootstrap write intent unknown properties: ${unknown.join(",")}`);
  if (intent.operation !== "write_json") errors.push("bootstrap write intent operation is invalid");
  if (intent.authority !== "redacted_bootstrap_artifact") errors.push("bootstrap write intent authority is invalid");
  if (intent.serialization !== "json") errors.push("bootstrap write intent serialization is invalid");
  if (intent.fsSafety !== "validated_relative_flowdesk_path_only") errors.push("bootstrap write intent path safety is invalid");
  if (typeof intent.schemaId !== "string") errors.push("bootstrap write intent schemaId is required");
  const pathResult = validateFlowDeskRelativeStatePath(intent.path, "bootstrap write intent path");
  if (!pathResult.ok) errors.push(...pathResult.errors);
  const tempPathResult = validateFlowDeskRelativeStatePath(isRecord(intent.atomicity) ? intent.atomicity.tempPath : undefined, "bootstrap write intent temp path");
  if (!tempPathResult.ok) errors.push(...tempPathResult.errors);
  if (isRecord(intent.atomicity)) {
    const unknownAtomicity = Object.keys(intent.atomicity).filter((key) => !["strategy", "tempPath"].includes(key));
    if (unknownAtomicity.length > 0) errors.push(`bootstrap write intent atomicity unknown properties: ${unknownAtomicity.join(",")}`);
  }
  if (!isRecord(intent.atomicity) || intent.atomicity.strategy !== "temp_then_rename_intent") errors.push("bootstrap write intent atomicity is invalid");
  if (typeof intent.path === "string" && isRecord(intent.atomicity) && typeof intent.atomicity.tempPath === "string" && !intent.atomicity.tempPath.startsWith(`${intent.path}.tmp-`)) errors.push("bootstrap write intent temp path must derive from target path");
  if (!isRecord(intent.record)) errors.push("bootstrap write intent record is required");
  if (typeof intent.schemaId === "string" && isRecord(intent.record) && intent.record.schema_version !== intent.schemaId) errors.push("bootstrap write intent schemaId must match record");
  if (errors.length > 0) return invalid(...errors);
  const recordResult = validateFlowDeskBootstrapArtifactV1(intent.record);
  if (!recordResult.ok) return recordResult;
  return canonicalPathForIntent(intent.record as FlowDeskBootstrapArtifactV1, intent.path as string);
}

export function applyBootstrapWriteIntentsToInMemoryState(intents: readonly FlowDeskBootstrapWriteIntent[], initial?: ReadonlyMap<string, string>): Map<string, string> {
  const state = new Map(initial ?? []);
  for (const intent of intents) {
    const result = validateRedactedBootstrapArtifactWriteIntent(intent);
    if (!result.ok) throw new Error(result.errors.join("; "));
    state.set(intent.path, JSON.stringify(intent.record));
  }
  return state;
}

function resolveBootstrapTarget(rootDir: string, relativePath: string): { root: string; target: string; temp: string } {
  const root = resolve(rootDir);
  const target = resolve(root, relativePath);
  const temp = resolve(root, `${relativePath}.tmp-${Date.now().toString(36)}`);
  const rootPrefix = root.endsWith(sep) ? root : `${root}${sep}`;
  if (target !== root && !target.startsWith(rootPrefix)) throw new Error("bootstrap target escapes rootDir");
  if (temp !== root && !temp.startsWith(rootPrefix)) throw new Error("bootstrap temp target escapes rootDir");
  return { root, target, temp };
}

export function applyBootstrapWriteIntentsToDurableState(rootDir: string, intents: readonly FlowDeskBootstrapWriteIntent[]): FlowDeskBootstrapDurableApplyResult {
  if (typeof rootDir !== "string" || rootDir.trim().length === 0) return { ...invalid("rootDir is required"), ...disabledDurableBootstrapAuthority };
  const writtenPaths: string[] = [];
  try {
    const root = resolve(rootDir);
    const prepared = intents.map((intent) => {
      const validation = validateRedactedBootstrapArtifactWriteIntent(intent);
      if (!validation.ok) return { validation, intent };
      return { validation, intent, resolved: resolveBootstrapTarget(root, intent.path) };
    });
    const errors = prepared.flatMap((entry) => entry.validation.ok ? [] : entry.validation.errors);
    if (errors.length > 0) return { ...invalid(...errors), writtenPaths, ...disabledDurableBootstrapAuthority };
    for (const { intent, resolved } of prepared) {
      if (resolved === undefined) throw new Error("bootstrap durable write prevalidation failed");
      mkdirSync(dirname(resolved.target), { recursive: true });
      writeFileSync(resolved.temp, JSON.stringify(intent.record), "utf8");
      renameSync(resolved.temp, resolved.target);
      writtenPaths.push(intent.path);
    }
    return { ...valid(), rootDir: root, writtenPaths, ...disabledDurableBootstrapAuthority };
  } catch (error) {
    return { ...invalid(error instanceof Error ? error.message : "bootstrap durable write failed"), writtenPaths, ...disabledDurableBootstrapAuthority };
  }
}

export function redactedBootstrapRef(ref: OpaqueRef): OpaqueRef {
  const result = validateOpaqueRef(ref, "bootstrap ref");
  if (!result.ok) throw new Error(result.errors.join("; "));
  return ref;
}
