import assert from "node:assert/strict";
import { existsSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import type {
	FlowDeskConformanceRuntimeMetadataV1,
	FlowDeskManagedDispatchBetaBindingEvidenceV1,
	FlowDeskManagedDispatchBetaPolicyV1,
	FlowDeskManagedDispatchBetaRuntimeEchoEvidenceV1,
	FlowDeskManagedDispatchBetaTelemetryCorrelationV1,
	FlowDeskManagedDispatchBetaUsageAuthorityEvidenceV1,
	FlowDeskProviderHealthSnapshotV1,
	FlowDeskTaskResultV1,
	FlowDeskUsageSnapshotV1,
	GuardApprovedDispatchV1,
} from "@flowdesk/core";
import {
	applyFlowDeskSessionEvidenceWriteIntentsV1,
	evaluateFlowDeskManagedDispatchExposureAuthorizationV1,
	evaluateManagedDispatchBetaGuardBoundaryV1,
	FLOWDESK_S7_REQUIRED_S6_TUPLE,
	prepareFlowDeskSessionEvidenceWriteIntentV1,
	reloadFlowDeskSessionEvidenceV1,
} from "@flowdesk/core";
import { evaluateFlowDeskCommandBackedHandlerV1 } from "./command-handlers.js";
import { createFlowDeskLocalNonDispatchAdapterSession } from "./local-adapter.js";

const now = "2026-06-15T12:00:00.000Z";
const betaNow = "2026-05-17T00:00:00.000Z";
const s7WorkflowId = FLOWDESK_S7_REQUIRED_S6_TUPLE.workflow_id;

type AuthorityCarrier = {
	realOpenCodeDispatch: false;
	providerCall: false;
	runtimeExecution: false;
	actualLaneLaunch: false;
	fallbackAuthority: false;
	hardCancelOrNoReplyAuthority: false;
};

function withTempRoot<T>(fn: (rootDir: string) => T): T {
	const rootDir = mkdtempSync(join(tmpdir(), "flowdesk-managed-dispatch-prod-gate-"));
	try {
		return fn(rootDir);
	} finally {
		rmSync(rootDir, { recursive: true, force: true });
	}
}

function assertAuthorityClosed(value: AuthorityCarrier): void {
	assert.equal(value.realOpenCodeDispatch, false);
	assert.equal(value.providerCall, false);
	assert.equal(value.runtimeExecution, false);
	assert.equal(value.actualLaneLaunch, false);
	assert.equal(value.fallbackAuthority, false);
	assert.equal(value.hardCancelOrNoReplyAuthority, false);
}

function s7TaskResult(overrides: Partial<FlowDeskTaskResultV1> = {}): FlowDeskTaskResultV1 {
	return {
		schema_version: "flowdesk.task_result.v1",
		workflow_id: FLOWDESK_S7_REQUIRED_S6_TUPLE.workflow_id,
		lane_id: FLOWDESK_S7_REQUIRED_S6_TUPLE.lane_id,
		task_id: FLOWDESK_S7_REQUIRED_S6_TUPLE.task_id,
		agent_ref: "agent-flowdesk-s6-smoke",
		provider_qualified_model_id: "openai/gpt-5.5",
		task_prompt_sha256: "sha256-s6-input-digest",
		result_text: `S6 completed. ${FLOWDESK_S7_REQUIRED_S6_TUPLE.sentinel}`,
		result_text_truncated: false,
		result_text_sha256: "sha256-s6-result",
		completion_status: "final",
		output_kind: "final_answer",
		usable_for_synthesis: true,
		created_at: "2026-06-15T11:55:00.000Z",
		dispatch_authority_enabled: false,
		...overrides,
	};
}

function s7Authorization(overrides: Record<string, unknown> = {}) {
	return evaluateFlowDeskManagedDispatchExposureAuthorizationV1({
		taskResultEvidence: s7TaskResult(),
		taskResultEvidenceId: FLOWDESK_S7_REQUIRED_S6_TUPLE.result_evidence_id,
		progressSnapshotWorkflowId:
			FLOWDESK_S7_REQUIRED_S6_TUPLE.progress_snapshot_workflow_id,
		now,
		...overrides,
	});
}

function persistS7Authorization(rootDir: string, evidenceId: string, record = s7Authorization()): void {
	const prepared = prepareFlowDeskSessionEvidenceWriteIntentV1({
		workflowId: s7WorkflowId,
		evidenceId,
		record: record as unknown as Record<string, unknown>,
	});
	assert.equal(prepared.ok, true, prepared.errors.join(", "));
	assert.ok(prepared.writeIntent);
	const applied = applyFlowDeskSessionEvidenceWriteIntentsV1(rootDir, [
		prepared.writeIntent,
	]);
	assert.equal(applied.ok, true, applied.errors.join(", "));
}

function doctorRequest() {
	return {
		schema_version: "flowdesk.doctor.request.v1",
		request_id: "request-managed-dispatch-prod-gate-doctor",
		input_mode: "test_fixture" as const,
		check_scope: "all" as const,
		profile: "test" as const,
		persist_report: false,
	};
}

function statusRequest() {
	return {
		schema_version: "flowdesk.status.request.v1",
		request_id: "request-managed-dispatch-prod-gate-status",
		input_mode: "test_fixture" as const,
		workflow_id: s7WorkflowId,
		session_ref: "session-local-ref",
		redacted_intake_ref: "intake-managed-dispatch-prod-gate",
		user_approval_ref: "approval-managed-dispatch-prod-gate",
		confirmation_nonce: "nonce-managed-dispatch-prod-gate",
		detail_level: "diagnostic" as const,
	};
}

function exportDebugRequest() {
	return {
		schema_version: "flowdesk.export_debug.request.v1",
		request_id: "request-managed-dispatch-prod-gate-debug",
		input_mode: "test_fixture" as const,
		include_sections: ["doctor"],
		retention_hint: "keep_until_default_expiry" as const,
	};
}

function doctorCompatibilityRefs(response: unknown): readonly string[] {
	assert.ok(typeof response === "object" && response !== null);
	const sections = (response as { doctor_results?: unknown }).doctor_results;
	assert.ok(Array.isArray(sections));
	const compatibility = sections.find(
		(section): section is { section: string; refs: string[] } =>
			typeof section === "object" &&
			section !== null &&
			(section as { section?: unknown }).section === "opencode_plugin_compatibility",
	);
	assert.ok(compatibility);
	assert.ok(Array.isArray(compatibility.refs));
	return compatibility.refs;
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
		...overrides,
	};
}

