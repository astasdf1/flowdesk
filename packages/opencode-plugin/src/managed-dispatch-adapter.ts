import type { GuardBoundaryDecisionV1, ManagedDispatchBetaBoundaryInputV1 } from "@flowdesk/core";
import { evaluateManagedDispatchBetaGuardBoundaryV1 } from "@flowdesk/core";

export const flowdeskManagedDispatchBetaAdapterProfile = "managed_dispatch_beta_real_opencode_dispatch_adapter" as const;

export type FlowDeskManagedDispatchBetaDispatchMethodV1 = "promptAsync" | "prompt";
export type FlowDeskManagedDispatchBetaDispatchStatusV1 = "blocked_before_dispatch" | "dispatch_accepted" | "dispatch_completed" | "dispatch_failed";

export interface FlowDeskManagedDispatchBetaDispatchRequestV1 {
  sessionId: string;
  agent: string;
  provider_qualified_model_id: string;
  promptText?: string;
  promptSummary?: string;
  directory?: string;
  dispatchMethod?: FlowDeskManagedDispatchBetaDispatchMethodV1;
}

export interface FlowDeskManagedDispatchBetaAuthoritySummaryV1 {
  realOpenCodeDispatch: boolean;
  providerCall: boolean;
  runtimeExecution: boolean;
  actualLaneLaunch: boolean;
  fallbackAuthority: false;
  toolAuthority: false;
  hardCancelOrNoReplyAuthority: false;
}

export interface FlowDeskManagedDispatchBetaVerificationStatusV1 {
  ambiguityQuarantined: boolean;
  configuredVerificationRef?: string;
  preDispatchAuditRef?: string;
  defaultRelease1ServerBehaviorUnchanged: true;
}

export interface FlowDeskManagedDispatchBetaBlockedResultV1 {
  adapterProfile: typeof flowdeskManagedDispatchBetaAdapterProfile;
  status: "blocked_before_dispatch";
  dispatchAttempted: false;
  guardDecision: GuardBoundaryDecisionV1;
  redactedBlockReason: string;
  authority: FlowDeskManagedDispatchBetaAuthoritySummaryV1;
  verification: FlowDeskManagedDispatchBetaVerificationStatusV1;
}

export interface FlowDeskManagedDispatchBetaDispatchResultV1 {
  adapterProfile: typeof flowdeskManagedDispatchBetaAdapterProfile;
  status: "dispatch_accepted" | "dispatch_completed";
  dispatchAttempted: true;
  dispatchMethod: FlowDeskManagedDispatchBetaDispatchMethodV1;
  guardDecision: GuardBoundaryDecisionV1;
  sessionId: string;
  agent: string;
  model: {
    providerID: string;
    modelID: string;
  };
  directory?: string;
  response?: unknown;
  authority: FlowDeskManagedDispatchBetaAuthoritySummaryV1;
  verification: FlowDeskManagedDispatchBetaVerificationStatusV1;
}

export interface FlowDeskManagedDispatchBetaDispatchFailedResultV1 {
  adapterProfile: typeof flowdeskManagedDispatchBetaAdapterProfile;
  status: "dispatch_failed";
  dispatchAttempted: true;
  dispatchMethod: FlowDeskManagedDispatchBetaDispatchMethodV1;
  guardDecision: GuardBoundaryDecisionV1;
  sessionId: string;
  agent: string;
  model: {
    providerID: string;
    modelID: string;
  };
  directory?: string;
  redactedErrorCategory: "provider_api" | "runtime" | "unknown";
  authority: FlowDeskManagedDispatchBetaAuthoritySummaryV1;
  verification: FlowDeskManagedDispatchBetaVerificationStatusV1;
}

export type FlowDeskManagedDispatchBetaAdapterResultV1 = FlowDeskManagedDispatchBetaBlockedResultV1 | FlowDeskManagedDispatchBetaDispatchResultV1 | FlowDeskManagedDispatchBetaDispatchFailedResultV1;

export interface FlowDeskManagedDispatchBetaPromptOptionsV1 {
  path: { id: string };
  query?: { directory?: string };
  body: {
    model: { providerID: string; modelID: string };
    agent: string;
    parts: Array<{ type: "text"; text: string }>;
  };
}

export interface FlowDeskManagedDispatchBetaOpenCodeClientV1 {
  session: {
    prompt?(options: FlowDeskManagedDispatchBetaPromptOptionsV1): unknown | Promise<unknown>;
    promptAsync?(options: FlowDeskManagedDispatchBetaPromptOptionsV1): unknown | Promise<unknown>;
  };
}

function disabledAuthority(): FlowDeskManagedDispatchBetaAuthoritySummaryV1 {
  return {
    realOpenCodeDispatch: false,
    providerCall: false,
    runtimeExecution: false,
    actualLaneLaunch: false,
    fallbackAuthority: false,
    toolAuthority: false,
    hardCancelOrNoReplyAuthority: false
  };
}

function enabledDispatchAuthority(): FlowDeskManagedDispatchBetaAuthoritySummaryV1 {
  return {
    ...disabledAuthority(),
    realOpenCodeDispatch: true,
    providerCall: true,
    runtimeExecution: true
  };
}

