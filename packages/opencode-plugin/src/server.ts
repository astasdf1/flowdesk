import type {
  FlowDeskChatIntakeRequestV1,
  FlowDeskRelease1MinimumPortableCommandName,
  FlowDeskRelease1MinimumToolName,
  FlowDeskToolRequestEnvelopeV1,
  SafeNextAction
} from "@flowdesk/core";
import {
  evaluateFlowDeskChatIntakeV1,
  getFlowDeskPortableCommandToolName,
  getRelease1SchemaArtifact
} from "@flowdesk/core";
import type { Plugin, PluginModule, PluginOptions } from "@opencode-ai/plugin";
import { tool } from "@opencode-ai/plugin";
import type { z } from "zod";
import {
  flowdeskPluginId,
  flowdeskPluginScaffold,
  hasProductionOpenCodeRegistration
} from "./index.js";
import { createFlowDeskLocalNonDispatchAdapterSession, type FlowDeskLocalClockV1, type FlowDeskLocalNonDispatchAdapterSessionV1, flowdeskLocalNonDispatchAdapterProfile } from "./local-adapter.js";
import {
  FLOWDESK_PRE_SPIKE_PLUGIN_TOOL_STUBS,
  getFlowDeskRelease1HandlerReadinessSummary,
  getFlowDeskRelease1ProductionReadinessSummary,
  hasPassingFds1SchemaConversionSpike,
  runFlowDeskPreSpikePluginToolStub
} from "./tool-stubs.js";

export const flowdeskPreSpikeDoctorToolName = "flowdesk_pre_spike_doctor" as const;
export const flowdeskChatIntakeToolName = "flowdesk_chat_intake" as const;
export const flowdeskFds1SchemaConversionProbeOption = "fds1SchemaConversionProbe" as const;
export const flowdeskLocalNonDispatchAdapterOption = "localNonDispatchAdapter" as const;
export const flowdeskNaturalLanguageRoutingOption = "naturalLanguageRouting" as const;
export const flowdeskDurableStateRootOption = "durableStateRoot" as const;

type FlowDeskOpenCodeTool = ReturnType<typeof tool>;
type FlowDeskOpenCodeToolArgs = Parameters<typeof tool>[0]["args"];
type FlowDeskOpenCodeToolArg = z.ZodType;

interface FlowDeskChatMessageOutput {
  parts?: unknown[];
}

const flowdeskChatSuggestionDuplicateWindowMs = 10_000;

const disabledAuthority = {
  productionRegistrationEligible: false,
  dispatchApprovalEligible: false,
  realOpenCodeDispatch: false,
  actualLaneLaunch: false,
  providerCall: false,
  runtimeExecution: false,
  fallbackAuthority: false,
  hardCancelOrNoReplyAuthority: false
} as const;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function boundedText(value: string, fallback: string): string {
  const trimmed = value.trim();
  return (trimmed.length > 0 ? trimmed : fallback).slice(0, 500);
}

function safeToken(value: unknown, fallback: string): string {
  const source = typeof value === "string" && value.length > 0 ? value : fallback;
  const token = source.replaceAll(/[^A-Za-z0-9_.:-]/g, "-").slice(0, 80);
  return token.length > 0 ? token : fallback;
}

function commandNameFromAction(action: SafeNextAction): FlowDeskRelease1MinimumPortableCommandName | undefined {
  return action.startsWith("/flowdesk-") && action !== "/flowdesk-explain-route" && action !== "/flowdesk-audit" ? action as FlowDeskRelease1MinimumPortableCommandName : undefined;
}

function routedToolName(actions: readonly SafeNextAction[]): FlowDeskRelease1MinimumToolName | undefined {
  const preferredActions = actions.length > 1 ? [...actions.filter((action) => action !== "/flowdesk-status"), ...actions.filter((action) => action === "/flowdesk-status")] : actions;
  for (const action of preferredActions) {
    const commandName = commandNameFromAction(action);
    if (commandName === undefined) continue;
    const toolName = getFlowDeskPortableCommandToolName(commandName);
    if (toolName !== undefined) return toolName;
  }
  return undefined;
}

