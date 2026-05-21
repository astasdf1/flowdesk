import assert from "node:assert/strict";
import test from "node:test";
import {
	consumeFlowDeskProductionApprovalSourceV1,
	FLOWDESK_RELEASE_1_COMMAND_MANIFEST,
	type FlowDeskConformanceRuntimeMetadataV1,
	type FlowDeskDispatchAttemptManifestV1,
	type FlowDeskManagedDispatchBetaBindingEvidenceV1,
	type FlowDeskManagedDispatchBetaPolicyV1,
	type FlowDeskManagedDispatchBetaRuntimeEchoEvidenceV1,
	type FlowDeskManagedDispatchBetaTelemetryCorrelationV1,
	type FlowDeskManagedDispatchBetaUsageAuthorityEvidenceV1,
	type FlowDeskProductionApprovalSourceV1,
	type FlowDeskProviderHealthSnapshotV1,
	type FlowDeskSessionEvidenceReloadResultV1,
	type FlowDeskUsageSnapshotV1,
	type GuardApprovedDispatchV1,
	type ManagedDispatchBetaBoundaryInputV1,
} from "@flowdesk/core";
import { flowdeskPluginScaffold } from "./index.js";
import {
	dispatchManagedDispatchBetaPromptV1,
	type FlowDeskManagedDispatchBetaOpenCodeClientV1,
	type FlowDeskManagedDispatchBetaPromptOptionsV1,
	observeInjectedSdkLaneV1,
} from "./managed-dispatch-adapter.js";
import flowdeskOpenCodeServerPlugin, {
	flowdeskChatIntakeToolName,
	flowdeskManagedDispatchBetaAdapterOption,
	flowdeskManagedDispatchBetaToolName,
	flowdeskPreSpikeDoctorToolName,
} from "./server.js";

function toolOutput(value: string | { output: string }): string {
	return typeof value === "string" ? value : value.output;
}

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
		source_ref: "usage-source-123",
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
		safe_remediation: "No action needed.",
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
		audit_ref: "audit-123",
	};
}

function guardApproval(
	overrides: Partial<GuardApprovedDispatchV1> = {},
): GuardApprovedDispatchV1 {
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
		...overrides,
	};
}

function bindingEvidence(
	overrides: Partial<FlowDeskManagedDispatchBetaBindingEvidenceV1> = {},
): FlowDeskManagedDispatchBetaBindingEvidenceV1 {
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
		...overrides,
	};
}

function conformanceMetadata(
	overrides: Partial<FlowDeskConformanceRuntimeMetadataV1> = {},
): FlowDeskConformanceRuntimeMetadataV1 {
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
		...overrides,
	};
}

function runtimeEchoEvidence(
	overrides: Partial<FlowDeskManagedDispatchBetaRuntimeEchoEvidenceV1> = {},
): FlowDeskManagedDispatchBetaRuntimeEchoEvidenceV1 {
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
		...overrides,
	};
}

function telemetryCorrelation(
	overrides: Partial<FlowDeskManagedDispatchBetaTelemetryCorrelationV1> = {},
): FlowDeskManagedDispatchBetaTelemetryCorrelationV1 {
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
		...overrides,
	};
}

function usageAuthorityEvidence(
	overrides: Partial<FlowDeskManagedDispatchBetaUsageAuthorityEvidenceV1> = {},
): FlowDeskManagedDispatchBetaUsageAuthorityEvidenceV1 {
	return {
		schema_version:
			"flowdesk.managed_dispatch_beta.usage_authority_evidence.v1",
		authority_ref: "usage-authority-123",
		usage_snapshot_ref: "usage-123",
		provider_family: "claude",
		provider_qualified_model_id: "claude/sonnet-4",
		model_family: "sonnet-4",
		source_kind: "openusage",
		source_version_ref: "openusage-version-123",
		auth_profile_ref: "auth-profile-123",
		auth_evidence_ref: "auth-evidence-123",
		credential_scope_ref: "principal-scope-123",
		account_boundary_ref: "account-boundary-123",
		quota_evidence_ref: "quota-evidence-123",
		usage_acquired: true,
		reset_time: "2026-05-17T01:00:00.000Z",
		reset_bucket: "provider-window-123",
		source_ref: "usage-source-123",
		conformance_ref: "usage-conformance-123",
		redacted_evidence_refs: ["usage-evidence-123"],
		trusted: true,
		observed_at: now,
		expires_at: "2026-05-17T00:10:00.000Z",
		...overrides,
	};
}

