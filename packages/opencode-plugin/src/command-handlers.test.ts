import assert from "node:assert/strict";
import test from "node:test";
import type {
	FlowDeskAttemptRecordV1,
	FlowDeskDefaultManagedDispatchPromotionReadinessV1,
	FlowDeskDoctorResponseV1,
	FlowDeskExactModelAvailabilityCacheRefreshPlanV1,
	FlowDeskExportDebugRequestV1,
	FlowDeskFds1FixtureCatalogEntryV1,
	FlowDeskLaneRecordV1,
	FlowDeskNonDispatchPermissionV1,
	FlowDeskPlanCommandInputV1,
	FlowDeskPolicyPackV1,
	FlowDeskProductionEnablementEvaluationV1,
	FlowDeskProjectConfigV1,
	FlowDeskProviderHealthSnapshotV1,
	FlowDeskRelease1MinimumToolName,
	FlowDeskReviewerFanoutPlanV1,
	FlowDeskRunRequestV1,
	FlowDeskStatusCommandInputV1,
	FlowDeskUsageResponseV1,
	FlowDeskWorkflowActiveV1,
	FlowDeskWorkflowRecordV1,
	WorkflowTaxonomyV1,
} from "@flowdesk/core";
import {
	FLOWDESK_FDS1_FIXTURE_CATALOG,
	mergePolicyPacksV1,
} from "@flowdesk/core";
import type { FlowDeskCommandBackedHandlerResultV1 } from "./index.js";
import { evaluateFlowDeskCommandBackedHandlerV1 } from "./index.js";

const nowIso = "2026-05-17T00:00:00.000Z";

const taxonomy: WorkflowTaxonomyV1 = {
	primary_category: "coding",
	difficulty_drivers: ["bounded Release 1 command handler test"],
	coupling_scope: "few_files",
	algorithmic_hardness: "low",
	architecture_hardness: "low",
	migration_state_hardness: "none",
	domain_uncertainty: "low",
	verification_hardness: "low",
	operational_risk: "low",
	policy_professional_boundary: "ordinary",
};

function requestFixture(
	toolName: FlowDeskRelease1MinimumToolName,
	category: "valid.minimal" | "invalid.unknown-property" = "valid.minimal",
): Readonly<Record<string, unknown>> {
	const fixture = FLOWDESK_FDS1_FIXTURE_CATALOG.find(
		(entry): entry is FlowDeskFds1FixtureCatalogEntryV1 =>
			entry.toolName === toolName && entry.schemaKind === "tool_request",
	);
	assert.ok(fixture, toolName);
	return fixture.categories[category].sample;
}

function doctorRequest(
	overrides: Record<string, unknown> = {},
): Readonly<Record<string, unknown>> {
	return {
		...requestFixture("flowdesk_doctor"),
		check_scope: "all",
		profile: "test",
		...overrides,
	};
}

function workflowIdFrom(request: Readonly<Record<string, unknown>>): string {
	return typeof request.workflow_id === "string"
		? request.workflow_id
		: "workflow-123";
}

function assertNoRuntimeAuthority(
	result: FlowDeskCommandBackedHandlerResultV1,
): void {
	assert.equal(result.productionRegistrationEligible, false);
	assert.equal(result.realOpenCodeDispatch, false);
	assert.equal(result.actualLaneLaunch, false);
	assert.equal(result.providerCall, false);
	assert.equal(result.runtimeExecution, false);
	assert.equal(result.fallbackAuthority, false);
	assert.equal(result.hardCancelOrNoReplyAuthority, false);
}

function retention(days = { session: 14, debug: 7, conformance: 30 }) {
	return {
		session_records_max_days: days.session,
		debug_staging_max_days: days.debug,
		conformance_summary_max_days: days.conformance,
		allow_user_longer_retention: false,
		deletion_behavior: "delete_after_expiry" as const,
	};
}

function usagePolicy() {
	return {
		usage_freshness_ttl_minutes: 15,
		unknown_usage_dispatchability: "non_dispatchable" as const,
		stale_usage_dispatchability: "non_dispatchable" as const,
		refused_usage_dispatchability: "non_dispatchable" as const,
		shared_limit_suspected_dispatchability: "non_dispatchable" as const,
		fallback_derived_dispatchability: "non_dispatchable" as const,
		allow_local_history_source: false,
		allow_provider_console_scraping: false as const,
	};
}

function healthPolicy() {
	return {
		health_freshness_ttl_minutes: 10,
		unavailable_dispatchability: "non_dispatchable" as const,
		degraded_dispatchability: "diagnostic_only" as const,
		opencode_go_usage_without_official_quota: "unknown" as const,
		z_ai_usage_without_official_quota: "unknown" as const,
		allow_automatic_provider_fallback: false as const,
	};
}