type FlowDeskRequestEnvelopeOptionalField = "workflow_id" | "session_ref" | "redacted_intake_ref" | "user_approval_ref";

const chatEnvelopeOptionalFields: readonly FlowDeskRequestEnvelopeOptionalField[] = ["workflow_id", "session_ref", "redacted_intake_ref", "user_approval_ref"];

function baseToolRequest(request: FlowDeskChatIntakeRequestV1, schemaVersion: string, optionalFields: readonly FlowDeskRequestEnvelopeOptionalField[] = chatEnvelopeOptionalFields): FlowDeskToolRequestEnvelopeV1 {
  const includeOptional = new Set(optionalFields);
  return {
    schema_version: schemaVersion,
    request_id: safeToken(`${schemaVersion.split(".")[1] ?? "tool"}-${request.request_id}`, "request-chat-routed"),
    input_mode: "chat_routed",
    ...(includeOptional.has("workflow_id") && request.workflow_id !== undefined ? { workflow_id: request.workflow_id } : {}),
    ...(includeOptional.has("session_ref") && request.session_ref !== undefined ? { session_ref: request.session_ref } : {}),
    ...(includeOptional.has("redacted_intake_ref") && request.redacted_intake_ref !== undefined ? { redacted_intake_ref: request.redacted_intake_ref } : {}),
    ...(includeOptional.has("user_approval_ref") && request.user_approval_ref !== undefined ? { user_approval_ref: request.user_approval_ref } : {})
  };
}

function routedToolRequest(toolName: FlowDeskRelease1MinimumToolName, request: FlowDeskChatIntakeRequestV1, options: { requiresConfirmation?: boolean } = {}): unknown {
  const summary = boundedText(request.intake_summary, "FlowDesk natural-language chat intake.");
  if (toolName === "flowdesk_plan") {
    return {
      ...baseToolRequest(request, "flowdesk.plan.request.v1"),
      goal_summary: summary,
      scope_summary: "FlowDesk natural-language chat intake routed to command-backed planning.",
      risk_hint: options.requiresConfirmation === true ? "execution-like chat intake requires explicit user confirmation before any run" : "ordinary Release 1 command-backed steering only"
    };
  }
  if (toolName === "flowdesk_run") {
    return {
      ...baseToolRequest(request, "flowdesk.run.request.v1"),
      run_mode: /dry[\s_-]*run|드라이\s*런/i.test(summary) ? "guarded-dry-run" : "fake-runtime",
      plan_revision_id: safeToken(`plan-${request.workflow_id ?? request.request_id}`, "plan-chat-routed"),
      step_id: safeToken(`step-${request.request_id}`, "step-chat-routed")
    };
  }
  if (toolName === "flowdesk_status") {
    return {
      ...baseToolRequest(request, "flowdesk.status.request.v1"),
      detail_level: "summary"
    };
  }
  if (toolName === "flowdesk_doctor") {
    return {
      ...baseToolRequest(request, "flowdesk.doctor.request.v1", []),
      check_scope: "all",
      profile: "test",
      persist_report: false
    };
  }
  if (toolName === "flowdesk_resume") {
    return {
      ...baseToolRequest(request, "flowdesk.resume.request.v1", []),
      checkpoint_id: safeToken(`checkpoint-${request.workflow_id ?? request.request_id}`, "checkpoint-chat-routed"),
      resume_mode: "status_only"
    };
  }
  if (toolName === "flowdesk_retry") {
    return {
      ...baseToolRequest(request, "flowdesk.retry.request.v1"),
      attempt_id: safeToken(`attempt-${request.workflow_id ?? request.request_id}`, "attempt-chat-routed"),
      retry_reason: "FlowDesk chat intake requested a non-dispatch retry diagnostic."
    };
  }
  if (toolName === "flowdesk_abort") {
    return {
      ...baseToolRequest(request, "flowdesk.abort.request.v1"),
      workflow_id: safeToken(request.workflow_id ?? `workflow-${request.request_id}`, "workflow-chat-routed"),
      reason: "FlowDesk chat intake requested a safe abort diagnostic."
    };
  }
  if (toolName === "flowdesk_usage") {
    return {
      ...baseToolRequest(request, "flowdesk.usage.request.v1", []),
      provider_family: "unknown",
      refresh: false
    };
  }
  if (toolName === "flowdesk_export_debug") {
    return {
      ...baseToolRequest(request, "flowdesk.export_debug.request.v1", []),
      include_sections: ["redaction_summary"],
      retention_hint: "keep_until_default_expiry"
    };
  }
  return baseToolRequest(request, "flowdesk.tool.request.v1");
}

