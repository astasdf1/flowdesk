import { readFileSync } from "node:fs";
import { resolve, sep } from "node:path";
import type {
	FlowDeskAttemptRecordV1,
	FlowDeskConfiguredVerificationResultV1,
	FlowDeskDebugExportManifestV1,
	FlowDeskEffectivePolicyV1,
	FlowDeskExternalAuthProviderPolicyResultV1,
	FlowDeskFallbackRegatePlanV1,
	FlowDeskLaneRecordV1,
	FlowDeskNonDispatchPermissionV1,
	FlowDeskPolicyPackV1,
	FlowDeskProductionApprovalDecisionV1,
	FlowDeskProductionEnablementEvaluationV1,
	FlowDeskProjectConfigV1,
	FlowDeskProviderHealthSnapshotV1,
	FlowDeskRelease1MinimumToolName,
	FlowDeskRetryPlanningInputV1,
	FlowDeskReviewerFanoutFromReloadedCacheEvidenceInputV1,
	FlowDeskReviewerFanoutFromReloadedCacheEvidencePlanV1,
	FlowDeskReviewerFanoutPlanV1,
	FlowDeskSanitizedAuthCaptureResultV1,
	FlowDeskStateWriteIntent,
	FlowDeskWorkflowActiveV1,
	FlowDeskWorkflowRecordV1,
	GuardBoundaryInputV1,
	ValidationResult,
	WorkflowTaxonomyV1,
} from "@flowdesk/core";
import {
	applyFlowDeskSessionEvidenceWriteIntentsV1,
	applyWriteIntentsToDurableState,
	applyWriteIntentsToInMemoryState,
	evaluateFlowDeskProductionEnablementV1,
	invalid,
	loadFlowDeskDurableWorkflowState,
	mergePolicyPacksV1,
	planFlowDeskReviewerFanoutFromReloadedCacheEvidenceV1,
	prepareAttemptRecordWriteIntent,
	prepareDebugExportManifestWriteIntent,
	prepareFlowDeskSessionEvidenceWriteIntentV1,
	prepareLaneRecordWriteIntent,
	prepareWorkflowActiveWriteIntent,
	prepareWorkflowRecordWriteIntent,
	reloadFlowDeskSessionEvidenceV1,
	valid,
	validatePolicyPackV1,
	validateProjectConfigV1,
} from "@flowdesk/core";
import type {
	FlowDeskCommandBackedHandlerContextV1,
	FlowDeskCommandBackedHandlerResultV1,
} from "./command-handlers.js";
import { evaluateFlowDeskCommandBackedHandlerV1 } from "./command-handlers.js";

export const flowdeskLocalNonDispatchAdapterProfile =
	"local_non_dispatch_command_adapter" as const;

export interface FlowDeskLocalNonDispatchAdapterStateSummaryV1 {
	workflowId?: string;
	workflowState?: FlowDeskWorkflowRecordV1["state"];
	pendingConfirmationStatus?:
		| "pending"
		| "consumed"
		| "cancelled"
		| "expired"
		| "missing";
	pendingConfirmationRef?: string;
	pendingConfirmationWorkflowId?: string;
	pendingConfirmationExpiresAt?: string;
	laneRecords: number;
	inMemoryStateEntries: number;
	durableStateMode: "memory_only" | "durable_flowdesk_root";
	durableStateWriteApplied: boolean;
	durableStateWrites: number;
	stateWriteApplied: boolean;
	permissionSource: "tool_boundary_injected";
	realOpenCodeDispatch: false;
	actualLaneLaunch: false;
	providerCall: false;
	runtimeExecution: false;
	fallbackAuthority: false;
	hardCancelOrNoReplyAuthority: false;
}

export interface FlowDeskLocalNonDispatchAdapterToolResultV1
	extends ValidationResult {
	adapterProfile: typeof flowdeskLocalNonDispatchAdapterProfile;
	toolName: FlowDeskRelease1MinimumToolName;
	handler: FlowDeskCommandBackedHandlerResultV1;
	localState: FlowDeskLocalNonDispatchAdapterStateSummaryV1;
	productionRegistrationEligible: false;
	realOpenCodeDispatch: false;
	actualLaneLaunch: false;
	providerCall: false;
	runtimeExecution: false;
	fallbackAuthority: false;
	hardCancelOrNoReplyAuthority: false;
}

export interface FlowDeskLocalNonDispatchAdapterSessionV1 {
	state: unknown;
	evaluate(
		toolName: FlowDeskRelease1MinimumToolName,
		request: unknown,
	): FlowDeskLocalNonDispatchAdapterToolResultV1;
}

export function hasFlowDeskLocalPlanningEvidenceV1(
	session: FlowDeskLocalNonDispatchAdapterSessionV1,
	workflowId?: string,
	sessionRef?: string,
): boolean {
	const state = isRecord(session.state) ? session.state : {};
	const workflow = isRecord(state.workflow) ? state.workflow : undefined;
	const laneRecords = Array.isArray(state.laneRecords) ? state.laneRecords : [];
	const workflowMatches =
		workflowId !== undefined
			? workflow?.workflow_id === workflowId
			: sessionRef === undefined || workflow?.session_ref === sessionRef;
	if (
		workflowMatches &&
		typeof workflow?.latest_plan_revision_id === "string" &&
		laneRecords.some(
			(lane) =>
				isRecord(lane) &&
				lane.lane_class === "planning_draft" &&
				(workflowId === undefined || lane.workflow_id === workflowId),
		)
	)
		return true;
	const rootDir =
		typeof state.durableStateRootDir === "string"
			? state.durableStateRootDir
			: undefined;
	if (rootDir === undefined || workflowId === undefined) return false;
	const loaded = loadFlowDeskDurableWorkflowState(rootDir, {
		workflowId,
		sessionId: "session-local",
	});
	if (!loaded.ok || loaded.snapshot === undefined) return false;
	return loaded.snapshot.laneRecords.some(
		(lane) =>
			lane.workflow_id === workflowId && lane.lane_class === "planning_draft",
	);
}

export type FlowDeskLocalNonDispatchPermissionProviderV1 = (input: {
	nowIso: string;
	expiresAtIso: string;
	workflowId: string;
	permissionClass: FlowDeskNonDispatchPermissionV1["permission_class"];
}) => FlowDeskNonDispatchPermissionV1;

export type FlowDeskLocalClockV1 = Date | (() => Date);

export interface FlowDeskLocalNonDispatchAdapterSessionOptionsV1 {
	durableStateRootDir?: string;
	projectConfig?: FlowDeskLocalProjectConfigFileOptionsV1;
	productionEnablement?: FlowDeskLocalProductionEnablementOptionsV1;
	reviewerFanoutDiagnostics?: FlowDeskLocalReviewerFanoutDiagnosticsOptionsV1;
}