function projectConfig(): FlowDeskProjectConfigV1 {
	return {
		schema_version: "flowdesk.project_config.v1",
		config_id: "config-123",
		created_at: nowIso,
		updated_at: nowIso,
		release_mode: "release1",
		project_root_ref: "project-root-123",
		config_hash: "config-hash-123",
		policy_pack_refs: ["policy-ref-123"],
		policy_pack_hashes: ["policy-hash-123"],
		chat_intake_mode: "steering",
		hook_harness_mode: "enforce",
		retention: retention(),
		usage_policy: usagePolicy(),
		provider_health_policy: healthPolicy(),
		disabled_modes: [
			"real_dispatch",
			"managed_fallback",
			"lane_launch",
			"hard_chat_blocking",
		],
		extension_namespaces: ["flowdesk.project"],
		audit_refs: ["audit-123"],
	};
}

function policyPack(): FlowDeskPolicyPackV1 {
	return {
		schema_version: "flowdesk.policy_pack.v1",
		policy_pack_id: "policy-123",
		policy_pack_hash: "policy-hash-123",
		name: "Starter policy",
		version: "1.0.0",
		source_ref: "policy-source-123",
		applies_to_release_modes: ["release1"],
		priority: 1,
		rules: [
			{
				rule_id: "rule-approval-123",
				effect: "require_approval",
				target: "permission_class",
				summary_label: "Require typed approval for writes.",
				refs: ["approval-123"],
			},
		],
		hard_ban_refs: ["ban-123"],
		retention_override: retention({ session: 7, debug: 3, conformance: 14 }),
		usage_policy_override: { ...usagePolicy(), usage_freshness_ttl_minutes: 5 },
		provider_health_policy_override: {
			...healthPolicy(),
			degraded_dispatchability: "non_dispatchable",
		},
		hook_policy_override: {
			chat_intake_mode: "steering",
			hook_harness_mode: "enforce",
			blocking_chat_intake_enabled: false,
			hard_no_reply_or_cancel_enabled: false,
		},
		allowed_extension_namespaces: ["flowdesk.project"],
		redaction_baseline_ref: "redaction-123",
	};
}

function permission(
	overrides: Partial<FlowDeskNonDispatchPermissionV1> = {},
): FlowDeskNonDispatchPermissionV1 {
	return {
		schema_version: "flowdesk.non_dispatch_permission.v1",
		permission_id: "permission-123",
		permission_class: "fake_runtime_write",
		workflow_id: "workflow-123",
		scope_ref: "scope-123",
		grant_source: "typed_confirmation",
		created_at: nowIso,
		expires_at: "2026-05-18T00:00:00.000Z",
		config_hash: "config-hash-123",
		policy_pack_hash: "policy-hash-123",
		release_mode: "release1",
		audit_ref: "audit-123",
		...overrides,
	};
}

function planContext(
	request: Readonly<Record<string, unknown>>,
): Omit<FlowDeskPlanCommandInputV1, "request"> {
	const workflowId = workflowIdFrom(request);
	return {
		sessionId: "session-123",
		workflowId,
		planRevisionId: "plan-123",
		planningStepId: "step-plan-123",
		laneId: "lane-plan-123",
		laneTaskRef: "task-plan-123",
		laneSummaryRef: "lane-summary-123",
		laneEventRef: "event-plan-123",
		auditRef: "audit-123",
		routeRef: "route-123",
		nowIso,
		taxonomy,
	};
}

function runRequest(
	runMode: FlowDeskRunRequestV1["run_mode"],
): FlowDeskRunRequestV1 {
	return {
		...requestFixture("flowdesk_run"),
		workflow_id: "workflow-123",
		run_mode: runMode,
		plan_revision_id: "plan-123",
		step_id: "step-123",
	} as FlowDeskRunRequestV1;
}

function guardBoundary() {
	const policy = mergePolicyPacksV1(projectConfig(), [policyPack()], {
		effectivePolicyId: "effective-123",
		computedAt: nowIso,
		auditRef: "audit-123",
	});
	return {
		configHash: "config-hash-123",
		scopeRef: "scope-123",
		policy,
		auditRef: "audit-123",
		conformanceRef: "conformance-123",
		runtimeCapabilityRef: "runtime-123",
		nonDispatchPermission: permission(),
		now: Date.parse(nowIso),
	};
}

function guardedDryRunContext(): NonNullable<
	Parameters<typeof evaluateFlowDeskCommandBackedHandlerV1>[2]
>["run"] {
	return {
		guardedDryRun: {
			guardBoundary: {
				...guardBoundary(),
				nonDispatchPermission: permission({ permission_class: "audit_write" }),
			},
			sessionId: "session-123",
			attemptId: "attempt-123",
			auditEventId: "event-123",
			nowIso,
			decisionRef: "decision-123",
			routeRef: "route-123",
			commandShapeHash: "command-shape-hash-123",
			runResultRef: "run-result-123",
			verificationSummaryRef: "verification-123",
			redactionVersion: "redaction-v1",
		},
	};
}

function fakeRuntimeContext(): NonNullable<
	Parameters<typeof evaluateFlowDeskCommandBackedHandlerV1>[2]
