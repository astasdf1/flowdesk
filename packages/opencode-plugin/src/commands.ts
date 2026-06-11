import { mkdirSync, renameSync, writeFileSync } from "node:fs";
import { dirname, resolve, sep } from "node:path";
import type { FlowDeskCommandManifestEntryV1, FlowDeskRelease1MinimumPortableCommandName, FlowDeskRelease1MinimumToolName, ValidationResult } from "@flowdesk/core";
import {
  FLOWDESK_RELEASE_1_COMMAND_MANIFEST,
  FLOWDESK_RELEASE_1_MINIMUM_PORTABLE_COMMAND_NAMES,
  getFlowDeskPreSpikeProductionCommandRegistry,
  invalid,
  valid,
  validateFlowDeskCommandManifestComplete,
  validateFlowDeskStaticCommandTemplateSafety,
  validateNoForbiddenRawPayloads
} from "@flowdesk/core";
import { getFlowDeskPreSpikePluginToolStub, hasPassingFds1SchemaConversionSpike } from "./tool-stubs.js";

export interface FlowDeskPortableCommandFileArtifactV1 {
  commandFileId: string;
  commandName: FlowDeskRelease1MinimumPortableCommandName;
  commandFileName: string;
  commandProfileRelativePath: string;
  toolName: FlowDeskRelease1MinimumToolName;
  requestSchemaId: string;
  responseSchemaId: string;
  fixturePrefix: string;
  aliasMode: "portable_only_pre_conformance";
  generationMode: "inert_static_command_file_artifact";
  writeMode: "not_written_pre_spike_artifact";
  commandContent: string;
  productionRegistrationEligible: false;
  schemaConversionReady: false;
  commandAliasEligible: false;
  dispatchApprovalEligible: false;
  fallbackAuthority: false;
  hardCancelOrNoReplyAuthority: false;
  actualLaneLaunch: false;
  providerCall: false;
  runtimeExecution: false;
}

export interface FlowDeskDesiredAliasGateArtifactV1 {
  aliasGateId: string;
  desiredAlias: `/flowdesk:${string}`;
  portableFallbackCommand: FlowDeskRelease1MinimumPortableCommandName;
  portableCommandFileName: string;
  toolName: FlowDeskRelease1MinimumToolName;
  conformanceMode: "portable_only_pre_conformance";
  aliasGenerationMode: "blocked_until_alias_conformance_passes";
  aliasWriteMode: "not_written_pre_conformance_artifact";
  requiredConformanceRef: "missing_pinned_alias_parser_conformance";
  productionRegistrationEligible: false;
  schemaConversionReady: false;
  commandAliasEligible: false;
  dispatchApprovalEligible: false;
  fallbackAuthority: false;
  hardCancelOrNoReplyAuthority: false;
  actualLaneLaunch: false;
  providerCall: false;
  runtimeExecution: false;
}

export interface FlowDeskPortableCommandMaterializationResultV1 extends ValidationResult {
  profileRootDir?: string;
  writtenCommandRefs?: string[];
  commandFilesWritten: number;
  aliasFilesWritten: 0;
  productionRegistrationEligible: false;
  commandAliasEligible: false;
  dispatchApprovalEligible: false;
  fallbackAuthority: false;
  hardCancelOrNoReplyAuthority: false;
  actualLaneLaunch: false;
  providerCall: false;
  runtimeExecution: false;
}

const inertAuthority = {
  productionRegistrationEligible: false,
  schemaConversionReady: false,
  commandAliasEligible: false,
  dispatchApprovalEligible: false,
  fallbackAuthority: false,
  hardCancelOrNoReplyAuthority: false,
  actualLaneLaunch: false,
  providerCall: false,
  runtimeExecution: false
} as const;

const materializationDisabledAuthority = {
  productionRegistrationEligible: false,
  commandAliasEligible: false,
  dispatchApprovalEligible: false,
  fallbackAuthority: false,
  hardCancelOrNoReplyAuthority: false,
  actualLaneLaunch: false,
  providerCall: false,
  runtimeExecution: false
} as const;

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

