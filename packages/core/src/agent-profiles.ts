import { FLOWDESK_CANONICAL_REVIEW_AGENT_ID } from "./release1-contracts.js";
import type { ValidationResult } from "./validators.js";
import { invalid, valid, validateNoForbiddenRawPayloads, validateOpaqueRef } from "./validators.js";

export interface FlowDeskAgentProfileV1 {
  agent_id: string;
  purpose: string;
  expertise: string[];
  categories: string[];
  use_when: string[];
  do_not_use_when: string[];
  required_inputs: string[];
  output_contract: string;
  allowed_permissions: string[];
  allowed_tools: string[];
  allowed_workflows: string[];
  disallowed_actions: string[];
  reference_sources: string[];
  model_requirements: Record<string, unknown>;
  verification: string[];
  handoff: string;
  escalation: string[];
  mode_eligibility: string[];
}

export interface AgentProfileAliasMigrationV1 {
  from_agent_id: "critic";
  to_agent_id: typeof FLOWDESK_CANONICAL_REVIEW_AGENT_ID;
  audit_ref: string;
  reason: "legacy-reviewer-alias";
}

export interface AgentProfileValidationResult extends ValidationResult {
  canonicalAgentId?: string;
  migration?: AgentProfileAliasMigrationV1;
}

export interface AgentProfileValidationOptions {
  allowAuditedCriticAlias?: boolean;
  auditRef?: string;
}

const requiredFields: (keyof FlowDeskAgentProfileV1)[] = [
  "agent_id",
  "purpose",
  "expertise",
  "categories",
  "use_when",
  "do_not_use_when",
  "required_inputs",
  "output_contract",
  "allowed_permissions",
  "allowed_tools",
  "allowed_workflows",
  "disallowed_actions",
  "reference_sources",
  "model_requirements",
  "verification",
  "handoff",
  "escalation",
  "mode_eligibility"
];

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function arrayFieldIsPresent(value: Record<string, unknown>, key: keyof FlowDeskAgentProfileV1): boolean {
  return Array.isArray(value[key]) && (value[key] as unknown[]).length > 0;
}

function stringArray(value: Record<string, unknown>, key: keyof FlowDeskAgentProfileV1): string[] {
  return Array.isArray(value[key]) ? (value[key] as unknown[]).filter((item): item is string => typeof item === "string") : [];
}

function hasUnsafeAuthorityToken(values: string[]): boolean {
  const unsafe = /(^|[_\s-])(guard|dispatch|approve|approval|authorize|authority|fallback|reselection|no.?reply|hard.?cancel|real.?opencode.?dispatch|real.?dispatch|opencode.?run|spawn|exec|child_process)($|[_\s-])/i;
  return values.some((value) => {
    const normalized = value.toLowerCase().replace(/[^a-z0-9]/g, "");
    return (
      unsafe.test(value) ||
      normalized === "guard" ||
      normalized.includes("guardauthority") ||
      normalized.includes("dispatch") ||
      normalized.includes("fallback") ||
      normalized.includes("reselection") ||
      normalized.includes("noreply") ||
      normalized.includes("hardcancel") ||
      normalized.includes("realopencodedispatch") ||
      normalized.includes("realdispatch") ||
      normalized.includes("opencoderun") ||
      normalized.includes("childprocess") ||
      normalized === "spawn" ||
      normalized === "exec"
    );
  });
}

function hasMandatoryPathTraversal(values: string[]): boolean {
  const unsafePath = /(read this file first|follow this document path|use these docs in this order|\/users\/|\.\.\/|\.\.\\|^\/|[a-z]:\\|omc|omo|\.claude|agents\.md)/i;
  return values.some((value) => unsafePath.test(value));
}

