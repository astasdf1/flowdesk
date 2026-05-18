import type {
  ChatIntakeModeV1,
  FlowDeskChatIntakeRequestV1,
  FlowDeskChatIntakeResponseV1,
  HookHarnessModeV1,
  OpaqueRef,
  SafeNextAction
} from "./release1-contracts.js";
import type { ValidationResult } from "./validators.js";
import { invalid, valid, validateChatIntakeRequestV1, validateChatIntakeResponseV1, validateOpaqueRef } from "./validators.js";

export interface FlowDeskChatRoutingInputV1 {
  request: FlowDeskChatIntakeRequestV1;
  chatIntakeMode?: ChatIntakeModeV1 | "blocking";
  hookHarnessMode?: HookHarnessModeV1;
  steeringEvidenceRef?: OpaqueRef;
  redactedIntakeRef?: OpaqueRef;
}

export interface FlowDeskChatRoutingEvaluationV1 extends ValidationResult {
  response: FlowDeskChatIntakeResponseV1;
}

const fallbackActions = ["/flowdesk-doctor", "/flowdesk-status", "/flowdesk-export-debug"] as const;
const unsafeLaterGatePattern = /\b(real[\s_-]*(?:opencode[\s_-]*)?dispatch|realOpenCodeDispatch|actual[\s_-]*lane[\s_-]*launch|actualLaneLaunch|provider[\s_-]*(?:call|request|api)|providerCall|automatic[\s_-]*(?:fallback|reselection)|automaticFallbackOrReselection|fallback[\s_-]*(?:provider|model|authority)|fallbackAuthority|reselect(?:ion)?|hard[\s_-]*(?:cancel|stop|no[\s_-]*reply)|hardCancelOrNoReply|noReply|no[\s_-]*reply|cancel:\s*true|stop:\s*true|opencode[\s_-]*run)\b/i;
const planningPattern = /\b(implement|add|build|create|fix|change|refactor|test|write|plan|debug|investigate|review|improve)\b|(?:계획|구현)/i;
const clarificationPattern = /\b(maybe|not sure|unclear|something|stuff|thing|help me with it|continue this)\b/i;

