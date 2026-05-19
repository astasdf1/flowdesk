import assert from "node:assert/strict";
import test from "node:test";
import type {
  FlowDeskConformanceRuntimeMetadataV1,
  FlowDeskManagedDispatchBetaBindingEvidenceV1,
  FlowDeskManagedDispatchBetaPolicyV1,
  FlowDeskManagedDispatchBetaRuntimeEchoEvidenceV1,
  FlowDeskManagedDispatchBetaTelemetryCorrelationV1,
  FlowDeskProviderHealthSnapshotV1,
  FlowDeskUsageSnapshotV1,
  GuardApprovedDispatchV1,
  ManagedDispatchBetaBoundaryInputV1
} from "@flowdesk/core";
import { FLOWDESK_RELEASE_1_COMMAND_MANIFEST } from "@flowdesk/core";
import { flowdeskPluginScaffold } from "./index.js";
import {
  dispatchManagedDispatchBetaPromptV1,
  type FlowDeskManagedDispatchBetaOpenCodeClientV1,
  type FlowDeskManagedDispatchBetaPromptOptionsV1
} from "./managed-dispatch-adapter.js";
import flowdeskOpenCodeServerPlugin, { flowdeskChatIntakeToolName, flowdeskPreSpikeDoctorToolName } from "./server.js";

const now = "2026-05-17T00:00:00.000Z";

function dispatchableUsage(): FlowDeskUsageSnapshotV1 {
  return {
    schema_version: "flowdesk.usage_snapshot.v1",
    snapshot_id: "usage-123",
    provider_family: "claude",
    model_family: "sonnet-4",
    freshness: "fresh",
    freshness_ttl: 5,
    reset_time: "2026-05-17T01:00:00.000Z",
    reset_bucket: "provider-window-123",
    dispatchability: "dispatchable",
    uncertainty_flags: [],
    source_ref: "usage-source-123"
  };
}

function dispatchableHealth(): FlowDeskProviderHealthSnapshotV1 {
  return {
    schema_version: "flowdesk.provider_health_snapshot.v1",
    snapshot_id: "health-123",
    provider_family: "claude",
    model_family: "sonnet-4",
    observed_at: now,
    freshness: "fresh",
    freshness_ttl: 10,
    source_surface: "provider_smoke_test",
    availability_state: "healthy",
    failure_class: "none",
    telemetry_ref: "telemetry-123",
    dispatchability: "dispatchable",
    source_ref: "health-source-123",
    safe_remediation: "No action needed."
  };
}

function managedDispatchBetaPolicy(): FlowDeskManagedDispatchBetaPolicyV1 {
  return {
    release_mode: "managed_dispatch_beta",
    policy_mode: "managed_dispatch_beta",
    config_hash: "config-hash-123",
    policy_pack_hashes: ["policy-hash-123"],
    fallback_reselection_mode: "disabled",
    hard_chat_authority: "disabled",
    require_quarantine_on_ambiguity: true,
    audit_ref: "audit-123"
  };
}

function guardApproval(overrides: Partial<GuardApprovedDispatchV1> = {}): GuardApprovedDispatchV1 {
  return {
    schema_version: "flowdesk.guard_approved_dispatch.v1",
    guard_decision_id: "guard-decision-123",
    workflow_id: "workflow-123",
    step_id: "step-123",
    attempt_id: "attempt-123",
    provider_family: "claude",
    provider_qualified_model_id: "claude/sonnet-4",
    usage_snapshot_ref: "usage-123",
    provider_health_snapshot_ref: "health-123",
    runtime_capability_ref: "runtime-123",
    pre_dispatch_audit_ref: "audit-123",
    expires_at: "2026-05-17T00:10:00.000Z",
    ...overrides
  };
}

function bindingEvidence(overrides: Partial<FlowDeskManagedDispatchBetaBindingEvidenceV1> = {}): FlowDeskManagedDispatchBetaBindingEvidenceV1 {
  return {
    schema_version: "flowdesk.managed_dispatch_beta.binding_evidence.v1",
    binding_ref: "binding-123",
    workflow_id: "workflow-123",
    step_id: "step-123",
    attempt_id: "attempt-123",
    provider_family: "claude",
    provider_qualified_model_id: "claude/sonnet-4",
    source: "guard_approved_dispatch",
    trusted: true,
    created_at: now,
    expires_at: "2026-05-17T00:10:00.000Z",
    ...overrides
  };
}