function evaluateNaturalLanguageRouting(request: FlowDeskChatIntakeRequestV1, session: FlowDeskLocalNonDispatchAdapterSessionV1) {
  const evaluation = evaluateFlowDeskChatIntakeV1({ request, chatIntakeMode: "steering", hookHarnessMode: "enforce" });
  const toolName = evaluation.response.ok ? routedToolName(evaluation.response.safe_next_actions) : undefined;
  const routedToolResult = toolName === undefined ? undefined : session.evaluate(toolName, routedToolRequest(toolName, request, { requiresConfirmation: evaluation.response.route_decision === "ask_clarification" }));
  return {
    schema_version: "flowdesk.chat_intake.routing_result.v1",
    ok: evaluation.ok,
    evaluation,
    ...(toolName === undefined ? {} : { routedToolName: toolName }),
    ...(routedToolResult === undefined ? {} : { routedToolResult }),
    ...disabledAuthority
  };
}

function extractText(value: unknown): string {
  if (typeof value === "string") return value;
  if (!isRecord(value)) return "";
  const direct = [value.text, value.content, value.message].filter((candidate): candidate is string => typeof candidate === "string");
  const partText = Array.isArray(value.parts) ? value.parts.map(extractText) : [];
  const nestedMessage = isRecord(value.message) ? [extractText(value.message)] : [];
  return [...direct, ...partText, ...nestedMessage].filter((text) => text.length > 0).join(" ");
}

function intakeRequestFromChatMessage(input: unknown): FlowDeskChatIntakeRequestV1 {
  const record = isRecord(input) ? input : {};
  const requestId = safeToken(record.request_id ?? record.message_id ?? record.messageID ?? record.id, "chat-message");
  const sessionRef = safeToken(record.session_ref ?? record.session_id ?? record.sessionID, "chat-session");
  return {
    schema_version: "flowdesk.chat_intake.request.v1",
    request_id: `chat-${requestId}`,
    input_mode: "chat_routed",
    session_ref: sessionRef,
    redacted_intake_ref: `intake-${requestId}`,
    intake_summary: boundedText(extractText(record.message ?? record), "FlowDesk chat message."),
    source_surface: "chat.message"
  };
}

function clockMs(clock: FlowDeskLocalClockV1): number {
  return (typeof clock === "function" ? clock() : clock).getTime();
}

function hasPendingConfirmationCode(result: ReturnType<typeof evaluateNaturalLanguageRouting>): boolean {
  const localState = isRecord(result.routedToolResult) && isRecord(result.routedToolResult.localState) ? result.routedToolResult.localState : undefined;
  return localState?.pendingConfirmationStatus === "pending" && typeof localState.pendingConfirmationRef === "string";
}

function suggestionDuplicateKey(request: FlowDeskChatIntakeRequestV1, result: ReturnType<typeof evaluateNaturalLanguageRouting>): string {
  const response = result.evaluation.response;
  const suggestedNextStep = response.safe_next_actions[0] ?? "/flowdesk-status";
  return [request.session_ref, response.route_decision, suggestedNextStep].map((part, index) => safeToken(part, `chat-card-${index}`)).join("|");
}

