import {
	existsSync,
	lstatSync,
	mkdirSync,
	readdirSync,
	readFileSync,
	renameSync,
	writeFileSync,
} from "node:fs";
import { dirname, resolve, sep } from "node:path";
import { validateFlowDeskControlledConformanceDocWriteRecordV1 } from "./controlled-conformance-doc-write.js";
import { validateFlowDeskControlledRedactedAuditExportWriteRecordV1 } from "./controlled-redacted-audit-export-write.js";
import { validateFlowDeskControlledWorkspaceFileWriteRecordV1 } from "./controlled-workspace-file-write.js";
import { validateFlowDeskDispatchIdempotencySnapshotV1 } from "./dispatch-idempotency.js";
import { validateFlowDeskExternalAuthProviderPolicyResultV1 } from "./external-auth-policy.js";
import { validateFlowDeskFallbackRegatePlanV1 } from "./fallback-regate-plan.js";
import { validateFlowDeskLaneHeartbeatRecordV1 } from "./lane-heartbeat.js";
import { validateFlowDeskLaneLifecycleRecordV1 } from "./lane-lifecycle-record.js";
import {
	validateFlowDeskManagedDispatchBetaRuntimeEchoShapeV1,
	validateFlowDeskManagedDispatchBetaTelemetryCorrelationShapeV1,
	validateFlowDeskManagedDispatchBetaUsageAuthorityShapeV1,
} from "./managed-dispatch-evidence-shape.js";
import { validateFlowDeskPreDispatchAuditRecordV1 } from "./pre-dispatch-audit-record.js";
import {
	validateFlowDeskPendingAbortCancelV1,
	validateFlowDeskPendingAbortWarningV1,
} from "./pending-abort.js";
import {
	validateFlowDeskReviewerLaneContextV1,
	validateFlowDeskAgentTaskContextV1,
	validateFlowDeskPendingRetryPlanV1,
	validateFlowDeskRetryExecutedV1,
	validateFlowDeskRetryFailedV1,
} from "./retry-plan.js";
import {
	validateFlowDeskTaskResultV1,
	validateFlowDeskTaskFailedV1,
	validateFlowDeskAgentTaskProgressV1,
	validateFlowDeskAgentTaskInconsistencyV1,
	validateFlowDeskCoordinatorRetryDecisionV1,
} from "./task-result.js";
import { validateFlowDeskTaskAgentAssignmentV1 } from "./task-agent-assignment.js";
import { validateFlowDeskTaskGraphV1 } from "./task-graph.js";
import { validateFlowDeskTaskModelSelectionV1 } from "./task-model-selection.js";
import { validateFlowDeskWorkflowSynthesisResultV1 } from "./workflow-synthesis.js";
import { validateFlowDeskWorkflowAuthoringResultV1 } from "./workflow-authoring-result.js";
import { validateFlowDeskWorkflowDispatchPlanV1 } from "./workflow-dispatch-plan.js";
import { validateFlowDeskProductionApprovalDecisionV1 } from "./production-enablement.js";
import { validateFlowDeskConfiguredVerificationResultV1 } from "./production-verification.js";
import { validateFlowDeskSanitizedAuthCaptureResultV1 } from "./sanitized-auth-capture.js";
import {
	type FlowDeskExactModelAvailabilityCacheMaterializationContextV1,
	type FlowDeskExactModelAvailabilityCacheProviderAcquisitionResultV1,
	type FlowDeskExactModelAvailabilityCacheRefreshPlanV1,
	type FlowDeskExactModelAvailabilityCacheV1,
	type FlowDeskReviewerAssignmentRevalidationV1,
	type FlowDeskReviewerFanoutPlanV1,
	materializeFlowDeskExactModelAvailabilityCacheFromProviderAcquisitionResultV1,
	planFlowDeskExactModelAvailabilityCacheRefreshV1,
	planFlowDeskReviewerFanoutV1,
	revalidateFlowDeskReviewerAssignmentsFromCacheEvidenceV1,
	validateFlowDeskExactModelAvailabilityCacheAcquisitionPlanV1,
	validateFlowDeskExactModelAvailabilityCacheProviderAcquisitionResultV1,
	validateFlowDeskExactModelAvailabilityCacheRefreshPlanV1,
	validateFlowDeskExactModelAvailabilityCacheV1,
	validateFlowDeskReviewerFanoutPlanV1,
} from "./model-availability-cache.js";
import { validateFlowDeskProductionApprovalSourceV1 } from "./production-approval-source.js";
import type { FlowDeskTopTierReviewPerspective } from "./release1-contracts.js";
import { validateFlowDeskReviewerLaneConformanceObservationV1 } from "./reviewer-lane-conformance.js";
import {
	type FlowDeskRuntimeLaneLaunchPlanV1,
	planFlowDeskRuntimeLaneLaunchV1,
	validateFlowDeskRuntimeLaneLaunchPlanV1,
} from "./runtime-lane-productization.js";
import {
	FLOWDESK_SESSION_EVIDENCE_CLASSES,
	type FlowDeskSessionEvidenceClass,
	sessionEvidenceDirectoryPath,
	sessionEvidenceRecordPath,
} from "./state-paths.js";
import {
	invalid,
	type ValidationResult,
	valid,
	validateNoForbiddenRawPayloads,
	validateOpaqueId,
	validateOpaqueRef,
	validateProviderHealthSnapshotV1,
	validateTopTierReviewVerdictV1,
	validateUsageSnapshotV1,
} from "./validators.js";

const EVIDENCE_SCHEMA_BY_CLASS: Record<FlowDeskSessionEvidenceClass, string> = {
	usage_authority: "flowdesk.managed_dispatch_beta.usage_authority_evidence.v1",
	runtime_echo: "flowdesk.managed_dispatch_beta.runtime_echo_evidence.v1",
	telemetry_correlation:
		"flowdesk.managed_dispatch_beta.telemetry_correlation.v1",
	configured_verification: "flowdesk.configured_verification_result.v1",
	sanitized_auth_capture: "flowdesk.sanitized_auth_capture_result.v1",
	external_auth_provider_policy:
		"flowdesk.external_auth_provider_policy_result.v1",
	production_approval: "flowdesk.production_approval_decision.v1",
	production_approval_source: "flowdesk.production_approval_source.v1",
	dispatch_idempotency: "flowdesk.dispatch_idempotency_snapshot.v1",
	pre_dispatch_audit: "flowdesk.pre_dispatch_audit_record.v1",
	exact_model_availability_cache:
		"flowdesk.exact_model_availability_cache.v1",
	exact_model_availability_cache_refresh_plan:
		"flowdesk.exact_model_availability_cache_refresh_plan.v1",
	exact_model_availability_cache_acquisition_plan:
		"flowdesk.exact_model_availability_cache_acquisition_plan.v1",
	exact_model_availability_cache_provider_acquisition_result:
		"flowdesk.exact_model_availability_cache_provider_acquisition_result.v1",
	reviewer_verdict: "flowdesk.top_tier_review_verdict.v1",
	reviewer_fanout_plan: "flowdesk.reviewer_fanout_plan.v1",
	runtime_lane_launch_plan: "flowdesk.runtime_lane_launch_plan.v1",
	lane_lifecycle: "flowdesk.lane_lifecycle_record.v1",
	reviewer_lane_conformance:
		"flowdesk.top_tier_reviewer_lane_conformance_observation.v1",
	controlled_conformance_doc_write:
		"flowdesk.controlled_conformance_doc_write.v1",
	controlled_redacted_audit_export_write:
		"flowdesk.controlled_redacted_audit_export_write.v1",
	controlled_workspace_file_write:
		"flowdesk.controlled_workspace_file_write.v1",
	fallback_regate_plan: "flowdesk.fallback_regate_plan.v1",
	lane_heartbeat: "flowdesk.lane_heartbeat.v1",
	pending_abort_warning: "flowdesk.pending_abort_warning.v1",
	pending_abort_cancel: "flowdesk.pending_abort_cancel.v1",
	provider_usage_snapshot: "flowdesk.usage_snapshot.v1",
	provider_health_snapshot: "flowdesk.provider_health_snapshot.v1",
	reviewer_lane_context: "flowdesk.reviewer_lane_context.v1",
	agent_task_context: "flowdesk.agent_task_context.v1",
	agent_task_progress: "flowdesk.agent_task_progress.v1",
	agent_task_inconsistency: "flowdesk.agent_task_inconsistency.v1",
	agent_task_child_session: "flowdesk.agent_task_child_session.v1",
	pending_retry_plan: "flowdesk.pending_retry_plan.v1",
	retry_executed: "flowdesk.retry_executed.v1",
	retry_failed: "flowdesk.retry_failed.v1",
	task_result: "flowdesk.task_result.v1",
	task_failed: "flowdesk.task_failed.v1",
	workflow_authoring_result: "flowdesk.workflow_authoring_result.v1",
	task_graph: "flowdesk.task_graph.v1",
	task_agent_assignment: "flowdesk.task_agent_assignment.v1",
	task_model_selection: "flowdesk.task_model_selection.v1",
	workflow_synthesis_result: "flowdesk.workflow_synthesis_result.v1",
	workflow_dispatch_plan: "flowdesk.workflow_dispatch_plan.v1",
	coordinator_retry_decision: "flowdesk.coordinator_retry_decision.v1",
};