function managedDispatchInput(
	overrides: Partial<ManagedDispatchBetaBoundaryInputV1> = {},
): ManagedDispatchBetaBoundaryInputV1 {
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
		usageAuthorityEvidence: usageAuthorityEvidence(),
		expectedAuthProfileRef: "auth-profile-123",
		expectedCredentialScopeRef: "principal-scope-123",
		expectedAccountBoundaryRef: "account-boundary-123",
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
		...overrides,
	};
}

function dispatchRequest(
	overrides: Partial<
		Parameters<typeof dispatchManagedDispatchBetaPromptV1>[0]["request"]
	> = {},
): Parameters<typeof dispatchManagedDispatchBetaPromptV1>[0]["request"] {
	return {
		sessionId: "session-123",
		agent: "build",
		provider_qualified_model_id: "claude/sonnet-4",
		promptText: "Implement the approved bounded FlowDesk step.",
		directory: "/tmp/flowdesk-project",
		...overrides,
	};
}

function approvalSource(
	overrides: Partial<FlowDeskProductionApprovalSourceV1> = {},
): FlowDeskProductionApprovalSourceV1 {
	return {
		schema_version: "flowdesk.production_approval_source.v1",
		approval_id: "approval-123",
		workflow_id: "workflow-123",
		attempt_id: "attempt-123",
		action_type: "managed_dispatch_beta",
		issuer_boundary: "external_user_confirmation",
		approval_method: "typed_phrase",
		actor_ref: "actor-user-123",
		profile_ref: "profile-prod-123",
		provider_qualified_model_id: "claude/sonnet-4",
		provider_binding_hash: "hash-provider-binding-123",
		evidence_bundle_hash: "hash-evidence-bundle-123",
		guard_decision_ref: "guard-decision-123",
		issuance_audit_ref: "audit-issuance-123",
		nonce_ref: "nonce-123",
		issued_at: now,
		expires_at: "2026-05-17T00:10:00.000Z",
		revoked: false,
		consume_strategy: "atomic_compare_and_swap_required",
		dispatch_authority_enabled: false,
		...overrides,
	};
}

function consumedApproval(
	overrides: Partial<FlowDeskProductionApprovalSourceV1> = {},
): FlowDeskProductionApprovalSourceV1 {
	const source = approvalSource(overrides);
	const result = consumeFlowDeskProductionApprovalSourceV1({
		approval: source,
		workflowId: "workflow-123",
		attemptId: "attempt-123",
		actionType: source.action_type,
		actorRef: "actor-user-123",
		profileRef: "profile-prod-123",
		providerQualifiedModelId: "claude/sonnet-4",
		providerBindingHash: "hash-provider-binding-123",
		evidenceBundleHash: "hash-evidence-bundle-123",
		guardDecisionRef: "guard-decision-123",
		consumptionAuditRef: "audit-consumption-123",
		consumedAt: "2026-05-17T00:05:00.000Z",
	});
	assert.ok(result.consumed_approval);
	return result.consumed_approval;
}

function dispatchManifest(
	overrides: Partial<FlowDeskDispatchAttemptManifestV1> = {},
): FlowDeskDispatchAttemptManifestV1 {
	return {
		schema_version: "flowdesk.dispatch_attempt_manifest.v1",
		workflow_id: "workflow-123",
		attempt_id: "attempt-123",
		state: "approval_consumed",
		actor_ref: "actor-user-123",
		profile_ref: "profile-prod-123",
		provider_qualified_model_id: "claude/sonnet-4",
		provider_binding_hash: "hash-provider-binding-123",
		evidence_bundle_hash: "hash-evidence-bundle-123",
		evidence_refs: ["usage-authority-123", "runtime-echo-123", "telemetry-123"],
		approval_ref: "approval-123",
		consumed_approval_ref: "approval-123",
		guard_decision_ref: "guard-decision-123",
		pre_dispatch_audit_ref: "audit-123",
		pre_dispatch_audit_committed: true,
		idempotency_key: "idempotency-123",
		created_at: now,
		updated_at: "2026-05-17T00:05:00.000Z",
		dispatch_authority_enabled: false,
		realOpenCodeDispatch: false,
		actualLaneLaunch: false,
		providerCall: false,
		runtimeExecution: false,
		...overrides,
	};
}

