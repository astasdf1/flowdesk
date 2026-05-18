import assert from "node:assert/strict";
import test from "node:test";
import {
  FLOWDESK_FDS1_FIXTURE_CATALOG,
  FLOWDESK_FDS1_FIXTURE_CATEGORIES,
  FLOWDESK_FDS1_PRE_SPIKE_PRODUCTION_FIXTURE_REGISTRY,
  FLOWDESK_FDS1_UNSUPPORTED_CONTROL_STUB_IDS,
  FLOWDESK_FDS1_UNSUPPORTED_CONTROL_STUBS,
  FLOWDESK_RELEASE_1_COMMAND_MANIFEST,
  getFlowDeskFds1FixtureCatalog,
  getFlowDeskFds1FixtureCatalogEntry,
  getFlowDeskFds1PreSpikeProductionFixtureRegistry,
  getFlowDeskFds1UnsupportedControlStubs,
  getRelease1MinimumToolRegistry,
  getRelease1ProductionToolRegistry,
  RELEASE_1_OPTIONAL_DIAGNOSTIC_TOOL_NAMES,
  validateFlowDeskFds1FixtureCatalogComplete,
  validateFlowDeskFds1FixtureCatalogEntry,
  validateFlowDeskFds1UnsupportedControlStub,
  validateFlowDeskFds1UnsupportedControlStubsComplete,
  validateNoForbiddenRawPayloads,
  validateSchemaArtifactValue
} from "./index.js";

test("FDS-1 fixture catalog covers exactly the 9 minimum tool request and response schemas", () => {
  const expectedRegistry = getRelease1MinimumToolRegistry();
  assert.equal(FLOWDESK_FDS1_FIXTURE_CATALOG.length, 18);
  assert.deepEqual(FLOWDESK_FDS1_FIXTURE_CATALOG.map((entry) => entry.schemaId), expectedRegistry.map((entry) => entry.schemaId));
  assert.deepEqual(getFlowDeskFds1FixtureCatalog(), FLOWDESK_FDS1_FIXTURE_CATALOG);
  assert.equal(validateFlowDeskFds1FixtureCatalogComplete().ok, true);
});

test("FDS-1 fixtures align with registry, schema artifacts, and the inert command manifest", () => {
  for (const fixtureEntry of FLOWDESK_FDS1_FIXTURE_CATALOG) {
    const registryEntry = getRelease1MinimumToolRegistry().find((entry) => entry.schemaId === fixtureEntry.schemaId);
    assert.ok(registryEntry, fixtureEntry.schemaId);
    const manifestEntry = FLOWDESK_RELEASE_1_COMMAND_MANIFEST.find((entry) => entry.toolName === fixtureEntry.toolName);
    assert.ok(manifestEntry, fixtureEntry.toolName);
    assert.equal(fixtureEntry.fixturePrefix, registryEntry.fixturePrefix);
    assert.equal(fixtureEntry.toolName, registryEntry.toolName);
    assert.equal(fixtureEntry.schemaKind, registryEntry.kind);
    assert.equal(fixtureEntry.commandName, manifestEntry.commandName);
    assert.equal(fixtureEntry.schemaKind === "tool_request" ? manifestEntry.requestSchemaId : manifestEntry.responseSchemaId, fixtureEntry.schemaId);
    assert.equal(getFlowDeskFds1FixtureCatalogEntry(fixtureEntry.schemaId), fixtureEntry);
    assert.equal(validateFlowDeskFds1FixtureCatalogEntry(fixtureEntry).ok, true);
  }
});

