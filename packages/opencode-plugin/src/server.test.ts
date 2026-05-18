import assert from "node:assert/strict";
import test from "node:test";
import {
  FLOWDESK_FDS1_FIXTURE_CATALOG,
  FLOWDESK_RELEASE_1_COMMAND_MANIFEST
} from "@flowdesk/core";
import { tool } from "@opencode-ai/plugin";
import {
  getFlowDeskPreSpikeProductionToolRegistry,
  hasPassingFds1SchemaConversionSpike,
  hasProductionOpenCodeRegistration
} from "./index.js";
import flowdeskOpenCodeServerPlugin, {
  createFlowDeskFds1SchemaConversionProbeTools,
  createFlowDeskLocalNonDispatchAdapterTools,
  flowdeskFds1SchemaConversionProbeOption,
  flowdeskLocalNonDispatchAdapterOption,
  flowdeskPreSpikeDoctorToolName
} from "./server.js";

interface LocalAdapterTestResult {
  adapterProfile?: unknown;
  handler?: {
    ok?: unknown;
    handlerMode?: unknown;
    response?: {
      status?: unknown;
      plan_revision_id?: unknown;
      workflow_id?: unknown;
      workflow_state?: unknown;
    };
  };
  localState?: {
    stateWriteApplied?: unknown;
    workflowId?: unknown;
    workflowState?: unknown;
  };
  providerCall?: unknown;
  runtimeExecution?: unknown;
  actualLaneLaunch?: unknown;
}

test("server plugin exposes only an inert pre-spike diagnostic tool", async () => {
  assert.equal(flowdeskOpenCodeServerPlugin.id, "flowdesk");
  assert.equal(hasProductionOpenCodeRegistration(), false);
  assert.equal(hasPassingFds1SchemaConversionSpike(), true);
  assert.equal(getFlowDeskPreSpikeProductionToolRegistry().length, 0);

  const hooks = await flowdeskOpenCodeServerPlugin.server(undefined as never);
  assert.deepEqual(Object.keys(hooks.tool ?? {}), [flowdeskPreSpikeDoctorToolName]);

  const doctor = hooks.tool?.[flowdeskPreSpikeDoctorToolName];
  assert.ok(doctor);
  assert.equal(doctor.description.includes("without enabling production tools"), true);
  assert.deepEqual(doctor.args, {});

  const result = JSON.parse(await doctor.execute({}, undefined as never)) as Record<string, unknown>;
  assert.equal(result.pluginId, "flowdesk");
  assert.equal(result.loaded, true);
  assert.equal(result.probeRegistrationProfile, "disabled");
  assert.equal(result.localNonDispatchAdapterProfile, "disabled");
  assert.equal(result.productionPromotionGate, "blocked_production_opencode_registration_disabled");
  assert.equal(result.productionOpenCodeRegistration, false);
  assert.equal(result.productionToolRegistration, "not-implemented");
  assert.deepEqual(result.release1HandlerReadiness, {
    totalTools: 9,
    diagnosticScaffoldAvailable: 5,
    coreEvaluatorAvailable: 4,
    schemaOnlyPending: 0,
    productionReady: false,
    productionPromotionGate: "blocked_release1_handler_readiness_incomplete"
  });
  assert.deepEqual(result.release1ProductionReadiness, {
    totalChecks: 8,
    passedChecks: 5,
    blockedChecks: 3,
    productionReady: false,
    productionPromotionGate: "blocked_release1_production_readiness_incomplete",
    blockedReasons: [
      "production adapters do not yet bind write-capable handlers to scoped non-dispatch audit/debug/state write intents",
      "production adapters do not yet inject and verify fresh scoped non-dispatch permissions at the tool boundary",
      "server still exposes only inert pre-spike doctor by default and no production non-dispatch adapter profile is registered"
    ],
    productionRegistrationEligible: false,
    realOpenCodeDispatch: false,
    actualLaneLaunch: false,
    providerCall: false,
    runtimeExecution: false,
    fallbackAuthority: false,
    hardCancelOrNoReplyAuthority: false
  });
  assert.equal(result.fds1SchemaConversionSpikePassed, true);
  assert.equal(result.realOpenCodeDispatch, "disabled");
  assert.equal(result.providerCall, false);
  assert.equal(result.runtimeExecution, false);
  assert.equal(result.actualLaneLaunch, false);
  assert.equal(result.fallbackAuthority, false);
  assert.equal(result.hardCancelOrNoReplyAuthority, false);
});