export function validateAgentProfileV1(value: unknown, options: AgentProfileValidationOptions = {}): AgentProfileValidationResult {
  if (!isRecord(value)) return { ...invalid("agent profile must be an object") };
  const errors: string[] = [];
  const unknown = Object.keys(value).filter((key) => !(requiredFields as readonly string[]).includes(key));
  if (unknown.length > 0) errors.push(`unknown properties: ${unknown.join(",")}`);
  for (const field of requiredFields) {
    if (!(field in value)) errors.push(`missing required field: ${field}`);
  }
  for (const field of ["expertise", "categories", "use_when", "do_not_use_when", "required_inputs", "allowed_permissions", "allowed_tools", "allowed_workflows", "disallowed_actions", "reference_sources", "verification", "escalation", "mode_eligibility"] as const) {
    if (field in value && !arrayFieldIsPresent(value, field)) errors.push(`${field} must be a non-empty array`);
    if (field in value && Array.isArray(value[field]) && (value[field] as unknown[]).some((item) => typeof item !== "string")) errors.push(`${field} must contain only strings`);
  }
  if (typeof value.output_contract !== "string" || value.output_contract.length === 0) errors.push("output_contract is required");
  if (typeof value.handoff !== "string" || value.handoff.length === 0) errors.push("handoff is required");
  if (!isRecord(value.model_requirements)) errors.push("model_requirements must be an object");
  if (stringArray(value, "verification").length === 0) errors.push("verification obligations are required");
  if (stringArray(value, "expertise").length === 0 || stringArray(value, "do_not_use_when").length === 0) errors.push("expertise and exclusion boundaries are required");

  if (hasUnsafeAuthorityToken(stringArray(value, "allowed_permissions"))) errors.push("allowed_permissions must not grant Guard, dispatch, fallback, or hard cancellation authority");
  if (hasUnsafeAuthorityToken(stringArray(value, "allowed_workflows"))) errors.push("allowed_workflows must not include real dispatch, fallback, hard cancellation, subprocess, or opencode run workflows");
  if (hasMandatoryPathTraversal([...stringArray(value, "required_inputs"), ...stringArray(value, "reference_sources"), ...stringArray(value, "use_when")])) {
    errors.push("profile must not require mandatory document-path traversal or OMO/OMC/local paths");
  }
  const disallowedActions = stringArray(value, "disallowed_actions").join(" ").toLowerCase();
  for (const requiredBoundary of ["dispatch", "guard", "scope", "verification"]) {
    if (!disallowedActions.includes(requiredBoundary)) errors.push(`disallowed_actions must state ${requiredBoundary} boundary`);
  }

  const agentId = typeof value.agent_id === "string" ? value.agent_id : undefined;
  let canonicalAgentId = agentId;
  let migration: AgentProfileAliasMigrationV1 | undefined;
  if (agentId === "critic") {
    if (!options.allowAuditedCriticAlias || options.auditRef === undefined || !validateOpaqueRef(options.auditRef, "auditRef").ok) {
      errors.push("critic alias requires audited migration to reviewer");
    } else {
      canonicalAgentId = FLOWDESK_CANONICAL_REVIEW_AGENT_ID;
      migration = { from_agent_id: "critic", to_agent_id: FLOWDESK_CANONICAL_REVIEW_AGENT_ID, audit_ref: options.auditRef, reason: "legacy-reviewer-alias" };
    }
  } else if (agentId !== undefined && !/^[a-z][a-z0-9-]*$/.test(agentId)) {
    errors.push("agent_id must be stable kebab-case");
  }

  const serialized = JSON.stringify(value).toLowerCase();
  const forbiddenFragments = [
    "read this file first",
    "follow this document path",
    "use these docs in this order",
    "opencode run",
    "guard bypass",
    "approve dispatch",
    "replace guard",
    "self-approve",
    "suppress verification",
    "scope widening",
    "hard cancellation",
    "no-reply",
    "omc",
    "omo",
    "/users/",
    "../",
    "..\\"
  ];
  for (const fragment of forbiddenFragments) {
    if (serialized.includes(fragment)) errors.push(`agent profile contains forbidden fragment: ${fragment}`);
  }
  const redaction = validateNoForbiddenRawPayloads(value, "agent_profile");
  errors.push(...redaction.errors);

  return errors.length === 0 ? { ...valid(), canonicalAgentId, migration } : { ...invalid(...errors), canonicalAgentId, migration };
}