function steeringText(result: ReturnType<typeof evaluateNaturalLanguageRouting>): string {
  const response = result.evaluation.response;
  const actions = response.safe_next_actions.map((action) => action === "ask_clarification" ? "Confirm the goal or plan before FlowDesk suggests a run." : action);
  const suggestedNextStep = actions[0] ?? "/flowdesk-status";
  const localState = isRecord(result.routedToolResult) && isRecord(result.routedToolResult.localState) ? result.routedToolResult.localState : undefined;
  const confirmationRef = localState?.pendingConfirmationStatus === "pending" && typeof localState.pendingConfirmationRef === "string" ? localState.pendingConfirmationRef : undefined;
  const why = response.ok === false
    ? "This request needs capabilities that are not available in the safe FlowDesk mode."
    : response.route_decision === "ask_clarification"
      ? "FlowDesk needs confirmation or a clearer goal before suggesting a command-backed workflow."
      : response.route_decision === "show_plan"
        ? "Your message looks like planning work that FlowDesk can organize as a command-backed plan."
        : "Your message matches a safe FlowDesk command-backed workflow.";
  return [
    "FlowDesk",
    `Suggested next step: ${suggestedNextStep}`,
    `Why: ${why}`,
    ...(confirmationRef === undefined ? [] : [`Confirmation code: ${confirmationRef}`, "To continue, review the plan and reply with this confirmation code plus explicit approval."]),
    "Actions:",
    ...actions.map((action) => `- ${action}`)
  ].join("\n");
}

function enumValues(values: readonly string[]): [string, ...string[]] {
  if (values.length === 0) throw new Error("FDS-1 enum field has no values");
  return [values[0] as string, ...values.slice(1)];
}

function zodForSchemaProperty(schemaId: string, fieldName: string, required: boolean): FlowDeskOpenCodeToolArg {
  const artifact = getRelease1SchemaArtifact(schemaId);
  if (artifact === undefined) throw new Error(`missing FDS-1 schema artifact: ${schemaId}`);
  const property = artifact.properties[fieldName];
  if (property === undefined) throw new Error(`missing FDS-1 property ${fieldName} for ${schemaId}`);

  let schema: FlowDeskOpenCodeToolArg;
  if (property.enum !== undefined) schema = tool.schema.enum(enumValues(property.enum));
  else if (property.type === "number") schema = tool.schema.number();
  else if (property.type === "boolean") schema = tool.schema.boolean();
  else if (property.type === "array") schema = tool.schema.array(tool.schema.string());
  else if (property.type === "object") schema = tool.schema.record(tool.schema.string(), tool.schema.unknown());
  else schema = tool.schema.string();

  if (property.maxLength !== undefined && property.type === "string") schema = (schema as z.ZodString).max(property.maxLength);
  if (property.maxItems !== undefined && property.type === "array") schema = (schema as z.ZodArray<z.ZodString>).max(property.maxItems);
  schema = schema.describe(property.description);
  return required ? schema : schema.optional();
}

export function createFlowDeskFds1SchemaConversionProbeTools(): Record<string, FlowDeskOpenCodeTool> {
  return Object.fromEntries(
    FLOWDESK_PRE_SPIKE_PLUGIN_TOOL_STUBS.map((stub) => {
      const artifact = getRelease1SchemaArtifact(stub.requestSchemaId);
      if (artifact === undefined) throw new Error(`missing FDS-1 schema artifact: ${stub.requestSchemaId}`);
      const required = new Set(artifact.required);
      const args = Object.fromEntries(
        Object.keys(artifact.properties).map((fieldName) => [fieldName, zodForSchemaProperty(stub.requestSchemaId, fieldName, required.has(fieldName))])
      ) as FlowDeskOpenCodeToolArgs;
      return [
        stub.toolName,
        tool({
          description: `FlowDesk FDS-1 schema conversion probe for ${stub.toolName}; no dispatch, provider call, or runtime execution.`,
          args,
          async execute(request) {
            return JSON.stringify(runFlowDeskPreSpikePluginToolStub(stub.toolName, request));
          }
        })
      ];
    })
  );
}