const commandRoutes: readonly (readonly [RegExp, readonly SafeNextAction[]])[] = [
  [/\b(?:show|current|check|get|what(?:'s| is))\b.{0,40}\b(?:status|progress|state|checkpoint)\b|\bflowdesk-status\b|(?:상태|진행상황)/i, ["/flowdesk-status"]],
  [/\b(doctor|diagnos(?:e|tic)|compatibility|health)\b/i, ["/flowdesk-doctor"]],
  [/\b(?:run|execute|start)\b.{0,50}\b(?:fake[\s_-]*runtime|guarded[\s_-]*dry[\s_-]*run|dry[\s_-]*run|plan|workflow)\b|\b(?:fake[\s_-]*runtime|guarded[\s_-]*dry[\s_-]*run|dry[\s_-]*run)\b|(?:진행|실행)/i, ["/flowdesk-run", "/flowdesk-status"]],
  [/\b(resume|continue from checkpoint)\b/i, ["/flowdesk-status", "/flowdesk-resume"]],
  [/\b(retry|try again)\b/i, ["/flowdesk-status", "/flowdesk-retry"]],
  [/\b(abort|cancel workflow|stop workflow)\b/i, ["/flowdesk-status", "/flowdesk-abort"]],
  [/\b(usage|quota|limit)\b/i, ["/flowdesk-usage", "/flowdesk-doctor"]],
  [/\b(debug export|export debug|debug bundle|logs?)\b/i, ["/flowdesk-export-debug", "/flowdesk-status"]]
];

function uniqueActions(actions: readonly SafeNextAction[]): SafeNextAction[] {
  return [...new Set(actions)].slice(0, 8);
}

function redactedIntakeRef(input: FlowDeskChatRoutingInputV1): OpaqueRef {
  const candidates = [input.redactedIntakeRef, input.request.redacted_intake_ref, input.request.session_ref, input.request.workflow_id, `intake-${input.request.request_id}`];
  const candidate = candidates.find((value) => validateOpaqueRef(value, "redacted_intake_ref").ok);
  return candidate ?? "intake-redacted";
}

function disabledResponse(input: FlowDeskChatRoutingInputV1): FlowDeskChatIntakeResponseV1 {
  return {
    schema_version: "flowdesk.chat_intake.response.v1",
    ok: true,
    status: "diagnostic_only",
    safe_next_actions: ["/flowdesk-doctor", "/flowdesk-status"],
    user_message: "FlowDesk chat steering is unavailable; use portable commands for safe fallback.",
    classification: "fast_chat",
    redacted_intake_ref: redactedIntakeRef(input),
    route_decision: "use_command_fallback"
  };
}

function blockedResponse(input: FlowDeskChatRoutingInputV1): FlowDeskChatIntakeResponseV1 {
  return {
    schema_version: "flowdesk.chat_intake.response.v1",
    ok: false,
    status: "blocked",
    safe_next_actions: [...fallbackActions],
    user_message: "FlowDesk blocked this chat route because it requires capabilities outside Release 1 command-backed steering.",
    classification: "blocked",
    redacted_intake_ref: redactedIntakeRef(input),
    route_decision: "use_command_fallback",
    error: {
      category: "policy",
      safe_remediation: "Use Release 1 portable commands and diagnostics; later-gate runtime authority remains disabled."
    }
  };
}

function schemaFailedResponse(): FlowDeskChatIntakeResponseV1 {
  return {
    schema_version: "flowdesk.chat_intake.response.v1",
    ok: false,
    status: "blocked",
    safe_next_actions: ["/flowdesk-doctor", "/flowdesk-status"],
    user_message: "FlowDesk chat intake failed closed before routing.",
    classification: "blocked",
    redacted_intake_ref: "intake-redacted",
    route_decision: "use_command_fallback",
    error: {
      category: "schema",
      safe_remediation: "Retry with a redacted summary or use a portable FlowDesk command."
    }
  };
}

function commandFallbackResponse(input: FlowDeskChatRoutingInputV1, actions: readonly SafeNextAction[]): FlowDeskChatIntakeResponseV1 {
  return {
    schema_version: "flowdesk.chat_intake.response.v1",
    ok: true,
    status: "diagnostic_only",
    safe_next_actions: uniqueActions([...actions, "/flowdesk-status"]),
    user_message: "FlowDesk routed this chat request to a command-backed Release 1 flow.",
    classification: "fast_chat",
    redacted_intake_ref: redactedIntakeRef(input),
    route_decision: "use_command_fallback"
  };
}

function managedPlanResponse(input: FlowDeskChatRoutingInputV1): FlowDeskChatIntakeResponseV1 {
  return {
    schema_version: "flowdesk.chat_intake.response.v1",
    ok: true,
    status: "ready",
    safe_next_actions: ["/flowdesk-plan", "/flowdesk-status"],
    user_message: "FlowDesk can steer this request into a guarded command-backed planning flow.",
    classification: "managed_plan",
    redacted_intake_ref: redactedIntakeRef(input),
    route_decision: "show_plan"
  };
}

function clarifyResponse(input: FlowDeskChatRoutingInputV1): FlowDeskChatIntakeResponseV1 {
  return {
    schema_version: "flowdesk.chat_intake.response.v1",
    ok: true,
    status: "needs_clarification",
    safe_next_actions: ["ask_clarification", "/flowdesk-status"],
    user_message: "FlowDesk needs a clearer goal before steering this chat request into a command-backed flow.",
    classification: "clarify",
    redacted_intake_ref: redactedIntakeRef(input),
    route_decision: "ask_clarification"
  };
}

function continueChatResponse(input: FlowDeskChatRoutingInputV1): FlowDeskChatIntakeResponseV1 {
  return {
    schema_version: "flowdesk.chat_intake.response.v1",
    ok: true,
    status: "ready",
    safe_next_actions: ["continue_chat"],
    user_message: "FlowDesk did not take over this general chat request.",
    classification: "fast_chat",
    redacted_intake_ref: redactedIntakeRef(input),
    route_decision: "continue_chat"
  };
}

export function buildFlowDeskChatIntakeResponseV1(input: FlowDeskChatRoutingInputV1): FlowDeskChatIntakeResponseV1 {
  if (!validateChatIntakeRequestV1(input.request).ok) return schemaFailedResponse();
  if (input.chatIntakeMode === "blocking") return blockedResponse(input);
  if (input.chatIntakeMode !== undefined && input.chatIntakeMode !== "steering") return disabledResponse(input);
  if (input.hookHarnessMode === "off" || input.hookHarnessMode === "observe") return disabledResponse(input);

  const summary = input.request.intake_summary;
  if (unsafeLaterGatePattern.test(summary)) return blockedResponse(input);
  const command = commandRoutes.find(([pattern]) => pattern.test(summary));
  if (command !== undefined) return commandFallbackResponse(input, command[1]);
  if (planningPattern.test(summary)) return clarificationPattern.test(summary) ? clarifyResponse(input) : managedPlanResponse(input);
  return continueChatResponse(input);
}

export function evaluateFlowDeskChatIntakeV1(input: FlowDeskChatRoutingInputV1): FlowDeskChatRoutingEvaluationV1 {
  const response = buildFlowDeskChatIntakeResponseV1(input);
  const responseResult = validateChatIntakeResponseV1(response);
  if (!responseResult.ok) return { ...invalid(...responseResult.errors), response };
  return { ...valid(), response };
}
