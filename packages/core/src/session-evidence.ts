import { existsSync, lstatSync, readdirSync, readFileSync } from "node:fs";
import { resolve, sep } from "node:path";
import {
  FLOWDESK_SESSION_EVIDENCE_CLASSES,
  sessionEvidenceDirectoryPath,
  sessionEvidenceRecordPath,
  type FlowDeskSessionEvidenceClass
} from "./state-paths.js";
import {
  invalid,
  valid,
  validateNoForbiddenRawPayloads,
  validateOpaqueId,
  validateOpaqueRef,
  type ValidationResult
} from "./validators.js";

const EVIDENCE_SCHEMA_BY_CLASS: Record<FlowDeskSessionEvidenceClass, string> = {
  usage_authority: "flowdesk.managed_dispatch_beta.usage_authority_evidence.v1",
  runtime_echo: "flowdesk.managed_dispatch_beta.runtime_echo_evidence.v1",
  telemetry_correlation: "flowdesk.managed_dispatch_beta.telemetry_correlation.v1"
};

const CLASS_BY_SCHEMA: Record<string, FlowDeskSessionEvidenceClass> = Object.fromEntries(
  (Object.entries(EVIDENCE_SCHEMA_BY_CLASS) as Array<[FlowDeskSessionEvidenceClass, string]>).map(([cls, schema]) => [schema, cls])
);

export interface FlowDeskSessionEvidenceWriteIntentV1 {
  operation: "write_json";
  authority: "redacted_session_support";
  workflowId: string;
  evidenceId: string;
  evidenceClass: FlowDeskSessionEvidenceClass;
  schemaId: string;
  path: string;
  tempPath: string;
  record: Record<string, unknown>;
  fsSafety: "validated_relative_flowdesk_path_only";
  atomicity: { strategy: "temp_then_rename_intent" };
  realOpenCodeDispatch: false;
  actualLaneLaunch: false;
  providerCall: false;
  runtimeExecution: false;
}

export interface FlowDeskSessionEvidencePrepareResult extends ValidationResult {
  writeIntent?: FlowDeskSessionEvidenceWriteIntentV1;
}

export interface FlowDeskSessionEvidenceReloadEntryV1 {
  evidenceClass: FlowDeskSessionEvidenceClass;
  evidenceId: string;
  record: Record<string, unknown>;
  path: string;
}

export interface FlowDeskSessionEvidenceReloadResultV1 extends ValidationResult {
  entries: FlowDeskSessionEvidenceReloadEntryV1[];
  blocked: Array<{ evidenceClass: FlowDeskSessionEvidenceClass; evidenceId: string; reason: string; path: string }>;
  realOpenCodeDispatch: false;
  actualLaneLaunch: false;
  providerCall: false;
  runtimeExecution: false;
}

const disabledEvidenceAuthority = {
  realOpenCodeDispatch: false as const,
  actualLaneLaunch: false as const,
  providerCall: false as const,
  runtimeExecution: false as const
};

function isRecordObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function validateSchemaVersionForClass(record: Record<string, unknown>, evidenceClass: FlowDeskSessionEvidenceClass): ValidationResult {
  const expected = EVIDENCE_SCHEMA_BY_CLASS[evidenceClass];
  return record.schema_version === expected ? valid() : invalid(`evidence schema_version must be ${expected}`);
}

function validateEvidenceShape(record: Record<string, unknown>, evidenceClass: FlowDeskSessionEvidenceClass): ValidationResult {
  const schemaCheck = validateSchemaVersionForClass(record, evidenceClass);
  if (!schemaCheck.ok) return schemaCheck;
  const requiredCommon = ["schema_version"] as const;
  for (const key of requiredCommon) if (!(key in record)) return invalid(`evidence is missing required field: ${key}`);
  return validateNoForbiddenRawPayloads(record, "session_evidence_record");
}

function ensureWorkflowAlignment(record: Record<string, unknown>, workflowId: string): ValidationResult {
  if (!("workflow_id" in record)) return valid();
  return record.workflow_id === workflowId ? valid() : invalid(`evidence workflow_id mismatch: expected ${workflowId}`);
}

export function classifyFlowDeskSessionEvidenceRecord(record: unknown): { ok: true; evidenceClass: FlowDeskSessionEvidenceClass } | { ok: false; errors: string[] } {
  if (!isRecordObject(record)) return { ok: false, errors: ["evidence must be an object"] };
  const schema = record.schema_version;
  if (typeof schema !== "string") return { ok: false, errors: ["evidence schema_version must be a string"] };
  const evidenceClass = CLASS_BY_SCHEMA[schema];
  if (evidenceClass === undefined) return { ok: false, errors: [`evidence schema_version is not a managed session evidence class: ${schema}`] };
  return { ok: true, evidenceClass };
}

export interface FlowDeskSessionEvidencePrepareInputV1 {
  workflowId: string;
  evidenceId: string;
  record: unknown;
}