>["run"] {
	return {
		fakeRuntime: {
			guardBoundary: guardBoundary(),
			auditWritePermission: permission({ permission_class: "audit_write" }),
			stateWritePermission: permission({ permission_class: "state_write" }),
			sessionId: "session-123",
			attemptId: "attempt-123",
			auditEventId: "event-123",
			outcomeAuditEventId: "event-outcome-123",
			nowIso,
			decisionRef: "decision-123",
			routeRef: "route-123",
			commandShapeHash: "command-shape-hash-123",
			runResultRef: "fake-runtime-result-123",
			runtimeEchoEvidenceRef: "runtime-echo-ref-123",
			verificationSummaryRef: "verification-123",
			outcomeAuditRef: "audit-outcome-123",
			redactionVersion: "redaction-v1",
		},
	};
}

function active(workflowId: string): FlowDeskWorkflowActiveV1 {
	return {
		schema_version: "flowdesk.workflow_active.v1",
		active_workflow_id: workflowId,
		active_attempt_id: "attempt-123",
		state: "complete",
		updated_at: nowIso,
		status_summary_ref: "status-summary-123",
		audit_refs: ["audit-123"],
	};
}

function workflow(workflowId: string): FlowDeskWorkflowRecordV1 {
	return {
		schema_version: "flowdesk.workflow_record.v1",
		workflow_id: workflowId,
		session_ref: "session-ref-123",
		created_at: nowIso,
		updated_at: nowIso,
		state: "complete",
		latest_plan_revision_id: "plan-123",
		current_step_id: "step-123",
		project_root_ref: "project-root-ref-123",
		config_hash: "config-hash-123",
		policy_pack_id: "policy-123",
		policy_pack_hash: "policy-hash-123",
		current_attempt_id: "attempt-123",
		attempt_refs: ["attempt-ref-123"],
		checkpoint_refs: [],
		lane_refs: ["lane-ref-123"],
		latest_lane_summary_refs: ["lane-summary-123"],
		audit_refs: ["audit-123"],
		status_summary_ref: "status-summary-123",
		artifact_disposition: "quarantined",
		safe_next_actions: ["/flowdesk-status"],
	};
}

function attempt(workflowId: string): FlowDeskAttemptRecordV1 {
	return {
		schema_version: "flowdesk.attempt_record.v1",
		attempt_id: "attempt-123",
		workflow_id: workflowId,
		step_id: "step-123",
		created_at: nowIso,
		updated_at: nowIso,
		run_mode: "fake-runtime",
		state_at_start: "ready_to_run",
		state_at_end: "complete",
		attempt_state: "complete",
		guard_decision_ref: "guard-123",
		command_shape_hash: "command-shape-hash-123",
		pre_run_audit_ref: "audit-pre-123",
		runtime_echo_validation: "not_applicable",
		verification_ref: "verification-123",
		artifact_disposition: "quarantined",
		outcome_audit_ref: "audit-outcome-123",
		safe_next_actions: ["/flowdesk-status", "/flowdesk-export-debug"],
	};
}

function laneRecord(workflowId: string): FlowDeskLaneRecordV1 {
	return {
		schema_version: "flowdesk.lane_record.v1",
		lane_id: "lane-123",
		workflow_id: workflowId,
		plan_revision_id: "plan-123",
		attempt_id: "attempt-123",
		task_ref: "task-123",
		lane_class: "verification",
		state: "completed",
		created_at: nowIso,
		started_at: nowIso,
		updated_at: nowIso,
		completed_at: nowIso,
		safe_next_action: "/flowdesk-status",
		refs: ["lane-summary-123"],
		event_refs: ["event-123"],
		audit_refs: ["audit-123"],
		debug_ref: "debug-123",
	};
}

function providerHealth(): FlowDeskProviderHealthSnapshotV1 {
	return {
		schema_version: "flowdesk.provider_health_snapshot.v1",
		snapshot_id: "health-123",
		provider_family: "opencode_go",
		model_family: "unknown",
		observed_at: nowIso,
		freshness: "fresh",
		freshness_ttl: 5,
		source_surface: "doctor_probe",
		availability_state: "healthy",
		failure_class: "none",
		dispatchability: "diagnostic_only",
		source_ref: "health-source-123",
		safe_remediation: "Run /flowdesk-doctor to refresh provider diagnostics.",
	};
}

function productionEnablement(
	overrides: Partial<FlowDeskProductionEnablementEvaluationV1> = {},
): FlowDeskProductionEnablementEvaluationV1 {
	return {
		schema_version: "flowdesk.production_enablement_evaluation.v1",
		workflow_id: "workflow-123",
		ok: true,
		errors: [],
		state: "configured",
		blocker_labels: ["approval_missing"],
		uncertainty_labels: ["opencode_subtask_lifecycle_unproven"],
		evidence_refs: ["usage-authority-123", "runtime-echo-123", "telemetry-123"],
		doctor_state_ref: "production-enable-configured",
		managed_dispatch_ready: false,
		dispatch_authority_enabled: false,
		default_release1_non_dispatch_preserved: true,
		configured_verification_result: "passed",
		configured_verification_ref: "configured-verification-123",
		sanitized_auth_capture_result: "passed",
		sanitized_auth_capture_ref: "sanitized-auth-capture-123",
		external_auth_provider_policy_result: "passed",
		external_auth_policy_ref: "external-auth-policy-123",
		provider_policy_ref: "provider-policy-123",
		safe_next_actions: ["/flowdesk-doctor", "/flowdesk-status"],
		...overrides,
		managed_dispatch_ready_basis:
			overrides.managed_dispatch_ready_basis ?? "not_ready",
	};
}