function reloadedEvidence(
	overrides: Partial<FlowDeskSessionEvidenceReloadResultV1> = {},
): FlowDeskSessionEvidenceReloadResultV1 {
	return {
		ok: true,
		errors: [],
		entries: [
			{
				evidenceClass: "dispatch_idempotency",
				evidenceId: "idempotency-snapshot-123",
				record: {
					schema_version: "flowdesk.dispatch_idempotency_snapshot.v1",
					workflow_id: "workflow-123",
					snapshot_ref: "idempotency-snapshot-123",
					observed_at: now,
					entries: [],
					dispatch_authority_enabled: false,
					realOpenCodeDispatch: false,
					actualLaneLaunch: false,
					providerCall: false,
					runtimeExecution: false,
				},
				path: ".flowdesk/sessions/workflow-123/evidence/dispatch-idempotency/idempotency-snapshot-123.json",
			},
			{
				evidenceClass: "production_approval_source",
				evidenceId: "approval-source-123",
				record: consumedApproval() as unknown as Record<string, unknown>,
				path: ".flowdesk/sessions/workflow-123/evidence/production-approval-source/approval-source-123.json",
			},
			{
				evidenceClass: "pre_dispatch_audit",
				evidenceId: "audit-123",
				record: {
					schema_version: "flowdesk.pre_dispatch_audit_record.v1",
					workflow_id: "workflow-123",
					pre_dispatch_audit_ref: "audit-123",
				},
				path: ".flowdesk/sessions/workflow-123/evidence/pre-dispatch-audit/audit-123.json",
			},
		],
		blocked: [],
		realOpenCodeDispatch: false,
		actualLaneLaunch: false,
		providerCall: false,
		runtimeExecution: false,
		...overrides,
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
			},
		},
	};
	return { client, promptCalls, promptAsyncCalls };
}

function observingClient(
	childrenResponse: unknown,
	messagesResponse: unknown = [],
) {
	const childrenCalls: unknown[] = [];
	const messageCalls: unknown[] = [];
	const client: FlowDeskManagedDispatchBetaOpenCodeClientV1 = {
		session: {
			children(options) {
				childrenCalls.push(options);
				return Promise.resolve(childrenResponse);
			},
			messages(options) {
				messageCalls.push(options);
				return Promise.resolve(messagesResponse);
			},
		},
	};
	return { client, childrenCalls, messageCalls };
}

test("managed dispatch beta adapter blocks missing gates before fake client calls", async () => {
	const { client, promptCalls, promptAsyncCalls } = fakeClient();
	const result = await dispatchManagedDispatchBetaPromptV1({
		client,
		boundaryInput: managedDispatchInput({ guardApproval: undefined }),
		request: dispatchRequest(),
	});

	assert.equal(result.status, "blocked_before_dispatch");
	assert.equal(result.dispatchAttempted, false);
	assert.equal(result.guardDecision.status, "blocked");
	assert.equal(result.authority.realOpenCodeDispatch, false);
	assert.equal(result.authority.providerCall, false);
	assert.equal(result.authority.runtimeExecution, false);
	assert.equal(result.authority.actualLaneLaunch, false);
	assert.equal(
		result.verification.defaultRelease1ServerBehaviorUnchanged,
		true,
	);
	assert.equal(promptCalls.length, 0);
	assert.equal(promptAsyncCalls.length, 0);
});