test("server plugin can expose local non-dispatch command-backed tools", async () => {
  const localTools = createFlowDeskLocalNonDispatchAdapterTools(new Date("2026-05-17T00:00:00.000Z"));
  assert.deepEqual(
    Object.keys(localTools),
    FLOWDESK_RELEASE_1_COMMAND_MANIFEST.map((entry) => entry.toolName)
  );

  const hooks = await flowdeskOpenCodeServerPlugin.server(undefined as never, {
    [flowdeskLocalNonDispatchAdapterOption]: true
  });
  assert.deepEqual(Object.keys(hooks.tool ?? {}), [flowdeskPreSpikeDoctorToolName, ...Object.keys(localTools)]);
  assert.equal(hasProductionOpenCodeRegistration(), false);

  const planFixture = FLOWDESK_FDS1_FIXTURE_CATALOG.find((entry) => entry.toolName === "flowdesk_plan" && entry.schemaKind === "tool_request");
  const statusFixture = FLOWDESK_FDS1_FIXTURE_CATALOG.find((entry) => entry.toolName === "flowdesk_status" && entry.schemaKind === "tool_request");
  const runFixture = FLOWDESK_FDS1_FIXTURE_CATALOG.find((entry) => entry.toolName === "flowdesk_run" && entry.schemaKind === "tool_request");
  assert.ok(planFixture);
  assert.ok(statusFixture);
  assert.ok(runFixture);

  const planTool = hooks.tool?.flowdesk_plan;
  const statusTool = hooks.tool?.flowdesk_status;
  const runTool = hooks.tool?.flowdesk_run;
  assert.ok(planTool);
  assert.ok(statusTool);
  assert.ok(runTool);

  const planResult = JSON.parse(await planTool.execute({ ...planFixture.categories["valid.minimal"].sample, request_id: "request-local", workflow_id: "workflow-local" }, undefined as never)) as LocalAdapterTestResult;
  assert.equal(planResult.adapterProfile, "local_non_dispatch_command_adapter");
  assert.equal(planResult.handler?.ok, true);
  assert.equal(planResult.handler?.handlerMode, "command_backed_core_evaluator");
  assert.equal(planResult.handler?.response?.status, "ready");
  assert.equal(planResult.localState?.stateWriteApplied, true);
  assert.equal(planResult.localState?.workflowId, "workflow-local");
  assert.equal(planResult.providerCall, false);
  assert.equal(planResult.runtimeExecution, false);
  assert.equal(planResult.actualLaneLaunch, false);

  const runResult = JSON.parse(await runTool.execute({ ...runFixture.categories["valid.minimal"].sample, request_id: "request-local-run", workflow_id: "workflow-local", plan_revision_id: planResult.handler?.response?.plan_revision_id, run_mode: "fake-runtime", step_id: "step-local" }, undefined as never)) as LocalAdapterTestResult;
  assert.equal(runResult.handler?.ok, true);
  assert.equal(runResult.handler?.response?.status, "fake_runtime_complete");
  assert.equal(runResult.localState?.stateWriteApplied, true);
  assert.equal(runResult.localState?.workflowState, "complete");
  assert.equal(runResult.providerCall, false);
  assert.equal(runResult.runtimeExecution, false);
  assert.equal(runResult.actualLaneLaunch, false);

  const statusResult = JSON.parse(await statusTool.execute({ ...statusFixture.categories["valid.minimal"].sample, request_id: "request-local-status", workflow_id: "workflow-local" }, undefined as never)) as LocalAdapterTestResult;
  assert.equal(statusResult.handler?.ok, true);
  assert.equal(statusResult.handler?.response?.workflow_id, "workflow-local");
  assert.equal(statusResult.handler?.response?.workflow_state, "complete");
  assert.equal(statusResult.localState?.workflowState, "complete");
  assert.equal(statusResult.providerCall, false);
  assert.equal(statusResult.runtimeExecution, false);
  assert.equal(statusResult.actualLaneLaunch, false);

  const invalidPlanResult = JSON.parse(await planTool.execute(planFixture.categories["invalid.unknown-property"].sample, undefined as never)) as LocalAdapterTestResult;
  assert.equal(invalidPlanResult.handler?.ok, false);
  assert.equal(invalidPlanResult.handler?.handlerMode, "request_schema_invalid");
  assert.equal(invalidPlanResult.localState?.stateWriteApplied, false);
});