function promotionReadiness(
	overrides: Partial<FlowDeskDefaultManagedDispatchPromotionReadinessV1> = {},
): FlowDeskDefaultManagedDispatchPromotionReadinessV1 {
	return {
		schema_version: "flowdesk.default_managed_dispatch_promotion_readiness.v1",
		workflow_id: "workflow-123",
		ok: true,
		errors: [],
		state: "configured",
		blocked_labels: ["durable_precall_missing", "default_release_enablement_missing"],
		evidence_refs: ["usage-authority-123", "adapter-profile-123"],
		production_enablement_state: "dispatch_capable",
		managed_dispatch_ready: true,
		durable_precall_ready: false,
		adapter_available: true,
		sdk_client_available: true,
		doctor_status_ref: "default-managed-dispatch-configured",
		default_dispatch_candidate: false,
		dispatch_authority_enabled: false,
		providerCall: false,
		actualLaneLaunch: false,
		runtimeExecution: false,
		safe_next_actions: ["/flowdesk-doctor", "/flowdesk-status"],
		...overrides,
	};
}

function cacheRefreshPlan(
	overrides: Partial<FlowDeskExactModelAvailabilityCacheRefreshPlanV1> = {},
): FlowDeskExactModelAvailabilityCacheRefreshPlanV1 {
	return {
		schema_version: "flowdesk.exact_model_availability_cache_refresh_plan.v1",
		ok: true,
		errors: [],
		state: "refresh_required",
		blocked_labels: [],
		refresh_reason_labels: ["cache_missing"],
		expected_local_date: "2026-05-17",
		expected_active_profile_ref: "profile-123",
		expected_opencode_version_ref: "opencode-1.15.6",
		expected_flowdesk_package_version_ref: "flowdesk-0.1.1",
		expected_registry_hash: "hash-registry-123",
		expected_policy_pack_hash: "hash-policy-123",
		expected_auth_account_boundary_ref: "account-123",
		discovery_required: true,
		refresh_required: true,
		cache_usable_for_assignment: false,
		discovery_attempted: false,
		refresh_attempted: false,
		dispatch_authority_enabled: false,
		providerCall: false,
		actualLaneLaunch: false,
		runtimeExecution: false,
		...overrides,
	};
}

function reviewerFanoutPlan(
	overrides: Partial<FlowDeskReviewerFanoutPlanV1> = {},
): FlowDeskReviewerFanoutPlanV1 {
	return {
		schema_version: "flowdesk.reviewer_fanout_plan.v1",
		workflow_id: "workflow-123",
		attempt_id: "attempt-123",
		ok: true,
		errors: [],
		cache_id: "cache-123",
		state: "blocked",
		blocked_labels: ["assignment_revalidation_blocked"],
		required_perspectives: ["policy_security", "architecture", "verification_implementation"],
		planned_perspectives: [],
		runtime_lane_launch_requests: [],
		max_concurrent_lane_count: 3,
		same_model_stagger_ms: 1,
		lane_launch_schedule: [],
		runtime_launch_plan_required: true,
		lane_launch_approval_required: true,
		launch_attempted: false,
		approval_inferred: false,
		dispatch_authority_enabled: false,
		providerCall: false,
		actualLaneLaunch: false,
		runtimeExecution: false,
		...overrides,
	};
}

function statusContext(
	request: Readonly<Record<string, unknown>>,
): Omit<FlowDeskStatusCommandInputV1, "request"> {
	const workflowId = workflowIdFrom(request);
	return {
		active: active(workflowId),
		workflow: workflow(workflowId),
		currentAttempt: attempt(workflowId),
		laneRecords: [laneRecord(workflowId)],
		providerHealthSnapshot: providerHealth(),
		auditRef: "audit-123",
		debugRef: "debug-123",
		now: Date.parse(nowIso),
	};
}

