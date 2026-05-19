import type { Release1PrivilegeClass, Release1SchemaCompatibilityStatus, Release1SchemaMetadata } from "./schema-registry.js";
import { RELEASE_1_PRODUCTION_MINIMUM_TOOL_NAMES, RELEASE_1_SCHEMA_REGISTRY } from "./schema-registry.js";
import type { ValidationResult } from "./validators.js";
import { validateNoForbiddenRawPayloads } from "./validators.js";

export const FLOWDESK_RELEASE_1_MINIMUM_PORTABLE_COMMAND_NAMES = [
  "/flowdesk-doctor",
  "/flowdesk-plan",
  "/flowdesk-run",
  "/flowdesk-status",
  "/flowdesk-resume",
  "/flowdesk-retry",
  "/flowdesk-abort",
  "/flowdesk-usage",
  "/flowdesk-export-debug"
] as const;

export type FlowDeskRelease1MinimumPortableCommandName = (typeof FLOWDESK_RELEASE_1_MINIMUM_PORTABLE_COMMAND_NAMES)[number];
export type FlowDeskRelease1MinimumToolName = (typeof RELEASE_1_PRODUCTION_MINIMUM_TOOL_NAMES)[number];

export interface FlowDeskStaticCommandTemplateV1 {
  templateId: string;
  content: string;
  contentHashLabel: string;
}

export interface FlowDeskCommandManifestEntryV1 {
  commandName: FlowDeskRelease1MinimumPortableCommandName;
  toolName: FlowDeskRelease1MinimumToolName;
  requestSchemaId: string;
  responseSchemaId: string;
  fixturePrefix: string;
  privilegeClass: Release1PrivilegeClass;
  statePreconditions: readonly string[];
  stateOutputs: readonly string[];
  schemaCompatibilityStatus: Release1SchemaCompatibilityStatus;
  schemaCompatibilityReadiness: "compatible_with_runtime_closed_validation";
  productionRegistrationEligible: true;
  dispatchApprovalEligible: false;
  fallbackAuthority: false;
  hardCancelOrNoReplyAuthority: false;
  actualLaneLaunch: false;
  providerCall: false;
  staticTemplate: FlowDeskStaticCommandTemplateV1;
}

const commandToolPairs = [
  ["/flowdesk-doctor", "flowdesk_doctor"],
  ["/flowdesk-plan", "flowdesk_plan"],
  ["/flowdesk-run", "flowdesk_run"],
  ["/flowdesk-status", "flowdesk_status"],
  ["/flowdesk-resume", "flowdesk_resume"],
  ["/flowdesk-retry", "flowdesk_retry"],
  ["/flowdesk-abort", "flowdesk_abort"],
  ["/flowdesk-usage", "flowdesk_usage"],
  ["/flowdesk-export-debug", "flowdesk_export_debug"]
] as const satisfies readonly (readonly [FlowDeskRelease1MinimumPortableCommandName, FlowDeskRelease1MinimumToolName])[];

const commandToTool = new Map<FlowDeskRelease1MinimumPortableCommandName, FlowDeskRelease1MinimumToolName>(commandToolPairs);
const toolToCommand = new Map<FlowDeskRelease1MinimumToolName, FlowDeskRelease1MinimumPortableCommandName>(commandToolPairs.map(([commandName, toolName]) => [toolName, commandName]));

function valid(): ValidationResult {
  return { ok: true, errors: [] };
}

function invalid(...errors: string[]): ValidationResult {
  return { ok: false, errors };
}

