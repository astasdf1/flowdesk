import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import {
	mkdirSync,
	mkdtempSync,
	// readFileSync, // Not needed in test file after fix
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
	flowdeskAbortCmdToolName,
	flowdeskChatIntakeToolName,
	flowdeskCheckToolName,
	flowdeskDebugToolName,
	flowdeskDefaultManagedDispatchAuthorizationOption,
	flowdeskDurableStateRootOption,
	flowdeskLocalNonDispatchAdapterOption,
	flowdeskManagedDispatchBetaAdapterOption,
	flowdeskManagedDispatchBetaToolName,
	flowdeskPlanShortToolName,
	flowdeskPreSpikeDoctorToolName,
	flowdeskProductionEnablementOption,
	flowdeskResumeStatusToolName,
	flowdeskRetryDiagToolName,
	flowdeskRunShortToolName,
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

function release2GateReadyResult() {
	return {
		schema_version:
			"flowdesk.release2_managed_dispatch_gate_promotion_readiness.v1",
		workflow_id: "workflow-123",
		ok: true,
		errors: [],
		state: "eligible",
		blocked_labels: [],
		evidence_refs: ["phase6a-closure-evidence-123"],
		production_enablement_state: "dispatch_capable",
		managed_dispatch_ready: true,
		phase6a_closed: true,
		scoped_explicit_approval_present: true,
		fresh_evidence_present: true,
		release2_managed_dispatch_gate_ready: true,
		dispatch_authority_enabled: false,
		fallback_authority_enabled: false,
		hard_chat_authority_enabled: false,
		external_write_authority_enabled: false,
		providerCall: false,
		actualLaneLaunch: false,
		runtimeExecution: false,
		safe_next_actions: ["/flowdesk-status"],
		phase6a_closure_ref: "phase6a-closure-123",
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

function writeWorkingModels(rootDir: string, ids: readonly string[] = ["claude/sonnet-4"]): void {
    const modelAvailabilityDir = join(rootDir, ".flowdesk", "model-availability");
    mkdirSync(modelAvailabilityDir, { recursive: true });
    writeFileSync(
        join(modelAvailabilityDir, "working-models.json"),
        JSON.stringify({ models: ids }),
        "utf8",
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

function dispatchableUsage(
	overrides: Partial<FlowDeskUsageSnapshotV1> = {},
): FlowDeskUsageSnapshotV1 {
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
		...overrides,
	};
}

function dispatchableHealth(
	overrides: Partial<FlowDeskProviderHealthSnapshotV1> = {},
): FlowDeskProviderHealthSnapshotV1 {
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
		...overrides,
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
		attempt_id: "attempt-123",
		lane_id: "lane-reviewer-123",
		lane_plan_ref: "lane-plan-123",
		binding_ref: "binding-reviewer-123",
		perspective: "policy_security",
		source: "claude_opus",
		created_at: now,
		scored_at: now,
		redaction_version: "redaction-v1",
		findings: [],
		evidence_refs: ["lane-evidence-123"],
		uncertainty: "low",
		required_fixes: [],
		verdict_label: "pass",
		safe_next_actions: ["/flowdesk-status"],
		dispatch_authority_enabled: false,
		guard_replacement_authority_enabled: false,
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
		providerQualifiedModelId: overrides.provider_qualified_model_id ?? "claude/sonnet-4",
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
			kill_switch_state: "inactive",
			durablePrecallRef: "durable-precall-123",
			adapterProfileRef: "adapter-profile-123",
			sdkClientRef: "sdk-client-123",
			defaultReleaseEnablementRef: "default-release-enable-123",
			release2GateReadinessRef: "release2-gate-readiness-123",
			release2GateReadinessResult: release2GateReadyResult(),
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
			parentSessionId: "completely-different-session", // Intentionally mismatched from plan's ses-parent-123
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
		assert.match(
			String(duplicate.redactedBlockReason),
			/lane lifecycle evidence already exists/,
		);
		assert.equal(duplicate.writeAttempted, false);
	});
});

test("managed dispatch beta adapter blocks without configured durable reservation store", async () => {
	const { client } = fakeClient();
	const result = await dispatchManagedDispatchBetaPromptV1({
		client,
		boundaryInput: managedDispatchInput(),
		request: dispatchRequest(),
		reservationStore: undefined,
		durableStateRootDir: "/tmp/flowdesk-project",
	});

	assert.equal(result.status, "blocked_before_dispatch");
	assert.equal(result.dispatchAttempted, false);
	assert.match(
		String(result.redactedBlockReason),
		/Dispatch attempt manifest and durable evidence reload are required/,
	);
});

test("managed dispatch beta adapter blocks on reservation store failure", async () => {
	const { client } = fakeClient();
	const { store: reservationStore } = fakeReservationStore({ reserveOk: false });
	const result = await dispatchManagedDispatchBetaPromptV1({
		client,
		boundaryInput: managedDispatchInput(),
		request: dispatchRequest(),
		reservationStore,
		durableStateRootDir: "/tmp/flowdesk-project",
	});

	assert.equal(result.status, "blocked_before_dispatch");
	assert.equal(result.dispatchAttempted, false);
	assert.match(String(result.redactedBlockReason), /Dispatch attempt manifest and durable evidence reload are required/);
});

test("workingModelCacheAllowsDispatch blocks when working-models.json is missing", async () => {
    await withTempRoot(async (rootDir) => {
        const { client } = fakeClient();
        // Do not call writeWorkingModels, simulating missing file
        const result = await dispatchManagedDispatchBetaPromptV1({
            client,
            boundaryInput: managedDispatchInput(),
            request: dispatchRequest({ directory: rootDir }),
            durableStateRootDir: rootDir, // Pass rootDir here so the adapter can find the .flowdesk directory
            dispatchManifest: dispatchManifest(), // Provide manifest
            reloadedEvidence: reloadedEvidence(), // Provide reloaded evidence
        });

        assert.equal(result.status, "blocked_before_dispatch");
        assert.match(String(result.redactedBlockReason), /working-model cache missing/);
    });
});

test("workingModelCacheAllowsDispatch blocks when working-models.json is empty", async () => {
    await withTempRoot(async (rootDir) => {
        writeWorkingModels(rootDir, []); // Write empty working-models.json
        const { client } = fakeClient();
        const result = await dispatchManagedDispatchBetaPromptV1({
            client,
            boundaryInput: managedDispatchInput(),
            request: dispatchRequest({ directory: rootDir }),
            durableStateRootDir: rootDir,
            dispatchManifest: dispatchManifest(), // Provide manifest
            reloadedEvidence: reloadedEvidence(), // Provide reloaded evidence
        });

        assert.equal(result.status, "blocked_before_dispatch");
        assert.match(String(result.redactedBlockReason), /working-model cache missing – run models refresh first/); // Adjusted regex
    });
});

test("workingModelCacheAllowsDispatch blocks unsupported model even when in working-models.json", async () => {
    await withTempRoot(async (rootDir) => {
        const unsupportedModel = "openai/fake-unsupported-model-xyz";
        writeWorkingModels(rootDir, [unsupportedModel]);
        const { client } = fakeClient();

        // Unique IDs for this specific test case
        const testWorkflowId = "workflow-test-unsupported-model";
        const testAttemptId = "attempt-test-unsupported-model";
        const guardDecisionId = "guard-decision-unsupported";
        const approvalSourceId = "approval-source-unsupported";
        const usageSnapshotRef = `usage-snapshot-${unsupportedModel.replace("/", "-")}`;
        const providerFamily = unsupportedModel.split('/')[0] as "openai";
        const healthSnapshotRef = `health-snapshot-${unsupportedModel.replace("/", "-")}`;
        const preDispatchAuditRef = `audit-${unsupportedModel.replace("/", "-")}`;


        // Create a guard approval for the unsupported model
        const mockGuardApproval = guardApproval({
            workflow_id: testWorkflowId,
            attempt_id: testAttemptId,
            guard_decision_id: guardDecisionId,
            provider_qualified_model_id: unsupportedModel,
            provider_family: providerFamily,
            usage_snapshot_ref: usageSnapshotRef,
            provider_health_snapshot_ref: healthSnapshotRef,
            runtime_capability_ref: undefined, // Explicitly set to undefined
            pre_dispatch_audit_ref: preDispatchAuditRef,
            expires_at: "2026-05-17T00:10:00.000Z",
        });

        // Create a custom approvalSource that is consistent with the unsupported model and its hashes
        const customApprovalSource = approvalSource({
            workflow_id: testWorkflowId,
            attempt_id: testAttemptId,
            approval_id: approvalSourceId,
            guard_decision_ref: mockGuardApproval.guard_decision_id,
            provider_qualified_model_id: unsupportedModel,
            provider_binding_hash: sha256Ref(JSON.stringify({ model: unsupportedModel, provider: providerFamily })), // Dynamic hash
            evidence_bundle_hash: sha256Ref(JSON.stringify({ some: "evidence", data: "for_bundle" })), // Dynamic hash
            issued_at: "2026-05-17T00:00:00.000Z", // Explicitly set issued_at
            expires_at: "2026-05-17T00:10:00.000Z",
        });

        // Consume the custom approvalSource to get the mockConsumedApproval
        const mockConsumedApproval = consumeFlowDeskProductionApprovalSourceV1({
            approval: customApprovalSource,
            workflowId: testWorkflowId,
            attemptId: testAttemptId,
            actionType: "managed_dispatch_beta",
            actorRef: "actor-user-123",
            profileRef: "profile-prod-123",
            providerQualifiedModelId: unsupportedModel,
            providerBindingHash: customApprovalSource.provider_binding_hash,
            evidenceBundleHash: customApprovalSource.evidence_bundle_hash,
            guardDecisionRef: customApprovalSource.guard_decision_ref,
            consumptionAuditRef: "audit-consumption-unsupported",
            consumedAt: "2026-05-17T00:00:01.000Z", // consumedAt slightly after issuedAt
        }).consumed_approval;
        assert.ok(mockConsumedApproval);

        // Create mock evidence for the references in mockGuardApproval
        const mockUsageSnapshot = dispatchableUsage({
            snapshot_id: usageSnapshotRef,
            provider_family: providerFamily,
            model_family: unsupportedModel.split('/')[1],
        });
        const mockHealthSnapshot = dispatchableHealth({
            snapshot_id: healthSnapshotRef,
            provider_family: providerFamily,
            model_family: unsupportedModel.split('/')[1],
        });

        const mockPreDispatchAudit = {
            schema_version: "flowdesk.pre_dispatch_audit_record.v1",
            workflow_id: testWorkflowId,
            pre_dispatch_audit_ref: preDispatchAuditRef,
            observed_at: now,
            attempt_id: testAttemptId,
            approval_ref: mockGuardApproval.guard_decision_id,
            dispatch_authority_enabled: false,
            providerCall: false,
            actualLaneLaunch: false,
            runtimeExecution: false,
        };


        const result = await dispatchManagedDispatchBetaPromptV1({
            client,
            boundaryInput: managedDispatchInput({
                workflowId: testWorkflowId,
                attemptId: testAttemptId,
                guardApproval: mockGuardApproval,
                bindingEvidence: bindingEvidence({
                    workflow_id: testWorkflowId,
                    attempt_id: testAttemptId,
                    provider_qualified_model_id: unsupportedModel
                }),
                usageSnapshot: mockUsageSnapshot,
                providerHealthSnapshot: mockHealthSnapshot,
            }),
            request: dispatchRequest({
                directory: rootDir,
                provider_qualified_model_id: unsupportedModel
            }),
            durableStateRootDir: rootDir,
            dispatchManifest: dispatchManifest({
                workflow_id: testWorkflowId,
                attempt_id: testAttemptId,
                provider_qualified_model_id: unsupportedModel,
                approval_ref: customApprovalSource.approval_id,
                consumed_approval_ref: customApprovalSource.approval_id,
                guard_decision_ref: mockGuardApproval.guard_decision_id,
                provider_binding_hash: customApprovalSource.provider_binding_hash,
                evidence_bundle_hash: customApprovalSource.evidence_bundle_hash,
            }),
            reloadedEvidence: reloadedEvidence({
                entries: [
                    {
                        evidenceClass: "dispatch_idempotency",
                        evidenceId: `idempotency-snapshot-${testWorkflowId}`, // Unique ID
                        record: {
                            schema_version: "flowdesk.dispatch_idempotency_snapshot.v1",
                            workflow_id: testWorkflowId,
                            snapshot_ref: `idempotency-snapshot-${testWorkflowId}`,
                            observed_at: now,
                            entries: [],
                            dispatch_authority_enabled: false,
                            realOpenCodeDispatch: false,
                            actualLaneLaunch: false,
                            providerCall: false,
                            runtimeExecution: false,
                        },
                        path: `.flowdesk/sessions/${testWorkflowId}/evidence/dispatch-idempotency/idempotency-snapshot-${testWorkflowId}.json`,
                    },
                    {
                        evidenceClass: "production_approval_source",
                        evidenceId: customApprovalSource.approval_id,
                        record: mockConsumedApproval as unknown as Record<string, unknown>,
                        path: `.flowdesk/sessions/${testWorkflowId}/evidence/production-approval-source/approval-source-${unsupportedModel.replace("/", "-")}.json`,
                    },
                    {
                        evidenceClass: "usage_authority",
                        evidenceId: usageSnapshotRef,
                        record: mockUsageSnapshot as unknown as Record<string, unknown>,
                        path: `.flowdesk/sessions/${testWorkflowId}/evidence/usage-authority/${usageSnapshotRef}.json`,
                    },
                    {
                        evidenceClass: "provider_health_snapshot",
                        evidenceId: healthSnapshotRef,
                        record: mockHealthSnapshot as unknown as Record<string, unknown>,
                        path: `.flowdesk/sessions/${testWorkflowId}/evidence/provider-health-snapshot/${healthSnapshotRef}.json`,
                    },
                    {
                        evidenceClass: "pre_dispatch_audit",
                        evidenceId: preDispatchAuditRef,
                        record: mockPreDispatchAudit as unknown as Record<string, unknown>,
                        path: `.flowdesk/sessions/${testWorkflowId}/evidence/pre-dispatch-audit/${preDispatchAuditRef}.json`,
                    },
                ]
            }),
        });

        // Blocked at any gate — unsupported model must never reach actual dispatch
        assert.equal(result.status, "blocked_before_dispatch");
    });
});
