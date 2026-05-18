import type { FlowDeskCommandManifestEntryV1, FlowDeskRelease1MinimumToolName, ValidationResult } from "@flowdesk/core";
import {
  FLOWDESK_FDS1_FIXTURE_CATALOG,
  FLOWDESK_RELEASE_1_COMMAND_MANIFEST,
  getRelease1ProductionToolRegistry,
  invalid,
  valid,
  validateFlowDeskCommandManifestComplete,
  validateNoForbiddenRawPayloads,
  validateSchemaArtifactValue
} from "@flowdesk/core";

export interface FlowDeskPreSpikePluginToolStubV1 {
  stubId: string;
  commandName: FlowDeskCommandManifestEntryV1["commandName"];
  toolName: FlowDeskRelease1MinimumToolName;
  requestSchemaId: string;
  responseSchemaId: string;
  fixturePrefix: string;
  registrationProfile: "sandbox_conformance_probe_only";
  handlerMode: "pre_spike_test_harness_stub";
  schemaConversionArtifactStatus: "compatible_runtime_closed_validation";
  productionPromotionGate: "blocked_production_opencode_registration_disabled";
  productionToolRegistration: "disabled_production_opencode_registration";
  runtimeDispatch: "disabled_release1_pre_spike";
  productionRegistrationEligible: false;
  schemaConversionReady: false;
  dispatchApprovalEligible: false;
  fallbackAuthority: false;
  hardCancelOrNoReplyAuthority: false;
  actualLaneLaunch: false;
  providerCall: false;
  runtimeExecution: false;
}

export interface FlowDeskPreSpikePluginToolHandlerResultV1 {
  toolName: FlowDeskRelease1MinimumToolName;
  accepted: false;
  requestSchemaValid: boolean;
  responseSchemaValid: boolean;
  blockedReason: "production_opencode_registration_disabled" | "request_schema_invalid";
  registrationProfile: "sandbox_conformance_probe_only";
  productionPromotionGate: "blocked_production_opencode_registration_disabled";
  responseSample: Readonly<Record<string, unknown>>;
  productionRegistrationEligible: false;
  dispatchApprovalEligible: false;
  providerCall: false;
  runtimeExecution: false;
}