export function createFlowDeskLocalNonDispatchAdapterTools(now = new Date(), session = createFlowDeskLocalNonDispatchAdapterSession(now)): Record<string, FlowDeskOpenCodeTool> {
  return Object.fromEntries(
    FLOWDESK_PRE_SPIKE_PLUGIN_TOOL_STUBS.map((stub) => {
      const artifact = getRelease1SchemaArtifact(stub.requestSchemaId);
      if (artifact === undefined) throw new Error(`missing FDS-1 schema artifact: ${stub.requestSchemaId}`);
      const required = new Set(artifact.required);
      const args = Object.fromEntries(
        Object.keys(artifact.properties).map((fieldName) => [fieldName, zodForSchemaProperty(stub.requestSchemaId, fieldName, required.has(fieldName))])
      ) as FlowDeskOpenCodeToolArgs;
      return [
        stub.toolName,
        tool({
          description: `FlowDesk local non-dispatch command adapter for ${stub.toolName}; no provider call, real dispatch, or lane launch.`,
          args,
          async execute(request) {
            return JSON.stringify(session.evaluate(stub.toolName, request));
          }
        })
      ];
    })
  );
}

export function createFlowDeskNaturalLanguageRoutingTools(now = new Date(), session = createFlowDeskLocalNonDispatchAdapterSession(now)): Record<string, FlowDeskOpenCodeTool> {
  const artifact = getRelease1SchemaArtifact("flowdesk.chat_intake.request.v1");
  if (artifact === undefined) throw new Error("missing FDS-1 schema artifact: flowdesk.chat_intake.request.v1");
  const required = new Set(artifact.required);
  const args = Object.fromEntries(
    Object.keys(artifact.properties).map((fieldName) => [fieldName, zodForSchemaProperty("flowdesk.chat_intake.request.v1", fieldName, required.has(fieldName))])
  ) as FlowDeskOpenCodeToolArgs;
  return {
    [flowdeskChatIntakeToolName]: tool({
      description: "FlowDesk natural-language chat intake steering; command-backed only, with no provider call, real dispatch, lane launch, fallback, or hard chat control.",
      args,
      async execute(request) {
        return JSON.stringify(evaluateNaturalLanguageRouting(request as unknown as FlowDeskChatIntakeRequestV1, session));
      }
    })
  };
}

export function createFlowDeskNaturalLanguageChatMessageHook(now: FlowDeskLocalClockV1 = () => new Date(), session = createFlowDeskLocalNonDispatchAdapterSession(now)) {
  const recentSuggestionCards = new Map<string, number>();
  return async function message(input: unknown, output: FlowDeskChatMessageOutput): Promise<void> {
    const inputRecord = isRecord(input) ? input : {};
    const request = intakeRequestFromChatMessage({ ...inputRecord, ...output });
    const result = evaluateNaturalLanguageRouting(request, session);
    if (result.evaluation.response.route_decision === "continue_chat") return;
    const nowMs = clockMs(now);
    for (const [key, recordedAtMs] of recentSuggestionCards) {
      if (nowMs - recordedAtMs > flowdeskChatSuggestionDuplicateWindowMs || nowMs < recordedAtMs) recentSuggestionCards.delete(key);
    }
    if (!hasPendingConfirmationCode(result)) {
      const duplicateKey = suggestionDuplicateKey(request, result);
      const previousAtMs = recentSuggestionCards.get(duplicateKey);
      recentSuggestionCards.set(duplicateKey, nowMs);
      if (previousAtMs !== undefined && nowMs - previousAtMs <= flowdeskChatSuggestionDuplicateWindowMs) return;
    }
    if (!Array.isArray(output.parts)) output.parts = [];
    output.parts.push({ type: "text", text: steeringText(result) });
  };
}