export interface FlowDeskLocalProjectConfigFileOptionsV1 {
	enabled: true;
	rootDir: string;
	policyPackPaths?: readonly string[];
}

export interface FlowDeskLocalReviewerFanoutDiagnosticsOptionsV1
	extends Omit<
		FlowDeskReviewerFanoutFromReloadedCacheEvidenceInputV1,
		"reloadedEvidence" | "workflowId" | "requestedAt"
	> {
	enabled: true;
	requestedAt?: string;
	persistDerivedFanoutPlanEvidence?: boolean;
	fanoutPlanEvidenceId?: string;
}

export interface FlowDeskLocalProductionEnablementOptionsV1 {
	enabled: true;
	preDispatchAuditRef?: string;
	configuredVerificationRef?: string;
	configuredVerificationResult?: FlowDeskConfiguredVerificationResultV1;
	sanitizedAuthCaptureRef?: string;
	sanitizedAuthCaptureResult?: FlowDeskSanitizedAuthCaptureResultV1;
	externalAuthPolicyRef?: string;
	providerPolicyRef?: string;
	externalAuthProviderPolicyResult?: FlowDeskExternalAuthProviderPolicyResultV1;
	laneConformanceRefs?: string[];
	allowIncompleteConformance?: boolean;
	approvalDecision?: FlowDeskProductionApprovalDecisionV1;
}

interface LocalAdapterState {
	active?: FlowDeskWorkflowActiveV1;
	workflow?: FlowDeskWorkflowRecordV1;
	currentAttempt?: FlowDeskAttemptRecordV1;
	laneRecords: FlowDeskLaneRecordV1[];
	inMemoryState: Map<string, string>;
	pendingConfirmation?: LocalPendingConfirmation;
	durableStateRootDir?: string;
	productionEnablement?: FlowDeskLocalProductionEnablementOptionsV1;
	reviewerFanoutDiagnostics?: FlowDeskLocalReviewerFanoutDiagnosticsOptionsV1;
	policyContext: LocalPolicyContext;
	durableStateWrites: number;
	lastDurableStateWriteApplied: boolean;
	lastDurableStateReadErrors: string[];
}

interface LocalPolicyContext {
	config: FlowDeskProjectConfigV1;
	policyPacks: FlowDeskPolicyPackV1[];
	effectivePolicy: FlowDeskEffectivePolicyV1;
	configHash: string;
	policyPackId: string;
	policyPackHash: string;
	policyPackHashes: string[];
	projectRootRef: string;
	auditRef: string;
	scopeRef: string;
	errors: string[];
}

interface LocalPendingConfirmation {
	status: "pending" | "consumed" | "cancelled" | "expired";
	approvalRef: string;
	workflowId: string;
	sessionRef?: string;
	redactedIntakeRef?: string;
	sourceSummaryHash: string;
	planRevisionId: string;
	createdAtIso: string;
	expiresAtIso: string;
	consumedAtIso?: string;
	cancelledAtIso?: string;
}

const disabledAuthority = {
	productionRegistrationEligible: false,
	realOpenCodeDispatch: false,
	actualLaneLaunch: false,
	providerCall: false,
	runtimeExecution: false,
	fallbackAuthority: false,
	hardCancelOrNoReplyAuthority: false,
} as const;

const taxonomy: WorkflowTaxonomyV1 = {
	primary_category: "coding",
	difficulty_drivers: ["local non-dispatch adapter"],
	coupling_scope: "few_files",
	algorithmic_hardness: "low",
	architecture_hardness: "low",
	migration_state_hardness: "none",
	domain_uncertainty: "low",
	verification_hardness: "low",
	operational_risk: "low",
	policy_professional_boundary: "ordinary",
};

function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === "object" && value !== null && !Array.isArray(value);
}

function safeToken(value: unknown, fallback: string): string {
	const raw = typeof value === "string" && value.length > 0 ? value : fallback;
	const token = raw.replaceAll(/[^A-Za-z0-9_.:-]/g, "-").slice(0, 80);
	return token.length > 0 ? token : fallback;
}

function safeHash(value: unknown): string {
	const source = typeof value === "string" ? value.trim().slice(0, 500) : "";
	let hash = 2166136261;
	for (const char of source) {
		hash ^= char.charCodeAt(0);
		hash = Math.imul(hash, 16777619);
	}
	return `summary-${(hash >>> 0).toString(16).padStart(8, "0")}`;
}

function id(
	prefix: string,
	request: Record<string, unknown>,
	fallback = "local",
): string {
	return `${prefix}-${safeToken(request.request_id ?? request.workflow_id, fallback)}`;
}

function workflowIdFrom(request: unknown): string {
	return isRecord(request) &&
		typeof request.workflow_id === "string" &&
		request.workflow_id.length > 0
		? request.workflow_id
		: "workflow-local";
}

function nowParts(now = new Date()): {
	nowIso: string;
	expiresAtIso: string;
	nowMs: number;
} {
	const nowMs = now.getTime();
	return {
		nowIso: now.toISOString(),
		expiresAtIso: new Date(nowMs + 24 * 60 * 60 * 1000).toISOString(),
		nowMs,
	};
}