function verificationFor(input: ManagedDispatchBetaBoundaryInputV1): FlowDeskManagedDispatchBetaVerificationStatusV1 {
  return {
    ambiguityQuarantined: input.ambiguityQuarantined === true,
    ...(input.configuredVerificationRef === undefined ? {} : { configuredVerificationRef: input.configuredVerificationRef }),
    ...(input.preDispatchAuditRef === undefined ? {} : { preDispatchAuditRef: input.preDispatchAuditRef }),
    defaultRelease1ServerBehaviorUnchanged: true
  };
}

function blocked(input: ManagedDispatchBetaBoundaryInputV1, guardDecision: GuardBoundaryDecisionV1, redactedBlockReason = guardDecision.redacted_reason): FlowDeskManagedDispatchBetaBlockedResultV1 {
  return {
    adapterProfile: flowdeskManagedDispatchBetaAdapterProfile,
    status: "blocked_before_dispatch",
    dispatchAttempted: false,
    guardDecision,
    redactedBlockReason,
    authority: disabledAuthority(),
    verification: verificationFor(input)
  };
}

function parseProviderQualifiedModelId(value: string): { providerID: string; modelID: string } | undefined {
  const separator = value.indexOf("/");
  if (separator <= 0 || separator === value.length - 1) return undefined;
  const providerID = value.slice(0, separator).trim();
  const modelID = value.slice(separator + 1).trim();
  if (providerID.length === 0 || modelID.length === 0) return undefined;
  return { providerID, modelID };
}

function promptTextFrom(request: FlowDeskManagedDispatchBetaDispatchRequestV1): string | undefined {
  const text = request.promptText?.trim() ?? request.promptSummary?.trim() ?? "";
  return text.length > 0 ? text.slice(0, 20_000) : undefined;
}

function dispatchOptions(request: FlowDeskManagedDispatchBetaDispatchRequestV1, model: { providerID: string; modelID: string }, text: string): FlowDeskManagedDispatchBetaPromptOptionsV1 {
  return {
    path: { id: request.sessionId },
    ...(request.directory === undefined ? {} : { query: { directory: request.directory } }),
    body: {
      model,
      agent: request.agent,
      parts: [{ type: "text", text }]
    }
  };
}

export async function dispatchManagedDispatchBetaPromptV1(input: {
  client: FlowDeskManagedDispatchBetaOpenCodeClientV1;
  boundaryInput: ManagedDispatchBetaBoundaryInputV1;
  request: FlowDeskManagedDispatchBetaDispatchRequestV1;
}): Promise<FlowDeskManagedDispatchBetaAdapterResultV1> {
  const guardDecision = evaluateManagedDispatchBetaGuardBoundaryV1(input.boundaryInput);
  if (guardDecision.status !== "eligible") return blocked(input.boundaryInput, guardDecision);

  const approvedProviderQualifiedModelId = input.boundaryInput.guardApproval?.provider_qualified_model_id;
  if (approvedProviderQualifiedModelId === undefined || input.request.provider_qualified_model_id !== approvedProviderQualifiedModelId) {
    return blocked(input.boundaryInput, guardDecision, "Dispatch request model must exactly match Guard-approved provider-qualified model.");
  }

  const model = parseProviderQualifiedModelId(approvedProviderQualifiedModelId);
  if (model === undefined || model.providerID !== input.boundaryInput.guardApproval?.provider_family) {
    return blocked(input.boundaryInput, guardDecision, "Guard-approved provider-qualified model is invalid or provider-mismatched.");
  }

  const text = promptTextFrom(input.request);
  if (input.request.sessionId.trim().length === 0 || input.request.agent.trim().length === 0 || text === undefined) {
    return blocked(input.boundaryInput, guardDecision, "Dispatch request is missing session, agent, or bounded prompt text.");
  }

  const dispatchMethod = input.request.dispatchMethod ?? "promptAsync";
  const dispatch = input.client.session[dispatchMethod];
  if (dispatch === undefined) return blocked(input.boundaryInput, guardDecision, "Injected OpenCode client is missing the requested session prompt method.");

  const options = dispatchOptions(input.request, model, text);
  let response: unknown;
  try {
    response = await dispatch.call(input.client.session, options);
  } catch {
    return {
      adapterProfile: flowdeskManagedDispatchBetaAdapterProfile,
      status: "dispatch_failed",
      dispatchAttempted: true,
      dispatchMethod,
      guardDecision,
      sessionId: input.request.sessionId,
      agent: input.request.agent,
      model,
      ...(input.request.directory === undefined ? {} : { directory: input.request.directory }),
      redactedErrorCategory: "provider_api",
      authority: { ...enabledDispatchAuthority(), runtimeExecution: false },
      verification: verificationFor(input.boundaryInput)
    };
  }
  return {
    adapterProfile: flowdeskManagedDispatchBetaAdapterProfile,
    status: dispatchMethod === "promptAsync" ? "dispatch_accepted" : "dispatch_completed",
    dispatchAttempted: true,
    dispatchMethod,
    guardDecision,
    sessionId: input.request.sessionId,
    agent: input.request.agent,
    model,
    ...(input.request.directory === undefined ? {} : { directory: input.request.directory }),
    ...(response === undefined ? {} : { response }),
    authority: enabledDispatchAuthority(),
    verification: verificationFor(input.boundaryInput)
  };
}
