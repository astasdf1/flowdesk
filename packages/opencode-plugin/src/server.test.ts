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
  flowdeskChatIntakeToolName,
  flowdeskFds1SchemaConversionProbeOption,
  flowdeskLocalNonDispatchAdapterOption,
  flowdeskNaturalLanguageRoutingOption,
  flowdeskPreSpikeDoctorToolName
} from "./server.js";

interface LocalAdapterTestResult {
  adapterProfile?: unknown;
  handler?: {
    ok?: unknown;
    handlerMode?: unknown;
    responseSchemaValid?: unknown;
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
    permissionSource?: unknown;
  };
  providerCall?: unknown;
  runtimeExecution?: unknown;
  actualLaneLaunch?: unknown;
}

interface NaturalLanguageRoutingTestResult {
  ok?: unknown;
  evaluation?: {
    response?: {
      ok?: unknown;
      route_decision?: unknown;
      safe_next_actions?: unknown[];
      classification?: unknown;
    };
  };
  routedToolName?: unknown;
  routedToolResult?: LocalAdapterTestResult;
  providerCall?: unknown;
  runtimeExecution?: unknown;
  actualLaneLaunch?: unknown;
  fallbackAuthority?: unknown;
  hardCancelOrNoReplyAuthority?: unknown;
}

