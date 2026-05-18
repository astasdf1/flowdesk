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

export type FlowDeskRelease1HandlerReadinessStatusV1 = "diagnostic_scaffold_available" | "core_evaluator_available" | "schema_only_pending";

export interface FlowDeskRelease1HandlerReadinessEntryV1 {
  commandName: FlowDeskCommandManifestEntryV1["commandName"];
  toolName: FlowDeskRelease1MinimumToolName;
  handlerReadiness: FlowDeskRelease1HandlerReadinessStatusV1;
  productionRegistrationEligible: false;
  productionPromotionGate: "blocked_release1_handler_readiness_incomplete";
  realOpenCodeDispatch: false;
  actualLaneLaunch: false;
  providerCall: false;
  runtimeExecution: false;
}

export interface FlowDeskRelease1HandlerReadinessSummaryV1 {
  totalTools: number;
  diagnosticScaffoldAvailable: number;
  coreEvaluatorAvailable: number;
  schemaOnlyPending: number;
  productionReady: false;
  productionPromotionGate: "blocked_release1_handler_readiness_incomplete";
}

export type FlowDeskRelease1ProductionReadinessCheckIdV1 = "handler_readiness" | "schema_evidence" | "guard_boundary" | "audit_write_boundary" | "policy_permission_boundary" | "redaction_boundary" | "disabled_modes" | "production_adapter_boundary";

export type FlowDeskRelease1ProductionReadinessCheckStatusV1 = "passed" | "blocked";

export interface FlowDeskRelease1ProductionReadinessCheckV1 {
  checkId: FlowDeskRelease1ProductionReadinessCheckIdV1;
  status: FlowDeskRelease1ProductionReadinessCheckStatusV1;
  evidenceRef: string;
  blocker: string;
  productionRegistrationEligible: false;
  realOpenCodeDispatch: false;
  actualLaneLaunch: false;
  providerCall: false;
  runtimeExecution: false;
  fallbackAuthority: false;
  hardCancelOrNoReplyAuthority: false;
}

