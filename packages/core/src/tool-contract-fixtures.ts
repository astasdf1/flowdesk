import { FLOWDESK_RELEASE_1_COMMAND_MANIFEST, type FlowDeskCommandManifestEntryV1, type FlowDeskRelease1MinimumPortableCommandName, type FlowDeskRelease1MinimumToolName, getFlowDeskCommandManifestEntry } from "./command-manifest.js";
import type { Release1JsonSchemaArtifact, Release1JsonSchemaPropertyArtifact } from "./schema-artifacts.js";
import { getRelease1SchemaArtifact } from "./schema-artifacts.js";
import type { Release1SchemaMetadata } from "./schema-registry.js";
import { getRelease1MinimumToolRegistry, RELEASE_1_OPTIONAL_DIAGNOSTIC_TOOL_NAMES } from "./schema-registry.js";
import type { ValidationResult } from "./validators.js";
import { invalid, valid, validateNoForbiddenRawPayloads, validateSchemaArtifactValue } from "./validators.js";

export const FLOWDESK_FDS1_FIXTURE_CATEGORIES = [
  "valid.minimal",
  "valid.full",
  "invalid.unknown-property",
  "invalid.enum",
  "invalid.length",
  "redaction.secret-shaped",
  "redaction.prompt-shaped"
] as const;

export type FlowDeskFds1FixtureCategory = (typeof FLOWDESK_FDS1_FIXTURE_CATEGORIES)[number];

export const FLOWDESK_FDS1_UNSUPPORTED_CONTROL_STUB_IDS = [
  "unsupported.union",
  "unsupported.nullable",
  "unsupported.mixed-zod-raw",
  "unsupported.raw-json-schema"
] as const;

export type FlowDeskFds1UnsupportedControlStubId = (typeof FLOWDESK_FDS1_UNSUPPORTED_CONTROL_STUB_IDS)[number];

export type FlowDeskFds1FixtureExpectedValidity = "schema-valid" | "schema-invalid" | "redaction-blocked";

export interface FlowDeskFds1InertAuthorityBoundaryV1 {
  productionRegistrationEligible: false;
  schemaConversionReady: false;
  dispatchApprovalEligible: false;
  fallbackAuthority: false;
  hardCancelOrNoReplyAuthority: false;
  actualLaneLaunch: false;
  providerCall: false;
  runtimeExecution: false;
}

export interface FlowDeskFds1FixtureCategoryMetadataV1 extends FlowDeskFds1InertAuthorityBoundaryV1 {
  category: FlowDeskFds1FixtureCategory;
  fixtureMode: "inert_metadata_or_schema_safe_sample";
  expectedValidity: FlowDeskFds1FixtureExpectedValidity;
  description: string;
  sample: Readonly<Record<string, unknown>>;
}

export interface FlowDeskFds1FixtureCatalogEntryV1 extends FlowDeskFds1InertAuthorityBoundaryV1 {
  fixtureId: string;
  fixturePrefix: string;
  commandName: FlowDeskRelease1MinimumPortableCommandName;
  toolName: FlowDeskRelease1MinimumToolName;
  schemaId: string;
  schemaKind: "tool_request" | "tool_response";
  interfaceName: string;
  diagnosticOnly: false;
  schemaCompatibilityStatus: "blocked_missing_schema_conversion_evidence";
  schemaCompatibilityReadiness: "blocked_until_fds1_conversion_spike_passes";
  categories: Readonly<Record<FlowDeskFds1FixtureCategory, FlowDeskFds1FixtureCategoryMetadataV1>>;
}

export interface FlowDeskFds1UnsupportedControlStubV1 extends FlowDeskFds1InertAuthorityBoundaryV1 {
  stubId: FlowDeskFds1UnsupportedControlStubId;
  controlKind: "union" | "nullable" | "mixed-zod-raw" | "raw-json-schema";
  blocked: true;
  diagnosticOnly: false;
  schemaCompatibilityReadiness: "blocked_until_fds1_conversion_spike_passes";
  reason: string;
  sampleArgs: Readonly<Record<string, unknown>>;
}

const inertBoundary = {
  productionRegistrationEligible: false,
  schemaConversionReady: false,
  dispatchApprovalEligible: false,
  fallbackAuthority: false,
  hardCancelOrNoReplyAuthority: false,
  actualLaneLaunch: false,
  providerCall: false,
  runtimeExecution: false
} as const satisfies FlowDeskFds1InertAuthorityBoundaryV1;

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