interface ChatMessageHooks {
  tool?: Record<string, { execute(request: unknown, context: unknown): Promise<string>; description: string; args: Record<string, unknown> }>;
  "chat.message"?: (input: unknown, output: { parts?: unknown[] }) => Promise<void>;
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
  assert.equal(planResult.localState?.permissionSource, "tool_boundary_injected");
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

test("server plugin registers natural-language routing only when explicitly enabled", async () => {
  const defaultHooks = await flowdeskOpenCodeServerPlugin.server(undefined as never) as ChatMessageHooks;
  assert.equal(defaultHooks["chat.message"], undefined);
  assert.deepEqual(Object.keys(defaultHooks.tool ?? {}), [flowdeskPreSpikeDoctorToolName]);

  const localOnlyHooks = await flowdeskOpenCodeServerPlugin.server(undefined as never, {
    [flowdeskLocalNonDispatchAdapterOption]: true
  }) as ChatMessageHooks;
  assert.equal(localOnlyHooks["chat.message"], undefined);
  assert.equal(Object.keys(localOnlyHooks.tool ?? {}).includes(flowdeskChatIntakeToolName), false);

  const hooks = await flowdeskOpenCodeServerPlugin.server(undefined as never, {
    [flowdeskNaturalLanguageRoutingOption]: true
  }) as ChatMessageHooks;
  assert.deepEqual(Object.keys(hooks.tool ?? {}), [flowdeskPreSpikeDoctorToolName, flowdeskChatIntakeToolName]);
  assert.ok(hooks["chat.message"]);

  const doctor = hooks.tool?.[flowdeskPreSpikeDoctorToolName];
  assert.ok(doctor);
  const result = JSON.parse(await doctor.execute({}, undefined as never)) as Record<string, unknown>;
  assert.equal(result.naturalLanguageRoutingProfile, "chat_steering_command_backed_non_dispatch");
  assert.equal(result.productionOpenCodeRegistration, false);
  assert.equal(result.providerCall, false);
});

test("chat intake tool evaluates routing and executes local command-backed result safely", async () => {
  const hooks = await flowdeskOpenCodeServerPlugin.server(undefined as never, {
    [flowdeskNaturalLanguageRoutingOption]: true
  }) as ChatMessageHooks;
  const intakeTool = hooks.tool?.[flowdeskChatIntakeToolName];
  assert.ok(intakeTool);

  const result = JSON.parse(await intakeTool.execute({
    schema_version: "flowdesk.chat_intake.request.v1",
    request_id: "request-nl-status",
    input_mode: "chat_routed",
    session_ref: "session-nl",
    redacted_intake_ref: "intake-nl-status",
    intake_summary: "현재 상태와 진행상황 알려줘",
    source_surface: "chat.message"
  }, undefined as never)) as NaturalLanguageRoutingTestResult;

  assert.equal(result.ok, true);
  assert.equal(result.evaluation?.response?.route_decision, "use_command_fallback");
  assert.deepEqual(result.evaluation?.response?.safe_next_actions, ["/flowdesk-status"]);
  assert.equal(result.routedToolName, "flowdesk_status");
  assert.equal(result.routedToolResult?.handler?.ok, true);
  assert.equal(result.providerCall, false);
  assert.equal(result.runtimeExecution, false);
  assert.equal(result.actualLaneLaunch, false);
  assert.equal(result.fallbackAuthority, false);
  assert.equal(result.hardCancelOrNoReplyAuthority, false);

  const retry = JSON.parse(await intakeTool.execute({
    schema_version: "flowdesk.chat_intake.request.v1",
    request_id: "request-nl-retry",
    input_mode: "chat_routed",
    workflow_id: "workflow-nl-retry",
    session_ref: "session-nl",
    redacted_intake_ref: "intake-nl-retry",
    intake_summary: "retry the last failed attempt",
    source_surface: "chat.message"
  }, undefined as never)) as NaturalLanguageRoutingTestResult;
  assert.deepEqual(retry.evaluation?.response?.safe_next_actions, ["/flowdesk-status", "/flowdesk-retry"]);
  assert.equal(retry.routedToolName, "flowdesk_retry");
  assert.equal(retry.routedToolResult?.handler?.ok, true);
  assert.equal(retry.providerCall, false);
  assert.equal(retry.runtimeExecution, false);

  const abort = JSON.parse(await intakeTool.execute({
    schema_version: "flowdesk.chat_intake.request.v1",
    request_id: "request-nl-abort",
    input_mode: "chat_routed",
    workflow_id: "workflow-nl-abort",
    session_ref: "session-nl",
    redacted_intake_ref: "intake-nl-abort",
    intake_summary: "cancel workflow safely",
    source_surface: "chat.message"
  }, undefined as never)) as NaturalLanguageRoutingTestResult;
  assert.deepEqual(abort.evaluation?.response?.safe_next_actions, ["/flowdesk-status", "/flowdesk-abort"]);
  assert.equal(abort.routedToolName, "flowdesk_abort");
  assert.equal(abort.routedToolResult?.handler?.ok, true);
  assert.equal(abort.routedToolResult?.handler?.responseSchemaValid, true);
  assert.equal(abort.providerCall, false);
  assert.equal(abort.actualLaneLaunch, false);

  const resume = JSON.parse(await intakeTool.execute({
    schema_version: "flowdesk.chat_intake.request.v1",
    request_id: "request-nl-resume",
    input_mode: "chat_routed",
    workflow_id: "workflow-nl-resume",
    session_ref: "session-nl",
    redacted_intake_ref: "intake-nl-resume",
    intake_summary: "resume from checkpoint",
    source_surface: "chat.message"
  }, undefined as never)) as NaturalLanguageRoutingTestResult;
  assert.deepEqual(resume.evaluation?.response?.safe_next_actions, ["/flowdesk-status", "/flowdesk-resume"]);
  assert.equal(resume.routedToolName, "flowdesk_resume");
  assert.equal(resume.routedToolResult?.handler?.ok, true);
  assert.equal(resume.providerCall, false);
  assert.equal(resume.actualLaneLaunch, false);

  const usage = JSON.parse(await intakeTool.execute({
    schema_version: "flowdesk.chat_intake.request.v1",
    request_id: "request-nl-usage",
    input_mode: "chat_routed",
    session_ref: "session-nl",
    redacted_intake_ref: "intake-nl-usage",
    intake_summary: "show usage quota",
    source_surface: "chat.message"
  }, undefined as never)) as NaturalLanguageRoutingTestResult;
  assert.deepEqual(usage.evaluation?.response?.safe_next_actions, ["/flowdesk-usage", "/flowdesk-doctor", "/flowdesk-status"]);
  assert.equal(usage.routedToolName, "flowdesk_usage");
  assert.equal(usage.routedToolResult?.handler?.ok, true);
  assert.equal(usage.providerCall, false);

  const exportDebug = JSON.parse(await intakeTool.execute({
    schema_version: "flowdesk.chat_intake.request.v1",
    request_id: "request-nl-export-debug",
    input_mode: "chat_routed",
    session_ref: "session-nl",
    redacted_intake_ref: "intake-nl-export-debug",
    intake_summary: "export debug bundle",
    source_surface: "chat.message"
  }, undefined as never)) as NaturalLanguageRoutingTestResult;
  assert.deepEqual(exportDebug.evaluation?.response?.safe_next_actions, ["/flowdesk-export-debug", "/flowdesk-status"]);
  assert.equal(exportDebug.routedToolName, "flowdesk_export_debug");
  assert.equal(exportDebug.routedToolResult?.handler?.ok, true);
  assert.equal(exportDebug.providerCall, false);
  assert.equal(exportDebug.runtimeExecution, false);
});

test("chat intake holds execution-like requests for confirmation before run", async () => {
  const hooks = await flowdeskOpenCodeServerPlugin.server(undefined as never, {
    [flowdeskNaturalLanguageRoutingOption]: true
  }) as ChatMessageHooks;
  const intakeTool = hooks.tool?.[flowdeskChatIntakeToolName];
  assert.ok(intakeTool);

  const result = JSON.parse(await intakeTool.execute({
    schema_version: "flowdesk.chat_intake.request.v1",
    request_id: "request-nl-run-confirm",
    input_mode: "chat_routed",
    workflow_id: "workflow-nl-run-confirm",
    session_ref: "session-nl-run-confirm",
    redacted_intake_ref: "intake-nl-run-confirm",
    intake_summary: "approved plan을 fake-runtime으로 실행 진행해",
    source_surface: "chat.message"
  }, undefined as never)) as NaturalLanguageRoutingTestResult;

  assert.equal(result.ok, true);
  assert.equal(result.evaluation?.response?.route_decision, "ask_clarification");
  assert.deepEqual(result.evaluation?.response?.safe_next_actions, ["ask_clarification", "/flowdesk-plan", "/flowdesk-status"]);
  assert.equal(result.routedToolName, "flowdesk_plan");
  assert.equal(result.routedToolResult?.handler?.ok, true);
  assert.equal(result.routedToolResult?.handler?.response?.status, "ready");
  assert.equal(result.routedToolResult?.handler?.response?.workflow_state, undefined);
  assert.equal(result.routedToolResult?.localState?.workflowState, "plan_pending_approval");
  assert.equal(result.routedToolResult?.localState?.stateWriteApplied, true);
  assert.notEqual(result.routedToolName, "flowdesk_run");
  assert.equal(result.runtimeExecution, false);
  assert.equal(result.actualLaneLaunch, false);

  const confirmed = JSON.parse(await intakeTool.execute({
    schema_version: "flowdesk.chat_intake.request.v1",
    request_id: "request-nl-run-confirmed",
    input_mode: "chat_routed",
    workflow_id: "workflow-nl-run-confirmed",
    session_ref: "session-nl-run-confirmed",
    redacted_intake_ref: "intake-nl-run-confirmed",
    user_approval_ref: "approval-nl-run-confirmed",
    intake_summary: "approved plan을 fake-runtime으로 실행 진행해",
    source_surface: "chat.message"
  }, undefined as never)) as NaturalLanguageRoutingTestResult;
  assert.equal(confirmed.evaluation?.response?.route_decision, "use_command_fallback");
  assert.deepEqual(confirmed.evaluation?.response?.safe_next_actions, ["/flowdesk-run", "/flowdesk-status"]);
  assert.equal(confirmed.routedToolName, "flowdesk_run");
  assert.equal(confirmed.routedToolResult?.handler?.ok, true);
  assert.equal(confirmed.routedToolResult?.localState?.workflowState, "complete");
  assert.equal(confirmed.runtimeExecution, false);
  assert.equal(confirmed.actualLaneLaunch, false);

  const weakApproval = JSON.parse(await intakeTool.execute({
    schema_version: "flowdesk.chat_intake.request.v1",
    request_id: "request-nl-run-weak-approval",
    input_mode: "chat_routed",
    workflow_id: "workflow-nl-run-weak-approval",
    session_ref: "session-nl-run-weak-approval",
    redacted_intake_ref: "intake-nl-run-weak-approval",
    user_approval_ref: "approval-nl-run-weak-approval",
    intake_summary: "maybe fake-runtime run this later",
    source_surface: "chat.message"
  }, undefined as never)) as NaturalLanguageRoutingTestResult;
  assert.equal(weakApproval.evaluation?.response?.route_decision, "ask_clarification");
  assert.equal(weakApproval.routedToolName, "flowdesk_plan");
  assert.equal(weakApproval.routedToolResult?.localState?.workflowState, "plan_pending_approval");
  assert.equal(weakApproval.runtimeExecution, false);
  assert.equal(weakApproval.actualLaneLaunch, false);
});

test("natural-language routing reuses local adapter session with adapter tools", async () => {
  const hooks = await flowdeskOpenCodeServerPlugin.server(undefined as never, {
    [flowdeskNaturalLanguageRoutingOption]: true,
    [flowdeskLocalNonDispatchAdapterOption]: true
  }) as ChatMessageHooks;
  const intakeTool = hooks.tool?.[flowdeskChatIntakeToolName];
  const statusTool = hooks.tool?.flowdesk_status;
  assert.ok(intakeTool);
  assert.ok(statusTool);

  const planResult = JSON.parse(await intakeTool.execute({
    schema_version: "flowdesk.chat_intake.request.v1",
    request_id: "request-nl-plan",
    input_mode: "chat_routed",
    workflow_id: "workflow-nl-shared",
    session_ref: "session-nl",
    redacted_intake_ref: "intake-nl-plan",
    intake_summary: "구현 계획을 세워줘",
    source_surface: "chat.message"
  }, undefined as never)) as NaturalLanguageRoutingTestResult;
  assert.equal(planResult.routedToolName, "flowdesk_plan");
  assert.equal(planResult.routedToolResult?.localState?.workflowId, "workflow-nl-shared");

  const statusResult = JSON.parse(await statusTool.execute({
    schema_version: "flowdesk.status.request.v1",
    request_id: "request-nl-shared-status",
    input_mode: "chat_routed",
    workflow_id: "workflow-nl-shared",
    detail_level: "summary"
  }, undefined as never)) as LocalAdapterTestResult;
  assert.equal(statusResult.handler?.ok, true);
  assert.equal(statusResult.handler?.response?.workflow_id, "workflow-nl-shared");
  assert.equal(statusResult.localState?.workflowState, "ready_to_run");
});

test("chat.message steering mutates message parts without hard interception fields", async () => {
  const hooks = await flowdeskOpenCodeServerPlugin.server(undefined as never, {
    [flowdeskNaturalLanguageRoutingOption]: true
  }) as ChatMessageHooks;
  assert.ok(hooks["chat.message"]);
  const output = { parts: [{ type: "text", text: "구현 계획을 세워줘" }] as unknown[] };
  await hooks["chat.message"]({
    messageID: "message-korean-plan",
    sessionID: "session-hook"
  }, output);

  assert.equal(output.parts.length, 2);
  const serialized = JSON.stringify(output);
  assert.match(serialized, /FlowDesk/);
  assert.match(serialized, /Suggested next step: \/flowdesk-plan/);
  assert.match(serialized, /Why:/);
  assert.match(serialized, /Actions:/);
  assert.match(serialized, /- \/flowdesk-plan/);
  assert.match(serialized, /- \/flowdesk-status/);
  assert.equal(/noReply|cancel|stop/.test(serialized), false);

  const generalChatOutput = { parts: [{ type: "text", text: "오늘 날씨 이야기하자" }] as unknown[] };
  await hooks["chat.message"]({
    messageID: "message-general-chat",
    sessionID: "session-hook"
  }, generalChatOutput);
  assert.equal(generalChatOutput.parts.length, 1);
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