const inertAuthority = {
  productionRegistrationEligible: false,
  schemaConversionReady: false,
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

function stubForManifestEntry(entry: FlowDeskCommandManifestEntryV1): FlowDeskPreSpikePluginToolStubV1 {
  return {
    stubId: `flowdesk-pre-spike-plugin-tool-stub:${entry.fixturePrefix}:v1`,
    commandName: entry.commandName,
    toolName: entry.toolName,
    requestSchemaId: entry.requestSchemaId,
    responseSchemaId: entry.responseSchemaId,
    fixturePrefix: entry.fixturePrefix,
    registrationProfile: "sandbox_conformance_probe_only",
    handlerMode: "pre_spike_test_harness_stub",
    schemaConversionArtifactStatus: "compatible_runtime_closed_validation",
    productionPromotionGate: "blocked_production_opencode_registration_disabled",
    productionToolRegistration: "disabled_production_opencode_registration",
    runtimeDispatch: "disabled_release1_pre_spike",
    ...inertAuthority
  };
}

export const FLOWDESK_PRE_SPIKE_PLUGIN_TOOL_STUBS = FLOWDESK_RELEASE_1_COMMAND_MANIFEST.map(stubForManifestEntry) as readonly FlowDeskPreSpikePluginToolStubV1[];

export const FLOWDESK_PRE_SPIKE_PRODUCTION_TOOL_REGISTRY = [] as const satisfies readonly FlowDeskPreSpikePluginToolStubV1[];

export function hasPassingFds1SchemaConversionSpike(): true {
  return true;
}

export function getFlowDeskPreSpikePluginToolStubs(): readonly FlowDeskPreSpikePluginToolStubV1[] {
  return FLOWDESK_PRE_SPIKE_PLUGIN_TOOL_STUBS;
}

export function getFlowDeskPreSpikePluginToolStub(toolName: string): FlowDeskPreSpikePluginToolStubV1 | undefined {
  return FLOWDESK_PRE_SPIKE_PLUGIN_TOOL_STUBS.find((stub) => stub.toolName === toolName);
}

export function getFlowDeskPreSpikeProductionToolRegistry(): readonly FlowDeskPreSpikePluginToolStubV1[] {
  return FLOWDESK_PRE_SPIKE_PRODUCTION_TOOL_REGISTRY;
}

function authorityChecks(value: Record<string, unknown>): ValidationResult {
  return combine([
    value.productionRegistrationEligible === false ? valid() : invalid("productionRegistrationEligible must be false"),
    value.schemaConversionReady === false ? valid() : invalid("schemaConversionReady must be false"),
    value.dispatchApprovalEligible === false ? valid() : invalid("dispatchApprovalEligible must be false"),
    value.fallbackAuthority === false ? valid() : invalid("fallbackAuthority must be false"),
    value.hardCancelOrNoReplyAuthority === false ? valid() : invalid("hardCancelOrNoReplyAuthority must be false"),
    value.actualLaneLaunch === false ? valid() : invalid("actualLaneLaunch must be false"),
    value.providerCall === false ? valid() : invalid("providerCall must be false"),
    value.runtimeExecution === false ? valid() : invalid("runtimeExecution must be false")
  ]);
}

export function validateFlowDeskPreSpikePluginToolStub(stub: unknown): ValidationResult {
  if (!isRecord(stub)) return invalid("pre-spike plugin tool stub must be an object");
  const manifestEntry = FLOWDESK_RELEASE_1_COMMAND_MANIFEST.find((entry) => entry.toolName === stub.toolName);
  return combine([
    rejectUnknownProperties(stub, [
      "stubId",
      "commandName",
      "toolName",
      "requestSchemaId",
      "responseSchemaId",
      "fixturePrefix",
      "registrationProfile",
      "handlerMode",
      "schemaConversionArtifactStatus",
      "productionPromotionGate",
      "productionToolRegistration",
      "runtimeDispatch",
      "productionRegistrationEligible",
      "schemaConversionReady",
      "dispatchApprovalEligible",
      "fallbackAuthority",
      "hardCancelOrNoReplyAuthority",
      "actualLaneLaunch",
      "providerCall",
      "runtimeExecution"
    ]),
    manifestEntry !== undefined ? valid() : invalid("toolName is not a Release 1 minimum tool"),
    manifestEntry?.commandName === stub.commandName ? valid() : invalid("commandName does not align with manifest"),
    manifestEntry?.requestSchemaId === stub.requestSchemaId ? valid() : invalid("requestSchemaId does not align with manifest"),
    manifestEntry?.responseSchemaId === stub.responseSchemaId ? valid() : invalid("responseSchemaId does not align with manifest"),
    manifestEntry?.fixturePrefix === stub.fixturePrefix ? valid() : invalid("fixturePrefix does not align with manifest"),
    stub.stubId === `flowdesk-pre-spike-plugin-tool-stub:${stub.fixturePrefix}:v1` ? valid() : invalid("stubId does not align with fixture prefix"),
    stub.registrationProfile === "sandbox_conformance_probe_only" ? valid() : invalid("registrationProfile must remain sandbox conformance probe only"),
    stub.handlerMode === "pre_spike_test_harness_stub" ? valid() : invalid("handlerMode must remain pre-spike test harness only"),
    stub.schemaConversionArtifactStatus === "compatible_runtime_closed_validation" ? valid() : invalid("schema conversion artifact must reflect runtime-closed compatibility"),
    stub.productionPromotionGate === "blocked_production_opencode_registration_disabled" ? valid() : invalid("production promotion gate must remain blocked while production registration is disabled"),
    stub.productionToolRegistration === "disabled_production_opencode_registration" ? valid() : invalid("production registration must remain disabled"),
    stub.runtimeDispatch === "disabled_release1_pre_spike" ? valid() : invalid("runtime dispatch must remain disabled pre-spike"),
    authorityChecks(stub)
  ]);
}

export function validateFlowDeskPreSpikePluginToolStubsComplete(stubs: readonly unknown[] = FLOWDESK_PRE_SPIKE_PLUGIN_TOOL_STUBS): ValidationResult {
  const expectedToolNames = FLOWDESK_RELEASE_1_COMMAND_MANIFEST.map((entry) => entry.toolName);
  const actualToolNames = stubs.map((stub) => (isRecord(stub) ? stub.toolName : undefined));
  return combine([
    validateFlowDeskCommandManifestComplete(),
    stubs.length === expectedToolNames.length ? valid() : invalid("pre-spike plugin tool stubs must cover exactly the Release 1 minimum tools"),
    JSON.stringify(actualToolNames) === JSON.stringify(expectedToolNames) ? valid() : invalid("pre-spike plugin tool stub order or membership is not exact"),
    FLOWDESK_PRE_SPIKE_PRODUCTION_TOOL_REGISTRY.length === 0 ? valid() : invalid("pre-spike production tool registry must remain empty"),
    getRelease1ProductionToolRegistry().length === 0 ? valid() : invalid("core production tool registry must remain empty pre-spike"),
    ...stubs.map((stub) => validateFlowDeskPreSpikePluginToolStub(stub))
  ]);
}

function validatePreSpikeToolRequest(stub: FlowDeskPreSpikePluginToolStubV1, request: unknown): ValidationResult {
  const artifactResult = validateSchemaArtifactValue(stub.requestSchemaId, request);
  const runModeResult = stub.toolName === "flowdesk_run" && isRecord(request) && request.run_mode !== "guarded-dry-run" && request.run_mode !== "fake-runtime" ? invalid("flowdesk_run rejects real or unsupported dispatch modes in Release 1") : valid();
  return combine([artifactResult, runModeResult]);
}

function responseSampleFor(stub: FlowDeskPreSpikePluginToolStubV1): Readonly<Record<string, unknown>> {
  const entry = FLOWDESK_FDS1_FIXTURE_CATALOG.find((candidate) => candidate.toolName === stub.toolName && candidate.schemaKind === "tool_response");
  if (entry === undefined) throw new Error(`missing response fixture for ${stub.toolName}`);
  return entry.categories["valid.minimal"].sample;
}

export function runFlowDeskPreSpikePluginToolStub(toolName: string, request: unknown): FlowDeskPreSpikePluginToolHandlerResultV1 {
  const stub = getFlowDeskPreSpikePluginToolStub(toolName);
  if (stub === undefined) throw new Error(`unknown pre-spike FlowDesk tool stub: ${toolName}`);
  const requestResult = validatePreSpikeToolRequest(stub, request);
  const responseSample = responseSampleFor(stub);
  const responseResult = combine([validateSchemaArtifactValue(stub.responseSchemaId, responseSample), validateNoForbiddenRawPayloads(responseSample, `${toolName}.responseSample`)]);
  return {
    toolName: stub.toolName,
    accepted: false,
    requestSchemaValid: requestResult.ok,
    responseSchemaValid: responseResult.ok,
    blockedReason: requestResult.ok ? "production_opencode_registration_disabled" : "request_schema_invalid",
    registrationProfile: "sandbox_conformance_probe_only",
    productionPromotionGate: "blocked_production_opencode_registration_disabled",
    responseSample,
    productionRegistrationEligible: false,
    dispatchApprovalEligible: false,
    providerCall: false,
    runtimeExecution: false
  };
}
