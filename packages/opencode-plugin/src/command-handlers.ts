import type {
  FlowDeskFakeRuntimeCommandInputV1,
  FlowDeskGuardedDryRunCommandInputV1,
  FlowDeskPlanCommandInputV1,
  FlowDeskRelease1MinimumToolName,
  FlowDeskRetryPlanningInputV1,
  FlowDeskRunRequestV1,
  FlowDeskStatusCommandInputV1,
  ValidationResult
} from "@flowdesk/core";
import {
  evaluateFlowDeskFakeRuntimeCommandV1,
  evaluateFlowDeskGuardedDryRunCommandV1,
  evaluateFlowDeskPlanCommandV1,
  evaluateFlowDeskRetryPlanningV1,
  evaluateFlowDeskStatusCommandV1,
  FLOWDESK_RELEASE_1_COMMAND_MANIFEST,
  invalid,
  valid,
  validateSchemaArtifactValue
} from "@flowdesk/core";
import { getFlowDeskRelease1HandlerReadiness } from "./tool-stubs.js";

export type FlowDeskCommandBackedHandlerModeV1 = "command_backed_core_evaluator" | "missing_evaluator_input" | "request_schema_invalid" | "schema_only_pending";

export interface FlowDeskCommandBackedRunHandlerContextV1 {
  guardedDryRun?: Omit<FlowDeskGuardedDryRunCommandInputV1, "commandName" | "request">;
  fakeRuntime?: Omit<FlowDeskFakeRuntimeCommandInputV1, "commandName" | "request">;
}

export interface FlowDeskCommandBackedHandlerContextV1 {
  plan?: Omit<FlowDeskPlanCommandInputV1, "request">;
  run?: FlowDeskCommandBackedRunHandlerContextV1;
  status?: Omit<FlowDeskStatusCommandInputV1, "request">;
  retry?: Omit<FlowDeskRetryPlanningInputV1, "request">;
}

export interface FlowDeskCommandBackedHandlerResultV1 extends ValidationResult {
  toolName: FlowDeskRelease1MinimumToolName;
  handlerMode: FlowDeskCommandBackedHandlerModeV1;
  requestSchemaValid: boolean;
  responseSchemaValid: boolean;
  coreEvaluationOk: boolean;
  response?: unknown;
  productionRegistrationEligible: false;
  realOpenCodeDispatch: false;
  actualLaneLaunch: false;
  providerCall: false;
  runtimeExecution: false;
  fallbackAuthority: false;
  hardCancelOrNoReplyAuthority: false;
}

const disabledAuthority = {
  productionRegistrationEligible: false,
  realOpenCodeDispatch: false,
  actualLaneLaunch: false,
  providerCall: false,
  runtimeExecution: false,
  fallbackAuthority: false,
  hardCancelOrNoReplyAuthority: false
} as const;

function result(mode: FlowDeskCommandBackedHandlerModeV1, toolName: FlowDeskRelease1MinimumToolName, requestResult: ValidationResult, responseResult: ValidationResult, response: unknown, coreEvaluationOk: boolean): FlowDeskCommandBackedHandlerResultV1 {
  const errors = [...requestResult.errors, ...responseResult.errors];
  const validation = errors.length === 0 ? valid() : invalid(...errors);
  return {
    ...validation,
    toolName,
    handlerMode: mode,
    requestSchemaValid: requestResult.ok,
    responseSchemaValid: responseResult.ok,
    coreEvaluationOk,
    ...(response === undefined ? {} : { response }),
    ...disabledAuthority
  };
}

function responseSchemaResult(toolName: FlowDeskRelease1MinimumToolName, response: unknown): ValidationResult {
  const manifestEntry = FLOWDESK_RELEASE_1_COMMAND_MANIFEST.find((entry) => entry.toolName === toolName);
  if (manifestEntry === undefined) return invalid("toolName is not a Release 1 minimum tool");
  return validateSchemaArtifactValue(manifestEntry.responseSchemaId, response);
}

