import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import {
	mkdirSync,
	mkdtempSync,
	readFileSync,
	rmSync,
	writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import {
	applyFlowDeskSessionEvidenceWriteIntentsV1,
	consumeFlowDeskProductionApprovalSourceV1,
	createFlowDeskConfiguredVerificationResultV1,
	createFlowDeskExternalAuthProviderPolicyResultV1,
	createFlowDeskProductionApprovalDecisionV1,
	createFlowDeskSanitizedAuthCaptureResultV1,
	FLOWDESK_RELEASE_1_COMMAND_MANIFEST,
	type FlowDeskConformanceRuntimeMetadataV1,
	type FlowDeskControlledExternalWriteRequestV1,
	type FlowDeskDispatchAttemptManifestV1,
	type FlowDeskDispatchIdempotencySnapshotV1,
	type FlowDeskFallbackDecisionV1,
	type FlowDeskManagedDispatchBetaBindingEvidenceV1,
	type FlowDeskManagedDispatchBetaPolicyV1,
	type FlowDeskManagedDispatchBetaRuntimeEchoEvidenceV1,
	type FlowDeskManagedDispatchBetaTelemetryCorrelationV1,
	type FlowDeskManagedDispatchBetaUsageAuthorityEvidenceV1,
	type FlowDeskPermissionAskDecisionV1,
	type FlowDeskProductionApprovalSourceV1,
	type FlowDeskPromptNoReplyDecisionV1,
	type FlowDeskProviderHealthSnapshotV1,
	type FlowDeskRuntimeLaneLaunchPlanV1,
	type FlowDeskSessionAbortDecisionV1,
	type FlowDeskSessionEvidenceReloadResultV1,
	type FlowDeskTopTierReviewVerdictV1,
	type FlowDeskUsageSnapshotV1,
	type GuardApprovedDispatchV1,
	type ManagedDispatchBetaBoundaryInputV1,
	prepareFlowDeskSessionEvidenceWriteIntentV1,
	reloadFlowDeskSessionEvidenceV1,
} from "@flowdesk/core";
import { flowdeskPluginScaffold } from "./index.js";
import {
	abortFlowDeskSessionWithDecisionV1,
	applyFlowDeskPermissionAskControlV1,
	createFlowDeskManagedDispatchBetaDurableReservationStoreV1,
	dispatchFlowDeskPromptNoReplyWithDecisionV1,
	dispatchManagedDispatchBetaPromptV1,
	observeAndFinalizeManagedDispatchLaneV1,
	type FlowDeskManagedDispatchBetaOpenCodeClientV1,
	type FlowDeskManagedDispatchBetaPromptOptionsV1,
	type FlowDeskManagedDispatchBetaReservationStoreV1,
	launchFlowDeskInjectedSdkRuntimeLaneFromPlanV1,
	materializeFlowDeskControlledConformanceDocLocalWriteV1,
	materializeFlowDeskControlledRedactedAuditExportLocalWriteV1,
	materializeFlowDeskObservedReviewerVerdictEvidenceV1,
	materializeFlowDeskRuntimeLaneCompleteLifecycleEvidenceV1,
	materializeFlowDeskRuntimeLaneLaunchLifecycleEvidenceV1,
	observeInjectedSdkLaneV1,
	observeInjectedSdkReviewerVerdictV1,
	orchestrateFlowDeskManagedFallbackRegateV1,
	prepareFlowDeskControlledExternalWriteAdapterV1,
	prepareFlowDeskDurableReviewerVerdictLinkageAdapterV1,
	prepareFlowDeskFallbackReselectionRegateAdapterV1,
	prepareFlowDeskReviewerTypedVerdictAcceptanceAdapterV1,
} from "./managed-dispatch-adapter.js";
import flowdeskOpenCodeServerPlugin, {
	flowdeskChatIntakeToolName,
	flowdeskDefaultManagedDispatchAuthorizationOption,
	flowdeskDurableStateRootOption,
	flowdeskLocalNonDispatchAdapterOption,
	flowdeskManagedDispatchBetaAdapterOption,
	flowdeskManagedDispatchBetaToolName,
	flowdeskPreSpikeDoctorToolName,
	flowdeskProductionEnablementOption,
} from "./server.js";
import { persistTerminalEvidence } from "./terminal-evidence-writer.js";

function toolOutput(value: string | { output: string }): string {
	return typeof value === "string" ? value : value.output;
}

const now = "2026-05-17T00:00:00.000Z";

function defaultManagedDispatchAuthorization() {
	return {
		schema_version: "flowdesk.default_managed_dispatch_authorization.v1",
		authorization_id: "default-auth-123",
		workflow_id: "workflow-123",
		ok: true,
		errors: [],
		state: "authorized",
		blocked_labels: [],
		readiness_ref: "default-managed-dispatch-default_candidate",
		actor_ref: "actor-ops-123",
		profile_ref: "profile-prod-123",
		release_gate_ref: "release-gate-123",
		rollback_ref: "rollback-123",
		created_at: "2026-05-22T00:00:00.000Z",
		expires_at: "2026-05-23T00:00:00.000Z",
		default_enablement_requested: true,
		kill_switch_state: "inactive",
		default_managed_dispatch_authority_enabled: true,
		dispatch_authority_enabled: false,
		providerCall: false,
		actualLaneLaunch: false,
		runtimeExecution: false,
		safe_next_actions: ["/flowdesk-status"],
	};
}

function sha256Ref(content: string): string {
	return `sha256-${createHash("sha256").update(content, "utf8").digest("hex")}`;
}

async function withTempRoot<T>(
	run: (rootDir: string) => Promise<T> | T,
): Promise<T> {
	const rootDir = mkdtempSync(join(tmpdir(), "flowdesk-reservation-store-"));
	try {
		return await run(rootDir);
	} finally {
		rmSync(rootDir, { recursive: true, force: true });
	}
}

function writeWorkingModels(rootDir: string, ids = ["claude/sonnet-4"]): void {
	mkdirSync(join(rootDir, "model-availability"), { recursive: true });
	writeFileSync(
		join(rootDir, "model-availability", "working-models.json"),
		JSON.stringify({ available_model_ids: ids }),
	);
}

function dispatchIdempotencySnapshots(
	rootDir: string,
): FlowDeskDispatchIdempotencySnapshotV1[] {
	return reloadFlowDeskSessionEvidenceV1({
		workflowId: "workflow-123",
		rootDir,
	})
		.entries.filter((entry) => entry.evidenceClass === "dispatch_idempotency")
		.map(
			(entry) =>
				entry.record as unknown as FlowDeskDispatchIdempotencySnapshotV1,
		);
}

function managedDispatchTerminalEvidencePath(rootDir: string, input: {
	workflowId: string;
	attemptId: string;
	laneId: string;
}): string {
	return join(
		rootDir,
		".flowdesk",
		"sessions",
		input.workflowId,
		"evidence",
		"terminal-lifecycle",
		`terminal-${input.workflowId}-${input.attemptId}-${input.laneId}.json`,
	);
}

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

function typedReviewerVerdict(
	overrides: Record<string, unknown> = {},
): Record<string, unknown> {
	return {
		schema_version: "flowdesk.top_tier_review_verdict.v1",
		verdict_id: "verdict-policy-security",
		workflow_id: "workflow-123",
		lane_plan_ref: "lane-plan-123",
		binding_ref: "binding-reviewer-123",
		perspective: "policy_security",
		source: "claude_opus",
		created_at: now,
		redaction_version: "redaction-v1",
		findings: [],
		evidence_refs: ["lane-evidence-123"],
		uncertainty: "low",
		required_fixes: [],
		verdict_label: "pass",
		safe_next_actions: ["/flowdesk-status"],
		dispatch_authority_enabled: false,
		...overrides,
	};
}

function canonicalReviewerVerdicts() {
	return [
		typedReviewerVerdict({
			verdict_id: "verdict-policy-security",
			perspective: "policy_security",
			evidence_refs: ["lane-evidence-policy-security"],
		}),
		typedReviewerVerdict({
			verdict_id: "verdict-architecture",
			perspective: "architecture",
			evidence_refs: ["lane-evidence-architecture"],
		}),
		typedReviewerVerdict({
			verdict_id: "verdict-verification-implementation",
			perspective: "verification_implementation",
			evidence_refs: ["lane-evidence-verification"],
		}),
	] as ReturnType<typeof typedReviewerVerdict>[];
}

function lifecycleForVerdict(
	verdict: Record<string, unknown>,
	overrides: Record<string, unknown> = {},
): Record<string, unknown> {
	const perspective = String(
		verdict.perspective ?? "policy_security",
	).replaceAll("_", "-");
	return {
		schema_version: "flowdesk.lane_lifecycle_record.v1",
		lane_id: `lane-${perspective}`,
		workflow_id: "workflow-123",
		attempt_id: "attempt-123",
		parent_session_ref: "ses-parent-123",
		child_session_ref: `ses-child-${perspective}`,
		message_ref: `msg-${perspective}`,
		agent_ref: "agent-reviewer",
		provider_qualified_model_id: "claude/claude-opus-4-5",
		state: "complete",
		verdict_ref: String(verdict.verdict_id),
		output_ref: `output-${perspective}`,
		runtime_echo_ref: `runtime-echo-${perspective}`,
		telemetry_ref: `telemetry-${perspective}`,
		timeout_ms: 30000,
		orphan_max_age_ms: 60000,
		retry_count: 0,
		created_at: now,
		updated_at: "2026-05-17T00:01:00.000Z",
		dispatch_authority_enabled: false,
		providerCall: false,
		actualLaneLaunch: false,
		runtimeExecution: false,
		...overrides,
	};
}

function consumedReviewerFanoutApproval(
	overrides: Partial<FlowDeskProductionApprovalSourceV1> = {},
): FlowDeskProductionApprovalSourceV1 {
	const source = approvalSource({
		approval_id: "approval-reviewer-fanout-123",
		action_type: "reviewer_fanout",
		...overrides,
	});
	const result = consumeFlowDeskProductionApprovalSourceV1({
		approval: source,
		workflowId: "workflow-123",
		attemptId: "attempt-123",
		actionType: "reviewer_fanout",
		actorRef: "actor-user-123",
		profileRef: "profile-prod-123",
		providerQualifiedModelId: "claude/sonnet-4",
		providerBindingHash: "hash-provider-binding-123",
		evidenceBundleHash: "hash-evidence-bundle-123",
		guardDecisionRef: "guard-decision-123",
		consumptionAuditRef: "audit-consumption-reviewer-fanout-123",
		consumedAt: "2026-05-17T00:05:00.000Z",
	});
	assert.ok(result.consumed_approval);
	return result.consumed_approval;
}

function fallbackDecision(
	overrides: Partial<FlowDeskFallbackDecisionV1> = {},
): FlowDeskFallbackDecisionV1 {
	return {
		schema_version: "flowdesk.fallback_decision.v1",
		decision_id: "fallback-decision-123",
		workflow_id: "workflow-123",
		parent_attempt_id: "attempt-123",
		new_attempt_id: "attempt-fallback-123",
		from_provider_qualified_model_id: "claude/sonnet-4",
		to_provider_qualified_model_id: "openai/gpt-5.5",
		reason_label: "provider_unhealthy",
		depth: 1,
		max_depth: 2,
		fresh_evidence_refs: [
			"usage-fresh-123",
			"health-fresh-123",
			"runtime-fresh-123",
		],
		fresh_guard_decision_ref: "guard-fallback-123",
		fresh_approval_ref: "approval-fallback-123",
		fresh_pre_dispatch_audit_ref: "audit-fallback-123",
		policy_eligibility_ref: "policy-fallback-123",
		runtime_compatibility_ref: "runtime-compatibility-fallback-123",
		state: "requires_full_regate",
		automatic_fallback_authorized: false,
		dispatch_authority_enabled: false,
		providerCall: false,
		actualLaneLaunch: false,
		runtimeExecution: false,
		...overrides,
	};
}

function consumedFallbackApproval(
	overrides: Partial<FlowDeskProductionApprovalSourceV1> = {},
): FlowDeskProductionApprovalSourceV1 {
	const source = approvalSource({
		approval_id: "approval-fallback-123",
		attempt_id: "attempt-fallback-123",
		action_type: "fallback_reselection",
		provider_qualified_model_id: "openai/gpt-5.5",
		...overrides,
	});
	const result = consumeFlowDeskProductionApprovalSourceV1({
		approval: source,
		workflowId: "workflow-123",
		attemptId: "attempt-fallback-123",
		actionType: "fallback_reselection",
		actorRef: "actor-user-123",
		profileRef: "profile-prod-123",
		providerQualifiedModelId: "openai/gpt-5.5",
		providerBindingHash: "hash-provider-binding-123",
		evidenceBundleHash: "hash-evidence-bundle-123",
		guardDecisionRef: "guard-decision-123",
		consumptionAuditRef: "audit-consumption-fallback-123",
		consumedAt: "2026-05-17T00:05:00.000Z",
	});
	assert.ok(result.consumed_approval);
	return result.consumed_approval;
}

function controlledExternalWriteRequest(
	overrides: Partial<FlowDeskControlledExternalWriteRequestV1> = {},
): FlowDeskControlledExternalWriteRequestV1 {
	return {
		schema_version: "flowdesk.controlled_external_write_request.v1",
		request_id: "external-write-123",
		workflow_id: "workflow-123",
		attempt_id: "attempt-123",
		target_kind: "release_conformance_doc",
		target_ref: "release-conformance-doc-123",
		redaction_policy_ref: "redaction-policy-123",
		content_hash_ref: "hash-content-123",
		pre_write_audit_ref: "audit-prewrite-123",
		dry_run_ref: "dry-run-123",
		created_at: now,
		external_write_authority_enabled: false,
		dispatch_authority_enabled: false,
		providerCall: false,
		actualLaneLaunch: false,
		runtimeExecution: false,
		...overrides,
	};
}

function consumedExternalWriteApproval(
	overrides: Partial<FlowDeskProductionApprovalSourceV1> = {},
): FlowDeskProductionApprovalSourceV1 {
	const source = approvalSource({
		approval_id: "approval-external-write-123",
		action_type: "external_write",
		...overrides,
	});
	const result = consumeFlowDeskProductionApprovalSourceV1({
		approval: source,
		workflowId: "workflow-123",
		attemptId: "attempt-123",
		actionType: "external_write",
		actorRef: "actor-user-123",
		profileRef: "profile-prod-123",
		providerQualifiedModelId: "claude/sonnet-4",
		providerBindingHash: "hash-provider-binding-123",
		evidenceBundleHash: "hash-evidence-bundle-123",
		guardDecisionRef: "guard-decision-123",
		consumptionAuditRef: "audit-consumption-external-write-123",
		consumedAt: "2026-05-17T00:05:00.000Z",
	});
	assert.ok(result.consumed_approval);
	return result.consumed_approval;
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
					observed_at: "2026-05-19T00:00:00.000Z",
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

function writeDerivedDefaultAuthorizationEvidence(rootDir: string): void {
	const records: Record<string, unknown>[] = [
		usageAuthorityEvidence() as unknown as Record<string, unknown>,
		runtimeEchoEvidence() as unknown as Record<string, unknown>,
		telemetryCorrelation() as unknown as Record<string, unknown>,
		dispatchableHealth() as unknown as Record<string, unknown>,
		{
			schema_version: "flowdesk.pre_dispatch_audit_record.v1",
			workflow_id: "workflow-123",
			pre_dispatch_audit_ref: "audit-123",
			observed_at: now,
			attempt_id: "attempt-123",
			approval_ref: "approval-123",
			dispatch_authority_enabled: false,
			providerCall: false,
			actualLaneLaunch: false,
			runtimeExecution: false,
		},
		consumedApproval() as unknown as Record<string, unknown>,
		{
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
	];
	const intents = records.map((record, index) => {
		const prepared = prepareFlowDeskSessionEvidenceWriteIntentV1({
			workflowId: "workflow-123",
			evidenceId: `derived-default-auth-evidence-${index + 1}`,
			record,
		});
		assert.equal(prepared.ok, true, prepared.errors.join("; "));
		assert.ok(prepared.writeIntent);
		return prepared.writeIntent;
	});
	const applied = applyFlowDeskSessionEvidenceWriteIntentsV1(rootDir, intents);
	assert.equal(applied.ok, true, applied.errors.join("; "));
}

function derivedDefaultAuthorizationProductionEnablement(
	overrides: Record<string, unknown> = {},
): Record<string, unknown> {
	return {
		enabled: true,
		preDispatchAuditRef: "audit-123",
		configuredVerificationRef: "verification-123",
		configuredVerificationResult: createFlowDeskConfiguredVerificationResultV1({
			verificationRef: "verification-123",
			workflowId: "workflow-123",
			result: "passed",
			producedAt: now,
			sourceRef: "configured-verification-source-123",
			checkLabels: ["typecheck", "unit-tests"],
			evidenceRefs: ["verification-evidence-123"],
		}),
		sanitizedAuthCaptureRef: "sanitized-auth-capture-123",
		sanitizedAuthCaptureResult: createFlowDeskSanitizedAuthCaptureResultV1({
			sanitizedAuthCaptureRef: "sanitized-auth-capture-123",
			durableCaptureRef: "durable-auth-capture-123",
			workflowId: "workflow-123",
			providerFamily: "claude",
			providerQualifiedModelId: "claude/sonnet-4",
			authProfileRef: "auth-profile-123",
			authEvidenceRef: "auth-evidence-123",
			credentialScopeRef: "principal-scope-123",
			accountBoundaryRef: "account-boundary-123",
			sanitizerRef: "sanitizer-123",
			sourceRef: "external-auth-source-123",
			result: "passed",
			capturedAt: now,
			metadataLabels: ["raw-plugin-object-redacted", "scope-bound"],
			evidenceRefs: ["sanitized-auth-capture-evidence-123"],
		}),
		externalAuthPolicyRef: "external-auth-policy-123",
		providerPolicyRef: "provider-policy-123",
		externalAuthProviderPolicyResult:
			createFlowDeskExternalAuthProviderPolicyResultV1({
				externalAuthPolicyRef: "external-auth-policy-123",
				providerPolicyRef: "provider-policy-123",
				workflowId: "workflow-123",
				providerFamily: "claude",
				providerQualifiedModelId: "claude/sonnet-4",
				authProfileRef: "auth-profile-123",
				authEvidenceRef: "auth-evidence-123",
				credentialScopeRef: "principal-scope-123",
				accountBoundaryRef: "account-boundary-123",
				sanitizerRef: "sanitizer-123",
				sourceRef: "external-auth-source-123",
				result: "passed",
				sanitizedAt: now,
				metadataLabels: ["account-boundary-bound", "scope-bound"],
				evidenceRefs: ["external-auth-policy-evidence-123"],
			}),
		laneConformanceRefs: ["lane-conformance-123"],
		approvalDecision: createFlowDeskProductionApprovalDecisionV1({
			approvalId: "approval-123",
			workflowId: "workflow-123",
			decision: "approve",
			createdAt: now,
			requiredEvidenceRefs: [
				"usage-authority-123",
				"runtime-echo-123",
				"telemetry-123",
				"health-123",
				"audit-123",
				"verification-123",
				"verification-evidence-123",
				"sanitized-auth-capture-123",
				"sanitized-auth-capture-evidence-123",
				"external-auth-policy-123",
				"external-auth-policy-evidence-123",
				"provider-policy-123",
				"lane-conformance-123",
			],
		}),
		defaultManagedDispatchAuthorizationMetadata: {
			enabled: true,
			authorizationId: "derived-default-auth-123",
			actorRef: "actor-ops-123",
			profileRef: "profile-prod-123",
			releaseGateRef: "release-gate-123",
			rollbackRef: "rollback-123",
			createdAt: now,
			expiresAt: "2099-01-01T00:00:00.000Z",
			defaultEnablementRequested: true,
			killSwitchState: "inactive",
			durablePrecallRef: "durable-precall-123",
			adapterProfileRef: "adapter-profile-123",
			sdkClientRef: "sdk-client-123",
			defaultReleaseEnablementRef: "default-release-enable-123",
		},
		...overrides,
	};
}

function fakeClient() {
	const promptCalls: FlowDeskManagedDispatchBetaPromptOptionsV1[] = [];
	const promptAsyncCalls: FlowDeskManagedDispatchBetaPromptOptionsV1[] = [];
	const abortCalls: Array<{
		sessionID?: string;
		path?: { id: string };
		query?: { directory?: string };
	}> = [];
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
			abort(options) {
				abortCalls.push(options);
				return Promise.resolve(true);
			},
		},
	};
	return { client, promptCalls, promptAsyncCalls, abortCalls };
}

function runtimeLaneLaunchPlan(
	overrides: Partial<FlowDeskRuntimeLaneLaunchPlanV1> = {},
): FlowDeskRuntimeLaneLaunchPlanV1 {
	return {
		schema_version: "flowdesk.runtime_lane_launch_plan.v1",
		ok: true,
		errors: [],
		launch_request_id: "launch-request-123",
		workflow_id: "workflow-123",
		attempt_id: "attempt-123",
		lane_id: "lane-123",
		state: "launch_ready",
		blocked_labels: [],
		parent_session_ref: "ses-parent-123",
		agent_ref: "agent-reviewer",
		provider_qualified_model_id: "claude/sonnet-4",
		launch_reason: "reviewer_fanout",
		pre_launch_audit_ref: "audit-pre-launch-123",
		lane_launch_approval_ref: "approval-lane-launch-123",
		durable_evidence_root_ref: "evidence-root-workflow-123",
		lifecycle_evidence_class: "lane_lifecycle",
		exact_binding_confirmed: true,
		sdk_client_required: true,
		launch_attempted: false,
		dispatch_authority_enabled: false,
		providerCall: false,
		actualLaneLaunch: false,
		runtimeExecution: false,
		...overrides,
	};
}

function fakeRuntimeLaneClient() {
	const createCalls: unknown[] = [];
	const promptCalls: unknown[] = [];
	const promptAsyncCalls: unknown[] = [];
	const client: FlowDeskManagedDispatchBetaOpenCodeClientV1 = {
		session: {
			create(options) {
				createCalls.push(options);
				return Promise.resolve({ id: "child-123" });
			},
			prompt(options) {
				promptCalls.push(options);
				return Promise.resolve({ info: { id: "message-lane-123" }, parts: [] });
			},
			promptAsync(options) {
				promptAsyncCalls.push(options);
				return Promise.resolve(undefined);
			},
		},
	};
	return { client, createCalls, promptCalls, promptAsyncCalls };
}

function permissionAskDecision(
	overrides: Partial<FlowDeskPermissionAskDecisionV1> = {},
): FlowDeskPermissionAskDecisionV1 {
	return {
		schema_version: "flowdesk.permission_ask_decision.v1",
		decision_id: "permission-decision-123",
		workflow_id: "workflow-123",
		attempt_id: "attempt-123",
		session_ref: "session-123",
		requested_permission_kind_ref: "tool-write-ref-123",
		policy_pack_ref: "policy-pack-ref-123",
		status: "deny",
		deny_reason: "guard_unapproved",
		observed_at: now,
		dispatch_authority_enabled: false,
		providerCall: false,
		actualLaneLaunch: false,
		runtimeExecution: false,
		hardCancelOrNoReplyAuthority: false,
		...overrides,
	};
}

function sessionAbortDecision(
	overrides: Partial<FlowDeskSessionAbortDecisionV1> = {},
): FlowDeskSessionAbortDecisionV1 {
	return {
		schema_version: "flowdesk.session_abort_decision.v1",
		decision_id: "session-abort-decision-123",
		workflow_id: "workflow-123",
		attempt_id: "attempt-123",
		session_ref: "session-123",
		abort_reason: "guard_revoked",
		policy_pack_ref: "policy-pack-ref-123",
		guard_decision_ref: "guard-decision-ref-123",
		pre_abort_audit_ref: "pre-abort-audit-ref-123",
		created_at: now,
		dispatch_authority_enabled: false,
		providerCall: false,
		actualLaneLaunch: false,
		runtimeExecution: false,
		hardCancelOrNoReplyAuthority: false,
		session_abort_authorized: true,
		...overrides,
	};
}

function promptNoReplyDecision(
	overrides: Partial<FlowDeskPromptNoReplyDecisionV1> = {},
): FlowDeskPromptNoReplyDecisionV1 {
	return {
		schema_version: "flowdesk.prompt_no_reply_decision.v1",
		decision_id: "noreply-decision-123",
		workflow_id: "workflow-123",
		attempt_id: "attempt-123",
		session_ref: "session-123",
		agent_ref: "agent-build",
		provider_qualified_model_id: "claude/sonnet-4",
		no_reply_reason: "context_commit_only",
		policy_pack_ref: "policy-pack-ref-123",
		guard_decision_ref: "guard-decision-ref-123",
		pre_call_audit_ref: "pre-call-audit-ref-123",
		created_at: now,
		dispatch_authority_enabled: false,
		providerCall: true,
		actualLaneLaunch: false,
		runtimeExecution: true,
		hardCancelOrNoReplyAuthority: false,
		prompt_no_reply_authorized: true,
		...overrides,
	};
}

function failingPromptAsyncClient() {
	const promptAsyncCalls: FlowDeskManagedDispatchBetaPromptOptionsV1[] = [];
	const client: FlowDeskManagedDispatchBetaOpenCodeClientV1 = {
		session: {
			promptAsync(options) {
				promptAsyncCalls.push(options);
				return Promise.reject(new Error("provider unavailable"));
			},
		},
	};
	return { client, promptAsyncCalls };
}

function fakeReservationStore(
	overrides: { reserveOk?: boolean; completedRecordOk?: boolean; failureRecordOk?: boolean } = {},
) {
	const reserveCalls: Array<
		Parameters<FlowDeskManagedDispatchBetaReservationStoreV1["reserve"]>[0]
	> = [];
	const completedCalls: Array<
		Parameters<
			NonNullable<FlowDeskManagedDispatchBetaReservationStoreV1["recordDispatchCompleted"]>
		>[0]
	> = [];
	const failureCalls: Array<
		Parameters<
			FlowDeskManagedDispatchBetaReservationStoreV1["recordDispatchFailure"]
		>[0]
	> = [];
	const store: FlowDeskManagedDispatchBetaReservationStoreV1 = {
		reserve(input) {
			reserveCalls.push(input);
			return {
				ok: overrides.reserveOk ?? true,
				reservationEvidenceReloaded: overrides.reserveOk ?? true,
				...(overrides.reserveOk === false
					? { redactedFailureReason: "reservation reload failed" }
					: {}),
			};
		},
		recordDispatchCompleted(input) {
			completedCalls.push(input);
			return {
				ok: overrides.completedRecordOk ?? true,
				reservationEvidenceReloaded: overrides.completedRecordOk ?? true,
				...(overrides.completedRecordOk === false
					? { redactedFailureReason: "completed update failed" }
					: {}),
			};
		},
		recordDispatchFailure(input) {
			failureCalls.push(input);
			return {
				ok: overrides.failureRecordOk ?? true,
				reservationEvidenceReloaded: overrides.failureRecordOk ?? true,
				...(overrides.failureRecordOk === false
					? { redactedFailureReason: "failure update failed" }
					: {}),
			};
		},
	};
	return { store, reserveCalls, completedCalls, failureCalls };
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
	assert.deepEqual(childrenCalls[0], {
		sessionID: "session-123",
		query: { directory: "/tmp/flowdesk-project" },
	});
	assert.equal(messageCalls.length, 1);
	assert.deepEqual(messageCalls[0], {
		sessionID: "child-session-123",
		query: { directory: "/tmp/flowdesk-project" },
	});
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

test("injected sdk runtime lane launch creates child session and prompts exact reviewer binding", async () => {
	const { client, createCalls, promptCalls, promptAsyncCalls } = fakeRuntimeLaneClient();
	const result = await launchFlowDeskInjectedSdkRuntimeLaneFromPlanV1({
		client,
		launchPlan: runtimeLaneLaunchPlan(),
		request: {
			allowActualLaneLaunch: true,
			parentSessionId: "parent-123",
			promptText: "Return a typed FlowDesk reviewer verdict.",
			dispatchMethod: "prompt",
			title: "FlowDesk reviewer lane",
		},
	});

	assert.equal(result.status, "lane_launch_started");
	assert.equal(result.createAttempted, true);
	assert.equal(result.promptAttempted, true);
	assert.equal(result.parentSessionRef, "ses-parent-123");
	assert.equal(result.childSessionRef, "ses-child-123");
	assert.equal(result.messageRef, "message-message-lane-123");
	assert.equal(result.agent, "reviewer");
	assert.deepEqual(result.model, { providerID: "anthropic", modelID: "sonnet-4" });
	assert.equal(result.authority.actualLaneLaunch, true);
	assert.equal(result.authority.providerCall, true);
	assert.equal(result.authority.runtimeExecution, true);
	assert.equal(result.authority.realOpenCodeDispatch, false);
	assert.equal(result.authority.defaultRelease1ServerBehaviorUnchanged, true);
	assert.deepEqual(createCalls, [
		{ parentID: "parent-123", title: "FlowDesk reviewer lane" },
	]);
	assert.equal(promptAsyncCalls.length, 0);
	assert.deepEqual(promptCalls, [
		{
			sessionID: "child-123",
			body: {
				model: { providerID: "anthropic", modelID: "sonnet-4" },
				agent: "reviewer",
				parts: [{ type: "text", text: "Return a typed FlowDesk reviewer verdict." }],
			},
		},
	]);
});

test("injected sdk runtime lane launch uses flat sessionID promptAsync options first", async () => {
	const { client, promptCalls, promptAsyncCalls } = fakeRuntimeLaneClient();
	const result = await launchFlowDeskInjectedSdkRuntimeLaneFromPlanV1({
		client,
		launchPlan: runtimeLaneLaunchPlan(),
		request: {
			allowActualLaneLaunch: true,
			parentSessionId: "parent-123",
			promptText: "Return a typed FlowDesk reviewer verdict.",
			dispatchMethod: "promptAsync",
		},
	});

	assert.equal(result.status, "lane_launch_started");
	assert.equal(promptCalls.length, 0);
	assert.deepEqual(promptAsyncCalls, [
		{
			sessionID: "child-123",
			body: {
				model: { providerID: "anthropic", modelID: "sonnet-4" },
				agent: "reviewer",
				parts: [{ type: "text", text: "Return a typed FlowDesk reviewer verdict." }],
			},
		},
	]);
});

test("injected sdk runtime lane launch blocks before SDK calls without opt-in or plan binding", async () => {
	const noOptIn = fakeRuntimeLaneClient();
	const blockedOptIn = await launchFlowDeskInjectedSdkRuntimeLaneFromPlanV1({
		client: noOptIn.client,
		launchPlan: runtimeLaneLaunchPlan(),
		request: {
			allowActualLaneLaunch: false,
			parentSessionId: "parent-123",
			promptText: "review",
		},
	});
	assert.equal(blockedOptIn.status, "blocked_before_lane_launch");
	assert.equal(blockedOptIn.createAttempted, false);
	assert.equal(blockedOptIn.promptAttempted, false);
	assert.match(String(blockedOptIn.redactedBlockReason), /Explicit actual/);
	assert.equal(noOptIn.createCalls.length, 0);
	assert.equal(noOptIn.promptAsyncCalls.length, 0);

	const parentDrift = fakeRuntimeLaneClient();
	const blockedParent = await launchFlowDeskInjectedSdkRuntimeLaneFromPlanV1({
		client: parentDrift.client,
		launchPlan: runtimeLaneLaunchPlan(),
		request: {
			allowActualLaneLaunch: true,
			parentSessionId: "other-parent",
			promptText: "review",
		},
	});
	assert.equal(blockedParent.status, "blocked_before_lane_launch");
	assert.match(String(blockedParent.redactedBlockReason), /parent session/);
	assert.equal(parentDrift.createCalls.length, 0);
	assert.equal(parentDrift.promptAsyncCalls.length, 0);

	const blockedPlan = fakeRuntimeLaneClient();
	const blockedNotReady = await launchFlowDeskInjectedSdkRuntimeLaneFromPlanV1({
		client: blockedPlan.client,
		launchPlan: runtimeLaneLaunchPlan({
			ok: false,
			state: "blocked",
			blocked_labels: ["sdk_client_unavailable"],
			exact_binding_confirmed: false,
		}),
		request: {
			allowActualLaneLaunch: true,
			parentSessionId: "parent-123",
			promptText: "review",
		},
	});
	assert.equal(blockedNotReady.status, "blocked_before_lane_launch");
	assert.equal(blockedPlan.createCalls.length, 0);
	assert.equal(blockedPlan.promptAsyncCalls.length, 0);
});

test("injected sdk runtime lane launch reports sanitized runtime and provider failures", async () => {
	const missingCreate = await launchFlowDeskInjectedSdkRuntimeLaneFromPlanV1({
		client: { session: {} },
		launchPlan: runtimeLaneLaunchPlan(),
		request: {
			allowActualLaneLaunch: true,
			parentSessionId: "parent-123",
			promptText: "review",
		},
	});
	assert.equal(missingCreate.status, "blocked_before_lane_launch");
	assert.match(String(missingCreate.redactedBlockReason), /session.create/);

	const promptAsyncCalls: FlowDeskManagedDispatchBetaPromptOptionsV1[] = [];
	const failingPromptClient: FlowDeskManagedDispatchBetaOpenCodeClientV1 = {
		session: {
			create() {
				return Promise.resolve({ data: { id: "child-failed" } });
			},
			promptAsync(options) {
				promptAsyncCalls.push(options);
				return Promise.reject(new Error("raw provider failure"));
			},
		},
	};
	const failed = await launchFlowDeskInjectedSdkRuntimeLaneFromPlanV1({
		client: failingPromptClient,
		launchPlan: runtimeLaneLaunchPlan(),
		request: {
			allowActualLaneLaunch: true,
			parentSessionId: "parent-123",
			promptText: "review",
		},
	});
	assert.equal(failed.status, "lane_launch_failed");
	assert.equal(failed.createAttempted, true);
	assert.equal(failed.promptAttempted, true);
	assert.equal(failed.childSessionRef, "ses-child-failed");
	assert.equal(failed.redactedErrorCategory, "provider_api");
	assert.equal(failed.authority.actualLaneLaunch, false);
	assert.equal(promptAsyncCalls.length, 1);
});

test("runtime lane launch lifecycle materializer records reloadable running lifecycle evidence", async () => {
	await withTempRoot(async (rootDir) => {
		const { client } = fakeRuntimeLaneClient();
		const launchPlan = runtimeLaneLaunchPlan();
		const launchResult = await launchFlowDeskInjectedSdkRuntimeLaneFromPlanV1({
			client,
			launchPlan,
			request: {
				allowActualLaneLaunch: true,
				parentSessionId: "parent-123",
				promptText: "review",
				dispatchMethod: "prompt",
			},
		});
		assert.equal(launchResult.status, "lane_launch_started");

		const materialized = materializeFlowDeskRuntimeLaneLaunchLifecycleEvidenceV1({
			rootDir,
			launchPlan,
			launchResult,
			evidenceId: "lane-lifecycle-launch-1",
			observedAt: now,
			timeoutMs: 120_000,
			orphanMaxAgeMs: 300_000,
		});

		assert.equal(materialized.status, "lane_lifecycle_recorded");
		assert.equal(materialized.writeAttempted, true);
		assert.equal(materialized.evidenceReloaded, true);
		assert.equal(materialized.lifecycleState, "running");
		assert.equal(materialized.authority.runtimeLaneLifecyclePersisted, true);
		assert.equal(materialized.authority.actualLaneLaunch, false);
		assert.equal(materialized.authority.runtimeExecution, false);
		const reloaded = reloadFlowDeskSessionEvidenceV1({
			workflowId: "workflow-123",
			rootDir,
		});
		const lifecycle = reloaded.entries.find(
			(entry) => entry.evidenceClass === "lane_lifecycle",
		);
		assert.equal(lifecycle?.evidenceId, "lane-lifecycle-launch-1");
		assert.equal(lifecycle?.record.state, "running");
		assert.equal(lifecycle?.record.child_session_ref, "ses-child-123");
		assert.equal(lifecycle?.record.message_ref, "msg-message-lane-123");
		assert.equal(lifecycle?.record.actualLaneLaunch, false);
	});
});

test("runtime lane launch lifecycle materializer blocks duplicate and non-launch results", async () => {
	await withTempRoot(async (rootDir) => {
		const launchPlan = runtimeLaneLaunchPlan();
		const blockedLaunch = await launchFlowDeskInjectedSdkRuntimeLaneFromPlanV1({
			client: fakeRuntimeLaneClient().client,
			launchPlan,
			request: {
				allowActualLaneLaunch: false,
				parentSessionId: "parent-123",
				promptText: "review",
			},
		});
		const blockedMaterialization =
			materializeFlowDeskRuntimeLaneLaunchLifecycleEvidenceV1({
				rootDir,
				launchPlan,
				launchResult: blockedLaunch,
				evidenceId: "lane-lifecycle-blocked-1",
				observedAt: now,
			});
		assert.equal(
			blockedMaterialization.status,
			"blocked_before_lane_lifecycle",
		);
		assert.equal(blockedMaterialization.writeAttempted, false);
		assert.match(
			String(blockedMaterialization.redactedBlockReason),
			/started or failed/,
		);

		const failedLaunch: Awaited<
			ReturnType<typeof launchFlowDeskInjectedSdkRuntimeLaneFromPlanV1>
		> = {
			adapterProfile: "injected_sdk_runtime_lane_launch_adapter",
			status: "lane_launch_failed",
			createAttempted: true,
			promptAttempted: true,
			workflowId: "workflow-123",
			attemptId: "attempt-123",
			laneId: "lane-123",
			parentSessionRef: "ses-parent-123",
			childSessionRef: "ses-child-failed",
			redactedErrorCategory: "provider_api",
			safeNextActions: ["/flowdesk-status", "/flowdesk-export-debug"],
			authority: {
				realOpenCodeDispatch: false,
				providerCall: false,
				runtimeExecution: false,
				actualLaneLaunch: false,
				fallbackAuthority: false,
				toolAuthority: false,
				hardCancelOrNoReplyAuthority: false,
				runtimeLaneLaunchAuthorized: false,
				defaultRelease1ServerBehaviorUnchanged: true,
			},
		};
		const failedMaterialization =
			materializeFlowDeskRuntimeLaneLaunchLifecycleEvidenceV1({
				rootDir,
				launchPlan,
				launchResult: failedLaunch,
				evidenceId: "lane-lifecycle-failed-1",
				observedAt: now,
			});
		assert.equal(failedMaterialization.status, "lane_lifecycle_recorded");
		assert.equal(failedMaterialization.lifecycleState, "invocation_failed");

		const duplicate = materializeFlowDeskRuntimeLaneLaunchLifecycleEvidenceV1({
			rootDir,
			launchPlan,
			launchResult: failedLaunch,
			evidenceId: "lane-lifecycle-failed-1",
			observedAt: now,
		});
		assert.equal(duplicate.status, "blocked_before_lane_lifecycle");
		assert.match(String(duplicate.redactedBlockReason), /already exists/);
		assert.equal(
			reloadFlowDeskSessionEvidenceV1({ workflowId: "workflow-123", rootDir })
				.entries.filter((entry) => entry.evidenceClass === "lane_lifecycle")
				.length,
			1,
		);
	});
});

test("runtime lane complete lifecycle materializer records verdict-linked complete evidence", async () => {
	await withTempRoot(async (rootDir) => {
		const launchPlan = runtimeLaneLaunchPlan();
		const { client } = fakeRuntimeLaneClient();
		const launchResult = await launchFlowDeskInjectedSdkRuntimeLaneFromPlanV1({
			client,
			launchPlan,
			request: {
				allowActualLaneLaunch: true,
				parentSessionId: "parent-123",
				promptText: "review",
				dispatchMethod: "prompt",
			},
		});
		assert.equal(launchResult.status, "lane_launch_started");
		const verdict = typedReviewerVerdict();
		const observation = await observeInjectedSdkReviewerVerdictV1({
			client: observingClient(
				[],
				[{ info: { id: "message-verdict-123" }, parts: [{ type: "text", text: JSON.stringify(verdict) }] }],
			).client,
			request: {
				sessionId: "child-123",
				workflowId: "workflow-123",
				lanePlanRef: "lane-plan-123",
				bindingRef: "binding-reviewer-123",
				perspective: "policy_security",
			},
		});
		assert.equal(observation.status, "verdict_observed");

		const materialized = materializeFlowDeskRuntimeLaneCompleteLifecycleEvidenceV1({
			rootDir,
			launchPlan,
			launchResult,
			verdictObservation: observation,
			evidenceId: "lane-lifecycle-complete-1",
			observedAt: now,
			outputRef: "output-reviewer-1",
			runtimeEchoRef: "runtime-echo-reviewer-1",
			telemetryRef: "telemetry-reviewer-1",
			timeoutMs: 120_000,
			orphanMaxAgeMs: 300_000,
		});

		assert.equal(materialized.status, "lane_lifecycle_recorded");
		assert.equal(materialized.lifecycleState, "complete");
		assert.equal(materialized.authority.runtimeLaneLifecyclePersisted, true);
		assert.equal(materialized.authority.actualLaneLaunch, false);
		const lifecycle = reloadFlowDeskSessionEvidenceV1({
			workflowId: "workflow-123",
			rootDir,
		}).entries.find((entry) => entry.evidenceClass === "lane_lifecycle");
		assert.equal(lifecycle?.evidenceId, "lane-lifecycle-complete-1");
		assert.equal(lifecycle?.record.state, "complete");
		assert.equal(lifecycle?.record.verdict_ref, "verdict-policy-security");
		assert.equal(lifecycle?.record.child_session_ref, "ses-child-123");
		assert.equal(lifecycle?.record.message_ref, "msg-message-lane-123");
		assert.equal(lifecycle?.record.output_ref, "output-reviewer-1");
	});
});

test("runtime lane complete lifecycle materializer blocks non-verdict observations and duplicates", async () => {
	await withTempRoot(async (rootDir) => {
		const launchPlan = runtimeLaneLaunchPlan();
		const launchResult = await launchFlowDeskInjectedSdkRuntimeLaneFromPlanV1({
			client: fakeRuntimeLaneClient().client,
			launchPlan,
			request: {
				allowActualLaneLaunch: true,
				parentSessionId: "parent-123",
				promptText: "review",
				dispatchMethod: "prompt",
			},
		});
		const missingObservation = await observeInjectedSdkReviewerVerdictV1({
			client: observingClient([], [{ parts: [{ type: "text", text: "ordinary prose" }] }]).client,
			request: {
				sessionId: "child-123",
				workflowId: "workflow-123",
				lanePlanRef: "lane-plan-123",
				bindingRef: "binding-reviewer-123",
				perspective: "policy_security",
			},
		});
		const blocked = materializeFlowDeskRuntimeLaneCompleteLifecycleEvidenceV1({
			rootDir,
			launchPlan,
			launchResult,
			verdictObservation: missingObservation,
			evidenceId: "lane-lifecycle-complete-blocked",
			observedAt: now,
			outputRef: "output-reviewer-1",
			runtimeEchoRef: "runtime-echo-reviewer-1",
			telemetryRef: "telemetry-reviewer-1",
		});
		assert.equal(blocked.status, "blocked_before_lane_lifecycle");
		assert.equal(blocked.writeAttempted, false);
		assert.match(String(blocked.redactedBlockReason), /verdict_observed/);

		const observation = await observeInjectedSdkReviewerVerdictV1({
			client: observingClient(
				[],
				[{ parts: [{ type: "text", text: JSON.stringify(typedReviewerVerdict()) }] }],
			).client,
			request: {
				sessionId: "child-123",
				workflowId: "workflow-123",
				lanePlanRef: "lane-plan-123",
				bindingRef: "binding-reviewer-123",
				perspective: "policy_security",
			},
		});
		const first = materializeFlowDeskRuntimeLaneCompleteLifecycleEvidenceV1({
			rootDir,
			launchPlan,
			launchResult,
			verdictObservation: observation,
			evidenceId: "lane-lifecycle-complete-dup",
			observedAt: now,
			outputRef: "output-reviewer-1",
			runtimeEchoRef: "runtime-echo-reviewer-1",
			telemetryRef: "telemetry-reviewer-1",
		});
		assert.equal(first.status, "lane_lifecycle_recorded");
		const duplicate = materializeFlowDeskRuntimeLaneCompleteLifecycleEvidenceV1({
			rootDir,
			launchPlan,
			launchResult,
			verdictObservation: observation,
			evidenceId: "lane-lifecycle-complete-dup",
			observedAt: now,
			outputRef: "output-reviewer-1",
			runtimeEchoRef: "runtime-echo-reviewer-1",
			telemetryRef: "telemetry-reviewer-1",
		});
		assert.equal(duplicate.status, "blocked_before_lane_lifecycle");
		assert.match(String(duplicate.redactedBlockReason), /already exists/);
	});
});

test("injected sdk reviewer verdict observation accepts only typed matching verdicts", async () => {
	const verdict = typedReviewerVerdict();
	const { client, messageCalls } = observingClient(
		[],
		[
			{
				info: { id: "message-verdict-123" },
				parts: [{ type: "text", text: JSON.stringify(verdict) }],
			},
		],
	);
	const result = await observeInjectedSdkReviewerVerdictV1({
		client,
		request: {
			sessionId: "child-session-123",
			workflowId: "workflow-123",
			lanePlanRef: "lane-plan-123",
			bindingRef: "binding-reviewer-123",
			perspective: "policy_security",
		},
	});

	assert.equal(result.status, "verdict_observed");
	assert.equal(result.observationAttempted, true);
	assert.equal(result.verdictId, "verdict-policy-security");
	assert.equal(result.verdict?.verdict_label, "pass");
	assert.equal(result.verdict?.uncertainty, "low");
	assert.equal(result.authority.realOpenCodeDispatch, false);
	assert.equal(result.authority.providerCall, false);
	assert.equal(result.authority.actualLaneLaunch, false);
	assert.equal(messageCalls.length, 1);
	assert.deepEqual(messageCalls[0], { sessionID: "child-session-123" });
});

test("injected sdk reviewer verdict observation separates missing and invalid verdicts from approvals", async () => {
	const missing = await observeInjectedSdkReviewerVerdictV1({
		client: observingClient(
			[],
			[
				{
					info: { id: "message-no-verdict" },
					parts: [{ type: "text", text: "ordinary review prose" }],
				},
			],
		).client,
		request: {
			sessionId: "child-session-123",
			workflowId: "workflow-123",
			lanePlanRef: "lane-plan-123",
			bindingRef: "binding-reviewer-123",
			perspective: "policy_security",
		},
	});
	assert.equal(missing.status, "missing_verdict");
	assert.equal(missing.verdict, undefined);
	assert.equal(missing.authority.realOpenCodeDispatch, false);

	const invalid = await observeInjectedSdkReviewerVerdictV1({
		client: observingClient(
			[],
			[
				{
					parts: [
						{
							type: "text",
							text: JSON.stringify(
								typedReviewerVerdict({ workflow_id: "workflow-other" }),
							),
						},
					],
				},
			],
		).client,
		request: {
			sessionId: "child-session-123",
			workflowId: "workflow-123",
			lanePlanRef: "lane-plan-123",
			bindingRef: "binding-reviewer-123",
			perspective: "policy_security",
		},
	});
	assert.equal(invalid.status, "invalid_verdict");
	assert.equal(invalid.verdict, undefined);
	assert.match(invalid.redactedErrors.join("|"), /workflow_id mismatch/);
});

test("observed typed reviewer verdict can be persisted without acceptance authority", async () => {
	await withTempRoot(async (rootDir) => {
		const verdict = typedReviewerVerdict();
		const observation = await observeInjectedSdkReviewerVerdictV1({
			client: observingClient(
				[],
				[
					{
						info: { id: "message-verdict-123" },
						parts: [{ type: "text", text: JSON.stringify(verdict) }],
					},
				],
			).client,
			request: {
				sessionId: "child-session-123",
				workflowId: "workflow-123",
				lanePlanRef: "lane-plan-123",
				bindingRef: "binding-reviewer-123",
				perspective: "policy_security",
			},
		});
		const materialized = materializeFlowDeskObservedReviewerVerdictEvidenceV1({
			rootDir,
			observation,
			evidenceId: "observed-verdict-1",
		});

		assert.equal(materialized.status, "verdict_evidence_recorded");
		assert.equal(materialized.writeAttempted, true);
		assert.equal(materialized.evidenceReloaded, true);
		assert.equal(materialized.verdictId, "verdict-policy-security");
		assert.equal(materialized.evidenceId, "observed-verdict-1");
		assert.equal(materialized.authority.typedReviewerVerdictPersisted, true);
		assert.equal(materialized.authority.typedReviewerVerdictsAccepted, false);
		assert.equal(
			materialized.authority.durableReviewerVerdictEvidenceLinked,
			false,
		);
		assert.equal(materialized.authority.providerCall, false);
		assert.equal(materialized.authority.actualLaneLaunch, false);
		assert.equal(materialized.authority.runtimeExecution, false);

		const reloaded = reloadFlowDeskSessionEvidenceV1({
			workflowId: "workflow-123",
			rootDir,
		});
		const reviewerVerdicts = reloaded.entries.filter(
			(entry) => entry.evidenceClass === "reviewer_verdict",
		);
		assert.equal(reviewerVerdicts.length, 1);
		assert.equal(reviewerVerdicts[0].evidenceId, "observed-verdict-1");
		assert.equal(
			reviewerVerdicts[0].record.verdict_id,
			"verdict-policy-security",
		);
		assert.equal(reviewerVerdicts[0].record.dispatch_authority_enabled, false);
	});
});

test("reviewer verdict persistence writes nothing for missing or invalid observations", async () => {
	await withTempRoot(async (rootDir) => {
		const missing = await observeInjectedSdkReviewerVerdictV1({
			client: observingClient(
				[],
				[
					{
						info: { id: "message-no-verdict" },
						parts: [{ type: "text", text: "ordinary review prose" }],
					},
				],
			).client,
			request: {
				sessionId: "child-session-123",
				workflowId: "workflow-123",
				lanePlanRef: "lane-plan-123",
				bindingRef: "binding-reviewer-123",
				perspective: "policy_security",
			},
		});
		const missingMaterialized =
			materializeFlowDeskObservedReviewerVerdictEvidenceV1({
				rootDir,
				observation: missing,
				evidenceId: "missing-verdict-1",
			});
		assert.equal(missingMaterialized.status, "blocked_before_verdict_evidence");
		assert.equal(missingMaterialized.writeAttempted, false);
		assert.equal(
			missingMaterialized.authority.typedReviewerVerdictPersisted,
			false,
		);
		assert.equal(
			missingMaterialized.authority.typedReviewerVerdictsAccepted,
			false,
		);

		const invalid = await observeInjectedSdkReviewerVerdictV1({
			client: observingClient(
				[],
				[
					{
						parts: [
							{
								type: "text",
								text: JSON.stringify(
									typedReviewerVerdict({ workflow_id: "workflow-other" }),
								),
							},
						],
					},
				],
			).client,
			request: {
				sessionId: "child-session-123",
				workflowId: "workflow-123",
				lanePlanRef: "lane-plan-123",
				bindingRef: "binding-reviewer-123",
				perspective: "policy_security",
			},
		});
		const invalidMaterialized =
			materializeFlowDeskObservedReviewerVerdictEvidenceV1({
				rootDir,
				observation: invalid,
				evidenceId: "invalid-verdict-1",
			});
		assert.equal(invalidMaterialized.status, "blocked_before_verdict_evidence");
		assert.equal(invalidMaterialized.writeAttempted, false);
		assert.equal(invalidMaterialized.authority.providerCall, false);
		assert.equal(invalidMaterialized.authority.actualLaneLaunch, false);

		const reloaded = reloadFlowDeskSessionEvidenceV1({
			workflowId: "workflow-123",
			rootDir,
		});
		assert.equal(
			reloaded.entries.some(
				(entry) => entry.evidenceClass === "reviewer_verdict",
			),
			false,
		);
	});
});

test("injected sdk reviewer verdict observation extracts verdict from markdown code fence", async () => {
	const verdict = typedReviewerVerdict();
	const fencedText = `Here is the verdict:\n\`\`\`json\n${JSON.stringify(verdict)}\n\`\`\`\n`;
	const result = await observeInjectedSdkReviewerVerdictV1({
		client: observingClient(
			[],
			[
				{
					info: { id: "message-verdict-fenced" },
					parts: [{ type: "text", text: fencedText }],
				},
			],
		).client,
		request: {
			sessionId: "child-session-123",
			workflowId: "workflow-123",
			lanePlanRef: "lane-plan-123",
			bindingRef: "binding-reviewer-123",
			perspective: "policy_security",
		},
	});
	assert.equal(result.status, "verdict_observed");
	assert.equal(result.verdictId, "verdict-policy-security");
});

test("injected sdk reviewer verdict observation extracts verdict from preamble text", async () => {
	const verdict = typedReviewerVerdict();
	const preambleText = `After reviewing the code, here is my assessment:\n\n${JSON.stringify(verdict)}\n\nEnd of review.`;
	const result = await observeInjectedSdkReviewerVerdictV1({
		client: observingClient(
			[],
			[
				{
					info: { id: "message-verdict-preamble" },
					parts: [{ type: "text", text: preambleText }],
				},
			],
		).client,
		request: {
			sessionId: "child-session-123",
			workflowId: "workflow-123",
			lanePlanRef: "lane-plan-123",
			bindingRef: "binding-reviewer-123",
			perspective: "policy_security",
		},
	});
	assert.equal(result.status, "verdict_observed");
	assert.equal(result.verdictId, "verdict-policy-security");
});

test("reviewer typed verdict acceptance adapter accepts only canonical passing verdicts", () => {
	const result = prepareFlowDeskReviewerTypedVerdictAcceptanceAdapterV1({
		workflowId: "workflow-123",
		attemptId: "attempt-123",
		verdicts:
			canonicalReviewerVerdicts() as unknown as FlowDeskTopTierReviewVerdictV1[],
		consumedApproval: consumedReviewerFanoutApproval(),
	});

	assert.equal(result.status, "verdicts_accepted");
	assert.deepEqual(result.acceptedVerdictIds, [
		"verdict-policy-security",
		"verdict-architecture",
		"verdict-verification-implementation",
	]);
	assert.deepEqual(result.acceptedPerspectives, [
		"policy_security",
		"architecture",
		"verification_implementation",
	]);
	assert.deepEqual(result.safeNextActions, [
		"/flowdesk-status",
		"/flowdesk-run",
	]);
	assert.equal(result.authority.typedReviewerVerdictsAccepted, true);
	assert.equal(result.authority.realOpenCodeDispatch, false);
	assert.equal(result.authority.providerCall, false);
	assert.equal(result.authority.actualLaneLaunch, false);
	assert.equal(result.authority.runtimeExecution, false);
});

test("reviewer typed verdict acceptance adapter accepts explicit requested subset", () => {
	const verdicts = canonicalReviewerVerdicts().filter(
		(verdict) => verdict.perspective === "verification_implementation",
	);
	const result = prepareFlowDeskReviewerTypedVerdictAcceptanceAdapterV1({
		workflowId: "workflow-123",
		attemptId: "attempt-123",
		verdicts: verdicts as unknown as FlowDeskTopTierReviewVerdictV1[],
		consumedApproval: consumedReviewerFanoutApproval(),
		requiredPerspectives: ["verification_implementation"],
	});

	assert.equal(result.status, "verdicts_accepted");
	assert.deepEqual(result.acceptedVerdictIds, [
		"verdict-verification-implementation",
	]);
	assert.deepEqual(result.acceptedPerspectives, [
		"verification_implementation",
	]);
	assert.equal(result.authority.typedReviewerVerdictsAccepted, true);
});

test("durable reviewer verdict linkage adapter requires reloaded verdict and lifecycle evidence", async () => {
	await withTempRoot((rootDir) => {
		const verdicts = canonicalReviewerVerdicts();
		const evidenceRecords = verdicts.flatMap((verdict) => [
			verdict,
			lifecycleForVerdict(verdict),
		]);
		const intents = evidenceRecords.map((record, index) => {
			const prepared = prepareFlowDeskSessionEvidenceWriteIntentV1({
				workflowId: "workflow-123",
				evidenceId: `reviewer-evidence-${index + 1}`,
				record,
			});
			assert.equal(prepared.ok, true, prepared.errors.join("; "));
			assert.ok(prepared.writeIntent);
			return prepared.writeIntent;
		});
		const applied = applyFlowDeskSessionEvidenceWriteIntentsV1(
			rootDir,
			intents,
		);
		assert.equal(applied.ok, true, applied.errors.join("; "));
		const reloaded = reloadFlowDeskSessionEvidenceV1({
			workflowId: "workflow-123",
			rootDir,
		});
		const result = prepareFlowDeskDurableReviewerVerdictLinkageAdapterV1({
			workflowId: "workflow-123",
			attemptId: "attempt-123",
			verdicts: verdicts as unknown as FlowDeskTopTierReviewVerdictV1[],
			consumedApproval: consumedReviewerFanoutApproval(),
			reloadedEvidence: reloaded,
		});
		assert.equal(result.status, "durable_verdicts_accepted");
		assert.deepEqual(result.linkedVerdictIds, [
			"verdict-policy-security",
			"verdict-architecture",
			"verdict-verification-implementation",
		]);
		assert.equal(result.linkedLifecycleRefs.length, 3);
		assert.equal(result.authority.typedReviewerVerdictsAccepted, true);
		assert.equal(result.authority.durableReviewerVerdictEvidenceLinked, true);
		assert.equal(result.authority.providerCall, false);
		assert.equal(result.authority.actualLaneLaunch, false);
	});
});

test("durable reviewer verdict linkage adapter links explicit requested subset", async () => {
	await withTempRoot((rootDir) => {
		const verdicts = canonicalReviewerVerdicts().filter(
			(verdict) => verdict.perspective === "verification_implementation",
		);
		const evidenceRecords = verdicts.flatMap((verdict) => [
			verdict,
			lifecycleForVerdict(verdict),
		]);
		const intents = evidenceRecords.map((record, index) => {
			const prepared = prepareFlowDeskSessionEvidenceWriteIntentV1({
				workflowId: "workflow-123",
				evidenceId: `subset-reviewer-evidence-${index + 1}`,
				record,
			});
			assert.equal(prepared.ok, true, prepared.errors.join("; "));
			assert.ok(prepared.writeIntent);
			return prepared.writeIntent;
		});
		const applied = applyFlowDeskSessionEvidenceWriteIntentsV1(
			rootDir,
			intents,
		);
		assert.equal(applied.ok, true, applied.errors.join("; "));
		const reloaded = reloadFlowDeskSessionEvidenceV1({
			workflowId: "workflow-123",
			rootDir,
		});
		const result = prepareFlowDeskDurableReviewerVerdictLinkageAdapterV1({
			workflowId: "workflow-123",
			attemptId: "attempt-123",
			verdicts: verdicts as unknown as FlowDeskTopTierReviewVerdictV1[],
			consumedApproval: consumedReviewerFanoutApproval(),
			reloadedEvidence: reloaded,
			requiredPerspectives: ["verification_implementation"],
		});
		assert.equal(result.status, "durable_verdicts_accepted");
		assert.deepEqual(result.linkedVerdictIds, [
			"verdict-verification-implementation",
		]);
		assert.equal(result.linkedLifecycleRefs.length, 1);
		assert.equal(result.authority.durableReviewerVerdictEvidenceLinked, true);
	});
});

test("durable reviewer verdict linkage adapter blocks missing or incomplete durable evidence", async () => {
	await withTempRoot((rootDir) => {
		const verdicts = canonicalReviewerVerdicts();
		const onlyVerdictIntents = verdicts.map((record, index) => {
			const prepared = prepareFlowDeskSessionEvidenceWriteIntentV1({
				workflowId: "workflow-123",
				evidenceId: `verdict-only-${index + 1}`,
				record,
			});
			assert.equal(prepared.ok, true, prepared.errors.join("; "));
			assert.ok(prepared.writeIntent);
			return prepared.writeIntent;
		});
		const applied = applyFlowDeskSessionEvidenceWriteIntentsV1(
			rootDir,
			onlyVerdictIntents,
		);
		assert.equal(applied.ok, true, applied.errors.join("; "));
		const reloaded = reloadFlowDeskSessionEvidenceV1({
			workflowId: "workflow-123",
			rootDir,
		});
		const missingLifecycle =
			prepareFlowDeskDurableReviewerVerdictLinkageAdapterV1({
				workflowId: "workflow-123",
				attemptId: "attempt-123",
				verdicts: verdicts as unknown as FlowDeskTopTierReviewVerdictV1[],
				consumedApproval: consumedReviewerFanoutApproval(),
				reloadedEvidence: reloaded,
			});
		assert.equal(missingLifecycle.status, "blocked_before_durable_acceptance");
		assert.match(
			missingLifecycle.redactedBlockReason ?? "",
			/missing complete lane lifecycle evidence/,
		);
		assert.equal(
			missingLifecycle.authority.durableReviewerVerdictEvidenceLinked,
			false,
		);
	});
});

test("reviewer typed verdict acceptance adapter blocks incomplete or unapproved verdict sets", () => {
	const missingPerspective =
		prepareFlowDeskReviewerTypedVerdictAcceptanceAdapterV1({
			workflowId: "workflow-123",
			attemptId: "attempt-123",
			verdicts: canonicalReviewerVerdicts().slice(
				0,
				2,
			) as unknown as FlowDeskTopTierReviewVerdictV1[],
			consumedApproval: consumedReviewerFanoutApproval(),
		});
	assert.equal(missingPerspective.status, "blocked_before_acceptance");
	assert.deepEqual(missingPerspective.acceptedVerdictIds, []);
	assert.match(
		missingPerspective.redactedBlockReason ?? "",
		/missing required reviewer perspective|canonical perspectives/,
	);
	assert.equal(
		missingPerspective.authority.typedReviewerVerdictsAccepted,
		false,
	);
	assert.equal(missingPerspective.authority.providerCall, false);

	const nonPassing = prepareFlowDeskReviewerTypedVerdictAcceptanceAdapterV1({
		workflowId: "workflow-123",
		attemptId: "attempt-123",
		verdicts: canonicalReviewerVerdicts().map((entry) =>
			entry.perspective === "architecture"
				? { ...entry, verdict_label: "changes_required" }
				: entry,
		) as unknown as FlowDeskTopTierReviewVerdictV1[],
		consumedApproval: consumedReviewerFanoutApproval(),
	});
	assert.equal(nonPassing.status, "blocked_before_acceptance");
	assert.match(
		nonPassing.redactedBlockReason ?? "",
		/verdict_label must be pass/,
	);
	assert.equal(nonPassing.authority.actualLaneLaunch, false);

	const wrongApproval = prepareFlowDeskReviewerTypedVerdictAcceptanceAdapterV1({
		workflowId: "workflow-123",
		attemptId: "attempt-123",
		verdicts:
			canonicalReviewerVerdicts() as unknown as FlowDeskTopTierReviewVerdictV1[],
		consumedApproval: consumedApproval(),
	});
	assert.equal(wrongApproval.status, "blocked_before_acceptance");
	assert.match(wrongApproval.redactedBlockReason ?? "", /action_type mismatch/);
	assert.equal(wrongApproval.authority.runtimeExecution, false);
});

test("fallback reselection adapter promotes only to full re-gate without dispatch authority", () => {
	const result = prepareFlowDeskFallbackReselectionRegateAdapterV1({
		decision: fallbackDecision(),
		consumedApproval: consumedFallbackApproval(),
	});

	assert.equal(result.status, "regate_required");
	assert.equal(result.dispatchAttempted, false);
	assert.equal(result.workflowId, "workflow-123");
	assert.equal(result.parentAttemptId, "attempt-123");
	assert.equal(result.newAttemptId, "attempt-fallback-123");
	assert.equal(result.fromProviderQualifiedModelId, "claude/sonnet-4");
	assert.equal(result.toProviderQualifiedModelId, "openai/gpt-5.5");
	assert.deepEqual(result.safeNextActions, [
		"/flowdesk-status",
		"/flowdesk-run",
	]);
	assert.equal(result.authority.automaticFallbackAuthorized, false);
	assert.equal(result.authority.fallbackAuthority, false);
	assert.equal(result.authority.realOpenCodeDispatch, false);
	assert.equal(result.authority.providerCall, false);
	assert.equal(result.authority.actualLaneLaunch, false);
	assert.equal(result.authority.runtimeExecution, false);
});

test("fallback reselection adapter blocks unsafe reselection before re-gate", () => {
	const sameAttempt = prepareFlowDeskFallbackReselectionRegateAdapterV1({
		decision: fallbackDecision({ new_attempt_id: "attempt-123" }),
		consumedApproval: consumedFallbackApproval(),
	});
	assert.equal(sameAttempt.status, "blocked_before_regate");
	assert.equal(sameAttempt.dispatchAttempted, false);
	assert.deepEqual(sameAttempt.safeNextActions, ["/flowdesk-status"]);
	assert.match(
		sameAttempt.redactedBlockReason ?? "",
		/new attempt id|attempt_id mismatch/,
	);
	assert.equal(sameAttempt.authority.automaticFallbackAuthorized, false);
	assert.equal(sameAttempt.authority.providerCall, false);

	const terminalDepth = prepareFlowDeskFallbackReselectionRegateAdapterV1({
		decision: fallbackDecision({ depth: 2 }),
		consumedApproval: consumedFallbackApproval(),
	});
	assert.equal(terminalDepth.status, "blocked_before_regate");
	assert.match(terminalDepth.redactedBlockReason ?? "", /max-depth fallback/);
	assert.equal(terminalDepth.authority.realOpenCodeDispatch, false);

	const approvalMismatch = prepareFlowDeskFallbackReselectionRegateAdapterV1({
		decision: fallbackDecision(),
		consumedApproval: consumedFallbackApproval({
			approval_id: "approval-other-123",
		}),
	});
	assert.equal(approvalMismatch.status, "blocked_before_regate");
	assert.match(
		approvalMismatch.redactedBlockReason ?? "",
		/approval ref mismatch/,
	);
	assert.equal(approvalMismatch.authority.actualLaneLaunch, false);
});

test("managed fallback regate orchestrator prepares only a fresh full re-gate plan", () => {
	const result = orchestrateFlowDeskManagedFallbackRegateV1({
		decision: fallbackDecision(),
		consumedApproval: consumedFallbackApproval(),
	});

	assert.equal(result.status, "regate_plan_ready");
	assert.equal(result.dispatchAttempted, false);
	assert.equal(result.providerSwitchAttempted, false);
	assert.equal(result.sdkCallAttempted, false);
	assert.equal(result.workflowId, "workflow-123");
	assert.equal(result.parentAttemptId, "attempt-123");
	assert.equal(result.newAttemptId, "attempt-fallback-123");
	assert.equal(result.regatePlan?.state, "full_regate_required");
	assert.deepEqual(result.regatePlan?.required_fresh_evidence_refs, [
		"usage-fresh-123",
		"health-fresh-123",
		"runtime-fresh-123",
	]);
	assert.equal(
		result.regatePlan?.required_guard_decision_ref,
		"guard-fallback-123",
	);
	assert.equal(
		result.regatePlan?.required_approval_ref,
		"approval-fallback-123",
	);
	assert.equal(
		result.regatePlan?.required_pre_dispatch_audit_ref,
		"audit-fallback-123",
	);
	assert.deepEqual(result.safeNextActions, [
		"/flowdesk-status",
		"/flowdesk-run",
	]);
	assert.equal(result.authority.freshRegatePlanPrepared, true);
	assert.equal(result.authority.automaticFallbackAuthorized, false);
	assert.equal(result.authority.fallbackAuthority, false);
	assert.equal(result.authority.realOpenCodeDispatch, false);
	assert.equal(result.authority.providerCall, false);
	assert.equal(result.authority.actualLaneLaunch, false);
	assert.equal(result.authority.runtimeExecution, false);
});

test("managed fallback regate orchestrator blocks before planning unsafe fallback", () => {
	const terminal = orchestrateFlowDeskManagedFallbackRegateV1({
		decision: fallbackDecision({ depth: 2 }),
		consumedApproval: consumedFallbackApproval(),
	});
	assert.equal(terminal.status, "blocked_before_regate_plan");
	assert.equal(terminal.dispatchAttempted, false);
	assert.equal(terminal.providerSwitchAttempted, false);
	assert.equal(terminal.sdkCallAttempted, false);
	assert.deepEqual(terminal.safeNextActions, ["/flowdesk-status"]);
	assert.match(
		terminal.redactedBlockReason ?? "",
		/max-depth|requires_full_regate/,
	);
	assert.equal(terminal.authority.freshRegatePlanPrepared, false);
	assert.equal(terminal.authority.providerCall, false);

	const drift = orchestrateFlowDeskManagedFallbackRegateV1({
		decision: fallbackDecision(),
		consumedApproval: consumedFallbackApproval({
			approval_id: "approval-other-123",
		}),
	});
	assert.equal(drift.status, "blocked_before_regate_plan");
	assert.match(drift.redactedBlockReason ?? "", /approval ref mismatch/);
	assert.equal(drift.authority.automaticFallbackAuthorized, false);
});

test("controlled external write adapter readies only redacted allowed targets", () => {
	const result = prepareFlowDeskControlledExternalWriteAdapterV1({
		request: controlledExternalWriteRequest(),
		consumedApproval: consumedExternalWriteApproval(),
	});

	assert.equal(result.status, "write_ready");
	assert.equal(result.writeAttempted, false);
	assert.equal(result.workflowId, "workflow-123");
	assert.equal(result.attemptId, "attempt-123");
	assert.equal(result.targetKind, "release_conformance_doc");
	assert.equal(result.targetRef, "release-conformance-doc-123");
	assert.deepEqual(result.safeNextActions, [
		"/flowdesk-status",
		"/flowdesk-export-debug",
	]);
	assert.equal(result.authority.controlledExternalWriteAuthorized, true);
	assert.equal(result.authority.realOpenCodeDispatch, false);
	assert.equal(result.authority.providerCall, false);
	assert.equal(result.authority.actualLaneLaunch, false);
	assert.equal(result.authority.runtimeExecution, false);
});

test("controlled external write adapter blocks forbidden targets before write", () => {
	const forbiddenTarget = prepareFlowDeskControlledExternalWriteAdapterV1({
		request: controlledExternalWriteRequest({
			target_ref: "github-path-target",
		}),
		consumedApproval: consumedExternalWriteApproval(),
	});
	assert.equal(forbiddenTarget.status, "blocked_before_write");
	assert.equal(forbiddenTarget.writeAttempted, false);
	assert.deepEqual(forbiddenTarget.safeNextActions, ["/flowdesk-status"]);
	assert.match(
		forbiddenTarget.redactedBlockReason ?? "",
		/GitHub|target_ref|raw path/,
	);
	assert.equal(
		forbiddenTarget.authority.controlledExternalWriteAuthorized,
		false,
	);
	assert.equal(forbiddenTarget.authority.providerCall, false);

	const wrongApproval = prepareFlowDeskControlledExternalWriteAdapterV1({
		request: controlledExternalWriteRequest(),
		consumedApproval: consumedApproval(),
	});
	assert.equal(wrongApproval.status, "blocked_before_write");
	assert.match(wrongApproval.redactedBlockReason ?? "", /action_type mismatch/);
	assert.equal(wrongApproval.authority.actualLaneLaunch, false);
});

test("controlled conformance doc local writer records doc and ledger after write_ready", async () => {
	await withTempRoot(async (rootDir) => {
		const documentMarkdown = [
			"# Release 3 Controlled Local Write",
			"",
			"Result: local-only conformance document materialized with ledger evidence.",
			"",
		].join("\n");
		const request = controlledExternalWriteRequest({
			content_hash_ref: sha256Ref(documentMarkdown),
		});
		const consumedApproval = consumedExternalWriteApproval();
		const readiness = prepareFlowDeskControlledExternalWriteAdapterV1({
			request,
			consumedApproval,
		});

		const result = materializeFlowDeskControlledConformanceDocLocalWriteV1({
			rootDir,
			readiness,
			request,
			consumedApproval,
			ledgerEntryId: "controlled-doc-write-123",
			documentMarkdown,
			materializedAt: now,
		});

		assert.equal(result.status, "write_recorded");
		assert.equal(result.writeAttempted, true);
		assert.equal(
			result.documentPath,
			"docs/conformance/release-conformance-doc-123.md",
		);
		assert.equal(result.ledgerEntryId, "controlled-doc-write-123");
		assert.equal(result.ledgerEvidenceReloaded, true);
		assert.equal(result.artifactSha256Ref, sha256Ref(documentMarkdown));
		assert.equal(result.authority.localConformanceDocWriteRecorded, true);
		assert.equal(result.authority.controlledExternalWriteAuthorized, true);
		assert.equal(result.authority.remoteWriteAttempted, false);
		assert.equal(result.authority.githubWriteAttempted, false);
		assert.equal(result.authority.connectorWriteAttempted, false);
		assert.equal(result.authority.storageWriteAttempted, false);
		assert.equal(result.authority.databaseWriteAttempted, false);
		assert.equal(result.authority.urlWriteAttempted, false);
		assert.equal(result.authority.rawPathWriteAttempted, false);
		assert.equal(result.authority.realOpenCodeDispatch, false);
		assert.equal(result.authority.providerCall, false);
		assert.equal(result.authority.actualLaneLaunch, false);
		assert.equal(result.authority.runtimeExecution, false);
		assert.equal(
			readFileSync(join(rootDir, result.documentPath), "utf8"),
			documentMarkdown,
		);
		const reloaded = reloadFlowDeskSessionEvidenceV1({
			workflowId: "workflow-123",
			rootDir,
		});
		const ledger = reloaded.entries.find(
			(entry) => entry.evidenceClass === "controlled_conformance_doc_write",
		);
		assert.ok(ledger);
		assert.equal(ledger.evidenceId, "controlled-doc-write-123");
		assert.equal(ledger.record.artifact_path, result.documentPath);
		assert.equal(ledger.record.content_hash_ref, sha256Ref(documentMarkdown));
	});
});

test("controlled conformance doc local writer fails closed before unsafe writes", async () => {
	await withTempRoot(async (rootDir) => {
		const documentMarkdown = "# Controlled local write\n";
		const request = controlledExternalWriteRequest({
			content_hash_ref: sha256Ref(documentMarkdown),
		});
		const consumedApproval = consumedExternalWriteApproval();
		const readiness = prepareFlowDeskControlledExternalWriteAdapterV1({
			request,
			consumedApproval,
		});
		const blockedReadiness =
			materializeFlowDeskControlledConformanceDocLocalWriteV1({
				rootDir,
				readiness: { ...readiness, status: "blocked_before_write" },
				request,
				consumedApproval,
				ledgerEntryId: "controlled-doc-write-blocked-1",
				documentMarkdown,
				materializedAt: now,
			});
		assert.equal(blockedReadiness.status, "blocked_before_local_write");
		assert.equal(blockedReadiness.writeAttempted, false);
		assert.equal(
			blockedReadiness.authority.localConformanceDocWriteRecorded,
			false,
		);

		const wrongTarget = materializeFlowDeskControlledConformanceDocLocalWriteV1(
			{
				rootDir,
				readiness,
				request: controlledExternalWriteRequest({
					target_kind: "redacted_audit_export",
					content_hash_ref: sha256Ref(documentMarkdown),
				}),
				consumedApproval,
				ledgerEntryId: "controlled-doc-write-blocked-2",
				documentMarkdown,
				materializedAt: now,
			},
		);
		assert.equal(wrongTarget.status, "blocked_before_local_write");
		assert.match(
			wrongTarget.redactedBlockReason ?? "",
			/release_conformance_doc|readiness/,
		);

		const hashMismatch =
			materializeFlowDeskControlledConformanceDocLocalWriteV1({
				rootDir,
				readiness,
				request: controlledExternalWriteRequest({
					content_hash_ref: "sha256-mismatch",
				}),
				consumedApproval,
				ledgerEntryId: "controlled-doc-write-blocked-3",
				documentMarkdown,
				materializedAt: now,
			});
		assert.equal(hashMismatch.status, "blocked_before_local_write");
		assert.match(hashMismatch.redactedBlockReason ?? "", /content_hash_ref/);
		assert.equal(hashMismatch.authority.remoteWriteAttempted, false);
		assert.equal(hashMismatch.authority.githubWriteAttempted, false);

		const malformedEvidenceDir = join(
			rootDir,
			".flowdesk/sessions/workflow-123/evidence/usage-authority",
		);
		mkdirSync(malformedEvidenceDir, { recursive: true });
		writeFileSync(
			join(malformedEvidenceDir, "evidence-malformed.json"),
			"{bad",
			"utf8",
		);
		const blockedPreWriteReload =
			materializeFlowDeskControlledConformanceDocLocalWriteV1({
				rootDir,
				readiness,
				request,
				consumedApproval,
				ledgerEntryId: "controlled-doc-write-blocked-4",
				documentMarkdown,
				materializedAt: now,
			});
		assert.equal(blockedPreWriteReload.status, "blocked_before_local_write");
		assert.match(
			blockedPreWriteReload.redactedBlockReason ?? "",
			/pre-write evidence reload failed/,
		);
		assert.equal(blockedPreWriteReload.writeAttempted, false);

		const reloaded = reloadFlowDeskSessionEvidenceV1({
			workflowId: "workflow-123",
			rootDir,
		});
		assert.equal(reloaded.entries.length, 0);
	});
});

test("controlled redacted audit export local writer records export and ledger after write_ready", async () => {
	await withTempRoot(async (rootDir) => {
		const exportJson = JSON.stringify({
			schema_version: "flowdesk.redacted_audit_export.v1",
			workflow_id: "workflow-123",
			attempt_id: "attempt-123",
			redaction_policy_ref: "redaction-policy-123",
			events: [
				{
					event_ref: "event-audit-123",
					summary_label: "guarded local audit export materialized",
				},
			],
		});
		const request = controlledExternalWriteRequest({
			target_kind: "redacted_audit_export",
			target_ref: "redacted-audit-export-123",
			content_hash_ref: sha256Ref(exportJson),
		});
		const consumedApproval = consumedExternalWriteApproval();
		const readiness = prepareFlowDeskControlledExternalWriteAdapterV1({
			request,
			consumedApproval,
		});

		const result = materializeFlowDeskControlledRedactedAuditExportLocalWriteV1(
			{
				rootDir,
				readiness,
				request,
				consumedApproval,
				ledgerEntryId: "controlled-audit-export-write-123",
				exportJson,
				materializedAt: now,
			},
		);

		assert.equal(result.status, "write_recorded");
		assert.equal(result.writeAttempted, true);
		assert.equal(
			result.exportPath,
			".flowdesk/sessions/workflow-123/redacted-audit/redacted-audit-export-123.json",
		);
		assert.equal(result.ledgerEntryId, "controlled-audit-export-write-123");
		assert.equal(result.ledgerEvidenceReloaded, true);
		assert.equal(result.artifactSha256Ref, sha256Ref(exportJson));
		assert.equal(result.authority.localRedactedAuditExportWriteRecorded, true);
		assert.equal(result.authority.controlledExternalWriteAuthorized, true);
		assert.equal(result.authority.remoteWriteAttempted, false);
		assert.equal(result.authority.githubWriteAttempted, false);
		assert.equal(result.authority.connectorWriteAttempted, false);
		assert.equal(result.authority.storageWriteAttempted, false);
		assert.equal(result.authority.databaseWriteAttempted, false);
		assert.equal(result.authority.urlWriteAttempted, false);
		assert.equal(result.authority.rawPathWriteAttempted, false);
		assert.equal(result.authority.realOpenCodeDispatch, false);
		assert.equal(result.authority.providerCall, false);
		assert.equal(result.authority.actualLaneLaunch, false);
		assert.equal(result.authority.runtimeExecution, false);
		assert.equal(
			readFileSync(join(rootDir, result.exportPath), "utf8"),
			exportJson,
		);
		const reloaded = reloadFlowDeskSessionEvidenceV1({
			workflowId: "workflow-123",
			rootDir,
		});
		const ledger = reloaded.entries.find(
			(entry) =>
				entry.evidenceClass === "controlled_redacted_audit_export_write",
		);
		assert.ok(ledger);
		assert.equal(ledger.evidenceId, "controlled-audit-export-write-123");
		assert.equal(ledger.record.artifact_path, result.exportPath);
		assert.equal(ledger.record.content_hash_ref, sha256Ref(exportJson));
		assert.equal(ledger.record.redacted, true);
	});
});

test("controlled redacted audit export local writer fails closed before unsafe writes", async () => {
	await withTempRoot(async (rootDir) => {
		const exportJson = JSON.stringify({
			schema_version: "flowdesk.redacted_audit_export.v1",
			workflow_id: "workflow-123",
			attempt_id: "attempt-123",
			summary_label: "redacted audit export ready",
		});
		const request = controlledExternalWriteRequest({
			target_kind: "redacted_audit_export",
			target_ref: "redacted-audit-export-123",
			content_hash_ref: sha256Ref(exportJson),
		});
		const consumedApproval = consumedExternalWriteApproval();
		const readiness = prepareFlowDeskControlledExternalWriteAdapterV1({
			request,
			consumedApproval,
		});

		const blockedReadiness =
			materializeFlowDeskControlledRedactedAuditExportLocalWriteV1({
				rootDir,
				readiness: { ...readiness, status: "blocked_before_write" },
				request,
				consumedApproval,
				ledgerEntryId: "controlled-audit-export-write-blocked-1",
				exportJson,
				materializedAt: now,
			});
		assert.equal(blockedReadiness.status, "blocked_before_local_write");
		assert.equal(blockedReadiness.writeAttempted, false);
		assert.equal(
			blockedReadiness.authority.localRedactedAuditExportWriteRecorded,
			false,
		);

		const wrongTarget =
			materializeFlowDeskControlledRedactedAuditExportLocalWriteV1({
				rootDir,
				readiness,
				request: controlledExternalWriteRequest({
					content_hash_ref: sha256Ref(exportJson),
				}),
				consumedApproval,
				ledgerEntryId: "controlled-audit-export-write-blocked-2",
				exportJson,
				materializedAt: now,
			});
		assert.equal(wrongTarget.status, "blocked_before_local_write");
		assert.match(
			wrongTarget.redactedBlockReason ?? "",
			/redacted_audit_export|readiness/,
		);

		const hashMismatch =
			materializeFlowDeskControlledRedactedAuditExportLocalWriteV1({
				rootDir,
				readiness,
				request: controlledExternalWriteRequest({
					target_kind: "redacted_audit_export",
					target_ref: "redacted-audit-export-123",
					content_hash_ref: "sha256-mismatch",
				}),
				consumedApproval,
				ledgerEntryId: "controlled-audit-export-write-blocked-3",
				exportJson,
				materializedAt: now,
			});
		assert.equal(hashMismatch.status, "blocked_before_local_write");
		assert.match(hashMismatch.redactedBlockReason ?? "", /content_hash_ref/);
		assert.equal(hashMismatch.authority.remoteWriteAttempted, false);
		assert.equal(hashMismatch.authority.githubWriteAttempted, false);

		const rawPayload =
			materializeFlowDeskControlledRedactedAuditExportLocalWriteV1({
				rootDir,
				readiness,
				request,
				consumedApproval,
				ledgerEntryId: "controlled-audit-export-write-blocked-4",
				exportJson: JSON.stringify({ raw_log: "developer message" }),
				materializedAt: now,
			});
		assert.equal(rawPayload.status, "blocked_before_local_write");
		assert.match(
			rawPayload.redactedBlockReason ?? "",
			/raw payload|prompt-like/,
		);

		const malformedEvidenceDir = join(
			rootDir,
			".flowdesk/sessions/workflow-123/evidence/usage-authority",
		);
		mkdirSync(malformedEvidenceDir, { recursive: true });
		writeFileSync(
			join(malformedEvidenceDir, "evidence-malformed.json"),
			"{bad",
			"utf8",
		);
		const blockedPreWriteReload =
			materializeFlowDeskControlledRedactedAuditExportLocalWriteV1({
				rootDir,
				readiness,
				request,
				consumedApproval,
				ledgerEntryId: "controlled-audit-export-write-blocked-5",
				exportJson,
				materializedAt: now,
			});
		assert.equal(blockedPreWriteReload.status, "blocked_before_local_write");
		assert.match(
			blockedPreWriteReload.redactedBlockReason ?? "",
			/pre-write evidence reload failed/,
		);
		assert.equal(blockedPreWriteReload.writeAttempted, false);

		const reloaded = reloadFlowDeskSessionEvidenceV1({
			workflowId: "workflow-123",
			rootDir,
		});
		assert.equal(reloaded.entries.length, 0);
	});
});

test("permission ask control adapter applies deny without provider calls", () => {
	const output = { status: "ask" as const };
	const result = applyFlowDeskPermissionAskControlV1({
		decision: permissionAskDecision(),
		output,
	});

	assert.equal(result.status, "permission_status_applied");
	assert.equal(output.status, "deny");
	assert.equal(result.authority.permissionAskStatusControlAuthorized, true);
	assert.equal(result.authority.providerCall, false);
	assert.equal(result.authority.runtimeExecution, false);
});

test("permission ask control adapter blocks malformed status authority", () => {
	const output = { status: "ask" as const };
	const result = applyFlowDeskPermissionAskControlV1({
		decision: {
			...permissionAskDecision({ status: "allow", deny_reason: undefined }),
			hardCancelOrNoReplyAuthority: true,
		} as unknown as FlowDeskPermissionAskDecisionV1,
		output,
	});

	assert.equal(result.status, "blocked_before_permission_status");
	assert.equal(output.status, "ask");
	assert.equal(result.authority.permissionAskStatusControlAuthorized, false);
});

test("session abort control adapter calls SDK abort only after decision validation", async () => {
	const { client, abortCalls } = fakeClient();
	const result = await abortFlowDeskSessionWithDecisionV1({
		client,
		decision: sessionAbortDecision(),
		directory: "/tmp/flowdesk-project",
	});

	assert.equal(result.status, "session_abort_sent");
	assert.equal(result.abortAttempted, true);
	assert.equal(result.authority.sessionAbortAuthorized, true);
	assert.equal(result.authority.providerCall, false);
	assert.equal(abortCalls.length, 1);
	assert.deepEqual(abortCalls[0], {
		sessionID: "session-123",
		query: { directory: "/tmp/flowdesk-project" },
	});
});

test("prompt no-reply control adapter sends SDK noReply without lane authority", async () => {
	const { client, promptCalls, promptAsyncCalls } = fakeClient();
	const result = await dispatchFlowDeskPromptNoReplyWithDecisionV1({
		client,
		decision: promptNoReplyDecision(),
		request: dispatchRequest({ dispatchMethod: "prompt" }),
	});

	assert.equal(result.status, "no_reply_prompt_sent");
	assert.equal(result.promptAttempted, true);
	assert.equal(result.authority.promptNoReplyAuthorized, true);
	assert.equal(result.authority.providerCall, true);
	assert.equal(result.authority.actualLaneLaunch, false);
	assert.equal(result.authority.hardCancelOrNoReplyAuthority, false);
	assert.equal(promptCalls.length, 1);
	assert.equal(promptAsyncCalls.length, 0);
	assert.equal(promptCalls[0].body.noReply, true);
	assert.deepEqual(promptCalls[0].body.model, {
		providerID: "anthropic",
		modelID: "sonnet-4",
	});
	assert.equal(/tools|cancel/.test(JSON.stringify(promptCalls[0])), false);
});

test("prompt no-reply control adapter blocks mismatched session decisions", async () => {
	const { client, promptCalls, promptAsyncCalls } = fakeClient();
	const result = await dispatchFlowDeskPromptNoReplyWithDecisionV1({
		client,
		decision: promptNoReplyDecision({ session_ref: "session-other" }),
		request: dispatchRequest({ dispatchMethod: "prompt" }),
	});

	assert.equal(result.status, "blocked_before_no_reply_prompt");
	assert.equal(result.promptAttempted, false);
	assert.equal(result.authority.promptNoReplyAuthorized, false);
	assert.equal(promptCalls.length, 0);
	assert.equal(promptAsyncCalls.length, 0);
});

test("prompt no-reply control adapter blocks mismatched agent and model decisions", async () => {
	const { client, promptCalls, promptAsyncCalls } = fakeClient();
	const agentMismatch = await dispatchFlowDeskPromptNoReplyWithDecisionV1({
		client,
		decision: promptNoReplyDecision({ agent_ref: "agent-reviewer" }),
		request: dispatchRequest({ dispatchMethod: "prompt" }),
	});
	const modelMismatch = await dispatchFlowDeskPromptNoReplyWithDecisionV1({
		client,
		decision: promptNoReplyDecision({
			provider_qualified_model_id: "openai/gpt-5.5",
		}),
		request: dispatchRequest({ dispatchMethod: "prompt" }),
	});

	assert.equal(agentMismatch.status, "blocked_before_no_reply_prompt");
	assert.equal(modelMismatch.status, "blocked_before_no_reply_prompt");
	assert.equal(promptCalls.length, 0);
	assert.equal(promptAsyncCalls.length, 0);
});

test("managed dispatch beta adapter maps FlowDesk Claude binding to OpenCode Anthropic provider", async () => {
	await withTempRoot(async (rootDir) => {
		writeWorkingModels(rootDir);
		const { client, promptCalls, promptAsyncCalls } = fakeClient();
		const reservation = fakeReservationStore();
		const result = await dispatchManagedDispatchBetaPromptV1({
			client,
			boundaryInput: managedDispatchInput(),
			request: dispatchRequest(),
			dispatchManifest: dispatchManifest(),
			reloadedEvidence: reloadedEvidence(),
			reservationStore: reservation.store,
			durableStateRootDir: rootDir,
		});

	assert.equal(result.status, "dispatch_accepted");
	assert.equal(result.dispatchAttempted, true);
	assert.equal(result.dispatchMethod, "promptAsync");
	assert.deepEqual(result.model, {
		providerID: "anthropic",
		modelID: "sonnet-4",
	});
	assert.equal(result.authority.realOpenCodeDispatch, true);
	assert.equal(result.authority.providerCall, true);
	assert.equal(result.authority.actualLaneLaunch, false);
	assert.equal(result.authority.fallbackAuthority, false);
	assert.equal(result.authority.toolAuthority, false);
	assert.equal(result.authority.hardCancelOrNoReplyAuthority, false);
	assert.equal(promptCalls.length, 0);
	assert.equal(promptAsyncCalls.length, 1);
	assert.equal(reservation.reserveCalls.length, 1);
	assert.equal(reservation.completedCalls.length, 1);
	assert.equal(reservation.failureCalls.length, 0);
	assert.deepEqual(promptAsyncCalls[0], {
		sessionID: "session-123",
		query: { directory: "/tmp/flowdesk-project" },
		body: {
			model: { providerID: "anthropic", modelID: "sonnet-4" },
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
});

test("managed dispatch beta adapter requires working-model evidence when durable root is available", async () => {
	await withTempRoot(async (rootDir) => {
		writeWorkingModels(rootDir, ["claude/sonnet-4"]);
		const { client, promptCalls, promptAsyncCalls } = fakeClient();
		const reservation = fakeReservationStore();
		const result = await dispatchManagedDispatchBetaPromptV1({
			client,
			boundaryInput: managedDispatchInput(),
			request: dispatchRequest(),
			dispatchManifest: dispatchManifest(),
			reloadedEvidence: reloadedEvidence(),
			reservationStore: reservation.store,
			durableStateRootDir: rootDir,
		});

		assert.equal(result.status, "dispatch_accepted");
		assert.equal(promptCalls.length, 0);
		assert.equal(promptAsyncCalls.length, 1);
		assert.equal(reservation.reserveCalls.length, 1);
	});
});

test("managed dispatch beta adapter can call prompt once for completed dispatch without noReply or tools", async () => {
	await withTempRoot(async (rootDir) => {
		writeWorkingModels(rootDir);
		const { client, promptCalls, promptAsyncCalls } = fakeClient();
		const reservation = fakeReservationStore();
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
			reservationStore: reservation.store,
			durableStateRootDir: rootDir,
		});

	assert.equal(result.status, "dispatch_completed");
	assert.equal(promptCalls.length, 1);
	assert.equal(promptAsyncCalls.length, 0);
	assert.equal(reservation.reserveCalls.length, 1);
	assert.equal(reservation.completedCalls.length, 1);
	assert.equal(reservation.failureCalls.length, 0);
	assert.equal(
		promptCalls[0].body.parts[0]?.text,
		"Summarized approved prompt.",
	);
	assert.deepEqual(promptCalls[0].body.model, {
		providerID: "anthropic",
		modelID: "sonnet-4",
	});
	assert.equal(
		/noReply|cancel|fallback|tools/.test(JSON.stringify(promptCalls[0])),
		false,
	);
	});
});

test("managed dispatch beta adapter requires manifest and durable evidence before fake client calls", async () => {
	const { client, promptCalls, promptAsyncCalls } = fakeClient();
	const missing = await dispatchManagedDispatchBetaPromptV1({
		client,
		boundaryInput: managedDispatchInput(),
		request: dispatchRequest(),
	});
	assert.equal(missing.status, "blocked_before_dispatch");
	assert.match(
		missing.redactedBlockReason,
		/manifest and durable evidence reload/,
	);
	assert.equal(promptCalls.length, 0);
	assert.equal(promptAsyncCalls.length, 0);

	await withTempRoot(async (rootDir) => {
		const blockedClient = fakeClient();
		const blocked = await dispatchManagedDispatchBetaPromptV1({
			client: blockedClient.client,
			boundaryInput: managedDispatchInput(),
			request: dispatchRequest(),
			dispatchManifest: dispatchManifest(),
			reloadedEvidence: reloadedEvidence(),
			reservationStore: fakeReservationStore().store,
			durableStateRootDir: rootDir,
		});

		assert.equal(blocked.status, "blocked_before_dispatch");
		assert.match(blocked.redactedBlockReason, /Working-model snapshot is missing/);
		assert.equal(blockedClient.promptCalls.length, 0);
		assert.equal(blockedClient.promptAsyncCalls.length, 0);
	});

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

test("durable reservation store materializes reserved and completed evidence around SDK calls", async () => {
	await withTempRoot(async (rootDir) => {
		writeWorkingModels(rootDir);
		const { client, promptAsyncCalls } = fakeClient();
		const store = createFlowDeskManagedDispatchBetaDurableReservationStoreV1({
			rootDir,
			now: () => new Date(now),
		});
		const result = await dispatchManagedDispatchBetaPromptV1({
			client,
			boundaryInput: managedDispatchInput(),
			request: dispatchRequest(),
			dispatchManifest: dispatchManifest(),
			reloadedEvidence: reloadedEvidence(),
			reservationStore: store,
			durableStateRootDir: rootDir,
		});

		assert.equal(result.status, "dispatch_accepted");
		assert.equal(promptAsyncCalls.length, 1);
		const snapshots = dispatchIdempotencySnapshots(rootDir);
		assert.equal(snapshots.length, 2);
		const reserved = snapshots.find(
			(snapshot) => snapshot.snapshot_ref === "idempotency-attempt-123-reserved",
		);
		const completed = snapshots.find(
			(snapshot) =>
				snapshot.snapshot_ref === "idempotency-attempt-123-dispatch-completed",
		);
		assert.ok(reserved);
		assert.ok(completed);
		assert.deepEqual(reserved.entries, [
			{
				attempt_id: "attempt-123",
				idempotency_key: "idempotency-123",
				state: "reserved",
				recorded_at: now,
			},
		]);
		assert.deepEqual(completed.entries, [
			{
				attempt_id: "attempt-123",
				idempotency_key: "idempotency-123",
				state: "dispatch_completed",
				recorded_at: now,
			},
		]);
	});
});

test("managed dispatch beta can launch an actual runtime lane and persist lifecycle evidence", async () => {
	await withTempRoot(async (rootDir) => {
		writeWorkingModels(rootDir);
		const { client, createCalls, promptAsyncCalls } = fakeRuntimeLaneClient();
		const store = createFlowDeskManagedDispatchBetaDurableReservationStoreV1({
			rootDir,
			now: () => new Date(now),
		});
		const result = await dispatchManagedDispatchBetaPromptV1({
			client,
			boundaryInput: managedDispatchInput(),
			request: dispatchRequest({
				dispatchMode: "lane_launch",
				allowActualLaneLaunch: true,
				sessionId: "parent-123",
				laneId: "lane-managed-dispatch-123",
				laneTitle: "Managed dispatch live lane",
			}),
			dispatchManifest: dispatchManifest(),
			reloadedEvidence: reloadedEvidence(),
			reservationStore: store,
			durableStateRootDir: rootDir,
		});

		assert.equal(result.status, "dispatch_accepted");
		assert.equal(result.dispatchAttempted, true);
		assert.equal(result.authority.actualLaneLaunch, true);
		assert.equal(result.laneId, "lane-managed-dispatch-123");
		assert.equal(result.childSessionRef, "ses-child-123");
		assert.equal(createCalls.length, 1);
		assert.equal(promptAsyncCalls.length, 1);
		const reloaded = reloadFlowDeskSessionEvidenceV1({
			workflowId: "workflow-123",
			rootDir,
		});
		assert.equal(reloaded.ok, true, reloaded.errors.join("; "));
		assert.equal(
			reloaded.entries.some(
				(entry) =>
					entry.evidenceClass === "lane_lifecycle" &&
					entry.record.lane_id === "lane-managed-dispatch-123" &&
					entry.record.state === "running" &&
					entry.record.child_session_ref === "ses-child-123",
			),
			true,
		);
		assert.equal(
			dispatchIdempotencySnapshots(rootDir).some((snapshot) =>
				snapshot.entries.some((entry) => entry.state === "dispatch_completed"),
			),
			true,
		);
	});
});

test("managed dispatch lane finalize observer terminalizes a lane from captured text without nudge or abort", async () => {
	await withTempRoot(async (rootDir) => {
		const promptCalls: unknown[] = [];
		const abortCalls: unknown[] = [];
		const client = {
			session: {
				messages: async () => ([{ role: "assistant", parts: [
					{ type: "text", text: "Managed dispatch lane produced this final answer." },
					{ type: "step-finish", reason: "stop" },
				] }]),
				prompt: (o: unknown) => { promptCalls.push(o); return Promise.resolve({}); },
				promptAsync: (o: unknown) => { promptCalls.push(o); return Promise.resolve(undefined); },
				abort: (o: unknown) => { abortCalls.push(o); return Promise.resolve(true); },
			},
		} as unknown as FlowDeskManagedDispatchBetaOpenCodeClientV1;

		const result = await observeAndFinalizeManagedDispatchLaneV1({
			client,
			rootDir,
			workflowId: "workflow-123",
			laneId: "lane-managed-dispatch-finalize-1",
			attemptId: "attempt-managed-dispatch-finalize-1",
			childSessionId: "child-md-1",
			agentRef: "agent-reviewer-gpt-frontier",
			providerQualifiedModelId: "openai/gpt-5.5",
		});

		assert.equal(result.status, "lane_finalized");
		assert.equal(result.finalizationReason, "terminal_marker");
		assert.equal(result.completionStatus, "final");
		assert.equal(result.authority.nudgeOrAbortPerformed, false);
		assert.equal(result.authority.realOpenCodeDispatch, false);
		assert.equal(result.authority.providerCall, false);
		// Observation must not nudge or abort the child session.
		assert.equal(promptCalls.length, 0);
		assert.equal(abortCalls.length, 0);

		const reloaded = reloadFlowDeskSessionEvidenceV1({ workflowId: "workflow-123", rootDir });
		const taskResult = reloaded.entries.find(e => e.evidenceClass === "task_result" && (e.record as Record<string, unknown>).lane_id === "lane-managed-dispatch-finalize-1");
		assert.ok(taskResult, "managed-dispatch task_result evidence should be written");
		assert.equal((taskResult.record as Record<string, unknown>).result_text, "Managed dispatch lane produced this final answer.");
		assert.equal((taskResult.record as Record<string, unknown>).missing_contract, false);
		const lifecycle = reloaded.entries.find(e => e.evidenceClass === "lane_lifecycle" && (e.record as Record<string, unknown>).lane_id === "lane-managed-dispatch-finalize-1");
		assert.ok(lifecycle, "terminal lane_lifecycle evidence should be written");
		assert.equal((lifecycle.record as Record<string, unknown>).state, "incomplete");
		const terminalEvidence = JSON.parse(readFileSync(managedDispatchTerminalEvidencePath(rootDir, {
			workflowId: "workflow-123",
			attemptId: "attempt-managed-dispatch-finalize-1",
			laneId: "lane-managed-dispatch-finalize-1",
		}), "utf8")) as Record<string, unknown>;
		assert.equal(terminalEvidence.state, "complete");
		assert.equal(terminalEvidence.terminal_sequence, 1);
		assert.equal(terminalEvidence.task_id, "task-lane-managed-dispatch-finalize-1");
		assert.equal(result.terminalEvidenceId, "terminal-workflow-123-attempt-managed-dispatch-finalize-1-lane-managed-dispatch-finalize-1");

		// Idempotent: a second observation does not duplicate terminal evidence.
		const again = await observeAndFinalizeManagedDispatchLaneV1({
			client,
			rootDir,
			workflowId: "workflow-123",
			laneId: "lane-managed-dispatch-finalize-1",
			attemptId: "attempt-managed-dispatch-finalize-1",
			childSessionId: "child-md-1",
			agentRef: "agent-reviewer-gpt-frontier",
			providerQualifiedModelId: "openai/gpt-5.5",
		});
		assert.equal(again.status, "lane_already_terminal");
	});
});

test("managed dispatch lane finalize observer records no_output when no text is captured", async () => {
	await withTempRoot(async (rootDir) => {
		const client = {
			session: {
				messages: async () => ([]),
				prompt: () => Promise.resolve({}),
				abort: () => Promise.resolve(true),
			},
		} as unknown as FlowDeskManagedDispatchBetaOpenCodeClientV1;

		const result = await observeAndFinalizeManagedDispatchLaneV1({
			client,
			rootDir,
			workflowId: "workflow-123",
			laneId: "lane-managed-dispatch-finalize-empty",
			attemptId: "attempt-managed-dispatch-finalize-empty",
			childSessionId: "child-md-empty",
			agentRef: "agent-x",
			providerQualifiedModelId: "openai/gpt-5.5",
		});

		assert.equal(result.status, "lane_no_output");
		const reloaded = reloadFlowDeskSessionEvidenceV1({ workflowId: "workflow-123", rootDir });
		assert.equal(reloaded.entries.some(e => e.evidenceClass === "task_result" && (e.record as Record<string, unknown>).lane_id === "lane-managed-dispatch-finalize-empty"), false);
		const lifecycle = reloaded.entries.find(e => e.evidenceClass === "lane_lifecycle" && (e.record as Record<string, unknown>).lane_id === "lane-managed-dispatch-finalize-empty");
		assert.ok(lifecycle);
		assert.equal((lifecycle.record as Record<string, unknown>).state, "no_output");
		const terminalEvidence = JSON.parse(readFileSync(managedDispatchTerminalEvidencePath(rootDir, {
			workflowId: "workflow-123",
			attemptId: "attempt-managed-dispatch-finalize-empty",
			laneId: "lane-managed-dispatch-finalize-empty",
		}), "utf8")) as Record<string, unknown>;
		assert.equal(terminalEvidence.state, "no_output");
		assert.equal(terminalEvidence.terminal_sequence, 1);
	});
});

test("managed dispatch lane finalize does not overwrite conflicting terminal evidence", async () => {
	await withTempRoot(async (rootDir) => {
		const laneId = "lane-managed-dispatch-finalize-conflict";
		persistTerminalEvidence({
			rootDir,
			workflowId: "workflow-123",
			attemptId: "attempt-managed-dispatch-finalize-conflict",
			laneId,
			taskId: `task-${laneId}`,
			state: "no_output",
			reason: "response_without_result_text",
		});
		const evidencePath = managedDispatchTerminalEvidencePath(rootDir, {
			workflowId: "workflow-123",
			attemptId: "attempt-managed-dispatch-finalize-conflict",
			laneId,
		});
		const before = readFileSync(evidencePath, "utf8");
		const client = {
			session: {
				messages: async () => ([{ role: "assistant", parts: [
					{ type: "text", text: "Conflicting terminal text." },
					{ type: "step-finish", reason: "stop" },
				] }]),
			},
		} as unknown as FlowDeskManagedDispatchBetaOpenCodeClientV1;

		const result = await observeAndFinalizeManagedDispatchLaneV1({
			client,
			rootDir,
			workflowId: "workflow-123",
			laneId,
			attemptId: "attempt-managed-dispatch-finalize-conflict",
			childSessionId: "child-md-conflict",
			agentRef: "agent-x",
			providerQualifiedModelId: "openai/gpt-5.5",
		});

		assert.equal(result.status, "blocked_before_finalize");
		assert.match(result.redactedBlockReason ?? "", /terminal evidence conflict; quarantine recommended/);
		assert.equal(readFileSync(evidencePath, "utf8"), before);
	});
});

test("durable reservation store preserves existing idempotency ledger entries", async () => {
	await withTempRoot(async (rootDir) => {
		writeWorkingModels(rootDir);
		const { client, promptAsyncCalls } = fakeClient();
		const store = createFlowDeskManagedDispatchBetaDurableReservationStoreV1({
			rootDir,
			now: () => new Date(now),
		});
		const result = await dispatchManagedDispatchBetaPromptV1({
			client,
			boundaryInput: managedDispatchInput(),
			request: dispatchRequest(),
			dispatchManifest: dispatchManifest(),
			reloadedEvidence: reloadedEvidence({
				entries: [
					{
						evidenceClass: "dispatch_idempotency",
						evidenceId: "idempotency-snapshot-previous",
						record: {
							schema_version: "flowdesk.dispatch_idempotency_snapshot.v1",
							workflow_id: "workflow-123",
							snapshot_ref: "idempotency-snapshot-previous",
							observed_at: now,
							entries: [
								{
									attempt_id: "attempt-previous",
									idempotency_key: "idempotency-previous",
									state: "dispatch_completed",
									recorded_at: now,
								},
							],
							dispatch_authority_enabled: false,
							realOpenCodeDispatch: false,
							actualLaneLaunch: false,
							providerCall: false,
							runtimeExecution: false,
						},
						path: ".flowdesk/sessions/workflow-123/evidence/dispatch-idempotency/idempotency-snapshot-previous.json",
					},
					...reloadedEvidence().entries.filter(
						(entry) => entry.evidenceClass !== "dispatch_idempotency",
					),
				],
			}),
			reservationStore: store,
			durableStateRootDir: rootDir,
		});

		assert.equal(result.status, "dispatch_accepted");
		assert.equal(promptAsyncCalls.length, 1);
		const reserved = dispatchIdempotencySnapshots(rootDir).find(
			(snapshot) =>
				snapshot.snapshot_ref === "idempotency-attempt-123-dispatch-completed",
		);
		assert.ok(reserved);
		assert.deepEqual(
			reserved.entries.map((entry) => entry.attempt_id),
			["attempt-previous", "attempt-123"],
		);
	});
});

test("durable reservation store blocks stale replay before SDK calls", async () => {
	await withTempRoot(async (rootDir) => {
		writeWorkingModels(rootDir);
		const store = createFlowDeskManagedDispatchBetaDurableReservationStoreV1({
			rootDir,
			now: () => new Date(now),
		});
		const firstClient = fakeClient();
		const first = await dispatchManagedDispatchBetaPromptV1({
			client: firstClient.client,
			boundaryInput: managedDispatchInput(),
			request: dispatchRequest(),
			dispatchManifest: dispatchManifest(),
			reloadedEvidence: reloadedEvidence(),
			reservationStore: store,
			durableStateRootDir: rootDir,
		});
		assert.equal(first.status, "dispatch_accepted");
		assert.equal(firstClient.promptAsyncCalls.length, 1);

		const replayClient = fakeClient();
		const replay = await dispatchManagedDispatchBetaPromptV1({
			client: replayClient.client,
			boundaryInput: managedDispatchInput(),
			request: dispatchRequest(),
			dispatchManifest: dispatchManifest(),
			reloadedEvidence: reloadedEvidence(),
			reservationStore: store,
			durableStateRootDir: rootDir,
		});
		assert.equal(replay.status, "blocked_before_dispatch");
		assert.match(
			replay.redactedBlockReason,
			/reservation materialization blocked/,
		);
		assert.equal(replayClient.promptCalls.length, 0);
		assert.equal(replayClient.promptAsyncCalls.length, 0);
	});
});

test("durable reservation store records dispatch_failed after SDK failure", async () => {
	await withTempRoot(async (rootDir) => {
		writeWorkingModels(rootDir);
		const { client, promptAsyncCalls } = failingPromptAsyncClient();
		const store = createFlowDeskManagedDispatchBetaDurableReservationStoreV1({
			rootDir,
			now: () => new Date(now),
		});
		const result = await dispatchManagedDispatchBetaPromptV1({
			client,
			boundaryInput: managedDispatchInput(),
			request: dispatchRequest(),
			dispatchManifest: dispatchManifest(),
			reloadedEvidence: reloadedEvidence(),
			reservationStore: store,
			durableStateRootDir: rootDir,
		});

		assert.equal(result.status, "dispatch_failed");
		assert.equal(promptAsyncCalls.length, 1);
		const failed = dispatchIdempotencySnapshots(rootDir).find(
			(snapshot) =>
				snapshot.snapshot_ref === "idempotency-attempt-123-dispatch-failed",
		);
		assert.ok(failed);
		assert.deepEqual(failed.entries, [
			{
				attempt_id: "attempt-123",
				idempotency_key: "idempotency-123",
				state: "dispatch_failed",
				recorded_at: now,
			},
		]);
	});
});

test("managed dispatch beta adapter requires reservation materialization before fake client calls", async () => {
	const missingStoreClient = fakeClient();
	const missingStore = await dispatchManagedDispatchBetaPromptV1({
		client: missingStoreClient.client,
		boundaryInput: managedDispatchInput(),
		request: dispatchRequest(),
		dispatchManifest: dispatchManifest(),
		reloadedEvidence: reloadedEvidence(),
	});
	assert.equal(missingStore.status, "blocked_before_dispatch");
	assert.match(
		missingStore.redactedBlockReason,
		/reservation materialization is required/,
	);
	assert.equal(missingStoreClient.promptCalls.length, 0);
	assert.equal(missingStoreClient.promptAsyncCalls.length, 0);

	const failedReservationClient = fakeClient();
	const reservation = fakeReservationStore({ reserveOk: false });
	const failedReservation = await dispatchManagedDispatchBetaPromptV1({
		client: failedReservationClient.client,
		boundaryInput: managedDispatchInput(),
		request: dispatchRequest(),
		dispatchManifest: dispatchManifest(),
		reloadedEvidence: reloadedEvidence(),
		reservationStore: reservation.store,
	});
	assert.equal(failedReservation.status, "blocked_before_dispatch");
	assert.match(
		failedReservation.redactedBlockReason,
		/reservation materialization blocked/,
	);
	assert.equal(reservation.reserveCalls.length, 1);
	assert.equal(reservation.failureCalls.length, 0);
	assert.equal(failedReservationClient.promptCalls.length, 0);
	assert.equal(failedReservationClient.promptAsyncCalls.length, 0);
});

test("managed dispatch beta adapter records reservation failure state after SDK failure", async () => {
	await withTempRoot(async (rootDir) => {
		writeWorkingModels(rootDir);
		const { client, promptAsyncCalls } = failingPromptAsyncClient();
		const reservation = fakeReservationStore();
		const result = await dispatchManagedDispatchBetaPromptV1({
			client,
			boundaryInput: managedDispatchInput(),
			request: dispatchRequest(),
			dispatchManifest: dispatchManifest(),
			reloadedEvidence: reloadedEvidence(),
			reservationStore: reservation.store,
			durableStateRootDir: rootDir,
		});
		assert.equal(result.status, "dispatch_failed");
		assert.equal(result.dispatchAttempted, true);
		assert.equal(promptAsyncCalls.length, 1);
		assert.equal(reservation.reserveCalls.length, 1);
		assert.equal(reservation.failureCalls.length, 1);
		assert.equal(reservation.failureCalls[0].manifest.attempt_id, "attempt-123");
	});
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
					record: consumedApproval({
						action_type: "reviewer_fanout",
					}) as unknown as Record<string, unknown>,
					path: ".flowdesk/sessions/workflow-123/evidence/production-approval-source/approval-source-123.json",
				},
				{
					evidenceClass: "pre_dispatch_audit",
					evidenceId: "audit-123",
					record: {
						schema_version: "flowdesk.pre_dispatch_audit_record.v1",
						workflow_id: "workflow-123",
						pre_dispatch_audit_ref: "audit-123",
						observed_at: "2026-05-19T00:00:00.000Z",
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
	await withTempRoot(async (rootDir) => {
		writeWorkingModels(rootDir);
		const { client, promptAsyncCalls } = fakeClient();
		const reservation = fakeReservationStore();
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
		[flowdeskManagedDispatchBetaAdapterOption]: {
			enabled: true,
			reservationStore: reservation.store,
		},
		[flowdeskDurableStateRootOption]: rootDir,
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
	assert.equal(reservation.reserveCalls.length, 1);
	});
});

test("default managed-dispatch authorization can register the SDK tool without beta option", async () => {
	await withTempRoot(async (rootDir) => {
		writeWorkingModels(rootDir);
		const { client, promptAsyncCalls } = fakeClient();
		const reservation = fakeReservationStore();
		const hooks = await flowdeskOpenCodeServerPlugin.server(
			{ client, reservationStore: reservation.store } as never,
			{
			[flowdeskDefaultManagedDispatchAuthorizationOption]:
				defaultManagedDispatchAuthorization(),
			[flowdeskDurableStateRootOption]: rootDir,
			localNonDispatchAdapter: false,
			naturalLanguageRouting: false,
			},
		);
	const betaTool = hooks.tool?.[flowdeskManagedDispatchBetaToolName];
	assert.ok(betaTool);
	const doctor = hooks.tool?.[flowdeskPreSpikeDoctorToolName];
	assert.ok(doctor);
	const doctorResult = JSON.parse(
		toolOutput(await doctor.execute({}, undefined as never)),
	) as Record<string, unknown>;
	assert.equal(doctorResult.defaultManagedDispatchRegistrationAuthorized, true);
	assert.equal(
		doctorResult.productionPromotionGate,
		"default_managed_dispatch_authorized_registration_ready",
	);

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
	assert.equal(promptAsyncCalls.length, 1);
	assert.equal(reservation.reserveCalls.length, 1);
	});
});

test("/flowdesk-run managed-dispatch blocks without default authorization", async () => {
	const { client, promptAsyncCalls } = fakeClient();
	const reservation = fakeReservationStore();
	const hooks = await flowdeskOpenCodeServerPlugin.server(
		{ client, reservationStore: reservation.store } as never,
		{
			[flowdeskLocalNonDispatchAdapterOption]: true,
			naturalLanguageRouting: false,
		},
	);
	const runTool = hooks.tool?.flowdesk_run;
	assert.ok(runTool);

	const raw = await runTool.execute(
		{
			schema_version: "flowdesk.run.request.v1",
			request_id: "request-managed-run-no-auth",
			input_mode: "portable_command",
			workflow_id: "workflow-123",
			run_mode: "managed-dispatch",
			plan_revision_id: "plan-123",
			step_id: "step-123",
			managed_dispatch_boundary_input: managedDispatchInput(),
			managed_dispatch_request: dispatchRequest({
				directory: undefined,
				promptText: undefined,
				promptSummary: "Approved bounded step.",
			}),
			managed_dispatch_manifest: dispatchManifest(),
			managed_dispatch_reloaded_evidence: reloadedEvidence(),
		},
		undefined as never,
	);
	const result = JSON.parse(toolOutput(raw)) as Record<string, unknown>;
	assert.equal(
		result.runRouteProfile,
		"flowdesk_run_default_managed_dispatch_route",
	);
	assert.equal(result.status, "blocked_before_dispatch");
	assert.equal(result.dispatchAttempted, false);
	assert.match(
		String(result.redactedBlockReason),
		/default managed-dispatch authorization/,
	);
	assert.equal(promptAsyncCalls.length, 0);
	assert.equal(reservation.reserveCalls.length, 0);
});

test("/flowdesk-run managed-dispatch rejects invalid run envelopes before adapter gates", async () => {
	const { client, promptAsyncCalls } = fakeClient();
	const reservation = fakeReservationStore();
	const hooks = await flowdeskOpenCodeServerPlugin.server(
		{ client, reservationStore: reservation.store } as never,
		{
			[flowdeskDefaultManagedDispatchAuthorizationOption]:
				defaultManagedDispatchAuthorization(),
			[flowdeskLocalNonDispatchAdapterOption]: true,
			naturalLanguageRouting: false,
		},
	);
	const runTool = hooks.tool?.flowdesk_run;
	assert.ok(runTool);

	const raw = await runTool.execute(
		{
			schema_version: "flowdesk.run.request.v1",
			request_id: "request-managed-run-invalid-envelope",
			input_mode: "portable_command",
			workflow_id: "workflow-123",
			run_mode: "managed-dispatch",
			step_id: "step-123",
			managed_dispatch_boundary_input: managedDispatchInput(),
			managed_dispatch_request: dispatchRequest({
				directory: undefined,
				promptText: undefined,
				promptSummary: "Approved bounded step.",
			}),
			managed_dispatch_manifest: dispatchManifest(),
			managed_dispatch_reloaded_evidence: reloadedEvidence(),
		},
		undefined as never,
	);
	const result = JSON.parse(toolOutput(raw)) as Record<string, unknown>;
	assert.equal(
		result.runRouteProfile,
		"flowdesk_run_default_managed_dispatch_route",
	);
	assert.equal(result.status, "blocked_before_dispatch");
	assert.match(
		String(result.redactedBlockReason),
		/valid flowdesk.run.request.v1 envelope/,
	);
	assert.equal(promptAsyncCalls.length, 0);
	assert.equal(reservation.reserveCalls.length, 0);
});

test("/flowdesk-run managed-dispatch routes through default authorization and managed adapter", async () => {
	await withTempRoot(async (rootDir) => {
		writeWorkingModels(rootDir);
		const { client, promptAsyncCalls } = fakeClient();
		const reservation = fakeReservationStore();
		const hooks = await flowdeskOpenCodeServerPlugin.server(
			{ client, reservationStore: reservation.store } as never,
			{
			[flowdeskDefaultManagedDispatchAuthorizationOption]:
				defaultManagedDispatchAuthorization(),
			[flowdeskDurableStateRootOption]: rootDir,
			[flowdeskLocalNonDispatchAdapterOption]: true,
			naturalLanguageRouting: false,
			},
		);
	const runTool = hooks.tool?.flowdesk_run;
	assert.ok(runTool);

	const raw = await runTool.execute(
		{
			schema_version: "flowdesk.run.request.v1",
			request_id: "request-managed-run-authorized",
			input_mode: "portable_command",
			workflow_id: "workflow-123",
			run_mode: "managed-dispatch",
			plan_revision_id: "plan-123",
			step_id: "step-123",
			managed_dispatch_boundary_input: managedDispatchInput(),
			managed_dispatch_request: dispatchRequest({
				directory: undefined,
				promptText: undefined,
				promptSummary: "Approved bounded step.",
			}),
			managed_dispatch_manifest: dispatchManifest(),
			managed_dispatch_reloaded_evidence: reloadedEvidence(),
		},
		undefined as never,
	);
	const result = JSON.parse(toolOutput(raw)) as Record<string, unknown>;
	assert.equal(
		result.runRouteProfile,
		"flowdesk_run_default_managed_dispatch_route",
	);
	assert.equal(
		result.defaultManagedDispatchAuthorizationRef,
		"default-auth-123",
	);
	assert.equal(result.status, "dispatch_accepted");
	assert.equal(result.dispatchAttempted, true);
	assert.equal(result.responseObserved, false);
	assert.equal("response" in result, false);
	assert.equal(promptAsyncCalls.length, 1);
	assert.equal(reservation.reserveCalls.length, 1);
	});
});

test("/flowdesk-run managed-dispatch can derive default authorization from route evidence", async () => {
	await withTempRoot(async (rootDir) => {
		writeWorkingModels(rootDir);
		writeDerivedDefaultAuthorizationEvidence(rootDir);
		const { client, promptAsyncCalls } = fakeClient();
		const reservation = fakeReservationStore();
		const hooks = await flowdeskOpenCodeServerPlugin.server(
			{ client, reservationStore: reservation.store } as never,
			{
				[flowdeskDurableStateRootOption]: rootDir,
				[flowdeskLocalNonDispatchAdapterOption]: true,
				[flowdeskProductionEnablementOption]:
					derivedDefaultAuthorizationProductionEnablement(),
				naturalLanguageRouting: false,
			},
		);
		const doctor = hooks.tool?.[flowdeskPreSpikeDoctorToolName];
		assert.ok(doctor);
		const doctorResult = JSON.parse(
			toolOutput(await doctor.execute({}, undefined as never)),
		) as Record<string, unknown>;
		assert.ok(
			doctorResult.defaultManagedDispatchRegistrationAuthorized === false ||
				doctorResult.defaultManagedDispatchRegistrationAuthorized === "disabled",
			"derived route metadata must not register the beta SDK tool as an explicit default authorization",
		);
		for (const key of [
			"realOpenCodeDispatch",
			"providerCall",
			"runtimeExecution",
			"actualLaneLaunch",
			"hardCancelOrNoReplyAuthority",
		] as const)
			assert.ok(
				doctorResult[key] === false || doctorResult[key] === "disabled",
				`${key} must remain disabled for derived route metadata`,
			);

		const runTool = hooks.tool?.flowdesk_run;
		assert.ok(runTool);
		const raw = await runTool.execute(
			{
				schema_version: "flowdesk.run.request.v1",
				request_id: "request-managed-run-derived-auth",
				input_mode: "portable_command",
				workflow_id: "workflow-123",
				run_mode: "managed-dispatch",
				plan_revision_id: "plan-123",
				step_id: "step-123",
				managed_dispatch_boundary_input: managedDispatchInput(),
				managed_dispatch_request: dispatchRequest({
					directory: undefined,
					promptText: undefined,
					promptSummary: "Approved bounded step.",
				}),
				managed_dispatch_manifest: dispatchManifest(),
				managed_dispatch_reloaded_evidence: reloadedEvidence(),
			},
			undefined as never,
		);
		const result = JSON.parse(toolOutput(raw)) as Record<string, unknown>;
		assert.equal(
			result.runRouteProfile,
			"flowdesk_run_default_managed_dispatch_route",
		);
		assert.equal(
			result.defaultManagedDispatchAuthorizationRef,
			"derived-default-auth-123",
		);
		assert.equal(
			result.defaultManagedDispatchReadinessRef,
			"default-managed-dispatch-default_candidate",
		);
		assert.equal(result.status, "dispatch_accepted");
		assert.equal(result.dispatchAttempted, true);
		assert.equal(result.responseObserved, false);
		assert.equal(promptAsyncCalls.length, 1);
		assert.equal(reservation.reserveCalls.length, 1);
	});
});

test("/flowdesk-run managed-dispatch blocks invalid derived default authorization metadata", async () => {
	await withTempRoot(async (rootDir) => {
		writeWorkingModels(rootDir);
		writeDerivedDefaultAuthorizationEvidence(rootDir);
		const { client, promptAsyncCalls } = fakeClient();
		const reservation = fakeReservationStore();
		const hooks = await flowdeskOpenCodeServerPlugin.server(
			{ client, reservationStore: reservation.store } as never,
			{
				[flowdeskDurableStateRootOption]: rootDir,
				[flowdeskLocalNonDispatchAdapterOption]: true,
				[flowdeskProductionEnablementOption]:
					derivedDefaultAuthorizationProductionEnablement({
						defaultManagedDispatchAuthorizationMetadata: {
							enabled: true,
							authorizationId: "derived-default-auth-invalid",
							actorRef: "actor-ops-123",
							profileRef: "profile-prod-123",
							releaseGateRef: "release-gate-123",
							rollbackRef: "rollback-123",
							createdAt: now,
							expiresAt: "2099-01-01T00:00:00.000Z",
							defaultEnablementRequested: false,
							killSwitchState: "inactive",
							durablePrecallRef: "durable-precall-123",
							adapterProfileRef: "adapter-profile-123",
							sdkClientRef: "sdk-client-123",
							defaultReleaseEnablementRef: "default-release-enable-123",
						},
					}),
				naturalLanguageRouting: false,
			},
		);
		const runTool = hooks.tool?.flowdesk_run;
		assert.ok(runTool);
		const raw = await runTool.execute(
			{
				schema_version: "flowdesk.run.request.v1",
				request_id: "request-managed-run-derived-auth-invalid",
				input_mode: "portable_command",
				workflow_id: "workflow-123",
				run_mode: "managed-dispatch",
				plan_revision_id: "plan-123",
				step_id: "step-123",
				managed_dispatch_boundary_input: managedDispatchInput(),
				managed_dispatch_request: dispatchRequest({
					directory: undefined,
					promptText: undefined,
					promptSummary: "Approved bounded step.",
				}),
				managed_dispatch_manifest: dispatchManifest(),
				managed_dispatch_reloaded_evidence: reloadedEvidence(),
			},
			undefined as never,
		);
		const result = JSON.parse(toolOutput(raw)) as Record<string, unknown>;
		assert.equal(
			result.runRouteProfile,
			"flowdesk_run_default_managed_dispatch_route",
		);
		assert.equal(result.status, "blocked_before_dispatch");
		assert.equal(result.dispatchAttempted, false);
		assert.match(
			String(result.redactedBlockReason),
			/default managed-dispatch authorization/,
		);
		assert.equal(
			result.defaultManagedDispatchAuthorizationRef,
			"derived-default-auth-invalid",
		);
		assert.equal(
			result.defaultManagedDispatchReadinessRef,
			"default-managed-dispatch-default_candidate",
		);
		assert.deepEqual(result.authority, {
			productionRegistrationEligible: false,
			dispatchApprovalEligible: false,
			realOpenCodeDispatch: false,
			actualLaneLaunch: false,
			providerCall: false,
			runtimeExecution: false,
			fallbackAuthority: false,
			hardCancelOrNoReplyAuthority: false,
			toolAuthority: false,
		});
		assert.equal(promptAsyncCalls.length, 0);
		assert.equal(reservation.reserveCalls.length, 0);
	});
});

test("default managed-dispatch authorization gate blocks registration when forged or disabled", async () => {
	const { client } = fakeClient();
	const hooks = await flowdeskOpenCodeServerPlugin.server({ client } as never, {
		[flowdeskDefaultManagedDispatchAuthorizationOption]: {
			...defaultManagedDispatchAuthorization(),
			state: "blocked",
			default_managed_dispatch_authority_enabled: true,
		},
		localNonDispatchAdapter: false,
		naturalLanguageRouting: false,
	});
	assert.equal(
		Object.keys(hooks.tool ?? {}).includes(flowdeskManagedDispatchBetaToolName),
		false,
	);
	const doctor = hooks.tool?.[flowdeskPreSpikeDoctorToolName];
	assert.ok(doctor);
	const doctorResult = JSON.parse(
		toolOutput(await doctor.execute({}, undefined as never)),
	) as Record<string, unknown>;
	assert.equal(
		doctorResult.defaultManagedDispatchRegistrationAuthorized,
		false,
	);
});

test("managed dispatch beta server can build durable reservation store from state root", async () => {
	await withTempRoot(async (rootDir) => {
		writeWorkingModels(rootDir);
		const { client, promptAsyncCalls } = fakeClient();
		const hooks = await flowdeskOpenCodeServerPlugin.server(
			{ client } as never,
			{
				[flowdeskManagedDispatchBetaAdapterOption]: { enabled: true },
				[flowdeskDurableStateRootOption]: rootDir,
				localNonDispatchAdapter: false,
				naturalLanguageRouting: false,
			},
		);
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
		assert.equal(promptAsyncCalls.length, 1);
		const snapshots = dispatchIdempotencySnapshots(rootDir);
		assert.equal(snapshots.length, 2);
		assert.equal(
			snapshots.some((snapshot) =>
				snapshot.entries.some((entry) => entry.state === "reserved"),
			),
			true,
		);
		assert.equal(
			snapshots.some((snapshot) =>
				snapshot.entries.some((entry) => entry.state === "dispatch_completed"),
			),
			true,
		);
	});
});

test("managed dispatch beta server reloads durable evidence from state root", async () => {
	await withTempRoot(async (rootDir) => {
		writeWorkingModels(rootDir);
		const { client, promptAsyncCalls } = fakeClient();
		const durableEvidence = reloadedEvidence();
		const intents = durableEvidence.entries.map((entry) => {
			const prepared = prepareFlowDeskSessionEvidenceWriteIntentV1({
				workflowId: "workflow-123",
				evidenceId: entry.evidenceId,
				record: entry.record,
			});
			assert.equal(prepared.ok, true, prepared.errors.join("; "));
			assert.ok(prepared.writeIntent);
			return prepared.writeIntent;
		});
		const applied = applyFlowDeskSessionEvidenceWriteIntentsV1(
			rootDir,
			intents,
		);
		assert.equal(applied.ok, true, applied.errors.join("; "));

		const hooks = await flowdeskOpenCodeServerPlugin.server(
			{ client } as never,
			{
				[flowdeskManagedDispatchBetaAdapterOption]: { enabled: true },
				[flowdeskDurableStateRootOption]: rootDir,
				localNonDispatchAdapter: false,
				naturalLanguageRouting: false,
			},
		);
		const betaTool = hooks.tool?.[flowdeskManagedDispatchBetaToolName];
		assert.ok(betaTool);

		const raw = await betaTool.execute(
			{
				boundaryInput: managedDispatchInput(),
				request: dispatchRequest(),
				dispatchManifest: dispatchManifest(),
			},
			undefined as never,
		);
		const result = JSON.parse(toolOutput(raw)) as Record<string, unknown>;
		assert.equal(result.status, "dispatch_accepted");
		assert.equal(result.dispatchAttempted, true);
		assert.equal(promptAsyncCalls.length, 1);
		const snapshots = dispatchIdempotencySnapshots(rootDir);
		assert.equal(snapshots.length, 3);
		assert.equal(
			snapshots.some((snapshot) =>
				snapshot.entries.some((entry) => entry.state === "reserved"),
			),
			true,
		);
		assert.equal(
			snapshots.some((snapshot) =>
				snapshot.entries.some((entry) => entry.state === "dispatch_completed"),
			),
			true,
		);
	});
});