const CLASS_BY_SCHEMA: Record<string, FlowDeskSessionEvidenceClass> =
	Object.fromEntries(
		(
			Object.entries(EVIDENCE_SCHEMA_BY_CLASS) as Array<
				[FlowDeskSessionEvidenceClass, string]
			>
		).map(([cls, schema]) => [schema, cls]),
	);

export interface FlowDeskSessionEvidenceWriteIntentV1 {
	operation: "write_json";
	authority: "redacted_session_support";
	workflowId: string;
	evidenceId: string;
	evidenceClass: FlowDeskSessionEvidenceClass;
	schemaId: string;
	path: string;
	tempPath: string;
	record: Record<string, unknown>;
	fsSafety: "validated_relative_flowdesk_path_only";
	atomicity: { strategy: "temp_then_rename_intent" };
	realOpenCodeDispatch: false;
	actualLaneLaunch: false;
	providerCall: false;
	runtimeExecution: false;
}

export interface FlowDeskSessionEvidencePrepareResult extends ValidationResult {
	writeIntent?: FlowDeskSessionEvidenceWriteIntentV1;
}

export interface FlowDeskSessionEvidenceReloadEntryV1 {
	evidenceClass: FlowDeskSessionEvidenceClass;
	evidenceId: string;
	record: Record<string, unknown>;
	path: string;
}

export interface FlowDeskSessionEvidenceReloadResultV1
	extends ValidationResult {
	entries: FlowDeskSessionEvidenceReloadEntryV1[];
	blocked: Array<{
		evidenceClass: FlowDeskSessionEvidenceClass;
		evidenceId: string;
		reason: string;
		path: string;
	}>;
	realOpenCodeDispatch: false;
	actualLaneLaunch: false;
	providerCall: false;
	runtimeExecution: false;
}

export interface FlowDeskSessionEvidenceInventoryV1 {
	schema_version: "flowdesk.session_evidence_inventory.v1";
	workflow_id: string;
	total_entries: number;
	total_blocked: number;
	classes: Array<{
		evidenceClass: FlowDeskSessionEvidenceClass;
		valid: number;
		blocked: number;
		lastBlockedReason?: string;
	}>;
	realOpenCodeDispatch: false;
	actualLaneLaunch: false;
	providerCall: false;
	runtimeExecution: false;
}

export interface FlowDeskExactModelCacheEvidencePairSelectionV1 extends ValidationResult {
	state: "pair_ready" | "blocked";
	blocked_labels: string[];
	cache?: FlowDeskExactModelAvailabilityCacheV1;
	cacheRefreshPlan?: FlowDeskExactModelAvailabilityCacheRefreshPlanV1;
	realOpenCodeDispatch: false;
	actualLaneLaunch: false;
	providerCall: false;
	runtimeExecution: false;
}

export interface FlowDeskReviewerFanoutFromReloadedCacheEvidencePlanV1 extends ValidationResult {
	state: "fanout_ready" | "blocked";
	blocked_labels: string[];
	selection: FlowDeskExactModelCacheEvidencePairSelectionV1;
	revalidation: FlowDeskReviewerAssignmentRevalidationV1;
	fanoutPlan: FlowDeskReviewerFanoutPlanV1;
	dispatch_authority_enabled: false;
	realOpenCodeDispatch: false;
	actualLaneLaunch: false;
	providerCall: false;
	runtimeExecution: false;
}

export interface FlowDeskExactModelCacheMaterializationFromAcquisitionEvidenceInputV1 extends FlowDeskExactModelCacheEvidencePairSelectionInputV1 {
	workflowId: string;
	providerAcquisitionEvidenceId?: string;
	targetCacheEvidenceId: string;
	targetCacheRefreshPlanEvidenceId: string;
	cacheId?: string;
	entryId?: string;
	rootDir?: string;
}

export interface FlowDeskExactModelCacheMaterializationFromAcquisitionEvidenceResultV1 extends ValidationResult {
	state: "materialized" | "blocked";
	blocked_labels: string[];
	cache?: FlowDeskExactModelAvailabilityCacheV1;
	cacheRefreshPlan?: FlowDeskExactModelAvailabilityCacheRefreshPlanV1;
	writeIntents: FlowDeskSessionEvidenceWriteIntentV1[];
	applyResult?: FlowDeskSessionEvidenceApplyResultV1;
	reloadedEvidence?: FlowDeskSessionEvidenceReloadResultV1;
	selection?: FlowDeskExactModelCacheEvidencePairSelectionV1;
	realOpenCodeDispatch: false;
	actualLaneLaunch: false;
	providerCall: false;
	runtimeExecution: false;
}

export interface FlowDeskRuntimeLaneLaunchPlanMaterializationFromFanoutEvidenceInputV1 {
	reloadedEvidence: FlowDeskSessionEvidenceReloadResultV1;
	workflowId: string;
	reviewerFanoutEvidenceId?: string;
	targetLaunchPlanEvidenceIds: string[];
	sdkClientAvailable?: boolean;
	durableEvidenceRootRef?: string;
	rootDir?: string;
}

export interface FlowDeskRuntimeLaneLaunchPlanMaterializationFromFanoutEvidenceResultV1 extends ValidationResult {
	state: "materialized" | "blocked";
	blocked_labels: string[];
	fanoutPlan?: FlowDeskReviewerFanoutPlanV1;
	launchPlans: FlowDeskRuntimeLaneLaunchPlanV1[];
	writeIntents: FlowDeskSessionEvidenceWriteIntentV1[];
	applyResult?: FlowDeskSessionEvidenceApplyResultV1;
	reloadedEvidence?: FlowDeskSessionEvidenceReloadResultV1;
	realOpenCodeDispatch: false;
	actualLaneLaunch: false;
	providerCall: false;
	runtimeExecution: false;
}

export interface FlowDeskSessionEvidenceApplyResultV1 extends ValidationResult {
	rootDir?: string;
	writtenPaths: string[];
	realOpenCodeDispatch: false;
	actualLaneLaunch: false;
	providerCall: false;
	runtimeExecution: false;
}

const disabledEvidenceAuthority = {
	realOpenCodeDispatch: false as const,
	actualLaneLaunch: false as const,
	providerCall: false as const,
	runtimeExecution: false as const,
};

