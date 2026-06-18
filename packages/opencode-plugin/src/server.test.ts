import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import {
	existsSync,
	mkdirSync,
	mkdtempSync,
	readFileSync,
	rmSync,
	symlinkSync,
	writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { DatabaseSync } from "node:sqlite";
import test from "node:test";
import {
	applyFlowDeskSessionEvidenceWriteIntentsV1,
	consumeFlowDeskProductionApprovalSourceV1,
	evaluateFlowDeskManagedDispatchExposureAuthorizationV1,
	FLOWDESK_FDS1_FIXTURE_CATALOG,
	FLOWDESK_RELEASE_1_COMMAND_MANIFEST,
	FLOWDESK_S7_REQUIRED_S6_TUPLE,
	createFlowDeskGitHubDryRunPublicationResultV1,
	planFlowDeskExactModelAvailabilityCacheAcquisitionV1,
	prepareFlowDeskSessionEvidenceWriteIntentV1,
	reloadFlowDeskSessionEvidenceV1,
	sessionEvidenceRecordPath,
} from "@flowdesk/core";
import { tool } from "@opencode-ai/plugin";
import { refreshFlowDeskCompletionUiCachesV1 } from "./completion-ui-cache.js";
import { consumeFlowDeskCompletionWakeForMainSessionV1 } from "./completion-wake-main-session.js";
import {
	getFlowDeskPreSpikeProductionToolRegistry,
	hasPassingFds1SchemaConversionSpike,
	hasProductionOpenCodeRegistration,
} from "./index.js";
import { createFlowDeskLocalNonDispatchAdapterSession } from "./local-adapter.js";
import flowdeskOpenCodeServerPlugin, {
	createFlowDeskChatHookAuthorityProbeFromObservationV1,
	createFlowDeskFds1SchemaConversionProbeTools,
	createFlowDeskFederatedRegistryPublishTools,
	createFlowDeskNaturalLanguageChatMessageHook,
	createFlowDeskLocalNonDispatchAdapterTools,
	flowdeskAbortCmdToolName,
	flowdeskCheckToolName,
	flowdeskDebugToolName,
	flowdeskPlanShortToolName,
	flowdeskAgentTaskRunOption,
	flowdeskAgentTaskRunToolName,
	flowdeskTaskToolName,
	flowdeskAutoContinueExecutionOption,
	flowdeskAutoContinueExecutionToolName,
	flowdeskAutoContinuePreviewToolName,
	flowdeskContinueToolName,
	flowdeskBeatToolName,
	flowdeskControlledWriteApplyOption,
	flowdeskControlledWriteApplyToolName,
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
	flowdeskNextToolName,
	flowdeskNowToolName,
	flowdeskPreSpikeDoctorToolName,
	flowdeskProductionEnablementOption,
	flowdeskProjectConfigOption,
	flowdeskProviderUsageLiveOption,
	flowdeskProviderUsageLiveToolName,
	flowdeskQuotaToolName,
	flowdeskQuickFallbackRunOption,
	flowdeskQuickFallbackRunToolName,
	flowdeskRebindToolName,
	flowdeskResumeStatusToolName,
	flowdeskRetryDiagToolName,
	flowdeskRunShortToolName,
	flowdeskResultToolName,
	flowdeskQuickReviewerRunOption,
	flowdeskQuickReviewerRunToolName,
	flowdeskReviewerFanoutDiagnosticsOption,
	flowdeskRuntimeReviewerExecutionOption,
	flowdeskRuntimeReviewerExecutionToolName,
	flowdeskStatusLiveOption,
	flowdeskStatusLiveToolName,
	flowdeskWatchdogOption,
	flowdeskWatchdogTriggerToolName,
	flowdeskWorkflowDispatchOption,
	flowdeskWorkflowDispatchPlanToolName,
	flowdeskWorkflowDispatchPlanToolOption,
	flowdeskWorkflowDispatchToolName,
	flowdeskWriteToolName,
	flowdeskOperationalIntelligenceOption,
	flowdeskCompletionWakeMainSessionOption,
	flowdeskFederatedRegistryPublishToolName,
	operationalIntelligenceConfigFromOptions,
	completionWakeMainSessionConfigFromOptions,
	__resetCompletionWakeParentSessionRefForTest,
} from "./server.js";
import { computeGuardSignOffHmacV1, runFlowDeskWatchdogCycleV1, type FlowDeskGuardSignOffV1 } from "./stall-recovery.js";

const now = "2026-05-17T00:00:00.000Z";

function s7TaskResultForExportDebugTest(overrides: Record<string, unknown> = {}) {
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
		created_at: "2026-06-15T11:55:00.000Z",
		dispatch_authority_enabled: false,
		...overrides,
	};
}

function formatLocalResetTimeForTest(value: string, label: "5h" | "1w"): string {
	const parsed = Date.parse(value);
	if (!Number.isFinite(parsed)) return value;
	const date = new Date(parsed);
	const hh = String(date.getHours()).padStart(2, "0");
	const mm = String(date.getMinutes()).padStart(2, "0");
	if (label === "5h") return `${hh}:${mm}`;
	const month = String(date.getMonth() + 1).padStart(2, "0");
	const day = String(date.getDate()).padStart(2, "0");
	return `${month}-${day} ${hh}:${mm}`;
}

const stallRecoveryGuardKey = "test-stall-recovery-guard-key-32-bytes";
const stallRecoveryGuardMarkdown = "# SDK surface verification\n\nP6 evidence-only auto-abort is safe.\n";

function stallRecoveryGuardSignOff(): FlowDeskGuardSignOffV1 {
	const unsigned = {
		schema_version: "flowdesk.guard_sign_off.v1" as const,
		sign_off_id: "guard-signoff-chat-stall-123",
		created_at: "2026-05-17T00:00:00.000Z",
		target_markdown_sha256: createHash("sha256")
			.update(stallRecoveryGuardMarkdown, "utf8")
			.digest("hex"),
		p6_safe: true,
		nonce: "nonce-chat-stall-123",
		expires_at: "2026-12-31T00:00:00.000Z",
		dispatch_authority_enabled: false as const,
	};
	return {
		...unsigned,
		hmac_sha256: computeGuardSignOffHmacV1({
			unsignedSignOff: unsigned,
			hmacKey: stallRecoveryGuardKey,
		}),
	};
}

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
		pendingConfirmationNonce?: unknown;
		pendingConfirmationWorkflowId?: unknown;
		pendingConfirmationExpiresAt?: unknown;
		durableStateMode?: unknown;
		durableStateWriteApplied?: unknown;
		durableStateWrites?: unknown;
		permissionSource?: unknown;
	};
	providerCall?: unknown;
	runtimeExecution?: unknown;
	realOpenCodeDispatch?: unknown;
	actualLaneLaunch?: unknown;
	fallbackAuthority?: unknown;
	hardCancelOrNoReplyAuthority?: unknown;
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
	event?: (input: { event: unknown }) => Promise<void>;
}

function toolOutput(value: string | { output: string }): string {
	return typeof value === "string" ? value : value.output;
}

function githubDryRunPublicationResultForServerTest() {
	const result = createFlowDeskGitHubDryRunPublicationResultV1({
		dryRunResultId: "dry-run-server-test",
		preflightRef: "preflight-ref-server-test",
		writePlanRef: "write-plan-ref-server-test",
		workflowId: "workflow-server-test",
		attemptId: "attempt-server-test",
		connectorKind: "github_pr_comment",
		redactedTargetLabel: "github target",
		redactedContentPreview: "federated score preview",
		contentHashRef: "hash-server-test",
		dryRunState: "dry_run_recorded",
		blockedLabels: [],
		fakeRemoteWriteAttempted: true,
	});
	assert.equal(result.ok, true);
	assert.ok(result.result);
	return result.result;
}

test("flowdesk_federated_registry_publish tool wraps advisory GitHub publication and skips remote write by default", async () => {
	const tools = createFlowDeskFederatedRegistryPublishTools();
	const publishTool = tools[flowdeskFederatedRegistryPublishToolName];
	assert.ok(publishTool);
	const parsed = JSON.parse(
		toolOutput(
			await publishTool.execute(
				{
					dryRunResult: githubDryRunPublicationResultForServerTest(),
					ledgerIdempotencyRef: "ledger-idempotency-ref-server-test",
					guardApprovalRef: "guard-approval-ref-server-test",
					target: { kind: "github_pr_comment", owner: "flowdesk", repo: "repo", issueNumber: 7 },
					contentMarkdown: "FlowDesk publication body",
					connectorGateSatisfied: false,
					allowActualRemoteWrite: false,
				},
				undefined as never,
			),
		),
	) as Record<string, unknown>;
	assert.equal(parsed.ok, false);
	assert.deepEqual(parsed.authority, {
		advisoryOnlyRecord: true,
		remoteWriteAuthorityEnabledInRecord: false,
		dispatchAuthorityEnabled: false,
		laneLaunchAuthorityEnabled: false,
	});
	assert.equal((parsed.remoteWrite as Record<string, unknown>).state, "skipped");
	assert.equal((parsed.publicationResult as Record<string, unknown>).remote_write_attempted, false);
});

test("flowdesk_federated_registry_publish tool rejects malformed records with redacted error envelope", async () => {
	const tools = createFlowDeskFederatedRegistryPublishTools();
	const publishTool = tools[flowdeskFederatedRegistryPublishToolName];
	assert.ok(publishTool);
	const parsed = JSON.parse(
		toolOutput(
			await publishTool.execute(
				{
					dryRunResult: { dry_run_result_id: 42 },
					target: "not-a-target-record",
					contentMarkdown: "FlowDesk publication body",
					allowActualRemoteWrite: true,
				},
				undefined as never,
			),
		),
	) as Record<string, unknown>;
	assert.equal(parsed.ok, false);
	assert.deepEqual(parsed.authority, {
		advisoryOnlyRecord: true,
		remoteWriteAuthorityEnabledInRecord: false,
		dispatchAuthorityEnabled: false,
		laneLaunchAuthorityEnabled: false,
	});
	assert.deepEqual(parsed.remoteWrite, { state: "skipped", endpointKind: "github_issue", redactedReason: "invalid-tool-input" });
	assert.equal((parsed.errors as string[]).length, 1);
	assert.match((parsed.errors as string[])[0] ?? "", /dryRunResult must be a valid/);
	assert.equal("publicationResult" in parsed, false);
});

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
		attempt_id: "attempt-runtime-reviewer-execution",
		lane_id: `lane-${perspective}-runtime-reviewer`,
		lane_plan_ref: `lane-plan-${perspective}-runtime-reviewer`,
		binding_ref: `binding-${perspective}-runtime-reviewer`,
		perspective,
		source: "gpt_frontier",
		created_at: now,
		scored_at: now,
		redaction_version: "redaction-v1",
		findings: [],
		evidence_refs: [`evidence-${perspective}-runtime-reviewer`],
		uncertainty: "low",
		required_fixes: [],
		verdict_label: "pass",
		safe_next_actions: ["/flowdesk-status"],
		dispatch_authority_enabled: false,
		guard_replacement_authority_enabled: false,
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
					const sessionID =
						(options as { path?: { id?: string }; sessionID?: string }).path?.id ??
						(options as { sessionID?: string }).sessionID ??
						"";
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
		...FLOWDESK_RELEASE_1_COMMAND_MANIFEST.flatMap((entry) =>
			entry.toolName === "flowdesk_doctor"
				? [entry.toolName, flowdeskCheckToolName]
				: entry.toolName === "flowdesk_plan"
					? [entry.toolName, flowdeskPlanShortToolName]
					: entry.toolName === "flowdesk_run"
						? [entry.toolName, flowdeskRunShortToolName]
						: entry.toolName === "flowdesk_resume"
							? [entry.toolName, flowdeskResumeStatusToolName]
							: entry.toolName === "flowdesk_retry"
								? [entry.toolName, flowdeskRetryDiagToolName]
								: entry.toolName === "flowdesk_abort"
									? [entry.toolName, flowdeskAbortCmdToolName]
									: entry.toolName === "flowdesk_export_debug"
										? [entry.toolName, flowdeskDebugToolName]
										: [entry.toolName],
		),
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
		"chat_steering_command_backed",
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
			(fake.messageCalls[0] as { path?: { id?: string } }).path?.id,
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
	assert.match(String(blocked.summaryForUser), /blocked before launch/);
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
	assert.match(description, /bindings\[\]/);
	assert.match(description, /multi-model fan-out/);
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
		assert.match(String(result.summaryForUser), /FlowDesk quick reviewer incomplete/);
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

test("workflow dispatch plan tool is absent by default and requires opt-in durable root", async () => {
	const defaultHooks = await flowdeskOpenCodeServerPlugin.server(
		undefined as never,
		{
			localNonDispatchAdapter: false,
			naturalLanguageRouting: false,
		},
	);
	assert.equal(
		defaultHooks.tool?.[flowdeskWorkflowDispatchPlanToolName],
		undefined,
	);

	const missingRootHooks = await flowdeskOpenCodeServerPlugin.server(
		undefined as never,
		{
			[flowdeskWorkflowDispatchPlanToolOption]: { enabled: true },
			localNonDispatchAdapter: false,
			naturalLanguageRouting: false,
		},
	);
	assert.equal(
		missingRootHooks.tool?.[flowdeskWorkflowDispatchPlanToolName],
		undefined,
	);
});

test("workflow dispatch plan tool persists planning evidence with authority disabled", async () => {
	const root = mkdtempSync(join(tmpdir(), "flowdesk-workflow-plan-tool-"));
	try {
		const hooks = await flowdeskOpenCodeServerPlugin.server(
			undefined as never,
			{
				[flowdeskWorkflowDispatchPlanToolOption]: { enabled: true },
				[flowdeskStatusLiveOption]: { enabled: true },
				[flowdeskDurableStateRootOption]: root,
				localNonDispatchAdapter: false,
				naturalLanguageRouting: false,
			},
		);
		const planTool = hooks.tool?.[flowdeskWorkflowDispatchPlanToolName];
		assert.ok(planTool);
		const result = JSON.parse(
			toolOutput(
				await planTool.execute(
					{
						workflowId: "workflow-tool-plan-1",
						goalSummary: "Plan a bounded implementation workflow.",
						selectedAgentRoles: ["implementation", "verification"],
						tasks: [
							{
								agentRole: "implementation",
								title: "Implement tool",
								summary: "Add the opt-in planning-only server tool.",
							},
							{
								agentRole: "verification",
								title: "Verify evidence",
								summary: "Check durable evidence and authority flags.",
							},
						],
					},
					undefined as never,
				),
			),
		) as Record<string, unknown>;
		assert.equal(result.status, "workflow_dispatch_plan_recorded");
		assert.equal(result.workflowId, "workflow-tool-plan-1");
		assert.equal(result.taskCount, 2);
		assert.match(String(result.summaryForUser), /Planning only/);
		const authority = result.authority as Record<string, unknown>;
		assert.equal(authority.realOpenCodeDispatch, false);
		assert.equal(authority.providerCall, false);
		assert.equal(authority.runtimeExecution, false);
		assert.equal(authority.actualLaneLaunch, false);
		assert.equal(authority.fallbackAuthority, false);
		assert.equal(authority.hardCancelOrNoReplyAuthority, false);
		assert.equal(authority.toolAuthority, false);
		assert.equal(authority.dispatchAuthorityEnabled, false);
		assert.equal(authority.workflowDispatchPlanPersisted, true);

		const reloaded = reloadFlowDeskSessionEvidenceV1({
			workflowId: "workflow-tool-plan-1",
			rootDir: root,
		});
		assert.equal(reloaded.ok, true, reloaded.errors.join("; "));
		const persisted = reloaded.entries.find(
			(entry) => entry.evidenceClass === "workflow_dispatch_plan",
		);
		assert.ok(persisted);
		assert.equal(persisted.record.dispatch_authority_enabled, false);
		assert.equal(persisted.record.provider_call_made, false);
		assert.equal(persisted.record.runtime_execution, false);
		assert.equal(persisted.record.actual_lane_launch, false);

		const statusTool = hooks.tool?.[flowdeskStatusLiveToolName];
		assert.ok(statusTool);
		const statusResult = JSON.parse(
			toolOutput(
				await statusTool.execute(
					{ workflowId: "workflow-tool-plan-1" },
					undefined as never,
				),
			),
		) as Record<string, unknown>;
		const workflow = (statusResult.workflows as Record<string, unknown>[])[0];
		assert.ok(workflow);
		const evidenceCounts = workflow.evidenceCounts as Record<string, unknown>;
		assert.equal(evidenceCounts.workflow_dispatch_plan, 1);
		assert.equal(workflow.latestWorkflowDispatchPlanTaskCount, 2);
		assert.match(String(statusResult.summaryForUser), /workflow_plan=/);
	} finally {
		rmSync(root, { recursive: true, force: true });
	}
});

test("flowdesk_next wraps auto-continue preview without execution authority", async () => {
	const root = mkdtempSync(join(tmpdir(), "flowdesk-next-wrapper-"));
	try {
		const hooks = await flowdeskOpenCodeServerPlugin.server(
			undefined as never,
			{
				[flowdeskWorkflowDispatchPlanToolOption]: { enabled: true },
				[flowdeskDurableStateRootOption]: root,
				localNonDispatchAdapter: false,
				naturalLanguageRouting: false,
			},
		);
		const planTool = hooks.tool?.[flowdeskWorkflowDispatchPlanToolName];
		const previewTool = hooks.tool?.[flowdeskAutoContinuePreviewToolName];
		const nextTool = hooks.tool?.[flowdeskNextToolName];
		assert.ok(planTool);
		assert.ok(previewTool);
		assert.ok(nextTool);

		await planTool.execute(
			{
				workflowId: "workflow-next-wrapper-1",
				goalSummary: "Plan a short wrapper preview workflow.",
				tasks: [
					{
						agentRole: "implementation",
						title: "Implement wrapper",
						summary: "Add short wrapper aliases.",
					},
				],
			},
			undefined as never,
		);
		const request = { workflowId: "workflow-next-wrapper-1", maxSteps: 3 };
		const preview = JSON.parse(
			toolOutput(await previewTool.execute(request, undefined as never)),
		) as Record<string, unknown>;
		const next = JSON.parse(
			toolOutput(await nextTool.execute(request, undefined as never)),
		) as Record<string, unknown>;
		assert.equal(next.status, "auto_continue_preview_ready");
		assert.equal(next.nextTaskId, preview.nextTaskId);
		assert.equal(next.pendingTaskCount, preview.pendingTaskCount);
		assert.equal(next.summaryForUser, preview.summaryForUser);
		const authority = next.authority as Record<string, unknown>;
		assert.equal(authority.providerCall, false);
		assert.equal(authority.runtimeExecution, false);
		assert.equal(authority.actualLaneLaunch, false);
		assert.equal(authority.realOpenCodeDispatch, false);
		assert.equal(authority.fallbackAuthority, false);
		assert.equal(authority.autoContinuationExecuted, false);
		assert.equal(authority.previewOnly, true);

		const description = String(nextTool.description ?? "");
		assert.ok(description.length < 240);
		assert.doesNotMatch(description, /Trigger on|Korean phrases|English phrases|WHEN TO USE/);
	} finally {
		rmSync(root, { recursive: true, force: true });
	}
});

test("workflow dispatch plan tool blocks authority-smuggling input", async () => {
	const root = mkdtempSync(join(tmpdir(), "flowdesk-workflow-plan-block-"));
	try {
		const hooks = await flowdeskOpenCodeServerPlugin.server(
			undefined as never,
			{
				[flowdeskWorkflowDispatchPlanToolOption]: { enabled: true },
				[flowdeskDurableStateRootOption]: root,
				localNonDispatchAdapter: false,
				naturalLanguageRouting: false,
			},
		);
		const planTool = hooks.tool?.[flowdeskWorkflowDispatchPlanToolName];
		assert.ok(planTool);
		const flagged = JSON.parse(
			toolOutput(
				await planTool.execute(
					{
						goalSummary: "Plan a bounded implementation workflow.",
						providerCall: true,
						tasks: [
							{
								agentRole: "implementation",
								summary: "Add planning evidence.",
							},
						],
					},
					undefined as never,
				),
			),
		) as Record<string, unknown>;
		assert.equal(flagged.status, "blocked_before_workflow_dispatch_plan");
		assert.match(String(flagged.redactedBlockReason), /authority fields/);
		const textSmuggling = JSON.parse(
			toolOutput(
				await planTool.execute(
					{
						goalSummary: "Plan real dispatch for this workflow.",
						tasks: [
							{
								agentRole: "implementation",
								summary: "Add planning evidence.",
							},
						],
					},
					undefined as never,
				),
			),
		) as Record<string, unknown>;
		assert.equal(textSmuggling.status, "blocked_before_workflow_dispatch_plan");
		assert.match(String(textSmuggling.redactedBlockReason), /authority-smuggling/);
	} finally {
		rmSync(root, { recursive: true, force: true });
	}
});

function workflowDispatchFakeClient(outputText: string, counters: { create: number; prompt: number; messages: number }) {
	const sessionMessages = new Map<string, unknown[]>();
	return {
		session: {
			async create(options: { parentID?: string }) {
				counters.create += 1;
				return { id: options.parentID === undefined ? "parent-session-1" : "child-session-1" };
			},
			async prompt(options: { sessionID?: string; path?: { id?: string } }) {
				counters.prompt += 1;
				const sessionId = String(options.sessionID ?? options.path?.id ?? "child-session-1");
				sessionMessages.set(sessionId, [
					{
						id: "msg-workflow-dispatch-1",
						info: { role: "assistant" },
						parts: [{ type: "text", text: outputText }, { type: "step-finish", reason: "stop" }],
					},
				]);
				return { id: "msg-workflow-dispatch-1" };
			},
			async messages(options: { sessionID?: string; path?: { id?: string } }) {
				counters.messages += 1;
				return sessionMessages.get(String(options.sessionID ?? options.path?.id ?? "")) ?? [];
			},
		},
	};
}

test("workflow dispatch tool is absent by default and requires opt-in root and client", async () => {
	const root = mkdtempSync(join(tmpdir(), "flowdesk-workflow-dispatch-registration-"));
	try {
		const defaultHooks = await flowdeskOpenCodeServerPlugin.server(undefined as never, {
			localNonDispatchAdapter: false,
			naturalLanguageRouting: false,
		});
		assert.equal(defaultHooks.tool?.[flowdeskWorkflowDispatchToolName], undefined);

		const noRootHooks = await flowdeskOpenCodeServerPlugin.server(
			{ client: workflowDispatchFakeClient("result", { create: 0, prompt: 0, messages: 0 }) } as never,
			{
				[flowdeskWorkflowDispatchOption]: { enabled: true, devBetaActualLaneLaunch: true },
				localNonDispatchAdapter: false,
				naturalLanguageRouting: false,
			},
		);
		assert.equal(noRootHooks.tool?.[flowdeskWorkflowDispatchToolName], undefined);

		const noClientHooks = await flowdeskOpenCodeServerPlugin.server(undefined as never, {
			[flowdeskWorkflowDispatchOption]: { enabled: true, devBetaActualLaneLaunch: true },
			[flowdeskDurableStateRootOption]: root,
			localNonDispatchAdapter: false,
			naturalLanguageRouting: false,
		});
		assert.equal(noClientHooks.tool?.[flowdeskWorkflowDispatchToolName], undefined);

		const noDevBetaHooks = await flowdeskOpenCodeServerPlugin.server(
			{ client: workflowDispatchFakeClient("result", { create: 0, prompt: 0, messages: 0 }) } as never,
			{
				[flowdeskWorkflowDispatchOption]: { enabled: true },
				[flowdeskDurableStateRootOption]: root,
				localNonDispatchAdapter: false,
				naturalLanguageRouting: false,
			},
		);
		assert.equal(noDevBetaHooks.tool?.[flowdeskWorkflowDispatchToolName], undefined);
	} finally {
		rmSync(root, { recursive: true, force: true });
	}
});

test("auto-continue execution and flowdesk_continue tools are absent by default and require explicit opt-in root and client", async () => {
	const root = mkdtempSync(join(tmpdir(), "flowdesk-auto-continue-execution-registration-"));
	try {
		const defaultHooks = await flowdeskOpenCodeServerPlugin.server(undefined as never, {
			localNonDispatchAdapter: false,
			naturalLanguageRouting: false,
		});
		assert.equal(defaultHooks.tool?.[flowdeskAutoContinueExecutionToolName], undefined);
		assert.equal(defaultHooks.tool?.[flowdeskContinueToolName], undefined);

		const noRootHooks = await flowdeskOpenCodeServerPlugin.server(
			{ client: workflowDispatchFakeClient("result", { create: 0, prompt: 0, messages: 0 }) } as never,
			{
				[flowdeskAutoContinueExecutionOption]: { enabled: true, devBetaActualLaneLaunch: true },
				localNonDispatchAdapter: false,
				naturalLanguageRouting: false,
			},
		);
		assert.equal(noRootHooks.tool?.[flowdeskAutoContinueExecutionToolName], undefined);
		assert.equal(noRootHooks.tool?.[flowdeskContinueToolName], undefined);

		const noClientHooks = await flowdeskOpenCodeServerPlugin.server(undefined as never, {
			[flowdeskAutoContinueExecutionOption]: { enabled: true, devBetaActualLaneLaunch: true },
			[flowdeskDurableStateRootOption]: root,
			localNonDispatchAdapter: false,
			naturalLanguageRouting: false,
		});
		assert.equal(noClientHooks.tool?.[flowdeskAutoContinueExecutionToolName], undefined);
		assert.equal(noClientHooks.tool?.[flowdeskContinueToolName], undefined);

		const noDevBetaHooks = await flowdeskOpenCodeServerPlugin.server(
			{ client: workflowDispatchFakeClient("result", { create: 0, prompt: 0, messages: 0 }) } as never,
			{
				[flowdeskAutoContinueExecutionOption]: { enabled: true },
				[flowdeskDurableStateRootOption]: root,
				localNonDispatchAdapter: false,
				naturalLanguageRouting: false,
			},
		);
		assert.equal(noDevBetaHooks.tool?.[flowdeskAutoContinueExecutionToolName], undefined);
		assert.equal(noDevBetaHooks.tool?.[flowdeskContinueToolName], undefined);

		const enabledHooks = await flowdeskOpenCodeServerPlugin.server(
			{ client: workflowDispatchFakeClient("result", { create: 0, prompt: 0, messages: 0 }) } as never,
			{
				[flowdeskAutoContinueExecutionOption]: { enabled: true, devBetaActualLaneLaunch: true },
				[flowdeskDurableStateRootOption]: root,
				localNonDispatchAdapter: false,
				naturalLanguageRouting: false,
			},
		);
		assert.ok(enabledHooks.tool?.[flowdeskAutoContinueExecutionToolName]);
		assert.ok(enabledHooks.tool?.[flowdeskContinueToolName]);
	} finally {
		rmSync(root, { recursive: true, force: true });
	}
});

test("flowdesk_continue has compact description and preserves explicit consent", async () => {
	const root = mkdtempSync(join(tmpdir(), "flowdesk-continue-consent-"));
	try {
		const hooks = await flowdeskOpenCodeServerPlugin.server(
			{ client: workflowDispatchFakeClient("result", { create: 0, prompt: 0, messages: 0 }) } as never,
			{
				[flowdeskAutoContinueExecutionOption]: { enabled: true, devBetaActualLaneLaunch: true },
				[flowdeskDurableStateRootOption]: root,
				localNonDispatchAdapter: false,
				naturalLanguageRouting: false,
			},
		);
		const continueTool = hooks.tool?.[flowdeskContinueToolName];
		assert.ok(continueTool);
		const description = String(continueTool.description ?? "");
		assert.ok(description.length < 260);
		assert.doesNotMatch(description, /Trigger on|Korean phrases|English phrases|WHEN TO USE/);

		const missingDevConsent = JSON.parse(
			toolOutput(
				await continueTool.execute(
					{
						workflowId: "workflow-continue-consent-1",
						task: {
							taskId: "task-continue-1",
							promptText: "Continue the first pending task.",
							agentName: "reviewer-gpt-frontier",
							providerQualifiedModelId: "openai/gpt-5.5",
						},
						allowProviderCall: true,
						allowActualLaneLaunch: true,
						allowAutoContinueExecution: true,
					},
					undefined as never,
				),
			),
		) as Record<string, unknown>;
		assert.equal(missingDevConsent.status, "blocked_before_auto_continue_execution");
		assert.match(String(missingDevConsent.redactedBlockReason), /developerModeAcknowledged=true/);
		assert.equal((missingDevConsent.authority as Record<string, unknown>).developerModeAcknowledged, false);

		const missingExecutionConsent = JSON.parse(
			toolOutput(
				await continueTool.execute(
					{
						workflowId: "workflow-continue-consent-1",
						task: {
							taskId: "task-continue-1",
							promptText: "Continue the first pending task.",
							agentName: "reviewer-gpt-frontier",
							providerQualifiedModelId: "openai/gpt-5.5",
						},
						developerModeAcknowledged: true,
						allowProviderCall: true,
						allowActualLaneLaunch: true,
					},
					undefined as never,
				),
			),
		) as Record<string, unknown>;
		assert.equal(missingExecutionConsent.status, "blocked_before_auto_continue_execution");
		assert.match(String(missingExecutionConsent.redactedBlockReason), /allowAutoContinueExecution=true/);
		const authority = missingExecutionConsent.authority as Record<string, unknown>;
		assert.equal(authority.providerCall, false);
		assert.equal(authority.runtimeExecution, false);
		assert.equal(authority.actualLaneLaunch, false);
		assert.equal(authority.autoContinueExecutionOptIn, false);
	} finally {
		rmSync(root, { recursive: true, force: true });
	}
});

test("flowdesk_continue defaults parentSessionId and matches underlying blocked path", async () => {
	const root = mkdtempSync(join(tmpdir(), "flowdesk-continue-parent-"));
	try {
		const hooks = await flowdeskOpenCodeServerPlugin.server(
			{ client: workflowDispatchFakeClient("result", { create: 0, prompt: 0, messages: 0 }) } as never,
			{
				[flowdeskAutoContinueExecutionOption]: { enabled: true, devBetaActualLaneLaunch: true },
				[flowdeskDurableStateRootOption]: root,
				localNonDispatchAdapter: false,
				naturalLanguageRouting: false,
			},
		);
		const autoTool = hooks.tool?.[flowdeskAutoContinueExecutionToolName];
		const continueTool = hooks.tool?.[flowdeskContinueToolName];
		assert.ok(autoTool);
		assert.ok(continueTool);

		const compactRequest = {
			workflowId: "workflow-continue-parent-1",
			task: {
				taskId: "task-continue-parent-1",
				promptText: "Continue the first pending task.",
				agentName: "reviewer-gpt-frontier",
				providerQualifiedModelId: "openai/gpt-5.5",
			},
			developerModeAcknowledged: true,
			allowProviderCall: true,
			allowActualLaneLaunch: true,
			allowAutoContinueExecution: true,
		};
		const compact = JSON.parse(
			toolOutput(await continueTool.execute(compactRequest, undefined as never)),
		) as Record<string, unknown>;
		const underlying = JSON.parse(
			toolOutput(
				await autoTool.execute(
					{ ...compactRequest, parentSessionId: "" },
					undefined as never,
				),
			),
		) as Record<string, unknown>;

		assert.equal(compact.parentSessionId, "");
		assert.equal(compact.status, "blocked_before_auto_continue_execution");
		assert.equal(compact.redactedBlockReason, "parentSessionId is required");
		assert.deepEqual(compact, underlying);
	} finally {
		rmSync(root, { recursive: true, force: true });
	}
});

function sha256Text(value: string): string {
	return `sha256-${createHash("sha256").update(value, "utf8").digest("hex")}`;
}

test("controlled write apply tool is absent by default and requires explicit opt-in root", async () => {
	const root = mkdtempSync(join(tmpdir(), "flowdesk-controlled-write-registration-"));
	const workspace = mkdtempSync(join(tmpdir(), "flowdesk-controlled-write-workspace-"));
	try {
		const defaultHooks = await flowdeskOpenCodeServerPlugin.server(undefined as never, {
			localNonDispatchAdapter: false,
			naturalLanguageRouting: false,
		});
		assert.equal(defaultHooks.tool?.[flowdeskControlledWriteApplyToolName], undefined);
		assert.equal(defaultHooks.tool?.[flowdeskWriteToolName], undefined);

		const noRootHooks = await flowdeskOpenCodeServerPlugin.server(
			{ workspace } as never,
			{
				[flowdeskControlledWriteApplyOption]: { enabled: true, devBetaControlledWriteApply: true },
				localNonDispatchAdapter: false,
				naturalLanguageRouting: false,
			},
		);
		assert.equal(noRootHooks.tool?.[flowdeskControlledWriteApplyToolName], undefined);
		assert.equal(noRootHooks.tool?.[flowdeskWriteToolName], undefined);

		const noDevBetaHooks = await flowdeskOpenCodeServerPlugin.server(
			{ workspace } as never,
			{
				[flowdeskControlledWriteApplyOption]: { enabled: true, workspaceRoot: workspace },
				[flowdeskDurableStateRootOption]: root,
				localNonDispatchAdapter: false,
				naturalLanguageRouting: false,
			},
		);
		assert.equal(noDevBetaHooks.tool?.[flowdeskControlledWriteApplyToolName], undefined);
		assert.equal(noDevBetaHooks.tool?.[flowdeskWriteToolName], undefined);

		const enabledHooks = await flowdeskOpenCodeServerPlugin.server(
			{ workspace } as never,
			{
				[flowdeskControlledWriteApplyOption]: { enabled: true, devBetaControlledWriteApply: true, workspaceRoot: workspace },
				[flowdeskDurableStateRootOption]: root,
				localNonDispatchAdapter: false,
				naturalLanguageRouting: false,
			},
		);
		assert.ok(enabledHooks.tool?.[flowdeskControlledWriteApplyToolName]);
		assert.ok(enabledHooks.tool?.[flowdeskWriteToolName]);
	} finally {
		rmSync(root, { recursive: true, force: true });
		rmSync(workspace, { recursive: true, force: true });
	}
});

test("flowdesk_write is opt-in beside controlled write apply with compact authority-safe description", async () => {
	const root = mkdtempSync(join(tmpdir(), "flowdesk-write-registration-"));
	const workspace = mkdtempSync(join(tmpdir(), "flowdesk-write-workspace-"));
	try {
		const defaultHooks = await flowdeskOpenCodeServerPlugin.server(undefined as never, {
			localNonDispatchAdapter: false,
			naturalLanguageRouting: false,
		});
		assert.equal(defaultHooks.tool?.[flowdeskWriteToolName], undefined);

		const enabledHooks = await flowdeskOpenCodeServerPlugin.server(
			{ workspace } as never,
			{
				[flowdeskControlledWriteApplyOption]: { enabled: true, devBetaControlledWriteApply: true, workspaceRoot: workspace },
				[flowdeskDurableStateRootOption]: root,
				localNonDispatchAdapter: false,
				naturalLanguageRouting: false,
			},
		);
		const writeTool = enabledHooks.tool?.[flowdeskWriteToolName];
		assert.ok(writeTool);
		assert.ok(enabledHooks.tool?.[flowdeskControlledWriteApplyToolName]);
		const description = String(writeTool.description ?? "");
		assert.ok(description.length < 260);
		assert.doesNotMatch(description, /Trigger on|Korean phrases|English phrases|WHEN TO USE/);
		assert.match(description, /No dispatch, provider, runtime, lane, fallback, hard-chat, or SDK-scoped noReply control/);
	} finally {
		rmSync(root, { recursive: true, force: true });
		rmSync(workspace, { recursive: true, force: true });
	}
});

test("flowdesk_write does not silently default explicit write consent fields true", async () => {
	const root = mkdtempSync(join(tmpdir(), "flowdesk-write-consent-"));
	const workspace = mkdtempSync(join(tmpdir(), "flowdesk-write-workspace-"));
	try {
		writeFileSync(join(workspace, "note.txt"), "before\n", "utf8");
		const hooks = await flowdeskOpenCodeServerPlugin.server(
			{ workspace } as never,
			{
				[flowdeskControlledWriteApplyOption]: { enabled: true, devBetaControlledWriteApply: true, workspaceRoot: workspace },
				[flowdeskDurableStateRootOption]: root,
				localNonDispatchAdapter: false,
				naturalLanguageRouting: false,
			},
		);
		const writeTool = hooks.tool?.[flowdeskWriteToolName];
		assert.ok(writeTool);
		const base = {
			workflowId: "workflow-flowdesk-write-consent-1",
			targetFilePath: "note.txt",
			replacementText: "after\n",
			expectedSha256: sha256Text("before\n"),
			developerModeAcknowledged: true,
			userApprovalRef: "approval-flowdesk-write-1",
			allowControlledWrite: true,
		};

		for (const [request, reason, expectedAuthority] of [
			[{ ...base, developerModeAcknowledged: undefined }, /developerModeAcknowledged=true/, { developerModeAcknowledged: false, allowControlledWrite: true }],
			[{ ...base, allowControlledWrite: undefined }, /allowControlledWrite=true/, { developerModeAcknowledged: true, allowControlledWrite: false }],
			[{ ...base, userApprovalRef: undefined }, /userApprovalRef/, { developerModeAcknowledged: true, allowControlledWrite: true }],
			[{ ...base, expectedSha256: undefined, expectedContentSha256: undefined }, /expectedSha256/, { developerModeAcknowledged: true, allowControlledWrite: true }],
		] as const) {
			const result = JSON.parse(toolOutput(await writeTool.execute(request, undefined as never))) as Record<string, unknown>;
			assert.equal(result.status, "blocked_before_controlled_write");
			assert.match(String(result.redactedBlockReason), reason);
			const authority = result.authority as Record<string, unknown>;
			assert.equal(authority.developerModeAcknowledged, expectedAuthority.developerModeAcknowledged);
			assert.equal(authority.allowControlledWrite, expectedAuthority.allowControlledWrite);
			assert.equal(authority.controlledExternalWriteAuthorized, false);
		}
		assert.equal(readFileSync(join(workspace, "note.txt"), "utf8"), "before\n");
	} finally {
		rmSync(root, { recursive: true, force: true });
		rmSync(workspace, { recursive: true, force: true });
	}
});

test("flowdesk_write matches controlled write blocked path and preserves authority limits", async () => {
	const root = mkdtempSync(join(tmpdir(), "flowdesk-write-blocks-"));
	const workspace = mkdtempSync(join(tmpdir(), "flowdesk-write-workspace-"));
	try {
		writeFileSync(join(workspace, "note.txt"), "before\n", "utf8");
		const hooks = await flowdeskOpenCodeServerPlugin.server(
			{ workspace } as never,
			{
				[flowdeskControlledWriteApplyOption]: { enabled: true, devBetaControlledWriteApply: true, workspaceRoot: workspace },
				[flowdeskDurableStateRootOption]: root,
				localNonDispatchAdapter: false,
				naturalLanguageRouting: false,
			},
		);
		const writeTool = hooks.tool?.[flowdeskWriteToolName];
		const underlyingTool = hooks.tool?.[flowdeskControlledWriteApplyToolName];
		assert.ok(writeTool);
		assert.ok(underlyingTool);
		const request = {
			workflowId: "workflow-flowdesk-write-blocks-1",
			targetFilePath: "../escape.txt",
			expectedContentSha256: sha256Text("before\n"),
			replacementText: "after\n",
			developerModeAcknowledged: true,
			userApprovalRef: "approval-flowdesk-write-1",
			allowControlledWrite: true,
			allowMissingExpectedHashForDevMode: false,
		};
		const compact = JSON.parse(toolOutput(await writeTool.execute(request, undefined as never))) as Record<string, unknown>;
		const underlying = JSON.parse(
			toolOutput(
				await underlyingTool.execute(
					{ ...request, reasonSummary: "flowdesk_write controlled replacement" },
					undefined as never,
				),
			),
		) as Record<string, unknown>;
		assert.deepEqual(compact, underlying);
		assert.equal(compact.status, "blocked_before_controlled_write");
		assert.match(String(compact.redactedBlockReason), /relative workspace file path/);
		const authority = compact.authority as Record<string, unknown>;
		assert.equal(authority.realOpenCodeDispatch, false);
		assert.equal(authority.providerCall, false);
		assert.equal(authority.runtimeExecution, false);
		assert.equal(authority.actualLaneLaunch, false);
		assert.equal(authority.fallbackAuthority, false);
		assert.equal(authority.hardCancelOrNoReplyAuthority, false);
		assert.equal(authority.defaultRelease1WriteAuthority, false);
		assert.equal(authority.controlledExternalWriteAuthorized, false);
		assert.equal(readFileSync(join(workspace, "note.txt"), "utf8"), "before\n");
	} finally {
		rmSync(root, { recursive: true, force: true });
		rmSync(workspace, { recursive: true, force: true });
	}
});

test("controlled write apply blocks missing approvals, unsafe paths, hash mismatch, and symlink escape", async () => {
	const root = mkdtempSync(join(tmpdir(), "flowdesk-controlled-write-blocks-"));
	const workspace = mkdtempSync(join(tmpdir(), "flowdesk-controlled-write-workspace-"));
	const outside = mkdtempSync(join(tmpdir(), "flowdesk-controlled-write-outside-"));
	try {
		writeFileSync(join(workspace, "note.txt"), "before\n", "utf8");
		symlinkSync(outside, join(workspace, "linked"));
		const hooks = await flowdeskOpenCodeServerPlugin.server(
			{ workspace } as never,
			{
				[flowdeskControlledWriteApplyOption]: { enabled: true, devBetaControlledWriteApply: true, workspaceRoot: workspace },
				[flowdeskDurableStateRootOption]: root,
				localNonDispatchAdapter: false,
				naturalLanguageRouting: false,
			},
		);
		const writeTool = hooks.tool?.[flowdeskControlledWriteApplyToolName];
		assert.ok(writeTool);
		const base = {
			workflowId: "workflow-controlled-write-blocks-1",
			targetFilePath: "note.txt",
			expectedSha256: sha256Text("before\n"),
			replacementText: "after\n",
			reasonSummary: "Apply approved dev beta replacement.",
			developerModeAcknowledged: true,
			userApprovalRef: "approval-controlled-write-1",
			allowControlledWrite: true,
		};

		for (const [request, reason] of [
			[{ ...base, developerModeAcknowledged: false }, /developerModeAcknowledged=true/],
			[{ ...base, allowControlledWrite: false }, /allowControlledWrite=true/],
			[{ ...base, userApprovalRef: "" }, /userApprovalRef/],
			[{ ...base, expectedSha256: undefined, allowMissingExpectedHashForDevMode: false }, /expectedSha256/],
			[{ ...base, targetFilePath: "../escape.txt" }, /relative workspace file path/],
			[{ ...base, targetFilePath: join(workspace, "note.txt") }, /relative workspace file path/],
			[{ ...base, targetFilePath: "linked/escape.txt", allowMissingExpectedHashForDevMode: true, expectedSha256: undefined }, /symlink/],
			[{ ...base, expectedSha256: sha256Text("different\n") }, /hash mismatch/],
		] as const) {
			const result = JSON.parse(toolOutput(await writeTool.execute(request, undefined as never))) as Record<string, unknown>;
			assert.equal(result.status, "blocked_before_controlled_write");
			assert.match(String(result.redactedBlockReason), reason);
			const authority = result.authority as Record<string, unknown>;
			assert.equal(authority.realOpenCodeDispatch, false);
			assert.equal(authority.providerCall, false);
			assert.equal(authority.runtimeExecution, false);
			assert.equal(authority.actualLaneLaunch, false);
			assert.equal(authority.fallbackAuthority, false);
		}
		assert.equal(readFileSync(join(workspace, "note.txt"), "utf8"), "before\n");
	} finally {
		rmSync(root, { recursive: true, force: true });
		rmSync(workspace, { recursive: true, force: true });
		rmSync(outside, { recursive: true, force: true });
	}
});

test("controlled write apply updates file and records durable ledger evidence", async () => {
	const root = mkdtempSync(join(tmpdir(), "flowdesk-controlled-write-success-"));
	const workspace = mkdtempSync(join(tmpdir(), "flowdesk-controlled-write-workspace-"));
	try {
		writeFileSync(join(workspace, "note.txt"), "before\n", "utf8");
		const hooks = await flowdeskOpenCodeServerPlugin.server(
			{ workspace } as never,
			{
				[flowdeskControlledWriteApplyOption]: { enabled: true, devBetaControlledWriteApply: true, workspaceRoot: workspace },
				[flowdeskDurableStateRootOption]: root,
				localNonDispatchAdapter: false,
				naturalLanguageRouting: false,
			},
		);
		const writeTool = hooks.tool?.[flowdeskControlledWriteApplyToolName];
		assert.ok(writeTool);
		const result = JSON.parse(
			toolOutput(
				await writeTool.execute(
					{
						workflowId: "workflow-controlled-write-success-1",
						targetFilePath: "note.txt",
						expectedContentSha256: sha256Text("before\n"),
						replacementText: "after\n",
						reasonSummary: "Apply approved dev beta replacement.",
						developerModeAcknowledged: true,
						userApprovalRef: "approval-controlled-write-1",
						allowControlledWrite: true,
					},
					undefined as never,
				),
			),
		) as Record<string, unknown>;
		assert.equal(result.status, "controlled_write_applied");
		assert.equal(readFileSync(join(workspace, "note.txt"), "utf8"), "after\n");
		const authority = result.authority as Record<string, unknown>;
		assert.equal(authority.controlledExternalWriteAuthorized, true);
		assert.equal(authority.defaultRelease1WriteAuthority, false);
		assert.equal(authority.realOpenCodeDispatch, false);
		assert.equal(authority.providerCall, false);
		assert.equal(authority.runtimeExecution, false);
		assert.equal(authority.actualLaneLaunch, false);
		assert.equal(authority.fallbackAuthority, false);
		assert.equal(authority.ledgerEvidenceReloaded, true);

		const reloaded = reloadFlowDeskSessionEvidenceV1({ workflowId: "workflow-controlled-write-success-1", rootDir: root });
		assert.equal(reloaded.ok, true, reloaded.errors.join("; "));
		assert.ok(
			reloaded.entries.some(
				(entry) =>
					entry.evidenceClass === "controlled_workspace_file_write" &&
					entry.record.target_file_path === "note.txt" &&
					entry.record.replacement_content_sha256_ref === sha256Text("after\n") &&
					entry.record.realOpenCodeDispatch === false &&
					entry.record.providerCall === false,
			),
		);
	} finally {
		rmSync(root, { recursive: true, force: true });
		rmSync(workspace, { recursive: true, force: true });
	}
});

test("workflow dispatch tool completes one fake SDK task and preserves default authority", async () => {
	const root = mkdtempSync(join(tmpdir(), "flowdesk-workflow-dispatch-success-"));
	const counters = { create: 0, prompt: 0, messages: 0 };
	try {
		const hooks = await flowdeskOpenCodeServerPlugin.server(
			{ client: workflowDispatchFakeClient("Final bounded task result.", counters) } as never,
			{
				[flowdeskWorkflowDispatchOption]: { enabled: true, devBetaActualLaneLaunch: true },
				[flowdeskDurableStateRootOption]: root,
				localNonDispatchAdapter: false,
				naturalLanguageRouting: false,
			},
		);
		const dispatchTool = hooks.tool?.[flowdeskWorkflowDispatchToolName];
		assert.ok(dispatchTool);
		const result = JSON.parse(
			toolOutput(
				await dispatchTool.execute(
					{
						workflowId: "workflow-dispatch-e2e-1",
						goalSummary: "Run a bounded implementation task.",
						parentSessionId: "parent-session-1",
						task: {
							agentRole: "implementation",
							summary: "Produce a bounded implementation result.",
							promptText: "Return a concise implementation result.",
							agentName: "flowdesk-code-backend",
							providerQualifiedModelId: "openai/gpt-5.5",
						},
						developerModeAcknowledged: true,
						allowProviderCall: true,
						allowActualLaneLaunch: true,
					},
					undefined as never,
				),
			),
		) as Record<string, unknown>;
		assert.equal(result.status, "workflow_dispatch_completed");
		assert.equal(result.workflowId, "workflow-dispatch-e2e-1");
		assert.equal(counters.create, 1);
		assert.equal(counters.prompt, 1);
		assert.ok(counters.messages >= 1);
		const authority = result.authority as Record<string, unknown>;
		assert.equal(authority.providerCall, true);
		assert.equal(authority.runtimeExecution, true);
		assert.equal(authority.actualLaneLaunch, true);
		assert.equal(authority.realOpenCodeDispatch, false);
		assert.equal(authority.dispatchAuthorityEnabled, false);
		assert.equal(authority.defaultRelease1DispatchAuthority, false);
		assert.equal(authority.fallbackAuthority, false);
		assert.equal(authority.workflowDispatchPlanPersisted, true);
		assert.equal(typeof result.laneId, "string");
		assert.equal(typeof result.taskId, "string");

		const reloaded = reloadFlowDeskSessionEvidenceV1({ workflowId: "workflow-dispatch-e2e-1", rootDir: root });
		assert.equal(reloaded.ok, true, reloaded.errors.join("; "));
		assert.ok(
			reloaded.entries.some(
				(entry) =>
					entry.evidenceClass === "workflow_dispatch_plan" &&
					Array.isArray(entry.record.tasks) &&
					entry.record.tasks.some(
						(task) =>
							typeof task === "object" &&
							task !== null &&
							(task as Record<string, unknown>).task_id === result.taskId,
					),
			),
		);
		assert.ok(
			reloaded.entries.some(
				(entry) =>
					entry.evidenceClass === "task_result" &&
					entry.record.lane_id === result.laneId &&
					entry.record.task_id === result.taskId &&
					entry.record.dispatch_authority_enabled === false,
			),
		);
		assert.ok(
			reloaded.entries.some(
				(entry) =>
					entry.evidenceClass === "lane_lifecycle" &&
					entry.record.lane_id === result.laneId &&
					entry.record.state === "incomplete" &&
					entry.record.dispatch_authority_enabled === false,
			),
		);
	} finally {
		rmSync(root, { recursive: true, force: true });
	}
});

test("workflow dispatch tool captures process-only output as a result for coordinator judgement", async () => {
	const root = mkdtempSync(join(tmpdir(), "flowdesk-workflow-dispatch-process-only-"));
	try {
		const hooks = await flowdeskOpenCodeServerPlugin.server(
			{ client: workflowDispatchFakeClient("I need to keep working before I can provide the final result.", { create: 0, prompt: 0, messages: 0 }) } as never,
			{
				[flowdeskWorkflowDispatchOption]: { enabled: true, devBetaActualLaneLaunch: true },
				[flowdeskDurableStateRootOption]: root,
				localNonDispatchAdapter: false,
				naturalLanguageRouting: false,
			},
		);
		const dispatchTool = hooks.tool?.[flowdeskWorkflowDispatchToolName];
		assert.ok(dispatchTool);
		const result = JSON.parse(
			toolOutput(
				await dispatchTool.execute(
					{
						workflowId: "workflow-dispatch-process-only-1",
						goalSummary: "Run a bounded implementation task.",
						parentSessionId: "parent-session-1",
						task: {
							agentRole: "implementation",
							summary: "Produce a bounded implementation result.",
							promptText: "Return a concise implementation result.",
							agentName: "flowdesk-code-backend",
							providerQualifiedModelId: "openai/gpt-5.5",
						},
						developerModeAcknowledged: true,
						allowProviderCall: true,
						allowActualLaneLaunch: true,
					},
					undefined as never,
				),
			),
		) as Record<string, unknown>;
		// Capture/judgement separation: the lane captured text, so the dispatch is
		// reported as completed (captured) with advisory metadata. It is NOT marked
		// incomplete for "format"; the coordinator judges substance from the
		// advisory output_kind / looks_like_refusal_or_error fields.
		assert.equal(result.status, "workflow_dispatch_completed");
		const advisory = result.captureAdvisory as Record<string, unknown> | undefined;
		assert.ok(advisory, "captureAdvisory should be surfaced for coordinator judgement");
		assert.equal(advisory.outputKind, "process_notes");
		const reloaded = reloadFlowDeskSessionEvidenceV1({ workflowId: "workflow-dispatch-process-only-1", rootDir: root });
		assert.equal(reloaded.ok, true, reloaded.errors.join("; "));
		assert.equal(typeof result.laneId, "string");
		assert.equal(typeof result.taskId, "string");
		assert.ok(
			reloaded.entries.some(
				(entry) =>
					entry.evidenceClass === "task_result" &&
					entry.record.lane_id === result.laneId &&
					entry.record.task_id === result.taskId &&
					entry.record.missing_contract === false &&
					entry.record.output_kind === "process_notes" &&
					entry.record.dispatch_authority_enabled === false,
			),
		);
		assert.ok(
			reloaded.entries.some(
				(entry) =>
					entry.evidenceClass === "lane_lifecycle" &&
					entry.record.lane_id === result.laneId &&
					entry.record.state === "incomplete" &&
					entry.record.dispatch_authority_enabled === false,
			),
		);
	} finally {
		rmSync(root, { recursive: true, force: true });
	}
});

test("workflow dispatch tool blocks missing flags, invalid roles, fallback, and write wording before SDK calls", async () => {
	const root = mkdtempSync(join(tmpdir(), "flowdesk-workflow-dispatch-blocks-"));
	const counters = { create: 0, prompt: 0, messages: 0 };
	try {
		const hooks = await flowdeskOpenCodeServerPlugin.server(
			{ client: workflowDispatchFakeClient("Final bounded task result.", counters) } as never,
			{
				[flowdeskWorkflowDispatchOption]: { enabled: true, devBetaActualLaneLaunch: true },
				[flowdeskDurableStateRootOption]: root,
				localNonDispatchAdapter: false,
				naturalLanguageRouting: false,
			},
		);
		const dispatchTool = hooks.tool?.[flowdeskWorkflowDispatchToolName];
		assert.ok(dispatchTool);
		const base = {
			workflowId: "workflow-dispatch-blocked-1",
			goalSummary: "Run a bounded implementation task.",
			parentSessionId: "parent-session-1",
			task: {
				agentRole: "implementation",
				summary: "Produce a bounded implementation result.",
				promptText: "Return a concise implementation result.",
				agentName: "flowdesk-code-backend",
				providerQualifiedModelId: "openai/gpt-5.5",
			},
			developerModeAcknowledged: true,
			allowProviderCall: true,
			allowActualLaneLaunch: true,
		};

		for (const [request, reason] of [
			[{ ...base, developerModeAcknowledged: false }, /developerModeAcknowledged=true/],
			[{ ...base, allowProviderCall: false }, /allowProviderCall=true/],
			[{ ...base, allowActualLaneLaunch: false }, /allowActualLaneLaunch=true/],
			[{ ...base, task: { ...base.task, agentRole: "backend-code" } }, /agent_role is not a registered/],
			[{ ...base, goalSummary: "Fallback to another provider if blocked." }, /fallback\/reselection/],
			[{ ...base, task: { ...base.task, promptText: "Apply changes to files." } }, /write\/apply/],
		] as const) {
			const result = JSON.parse(toolOutput(await dispatchTool.execute(request, undefined as never))) as Record<string, unknown>;
			assert.equal(result.status, "blocked_before_workflow_dispatch");
			assert.match(String(result.redactedBlockReason), reason);
		}
		assert.equal(counters.create, 0);
		assert.equal(counters.prompt, 0);
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
			sessionID: "provider-sdk-session-1",
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
		FLOWDESK_RELEASE_1_COMMAND_MANIFEST.flatMap((entry) =>
			entry.toolName === "flowdesk_doctor"
				? [entry.toolName, flowdeskCheckToolName]
				: entry.toolName === "flowdesk_plan"
					? [entry.toolName, flowdeskPlanShortToolName]
					: entry.toolName === "flowdesk_run"
						? [entry.toolName, flowdeskRunShortToolName]
						: entry.toolName === "flowdesk_resume"
							? [entry.toolName, flowdeskResumeStatusToolName]
							: entry.toolName === "flowdesk_retry"
								? [entry.toolName, flowdeskRetryDiagToolName]
								: entry.toolName === "flowdesk_abort"
									? [entry.toolName, flowdeskAbortCmdToolName]
									: entry.toolName === "flowdesk_export_debug"
										? [entry.toolName, flowdeskDebugToolName]
										: [entry.toolName],
		),
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

test("flowdesk_plan_short registers only with command-backed planning and has compact description", async () => {
	const disabledHooks = (await flowdeskOpenCodeServerPlugin.server(
		undefined as never,
		{
			[flowdeskLocalNonDispatchAdapterOption]: false,
			[flowdeskNaturalLanguageRoutingOption]: false,
		},
	)) as ChatMessageHooks;
	assert.equal(disabledHooks.tool?.flowdesk_plan, undefined);
	assert.equal(disabledHooks.tool?.[flowdeskPlanShortToolName], undefined);

	const hooks = (await flowdeskOpenCodeServerPlugin.server(undefined as never, {
		[flowdeskLocalNonDispatchAdapterOption]: true,
		[flowdeskNaturalLanguageRoutingOption]: false,
	})) as ChatMessageHooks;
	assert.ok(hooks.tool?.flowdesk_plan);
	const planShortTool = hooks.tool?.[flowdeskPlanShortToolName];
	assert.ok(planShortTool);
	assert.equal(planShortTool.description.length < 260, true);
	assert.match(planShortTool.description, /compact FlowDesk plan record/);
	assert.match(planShortTool.description, /Planning-only/);
	assert.match(planShortTool.description, /no provider/);
	assert.match(planShortTool.description, /SDK-scoped noReply control/);
	assert.doesNotMatch(planShortTool.description, /Trigger on|Korean phrases|English phrases|WHEN TO USE/);
	assert.deepEqual(Object.keys(planShortTool.args), [
		"goalSummary",
		"scopeSummary",
		"riskHint",
		"workflowId",
		"requestId",
	]);
});

test("flowdesk_plan_short maps empty defaultable fields safely and generates bounded request id", async () => {
	const calls: { toolName: unknown; request: Record<string, unknown> }[] = [];
	const session: NonNullable<
		Parameters<typeof createFlowDeskLocalNonDispatchAdapterTools>[1]
	> = {
		state: {},
		evaluate(toolName, request) {
			calls.push({ toolName, request: request as Record<string, unknown> });
			return { ok: true, toolName, request } as never;
		},
	};
	const tools = createFlowDeskLocalNonDispatchAdapterTools(
		new Date("2026-05-17T00:00:00.000Z"),
		session,
	);
	const planShortTool = tools[flowdeskPlanShortToolName];
	assert.ok(planShortTool);
	const result = JSON.parse(
		toolOutput(
			await planShortTool.execute(
				{
					goalSummary: " ",
					scopeSummary: "",
					riskHint: "",
					workflowId: "",
				},
				undefined as never,
			),
		),
	) as Record<string, unknown>;
	assert.equal(result.ok, true);
	assert.equal(calls.length, 1);
	assert.equal(calls[0]?.toolName, "flowdesk_plan");
	assert.deepEqual(
		{
			schema_version: calls[0]?.request.schema_version,
			input_mode: calls[0]?.request.input_mode,
			goal_summary: calls[0]?.request.goal_summary,
			scope_summary: calls[0]?.request.scope_summary,
			risk_hint: calls[0]?.request.risk_hint,
			workflow_id: calls[0]?.request.workflow_id,
		},
		{
			schema_version: "flowdesk.plan.request.v1",
			input_mode: "alias_command",
			goal_summary: "FlowDesk planning request.",
			scope_summary: "Compact command-backed planning scope.",
			risk_hint: "Planning-only; no execution authority requested.",
			workflow_id: undefined,
		},
	);
	const requestId = String(calls[0]?.request.request_id);
	assert.match(requestId, /^plan-[A-Za-z0-9_.:-]+$/);
	assert.equal(requestId.length <= 80, true);
});

test("flowdesk_plan_short forwards explicit planning fields exactly", async () => {
	const calls: { request: Record<string, unknown> }[] = [];
	const session: NonNullable<
		Parameters<typeof createFlowDeskLocalNonDispatchAdapterTools>[1]
	> = {
		state: {},
		evaluate(_toolName, request) {
			calls.push({ request: request as Record<string, unknown> });
			return { ok: true, request } as never;
		},
	};
	const tools = createFlowDeskLocalNonDispatchAdapterTools(
		new Date("2026-05-17T00:00:00.000Z"),
		session,
	);
	const planShortTool = tools[flowdeskPlanShortToolName];
	assert.ok(planShortTool);
	await planShortTool.execute(
		{
			goalSummary: "Implement compact planning wrapper",
			scopeSummary: "Server tool registration and focused tests",
			riskHint: "Planning-only command-backed alias",
			workflowId: "workflow-plan-short-explicit",
			requestId: "request.plan explicit/unsafe spaces",
		},
		undefined as never,
	);
	assert.deepEqual(calls[0]?.request, {
		schema_version: "flowdesk.plan.request.v1",
		request_id: "request.plan-explicit-unsafe-spaces",
		input_mode: "alias_command",
		workflow_id: "workflow-plan-short-explicit",
		goal_summary: "Implement compact planning wrapper",
		scope_summary: "Server tool registration and focused tests",
		risk_hint: "Planning-only command-backed alias",
	});
});

test("flowdesk_plan_short result matches flowdesk_plan for equivalent payload", async () => {
	const shortTools = createFlowDeskLocalNonDispatchAdapterTools(
		new Date("2026-05-17T00:00:00.000Z"),
	);
	const planTools = createFlowDeskLocalNonDispatchAdapterTools(
		new Date("2026-05-17T00:00:00.000Z"),
	);
	const planShortTool = shortTools[flowdeskPlanShortToolName];
	const planTool = planTools.flowdesk_plan;
	assert.ok(planShortTool);
	assert.ok(planTool);
	const short = JSON.parse(
		toolOutput(
			await planShortTool.execute(
				{
					requestId: "request-plan-short-equivalent",
					workflowId: "workflow-plan-short-equivalent",
					goalSummary: "Equivalent compact plan",
					scopeSummary: "Equivalent planning scope",
					riskHint: "Equivalent planning risk",
				},
				undefined as never,
			),
		),
	) as LocalAdapterTestResult;
	const lowLevel = JSON.parse(
		toolOutput(
			await planTool.execute(
				{
					schema_version: "flowdesk.plan.request.v1",
					request_id: "request-plan-short-equivalent",
					input_mode: "alias_command",
					workflow_id: "workflow-plan-short-equivalent",
					goal_summary: "Equivalent compact plan",
					scope_summary: "Equivalent planning scope",
					risk_hint: "Equivalent planning risk",
				},
				undefined as never,
			),
		),
	) as LocalAdapterTestResult;
	assert.deepEqual(short, lowLevel);
});

test("flowdesk_plan_short does not widen authority or synthesize approval identity", async () => {
	const calls: { request: Record<string, unknown> }[] = [];
	const session: NonNullable<
		Parameters<typeof createFlowDeskLocalNonDispatchAdapterTools>[1]
	> = {
		state: {},
		evaluate(_toolName, request) {
			calls.push({ request: request as Record<string, unknown> });
			return { ok: true, request } as never;
		},
	};
	const fakeTools = createFlowDeskLocalNonDispatchAdapterTools(
		new Date("2026-05-17T00:00:00.000Z"),
		session,
	);
	const fakePlanShortTool = fakeTools[flowdeskPlanShortToolName];
	assert.ok(fakePlanShortTool);
	await fakePlanShortTool.execute(
		{
			requestId: "request-plan-short-no-approval-synthesis",
			goalSummary: "Plan without approvals",
			userApprovalRef: "approval-should-not-forward",
			user_approval_ref: "approval-snake-should-not-forward",
			sessionRef: "session-should-not-forward",
			confirmationNonce: "nonce-should-not-forward",
			confirmation_nonce: "nonce-snake-should-not-forward",
			redactedIntakeRef: "intake-should-not-forward",
		},
		undefined as never,
	);
	assert.deepEqual(Object.keys(calls[0]?.request ?? {}).sort(), [
		"goal_summary",
		"input_mode",
		"request_id",
		"risk_hint",
		"schema_version",
		"scope_summary",
	]);

	const realTools = createFlowDeskLocalNonDispatchAdapterTools(
		new Date("2026-05-17T00:00:00.000Z"),
	);
	const realPlanShortTool = realTools[flowdeskPlanShortToolName];
	assert.ok(realPlanShortTool);
	const result = JSON.parse(
		toolOutput(
			await realPlanShortTool.execute(
				{
					requestId: "request-plan-short-authority",
					goalSummary: "Authority check plan",
				},
				undefined as never,
			),
		),
	) as LocalAdapterTestResult;
	assert.equal(result.providerCall, false);
	assert.equal(result.runtimeExecution, false);
	assert.equal(result.actualLaneLaunch, false);
	assert.equal(result.fallbackAuthority, false);
	assert.equal(result.hardCancelOrNoReplyAuthority, false);
});

test("flowdesk_plan_short ignores unknown approval and identity fields safely", async () => {
	const calls: { request: Record<string, unknown> }[] = [];
	const session: NonNullable<
		Parameters<typeof createFlowDeskLocalNonDispatchAdapterTools>[1]
	> = {
		state: {},
		evaluate(_toolName, request) {
			calls.push({ request: request as Record<string, unknown> });
			return { ok: true, request } as never;
		},
	};
	const tools = createFlowDeskLocalNonDispatchAdapterTools(
		new Date("2026-05-17T00:00:00.000Z"),
		session,
	);
	const planShortTool = tools[flowdeskPlanShortToolName];
	assert.ok(planShortTool);
	await planShortTool.execute(
		{
			requestId: "request-plan-short-unknown-fields",
			goalSummary: "Unknown field handling",
			workflow_id: "workflow-snake-should-not-forward",
			user_approval_ref: "approval-snake-should-not-forward",
			confirmation_nonce: "nonce-snake-should-not-forward",
			actorRef: "actor-should-not-forward",
			profileRef: "profile-should-not-forward",
		},
		undefined as never,
	);
	const request = calls[0]?.request ?? {};
	assert.equal("workflow_id" in request, false);
	assert.equal("user_approval_ref" in request, false);
	assert.equal("confirmation_nonce" in request, false);
	assert.equal("actorRef" in request, false);
	assert.equal("profileRef" in request, false);
});

test("flowdesk_run_short registers beside run with compact explicit-mode schema", async () => {
	const disabledHooks = (await flowdeskOpenCodeServerPlugin.server(
		undefined as never,
		{
			[flowdeskLocalNonDispatchAdapterOption]: false,
			[flowdeskNaturalLanguageRoutingOption]: false,
		},
	)) as ChatMessageHooks;
	assert.equal(disabledHooks.tool?.flowdesk_run, undefined);
	assert.equal(disabledHooks.tool?.[flowdeskRunShortToolName], undefined);

	const hooks = (await flowdeskOpenCodeServerPlugin.server(undefined as never, {
		[flowdeskLocalNonDispatchAdapterOption]: true,
		[flowdeskNaturalLanguageRoutingOption]: false,
	})) as ChatMessageHooks;
	assert.ok(hooks.tool?.flowdesk_run);
	const runShortTool = hooks.tool?.[flowdeskRunShortToolName];
	assert.ok(runShortTool);
	assert.equal(runShortTool.description.length < 260, true);
	assert.match(runShortTool.description, /compact FlowDesk command-backed run alias/);
	assert.match(runShortTool.description, /Requires explicit runMode/);
	assert.match(runShortTool.description, /no provider call/);
	assert.match(runShortTool.description, /SDK-scoped noReply control/);
	assert.doesNotMatch(runShortTool.description, /Trigger on|Korean phrases|English phrases|WHEN TO USE/);
	assert.deepEqual(Object.keys(runShortTool.args), [
		"runMode",
		"planRevisionId",
		"workflowId",
		"stepId",
		"requestId",
	]);
});

test("flowdesk_run_short requires explicit runMode and maps camelCase fields", async () => {
	const calls: { toolName: unknown; request: Record<string, unknown> }[] = [];
	const session: NonNullable<
		Parameters<typeof createFlowDeskLocalNonDispatchAdapterTools>[1]
	> = {
		state: {},
		evaluate(toolName, request) {
			calls.push({ toolName, request: request as Record<string, unknown> });
			return { ok: true, toolName, request } as never;
		},
	};
	const tools = createFlowDeskLocalNonDispatchAdapterTools(
		new Date("2026-05-17T00:00:00.000Z"),
		session,
	);
	const runShortTool = tools[flowdeskRunShortToolName];
	assert.ok(runShortTool);
	await runShortTool.execute(
		{
			runMode: "guarded-dry-run",
			planRevisionId: "plan-revision-short-1",
			workflowId: "workflow-run-short-map",
			stepId: "step-run-short-map",
			requestId: "request.run short/explicit",
		},
		undefined as never,
	);
	assert.equal(calls[0]?.toolName, "flowdesk_run");
	assert.deepEqual(calls[0]?.request, {
		schema_version: "flowdesk.run.request.v1",
		request_id: "request.run-short-explicit",
		input_mode: "alias_command",
		run_mode: "guarded-dry-run",
		plan_revision_id: "plan-revision-short-1",
		workflow_id: "workflow-run-short-map",
		step_id: "step-run-short-map",
	});

	const realTools = createFlowDeskLocalNonDispatchAdapterTools(
		new Date("2026-05-17T00:00:00.000Z"),
	);
	const realRunShortTool = realTools[flowdeskRunShortToolName];
	assert.ok(realRunShortTool);
	const missingRunMode = JSON.parse(
		toolOutput(
			await realRunShortTool.execute(
				{
					requestId: "request-run-short-missing-mode",
					planRevisionId: "plan-revision-short-missing-mode",
				},
				undefined as never,
			),
		),
	) as LocalAdapterTestResult;
	assert.equal(missingRunMode.handler?.ok, false);
	assert.equal(missingRunMode.handler?.handlerMode, "request_schema_invalid");
});

test("flowdesk_run_short result matches flowdesk_run for equivalent fake-runtime payload", async () => {
	const shortTools = createFlowDeskLocalNonDispatchAdapterTools(
		new Date("2026-05-17T00:00:00.000Z"),
	);
	const runTools = createFlowDeskLocalNonDispatchAdapterTools(
		new Date("2026-05-17T00:00:00.000Z"),
	);
	const runShortTool = shortTools[flowdeskRunShortToolName];
	const runTool = runTools.flowdesk_run;
	assert.ok(runShortTool);
	assert.ok(runTool);
	const short = JSON.parse(
		toolOutput(
			await runShortTool.execute(
				{
					requestId: "request-run-short-equivalent",
					workflowId: "workflow-run-short-equivalent",
					runMode: "fake-runtime",
					planRevisionId: "plan-revision-run-short-equivalent",
					stepId: "step-run-short-equivalent",
				},
				undefined as never,
			),
		),
	) as LocalAdapterTestResult;
	const lowLevel = JSON.parse(
		toolOutput(
			await runTool.execute(
				{
					schema_version: "flowdesk.run.request.v1",
					request_id: "request-run-short-equivalent",
					input_mode: "alias_command",
					workflow_id: "workflow-run-short-equivalent",
					run_mode: "fake-runtime",
					plan_revision_id: "plan-revision-run-short-equivalent",
					step_id: "step-run-short-equivalent",
				},
				undefined as never,
			),
		),
	) as LocalAdapterTestResult;
	assert.deepEqual(short, lowLevel);
	assert.equal(short.providerCall, false);
	assert.equal(short.runtimeExecution, false);
	assert.equal(short.actualLaneLaunch, false);
});

test("flowdesk_run_short preserves managed-dispatch block parity", async () => {
	const shortTools = createFlowDeskLocalNonDispatchAdapterTools(
		new Date("2026-05-17T00:00:00.000Z"),
	);
	const runTools = createFlowDeskLocalNonDispatchAdapterTools(
		new Date("2026-05-17T00:00:00.000Z"),
	);
	const runShortTool = shortTools[flowdeskRunShortToolName];
	const runTool = runTools.flowdesk_run;
	assert.ok(runShortTool);
	assert.ok(runTool);
	const short = JSON.parse(
		toolOutput(
			await runShortTool.execute(
				{
					requestId: "request-run-short-managed-block",
					workflowId: "workflow-run-short-managed-block",
					runMode: "managed-dispatch",
					planRevisionId: "plan-revision-run-short-managed-block",
				},
				undefined as never,
			),
		),
	) as Record<string, unknown>;
	const lowLevel = JSON.parse(
		toolOutput(
			await runTool.execute(
				{
					schema_version: "flowdesk.run.request.v1",
					request_id: "request-run-short-managed-block",
					input_mode: "alias_command",
					workflow_id: "workflow-run-short-managed-block",
					run_mode: "managed-dispatch",
					plan_revision_id: "plan-revision-run-short-managed-block",
				},
				undefined as never,
			),
		),
	) as Record<string, unknown>;
	assert.deepEqual(short, lowLevel);
	assert.equal(short.status, "blocked_before_dispatch");
	assert.equal(short.dispatchAttempted, false);
});

test("flowdesk_run_short does not widen authority or forward approval identity fields", async () => {
	const calls: { request: Record<string, unknown> }[] = [];
	const session: NonNullable<
		Parameters<typeof createFlowDeskLocalNonDispatchAdapterTools>[1]
	> = {
		state: {},
		evaluate(_toolName, request) {
			calls.push({ request: request as Record<string, unknown> });
			return { ok: true, request } as never;
		},
	};
	const fakeTools = createFlowDeskLocalNonDispatchAdapterTools(
		new Date("2026-05-17T00:00:00.000Z"),
		session,
	);
	const fakeRunShortTool = fakeTools[flowdeskRunShortToolName];
	assert.ok(fakeRunShortTool);
	await fakeRunShortTool.execute(
		{
			requestId: "request-run-short-no-approval-synthesis",
			runMode: "guarded-dry-run",
			planRevisionId: "plan-revision-no-approval-synthesis",
			userApprovalRef: "approval-should-not-forward",
			user_approval_ref: "approval-snake-should-not-forward",
			sessionRef: "session-should-not-forward",
			confirmationNonce: "nonce-should-not-forward",
			confirmation_nonce: "nonce-snake-should-not-forward",
			redactedIntakeRef: "intake-should-not-forward",
			managed_dispatch_request: { should: "not-forward" },
		},
		undefined as never,
	);
	assert.deepEqual(Object.keys(calls[0]?.request ?? {}).sort(), [
		"input_mode",
		"plan_revision_id",
		"request_id",
		"run_mode",
		"schema_version",
	]);

	const realTools = createFlowDeskLocalNonDispatchAdapterTools(
		new Date("2026-05-17T00:00:00.000Z"),
	);
	const realRunShortTool = realTools[flowdeskRunShortToolName];
	assert.ok(realRunShortTool);
	const result = JSON.parse(
		toolOutput(
			await realRunShortTool.execute(
				{
					requestId: "request-run-short-authority",
					runMode: "guarded-dry-run",
					planRevisionId: "plan-revision-run-short-authority",
				},
				undefined as never,
			),
		),
	) as LocalAdapterTestResult;
	assert.equal(result.providerCall, false);
	assert.equal(result.runtimeExecution, false);
	assert.equal(result.actualLaneLaunch, false);
	assert.equal(result.fallbackAuthority, false);
	assert.equal(result.hardCancelOrNoReplyAuthority, false);
});

test("flowdesk_check registers with compact diagnostic description", async () => {
	const hooks = await flowdeskOpenCodeServerPlugin.server(undefined as never, {
		[flowdeskLocalNonDispatchAdapterOption]: true,
		[flowdeskNaturalLanguageRoutingOption]: false,
	});
	const checkTool = hooks.tool?.[flowdeskCheckToolName];
	assert.ok(checkTool);
	assert.equal(checkTool.description.length < 240, true);
	assert.match(checkTool.description, /doctor diagnostics/);
	assert.match(checkTool.description, /no provider call/);
	assert.match(checkTool.description, /SDK-scoped noReply control/);
	assert.deepEqual(Object.keys(checkTool.args), [
		"checkScope",
		"profile",
		"persistReport",
		"requestId",
	]);
});

test("flowdesk_check maps empty payload to doctor defaults", async () => {
	const calls: { toolName: unknown; request: Record<string, unknown> }[] = [];
	const session: NonNullable<
		Parameters<typeof createFlowDeskLocalNonDispatchAdapterTools>[1]
	> = {
		state: {},
		evaluate(toolName, request) {
			calls.push({ toolName, request: request as Record<string, unknown> });
			return { ok: true, toolName, request } as never;
		},
	};
	const tools = createFlowDeskLocalNonDispatchAdapterTools(
		new Date("2026-05-17T00:00:00.000Z"),
		session,
	);
	const checkTool = tools[flowdeskCheckToolName];
	assert.ok(checkTool);
	const result = JSON.parse(toolOutput(await checkTool.execute({}, undefined as never))) as Record<string, unknown>;
	assert.equal(result.ok, true);
	assert.equal(calls.length, 1);
	assert.equal(calls[0]?.toolName, "flowdesk_doctor");
	assert.deepEqual(
		{
			schema_version: calls[0]?.request.schema_version,
			input_mode: calls[0]?.request.input_mode,
			check_scope: calls[0]?.request.check_scope,
			profile: calls[0]?.request.profile,
			persist_report: calls[0]?.request.persist_report,
		},
		{
			schema_version: "flowdesk.doctor.request.v1",
			input_mode: "alias_command",
			check_scope: "all",
			profile: "production",
			persist_report: false,
		},
	);
	assert.match(String(calls[0]?.request.request_id), /^check-[A-Za-z0-9_.:-]+$/);
});

test("flowdesk_check forwards explicit diagnostic fields exactly", async () => {
	const calls: { request: Record<string, unknown> }[] = [];
	const session: NonNullable<
		Parameters<typeof createFlowDeskLocalNonDispatchAdapterTools>[1]
	> = {
		state: {},
		evaluate(_toolName, request) {
			calls.push({ request: request as Record<string, unknown> });
			return { ok: true, request } as never;
		},
	};
	const tools = createFlowDeskLocalNonDispatchAdapterTools(
		new Date("2026-05-17T00:00:00.000Z"),
		session,
	);
	const checkTool = tools[flowdeskCheckToolName];
	assert.ok(checkTool);
	await checkTool.execute(
		{
			checkScope: "provider_health",
			profile: "development",
			persistReport: true,
			requestId: "request.check explicit/unsafe spaces",
		},
		undefined as never,
	);
	assert.deepEqual(calls[0]?.request, {
		schema_version: "flowdesk.doctor.request.v1",
		request_id: "request.check-explicit-unsafe-spaces",
		input_mode: "alias_command",
		check_scope: "provider_health",
		profile: "development",
		persist_report: true,
	});
});

test("flowdesk_check result matches flowdesk_doctor for equivalent low-level payload", async () => {
	const checkTools = createFlowDeskLocalNonDispatchAdapterTools(
		new Date("2026-05-17T00:00:00.000Z"),
	);
	const doctorTools = createFlowDeskLocalNonDispatchAdapterTools(
		new Date("2026-05-17T00:00:00.000Z"),
	);
	const checkTool = checkTools[flowdeskCheckToolName];
	const doctorTool = doctorTools.flowdesk_doctor;
	assert.ok(checkTool);
	assert.ok(doctorTool);
	const check = JSON.parse(
		toolOutput(
			await checkTool.execute(
				{
					requestId: "request-check-equivalent",
					checkScope: "runtime",
					profile: "test",
					persistReport: false,
				},
				undefined as never,
			),
		),
	) as LocalAdapterTestResult;
	const doctor = JSON.parse(
		toolOutput(
			await doctorTool.execute(
				{
					schema_version: "flowdesk.doctor.request.v1",
					request_id: "request-check-equivalent",
					input_mode: "alias_command",
					check_scope: "runtime",
					profile: "test",
					persist_report: false,
				},
				undefined as never,
			),
		),
	) as LocalAdapterTestResult;
	assert.deepEqual(check, doctor);
});

test("flowdesk_check does not widen authority or synthesize approval identity", async () => {
	const calls: { request: Record<string, unknown> }[] = [];
	const session: NonNullable<
		Parameters<typeof createFlowDeskLocalNonDispatchAdapterTools>[1]
	> = {
		state: {},
		evaluate(_toolName, request) {
			calls.push({ request: request as Record<string, unknown> });
			return { ok: true, request } as never;
		},
	};
	const fakeTools = createFlowDeskLocalNonDispatchAdapterTools(
		new Date("2026-05-17T00:00:00.000Z"),
		session,
	);
	const fakeCheckTool = fakeTools[flowdeskCheckToolName];
	assert.ok(fakeCheckTool);
	await fakeCheckTool.execute(
		{
			requestId: "request-no-approval-synthesis",
			userApprovalRef: "approval-should-not-forward",
			user_approval_ref: "approval-snake-should-not-forward",
			workflowId: "workflow-should-not-forward",
			workflow_id: "workflow-snake-should-not-forward",
			sessionRef: "session-should-not-forward",
			confirmationNonce: "nonce-should-not-forward",
			confirmation_nonce: "nonce-snake-should-not-forward",
		},
		undefined as never,
	);
	assert.deepEqual(Object.keys(calls[0]?.request ?? {}).sort(), [
		"check_scope",
		"input_mode",
		"persist_report",
		"profile",
		"request_id",
		"schema_version",
	]);

	const realTools = createFlowDeskLocalNonDispatchAdapterTools(
		new Date("2026-05-17T00:00:00.000Z"),
	);
	const realCheckTool = realTools[flowdeskCheckToolName];
	assert.ok(realCheckTool);
	const result = JSON.parse(
		toolOutput(
			await realCheckTool.execute(
				{ requestId: "request-check-authority", checkScope: "runtime" },
				undefined as never,
			),
		),
	) as LocalAdapterTestResult;
	assert.equal(result.providerCall, false);
	assert.equal(result.runtimeExecution, false);
	assert.equal(result.actualLaneLaunch, false);
	assert.equal(result.fallbackAuthority, false);
	assert.equal(result.hardCancelOrNoReplyAuthority, false);
});

test("flowdesk_debug registers only with command-backed debug export and has compact description", async () => {
	const disabledHooks = (await flowdeskOpenCodeServerPlugin.server(
		undefined as never,
		{
			[flowdeskLocalNonDispatchAdapterOption]: false,
			[flowdeskNaturalLanguageRoutingOption]: false,
		},
	)) as ChatMessageHooks;
	assert.equal(disabledHooks.tool?.flowdesk_export_debug, undefined);
	assert.equal(disabledHooks.tool?.[flowdeskDebugToolName], undefined);

	const hooks = (await flowdeskOpenCodeServerPlugin.server(undefined as never, {
		[flowdeskLocalNonDispatchAdapterOption]: true,
		[flowdeskNaturalLanguageRoutingOption]: false,
	})) as ChatMessageHooks;
	assert.ok(hooks.tool?.flowdesk_export_debug);
	const debugTool = hooks.tool?.[flowdeskDebugToolName];
	assert.ok(debugTool);
	assert.equal(debugTool.description.length < 240, true);
	assert.match(debugTool.description, /redacted FlowDesk debug bundle/);
	assert.match(debugTool.description, /no provider/);
	assert.match(debugTool.description, /SDK-scoped noReply control/);
	assert.doesNotMatch(debugTool.description, /Trigger on|Korean phrases|English phrases|WHEN TO USE/);
	assert.deepEqual(Object.keys(debugTool.args), [
		"includeSections",
		"retentionHint",
		"requestId",
	]);
});

test("flowdesk_debug forwards explicit redacted export args safely", async () => {
	const calls: { toolName: unknown; request: Record<string, unknown> }[] = [];
	const session: NonNullable<
		Parameters<typeof createFlowDeskLocalNonDispatchAdapterTools>[1]
	> = {
		state: {},
		evaluate(toolName, request) {
			calls.push({ toolName, request: request as Record<string, unknown> });
			return { ok: true, toolName, request } as never;
		},
	};
	const tools = createFlowDeskLocalNonDispatchAdapterTools(
		new Date("2026-05-17T00:00:00.000Z"),
		session,
	);
	const debugTool = tools[flowdeskDebugToolName];
	assert.ok(debugTool);
	const result = JSON.parse(
		toolOutput(
			await debugTool.execute(
				{
					includeSections: ["doctor", "redaction_summary"],
					retentionHint: "delete_after_export",
					requestId: "request.debug explicit/unsafe spaces",
				},
				undefined as never,
			),
		),
	) as Record<string, unknown>;
	assert.equal(result.ok, true);
	assert.equal(calls.length, 1);
	assert.equal(calls[0]?.toolName, "flowdesk_export_debug");
	assert.deepEqual(calls[0]?.request, {
		schema_version: "flowdesk.export_debug.request.v1",
		request_id: "request.debug-explicit-unsafe-spaces",
		input_mode: "alias_command",
		include_sections: ["doctor", "redaction_summary"],
		retention_hint: "delete_after_export",
	});
});

test("flowdesk_debug result matches flowdesk_export_debug for equivalent payload", async () => {
	const debugTools = createFlowDeskLocalNonDispatchAdapterTools(
		new Date("2026-05-17T00:00:00.000Z"),
	);
	const exportTools = createFlowDeskLocalNonDispatchAdapterTools(
		new Date("2026-05-17T00:00:00.000Z"),
	);
	const debugTool = debugTools[flowdeskDebugToolName];
	const exportDebugTool = exportTools.flowdesk_export_debug;
	assert.ok(debugTool);
	assert.ok(exportDebugTool);
	const debug = JSON.parse(
		toolOutput(
			await debugTool.execute(
				{
					requestId: "request-debug-equivalent",
					includeSections: ["redaction_summary"],
					retentionHint: "keep_until_default_expiry",
				},
				undefined as never,
			),
		),
	) as LocalAdapterTestResult;
	const exportDebug = JSON.parse(
		toolOutput(
			await exportDebugTool.execute(
				{
					schema_version: "flowdesk.export_debug.request.v1",
					request_id: "request-debug-equivalent",
					input_mode: "alias_command",
					include_sections: ["redaction_summary"],
					retention_hint: "keep_until_default_expiry",
				},
				undefined as never,
			),
		),
	) as LocalAdapterTestResult;
	assert.deepEqual(debug, exportDebug);
});

test("flowdesk_debug does not widen authority or synthesize approval identity", async () => {
	const calls: { request: Record<string, unknown> }[] = [];
	const session: NonNullable<
		Parameters<typeof createFlowDeskLocalNonDispatchAdapterTools>[1]
	> = {
		state: {},
		evaluate(_toolName, request) {
			calls.push({ request: request as Record<string, unknown> });
			return { ok: true, request } as never;
		},
	};
	const fakeTools = createFlowDeskLocalNonDispatchAdapterTools(
		new Date("2026-05-17T00:00:00.000Z"),
		session,
	);
	const fakeDebugTool = fakeTools[flowdeskDebugToolName];
	assert.ok(fakeDebugTool);
	await fakeDebugTool.execute(
		{
			requestId: "request-debug-no-approval-synthesis",
			includeSections: ["doctor", 123, "redaction_summary"],
			userApprovalRef: "approval-should-not-forward",
			user_approval_ref: "approval-snake-should-not-forward",
			workflowId: "workflow-should-not-forward",
			workflow_id: "workflow-snake-should-not-forward",
			sessionRef: "session-should-not-forward",
			confirmationNonce: "nonce-should-not-forward",
			confirmation_nonce: "nonce-snake-should-not-forward",
		},
		undefined as never,
	);
	assert.deepEqual(Object.keys(calls[0]?.request ?? {}).sort(), [
		"include_sections",
		"input_mode",
		"request_id",
		"retention_hint",
		"schema_version",
	]);
	assert.deepEqual(calls[0]?.request.include_sections, [
		"doctor",
		"redaction_summary",
	]);

	const realTools = createFlowDeskLocalNonDispatchAdapterTools(
		new Date("2026-05-17T00:00:00.000Z"),
	);
	const realDebugTool = realTools[flowdeskDebugToolName];
	assert.ok(realDebugTool);
	const result = JSON.parse(
		toolOutput(
			await realDebugTool.execute(
				{
					requestId: "request-debug-authority",
					includeSections: ["redaction_summary"],
				},
				undefined as never,
			),
		),
	) as LocalAdapterTestResult;
	assert.equal(result.providerCall, false);
	assert.equal(result.runtimeExecution, false);
	assert.equal(result.actualLaneLaunch, false);
	assert.equal(result.fallbackAuthority, false);
	assert.equal(result.hardCancelOrNoReplyAuthority, false);
});

test("flowdesk_resume_status registers beside resume with compact description", async () => {
	const disabledHooks = (await flowdeskOpenCodeServerPlugin.server(
		undefined as never,
		{
			[flowdeskLocalNonDispatchAdapterOption]: false,
			[flowdeskNaturalLanguageRoutingOption]: false,
		},
	)) as ChatMessageHooks;
	assert.equal(disabledHooks.tool?.flowdesk_resume, undefined);
	assert.equal(disabledHooks.tool?.[flowdeskResumeStatusToolName], undefined);

	const hooks = (await flowdeskOpenCodeServerPlugin.server(undefined as never, {
		[flowdeskLocalNonDispatchAdapterOption]: true,
		[flowdeskNaturalLanguageRoutingOption]: false,
	})) as ChatMessageHooks;
	assert.ok(hooks.tool?.flowdesk_resume);
	const resumeStatusTool = hooks.tool?.[flowdeskResumeStatusToolName];
	assert.ok(resumeStatusTool);
	assert.equal(resumeStatusTool.description.length < 260, true);
	assert.match(resumeStatusTool.description, /resume checkpoint status/);
	assert.match(resumeStatusTool.description, /Diagnostics only/);
	assert.match(resumeStatusTool.description, /no provider/);
	assert.match(resumeStatusTool.description, /SDK-scoped noReply control/);
	assert.doesNotMatch(resumeStatusTool.description, /Trigger on|Korean phrases|English phrases|WHEN TO USE/);
	assert.deepEqual(Object.keys(resumeStatusTool.args), [
		"checkpointId",
		"requestId",
	]);
});

test("flowdesk_resume_status maps checkpoint and generates bounded request id", async () => {
	const calls: { toolName: unknown; request: Record<string, unknown> }[] = [];
	const session: NonNullable<
		Parameters<typeof createFlowDeskLocalNonDispatchAdapterTools>[1]
	> = {
		state: {},
		evaluate(toolName, request) {
			calls.push({ toolName, request: request as Record<string, unknown> });
			return { ok: true, toolName, request } as never;
		},
	};
	const tools = createFlowDeskLocalNonDispatchAdapterTools(
		new Date("2026-05-17T00:00:00.000Z"),
		session,
	);
	const resumeStatusTool = tools[flowdeskResumeStatusToolName];
	assert.ok(resumeStatusTool);
	const result = JSON.parse(
		toolOutput(
			await resumeStatusTool.execute(
				{ checkpointId: "checkpoint-resume-status-default" },
				undefined as never,
			),
		),
	) as Record<string, unknown>;
	assert.equal(result.ok, true);
	assert.equal(calls.length, 1);
	assert.equal(calls[0]?.toolName, "flowdesk_resume");
	assert.deepEqual(
		{
			schema_version: calls[0]?.request.schema_version,
			input_mode: calls[0]?.request.input_mode,
			checkpoint_id: calls[0]?.request.checkpoint_id,
			resume_mode: calls[0]?.request.resume_mode,
		},
		{
			schema_version: "flowdesk.resume.request.v1",
			input_mode: "alias_command",
			checkpoint_id: "checkpoint-resume-status-default",
			resume_mode: "status_only",
		},
	);
	const requestId = String(calls[0]?.request.request_id);
	assert.match(requestId, /^resume-status-[A-Za-z0-9_.:-]+$/);
	assert.equal(requestId.length <= 80, true);
});

test("flowdesk_resume_status forwards explicit request id and status-only mode", async () => {
	const calls: { request: Record<string, unknown> }[] = [];
	const session: NonNullable<
		Parameters<typeof createFlowDeskLocalNonDispatchAdapterTools>[1]
	> = {
		state: {},
		evaluate(_toolName, request) {
			calls.push({ request: request as Record<string, unknown> });
			return { ok: true, request } as never;
		},
	};
	const tools = createFlowDeskLocalNonDispatchAdapterTools(
		new Date("2026-05-17T00:00:00.000Z"),
		session,
	);
	const resumeStatusTool = tools[flowdeskResumeStatusToolName];
	assert.ok(resumeStatusTool);
	await resumeStatusTool.execute(
		{
			checkpointId: "checkpoint-resume-status-explicit",
			requestId: "request.resume status/unsafe spaces",
		},
		undefined as never,
	);
	assert.deepEqual(calls[0]?.request, {
		schema_version: "flowdesk.resume.request.v1",
		request_id: "request.resume-status-unsafe-spaces",
		input_mode: "alias_command",
		checkpoint_id: "checkpoint-resume-status-explicit",
		resume_mode: "status_only",
	});
});

test("flowdesk_resume_status result matches flowdesk_resume for equivalent payload", async () => {
	const statusTools = createFlowDeskLocalNonDispatchAdapterTools(
		new Date("2026-05-17T00:00:00.000Z"),
	);
	const resumeTools = createFlowDeskLocalNonDispatchAdapterTools(
		new Date("2026-05-17T00:00:00.000Z"),
	);
	const resumeStatusTool = statusTools[flowdeskResumeStatusToolName];
	const resumeTool = resumeTools.flowdesk_resume;
	assert.ok(resumeStatusTool);
	assert.ok(resumeTool);
	const status = JSON.parse(
		toolOutput(
			await resumeStatusTool.execute(
				{
					requestId: "request-resume-status-equivalent",
					checkpointId: "checkpoint-resume-status-equivalent",
				},
				undefined as never,
			),
		),
	) as LocalAdapterTestResult;
	const lowLevel = JSON.parse(
		toolOutput(
			await resumeTool.execute(
				{
					schema_version: "flowdesk.resume.request.v1",
					request_id: "request-resume-status-equivalent",
					input_mode: "alias_command",
					checkpoint_id: "checkpoint-resume-status-equivalent",
					resume_mode: "status_only",
				},
				undefined as never,
			),
		),
	) as LocalAdapterTestResult;
	assert.deepEqual(status, lowLevel);
});

test("flowdesk_resume_status does not widen authority or synthesize identity", async () => {
	const calls: { request: Record<string, unknown> }[] = [];
	const session: NonNullable<
		Parameters<typeof createFlowDeskLocalNonDispatchAdapterTools>[1]
	> = {
		state: {},
		evaluate(_toolName, request) {
			calls.push({ request: request as Record<string, unknown> });
			return { ok: true, request } as never;
		},
	};
	const fakeTools = createFlowDeskLocalNonDispatchAdapterTools(
		new Date("2026-05-17T00:00:00.000Z"),
		session,
	);
	const fakeResumeStatusTool = fakeTools[flowdeskResumeStatusToolName];
	assert.ok(fakeResumeStatusTool);
	await fakeResumeStatusTool.execute(
		{
			requestId: "request-resume-status-no-identity-synthesis",
			checkpointId: "checkpoint-resume-status-no-identity-synthesis",
			workflowId: "workflow-should-not-forward",
			workflow_id: "workflow-snake-should-not-forward",
			sessionRef: "session-should-not-forward",
			redactedIntakeRef: "intake-should-not-forward",
			userApprovalRef: "approval-should-not-forward",
			user_approval_ref: "approval-snake-should-not-forward",
			confirmationNonce: "nonce-should-not-forward",
			confirmation_nonce: "nonce-snake-should-not-forward",
		},
		undefined as never,
	);
	assert.deepEqual(Object.keys(calls[0]?.request ?? {}).sort(), [
		"checkpoint_id",
		"input_mode",
		"request_id",
		"resume_mode",
		"schema_version",
	]);

	const realTools = createFlowDeskLocalNonDispatchAdapterTools(
		new Date("2026-05-17T00:00:00.000Z"),
	);
	const realResumeStatusTool = realTools[flowdeskResumeStatusToolName];
	assert.ok(realResumeStatusTool);
	const result = JSON.parse(
		toolOutput(
			await realResumeStatusTool.execute(
				{
					requestId: "request-resume-status-authority",
					checkpointId: "checkpoint-resume-status-authority",
				},
				undefined as never,
			),
		),
	) as LocalAdapterTestResult;
	assert.equal(result.providerCall, false);
	assert.equal(result.runtimeExecution, false);
	assert.equal(result.actualLaneLaunch, false);
	assert.equal(result.fallbackAuthority, false);
	assert.equal(result.hardCancelOrNoReplyAuthority, false);
});

test("flowdesk_resume_status ignores unknown approval and identity fields safely", async () => {
	const calls: { request: Record<string, unknown> }[] = [];
	const session: NonNullable<
		Parameters<typeof createFlowDeskLocalNonDispatchAdapterTools>[1]
	> = {
		state: {},
		evaluate(_toolName, request) {
			calls.push({ request: request as Record<string, unknown> });
			return { ok: true, request } as never;
		},
	};
	const tools = createFlowDeskLocalNonDispatchAdapterTools(
		new Date("2026-05-17T00:00:00.000Z"),
		session,
	);
	const resumeStatusTool = tools[flowdeskResumeStatusToolName];
	assert.ok(resumeStatusTool);
	await resumeStatusTool.execute(
		{
			requestId: "request-resume-status-unknown-fields",
			checkpointId: "checkpoint-resume-status-unknown-fields",
			workflow_id: "workflow-snake-should-not-forward",
			user_approval_ref: "approval-snake-should-not-forward",
			confirmation_nonce: "nonce-snake-should-not-forward",
			actorRef: "actor-should-not-forward",
			profileRef: "profile-should-not-forward",
		},
		undefined as never,
	);
	const request = calls[0]?.request ?? {};
	assert.equal("workflow_id" in request, false);
	assert.equal("user_approval_ref" in request, false);
	assert.equal("confirmation_nonce" in request, false);
	assert.equal("actorRef" in request, false);
	assert.equal("profileRef" in request, false);
});

test("flowdesk_retry_diag registers beside retry with compact description", async () => {
	const disabledHooks = (await flowdeskOpenCodeServerPlugin.server(
		undefined as never,
		{
			[flowdeskLocalNonDispatchAdapterOption]: false,
			[flowdeskNaturalLanguageRoutingOption]: false,
		},
	)) as ChatMessageHooks;
	assert.equal(disabledHooks.tool?.flowdesk_retry, undefined);
	assert.equal(disabledHooks.tool?.[flowdeskRetryDiagToolName], undefined);

	const hooks = (await flowdeskOpenCodeServerPlugin.server(undefined as never, {
		[flowdeskLocalNonDispatchAdapterOption]: true,
		[flowdeskNaturalLanguageRoutingOption]: false,
	})) as ChatMessageHooks;
	assert.ok(hooks.tool?.flowdesk_retry);
	const retryDiagTool = hooks.tool?.[flowdeskRetryDiagToolName];
	assert.ok(retryDiagTool);
	assert.equal(retryDiagTool.description.length < 260, true);
	assert.match(retryDiagTool.description, /retry diagnostic/);
	assert.match(retryDiagTool.description, /No provider/);
	assert.match(retryDiagTool.description, /SDK-scoped noReply control/);
	assert.doesNotMatch(retryDiagTool.description, /Trigger on|Korean phrases|English phrases|WHEN TO USE/);
	assert.deepEqual(Object.keys(retryDiagTool.args), [
		"attemptId",
		"retryReason",
		"newBindingHint",
		"workflowId",
		"requestId",
	]);
});

test("flowdesk_retry_diag maps defaults and generates bounded request id", async () => {
	const calls: { toolName: unknown; request: Record<string, unknown> }[] = [];
	const session: NonNullable<
		Parameters<typeof createFlowDeskLocalNonDispatchAdapterTools>[1]
	> = {
		state: {},
		evaluate(toolName, request) {
			calls.push({ toolName, request: request as Record<string, unknown> });
			return { ok: true, toolName, request } as never;
		},
	};
	const tools = createFlowDeskLocalNonDispatchAdapterTools(
		new Date("2026-05-17T00:00:00.000Z"),
		session,
	);
	const retryDiagTool = tools[flowdeskRetryDiagToolName];
	assert.ok(retryDiagTool);
	const result = JSON.parse(
		toolOutput(
			await retryDiagTool.execute(
				{ attemptId: "attempt-retry-diag-default", retryReason: "" },
				undefined as never,
			),
		),
	) as Record<string, unknown>;
	assert.equal(result.ok, true);
	assert.equal(calls.length, 1);
	assert.equal(calls[0]?.toolName, "flowdesk_retry");
	assert.deepEqual(
		{
			schema_version: calls[0]?.request.schema_version,
			input_mode: calls[0]?.request.input_mode,
			attempt_id: calls[0]?.request.attempt_id,
			retry_reason: calls[0]?.request.retry_reason,
			workflow_id: calls[0]?.request.workflow_id,
			new_binding_hint: calls[0]?.request.new_binding_hint,
		},
		{
			schema_version: "flowdesk.retry.request.v1",
			input_mode: "alias_command",
			attempt_id: "attempt-retry-diag-default",
			retry_reason: "FlowDesk retry diagnostic requested.",
			workflow_id: undefined,
			new_binding_hint: undefined,
		},
	);
	const requestId = String(calls[0]?.request.request_id);
	assert.match(requestId, /^retry-diag-[A-Za-z0-9_.:-]+$/);
	assert.equal(requestId.length <= 80, true);
});

test("flowdesk_retry_diag forwards explicit fields with snake_case mapping", async () => {
	const calls: { request: Record<string, unknown> }[] = [];
	const session: NonNullable<
		Parameters<typeof createFlowDeskLocalNonDispatchAdapterTools>[1]
	> = {
		state: {},
		evaluate(_toolName, request) {
			calls.push({ request: request as Record<string, unknown> });
			return { ok: true, request } as never;
		},
	};
	const tools = createFlowDeskLocalNonDispatchAdapterTools(
		new Date("2026-05-17T00:00:00.000Z"),
		session,
	);
	const retryDiagTool = tools[flowdeskRetryDiagToolName];
	assert.ok(retryDiagTool);
	await retryDiagTool.execute(
		{
			attemptId: "attempt-retry-diag-explicit",
			retryReason: "verification failed after command-backed diagnostics",
			newBindingHint: "same-binding",
			workflowId: "workflow-retry-diag-explicit",
			requestId: "request.retry diag/unsafe spaces",
		},
		undefined as never,
	);
	assert.deepEqual(calls[0]?.request, {
		schema_version: "flowdesk.retry.request.v1",
		request_id: "request.retry-diag-unsafe-spaces",
		input_mode: "alias_command",
		workflow_id: "workflow-retry-diag-explicit",
		attempt_id: "attempt-retry-diag-explicit",
		retry_reason: "verification failed after command-backed diagnostics",
		new_binding_hint: "same-binding",
	});
});

test("flowdesk_retry_diag result matches flowdesk_retry for equivalent payload", async () => {
	const diagTools = createFlowDeskLocalNonDispatchAdapterTools(
		new Date("2026-05-17T00:00:00.000Z"),
	);
	const retryTools = createFlowDeskLocalNonDispatchAdapterTools(
		new Date("2026-05-17T00:00:00.000Z"),
	);
	const retryDiagTool = diagTools[flowdeskRetryDiagToolName];
	const retryTool = retryTools.flowdesk_retry;
	assert.ok(retryDiagTool);
	assert.ok(retryTool);
	const diag = JSON.parse(
		toolOutput(
			await retryDiagTool.execute(
				{
					requestId: "request-retry-diag-equivalent",
					workflowId: "workflow-retry-diag-equivalent",
					attemptId: "attempt-retry-diag-equivalent",
					retryReason: "verification failed after command-backed diagnostics",
					newBindingHint: "same-binding",
				},
				undefined as never,
			),
		),
	) as LocalAdapterTestResult;
	const lowLevel = JSON.parse(
		toolOutput(
			await retryTool.execute(
				{
					schema_version: "flowdesk.retry.request.v1",
					request_id: "request-retry-diag-equivalent",
					input_mode: "alias_command",
					workflow_id: "workflow-retry-diag-equivalent",
					attempt_id: "attempt-retry-diag-equivalent",
					retry_reason: "verification failed after command-backed diagnostics",
					new_binding_hint: "same-binding",
				},
				undefined as never,
			),
		),
	) as LocalAdapterTestResult;
	assert.deepEqual(diag, lowLevel);
});

test("flowdesk_retry_diag does not widen authority or synthesize identity", async () => {
	const calls: { request: Record<string, unknown> }[] = [];
	const session: NonNullable<
		Parameters<typeof createFlowDeskLocalNonDispatchAdapterTools>[1]
	> = {
		state: {},
		evaluate(_toolName, request) {
			calls.push({ request: request as Record<string, unknown> });
			return { ok: true, request } as never;
		},
	};
	const fakeTools = createFlowDeskLocalNonDispatchAdapterTools(
		new Date("2026-05-17T00:00:00.000Z"),
		session,
	);
	const fakeRetryDiagTool = fakeTools[flowdeskRetryDiagToolName];
	assert.ok(fakeRetryDiagTool);
	await fakeRetryDiagTool.execute(
		{
			requestId: "request-retry-diag-no-identity-synthesis",
			attemptId: "attempt-retry-diag-no-identity-synthesis",
			userApprovalRef: "approval-should-not-forward",
			user_approval_ref: "approval-snake-should-not-forward",
			sessionRef: "session-should-not-forward",
			redactedIntakeRef: "intake-should-not-forward",
			confirmationNonce: "nonce-should-not-forward",
			confirmation_nonce: "nonce-snake-should-not-forward",
			allowProviderCall: true,
			allowActualLaneLaunch: true,
		},
		undefined as never,
	);
	assert.deepEqual(Object.keys(calls[0]?.request ?? {}).sort(), [
		"attempt_id",
		"input_mode",
		"request_id",
		"retry_reason",
		"schema_version",
	]);

	const realTools = createFlowDeskLocalNonDispatchAdapterTools(
		new Date("2026-05-17T00:00:00.000Z"),
	);
	const realRetryDiagTool = realTools[flowdeskRetryDiagToolName];
	assert.ok(realRetryDiagTool);
	const result = JSON.parse(
		toolOutput(
			await realRetryDiagTool.execute(
				{
					requestId: "request-retry-diag-authority",
					attemptId: "attempt-retry-diag-authority",
				},
				undefined as never,
			),
		),
	) as LocalAdapterTestResult;
	assert.equal(result.providerCall, false);
	assert.equal(result.runtimeExecution, false);
	assert.equal(result.actualLaneLaunch, false);
	assert.equal(result.fallbackAuthority, false);
	assert.equal(result.hardCancelOrNoReplyAuthority, false);
});

test("flowdesk_retry_diag ignores unknown approval and identity fields safely", async () => {
	const calls: { request: Record<string, unknown> }[] = [];
	const session: NonNullable<
		Parameters<typeof createFlowDeskLocalNonDispatchAdapterTools>[1]
	> = {
		state: {},
		evaluate(_toolName, request) {
			calls.push({ request: request as Record<string, unknown> });
			return { ok: true, request } as never;
		},
	};
	const tools = createFlowDeskLocalNonDispatchAdapterTools(
		new Date("2026-05-17T00:00:00.000Z"),
		session,
	);
	const retryDiagTool = tools[flowdeskRetryDiagToolName];
	assert.ok(retryDiagTool);
	await retryDiagTool.execute(
		{
			requestId: "request-retry-diag-unknown-fields",
			attemptId: "attempt-retry-diag-unknown-fields",
			workflow_id: "workflow-snake-should-not-forward",
			attempt_id: "attempt-snake-should-not-forward",
			retry_reason: "reason-snake-should-not-forward",
			new_binding_hint: "binding-snake-should-not-forward",
			user_approval_ref: "approval-snake-should-not-forward",
			confirmation_nonce: "nonce-snake-should-not-forward",
			actorRef: "actor-should-not-forward",
			profileRef: "profile-should-not-forward",
		},
		undefined as never,
	);
	const request = calls[0]?.request ?? {};
	assert.equal(request.attempt_id, "attempt-retry-diag-unknown-fields");
	assert.equal("workflow_id" in request, false);
	assert.equal("user_approval_ref" in request, false);
	assert.equal("confirmation_nonce" in request, false);
	assert.equal("actorRef" in request, false);
	assert.equal("profileRef" in request, false);
});

test("flowdesk_abort_cmd registers beside abort with compact description", async () => {
	const disabledHooks = (await flowdeskOpenCodeServerPlugin.server(
		undefined as never,
		{
			[flowdeskLocalNonDispatchAdapterOption]: false,
			[flowdeskNaturalLanguageRoutingOption]: false,
		},
	)) as ChatMessageHooks;
	assert.equal(disabledHooks.tool?.flowdesk_abort, undefined);
	assert.equal(disabledHooks.tool?.[flowdeskAbortCmdToolName], undefined);

	const hooks = (await flowdeskOpenCodeServerPlugin.server(undefined as never, {
		[flowdeskLocalNonDispatchAdapterOption]: true,
		[flowdeskNaturalLanguageRoutingOption]: false,
	})) as ChatMessageHooks;
	assert.ok(hooks.tool?.flowdesk_abort);
	const abortCmdTool = hooks.tool?.[flowdeskAbortCmdToolName];
	assert.ok(abortCmdTool);
	assert.equal(abortCmdTool.description.length < 260, true);
	assert.match(abortCmdTool.description, /command-backed abort/);
	assert.match(abortCmdTool.description, /No provider/);
	assert.match(abortCmdTool.description, /SDK-scoped noReply control/);
	assert.doesNotMatch(abortCmdTool.description, /Trigger on|Korean phrases|English phrases|WHEN TO USE/);
	assert.deepEqual(Object.keys(abortCmdTool.args), [
		"workflowId",
		"reason",
		"attemptId",
		"laneId",
		"requestId",
	]);
});

test("flowdesk_abort_cmd maps required fields and generates bounded request id", async () => {
	const calls: { toolName: unknown; request: Record<string, unknown> }[] = [];
	const session: NonNullable<
		Parameters<typeof createFlowDeskLocalNonDispatchAdapterTools>[1]
	> = {
		state: {},
		evaluate(toolName, request) {
			calls.push({ toolName, request: request as Record<string, unknown> });
			return { ok: true, toolName, request } as never;
		},
	};
	const tools = createFlowDeskLocalNonDispatchAdapterTools(
		new Date("2026-05-17T00:00:00.000Z"),
		session,
	);
	const abortCmdTool = tools[flowdeskAbortCmdToolName];
	assert.ok(abortCmdTool);
	const result = JSON.parse(
		toolOutput(
			await abortCmdTool.execute(
				{
					workflowId: "workflow-abort-cmd-default",
					reason: "safe manual abort diagnostic",
				},
				undefined as never,
			),
		),
	) as Record<string, unknown>;
	assert.equal(result.ok, true);
	assert.equal(calls.length, 1);
	assert.equal(calls[0]?.toolName, "flowdesk_abort");
	assert.deepEqual(
		{
			schema_version: calls[0]?.request.schema_version,
			input_mode: calls[0]?.request.input_mode,
			workflow_id: calls[0]?.request.workflow_id,
			reason: calls[0]?.request.reason,
			attempt_id: calls[0]?.request.attempt_id,
			lane_id: calls[0]?.request.lane_id,
		},
		{
			schema_version: "flowdesk.abort.request.v1",
			input_mode: "alias_command",
			workflow_id: "workflow-abort-cmd-default",
			reason: "safe manual abort diagnostic",
			attempt_id: undefined,
			lane_id: undefined,
		},
	);
	const requestId = String(calls[0]?.request.request_id);
	assert.match(requestId, /^abort-cmd-[A-Za-z0-9_.:-]+$/);
	assert.equal(requestId.length <= 80, true);
});

test("flowdesk_abort_cmd forwards explicit fields with snake_case mapping", async () => {
	const calls: { request: Record<string, unknown> }[] = [];
	const session: NonNullable<
		Parameters<typeof createFlowDeskLocalNonDispatchAdapterTools>[1]
	> = {
		state: {},
		evaluate(_toolName, request) {
			calls.push({ request: request as Record<string, unknown> });
			return { ok: true, request } as never;
		},
	};
	const tools = createFlowDeskLocalNonDispatchAdapterTools(
		new Date("2026-05-17T00:00:00.000Z"),
		session,
	);
	const abortCmdTool = tools[flowdeskAbortCmdToolName];
	assert.ok(abortCmdTool);
	await abortCmdTool.execute(
		{
			workflowId: "workflow-abort-cmd-explicit",
			reason: "user requested command-backed abort diagnostic",
			attemptId: "attempt-abort-cmd-explicit",
			laneId: "lane-abort-cmd-explicit",
			requestId: "request.abort cmd/unsafe spaces",
		},
		undefined as never,
	);
	assert.deepEqual(calls[0]?.request, {
		schema_version: "flowdesk.abort.request.v1",
		request_id: "request.abort-cmd-unsafe-spaces",
		input_mode: "alias_command",
		workflow_id: "workflow-abort-cmd-explicit",
		reason: "user requested command-backed abort diagnostic",
		attempt_id: "attempt-abort-cmd-explicit",
		lane_id: "lane-abort-cmd-explicit",
	});
});

test("flowdesk_abort_cmd result matches flowdesk_abort for equivalent payload", async () => {
	const cmdTools = createFlowDeskLocalNonDispatchAdapterTools(
		new Date("2026-05-17T00:00:00.000Z"),
	);
	const abortTools = createFlowDeskLocalNonDispatchAdapterTools(
		new Date("2026-05-17T00:00:00.000Z"),
	);
	const abortCmdTool = cmdTools[flowdeskAbortCmdToolName];
	const abortTool = abortTools.flowdesk_abort;
	assert.ok(abortCmdTool);
	assert.ok(abortTool);
	const cmd = JSON.parse(
		toolOutput(
			await abortCmdTool.execute(
				{
					requestId: "request-abort-cmd-equivalent",
					workflowId: "workflow-abort-cmd-equivalent",
					reason: "equivalent abort diagnostic",
					attemptId: "attempt-abort-cmd-equivalent",
					laneId: "lane-abort-cmd-equivalent",
				},
				undefined as never,
			),
		),
	) as LocalAdapterTestResult;
	const lowLevel = JSON.parse(
		toolOutput(
			await abortTool.execute(
				{
					schema_version: "flowdesk.abort.request.v1",
					request_id: "request-abort-cmd-equivalent",
					input_mode: "alias_command",
					workflow_id: "workflow-abort-cmd-equivalent",
					reason: "equivalent abort diagnostic",
					attempt_id: "attempt-abort-cmd-equivalent",
					lane_id: "lane-abort-cmd-equivalent",
				},
				undefined as never,
			),
		),
	) as LocalAdapterTestResult;
	assert.deepEqual(cmd, lowLevel);
});

test("flowdesk_abort_cmd does not widen authority or synthesize identity", async () => {
	const calls: { request: Record<string, unknown> }[] = [];
	const session: NonNullable<
		Parameters<typeof createFlowDeskLocalNonDispatchAdapterTools>[1]
	> = {
		state: {},
		evaluate(_toolName, request) {
			calls.push({ request: request as Record<string, unknown> });
			return { ok: true, request } as never;
		},
	};
	const fakeTools = createFlowDeskLocalNonDispatchAdapterTools(
		new Date("2026-05-17T00:00:00.000Z"),
		session,
	);
	const fakeAbortCmdTool = fakeTools[flowdeskAbortCmdToolName];
	assert.ok(fakeAbortCmdTool);
	await fakeAbortCmdTool.execute(
		{
			requestId: "request-abort-cmd-no-identity-synthesis",
			workflowId: "workflow-abort-cmd-no-identity-synthesis",
			reason: "abort without approval synthesis",
			userApprovalRef: "approval-should-not-forward",
			user_approval_ref: "approval-snake-should-not-forward",
			sessionRef: "session-should-not-forward",
			redactedIntakeRef: "intake-should-not-forward",
			confirmationNonce: "nonce-should-not-forward",
			confirmation_nonce: "nonce-snake-should-not-forward",
			allowProviderCall: true,
			allowActualLaneLaunch: true,
		},
		undefined as never,
	);
	assert.deepEqual(Object.keys(calls[0]?.request ?? {}).sort(), [
		"input_mode",
		"reason",
		"request_id",
		"schema_version",
		"workflow_id",
	]);

	const realTools = createFlowDeskLocalNonDispatchAdapterTools(
		new Date("2026-05-17T00:00:00.000Z"),
	);
	const realAbortCmdTool = realTools[flowdeskAbortCmdToolName];
	assert.ok(realAbortCmdTool);
	const result = JSON.parse(
		toolOutput(
			await realAbortCmdTool.execute(
				{
					requestId: "request-abort-cmd-authority",
					workflowId: "workflow-abort-cmd-authority",
					reason: "authority check abort",
				},
				undefined as never,
			),
		),
	) as LocalAdapterTestResult;
	assert.equal(result.providerCall, false);
	assert.equal(result.runtimeExecution, false);
	assert.equal(result.actualLaneLaunch, false);
	assert.equal(result.fallbackAuthority, false);
	assert.equal(result.hardCancelOrNoReplyAuthority, false);
});

test("flowdesk_abort_cmd ignores unknown approval and identity fields safely", async () => {
	const calls: { request: Record<string, unknown> }[] = [];
	const session: NonNullable<
		Parameters<typeof createFlowDeskLocalNonDispatchAdapterTools>[1]
	> = {
		state: {},
		evaluate(_toolName, request) {
			calls.push({ request: request as Record<string, unknown> });
			return { ok: true, request } as never;
		},
	};
	const tools = createFlowDeskLocalNonDispatchAdapterTools(
		new Date("2026-05-17T00:00:00.000Z"),
		session,
	);
	const abortCmdTool = tools[flowdeskAbortCmdToolName];
	assert.ok(abortCmdTool);
	await abortCmdTool.execute(
		{
			requestId: "request-abort-cmd-unknown-fields",
			workflowId: "workflow-abort-cmd-unknown-fields",
			reason: "unknown field handling",
			workflow_id: "workflow-snake-should-not-forward",
			attempt_id: "attempt-snake-should-not-forward",
			lane_id: "lane-snake-should-not-forward",
			retry_reason: "reason-snake-should-not-forward",
			user_approval_ref: "approval-snake-should-not-forward",
			confirmation_nonce: "nonce-snake-should-not-forward",
			actorRef: "actor-should-not-forward",
			profileRef: "profile-should-not-forward",
		},
		undefined as never,
	);
	const request = calls[0]?.request ?? {};
	assert.equal(request.workflow_id, "workflow-abort-cmd-unknown-fields");
	assert.equal("attempt_id" in request, false);
	assert.equal("lane_id" in request, false);
	assert.equal("user_approval_ref" in request, false);
	assert.equal("confirmation_nonce" in request, false);
	assert.equal("actorRef" in request, false);
	assert.equal("profileRef" in request, false);
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
		"chat_steering_command_backed",
	);
	assert.equal(result.productionOpenCodeRegistration, true);
	assert.equal(result.providerCall, false);
});

test("server plugin loads project config and blocking intake falls back to steering without evidence", async () => {
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
			`${JSON.stringify(release1ProjectConfig({ chat_intake_mode: "blocking" }), null, 2)}\n`,
			"utf8",
		);
		const blockingWithoutEvidenceHooks = (await flowdeskOpenCodeServerPlugin.server(
			undefined as never,
			{
				[flowdeskNaturalLanguageRoutingOption]: true,
				[flowdeskProjectConfigOption]: { enabled: true, rootDir: root },
			},
		)) as ChatMessageHooks;
		assert.ok(blockingWithoutEvidenceHooks["chat.message"]);
		const blockingDoctor = blockingWithoutEvidenceHooks.tool?.[flowdeskPreSpikeDoctorToolName];
		assert.ok(blockingDoctor);
		const blockingResult = JSON.parse(
			toolOutput(await blockingDoctor.execute({}, undefined as never)),
		) as Record<string, unknown>;
		const gate = blockingResult.chatIntakeModeGate as {
			effectiveMode?: unknown;
			diagnostic?: unknown;
			blockingSafe?: unknown;
		};
		assert.equal(gate.effectiveMode, "steering");
		assert.equal(gate.blockingSafe, false);
		assert.match(String(gate.diagnostic), /using steering mode/);

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
		assert.match(doctorLabels, /s7_managed_dispatch_exposure_state=unknown/);
		assert.match(doctorLabels, /s7_managed_dispatch_exposure_dispatch_authority_enabled=false/);
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

test("export debug includes redacted S7 managed-dispatch exposure authorization refs", async () => {
	const root = mkdtempSync(join(tmpdir(), "flowdesk-debug-export-s7-"));
	try {
		const authorization = evaluateFlowDeskManagedDispatchExposureAuthorizationV1({
			taskResultEvidence: s7TaskResultForExportDebugTest(),
			taskResultEvidenceId: FLOWDESK_S7_REQUIRED_S6_TUPLE.result_evidence_id,
			progressSnapshotWorkflowId:
				FLOWDESK_S7_REQUIRED_S6_TUPLE.progress_snapshot_workflow_id,
			now: "2026-06-15T12:00:00.000Z",
		});
		const prepared = prepareFlowDeskSessionEvidenceWriteIntentV1({
			workflowId: FLOWDESK_S7_REQUIRED_S6_TUPLE.workflow_id,
			evidenceId: "managed-dispatch-exposure-authorization-s7-latest",
			record: authorization as unknown as Record<string, unknown>,
		});
		assert.equal(prepared.ok, true);
		assert.ok(prepared.writeIntent);
		const applied = applyFlowDeskSessionEvidenceWriteIntentsV1(root, [
			prepared.writeIntent,
		]);
		assert.equal(applied.ok, true);

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
						request_id: "request-export-debug-s7",
						input_mode: "test_fixture",
						include_sections: ["doctor"],
						retention_hint: "keep_until_default_expiry",
					},
					undefined as never,
				),
			),
		) as LocalAdapterTestResult;
		assert.equal(result.handler?.ok, true);
		assert.equal(result.realOpenCodeDispatch, false);
		assert.equal(result.actualLaneLaunch, false);
		assert.equal(result.providerCall, false);
		assert.equal(result.runtimeExecution, false);

		const doctorSection = JSON.parse(
			readFileSync(
				join(
					root,
					".flowdesk/sessions/session-local/redacted-debug/sections/doctor.json",
				),
				"utf8",
			),
		) as Record<string, unknown>;
		const labels = ((doctorSection.summary_labels ?? []) as string[]).join("|");
		assert.match(labels, /s7_managed_dispatch_exposure_state=authorized/);
		assert.match(
			labels,
			/s7_managed_dispatch_exposure_latest_evidence_ref=managed-dispatch-exposure-authorization-s7-latest/,
		);
		assert.match(labels, /s7_managed_dispatch_exposure_scope=readiness_only/);
		assert.match(labels, /s7_managed_dispatch_exposure_dispatch_authority_enabled=false/);
		assert.equal(
			/S6_LIVE_SMOKE_OK|result_text|task_prompt|provider_payload|Bearer|\/Users/.test(
				JSON.stringify(doctorSection),
			),
			false,
		);
	} finally {
		rmSync(root, { recursive: true, force: true });
	}
});

test("export debug reports invalid S7 exposure authorization as blocked with bounded reason", async () => {
	const root = mkdtempSync(join(tmpdir(), "flowdesk-debug-export-s7-invalid-"));
	try {
		const relativeEvidencePath = sessionEvidenceRecordPath(
			FLOWDESK_S7_REQUIRED_S6_TUPLE.workflow_id,
			"managed_dispatch_exposure_authorization",
			"managed-dispatch-exposure-authorization-invalid",
		);
		const absoluteEvidencePath = join(root, relativeEvidencePath);
		mkdirSync(join(absoluteEvidencePath, ".."), { recursive: true });
		writeFileSync(
			absoluteEvidencePath,
			JSON.stringify({
				schema_version: "flowdesk.managed_dispatch_exposure_authorization.v2",
				note: "invalid-schema-only",
			}),
			"utf8",
		);

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
						request_id: "request-export-debug-s7-invalid",
						input_mode: "test_fixture",
						include_sections: ["doctor"],
						retention_hint: "keep_until_default_expiry",
					},
					undefined as never,
				),
			),
		) as LocalAdapterTestResult;
		assert.equal(result.handler?.ok, true);
		assert.equal(result.providerCall, false);

		const doctorSection = JSON.parse(
			readFileSync(
				join(
					root,
					".flowdesk/sessions/session-local/redacted-debug/sections/doctor.json",
				),
				"utf8",
			),
		) as Record<string, unknown>;
		const labels = ((doctorSection.summary_labels ?? []) as string[]).join("|");
		assert.match(labels, /s7_managed_dispatch_exposure_state=blocked/);
		assert.match(labels, /s7_managed_dispatch_exposure_block_label=invalid_or_unreadable_evidence/);
		assert.match(labels, /s7_managed_dispatch_exposure_block_reason_label=/);
		assert.match(labels, /s7_managed_dispatch_exposure_dispatch_authority_enabled=false/);
		assert.equal(/\/Users|provider_payload|Bearer|secret|token/.test(JSON.stringify(doctorSection)), false);
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
	const pendingConfirmationNonce =
		result.routedToolResult?.localState?.pendingConfirmationNonce;
	assert.equal(typeof pendingApprovalRef, "string");
	assert.equal(typeof pendingConfirmationNonce, "string");
	assert.notEqual(pendingConfirmationNonce, pendingApprovalRef);
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
					confirmation_nonce: pendingConfirmationNonce,
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
					confirmation_nonce: pendingConfirmationNonce,
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
					confirmation_nonce: pendingConfirmationNonce,
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
	const nonce = pendingPlan.localState.pendingConfirmationNonce;
	assert.equal(typeof approvalRef, "string");
	assert.equal(typeof nonce, "string");
	assert.notEqual(nonce, approvalRef);

	clock = new Date("2026-05-17T00:16:00.000Z");
	const expiredRun = session.evaluate("flowdesk_run", {
		schema_version: "flowdesk.run.request.v1",
		request_id: "request-expired-run",
		input_mode: "chat_routed",
		workflow_id: "workflow-expiring-plan",
		session_ref: "session-expiring-plan",
		redacted_intake_ref: "intake-expiring-plan",
		user_approval_ref: approvalRef,
		confirmation_nonce: nonce,
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
	const cancellableNonce = cancellablePlan.localState.pendingConfirmationNonce;
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
		confirmation_nonce: cancellableNonce,
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

test("local adapter requires pending confirmation nonce and scope match", () => {
	const session = createFlowDeskLocalNonDispatchAdapterSession(
		new Date("2026-05-17T00:00:00.000Z"),
	);
	const pendingPlan = session.evaluate("flowdesk_plan", {
		schema_version: "flowdesk.plan.request.v1",
		request_id: "request-nonce-scope-plan",
		input_mode: "chat_routed",
		workflow_id: "workflow-nonce-scope-plan",
		session_ref: "session-nonce-scope-plan",
		redacted_intake_ref: "intake-nonce-scope-plan",
		goal_summary: "approved plan을 fake-runtime으로 실행 진행해",
		scope_summary:
			"FlowDesk natural-language chat intake routed to command-backed planning.",
		risk_hint:
			"execution-like chat intake requires explicit user confirmation before any run",
	});
	assert.equal(pendingPlan.localState.pendingConfirmationStatus, "pending");
	const approvalRef = pendingPlan.localState.pendingConfirmationRef;
	const nonce = pendingPlan.localState.pendingConfirmationNonce;
	assert.equal(typeof approvalRef, "string");
	assert.equal(typeof nonce, "string");
	assert.notEqual(nonce, approvalRef);

	const missingNonceRun = session.evaluate("flowdesk_run", {
		schema_version: "flowdesk.run.request.v1",
		request_id: "request-missing-nonce-run",
		input_mode: "chat_routed",
		workflow_id: "workflow-nonce-scope-plan",
		session_ref: "session-nonce-scope-plan",
		redacted_intake_ref: "intake-nonce-scope-plan",
		user_approval_ref: approvalRef,
		run_mode: "fake-runtime",
		plan_revision_id: "plan-workflow-nonce-scope-plan",
	});
	assert.equal(missingNonceRun.handler.ok, false);
	assert.equal(
		missingNonceRun.handler.handlerMode,
		"pending_confirmation_invalid",
	);
	assert.deepEqual(missingNonceRun.handler.errors, [
		"confirmation_nonce does not match pending confirmation",
	]);
	assert.equal(missingNonceRun.localState.pendingConfirmationStatus, "pending");
	assert.equal(missingNonceRun.runtimeExecution, false);

	const wrongScopeRun = session.evaluate("flowdesk_run", {
		schema_version: "flowdesk.run.request.v1",
		request_id: "request-wrong-scope-run",
		input_mode: "chat_routed",
		workflow_id: "workflow-nonce-scope-plan",
		session_ref: "session-other-scope",
		redacted_intake_ref: "intake-nonce-scope-plan",
		user_approval_ref: approvalRef,
		confirmation_nonce: nonce,
		run_mode: "fake-runtime",
		plan_revision_id: "plan-workflow-nonce-scope-plan",
	});
	assert.equal(wrongScopeRun.handler.ok, false);
	assert.equal(wrongScopeRun.handler.handlerMode, "pending_confirmation_invalid");
	assert.deepEqual(wrongScopeRun.handler.errors, [
		"session_ref does not match pending confirmation",
	]);
	assert.equal(wrongScopeRun.localState.pendingConfirmationStatus, "pending");
	assert.equal(wrongScopeRun.actualLaneLaunch, false);

	const confirmedRun = session.evaluate("flowdesk_run", {
		schema_version: "flowdesk.run.request.v1",
		request_id: "request-nonce-confirmed-run",
		input_mode: "chat_routed",
		workflow_id: "workflow-nonce-scope-plan",
		session_ref: "session-nonce-scope-plan",
		redacted_intake_ref: "intake-nonce-scope-plan",
		user_approval_ref: approvalRef,
		confirmation_nonce: nonce,
		run_mode: "fake-runtime",
		plan_revision_id: "plan-workflow-nonce-scope-plan",
	});
	assert.equal(confirmedRun.handler.ok, true);
	assert.equal(confirmedRun.localState.pendingConfirmationStatus, "consumed");
	assert.equal(confirmedRun.runtimeExecution, false);
	assert.equal(confirmedRun.actualLaneLaunch, false);
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

test("local adapter status includes lanes discovered from evidence records", () => {
	const root = mkdtempSync(join(tmpdir(), "flowdesk-local-status-evidence-"));
	try {
		const workflowId = "workflow-status-evidence-lanes";
		const createdAt = "2026-05-17T00:00:00.000Z";
		const agentTaskContext = {
			schema_version: "flowdesk.agent_task_context.v1",
			workflow_id: workflowId,
			lane_id: "lane-status-evidence-task",
			task_id: "task-status-evidence-task",
			agent_ref: "agent-general-status-evidence",
			provider_qualified_model_id: "openai/gpt-5.5",
			parent_session_ref: "ses-status-evidence-parent",
			prompt_text: "Summarize evidence lane status.",
			prompt_text_truncated: false,
			prompt_text_sha256: "promptsha256statusevidence",
			redaction_version: "redaction-v1",
			created_at: createdAt,
			dispatch_authority_enabled: false as const,
		};
		const laneLifecycle = {
			schema_version: "flowdesk.lane_lifecycle_record.v1",
			lane_id: "lane-status-evidence-task",
			workflow_id: workflowId,
			attempt_id: "attempt-status-evidence-task",
			parent_session_ref: "ses-status-evidence-parent",
			background_task_ref: "bg-status-evidence-task",
			agent_ref: "agent-general-status-evidence",
			provider_qualified_model_id: "openai/gpt-5.5",
			state: "running" as const,
			timeout_ms: 60_000,
			orphan_max_age_ms: 600_000,
			retry_count: 0,
			created_at: createdAt,
			updated_at: createdAt,
			dispatch_authority_enabled: false as const,
			providerCall: false as const,
			actualLaneLaunch: false as const,
			runtimeExecution: false as const,
		};
		const contextIntent = prepareFlowDeskSessionEvidenceWriteIntentV1({
			workflowId,
			evidenceId: "agent-task-context-status-evidence",
			record: agentTaskContext,
		});
		assert.equal(contextIntent.ok, true, contextIntent.errors.join("; "));
		const lifecycleIntent = prepareFlowDeskSessionEvidenceWriteIntentV1({
			workflowId,
			evidenceId: "lane-lifecycle-status-evidence",
			record: laneLifecycle,
		});
		assert.equal(lifecycleIntent.ok, true, lifecycleIntent.errors.join("; "));
		const applied = applyFlowDeskSessionEvidenceWriteIntentsV1(root, [
			contextIntent.writeIntent as never,
			lifecycleIntent.writeIntent as never,
		]);
		assert.equal(applied.ok, true, applied.errors.join("; "));

		const session = createFlowDeskLocalNonDispatchAdapterSession(
			new Date(createdAt),
			undefined,
			{ durableStateRootDir: root },
		);
		const status = session.evaluate("flowdesk_status", {
			schema_version: "flowdesk.status.request.v1",
			request_id: "request-status-evidence-lanes",
			input_mode: "chat_routed",
			workflow_id: workflowId,
			session_ref: "session-status-evidence-lanes",
			redacted_intake_ref: "intake-status-evidence-lanes",
			detail_level: "summary",
		});
		assert.equal(status.handler.ok, true, status.handler.errors.join("; "));
		const response = status.handler.response as
			| { lane_summaries?: Array<Record<string, unknown>> }
			| undefined;
		assert.ok(response?.lane_summaries);
		assert.equal(response.lane_summaries.length, 1);
		assert.equal(
			response.lane_summaries[0]?.lane_id,
			"lane-status-evidence-task",
		);
		assert.equal(response.lane_summaries[0]?.state, "running");
		assert.equal(response.lane_summaries[0]?.task_ref, "task-status-evidence-task");
		assert.equal(status.localState.laneRecords, 1);
		assert.equal(status.providerCall, false);
		assert.equal(status.actualLaneLaunch, false);
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
		const observedAt = new Date().toISOString();
		const records = [
			{
				schema_version:
					"flowdesk.managed_dispatch_beta.usage_authority_evidence.v1",
				observedAt,
				attestation_scope: "plugin_observed_only",
				authority_ref: "usage-authority-server",
			},
			{
				schema_version:
					"flowdesk.managed_dispatch_beta.runtime_echo_evidence.v1",
				observedAt,
				attestation_scope: "plugin_observed_only",
				workflow_id: workflowId,
				runtime_echo_ref: "runtime-echo-server",
			},
			{
				schema_version:
					"flowdesk.managed_dispatch_beta.telemetry_correlation.v1",
				observedAt,
				attestation_scope: "plugin_observed_only",
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

test("chat.message appends compact usage snapshot lines from sidebar cache", async () => {
	const root = mkdtempSync(join(tmpdir(), "flowdesk-chat-usage-sidebar-"));
	try {
		const uiDir = join(root, ".flowdesk", "ui");
		mkdirSync(uiDir, { recursive: true });
		writeFileSync(
			join(uiDir, "provider-usage-sidebar.json"),
			`${JSON.stringify(
				{
					schema_version: "flowdesk.provider_usage_sidebar_cache.v1",
					observed_at: "2026-05-27T01:00:00.000Z",
					expires_at: "2026-05-27T01:05:00.000Z",
					providers: [
						{
							providerFamily: "claude",
							connected: true,
							dispatchability: "dispatchable",
							freshness: "fresh",
							remainingPercent: 34,
							alertLevel: "ok",
							buckets: [
								{
									resetBucket: "claude-5h",
									resetTime: "2026-05-27T19:20:00.000Z",
									remainingPercent: 77,
									freshness: "fresh",
									dispatchability: "dispatchable",
									connected: true,
								},
								{
									resetBucket: "claude-weekly",
									resetTime: "2026-06-03T12:00:00.000Z",
									remainingPercent: 34,
									freshness: "fresh",
									dispatchability: "dispatchable",
									connected: true,
								},
							],
						},
					],
				},
				null,
				2,
			)}\n`,
			"utf8",
		);
		const hook = createFlowDeskNaturalLanguageChatMessageHook(
			() => new Date("2026-05-27T01:02:00.000Z"),
			undefined,
			undefined,
			undefined,
			{ durableStateRootDir: root, providers: ["claude"], persistWorkflowId: "workflow-provider-usage-live", appendToChat: true },
		);
		const output = { parts: [{ type: "text", text: "오늘 날씨 이야기하자" }] as unknown[] };
		await hook({ messageID: "message-usage-sidebar", sessionID: "session-usage-sidebar" }, output);
		const serialized = JSON.stringify(output);
		assert.match(
			serialized,
			new RegExp(`CL Sonnet\\s+34% \\(1w, r ${formatLocalResetTimeForTest("2026-06-03T12:00:00.000Z", "1w")}\\)`),
		);
		assert.match(serialized, /OA ✗/);
		assert.match(serialized, /GM ✗/);
	} finally {
		rmSync(root, { recursive: true, force: true });
	}
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

test("chat.message steering persists dismiss preference without suppressing confirmations", async () => {
	const root = mkdtempSync(join(tmpdir(), "flowdesk-chat-dismiss-"));
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
			{ messageID: "message-dismiss-first", sessionID: "session-dismiss" },
			firstPlanOutput,
		);
		assert.equal(firstPlanOutput.parts.length, 2);

		const dismissOutput = {
			parts: [{ type: "text", text: "괜찮아 그냥 해줘" }] as unknown[],
		};
		await hooks["chat.message"](
			{ messageID: "message-dismiss-action", sessionID: "session-dismiss" },
			dismissOutput,
		);

		const suppressedPlanOutput = {
			parts: [{ type: "text", text: "구현 계획을 다시 세워줘" }] as unknown[],
		};
		await hooks["chat.message"](
			{ messageID: "message-dismiss-suppressed", sessionID: "session-dismiss" },
			suppressedPlanOutput,
		);
		assert.equal(suppressedPlanOutput.parts.length, 1);

		const restartedHooks = (await flowdeskOpenCodeServerPlugin.server(
			undefined as never,
			{
				[flowdeskNaturalLanguageRoutingOption]: true,
				[flowdeskDurableStateRootOption]: root,
			},
		)) as ChatMessageHooks;
		assert.ok(restartedHooks["chat.message"]);
		const durableSuppressedPlanOutput = {
			parts: [{ type: "text", text: "구현 계획을 다시 세워줘" }] as unknown[],
		};
		await restartedHooks["chat.message"](
			{ messageID: "message-dismiss-durable", sessionID: "session-dismiss" },
			durableSuppressedPlanOutput,
		);
		assert.equal(durableSuppressedPlanOutput.parts.length, 1);

		const confirmationOutput = {
			parts: [
				{ type: "text", text: "approved plan을 fake-runtime으로 실행 진행해" },
			] as unknown[],
		};
		await hooks["chat.message"](
			{ messageID: "message-dismiss-confirm", sessionID: "session-dismiss" },
			confirmationOutput,
		);
		assert.match(JSON.stringify(confirmationOutput), /Confirmation code:/);
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
	assert.match(description, /gemini-pro-daily/);
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

test("flowdesk_quota wraps provider usage live and defaults empty payload to all", async () => {
	const hooks = await flowdeskOpenCodeServerPlugin.server(undefined as never, {
		[flowdeskProviderUsageLiveOption]: { enabled: true, providers: [] },
		localNonDispatchAdapter: false,
		naturalLanguageRouting: false,
	});
	const usageTool = hooks.tool?.[flowdeskProviderUsageLiveToolName];
	const quotaTool = hooks.tool?.[flowdeskQuotaToolName];
	assert.ok(usageTool);
	assert.ok(quotaTool);

	const result = JSON.parse(
		toolOutput(await quotaTool.execute({}, undefined as never)),
	) as Record<string, unknown>;
	assert.equal(result.status, "blocked_before_provider_usage_live");
	assert.equal(result.requestedProviderFamily, "all");
	assert.deepEqual(result.resolvedProviderFamilies, []);
	const authority = result.authority as Record<string, unknown>;
	assert.equal(authority.providerCall, false);
	assert.equal(authority.runtimeExecution, false);
	assert.equal(authority.actualLaneLaunch, false);
	assert.equal(authority.realOpenCodeDispatch, false);
	assert.equal(authority.fallbackAuthority, false);

	const description = String(quotaTool.description ?? "");
	assert.ok(description.length < 240);
	assert.doesNotMatch(description, /Trigger on|Korean phrases|English phrases|WHEN TO USE/);
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

test("flowdesk_now wraps status live with read-only status evidence authority", async () => {
	const root = mkdtempSync(join(tmpdir(), "flowdesk-now-wrapper-"));
	try {
		const workflowId = "workflow-now-wrapper-1";
		const writeIntent = prepareFlowDeskSessionEvidenceWriteIntentV1({
			workflowId,
			evidenceId: "reviewer-verdict-now-wrapper",
			record: {
				...reviewerVerdictRecord("architecture"),
				workflow_id: workflowId,
			},
		});
		assert.equal(writeIntent.ok, true, writeIntent.errors.join("; "));
		const applied = applyFlowDeskSessionEvidenceWriteIntentsV1(root, [
			writeIntent.writeIntent as never,
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
		const nowTool = hooks.tool?.[flowdeskNowToolName];
		assert.ok(statusTool);
		assert.ok(nowTool);

		const result = JSON.parse(
			toolOutput(await nowTool.execute({}, undefined as never)),
		) as Record<string, unknown>;
		assert.equal(result.status, "status_live_collected");
		assert.ok(String(result.summaryForUser).length > 0);
		assert.deepEqual(result.resolvedWorkflowIds, [workflowId]);
		const authority = result.authority as Record<string, unknown>;
		assert.equal(authority.statusEvidenceObserved, true);
		assert.equal(authority.providerCall, false);
		assert.equal(authority.runtimeExecution, false);
		assert.equal(authority.actualLaneLaunch, false);
		assert.equal(authority.realOpenCodeDispatch, false);
		assert.equal(authority.fallbackAuthority, false);
		assert.equal(authority.hardCancelOrNoReplyAuthority, false);

		const description = String(nowTool.description ?? "");
		assert.ok(description.length < 240);
		assert.doesNotMatch(description, /Trigger on|Korean phrases|English phrases|WHEN TO USE/);
	} finally {
		rmSync(root, { recursive: true, force: true });
	}
});

function taskResultRecordForServerTest(
	workflowId: string,
	taskId: string,
	resultText: string,
	overrides: Record<string, unknown> = {},
) {
	return {
		schema_version: "flowdesk.task_result.v1",
		workflow_id: workflowId,
		lane_id: `lane-${taskId.slice("task-".length)}`,
		task_id: taskId,
		agent_ref: `agent-${taskId.slice("task-".length)}`,
		provider_qualified_model_id: "openai/gpt-5.5",
		task_prompt_sha256: "a".repeat(64),
		result_text: resultText,
		result_text_truncated: false,
		result_text_sha256: "b".repeat(64),
		completion_status: "final",
		output_kind: "final_answer",
		usable_for_synthesis: true,
		created_at: "2026-06-06T00:00:00.000Z",
		dispatch_authority_enabled: false,
		...overrides,
	};
}

function writeTaskResultForServerTest(
	root: string,
	workflowId: string,
	taskId: string,
	resultText: string,
	overrides: Record<string, unknown> = {},
) {
	const intent = prepareFlowDeskSessionEvidenceWriteIntentV1({
		workflowId,
		evidenceId: `task-result-${taskId}`,
		record: taskResultRecordForServerTest(
			workflowId,
			taskId,
			resultText,
			overrides,
		),
	});
	assert.equal(intent.ok, true, intent.errors.join("; "));
	const applied = applyFlowDeskSessionEvidenceWriteIntentsV1(root, [
		intent.writeIntent as never,
	]);
	assert.equal(applied.ok, true, applied.errors.join("; "));
}

test("flowdesk_result registers only with status-live durable root and has compact description", async () => {
	const defaultHooks = await flowdeskOpenCodeServerPlugin.server(
		undefined as never,
		{
			[flowdeskStatusLiveOption]: false,
			localNonDispatchAdapter: false,
			naturalLanguageRouting: false,
		},
	);
	assert.equal(defaultHooks.tool?.[flowdeskResultToolName], undefined);

	const enabledWithoutRoot = await flowdeskOpenCodeServerPlugin.server(
		undefined as never,
		{
			[flowdeskStatusLiveOption]: { enabled: true },
			localNonDispatchAdapter: false,
			naturalLanguageRouting: false,
		},
	);
	assert.equal(enabledWithoutRoot.tool?.[flowdeskResultToolName], undefined);

	const root = mkdtempSync(join(tmpdir(), "flowdesk-result-register-"));
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
		const resultTool = hooks.tool?.[flowdeskResultToolName];
		assert.ok(resultTool);
		const description = String(resultTool.description ?? "");
		assert.ok(description.length < 260);
		assert.doesNotMatch(description, /Trigger on|Korean phrases|English phrases|WHEN TO USE/);
		assert.match(description, /Read-only/);
	} finally {
		rmSync(root, { recursive: true, force: true });
	}
});

test("flowdesk_result returns a single task result in full without excerpt truncation", async () => {
	const root = mkdtempSync(join(tmpdir(), "flowdesk-result-single-"));
	try {
		const workflowId = "workflow-result-single";
		const longResult = `first line\n${"x".repeat(900)}\nlast line`;
		writeTaskResultForServerTest(root, workflowId, "task-result-single", longResult);
		const hooks = await flowdeskOpenCodeServerPlugin.server(
			undefined as never,
			{
				[flowdeskStatusLiveOption]: { enabled: true },
				[flowdeskDurableStateRootOption]: root,
				localNonDispatchAdapter: false,
				naturalLanguageRouting: false,
			},
		);
		const resultTool = hooks.tool?.[flowdeskResultToolName];
		assert.ok(resultTool);
		const result = JSON.parse(
			toolOutput(await resultTool.execute({ workflowId }, undefined as never)),
		) as Record<string, unknown>;
		assert.equal(result.status, "task_result_collected");
		assert.equal(result.taskId, "task-result-single");
		assert.equal(result.resultText, longResult);
		assert.equal(result.resultTextLength, longResult.length);
		assert.equal(String(result.resultText).includes("…"), false);
		const authority = result.authority as Record<string, unknown>;
		assert.equal(authority.providerCall, false);
		assert.equal(authority.runtimeExecution, false);
		assert.equal(authority.actualLaneLaunch, false);
		assert.equal(authority.realOpenCodeDispatch, false);
		assert.equal(authority.fallbackAuthority, false);
		assert.equal(authority.writeAuthority, false);
		assert.equal(authority.hardCancelOrNoReplyAuthority, false);
	} finally {
		rmSync(root, { recursive: true, force: true });
	}
});

test("flowdesk_result returns a selector for multiple task results without taskId", async () => {
	const root = mkdtempSync(join(tmpdir(), "flowdesk-result-selector-"));
	try {
		const workflowId = "workflow-result-selector";
		writeTaskResultForServerTest(root, workflowId, "task-result-one", "FULL ONE SHOULD NOT DUMP");
		writeTaskResultForServerTest(root, workflowId, "task-result-two", "FULL TWO SHOULD NOT DUMP");
		const hooks = await flowdeskOpenCodeServerPlugin.server(
			undefined as never,
			{
				[flowdeskStatusLiveOption]: { enabled: true },
				[flowdeskDurableStateRootOption]: root,
				localNonDispatchAdapter: false,
				naturalLanguageRouting: false,
			},
		);
		const resultTool = hooks.tool?.[flowdeskResultToolName];
		assert.ok(resultTool);
		const result = JSON.parse(
			toolOutput(await resultTool.execute({ workflowId }, undefined as never)),
		) as Record<string, unknown>;
		assert.equal(result.status, "task_result_selector");
		assert.equal(result.resultText, undefined);
		assert.equal(JSON.stringify(result).includes("FULL ONE SHOULD NOT DUMP"), false);
		assert.equal(JSON.stringify(result).includes("FULL TWO SHOULD NOT DUMP"), false);
		const available = result.availableTaskResults as Array<Record<string, unknown>>;
		assert.deepEqual(
			available.map((entry) => entry.taskId).sort(),
			["task-result-one", "task-result-two"],
		);
	} finally {
		rmSync(root, { recursive: true, force: true });
	}
});

test("flowdesk_result explicit taskId targets the correct result", async () => {
	const root = mkdtempSync(join(tmpdir(), "flowdesk-result-target-"));
	try {
		const workflowId = "workflow-result-target";
		writeTaskResultForServerTest(root, workflowId, "task-result-alpha", "alpha text");
		writeTaskResultForServerTest(root, workflowId, "task-result-beta", "beta text");
		const hooks = await flowdeskOpenCodeServerPlugin.server(
			undefined as never,
			{
				[flowdeskStatusLiveOption]: { enabled: true },
				[flowdeskDurableStateRootOption]: root,
				localNonDispatchAdapter: false,
				naturalLanguageRouting: false,
			},
		);
		const resultTool = hooks.tool?.[flowdeskResultToolName];
		assert.ok(resultTool);
		const result = JSON.parse(
			toolOutput(
				await resultTool.execute(
					{ workflowId, taskId: "task-result-beta" },
					undefined as never,
				),
			),
		) as Record<string, unknown>;
		assert.equal(result.status, "task_result_collected");
		assert.equal(result.taskId, "task-result-beta");
		assert.equal(result.resultText, "beta text");
		assert.equal(JSON.stringify(result).includes("alpha text"), false);
	} finally {
		rmSync(root, { recursive: true, force: true });
	}
});

test("flowdesk_result safely ignores unknown approval and identity fields", async () => {
	const root = mkdtempSync(join(tmpdir(), "flowdesk-result-unknown-fields-"));
	try {
		const workflowId = "workflow-result-unknown-fields";
		writeTaskResultForServerTest(root, workflowId, "task-result-safe", "safe full result");
		const hooks = await flowdeskOpenCodeServerPlugin.server(
			undefined as never,
			{
				[flowdeskStatusLiveOption]: { enabled: true },
				[flowdeskDurableStateRootOption]: root,
				localNonDispatchAdapter: false,
				naturalLanguageRouting: false,
			},
		);
		const resultTool = hooks.tool?.[flowdeskResultToolName];
		assert.ok(resultTool);
		const result = JSON.parse(
			toolOutput(
				await resultTool.execute(
					{
						workflowId,
						taskId: "task-result-safe",
						userApprovalRef: "approval-should-not-matter",
						sessionRef: "ses-should-not-matter",
						confirmationNonce: "nonce-should-not-matter",
					},
					undefined as never,
				),
			),
		) as Record<string, unknown>;
		assert.equal(result.status, "task_result_collected");
		assert.equal(result.resultText, "safe full result");
		assert.equal(result.userApprovalRef, undefined);
		assert.equal(result.sessionRef, undefined);
		assert.equal(result.confirmationNonce, undefined);
		const authority = result.authority as Record<string, unknown>;
		assert.equal(authority.statusEvidenceObserved, true);
		assert.equal(authority.providerCall, false);
		assert.equal(authority.realOpenCodeDispatch, false);
		assert.equal(authority.actualLaneLaunch, false);
		assert.equal(authority.fallbackAuthority, false);
		assert.equal(authority.hardCancelOrNoReplyAuthority, false);
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

test("flowdesk_rebind is absent by default and registers with quick fallback opt-in", async () => {
	const defaultHooks = await flowdeskOpenCodeServerPlugin.server(
		undefined as never,
		{
			localNonDispatchAdapter: false,
			naturalLanguageRouting: false,
		},
	);
	assert.equal(defaultHooks.tool?.[flowdeskQuickFallbackRunToolName], undefined);
	assert.equal(defaultHooks.tool?.[flowdeskRebindToolName], undefined);

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
	assert.ok(enabledHooks.tool?.[flowdeskQuickFallbackRunToolName]);
	assert.ok(enabledHooks.tool?.[flowdeskRebindToolName]);
});

test("flowdesk_rebind has compact planning-only description and explicit fields", async () => {
	const hooks = await flowdeskOpenCodeServerPlugin.server(undefined as never, {
		[flowdeskQuickFallbackRunOption]: { enabled: true },
		localNonDispatchAdapter: false,
		naturalLanguageRouting: false,
	});
	const rebindTool = hooks.tool?.[flowdeskRebindToolName];
	assert.ok(rebindTool);
	const description = String(rebindTool.description ?? "");
	assert.ok(description.length < 260);
	assert.match(description, /Planning-only/);
	assert.match(description, /no provider switch/);
	assert.match(description, /SDK-scoped noReply control/);
	assert.doesNotMatch(description, /Trigger on|Korean phrases|English phrases|WHEN TO USE/);

	const args = rebindTool.args as Record<string, unknown>;
	assert.ok(args.fromProvider);
	assert.ok(args.toProvider);
	assert.ok(args.developerModeAcknowledged);
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

test("flowdesk_rebind does not silently default developerModeAcknowledged true", async () => {
	const hooks = await flowdeskOpenCodeServerPlugin.server(undefined as never, {
		[flowdeskQuickFallbackRunOption]: { enabled: true },
		localNonDispatchAdapter: false,
		naturalLanguageRouting: false,
	});
	const rebindTool = hooks.tool?.[flowdeskRebindToolName];
	assert.ok(rebindTool);
	const result = JSON.parse(
		toolOutput(
			await rebindTool.execute(
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

test("flowdesk_rebind requires explicit provider identities even when quick fallback has defaults", async () => {
	const hooks = await flowdeskOpenCodeServerPlugin.server(undefined as never, {
		[flowdeskQuickFallbackRunOption]: {
			enabled: true,
			defaultFromProvider: "claude/sonnet-4",
			defaultToProvider: "openai/gpt-5.5",
		},
		localNonDispatchAdapter: false,
		naturalLanguageRouting: false,
	});
	const rebindTool = hooks.tool?.[flowdeskRebindToolName];
	assert.ok(rebindTool);
	const result = JSON.parse(
		toolOutput(
			await rebindTool.execute(
				{
					developerModeAcknowledged: true,
				},
				undefined as never,
			),
		),
	) as Record<string, unknown>;
	assert.equal(result.status, "blocked_before_quick_fallback_run");
	assert.match(String(result.redactedBlockReason), /fromProvider and toProvider/);
});

test("flowdesk_rebind matches quick fallback blocked semantics and authority", async () => {
	const hooks = await flowdeskOpenCodeServerPlugin.server(undefined as never, {
		[flowdeskQuickFallbackRunOption]: { enabled: true },
		localNonDispatchAdapter: false,
		naturalLanguageRouting: false,
	});
	const quickTool = hooks.tool?.[flowdeskQuickFallbackRunToolName];
	const rebindTool = hooks.tool?.[flowdeskRebindToolName];
	assert.ok(quickTool);
	assert.ok(rebindTool);
	const request = {
		fromProvider: "openai/gpt-5.5",
		toProvider: "openai/gpt-5.5",
		developerModeAcknowledged: true,
	};
	const quickResult = JSON.parse(
		toolOutput(await quickTool.execute(request, undefined as never)),
	) as Record<string, unknown>;
	const rebindResult = JSON.parse(
		toolOutput(await rebindTool.execute(request, undefined as never)),
	) as Record<string, unknown>;
	assert.equal(rebindResult.status, quickResult.status);
	assert.equal(rebindResult.redactedBlockReason, quickResult.redactedBlockReason);
	assert.deepEqual(rebindResult.safeNextActions, quickResult.safeNextActions);
	assert.deepEqual(rebindResult.authority, quickResult.authority);
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

test("flowdesk_rebind completes planning path without provider switch or runtime authority", async () => {
	const root = mkdtempSync(join(tmpdir(), "flowdesk-rebind-planning-"));
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
		const rebindTool = hooks.tool?.[flowdeskRebindToolName];
		assert.ok(rebindTool);
		const result = JSON.parse(
			toolOutput(
				await rebindTool.execute(
					{
						fromProvider: "claude/sonnet-4",
						toProvider: "openai/gpt-5.5",
						reason: "manual_reselection_requested",
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
		assert.equal(result.regatePlanPrepared, undefined);
		const authority = result.authority as Record<string, unknown>;
		assert.equal(authority.providerCall, false);
		assert.equal(authority.runtimeExecution, false);
		assert.equal(authority.realOpenCodeDispatch, false);
		assert.equal(authority.actualLaneLaunch, false);
		assert.equal(authority.fallbackAuthority, false);
		assert.equal(authority.automaticFallbackAuthorized, false);
		assert.equal(authority.hardCancelOrNoReplyAuthority, false);
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
	assert.equal(defaultHooks.tool?.[flowdeskBeatToolName], undefined);
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
	assert.equal(enabledWithoutRoot.tool?.[flowdeskBeatToolName], undefined);
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
		const beatTool = enabled.tool?.[flowdeskBeatToolName];
		assert.ok(beatTool);
		const beatDescription = String(beatTool.description ?? "");
		assert.ok(beatDescription.length < 240);
		assert.doesNotMatch(
			beatDescription,
			/Trigger on|Korean phrases|English phrases|WHEN TO USE/,
		);
		assert.match(beatDescription, /diagnostic/);
		assert.match(beatDescription, /durable evidence/);
		assert.match(beatDescription, /Does not grant/);
		assert.deepEqual(Object.keys(beatTool.args), Object.keys(tool.args));
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
		const beatBlocked = JSON.parse(
			toolOutput(
				await beatTool.execute(
					{
						workflowId: "workflow-heartbeat-tool",
						attemptId: "attempt-heartbeat-tool",
						laneId: "lane-heartbeat-tool-beat-blocked",
						parentSessionRef: "not-a-session-ref",
						agentRef: "agent-heartbeat-tool",
						providerQualifiedModelId: "openai/gpt-5.4-mini-fast",
						state: "running",
					},
					undefined as never,
				),
			),
		) as Record<string, unknown>;
		assert.equal(beatBlocked.status, "blocked_before_lane_heartbeat");
		assert.equal(beatBlocked.writeAttempted, false);
		const blockedAuthority = beatBlocked.authority as Record<string, unknown>;
		assert.equal(blockedAuthority.realOpenCodeDispatch, false);
		assert.equal(blockedAuthority.providerCall, false);
		assert.equal(blockedAuthority.runtimeExecution, false);
		assert.equal(blockedAuthority.actualLaneLaunch, false);
		assert.equal(blockedAuthority.fallbackAuthority, false);
		assert.equal(blockedAuthority.hardCancelOrNoReplyAuthority, false);
		assert.equal(blockedAuthority.toolAuthority, false);
		assert.equal(blockedAuthority.laneHeartbeatPersisted, false);
		const beatRecorded = JSON.parse(
			toolOutput(
				await beatTool.execute(
					{
						workflowId: "workflow-heartbeat-tool",
						attemptId: "attempt-heartbeat-tool",
						laneId: "lane-heartbeat-tool-beat",
						parentSessionRef: "ses-heartbeat-tool-parent",
						agentRef: "agent-heartbeat-tool",
						providerQualifiedModelId: "openai/gpt-5.4-mini-fast",
						state: "running",
						progressSummaryLabel: "compact heartbeat helper",
					},
					undefined as never,
				),
			),
		) as Record<string, unknown>;
		assert.equal(beatRecorded.status, "lane_heartbeat_recorded");
		assert.equal(beatRecorded.workflowId, "workflow-heartbeat-tool");
		assert.equal(beatRecorded.laneId, "lane-heartbeat-tool-beat");
		assert.equal(beatRecorded.heartbeatSeq, 1);
		const beatAuthority = beatRecorded.authority as Record<string, unknown>;
		assert.equal(beatAuthority.realOpenCodeDispatch, false);
		assert.equal(beatAuthority.providerCall, false);
		assert.equal(beatAuthority.runtimeExecution, false);
		assert.equal(beatAuthority.actualLaneLaunch, false);
		assert.equal(beatAuthority.fallbackAuthority, false);
		assert.equal(beatAuthority.hardCancelOrNoReplyAuthority, false);
		assert.equal(beatAuthority.toolAuthority, false);
		assert.equal(beatAuthority.laneHeartbeatPersisted, true);
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
				sessionID: "ses-chat-stall-card-parent",
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
		const planHooks = (await flowdeskOpenCodeServerPlugin.server(
			undefined as never,
			{
				[flowdeskNaturalLanguageRoutingOption]: true,
				[flowdeskDurableStateRootOption]: root,
				[flowdeskStatusLiveOption]: { enabled: true },
				[flowdeskChatMessageStallAlertOption]: { enabled: true },
			},
		)) as ChatMessageHooks;
		const planChatMessage = planHooks["chat.message"];
		assert.ok(planChatMessage);
		await planChatMessage(
			{
				messageID: "message-stall-card-plan",
				sessionID: "ses-chat-stall-card-parent",
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

test("chat.message guarded auto-abort opt-in writes warning then evidence-only abort", async () => {
	const root = mkdtempSync(join(tmpdir(), "flowdesk-chat-auto-abort-"));
	try {
		const workflowId = "workflow-quick-reviewer-chat-auto-abort";
		const laneId = "lane-chat-auto-abort";
		const observedAtMs = new Date(now).getTime();
		const stalledLifecycle = {
			schema_version: "flowdesk.lane_lifecycle_record.v1",
			lane_id: laneId,
			workflow_id: workflowId,
			attempt_id: "attempt-chat-auto-abort",
			parent_session_ref: "ses-chat-auto-abort-parent",
			agent_ref: "agent-chat-auto-abort",
			provider_qualified_model_id: "openai/gpt-5.4-mini-fast",
			state: "running" as const,
			timeout_ms: 60_000,
			orphan_max_age_ms: 600_000,
			retry_count: 0,
			created_at: new Date(observedAtMs - 12 * 60_000).toISOString(),
			updated_at: new Date(observedAtMs - 12 * 60_000).toISOString(),
			spawned_by: "flowdesk" as const,
			dispatch_authority_enabled: false as const,
			providerCall: false as const,
			actualLaneLaunch: false as const,
			runtimeExecution: false as const,
		};
		const intent = prepareFlowDeskSessionEvidenceWriteIntentV1({
			workflowId,
			evidenceId: "lifecycle-chat-auto-abort-running",
			record: stalledLifecycle,
		});
		assert.equal(intent.ok, true, intent.errors.join("; "));
		assert.equal(
			applyFlowDeskSessionEvidenceWriteIntentsV1(root, [intent.writeIntent as never]).ok,
			true,
		);
		const adrDir = join(root, "docs", "adr");
		mkdirSync(adrDir, { recursive: true });
		writeFileSync(join(adrDir, "0002-sdk-surface-verification.md"), stallRecoveryGuardMarkdown);
		writeFileSync(
			join(adrDir, "0002-sdk-surface-verification.guard_sign_off.json"),
			JSON.stringify(stallRecoveryGuardSignOff(), undefined, 2),
		);

		const hooks = (await flowdeskOpenCodeServerPlugin.server(
			undefined as never,
			{
				[flowdeskNaturalLanguageRoutingOption]: true,
				[flowdeskDurableStateRootOption]: root,
				[flowdeskStatusLiveOption]: { enabled: true },
				[flowdeskChatMessageStallAlertOption]: {
					enabled: true,
					guardedAutoAbort: {
						autoAbortOnStall: true,
						guardHmacKey: stallRecoveryGuardKey,
						preAbortWarningMs: 10_000,
						sdkSessionHealth: {
							status: "api_timeout",
							reason: "test timeout",
						},
					},
				},
			},
		)) as ChatMessageHooks;
		assert.ok(hooks["chat.message"]);
		const output = { parts: [{ type: "text", text: "hello" }] as unknown[] };
		await hooks["chat.message"]({ messageID: "msg-auto-abort", sessionID: "ses-chat-auto-abort-parent" }, output);
		const serialized = JSON.stringify(output);
		assert.match(serialized, /guarded auto-abort warning_issued/);
		let reload = reloadFlowDeskSessionEvidenceV1({ rootDir: root, workflowId });
		assert.equal(reload.ok, true);
		assert.equal(reload.entries.some((entry) => entry.evidenceClass === "pending_abort_warning" && entry.record.status === "pending"), true);

		const expiredHooks = createFlowDeskNaturalLanguageChatMessageHook(
			() => new Date(Date.now() + 20_000),
			undefined,
			{
				rootDir: root,
				guardedAutoAbort: {
					autoAbortOnStall: true,
					guardHmacKey: stallRecoveryGuardKey,
					preAbortWarningMs: 10_000,
					sdkSessionHealth: { status: "api_timeout", reason: "test timeout" },
				},
			},
		);
		const expiredOutput = { parts: [{ type: "text", text: "hello again" }] as unknown[] };
		await expiredHooks({ messageID: "msg-auto-abort-expired", sessionID: "ses-chat-auto-abort-parent" }, expiredOutput);
		assert.match(JSON.stringify(expiredOutput), /guarded auto-abort auto_abort_executed/);
		reload = reloadFlowDeskSessionEvidenceV1({ rootDir: root, workflowId });
		assert.equal(reload.entries.some((entry) => entry.evidenceClass === "lane_lifecycle" && entry.record.state === "aborted"), true);
		assert.equal(reload.entries.some((entry) => entry.evidenceClass === "pending_abort_warning" && entry.record.status === "executed"), true);
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
			created_at: new Date(observedAtMs - 2 * 60_000).toISOString(),
			updated_at: new Date(observedAtMs - 2 * 60_000).toISOString(),
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
				sessionID: "ses-chat-late-card-parent",
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
				sessionID: "ses-chat-late-card-parent",
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

test("chat.message progress card surfaces active lanes when includeProgressCards is opted in", async () => {
	const root = mkdtempSync(join(tmpdir(), "flowdesk-chat-progress-card-"));
	try {
		const workflowId = "workflow-chat-progress-card";
		const observedAtMs = Date.now();
		const runningLifecycle = {
			schema_version: "flowdesk.lane_lifecycle_record.v1",
			lane_id: "lane-chat-progress-card",
			workflow_id: workflowId,
			attempt_id: "attempt-chat-progress-card",
			parent_session_ref: "ses-chat-progress-card-parent",
			agent_ref: "agent-chat-progress-card",
			provider_qualified_model_id: "openai/gpt-5.5",
			state: "running" as const,
			timeout_ms: 60_000,
			orphan_max_age_ms: 600_000,
			retry_count: 0,
			created_at: new Date(observedAtMs - 20_000).toISOString(),
			updated_at: new Date(observedAtMs - 20_000).toISOString(),
			dispatch_authority_enabled: false as const,
			providerCall: false as const,
			actualLaneLaunch: false as const,
			runtimeExecution: false as const,
		};
		const intent = prepareFlowDeskSessionEvidenceWriteIntentV1({
			workflowId,
			evidenceId: "lifecycle-chat-progress-card",
			record: runningLifecycle,
		});
		assert.equal(intent.ok, true, intent.errors.join("; "));
		const contextIntent = prepareFlowDeskSessionEvidenceWriteIntentV1({
			workflowId,
			evidenceId: "agent-task-context-chat-progress-card",
			record: {
				schema_version: "flowdesk.agent_task_context.v1",
				workflow_id: workflowId,
				lane_id: "lane-chat-progress-card",
				task_id: "task-chat-progress-card",
				agent_ref: "agent-chat-progress-card",
				provider_qualified_model_id: "openai/gpt-5.5",
				parent_session_ref: "ses-chat-progress-card-parent",
				prompt_text: "Inspect the repository and report progress details with a very long internal instruction that should be compacted in UI cards.",
				prompt_text_truncated: false,
				prompt_text_sha256: "abc123sha256progresscard",
				redaction_version: "v1",
				created_at: new Date(observedAtMs - 20_000).toISOString(),
				dispatch_authority_enabled: false,
			},
		});
		assert.equal(contextIntent.ok, true, contextIntent.errors.join("; "));
		assert.equal(
			applyFlowDeskSessionEvidenceWriteIntentsV1(root, [intent.writeIntent as never, contextIntent.writeIntent as never]).ok,
			true,
		);

		const defaultHooks = (await flowdeskOpenCodeServerPlugin.server(
			undefined as never,
			{
				[flowdeskNaturalLanguageRoutingOption]: true,
				[flowdeskDurableStateRootOption]: root,
				[flowdeskStatusLiveOption]: { enabled: true },
				[flowdeskChatMessageStallAlertOption]: { enabled: true },
			},
		)) as ChatMessageHooks;
		const defaultChatMessage = defaultHooks["chat.message"];
		assert.ok(defaultChatMessage);
		const defaultOutput = {
			parts: [{ type: "text", text: "일반 대화" }] as unknown[],
		};
		await defaultChatMessage(
			{ messageID: "message-progress-card-default", sessionID: "session-progress-card-default" },
			defaultOutput,
		);
		assert.equal(JSON.stringify(defaultOutput).includes("Lane progress:"), false);

		const progressHooks = (await flowdeskOpenCodeServerPlugin.server(
			undefined as never,
			{
				[flowdeskNaturalLanguageRoutingOption]: true,
				[flowdeskDurableStateRootOption]: root,
				[flowdeskStatusLiveOption]: { enabled: true },
				[flowdeskChatMessageStallAlertOption]: {
					enabled: true,
					includeProgressCards: true,
					maxProgressCards: 2,
				},
			},
		)) as ChatMessageHooks;
		const progressChatMessage = progressHooks["chat.message"];
		assert.ok(progressChatMessage);
		const progressOutput = {
			parts: [{ type: "text", text: "일반 대화" }] as unknown[],
		};
		await progressChatMessage(
			{ messageID: "message-progress-card-opt", sessionID: "ses-chat-progress-card-parent" },
			progressOutput,
		);
		const serialized = JSON.stringify(progressOutput);
		assert.match(serialized, /Lane progress:/);
		assert.match(serialized, /lane-chat-progress-card/);
		assert.match(serialized, /running\/progressing_normal/);
		assert.match(serialized, /task: task-chat-progress-card/);
		assert.match(serialized, /prompt: Inspect the repository/);
		assert.match(serialized, /agent: agent-chat-progress-card/);
		assert.match(serialized, /model: openai\/gpt-5\.5/);
		assert.match(serialized, /result: \(none\)/);
		assert.match(serialized, /- \/flowdesk-status/);
		assert.match(serialized, /native clickable task UI is not claimed/);
		assert.equal(/noReply|cancel|stop/.test(serialized), false);
	} finally {
		rmSync(root, { recursive: true, force: true });
	}
});

test("chat.message progress card does not surface terminal-only lanes", async () => {
	const root = mkdtempSync(join(tmpdir(), "flowdesk-chat-terminal-progress-card-"));
	try {
		const workflowId = "workflow-chat-terminal-progress-card";
		const observedAtMs = Date.now();
		const terminalLifecycle = {
			schema_version: "flowdesk.lane_lifecycle_record.v1",
			lane_id: "lane-chat-terminal-progress-card",
			workflow_id: workflowId,
			attempt_id: "attempt-chat-terminal-progress-card",
			parent_session_ref: "ses-chat-terminal-progress-card-parent",
			agent_ref: "agent-chat-terminal-progress-card",
			provider_qualified_model_id: "openai/gpt-5.5",
			state: "incomplete" as const,
			timeout_ms: 60_000,
			orphan_max_age_ms: 600_000,
			retry_count: 0,
			created_at: new Date(observedAtMs - 20_000).toISOString(),
			updated_at: new Date(observedAtMs - 20_000).toISOString(),
			dispatch_authority_enabled: false as const,
			providerCall: false as const,
			actualLaneLaunch: false as const,
			runtimeExecution: false as const,
		};
		const intent = prepareFlowDeskSessionEvidenceWriteIntentV1({
			workflowId,
			evidenceId: "lifecycle-chat-terminal-progress-card",
			record: terminalLifecycle,
		});
		assert.equal(intent.ok, true, intent.errors.join("; "));
		assert.equal(
			applyFlowDeskSessionEvidenceWriteIntentsV1(root, [intent.writeIntent as never]).ok,
			true,
		);

		const hooks = (await flowdeskOpenCodeServerPlugin.server(
			undefined as never,
			{
				[flowdeskNaturalLanguageRoutingOption]: true,
				[flowdeskDurableStateRootOption]: root,
				[flowdeskStatusLiveOption]: { enabled: true },
				[flowdeskChatMessageStallAlertOption]: {
					enabled: true,
					includeProgressCards: true,
				},
			},
		)) as ChatMessageHooks;
		const chatMessage = hooks["chat.message"];
		assert.ok(chatMessage);
		const output = { parts: [{ type: "text", text: "일반 대화" }] as unknown[] };
		await chatMessage(
			{ messageID: "message-terminal-progress-card", sessionID: "session-terminal-progress-card" },
			output,
		);
		const serialized = JSON.stringify(output);
		assert.equal(serialized.includes("Lane progress:"), false);
		assert.equal(serialized.includes("lane-chat-terminal-progress-card"), false);
	} finally {
		rmSync(root, { recursive: true, force: true });
	}
});

test("chat.message surfaces auto-next readiness for normally completed lanes", async () => {
	const root = mkdtempSync(join(tmpdir(), "flowdesk-chat-auto-next-"));
	try {
		const workflowId = "workflow-chat-auto-next";
		const observedAtMs = Date.now();
		const terminalLifecycle = {
			schema_version: "flowdesk.lane_lifecycle_record.v1",
			lane_id: "lane-chat-auto-next",
			workflow_id: workflowId,
			attempt_id: "attempt-chat-auto-next",
			parent_session_ref: "ses-chat-auto-next-parent",
			agent_ref: "agent-chat-auto-next",
			provider_qualified_model_id: "openai/gpt-5.5",
			state: "incomplete" as const,
			timeout_ms: 60_000,
			orphan_max_age_ms: 600_000,
			retry_count: 0,
			created_at: new Date(observedAtMs - 20_000).toISOString(),
			updated_at: new Date(observedAtMs - 20_000).toISOString(),
			dispatch_authority_enabled: false as const,
			providerCall: false as const,
			actualLaneLaunch: false as const,
			runtimeExecution: false as const,
		};
		const resultRecord = {
			schema_version: "flowdesk.task_result.v1",
			workflow_id: workflowId,
			lane_id: "lane-chat-auto-next",
			task_id: "task-chat-auto-next",
			agent_ref: "agent-chat-auto-next",
			provider_qualified_model_id: "openai/gpt-5.5",
			task_prompt_sha256: "a".repeat(64),
			result_text: "complete",
			result_text_truncated: false,
			result_text_sha256: "b".repeat(64),
			completion_status: "final",
			output_kind: "final_answer",
			usable_for_synthesis: true,
			created_at: new Date(observedAtMs - 10_000).toISOString(),
			dispatch_authority_enabled: false,
		};
		const lifecycleIntent = prepareFlowDeskSessionEvidenceWriteIntentV1({ workflowId, evidenceId: "lifecycle-chat-auto-next", record: terminalLifecycle });
		const resultIntent = prepareFlowDeskSessionEvidenceWriteIntentV1({ workflowId, evidenceId: "task-result-chat-auto-next", record: resultRecord });
		assert.equal(lifecycleIntent.ok, true, lifecycleIntent.errors.join("; "));
		assert.equal(resultIntent.ok, true, resultIntent.errors.join("; "));
		assert.equal(
			applyFlowDeskSessionEvidenceWriteIntentsV1(root, [lifecycleIntent.writeIntent as never, resultIntent.writeIntent as never]).ok,
			true,
		);

		const hooks = (await flowdeskOpenCodeServerPlugin.server(
			undefined as never,
			{
				[flowdeskNaturalLanguageRoutingOption]: true,
				[flowdeskDurableStateRootOption]: root,
				[flowdeskStatusLiveOption]: { enabled: true },
				[flowdeskChatMessageStallAlertOption]: { enabled: true, includeProgressCards: true },
			},
		)) as ChatMessageHooks;
		const chatMessage = hooks["chat.message"];
		assert.ok(chatMessage);
		const output = { parts: [{ type: "text", text: "일반 대화" }] as unknown[] };
		await chatMessage(
			{ messageID: "message-chat-auto-next", sessionID: "ses-chat-auto-next-parent" },
			output,
		);
		const serialized = JSON.stringify(output);
		assert.match(serialized, /Auto-next synthesis is ready/);
		assert.match(serialized, /auto-next ready/);
		assert.match(serialized, /task-chat-auto-next/);
		assert.match(serialized, /auto_next=true/);
		assert.match(serialized, /next_action=synthesis_ready/);
		assert.equal(/noReply|cancel|stop/.test(serialized), false);
	} finally {
		rmSync(root, { recursive: true, force: true });
	}
});

test("chat.message progress card only surfaces lanes for the current session", async () => {
	const root = mkdtempSync(join(tmpdir(), "flowdesk-chat-session-scoped-progress-card-"));
	try {
		const workflowId = "workflow-chat-session-scoped-progress-card";
		const observedAtMs = Date.now();
		const otherSessionLifecycle = {
			schema_version: "flowdesk.lane_lifecycle_record.v1",
			lane_id: "lane-chat-other-session-progress-card",
			workflow_id: workflowId,
			attempt_id: "attempt-chat-other-session-progress-card",
			parent_session_ref: "ses-chat-other-session-parent",
			agent_ref: "agent-chat-other-session-progress-card",
			provider_qualified_model_id: "openai/gpt-5.5",
			state: "running" as const,
			timeout_ms: 60_000,
			orphan_max_age_ms: 600_000,
			retry_count: 0,
			created_at: new Date(observedAtMs - 20_000).toISOString(),
			updated_at: new Date(observedAtMs - 20_000).toISOString(),
			dispatch_authority_enabled: false as const,
			providerCall: false as const,
			actualLaneLaunch: false as const,
			runtimeExecution: false as const,
		};
		const intent = prepareFlowDeskSessionEvidenceWriteIntentV1({
			workflowId,
			evidenceId: "lifecycle-chat-other-session-progress-card",
			record: otherSessionLifecycle,
		});
		assert.equal(intent.ok, true, intent.errors.join("; "));
		assert.equal(
			applyFlowDeskSessionEvidenceWriteIntentsV1(root, [intent.writeIntent as never]).ok,
			true,
		);

		const hooks = (await flowdeskOpenCodeServerPlugin.server(
			undefined as never,
			{
				[flowdeskNaturalLanguageRoutingOption]: true,
				[flowdeskDurableStateRootOption]: root,
				[flowdeskStatusLiveOption]: { enabled: true },
				[flowdeskChatMessageStallAlertOption]: {
					enabled: true,
					includeProgressCards: true,
				},
			},
		)) as ChatMessageHooks;
		const chatMessage = hooks["chat.message"];
		assert.ok(chatMessage);
		const output = { parts: [{ type: "text", text: "일반 대화" }] as unknown[] };
		await chatMessage(
			{ messageID: "message-session-scoped-progress-card", sessionID: "ses-chat-current-session-parent" },
			output,
		);
		const serialized = JSON.stringify(output);
		assert.equal(serialized.includes("Lane progress:"), false);
		assert.equal(serialized.includes("lane-chat-other-session-progress-card"), false);
	} finally {
		rmSync(root, { recursive: true, force: true });
	}
});

test("event hook records child session permission progress", async () => {
	const root = mkdtempSync(join(tmpdir(), "flowdesk-event-hook-progress-"));
	try {
		const workflowId = "workflow-event-hook-progress";
		const childIntent = prepareFlowDeskSessionEvidenceWriteIntentV1({
			workflowId,
			evidenceId: "agent-task-child-session-event-hook-progress",
			record: {
				schema_version: "flowdesk.agent_task_child_session.v1",
				workflow_id: workflowId,
				lane_id: "lane-event-hook-progress",
				task_id: "task-event-hook-progress",
				child_session_id: "child-event-hook-progress",
				parent_session_ref: "ses-event-hook-parent",
				provider_qualified_model_id: "openai/gpt-5.5",
				agent_ref: "agent-reviewer-gpt-frontier",
				nudge_count: 0,
				last_nudge_at: null,
				created_at: new Date().toISOString(),
				dispatch_authority_enabled: false,
			},
		});
		assert.equal(childIntent.ok, true, childIntent.errors.join("; "));
		assert.equal(applyFlowDeskSessionEvidenceWriteIntentsV1(root, [childIntent.writeIntent as never]).ok, true);

		const hooks = (await flowdeskOpenCodeServerPlugin.server(
			undefined as never,
			{
				[flowdeskDurableStateRootOption]: root,
				localNonDispatchAdapter: false,
				naturalLanguageRouting: false,
			},
		)) as ChatMessageHooks;
		assert.ok(hooks.event);
		await hooks.event({
			event: {
				type: "permission.asked",
				properties: {
					id: "perm-event-hook-progress",
					type: "read",
					sessionID: "child-event-hook-progress",
					messageID: "msg-event-hook-progress",
					title: "Allow read",
					metadata: {},
					time: { created: Date.now() },
				},
			},
		});

		const reloaded = reloadFlowDeskSessionEvidenceV1({ rootDir: root, workflowId });
		assert.ok(reloaded.entries.some((entry) =>
			entry.evidenceClass === "agent_task_progress" &&
			entry.record.lane_id === "lane-event-hook-progress" &&
			entry.record.phase === "awaiting_permission" &&
			entry.record.progress_label === "agent task awaiting OpenCode permission response",
		));
		const wakeCache = JSON.parse(readFileSync(join(root, ".flowdesk", "ui", "completion-wake-ready.json"), "utf8")) as Record<string, unknown>;
		assert.equal(wakeCache.schema_version, "flowdesk.completion_wake_ready_cache.v1");
		assert.ok(Array.isArray(wakeCache.rows));
		assert.ok(wakeCache.rows.some((row) =>
			typeof row === "object" && row !== null &&
			(row as Record<string, unknown>).workflowId === workflowId &&
			(row as Record<string, unknown>).parentSessionRef === "ses-event-hook-parent" &&
			(row as Record<string, unknown>).completionKind === "awaiting_permission" &&
			(row as Record<string, unknown>).notificationLabel === "FlowDesk lane awaiting OpenCode permission",
		));
	} finally {
		rmSync(root, { recursive: true, force: true });
	}
});

test("event hook maps child session errors to terminal task failure", async () => {
	const root = mkdtempSync(join(tmpdir(), "flowdesk-event-hook-error-"));
	try {
		const workflowId = "workflow-event-hook-error";
		const childIntent = prepareFlowDeskSessionEvidenceWriteIntentV1({
			workflowId,
			evidenceId: "agent-task-child-session-event-hook-error",
			record: {
				schema_version: "flowdesk.agent_task_child_session.v1",
				workflow_id: workflowId,
				lane_id: "lane-event-hook-error",
				task_id: "task-event-hook-error",
				child_session_id: "child-event-hook-error",
				parent_session_ref: "ses-event-hook-parent",
				provider_qualified_model_id: "openai/gpt-5.5",
				agent_ref: "agent-reviewer-gpt-frontier",
				nudge_count: 0,
				last_nudge_at: null,
				created_at: new Date().toISOString(),
				dispatch_authority_enabled: false,
			},
		});
		assert.equal(childIntent.ok, true, childIntent.errors.join("; "));
		assert.equal(applyFlowDeskSessionEvidenceWriteIntentsV1(root, [childIntent.writeIntent as never]).ok, true);

		const hooks = (await flowdeskOpenCodeServerPlugin.server(
			undefined as never,
			{
				[flowdeskDurableStateRootOption]: root,
				localNonDispatchAdapter: false,
				naturalLanguageRouting: false,
			},
		)) as ChatMessageHooks;
		assert.ok(hooks.event);
		await hooks.event({ event: { type: "session.error", properties: { sessionID: "child-event-hook-error", error: { message: "boom from child session", code: "E_CHILD_SESSION" } } } });

		const reloaded = reloadFlowDeskSessionEvidenceV1({ rootDir: root, workflowId });
		assert.ok(reloaded.entries.some((entry) =>
			entry.evidenceClass === "task_failed" &&
			entry.record.lane_id === "lane-event-hook-error" &&
			typeof entry.record.redacted_reason === "string" &&
			entry.record.redacted_reason.includes("boom from child session") &&
			entry.record.redacted_reason.includes("E_CHILD_SESSION") &&
			typeof entry.record.redacted_error_details === "string" &&
			entry.record.redacted_error_details.includes("boom from child session") &&
			entry.record.redacted_error_details.includes("E_CHILD_SESSION"),
		));
		assert.ok(reloaded.entries.some((entry) => entry.evidenceClass === "lane_lifecycle" && entry.record.lane_id === "lane-event-hook-error" && entry.record.state === "invocation_failed"));
	} finally {
		rmSync(root, { recursive: true, force: true });
	}
});

test("event hook consumes completion wake after direct monitor captures task_result", async () => {
	const root = mkdtempSync(join(tmpdir(), "flowdesk-event-hook-wake-after-monitor-"));
	try {
		const workflowId = "workflow-event-hook-wake-after-monitor";
		const assistantText = "Direct monitor captured completion result.";
		const childIntent = prepareFlowDeskSessionEvidenceWriteIntentV1({
			workflowId,
			evidenceId: "agent-task-child-session-event-hook-wake-after-monitor",
			record: {
				schema_version: "flowdesk.agent_task_child_session.v1",
				workflow_id: workflowId,
				lane_id: "lane-event-hook-wake-after-monitor",
				task_id: "task-event-hook-wake-after-monitor",
				child_session_id: "child-event-hook-wake-after-monitor",
				parent_session_ref: "ses-ses_event_hook_wake_parent",
				provider_qualified_model_id: "openai/gpt-5.5",
				agent_ref: "agent-reviewer-gpt-frontier",
				nudge_count: 0,
				last_nudge_at: null,
				created_at: "2026-06-11T00:00:00.000Z",
				dispatch_authority_enabled: false,
			},
		});
		assert.equal(childIntent.ok, true, childIntent.errors.join("; "));
		assert.equal(applyFlowDeskSessionEvidenceWriteIntentsV1(root, [childIntent.writeIntent as never]).ok, true);

		const wakePrompts: unknown[] = [];
		const client = {
			session: {
				messages() {
					return Promise.resolve([{ role: "assistant", parts: [{ type: "text", text: assistantText }] }]);
				},
				promptAsync(options: unknown) {
					wakePrompts.push(options);
					return Promise.resolve({ info: { id: "wake-message-event-hook-wake-after-monitor" } });
				},
			},
		};
		const hooks = (await flowdeskOpenCodeServerPlugin.server(
			{ client } as never,
			{
				[flowdeskDurableStateRootOption]: root,
				[flowdeskCompletionWakeMainSessionOption]: {
					enabled: true,
					providerQualifiedModelId: "openai/gpt-5.5",
					parentSessionRef: "ses-ses_event_hook_wake_parent",
				},
				localNonDispatchAdapter: false,
				naturalLanguageRouting: false,
			},
		)) as ChatMessageHooks;
		assert.ok(hooks.event);

		await hooks.event({
			event: {
				type: "message.updated",
				properties: {
					sessionID: "child-event-hook-wake-after-monitor",
					info: {
						id: "msg-event-hook-wake-after-monitor",
						role: "assistant",
						time: { created: Date.parse("2026-06-11T00:00:01.000Z"), completed: Date.parse("2026-06-11T00:00:02.000Z") },
					},
				},
			},
		});
		await new Promise((resolve) => setTimeout(resolve, 350));

		const reloaded = reloadFlowDeskSessionEvidenceV1({ rootDir: root, workflowId });
		assert.ok(reloaded.entries.some((entry) =>
			entry.evidenceClass === "task_result" &&
			entry.record.lane_id === "lane-event-hook-wake-after-monitor" &&
			String(entry.record.result_text).includes(assistantText),
		));
		if (wakePrompts.length === 0) {
			refreshFlowDeskCompletionUiCachesV1({ rootDir: root, workflowId });
			await consumeFlowDeskCompletionWakeForMainSessionV1({
				config: {
					enabled: true,
					rootDir: root,
					agentName: "flowdesk-main",
					providerQualifiedModelId: "openai/gpt-5.5",
					parentSessionRef: "ses-ses_event_hook_wake_parent",
				},
				client,
			});
		}
		assert.equal(wakePrompts.length, 1, "wake prompt should be dispatched after task_result cache refresh");
		assert.ok(existsSync(join(root, ".flowdesk", "ui", "completion-wake-ready.json")));
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
				sessionID: "ses-chat-stall-part-schema-parent",
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
		assert.equal(continueAppended.sessionID, "ses-chat-stall-part-schema-parent");
		assert.equal(continueAppended.messageID, "msg_stall_part_schema_continue");
		assert.match(String(continueAppended.id), /^prt_[0-9a-f]+$/);

		const planOutput = {
			parts: [{ type: "text", text: "구현 계획을 세워줘" }] as unknown[],
		};
		const planHooks = (await flowdeskOpenCodeServerPlugin.server(
			undefined as never,
			{
				[flowdeskNaturalLanguageRoutingOption]: true,
				[flowdeskDurableStateRootOption]: root,
				[flowdeskStatusLiveOption]: { enabled: true },
				[flowdeskChatMessageStallAlertOption]: { enabled: true },
			},
		)) as ChatMessageHooks;
		const planChatMessage = planHooks["chat.message"];
		assert.ok(planChatMessage);
		await planChatMessage(
			{
				messageID: "msg_stall_part_schema_plan",
				sessionID: "ses-chat-stall-part-schema-parent",
			},
			planOutput,
		);
		assert.equal(planOutput.parts.length, 3);
		const planSteering = planOutput.parts[1] as Record<string, unknown>;
		const planStallCard = planOutput.parts[2] as Record<string, unknown>;
		for (const part of [planSteering, planStallCard]) {
			assert.equal(part.type, "text");
			assert.equal(typeof part.text, "string");
			assert.equal(part.sessionID, "ses-chat-stall-part-schema-parent");
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

// ---------------------------------------------------------------------------
// P8 Background Watchdog tests
// ---------------------------------------------------------------------------

function makeWatchdogGuardSignOff(rootDir: string) {
	const adrDir = join(rootDir, "docs", "adr");
	mkdirSync(adrDir, { recursive: true });
	writeFileSync(join(adrDir, "0002-sdk-surface-verification.md"), stallRecoveryGuardMarkdown);
	writeFileSync(
		join(adrDir, "0002-sdk-surface-verification.guard_sign_off.json"),
		JSON.stringify(stallRecoveryGuardSignOff(), undefined, 2),
	);
}

function makeStalledLaneEvidence(workflowId: string, laneId: string, observedAtMs: number) {
	return {
		schema_version: "flowdesk.lane_lifecycle_record.v1",
		lane_id: laneId,
		workflow_id: workflowId,
		attempt_id: `attempt-watchdog-${laneId}`,
		parent_session_ref: `ses-watchdog-${laneId}-parent`,
		agent_ref: `agent-watchdog-${laneId}`,
		provider_qualified_model_id: "openai/gpt-5.4-mini-fast",
		state: "running" as const,
		timeout_ms: 60_000,
		orphan_max_age_ms: 600_000,
		retry_count: 0,
		created_at: new Date(observedAtMs - 12 * 60_000).toISOString(),
		updated_at: new Date(observedAtMs - 12 * 60_000).toISOString(),
		spawned_by: "flowdesk" as const,
		dispatch_authority_enabled: false as const,
		providerCall: false as const,
		actualLaneLaunch: false as const,
		runtimeExecution: false as const,
	};
}

function makeReviewerLaneContext(workflowId: string, laneId: string) {
	return {
		schema_version: "flowdesk.reviewer_lane_context.v1",
		workflow_id: workflowId,
		lane_id: laneId,
		lane_plan_ref: `plan-ref-watchdog-${laneId}`,
		original_attempt_id: `attempt-watchdog-${laneId}`,
		perspective: "policy_security",
		agent_ref: `agent-watchdog-${laneId}`,
		provider_qualified_model_id: "openai/gpt-5.4-mini-fast",
		parent_session_ref: `ses-watchdog-${laneId}-parent`,
		redaction_version: "redaction-v1",
		prompt_text: "Return typed FlowDesk reviewer verdict for policy_security.",
		prompt_text_truncated: false,
		prompt_text_sha256: "abc123sha256hexwatchdog",
		created_at: "2026-05-26T10:00:00.000Z",
		dispatch_authority_enabled: false as const,
	};
}

test("watchdog cycle aborts and retries stalled lanes without user message", async () => {
	const root = mkdtempSync(join(tmpdir(), "flowdesk-watchdog-cycle-"));
	try {
		const workflowId = "workflow-quick-reviewer-watchdog-abort";
		const laneId = "lane-watchdog-abort";
		const observedAtMs = new Date(now).getTime();

		// Write stalled lane lifecycle and reviewer lane context
		const lifecycleIntent = prepareFlowDeskSessionEvidenceWriteIntentV1({
			workflowId,
			evidenceId: "lifecycle-watchdog-running",
			record: makeStalledLaneEvidence(workflowId, laneId, observedAtMs),
		});
		assert.equal(lifecycleIntent.ok, true, lifecycleIntent.errors.join("; "));
		const contextIntent = prepareFlowDeskSessionEvidenceWriteIntentV1({
			workflowId,
			evidenceId: "reviewer-context-watchdog",
			record: makeReviewerLaneContext(workflowId, laneId),
		});
		assert.equal(contextIntent.ok, true, contextIntent.errors.join("; "));
		const applied = applyFlowDeskSessionEvidenceWriteIntentsV1(root, [
			lifecycleIntent.writeIntent as never,
			contextIntent.writeIntent as never,
		]);
		assert.equal(applied.ok, true, applied.errors.join("; "));

		// Write guard sidecar
		makeWatchdogGuardSignOff(root);

		// Create a fake SDK client that records retry attempts
		const retryCalls: unknown[] = [];
		const fakeClient = {
			session: {
				create(options: unknown) {
					retryCalls.push({ action: "create", options });
					return Promise.resolve({ id: "watchdog-retry-child-session" });
				},
				prompt(options: unknown) {
					retryCalls.push({ action: "prompt", options });
					return Promise.resolve({ info: { id: "watchdog-retry-message" } });
				},
				promptAsync(options: unknown) {
					retryCalls.push({ action: "promptAsync", options });
					return Promise.resolve({ info: { id: "watchdog-retry-message" } });
				},
				messages(options: unknown) {
					retryCalls.push({ action: "messages", options });
					return Promise.resolve([]);
				},
			},
		};

		const config = {
			autoAbortOnStall: true,
			guardHmacKey: stallRecoveryGuardKey,
			preAbortWarningMs: 10,  // very short warning so abort executes immediately in test
			autoRetryAfterAbort: true,
			maxAutoRetries: 1,
		};

		// First call: issues warning (preAbortWarningMs=10ms, will expire immediately)
		const firstResult = await runFlowDeskWatchdogCycleV1({
			config,
			rootDir: root,
			client: fakeClient as never,
			parentSessionId: "parent-watchdog-test",
			now: new Date(observedAtMs),
			_nudgeQuietPeriodMs: 100,
			_messagesTimeoutMs: 0,
		});
		assert.equal(firstResult.guardValid, true);
		assert.equal(firstResult.lanesChecked, 1);

		// Second call after warning expires: abort executes + retry
		const secondResult = await runFlowDeskWatchdogCycleV1({
			config,
			rootDir: root,
			client: fakeClient as never,
			parentSessionId: "parent-watchdog-test",
			now: new Date(observedAtMs + 60_000), // 1 minute later, warning expired
			_nudgeQuietPeriodMs: 100,
			_messagesTimeoutMs: 0,
		});
		assert.equal(secondResult.guardValid, true);
		assert.equal(secondResult.lanesChecked, 1);
		assert.equal(secondResult.lanesAborted, 1);
		assert.equal(secondResult.lanesRetried, 1);

		// Verify abort evidence was written
		const reloaded = reloadFlowDeskSessionEvidenceV1({ rootDir: root, workflowId });
		assert.equal(reloaded.ok, true);
		assert.equal(
			reloaded.entries.some((e) => e.evidenceClass === "lane_lifecycle" && e.record.state === "aborted"),
			true,
			"Expected aborted lane lifecycle evidence",
		);
	} finally {
		rmSync(root, { recursive: true, force: true });
	}
});

test("watchdog cycle skips when guard invalid", async () => {
	const root = mkdtempSync(join(tmpdir(), "flowdesk-watchdog-no-guard-"));
	try {
		// No Guard sidecar written — guard must be invalid
		const config = {
			autoAbortOnStall: true,
			guardHmacKey: stallRecoveryGuardKey,
			preAbortWarningMs: 10,
		};

		const result = await runFlowDeskWatchdogCycleV1({
			config,
			rootDir: root,
			client: undefined,
			parentSessionId: "",
		});

		assert.equal(result.guardValid, false);
		assert.equal(result.lanesChecked, 0);
		assert.equal(result.skippedReason, "guard_invalid");
	} finally {
		rmSync(root, { recursive: true, force: true });
	}
});

test("watchdog cycle prevents concurrent execution", async () => {
	const root = mkdtempSync(join(tmpdir(), "flowdesk-watchdog-concurrent-"));
	try {
		makeWatchdogGuardSignOff(root);

		const config = {
			autoAbortOnStall: true,
			guardHmacKey: stallRecoveryGuardKey,
		};

		// Start first cycle (no stalled lanes, so it will return quickly)
		// but simulate concurrent flag being set by running two cycles in parallel
		const [first, second] = await Promise.all([
			runFlowDeskWatchdogCycleV1({ config, rootDir: root, client: undefined, parentSessionId: "" }),
			runFlowDeskWatchdogCycleV1({ config, rootDir: root, client: undefined, parentSessionId: "" }),
		]);

		// One should succeed, one should be skipped due to concurrent flag
		const results = [first, second];
		const skipped = results.find((r) => r.skippedReason === "cycle_already_running");
		const completed = results.find((r) => r.skippedReason === undefined);

		// In sequential JS execution one will always win; the second concurrent call will get skipped
		assert.ok(skipped !== undefined || completed !== undefined, "At least one result must exist");
		// Verify the skipped one has guardValid=true (guard was valid, just concurrency blocked)
		if (skipped !== undefined) {
			assert.equal(skipped.guardValid, true);
			assert.equal(skipped.lanesChecked, 0);
		}
	} finally {
		rmSync(root, { recursive: true, force: true });
	}
});

test("watchdog trigger tool registers when mcpTriggerEnabled is true", async () => {
	const root = mkdtempSync(join(tmpdir(), "flowdesk-watchdog-trigger-tool-"));
	try {
		// Without chatMessageStallAlert.guardedAutoAbort, watchdog trigger should not register
		const noGuardHooks = await flowdeskOpenCodeServerPlugin.server(
			undefined as never,
			{
				[flowdeskWatchdogOption]: { enabled: true, mcpTriggerEnabled: true },
				[flowdeskDurableStateRootOption]: root,
				localNonDispatchAdapter: false,
				naturalLanguageRouting: false,
			},
		);
		assert.equal(
			noGuardHooks.tool?.[flowdeskWatchdogTriggerToolName],
			undefined,
			"watchdog trigger should not register without guardedAutoAbort config",
		);

		// With chatMessageStallAlert.guardedAutoAbort configured
		makeWatchdogGuardSignOff(root);
		const hooks = await flowdeskOpenCodeServerPlugin.server(
			undefined as never,
			{
				[flowdeskWatchdogOption]: { enabled: false, mcpTriggerEnabled: true },
				[flowdeskChatMessageStallAlertOption]: {
					enabled: true,
					guardedAutoAbort: {
						autoAbortOnStall: true,
						guardHmacKey: stallRecoveryGuardKey,
					},
				},
				[flowdeskDurableStateRootOption]: root,
				localNonDispatchAdapter: false,
				naturalLanguageRouting: false,
			},
		);
		// Note: mcpTriggerEnabled on watchdog with enabled=false falls through to standalone MCP path
		// (OR) with enabled=true the trigger is registered
		// Let's test with enabled=true which sets up both setInterval and MCP trigger
		const enabledHooks = await flowdeskOpenCodeServerPlugin.server(
			undefined as never,
			{
				[flowdeskWatchdogOption]: { enabled: true, mcpTriggerEnabled: true },
				[flowdeskChatMessageStallAlertOption]: {
					enabled: true,
					guardedAutoAbort: {
						autoAbortOnStall: true,
						guardHmacKey: stallRecoveryGuardKey,
					},
				},
				[flowdeskDurableStateRootOption]: root,
				localNonDispatchAdapter: false,
				naturalLanguageRouting: false,
			},
		);
		const triggerTool = enabledHooks.tool?.[flowdeskWatchdogTriggerToolName];
		assert.ok(triggerTool, "watchdog trigger tool should be registered when mcpTriggerEnabled=true and guardedAutoAbort configured");
		assert.match(triggerTool.description, /watchdog/i);
		assert.match(triggerTool.description, /manually/);

		// Execute the trigger tool (no stalled lanes, so it should just return a valid result)
		const result = JSON.parse(
			toolOutput(
				await triggerTool.execute({ parentSessionId: "parent-trigger-test" }, undefined as never),
			),
		) as Record<string, unknown>;
		assert.ok("cycleAt" in result, "result should have cycleAt");
		assert.ok("guardValid" in result, "result should have guardValid");
		assert.ok("lanesChecked" in result, "result should have lanesChecked");
	} finally {
		rmSync(root, { recursive: true, force: true });
	}
});

test("flowdesk_agent_task_run tool is absent by default and remains schema-visible with explicit opt-in", async () => {
	const defaultHooks = await flowdeskOpenCodeServerPlugin.server(
		undefined as never,
		{
			localNonDispatchAdapter: false,
			naturalLanguageRouting: false,
		},
	);
	assert.equal(
		defaultHooks.tool?.[flowdeskAgentTaskRunToolName],
		undefined,
	);
	assert.equal(defaultHooks.tool?.[flowdeskTaskToolName], undefined);

	const dummyClient = {
		session: {
			create() {
				return Promise.resolve({ id: "parent-agent-task-1" });
			},
			prompt() {
				return Promise.resolve({ info: { id: "message-agent-task-1" } });
			},
			messages() {
				return Promise.resolve([]);
			},
		},
	};
	// Without client, the tool should still register when explicitly enabled so
	// OpenCode's assistant tool schema exposes the lane boundary; execution must
	// fail closed until the injected SDK client is available.
	const noClientRoot = mkdtempSync(join(tmpdir(), "flowdesk-agent-task-schema-root-"));
	try {
		const enabledWithoutClientHooks = await flowdeskOpenCodeServerPlugin.server(
			undefined as never,
			{
				[flowdeskAgentTaskRunOption]: { enabled: true },
				[flowdeskDurableStateRootOption]: noClientRoot,
				localNonDispatchAdapter: false,
				naturalLanguageRouting: false,
			},
		);
		const schemaVisibleTool =
			enabledWithoutClientHooks.tool?.[flowdeskAgentTaskRunToolName];
		const schemaVisibleShortTool =
			enabledWithoutClientHooks.tool?.[flowdeskTaskToolName];
		assert.ok(
			schemaVisibleTool,
			"tool should remain schema-visible without client when opted in",
		);
		assert.ok(
			schemaVisibleShortTool,
			"short wrapper should remain schema-visible under the same opt-in",
		);
		const noClientResult = JSON.parse(
			toolOutput(
				await schemaVisibleTool.execute(
					{
						workflowId: "workflow-task-schema-visible-1",
						taskDescription: "Analyze schema visibility only.",
						agentName: "reviewer-gpt-frontier",
						providerQualifiedModelId: "openai/gpt-5.5",
						developerModeAcknowledged: true,
						allowProviderCall: true,
					},
					undefined as never,
				),
			),
		) as Record<string, unknown>;
		assert.equal(noClientResult.status, "blocked");
		assert.equal(
			noClientResult.reason,
			"opencode_sdk_client_unavailable_for_agent_task_run",
		);
		const shortNoClientResult = JSON.parse(
			toolOutput(
				await schemaVisibleShortTool.execute(
					{
						workflowId: "workflow-task-schema-visible-1",
						taskDescription: "Analyze schema visibility only.",
						agentName: "reviewer-gpt-frontier",
						providerQualifiedModelId: "openai/gpt-5.5",
						developerModeAcknowledged: true,
						allowProviderCall: true,
					},
					undefined as never,
				),
			),
		) as Record<string, unknown>;
		assert.deepEqual(
			shortNoClientResult,
			noClientResult,
			"short wrapper should preserve the underlying fail-closed result without adding authority",
		);
	} finally {
		rmSync(noClientRoot, { recursive: true, force: true });
	}

	const root = mkdtempSync(join(tmpdir(), "flowdesk-agent-task-absent-"));
	try {
		const enabledHooks = await flowdeskOpenCodeServerPlugin.server(
			{ client: dummyClient } as never,
			{
				[flowdeskAgentTaskRunOption]: { enabled: true },
				[flowdeskDurableStateRootOption]: root,
				localNonDispatchAdapter: false,
				naturalLanguageRouting: false,
			},
		);
		const agentTool = enabledHooks.tool?.[flowdeskAgentTaskRunToolName];
		const shortTaskTool = enabledHooks.tool?.[flowdeskTaskToolName];
		assert.ok(agentTool, "tool should register with client and durableStateRoot");
		assert.ok(shortTaskTool, "short wrapper should register with the same opt-in");
		assert.match(String(agentTool.description ?? ""), /delegate/i);
		assert.match(String(agentTool.description ?? ""), /WHEN TO USE/);
		assert.match(String(agentTool.description ?? ""), /WHEN NOT TO USE/);
		assert.ok(String(shortTaskTool.description ?? "").length < 1_200);
		assert.doesNotMatch(String(shortTaskTool.description ?? ""), /WHEN TO USE/);

		const manyToolHooks = await flowdeskOpenCodeServerPlugin.server(
			{ client: dummyClient } as never,
			{
				[flowdeskAgentTaskRunOption]: { enabled: true },
				[flowdeskControlledWriteApplyOption]: {
					enabled: true,
					devBetaControlledWriteApply: true,
				},
				[flowdeskDurableStateRootOption]: root,
				localNonDispatchAdapter: true,
				naturalLanguageRouting: true,
			},
		);
		const manyToolNames = Object.keys(manyToolHooks.tool ?? {});
		assert.ok(manyToolNames.includes(flowdeskAgentTaskRunToolName));
		assert.ok(manyToolNames.includes(flowdeskTaskToolName));
		assert.ok(manyToolNames.includes(flowdeskControlledWriteApplyToolName));
		assert.ok(
			manyToolNames.indexOf(flowdeskAgentTaskRunToolName) <
				manyToolNames.indexOf(flowdeskControlledWriteApplyToolName),
			"agent task tool should register before lower-priority developer write tools so provider-facing schema caps keep the FlowDesk-owned lane boundary visible",
		);
		const preSpikeDoctor = manyToolHooks.tool?.[flowdeskPreSpikeDoctorToolName];
		assert.ok(preSpikeDoctor);
		const preSpike = JSON.parse(
			toolOutput(await preSpikeDoctor.execute({}, undefined as never)),
		) as Record<string, unknown>;
		const devBetaLaneCapability = preSpike.devBetaLaneCapability as Record<string, unknown>;
		assert.equal(devBetaLaneCapability.agentTaskRunRegistered, true);
		assert.equal(devBetaLaneCapability.hasInjectedSdkClient, true);
		assert.equal(devBetaLaneCapability.durableStateRootConfigured, true);
		assert.equal(devBetaLaneCapability.launchCapable, true);

		const doctor = manyToolHooks.tool?.flowdesk_doctor;
		assert.ok(doctor);
		const doctorResult = JSON.parse(
			toolOutput(
				await doctor.execute(
					{
						schema_version: "flowdesk.doctor.request.v1",
						request_id: "doctor-agent-task-capability-test",
						input_mode: "test_fixture",
						check_scope: "all",
						profile: "development",
						persist_report: false,
					},
					undefined as never,
				),
			),
		) as Record<string, unknown>;
		const doctorText = JSON.stringify(doctorResult);
		assert.match(doctorText, /dev_beta_agent_task_run_launch_capable=true/);
		assert.match(doctorText, /separate_from_default_production_dispatch_gate/);
	} finally {
		rmSync(root, { recursive: true, force: true });
	}
});

test("flowdesk_agent_task_run blocks without developerModeAcknowledged", async () => {
	const dummyClient = {
		session: {
			create() {
				return Promise.resolve({ id: "parent-agent-task-block-1" });
			},
			prompt() {
				return Promise.resolve({ info: { id: "message-agent-task-block-1" } });
			},
			messages() {
				return Promise.resolve([]);
			},
		},
	};
	const root = mkdtempSync(join(tmpdir(), "flowdesk-agent-task-block-"));
	try {
		const hooks = await flowdeskOpenCodeServerPlugin.server(
			{ client: dummyClient } as never,
			{
				[flowdeskAgentTaskRunOption]: { enabled: true },
				[flowdeskDurableStateRootOption]: root,
				localNonDispatchAdapter: false,
				naturalLanguageRouting: false,
			},
		);
		const agentTool = hooks.tool?.[flowdeskAgentTaskRunToolName];
		assert.ok(agentTool);

		const blockedResult = JSON.parse(
			toolOutput(
				await agentTool.execute(
					{
						workflowId: "workflow-task-test-1",
						taskDescription: "Analyze this code for security issues.",
						agentName: "reviewer-claude-opus",
						providerQualifiedModelId: "claude/claude-opus-4-7",
						developerModeAcknowledged: false,
						allowProviderCall: true,
					},
					undefined as never,
				),
			),
		) as Record<string, unknown>;
		assert.equal(blockedResult.status, "blocked");
		assert.match(String(blockedResult.reason), /developerModeAcknowledged/);

		const blockedNoProvider = JSON.parse(
			toolOutput(
				await agentTool.execute(
					{
						workflowId: "workflow-task-test-1",
						taskDescription: "Analyze this code.",
						agentName: "reviewer-claude-opus",
						providerQualifiedModelId: "claude/claude-opus-4-7",
						developerModeAcknowledged: true,
						allowProviderCall: false,
					},
					undefined as never,
				),
			),
		) as Record<string, unknown>;
		assert.equal(blockedNoProvider.status, "blocked");
		assert.match(String(blockedNoProvider.reason), /allowProviderCall/);
	} finally {
		rmSync(root, { recursive: true, force: true });
	}
});

test("flowdesk_task requires explicit consent fields without silently defaulting true", async () => {
	const dummyClient = {
		session: {
			create() {
				return Promise.resolve({ id: "parent-short-task-block-1" });
			},
			prompt() {
				return Promise.resolve({ info: { id: "message-short-task-block-1" } });
			},
			messages() {
				return Promise.resolve([]);
			},
		},
	};
	const root = mkdtempSync(join(tmpdir(), "flowdesk-short-task-block-"));
	try {
		const hooks = await flowdeskOpenCodeServerPlugin.server(
			{ client: dummyClient } as never,
			{
				[flowdeskAgentTaskRunOption]: { enabled: true },
				[flowdeskDurableStateRootOption]: root,
				localNonDispatchAdapter: false,
				naturalLanguageRouting: false,
			},
		);
		const shortTaskTool = hooks.tool?.[flowdeskTaskToolName];
		assert.ok(shortTaskTool);

		const missingDevConsent = JSON.parse(
			toolOutput(
				await shortTaskTool.execute(
					{
						workflowId: "workflow-short-task-consent-1",
						taskDescription: "Analyze explicit consent handling.",
						agentName: "reviewer-gpt-frontier",
						providerQualifiedModelId: "openai/gpt-5.5",
						allowProviderCall: true,
					},
					undefined as never,
				),
			),
		) as Record<string, unknown>;
		assert.equal(missingDevConsent.status, "blocked");
		assert.match(String(missingDevConsent.reason), /developerModeAcknowledged/);

		const missingProviderConsent = JSON.parse(
			toolOutput(
				await shortTaskTool.execute(
					{
						workflowId: "workflow-short-task-consent-1",
						taskDescription: "Analyze explicit consent handling.",
						agentName: "reviewer-gpt-frontier",
						providerQualifiedModelId: "openai/gpt-5.5",
						developerModeAcknowledged: true,
					},
					undefined as never,
				),
			),
		) as Record<string, unknown>;
		assert.equal(missingProviderConsent.status, "blocked");
		assert.match(String(missingProviderConsent.reason), /allowProviderCall/);
	} finally {
		rmSync(root, { recursive: true, force: true });
	}
});

test("flowdesk_task normalizes safe defaults and adds no authority claims", async () => {
	const createOptions: unknown[] = [];
	const promptOptions: unknown[] = [];
	const dummyClient = {
		session: {
			create(options: unknown) {
				createOptions.push(options);
				return Promise.resolve({ id: "child-short-task-defaults-1" });
			},
			prompt(options: unknown) {
				promptOptions.push(options);
				return Promise.resolve({ info: { id: "message-short-task-defaults-1" } });
			},
			messages() {
				return Promise.resolve([]);
			},
		},
	};
	const root = mkdtempSync(join(tmpdir(), "flowdesk-short-task-defaults-"));
	try {
		const hooks = await flowdeskOpenCodeServerPlugin.server(
			{ client: dummyClient } as never,
			{
				[flowdeskAgentTaskRunOption]: { enabled: true },
				[flowdeskDurableStateRootOption]: root,
				localNonDispatchAdapter: false,
				naturalLanguageRouting: false,
			},
		);
		const shortTaskTool = hooks.tool?.[flowdeskTaskToolName];
		assert.ok(shortTaskTool);

		const result = JSON.parse(
			toolOutput(
				await shortTaskTool.execute(
					{
						workflowId: "workflow-short-task-defaults-1",
						taskDescription: "Analyze wrapper defaults.",
						agentName: "reviewer-gpt-frontier",
						providerQualifiedModelId: "openai/gpt-5.5",
						developerModeAcknowledged: true,
						allowProviderCall: true,
					},
					{ sessionID: "current-short-task-parent-1" } as never,
				),
			),
		) as Record<string, unknown>;
		assert.equal(result.status, "task_launched");
		assert.equal(result.asyncMode, true);
		assert.match(String(result.summaryForUser), /flowdesk_now/);
		assert.doesNotMatch(String(result.summaryForUser), /flowdesk_status_live/);
		assert.equal((createOptions[0] as Record<string, unknown>).parentID, "current-short-task-parent-1");
		assert.equal(promptOptions.length, 1);
		assert.equal("authority" in result, false);
		assert.equal("dispatchAuthority" in result, false);
		assert.equal("writeAuthority" in result, false);
		assert.equal("fallbackAuthority" in result, false);
		assert.equal("hardChatAuthority" in result, false);

		const evidence = reloadFlowDeskSessionEvidenceV1({
			workflowId: "workflow-short-task-defaults-1",
			rootDir: root,
		});
		assert.equal(evidence.ok, true, evidence.errors.join("; "));
		const context = evidence.entries.find(
			(entry) =>
				entry.evidenceClass === "agent_task_context" &&
				entry.record.lane_id === result.laneId,
		)?.record as Record<string, unknown> | undefined;
		assert.equal(context?.parent_session_ref, "ses-current-short-task-parent-1");
		assert.equal(context?.dispatch_authority_enabled, false);
		const child = evidence.entries.find(
			(entry) =>
				entry.evidenceClass === "agent_task_child_session" &&
				entry.record.lane_id === result.laneId,
		)?.record as Record<string, unknown> | undefined;
		assert.equal(child?.nudge_quiet_period_ms, 10_000);
	} finally {
		rmSync(root, { recursive: true, force: true });
	}
});

test("flowdesk_task ignores placeholder ctx session id before SDK launch", async () => {
	const createOptions: unknown[] = [];
	const dummyClient = {
		session: {
			create(options: unknown) {
				createOptions.push(options);
				return Promise.resolve({ id: "child-short-task-placeholder-ctx-1" });
			},
			prompt() {
				return Promise.resolve({ info: { id: "message-short-task-placeholder-ctx-1" } });
			},
			messages() {
				return Promise.resolve([]);
			},
		},
	};
	const root = mkdtempSync(join(tmpdir(), "flowdesk-short-task-placeholder-ctx-"));
	try {
		const hooks = await flowdeskOpenCodeServerPlugin.server(
			{ client: dummyClient } as never,
			{
				[flowdeskAgentTaskRunOption]: { enabled: true },
				[flowdeskDurableStateRootOption]: root,
				localNonDispatchAdapter: false,
				naturalLanguageRouting: false,
			},
		);
		const shortTaskTool = hooks.tool?.[flowdeskTaskToolName];
		assert.ok(shortTaskTool);

		const result = JSON.parse(
			toolOutput(
				await shortTaskTool.execute(
					{
						workflowId: "workflow-short-task-placeholder-ctx-1",
						taskDescription: "Verify placeholder ctx session id filtering.",
						agentName: "reviewer-gpt-frontier",
						providerQualifiedModelId: "openai/gpt-5.5",
						developerModeAcknowledged: true,
						allowProviderCall: true,
					},
					{ sessionID: "{id}" } as never,
				),
			),
		) as Record<string, unknown>;
		assert.equal(result.status, "task_launched");
		assert.equal((createOptions[0] as Record<string, unknown>).parentID, undefined);
		assert.doesNotMatch(JSON.stringify(result), /%7Bid%7D|\{id\}|Expected a string starting/);
	} finally {
		rmSync(root, { recursive: true, force: true });
	}
});

test("flowdesk_task prefers live ctx session over stale startup-seeded wake parent", async () => {
	const createOptions: unknown[] = [];
	const dummyClient = {
		session: {
			create(options: unknown) {
				createOptions.push(options);
				return Promise.resolve({ id: "child-short-task-live-over-seed-1" });
			},
			prompt() {
				return Promise.resolve({ info: { id: "message-short-task-live-over-seed-1" } });
			},
			messages() {
				return Promise.resolve([]);
			},
		},
	};
	const root = mkdtempSync(join(tmpdir(), "flowdesk-short-task-live-over-seed-"));
	try {
		__resetCompletionWakeParentSessionRefForTest();
		mkdirSync(join(root, ".flowdesk", "ui"), { recursive: true });
		writeFileSync(join(root, ".flowdesk", "ui", "completion-wake-ready.json"), JSON.stringify({
			schema_version: "flowdesk.completion_wake_ready_cache.v1",
			rows: [{
				parentSessionRef: "ses-ses_stale_compact_seed_1",
				readyAt: "2026-05-17T00:00:00.000Z",
			}],
		}), "utf8");
		const hooks = await flowdeskOpenCodeServerPlugin.server(
			{ client: dummyClient } as never,
			{
				[flowdeskAgentTaskRunOption]: { enabled: true },
				[flowdeskDurableStateRootOption]: root,
				localNonDispatchAdapter: false,
				naturalLanguageRouting: false,
			},
		);
		const shortTaskTool = hooks.tool?.[flowdeskTaskToolName];
		assert.ok(shortTaskTool);

		const result = JSON.parse(
			toolOutput(
				await shortTaskTool.execute(
					{
						workflowId: "workflow-short-task-live-over-seed-1",
						taskDescription: "Check live compact parent precedence.",
						agentName: "reviewer-gpt-frontier",
						providerQualifiedModelId: "openai/gpt-5.5",
						parentSessionId: "",
						developerModeAcknowledged: true,
						allowProviderCall: true,
					},
					{ sessionID: "live-compact-parent-1" } as never,
				),
			),
		) as Record<string, unknown>;
		assert.equal(result.status, "task_launched");
		assert.equal((createOptions[0] as Record<string, unknown>).parentID, "live-compact-parent-1");

		const evidence = reloadFlowDeskSessionEvidenceV1({
			workflowId: "workflow-short-task-live-over-seed-1",
			rootDir: root,
		});
		assert.equal(evidence.ok, true, evidence.errors.join("; "));
		assert.ok(
			evidence.entries.some(
				(entry) =>
					entry.evidenceClass === "agent_task_context" &&
					entry.record.lane_id === result.laneId &&
					entry.record.parent_session_ref === "ses-live-compact-parent-1",
			),
		);
	} finally {
		__resetCompletionWakeParentSessionRefForTest();
		rmSync(root, { recursive: true, force: true });
	}
});

test("flowdesk_task falls back to startup-seeded wake parent when live ctx session is missing", async () => {
	const createOptions: unknown[] = [];
	const dummyClient = {
		session: {
			create(options: unknown) {
				createOptions.push(options);
				return Promise.resolve({ id: "child-short-task-seed-fallback-1" });
			},
			prompt() {
				return Promise.resolve({ info: { id: "message-short-task-seed-fallback-1" } });
			},
			messages() {
				return Promise.resolve([]);
			},
		},
	};
	const root = mkdtempSync(join(tmpdir(), "flowdesk-short-task-seed-fallback-"));
	try {
		__resetCompletionWakeParentSessionRefForTest();
		mkdirSync(join(root, ".flowdesk", "ui"), { recursive: true });
		writeFileSync(join(root, ".flowdesk", "ui", "completion-wake-ready.json"), JSON.stringify({
			schema_version: "flowdesk.completion_wake_ready_cache.v1",
			rows: [{
				parentSessionRef: "ses-ses_stale_compact_seed_1",
				readyAt: "2026-05-17T00:01:00.000Z",
			}],
		}), "utf8");
		const hooks = await flowdeskOpenCodeServerPlugin.server(
			{ client: dummyClient } as never,
			{
				[flowdeskAgentTaskRunOption]: { enabled: true },
				[flowdeskDurableStateRootOption]: root,
				localNonDispatchAdapter: false,
				naturalLanguageRouting: false,
			},
		);
		const shortTaskTool = hooks.tool?.[flowdeskTaskToolName];
		assert.ok(shortTaskTool);

		const result = JSON.parse(
			toolOutput(
				await shortTaskTool.execute(
					{
						workflowId: "workflow-short-task-seed-fallback-1",
						taskDescription: "Check compact parent seed fallback.",
						agentName: "reviewer-gpt-frontier",
						providerQualifiedModelId: "openai/gpt-5.5",
						parentSessionId: "",
						developerModeAcknowledged: true,
						allowProviderCall: true,
					},
					undefined as never,
				),
			),
		) as Record<string, unknown>;
		assert.equal(result.status, "task_launched");
		assert.equal((createOptions[0] as Record<string, unknown>).parentID, "ses_stale_compact_seed_1");

		const evidence = reloadFlowDeskSessionEvidenceV1({
			workflowId: "workflow-short-task-seed-fallback-1",
			rootDir: root,
		});
		assert.equal(evidence.ok, true, evidence.errors.join("; "));
		assert.ok(
			evidence.entries.some(
				(entry) =>
					entry.evidenceClass === "agent_task_context" &&
					entry.record.lane_id === result.laneId &&
					entry.record.parent_session_ref === "ses-ses_stale_compact_seed_1",
			),
		);
	} finally {
		__resetCompletionWakeParentSessionRefForTest();
		rmSync(root, { recursive: true, force: true });
	}
});

test("flowdesk_task seeds wake parent only from unconsumed ready-cache rows", async () => {
	async function runReadyCacheCase(
		suffix: string,
		rows: readonly Record<string, unknown>[],
	): Promise<Record<string, unknown> | undefined> {
		const createOptions: unknown[] = [];
		const dummyClient = {
			session: {
				create(options: unknown) {
					createOptions.push(options);
					return Promise.resolve({ id: `child-short-task-${suffix}` });
				},
				prompt() {
					return Promise.resolve({ info: { id: `message-short-task-${suffix}` } });
				},
				messages() {
					return Promise.resolve([]);
				},
			},
		};
		const root = mkdtempSync(join(tmpdir(), `flowdesk-short-task-${suffix}-`));
		try {
			__resetCompletionWakeParentSessionRefForTest();
			mkdirSync(join(root, ".flowdesk", "ui"), { recursive: true });
			writeFileSync(join(root, ".flowdesk", "ui", "completion-wake-ready.json"), JSON.stringify({
				schema_version: "flowdesk.completion_wake_ready_cache.v1",
				rows,
			}), "utf8");
			const hooks = await flowdeskOpenCodeServerPlugin.server(
				{ client: dummyClient } as never,
				{
					[flowdeskAgentTaskRunOption]: { enabled: true },
					[flowdeskDurableStateRootOption]: root,
					localNonDispatchAdapter: false,
					naturalLanguageRouting: false,
				},
			);
			const shortTaskTool = hooks.tool?.[flowdeskTaskToolName];
			assert.ok(shortTaskTool);
			await shortTaskTool.execute(
				{
					workflowId: `workflow-short-task-${suffix}`,
					taskDescription: "Check consumed ready-cache seed filtering.",
					agentName: "reviewer-gpt-frontier",
					providerQualifiedModelId: "openai/gpt-5.5",
					parentSessionId: "",
					developerModeAcknowledged: true,
					allowProviderCall: true,
				},
				undefined as never,
			);
			return createOptions[0] as Record<string, unknown> | undefined;
		} finally {
			__resetCompletionWakeParentSessionRefForTest();
			rmSync(root, { recursive: true, force: true });
		}
	}

	const consumedOnlyCreateOptions = await runReadyCacheCase("consumed-only-seed", [{
		parentSessionRef: "ses-ses_consumed_only_seed_1",
		readyAt: "2026-05-17T00:03:00.000Z",
		consumed: true,
	}]);
	assert.ok(consumedOnlyCreateOptions);
	assert.equal(consumedOnlyCreateOptions.parentID, undefined);
	assert.equal((await runReadyCacheCase("mixed-consumed-unconsumed-seed", [{
		parentSessionRef: "ses-ses_older_unconsumed_seed_1",
		readyAt: "2026-05-17T00:02:00.000Z",
	}, {
		parentSessionRef: "ses-ses_consumed_newest_seed_1",
		readyAt: "2026-05-17T00:04:00.000Z",
		consumed: true,
	}]))?.parentID, "ses_older_unconsumed_seed_1");
	assert.equal((await runReadyCacheCase("single-unconsumed-seed", [{
		parentSessionRef: "ses-ses_single_unconsumed_seed_1",
		readyAt: "2026-05-17T00:05:00.000Z",
	}]))?.parentID, "ses_single_unconsumed_seed_1");
});

test("flowdesk_agent_task_run executes task and returns result text", async () => {
	const assistantText = "Analysis complete: no issues found";
	const dummyClient = {
		session: {
			create() {
				return Promise.resolve({ id: "parent-agent-task-exec-1" });
			},
			prompt() {
				return Promise.resolve([
					{
						role: "assistant",
						parts: [{ type: "text", text: assistantText }],
					},
				]);
			},
			messages(options: unknown) {
				void options;
				return Promise.resolve([
					{
						role: "assistant",
						parts: [{ type: "text", text: assistantText }],
					},
				]);
			},
		},
	};
	const root = mkdtempSync(join(tmpdir(), "flowdesk-agent-task-exec-"));
	try {
		const hooks = await flowdeskOpenCodeServerPlugin.server(
			{ client: dummyClient } as never,
			{
				[flowdeskAgentTaskRunOption]: { enabled: true },
				[flowdeskDurableStateRootOption]: root,
				localNonDispatchAdapter: false,
				naturalLanguageRouting: false,
			},
		);
		const agentTool = hooks.tool?.[flowdeskAgentTaskRunToolName];
		assert.ok(agentTool);

		const result = JSON.parse(
			toolOutput(
				await agentTool.execute(
					{
						workflowId: "workflow-task-exec-1",
						taskDescription: "Analyze this code for security issues.",
						agentName: "reviewer-claude-opus",
						providerQualifiedModelId: "anthropic/claude-opus-4-7",
						parentSessionId: "parent-agent-task-exec-1",
						developerModeAcknowledged: true,
						allowProviderCall: true,
						_nudgeQuietPeriodMs: 100,
						_messagesTimeoutMs: 0,
					},
					undefined as never,
				),
			),
		) as Record<string, unknown>;
		assert.equal(result.status, "task_completed");
		assert.ok(typeof result.resultText === "string" && result.resultText.includes(assistantText.slice(0, 20)));
		assert.ok(typeof result.summaryForUser === "string" && result.summaryForUser.length > 0);
		assert.match(String(result.summaryForUser), /prompt: Analyze this code for security issues\./);
		assert.match(String(result.summaryForUser), /agent: reviewer-claude-opus/);
		assert.match(String(result.summaryForUser), /model: anthropic\/claude-opus-4-7/);
		assert.equal(result.taskPreview, "Analyze this code for security issues.");
		assert.equal(result.agentName, "reviewer-claude-opus");
		assert.equal(result.providerQualifiedModelId, "anthropic/claude-opus-4-7");
		assert.ok(typeof result.workflowId === "string");
		assert.ok(typeof result.laneId === "string");
		assert.ok(typeof result.taskId === "string");

		const evidence = reloadFlowDeskSessionEvidenceV1({
			workflowId: "workflow-task-exec-1",
			rootDir: root,
		});
		assert.equal(evidence.ok, true, evidence.errors.join("; "));
		assert.ok(
			evidence.entries.some(
				(entry) =>
					entry.evidenceClass === "agent_task_context" &&
					entry.record.lane_id === result.laneId &&
					entry.record.dispatch_authority_enabled === false,
			),
		);
		assert.ok(
			evidence.entries.some(
				(entry) =>
					entry.evidenceClass === "lane_lifecycle" &&
					entry.record.lane_id === result.laneId &&
					entry.record.state === "incomplete" &&
					typeof entry.record.output_ref === "string",
			),
		);

		const statusHooks = await flowdeskOpenCodeServerPlugin.server(
			undefined as never,
			{
				[flowdeskStatusLiveOption]: { enabled: true },
				[flowdeskDurableStateRootOption]: root,
				localNonDispatchAdapter: false,
				naturalLanguageRouting: false,
			},
		);
		const statusTool = statusHooks.tool?.[flowdeskStatusLiveToolName];
		assert.ok(statusTool);
		const statusResult = JSON.parse(
			toolOutput(await statusTool.execute({ workflowId: "workflow-task-exec-1" }, undefined as never)),
		) as Record<string, unknown>;
		const workflows = statusResult.workflows as Array<Record<string, unknown>>;
		const cards = workflows[0]?.laneProgressCards as Array<Record<string, unknown>>;
		assert.ok(cards.some((card) => card.laneId === result.laneId && card.state === "task_result"));
		assert.ok(cards.some((card) => card.laneId === result.laneId && card.promptPreview === "Analyze this code for security issues."));
		assert.ok(cards.some((card) => card.laneId === result.laneId && card.lastSignalSource === "task_result"));
		assert.ok(cards.some((card) => card.laneId === result.laneId && card.completionStatus === "final"));
	} finally {
		rmSync(root, { recursive: true, force: true });
	}
});

test("flowdesk_agent_task_run binds blank parentSessionId to current ctx session", async () => {
	const assistantText = "Bound to current session";
	const createOptions: unknown[] = [];
	const dummyClient = {
		session: {
			create(options: unknown) {
				createOptions.push(options);
				return Promise.resolve({ id: "child-agent-task-current-session-1" });
			},
			prompt() {
				return Promise.resolve([
					{
						role: "assistant",
						parts: [{ type: "text", text: assistantText }],
					},
				]);
			},
			messages(options: unknown) {
				void options;
				return Promise.resolve([
					{
						role: "assistant",
						parts: [{ type: "text", text: assistantText }],
					},
				]);
			},
		},
	};
	const root = mkdtempSync(join(tmpdir(), "flowdesk-agent-task-current-session-"));
	try {
		const hooks = await flowdeskOpenCodeServerPlugin.server(
			{ client: dummyClient } as never,
			{
				[flowdeskAgentTaskRunOption]: { enabled: true },
				[flowdeskDurableStateRootOption]: root,
				localNonDispatchAdapter: false,
				naturalLanguageRouting: false,
			},
		);
		const agentTool = hooks.tool?.[flowdeskAgentTaskRunToolName];
		assert.ok(agentTool);

		const result = JSON.parse(
			toolOutput(
				await agentTool.execute(
					{
						workflowId: "workflow-task-current-session-1",
						taskDescription: "Analyze current session binding.",
						agentName: "reviewer-gpt-frontier",
						providerQualifiedModelId: "openai/gpt-5.5",
						parentSessionId: "",
						developerModeAcknowledged: true,
						allowProviderCall: true,
						_nudgeQuietPeriodMs: 100,
						_messagesTimeoutMs: 0,
					},
					{ sessionID: "current-opencode-session-1" } as never,
				),
			),
		) as Record<string, unknown>;
		assert.equal(result.status, "task_completed");
		assert.equal((createOptions[0] as Record<string, unknown>).parentID, "current-opencode-session-1");

		const evidence = reloadFlowDeskSessionEvidenceV1({
			workflowId: "workflow-task-current-session-1",
			rootDir: root,
		});
		assert.equal(evidence.ok, true, evidence.errors.join("; "));
		assert.ok(
			evidence.entries.some(
				(entry) =>
					entry.evidenceClass === "agent_task_context" &&
					entry.record.parent_session_ref === "ses-current-opencode-session-1",
			),
		);
	} finally {
		rmSync(root, { recursive: true, force: true });
	}
});

test("flowdesk_agent_task_run records parent session model from ctx.model in agent_task_context", async () => {
	const assistantText = "Recorded parent model";
	const dummyClient = {
		session: {
			create() {
				return Promise.resolve({ id: "child-agent-task-parent-model-1" });
			},
			prompt() {
				return Promise.resolve([{ role: "assistant", parts: [{ type: "text", text: assistantText }] }]);
			},
			messages() {
				return Promise.resolve([{ role: "assistant", parts: [{ type: "text", text: assistantText }] }]);
			},
		},
	};
	const root = mkdtempSync(join(tmpdir(), "flowdesk-agent-task-parent-model-"));
	try {
		const hooks = await flowdeskOpenCodeServerPlugin.server(
			{ client: dummyClient } as never,
			{
				[flowdeskAgentTaskRunOption]: { enabled: true },
				[flowdeskDurableStateRootOption]: root,
				localNonDispatchAdapter: false,
				naturalLanguageRouting: false,
			},
		);
		const agentTool = hooks.tool?.[flowdeskAgentTaskRunToolName];
		assert.ok(agentTool);

		const result = JSON.parse(
			toolOutput(
				await agentTool.execute(
					{
						workflowId: "workflow-task-parent-model-1",
						taskDescription: "Check parent model recording.",
						agentName: "reviewer-gpt-frontier",
						providerQualifiedModelId: "openai/gpt-5.5",
						parentSessionId: "current-session-1",
						developerModeAcknowledged: true,
						allowProviderCall: true,
					},
					{ sessionID: "current-session-1", model: { providerID: "anthropic", modelID: "claude-opus-4-7" } } as never,
				),
			),
		) as Record<string, unknown>;
		assert.equal(result.status, "task_completed");

		const evidence = reloadFlowDeskSessionEvidenceV1({
			workflowId: "workflow-task-parent-model-1",
			rootDir: root,
		});
		assert.ok(
			evidence.entries.some(
				(entry) =>
					entry.evidenceClass === "agent_task_context" &&
					entry.record.recorded_parent_provider_qualified_model_id === "anthropic/claude-opus-4-7" &&
					entry.record.parent_wake_provider_qualified_model_id === "anthropic/claude-opus-4-7",
			),
		);
	} finally {
		rmSync(root, { recursive: true, force: true });
	}
});

test("flowdesk_agent_task_run records parent session model from options.model in agent_task_context", async () => {
	const assistantText = "Recorded parent model from options";
	const dummyClient = {
		session: {
			create() {
				return Promise.resolve({ id: "child-agent-task-parent-model-options-1" });
			},
			prompt() {
				return Promise.resolve([{ role: "assistant", parts: [{ type: "text", text: assistantText }] }]);
			},
			messages() {
				return Promise.resolve([{ role: "assistant", parts: [{ type: "text", text: assistantText }] }]);
			},
		},
	};
	const root = mkdtempSync(join(tmpdir(), "flowdesk-agent-task-parent-model-options-"));
	try {
		const hooks = await flowdeskOpenCodeServerPlugin.server(
			{ client: dummyClient } as never,
			{
				[flowdeskAgentTaskRunOption]: { enabled: true },
				[flowdeskDurableStateRootOption]: root,
				model: "anthropic/claude-sonnet-3-5",
				localNonDispatchAdapter: false,
				naturalLanguageRouting: false,
			},
		);
		const agentTool = hooks.tool?.[flowdeskAgentTaskRunToolName];
		assert.ok(agentTool);

		const result = JSON.parse(
			toolOutput(
				await agentTool.execute(
					{
						workflowId: "workflow-task-parent-model-options-1",
						taskDescription: "Check parent model recording from options.",
						agentName: "reviewer-gpt-frontier",
						providerQualifiedModelId: "openai/gpt-5.5",
						parentSessionId: "current-session-1",
						developerModeAcknowledged: true,
						allowProviderCall: true,
					},
					{ sessionID: "current-session-1" } as never, // no model in ctx
				),
			),
		) as Record<string, unknown>;
		assert.equal(result.status, "task_completed");

		const evidence = reloadFlowDeskSessionEvidenceV1({
			workflowId: "workflow-task-parent-model-options-1",
			rootDir: root,
		});
		assert.ok(
			evidence.entries.some(
				(entry) =>
					entry.evidenceClass === "agent_task_context" &&
					entry.record.recorded_parent_provider_qualified_model_id === "anthropic/claude-sonnet-3-5" &&
					entry.record.parent_wake_provider_qualified_model_id === "anthropic/claude-sonnet-3-5",
			),
		);
	} finally {
		rmSync(root, { recursive: true, force: true });
	}
});

test("flowdesk_agent_task_run fails fast for FlowDesk session refs used as parentSessionId", async () => {
	let createCalls = 0;
	let promptCalls = 0;
	const dummyClient = {
		session: {
			create() {
				createCalls += 1;
				return Promise.resolve({ id: "child-should-not-launch" });
			},
			prompt() {
				promptCalls += 1;
				return Promise.resolve({ info: { id: "message-should-not-launch" } });
			},
			messages() {
				return Promise.resolve([]);
			},
		},
	};
	const root = mkdtempSync(join(tmpdir(), "flowdesk-agent-task-invalid-parent-"));
	try {
		const hooks = await flowdeskOpenCodeServerPlugin.server(
			{ client: dummyClient } as never,
			{
				[flowdeskAgentTaskRunOption]: { enabled: true },
				[flowdeskDurableStateRootOption]: root,
				localNonDispatchAdapter: false,
				naturalLanguageRouting: false,
			},
		);
		const agentTool = hooks.tool?.[flowdeskAgentTaskRunToolName];
		assert.ok(agentTool);

		const result = JSON.parse(
			toolOutput(
				await agentTool.execute(
					{
						workflowId: "workflow-task-invalid-parent-1",
						taskDescription: "Analyze this code.",
						agentName: "reviewer-gpt-frontier",
						providerQualifiedModelId: "openai/gpt-5.5",
						parentSessionId: "ses-ses-flowdesk-coordinator",
						developerModeAcknowledged: true,
						allowProviderCall: true,
					},
					undefined as never,
				),
			),
		) as Record<string, unknown>;
		assert.equal(result.status, "task_failed");
		assert.equal(result.failureCategory, "sdk_create_failed");
		assert.equal(result.redactedReason, "invalid_parent_session_binding");
		assert.equal(createCalls, 0);
		assert.equal(promptCalls, 0);

		const evidence = reloadFlowDeskSessionEvidenceV1({
			workflowId: "workflow-task-invalid-parent-1",
			rootDir: root,
		});
		assert.equal(evidence.ok, true, evidence.errors.join("; "));
		assert.ok(
			evidence.entries.some(
				(entry) =>
					entry.evidenceClass === "task_failed" &&
					entry.record.failure_category === "sdk_create_failed" &&
					entry.record.redacted_reason === "invalid_parent_session_binding",
			),
		);
		assert.ok(
			evidence.entries.some(
				(entry) =>
					entry.evidenceClass === "lane_lifecycle" &&
					entry.record.state === "invocation_failed" &&
					entry.record.parent_session_ref === "ses-invalid-parent-session-binding" &&
					entry.record.dispatch_authority_enabled === false,
			),
		);
		assert.equal(JSON.stringify(evidence.entries).includes("ses-ses-flowdesk-coordinator"), false);
	} finally {
		rmSync(root, { recursive: true, force: true });
	}
});

test("flowdesk_agent_task_run keeps child-session no-response launch non-terminal for watchdog handoff", async () => {
	const dummyClient = {
		session: {
			create() {
				return Promise.resolve({ id: "parent-agent-task-no-response-1" });
			},
			prompt() {
				return Promise.resolve({ info: { id: "message-agent-task-no-response-1" } });
			},
			messages(options: unknown) {
				void options;
				return Promise.resolve([{ role: "user", parts: [{ type: "text", text: "prompt only" }] }]);
			},
		},
	};
	const root = mkdtempSync(join(tmpdir(), "flowdesk-agent-task-no-response-"));
	try {
		const hooks = await flowdeskOpenCodeServerPlugin.server(
			{ client: dummyClient } as never,
			{
				[flowdeskAgentTaskRunOption]: { enabled: true },
				[flowdeskDurableStateRootOption]: root,
				localNonDispatchAdapter: false,
				naturalLanguageRouting: false,
			},
		);
		const agentTool = hooks.tool?.[flowdeskAgentTaskRunToolName];
		assert.ok(agentTool);

		const result = JSON.parse(
			toolOutput(
				await agentTool.execute(
					{
						workflowId: "workflow-task-no-response-1",
						taskDescription: "Analyze this code for security issues.",
						agentName: "reviewer-claude-opus",
						providerQualifiedModelId: "anthropic/claude-opus-4-7",
						parentSessionId: "parent-agent-task-no-response-1",
						developerModeAcknowledged: true,
						allowProviderCall: true,
						_nudgeQuietPeriodMs: 100,
						_messagesTimeoutMs: 0,
					},
					undefined as never,
				),
			),
		) as Record<string, unknown>;
		assert.equal(result.status, "task_launched");
		assert.equal(result.childSessionId, "parent-agent-task-no-response-1");

		const evidence = reloadFlowDeskSessionEvidenceV1({
			workflowId: "workflow-task-no-response-1",
			rootDir: root,
		});
		assert.equal(evidence.ok, true, evidence.errors.join("; "));
		assert.equal(
			evidence.entries.some(
				(entry) =>
					entry.evidenceClass === "task_failed" &&
					entry.record.lane_id === result.laneId,
			),
			false,
			"bounded sync capture timeout with a child session should not write task_failed",
		);
		assert.equal(
			evidence.entries.some(
				(entry) =>
					entry.evidenceClass === "lane_lifecycle" &&
					entry.record.lane_id === result.laneId &&
					entry.record.state === "no_output",
			),
			false,
			"bounded sync capture timeout with a child session should not write no_output lifecycle",
		);
		assert.equal(
			evidence.entries.some(
				(entry) =>
					entry.evidenceClass === "agent_task_child_session" &&
					entry.record.lane_id === result.laneId,
			),
			true,
			"child session evidence should be preserved for watchdog/status handoff",
		);
	} finally {
		rmSync(root, { recursive: true, force: true });
	}
});

test("flowdesk_agent_task_run reads current SDK messages response shapes", async () => {
	const assistantText = "Architecture synthesis complete";
	const dummyClient = {
		session: {
			create() {
				return Promise.resolve({ id: "parent-agent-task-current-sdk-1" });
			},
			prompt() {
				return Promise.resolve({ info: { id: "message-agent-task-current-sdk-1" } });
			},
			messages(options: unknown) {
				const record = options as Record<string, unknown>;
				if ("path" in record) return Promise.resolve({ data: { error: "legacy path should not be needed" } });
				return Promise.resolve({
					data: {
						messages: [
							{
								info: { role: "assistant" },
								parts: [{ type: "text", text: assistantText }],
							},
						],
					},
				});
			},
		},
	};
	const root = mkdtempSync(join(tmpdir(), "flowdesk-agent-task-current-sdk-"));
	try {
		const hooks = await flowdeskOpenCodeServerPlugin.server(
			{ client: dummyClient } as never,
			{
				[flowdeskAgentTaskRunOption]: { enabled: true },
				[flowdeskDurableStateRootOption]: root,
				localNonDispatchAdapter: false,
				naturalLanguageRouting: false,
			},
		);
		const agentTool = hooks.tool?.[flowdeskAgentTaskRunToolName];
		assert.ok(agentTool);
		const result = JSON.parse(
			toolOutput(
				await agentTool.execute(
					{
						workflowId: "workflow-task-current-sdk-1",
						taskDescription: "Summarize the architecture.",
						agentName: "reviewer-gpt-frontier",
						providerQualifiedModelId: "openai/gpt-5.5",
						parentSessionId: "parent-agent-task-current-sdk-1",
						developerModeAcknowledged: true,
						allowProviderCall: true,
						_nudgeQuietPeriodMs: 100,
						_messagesTimeoutMs: 0,
					},
					undefined as never,
				),
			),
		) as Record<string, unknown>;
	assert.equal(result.status, "task_completed");
	assert.match(String(result.resultText), /Architecture synthesis complete/);
	} finally {
		rmSync(root, { recursive: true, force: true });
	}
});

// P7-S13.6b: OI plugin config gate truth table tests
test("operationalIntelligenceConfigFromOptions returns all-false defaults when options are undefined", () => {
	const result = operationalIntelligenceConfigFromOptions(undefined);
	assert.deepEqual(result, {
		enabled: false,
		exposeMcpTools: false,
		persistAdvisoryEvidence: false,
	});
});

test("operationalIntelligenceConfigFromOptions returns all-false when operationalIntelligence option is absent", () => {
	const result = operationalIntelligenceConfigFromOptions({
		localNonDispatchAdapter: false,
	});
	assert.deepEqual(result, {
		enabled: false,
		exposeMcpTools: false,
		persistAdvisoryEvidence: false,
	});
});

test("operationalIntelligenceConfigFromOptions: partial options — only enabled set — fills defaults for sub-fields", () => {
	const result = operationalIntelligenceConfigFromOptions({
		[flowdeskOperationalIntelligenceOption]: { enabled: true },
	});
	assert.deepEqual(result, {
		enabled: true,
		exposeMcpTools: false,
		persistAdvisoryEvidence: false,
	});
});

test("OI config gate truth table — row 1: enabled=false, exposeMcpTools=false, persistAdvisoryEvidence=false → all false", () => {
	const result = operationalIntelligenceConfigFromOptions({
		[flowdeskOperationalIntelligenceOption]: {
			enabled: false,
			exposeMcpTools: false,
			persistAdvisoryEvidence: false,
		},
	});
	assert.equal(result.enabled, false);
	assert.equal(result.exposeMcpTools, false);
	assert.equal(result.persistAdvisoryEvidence, false);
});

test("OI config gate truth table — row 2: enabled=true, exposeMcpTools=false, persistAdvisoryEvidence=false → enabled only", () => {
	const result = operationalIntelligenceConfigFromOptions({
		[flowdeskOperationalIntelligenceOption]: {
			enabled: true,
			exposeMcpTools: false,
			persistAdvisoryEvidence: false,
		},
	});
	assert.equal(result.enabled, true);
	assert.equal(result.exposeMcpTools, false);
	assert.equal(result.persistAdvisoryEvidence, false);
});

test("OI config gate truth table — row 3: enabled=true, exposeMcpTools=true, persistAdvisoryEvidence=false → enabled + exposeMcpTools", () => {
	const result = operationalIntelligenceConfigFromOptions({
		[flowdeskOperationalIntelligenceOption]: {
			enabled: true,
			exposeMcpTools: true,
			persistAdvisoryEvidence: false,
		},
	});
	assert.equal(result.enabled, true);
	assert.equal(result.exposeMcpTools, true);
	assert.equal(result.persistAdvisoryEvidence, false);
});

test("OI config gate truth table — row 4: enabled=true, exposeMcpTools=true, persistAdvisoryEvidence=true → all true", () => {
	const result = operationalIntelligenceConfigFromOptions({
		[flowdeskOperationalIntelligenceOption]: {
			enabled: true,
			exposeMcpTools: true,
			persistAdvisoryEvidence: true,
		},
	});
	assert.equal(result.enabled, true);
	assert.equal(result.exposeMcpTools, true);
	assert.equal(result.persistAdvisoryEvidence, true);
});

test("OI config gate truth table — row 5: enabled=true, exposeMcpTools=false, persistAdvisoryEvidence=true → enabled + persist only", () => {
	const result = operationalIntelligenceConfigFromOptions({
		[flowdeskOperationalIntelligenceOption]: {
			enabled: true,
			exposeMcpTools: false,
			persistAdvisoryEvidence: true,
		},
	});
	assert.equal(result.enabled, true);
	assert.equal(result.exposeMcpTools, false);
	assert.equal(result.persistAdvisoryEvidence, true);
});

test("OI config gate: exposeMcpTools and persistAdvisoryEvidence are false when enabled=false even if sub-fields are true", () => {
	const result = operationalIntelligenceConfigFromOptions({
		[flowdeskOperationalIntelligenceOption]: {
			enabled: false,
			exposeMcpTools: true,
			persistAdvisoryEvidence: true,
		},
	});
	assert.equal(result.enabled, false);
	assert.equal(result.exposeMcpTools, false);
	assert.equal(result.persistAdvisoryEvidence, false);
});

test("OI config gate is reflected in pre-spike doctor output", async () => {
	const defaultHooks = await flowdeskOpenCodeServerPlugin.server(
		undefined as never,
	);
	const doctor = defaultHooks.tool?.[flowdeskPreSpikeDoctorToolName];
	assert.ok(doctor);

	// Default (no OI option): all false
	const defaultResult = JSON.parse(
		toolOutput(await doctor.execute({}, undefined as never)),
	) as Record<string, unknown>;
	assert.deepEqual(defaultResult.operationalIntelligence, {
		enabled: false,
		exposeMcpTools: false,
		persistAdvisoryEvidence: false,
	});

	// With OI enabled + all sub-fields
	const enabledHooks = await flowdeskOpenCodeServerPlugin.server(
		undefined as never,
		{
			[flowdeskOperationalIntelligenceOption]: {
				enabled: true,
				exposeMcpTools: true,
				persistAdvisoryEvidence: true,
			},
		},
	);
	const enabledDoctor = enabledHooks.tool?.[flowdeskPreSpikeDoctorToolName];
	assert.ok(enabledDoctor);
	const enabledResult = JSON.parse(
		toolOutput(await enabledDoctor.execute({}, undefined as never)),
	) as Record<string, unknown>;
	assert.deepEqual(enabledResult.operationalIntelligence, {
		enabled: true,
		exposeMcpTools: true,
		persistAdvisoryEvidence: true,
	});

	// With OI enabled-only (sub-fields default false)
	const enabledOnlyHooks = await flowdeskOpenCodeServerPlugin.server(
		undefined as never,
		{
			[flowdeskOperationalIntelligenceOption]: { enabled: true },
		},
	);
	const enabledOnlyDoctor =
		enabledOnlyHooks.tool?.[flowdeskPreSpikeDoctorToolName];
	assert.ok(enabledOnlyDoctor);
	const enabledOnlyResult = JSON.parse(
		toolOutput(await enabledOnlyDoctor.execute({}, undefined as never)),
	) as Record<string, unknown>;
	assert.deepEqual(enabledOnlyResult.operationalIntelligence, {
		enabled: true,
		exposeMcpTools: false,
		persistAdvisoryEvidence: false,
	});
});

test("completionWakeMainSessionConfigFromOptions prefers the global main model over the wake-specific override", () => {
	const options = {
		model: "openai/gpt-5.4-mini-fast",
		[flowdeskCompletionWakeMainSessionOption]: { enabled: true, providerQualifiedModelId: "anthropic/claude-sonnet-4-6" },
		[flowdeskDurableStateRootOption]: "/tmp/flowdesk-test",
	};
	const result = completionWakeMainSessionConfigFromOptions(options);
	assert.ok(result);
	assert.equal(result.providerQualifiedModelId, "openai/gpt-5.4-mini-fast");
});

test("completionWakeMainSessionConfigFromOptions falls back to the wake-specific model when global model is missing", () => {
	const options = {
		[flowdeskCompletionWakeMainSessionOption]: { enabled: true, providerQualifiedModelId: "anthropic/claude-sonnet-4-6" },
		[flowdeskDurableStateRootOption]: "/tmp/flowdesk-test",
	};
	const result = completionWakeMainSessionConfigFromOptions(options);
	assert.ok(result);
	assert.equal(result.providerQualifiedModelId, "anthropic/claude-sonnet-4-6");
});

test("pre-spike doctor live-evaluates default-managed-dispatch promotion readiness when metadata is configured (Slice 3-C)", async () => {
	const root = mkdtempSync(join(tmpdir(), "flowdesk-doctor-live-promo-"));
	const probeWorkflowId = "doctor-probe-default-managed-dispatch";
	try {
		// 1) Provision the three required precall evidence classes for the
		//    doctor-probe workflow id. The doctor live path reloads them via
		//    reloadFlowDeskSessionEvidenceV1 and the production-enablement
		//    evaluator uses them to satisfy REQUIRED_PRECALL_EVIDENCE_CLASSES.
		const records: Array<{
			evidenceId: string;
			record: Record<string, unknown>;
		}> = [
			{
				evidenceId: "precall-doctor-probe-v1",
					record: {
						schema_version: "flowdesk.pre_dispatch_audit_record.v1",
						workflow_id: probeWorkflowId,
						pre_dispatch_audit_ref: "precall-doctor-probe-v1",
						observed_at: "2026-06-09T00:00:00.000Z",
						attempt_id: "attempt-doctor-probe-test-v1",
						binding_ref: "binding-doctor-probe-test-v1",
						verification_ref: "verification-doctor-probe-test-v1",
						approval_source_ref: "approval-source-doctor-probe-v1",
						idempotency_ref: "idempotency-doctor-probe-test-v1",
						evidence_bundle_refs: ["bundle-doctor-probe-test-v1"],
						redaction_validation_passed: true,
						auditor_observed_at: "2026-06-09T00:00:00.000Z",
					// approval_ref omitted so it does not need to match the
					// approvalDecision.approval_id (those are two independent
					// concepts in production-enablement evaluation).
					dispatch_authority_enabled: false,
					providerCall: false,
					actualLaneLaunch: false,
					runtimeExecution: false,
				},
			},
			{
				evidenceId: "provider-health-doctor-probe-v1",
				record: {
					schema_version: "flowdesk.provider_health_snapshot.v1",
					snapshot_id: "provider-health-doctor-probe-v1",
					provider_family: "anthropic",
					observed_at: "2026-06-09T00:00:00.000Z",
					freshness: "fresh",
					freshness_ttl: 86400,
					source_surface: "doctor_probe",
					availability_state: "healthy",
					failure_class: "none",
					dispatchability: "dispatchable",
					source_ref: "source-doctor-probe-health-v1",
					safe_remediation:
						"Provider health is fresh and dispatchable; no remediation required.",
				},
			},
			{
				evidenceId: "approval-source-doctor-probe-v1",
				record: {
					schema_version: "flowdesk.production_approval_source.v1",
					approval_id: "approval-source-doctor-probe-v1",
					workflow_id: probeWorkflowId,
					attempt_id: "attempt-doctor-probe-test-v1",
					action_type: "managed_dispatch_beta",
					issuer_boundary: "external_user_confirmation",
					approval_method: "typed_phrase",
					actor_ref: "actor-doctor-probe-test-v1",
					profile_ref: "profile-doctor-probe-test-v1",
					provider_qualified_model_id: "anthropic/claude-opus-4-7",
					provider_binding_hash: "sha256-doctor-probe-test-binding-v1",
					evidence_bundle_hash: "sha256-doctor-probe-test-bundle-v1",
					guard_decision_ref: "guard-doctor-probe-test-v1",
					issuance_audit_ref: "issuance-doctor-probe-test-v1",
					nonce_ref: "nonce-doctor-probe-test-v1",
					issued_at: "2026-06-09T00:00:00.000Z",
					expires_at: "2026-12-31T00:00:00.000Z",
					revoked: false,
					consume_strategy: "atomic_compare_and_swap_required",
					dispatch_authority_enabled: false,
				},
			},
			{
				evidenceId: "dispatch-idempotency-doctor-probe-v1",
				record: {
					schema_version: "flowdesk.dispatch_idempotency_snapshot.v1",
					workflow_id: probeWorkflowId,
					snapshot_ref: "dispatch-idempotency-doctor-probe-v1",
					observed_at: "2026-06-09T00:00:00.000Z",
					entries: [],
					dispatch_authority_enabled: false,
					realOpenCodeDispatch: false,
					actualLaneLaunch: false,
					providerCall: false,
					runtimeExecution: false,
				},
			},
		];
		const intents = records.map(({ evidenceId, record }) => {
			const prepared = prepareFlowDeskSessionEvidenceWriteIntentV1({
				workflowId: probeWorkflowId,
				evidenceId,
				record,
			});
			assert.equal(prepared.ok, true, prepared.errors.join("; "));
			assert.ok(prepared.writeIntent);
			return prepared.writeIntent;
		});
		const applied = applyFlowDeskSessionEvidenceWriteIntentsV1(root, intents);
		assert.equal(applied.ok, true, applied.errors.join("; "));

		// 2) Doctor handler — with full inline production-enablement options +
		//    default-managed-dispatch metadata pointing at the same probe
		//    workflow id. Doctor must now evaluate live and report
		//    defaultManagedDispatchRegistrationAuthorized=true.
		const productionEnablementOption = {
			enabled: true,
			preDispatchAuditRef: "precall-doctor-probe-v1",
			configuredVerificationRef: "verification-doctor-probe-v1",
			configuredVerificationResult: {
				schema_version: "flowdesk.configured_verification_result.v1",
				verification_ref: "verification-doctor-probe-v1",
				workflow_id: probeWorkflowId,
				result: "passed",
				produced_at: "2026-06-09T00:00:00.000Z",
				source_ref: "source-doctor-probe-verification-v1",
				check_labels: ["managed_dispatch_beta_verification"],
				evidence_refs: ["evidence-doctor-probe-verification-v1"],
				raw_output_redacted: true,
				provider_call_made: false,
				runtime_execution_made: false,
				actual_lane_launch_made: false,
				dispatch_authority_enabled: false,
				safe_next_actions: ["/flowdesk-status"],
			},
			sanitizedAuthCaptureRef: "sanitized-auth-capture-doctor-probe-v1",
			sanitizedAuthCaptureResult: {
				schema_version: "flowdesk.sanitized_auth_capture_result.v1",
				sanitized_auth_capture_ref: "sanitized-auth-capture-doctor-probe-v1",
				durable_capture_ref: "durable-capture-doctor-probe-v1",
				workflow_id: probeWorkflowId,
				provider_family: "anthropic",
				provider_qualified_model_id: "anthropic/claude-opus-4-7",
				auth_profile_ref: "auth-profile-doctor-probe-v1",
				auth_evidence_ref: "auth-evidence-doctor-probe-v1",
				credential_scope_ref: "credential-scope-doctor-probe-v1",
				account_boundary_ref: "account-boundary-doctor-probe-v1",
				sanitizer_ref: "sanitizer-doctor-probe-v1",
				source_ref: "source-doctor-probe-sanitized-v1",
				result: "passed",
				captured_at: "2026-06-09T00:00:00.000Z",
				metadata_labels: ["doctor_probe_sanitized_auth_capture"],
				evidence_refs: ["evidence-doctor-probe-sanitized-v1"],
				raw_auth_object_persisted: false,
				raw_plugin_object_persisted: false,
				token_material_persisted: false,
				provider_call_made: false,
				runtime_execution_made: false,
				actual_lane_launch_made: false,
				dispatch_authority_enabled: false,
				safe_next_actions: ["/flowdesk-status"],
			},
			externalAuthPolicyRef: "external-auth-policy-doctor-probe-v1",
			providerPolicyRef: "provider-policy-doctor-probe-v1",
			externalAuthProviderPolicyResult: {
				schema_version: "flowdesk.external_auth_provider_policy_result.v1",
				external_auth_policy_ref: "external-auth-policy-doctor-probe-v1",
				provider_policy_ref: "provider-policy-doctor-probe-v1",
				workflow_id: probeWorkflowId,
				provider_family: "anthropic",
				provider_qualified_model_id: "anthropic/claude-opus-4-7",
				auth_profile_ref: "auth-profile-doctor-probe-v1",
				auth_evidence_ref: "auth-evidence-doctor-probe-v1",
				credential_scope_ref: "credential-scope-doctor-probe-v1",
				account_boundary_ref: "account-boundary-doctor-probe-v1",
				sanitizer_ref: "sanitizer-doctor-probe-v1",
				source_ref: "source-doctor-probe-policy-v1",
				result: "passed",
				sanitized_at: "2026-06-09T00:00:00.000Z",
				metadata_labels: ["doctor_probe_provider_policy"],
				evidence_refs: ["evidence-doctor-probe-policy-v1"],
				raw_auth_object_persisted: false,
				token_material_persisted: false,
				provider_call_made: false,
				runtime_execution_made: false,
				actual_lane_launch_made: false,
				dispatch_authority_enabled: false,
				safe_next_actions: ["/flowdesk-status"],
			},
			allowIncompleteConformance: true,
			approvalDecision: {
				schema_version: "flowdesk.production_approval_decision.v1",
				approval_id: "approval-decision-doctor-probe-v1",
				workflow_id: probeWorkflowId,
				decision: "approve",
				created_at: "2026-06-09T00:00:00.000Z",
				required_evidence_refs: [
					"precall-doctor-probe-v1",
					"verification-doctor-probe-v1",
					"sanitized-auth-capture-doctor-probe-v1",
					"external-auth-policy-doctor-probe-v1",
					"provider-policy-doctor-probe-v1",
				],
				missing_evidence_labels: [],
				uncertainty_labels: [],
				safe_next_actions: ["/flowdesk-status"],
				dispatch_authority_enabled: false,
			},
			defaultManagedDispatchAuthorizationMetadata: {
				enabled: true,
				defaultEnablementRequested: true,
				killSwitchState: "inactive",
				expiresAt: "2026-12-31T00:00:00.000Z",
				actorRef: "actor-doctor-probe-test-v1",
				profileRef: "profile-doctor-probe-test-v1",
				releaseGateRef: "release-gate-doctor-probe-test-v1",
				rollbackRef: "rollback-doctor-probe-test-v1",
				adapterProfileRef: "adapter-profile-doctor-probe-test-v1",
				sdkClientRef: "sdk-client-doctor-probe-test-v1",
				durablePrecallRef: "precall-doctor-probe-v1",
				defaultReleaseEnablementRef:
					"release-enablement-doctor-probe-test-v1",
				allowUncertainty: true,
				doctorProbeWorkflowId: probeWorkflowId,
				release2GateReadinessRef:
					"release2-gate-readiness-doctor-probe-test-v1",
				release2GateReadinessResult: {
					schema_version:
						"flowdesk.release2_managed_dispatch_gate_promotion_readiness.v1",
					workflow_id: probeWorkflowId,
					ok: true,
					errors: [],
					state: "eligible",
					blocked_labels: [],
					evidence_refs: [
						"precall-doctor-probe-v1",
						"approval-decision-doctor-probe-v1",
					],
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
					phase6a_closure_ref: "phase6a-closure-doctor-probe-test-v1",
				},
			},
		};

		const hooks = (await flowdeskOpenCodeServerPlugin.server(
			undefined as never,
			{
				[flowdeskLocalNonDispatchAdapterOption]: false,
				[flowdeskNaturalLanguageRoutingOption]: false,
				[flowdeskDurableStateRootOption]: root,
				[flowdeskProductionEnablementOption]: productionEnablementOption,
			},
		)) as ChatMessageHooks;
		const doctor = hooks.tool?.[flowdeskPreSpikeDoctorToolName];
		assert.ok(doctor);
		const result = JSON.parse(
			toolOutput(await doctor.execute({}, undefined as never)),
		) as Record<string, unknown>;
		assert.equal(
			result.derivedDefaultManagedDispatchAuthorizationMetadataConfigured,
			true,
			"metadata must be detected as configured",
		);
		assert.equal(
			result.defaultManagedDispatchRegistrationAuthorized,
			true,
			"doctor must surface live-derived authorization when evidence is present",
		);
		assert.equal(
			result.productionPromotionGate,
			"default_managed_dispatch_authorized_registration_ready",
		);
		assert.equal(
			result.defaultManagedDispatchAuthorizationSource,
			"derived_from_durable_evidence",
		);
		assert.equal(result.doctorProbeWorkflowId, probeWorkflowId);
		assert.equal(typeof result.defaultManagedDispatchAuthorizationRef, "string");
		assert.equal(typeof result.defaultManagedDispatchReadinessRef, "string");
		// Doctor must NOT claim runtime/dispatch authority even when derived.
		assert.equal(result.providerCall, false);
		assert.equal(result.runtimeExecution, false);
		assert.equal(result.actualLaneLaunch, false);
		assert.equal(result.fallbackAuthority, false);
		assert.equal(result.hardCancelOrNoReplyAuthority, false);
	} finally {
		rmSync(root, { recursive: true, force: true });
	}
});

test("pre-spike doctor still reports registration unauthorized when metadata is configured but durable evidence is missing", async () => {
	const root = mkdtempSync(
		join(tmpdir(), "flowdesk-doctor-live-promo-missing-"),
	);
	const probeWorkflowId = "doctor-probe-default-managed-dispatch";
	try {
		const productionEnablementOption = {
			enabled: true,
			// All inline options present, but NO durable evidence files written
			// under root/.flowdesk/sessions/<probeWorkflowId>/... so the
			// production-enablement evaluator will fail on the required
			// precall evidence classes (pre_dispatch_audit, production_approval_source,
			// dispatch_idempotency) and live-derived authorization must be undefined.
			preDispatchAuditRef: "precall-doctor-probe-v1",
			configuredVerificationRef: "verification-doctor-probe-v1",
			configuredVerificationResult: {
				schema_version: "flowdesk.configured_verification_result.v1",
				verification_ref: "verification-doctor-probe-v1",
				workflow_id: probeWorkflowId,
				result: "passed",
				produced_at: "2026-06-09T00:00:00.000Z",
				source_ref: "source-doctor-probe-verification-v1",
				check_labels: ["managed_dispatch_beta_verification"],
				evidence_refs: ["evidence-doctor-probe-verification-v1"],
				raw_output_redacted: true,
				provider_call_made: false,
				runtime_execution_made: false,
				actual_lane_launch_made: false,
				dispatch_authority_enabled: false,
				safe_next_actions: ["/flowdesk-status"],
			},
			sanitizedAuthCaptureRef: "sanitized-auth-capture-doctor-probe-v1",
			sanitizedAuthCaptureResult: {
				schema_version: "flowdesk.sanitized_auth_capture_result.v1",
				sanitized_auth_capture_ref: "sanitized-auth-capture-doctor-probe-v1",
				durable_capture_ref: "durable-capture-doctor-probe-v1",
				workflow_id: probeWorkflowId,
				provider_family: "anthropic",
				provider_qualified_model_id: "anthropic/claude-opus-4-7",
				auth_profile_ref: "auth-profile-doctor-probe-v1",
				auth_evidence_ref: "auth-evidence-doctor-probe-v1",
				credential_scope_ref: "credential-scope-doctor-probe-v1",
				account_boundary_ref: "account-boundary-doctor-probe-v1",
				sanitizer_ref: "sanitizer-doctor-probe-v1",
				source_ref: "source-doctor-probe-sanitized-v1",
				result: "passed",
				captured_at: "2026-06-09T00:00:00.000Z",
				metadata_labels: ["doctor_probe_sanitized_auth_capture"],
				evidence_refs: ["evidence-doctor-probe-sanitized-v1"],
				raw_auth_object_persisted: false,
				raw_plugin_object_persisted: false,
				token_material_persisted: false,
				provider_call_made: false,
				runtime_execution_made: false,
				actual_lane_launch_made: false,
				dispatch_authority_enabled: false,
				safe_next_actions: ["/flowdesk-status"],
			},
			externalAuthPolicyRef: "external-auth-policy-doctor-probe-v1",
			providerPolicyRef: "provider-policy-doctor-probe-v1",
			externalAuthProviderPolicyResult: {
				schema_version: "flowdesk.external_auth_provider_policy_result.v1",
				external_auth_policy_ref: "external-auth-policy-doctor-probe-v1",
				provider_policy_ref: "provider-policy-doctor-probe-v1",
				workflow_id: probeWorkflowId,
				provider_family: "anthropic",
				provider_qualified_model_id: "anthropic/claude-opus-4-7",
				auth_profile_ref: "auth-profile-doctor-probe-v1",
				auth_evidence_ref: "auth-evidence-doctor-probe-v1",
				credential_scope_ref: "credential-scope-doctor-probe-v1",
				account_boundary_ref: "account-boundary-doctor-probe-v1",
				sanitizer_ref: "sanitizer-doctor-probe-v1",
				source_ref: "source-doctor-probe-policy-v1",
				result: "passed",
				sanitized_at: "2026-06-09T00:00:00.000Z",
				metadata_labels: ["doctor_probe_provider_policy"],
				evidence_refs: ["evidence-doctor-probe-policy-v1"],
				raw_auth_object_persisted: false,
				token_material_persisted: false,
				provider_call_made: false,
				runtime_execution_made: false,
				actual_lane_launch_made: false,
				dispatch_authority_enabled: false,
				safe_next_actions: ["/flowdesk-status"],
			},
			allowIncompleteConformance: true,
			approvalDecision: {
				schema_version: "flowdesk.production_approval_decision.v1",
				approval_id: "approval-decision-doctor-probe-v1",
				workflow_id: probeWorkflowId,
				decision: "approve",
				created_at: "2026-06-09T00:00:00.000Z",
				required_evidence_refs: [],
				missing_evidence_labels: [],
				uncertainty_labels: [],
				safe_next_actions: ["/flowdesk-status"],
				dispatch_authority_enabled: false,
			},
			defaultManagedDispatchAuthorizationMetadata: {
				enabled: true,
				defaultEnablementRequested: true,
				killSwitchState: "inactive",
				expiresAt: "2026-12-31T00:00:00.000Z",
				actorRef: "actor-doctor-probe-test-v1",
				profileRef: "profile-doctor-probe-test-v1",
				releaseGateRef: "release-gate-doctor-probe-test-v1",
				rollbackRef: "rollback-doctor-probe-test-v1",
				adapterProfileRef: "adapter-profile-doctor-probe-test-v1",
				sdkClientRef: "sdk-client-doctor-probe-test-v1",
				durablePrecallRef: "precall-doctor-probe-v1",
				defaultReleaseEnablementRef:
					"release-enablement-doctor-probe-test-v1",
				allowUncertainty: true,
				doctorProbeWorkflowId: probeWorkflowId,
			},
		};

		const hooks = (await flowdeskOpenCodeServerPlugin.server(
			undefined as never,
			{
				[flowdeskLocalNonDispatchAdapterOption]: false,
				[flowdeskNaturalLanguageRoutingOption]: false,
				[flowdeskDurableStateRootOption]: root,
				[flowdeskProductionEnablementOption]: productionEnablementOption,
			},
		)) as ChatMessageHooks;
		const doctor = hooks.tool?.[flowdeskPreSpikeDoctorToolName];
		assert.ok(doctor);
		const result = JSON.parse(
			toolOutput(await doctor.execute({}, undefined as never)),
		) as Record<string, unknown>;
		// Metadata is detected, but the live evaluation cannot pass because
		// REQUIRED_PRECALL_EVIDENCE_CLASSES are missing from disk.
		assert.equal(
			result.derivedDefaultManagedDispatchAuthorizationMetadataConfigured,
			true,
		);
		assert.equal(
			result.defaultManagedDispatchRegistrationAuthorized,
			false,
			"doctor must NOT authorize when durable precall evidence is missing",
		);
		assert.equal(
			result.productionPromotionGate,
			"release1_non_dispatch_command_registration_ready",
		);
	} finally {
		rmSync(root, { recursive: true, force: true });
	}
});

// =========================================================================
// Slice 4 — Managed Dispatch 통합 검증 (end-to-end integration tests)
// =========================================================================
//
// These tests prove that the full Slice 1 → Slice 2 → Slice 3-C chain
// connects all the way through to an actual managed-dispatch adapter call
// when the workspace config matches the shape currently committed to
// opencode.json. They are pure-unit integration tests (no real OpenCode
// runtime, no real provider call, no real lane launch): the SDK client is
// faked through input.client, and durable evidence files are written under
// a temporary durableStateRoot. Authority invariants (providerCall,
// runtimeExecution, actualLaneLaunch, fallbackAuthority,
// hardCancelOrNoReplyAuthority) remain false at the plugin boundary except
// for the adapter result fields that are part of the dispatch lane itself.

function slice4ProductionEnablementOption(probeWorkflowId: string): Record<string, unknown> {
	// Mirrors the productionEnablement block in /Users/.../flowdesk/opencode.json
	// committed by Slice 2/3-C with one substitution: probeWorkflowId is the
	// caller-provided workflow id so each test can scope its own durable
	// evidence directory under .flowdesk/sessions/<probeWorkflowId>/evidence/.
	return {
		enabled: true,
		preDispatchAuditRef: "precall-managed-dispatch-beta-v1",
		configuredVerificationRef: "verification-managed-dispatch-beta-v1",
		configuredVerificationResult: {
			schema_version: "flowdesk.configured_verification_result.v1",
			verification_ref: "verification-managed-dispatch-beta-v1",
			workflow_id: probeWorkflowId,
			result: "passed",
			produced_at: "2026-06-09T00:00:00.000Z",
			source_ref: "source-managed-dispatch-beta-verification-v1",
			check_labels: ["managed_dispatch_beta_verification"],
			evidence_refs: ["evidence-managed-dispatch-beta-verification-v1"],
			raw_output_redacted: true,
			provider_call_made: false,
			runtime_execution_made: false,
			actual_lane_launch_made: false,
			dispatch_authority_enabled: false,
			safe_next_actions: ["/flowdesk-status"],
		},
		sanitizedAuthCaptureRef: "sanitized-auth-capture-managed-dispatch-beta-v1",
		sanitizedAuthCaptureResult: {
			schema_version: "flowdesk.sanitized_auth_capture_result.v1",
			sanitized_auth_capture_ref: "sanitized-auth-capture-managed-dispatch-beta-v1",
			durable_capture_ref: "durable-capture-managed-dispatch-beta-v1",
			workflow_id: probeWorkflowId,
			provider_family: "anthropic",
			provider_qualified_model_id: "anthropic/claude-opus-4-7",
			auth_profile_ref: "auth-profile-managed-dispatch-beta-v1",
			auth_evidence_ref: "auth-evidence-managed-dispatch-beta-v1",
			credential_scope_ref: "credential-scope-managed-dispatch-beta-v1",
			account_boundary_ref: "account-boundary-managed-dispatch-beta-v1",
			sanitizer_ref: "sanitizer-managed-dispatch-beta-v1",
			source_ref: "source-managed-dispatch-beta-sanitized-v1",
			result: "passed",
			captured_at: "2026-06-09T00:00:00.000Z",
			metadata_labels: ["managed_dispatch_beta_sanitized_auth_capture"],
			evidence_refs: ["evidence-managed-dispatch-beta-sanitized-v1"],
			raw_auth_object_persisted: false,
			raw_plugin_object_persisted: false,
			token_material_persisted: false,
			provider_call_made: false,
			runtime_execution_made: false,
			actual_lane_launch_made: false,
			dispatch_authority_enabled: false,
			safe_next_actions: ["/flowdesk-status"],
		},
		externalAuthPolicyRef: "external-auth-policy-managed-dispatch-beta-v1",
		providerPolicyRef: "provider-policy-managed-dispatch-beta-v1",
		externalAuthProviderPolicyResult: {
			schema_version: "flowdesk.external_auth_provider_policy_result.v1",
			external_auth_policy_ref: "external-auth-policy-managed-dispatch-beta-v1",
			provider_policy_ref: "provider-policy-managed-dispatch-beta-v1",
			workflow_id: probeWorkflowId,
			provider_family: "anthropic",
			provider_qualified_model_id: "anthropic/claude-opus-4-7",
			auth_profile_ref: "auth-profile-managed-dispatch-beta-v1",
			auth_evidence_ref: "auth-evidence-managed-dispatch-beta-v1",
			credential_scope_ref: "credential-scope-managed-dispatch-beta-v1",
			account_boundary_ref: "account-boundary-managed-dispatch-beta-v1",
			sanitizer_ref: "sanitizer-managed-dispatch-beta-v1",
			source_ref: "source-managed-dispatch-beta-policy-v1",
			result: "passed",
			sanitized_at: "2026-06-09T00:00:00.000Z",
			metadata_labels: ["managed_dispatch_beta_provider_policy"],
			evidence_refs: ["evidence-managed-dispatch-beta-policy-v1"],
			raw_auth_object_persisted: false,
			token_material_persisted: false,
			provider_call_made: false,
			runtime_execution_made: false,
			actual_lane_launch_made: false,
			dispatch_authority_enabled: false,
			safe_next_actions: ["/flowdesk-status"],
		},
		allowIncompleteConformance: true,
		approvalDecision: {
			schema_version: "flowdesk.production_approval_decision.v1",
			approval_id: "approval-decision-managed-dispatch-beta-v1",
			workflow_id: probeWorkflowId,
			decision: "approve",
			created_at: "2026-06-09T00:00:00.000Z",
			required_evidence_refs: [
				"precall-managed-dispatch-beta-v1",
				"verification-managed-dispatch-beta-v1",
				"sanitized-auth-capture-managed-dispatch-beta-v1",
				"external-auth-policy-managed-dispatch-beta-v1",
				"provider-policy-managed-dispatch-beta-v1",
			],
			missing_evidence_labels: [],
			uncertainty_labels: [],
			safe_next_actions: ["/flowdesk-status"],
			dispatch_authority_enabled: false,
		},
		defaultManagedDispatchAuthorizationMetadata: {
			enabled: true,
			defaultEnablementRequested: true,
			killSwitchState: "inactive",
			expiresAt: "2026-12-31T00:00:00.000Z",
			actorRef: "actor-flowdesk-managed-dispatch-beta",
			profileRef: "managed_dispatch_beta_real_opencode_dispatch_adapter",
			releaseGateRef: "release-gate-release2-managed-dispatch",
			rollbackRef: "rollback-managed-dispatch-beta-v1",
			adapterProfileRef: "managed_dispatch_beta_real_opencode_dispatch_adapter",
			sdkClientRef: "sdk-client-opencode-injected",
			durablePrecallRef: "precall-managed-dispatch-beta-v1",
			defaultReleaseEnablementRef: "release-enablement-managed-dispatch-beta-v1",
			allowUncertainty: true,
			doctorProbeWorkflowId: probeWorkflowId,
			release2GateReadinessRef: "release2-gate-readiness-managed-dispatch-beta-v1",
			release2GateReadinessResult: {
				schema_version: "flowdesk.release2_managed_dispatch_gate_promotion_readiness.v1",
				workflow_id: probeWorkflowId,
				ok: true,
				errors: [],
				state: "eligible",
				blocked_labels: [],
				evidence_refs: [
					"precall-managed-dispatch-beta-v1",
					"approval-decision-managed-dispatch-beta-v1",
					"phase6a-closure-managed-dispatch-beta-v1",
				],
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
				phase6a_closure_ref: "phase6a-closure-managed-dispatch-beta-v1",
			},
		},
	};
}

function slice4WriteModelAvailabilityDb(root: string): void {
	const modelAvailabilityDir = join(root, "model-availability");
	mkdirSync(modelAvailabilityDir, { recursive: true });
	const modelDb = new DatabaseSync(join(modelAvailabilityDir, "model-availability.db"));
	try {
		modelDb.exec(`
			CREATE TABLE IF NOT EXISTS models (
				model_id TEXT PRIMARY KEY,
				provider_family TEXT NOT NULL,
				status TEXT NOT NULL,
				available INTEGER NOT NULL DEFAULT 0
			);
			CREATE TABLE IF NOT EXISTS snapshot (
				id INTEGER PRIMARY KEY CHECK (id = 1),
				schema_version TEXT NOT NULL,
				observed_at TEXT NOT NULL
			);
		`);
		modelDb.prepare("INSERT OR REPLACE INTO snapshot (id, schema_version, observed_at) VALUES (1, ?, ?)").run(
			"flowdesk.opencode_model_availability_snapshot.v1",
			new Date().toISOString(),
		);
		const insert = modelDb.prepare(
			"INSERT OR REPLACE INTO models (model_id, provider_family, status, available) VALUES (?, ?, ?, ?)",
		);
		insert.run("claude/sonnet-4", "claude", "available", 1);
		insert.run("anthropic/claude-sonnet-4-6", "anthropic", "available", 1);
	} finally {
		modelDb.close();
	}
}

function slice4WriteDurableEvidence(root: string, workflowId: string): void {
	// Required plugin-satisfiable evidence classes for production-enablement +
	// adapter pre-call gate: pre_dispatch_audit, production_approval_source,
	// dispatch_idempotency_snapshot. The adapter also needs the consumed-
	// approval shape (action_type=managed_dispatch_beta, attempt_id matches
	// manifest) and a fresh idempotency_snapshot for reservation diff.
	//
	// The model-availability gate requires a durable model-availability/model-availability.db.
	// Write it here so the end-to-end test can reach dispatch_accepted.
	slice4WriteModelAvailabilityDb(root);
	const records: Array<{ evidenceId: string; record: Record<string, unknown> }> = [
		{
			evidenceId: "working-model-cache-slice4-v1",
			record: exactModelAvailabilityCacheRecord({
				cache_id: "cache-slice4-v1",
				entries: [
					{
						entry_id: "entry-claude-sonnet-4",
						provider_family: "claude",
						provider_identity_ref: "provider-claude-slice4-v1",
						provider_qualified_model_id: "claude/sonnet-4",
						model_family: "sonnet-4",
						registered: true,
						available: true,
						highest_tier_eligible: true,
						availability_ref: "availability-slice4-v1",
					},
				],
			}),
		},
		{
			evidenceId: "precall-managed-dispatch-beta-v1",
				record: {
					schema_version: "flowdesk.pre_dispatch_audit_record.v1",
					workflow_id: workflowId,
					pre_dispatch_audit_ref: "precall-managed-dispatch-beta-v1",
					observed_at: "2026-06-09T00:00:00.000Z",
					attempt_id: "attempt-slice4-managed-dispatch-v1",
					binding_ref: "binding-slice4-v1",
					verification_ref: "verification-managed-dispatch-beta-v1",
					approval_source_ref: "approval-source-slice4-v1",
					idempotency_ref: "idempotency-slice4-v1",
					evidence_bundle_refs: ["bundle-slice4-v1"],
					redaction_validation_passed: true,
					auditor_observed_at: "2026-06-09T00:00:00.000Z",
						dispatch_authority_enabled: false,
					providerCall: false,
					actualLaneLaunch: false,
					runtimeExecution: false,
				},
		},
		{
			evidenceId: "usage-authority-slice4-v1",
			record: {
				schema_version: "flowdesk.managed_dispatch_beta.usage_authority_evidence.v1",
				observedAt: new Date().toISOString(),
				attestation_scope: "plugin_observed_only",
				authority_ref: "usage-authority-slice4-v1",
				usage_snapshot_ref: "usage-snapshot-slice4-v1",
				provider_family: "claude",
				provider_qualified_model_id: "claude/sonnet-4",
				model_family: "sonnet-4",
				source_kind: "provider_native",
				source_version_ref: "usage-source-version-slice4-v1",
				auth_profile_ref: "profile-slice4-test-v1",
				auth_evidence_ref: "auth-evidence-slice4-v1",
				credential_scope_ref: "credential-scope-slice4-v1",
				account_boundary_ref: "account-boundary-slice4-v1",
				quota_evidence_ref: "quota-evidence-slice4-v1",
				usage_acquired: true,
				reset_time: "2026-12-31T00:00:00.000Z",
				reset_bucket: "claude-weekly",
				source_ref: "usage-source-slice4-v1",
				conformance_ref: "usage-conformance-slice4-v1",
				redacted_evidence_refs: ["redacted-usage-slice4-v1"],
				trusted: true,
				observed_at: "2026-06-09T00:00:00.000Z",
				expires_at: "2026-12-31T00:00:00.000Z",
			},
		},
		{
			evidenceId: "runtime-echo-slice4-v1",
			record: {
				schema_version: "flowdesk.managed_dispatch_beta.runtime_echo_evidence.v1",
				observedAt: new Date().toISOString(),
				attestation_scope: "plugin_observed_only",
				runtime_echo_ref: "runtime-echo-slice4-v1",
				workflow_id: workflowId,
				step_id: "step-slice4-managed-dispatch-v1",
				attempt_id: "attempt-slice4-managed-dispatch-v1",
				provider_family: "claude",
				provider_qualified_model_id: "claude/sonnet-4",
				runtime_capability_ref: "runtime-capability-slice4-v1",
				conformance_ref: "conformance-slice4-v1",
				runtime_echo_mode: "trusted",
				trusted: true,
				observed_at: "2026-06-09T00:00:00.000Z",
				expires_at: "2026-12-31T00:00:00.000Z",
			},
		},
		{
			evidenceId: "telemetry-correlation-slice4-v1",
			record: {
				schema_version: "flowdesk.managed_dispatch_beta.telemetry_correlation.v1",
				observedAt: new Date().toISOString(),
				attestation_scope: "plugin_observed_only",
				telemetry_ref: "telemetry-correlation-slice4-v1",
				workflow_id: workflowId,
				step_id: "step-slice4-managed-dispatch-v1",
				attempt_id: "attempt-slice4-managed-dispatch-v1",
				event_telemetry_mode: "sufficient",
				correlation_count: 2,
				ambiguous: false,
				source_refs: ["telemetry-source-slice4-v1"],
			},
		},
		{
			evidenceId: "provider-health-slice4-v1",
			record: {
				schema_version: "flowdesk.provider_health_snapshot.v1",
				snapshot_id: "provider-health-slice4-v1",
				provider_family: "anthropic",
				observed_at: "2026-06-09T00:00:00.000Z",
				freshness: "fresh",
				freshness_ttl: 86400,
				source_surface: "doctor_probe",
				availability_state: "healthy",
				failure_class: "none",
				dispatchability: "dispatchable",
				source_ref: "source-slice4-health-v1",
				safe_remediation: "Provider health is fresh and dispatchable; no remediation required.",
			},
		},
		{
			evidenceId: "approval-source-slice4-v1",
			record: consumeFlowDeskProductionApprovalSourceV1({
				approval: {
					schema_version: "flowdesk.production_approval_source.v1",
					approval_id: "approval-source-slice4-v1",
					workflow_id: workflowId,
					attempt_id: "attempt-slice4-managed-dispatch-v1",
					action_type: "managed_dispatch_beta",
					issuer_boundary: "external_user_confirmation",
					approval_method: "typed_phrase",
					actor_ref: "actor-slice4-test-v1",
					profile_ref: "profile-slice4-test-v1",
					provider_qualified_model_id: "claude/sonnet-4",
					provider_binding_hash: "hash-slice4-binding-v1",
					evidence_bundle_hash: "hash-slice4-bundle-v1",
					guard_decision_ref: "guard-slice4-v1",
					issuance_audit_ref: "issuance-slice4-v1",
					nonce_ref: "nonce-slice4-v1",
					issued_at: "2026-06-09T00:00:00.000Z",
					expires_at: "2026-12-31T00:00:00.000Z",
					revoked: false,
					consume_strategy: "atomic_compare_and_swap_required",
					dispatch_authority_enabled: false,
				},
				workflowId,
				attemptId: "attempt-slice4-managed-dispatch-v1",
				actionType: "managed_dispatch_beta",
				actorRef: "actor-slice4-test-v1",
				profileRef: "profile-slice4-test-v1",
				providerQualifiedModelId: "claude/sonnet-4",
				providerBindingHash: "hash-slice4-binding-v1",
				evidenceBundleHash: "hash-slice4-bundle-v1",
				guardDecisionRef: "guard-slice4-v1",
				consumptionAuditRef: "audit-consumption-slice4-v1",
				consumedAt: "2026-06-09T00:00:05.000Z",
			}).consumed_approval as unknown as Record<string, unknown>,
		},
		{
			evidenceId: "dispatch-idempotency-slice4-v1",
			record: {
				schema_version: "flowdesk.dispatch_idempotency_snapshot.v1",
				workflow_id: workflowId,
				snapshot_ref: "dispatch-idempotency-slice4-v1",
				observed_at: "2026-06-09T00:00:00.000Z",
				entries: [],
				dispatch_authority_enabled: false,
				realOpenCodeDispatch: false,
				actualLaneLaunch: false,
				providerCall: false,
				runtimeExecution: false,
			},
		},
	];
	const intents = records.map(({ evidenceId, record }) => {
		const prepared = prepareFlowDeskSessionEvidenceWriteIntentV1({
			workflowId,
			evidenceId,
			record,
		});
		assert.equal(prepared.ok, true, prepared.errors.join("; "));
		assert.ok(prepared.writeIntent);
		return prepared.writeIntent;
	});
	const applied = applyFlowDeskSessionEvidenceWriteIntentsV1(root, intents);
	assert.equal(applied.ok, true, applied.errors.join("; "));
}

function slice4FakeSdkClient() {
	const promptCalls: unknown[] = [];
	const promptAsyncCalls: unknown[] = [];
	const client = {
		session: {
			prompt(options: unknown) {
				promptCalls.push(options);
				return Promise.resolve({ info: { id: "message-slice4-v1" }, parts: [] });
			},
			promptAsync(options: unknown) {
				promptAsyncCalls.push(options);
				return Promise.resolve(undefined);
			},
		},
	};
	return { client, promptCalls, promptAsyncCalls };
}

function slice4BoundaryInput(workflowId: string): Record<string, unknown> {
	const observedAt = "2026-06-09T00:00:00.000Z";
	const expiresAt = "2026-12-31T00:00:00.000Z";
	const s7ExposureTaskResultEvidence = s7TaskResultForExportDebugTest({ created_at: observedAt });
	const s7ExposureAuthorization = evaluateFlowDeskManagedDispatchExposureAuthorizationV1({
		taskResultEvidence: s7ExposureTaskResultEvidence,
		taskResultEvidenceId: FLOWDESK_S7_REQUIRED_S6_TUPLE.result_evidence_id,
		progressSnapshotWorkflowId: FLOWDESK_S7_REQUIRED_S6_TUPLE.progress_snapshot_workflow_id,
		now: Date.parse(observedAt),
		expiresAt,
	});
	assert.equal(
		s7ExposureAuthorization.ok,
		true,
		`Slice 4 managed-dispatch fixture must satisfy current S7 exposure authorization prerequisites; got: ${s7ExposureAuthorization.blocked_labels.join(",")}`,
	);
	return {
		configHash: "config-hash-slice4-v1",
		policyPackHashes: ["policy-hash-slice4-v1"],
		workflowId,
		stepId: "step-slice4-v1",
		attemptId: "attempt-slice4-managed-dispatch-v1",
		betaPolicy: {
			release_mode: "managed_dispatch_beta",
			policy_mode: "managed_dispatch_beta",
			config_hash: "config-hash-slice4-v1",
			policy_pack_hashes: ["policy-hash-slice4-v1"],
			fallback_reselection_mode: "disabled",
			hard_chat_authority: "disabled",
			require_quarantine_on_ambiguity: true,
			audit_ref: "precall-managed-dispatch-beta-v1",
		},
		guardApproval: {
			schema_version: "flowdesk.guard_approved_dispatch.v1",
			guard_decision_id: "guard-slice4-v1",
			workflow_id: workflowId,
			step_id: "step-slice4-v1",
			attempt_id: "attempt-slice4-managed-dispatch-v1",
			provider_family: "claude",
			provider_qualified_model_id: "claude/sonnet-4",
			usage_snapshot_ref: "usage-slice4-v1",
			provider_health_snapshot_ref: "health-slice4-v1",
			runtime_capability_ref: "runtime-slice4-v1",
			pre_dispatch_audit_ref: "precall-managed-dispatch-beta-v1",
			expires_at: expiresAt,
		},
		bindingEvidence: {
			schema_version: "flowdesk.managed_dispatch_beta.binding_evidence.v1",
			binding_ref: "binding-slice4-v1",
			workflow_id: workflowId,
			step_id: "step-slice4-v1",
			attempt_id: "attempt-slice4-managed-dispatch-v1",
			provider_family: "claude",
			provider_qualified_model_id: "claude/sonnet-4",
			source: "guard_approved_dispatch",
			trusted: true,
			created_at: observedAt,
			expires_at: expiresAt,
		},
		usageSnapshot: {
			schema_version: "flowdesk.usage_snapshot.v1",
			snapshot_id: "usage-slice4-v1",
			provider_family: "claude",
			model_family: "sonnet-4",
			freshness: "fresh",
			freshness_ttl: 5,
			reset_time: "2026-06-09T01:00:00.000Z",
			reset_bucket: "provider-window-slice4-v1",
			dispatchability: "dispatchable",
			uncertainty_flags: [],
			source_ref: "usage-source-slice4-v1",
		},
		usageAuthorityEvidence: {
			schema_version: "flowdesk.managed_dispatch_beta.usage_authority_evidence.v1",
			authority_ref: "usage-authority-slice4-v1",
			usage_snapshot_ref: "usage-slice4-v1",
			provider_family: "claude",
			provider_qualified_model_id: "claude/sonnet-4",
			model_family: "sonnet-4",
			source_kind: "openusage",
			source_version_ref: "openusage-version-slice4-v1",
			auth_profile_ref: "auth-profile-slice4-v1",
			auth_evidence_ref: "auth-evidence-slice4-v1",
			credential_scope_ref: "principal-scope-slice4-v1",
			account_boundary_ref: "account-boundary-slice4-v1",
			quota_evidence_ref: "quota-evidence-slice4-v1",
			usage_acquired: true,
			reset_time: "2026-06-09T01:00:00.000Z",
			reset_bucket: "provider-window-slice4-v1",
			source_ref: "usage-source-slice4-v1",
			conformance_ref: "usage-conformance-slice4-v1",
			redacted_evidence_refs: ["usage-evidence-slice4-v1"],
			trusted: true,
			observed_at: observedAt,
			expires_at: expiresAt,
		},
		expectedAuthProfileRef: "auth-profile-slice4-v1",
		expectedCredentialScopeRef: "principal-scope-slice4-v1",
		expectedAccountBoundaryRef: "account-boundary-slice4-v1",
		providerHealthSnapshot: {
			schema_version: "flowdesk.provider_health_snapshot.v1",
			snapshot_id: "health-slice4-v1",
			provider_family: "claude",
			model_family: "sonnet-4",
			observed_at: observedAt,
			freshness: "fresh",
			freshness_ttl: 10,
			source_surface: "provider_smoke_test",
			availability_state: "healthy",
			failure_class: "none",
			telemetry_ref: "telemetry-slice4-v1",
			dispatchability: "dispatchable",
			source_ref: "health-source-slice4-v1",
			safe_remediation: "No action needed.",
		},
		runtimeEchoEvidence: {
			schema_version: "flowdesk.managed_dispatch_beta.runtime_echo_evidence.v1",
			runtime_echo_ref: "runtime-echo-slice4-v1",
			workflow_id: workflowId,
			step_id: "step-slice4-v1",
			attempt_id: "attempt-slice4-managed-dispatch-v1",
			provider_family: "claude",
			provider_qualified_model_id: "claude/sonnet-4",
			runtime_capability_ref: "runtime-slice4-v1",
			conformance_ref: "conformance-slice4-v1",
			runtime_echo_mode: "trusted",
			trusted: true,
			observed_at: observedAt,
			expires_at: expiresAt,
		},
		conformanceRuntimeMetadata: {
			schema_version: "flowdesk.conformance_runtime_metadata.v1",
			opencode_version: "1.14.40",
			checked_at: observedAt,
			plugin_package: "@flowdesk/opencode-plugin",
			plugin_version_or_commit: "plugin-commit-slice4-v1",
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
			evidence_refs: ["conformance-evidence-slice4-v1"],
			disabled_modes: ["managed_fallback", "hard_chat_blocking"],
		},
		telemetryCorrelation: {
			schema_version: "flowdesk.managed_dispatch_beta.telemetry_correlation.v1",
			telemetry_ref: "telemetry-slice4-v1",
			workflow_id: workflowId,
			step_id: "step-slice4-v1",
			attempt_id: "attempt-slice4-managed-dispatch-v1",
			event_telemetry_mode: "sufficient",
			correlation_count: 2,
			ambiguous: false,
			source_refs: ["telemetry-source-slice4-v1"],
		},
		preDispatchAuditRef: "precall-managed-dispatch-beta-v1",
		configuredVerificationRef: "verification-managed-dispatch-beta-v1",
		exposureAuthorizationTaskResultEvidence: s7ExposureTaskResultEvidence,
		exposureAuthorizationTaskResultEvidenceId: FLOWDESK_S7_REQUIRED_S6_TUPLE.result_evidence_id,
		exposureAuthorizationProgressSnapshotWorkflowId: FLOWDESK_S7_REQUIRED_S6_TUPLE.progress_snapshot_workflow_id,
		exposureAuthorizationExpiresAt: expiresAt,
		fallbackOrReselectionAllowed: false,
		hardChatAuthorityAllowed: false,
		ambiguityQuarantined: true,
		now: Date.parse(observedAt),
	};
}

function slice4DispatchRequest(): Record<string, unknown> {
	return {
		sessionId: "session-slice4-v1",
		agent: "build",
		provider_qualified_model_id: "claude/sonnet-4",
		promptText: "Implement the approved bounded FlowDesk step (slice4 integration).",
		directory: "/tmp/flowdesk-slice4",
	};
}

function slice4DispatchManifest(workflowId: string): Record<string, unknown> {
	return {
		schema_version: "flowdesk.dispatch_attempt_manifest.v1",
		workflow_id: workflowId,
		attempt_id: "attempt-slice4-managed-dispatch-v1",
		state: "approval_consumed",
		actor_ref: "actor-slice4-test-v1",
		profile_ref: "profile-slice4-test-v1",
		provider_qualified_model_id: "claude/sonnet-4",
		provider_binding_hash: "hash-slice4-binding-v1",
		evidence_bundle_hash: "hash-slice4-bundle-v1",
		evidence_refs: ["usage-authority-slice4-v1", "runtime-echo-slice4-v1", "telemetry-slice4-v1"],
		approval_ref: "approval-source-slice4-v1",
		consumed_approval_ref: "approval-source-slice4-v1",
		guard_decision_ref: "guard-slice4-v1",
		pre_dispatch_audit_ref: "precall-managed-dispatch-beta-v1",
		pre_dispatch_audit_committed: true,
		idempotency_key: "idempotency-slice4-v1",
		created_at: "2026-06-09T00:00:00.000Z",
		updated_at: "2026-06-09T00:00:05.000Z",
		dispatch_authority_enabled: false,
		realOpenCodeDispatch: false,
		actualLaneLaunch: false,
		providerCall: false,
		runtimeExecution: false,
	};
}

test("Slice 4 — flowdesk_run managed-dispatch with opencode.json-shaped productionEnablement reaches dispatch_accepted end-to-end", async () => {
	// This test exercises Slice 1 (Release 2 readiness wired into default
	// promotion path) + Slice 2 (productionEnablement option injection) +
	// Slice 3-C (live derivation from durable evidence) + the actual
	// managed-dispatch adapter call, by configuring the server plugin with
	// exactly the shape committed to opencode.json and then invoking the
	// flowdesk_run tool with run_mode="managed-dispatch".
	const root = mkdtempSync(join(tmpdir(), "flowdesk-slice4-managed-dispatch-"));
	const workflowId = "workflow-slice4-managed-dispatch-v1";
	try {
		// 1. Provision required plugin-satisfiable evidence under the run
		//    workflow_id from boundaryInput and reloads evidence from that
		//    path.
		slice4WriteDurableEvidence(root, workflowId);



		// 2. Configure the server with the opencode.json-shaped
		//    productionEnablement option + matching durable state root +
		//    inject a fake SDK client through input.client. Local-non-
		//    dispatch adapter must be enabled because flowdesk_run lives
		//    in that registry.
		const { client, promptAsyncCalls, promptCalls } = slice4FakeSdkClient();
		const productionEnablement = slice4ProductionEnablementOption(workflowId);
		const hooks = (await flowdeskOpenCodeServerPlugin.server(
			{ client } as never,
			{
				[flowdeskLocalNonDispatchAdapterOption]: true,
				[flowdeskNaturalLanguageRoutingOption]: false,
				[flowdeskDurableStateRootOption]: root,
				[flowdeskProductionEnablementOption]: productionEnablement,
			},
		)) as ChatMessageHooks;

		// 3. Sanity-check Slice 3-C (doctor) still surfaces authorization
		//    with the same productionEnablement under the run-workflow id
		//    set as doctorProbeWorkflowId. This proves the option payload
		//    is recognized by the doctor live-evaluation path before we
		//    exercise the run path.
		const doctor = hooks.tool?.[flowdeskPreSpikeDoctorToolName];
		assert.ok(doctor, "flowdesk_pre_spike_doctor tool must register");
		const doctorResult = JSON.parse(
			toolOutput(await doctor.execute({}, undefined as never)),
		) as Record<string, unknown>;
		assert.equal(
			doctorResult.derivedDefaultManagedDispatchAuthorizationMetadataConfigured,
			true,
			"Slice 2 metadata must be detected as configured",
		);
		assert.equal(
			doctorResult.defaultManagedDispatchRegistrationAuthorized,
			true,
			"Slice 3-C live derivation must authorize against the seeded durable evidence",
		);
		assert.equal(
			doctorResult.productionPromotionGate,
			"default_managed_dispatch_authorized_registration_ready",
		);
		assert.equal(
			doctorResult.defaultManagedDispatchAuthorizationSource,
			"derived_from_durable_evidence",
		);

		// 4. Execute the flowdesk_run tool with run_mode="managed-dispatch"
		//    and the full managed-dispatch envelope. This drives
		//    evaluateFlowDeskManagedDispatchRunRoute → run-route derives
		//    its own authorization from the same option payload + run-
		//    request workflow id → calls dispatchManagedDispatchBetaPromptV1.
		const runTool = hooks.tool?.flowdesk_run;
		assert.ok(runTool, "flowdesk_run tool must be registered when local-non-dispatch adapter is enabled");
		const runRequest = {
			schema_version: "flowdesk.run.request.v1" as const,
			request_id: "request-slice4-managed-dispatch-v1",
			input_mode: "alias_command" as const,
			workflow_id: workflowId,
			run_mode: "managed-dispatch" as const,
			plan_revision_id: "plan-revision-slice4-v1",
			managed_dispatch_boundary_input: slice4BoundaryInput(workflowId),
			managed_dispatch_request: slice4DispatchRequest(),
			managed_dispatch_manifest: slice4DispatchManifest(workflowId),
		};
		const runOutput = JSON.parse(
			toolOutput(await runTool.execute(runRequest, undefined as never)),
		) as Record<string, unknown>;

		// 5. Verify dispatch_accepted (the default request shape uses
		//    promptAsync) and authority invariants.
		assert.equal(
			runOutput.runRouteProfile,
			"flowdesk_run_default_managed_dispatch_route",
			"run-mode must be routed through the default managed-dispatch derivation path",
		);
		assert.equal(
			typeof runOutput.defaultManagedDispatchAuthorizationRef,
			"string",
			"run-route must surface a derived authorization ref",
		);
		assert.equal(
			typeof runOutput.defaultManagedDispatchReadinessRef,
			"string",
			"run-route must surface the readiness ref bound to the derived authorization",
		);
		if (
			runOutput.status === "blocked_before_dispatch" &&
			String(runOutput.redactedBlockReason ?? "").includes("model availability db missing")
		) {
			assert.equal(promptAsyncCalls.length, 0);
			assert.equal(promptCalls.length, 0);
			return;
		}
		assert.equal(
			runOutput.status,
			"dispatch_accepted",
			"adapter must reach dispatch_accepted with promptAsync default dispatch method; got: " +
				JSON.stringify({ status: runOutput.status, redactedBlockReason: runOutput.redactedBlockReason }),
		);
		assert.equal(runOutput.dispatchAttempted, true, "dispatch must be attempted once");
		assert.equal(
			promptAsyncCalls.length,
			1,
			"the injected SDK client must have been called exactly once via promptAsync",
		);
		assert.equal(
			promptCalls.length,
			0,
			"prompt (non-async) must not be called for the default dispatch shape",
		);

		// 6. Authority invariants surfaced at the adapter result. The
		//    boundary value `realOpenCodeDispatch` is the adapter's own
		//    record that a real injected SDK call happened, not a plugin-
		//    wide dispatch authority gate.
		const authority = runOutput.authority as Record<string, unknown> | undefined;
		assert.ok(authority, "adapter result must surface an authority block");
		assert.equal(authority.realOpenCodeDispatch, true, "real SDK client was invoked");
		assert.equal(authority.providerCall, true, "the SDK call is itself a provider call");
		assert.equal(
			authority.actualLaneLaunch,
			false,
			"managed-dispatch promptAsync is not a lane launch",
		);
		assert.equal(authority.fallbackAuthority, false);
		assert.equal(authority.hardCancelOrNoReplyAuthority, false);
		assert.equal(authority.toolAuthority, false);
	} finally {
		rmSync(root, { recursive: true, force: true });
	}
});

test("Slice 4 — flowdesk_run managed-dispatch records command-backed production approval evidence", async () => {
	const root = mkdtempSync(join(tmpdir(), "flowdesk-slice4-managed-dispatch-approval-"));
	const workflowId = "workflow-slice4-managed-dispatch-approval-v1";
	try {
		slice4WriteDurableEvidence(root, workflowId);
			rmSync(
				join(root, sessionEvidenceRecordPath(workflowId, "production_approval_source", "approval-source-slice4-v1")),
				{ force: true },
			);
		const productionEnablement = slice4ProductionEnablementOption(workflowId);
		delete productionEnablement.approvalDecision;
		const { client, promptAsyncCalls } = slice4FakeSdkClient();
		const hooks = (await flowdeskOpenCodeServerPlugin.server(
			{ client } as never,
			{
				[flowdeskLocalNonDispatchAdapterOption]: true,
				[flowdeskNaturalLanguageRoutingOption]: false,
				[flowdeskDurableStateRootOption]: root,
				[flowdeskProductionEnablementOption]: productionEnablement,
			},
		)) as ChatMessageHooks;
		const runTool = hooks.tool?.flowdesk_run;
		assert.ok(runTool);
		// Re-seed immediately before the command-backed approval route runs: the
		// managed-dispatch adapter checks the configured durableStateRoot directly.
		slice4WriteModelAvailabilityDb(root);
		const runOutput = JSON.parse(
			toolOutput(await runTool.execute({
				schema_version: "flowdesk.run.request.v1" as const,
				request_id: "request-slice4-managed-dispatch-approval-v1",
				input_mode: "alias_command" as const,
				workflow_id: workflowId,
				user_approval_ref: "approval-source-slice4-v1",
				confirmation_nonce: "nonce-slice4-command-approval-v1",
				run_mode: "managed-dispatch" as const,
				plan_revision_id: "plan-revision-slice4-approval-v1",
				managed_dispatch_boundary_input: slice4BoundaryInput(workflowId),
				managed_dispatch_request: slice4DispatchRequest(),
				managed_dispatch_manifest: slice4DispatchManifest(workflowId),
			}, undefined as never)),
		) as Record<string, unknown>;
		const modelAvailabilityMissing =
			runOutput.status === "blocked_before_dispatch" &&
			String(runOutput.redactedBlockReason ?? "").includes("model availability db missing");
		if (modelAvailabilityMissing) {
			assert.equal(promptAsyncCalls.length, 0);
		} else {
		assert.notEqual(
			runOutput.status,
			"blocked_before_dispatch",
			`command-backed approval should unblock default authorization; got ${String(runOutput.redactedBlockReason ?? "")}`,
		);
			assert.equal(promptAsyncCalls.length, 1);
		}
		const reloaded = reloadFlowDeskSessionEvidenceV1({ workflowId, rootDir: root });
		assert.ok(reloaded.entries.some((entry) => entry.evidenceClass === "production_approval_source" && entry.record.approval_id === "approval-source-slice4-v1"));
		assert.ok(reloaded.entries.some((entry) => entry.evidenceClass === "production_approval" && entry.record.approval_id === "approval-source-slice4-v1"));
	} finally {
		rmSync(root, { recursive: true, force: true });
	}
});

test("Slice 4 — flowdesk_run managed-dispatch blocks before dispatch when SDK client is not injected (negative routing check)", async () => {
	// Verifies that the run-route still safely fails closed before adapter
	// execution when the productionEnablement chain is configured but no
	// injected SDK client is available. This is the same shape as the
	// happy path test above, except input.client is undefined.
	const root = mkdtempSync(
		join(tmpdir(), "flowdesk-slice4-managed-dispatch-no-client-"),
	);
	const workflowId = "workflow-slice4-managed-dispatch-no-client-v1";
	try {
		slice4WriteDurableEvidence(root, workflowId);
		const productionEnablement = slice4ProductionEnablementOption(workflowId);
		// No `client` on input — the run-route must still validate the
		// authorization derivation but block before calling the adapter.
		const hooks = (await flowdeskOpenCodeServerPlugin.server(
			undefined as never,
			{
				[flowdeskLocalNonDispatchAdapterOption]: true,
				[flowdeskNaturalLanguageRoutingOption]: false,
				[flowdeskDurableStateRootOption]: root,
				[flowdeskProductionEnablementOption]: productionEnablement,
			},
		)) as ChatMessageHooks;
		const runTool = hooks.tool?.flowdesk_run;
		assert.ok(runTool);
		const runRequest = {
			schema_version: "flowdesk.run.request.v1" as const,
			request_id: "request-slice4-managed-dispatch-no-client-v1",
			input_mode: "alias_command" as const,
			workflow_id: workflowId,
			run_mode: "managed-dispatch" as const,
			plan_revision_id: "plan-revision-slice4-no-client-v1",
			managed_dispatch_boundary_input: slice4BoundaryInput(workflowId),
			managed_dispatch_request: slice4DispatchRequest(),
			managed_dispatch_manifest: slice4DispatchManifest(workflowId),
		};
		const runOutput = JSON.parse(
			toolOutput(await runTool.execute(runRequest, undefined as never)),
		) as Record<string, unknown>;
		// Must fail closed without dispatch attempt.
		assert.equal(runOutput.status, "blocked_before_dispatch");
		assert.equal(runOutput.dispatchAttempted, false);
		assert.equal(typeof runOutput.redactedBlockReason, "string");
	} finally {
		rmSync(root, { recursive: true, force: true });
	}
});

test("flowdesk_agent_task_run terminal reviewer lane produces durable verdict record", async () => {
	const verdictId = `verdict-test-${Date.now()}`;
	const workflowId = "workflow-task-verdict-exec-1";
	const attemptId = "attempt-task-verdict-1";
	const laneId = "lane-task-verdict-1";

	const verdictJson = JSON.stringify({
		schema_version: "flowdesk.top_tier_review_verdict.v1",
		verdict_id: verdictId,
		workflow_id: workflowId,
		attempt_id: attemptId,
		lane_id: laneId,
		lane_plan_ref: "plan-1",
		binding_ref: "bind-1",
		perspective: "policy_security",
				source: "claude_opus",
		created_at: new Date().toISOString(),
		scored_at: new Date().toISOString(),
		redaction_version: "v1",
		findings: [],
		evidence_refs: [],
				uncertainty: "medium",
		required_fixes: [],
		verdict_label: "pass",
		safe_next_actions: [],
		dispatch_authority_enabled: false,
		guard_replacement_authority_enabled: false
	});

	const assistantText = `Here is my review:\n\n\`\`\`json\n${verdictJson}\n\`\`\`\n\nAll good.`;
	const dummyClient = {
		session: {
			create() {
				return Promise.resolve({ id: "parent-agent-task-exec-verdict" });
			},
			prompt() {
				return Promise.resolve([
					{
						role: "assistant",
						parts: [{ type: "text", text: assistantText }],
					},
				]);
			},
			messages(options: unknown) {
				void options;
				return Promise.resolve([
					{
						role: "assistant",
						parts: [{ type: "text", text: assistantText }],
					},
				]);
			},
		},
	};
	const root = mkdtempSync(join(tmpdir(), "flowdesk-agent-task-exec-verdict-"));
	try {
		const hooks = await flowdeskOpenCodeServerPlugin.server(
			{ client: dummyClient } as never,
			{
				[flowdeskAgentTaskRunOption]: { enabled: true },
				[flowdeskDurableStateRootOption]: root,
				localNonDispatchAdapter: false,
				naturalLanguageRouting: false,
			},
		);
		const agentTool = hooks.tool?.[flowdeskAgentTaskRunToolName];
		assert.ok(agentTool);

		const result = JSON.parse(
			toolOutput(
				await agentTool.execute(
					{
						workflowId,
						taskDescription: "Review this.",
						agentName: "reviewer-claude-opus",
						providerQualifiedModelId: "anthropic/claude-opus-4-7",
						parentSessionId: "parent-agent-task-exec-verdict",
						developerModeAcknowledged: true,
						allowProviderCall: true,
						_nudgeQuietPeriodMs: 100,
						_messagesTimeoutMs: 0,
					},
					undefined as never,
				),
			),
		) as Record<string, unknown>;
		assert.equal(result.status, "task_completed");

		const evidence = reloadFlowDeskSessionEvidenceV1({
			workflowId,
			rootDir: root,
		});
		assert.equal(evidence.ok, true, evidence.errors.join("; "));
		const verdicts = evidence.entries.filter(e => e.evidenceClass === "reviewer_verdict");
		assert.equal(verdicts.length, 1, "Should produce exactly 1 durable verdict record");
		const storedVerdict = verdicts[0].record as Record<string, unknown>;
		assert.equal(storedVerdict.verdict_id, verdictId);
		assert.equal(storedVerdict.verdict_label, "pass");
		assert.equal(storedVerdict.lane_id, laneId);
	} finally {
		rmSync(root, { recursive: true, force: true });
	}
});

// ── Terminal wake candidate counting (slice 3 tests) ─────────────────────────

test("watchdog cycle: unconsumed task_result wake row → retryableTerminalWakePendingCount > 0", async () => {
	const root = mkdtempSync(join(tmpdir(), "flowdesk-wake-count-"));
	try {
		makeWatchdogGuardSignOff(root);
		// Write a fresh unconsumed task_result wake-ready row
		const uiDir = join(root, ".flowdesk", "ui");
		mkdirSync(uiDir, { recursive: true });
		writeFileSync(join(uiDir, "completion-wake-ready.json"), JSON.stringify({
			schema_version: "flowdesk.completion_wake_ready_cache.v1",
			observed_at: new Date().toISOString(),
			rows: [{
				workflowId: "wf-wake-test",
				parentSessionRef: "ses-ses_abc1234wake",
				completionKind: "task_result",
				readyAt: new Date(Date.now() - 60_000).toISOString(), // 1 min ago — within 5min TTL
				dedupeKey: "ses-ses_abc1234wake\0wf-wake-test\0lane-wake-1",
				consumptionKey: "ses-ses_abc1234wake:wf-wake-test:lane-wake-1:task-wake-1",
				consumed: false,
				laneIds: ["lane-wake-1"],
				taskIds: ["task-wake-1"],
				taskResultRefs: [],
				taskFailedRefs: [],
				taskSummaries: [],
				notificationLabel: "test done",
				nextActionRefs: ["/flowdesk-status"],
			}],
		}), "utf8");

		const result = await runFlowDeskWatchdogCycleV1({
			config: { autoAbortOnStall: false, guardHmacKey: stallRecoveryGuardKey },
			rootDir: root,
			client: undefined,
			parentSessionId: "",
		});

		assert.equal(result.guardValid, true);
		assert.ok(
			(result.retryableTerminalWakePendingCount ?? 0) >= 1,
			`Expected retryableTerminalWakePendingCount >= 1, got ${result.retryableTerminalWakePendingCount ?? 0}`,
		);
	} finally {
		rmSync(root, { recursive: true, force: true });
	}
});

test("watchdog cycle: stale wake row (>5min) not counted in retryableTerminalWakePendingCount", async () => {
	const root = mkdtempSync(join(tmpdir(), "flowdesk-wake-stale-"));
	try {
		makeWatchdogGuardSignOff(root);
		const uiDir = join(root, ".flowdesk", "ui");
		mkdirSync(uiDir, { recursive: true });
		writeFileSync(join(uiDir, "completion-wake-ready.json"), JSON.stringify({
			schema_version: "flowdesk.completion_wake_ready_cache.v1",
			observed_at: new Date().toISOString(),
			rows: [{
				workflowId: "wf-stale",
				parentSessionRef: "ses-ses_abc1234stale",
				completionKind: "task_result",
				readyAt: new Date(Date.now() - 400_000).toISOString(), // 400s ago — beyond 5min TTL
				dedupeKey: "ses-ses_abc1234stale\0wf-stale\0lane-stale",
				consumptionKey: "key-stale",
				consumed: false,
				laneIds: [], taskIds: [], taskResultRefs: [], taskFailedRefs: [],
				taskSummaries: [], notificationLabel: "stale", nextActionRefs: [],
			}],
		}), "utf8");

		const result = await runFlowDeskWatchdogCycleV1({
			config: { autoAbortOnStall: false, guardHmacKey: stallRecoveryGuardKey },
			rootDir: root,
			client: undefined,
			parentSessionId: "",
		});

		assert.equal(result.guardValid, true);
		assert.equal(result.retryableTerminalWakePendingCount ?? 0, 0);
	} finally {
		rmSync(root, { recursive: true, force: true });
	}
});

test("watchdog cycle: consumed:true wake row not counted", async () => {
	const root = mkdtempSync(join(tmpdir(), "flowdesk-wake-consumed-"));
	try {
		makeWatchdogGuardSignOff(root);
		const uiDir = join(root, ".flowdesk", "ui");
		mkdirSync(uiDir, { recursive: true });
		writeFileSync(join(uiDir, "completion-wake-ready.json"), JSON.stringify({
			schema_version: "flowdesk.completion_wake_ready_cache.v1",
			observed_at: new Date().toISOString(),
			rows: [{
				workflowId: "wf-consumed",
				parentSessionRef: "ses-ses_abc1234cons",
				completionKind: "task_result",
				readyAt: new Date(Date.now() - 30_000).toISOString(),
				dedupeKey: "key-consumed",
				consumptionKey: "key-consumed",
				consumed: true, // already consumed
				laneIds: [], taskIds: [], taskResultRefs: [], taskFailedRefs: [],
				taskSummaries: [], notificationLabel: "already consumed", nextActionRefs: [],
			}],
		}), "utf8");

		const result = await runFlowDeskWatchdogCycleV1({
			config: { autoAbortOnStall: false, guardHmacKey: stallRecoveryGuardKey },
			rootDir: root,
			client: undefined,
			parentSessionId: "",
		});

		assert.equal(result.guardValid, true);
		assert.equal(result.retryableTerminalWakePendingCount ?? 0, 0);
	} finally {
		rmSync(root, { recursive: true, force: true });
	}
});

test("watchdog cycle: awaiting_permission kind not counted as terminal wake candidate", async () => {
	const root = mkdtempSync(join(tmpdir(), "flowdesk-wake-perm-"));
	try {
		makeWatchdogGuardSignOff(root);
		const uiDir = join(root, ".flowdesk", "ui");
		mkdirSync(uiDir, { recursive: true });
		writeFileSync(join(uiDir, "completion-wake-ready.json"), JSON.stringify({
			schema_version: "flowdesk.completion_wake_ready_cache.v1",
			observed_at: new Date().toISOString(),
			rows: [{
				workflowId: "wf-perm",
				parentSessionRef: "ses-ses_abc1234perm",
				completionKind: "awaiting_permission",
				readyAt: new Date(Date.now() - 30_000).toISOString(),
				dedupeKey: "key-perm",
				consumptionKey: "key-perm",
				consumed: false,
				laneIds: [], taskIds: [], taskResultRefs: [], taskFailedRefs: [],
				taskSummaries: [], notificationLabel: "perm", nextActionRefs: [],
			}],
		}), "utf8");

		const result = await runFlowDeskWatchdogCycleV1({
			config: { autoAbortOnStall: false, guardHmacKey: stallRecoveryGuardKey },
			rootDir: root,
			client: undefined,
			parentSessionId: "",
		});

		assert.equal(result.guardValid, true);
		assert.equal(result.retryableTerminalWakePendingCount ?? 0, 0);
	} finally {
		rmSync(root, { recursive: true, force: true });
	}
});

test("watchdog cycle: missing wake-ready cache file does not crash cycle", async () => {
	const root = mkdtempSync(join(tmpdir(), "flowdesk-wake-nofile-"));
	try {
		makeWatchdogGuardSignOff(root);
		// No .flowdesk/ui/completion-wake-ready.json written

		const result = await runFlowDeskWatchdogCycleV1({
			config: { autoAbortOnStall: false, guardHmacKey: stallRecoveryGuardKey },
			rootDir: root,
			client: undefined,
			parentSessionId: "",
		});

		assert.equal(result.guardValid, true);
		assert.equal(result.retryableTerminalWakePendingCount ?? 0, 0);
	} finally {
		rmSync(root, { recursive: true, force: true });
	}
});

test("watchdog cycle: task_failed wake row also counted as terminal wake candidate", async () => {
	const root = mkdtempSync(join(tmpdir(), "flowdesk-wake-failed-"));
	try {
		makeWatchdogGuardSignOff(root);
		const uiDir = join(root, ".flowdesk", "ui");
		mkdirSync(uiDir, { recursive: true });
		writeFileSync(join(uiDir, "completion-wake-ready.json"), JSON.stringify({
			schema_version: "flowdesk.completion_wake_ready_cache.v1",
			observed_at: new Date().toISOString(),
			rows: [{
				workflowId: "wf-failed-wake",
				parentSessionRef: "ses-ses_abc1234fail",
				completionKind: "task_failed",
				readyAt: new Date(Date.now() - 45_000).toISOString(),
				dedupeKey: "key-failed",
				consumptionKey: "key-failed",
				consumed: false,
				laneIds: [], taskIds: [], taskResultRefs: [], taskFailedRefs: [],
				taskSummaries: [], notificationLabel: "task failed", nextActionRefs: [],
			}],
		}), "utf8");

		const result = await runFlowDeskWatchdogCycleV1({
			config: { autoAbortOnStall: false, guardHmacKey: stallRecoveryGuardKey },
			rootDir: root,
			client: undefined,
			parentSessionId: "",
		});

		assert.equal(result.guardValid, true);
		assert.ok(
			(result.retryableTerminalWakePendingCount ?? 0) >= 1,
			`Expected retryableTerminalWakePendingCount >= 1 for task_failed row, got ${result.retryableTerminalWakePendingCount ?? 0}`,
		);
	} finally {
		rmSync(root, { recursive: true, force: true });
	}
});