function authorityBoundaryChecks(value: Record<string, unknown>): ValidationResult {
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

function minimumRegistryEntry(toolName: FlowDeskRelease1MinimumToolName, schemaKind: "tool_request" | "tool_response"): Release1SchemaMetadata {
  const entry = getRelease1MinimumToolRegistry().find((candidate) => candidate.toolName === toolName && candidate.kind === schemaKind);
  if (entry === undefined) throw new Error(`missing Release 1 minimum fixture registry entry for ${toolName} ${schemaKind}`);
  return entry;
}

function sampleValue(fieldName: string, property: Release1JsonSchemaPropertyArtifact, schemaId: string): unknown {
  if (fieldName === "schema_version") return schemaId;
  if (fieldName === "request_id") return "req-fds1-fixture";
  if (fieldName === "input_mode") return "test_fixture";
  if (fieldName === "ok") return false;
  if (fieldName === "status") return "blocked";
  if (fieldName === "safe_next_actions") return ["/flowdesk-status"];
  if (fieldName === "user_message") return "FDS-1 fixture only; production conversion remains blocked.";
  if (fieldName === "run_mode") return "fake-runtime";
  if (fieldName === "resume_mode") return "status_only";
  if (fieldName === "provider_family") return "unknown";
  if (fieldName === "refresh") return false;
  if (fieldName === "artifact_disposition") return "blocked";
  if (fieldName === "cancellation_state") return "cancel_failed";
  if (fieldName === "dispatchability") return "blocked";
  if (fieldName === "freshness") return "unknown";
  if (fieldName === "uncertainty_flags") return ["unknown"];
  if (fieldName === "include_sections" || fieldName === "included_sections") return ["redaction_summary"];
  if (fieldName === "required_approvals" || fieldName === "required_guard_checks" || fieldName === "required_fresh_checks") return ["guard-check-fixture"];
  if (fieldName === "error") {
    return {
      schema_version: "flowdesk.redacted_error.v1",
      category: "schema",
      safe_remediation: "Use inert fixture metadata only."
    };
  }
  if (property.type === "array") return [`${fieldName}-fixture-ref`];
  if (property.type === "object") return { fixture_status: "blocked" };
  if (property.type === "boolean") return false;
  if (property.type === "number") return 0;
  return `${fieldName}-fixture`;
}

function sampleForFields(artifact: Release1JsonSchemaArtifact, schemaId: string, fieldNames: readonly string[]): Record<string, unknown> {
  return Object.fromEntries(fieldNames.map((fieldName) => [fieldName, sampleValue(fieldName, artifact.properties[fieldName], schemaId)]));
}

function validMinimalSample(artifact: Release1JsonSchemaArtifact, schemaId: string): Record<string, unknown> {
  return sampleForFields(artifact, schemaId, artifact.required);
}

function validFullSample(artifact: Release1JsonSchemaArtifact, schemaId: string): Record<string, unknown> {
  return sampleForFields(artifact, schemaId, Object.keys(artifact.properties));
}

function firstStringField(artifact: Release1JsonSchemaArtifact): string {
  return Object.entries(artifact.properties).find(([fieldName, property]) => fieldName !== "schema_version" && property.type === "string")?.[0] ?? "schema_version";
}

function firstBoundedStringField(artifact: Release1JsonSchemaArtifact): string {
  return Object.entries(artifact.properties).find(([fieldName, property]) => fieldName !== "schema_version" && property.type === "string" && property.maxLength !== undefined)?.[0] ?? "schema_version";
}

function invalidEnumSample(artifact: Release1JsonSchemaArtifact, schemaId: string): Record<string, unknown> {
  const sample = validMinimalSample(artifact, schemaId);
  if ("input_mode" in sample) sample.input_mode = "unsupported_input_mode";
  else if ("status" in sample) sample.status = "unsupported_status";
  else sample[firstStringField(artifact)] = "unsupported_enum_value";
  return sample;
}

function invalidLengthSample(artifact: Release1JsonSchemaArtifact, schemaId: string): Record<string, unknown> {
  const sample = validMinimalSample(artifact, schemaId);
  const fieldName = firstBoundedStringField(artifact);
  const maxLength = artifact.properties[fieldName]?.maxLength ?? 128;
  sample[fieldName] = "x".repeat(maxLength + 1);
  return sample;
}

function redactionSample(artifact: Release1JsonSchemaArtifact, schemaId: string, marker: string): Record<string, unknown> {
  const sample = validMinimalSample(artifact, schemaId);
  sample[firstStringField(artifact)] = marker;
  return sample;
}

function categoryMetadata(category: FlowDeskFds1FixtureCategory, expectedValidity: FlowDeskFds1FixtureExpectedValidity, description: string, sample: Record<string, unknown>): FlowDeskFds1FixtureCategoryMetadataV1 {
  return {
    category,
    fixtureMode: "inert_metadata_or_schema_safe_sample",
    expectedValidity,
    description,
    sample,
    ...inertBoundary
  };
}

function categoryFixtures(artifact: Release1JsonSchemaArtifact, schemaId: string): Readonly<Record<FlowDeskFds1FixtureCategory, FlowDeskFds1FixtureCategoryMetadataV1>> {
  const minimal = validMinimalSample(artifact, schemaId);
  const full = validFullSample(artifact, schemaId);
  return {
    "valid.minimal": categoryMetadata("valid.minimal", "schema-valid", "Required-field-only inert FDS-1 fixture sample.", minimal),
    "valid.full": categoryMetadata("valid.full", "schema-valid", "All declared fields populated with schema-safe inert sample values.", full),
    "invalid.unknown-property": categoryMetadata("invalid.unknown-property", "schema-invalid", "Closed-schema negative fixture with an extra property.", { ...minimal, unsupported_fixture_property: "blocked" }),
    "invalid.enum": categoryMetadata("invalid.enum", "schema-invalid", "Enum-like negative fixture metadata; not production conversion evidence.", invalidEnumSample(artifact, schemaId)),
    "invalid.length": categoryMetadata("invalid.length", "schema-invalid", "Length-bound negative fixture metadata; not production conversion evidence.", invalidLengthSample(artifact, schemaId)),
    "redaction.secret-shaped": categoryMetadata("redaction.secret-shaped", "redaction-blocked", "Synthetic credential-shaped probe that must remain redaction-blocked.", redactionSample(artifact, schemaId, "api_key=sk-flowdesk-fixture-redacted")),
    "redaction.prompt-shaped": categoryMetadata("redaction.prompt-shaped", "redaction-blocked", "Synthetic prompt-shaped probe that must remain redaction-blocked.", redactionSample(artifact, schemaId, "system prompt fixture marker redacted"))
  };
}

function fixtureEntry(commandEntry: FlowDeskCommandManifestEntryV1, schemaKind: "tool_request" | "tool_response"): FlowDeskFds1FixtureCatalogEntryV1 {
  const registryEntry = minimumRegistryEntry(commandEntry.toolName, schemaKind);
  const artifact = getRelease1SchemaArtifact(registryEntry.schemaId);
  if (artifact === undefined) throw new Error(`missing schema artifact for ${registryEntry.schemaId}`);
  return {
    fixtureId: `flowdesk-fds1-fixture:${registryEntry.fixturePrefix}:${schemaKind}:v1`,
    fixturePrefix: registryEntry.fixturePrefix,
    commandName: commandEntry.commandName,
    toolName: commandEntry.toolName,
    schemaId: registryEntry.schemaId,
    schemaKind,
    interfaceName: registryEntry.interfaceName,
    diagnosticOnly: false,
    schemaCompatibilityStatus: "blocked_missing_schema_conversion_evidence",
    schemaCompatibilityReadiness: "blocked_until_fds1_conversion_spike_passes",
    categories: categoryFixtures(artifact, registryEntry.schemaId),
    ...inertBoundary
  };
}

export const FLOWDESK_FDS1_FIXTURE_CATALOG = FLOWDESK_RELEASE_1_COMMAND_MANIFEST.flatMap((commandEntry) => [fixtureEntry(commandEntry, "tool_request"), fixtureEntry(commandEntry, "tool_response")]) as readonly FlowDeskFds1FixtureCatalogEntryV1[];

export const FLOWDESK_FDS1_UNSUPPORTED_CONTROL_STUBS = [
  {
    stubId: "unsupported.union",
    controlKind: "union",
    blocked: true,
    diagnosticOnly: false,
    schemaCompatibilityReadiness: "blocked_until_fds1_conversion_spike_passes",
    reason: "FDS-1 has no proven conversion mapping for union controls.",
    sampleArgs: { control: "one-of", fixture_status: "blocked" },
    ...inertBoundary
  },
  {
    stubId: "unsupported.nullable",
    controlKind: "nullable",
    blocked: true,
    diagnosticOnly: false,
    schemaCompatibilityReadiness: "blocked_until_fds1_conversion_spike_passes",
    reason: "FDS-1 has no proven conversion mapping for nullable controls.",
    sampleArgs: { control: "nullable", fixture_status: "blocked" },
    ...inertBoundary
  },
  {
    stubId: "unsupported.mixed-zod-raw",
    controlKind: "mixed-zod-raw",
    blocked: true,
    diagnosticOnly: false,
    schemaCompatibilityReadiness: "blocked_until_fds1_conversion_spike_passes",
    reason: "FDS-1 rejects mixed Zod and raw argument metadata until conversion evidence exists.",
    sampleArgs: { control: "mixed-zod-raw", fixture_status: "blocked" },
    ...inertBoundary
  },
  {
    stubId: "unsupported.raw-json-schema",
    controlKind: "raw-json-schema",
    blocked: true,
    diagnosticOnly: false,
    schemaCompatibilityReadiness: "blocked_until_fds1_conversion_spike_passes",
    reason: "FDS-1 rejects raw JSON Schema argument metadata until conversion evidence exists.",
    sampleArgs: { control: "raw-json-schema", fixture_status: "blocked" },
    ...inertBoundary
  }
] as const satisfies readonly FlowDeskFds1UnsupportedControlStubV1[];

export const FLOWDESK_FDS1_PRE_SPIKE_PRODUCTION_FIXTURE_REGISTRY = [] as const satisfies readonly FlowDeskFds1FixtureCatalogEntryV1[];

export function getFlowDeskFds1FixtureCatalog(): readonly FlowDeskFds1FixtureCatalogEntryV1[] {
  return FLOWDESK_FDS1_FIXTURE_CATALOG;
}

export function getFlowDeskFds1FixtureCatalogEntry(schemaId: string): FlowDeskFds1FixtureCatalogEntryV1 | undefined {
  return FLOWDESK_FDS1_FIXTURE_CATALOG.find((entry) => entry.schemaId === schemaId);
}

export function getFlowDeskFds1UnsupportedControlStubs(): readonly FlowDeskFds1UnsupportedControlStubV1[] {
  return FLOWDESK_FDS1_UNSUPPORTED_CONTROL_STUBS;
}

export function getFlowDeskFds1PreSpikeProductionFixtureRegistry(): readonly FlowDeskFds1FixtureCatalogEntryV1[] {
  return FLOWDESK_FDS1_PRE_SPIKE_PRODUCTION_FIXTURE_REGISTRY;
}

function validateFixtureCategory(schemaId: string, category: FlowDeskFds1FixtureCategory, value: unknown): ValidationResult {
  if (!isRecord(value)) return invalid(`${category} fixture metadata must be an object`);
  const sample = value.sample;
  const sampleIsRecord = isRecord(sample);
  const validSampleResult = sampleIsRecord ? validateSchemaArtifactValue(schemaId, sample) : invalid(`${category} sample must be an object`);
  const redactionResult = sampleIsRecord ? validateNoForbiddenRawPayloads(sample, category) : invalid(`${category} sample must be an object`);
  const expectedValidity = category.startsWith("valid.") ? "schema-valid" : category.startsWith("invalid.") ? "schema-invalid" : "redaction-blocked";
  return combine([
    rejectUnknownProperties(value, [
      "category",
      "fixtureMode",
      "expectedValidity",
      "description",
      "sample",
      "productionRegistrationEligible",
      "schemaConversionReady",
      "dispatchApprovalEligible",
      "fallbackAuthority",
      "hardCancelOrNoReplyAuthority",
      "actualLaneLaunch",
      "providerCall",
      "runtimeExecution"
    ]),
    value.category === category ? valid() : invalid(`${category} metadata category mismatch`),
    value.fixtureMode === "inert_metadata_or_schema_safe_sample" ? valid() : invalid(`${category} fixture mode must remain inert`),
    value.expectedValidity === expectedValidity ? valid() : invalid(`${category} expected validity is wrong`),
    typeof value.description === "string" && value.description.length > 0 ? valid() : invalid(`${category} description is required`),
    authorityBoundaryChecks(value),
    category.startsWith("valid.") ? validSampleResult : valid(),
    category.startsWith("invalid.") && validSampleResult.ok === false ? valid() : category.startsWith("invalid.") ? invalid(`${category} sample must fail schema validation`) : valid(),
    category.startsWith("valid.") && redactionResult.ok === false ? invalid(`${category} valid sample contains redaction-blocked markers`) : valid(),
    category.startsWith("invalid.") && redactionResult.ok === false ? invalid(`${category} invalid sample must not rely on redaction markers`) : valid(),
    category.startsWith("redaction.") && redactionResult.ok === false ? valid() : category.startsWith("redaction.") ? invalid(`${category} redaction probe must be blocked`) : valid()
  ]);
}

export function validateFlowDeskFds1FixtureCatalogEntry(entry: unknown): ValidationResult {
  if (!isRecord(entry)) return invalid("FDS-1 fixture catalog entry must be an object");
  const schemaId = typeof entry.schemaId === "string" ? entry.schemaId : "";
  const registryEntry = getRelease1MinimumToolRegistry().find((candidate) => candidate.schemaId === schemaId);
  const commandEntry = typeof entry.commandName === "string" ? getFlowDeskCommandManifestEntry(entry.commandName as FlowDeskRelease1MinimumPortableCommandName) : undefined;
  const categories = entry.categories;
  const categoryResults = isRecord(categories)
    ? FLOWDESK_FDS1_FIXTURE_CATEGORIES.map((category) => validateFixtureCategory(schemaId, category, categories[category]))
    : [invalid("categories must be an object")];
  const categoryKeys = isRecord(categories) ? Object.keys(categories) : [];
  const exactCategories = JSON.stringify(categoryKeys) === JSON.stringify(FLOWDESK_FDS1_FIXTURE_CATEGORIES);
  return combine([
    rejectUnknownProperties(entry, [
      "fixtureId",
      "fixturePrefix",
      "commandName",
      "toolName",
      "schemaId",
      "schemaKind",
      "interfaceName",
      "diagnosticOnly",
      "schemaCompatibilityStatus",
      "schemaCompatibilityReadiness",
      "categories",
      "productionRegistrationEligible",
      "schemaConversionReady",
      "dispatchApprovalEligible",
      "fallbackAuthority",
      "hardCancelOrNoReplyAuthority",
      "actualLaneLaunch",
      "providerCall",
      "runtimeExecution"
    ]),
    registryEntry !== undefined ? valid() : invalid("schemaId is not a Release 1 minimum registry entry"),
    registryEntry?.toolName === entry.toolName ? valid() : invalid("toolName does not align with registry"),
    registryEntry?.kind === entry.schemaKind ? valid() : invalid("schemaKind does not align with registry"),
    registryEntry?.fixturePrefix === entry.fixturePrefix ? valid() : invalid("fixturePrefix does not align with registry"),
    registryEntry?.interfaceName === entry.interfaceName ? valid() : invalid("interfaceName does not align with registry"),
    registryEntry?.registrationStatus === "registered_minimum" ? valid() : invalid("registry entry must be a minimum registration stub"),
    registryEntry?.toolContract?.schemaCompatibilityReadiness === "blocked_until_fds1_conversion_spike_passes" ? valid() : invalid("registry schema compatibility readiness must remain blocked"),
    commandEntry !== undefined ? valid() : invalid("commandName is not in the minimum command manifest"),
    commandEntry?.toolName === entry.toolName ? valid() : invalid("command/tool mapping does not align with manifest"),
    entry.schemaKind === "tool_request" && commandEntry?.requestSchemaId === entry.schemaId ? valid() : entry.schemaKind === "tool_response" && commandEntry?.responseSchemaId === entry.schemaId ? valid() : invalid("schemaId does not align with command manifest"),
    entry.fixtureId === `flowdesk-fds1-fixture:${entry.fixturePrefix}:${entry.schemaKind}:v1` ? valid() : invalid("fixtureId does not align with fixture prefix and schema kind"),
    entry.diagnosticOnly === false ? valid() : invalid("minimum fixture entries must not be diagnostic-only"),
    RELEASE_1_OPTIONAL_DIAGNOSTIC_TOOL_NAMES.includes(entry.toolName as never) ? invalid("optional diagnostic tools must not appear in the minimum fixture catalog") : valid(),
    entry.schemaCompatibilityStatus === "blocked_missing_schema_conversion_evidence" ? valid() : invalid("schemaCompatibilityStatus must remain blocked"),
    entry.schemaCompatibilityReadiness === "blocked_until_fds1_conversion_spike_passes" ? valid() : invalid("schemaCompatibilityReadiness must remain blocked"),
    exactCategories ? valid() : invalid("fixture categories must exactly match the FDS-1 required categories"),
    authorityBoundaryChecks(entry),
    ...categoryResults
  ]);
}

export function validateFlowDeskFds1FixtureCatalogComplete(catalog: readonly unknown[] = FLOWDESK_FDS1_FIXTURE_CATALOG): ValidationResult {
  const expectedSchemaIds = getRelease1MinimumToolRegistry().map((entry) => entry.schemaId);
  const actualSchemaIds = catalog.map((entry) => (isRecord(entry) ? entry.schemaId : undefined));
  const entryResults = catalog.map((entry) => validateFlowDeskFds1FixtureCatalogEntry(entry));
  return combine([
    catalog.length === expectedSchemaIds.length ? valid() : invalid("fixture catalog must contain exactly the minimum request/response schemas"),
    JSON.stringify(actualSchemaIds) === JSON.stringify(expectedSchemaIds) ? valid() : invalid("fixture catalog schema order or membership is not exact"),
    FLOWDESK_FDS1_PRE_SPIKE_PRODUCTION_FIXTURE_REGISTRY.length === 0 ? valid() : invalid("pre-spike production fixture registry must remain empty"),
    ...entryResults
  ]);
}

export function validateFlowDeskFds1UnsupportedControlStub(stub: unknown): ValidationResult {
  if (!isRecord(stub)) return invalid("unsupported control stub must be an object");
  return combine([
    rejectUnknownProperties(stub, [
      "stubId",
      "controlKind",
      "blocked",
      "diagnosticOnly",
      "schemaCompatibilityReadiness",
      "reason",
      "sampleArgs",
      "productionRegistrationEligible",
      "schemaConversionReady",
      "dispatchApprovalEligible",
      "fallbackAuthority",
      "hardCancelOrNoReplyAuthority",
      "actualLaneLaunch",
      "providerCall",
      "runtimeExecution"
    ]),
    typeof stub.stubId === "string" && FLOWDESK_FDS1_UNSUPPORTED_CONTROL_STUB_IDS.includes(stub.stubId as FlowDeskFds1UnsupportedControlStubId) ? valid() : invalid("stubId is not a required unsupported control"),
    typeof stub.controlKind === "string" && stub.stubId === `unsupported.${stub.controlKind}` ? valid() : invalid("controlKind does not align with stubId"),
    stub.blocked === true ? valid() : invalid("unsupported control must remain blocked"),
    stub.diagnosticOnly === false ? valid() : invalid("unsupported control stubs are not production diagnostics"),
    stub.schemaCompatibilityReadiness === "blocked_until_fds1_conversion_spike_passes" ? valid() : invalid("schema compatibility readiness must remain blocked"),
    typeof stub.reason === "string" && stub.reason.length > 0 ? valid() : invalid("unsupported control reason is required"),
    isRecord(stub.sampleArgs) ? validateNoForbiddenRawPayloads(stub.sampleArgs, String(stub.stubId)) : invalid("sampleArgs must be an object"),
    authorityBoundaryChecks(stub)
  ]);
}

export function validateFlowDeskFds1UnsupportedControlStubsComplete(stubs: readonly unknown[] = FLOWDESK_FDS1_UNSUPPORTED_CONTROL_STUBS): ValidationResult {
  const stubIds = stubs.map((stub) => (isRecord(stub) ? stub.stubId : undefined));
  return combine([
    stubs.length === FLOWDESK_FDS1_UNSUPPORTED_CONTROL_STUB_IDS.length ? valid() : invalid("unsupported control stubs must contain exactly the required blocked controls"),
    JSON.stringify(stubIds) === JSON.stringify(FLOWDESK_FDS1_UNSUPPORTED_CONTROL_STUB_IDS) ? valid() : invalid("unsupported control stub order or membership is not exact"),
    ...stubs.map((stub) => validateFlowDeskFds1UnsupportedControlStub(stub))
  ]);
}