function commandSlug(commandName: FlowDeskRelease1MinimumPortableCommandName): string {
  return commandName.slice(1);
}

function commandFileName(commandName: FlowDeskRelease1MinimumPortableCommandName): string {
  return `${commandSlug(commandName)}.md`;
}

function preferredWrapperFor(commandName: FlowDeskRelease1MinimumPortableCommandName): string {
  switch (commandName) {
    case "/flowdesk-doctor":
      return "flowdesk_check";
    case "/flowdesk-plan":
      return "flowdesk_plan_short";
    case "/flowdesk-run":
      return "flowdesk_run_short or flowdesk_task";
    case "/flowdesk-status":
      return "flowdesk_now";
    case "/flowdesk-resume":
      return "flowdesk_resume_status or flowdesk_task";
    case "/flowdesk-retry":
      return "flowdesk_retry_diag or flowdesk_task";
    case "/flowdesk-abort":
      return "flowdesk_abort_cmd";
    case "/flowdesk-usage":
      return "flowdesk_quota";
    case "/flowdesk-export-debug":
      return "flowdesk_debug";
  }
}

function commandContentFor(entry: FlowDeskCommandManifestEntryV1): string {
  return [
    `FlowDesk portable command file: ${entry.commandName}`,
    `Preferred agent-facing wrapper: ${preferredWrapperFor(entry.commandName)}`,
    `Internal low-level schema stub, not the preferred agent-facing wrapper: ${entry.toolName}`,
    `Request schema: ${entry.requestSchemaId}`,
    `Response schema: ${entry.responseSchemaId}`,
    `Fixture prefix: ${entry.fixturePrefix}`,
    "Mode: Active FlowDesk command.",
    "Alias mode: portable command only until conformance promotes aliases.",
    "Safety: FDS-1 uses FlowDesk runtime-closed validation.",
    "Runtime: Enabled via FlowDesk Managed Dispatch Beta (Release 2.5)."
  ].join("\n");
}

function commandFileArtifact(entry: FlowDeskCommandManifestEntryV1): FlowDeskPortableCommandFileArtifactV1 {
  const fileName = commandFileName(entry.commandName);
  return {
    commandFileId: `flowdesk-portable-command-file:${entry.fixturePrefix}:v1`,
    commandName: entry.commandName,
    commandFileName: fileName,
    commandProfileRelativePath: `commands/${fileName}`,
    toolName: entry.toolName,
    requestSchemaId: entry.requestSchemaId,
    responseSchemaId: entry.responseSchemaId,
    fixturePrefix: entry.fixturePrefix,
    aliasMode: "portable_only_pre_conformance",
    generationMode: "inert_static_command_file_artifact",
    writeMode: "not_written_pre_spike_artifact",
    commandContent: commandContentFor(entry),
    ...inertAuthority
  };
}

export const FLOWDESK_PORTABLE_COMMAND_FILE_ARTIFACTS = FLOWDESK_RELEASE_1_COMMAND_MANIFEST.map(commandFileArtifact) as readonly FlowDeskPortableCommandFileArtifactV1[];

export const FLOWDESK_PRE_SPIKE_WRITTEN_COMMAND_FILE_REGISTRY = [] as const satisfies readonly FlowDeskPortableCommandFileArtifactV1[];

function desiredAliasFor(commandName: FlowDeskRelease1MinimumPortableCommandName): `/flowdesk:${string}` {
  return `/flowdesk:${commandSlug(commandName).replace(/^flowdesk-/, "")}` as `/flowdesk:${string}`;
}

function aliasGateArtifact(commandArtifact: FlowDeskPortableCommandFileArtifactV1): FlowDeskDesiredAliasGateArtifactV1 {
  return {
    aliasGateId: `flowdesk-desired-alias-gate:${commandArtifact.fixturePrefix}:v1`,
    desiredAlias: desiredAliasFor(commandArtifact.commandName),
    portableFallbackCommand: commandArtifact.commandName,
    portableCommandFileName: commandArtifact.commandFileName,
    toolName: commandArtifact.toolName,
    conformanceMode: "portable_only_pre_conformance",
    aliasGenerationMode: "blocked_until_alias_conformance_passes",
    aliasWriteMode: "not_written_pre_conformance_artifact",
    requiredConformanceRef: "missing_pinned_alias_parser_conformance",
    ...inertAuthority
  };
}

