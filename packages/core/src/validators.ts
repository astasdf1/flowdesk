import type {
  FlowDeskAbortResponseV1,
  FlowDeskActiveAttemptLockV1,
  FlowDeskAttemptRecordV1,
  FlowDeskAuditEventV1,
  FlowDeskAuditRecordV1,
  FlowDeskAuditRefSummaryV1,
  FlowDeskChatIntakeRequestV1,
  FlowDeskChatIntakeResponseV1,
  FlowDeskCheckpointRecordV1,
  FlowDeskConformanceEvidenceRecordV1,
  FlowDeskConformanceRuntimeMetadataV1,
  FlowDeskDebugExportManifestV1,
  FlowDeskDoctorRequestV1,
  FlowDeskDoctorResponseV1,
  FlowDeskExportDebugResponseV1,
  FlowDeskHookHarnessRequestV1,
  FlowDeskHookHarnessResponseV1,
  FlowDeskLaneRecordV1,
  FlowDeskLaneSummaryArtifactV1,
  FlowDeskManagedDispatchBetaUsageAuthorityEvidenceV1,
  FlowDeskPlanRequestV1,
  FlowDeskPlanResponseV1,
  FlowDeskPlanSummaryArtifactV1,
  FlowDeskProviderHealthSnapshotV1,
  FlowDeskRetryRequestV1,
  FlowDeskRetryResponseV1,
  FlowDeskRunRequestV1,
  FlowDeskRunResponseV1,
  FlowDeskStatusLaneSummaryV1,
  FlowDeskStatusRequestV1,
  FlowDeskStatusResponseV1,
  FlowDeskStatusSummaryArtifactV1,
  FlowDeskUsageRequestV1,
  FlowDeskUsageResponseV1,
  FlowDeskUsageSnapshotV1,
  FlowDeskWorkflowActiveV1,
  FlowDeskWorkflowPlanV1,
  FlowDeskWorkflowRecordV1,
  FlowDeskWorkflowStepV1,
  GuardApprovedDispatchV1,
  GuardRequestV1,
  ProviderFamily,
  ProviderHealthSummaryV1,
  WorkflowTaxonomyV1
} from "./release1-contracts.js";
import {
  ARTIFACT_DISPOSITIONS,
  ATTEMPT_STATES,
  DEBUG_SECTIONS,
  DISABLED_MODES,
  DOCTOR_FAILURE_CATEGORIES,
  FORBIDDEN_RAW_PAYLOAD_MARKERS,
  HOOK_HARNESS_ATTEMPT_KINDS,
  HOOK_HARNESS_CAPABILITIES,
  HOOK_HARNESS_DECISIONS,
  HOOK_HARNESS_MODES,
  INPUT_MODES,
  LANE_FAILURE_CLASSES,
  LANE_INVOCATION_REF_KINDS,
  LANE_VERDICT_STATUSES,
  LOCK_RECOVERY_STATES,
  NON_DISPATCH_PERMISSION_CLASSES,
  PERSISTED_LANE_STATES,
  PROVIDER_FAILURE_CLASSES,
  PROVIDER_FAMILIES,
  REDACTED_ERROR_CATEGORIES,
  RELEASE_1_RUN_MODES,
  RESUME_MODES,
  SAFE_NEXT_ACTIONS,
  TOOL_STATUSES,
  USAGE_UNCERTAINTY_FLAGS,
  WORKFLOW_STATES
} from "./release1-contracts.js";
import { getRelease1SchemaArtifact } from "./schema-artifacts.js";

export interface ValidationResult {
  ok: boolean;
  errors: string[];
}

export interface ManagedDispatchBetaEvidenceValidationOptionsV1 {
  expectedConfigHash?: string;
  expectedPolicyPackHashes?: readonly string[];
  expectedWorkflowId?: string;
  expectedStepId?: string;
  expectedAttemptId?: string;
  expectedProviderFamily?: ProviderFamily;
  expectedProviderQualifiedModelId?: string;
  expectedModelFamily?: string;
  expectedUsageSnapshotRef?: string;
  expectedProviderHealthSnapshotRef?: string;
  expectedRuntimeCapabilityRef?: string;
  expectedPreDispatchAuditRef?: string;
  expectedConformanceRef?: string;
  expectedAuthProfileRef?: string;
  expectedCredentialScopeRef?: string;
  expectedAccountBoundaryRef?: string;
  now?: number;
}

function validateConcreteProviderQualifiedModelId(value: unknown, label = "provider_qualified_model_id"): ValidationResult {
  const result = validateProviderQualifiedModelId(value);
  if (!result.ok) return result;
  const model = (value as string).split("/")[1] ?? "";
  return /(^|[-_.:])(latest|default|auto)($|[-_.:])/i.test(model) ? invalid(`${label} must be a concrete non-alias model id`) : valid();
}

export function valid(): ValidationResult {
  return { ok: true, errors: [] };
}

export function invalid(...errors: string[]): ValidationResult {
  return { ok: false, errors };
}