test("injected sdk lane observation reads child session refs without dispatch authority", async () => {
	const { client, childrenCalls, messageCalls } = observingClient(
		[
			{
				id: "child-session-123",
				parentID: "session-123",
				agent: "reviewer",
				model: { providerID: "claude", id: "sonnet-4" },
			},
		],
		[{ info: { id: "message-123" }, parts: [] }],
	);
	const result = await observeInjectedSdkLaneV1({
		client,
		request: {
			parentSessionId: "session-123",
			laneId: "lane-123",
			requestedAgent: "reviewer",
			requestedProviderQualifiedModelId: "claude/sonnet-4",
			directory: "/tmp/flowdesk-project",
		},
	});

	assert.equal(result.status, "observed");
	assert.equal(result.observationAttempted, true);
	assert.equal(result.childSessionRef, "child-session-child-session-123");
	assert.equal(result.messageRef, "message-message-123");
	assert.equal(result.observedAgentRef, "agent-reviewer");
	assert.equal(result.observedModelRef, "model-claude-sonnet-4");
	assert.equal(result.authority.realOpenCodeDispatch, false);
	assert.equal(result.authority.providerCall, false);
	assert.equal(result.authority.runtimeExecution, false);
	assert.equal(result.authority.actualLaneLaunch, false);
	assert.equal(childrenCalls.length, 1);
	assert.equal(messageCalls.length, 1);
});

test("injected sdk lane observation degrades when child data or APIs are missing", async () => {
	const unavailable = await observeInjectedSdkLaneV1({
		client: { session: {} },
		request: {
			parentSessionId: "session-123",
			laneId: "lane-123",
			requestedAgent: "reviewer",
			requestedProviderQualifiedModelId: "claude/sonnet-4",
		},
	});
	assert.equal(unavailable.status, "observation_unavailable");
	assert.equal(unavailable.observationAttempted, false);
	assert.deepEqual(unavailable.missingLabels, ["session_children_api_missing"]);

	const { client } = observingClient([]);
	const partial = await observeInjectedSdkLaneV1({
		client,
		request: {
			parentSessionId: "session-123",
			laneId: "lane-123",
			requestedAgent: "reviewer",
			requestedProviderQualifiedModelId: "claude/sonnet-4",
		},
	});
	assert.equal(partial.status, "partial");
	assert.ok(partial.missingLabels.includes("child_session_missing"));
	assert.equal(partial.authority.hardCancelOrNoReplyAuthority, false);
});

test("managed dispatch beta adapter calls promptAsync once with approved model agent session and text", async () => {
	const { client, promptCalls, promptAsyncCalls } = fakeClient();
	const result = await dispatchManagedDispatchBetaPromptV1({
		client,
		boundaryInput: managedDispatchInput(),
		request: dispatchRequest(),
		dispatchManifest: dispatchManifest(),
		reloadedEvidence: reloadedEvidence(),
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
			parts: [
				{ type: "text", text: "Implement the approved bounded FlowDesk step." },
			],
		},
	});
	assert.equal(
		/noReply|cancel|fallback|tools/.test(JSON.stringify(promptAsyncCalls[0])),
		false,
	);
});

test("managed dispatch beta adapter can call prompt once for completed dispatch without noReply or tools", async () => {
	const { client, promptCalls, promptAsyncCalls } = fakeClient();
	const result = await dispatchManagedDispatchBetaPromptV1({
		client,
		boundaryInput: managedDispatchInput(),
		request: dispatchRequest({
			dispatchMethod: "prompt",
			promptText: undefined,
			promptSummary: "Summarized approved prompt.",
		}),
		dispatchManifest: dispatchManifest(),
		reloadedEvidence: reloadedEvidence(),
	});

	assert.equal(result.status, "dispatch_completed");
	assert.equal(promptCalls.length, 1);
	assert.equal(promptAsyncCalls.length, 0);
	assert.equal(
		promptCalls[0].body.parts[0]?.text,
		"Summarized approved prompt.",
	);
	assert.deepEqual(promptCalls[0].body.model, {
		providerID: "claude",
		modelID: "sonnet-4",
	});
	assert.equal(
		/noReply|cancel|fallback|tools/.test(JSON.stringify(promptCalls[0])),
		false,
	);
});