export const FLOWDESK_DESIRED_ALIAS_GATE_ARTIFACTS = FLOWDESK_PORTABLE_COMMAND_FILE_ARTIFACTS.map(aliasGateArtifact) as readonly FlowDeskDesiredAliasGateArtifactV1[];

export const FLOWDESK_PRE_CONFORMANCE_WRITTEN_ALIAS_REGISTRY = [] as const satisfies readonly FlowDeskDesiredAliasGateArtifactV1[];

export function getFlowDeskPortableCommandFileArtifacts(): readonly FlowDeskPortableCommandFileArtifactV1[] {
  return FLOWDESK_PORTABLE_COMMAND_FILE_ARTIFACTS;
}

export function getFlowDeskPortableCommandFileArtifact(commandName: string): FlowDeskPortableCommandFileArtifactV1 | undefined {
  return FLOWDESK_PORTABLE_COMMAND_FILE_ARTIFACTS.find((artifact) => artifact.commandName === commandName);
}

export function getFlowDeskPreSpikeWrittenCommandFileRegistry(): readonly FlowDeskPortableCommandFileArtifactV1[] {
  return FLOWDESK_PRE_SPIKE_WRITTEN_COMMAND_FILE_REGISTRY;
}

export function getFlowDeskDesiredAliasGateArtifacts(): readonly FlowDeskDesiredAliasGateArtifactV1[] {
  return FLOWDESK_DESIRED_ALIAS_GATE_ARTIFACTS;
}

export function getFlowDeskDesiredAliasGateArtifact(desiredAlias: string): FlowDeskDesiredAliasGateArtifactV1 | undefined {
  return FLOWDESK_DESIRED_ALIAS_GATE_ARTIFACTS.find((artifact) => artifact.desiredAlias === desiredAlias);
}

export function getFlowDeskPreConformanceWrittenAliasRegistry(): readonly FlowDeskDesiredAliasGateArtifactV1[] {
  return FLOWDESK_PRE_CONFORMANCE_WRITTEN_ALIAS_REGISTRY;
}

function validatePortableCommandFileName(commandName: unknown, fileName: unknown): ValidationResult {
  if (typeof commandName !== "string" || !FLOWDESK_RELEASE_1_MINIMUM_PORTABLE_COMMAND_NAMES.includes(commandName as FlowDeskRelease1MinimumPortableCommandName)) return invalid("commandName is not a Release 1 minimum portable command");
  if (fileName !== commandFileName(commandName as FlowDeskRelease1MinimumPortableCommandName)) return invalid("commandFileName does not match portable command");
  if (typeof fileName !== "string" || !/^flowdesk-[a-z-]+\.md$/.test(fileName)) return invalid("commandFileName is not portable");
  if (fileName.includes(":") || fileName.includes("/") || fileName.includes("\\")) return invalid("commandFileName contains platform-sensitive characters");
  return valid();
}

function authorityChecks(value: Record<string, unknown>): ValidationResult {
  return combine([
    value.productionRegistrationEligible === false ? valid() : invalid("productionRegistrationEligible must be false"),
    value.schemaConversionReady === false ? valid() : invalid("schemaConversionReady must be false"),
    value.commandAliasEligible === false ? valid() : invalid("commandAliasEligible must be false"),
    value.dispatchApprovalEligible === false ? valid() : invalid("dispatchApprovalEligible must be false"),
    value.fallbackAuthority === false ? valid() : invalid("fallbackAuthority must be false"),
    value.hardCancelOrNoReplyAuthority === false ? valid() : invalid("hardCancelOrNoReplyAuthority must be false"),
    value.actualLaneLaunch === false ? valid() : invalid("actualLaneLaunch must be false"),
    value.providerCall === false ? valid() : invalid("providerCall must be false"),
    value.runtimeExecution === false ? valid() : invalid("runtimeExecution must be false")
  ]);
}