function isRecordObject(value: unknown): value is Record<string, unknown> {
	return typeof value === "object" && value !== null && !Array.isArray(value);
}

function exactModelCacheRefreshPlanMatchesContext(
	plan: FlowDeskExactModelAvailabilityCacheRefreshPlanV1,
	input: FlowDeskExactModelCacheEvidencePairSelectionInputV1,
): boolean {
	return plan.state === "cache_hit" &&
		plan.cache_usable_for_assignment === true &&
		plan.expected_local_date === input.localDate &&
		plan.expected_active_profile_ref === input.activeProfileRef &&
		plan.expected_opencode_version_ref === input.opencodeVersionRef &&
		plan.expected_flowdesk_package_version_ref === input.flowdeskPackageVersionRef &&
		plan.expected_registry_hash === input.registryHash &&
		plan.expected_policy_pack_hash === input.policyPackHash &&
		plan.expected_auth_account_boundary_ref === input.authAccountBoundaryRef;
}

function exactModelCacheMatchesRefreshPlan(
	cache: FlowDeskExactModelAvailabilityCacheV1,
	plan: FlowDeskExactModelAvailabilityCacheRefreshPlanV1,
): boolean {
	return plan.cache_id === cache.cache_id &&
		plan.cache_local_date === cache.local_date &&
		plan.cache_active_profile_ref === cache.active_profile_ref &&
		plan.cache_opencode_version_ref === cache.opencode_version_ref &&
		plan.cache_flowdesk_package_version_ref === cache.flowdesk_package_version_ref &&
		plan.cache_registry_hash === cache.registry_hash &&
		plan.cache_policy_pack_hash === cache.policy_pack_hash &&
		plan.cache_auth_account_boundary_ref === cache.auth_account_boundary_ref;
}

export interface FlowDeskExactModelCacheEvidencePairSelectionInputV1 {
	reloadedEvidence: FlowDeskSessionEvidenceReloadResultV1;
	localDate: string;
	activeProfileRef: string;
	opencodeVersionRef: string;
	flowdeskPackageVersionRef: string;
	registryHash: string;
	policyPackHash: string;
	authAccountBoundaryRef: string;
}

export interface FlowDeskReviewerFanoutFromReloadedCacheEvidenceInputV1 extends FlowDeskExactModelCacheEvidencePairSelectionInputV1 {
	workflowId: string;
	attemptId: string;
	parentSessionRef: string;
	agentRef: string;
	requestedAt: string;
	requestedPerspectives?: FlowDeskTopTierReviewPerspective[];
	maxConcurrentLaneCount?: number;
	timeoutMs?: number;
	orphanMaxAgeMs?: number;
	retryBudget?: number;
	preLaunchAuditRef?: string;
	laneLaunchApprovalRef?: string;
}

export function selectFlowDeskExactModelCacheEvidencePairV1(
	input: FlowDeskExactModelCacheEvidencePairSelectionInputV1,
): FlowDeskExactModelCacheEvidencePairSelectionV1 {
	const errors = [...input.reloadedEvidence.errors];
	const blockedLabels: string[] = [];
	if (!input.reloadedEvidence.ok) blockedLabels.push("session_evidence_reload_invalid");
	const refreshPlans = input.reloadedEvidence.entries
		.filter((entry) => entry.evidenceClass === "exact_model_availability_cache_refresh_plan")
		.map((entry) => entry.record)
		.filter((record) => validateFlowDeskExactModelAvailabilityCacheRefreshPlanV1(record).ok)
		.map((record) => record as unknown as FlowDeskExactModelAvailabilityCacheRefreshPlanV1)
		.filter((plan) => exactModelCacheRefreshPlanMatchesContext(plan, input));
	if (refreshPlans.length === 0) blockedLabels.push("cache_refresh_pair_missing");
	if (refreshPlans.length > 1) blockedLabels.push("cache_refresh_pair_ambiguous");
	const cacheRefreshPlan = refreshPlans.length === 1 ? refreshPlans[0] : undefined;
	const caches = cacheRefreshPlan === undefined ? [] : input.reloadedEvidence.entries
		.filter((entry) => entry.evidenceClass === "exact_model_availability_cache")
		.map((entry) => entry.record)
		.filter((record) => validateFlowDeskExactModelAvailabilityCacheV1(record).ok)
		.map((record) => record as unknown as FlowDeskExactModelAvailabilityCacheV1)
		.filter((cache) => exactModelCacheMatchesRefreshPlan(cache, cacheRefreshPlan));
	if (cacheRefreshPlan !== undefined && caches.length === 0) blockedLabels.push("cache_pair_missing");
	if (caches.length > 1) blockedLabels.push("cache_pair_ambiguous");
	const cache = caches.length === 1 ? caches[0] : undefined;
	const ready = blockedLabels.length === 0 && cache !== undefined && cacheRefreshPlan !== undefined;
	return {
		ok: ready && errors.length === 0,
		errors,
		state: ready ? "pair_ready" : "blocked",
		blocked_labels: [...new Set(blockedLabels)],
		...(cache === undefined ? {} : { cache }),
		...(cacheRefreshPlan === undefined ? {} : { cacheRefreshPlan }),
		...disabledEvidenceAuthority,
	};
}

function blockedReviewerAssignmentRevalidationFromSelection(
	input: FlowDeskExactModelCacheEvidencePairSelectionInputV1,
	selection: FlowDeskExactModelCacheEvidencePairSelectionV1,
): FlowDeskReviewerAssignmentRevalidationV1 {
	return {
		schema_version: "flowdesk.reviewer_assignment_revalidation.v1",
		ok: false,
		errors: selection.errors,
		state: "blocked",
		blocked_labels: [...new Set(["cache_evidence_pair_selection_blocked", ...selection.blocked_labels])],
		expected_local_date: input.localDate,
		expected_active_profile_ref: input.activeProfileRef,
		expected_opencode_version_ref: input.opencodeVersionRef,
		expected_flowdesk_package_version_ref: input.flowdeskPackageVersionRef,
		expected_registry_hash: input.registryHash,
		expected_policy_pack_hash: input.policyPackHash,
		expected_auth_account_boundary_ref: input.authAccountBoundaryRef,
		eligible_bindings: [],
		dispatch_authority_enabled: false,
		providerCall: false,
		actualLaneLaunch: false,
		runtimeExecution: false,
	};
}

export function planFlowDeskReviewerFanoutFromReloadedCacheEvidenceV1(
	input: FlowDeskReviewerFanoutFromReloadedCacheEvidenceInputV1,
): FlowDeskReviewerFanoutFromReloadedCacheEvidencePlanV1 {
	const selection = selectFlowDeskExactModelCacheEvidencePairV1(input);
	const revalidation = selection.state === "pair_ready" && selection.cache !== undefined && selection.cacheRefreshPlan !== undefined
		? revalidateFlowDeskReviewerAssignmentsFromCacheEvidenceV1({
			cache: selection.cache,
			cacheRefreshPlan: selection.cacheRefreshPlan,
			localDate: input.localDate,
			activeProfileRef: input.activeProfileRef,
			opencodeVersionRef: input.opencodeVersionRef,
			flowdeskPackageVersionRef: input.flowdeskPackageVersionRef,
			registryHash: input.registryHash,
			policyPackHash: input.policyPackHash,
			authAccountBoundaryRef: input.authAccountBoundaryRef,
		})
		: blockedReviewerAssignmentRevalidationFromSelection(input, selection);
	const fanoutPlan = planFlowDeskReviewerFanoutV1({
		revalidation,
		workflowId: input.workflowId,
		attemptId: input.attemptId,
		parentSessionRef: input.parentSessionRef,
		agentRef: input.agentRef,
		requestedAt: input.requestedAt,
		requestedPerspectives: input.requestedPerspectives,
		maxConcurrentLaneCount: input.maxConcurrentLaneCount,
		timeoutMs: input.timeoutMs,
		orphanMaxAgeMs: input.orphanMaxAgeMs,
		retryBudget: input.retryBudget,
		preLaunchAuditRef: input.preLaunchAuditRef,
		laneLaunchApprovalRef: input.laneLaunchApprovalRef,
	});
	const ready = selection.state === "pair_ready" && revalidation.state === "revalidated" && fanoutPlan.state === "fanout_ready";
	return {
		ok: ready && selection.ok && revalidation.ok && fanoutPlan.ok,
		errors: [...selection.errors, ...revalidation.errors, ...fanoutPlan.errors],
		state: ready ? "fanout_ready" : "blocked",
		blocked_labels: [...new Set([...selection.blocked_labels, ...revalidation.blocked_labels, ...fanoutPlan.blocked_labels])],
		selection,
		revalidation,
		fanoutPlan,
		dispatch_authority_enabled: false,
		...disabledEvidenceAuthority,
	};
}