function bindingEvidence(): FlowDeskManagedDispatchBetaBindingEvidenceV1 {
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
		created_at: betaNow,
		expires_at: "2026-05-17T00:10:00.000Z",
	};
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

function usageAuthorityEvidence(): FlowDeskManagedDispatchBetaUsageAuthorityEvidenceV1 {
	return {
		schema_version: "flowdesk.managed_dispatch_beta.usage_authority_evidence.v1",
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
		observed_at: betaNow,
		expires_at: "2026-05-17T00:10:00.000Z",
	};
}

function dispatchableHealth(): FlowDeskProviderHealthSnapshotV1 {
	return {
		schema_version: "flowdesk.provider_health_snapshot.v1",
		snapshot_id: "health-123",
		provider_family: "claude",
		model_family: "sonnet-4",
		observed_at: betaNow,
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

function runtimeEchoEvidence(): FlowDeskManagedDispatchBetaRuntimeEchoEvidenceV1 {
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
		observed_at: betaNow,
		expires_at: "2026-05-17T00:10:00.000Z",
	};
}

function conformanceMetadata(): FlowDeskConformanceRuntimeMetadataV1 {
	return {
		schema_version: "flowdesk.conformance_runtime_metadata.v1",
		opencode_version: "1.14.40",
		checked_at: betaNow,
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
	};
}

function telemetryCorrelation(): FlowDeskManagedDispatchBetaTelemetryCorrelationV1 {
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
	};
}

function managedDispatchInput(overrides: Partial<Parameters<typeof evaluateManagedDispatchBetaGuardBoundaryV1>[0]> = {}): Parameters<typeof evaluateManagedDispatchBetaGuardBoundaryV1>[0] {
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
		exposureAuthorizationTaskResultEvidence: s7TaskResult({ created_at: betaNow }),
		exposureAuthorizationTaskResultEvidenceId:
			FLOWDESK_S7_REQUIRED_S6_TUPLE.result_evidence_id,
		exposureAuthorizationProgressSnapshotWorkflowId:
			FLOWDESK_S7_REQUIRED_S6_TUPLE.progress_snapshot_workflow_id,
		fallbackOrReselectionAllowed: false,
		hardChatAuthorityAllowed: false,
		ambiguityQuarantined: true,
		now: Date.parse(betaNow),
		...overrides,
	};
}

