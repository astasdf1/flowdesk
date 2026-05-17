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
  flowdeskFds1SchemaConversionProbeOption,
  flowdeskPreSpikeDoctorToolName
} from "./server.js";

test("server plugin exposes only an inert pre-spike diagnostic tool", async () => {
  assert.equal(flowdeskOpenCodeServerPlugin.id, "flowdesk");
  assert.equal(hasProductionOpenCodeRegistration(), false);
  assert.equal(hasPassingFds1SchemaConversionSpike(), false);
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
  assert.equal(result.productionOpenCodeRegistration, false);
  assert.equal(result.productionToolRegistration, "not-implemented");
  assert.equal(result.fds1SchemaConversionSpikePassed, false);
  assert.equal(result.realOpenCodeDispatch, "disabled");
  assert.equal(result.providerCall, false);
  assert.equal(result.runtimeExecution, false);
  assert.equal(result.actualLaneLaunch, false);
  assert.equal(result.fallbackAuthority, false);
  assert.equal(result.hardCancelOrNoReplyAuthority, false);
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
  assert.equal(hasPassingFds1SchemaConversionSpike(), false);
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
    assert.equal(result.blockedReason, "missing_passing_fds1_schema_conversion_artifact");
    assert.equal(result.productionRegistrationEligible, false);
    assert.equal(result.dispatchApprovalEligible, false);
    assert.equal(result.providerCall, false);
    assert.equal(result.runtimeExecution, false);
  }
});

test("FDS-1 probe documents OpenCode raw-shape conversion closed-schema blocker", () => {
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
    assert.notEqual(summary.additionalProperties, false, `${summary.toolName} unexpectedly converted as a closed provider-facing schema`);
  }
  assert.equal(hasPassingFds1SchemaConversionSpike(), false);
});