function sessionEvidenceAlreadyContainsId(
	reloadedEvidence: FlowDeskSessionEvidenceReloadResultV1,
	evidenceClass: FlowDeskSessionEvidenceClass,
	evidenceId: string,
): boolean {
	return reloadedEvidence.entries.some((entry) => entry.evidenceClass === evidenceClass && entry.evidenceId === evidenceId) ||
		reloadedEvidence.blocked.some((entry) => entry.evidenceClass === evidenceClass && entry.evidenceId === evidenceId);
}

function providerAcquisitionResultMatchesStrictContext(
	result: FlowDeskExactModelAvailabilityCacheProviderAcquisitionResultV1,
	input: FlowDeskExactModelCacheEvidencePairSelectionInputV1,
): boolean {
	return result.local_date === input.localDate &&
		result.active_profile_ref === input.activeProfileRef &&
		result.opencode_version_ref === input.opencodeVersionRef &&
		result.flowdesk_package_version_ref === input.flowdeskPackageVersionRef &&
		result.registry_hash === input.registryHash &&
		result.policy_pack_hash === input.policyPackHash &&
		result.auth_account_boundary_ref === input.authAccountBoundaryRef;
}

function exactModelMaterializationExpectedContext(
	input: FlowDeskExactModelCacheEvidencePairSelectionInputV1,
): FlowDeskExactModelAvailabilityCacheMaterializationContextV1 {
	return {
		localDate: input.localDate,
		activeProfileRef: input.activeProfileRef,
		opencodeVersionRef: input.opencodeVersionRef,
		flowdeskPackageVersionRef: input.flowdeskPackageVersionRef,
		registryHash: input.registryHash,
		policyPackHash: input.policyPackHash,
		authAccountBoundaryRef: input.authAccountBoundaryRef,
	};
}

export function materializeFlowDeskExactModelCacheEvidenceFromProviderAcquisitionEvidenceV1(
	input: FlowDeskExactModelCacheMaterializationFromAcquisitionEvidenceInputV1,
): FlowDeskExactModelCacheMaterializationFromAcquisitionEvidenceResultV1 {
	const errors = [...input.reloadedEvidence.errors];
	const blockedLabels: string[] = [];
	if (!input.reloadedEvidence.ok) blockedLabels.push("session_evidence_reload_invalid");
	if (sessionEvidenceAlreadyContainsId(input.reloadedEvidence, "exact_model_availability_cache", input.targetCacheEvidenceId))
		blockedLabels.push("target_cache_evidence_duplicate");
	if (sessionEvidenceAlreadyContainsId(input.reloadedEvidence, "exact_model_availability_cache_refresh_plan", input.targetCacheRefreshPlanEvidenceId))
		blockedLabels.push("target_cache_refresh_evidence_duplicate");
	const acquisitionEntries = input.reloadedEvidence.entries
		.filter((entry) => entry.evidenceClass === "exact_model_availability_cache_provider_acquisition_result")
		.filter((entry) => input.providerAcquisitionEvidenceId === undefined || entry.evidenceId === input.providerAcquisitionEvidenceId)
		.map((entry) => ({
			...entry,
			validation: validateFlowDeskExactModelAvailabilityCacheProviderAcquisitionResultV1(entry.record),
		}))
		.filter((entry) => entry.validation.ok)
		.map((entry) => ({
			...entry,
			record: entry.record as unknown as FlowDeskExactModelAvailabilityCacheProviderAcquisitionResultV1,
		}))
		.filter((entry) => input.providerAcquisitionEvidenceId !== undefined || providerAcquisitionResultMatchesStrictContext(entry.record, input));
	if (acquisitionEntries.length === 0) blockedLabels.push("provider_acquisition_evidence_missing");
	if (acquisitionEntries.length > 1) blockedLabels.push("provider_acquisition_evidence_ambiguous");
	const acquisition = acquisitionEntries.length === 1 ? acquisitionEntries[0].record : undefined;
	const materialized = materializeFlowDeskExactModelAvailabilityCacheFromProviderAcquisitionResultV1({
		providerAcquisitionResult: acquisition,
		cacheId: input.cacheId,
		entryId: input.entryId,
		expectedContext: exactModelMaterializationExpectedContext(input),
	});
	if (!materialized.ok) {
		errors.push(...materialized.errors);
		blockedLabels.push(...materialized.blocked_labels);
	}
	const cache = materialized.cache;
	const cacheRefreshPlan = cache === undefined ? undefined : planFlowDeskExactModelAvailabilityCacheRefreshV1({
		cache,
		localDate: input.localDate,
		activeProfileRef: input.activeProfileRef,
		opencodeVersionRef: input.opencodeVersionRef,
		flowdeskPackageVersionRef: input.flowdeskPackageVersionRef,
		registryHash: input.registryHash,
		policyPackHash: input.policyPackHash,
		authAccountBoundaryRef: input.authAccountBoundaryRef,
	});
	if (cacheRefreshPlan !== undefined) {
		const refreshValidation = validateFlowDeskExactModelAvailabilityCacheRefreshPlanV1(cacheRefreshPlan);
		if (!refreshValidation.ok) {
			errors.push(...refreshValidation.errors.map((error) => `cache_refresh_plan: ${error}`));
			blockedLabels.push("materialized_cache_refresh_plan_invalid");
		}
		if (cacheRefreshPlan.state !== "cache_hit") blockedLabels.push("materialized_cache_refresh_not_cache_hit");
	}
	if (cache !== undefined) {
		const existingRefreshPlans = input.reloadedEvidence.entries
			.filter((entry) => entry.evidenceClass === "exact_model_availability_cache_refresh_plan")
			.map((entry) => entry.record)
			.filter((record) => validateFlowDeskExactModelAvailabilityCacheRefreshPlanV1(record).ok)
			.map((record) => record as unknown as FlowDeskExactModelAvailabilityCacheRefreshPlanV1)
			.filter((plan) => exactModelCacheRefreshPlanMatchesContext(plan, input));
		if (existingRefreshPlans.length > 0) blockedLabels.push("cache_refresh_context_already_exists");
		const existingCachesForPlannedRefresh = cacheRefreshPlan === undefined ? [] : input.reloadedEvidence.entries
			.filter((entry) => entry.evidenceClass === "exact_model_availability_cache")
			.map((entry) => entry.record)
			.filter((record) => validateFlowDeskExactModelAvailabilityCacheV1(record).ok)
			.map((record) => record as unknown as FlowDeskExactModelAvailabilityCacheV1)
			.filter((existingCache) => exactModelCacheMatchesRefreshPlan(existingCache, cacheRefreshPlan));
		if (existingCachesForPlannedRefresh.length > 0) blockedLabels.push("cache_context_already_exists");
	}
	if (blockedLabels.length > 0 || cache === undefined || cacheRefreshPlan === undefined)
		return {
			ok: false,
			errors,
			state: "blocked",
			blocked_labels: [...new Set(blockedLabels)],
			...(cache === undefined ? {} : { cache }),
			...(cacheRefreshPlan === undefined ? {} : { cacheRefreshPlan }),
			writeIntents: [],
			...disabledEvidenceAuthority,
		};
	const cacheIntent = prepareFlowDeskSessionEvidenceWriteIntentV1({
		workflowId: input.workflowId,
		evidenceId: input.targetCacheEvidenceId,
		record: cache,
	});
	const refreshIntent = prepareFlowDeskSessionEvidenceWriteIntentV1({
		workflowId: input.workflowId,
		evidenceId: input.targetCacheRefreshPlanEvidenceId,
		record: cacheRefreshPlan,
	});
	if (!cacheIntent.ok || cacheIntent.writeIntent === undefined || !refreshIntent.ok || refreshIntent.writeIntent === undefined)
		return {
			ok: false,
			errors: [...errors, ...cacheIntent.errors, ...refreshIntent.errors],
			state: "blocked",
			blocked_labels: [...new Set([...blockedLabels, "cache_materialization_write_intent_invalid"])],
			cache,
			cacheRefreshPlan,
			writeIntents: [],
			...disabledEvidenceAuthority,
		};
	const writeIntents = [cacheIntent.writeIntent, refreshIntent.writeIntent];
	if (input.rootDir === undefined)
		return {
			ok: true,
			errors,
			state: "materialized",
			blocked_labels: [],
			cache,
			cacheRefreshPlan,
			writeIntents,
			...disabledEvidenceAuthority,
		};
	const applyResult = applyFlowDeskSessionEvidenceWriteIntentsV1(input.rootDir, writeIntents);
	if (!applyResult.ok)
		return {
			ok: false,
			errors: [...errors, ...applyResult.errors],
			state: "blocked",
			blocked_labels: [...new Set([...blockedLabels, "cache_materialization_apply_failed"])],
			cache,
			cacheRefreshPlan,
			writeIntents,
			applyResult,
			...disabledEvidenceAuthority,
		};
	const reloadedEvidence = reloadFlowDeskSessionEvidenceV1({ workflowId: input.workflowId, rootDir: input.rootDir });
	const selection = selectFlowDeskExactModelCacheEvidencePairV1({
		reloadedEvidence,
		localDate: input.localDate,
		activeProfileRef: input.activeProfileRef,
		opencodeVersionRef: input.opencodeVersionRef,
		flowdeskPackageVersionRef: input.flowdeskPackageVersionRef,
		registryHash: input.registryHash,
		policyPackHash: input.policyPackHash,
		authAccountBoundaryRef: input.authAccountBoundaryRef,
	});
	const ready = reloadedEvidence.ok && selection.state === "pair_ready";
	return {
		ok: ready,
		errors: [...errors, ...reloadedEvidence.errors, ...selection.errors],
		state: ready ? "materialized" : "blocked",
		blocked_labels: ready ? [] : [...new Set([...blockedLabels, "cache_materialization_reload_verification_failed", ...selection.blocked_labels])],
		cache,
		cacheRefreshPlan,
		writeIntents,
		applyResult,
		reloadedEvidence,
		selection,
		...disabledEvidenceAuthority,
	};
}