test("command-backed handlers execute core evaluators for schema-valid requests without runtime authority", () => {
	const planRequest = requestFixture("flowdesk_plan");
	const fakeRunRequest = runRequest("fake-runtime");
	const statusRequest = requestFixture("flowdesk_status");
	const retryRequest = requestFixture("flowdesk_retry");
	const cases: readonly [
		FlowDeskRelease1MinimumToolName,
		unknown,
		Parameters<typeof evaluateFlowDeskCommandBackedHandlerV1>[2],
	][] = [
		["flowdesk_plan", planRequest, { plan: planContext(planRequest) }],
		["flowdesk_run", fakeRunRequest, { run: fakeRuntimeContext() }],
		[
			"flowdesk_status",
			statusRequest,
			{ status: statusContext(statusRequest) },
		],
		[
			"flowdesk_retry",
			retryRequest,
			{
				retry: {
					providerHealthSnapshot: providerHealth(),
					newAttemptId: "attempt-retry-123",
					auditRef: "audit-123",
					debugRef: "debug-123",
				},
			},
		],
	];

	for (const [toolName, request, context] of cases) {
		const result = evaluateFlowDeskCommandBackedHandlerV1(
			toolName,
			request,
			context,
		);
		assert.equal(result.handlerMode, "command_backed_core_evaluator", toolName);
		assert.equal(result.ok, true, toolName);
		assert.equal(result.requestSchemaValid, true, toolName);
		assert.equal(result.responseSchemaValid, true, toolName);
		assert.equal(result.coreEvaluationOk, true, toolName);
		assert.notEqual(result.response, undefined, toolName);
		assertNoRuntimeAuthority(result);
	}
});

test("command-backed run handler routes guarded dry-run and fake-runtime modes to core evaluators", () => {
	const dryRun = evaluateFlowDeskCommandBackedHandlerV1(
		"flowdesk_run",
		runRequest("guarded-dry-run"),
		{ run: guardedDryRunContext() },
	);
	assert.equal(dryRun.handlerMode, "command_backed_core_evaluator");
	assert.equal(dryRun.ok, true);
	assert.equal(dryRun.requestSchemaValid, true);
	assert.equal(dryRun.responseSchemaValid, true);
	assert.equal(dryRun.coreEvaluationOk, true);
	assert.equal(
		(dryRun.response as { status?: unknown }).status,
		"dry_run_complete",
	);
	assertNoRuntimeAuthority(dryRun);

	const fakeRuntime = evaluateFlowDeskCommandBackedHandlerV1(
		"flowdesk_run",
		runRequest("fake-runtime"),
		{ run: fakeRuntimeContext() },
	);
	assert.equal(fakeRuntime.handlerMode, "command_backed_core_evaluator");
	assert.equal(fakeRuntime.ok, true);
	assert.equal(fakeRuntime.requestSchemaValid, true);
	assert.equal(fakeRuntime.responseSchemaValid, true);
	assert.equal(fakeRuntime.coreEvaluationOk, true);
	assert.equal(
		(fakeRuntime.response as { status?: unknown }).status,
		"fake_runtime_complete",
	);
	assertNoRuntimeAuthority(fakeRuntime);
});

test("command-backed handlers fail closed before evaluator execution for unknown request properties", () => {
	const request = requestFixture("flowdesk_plan", "invalid.unknown-property");
	const result = evaluateFlowDeskCommandBackedHandlerV1(
		"flowdesk_plan",
		request,
		{ plan: planContext(request) },
	);
	assert.equal(result.handlerMode, "request_schema_invalid");
	assert.equal(result.ok, false);
	assert.equal(result.requestSchemaValid, false);
	assert.equal(result.responseSchemaValid, false);
	assert.equal(result.coreEvaluationOk, false);
	assert.equal(result.response, undefined);
	assertNoRuntimeAuthority(result);
});

test("command-backed handlers require evaluator input for core-backed tools", () => {
	const request = requestFixture("flowdesk_status");
	const result = evaluateFlowDeskCommandBackedHandlerV1(
		"flowdesk_status",
		request,
	);
	assert.equal(result.handlerMode, "missing_evaluator_input");
	assert.equal(result.ok, false);
	assert.equal(result.requestSchemaValid, true);
	assert.equal(result.responseSchemaValid, false);
	assert.equal(result.coreEvaluationOk, false);
	assert.equal(result.response, undefined);
	assertNoRuntimeAuthority(result);

	const runResult = evaluateFlowDeskCommandBackedHandlerV1(
		"flowdesk_run",
		runRequest("fake-runtime"),
	);
	assert.equal(runResult.handlerMode, "missing_evaluator_input");
	assert.equal(runResult.ok, false);
	assert.equal(runResult.requestSchemaValid, true);
	assert.equal(runResult.responseSchemaValid, false);
	assert.equal(runResult.coreEvaluationOk, false);
	assert.equal(runResult.response, undefined);
	assertNoRuntimeAuthority(runResult);
});