test("managed dispatch beta adapter requires manifest and durable evidence before fake client calls", async () => {
	const { client, promptCalls, promptAsyncCalls } = fakeClient();
	const missing = await dispatchManagedDispatchBetaPromptV1({
		client,
		boundaryInput: managedDispatchInput(),
		request: dispatchRequest(),
	});
	assert.equal(missing.status, "blocked_before_dispatch");
	assert.match(missing.redactedBlockReason, /manifest and durable evidence reload/);
	assert.equal(promptCalls.length, 0);
	assert.equal(promptAsyncCalls.length, 0);

	const badManifest = await dispatchManagedDispatchBetaPromptV1({
		client,
		boundaryInput: managedDispatchInput(),
		request: dispatchRequest(),
		dispatchManifest: dispatchManifest({ pre_dispatch_audit_committed: false }),
		reloadedEvidence: reloadedEvidence(),
	});
	assert.equal(badManifest.status, "blocked_before_dispatch");
	assert.match(badManifest.redactedBlockReason, /pre-call gate blocked/);
	assert.equal(promptCalls.length, 0);
	assert.equal(promptAsyncCalls.length, 0);
});

test("managed dispatch beta adapter requires promotion gate before fake client calls", async () => {
	const wrongActionClient = fakeClient();
	const wrongAction = await dispatchManagedDispatchBetaPromptV1({
		client: wrongActionClient.client,
		boundaryInput: managedDispatchInput(),
		request: dispatchRequest(),
		dispatchManifest: dispatchManifest(),
			reloadedEvidence: reloadedEvidence({
			entries: [
				{
					evidenceClass: "dispatch_idempotency",
					evidenceId: "idempotency-snapshot-123",
					record: {
						schema_version: "flowdesk.dispatch_idempotency_snapshot.v1",
						workflow_id: "workflow-123",
						snapshot_ref: "idempotency-snapshot-123",
						observed_at: now,
						entries: [],
						dispatch_authority_enabled: false,
						realOpenCodeDispatch: false,
						actualLaneLaunch: false,
						providerCall: false,
						runtimeExecution: false,
					},
					path: ".flowdesk/sessions/workflow-123/evidence/dispatch-idempotency/idempotency-snapshot-123.json",
				},
				{
					evidenceClass: "production_approval_source",
					evidenceId: "approval-source-123",
					record: consumedApproval({ action_type: "reviewer_fanout" }) as unknown as Record<string, unknown>,
					path: ".flowdesk/sessions/workflow-123/evidence/production-approval-source/approval-source-123.json",
				},
				{
					evidenceClass: "pre_dispatch_audit",
					evidenceId: "audit-123",
					record: {
						schema_version: "flowdesk.pre_dispatch_audit_record.v1",
						workflow_id: "workflow-123",
						pre_dispatch_audit_ref: "audit-123",
					},
					path: ".flowdesk/sessions/workflow-123/evidence/pre-dispatch-audit/audit-123.json",
				},
			],
		}),
	});
	assert.equal(wrongAction.status, "blocked_before_dispatch");
	assert.match(
		wrongAction.redactedBlockReason,
		/promotion blocked|action_type mismatch/,
	);
	assert.equal(wrongActionClient.promptCalls.length, 0);
	assert.equal(wrongActionClient.promptAsyncCalls.length, 0);

	const auditMismatchClient = fakeClient();
	const auditMismatch = await dispatchManagedDispatchBetaPromptV1({
		client: auditMismatchClient.client,
		boundaryInput: managedDispatchInput({ preDispatchAuditRef: "audit-other" }),
		request: dispatchRequest(),
		dispatchManifest: dispatchManifest(),
		reloadedEvidence: reloadedEvidence(),
	});
	assert.equal(auditMismatch.status, "blocked_before_dispatch");
	assert.match(
		auditMismatch.redactedBlockReason,
		/GuardApprovedDispatch|promotion|audit/,
	);
	assert.equal(auditMismatchClient.promptCalls.length, 0);
	assert.equal(auditMismatchClient.promptAsyncCalls.length, 0);
});