export function materializeFlowDeskRuntimeLaneLaunchPlansFromReviewerFanoutEvidenceV1(
	input: FlowDeskRuntimeLaneLaunchPlanMaterializationFromFanoutEvidenceInputV1,
): FlowDeskRuntimeLaneLaunchPlanMaterializationFromFanoutEvidenceResultV1 {
	const errors = [...input.reloadedEvidence.errors];
	const blockedLabels: string[] = [];
	if (!input.reloadedEvidence.ok) blockedLabels.push("session_evidence_reload_invalid");
	const targetIds = input.targetLaunchPlanEvidenceIds;
	if (targetIds.length === 0) blockedLabels.push("target_launch_plan_ids_missing");
	if (new Set(targetIds).size !== targetIds.length)
		blockedLabels.push("target_launch_plan_ids_duplicate");
	for (const targetId of targetIds) {
		if (sessionEvidenceAlreadyContainsId(input.reloadedEvidence, "runtime_lane_launch_plan", targetId))
			blockedLabels.push("target_runtime_launch_plan_evidence_duplicate");
	}
	const fanoutEntries = input.reloadedEvidence.entries
		.filter((entry) => entry.evidenceClass === "reviewer_fanout_plan")
		.filter((entry) => input.reviewerFanoutEvidenceId === undefined || entry.evidenceId === input.reviewerFanoutEvidenceId)
		.map((entry) => ({ ...entry, validation: validateFlowDeskReviewerFanoutPlanV1(entry.record) }))
		.filter((entry) => entry.validation.ok)
		.map((entry) => ({ ...entry, record: entry.record as unknown as FlowDeskReviewerFanoutPlanV1 }))
		.filter((entry) => entry.record.workflow_id === input.workflowId);
	if (fanoutEntries.length === 0) blockedLabels.push("reviewer_fanout_evidence_missing");
	if (fanoutEntries.length > 1) blockedLabels.push("reviewer_fanout_evidence_ambiguous");
	const fanoutPlan = fanoutEntries.length === 1 ? fanoutEntries[0].record : undefined;
	if (fanoutPlan !== undefined && (fanoutPlan.state !== "fanout_ready" || !fanoutPlan.ok))
		blockedLabels.push("reviewer_fanout_not_ready");
	const launchRequests = fanoutPlan?.runtime_lane_launch_requests ?? [];
	if (fanoutPlan !== undefined && targetIds.length !== launchRequests.length)
		blockedLabels.push("target_launch_plan_count_mismatch");
	const launchPlans = launchRequests.map((request) =>
		planFlowDeskRuntimeLaneLaunchV1({
			request,
			sdkClientAvailable: input.sdkClientAvailable,
			durableEvidenceRootRef: input.durableEvidenceRootRef,
		}),
	);
	for (const [index, plan] of launchPlans.entries()) {
		errors.push(...plan.errors.map((error) => `launch_plans[${index}]: ${error}`));
		if (plan.state !== "launch_ready")
			blockedLabels.push(...(plan.blocked_labels.length > 0 ? plan.blocked_labels : ["runtime_launch_plan_blocked"]));
	}
	if (blockedLabels.length > 0 || fanoutPlan === undefined || launchPlans.length === 0)
		return {
			ok: false,
			errors,
			state: "blocked",
			blocked_labels: [...new Set(blockedLabels)],
			...(fanoutPlan === undefined ? {} : { fanoutPlan }),
			launchPlans,
			writeIntents: [],
			...disabledEvidenceAuthority,
		};
	const prepared = launchPlans.map((plan, index) =>
		prepareFlowDeskSessionEvidenceWriteIntentV1({
			workflowId: input.workflowId,
			evidenceId: targetIds[index],
			record: plan as unknown as Record<string, unknown>,
		}),
	);
	const prepareErrors = prepared.flatMap((result) => result.errors);
	const writeIntents = prepared
		.map((result) => result.writeIntent)
		.filter((intent): intent is FlowDeskSessionEvidenceWriteIntentV1 => intent !== undefined);
	if (prepareErrors.length > 0 || writeIntents.length !== launchPlans.length)
		return {
			ok: false,
			errors: [...errors, ...prepareErrors],
			state: "blocked",
			blocked_labels: ["runtime_launch_plan_write_intent_invalid"],
			fanoutPlan,
			launchPlans,
			writeIntents: [],
			...disabledEvidenceAuthority,
		};
	if (input.rootDir === undefined)
		return {
			ok: true,
			errors,
			state: "materialized",
			blocked_labels: [],
			fanoutPlan,
			launchPlans,
			writeIntents,
			...disabledEvidenceAuthority,
		};
	const applyResult = applyFlowDeskSessionEvidenceWriteIntentsV1(input.rootDir, writeIntents);
	if (!applyResult.ok)
		return {
			ok: false,
			errors: [...errors, ...applyResult.errors],
			state: "blocked",
			blocked_labels: ["runtime_launch_plan_apply_failed"],
			fanoutPlan,
			launchPlans,
			writeIntents,
			applyResult,
			...disabledEvidenceAuthority,
		};
	const reloadedEvidence = reloadFlowDeskSessionEvidenceV1({ workflowId: input.workflowId, rootDir: input.rootDir });
	const reloadedIds = new Set(
		reloadedEvidence.entries
			.filter((entry) => entry.evidenceClass === "runtime_lane_launch_plan")
			.map((entry) => entry.evidenceId),
	);
	const allReloaded = targetIds.every((targetId) => reloadedIds.has(targetId));
	const ready = reloadedEvidence.ok && allReloaded;
	return {
		ok: ready,
		errors: [...errors, ...reloadedEvidence.errors],
		state: ready ? "materialized" : "blocked",
		blocked_labels: ready ? [] : ["runtime_launch_plan_reload_verification_failed"],
		fanoutPlan,
		launchPlans,
		writeIntents,
		applyResult,
		reloadedEvidence,
		...disabledEvidenceAuthority,
	};
}