test("doctor diagnostic handler reports Release 1 disabled modes without runtime authority", () => {
	const result = evaluateFlowDeskCommandBackedHandlerV1(
		"flowdesk_doctor",
		doctorRequest(),
	);
	assert.equal(result.handlerMode, "command_backed_diagnostic_handler");
	assert.equal(result.requestSchemaValid, true);
	assert.equal(result.responseSchemaValid, true);
	assert.equal(result.coreEvaluationOk, true);
	const response = result.response as FlowDeskDoctorResponseV1;
	assert.equal(response.schema_version, "flowdesk.doctor.response.v1");
	assert.deepEqual(
		response.doctor_results.map((section) => section.section),
		[
			"migration_cleanup",
			"opencode_plugin_compatibility",
			"provider_usage_readiness",
			"policy_project_safety",
		],
	);
	const compatibility = response.doctor_results.find(
		(section) => section.section === "opencode_plugin_compatibility",
	);
	const providerReadiness = response.doctor_results.find(
		(section) => section.section === "provider_usage_readiness",
	);
	assert.ok(compatibility);
	assert.match(
		compatibility.summary,
		/Command registration is ready/,
	);
	assert.equal(compatibility.category, "informational");
	assert.ok(
		compatibility.refs.some((ref) =>
			ref.startsWith("production-readiness-passed-"),
		),
	);
	assert.ok(
		compatibility.refs.includes(
			"top_tier_multi_perspective_review_mode=planned",
		),
	);
	assert.ok(providerReadiness);
	assert.equal(providerReadiness.category, "degraded_mode_warning");
	assert.match(
		providerReadiness.summary,
		/auth readiness and fresh real usage\/quota\/reset evidence/,
	);
	assert.ok(providerReadiness.refs.includes("all-model-auth-usage-required"));
	assert.equal(
		response.provider_health_summary.dispatchability,
		"non_dispatchable",
	);
	assert.deepEqual(response.disabled_modes, [
		"real_dispatch",
		"managed_fallback",
		"lane_launch",
		"hard_chat_blocking",
	]);
	assert.equal(JSON.stringify(response).includes("provider_payload"), false);
	assert.equal(JSON.stringify(response).includes("/Users/"), false);
	assertNoRuntimeAuthority(result);
});

test("doctor diagnostic handler can surface evaluated production enablement without authority", () => {
	const result = evaluateFlowDeskCommandBackedHandlerV1(
		"flowdesk_doctor",
		doctorRequest(),
		{ diagnostic: { productionEnablement: productionEnablement() } },
	);
	assert.equal(result.ok, true);
	const response = result.response as FlowDeskDoctorResponseV1;
	const compatibility = response.doctor_results.find(
		(section) => section.section === "opencode_plugin_compatibility",
	);
	assert.ok(compatibility);
	assert.ok(
		compatibility.refs.includes("production_enablement_state=configured"),
	);
	assert.ok(
		compatibility.refs.includes(
			"production_enablement_doctor_ref=production-enable-configured",
		),
	);
	assert.ok(
		compatibility.refs.includes("production_managed_dispatch_ready=false"),
	);
	assert.ok(
		compatibility.refs.includes("default_dispatch_candidate=false"),
	);
	assert.ok(
		compatibility.refs.includes("default_dispatch_promotion_state=blocked"),
	);
	assert.ok(
		compatibility.refs.includes("production_dispatch_authority_enabled=false"),
	);
	assert.ok(compatibility.refs.includes("production_blocker=approval_missing"));
	assert.ok(
		compatibility.refs.includes("production_configured_verification_result=passed"),
	);
	assert.ok(
		compatibility.refs.includes(
			"production_configured_verification_ref=configured-verification-123",
		),
	);
	assert.ok(
		compatibility.refs.includes("production_sanitized_auth_capture_result=passed"),
	);
	assert.ok(
		compatibility.refs.includes(
			"production_sanitized_auth_capture_ref=sanitized-auth-capture-123",
		),
	);
	assert.ok(
		compatibility.refs.includes(
			"production_external_auth_provider_policy_result=passed",
		),
	);
	assert.ok(
		compatibility.refs.includes(
			"production_external_auth_policy_ref=external-auth-policy-123",
		),
	);
	assert.ok(
		compatibility.refs.includes("production_provider_policy_ref=provider-policy-123"),
	);

	const deniedApproval = evaluateFlowDeskCommandBackedHandlerV1(
		"flowdesk_doctor",
		doctorRequest(),
		{
			diagnostic: {
				productionEnablement: productionEnablement({
					state: "blocked",
					blocker_labels: ["approval_denied"],
					approval_decision: "deny",
					approval_ref: "approval-denied-123",
				}),
			},
		},
	);
	const deniedResponse = deniedApproval.response as FlowDeskDoctorResponseV1;
	const deniedCompatibility = deniedResponse.doctor_results.find(
		(section) => section.section === "opencode_plugin_compatibility",
	);
	assert.ok(deniedCompatibility);
	assert.ok(
		deniedCompatibility.refs.includes("production_approval_decision=deny"),
	);
	assert.ok(
		deniedCompatibility.refs.includes("production_approval_ref=approval-denied-123"),
	);
	assert.ok(
		deniedCompatibility.refs.includes("production_blocker=approval_denied"),
	);
	assertNoRuntimeAuthority(deniedApproval);

	assert.ok(
		compatibility.refs.includes(
			"production_uncertainty=opencode_subtask_lifecycle_unproven",
		),
	);
	assert.equal(
		response.provider_health_summary.dispatchability,
		"non_dispatchable",
	);
	assertNoRuntimeAuthority(result);
});

