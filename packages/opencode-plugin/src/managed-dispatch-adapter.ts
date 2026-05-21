import type { FlowDeskDispatchAttemptManifestV1, FlowDeskProductionApprovalSourceV1, GuardBoundaryDecisionV1, ManagedDispatchBetaBoundaryInputV1 } from "@flowdesk/core";
import { evaluateFlowDeskDispatchAttemptPrecallV1, evaluateManagedDispatchBetaGuardBoundaryV1, promoteFlowDeskManagedDispatchBetaAuthorityV1 } from "@flowdesk/core";

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
    children?(options: { path: { id: string }; query?: { directory?: string } }): unknown | Promise<unknown>;
    messages?(options: { path: { id: string }; query?: { directory?: string } }): unknown | Promise<unknown>;
  };
}

export interface FlowDeskInjectedSdkLaneObservationRequestV1 {
  parentSessionId: string;
  laneId: string;
  requestedAgent: string;
  requestedProviderQualifiedModelId: string;
  directory?: string;
}

export interface FlowDeskInjectedSdkLaneObservationResultV1 {
  adapterProfile: "injected_sdk_lane_observation_probe";
  status: "observed" | "partial" | "observation_unavailable" | "observation_failed";
  observationAttempted: boolean;
  parentSessionRef: string;
  laneId: string;
  requestedAgentRef: string;
  requestedModelRef: string;
  childSessionRef?: string;
  messageRef?: string;
  observedAgentRef?: string;
  observedModelRef?: string;
  missingLabels: string[];
  authority: FlowDeskManagedDispatchBetaAuthoritySummaryV1;
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

function refFrom(label: string, value: string): string {
  const safe = value.replaceAll(/[^A-Za-z0-9_.:-]/g, "-").replaceAll(/-+/g, "-").slice(0, 96);
  return `${label}-${safe.length > 0 ? safe : "unknown"}`;
}

function asRecord(value: unknown): Record<string, unknown> | undefined {
  return typeof value === "object" && value !== null && !Array.isArray(value) ? value as Record<string, unknown> : undefined;
}

function responseData(value: unknown): unknown {
  const record = asRecord(value);
  return record !== undefined && "data" in record ? record.data : value;
}

function arrayData(value: unknown): unknown[] {
  const data = responseData(value);
  if (Array.isArray(data)) return data;
  const record = asRecord(data);
  return Array.isArray(record?.items) ? record.items : [];
}

function modelRef(value: unknown): string | undefined {
  const record = asRecord(value);
  if (record === undefined) return undefined;
  const providerID = typeof record.providerID === "string" ? record.providerID : undefined;
  const modelID = typeof record.modelID === "string" ? record.modelID : typeof record.id === "string" ? record.id : undefined;
  return providerID !== undefined && modelID !== undefined ? refFrom("model", `${providerID}-${modelID}`) : undefined;
}

function firstMessageRef(value: unknown): string | undefined {
  const messages = arrayData(value);
  for (const message of messages) {
    const record = asRecord(message);
    const info = asRecord(record?.info) ?? record;
    if (typeof info?.id === "string") return refFrom("message", info.id);
  }
  return undefined;
}

export async function observeInjectedSdkLaneV1(input: {
  client: FlowDeskManagedDispatchBetaOpenCodeClientV1;
  request: FlowDeskInjectedSdkLaneObservationRequestV1;
}): Promise<FlowDeskInjectedSdkLaneObservationResultV1> {
  const base = {
    adapterProfile: "injected_sdk_lane_observation_probe" as const,
    parentSessionRef: refFrom("parent-session", input.request.parentSessionId),
    laneId: input.request.laneId,
    requestedAgentRef: refFrom("agent", input.request.requestedAgent),
    requestedModelRef: refFrom("model", input.request.requestedProviderQualifiedModelId),
    authority: disabledAuthority()
  };
  const children = input.client.session.children;
  if (children === undefined) {
    return {
      ...base,
      status: "observation_unavailable",
      observationAttempted: false,
      missingLabels: ["session_children_api_missing"]
    };
  }
  try {
    const childrenResponse = await children.call(input.client.session, {
      path: { id: input.request.parentSessionId },
      ...(input.request.directory === undefined ? {} : { query: { directory: input.request.directory } })
    });
    const childRecord = arrayData(childrenResponse).map(asRecord).find((record): record is Record<string, unknown> => record !== undefined);
    const childSessionId = typeof childRecord?.id === "string" ? childRecord.id : undefined;
    const childSessionRef = childSessionId === undefined ? undefined : refFrom("child-session", childSessionId);
    const observedAgentRef = typeof childRecord?.agent === "string" ? refFrom("agent", childRecord.agent) : undefined;
    const observedModelRef = modelRef(childRecord?.model);
    let messageRef: string | undefined;
    if (childSessionId !== undefined && input.client.session.messages !== undefined) {
      const messagesResponse = await input.client.session.messages.call(input.client.session, {
        path: { id: childSessionId },
        ...(input.request.directory === undefined ? {} : { query: { directory: input.request.directory } })
      });
      messageRef = firstMessageRef(messagesResponse);
    }
    const missingLabels = [
      childSessionRef === undefined ? "child_session_missing" : undefined,
      observedAgentRef === undefined ? "observed_agent_missing" : undefined,
      observedModelRef === undefined ? "observed_model_missing" : undefined,
      messageRef === undefined ? "message_ref_missing" : undefined,
    ].filter((label): label is string => label !== undefined);
    return {
      ...base,
      status: missingLabels.length === 0 ? "observed" : "partial",
      observationAttempted: true,
      ...(childSessionRef === undefined ? {} : { childSessionRef }),
      ...(messageRef === undefined ? {} : { messageRef }),
      ...(observedAgentRef === undefined ? {} : { observedAgentRef }),
      ...(observedModelRef === undefined ? {} : { observedModelRef }),
      missingLabels
    };
  } catch {
    return {
      ...base,
      status: "observation_failed",
      observationAttempted: true,
      missingLabels: ["session_observation_failed"]
    };
  }
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
  dispatchManifest?: FlowDeskDispatchAttemptManifestV1;
  consumedApproval?: FlowDeskProductionApprovalSourceV1;
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

  if (input.dispatchManifest === undefined || input.consumedApproval === undefined) {
    return blocked(input.boundaryInput, guardDecision, "Dispatch attempt manifest and consumed approval are required before SDK call.");
  }
  const precall = evaluateFlowDeskDispatchAttemptPrecallV1({
    manifest: input.dispatchManifest,
    consumedApproval: input.consumedApproval
  });
  if (!precall.sdk_call_permitted) {
    return blocked(input.boundaryInput, guardDecision, `Dispatch pre-call gate blocked: ${precall.blocked_labels.join(",") || precall.errors.join(",") || "unknown"}.`);
  }

  if (input.boundaryInput.preDispatchAuditRef === undefined || input.boundaryInput.runtimeEchoEvidence?.conformance_ref === undefined) {
    return blocked(input.boundaryInput, guardDecision, "Managed-dispatch promotion requires matching audit and conformance refs before SDK call.");
  }
  const promotion = promoteFlowDeskManagedDispatchBetaAuthorityV1({
    guardDecision,
    precallEvaluation: precall,
    consumedApproval: input.consumedApproval,
    auditRef: input.boundaryInput.preDispatchAuditRef,
    conformanceRef: input.boundaryInput.runtimeEchoEvidence.conformance_ref
  });
  if (!promotion.ok || promotion.managed_dispatch_beta_authority_enabled !== true) {
    return blocked(input.boundaryInput, guardDecision, `Managed-dispatch promotion blocked: ${promotion.errors.join(",") || "unknown"}.`);
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