function validateSchemaVersionForClass(
	record: Record<string, unknown>,
	evidenceClass: FlowDeskSessionEvidenceClass,
): ValidationResult {
	const expected = EVIDENCE_SCHEMA_BY_CLASS[evidenceClass];
	return record.schema_version === expected
		? valid()
		: invalid(`evidence schema_version must be ${expected}`);
}

function validateEvidenceShape(
	record: Record<string, unknown>,
	evidenceClass: FlowDeskSessionEvidenceClass,
): ValidationResult {
	const schemaCheck = validateSchemaVersionForClass(record, evidenceClass);
	if (!schemaCheck.ok) return schemaCheck;
	if (evidenceClass === "dispatch_idempotency")
		return validateFlowDeskDispatchIdempotencySnapshotV1(record);
	if (evidenceClass === "production_approval_source")
		return validateFlowDeskProductionApprovalSourceV1(record);
	if (evidenceClass === "reviewer_verdict")
		return validateTopTierReviewVerdictV1(record);
	if (evidenceClass === "exact_model_availability_cache")
		return validateFlowDeskExactModelAvailabilityCacheV1(record);
	if (evidenceClass === "exact_model_availability_cache_refresh_plan")
		return validateFlowDeskExactModelAvailabilityCacheRefreshPlanV1(record);
	if (evidenceClass === "exact_model_availability_cache_acquisition_plan")
		return validateFlowDeskExactModelAvailabilityCacheAcquisitionPlanV1(record);
	if (evidenceClass === "exact_model_availability_cache_provider_acquisition_result")
		return validateFlowDeskExactModelAvailabilityCacheProviderAcquisitionResultV1(record);
	if (evidenceClass === "reviewer_fanout_plan")
		return validateFlowDeskReviewerFanoutPlanV1(record);
	if (evidenceClass === "runtime_lane_launch_plan")
		return validateFlowDeskRuntimeLaneLaunchPlanV1(record);
	if (evidenceClass === "lane_lifecycle")
		return validateFlowDeskLaneLifecycleRecordV1(record);
	if (evidenceClass === "lane_heartbeat")
		return validateFlowDeskLaneHeartbeatRecordV1(record);
	if (evidenceClass === "pending_abort_warning")
		return validateFlowDeskPendingAbortWarningV1(record);
	if (evidenceClass === "pending_abort_cancel")
		return validateFlowDeskPendingAbortCancelV1(record);
	if (evidenceClass === "reviewer_lane_context")
		return validateFlowDeskReviewerLaneContextV1(record);
	if (evidenceClass === "agent_task_context")
		return validateFlowDeskAgentTaskContextV1(record);
	if (evidenceClass === "agent_task_progress")
		return validateFlowDeskAgentTaskProgressV1(record);
	if (evidenceClass === "agent_task_inconsistency")
		return validateFlowDeskAgentTaskInconsistencyV1(record);
	if (evidenceClass === "coordinator_retry_decision")
		return validateFlowDeskCoordinatorRetryDecisionV1(record);
	if (evidenceClass === "pending_retry_plan")
		return validateFlowDeskPendingRetryPlanV1(record);
	if (evidenceClass === "retry_executed")
		return validateFlowDeskRetryExecutedV1(record);
	if (evidenceClass === "retry_failed")
		return validateFlowDeskRetryFailedV1(record);
	if (evidenceClass === "task_result")
		return validateFlowDeskTaskResultV1(record);
	if (evidenceClass === "task_failed")
		return validateFlowDeskTaskFailedV1(record);
	if (evidenceClass === "workflow_authoring_result")
		return validateFlowDeskWorkflowAuthoringResultV1(record);
	if (evidenceClass === "task_graph")
		return validateFlowDeskTaskGraphV1(record);
	if (evidenceClass === "task_agent_assignment")
		return validateFlowDeskTaskAgentAssignmentV1(record);
	if (evidenceClass === "task_model_selection")
		return validateFlowDeskTaskModelSelectionV1(record);
	if (evidenceClass === "workflow_synthesis_result")
		return validateFlowDeskWorkflowSynthesisResultV1(record);
	if (evidenceClass === "workflow_dispatch_plan")
		return validateFlowDeskWorkflowDispatchPlanV1(record);
	if (evidenceClass === "reviewer_lane_conformance")
		return validateFlowDeskReviewerLaneConformanceObservationV1(record);
	if (evidenceClass === "controlled_conformance_doc_write")
		return validateFlowDeskControlledConformanceDocWriteRecordV1(record);
	if (evidenceClass === "controlled_redacted_audit_export_write")
		return validateFlowDeskControlledRedactedAuditExportWriteRecordV1(record);
	if (evidenceClass === "controlled_workspace_file_write")
		return validateFlowDeskControlledWorkspaceFileWriteRecordV1(record);
	if (evidenceClass === "fallback_regate_plan")
		return validateFlowDeskFallbackRegatePlanV1(record);
	if (evidenceClass === "provider_usage_snapshot")
		return validateUsageSnapshotV1(record);
	if (evidenceClass === "provider_health_snapshot")
		return validateProviderHealthSnapshotV1(record);
	if (evidenceClass === "configured_verification")
		return validateFlowDeskConfiguredVerificationResultV1(record);
	if (evidenceClass === "sanitized_auth_capture")
		return validateFlowDeskSanitizedAuthCaptureResultV1(record);
	if (evidenceClass === "external_auth_provider_policy")
		return validateFlowDeskExternalAuthProviderPolicyResultV1(record);
	if (evidenceClass === "production_approval")
		return validateFlowDeskProductionApprovalDecisionV1(record);
	if (evidenceClass === "pre_dispatch_audit")
		return validateFlowDeskPreDispatchAuditRecordV1(record);
	if (evidenceClass === "usage_authority")
		return validateFlowDeskManagedDispatchBetaUsageAuthorityShapeV1(record);
	if (evidenceClass === "runtime_echo")
		return validateFlowDeskManagedDispatchBetaRuntimeEchoShapeV1(record);
	if (evidenceClass === "telemetry_correlation")
		return validateFlowDeskManagedDispatchBetaTelemetryCorrelationShapeV1(record);
	const requiredCommon = ["schema_version"] as const;
	for (const key of requiredCommon)
		if (!(key in record))
			return invalid(`evidence is missing required field: ${key}`);
	return validateNoForbiddenRawPayloads(record, "session_evidence_record");
}

