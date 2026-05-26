import assert from "node:assert/strict";
import {
	existsSync,
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
	FLOWDESK_FDS1_FIXTURE_CATALOG,
	FLOWDESK_RELEASE_1_COMMAND_MANIFEST,
	planFlowDeskExactModelAvailabilityCacheAcquisitionV1,
	prepareFlowDeskSessionEvidenceWriteIntentV1,
	reloadFlowDeskSessionEvidenceV1,
} from "@flowdesk/core";
import { tool } from "@opencode-ai/plugin";
import {
	getFlowDeskPreSpikeProductionToolRegistry,
	hasPassingFds1SchemaConversionSpike,
	hasProductionOpenCodeRegistration,
} from "./index.js";
import { createFlowDeskLocalNonDispatchAdapterSession } from "./local-adapter.js";
import flowdeskOpenCodeServerPlugin, {
	createFlowDeskChatHookAuthorityProbeFromObservationV1,
	createFlowDeskFds1SchemaConversionProbeTools,
	createFlowDeskLocalNonDispatchAdapterTools,
	flowdeskChatIntakeToolName,
	flowdeskChatMessageStallAlertOption,
	flowdeskDurableStateRootOption,
	flowdeskExactModelProviderAcquisitionLiveTestOption,
	flowdeskExactModelProviderAcquisitionLiveTestToolName,
	flowdeskFds1SchemaConversionProbeOption,
	flowdeskLaneHeartbeatWriterOption,
	flowdeskLaneHeartbeatWriterToolName,
	flowdeskLocalNonDispatchAdapterOption,
	flowdeskManagedFallbackRegateOption,
	flowdeskManagedFallbackRegateToolName,
	flowdeskNaturalLanguageRoutingOption,
	flowdeskPreSpikeDoctorToolName,
	flowdeskProductionEnablementOption,
	flowdeskProjectConfigOption,
	flowdeskProviderUsageLiveOption,
	flowdeskProviderUsageLiveToolName,
	flowdeskQuickFallbackRunOption,
	flowdeskQuickFallbackRunToolName,
	flowdeskQuickReviewerRunOption,
	flowdeskQuickReviewerRunToolName,
	flowdeskReviewerFanoutDiagnosticsOption,
	flowdeskRuntimeReviewerExecutionOption,
	flowdeskRuntimeReviewerExecutionToolName,
	flowdeskStatusLiveOption,
	flowdeskStatusLiveToolName,
} from "./server.js";

const now = "2026-05-17T00:00:00.000Z";

function release1ProjectConfig(overrides: Record<string, unknown> = {}) {
	return {
		schema_version: "flowdesk.project_config.v1",
		config_id: "config-test",
		created_at: now,
		updated_at: now,
		release_mode: "release1",
		project_root_ref: "project-root-test",
		config_hash: "config-hash-test",
		policy_pack_refs: [],
		policy_pack_hashes: [],
		chat_intake_mode: "steering",
		hook_harness_mode: "enforce",
		retention: {
			session_records_max_days: 14,
			debug_staging_max_days: 7,
			conformance_summary_max_days: 30,
			allow_user_longer_retention: false,
			deletion_behavior: "delete_after_expiry",
		},
		usage_policy: {
			usage_freshness_ttl_minutes: 15,
			unknown_usage_dispatchability: "non_dispatchable",
			stale_usage_dispatchability: "non_dispatchable",
			refused_usage_dispatchability: "non_dispatchable",
			shared_limit_suspected_dispatchability: "non_dispatchable",
			fallback_derived_dispatchability: "non_dispatchable",
			allow_local_history_source: false,
			allow_provider_console_scraping: false,
		},
		provider_health_policy: {
			health_freshness_ttl_minutes: 15,
			unavailable_dispatchability: "non_dispatchable",
			degraded_dispatchability: "diagnostic_only",
			opencode_go_usage_without_official_quota: "unknown",
			z_ai_usage_without_official_quota: "unknown",
			allow_automatic_provider_fallback: false,
		},
		disabled_modes: [
			"real_dispatch",
			"managed_fallback",
			"lane_launch",
			"hard_chat_blocking",
		],
		extension_namespaces: ["flowdesk.core"],
		audit_refs: ["audit-config-test"],
		...overrides,
	};
}

function release1PolicyPack(overrides: Record<string, unknown> = {}) {
	return {
		schema_version: "flowdesk.policy_pack.v1",
		policy_pack_id: "policy-test",
		policy_pack_hash: "policy-hash-test",
		name: "Test policy pack",
		version: "1.0.0",
		source_ref: "policy-source-test",
		applies_to_release_modes: ["release1"],
		priority: 1,
		rules: [
			{
				rule_id: "rule-test-approval",
				effect: "require_approval",
				target: "permission_class",
				summary_label: "Require scoped non-dispatch approval for tests.",
				refs: ["approval-test"],
			},
		],
		hard_ban_refs: ["ban-real-dispatch-test"],
		allowed_extension_namespaces: ["flowdesk.core"],
		redaction_baseline_ref: "redaction-test",
		...overrides,
	};
}

interface LocalAdapterTestResult {
	adapterProfile?: unknown;
	handler?: {
		ok?: unknown;
		handlerMode?: unknown;
		errors?: unknown[];
		responseSchemaValid?: unknown;
		response?: {
			status?: unknown;
			doctor_results?: { section?: unknown; refs?: string[] }[];
			blocker?: { refs?: string[] };
			plan_revision_id?: unknown;
			workflow_id?: unknown;
			workflow_state?: unknown;
		};
	};
	localState?: {
		stateWriteApplied?: unknown;
		workflowId?: unknown;
		workflowState?: unknown;
		pendingConfirmationStatus?: unknown;
		pendingConfirmationRef?: unknown;
		pendingConfirmationWorkflowId?: unknown;
		pendingConfirmationExpiresAt?: unknown;
		durableStateMode?: unknown;
		durableStateWriteApplied?: unknown;
		durableStateWrites?: unknown;
		permissionSource?: unknown;
	};
	providerCall?: unknown;
	runtimeExecution?: unknown;
	actualLaneLaunch?: unknown;
}

interface NaturalLanguageRoutingTestResult {
	ok?: unknown;
	evaluation?: {
		response?: {
			ok?: unknown;
			route_decision?: unknown;
			safe_next_actions?: unknown[];
			classification?: unknown;
		};
	};
	routedToolName?: unknown;
	routedToolResult?: LocalAdapterTestResult;
	providerCall?: unknown;
	runtimeExecution?: unknown;
	actualLaneLaunch?: unknown;
	fallbackAuthority?: unknown;
	hardCancelOrNoReplyAuthority?: unknown;
}

interface ChatMessageHooks {
	tool?: Record<
		string,
		{
			execute(
				request: unknown,
				context: unknown,
			): Promise<string | { output: string }>;
			description: string;
			args: Record<string, unknown>;
		}
	>;
	"chat.message"?: (
		input: unknown,
		output: { parts?: unknown[] },
	) => Promise<void>;
}

function toolOutput(value: string | { output: string }): string {
	return typeof value === "string" ? value : value.output;
}

function exactModelAvailabilityCacheRecord(
	overrides: Record<string, unknown> = {},
) {
	return {
		schema_version: "flowdesk.exact_model_availability_cache.v1",
		cache_id: "cache-1",
		local_date: "2026-05-19",
		active_profile_ref: "profile-1",
		opencode_version_ref: "opencode-1.15.6",
		flowdesk_package_version_ref: "flowdesk-0.1.1",
		registry_hash: "hash-registry-1",
		policy_pack_hash: "hash-policy-1",
		auth_account_boundary_ref: "account-1",
		entries: [
			{
				entry_id: "entry-claude-1",
				provider_family: "claude",
				provider_identity_ref: "provider-claude-1",
				provider_qualified_model_id: "claude/claude-opus-4-5",
				model_family: "opus",
				registered: true,
				available: true,
				highest_tier_eligible: true,
				availability_ref: "availability-1",
			},
		],
		dispatch_authority_enabled: false,
		providerCall: false,
		actualLaneLaunch: false,
		runtimeExecution: false,
		...overrides,
	};
}

function exactModelAvailabilityCacheRefreshPlanRecord(
	overrides: Record<string, unknown> = {},
) {
	return {
		schema_version: "flowdesk.exact_model_availability_cache_refresh_plan.v1",
		ok: true,
		errors: [],
		state: "cache_hit",
		blocked_labels: [],
		refresh_reason_labels: [],
		expected_local_date: "2026-05-19",
		expected_active_profile_ref: "profile-1",
		expected_opencode_version_ref: "opencode-1.15.6",
		expected_flowdesk_package_version_ref: "flowdesk-0.1.1",
		expected_registry_hash: "hash-registry-1",
		expected_policy_pack_hash: "hash-policy-1",
		expected_auth_account_boundary_ref: "account-1",
		cache_id: "cache-1",
		cache_local_date: "2026-05-19",
		cache_active_profile_ref: "profile-1",
		cache_opencode_version_ref: "opencode-1.15.6",
		cache_flowdesk_package_version_ref: "flowdesk-0.1.1",
		cache_registry_hash: "hash-registry-1",
		cache_policy_pack_hash: "hash-policy-1",
		cache_auth_account_boundary_ref: "account-1",
		discovery_required: false,
		refresh_required: false,
		cache_usable_for_assignment: true,
		discovery_attempted: false,
		refresh_attempted: false,
		dispatch_authority_enabled: false,
		providerCall: false,
		actualLaneLaunch: false,
		runtimeExecution: false,
		...overrides,
	};
}