export interface FlowDeskRelease1ProductionReadinessSummaryV1 {
  totalChecks: number;
  passedChecks: number;
  blockedChecks: number;
  productionReady: false;
  productionPromotionGate: "blocked_release1_production_readiness_incomplete";
  blockedReasons: string[];
  productionRegistrationEligible: false;
  realOpenCodeDispatch: false;
  actualLaneLaunch: false;
  providerCall: false;
  runtimeExecution: false;
  fallbackAuthority: false;
  hardCancelOrNoReplyAuthority: false;
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

const diagnosticScaffoldTools = new Set<FlowDeskRelease1MinimumToolName>(["flowdesk_doctor", "flowdesk_resume", "flowdesk_abort", "flowdesk_usage", "flowdesk_export_debug"]);
const coreEvaluatorBackedTools = new Set<FlowDeskRelease1MinimumToolName>(["flowdesk_plan", "flowdesk_run", "flowdesk_status", "flowdesk_retry"]);

function handlerReadinessFor(toolName: FlowDeskRelease1MinimumToolName): FlowDeskRelease1HandlerReadinessStatusV1 {
  if (diagnosticScaffoldTools.has(toolName)) return "diagnostic_scaffold_available";
  if (coreEvaluatorBackedTools.has(toolName)) return "core_evaluator_available";
  return "schema_only_pending";
}

export const FLOWDESK_RELEASE_1_HANDLER_READINESS = FLOWDESK_RELEASE_1_COMMAND_MANIFEST.map((entry) => ({
  commandName: entry.commandName,
  toolName: entry.toolName,
  handlerReadiness: handlerReadinessFor(entry.toolName),
  productionRegistrationEligible: false,
  productionPromotionGate: "blocked_release1_handler_readiness_incomplete",
  realOpenCodeDispatch: false,
  actualLaneLaunch: false,
  providerCall: false,
  runtimeExecution: false
})) as readonly FlowDeskRelease1HandlerReadinessEntryV1[];

export const FLOWDESK_RELEASE_1_PRODUCTION_READINESS_CHECKS = [
  {
    checkId: "handler_readiness",
    status: "passed",
    evidenceRef: "release1-handler-readiness:all-minimum-tools-command-backed",
    blocker: "none"
  },
  {
    checkId: "schema_evidence",
    status: "passed",
    evidenceRef: "fds1-schema-conversion-probe:runtime-closed-compatible",
    blocker: "none"
  },
  {
    checkId: "guard_boundary",
    status: "passed",
    evidenceRef: "release1-guard-boundary:non-dispatch-only",
    blocker: "none"
  },
  {
    checkId: "audit_write_boundary",
    status: "blocked",
    evidenceRef: "release1-production-adapter:audit-write-boundary-missing",
    blocker: "production adapters do not yet bind write-capable handlers to scoped non-dispatch audit/debug/state write intents"
  },
  {
    checkId: "policy_permission_boundary",
    status: "blocked",
    evidenceRef: "release1-production-adapter:permission-boundary-missing",
    blocker: "production adapters do not yet inject and verify fresh scoped non-dispatch permissions at the tool boundary"
  },
  {
    checkId: "redaction_boundary",
    status: "passed",
    evidenceRef: "release1-redaction:forbidden-raw-payload-tests",
    blocker: "none"
  },
  {
    checkId: "disabled_modes",
    status: "passed",
    evidenceRef: "release1-disabled-modes:real-dispatch-fallback-lane-hard-chat-disabled",
    blocker: "none"
  },
  {
    checkId: "production_adapter_boundary",
    status: "blocked",
    evidenceRef: "release1-production-adapter:registration-profile-missing",
    blocker: "default server exposes safe local command-backed tools, but production adapter registration remains blocked until audit/write and permission boundaries are proven"
  }
].map((check) => ({
  ...check,
  productionRegistrationEligible: false,
  realOpenCodeDispatch: false,
  actualLaneLaunch: false,
  providerCall: false,
  runtimeExecution: false,
  fallbackAuthority: false,
  hardCancelOrNoReplyAuthority: false
})) as readonly FlowDeskRelease1ProductionReadinessCheckV1[];

export function hasPassingFds1SchemaConversionSpike(): true {
  return true;
}

export function getFlowDeskRelease1HandlerReadiness(): readonly FlowDeskRelease1HandlerReadinessEntryV1[] {
  return FLOWDESK_RELEASE_1_HANDLER_READINESS;
}

export function getFlowDeskRelease1HandlerReadinessSummary(): FlowDeskRelease1HandlerReadinessSummaryV1 {
  const diagnosticScaffoldAvailable = FLOWDESK_RELEASE_1_HANDLER_READINESS.filter((entry) => entry.handlerReadiness === "diagnostic_scaffold_available").length;
  const coreEvaluatorAvailable = FLOWDESK_RELEASE_1_HANDLER_READINESS.filter((entry) => entry.handlerReadiness === "core_evaluator_available").length;
  const schemaOnlyPending = FLOWDESK_RELEASE_1_HANDLER_READINESS.filter((entry) => entry.handlerReadiness === "schema_only_pending").length;
  return {
    totalTools: FLOWDESK_RELEASE_1_HANDLER_READINESS.length,
    diagnosticScaffoldAvailable,
    coreEvaluatorAvailable,
    schemaOnlyPending,
    productionReady: false,
    productionPromotionGate: "blocked_release1_handler_readiness_incomplete"
  };
}

export function getFlowDeskRelease1ProductionReadinessChecks(): readonly FlowDeskRelease1ProductionReadinessCheckV1[] {
  return FLOWDESK_RELEASE_1_PRODUCTION_READINESS_CHECKS;
}

export function getFlowDeskRelease1ProductionReadinessSummary(): FlowDeskRelease1ProductionReadinessSummaryV1 {
  const blockedReasons = FLOWDESK_RELEASE_1_PRODUCTION_READINESS_CHECKS.filter((entry) => entry.status === "blocked").map((entry) => entry.blocker);
  return {
    totalChecks: FLOWDESK_RELEASE_1_PRODUCTION_READINESS_CHECKS.length,
    passedChecks: FLOWDESK_RELEASE_1_PRODUCTION_READINESS_CHECKS.filter((entry) => entry.status === "passed").length,
    blockedChecks: blockedReasons.length,
    productionReady: false,
    productionPromotionGate: "blocked_release1_production_readiness_incomplete",
    blockedReasons,
    productionRegistrationEligible: false,
    realOpenCodeDispatch: false,
    actualLaneLaunch: false,
    providerCall: false,
    runtimeExecution: false,
    fallbackAuthority: false,
    hardCancelOrNoReplyAuthority: false
  };
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

export function validateFlowDeskRelease1HandlerReadinessEntry(entry: unknown): ValidationResult {
  if (!isRecord(entry)) return invalid("handler readiness entry must be an object");
  const manifestEntry = FLOWDESK_RELEASE_1_COMMAND_MANIFEST.find((candidate) => candidate.toolName === entry.toolName);
  return combine([
    rejectUnknownProperties(entry, ["commandName", "toolName", "handlerReadiness", "productionRegistrationEligible", "productionPromotionGate", "realOpenCodeDispatch", "actualLaneLaunch", "providerCall", "runtimeExecution"]),
    manifestEntry !== undefined ? valid() : invalid("toolName is not a Release 1 minimum tool"),
    manifestEntry?.commandName === entry.commandName ? valid() : invalid("commandName does not align with manifest"),
    manifestEntry === undefined || entry.handlerReadiness === handlerReadinessFor(manifestEntry.toolName) ? valid() : invalid("handlerReadiness does not align with current implementation map"),
    entry.productionRegistrationEligible === false ? valid() : invalid("productionRegistrationEligible must remain false"),
    entry.productionPromotionGate === "blocked_release1_handler_readiness_incomplete" ? valid() : invalid("productionPromotionGate must remain blocked until all handlers are ready"),
    entry.realOpenCodeDispatch === false ? valid() : invalid("realOpenCodeDispatch must remain false"),
    entry.actualLaneLaunch === false ? valid() : invalid("actualLaneLaunch must remain false"),
    entry.providerCall === false ? valid() : invalid("providerCall must remain false"),
    entry.runtimeExecution === false ? valid() : invalid("runtimeExecution must remain false")
  ]);
}

export function validateFlowDeskRelease1HandlerReadiness(readiness: readonly unknown[] = FLOWDESK_RELEASE_1_HANDLER_READINESS): ValidationResult {
  const expectedToolNames = FLOWDESK_RELEASE_1_COMMAND_MANIFEST.map((entry) => entry.toolName);
  const actualToolNames = readiness.map((entry) => (isRecord(entry) ? entry.toolName : undefined));
  const summary = getFlowDeskRelease1HandlerReadinessSummary();
  return combine([
    readiness.length === expectedToolNames.length ? valid() : invalid("handler readiness must cover every Release 1 minimum tool"),
    JSON.stringify(actualToolNames) === JSON.stringify(expectedToolNames) ? valid() : invalid("handler readiness order or membership is not exact"),
    summary.productionReady === false ? valid() : invalid("productionReady must remain false"),
    summary.productionPromotionGate === "blocked_release1_handler_readiness_incomplete" ? valid() : invalid("production promotion gate must remain blocked"),
    ...readiness.map((entry) => validateFlowDeskRelease1HandlerReadinessEntry(entry))
  ]);
}

export function validateFlowDeskRelease1ProductionReadinessCheck(check: unknown): ValidationResult {
  if (!isRecord(check)) return invalid("production readiness check must be an object");
  return combine([
    rejectUnknownProperties(check, ["checkId", "status", "evidenceRef", "blocker", "productionRegistrationEligible", "realOpenCodeDispatch", "actualLaneLaunch", "providerCall", "runtimeExecution", "fallbackAuthority", "hardCancelOrNoReplyAuthority"]),
    ["handler_readiness", "schema_evidence", "guard_boundary", "audit_write_boundary", "policy_permission_boundary", "redaction_boundary", "disabled_modes", "production_adapter_boundary"].includes(String(check.checkId)) ? valid() : invalid("production readiness checkId is invalid"),
    check.status === "passed" || check.status === "blocked" ? valid() : invalid("production readiness status is invalid"),
    typeof check.evidenceRef === "string" && check.evidenceRef.length > 0 && check.evidenceRef.length <= 160 ? validateNoForbiddenRawPayloads(check.evidenceRef, "evidenceRef") : invalid("production readiness evidenceRef is invalid"),
    typeof check.blocker === "string" && check.blocker.length > 0 && check.blocker.length <= 500 ? validateNoForbiddenRawPayloads(check.blocker, "blocker") : invalid("production readiness blocker is invalid"),
    check.status === "passed" && check.blocker !== "none" ? invalid("passed production readiness checks must use blocker none") : valid(),
    check.status === "blocked" && check.blocker === "none" ? invalid("blocked production readiness checks require a blocker") : valid(),
    check.productionRegistrationEligible === false ? valid() : invalid("productionRegistrationEligible must remain false"),
    check.realOpenCodeDispatch === false ? valid() : invalid("realOpenCodeDispatch must remain false"),
    check.actualLaneLaunch === false ? valid() : invalid("actualLaneLaunch must remain false"),
    check.providerCall === false ? valid() : invalid("providerCall must remain false"),
    check.runtimeExecution === false ? valid() : invalid("runtimeExecution must remain false"),
    check.fallbackAuthority === false ? valid() : invalid("fallbackAuthority must remain false"),
    check.hardCancelOrNoReplyAuthority === false ? valid() : invalid("hardCancelOrNoReplyAuthority must remain false")
  ]);
}

export function validateFlowDeskRelease1ProductionReadiness(checks: readonly unknown[] = FLOWDESK_RELEASE_1_PRODUCTION_READINESS_CHECKS): ValidationResult {
  const expectedCheckIds = FLOWDESK_RELEASE_1_PRODUCTION_READINESS_CHECKS.map((entry) => entry.checkId);
  const actualCheckIds = checks.map((entry) => (isRecord(entry) ? entry.checkId : undefined));
  const blockedChecks = checks.filter((entry) => isRecord(entry) && entry.status === "blocked").length;
  return combine([
    checks.length === expectedCheckIds.length ? valid() : invalid("production readiness checks must cover every Release 1 prerequisite"),
    JSON.stringify(actualCheckIds) === JSON.stringify(expectedCheckIds) ? valid() : invalid("production readiness check order or membership is not exact"),
    blockedChecks > 0 ? valid() : invalid("production readiness must remain blocked until adapter prerequisites are implemented"),
    ...checks.map((entry) => validateFlowDeskRelease1ProductionReadinessCheck(entry))
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