function validateOptionalTimestampFreshness(
	record: Record<string, unknown>,
	rejectStaleAt: string | undefined,
): ValidationResult {
	if (rejectStaleAt === undefined || !("expires_at" in record)) return valid();
	const checkedAt = Date.parse(rejectStaleAt);
	if (!Number.isFinite(checkedAt))
		return invalid("rejectStaleAt must be a parseable timestamp");
	if (typeof record.expires_at !== "string")
		return invalid("evidence expires_at must be a timestamp string");
	const expiresAt = Date.parse(record.expires_at);
	if (!Number.isFinite(expiresAt))
		return invalid("evidence expires_at must be parseable");
	return expiresAt > checkedAt ? valid() : invalid("evidence is stale");
}

function validateOptionalProfileAlignment(
	record: Record<string, unknown>,
	expectedProfileRef: string | undefined,
): ValidationResult {
	if (expectedProfileRef === undefined) return valid();
	const expected = validateOpaqueRef(expectedProfileRef, "expected_profile_ref");
	if (!expected.ok) return expected;
	const profileRef = record.profile_ref ?? record.auth_profile_ref;
	if (profileRef === undefined) return valid();
	return profileRef === expectedProfileRef
		? valid()
		: invalid("evidence profile_ref mismatch");
}

function ensureWorkflowAlignment(
	record: Record<string, unknown>,
	workflowId: string,
): ValidationResult {
	if (!("workflow_id" in record)) return valid();
	return record.workflow_id === workflowId
		? valid()
		: invalid(`evidence workflow_id mismatch: expected ${workflowId}`);
}

export function classifyFlowDeskSessionEvidenceRecord(
	record: unknown,
):
	| { ok: true; evidenceClass: FlowDeskSessionEvidenceClass }
	| { ok: false; errors: string[] } {
	if (!isRecordObject(record))
		return { ok: false, errors: ["evidence must be an object"] };
	const schema = record.schema_version;
	if (typeof schema !== "string")
		return { ok: false, errors: ["evidence schema_version must be a string"] };
	const evidenceClass = CLASS_BY_SCHEMA[schema];
	if (evidenceClass === undefined)
		return {
			ok: false,
			errors: [
				`evidence schema_version is not a managed session evidence class: ${schema}`,
			],
		};
	return { ok: true, evidenceClass };
}

export interface FlowDeskSessionEvidencePrepareInputV1 {
	workflowId: string;
	evidenceId: string;
	record: unknown;
}

export function prepareFlowDeskSessionEvidenceWriteIntentV1(
	input: FlowDeskSessionEvidencePrepareInputV1,
): FlowDeskSessionEvidencePrepareResult {
	const workflowResult = validateOpaqueId(input.workflowId, "workflow_id");
	if (!workflowResult.ok) return workflowResult;
	const evidenceIdResult = validateOpaqueId(input.evidenceId, "evidence_id");
	if (!evidenceIdResult.ok) return evidenceIdResult;
	const classification = classifyFlowDeskSessionEvidenceRecord(input.record);
	if (!classification.ok) return invalid(...classification.errors);
	if (!isRecordObject(input.record))
		return invalid("evidence must be an object");
	const shapeResult = validateEvidenceShape(
		input.record,
		classification.evidenceClass,
	);
	if (!shapeResult.ok) return shapeResult;
	const workflowAlignment = ensureWorkflowAlignment(
		input.record,
		input.workflowId,
	);
	if (!workflowAlignment.ok) return workflowAlignment;
	const path = sessionEvidenceRecordPath(
		input.workflowId,
		classification.evidenceClass,
		input.evidenceId,
	);
	const schemaId = EVIDENCE_SCHEMA_BY_CLASS[classification.evidenceClass];
	const tempPath = `${path}.tmp-${schemaId.replace(/[^A-Za-z0-9_.-]/g, "-")}`;
	const writeIntent: FlowDeskSessionEvidenceWriteIntentV1 = {
		operation: "write_json",
		authority: "redacted_session_support",
		workflowId: input.workflowId,
		evidenceId: input.evidenceId,
		evidenceClass: classification.evidenceClass,
		schemaId,
		path,
		tempPath,
		record: JSON.parse(JSON.stringify(input.record)) as Record<string, unknown>,
		fsSafety: "validated_relative_flowdesk_path_only",
		atomicity: { strategy: "temp_then_rename_intent" },
		...disabledEvidenceAuthority,
	};
	return { ok: true, errors: [], writeIntent };
}

function safeJoin(rootDir: string, relativePath: string): string {
	const root = resolve(rootDir);
	const target = resolve(root, relativePath);
	const rootPrefix = root.endsWith(sep) ? root : `${root}${sep}`;
	if (target !== root && !target.startsWith(rootPrefix))
		throw new Error("evidence target escapes root directory");
	return target;
}

function validateSessionEvidenceWriteIntent(
	intent: FlowDeskSessionEvidenceWriteIntentV1,
): ValidationResult {
	const errors: string[] = [];
	if (intent.operation !== "write_json")
		errors.push("session evidence intent operation must be write_json");
	if (intent.authority !== "redacted_session_support")
		errors.push("session evidence intent authority is invalid");
	errors.push(...validateOpaqueId(intent.workflowId, "workflow_id").errors);
	errors.push(...validateOpaqueId(intent.evidenceId, "evidence_id").errors);
	if (
		!(FLOWDESK_SESSION_EVIDENCE_CLASSES as readonly string[]).includes(
			intent.evidenceClass,
		)
	)
		errors.push("session evidence class is invalid");
	const expectedSchema = EVIDENCE_SCHEMA_BY_CLASS[intent.evidenceClass];
	if (intent.schemaId !== expectedSchema)
		errors.push("session evidence schemaId does not match evidenceClass");
	const expectedPath = sessionEvidenceRecordPath(
		intent.workflowId,
		intent.evidenceClass,
		intent.evidenceId,
	);
	if (intent.path !== expectedPath)
		errors.push("session evidence path does not match workflow/class/id");
	const expectedTempPrefix = `${expectedPath}.tmp-`;
	if (!intent.tempPath.startsWith(expectedTempPrefix))
		errors.push("session evidence tempPath does not match target path");
	if (
		!intent.tempPath.includes(expectedSchema.replace(/[^A-Za-z0-9_.-]/g, "-"))
	)
		errors.push("session evidence tempPath does not bind schemaId");
	if (intent.fsSafety !== "validated_relative_flowdesk_path_only")
		errors.push("session evidence fsSafety is invalid");
	if (intent.atomicity?.strategy !== "temp_then_rename_intent")
		errors.push("session evidence atomicity is invalid");
	if (
		intent.realOpenCodeDispatch !== false ||
		intent.actualLaneLaunch !== false ||
		intent.providerCall !== false ||
		intent.runtimeExecution !== false
	)
		errors.push("session evidence intent cannot enable runtime authority");
	const shape = validateEvidenceShape(intent.record, intent.evidenceClass);
	errors.push(...shape.errors);
	const alignment = ensureWorkflowAlignment(intent.record, intent.workflowId);
	errors.push(...alignment.errors);
	return errors.length === 0 ? valid() : invalid(...errors);
}