test("server plugin can expose sandbox-only FDS-1 production-shape probe tools", async () => {
  const probeTools = createFlowDeskFds1SchemaConversionProbeTools();
  assert.deepEqual(
    Object.keys(probeTools),
    FLOWDESK_RELEASE_1_COMMAND_MANIFEST.map((entry) => entry.toolName)
  );

  const hooks = await flowdeskOpenCodeServerPlugin.server(undefined as never, {
    [flowdeskFds1SchemaConversionProbeOption]: true
  });
  assert.deepEqual(Object.keys(hooks.tool ?? {}), [flowdeskPreSpikeDoctorToolName, ...Object.keys(probeTools)]);
  assert.equal(hasProductionOpenCodeRegistration(), false);
  assert.equal(hasPassingFds1SchemaConversionSpike(), true);
  assert.equal(getFlowDeskPreSpikeProductionToolRegistry().length, 0);

  for (const manifestEntry of FLOWDESK_RELEASE_1_COMMAND_MANIFEST) {
    const registeredTool = hooks.tool?.[manifestEntry.toolName];
    assert.ok(registeredTool, manifestEntry.toolName);
    assert.match(registeredTool.description, /schema conversion probe/);
    assert.ok("schema_version" in registeredTool.args, manifestEntry.toolName);

    const requestFixture = FLOWDESK_FDS1_FIXTURE_CATALOG.find((entry) => entry.toolName === manifestEntry.toolName && entry.schemaKind === "tool_request");
    assert.ok(requestFixture, manifestEntry.toolName);
    const result = JSON.parse(await registeredTool.execute(requestFixture.categories["valid.minimal"].sample, undefined as never)) as Record<string, unknown>;
    assert.equal(result.toolName, manifestEntry.toolName);
    assert.equal(result.accepted, false);
    assert.equal(result.requestSchemaValid, true);
    assert.equal(result.responseSchemaValid, true);
    assert.equal(result.blockedReason, "production_opencode_registration_disabled");
    assert.equal(result.registrationProfile, "sandbox_conformance_probe_only");
    assert.equal(result.productionPromotionGate, "blocked_production_opencode_registration_disabled");
    assert.equal(result.productionRegistrationEligible, false);
    assert.equal(result.dispatchApprovalEligible, false);
    assert.equal(result.providerCall, false);
    assert.equal(result.runtimeExecution, false);
    const invalidResult = JSON.parse(await registeredTool.execute(requestFixture.categories["invalid.unknown-property"].sample, undefined as never)) as Record<string, unknown>;
    assert.equal(invalidResult.toolName, manifestEntry.toolName);
    assert.equal(invalidResult.accepted, false);
    assert.equal(invalidResult.requestSchemaValid, false);
    assert.equal(invalidResult.blockedReason, "request_schema_invalid");
    assert.equal(invalidResult.providerCall, false);
    assert.equal(invalidResult.runtimeExecution, false);
  }
});

test("FDS-1 probe records OpenCode provider-facing closed-schema caveat", () => {
  const probeTools = createFlowDeskFds1SchemaConversionProbeTools();
  const conversionSummaries = Object.entries(probeTools).map(([toolName, registeredTool]) => {
    const converted = tool.schema.toJSONSchema(tool.schema.object(registeredTool.args), { io: "input" }) as Record<string, unknown>;
    const properties = converted.properties as Record<string, unknown> | undefined;
    return {
      toolName,
      propertyCount: Object.keys(properties ?? {}).length,
      additionalProperties: converted.additionalProperties
    };
  });

  assert.equal(conversionSummaries.length, 9);
  for (const summary of conversionSummaries) {
    assert.ok(summary.propertyCount > 0, summary.toolName);
    assert.equal(summary.additionalProperties ?? null, null, `${summary.toolName} unexpectedly converted as a closed provider-facing schema`);
  }
  assert.equal(hasPassingFds1SchemaConversionSpike(), true);
});
