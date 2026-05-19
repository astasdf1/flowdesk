import assert from "node:assert/strict";
import test from "node:test";
import {
  FLOWDESK_FDS1_FIXTURE_CATALOG,
  FLOWDESK_RELEASE_1_COMMAND_MANIFEST,
  getRelease1ProductionToolRegistry
} from "@flowdesk/core";
import {
  FLOWDESK_PRE_SPIKE_PLUGIN_TOOL_STUBS,
  FLOWDESK_PRE_SPIKE_PRODUCTION_TOOL_REGISTRY,
  FLOWDESK_RELEASE_1_HANDLER_READINESS,
  FLOWDESK_RELEASE_1_PRODUCTION_READINESS_CHECKS,
  getFlowDeskPreSpikePluginToolStub,
  getFlowDeskPreSpikePluginToolStubs,
  getFlowDeskPreSpikeProductionToolRegistry,
  getFlowDeskRelease1HandlerReadiness,
  getFlowDeskRelease1HandlerReadinessSummary,
  getFlowDeskRelease1ProductionReadinessChecks,
  getFlowDeskRelease1ProductionReadinessSummary,
  hasPassingFds1SchemaConversionSpike,
  runFlowDeskPreSpikePluginToolStub,
  validateFlowDeskPreSpikePluginToolStub,
  validateFlowDeskPreSpikePluginToolStubsComplete,
  validateFlowDeskRelease1HandlerReadiness,
  validateFlowDeskRelease1HandlerReadinessEntry,
  validateFlowDeskRelease1ProductionReadiness,
  validateFlowDeskRelease1ProductionReadinessCheck
} from "./index.js";

test("pre-spike plugin tool stubs stay sandbox-only while Release 1 registers command-backed tools", () => {
  assert.equal(hasPassingFds1SchemaConversionSpike(), true);
  assert.equal(FLOWDESK_PRE_SPIKE_PLUGIN_TOOL_STUBS.length, 9);
  assert.deepEqual(
    FLOWDESK_PRE_SPIKE_PLUGIN_TOOL_STUBS.map((stub) => stub.toolName),
    FLOWDESK_RELEASE_1_COMMAND_MANIFEST.map((entry) => entry.toolName)
  );
  assert.deepEqual(getFlowDeskPreSpikePluginToolStubs(), FLOWDESK_PRE_SPIKE_PLUGIN_TOOL_STUBS);
  assert.deepEqual(getFlowDeskPreSpikeProductionToolRegistry(), FLOWDESK_PRE_SPIKE_PRODUCTION_TOOL_REGISTRY);
  assert.equal(FLOWDESK_PRE_SPIKE_PRODUCTION_TOOL_REGISTRY.length, 0);
  assert.deepEqual(
    [...new Set(getRelease1ProductionToolRegistry().map((entry) => entry.toolName))].sort(),
    FLOWDESK_RELEASE_1_COMMAND_MANIFEST.map((entry) => entry.toolName).sort()
  );
  assert.equal(validateFlowDeskPreSpikePluginToolStubsComplete().ok, true);
});

test("pre-spike plugin tool stub metadata remains blocked and non-authorizing", () => {
  for (const stub of FLOWDESK_PRE_SPIKE_PLUGIN_TOOL_STUBS) {
    const manifestEntry = FLOWDESK_RELEASE_1_COMMAND_MANIFEST.find((entry) => entry.toolName === stub.toolName);
    assert.ok(manifestEntry, stub.toolName);
    assert.equal(stub.commandName, manifestEntry.commandName);
    assert.equal(stub.requestSchemaId, manifestEntry.requestSchemaId);
    assert.equal(stub.responseSchemaId, manifestEntry.responseSchemaId);
    assert.equal(stub.fixturePrefix, manifestEntry.fixturePrefix);
    assert.equal(stub.registrationProfile, "sandbox_conformance_probe_only");
    assert.equal(stub.handlerMode, "pre_spike_test_harness_stub");
    assert.equal(stub.schemaConversionArtifactStatus, "compatible_runtime_closed_validation");
    assert.equal(stub.productionPromotionGate, "blocked_production_opencode_registration_disabled");
    assert.equal(stub.productionToolRegistration, "disabled_production_opencode_registration");
    assert.equal(stub.runtimeDispatch, "disabled_release1_pre_spike");
    assert.equal(stub.productionRegistrationEligible, false);
    assert.equal(stub.schemaConversionReady, false);
    assert.equal(stub.dispatchApprovalEligible, false);
    assert.equal(stub.fallbackAuthority, false);
    assert.equal(stub.hardCancelOrNoReplyAuthority, false);
    assert.equal(stub.actualLaneLaunch, false);
    assert.equal(stub.providerCall, false);
    assert.equal(stub.runtimeExecution, false);
    assert.equal(getFlowDeskPreSpikePluginToolStub(stub.toolName), stub);
    assert.equal(validateFlowDeskPreSpikePluginToolStub(stub).ok, true);
  }
});