function preflightStatus(decision: ReturnType<typeof evaluateManagedDispatchBetaGuardBoundaryV1>): "blocked_before_dispatch" | "dispatch_accepted" {
	return decision.status === "eligible" ? "dispatch_accepted" : "blocked_before_dispatch";
}

test("S7 authorized state: doctor reports authorized without opening dispatch authority", () => withTempRoot((rootDir) => {
	persistS7Authorization(rootDir, "managed-dispatch-exposure-authorization-s7");
	const session = createFlowDeskLocalNonDispatchAdapterSession(
		new Date(now),
		undefined,
		{ durableStateRootDir: rootDir },
	);
	const result = session.evaluate("flowdesk_doctor", doctorRequest());

	assert.equal(result.ok, true, result.errors.join(", "));
	const refs = doctorCompatibilityRefs(result.handler.response);
	assert.ok(refs.includes("s7_managed_dispatch_exposure_state=authorized"));
	assert.ok(refs.includes("s7_managed_dispatch_exposure_scope=readiness_only"));
	assert.ok(refs.includes("s7_managed_dispatch_exposure_dispatch_authority_enabled=false"));
	assert.ok(refs.includes("s7_managed_dispatch_exposure_providerCall=false"));
	assert.ok(refs.includes("s7_managed_dispatch_exposure_actualLaneLaunch=false"));
	assert.ok(refs.includes("s7_managed_dispatch_exposure_realOpenCodeDispatch=false"));
	assertAuthorityClosed(result);
}));

test("S7 blocked state: managed-dispatch preflight gate blocks before dispatch", () => withTempRoot((rootDir) => {
	const blockedAuthorization = s7Authorization({
		taskResultEvidenceId: "task-result-wrong",
	});
	persistS7Authorization(
		rootDir,
		"managed-dispatch-exposure-authorization-s7-blocked",
		blockedAuthorization,
	);
	const reload = reloadFlowDeskSessionEvidenceV1({ rootDir, workflowId: s7WorkflowId });
	assert.equal(reload.ok, true, reload.errors.join(", "));
	assert.equal(reload.entries.length, 1);

	const decision = evaluateManagedDispatchBetaGuardBoundaryV1(managedDispatchInput({
		exposureAuthorizationTaskResultEvidence: s7TaskResult(),
		exposureAuthorizationTaskResultEvidenceId: "task-result-wrong",
		exposureAuthorizationProgressSnapshotWorkflowId:
			FLOWDESK_S7_REQUIRED_S6_TUPLE.progress_snapshot_workflow_id,
	}));
	assert.equal(preflightStatus(decision), "blocked_before_dispatch");
	assert.equal(decision.status, "blocked");
	assert.match(decision.redacted_reason, /s6_result_evidence_mismatched/);
}));

test("S7 authorized + all gate conditions: dispatch_accepted path is reachable without authority widening", () => withTempRoot((rootDir) => {
	persistS7Authorization(rootDir, "managed-dispatch-exposure-authorization-s7-ready");
	const session = createFlowDeskLocalNonDispatchAdapterSession(
		new Date(now),
		undefined,
		{ durableStateRootDir: rootDir },
	);
	const doctor = session.evaluate("flowdesk_doctor", doctorRequest());
	const status = session.evaluate("flowdesk_status", statusRequest());
	const decision = evaluateManagedDispatchBetaGuardBoundaryV1(managedDispatchInput());

	assert.equal(doctor.ok, true, doctor.errors.join(", "));
	assert.equal(status.ok, true, status.errors.join(", "));
	assert.ok(doctorCompatibilityRefs(doctor.handler.response).includes("s7_managed_dispatch_exposure_state=authorized"));
	assert.equal(preflightStatus(decision), "dispatch_accepted");
	assert.equal(decision.status, "eligible");
	assert.match(decision.redacted_reason, /does not perform dispatch/);
	assertAuthorityClosed(doctor);
	assertAuthorityClosed(status);
}));