function conformanceMetadata(overrides: Partial<FlowDeskConformanceRuntimeMetadataV1> = {}): FlowDeskConformanceRuntimeMetadataV1 {
  return {
    schema_version: "flowdesk.conformance_runtime_metadata.v1",
    opencode_version: "1.14.40",
    checked_at: now,
    plugin_package: "@flowdesk/opencode-plugin",
    plugin_version_or_commit: "plugin-commit-123",
    chat_intake_mode: "blocking",
    command_alias_mode: "portable_only",
    dispatch_mode: "real-opencode-dispatch",
    runtime_echo_mode: "trusted",
    event_telemetry_mode: "sufficient",
    provider_health_mode: "dispatch_gate_ready",
    fallback_reselection_mode: "disabled",
    diagnostics_surface_mode: "doctor_usage_status_debug",
    lane_observability_mode: "openable_refs",
    hook_harness_mode: "enforce",
    tui_mode: "unsupported",
    mode_fields: ["PluginInput.client", "session.safe_metadata"],
    evidence_refs: ["conformance-evidence-123"],
    disabled_modes: ["managed_fallback", "hard_chat_blocking"],
    ...overrides
  };
}

function runtimeEchoEvidence(overrides: Partial<FlowDeskManagedDispatchBetaRuntimeEchoEvidenceV1> = {}): FlowDeskManagedDispatchBetaRuntimeEchoEvidenceV1 {
  return {
    schema_version: "flowdesk.managed_dispatch_beta.runtime_echo_evidence.v1",
    runtime_echo_ref: "runtime-echo-123",
    workflow_id: "workflow-123",
    step_id: "step-123",
    attempt_id: "attempt-123",
    provider_family: "claude",
    provider_qualified_model_id: "claude/sonnet-4",
    runtime_capability_ref: "runtime-123",
    conformance_ref: "conformance-123",
    runtime_echo_mode: "trusted",
    trusted: true,
    observed_at: now,
    expires_at: "2026-05-17T00:10:00.000Z",
    ...overrides
  };
}

function telemetryCorrelation(overrides: Partial<FlowDeskManagedDispatchBetaTelemetryCorrelationV1> = {}): FlowDeskManagedDispatchBetaTelemetryCorrelationV1 {
  return {
    schema_version: "flowdesk.managed_dispatch_beta.telemetry_correlation.v1",
    telemetry_ref: "telemetry-123",
    workflow_id: "workflow-123",
    step_id: "step-123",
    attempt_id: "attempt-123",
    event_telemetry_mode: "sufficient",
    correlation_count: 2,
    ambiguous: false,
    source_refs: ["telemetry-source-123"],
    ...overrides
  };
}

function managedDispatchInput(overrides: Partial<ManagedDispatchBetaBoundaryInputV1> = {}): ManagedDispatchBetaBoundaryInputV1 {
  return {
    configHash: "config-hash-123",
    policyPackHashes: ["policy-hash-123"],
    workflowId: "workflow-123",
    stepId: "step-123",
    attemptId: "attempt-123",
    betaPolicy: managedDispatchBetaPolicy(),
    guardApproval: guardApproval(),
    bindingEvidence: bindingEvidence(),
    usageSnapshot: dispatchableUsage(),
    providerHealthSnapshot: dispatchableHealth(),
    runtimeEchoEvidence: runtimeEchoEvidence(),
    conformanceRuntimeMetadata: conformanceMetadata(),
    telemetryCorrelation: telemetryCorrelation(),
    preDispatchAuditRef: "audit-123",
    configuredVerificationRef: "verification-123",
    fallbackOrReselectionAllowed: false,
    hardChatAuthorityAllowed: false,
    ambiguityQuarantined: true,
    now: Date.parse(now),
    ...overrides
  };
}

function dispatchRequest(overrides: Partial<Parameters<typeof dispatchManagedDispatchBetaPromptV1>[0]["request"]> = {}): Parameters<typeof dispatchManagedDispatchBetaPromptV1>[0]["request"] {
  return {
    sessionId: "session-123",
    agent: "build",
    provider_qualified_model_id: "claude/sonnet-4",
    promptText: "Implement the approved bounded FlowDesk step.",
    directory: "/tmp/flowdesk-project",
    ...overrides
  };
}

function fakeClient() {
  const promptCalls: FlowDeskManagedDispatchBetaPromptOptionsV1[] = [];
  const promptAsyncCalls: FlowDeskManagedDispatchBetaPromptOptionsV1[] = [];
  const client: FlowDeskManagedDispatchBetaOpenCodeClientV1 = {
    session: {
      prompt(options) {
        promptCalls.push(options);
        return Promise.resolve({ info: { id: "message-123" }, parts: [] });
      },
      promptAsync(options) {
        promptAsyncCalls.push(options);
        return Promise.resolve(undefined);
      }
    }
  };
  return { client, promptCalls, promptAsyncCalls };
}

test("managed dispatch beta adapter blocks missing gates before fake client calls", async () => {
  const { client, promptCalls, promptAsyncCalls } = fakeClient();
  const result = await dispatchManagedDispatchBetaPromptV1({
    client,
    boundaryInput: managedDispatchInput({ guardApproval: undefined }),
    request: dispatchRequest()
  });

  assert.equal(result.status, "blocked_before_dispatch");
  assert.equal(result.dispatchAttempted, false);
  assert.equal(result.guardDecision.status, "blocked");
  assert.equal(result.authority.realOpenCodeDispatch, false);
  assert.equal(result.authority.providerCall, false);
  assert.equal(result.authority.runtimeExecution, false);
  assert.equal(result.authority.actualLaneLaunch, false);
  assert.equal(result.verification.defaultRelease1ServerBehaviorUnchanged, true);
  assert.equal(promptCalls.length, 0);
  assert.equal(promptAsyncCalls.length, 0);
});