function retention() {
	return {
		session_records_max_days: 14,
		debug_staging_max_days: 7,
		conformance_summary_max_days: 30,
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

function providerHealthPolicy() {
	return {
		health_freshness_ttl_minutes: 10,
		unavailable_dispatchability: "non_dispatchable" as const,
		degraded_dispatchability: "diagnostic_only" as const,
		opencode_go_usage_without_official_quota: "unknown" as const,
		z_ai_usage_without_official_quota: "unknown" as const,
		allow_automatic_provider_fallback: false as const,
	};
}

function projectConfig(
	parts: ReturnType<typeof nowParts>,
): FlowDeskProjectConfigV1 {
	return {
		schema_version: "flowdesk.project_config.v1",
		config_id: "config-local",
		created_at: parts.nowIso,
		updated_at: parts.nowIso,
		release_mode: "release1",
		project_root_ref: "project-root-local",
		config_hash: "config-hash-local",
		policy_pack_refs: ["policy-ref-local"],
		policy_pack_hashes: ["policy-hash-local"],
		chat_intake_mode: "steering",
		hook_harness_mode: "enforce",
		retention: retention(),
		usage_policy: usagePolicy(),
		provider_health_policy: providerHealthPolicy(),
		disabled_modes: [
			"real_dispatch",
			"managed_fallback",
			"lane_launch",
			"hard_chat_blocking",
		],
		extension_namespaces: ["flowdesk.project"],
		audit_refs: ["audit-local"],
	};
}

function policyPack(): FlowDeskPolicyPackV1 {
	return {
		schema_version: "flowdesk.policy_pack.v1",
		policy_pack_id: "policy-local",
		policy_pack_hash: "policy-hash-local",
		name: "Local non-dispatch policy",
		version: "1.0.0",
		source_ref: "policy-source-local",
		applies_to_release_modes: ["release1"],
		priority: 1,
		rules: [
			{
				rule_id: "rule-local-approval",
				effect: "require_approval",
				target: "permission_class",
				summary_label: "Require scoped non-dispatch approval for local writes.",
				refs: ["approval-local"],
			},
		],
		hard_ban_refs: ["ban-real-dispatch-local"],
		allowed_extension_namespaces: ["flowdesk.project"],
		redaction_baseline_ref: "redaction-local",
	};
}

function defaultLocalPolicyContext(
	parts: ReturnType<typeof nowParts>,
	errors: string[] = [],
): LocalPolicyContext {
	const config = projectConfig(parts);
	const packs = [policyPack()];
	return {
		config,
		policyPacks: packs,
		effectivePolicy: mergePolicyPacksV1(config, packs, {
			effectivePolicyId: "effective-local",
			computedAt: parts.nowIso,
			auditRef: "audit-local",
		}),
		configHash: config.config_hash,
		policyPackId: packs[0].policy_pack_id,
		policyPackHash: packs[0].policy_pack_hash,
		policyPackHashes: packs.map((pack) => pack.policy_pack_hash),
		projectRootRef: config.project_root_ref,
		auditRef: "audit-local",
		scopeRef: "scope-local",
		errors,
	};
}

function resolveInsideRoot(
	rootDir: string,
	relativeOrAbsolutePath: string,
): string | undefined {
	const root = resolve(rootDir);
	const target = resolve(root, relativeOrAbsolutePath);
	return target === root || target.startsWith(`${root}${sep}`)
		? target
		: undefined;
}

function parseJsonFile(path: string): { value?: unknown; error?: string } {
	try {
		return { value: JSON.parse(readFileSync(path, "utf8")) as unknown };
	} catch (error) {
		const code =
			error instanceof Error && "code" in error
				? String((error as { code?: unknown }).code)
				: "read_or_parse_failed";
		return {
			error:
				code === "ENOENT" ? "file_missing" : "file_unreadable_or_invalid_json",
		};
	}
}

function loadLocalPolicyContext(
	parts: ReturnType<typeof nowParts>,
	options?: FlowDeskLocalProjectConfigFileOptionsV1,
): LocalPolicyContext {
	if (options?.enabled !== true) return defaultLocalPolicyContext(parts);
	const rootDir =
		typeof options.rootDir === "string" && options.rootDir.trim().length > 0
			? options.rootDir
			: undefined;
	if (rootDir === undefined)
		return defaultLocalPolicyContext(parts, ["project_config_root_missing"]);
	const configPath = resolveInsideRoot(rootDir, ".flowdesk/config.json");
	if (configPath === undefined)
		return defaultLocalPolicyContext(parts, ["project_config_path_unsafe"]);
	const configJson = parseJsonFile(configPath);
	if (configJson.error !== undefined)
		return defaultLocalPolicyContext(parts, [
			`project_config_${configJson.error}`,
		]);
	const configValidation = validateProjectConfigV1(configJson.value);
	if (!configValidation.ok)
		return defaultLocalPolicyContext(
			parts,
			configValidation.errors.map((error) => `project_config_${error}`),
		);
	const config = configJson.value as FlowDeskProjectConfigV1;
	const policyPackPaths = options.policyPackPaths ?? [];
	if (policyPackPaths.length !== config.policy_pack_hashes.length)
		return defaultLocalPolicyContext(parts, [
			"policy_pack_file_count_mismatch",
		]);
	const policyPacks: FlowDeskPolicyPackV1[] = [];
	const errors: string[] = [];
	for (const [index, policyPackPath] of policyPackPaths.entries()) {
		if (
			typeof policyPackPath !== "string" ||
			policyPackPath.trim().length === 0
		) {
			errors.push(`policy_pack_path_${index}_invalid`);
			continue;
		}
		const resolved = resolveInsideRoot(rootDir, policyPackPath);
		if (resolved === undefined) {
			errors.push(`policy_pack_path_${index}_unsafe`);
			continue;
		}
		const policyJson = parseJsonFile(resolved);
		if (policyJson.error !== undefined) {
			errors.push(`policy_pack_${index}_${policyJson.error}`);
			continue;
		}
		const policyValidation = validatePolicyPackV1(policyJson.value, {
			expectedPolicyPackHashes: config.policy_pack_hashes,
		});
		if (!policyValidation.ok) {
			errors.push(
				...policyValidation.errors.map(
					(error) => `policy_pack_${index}_${error}`,
				),
			);
			continue;
		}
		policyPacks.push(policyJson.value as FlowDeskPolicyPackV1);
	}
	const loadedHashes = policyPacks.map((pack) => pack.policy_pack_hash);
	for (const expectedHash of config.policy_pack_hashes) {
		if (!loadedHashes.includes(expectedHash))
			errors.push(`policy_pack_hash_not_loaded_${expectedHash}`);
	}
	if (errors.length > 0) return defaultLocalPolicyContext(parts, errors);
	const auditRef = config.audit_refs[0] ?? "audit-local";
	const effectivePolicy = mergePolicyPacksV1(config, policyPacks, {
		effectivePolicyId: `effective-${config.config_id}`,
		computedAt: parts.nowIso,
		auditRef,
	});
	return {
		config,
		policyPacks,
		effectivePolicy,
		configHash: config.config_hash,
		policyPackId: policyPacks[0]?.policy_pack_id ?? "policy-none",
		policyPackHash: policyPacks[0]?.policy_pack_hash ?? "policy-none",
		policyPackHashes: policyPacks.map((pack) => pack.policy_pack_hash),
		projectRootRef: config.project_root_ref,
		auditRef,
		scopeRef: "scope-local",
		errors: [],
	};
}

export function createFlowDeskLocalNonDispatchPermissionProvider(): FlowDeskLocalNonDispatchPermissionProviderV1 {
	return ({ nowIso, expiresAtIso, workflowId, permissionClass }) => ({
		schema_version: "flowdesk.non_dispatch_permission.v1",
		permission_id: `permission-${permissionClass}`,
		permission_class: permissionClass,
		workflow_id: workflowId,
		scope_ref: "scope-local",
		grant_source: "typed_confirmation",
		created_at: nowIso,
		expires_at: expiresAtIso,
		config_hash: "config-hash-local",
		policy_pack_hash: "policy-hash-local",
		release_mode: "release1",
		audit_ref: "audit-local",
	});
}

function permission(
	provider: FlowDeskLocalNonDispatchPermissionProviderV1,
	parts: ReturnType<typeof nowParts>,
	workflowId: string,
	permissionClass: FlowDeskNonDispatchPermissionV1["permission_class"],
	policyContext: LocalPolicyContext,
): FlowDeskNonDispatchPermissionV1 {
	return {
		...provider({
			nowIso: parts.nowIso,
			expiresAtIso: parts.expiresAtIso,
			workflowId,
			permissionClass,
		}),
		scope_ref: policyContext.scopeRef,
		config_hash: policyContext.configHash,
		policy_pack_hash: policyContext.policyPackHash,
		audit_ref: policyContext.auditRef,
	};
}

function guardBoundary(
	provider: FlowDeskLocalNonDispatchPermissionProviderV1,
	parts: ReturnType<typeof nowParts>,
	workflowId: string,
	permissionClass: FlowDeskNonDispatchPermissionV1["permission_class"],
	policyContext: LocalPolicyContext,
): Omit<GuardBoundaryInputV1, "operation" | "workflowId"> {
	return {
		configHash: policyContext.configHash,
		scopeRef: policyContext.scopeRef,
		policy: policyContext.effectivePolicy,
		auditRef: policyContext.auditRef,
		conformanceRef: "conformance-local-non-dispatch",
		runtimeCapabilityRef: "runtime-local-fake",
		nonDispatchPermission: permission(
			provider,
			parts,
			workflowId,
			permissionClass,
			policyContext,
		),
		now: parts.nowMs,
	};
}

function providerHealth(
	parts: ReturnType<typeof nowParts>,
): FlowDeskProviderHealthSnapshotV1 {
	return {
		schema_version: "flowdesk.provider_health_snapshot.v1",
		snapshot_id: "health-local",
		provider_family: "opencode_go",
		model_family: "unknown",
		observed_at: parts.nowIso,
		freshness: "fresh",
		freshness_ttl: 5,
		source_surface: "doctor_probe",
		availability_state: "healthy",
		failure_class: "none",
		dispatchability: "diagnostic_only",
		source_ref: "health-local-source",
		safe_remediation:
			"Use FlowDesk local non-dispatch diagnostics before any retry.",
	};
}

function makePlanContext(
	request: Record<string, unknown>,
	parts: ReturnType<typeof nowParts>,
): NonNullable<FlowDeskCommandBackedHandlerContextV1["plan"]> {
	const workflowId = workflowIdFrom(request);
	return {
		sessionId: "session-local",
		workflowId,
		planRevisionId: id("plan", request),
		planningStepId: id("step-plan", request),
		laneId: id("lane-plan", request),
		laneTaskRef: id("task-plan", request),
		laneSummaryRef: id("lane-summary", request),
		laneEventRef: id("event-plan", request),
		auditRef: "audit-local",
		routeRef: id("route", request),
		nowIso: parts.nowIso,
		taxonomy,
	};
}

function laneObservabilityRefFor(
	request: Record<string, unknown>,
	laneClass: FlowDeskLaneRecordV1["lane_class"],
): string {
	return laneClass === "planning_draft"
		? id("lane-observability", request)
		: id("lane-observability-run", request);
}

function makeRunContext(
	request: Record<string, unknown>,
	parts: ReturnType<typeof nowParts>,
	permissionProvider: FlowDeskLocalNonDispatchPermissionProviderV1,
	policyContext: LocalPolicyContext,
): NonNullable<FlowDeskCommandBackedHandlerContextV1["run"]> {
	const workflowId = workflowIdFrom(request);
	const runMode = request.run_mode;
	if (runMode === "guarded-dry-run") {
		return {
			guardedDryRun: {
				guardBoundary: guardBoundary(
					permissionProvider,
					parts,
					workflowId,
					"audit_write",
					policyContext,
				),
				sessionId: "session-local",
				attemptId: id("attempt", request),
				auditEventId: id("event-audit", request),
				nowIso: parts.nowIso,
				decisionRef: id("decision", request),
				routeRef: id("route", request),
				commandShapeHash: id("shape", request),
				runResultRef: id("run-result", request),
				verificationSummaryRef: id("verification", request),
				redactionVersion: "redaction-v1",
			},
		};
	}
	if (runMode === "managed-dispatch") return {};
	return {
		fakeRuntime: {
			guardBoundary: guardBoundary(
				permissionProvider,
				parts,
				workflowId,
				"fake_runtime_write",
				policyContext,
			),
			auditWritePermission: permission(
				permissionProvider,
				parts,
				workflowId,
				"audit_write",
				policyContext,
			),
			stateWritePermission: permission(
				permissionProvider,
				parts,
				workflowId,
				"state_write",
				policyContext,
			),
			sessionId: "session-local",
			attemptId: id("attempt", request),
			auditEventId: id("event-audit", request),
			outcomeAuditEventId: id("event-outcome", request),
			nowIso: parts.nowIso,
			decisionRef: id("decision", request),
			routeRef: id("route", request),
			commandShapeHash: id("shape", request),
			runResultRef: id("run-result", request),
			runtimeEchoEvidenceRef: id("runtime-echo", request),
			verificationSummaryRef: id("verification", request),
			outcomeAuditRef: "audit-outcome-local",
			redactionVersion: "redaction-v1",
			laneId: id("lane-run", request),
			laneTaskRef: id("task-run", request),
			laneSummaryRef: id("lane-summary-run", request),
			laneObservabilityRef: laneObservabilityRefFor(request, "verification"),
			laneEventRef: id("event-run", request),
			laneDebugRef: "debug-local",
		},
	};
}

function laneRecordFor(
	request: Record<string, unknown>,
	parts: ReturnType<typeof nowParts>,
	laneClass: FlowDeskLaneRecordV1["lane_class"],
): FlowDeskLaneRecordV1 {
	const workflowId = workflowIdFrom(request);
	const planRevisionId =
		typeof request.plan_revision_id === "string"
			? request.plan_revision_id
			: id("plan", request);
	const observabilityRef = laneObservabilityRefFor(request, laneClass);
	return {
		schema_version: "flowdesk.lane_record.v1",
		lane_id:
			laneClass === "planning_draft"
				? id("lane-plan", request)
				: id("lane-run", request),
		workflow_id: workflowId,
		plan_revision_id: planRevisionId,
		...(laneClass === "verification"
			? { attempt_id: id("attempt", request) }
			: {}),
		task_ref:
			laneClass === "planning_draft"
				? id("task-plan", request)
				: id("task-run", request),
		lane_class: laneClass,
		state: "completed",
		created_at: parts.nowIso,
		started_at: parts.nowIso,
		updated_at: parts.nowIso,
		completed_at: parts.nowIso,
		safe_next_action: "/flowdesk-status",
		refs: [
			laneClass === "planning_draft"
				? id("lane-summary", request)
				: id("lane-summary-run", request),
			observabilityRef,
		],
		event_refs: [
			laneClass === "planning_draft"
				? id("event-plan", request)
				: id("event-run", request),
		],
		audit_refs: ["audit-local"],
		observability_ref: observabilityRef,
		...(laneClass === "verification" ? { debug_ref: "debug-local" } : {}),
	};
}

function requiresRunConfirmation(request: Record<string, unknown>): boolean {
	return (
		typeof request.risk_hint === "string" &&
		/requires explicit user confirmation/i.test(request.risk_hint)
	);
}

function pendingApprovalRef(request: Record<string, unknown>): string {
	return id("approval", request);
}

function pendingExpiresAt(parts: ReturnType<typeof nowParts>): string {
	return new Date(parts.nowMs + 15 * 60 * 1000).toISOString();
}

function createPendingConfirmation(
	request: Record<string, unknown>,
	parts: ReturnType<typeof nowParts>,
	planRevisionId: string,
): LocalPendingConfirmation {
	return {
		status: "pending",
		approvalRef: pendingApprovalRef(request),
		workflowId: workflowIdFrom(request),
		...(typeof request.session_ref === "string"
			? { sessionRef: request.session_ref }
			: {}),
		...(typeof request.redacted_intake_ref === "string"
			? { redactedIntakeRef: request.redacted_intake_ref }
			: {}),
		sourceSummaryHash: safeHash(request.goal_summary ?? request.intake_summary),
		planRevisionId,
		createdAtIso: parts.nowIso,
		expiresAtIso: pendingExpiresAt(parts),
	};
}

function matchesOptionalScope(
	expected: string | undefined,
	actual: unknown,
): boolean {
	return expected === undefined || actual === expected;
}

function validatePendingConfirmation(
	state: LocalAdapterState,
	request: Record<string, unknown>,
	parts: ReturnType<typeof nowParts>,
): ValidationResult {
	const pending = state.pendingConfirmation;
	if (pending === undefined)
		return invalid("pending confirmation is required before chat-routed run");
	if (pending.status !== "pending")
		return invalid(`pending confirmation is ${pending.status}`);
	if (Date.parse(pending.expiresAtIso) <= parts.nowMs) {
		pending.status = "expired";
		return invalid("pending confirmation expired");
	}
	const summaryMatches =
		pending.sourceSummaryHash ===
		safeHash(request.goal_summary ?? request.intake_summary);
	const sourceRefMatches =
		pending.redactedIntakeRef !== undefined &&
		request.redacted_intake_ref === pending.redactedIntakeRef;
	const errors: string[] = [];
	if (request.user_approval_ref !== pending.approvalRef)
		errors.push("user_approval_ref does not match pending confirmation");
	if (workflowIdFrom(request) !== pending.workflowId)
		errors.push("workflow_id does not match pending confirmation");
	if (!matchesOptionalScope(pending.sessionRef, request.session_ref))
		errors.push("session_ref does not match pending confirmation");
	if (!summaryMatches && !sourceRefMatches)
		errors.push("approval source does not match pending confirmation");
	return errors.length === 0 ? valid() : invalid(...errors);
}

function shouldGateRun(
	state: LocalAdapterState,
	request: Record<string, unknown>,
): boolean {
	return (
		request.input_mode === "chat_routed" ||
		state.workflow?.state === "plan_pending_approval"
	);
}

function consumePendingConfirmation(
	state: LocalAdapterState,
	parts: ReturnType<typeof nowParts>,
): void {
	if (state.pendingConfirmation !== undefined) {
		state.pendingConfirmation = {
			...state.pendingConfirmation,
			status: "consumed",
			consumedAtIso: parts.nowIso,
		};
	}
}

function cancelPendingConfirmation(
	state: LocalAdapterState,
	request: Record<string, unknown>,
	parts: ReturnType<typeof nowParts>,
): void {
	const pending = state.pendingConfirmation;
	if (pending === undefined || pending.status !== "pending") return;
	if (workflowIdFrom(request) !== pending.workflowId) return;
	if (!matchesOptionalScope(pending.sessionRef, request.session_ref)) return;
	state.pendingConfirmation = {
		...pending,
		status: "cancelled",
		cancelledAtIso: parts.nowIso,
	};
}

function applyAdapterWriteIntents(
	state: LocalAdapterState,
	intents: readonly FlowDeskStateWriteIntent[],
	parts: ReturnType<typeof nowParts>,
): boolean {
	try {
		if (state.durableStateRootDir !== undefined) {
			const durableResult = applyWriteIntentsToDurableState(
				state.durableStateRootDir,
				intents,
				{ now: parts.nowMs },
			);
			state.lastDurableStateWriteApplied = durableResult.ok;
			if (!durableResult.ok) return false;
			state.durableStateWrites += durableResult.writtenPaths?.length ?? 0;
		} else {
			state.lastDurableStateWriteApplied = false;
		}
		state.inMemoryState = applyWriteIntentsToInMemoryState(
			intents,
			state.inMemoryState,
			{ now: parts.nowMs },
		);
		return true;
	} catch {
		state.lastDurableStateWriteApplied = false;
		return false;
	}
}

function updateWorkflowState(
	state: LocalAdapterState,
	request: Record<string, unknown>,
	parts: ReturnType<typeof nowParts>,
	nextState: FlowDeskWorkflowRecordV1["state"],
): boolean {
	const workflowId = workflowIdFrom(request);
	const planRevisionId =
		typeof request.plan_revision_id === "string"
			? request.plan_revision_id
			: id("plan", request);
	const laneRefs = state.laneRecords.flatMap((record) => record.refs);
	const pendingConfirmation = nextState === "plan_pending_approval";
	const workflow: FlowDeskWorkflowRecordV1 = {
		schema_version: "flowdesk.workflow_record.v1",
		workflow_id: workflowId,
		session_ref:
			typeof request.session_ref === "string"
				? request.session_ref
				: "session-local-ref",
		created_at: state.workflow?.created_at ?? parts.nowIso,
		updated_at: parts.nowIso,
		state: nextState,
		latest_plan_revision_id: planRevisionId,
		current_step_id:
			typeof request.step_id === "string"
				? request.step_id
				: id("step-plan", request),
		project_root_ref: state.policyContext.projectRootRef,
		config_hash: state.policyContext.configHash,
		policy_pack_id: state.policyContext.policyPackId,
		policy_pack_hash: state.policyContext.policyPackHash,
		...(nextState === "complete"
			? { current_attempt_id: id("attempt", request) }
			: {}),
		attempt_refs: nextState === "complete" ? [id("attempt", request)] : [],
		checkpoint_refs: [],
		lane_refs: laneRefs,
		latest_lane_summary_refs: laneRefs,
		audit_refs: [state.policyContext.auditRef],
		status_summary_ref: "status-summary-local",
		artifact_disposition: "quarantined",
		...(pendingConfirmation
			? {
					blocker_summary: {
						category: "policy",
						summary:
							"Execution-like chat intake is waiting for explicit user confirmation before any run.",
						safe_remediation:
							"Review the FlowDesk plan and provide typed confirmation before using /flowdesk-run.",
						refs: [id("confirmation-pending", request)],
					},
				}
			: {}),
		safe_next_actions: pendingConfirmation
			? ["/flowdesk-plan", "/flowdesk-status"]
			: ["/flowdesk-status"],
	};
	const active: FlowDeskWorkflowActiveV1 = {
		schema_version: "flowdesk.workflow_active.v1",
		active_workflow_id: workflowId,
		...(nextState === "complete"
			? { active_attempt_id: id("attempt", request) }
			: {}),
		state: nextState,
		updated_at: parts.nowIso,
		status_summary_ref: "status-summary-local",
		audit_refs: [state.policyContext.auditRef],
	};
	const intents = [
		prepareWorkflowActiveWriteIntent(active).writeIntent,
		prepareWorkflowRecordWriteIntent(workflow).writeIntent,
	].filter(
		(intent): intent is NonNullable<typeof intent> => intent !== undefined,
	);
	if (intents.length !== 2) return false;
	if (!applyAdapterWriteIntents(state, intents, parts)) return false;
	state.active = active;
	state.workflow = workflow;
	return true;
}

function recordPlanningState(
	state: LocalAdapterState,
	request: Record<string, unknown>,
	parts: ReturnType<typeof nowParts>,
): boolean {
	const lane = laneRecordFor(request, parts, "planning_draft");
	const laneIntent = prepareLaneRecordWriteIntent(
		"session-local",
		lane,
	).writeIntent;
	if (laneIntent === undefined) return false;
	if (!applyAdapterWriteIntents(state, [laneIntent], parts)) return false;
	const previousLaneRecords = state.laneRecords;
	state.laneRecords = [lane];
	const pendingConfirmation = requiresRunConfirmation(request);
	if (
		!updateWorkflowState(
			state,
			request,
			parts,
			pendingConfirmation ? "plan_pending_approval" : "ready_to_run",
		)
	) {
		state.laneRecords = previousLaneRecords;
		return false;
	}
	if (pendingConfirmation)
		state.pendingConfirmation = createPendingConfirmation(
			request,
			parts,
			typeof request.plan_revision_id === "string"
				? request.plan_revision_id
				: id("plan", request),
		);
	return true;
}

function recordRunState(
	state: LocalAdapterState,
	request: Record<string, unknown>,
	parts: ReturnType<typeof nowParts>,
	permissionProvider: FlowDeskLocalNonDispatchPermissionProviderV1,
): boolean {
	const workflowId = workflowIdFrom(request);
	const attempt: FlowDeskAttemptRecordV1 = {
		schema_version: "flowdesk.attempt_record.v1",
		attempt_id: id("attempt", request),
		workflow_id: workflowId,
		...(typeof request.step_id === "string"
			? { step_id: request.step_id }
			: {}),
		created_at: parts.nowIso,
		updated_at: parts.nowIso,
		run_mode:
			request.run_mode === "guarded-dry-run"
				? "guarded-dry-run"
				: "fake-runtime",
		state_at_start: "ready_to_run",
		state_at_end: "complete",
		attempt_state: "complete",
		guard_decision_ref: id("decision", request),
		non_dispatch_permission_ref: permission(
			permissionProvider,
			parts,
			workflowId,
			request.run_mode === "guarded-dry-run"
				? "audit_write"
				: "fake_runtime_write",
			state.policyContext,
		).permission_id,
		command_shape_hash: id("shape", request),
		runtime_capability_ref: "runtime-local-fake",
		pre_run_audit_ref: state.policyContext.auditRef,
		runtime_echo_validation: "not_applicable",
		verification_ref: id("verification", request),
		artifact_disposition: "quarantined",
		outcome_audit_ref: "audit-outcome-local",
		safe_next_actions: ["/flowdesk-status", "/flowdesk-export-debug"],
	};
	const lane = laneRecordFor(request, parts, "verification");
	const attemptIntent = prepareAttemptRecordWriteIntent(attempt).writeIntent;
	const laneIntent = prepareLaneRecordWriteIntent(
		"session-local",
		lane,
	).writeIntent;
	if (attemptIntent === undefined || laneIntent === undefined) return false;
	if (!applyAdapterWriteIntents(state, [attemptIntent, laneIntent], parts))
		return false;
	const previousAttempt = state.currentAttempt;
	const previousLaneRecords = state.laneRecords;
	state.currentAttempt = attempt;
	state.laneRecords = [
		...state.laneRecords.filter((record) => record.lane_id !== lane.lane_id),
		lane,
	];
	if (!updateWorkflowState(state, request, parts, "complete")) {
		state.currentAttempt = previousAttempt;
		state.laneRecords = previousLaneRecords;
		return false;
	}
	return true;
}

function recordDebugExportManifestState(
	state: LocalAdapterState,
	request: Record<string, unknown>,
	response: unknown,
	parts: ReturnType<typeof nowParts>,
): boolean {
	if (!isRecord(response)) return false;
	const exportId = safeToken(
		response.export_manifest_ref,
		id("debug-export", request),
	);
	const includedSections = Array.isArray(response.included_sections)
		? response.included_sections
		: [];
	const manifest: FlowDeskDebugExportManifestV1 = {
		schema_version: "flowdesk.debug_export_manifest.v1",
		export_id: exportId,
		manifest_ref: safeToken(
			response.export_manifest_ref,
			`manifest-${exportId}`,
		),
		...(typeof request.workflow_id === "string"
			? { workflow_id: request.workflow_id }
			: {}),
		...(typeof request.session_ref === "string"
			? { session_ref: request.session_ref }
			: {}),
		created_at: parts.nowIso,
		delete_after:
			typeof response.delete_after === "string"
				? response.delete_after
				: parts.expiresAtIso,
		included_sections:
			includedSections as FlowDeskDebugExportManifestV1["included_sections"],
		redaction_version: "redaction-v1",
		source_refs: [
			safeToken(request.redacted_intake_ref, "debug-export-request"),
		],
		file_count: 0,
		byte_count: 0,
		warnings: [],
		deletion_state:
			request.retention_hint === "delete_after_export"
				? "deleted"
				: "retained_by_policy",
		...(request.retention_hint === "delete_after_export"
			? { deletion_proof_ref: `deletion-${exportId}` }
			: {}),
		audit_refs: ["audit-local"],
	};
	const intent = prepareDebugExportManifestWriteIntent(
		"session-local",
		manifest,
	).writeIntent;
	if (intent === undefined) return false;
	return applyAdapterWriteIntents(state, [intent], parts);
}

function fallbackRegatePlanContext(
	state: LocalAdapterState,
	request: Record<string, unknown>,
): FlowDeskFallbackRegatePlanV1 | undefined {
	if (state.durableStateRootDir === undefined) return undefined;
	const workflowId = workflowIdFrom(request);
	const evidenceReload = reloadFlowDeskSessionEvidenceV1({
		workflowId,
		rootDir: state.durableStateRootDir,
	});
	const entry = evidenceReload.entries.find(
		(e) => e.evidenceClass === "fallback_regate_plan",
	);
	return entry?.record as FlowDeskFallbackRegatePlanV1 | undefined;
}

function statusContext(
	state: LocalAdapterState,
	request: Record<string, unknown>,
	parts: ReturnType<typeof nowParts>,
): NonNullable<FlowDeskCommandBackedHandlerContextV1["status"]> {
	const requestedWorkflowId = workflowIdFrom(request);
	if (
		state.durableStateRootDir !== undefined &&
		(state.workflow === undefined ||
			state.workflow.workflow_id !== requestedWorkflowId)
	) {
		const loaded = loadFlowDeskDurableWorkflowState(state.durableStateRootDir, {
			workflowId: requestedWorkflowId,
			sessionId: "session-local",
			now: parts.nowMs,
		});
		state.lastDurableStateReadErrors = loaded.ok ? [] : loaded.errors;
		if (loaded.ok && loaded.snapshot !== undefined) {
			state.active = loaded.snapshot.active;
			state.workflow = loaded.snapshot.workflow;
			state.currentAttempt = loaded.snapshot.currentAttempt;
			state.laneRecords = loaded.snapshot.laneRecords;
		}
	} else {
		state.lastDurableStateReadErrors = [];
	}
	if (
		state.lastDurableStateReadErrors.length === 0 &&
		(state.workflow === undefined || state.active === undefined)
	)
		updateWorkflowState(state, request, parts, "ready_to_run");
	const fanoutDiagnostics = reviewerFanoutDiagnosticsContext(
		state,
		request,
		parts,
	);
	return {
		active: state.active,
		workflow: state.workflow,
		...(state.currentAttempt === undefined
			? {}
			: { currentAttempt: state.currentAttempt }),
		laneRecords: state.laneRecords,
		providerHealthSnapshot: providerHealth(parts),
		...(fanoutDiagnostics?.selection.cacheRefreshPlan === undefined
			? {}
			: {
					exactModelAvailabilityCacheRefreshPlan:
						fanoutDiagnostics.selection.cacheRefreshPlan,
				}),
		...(fanoutDiagnostics === undefined
			? {}
			: { reviewerFanoutPlan: fanoutDiagnostics.fanoutPlan }),
		auditRef: "audit-local",
		debugRef: "debug-local",
		now: parts.nowMs,
	};
}

function productionEnablementContext(
	state: LocalAdapterState,
	request: Record<string, unknown>,
): FlowDeskProductionEnablementEvaluationV1 | undefined {
	if (
		state.productionEnablement?.enabled !== true ||
		state.durableStateRootDir === undefined
	)
		return undefined;
	const workflowId = workflowIdFrom(request);
	const evidenceReload = reloadFlowDeskSessionEvidenceV1({
		workflowId,
		rootDir: state.durableStateRootDir,
	});
	return evaluateFlowDeskProductionEnablementV1({
		workflowId,
		evidenceReload,
		preDispatchAuditRef: state.productionEnablement.preDispatchAuditRef,
		configuredVerificationRef:
			state.productionEnablement.configuredVerificationRef,
		configuredVerificationResult:
			state.productionEnablement.configuredVerificationResult,
		sanitizedAuthCaptureRef: state.productionEnablement.sanitizedAuthCaptureRef,
		sanitizedAuthCaptureResult:
			state.productionEnablement.sanitizedAuthCaptureResult,
		externalAuthPolicyRef: state.productionEnablement.externalAuthPolicyRef,
		providerPolicyRef: state.productionEnablement.providerPolicyRef,
		externalAuthProviderPolicyResult:
			state.productionEnablement.externalAuthProviderPolicyResult,
		laneConformanceRefs: state.productionEnablement.laneConformanceRefs,
		allowIncompleteConformance:
			state.productionEnablement.allowIncompleteConformance,
		approvalDecision: state.productionEnablement.approvalDecision,
	});
}

function reviewerFanoutDiagnosticsContext(
	state: LocalAdapterState,
	request: Record<string, unknown>,
	parts: ReturnType<typeof nowParts>,
): FlowDeskReviewerFanoutFromReloadedCacheEvidencePlanV1 | undefined {
	if (
		state.reviewerFanoutDiagnostics?.enabled !== true ||
		state.durableStateRootDir === undefined
	)
		return undefined;
	const workflowId = workflowIdFrom(request);
	const reloadedEvidence = reloadFlowDeskSessionEvidenceV1({
		workflowId,
		rootDir: state.durableStateRootDir,
	});
	const plan = planFlowDeskReviewerFanoutFromReloadedCacheEvidenceV1({
		...state.reviewerFanoutDiagnostics,
		workflowId,
		reloadedEvidence,
		requestedAt: state.reviewerFanoutDiagnostics.requestedAt ?? parts.nowIso,
	});
	if (
		state.reviewerFanoutDiagnostics.persistDerivedFanoutPlanEvidence === true &&
		plan.state === "fanout_ready"
	) {
		const materialized = materializeReviewerFanoutPlanEvidence({
			rootDir: state.durableStateRootDir,
			workflowId,
			evidenceId:
				state.reviewerFanoutDiagnostics.fanoutPlanEvidenceId ??
				reviewerFanoutPlanEvidenceId(workflowId, plan.fanoutPlan),
			fanoutPlan: plan.fanoutPlan,
		});
		if (!materialized.ok)
			state.lastDurableStateReadErrors = materialized.errors;
	}
	return plan;
}

function reviewerFanoutPlanEvidenceId(
	workflowId: string,
	plan: FlowDeskReviewerFanoutPlanV1,
): string {
	return safeToken(
		`reviewer-fanout-plan-${workflowId}-${plan.attempt_id}-${plan.cache_id ?? "cache"}`,
		"reviewer-fanout-plan",
	);
}

function materializeReviewerFanoutPlanEvidence(input: {
	rootDir: string;
	workflowId: string;
	evidenceId: string;
	fanoutPlan: FlowDeskReviewerFanoutPlanV1;
}): ValidationResult {
	if (input.fanoutPlan.state !== "fanout_ready" || !input.fanoutPlan.ok)
		return invalid(
			"reviewer fanout plan evidence requires a ready fanout plan",
		);
	const prepared = prepareFlowDeskSessionEvidenceWriteIntentV1({
		workflowId: input.workflowId,
		evidenceId: input.evidenceId,
		record: input.fanoutPlan as unknown as Record<string, unknown>,
	});
	if (!prepared.ok || prepared.writeIntent === undefined) return prepared;
	return applyFlowDeskSessionEvidenceWriteIntentsV1(input.rootDir, [
		prepared.writeIntent,
	]);
}

function contextFor(
	toolName: FlowDeskRelease1MinimumToolName,
	request: unknown,
	state: LocalAdapterState,
	parts: ReturnType<typeof nowParts>,
	permissionProvider: FlowDeskLocalNonDispatchPermissionProviderV1,
): FlowDeskCommandBackedHandlerContextV1 {
	const record = isRecord(request) ? request : {};
	if (toolName === "flowdesk_plan")
		return { plan: makePlanContext(record, parts) };
	if (toolName === "flowdesk_run")
		return {
			run: makeRunContext(
				record,
				parts,
				permissionProvider,
				state.policyContext,
			),
		};
	if (toolName === "flowdesk_status")
		return { status: statusContext(state, record, parts) };
	const fallbackRegatePlan = fallbackRegatePlanContext(state, record);
	if (toolName === "flowdesk_retry") {
		const retry: NonNullable<FlowDeskRetryPlanningInputV1> = {
			request: record as unknown as FlowDeskRetryPlanningInputV1["request"],
			providerHealthSnapshot: providerHealth(parts),
			newAttemptId: id("attempt-retry", record),
			auditRef: "audit-local",
			debugRef: "debug-local",
		};
		return { retry };
	}
	const fanoutDiagnostics = reviewerFanoutDiagnosticsContext(
		state,
		record,
		parts,
	);
	return {
		diagnostic: {
			nowIso: parts.nowIso,
			deleteAfterIso: parts.expiresAtIso,
			providerHealthSnapshotRef: "health-local",
			productionEnablement: productionEnablementContext(state, record),
			...(fanoutDiagnostics?.selection.cacheRefreshPlan === undefined
				? {}
				: {
						exactModelAvailabilityCacheRefreshPlan:
							fanoutDiagnostics.selection.cacheRefreshPlan,
					}),
			...(fanoutDiagnostics === undefined
				? {}
				: { reviewerFanoutPlan: fanoutDiagnostics.fanoutPlan }),
			fallbackRegatePlan,
		},
	};
}

function summarize(
	state: LocalAdapterState,
	stateWriteApplied: boolean,
): FlowDeskLocalNonDispatchAdapterStateSummaryV1 {
	const pending = state.pendingConfirmation;
	return {
		workflowId: state.workflow?.workflow_id,
		workflowState: state.workflow?.state,
		...(pending === undefined
			? { pendingConfirmationStatus: "missing" as const }
			: {
					pendingConfirmationStatus: pending.status,
					pendingConfirmationRef: pending.approvalRef,
					pendingConfirmationWorkflowId: pending.workflowId,
					pendingConfirmationExpiresAt: pending.expiresAtIso,
				}),
		laneRecords: state.laneRecords.length,
		inMemoryStateEntries: state.inMemoryState.size,
		durableStateMode:
			state.durableStateRootDir === undefined
				? "memory_only"
				: "durable_flowdesk_root",
		durableStateWriteApplied: state.lastDurableStateWriteApplied,
		durableStateWrites: state.durableStateWrites,
		stateWriteApplied,
		permissionSource: "tool_boundary_injected",
		...disabledAuthority,
	};
}

function blockedRunHandler(
	toolName: FlowDeskRelease1MinimumToolName,
	validation: ValidationResult,
): FlowDeskCommandBackedHandlerResultV1 {
	return {
		...validation,
		toolName,
		handlerMode: "pending_confirmation_invalid",
		requestSchemaValid: false,
		responseSchemaValid: false,
		coreEvaluationOk: false,
		...disabledAuthority,
	};
}

function clockDate(clock: FlowDeskLocalClockV1): Date {
	return typeof clock === "function" ? clock() : clock;
}

export function createFlowDeskLocalNonDispatchAdapterSession(
	now: FlowDeskLocalClockV1 = new Date(),
	permissionProvider = createFlowDeskLocalNonDispatchPermissionProvider(),
	options: FlowDeskLocalNonDispatchAdapterSessionOptionsV1 = {},
): FlowDeskLocalNonDispatchAdapterSessionV1 {
	const initialParts = nowParts(clockDate(now));
	const state: LocalAdapterState = {
		laneRecords: [],
		inMemoryState: new Map(),
		durableStateRootDir: options.durableStateRootDir,
		productionEnablement: options.productionEnablement,
		reviewerFanoutDiagnostics: options.reviewerFanoutDiagnostics,
		policyContext: loadLocalPolicyContext(initialParts, options.projectConfig),
		durableStateWrites: 0,
		lastDurableStateWriteApplied: false,
		lastDurableStateReadErrors: [],
	};
	return {
		state,
		evaluate(
			toolName: FlowDeskRelease1MinimumToolName,
			request: unknown,
		): FlowDeskLocalNonDispatchAdapterToolResultV1 {
			const parts = nowParts(clockDate(now));
			const record = isRecord(request) ? request : {};
			if (toolName === "flowdesk_run" && shouldGateRun(state, record)) {
				const confirmationResult = validatePendingConfirmation(
					state,
					record,
					parts,
				);
				if (!confirmationResult.ok) {
					const handler = blockedRunHandler(toolName, confirmationResult);
					return {
						...confirmationResult,
						adapterProfile: flowdeskLocalNonDispatchAdapterProfile,
						toolName,
						handler,
						localState: summarize(state, false),
						...disabledAuthority,
					};
				}
				consumePendingConfirmation(state, parts);
			}
			const context = contextFor(
				toolName,
				request,
				state,
				parts,
				permissionProvider,
			);
			const handler = evaluateFlowDeskCommandBackedHandlerV1(
				toolName,
				request,
				context,
			);
			let stateWriteApplied = false;
			if (handler.ok && toolName === "flowdesk_plan")
				stateWriteApplied = recordPlanningState(state, record, parts);
			if (handler.ok && toolName === "flowdesk_run")
				stateWriteApplied = recordRunState(
					state,
					record,
					parts,
					permissionProvider,
				);
			if (handler.ok && toolName === "flowdesk_export_debug")
				stateWriteApplied = recordDebugExportManifestState(
					state,
					record,
					handler.response,
					parts,
				);
			if (handler.ok && toolName === "flowdesk_abort")
				cancelPendingConfirmation(state, record, parts);
			const adapterValidation =
				state.policyContext.errors.length > 0
					? invalid(...state.policyContext.errors)
					: state.lastDurableStateReadErrors.length > 0
						? invalid(...state.lastDurableStateReadErrors)
						: handler.ok &&
								(toolName === "flowdesk_plan" ||
									toolName === "flowdesk_run" ||
									toolName === "flowdesk_export_debug") &&
								!stateWriteApplied
							? invalid("local adapter state write failed")
							: valid();
			return {
				...adapterValidation,
				adapterProfile: flowdeskLocalNonDispatchAdapterProfile,
				toolName,
				handler,
				localState: summarize(state, stateWriteApplied),
				...disabledAuthority,
			};
		},
	};
}