test("FDS-1 fixture categories include valid, invalid, and redaction metadata with runtime-closed compatibility", () => {
  for (const fixtureEntry of FLOWDESK_FDS1_FIXTURE_CATALOG) {
    assert.deepEqual(Object.keys(fixtureEntry.categories), [...FLOWDESK_FDS1_FIXTURE_CATEGORIES]);
    assert.equal(validateSchemaArtifactValue(fixtureEntry.schemaId, fixtureEntry.categories["valid.minimal"].sample).ok, true);
    assert.equal(validateSchemaArtifactValue(fixtureEntry.schemaId, fixtureEntry.categories["valid.full"].sample).ok, true);
    assert.equal(validateSchemaArtifactValue(fixtureEntry.schemaId, fixtureEntry.categories["invalid.unknown-property"].sample).ok, false);
    assert.equal(validateSchemaArtifactValue(fixtureEntry.schemaId, fixtureEntry.categories["invalid.enum"].sample).ok, false);
    assert.equal(validateSchemaArtifactValue(fixtureEntry.schemaId, fixtureEntry.categories["invalid.length"].sample).ok, false);
    assert.equal(validateNoForbiddenRawPayloads(fixtureEntry.categories["valid.minimal"].sample).ok, true);
    assert.equal(validateNoForbiddenRawPayloads(fixtureEntry.categories["valid.full"].sample).ok, true);
    assert.equal(fixtureEntry.categories["invalid.unknown-property"].expectedValidity, "schema-invalid");
    assert.equal(fixtureEntry.categories["invalid.enum"].expectedValidity, "schema-invalid");
    assert.equal(fixtureEntry.categories["invalid.length"].expectedValidity, "schema-invalid");
    assert.equal(fixtureEntry.categories["redaction.secret-shaped"].expectedValidity, "redaction-blocked");
    assert.equal(fixtureEntry.categories["redaction.prompt-shaped"].expectedValidity, "redaction-blocked");
    assert.equal(validateNoForbiddenRawPayloads(fixtureEntry.categories["redaction.secret-shaped"].sample).ok, false);
    assert.equal(validateNoForbiddenRawPayloads(fixtureEntry.categories["redaction.prompt-shaped"].sample).ok, false);
    for (const category of FLOWDESK_FDS1_FIXTURE_CATEGORIES) {
      const categoryEntry = fixtureEntry.categories[category];
      assert.equal(categoryEntry.productionRegistrationEligible, false);
      assert.equal(categoryEntry.schemaConversionReady, false);
      assert.equal(categoryEntry.runtimeExecution, false);
    }
  }
});

test("FDS-1 unsupported schema control stubs remain explicitly blocked", () => {
  assert.deepEqual(FLOWDESK_FDS1_UNSUPPORTED_CONTROL_STUBS.map((stub) => stub.stubId), [...FLOWDESK_FDS1_UNSUPPORTED_CONTROL_STUB_IDS]);
  assert.deepEqual(getFlowDeskFds1UnsupportedControlStubs(), FLOWDESK_FDS1_UNSUPPORTED_CONTROL_STUBS);
  assert.equal(validateFlowDeskFds1UnsupportedControlStubsComplete().ok, true);
  for (const stub of FLOWDESK_FDS1_UNSUPPORTED_CONTROL_STUBS) {
    assert.equal(stub.blocked, true);
    assert.equal(stub.schemaConversionReady, false);
    assert.equal(stub.schemaCompatibilityReadiness, "blocked_until_fds1_conversion_spike_passes");
    assert.equal(validateFlowDeskFds1UnsupportedControlStub(stub).ok, true);
    assert.equal(validateFlowDeskFds1UnsupportedControlStub({ ...stub, blocked: false }).ok, false);
    assert.equal(validateFlowDeskFds1UnsupportedControlStub({ ...stub, schemaConversionReady: true }).ok, false);
  }
});

test("FDS-1 fixture catalog excludes optional diagnostics from the minimum catalog", () => {
  const catalogToolNames = new Set<string>(FLOWDESK_FDS1_FIXTURE_CATALOG.map((entry) => entry.toolName));
  for (const optionalToolName of RELEASE_1_OPTIONAL_DIAGNOSTIC_TOOL_NAMES) assert.equal(catalogToolNames.has(optionalToolName), false);
  assert.equal(catalogToolNames.has("flowdesk_chat_intake"), false);
  assert.equal(catalogToolNames.has("flowdesk_explain_route"), false);
  assert.equal(catalogToolNames.has("flowdesk_audit"), false);
  assert.equal(FLOWDESK_FDS1_FIXTURE_CATALOG.every((entry) => entry.diagnosticOnly === false), true);
});