test("Release 1 handler readiness tracks command-backed production-eligible tools", () => {
  assert.deepEqual(
    FLOWDESK_RELEASE_1_HANDLER_READINESS.map((entry) => entry.toolName),
    FLOWDESK_RELEASE_1_COMMAND_MANIFEST.map((entry) => entry.toolName)
  );
  assert.deepEqual(getFlowDeskRelease1HandlerReadiness(), FLOWDESK_RELEASE_1_HANDLER_READINESS);
  assert.equal(validateFlowDeskRelease1HandlerReadiness().ok, true);

  const summary = getFlowDeskRelease1HandlerReadinessSummary();
  assert.deepEqual(summary, {
    totalTools: 9,
    diagnosticScaffoldAvailable: 5,
    coreEvaluatorAvailable: 4,
    schemaOnlyPending: 0,
    productionReady: true,
    productionPromotionGate: "release1_command_backed_handlers_ready"
  });

  const readinessByTool = Object.fromEntries(FLOWDESK_RELEASE_1_HANDLER_READINESS.map((entry) => [entry.toolName, entry.handlerReadiness]));
  assert.equal(readinessByTool.flowdesk_doctor, "diagnostic_scaffold_available");
  assert.equal(readinessByTool.flowdesk_plan, "core_evaluator_available");
  assert.equal(readinessByTool.flowdesk_run, "core_evaluator_available");
  assert.equal(readinessByTool.flowdesk_status, "core_evaluator_available");
  assert.equal(readinessByTool.flowdesk_retry, "core_evaluator_available");
  assert.equal(readinessByTool.flowdesk_resume, "diagnostic_scaffold_available");
  assert.equal(readinessByTool.flowdesk_abort, "diagnostic_scaffold_available");
  assert.equal(readinessByTool.flowdesk_usage, "diagnostic_scaffold_available");
  assert.equal(readinessByTool.flowdesk_export_debug, "diagnostic_scaffold_available");

  for (const entry of FLOWDESK_RELEASE_1_HANDLER_READINESS) {
    assert.equal(entry.productionRegistrationEligible, true);
    assert.equal(entry.productionPromotionGate, "release1_command_backed_handlers_ready");
    assert.equal(entry.realOpenCodeDispatch, false);
    assert.equal(entry.actualLaneLaunch, false);
    assert.equal(entry.providerCall, false);
    assert.equal(entry.runtimeExecution, false);
    assert.equal(validateFlowDeskRelease1HandlerReadinessEntry(entry).ok, true);
  }
});

test("pre-spike plugin tool stub runner validates fixtures but never accepts execution", () => {
  for (const stub of FLOWDESK_PRE_SPIKE_PLUGIN_TOOL_STUBS) {
    const requestFixture = FLOWDESK_FDS1_FIXTURE_CATALOG.find((entry) => entry.toolName === stub.toolName && entry.schemaKind === "tool_request");
    assert.ok(requestFixture, stub.toolName);
    const validResult = runFlowDeskPreSpikePluginToolStub(stub.toolName, requestFixture.categories["valid.minimal"].sample);
    assert.equal(validResult.accepted, false);
    assert.equal(validResult.requestSchemaValid, true);
    assert.equal(validResult.responseSchemaValid, true);
    assert.equal(validResult.blockedReason, "production_opencode_registration_disabled");
    assert.equal(validResult.registrationProfile, "sandbox_conformance_probe_only");
    assert.equal(validResult.productionPromotionGate, "blocked_production_opencode_registration_disabled");
    assert.equal(validResult.productionRegistrationEligible, false);
    assert.equal(validResult.dispatchApprovalEligible, false);
    assert.equal(validResult.providerCall, false);
    assert.equal(validResult.runtimeExecution, false);

    const invalidResult = runFlowDeskPreSpikePluginToolStub(stub.toolName, requestFixture.categories["invalid.unknown-property"].sample);
    assert.equal(invalidResult.accepted, false);
    assert.equal(invalidResult.requestSchemaValid, false);
    assert.equal(invalidResult.responseSchemaValid, true);
    assert.equal(invalidResult.blockedReason, "request_schema_invalid");
  }
});

