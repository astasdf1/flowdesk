import assert from "node:assert/strict";
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
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
import { createFlowDeskLocalNonDispatchAdapterSession } from "./local-adapter.js";
import flowdeskOpenCodeServerPlugin, {
  createFlowDeskFds1SchemaConversionProbeTools,
  createFlowDeskLocalNonDispatchAdapterTools,
  flowdeskChatIntakeToolName,
  flowdeskDurableStateRootOption,
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
    errors?: unknown[];
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
    pendingConfirmationStatus?: unknown;
    pendingConfirmationRef?: unknown;
    pendingConfirmationWorkflowId?: unknown;
    pendingConfirmationExpiresAt?: unknown;
    durableStateMode?: unknown;
    durableStateWriteApplied?: unknown;
    durableStateWrites?: unknown;
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

test("server plugin defaults to safe local command-backed chat mode", async () => {
  assert.equal(flowdeskOpenCodeServerPlugin.id, "flowdesk");
  assert.equal(hasProductionOpenCodeRegistration(), true);
  assert.equal(hasPassingFds1SchemaConversionSpike(), true);
  assert.equal(getFlowDeskPreSpikeProductionToolRegistry().length, 0);

  const hooks = await flowdeskOpenCodeServerPlugin.server(undefined as never);
  assert.deepEqual(Object.keys(hooks.tool ?? {}), [flowdeskPreSpikeDoctorToolName, ...FLOWDESK_RELEASE_1_COMMAND_MANIFEST.map((entry) => entry.toolName), flowdeskChatIntakeToolName]);
  assert.ok((hooks as ChatMessageHooks)["chat.message"]);

  const doctor = hooks.tool?.[flowdeskPreSpikeDoctorToolName];
  assert.ok(doctor);
  assert.equal(doctor.description.includes("without enabling real dispatch"), true);
  assert.deepEqual(doctor.args, {});

  const result = JSON.parse(await doctor.execute({}, undefined as never)) as Record<string, unknown>;
  assert.equal(result.pluginId, "flowdesk");
  assert.equal(result.loaded, true);
  assert.equal(result.probeRegistrationProfile, "disabled");
  assert.equal(result.localNonDispatchAdapterProfile, "local_non_dispatch_command_adapter");
  assert.equal(result.naturalLanguageRoutingProfile, "chat_steering_command_backed_non_dispatch");
  assert.equal(result.productionPromotionGate, "release1_non_dispatch_command_registration_ready");
  assert.equal(result.productionOpenCodeRegistration, true);
  assert.equal(result.productionToolRegistration, "release1-non-dispatch-command-backed");
  assert.deepEqual(result.release1HandlerReadiness, {
    totalTools: 9,
    diagnosticScaffoldAvailable: 5,
    coreEvaluatorAvailable: 4,
    schemaOnlyPending: 0,
    productionReady: true,
    productionPromotionGate: "release1_command_backed_handlers_ready"
  });
  assert.deepEqual(result.release1ProductionReadiness, {
    totalChecks: 8,
    passedChecks: 8,
    blockedChecks: 0,
    productionReady: true,
    productionPromotionGate: "release1_non_dispatch_registration_ready",
    blockedReasons: [],
    productionRegistrationEligible: true,
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
    [flowdeskLocalNonDispatchAdapterOption]: true,
    [flowdeskNaturalLanguageRoutingOption]: false
  });
  assert.deepEqual(Object.keys(hooks.tool ?? {}), [flowdeskPreSpikeDoctorToolName, ...Object.keys(localTools)]);
  assert.equal(hasProductionOpenCodeRegistration(), true);

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

test("server plugin allows explicit opt-out of local tools and natural-language routing", async () => {
  const disabledHooks = await flowdeskOpenCodeServerPlugin.server(undefined as never, {
    [flowdeskLocalNonDispatchAdapterOption]: false,
    [flowdeskNaturalLanguageRoutingOption]: false
  }) as ChatMessageHooks;
  assert.equal(disabledHooks["chat.message"], undefined);
  assert.deepEqual(Object.keys(disabledHooks.tool ?? {}), [flowdeskPreSpikeDoctorToolName]);

  const localOnlyHooks = await flowdeskOpenCodeServerPlugin.server(undefined as never, {
    [flowdeskLocalNonDispatchAdapterOption]: true,
    [flowdeskNaturalLanguageRoutingOption]: false
  }) as ChatMessageHooks;
  assert.equal(localOnlyHooks["chat.message"], undefined);
  assert.equal(Object.keys(localOnlyHooks.tool ?? {}).includes(flowdeskChatIntakeToolName), false);

  const hooks = await flowdeskOpenCodeServerPlugin.server(undefined as never, {
    [flowdeskLocalNonDispatchAdapterOption]: false,
    [flowdeskNaturalLanguageRoutingOption]: true
  }) as ChatMessageHooks;
  assert.deepEqual(Object.keys(hooks.tool ?? {}), [flowdeskPreSpikeDoctorToolName, flowdeskChatIntakeToolName]);
  assert.ok(hooks["chat.message"]);

  const doctor = hooks.tool?.[flowdeskPreSpikeDoctorToolName];
  assert.ok(doctor);
  const result = JSON.parse(await doctor.execute({}, undefined as never)) as Record<string, unknown>;
  assert.equal(result.naturalLanguageRoutingProfile, "chat_steering_command_backed_non_dispatch");
  assert.equal(result.productionOpenCodeRegistration, true);
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

  const doctor = JSON.parse(await intakeTool.execute({
    schema_version: "flowdesk.chat_intake.request.v1",
    request_id: "request-nl-doctor",
    input_mode: "chat_routed",
    session_ref: "session-nl",
    redacted_intake_ref: "intake-nl-doctor",
    intake_summary: "/flowdesk-doctor",
    source_surface: "chat.message"
  }, undefined as never)) as NaturalLanguageRoutingTestResult;
  assert.equal(doctor.evaluation?.response?.route_decision, "use_command_fallback");
  assert.equal(doctor.routedToolName, "flowdesk_doctor");
  assert.equal(doctor.routedToolResult?.handler?.ok, true);
  assert.equal(doctor.routedToolResult?.handler?.response?.status, "degraded");
  assert.equal(doctor.providerCall, false);
  assert.equal(doctor.runtimeExecution, false);
  assert.equal(doctor.actualLaneLaunch, false);

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
  assert.equal(result.routedToolResult?.localState?.pendingConfirmationStatus, "pending");
  const pendingApprovalRef = result.routedToolResult?.localState?.pendingConfirmationRef;
  assert.equal(typeof pendingApprovalRef, "string");
  assert.notEqual(result.routedToolName, "flowdesk_run");
  assert.equal(result.runtimeExecution, false);
  assert.equal(result.actualLaneLaunch, false);

  const confirmed = JSON.parse(await intakeTool.execute({
    schema_version: "flowdesk.chat_intake.request.v1",
    request_id: "request-nl-run-confirmed",
    input_mode: "chat_routed",
    workflow_id: "workflow-nl-run-confirm",
    session_ref: "session-nl-run-confirm",
    redacted_intake_ref: "intake-nl-run-confirm",
    user_approval_ref: pendingApprovalRef,
    intake_summary: "approved plan을 fake-runtime으로 실행 진행해",
    source_surface: "chat.message"
  }, undefined as never)) as NaturalLanguageRoutingTestResult;
  assert.equal(confirmed.evaluation?.response?.route_decision, "use_command_fallback");
  assert.deepEqual(confirmed.evaluation?.response?.safe_next_actions, ["/flowdesk-run", "/flowdesk-status"]);
  assert.equal(confirmed.routedToolName, "flowdesk_run");
  assert.equal(confirmed.routedToolResult?.handler?.ok, true);
  assert.equal(confirmed.routedToolResult?.localState?.workflowState, "complete");
  assert.equal(confirmed.routedToolResult?.localState?.pendingConfirmationStatus, "consumed");
  assert.equal(confirmed.runtimeExecution, false);
  assert.equal(confirmed.actualLaneLaunch, false);

  const reused = JSON.parse(await intakeTool.execute({
    schema_version: "flowdesk.chat_intake.request.v1",
    request_id: "request-nl-run-reused-confirmation",
    input_mode: "chat_routed",
    workflow_id: "workflow-nl-run-confirm",
    session_ref: "session-nl-run-confirm",
    redacted_intake_ref: "intake-nl-run-confirm",
    user_approval_ref: pendingApprovalRef,
    intake_summary: "approved plan을 fake-runtime으로 실행 진행해",
    source_surface: "chat.message"
  }, undefined as never)) as NaturalLanguageRoutingTestResult;
  assert.equal(reused.routedToolName, "flowdesk_run");
  assert.equal(reused.routedToolResult?.handler?.ok, false);
  assert.equal(reused.routedToolResult?.handler?.handlerMode, "pending_confirmation_invalid");
  assert.equal(reused.routedToolResult?.localState?.pendingConfirmationStatus, "consumed");
  assert.equal(reused.routedToolResult?.localState?.stateWriteApplied, false);
  assert.equal(reused.runtimeExecution, false);
  assert.equal(reused.actualLaneLaunch, false);

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

  const missingSessionScope = JSON.parse(await intakeTool.execute({
    schema_version: "flowdesk.chat_intake.request.v1",
    request_id: "request-nl-run-missing-session-scope",
    input_mode: "chat_routed",
    workflow_id: "workflow-nl-run-confirm",
    redacted_intake_ref: "intake-nl-run-confirm",
    user_approval_ref: pendingApprovalRef,
    intake_summary: "approved plan을 fake-runtime으로 실행 진행해",
    source_surface: "chat.message"
  }, undefined as never)) as NaturalLanguageRoutingTestResult;
  assert.equal(missingSessionScope.routedToolResult?.handler?.ok, false);
  assert.equal(missingSessionScope.routedToolResult?.handler?.handlerMode, "pending_confirmation_invalid");
  assert.equal(missingSessionScope.runtimeExecution, false);
});

test("local adapter fails closed for expired and cancelled pending confirmations", () => {
  let clock = new Date("2026-05-17T00:00:00.000Z");
  const session = createFlowDeskLocalNonDispatchAdapterSession(() => clock);
  const pendingPlan = session.evaluate("flowdesk_plan", {
    schema_version: "flowdesk.plan.request.v1",
    request_id: "request-expiring-plan",
    input_mode: "chat_routed",
    workflow_id: "workflow-expiring-plan",
    session_ref: "session-expiring-plan",
    redacted_intake_ref: "intake-expiring-plan",
    goal_summary: "approved plan을 fake-runtime으로 실행 진행해",
    scope_summary: "FlowDesk natural-language chat intake routed to command-backed planning.",
    risk_hint: "execution-like chat intake requires explicit user confirmation before any run"
  });
  assert.equal(pendingPlan.localState.pendingConfirmationStatus, "pending");
  const approvalRef = pendingPlan.localState.pendingConfirmationRef;
  assert.equal(typeof approvalRef, "string");

  clock = new Date("2026-05-17T00:16:00.000Z");
  const expiredRun = session.evaluate("flowdesk_run", {
    schema_version: "flowdesk.run.request.v1",
    request_id: "request-expired-run",
    input_mode: "chat_routed",
    workflow_id: "workflow-expiring-plan",
    session_ref: "session-expiring-plan",
    redacted_intake_ref: "intake-expiring-plan",
    user_approval_ref: approvalRef,
    run_mode: "fake-runtime",
    plan_revision_id: "plan-workflow-expiring-plan",
    step_id: "step-expired-run"
  });
  assert.equal(expiredRun.handler.ok, false);
  assert.equal(expiredRun.handler.handlerMode, "pending_confirmation_invalid");
  assert.equal(expiredRun.localState.pendingConfirmationStatus, "expired");
  assert.equal(expiredRun.localState.workflowState, "plan_pending_approval");
  assert.equal(expiredRun.runtimeExecution, false);

  clock = new Date("2026-05-17T01:00:00.000Z");
  const cancelSession = createFlowDeskLocalNonDispatchAdapterSession(() => clock);
  const cancellablePlan = cancelSession.evaluate("flowdesk_plan", {
    schema_version: "flowdesk.plan.request.v1",
    request_id: "request-cancellable-plan",
    input_mode: "chat_routed",
    workflow_id: "workflow-cancellable-plan",
    session_ref: "session-cancellable-plan",
    redacted_intake_ref: "intake-cancellable-plan",
    goal_summary: "approved plan을 fake-runtime으로 실행 진행해",
    scope_summary: "FlowDesk natural-language chat intake routed to command-backed planning.",
    risk_hint: "execution-like chat intake requires explicit user confirmation before any run"
  });
  const cancellableApprovalRef = cancellablePlan.localState.pendingConfirmationRef;
  const abort = cancelSession.evaluate("flowdesk_abort", {
    schema_version: "flowdesk.abort.request.v1",
    request_id: "request-cancel-pending",
    input_mode: "chat_routed",
    workflow_id: "workflow-cancellable-plan",
    session_ref: "session-cancellable-plan",
    redacted_intake_ref: "intake-cancellable-plan",
    reason: "FlowDesk chat intake requested a safe abort diagnostic."
  });
  assert.equal(abort.handler.ok, true);
  assert.equal(abort.localState.pendingConfirmationStatus, "cancelled");
  assert.equal(abort.hardCancelOrNoReplyAuthority, false);

  const cancelledRun = cancelSession.evaluate("flowdesk_run", {
    schema_version: "flowdesk.run.request.v1",
    request_id: "request-cancelled-run",
    input_mode: "chat_routed",
    workflow_id: "workflow-cancellable-plan",
    session_ref: "session-cancellable-plan",
    redacted_intake_ref: "intake-cancellable-plan",
    user_approval_ref: cancellableApprovalRef,
    run_mode: "fake-runtime",
    plan_revision_id: "plan-workflow-cancellable-plan",
    step_id: "step-cancelled-run"
  });
  assert.equal(cancelledRun.handler.ok, false);
  assert.equal(cancelledRun.handler.handlerMode, "pending_confirmation_invalid");
  assert.equal(cancelledRun.localState.pendingConfirmationStatus, "cancelled");
  assert.equal(cancelledRun.actualLaneLaunch, false);
});

test("local adapter can opt into durable .flowdesk state materialization", () => {
  const root = mkdtempSync(join(tmpdir(), "flowdesk-local-adapter-"));
  try {
    const session = createFlowDeskLocalNonDispatchAdapterSession(new Date("2026-05-17T00:00:00.000Z"), undefined, { durableStateRootDir: root });
    const plan = session.evaluate("flowdesk_plan", {
      schema_version: "flowdesk.plan.request.v1",
      request_id: "request-durable-plan",
      input_mode: "chat_routed",
      workflow_id: "workflow-durable-plan",
      session_ref: "session-durable-plan",
      redacted_intake_ref: "intake-durable-plan",
      goal_summary: "구현 계획을 세워줘",
      scope_summary: "FlowDesk natural-language chat intake routed to command-backed planning.",
      risk_hint: "ordinary Release 1 command-backed steering only"
    });
    assert.equal(plan.handler.ok, true);
    assert.equal(plan.localState.stateWriteApplied, true);
    assert.equal(plan.localState.durableStateMode, "durable_flowdesk_root");
    assert.equal(plan.localState.durableStateWriteApplied, true);
    assert.equal(plan.localState.durableStateWrites, 3);
    const workflowPath = join(root, ".flowdesk/workflows/workflow-durable-plan/workflow.json");
    const lanesPath = join(root, ".flowdesk/sessions/session-local/lanes.jsonl");
    assert.equal(existsSync(workflowPath), true);
    assert.equal(JSON.parse(readFileSync(workflowPath, "utf8")).workflow_id, "workflow-durable-plan");
    assert.match(readFileSync(lanesPath, "utf8"), /"lane_id":"lane-plan-request-durable-plan"/);

    const status = session.evaluate("flowdesk_status", {
      schema_version: "flowdesk.status.request.v1",
      request_id: "request-durable-status",
      input_mode: "chat_routed",
      workflow_id: "workflow-durable-plan",
      session_ref: "session-durable-plan",
      redacted_intake_ref: "intake-durable-status",
      detail_level: "summary"
    });
    assert.equal(status.handler.ok, true);
    assert.equal(status.localState.durableStateMode, "durable_flowdesk_root");
    assert.equal(status.providerCall, false);
    assert.equal(status.runtimeExecution, false);

    const reloadedSession = createFlowDeskLocalNonDispatchAdapterSession(new Date("2026-05-17T00:00:00.000Z"), undefined, { durableStateRootDir: root });
    const reloadedStatus = reloadedSession.evaluate("flowdesk_status", {
      schema_version: "flowdesk.status.request.v1",
      request_id: "request-durable-status-reload",
      input_mode: "chat_routed",
      workflow_id: "workflow-durable-plan",
      session_ref: "session-durable-plan",
      redacted_intake_ref: "intake-durable-status-reload",
      detail_level: "summary"
    });
    assert.equal(reloadedStatus.handler.ok, true);
    const reloadedResponse = reloadedStatus.handler.response as { workflow_id?: unknown; workflow_state?: unknown } | undefined;
    assert.equal(reloadedResponse?.workflow_id, "workflow-durable-plan");
    assert.equal(reloadedResponse?.workflow_state, "ready_to_run");
    assert.equal(reloadedStatus.localState.workflowState, "ready_to_run");
    assert.equal(reloadedStatus.localState.laneRecords, 1);
    assert.equal(reloadedStatus.providerCall, false);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("local adapter fails closed when durable state reload is malformed", () => {
  const root = mkdtempSync(join(tmpdir(), "flowdesk-local-adapter-reload-blocked-"));
  try {
    const session = createFlowDeskLocalNonDispatchAdapterSession(new Date("2026-05-17T00:00:00.000Z"), undefined, { durableStateRootDir: root });
    const plan = session.evaluate("flowdesk_plan", {
      schema_version: "flowdesk.plan.request.v1",
      request_id: "request-durable-malformed-plan",
      input_mode: "chat_routed",
      workflow_id: "workflow-durable-malformed",
      session_ref: "session-durable-malformed",
      redacted_intake_ref: "intake-durable-malformed-plan",
      goal_summary: "구현 계획을 세워줘",
      scope_summary: "FlowDesk natural-language chat intake routed to command-backed planning.",
      risk_hint: "ordinary Release 1 command-backed steering only"
    });
    assert.equal(plan.ok, true);
    writeFileSync(join(root, ".flowdesk/workflows/workflow-durable-malformed/workflow.json"), JSON.stringify({ raw_prompt: "system prompt leak" }), "utf8");

    const reloadedSession = createFlowDeskLocalNonDispatchAdapterSession(new Date("2026-05-17T00:00:00.000Z"), undefined, { durableStateRootDir: root });
    const status = reloadedSession.evaluate("flowdesk_status", {
      schema_version: "flowdesk.status.request.v1",
      request_id: "request-durable-malformed-status",
      input_mode: "chat_routed",
      workflow_id: "workflow-durable-malformed",
      session_ref: "session-durable-malformed",
      redacted_intake_ref: "intake-durable-malformed-status",
      detail_level: "summary"
    });
    assert.equal(status.ok, false);
    assert.equal(status.localState.stateWriteApplied, false);
    assert.equal(status.providerCall, false);
    assert.equal(status.runtimeExecution, false);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("local adapter fails closed when durable state cannot be written", () => {
  const root = mkdtempSync(join(tmpdir(), "flowdesk-local-adapter-blocked-"));
  const blockedRoot = join(root, "not-a-directory");
  try {
    writeFileSync(blockedRoot, "not a directory", "utf8");
    const session = createFlowDeskLocalNonDispatchAdapterSession(new Date("2026-05-17T00:00:00.000Z"), undefined, { durableStateRootDir: blockedRoot });
    const plan = session.evaluate("flowdesk_plan", {
      schema_version: "flowdesk.plan.request.v1",
      request_id: "request-durable-failure",
      input_mode: "chat_routed",
      workflow_id: "workflow-durable-failure",
      session_ref: "session-durable-failure",
      redacted_intake_ref: "intake-durable-failure",
      goal_summary: "구현 계획을 세워줘",
      scope_summary: "FlowDesk natural-language chat intake routed to command-backed planning.",
      risk_hint: "ordinary Release 1 command-backed steering only"
    });
    assert.equal(plan.ok, false);
    assert.equal(plan.handler.ok, true);
    assert.equal(plan.localState.stateWriteApplied, false);
    assert.equal(plan.localState.workflowState, undefined);
    assert.equal(plan.localState.durableStateWriteApplied, false);
    assert.equal(plan.providerCall, false);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("server option wires durable state root into local routing session", async () => {
  const root = mkdtempSync(join(tmpdir(), "flowdesk-server-durable-"));
  try {
    const hooks = await flowdeskOpenCodeServerPlugin.server(undefined as never, {
      [flowdeskNaturalLanguageRoutingOption]: true,
      [flowdeskDurableStateRootOption]: root
    }) as ChatMessageHooks;
    const intakeTool = hooks.tool?.[flowdeskChatIntakeToolName];
    assert.ok(intakeTool);
    const plan = JSON.parse(await intakeTool.execute({
      schema_version: "flowdesk.chat_intake.request.v1",
      request_id: "request-server-durable-plan",
      input_mode: "chat_routed",
      workflow_id: "workflow-server-durable",
      session_ref: "session-server-durable",
      redacted_intake_ref: "intake-server-durable",
      intake_summary: "구현 계획을 세워줘",
      source_surface: "chat.message"
    }, undefined as never)) as NaturalLanguageRoutingTestResult;
    assert.equal(plan.routedToolResult?.localState?.durableStateMode, "durable_flowdesk_root");
    assert.equal(plan.routedToolResult?.localState?.durableStateWriteApplied, true);
    assert.equal(existsSync(join(root, ".flowdesk/workflows/workflow-server-durable/workflow.json")), true);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
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

  const executionOutput = { parts: [{ type: "text", text: "approved plan을 fake-runtime으로 실행 진행해" }] as unknown[] };
  await hooks["chat.message"]({
    messageID: "message-execution-confirmation",
    sessionID: "session-hook-confirm"
  }, executionOutput);
  const executionSerialized = JSON.stringify(executionOutput);
  assert.match(executionSerialized, /Confirmation code: approval-plan-chat-message-execution-confirmation/);
  assert.match(executionSerialized, /explicit approval/);
  assert.equal(/noReply|cancel|stop/.test(executionSerialized), false);

  const generalChatOutput = { parts: [{ type: "text", text: "오늘 날씨 이야기하자" }] as unknown[] };
  await hooks["chat.message"]({
    messageID: "message-general-chat",
    sessionID: "session-hook"
  }, generalChatOutput);
  assert.equal(generalChatOutput.parts.length, 1);
});

test("chat.message steering suppresses repeated non-confirmation cards for the same session and suggestion", async () => {
  const root = mkdtempSync(join(tmpdir(), "flowdesk-chat-duplicate-"));
  try {
    const hooks = await flowdeskOpenCodeServerPlugin.server(undefined as never, {
      [flowdeskNaturalLanguageRoutingOption]: true,
      [flowdeskDurableStateRootOption]: root
    }) as ChatMessageHooks;
    assert.ok(hooks["chat.message"]);

    const firstPlanOutput = { parts: [{ type: "text", text: "구현 계획을 세워줘" }] as unknown[] };
    await hooks["chat.message"]({
      messageID: "message-duplicate-plan-first",
      sessionID: "session-duplicate-plan"
    }, firstPlanOutput);
    assert.equal(firstPlanOutput.parts.length, 2);
    assert.match(JSON.stringify(firstPlanOutput), /Suggested next step: \/flowdesk-plan/);
    const workflowPath = join(root, ".flowdesk/workflows/workflow-local/workflow.json");
    const workflowAfterFirst = readFileSync(workflowPath, "utf8");

    const repeatedPlanOutput = { parts: [{ type: "text", text: "구현 계획을 다시 세워줘" }] as unknown[] };
    await hooks["chat.message"]({
      messageID: "message-duplicate-plan-second",
      sessionID: "session-duplicate-plan"
    }, repeatedPlanOutput);
    assert.equal(repeatedPlanOutput.parts.length, 1);
    assert.equal(readFileSync(workflowPath, "utf8"), workflowAfterFirst);
    assert.equal(/noReply|cancel|stop/.test(JSON.stringify(repeatedPlanOutput)), false);

    const otherSessionOutput = { parts: [{ type: "text", text: "구현 계획을 세워줘" }] as unknown[] };
    await hooks["chat.message"]({
      messageID: "message-duplicate-plan-other-session",
      sessionID: "session-duplicate-plan-other"
    }, otherSessionOutput);
    assert.equal(otherSessionOutput.parts.length, 2);

    const differentSuggestionOutput = { parts: [{ type: "text", text: "현재 상태와 진행상황 알려줘" }] as unknown[] };
    await hooks["chat.message"]({
      messageID: "message-duplicate-status",
      sessionID: "session-duplicate-plan"
    }, differentSuggestionOutput);
    assert.equal(differentSuggestionOutput.parts.length, 2);
    assert.match(JSON.stringify(differentSuggestionOutput), /Suggested next step: \/flowdesk-status/);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("chat.message steering preserves repeated pending confirmation cards", async () => {
  const hooks = await flowdeskOpenCodeServerPlugin.server(undefined as never, {
    [flowdeskNaturalLanguageRoutingOption]: true
  }) as ChatMessageHooks;
  assert.ok(hooks["chat.message"]);

  const firstConfirmationOutput = { parts: [{ type: "text", text: "approved plan을 fake-runtime으로 실행 진행해" }] as unknown[] };
  await hooks["chat.message"]({
    messageID: "message-confirmation-card-first",
    sessionID: "session-confirmation-card"
  }, firstConfirmationOutput);
  assert.equal(firstConfirmationOutput.parts.length, 2);
  assert.match(JSON.stringify(firstConfirmationOutput), /Confirmation code: approval-plan-chat-message-confirmation-card-first/);

  const repeatedConfirmationOutput = { parts: [{ type: "text", text: "approved plan을 fake-runtime으로 실행 진행해" }] as unknown[] };
  await hooks["chat.message"]({
    messageID: "message-confirmation-card-second",
    sessionID: "session-confirmation-card"
  }, repeatedConfirmationOutput);
  const repeatedSerialized = JSON.stringify(repeatedConfirmationOutput);
  assert.equal(repeatedConfirmationOutput.parts.length, 2);
  assert.match(repeatedSerialized, /Confirmation code: approval-plan-chat-message-confirmation-card-second/);
  assert.match(repeatedSerialized, /explicit approval/);
  assert.equal(/noReply|cancel|stop/.test(repeatedSerialized), false);
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
  assert.equal(hasProductionOpenCodeRegistration(), true);
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