test("FDS-1 fixture foundation has no production registration or runtime authority", () => {
  assert.equal(getRelease1ProductionToolRegistry().length, 0);
  assert.equal(FLOWDESK_FDS1_PRE_SPIKE_PRODUCTION_FIXTURE_REGISTRY.length, 0);
  assert.equal(getFlowDeskFds1PreSpikeProductionFixtureRegistry().length, 0);
  for (const fixtureEntry of FLOWDESK_FDS1_FIXTURE_CATALOG) {
    assert.equal(fixtureEntry.productionRegistrationEligible, false);
    assert.equal(fixtureEntry.schemaConversionReady, false);
    assert.equal(fixtureEntry.dispatchApprovalEligible, false);
    assert.equal(fixtureEntry.fallbackAuthority, false);
    assert.equal(fixtureEntry.hardCancelOrNoReplyAuthority, false);
    assert.equal(fixtureEntry.actualLaneLaunch, false);
    assert.equal(fixtureEntry.providerCall, false);
    assert.equal(fixtureEntry.runtimeExecution, false);
    assert.equal(fixtureEntry.schemaCompatibilityStatus, "compatible_runtime_closed_validation");
    assert.equal(fixtureEntry.schemaCompatibilityReadiness, "compatible_with_runtime_closed_validation");
  }
  for (const stub of FLOWDESK_FDS1_UNSUPPORTED_CONTROL_STUBS) {
    assert.equal(stub.productionRegistrationEligible, false);
    assert.equal(stub.dispatchApprovalEligible, false);
    assert.equal(stub.fallbackAuthority, false);
    assert.equal(stub.hardCancelOrNoReplyAuthority, false);
    assert.equal(stub.actualLaneLaunch, false);
    assert.equal(stub.providerCall, false);
    assert.equal(stub.runtimeExecution, false);
  }
});

test("FDS-1 validators fail closed on forged authority, drift, and production readiness", () => {
  const fixtureEntry = FLOWDESK_FDS1_FIXTURE_CATALOG[0];
  assert.ok(fixtureEntry);
  assert.equal(validateFlowDeskFds1FixtureCatalogEntry({ ...fixtureEntry, productionRegistrationEligible: true }).ok, false);
  assert.equal(validateFlowDeskFds1FixtureCatalogEntry({ ...fixtureEntry, schemaConversionReady: true }).ok, false);
  assert.equal(validateFlowDeskFds1FixtureCatalogEntry({ ...fixtureEntry, dispatchApprovalEligible: true }).ok, false);
  assert.equal(validateFlowDeskFds1FixtureCatalogEntry({ ...fixtureEntry, fallbackAuthority: true }).ok, false);
  assert.equal(validateFlowDeskFds1FixtureCatalogEntry({ ...fixtureEntry, hardCancelOrNoReplyAuthority: true }).ok, false);
  assert.equal(validateFlowDeskFds1FixtureCatalogEntry({ ...fixtureEntry, actualLaneLaunch: true }).ok, false);
  assert.equal(validateFlowDeskFds1FixtureCatalogEntry({ ...fixtureEntry, providerCall: true }).ok, false);
  assert.equal(validateFlowDeskFds1FixtureCatalogEntry({ ...fixtureEntry, runtimeExecution: true }).ok, false);
  assert.equal(validateFlowDeskFds1FixtureCatalogEntry({ ...fixtureEntry, fixturePrefix: "forged" }).ok, false);
  assert.equal(validateFlowDeskFds1FixtureCatalogEntry({ ...fixtureEntry, schemaId: "flowdesk.chat_intake.request.v1" }).ok, false);
  assert.equal(validateFlowDeskFds1FixtureCatalogComplete(FLOWDESK_FDS1_FIXTURE_CATALOG.slice(1)).ok, false);
});