test("Release 1 production readiness is limited to non-dispatch registration", () => {
  assert.deepEqual(getFlowDeskRelease1ProductionReadinessChecks(), FLOWDESK_RELEASE_1_PRODUCTION_READINESS_CHECKS);
  assert.equal(validateFlowDeskRelease1ProductionReadiness().ok, true);

  const summary = getFlowDeskRelease1ProductionReadinessSummary();
  assert.equal(summary.totalChecks, 8);
  assert.equal(summary.passedChecks, 8);
  assert.equal(summary.blockedChecks, 0);
  assert.equal(summary.productionReady, true);
  assert.equal(summary.productionPromotionGate, "release1_non_dispatch_registration_ready");
  assert.equal(summary.productionRegistrationEligible, true);
  assert.equal(summary.realOpenCodeDispatch, false);
  assert.equal(summary.providerCall, false);
  assert.equal(summary.runtimeExecution, false);
  assert.equal(summary.fallbackAuthority, false);
  assert.equal(summary.hardCancelOrNoReplyAuthority, false);
  assert.deepEqual(summary.blockedReasons, []);

  for (const check of FLOWDESK_RELEASE_1_PRODUCTION_READINESS_CHECKS) {
    assert.equal(check.productionRegistrationEligible, true, check.checkId);
    assert.equal(check.realOpenCodeDispatch, false, check.checkId);
    assert.equal(check.actualLaneLaunch, false, check.checkId);
    assert.equal(check.providerCall, false, check.checkId);
    assert.equal(check.runtimeExecution, false, check.checkId);
    assert.equal(check.fallbackAuthority, false, check.checkId);
    assert.equal(check.hardCancelOrNoReplyAuthority, false, check.checkId);
    assert.equal(validateFlowDeskRelease1ProductionReadinessCheck(check).ok, true, check.checkId);
  }
});

test("pre-spike plugin tool stubs reject forged authority and Release 1 real dispatch", () => {
  const runStub = getFlowDeskPreSpikePluginToolStub("flowdesk_run");
  assert.ok(runStub);
  const runRequestFixture = FLOWDESK_FDS1_FIXTURE_CATALOG.find((entry) => entry.toolName === "flowdesk_run" && entry.schemaKind === "tool_request");
  assert.ok(runRequestFixture);
  const realDispatchAttempt = runFlowDeskPreSpikePluginToolStub("flowdesk_run", {
    ...runRequestFixture.categories["valid.minimal"].sample,
    run_mode: "real-opencode-dispatch"
  });
  assert.equal(realDispatchAttempt.accepted, false);
  assert.equal(realDispatchAttempt.requestSchemaValid, false);
  assert.equal(realDispatchAttempt.blockedReason, "request_schema_invalid");
  assert.equal(validateFlowDeskPreSpikePluginToolStub({ ...runStub, productionRegistrationEligible: true }).ok, false);
  assert.equal(validateFlowDeskPreSpikePluginToolStub({ ...runStub, registrationProfile: "production" }).ok, false);
  assert.equal(validateFlowDeskPreSpikePluginToolStub({ ...runStub, productionPromotionGate: "passed" }).ok, false);
  assert.equal(validateFlowDeskPreSpikePluginToolStub({ ...runStub, schemaConversionReady: true }).ok, false);
  assert.equal(validateFlowDeskPreSpikePluginToolStub({ ...runStub, dispatchApprovalEligible: true }).ok, false);
  assert.equal(validateFlowDeskPreSpikePluginToolStub({ ...runStub, providerCall: true }).ok, false);
  const readyRun = FLOWDESK_RELEASE_1_HANDLER_READINESS.find((entry) => entry.toolName === "flowdesk_run");
  assert.ok(readyRun);
  assert.equal(validateFlowDeskRelease1HandlerReadinessEntry({ ...readyRun, productionRegistrationEligible: false }).ok, false);
  assert.equal(validateFlowDeskRelease1HandlerReadinessEntry({ ...readyRun, realOpenCodeDispatch: true }).ok, false);
  assert.equal(validateFlowDeskRelease1HandlerReadinessEntry({ ...readyRun, handlerReadiness: "schema_only_pending" }).ok, false);
  assert.equal(validateFlowDeskRelease1HandlerReadiness(FLOWDESK_RELEASE_1_HANDLER_READINESS.filter((entry) => entry.toolName !== "flowdesk_abort")).ok, false);
  const productionCheck = FLOWDESK_RELEASE_1_PRODUCTION_READINESS_CHECKS[0];
  assert.ok(productionCheck);
  assert.equal(validateFlowDeskRelease1ProductionReadinessCheck({ ...productionCheck, productionRegistrationEligible: false }).ok, false);
  assert.equal(validateFlowDeskRelease1ProductionReadinessCheck({ ...productionCheck, blocker: "raw provider payload" }).ok, false);
  assert.equal(validateFlowDeskRelease1ProductionReadiness(FLOWDESK_RELEASE_1_PRODUCTION_READINESS_CHECKS.map((entry, index) => index === 0 ? { ...entry, status: "blocked" as const, blocker: "missing scoped evidence" } : entry)).ok, false);
  assert.equal(validateFlowDeskRelease1ProductionReadiness(FLOWDESK_RELEASE_1_PRODUCTION_READINESS_CHECKS.filter((entry) => entry.checkId !== "audit_write_boundary")).ok, false);
  assert.equal(validateFlowDeskPreSpikePluginToolStubsComplete(FLOWDESK_PRE_SPIKE_PLUGIN_TOOL_STUBS.slice(1)).ok, false);
});