test("managed dispatch beta adapter calls promptAsync once with approved model agent session and text", async () => {
  const { client, promptCalls, promptAsyncCalls } = fakeClient();
  const result = await dispatchManagedDispatchBetaPromptV1({
    client,
    boundaryInput: managedDispatchInput(),
    request: dispatchRequest()
  });

  assert.equal(result.status, "dispatch_accepted");
  assert.equal(result.dispatchAttempted, true);
  assert.equal(result.dispatchMethod, "promptAsync");
  assert.deepEqual(result.model, { providerID: "claude", modelID: "sonnet-4" });
  assert.equal(result.authority.realOpenCodeDispatch, true);
  assert.equal(result.authority.providerCall, true);
  assert.equal(result.authority.actualLaneLaunch, false);
  assert.equal(result.authority.fallbackAuthority, false);
  assert.equal(result.authority.toolAuthority, false);
  assert.equal(result.authority.hardCancelOrNoReplyAuthority, false);
  assert.equal(promptCalls.length, 0);
  assert.equal(promptAsyncCalls.length, 1);
  assert.deepEqual(promptAsyncCalls[0], {
    path: { id: "session-123" },
    query: { directory: "/tmp/flowdesk-project" },
    body: {
      model: { providerID: "claude", modelID: "sonnet-4" },
      agent: "build",
      parts: [{ type: "text", text: "Implement the approved bounded FlowDesk step." }]
    }
  });
  assert.equal(/noReply|cancel|fallback|tools/.test(JSON.stringify(promptAsyncCalls[0])), false);
});

test("managed dispatch beta adapter can call prompt once for completed dispatch without noReply or tools", async () => {
  const { client, promptCalls, promptAsyncCalls } = fakeClient();
  const result = await dispatchManagedDispatchBetaPromptV1({
    client,
    boundaryInput: managedDispatchInput(),
    request: dispatchRequest({ dispatchMethod: "prompt", promptText: undefined, promptSummary: "Summarized approved prompt." })
  });

  assert.equal(result.status, "dispatch_completed");
  assert.equal(promptCalls.length, 1);
  assert.equal(promptAsyncCalls.length, 0);
  assert.equal(promptCalls[0].body.parts[0]?.text, "Summarized approved prompt.");
  assert.deepEqual(promptCalls[0].body.model, { providerID: "claude", modelID: "sonnet-4" });
  assert.equal(/noReply|cancel|fallback|tools/.test(JSON.stringify(promptCalls[0])), false);
});

test("managed dispatch beta adapter blocks request model mismatch before fake client calls", async () => {
  const { client, promptCalls, promptAsyncCalls } = fakeClient();
  const result = await dispatchManagedDispatchBetaPromptV1({
    client,
    boundaryInput: managedDispatchInput(),
    request: dispatchRequest({ provider_qualified_model_id: "openai/gpt-5" })
  });

  assert.equal(result.status, "blocked_before_dispatch");
  assert.equal(result.dispatchAttempted, false);
  assert.match(result.redactedBlockReason, /model must exactly match/);
  assert.equal(promptCalls.length, 0);
  assert.equal(promptAsyncCalls.length, 0);
});

test("default server and plugin scaffold remain Release 1 non-dispatch", async () => {
  assert.equal(flowdeskPluginScaffold.productionToolRegistration, "release1-non-dispatch-command-backed");
  assert.equal(flowdeskPluginScaffold.runtimeBoundary.realOpenCodeDispatch, "disabled");

  const hooks = await flowdeskOpenCodeServerPlugin.server(undefined as never);
  assert.deepEqual(Object.keys(hooks.tool ?? {}), [flowdeskPreSpikeDoctorToolName, ...FLOWDESK_RELEASE_1_COMMAND_MANIFEST.map((entry) => entry.toolName), flowdeskChatIntakeToolName]);
  assert.equal(Object.keys(hooks.tool ?? {}).some((name) => /managed.*dispatch|dispatch.*beta/i.test(name)), false);

  const doctor = hooks.tool?.[flowdeskPreSpikeDoctorToolName];
  assert.ok(doctor);
  const result = JSON.parse(await doctor.execute({}, undefined as never)) as Record<string, unknown>;
  assert.equal(result.productionToolRegistration, "release1-non-dispatch-command-backed");
  assert.equal(result.realOpenCodeDispatch, "disabled");
  assert.equal(result.providerCall, false);
  assert.equal(result.runtimeExecution, false);
  assert.equal(result.actualLaneLaunch, false);
  assert.equal(result.fallbackAuthority, false);
  assert.equal(result.hardCancelOrNoReplyAuthority, false);
});