test("doctor and status surface default managed-dispatch promotion readiness without authority", () => {
	const readiness = promotionReadiness();
	const cacheRefresh = cacheRefreshPlan();
	const fanout = reviewerFanoutPlan();
	const doctor = evaluateFlowDeskCommandBackedHandlerV1(
		"flowdesk_doctor",
		doctorRequest(),
		{ diagnostic: { defaultManagedDispatchPromotionReadiness: readiness, exactModelAvailabilityCacheRefreshPlan: cacheRefresh, reviewerFanoutPlan: fanout } },
	);
	assert.equal(doctor.ok, true, doctor.errors.join("; "));
	const doctorResponse = doctor.response as FlowDeskDoctorResponseV1;
	const compatibility = doctorResponse.doctor_results.find(
		(section) => section.section === "opencode_plugin_compatibility",
	);
	assert.ok(compatibility);
	assert.ok(
		compatibility.refs.includes("default_dispatch_promotion_state=configured"),
	);
	assert.ok(
		compatibility.refs.includes("default_dispatch_candidate=false"),
	);
	assert.ok(
		compatibility.refs.includes("default_dispatch_durable_precall_ready=false"),
	);
	assert.ok(
		compatibility.refs.includes("default_dispatch_authority_enabled=false"),
	);
	assert.ok(
		compatibility.refs.includes("default_dispatch_providerCall=false"),
	);
	assert.ok(
		compatibility.refs.includes("default_dispatch_blocker=durable_precall_missing"),
	);
	assert.ok(
		compatibility.refs.includes("exact_model_cache_refresh_state=refresh_required"),
	);
	assert.ok(
		compatibility.refs.includes("exact_model_cache_refresh_reason=cache_missing"),
	);
	assert.ok(
		compatibility.refs.includes("exact_model_cache_providerCall=false"),
	);
	assert.ok(
		compatibility.refs.includes("reviewer_fanout_state=blocked"),
	);
	assert.ok(
		compatibility.refs.includes("reviewer_fanout_blocker=assignment_revalidation_blocked"),
	);
	assert.ok(
		compatibility.refs.includes("reviewer_fanout_actualLaneLaunch=false"),
	);
	assertNoRuntimeAuthority(doctor);

	const statusRequest = requestFixture("flowdesk_status");
	const status = evaluateFlowDeskCommandBackedHandlerV1(
		"flowdesk_status",
		{ ...statusRequest, detail_level: "diagnostic" },
		{
			status: {
				...statusContext(statusRequest),
				exactModelAvailabilityCacheRefreshPlan: cacheRefresh,
				defaultManagedDispatchPromotionReadiness: readiness,
				reviewerFanoutPlan: fanout,
			},
		},
	);
	assert.equal(status.ok, true, status.errors.join("; "));
	const statusResponse = status.response as { blocker?: { refs?: string[] } };
	assert.ok(statusResponse.blocker);
	assert.ok(
		statusResponse.blocker.refs?.includes("exact_model_cache_refresh_state=refresh_required"),
	);
	assert.ok(
		statusResponse.blocker.refs?.includes("exact_model_cache_refresh_reason=cache_missing"),
	);
	assertNoRuntimeAuthority(status);
});

test("doctor diagnostic handler scopes section checks without authorizing runtime", () => {
	const persisted = evaluateFlowDeskCommandBackedHandlerV1(
		"flowdesk_doctor",
		doctorRequest({ persist_report: true }),
	);
	assert.equal(persisted.ok, true);
	assert.equal(persisted.requestSchemaValid, true);
	assert.equal(
		(persisted.response as FlowDeskDoctorResponseV1).status,
		"degraded",
	);
	assertNoRuntimeAuthority(persisted);

	const install = evaluateFlowDeskCommandBackedHandlerV1(
		"flowdesk_doctor",
		doctorRequest({ check_scope: "install" }),
	);
	assert.equal(install.ok, true);
	const installResponse = install.response as FlowDeskDoctorResponseV1;
	assert.deepEqual(
		installResponse.doctor_results.map((section) => section.section),
		["migration_cleanup"],
	);
	assert.equal(installResponse.status, "diagnostic_only");
	assertNoRuntimeAuthority(install);

	const runtime = evaluateFlowDeskCommandBackedHandlerV1(
		"flowdesk_doctor",
		doctorRequest({ check_scope: "runtime" }),
	);
	assert.equal(runtime.ok, true);
	const runtimeResponse = runtime.response as FlowDeskDoctorResponseV1;
	assert.deepEqual(
		runtimeResponse.doctor_results.map((section) => section.section),
		["opencode_plugin_compatibility"],
	);
	assert.equal(runtimeResponse.status, "diagnostic_only");
	assertNoRuntimeAuthority(runtime);
});