function combine(results: readonly ValidationResult[]): ValidationResult {
  const errors = results.flatMap((result) => result.errors);
  return errors.length === 0 ? valid() : invalid(...errors);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function rejectUnknownProperties(value: Record<string, unknown>, allowed: readonly string[]): ValidationResult {
  const unknown = Object.keys(value).filter((key) => !allowed.includes(key));
  return unknown.length === 0 ? valid() : invalid(`unknown properties: ${unknown.join(",")}`);
}

function requireStringArray(value: unknown, label: string): ValidationResult {
  if (!Array.isArray(value)) return invalid(`${label} must be an array`);
  const errors = value.flatMap((item, index) => (typeof item === "string" && item.length > 0 ? [] : [`${label}[${index}] must be a non-empty string`]));
  return errors.length === 0 ? valid() : invalid(...errors);
}

function registryEntry(toolName: FlowDeskRelease1MinimumToolName, kind: "tool_request" | "tool_response"): Release1SchemaMetadata {
  const entry = RELEASE_1_SCHEMA_REGISTRY.find((candidate) => candidate.toolName === toolName && candidate.kind === kind && candidate.release1MinimumTool);
  if (entry === undefined) throw new Error(`missing Release 1 minimum ${kind} registry entry for ${toolName}`);
  return entry;
}

function templateFor(commandName: FlowDeskRelease1MinimumPortableCommandName, toolName: FlowDeskRelease1MinimumToolName, requestEntry: Release1SchemaMetadata, responseEntry: Release1SchemaMetadata): FlowDeskStaticCommandTemplateV1 {
  const commandLabel = commandName.slice(1);
  return {
    templateId: `flowdesk-static-command-template:${commandLabel}:v1`,
    contentHashLabel: `flowdesk-static-template-hash:${commandLabel}:v1`,
    content: [
      `FlowDesk portable command: ${commandName}`,
      `Backed tool: ${toolName}`,
      `Request schema: ${requestEntry.schemaId}`,
      `Response schema: ${responseEntry.schemaId}`,
      `Fixture prefix: ${requestEntry.fixturePrefix}`,
      "Template mode: inert static command manifest.",
      "User action: collect bounded options and return schema-valid redacted refs.",
      "Safety: FDS-1 uses runtime-closed validation; registration is limited to command-backed non-dispatch handlers."
    ].join("\n")
  };
}

function manifestEntry(commandName: FlowDeskRelease1MinimumPortableCommandName, toolName: FlowDeskRelease1MinimumToolName): FlowDeskCommandManifestEntryV1 {
  const requestEntry = registryEntry(toolName, "tool_request");
  const responseEntry = registryEntry(toolName, "tool_response");
  if (requestEntry.fixturePrefix !== responseEntry.fixturePrefix) throw new Error(`fixture prefix mismatch for ${toolName}`);
  if (requestEntry.toolContract === undefined || responseEntry.toolContract === undefined) throw new Error(`missing tool contract metadata for ${toolName}`);
  if (requestEntry.toolContract.privilegeClass !== responseEntry.toolContract.privilegeClass) throw new Error(`privilege class mismatch for ${toolName}`);
  if (requestEntry.toolContract.schemaCompatibilityReadiness !== "compatible_with_runtime_closed_validation") throw new Error(`unexpected schema readiness for ${toolName}`);
  return {
    commandName,
    toolName,
    requestSchemaId: requestEntry.schemaId,
    responseSchemaId: responseEntry.schemaId,
    fixturePrefix: requestEntry.fixturePrefix,
    privilegeClass: requestEntry.toolContract.privilegeClass,
    statePreconditions: requestEntry.toolContract.statePreconditions,
    stateOutputs: requestEntry.toolContract.stateOutputs,
    schemaCompatibilityStatus: requestEntry.toolContract.schemaCompatibilityStatus,
    schemaCompatibilityReadiness: "compatible_with_runtime_closed_validation",
    productionRegistrationEligible: true,
    dispatchApprovalEligible: false,
    fallbackAuthority: false,
    hardCancelOrNoReplyAuthority: false,
    actualLaneLaunch: false,
    providerCall: false,
    staticTemplate: templateFor(commandName, toolName, requestEntry, responseEntry)
  };
}

const unsafeStaticTemplatePatterns = [
  /\$\(/,
  /\$\{/,
  /`/,
  /```[^\n]*(?:bash|fish|powershell|pwsh|sh|shell|zsh)/i,
  /(?:^|\n)\s*(?:bash|fish|powershell|pwsh|sh|shell|zsh)\s*:/i,
  /\bimport\s*\(/i,
  /\b(?:absolute_path|file_path|prompt_body|raw_body|raw_path|raw_prompt|system prompt|developer message|transcript)\b/i,
  /\b(?:provider_payload|provider_response|tool_args|tool_result)\b/i,
  /\bprovider\s+(?:api|call|payload|request|response)\b/i,
  /opencode\s+run/i,
  /\b(?:noReply|no-reply)\b/i,
  /\bhard\s+(?:cancel|chat cancellation|no-reply|stop)\b/i,
  /\b(?:cancel|stop)\s*:\s*(?:enabled|hard|true)\b/i,
  /\bauthority\s*:\s*(?:cancel|dispatch|fallback|noReply|stop)\b/i,
  /\breal\s+(?:opencode\s+)?dispatch\b/i,
  /\bproduction\s+(?:tool\s+)?registration\s+(?:enabled|ready|supported)\b/i,
  /\bdispatch\s+(?:approval|approved|authority|eligible|enabled|ready)\b/i,
  /\bfallback\s+(?:allowed|authority|enabled|model|provider|ready|reselection)\b/i,
  /\b(?:launch|run|start)\s+(?:a\s+)?(?:lane|model|provider|subtask)\b/i,
  /\blane\s+(?:execution|launch|start)\b/i
] as const;

const subprocessModuleMarker = "child_" + "process";
const subprocessFunctionMarkers = ["sp" + "awn", "ex" + "ec", "exec" + "File"] as const;

export const FLOWDESK_RELEASE_1_COMMAND_MANIFEST = commandToolPairs.map(([commandName, toolName]) => manifestEntry(commandName, toolName)) as readonly FlowDeskCommandManifestEntryV1[];

export const FLOWDESK_PRE_SPIKE_PRODUCTION_COMMAND_REGISTRY = [] as const satisfies readonly FlowDeskCommandManifestEntryV1[];

export function getFlowDeskCommandManifestEntry(commandName: FlowDeskRelease1MinimumPortableCommandName): FlowDeskCommandManifestEntryV1 | undefined {
  return FLOWDESK_RELEASE_1_COMMAND_MANIFEST.find((entry) => entry.commandName === commandName);
}

export function getFlowDeskPortableCommandToolName(commandName: FlowDeskRelease1MinimumPortableCommandName): FlowDeskRelease1MinimumToolName | undefined {
  return commandToTool.get(commandName);
}

export function getFlowDeskPreSpikeProductionCommandRegistry(): readonly FlowDeskCommandManifestEntryV1[] {
  return FLOWDESK_PRE_SPIKE_PRODUCTION_COMMAND_REGISTRY;
}

export function validateFlowDeskStaticCommandTemplateSafety(content: unknown): ValidationResult {
  if (typeof content !== "string") return invalid("static template content must be a string");
  if (content.length === 0 || content.length > 2000) return invalid("static template content length is outside 1..2000");
  const markerErrors = unsafeStaticTemplatePatterns.flatMap((pattern) => (pattern.test(content) ? [`static template contains unsafe marker: ${String(pattern)}`] : []));
  if (content.includes(subprocessModuleMarker)) markerErrors.push("static template contains subprocess module marker");
  for (const marker of subprocessFunctionMarkers) {
    if (new RegExp(`\\b${marker}\\b`).test(content)) markerErrors.push(`static template contains subprocess function marker: ${marker}`);
  }
  return combine([markerErrors.length === 0 ? valid() : invalid(...markerErrors), validateNoForbiddenRawPayloads(content, "static_template")]);
}

export function validateFlowDeskCommandManifestEntry(entry: unknown): ValidationResult {
  if (!isRecord(entry)) return invalid("command manifest entry must be an object");
  const base = rejectUnknownProperties(entry, [
    "commandName",
    "toolName",
    "requestSchemaId",
    "responseSchemaId",
    "fixturePrefix",
    "privilegeClass",
    "statePreconditions",
    "stateOutputs",
    "schemaCompatibilityStatus",
    "schemaCompatibilityReadiness",
    "productionRegistrationEligible",
    "dispatchApprovalEligible",
    "fallbackAuthority",
    "hardCancelOrNoReplyAuthority",
    "actualLaneLaunch",
    "providerCall",
    "staticTemplate"
  ]);
  if (base.ok === false) return base;

  if (typeof entry.commandName !== "string" || !FLOWDESK_RELEASE_1_MINIMUM_PORTABLE_COMMAND_NAMES.includes(entry.commandName as FlowDeskRelease1MinimumPortableCommandName)) return invalid("commandName is not a Release 1 minimum portable command");
  if (typeof entry.toolName !== "string" || !RELEASE_1_PRODUCTION_MINIMUM_TOOL_NAMES.includes(entry.toolName as FlowDeskRelease1MinimumToolName)) return invalid("toolName is not a Release 1 minimum tool");
  const commandName = entry.commandName as FlowDeskRelease1MinimumPortableCommandName;
  const toolName = entry.toolName as FlowDeskRelease1MinimumToolName;
  const expectedTool = commandToTool.get(commandName);
  const expectedCommand = toolToCommand.get(toolName);
  if (expectedTool !== toolName || expectedCommand !== commandName) return invalid("command/tool mapping is not canonical");

  const requestEntry = registryEntry(toolName, "tool_request");
  const responseEntry = registryEntry(toolName, "tool_response");
  const contract = requestEntry.toolContract;
  if (contract === undefined) return invalid("registry tool contract is missing");
  const template = entry.staticTemplate;
  const templateResult = isRecord(template)
    ? combine([
        rejectUnknownProperties(template, ["templateId", "content", "contentHashLabel"]),
        typeof template.templateId === "string" && template.templateId.startsWith("flowdesk-static-command-template:") ? valid() : invalid("templateId is invalid"),
        typeof template.contentHashLabel === "string" && template.contentHashLabel.startsWith("flowdesk-static-template-hash:") ? valid() : invalid("contentHashLabel is invalid"),
        validateFlowDeskStaticCommandTemplateSafety(template.content),
        typeof template.content === "string" && template.content.includes(commandName) ? valid() : invalid("static template does not reference command"),
        typeof template.content === "string" && template.content.includes(toolName) ? valid() : invalid("static template does not reference tool"),
        typeof template.content === "string" && template.content.includes(requestEntry.schemaId) ? valid() : invalid("static template does not reference request schema"),
        typeof template.content === "string" && template.content.includes(responseEntry.schemaId) ? valid() : invalid("static template does not reference response schema")
      ])
    : invalid("staticTemplate must be an object");

  return combine([
    base,
    entry.requestSchemaId === requestEntry.schemaId ? valid() : invalid("requestSchemaId does not match registry"),
    entry.responseSchemaId === responseEntry.schemaId ? valid() : invalid("responseSchemaId does not match registry"),
    entry.fixturePrefix === requestEntry.fixturePrefix && entry.fixturePrefix === responseEntry.fixturePrefix ? valid() : invalid("fixturePrefix does not match registry"),
    entry.privilegeClass === contract.privilegeClass ? valid() : invalid("privilegeClass does not match registry"),
    requireStringArray(entry.statePreconditions, "statePreconditions"),
    requireStringArray(entry.stateOutputs, "stateOutputs"),
    JSON.stringify(entry.statePreconditions) === JSON.stringify(contract.statePreconditions) ? valid() : invalid("statePreconditions do not match registry"),
    JSON.stringify(entry.stateOutputs) === JSON.stringify(contract.stateOutputs) ? valid() : invalid("stateOutputs do not match registry"),
    entry.schemaCompatibilityStatus === "compatible_runtime_closed_validation" ? valid() : invalid("schemaCompatibilityStatus must reflect runtime-closed compatibility"),
    entry.schemaCompatibilityReadiness === "compatible_with_runtime_closed_validation" ? valid() : invalid("schemaCompatibilityReadiness must reflect runtime-closed compatibility"),
    entry.productionRegistrationEligible === true ? valid() : invalid("productionRegistrationEligible must be true for Release 1 minimum command-backed handlers"),
    entry.dispatchApprovalEligible === false ? valid() : invalid("dispatchApprovalEligible must be false"),
    entry.fallbackAuthority === false ? valid() : invalid("fallbackAuthority must be false"),
    entry.hardCancelOrNoReplyAuthority === false ? valid() : invalid("hardCancelOrNoReplyAuthority must be false"),
    entry.actualLaneLaunch === false ? valid() : invalid("actualLaneLaunch must be false"),
    entry.providerCall === false ? valid() : invalid("providerCall must be false"),
    templateResult
  ]);
}

export function validateFlowDeskCommandManifestComplete(manifest: readonly unknown[] = FLOWDESK_RELEASE_1_COMMAND_MANIFEST): ValidationResult {
  const commandNames = manifest.map((entry) => (isRecord(entry) ? entry.commandName : undefined));
  const toolNames = manifest.map((entry) => (isRecord(entry) ? entry.toolName : undefined));
  const exactCommands = JSON.stringify(commandNames) === JSON.stringify(FLOWDESK_RELEASE_1_MINIMUM_PORTABLE_COMMAND_NAMES);
  const exactTools = JSON.stringify(toolNames) === JSON.stringify(RELEASE_1_PRODUCTION_MINIMUM_TOOL_NAMES);
  const entryResults = manifest.map((entry) => validateFlowDeskCommandManifestEntry(entry));
  return combine([
    manifest.length === FLOWDESK_RELEASE_1_MINIMUM_PORTABLE_COMMAND_NAMES.length ? valid() : invalid("manifest must contain exactly the Release 1 minimum commands"),
    exactCommands ? valid() : invalid("manifest command order or membership is not exact"),
    exactTools ? valid() : invalid("manifest tool order or membership is not exact"),
    FLOWDESK_PRE_SPIKE_PRODUCTION_COMMAND_REGISTRY.length === 0 ? valid() : invalid("pre-spike production command registry must remain empty"),
    ...entryResults
  ]);
}