export function applyFlowDeskSessionEvidenceWriteIntentsV1(
	rootDir: string,
	intents: readonly FlowDeskSessionEvidenceWriteIntentV1[],
): FlowDeskSessionEvidenceApplyResultV1 {
	if (typeof rootDir !== "string" || rootDir.trim().length === 0)
		return {
			...invalid("rootDir is required"),
			writtenPaths: [],
			...disabledEvidenceAuthority,
		};
	const writtenPaths: string[] = [];
	const root = resolve(rootDir);
	try {
		const seenTargets = new Set<string>();
		const seenTemps = new Set<string>();
		for (const intent of intents) {
			const intentResult = validateSessionEvidenceWriteIntent(intent);
			if (!intentResult.ok)
				return {
					...invalid(...intentResult.errors),
					rootDir: root,
					writtenPaths,
					...disabledEvidenceAuthority,
				};
			const target = safeJoin(root, intent.path);
			const temp = safeJoin(root, intent.tempPath);
			if (seenTargets.has(target))
				return {
					...invalid("session evidence batch contains duplicate target path"),
					rootDir: root,
					writtenPaths,
					...disabledEvidenceAuthority,
				};
			if (seenTemps.has(temp))
				return {
					...invalid("session evidence batch contains duplicate temp path"),
					rootDir: root,
					writtenPaths,
					...disabledEvidenceAuthority,
				};
			if (dirname(target) !== dirname(temp))
				return {
					...invalid("session evidence tempPath must stay beside target path"),
					rootDir: root,
					writtenPaths,
					...disabledEvidenceAuthority,
				};
			seenTargets.add(target);
			seenTemps.add(temp);
		}
		for (const intent of intents) {
			const target = safeJoin(root, intent.path);
			const temp = safeJoin(root, intent.tempPath);
			mkdirSync(dirname(target), { recursive: true });
			writeFileSync(temp, JSON.stringify(intent.record), "utf8");
			renameSync(temp, target);
			writtenPaths.push(intent.path);
		}
		return {
			...valid(),
			rootDir: root,
			writtenPaths,
			...disabledEvidenceAuthority,
		};
	} catch (error) {
		return {
			...invalid(
				error instanceof Error
					? error.message
					: "session evidence write failed",
			),
			rootDir: root,
			writtenPaths,
			...disabledEvidenceAuthority,
		};
	}
}

export interface FlowDeskSessionEvidenceReadOptionsV1 {
	workflowId: string;
	rootDir: string;
	rejectStaleAt?: string;
	expectedProfileRef?: string;
}

export function reloadFlowDeskSessionEvidenceV1(
	options: FlowDeskSessionEvidenceReadOptionsV1,
): FlowDeskSessionEvidenceReloadResultV1 {
	const workflowResult = validateOpaqueId(options.workflowId, "workflow_id");
	if (!workflowResult.ok) {
		return {
			ok: false,
			errors: workflowResult.errors,
			entries: [],
			blocked: [],
			...disabledEvidenceAuthority,
		};
	}
	if (typeof options.rootDir !== "string" || options.rootDir.length === 0) {
		return {
			ok: false,
			errors: ["rootDir is required"],
			entries: [],
			blocked: [],
			...disabledEvidenceAuthority,
		};
	}
	const entries: FlowDeskSessionEvidenceReloadEntryV1[] = [];
	const blocked: FlowDeskSessionEvidenceReloadResultV1["blocked"] = [];
	const errors: string[] = [];
	for (const evidenceClass of FLOWDESK_SESSION_EVIDENCE_CLASSES) {
		const relativeDir = sessionEvidenceDirectoryPath(
			options.workflowId,
			evidenceClass,
		);
		let absoluteDir: string;
		try {
			absoluteDir = safeJoin(options.rootDir, relativeDir);
		} catch (error) {
			errors.push(
				error instanceof Error
					? error.message
					: `evidence ${evidenceClass} root escape`,
			);
			continue;
		}
		if (!existsSync(absoluteDir)) continue;
		const stat = lstatSync(absoluteDir);
		if (stat.isSymbolicLink()) {
			errors.push(`evidence ${evidenceClass} root must not be a symlink`);
			continue;
		}
		if (!stat.isDirectory()) {
			errors.push(`evidence ${evidenceClass} target is not a directory`);
			continue;
		}
		const fileNames = readdirSync(absoluteDir).filter((name) =>
			name.endsWith(".json"),
		);
		for (const fileName of fileNames) {
			const evidenceId = fileName.slice(0, -5);
			const refValidation = validateOpaqueRef(
				evidenceId,
				`${evidenceClass}.evidence_id`,
			);
			if (!refValidation.ok) {
				blocked.push({
					evidenceClass,
					evidenceId,
					reason: refValidation.errors.join("; "),
					path: `${relativeDir}/${fileName}`,
				});
				continue;
			}
			const expectedRelative = sessionEvidenceRecordPath(
				options.workflowId,
				evidenceClass,
				evidenceId,
			);
			let filePath: string;
			try {
				filePath = safeJoin(options.rootDir, expectedRelative);
			} catch (error) {
				blocked.push({
					evidenceClass,
					evidenceId,
					reason:
						error instanceof Error ? error.message : "evidence path escape",
					path: expectedRelative,
				});
				continue;
			}
			let raw: string;
			try {
				raw = readFileSync(filePath, "utf8");
			} catch (error) {
				blocked.push({
					evidenceClass,
					evidenceId,
					reason:
						error instanceof Error ? error.message : "evidence read failed",
					path: expectedRelative,
				});
				continue;
			}
			let parsed: unknown;
			try {
				parsed = JSON.parse(raw);
			} catch (error) {
				blocked.push({
					evidenceClass,
					evidenceId,
					reason:
						error instanceof Error ? error.message : "evidence parse failed",
					path: expectedRelative,
				});
				continue;
			}
			if (!isRecordObject(parsed)) {
				blocked.push({
					evidenceClass,
					evidenceId,
					reason: "evidence must be an object",
					path: expectedRelative,
				});
				continue;
			}
			const shape = validateEvidenceShape(parsed, evidenceClass);
			if (!shape.ok) {
				blocked.push({
					evidenceClass,
					evidenceId,
					reason: shape.errors.join("; "),
					path: expectedRelative,
				});
				continue;
			}
			const alignment = ensureWorkflowAlignment(parsed, options.workflowId);
			if (!alignment.ok) {
				blocked.push({
					evidenceClass,
					evidenceId,
					reason: alignment.errors.join("; "),
					path: expectedRelative,
				});
				continue;
			}
			const profileAlignment = validateOptionalProfileAlignment(
				parsed,
				options.expectedProfileRef,
			);
			if (!profileAlignment.ok) {
				blocked.push({
					evidenceClass,
					evidenceId,
					reason: profileAlignment.errors.join("; "),
					path: expectedRelative,
				});
				continue;
			}
			const freshness = validateOptionalTimestampFreshness(
				parsed,
				options.rejectStaleAt,
			);
			if (!freshness.ok) {
				blocked.push({
					evidenceClass,
					evidenceId,
					reason: freshness.errors.join("; "),
					path: expectedRelative,
				});
				continue;
			}
			entries.push({
				evidenceClass,
				evidenceId,
				record: parsed,
				path: expectedRelative,
			});
		}
	}
	const reloadResult: FlowDeskSessionEvidenceReloadResultV1 = {
		ok: errors.length === 0,
		errors,
		entries,
		blocked,
		...disabledEvidenceAuthority,
	};
	return reloadResult;
}

export function summarizeFlowDeskSessionEvidenceInventoryV1(
	workflowId: string,
	reload: FlowDeskSessionEvidenceReloadResultV1,
): FlowDeskSessionEvidenceInventoryV1 {
	return {
		schema_version: "flowdesk.session_evidence_inventory.v1",
		workflow_id: workflowId,
		total_entries: reload.entries.length,
		total_blocked: reload.blocked.length,
		classes: FLOWDESK_SESSION_EVIDENCE_CLASSES.map((evidenceClass) => {
			const blocked = reload.blocked.filter(
				(entry) => entry.evidenceClass === evidenceClass,
			);
			return {
				evidenceClass,
				valid: reload.entries.filter(
					(entry) => entry.evidenceClass === evidenceClass,
				).length,
				blocked: blocked.length,
				...(blocked.length === 0
					? {}
					: { lastBlockedReason: blocked[blocked.length - 1].reason }),
			};
		}),
		...disabledEvidenceAuthority,
	};
}