test("doctor diagnostic handler rejects semantic request enum drift before response", () => {
	for (const request of [
		doctorRequest({ check_scope: "raw_provider_payload" }),
		doctorRequest({ profile: "production-admin" }),
	]) {
		const result = evaluateFlowDeskCommandBackedHandlerV1(
			"flowdesk_doctor",
			request,
		);
		assert.equal(result.handlerMode, "request_schema_invalid");
		assert.equal(result.ok, false);
		assert.equal(result.requestSchemaValid, false);
		assert.equal(result.responseSchemaValid, false);
		assert.equal(result.coreEvaluationOk, false);
		assert.equal(result.response, undefined);
		assertNoRuntimeAuthority(result);
	}
});

test("diagnostic handlers cover resume, abort, usage, and export-debug without runtime authority", () => {
	const cases: readonly FlowDeskRelease1MinimumToolName[] = [
		"flowdesk_resume",
		"flowdesk_abort",
		"flowdesk_usage",
		"flowdesk_export_debug",
	];
	for (const toolName of cases) {
		const result = evaluateFlowDeskCommandBackedHandlerV1(
			toolName,
			requestFixture(toolName),
			{
				diagnostic: {
					nowIso,
					deleteAfterIso: "2026-05-18T00:00:00.000Z",
					sourceRef: "source-123",
					providerHealthSnapshotRef: "health-123",
				},
			},
		);
		assert.equal(
			result.handlerMode,
			"command_backed_diagnostic_handler",
			toolName,
		);
		assert.equal(result.ok, true, toolName);
		assert.equal(result.requestSchemaValid, true, toolName);
		assert.equal(result.responseSchemaValid, true, toolName);
		assert.equal(result.coreEvaluationOk, true, toolName);
		assert.notEqual(result.response, undefined, toolName);
		assertNoRuntimeAuthority(result);
	}
});

test("usage diagnostic handler reports unknown usage as non-dispatchable", () => {
	const result = evaluateFlowDeskCommandBackedHandlerV1(
		"flowdesk_usage",
		requestFixture("flowdesk_usage"),
		{ diagnostic: { providerHealthSnapshotRef: "health-123" } },
	);
	assert.equal(result.handlerMode, "command_backed_diagnostic_handler");
	assert.equal(result.ok, true);
	const response = result.response as FlowDeskUsageResponseV1;
	assert.equal(response.freshness, "unknown");
	assert.equal(response.dispatchability, "non_dispatchable");
	assert.deepEqual(response.uncertainty_flags, ["unknown"]);
	assert.equal(response.provider_health_snapshot_ref, "health-123");
	assertNoRuntimeAuthority(result);
});

test("usage diagnostic handler excludes every concrete provider without auth and real usage evidence", () => {
	for (const provider_family of [
		"claude",
		"gemini",
		"openai",
		"opencode_go",
		"z_ai",
	] as const) {
		const result = evaluateFlowDeskCommandBackedHandlerV1(
			"flowdesk_usage",
			{ ...requestFixture("flowdesk_usage"), provider_family },
			{ diagnostic: { nowIso, sourceRef: "doctor-auth-readiness-123" } },
		);
		assert.equal(result.handlerMode, "command_backed_diagnostic_handler");
		assert.equal(result.ok, true);
		const response = result.response as FlowDeskUsageResponseV1;
		assert.equal(response.dispatchability, "non_dispatchable");
		assert.equal(
			response.provider_health_snapshot_ref,
			`health-auth-missing-${provider_family}-req-fds1-fixture`,
		);
		assert.match(response.user_message, /models are excluded/);
		assert.match(response.user_message, /usage\/quota\/reset evidence/);
		assert.equal(JSON.stringify(response).includes("provider_payload"), false);
		assertNoRuntimeAuthority(result);
	}
});

test("export-debug diagnostic handler returns redacted section summaries only", () => {
	const request = {
		...requestFixture("flowdesk_export_debug"),
		include_sections: ["doctor", "redaction_summary"],
		retention_hint: "keep_until_default_expiry",
	} as FlowDeskExportDebugRequestV1;
	const result = evaluateFlowDeskCommandBackedHandlerV1(
		"flowdesk_export_debug",
		request,
		{ diagnostic: { deleteAfterIso: "2026-05-18T00:00:00.000Z" } },
	);
	assert.equal(result.handlerMode, "command_backed_diagnostic_handler");
	assert.equal(result.ok, true);
	const response = result.response as {
		included_sections?: { section?: unknown; redaction_status?: unknown }[];
		delete_after?: unknown;
	};
	assert.deepEqual(
		response.included_sections?.map((section) => section.section),
		["doctor", "redaction_summary"],
	);
	assert.deepEqual(
		response.included_sections?.map((section) => section.redaction_status),
		["passed", "passed"],
	);
	assert.equal(response.delete_after, "2026-05-18T00:00:00.000Z");
	assert.equal(JSON.stringify(response).includes("/Users/"), false);
	assert.equal(JSON.stringify(response).includes("provider_payload"), false);
	assertNoRuntimeAuthority(result);
});