function combine(results: ValidationResult[]): ValidationResult {
  const errors = results.flatMap((result) => result.errors);
  return errors.length === 0 ? valid() : invalid(...errors);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isEnumValue(value: unknown, allowed: readonly string[]): boolean {
  return typeof value === "string" && allowed.includes(value);
}

function validateTimestamp(value: unknown, label: string): ValidationResult {
  if (typeof value !== "string" || value.length === 0) return invalid(`${label} is required`);
  return Number.isFinite(Date.parse(value)) ? valid() : invalid(`${label} must be a parseable timestamp`);
}

function rejectUnknownProperties(value: Record<string, unknown>, allowed: readonly string[]): ValidationResult {
  const unknown = Object.keys(value).filter((key) => !allowed.includes(key));
  return unknown.length === 0 ? valid() : invalid(`unknown properties: ${unknown.join(",")}`);
}

function requireFields(value: Record<string, unknown>, fields: readonly string[]): ValidationResult {
  const missing = fields.filter((field) => !(field in value));
  return missing.length === 0 ? valid() : invalid(`missing required fields: ${missing.join(",")}`);
}

function validateSchemaArtifactPropertyValue(fieldName: string, value: unknown, property: { type: string; maxLength?: number; maxItems?: number; enum?: readonly string[] }): ValidationResult {
  if (value === undefined) return valid();
  if (property.enum === undefined && property.maxLength === undefined && property.maxItems === undefined) return valid();
  const errors: string[] = [];
  if (property.type === "string") {
    if (typeof value !== "string") errors.push(`${fieldName} must be a string`);
    else {
      if (property.maxLength !== undefined && value.length > property.maxLength) errors.push(`${fieldName} exceeds max length ${property.maxLength}`);
      if (property.enum !== undefined && !property.enum.includes(value)) errors.push(`${fieldName} is not allowed`);
    }
  } else if (property.type === "number") {
    if (typeof value !== "number" || !Number.isFinite(value)) errors.push(`${fieldName} must be a finite number`);
  } else if (property.type === "boolean") {
    if (typeof value !== "boolean") errors.push(`${fieldName} must be a boolean`);
  } else if (property.type === "array") {
    if (!Array.isArray(value)) errors.push(`${fieldName} must be an array`);
    else if (property.maxItems !== undefined && value.length > property.maxItems) errors.push(`${fieldName} exceeds max items ${property.maxItems}`);
  } else if (property.type === "object") {
    if (!isRecord(value)) errors.push(`${fieldName} must be an object`);
  } else {
    errors.push(`${fieldName} has unsupported schema artifact type`);
  }
  return errors.length === 0 ? valid() : invalid(...errors);
}

function validateStringArray(value: unknown, label: string, allowed?: readonly string[], maxItems?: number): ValidationResult {
  if (!Array.isArray(value)) return invalid(`${label} must be an array`);
  const errors: string[] = [];
  if (maxItems !== undefined && value.length > maxItems) errors.push(`${label} exceeds max items ${maxItems}`);
  value.forEach((item, index) => {
    if (typeof item !== "string") errors.push(`${label}[${index}] must be a string`);
    if (allowed !== undefined && !isEnumValue(item, allowed)) errors.push(`${label}[${index}] is not allowed`);
    errors.push(...validateNoForbiddenRawPayloads(item, `${label}[${index}]`).errors);
  });
  return errors.length === 0 ? valid() : invalid(...errors);
}

function validateOpaqueRefArray(value: unknown, label: string, maxItems?: number): ValidationResult {
  if (!Array.isArray(value)) return invalid(`${label} must be an array`);
  const errors: string[] = [];
  if (maxItems !== undefined && value.length > maxItems) errors.push(`${label} exceeds max items ${maxItems}`);
  value.forEach((item, index) => {
    errors.push(...validateOpaqueRef(item, `${label}[${index}]`).errors);
  });
  return errors.length === 0 ? valid() : invalid(...errors);
}

export function validateOpaqueId(value: unknown, label = "opaque id"): ValidationResult {
  if (typeof value !== "string") return invalid(`${label} must be a string`);
  if (value.length < 3 || value.length > 128) return invalid(`${label} length is outside 3..128`);
  if (!/^[A-Za-z0-9][A-Za-z0-9_.:-]*$/.test(value)) return invalid(`${label} is not schema-safe`);
  if (/[/\s]/.test(value) || value.includes("..")) return invalid(`${label} must not contain paths, spaces, or traversal`);
  return validateNoForbiddenRawPayloads(value, label);
}

export function validateOpaqueRef(value: unknown, label = "opaque ref"): ValidationResult {
  return validateOpaqueId(value, label);
}

export function validateProviderFamily(value: unknown): ValidationResult {
  return isEnumValue(value, PROVIDER_FAMILIES) ? valid() : invalid("provider_family is missing or malformed");
}

export function validateProviderQualifiedModelId(value: unknown): ValidationResult {
  if (typeof value !== "string" || value.length > 128) return invalid("model id must be a bounded string");
  const parts = value.split("/");
  if (parts.length !== 2 || !parts[0] || !parts[1]) return invalid("model id must be provider-qualified as provider/model");
  const [family, model] = parts;
  if (!isEnumValue(family, PROVIDER_FAMILIES) || family === "unknown" || family === "all") return invalid("model id provider family is not dispatchable");
  if (!/^[A-Za-z0-9][A-Za-z0-9_.:-]*$/.test(model)) return invalid("model id is not schema-safe");
  return validateNoForbiddenRawPayloads(value, "model id");
}

export function validateNoForbiddenRawPayloads(value: unknown, label = "payload"): ValidationResult {
  const errors: string[] = [];
    const schemaSafeKeysWithForbiddenTerms = new Set(["credential_preservation_check", "credential_scope_ref", "runtime_echo_mode", "runtime_echo_validation", "runtime_echo_ref"]);
  const visit = (current: unknown, path: string): void => {
    if (typeof current === "string") {
      const lower = current.toLowerCase();
      if (/\b(prompt|system prompt|developer message|transcript|stack trace|runtime echo|provider payload|provider response|tool args|tool result|shell output|raw log|raw config)\b/.test(lower)) {
        errors.push(`${path} contains prompt-like or raw payload marker`);
      }
      if (/([A-Za-z]:[\\/]|\\\\|\/(Users|home|etc|var|private|tmp|usr|opt|bin|sbin|Volumes|Applications|Library|System|dev|proc|root|mnt|srv|run)(?:\/|$|[\s"'`])|(^|[\s"'`])\/(?!flowdesk(?:-[A-Za-z0-9-]+)?\b)[A-Za-z0-9._-]+(?:\/|$|[\s"'`])|\.\.\/|\.\.\\|\.git\/|src\/|packages\/|~\/)/.test(current)) {
        errors.push(`${path} contains raw path marker`);
      }
      if (/\b(sk-[A-Za-z0-9]|api[_-]?key|bearer\s+[A-Za-z0-9]|token[:=]|credential|secret)\b/i.test(current)) {
        errors.push(`${path} contains credential-shaped marker`);
      }
      return;
    }
    if (Array.isArray(current)) {
      current.forEach((item, index) => {
        visit(item, `${path}[${index}]`);
      });
      return;
    }
    if (isRecord(current)) {
      for (const [key, nested] of Object.entries(current)) {
        const normalizedKey = key.toLowerCase();
        if (!schemaSafeKeysWithForbiddenTerms.has(normalizedKey) && FORBIDDEN_RAW_PAYLOAD_MARKERS.some((marker) => normalizedKey.includes(marker))) errors.push(`${path}.${key} is a forbidden raw payload field`);
        visit(nested, `${path}.${key}`);
      }
    }
  };
  visit(value, label);
  return errors.length === 0 ? valid() : invalid(...errors);
}

function validateNonNegativeInteger(value: unknown, label: string): ValidationResult {
  return typeof value === "number" && Number.isInteger(value) && Number.isFinite(value) && value >= 0 ? valid() : invalid(`${label} is invalid`);
}

export function validateSchemaArtifactValue(schemaId: string, value: unknown): ValidationResult {
  if (!isRecord(value)) return invalid(`${schemaId} value must be an object`);
  const artifact = getRelease1SchemaArtifact(schemaId);
  if (artifact === undefined) return invalid(`unknown schema artifact: ${schemaId}`);
  const propertyResults = Object.entries(value).map(([fieldName, fieldValue]) => {
    const property = artifact.properties[fieldName];
    return property === undefined ? valid() : validateSchemaArtifactPropertyValue(fieldName, fieldValue, property);
  });
  return combine([
    rejectUnknownProperties(value, Object.keys(artifact.properties)),
    requireFields(value, artifact.required),
    value.schema_version === undefined || value.schema_version === schemaId ? valid() : invalid("schema_version mismatch"),
    ...propertyResults,
    validateNoForbiddenRawPayloads(value)
  ]);
}

function validateBlockerSummaryV1(value: unknown, label = "blocker"): ValidationResult {
  if (!isRecord(value)) return invalid(`${label} must be an object`);
  return combine([
    rejectUnknownProperties(value, ["category", "summary", "safe_remediation", "refs"]),
    requireFields(value, ["category", "summary", "safe_remediation", "refs"]),
    isEnumValue(value.category, REDACTED_ERROR_CATEGORIES) ? valid() : invalid(`${label}.category is invalid`),
    typeof value.summary === "string" && value.summary.length > 0 && value.summary.length <= 500 ? validateNoForbiddenRawPayloads(value.summary, `${label}.summary`) : invalid(`${label}.summary is required`),
    typeof value.safe_remediation === "string" && value.safe_remediation.length > 0 && value.safe_remediation.length <= 500 ? validateNoForbiddenRawPayloads(value.safe_remediation, `${label}.safe_remediation`) : invalid(`${label}.safe_remediation is required`),
    validateStringArray(value.refs, `${label}.refs`, undefined, 20),
    validateNoForbiddenRawPayloads(value, label)
  ]);
}

function validateGuardCheckV1(value: unknown, label = "guard_check"): ValidationResult {
  if (!isRecord(value)) return invalid(`${label} must be an object`);
  return combine([
    rejectUnknownProperties(value, ["check", "result", "ref"]),
    requireFields(value, ["check", "result"]),
    isEnumValue(value.check, ["policy", "usage", "provider_health", "runtime_compatibility", "audit", "redaction", "approval", "conformance"]) ? valid() : invalid(`${label}.check is invalid`),
    isEnumValue(value.result, ["pass", "fail", "unknown"]) ? valid() : invalid(`${label}.result is invalid`),
    value.ref === undefined ? valid() : validateOpaqueRef(value.ref, `${label}.ref`),
    validateNoForbiddenRawPayloads(value, label)
  ]);
}

function validateGuardPrecheckSummaryV1(value: unknown): ValidationResult {
  if (!isRecord(value)) return invalid("guard_precheck must be an object");
  return combine([
    rejectUnknownProperties(value, ["result", "required_checks", "refs"]),
    requireFields(value, ["result", "required_checks", "refs"]),
    isEnumValue(value.result, ["eligible", "blocked", "requires_approval"]) ? valid() : invalid("guard_precheck.result is invalid"),
    Array.isArray(value.required_checks) ? combine(value.required_checks.map((check, index) => validateGuardCheckV1(check, `guard_precheck.required_checks[${index}]`))) : invalid("guard_precheck.required_checks must be an array"),
    validateStringArray(value.refs, "guard_precheck.refs", undefined, 20),
    validateNoForbiddenRawPayloads(value, "guard_precheck")
  ]);
}

export function validateProviderHealthSummaryV1(value: unknown): ValidationResult {
  if (!isRecord(value)) return invalid("provider health summary must be an object");
  const remediation = typeof value.safe_remediation === "string" ? value.safe_remediation : "";
  return combine([
    rejectUnknownProperties(value, ["provider_family", "model_family", "availability_state", "failure_class", "dispatchability", "safe_remediation", "snapshot_ref"]),
    requireFields(value, ["provider_family", "availability_state", "failure_class", "dispatchability", "safe_remediation"]),
    validateProviderFamily(value.provider_family),
    value.model_family === undefined ? valid() : typeof value.model_family === "string" && value.model_family.length <= 128 ? validateNoForbiddenRawPayloads(value.model_family, "model_family") : invalid("model_family must be a bounded string"),
    isEnumValue(value.availability_state, ["healthy", "degraded", "unavailable", "unknown"]) ? valid() : invalid("availability_state is invalid"),
    isEnumValue(value.failure_class, PROVIDER_FAILURE_CLASSES) ? valid() : invalid("failure_class is invalid"),
    isEnumValue(value.dispatchability, ["dispatchable", "diagnostic_only", "non_dispatchable"]) ? valid() : invalid("dispatchability is invalid"),
    ["degraded", "unavailable", "unknown"].includes(String(value.availability_state)) && value.dispatchability === "dispatchable" ? invalid("degraded, unavailable, or unknown provider health must not be dispatchable") : valid(),
    value.failure_class !== "none" && value.dispatchability === "dispatchable" ? invalid("provider health failure classes must not be dispatchable") : valid(),
    /\b(?:fallback|reselect|reselection)\b/i.test(remediation) ? invalid("provider health remediation must not suggest fallback or reselection") : valid(),
    typeof value.safe_remediation === "string" && value.safe_remediation.length > 0 && value.safe_remediation.length <= 500 ? validateNoForbiddenRawPayloads(value.safe_remediation, "safe_remediation") : invalid("safe_remediation is required"),
    value.snapshot_ref === undefined ? valid() : validateOpaqueRef(value.snapshot_ref, "snapshot_ref"),
    validateNoForbiddenRawPayloads(value, "provider_health_summary")
  ]);
}

export function assertProviderHealthSummaryV1(value: unknown): asserts value is ProviderHealthSummaryV1 {
  const result = validateProviderHealthSummaryV1(value);
  if (!result.ok) throw new Error(result.errors.join("; "));
}

function validateRequestEnvelope(value: Record<string, unknown>, schemaVersion: string): ValidationResult {
  return combine([
    validateSchemaArtifactValue(schemaVersion, value),
    validateOpaqueId(value.request_id, "request_id"),
    isEnumValue(value.input_mode, INPUT_MODES) ? valid() : invalid("input_mode is invalid"),
    value.workflow_id === undefined ? valid() : validateOpaqueId(value.workflow_id, "workflow_id"),
    value.session_ref === undefined ? valid() : validateOpaqueRef(value.session_ref, "session_ref"),
    value.redacted_intake_ref === undefined ? valid() : validateOpaqueRef(value.redacted_intake_ref, "redacted_intake_ref"),
    value.user_approval_ref === undefined ? valid() : validateOpaqueRef(value.user_approval_ref, "user_approval_ref")
  ]);
}

function validateNoUnsupportedRetryAuthority(value: unknown, label: string): ValidationResult {
  if (typeof value !== "string") return invalid(`${label} must be a string`);
  if (value.length === 0 || value.length > 500) return invalid(`${label} is required and must be bounded`);
  if (/\b(?:real[\s_-]*(?:opencode[\s_-]*)?dispatch|actual[\s_-]*lane[\s_-]*launch|provider[\s_-]*(?:call|request|api|payload|response)|fallback|reselect|reselection|automatic[\s_-]*(?:fallback|model)|hard[\s_-]*(?:chat|cancel|stop)|no[\s_-]*reply|noReply|cancel:\s*true|stop:\s*true|raw[\s_-]*(?:prompt|payload|log)|system prompt|developer message|transcript)\b/i.test(value)) {
    return invalid(`${label} contains unsupported retry authority or raw payload marker`);
  }
  return validateNoForbiddenRawPayloads(value, label);
}

export function validateResponseEnvelopeV1(value: unknown, schemaVersion?: string): ValidationResult {
  if (!isRecord(value)) return invalid("response envelope must be an object");
  const expectedSchema = schemaVersion ?? (typeof value.schema_version === "string" ? value.schema_version : "flowdesk.tool.response.v1");
  return combine([
    validateSchemaArtifactValue(expectedSchema, value),
    typeof value.ok === "boolean" ? valid() : invalid("ok must be boolean"),
    isEnumValue(value.status, TOOL_STATUSES) ? valid() : invalid("status is invalid"),
    validateStringArray(value.safe_next_actions, "safe_next_actions", SAFE_NEXT_ACTIONS, 8),
    typeof value.user_message === "string" && value.user_message.length <= 500 ? valid() : invalid("user_message is missing or too long"),
    value.workflow_id === undefined ? valid() : validateOpaqueId(value.workflow_id, "workflow_id"),
    value.audit_ref === undefined ? valid() : validateOpaqueRef(value.audit_ref, "audit_ref"),
    value.debug_ref === undefined ? valid() : validateOpaqueRef(value.debug_ref, "debug_ref"),
    value.lane_refs === undefined ? valid() : validateStringArray(value.lane_refs, "lane_refs", undefined, 20),
    value.error === undefined ? valid() : validateRedactedErrorV1(value.error)
  ]);
}

export function validateRedactedErrorV1(value: unknown): ValidationResult {
  if (!isRecord(value)) return invalid("error must be an object");
  return combine([
    validateSchemaArtifactValue("flowdesk.redacted_error.v1", value),
    value.code === undefined ? valid() : validateOpaqueId(value.code, "error.code"),
    isEnumValue(value.category, REDACTED_ERROR_CATEGORIES) ? valid() : invalid("error.category is invalid"),
    typeof value.safe_remediation === "string" && value.safe_remediation.length <= 500 ? valid() : invalid("error.safe_remediation is missing or too long")
  ]);
}

export function validateChatIntakeRequestV1(value: unknown): ValidationResult {
  if (!isRecord(value)) return invalid("chat intake request must be an object");
  return combine([
    validateRequestEnvelope(value, "flowdesk.chat_intake.request.v1"),
    typeof value.intake_summary === "string" && value.intake_summary.length > 0 && value.intake_summary.length <= 500 ? validateNoForbiddenRawPayloads(value.intake_summary, "intake_summary") : invalid("intake_summary is required"),
    isEnumValue(value.source_surface, ["chat.message", "command.execute.before", "manual_command", "test_fixture"]) ? valid() : invalid("source_surface is invalid"),
    /\b(?:real[\s_-]*(?:opencode[\s_-]*)?dispatch|realOpenCodeDispatch|actual[\s_-]*lane[\s_-]*launch|actualLaneLaunch|providerCall|provider[\s_-]*(?:payload|response|call|request|api)|fallbackAuthority|automaticFallbackOrReselection|hardCancelOrNoReply|noReply|no[\s_-]*reply|hard[\s_-]*(?:cancel|stop)|cancel:\s*true|stop:\s*true|prevent-default|raw[\s_-]*prompt|system prompt|developer message|transcript)\b/i.test(String(value.intake_summary ?? "")) ? invalid("chat intake summary contains unsupported authority or raw payload marker") : valid()
  ]);
}

export function assertChatIntakeRequestV1(value: unknown): asserts value is FlowDeskChatIntakeRequestV1 {
  const result = validateChatIntakeRequestV1(value);
  if (!result.ok) throw new Error(result.errors.join("; "));
}

export function validateChatIntakeResponseV1(value: unknown): ValidationResult {
  if (!isRecord(value)) return invalid("chat intake response must be an object");
  const safeActions = Array.isArray(value.safe_next_actions) ? value.safe_next_actions : [];
  return combine([
    validateResponseEnvelopeV1(value, "flowdesk.chat_intake.response.v1"),
    isEnumValue(value.classification, ["fast_chat", "managed_plan", "clarify", "blocked"]) ? valid() : invalid("classification is invalid"),
    validateOpaqueRef(value.redacted_intake_ref, "redacted_intake_ref"),
    isEnumValue(value.route_decision, ["continue_chat", "show_plan", "ask_clarification", "block", "use_command_fallback"]) ? valid() : invalid("route_decision is invalid"),
    value.route_decision === "continue_chat" && safeActions.some((action: unknown) => action !== "continue_chat") ? invalid("continue_chat route must not imply managed FlowDesk authority") : valid(),
    value.classification === "blocked" && safeActions.includes("/flowdesk-run") ? invalid("blocked chat intake must not suggest run") : valid(),
    validateNoForbiddenRawPayloads(value, "chat_intake_response")
  ]);
}

export function assertChatIntakeResponseV1(value: unknown): asserts value is FlowDeskChatIntakeResponseV1 {
  const result = validateChatIntakeResponseV1(value);
  if (!result.ok) throw new Error(result.errors.join("; "));
}

export function validateHookHarnessRequestV1(value: unknown): ValidationResult {
  if (!isRecord(value)) return invalid("hook harness request must be an object");
  return combine([
    validateSchemaArtifactValue("flowdesk.hook_harness.request.v1", value),
    validateOpaqueId(value.request_id, "request_id"),
    isEnumValue(value.hook_harness_mode, HOOK_HARNESS_MODES) ? valid() : invalid("hook_harness_mode is invalid"),
    isEnumValue(value.attempt_kind, HOOK_HARNESS_ATTEMPT_KINDS) ? valid() : invalid("attempt_kind is invalid"),
    isEnumValue(value.requested_capability, HOOK_HARNESS_CAPABILITIES) ? valid() : invalid("requested_capability is invalid"),
    validateOpaqueRef(value.redacted_attempt_ref, "redacted_attempt_ref"),
    typeof value.attempt_summary === "string" && value.attempt_summary.length > 0 && value.attempt_summary.length <= 500 ? validateNoForbiddenRawPayloads(value.attempt_summary, "attempt_summary") : invalid("attempt_summary is required"),
    value.chat_intake_mode === undefined || isEnumValue(value.chat_intake_mode, ["steering", "observe_only", "off"]) ? valid() : invalid("chat_intake_mode is invalid"),
    value.conformance_ref === undefined ? valid() : validateOpaqueRef(value.conformance_ref, "conformance_ref"),
    validateNoForbiddenRawPayloads(value, "hook_harness_request")
  ]);
}

export function assertHookHarnessRequestV1(value: unknown): asserts value is FlowDeskHookHarnessRequestV1 {
  const result = validateHookHarnessRequestV1(value);
  if (!result.ok) throw new Error(result.errors.join("; "));
}

export function validateHookHarnessResponseV1(value: unknown): ValidationResult {
  if (!isRecord(value)) return invalid("hook harness response must be an object");
  const actions = Array.isArray(value.safe_next_actions) ? value.safe_next_actions : [];
const safeManualActions = ["/flowdesk-doctor", "/flowdesk-status", "/flowdesk-export-debug"] as const;
  const usesOnlySafeManualActions = actions.every((action) => typeof action === "string" && safeManualActions.includes(action as (typeof safeManualActions)[number]));
  return combine([
    validateSchemaArtifactValue("flowdesk.hook_harness.response.v1", value),
    validateOpaqueId(value.request_id, "request_id"),
    isEnumValue(value.hook_harness_mode, HOOK_HARNESS_MODES) ? valid() : invalid("hook_harness_mode is invalid"),
    isEnumValue(value.decision, HOOK_HARNESS_DECISIONS) ? valid() : invalid("decision is invalid"),
    Array.isArray(value.diagnostic_observations) ? validateStringArray(value.diagnostic_observations, "diagnostic_observations", undefined, 8) : invalid("diagnostic_observations must be an array"),
    validateStringArray(value.safe_next_actions, "safe_next_actions", SAFE_NEXT_ACTIONS, 8),
    typeof value.user_message === "string" && value.user_message.length > 0 && value.user_message.length <= 500 ? validateNoForbiddenRawPayloads(value.user_message, "user_message") : invalid("user_message is required"),
    typeof value.managed_automation_enabled === "boolean" ? valid() : invalid("managed_automation_enabled must be boolean"),
    value.privileged_automation_enabled === false ? valid() : invalid("privileged_automation_enabled must be false"),
    value.dispatch_authorized === false ? valid() : invalid("dispatch_authorized must be false"),
    value.guard_bypassed === false ? valid() : invalid("guard_bypassed must be false"),
    value.fallback_authorized === false ? valid() : invalid("fallback_authorized must be false"),
    value.hard_chat_authority === false ? valid() : invalid("hard_chat_authority must be false"),
    typeof value.mutation_applied === "boolean" ? valid() : invalid("mutation_applied must be boolean"),
    typeof value.denial_applied === "boolean" ? valid() : invalid("denial_applied must be boolean"),
    validateOpaqueRef(value.redacted_attempt_ref, "redacted_attempt_ref"),
    value.audit_ref === undefined ? valid() : validateOpaqueRef(value.audit_ref, "audit_ref"),
    value.hook_harness_mode === "observe" && (value.mutation_applied !== false || value.denial_applied !== false || value.managed_automation_enabled !== false) ? invalid("observe mode must not mutate, deny, or enable managed automation") : valid(),
    value.hook_harness_mode === "off" && (value.mutation_applied !== false || value.denial_applied !== false || value.managed_automation_enabled !== false) ? invalid("off mode must leave only safe manual fallback") : valid(),
    value.hook_harness_mode === "observe" && !usesOnlySafeManualActions ? invalid("observe mode must only suggest safe manual diagnostics") : valid(),
    value.hook_harness_mode === "off" && !usesOnlySafeManualActions ? invalid("off mode must only suggest safe manual fallback") : valid(),
    value.decision === "deny" && actions.includes("/flowdesk-run") ? invalid("denied hook harness response must not suggest run") : valid(),
    validateNoForbiddenRawPayloads(value, "hook_harness_response")
  ]);
}

const doctorDiagnosticActions = ["/flowdesk-doctor", "/flowdesk-status", "/flowdesk-export-debug"] as const;

function validateDoctorDiagnosticActions(value: unknown, label = "safe_next_actions"): ValidationResult {
  return validateStringArray(value, label, doctorDiagnosticActions, 3);
}

function validateDoctorSectionResultLikeV1(value: unknown, label = "doctor_results"): ValidationResult {
  if (!isRecord(value)) return invalid(`${label} item must be an object`);
  return combine([
    validateSchemaArtifactValue("flowdesk.doctor_section_result.v1", value),
    validateOpaqueId(value.run_id, `${label}.run_id`),
    isEnumValue(value.section, ["migration_cleanup", "opencode_plugin_compatibility", "provider_usage_readiness", "policy_project_safety"]) ? valid() : invalid(`${label}.section is invalid`),
    isEnumValue(value.category, DOCTOR_FAILURE_CATEGORIES) ? valid() : invalid(`${label}.category is invalid`),
    typeof value.summary === "string" && value.summary.length > 0 && value.summary.length <= 500 ? validateNoForbiddenRawPayloads(value.summary, `${label}.summary`) : invalid(`${label}.summary is invalid`),
    validateDoctorDiagnosticActions(value.safe_next_actions, `${label}.safe_next_actions`),
    validateStringArray(value.refs, `${label}.refs`, undefined, 20),
    validateOpaqueId(value.redaction_version, `${label}.redaction_version`),
    validateNoForbiddenRawPayloads(value, label)
  ]);
}

export function validateDoctorRequestV1(value: unknown): ValidationResult {
  if (!isRecord(value)) return invalid("doctor request must be an object");
  return combine([
    validateRequestEnvelope(value, "flowdesk.doctor.request.v1"),
    isEnumValue(value.check_scope, ["install", "runtime", "policy", "usage", "provider_health", "conformance", "all"]) ? valid() : invalid("check_scope is invalid"),
    isEnumValue(value.profile, ["production", "development", "test"]) ? valid() : invalid("profile is invalid"),
    value.persist_report === undefined || typeof value.persist_report === "boolean" ? valid() : invalid("persist_report must be boolean")
  ]);
}

export function assertDoctorRequestV1(value: unknown): asserts value is FlowDeskDoctorRequestV1 {
  const result = validateDoctorRequestV1(value);
  if (!result.ok) throw new Error(result.errors.join("; "));
}

export function validateDoctorResponseV1(value: unknown): ValidationResult {
  if (!isRecord(value)) return invalid("doctor response must be an object");
  const doctorResults = Array.isArray(value.doctor_results) ? value.doctor_results : [];
  const categories = new Set(doctorResults.filter(isRecord).map((result) => result.category));
  const disabledModes = new Set(Array.isArray(value.disabled_modes) ? value.disabled_modes : []);
  const allowedDisabledModes = new Set(["real_dispatch", "managed_fallback", "lane_launch", "hard_chat_blocking", ...(categories.has("chat_mode_disable") ? ["chat_routed"] : [])]);
  const release1BaseDisabledModes = ["real_dispatch", "managed_fallback", "lane_launch", "hard_chat_blocking"] as const;
  return combine([
    validateResponseEnvelopeV1(value, "flowdesk.doctor.response.v1"),
    Array.isArray(value.doctor_results) ? combine(value.doctor_results.map((result, index) => validateDoctorSectionResultLikeV1(result, `doctor_results[${index}]`))) : invalid("doctor_results must be an array"),
    validateProviderHealthSummaryV1(value.provider_health_summary),
    validateOpaqueRef(value.compatibility_ref, "compatibility_ref"),
    validateStringArray(value.disabled_modes, "disabled_modes", DISABLED_MODES, 8),
    validateDoctorDiagnosticActions(value.safe_next_actions),
    categories.has("chat_mode_disable") && !disabledModes.has("chat_routed") ? invalid("chat_mode_disable doctor responses must disable chat_routed mode") : valid(),
    !categories.has("chat_mode_disable") && disabledModes.has("chat_routed") ? invalid("chat_routed mode may be disabled only for chat_mode_disable doctor results") : valid(),
    release1BaseDisabledModes.some((mode) => !disabledModes.has(mode)) ? invalid("doctor responses must keep Release 1 managed dispatch and privileged automation modes disabled") : valid(),
    [...disabledModes].some((mode) => typeof mode === "string" && DISABLED_MODES.includes(mode as never) && !allowedDisabledModes.has(mode)) ? invalid("doctor responses must not disable unrelated modes for category mapping") : valid(),
    validateNoForbiddenRawPayloads(value, "doctor_response")
  ]);
}

export function assertDoctorResponseV1(value: unknown): asserts value is FlowDeskDoctorResponseV1 {
  const result = validateDoctorResponseV1(value);
  if (!result.ok) throw new Error(result.errors.join("; "));
}

export function assertHookHarnessResponseV1(value: unknown): asserts value is FlowDeskHookHarnessResponseV1 {
  const result = validateHookHarnessResponseV1(value);
  if (!result.ok) throw new Error(result.errors.join("; "));
}

export function validatePlanRequestV1(value: unknown): ValidationResult {
  if (!isRecord(value)) return invalid("plan request must be an object");
  return combine([
    validateRequestEnvelope(value, "flowdesk.plan.request.v1"),
    typeof value.goal_summary === "string" && value.goal_summary.length > 0 && value.goal_summary.length <= 500 ? validateNoForbiddenRawPayloads(value.goal_summary, "goal_summary") : invalid("goal_summary is required"),
    typeof value.scope_summary === "string" && value.scope_summary.length > 0 && value.scope_summary.length <= 500 ? validateNoForbiddenRawPayloads(value.scope_summary, "scope_summary") : invalid("scope_summary is required"),
    typeof value.risk_hint === "string" && value.risk_hint.length > 0 && value.risk_hint.length <= 500 ? validateNoForbiddenRawPayloads(value.risk_hint, "risk_hint") : invalid("risk_hint is required"),
    value.existing_plan_revision_id === undefined ? valid() : validateOpaqueId(value.existing_plan_revision_id, "existing_plan_revision_id")
  ]);
}

export function assertPlanRequestV1(value: unknown): asserts value is FlowDeskPlanRequestV1 {
  const result = validatePlanRequestV1(value);
  if (!result.ok) throw new Error(result.errors.join("; "));
}

export function validatePlanResponseV1(value: unknown): ValidationResult {
  if (!isRecord(value)) return invalid("plan response must be an object");
  return combine([
    validateResponseEnvelopeV1(value, "flowdesk.plan.response.v1"),
    validateOpaqueId(value.plan_revision_id, "plan_revision_id"),
    typeof value.delegated_authoring_summary === "string" && value.delegated_authoring_summary.length > 0 && value.delegated_authoring_summary.length <= 500 ? validateNoForbiddenRawPayloads(value.delegated_authoring_summary, "delegated_authoring_summary") : invalid("delegated_authoring_summary is required"),
    validateStringArray(value.required_approvals, "required_approvals", undefined, 20),
    validateGuardPrecheckSummaryV1(value.guard_precheck)
  ]);
}

export function assertPlanResponseV1(value: unknown): asserts value is FlowDeskPlanResponseV1 {
  const result = validatePlanResponseV1(value);
  if (!result.ok) throw new Error(result.errors.join("; "));
}

export function validateRunRequestV1(value: unknown): ValidationResult {
  if (!isRecord(value)) return invalid("run request must be an object");
  return combine([
    validateRequestEnvelope(value, "flowdesk.run.request.v1"),
    value.run_mode === "guarded-dry-run" || value.run_mode === "fake-runtime" ? valid() : invalid("run_mode is invalid for Release 1"),
    validateOpaqueId(value.plan_revision_id, "plan_revision_id"),
    value.step_id === undefined ? valid() : validateOpaqueId(value.step_id, "step_id")
  ]);
}

export function assertRunRequestV1(value: unknown): asserts value is FlowDeskRunRequestV1 {
  const result = validateRunRequestV1(value);
  if (!result.ok) throw new Error(result.errors.join("; "));
}

export function validateRunResponseV1(value: unknown): ValidationResult {
  if (!isRecord(value)) return invalid("run response must be an object");
  return combine([
    validateResponseEnvelopeV1(value, "flowdesk.run.response.v1"),
    validateOpaqueRef(value.run_result_ref, "run_result_ref"),
    validateOpaqueRef(value.verification_summary_ref, "verification_summary_ref"),
    ["none", "quarantined", "promoted", "discarded"].includes(String(value.artifact_disposition)) ? valid() : invalid("artifact_disposition is invalid")
  ]);
}

export function assertRunResponseV1(value: unknown): asserts value is FlowDeskRunResponseV1 {
  const result = validateRunResponseV1(value);
  if (!result.ok) throw new Error(result.errors.join("; "));
}

export function validateStatusRequestV1(value: unknown): ValidationResult {
  if (!isRecord(value)) return invalid("status request must be an object");
  return combine([
    validateRequestEnvelope(value, "flowdesk.status.request.v1"),
    value.detail_level === undefined || isEnumValue(value.detail_level, ["summary", "diagnostic", "debug_refs", "lane_refs"]) ? valid() : invalid("detail_level is invalid")
  ]);
}

export function assertStatusRequestV1(value: unknown): asserts value is FlowDeskStatusRequestV1 {
  const result = validateStatusRequestV1(value);
  if (!result.ok) throw new Error(result.errors.join("; "));
}

export function validateRetryRequestV1(value: unknown): ValidationResult {
  if (!isRecord(value)) return invalid("retry request must be an object");
  return combine([
    validateRequestEnvelope(value, "flowdesk.retry.request.v1"),
    validateOpaqueId(value.attempt_id, "attempt_id"),
    validateNoUnsupportedRetryAuthority(value.retry_reason, "retry_reason"),
    value.new_binding_hint === undefined ? valid() : validateNoUnsupportedRetryAuthority(value.new_binding_hint, "new_binding_hint")
  ]);
}

export function assertRetryRequestV1(value: unknown): asserts value is FlowDeskRetryRequestV1 {
  const result = validateRetryRequestV1(value);
  if (!result.ok) throw new Error(result.errors.join("; "));
}

export function validateRetryResponseV1(value: unknown): ValidationResult {
  if (!isRecord(value)) return invalid("retry response must be an object");
  const actions = Array.isArray(value.safe_next_actions) ? value.safe_next_actions : [];
  const allowedRetryActions = ["/flowdesk-doctor", "/flowdesk-usage", "/flowdesk-status", "/flowdesk-retry", "/flowdesk-export-debug"] as const;
  return combine([
    validateResponseEnvelopeV1(value, "flowdesk.retry.response.v1"),
    validateOpaqueId(value.new_attempt_id, "new_attempt_id"),
    Array.isArray(value.required_guard_checks) ? combine(value.required_guard_checks.map((check, index) => validateGuardCheckV1(check, `required_guard_checks[${index}]`))) : invalid("required_guard_checks must be an array"),
    isEnumValue(value.retry_state, ["planned", "blocked", "diagnostic_only"]) ? valid() : invalid("retry_state is invalid"),
    actions.some((action) => typeof action === "string" && !allowedRetryActions.includes(action as (typeof allowedRetryActions)[number])) ? invalid("retry responses must only suggest diagnostic, usage, status, retry-planning, or debug actions") : valid(),
    value.retry_state !== "planned" && value.status !== "blocked" && value.status !== "diagnostic_only" && value.status !== "degraded" ? invalid("blocked retry planning must remain diagnostic or blocked") : valid(),
    validateNoForbiddenRawPayloads(value, "retry_response")
  ]);
}

export function assertRetryResponseV1(value: unknown): asserts value is FlowDeskRetryResponseV1 {
  const result = validateRetryResponseV1(value);
  if (!result.ok) throw new Error(result.errors.join("; "));
}

export function validateStatusLaneSummaryV1(value: unknown): ValidationResult {
  if (!isRecord(value)) return invalid("status lane summary must be an object");
  return combine([
    rejectUnknownProperties(value, ["lane_id", "task_ref", "lane_class", "state", "failure_class", "safe_next_action", "refs", "invocation_ref_kind", "retry_count", "verdict_status", "workflow_id", "plan_revision_id", "attempt_id", "created_at", "started_at", "updated_at", "completed_at", "event_refs", "audit_refs", "log_ref", "debug_ref"]),
    requireFields(value, ["lane_id", "workflow_id", "plan_revision_id", "task_ref", "lane_class", "state", "created_at", "updated_at", "safe_next_action", "refs", "event_refs", "audit_refs"]),
    validateOpaqueId(value.lane_id, "lane_id"),
    validateOpaqueId(value.workflow_id, "workflow_id"),
    validateOpaqueId(value.plan_revision_id, "plan_revision_id"),
    value.attempt_id === undefined ? valid() : validateOpaqueId(value.attempt_id, "attempt_id"),
    validateOpaqueRef(value.task_ref, "task_ref"),
    isEnumValue(value.lane_class, ["planning_draft", "planning_refine", "planning_review", "research", "documentation", "verification", "diagnostics", "other"]) ? valid() : invalid("lane_class is invalid"),
    isEnumValue(value.state, PERSISTED_LANE_STATES) ? valid() : invalid("lane summary state is invalid or future-gated"),
    value.state === "hard_cancel_proven" ? invalid("Release 1 status lane summaries must not claim hard cancel is proven") : valid(),
    value.failure_class === undefined || isEnumValue(value.failure_class, LANE_FAILURE_CLASSES) ? valid() : invalid("failure_class is invalid"),
    value.invocation_ref_kind === undefined || isEnumValue(value.invocation_ref_kind, LANE_INVOCATION_REF_KINDS) ? valid() : invalid("invocation_ref_kind is invalid"),
    value.retry_count === undefined || (typeof value.retry_count === "number" && Number.isInteger(value.retry_count) && value.retry_count >= 0 && value.retry_count <= 2) ? valid() : invalid("retry_count is invalid"),
    value.verdict_status === undefined || isEnumValue(value.verdict_status, LANE_VERDICT_STATUSES) ? valid() : invalid("verdict_status is invalid"),
    isEnumValue(value.safe_next_action, SAFE_NEXT_ACTIONS) ? valid() : invalid("safe_next_action is invalid"),
    validateStringArray(value.refs, "refs", undefined, 20),
    validateStringArray(value.event_refs, "event_refs", undefined, 20),
    validateStringArray(value.audit_refs, "audit_refs", undefined, 20),
    validateTimestamp(value.created_at, "created_at"),
    value.started_at === undefined ? valid() : validateTimestamp(value.started_at, "started_at"),
    validateTimestamp(value.updated_at, "updated_at"),
    value.completed_at === undefined ? valid() : validateTimestamp(value.completed_at, "completed_at"),
    value.log_ref === undefined ? valid() : validateOpaqueRef(value.log_ref, "log_ref"),
    value.debug_ref === undefined ? valid() : validateOpaqueRef(value.debug_ref, "debug_ref"),
    validateNoForbiddenRawPayloads(value, "status_lane_summary")
  ]);
}

export function assertStatusLaneSummaryV1(value: unknown): asserts value is FlowDeskStatusLaneSummaryV1 {
  const result = validateStatusLaneSummaryV1(value);
  if (!result.ok) throw new Error(result.errors.join("; "));
}

export function validateStatusResponseV1(value: unknown): ValidationResult {
  if (!isRecord(value)) return invalid("status response must be an object");
  const safeActions = Array.isArray(value.safe_next_actions) ? value.safe_next_actions : [];
  return combine([
    validateResponseEnvelopeV1(value, "flowdesk.status.response.v1"),
    isEnumValue(value.workflow_state, WORKFLOW_STATES) ? valid() : invalid("workflow_state is invalid"),
    value.current_step_id === undefined ? valid() : validateOpaqueId(value.current_step_id, "current_step_id"),
    Array.isArray(value.lane_summaries) ? combine(value.lane_summaries.map((summary) => validateStatusLaneSummaryV1(summary))) : invalid("lane_summaries must be an array"),
    validateProviderHealthSummaryV1(value.provider_health_summary),
    value.blocker === undefined ? valid() : validateBlockerSummaryV1(value.blocker),
    value.checkpoint_id === undefined ? valid() : validateOpaqueId(value.checkpoint_id, "checkpoint_id"),
    value.ok === false && safeActions.some((action) => action === "/flowdesk-resume" || action === "/flowdesk-retry") ? invalid("failed status responses must not suggest resume or retry") : valid(),
    validateNoForbiddenRawPayloads(value, "status_response")
  ]);
}

export function assertStatusResponseV1(value: unknown): asserts value is FlowDeskStatusResponseV1 {
  const result = validateStatusResponseV1(value);
  if (!result.ok) throw new Error(result.errors.join("; "));
}

export function validateStatusSummaryArtifactV1(value: unknown): ValidationResult {
  if (!isRecord(value)) return invalid("status summary artifact must be an object");
  return combine([
    validateSchemaArtifactValue("flowdesk.status_summary.v1", value),
    validateOpaqueId(value.workflow_id, "workflow_id"),
    isEnumValue(value.state, WORKFLOW_STATES) ? valid() : invalid("state is invalid"),
    value.current_step_id === undefined ? valid() : validateOpaqueId(value.current_step_id, "current_step_id"),
    value.blocker_summary === undefined ? valid() : validateBlockerSummaryV1(value.blocker_summary, "blocker_summary"),
    validateStringArray(value.lane_summary_refs, "lane_summary_refs", undefined, 20),
    value.usage_summary_ref === undefined ? valid() : validateOpaqueRef(value.usage_summary_ref, "usage_summary_ref"),
    value.provider_health_summary_ref === undefined ? valid() : validateOpaqueRef(value.provider_health_summary_ref, "provider_health_summary_ref"),
    value.checkpoint_id === undefined ? valid() : validateOpaqueId(value.checkpoint_id, "checkpoint_id"),
    validateStringArray(value.safe_next_actions, "safe_next_actions", SAFE_NEXT_ACTIONS, 8),
    validateStringArray(value.audit_refs, "audit_refs", undefined, 20),
    value.debug_ref === undefined ? valid() : validateOpaqueRef(value.debug_ref, "debug_ref")
  ]);
}

export function assertStatusSummaryArtifactV1(value: unknown): asserts value is FlowDeskStatusSummaryArtifactV1 {
  const result = validateStatusSummaryArtifactV1(value);
  if (!result.ok) throw new Error(result.errors.join("; "));
}

export function validateWorkflowStepV1(value: unknown, label = "workflow step"): ValidationResult {
  if (!isRecord(value)) return invalid(`${label} must be an object`);
  return combine([
    rejectUnknownProperties(value, ["step_id", "title", "state", "lane_class", "requires_guard", "required_fresh_checks"]),
    requireFields(value, ["step_id", "title", "state", "requires_guard", "required_fresh_checks"]),
    validateOpaqueId(value.step_id, "step_id"),
    typeof value.title === "string" && value.title.length > 0 && value.title.length <= 160 ? validateNoForbiddenRawPayloads(value.title, "title") : invalid("title is invalid"),
    isEnumValue(value.state, WORKFLOW_STATES) ? valid() : invalid("step state is invalid"),
    value.lane_class === undefined || isEnumValue(value.lane_class, ["planning_draft", "planning_refine", "planning_review", "research", "documentation", "verification", "diagnostics", "other"]) ? valid() : invalid("lane_class is invalid"),
    typeof value.requires_guard === "boolean" ? valid() : invalid("requires_guard must be boolean"),
    Array.isArray(value.required_fresh_checks) ? combine(value.required_fresh_checks.map((check, index) => validateFreshCheckV1(check, `required_fresh_checks[${index}]`))) : invalid("required_fresh_checks must be an array"),
    validateNoForbiddenRawPayloads(value, "workflow_step")
  ]);
}

export function validateWorkflowTaxonomyV1(value: unknown): ValidationResult {
  if (!isRecord(value)) return invalid("taxonomy must be an object");
  return combine([
    rejectUnknownProperties(value, ["primary_category", "difficulty_drivers", "coupling_scope", "algorithmic_hardness", "architecture_hardness", "migration_state_hardness", "domain_uncertainty", "verification_hardness", "operational_risk", "policy_professional_boundary"]),
    requireFields(value, ["primary_category", "difficulty_drivers", "coupling_scope", "algorithmic_hardness", "architecture_hardness", "migration_state_hardness", "domain_uncertainty", "verification_hardness", "operational_risk", "policy_professional_boundary"]),
    isEnumValue(value.primary_category, ["coding", "debugging", "refactor", "test", "documentation", "research", "planning", "review", "security", "data", "ops", "design", "specialist_reference"]) ? valid() : invalid("taxonomy.primary_category is invalid"),
    validateStringArray(value.difficulty_drivers, "taxonomy.difficulty_drivers", undefined, 8),
    isEnumValue(value.coupling_scope, ["single_file", "few_files", "module", "cross_module", "repo_wide", "multi_repo", "external_system"]) ? valid() : invalid("taxonomy.coupling_scope is invalid"),
    isEnumValue(value.algorithmic_hardness, ["none", "low", "moderate", "high", "research_grade"]) ? valid() : invalid("taxonomy.algorithmic_hardness is invalid"),
    isEnumValue(value.architecture_hardness, ["none", "low", "moderate", "high", "system_boundary"]) ? valid() : invalid("taxonomy.architecture_hardness is invalid"),
    isEnumValue(value.migration_state_hardness, ["none", "low", "moderate", "high", "irreversible"]) ? valid() : invalid("taxonomy.migration_state_hardness is invalid"),
    isEnumValue(value.domain_uncertainty, ["none", "low", "moderate", "high", "expert_review_required"]) ? valid() : invalid("taxonomy.domain_uncertainty is invalid"),
    isEnumValue(value.verification_hardness, ["none", "low", "moderate", "high", "external_lab"]) ? valid() : invalid("taxonomy.verification_hardness is invalid"),
    isEnumValue(value.operational_risk, ["none", "low", "moderate", "high", "critical"]) ? valid() : invalid("taxonomy.operational_risk is invalid"),
    isEnumValue(value.policy_professional_boundary, ["ordinary", "sensitive", "restricted", "specialist_reference_only", "professional_human_required"]) ? valid() : invalid("taxonomy.policy_professional_boundary is invalid"),
    validateNoForbiddenRawPayloads(value, "taxonomy")
  ]);
}

export function assertWorkflowTaxonomyV1(value: unknown): asserts value is WorkflowTaxonomyV1 {
  const result = validateWorkflowTaxonomyV1(value);
  if (!result.ok) throw new Error(result.errors.join("; "));
}

export function assertWorkflowStepV1(value: unknown): asserts value is FlowDeskWorkflowStepV1 {
  const result = validateWorkflowStepV1(value);
  if (!result.ok) throw new Error(result.errors.join("; "));
}

export function validateWorkflowPlanV1(value: unknown): ValidationResult {
  if (!isRecord(value)) return invalid("workflow plan must be an object");
  return combine([
    validateSchemaArtifactValue("flowdesk.workflow_plan.v1", value),
    validateOpaqueId(value.plan_revision_id, "plan_revision_id"),
    validateOpaqueId(value.workflow_id, "workflow_id"),
    validateTimestamp(value.created_at, "created_at"),
    validateWorkflowTaxonomyV1(value.taxonomy),
    Array.isArray(value.steps) && value.steps.length > 0 ? combine(value.steps.map((step, index) => validateWorkflowStepV1(step, `steps[${index}]`))) : invalid("steps must be a non-empty array"),
    Array.isArray(value.required_approvals) ? combine(value.required_approvals.map((check, index) => validateGuardCheckV1(check, `required_approvals[${index}]`))) : invalid("required_approvals must be an array"),
    typeof value.verification_summary === "string" && value.verification_summary.length > 0 && value.verification_summary.length <= 500 ? validateNoForbiddenRawPayloads(value.verification_summary, "verification_summary") : invalid("verification_summary is invalid")
  ]);
}

export function assertWorkflowPlanV1(value: unknown): asserts value is FlowDeskWorkflowPlanV1 {
  const result = validateWorkflowPlanV1(value);
  if (!result.ok) throw new Error(result.errors.join("; "));
}

export function validatePlanSummaryArtifactV1(value: unknown): ValidationResult {
  if (!isRecord(value)) return invalid("plan summary artifact must be an object");
  return combine([
    validateSchemaArtifactValue("flowdesk.plan_summary.v1", value),
    validateOpaqueId(value.plan_revision_id, "plan_revision_id"),
    validateOpaqueId(value.workflow_id, "workflow_id"),
    validateTimestamp(value.created_at, "created_at"),
    typeof value.goal_summary === "string" && value.goal_summary.length > 0 && value.goal_summary.length <= 500 ? validateNoForbiddenRawPayloads(value.goal_summary, "goal_summary") : invalid("goal_summary is invalid"),
    typeof value.scope_summary === "string" && value.scope_summary.length > 0 && value.scope_summary.length <= 500 ? validateNoForbiddenRawPayloads(value.scope_summary, "scope_summary") : invalid("scope_summary is invalid"),
    isEnumValue(value.risk_tier, ["low", "medium", "high", "blocked"]) ? valid() : invalid("risk_tier is invalid"),
    Array.isArray(value.required_approvals) ? combine(value.required_approvals.map((check, index) => validateGuardCheckV1(check, `required_approvals[${index}]`))) : invalid("required_approvals must be an array"),
    validateStringArray(value.step_summary_refs, "step_summary_refs", undefined, 20),
    typeof value.verification_summary === "string" && value.verification_summary.length > 0 && value.verification_summary.length <= 500 ? validateNoForbiddenRawPayloads(value.verification_summary, "verification_summary") : invalid("verification_summary is invalid")
  ]);
}

export function assertPlanSummaryArtifactV1(value: unknown): asserts value is FlowDeskPlanSummaryArtifactV1 {
  const result = validatePlanSummaryArtifactV1(value);
  if (!result.ok) throw new Error(result.errors.join("; "));
}

export function validateLaneSummaryArtifactV1(value: unknown): ValidationResult {
  if (!isRecord(value)) return invalid("lane summary artifact must be an object");
  const { schema_version: _schemaVersion, ...summary } = value;
  return combine([
    validateSchemaArtifactValue("flowdesk.lane_summary.v1", value),
    validateStatusLaneSummaryV1(summary),
    value.schema_version === "flowdesk.lane_summary.v1" ? valid() : invalid("lane summary schema_version is invalid")
  ]);
}

export function assertLaneSummaryArtifactV1(value: unknown): asserts value is FlowDeskLaneSummaryArtifactV1 {
  const result = validateLaneSummaryArtifactV1(value);
  if (!result.ok) throw new Error(result.errors.join("; "));
}

export function validateAbortResponseV1(value: unknown): ValidationResult {
  if (!isRecord(value)) return invalid("abort response must be an object");
  return combine([
    validateResponseEnvelopeV1(value, "flowdesk.abort.response.v1"),
    ["cancel_requested", "cancel_observed", "cancel_failed"].includes(String(value.cancellation_state)) ? valid() : invalid("cancellation_state is invalid for Release 1 abort response"),
    validateStringArray(value.remaining_safe_actions, "remaining_safe_actions", SAFE_NEXT_ACTIONS, 8)
  ]);
}

export function assertAbortResponseV1(value: unknown): asserts value is FlowDeskAbortResponseV1 {
  const result = validateAbortResponseV1(value);
  if (!result.ok) throw new Error(result.errors.join("; "));
}

export function validateUsageRequestV1(value: unknown): ValidationResult {
  if (!isRecord(value)) return invalid("usage request must be an object");
  return combine([
    validateRequestEnvelope(value, "flowdesk.usage.request.v1"),
    validateProviderFamily(value.provider_family),
    typeof value.refresh === "boolean" ? valid() : invalid("refresh must be boolean")
  ]);
}

export function assertUsageRequestV1(value: unknown): asserts value is FlowDeskUsageRequestV1 {
  const result = validateUsageRequestV1(value);
  if (!result.ok) throw new Error(result.errors.join("; "));
}

export function validateUsageResponseV1(value: unknown): ValidationResult {
  if (!isRecord(value)) return invalid("usage response must be an object");
  const uncertainty = Array.isArray(value.uncertainty_flags) ? value.uncertainty_flags : [];
  const failClosedFlags = ["unknown", "stale", "refused", "shared_limit_suspected", "fallback_derived", "model_generated"];
  return combine([
    validateResponseEnvelopeV1(value, "flowdesk.usage.response.v1"),
    validateOpaqueRef(value.usage_snapshot_ref, "usage_snapshot_ref"),
    value.provider_health_snapshot_ref === undefined ? valid() : validateOpaqueRef(value.provider_health_snapshot_ref, "provider_health_snapshot_ref"),
    isEnumValue(value.freshness, ["fresh", "stale", "unknown"]) ? valid() : invalid("freshness is invalid"),
    isEnumValue(value.dispatchability, ["dispatchable", "diagnostic_only", "non_dispatchable"]) ? valid() : invalid("dispatchability is invalid"),
    validateStringArray(value.uncertainty_flags, "uncertainty_flags", USAGE_UNCERTAINTY_FLAGS),
    value.freshness !== "fresh" && value.dispatchability === "dispatchable" ? invalid("non-fresh usage response must not be dispatchable") : valid(),
    uncertainty.some((flag) => failClosedFlags.includes(String(flag))) && value.dispatchability !== "non_dispatchable" ? invalid("unsafe usage response uncertainty must be non_dispatchable") : valid()
  ]);
}

export function assertUsageResponseV1(value: unknown): asserts value is FlowDeskUsageResponseV1 {
  const result = validateUsageResponseV1(value);
  if (!result.ok) throw new Error(result.errors.join("; "));
}

export function validateUsageSnapshotV1(value: unknown): ValidationResult {
  if (!isRecord(value)) return invalid("usage snapshot must be an object");
  const uncertainty = Array.isArray(value.uncertainty_flags) ? value.uncertainty_flags : [];
  const failClosedFlags = ["unknown", "stale", "refused", "shared_limit_suspected", "fallback_derived", "model_generated"];
  return combine([
    validateSchemaArtifactValue("flowdesk.usage_snapshot.v1", value),
    validateOpaqueId(value.snapshot_id, "snapshot_id"),
    validateProviderFamily(value.provider_family),
    typeof value.model_family === "string" && value.model_family.length > 0 && value.model_family.length <= 128 ? validateNoForbiddenRawPayloads(value.model_family, "model_family") : invalid("model_family is required"),
    isEnumValue(value.freshness, ["fresh", "stale", "unknown"]) ? valid() : invalid("freshness is invalid"),
    typeof value.freshness_ttl === "number" && value.freshness_ttl >= 0 ? valid() : invalid("freshness_ttl is invalid"),
    typeof value.reset_time === "string" && value.reset_time.length > 0 ? validateNoForbiddenRawPayloads(value.reset_time, "reset_time") : invalid("reset_time is required"),
    typeof value.reset_bucket === "string" && value.reset_bucket.length > 0 ? validateNoForbiddenRawPayloads(value.reset_bucket, "reset_bucket") : invalid("reset_bucket is required"),
    isEnumValue(value.dispatchability, ["dispatchable", "diagnostic_only", "non_dispatchable"]) ? valid() : invalid("dispatchability is invalid"),
    validateStringArray(value.uncertainty_flags, "uncertainty_flags", USAGE_UNCERTAINTY_FLAGS),
    uncertainty.some((flag) => failClosedFlags.includes(String(flag))) && value.dispatchability !== "non_dispatchable" ? invalid("unsafe usage uncertainty must be non_dispatchable") : valid(),
    value.freshness !== "fresh" && value.dispatchability === "dispatchable" ? invalid("non-fresh usage must not be dispatchable") : valid(),
    validateOpaqueRef(value.source_ref, "source_ref")
  ]);
}

export function assertUsageSnapshotV1(value: unknown): asserts value is FlowDeskUsageSnapshotV1 {
  const result = validateUsageSnapshotV1(value);
  if (!result.ok) throw new Error(result.errors.join("; "));
}

export function validateProviderHealthSnapshotV1(value: unknown): ValidationResult {
  if (!isRecord(value)) return invalid("provider health snapshot must be an object");
  const remediation = typeof value.safe_remediation === "string" ? value.safe_remediation : "";
  return combine([
    validateSchemaArtifactValue("flowdesk.provider_health_snapshot.v1", value),
    validateOpaqueId(value.snapshot_id, "snapshot_id"),
    validateProviderFamily(value.provider_family),
    value.model_family === undefined ? valid() : typeof value.model_family === "string" && value.model_family.length <= 128 ? validateNoForbiddenRawPayloads(value.model_family, "model_family") : invalid("model_family must be a bounded string"),
    typeof value.observed_at === "string" && value.observed_at.length > 0 ? valid() : invalid("observed_at is required"),
    isEnumValue(value.freshness, ["fresh", "stale", "unknown"]) ? valid() : invalid("freshness is invalid"),
    typeof value.freshness_ttl === "number" && value.freshness_ttl >= 0 ? valid() : invalid("freshness_ttl is invalid"),
    isEnumValue(value.source_surface, ["opencode_config", "plugin_event", "doctor_probe", "usage_collector", "provider_smoke_test", "manual_report", "unknown"]) ? valid() : invalid("source_surface is invalid"),
    isEnumValue(value.availability_state, ["healthy", "degraded", "unavailable", "unknown"]) ? valid() : invalid("availability_state is invalid"),
    isEnumValue(value.failure_class, PROVIDER_FAILURE_CLASSES) ? valid() : invalid("failure_class is invalid"),
    isEnumValue(value.dispatchability, ["dispatchable", "diagnostic_only", "non_dispatchable"]) ? valid() : invalid("dispatchability is invalid"),
    value.freshness !== "fresh" && value.dispatchability === "dispatchable" ? invalid("non-fresh provider health must not be dispatchable") : valid(),
    ["degraded", "unavailable", "unknown"].includes(String(value.availability_state)) && value.dispatchability === "dispatchable" ? invalid("degraded, unavailable, or unknown provider health must not be dispatchable") : valid(),
    value.failure_class !== "none" && value.dispatchability === "dispatchable" ? invalid("provider failure classes must not be dispatchable") : valid(),
    validateOpaqueRef(value.source_ref, "source_ref"),
    /\b(?:fallback|reselect|reselection)\b/i.test(remediation) ? invalid("provider health remediation must not suggest fallback or reselection") : valid(),
    typeof value.safe_remediation === "string" && value.safe_remediation.length > 0 && value.safe_remediation.length <= 500 ? validateNoForbiddenRawPayloads(value.safe_remediation, "safe_remediation") : invalid("safe_remediation is required")
  ]);
}

export function assertProviderHealthSnapshotV1(value: unknown): asserts value is FlowDeskProviderHealthSnapshotV1 {
  const result = validateProviderHealthSnapshotV1(value);
  if (!result.ok) throw new Error(result.errors.join("; "));
}

export function validateGuardRequestV1(value: unknown): ValidationResult {
  if (!isRecord(value)) return invalid("guard request must be an object");
  const needsDispatchEvidence = value.requested_operation === "real-opencode-dispatch";
  return combine([
    validateSchemaArtifactValue("flowdesk.guard_request.v1", value),
    validateOpaqueId(value.guard_request_id, "guard_request_id"),
    validateOpaqueId(value.workflow_id, "workflow_id"),
    isEnumValue(value.requested_operation, ["guarded-dry-run", "fake-runtime", "command-steering", "real-opencode-dispatch", "non-dispatch-permission"]) ? valid() : invalid("requested_operation is invalid"),
    needsDispatchEvidence && value.usage_snapshot_ref === undefined ? invalid("real dispatch requires usage_snapshot_ref") : valid(),
    needsDispatchEvidence && value.provider_health_snapshot_ref === undefined ? invalid("real dispatch requires provider_health_snapshot_ref") : valid(),
    value.non_dispatch_permission_class === undefined ? valid() : isEnumValue(value.non_dispatch_permission_class, NON_DISPATCH_PERMISSION_CLASSES) ? valid() : invalid("non_dispatch_permission_class is invalid")
  ]);
}

export function assertGuardRequestV1(value: unknown): asserts value is GuardRequestV1 {
  const result = validateGuardRequestV1(value);
  if (!result.ok) throw new Error(result.errors.join("; "));
}

export function validateGuardApprovedDispatchV1(value: unknown): ValidationResult {
  if (!isRecord(value)) return invalid("guard dispatch approval must be an object");
  const family = value.provider_family as ProviderFamily | undefined;
  const modelProvider = typeof value.provider_qualified_model_id === "string" ? value.provider_qualified_model_id.split("/")[0] : undefined;
  return combine([
    validateSchemaArtifactValue("flowdesk.guard_approved_dispatch.v1", value),
    validateOpaqueId(value.guard_decision_id, "guard_decision_id"),
    validateOpaqueId(value.workflow_id, "workflow_id"),
    validateOpaqueId(value.step_id, "step_id"),
    validateOpaqueId(value.attempt_id, "attempt_id"),
    validateProviderFamily(family),
    family === "unknown" || family === "all" ? invalid("dispatch provider_family must be concrete") : valid(),
    validateProviderQualifiedModelId(value.provider_qualified_model_id),
    typeof family === "string" && modelProvider !== undefined && modelProvider !== family ? invalid("provider_qualified_model_id provider must match provider_family") : valid(),
    validateOpaqueRef(value.usage_snapshot_ref, "usage_snapshot_ref"),
    validateOpaqueRef(value.provider_health_snapshot_ref, "provider_health_snapshot_ref"),
    validateOpaqueRef(value.runtime_capability_ref, "runtime_capability_ref"),
    validateOpaqueRef(value.pre_dispatch_audit_ref, "pre_dispatch_audit_ref"),
    typeof value.expires_at === "string" && value.expires_at.length > 0 ? valid() : invalid("expires_at is required")
  ]);
}

export function assertGuardApprovedDispatchV1(value: unknown): asserts value is GuardApprovedDispatchV1 {
  const result = validateGuardApprovedDispatchV1(value);
  if (!result.ok) throw new Error(result.errors.join("; "));
}

function validateFutureTimestamp(value: unknown, label: string, now?: number): ValidationResult {
  const timestampResult = validateTimestamp(value, label);
  if (!timestampResult.ok || now === undefined) return timestampResult;
  const parsed = Date.parse(String(value));
  return Number.isFinite(parsed) && parsed > now ? valid() : invalid(`${label} is expired`);
}

function validateProviderAndModelBinding(value: { provider_family?: unknown; provider_qualified_model_id?: unknown }, label: string, options?: ManagedDispatchBetaEvidenceValidationOptionsV1): ValidationResult {
  const family = value.provider_family as ProviderFamily | undefined;
  const modelProvider = typeof value.provider_qualified_model_id === "string" ? value.provider_qualified_model_id.split("/")[0] : undefined;
  return combine([
    validateProviderFamily(family),
    family === "unknown" || family === "all" ? invalid(`${label}.provider_family must be concrete`) : valid(),
    validateProviderQualifiedModelId(value.provider_qualified_model_id),
    typeof family === "string" && modelProvider !== undefined && modelProvider !== family ? invalid(`${label}.provider_qualified_model_id provider mismatch`) : valid(),
    options?.expectedProviderFamily !== undefined && family !== options.expectedProviderFamily ? invalid(`${label}.provider_family mismatch`) : valid(),
    options?.expectedProviderQualifiedModelId !== undefined && value.provider_qualified_model_id !== options.expectedProviderQualifiedModelId ? invalid(`${label}.provider_qualified_model_id mismatch`) : valid()
  ]);
}

export function validateManagedDispatchBetaPolicyV1(value: unknown, options?: ManagedDispatchBetaEvidenceValidationOptionsV1): ValidationResult {
  if (!isRecord(value)) return invalid("managed dispatch beta policy must be an object");
  return combine([
    rejectUnknownProperties(value, ["release_mode", "policy_mode", "config_hash", "policy_pack_hashes", "fallback_reselection_mode", "hard_chat_authority", "require_quarantine_on_ambiguity", "audit_ref"]),
    requireFields(value, ["release_mode", "policy_mode", "config_hash", "policy_pack_hashes", "fallback_reselection_mode", "hard_chat_authority", "require_quarantine_on_ambiguity", "audit_ref"]),
    value.release_mode === "managed_dispatch_beta" ? valid() : invalid("managed dispatch beta policy release_mode is invalid"),
    value.policy_mode === "managed_dispatch_beta" ? valid() : invalid("managed dispatch beta policy mode is invalid"),
    validateOpaqueRef(value.config_hash, "config_hash"),
    options?.expectedConfigHash !== undefined && value.config_hash !== options.expectedConfigHash ? invalid("config_hash mismatch") : valid(),
    validateOpaqueRefArray(value.policy_pack_hashes, "policy_pack_hashes"),
    options?.expectedPolicyPackHashes !== undefined && JSON.stringify(value.policy_pack_hashes) !== JSON.stringify([...options.expectedPolicyPackHashes]) ? invalid("policy_pack_hashes mismatch") : valid(),
    value.fallback_reselection_mode === "disabled" ? valid() : invalid("managed dispatch beta fallback must be disabled"),
    value.hard_chat_authority === "disabled" ? valid() : invalid("managed dispatch beta hard chat authority must be disabled"),
    value.require_quarantine_on_ambiguity === true ? valid() : invalid("managed dispatch beta must quarantine on ambiguity"),
    validateOpaqueRef(value.audit_ref, "audit_ref")
  ]);
}

export function validateManagedDispatchBetaApprovalFreshnessV1(value: unknown, options?: ManagedDispatchBetaEvidenceValidationOptionsV1): ValidationResult {
  const approvalResult = validateGuardApprovedDispatchV1(value);
  if (!approvalResult.ok || !isRecord(value)) return approvalResult;
  return combine([
    validateFutureTimestamp(value.expires_at, "guard dispatch approval expires_at", options?.now),
    options?.expectedWorkflowId !== undefined && value.workflow_id !== options.expectedWorkflowId ? invalid("guard approval workflow_id mismatch") : valid(),
    options?.expectedStepId !== undefined && value.step_id !== options.expectedStepId ? invalid("guard approval step_id mismatch") : valid(),
    options?.expectedAttemptId !== undefined && value.attempt_id !== options.expectedAttemptId ? invalid("guard approval attempt_id mismatch") : valid(),
    validateProviderAndModelBinding(value, "guard approval", options),
    options?.expectedUsageSnapshotRef !== undefined && value.usage_snapshot_ref !== options.expectedUsageSnapshotRef ? invalid("guard approval usage_snapshot_ref mismatch") : valid(),
    options?.expectedProviderHealthSnapshotRef !== undefined && value.provider_health_snapshot_ref !== options.expectedProviderHealthSnapshotRef ? invalid("guard approval provider_health_snapshot_ref mismatch") : valid(),
    options?.expectedRuntimeCapabilityRef !== undefined && value.runtime_capability_ref !== options.expectedRuntimeCapabilityRef ? invalid("guard approval runtime_capability_ref mismatch") : valid(),
    options?.expectedPreDispatchAuditRef !== undefined && value.pre_dispatch_audit_ref !== options.expectedPreDispatchAuditRef ? invalid("guard approval pre_dispatch_audit_ref mismatch") : valid()
  ]);
}

export function validateManagedDispatchBetaBindingEvidenceV1(value: unknown, options?: ManagedDispatchBetaEvidenceValidationOptionsV1): ValidationResult {
  if (!isRecord(value)) return invalid("managed dispatch beta binding evidence must be an object");
  return combine([
    rejectUnknownProperties(value, ["schema_version", "binding_ref", "workflow_id", "step_id", "attempt_id", "provider_family", "provider_qualified_model_id", "source", "trusted", "created_at", "expires_at"]),
    requireFields(value, ["schema_version", "binding_ref", "workflow_id", "step_id", "attempt_id", "provider_family", "provider_qualified_model_id", "source", "trusted", "created_at", "expires_at"]),
    value.schema_version === "flowdesk.managed_dispatch_beta.binding_evidence.v1" ? valid() : invalid("binding evidence schema_version is invalid"),
    validateOpaqueRef(value.binding_ref, "binding_ref"),
    validateOpaqueId(value.workflow_id, "workflow_id"),
    validateOpaqueId(value.step_id, "step_id"),
    validateOpaqueId(value.attempt_id, "attempt_id"),
    options?.expectedWorkflowId !== undefined && value.workflow_id !== options.expectedWorkflowId ? invalid("binding evidence workflow_id mismatch") : valid(),
    options?.expectedStepId !== undefined && value.step_id !== options.expectedStepId ? invalid("binding evidence step_id mismatch") : valid(),
    options?.expectedAttemptId !== undefined && value.attempt_id !== options.expectedAttemptId ? invalid("binding evidence attempt_id mismatch") : valid(),
    validateProviderAndModelBinding(value, "binding evidence", options),
    value.source === "guard_approved_dispatch" ? valid() : invalid("binding evidence source is untrusted"),
    value.trusted === true ? valid() : invalid("binding evidence must be trusted"),
    validateTimestamp(value.created_at, "binding evidence created_at"),
    validateFutureTimestamp(value.expires_at, "binding evidence expires_at", options?.now)
  ]);
}

export function validateManagedDispatchBetaUsageEvidenceV1(value: unknown, options?: ManagedDispatchBetaEvidenceValidationOptionsV1): ValidationResult {
  const result = validateUsageSnapshotV1(value);
  if (!result.ok || !isRecord(value)) return result;
  const uncertainty = Array.isArray(value.uncertainty_flags) ? value.uncertainty_flags : [];
  const ttlMinutes = typeof value.freshness_ttl === "number" ? value.freshness_ttl : Number.NaN;
  return combine([
    value.freshness === "fresh" ? valid() : invalid("managed dispatch beta usage must be fresh"),
    ttlMinutes > 0 ? valid() : invalid("managed dispatch beta usage freshness_ttl must be positive"),
    value.reset_time !== "unknown" ? valid() : invalid("managed dispatch beta usage requires provider-native reset_time evidence"),
    value.reset_bucket !== "unknown" ? valid() : invalid("managed dispatch beta usage requires provider-native reset_bucket evidence"),
    value.dispatchability === "dispatchable" ? valid() : invalid("managed dispatch beta usage must be dispatchable"),
    uncertainty.length === 0 ? valid() : invalid("managed dispatch beta usage uncertainty is ambiguous"),
    options?.expectedProviderFamily !== undefined && value.provider_family !== options.expectedProviderFamily ? invalid("usage provider_family mismatch") : valid(),
    options?.expectedModelFamily !== undefined && value.model_family !== options.expectedModelFamily ? invalid("usage model_family mismatch") : valid()
  ]);
}

export function validateManagedDispatchBetaUsageAuthorityEvidenceV1(value: unknown, usage: FlowDeskUsageSnapshotV1, options?: ManagedDispatchBetaEvidenceValidationOptionsV1): ValidationResult {
  if (!isRecord(value)) return invalid("managed dispatch beta usage authority evidence must be an object");
  const authority = value as Partial<FlowDeskManagedDispatchBetaUsageAuthorityEvidenceV1>;
  const authorityProviderFamily = value.provider_family as ProviderFamily | undefined;
  return combine([
    rejectUnknownProperties(value, ["schema_version", "authority_ref", "usage_snapshot_ref", "provider_family", "provider_qualified_model_id", "model_family", "source_kind", "source_version_ref", "auth_profile_ref", "auth_evidence_ref", "credential_scope_ref", "account_boundary_ref", "quota_evidence_ref", "usage_acquired", "reset_time", "reset_bucket", "source_ref", "conformance_ref", "redacted_evidence_refs", "trusted", "observed_at", "expires_at"]),
    requireFields(value, ["schema_version", "authority_ref", "usage_snapshot_ref", "provider_family", "provider_qualified_model_id", "model_family", "source_kind", "source_version_ref", "auth_profile_ref", "auth_evidence_ref", "credential_scope_ref", "account_boundary_ref", "quota_evidence_ref", "usage_acquired", "reset_time", "reset_bucket", "source_ref", "conformance_ref", "redacted_evidence_refs", "trusted", "observed_at", "expires_at"]),
    value.schema_version === "flowdesk.managed_dispatch_beta.usage_authority_evidence.v1" ? valid() : invalid("usage authority evidence schema_version is invalid"),
    validateOpaqueRef(value.authority_ref, "authority_ref"),
    validateOpaqueRef(value.usage_snapshot_ref, "usage_snapshot_ref"),
    value.usage_snapshot_ref === usage.snapshot_id ? valid() : invalid("usage authority usage_snapshot_ref mismatch"),
    validateProviderFamily(authorityProviderFamily),
    authorityProviderFamily === "unknown" || authorityProviderFamily === "all" ? invalid("usage authority provider_family must be concrete") : valid(),
    options?.expectedProviderFamily !== undefined && authorityProviderFamily !== options.expectedProviderFamily ? invalid("usage authority provider_family mismatch") : valid(),
    authorityProviderFamily === usage.provider_family ? valid() : invalid("usage authority usage provider_family mismatch"),
    validateConcreteProviderQualifiedModelId(value.provider_qualified_model_id, "usage authority provider_qualified_model_id"),
    options?.expectedProviderQualifiedModelId !== undefined && value.provider_qualified_model_id !== options.expectedProviderQualifiedModelId ? invalid("usage authority provider_qualified_model_id mismatch") : valid(),
    typeof authority.model_family === "string" && authority.model_family.length > 0 && authority.model_family.length <= 120 ? validateNoForbiddenRawPayloads(authority.model_family, "usage authority model_family") : invalid("usage authority model_family is required"),
    authority.model_family === usage.model_family ? valid() : invalid("usage authority model_family mismatch"),
    options?.expectedModelFamily !== undefined && authority.model_family !== options.expectedModelFamily ? invalid("usage authority expected model_family mismatch") : valid(),
    isEnumValue(value.source_kind, ["provider_native", "dex_conductor", "openusage"]) ? valid() : invalid("usage authority source_kind is invalid"),
    validateOpaqueRef(value.source_version_ref, "source_version_ref"),
    validateOpaqueRef(value.auth_profile_ref, "auth_profile_ref"),
    options?.expectedAuthProfileRef !== undefined && value.auth_profile_ref !== options.expectedAuthProfileRef ? invalid("usage authority auth_profile_ref mismatch") : valid(),
    validateOpaqueRef(value.auth_evidence_ref, "auth_evidence_ref"),
    validateOpaqueRef(value.credential_scope_ref, "credential_scope_ref"),
    options?.expectedCredentialScopeRef !== undefined && value.credential_scope_ref !== options.expectedCredentialScopeRef ? invalid("usage authority credential_scope_ref mismatch") : valid(),
    validateOpaqueRef(value.account_boundary_ref, "account_boundary_ref"),
    options?.expectedAccountBoundaryRef !== undefined && value.account_boundary_ref !== options.expectedAccountBoundaryRef ? invalid("usage authority account_boundary_ref mismatch") : valid(),
    validateOpaqueRef(value.quota_evidence_ref, "quota_evidence_ref"),
    value.usage_acquired === true ? valid() : invalid("usage authority requires actual usage acquisition"),
    validateTimestamp(value.reset_time, "usage authority reset_time"),
    value.reset_time === usage.reset_time ? valid() : invalid("usage authority reset_time mismatch"),
    typeof authority.reset_bucket === "string" && authority.reset_bucket.length > 0 && authority.reset_bucket !== "unknown" ? validateNoForbiddenRawPayloads(authority.reset_bucket, "usage authority reset_bucket") : invalid("usage authority reset_bucket is required"),
    authority.reset_bucket === usage.reset_bucket ? valid() : invalid("usage authority reset_bucket mismatch"),
    validateOpaqueRef(value.source_ref, "source_ref"),
    value.source_ref === usage.source_ref ? valid() : invalid("usage authority source_ref mismatch"),
    validateOpaqueRef(value.conformance_ref, "usage authority conformance_ref"),
    validateOpaqueRefArray(value.redacted_evidence_refs, "usage authority redacted_evidence_refs", 20),
    Array.isArray(value.redacted_evidence_refs) && value.redacted_evidence_refs.length > 0 ? valid() : invalid("usage authority redacted_evidence_refs are required"),
    value.trusted === true ? valid() : invalid("usage authority evidence must be trusted"),
    validateTimestamp(value.observed_at, "usage authority observed_at"),
    validateFutureTimestamp(value.expires_at, "usage authority expires_at", options?.now)
  ]);
}

export function validateManagedDispatchBetaProviderHealthEvidenceV1(value: unknown, options?: ManagedDispatchBetaEvidenceValidationOptionsV1): ValidationResult {
  const result = validateProviderHealthSnapshotV1(value);
  if (!result.ok || !isRecord(value)) return result;
  const observedAt = typeof value.observed_at === "string" ? Date.parse(value.observed_at) : Number.NaN;
  const ttlMinutes = typeof value.freshness_ttl === "number" ? value.freshness_ttl : Number.NaN;
  const freshUntil = observedAt + ttlMinutes * 60_000;
  return combine([
    value.freshness === "fresh" ? valid() : invalid("managed dispatch beta provider health must be fresh"),
    ttlMinutes > 0 ? valid() : invalid("managed dispatch beta provider health freshness_ttl must be positive"),
    options?.now !== undefined && (!Number.isFinite(freshUntil) || freshUntil <= options.now) ? invalid("managed dispatch beta provider health is stale") : valid(),
    value.availability_state === "healthy" ? valid() : invalid("managed dispatch beta provider health must be healthy"),
    value.failure_class === "none" ? valid() : invalid("managed dispatch beta provider health failure class must be none"),
    value.dispatchability === "dispatchable" ? valid() : invalid("managed dispatch beta provider health must be dispatchable"),
    value.source_surface === "provider_smoke_test" || value.source_surface === "usage_collector" || value.source_surface === "plugin_event" ? valid() : invalid("managed dispatch beta provider health requires OpenCode-native or provider-native evidence"),
    options?.expectedProviderFamily !== undefined && value.provider_family !== options.expectedProviderFamily ? invalid("provider health provider_family mismatch") : valid()
  ]);
}

export function validateManagedDispatchBetaRuntimeEchoEvidenceV1(value: unknown, conformanceMetadata: unknown, options?: ManagedDispatchBetaEvidenceValidationOptionsV1): ValidationResult {
  if (!isRecord(value)) return invalid("managed dispatch beta runtime echo evidence must be an object");
  const conformanceResult = validateConformanceRuntimeMetadataV1(conformanceMetadata);
  const conformanceRecord = isRecord(conformanceMetadata) ? conformanceMetadata : {};
  return combine([
    rejectUnknownProperties(value, ["schema_version", "runtime_echo_ref", "workflow_id", "step_id", "attempt_id", "provider_family", "provider_qualified_model_id", "runtime_capability_ref", "conformance_ref", "runtime_echo_mode", "trusted", "observed_at", "expires_at"]),
    requireFields(value, ["schema_version", "runtime_echo_ref", "workflow_id", "step_id", "attempt_id", "provider_family", "provider_qualified_model_id", "runtime_capability_ref", "conformance_ref", "runtime_echo_mode", "trusted", "observed_at", "expires_at"]),
    value.schema_version === "flowdesk.managed_dispatch_beta.runtime_echo_evidence.v1" ? valid() : invalid("runtime echo evidence schema_version is invalid"),
    validateOpaqueRef(value.runtime_echo_ref, "runtime_echo_ref"),
    validateOpaqueId(value.workflow_id, "workflow_id"),
    validateOpaqueId(value.step_id, "step_id"),
    validateOpaqueId(value.attempt_id, "attempt_id"),
    options?.expectedWorkflowId !== undefined && value.workflow_id !== options.expectedWorkflowId ? invalid("runtime echo evidence workflow_id mismatch") : valid(),
    options?.expectedStepId !== undefined && value.step_id !== options.expectedStepId ? invalid("runtime echo evidence step_id mismatch") : valid(),
    options?.expectedAttemptId !== undefined && value.attempt_id !== options.expectedAttemptId ? invalid("runtime echo evidence attempt_id mismatch") : valid(),
    validateProviderAndModelBinding(value, "runtime echo evidence", options),
    validateOpaqueRef(value.runtime_capability_ref, "runtime_capability_ref"),
    options?.expectedRuntimeCapabilityRef !== undefined && value.runtime_capability_ref !== options.expectedRuntimeCapabilityRef ? invalid("runtime echo evidence runtime_capability_ref mismatch") : valid(),
    validateOpaqueRef(value.conformance_ref, "conformance_ref"),
    options?.expectedConformanceRef !== undefined && value.conformance_ref !== options.expectedConformanceRef ? invalid("runtime echo evidence conformance_ref mismatch") : valid(),
    value.runtime_echo_mode === "trusted" ? valid() : invalid("runtime echo evidence must be trusted"),
    value.trusted === true ? valid() : invalid("runtime echo evidence must be trusted"),
    validateTimestamp(value.observed_at, "runtime echo evidence observed_at"),
    validateFutureTimestamp(value.expires_at, "runtime echo evidence expires_at", options?.now),
    conformanceResult,
    conformanceRecord.dispatch_mode === "real-opencode-dispatch" ? valid() : invalid("conformance dispatch_mode is not managed-dispatch ready"),
    conformanceRecord.runtime_echo_mode === "trusted" ? valid() : invalid("conformance runtime echo is not trusted"),
    conformanceRecord.event_telemetry_mode === "sufficient" ? valid() : invalid("conformance telemetry is insufficient"),
    conformanceRecord.provider_health_mode === "dispatch_gate_ready" ? valid() : invalid("conformance provider health is not dispatch-gate ready"),
    conformanceRecord.fallback_reselection_mode === "disabled" ? valid() : invalid("conformance fallback reselection must be disabled"),
    conformanceRecord.hook_harness_mode === "enforce" ? valid() : invalid("conformance hook harness must enforce")
  ]);
}

export function validateManagedDispatchBetaTelemetryCorrelationV1(value: unknown, options?: ManagedDispatchBetaEvidenceValidationOptionsV1): ValidationResult {
  if (!isRecord(value)) return invalid("managed dispatch beta telemetry correlation must be an object");
  return combine([
    rejectUnknownProperties(value, ["schema_version", "telemetry_ref", "workflow_id", "step_id", "attempt_id", "event_telemetry_mode", "correlation_count", "ambiguous", "source_refs"]),
    requireFields(value, ["schema_version", "telemetry_ref", "workflow_id", "step_id", "attempt_id", "event_telemetry_mode", "correlation_count", "ambiguous", "source_refs"]),
    value.schema_version === "flowdesk.managed_dispatch_beta.telemetry_correlation.v1" ? valid() : invalid("telemetry correlation schema_version is invalid"),
    validateOpaqueRef(value.telemetry_ref, "telemetry_ref"),
    validateOpaqueId(value.workflow_id, "workflow_id"),
    validateOpaqueId(value.step_id, "step_id"),
    validateOpaqueId(value.attempt_id, "attempt_id"),
    options?.expectedWorkflowId !== undefined && value.workflow_id !== options.expectedWorkflowId ? invalid("telemetry correlation workflow_id mismatch") : valid(),
    options?.expectedStepId !== undefined && value.step_id !== options.expectedStepId ? invalid("telemetry correlation step_id mismatch") : valid(),
    options?.expectedAttemptId !== undefined && value.attempt_id !== options.expectedAttemptId ? invalid("telemetry correlation attempt_id mismatch") : valid(),
    value.event_telemetry_mode === "sufficient" ? valid() : invalid("telemetry correlation is insufficient"),
    validateNonNegativeInteger(value.correlation_count, "telemetry correlation_count"),
    typeof value.correlation_count === "number" && value.correlation_count >= 2 ? valid() : invalid("telemetry correlation_count is insufficient"),
    value.ambiguous === false ? valid() : invalid("telemetry correlation is ambiguous"),
    validateOpaqueRefArray(value.source_refs, "telemetry source_refs", 20),
    Array.isArray(value.source_refs) && value.source_refs.length > 0 ? valid() : invalid("telemetry source_refs are required")
  ]);
}

export function validateAttemptRecordV1(value: unknown): ValidationResult {
  if (!isRecord(value)) return invalid("attempt record must be an object");
  return combine([
    validateSchemaArtifactValue("flowdesk.attempt_record.v1", value),
    validateOpaqueId(value.attempt_id, "attempt_id"),
    validateOpaqueId(value.workflow_id, "workflow_id"),
    value.step_id === undefined ? valid() : validateOpaqueId(value.step_id, "step_id"),
    isEnumValue(value.run_mode, RELEASE_1_RUN_MODES) ? valid() : invalid("run_mode is invalid"),
    value.run_mode === "real-opencode-dispatch" ? invalid("Release 1 attempt records cannot store real dispatch run mode") : valid(),
    isEnumValue(value.state_at_start, WORKFLOW_STATES) ? valid() : invalid("state_at_start is invalid"),
    value.state_at_end === undefined || isEnumValue(value.state_at_end, WORKFLOW_STATES) ? valid() : invalid("state_at_end is invalid"),
    isEnumValue(value.attempt_state, ATTEMPT_STATES) ? valid() : invalid("attempt_state is invalid"),
    isEnumValue(value.runtime_echo_validation, ["not_applicable", "untrusted", "trusted", "failed"]) ? valid() : invalid("runtime_echo_validation is invalid"),
    isEnumValue(value.artifact_disposition, ARTIFACT_DISPOSITIONS) ? valid() : invalid("artifact_disposition is invalid"),
    value.guard_decision_ref === undefined ? valid() : validateOpaqueRef(value.guard_decision_ref, "guard_decision_ref"),
    value.non_dispatch_permission_ref === undefined ? valid() : validateOpaqueRef(value.non_dispatch_permission_ref, "non_dispatch_permission_ref"),
    value.usage_snapshot_ref === undefined ? valid() : validateOpaqueRef(value.usage_snapshot_ref, "usage_snapshot_ref"),
    value.provider_health_snapshot_ref === undefined ? valid() : validateOpaqueRef(value.provider_health_snapshot_ref, "provider_health_snapshot_ref"),
    value.runtime_capability_ref === undefined ? valid() : validateOpaqueRef(value.runtime_capability_ref, "runtime_capability_ref"),
    validateOpaqueRef(value.pre_run_audit_ref, "pre_run_audit_ref"),
    value.verification_ref === undefined ? valid() : validateOpaqueRef(value.verification_ref, "verification_ref"),
    value.outcome_audit_ref === undefined ? valid() : validateOpaqueRef(value.outcome_audit_ref, "outcome_audit_ref"),
    value.failure_category === undefined || isEnumValue(value.failure_category, REDACTED_ERROR_CATEGORIES) ? valid() : invalid("failure_category is invalid"),
    validateStringArray(value.safe_next_actions, "safe_next_actions", SAFE_NEXT_ACTIONS, 8)
  ]);
}

export function assertAttemptRecordV1(value: unknown): asserts value is FlowDeskAttemptRecordV1 {
  const result = validateAttemptRecordV1(value);
  if (!result.ok) throw new Error(result.errors.join("; "));
}

export function validateWorkflowActiveV1(value: unknown, expected?: { workflowId?: string; attemptId?: string }): ValidationResult {
  if (!isRecord(value)) return invalid("workflow active record must be an object");
  return combine([
    validateSchemaArtifactValue("flowdesk.workflow_active.v1", value),
    value.active_workflow_id === undefined ? valid() : validateOpaqueId(value.active_workflow_id, "active_workflow_id"),
    value.active_attempt_id === undefined ? valid() : validateOpaqueId(value.active_attempt_id, "active_attempt_id"),
    isEnumValue(value.state, WORKFLOW_STATES) ? valid() : invalid("state is invalid"),
    validateStringArray(value.audit_refs, "audit_refs"),
    expected?.workflowId !== undefined && value.active_workflow_id !== undefined && value.active_workflow_id !== expected.workflowId ? invalid("active workflow mismatch") : valid(),
    expected?.attemptId !== undefined && value.active_attempt_id !== undefined && value.active_attempt_id !== expected.attemptId ? invalid("active attempt mismatch") : valid()
  ]);
}

export function assertWorkflowActiveV1(value: unknown): asserts value is FlowDeskWorkflowActiveV1 {
  const result = validateWorkflowActiveV1(value);
  if (!result.ok) throw new Error(result.errors.join("; "));
}

export function validateWorkflowRecordV1(value: unknown): ValidationResult {
  if (!isRecord(value)) return invalid("workflow record must be an object");
  return combine([
    validateSchemaArtifactValue("flowdesk.workflow_record.v1", value),
    validateOpaqueId(value.workflow_id, "workflow_id"),
    value.session_ref === undefined ? valid() : validateOpaqueRef(value.session_ref, "session_ref"),
    isEnumValue(value.state, WORKFLOW_STATES) ? valid() : invalid("state is invalid"),
    value.latest_plan_revision_id === undefined ? valid() : validateOpaqueId(value.latest_plan_revision_id, "latest_plan_revision_id"),
    value.current_step_id === undefined ? valid() : validateOpaqueId(value.current_step_id, "current_step_id"),
    validateOpaqueRef(value.project_root_ref, "project_root_ref"),
    typeof value.config_hash === "string" && value.config_hash.length > 0 ? validateNoForbiddenRawPayloads(value.config_hash, "config_hash") : invalid("config_hash is required"),
    validateOpaqueId(value.policy_pack_id, "policy_pack_id"),
    typeof value.policy_pack_hash === "string" && value.policy_pack_hash.length > 0 ? validateNoForbiddenRawPayloads(value.policy_pack_hash, "policy_pack_hash") : invalid("policy_pack_hash is required"),
    value.current_attempt_id === undefined ? valid() : validateOpaqueId(value.current_attempt_id, "current_attempt_id"),
    value.latest_checkpoint_id === undefined ? valid() : validateOpaqueId(value.latest_checkpoint_id, "latest_checkpoint_id"),
    isEnumValue(value.artifact_disposition, ARTIFACT_DISPOSITIONS) ? valid() : invalid("artifact_disposition is invalid"),
    validateStringArray(value.attempt_refs, "attempt_refs"),
    validateStringArray(value.checkpoint_refs, "checkpoint_refs"),
    validateStringArray(value.lane_refs, "lane_refs"),
    validateStringArray(value.latest_lane_summary_refs, "latest_lane_summary_refs"),
    validateStringArray(value.audit_refs, "audit_refs"),
    validateStringArray(value.safe_next_actions, "safe_next_actions", SAFE_NEXT_ACTIONS, 8)
  ]);
}

export function assertWorkflowRecordV1(value: unknown): asserts value is FlowDeskWorkflowRecordV1 {
  const result = validateWorkflowRecordV1(value);
  if (!result.ok) throw new Error(result.errors.join("; "));
}

export function validateCheckpointRecordV1(value: unknown): ValidationResult {
  if (!isRecord(value)) return invalid("checkpoint record must be an object");
  return combine([
    validateSchemaArtifactValue("flowdesk.checkpoint_record.v1", value),
    validateOpaqueId(value.checkpoint_id, "checkpoint_id"),
    validateOpaqueId(value.workflow_id, "workflow_id"),
    value.attempt_id === undefined ? valid() : validateOpaqueId(value.attempt_id, "attempt_id"),
    value.current_step_id === undefined ? valid() : validateOpaqueId(value.current_step_id, "current_step_id"),
    isEnumValue(value.resume_mode, RESUME_MODES) ? valid() : invalid("resume_mode is invalid"),
    isEnumValue(value.reason, ["planned_pause", "retryable_failure", "verification_failed", "blocked", "abort_requested", "status_snapshot"]) ? valid() : invalid("reason is invalid"),
    Array.isArray(value.audit_refs) && value.audit_refs.length > 0 ? validateStringArray(value.audit_refs, "audit_refs") : invalid("checkpoint requires durable audit_refs"),
    validateStringArray(value.artifact_refs, "artifact_refs"),
    Array.isArray(value.required_fresh_checks) ? combine(value.required_fresh_checks.map((check, index) => validateFreshCheckV1(check, `required_fresh_checks[${index}]`))) : invalid("required_fresh_checks must be an array"),
    validateStringArray(value.safe_next_actions, "safe_next_actions", SAFE_NEXT_ACTIONS, 8)
  ]);
}

export function validateFreshCheckV1(value: unknown, label = "fresh check"): ValidationResult {
  if (!isRecord(value)) return invalid(`${label} must be an object`);
  return combine([
    rejectUnknownProperties(value, ["check", "required", "ref"]),
    requireFields(value, ["check", "required"]),
    isEnumValue(value.check, ["usage", "provider_health", "policy", "runtime_capability", "checkpoint", "audit"]) ? valid() : invalid(`${label}.check is invalid`),
    typeof value.required === "boolean" ? valid() : invalid(`${label}.required must be boolean`),
    value.ref === undefined ? valid() : validateOpaqueRef(value.ref, `${label}.ref`),
    validateNoForbiddenRawPayloads(value, label)
  ]);
}

export function assertCheckpointRecordV1(value: unknown): asserts value is FlowDeskCheckpointRecordV1 {
  const result = validateCheckpointRecordV1(value);
  if (!result.ok) throw new Error(result.errors.join("; "));
}

export function validateActiveAttemptLockV1(value: unknown, now = Date.now()): ValidationResult {
  if (!isRecord(value)) return invalid("active attempt lock must be an object");
  const expiresAt = typeof value.expires_at === "string" ? Date.parse(value.expires_at) : Number.NaN;
  return combine([
    validateSchemaArtifactValue("flowdesk.active_attempt_lock.v1", value),
    validateOpaqueId(value.workflow_id, "workflow_id"),
    validateOpaqueId(value.attempt_id, "attempt_id"),
    validateOpaqueRef(value.owner_ref, "owner_ref"),
    validateTimestamp(value.acquired_at, "acquired_at"),
    validateTimestamp(value.expires_at, "expires_at"),
    value.heartbeat_at === undefined ? valid() : validateTimestamp(value.heartbeat_at, "heartbeat_at"),
    isEnumValue(value.recovery_state, LOCK_RECOVERY_STATES) ? valid() : invalid("recovery_state is invalid"),
    value.recovery_state === "corrupt" ? invalid("corrupt active-attempt lock fails closed") : valid(),
    Number.isFinite(expiresAt) && expiresAt < now && value.recovery_state === "active" ? invalid("stale active lock cannot remain active") : valid(),
    validateOpaqueRef(value.audit_ref, "audit_ref")
  ]);
}

export function assertActiveAttemptLockV1(value: unknown): asserts value is FlowDeskActiveAttemptLockV1 {
  const result = validateActiveAttemptLockV1(value);
  if (!result.ok) throw new Error(result.errors.join("; "));
}

export function validateLaneRecordV1(value: unknown): ValidationResult {
  if (!isRecord(value)) return invalid("lane record must be an object");
  return combine([
    validateSchemaArtifactValue("flowdesk.lane_record.v1", value),
    validateOpaqueId(value.lane_id, "lane_id"),
    validateOpaqueId(value.workflow_id, "workflow_id"),
    value.plan_revision_id === undefined ? valid() : validateOpaqueId(value.plan_revision_id, "plan_revision_id"),
    value.attempt_id === undefined ? valid() : validateOpaqueId(value.attempt_id, "attempt_id"),
    validateOpaqueRef(value.task_ref, "task_ref"),
    isEnumValue(value.lane_class, ["planning_draft", "planning_refine", "planning_review", "research", "documentation", "verification", "diagnostics", "other"]) ? valid() : invalid("lane_class is invalid"),
    isEnumValue(value.state, PERSISTED_LANE_STATES) ? valid() : invalid("lane record state is invalid or future-gated"),
    value.state === "hard_cancel_proven" ? invalid("Release 1 persisted lane records must not store hard_cancel_proven") : valid(),
    validateStringArray(value.refs, "refs"),
    validateStringArray(value.event_refs, "event_refs"),
    validateStringArray(value.audit_refs, "audit_refs"),
    value.debug_ref === undefined ? valid() : validateOpaqueRef(value.debug_ref, "debug_ref"),
    value.invocation_ref_kind === undefined || isEnumValue(value.invocation_ref_kind, LANE_INVOCATION_REF_KINDS) ? valid() : invalid("invocation_ref_kind is invalid"),
    value.retry_count === undefined || (typeof value.retry_count === "number" && Number.isInteger(value.retry_count) && value.retry_count >= 0 && value.retry_count <= 2) ? valid() : invalid("retry_count is invalid"),
    value.verdict_status === undefined || isEnumValue(value.verdict_status, LANE_VERDICT_STATUSES) ? valid() : invalid("verdict_status is invalid"),
    isEnumValue(value.safe_next_action, SAFE_NEXT_ACTIONS) ? valid() : invalid("safe_next_action is invalid")
  ]);
}

export function assertLaneRecordV1(value: unknown): asserts value is FlowDeskLaneRecordV1 {
  const result = validateLaneRecordV1(value);
  if (!result.ok) throw new Error(result.errors.join("; "));
}

export function validateAuditEventV1(value: unknown): ValidationResult {
  if (!isRecord(value)) return invalid("audit event must be an object");
  return combine([
    validateSchemaArtifactValue("flowdesk.audit_event.v1", value),
    validateOpaqueId(value.event_id, "event_id"),
    typeof value.event_type === "string" && value.event_type.length > 0 && value.event_type.length <= 128 ? validateNoForbiddenRawPayloads(value.event_type, "event_type") : invalid("event_type is required"),
    value.workflow_id === undefined ? valid() : validateOpaqueId(value.workflow_id, "workflow_id"),
    value.attempt_id === undefined ? valid() : validateOpaqueId(value.attempt_id, "attempt_id"),
    value.step_id === undefined ? valid() : validateOpaqueId(value.step_id, "step_id"),
    typeof value.created_at === "string" && value.created_at.length > 0 ? valid() : invalid("created_at is required"),
    isEnumValue(value.actor_class, ["user", "flowdesk", "opencode", "provider", "system", "unknown"]) ? valid() : invalid("actor_class is invalid"),
    value.policy_ref === undefined ? valid() : validateOpaqueRef(value.policy_ref, "policy_ref"),
    value.decision_ref === undefined ? valid() : validateOpaqueRef(value.decision_ref, "decision_ref"),
    typeof value.redaction_version === "string" && value.redaction_version.length > 0 ? validateNoForbiddenRawPayloads(value.redaction_version, "redaction_version") : invalid("redaction_version is required"),
    typeof value.summary_label === "string" && value.summary_label.length > 0 && value.summary_label.length <= 160 ? validateNoForbiddenRawPayloads(value.summary_label, "summary_label") : invalid("summary_label is required"),
    validateStringArray(value.artifact_refs, "artifact_refs", undefined, 20)
  ]);
}

export function assertAuditEventV1(value: unknown): asserts value is FlowDeskAuditEventV1 {
  const result = validateAuditEventV1(value);
  if (!result.ok) throw new Error(result.errors.join("; "));
}

export function validateAuditRecordV1(value: unknown): ValidationResult {
  if (!isRecord(value)) return invalid("audit record must be an object");
  return combine([
    validateSchemaArtifactValue("flowdesk.audit_record.v1", value),
    validateOpaqueRef(value.audit_ref, "audit_ref"),
    value.event_id === undefined ? valid() : validateOpaqueId(value.event_id, "event_id"),
    value.workflow_id === undefined ? valid() : validateOpaqueId(value.workflow_id, "workflow_id"),
    value.attempt_id === undefined ? valid() : validateOpaqueId(value.attempt_id, "attempt_id"),
    value.step_id === undefined ? valid() : validateOpaqueId(value.step_id, "step_id"),
    value.checkpoint_id === undefined ? valid() : validateOpaqueId(value.checkpoint_id, "checkpoint_id"),
    typeof value.event_type === "string" && value.event_type.length > 0 ? validateNoForbiddenRawPayloads(value.event_type, "event_type") : invalid("event_type is required"),
    typeof value.created_at === "string" && value.created_at.length > 0 ? valid() : invalid("created_at is required"),
    value.actor_class === undefined || isEnumValue(value.actor_class, ["user", "flowdesk", "opencode", "provider", "system", "unknown"]) ? valid() : invalid("actor_class is invalid"),
    typeof value.summary_label === "string" && value.summary_label.length > 0 ? validateNoForbiddenRawPayloads(value.summary_label, "summary_label") : invalid("summary_label is required"),
    value.policy_ref === undefined ? valid() : validateOpaqueRef(value.policy_ref, "policy_ref"),
    value.decision_ref === undefined ? valid() : validateOpaqueRef(value.decision_ref, "decision_ref"),
    validateOpaqueRefArray(value.evidence_refs, "evidence_refs", 20),
    validateStringArray(value.artifact_refs, "artifact_refs", undefined, 20),
    typeof value.redaction_version === "string" && value.redaction_version.length > 0 ? validateNoForbiddenRawPayloads(value.redaction_version, "redaction_version") : invalid("redaction_version is required")
  ]);
}

export function validateAuditRefSummaryV1(value: unknown): ValidationResult {
  if (!isRecord(value)) return invalid("audit ref summary must be an object");
  return combine([
    validateSchemaArtifactValue("flowdesk.audit_ref_summary.v1", value),
    validateOpaqueRef(value.audit_ref, "audit_ref"),
    value.workflow_id === undefined ? valid() : validateOpaqueId(value.workflow_id, "workflow_id"),
    value.attempt_id === undefined ? valid() : validateOpaqueId(value.attempt_id, "attempt_id"),
    typeof value.event_type === "string" && value.event_type.length > 0 && value.event_type.length <= 128 ? validateNoForbiddenRawPayloads(value.event_type, "event_type") : invalid("event_type is required"),
    typeof value.summary_label === "string" && value.summary_label.length > 0 && value.summary_label.length <= 160 ? validateNoForbiddenRawPayloads(value.summary_label, "summary_label") : invalid("summary_label is required"),
    validateTimestamp(value.created_at, "created_at"),
    typeof value.redaction_version === "string" && value.redaction_version.length > 0 && value.redaction_version.length <= 128 ? validateNoForbiddenRawPayloads(value.redaction_version, "redaction_version") : invalid("redaction_version is required")
  ]);
}

export function assertAuditRefSummaryV1(value: unknown): asserts value is FlowDeskAuditRefSummaryV1 {
  const result = validateAuditRefSummaryV1(value);
  if (!result.ok) throw new Error(result.errors.join("; "));
}

export function assertAuditRecordV1(value: unknown): asserts value is FlowDeskAuditRecordV1 {
  const result = validateAuditRecordV1(value);
  if (!result.ok) throw new Error(result.errors.join("; "));
}

export function validateDebugSectionSummaryV1(value: unknown): ValidationResult {
  if (!isRecord(value)) return invalid("debug section summary must be an object");
  return combine([
    validateSchemaArtifactValue("flowdesk.debug_section_summary.v1", value),
    validateOpaqueId(value.export_id, "export_id"),
    isEnumValue(value.section, DEBUG_SECTIONS) ? valid() : invalid("debug section is invalid"),
    validateOpaqueRef(value.ref, "ref"),
    isEnumValue(value.redaction_status, ["passed", "partial", "blocked"]) ? valid() : invalid("redaction_status is invalid"),
    validateNonNegativeInteger(value.warning_count, "warning_count"),
    validateStringArray(value.excluded_categories, "excluded_categories", REDACTED_ERROR_CATEGORIES)
  ]);
}

export function validateDebugExportManifestV1(value: unknown): ValidationResult {
  if (!isRecord(value)) return invalid("debug export manifest must be an object");
  const partialDeletionWarningResult = value.partial_deletion_warning === undefined
    ? valid()
    : typeof value.partial_deletion_warning === "string" && value.partial_deletion_warning.length > 0 && value.partial_deletion_warning.length <= 500
      ? validateNoForbiddenRawPayloads(value.partial_deletion_warning, "partial_deletion_warning")
      : invalid("partial_deletion_warning must be a bounded string");
  return combine([
    validateSchemaArtifactValue("flowdesk.debug_export_manifest.v1", value),
    validateOpaqueId(value.export_id, "export_id"),
    validateOpaqueRef(value.manifest_ref, "manifest_ref"),
    value.workflow_id === undefined ? valid() : validateOpaqueId(value.workflow_id, "workflow_id"),
    value.session_ref === undefined ? valid() : validateOpaqueRef(value.session_ref, "session_ref"),
    Array.isArray(value.included_sections) ? combine(value.included_sections.map((section) => validateDebugSectionSummaryV1(section))) : invalid("included_sections must be an array"),
    validateNonNegativeInteger(value.file_count, "file_count"),
    validateNonNegativeInteger(value.byte_count, "byte_count"),
    isEnumValue(value.deletion_state, ["pending", "deleted", "partial", "retained_by_policy"]) ? valid() : invalid("deletion_state is invalid"),
    validateOpaqueRefArray(value.source_refs, "source_refs"),
    validateOpaqueRefArray(value.audit_refs, "audit_refs"),
    validateStringArray(value.warnings, "warnings", undefined, 20),
    value.deletion_proof_ref === undefined ? valid() : validateOpaqueRef(value.deletion_proof_ref, "deletion_proof_ref"),
    value.deletion_state === "deleted" && value.deletion_proof_ref === undefined ? invalid("deleted debug exports require deletion_proof_ref") : valid(),
    value.deletion_state === "partial" && value.partial_deletion_warning === undefined ? invalid("partial debug export deletion requires partial_deletion_warning") : valid(),
    partialDeletionWarningResult
  ]);
}

export function validateConformanceRuntimeMetadataV1(value: unknown): ValidationResult {
  if (!isRecord(value)) return invalid("conformance runtime metadata must be an object");
  return combine([
    validateSchemaArtifactValue("flowdesk.conformance_runtime_metadata.v1", value),
    typeof value.opencode_version === "string" && value.opencode_version.length > 0 && value.opencode_version.length <= 128 ? validateNoForbiddenRawPayloads(value.opencode_version, "opencode_version") : invalid("opencode_version is required"),
    value.opencode_commit === undefined ? valid() : typeof value.opencode_commit === "string" && value.opencode_commit.length > 0 && value.opencode_commit.length <= 128 ? validateNoForbiddenRawPayloads(value.opencode_commit, "opencode_commit") : invalid("opencode_commit is invalid"),
    validateTimestamp(value.checked_at, "checked_at"),
    value.plugin_package === "@flowdesk/opencode-plugin" ? valid() : invalid("plugin_package is invalid"),
    typeof value.plugin_version_or_commit === "string" && value.plugin_version_or_commit.length > 0 && value.plugin_version_or_commit.length <= 128 ? validateNoForbiddenRawPayloads(value.plugin_version_or_commit, "plugin_version_or_commit") : invalid("plugin_version_or_commit is required"),
    isEnumValue(value.chat_intake_mode, ["blocking", "steering", "observe_only", "off"]) ? valid() : invalid("chat_intake_mode is invalid"),
    isEnumValue(value.command_alias_mode, ["portable_only", "colon_alias_supported"]) ? valid() : invalid("command_alias_mode is invalid"),
    isEnumValue(value.dispatch_mode, ["none", "fake-runtime", "guarded-dry-run", "command-steering", "real-opencode-dispatch"]) ? valid() : invalid("dispatch_mode is invalid"),
    isEnumValue(value.runtime_echo_mode, ["none", "trusted", "untrusted", "request_surface_only"]) ? valid() : invalid("runtime_echo_mode is invalid"),
    isEnumValue(value.event_telemetry_mode, ["none", "partial", "sufficient"]) ? valid() : invalid("event_telemetry_mode is invalid"),
    isEnumValue(value.provider_health_mode, ["none", "diagnostic_only", "dispatch_gate_ready"]) ? valid() : invalid("provider_health_mode is invalid"),
    isEnumValue(value.fallback_reselection_mode, ["disabled", "diagnostic_only", "guarded_real_dispatch_ready"]) ? valid() : invalid("fallback_reselection_mode is invalid"),
    isEnumValue(value.diagnostics_surface_mode, ["none", "status_only", "doctor_usage_status", "doctor_usage_status_debug"]) ? valid() : invalid("diagnostics_surface_mode is invalid"),
    isEnumValue(value.lane_observability_mode, ["none", "command_summary", "openable_refs"]) ? valid() : invalid("lane_observability_mode is invalid"),
    isEnumValue(value.hook_harness_mode, HOOK_HARNESS_MODES) ? valid() : invalid("hook_harness_mode is invalid"),
    isEnumValue(value.tui_mode, ["ux_only", "unsupported"]) ? valid() : invalid("tui_mode is invalid"),
    validateStringArray(value.mode_fields, "mode_fields", undefined, 20),
    validateOpaqueRefArray(value.evidence_refs, "evidence_refs", 20),
    validateStringArray(value.disabled_modes, "disabled_modes", DISABLED_MODES, 8),
    validateNoForbiddenRawPayloads(value, "conformance_runtime_metadata")
  ]);
}

export function assertConformanceRuntimeMetadataV1(value: unknown): asserts value is FlowDeskConformanceRuntimeMetadataV1 {
  const result = validateConformanceRuntimeMetadataV1(value);
  if (!result.ok) throw new Error(result.errors.join("; "));
}

export function validateConformanceEvidenceRecordV1(value: unknown): ValidationResult {
  if (!isRecord(value)) return invalid("conformance evidence record must be an object");
  return combine([
    validateSchemaArtifactValue("flowdesk.conformance_evidence_record.v1", value),
    validateOpaqueRef(value.evidence_ref, "evidence_ref"),
    validateOpaqueId(value.run_id, "run_id"),
    validateTimestamp(value.checked_at, "checked_at"),
    typeof value.evidence_area === "string" && value.evidence_area.length > 0 && value.evidence_area.length <= 128 ? validateNoForbiddenRawPayloads(value.evidence_area, "evidence_area") : invalid("evidence_area is required"),
    isEnumValue(value.result, ["pass", "fail", "partial", "skipped"]) ? valid() : invalid("result is invalid"),
    typeof value.summary_label === "string" && value.summary_label.length > 0 && value.summary_label.length <= 160 ? validateNoForbiddenRawPayloads(value.summary_label, "summary_label") : invalid("summary_label is required"),
    typeof value.redaction_version === "string" && value.redaction_version.length > 0 && value.redaction_version.length <= 128 ? validateNoForbiddenRawPayloads(value.redaction_version, "redaction_version") : invalid("redaction_version is required"),
    validateOpaqueRefArray(value.source_refs, "source_refs", 20),
    validateNoForbiddenRawPayloads(value, "conformance_evidence_record")
  ]);
}

export function assertConformanceEvidenceRecordV1(value: unknown): asserts value is FlowDeskConformanceEvidenceRecordV1 {
  const result = validateConformanceEvidenceRecordV1(value);
  if (!result.ok) throw new Error(result.errors.join("; "));
}

export function assertDebugExportManifestV1(value: unknown): asserts value is FlowDeskDebugExportManifestV1 {
  const result = validateDebugExportManifestV1(value);
  if (!result.ok) throw new Error(result.errors.join("; "));
}

export function validateExportDebugRequestV1(value: unknown): ValidationResult {
  if (!isRecord(value)) return invalid("export debug request must be an object");
  return combine([
    validateRequestEnvelope(value, "flowdesk.export_debug.request.v1"),
    validateStringArray(value.include_sections, "include_sections", DEBUG_SECTIONS, 7),
    isEnumValue(value.retention_hint, ["delete_after_export", "keep_until_default_expiry", "keep_until_policy_expiry"]) ? valid() : invalid("retention_hint is invalid")
  ]);
}

export function validateExportDebugResponseV1(value: unknown): ValidationResult {
  if (!isRecord(value)) return invalid("export debug response must be an object");
  return combine([
    validateResponseEnvelopeV1(value, "flowdesk.export_debug.response.v1"),
    validateOpaqueRef(value.export_manifest_ref, "export_manifest_ref"),
    Array.isArray(value.included_sections) ? combine(value.included_sections.map((section) => validateDebugSectionSummaryV1(section))) : invalid("included_sections must be an array"),
    validateTimestamp(value.delete_after, "delete_after")
  ]);
}

export function assertExportDebugResponseV1(value: unknown): asserts value is FlowDeskExportDebugResponseV1 {
  const result = validateExportDebugResponseV1(value);
  if (!result.ok) throw new Error(result.errors.join("; "));
}

export function validateSessionRecordCannotReplaceWorkflowState(value: unknown): ValidationResult {
  if (!isRecord(value)) return invalid("session record must be an object");
  if (typeof value.schema_version !== "string" || !value.schema_version.startsWith("flowdesk.")) return invalid("session record schema_version is missing");
  const sessionSchemas = new Set(["flowdesk.audit_record.v1", "flowdesk.lane_record.v1", "flowdesk.debug_export_manifest.v1"]);
  if (!sessionSchemas.has(value.schema_version)) return invalid("unknown session-side schema cannot replace workflow state");
  const forbiddenAuthorityKeys = ["active_workflow_id", "active_attempt_id", "latest_checkpoint_id", "current_attempt_id", "workflow_active", "checkpoint_state", "guard_approved_dispatch"];
  const present = forbiddenAuthorityKeys.filter((key) => key in value);
  if (present.length > 0) return invalid(`session record cannot replace workflow/checkpoint state: ${present.join(",")}`);
  if (value.schema_version === "flowdesk.audit_record.v1") return validateAuditRecordV1(value);
  if (value.schema_version === "flowdesk.lane_record.v1") return validateLaneRecordV1(value);
  return validateDebugExportManifestV1(value);
}

const TOP_TIER_REVIEWER_PERSPECTIVES = ["policy_security", "architecture", "verification_implementation"] as const;
const TOP_TIER_BINDING_AVAILABILITY_STATES = ["registered_available", "registered_unavailable", "registered_blocked"] as const;
const TOP_TIER_LANE_INCLUSION_STATES = ["included", "excluded", "blocked"] as const;
const TOP_TIER_REVIEW_INVENTORY_DECISIONS = ["ready", "blocked", "policy_change_required"] as const;
const TOP_TIER_REVIEW_VERDICT_LABELS = ["pass", "changes_required", "blocked", "inconclusive"] as const;
const TOP_TIER_REVIEW_FINDING_SEVERITIES = ["info", "low", "medium", "high", "critical"] as const;
const TOP_TIER_REVIEW_UNCERTAINTY_LEVELS = ["low", "medium", "high", "unknown"] as const;
const PLANNED_MODE_FIELD_LABELS = ["top_tier_multi_perspective_review_mode"] as const;
const PLANNED_MODE_FIELD_STATES = ["disabled", "planned", "conformance_ready", "release_gate_ready"] as const;
const FORBIDDEN_PLANNED_MODE_FIELD_STATES = ["enabled", "active", "dispatch_ready", "approved", "authorized"] as const;

const FORBIDDEN_REVIEWER_AUTHORITY_KEYS = [
  "trusted",
  "approve_dispatch",
  "guard_decision",
  "guard_approved_dispatch",
  "real_dispatch",
  "actual_dispatch",
  "managed_dispatch",
  "fallback_authorized",
  "noReply"
] as const;

function rejectForbiddenAuthorityKeys(value: Record<string, unknown>, label: string): ValidationResult {
  const present = FORBIDDEN_REVIEWER_AUTHORITY_KEYS.filter((key) => key in value);
  return present.length === 0 ? valid() : invalid(`${label} cannot carry authority keys: ${present.join(",")}`);
}

export function validateTopTierReviewerBindingV1(value: unknown): ValidationResult {
  if (!isRecord(value)) return invalid("top tier reviewer binding must be an object");
  const providerFamily = value.provider_family as ProviderFamily | undefined;
  return combine([
    validateSchemaArtifactValue("flowdesk.top_tier_reviewer_binding.v1", value),
    rejectForbiddenAuthorityKeys(value, "top tier reviewer binding"),
    validateOpaqueId(value.binding_id, "binding_id"),
    value.reviewer_profile_id === "reviewer" ? valid() : invalid("reviewer_profile_id must be canonical reviewer"),
    typeof value.binding_label === "string" && value.binding_label.length > 0 && value.binding_label.length <= 64 && /^[a-z][a-z0-9_]*$/.test(value.binding_label) ? validateNoForbiddenRawPayloads(value.binding_label, "binding_label") : invalid("binding_label must be a bounded lowercase identifier"),
    validateProviderFamily(providerFamily),
    providerFamily === "unknown" || providerFamily === "all" ? invalid("top tier reviewer binding provider_family must be concrete") : valid(),
    validateConcreteProviderQualifiedModelId(value.provider_qualified_model_id, "top tier reviewer binding provider_qualified_model_id"),
    typeof value.model_family === "string" && value.model_family.length > 0 && value.model_family.length <= 120 ? validateNoForbiddenRawPayloads(value.model_family, "model_family") : invalid("model_family is required"),
    value.highest_tier_eligible === true ? valid() : invalid("highest_tier_eligible must be true"),
    validateOpaqueRef(value.registry_entry_ref, "registry_entry_ref"),
    validateOpaqueRef(value.policy_pack_eligibility_ref, "policy_pack_eligibility_ref"),
    isEnumValue(value.availability, TOP_TIER_BINDING_AVAILABILITY_STATES) ? valid() : invalid("availability is invalid"),
    value.dispatch_authority_enabled === false ? valid() : invalid("dispatch_authority_enabled must be false for top tier reviewer binding"),
    validateTimestamp(value.observed_at, "observed_at"),
    validateTimestamp(value.expires_at, "expires_at"),
    validateNoForbiddenRawPayloads(value, "top_tier_reviewer_binding")
  ]);
}

export function validateTopTierReviewerLanePlanV1(value: unknown): ValidationResult {
  if (!isRecord(value)) return invalid("top tier reviewer lane plan must be an object");
  return combine([
    validateSchemaArtifactValue("flowdesk.top_tier_reviewer_lane_plan.v1", value),
    rejectForbiddenAuthorityKeys(value, "top tier reviewer lane plan"),
    validateOpaqueId(value.lane_plan_id, "lane_plan_id"),
    validateOpaqueRef(value.binding_ref, "binding_ref"),
    isEnumValue(value.perspective, TOP_TIER_REVIEWER_PERSPECTIVES) ? valid() : invalid("perspective is invalid"),
    isEnumValue(value.inclusion_state, TOP_TIER_LANE_INCLUSION_STATES) ? valid() : invalid("inclusion_state is invalid"),
    typeof value.reason_label === "string" && value.reason_label.length > 0 && value.reason_label.length <= 200 ? validateNoForbiddenRawPayloads(value.reason_label, "reason_label") : invalid("reason_label is required"),
    validateStringArray(value.safe_next_actions, "safe_next_actions", SAFE_NEXT_ACTIONS, 8),
    value.dispatch_authority_enabled === false ? valid() : invalid("dispatch_authority_enabled must be false for top tier reviewer lane plan"),
    validateNoForbiddenRawPayloads(value, "top_tier_reviewer_lane_plan")
  ]);
}

export function validateTopTierReviewBindingInventoryV1(value: unknown): ValidationResult {
  if (!isRecord(value)) return invalid("top tier review binding inventory must be an object");
  return combine([
    validateSchemaArtifactValue("flowdesk.top_tier_review_binding_inventory.v1", value),
    rejectForbiddenAuthorityKeys(value, "top tier review binding inventory"),
    validateOpaqueId(value.inventory_id, "inventory_id"),
    validateOpaqueId(value.workflow_id, "workflow_id"),
    validateOpaqueId(value.plan_revision_id, "plan_revision_id"),
    validateTimestamp(value.created_at, "created_at"),
    typeof value.redaction_version === "string" && value.redaction_version.length > 0 && value.redaction_version.length <= 128 ? validateNoForbiddenRawPayloads(value.redaction_version, "redaction_version") : invalid("redaction_version is required"),
    validateOpaqueRefArray(value.registered_binding_refs, "registered_binding_refs", 32),
    validateOpaqueRefArray(value.available_binding_refs, "available_binding_refs", 32),
    validateOpaqueRefArray(value.unavailable_binding_refs, "unavailable_binding_refs", 32),
    validateOpaqueRefArray(value.blocked_binding_refs, "blocked_binding_refs", 32),
    validateOpaqueRefArray(value.lane_plan_refs, "lane_plan_refs", 64),
    Array.isArray(value.registered_binding_refs) && value.registered_binding_refs.length > 0 ? valid() : invalid("registered_binding_refs must list at least one binding"),
    Array.isArray(value.lane_plan_refs) && value.lane_plan_refs.length > 0 ? valid() : invalid("lane_plan_refs must list at least one lane plan"),
    typeof value.max_concurrent_lane_count === "number" && Number.isInteger(value.max_concurrent_lane_count) && value.max_concurrent_lane_count > 0 && value.max_concurrent_lane_count <= 32 ? valid() : invalid("max_concurrent_lane_count must be a positive bounded integer"),
    typeof value.budget_cap_label === "string" && value.budget_cap_label.length > 0 && value.budget_cap_label.length <= 200 ? validateNoForbiddenRawPayloads(value.budget_cap_label, "budget_cap_label") : invalid("budget_cap_label is required"),
    typeof value.quota_reserve_label === "string" && value.quota_reserve_label.length > 0 && value.quota_reserve_label.length <= 200 ? validateNoForbiddenRawPayloads(value.quota_reserve_label, "quota_reserve_label") : invalid("quota_reserve_label is required"),
    typeof value.timeout_label === "string" && value.timeout_label.length > 0 && value.timeout_label.length <= 200 ? validateNoForbiddenRawPayloads(value.timeout_label, "timeout_label") : invalid("timeout_label is required"),
    typeof value.retry_budget_label === "string" && value.retry_budget_label.length > 0 && value.retry_budget_label.length <= 200 ? validateNoForbiddenRawPayloads(value.retry_budget_label, "retry_budget_label") : invalid("retry_budget_label is required"),
    isEnumValue(value.inventory_decision, TOP_TIER_REVIEW_INVENTORY_DECISIONS) ? valid() : invalid("inventory_decision is invalid"),
    validateStringArray(value.safe_next_actions, "safe_next_actions", SAFE_NEXT_ACTIONS, 8),
    value.dispatch_authority_enabled === false ? valid() : invalid("dispatch_authority_enabled must be false for top tier review binding inventory"),
    validateNoForbiddenRawPayloads(value, "top_tier_review_binding_inventory")
  ]);
}

function validateTopTierReviewFindingV1(value: unknown, label: string): ValidationResult {
  if (!isRecord(value)) return invalid(`${label} must be an object`);
  return combine([
    rejectUnknownProperties(value, ["finding_id", "severity", "category", "summary_label", "evidence_refs", "required_fix_label"]),
    requireFields(value, ["finding_id", "severity", "category", "summary_label", "evidence_refs", "required_fix_label"]),
    rejectForbiddenAuthorityKeys(value, label),
    validateOpaqueId(value.finding_id, `${label}.finding_id`),
    isEnumValue(value.severity, TOP_TIER_REVIEW_FINDING_SEVERITIES) ? valid() : invalid(`${label}.severity is invalid`),
    isEnumValue(value.category, REDACTED_ERROR_CATEGORIES) ? valid() : invalid(`${label}.category is invalid`),
    typeof value.summary_label === "string" && value.summary_label.length > 0 && value.summary_label.length <= 200 ? validateNoForbiddenRawPayloads(value.summary_label, `${label}.summary_label`) : invalid(`${label}.summary_label is required`),
    validateOpaqueRefArray(value.evidence_refs, `${label}.evidence_refs`, 20),
    typeof value.required_fix_label === "string" && value.required_fix_label.length > 0 && value.required_fix_label.length <= 200 ? validateNoForbiddenRawPayloads(value.required_fix_label, `${label}.required_fix_label`) : invalid(`${label}.required_fix_label is required`),
    validateNoForbiddenRawPayloads(value, label)
  ]);
}

export function validateTopTierReviewVerdictV1(value: unknown): ValidationResult {
  if (!isRecord(value)) return invalid("top tier review verdict must be an object");
  const findingsArray = Array.isArray(value.findings) ? value.findings : [];
  return combine([
    validateSchemaArtifactValue("flowdesk.top_tier_review_verdict.v1", value),
    rejectForbiddenAuthorityKeys(value, "top tier review verdict"),
    validateOpaqueId(value.verdict_id, "verdict_id"),
    validateOpaqueId(value.workflow_id, "workflow_id"),
    validateOpaqueRef(value.lane_plan_ref, "lane_plan_ref"),
    validateOpaqueRef(value.binding_ref, "binding_ref"),
    isEnumValue(value.perspective, TOP_TIER_REVIEWER_PERSPECTIVES) ? valid() : invalid("perspective is invalid"),
    typeof value.source === "string" && value.source.length > 0 && value.source.length <= 64 && /^[a-z][a-z0-9_]*$/.test(value.source) ? validateNoForbiddenRawPayloads(value.source, "source") : invalid("source must be a bounded lowercase reviewer binding label"),
    validateTimestamp(value.created_at, "created_at"),
    typeof value.redaction_version === "string" && value.redaction_version.length > 0 && value.redaction_version.length <= 128 ? validateNoForbiddenRawPayloads(value.redaction_version, "redaction_version") : invalid("redaction_version is required"),
    Array.isArray(value.findings) ? valid() : invalid("findings must be an array"),
    findingsArray.length <= 20 ? valid() : invalid("findings exceeds max items 20"),
    combine(findingsArray.map((finding, index) => validateTopTierReviewFindingV1(finding, `findings[${index}]`))),
    validateOpaqueRefArray(value.evidence_refs, "evidence_refs", 20),
    isEnumValue(value.uncertainty, TOP_TIER_REVIEW_UNCERTAINTY_LEVELS) ? valid() : invalid("uncertainty is invalid"),
    Array.isArray(value.required_fixes) ? valid() : invalid("required_fixes must be an array"),
    Array.isArray(value.required_fixes) && value.required_fixes.length <= 20 ? valid() : invalid("required_fixes exceeds max items 20"),
    validateStringArray(value.required_fixes, "required_fixes", undefined, 20),
    Array.isArray(value.required_fixes) ? combine(value.required_fixes.map((fix, index) => typeof fix === "string" && fix.length > 0 && fix.length <= 200 ? valid() : invalid(`required_fixes[${index}] must be a bounded string`))) : valid(),
    isEnumValue(value.verdict_label, TOP_TIER_REVIEW_VERDICT_LABELS) ? valid() : invalid("verdict_label is invalid"),
    validateStringArray(value.safe_next_actions, "safe_next_actions", SAFE_NEXT_ACTIONS, 8),
    value.dispatch_authority_enabled === false ? valid() : invalid("dispatch_authority_enabled must be false for top tier review verdict"),
    validateNoForbiddenRawPayloads(value, "top_tier_review_verdict")
  ]);
}

export function validateFlowDeskPlannedModeFieldV1(value: unknown): ValidationResult {
  if (!isRecord(value)) return invalid("planned mode field must be an object");
  return combine([
    rejectUnknownProperties(value, ["label", "state", "dispatch_authority_enabled"]),
    requireFields(value, ["label", "state", "dispatch_authority_enabled"]),
    isEnumValue(value.label, PLANNED_MODE_FIELD_LABELS) ? valid() : invalid("planned mode field label is invalid"),
    typeof value.state === "string" && (FORBIDDEN_PLANNED_MODE_FIELD_STATES as readonly string[]).includes(value.state) ? invalid(`planned mode field state cannot be "${value.state}" without a release gate`) : valid(),
    isEnumValue(value.state, PLANNED_MODE_FIELD_STATES) ? valid() : invalid("planned mode field state is invalid"),
    value.dispatch_authority_enabled === false ? valid() : invalid("planned mode field cannot enable dispatch authority"),
    validateNoForbiddenRawPayloads(value, "planned_mode_field")
  ]);
}

export function validateFlowDeskPlannedModeFieldEntryStringV1(entry: unknown): ValidationResult {
  if (typeof entry !== "string" || entry.length === 0 || entry.length > 200) return invalid("planned mode field entry must be a bounded string");
  const parts = entry.split("=");
  if (parts.length !== 2) return invalid("planned mode field entry must be in label=state form");
  const [label, state] = parts;
  return validateFlowDeskPlannedModeFieldV1({ label, state, dispatch_authority_enabled: false });
}

const TOP_TIER_REVIEWER_LANE_PROBE_CHANNELS = ["subtask_true_command_lane", "injected_sdk_client"] as const;
const TOP_TIER_REVIEWER_LANE_PROBE_OUTCOMES = ["probe_pass", "probe_fail_closed", "probe_invalid"] as const;

export function validateTopTierReviewerLaneProbeRequestV1(value: unknown): ValidationResult {
  if (!isRecord(value)) return invalid("top tier reviewer lane probe request must be an object");
  return combine([
    validateSchemaArtifactValue("flowdesk.top_tier_reviewer_lane_probe.request.v1", value),
    rejectForbiddenAuthorityKeys(value, "top tier reviewer lane probe request"),
    validateOpaqueId(value.probe_id, "probe_id"),
    validateOpaqueRef(value.binding_ref, "binding_ref"),
    validateOpaqueRef(value.lane_plan_ref, "lane_plan_ref"),
    isEnumValue(value.channel, TOP_TIER_REVIEWER_LANE_PROBE_CHANNELS) ? valid() : invalid("channel is invalid"),
    value.agent_id === "reviewer" ? valid() : invalid("agent_id must be canonical reviewer"),
    validateConcreteProviderQualifiedModelId(value.provider_qualified_model_id, "probe provider_qualified_model_id"),
    isEnumValue(value.perspective, TOP_TIER_REVIEWER_PERSPECTIVES) ? valid() : invalid("perspective is invalid"),
    validateOpaqueRef(value.auth_evidence_ref, "auth_evidence_ref"),
    validateOpaqueRef(value.usage_evidence_ref, "usage_evidence_ref"),
    validateOpaqueRef(value.quota_evidence_ref, "quota_evidence_ref"),
    validateOpaqueRef(value.provider_health_ref, "provider_health_ref"),
    validateOpaqueRef(value.runtime_echo_ref, "runtime_echo_ref"),
    validateOpaqueRef(value.telemetry_ref, "telemetry_ref"),
    validateOpaqueRef(value.policy_pack_eligibility_ref, "policy_pack_eligibility_ref"),
    typeof value.redaction_version === "string" && value.redaction_version.length > 0 && value.redaction_version.length <= 128 ? validateNoForbiddenRawPayloads(value.redaction_version, "redaction_version") : invalid("redaction_version is required"),
    value.fake_runtime === true ? valid() : invalid("fake_runtime must be true for probe requests"),
    value.dispatch_authority_enabled === false ? valid() : invalid("dispatch_authority_enabled must be false for probe requests"),
    validateNoForbiddenRawPayloads(value, "top_tier_reviewer_lane_probe_request")
  ]);
}

export function validateTopTierReviewerLaneProbeResultV1(value: unknown): ValidationResult {
  if (!isRecord(value)) return invalid("top tier reviewer lane probe result must be an object");
  return combine([
    validateSchemaArtifactValue("flowdesk.top_tier_reviewer_lane_probe.result.v1", value),
    rejectForbiddenAuthorityKeys(value, "top tier reviewer lane probe result"),
    validateOpaqueId(value.probe_id, "probe_id"),
    isEnumValue(value.channel, TOP_TIER_REVIEWER_LANE_PROBE_CHANNELS) ? valid() : invalid("channel is invalid"),
    isEnumValue(value.outcome, TOP_TIER_REVIEWER_LANE_PROBE_OUTCOMES) ? valid() : invalid("outcome is invalid"),
    value.failure_label === undefined || (typeof value.failure_label === "string" && value.failure_label.length > 0 && value.failure_label.length <= 200) ? valid() : invalid("failure_label must be a bounded string when present"),
    value.failure_label === undefined ? valid() : validateNoForbiddenRawPayloads(value.failure_label, "failure_label"),
    validateTimestamp(value.observed_at, "observed_at"),
    validateOpaqueRefArray(value.evidence_refs, "evidence_refs", 20),
    validateStringArray(value.safe_next_actions, "safe_next_actions", SAFE_NEXT_ACTIONS, 8),
    value.dispatch_authority_enabled === false ? valid() : invalid("dispatch_authority_enabled must be false for probe results"),
    value.provider_call_made === false ? valid() : invalid("provider_call_made must be false for probe results"),
    value.lane_launch_made === false ? valid() : invalid("lane_launch_made must be false for probe results"),
    validateNoForbiddenRawPayloads(value, "top_tier_reviewer_lane_probe_result")
  ]);
}