export function prepareFlowDeskSessionEvidenceWriteIntentV1(input: FlowDeskSessionEvidencePrepareInputV1): FlowDeskSessionEvidencePrepareResult {
  const workflowResult = validateOpaqueId(input.workflowId, "workflow_id");
  if (!workflowResult.ok) return workflowResult;
  const evidenceIdResult = validateOpaqueId(input.evidenceId, "evidence_id");
  if (!evidenceIdResult.ok) return evidenceIdResult;
  const classification = classifyFlowDeskSessionEvidenceRecord(input.record);
  if (!classification.ok) return invalid(...classification.errors);
  if (!isRecordObject(input.record)) return invalid("evidence must be an object");
  const shapeResult = validateEvidenceShape(input.record, classification.evidenceClass);
  if (!shapeResult.ok) return shapeResult;
  const workflowAlignment = ensureWorkflowAlignment(input.record, input.workflowId);
  if (!workflowAlignment.ok) return workflowAlignment;
  const path = sessionEvidenceRecordPath(input.workflowId, classification.evidenceClass, input.evidenceId);
  const schemaId = EVIDENCE_SCHEMA_BY_CLASS[classification.evidenceClass];
  const tempPath = `${path}.tmp-${schemaId.replace(/[^A-Za-z0-9_.-]/g, "-")}`;
  const writeIntent: FlowDeskSessionEvidenceWriteIntentV1 = {
    operation: "write_json",
    authority: "redacted_session_support",
    workflowId: input.workflowId,
    evidenceId: input.evidenceId,
    evidenceClass: classification.evidenceClass,
    schemaId,
    path,
    tempPath,
    record: JSON.parse(JSON.stringify(input.record)) as Record<string, unknown>,
    fsSafety: "validated_relative_flowdesk_path_only",
    atomicity: { strategy: "temp_then_rename_intent" },
    ...disabledEvidenceAuthority
  };
  return { ok: true, errors: [], writeIntent };
}

function safeJoin(rootDir: string, relativePath: string): string {
  const root = resolve(rootDir);
  const target = resolve(root, relativePath);
  const rootPrefix = root.endsWith(sep) ? root : `${root}${sep}`;
  if (target !== root && !target.startsWith(rootPrefix)) throw new Error("evidence target escapes root directory");
  return target;
}

export interface FlowDeskSessionEvidenceReadOptionsV1 {
  workflowId: string;
  rootDir: string;
}

export function reloadFlowDeskSessionEvidenceV1(options: FlowDeskSessionEvidenceReadOptionsV1): FlowDeskSessionEvidenceReloadResultV1 {
  const workflowResult = validateOpaqueId(options.workflowId, "workflow_id");
  if (!workflowResult.ok) {
    return { ok: false, errors: workflowResult.errors, entries: [], blocked: [], ...disabledEvidenceAuthority };
  }
  if (typeof options.rootDir !== "string" || options.rootDir.length === 0) {
    return { ok: false, errors: ["rootDir is required"], entries: [], blocked: [], ...disabledEvidenceAuthority };
  }
  const entries: FlowDeskSessionEvidenceReloadEntryV1[] = [];
  const blocked: FlowDeskSessionEvidenceReloadResultV1["blocked"] = [];
  const errors: string[] = [];
  for (const evidenceClass of FLOWDESK_SESSION_EVIDENCE_CLASSES) {
    const relativeDir = sessionEvidenceDirectoryPath(options.workflowId, evidenceClass);
    let absoluteDir: string;
    try {
      absoluteDir = safeJoin(options.rootDir, relativeDir);
    } catch (error) {
      errors.push(error instanceof Error ? error.message : `evidence ${evidenceClass} root escape`);
      continue;
    }
    if (!existsSync(absoluteDir)) continue;
    const stat = lstatSync(absoluteDir);
    if (stat.isSymbolicLink()) {
      errors.push(`evidence ${evidenceClass} root must not be a symlink`);
      continue;
    }
    if (!stat.isDirectory()) {
      errors.push(`evidence ${evidenceClass} target is not a directory`);
      continue;
    }
    const fileNames = readdirSync(absoluteDir).filter((name) => name.endsWith(".json"));
    for (const fileName of fileNames) {
      const evidenceId = fileName.slice(0, -5);
      const refValidation = validateOpaqueRef(evidenceId, `${evidenceClass}.evidence_id`);
      if (!refValidation.ok) {
        blocked.push({ evidenceClass, evidenceId, reason: refValidation.errors.join("; "), path: `${relativeDir}/${fileName}` });
        continue;
      }
      const expectedRelative = sessionEvidenceRecordPath(options.workflowId, evidenceClass, evidenceId);
      let filePath: string;
      try {
        filePath = safeJoin(options.rootDir, expectedRelative);
      } catch (error) {
        blocked.push({ evidenceClass, evidenceId, reason: error instanceof Error ? error.message : "evidence path escape", path: expectedRelative });
        continue;
      }
      let raw: string;
      try {
        raw = readFileSync(filePath, "utf8");
      } catch (error) {
        blocked.push({ evidenceClass, evidenceId, reason: error instanceof Error ? error.message : "evidence read failed", path: expectedRelative });
        continue;
      }
      let parsed: unknown;
      try {
        parsed = JSON.parse(raw);
      } catch (error) {
        blocked.push({ evidenceClass, evidenceId, reason: error instanceof Error ? error.message : "evidence parse failed", path: expectedRelative });
        continue;
      }
      if (!isRecordObject(parsed)) {
        blocked.push({ evidenceClass, evidenceId, reason: "evidence must be an object", path: expectedRelative });
        continue;
      }
      const shape = validateEvidenceShape(parsed, evidenceClass);
      if (!shape.ok) {
        blocked.push({ evidenceClass, evidenceId, reason: shape.errors.join("; "), path: expectedRelative });
        continue;
      }
      const alignment = ensureWorkflowAlignment(parsed, options.workflowId);
      if (!alignment.ok) {
        blocked.push({ evidenceClass, evidenceId, reason: alignment.errors.join("; "), path: expectedRelative });
        continue;
      }
      entries.push({ evidenceClass, evidenceId, record: parsed, path: expectedRelative });
    }
  }
  const reloadResult: FlowDeskSessionEvidenceReloadResultV1 = {
    ok: errors.length === 0,
    errors,
    entries,
    blocked,
    ...disabledEvidenceAuthority
  };
  return reloadResult;
}