function runtimeLaneLaunchPlanRecord(overrides: Record<string, unknown> = {}) {
	return {
		schema_version: "flowdesk.runtime_lane_launch_plan.v1",
		ok: true,
		errors: [],
		launch_request_id: "launch-request-runtime-reviewer-1",
		workflow_id: "workflow-runtime-reviewer-execution",
		attempt_id: "attempt-runtime-reviewer-execution",
		lane_id: "lane-runtime-reviewer-1",
		state: "launch_ready",
		blocked_labels: [],
		parent_session_ref: "ses-parent-runtime-reviewer",
		agent_ref: "agent-reviewer-gpt-frontier",
		provider_qualified_model_id: "openai/gpt-5.4-mini-fast",
		launch_reason: "reviewer_fanout",
		pre_launch_audit_ref: "audit-runtime-reviewer-1",
		lane_launch_approval_ref: "approval-runtime-reviewer-1",
		durable_evidence_root_ref: "evidence-root-runtime-reviewer",
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

function reviewerVerdictRecord(perspective: string) {
	return {
		schema_version: "flowdesk.top_tier_review_verdict.v1",
		verdict_id: `verdict-${perspective}-runtime-reviewer`,
		workflow_id: "workflow-runtime-reviewer-execution",
		lane_plan_ref: `lane-plan-${perspective}-runtime-reviewer`,
		binding_ref: `binding-${perspective}-runtime-reviewer`,
		perspective,
		source: "gpt_frontier",
		created_at: now,
		redaction_version: "redaction-v1",
		findings: [],
		evidence_refs: [`evidence-${perspective}-runtime-reviewer`],
		uncertainty: "low",
		required_fixes: [],
		verdict_label: "pass",
		safe_next_actions: ["/flowdesk-status"],
		dispatch_authority_enabled: false,
	};
}

function consumedReviewerFanoutApprovalRecord() {
	const result = consumeFlowDeskProductionApprovalSourceV1({
		approval: {
			schema_version: "flowdesk.production_approval_source.v1",
			approval_id: "approval-runtime-reviewer-fanout",
			workflow_id: "workflow-runtime-reviewer-execution",
			attempt_id: "attempt-runtime-reviewer-execution",
			action_type: "reviewer_fanout",
			issuer_boundary: "external_user_confirmation",
			approval_method: "typed_phrase",
			actor_ref: "actor-runtime-reviewer",
			profile_ref: "profile-runtime-reviewer",
			provider_qualified_model_id: "openai/gpt-5.4-mini-fast",
			provider_binding_hash: "hash-provider-runtime-reviewer",
			evidence_bundle_hash: "hash-evidence-runtime-reviewer",
			guard_decision_ref: "guard-runtime-reviewer",
			issuance_audit_ref: "audit-issuance-runtime-reviewer",
			nonce_ref: "nonce-runtime-reviewer",
			issued_at: "2026-05-17T00:00:00.000Z",
			expires_at: "2026-05-17T00:10:00.000Z",
			revoked: false,
			consume_strategy: "atomic_compare_and_swap_required",
			dispatch_authority_enabled: false,
		},
		workflowId: "workflow-runtime-reviewer-execution",
		attemptId: "attempt-runtime-reviewer-execution",
		actionType: "reviewer_fanout",
		actorRef: "actor-runtime-reviewer",
		profileRef: "profile-runtime-reviewer",
		providerQualifiedModelId: "openai/gpt-5.4-mini-fast",
		providerBindingHash: "hash-provider-runtime-reviewer",
		evidenceBundleHash: "hash-evidence-runtime-reviewer",
		guardDecisionRef: "guard-runtime-reviewer",
		consumptionAuditRef: "audit-consumption-runtime-reviewer",
		consumedAt: "2026-05-17T00:05:00.000Z",
	});
	assert.ok(result.consumed_approval, result.errors.join("; "));
	return result.consumed_approval;
}

function fakeRuntimeReviewerExecutionClient() {
	const createCalls: unknown[] = [];
	const promptCalls: unknown[] = [];
	const messageCalls: unknown[] = [];
	const childPerspectives = new Map<string, string>();
	let next = 0;
	const perspectives = [
		"policy_security",
		"architecture",
		"verification_implementation",
	];
	return {
		client: {
			session: {
				create(options: unknown) {
					createCalls.push(options);
					const perspective = perspectives[next++] ?? "policy_security";
					const childId = `child-runtime-reviewer-${perspective}`;
					childPerspectives.set(childId, perspective);
					return Promise.resolve({ id: childId });
				},
				prompt(options: unknown) {
					promptCalls.push(options);
					return Promise.resolve({ info: { id: "message-runtime-reviewer" } });
				},
				messages(options: unknown) {
					messageCalls.push(options);
					const sessionID = (options as { sessionID?: string }).sessionID ?? "";
					const perspective =
						childPerspectives.get(sessionID) ?? "policy_security";
					return Promise.resolve([
						{
							info: { id: `message-verdict-${perspective}` },
							parts: [
								{
									type: "text",
									text: JSON.stringify(reviewerVerdictRecord(perspective)),
								},
							],
						},
					]);
				},
			},
		},
		createCalls,
		promptCalls,
		messageCalls,
	};
}

function runtimeReviewerExecutionExpectation(perspective: string) {
	return {
		launchPlanEvidenceId: `launch-plan-${perspective}-runtime-reviewer`,
		lanePlanRef: `lane-plan-${perspective}-runtime-reviewer`,
		bindingRef: `binding-${perspective}-runtime-reviewer`,
		perspective,
		promptText: `Return typed FlowDesk reviewer verdict for ${perspective}.`,
		runningLifecycleEvidenceId: `lifecycle-running-${perspective}-runtime-reviewer`,
		completeLifecycleEvidenceId: `lifecycle-complete-${perspective}-runtime-reviewer`,
		reviewerVerdictEvidenceId: `reviewer-verdict-${perspective}-runtime-reviewer`,
		outputRef: `output-${perspective}-runtime-reviewer`,
		runtimeEchoRef: `runtime-echo-${perspective}-runtime-reviewer`,
		telemetryRef: `telemetry-${perspective}-runtime-reviewer`,
	};
}

function exactModelAvailabilityCacheAcquisitionPlanRecord() {
	return planFlowDeskExactModelAvailabilityCacheAcquisitionV1({
		refreshPlan: exactModelAvailabilityCacheRefreshPlanRecord({
			state: "refresh_required",
			refresh_reason_labels: ["cache_missing"],
			cache_id: undefined,
			cache_local_date: undefined,
			cache_active_profile_ref: undefined,
			cache_opencode_version_ref: undefined,
			cache_flowdesk_package_version_ref: undefined,
			cache_registry_hash: undefined,
			cache_policy_pack_hash: undefined,
			cache_auth_account_boundary_ref: undefined,
			discovery_required: true,
			refresh_required: true,
			cache_usable_for_assignment: false,
		}) as Parameters<
			typeof planFlowDeskExactModelAvailabilityCacheAcquisitionV1
		>[0]["refreshPlan"],
	});
}

function exactModelProviderAcquisitionToolRequest(
	overrides: Record<string, unknown> = {},
) {
	return {
		workflowId: "workflow-provider-acquisition-1",
		evidenceId: "provider-acquisition-evidence-1",
		acquisitionPlan: exactModelAvailabilityCacheAcquisitionPlanRecord(),
		resultId: "provider-acquisition-result-1",
		localDate: "2026-05-19",
		activeProfileRef: "profile-1",
		opencodeVersionRef: "opencode-1.15.6",
		flowdeskPackageVersionRef: "flowdesk-0.1.1",
		registryHash: "hash-registry-1",
		policyPackHash: "hash-policy-1",
		authAccountBoundaryRef: "account-1",
		providerFamily: "claude",
		providerIdentityRef: "provider-claude-1",
		providerQualifiedModelId: "claude/claude-opus-4-5",
		modelFamily: "opus",
		availabilityRef: "availability-planned-1",
		preCallAuditRef: "audit-provider-acquisition-1",
		idempotencyRef: "idempotency-provider-acquisition-1",
		liveTestRunRef: "live-test-run-1",
		redactionProofRef: "redaction-proof-1",
		observedAt: "2026-05-19T00:00:00.000Z",
		...overrides,
	};
}

function promptBackedAcquisitionOpenCodeClient(
	input: {
		metadataAvailable?: boolean;
		promptThrows?: boolean;
		promptResponse?: unknown;
		promptAsync?: boolean;
	} = {},
) {
	const metadataCalls: string[] = [];
	const promptCalls: unknown[] = [];
	const prompt = (options: unknown) => {
		promptCalls.push(options);
		if (input.promptThrows)
			throw new Error("provider response token secret raw failure");
		return (
			input.promptResponse ?? { data: { text: "RAW_MODEL_SECRET_RESPONSE" } }
		);
	};
	const client = {
		config: {
			providers(parameters?: { directory?: string }) {
				metadataCalls.push(
					`config.providers:${parameters?.directory ?? "none"}`,
				);
				return {
					data: {
						providers:
							input.metadataAvailable === false
								? []
								: [
										{
											id: "anthropic",
											models: { "claude-opus-4-5": { id: "claude-opus-4-5" } },
										},
									],
					},
				};
			},
		},
		provider: {
			list(parameters?: { directory?: string }) {
				metadataCalls.push(`provider.list:${parameters?.directory ?? "none"}`);
				return {
					data: {
						all:
							input.metadataAvailable === false
								? []
								: [
										{
											id: "anthropic",
											models: { "claude-opus-4-5": { id: "claude-opus-4-5" } },
										},
									],
						connected: input.metadataAvailable === false ? [] : ["anthropic"],
					},
				};
			},
			auth(parameters?: { directory?: string }) {
				metadataCalls.push(`provider.auth:${parameters?.directory ?? "none"}`);
				return {
					data:
						input.metadataAvailable === false
							? {}
							: { anthropic: [{ type: "oauth" }] },
				};
			},
		},
		session:
			input.promptAsync === false
				? { prompt }
				: {
						promptAsync: prompt,
						prompt() {
							throw new Error("prompt fallback should not run");
						},
					},
	};
	return { client, metadataCalls, promptCalls };
}

async function executeProviderAcquisitionTool(input: {
	root: string;
	client: unknown;
	promptBackedCheck: Record<string, unknown>;
	cacheMaterialization?: Record<string, unknown>;
	request?: Record<string, unknown>;
}) {
	const hooks = await flowdeskOpenCodeServerPlugin.server(
		{ client: input.client, directory: "/flowdesk-project" } as never,
		{
			[flowdeskExactModelProviderAcquisitionLiveTestOption]: {
				enabled: true,
				durableStateRoot: input.root,
				promptBackedCheck: input.promptBackedCheck,
				...(input.cacheMaterialization === undefined
					? {}
					: { cacheMaterialization: input.cacheMaterialization }),
			},
			localNonDispatchAdapter: false,
			naturalLanguageRouting: false,
		},
	);
	const liveTool =
		hooks.tool?.[flowdeskExactModelProviderAcquisitionLiveTestToolName];
	assert.ok(liveTool);
	const raw = await liveTool.execute(
		{
			request: exactModelProviderAcquisitionToolRequest(input.request),
		},
		undefined as never,
	);
	return JSON.parse(toolOutput(raw)) as Record<string, unknown>;
}

function writeSessionEvidence(
	root: string,
	workflowId: string,
	records: Record<string, unknown>[],
) {
	const intents = records.map((record, index) => {
		const prepared = prepareFlowDeskSessionEvidenceWriteIntentV1({
			workflowId,
			evidenceId: `reviewer-evidence-${index + 1}`,
			record,
		});
		assert.equal(prepared.ok, true, prepared.errors.join("; "));
		assert.ok(prepared.writeIntent);
		return prepared.writeIntent;
	});
	const applied = applyFlowDeskSessionEvidenceWriteIntentsV1(root, intents);
	assert.equal(applied.ok, true, applied.errors.join("; "));
}

test("server plugin defaults to safe local command-backed chat mode", async () => {
	assert.equal(flowdeskOpenCodeServerPlugin.id, "flowdesk");
	assert.equal(hasProductionOpenCodeRegistration(), true);
	assert.equal(hasPassingFds1SchemaConversionSpike(), true);
	assert.equal(getFlowDeskPreSpikeProductionToolRegistry().length, 0);

	const hooks = await flowdeskOpenCodeServerPlugin.server(undefined as never);
	assert.deepEqual(Object.keys(hooks.tool ?? {}), [
		flowdeskPreSpikeDoctorToolName,
		...FLOWDESK_RELEASE_1_COMMAND_MANIFEST.map((entry) => entry.toolName),
		flowdeskChatIntakeToolName,
	]);
	assert.ok((hooks as ChatMessageHooks)["chat.message"]);

	const doctor = hooks.tool?.[flowdeskPreSpikeDoctorToolName];
	assert.ok(doctor);
	assert.equal(
		doctor.description.includes("without enabling real dispatch"),
		true,
	);
	assert.deepEqual(doctor.args, {});

	const result = JSON.parse(
		toolOutput(await doctor.execute({}, undefined as never)),
	) as Record<string, unknown>;
	assert.equal(result.pluginId, "flowdesk");
	assert.equal(result.loaded, true);
	assert.equal(result.probeRegistrationProfile, "disabled");
	assert.equal(
		result.localNonDispatchAdapterProfile,
		"local_non_dispatch_command_adapter",
	);
	assert.equal(
		result.naturalLanguageRoutingProfile,
		"chat_steering_command_backed_non_dispatch",
	);
	assert.equal(
		result.productionPromotionGate,
		"release1_non_dispatch_command_registration_ready",
	);
	assert.equal(result.productionOpenCodeRegistration, true);
	assert.equal(
		result.productionToolRegistration,
		"release1-non-dispatch-command-backed",
	);
	assert.deepEqual(result.release1HandlerReadiness, {
		totalTools: 9,
		diagnosticScaffoldAvailable: 5,
		coreEvaluatorAvailable: 4,
		schemaOnlyPending: 0,
		productionReady: true,
		productionPromotionGate: "release1_command_backed_handlers_ready",
	});
	assert.deepEqual(result.release1ProductionReadiness, {
		totalChecks: 8,
		passedChecks: 8,
		blockedChecks: 0,
		productionReady: true,
		productionPromotionGate: "release1_non_dispatch_registration_ready",
		blockedReasons: [],
		productionRegistrationEligible: true,
		realOpenCodeDispatch: false,
		actualLaneLaunch: false,
		providerCall: false,
		runtimeExecution: false,
		fallbackAuthority: false,
		hardCancelOrNoReplyAuthority: false,
	});
	assert.equal(result.fds1SchemaConversionSpikePassed, true);
	assert.equal(result.realOpenCodeDispatch, "disabled");
	assert.equal(result.providerCall, false);
	assert.equal(result.runtimeExecution, false);
	assert.equal(result.actualLaneLaunch, false);
	assert.equal(result.fallbackAuthority, false);
	assert.equal(result.hardCancelOrNoReplyAuthority, false);
});

test("exact-model provider acquisition live-test tool is explicit opt-in and writes redacted evidence", async () => {
	const root = mkdtempSync(join(tmpdir(), "flowdesk-provider-acquisition-"));
	const calls: unknown[] = [];
	try {
		const defaultHooks = await flowdeskOpenCodeServerPlugin.server(
			undefined as never,
		);
		assert.equal(
			Object.keys(defaultHooks.tool ?? {}).includes(
				flowdeskExactModelProviderAcquisitionLiveTestToolName,
			),
			false,
		);

		const hooks = await flowdeskOpenCodeServerPlugin.server(
			undefined as never,
			{
				[flowdeskExactModelProviderAcquisitionLiveTestOption]: {
					enabled: true,
					durableStateRoot: root,
					client: {
						checkExactModelAvailability(request: unknown) {
							calls.push(request);
							return {
								outcome: "available",
								sanitized_provider_result_ref: "provider-result-redacted-1",
								availability_ref: "availability-live-1",
								highest_tier_eligible: true,
							};
						},
					},
				},
				localNonDispatchAdapter: false,
				naturalLanguageRouting: false,
			},
		);
		const liveTool =
			hooks.tool?.[flowdeskExactModelProviderAcquisitionLiveTestToolName];
		assert.ok(liveTool);
		const raw = await liveTool.execute(
			{
				request: exactModelProviderAcquisitionToolRequest(),
			},
			undefined as never,
		);
		const result = JSON.parse(toolOutput(raw)) as Record<string, unknown>;
		assert.equal(result.status, "provider_acquisition_recorded");
		assert.equal(result.providerCallAttempted, true);
		assert.equal(result.writeAttempted, true);
		assert.equal(result.evidenceReloaded, true);
		assert.equal(
			(result.authority as Record<string, unknown>).providerCall,
			false,
		);
		assert.equal(
			(result.authority as Record<string, unknown>).dispatchAuthorityEnabled,
			false,
		);
		assert.equal(
			result.sanitizedProviderResultRef,
			"provider-result-redacted-1",
		);
		assert.equal("cacheMaterialization" in result, false);
		assert.equal("result" in result, false);
		assert.equal(calls.length, 1);
		const reloaded = reloadFlowDeskSessionEvidenceV1({
			workflowId: "workflow-provider-acquisition-1",
			rootDir: root,
		});
		assert.equal(reloaded.ok, true, reloaded.errors.join("; "));
		assert.equal(
			reloaded.entries.some(
				(entry) =>
					entry.evidenceClass ===
					"exact_model_availability_cache_provider_acquisition_result",
			),
			true,
		);
		assert.equal(
			reloaded.entries.some(
				(entry) => entry.evidenceClass === "exact_model_availability_cache",
			),
			false,
		);
		assert.equal(
			reloaded.entries.some(
				(entry) =>
					entry.evidenceClass === "exact_model_availability_cache_refresh_plan",
			),
			false,
		);
	} finally {
		rmSync(root, { recursive: true, force: true });
	}
});

test("exact-model provider acquisition cache materialization is explicit opt-in and writes selected-pair evidence", async () => {
	const root = mkdtempSync(
		join(tmpdir(), "flowdesk-provider-acquisition-cache-materialization-"),
	);
	try {
		const hooks = await flowdeskOpenCodeServerPlugin.server(
			undefined as never,
			{
				[flowdeskExactModelProviderAcquisitionLiveTestOption]: {
					enabled: true,
					durableStateRoot: root,
					cacheMaterialization: {
						enabled: true,
						targetCacheEvidenceId: "cache-from-provider-live-1",
						targetCacheRefreshPlanEvidenceId:
							"cache-refresh-from-provider-live-1",
						cacheId: "cache-from-provider-live-1",
						entryId: "entry-from-provider-live-1",
					},
					client: {
						checkExactModelAvailability() {
							return {
								outcome: "available",
								sanitized_provider_result_ref:
									"provider-result-redacted-cache-1",
								availability_ref: "availability-live-cache-1",
								highest_tier_eligible: true,
							};
						},
					},
				},
				localNonDispatchAdapter: false,
				naturalLanguageRouting: false,
			},
		);
		const liveTool =
			hooks.tool?.[flowdeskExactModelProviderAcquisitionLiveTestToolName];
		assert.ok(liveTool);
		const raw = await liveTool.execute(
			{
				request: exactModelProviderAcquisitionToolRequest({
					workflowId: "workflow-provider-acquisition-cache-1",
					evidenceId: "provider-acquisition-cache-evidence-1",
					resultId: "provider-acquisition-cache-result-1",
				}),
			},
			undefined as never,
		);
		const result = JSON.parse(toolOutput(raw)) as Record<string, unknown>;
		assert.equal(result.status, "provider_acquisition_recorded");
		assert.equal(result.providerCallAttempted, true);
		assert.equal(result.writeAttempted, true);
		assert.equal(result.evidenceReloaded, true);
		assert.deepEqual(result.cacheMaterialization, {
			state: "materialized",
			blockedLabels: [],
			targetCacheEvidenceId: "cache-from-provider-live-1",
			targetCacheRefreshPlanEvidenceId: "cache-refresh-from-provider-live-1",
			cacheId: "cache-from-provider-live-1",
			entryId: "entry-from-provider-live-1",
			availabilityRef: "availability-live-cache-1",
			sanitizedProviderResultRef: "provider-result-redacted-cache-1",
			selectionState: "pair_ready",
			pairSelectionReady: true,
		});
		assert.equal(
			"reviewerFanoutPlanning" in
				(result.cacheMaterialization as Record<string, unknown>),
			false,
		);

		const reloaded = reloadFlowDeskSessionEvidenceV1({
			workflowId: "workflow-provider-acquisition-cache-1",
			rootDir: root,
		});
		assert.equal(reloaded.ok, true, reloaded.errors.join("; "));
		assert.equal(
			reloaded.entries.filter(
				(entry) =>
					entry.evidenceClass ===
					"exact_model_availability_cache_provider_acquisition_result",
			).length,
			1,
		);
		assert.equal(
			reloaded.entries.filter(
				(entry) => entry.evidenceClass === "exact_model_availability_cache",
			).length,
			1,
		);
		assert.equal(
			reloaded.entries.filter(
				(entry) =>
					entry.evidenceClass === "exact_model_availability_cache_refresh_plan",
			).length,
			1,
		);
	} finally {
		rmSync(root, { recursive: true, force: true });
	}
});

test("exact-model provider acquisition cache materialization can derive reviewer fanout and runtime launch-plan evidence without lane launch", async () => {
	const root = mkdtempSync(
		join(tmpdir(), "flowdesk-provider-acquisition-cache-fanout-"),
	);
	try {
		const hooks = await flowdeskOpenCodeServerPlugin.server(
			undefined as never,
			{
				[flowdeskExactModelProviderAcquisitionLiveTestOption]: {
					enabled: true,
					durableStateRoot: root,
					cacheMaterialization: {
						enabled: true,
						targetCacheEvidenceId: "cache-from-provider-live-fanout",
						targetCacheRefreshPlanEvidenceId:
							"cache-refresh-from-provider-live-fanout",
						cacheId: "cache-from-provider-live-fanout",
						entryId: "entry-from-provider-live-fanout",
						reviewerFanoutPlanning: {
							enabled: true,
							attemptId: "attempt-provider-live-fanout",
							parentSessionRef: "ses-provider-live-fanout-parent",
							agentRef: "agent-reviewer-provider-live-fanout",
							requestedAt: "2026-05-19T00:02:00.000Z",
							preLaunchAuditRef: "audit-provider-live-fanout-1",
							laneLaunchApprovalRef: "approval-provider-live-fanout-1",
							persistDerivedFanoutPlanEvidence: true,
							fanoutPlanEvidenceId: "fanout-from-provider-live-1",
							runtimeLaunchPlanMaterialization: {
								enabled: true,
								targetLaunchPlanEvidenceIds: [
									"launch-plan-from-provider-policy",
									"launch-plan-from-provider-architecture",
									"launch-plan-from-provider-verification",
								],
								sdkClientAvailable: true,
								durableEvidenceRootRef: "evidence-root-provider-live-fanout",
							},
						},
					},
					client: {
						checkExactModelAvailability() {
							return {
								outcome: "available",
								sanitized_provider_result_ref:
									"provider-result-redacted-fanout-1",
								availability_ref: "availability-live-fanout-1",
								highest_tier_eligible: true,
							};
						},
					},
				},
				localNonDispatchAdapter: false,
				naturalLanguageRouting: false,
			},
		);
		const liveTool =
			hooks.tool?.[flowdeskExactModelProviderAcquisitionLiveTestToolName];
		assert.ok(liveTool);
		const raw = await liveTool.execute(
			{
				request: exactModelProviderAcquisitionToolRequest({
					workflowId: "workflow-provider-acquisition-cache-fanout",
					evidenceId: "provider-acquisition-cache-fanout-evidence-1",
					resultId: "provider-acquisition-cache-fanout-result-1",
				}),
			},
			undefined as never,
		);
		const result = JSON.parse(toolOutput(raw)) as Record<string, unknown>;
		assert.equal(result.status, "provider_acquisition_recorded");
		const materialization = result.cacheMaterialization as Record<
			string,
			unknown
		>;
		assert.equal(materialization.state, "materialized");
		assert.equal(materialization.pairSelectionReady, true);
		assert.deepEqual(materialization.reviewerFanoutPlanning, {
			state: "fanout_ready",
			blockedLabels: [],
			fanoutPlanState: "fanout_ready",
			plannedPerspectives: [
				"policy_security",
				"architecture",
				"verification_implementation",
			],
			runtimeLaneLaunchRequests: 3,
			launchAttempted: false,
			approvalInferred: false,
			actualLaneLaunch: false,
			providerCall: false,
			runtimeExecution: false,
			persisted: true,
			persistedEvidenceId: "fanout-from-provider-live-1",
			persistErrors: [],
			runtimeLaunchPlanMaterialization: {
				state: "materialized",
				blockedLabels: [],
				targetLaunchPlanEvidenceIds: [
					"launch-plan-from-provider-policy",
					"launch-plan-from-provider-architecture",
					"launch-plan-from-provider-verification",
				],
				launchPlanStates: ["launch_ready", "launch_ready", "launch_ready"],
				launchPlanCount: 3,
				writeIntentCount: 3,
				launchAttempted: false,
				actualLaneLaunch: false,
				providerCall: false,
				runtimeExecution: false,
			},
		});

		const reloaded = reloadFlowDeskSessionEvidenceV1({
			workflowId: "workflow-provider-acquisition-cache-fanout",
			rootDir: root,
		});
		assert.equal(reloaded.ok, true, reloaded.errors.join("; "));
		assert.equal(
			reloaded.entries.filter(
				(entry) => entry.evidenceClass === "reviewer_fanout_plan",
			).length,
			1,
		);
		const fanoutPlan = reloaded.entries.find(
			(entry) => entry.evidenceClass === "reviewer_fanout_plan",
		);
		assert.equal(fanoutPlan?.evidenceId, "fanout-from-provider-live-1");
		assert.equal(fanoutPlan?.record.state, "fanout_ready");
		assert.equal(fanoutPlan?.record.actualLaneLaunch, false);
		assert.equal(fanoutPlan?.record.providerCall, false);
		assert.equal(fanoutPlan?.record.runtimeExecution, false);
		const launchPlans = reloaded.entries.filter(
			(entry) => entry.evidenceClass === "runtime_lane_launch_plan",
		);
		assert.equal(launchPlans.length, 3);
		assert.deepEqual(
			new Set(launchPlans.map((entry) => entry.evidenceId)),
			new Set([
				"launch-plan-from-provider-policy",
				"launch-plan-from-provider-architecture",
				"launch-plan-from-provider-verification",
			]),
		);
		assert.equal(
			launchPlans.every((entry) => entry.record.state === "launch_ready"),
			true,
		);
		assert.equal(
			launchPlans.every((entry) => entry.record.launch_attempted === false),
			true,
		);
	} finally {
		rmSync(root, { recursive: true, force: true });
	}
});

test("exact-model provider acquisition runtime launch-plan materialization requires explicit nested opt-in and launch prerequisites", async () => {
	const noRuntimeRoot = mkdtempSync(
		join(tmpdir(), "flowdesk-provider-acquisition-cache-fanout-no-runtime-"),
	);
	try {
		const hooks = await flowdeskOpenCodeServerPlugin.server(
			undefined as never,
			{
				[flowdeskExactModelProviderAcquisitionLiveTestOption]: {
					enabled: true,
					durableStateRoot: noRuntimeRoot,
					cacheMaterialization: {
						enabled: true,
						targetCacheEvidenceId: "cache-from-provider-live-no-runtime",
						targetCacheRefreshPlanEvidenceId:
							"cache-refresh-from-provider-live-no-runtime",
						cacheId: "cache-from-provider-live-no-runtime",
						entryId: "entry-from-provider-live-no-runtime",
						reviewerFanoutPlanning: {
							enabled: true,
							attemptId: "attempt-provider-live-no-runtime",
							parentSessionRef: "ses-provider-live-no-runtime-parent",
							agentRef: "agent-reviewer-provider-live-no-runtime",
							requestedAt: "2026-05-19T00:03:00.000Z",
							preLaunchAuditRef: "audit-provider-live-no-runtime-1",
							laneLaunchApprovalRef: "approval-provider-live-no-runtime-1",
							persistDerivedFanoutPlanEvidence: true,
							fanoutPlanEvidenceId: "fanout-from-provider-live-no-runtime-1",
						},
					},
					client: {
						checkExactModelAvailability() {
							return {
								outcome: "available",
								sanitized_provider_result_ref:
									"provider-result-redacted-no-runtime-1",
								availability_ref: "availability-live-no-runtime-1",
								highest_tier_eligible: true,
							};
						},
					},
				},
				localNonDispatchAdapter: false,
				naturalLanguageRouting: false,
			},
		);
		const liveTool =
			hooks.tool?.[flowdeskExactModelProviderAcquisitionLiveTestToolName];
		assert.ok(liveTool);
		const raw = await liveTool.execute(
			{
				request: exactModelProviderAcquisitionToolRequest({
					workflowId: "workflow-provider-acquisition-no-runtime",
					evidenceId: "provider-acquisition-no-runtime-evidence-1",
					resultId: "provider-acquisition-no-runtime-result-1",
				}),
			},
			undefined as never,
		);
		const result = JSON.parse(toolOutput(raw)) as Record<string, unknown>;
		const reviewerFanoutPlanning = (
			result.cacheMaterialization as Record<string, unknown>
		).reviewerFanoutPlanning as Record<string, unknown>;
		assert.equal(
			reviewerFanoutPlanning.runtimeLaunchPlanMaterialization,
			undefined,
		);
		assert.equal(
			reloadFlowDeskSessionEvidenceV1({
				workflowId: "workflow-provider-acquisition-no-runtime",
				rootDir: noRuntimeRoot,
			}).entries.filter(
				(entry) => entry.evidenceClass === "runtime_lane_launch_plan",
			).length,
			0,
		);
	} finally {
		rmSync(noRuntimeRoot, { recursive: true, force: true });
	}

	const blockedRoot = mkdtempSync(
		join(
			tmpdir(),
			"flowdesk-provider-acquisition-cache-fanout-blocked-runtime-",
		),
	);
	try {
		const hooks = await flowdeskOpenCodeServerPlugin.server(
			undefined as never,
			{
				[flowdeskExactModelProviderAcquisitionLiveTestOption]: {
					enabled: true,
					durableStateRoot: blockedRoot,
					cacheMaterialization: {
						enabled: true,
						targetCacheEvidenceId: "cache-from-provider-live-blocked-runtime",
						targetCacheRefreshPlanEvidenceId:
							"cache-refresh-from-provider-live-blocked-runtime",
						cacheId: "cache-from-provider-live-blocked-runtime",
						entryId: "entry-from-provider-live-blocked-runtime",
						reviewerFanoutPlanning: {
							enabled: true,
							attemptId: "attempt-provider-live-blocked-runtime",
							parentSessionRef: "ses-provider-live-blocked-runtime-parent",
							agentRef: "agent-reviewer-provider-live-blocked-runtime",
							requestedAt: "2026-05-19T00:04:00.000Z",
							preLaunchAuditRef: "audit-provider-live-blocked-runtime-1",
							laneLaunchApprovalRef: "approval-provider-live-blocked-runtime-1",
							persistDerivedFanoutPlanEvidence: true,
							fanoutPlanEvidenceId:
								"fanout-from-provider-live-blocked-runtime-1",
							runtimeLaunchPlanMaterialization: {
								enabled: true,
								targetLaunchPlanEvidenceIds: [
									"launch-plan-blocked-provider-policy",
									"launch-plan-blocked-provider-architecture",
									"launch-plan-blocked-provider-verification",
								],
								sdkClientAvailable: true,
							},
						},
					},
					client: {
						checkExactModelAvailability() {
							return {
								outcome: "available",
								sanitized_provider_result_ref:
									"provider-result-redacted-blocked-runtime-1",
								availability_ref: "availability-live-blocked-runtime-1",
								highest_tier_eligible: true,
							};
						},
					},
				},
				localNonDispatchAdapter: false,
				naturalLanguageRouting: false,
			},
		);
		const liveTool =
			hooks.tool?.[flowdeskExactModelProviderAcquisitionLiveTestToolName];
		assert.ok(liveTool);
		const raw = await liveTool.execute(
			{
				request: exactModelProviderAcquisitionToolRequest({
					workflowId: "workflow-provider-acquisition-blocked-runtime",
					evidenceId: "provider-acquisition-blocked-runtime-evidence-1",
					resultId: "provider-acquisition-blocked-runtime-result-1",
				}),
			},
			undefined as never,
		);
		const result = JSON.parse(toolOutput(raw)) as Record<string, unknown>;
		const materialization = (
			(result.cacheMaterialization as Record<string, unknown>)
				.reviewerFanoutPlanning as Record<string, unknown>
		).runtimeLaunchPlanMaterialization as Record<string, unknown>;
		assert.equal(materialization.state, "blocked");
		assert.ok(
			(materialization.blockedLabels as string[]).includes(
				"durable_evidence_root_missing",
			),
		);
		assert.equal(materialization.writeIntentCount, 0);
		assert.equal(materialization.actualLaneLaunch, false);
		assert.equal(materialization.runtimeExecution, false);
		assert.equal(
			reloadFlowDeskSessionEvidenceV1({
				workflowId: "workflow-provider-acquisition-blocked-runtime",
				rootDir: blockedRoot,
			}).entries.filter(
				(entry) => entry.evidenceClass === "runtime_lane_launch_plan",
			).length,
			0,
		);
	} finally {
		rmSync(blockedRoot, { recursive: true, force: true });
	}
});

test("runtime reviewer execution bridge launches persisted plans and accepts durable verdict linkage", async () => {
	const root = mkdtempSync(
		join(tmpdir(), "flowdesk-runtime-reviewer-execution-"),
	);
	try {
		const perspectives = [
			"policy_security",
			"architecture",
			"verification_implementation",
		];
		const writeIntents = perspectives.map((perspective) => {
			const prepared = prepareFlowDeskSessionEvidenceWriteIntentV1({
				workflowId: "workflow-runtime-reviewer-execution",
				evidenceId: `launch-plan-${perspective}-runtime-reviewer`,
				record: runtimeLaneLaunchPlanRecord({
					launch_request_id: `launch-request-${perspective}-runtime-reviewer`,
					lane_id: `lane-${perspective}-runtime-reviewer`,
				}) as Record<string, unknown>,
			});
			assert.equal(prepared.ok, true, prepared.errors.join("; "));
			assert.ok(prepared.writeIntent);
			return prepared.writeIntent;
		});
		const applied = applyFlowDeskSessionEvidenceWriteIntentsV1(
			root,
			writeIntents,
		);
		assert.equal(applied.ok, true, applied.errors.join("; "));

		const fake = fakeRuntimeReviewerExecutionClient();
		const hooks = await flowdeskOpenCodeServerPlugin.server(
			undefined as never,
			{
				[flowdeskRuntimeReviewerExecutionOption]: {
					enabled: true,
					durableStateRoot: root,
					client: fake.client,
				},
				localNonDispatchAdapter: false,
				naturalLanguageRouting: false,
			},
		);
		const executionTool =
			hooks.tool?.[flowdeskRuntimeReviewerExecutionToolName];
		assert.ok(executionTool);
		const raw = await executionTool.execute(
			{
				request: {
					workflowId: "workflow-runtime-reviewer-execution",
					attemptId: "attempt-runtime-reviewer-execution",
					parentSessionId: "parent-runtime-reviewer",
					allowActualLaneLaunch: true,
					observedAt: now,
					consumedReviewerFanoutApproval:
						consumedReviewerFanoutApprovalRecord(),
					verdictExpectations: perspectives.map(
						runtimeReviewerExecutionExpectation,
					),
				},
			},
			undefined as never,
		);
		const result = JSON.parse(toolOutput(raw)) as Record<string, unknown>;
		assert.equal(result.status, "runtime_reviewer_execution_completed");
		assert.equal(result.laneCount, 3);
		assert.equal(result.acceptanceStatus, "verdicts_accepted");
		assert.equal(result.durableLinkageStatus, "durable_verdicts_accepted");
		assert.equal(result.linkedVerdictCount, 3);
		assert.equal(result.linkedLifecycleCount, 3);
		assert.equal(fake.createCalls.length, 3);
		assert.deepEqual(fake.createCalls[0], {
			parentID: "parent-runtime-reviewer",
		});
		assert.equal(fake.promptCalls.length, 3);
		assert.equal(
			(fake.promptCalls[0] as { sessionID?: string }).sessionID,
			"child-runtime-reviewer-policy_security",
		);
		assert.equal(fake.messageCalls.length, 3);
		assert.equal(
			(fake.messageCalls[0] as { sessionID?: string }).sessionID,
			"child-runtime-reviewer-policy_security",
		);
		const reloaded = reloadFlowDeskSessionEvidenceV1({
			workflowId: "workflow-runtime-reviewer-execution",
			rootDir: root,
		});
		assert.equal(reloaded.ok, true, reloaded.errors.join("; "));
		assert.equal(
			reloaded.entries.filter(
				(entry) => entry.evidenceClass === "reviewer_verdict",
			).length,
			3,
		);
		assert.equal(
			reloaded.entries.filter(
				(entry) => entry.evidenceClass === "lane_lifecycle",
			).length,
			6,
		);
	} finally {
		rmSync(root, { recursive: true, force: true });
	}
});

test("runtime reviewer execution bridge is explicit opt-in and blocks before SDK calls without approval", async () => {
	const root = mkdtempSync(
		join(tmpdir(), "flowdesk-runtime-reviewer-execution-blocked-"),
	);
	try {
		const fake = fakeRuntimeReviewerExecutionClient();
		const defaultHooks = await flowdeskOpenCodeServerPlugin.server(
			undefined as never,
			{
				localNonDispatchAdapter: false,
				naturalLanguageRouting: false,
			},
		);
		assert.equal(
			defaultHooks.tool?.[flowdeskRuntimeReviewerExecutionToolName],
			undefined,
		);
		const hooks = await flowdeskOpenCodeServerPlugin.server(
			undefined as never,
			{
				[flowdeskRuntimeReviewerExecutionOption]: {
					enabled: true,
					durableStateRoot: root,
					client: fake.client,
				},
				localNonDispatchAdapter: false,
				naturalLanguageRouting: false,
			},
		);
		const executionTool =
			hooks.tool?.[flowdeskRuntimeReviewerExecutionToolName];
		assert.ok(executionTool);
		const raw = await executionTool.execute(
			{
				request: {
					workflowId: "workflow-runtime-reviewer-execution",
					attemptId: "attempt-runtime-reviewer-execution",
					parentSessionId: "parent-runtime-reviewer",
					allowActualLaneLaunch: true,
					verdictExpectations: [
						runtimeReviewerExecutionExpectation("policy_security"),
					],
				},
			},
			undefined as never,
		);
		const result = JSON.parse(toolOutput(raw)) as Record<string, unknown>;
		assert.equal(result.status, "blocked_before_runtime_reviewer_execution");
		assert.equal(result.launchAttempted, false);
		assert.equal(fake.createCalls.length, 0);
		assert.equal(fake.promptCalls.length, 0);
	} finally {
		rmSync(root, { recursive: true, force: true });
	}
});

test("exact-model provider acquisition can chain cache, fanout, launch plans, and runtime reviewer execution in one pipeline", async () => {
	const root = mkdtempSync(join(tmpdir(), "flowdesk-provider-pipeline-e2e-"));
	try {
		const perspectives = [
			"policy_security",
			"architecture",
			"verification_implementation",
		];
		const launchPlanEvidenceIds = perspectives.map(
			(perspective) => `launch-plan-pipeline-${perspective}`,
		);
		const verdictExpectations = perspectives.map((perspective) => ({
			launchPlanEvidenceId: `launch-plan-pipeline-${perspective}`,
			lanePlanRef: `lane-plan-${perspective}-runtime-reviewer`,
			bindingRef: `binding-${perspective}-runtime-reviewer`,
			perspective,
			promptText: `Return typed FlowDesk reviewer verdict for ${perspective}.`,
			runningLifecycleEvidenceId: `lifecycle-running-pipeline-${perspective}`,
			completeLifecycleEvidenceId: `lifecycle-complete-pipeline-${perspective}`,
			reviewerVerdictEvidenceId: `reviewer-verdict-pipeline-${perspective}`,
			outputRef: `output-pipeline-${perspective}`,
			runtimeEchoRef: `runtime-echo-pipeline-${perspective}`,
			telemetryRef: `telemetry-pipeline-${perspective}`,
		}));
		const sdkFake = fakeRuntimeReviewerExecutionClient();
		const acquisitionRequest = exactModelProviderAcquisitionToolRequest({
			workflowId: "workflow-runtime-reviewer-execution",
			evidenceId: "provider-acquisition-pipeline-evidence-1",
			resultId: "provider-acquisition-pipeline-result-1",
		});
		const consumedApproval = consumedReviewerFanoutApprovalRecord();
		const hooks = await flowdeskOpenCodeServerPlugin.server(
			undefined as never,
			{
				[flowdeskExactModelProviderAcquisitionLiveTestOption]: {
					enabled: true,
					durableStateRoot: root,
					cacheMaterialization: {
						enabled: true,
						targetCacheEvidenceId: "cache-pipeline-1",
						targetCacheRefreshPlanEvidenceId: "cache-refresh-pipeline-1",
						cacheId: "cache-pipeline-1",
						entryId: "entry-pipeline-1",
						reviewerFanoutPlanning: {
							enabled: true,
							attemptId: "attempt-runtime-reviewer-execution",
							parentSessionRef: "ses-pipeline-parent",
							agentRef: "agent-reviewer-gpt-frontier",
							requestedAt: now,
							preLaunchAuditRef: "audit-pipeline-1",
							laneLaunchApprovalRef: "approval-pipeline-1",
							persistDerivedFanoutPlanEvidence: true,
							fanoutPlanEvidenceId: "fanout-pipeline-1",
							runtimeLaunchPlanMaterialization: {
								enabled: true,
								targetLaunchPlanEvidenceIds: launchPlanEvidenceIds,
								sdkClientAvailable: true,
								durableEvidenceRootRef: "evidence-root-pipeline",
								runtimeReviewerExecution: {
									enabled: true,
									attemptId: "attempt-runtime-reviewer-execution",
									parentSessionId: "pipeline-parent",
									observedAt: now,
									consumedReviewerFanoutApproval: consumedApproval,
									verdictExpectations,
								},
							},
						},
					},
					client: {
						checkExactModelAvailability() {
							return {
								outcome: "available",
								sanitized_provider_result_ref:
									"provider-result-redacted-pipeline-1",
								availability_ref: "availability-live-pipeline-1",
								highest_tier_eligible: true,
							};
						},
					},
					runtimeReviewerExecutionClient: sdkFake.client,
				},
				localNonDispatchAdapter: false,
				naturalLanguageRouting: false,
			},
		);
		const liveTool =
			hooks.tool?.[flowdeskExactModelProviderAcquisitionLiveTestToolName];
		assert.ok(liveTool);
		const raw = await liveTool.execute(
			{ request: acquisitionRequest },
			undefined as never,
		);
		const result = JSON.parse(toolOutput(raw)) as Record<string, unknown>;
		assert.equal(result.status, "provider_acquisition_recorded");
		const materialization = result.cacheMaterialization as Record<
			string,
			unknown
		>;
		const fanoutPlanning = materialization.reviewerFanoutPlanning as Record<
			string,
			unknown
		>;
		const launchPlanMaterialization =
			fanoutPlanning.runtimeLaunchPlanMaterialization as Record<
				string,
				unknown
			>;
		assert.equal(launchPlanMaterialization.state, "materialized");
		const runtimeReviewerExecution =
			launchPlanMaterialization.runtimeReviewerExecution as Record<
				string,
				unknown
			>;
		assert.equal(
			runtimeReviewerExecution.status,
			"runtime_reviewer_execution_completed",
		);
		assert.equal(runtimeReviewerExecution.laneCount, 3);
		assert.equal(
			runtimeReviewerExecution.acceptanceStatus,
			"verdicts_accepted",
		);
		assert.equal(
			runtimeReviewerExecution.durableLinkageStatus,
			"durable_verdicts_accepted",
		);
		assert.equal(runtimeReviewerExecution.linkedVerdictCount, 3);
		assert.equal(runtimeReviewerExecution.linkedLifecycleCount, 3);
		assert.equal(sdkFake.createCalls.length, 3);
		assert.equal(sdkFake.promptCalls.length, 3);
		assert.equal(sdkFake.messageCalls.length, 3);
		const reloaded = reloadFlowDeskSessionEvidenceV1({
			workflowId: "workflow-runtime-reviewer-execution",
			rootDir: root,
		});
		assert.equal(reloaded.ok, true, reloaded.errors.join("; "));
		assert.equal(
			reloaded.entries.filter(
				(entry) => entry.evidenceClass === "reviewer_verdict",
			).length,
			3,
		);
		assert.equal(
			reloaded.entries.filter(
				(entry) => entry.evidenceClass === "lane_lifecycle",
			).length,
			6,
		);
		assert.equal(
			reloaded.entries.filter(
				(entry) => entry.evidenceClass === "runtime_lane_launch_plan",
			).length,
			3,
		);
	} finally {
		rmSync(root, { recursive: true, force: true });
	}
});

test("exact-model provider acquisition chained reviewer execution requires explicit nested opt-in and approval", async () => {
	const root = mkdtempSync(
		join(tmpdir(), "flowdesk-provider-pipeline-blocked-"),
	);
	try {
		const sdkFake = fakeRuntimeReviewerExecutionClient();
		const hooks = await flowdeskOpenCodeServerPlugin.server(
			undefined as never,
			{
				[flowdeskExactModelProviderAcquisitionLiveTestOption]: {
					enabled: true,
					durableStateRoot: root,
					cacheMaterialization: {
						enabled: true,
						targetCacheEvidenceId: "cache-pipeline-blocked",
						targetCacheRefreshPlanEvidenceId: "cache-refresh-pipeline-blocked",
						cacheId: "cache-pipeline-blocked",
						entryId: "entry-pipeline-blocked",
						reviewerFanoutPlanning: {
							enabled: true,
							attemptId: "attempt-pipeline-blocked",
							parentSessionRef: "ses-pipeline-blocked-parent",
							agentRef: "agent-reviewer-blocked",
							requestedAt: now,
							preLaunchAuditRef: "audit-pipeline-blocked",
							laneLaunchApprovalRef: "approval-pipeline-blocked",
							persistDerivedFanoutPlanEvidence: true,
							fanoutPlanEvidenceId: "fanout-pipeline-blocked",
							runtimeLaunchPlanMaterialization: {
								enabled: true,
								targetLaunchPlanEvidenceIds: [
									"launch-plan-pipeline-blocked-policy",
									"launch-plan-pipeline-blocked-architecture",
									"launch-plan-pipeline-blocked-verification",
								],
								sdkClientAvailable: true,
								durableEvidenceRootRef: "evidence-root-pipeline-blocked",
							},
						},
					},
					client: {
						checkExactModelAvailability() {
							return {
								outcome: "available",
								sanitized_provider_result_ref:
									"provider-result-redacted-blocked",
								availability_ref: "availability-live-blocked",
								highest_tier_eligible: true,
							};
						},
					},
					runtimeReviewerExecutionClient: sdkFake.client,
				},
				localNonDispatchAdapter: false,
				naturalLanguageRouting: false,
			},
		);
		const liveTool =
			hooks.tool?.[flowdeskExactModelProviderAcquisitionLiveTestToolName];
		assert.ok(liveTool);
		const raw = await liveTool.execute(
			{
				request: exactModelProviderAcquisitionToolRequest({
					workflowId: "workflow-pipeline-blocked",
					evidenceId: "provider-acquisition-pipeline-blocked-evidence-1",
					resultId: "provider-acquisition-pipeline-blocked-result-1",
				}),
			},
			undefined as never,
		);
		const result = JSON.parse(toolOutput(raw)) as Record<string, unknown>;
		const materialization = result.cacheMaterialization as Record<
			string,
			unknown
		>;
		const fanoutPlanning = materialization.reviewerFanoutPlanning as Record<
			string,
			unknown
		>;
		const launchPlanMaterialization =
			fanoutPlanning.runtimeLaunchPlanMaterialization as Record<
				string,
				unknown
			>;
		assert.equal(launchPlanMaterialization.runtimeReviewerExecution, undefined);
		assert.equal(sdkFake.createCalls.length, 0);
		assert.equal(sdkFake.promptCalls.length, 0);
		assert.equal(sdkFake.messageCalls.length, 0);
	} finally {
		rmSync(root, { recursive: true, force: true });
	}
});

function fallbackDecisionRecord(overrides: Record<string, unknown> = {}) {
	return {
		schema_version: "flowdesk.fallback_decision.v1",
		decision_id: "fallback-decision-server-1",
		workflow_id: "workflow-fallback-1",
		parent_attempt_id: "attempt-parent-1",
		new_attempt_id: "attempt-fallback-1",
		from_provider_qualified_model_id: "claude/sonnet-4",
		to_provider_qualified_model_id: "openai/gpt-5.5",
		reason_label: "provider_unhealthy",
		depth: 1,
		max_depth: 2,
		fresh_evidence_refs: [
			"usage-fresh-server-1",
			"health-fresh-server-1",
			"runtime-fresh-server-1",
		],
		fresh_guard_decision_ref: "guard-fresh-server-1",
		fresh_approval_ref: "approval-fresh-server-1",
		fresh_pre_dispatch_audit_ref: "audit-fresh-server-1",
		policy_eligibility_ref: "policy-fresh-server-1",
		runtime_compatibility_ref: "runtime-compatibility-fresh-server-1",
		state: "requires_full_regate",
		automatic_fallback_authorized: false,
		dispatch_authority_enabled: false,
		providerCall: false,
		actualLaneLaunch: false,
		runtimeExecution: false,
		...overrides,
	};
}

function consumedFallbackApprovalRecord() {
	const result = consumeFlowDeskProductionApprovalSourceV1({
		approval: {
			schema_version: "flowdesk.production_approval_source.v1",
			approval_id: "approval-fresh-server-1",
			workflow_id: "workflow-fallback-1",
			attempt_id: "attempt-fallback-1",
			action_type: "fallback_reselection",
			issuer_boundary: "external_user_confirmation",
			approval_method: "typed_phrase",
			actor_ref: "actor-server",
			profile_ref: "profile-server",
			provider_qualified_model_id: "openai/gpt-5.5",
			provider_binding_hash: "hash-provider-server",
			evidence_bundle_hash: "hash-evidence-server",
			guard_decision_ref: "guard-fresh-server-1",
			issuance_audit_ref: "audit-issuance-server",
			nonce_ref: "nonce-server",
			issued_at: "2026-05-17T00:00:00.000Z",
			expires_at: "2026-05-17T00:10:00.000Z",
			revoked: false,
			consume_strategy: "atomic_compare_and_swap_required",
			dispatch_authority_enabled: false,
		},
		workflowId: "workflow-fallback-1",
		attemptId: "attempt-fallback-1",
		actionType: "fallback_reselection",
		actorRef: "actor-server",
		profileRef: "profile-server",
		providerQualifiedModelId: "openai/gpt-5.5",
		providerBindingHash: "hash-provider-server",
		evidenceBundleHash: "hash-evidence-server",
		guardDecisionRef: "guard-fresh-server-1",
		consumptionAuditRef: "audit-consumption-server",
		consumedAt: "2026-05-17T00:05:00.000Z",
	});
	assert.ok(result.consumed_approval, result.errors.join("; "));
	return result.consumed_approval;
}

test("managed fallback regate tool is explicit opt-in and returns a fresh regate plan only after orchestrator success", async () => {
	const defaultHooks = await flowdeskOpenCodeServerPlugin.server(
		undefined as never,
		{
			localNonDispatchAdapter: false,
			naturalLanguageRouting: false,
		},
	);
	assert.equal(
		defaultHooks.tool?.[flowdeskManagedFallbackRegateToolName],
		undefined,
	);

	const hooks = await flowdeskOpenCodeServerPlugin.server(undefined as never, {
		[flowdeskManagedFallbackRegateOption]: { enabled: true },
		localNonDispatchAdapter: false,
		naturalLanguageRouting: false,
	});
	const regateTool = hooks.tool?.[flowdeskManagedFallbackRegateToolName];
	assert.ok(regateTool);

	const raw = await regateTool.execute(
		{
			decision: fallbackDecisionRecord(),
			consumedApproval: consumedFallbackApprovalRecord(),
		},
		undefined as never,
	);
	const result = JSON.parse(toolOutput(raw)) as Record<string, unknown>;
	assert.equal(
		result.status,
		"regate_plan_ready",
		`unexpected status: ${JSON.stringify(result)}`,
	);
	assert.equal(result.dispatchAttempted, false);
	assert.equal(result.providerSwitchAttempted, false);
	assert.equal(result.sdkCallAttempted, false);
	assert.equal(result.regatePlanState, "full_regate_required");
	assert.equal(result.regatePlanOk, true);
	assert.equal(result.requiredFreshEvidenceRefCount, 3);
	const authority = result.authority as Record<string, unknown>;
	assert.equal(authority.automaticFallbackAuthorized, false);
	assert.equal(authority.providerCall, false);
	assert.equal(authority.runtimeExecution, false);
	assert.equal(authority.actualLaneLaunch, false);
	assert.equal(authority.realOpenCodeDispatch, false);
});

test("quick reviewer run tool is absent by default and registers only with explicit opt-in", async () => {
	const defaultHooks = await flowdeskOpenCodeServerPlugin.server(
		undefined as never,
		{
			localNonDispatchAdapter: false,
			naturalLanguageRouting: false,
		},
	);
	assert.equal(
		defaultHooks.tool?.[flowdeskQuickReviewerRunToolName],
		undefined,
	);

	const dummyClient = {
		session: {
			create() {
				return Promise.resolve({ id: "parent-quick-server-1" });
			},
			prompt() {
				return Promise.resolve({ info: { id: "message-quick-server-1" } });
			},
			messages() {
				return Promise.resolve([]);
			},
		},
	};
	const enabledHooks = await flowdeskOpenCodeServerPlugin.server(
		{ client: dummyClient } as never,
		{
			[flowdeskQuickReviewerRunOption]: {
				enabled: true,
				providerQualifiedModelId: "openai/gpt-5.4-mini-fast",
				runtimeAgent: "reviewer-gpt-frontier",
			},
			localNonDispatchAdapter: false,
			naturalLanguageRouting: false,
		},
	);
	const quickTool = enabledHooks.tool?.[flowdeskQuickReviewerRunToolName];
	assert.ok(quickTool);

	const blocked = JSON.parse(
		toolOutput(
			await quickTool.execute(
				{
					prompt: "Review this content",
					developerModeAcknowledged: false,
					allowProviderCall: true,
				},
				undefined as never,
			),
		),
	) as Record<string, unknown>;
	assert.equal(blocked.status, "blocked_before_quick_reviewer_run");
	assert.match(
		String(blocked.redactedBlockReason),
		/developerModeAcknowledged/,
	);
	const description = String(quickTool.description ?? "");
	assert.match(description, /code review|multi-perspective/);
	assert.match(description, /WHEN TO USE/);
	assert.match(description, /다관점 리뷰/);
	assert.match(description, /다관점리뷰/);
	assert.match(description, /다관점 비판적리뷰/);
	assert.match(description, /다각도 검토/);
	assert.match(description, /여러 관점에서 검토/);
	assert.match(description, /비판적 검토/);
	assert.match(description, /code is not required/);
	assert.match(description, /current conversation context/);
	assert.match(description, /WHEN NOT TO USE/);
	assert.match(description, /developerModeAcknowledged=true/);
	assert.match(description, /allowProviderCall=true/);
	assert.match(description, /Do not ask the user for extra confirmation/);
	assert.doesNotMatch(description, /paid provider/);
});

test("quick reviewer run persists launch evidence under top-level durableStateRoot", async () => {
	const root = mkdtempSync(join(tmpdir(), "flowdesk-quick-reviewer-root-"));
	try {
		const dummyClient = {
			session: {
				create() {
					return Promise.resolve({ id: "parent-quick-root-1" });
				},
				prompt() {
					return Promise.resolve({ info: { id: "message-quick-root-1" } });
				},
				messages() {
					return Promise.resolve([]);
				},
			},
		};
		const hooks = await flowdeskOpenCodeServerPlugin.server(
			{ client: dummyClient } as never,
			{
				[flowdeskQuickReviewerRunOption]: {
					enabled: true,
					providerQualifiedModelId: "openai/gpt-5.4-mini-fast",
					runtimeAgent: "reviewer-gpt-frontier",
				},
				[flowdeskDurableStateRootOption]: root,
				localNonDispatchAdapter: false,
				naturalLanguageRouting: false,
			},
		);
		const quickTool = hooks.tool?.[flowdeskQuickReviewerRunToolName];
		assert.ok(quickTool);

		const result = JSON.parse(
			toolOutput(
				await quickTool.execute(
					{
						prompt: "Review this content",
						developerModeAcknowledged: true,
						allowProviderCall: true,
					},
					undefined as never,
				),
			),
		) as Record<string, unknown>;
		assert.equal(result.status, "quick_reviewer_run_incomplete");
		assert.equal(typeof result.workflowId, "string");
		const reloaded = reloadFlowDeskSessionEvidenceV1({
			workflowId: String(result.workflowId),
			rootDir: root,
		});
		assert.equal(reloaded.ok, true, reloaded.errors.join("; "));
		assert.equal(
			reloaded.entries.filter(
				(entry) => entry.evidenceClass === "runtime_lane_launch_plan",
			).length,
			3,
		);
	} finally {
		rmSync(root, { recursive: true, force: true });
	}
});

test("managed fallback regate tool persists regate plan as durable evidence when opt-in is set", async () => {
	const root = mkdtempSync(join(tmpdir(), "flowdesk-fallback-regate-persist-"));
	try {
		const hooks = await flowdeskOpenCodeServerPlugin.server(
			undefined as never,
			{
				[flowdeskManagedFallbackRegateOption]: { enabled: true },
				[flowdeskDurableStateRootOption]: root,
				localNonDispatchAdapter: false,
				naturalLanguageRouting: false,
			},
		);
		const regateTool = hooks.tool?.[flowdeskManagedFallbackRegateToolName];
		assert.ok(regateTool);
		const raw = await regateTool.execute(
			{
				decision: fallbackDecisionRecord(),
				consumedApproval: consumedFallbackApprovalRecord(),
				persistRegatePlanEvidence: true,
				regatePlanEvidenceId: "regate-plan-evidence-1",
			},
			undefined as never,
		);
		const result = JSON.parse(toolOutput(raw)) as Record<string, unknown>;
		assert.equal(result.status, "regate_plan_ready");
		const evidence = result.regatePlanEvidence as Record<string, unknown>;
		assert.equal(evidence.status, "regate_plan_evidence_recorded");
		assert.equal(evidence.writeAttempted, true);
		assert.equal(evidence.evidenceReloaded, true);
		assert.equal(evidence.evidenceId, "regate-plan-evidence-1");
		const reloaded = reloadFlowDeskSessionEvidenceV1({
			workflowId: "workflow-fallback-1",
			rootDir: root,
		});
		assert.equal(reloaded.ok, true, reloaded.errors.join("; "));
		const persisted = reloaded.entries.find(
			(entry) => entry.evidenceClass === "fallback_regate_plan",
		);
		assert.ok(persisted);
		assert.equal(persisted.evidenceId, "regate-plan-evidence-1");
		assert.equal(persisted.record.state, "full_regate_required");
		assert.equal(persisted.record.dispatch_authority_enabled, false);
	} finally {
		rmSync(root, { recursive: true, force: true });
	}
});

test("managed fallback regate tool blocks before plan when decision or approval is missing or mismatched", async () => {
	const hooks = await flowdeskOpenCodeServerPlugin.server(undefined as never, {
		[flowdeskManagedFallbackRegateOption]: { enabled: true },
		localNonDispatchAdapter: false,
		naturalLanguageRouting: false,
	});
	const regateTool = hooks.tool?.[flowdeskManagedFallbackRegateToolName];
	assert.ok(regateTool);

	const missing = JSON.parse(
		toolOutput(await regateTool.execute({}, undefined as never)),
	) as Record<string, unknown>;
	assert.equal(missing.status, "blocked_before_regate_plan");
	assert.match(String(missing.redactedBlockReason), /decision/);

	const terminal = JSON.parse(
		toolOutput(
			await regateTool.execute(
				{
					decision: fallbackDecisionRecord({
						depth: 2,
						state: "terminal_max_depth",
					}),
					consumedApproval: consumedFallbackApprovalRecord(),
				},
				undefined as never,
			),
		),
	) as Record<string, unknown>;
	assert.equal(terminal.status, "blocked_before_regate_plan");
	const terminalAuthority = terminal.authority as Record<string, unknown>;
	assert.equal(terminalAuthority.providerCall, false);
	assert.equal(terminalAuthority.runtimeExecution, false);
});

test("exact-model provider acquisition cache materialization blocks duplicate target evidence before extra cache-refresh writes", async () => {
	const root = mkdtempSync(
		join(tmpdir(), "flowdesk-provider-acquisition-cache-duplicate-"),
	);
	try {
		const hooks = await flowdeskOpenCodeServerPlugin.server(
			undefined as never,
			{
				[flowdeskExactModelProviderAcquisitionLiveTestOption]: {
					enabled: true,
					durableStateRoot: root,
					cacheMaterialization: {
						enabled: true,
						targetCacheEvidenceId: "cache-from-provider-live-dup",
						targetCacheRefreshPlanEvidenceId:
							"cache-refresh-from-provider-live-dup",
						cacheId: "cache-from-provider-live-dup",
						entryId: "entry-from-provider-live-dup",
					},
					client: {
						checkExactModelAvailability() {
							return {
								outcome: "available",
								sanitized_provider_result_ref:
									"provider-result-redacted-cache-dup",
								availability_ref: "availability-live-cache-dup",
								highest_tier_eligible: true,
							};
						},
					},
				},
				localNonDispatchAdapter: false,
				naturalLanguageRouting: false,
			},
		);
		const liveTool =
			hooks.tool?.[flowdeskExactModelProviderAcquisitionLiveTestToolName];
		assert.ok(liveTool);

		const firstRaw = await liveTool.execute(
			{
				request: exactModelProviderAcquisitionToolRequest({
					workflowId: "workflow-provider-acquisition-cache-duplicate",
					evidenceId: "provider-acquisition-cache-duplicate-1",
					resultId: "provider-acquisition-cache-duplicate-result-1",
					idempotencyRef: "provider-acquisition-cache-duplicate-idempotency-1",
					liveTestRunRef: "provider-acquisition-cache-duplicate-run-1",
				}),
			},
			undefined as never,
		);
		const first = JSON.parse(toolOutput(firstRaw)) as Record<string, unknown>;
		assert.equal(first.status, "provider_acquisition_recorded");
		assert.equal(
			(first.cacheMaterialization as Record<string, unknown>).state,
			"materialized",
		);

		const secondRaw = await liveTool.execute(
			{
				request: exactModelProviderAcquisitionToolRequest({
					workflowId: "workflow-provider-acquisition-cache-duplicate",
					evidenceId: "provider-acquisition-cache-duplicate-2",
					resultId: "provider-acquisition-cache-duplicate-result-2",
					idempotencyRef: "provider-acquisition-cache-duplicate-idempotency-2",
					liveTestRunRef: "provider-acquisition-cache-duplicate-run-2",
				}),
			},
			undefined as never,
		);
		const second = JSON.parse(toolOutput(secondRaw)) as Record<string, unknown>;
		assert.equal(second.status, "provider_acquisition_recorded");
		const secondMaterialization = second.cacheMaterialization as
			| Record<string, unknown>
			| undefined;
		assert.ok(secondMaterialization);
		assert.equal(secondMaterialization.state, "blocked");
		assert.equal(
			secondMaterialization.targetCacheEvidenceId,
			"cache-from-provider-live-dup",
		);
		assert.equal(
			secondMaterialization.targetCacheRefreshPlanEvidenceId,
			"cache-refresh-from-provider-live-dup",
		);
		assert.equal(secondMaterialization.cacheId, "cache-from-provider-live-dup");
		assert.equal(secondMaterialization.entryId, "entry-from-provider-live-dup");
		assert.equal(
			secondMaterialization.availabilityRef,
			"availability-live-cache-dup",
		);
		assert.equal(
			secondMaterialization.sanitizedProviderResultRef,
			"provider-result-redacted-cache-dup",
		);
		assert.equal(secondMaterialization.pairSelectionReady, false);
		assert.equal(Array.isArray(secondMaterialization.blockedLabels), true);
		assert.ok(
			(secondMaterialization.blockedLabels as unknown[]).includes(
				"target_cache_evidence_duplicate",
			),
		);
		assert.ok(
			(secondMaterialization.blockedLabels as unknown[]).includes(
				"target_cache_refresh_evidence_duplicate",
			),
		);

		const reloaded = reloadFlowDeskSessionEvidenceV1({
			workflowId: "workflow-provider-acquisition-cache-duplicate",
			rootDir: root,
		});
		assert.equal(reloaded.ok, true, reloaded.errors.join("; "));
		assert.equal(
			reloaded.entries.filter(
				(entry) =>
					entry.evidenceClass ===
					"exact_model_availability_cache_provider_acquisition_result",
			).length,
			2,
		);
		assert.equal(
			reloaded.entries.filter(
				(entry) => entry.evidenceClass === "exact_model_availability_cache",
			).length,
			1,
		);
		assert.equal(
			reloaded.entries.filter(
				(entry) =>
					entry.evidenceClass === "exact_model_availability_cache_refresh_plan",
			).length,
			1,
		);
	} finally {
		rmSync(root, { recursive: true, force: true });
	}
});

test("exact-model provider acquisition can use OpenCode metadata client without prompt dispatch", async () => {
	const root = mkdtempSync(join(tmpdir(), "flowdesk-provider-metadata-"));
	const calls: string[] = [];
	try {
		const opencodeClient = {
			config: {
				providers(parameters?: { directory?: string }) {
					calls.push(`config.providers:${parameters?.directory ?? "none"}`);
					return {
						data: {
							providers: [
								{
									id: "anthropic",
									models: { "claude-opus-4-5": { id: "claude-opus-4-5" } },
								},
							],
							default: { anthropic: "claude-opus-4-5" },
						},
					};
				},
			},
			provider: {
				list(parameters?: { directory?: string }) {
					calls.push(`provider.list:${parameters?.directory ?? "none"}`);
					return {
						data: {
							all: [
								{
									id: "anthropic",
									models: { "claude-opus-4-5": { id: "claude-opus-4-5" } },
								},
							],
							default: { anthropic: "claude-opus-4-5" },
							connected: ["anthropic"],
						},
					};
				},
				auth(parameters?: { directory?: string }) {
					calls.push(`provider.auth:${parameters?.directory ?? "none"}`);
					return { data: { anthropic: [{ type: "oauth" }] } };
				},
			},
			session: {
				prompt() {
					throw new Error("metadata acquisition must not dispatch prompts");
				},
				promptAsync() {
					throw new Error("metadata acquisition must not dispatch prompts");
				},
			},
		};
		const defaultHooks = await flowdeskOpenCodeServerPlugin.server({
			client: opencodeClient,
			directory: "/flowdesk-project",
		} as never);
		assert.equal(
			Object.keys(defaultHooks.tool ?? {}).includes(
				flowdeskExactModelProviderAcquisitionLiveTestToolName,
			),
			false,
		);

		const hooks = await flowdeskOpenCodeServerPlugin.server(
			{ client: opencodeClient, directory: "/flowdesk-project" } as never,
			{
				[flowdeskExactModelProviderAcquisitionLiveTestOption]: {
					enabled: true,
					durableStateRoot: root,
				},
				localNonDispatchAdapter: false,
				naturalLanguageRouting: false,
			},
		);
		const liveTool =
			hooks.tool?.[flowdeskExactModelProviderAcquisitionLiveTestToolName];
		assert.ok(liveTool);
		const raw = await liveTool.execute(
			{
				request: exactModelProviderAcquisitionToolRequest({
					workflowId: "workflow-provider-metadata-1",
					evidenceId: "provider-metadata-evidence-1",
					resultId: "provider-metadata-result-1",
				}),
			},
			undefined as never,
		);
		const result = JSON.parse(toolOutput(raw)) as Record<string, unknown>;
		assert.equal(result.status, "provider_acquisition_recorded");
		assert.equal(result.providerCallAttempted, false);
		assert.equal(result.writeAttempted, true);
		assert.equal(result.evidenceReloaded, true);
		assert.equal(
			result.sanitizedProviderResultRef,
			"provider-result-anthropic-claude-opus-4-5-metadata",
		);
		assert.deepEqual(calls, [
			"config.providers:/flowdesk-project",
			"provider.list:/flowdesk-project",
			"provider.auth:/flowdesk-project",
		]);

		const reloaded = reloadFlowDeskSessionEvidenceV1({
			workflowId: "workflow-provider-metadata-1",
			rootDir: root,
		});
		assert.equal(reloaded.ok, true, reloaded.errors.join("; "));
		const record = reloaded.entries.find(
			(entry) => entry.evidenceId === "provider-metadata-evidence-1",
		)?.record as Record<string, unknown> | undefined;
		assert.ok(record);
		assert.equal(record.state, "availability_acquired");
		assert.equal(record.providerCall, false);
		assert.equal(record.acquisition_attempted, true);
		assert.equal(record.discovery_attempted, true);
	} finally {
		rmSync(root, { recursive: true, force: true });
	}
});

test("exact-model provider acquisition metadata client fails closed for missing provider model and auth", async () => {
	const cases = [
		{
			name: "provider",
			client: {
				config: { providers: () => ({ data: { providers: [], default: {} } }) },
				provider: {
					list: () => ({ data: { all: [], default: {}, connected: [] } }),
					auth: () => ({ data: { anthropic: [{ type: "oauth" }] } }),
				},
			},
			blockedLabel: "opencode_provider_metadata_missing",
		},
		{
			name: "model",
			client: {
				config: {
					providers: () => ({
						data: { providers: [{ id: "anthropic", models: {} }], default: {} },
					}),
				},
				provider: {
					list: () => ({
						data: {
							all: [{ id: "anthropic", models: {} }],
							default: {},
							connected: ["anthropic"],
						},
					}),
					auth: () => ({ data: { anthropic: [{ type: "oauth" }] } }),
				},
			},
			blockedLabel: "opencode_provider_model_missing",
		},
		{
			name: "auth",
			client: {
				config: {
					providers: () => ({
						data: {
							providers: [
								{
									id: "anthropic",
									models: { "claude-opus-4-5": { id: "claude-opus-4-5" } },
								},
							],
							default: {},
						},
					}),
				},
				provider: {
					list: () => ({
						data: {
							all: [
								{
									id: "anthropic",
									models: { "claude-opus-4-5": { id: "claude-opus-4-5" } },
								},
							],
							default: {},
							connected: [],
						},
					}),
					auth: () => ({ data: {} }),
				},
			},
			blockedLabel: "opencode_provider_auth_missing",
		},
	];

	for (const entry of cases) {
		const root = mkdtempSync(
			join(tmpdir(), `flowdesk-provider-${entry.name}-missing-`),
		);
		try {
			const hooks = await flowdeskOpenCodeServerPlugin.server(
				{ client: entry.client, directory: "/flowdesk-project" } as never,
				{
					[flowdeskExactModelProviderAcquisitionLiveTestOption]: {
						enabled: true,
						durableStateRoot: root,
					},
					localNonDispatchAdapter: false,
					naturalLanguageRouting: false,
				},
			);
			const liveTool =
				hooks.tool?.[flowdeskExactModelProviderAcquisitionLiveTestToolName];
			assert.ok(liveTool);
			const workflowId = `workflow-provider-${entry.name}-missing`;
			const evidenceId = `provider-${entry.name}-missing-evidence`;
			const raw = await liveTool.execute(
				{
					request: exactModelProviderAcquisitionToolRequest({
						workflowId,
						evidenceId,
						resultId: `provider-${entry.name}-missing-result`,
					}),
				},
				undefined as never,
			);
			const result = JSON.parse(toolOutput(raw)) as Record<string, unknown>;
			assert.equal(result.status, "provider_acquisition_blocked");
			assert.equal(result.providerCallAttempted, false);
			assert.equal(result.writeAttempted, true);
			assert.equal(result.resultState, "blocked");
			const reloaded = reloadFlowDeskSessionEvidenceV1({
				workflowId,
				rootDir: root,
			});
			assert.equal(reloaded.ok, true, reloaded.errors.join("; "));
			const record = reloaded.entries.find(
				(item) => item.evidenceId === evidenceId,
			)?.record as Record<string, unknown> | undefined;
			assert.ok(record);
			assert.equal(record.providerCall, false);
			assert.equal(record.acquisition_attempted, false);
			assert.ok(
				(record.blocked_labels as unknown[]).includes(entry.blockedLabel),
			);
		} finally {
			rmSync(root, { recursive: true, force: true });
		}
	}
});

test("prompt-backed provider acquisition blocks unallowed exact model before prompt", async () => {
	const root = mkdtempSync(
		join(tmpdir(), "flowdesk-provider-prompt-allowlist-"),
	);
	const { client, metadataCalls, promptCalls } =
		promptBackedAcquisitionOpenCodeClient();
	try {
		const result = await executeProviderAcquisitionTool({
			root,
			client,
			promptBackedCheck: {
				enabled: true,
				allowProviderCall: true,
				allowedProviderQualifiedModelIds: ["claude/other-model"],
			},
			request: {
				workflowId: "workflow-provider-sdk-allowlist",
				evidenceId: "provider-sdk-allowlist-evidence",
				resultId: "provider-sdk-allowlist-result",
			},
		});
		assert.equal(result.status, "provider_acquisition_blocked");
		assert.equal(result.providerCallAttempted, false);
		assert.deepEqual(result.blockedLabels, [
			"opencode_sdk_provider_model_not_allowed",
		]);
		assert.deepEqual(metadataCalls, [
			"config.providers:/flowdesk-project",
			"provider.list:/flowdesk-project",
			"provider.auth:/flowdesk-project",
		]);
		assert.equal(promptCalls.length, 0);
	} finally {
		rmSync(root, { recursive: true, force: true });
	}
});

test("prompt-backed provider acquisition requires explicit provider-call allow flag", async () => {
	const root = mkdtempSync(
		join(tmpdir(), "flowdesk-provider-prompt-allow-flag-"),
	);
	const { client, promptCalls } = promptBackedAcquisitionOpenCodeClient();
	try {
		const result = await executeProviderAcquisitionTool({
			root,
			client,
			promptBackedCheck: {
				enabled: true,
				allowProviderCall: false,
				allowedProviderQualifiedModelIds: ["claude/claude-opus-4-5"],
			},
			request: {
				workflowId: "workflow-provider-sdk-allow-flag",
				evidenceId: "provider-sdk-allow-flag-evidence",
				resultId: "provider-sdk-allow-flag-result",
			},
		});
		assert.equal(result.status, "provider_acquisition_blocked");
		assert.equal(result.providerCallAttempted, false);
		assert.deepEqual(result.blockedLabels, [
			"opencode_sdk_provider_call_not_allowed",
		]);
		assert.equal(promptCalls.length, 0);
	} finally {
		rmSync(root, { recursive: true, force: true });
	}
});

test("prompt-backed provider acquisition blocks metadata preflight failure before prompt", async () => {
	const root = mkdtempSync(
		join(tmpdir(), "flowdesk-provider-prompt-preflight-"),
	);
	const { client, metadataCalls, promptCalls } =
		promptBackedAcquisitionOpenCodeClient({ metadataAvailable: false });
	try {
		const result = await executeProviderAcquisitionTool({
			root,
			client,
			promptBackedCheck: {
				enabled: true,
				allowProviderCall: true,
				allowedProviderQualifiedModelIds: ["claude/claude-opus-4-5"],
			},
			request: {
				workflowId: "workflow-provider-sdk-preflight",
				evidenceId: "provider-sdk-preflight-evidence",
				resultId: "provider-sdk-preflight-result",
			},
		});
		assert.equal(result.status, "provider_acquisition_blocked");
		assert.equal(result.providerCallAttempted, false);
		assert.deepEqual(result.blockedLabels, ["opencode_provider_auth_missing"]);
		assert.equal(metadataCalls.length, 3);
		assert.equal(promptCalls.length, 0);
	} finally {
		rmSync(root, { recursive: true, force: true });
	}
});

test("prompt-backed provider acquisition calls prompt once with exact runtime model and sanitizes success", async () => {
	const root = mkdtempSync(join(tmpdir(), "flowdesk-provider-prompt-success-"));
	const { client, promptCalls } = promptBackedAcquisitionOpenCodeClient();
	try {
		const result = await executeProviderAcquisitionTool({
			root,
			client,
			promptBackedCheck: {
				enabled: true,
				allowProviderCall: true,
				allowedProviderQualifiedModelIds: ["claude/claude-opus-4-5"],
				sessionId: "provider-sdk-session-1",
				agent: "reviewer",
			},
			request: {
				workflowId: "workflow-provider-sdk-success",
				evidenceId: "provider-sdk-success-evidence",
				resultId: "provider-sdk-success-result",
			},
		});
		assert.equal(result.status, "provider_acquisition_recorded");
		assert.equal(result.providerCallAttempted, true);
		assert.equal(
			result.sanitizedProviderResultRef,
			"provider-result-anthropic-claude-opus-4-5-sdk-sentinel",
		);
		assert.equal(
			result.availabilityRef,
			"availability-anthropic-claude-opus-4-5-sdk-sentinel",
		);
		assert.equal(
			JSON.stringify(result).includes("RAW_MODEL_SECRET_RESPONSE"),
			false,
		);
		assert.equal(promptCalls.length, 1);
		assert.deepEqual(promptCalls[0], {
			path: { id: "provider-sdk-session-1" },
			query: { directory: "/flowdesk-project" },
			body: {
				model: { providerID: "anthropic", modelID: "claude-opus-4-5" },
				agent: "reviewer",
				parts: [
					{
						type: "text",
						text: "FlowDesk exact-model provider acquisition sentinel. Return a short acknowledgement only.",
					},
				],
			},
		});
		const reloaded = reloadFlowDeskSessionEvidenceV1({
			workflowId: "workflow-provider-sdk-success",
			rootDir: root,
		});
		const record = reloaded.entries.find(
			(entry) => entry.evidenceId === "provider-sdk-success-evidence",
		)?.record as Record<string, unknown> | undefined;
		assert.ok(record);
		assert.equal(record.providerCall, true);
		assert.equal(
			record.sanitized_provider_result_ref,
			"provider-result-anthropic-claude-opus-4-5-sdk-sentinel",
		);
		assert.equal(
			JSON.stringify(record).includes("RAW_MODEL_SECRET_RESPONSE"),
			false,
		);
	} finally {
		rmSync(root, { recursive: true, force: true });
	}
});

test("prompt-backed provider acquisition blocks duplicate durable refs before second prompt", async () => {
	const root = mkdtempSync(
		join(tmpdir(), "flowdesk-provider-prompt-duplicate-"),
	);
	const { client, promptCalls } = promptBackedAcquisitionOpenCodeClient();
	try {
		const promptBackedCheck = {
			enabled: true,
			allowProviderCall: true,
			allowedProviderQualifiedModelIds: ["claude/claude-opus-4-5"],
		};
		const first = await executeProviderAcquisitionTool({
			root,
			client,
			promptBackedCheck,
			request: {
				workflowId: "workflow-provider-sdk-duplicate",
				evidenceId: "provider-sdk-duplicate-first-evidence",
				resultId: "provider-sdk-duplicate-first-result",
				liveTestRunRef: "live-test-run-sdk-duplicate",
				idempotencyRef: "idempotency-sdk-duplicate",
			},
		});
		assert.equal(first.status, "provider_acquisition_recorded");
		assert.equal(first.providerCallAttempted, true);
		assert.equal(promptCalls.length, 1);

		const second = await executeProviderAcquisitionTool({
			root,
			client,
			promptBackedCheck,
			request: {
				workflowId: "workflow-provider-sdk-duplicate",
				evidenceId: "provider-sdk-duplicate-second-evidence",
				resultId: "provider-sdk-duplicate-second-result",
				liveTestRunRef: "live-test-run-sdk-duplicate",
				idempotencyRef: "idempotency-sdk-duplicate-second",
			},
		});
		assert.equal(second.status, "blocked_before_provider_acquisition");
		assert.equal(second.providerCallAttempted, false);
		assert.equal(second.writeAttempted, false);
		assert.match(
			String(second.redactedBlockReason),
			/duplicate idempotency evidence blocks before any provider call/,
		);
		assert.equal(promptCalls.length, 1);

		const third = await executeProviderAcquisitionTool({
			root,
			client,
			promptBackedCheck,
			request: {
				workflowId: "workflow-provider-sdk-duplicate",
				evidenceId: "provider-sdk-duplicate-third-evidence",
				resultId: "provider-sdk-duplicate-third-result",
				liveTestRunRef: "live-test-run-sdk-duplicate-third",
				idempotencyRef: "idempotency-sdk-duplicate",
			},
		});
		assert.equal(third.status, "blocked_before_provider_acquisition");
		assert.equal(third.providerCallAttempted, false);
		assert.equal(third.writeAttempted, false);
		assert.match(
			String(third.redactedBlockReason),
			/duplicate idempotency evidence blocks before any provider call/,
		);
		assert.equal(promptCalls.length, 1);
		const reloaded = reloadFlowDeskSessionEvidenceV1({
			workflowId: "workflow-provider-sdk-duplicate",
			rootDir: root,
		});
		assert.equal(
			reloaded.entries.filter(
				(entry) =>
					entry.evidenceClass ===
					"exact_model_availability_cache_provider_acquisition_result",
			).length,
			1,
		);
	} finally {
		rmSync(root, { recursive: true, force: true });
	}
});

test("prompt-backed provider acquisition records sanitized blocked evidence on prompt throw", async () => {
	const root = mkdtempSync(join(tmpdir(), "flowdesk-provider-prompt-throw-"));
	const { client, promptCalls } = promptBackedAcquisitionOpenCodeClient({
		promptThrows: true,
	});
	try {
		const result = await executeProviderAcquisitionTool({
			root,
			client,
			promptBackedCheck: {
				enabled: true,
				allowProviderCall: true,
				allowedProviderQualifiedModelIds: ["claude/claude-opus-4-5"],
			},
			request: {
				workflowId: "workflow-provider-sdk-throw",
				evidenceId: "provider-sdk-throw-evidence",
				resultId: "provider-sdk-throw-result",
			},
		});
		assert.equal(result.status, "provider_acquisition_blocked");
		assert.equal(result.providerCallAttempted, true);
		assert.deepEqual(result.blockedLabels, [
			"opencode_sdk_provider_call_failed",
		]);
		assert.equal(
			JSON.stringify(result).includes(
				"provider response token secret raw failure",
			),
			false,
		);
		assert.equal(promptCalls.length, 1);
		const reloaded = reloadFlowDeskSessionEvidenceV1({
			workflowId: "workflow-provider-sdk-throw",
			rootDir: root,
		});
		const record = reloaded.entries.find(
			(entry) => entry.evidenceId === "provider-sdk-throw-evidence",
		)?.record as Record<string, unknown> | undefined;
		assert.ok(record);
		assert.equal(record.state, "blocked");
		assert.equal(record.providerCall, true);
		assert.ok(
			(record.blocked_labels as unknown[]).includes(
				"opencode_sdk_provider_call_failed",
			),
		);
		assert.equal(
			JSON.stringify(record).includes(
				"provider response token secret raw failure",
			),
			false,
		);
	} finally {
		rmSync(root, { recursive: true, force: true });
	}
});

test("exact-model provider acquisition live-test rejects unsanitized client payloads", async () => {
	const root = mkdtempSync(join(tmpdir(), "flowdesk-provider-raw-reject-"));
	try {
		const hooks = await flowdeskOpenCodeServerPlugin.server(
			undefined as never,
			{
				[flowdeskExactModelProviderAcquisitionLiveTestOption]: {
					enabled: true,
					durableStateRoot: root,
					client: {
						checkExactModelAvailability() {
							return {
								outcome: "available",
								sanitized_provider_result_ref:
									"provider-result-redacted-raw-test",
								availability_ref: "availability-live-raw-test",
								highest_tier_eligible: true,
								raw_provider_payload: "provider response token secret",
							};
						},
					},
				},
				localNonDispatchAdapter: false,
				naturalLanguageRouting: false,
			},
		);
		const liveTool =
			hooks.tool?.[flowdeskExactModelProviderAcquisitionLiveTestToolName];
		assert.ok(liveTool);
		const workflowId = "workflow-provider-raw-reject";
		const evidenceId = "provider-raw-reject-evidence";
		const raw = await liveTool.execute(
			{
				request: exactModelProviderAcquisitionToolRequest({
					workflowId,
					evidenceId,
					resultId: "provider-raw-reject-result",
				}),
			},
			undefined as never,
		);
		const result = JSON.parse(toolOutput(raw)) as Record<string, unknown>;
		assert.equal(result.status, "provider_acquisition_blocked");
		assert.equal(result.providerCallAttempted, true);
		assert.equal("raw_provider_payload" in result, false);
		assert.equal("result" in result, false);
		const reloaded = reloadFlowDeskSessionEvidenceV1({
			workflowId,
			rootDir: root,
		});
		assert.equal(reloaded.ok, true, reloaded.errors.join("; "));
		const record = reloaded.entries.find(
			(item) => item.evidenceId === evidenceId,
		)?.record as Record<string, unknown> | undefined;
		assert.ok(record);
		assert.equal(record.state, "blocked");
		assert.ok(
			(record.blocked_labels as unknown[]).includes(
				"provider_acquisition_result_not_sanitized",
			),
		);
	} finally {
		rmSync(root, { recursive: true, force: true });
	}
});

test("server plugin can expose local non-dispatch command-backed tools", async () => {
	const localTools = createFlowDeskLocalNonDispatchAdapterTools(
		new Date("2026-05-17T00:00:00.000Z"),
	);
	assert.deepEqual(
		Object.keys(localTools),
		FLOWDESK_RELEASE_1_COMMAND_MANIFEST.map((entry) => entry.toolName),
	);

	const hooks = await flowdeskOpenCodeServerPlugin.server(undefined as never, {
		[flowdeskLocalNonDispatchAdapterOption]: true,
		[flowdeskNaturalLanguageRoutingOption]: false,
	});
	assert.deepEqual(Object.keys(hooks.tool ?? {}), [
		flowdeskPreSpikeDoctorToolName,
		...Object.keys(localTools),
	]);
	assert.equal(hasProductionOpenCodeRegistration(), true);

	const planFixture = FLOWDESK_FDS1_FIXTURE_CATALOG.find(
		(entry) =>
			entry.toolName === "flowdesk_plan" && entry.schemaKind === "tool_request",
	);
	const statusFixture = FLOWDESK_FDS1_FIXTURE_CATALOG.find(
		(entry) =>
			entry.toolName === "flowdesk_status" &&
			entry.schemaKind === "tool_request",
	);
	const runFixture = FLOWDESK_FDS1_FIXTURE_CATALOG.find(
		(entry) =>
			entry.toolName === "flowdesk_run" && entry.schemaKind === "tool_request",
	);
	assert.ok(planFixture);
	assert.ok(statusFixture);
	assert.ok(runFixture);

	const planTool = hooks.tool?.flowdesk_plan;
	const statusTool = hooks.tool?.flowdesk_status;
	const runTool = hooks.tool?.flowdesk_run;
	assert.ok(planTool);
	assert.ok(statusTool);
	assert.ok(runTool);

	const planResult = JSON.parse(
		toolOutput(
			await planTool.execute(
				{
					...planFixture.categories["valid.minimal"].sample,
					request_id: "request-local",
					workflow_id: "workflow-local",
				},
				undefined as never,
			),
		),
	) as LocalAdapterTestResult;
	assert.equal(planResult.adapterProfile, "local_non_dispatch_command_adapter");
	assert.equal(planResult.handler?.ok, true);
	assert.equal(
		planResult.handler?.handlerMode,
		"command_backed_core_evaluator",
	);
	assert.equal(planResult.handler?.response?.status, "ready");
	assert.equal(planResult.localState?.stateWriteApplied, true);
	assert.equal(planResult.localState?.workflowId, "workflow-local");
	assert.equal(
		planResult.localState?.permissionSource,
		"tool_boundary_injected",
	);
	assert.equal(planResult.providerCall, false);
	assert.equal(planResult.runtimeExecution, false);
	assert.equal(planResult.actualLaneLaunch, false);

	const runResult = JSON.parse(
		toolOutput(
			await runTool.execute(
				{
					...runFixture.categories["valid.minimal"].sample,
					request_id: "request-local-run",
					workflow_id: "workflow-local",
					plan_revision_id: planResult.handler?.response?.plan_revision_id,
					run_mode: "fake-runtime",
					step_id: "step-local",
				},
				undefined as never,
			),
		),
	) as LocalAdapterTestResult;
	assert.equal(runResult.handler?.ok, true);
	assert.equal(runResult.handler?.response?.status, "fake_runtime_complete");
	assert.equal(runResult.localState?.stateWriteApplied, true);
	assert.equal(runResult.localState?.workflowState, "complete");
	assert.equal(runResult.providerCall, false);
	assert.equal(runResult.runtimeExecution, false);
	assert.equal(runResult.actualLaneLaunch, false);

	const statusResult = JSON.parse(
		toolOutput(
			await statusTool.execute(
				{
					...statusFixture.categories["valid.minimal"].sample,
					request_id: "request-local-status",
					workflow_id: "workflow-local",
				},
				undefined as never,
			),
		),
	) as LocalAdapterTestResult;
	assert.equal(statusResult.handler?.ok, true);
	assert.equal(statusResult.handler?.response?.workflow_id, "workflow-local");
	assert.equal(statusResult.handler?.response?.workflow_state, "complete");
	assert.equal(statusResult.localState?.workflowState, "complete");
	assert.equal(statusResult.providerCall, false);
	assert.equal(statusResult.runtimeExecution, false);
	assert.equal(statusResult.actualLaneLaunch, false);

	const invalidPlanResult = JSON.parse(
		toolOutput(
			await planTool.execute(
				planFixture.categories["invalid.unknown-property"].sample,
				undefined as never,
			),
		),
	) as LocalAdapterTestResult;
	assert.equal(invalidPlanResult.handler?.ok, false);
	assert.equal(
		invalidPlanResult.handler?.handlerMode,
		"request_schema_invalid",
	);
	assert.equal(invalidPlanResult.localState?.stateWriteApplied, false);
});

test("server plugin allows explicit opt-out of local tools and natural-language routing", async () => {
	const disabledHooks = (await flowdeskOpenCodeServerPlugin.server(
		undefined as never,
		{
			[flowdeskLocalNonDispatchAdapterOption]: false,
			[flowdeskNaturalLanguageRoutingOption]: false,
		},
	)) as ChatMessageHooks;
	assert.equal(disabledHooks["chat.message"], undefined);
	assert.deepEqual(Object.keys(disabledHooks.tool ?? {}), [
		flowdeskPreSpikeDoctorToolName,
	]);

	const localOnlyHooks = (await flowdeskOpenCodeServerPlugin.server(
		undefined as never,
		{
			[flowdeskLocalNonDispatchAdapterOption]: true,
			[flowdeskNaturalLanguageRoutingOption]: false,
		},
	)) as ChatMessageHooks;
	assert.equal(localOnlyHooks["chat.message"], undefined);
	assert.equal(
		Object.keys(localOnlyHooks.tool ?? {}).includes(flowdeskChatIntakeToolName),
		false,
	);

	const hooks = (await flowdeskOpenCodeServerPlugin.server(undefined as never, {
		[flowdeskLocalNonDispatchAdapterOption]: false,
		[flowdeskNaturalLanguageRoutingOption]: true,
	})) as ChatMessageHooks;
	assert.deepEqual(Object.keys(hooks.tool ?? {}), [
		flowdeskPreSpikeDoctorToolName,
		flowdeskChatIntakeToolName,
	]);
	assert.ok(hooks["chat.message"]);

	const doctor = hooks.tool?.[flowdeskPreSpikeDoctorToolName];
	assert.ok(doctor);
	const result = JSON.parse(
		toolOutput(await doctor.execute({}, undefined as never)),
	) as Record<string, unknown>;
	assert.equal(
		result.naturalLanguageRoutingProfile,
		"chat_steering_command_backed_non_dispatch",
	);
	assert.equal(result.productionOpenCodeRegistration, true);
	assert.equal(result.providerCall, false);
});

test("server plugin loads project config and fails closed for missing or disabling config", async () => {
	const root = mkdtempSync(join(tmpdir(), "flowdesk-project-config-"));
	try {
		mkdirSync(join(root, ".flowdesk"), { recursive: true });
		writeFileSync(
			join(root, ".flowdesk", "config.json"),
			`${JSON.stringify(release1ProjectConfig(), null, 2)}\n`,
			"utf8",
		);
		const hooks = (await flowdeskOpenCodeServerPlugin.server(
			undefined as never,
			{
				[flowdeskNaturalLanguageRoutingOption]: true,
				[flowdeskProjectConfigOption]: { enabled: true, rootDir: root },
			},
		)) as ChatMessageHooks;
		assert.ok(hooks["chat.message"]);
		const doctor = hooks.tool?.[flowdeskPreSpikeDoctorToolName];
		assert.ok(doctor);
		const result = JSON.parse(
			toolOutput(await doctor.execute({}, undefined as never)),
		) as Record<string, unknown>;
		assert.equal(
			(result.projectConfig as { status?: unknown }).status,
			"loaded",
		);
		assert.equal(
			(result.projectConfig as { configRef?: unknown }).configRef,
			"config-test",
		);

		writeFileSync(
			join(root, ".flowdesk", "config.json"),
			`${JSON.stringify(release1ProjectConfig({ chat_intake_mode: "off", hook_harness_mode: "off", disabled_modes: ["chat_routed", "real_dispatch", "managed_fallback", "lane_launch", "hard_chat_blocking"] }), null, 2)}\n`,
			"utf8",
		);
		const disabledHooks = (await flowdeskOpenCodeServerPlugin.server(
			undefined as never,
			{
				[flowdeskNaturalLanguageRoutingOption]: true,
				[flowdeskProjectConfigOption]: { enabled: true, rootDir: root },
			},
		)) as ChatMessageHooks;
		assert.equal(disabledHooks["chat.message"], undefined);
		const disabledDoctor = disabledHooks.tool?.[flowdeskPreSpikeDoctorToolName];
		assert.ok(disabledDoctor);
		const disabledResult = JSON.parse(
			toolOutput(await disabledDoctor.execute({}, undefined as never)),
		) as Record<string, unknown>;
		assert.equal(disabledResult.naturalLanguageRoutingProfile, "disabled");

		const missingRoot = mkdtempSync(
			join(tmpdir(), "flowdesk-project-config-missing-"),
		);
		try {
			const missingHooks = (await flowdeskOpenCodeServerPlugin.server(
				undefined as never,
				{
					[flowdeskNaturalLanguageRoutingOption]: true,
					[flowdeskProjectConfigOption]: {
						enabled: true,
						rootDir: missingRoot,
					},
				},
			)) as ChatMessageHooks;
			assert.equal(missingHooks["chat.message"], undefined);
			const missingDoctor = missingHooks.tool?.[flowdeskPreSpikeDoctorToolName];
			assert.ok(missingDoctor);
			const missingResult = JSON.parse(
				toolOutput(await missingDoctor.execute({}, undefined as never)),
			) as Record<string, unknown>;
			assert.equal(
				(missingResult.projectConfig as { status?: unknown }).status,
				"missing",
			);
		} finally {
			rmSync(missingRoot, { recursive: true, force: true });
		}
	} finally {
		rmSync(root, { recursive: true, force: true });
	}
});

test("chat intake tool evaluates routing and executes local command-backed result safely", async () => {
	const hooks = (await flowdeskOpenCodeServerPlugin.server(undefined as never, {
		[flowdeskNaturalLanguageRoutingOption]: true,
	})) as ChatMessageHooks;
	const intakeTool = hooks.tool?.[flowdeskChatIntakeToolName];
	assert.ok(intakeTool);

	const result = JSON.parse(
		toolOutput(
			await intakeTool.execute(
				{
					schema_version: "flowdesk.chat_intake.request.v1",
					request_id: "request-nl-status",
					input_mode: "chat_routed",
					session_ref: "session-nl",
					redacted_intake_ref: "intake-nl-status",
					intake_summary: "현재 상태와 진행상황 알려줘",
					source_surface: "chat.message",
				},
				undefined as never,
			),
		),
	) as NaturalLanguageRoutingTestResult;

	assert.equal(result.ok, true);
	assert.equal(
		result.evaluation?.response?.route_decision,
		"use_command_fallback",
	);
	assert.deepEqual(result.evaluation?.response?.safe_next_actions, [
		"/flowdesk-status",
	]);
	assert.equal(result.routedToolName, "flowdesk_status");
	assert.equal(result.routedToolResult?.handler?.ok, true);
	assert.equal(result.providerCall, false);
	assert.equal(result.runtimeExecution, false);
	assert.equal(result.actualLaneLaunch, false);
	assert.equal(result.fallbackAuthority, false);
	assert.equal(result.hardCancelOrNoReplyAuthority, false);

	const continuousWithoutPlan = JSON.parse(
		toolOutput(
			await intakeTool.execute(
				{
					schema_version: "flowdesk.chat_intake.request.v1",
					request_id: "request-nl-continuous-no-plan",
					input_mode: "chat_routed",
					session_ref: "session-nl-continuous",
					redacted_intake_ref: "intake-nl-continuous-no-plan",
					intake_summary: "막히기전까지 계속 진행해줘",
					source_surface: "chat.message",
				},
				undefined as never,
			),
		),
	) as NaturalLanguageRoutingTestResult;
	assert.equal(
		continuousWithoutPlan.evaluation?.response?.route_decision,
		"ask_clarification",
	);
	assert.deepEqual(
		continuousWithoutPlan.evaluation?.response?.safe_next_actions,
		["ask_clarification", "/flowdesk-status"],
	);
	assert.equal(continuousWithoutPlan.routedToolName, "flowdesk_status");
	assert.equal(continuousWithoutPlan.runtimeExecution, false);
	assert.equal(continuousWithoutPlan.actualLaneLaunch, false);

	const planForContinuous = JSON.parse(
		toolOutput(
			await intakeTool.execute(
				{
					schema_version: "flowdesk.chat_intake.request.v1",
					request_id: "request-nl-continuous-plan",
					input_mode: "chat_routed",
					session_ref: "session-nl-continuous",
					redacted_intake_ref: "intake-nl-continuous-plan",
					intake_summary: "구현 계획을 세워줘",
					source_surface: "chat.message",
				},
				undefined as never,
			),
		),
	) as NaturalLanguageRoutingTestResult;
	assert.equal(planForContinuous.routedToolName, "flowdesk_plan");
	assert.equal(
		planForContinuous.routedToolResult?.localState?.workflowState,
		"ready_to_run",
	);

	const continuousWithPlan = JSON.parse(
		toolOutput(
			await intakeTool.execute(
				{
					schema_version: "flowdesk.chat_intake.request.v1",
					request_id: "request-nl-continuous-with-plan",
					input_mode: "chat_routed",
					session_ref: "session-nl-continuous",
					redacted_intake_ref: "intake-nl-continuous-with-plan",
					intake_summary: "계획 전체 진행해줘",
					source_surface: "chat.message",
				},
				undefined as never,
			),
		),
	) as NaturalLanguageRoutingTestResult;
	assert.equal(
		continuousWithPlan.evaluation?.response?.route_decision,
		"use_command_fallback",
	);
	assert.deepEqual(continuousWithPlan.evaluation?.response?.safe_next_actions, [
		"/flowdesk-resume",
		"/flowdesk-status",
	]);
	assert.equal(continuousWithPlan.routedToolName, "flowdesk_resume");
	assert.equal(continuousWithPlan.providerCall, false);
	assert.equal(continuousWithPlan.runtimeExecution, false);
	assert.equal(continuousWithPlan.actualLaneLaunch, false);

	const doctor = JSON.parse(
		toolOutput(
			await intakeTool.execute(
				{
					schema_version: "flowdesk.chat_intake.request.v1",
					request_id: "request-nl-doctor",
					input_mode: "chat_routed",
					session_ref: "session-nl",
					redacted_intake_ref: "intake-nl-doctor",
					intake_summary: "/flowdesk-doctor",
					source_surface: "chat.message",
				},
				undefined as never,
			),
		),
	) as NaturalLanguageRoutingTestResult;
	assert.equal(
		doctor.evaluation?.response?.route_decision,
		"use_command_fallback",
	);
	assert.equal(doctor.routedToolName, "flowdesk_doctor");
	assert.equal(doctor.routedToolResult?.handler?.ok, true);
	assert.equal(doctor.routedToolResult?.handler?.response?.status, "degraded");
	assert.equal(doctor.providerCall, false);
	assert.equal(doctor.runtimeExecution, false);
	assert.equal(doctor.actualLaneLaunch, false);

	const retry = JSON.parse(
		toolOutput(
			await intakeTool.execute(
				{
					schema_version: "flowdesk.chat_intake.request.v1",
					request_id: "request-nl-retry",
					input_mode: "chat_routed",
					workflow_id: "workflow-nl-retry",
					session_ref: "session-nl",
					redacted_intake_ref: "intake-nl-retry",
					intake_summary: "retry the last failed attempt",
					source_surface: "chat.message",
				},
				undefined as never,
			),
		),
	) as NaturalLanguageRoutingTestResult;
	assert.deepEqual(retry.evaluation?.response?.safe_next_actions, [
		"/flowdesk-status",
		"/flowdesk-retry",
	]);
	assert.equal(retry.routedToolName, "flowdesk_retry");
	assert.equal(retry.routedToolResult?.handler?.ok, true);
	assert.equal(retry.providerCall, false);
	assert.equal(retry.runtimeExecution, false);

	const abort = JSON.parse(
		toolOutput(
			await intakeTool.execute(
				{
					schema_version: "flowdesk.chat_intake.request.v1",
					request_id: "request-nl-abort",
					input_mode: "chat_routed",
					workflow_id: "workflow-nl-abort",
					session_ref: "session-nl",
					redacted_intake_ref: "intake-nl-abort",
					intake_summary: "cancel workflow safely",
					source_surface: "chat.message",
				},
				undefined as never,
			),
		),
	) as NaturalLanguageRoutingTestResult;
	assert.deepEqual(abort.evaluation?.response?.safe_next_actions, [
		"/flowdesk-status",
		"/flowdesk-abort",
	]);
	assert.equal(abort.routedToolName, "flowdesk_abort");
	assert.equal(abort.routedToolResult?.handler?.ok, true);
	assert.equal(abort.routedToolResult?.handler?.responseSchemaValid, true);
	assert.equal(abort.providerCall, false);
	assert.equal(abort.actualLaneLaunch, false);

	const resume = JSON.parse(
		toolOutput(
			await intakeTool.execute(
				{
					schema_version: "flowdesk.chat_intake.request.v1",
					request_id: "request-nl-resume",
					input_mode: "chat_routed",
					workflow_id: "workflow-nl-resume",
					session_ref: "session-nl",
					redacted_intake_ref: "intake-nl-resume",
					intake_summary: "resume from checkpoint",
					source_surface: "chat.message",
				},
				undefined as never,
			),
		),
	) as NaturalLanguageRoutingTestResult;
	assert.deepEqual(resume.evaluation?.response?.safe_next_actions, [
		"/flowdesk-status",
		"/flowdesk-resume",
	]);
	assert.equal(resume.routedToolName, "flowdesk_resume");
	assert.equal(resume.routedToolResult?.handler?.ok, true);
	assert.equal(resume.providerCall, false);
	assert.equal(resume.actualLaneLaunch, false);

	const usage = JSON.parse(
		toolOutput(
			await intakeTool.execute(
				{
					schema_version: "flowdesk.chat_intake.request.v1",
					request_id: "request-nl-usage",
					input_mode: "chat_routed",
					session_ref: "session-nl",
					redacted_intake_ref: "intake-nl-usage",
					intake_summary: "show usage quota",
					source_surface: "chat.message",
				},
				undefined as never,
			),
		),
	) as NaturalLanguageRoutingTestResult;
	assert.deepEqual(usage.evaluation?.response?.safe_next_actions, [
		"/flowdesk-usage",
		"/flowdesk-doctor",
		"/flowdesk-status",
	]);
	assert.equal(usage.routedToolName, "flowdesk_usage");
	assert.equal(usage.routedToolResult?.handler?.ok, true);
	assert.equal(usage.providerCall, false);

	const exportDebug = JSON.parse(
		toolOutput(
			await intakeTool.execute(
				{
					schema_version: "flowdesk.chat_intake.request.v1",
					request_id: "request-nl-export-debug",
					input_mode: "chat_routed",
					session_ref: "session-nl",
					redacted_intake_ref: "intake-nl-export-debug",
					intake_summary: "export debug bundle",
					source_surface: "chat.message",
				},
				undefined as never,
			),
		),
	) as NaturalLanguageRoutingTestResult;
	assert.deepEqual(exportDebug.evaluation?.response?.safe_next_actions, [
		"/flowdesk-export-debug",
		"/flowdesk-status",
	]);
	assert.equal(exportDebug.routedToolName, "flowdesk_export_debug");
	assert.equal(exportDebug.routedToolResult?.handler?.ok, true);
	assert.equal(
		exportDebug.routedToolResult?.localState?.stateWriteApplied,
		true,
	);
	assert.equal(exportDebug.providerCall, false);
	assert.equal(exportDebug.runtimeExecution, false);
});

test("export debug writes a redacted manifest when durable state root is configured", async () => {
	const root = mkdtempSync(join(tmpdir(), "flowdesk-debug-export-"));
	try {
		const hooks = (await flowdeskOpenCodeServerPlugin.server(
			undefined as never,
			{
				[flowdeskDurableStateRootOption]: root,
				[flowdeskNaturalLanguageRoutingOption]: false,
			},
		)) as ChatMessageHooks;
		const exportDebugTool = hooks.tool?.flowdesk_export_debug;
		assert.ok(exportDebugTool);
		const result = JSON.parse(
			toolOutput(
				await exportDebugTool.execute(
					{
						schema_version: "flowdesk.export_debug.request.v1",
						request_id: "request-export-debug-durable",
						input_mode: "test_fixture",
						include_sections: ["doctor", "redaction_summary"],
						retention_hint: "keep_until_default_expiry",
					},
					undefined as never,
				),
			),
		) as LocalAdapterTestResult;
		assert.equal(result.handler?.ok, true);
		assert.equal(result.localState?.stateWriteApplied, true);
		assert.equal(result.localState?.durableStateWriteApplied, true);
		const manifestPath = join(
			root,
			".flowdesk/sessions/session-local/redacted-debug/manifest.json",
		);
		assert.equal(existsSync(manifestPath), true);
		const manifest = JSON.parse(readFileSync(manifestPath, "utf8")) as Record<
			string,
			unknown
		>;
		assert.equal(manifest.schema_version, "flowdesk.debug_export_manifest.v1");
		assert.deepEqual(
			Array.isArray(manifest.included_sections)
				? manifest.included_sections.map(
						(section) => (section as { section?: unknown }).section,
					)
				: [],
			["doctor", "redaction_summary"],
		);
		assert.equal(manifest.file_count, 2);
		assert.equal(typeof manifest.byte_count === "number" && (manifest.byte_count as number) > 0, true);
		const doctorSectionPath = join(
			root,
			".flowdesk/sessions/session-local/redacted-debug/sections/doctor.json",
		);
		const redactionSectionPath = join(
			root,
			".flowdesk/sessions/session-local/redacted-debug/sections/redaction_summary.json",
		);
		assert.equal(existsSync(doctorSectionPath), true);
		assert.equal(existsSync(redactionSectionPath), true);
		const doctorSection = JSON.parse(readFileSync(doctorSectionPath, "utf8")) as Record<string, unknown>;
		assert.equal(doctorSection.schema_version, "flowdesk.debug_section_file.v1");
		assert.equal(doctorSection.section, "doctor");
		assert.equal(doctorSection.redaction_status, "passed");
		assert.ok(Array.isArray(doctorSection.summary_labels));
		const doctorLabels = (doctorSection.summary_labels as string[]).join("|");
		assert.match(doctorLabels, /disabled_modes: real_dispatch managed_fallback lane_launch hard_chat_blocking/);
		assert.match(doctorLabels, /production_enablement: disabled/);
		const redactionSection = JSON.parse(readFileSync(redactionSectionPath, "utf8")) as Record<string, unknown>;
		const redactionLabels = ((redactionSection.summary_labels ?? []) as string[]).join("|");
		assert.match(redactionLabels, /redaction_version: redaction-v1/);
		assert.match(redactionLabels, /raw_payload_markers: blocked/);
		assert.equal(
			/raw|payload|transcript|credential|secret|token|\/Users/.test(
				JSON.stringify(manifest) + JSON.stringify(doctorSection),
			),
			false,
		);
	} finally {
		rmSync(root, { recursive: true, force: true });
	}
});

test("chat intake holds execution-like requests for confirmation before run", async () => {
	const hooks = (await flowdeskOpenCodeServerPlugin.server(undefined as never, {
		[flowdeskNaturalLanguageRoutingOption]: true,
	})) as ChatMessageHooks;
	const intakeTool = hooks.tool?.[flowdeskChatIntakeToolName];
	assert.ok(intakeTool);

	const result = JSON.parse(
		toolOutput(
			await intakeTool.execute(
				{
					schema_version: "flowdesk.chat_intake.request.v1",
					request_id: "request-nl-run-confirm",
					input_mode: "chat_routed",
					workflow_id: "workflow-nl-run-confirm",
					session_ref: "session-nl-run-confirm",
					redacted_intake_ref: "intake-nl-run-confirm",
					intake_summary: "approved plan을 fake-runtime으로 실행 진행해",
					source_surface: "chat.message",
				},
				undefined as never,
			),
		),
	) as NaturalLanguageRoutingTestResult;

	assert.equal(result.ok, true);
	assert.equal(
		result.evaluation?.response?.route_decision,
		"ask_clarification",
	);
	assert.deepEqual(result.evaluation?.response?.safe_next_actions, [
		"ask_clarification",
		"/flowdesk-plan",
		"/flowdesk-status",
	]);
	assert.equal(result.routedToolName, "flowdesk_plan");
	assert.equal(result.routedToolResult?.handler?.ok, true);
	assert.equal(result.routedToolResult?.handler?.response?.status, "ready");
	assert.equal(
		result.routedToolResult?.handler?.response?.workflow_state,
		undefined,
	);
	assert.equal(
		result.routedToolResult?.localState?.workflowState,
		"plan_pending_approval",
	);
	assert.equal(result.routedToolResult?.localState?.stateWriteApplied, true);
	assert.equal(
		result.routedToolResult?.localState?.pendingConfirmationStatus,
		"pending",
	);
	const pendingApprovalRef =
		result.routedToolResult?.localState?.pendingConfirmationRef;
	assert.equal(typeof pendingApprovalRef, "string");
	assert.notEqual(result.routedToolName, "flowdesk_run");
	assert.equal(result.runtimeExecution, false);
	assert.equal(result.actualLaneLaunch, false);

	const confirmed = JSON.parse(
		toolOutput(
			await intakeTool.execute(
				{
					schema_version: "flowdesk.chat_intake.request.v1",
					request_id: "request-nl-run-confirmed",
					input_mode: "chat_routed",
					workflow_id: "workflow-nl-run-confirm",
					session_ref: "session-nl-run-confirm",
					redacted_intake_ref: "intake-nl-run-confirm",
					user_approval_ref: pendingApprovalRef,
					intake_summary: "approved plan을 fake-runtime으로 실행 진행해",
					source_surface: "chat.message",
				},
				undefined as never,
			),
		),
	) as NaturalLanguageRoutingTestResult;
	assert.equal(
		confirmed.evaluation?.response?.route_decision,
		"use_command_fallback",
	);
	assert.deepEqual(confirmed.evaluation?.response?.safe_next_actions, [
		"/flowdesk-run",
		"/flowdesk-status",
	]);
	assert.equal(confirmed.routedToolName, "flowdesk_run");
	assert.equal(confirmed.routedToolResult?.handler?.ok, true);
	assert.equal(
		confirmed.routedToolResult?.localState?.workflowState,
		"complete",
	);
	assert.equal(
		confirmed.routedToolResult?.localState?.pendingConfirmationStatus,
		"consumed",
	);
	assert.equal(confirmed.runtimeExecution, false);
	assert.equal(confirmed.actualLaneLaunch, false);

	const reused = JSON.parse(
		toolOutput(
			await intakeTool.execute(
				{
					schema_version: "flowdesk.chat_intake.request.v1",
					request_id: "request-nl-run-reused-confirmation",
					input_mode: "chat_routed",
					workflow_id: "workflow-nl-run-confirm",
					session_ref: "session-nl-run-confirm",
					redacted_intake_ref: "intake-nl-run-confirm",
					user_approval_ref: pendingApprovalRef,
					intake_summary: "approved plan을 fake-runtime으로 실행 진행해",
					source_surface: "chat.message",
				},
				undefined as never,
			),
		),
	) as NaturalLanguageRoutingTestResult;
	assert.equal(reused.routedToolName, "flowdesk_run");
	assert.equal(reused.routedToolResult?.handler?.ok, false);
	assert.equal(
		reused.routedToolResult?.handler?.handlerMode,
		"pending_confirmation_invalid",
	);
	assert.equal(
		reused.routedToolResult?.localState?.pendingConfirmationStatus,
		"consumed",
	);
	assert.equal(reused.routedToolResult?.localState?.stateWriteApplied, false);
	assert.equal(reused.runtimeExecution, false);
	assert.equal(reused.actualLaneLaunch, false);

	const weakApproval = JSON.parse(
		toolOutput(
			await intakeTool.execute(
				{
					schema_version: "flowdesk.chat_intake.request.v1",
					request_id: "request-nl-run-weak-approval",
					input_mode: "chat_routed",
					workflow_id: "workflow-nl-run-weak-approval",
					session_ref: "session-nl-run-weak-approval",
					redacted_intake_ref: "intake-nl-run-weak-approval",
					user_approval_ref: "approval-nl-run-weak-approval",
					intake_summary: "maybe fake-runtime run this later",
					source_surface: "chat.message",
				},
				undefined as never,
			),
		),
	) as NaturalLanguageRoutingTestResult;
	assert.equal(
		weakApproval.evaluation?.response?.route_decision,
		"ask_clarification",
	);
	assert.equal(weakApproval.routedToolName, "flowdesk_plan");
	assert.equal(
		weakApproval.routedToolResult?.localState?.workflowState,
		"plan_pending_approval",
	);
	assert.equal(weakApproval.runtimeExecution, false);
	assert.equal(weakApproval.actualLaneLaunch, false);

	const missingSessionScope = JSON.parse(
		toolOutput(
			await intakeTool.execute(
				{
					schema_version: "flowdesk.chat_intake.request.v1",
					request_id: "request-nl-run-missing-session-scope",
					input_mode: "chat_routed",
					workflow_id: "workflow-nl-run-confirm",
					redacted_intake_ref: "intake-nl-run-confirm",
					user_approval_ref: pendingApprovalRef,
					intake_summary: "approved plan을 fake-runtime으로 실행 진행해",
					source_surface: "chat.message",
				},
				undefined as never,
			),
		),
	) as NaturalLanguageRoutingTestResult;
	assert.equal(missingSessionScope.routedToolResult?.handler?.ok, false);
	assert.equal(
		missingSessionScope.routedToolResult?.handler?.handlerMode,
		"pending_confirmation_invalid",
	);
	assert.equal(missingSessionScope.runtimeExecution, false);
});

test("local adapter fails closed for expired and cancelled pending confirmations", () => {
	let clock = new Date("2026-05-17T00:00:00.000Z");
	const session = createFlowDeskLocalNonDispatchAdapterSession(() => clock);
	const pendingPlan = session.evaluate("flowdesk_plan", {
		schema_version: "flowdesk.plan.request.v1",
		request_id: "request-expiring-plan",
		input_mode: "chat_routed",
		workflow_id: "workflow-expiring-plan",
		session_ref: "session-expiring-plan",
		redacted_intake_ref: "intake-expiring-plan",
		goal_summary: "approved plan을 fake-runtime으로 실행 진행해",
		scope_summary:
			"FlowDesk natural-language chat intake routed to command-backed planning.",
		risk_hint:
			"execution-like chat intake requires explicit user confirmation before any run",
	});
	assert.equal(pendingPlan.localState.pendingConfirmationStatus, "pending");
	const approvalRef = pendingPlan.localState.pendingConfirmationRef;
	assert.equal(typeof approvalRef, "string");

	clock = new Date("2026-05-17T00:16:00.000Z");
	const expiredRun = session.evaluate("flowdesk_run", {
		schema_version: "flowdesk.run.request.v1",
		request_id: "request-expired-run",
		input_mode: "chat_routed",
		workflow_id: "workflow-expiring-plan",
		session_ref: "session-expiring-plan",
		redacted_intake_ref: "intake-expiring-plan",
		user_approval_ref: approvalRef,
		run_mode: "fake-runtime",
		plan_revision_id: "plan-workflow-expiring-plan",
		step_id: "step-expired-run",
	});
	assert.equal(expiredRun.handler.ok, false);
	assert.equal(expiredRun.handler.handlerMode, "pending_confirmation_invalid");
	assert.equal(expiredRun.localState.pendingConfirmationStatus, "expired");
	assert.equal(expiredRun.localState.workflowState, "plan_pending_approval");
	assert.equal(expiredRun.runtimeExecution, false);

	clock = new Date("2026-05-17T01:00:00.000Z");
	const cancelSession = createFlowDeskLocalNonDispatchAdapterSession(
		() => clock,
	);
	const cancellablePlan = cancelSession.evaluate("flowdesk_plan", {
		schema_version: "flowdesk.plan.request.v1",
		request_id: "request-cancellable-plan",
		input_mode: "chat_routed",
		workflow_id: "workflow-cancellable-plan",
		session_ref: "session-cancellable-plan",
		redacted_intake_ref: "intake-cancellable-plan",
		goal_summary: "approved plan을 fake-runtime으로 실행 진행해",
		scope_summary:
			"FlowDesk natural-language chat intake routed to command-backed planning.",
		risk_hint:
			"execution-like chat intake requires explicit user confirmation before any run",
	});
	const cancellableApprovalRef =
		cancellablePlan.localState.pendingConfirmationRef;
	const abort = cancelSession.evaluate("flowdesk_abort", {
		schema_version: "flowdesk.abort.request.v1",
		request_id: "request-cancel-pending",
		input_mode: "chat_routed",
		workflow_id: "workflow-cancellable-plan",
		session_ref: "session-cancellable-plan",
		redacted_intake_ref: "intake-cancellable-plan",
		reason: "FlowDesk chat intake requested a safe abort diagnostic.",
	});
	assert.equal(abort.handler.ok, true);
	assert.equal(abort.localState.pendingConfirmationStatus, "cancelled");
	assert.equal(abort.hardCancelOrNoReplyAuthority, false);

	const cancelledRun = cancelSession.evaluate("flowdesk_run", {
		schema_version: "flowdesk.run.request.v1",
		request_id: "request-cancelled-run",
		input_mode: "chat_routed",
		workflow_id: "workflow-cancellable-plan",
		session_ref: "session-cancellable-plan",
		redacted_intake_ref: "intake-cancellable-plan",
		user_approval_ref: cancellableApprovalRef,
		run_mode: "fake-runtime",
		plan_revision_id: "plan-workflow-cancellable-plan",
		step_id: "step-cancelled-run",
	});
	assert.equal(cancelledRun.handler.ok, false);
	assert.equal(
		cancelledRun.handler.handlerMode,
		"pending_confirmation_invalid",
	);
	assert.equal(cancelledRun.localState.pendingConfirmationStatus, "cancelled");
	assert.equal(cancelledRun.actualLaneLaunch, false);
});

test("local adapter can opt into durable .flowdesk state materialization", () => {
	const root = mkdtempSync(join(tmpdir(), "flowdesk-local-adapter-"));
	try {
		const session = createFlowDeskLocalNonDispatchAdapterSession(
			new Date("2026-05-17T00:00:00.000Z"),
			undefined,
			{ durableStateRootDir: root },
		);
		const plan = session.evaluate("flowdesk_plan", {
			schema_version: "flowdesk.plan.request.v1",
			request_id: "request-durable-plan",
			input_mode: "chat_routed",
			workflow_id: "workflow-durable-plan",
			session_ref: "session-durable-plan",
			redacted_intake_ref: "intake-durable-plan",
			goal_summary: "구현 계획을 세워줘",
			scope_summary:
				"FlowDesk natural-language chat intake routed to command-backed planning.",
			risk_hint: "ordinary Release 1 command-backed steering only",
		});
		assert.equal(plan.handler.ok, true);
		assert.equal(plan.localState.stateWriteApplied, true);
		assert.equal(plan.localState.durableStateMode, "durable_flowdesk_root");
		assert.equal(plan.localState.durableStateWriteApplied, true);
		assert.equal(plan.localState.durableStateWrites, 3);
		const workflowPath = join(
			root,
			".flowdesk/workflows/workflow-durable-plan/workflow.json",
		);
		const lanesPath = join(
			root,
			".flowdesk/sessions/session-local/lanes.jsonl",
		);
		assert.equal(existsSync(workflowPath), true);
		assert.equal(
			JSON.parse(readFileSync(workflowPath, "utf8")).workflow_id,
			"workflow-durable-plan",
		);
		assert.match(
			readFileSync(lanesPath, "utf8"),
			/"lane_id":"lane-plan-request-durable-plan"/,
		);

		const status = session.evaluate("flowdesk_status", {
			schema_version: "flowdesk.status.request.v1",
			request_id: "request-durable-status",
			input_mode: "chat_routed",
			workflow_id: "workflow-durable-plan",
			session_ref: "session-durable-plan",
			redacted_intake_ref: "intake-durable-status",
			detail_level: "summary",
		});
		assert.equal(status.handler.ok, true);
		assert.equal(status.localState.durableStateMode, "durable_flowdesk_root");
		assert.equal(status.providerCall, false);
		assert.equal(status.runtimeExecution, false);

		const reloadedSession = createFlowDeskLocalNonDispatchAdapterSession(
			new Date("2026-05-17T00:00:00.000Z"),
			undefined,
			{ durableStateRootDir: root },
		);
		const reloadedStatus = reloadedSession.evaluate("flowdesk_status", {
			schema_version: "flowdesk.status.request.v1",
			request_id: "request-durable-status-reload",
			input_mode: "chat_routed",
			workflow_id: "workflow-durable-plan",
			session_ref: "session-durable-plan",
			redacted_intake_ref: "intake-durable-status-reload",
			detail_level: "summary",
		});
		assert.equal(reloadedStatus.handler.ok, true);
		const reloadedResponse = reloadedStatus.handler.response as
			| { workflow_id?: unknown; workflow_state?: unknown }
			| undefined;
		assert.equal(reloadedResponse?.workflow_id, "workflow-durable-plan");
		assert.equal(reloadedResponse?.workflow_state, "ready_to_run");
		assert.equal(reloadedStatus.localState.workflowState, "ready_to_run");
		assert.equal(reloadedStatus.localState.laneRecords, 1);
		assert.equal(reloadedStatus.providerCall, false);
	} finally {
		rmSync(root, { recursive: true, force: true });
	}
});

test("local adapter loads project config and policy packs from disk for non-dispatch runs", () => {
	const root = mkdtempSync(join(tmpdir(), "flowdesk-policy-load-"));
	try {
		mkdirSync(join(root, ".flowdesk", "policy-packs"), { recursive: true });
		writeFileSync(
			join(root, ".flowdesk", "config.json"),
			`${JSON.stringify(
				release1ProjectConfig({
					config_id: "config-disk",
					config_hash: "config-hash-disk",
					project_root_ref: "project-root-disk",
					policy_pack_refs: ["policy-source-disk"],
					policy_pack_hashes: ["policy-hash-disk"],
					audit_refs: ["audit-disk"],
				}),
				null,
				2,
			)}\n`,
			"utf8",
		);
		writeFileSync(
			join(root, ".flowdesk", "policy-packs", "policy.json"),
			`${JSON.stringify(
				release1PolicyPack({
					policy_pack_id: "policy-disk",
					policy_pack_hash: "policy-hash-disk",
					source_ref: "policy-source-disk",
				}),
				null,
				2,
			)}\n`,
			"utf8",
		);

		const session = createFlowDeskLocalNonDispatchAdapterSession(
			new Date("2026-05-17T00:00:00.000Z"),
			undefined,
			{
				projectConfig: {
					enabled: true,
					rootDir: root,
					policyPackPaths: [".flowdesk/policy-packs/policy.json"],
				},
			},
		);
		const run = session.evaluate("flowdesk_run", {
			schema_version: "flowdesk.run.request.v1",
			request_id: "request-disk-policy-run",
			input_mode: "test_fixture",
			workflow_id: "workflow-disk-policy",
			session_ref: "session-disk-policy",
			run_mode: "fake-runtime",
			plan_revision_id: "plan-disk-policy",
			step_id: "step-disk-policy",
		});
		assert.equal(run.ok, true, run.errors.join("; "));
		assert.equal(run.handler.ok, true, run.handler.errors.join("; "));
		assert.equal(run.providerCall, false);
		assert.equal(run.actualLaneLaunch, false);
		assert.equal(run.runtimeExecution, false);
	} finally {
		rmSync(root, { recursive: true, force: true });
	}
});

test("local adapter fails closed for missing or unsafe policy pack disk config", () => {
	const root = mkdtempSync(join(tmpdir(), "flowdesk-policy-blocked-"));
	try {
		mkdirSync(join(root, ".flowdesk"), { recursive: true });
		writeFileSync(
			join(root, ".flowdesk", "config.json"),
			`${JSON.stringify(release1ProjectConfig({ policy_pack_refs: ["policy-source-test"], policy_pack_hashes: ["policy-hash-test"] }), null, 2)}\n`,
			"utf8",
		);
		const missingPackSession = createFlowDeskLocalNonDispatchAdapterSession(
			new Date("2026-05-17T00:00:00.000Z"),
			undefined,
			{ projectConfig: { enabled: true, rootDir: root } },
		);
		const missingPack = missingPackSession.evaluate("flowdesk_plan", {
			schema_version: "flowdesk.plan.request.v1",
			request_id: "request-missing-policy-pack",
			input_mode: "chat_routed",
			workflow_id: "workflow-missing-policy-pack",
			goal_summary: "Verify policy pack fail closed behavior.",
			scope_summary: "Disk policy pack loading test.",
		});
		assert.equal(missingPack.ok, false);
		assert.match(
			missingPack.errors.join("|"),
			/policy_pack_file_count_mismatch/,
		);
		assert.equal(missingPack.providerCall, false);
		assert.equal(missingPack.actualLaneLaunch, false);

		const unsafePathSession = createFlowDeskLocalNonDispatchAdapterSession(
			new Date("2026-05-17T00:00:00.000Z"),
			undefined,
			{
				projectConfig: {
					enabled: true,
					rootDir: root,
					policyPackPaths: ["../outside.json"],
				},
			},
		);
		const unsafePath = unsafePathSession.evaluate("flowdesk_plan", {
			schema_version: "flowdesk.plan.request.v1",
			request_id: "request-unsafe-policy-pack",
			input_mode: "chat_routed",
			workflow_id: "workflow-unsafe-policy-pack",
			goal_summary: "Verify unsafe policy path blocks.",
			scope_summary: "Disk policy pack loading test.",
		});
		assert.equal(unsafePath.ok, false);
		assert.match(unsafePath.errors.join("|"), /policy_pack_path_0_unsafe/);
		assert.equal(unsafePath.runtimeExecution, false);
	} finally {
		rmSync(root, { recursive: true, force: true });
	}
});

test("local adapter fails closed when durable state reload is malformed", () => {
	const root = mkdtempSync(
		join(tmpdir(), "flowdesk-local-adapter-reload-blocked-"),
	);
	try {
		const session = createFlowDeskLocalNonDispatchAdapterSession(
			new Date("2026-05-17T00:00:00.000Z"),
			undefined,
			{ durableStateRootDir: root },
		);
		const plan = session.evaluate("flowdesk_plan", {
			schema_version: "flowdesk.plan.request.v1",
			request_id: "request-durable-malformed-plan",
			input_mode: "chat_routed",
			workflow_id: "workflow-durable-malformed",
			session_ref: "session-durable-malformed",
			redacted_intake_ref: "intake-durable-malformed-plan",
			goal_summary: "구현 계획을 세워줘",
			scope_summary:
				"FlowDesk natural-language chat intake routed to command-backed planning.",
			risk_hint: "ordinary Release 1 command-backed steering only",
		});
		assert.equal(plan.ok, true);
		writeFileSync(
			join(
				root,
				".flowdesk/workflows/workflow-durable-malformed/workflow.json",
			),
			JSON.stringify({ raw_prompt: "system prompt leak" }),
			"utf8",
		);

		const reloadedSession = createFlowDeskLocalNonDispatchAdapterSession(
			new Date("2026-05-17T00:00:00.000Z"),
			undefined,
			{ durableStateRootDir: root },
		);
		const status = reloadedSession.evaluate("flowdesk_status", {
			schema_version: "flowdesk.status.request.v1",
			request_id: "request-durable-malformed-status",
			input_mode: "chat_routed",
			workflow_id: "workflow-durable-malformed",
			session_ref: "session-durable-malformed",
			redacted_intake_ref: "intake-durable-malformed-status",
			detail_level: "summary",
		});
		assert.equal(status.ok, false);
		assert.equal(status.localState.stateWriteApplied, false);
		assert.equal(status.providerCall, false);
		assert.equal(status.runtimeExecution, false);
	} finally {
		rmSync(root, { recursive: true, force: true });
	}
});

test("local adapter fails closed when durable state cannot be written", () => {
	const root = mkdtempSync(join(tmpdir(), "flowdesk-local-adapter-blocked-"));
	const blockedRoot = join(root, "not-a-directory");
	try {
		writeFileSync(blockedRoot, "not a directory", "utf8");
		const session = createFlowDeskLocalNonDispatchAdapterSession(
			new Date("2026-05-17T00:00:00.000Z"),
			undefined,
			{ durableStateRootDir: blockedRoot },
		);
		const plan = session.evaluate("flowdesk_plan", {
			schema_version: "flowdesk.plan.request.v1",
			request_id: "request-durable-failure",
			input_mode: "chat_routed",
			workflow_id: "workflow-durable-failure",
			session_ref: "session-durable-failure",
			redacted_intake_ref: "intake-durable-failure",
			goal_summary: "구현 계획을 세워줘",
			scope_summary:
				"FlowDesk natural-language chat intake routed to command-backed planning.",
			risk_hint: "ordinary Release 1 command-backed steering only",
		});
		assert.equal(plan.ok, false);
		assert.equal(plan.handler.ok, true);
		assert.equal(plan.localState.stateWriteApplied, false);
		assert.equal(plan.localState.workflowState, undefined);
		assert.equal(plan.localState.durableStateWriteApplied, false);
		assert.equal(plan.providerCall, false);
	} finally {
		rmSync(root, { recursive: true, force: true });
	}
});

test("server option wires durable state root into local routing session", async () => {
	const root = mkdtempSync(join(tmpdir(), "flowdesk-server-durable-"));
	try {
		const hooks = (await flowdeskOpenCodeServerPlugin.server(
			undefined as never,
			{
				[flowdeskNaturalLanguageRoutingOption]: true,
				[flowdeskDurableStateRootOption]: root,
			},
		)) as ChatMessageHooks;
		const intakeTool = hooks.tool?.[flowdeskChatIntakeToolName];
		assert.ok(intakeTool);
		const plan = JSON.parse(
			toolOutput(
				await intakeTool.execute(
					{
						schema_version: "flowdesk.chat_intake.request.v1",
						request_id: "request-server-durable-plan",
						input_mode: "chat_routed",
						workflow_id: "workflow-server-durable",
						session_ref: "session-server-durable",
						redacted_intake_ref: "intake-server-durable",
						intake_summary: "구현 계획을 세워줘",
						source_surface: "chat.message",
					},
					undefined as never,
				),
			),
		) as NaturalLanguageRoutingTestResult;
		assert.equal(
			plan.routedToolResult?.localState?.durableStateMode,
			"durable_flowdesk_root",
		);
		assert.equal(
			plan.routedToolResult?.localState?.durableStateWriteApplied,
			true,
		);
		assert.equal(
			existsSync(
				join(root, ".flowdesk/workflows/workflow-server-durable/workflow.json"),
			),
			true,
		);
	} finally {
		rmSync(root, { recursive: true, force: true });
	}
});

test("server option wires production enablement evidence into doctor diagnostics", async () => {
	const root = mkdtempSync(
		join(tmpdir(), "flowdesk-server-production-evidence-"),
	);
	const workflowId = "workflow-local";
	try {
		const records = [
			{
				schema_version:
					"flowdesk.managed_dispatch_beta.usage_authority_evidence.v1",
				authority_ref: "usage-authority-server",
			},
			{
				schema_version:
					"flowdesk.managed_dispatch_beta.runtime_echo_evidence.v1",
				workflow_id: workflowId,
				runtime_echo_ref: "runtime-echo-server",
			},
			{
				schema_version:
					"flowdesk.managed_dispatch_beta.telemetry_correlation.v1",
				workflow_id: workflowId,
				telemetry_ref: "telemetry-server",
			},
		];
		const intents = records.map((record, index) => {
			const prepared = prepareFlowDeskSessionEvidenceWriteIntentV1({
				workflowId,
				evidenceId: `evidence-server-${index + 1}`,
				record,
			});
			assert.equal(prepared.ok, true, prepared.errors.join("; "));
			assert.ok(prepared.writeIntent);
			return prepared.writeIntent;
		});
		const applied = applyFlowDeskSessionEvidenceWriteIntentsV1(root, intents);
		assert.equal(applied.ok, true, applied.errors.join("; "));

		const hooks = (await flowdeskOpenCodeServerPlugin.server(
			undefined as never,
			{
				[flowdeskLocalNonDispatchAdapterOption]: true,
				[flowdeskNaturalLanguageRoutingOption]: false,
				[flowdeskDurableStateRootOption]: root,
				[flowdeskProductionEnablementOption]: {
					enabled: true,
					preDispatchAuditRef: "audit-pre-dispatch-server",
					configuredVerificationRef: "configured-verification-server",
					configuredVerificationResult: {
						schema_version: "flowdesk.configured_verification_result.v1",
						verification_ref: "configured-verification-server",
						workflow_id: workflowId,
						result: "passed",
						produced_at: "2026-05-20T00:00:00.000Z",
						source_ref: "configured-verification-source-server",
						check_labels: ["typecheck", "unit-tests"],
						evidence_refs: ["configured-verification-evidence-server"],
						raw_output_redacted: true,
						provider_call_made: false,
						runtime_execution_made: false,
						actual_lane_launch_made: false,
						dispatch_authority_enabled: false,
						safe_next_actions: ["/flowdesk-status"],
					},
					sanitizedAuthCaptureRef: "sanitized-auth-capture-server",
					sanitizedAuthCaptureResult: {
						schema_version: "flowdesk.sanitized_auth_capture_result.v1",
						sanitized_auth_capture_ref: "sanitized-auth-capture-server",
						durable_capture_ref: "durable-auth-capture-server",
						workflow_id: workflowId,
						provider_family: "claude",
						provider_qualified_model_id: "claude/sonnet-4",
						auth_profile_ref: "auth-profile-server",
						auth_evidence_ref: "auth-evidence-server",
						credential_scope_ref: "principal-scope-server",
						account_boundary_ref: "account-boundary-server",
						sanitizer_ref: "sanitizer-server",
						source_ref: "external-auth-source-server",
						result: "passed",
						captured_at: "2026-05-20T00:00:00.000Z",
						metadata_labels: ["raw-plugin-object-redacted", "scope-bound"],
						evidence_refs: ["sanitized-auth-capture-evidence-server"],
						raw_auth_object_persisted: false,
						raw_plugin_object_persisted: false,
						token_material_persisted: false,
						provider_call_made: false,
						runtime_execution_made: false,
						actual_lane_launch_made: false,
						dispatch_authority_enabled: false,
						safe_next_actions: ["/flowdesk-status"],
					},
					externalAuthPolicyRef: "external-auth-policy-server",
					providerPolicyRef: "provider-policy-server",
					externalAuthProviderPolicyResult: {
						schema_version: "flowdesk.external_auth_provider_policy_result.v1",
						external_auth_policy_ref: "external-auth-policy-server",
						provider_policy_ref: "provider-policy-server",
						workflow_id: workflowId,
						provider_family: "claude",
						provider_qualified_model_id: "claude/sonnet-4",
						auth_profile_ref: "auth-profile-server",
						auth_evidence_ref: "auth-evidence-server",
						credential_scope_ref: "principal-scope-server",
						account_boundary_ref: "account-boundary-server",
						sanitizer_ref: "sanitizer-server",
						source_ref: "external-auth-source-server",
						result: "passed",
						sanitized_at: "2026-05-20T00:00:00.000Z",
						metadata_labels: ["account-boundary-bound", "scope-bound"],
						evidence_refs: ["external-auth-policy-evidence-server"],
						raw_auth_object_persisted: false,
						token_material_persisted: false,
						provider_call_made: false,
						runtime_execution_made: false,
						actual_lane_launch_made: false,
						dispatch_authority_enabled: false,
						safe_next_actions: ["/flowdesk-status"],
					},
					approvalDecision: {
						schema_version: "flowdesk.production_approval_decision.v1",
						approval_id: "approval-denied-server",
						workflow_id: workflowId,
						decision: "deny",
						created_at: "2026-05-20T00:00:00.000Z",
						required_evidence_refs: [
							"usage-authority-server",
							"runtime-echo-server",
							"telemetry-server",
							"audit-pre-dispatch-server",
							"configured-verification-server",
							"sanitized-auth-capture-server",
							"external-auth-policy-server",
							"provider-policy-server",
						],
						missing_evidence_labels: [],
						uncertainty_labels: [],
						safe_next_actions: ["/flowdesk-doctor", "/flowdesk-status"],
						dispatch_authority_enabled: false,
					},
					allowIncompleteConformance: true,
				},
			},
		)) as ChatMessageHooks;
		const doctorTool = hooks.tool?.flowdesk_doctor;
		assert.ok(doctorTool);
		const doctorFixture = FLOWDESK_FDS1_FIXTURE_CATALOG.find(
			(entry) =>
				entry.toolName === "flowdesk_doctor" &&
				entry.schemaKind === "tool_request",
		);
		assert.ok(doctorFixture);
		const doctor = JSON.parse(
			toolOutput(
				await doctorTool.execute(
					{
						...doctorFixture.categories["valid.minimal"].sample,
						request_id: "request-production-doctor",
						check_scope: "all",
						profile: "test",
					},
					undefined as never,
				),
			),
		) as LocalAdapterTestResult;
		assert.equal(doctor.handler?.ok, true);
		const compatibility = doctor.handler?.response?.doctor_results?.find(
			(section) => section.section === "opencode_plugin_compatibility",
		);
		assert.ok(compatibility);
		assert.ok(
			compatibility.refs?.includes("production_enablement_state=blocked"),
		);
		assert.ok(
			compatibility.refs?.includes("production_blocker=approval_denied"),
		);
		assert.ok(
			compatibility.refs?.includes(
				"production_sanitized_auth_capture_result=passed",
			),
		);
		assert.ok(
			compatibility.refs?.includes(
				"production_sanitized_auth_capture_ref=sanitized-auth-capture-server",
			),
		);
		assert.ok(
			compatibility.refs?.includes(
				"production_external_auth_provider_policy_result=passed",
			),
		);
		assert.ok(
			compatibility.refs?.includes("production_approval_decision=deny"),
		);
		assert.ok(
			compatibility.refs?.includes(
				"production_approval_ref=approval-denied-server",
			),
		);
		assert.ok(
			compatibility.refs?.includes(
				"production_uncertainty=opencode_subtask_lifecycle_unproven",
			),
		);
		assert.equal(doctor.providerCall, false);
		assert.equal(doctor.runtimeExecution, false);
		assert.equal(doctor.actualLaneLaunch, false);
	} finally {
		rmSync(root, { recursive: true, force: true });
	}
});

test("server option derives reviewer fanout diagnostics from durable cache evidence", async () => {
	const root = mkdtempSync(join(tmpdir(), "flowdesk-server-fanout-evidence-"));
	const workflowId = "workflow-local";
	try {
		writeSessionEvidence(root, workflowId, [
			exactModelAvailabilityCacheRecord(),
			exactModelAvailabilityCacheRefreshPlanRecord(),
		]);
		const hooks = (await flowdeskOpenCodeServerPlugin.server(
			undefined as never,
			{
				[flowdeskLocalNonDispatchAdapterOption]: true,
				[flowdeskNaturalLanguageRoutingOption]: false,
				[flowdeskDurableStateRootOption]: root,
				[flowdeskReviewerFanoutDiagnosticsOption]: {
					enabled: true,
					localDate: "2026-05-19",
					activeProfileRef: "profile-1",
					opencodeVersionRef: "opencode-1.15.6",
					flowdeskPackageVersionRef: "flowdesk-0.1.1",
					registryHash: "hash-registry-1",
					policyPackHash: "hash-policy-1",
					authAccountBoundaryRef: "account-1",
					attemptId: "attempt-1",
					parentSessionRef: "ses-parent-1",
					agentRef: "agent-reviewer",
					requestedAt: "2026-05-19T00:01:00.000Z",
					preLaunchAuditRef: "audit-pre-launch-1",
					laneLaunchApprovalRef: "approval-lane-launch-1",
					persistDerivedFanoutPlanEvidence: true,
					fanoutPlanEvidenceId: "derived-fanout-plan-1",
				},
			},
		)) as ChatMessageHooks;
		const doctorTool = hooks.tool?.flowdesk_doctor;
		const statusTool = hooks.tool?.flowdesk_status;
		assert.ok(doctorTool);
		assert.ok(statusTool);
		const doctorFixture = FLOWDESK_FDS1_FIXTURE_CATALOG.find(
			(entry) =>
				entry.toolName === "flowdesk_doctor" &&
				entry.schemaKind === "tool_request",
		);
		const statusFixture = FLOWDESK_FDS1_FIXTURE_CATALOG.find(
			(entry) =>
				entry.toolName === "flowdesk_status" &&
				entry.schemaKind === "tool_request",
		);
		assert.ok(doctorFixture);
		assert.ok(statusFixture);

		const doctor = JSON.parse(
			toolOutput(
				await doctorTool.execute(
					{
						...doctorFixture.categories["valid.minimal"].sample,
						request_id: "request-fanout-doctor",
						check_scope: "all",
						profile: "test",
					},
					undefined as never,
				),
			),
		) as LocalAdapterTestResult;
		assert.equal(doctor.handler?.ok, true);
		const compatibility = doctor.handler?.response?.doctor_results?.find(
			(section) => section.section === "opencode_plugin_compatibility",
		);
		assert.ok(compatibility);
		assert.ok(
			compatibility.refs?.includes("exact_model_cache_refresh_state=cache_hit"),
		);
		assert.ok(
			compatibility.refs?.includes(
				"exact_model_cache_usable_for_assignment=true",
			),
		);
		assert.ok(
			compatibility.refs?.includes("reviewer_fanout_state=fanout_ready"),
		);
		assert.ok(
			compatibility.refs?.includes("reviewer_fanout_planned_perspectives=3"),
		);
		assert.ok(
			compatibility.refs?.includes("reviewer_fanout_actualLaneLaunch=false"),
		);
		assert.ok(
			compatibility.refs?.includes("reviewer_fanout_providerCall=false"),
		);
		assert.equal(doctor.providerCall, false);
		assert.equal(doctor.runtimeExecution, false);
		assert.equal(doctor.actualLaneLaunch, false);
		const reloaded = reloadFlowDeskSessionEvidenceV1({
			workflowId,
			rootDir: root,
		});
		const fanoutPlans = reloaded.entries.filter(
			(entry) => entry.evidenceClass === "reviewer_fanout_plan",
		);
		assert.equal(fanoutPlans.length, 1);
		assert.equal(fanoutPlans[0].evidenceId, "derived-fanout-plan-1");
		assert.equal(fanoutPlans[0].record.state, "fanout_ready");
		assert.equal(fanoutPlans[0].record.actualLaneLaunch, false);
		assert.equal(fanoutPlans[0].record.providerCall, false);
		assert.equal(fanoutPlans[0].record.runtimeExecution, false);

		const status = JSON.parse(
			toolOutput(
				await statusTool.execute(
					{
						...statusFixture.categories["valid.minimal"].sample,
						request_id: "request-fanout-status",
						workflow_id: workflowId,
						detail_level: "diagnostic",
					},
					undefined as never,
				),
			),
		) as LocalAdapterTestResult;
		assert.equal(status.handler?.ok, true, status.handler?.errors?.join("; "));
		assert.equal(status.handler?.response?.workflow_id, workflowId);
		assert.equal(status.handler?.response?.blocker, undefined);
		assert.equal(status.providerCall, false);
		assert.equal(status.runtimeExecution, false);
		assert.equal(status.actualLaneLaunch, false);
	} finally {
		rmSync(root, { recursive: true, force: true });
	}
});

test("server option surfaces blocked reviewer fanout diagnostics from drifted cache evidence", async () => {
	const root = mkdtempSync(join(tmpdir(), "flowdesk-server-fanout-blocked-"));
	const workflowId = "workflow-local";
	try {
		writeSessionEvidence(root, workflowId, [
			exactModelAvailabilityCacheRecord(),
			exactModelAvailabilityCacheRefreshPlanRecord({
				expected_policy_pack_hash: "hash-policy-other",
			}),
		]);
		const hooks = (await flowdeskOpenCodeServerPlugin.server(
			undefined as never,
			{
				[flowdeskLocalNonDispatchAdapterOption]: true,
				[flowdeskNaturalLanguageRoutingOption]: false,
				[flowdeskDurableStateRootOption]: root,
				[flowdeskReviewerFanoutDiagnosticsOption]: {
					enabled: true,
					localDate: "2026-05-19",
					activeProfileRef: "profile-1",
					opencodeVersionRef: "opencode-1.15.6",
					flowdeskPackageVersionRef: "flowdesk-0.1.1",
					registryHash: "hash-registry-1",
					policyPackHash: "hash-policy-1",
					authAccountBoundaryRef: "account-1",
					attemptId: "attempt-1",
					parentSessionRef: "ses-parent-1",
					agentRef: "agent-reviewer",
					requestedAt: "2026-05-19T00:01:00.000Z",
					persistDerivedFanoutPlanEvidence: true,
					fanoutPlanEvidenceId: "blocked-fanout-plan-1",
				},
			},
		)) as ChatMessageHooks;
		const statusTool = hooks.tool?.flowdesk_status;
		assert.ok(statusTool);
		const statusFixture = FLOWDESK_FDS1_FIXTURE_CATALOG.find(
			(entry) =>
				entry.toolName === "flowdesk_status" &&
				entry.schemaKind === "tool_request",
		);
		assert.ok(statusFixture);

		const status = JSON.parse(
			toolOutput(
				await statusTool.execute(
					{
						...statusFixture.categories["valid.minimal"].sample,
						request_id: "request-fanout-blocked-status",
						workflow_id: workflowId,
						detail_level: "diagnostic",
					},
					undefined as never,
				),
			),
		) as LocalAdapterTestResult;
		assert.equal(status.handler?.ok, true, status.handler?.errors?.join("; "));
		assert.ok(status.handler?.response?.blocker);
		assert.ok(
			status.handler?.response?.blocker?.refs?.includes(
				"reviewer_fanout_state=blocked",
			),
		);
		assert.ok(
			status.handler?.response?.blocker?.refs?.includes(
				"reviewer_fanout_blocker=assignment_revalidation_blocked",
			),
		);
		assert.ok(
			status.handler?.response?.blocker?.refs?.includes(
				"reviewer_fanout_blocker=cache_refresh_pair_missing",
			),
		);
		assert.ok(
			status.handler?.response?.blocker?.refs?.includes(
				"reviewer_fanout_actualLaneLaunch=false",
			),
		);
		assert.ok(
			status.handler?.response?.blocker?.refs?.includes(
				"reviewer_fanout_providerCall=false",
			),
		);
		assert.equal(status.providerCall, false);
		assert.equal(status.runtimeExecution, false);
		assert.equal(status.actualLaneLaunch, false);
		const reloaded = reloadFlowDeskSessionEvidenceV1({
			workflowId,
			rootDir: root,
		});
		assert.equal(
			reloaded.entries.some(
				(entry) => entry.evidenceClass === "reviewer_fanout_plan",
			),
			false,
		);
	} finally {
		rmSync(root, { recursive: true, force: true });
	}
});

test("server option fails closed for invalid configured verification result diagnostics", async () => {
	const root = mkdtempSync(
		join(tmpdir(), "flowdesk-server-invalid-verification-"),
	);
	try {
		const hooks = (await flowdeskOpenCodeServerPlugin.server(
			undefined as never,
			{
				[flowdeskLocalNonDispatchAdapterOption]: true,
				[flowdeskNaturalLanguageRoutingOption]: false,
				[flowdeskDurableStateRootOption]: root,
				[flowdeskProductionEnablementOption]: {
					enabled: true,
					preDispatchAuditRef: "audit-pre-dispatch-server",
					configuredVerificationRef: "configured-verification-server",
					configuredVerificationResult: {
						schema_version: "flowdesk.configured_verification_result.v1",
						verification_ref: "configured-verification-other",
						workflow_id: "workflow-local",
						result: "passed",
						produced_at: "2026-05-20T00:00:00.000Z",
						source_ref: "configured-verification-source-server",
						check_labels: ["typecheck"],
						evidence_refs: "leaky-evidence-ref",
						raw_output_redacted: true,
						provider_call_made: true,
						runtime_execution_made: true,
						actual_lane_launch_made: true,
						dispatch_authority_enabled: true,
						safe_next_actions: ["/flowdesk-status"],
					},
					sanitizedAuthCaptureRef: "sanitized-auth-capture-server",
					sanitizedAuthCaptureResult: {
						schema_version: "flowdesk.sanitized_auth_capture_result.v1",
						sanitized_auth_capture_ref: "sanitized-auth-capture-server",
						durable_capture_ref: "durable-auth-capture-server",
						workflow_id: "workflow-local",
						provider_family: "claude",
						provider_qualified_model_id: "claude/sonnet-4",
						auth_profile_ref: "auth-profile-server",
						auth_evidence_ref: "auth-evidence-server",
						credential_scope_ref: "principal-scope-server",
						account_boundary_ref: "account-boundary-server",
						sanitizer_ref: "sanitizer-server",
						source_ref: "external-auth-source-server",
						result: "passed",
						captured_at: "2026-05-20T00:00:00.000Z",
						metadata_labels: ["raw-plugin-object-redacted"],
						evidence_refs: "leaky-sanitized-auth-ref",
						raw_auth_object_persisted: false,
						raw_plugin_object_persisted: true,
						token_material_persisted: true,
						provider_call_made: false,
						runtime_execution_made: false,
						actual_lane_launch_made: false,
						dispatch_authority_enabled: true,
						safe_next_actions: ["/flowdesk-status"],
					},
					externalAuthPolicyRef: "external-auth-policy-server",
					providerPolicyRef: "provider-policy-server",
					approvalDecision: {
						schema_version: "flowdesk.production_approval_decision.v1",
						approval_id: "approval-forged-server",
						workflow_id: "workflow-other",
						decision: "approve",
						created_at: "2026-05-20T00:00:00.000Z",
						required_evidence_refs: "leaky-approval-ref",
						missing_evidence_labels: [],
						uncertainty_labels: [],
						safe_next_actions: ["/flowdesk-status"],
						dispatch_authority_enabled: true,
					},
					allowIncompleteConformance: true,
				},
			},
		)) as ChatMessageHooks;
		const doctorTool = hooks.tool?.flowdesk_doctor;
		assert.ok(doctorTool);
		const doctorFixture = FLOWDESK_FDS1_FIXTURE_CATALOG.find(
			(entry) =>
				entry.toolName === "flowdesk_doctor" &&
				entry.schemaKind === "tool_request",
		);
		assert.ok(doctorFixture);
		const doctor = JSON.parse(
			toolOutput(
				await doctorTool.execute(
					{
						...doctorFixture.categories["valid.minimal"].sample,
						request_id: "request-invalid-verification-doctor",
						check_scope: "all",
						profile: "test",
					},
					undefined as never,
				),
			),
		) as LocalAdapterTestResult;
		assert.equal(doctor.handler?.ok, true);
		const compatibility = doctor.handler?.response?.doctor_results?.find(
			(section) => section.section === "opencode_plugin_compatibility",
		);
		assert.ok(compatibility);
		assert.ok(
			compatibility.refs?.includes("production_enablement_state=blocked"),
		);
		assert.ok(
			compatibility.refs?.includes(
				"production_blocker=configured_verification_invalid",
			),
		);
		assert.ok(
			compatibility.refs?.includes(
				"production_blocker=configured_verification_result_missing",
			),
		);
		assert.ok(
			compatibility.refs?.includes(
				"production_blocker=sanitized_auth_capture_invalid",
			),
		);
		assert.ok(
			compatibility.refs?.includes(
				"production_blocker=sanitized_auth_capture_result_missing",
			),
		);
		assert.ok(
			compatibility.refs?.includes("production_blocker=approval_mismatched"),
		);
		assert.ok(
			!compatibility.refs?.some((ref) =>
				ref.startsWith("production_configured_verification_ref="),
			),
		);
		assert.ok(
			!compatibility.refs?.some((ref) =>
				ref.startsWith("production_sanitized_auth_capture_ref="),
			),
		);
		assert.ok(
			!compatibility.refs?.some((ref) =>
				ref.startsWith("production_approval_ref="),
			),
		);
		assert.ok(
			!compatibility.refs?.some((ref) => ref.includes("leaky-evidence-ref")),
		);
		assert.ok(
			!compatibility.refs?.some((ref) =>
				ref.includes("leaky-sanitized-auth-ref"),
			),
		);
		assert.ok(
			!compatibility.refs?.some((ref) => ref.includes("leaky-approval-ref")),
		);
		assert.equal(doctor.providerCall, false);
		assert.equal(doctor.runtimeExecution, false);
		assert.equal(doctor.actualLaneLaunch, false);
	} finally {
		rmSync(root, { recursive: true, force: true });
	}
});

test("natural-language routing reuses local adapter session with adapter tools", async () => {
	const hooks = (await flowdeskOpenCodeServerPlugin.server(undefined as never, {
		[flowdeskNaturalLanguageRoutingOption]: true,
		[flowdeskLocalNonDispatchAdapterOption]: true,
	})) as ChatMessageHooks;
	const intakeTool = hooks.tool?.[flowdeskChatIntakeToolName];
	const statusTool = hooks.tool?.flowdesk_status;
	assert.ok(intakeTool);
	assert.ok(statusTool);

	const planResult = JSON.parse(
		toolOutput(
			await intakeTool.execute(
				{
					schema_version: "flowdesk.chat_intake.request.v1",
					request_id: "request-nl-plan",
					input_mode: "chat_routed",
					workflow_id: "workflow-nl-shared",
					session_ref: "session-nl",
					redacted_intake_ref: "intake-nl-plan",
					intake_summary: "구현 계획을 세워줘",
					source_surface: "chat.message",
				},
				undefined as never,
			),
		),
	) as NaturalLanguageRoutingTestResult;
	assert.equal(planResult.routedToolName, "flowdesk_plan");
	assert.equal(
		planResult.routedToolResult?.localState?.workflowId,
		"workflow-nl-shared",
	);

	const statusResult = JSON.parse(
		toolOutput(
			await statusTool.execute(
				{
					schema_version: "flowdesk.status.request.v1",
					request_id: "request-nl-shared-status",
					input_mode: "chat_routed",
					workflow_id: "workflow-nl-shared",
					detail_level: "summary",
				},
				undefined as never,
			),
		),
	) as LocalAdapterTestResult;
	assert.equal(statusResult.handler?.ok, true);
	assert.equal(
		statusResult.handler?.response?.workflow_id,
		"workflow-nl-shared",
	);
	assert.equal(statusResult.localState?.workflowState, "ready_to_run");
});

test("chat.message steering mutates message parts without hard interception fields", async () => {
	const hooks = (await flowdeskOpenCodeServerPlugin.server(undefined as never, {
		[flowdeskNaturalLanguageRoutingOption]: true,
	})) as ChatMessageHooks;
	assert.ok(hooks["chat.message"]);
	const output = {
		parts: [{ type: "text", text: "구현 계획을 세워줘" }] as unknown[],
	};
	await hooks["chat.message"](
		{
			messageID: "message-korean-plan",
			sessionID: "session-hook",
		},
		output,
	);

	assert.equal(output.parts.length, 2);
	const serialized = JSON.stringify(output);
	assert.match(serialized, /FlowDesk/);
	assert.match(serialized, /Suggested next step: \/flowdesk-plan/);
	assert.match(serialized, /Why:/);
	assert.match(serialized, /Actions:/);
	assert.match(serialized, /- \/flowdesk-plan/);
	assert.match(serialized, /- \/flowdesk-status/);
	assert.equal(/noReply|cancel|stop/.test(serialized), false);

	const largeTaskOutput = {
		parts: [{ type: "text", text: "대규모 리팩토링 계획 세워줘" }] as unknown[],
	};
	await hooks["chat.message"](
		{
			messageID: "message-large-usage-preflight",
			sessionID: "session-hook-large",
		},
		largeTaskOutput,
	);
	const largeTaskSerialized = JSON.stringify(largeTaskOutput);
	assert.match(largeTaskSerialized, /Suggested next step: \/flowdesk-usage/);
	assert.match(largeTaskSerialized, /usage should be checked before planning/);
	assert.match(largeTaskSerialized, /- \/flowdesk-usage/);
	assert.match(largeTaskSerialized, /- \/flowdesk-plan/);
	assert.match(largeTaskSerialized, /- \/flowdesk-status/);
	assert.equal(/noReply|cancel|stop/.test(largeTaskSerialized), false);

	const executionOutput = {
		parts: [
			{ type: "text", text: "approved plan을 fake-runtime으로 실행 진행해" },
		] as unknown[],
	};
	await hooks["chat.message"](
		{
			messageID: "message-execution-confirmation",
			sessionID: "session-hook-confirm",
		},
		executionOutput,
	);
	const executionSerialized = JSON.stringify(executionOutput);
	assert.match(
		executionSerialized,
		/Confirmation code: approval-plan-chat-message-execution-confirmation/,
	);
	assert.match(executionSerialized, /explicit approval/);
	assert.equal(/noReply|cancel|stop/.test(executionSerialized), false);

	const generalChatOutput = {
		parts: [{ type: "text", text: "오늘 날씨 이야기하자" }] as unknown[],
	};
	await hooks["chat.message"](
		{
			messageID: "message-general-chat",
			sessionID: "session-hook",
		},
		generalChatOutput,
	);
	assert.equal(generalChatOutput.parts.length, 1);
});

test("chat.message authority probe records local hook observation as blocked hard-control evidence", async () => {
	const hooks = (await flowdeskOpenCodeServerPlugin.server(undefined as never, {
		[flowdeskNaturalLanguageRoutingOption]: true,
	})) as ChatMessageHooks;
	assert.ok(hooks["chat.message"]);
	const output = {
		parts: [{ type: "text", text: "구현 계획을 세워줘" }] as unknown[],
	};
	const beforePartsCount = output.parts.length;
	const returnValue = await hooks["chat.message"](
		{
			messageID: "message-chat-probe",
			sessionID: "session-chat-probe",
		},
		output,
	);
	const probe = createFlowDeskChatHookAuthorityProbeFromObservationV1({
		probeId: "chat-probe-plugin-observation",
		chatHookRef: "chat-message-hook-plugin",
		observedAt: now,
		beforePartsCount,
		afterPartsCount: output.parts.length,
		returnValue,
		timeoutOrNullFailClosed: false,
		malformedReturnFailClosed: false,
		evidenceRefs: ["chat-message-observation-1"],
	});

	assert.equal(probe.outcome, "blocked");
	assert.equal(probe.mutation_observed, true);
	assert.equal(probe.no_reply_supported, false);
	assert.equal(probe.cancel_or_stop_supported, false);
	assert.equal(probe.hardCancelOrNoReplyAuthority, false);
	assert.equal(probe.providerCall, false);
	assert.equal(probe.runtimeExecution, false);
	assert.equal(probe.actualLaneLaunch, false);
	assert.ok(probe.failure_labels.includes("no_reply_unproven"));
	assert.ok(probe.failure_labels.includes("cancel_or_stop_unproven"));
	assert.ok(probe.failure_labels.includes("timeout_or_null_not_fail_closed"));
	assert.ok(probe.failure_labels.includes("malformed_return_not_fail_closed"));
	assert.equal(/noReply|cancel|stop/.test(JSON.stringify(output)), false);
});

test("chat hook authority probe treats unsupported hard-control return fields as blocked", () => {
	const probe = createFlowDeskChatHookAuthorityProbeFromObservationV1({
		probeId: "chat-probe-unsupported-return",
		chatHookRef: "chat-message-hook-unsupported-return",
		observedAt: now,
		beforePartsCount: 1,
		afterPartsCount: 2,
		returnValue: { noReply: true, cancel: true, stop: true },
		timeoutOrNullFailClosed: true,
		malformedReturnFailClosed: true,
		evidenceRefs: ["chat-message-observation-unsupported"],
	});

	assert.equal(probe.outcome, "blocked");
	assert.equal(probe.no_reply_supported, false);
	assert.equal(probe.cancel_or_stop_supported, false);
	assert.equal(probe.malformed_return_fail_closed, false);
	assert.equal(probe.hardCancelOrNoReplyAuthority, false);
	assert.ok(probe.failure_labels.includes("malformed_return_not_fail_closed"));
});

test("chat.message steering suppresses repeated non-confirmation cards for the same session and suggestion", async () => {
	const root = mkdtempSync(join(tmpdir(), "flowdesk-chat-duplicate-"));
	try {
		const hooks = (await flowdeskOpenCodeServerPlugin.server(
			undefined as never,
			{
				[flowdeskNaturalLanguageRoutingOption]: true,
				[flowdeskDurableStateRootOption]: root,
			},
		)) as ChatMessageHooks;
		assert.ok(hooks["chat.message"]);

		const firstPlanOutput = {
			parts: [{ type: "text", text: "구현 계획을 세워줘" }] as unknown[],
		};
		await hooks["chat.message"](
			{
				messageID: "message-duplicate-plan-first",
				sessionID: "session-duplicate-plan",
			},
			firstPlanOutput,
		);
		assert.equal(firstPlanOutput.parts.length, 2);
		assert.match(
			JSON.stringify(firstPlanOutput),
			/Suggested next step: \/flowdesk-plan/,
		);
		const workflowPath = join(
			root,
			".flowdesk/workflows/workflow-local/workflow.json",
		);
		const workflowAfterFirst = readFileSync(workflowPath, "utf8");

		const repeatedPlanOutput = {
			parts: [{ type: "text", text: "구현 계획을 다시 세워줘" }] as unknown[],
		};
		await hooks["chat.message"](
			{
				messageID: "message-duplicate-plan-second",
				sessionID: "session-duplicate-plan",
			},
			repeatedPlanOutput,
		);
		assert.equal(repeatedPlanOutput.parts.length, 1);
		assert.equal(readFileSync(workflowPath, "utf8"), workflowAfterFirst);
		assert.equal(
			/noReply|cancel|stop/.test(JSON.stringify(repeatedPlanOutput)),
			false,
		);

		const restartedHooks = (await flowdeskOpenCodeServerPlugin.server(
			undefined as never,
			{
				[flowdeskNaturalLanguageRoutingOption]: true,
				[flowdeskDurableStateRootOption]: root,
			},
		)) as ChatMessageHooks;
		assert.ok(restartedHooks["chat.message"]);
		const durableRepeatedPlanOutput = {
			parts: [{ type: "text", text: "구현 계획을 다시 세워줘" }] as unknown[],
		};
		await restartedHooks["chat.message"](
			{
				messageID: "message-duplicate-plan-after-restart",
				sessionID: "session-duplicate-plan",
			},
			durableRepeatedPlanOutput,
		);
		assert.equal(durableRepeatedPlanOutput.parts.length, 1);

		const otherSessionOutput = {
			parts: [{ type: "text", text: "구현 계획을 세워줘" }] as unknown[],
		};
		await hooks["chat.message"](
			{
				messageID: "message-duplicate-plan-other-session",
				sessionID: "session-duplicate-plan-other",
			},
			otherSessionOutput,
		);
		assert.equal(otherSessionOutput.parts.length, 2);

		const differentSuggestionOutput = {
			parts: [
				{ type: "text", text: "현재 상태와 진행상황 알려줘" },
			] as unknown[],
		};
		await hooks["chat.message"](
			{
				messageID: "message-duplicate-status",
				sessionID: "session-duplicate-plan",
			},
			differentSuggestionOutput,
		);
		assert.equal(differentSuggestionOutput.parts.length, 2);
		assert.match(
			JSON.stringify(differentSuggestionOutput),
			/Suggested next step: \/flowdesk-status/,
		);
	} finally {
		rmSync(root, { recursive: true, force: true });
	}
});

test("chat.message steering preserves repeated pending confirmation cards", async () => {
	const hooks = (await flowdeskOpenCodeServerPlugin.server(undefined as never, {
		[flowdeskNaturalLanguageRoutingOption]: true,
	})) as ChatMessageHooks;
	assert.ok(hooks["chat.message"]);

	const firstConfirmationOutput = {
		parts: [
			{ type: "text", text: "approved plan을 fake-runtime으로 실행 진행해" },
		] as unknown[],
	};
	await hooks["chat.message"](
		{
			messageID: "message-confirmation-card-first",
			sessionID: "session-confirmation-card",
		},
		firstConfirmationOutput,
	);
	assert.equal(firstConfirmationOutput.parts.length, 2);
	assert.match(
		JSON.stringify(firstConfirmationOutput),
		/Confirmation code: approval-plan-chat-message-confirmation-card-first/,
	);

	const repeatedConfirmationOutput = {
		parts: [
			{ type: "text", text: "approved plan을 fake-runtime으로 실행 진행해" },
		] as unknown[],
	};
	await hooks["chat.message"](
		{
			messageID: "message-confirmation-card-second",
			sessionID: "session-confirmation-card",
		},
		repeatedConfirmationOutput,
	);
	const repeatedSerialized = JSON.stringify(repeatedConfirmationOutput);
	assert.equal(repeatedConfirmationOutput.parts.length, 2);
	assert.match(
		repeatedSerialized,
		/Confirmation code: approval-plan-chat-message-confirmation-card-second/,
	);
	assert.match(repeatedSerialized, /explicit approval/);
	assert.equal(/noReply|cancel|stop/.test(repeatedSerialized), false);
});

test("server plugin can expose sandbox-only FDS-1 production-shape probe tools", async () => {
	const probeTools = createFlowDeskFds1SchemaConversionProbeTools();
	assert.deepEqual(
		Object.keys(probeTools),
		FLOWDESK_RELEASE_1_COMMAND_MANIFEST.map((entry) => entry.toolName),
	);

	const hooks = await flowdeskOpenCodeServerPlugin.server(undefined as never, {
		[flowdeskFds1SchemaConversionProbeOption]: true,
	});
	assert.deepEqual(Object.keys(hooks.tool ?? {}), [
		flowdeskPreSpikeDoctorToolName,
		...Object.keys(probeTools),
	]);
	assert.equal(hasProductionOpenCodeRegistration(), true);
	assert.equal(hasPassingFds1SchemaConversionSpike(), true);
	assert.equal(getFlowDeskPreSpikeProductionToolRegistry().length, 0);

	for (const manifestEntry of FLOWDESK_RELEASE_1_COMMAND_MANIFEST) {
		const registeredTool = hooks.tool?.[manifestEntry.toolName];
		assert.ok(registeredTool, manifestEntry.toolName);
		assert.match(registeredTool.description, /schema conversion probe/);
		assert.ok("schema_version" in registeredTool.args, manifestEntry.toolName);

		const requestFixture = FLOWDESK_FDS1_FIXTURE_CATALOG.find(
			(entry) =>
				entry.toolName === manifestEntry.toolName &&
				entry.schemaKind === "tool_request",
		);
		assert.ok(requestFixture, manifestEntry.toolName);
		const result = JSON.parse(
			toolOutput(
				await registeredTool.execute(
					requestFixture.categories["valid.minimal"].sample,
					undefined as never,
				),
			),
		) as Record<string, unknown>;
		assert.equal(result.toolName, manifestEntry.toolName);
		assert.equal(result.accepted, false);
		assert.equal(result.requestSchemaValid, true);
		assert.equal(result.responseSchemaValid, true);
		assert.equal(
			result.blockedReason,
			"production_opencode_registration_disabled",
		);
		assert.equal(result.registrationProfile, "sandbox_conformance_probe_only");
		assert.equal(
			result.productionPromotionGate,
			"blocked_production_opencode_registration_disabled",
		);
		assert.equal(result.productionRegistrationEligible, false);
		assert.equal(result.dispatchApprovalEligible, false);
		assert.equal(result.providerCall, false);
		assert.equal(result.runtimeExecution, false);
		const invalidResult = JSON.parse(
			toolOutput(
				await registeredTool.execute(
					requestFixture.categories["invalid.unknown-property"].sample,
					undefined as never,
				),
			),
		) as Record<string, unknown>;
		assert.equal(invalidResult.toolName, manifestEntry.toolName);
		assert.equal(invalidResult.accepted, false);
		assert.equal(invalidResult.requestSchemaValid, false);
		assert.equal(invalidResult.blockedReason, "request_schema_invalid");
		assert.equal(invalidResult.providerCall, false);
		assert.equal(invalidResult.runtimeExecution, false);
	}
});

test("FDS-1 probe records OpenCode provider-facing closed-schema caveat", () => {
	const probeTools = createFlowDeskFds1SchemaConversionProbeTools();
	const conversionSummaries = Object.entries(probeTools).map(
		([toolName, registeredTool]) => {
			const converted = tool.schema.toJSONSchema(
				tool.schema.object(registeredTool.args),
				{ io: "input" },
			) as Record<string, unknown>;
			const properties = converted.properties as
				| Record<string, unknown>
				| undefined;
			return {
				toolName,
				propertyCount: Object.keys(properties ?? {}).length,
				additionalProperties: converted.additionalProperties,
			};
		},
	);

	assert.equal(conversionSummaries.length, 9);
	for (const summary of conversionSummaries) {
		assert.ok(summary.propertyCount > 0, summary.toolName);
		assert.equal(
			summary.additionalProperties ?? null,
			null,
			`${summary.toolName} unexpectedly converted as a closed provider-facing schema`,
		);
	}
	assert.equal(hasPassingFds1SchemaConversionSpike(), true);
});

test("provider usage live tool is absent by default and registers only with explicit opt-in", async () => {
	const defaultHooks = await flowdeskOpenCodeServerPlugin.server(
		undefined as never,
		{
			localNonDispatchAdapter: false,
			naturalLanguageRouting: false,
		},
	);
	assert.equal(
		defaultHooks.tool?.[flowdeskProviderUsageLiveToolName],
		undefined,
	);

	const enabledHooks = await flowdeskOpenCodeServerPlugin.server(
		undefined as never,
		{
			[flowdeskProviderUsageLiveOption]: {
				enabled: true,
				providers: ["claude", "openai", "gemini"],
				homeDir: "/home/test",
				geminiOAuthClientId: "client-id-test",
				geminiOAuthClientSecret: "client-secret-test",
			},
			localNonDispatchAdapter: false,
			naturalLanguageRouting: false,
		},
	);
	const usageTool = enabledHooks.tool?.[flowdeskProviderUsageLiveToolName];
	assert.ok(
		usageTool,
		"provider usage live tool should be registered when enabled",
	);
	const description = String(usageTool.description ?? "");
	assert.match(description, /WHEN TO USE/);
	assert.match(description, /WHEN NOT TO USE/);
	assert.match(description, /사용량/);
	assert.match(description, /잔량/);
	assert.match(description, /리셋/);
	assert.match(description, /얼마 남았어/);
	assert.match(description, /claude-5h/);
	assert.match(description, /claude-weekly/);
	assert.match(description, /openai-gpt-5h/);
	assert.match(description, /gemini-pro-5h/);
	assert.match(description, /gemini-pro-weekly/);
	assert.match(description, /gemini-flash-daily/);
	assert.doesNotMatch(description, /paid provider/);
});

test("provider usage live tool blocks when no provider family is enabled in configuration", async () => {
	const hooks = await flowdeskOpenCodeServerPlugin.server(undefined as never, {
		[flowdeskProviderUsageLiveOption]: { enabled: true, providers: [] },
		localNonDispatchAdapter: false,
		naturalLanguageRouting: false,
	});
	const usageTool = hooks.tool?.[flowdeskProviderUsageLiveToolName];
	assert.ok(usageTool);
	const result = JSON.parse(
		toolOutput(
			await usageTool.execute({ providerFamily: "gemini" }, undefined as never),
		),
	) as Record<string, unknown>;
	assert.equal(result.status, "blocked_before_provider_usage_live");
	const authority = result.authority as Record<string, unknown>;
	assert.equal(authority.providerCall, false);
	assert.equal(authority.runtimeExecution, false);
	assert.equal(authority.actualLaneLaunch, false);
	assert.equal(authority.realOpenCodeDispatch, false);
	assert.equal(authority.providerUsageAcquired, false);
});

test("provider usage live tool blocks when requested family is not configured", async () => {
	const hooks = await flowdeskOpenCodeServerPlugin.server(undefined as never, {
		[flowdeskProviderUsageLiveOption]: { enabled: true, providers: ["claude"] },
		localNonDispatchAdapter: false,
		naturalLanguageRouting: false,
	});
	const usageTool = hooks.tool?.[flowdeskProviderUsageLiveToolName];
	assert.ok(usageTool);
	const result = JSON.parse(
		toolOutput(
			await usageTool.execute({ providerFamily: "openai" }, undefined as never),
		),
	) as Record<string, unknown>;
	assert.equal(result.status, "blocked_before_provider_usage_live");
	assert.match(
		String(result.redactedBlockReason),
		/openai is not enabled in providerUsageLive configuration/,
	);
});

test("status live tool is absent by default and registers only with explicit opt-in plus a durable state root", async () => {
	const defaultHooks = await flowdeskOpenCodeServerPlugin.server(
		undefined as never,
		{
			localNonDispatchAdapter: false,
			naturalLanguageRouting: false,
		},
	);
	assert.equal(defaultHooks.tool?.[flowdeskStatusLiveToolName], undefined);

	const enabledWithoutRoot = await flowdeskOpenCodeServerPlugin.server(
		undefined as never,
		{
			[flowdeskStatusLiveOption]: { enabled: true },
			localNonDispatchAdapter: false,
			naturalLanguageRouting: false,
		},
	);
	assert.equal(
		enabledWithoutRoot.tool?.[flowdeskStatusLiveToolName],
		undefined,
	);

	const root = mkdtempSync(join(tmpdir(), "flowdesk-status-live-register-"));
	try {
		const enabledHooks = await flowdeskOpenCodeServerPlugin.server(
			undefined as never,
			{
				[flowdeskStatusLiveOption]: { enabled: true },
				[flowdeskDurableStateRootOption]: root,
				localNonDispatchAdapter: false,
				naturalLanguageRouting: false,
			},
		);
		const statusTool = enabledHooks.tool?.[flowdeskStatusLiveToolName];
		assert.ok(statusTool);
		const description = String(statusTool.description ?? "");
		assert.match(description, /WHEN TO USE/);
		assert.match(description, /WHEN NOT TO USE/);
		assert.match(description, /어디까지/);
		assert.match(description, /진행 상황/);
		assert.match(description, /오늘 작업/);
		assert.match(description, /최근 리뷰/);
		assert.match(description, /reviewer verdict/);
		assert.match(description, /lane lifecycle/);
		assert.doesNotMatch(description, /paid provider/);
	} finally {
		rmSync(root, { recursive: true, force: true });
	}
});

test("status live tool blocks before reload when durable session root has no workflows", async () => {
	const root = mkdtempSync(join(tmpdir(), "flowdesk-status-live-empty-"));
	try {
		const hooks = await flowdeskOpenCodeServerPlugin.server(
			undefined as never,
			{
				[flowdeskStatusLiveOption]: { enabled: true },
				[flowdeskDurableStateRootOption]: root,
				localNonDispatchAdapter: false,
				naturalLanguageRouting: false,
			},
		);
		const statusTool = hooks.tool?.[flowdeskStatusLiveToolName];
		assert.ok(statusTool);
		const result = JSON.parse(
			toolOutput(await statusTool.execute({}, undefined as never)),
		) as Record<string, unknown>;
		assert.equal(result.status, "blocked_before_status_live");
		assert.match(
			String(result.redactedBlockReason),
			/no durable session workflows found/,
		);
		const authority = result.authority as Record<string, unknown>;
		assert.equal(authority.providerCall, false);
		assert.equal(authority.runtimeExecution, false);
		assert.equal(authority.actualLaneLaunch, false);
		assert.equal(authority.realOpenCodeDispatch, false);
		assert.equal(authority.statusEvidenceObserved, false);
	} finally {
		rmSync(root, { recursive: true, force: true });
	}
});

test("status live tool surfaces durable evidence counts for the requested workflow", async () => {
	const root = mkdtempSync(join(tmpdir(), "flowdesk-status-live-summary-"));
	try {
		const workflowId = "workflow-status-live-1";
		const reviewerVerdict = {
			...reviewerVerdictRecord("architecture"),
			workflow_id: workflowId,
		};
		const fallbackPlan = {
			schema_version: "flowdesk.fallback_regate_plan.v1",
			ok: true,
			errors: [],
			workflow_id: workflowId,
			parent_attempt_id: "attempt-status-live-parent",
			new_attempt_id: "attempt-status-live-child",
			state: "full_regate_required",
			required_fresh_evidence_refs: ["fresh-1", "fresh-2", "fresh-3"],
			safe_next_actions: ["/flowdesk-status", "/flowdesk-run"],
			automatic_fallback_authorized: false,
			provider_switch_attempted: false,
			dispatch_authority_enabled: false,
			realOpenCodeDispatch: false,
			providerCall: false,
			actualLaneLaunch: false,
			runtimeExecution: false,
		};
		const verdictWriteIntent = prepareFlowDeskSessionEvidenceWriteIntentV1({
			workflowId,
			evidenceId: "reviewer-verdict-architecture-status-live",
			record: reviewerVerdict,
		});
		assert.equal(
			verdictWriteIntent.ok,
			true,
			verdictWriteIntent.errors.join("; "),
		);
		const regateWriteIntent = prepareFlowDeskSessionEvidenceWriteIntentV1({
			workflowId,
			evidenceId: "fallback-regate-plan-status-live",
			record: fallbackPlan,
		});
		assert.equal(
			regateWriteIntent.ok,
			true,
			regateWriteIntent.errors.join("; "),
		);
		const applied = applyFlowDeskSessionEvidenceWriteIntentsV1(root, [
			verdictWriteIntent.writeIntent as never,
			regateWriteIntent.writeIntent as never,
		]);
		assert.equal(applied.ok, true, applied.errors.join("; "));
		const hooks = await flowdeskOpenCodeServerPlugin.server(
			undefined as never,
			{
				[flowdeskStatusLiveOption]: { enabled: true },
				[flowdeskDurableStateRootOption]: root,
				localNonDispatchAdapter: false,
				naturalLanguageRouting: false,
			},
		);
		const statusTool = hooks.tool?.[flowdeskStatusLiveToolName];
		assert.ok(statusTool);
		const result = JSON.parse(
			toolOutput(await statusTool.execute({ workflowId }, undefined as never)),
		) as Record<string, unknown>;
		assert.equal(result.status, "status_live_collected");
		assert.deepEqual(result.resolvedWorkflowIds, [workflowId]);
		const workflows = result.workflows as Array<Record<string, unknown>>;
		assert.equal(workflows.length, 1);
		const workflow = workflows[0];
		assert.equal(workflow.workflowId, workflowId);
		assert.equal(workflow.reloadOk, true);
		const counts = workflow.evidenceCounts as Record<string, number>;
		assert.equal(counts.reviewer_verdict, 1);
		assert.equal(counts.fallback_regate_plan, 1);
		const verdictLabels = workflow.latestReviewerVerdictLabels as string[];
		assert.deepEqual(verdictLabels, ["pass"]);
		assert.equal(workflow.latestRegatePlanState, "full_regate_required");
		const authority = result.authority as Record<string, unknown>;
		assert.equal(authority.statusEvidenceObserved, true);
		assert.equal(authority.providerCall, false);
		assert.equal(authority.realOpenCodeDispatch, false);
	} finally {
		rmSync(root, { recursive: true, force: true });
	}
});

test("status live tool exposes a lane heartbeat stall projection for the requested workflow", async () => {
	const root = mkdtempSync(join(tmpdir(), "flowdesk-status-live-stall-"));
	try {
		const workflowId = "workflow-status-live-stall";
		const observedAtMs = Date.now();
		const freshLane = {
			schema_version: "flowdesk.lane_lifecycle_record.v1",
			lane_id: "lane-stall-fresh",
			workflow_id: workflowId,
			attempt_id: "attempt-stall-fresh",
			parent_session_ref: "ses-stall-fresh-parent",
			agent_ref: "agent-reviewer-stall-fresh",
			provider_qualified_model_id: "openai/gpt-5.4-mini-fast",
			state: "running" as const,
			timeout_ms: 60_000,
			orphan_max_age_ms: 600_000,
			retry_count: 0,
			created_at: new Date(observedAtMs - 30_000).toISOString(),
			updated_at: new Date(observedAtMs - 30_000).toISOString(),
			dispatch_authority_enabled: false as const,
			providerCall: false as const,
			actualLaneLaunch: false as const,
			runtimeExecution: false as const,
		};
		const stalledLane = {
			...freshLane,
			lane_id: "lane-stall-stalled",
			attempt_id: "attempt-stall-stalled",
			parent_session_ref: "ses-stall-stalled-parent",
			agent_ref: "agent-reviewer-stall-stalled",
			created_at: new Date(observedAtMs - 10 * 60_000).toISOString(),
			updated_at: new Date(observedAtMs - 10 * 60_000).toISOString(),
		};
		const freshIntent = prepareFlowDeskSessionEvidenceWriteIntentV1({
			workflowId,
			evidenceId: "lifecycle-stall-fresh",
			record: freshLane,
		});
		assert.equal(freshIntent.ok, true, freshIntent.errors.join("; "));
		const stalledIntent = prepareFlowDeskSessionEvidenceWriteIntentV1({
			workflowId,
			evidenceId: "lifecycle-stall-stalled",
			record: stalledLane,
		});
		assert.equal(stalledIntent.ok, true, stalledIntent.errors.join("; "));
		const applied = applyFlowDeskSessionEvidenceWriteIntentsV1(root, [
			freshIntent.writeIntent as never,
			stalledIntent.writeIntent as never,
		]);
		assert.equal(applied.ok, true, applied.errors.join("; "));
		const hooks = await flowdeskOpenCodeServerPlugin.server(
			undefined as never,
			{
				[flowdeskStatusLiveOption]: { enabled: true },
				[flowdeskDurableStateRootOption]: root,
				localNonDispatchAdapter: false,
				naturalLanguageRouting: false,
			},
		);
		const statusTool = hooks.tool?.[flowdeskStatusLiveToolName];
		assert.ok(statusTool);
		const result = JSON.parse(
			toolOutput(await statusTool.execute({ workflowId }, undefined as never)),
		) as Record<string, unknown>;
		assert.equal(result.status, "status_live_collected");
		assert.equal(result.worstLaneStallClassification, "stalled");
		assert.equal(result.totalStalledLaneCount, 1);
		const workflows = result.workflows as Array<Record<string, unknown>>;
		assert.equal(workflows.length, 1);
		const workflow = workflows[0];
		assert.equal(workflow.worstLaneStallClassification, "stalled");
		assert.equal(workflow.stalledLaneCount, 1);
		const projection = workflow.laneStallProjection as Record<string, unknown>;
		assert.equal(
			projection.schema_version,
			"flowdesk.lane_stall_projection.v1",
		);
		const entries = projection.entries as Array<Record<string, unknown>>;
		assert.equal(entries.length, 2);
		const stalledEntry = entries.find(
			(entry) => entry.laneId === "lane-stall-stalled",
		);
		assert.ok(stalledEntry);
		assert.equal(stalledEntry.classification, "stalled");
		assert.equal(stalledEntry.abnormal, true);
		assert.ok(
			(stalledEntry.safeNextActions as string[]).includes("/flowdesk-retry"),
		);
		const freshEntry = entries.find(
			(entry) => entry.laneId === "lane-stall-fresh",
		);
		assert.ok(freshEntry);
		assert.equal(freshEntry.classification, "progressing_normal");
		assert.equal(freshEntry.abnormal, false);
		const authority = result.authority as Record<string, unknown>;
		assert.equal(authority.providerCall, false);
		assert.equal(authority.realOpenCodeDispatch, false);
		assert.equal(authority.fallbackAuthority, false);
		assert.equal(authority.hardCancelOrNoReplyAuthority, false);
	} finally {
		rmSync(root, { recursive: true, force: true });
	}
});

test("status live tool keeps terminal lifecycle when same-time running evidence is also present", async () => {
	const root = mkdtempSync(join(tmpdir(), "flowdesk-status-live-terminal-tie-"));
	try {
		const workflowId = "workflow-status-live-terminal-tie";
		const tieAt = new Date(Date.now() - 10 * 60_000).toISOString();
		const baseLane = {
			schema_version: "flowdesk.lane_lifecycle_record.v1",
			lane_id: "lane-status-live-terminal-tie",
			workflow_id: workflowId,
			attempt_id: "attempt-status-live-terminal-tie",
			parent_session_ref: "ses-status-live-terminal-tie-parent",
			child_session_ref: "ses-status-live-terminal-tie-child",
			message_ref: "msg-status-live-terminal-tie",
			agent_ref: "agent-reviewer-status-live-terminal-tie",
			provider_qualified_model_id: "openai/gpt-5.4-mini-fast",
			timeout_ms: 60_000,
			orphan_max_age_ms: 600_000,
			retry_count: 0,
			created_at: tieAt,
			updated_at: tieAt,
			dispatch_authority_enabled: false as const,
			providerCall: false as const,
			actualLaneLaunch: false as const,
			runtimeExecution: false as const,
		};
		const completeIntent = prepareFlowDeskSessionEvidenceWriteIntentV1({
			workflowId,
			evidenceId: "lifecycle-complete-status-live-terminal-tie",
			record: {
				...baseLane,
				state: "complete" as const,
				verdict_ref: "verdict-status-live-terminal-tie",
				output_ref: "output-status-live-terminal-tie",
				runtime_echo_ref: "runtime-echo-status-live-terminal-tie",
				telemetry_ref: "telemetry-status-live-terminal-tie",
			},
		});
		assert.equal(completeIntent.ok, true, completeIntent.errors.join("; "));
		const runningIntent = prepareFlowDeskSessionEvidenceWriteIntentV1({
			workflowId,
			evidenceId: "lifecycle-running-status-live-terminal-tie",
			record: {
				...baseLane,
				state: "running" as const,
			},
		});
		assert.equal(runningIntent.ok, true, runningIntent.errors.join("; "));
		const applied = applyFlowDeskSessionEvidenceWriteIntentsV1(root, [
			completeIntent.writeIntent as never,
			runningIntent.writeIntent as never,
		]);
		assert.equal(applied.ok, true, applied.errors.join("; "));
		const hooks = await flowdeskOpenCodeServerPlugin.server(
			undefined as never,
			{
				[flowdeskStatusLiveOption]: { enabled: true },
				[flowdeskDurableStateRootOption]: root,
				localNonDispatchAdapter: false,
				naturalLanguageRouting: false,
			},
		);
		const statusTool = hooks.tool?.[flowdeskStatusLiveToolName];
		assert.ok(statusTool);
		const result = JSON.parse(
			toolOutput(await statusTool.execute({ workflowId }, undefined as never)),
		) as Record<string, unknown>;
		assert.equal(result.status, "status_live_collected");
		assert.equal(result.worstLaneStallClassification, "terminal");
		assert.equal(result.totalStalledLaneCount, 0);
		const workflows = result.workflows as Array<Record<string, unknown>>;
		assert.equal(workflows.length, 1);
		const workflow = workflows[0];
		assert.equal(workflow.worstLaneStallClassification, "terminal");
		assert.equal(workflow.stalledLaneCount, 0);
		const projection = workflow.laneStallProjection as Record<string, unknown>;
		const entries = projection.entries as Array<Record<string, unknown>>;
		assert.equal(entries.length, 1);
		assert.equal(entries[0].classification, "terminal");
		assert.equal(entries[0].lifecycleState, "complete");
		assert.equal(
			entries[0].lastSignalEvidenceId,
			"lifecycle-complete-status-live-terminal-tie",
		);
	} finally {
		rmSync(root, { recursive: true, force: true });
	}
});

test("status live tool description mentions lane heartbeat stall projection vocabulary", async () => {
	const root = mkdtempSync(join(tmpdir(), "flowdesk-status-live-desc-"));
	try {
		const hooks = await flowdeskOpenCodeServerPlugin.server(
			undefined as never,
			{
				[flowdeskStatusLiveOption]: { enabled: true },
				[flowdeskDurableStateRootOption]: root,
				localNonDispatchAdapter: false,
				naturalLanguageRouting: false,
			},
		);
		const statusTool = hooks.tool?.[flowdeskStatusLiveToolName];
		assert.ok(statusTool);
		const description = String(statusTool.description ?? "");
		assert.match(description, /lane heartbeat stall projection/);
		assert.match(description, /progressing_normal/);
		assert.match(description, /progressing_late/);
		assert.match(description, /stalled/);
		assert.match(description, /worstLaneStallClassification/);
		assert.match(description, /totalStalledLaneCount/);
		assert.match(description, /멈춘 것 같아/);
		assert.match(description, /응답이 없어/);
		assert.equal(/auto-retry|auto-abort|auto-fallback/.test(description), true);
	} finally {
		rmSync(root, { recursive: true, force: true });
	}
});

test("provider usage live tool description exposes proactive usage guidance and alert vocabulary", async () => {
	const hooks = await flowdeskOpenCodeServerPlugin.server(undefined as never, {
		[flowdeskProviderUsageLiveOption]: {
			enabled: true,
			providers: ["claude", "openai", "gemini"],
		},
		localNonDispatchAdapter: false,
		naturalLanguageRouting: false,
	});
	const usageTool = hooks.tool?.[flowdeskProviderUsageLiveToolName];
	assert.ok(usageTool);
	const description = String(usageTool.description ?? "");
	assert.match(description, /ALSO PROACTIVELY USE/);
	assert.match(description, /worstAlertLevel/);
	assert.match(description, /alertLevel/);
	assert.match(description, /recommendation/);
	assert.match(description, /critical/);
	assert.match(description, /exhausted/);
});

test("pre-spike doctor exposes natural-language tool registration status and hints", async () => {
	const baseline = await flowdeskOpenCodeServerPlugin.server(
		undefined as never,
		{
			localNonDispatchAdapter: false,
			naturalLanguageRouting: false,
		},
	);
	const doctorTool = baseline.tool?.[flowdeskPreSpikeDoctorToolName];
	assert.ok(doctorTool);
	const baselineResult = JSON.parse(
		toolOutput(await doctorTool.execute({}, undefined as never)),
	) as Record<string, unknown>;
	const baselineNl = baselineResult.naturalLanguageTools as Record<
		string,
		Record<string, unknown>
	>;
	assert.equal(baselineNl.quickReviewerRun.enabled, false);
	assert.equal(baselineNl.quickReviewerRun.registered, false);
	assert.equal(baselineNl.providerUsageLive.enabled, false);
	assert.equal(baselineNl.providerUsageLive.registered, false);
	assert.equal(baselineNl.statusLive.enabled, false);
	assert.equal(baselineNl.statusLive.registered, false);

	const root = mkdtempSync(join(tmpdir(), "flowdesk-doctor-nl-"));
	try {
		const dummyClient = {
			session: {
				create: async () => ({ id: "p" }),
				prompt: async () => ({ info: { id: "m" } }),
				messages: async () => [],
			},
		};
		const enabled = await flowdeskOpenCodeServerPlugin.server(
			{ client: dummyClient } as never,
			{
				[flowdeskQuickReviewerRunOption]: {
					enabled: true,
					providerQualifiedModelId: "openai/gpt-5.4-mini-fast",
					runtimeAgent: "reviewer-gpt-frontier",
				},
				[flowdeskProviderUsageLiveOption]: {
					enabled: true,
					providers: ["openai"],
				},
				[flowdeskStatusLiveOption]: { enabled: true },
				[flowdeskDurableStateRootOption]: root,
				localNonDispatchAdapter: false,
				naturalLanguageRouting: false,
			},
		);
		const doctor = enabled.tool?.[flowdeskPreSpikeDoctorToolName];
		assert.ok(doctor);
		const result = JSON.parse(
			toolOutput(await doctor.execute({}, undefined as never)),
		) as Record<string, unknown>;
		const nl = result.naturalLanguageTools as Record<
			string,
			Record<string, unknown>
		>;
		assert.equal(nl.quickReviewerRun.enabled, true);
		assert.equal(nl.quickReviewerRun.registered, true);
		assert.equal(nl.providerUsageLive.enabled, true);
		assert.equal(nl.providerUsageLive.registered, true);
		assert.deepEqual(nl.providerUsageLive.providers, ["openai"]);
		assert.equal(nl.statusLive.enabled, true);
		assert.equal(nl.statusLive.registered, true);
		assert.equal(nl.statusLive.rootDir, root);
		assert.equal(nl.exportDebug.registered, true);
		assert.deepEqual(nl.exportDebug.sections, [
			"doctor",
			"conformance",
			"workflow_state",
			"audit_refs",
			"usage_summary",
			"policy_summary",
			"redaction_summary",
		]);
		assert.equal(
			nl.exportDebug.sectionPathTemplate,
			".flowdesk/sessions/<sid>/redacted-debug/sections/<section>.json",
		);
	} finally {
		rmSync(root, { recursive: true, force: true });
	}
});

test("quick fallback run tool is absent by default and registers only with explicit opt-in", async () => {
	const defaultHooks = await flowdeskOpenCodeServerPlugin.server(
		undefined as never,
		{
			localNonDispatchAdapter: false,
			naturalLanguageRouting: false,
		},
	);
	assert.equal(
		defaultHooks.tool?.[flowdeskQuickFallbackRunToolName],
		undefined,
	);

	const enabledHooks = await flowdeskOpenCodeServerPlugin.server(
		undefined as never,
		{
			[flowdeskQuickFallbackRunOption]: {
				enabled: true,
				defaultFromProvider: "claude/sonnet-4",
				defaultToProvider: "openai/gpt-5.5",
			},
			localNonDispatchAdapter: false,
			naturalLanguageRouting: false,
		},
	);
	const tool = enabledHooks.tool?.[flowdeskQuickFallbackRunToolName];
	assert.ok(tool);
	const description = String(tool.description ?? "");
	assert.match(description, /WHEN TO USE/);
	assert.match(description, /WHEN NOT TO USE/);
	assert.match(description, /막혔어/);
	assert.match(description, /다른 provider/);
	assert.match(description, /바꿔서 다시/);
	assert.match(description, /fallback to/);
	assert.match(description, /switch to/);
	assert.match(description, /managed-dispatch promotion/);
});

test("quick fallback run blocks without developerModeAcknowledged", async () => {
	const hooks = await flowdeskOpenCodeServerPlugin.server(undefined as never, {
		[flowdeskQuickFallbackRunOption]: { enabled: true },
		localNonDispatchAdapter: false,
		naturalLanguageRouting: false,
	});
	const tool = hooks.tool?.[flowdeskQuickFallbackRunToolName];
	assert.ok(tool);
	const result = JSON.parse(
		toolOutput(
			await tool.execute(
				{
					fromProvider: "claude/sonnet-4",
					toProvider: "openai/gpt-5.5",
				},
				undefined as never,
			),
		),
	) as Record<string, unknown>;
	assert.equal(result.status, "blocked_before_quick_fallback_run");
	assert.match(String(result.redactedBlockReason), /developerModeAcknowledged/);
});

test("quick fallback run produces a fresh full re-gate plan and persists it when opted in", async () => {
	const root = mkdtempSync(join(tmpdir(), "flowdesk-quick-fallback-"));
	try {
		const hooks = await flowdeskOpenCodeServerPlugin.server(
			undefined as never,
			{
				[flowdeskQuickFallbackRunOption]: { enabled: true },
				[flowdeskDurableStateRootOption]: root,
				localNonDispatchAdapter: false,
				naturalLanguageRouting: false,
			},
		);
		const tool = hooks.tool?.[flowdeskQuickFallbackRunToolName];
		assert.ok(tool);
		const result = JSON.parse(
			toolOutput(
				await tool.execute(
					{
						fromProvider: "claude/sonnet-4",
						toProvider: "openai/gpt-5.5",
						reason: "provider_unhealthy",
						developerModeAcknowledged: true,
						persistRegatePlanEvidence: true,
					},
					undefined as never,
				),
			),
		) as Record<string, unknown>;
		assert.equal(result.status, "quick_fallback_run_completed");
		assert.equal(result.requestedFromProvider, "claude/sonnet-4");
		assert.equal(result.requestedToProvider, "openai/gpt-5.5");
		assert.equal(result.regatePlanState, "full_regate_required");
		assert.equal(result.regatePlanOk, true);
		assert.equal(result.regatePlanRequiredEvidenceCount, 3);
		const evidence = result.regatePlanEvidence as Record<string, unknown>;
		assert.equal(evidence.status, "regate_plan_evidence_recorded");
		assert.equal(evidence.writeAttempted, true);
		assert.equal(evidence.evidenceReloaded, true);
		const authority = result.authority as Record<string, unknown>;
		assert.equal(authority.providerCall, false);
		assert.equal(authority.runtimeExecution, false);
		assert.equal(authority.realOpenCodeDispatch, false);
		assert.equal(authority.fallbackAuthority, false);
		assert.equal(authority.automaticFallbackAuthorized, false);
		assert.equal(authority.regatePlanPrepared, true);
	} finally {
		rmSync(root, { recursive: true, force: true });
	}
});

test("lane heartbeat writer tool is absent by default and registers only with explicit opt-in plus a durable state root", async () => {
	const defaultHooks = await flowdeskOpenCodeServerPlugin.server(
		undefined as never,
		{
			localNonDispatchAdapter: false,
			naturalLanguageRouting: false,
		},
	);
	assert.equal(
		defaultHooks.tool?.[flowdeskLaneHeartbeatWriterToolName],
		undefined,
	);
	const enabledWithoutRoot = await flowdeskOpenCodeServerPlugin.server(
		undefined as never,
		{
			[flowdeskLaneHeartbeatWriterOption]: { enabled: true },
			localNonDispatchAdapter: false,
			naturalLanguageRouting: false,
		},
	);
	assert.equal(
		enabledWithoutRoot.tool?.[flowdeskLaneHeartbeatWriterToolName],
		undefined,
	);
	const root = mkdtempSync(join(tmpdir(), "flowdesk-lane-heartbeat-writer-"));
	try {
		const enabled = await flowdeskOpenCodeServerPlugin.server(
			undefined as never,
			{
				[flowdeskLaneHeartbeatWriterOption]: { enabled: true },
				[flowdeskDurableStateRootOption]: root,
				localNonDispatchAdapter: false,
				naturalLanguageRouting: false,
			},
		);
		const tool = enabled.tool?.[flowdeskLaneHeartbeatWriterToolName];
		assert.ok(tool);
		const result = JSON.parse(
			toolOutput(
				await tool.execute(
					{
						workflowId: "workflow-heartbeat-tool",
						attemptId: "attempt-heartbeat-tool",
						laneId: "lane-heartbeat-tool",
						parentSessionRef: "ses-heartbeat-tool-parent",
						agentRef: "agent-heartbeat-tool",
						providerQualifiedModelId: "openai/gpt-5.4-mini-fast",
						state: "running",
						progressSummaryLabel: "warming up reviewer lane",
					},
					undefined as never,
				),
			),
		) as Record<string, unknown>;
		assert.equal(result.status, "lane_heartbeat_recorded");
		assert.equal(result.workflowId, "workflow-heartbeat-tool");
		assert.equal(result.laneId, "lane-heartbeat-tool");
		assert.equal(typeof result.heartbeatId, "string");
		assert.equal(result.heartbeatSeq, 1);
		assert.equal(typeof result.expectedNextHeartbeatAt, "string");
		const authority = result.authority as Record<string, unknown>;
		assert.equal(authority.realOpenCodeDispatch, false);
		assert.equal(authority.providerCall, false);
		assert.equal(authority.runtimeExecution, false);
		assert.equal(authority.actualLaneLaunch, false);
		assert.equal(authority.fallbackAuthority, false);
		assert.equal(authority.hardCancelOrNoReplyAuthority, false);
		assert.equal(authority.laneHeartbeatPersisted, true);
		const second = JSON.parse(
			toolOutput(
				await tool.execute(
					{
						workflowId: "workflow-heartbeat-tool",
						attemptId: "attempt-heartbeat-tool",
						laneId: "lane-heartbeat-tool",
						parentSessionRef: "ses-heartbeat-tool-parent",
						agentRef: "agent-heartbeat-tool",
						providerQualifiedModelId: "openai/gpt-5.4-mini-fast",
						state: "running",
					},
					undefined as never,
				),
			),
		) as Record<string, unknown>;
		assert.equal(second.status, "lane_heartbeat_recorded");
		assert.equal(second.heartbeatSeq, 2);
	} finally {
		rmSync(root, { recursive: true, force: true });
	}
});

test("chat.message stall alert card appends safe next actions when stalled lanes exist", async () => {
	const root = mkdtempSync(join(tmpdir(), "flowdesk-chat-stall-card-"));
	try {
		const workflowId = "workflow-chat-stall-card";
		const observedAtMs = Date.now();
		const stalledLifecycle = {
			schema_version: "flowdesk.lane_lifecycle_record.v1",
			lane_id: "lane-chat-stall-card",
			workflow_id: workflowId,
			attempt_id: "attempt-chat-stall-card",
			parent_session_ref: "ses-chat-stall-card-parent",
			agent_ref: "agent-chat-stall-card",
			provider_qualified_model_id: "openai/gpt-5.4-mini-fast",
			state: "running" as const,
			timeout_ms: 60_000,
			orphan_max_age_ms: 600_000,
			retry_count: 0,
			created_at: new Date(observedAtMs - 12 * 60_000).toISOString(),
			updated_at: new Date(observedAtMs - 12 * 60_000).toISOString(),
			dispatch_authority_enabled: false as const,
			providerCall: false as const,
			actualLaneLaunch: false as const,
			runtimeExecution: false as const,
		};
		const intent = prepareFlowDeskSessionEvidenceWriteIntentV1({
			workflowId,
			evidenceId: "lifecycle-chat-stall-card",
			record: stalledLifecycle,
		});
		assert.equal(intent.ok, true, intent.errors.join("; "));
		const applied = applyFlowDeskSessionEvidenceWriteIntentsV1(root, [
			intent.writeIntent as never,
		]);
		assert.equal(applied.ok, true, applied.errors.join("; "));
		const hooks = (await flowdeskOpenCodeServerPlugin.server(
			undefined as never,
			{
				[flowdeskNaturalLanguageRoutingOption]: true,
				[flowdeskDurableStateRootOption]: root,
				[flowdeskStatusLiveOption]: { enabled: true },
				[flowdeskChatMessageStallAlertOption]: { enabled: true },
			},
		)) as ChatMessageHooks;
		assert.ok(hooks["chat.message"]);
		const generalOutput = {
			parts: [{ type: "text", text: "오늘 날씨 이야기" }] as unknown[],
		};
		await hooks["chat.message"](
			{
				messageID: "message-stall-card-general",
				sessionID: "session-stall-card",
			},
			generalOutput,
		);
		const generalSerialized = JSON.stringify(generalOutput);
		assert.match(generalSerialized, /Stalled lanes detected/);
		assert.match(generalSerialized, /workflow-chat-stall-card/);
		assert.match(generalSerialized, /- \/flowdesk-retry/);
		assert.equal(/noReply|cancel|stop/.test(generalSerialized), false);

		const planOutput = {
			parts: [{ type: "text", text: "구현 계획을 세워줘" }] as unknown[],
		};
		await hooks["chat.message"](
			{
				messageID: "message-stall-card-plan",
				sessionID: "session-stall-card-second",
			},
			planOutput,
		);
		const planSerialized = JSON.stringify(planOutput);
		assert.match(planSerialized, /Suggested next step:/);
		assert.match(planSerialized, /Stalled lanes detected/);
		assert.equal(/noReply|cancel|stop/.test(planSerialized), false);
	} finally {
		rmSync(root, { recursive: true, force: true });
	}
});

test("chat.message stall alert surfaces progressing-late lanes only when includeProgressingLate is opted in", async () => {
	const root = mkdtempSync(join(tmpdir(), "flowdesk-chat-late-card-"));
	try {
		const workflowId = "workflow-chat-late-card";
		const observedAtMs = Date.now();
		const lateLifecycle = {
			schema_version: "flowdesk.lane_lifecycle_record.v1",
			lane_id: "lane-chat-late-card",
			workflow_id: workflowId,
			attempt_id: "attempt-chat-late-card",
			parent_session_ref: "ses-chat-late-card-parent",
			agent_ref: "agent-chat-late-card",
			provider_qualified_model_id: "openai/gpt-5.4-mini-fast",
			state: "running" as const,
			timeout_ms: 60_000,
			orphan_max_age_ms: 600_000,
			retry_count: 0,
			created_at: new Date(observedAtMs - 3 * 60_000).toISOString(),
			updated_at: new Date(observedAtMs - 3 * 60_000).toISOString(),
			dispatch_authority_enabled: false as const,
			providerCall: false as const,
			actualLaneLaunch: false as const,
			runtimeExecution: false as const,
		};
		const intent = prepareFlowDeskSessionEvidenceWriteIntentV1({
			workflowId,
			evidenceId: "lifecycle-chat-late-card",
			record: lateLifecycle,
		});
		assert.equal(intent.ok, true, intent.errors.join("; "));
		const applied = applyFlowDeskSessionEvidenceWriteIntentsV1(root, [
			intent.writeIntent as never,
		]);
		assert.equal(applied.ok, true, applied.errors.join("; "));

		const defaultHooks = (await flowdeskOpenCodeServerPlugin.server(
			undefined as never,
			{
				[flowdeskNaturalLanguageRoutingOption]: true,
				[flowdeskDurableStateRootOption]: root,
				[flowdeskStatusLiveOption]: { enabled: true },
				[flowdeskChatMessageStallAlertOption]: { enabled: true },
			},
		)) as ChatMessageHooks;
		assert.ok(defaultHooks["chat.message"]);
		const noLateOutput = {
			parts: [{ type: "text", text: "오늘 날씨 이야기" }] as unknown[],
		};
		await defaultHooks["chat.message"](
			{
				messageID: "message-late-card-no-opt",
				sessionID: "session-late-card-no-opt",
			},
			noLateOutput,
		);
		assert.equal(noLateOutput.parts.length, 1);
		assert.equal(
			/Stalled lanes detected|Late-progressing lanes detected/.test(
				JSON.stringify(noLateOutput),
			),
			false,
		);

		const lateHooks = (await flowdeskOpenCodeServerPlugin.server(
			undefined as never,
			{
				[flowdeskNaturalLanguageRoutingOption]: true,
				[flowdeskDurableStateRootOption]: root,
				[flowdeskStatusLiveOption]: { enabled: true },
				[flowdeskChatMessageStallAlertOption]: {
					enabled: true,
					includeProgressingLate: true,
				},
			},
		)) as ChatMessageHooks;
		assert.ok(lateHooks["chat.message"]);
		const lateOutput = {
			parts: [{ type: "text", text: "오늘 날씨 이야기" }] as unknown[],
		};
		await lateHooks["chat.message"](
			{
				messageID: "message-late-card-opt-in",
				sessionID: "session-late-card-opt-in",
			},
			lateOutput,
		);
		const serialized = JSON.stringify(lateOutput);
		assert.match(serialized, /Late-progressing lanes detected/);
		assert.match(serialized, /workflow-chat-late-card/);
		assert.match(serialized, /1 progressing-late/);
		assert.match(serialized, /- \/flowdesk-status/);
		assert.equal(/noReply|cancel|stop/.test(serialized), false);
	} finally {
		rmSync(root, { recursive: true, force: true });
	}
});

test("chat.message appended parts carry opencode 1.x TextPart schema fields (id, sessionID, messageID)", async () => {
	const hooks = (await flowdeskOpenCodeServerPlugin.server(undefined as never, {
		[flowdeskNaturalLanguageRoutingOption]: true,
	})) as ChatMessageHooks;
	assert.ok(hooks["chat.message"]);

	const steeringOutput = {
		parts: [{ type: "text", text: "구현 계획을 세워줘" }] as unknown[],
	};
	await hooks["chat.message"](
		{
			messageID: "msg_part_schema_steering",
			sessionID: "ses_part_schema_steering",
		},
		steeringOutput,
	);
	assert.equal(steeringOutput.parts.length, 2);
	const steeringAppended = steeringOutput.parts[1] as Record<string, unknown>;
	assert.equal(steeringAppended.type, "text");
	assert.equal(typeof steeringAppended.text, "string");
	assert.equal(steeringAppended.sessionID, "ses_part_schema_steering");
	assert.equal(steeringAppended.messageID, "msg_part_schema_steering");
	assert.equal(typeof steeringAppended.id, "string");
	assert.match(String(steeringAppended.id), /^prt_[0-9a-f]+$/);

	const original = steeringOutput.parts[0] as Record<string, unknown>;
	assert.equal(original.id, undefined);
	assert.equal(original.sessionID, undefined);
	assert.equal(original.messageID, undefined);
});

test("chat.message stall alert appended parts carry opencode 1.x TextPart schema fields and unique ids", async () => {
	const root = mkdtempSync(join(tmpdir(), "flowdesk-chat-stall-part-schema-"));
	try {
		const workflowId = "workflow-chat-stall-part-schema";
		const observedAtMs = Date.now();
		const stalledLifecycle = {
			schema_version: "flowdesk.lane_lifecycle_record.v1",
			lane_id: "lane-chat-stall-part-schema",
			workflow_id: workflowId,
			attempt_id: "attempt-chat-stall-part-schema",
			parent_session_ref: "ses-chat-stall-part-schema-parent",
			agent_ref: "agent-chat-stall-part-schema",
			provider_qualified_model_id: "openai/gpt-5.4-mini-fast",
			state: "running" as const,
			timeout_ms: 60_000,
			orphan_max_age_ms: 600_000,
			retry_count: 0,
			created_at: new Date(observedAtMs - 12 * 60_000).toISOString(),
			updated_at: new Date(observedAtMs - 12 * 60_000).toISOString(),
			dispatch_authority_enabled: false as const,
			providerCall: false as const,
			actualLaneLaunch: false as const,
			runtimeExecution: false as const,
		};
		const intent = prepareFlowDeskSessionEvidenceWriteIntentV1({
			workflowId,
			evidenceId: "lifecycle-chat-stall-part-schema",
			record: stalledLifecycle,
		});
		assert.equal(intent.ok, true, intent.errors.join("; "));
		const applied = applyFlowDeskSessionEvidenceWriteIntentsV1(root, [
			intent.writeIntent as never,
		]);
		assert.equal(applied.ok, true, applied.errors.join("; "));
		const hooks = (await flowdeskOpenCodeServerPlugin.server(
			undefined as never,
			{
				[flowdeskNaturalLanguageRoutingOption]: true,
				[flowdeskDurableStateRootOption]: root,
				[flowdeskStatusLiveOption]: { enabled: true },
				[flowdeskChatMessageStallAlertOption]: { enabled: true },
			},
		)) as ChatMessageHooks;
		assert.ok(hooks["chat.message"]);

		const continueChatOutput = {
			parts: [{ type: "text", text: "오늘 날씨 이야기" }] as unknown[],
		};
		await hooks["chat.message"](
			{
				messageID: "msg_stall_part_schema_continue",
				sessionID: "ses_stall_part_schema_continue",
			},
			continueChatOutput,
		);
		assert.equal(continueChatOutput.parts.length, 2);
		const continueAppended = continueChatOutput.parts[1] as Record<
			string,
			unknown
		>;
		assert.equal(continueAppended.type, "text");
		assert.match(String(continueAppended.text), /Stalled lanes detected/);
		assert.equal(continueAppended.sessionID, "ses_stall_part_schema_continue");
		assert.equal(continueAppended.messageID, "msg_stall_part_schema_continue");
		assert.match(String(continueAppended.id), /^prt_[0-9a-f]+$/);

		const planOutput = {
			parts: [{ type: "text", text: "구현 계획을 세워줘" }] as unknown[],
		};
		await hooks["chat.message"](
			{
				messageID: "msg_stall_part_schema_plan",
				sessionID: "ses_stall_part_schema_plan",
			},
			planOutput,
		);
		assert.equal(planOutput.parts.length, 3);
		const planSteering = planOutput.parts[1] as Record<string, unknown>;
		const planStallCard = planOutput.parts[2] as Record<string, unknown>;
		for (const part of [planSteering, planStallCard]) {
			assert.equal(part.type, "text");
			assert.equal(typeof part.text, "string");
			assert.equal(part.sessionID, "ses_stall_part_schema_plan");
			assert.equal(part.messageID, "msg_stall_part_schema_plan");
			assert.match(String(part.id), /^prt_[0-9a-f]+$/);
		}
		assert.notEqual(
			planSteering.id,
			planStallCard.id,
			"steering and stall card parts must have unique ids",
		);
		assert.match(String(planSteering.text), /Suggested next step:/);
		assert.match(String(planStallCard.text), /Stalled lanes detected/);
	} finally {
		rmSync(root, { recursive: true, force: true });
	}
});

test("quick fallback run blocks before plan when from and to providers are equal", async () => {
	const hooks = await flowdeskOpenCodeServerPlugin.server(undefined as never, {
		[flowdeskQuickFallbackRunOption]: { enabled: true },
		localNonDispatchAdapter: false,
		naturalLanguageRouting: false,
	});
	const tool = hooks.tool?.[flowdeskQuickFallbackRunToolName];
	assert.ok(tool);
	const result = JSON.parse(
		toolOutput(
			await tool.execute(
				{
					fromProvider: "claude/sonnet-4",
					toProvider: "claude/sonnet-4",
					developerModeAcknowledged: true,
				},
				undefined as never,
			),
		),
	) as Record<string, unknown>;
	assert.equal(result.status, "blocked_before_quick_fallback_run");
	assert.match(String(result.redactedBlockReason), /must differ/);
});