function validateCommandContent(artifact: Record<string, unknown>, manifestEntry: FlowDeskCommandManifestEntryV1 | undefined): ValidationResult {
  const content = artifact.commandContent;
  if (typeof content !== "string") return invalid("commandContent must be a string");
  return combine([
    validateFlowDeskStaticCommandTemplateSafety(content),
    validateNoForbiddenRawPayloads(content, "commandContent"),
    manifestEntry !== undefined && content.includes(manifestEntry.commandName) ? valid() : invalid("commandContent does not reference command"),
    manifestEntry !== undefined && content.includes(manifestEntry.toolName) ? valid() : invalid("commandContent does not reference tool"),
    manifestEntry !== undefined && content.includes(manifestEntry.requestSchemaId) ? valid() : invalid("commandContent does not reference request schema"),
    manifestEntry !== undefined && content.includes(manifestEntry.responseSchemaId) ? valid() : invalid("commandContent does not reference response schema"),
    /\$\(|\$\{|```|`/.test(content) ? invalid("commandContent contains shell or interpolation marker") : valid()
  ]);
}

export function validateFlowDeskPortableCommandFileArtifact(artifact: unknown): ValidationResult {
  if (!isRecord(artifact)) return invalid("portable command file artifact must be an object");
  const manifestEntry = FLOWDESK_RELEASE_1_COMMAND_MANIFEST.find((entry) => entry.commandName === artifact.commandName);
  const toolStub = typeof artifact.toolName === "string" ? getFlowDeskPreSpikePluginToolStub(artifact.toolName) : undefined;
  return combine([
    rejectUnknownProperties(artifact, [
      "commandFileId",
      "commandName",
      "commandFileName",
      "commandProfileRelativePath",
      "toolName",
      "requestSchemaId",
      "responseSchemaId",
      "fixturePrefix",
      "aliasMode",
      "generationMode",
      "writeMode",
      "commandContent",
      "productionRegistrationEligible",
      "schemaConversionReady",
      "commandAliasEligible",
      "dispatchApprovalEligible",
      "fallbackAuthority",
      "hardCancelOrNoReplyAuthority",
      "actualLaneLaunch",
      "providerCall",
      "runtimeExecution"
    ]),
    validatePortableCommandFileName(artifact.commandName, artifact.commandFileName),
    manifestEntry !== undefined ? valid() : invalid("commandName is not in the Release 1 command manifest"),
    manifestEntry?.toolName === artifact.toolName ? valid() : invalid("toolName does not align with command manifest"),
    manifestEntry?.requestSchemaId === artifact.requestSchemaId ? valid() : invalid("requestSchemaId does not align with command manifest"),
    manifestEntry?.responseSchemaId === artifact.responseSchemaId ? valid() : invalid("responseSchemaId does not align with command manifest"),
    manifestEntry?.fixturePrefix === artifact.fixturePrefix ? valid() : invalid("fixturePrefix does not align with command manifest"),
    toolStub !== undefined ? valid() : invalid("pre-spike plugin tool stub is missing"),
    toolStub?.requestSchemaId === artifact.requestSchemaId ? valid() : invalid("request schema does not align with plugin tool stub"),
    artifact.commandFileId === `flowdesk-portable-command-file:${artifact.fixturePrefix}:v1` ? valid() : invalid("commandFileId does not align with fixture prefix"),
    artifact.commandProfileRelativePath === `commands/${artifact.commandFileName}` ? valid() : invalid("commandProfileRelativePath must remain commands/<portable-file>.md"),
    artifact.aliasMode === "portable_only_pre_conformance" ? valid() : invalid("aliasMode must remain portable-only pre-conformance"),
    artifact.generationMode === "inert_static_command_file_artifact" ? valid() : invalid("generationMode must remain inert"),
    artifact.writeMode === "not_written_pre_spike_artifact" ? valid() : invalid("writeMode must not write files pre-spike"),
    hasPassingFds1SchemaConversionSpike() === true ? valid() : invalid("FDS-1 runtime-closed schema compatibility must remain passing"),
    validateCommandContent(artifact, manifestEntry),
    authorityChecks(artifact)
  ]);
}

export function validateFlowDeskPortableCommandFileArtifactsComplete(artifacts: readonly unknown[] = FLOWDESK_PORTABLE_COMMAND_FILE_ARTIFACTS): ValidationResult {
  const expectedCommandNames = FLOWDESK_RELEASE_1_COMMAND_MANIFEST.map((entry) => entry.commandName);
  const actualCommandNames = artifacts.map((artifact) => (isRecord(artifact) ? artifact.commandName : undefined));
  return combine([
    validateFlowDeskCommandManifestComplete(),
    artifacts.length === expectedCommandNames.length ? valid() : invalid("portable command file artifacts must cover exactly the Release 1 minimum commands"),
    JSON.stringify(actualCommandNames) === JSON.stringify(expectedCommandNames) ? valid() : invalid("portable command file artifact order or membership is not exact"),
    FLOWDESK_PRE_SPIKE_WRITTEN_COMMAND_FILE_REGISTRY.length === 0 ? valid() : invalid("pre-spike written command file registry must remain empty"),
    getFlowDeskPreSpikeProductionCommandRegistry().length === 0 ? valid() : invalid("pre-spike production command registry must remain empty"),
    ...artifacts.map((artifact) => validateFlowDeskPortableCommandFileArtifact(artifact))
  ]);
}

function resolveProfileCommandPath(profileRootDir: string, artifact: FlowDeskPortableCommandFileArtifactV1): { root: string; target: string; temp: string } {
  const root = resolve(profileRootDir);
  const target = resolve(root, artifact.commandProfileRelativePath);
  const temp = resolve(root, `${artifact.commandProfileRelativePath}.tmp-${artifact.fixturePrefix}`);
  const rootPrefix = root.endsWith(sep) ? root : `${root}${sep}`;
  if (target !== root && !target.startsWith(rootPrefix)) throw new Error("portable command target escapes profile root");
  if (temp !== root && !temp.startsWith(rootPrefix)) throw new Error("portable command temp target escapes profile root");
  return { root, target, temp };
}

export function materializeFlowDeskPortableCommandFiles(profileRootDir: string, artifacts: readonly FlowDeskPortableCommandFileArtifactV1[] = FLOWDESK_PORTABLE_COMMAND_FILE_ARTIFACTS): FlowDeskPortableCommandMaterializationResultV1 {
  if (typeof profileRootDir !== "string" || profileRootDir.trim().length === 0) return { ...invalid("profileRootDir is required"), commandFilesWritten: 0, aliasFilesWritten: 0, ...materializationDisabledAuthority };
  const completeness = validateFlowDeskPortableCommandFileArtifactsComplete(artifacts);
  if (!completeness.ok) return { ...invalid(...completeness.errors), commandFilesWritten: 0, aliasFilesWritten: 0, ...materializationDisabledAuthority };
  const writtenCommandRefs: string[] = [];
  try {
    const root = resolve(profileRootDir);
    for (const artifact of artifacts) {
      const resolved = resolveProfileCommandPath(root, artifact);
      mkdirSync(dirname(resolved.target), { recursive: true });
      writeFileSync(resolved.temp, `${artifact.commandContent}\n`, "utf8");
      renameSync(resolved.temp, resolved.target);
      writtenCommandRefs.push(artifact.commandProfileRelativePath);
    }
    return { ...valid(), profileRootDir: root, writtenCommandRefs, commandFilesWritten: writtenCommandRefs.length, aliasFilesWritten: 0, ...materializationDisabledAuthority };
  } catch (error) {
    return { ...invalid(error instanceof Error ? error.message : "portable command materialization failed"), writtenCommandRefs, commandFilesWritten: writtenCommandRefs.length, aliasFilesWritten: 0, ...materializationDisabledAuthority };
  }
}

function validateDesiredAliasName(value: unknown): ValidationResult {
  if (typeof value !== "string") return invalid("desiredAlias must be a string");
  if (!/^\/flowdesk:[a-z-]+$/.test(value)) return invalid("desiredAlias must use the blocked colon alias shape");
  if (value.includes("/") && !value.startsWith("/flowdesk:")) return invalid("desiredAlias contains an unsafe slash");
  return valid();
}

export function validateFlowDeskDesiredAliasGateArtifact(artifact: unknown): ValidationResult {
  if (!isRecord(artifact)) return invalid("desired alias gate artifact must be an object");
  const commandArtifact = typeof artifact.portableFallbackCommand === "string" ? getFlowDeskPortableCommandFileArtifact(artifact.portableFallbackCommand) : undefined;
  return combine([
    rejectUnknownProperties(artifact, [
      "aliasGateId",
      "desiredAlias",
      "portableFallbackCommand",
      "portableCommandFileName",
      "toolName",
      "conformanceMode",
      "aliasGenerationMode",
      "aliasWriteMode",
      "requiredConformanceRef",
      "productionRegistrationEligible",
      "schemaConversionReady",
      "commandAliasEligible",
      "dispatchApprovalEligible",
      "fallbackAuthority",
      "hardCancelOrNoReplyAuthority",
      "actualLaneLaunch",
      "providerCall",
      "runtimeExecution"
    ]),
    validateDesiredAliasName(artifact.desiredAlias),
    commandArtifact !== undefined ? valid() : invalid("portableFallbackCommand is not a Release 1 command artifact"),
    commandArtifact !== undefined && artifact.desiredAlias === desiredAliasFor(commandArtifact.commandName) ? valid() : invalid("desiredAlias does not align with portable fallback command"),
    commandArtifact?.commandFileName === artifact.portableCommandFileName ? valid() : invalid("portableCommandFileName does not align with fallback command"),
    commandArtifact?.toolName === artifact.toolName ? valid() : invalid("toolName does not align with fallback command"),
    commandArtifact !== undefined && artifact.aliasGateId === `flowdesk-desired-alias-gate:${commandArtifact.fixturePrefix}:v1` ? valid() : invalid("aliasGateId does not align with fixture prefix"),
    artifact.conformanceMode === "portable_only_pre_conformance" ? valid() : invalid("conformanceMode must remain portable-only pre-conformance"),
    artifact.aliasGenerationMode === "blocked_until_alias_conformance_passes" ? valid() : invalid("aliasGenerationMode must remain blocked"),
    artifact.aliasWriteMode === "not_written_pre_conformance_artifact" ? valid() : invalid("aliasWriteMode must not write aliases pre-conformance"),
    artifact.requiredConformanceRef === "missing_pinned_alias_parser_conformance" ? valid() : invalid("requiredConformanceRef must remain missing before conformance passes"),
    hasPassingFds1SchemaConversionSpike() === true ? valid() : invalid("FDS-1 runtime-closed schema compatibility must remain passing"),
    authorityChecks(artifact)
  ]);
}

export function validateFlowDeskDesiredAliasGateArtifactsComplete(artifacts: readonly unknown[] = FLOWDESK_DESIRED_ALIAS_GATE_ARTIFACTS): ValidationResult {
  const expectedAliases = FLOWDESK_RELEASE_1_MINIMUM_PORTABLE_COMMAND_NAMES.map(desiredAliasFor);
  const actualAliases = artifacts.map((artifact) => (isRecord(artifact) ? artifact.desiredAlias : undefined));
  return combine([
    validateFlowDeskPortableCommandFileArtifactsComplete(),
    artifacts.length === expectedAliases.length ? valid() : invalid("desired alias gate artifacts must cover exactly the Release 1 minimum commands"),
    JSON.stringify(actualAliases) === JSON.stringify(expectedAliases) ? valid() : invalid("desired alias gate order or membership is not exact"),
    FLOWDESK_PRE_CONFORMANCE_WRITTEN_ALIAS_REGISTRY.length === 0 ? valid() : invalid("pre-conformance written alias registry must remain empty"),
    ...artifacts.map((artifact) => validateFlowDeskDesiredAliasGateArtifact(artifact))
  ]);
}