test("export-debug: S7 exposure refs appear in redacted debug sections", () => withTempRoot((rootDir) => {
	persistS7Authorization(
		rootDir,
		"managed-dispatch-exposure-authorization-s7-debug",
	);
	const session = createFlowDeskLocalNonDispatchAdapterSession(
		new Date(now),
		undefined,
		{ durableStateRootDir: rootDir },
	);
	const result = session.evaluate("flowdesk_export_debug", exportDebugRequest());
	assert.equal(result.ok, true, result.errors.join(", "));
	assertAuthorityClosed(result);

	const sectionPath = join(
		rootDir,
		".flowdesk/sessions/session-local/redacted-debug/sections/doctor.json",
	);
	assert.equal(existsSync(sectionPath), true);
	const section = JSON.parse(readFileSync(sectionPath, "utf8")) as Record<string, unknown>;
	const labels = ((section.summary_labels ?? []) as string[]).join("|");
	assert.match(labels, /s7_managed_dispatch_exposure_state=authorized/);
	assert.match(labels, /s7_managed_dispatch_exposure_latest_evidence_ref=managed-dispatch-exposure-authorization-s7-debug/);
	assert.match(labels, /s7_managed_dispatch_exposure_scope=readiness_only/);
	assert.match(labels, /s7_managed_dispatch_exposure_dispatch_authority_enabled=false/);
	assert.equal(
		/S6_LIVE_SMOKE_OK|result_text|task_prompt|provider_payload|Bearer|secret|token|\/Users/.test(
			JSON.stringify(section),
		),
		false,
	);
}));

test("authority flags invariant: all five flags remain false across S7 authorized/blocked/absent states", () => withTempRoot((rootDir) => {
	const authorizedSession = createFlowDeskLocalNonDispatchAdapterSession(
		new Date(now),
		undefined,
		{ durableStateRootDir: rootDir },
	);
	persistS7Authorization(rootDir, "managed-dispatch-exposure-authorization-s7-authorized");
	assertAuthorityClosed(authorizedSession.evaluate("flowdesk_doctor", doctorRequest()));

	// blocked: write a blocked S7 authorization to a temp root and reload
	const blockedRootDir = mkdtempSync(join(tmpdir(), "flowdesk-prod-gate-blocked-"));
	try {
		const blockedAuthorization = s7Authorization({ taskResultEvidenceId: "task-result-wrong" });
		const preparedBlocked = prepareFlowDeskSessionEvidenceWriteIntentV1({
			workflowId: FLOWDESK_S7_REQUIRED_S6_TUPLE.workflow_id,
			evidenceId: "managed-dispatch-exposure-authorization-s7-blocked",
			record: blockedAuthorization as unknown as Record<string, unknown>,
		});
		assert.equal(preparedBlocked.ok, true);
		assert.ok(preparedBlocked.writeIntent);
		applyFlowDeskSessionEvidenceWriteIntentsV1(blockedRootDir, [preparedBlocked.writeIntent]);
		const blockedReload = reloadFlowDeskSessionEvidenceV1({
			workflowId: FLOWDESK_S7_REQUIRED_S6_TUPLE.workflow_id,
			rootDir: blockedRootDir,
		});
		const blockedHandler = evaluateFlowDeskCommandBackedHandlerV1(
			"flowdesk_doctor",
			doctorRequest(),
			{ diagnostic: { sessionEvidenceReload: blockedReload } },
		);
		assertAuthorityClosed(blockedHandler);
		assert.ok(doctorCompatibilityRefs(blockedHandler.response).includes("s7_managed_dispatch_exposure_state=blocked"));
	} finally {
		rmSync(blockedRootDir, { recursive: true, force: true });
	}

	// absent: empty reload
	const absentRootDir = mkdtempSync(join(tmpdir(), "flowdesk-prod-gate-absent-"));
	try {
		const absentReload = reloadFlowDeskSessionEvidenceV1({
			workflowId: FLOWDESK_S7_REQUIRED_S6_TUPLE.workflow_id,
			rootDir: absentRootDir,
		});
		const absentHandler = evaluateFlowDeskCommandBackedHandlerV1(
			"flowdesk_doctor",
			doctorRequest(),
			{ diagnostic: { sessionEvidenceReload: absentReload } },
		);
		assertAuthorityClosed(absentHandler);
		assert.ok(doctorCompatibilityRefs(absentHandler.response).includes("s7_managed_dispatch_exposure_state=unknown"));
	} finally {
		rmSync(absentRootDir, { recursive: true, force: true });
	}
}));