function requestSchemaResult(toolName: FlowDeskRelease1MinimumToolName, request: unknown): ValidationResult {
  const manifestEntry = FLOWDESK_RELEASE_1_COMMAND_MANIFEST.find((entry) => entry.toolName === toolName);
  if (manifestEntry === undefined) return invalid("toolName is not a Release 1 minimum tool");
  return validateSchemaArtifactValue(manifestEntry.requestSchemaId, request);
}

export function evaluateFlowDeskCommandBackedHandlerV1(toolName: FlowDeskRelease1MinimumToolName, request: unknown, context: FlowDeskCommandBackedHandlerContextV1 = {}): FlowDeskCommandBackedHandlerResultV1 {
  const readiness = getFlowDeskRelease1HandlerReadiness().find((entry) => entry.toolName === toolName);
  const requestResult = requestSchemaResult(toolName, request);
  if (!requestResult.ok) return result("request_schema_invalid", toolName, requestResult, invalid("response unavailable when request schema is invalid"), undefined, false);
  if (readiness?.handlerReadiness !== "core_evaluator_available") return result("schema_only_pending", toolName, requestResult, invalid("core evaluator is not available for this handler yet"), undefined, false);

  if (toolName === "flowdesk_plan") {
    if (context.plan === undefined) return result("missing_evaluator_input", toolName, requestResult, invalid("plan evaluator input is required"), undefined, false);
    const evaluation = evaluateFlowDeskPlanCommandV1({ ...context.plan, request: request as FlowDeskPlanCommandInputV1["request"] });
    return result("command_backed_core_evaluator", toolName, requestResult, responseSchemaResult(toolName, evaluation.response), evaluation.response, evaluation.ok);
  }

  if (toolName === "flowdesk_run") {
    const runRequest = request as FlowDeskRunRequestV1;
    if (runRequest.run_mode === "guarded-dry-run") {
      if (context.run?.guardedDryRun === undefined) return result("missing_evaluator_input", toolName, requestResult, invalid("guarded dry-run evaluator input is required"), undefined, false);
      const evaluation = evaluateFlowDeskGuardedDryRunCommandV1({ ...context.run.guardedDryRun, commandName: "/flowdesk-run", request: runRequest });
      return result("command_backed_core_evaluator", toolName, requestResult, responseSchemaResult(toolName, evaluation.response), evaluation.response, evaluation.ok);
    }
    if (context.run?.fakeRuntime === undefined) return result("missing_evaluator_input", toolName, requestResult, invalid("fake-runtime evaluator input is required"), undefined, false);
    const evaluation = evaluateFlowDeskFakeRuntimeCommandV1({ ...context.run.fakeRuntime, commandName: "/flowdesk-run", request: runRequest });
    return result("command_backed_core_evaluator", toolName, requestResult, responseSchemaResult(toolName, evaluation.response), evaluation.response, evaluation.ok);
  }

  if (toolName === "flowdesk_status") {
    if (context.status === undefined) return result("missing_evaluator_input", toolName, requestResult, invalid("status evaluator input is required"), undefined, false);
    const evaluation = evaluateFlowDeskStatusCommandV1({ ...context.status, request: request as FlowDeskStatusCommandInputV1["request"] });
    return result("command_backed_core_evaluator", toolName, requestResult, responseSchemaResult(toolName, evaluation.response), evaluation.response, evaluation.ok);
  }

  if (toolName === "flowdesk_retry") {
    if (context.retry === undefined) return result("missing_evaluator_input", toolName, requestResult, invalid("retry evaluator input is required"), undefined, false);
    const evaluation = evaluateFlowDeskRetryPlanningV1({ ...context.retry, request: request as FlowDeskRetryPlanningInputV1["request"] });
    return result("command_backed_core_evaluator", toolName, requestResult, responseSchemaResult(toolName, evaluation.response), evaluation.response, evaluation.ok);
  }

  return result("schema_only_pending", toolName, requestResult, invalid("core evaluator adapter is not implemented for this handler yet"), undefined, false);
}