function isFds1SchemaConversionProbeEnabled(options?: PluginOptions): boolean {
  return options?.[flowdeskFds1SchemaConversionProbeOption] === true;
}

function isLocalNonDispatchAdapterEnabled(options?: PluginOptions): boolean {
  return options?.[flowdeskLocalNonDispatchAdapterOption] === true;
}

function isNaturalLanguageRoutingEnabled(options?: PluginOptions): boolean {
  return options?.[flowdeskNaturalLanguageRoutingOption] === true;
}

function durableStateRootFromOptions(options?: PluginOptions): string | undefined {
  const value = options?.[flowdeskDurableStateRootOption];
  return typeof value === "string" && value.trim().length > 0 ? value : undefined;
}

const flowdeskServerPlugin: Plugin = async (_input, options) => {
  const localSession = isLocalNonDispatchAdapterEnabled(options) || isNaturalLanguageRoutingEnabled(options) ? createFlowDeskLocalNonDispatchAdapterSession(new Date(), undefined, { durableStateRootDir: durableStateRootFromOptions(options) }) : undefined;
  const tools: Record<string, FlowDeskOpenCodeTool> = {
    [flowdeskPreSpikeDoctorToolName]: tool({
      description: "Report FlowDesk plugin load status without enabling production tools or dispatch.",
      args: {},
      async execute() {
        return JSON.stringify({
          pluginId: flowdeskPluginId,
          loaded: true,
          probeRegistrationProfile: isFds1SchemaConversionProbeEnabled(options) ? "sandbox_conformance_probe_only" : "disabled",
          localNonDispatchAdapterProfile: isLocalNonDispatchAdapterEnabled(options) ? flowdeskLocalNonDispatchAdapterProfile : "disabled",
          naturalLanguageRoutingProfile: isNaturalLanguageRoutingEnabled(options) ? "chat_steering_command_backed_non_dispatch" : "disabled",
          productionPromotionGate: "blocked_production_opencode_registration_disabled",
          productionOpenCodeRegistration: hasProductionOpenCodeRegistration(),
          productionToolRegistration: flowdeskPluginScaffold.productionToolRegistration,
          release1HandlerReadiness: getFlowDeskRelease1HandlerReadinessSummary(),
          release1ProductionReadiness: getFlowDeskRelease1ProductionReadinessSummary(),
          fds1SchemaConversionSpikePassed: hasPassingFds1SchemaConversionSpike(),
          realOpenCodeDispatch: flowdeskPluginScaffold.runtimeBoundary.realOpenCodeDispatch,
          providerCall: false,
          runtimeExecution: false,
          actualLaneLaunch: false,
          fallbackAuthority: false,
          hardCancelOrNoReplyAuthority: false
        });
      }
    })
  };
  if (isFds1SchemaConversionProbeEnabled(options)) Object.assign(tools, createFlowDeskFds1SchemaConversionProbeTools());
  if (isLocalNonDispatchAdapterEnabled(options)) Object.assign(tools, createFlowDeskLocalNonDispatchAdapterTools(new Date(), localSession));
  if (isNaturalLanguageRoutingEnabled(options)) Object.assign(tools, createFlowDeskNaturalLanguageRoutingTools(new Date(), localSession));
  if (!isNaturalLanguageRoutingEnabled(options)) return { tool: tools };
  return { tool: tools, "chat.message": createFlowDeskNaturalLanguageChatMessageHook(() => new Date(), localSession) };
};

export const flowdeskOpenCodeServerPlugin = {
  id: flowdeskPluginId,
  server: flowdeskServerPlugin
} satisfies PluginModule;

export default flowdeskOpenCodeServerPlugin;