test("managed dispatch beta adapter blocks request model mismatch before fake client calls", async () => {
	const { client, promptCalls, promptAsyncCalls } = fakeClient();
	const result = await dispatchManagedDispatchBetaPromptV1({
		client,
		boundaryInput: managedDispatchInput(),
		request: dispatchRequest({ provider_qualified_model_id: "openai/gpt-5" }),
	});

	assert.equal(result.status, "blocked_before_dispatch");
	assert.equal(result.dispatchAttempted, false);
	assert.match(result.redactedBlockReason, /model must exactly match/);
	assert.equal(promptCalls.length, 0);
	assert.equal(promptAsyncCalls.length, 0);
});

test("managed dispatch beta adapter blocks unpinned usage authority before fake client calls", async () => {
	const { client, promptCalls, promptAsyncCalls } = fakeClient();
	const result = await dispatchManagedDispatchBetaPromptV1({
		client,
		boundaryInput: managedDispatchInput({
			usageAuthorityEvidence: usageAuthorityEvidence({
				source_ref: "usage-source-other",
			}),
		}),
		request: dispatchRequest(),
	});

	assert.equal(result.status, "blocked_before_dispatch");
	assert.equal(result.dispatchAttempted, false);
	assert.equal(result.guardDecision.status, "blocked");
	assert.equal(promptCalls.length, 0);
	assert.equal(promptAsyncCalls.length, 0);
});

test("default server and plugin scaffold remain Release 1 non-dispatch", async () => {
	assert.equal(
		flowdeskPluginScaffold.productionToolRegistration,
		"release1-non-dispatch-command-backed",
	);
	assert.equal(
		flowdeskPluginScaffold.runtimeBoundary.realOpenCodeDispatch,
		"disabled",
	);

	const hooks = await flowdeskOpenCodeServerPlugin.server(undefined as never);
	assert.deepEqual(Object.keys(hooks.tool ?? {}), [
		flowdeskPreSpikeDoctorToolName,
		...FLOWDESK_RELEASE_1_COMMAND_MANIFEST.map((entry) => entry.toolName),
		flowdeskChatIntakeToolName,
	]);
	assert.equal(
		Object.keys(hooks.tool ?? {}).some((name) =>
			/managed.*dispatch|dispatch.*beta/i.test(name),
		),
		false,
	);

	const doctor = hooks.tool?.[flowdeskPreSpikeDoctorToolName];
	assert.ok(doctor);
	const result = JSON.parse(
		toolOutput(await doctor.execute({}, undefined as never)),
	) as Record<string, unknown>;
	assert.equal(
		result.productionToolRegistration,
		"release1-non-dispatch-command-backed",
	);
	assert.equal(result.realOpenCodeDispatch, "disabled");
	assert.equal(result.providerCall, false);
	assert.equal(result.runtimeExecution, false);
	assert.equal(result.actualLaneLaunch, false);
	assert.equal(result.fallbackAuthority, false);
	assert.equal(result.hardCancelOrNoReplyAuthority, false);
});

test("managed dispatch beta server tool is explicit opt-in and redacts SDK response", async () => {
	const { client, promptAsyncCalls } = fakeClient();
	const defaultHooks = await flowdeskOpenCodeServerPlugin.server({
		client,
	} as never);
	assert.equal(
		Object.keys(defaultHooks.tool ?? {}).includes(
			flowdeskManagedDispatchBetaToolName,
		),
		false,
	);

	const hooks = await flowdeskOpenCodeServerPlugin.server({ client } as never, {
		[flowdeskManagedDispatchBetaAdapterOption]: true,
		localNonDispatchAdapter: false,
		naturalLanguageRouting: false,
	});
	const betaTool = hooks.tool?.[flowdeskManagedDispatchBetaToolName];
	assert.ok(betaTool);

	const raw = await betaTool.execute(
		{
			boundaryInput: managedDispatchInput(),
			request: dispatchRequest(),
			dispatchManifest: dispatchManifest(),
			reloadedEvidence: reloadedEvidence(),
		},
		undefined as never,
	);
	const result = JSON.parse(toolOutput(raw)) as Record<string, unknown>;
	assert.equal(result.status, "dispatch_accepted");
	assert.equal(result.dispatchAttempted, true);
	assert.equal(result.responseObserved, false);
	assert.equal("response" in result, false);
	assert.equal(promptAsyncCalls.length, 1);
});
