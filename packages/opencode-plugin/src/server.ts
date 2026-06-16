import { randomUUID } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { join, resolve, sep } from "node:path";
import {
	applyFlowDeskSessionEvidenceWriteIntentsV1,
	authorizeFlowDeskDefaultManagedDispatchV1,
	createFlowDeskChatHookAuthorityProbeV1,
	evaluateFlowDeskDefaultManagedDispatchPromotionReadinessV1,
	evaluateFlowDeskChatIntakeV1,
	evaluateFlowDeskProductionEnablementV1,
	type FlowDeskChatHookAuthorityProbeV1,
	type FlowDeskChatIntakeRequestV1,
	type FlowDeskConfiguredVerificationResultV1,
	type FlowDeskDefaultManagedDispatchAuthorizationV1,
	type FlowDeskDispatchAttemptManifestV1,
	type FlowDeskExternalAuthProviderPolicyResultV1,
	type FlowDeskFallbackDecisionV1,
	type FlowDeskProductionApprovalDecisionV1,
	type FlowDeskProductionApprovalSourceV1,
	type FlowDeskRelease1MinimumPortableCommandName,
	type FlowDeskRelease1MinimumToolName,
	type FlowDeskRelease2ManagedDispatchGatePromotionReadinessV1,
	type FlowDeskGitHubDryRunPublicationResultV1,
	type FlowDeskReviewerFanoutFromReloadedCacheEvidenceInputV1,
	type FlowDeskReviewerFanoutFromReloadedCacheEvidencePlanV1,
	type FlowDeskSanitizedAuthCaptureResultV1,
	type FlowDeskSessionEvidenceReloadResultV1,
	type FlowDeskToolRequestEnvelopeV1,
	getFlowDeskPortableCommandToolName,
	getRelease1SchemaArtifact,
	type ManagedDispatchBetaBoundaryInputV1,
	materializeFlowDeskExactModelCacheEvidenceFromProviderAcquisitionEvidenceV1,
	materializeFlowDeskRuntimeLaneLaunchPlansFromReviewerFanoutEvidenceV1,
	planFlowDeskReviewerFanoutFromReloadedCacheEvidenceV1,
	prepareFlowDeskSessionEvidenceWriteIntentV1,
	reloadFlowDeskSessionEvidenceV1,
	resolveUsageAwareProviderQualifiedModelId,
	type UsageAwareModelResolverResultV1,
	type SafeNextAction,
	validateFlowDeskDefaultManagedDispatchAuthorizationV1,
	validateConformanceRuntimeMetadataV1,
	validateFlowDeskGitHubDryRunPublicationResultV1,
	validateProjectConfigV1,
	validateRunRequestV1,
} from "@flowdesk/core";
import {
	type Plugin,
	type PluginModule,
	type PluginOptions as BasePluginOptions,
	tool,
} from "@opencode-ai/plugin";

export interface PluginOptions extends BasePluginOptions {
	model?: string;
}
import type { z } from "zod";
import {
	flowdeskPluginId,
	flowdeskPluginScaffold,
	hasProductionOpenCodeRegistration,
} from "./metadata.js";
import { observeFlowDeskOpenCodeEventV1 } from "./event-hook-observer.js";
import {
	type FlowDeskLaneHeartbeatWriteRequestV1,
	recordFlowDeskLaneHeartbeatV1,
} from "./lane-heartbeat-writer.js";
import {
	createFlowDeskLocalNonDispatchAdapterSession,
	type FlowDeskLocalClockV1,
	type FlowDeskLocalNonDispatchAdapterSessionV1,
	type FlowDeskLocalProductionEnablementOptionsV1,
	type FlowDeskLocalProjectConfigFileOptionsV1,
	type FlowDeskLocalReviewerFanoutDiagnosticsOptionsV1,
	flowdeskLocalNonDispatchAdapterProfile,
	hasFlowDeskLocalPlanningEvidenceV1,
} from "./local-adapter.js";
import {
	createFlowDeskManagedDispatchBetaDurableReservationStoreV1,
	createFlowDeskOpenCodeMetadataProviderAcquisitionClientV1,
	createFlowDeskOpenCodePromptBackedProviderAcquisitionClientV1,
	dispatchManagedDispatchBetaPromptV1,
	observeAndFinalizeManagedDispatchLaneV1,
	type FlowDeskExactModelProviderAcquisitionClientV1,
	type FlowDeskExactModelProviderAcquisitionLiveTestRequestV1,
	type FlowDeskManagedDispatchBetaAdapterResultV1,
	type FlowDeskManagedDispatchBetaDispatchRequestV1,
	type FlowDeskManagedDispatchBetaOpenCodeClientV1,
	type FlowDeskManagedDispatchBetaReservationStoreV1,
	materializeFlowDeskManagedFallbackRegatePlanEvidenceV1,
	orchestrateFlowDeskManagedFallbackRegateV1,
	runFlowDeskExactModelProviderAcquisitionLiveTestV1,
} from "./managed-dispatch-adapter.js";
import {
	executeFlowDeskProviderUsageLiveV1,
	type FlowDeskProviderUsageLiveConfigV1,
	type FlowDeskProviderUsageLiveProviderFamilyV1,
} from "./provider-usage-live-tool.js";
import {
	formatFlowDeskTuiUsageSnapshotCompactText,
	loadFlowDeskTuiUsageSnapshotViewV1,
} from "./tui-usage-snapshot.js";
import {
	executeFlowDeskQuickFallbackRunV1,
	type FlowDeskQuickFallbackRunConfigV1,
} from "./quick-fallback-run.js";
import {
	executeFlowDeskQuickReviewerRunV1,
	type FlowDeskQuickReviewerRunResultV1,
} from "./quick-reviewer-run.js";
import {
	executeFlowDeskRuntimeReviewerExecutionBridgeV1,
	type FlowDeskRuntimeReviewerExecutionExpectationV1,
	redactedRuntimeReviewerExecutionBlocked,
	runtimeReviewerExecutionExpectationsFromValue,
} from "./runtime-reviewer-execution-bridge.js";
import {
	abortFlowDeskAgentTaskV1,
	executeFlowDeskAgentTaskV1,
	type FlowDeskAgentTaskResultV1,
} from "./agent-task-runner.js";
import {
	executeFlowDeskAutoContinuePreviewToolV1,
	type FlowDeskAutoContinuePreviewToolConfigV1,
} from "./auto-continue-preview-tool.js";
import {
	executeFlowDeskAutoContinueExecutionToolV1,
	type FlowDeskAutoContinueExecutionToolConfigV1,
	type FlowDeskAutoContinueExecutionToolRequestV1,
} from "./auto-continue-execution-tool.js";
import {
	executeFlowDeskControlledWriteApplyToolV1,
	type FlowDeskControlledWriteApplyToolConfigV1,
} from "./controlled-write-tool.js";
import {
	executeFlowDeskStatusLiveV1,
	type FlowDeskStatusLiveConfigV1,
} from "./status-live-tool.js";
import {
	executeFlowDeskWorkflowDispatchPlanToolV1,
	type FlowDeskWorkflowDispatchPlanToolConfigV1,
} from "./workflow-dispatch-plan-tool.js";
import {
	consumeFlowDeskCompletionWakeForMainSessionV1,
	type FlowDeskCompletionWakeMainSessionConfigV1,
} from "./completion-wake-main-session.js";
import { refreshFlowDeskCompletionUiCachesV1 } from "./completion-ui-cache.js";
import {
	executeFlowDeskWorkflowDispatchToolV1,
	type FlowDeskWorkflowDispatchToolConfigV1,
} from "./workflow-dispatch-tool.js";
import { executeFlowDeskWorkflowOrchestratorV1 } from "./workflow-orchestrator.js";
import { executeFlowDeskWorkflowSynthesisPreviewV1 } from "./workflow-synthesis-tool.js";
import {
	evaluateGuardedAutoAbortHookV1,
	evaluateGuardedAutoRetryHookV1,
	reconcileStalePendingRetryPlansV1,
	checkSdkSessionApiHealthV1,
	monitorChildSessionsV1,
	runFlowDeskWatchdogCycleV1,
	type FlowDeskAutoAbortConfigV1,
	type FlowDeskSdkSessionHealthV1,
	type FlowDeskWatchdogConfigV1,
} from "./stall-recovery.js";
import type { FlowDeskAutoRetryResultV1 } from "@flowdesk/core";
import { withTimeout, FlowDeskTimeoutError } from "./shared/with-timeout.js";
import {
	FLOWDESK_PRE_SPIKE_PLUGIN_TOOL_STUBS,
	getFlowDeskRelease1HandlerReadinessSummary,
	getFlowDeskRelease1ProductionReadinessSummary,
	hasPassingFds1SchemaConversionSpike,
	runFlowDeskPreSpikePluginToolStub,
} from "./tool-stubs.js";
import { publishToGitHubV1, type GitHubPublicationTargetV1, fetchModelAvailabilityDbFromGitHubV1, type FetchModelAvailabilityDbInputV1 } from "./federated-registry-connector.js";
import { openReadonlyDb } from "./shared/sqlite-adapter.js";
// TODO(Phase 8e): expose flowdesk_model_availability_refresh as a first-class MCP tool once
// the controlled-write gate for the durable DB path is promoted. For now the function
// fetchModelAvailabilityDbFromGitHubV1 is exported from federated-registry-connector and can
// be wired into the flowdesk-doctor hook or a dedicated tool registration block here.
// See docs/PHASE8_COMPLETION_PLAN.md and docs/AUDIT_GITHUB_CONNECTOR_PHASE8.md for context.
import { intersectWorkingAndOpenCodeSupportedModelIds } from "./model-selection-engine.js";
import { createFlowDeskOIOptInTools } from "./oi-mcp-tools.js";

const WAKE_DIAG_ENABLED = process.env.FLOWDESK_WAKE_DIAG === "1" || process.env.FLOWDESK_WAKE_DIAG === "true";

/**
 * Load cached provider usage snapshots from the durable sidebar cache.
 *
 * Reads `<rootDir>/.flowdesk/ui/provider-usage-sidebar.json` (written by
 * the provider-usage-live tool / `flowdesk_quota`) and normalizes it into
 * the shape consumed by `resolveUsageAwareProviderQualifiedModelId`.
 *
 * Fail-open: on any error, returns an empty array. The resolver treats an
 * empty snapshot set as "no evidence of unhealth" and passes through the
 * requested model id unchanged.
 */
function loadCachedUsageSnapshots(rootDir: string): Array<{
	providerFamily: string;
	alertLevel: "ok" | "warning" | "critical" | "exhausted" | "stale" | "unknown";
	remainingPercent: number;
	dispatchability: "dispatchable" | "non_dispatchable";
}> {
	try {
		const cachePath = join(rootDir, ".flowdesk", "ui", "provider-usage-sidebar.json");
		if (!existsSync(cachePath)) return [];
		const parsed = JSON.parse(readFileSync(cachePath, "utf8")) as unknown;
		if (
			typeof parsed !== "object" ||
			parsed === null ||
			Array.isArray(parsed)
		)
			return [];
		const cache = parsed as Record<string, unknown>;
		if (cache.schema_version !== "flowdesk.provider_usage_sidebar_cache.v1")
			return [];
		if (!Array.isArray(cache.providers)) return [];
		const out: Array<{
			providerFamily: string;
			alertLevel: "ok" | "warning" | "critical" | "exhausted" | "stale" | "unknown";
			remainingPercent: number;
			dispatchability: "dispatchable" | "non_dispatchable";
		}> = [];
		for (const row of cache.providers) {
			if (typeof row !== "object" || row === null || Array.isArray(row))
				continue;
			const r = row as Record<string, unknown>;
			const providerFamily =
				typeof r.providerFamily === "string" ? r.providerFamily : "";
			if (providerFamily.length === 0) continue;
			const alertLevel =
				r.alertLevel === "ok" ||
				r.alertLevel === "warning" ||
				r.alertLevel === "critical" ||
				r.alertLevel === "exhausted" ||
				r.alertLevel === "stale" ||
				r.alertLevel === "unknown"
					? r.alertLevel
					: "unknown";
			const remainingPercent =
				typeof r.remainingPercent === "number" &&
				Number.isFinite(r.remainingPercent)
					? r.remainingPercent
					: 0;
			// Conservatively coerce "diagnostic_only" → "non_dispatchable" so
			// the resolver treats it as needing override.
			const dispatchability =
				r.dispatchability === "dispatchable" ? "dispatchable" : "non_dispatchable";
			out.push({ providerFamily, alertLevel, remainingPercent, dispatchability });
		}
		return out;
	} catch {
		return [];
	}
}

/**
 * Load OpenCode-supported model ids from the model-availability sqlite DB.
 *
 * Mirrors `loadAvailableModelIdsFromDb` in `workflow-assign-tool.ts`: prefers
 * the durable state root DB and falls back to the package-bundled DB. After
 * loading, filters down to the intersection with the OpenCode-supported set.
 *
 * Fail-open: on any error, returns an empty array. The resolver treats an
 * empty availability set as "no candidates" and falls back to the originally
 * requested model id.
 */
function loadCachedAvailableModelIds(rootDir: string): string[] {
	try {
		const durableDbPath = join(rootDir, "model-availability", "model-availability.db");
		const bundledDbPath = new URL(
			"../../data/model-availability.db",
			import.meta.url,
		).pathname;
		const dbPath = existsSync(durableDbPath) ? durableDbPath : bundledDbPath;
		const db = openReadonlyDb(dbPath);
		let rows: Array<{ model_id: string }>;
		try {
			rows = db
				.prepare<{ model_id: string }>(
					"SELECT model_id FROM models WHERE available = 1 ORDER BY model_id",
				)
				.all();
		} finally {
			db.close();
		}
		const ids = rows.map((r) => r.model_id);
		return intersectWorkingAndOpenCodeSupportedModelIds(ids);
	} catch {
		return [];
	}
}

/**
 * Apply usage-aware model resolution to a requested provider-qualified
 * model id. Loads cached usage snapshots and available model ids from the
 * durable state root and asks the pure resolver for a recommendation.
 *
 * This is a selection-phase pre-launch preferred-model substitution utility
 * only. It never carries dispatch authority, fallback authority, write
 * authority, Guard approval, or managed fallback/reselection authority.
 * Failing-open: when the durable root is missing or any I/O fails, the
 * resolver returns the requested model id unchanged.
 */
function resolveUsageAwareModelForServer(
	rootDir: string | undefined,
	requestedModelId: string,
): UsageAwareModelResolverResultV1 {
	if (typeof rootDir !== "string" || rootDir.trim().length === 0) {
		return {
			resolvedModelId: requestedModelId,
			overrideApplied: false,
			originalModelId: requestedModelId,
			providerBindingChangedBeforeLaunch: false,
			preLaunchModelSubstitution: false,
			modelSubstitutionKind: "none",
		};
	}
	return resolveUsageAwareProviderQualifiedModelId({
		requestedModelId,
		usageSnapshots: loadCachedUsageSnapshots(rootDir),
		availableModelIds: loadCachedAvailableModelIds(rootDir),
		allowCrossFamily: true,
	});
}

function wakeDiagnosticLogPath(filename: string): string {
	return join(homedir(), ".flowdesk", filename);
}

export const flowdeskPreSpikeDoctorToolName =
	"flowdesk_pre_spike_doctor" as const;
export const flowdeskCheckToolName = "flowdesk_check" as const;
export const flowdeskDebugToolName = "flowdesk_debug" as const;
export const flowdeskPlanShortToolName = "flowdesk_plan_short" as const;
export const flowdeskRunShortToolName = "flowdesk_run_short" as const;
export const flowdeskResumeStatusToolName = "flowdesk_resume_status" as const;
export const flowdeskRetryDiagToolName = "flowdesk_retry_diag" as const;
export const flowdeskAbortCmdToolName = "flowdesk_abort_cmd" as const;
export const flowdeskChatIntakeToolName = "flowdesk_chat_intake" as const;
export const flowdeskFds1SchemaConversionProbeOption =
	"fds1SchemaConversionProbe" as const;
export const flowdeskLocalNonDispatchAdapterOption =
	"localNonDispatchAdapter" as const;
export const flowdeskNaturalLanguageRoutingOption =
	"naturalLanguageRouting" as const;
export const flowdeskDurableStateRootOption = "durableStateRoot" as const;
export const flowdeskProjectConfigOption = "projectConfig" as const;
export const flowdeskProductionEnablementOption =
	"productionEnablement" as const;
export const flowdeskReviewerFanoutDiagnosticsOption =
	"reviewerFanoutDiagnostics" as const;
export const flowdeskManagedDispatchBetaAdapterOption =
	"managedDispatchBetaAdapter" as const;
export const flowdeskExactModelProviderAcquisitionLiveTestOption =
	"exactModelProviderAcquisitionLiveTest" as const;
export const flowdeskRuntimeReviewerExecutionOption =
	"runtimeReviewerExecution" as const;
export const flowdeskManagedFallbackRegateOption =
	"managedFallbackRegate" as const;
export const flowdeskQuickReviewerRunOption = "quickReviewerRun" as const;
export const flowdeskProviderUsageLiveOption = "providerUsageLive" as const;
export const flowdeskStatusLiveOption = "statusLive" as const;
export const flowdeskQuickFallbackRunOption = "quickFallbackRun" as const;
export const flowdeskLaneHeartbeatWriterOption = "laneHeartbeatWriter" as const;
export const flowdeskWorkflowDispatchPlanToolOption =
	"workflowDispatchPlanTool" as const;
export const flowdeskWorkflowDispatchOption = "workflowDispatch" as const;
export const flowdeskControlledWriteApplyOption =
	"controlledWriteApply" as const;
export const flowdeskUiProbeOption = "uiProbe" as const;
export const flowdeskDefaultManagedDispatchAuthorizationOption =
	"defaultManagedDispatchAuthorization" as const;
export const flowdeskWatchdogOption = "watchdog" as const;
export const flowdeskCompletionWakeMainSessionOption = "completionWakeMainSession" as const;
export const flowdeskWatchdogTriggerToolName = "flowdesk_watchdog_trigger" as const;
export const flowdeskManagedDispatchBetaToolName =
	"flowdesk_managed_dispatch_beta" as const;
export const flowdeskManagedDispatchLaneFinalizeToolName =
	"flowdesk_managed_dispatch_lane_finalize" as const;
export const flowdeskExactModelProviderAcquisitionLiveTestToolName =
	"flowdesk_exact_model_provider_acquisition_live_test" as const;
export const flowdeskRuntimeReviewerExecutionToolName =
	"flowdesk_runtime_reviewer_execution" as const;
export const flowdeskManagedFallbackRegateToolName =
	"flowdesk_managed_fallback_regate" as const;
export const flowdeskQuickReviewerRunToolName =
	"flowdesk_quick_reviewer_run" as const;
export const flowdeskProviderUsageLiveToolName =
	"flowdesk_provider_usage_live" as const;
export const flowdeskStatusLiveToolName = "flowdesk_status_live" as const;
export const flowdeskResultToolName = "flowdesk_result" as const;
export const flowdeskNowToolName = "flowdesk_now" as const;
export const flowdeskQuotaToolName = "flowdesk_quota" as const;
export const flowdeskNextToolName = "flowdesk_next" as const;
export const flowdeskQuickFallbackRunToolName =
	"flowdesk_quick_fallback_run" as const;
export const flowdeskRebindToolName = "flowdesk_rebind" as const;
export const flowdeskLaneHeartbeatWriterToolName =
	"flowdesk_lane_heartbeat_record" as const;
export const flowdeskBeatToolName = "flowdesk_beat" as const;
export const flowdeskWorkflowDispatchPlanToolName =
	"flowdesk_workflow_dispatch_plan" as const;
export const flowdeskWorkflowDispatchToolName =
	"flowdesk_workflow_dispatch" as const;
export const flowdeskControlledWriteApplyToolName =
	"flowdesk_controlled_write_apply" as const;
export const flowdeskWriteToolName = "flowdesk_write" as const;
export const flowdeskAgentTaskRunOption = "agentTaskRun" as const;
export const flowdeskAgentTaskRunToolName = "flowdesk_agent_task_run" as const;
export const flowdeskTaskToolName = "flowdesk_task" as const;
export const flowdeskTaskAbortToolName = "flowdesk_task_abort" as const;
export const flowdeskWorkflowSynthesisPreviewToolName = "flowdesk_workflow_synthesis_preview" as const;
export const flowdeskAutoContinuePreviewToolName = "flowdesk_auto_continue_preview" as const;
export const flowdeskAutoContinueExecutionOption = "autoContinueExecution" as const;
export const flowdeskAutoContinueExecutionToolName = "flowdesk_auto_continue_execute" as const;
export const flowdeskContinueToolName = "flowdesk_continue" as const;
export const flowdeskUiProbeToolName = "flowdesk_ui_probe" as const;
export const flowdeskOperationalIntelligenceOption =
	"operationalIntelligence" as const;
export const flowdeskFederatedRegistryPublishToolName =
	"flowdesk_federated_registry_publish" as const;
export const flowdeskOIScorePreviewToolName = "flowdesk_oi_score_preview" as const;
export const flowdeskOIThresholdGateToolName = "flowdesk_oi_threshold_gate" as const;
export const flowdeskOILedgerListToolName = "flowdesk_oi_ledger_list" as const;
export const flowdeskOILedgerCompactToolName = "flowdesk_oi_ledger_compact" as const;
export const flowdeskOISessionSummaryToolName = "flowdesk_oi_session_summary" as const;

interface FlowDeskExactModelProviderAcquisitionCacheMaterializationOptionsV1 {
	enabled: true;
	targetCacheEvidenceId: string;
	targetCacheRefreshPlanEvidenceId: string;
	cacheId?: string;
	entryId?: string;
	reviewerFanoutPlanning?: FlowDeskProviderAcquisitionReviewerFanoutPlanningOptionsV1;
}

interface FlowDeskProviderAcquisitionReviewerFanoutPlanningOptionsV1
	extends Omit<
		FlowDeskReviewerFanoutFromReloadedCacheEvidenceInputV1,
		| "reloadedEvidence"
		| "workflowId"
		| "localDate"
		| "activeProfileRef"
		| "opencodeVersionRef"
		| "flowdeskPackageVersionRef"
		| "registryHash"
		| "policyPackHash"
		| "authAccountBoundaryRef"
		| "requestedAt"
	> {
	enabled: true;
	requestedAt?: string;
	persistDerivedFanoutPlanEvidence?: boolean;
	fanoutPlanEvidenceId?: string;
	runtimeLaunchPlanMaterialization?: FlowDeskProviderAcquisitionRuntimeLaunchPlanMaterializationOptionsV1;
}

interface FlowDeskProviderAcquisitionRuntimeLaunchPlanMaterializationOptionsV1 {
	enabled: true;
	targetLaunchPlanEvidenceIds: string[];
	sdkClientAvailable?: boolean;
	durableEvidenceRootRef?: string;
	runtimeReviewerExecution?: FlowDeskProviderAcquisitionRuntimeReviewerExecutionOptionsV1;
}

interface FlowDeskProviderAcquisitionRuntimeReviewerExecutionOptionsV1 {
	enabled: true;
	attemptId: string;
	parentSessionId: string;
	observedAt?: string;
	consumedReviewerFanoutApproval: FlowDeskProductionApprovalSourceV1;
	verdictExpectations: FlowDeskRuntimeReviewerExecutionExpectationV1[];
}

interface FlowDeskRuntimeReviewerExecutionOptionsV1 {
	enabled: true;
	durableStateRoot?: string;
	client?: FlowDeskManagedDispatchBetaOpenCodeClientV1;
}

type FlowDeskOpenCodeTool = ReturnType<typeof tool>;
type FlowDeskOpenCodeToolArgs = Parameters<typeof tool>[0]["args"];
type FlowDeskOpenCodeToolArg = z.ZodType;

interface FlowDeskUiProbeEventObservationV1 {
	observedAt: string;
	eventType: string;
	sessionId?: string;
	messageId?: string;
	partId?: string;
	keys: string[];
}

export interface FlowDeskManagedDispatchRunRouteOptionsV1 {
	client?: FlowDeskManagedDispatchBetaOpenCodeClientV1;
	reservationStore?: FlowDeskManagedDispatchBetaReservationStoreV1;
	durableStateRootDir?: string;
	defaultAuthorization?: FlowDeskDefaultManagedDispatchAuthorizationV1;
	deriveDefaultAuthorization?: (
		request: Record<string, unknown>,
	) => FlowDeskDefaultManagedDispatchAuthorizationV1 | undefined;
}

interface FlowDeskDefaultManagedDispatchAuthorizationAutoOptionsV1 {
	enabled: true;
	authorizationId?: string;
	actorRef: string;
	profileRef: string;
	releaseGateRef: string;
	rollbackRef: string;
	createdAt?: string;
	expiresAt: string;
	defaultEnablementRequested: boolean;
	killSwitchState: "inactive" | "active";
	durablePrecallRef: string;
	// internal identifier — not user-facing
	adapterProfileRef: string;
	sdkClientRef: string;
	defaultReleaseEnablementRef: string;
	allowUncertainty?: boolean;
	/**
	 * Optional opaque durable evidence ref for a persisted Release 2 managed
	 * dispatch gate promotion readiness record. Used together with
	 * `release2GateReadinessResult` so that the promotion readiness evaluator
	 * can block the default candidate when Release 2 has not yet completed.
	 */
	release2GateReadinessRef?: string;
	/**
	 * Optional Release 2 managed dispatch gate promotion readiness result that
	 * the promotion readiness evaluator validates before allowing the default
	 * dispatch candidate state.
	 */
	release2GateReadinessResult?: FlowDeskRelease2ManagedDispatchGatePromotionReadinessV1;
}

interface FlowDeskDerivedDefaultManagedDispatchAuthorizationInputV1 {
	request: Record<string, unknown>;
	options?: PluginOptions;
	durableStateRootDir?: string;
	client?: FlowDeskManagedDispatchBetaOpenCodeClientV1;
	now?: Date;
}

interface FlowDeskChatMessageOutput {
	parts?: unknown[];
}

export interface FlowDeskChatHookAuthorityObservationInputV1 {
	probeId: string;
	chatHookRef: string;
	observedAt: string;
	beforePartsCount: number;
	afterPartsCount: number;
	hookThrew?: boolean;
	throwBlockedReplyObserved?: boolean;
	returnValue?: unknown;
	duplicateAssistantReplyObserved?: boolean;
	timeoutOrNullFailClosed?: boolean;
	malformedReturnFailClosed?: boolean;
	evidenceRefs?: string[];
}

const flowdeskChatSuggestionDuplicateWindowMs = 10_000;
const flowdeskChatSuggestionDismissWindowMs = 5 * 60_000;

type FlowDeskEffectiveChatIntakeModeV1 = "blocking" | "steering";

interface FlowDeskChatIntakeModeGateV1 {
	requestedMode?: string;
	effectiveMode: FlowDeskEffectiveChatIntakeModeV1;
	diagnostic?: string;
	conformanceRef?: string;
	conformanceReadable: boolean;
	blockingSafe: boolean;
	realOpenCodeDispatch: false;
	actualLaneLaunch: false;
	providerCall: false;
	runtimeExecution: false;
	fallbackAuthority: false;
	hardCancelOrNoReplyAuthority: false;
}

interface FlowDeskChatSuggestionPreferenceRecordV1 {
	schema_version: "flowdesk.chat_suggestion_preference.v1";
	preference_ref: string;
	session_ref: string;
	preference_action: "dedupe" | "dismiss";
	route_decision: string;
	safe_next_action?: SafeNextAction;
	recorded_at: string;
	expires_at: string;
	realOpenCodeDispatch: false;
	actualLaneLaunch: false;
	providerCall: false;
	runtimeExecution: false;
	fallbackAuthority: false;
	hardCancelOrNoReplyAuthority: false;
}

function chatSuggestionDismissKey(sessionRef: string | undefined): string {
	return [safeToken(sessionRef, "chat-session"), "dismiss-suggestions"].join("|");
}

function looksLikeSuggestionDismissal(text: string): boolean {
	return /그냥\s*해줘|무시해|괜찮아|dismiss|ignore\s+flowdesk|skip/i.test(text);
}

function looksLikeExplicitFlowDeskRequest(text: string): boolean {
	return /\/flowdesk-|flowdesk\s+(status|plan|run|doctor|usage|resume|retry|abort|export)/i.test(
		text,
	);
}

const disabledAuthority = {
	productionRegistrationEligible: false,
	dispatchApprovalEligible: false,
	realOpenCodeDispatch: false,
	actualLaneLaunch: false,
	providerCall: false,
	runtimeExecution: false,
	fallbackAuthority: false,
	hardCancelOrNoReplyAuthority: false,
} as const;

function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === "object" && value !== null && !Array.isArray(value);
}

function hasUnsupportedHardChatReturnFields(value: unknown): boolean {
	if (!isRecord(value)) return false;
	return ["noReply", "cancel", "stop"].some((key) => key in value);
}

export function createFlowDeskChatHookAuthorityProbeFromObservationV1(
	input: FlowDeskChatHookAuthorityObservationInputV1,
): FlowDeskChatHookAuthorityProbeV1 {
	const unsupportedHardChatReturn = hasUnsupportedHardChatReturnFields(
		input.returnValue,
	);
	return createFlowDeskChatHookAuthorityProbeV1({
		probeId: safeToken(input.probeId, "chat-hook-probe"),
		chatHookRef: safeToken(input.chatHookRef, "chat-message-hook"),
		observedAt: input.observedAt,
		mutationObserved: input.afterPartsCount > input.beforePartsCount,
		throwBlocksReply:
			input.hookThrew === true && input.throwBlockedReplyObserved === true,
		noReplySupported: false,
		cancelOrStopSupported: false,
		duplicateAssistantReplyObserved:
			input.duplicateAssistantReplyObserved === true,
		timeoutOrNullFailClosed: input.timeoutOrNullFailClosed === true,
		malformedReturnFailClosed: unsupportedHardChatReturn
			? false
			: input.malformedReturnFailClosed === true,
		evidenceRefs: input.evidenceRefs,
	});
}

function isManagedDispatchBetaClient(
	value: unknown,
): value is FlowDeskManagedDispatchBetaOpenCodeClientV1 {
	if (!isRecord(value) || !isRecord(value.session)) return false;
	return (
		typeof value.session.prompt === "function" ||
		typeof value.session.promptAsync === "function"
	);
}

function isManagedDispatchBetaReservationStore(
	value: unknown,
): value is FlowDeskManagedDispatchBetaReservationStoreV1 {
	return (
		isRecord(value) &&
		typeof value.reserve === "function" &&
		typeof value.recordDispatchFailure === "function"
	);
}

function isExactModelProviderAcquisitionClient(
	value: unknown,
): value is FlowDeskExactModelProviderAcquisitionClientV1 {
	return (
		isRecord(value) && typeof value.checkExactModelAvailability === "function"
	);
}

function boundedText(value: string, fallback: string): string {
	const trimmed = value.trim();
	return (trimmed.length > 0 ? trimmed : fallback).slice(0, 500);
}

function safeToken(value: unknown, fallback: string): string {
	const source =
		typeof value === "string" && value.length > 0 ? value : fallback;
	const token = source.replaceAll(/[^A-Za-z0-9_.:-]/g, "-").slice(0, 80);
	return token.length > 0 ? token : fallback;
}

function hashText(value: string): string {
	let hash = 2166136261;
	for (const char of value) {
		hash ^= char.charCodeAt(0);
		hash = Math.imul(hash, 16777619);
	}
	return (hash >>> 0).toString(16).padStart(8, "0");
}

function durableSuggestionPreferencePath(
	rootDir: string | undefined,
	duplicateKey: string,
): string | undefined {
	if (rootDir === undefined || rootDir.trim().length === 0) return undefined;
	const root = resolve(rootDir);
	const dir = resolve(root, ".flowdesk", "chat-suggestion-preferences");
	if (dir !== root && !dir.startsWith(`${root}${sep}`)) return undefined;
	return join(dir, `${hashText(duplicateKey)}.json`);
}

function readDurableSuggestionPreferenceAtMs(
	rootDir: string | undefined,
	duplicateKey: string,
	nowMs: number,
): number | undefined {
	const filePath = durableSuggestionPreferencePath(rootDir, duplicateKey);
	if (filePath === undefined) return undefined;
	try {
		const record = JSON.parse(readFileSync(filePath, "utf8")) as unknown;
		if (!isRecord(record)) return undefined;
		if (record.schema_version !== "flowdesk.chat_suggestion_preference.v1")
			return undefined;
		const recordedAt = Date.parse(String(record.recorded_at ?? ""));
		const expiresAt = Date.parse(String(record.expires_at ?? ""));
		if (!Number.isFinite(recordedAt) || !Number.isFinite(expiresAt))
			return undefined;
		if (nowMs > expiresAt) return undefined;
		return recordedAt;
	} catch {
		return undefined;
	}
}

function writeDurableSuggestionPreference(
	rootDir: string | undefined,
	duplicateKey: string,
	request: FlowDeskChatIntakeRequestV1,
	response:
		| ReturnType<typeof evaluateFlowDeskChatIntakeV1>["response"]
		| undefined,
	recordedAtMs: number,
	preferenceAction: FlowDeskChatSuggestionPreferenceRecordV1["preference_action"] = "dedupe",
): void {
	const filePath = durableSuggestionPreferencePath(rootDir, duplicateKey);
	if (filePath === undefined) return;
	try {
		const expiresInMs =
			preferenceAction === "dismiss"
				? flowdeskChatSuggestionDismissWindowMs
				: flowdeskChatSuggestionDuplicateWindowMs;
		const record: FlowDeskChatSuggestionPreferenceRecordV1 = {
			schema_version: "flowdesk.chat_suggestion_preference.v1",
			preference_ref: `chat-suggestion-${hashText(duplicateKey)}`,
			session_ref: safeToken(request.session_ref, "session-redacted"),
			preference_action: preferenceAction,
			route_decision: safeToken(
				response?.route_decision,
				preferenceAction === "dismiss" ? "dismiss" : "route-redacted",
			),
			...(response?.safe_next_actions[0] === undefined
				? {}
				: { safe_next_action: response.safe_next_actions[0] }),
			recorded_at: new Date(recordedAtMs).toISOString(),
			expires_at: new Date(recordedAtMs + expiresInMs).toISOString(),
			realOpenCodeDispatch: false,
			actualLaneLaunch: false,
			providerCall: false,
			runtimeExecution: false,
			fallbackAuthority: false,
			hardCancelOrNoReplyAuthority: false,
		};
		mkdirSync(resolve(filePath, ".."), { recursive: true });
		const tempPath = `${filePath}.tmp-${record.preference_ref}`;
		writeFileSync(tempPath, `${JSON.stringify(record, null, 2)}\n`, "utf8");
		renameSync(tempPath, filePath);
	} catch {
		// Durable preferences are best-effort UX dedupe only; memory dedupe remains.
	}
}

function commandNameFromAction(
	action: SafeNextAction,
): FlowDeskRelease1MinimumPortableCommandName | undefined {
	return action.startsWith("/flowdesk-") &&
		action !== "/flowdesk-explain-route" &&
		action !== "/flowdesk-audit"
		? (action as FlowDeskRelease1MinimumPortableCommandName)
		: undefined;
}

function routedToolName(
	actions: readonly SafeNextAction[],
): FlowDeskRelease1MinimumToolName | undefined {
	const preferredActions =
		actions.length > 1
			? [
					...actions.filter((action) => action !== "/flowdesk-status"),
					...actions.filter((action) => action === "/flowdesk-status"),
				]
			: actions;
	for (const action of preferredActions) {
		const commandName = commandNameFromAction(action);
		if (commandName === undefined) continue;
		const toolName = getFlowDeskPortableCommandToolName(commandName);
		if (toolName !== undefined) return toolName;
	}
	return undefined;
}

type FlowDeskRequestEnvelopeOptionalField =
	| "workflow_id"
	| "session_ref"
	| "redacted_intake_ref"
	| "user_approval_ref"
	| "confirmation_nonce";

const chatEnvelopeOptionalFields: readonly FlowDeskRequestEnvelopeOptionalField[] =
	[
		"workflow_id",
		"session_ref",
		"redacted_intake_ref",
		"user_approval_ref",
		"confirmation_nonce",
	];

function baseToolRequest(
	request: FlowDeskChatIntakeRequestV1,
	schemaVersion: string,
	optionalFields: readonly FlowDeskRequestEnvelopeOptionalField[] = chatEnvelopeOptionalFields,
): FlowDeskToolRequestEnvelopeV1 {
	const includeOptional = new Set(optionalFields);
	return {
		schema_version: schemaVersion,
		request_id: safeToken(
			`${schemaVersion.split(".")[1] ?? "tool"}-${request.request_id}`,
			"request-chat-routed",
		),
		input_mode: "chat_routed",
		...(includeOptional.has("workflow_id") && request.workflow_id !== undefined
			? { workflow_id: request.workflow_id }
			: {}),
		...(includeOptional.has("session_ref") && request.session_ref !== undefined
			? { session_ref: request.session_ref }
			: {}),
		...(includeOptional.has("redacted_intake_ref") &&
		request.redacted_intake_ref !== undefined
			? { redacted_intake_ref: request.redacted_intake_ref }
			: {}),
		...(includeOptional.has("user_approval_ref") &&
		request.user_approval_ref !== undefined
			? { user_approval_ref: request.user_approval_ref }
			: {}),
		...(includeOptional.has("confirmation_nonce") &&
		request.confirmation_nonce !== undefined
			? { confirmation_nonce: request.confirmation_nonce }
			: {}),
	};
}

function routedToolRequest(
	toolName: FlowDeskRelease1MinimumToolName,
	request: FlowDeskChatIntakeRequestV1,
	options: { requiresConfirmation?: boolean } = {},
): unknown {
	const summary = boundedText(
		request.intake_summary,
		"FlowDesk natural-language chat intake.",
	);
	if (toolName === "flowdesk_plan") {
		return {
			...baseToolRequest(request, "flowdesk.plan.request.v1"),
			goal_summary: summary,
			scope_summary:
				"FlowDesk natural-language chat intake routed to command-backed planning.",
			risk_hint:
				options.requiresConfirmation === true
					? "execution-like chat intake requires explicit user confirmation before any run"
					: "ordinary Release 1 command-backed steering only",
		};
	}
	if (toolName === "flowdesk_run") {
		return {
			...baseToolRequest(request, "flowdesk.run.request.v1"),
			run_mode: /dry[\s_-]*run|드라이\s*런/i.test(summary)
				? "guarded-dry-run"
				// schema enum / internal command mode — not user-facing
				: "fake-runtime",
			plan_revision_id: safeToken(
				`plan-${request.workflow_id ?? request.request_id}`,
				"plan-chat-routed",
			),
			step_id: safeToken(`step-${request.request_id}`, "step-chat-routed"),
		};
	}
	if (toolName === "flowdesk_status") {
		return {
			...baseToolRequest(request, "flowdesk.status.request.v1"),
			detail_level: "summary",
		};
	}
	if (toolName === "flowdesk_doctor") {
		return {
			...baseToolRequest(request, "flowdesk.doctor.request.v1", []),
			check_scope: "all",
			profile: "test",
			persist_report: false,
		};
	}
	if (toolName === "flowdesk_resume") {
		return {
			...baseToolRequest(request, "flowdesk.resume.request.v1", []),
			checkpoint_id: safeToken(
				`checkpoint-${request.workflow_id ?? request.request_id}`,
				"checkpoint-chat-routed",
			),
			resume_mode: "status_only",
		};
	}
	if (toolName === "flowdesk_retry") {
		return {
			...baseToolRequest(request, "flowdesk.retry.request.v1"),
			attempt_id: safeToken(
				`attempt-${request.workflow_id ?? request.request_id}`,
				"attempt-chat-routed",
			),
			retry_reason:
				"FlowDesk chat intake requested a command-backed retry diagnostic.",
		};
	}
	if (toolName === "flowdesk_abort") {
		return {
			...baseToolRequest(request, "flowdesk.abort.request.v1"),
			workflow_id: safeToken(
				request.workflow_id ?? `workflow-${request.request_id}`,
				"workflow-chat-routed",
			),
			reason: "FlowDesk chat intake requested a safe abort diagnostic.",
		};
	}
	if (toolName === "flowdesk_usage") {
		return {
			...baseToolRequest(request, "flowdesk.usage.request.v1", []),
			provider_family: "unknown",
			refresh: false,
		};
	}
	if (toolName === "flowdesk_export_debug") {
		return {
			...baseToolRequest(request, "flowdesk.export_debug.request.v1", []),
			include_sections: ["redaction_summary"],
			retention_hint: "keep_until_default_expiry",
		};
	}
	return baseToolRequest(request, "flowdesk.tool.request.v1");
}

function evaluateNaturalLanguageRouting(
	request: FlowDeskChatIntakeRequestV1,
	session: FlowDeskLocalNonDispatchAdapterSessionV1,
	chatIntakeMode: FlowDeskEffectiveChatIntakeModeV1 = "steering",
) {
	const evaluation = evaluateFlowDeskChatIntakeV1({
		request,
		chatIntakeMode,
		hookHarnessMode: "enforce",
		planningDocumentAvailable: hasFlowDeskLocalPlanningEvidenceV1(
			session,
			request.workflow_id,
			request.session_ref,
		),
	});
	const toolName = evaluation.response.ok
		? routedToolName(evaluation.response.safe_next_actions)
		: undefined;
	const routedToolResult =
		toolName === undefined
			? undefined
			: session.evaluate(
					toolName,
					routedToolRequest(toolName, request, {
						requiresConfirmation:
							evaluation.response.route_decision === "ask_clarification",
					}),
				);
	return {
		schema_version: "flowdesk.chat_intake.routing_result.v1",
		ok: evaluation.ok,
		evaluation,
		...(toolName === undefined ? {} : { routedToolName: toolName }),
		...(routedToolResult === undefined ? {} : { routedToolResult }),
		...disabledAuthority,
	};
}

function extractText(value: unknown): string {
	if (typeof value === "string") return value;
	if (!isRecord(value)) return "";
	const direct = [value.text, value.content, value.message].filter(
		(candidate): candidate is string => typeof candidate === "string",
	);
	const partText = Array.isArray(value.parts)
		? value.parts.map(extractText)
		: [];
	const nestedMessage = isRecord(value.message)
		? [extractText(value.message)]
		: [];
	return [...direct, ...partText, ...nestedMessage]
		.filter((text) => text.length > 0)
		.join(" ");
}

function intakeRequestFromChatMessage(
	input: unknown,
): FlowDeskChatIntakeRequestV1 {
	const record = isRecord(input) ? input : {};
	const requestId = safeToken(
		record.request_id ?? record.message_id ?? record.messageID ?? record.id,
		"chat-message",
	);
	const sessionRef = safeToken(
		record.session_ref ?? record.session_id ?? record.sessionID,
		"chat-session",
	);
	return {
		schema_version: "flowdesk.chat_intake.request.v1",
		request_id: `chat-${requestId}`,
		input_mode: "chat_routed",
		session_ref: sessionRef,
		redacted_intake_ref: `intake-${requestId}`,
		intake_summary: boundedText(
			extractText(record.message ?? record),
			"FlowDesk chat message.",
		),
		source_surface: "chat.message",
	};
}

function clockMs(clock: FlowDeskLocalClockV1): number {
	return (typeof clock === "function" ? clock() : clock).getTime();
}

function previewNaturalLanguageRouting(
	request: FlowDeskChatIntakeRequestV1,
	session: FlowDeskLocalNonDispatchAdapterSessionV1,
	chatIntakeMode: FlowDeskEffectiveChatIntakeModeV1 = "steering",
) {
	const evaluation = evaluateFlowDeskChatIntakeV1({
		request,
		chatIntakeMode,
		hookHarnessMode: "enforce",
		planningDocumentAvailable: hasFlowDeskLocalPlanningEvidenceV1(
			session,
			request.workflow_id,
			request.session_ref,
		),
	});
	const toolName = evaluation.response.ok
		? routedToolName(evaluation.response.safe_next_actions)
		: undefined;
	return { evaluation, toolName };
}

function mayCreatePendingConfirmation(
	preview: ReturnType<typeof previewNaturalLanguageRouting>,
): boolean {
	return (
		preview.evaluation.response.route_decision === "ask_clarification" &&
		preview.toolName === "flowdesk_plan"
	);
}

function suggestionDuplicateKey(
	request: FlowDeskChatIntakeRequestV1,
	response: ReturnType<typeof evaluateFlowDeskChatIntakeV1>["response"],
): string {
	const suggestedNextStep = response.safe_next_actions[0] ?? "/flowdesk-status";
	return [request.session_ref, response.route_decision, suggestedNextStep]
		.map((part, index) => safeToken(part, `chat-card-${index}`))
		.join("|");
}

function steeringText(
	result: ReturnType<typeof evaluateNaturalLanguageRouting>,
): string {
	const response = result.evaluation.response;
	const actions = response.safe_next_actions.map((action) =>
		action === "ask_clarification"
			? "Confirm the goal or plan before FlowDesk suggests a run."
			: action,
	);
	const suggestedNextStep = actions[0] ?? "/flowdesk-status";
	const localState =
		isRecord(result.routedToolResult) &&
		isRecord(result.routedToolResult.localState)
			? result.routedToolResult.localState
			: undefined;
	const confirmationRef =
		localState?.pendingConfirmationStatus === "pending" &&
		typeof localState.pendingConfirmationRef === "string"
			? localState.pendingConfirmationRef
			: undefined;
	const why =
		response.ok === false
			? "This request needs capabilities that are not available in the safe FlowDesk mode."
			: response.safe_next_actions[0] === "/flowdesk-usage"
				? "This looks like a larger FlowDesk task, so usage should be checked before planning or running more work."
				: response.route_decision === "ask_clarification"
					? "FlowDesk needs confirmation or a clearer goal before suggesting a command-backed workflow."
					: response.route_decision === "show_plan"
						? "Your message looks like planning work that FlowDesk can organize as a command-backed plan."
						: "Your message matches a safe FlowDesk command-backed workflow.";
	return [
		"FlowDesk",
		`Suggested next step: ${suggestedNextStep}`,
		`Why: ${why}`,
		...(confirmationRef === undefined
			? []
			: [
					`Confirmation code: ${confirmationRef}`,
					"To continue, review the plan and reply with this confirmation code plus explicit approval.",
				]),
		"Actions:",
		...actions.map((action) => `- ${action}`),
	].join("\n");
}

function enumValues(values: readonly string[]): [string, ...string[]] {
	if (values.length === 0) throw new Error("FDS-1 enum field has no values");
	return [values[0] as string, ...values.slice(1)];
}

function zodForSchemaProperty(
	schemaId: string,
	fieldName: string,
	required: boolean,
): FlowDeskOpenCodeToolArg {
	const artifact = getRelease1SchemaArtifact(schemaId);
	if (artifact === undefined)
		throw new Error(`missing FDS-1 schema artifact: ${schemaId}`);
	const property = artifact.properties[fieldName];
	if (property === undefined)
		throw new Error(`missing FDS-1 property ${fieldName} for ${schemaId}`);

	let schema: FlowDeskOpenCodeToolArg;
	if (property.enum !== undefined)
		schema = tool.schema.enum(enumValues(property.enum));
	else if (property.type === "number") schema = tool.schema.number();
	else if (property.type === "boolean") schema = tool.schema.boolean();
	else if (property.type === "array")
		schema = tool.schema.array(tool.schema.string());
	else if (property.type === "object")
		schema = tool.schema.record(tool.schema.string(), tool.schema.unknown());
	else schema = tool.schema.string();

	if (property.maxLength !== undefined && property.type === "string")
		schema = (schema as z.ZodString).max(property.maxLength);
	if (property.maxItems !== undefined && property.type === "array")
		schema = (schema as z.ZodArray<z.ZodString>).max(property.maxItems);
	schema = schema.describe(property.description);
	return required ? schema : schema.optional();
}

export function createFlowDeskFds1SchemaConversionProbeTools(): Record<
	string,
	FlowDeskOpenCodeTool
> {
	return Object.fromEntries(
		FLOWDESK_PRE_SPIKE_PLUGIN_TOOL_STUBS.map((stub) => {
			const artifact = getRelease1SchemaArtifact(stub.requestSchemaId);
			if (artifact === undefined)
				throw new Error(
					`missing FDS-1 schema artifact: ${stub.requestSchemaId}`,
				);
			const required = new Set(artifact.required);
			const args = Object.fromEntries(
				Object.keys(artifact.properties).map((fieldName) => [
					fieldName,
					zodForSchemaProperty(
						stub.requestSchemaId,
						fieldName,
						required.has(fieldName),
					),
				]),
			) as FlowDeskOpenCodeToolArgs;
			return [
				stub.toolName,
				tool({
					description: `FlowDesk FDS-1 schema conversion probe for ${stub.toolName}; no dispatch, provider call, or runtime execution.`,
					args,
					async execute(request) {
						return JSON.stringify(
							runFlowDeskPreSpikePluginToolStub(stub.toolName, request),
						);
					},
				}),
			];
		}),
	);
}


export function createFlowDeskTaskAbortTool(
	client: FlowDeskManagedDispatchBetaOpenCodeClientV1,
	durableStateRootDir: string | undefined,
): FlowDeskOpenCodeTool {
	return tool({
		description:
			"Dev/beta SDK-scoped abort for a stalled FlowDesk agent task. Looks up workflowId + taskId, routes through the typed session abort adapter, calls OpenCode SDK session.abort when available, and writes task_failed + terminal lifecycle evidence. This is separate from diagnostic /flowdesk-abort.",
		args: {
			workflowId: tool.schema.string().describe("FlowDesk workflow ID containing the task (e.g. workflow-xxx)."),
			taskId: tool.schema.string().describe("FlowDesk task ID to abort (e.g. task-xxx)."),
			reason: tool.schema.string().describe("Reason for aborting (e.g. 'stalled after 1 hour with no response')."),
		},
		async execute(request) {
			const record: Record<string, unknown> = isRecord(request) ? request : {};
			const workflowId = typeof record.workflowId === "string" ? record.workflowId : "";
			const taskId = typeof record.taskId === "string" ? record.taskId : "";
			const reason = typeof record.reason === "string" ? record.reason : "coordinator requested abort";
			if (!workflowId || !taskId) return JSON.stringify({ status: "abort_skipped", redactedReason: "workflowId and taskId are required" });
			if (!durableStateRootDir) return JSON.stringify({ status: "abort_skipped", redactedReason: "durable state root not configured" });
			const result = await abortFlowDeskAgentTaskV1({
				rootDir: durableStateRootDir,
				workflowId,
				taskId,
				reason,
				client,
			});
			return JSON.stringify({ ...result, workflowId, taskId });
		},
	});
}

export function createFlowDeskLocalNonDispatchAdapterTools(
	now = new Date(),
	session = createFlowDeskLocalNonDispatchAdapterSession(now),
	managedDispatchRunRoute: FlowDeskManagedDispatchRunRouteOptionsV1 = {},
): Record<string, FlowDeskOpenCodeTool> {

	type FlowDeskOpenCodeToolEntry = [string, FlowDeskOpenCodeTool];
	const entries: FlowDeskOpenCodeToolEntry[] = FLOWDESK_PRE_SPIKE_PLUGIN_TOOL_STUBS.flatMap((stub): FlowDeskOpenCodeToolEntry[] => {
			const artifact = getRelease1SchemaArtifact(stub.requestSchemaId);
			if (artifact === undefined)
				throw new Error(
					`missing FDS-1 schema artifact: ${stub.requestSchemaId}`,
				);
			const required = new Set(artifact.required);
			const args = Object.fromEntries(
				Object.keys(artifact.properties).map((fieldName) => [
					fieldName,
					zodForSchemaProperty(
						stub.requestSchemaId,
						fieldName,
						required.has(fieldName),
					),
				]),
			) as FlowDeskOpenCodeToolArgs;
			const lowLevelEntry: FlowDeskOpenCodeToolEntry = [
				stub.toolName,
				tool({
				description: `FlowDesk command-backed local tool for ${stub.toolName}; no provider call, real dispatch, or task launch.`,
					args,
					async execute(request) {
						const record: Record<string, unknown> = isRecord(request)
							? request
							: {};
						if (
							stub.toolName === "flowdesk_run" &&
							record.run_mode === "managed-dispatch"
						) {
							return JSON.stringify(
								await evaluateFlowDeskManagedDispatchRunRoute(
									record,
									managedDispatchRunRoute,
								),
							);
						}
						return JSON.stringify(session.evaluate(stub.toolName, request));
					},
				}),
			];
			if (stub.toolName === "flowdesk_plan") {
				const planShortEntry: FlowDeskOpenCodeToolEntry = [
					flowdeskPlanShortToolName,
					tool({
						description:
							"Create a compact FlowDesk plan record. Planning-only: no provider, dispatch, runtime/lane, write/apply, fallback, hard-chat, or SDK-scoped noReply control.",
						args: {
							goalSummary: tool.schema
								.string()
								.describe("Required planning goal summary."),
							scopeSummary: tool.schema
								.string()
								.optional()
								.describe("Optional bounded planning scope summary."),
							riskHint: tool.schema
								.string()
								.optional()
								.describe("Optional bounded planning risk hint."),
							workflowId: tool.schema
								.string()
								.optional()
								.describe("Optional workflow id to forward."),
							requestId: tool.schema
								.string()
								.optional()
								.describe("Optional bounded request id."),
						},
						async execute(request) {
							const record: Record<string, unknown> = isRecord(request)
								? request
								: {};
							const workflowId =
								typeof record.workflowId === "string" &&
								record.workflowId.trim().length > 0
									? record.workflowId
									: undefined;
							const lowLevelRequest = {
								schema_version: "flowdesk.plan.request.v1" as const,
								request_id: safeToken(
									record.requestId,
									`plan-${randomUUID()}`,
								),
								input_mode: "alias_command" as const,
								...(workflowId === undefined ? {} : { workflow_id: workflowId }),
								goal_summary: boundedText(
									typeof record.goalSummary === "string" ? record.goalSummary : "",
									"FlowDesk planning request.",
								),
								scope_summary: boundedText(
									typeof record.scopeSummary === "string" ? record.scopeSummary : "",
									"Compact command-backed planning scope.",
								),
								risk_hint: boundedText(
									typeof record.riskHint === "string" ? record.riskHint : "",
									"Planning-only; no execution authority requested.",
								),
							};
							return JSON.stringify(
								session.evaluate("flowdesk_plan", lowLevelRequest),
							);
						},
					}),
				];
				return [lowLevelEntry, planShortEntry];
			}
			if (stub.toolName === "flowdesk_run") {
				const runShortEntry: FlowDeskOpenCodeToolEntry = [
					flowdeskRunShortToolName,
					tool({
						description:
							"Run a compact FlowDesk command-backed run alias. Requires explicit runMode and planRevisionId; no provider call, lane launch, fallback, write, hard-chat, or SDK-scoped noReply control.",
						args: {
							runMode: tool.schema
								.enum(["guarded-dry-run", "fake-runtime", "managed-dispatch"])
								.describe("Required run mode to forward explicitly."),
							planRevisionId: tool.schema
								.string()
								.describe("Required plan revision id to run."),
							workflowId: tool.schema
								.string()
								.optional()
								.describe("Optional workflow id to forward."),
							stepId: tool.schema
								.string()
								.optional()
								.describe("Optional step id to forward."),
							requestId: tool.schema
								.string()
								.optional()
								.describe("Optional bounded request id."),
						},
						async execute(request) {
							const record: Record<string, unknown> = isRecord(request)
								? request
								: {};
							const workflowId =
								typeof record.workflowId === "string" &&
								record.workflowId.trim().length > 0
									? record.workflowId
									: undefined;
							const stepId =
								typeof record.stepId === "string" &&
								record.stepId.trim().length > 0
									? record.stepId
									: undefined;
							const lowLevelRequest = {
								schema_version: "flowdesk.run.request.v1" as const,
								request_id: safeToken(
									record.requestId,
									`run-short-${randomUUID()}`,
								),
								input_mode: "alias_command" as const,
								run_mode:
									record.runMode === "guarded-dry-run" ||
									record.runMode === "fake-runtime" ||
									record.runMode === "managed-dispatch"
										? record.runMode
										: "",
								plan_revision_id:
									typeof record.planRevisionId === "string"
										? record.planRevisionId
										: "",
								...(workflowId === undefined ? {} : { workflow_id: workflowId }),
								...(stepId === undefined ? {} : { step_id: stepId }),
							};
							if (lowLevelRequest.run_mode === "managed-dispatch") {
								return JSON.stringify(
									await evaluateFlowDeskManagedDispatchRunRoute(
										lowLevelRequest,
										managedDispatchRunRoute,
									),
								);
							}
							return JSON.stringify(
								session.evaluate("flowdesk_run", lowLevelRequest),
							);
						},
					}),
				];
				return [lowLevelEntry, runShortEntry];
			}
			if (stub.toolName === "flowdesk_export_debug") {
				const debugEntry: FlowDeskOpenCodeToolEntry = [
					flowdeskDebugToolName,
					tool({
						description:
							"Export a redacted FlowDesk debug bundle. Diagnostics only; no provider, dispatch, runtime/lane, fallback, write/apply, hard-chat, or SDK-scoped noReply control.",
						args: {
							includeSections: tool.schema
								.array(tool.schema.string())
								.max(7)
								.describe("Redacted debug sections to include."),
							retentionHint: tool.schema
								.enum([
									"delete_after_export",
									"keep_until_default_expiry",
									"keep_until_policy_expiry",
								])
								.optional()
								.describe(
									"Debug export retention; defaults to keep_until_default_expiry.",
								),
							requestId: tool.schema
								.string()
								.optional()
								.describe("Optional bounded request id."),
						},
						async execute(request) {
							const record: Record<string, unknown> = isRecord(request)
								? request
								: {};
							const lowLevelRequest = {
								schema_version: "flowdesk.export_debug.request.v1" as const,
								request_id: safeToken(
									record.requestId,
									`debug-${randomUUID()}`,
								),
								input_mode: "alias_command" as const,
								include_sections: Array.isArray(record.includeSections)
									? record.includeSections.filter(
										(section): section is string => typeof section === "string",
									)
									: [],
								retention_hint:
									record.retentionHint === "delete_after_export" ||
									record.retentionHint === "keep_until_default_expiry" ||
									record.retentionHint === "keep_until_policy_expiry"
										? record.retentionHint
										: "keep_until_default_expiry",
							};
							return JSON.stringify(
								session.evaluate("flowdesk_export_debug", lowLevelRequest),
							);
						},
					}),
				];
				return [lowLevelEntry, debugEntry];
			}
			if (stub.toolName === "flowdesk_resume") {
				const resumeStatusEntry: FlowDeskOpenCodeToolEntry = [
					flowdeskResumeStatusToolName,
					tool({
						description:
							"Preview FlowDesk resume checkpoint status. Diagnostics only; no provider, dispatch, runtime/lane, write/apply, fallback, hard-chat, or SDK-scoped noReply control.",
						args: {
							checkpointId: tool.schema
								.string()
								.describe("Required checkpoint id to inspect."),
							requestId: tool.schema
								.string()
								.optional()
								.describe("Optional bounded request id."),
						},
						async execute(request) {
							const record: Record<string, unknown> = isRecord(request)
								? request
								: {};
							const lowLevelRequest = {
								schema_version: "flowdesk.resume.request.v1" as const,
								request_id: safeToken(
									record.requestId,
									`resume-status-${randomUUID()}`,
								),
								input_mode: "alias_command" as const,
								checkpoint_id:
									typeof record.checkpointId === "string" ? record.checkpointId : "",
								resume_mode: "status_only" as const,
							};
							return JSON.stringify(
								session.evaluate("flowdesk_resume", lowLevelRequest),
							);
						},
					}),
				];
				return [lowLevelEntry, resumeStatusEntry];
			}
			if (stub.toolName === "flowdesk_retry") {
				const retryDiagEntry: FlowDeskOpenCodeToolEntry = [
					flowdeskRetryDiagToolName,
					tool({
						description:
							"Plan a bounded FlowDesk retry diagnostic. No provider, dispatch, runtime/lane, write/apply, fallback, hard-chat, or SDK-scoped noReply control.",
						args: {
							attemptId: tool.schema
								.string()
								.describe("Required attempt id to inspect for retry diagnostics."),
							retryReason: tool.schema
								.string()
								.optional()
								.describe("Optional bounded diagnostic retry reason."),
							newBindingHint: tool.schema
								.string()
								.optional()
								.describe("Optional bounded retry binding hint."),
							workflowId: tool.schema
								.string()
								.optional()
								.describe("Optional workflow id to forward."),
							requestId: tool.schema
								.string()
								.optional()
								.describe("Optional bounded request id."),
						},
						async execute(request) {
							const record: Record<string, unknown> = isRecord(request)
								? request
								: {};
							const workflowId =
								typeof record.workflowId === "string" &&
								record.workflowId.trim().length > 0
									? record.workflowId
									: undefined;
							const newBindingHint =
								typeof record.newBindingHint === "string" &&
								record.newBindingHint.trim().length > 0
									? boundedText(record.newBindingHint, "same-binding")
									: undefined;
							const lowLevelRequest = {
								schema_version: "flowdesk.retry.request.v1" as const,
								request_id: safeToken(
									record.requestId,
									`retry-diag-${randomUUID()}`,
								),
								input_mode: "alias_command" as const,
								...(workflowId === undefined ? {} : { workflow_id: workflowId }),
								attempt_id:
									typeof record.attemptId === "string" ? record.attemptId : "",
								retry_reason: boundedText(
									typeof record.retryReason === "string" ? record.retryReason : "",
									"FlowDesk retry diagnostic requested.",
								),
								...(newBindingHint === undefined
									? {}
									: { new_binding_hint: newBindingHint }),
							};
							return JSON.stringify(
								session.evaluate("flowdesk_retry", lowLevelRequest),
							);
						},
					}),
				];
				return [lowLevelEntry, retryDiagEntry];
			}
			if (stub.toolName === "flowdesk_abort") {
				const abortCmdEntry: FlowDeskOpenCodeToolEntry = [
					flowdeskAbortCmdToolName,
					tool({
						description:
							"Request a FlowDesk command-backed abort diagnostic/control action. No provider, dispatch, runtime/lane launch, write/apply, fallback, hard-chat, or SDK-scoped noReply control.",
						args: {
							workflowId: tool.schema
								.string()
								.describe("Required workflow id to abort diagnostically."),
							reason: tool.schema
								.string()
								.describe("Required bounded abort reason."),
							attemptId: tool.schema
								.string()
								.optional()
								.describe("Optional attempt id to forward."),
							laneId: tool.schema
								.string()
								.optional()
								.describe("Optional lane id to forward."),
							requestId: tool.schema
								.string()
								.optional()
								.describe("Optional bounded request id."),
						},
						async execute(request) {
							const record: Record<string, unknown> = isRecord(request)
								? request
								: {};
							const attemptId =
								typeof record.attemptId === "string" &&
								record.attemptId.trim().length > 0
									? boundedText(record.attemptId, "attempt")
									: undefined;
							const laneId =
								typeof record.laneId === "string" &&
								record.laneId.trim().length > 0
									? boundedText(record.laneId, "lane")
									: undefined;
							const lowLevelRequest = {
								schema_version: "flowdesk.abort.request.v1" as const,
								request_id: safeToken(
									record.requestId,
									`abort-cmd-${randomUUID()}`,
								),
								input_mode: "alias_command" as const,
								workflow_id:
									typeof record.workflowId === "string" ? record.workflowId : "",
								reason: boundedText(
									typeof record.reason === "string" ? record.reason : "",
									"FlowDesk abort diagnostic requested.",
								),
								...(attemptId === undefined ? {} : { attempt_id: attemptId }),
								...(laneId === undefined ? {} : { lane_id: laneId }),
							};
							return JSON.stringify(
								session.evaluate("flowdesk_abort", lowLevelRequest),
							);
						},
					}),
				];
				return [lowLevelEntry, abortCmdEntry];
			}
			if (stub.toolName !== "flowdesk_doctor") return [lowLevelEntry];
			const checkEntry: FlowDeskOpenCodeToolEntry = [
				flowdeskCheckToolName,
				tool({
					description:
						"Run FlowDesk doctor diagnostics with compact defaults; command-backed only, no provider call, dispatch, task launch, fallback, write/apply, hard-chat, or SDK-scoped noReply control.",
					args: {
						checkScope: tool.schema
							.enum([
								"install",
								"runtime",
								"policy",
								"usage",
								"provider_health",
								"conformance",
								"all",
							])
							.optional()
							.describe("Doctor check scope; defaults to all."),
						profile: tool.schema
							.enum(["production", "development", "test"])
							.optional()
							.describe("Doctor profile; defaults to production."),
						persistReport: tool.schema
							.boolean()
							.optional()
							.describe("Persist a diagnostic report when true; defaults to false."),
						requestId: tool.schema
							.string()
							.optional()
							.describe("Optional bounded request id."),
					},
					async execute(request) {
						const record: Record<string, unknown> = isRecord(request)
							? request
							: {};
						const lowLevelRequest = {
							schema_version: "flowdesk.doctor.request.v1" as const,
							request_id: safeToken(
								record.requestId,
								`check-${randomUUID()}`,
							),
							input_mode: "alias_command" as const,
							check_scope:
								record.checkScope === "install" ||
								record.checkScope === "runtime" ||
								record.checkScope === "policy" ||
								record.checkScope === "usage" ||
								record.checkScope === "provider_health" ||
								record.checkScope === "conformance" ||
								record.checkScope === "all"
									? record.checkScope
									: "all",
							profile:
								record.profile === "production" ||
								record.profile === "development" ||
								record.profile === "test"
									? record.profile
									: "production",
							persist_report:
								typeof record.persistReport === "boolean"
									? record.persistReport
									: false,
						};
						return JSON.stringify(
							session.evaluate("flowdesk_doctor", lowLevelRequest),
						);
					},
				}),
			];
			return [lowLevelEntry, checkEntry];
		});
	return Object.fromEntries(entries);
}

export function createFlowDeskNaturalLanguageRoutingTools(
	now = new Date(),
	session = createFlowDeskLocalNonDispatchAdapterSession(now),
	chatIntakeGate: FlowDeskChatIntakeModeGateV1 = defaultChatIntakeModeGate(),
): Record<string, FlowDeskOpenCodeTool> {
	const artifact = getRelease1SchemaArtifact("flowdesk.chat_intake.request.v1");
	if (artifact === undefined)
		throw new Error(
			"missing FDS-1 schema artifact: flowdesk.chat_intake.request.v1",
		);
	const required = new Set(artifact.required);
	const args = Object.fromEntries(
		Object.keys(artifact.properties).map((fieldName) => [
			fieldName,
			zodForSchemaProperty(
				"flowdesk.chat_intake.request.v1",
				fieldName,
				required.has(fieldName),
			),
		]),
	) as FlowDeskOpenCodeToolArgs;
	return {
		[flowdeskChatIntakeToolName]: tool({
			description:
				"FlowDesk natural-language chat intake steering; command-backed only, with no provider call, real dispatch, task launch, fallback, or hard chat control.",
			args,
			async execute(request) {
				return JSON.stringify(
						evaluateNaturalLanguageRouting(
						request as unknown as FlowDeskChatIntakeRequestV1,
						session,
						chatIntakeGate.effectiveMode,
					),
				);
			},
		}),
	};
}

function redactedManagedDispatchBetaToolResult(
	result: FlowDeskManagedDispatchBetaAdapterResultV1,
): Record<string, unknown> {
	return {
		// internal identifier — not user-facing
		adapterProfile: result.adapterProfile,
		status: result.status,
		dispatchAttempted: result.dispatchAttempted,
		guardDecision: result.guardDecision,
		authority: result.authority,
		verification: result.verification,
		...(result.dispatchAttempted
			? {
					dispatchMethod: result.dispatchMethod,
					sessionId: result.sessionId,
					agent: result.agent,
					model: result.model,
					...(!("laneId" in result) || result.laneId === undefined
						? {}
						: { laneId: result.laneId }),
					...(!("childSessionRef" in result) || result.childSessionRef === undefined
						? {}
						: { childSessionRef: result.childSessionRef }),
					...(!("messageRef" in result) || result.messageRef === undefined
						? {}
						: { messageRef: result.messageRef }),
					...("redactedErrorCategory" in result
						? { redactedErrorCategory: result.redactedErrorCategory }
						: {}),
					responseObserved:
						"response" in result && result.response !== undefined,
				}
			: { redactedBlockReason: result.redactedBlockReason }),
	};
}

function redactedExactModelProviderAcquisitionToolResult(
	result: Awaited<
		ReturnType<typeof runFlowDeskExactModelProviderAcquisitionLiveTestV1>
	>,
	cacheMaterialization?: {
		options: FlowDeskExactModelProviderAcquisitionCacheMaterializationOptionsV1;
		result: ReturnType<
			typeof materializeFlowDeskExactModelCacheEvidenceFromProviderAcquisitionEvidenceV1
		>;
		fanout?: {
			options: FlowDeskProviderAcquisitionReviewerFanoutPlanningOptionsV1;
			result: FlowDeskReviewerFanoutFromReloadedCacheEvidencePlanV1;
			persistedEvidenceId?: string;
			persisted: boolean;
			persistErrors: string[];
			runtimeLaunchPlans?: {
				options: FlowDeskProviderAcquisitionRuntimeLaunchPlanMaterializationOptionsV1;
				result: ReturnType<
					typeof materializeFlowDeskRuntimeLaneLaunchPlansFromReviewerFanoutEvidenceV1
				>;
				runtimeReviewerExecution?: {
					options: FlowDeskProviderAcquisitionRuntimeReviewerExecutionOptionsV1;
					result: Record<string, unknown>;
				};
			};
		};
	},
): Record<string, unknown> {
	return {
		// internal identifier — not user-facing
		adapterProfile: result.adapterProfile,
		status: result.status,
		providerCallAttempted: result.providerCallAttempted,
		writeAttempted: result.writeAttempted,
		evidenceReloaded: result.evidenceReloaded,
		workflowId: result.workflowId,
		evidenceId: result.evidenceId,
		resultId: result.resultId,
		providerQualifiedModelId: result.providerQualifiedModelId,
		redactedBlockReason: result.redactedBlockReason,
		authority: result.authority,
		resultState: result.result?.state,
		available: result.result?.available,
		highestTierEligible: result.result?.highest_tier_eligible,
		sanitizedProviderResultRef: result.result?.sanitized_provider_result_ref,
		availabilityRef: result.result?.availability_ref,
		blockedLabels: result.result?.blocked_labels,
		...(cacheMaterialization === undefined
			? {}
			: {
					cacheMaterialization: {
						state: cacheMaterialization.result.state,
						blockedLabels: cacheMaterialization.result.blocked_labels,
						targetCacheEvidenceId:
							cacheMaterialization.options.targetCacheEvidenceId,
						targetCacheRefreshPlanEvidenceId:
							cacheMaterialization.options.targetCacheRefreshPlanEvidenceId,
						cacheId:
							cacheMaterialization.result.cache?.cache_id ??
							cacheMaterialization.options.cacheId,
						entryId:
							cacheMaterialization.result.cache?.entries[0]?.entry_id ??
							cacheMaterialization.options.entryId,
						availabilityRef:
							cacheMaterialization.result.cache?.entries[0]?.availability_ref,
						sanitizedProviderResultRef:
							cacheMaterialization.result.cache?.entries[0]
								?.availability_ref === undefined
								? undefined
								: result.result?.sanitized_provider_result_ref,
						selectionState: cacheMaterialization.result.selection?.state,
						pairSelectionReady:
							cacheMaterialization.result.selection?.state === "pair_ready",
						...(cacheMaterialization.fanout === undefined
							? {}
							: {
									reviewerFanoutPlanning: {
										state: cacheMaterialization.fanout.result.state,
										blockedLabels:
											cacheMaterialization.fanout.result.blocked_labels,
										fanoutPlanState:
											cacheMaterialization.fanout.result.fanoutPlan.state,
										plannedPerspectives:
											cacheMaterialization.fanout.result.fanoutPlan
												.planned_perspectives,
										runtimeLaneLaunchRequests:
											cacheMaterialization.fanout.result.fanoutPlan
												.runtime_lane_launch_requests.length,
										launchAttempted:
											cacheMaterialization.fanout.result.fanoutPlan
												.launch_attempted,
										approvalInferred:
											cacheMaterialization.fanout.result.fanoutPlan
												.approval_inferred,
										actualLaneLaunch:
											cacheMaterialization.fanout.result.fanoutPlan
												.actualLaneLaunch,
										providerCall:
											cacheMaterialization.fanout.result.fanoutPlan
												.providerCall,
										runtimeExecution:
											cacheMaterialization.fanout.result.fanoutPlan
												.runtimeExecution,
										persisted: cacheMaterialization.fanout.persisted,
										persistedEvidenceId:
											cacheMaterialization.fanout.persistedEvidenceId,
										persistErrors: cacheMaterialization.fanout.persistErrors,
										...(cacheMaterialization.fanout.runtimeLaunchPlans ===
										undefined
											? {}
											: {
													runtimeLaunchPlanMaterialization: {
														state:
															cacheMaterialization.fanout.runtimeLaunchPlans
																.result.state,
														blockedLabels:
															cacheMaterialization.fanout.runtimeLaunchPlans
																.result.blocked_labels,
														targetLaunchPlanEvidenceIds:
															cacheMaterialization.fanout.runtimeLaunchPlans
																.options.targetLaunchPlanEvidenceIds,
														launchPlanStates:
															cacheMaterialization.fanout.runtimeLaunchPlans.result.launchPlans.map(
																(plan) => plan.state,
															),
														launchPlanCount:
															cacheMaterialization.fanout.runtimeLaunchPlans
																.result.launchPlans.length,
														writeIntentCount:
															cacheMaterialization.fanout.runtimeLaunchPlans
																.result.writeIntents.length,
														launchAttempted:
															cacheMaterialization.fanout.runtimeLaunchPlans.result.launchPlans.some(
																(plan) => plan.launch_attempted,
															),
														actualLaneLaunch:
															cacheMaterialization.fanout.runtimeLaunchPlans
																.result.actualLaneLaunch,
														providerCall:
															cacheMaterialization.fanout.runtimeLaunchPlans
																.result.providerCall,
														runtimeExecution:
															cacheMaterialization.fanout.runtimeLaunchPlans
																.result.runtimeExecution,
														...(cacheMaterialization.fanout.runtimeLaunchPlans
															.runtimeReviewerExecution === undefined
															? {}
															: {
																	runtimeReviewerExecution: {
																		status:
																			cacheMaterialization.fanout
																				.runtimeLaunchPlans
																				.runtimeReviewerExecution.result.status,
																		laneCount:
																			cacheMaterialization.fanout
																				.runtimeLaunchPlans
																				.runtimeReviewerExecution.result
																				.laneCount,
																		acceptanceStatus:
																			cacheMaterialization.fanout
																				.runtimeLaunchPlans
																				.runtimeReviewerExecution.result
																				.acceptanceStatus,
																		acceptedPerspectives:
																			cacheMaterialization.fanout
																				.runtimeLaunchPlans
																				.runtimeReviewerExecution.result
																				.acceptedPerspectives,
																		durableLinkageStatus:
																			cacheMaterialization.fanout
																				.runtimeLaunchPlans
																				.runtimeReviewerExecution.result
																				.durableLinkageStatus,
																		linkedVerdictCount:
																			cacheMaterialization.fanout
																				.runtimeLaunchPlans
																				.runtimeReviewerExecution.result
																				.linkedVerdictCount,
																		linkedLifecycleCount:
																			cacheMaterialization.fanout
																				.runtimeLaunchPlans
																				.runtimeReviewerExecution.result
																				.linkedLifecycleCount,
																		redactedBlockReason:
																			cacheMaterialization.fanout
																				.runtimeLaunchPlans
																				.runtimeReviewerExecution.result
																				.redactedBlockReason,
																	},
																}),
													},
												}),
									},
								}),
					},
				}),
	};
}

function providerAcquisitionRuntimeReviewerExecutionFromValue(
	value: unknown,
): FlowDeskProviderAcquisitionRuntimeReviewerExecutionOptionsV1 | undefined {
	if (!isRecord(value) || value.enabled !== true) return undefined;
	if (
		typeof value.attemptId !== "string" ||
		value.attemptId.trim().length === 0 ||
		typeof value.parentSessionId !== "string" ||
		value.parentSessionId.trim().length === 0 ||
		!isRecord(value.consumedReviewerFanoutApproval)
	)
		return undefined;
	const expectations = runtimeReviewerExecutionExpectationsFromValue(
		value.verdictExpectations,
	);
	if (expectations === undefined || expectations.length === 0) return undefined;
	return {
		enabled: true,
		attemptId: value.attemptId,
		parentSessionId: value.parentSessionId,
		...(typeof value.observedAt === "string" &&
		value.observedAt.trim().length > 0
			? { observedAt: value.observedAt }
			: {}),
		consumedReviewerFanoutApproval:
			value.consumedReviewerFanoutApproval as unknown as FlowDeskProductionApprovalSourceV1,
		verdictExpectations: expectations,
	};
}

function providerAcquisitionRuntimeLaunchPlanMaterializationFromValue(
	value: unknown,
):
	| FlowDeskProviderAcquisitionRuntimeLaunchPlanMaterializationOptionsV1
	| undefined {
	if (!isRecord(value) || value.enabled !== true) return undefined;
	if (
		!Array.isArray(value.targetLaunchPlanEvidenceIds) ||
		value.targetLaunchPlanEvidenceIds.length === 0 ||
		!value.targetLaunchPlanEvidenceIds.every(
			(entry) => typeof entry === "string" && entry.trim().length > 0,
		)
	)
		return undefined;
	const runtimeReviewerExecution =
		providerAcquisitionRuntimeReviewerExecutionFromValue(
			value.runtimeReviewerExecution,
		);
	return {
		enabled: true,
		targetLaunchPlanEvidenceIds: value.targetLaunchPlanEvidenceIds,
		...(typeof value.sdkClientAvailable === "boolean"
			? { sdkClientAvailable: value.sdkClientAvailable }
			: {}),
		...(typeof value.durableEvidenceRootRef === "string" &&
		value.durableEvidenceRootRef.trim().length > 0
			? { durableEvidenceRootRef: value.durableEvidenceRootRef }
			: {}),
		...(runtimeReviewerExecution === undefined
			? {}
			: { runtimeReviewerExecution }),
	};
}

function providerAcquisitionReviewerFanoutPlanningFromValue(
	value: unknown,
): FlowDeskProviderAcquisitionReviewerFanoutPlanningOptionsV1 | undefined {
	if (!isRecord(value) || value.enabled !== true) return undefined;
	if (
		typeof value.attemptId !== "string" ||
		value.attemptId.trim().length === 0 ||
		typeof value.parentSessionRef !== "string" ||
		value.parentSessionRef.trim().length === 0 ||
		typeof value.agentRef !== "string" ||
		value.agentRef.trim().length === 0
	)
		return undefined;
	const runtimeLaunchPlanMaterialization =
		providerAcquisitionRuntimeLaunchPlanMaterializationFromValue(
			value.runtimeLaunchPlanMaterialization,
		);
	return {
		enabled: true,
		attemptId: value.attemptId,
		parentSessionRef: value.parentSessionRef,
		agentRef: value.agentRef,
		...(typeof value.requestedAt === "string" &&
		value.requestedAt.trim().length > 0
			? { requestedAt: value.requestedAt }
			: {}),
		...(Array.isArray(value.requestedPerspectives) &&
		value.requestedPerspectives.every((entry) => typeof entry === "string")
			? {
					requestedPerspectives:
						value.requestedPerspectives as FlowDeskProviderAcquisitionReviewerFanoutPlanningOptionsV1["requestedPerspectives"],
				}
			: {}),
		...(typeof value.maxConcurrentLaneCount === "number"
			? { maxConcurrentLaneCount: value.maxConcurrentLaneCount }
			: {}),
		...(typeof value.timeoutMs === "number"
			? { timeoutMs: value.timeoutMs }
			: {}),
		...(typeof value.orphanMaxAgeMs === "number"
			? { orphanMaxAgeMs: value.orphanMaxAgeMs }
			: {}),
		...(typeof value.retryBudget === "number"
			? { retryBudget: value.retryBudget }
			: {}),
		...(typeof value.preLaunchAuditRef === "string"
			? { preLaunchAuditRef: value.preLaunchAuditRef }
			: {}),
		...(typeof value.laneLaunchApprovalRef === "string"
			? { laneLaunchApprovalRef: value.laneLaunchApprovalRef }
			: {}),
		...(value.persistDerivedFanoutPlanEvidence === true
			? { persistDerivedFanoutPlanEvidence: true }
			: {}),
		...(typeof value.fanoutPlanEvidenceId === "string" &&
		value.fanoutPlanEvidenceId.trim().length > 0
			? { fanoutPlanEvidenceId: value.fanoutPlanEvidenceId }
			: {}),
		...(runtimeLaunchPlanMaterialization === undefined
			? {}
			: { runtimeLaunchPlanMaterialization }),
	};
}

function exactModelProviderAcquisitionCacheMaterializationFromOptions(
	options?: PluginOptions,
):
	| FlowDeskExactModelProviderAcquisitionCacheMaterializationOptionsV1
	| undefined {
	const value = options?.[flowdeskExactModelProviderAcquisitionLiveTestOption];
	if (!isRecord(value) || !isRecord(value.cacheMaterialization))
		return undefined;
	const cacheMaterialization = value.cacheMaterialization;
	if (
		cacheMaterialization.enabled !== true ||
		typeof cacheMaterialization.targetCacheEvidenceId !== "string" ||
		cacheMaterialization.targetCacheEvidenceId.trim().length === 0 ||
		typeof cacheMaterialization.targetCacheRefreshPlanEvidenceId !== "string" ||
		cacheMaterialization.targetCacheRefreshPlanEvidenceId.trim().length === 0
	)
		return undefined;
	const reviewerFanoutPlanning =
		providerAcquisitionReviewerFanoutPlanningFromValue(
			cacheMaterialization.reviewerFanoutPlanning,
		);
	return {
		enabled: true,
		targetCacheEvidenceId: cacheMaterialization.targetCacheEvidenceId,
		targetCacheRefreshPlanEvidenceId:
			cacheMaterialization.targetCacheRefreshPlanEvidenceId,
		...(typeof cacheMaterialization.cacheId === "string" &&
		cacheMaterialization.cacheId.trim().length > 0
			? { cacheId: cacheMaterialization.cacheId }
			: {}),
		...(typeof cacheMaterialization.entryId === "string" &&
		cacheMaterialization.entryId.trim().length > 0
			? { entryId: cacheMaterialization.entryId }
			: {}),
		...(reviewerFanoutPlanning === undefined ? {} : { reviewerFanoutPlanning }),
	};
}

function providerAcquisitionFanoutPlanEvidenceId(
	workflowId: string,
	plan: FlowDeskReviewerFanoutFromReloadedCacheEvidencePlanV1,
): string {
	return safeToken(
		`reviewer-fanout-plan-${workflowId}-${plan.fanoutPlan.attempt_id}-${plan.fanoutPlan.cache_id ?? "cache"}`,
		"reviewer-fanout-plan",
	);
}

function persistProviderAcquisitionReviewerFanoutPlanEvidence(input: {
	rootDir: string;
	workflowId: string;
	evidenceId: string;
	plan: FlowDeskReviewerFanoutFromReloadedCacheEvidencePlanV1;
}): { persisted: boolean; errors: string[] } {
	if (input.plan.state !== "fanout_ready" || !input.plan.ok)
		return { persisted: false, errors: ["reviewer fanout plan is not ready"] };
	const prepared = prepareFlowDeskSessionEvidenceWriteIntentV1({
		workflowId: input.workflowId,
		evidenceId: input.evidenceId,
		record: input.plan.fanoutPlan as unknown as Record<string, unknown>,
	});
	if (!prepared.ok || prepared.writeIntent === undefined)
		return { persisted: false, errors: prepared.errors };
	const applied = applyFlowDeskSessionEvidenceWriteIntentsV1(input.rootDir, [
		prepared.writeIntent,
	]);
	return { persisted: applied.ok, errors: applied.errors };
}

function blockedManagedDispatchRunRoute(
	redactedBlockReason: string,
	defaultAuthorization?: FlowDeskDefaultManagedDispatchAuthorizationV1,
): Record<string, unknown> {
	return {
		runRouteProfile: "flowdesk_run_default_managed_dispatch_route",
		status: "blocked_before_dispatch",
		dispatchAttempted: false,
		redactedBlockReason,
		...(defaultAuthorization === undefined
			? {}
			: {
					defaultManagedDispatchAuthorizationRef:
						defaultAuthorization.authorization_id,
					defaultManagedDispatchReadinessRef:
						defaultAuthorization.readiness_ref,
				}),
		authority: { ...disabledAuthority, toolAuthority: false },
		verification: {
			defaultManagedDispatchAuthorizationRequired: true,
			managedDispatchAdapterGateRequired: true,
			defaultRelease1NonDispatchModesUnchanged: true,
		},
	};
}

async function evaluateFlowDeskManagedDispatchRunRoute(
	request: Record<string, unknown>,
	options: FlowDeskManagedDispatchRunRouteOptionsV1 = {},
): Promise<Record<string, unknown>> {
	const requestValidation = validateRunRequestV1(request);
	if (!requestValidation.ok) {
		return blockedManagedDispatchRunRoute(
			"/flowdesk-run managed-dispatch requires a valid flowdesk.run.request.v1 envelope before dispatch routing.",
			options.defaultAuthorization,
		);
	}
	const authorization =
		options.defaultAuthorization ?? options.deriveDefaultAuthorization?.(request);
	const authorizationResult =
		authorization === undefined
			? undefined
			: validateFlowDeskDefaultManagedDispatchAuthorizationV1(authorization);
	if (
		authorization === undefined ||
		authorizationResult?.ok !== true ||
		authorization.state !== "authorized" ||
		authorization.default_managed_dispatch_authority_enabled !== true
	) {
		return blockedManagedDispatchRunRoute(
			"/flowdesk-run managed-dispatch requires a valid default managed-dispatch authorization.",
			authorization,
		);
	}
	if (options.client === undefined) {
		return blockedManagedDispatchRunRoute(
			"/flowdesk-run managed-dispatch requires an injected OpenCode SDK client.",
			authorization,
		);
	}
	if (
		!isRecord(request.managed_dispatch_boundary_input) ||
		!isRecord(request.managed_dispatch_request) ||
		!isRecord(request.managed_dispatch_manifest)
	) {
		return blockedManagedDispatchRunRoute(
			"/flowdesk-run managed-dispatch requires boundary input, dispatch request, and dispatch manifest records.",
			authorization,
		);
	}
	const boundaryInput =
		request.managed_dispatch_boundary_input as unknown as ManagedDispatchBetaBoundaryInputV1;
	const reloadedEvidence = isRecord(request.managed_dispatch_reloaded_evidence)
		? (request.managed_dispatch_reloaded_evidence as unknown as FlowDeskSessionEvidenceReloadResultV1)
		: options.durableStateRootDir !== undefined &&
				typeof boundaryInput.workflowId === "string"
			? reloadFlowDeskSessionEvidenceV1({
					workflowId: boundaryInput.workflowId,
					rootDir: options.durableStateRootDir,
				})
			: undefined;
	const result = await dispatchManagedDispatchBetaPromptV1({
		client: options.client,
		boundaryInput,
		request:
			request.managed_dispatch_request as unknown as FlowDeskManagedDispatchBetaDispatchRequestV1,
		dispatchManifest:
			request.managed_dispatch_manifest as unknown as FlowDeskDispatchAttemptManifestV1,
		...(reloadedEvidence === undefined ? {} : { reloadedEvidence }),
		...(options.reservationStore === undefined
			? {}
			: { reservationStore: options.reservationStore }),
		...(options.durableStateRootDir === undefined
			? {}
			: { durableStateRootDir: options.durableStateRootDir }),
	});
	return {
		runRouteProfile: "flowdesk_run_default_managed_dispatch_route",
		defaultManagedDispatchAuthorizationRef: authorization.authorization_id,
		defaultManagedDispatchReadinessRef: authorization.readiness_ref,
		...redactedManagedDispatchBetaToolResult(result),
	};
}

export function createFlowDeskManagedDispatchBetaOptInTools(
	client: FlowDeskManagedDispatchBetaOpenCodeClientV1,
	reservationStore?: FlowDeskManagedDispatchBetaReservationStoreV1,
	durableStateRootDir?: string,
): Record<string, FlowDeskOpenCodeTool> {
	return {
		[flowdeskManagedDispatchBetaToolName]: tool({
			description:
				"FlowDesk Release 2 managed-dispatch beta opt-in tool; requires full Guard evidence and calls only the injected OpenCode SDK client without fallback.",
			args: {
				boundaryInput: tool.schema
					.record(tool.schema.string(), tool.schema.unknown())
					.describe(
						"Complete ManagedDispatchBetaBoundaryInputV1 evidence bundle; no raw prompts or provider payloads.",
					),
				request: tool.schema
					.record(tool.schema.string(), tool.schema.unknown())
					.describe(
						"Bounded managed dispatch request with session, agent, provider-qualified model id, and approved prompt summary/text.",
					),
				dispatchManifest: tool.schema
					.record(tool.schema.string(), tool.schema.unknown())
					.describe(
						"Committed dispatch attempt manifest binding approval, audit, idempotency, and disabled authority flags.",
					),
				reloadedEvidence: tool.schema
					.record(tool.schema.string(), tool.schema.unknown())
					.optional()
					.describe(
						"Optional preloaded durable session evidence. If omitted, FlowDesk reloads evidence from the configured durableStateRoot.",
					),
			},
			async execute(input) {
				const record: Record<string, unknown> = isRecord(input) ? input : {};
				if (
					!isRecord(record.boundaryInput) ||
					!isRecord(record.request) ||
					!isRecord(record.dispatchManifest)
				) {
					return JSON.stringify({
						// internal identifier — not user-facing
						adapterProfile:
							"managed_dispatch_beta_real_opencode_dispatch_adapter",
						status: "blocked_before_dispatch",
						dispatchAttempted: false,
						redactedBlockReason:
							"Managed-dispatch beta requires boundaryInput, request, and dispatchManifest records.",
						authority: { ...disabledAuthority, toolAuthority: false },
						verification: { defaultRelease1ServerBehaviorUnchanged: true },
					});
				}
				const boundaryInput =
					record.boundaryInput as unknown as ManagedDispatchBetaBoundaryInputV1;
				const reloadedEvidence = isRecord(record.reloadedEvidence)
					? (record.reloadedEvidence as unknown as FlowDeskSessionEvidenceReloadResultV1)
					: durableStateRootDir !== undefined &&
							typeof boundaryInput.workflowId === "string"
						? reloadFlowDeskSessionEvidenceV1({
								workflowId: boundaryInput.workflowId,
								rootDir: durableStateRootDir,
							})
						: undefined;
				const result = await dispatchManagedDispatchBetaPromptV1({
					client,
					boundaryInput,
					request:
						record.request as unknown as FlowDeskManagedDispatchBetaDispatchRequestV1,
					dispatchManifest:
						record.dispatchManifest as unknown as FlowDeskDispatchAttemptManifestV1,
					...(reloadedEvidence === undefined ? {} : { reloadedEvidence }),
			...(reservationStore === undefined ? {} : { reservationStore }),
			...(durableStateRootDir === undefined ? {} : { durableStateRootDir }),
		});
				return JSON.stringify(redactedManagedDispatchBetaToolResult(result));
			},
		}),
		[flowdeskManagedDispatchLaneFinalizeToolName]: tool({
			description:
				"FlowDesk managed-dispatch lane finalize observer; reads a launched managed-dispatch lane's child session once and records terminal task_result + lane_lifecycle evidence. Observation-only: never nudges, aborts, or enables dispatch/provider/runtime/fallback authority.",
			args: {
				workflowId: tool.schema.string().describe("Workflow id that owns the managed-dispatch lane."),
				laneId: tool.schema.string().describe("Lane id of the launched managed-dispatch lane."),
				attemptId: tool.schema.string().describe("Attempt id bound to the lane."),
				childSessionId: tool.schema.string().describe("Child session id to observe (raw OpenCode id)."),
				agentRef: tool.schema.string().describe("Agent ref bound to the lane."),
				providerQualifiedModelId: tool.schema.string().describe("Concrete provider-qualified model id for the lane."),
				parentSessionRef: tool.schema.string().optional().describe("Optional parent ses- ref for lifecycle evidence."),
			},
			async execute(input) {
				const record: Record<string, unknown> = isRecord(input) ? input : {};
				if (durableStateRootDir === undefined) {
					return JSON.stringify({
						// internal identifier — not user-facing
						adapterProfile: "managed_dispatch_lane_finalize_observer",
						status: "blocked_before_finalize",
						redactedBlockReason: "managed-dispatch lane finalize requires a configured durable state root.",
						authority: { ...disabledAuthority, toolAuthority: false },
					});
				}
				const result = await observeAndFinalizeManagedDispatchLaneV1({
					client,
					rootDir: durableStateRootDir,
					workflowId: String(record.workflowId ?? ""),
					laneId: String(record.laneId ?? ""),
					attemptId: String(record.attemptId ?? ""),
					childSessionId: String(record.childSessionId ?? ""),
					agentRef: String(record.agentRef ?? "agent-managed-dispatch"),
					providerQualifiedModelId: String(record.providerQualifiedModelId ?? "unknown/unknown"),
					...(typeof record.parentSessionRef === "string" ? { parentSessionRef: record.parentSessionRef } : {}),
				});
				return JSON.stringify(result);
			},
		}),
	};
}

export function createFlowDeskExactModelProviderAcquisitionLiveTestOptInTools(
	client: FlowDeskExactModelProviderAcquisitionClientV1,
	rootDir: string,
	cacheMaterialization?: FlowDeskExactModelProviderAcquisitionCacheMaterializationOptionsV1,
	runtimeReviewerExecutionClient?: FlowDeskManagedDispatchBetaOpenCodeClientV1,
): Record<string, FlowDeskOpenCodeTool> {
	return {
		[flowdeskExactModelProviderAcquisitionLiveTestToolName]: tool({
			description:
				"FlowDesk exact-model provider acquisition live-test opt-in tool; performs one bounded provider availability check and writes sanitized session evidence without dispatch or reviewer launch.",
			args: {
				request: tool.schema
					.record(tool.schema.string(), tool.schema.unknown())
					.describe(
						"Complete FlowDeskExactModelProviderAcquisitionLiveTestRequestV1 with acquisition_plan, profile/auth boundary refs, redaction proof, pre-call audit, idempotency, and exact provider-qualified model.",
					),
			},
			async execute(input) {
				const record: Record<string, unknown> = isRecord(input) ? input : {};
				if (!isRecord(record.request)) {
					return JSON.stringify({
						// internal identifier — not user-facing
						adapterProfile:
							"exact_model_provider_acquisition_live_test_adapter",
						status: "blocked_before_provider_acquisition",
						providerCallAttempted: false,
						writeAttempted: false,
						evidenceReloaded: false,
						redactedBlockReason:
							"Exact-model provider acquisition live-test requires a request record.",
						authority: { ...disabledAuthority, toolAuthority: false },
					});
				}
				const request =
					record.request as unknown as FlowDeskExactModelProviderAcquisitionLiveTestRequestV1;
				const result = await runFlowDeskExactModelProviderAcquisitionLiveTestV1(
					{
						client,
						rootDir,
						request,
					},
				);
				const materializationResult =
					cacheMaterialization !== undefined && result.evidenceReloaded === true
						? materializeFlowDeskExactModelCacheEvidenceFromProviderAcquisitionEvidenceV1(
								{
									reloadedEvidence: reloadFlowDeskSessionEvidenceV1({
										workflowId: request.workflowId,
										rootDir,
									}),
									workflowId: request.workflowId,
									providerAcquisitionEvidenceId: request.evidenceId,
									targetCacheEvidenceId:
										cacheMaterialization.targetCacheEvidenceId,
									targetCacheRefreshPlanEvidenceId:
										cacheMaterialization.targetCacheRefreshPlanEvidenceId,
									...(cacheMaterialization.cacheId === undefined
										? {}
										: { cacheId: cacheMaterialization.cacheId }),
									...(cacheMaterialization.entryId === undefined
										? {}
										: { entryId: cacheMaterialization.entryId }),
									rootDir,
									localDate: request.localDate,
									activeProfileRef: request.activeProfileRef,
									opencodeVersionRef: request.opencodeVersionRef,
									flowdeskPackageVersionRef: request.flowdeskPackageVersionRef,
									registryHash: request.registryHash,
									policyPackHash: request.policyPackHash,
									authAccountBoundaryRef: request.authAccountBoundaryRef,
								},
							)
						: undefined;
				const fanoutResult =
					cacheMaterialization?.reviewerFanoutPlanning !== undefined &&
					materializationResult?.state === "materialized" &&
					materializationResult.reloadedEvidence !== undefined
						? planFlowDeskReviewerFanoutFromReloadedCacheEvidenceV1({
								reloadedEvidence: materializationResult.reloadedEvidence,
								workflowId: request.workflowId,
								localDate: request.localDate,
								activeProfileRef: request.activeProfileRef,
								opencodeVersionRef: request.opencodeVersionRef,
								flowdeskPackageVersionRef: request.flowdeskPackageVersionRef,
								registryHash: request.registryHash,
								policyPackHash: request.policyPackHash,
								authAccountBoundaryRef: request.authAccountBoundaryRef,
								attemptId:
									cacheMaterialization.reviewerFanoutPlanning.attemptId,
								parentSessionRef:
									cacheMaterialization.reviewerFanoutPlanning.parentSessionRef,
								agentRef: cacheMaterialization.reviewerFanoutPlanning.agentRef,
								requestedAt:
									cacheMaterialization.reviewerFanoutPlanning.requestedAt ??
									request.observedAt,
								...(cacheMaterialization.reviewerFanoutPlanning
									.requestedPerspectives === undefined
									? {}
									: {
											requestedPerspectives:
												cacheMaterialization.reviewerFanoutPlanning
													.requestedPerspectives,
										}),
								...(cacheMaterialization.reviewerFanoutPlanning
									.maxConcurrentLaneCount === undefined
									? {}
									: {
											maxConcurrentLaneCount:
												cacheMaterialization.reviewerFanoutPlanning
													.maxConcurrentLaneCount,
										}),
								...(cacheMaterialization.reviewerFanoutPlanning.timeoutMs ===
								undefined
									? {}
									: {
											timeoutMs:
												cacheMaterialization.reviewerFanoutPlanning.timeoutMs,
										}),
								...(cacheMaterialization.reviewerFanoutPlanning
									.orphanMaxAgeMs === undefined
									? {}
									: {
											orphanMaxAgeMs:
												cacheMaterialization.reviewerFanoutPlanning
													.orphanMaxAgeMs,
										}),
								...(cacheMaterialization.reviewerFanoutPlanning.retryBudget ===
								undefined
									? {}
									: {
											retryBudget:
												cacheMaterialization.reviewerFanoutPlanning.retryBudget,
										}),
								...(cacheMaterialization.reviewerFanoutPlanning
									.preLaunchAuditRef === undefined
									? {}
									: {
											preLaunchAuditRef:
												cacheMaterialization.reviewerFanoutPlanning
													.preLaunchAuditRef,
										}),
								...(cacheMaterialization.reviewerFanoutPlanning
									.laneLaunchApprovalRef === undefined
									? {}
									: {
											laneLaunchApprovalRef:
												cacheMaterialization.reviewerFanoutPlanning
													.laneLaunchApprovalRef,
										}),
							})
						: undefined;
				const fanoutPersistedEvidenceId =
					fanoutResult !== undefined &&
					cacheMaterialization?.reviewerFanoutPlanning
						?.persistDerivedFanoutPlanEvidence === true
						? (cacheMaterialization.reviewerFanoutPlanning
								.fanoutPlanEvidenceId ??
							providerAcquisitionFanoutPlanEvidenceId(
								request.workflowId,
								fanoutResult,
							))
						: undefined;
				const fanoutPersistence =
					fanoutResult !== undefined && fanoutPersistedEvidenceId !== undefined
						? persistProviderAcquisitionReviewerFanoutPlanEvidence({
								rootDir,
								workflowId: request.workflowId,
								evidenceId: fanoutPersistedEvidenceId,
								plan: fanoutResult,
							})
						: { persisted: false, errors: [] };
				const runtimeLaunchPlanOptions =
					cacheMaterialization?.reviewerFanoutPlanning
						?.runtimeLaunchPlanMaterialization;
				const runtimeLaunchPlanResult =
					runtimeLaunchPlanOptions !== undefined &&
					fanoutPersistedEvidenceId !== undefined &&
					fanoutPersistence.persisted === true
						? materializeFlowDeskRuntimeLaneLaunchPlansFromReviewerFanoutEvidenceV1(
								{
									reloadedEvidence: reloadFlowDeskSessionEvidenceV1({
										workflowId: request.workflowId,
										rootDir,
									}),
									workflowId: request.workflowId,
									reviewerFanoutEvidenceId: fanoutPersistedEvidenceId,
									targetLaunchPlanEvidenceIds:
										runtimeLaunchPlanOptions.targetLaunchPlanEvidenceIds,
									...(runtimeLaunchPlanOptions.sdkClientAvailable === undefined
										? {}
										: {
												sdkClientAvailable:
													runtimeLaunchPlanOptions.sdkClientAvailable,
											}),
									...(runtimeLaunchPlanOptions.durableEvidenceRootRef ===
									undefined
										? {}
										: {
												durableEvidenceRootRef:
													runtimeLaunchPlanOptions.durableEvidenceRootRef,
											}),
									rootDir,
								},
							)
						: undefined;
				const runtimeReviewerExecutionOptions =
					runtimeLaunchPlanOptions?.runtimeReviewerExecution;
				const runtimeReviewerExecutionResult =
					runtimeReviewerExecutionOptions !== undefined &&
					runtimeLaunchPlanResult?.state === "materialized" &&
					runtimeReviewerExecutionClient !== undefined
						? await executeFlowDeskRuntimeReviewerExecutionBridgeV1({
								client: runtimeReviewerExecutionClient,
								rootDir,
								request: {
									workflowId: request.workflowId,
									attemptId: runtimeReviewerExecutionOptions.attemptId,
									parentSessionId:
										runtimeReviewerExecutionOptions.parentSessionId,
									allowActualLaneLaunch: true,
									observedAt:
										runtimeReviewerExecutionOptions.observedAt ??
										request.observedAt,
									consumedReviewerFanoutApproval:
										runtimeReviewerExecutionOptions.consumedReviewerFanoutApproval as unknown as Record<
											string,
											unknown
										>,
									verdictExpectations:
										runtimeReviewerExecutionOptions.verdictExpectations,
								},
							})
						: undefined;
				const redactedMaterialization =
					cacheMaterialization !== undefined &&
					materializationResult !== undefined
						? {
								options: cacheMaterialization,
								result: materializationResult,
								...(cacheMaterialization.reviewerFanoutPlanning !== undefined &&
								fanoutResult !== undefined
									? {
											fanout: {
												options: cacheMaterialization.reviewerFanoutPlanning,
												result: fanoutResult,
												persistedEvidenceId: fanoutPersistedEvidenceId,
												persisted: fanoutPersistence.persisted,
												persistErrors: fanoutPersistence.errors,
												...(runtimeLaunchPlanOptions !== undefined &&
												runtimeLaunchPlanResult !== undefined
													? {
															runtimeLaunchPlans: {
																options: runtimeLaunchPlanOptions,
																result: runtimeLaunchPlanResult,
																...(runtimeReviewerExecutionOptions !==
																	undefined &&
																runtimeReviewerExecutionResult !== undefined
																	? {
																			runtimeReviewerExecution: {
																				options:
																					runtimeReviewerExecutionOptions,
																				result: runtimeReviewerExecutionResult,
																			},
																		}
																	: {}),
															},
														}
													: {}),
											},
										}
									: {}),
							}
						: undefined;
				return JSON.stringify(
					redactedExactModelProviderAcquisitionToolResult(
						result,
						redactedMaterialization,
					),
				);
			},
		}),
	};
}

export interface FlowDeskChatMessageStallAlertOptionsV1 {
	rootDir: string;
	maxWorkflows?: number;
	laneHeartbeatLateThresholdMs?: number;
	laneHeartbeatStallThresholdMs?: number;
	includeProgressingLate?: boolean;
	includeProgressCards?: boolean;
	maxProgressCards?: number;
	statusLiveTimeoutMs?: number;
	guardedAutoAbort?: FlowDeskChatMessageGuardedAutoAbortOptionsV1;
}

export interface FlowDeskChatMessageGuardedAutoAbortOptionsV1
	extends FlowDeskAutoAbortConfigV1 {
	sdkSessionHealth?: FlowDeskSdkSessionHealthV1;
	useLiveSdkSessionHealth?: boolean;
	sdkClient?: FlowDeskManagedDispatchBetaOpenCodeClientV1;
}

/**
 * Bug B fix: sidebar cache staleness must consider per-bucket `expires_at` not just the top-level
 * `observed_at`. The writer always bumps the top-level timestamp during refresh, so refresh triggers
 * that only check the top-level field never re-fetch when a child bucket (e.g. an expired 5h) has
 * passed its expiry — the cache stays "fresh" forever and the UI continues to show a stale bucket.
 *
 * Returns true when either the top-level `observed_at` is older than `maxAgeMs`, or any nested
 * `buckets[].expires_at` has already passed `nowMs`. Malformed/missing cache files are treated as
 * stale by the caller (which catches the throw).
 */
export function isProviderUsageSidebarCacheStale(
	cache: Record<string, unknown>,
	nowMs: number,
	maxAgeMs: number,
): boolean {
	if (typeof cache.observed_at === "string") {
		const observedMs = Date.parse(cache.observed_at);
		if (Number.isFinite(observedMs) && nowMs - observedMs > maxAgeMs) return true;
	} else {
		return true;
	}
	const providers = cache.providers;
	if (Array.isArray(providers)) {
		for (const provider of providers) {
			if (!isRecord(provider)) continue;
			const buckets = provider.buckets;
			if (!Array.isArray(buckets)) continue;
			for (const bucket of buckets) {
				if (!isRecord(bucket)) continue;
				if (typeof bucket.expires_at !== "string") continue;
				const expiresMs = Date.parse(bucket.expires_at);
				if (Number.isFinite(expiresMs) && expiresMs <= nowMs) return true;
			}
		}
	}
	return false;
}

export function createFlowDeskNaturalLanguageChatMessageHook(
	now: FlowDeskLocalClockV1 = () => new Date(),
	session = createFlowDeskLocalNonDispatchAdapterSession(now),
	stallAlert?: FlowDeskChatMessageStallAlertOptionsV1,
	durableSuggestionRoot?: string,
	providerUsageLiveConfig?: FlowDeskProviderUsageLiveConfigV1,
	chatIntakeGate: FlowDeskChatIntakeModeGateV1 = defaultChatIntakeModeGate(),
) {
	const recentSuggestionCards = new Map<string, number>();
	const recentStallAlerts = new Map<string, number>();
	const usageAutoRefreshMaxAgeMs = 3 * 60_000;
	const stallAlertCacheMaxAgeMs = 30_000;
	let lastUsageRefreshAttemptAtMs = 0;
	let usageRefreshInFlight = false;
	let cachedStallResult: StallAlertResult | undefined;
	let cachedStallResultAtMs = 0;
	let stallRefreshInFlight = false;
	const refreshUsageSidebarCacheIfStale = (nowMs: number): void => {
		if (!providerUsageLiveConfig?.durableStateRootDir) return;
		if (nowMs - lastUsageRefreshAttemptAtMs <= 30_000) return;
		lastUsageRefreshAttemptAtMs = nowMs;
		let isStale = false;
		try {
			const cachePath = join(providerUsageLiveConfig.durableStateRootDir, ".flowdesk", "ui", "provider-usage-sidebar.json");
			const cacheContent = JSON.parse(readFileSync(cachePath, "utf8")) as Record<string, unknown>;
			isStale = isProviderUsageSidebarCacheStale(cacheContent, nowMs, usageAutoRefreshMaxAgeMs);
		} catch {
			isStale = true;
		}
		if (!isStale || usageRefreshInFlight) return;
		usageRefreshInFlight = true;
		void executeFlowDeskProviderUsageLiveV1({
			config: { ...providerUsageLiveConfig, persistSidebarCache: true },
			request: { providerFamily: "all" },
		}).catch(() => undefined).finally(() => {
			usageRefreshInFlight = false;
		});
	};
	const collectStallAlertResultCached = async (
		currentSessionRef: string,
		nowMs: number,
	): Promise<StallAlertResult> => {
		if (stallAlert === undefined) return { status: "none" } as const;
		const currentCachedStallResult = cachedStallResult;
		if (
			currentCachedStallResult !== undefined &&
			nowMs - cachedStallResultAtMs <= stallAlertCacheMaxAgeMs
		) return currentCachedStallResult;
		if (stallRefreshInFlight) return cachedStallResult ?? ({ status: "none" } as const);
		stallRefreshInFlight = true;
		const refresh = collectStallAlertResult(stallAlert, now, { currentSessionRef })
			.then((result) => {
				cachedStallResult = result;
				cachedStallResultAtMs = clockMs(now);
				return result;
			})
			.catch(() => {
				cachedStallResult = { status: "error" } as const;
				cachedStallResultAtMs = clockMs(now);
				return cachedStallResult;
			})
			.finally(() => {
				stallRefreshInFlight = false;
			});
		// Preserve first-alert behavior for empty caches, but debounce all later full reloads.
		if (cachedStallResult === undefined) return refresh;
		void refresh;
		return cachedStallResult ?? ({ status: "none" } as const);
	};
	return async function message(
		input: unknown,
		output: FlowDeskChatMessageOutput,
	): Promise<void> {
		const inputRecord = isRecord(input) ? input : {};
		const liveMainSessionId = typeof inputRecord.sessionID === "string"
			? inputRecord.sessionID.trim()
			: "";
		if (liveMainSessionId.length > 0) {
			lastCompletionWakeParentSessionRef = liveMainSessionId.startsWith("ses-")
				? liveMainSessionId
				: `ses-${liveMainSessionId}`;
			completionWakeParentSessionRefLockedFromChat = true;
		}
		if (WAKE_DIAG_ENABLED) {
			try {
				(require("node:fs") as typeof import("node:fs")).appendFileSync(
					wakeDiagnosticLogPath("chat-session-diag.log"),
					`${new Date().toISOString()} liveMainSessionId=${liveMainSessionId || "EMPTY"} lastRef=${lastCompletionWakeParentSessionRef ?? "NONE"}\n`,
					"utf8",
				);
			} catch {}
		}
		const partSessionID =
			typeof inputRecord.sessionID === "string" ? inputRecord.sessionID : "";
		const partMessageID =
			typeof inputRecord.messageID === "string" ? inputRecord.messageID : "";
		const buildTextPart = (text: string) => ({
			id: `prt_${randomUUID().replaceAll("-", "")}`,
			sessionID: partSessionID,
			messageID: partMessageID,
			type: "text" as const,
			text,
		});
		const request = intakeRequestFromChatMessage({ ...inputRecord, ...output });
		const preview = previewNaturalLanguageRouting(
			request,
			session,
			chatIntakeGate.effectiveMode,
		);
		const nowMs = clockMs(now);
		refreshUsageSidebarCacheIfStale(nowMs);
		const usageTextToAppend =
			providerUsageLiveConfig?.durableStateRootDir &&
			providerUsageLiveConfig.appendToChat === true
				? formatFlowDeskTuiUsageSnapshotCompactText(
						loadFlowDeskTuiUsageSnapshotViewV1({
							rootDir: providerUsageLiveConfig.durableStateRootDir,
							workflowId: providerUsageLiveConfig.persistWorkflowId,
							now: () => (typeof now === "function" ? now() : now),
							sidebarCacheOnly: true,
						}),
					)
				: undefined;
		const appendUsageCard = () => {
			if (usageTextToAppend === undefined) return;
			if (!Array.isArray(output.parts)) output.parts = [];
			output.parts.push(buildTextPart(usageTextToAppend));
		};
		if (
			looksLikeSuggestionDismissal(request.intake_summary) &&
			!looksLikeExplicitFlowDeskRequest(request.intake_summary)
		) {
			recentSuggestionCards.set(
				chatSuggestionDismissKey(request.session_ref),
				nowMs,
			);
			writeDurableSuggestionPreference(
				durableSuggestionRoot,
				chatSuggestionDismissKey(request.session_ref),
				request,
				undefined,
				nowMs,
				"dismiss",
			);
		}
		for (const [key, recordedAtMs] of recentSuggestionCards) {
			const ttlMs = key.endsWith("|dismiss-suggestions")
				? flowdeskChatSuggestionDismissWindowMs
				: flowdeskChatSuggestionDuplicateWindowMs;
			if (
				nowMs - recordedAtMs > ttlMs ||
				nowMs < recordedAtMs
			)
				recentSuggestionCards.delete(key);
		}
		for (const [key, recordedAtMs] of recentStallAlerts) {
			if (
				nowMs - recordedAtMs > flowdeskChatSuggestionDuplicateWindowMs ||
				nowMs < recordedAtMs
			)
				recentStallAlerts.delete(key);
		}
		const stallResult = await collectStallAlertResultCached(
			partSessionID || request.session_ref || safeToken(undefined, "chat-session"),
			nowMs,
		);

		let stallTextToAppend: string | undefined = undefined;
		let stallDedupKey: string | undefined = undefined;

		if (stallResult.status === "unavailable") {
			stallDedupKey = `${safeToken(request.session_ref, "session")}|stall-unavailable`;
			stallTextToAppend =
				"FlowDesk\nStall detection temporarily unavailable (status check timed out).\nSafe next actions:\n- /flowdesk-status\n- /flowdesk-doctor";
		} else if (stallResult.status === "error") {
			stallDedupKey = `${safeToken(request.session_ref, "session")}|stall-error`;
			stallTextToAppend =
				"FlowDesk\nStall detection encountered an error.\nRun /flowdesk-doctor to diagnose.";
		} else if (stallResult.status === "ok") {
			const summary = stallResult.data;
			const stalledAlertReady =
				summary.worstClassification === "stalled" &&
				summary.totalStalled > 0;
			const lateAlertReady =
				stallAlert?.includeProgressingLate === true &&
				summary.worstClassification === "progressing_late" &&
				summary.totalLate > 0;
		const progressCardReady =
				stallAlert?.includeProgressCards === true &&
				summary.workflowSummaries.some(
					(workflow) => (workflow.laneCards?.length ?? 0) > 0,
				);
			const autoNextReady = summary.workflowSummaries.some((workflow) => workflow.autoNextReady === true);
			if (stalledAlertReady || lateAlertReady || progressCardReady || autoNextReady) {
				stallDedupKey = stallAlertDuplicateKey(request, summary);
				stallTextToAppend = stallAlertText(summary);
			}
		}

		const appendStallCard = () => {
			if (stallDedupKey && stallTextToAppend) {
				const previous = recentStallAlerts.get(stallDedupKey);
				recentStallAlerts.set(stallDedupKey, nowMs);
				if (
					previous === undefined ||
					nowMs - previous > flowdeskChatSuggestionDuplicateWindowMs
				) {
					if (!Array.isArray(output.parts)) output.parts = [];
					output.parts.push(buildTextPart(stallTextToAppend));
				}
			}
		};

		if (preview.evaluation.response.route_decision === "continue_chat") {
			appendUsageCard();
			appendStallCard();
			return;
		}
		if (!mayCreatePendingConfirmation(preview)) {
			const dismissedAtMs =
				recentSuggestionCards.get(chatSuggestionDismissKey(request.session_ref)) ??
				readDurableSuggestionPreferenceAtMs(
					durableSuggestionRoot,
					chatSuggestionDismissKey(request.session_ref),
					nowMs,
				);
			if (
				dismissedAtMs !== undefined &&
				nowMs - dismissedAtMs <= flowdeskChatSuggestionDismissWindowMs
			) {
				appendUsageCard();
				appendStallCard();
				return;
			}
			const duplicateKey = suggestionDuplicateKey(
				request,
				preview.evaluation.response,
			);
			const previousAtMs =
				recentSuggestionCards.get(duplicateKey) ??
				readDurableSuggestionPreferenceAtMs(
					durableSuggestionRoot,
					duplicateKey,
					nowMs,
				);
			recentSuggestionCards.set(duplicateKey, nowMs);
			writeDurableSuggestionPreference(
				durableSuggestionRoot,
				duplicateKey,
				request,
				preview.evaluation.response,
				nowMs,
			);
			if (
				previousAtMs !== undefined &&
				nowMs - previousAtMs <= flowdeskChatSuggestionDuplicateWindowMs
			)
			{
				appendUsageCard();
				return;
			}
		}
		const result = evaluateNaturalLanguageRouting(
			request,
			session,
			chatIntakeGate.effectiveMode,
		);
		if (!Array.isArray(output.parts)) output.parts = [];
		output.parts.push(buildTextPart(steeringText(result)));
		appendUsageCard();
		appendStallCard();
	};
}

interface FlowDeskChatMessageStallSummaryV1 {
	worstClassification: string;
	totalStalled: number;
	totalLate: number;
	workflowSummaries: Array<{
		workflowId: string;
		stalledLaneCount: number;
		lateLaneCount: number;
		laneProgressAggregate?: {
			expected: number;
			terminal: number;
			taskResult: number;
			failed: number;
			awaitingPermission: number;
			normalCompleted: number;
			autoNextStepEligible: boolean;
			nextActionAvailable?: boolean;
			nextActionKind?: string;
			nextActionRefs?: readonly string[];
		};
		autoNextReady?: boolean;
		synthesisTasksSummarized?: number;
		synthesisConflictDetected?: boolean;
		secondsSinceLastSignal?: number;
		laneId?: string;
		failureHint?: string;
		laneCards?: Array<{
			laneId: string;
			taskId?: string;
			state?: string;
			classification: string;
			secondsSinceLastSignal?: number;
			agentRef?: string;
			providerQualifiedModelId?: string;
			promptPreview?: string;
			nudgeCount?: number;
			progressPhase?: string;
			progressLabel?: string;
			verdictLabel?: string;
			completionStatus?: string;
			outputKind?: string;
			usableForSynthesis?: boolean;
			failureHint?: string;
		}>;
	}>;
	autoAbortSummaries?: string[];
}

type FlowDeskChatMessageWorkflowSummaryV1 =
	FlowDeskChatMessageStallSummaryV1["workflowSummaries"][number];

export type StallAlertResult =
	| { status: "ok"; data: FlowDeskChatMessageStallSummaryV1 }
	| { status: "unavailable" }
	| { status: "error" }
	| { status: "none" };

const ALLOWED_ERROR_NAMES = new Set(["FlowDeskDiskError", "FlowDeskStateError"]);

export function assertNever(x: never): never {
	throw new Error("Unexpected object: " + x);
}

type StatusLiveImpl = typeof executeFlowDeskStatusLiveV1;
interface CollectStallAlertDeps {
	statusLiveImpl?: StatusLiveImpl;
	currentSessionRef?: string;
}

function sessionRefVariants(value: string | undefined): Set<string> {
	const variants = new Set<string>();
	if (value === undefined || value.trim().length === 0) return variants;
	const token = safeToken(value, "session");
	variants.add(token);
	if (token.startsWith("ses_")) variants.add(`ses-${token.slice(4)}`);
	if (token.startsWith("ses-")) variants.add(`ses_${token.slice(4)}`);
	return variants;
}

function sessionRefsMatch(left: string | undefined, right: string | undefined): boolean {
	const leftVariants = sessionRefVariants(left);
	if (leftVariants.size === 0) return false;
	for (const candidate of sessionRefVariants(right)) {
		if (leftVariants.has(candidate)) return true;
	}
	return false;
}

function latestParentSessionRefForLane(
	rootDir: string,
	workflowId: string,
	laneId: string,
): string | undefined {
	const reload = reloadFlowDeskSessionEvidenceV1({ rootDir, workflowId });
	if (!reload.ok) return undefined;
	let latest: { parentSessionRef: string; updatedAtMs: number } | undefined;
	for (const entry of reload.entries) {
		if (entry.evidenceClass !== "lane_lifecycle") continue;
		const record = entry.record;
		if (!isRecord(record)) continue;
		if (record.lane_id !== laneId) continue;
		if (typeof record.parent_session_ref !== "string") continue;
		const updatedAt =
			typeof record.updated_at === "string"
				? Date.parse(record.updated_at)
				: Number.NaN;
		if (!Number.isFinite(updatedAt)) continue;
		if (latest === undefined || updatedAt > latest.updatedAtMs) {
			latest = { parentSessionRef: record.parent_session_ref, updatedAtMs: updatedAt };
		}
	}
	return latest?.parentSessionRef;
}

export async function collectStallAlertResult(
	stallAlert: FlowDeskChatMessageStallAlertOptionsV1,
	clock: FlowDeskLocalClockV1,
	deps: CollectStallAlertDeps = {},
): Promise<StallAlertResult> {
	const statusLiveImpl = deps.statusLiveImpl ?? executeFlowDeskStatusLiveV1;
	try {
		const observedAt = (
			typeof clock === "function" ? clock() : clock
		).toISOString();
		const config: FlowDeskStatusLiveConfigV1 = {
			rootDir: stallAlert.rootDir,
			...(stallAlert.maxWorkflows === undefined
				? {}
				: { maxWorkflows: stallAlert.maxWorkflows }),
			...(stallAlert.laneHeartbeatLateThresholdMs === undefined
				? {}
				: {
						laneHeartbeatLateThresholdMs:
							stallAlert.laneHeartbeatLateThresholdMs,
					}),
			...(stallAlert.laneHeartbeatStallThresholdMs === undefined
				? {}
				: {
						laneHeartbeatStallThresholdMs:
							stallAlert.laneHeartbeatStallThresholdMs,
					}),
		};
		const result = await withTimeout(
			statusLiveImpl({
				config,
				now: () => new Date(observedAt),
			}),
			stallAlert.statusLiveTimeoutMs ?? 8_000,
			"executeFlowDeskStatusLiveV1",
		);
		if (result.status !== "status_live_collected") return { status: "none" };
		const autoAbortSummaries: string[] = [];
		const currentSessionRef = deps.currentSessionRef;
		const workflowSummariesWithEmpty: Array<
			FlowDeskChatMessageWorkflowSummaryV1 | undefined
		> = await Promise.all(result.workflows
			.map(async (workflow) => {
				const parentRefCache = new Map<string, string | undefined>();
				const latestParentRef = (laneId: string): string | undefined => {
					if (!parentRefCache.has(laneId)) {
						parentRefCache.set(
							laneId,
							latestParentSessionRefForLane(
								stallAlert.rootDir,
								workflow.workflowId,
								laneId,
							),
						);
					}
					return parentRefCache.get(laneId);
				};
				const laneInCurrentSession = (laneId: string): boolean =>
					currentSessionRef === undefined ||
					sessionRefsMatch(latestParentRef(laneId), currentSessionRef);
				const scopedEntries = (workflow.laneStallProjection?.entries ?? []).filter(
					(entry) => laneInCurrentSession(entry.laneId),
				);
				const stalledEntry = scopedEntries.find(
					(entry) => entry.classification === "stalled",
				);
				const lateEntry = scopedEntries.find(
					(entry) => entry.classification === "progressing_late",
				);
				const primary = stalledEntry ?? lateEntry;
				const autoNextReady = workflow.laneProgressAggregate?.autoNextStepEligible === true;
				const scopedLaneCards = (workflow.laneProgressCards ?? []).filter(
					(lane) =>
						(autoNextReady || lane.classification !== "terminal") &&
						laneInCurrentSession(lane.laneId),
				);
				const scopedStalledCount = scopedEntries.filter(
					(entry) => entry.classification === "stalled",
				).length;
				const scopedLateCount = scopedEntries.filter(
					(entry) => entry.classification === "progressing_late",
				).length;
				const shouldShowWorkflow =
					scopedStalledCount > 0 ||
					(stallAlert.includeProgressingLate === true && scopedLateCount > 0) ||
					(autoNextReady && scopedLaneCards.length > 0) ||
					(stallAlert.includeProgressCards === true && scopedLaneCards.length > 0);
				if (!shouldShowWorkflow) return undefined;
			if (
				stallAlert.guardedAutoAbort !== undefined &&
				stalledEntry !== undefined &&
				scopedStalledCount > 0
			) {
				// Reconcile stale pending retry plans on each stall check
				try {
					reconcileStalePendingRetryPlansV1({
						rootDir: stallAlert.rootDir,
						workflowId: workflow.workflowId,
						now: new Date(observedAt),
					});
				} catch {
					// Reconciliation is best-effort
				}

				let sdkSessionHealth = stallAlert.guardedAutoAbort.sdkSessionHealth;
				if (
					sdkSessionHealth === undefined &&
					stallAlert.guardedAutoAbort.useLiveSdkSessionHealth === true &&
					stallAlert.guardedAutoAbort.sdkClient !== undefined
				) {
					const parentSessionRef = latestParentSessionRefForLane(
						stallAlert.rootDir,
						workflow.workflowId,
						stalledEntry.laneId,
					);
					sdkSessionHealth = parentSessionRef === undefined
						? { status: "unknown", reason: "parent_session_ref_missing" }
						: await checkSdkSessionApiHealthV1(
							stallAlert.guardedAutoAbort.sdkClient,
							parentSessionRef,
						);
				}
				const autoAbort = evaluateGuardedAutoAbortHookV1({
					rootDir: stallAlert.rootDir,
					workflow_id: workflow.workflowId,
					lane_id: stalledEntry.laneId,
					config: stallAlert.guardedAutoAbort,
					stallConfirmed: true,
					sdkSessionHealth:
						sdkSessionHealth ?? {
							status: "unknown",
							reason: "sdk_session_health_not_supplied_to_chat_hook",
						},
					now: () => new Date(observedAt),
				});
				autoAbortSummaries.push(
					`workflow ${workflow.workflowId} lane ${stalledEntry.laneId}: guarded auto-abort ${autoAbort.status}`,
				);

				// After auto-abort, evaluate guarded auto-retry if configured
				if (
					autoAbort.status === "auto_abort_executed" &&
					stallAlert.guardedAutoAbort.autoRetryAfterAbort === true &&
					stallAlert.guardedAutoAbort.sdkClient !== undefined
				) {
					let retryResult: FlowDeskAutoRetryResultV1 | undefined;
					try {
						retryResult = await evaluateGuardedAutoRetryHookV1({
							config: stallAlert.guardedAutoAbort,
							rootDir: stallAlert.rootDir,
							workflowId: workflow.workflowId,
							laneId: stalledEntry.laneId,
							abortEvidenceId: autoAbort.lifecycle_evidence_id,
							client: stallAlert.guardedAutoAbort.sdkClient,
							parentSessionId: stalledEntry.laneId,
							timeoutMs: 30_000,
							now: new Date(observedAt),
						});
					} catch {
						// Retry evaluation is best-effort
					}
					if (retryResult !== undefined) {
						autoAbortSummaries.push(
							`workflow ${workflow.workflowId} lane ${stalledEntry.laneId}: guarded auto-retry ${retryResult.status}`,
						);
					}
				}
			}
				return {
					workflowId: workflow.workflowId,
					stalledLaneCount: scopedStalledCount,
					lateLaneCount: scopedLateCount,
					...(primary?.secondsSinceLastSignal === undefined
						? {}
						: { secondsSinceLastSignal: primary.secondsSinceLastSignal }),
					...(primary?.laneId === undefined ? {} : { laneId: primary.laneId }),
					...(primary?.failureHint === undefined
						? {}
						: { failureHint: primary.failureHint }),
					...(workflow.laneProgressAggregate === undefined
						? {}
						: { laneProgressAggregate: workflow.laneProgressAggregate }),
					...(autoNextReady ? { autoNextReady: true } : {}),
					...(workflow.latestWorkflowSynthesisTasksSummarized === undefined
						? {}
						: { synthesisTasksSummarized: workflow.latestWorkflowSynthesisTasksSummarized }),
					...(workflow.latestWorkflowSynthesisConflictDetected === undefined
						? {}
						: { synthesisConflictDetected: workflow.latestWorkflowSynthesisConflictDetected }),
					...(stallAlert.includeProgressCards === true
						? {
								laneCards: scopedLaneCards
									.slice(0, stallAlert.maxProgressCards ?? 3)
							.map((lane) => ({
								laneId: lane.laneId,
								taskId: lane.taskId,
								state: lane.state,
								classification: lane.classification,
								secondsSinceLastSignal: lane.secondsSinceLastSignal,
								agentRef: lane.agentRef,
								providerQualifiedModelId: lane.providerQualifiedModelId,
								promptPreview: lane.promptPreview,
								nudgeCount: lane.nudgeCount,
								progressPhase: lane.progressPhase,
								progressLabel: lane.progressLabel,
								verdictLabel: lane.verdictLabel,
								completionStatus: lane.completionStatus,
								outputKind: lane.outputKind,
								usableForSynthesis: lane.usableForSynthesis,
								failureHint: lane.failureHint,
							})),
							}
						: {}),
				};
			}));
		const workflowSummaries = workflowSummariesWithEmpty
			.filter(
				(summary): summary is FlowDeskChatMessageWorkflowSummaryV1 =>
					summary !== undefined,
			)
			.slice(0, 3);
		if (workflowSummaries.length === 0) {
			return { status: "none" };
		}
		const scopedTotalStalled = workflowSummaries.reduce(
			(sum, workflow) => sum + workflow.stalledLaneCount,
			0,
		);
		const scopedTotalLate = workflowSummaries.reduce(
			(sum, workflow) => sum + workflow.lateLaneCount,
			0,
		);
		const scopedWorstClassification =
			scopedTotalStalled > 0
				? "stalled"
				: scopedTotalLate > 0
					? "progressing_late"
					: (result.worstLaneStallClassification ?? "unknown");
		return {
			status: "ok",
			data: {
				worstClassification: scopedWorstClassification,
				totalStalled: scopedTotalStalled,
				totalLate: scopedTotalLate,
				workflowSummaries,
				...(autoAbortSummaries.length === 0 ? {} : { autoAbortSummaries }),
			}
		};
	} catch (error) {
		if (error instanceof FlowDeskTimeoutError) {
			return { status: "unavailable" };
		}
		const errorName = error instanceof Error ? error.name : "UnknownError";
		const safeName = ALLOWED_ERROR_NAMES.has(errorName) ? errorName : "UnknownError";
		process.stderr.write(`[flowdesk] collectStallAlertResult error: ${safeName}\n`);
		return { status: "error" };
	}
}

function stallAlertDuplicateKey(
	request: FlowDeskChatIntakeRequestV1,
	summary: FlowDeskChatMessageStallSummaryV1,
): string {
	const wf = summary.workflowSummaries
		.map((entry) => {
			const ageMinutes =
				typeof entry.secondsSinceLastSignal === "number"
					? Math.floor(entry.secondsSinceLastSignal / 60)
					: -1;
			const lanes = (entry.laneCards ?? [])
				.map((lane) => {
					const laneAge =
						typeof lane.secondsSinceLastSignal === "number"
							? Math.floor(lane.secondsSinceLastSignal / 60)
							: -1;
					return `${lane.laneId}:${lane.state ?? "unknown"}:${lane.classification}:${laneAge}`;
				})
				.join(",");
			return `${entry.workflowId}:${entry.stalledLaneCount}:${ageMinutes}:${lanes}`;
		})
		.join("|");
	return `${safeToken(request.session_ref, "session")}|stall|${wf}|worst:${summary.worstClassification}`;
}

function stallAlertText(summary: FlowDeskChatMessageStallSummaryV1): string {
	const lines: string[] = [];
	lines.push("FlowDesk");
	const progressCardCount = summary.workflowSummaries.reduce(
		(sum, workflow) => sum + (workflow.laneCards?.length ?? 0),
		0,
	);
	if (summary.worstClassification === "stalled") {
		lines.push(
			`Stalled lanes detected: ${summary.totalStalled} stalled, ${summary.totalLate} progressing-late.`,
		);
	} else if (summary.worstClassification === "progressing_late") {
		lines.push(
			`Late-progressing lanes detected: ${summary.totalLate} late, ${summary.totalStalled} stalled.`,
		);
	} else if (summary.workflowSummaries.some((workflow) => workflow.autoNextReady === true)) {
		lines.push("All FlowDesk subtasks completed normally. Auto-next synthesis is ready.");
	} else if (progressCardCount > 0) {
		const permissionCount = summary.workflowSummaries.reduce((sum, workflow) => sum + (workflow.laneProgressAggregate?.awaitingPermission ?? 0), 0);
		lines.push(permissionCount > 0
			? `Permission attention: ${permissionCount} child FlowDesk lane(s) await OpenCode approval/denial in the permission UI.`
			: `Lane progress: ${progressCardCount} lane(s) visible on the main screen.`);
	} else {
		lines.push(
			`Lane progress check: ${summary.totalStalled} stalled, ${summary.totalLate} progressing-late.`,
		);
	}
	for (const workflow of summary.workflowSummaries.slice(0, 3)) {
		const secs = workflow.secondsSinceLastSignal ?? 0;
		const minutes = Math.floor(secs / 60);
		const hint = workflow.failureHint ?? "no recent heartbeat";
		if (workflow.autoNextReady === true) {
			const synthesis = workflow.synthesisTasksSummarized === undefined
				? "synthesis not yet recorded"
				: `synthesis recorded for ${workflow.synthesisTasksSummarized} task(s)`;
			const conflict = workflow.synthesisConflictDetected === undefined
				? " conflict=unknown"
				: workflow.synthesisConflictDetected === true ? " conflict=true" : " conflict=false";
			const nextAction = workflow.laneProgressAggregate?.nextActionAvailable === true
				? ` next_action=${workflow.laneProgressAggregate.nextActionKind ?? "available"}_ready`
				: "";
			lines.push(`- workflow ${workflow.workflowId}: auto-next ready (${synthesis},${conflict}${nextAction}).`);
		} else {
			const counts =
				workflow.stalledLaneCount > 0
					? `${workflow.stalledLaneCount} stalled`
					: `${workflow.lateLaneCount} progressing-late`;
			lines.push(
				`- workflow ${workflow.workflowId}: ${counts} (last signal ~${minutes}m ago, ${hint}).`,
			);
		}
		if (workflow.laneProgressAggregate !== undefined) {
			const aggregate = workflow.laneProgressAggregate;
			const nextAction = aggregate.nextActionAvailable === true
				? `, next_action=${aggregate.nextActionKind ?? "available"}_ready`
				: "";
			lines.push(
				`  tasks: expected=${aggregate.expected}, terminal=${aggregate.terminal}, completed=${aggregate.normalCompleted}, failed=${aggregate.failed}, awaiting_permission=${aggregate.awaitingPermission}, auto_next=${aggregate.autoNextStepEligible}${nextAction}`,
			);
		}
		for (const lane of workflow.laneCards?.slice(0, 3) ?? []) {
			const age =
				lane.secondsSinceLastSignal === undefined
					? "unknown"
					: `~${Math.floor(lane.secondsSinceLastSignal / 60)}m ago`;
			const model = lane.providerQualifiedModelId ?? "(unknown)";
			const agent = lane.agentRef ?? "(unknown)";
			const task = lane.taskId ?? lane.laneId;
			const prompt = lane.promptPreview ?? "(hidden)";
			const nudge = lane.nudgeCount === undefined ? "?" : String(lane.nudgeCount);
			const progress = lane.progressLabel === undefined
				? "(none)"
				: `${lane.progressPhase ?? "progress"}: ${lane.progressLabel}`;
			const verdict = lane.verdictLabel ?? "(none)";
			const resultQuality = lane.completionStatus === undefined && lane.outputKind === undefined && lane.usableForSynthesis === undefined
				? "(none)"
				: `${lane.completionStatus ?? "unknown"}/${lane.outputKind ?? "unknown"}/synthesis=${lane.usableForSynthesis === undefined ? "unknown" : String(lane.usableForSynthesis)}`;
			const issue = lane.failureHint === undefined ? "" : ` issue=${lane.failureHint}`;
			lines.push(`  - lane ${lane.laneId}: ${lane.state ?? "unknown"}/${lane.classification}`);
			lines.push(`    task: ${task}`);
			lines.push(`    prompt: ${prompt}`);
			lines.push(`    agent: ${agent}`);
			lines.push(`    model: ${model}`);
			lines.push(`    progress: ${progress}`);
			lines.push(`    result: ${resultQuality}`);
			lines.push(`    last signal: ${age}; nudges=${nudge}; verdict=${verdict}${issue}`);
		}
	}
	if (summary.autoAbortSummaries !== undefined && summary.autoAbortSummaries.length > 0) {
		lines.push("Guarded auto-abort diagnostics (evidence-only, opt-in):");
		for (const line of summary.autoAbortSummaries.slice(0, 3)) lines.push(`- ${line}`);
	}
	lines.push("Safe next actions:");
	for (const action of [
		"/flowdesk-status",
		"/flowdesk-retry",
		"/flowdesk-resume",
		"/flowdesk-abort",
		"/flowdesk-doctor",
		"/flowdesk-export-debug",
	])
		lines.push(`- ${action}`);
	if (progressCardCount > 0) {
		lines.push("Lane log refs are command-based in this MVP; native clickable task UI is not claimed. Permission requests must be answered in OpenCode's permission UI when it is shown.");
	}
	return lines.join("\n");
}

function isFds1SchemaConversionProbeEnabled(options?: PluginOptions): boolean {
	return options?.[flowdeskFds1SchemaConversionProbeOption] === true;
}

function isLocalNonDispatchAdapterEnabled(options?: PluginOptions): boolean {
	const value = options?.[flowdeskLocalNonDispatchAdapterOption];
	if (value !== undefined) return value !== false;
	return !isFds1SchemaConversionProbeEnabled(options);
}

function isNaturalLanguageRoutingEnabled(options?: PluginOptions): boolean {
	const value = options?.[flowdeskNaturalLanguageRoutingOption];
	if (value !== undefined) return value !== false;
	return !isFds1SchemaConversionProbeEnabled(options);
}

export function operationalIntelligenceConfigFromOptions(options?: PluginOptions): {
	enabled: boolean;
	exposeMcpTools: boolean;
	persistAdvisoryEvidence: boolean;
} {
	const raw = options?.[flowdeskOperationalIntelligenceOption];
	if (!isRecord(raw)) {
		return { enabled: false, exposeMcpTools: false, persistAdvisoryEvidence: false };
	}
	const enabled = raw.enabled === true;
	const exposeMcpTools = enabled && raw.exposeMcpTools === true;
	const persistAdvisoryEvidence = enabled && raw.persistAdvisoryEvidence === true;
	return { enabled, exposeMcpTools, persistAdvisoryEvidence };
}

function flowdeskFederatedRegistryPublishInvalidInputEnvelope(reason: string) {
	return {
		ok: false,
		errors: [reason],
		remoteWrite: { state: "skipped", endpointKind: "github_issue", redactedReason: "invalid-tool-input" },
		authority: {
			advisoryOnlyRecord: true,
			remoteWriteAuthorityEnabledInRecord: false,
			dispatchAuthorityEnabled: false,
			laneLaunchAuthorityEnabled: false,
		},
	};
}

function isFlowDeskGitHubDryRunPublicationResultRecordV1(value: unknown): value is FlowDeskGitHubDryRunPublicationResultV1 {
	if (!isRecord(value)) return false;
	return validateFlowDeskGitHubDryRunPublicationResultV1(value).ok;
}

function isGitHubPublicationTargetRecordV1(value: unknown): value is GitHubPublicationTargetV1 {
	if (!isRecord(value)) return false;
	const kind = value.kind;
	const owner = value.owner;
	const repo = value.repo;
	if (kind !== "github_issue" && kind !== "github_pr_comment") return false;
	if (typeof owner !== "string" || typeof repo !== "string") return false;
	if (kind === "github_pr_comment" && !Number.isInteger(value.issueNumber)) return false;
	if (kind === "github_issue" && typeof value.title !== "string") return false;
	return true;
}

export function createFlowDeskFederatedRegistryPublishTools(): Record<string, FlowDeskOpenCodeTool> {
	return {
		[flowdeskFederatedRegistryPublishToolName]: tool({
			description: [
				"Publish a FlowDesk federated registry dry-run result to GitHub only when an explicit later-gate flag allows remote writes.",
				"Release 1 default is advisory-only: allowActualRemoteWrite=false skips the GitHub API call and returns an advisory publication record with all authority flags false.",
				"WHEN TO USE: only for Phase 8 GitHub/OAuth connector publication testing or later gated publication flows with an existing dry-run result.",
				"WHEN NOT TO USE: do not use for managed dispatch, provider calls, lane launch, fallback, or bypassing FlowDesk-owned lane boundaries.",
				"INVOKE WITH: dryRunResult, ledgerIdempotencyRef, guardApprovalRef, target, contentMarkdown, connectorGateSatisfied, and allowActualRemoteWrite. Main Release 1 flows must keep allowActualRemoteWrite=false.",
				"AFTER CALLING: surface publicationResult as advisory evidence and remoteWrite as transient side-effect status; never treat the advisory record as remote-write authority.",
			].join(" "),
			args: {
				dryRunResult: tool.schema
					.record(tool.schema.string(), tool.schema.unknown())
					.describe("FlowDeskGitHubDryRunPublicationResultV1 record to publish from."),
				ledgerIdempotencyRef: tool.schema.string().describe("Opaque ledger idempotency ref."),
				guardApprovalRef: tool.schema.string().describe("Opaque Guard approval ref for a later gate."),
				target: tool.schema
					.record(tool.schema.string(), tool.schema.unknown())
					.describe("GitHub target: { kind, owner, repo, issueNumber? for comments, title? for issues }."),
				contentMarkdown: tool.schema.string().describe("Markdown body to send to GitHub when the remote-write flag and connector gate are both true."),
				connectorGateSatisfied: tool.schema.boolean().optional().describe("Hypothetical later connector gate signal. Keep false for Release 1 main flow."),
				allowActualRemoteWrite: tool.schema.boolean().describe("Must be true to permit the actual GitHub API call; false records advisory skip only."),
			},
			async execute(input) {
				const record: Record<string, unknown> = isRecord(input) ? input : {};
				if (!isFlowDeskGitHubDryRunPublicationResultRecordV1(record.dryRunResult)) {
					return JSON.stringify(flowdeskFederatedRegistryPublishInvalidInputEnvelope("dryRunResult must be a valid FlowDeskGitHubDryRunPublicationResultV1 record"));
				}
				if (!isGitHubPublicationTargetRecordV1(record.target)) {
					return JSON.stringify(flowdeskFederatedRegistryPublishInvalidInputEnvelope("target must be a valid GitHub publication target record"));
				}
				const result = await publishToGitHubV1({
					dryRunResult: record.dryRunResult,
					ledgerIdempotencyRef: typeof record.ledgerIdempotencyRef === "string" ? record.ledgerIdempotencyRef : "ledger-idempotency-ref-missing",
					guardApprovalRef: typeof record.guardApprovalRef === "string" ? record.guardApprovalRef : "guard-approval-ref-missing",
					target: record.target,
					contentMarkdown: typeof record.contentMarkdown === "string" ? record.contentMarkdown : "",
					allowActualRemoteWrite: record.allowActualRemoteWrite === true,
					connectorGateSatisfied: record.connectorGateSatisfied === true,
					env: process.env,
				});
				return JSON.stringify(result);
			},
		}),
	};
}

interface FlowDeskProjectConfigLoadResultV1 {
	enabled: boolean;
	status: "disabled" | "loaded" | "missing" | "blocked";
	configRef?: string;
	releaseMode?: string;
	chatIntakeMode?: string;
	hookHarnessMode?: string;
	disabledModes?: string[];
	redactedBlockReason?: string;
	realOpenCodeDispatch: false;
	actualLaneLaunch: false;
	providerCall: false;
	runtimeExecution: false;
	fallbackAuthority: false;
	hardCancelOrNoReplyAuthority: false;
}

function disabledProjectConfigLoad(): FlowDeskProjectConfigLoadResultV1 {
	return { enabled: false, status: "disabled", ...disabledAuthority };
}

function defaultChatIntakeModeGate(): FlowDeskChatIntakeModeGateV1 {
	return {
		effectiveMode: "steering",
		conformanceReadable: false,
		blockingSafe: false,
		...disabledAuthority,
	};
}

function readChatBlockingConformanceMetadataFromOptions(
	options?: PluginOptions,
): unknown {
	const raw = options?.[flowdeskProjectConfigOption];
	if (!isRecord(raw)) return undefined;
	if (raw.chatBlockingConformanceMetadata !== undefined)
		return raw.chatBlockingConformanceMetadata;
	if (raw.conformanceRuntimeMetadata !== undefined)
		return raw.conformanceRuntimeMetadata;
	const rootDir =
		typeof raw.rootDir === "string" && raw.rootDir.trim().length > 0
			? raw.rootDir
			: undefined;
	if (rootDir === undefined) return undefined;
	const root = resolve(rootDir);
	const candidates = [
		resolve(root, ".flowdesk", "conformance-runtime-metadata.json"),
		resolve(root, ".flowdesk", "conformance.json"),
	];
	for (const candidate of candidates) {
		if (candidate !== root && !candidate.startsWith(`${root}${sep}`)) continue;
		try {
			return JSON.parse(readFileSync(candidate, "utf8")) as unknown;
		} catch {
			// Try the next conventional conformance path; absence/read failure is handled by the gate.
		}
	}
	return undefined;
}

function chatIntakeModeGateFromProjectConfig(
	load: FlowDeskProjectConfigLoadResultV1,
	options?: PluginOptions,
): FlowDeskChatIntakeModeGateV1 {
	if (load.chatIntakeMode !== "blocking") {
		return {
			requestedMode: load.chatIntakeMode,
			effectiveMode: "steering",
			conformanceReadable: false,
			blockingSafe: false,
			...disabledAuthority,
		};
	}
	const metadata = readChatBlockingConformanceMetadataFromOptions(options);
	const validation = validateConformanceRuntimeMetadataV1(metadata);
	const record = isRecord(metadata) ? metadata : {};
	const evidenceRefs = Array.isArray(record.evidence_refs)
		? record.evidence_refs.filter((ref): ref is string => typeof ref === "string")
		: [];
	const disabledModes = Array.isArray(record.disabled_modes)
		? record.disabled_modes.filter((mode): mode is string => typeof mode === "string")
		: [];
	const blockingSafe =
		validation.ok &&
		record.chat_intake_mode === "blocking" &&
		record.hook_harness_mode === "enforce" &&
		evidenceRefs.length > 0 &&
		!disabledModes.includes("hard_chat_blocking");
	return {
		requestedMode: "blocking",
		effectiveMode: blockingSafe ? "blocking" : "steering",
		conformanceReadable: validation.ok,
		blockingSafe,
		...(evidenceRefs[0] === undefined
			? {}
			: { conformanceRef: safeToken(evidenceRefs[0], "conformance-chat-blocking") }),
		...(blockingSafe
			? {}
			: {
					diagnostic:
						"chat_intake_mode=blocking requested, but readable chat.message blocking conformance was not available; FlowDesk is using steering mode for this session.",
				}),
		...disabledAuthority,
	};
}

function projectConfigPathFromOptions(
	options?: PluginOptions,
): string | undefined {
	const raw = options?.[flowdeskProjectConfigOption];
	if (raw !== true && !(isRecord(raw) && raw.enabled === true))
		return undefined;
	const rootDir =
		isRecord(raw) &&
		typeof raw.rootDir === "string" &&
		raw.rootDir.trim().length > 0
			? raw.rootDir
			: undefined;
	if (rootDir === undefined) return undefined;
	const root = resolve(rootDir);
	const configPath = resolve(root, ".flowdesk", "config.json");
	if (configPath !== root && !configPath.startsWith(`${root}${sep}`))
		return undefined;
	return configPath;
}

function localProjectConfigFileOptionsFromOptions(
	options?: PluginOptions,
): FlowDeskLocalProjectConfigFileOptionsV1 | undefined {
	const raw = options?.[flowdeskProjectConfigOption];
	if (raw !== true && !(isRecord(raw) && raw.enabled === true))
		return undefined;
	const rootDir =
		isRecord(raw) &&
		typeof raw.rootDir === "string" &&
		raw.rootDir.trim().length > 0
			? raw.rootDir
			: undefined;
	if (rootDir === undefined) return undefined;
	const policyPackPaths =
		isRecord(raw) && Array.isArray(raw.policyPackPaths)
			? raw.policyPackPaths.filter(
					(path): path is string => typeof path === "string",
				)
			: undefined;
	return {
		enabled: true,
		rootDir,
		...(policyPackPaths === undefined ? {} : { policyPackPaths }),
	};
}

function loadProjectConfigFromOptions(
	options?: PluginOptions,
): FlowDeskProjectConfigLoadResultV1 {
	const raw = options?.[flowdeskProjectConfigOption];
	if (raw !== true && !(isRecord(raw) && raw.enabled === true))
		return disabledProjectConfigLoad();
	const configPath = projectConfigPathFromOptions(options);
	if (configPath === undefined)
		return {
			enabled: true,
			status: "blocked",
			redactedBlockReason:
				"projectConfig.enabled=true requires a schema-safe rootDir",
			...disabledAuthority,
		};
	try {
		const parsed = JSON.parse(readFileSync(configPath, "utf8")) as unknown;
		const record = isRecord(parsed) ? parsed : {};
		const validation = validateProjectConfigV1(parsed);
		const blockingCompatibilityValidation =
			!validation.ok && record.chat_intake_mode === "blocking"
				? validateProjectConfigV1({ ...record, chat_intake_mode: "steering" })
				: undefined;
		if (!validation.ok && blockingCompatibilityValidation?.ok !== true)
			return {
				enabled: true,
				status: "blocked",
				redactedBlockReason: validation.errors.join("; ").slice(0, 500),
				...disabledAuthority,
			};
		return {
			enabled: true,
			status: "loaded",
			...(validation.ok
				? {}
				: {
						redactedBlockReason:
							"project config requested chat_intake_mode=blocking; server gate will require readable blocking conformance or use steering",
					}),
			configRef: safeToken(record.config_id, "config-redacted"),
			releaseMode:
				typeof record.release_mode === "string"
					? record.release_mode
					: undefined,
			chatIntakeMode:
				typeof record.chat_intake_mode === "string"
					? record.chat_intake_mode
					: undefined,
			hookHarnessMode:
				typeof record.hook_harness_mode === "string"
					? record.hook_harness_mode
					: undefined,
			disabledModes: Array.isArray(record.disabled_modes)
				? record.disabled_modes.filter(
						(mode): mode is string => typeof mode === "string",
					)
				: undefined,
			...disabledAuthority,
		};
	} catch (error) {
		const code =
			error instanceof Error && "code" in error
				? String((error as { code?: unknown }).code)
				: "read_failed";
		return {
			enabled: true,
			status: code === "ENOENT" ? "missing" : "blocked",
			redactedBlockReason:
				code === "ENOENT"
					? "project config file is missing"
					: "project config file could not be parsed or read",
			...disabledAuthority,
		};
	}
}

function isNaturalLanguageRoutingAllowedByProjectConfig(
	load: FlowDeskProjectConfigLoadResultV1,
): boolean {
	if (!load.enabled || load.status === "loaded")
		return load.chatIntakeMode !== "off" && load.hookHarnessMode !== "off";
	return false;
}

let lastCompletionWakeParentSessionRef: string | undefined;
let completionWakeParentSessionRefLockedFromChat = false;

export function __resetCompletionWakeParentSessionRefForTest(): void {
	lastCompletionWakeParentSessionRef = undefined;
	completionWakeParentSessionRefLockedFromChat = false;
}

function isCompletionWakeCacheParentSessionRef(value: unknown): value is string {
	if (typeof value !== "string") return false;
	const trimmed = value.trim();
	return trimmed !== "global" && /^ses-ses_[A-Za-z0-9_-]+$/.test(trimmed);
}

function initializeCompletionWakeParentSessionRefFromReadyCache(rootDir: string): void {
	if (
		completionWakeParentSessionRefLockedFromChat ||
		lastCompletionWakeParentSessionRef !== undefined
	)
		return;
	try {
		const readyPath = join(rootDir, ".flowdesk", "ui", "completion-wake-ready.json");
		const parsed = JSON.parse(readFileSync(readyPath, "utf8")) as unknown;
		if (!isRecord(parsed) || !Array.isArray(parsed.rows)) return;
		let selectedParentSessionRef: string | undefined;
		let selectedSortKey = Number.NEGATIVE_INFINITY;
		parsed.rows.forEach((row, index) => {
			if (!isRecord(row) || !isCompletionWakeCacheParentSessionRef(row.parentSessionRef))
				return;
			if (row.consumed === true) return;
			const readyAtMs = typeof row.readyAt === "string" ? Date.parse(row.readyAt) : NaN;
			const sortKey = Number.isFinite(readyAtMs) ? readyAtMs : index;
			if (sortKey >= selectedSortKey) {
				selectedSortKey = sortKey;
				selectedParentSessionRef = row.parentSessionRef.trim();
			}
		});
		if (
			selectedParentSessionRef !== undefined &&
			!completionWakeParentSessionRefLockedFromChat &&
			lastCompletionWakeParentSessionRef === undefined
		) {
			lastCompletionWakeParentSessionRef = selectedParentSessionRef;
			if (WAKE_DIAG_ENABLED) { try { (require("node:fs") as typeof import("node:fs")).appendFileSync(wakeDiagnosticLogPath("wake-seed-diag.log"), `${new Date().toISOString()} SEEDED lastRef=${selectedParentSessionRef}\n`, "utf8"); } catch {} }
		} else {
			if (WAKE_DIAG_ENABLED) { try { (require("node:fs") as typeof import("node:fs")).appendFileSync(wakeDiagnosticLogPath("wake-seed-diag.log"), `${new Date().toISOString()} SEED_SKIPPED locked=${completionWakeParentSessionRefLockedFromChat} alreadySet=${lastCompletionWakeParentSessionRef !== undefined} selected=${selectedParentSessionRef ?? "NONE"}\n`, "utf8"); } catch {} }
		}
	} catch(e) {
		if (WAKE_DIAG_ENABLED) { try { (require("node:fs") as typeof import("node:fs")).appendFileSync(wakeDiagnosticLogPath("wake-seed-diag.log"), `${new Date().toISOString()} SEED_ERROR ${String(e)}\n`, "utf8"); } catch {} }
		// Best-effort startup cache seeding only; missing or malformed cache is safe.
	}
}

function lastCompletionWakeParentSessionId(): string {
	const parentSessionRef = lastCompletionWakeParentSessionRef?.trim();
	if (parentSessionRef === undefined || parentSessionRef.length === 0) return "";
	const parentSessionId = parentSessionRef.startsWith("ses-")
		? parentSessionRef.slice("ses-".length)
		: parentSessionRef;
	return parentSessionId.trim();
}

function parentSessionIdWithCompletionWakeFallback(parentSessionId: string | undefined): string | undefined {
	const requestedParentSessionId = parentSessionId?.trim() ?? "";
	if (requestedParentSessionId.length > 0) return requestedParentSessionId;
	const fallbackParentSessionId = lastCompletionWakeParentSessionId();
	return fallbackParentSessionId.length > 0 ? fallbackParentSessionId : parentSessionId;
}

function durableStateRootFromOptions(
	options?: PluginOptions,
): string | undefined {
	const value = options?.[flowdeskDurableStateRootOption];
	return typeof value === "string" && value.trim().length > 0
		? value
		: undefined;
}

export function completionWakeMainSessionConfigFromOptions(options?: PluginOptions, ctx?: unknown): FlowDeskCompletionWakeMainSessionConfigV1 | undefined {
	const value = options?.[flowdeskCompletionWakeMainSessionOption];
	if (!isRecord(value) || value.enabled !== true) return undefined;
	const rootDir = typeof value.rootDir === "string" && value.rootDir.trim().length > 0
		? value.rootDir
		: durableStateRootFromOptions(options);
	const agentName = typeof value.agentName === "string" && value.agentName.trim().length > 0
		? value.agentName.trim()
		: "flowdesk-main";
	const providerQualifiedModelId = typeof options?.model === "string" && options.model.includes("/")
		? options.model.trim()
		: (typeof value.providerQualifiedModelId === "string" && value.providerQualifiedModelId.includes("/")
			? value.providerQualifiedModelId.trim()
			: "openai/gpt-5.5");
	const liveSessionId = liveSessionIdFromContext(ctx);
	const configuredParentSessionRef = typeof value.parentSessionRef === "string" && value.parentSessionRef.trim().length > 0
		? value.parentSessionRef.trim()
		: undefined;
	if (
		liveSessionId.length > 0 &&
		!completionWakeParentSessionRefLockedFromChat &&
		lastCompletionWakeParentSessionRef === undefined
	) {
		lastCompletionWakeParentSessionRef = liveSessionId.startsWith("ses-")
			? liveSessionId
			: `ses-${liveSessionId}`;
		if (WAKE_DIAG_ENABLED) { try { (require("node:fs") as typeof import("node:fs")).appendFileSync(wakeDiagnosticLogPath("wake-seed-diag.log"), `${new Date().toISOString()} OVERWRITE_FROM_CTX liveSessionId=${liveSessionId} stack=${new Error().stack?.split("\n").slice(1,4).join("|")}\n`, "utf8"); } catch {} }
	}
	const parentSessionRef = lastCompletionWakeParentSessionRef ?? configuredParentSessionRef;
	
	if (rootDir === undefined) return undefined;
	return {
		enabled: true,
		rootDir,
		agentName,
		providerQualifiedModelId,
		parentSessionRef,
		...(typeof value.directory === "string" && value.directory.trim().length > 0 ? { directory: value.directory.trim() } : {}),
	};
}

function liveSessionIdFromContext(ctx: unknown): string {
	const record: Record<string, unknown> = isRecord(ctx) ? ctx : {};
	const candidates = [record.sessionID, record.sessionId, record.session_id];
	for (const candidate of candidates) {
		if (typeof candidate !== "string") continue;
		const trimmed = candidate.trim();
		if (trimmed.length > 0) return trimmed;
	}
	return "";
}

function providerQualifiedModelIdFromString(value: unknown): string | undefined {
	if (typeof value !== "string") return undefined;
	const trimmed = value.trim();
	return /^[^\s/]+\/[^\s/]+$/.test(trimmed) ? trimmed : undefined;
}

function providerQualifiedModelIdFromContextModel(value: unknown): string | undefined {
	const stringModel = providerQualifiedModelIdFromString(value);
	if (stringModel !== undefined) return stringModel;
	if (!isRecord(value)) return undefined;
	const providerId = typeof value.providerID === "string" ? value.providerID.trim() : undefined;
	const modelId = typeof value.modelID === "string" ? value.modelID.trim() : undefined;
	return providerId && modelId ? providerQualifiedModelIdFromString(`${providerId}/${modelId}`) : undefined;
}

function productionEnablementFromOptions(
	options?: PluginOptions,
): FlowDeskLocalProductionEnablementOptionsV1 | undefined {
	const value = options?.[flowdeskProductionEnablementOption];
	if (!isRecord(value) || value.enabled !== true) return undefined;
	return {
		enabled: true,
		...(typeof value.preDispatchAuditRef === "string"
			? { preDispatchAuditRef: value.preDispatchAuditRef }
			: {}),
		...(typeof value.configuredVerificationRef === "string"
			? { configuredVerificationRef: value.configuredVerificationRef }
			: {}),
		...(isRecord(value.configuredVerificationResult)
			? {
					configuredVerificationResult:
						value.configuredVerificationResult as unknown as FlowDeskConfiguredVerificationResultV1,
				}
			: {}),
		...(typeof value.sanitizedAuthCaptureRef === "string"
			? { sanitizedAuthCaptureRef: value.sanitizedAuthCaptureRef }
			: {}),
		...(isRecord(value.sanitizedAuthCaptureResult)
			? {
					sanitizedAuthCaptureResult:
						value.sanitizedAuthCaptureResult as unknown as FlowDeskSanitizedAuthCaptureResultV1,
				}
			: {}),
		...(typeof value.externalAuthPolicyRef === "string"
			? { externalAuthPolicyRef: value.externalAuthPolicyRef }
			: {}),
		...(typeof value.providerPolicyRef === "string"
			? { providerPolicyRef: value.providerPolicyRef }
			: {}),
		...(isRecord(value.externalAuthProviderPolicyResult)
			? {
					externalAuthProviderPolicyResult:
						value.externalAuthProviderPolicyResult as unknown as FlowDeskExternalAuthProviderPolicyResultV1,
				}
			: {}),
		...(Array.isArray(value.laneConformanceRefs) &&
		value.laneConformanceRefs.every((ref) => typeof ref === "string")
			? { laneConformanceRefs: value.laneConformanceRefs }
			: {}),
		...(typeof value.allowIncompleteConformance === "boolean"
			? { allowIncompleteConformance: value.allowIncompleteConformance }
			: {}),
		...(isRecord(value.approvalDecision)
			? {
					approvalDecision:
						value.approvalDecision as unknown as FlowDeskProductionApprovalDecisionV1,
				}
			: {}),
	};
}

function reviewerFanoutDiagnosticsFromOptions(
	options?: PluginOptions,
): FlowDeskLocalReviewerFanoutDiagnosticsOptionsV1 | undefined {
	const value = options?.[flowdeskReviewerFanoutDiagnosticsOption];
	if (!isRecord(value) || value.enabled !== true) return undefined;
	return value as unknown as FlowDeskLocalReviewerFanoutDiagnosticsOptionsV1;
}

function isManagedDispatchBetaAdapterEnabled(options?: PluginOptions): boolean {
	const value = options?.[flowdeskManagedDispatchBetaAdapterOption];
	return value === true || (isRecord(value) && value.enabled === true);
}

function isExactModelProviderAcquisitionLiveTestEnabled(
	options?: PluginOptions,
): boolean {
	const value = options?.[flowdeskExactModelProviderAcquisitionLiveTestOption];
	return isRecord(value) && value.enabled === true;
}

function isRuntimeReviewerExecutionEnabled(options?: PluginOptions): boolean {
	const value = options?.[flowdeskRuntimeReviewerExecutionOption];
	return isRecord(value) && value.enabled === true;
}

function defaultManagedDispatchAuthorizationFromOptions(
	options?: PluginOptions,
): FlowDeskDefaultManagedDispatchAuthorizationV1 | undefined {
	const value = options?.[flowdeskDefaultManagedDispatchAuthorizationOption];
	if (!isRecord(value)) return undefined;
	const authorization =
		value as unknown as FlowDeskDefaultManagedDispatchAuthorizationV1;
	const validation =
		validateFlowDeskDefaultManagedDispatchAuthorizationV1(authorization);
	return validation.ok &&
		authorization.state === "authorized" &&
		authorization.default_managed_dispatch_authority_enabled === true
		? authorization
		: undefined;
}

function defaultManagedDispatchAuthorizationAutoOptionsFromProductionEnablement(
	options?: PluginOptions,
): FlowDeskDefaultManagedDispatchAuthorizationAutoOptionsV1 | undefined {
	const production = options?.[flowdeskProductionEnablementOption];
	if (!isRecord(production) || production.enabled !== true) return undefined;
	const value = isRecord(production.defaultManagedDispatchAuthorizationMetadata)
		? production.defaultManagedDispatchAuthorizationMetadata
		: undefined;
	if (!isRecord(value) || value.enabled !== true) return undefined;
	if (
		typeof value.actorRef !== "string" ||
		typeof value.profileRef !== "string" ||
		typeof value.releaseGateRef !== "string" ||
		typeof value.rollbackRef !== "string" ||
		typeof value.expiresAt !== "string" ||
		typeof value.durablePrecallRef !== "string" ||
		// internal identifier — not user-facing
		typeof value.adapterProfileRef !== "string" ||
		typeof value.sdkClientRef !== "string" ||
		typeof value.defaultReleaseEnablementRef !== "string" ||
		typeof value.defaultEnablementRequested !== "boolean" ||
		(value.killSwitchState !== "inactive" && value.killSwitchState !== "active")
	)
		return undefined;
	const release2GateReadinessRef =
		typeof value.release2GateReadinessRef === "string" &&
		value.release2GateReadinessRef.trim().length > 0
			? value.release2GateReadinessRef
			: undefined;
	const release2GateReadinessResult = isRecord(value.release2GateReadinessResult)
		? (value.release2GateReadinessResult as unknown as FlowDeskRelease2ManagedDispatchGatePromotionReadinessV1)
		: undefined;
	return {
		enabled: true,
		...(typeof value.authorizationId === "string" && value.authorizationId.trim().length > 0
			? { authorizationId: value.authorizationId }
			: {}),
		actorRef: value.actorRef,
		profileRef: value.profileRef,
		releaseGateRef: value.releaseGateRef,
		rollbackRef: value.rollbackRef,
		...(typeof value.createdAt === "string" && value.createdAt.trim().length > 0
			? { createdAt: value.createdAt }
			: {}),
		expiresAt: value.expiresAt,
		defaultEnablementRequested: value.defaultEnablementRequested,
		killSwitchState: value.killSwitchState,
		durablePrecallRef: value.durablePrecallRef,
		// internal identifier — not user-facing
		adapterProfileRef: value.adapterProfileRef,
		sdkClientRef: value.sdkClientRef,
		defaultReleaseEnablementRef: value.defaultReleaseEnablementRef,
		...(typeof value.allowUncertainty === "boolean"
			? { allowUncertainty: value.allowUncertainty }
			: {}),
		...(release2GateReadinessRef === undefined
			? {}
			: { release2GateReadinessRef }),
		...(release2GateReadinessResult === undefined
			? {}
			: { release2GateReadinessResult }),
	};
}

function workflowIdFromManagedDispatchRunRequest(
	request: Record<string, unknown>,
): string | undefined {
	if (typeof request.workflow_id === "string" && request.workflow_id.trim().length > 0)
		return request.workflow_id;
	if (
		isRecord(request.managed_dispatch_boundary_input) &&
		typeof request.managed_dispatch_boundary_input.workflowId === "string" &&
		request.managed_dispatch_boundary_input.workflowId.trim().length > 0
	)
		return request.managed_dispatch_boundary_input.workflowId;
	return undefined;
}

function deriveDefaultManagedDispatchAuthorizationFromProductionEnablement(
	input: FlowDeskDerivedDefaultManagedDispatchAuthorizationInputV1,
): FlowDeskDefaultManagedDispatchAuthorizationV1 | undefined {
	const autoOptions =
		defaultManagedDispatchAuthorizationAutoOptionsFromProductionEnablement(
			input.options,
		);
	if (autoOptions === undefined) return undefined;
	const productionOptions = productionEnablementFromOptions(input.options);
	const workflowId = workflowIdFromManagedDispatchRunRequest(input.request);
	if (
		productionOptions === undefined ||
		workflowId === undefined ||
		input.durableStateRootDir === undefined ||
		input.client === undefined
	)
		return undefined;
	const evidenceReload = reloadFlowDeskSessionEvidenceV1({
		workflowId,
		rootDir: input.durableStateRootDir,
	});
	const productionEnablement = evaluateFlowDeskProductionEnablementV1({
		workflowId,
		evidenceReload,
		preDispatchAuditRef: productionOptions.preDispatchAuditRef,
		configuredVerificationRef: productionOptions.configuredVerificationRef,
		configuredVerificationResult: productionOptions.configuredVerificationResult,
		sanitizedAuthCaptureRef: productionOptions.sanitizedAuthCaptureRef,
		sanitizedAuthCaptureResult: productionOptions.sanitizedAuthCaptureResult,
		externalAuthPolicyRef: productionOptions.externalAuthPolicyRef,
		providerPolicyRef: productionOptions.providerPolicyRef,
		externalAuthProviderPolicyResult:
			productionOptions.externalAuthProviderPolicyResult,
		laneConformanceRefs: productionOptions.laneConformanceRefs,
		allowIncompleteConformance: productionOptions.allowIncompleteConformance,
		approvalDecision: productionOptions.approvalDecision,
	});
	if (productionEnablement.plugin_satisfiable_gate_passed !== true)
		return undefined;
	const readiness = evaluateFlowDeskDefaultManagedDispatchPromotionReadinessV1({
		productionEnablement,
		durablePrecallRef: autoOptions.durablePrecallRef,
		// internal identifier — not user-facing
		adapterProfileRef: autoOptions.adapterProfileRef,
		sdkClientRef: autoOptions.sdkClientRef,
		defaultReleaseEnablementRef: autoOptions.defaultReleaseEnablementRef,
		allowUncertainty: autoOptions.allowUncertainty,
		...(autoOptions.release2GateReadinessRef === undefined
			? {}
			: { release2GateReadinessRef: autoOptions.release2GateReadinessRef }),
		...(autoOptions.release2GateReadinessResult === undefined
			? {}
			: {
					release2GateReadinessResult:
						autoOptions.release2GateReadinessResult,
				}),
	});
	const now = input.now ?? new Date();
	return authorizeFlowDeskDefaultManagedDispatchV1({
		authorizationId:
			autoOptions.authorizationId ??
			safeToken(`default-managed-dispatch-authorization-${workflowId}`, "default-managed-dispatch-authorization"),
		readiness,
		actorRef: autoOptions.actorRef,
		profileRef: autoOptions.profileRef,
		releaseGateRef: autoOptions.releaseGateRef,
		rollbackRef: autoOptions.rollbackRef,
		createdAt: autoOptions.createdAt ?? now.toISOString(),
		expiresAt: autoOptions.expiresAt,
		defaultEnablementRequested: autoOptions.defaultEnablementRequested,
		killSwitchState: autoOptions.killSwitchState,
		now: now.getTime(),
	});
}

/**
 * Diagnostic, doctor-only counterpart of
 * `deriveDefaultManagedDispatchAuthorizationFromProductionEnablement`. The
 * regular function is invoked for actual run requests and requires both a
 * concrete `workflow_id` from the request envelope and an injected managed
 * dispatch SDK client. Doctor is invoked without either of those, so this
 * helper performs the same production-enablement + promotion-readiness
 * evaluation against a fixed `doctor-probe-*` workflow id, derived from the
 * configured production enablement metadata. It NEVER opens dispatch
 * authority: the returned authorization, if any, is purely a doctor display
 * artifact derived from durable evidence the user already wrote under the
 * configured `durableStateRoot`.
 *
 * Returns the authorization when:
 *   - default managed dispatch metadata is configured in options, and
 *   - a durable state root is configured, and
 *   - `.flowdesk/sessions/<doctor-probe-workflow-id>/evidence/` already
 *     contains the required plugin-satisfiable evidence files (pre-dispatch
 *     audit, production approval source, dispatch idempotency snapshot), and
 *   - the inline production enablement options (configured verification
 *     result, sanitized auth capture result, external-auth provider policy
 *     result, approval decision) are coherent and approval is "approve".
 *
 * Returns `undefined` otherwise so doctor falls back to the previous
 * `release1_non_dispatch_command_registration_ready` profile and explicit
 * `defaultManagedDispatchRegistrationAuthorized: false` display.
 */
function deriveDefaultManagedDispatchAuthorizationForDoctorV1(input: {
	options?: PluginOptions;
	durableStateRootDir?: string;
	now?: Date;
}): FlowDeskDefaultManagedDispatchAuthorizationV1 | undefined {
	const autoOptions =
		defaultManagedDispatchAuthorizationAutoOptionsFromProductionEnablement(
			input.options,
		);
	if (autoOptions === undefined) return undefined;
	const productionOptions = productionEnablementFromOptions(input.options);
	if (productionOptions === undefined) return undefined;
	if (input.durableStateRootDir === undefined) return undefined;
	const workflowId = doctorProbeWorkflowIdFromOptions(input.options);
	const evidenceReload = reloadFlowDeskSessionEvidenceV1({
		workflowId,
		rootDir: input.durableStateRootDir,
	});
	const productionEnablement = evaluateFlowDeskProductionEnablementV1({
		workflowId,
		evidenceReload,
		preDispatchAuditRef: productionOptions.preDispatchAuditRef,
		configuredVerificationRef: productionOptions.configuredVerificationRef,
		configuredVerificationResult: productionOptions.configuredVerificationResult,
		sanitizedAuthCaptureRef: productionOptions.sanitizedAuthCaptureRef,
		sanitizedAuthCaptureResult: productionOptions.sanitizedAuthCaptureResult,
		externalAuthPolicyRef: productionOptions.externalAuthPolicyRef,
		providerPolicyRef: productionOptions.providerPolicyRef,
		externalAuthProviderPolicyResult:
			productionOptions.externalAuthProviderPolicyResult,
		laneConformanceRefs: productionOptions.laneConformanceRefs,
		allowIncompleteConformance: productionOptions.allowIncompleteConformance,
		approvalDecision: productionOptions.approvalDecision,
	});
	if (productionEnablement.plugin_satisfiable_gate_passed !== true)
		return undefined;
	const readiness = evaluateFlowDeskDefaultManagedDispatchPromotionReadinessV1({
		productionEnablement,
		durablePrecallRef: autoOptions.durablePrecallRef,
		// internal identifier — not user-facing
		adapterProfileRef: autoOptions.adapterProfileRef,
		sdkClientRef: autoOptions.sdkClientRef,
		defaultReleaseEnablementRef: autoOptions.defaultReleaseEnablementRef,
		allowUncertainty: autoOptions.allowUncertainty,
		...(autoOptions.release2GateReadinessRef === undefined
			? {}
			: { release2GateReadinessRef: autoOptions.release2GateReadinessRef }),
		...(autoOptions.release2GateReadinessResult === undefined
			? {}
			: {
					release2GateReadinessResult:
						autoOptions.release2GateReadinessResult,
				}),
	});
	const now = input.now ?? new Date();
	return authorizeFlowDeskDefaultManagedDispatchV1({
		authorizationId:
			autoOptions.authorizationId ??
			safeToken(
				`default-managed-dispatch-authorization-${workflowId}`,
				"default-managed-dispatch-authorization",
			),
		readiness,
		actorRef: autoOptions.actorRef,
		profileRef: autoOptions.profileRef,
		releaseGateRef: autoOptions.releaseGateRef,
		rollbackRef: autoOptions.rollbackRef,
		createdAt: autoOptions.createdAt ?? now.toISOString(),
		expiresAt: autoOptions.expiresAt,
		defaultEnablementRequested: autoOptions.defaultEnablementRequested,
		killSwitchState: autoOptions.killSwitchState,
		now: now.getTime(),
	});
}

/**
 * Fixed-but-overridable workflow id used by the doctor live-evaluation path so
 * the same `.flowdesk/sessions/<id>/evidence/` location is consulted on every
 * invocation. Users can override via
 * `productionEnablement.defaultManagedDispatchAuthorizationMetadata.doctorProbeWorkflowId`.
 */
function doctorProbeWorkflowIdFromOptions(options?: PluginOptions): string {
	const production = options?.[flowdeskProductionEnablementOption];
	if (isRecord(production)) {
		const meta = production.defaultManagedDispatchAuthorizationMetadata;
		if (
			isRecord(meta) &&
			typeof meta.doctorProbeWorkflowId === "string" &&
			meta.doctorProbeWorkflowId.trim().length > 0
		)
			return meta.doctorProbeWorkflowId;
	}
	return "doctor-probe-default-managed-dispatch";
}

function isDefaultManagedDispatchAuthorized(options?: PluginOptions): boolean {
	return defaultManagedDispatchAuthorizationFromOptions(options) !== undefined;
}

function hasDefaultManagedDispatchAuthorizationOption(options?: PluginOptions): boolean {
	return isRecord(options?.[flowdeskDefaultManagedDispatchAuthorizationOption]);
}

function hasDefaultManagedDispatchAuthorizationMetadata(options?: PluginOptions): boolean {
	return (
		defaultManagedDispatchAuthorizationAutoOptionsFromProductionEnablement(options) !==
		undefined
	);
}

function managedDispatchBetaClientFrom(
	input: unknown,
	options?: PluginOptions,
): FlowDeskManagedDispatchBetaOpenCodeClientV1 | undefined {
	const option = options?.[flowdeskManagedDispatchBetaAdapterOption];
	if (isRecord(option) && isManagedDispatchBetaClient(option.client))
		return option.client;
	return isRecord(input) && isManagedDispatchBetaClient(input.client)
		? input.client
		: undefined;
}

function managedDispatchBetaReservationStoreFrom(
	input: unknown,
	options?: PluginOptions,
): FlowDeskManagedDispatchBetaReservationStoreV1 | undefined {
	const option = options?.[flowdeskManagedDispatchBetaAdapterOption];
	if (
		isRecord(option) &&
		isManagedDispatchBetaReservationStore(option.reservationStore)
	)
		return option.reservationStore;
	return isRecord(input) &&
		isManagedDispatchBetaReservationStore(input.reservationStore)
		? input.reservationStore
		: undefined;
}

function managedDispatchBetaDurableReservationStoreFrom(
	options?: PluginOptions,
): FlowDeskManagedDispatchBetaReservationStoreV1 | undefined {
	const option = options?.[flowdeskManagedDispatchBetaAdapterOption];
	const optionRoot =
		isRecord(option) &&
		typeof option.durableStateRoot === "string" &&
		option.durableStateRoot.trim().length > 0
			? option.durableStateRoot
			: undefined;
	const rootDir = optionRoot ?? durableStateRootFromOptions(options);
	return rootDir === undefined
		? undefined
		: createFlowDeskManagedDispatchBetaDurableReservationStoreV1({ rootDir });
}

function exactModelProviderAcquisitionClientFrom(
	input: unknown,
	options?: PluginOptions,
): FlowDeskExactModelProviderAcquisitionClientV1 | undefined {
	const option = options?.[flowdeskExactModelProviderAcquisitionLiveTestOption];
	if (isRecord(option) && isExactModelProviderAcquisitionClient(option.client))
		return option.client;
	if (
		isRecord(input) &&
		isExactModelProviderAcquisitionClient(
			input.exactModelProviderAcquisitionClient,
		)
	)
		return input.exactModelProviderAcquisitionClient;
	if (!isRecord(input)) return undefined;
	const promptBackedCheck =
		isRecord(option) && isRecord(option.promptBackedCheck)
			? option.promptBackedCheck
			: undefined;
	const commonOptions = {
		client: input.client,
		...(typeof input.directory === "string"
			? { directory: input.directory }
			: {}),
		...(typeof input.workspace === "string"
			? { workspace: input.workspace }
			: {}),
	};
	if (promptBackedCheck?.enabled === true) {
		const allowedProviderQualifiedModelIds = Array.isArray(
			promptBackedCheck.allowedProviderQualifiedModelIds,
		)
			? promptBackedCheck.allowedProviderQualifiedModelIds.filter(
					(value): value is string => typeof value === "string",
				)
			: [];
		return createFlowDeskOpenCodePromptBackedProviderAcquisitionClientV1({
			...commonOptions,
			allowProviderCall: promptBackedCheck.allowProviderCall === true,
			allowedProviderQualifiedModelIds,
			...(typeof promptBackedCheck.sessionId === "string"
				? { sessionId: promptBackedCheck.sessionId }
				: {}),
			...(typeof promptBackedCheck.agent === "string"
				? { agent: promptBackedCheck.agent }
				: {}),
		});
	}
	return createFlowDeskOpenCodeMetadataProviderAcquisitionClientV1(
		commonOptions,
	);
}

function exactModelProviderAcquisitionRootFrom(
	options?: PluginOptions,
): string | undefined {
	const option = options?.[flowdeskExactModelProviderAcquisitionLiveTestOption];
	const optionRoot =
		isRecord(option) &&
		typeof option.durableStateRoot === "string" &&
		option.durableStateRoot.trim().length > 0
			? option.durableStateRoot
			: undefined;
	return optionRoot ?? durableStateRootFromOptions(options);
}

function exactModelProviderAcquisitionRuntimeReviewerExecutionClientFrom(
	input: unknown,
	options?: PluginOptions,
): FlowDeskManagedDispatchBetaOpenCodeClientV1 | undefined {
	const option = options?.[flowdeskExactModelProviderAcquisitionLiveTestOption];
	if (
		isRecord(option) &&
		isManagedDispatchBetaClient(option.runtimeReviewerExecutionClient)
	)
		return option.runtimeReviewerExecutionClient;
	if (isRecord(option) && isManagedDispatchBetaClient(option.sdkClient))
		return option.sdkClient;
	return isRecord(input) && isManagedDispatchBetaClient(input.client)
		? input.client
		: undefined;
}

function runtimeReviewerExecutionOptionsFrom(
	options?: PluginOptions,
): FlowDeskRuntimeReviewerExecutionOptionsV1 | undefined {
	const value = options?.[flowdeskRuntimeReviewerExecutionOption];
	if (!isRecord(value) || value.enabled !== true) return undefined;
	return {
		enabled: true,
		...(typeof value.durableStateRoot === "string" &&
		value.durableStateRoot.trim().length > 0
			? { durableStateRoot: value.durableStateRoot }
			: {}),
		...(isManagedDispatchBetaClient(value.client)
			? { client: value.client }
			: {}),
	};
}

function runtimeReviewerExecutionClientFrom(
	input: unknown,
	options?: PluginOptions,
): FlowDeskManagedDispatchBetaOpenCodeClientV1 | undefined {
	const runtimeOptions = runtimeReviewerExecutionOptionsFrom(options);
	if (runtimeOptions?.client !== undefined) return runtimeOptions.client;
	return isRecord(input) && isManagedDispatchBetaClient(input.client)
		? input.client
		: undefined;
}

function runtimeReviewerExecutionRootFrom(
	options?: PluginOptions,
): string | undefined {
	const runtimeOptions = runtimeReviewerExecutionOptionsFrom(options);
	return (
		runtimeOptions?.durableStateRoot ?? durableStateRootFromOptions(options)
	);
}

export function createFlowDeskRuntimeReviewerExecutionOptInTools(
	client: FlowDeskManagedDispatchBetaOpenCodeClientV1,
	rootDir: string,
): Record<string, FlowDeskOpenCodeTool> {
	return {
		[flowdeskRuntimeReviewerExecutionToolName]: tool({
			description:
				"FlowDesk explicit runtime reviewer execution bridge; launches persisted runtime lane plans through an injected SDK client and persists typed reviewer verdict/lifecycle evidence without default dispatch promotion.",
			args: {
				request: tool.schema
					.record(tool.schema.string(), tool.schema.unknown())
					.describe(
						"Explicit runtime reviewer execution request with workflow/attempt/session refs, consumed reviewer-fanout approval, and one verdict expectation per persisted launch-plan evidence id.",
					),
			},
			async execute(input) {
				const record: Record<string, unknown> = isRecord(input) ? input : {};
				if (!isRecord(record.request)) {
					return JSON.stringify(
						redactedRuntimeReviewerExecutionBlocked(
							"Runtime reviewer execution requires a request record.",
						),
					);
				}
				const result = await executeFlowDeskRuntimeReviewerExecutionBridgeV1({
					client,
					rootDir,
					request: record.request,
				});
				return JSON.stringify(result);
			},
		}),
	};
}

function redactedQuickReviewerRunBlocked(reason: string) {
	return {
		// internal identifier — not user-facing
		adapterProfile: "quick_reviewer_run_helper",
		status: "blocked_before_quick_reviewer_run",
		laneCount: 0,
		lanes: [],
		redactedBlockReason: reason,
		summaryForUser: `FlowDesk quick reviewer blocked before launch: ${reason}. Safe next actions: /flowdesk-status.`,
		safeNextActions: ["/flowdesk-status"],
		authority: {
			realOpenCodeDispatch: false,
			fallbackAuthority: false,
			hardCancelOrNoReplyAuthority: false,
			toolAuthority: false,
			providerCall: false,
			runtimeExecution: false,
			actualLaneLaunch: false,
			dispatchAuthorityEnabled: false,
			developerModeAcknowledged: false,
			quickReviewerRunExecuted: false,
		},
	};
}

function redactedQuickReviewerRunToolResult(
	result: FlowDeskQuickReviewerRunResultV1,
): Record<string, unknown> {
	return {
		// internal identifier — not user-facing
		adapterProfile: result.adapterProfile,
		status: result.status,
		workflowId: result.workflowId,
		attemptId: result.attemptId,
		parentSessionId: result.parentSessionId,
		rootDir: result.rootDir,
		providerQualifiedModelId: result.providerQualifiedModelId,
		runtimeAgent: result.runtimeAgent,
		laneCount: result.laneCount,
		lanes: result.lanes,
		acceptanceStatus: result.acceptanceStatus,
		durableLinkageStatus: result.durableLinkageStatus,
		linkedVerdictCount: result.linkedVerdictCount,
		linkedLifecycleCount: result.linkedLifecycleCount,
		acceptedPerspectives: result.acceptedPerspectives,
		redactedBlockReason: result.redactedBlockReason,
		summaryForUser: result.summaryForUser,
		safeNextActions: result.safeNextActions,
		authority: result.authority,
	};
}

export function createFlowDeskQuickReviewerRunOptInTools(
	client: FlowDeskManagedDispatchBetaOpenCodeClientV1,
	defaults: {
		providerQualifiedModelId?: string;
		runtimeAgent?: string;
		sourceLabel?: string;
		rootDir?: string;
	},
): Record<string, FlowDeskOpenCodeTool> {
	return {
		[flowdeskQuickReviewerRunToolName]: tool({
			description: [
				"Run a 3-perspective FlowDesk reviewer fan-out (policy_security, architecture, verification_implementation) on a user-supplied prompt, pasted code/content, or the current conversation context, returning typed reviewer verdicts plus a concise summaryForUser string. Supports optional per-perspective bindings[] for multi-model fan-out when exact provider/model ids and reviewer agents are configured.",
				"WHEN TO USE: the user explicitly asks for a code review, security audit, multi-perspective check, critical review, design review, or quality review. Trigger on English phrases such as 'multi-perspective review', 'multi-angle review', 'critical review', 'review from multiple perspectives', 'audit', 'critique', 'assess', or 'evaluate'. Trigger on Korean phrases such as '다관점 리뷰', '다관점리뷰', '다관점 비판적리뷰', '다관점 비판적 리뷰', '다각도 리뷰', '다각도 검토', '여러 관점 리뷰', '여러 관점에서 검토', '복수 관점 리뷰', '비판적 리뷰', '비판적 검토', '심층 리뷰', '아키텍처 리뷰', '보안 리뷰', '품질 리뷰', '검토', or '점검'.",
				"ALSO PROACTIVELY USE: when the user supplies a code snippet, file reference, or design idea and asks for opinion/critique without explicitly typing 'review' (English: 'what do you think', 'how does this look', 'spot issues', 'find problems'; Korean: '어때', '괜찮아', '문제 있어 보여', '이슈 찾아줘', '봐줘'). When the user gives no snippet, derive a concise review target from the immediate prior turn and call this tool instead of asking for one more clarification.",
				"CONTENT SELECTION: code is not required. If the user provides no explicit snippet after the trigger phrase, pass a concise prompt that includes the user's request plus the relevant current conversation context or target they are asking to review.",
				"WHEN NOT TO USE: general questions, plain chat, status/usage/recovery questions (use the other FlowDesk natural-language tools), or any request that does not explicitly ask for a review-style judgement.",
				"INVOKE WITH: developerModeAcknowledged=true and allowProviderCall=true. The plugin user has already opted into this tool at configuration time, so these flags must be set on every call. Do not ask the user for extra confirmation before calling; just call.",
				"AFTER CALLING: read the result.summaryForUser string and surface it verbatim or compressed in your reply to the user. acceptanceStatus=verdicts_accepted and durableLinkageStatus=durable_verdicts_accepted mean all requested perspectives passed. status=quick_reviewer_run_incomplete means at least one lane did not produce a matching typed verdict; lanes[].redactedObservationErrors and lanes[].observationStatus indicate why. status=blocked_before_quick_reviewer_run means the helper refused before launching providers; report result.redactedBlockReason as-is. After surfacing summaryForUser, recommend the safeNextActions in result.safeNextActions for follow-up.",
				"LANE HEARTBEAT: each reviewer lane automatically records one durable flowdesk.lane_heartbeat.v1 evidence record on launch through the runtime reviewer execution bridge; status_live and the chat.message stall card consume that heartbeat as the latest progress signal so the lane shows as progressing_normal while it is still working.",
			].join(" "),
			args: {
				prompt: tool.schema
					.string()
					.describe(
						"Plain-text review target to send to the reviewer lanes as evidence to review. This can be pasted code/content or a concise summary of the relevant current conversation context when no snippet is provided.",
					),
				developerModeAcknowledged: tool.schema
					.boolean()
					.describe(
						"Must be true to explicitly acknowledge that this is a developer-mode synthetic approval, not a production-grade reviewer fan-out.",
					),
				allowProviderCall: tool.schema
					.boolean()
					.describe(
						"Must be true to explicitly allow real provider calls for the reviewer lanes.",
					),
				providerQualifiedModelId: tool.schema
					.string()
					.optional()
					.describe(
						"Optional concrete provider/model id override. Defaults to the value configured in the quickReviewerRun plugin option.",
					),
				runtimeAgent: tool.schema
					.string()
					.optional()
					.describe(
						"Optional reviewer agent override. Defaults to the value configured in the quickReviewerRun plugin option.",
					),
				perspectives: tool.schema
					.array(tool.schema.string())
					.optional()
					.describe(
						"Optional subset of reviewer perspectives (policy_security, architecture, verification_implementation). Defaults to all three.",
					),
				bindings: tool.schema
					.array(
						tool.schema.object({
							perspective: tool.schema.string(),
							providerQualifiedModelId: tool.schema.string(),
							runtimeAgent: tool.schema.string(),
							sourceLabel: tool.schema.string().optional(),
						}),
					)
					.optional()
					.describe(
						"Optional per-perspective reviewer bindings for multi-model fan-out. Each entry must include perspective, concrete providerQualifiedModelId, and runtimeAgent. When omitted, all perspectives use providerQualifiedModelId/runtimeAgent.",
					),
				parentSessionId: tool.schema
					.string()
					.optional()
					.describe(
						"Optional existing parent session id. If omitted, the tool creates a new top-level session via the injected SDK client.",
					),
			},
			async execute(input) {
				const record: Record<string, unknown> = isRecord(input) ? input : {};
				const prompt =
					typeof record.prompt === "string" ? record.prompt : undefined;
				if (prompt === undefined)
					return JSON.stringify(
						redactedQuickReviewerRunBlocked(
							"Quick reviewer run requires a prompt string.",
						),
					);
				const providerQualifiedModelId =
					typeof record.providerQualifiedModelId === "string" &&
					record.providerQualifiedModelId.trim().length > 0
						? record.providerQualifiedModelId
						: defaults.providerQualifiedModelId;
				const runtimeAgent =
					typeof record.runtimeAgent === "string" &&
					record.runtimeAgent.trim().length > 0
						? record.runtimeAgent
						: defaults.runtimeAgent;
				const perspectives = Array.isArray(record.perspectives)
					? (record.perspectives.filter(
							(value): value is string => typeof value === "string",
						) as never)
					: undefined;
				const bindings = Array.isArray(record.bindings)
					? (record.bindings
							.filter((value): value is Record<string, unknown> => isRecord(value))
							.map((value) => ({
								perspective: value.perspective,
								providerQualifiedModelId: value.providerQualifiedModelId,
								runtimeAgent: value.runtimeAgent,
								...(typeof value.sourceLabel === "string"
									? { sourceLabel: value.sourceLabel }
									: {}),
							}))
							.filter(
								(value): value is {
									perspective: never;
									providerQualifiedModelId: string;
									runtimeAgent: string;
									sourceLabel?: string;
								} =>
									typeof value.perspective === "string" &&
									typeof value.providerQualifiedModelId === "string" &&
									typeof value.runtimeAgent === "string",
							) as never)
					: undefined;
				if (
					bindings === undefined &&
					(typeof providerQualifiedModelId !== "string" ||
						typeof runtimeAgent !== "string")
				)
					return JSON.stringify(
						redactedQuickReviewerRunBlocked(
							"Quick reviewer run requires providerQualifiedModelId and runtimeAgent (either as args or plugin defaults) unless per-perspective bindings are supplied.",
						),
					);
				const result = await executeFlowDeskQuickReviewerRunV1({
					client,
					prompt,
					providerQualifiedModelId,
					runtimeAgent,
					allowProviderCall: record.allowProviderCall === true,
					developerModeAcknowledged: record.developerModeAcknowledged === true,
					...(perspectives === undefined ? {} : { perspectives }),
					...(bindings === undefined ? {} : { bindings }),
					...(typeof record.parentSessionId === "string" &&
					record.parentSessionId.length > 0
						? { parentSessionId: record.parentSessionId }
						: {}),
					...(defaults.rootDir === undefined
						? {}
						: { rootDir: defaults.rootDir }),
					...(defaults.sourceLabel === undefined
						? {}
						: { sourceLabel: defaults.sourceLabel }),
				});
				return JSON.stringify(redactedQuickReviewerRunToolResult(result));
			},
		}),
	};
}

export function createFlowDeskAgentTaskRunOptInTools(input: {
	client: FlowDeskManagedDispatchBetaOpenCodeClientV1 | undefined;
	durableStateRoot: string | undefined;
	options?: PluginOptions;
}): Record<string, FlowDeskOpenCodeTool> {
	const client = input.client;
	const rootDir = input.durableStateRoot;
	const options = input.options;
	const promptPreview = (text: string, max = 120) => {
		const compact = text.replace(/\s+/g, " ").trim();
		return compact.length > max ? `${compact.slice(0, max - 1)}…` : compact;
	};
	const taskSummaryForUser = (input: {
		status: FlowDeskAgentTaskResultV1["status"];
		workflowId: string;
		laneId: string;
		taskId: string;
		agentName: string;
		providerQualifiedModelId: string;
		promptText: string;
		resultText?: string;
		failureCategory?: string;
		redactedReason?: string;
		asyncMode?: boolean;
	}) => {
		const lines = [
			input.status === "task_completed"
				? "FlowDesk task completed."
				: input.status === "task_launched"
					? "FlowDesk task launched."
					: "FlowDesk task failed.",
			`workflow: ${input.workflowId}`,
			`lane: ${input.laneId}`,
			`task: ${input.taskId}`,
			`prompt: ${promptPreview(input.promptText)}`,
			`agent: ${input.agentName}`,
			`model: ${input.providerQualifiedModelId}`,
		];
		if (input.asyncMode === true) lines.push("progress: use /flowdesk-status or flowdesk_now to follow durable lane evidence");
		if (input.resultText !== undefined) lines.push(`result: ${promptPreview(input.resultText, 200)}`);
		if (input.failureCategory !== undefined) lines.push(`failure: ${input.failureCategory}${input.redactedReason === undefined ? "" : ` (${input.redactedReason})`}`);
		return lines.join("\n");
	};
	const createAgentTaskTool = (input: {
		description: string;
		defaultAsyncMode: boolean;
		defaultNudgeQuietPeriodMs?: number;
		compactArgs?: boolean;
	}) =>
		tool({
			description: input.description,
			args: {
				workflowId: tool.schema.string().describe("Workflow id (e.g. workflow-xxx)"),
				taskDescription: tool.schema.string().max(20_000).describe("The task prompt to send to the agent"),
				agentName: tool.schema.string().describe("Agent name (e.g. reviewer-claude-opus, reviewer-gpt-frontier)"),
				providerQualifiedModelId: tool.schema.string().describe("Concrete model id (e.g. anthropic/claude-opus-4-7)"),
				parentSessionId: tool.schema.string().describe("Parent session id. Use an empty string to bind to current session."),
				developerModeAcknowledged: tool.schema.boolean(),
				allowProviderCall: tool.schema.boolean(),
				nudgeQuietPeriodMs: tool.schema.number().optional().describe(input.compactArgs === true
					? "Optional no-response nudge quiet period in milliseconds; defaults to 10000 for flowdesk_task."
					: "Milliseconds of silence before sending a nudge prompt. Default 10000ms (10s). Recommended: always pass 10000. At 10s silence → nudge 1, 20s → nudge 2, 30s+ → lane fails and watchdog retries."),
				asyncMode: tool.schema.boolean().optional().describe(input.compactArgs === true
					? "Optional async launch mode; defaults to true for flowdesk_task."
					: "When true, return laneId immediately after launch. Watchdog polls child session, sends noReply nudges at 10s/20s, and aborts at 30s+. Coordinator uses flowdesk_now to detect completion. Recommended for all orchestration calls."),
			},
			async execute(args, ctx) {
				if (!client)
					return JSON.stringify({
						status: "blocked",
						reason: "opencode_sdk_client_unavailable_for_agent_task_run",
						redactedBlockReason:
							"OpenCode did not provide an SDK client to the FlowDesk agent task tool. The tool remains schema-visible because agentTaskRun is enabled, but task launch is fail-closed until the runtime client is available.",
						safeNextActions: ["/flowdesk-doctor", "/flowdesk-status"],
					});
				if (!rootDir)
					return JSON.stringify({
						status: "blocked",
						reason: "durable_state_root_missing_for_agent_task_run",
						redactedBlockReason:
							"FlowDesk durableStateRoot is required before launching agent task lanes.",
						safeNextActions: ["/flowdesk-doctor"],
					});
				const record: Record<string, unknown> = isRecord(args) ? args : {};
				if (record.developerModeAcknowledged !== true)
					return JSON.stringify({ status: "blocked", reason: "developerModeAcknowledged must be true" });
				if (record.allowProviderCall !== true)
					return JSON.stringify({ status: "blocked", reason: "allowProviderCall must be true" });
				const workflowId = typeof record.workflowId === "string" ? record.workflowId : undefined;
				const taskDescription = typeof record.taskDescription === "string" ? record.taskDescription : undefined;
				const agentName = typeof record.agentName === "string" ? record.agentName : undefined;
				const providerQualifiedModelId = typeof record.providerQualifiedModelId === "string" ? record.providerQualifiedModelId : undefined;
				if (!workflowId || !taskDescription || !agentName || !providerQualifiedModelId)
					return JSON.stringify({ status: "blocked", reason: "workflowId, taskDescription, agentName, and providerQualifiedModelId are required" });
				const ctxRecord: Record<string, unknown> = isRecord(ctx) ? ctx : {};
				const parentSessionProviderQualifiedModelId = providerQualifiedModelIdFromContextModel(ctxRecord.model)
					?? providerQualifiedModelIdFromString(options?.model);
				const requestedParentSessionId = typeof record.parentSessionId === "string"
					? record.parentSessionId.trim()
					: "";
				const currentSessionId = liveSessionIdFromContext(ctx);
				const parentSessionId = requestedParentSessionId.length > 0
					? requestedParentSessionId
					: input.compactArgs === true
						? currentSessionId.length > 0
							? currentSessionId
							: lastCompletionWakeParentSessionId()
						: currentSessionId;
				const nudgeQuietPeriodMs = typeof record.nudgeQuietPeriodMs === "number" && record.nudgeQuietPeriodMs > 0
					? Math.floor(record.nudgeQuietPeriodMs) : input.defaultNudgeQuietPeriodMs;
				const asyncMode = typeof record.asyncMode === "boolean"
					? record.asyncMode
					: input.defaultAsyncMode;
				const taskId = `task-${Date.now().toString(36)}`;
				const laneId = `lane-task-${Date.now().toString(36)}`;
				// Selection-phase pre-launch preferred-model substitution
				// (no dispatch/fallback/Guard authority; not managed fallback/reselection).
				const resolved = resolveUsageAwareModelForServer(rootDir, providerQualifiedModelId);
				const effectiveModelId = resolved.resolvedModelId;
				const result = await executeFlowDeskAgentTaskV1({
					workflowId,
					taskId,
					laneId,
					agentRef: `agent-${agentName}`,
					providerQualifiedModelId: effectiveModelId,
					promptText: taskDescription,
					parentSessionId,
					parentSessionProviderQualifiedModelId,
					rootDir,
					client,
					asyncMode,
					_nudgeQuietPeriodMs: nudgeQuietPeriodMs,
					...(resolved.overrideApplied && resolved.overrideReason ? {
						usageAwareOverride: {
							originalModelId: providerQualifiedModelId,
							overrideReason: resolved.overrideReason,
							allowCrossFamily: true,
						},
					} : {}),
				});
				const failureCategory = result.status === "task_failed" ? result.failureCategory : undefined;
				const redactedReason = result.status === "task_failed" ? result.redactedReason : undefined;
				return JSON.stringify({
					workflowId,
					laneId,
					taskId,
					status: result.status,
					taskPreview: promptPreview(taskDescription),
					agentName,
					providerQualifiedModelId: effectiveModelId,
					requestedModel: providerQualifiedModelId,
					effectiveModel: effectiveModelId,
					modelOverrideApplied: resolved.overrideApplied,
					providerBindingChangedBeforeLaunch: resolved.providerBindingChangedBeforeLaunch,
					preLaunchModelSubstitution: resolved.preLaunchModelSubstitution,
					modelSubstitutionKind: resolved.modelSubstitutionKind,
					...(resolved.overrideReason === undefined ? {} : { modelOverrideReason: resolved.overrideReason }),
					...(result.status === "task_launched" ? { childSessionId: result.childSessionId, asyncMode: true, safeNextActions: ["/flowdesk-status"] } : {}),
					resultText: result.status === "task_completed" ? result.resultText.slice(0, 4_096) : undefined,
					resultTruncated: result.status === "task_completed" && result.resultText.length > 4_096,
					failureCategory,
					redactedReason,
					summaryForUser: taskSummaryForUser({
						status: result.status,
						workflowId,
						laneId,
						taskId,
						agentName,
						providerQualifiedModelId: effectiveModelId,
						promptText: taskDescription,
						...(result.status === "task_completed" ? { resultText: result.resultText } : {}),
						...(result.status === "task_launched" ? { asyncMode: true } : {}),
						...(failureCategory === undefined ? {} : { failureCategory }),
						...(redactedReason === undefined ? {} : { redactedReason }),
					}),
				});
			},
		});
	return {
		[flowdeskAgentTaskRunToolName]: createAgentTaskTool({
			description: [
				"Run a single task on a specific agent and model, returning the result text.",
				"Use this to delegate a well-defined subtask to a specific model (e.g. Claude Opus for security analysis, GPT for architecture review).",
				"Requires developerModeAcknowledged=true and allowProviderCall=true per call.",
				"WHEN TO USE: user asks to delegate a specific task to a specific model/agent.",
				"WHEN NOT TO USE: multi-step workflows (use flowdesk_workflow_dispatch).",
				"After calling, use flowdesk_now to check the lane status.",
			].join(" "),
			defaultAsyncMode: false,
		}),
		[flowdeskTaskToolName]: createAgentTaskTool({
			description:
				"Compact dev/beta task launcher. Req: developerModeAcknowledged, allowProviderCall. Defaults: parentSession='', nudgeQuietPeriodMs=10k, async=true. Substitutes models if quota exhausted. Returns model substitution details, requested/effective models, and metadata.",
			defaultAsyncMode: true,
			defaultNudgeQuietPeriodMs: 10_000,
			compactArgs: true,
		}),
		...(client !== undefined ? { [flowdeskTaskAbortToolName]: createFlowDeskTaskAbortTool(client, rootDir) } : {}),
	};
}

function redactedManagedFallbackRegateBlocked(reason: string) {
	return {
		// internal identifier — not user-facing
		adapterProfile: "managed_fallback_regate_orchestrator",
		status: "blocked_before_regate_plan",
		dispatchAttempted: false,
		providerSwitchAttempted: false,
		sdkCallAttempted: false,
		redactedBlockReason: reason,
		safeNextActions: ["/flowdesk-status"],
		authority: {
			...disabledAuthority,
			toolAuthority: false,
			automaticFallbackAuthorized: false,
			freshRegatePlanPrepared: false,
		},
	};
}

function redactedManagedFallbackRegateToolResult(
	result: ReturnType<typeof orchestrateFlowDeskManagedFallbackRegateV1>,
): Record<string, unknown> {
	return {
		// internal identifier — not user-facing
		adapterProfile: result.adapterProfile,
		status: result.status,
		dispatchAttempted: result.dispatchAttempted,
		providerSwitchAttempted: result.providerSwitchAttempted,
		sdkCallAttempted: result.sdkCallAttempted,
		workflowId: result.workflowId,
		parentAttemptId: result.parentAttemptId,
		newAttemptId: result.newAttemptId,
		fromProviderQualifiedModelId: result.fromProviderQualifiedModelId,
		toProviderQualifiedModelId: result.toProviderQualifiedModelId,
		regatePlanState: result.regatePlan?.state,
		regatePlanOk: result.regatePlan?.ok,
		regatePlanErrors: result.regatePlan?.errors,
		requiredFreshEvidenceRefCount: Array.isArray(
			result.regatePlan?.required_fresh_evidence_refs,
		)
			? result.regatePlan.required_fresh_evidence_refs.length
			: undefined,
		requiredGuardDecisionRef: result.regatePlan?.required_guard_decision_ref,
		requiredApprovalRef: result.regatePlan?.required_approval_ref,
		requiredPreDispatchAuditRef:
			result.regatePlan?.required_pre_dispatch_audit_ref,
		policyEligibilityRef: result.regatePlan?.policy_eligibility_ref,
		runtimeCompatibilityRef: result.regatePlan?.runtime_compatibility_ref,
		consumedFallbackApprovalRef:
			result.regatePlan?.consumed_fallback_approval_ref,
		safeNextActions: result.safeNextActions,
		redactedBlockReason: result.redactedBlockReason,
		authority: { ...result.authority, toolAuthority: false },
	};
}

export function createFlowDeskManagedFallbackRegateOptInTools(
	rootDir?: string,
): Record<string, FlowDeskOpenCodeTool> {
	return {
		[flowdeskManagedFallbackRegateToolName]: tool({
			description:
				"FlowDesk explicit opt-in managed fallback regate planning tool; converts a valid fallback decision plus consumed reviewer fallback approval into a fresh full re-gate plan without dispatch, provider switching, SDK calls, or runtime authority.",
			args: {
				decision: tool.schema
					.record(tool.schema.string(), tool.schema.unknown())
					.describe(
						"Complete FlowDeskFallbackDecisionV1 with new attempt id, fresh evidence refs, fresh guard/approval/audit/policy/runtime-compatibility refs, and explicit automatic_fallback_authorized=false.",
					),
				consumedApproval: tool.schema
					.record(tool.schema.string(), tool.schema.unknown())
					.describe(
						"Consumed FlowDeskProductionApprovalSourceV1 with action_type=fallback_reselection bound to the new attempt id.",
					),
				persistRegatePlanEvidence: tool.schema
					.boolean()
					.optional()
					.describe(
						"When true and a configured durable state root is available, persist the resulting regate plan as fallback_regate_plan session evidence.",
					),
				regatePlanEvidenceId: tool.schema
					.string()
					.optional()
					.describe(
						"Evidence id to use when persisting the regate plan. Required when persistRegatePlanEvidence is true.",
					),
			},
			async execute(input) {
				const record: Record<string, unknown> = isRecord(input) ? input : {};
				if (!isRecord(record.decision) || !isRecord(record.consumedApproval)) {
					return JSON.stringify(
						redactedManagedFallbackRegateBlocked(
							"Managed fallback regate requires both decision and consumedApproval records.",
						),
					);
				}
				const result = orchestrateFlowDeskManagedFallbackRegateV1({
					decision: record.decision as unknown as FlowDeskFallbackDecisionV1,
					consumedApproval:
						record.consumedApproval as unknown as FlowDeskProductionApprovalSourceV1,
				});
				const redacted = redactedManagedFallbackRegateToolResult(result);
				const persistRequested = record.persistRegatePlanEvidence === true;
				const evidenceId =
					typeof record.regatePlanEvidenceId === "string"
						? record.regatePlanEvidenceId
						: undefined;
				if (
					persistRequested &&
					rootDir !== undefined &&
					result.regatePlan !== undefined &&
					result.status === "regate_plan_ready" &&
					evidenceId !== undefined &&
					evidenceId.trim().length > 0
				) {
					const persistResult =
						materializeFlowDeskManagedFallbackRegatePlanEvidenceV1({
							rootDir,
							regatePlan: result.regatePlan,
							evidenceId,
						});
					redacted.regatePlanEvidence = {
						status: persistResult.status,
						writeAttempted: persistResult.writeAttempted,
						evidenceReloaded: persistResult.evidenceReloaded,
						evidenceId: persistResult.evidenceId,
						redactedBlockReason: persistResult.redactedBlockReason,
						authority: persistResult.authority,
					};
				}
				return JSON.stringify(redacted);
			},
		}),
	};
}

function isManagedFallbackRegateEnabled(options?: PluginOptions): boolean {
	const value = options?.[flowdeskManagedFallbackRegateOption];
	return value === true || (isRecord(value) && value.enabled === true);
}

function isQuickReviewerRunEnabled(options?: PluginOptions): boolean {
	const value = options?.[flowdeskQuickReviewerRunOption];
	return value === true || (isRecord(value) && value.enabled === true);
}

function isProviderUsageLiveEnabled(options?: PluginOptions): boolean {
	const value = options?.[flowdeskProviderUsageLiveOption];
	return value === true || (isRecord(value) && value.enabled === true);
}

/**
 * Returns true when OpenCode auth store has a google/gemini OAuth record that
 * FlowDesk's Gemini usage collector can auto-detect (via opencode-gemini-auth login),
 * without requiring explicit geminiOAuthClientId/Secret config.
 */
function geminiOAuthAutoDetectAvailable(homeDir?: string): boolean {
	try {
		const home = homeDir ?? process.env.HOME ?? process.env.USERPROFILE ?? "";
		if (!home) return false;
		const xdgData = process.env.XDG_DATA_HOME
			? join(process.env.XDG_DATA_HOME, "opencode")
			: join(home, ".local", "share", "opencode");
		const authPath = join(xdgData, "auth.json");
		const raw = readFileSync(authPath, "utf8");
		const parsed = JSON.parse(raw) as unknown;
		if (typeof parsed !== "object" || parsed === null) return false;
		const db = parsed as Record<string, unknown>;
		const entry = db.google ?? db.gemini;
		if (typeof entry !== "object" || entry === null) return false;
		const rec = entry as Record<string, unknown>;
		return rec.type === "oauth" &&
			(typeof rec.access === "string" && rec.access.length > 0 ||
				typeof rec.refresh === "string" && rec.refresh.length > 0);
	} catch {
		return false;
	}
}

function providerUsageLiveConfigFromOptions(
	options?: PluginOptions,
): FlowDeskProviderUsageLiveConfigV1 | undefined {
	const value = options?.[flowdeskProviderUsageLiveOption];
	if (!isRecord(value) || value.enabled !== true) return undefined;
	const config: FlowDeskProviderUsageLiveConfigV1 = {};
	if (typeof value.homeDir === "string" && value.homeDir.trim().length > 0)
		config.homeDir = value.homeDir;
	else config.homeDir = process.env.HOME ?? process.env.USERPROFILE ?? homedir();
	if (Array.isArray(value.providers)) {
		const allowed = value.providers.filter(
			(family): family is FlowDeskProviderUsageLiveProviderFamilyV1 =>
				family === "claude" || family === "openai" || family === "gemini",
		);
		config.providers = allowed;
	}
	if (typeof value.claudeOAuthUsage === "boolean")
		config.claudeOAuthUsage = value.claudeOAuthUsage;
	if (typeof value.codexLiveUsage === "boolean")
		config.codexLiveUsage = value.codexLiveUsage;
	if (typeof value.geminiQuota === "boolean")
		config.geminiQuota = value.geminiQuota;
	if (
		typeof value.geminiOAuthClientId === "string" &&
		value.geminiOAuthClientId.trim().length > 0
	)
		config.geminiOAuthClientId = value.geminiOAuthClientId;
	if (
		typeof value.geminiOAuthClientSecret === "string" &&
		value.geminiOAuthClientSecret.trim().length > 0
	)
		config.geminiOAuthClientSecret = value.geminiOAuthClientSecret;
	if (
		typeof value.geminiProjectId === "string" &&
		value.geminiProjectId.trim().length > 0
	)
		config.geminiProjectId = value.geminiProjectId;
	if (value.persistSnapshots === true) config.persistSnapshots = true;
	if (value.appendToChat === true) config.appendToChat = true;
	const explicitRoot =
		typeof value.durableStateRootDir === "string" &&
		value.durableStateRootDir.trim().length > 0
			? value.durableStateRootDir
			: undefined;
	const root = explicitRoot ?? durableStateRootFromOptions(options);
	if (root !== undefined) config.durableStateRootDir = root;
	if (
		typeof value.persistWorkflowId === "string" &&
		value.persistWorkflowId.trim().length > 0
	)
		config.persistWorkflowId = value.persistWorkflowId;
	return config;
}

function isQuickFallbackRunEnabled(options?: PluginOptions): boolean {
	const value = options?.[flowdeskQuickFallbackRunOption];
	return value === true || (isRecord(value) && value.enabled === true);
}

function quickFallbackRunConfigFromOptions(
	options?: PluginOptions,
): FlowDeskQuickFallbackRunConfigV1 | undefined {
	const value = options?.[flowdeskQuickFallbackRunOption];
	if (!isRecord(value) || value.enabled !== true) return undefined;
	const config: FlowDeskQuickFallbackRunConfigV1 = {};
	if (
		typeof value.defaultFromProvider === "string" &&
		value.defaultFromProvider.trim().length > 0
	)
		config.defaultFromProvider = value.defaultFromProvider;
	if (
		typeof value.defaultToProvider === "string" &&
		value.defaultToProvider.trim().length > 0
	)
		config.defaultToProvider = value.defaultToProvider;
	if (
		typeof value.sourceLabel === "string" &&
		value.sourceLabel.trim().length > 0
	)
		config.sourceLabel = value.sourceLabel;
	const explicitRoot =
		typeof value.rootDir === "string" && value.rootDir.trim().length > 0
			? value.rootDir
			: undefined;
	const root = explicitRoot ?? durableStateRootFromOptions(options);
	if (root !== undefined) config.rootDir = root;
	return config;
}

export function createFlowDeskQuickFallbackRunOptInTools(
	config: FlowDeskQuickFallbackRunConfigV1,
): Record<string, FlowDeskOpenCodeTool> {
	const quickFallbackRequestFrom = (input: unknown) =>
		isRecord(input)
			? {
					fromProvider:
						typeof input.fromProvider === "string"
							? input.fromProvider
							: undefined,
					toProvider:
						typeof input.toProvider === "string"
							? input.toProvider
							: undefined,
					reason:
						typeof input.reason === "string" ? input.reason : undefined,
					workflowId:
						typeof input.workflowId === "string"
							? input.workflowId
							: undefined,
					developerModeAcknowledged:
						typeof input.developerModeAcknowledged === "boolean"
							? input.developerModeAcknowledged
							: undefined,
					persistRegatePlanEvidence:
						typeof input.persistRegatePlanEvidence === "boolean"
							? input.persistRegatePlanEvidence
							: undefined,
				}
			: {};
	const explicitIdentityConfig: FlowDeskQuickFallbackRunConfigV1 = {
		...(config.rootDir ? { rootDir: config.rootDir } : {}),
		...(config.sourceLabel ? { sourceLabel: config.sourceLabel } : {}),
	};
	return {
		[flowdeskQuickFallbackRunToolName]: tool({
			description: [
				"Plan a FlowDesk fallback regate from one provider to another by auto-building a developer-mode synthetic fallback decision and consumed fallback_reselection approval, then running the FlowDesk fallback regate orchestrator to produce a redacted regate plan. This tool plans, it does not switch providers or dispatch real lanes; FlowDesk default dispatch authority remains disabled.",
				"WHEN TO USE: the user explicitly says one provider is blocked, exhausted, slow, or otherwise unwanted and asks to retry the work on a different provider. Trigger on English phrases such as 'fallback to', 'switch to', 'retry with', 'try with another provider', 'use a different provider', 'this provider is blocked', and on Korean phrases such as '막혔어', '다른 걸로 다시', '다른 provider 로', '다른 모델로 재시도', '재시도 해줘', '바꿔서 다시', 'fallback 해줘', '다른 곳으로 돌려', 'OpenAI 로 다시', 'Claude 로 다시', 'Gemini 로 다시'.",
				"WHEN NOT TO USE: general usage/quota questions (use flowdesk_quota), code review/audit requests (use explicit flowdesk_task reviewer lanes), workflow status questions (use flowdesk_now), or any request that does not explicitly ask to retry on a different provider.",
				"INVOKE WITH: fromProvider (concrete provider-qualified model id, e.g. 'claude/sonnet-4'), toProvider (concrete provider-qualified model id, e.g. 'openai/gpt-5.5'), optional reason ('provider_unhealthy', 'quota_exhausted', 'runtime_incompatible', 'policy_ineligible', or 'manual_reselection_requested'; defaults to 'manual_reselection_requested'), optional workflowId (auto-generated otherwise), and developerModeAcknowledged=true. The plugin user has already opted into this tool at configuration time, so the assistant should set developerModeAcknowledged=true automatically and call the tool directly without per-call confirmation. Optionally set persistRegatePlanEvidence=true to persist the resulting plan as durable session evidence.",
				"AFTER CALLING: summarize the orchestrator status to the user. On status=quick_fallback_run_completed, surface the new attempt id, regate plan state (typically 'full_regate_required'), required fresh evidence count, and remind the user that the actual provider switch is still blocked behind managed-dispatch promotion. On status=quick_fallback_run_incomplete, surface the regatePlanRedactedErrors or redactedBlockReason and suggest what evidence to refresh. Never echo raw provider/auth/token payloads.",
			].join(" "),
			args: {
				fromProvider: tool.schema
					.string()
					.optional()
					.describe(
						"Concrete provider-qualified model id the current attempt is on (e.g. 'claude/sonnet-4').",
					),
				toProvider: tool.schema
					.string()
					.optional()
					.describe(
						"Concrete provider-qualified model id to switch to (e.g. 'openai/gpt-5.5').",
					),
				reason: tool.schema
					.string()
					.optional()
					.describe(
						"Fallback reason label: 'provider_unhealthy', 'quota_exhausted', 'runtime_incompatible', 'policy_ineligible', or 'manual_reselection_requested'.",
					),
				workflowId: tool.schema
					.string()
					.optional()
					.describe(
						"Optional workflow id to bind the regate plan to. Auto-generated when omitted.",
					),
				developerModeAcknowledged: tool.schema
					.boolean()
					.describe(
						"Must be true to acknowledge that this tool synthesizes a developer-mode fallback_reselection approval. Not a production-grade approval.",
					),
				persistRegatePlanEvidence: tool.schema
					.boolean()
					.optional()
					.describe(
						"When true and a durable state root is configured, persist the resulting regate plan as fallback_regate_plan session evidence.",
					),
			},
			async execute(input) {
				const request = quickFallbackRequestFrom(input);
				const result = await executeFlowDeskQuickFallbackRunV1({
					config,
					request,
				});
				return JSON.stringify(result);
			},
		}),
		[flowdeskRebindToolName]: tool({
			description:
				"Plan a provider rebind regate using the quick fallback helper. Planning-only: no provider switch, dispatch, runtime, lane launch, write/apply, hard-cancel, or SDK-scoped noReply control.",
			args: {
				fromProvider: tool.schema
					.string()
					.describe("Current concrete provider-qualified model id."),
				toProvider: tool.schema
					.string()
					.describe("Target concrete provider-qualified model id."),
				reason: tool.schema.string().optional().describe("Optional fallback reason label."),
				workflowId: tool.schema.string().optional().describe("Optional workflow id."),
				developerModeAcknowledged: tool.schema
					.boolean()
					.describe("Must be explicitly true for this dev-mode planning helper."),
				persistRegatePlanEvidence: tool.schema
					.boolean()
					.optional()
					.describe("Optionally persist fallback_regate_plan evidence when configured."),
			},
			async execute(input) {
				const result = await executeFlowDeskQuickFallbackRunV1({
					config: explicitIdentityConfig,
					request: quickFallbackRequestFrom(input),
				});
				return JSON.stringify(result);
			},
		}),
	};
}

function isLaneHeartbeatWriterEnabled(options?: PluginOptions): boolean {
	const value = options?.[flowdeskLaneHeartbeatWriterOption];
	return value === true || (isRecord(value) && value.enabled === true);
}

function isWorkflowDispatchPlanToolEnabled(options?: PluginOptions): boolean {
	const value = options?.[flowdeskWorkflowDispatchPlanToolOption];
	return value === true || (isRecord(value) && value.enabled === true);
}

function workflowDispatchPlanToolConfigFromOptions(
	options?: PluginOptions,
): FlowDeskWorkflowDispatchPlanToolConfigV1 | undefined {
	const value = options?.[flowdeskWorkflowDispatchPlanToolOption];
	const enabledFromBool = value === true;
	const enabledFromRecord = isRecord(value) && value.enabled === true;
	if (!enabledFromBool && !enabledFromRecord) return undefined;
	const explicitRoot =
		isRecord(value) &&
		typeof value.rootDir === "string" &&
		value.rootDir.trim().length > 0
			? value.rootDir
			: undefined;
	const rootDir = explicitRoot ?? durableStateRootFromOptions(options);
	return rootDir === undefined ? undefined : { rootDir };
}

function workflowDispatchToolConfigFromOptions(input: unknown, options?: PluginOptions): FlowDeskWorkflowDispatchToolConfigV1 | undefined {
	const value = options?.[flowdeskWorkflowDispatchOption];
	if (!isRecord(value) || value.enabled !== true || value.devBetaActualLaneLaunch !== true) return undefined;
	const explicitRoot = typeof value.rootDir === "string" && value.rootDir.trim().length > 0 ? value.rootDir : undefined;
	const rootDir = explicitRoot ?? durableStateRootFromOptions(options);
	if (rootDir === undefined) return undefined;
	const client = isRecord(input) && isManagedDispatchBetaClient(input.client) ? input.client : undefined;
	return client === undefined ? undefined : { rootDir, client };
}

function autoContinueExecutionToolConfigFromOptions(input: unknown, options?: PluginOptions): FlowDeskAutoContinueExecutionToolConfigV1 | undefined {
	const value = options?.[flowdeskAutoContinueExecutionOption];
	if (!isRecord(value) || value.enabled !== true || value.devBetaActualLaneLaunch !== true) return undefined;
	const explicitRoot = typeof value.rootDir === "string" && value.rootDir.trim().length > 0 ? value.rootDir : undefined;
	const rootDir = explicitRoot ?? durableStateRootFromOptions(options);
	if (rootDir === undefined) return undefined;
	const client = isRecord(input) && isManagedDispatchBetaClient(input.client) ? input.client : undefined;
	return client === undefined ? undefined : {
		rootDir,
		client,
		compatibilityGate: {
			autoContinueExecutionEnabled: true,
			devBetaActualLaneLaunch: true,
			evidenceRef: "plugin_option:autoContinueExecution.enabled+devBetaActualLaneLaunch",
		},
	};
}

function controlledWriteApplyConfigFromOptions(
	input: unknown,
	options?: PluginOptions,
): FlowDeskControlledWriteApplyToolConfigV1 | undefined {
	const value = options?.[flowdeskControlledWriteApplyOption];
	if (!isRecord(value) || value.enabled !== true || value.devBetaControlledWriteApply !== true)
		return undefined;
	const explicitRoot =
		typeof value.rootDir === "string" && value.rootDir.trim().length > 0
			? value.rootDir
			: undefined;
	const durableStateRoot = explicitRoot ?? durableStateRootFromOptions(options);
	if (durableStateRoot === undefined) return undefined;
	const optionWorkspaceRoot =
		typeof value.workspaceRoot === "string" && value.workspaceRoot.trim().length > 0
			? value.workspaceRoot
			: undefined;
	const inputWorkspaceRoot =
		isRecord(input) && typeof input.workspace === "string" && input.workspace.trim().length > 0
			? input.workspace
			: isRecord(input) && typeof input.directory === "string" && input.directory.trim().length > 0
				? input.directory
				: undefined;
	const workspaceRoot = optionWorkspaceRoot ?? inputWorkspaceRoot ?? process.cwd();
	return { durableStateRoot, workspaceRoot };
}

export const flowdeskOrchestrateToolName = "flowdesk_orchestrate" as const;
export const flowdeskOrchestrateOption = "workflowOrchestrate" as const;

interface FlowDeskOrchestrateToolConfigV1 {
	rootDir: string;
	client: FlowDeskManagedDispatchBetaOpenCodeClientV1;
}

function orchestrateToolConfigFromOptions(input: unknown, options?: PluginOptions): FlowDeskOrchestrateToolConfigV1 | undefined {
	const value = options?.[flowdeskOrchestrateOption];
	if (!isRecord(value) || value.enabled !== true || value.devBetaActualLaneLaunch !== true) return undefined;
	const explicitRoot = typeof value.rootDir === "string" && value.rootDir.trim().length > 0 ? value.rootDir : undefined;
	const rootDir = explicitRoot ?? durableStateRootFromOptions(options);
	if (rootDir === undefined) return undefined;
	const client = isRecord(input) && isManagedDispatchBetaClient(input.client) ? input.client : undefined;
	return client === undefined ? undefined : { rootDir, client };
}

function createFlowDeskOrchestrateOptInTools(
	config: FlowDeskOrchestrateToolConfigV1,
): Record<string, FlowDeskOpenCodeTool> {
	return {
		[flowdeskOrchestrateToolName]: tool({
			description: [
				"Run a full FlowDesk multi-task orchestration: Author → Assign → Schedule → Synthesize.",
				"WHEN TO USE: the user gives a natural-language goal that requires decomposing into multiple tasks, assigning agents/models based on provider usage, executing them in dependency order, and aggregating results.",
				"INVOKE WITH: goalSummary (clear bounded goal text), parentSessionId, and optional workflowId.",
				"AFTER CALLING: surface summaryForUser and report synthesisId, taskCount, conflictDetected. All authority flags remain false.",
				"WHEN NOT TO USE: simple single-task requests, status checks, usage queries, or review fan-out.",
			].join(" "),
			args: {
				goalSummary: tool.schema.string().describe("Bounded natural-language goal for the workflow. Max 500 chars."),
				parentSessionId: tool.schema.string().describe("Current OpenCode session id (ses-...)."),
				workflowId: tool.schema.string().optional().describe("Optional stable workflow id. Auto-generated when omitted."),
				providerQualifiedModelId: tool.schema.string().optional().describe("Concrete provider/model id for author and synthesis calls. Defaults to openai/gpt-5.5."),
				agentName: tool.schema.string().optional().describe("Agent name for author and synthesis calls. Defaults to reviewer-gpt-frontier."),
				developerModeAcknowledged: tool.schema.boolean().describe("Must be true to allow provider calls."),
				allowProviderCall: tool.schema.boolean().describe("Must be true to allow provider calls."),
				allowActualLaneLaunch: tool.schema.boolean().describe("Must be true to allow actual task launch."),
			},
			async execute(input) {
				if (!isRecord(input)) return JSON.stringify({ status: "blocked_before_orchestration", summaryForUser: "invalid input", safeNextActions: ["/flowdesk-doctor"] });
				if (input.developerModeAcknowledged !== true || input.allowProviderCall !== true || input.allowActualLaneLaunch !== true)
					return JSON.stringify({ status: "blocked_before_orchestration", summaryForUser: "developerModeAcknowledged, allowProviderCall, and allowActualLaneLaunch must all be true", safeNextActions: ["/flowdesk-doctor"] });
				const goalSummary = typeof input.goalSummary === "string" ? input.goalSummary.slice(0, 500) : "";
				if (!goalSummary.trim()) return JSON.stringify({ status: "blocked_before_orchestration", summaryForUser: "goalSummary is required", safeNextActions: ["/flowdesk-doctor"] });
				const parentSessionId = typeof input.parentSessionId === "string" ? input.parentSessionId : "";
				if (!parentSessionId.trim()) return JSON.stringify({ status: "blocked_before_orchestration", summaryForUser: "parentSessionId is required", safeNextActions: ["/flowdesk-doctor"] });
				const requestedModelId = typeof input.providerQualifiedModelId === "string" ? input.providerQualifiedModelId : "openai/gpt-5.5";
				// Selection-phase pre-launch preferred-model substitution
				// (no dispatch/fallback/Guard authority; not managed fallback/reselection).
				const resolved = resolveUsageAwareModelForServer(config.rootDir, requestedModelId);
				const providerQualifiedModelId = resolved.resolvedModelId;
				const agentName = typeof input.agentName === "string" ? input.agentName : "reviewer-gpt-frontier";
				const workflowId = typeof input.workflowId === "string" ? input.workflowId : undefined;
				const result = await executeFlowDeskWorkflowOrchestratorV1({
					workflowId,
					goalSummary,
					parentSessionId,
					rootDir: config.rootDir,
					client: config.client,
					providerQualifiedModelId,
					agentName,
				});
				const resultRecord = isRecord(result) ? result : {};
				return JSON.stringify({
					...resultRecord,
					requestedModel: requestedModelId,
					effectiveModel: providerQualifiedModelId,
					modelOverrideApplied: resolved.overrideApplied,
					providerBindingChangedBeforeLaunch: resolved.providerBindingChangedBeforeLaunch,
					preLaunchModelSubstitution: resolved.preLaunchModelSubstitution,
					modelSubstitutionKind: resolved.modelSubstitutionKind,
					...(resolved.overrideReason === undefined ? {} : { modelOverrideReason: resolved.overrideReason }),
				});
			},
		}),
	};
}

export function createFlowDeskWorkflowDispatchPlanOptInTools(
	config: FlowDeskWorkflowDispatchPlanToolConfigV1,
): Record<string, FlowDeskOpenCodeTool> {
	return {
		[flowdeskWorkflowDispatchPlanToolName]: tool({
			description: [
				"Build and persist a FlowDesk planning-only workflow dispatch plan using flowdesk.workflow_dispatch_plan.v1 evidence. This optional tool never opens dispatch authority, never calls providers, never executes runtime work, never launches lanes, and never performs fallback or reselection.",
				"WHEN TO USE: the user explicitly asks to plan a multi-role or multi-task FlowDesk workflow and durable planning evidence is useful before any later guarded command-backed step.",
				"WHEN NOT TO USE: ordinary chat, provider usage questions, status checks, code review fan-out, fallback/retry requests, or any request to actually dispatch, run, launch, execute, switch providers, or call a model.",
				"INVOKE WITH: optional workflowId, goalSummary, optional selectedAgentRoles, and tasks[] with agentRole plus summary/title labels. The configured server durable state root is used; do not pass user filesystem paths.",
				"AFTER CALLING: surface summaryForUser and safeNextActions. On blocked_before_workflow_dispatch_plan, report redactedBlockReason. Never claim dispatch/provider/runtime/lane/fallback authority.",
			].join(" "),
			args: {
				workflowId: tool.schema
					.string()
					.optional()
					.describe(
						"Optional workflow id to bind the durable planning evidence to. Auto-generated when omitted.",
					),
				goalSummary: tool.schema
					.string()
					.describe("Bounded redacted summary of the workflow planning goal."),
				selectedAgentRoles: tool.schema
					.array(tool.schema.string())
					.optional()
					.describe(
						"Optional FlowDesk role categories to include in the planning evidence.",
					),
				tasks: tool.schema
					.array(
						tool.schema.object({
							agentRole: tool.schema.string(),
							title: tool.schema.string().optional(),
							summary: tool.schema.string(),
							agentRoleRef: tool.schema.string().optional(),
							dependsOnTaskIds: tool.schema.array(tool.schema.string()).optional(),
						}),
					)
					.describe(
						"One or more planning-only task labels with agentRole and summary. No raw prompts or provider payloads.",
					),
			},
			async execute(input) {
				const result = executeFlowDeskWorkflowDispatchPlanToolV1({
					config,
					rawInput: input,
				});
				return JSON.stringify(result);
			},
		}),
	};
}

export function createFlowDeskAutoContinuePreviewOptInTools(
	config: FlowDeskAutoContinuePreviewToolConfigV1,
): Record<string, FlowDeskOpenCodeTool> {
	const executePreview = (input: Record<string, unknown>) => {
		const result = executeFlowDeskAutoContinuePreviewToolV1({
			config,
			request: {
				workflowId: typeof input.workflowId === "string" ? input.workflowId : undefined,
				maxSteps: typeof input.maxSteps === "number" ? input.maxSteps : undefined,
			},
		});
		return JSON.stringify(result);
	};
	return {
		[flowdeskAutoContinuePreviewToolName]: tool({
			description: [
				"Preview the next pending task from durable FlowDesk workflow_dispatch_plan evidence without executing it.",
				"WHEN TO USE: the user asks whether FlowDesk can continue remaining planned work or asks what would run next from a durable plan.",
				"WHEN NOT TO USE: requests to actually dispatch, call a provider, launch a lane, fallback/reselect, mutate TUI/chat, or write files. This tool is preview-only and never performs continuation.",
				"INVOKE WITH: workflowId and optional maxSteps. The configured durable state root is used. Todo source is durable workflow_dispatch_plan evidence only, not transient chat/todowrite state.",
				"AFTER CALLING: surface summaryForUser, nextTaskId/title/summary, pendingTaskCount, and authority. Never claim automatic execution, dispatch, provider call, fallback, hard chat, or TUI action authority.",
			].join(" "),
			args: {
				workflowId: tool.schema.string().describe("Workflow id with durable workflow_dispatch_plan evidence."),
				maxSteps: tool.schema.number().optional().describe("Bounded preview cap. Clamped to 1..5; no steps are executed."),
			},
			async execute(input) {
				return executePreview(input);
			},
		}),
		[flowdeskNextToolName]: tool({
			description:
				"Preview the next pending durable FlowDesk plan task. Preview only: no provider, runtime, lane, fallback, write, or dispatch authority.",
			args: {
				workflowId: tool.schema.string().describe("Workflow id with durable workflow_dispatch_plan evidence."),
				maxSteps: tool.schema.number().optional().describe("Preview cap, clamped to 1..5."),
			},
			async execute(input) {
				return executePreview(input);
			},
		}),
	};
}

export function createFlowDeskAutoContinueExecutionOptInTools(
	config: FlowDeskAutoContinueExecutionToolConfigV1,
): Record<string, FlowDeskOpenCodeTool> {
	const executeAutoContinue = async (input: unknown, defaults?: { parentSessionId?: string }) => {
		const record: Record<string, unknown> = isRecord(input) ? input : {};
		const task = isRecord(record.task) ? record.task : undefined;
		const parentSessionId = parentSessionIdWithCompletionWakeFallback(
			typeof record.parentSessionId === "string"
				? record.parentSessionId
				: defaults?.parentSessionId,
		);
		// Selection-phase pre-launch preferred-model substitution on
		// task.providerQualifiedModelId (no dispatch/fallback/Guard authority;
		// not managed fallback/reselection).
		const requestedTaskModelId =
			task !== undefined && typeof task.providerQualifiedModelId === "string"
				? task.providerQualifiedModelId
				: undefined;
		const resolved =
			requestedTaskModelId === undefined
				? undefined
				: resolveUsageAwareModelForServer(config.rootDir, requestedTaskModelId);
		const effectiveTaskModelId =
			resolved === undefined ? requestedTaskModelId : resolved.resolvedModelId;
		const request: FlowDeskAutoContinueExecutionToolRequestV1 = {
			...(typeof record.workflowId === "string" ? { workflowId: record.workflowId } : {}),
			...(parentSessionId === undefined ? {} : { parentSessionId }),
			...(task === undefined ? {} : {
				task: {
					...(typeof task.taskId === "string" ? { taskId: task.taskId } : {}),
					...(typeof task.promptText === "string" ? { promptText: task.promptText } : {}),
					...(typeof task.agentName === "string" ? { agentName: task.agentName } : {}),
					...(effectiveTaskModelId === undefined ? {} : { providerQualifiedModelId: effectiveTaskModelId }),
					...(typeof task.outputContractRef === "string" ? { outputContractRef: task.outputContractRef } : {}),
				},
			}),
			...(record.developerModeAcknowledged === true ? { developerModeAcknowledged: true } : {}),
			...(record.allowProviderCall === true ? { allowProviderCall: true } : {}),
			...(record.allowActualLaneLaunch === true ? { allowActualLaneLaunch: true } : {}),
			...(record.allowAutoContinueExecution === true ? { allowAutoContinueExecution: true } : {}),
		};
		// Rewrite rawInput so downstream forbidden-authority checks see the
		// resolved id rather than the original.
		const rewrittenRawInput =
			resolved === undefined || task === undefined
				? input
				: { ...record, task: { ...task, providerQualifiedModelId: resolved.resolvedModelId } };
		const result = await executeFlowDeskAutoContinueExecutionToolV1({ config, request, rawInput: rewrittenRawInput });
		const resultRecord = isRecord(result) ? result : {};
		return JSON.stringify({
			...resultRecord,
			...(resolved === undefined
				? {}
				: {
						requestedModel: requestedTaskModelId,
						effectiveModel: resolved.resolvedModelId,
						modelOverrideApplied: resolved.overrideApplied,
						providerBindingChangedBeforeLaunch: resolved.providerBindingChangedBeforeLaunch,
						preLaunchModelSubstitution: resolved.preLaunchModelSubstitution,
						modelSubstitutionKind: resolved.modelSubstitutionKind,
						...(resolved.overrideReason === undefined
							? {}
							: { modelOverrideReason: resolved.overrideReason }),
					}),
		});
	};
	return {
		[flowdeskAutoContinueExecutionToolName]: tool({
			description: [
				"Execute exactly one explicit opt-in auto-continue step by reloading durable FlowDesk workflow_dispatch_plan evidence, selecting the first pending durable plan task, and requiring the executable payload taskId to match it.",
				"WHEN TO USE: only when the user explicitly asks to continue one pending durable FlowDesk plan task and acknowledges this makes a provider/runtime call and actual task launch in dev mode.",
				"WHEN NOT TO USE: preview-only requests, default Release 1 workflows, fallback/reselection/provider switching, controlled write/apply, ordinary chat, status, usage, or multi-step automatic execution.",
				"INVOKE WITH: workflowId, parentSessionId, one task payload with taskId, promptText, agentName, providerQualifiedModelId, optional outputContractRef=contract-task-result-v1, and developerModeAcknowledged=true, allowProviderCall=true, allowActualLaneLaunch=true, allowAutoContinueExecution=true.",
				"AFTER CALLING: surface summaryForUser, ids, pending/completed counts, safeNextActions, and authority. Never claim default dispatch authority, fallback authority, write authority, hard chat cancellation, or multi-step continuation.",
			].join(" "),
			args: {
				workflowId: tool.schema.string().describe("Workflow id with durable workflow_dispatch_plan evidence."),
				parentSessionId: tool.schema.string().describe("Existing OpenCode parent session id. Required; no unrelated silent parent session is created."),
				task: tool.schema.object({
					taskId: tool.schema.string().describe("Must match the first pending task id from durable workflow_dispatch_plan evidence."),
					promptText: tool.schema.string().describe("Explicit bounded prompt text for this one launched lane."),
					agentName: tool.schema.string().describe("OpenCode agent name or agent-* ref for the lane."),
					providerQualifiedModelId: tool.schema.string().describe("Concrete provider/model id such as openai/gpt-5.5."),
					outputContractRef: tool.schema.string().optional().describe("Optional; only contract-task-result-v1 is supported in this pass."),
				}),
				developerModeAcknowledged: tool.schema.boolean().describe("Must be true to acknowledge dev-mode beta task launch."),
				allowProviderCall: tool.schema.boolean().describe("Must be true to allow the provider call for this one lane."),
				allowActualLaneLaunch: tool.schema.boolean().describe("Must be true to allow actual one-lane runtime launch."),
				allowAutoContinueExecution: tool.schema.boolean().describe("Must be true to opt into this single auto-continue execution step."),
			},
			async execute(input) {
				return executeAutoContinue(input);
			},
		}),
		[flowdeskContinueToolName]: tool({
			description:
				"Compact dev/beta auto-continue launcher for one durable planned task. Requires explicit consent booleans; defaults omitted parentSessionId to ''.",
			args: {
				workflowId: tool.schema.string().describe("Workflow id with durable workflow_dispatch_plan evidence."),
				parentSessionId: tool.schema.string().optional().describe("Optional parent session id; omitted defaults to ''."),
				task: tool.schema.object({
					taskId: tool.schema.string().describe("Must match the first pending planned task id."),
					promptText: tool.schema.string().describe("Explicit bounded prompt text for this one lane."),
					agentName: tool.schema.string().describe("OpenCode agent name or agent-* ref for the lane."),
					providerQualifiedModelId: tool.schema.string().describe("Concrete provider/model id such as openai/gpt-5.5."),
					outputContractRef: tool.schema.string().optional().describe("Optional; only contract-task-result-v1 is supported."),
				}),
				developerModeAcknowledged: tool.schema.boolean(),
				allowProviderCall: tool.schema.boolean(),
				allowActualLaneLaunch: tool.schema.boolean(),
				allowAutoContinueExecution: tool.schema.boolean(),
			},
			async execute(input) {
				return executeAutoContinue(input, { parentSessionId: "" });
			},
		}),
	};
}

export function createFlowDeskWorkflowDispatchOptInTools(
	config: FlowDeskWorkflowDispatchToolConfigV1,
): Record<string, FlowDeskOpenCodeTool> {
	return {
		[flowdeskWorkflowDispatchToolName]: tool({
			description: [
				"Run one explicit dev-mode FlowDesk workflow task through the injected OpenCode SDK client. This optional beta tool is disabled by default and requires workflowDispatch.enabled=true plus workflowDispatch.devBetaActualLaneLaunch=true, durableStateRoot, developerModeAcknowledged=true, allowProviderCall=true, and allowActualLaneLaunch=true. It persists non-authorizing workflow_dispatch_plan evidence, launches exactly one lane through executeFlowDeskAgentTaskV1, and verifies terminal task evidence.",
				"WHEN TO USE: only when the user explicitly asks for dev-mode actual one-task workflow dispatch and understands this makes a provider/runtime call.",
				"WHEN NOT TO USE: default Release 1 workflows, planning-only requests, fallback/reselection, provider switching, controlled write/apply, ordinary chat, status, usage, or review fan-out.",
				"INVOKE WITH: optional workflowId, goalSummary, parentSessionId, one task with agentRole, summary, promptText, agentName, providerQualifiedModelId, optional outputContractRef=contract-task-result-v1, and the three explicit allow flags. Do not pass raw transcripts, provider payloads, write/apply instructions, fallback wording, or filesystem paths.",
				"AFTER CALLING: surface summaryForUser, ids, safeNextActions, and authority. Never claim default dispatch authority, write authority, fallback authority, hard chat cancellation, or default Release 1 dispatch enablement.",
			].join(" "),
			args: {
				workflowId: tool.schema.string().optional().describe("Optional workflow id. Auto-generated when omitted."),
				goalSummary: tool.schema.string().describe("Bounded redacted summary of the one-task dev-mode workflow goal."),
				parentSessionId: tool.schema.string().describe("Existing OpenCode parent session id. Required; no unrelated silent parent session is created."),
				task: tool.schema.object({
					agentRole: tool.schema.string().describe("FlowDesk role category for the single task."),
					summary: tool.schema.string().describe("Bounded task summary label for evidence."),
					promptText: tool.schema.string().describe("Bounded prompt text for the one launched lane."),
					agentName: tool.schema.string().describe("OpenCode agent name or agent-* ref for the lane."),
					providerQualifiedModelId: tool.schema.string().describe("Concrete provider/model id such as openai/gpt-5.5."),
					outputContractRef: tool.schema.string().optional().describe("Optional; only contract-task-result-v1 is supported in this pass."),
				}),
				developerModeAcknowledged: tool.schema.boolean().describe("Must be true to acknowledge dev-mode beta task launch."),
				allowProviderCall: tool.schema.boolean().describe("Must be true to allow the provider call for this one lane."),
				allowActualLaneLaunch: tool.schema.boolean().describe("Must be true to allow actual one-lane runtime launch."),
			},
			async execute(input) {
				const record: Record<string, unknown> = isRecord(input) ? input : {};
				const parentSessionId = parentSessionIdWithCompletionWakeFallback(
					typeof record.parentSessionId === "string" ? record.parentSessionId : undefined,
				);
				// Selection-phase pre-launch preferred-model substitution on
				// task.providerQualifiedModelId (no dispatch/fallback/Guard authority;
				// not managed fallback/reselection).
				const taskRecord = isRecord(record.task) ? record.task : undefined;
				const requestedTaskModelId =
					taskRecord && typeof taskRecord.providerQualifiedModelId === "string"
						? taskRecord.providerQualifiedModelId
						: undefined;
				const resolved =
					requestedTaskModelId === undefined
						? undefined
						: resolveUsageAwareModelForServer(config.rootDir, requestedTaskModelId);
				const rewrittenTask =
					taskRecord !== undefined && resolved !== undefined
						? { ...taskRecord, providerQualifiedModelId: resolved.resolvedModelId }
						: taskRecord;
				const merged: Record<string, unknown> = { ...record };
				if (parentSessionId !== undefined) merged.parentSessionId = parentSessionId;
				if (rewrittenTask !== undefined) merged.task = rewrittenTask;
				const rawInput =
					parentSessionId === undefined && rewrittenTask === taskRecord
						? input
						: merged;
				const result = await executeFlowDeskWorkflowDispatchToolV1({
					config,
					rawInput,
				});
				const resultRecord = isRecord(result) ? result : {};
				return JSON.stringify({
					...resultRecord,
					...(resolved === undefined
						? {}
						: {
								requestedModel: requestedTaskModelId,
								effectiveModel: resolved.resolvedModelId,
								modelOverrideApplied: resolved.overrideApplied,
								providerBindingChangedBeforeLaunch: resolved.providerBindingChangedBeforeLaunch,
								preLaunchModelSubstitution: resolved.preLaunchModelSubstitution,
								modelSubstitutionKind: resolved.modelSubstitutionKind,
								...(resolved.overrideReason === undefined
									? {}
									: { modelOverrideReason: resolved.overrideReason }),
							}),
				});
			},
		}),
	};
}

export function createFlowDeskControlledWriteApplyOptInTools(
	config: FlowDeskControlledWriteApplyToolConfigV1,
): Record<string, FlowDeskOpenCodeTool> {
	const executeControlledWrite = (input: unknown, defaults?: { reasonSummary?: string }) => {
		const rawInput =
			defaults?.reasonSummary === undefined || !isRecord(input) || typeof input.reasonSummary === "string"
				? input
				: { ...input, reasonSummary: defaults.reasonSummary };
		const result = executeFlowDeskControlledWriteApplyToolV1({
			config,
			rawInput,
		});
		return JSON.stringify(result);
	};
	return {
		[flowdeskControlledWriteApplyToolName]: tool({
			description: [
				"Apply one complete-file replacement through the FlowDesk dev/beta controlled write path. This optional tool is disabled by default and requires controlledWriteApply.enabled=true plus controlledWriteApply.devBetaControlledWriteApply=true, durableStateRoot, developerModeAcknowledged=true, userApprovalRef, allowControlledWrite=true, and a workspace-relative target path.",
				"WHEN TO USE: only when the user explicitly approves a bounded local workspace file replacement in dev mode and the current file hash is known or the caller explicitly sets allowMissingExpectedHashForDevMode=true.",
				"WHEN NOT TO USE: default Release 1 workflows, model-generated automatic apply, provider/runtime dispatch, fallback/reselection, remote writes, shell execution, absolute paths, path traversal, symlink targets, binary content, or hidden injection.",
				"INVOKE WITH: workflowId, targetFilePath relative to the workspace root, expectedSha256 or expectedContentSha256 when available, replacementText, reasonSummary, developerModeAcknowledged=true, bounded userApprovalRef, and allowControlledWrite=true. Never pass raw transcripts, prompts, provider payloads, secrets, absolute paths, or shell output.",
				"AFTER CALLING: surface summaryForUser, targetFilePath, ledgerEntryId, hashes, safeNextActions, and authority. Never claim default Release 1 write authority, dispatch authority, provider calls, runtime execution, fallback authority, or hard chat cancellation.",
			].join(" "),
			args: {
				workflowId: tool.schema.string().describe("Stable FlowDesk workflow id for durable ledger evidence."),
				targetFilePath: tool.schema.string().describe("Workspace-relative target file path only. Absolute paths and traversal are rejected."),
				expectedSha256: tool.schema.string().optional().describe("Optional sha256-<hex> hash of the current target file content."),
				expectedContentSha256: tool.schema.string().optional().describe("Optional sha256-<hex> hash alias for the current target file content."),
				allowMissingExpectedHashForDevMode: tool.schema.boolean().optional().describe("Must be true to proceed without an expected current-content hash."),
				replacementText: tool.schema.string().describe("Complete replacement file text, bounded and non-binary."),
				reasonSummary: tool.schema.string().describe("Bounded redacted reason for the controlled write."),
				developerModeAcknowledged: tool.schema.boolean().describe("Must be true to acknowledge dev/beta controlled write authority."),
				userApprovalRef: tool.schema.string().describe("Bounded opaque user approval reference for this write."),
				allowControlledWrite: tool.schema.boolean().describe("Must be true to permit this one controlled local write."),
			},
			async execute(input) {
				return executeControlledWrite(input);
			},
		}),
		[flowdeskWriteToolName]: tool({
			description:
				"Compact dev/beta controlled workspace file replacement. Requires explicit write consent fields; preserves path/hash checks. No dispatch, provider, runtime, lane, fallback, hard-chat, or SDK-scoped noReply control.",
			args: {
				workflowId: tool.schema.string().describe("Stable FlowDesk workflow id for durable ledger evidence."),
				targetFilePath: tool.schema.string().describe("Workspace-relative target file path only. Absolute paths and traversal are rejected."),
				expectedSha256: tool.schema.string().optional().describe("Optional sha256-<hex> hash of the current target file content."),
				expectedContentSha256: tool.schema.string().optional().describe("Optional sha256-<hex> hash alias for the current target file content."),
				allowMissingExpectedHashForDevMode: tool.schema.boolean().optional().describe("Must be true to proceed without an expected current-content hash."),
				replacementText: tool.schema.string().describe("Complete replacement file text, bounded and non-binary."),
				reasonSummary: tool.schema.string().optional().describe("Optional bounded redacted reason; omitted uses generic controlled-write wording."),
				developerModeAcknowledged: tool.schema.boolean().describe("Must be true to acknowledge dev/beta controlled write authority."),
				userApprovalRef: tool.schema.string().describe("Bounded opaque user approval reference for this write."),
				allowControlledWrite: tool.schema.boolean().describe("Must be true to permit this one controlled local write."),
			},
			async execute(input) {
				return executeControlledWrite(input, {
					reasonSummary: "flowdesk_write controlled replacement",
				});
			},
		}),
	};
}

function isAgentTaskRunEnabled(options?: PluginOptions): boolean {
	const value = (options as Record<string, unknown> | undefined)?.[flowdeskAgentTaskRunOption];
	return value === true || (isRecord(value) && value.enabled === true);
}

export interface FlowDeskLaneHeartbeatWriterConfigV1 {
	rootDir: string;
	defaultExpectedIntervalMs?: number;
}

function laneHeartbeatWriterConfigFromOptions(
	options?: PluginOptions,
): FlowDeskLaneHeartbeatWriterConfigV1 | undefined {
	const value = options?.[flowdeskLaneHeartbeatWriterOption];
	const enabledFromBool = value === true;
	const enabledFromRecord = isRecord(value) && value.enabled === true;
	if (!enabledFromBool && !enabledFromRecord) return undefined;
	const explicitRoot =
		isRecord(value) &&
		typeof value.rootDir === "string" &&
		value.rootDir.trim().length > 0
			? value.rootDir
			: undefined;
	const root = explicitRoot ?? durableStateRootFromOptions(options);
	if (root === undefined) return undefined;
	const config: FlowDeskLaneHeartbeatWriterConfigV1 = { rootDir: root };
	if (
		isRecord(value) &&
		typeof value.defaultExpectedIntervalMs === "number" &&
		value.defaultExpectedIntervalMs > 0
	)
		config.defaultExpectedIntervalMs = Math.floor(
			value.defaultExpectedIntervalMs,
		);
	return config;
}

export function createFlowDeskLaneHeartbeatWriterOptInTools(
	config: FlowDeskLaneHeartbeatWriterConfigV1,
): Record<string, FlowDeskOpenCodeTool> {
	const args = createFlowDeskLaneHeartbeatWriterToolArgs();
	return {
		[flowdeskLaneHeartbeatWriterToolName]: tool({
			description: [
				"Record a durable FlowDesk lane heartbeat for a FlowDesk-owned task lane (reviewer lane, runtime task launch, provider acquisition lane, managed-dispatch attempt, fallback regate plan). Each call produces one validated flowdesk.lane_heartbeat.v1 record with a monotonically increasing heartbeat_seq per lane id, persisted as durable session evidence. Heartbeats are diagnostic evidence only and never approve dispatch, widen scope, or replace Guard. Default soft heartbeat interval is about 2 minutes; the 5-minute stall threshold lives in the stall projection.",
				"WHEN TO USE: a FlowDesk coordinator that owns the lane needs to prove it is still active during a long-running step. Trigger when the assistant is coordinating a FlowDesk lane and the previous heartbeat or lifecycle update was emitted close to the soft heartbeat interval (about 2 minutes by default), OR when the user explicitly asks to record/refresh a heartbeat. Also trigger on English phrases such as 'heartbeat', 'record heartbeat', 'emit heartbeat', 'mark progress', 'I'm still alive', 'lane is still progressing', 'heartbeat for the lane', and Korean phrases such as '하트비트 남겨줘', '하트비트 기록해줘', '심박 남겨줘', '심장박동 기록', '레인 살아 있다고 표시', '진행 신호 남겨줘', '진행 표시 해줘', '아직 살아 있다고 알려줘'.",
				"WHEN NOT TO USE: lifecycle transitions to terminal states (use lane_lifecycle materializers), reviewer verdict observations, provider-call evidence, dispatch authority changes, arbitrary OpenCode user-driven tool calls that FlowDesk did not launch, or any case where you do not have a stable FlowDesk lane id and parent session id.",
				"INVOKE WITH: workflowId, attemptId, laneId, parentSessionRef (must start with 'ses-'), agentRef (must start with 'agent-'), providerQualifiedModelId (concrete provider/model id), state (one of 'created', 'running', 'awaiting_dependency', 'cooldown'), and optional progressSummaryLabel (<=120 chars and redaction-safe), progressRef (starts with 'progress-' or 'heartbeat-progress-'), expectedIntervalMs, heartbeatSeq, observedAt. When heartbeatSeq is omitted the writer derives it from the latest heartbeat for the lane id. The plugin user already opted into this tool at configuration time, so do not ask the user for extra confirmation; just call.",
				"AFTER CALLING: confirm status=lane_heartbeat_recorded with the heartbeat_seq, observed_at, and expected_next_heartbeat_at. On status=blocked_before_lane_heartbeat surface the redactedBlockReason and suggest /flowdesk-status or /flowdesk-doctor. Never echo raw prompts, transcripts, provider payloads, runtime echo, or any other forbidden raw markers.",
			].join(" "),
			args,
			async execute(input) {
				return executeFlowDeskLaneHeartbeatWriterToolV1(config, input);
			},
		}),
		[flowdeskBeatToolName]: tool({
			description:
				"Record a diagnostic FlowDesk lane heartbeat as durable evidence. Does not grant dispatch, provider, runtime, lane-launch, fallback, write, hard-cancel, or SDK-scoped noReply control.",
			args,
			async execute(input) {
				return executeFlowDeskLaneHeartbeatWriterToolV1(config, input);
			},
		}),
	};
}

function createFlowDeskLaneHeartbeatWriterToolArgs(): FlowDeskOpenCodeToolArgs {
	return {
		workflowId: tool.schema
			.string()
			.describe("Stable opaque FlowDesk workflow id bound to this lane."),
		attemptId: tool.schema
			.string()
			.describe("Stable opaque attempt id bound to this lane."),
		laneId: tool.schema
			.string()
			.describe(
				"Stable opaque FlowDesk lane id (e.g. 'lane-quick-policy_security-...').",
			),
		parentSessionRef: tool.schema
			.string()
			.describe("Opaque ses-* ref for the parent session that owns this lane."),
		agentRef: tool.schema
			.string()
			.describe("Opaque agent-* ref for the FlowDesk agent profile."),
		providerQualifiedModelId: tool.schema
			.string()
			.describe(
				"Concrete provider-qualified model id (e.g. 'openai/gpt-5.4-mini-fast').",
			),
		state: tool.schema
			.enum(["created", "running", "awaiting_dependency", "cooldown"])
			.describe("Active lane state at heartbeat time."),
		progressSummaryLabel: tool.schema
			.string()
			.optional()
			.describe(
				"Bounded redacted progress label (<=120 chars). No raw prompts, tool args, or transcripts.",
			),
		progressRef: tool.schema
			.string()
			.optional()
			.describe(
				"Opaque progress reference starting with 'progress-' or 'heartbeat-progress-'.",
			),
		expectedIntervalMs: tool.schema
			.number()
			.optional()
			.describe(
				"Override for expected next heartbeat interval in milliseconds; clamped to >=10s and <=24h.",
			),
		heartbeatSeq: tool.schema
			.number()
			.optional()
			.describe(
				"Optional explicit heartbeat sequence. When omitted, the writer increments from the latest persisted heartbeat for this lane id.",
			),
		observedAt: tool.schema
			.string()
			.optional()
			.describe("ISO timestamp; defaults to now."),
	};
}

export function executeFlowDeskLaneHeartbeatWriterToolV1(
	config: FlowDeskLaneHeartbeatWriterConfigV1,
	input: unknown,
): string {
	const record: Record<string, unknown> = isRecord(input) ? input : {};
	const request: FlowDeskLaneHeartbeatWriteRequestV1 = {
		rootDir: config.rootDir,
		workflowId: typeof record.workflowId === "string" ? record.workflowId : "",
		attemptId: typeof record.attemptId === "string" ? record.attemptId : "",
		laneId: typeof record.laneId === "string" ? record.laneId : "",
		parentSessionRef:
			typeof record.parentSessionRef === "string"
				? record.parentSessionRef
				: "",
		agentRef: typeof record.agentRef === "string" ? record.agentRef : "",
		providerQualifiedModelId:
			typeof record.providerQualifiedModelId === "string"
				? record.providerQualifiedModelId
				: "",
		state:
			record.state === "created" ||
			record.state === "running" ||
			record.state === "awaiting_dependency" ||
			record.state === "cooldown"
				? record.state
				: "running",
		...(typeof record.progressSummaryLabel === "string"
			? { progressSummaryLabel: record.progressSummaryLabel }
			: {}),
		...(typeof record.progressRef === "string"
			? { progressRef: record.progressRef }
			: {}),
		...(typeof record.expectedIntervalMs === "number"
			? { expectedIntervalMs: record.expectedIntervalMs }
			: config.defaultExpectedIntervalMs === undefined
				? {}
				: { expectedIntervalMs: config.defaultExpectedIntervalMs }),
		...(typeof record.heartbeatSeq === "number"
			? { heartbeatSeq: record.heartbeatSeq }
			: {}),
		...(typeof record.observedAt === "string"
			? { observedAt: record.observedAt }
			: {}),
	};
	const result = recordFlowDeskLaneHeartbeatV1(request);
	return JSON.stringify(result);
}

function isStatusLiveEnabled(options?: PluginOptions): boolean {
	const value = options?.[flowdeskStatusLiveOption];
	return value === true || (isRecord(value) && value.enabled === true);
}

function statusLiveConfigFromOptions(
	options?: PluginOptions,
): FlowDeskStatusLiveConfigV1 | undefined {
	const value = options?.[flowdeskStatusLiveOption];
	if (!isRecord(value) || value.enabled !== true) return undefined;
	const explicitRoot =
		typeof value.rootDir === "string" && value.rootDir.trim().length > 0
			? value.rootDir
			: undefined;
	const fallbackRoot = durableStateRootFromOptions(options);
	const rootDir = explicitRoot ?? fallbackRoot;
	if (rootDir === undefined) return undefined;
	const config: FlowDeskStatusLiveConfigV1 = { rootDir };
	if (typeof value.maxWorkflows === "number" && value.maxWorkflows > 0)
		config.maxWorkflows = Math.floor(value.maxWorkflows);
	if (
		typeof value.maxRecentEvidencePerClass === "number" &&
		value.maxRecentEvidencePerClass > 0
	)
		config.maxRecentEvidencePerClass = Math.floor(
			value.maxRecentEvidencePerClass,
		);
	if (
		typeof value.laneHeartbeatLateThresholdMs === "number" &&
		value.laneHeartbeatLateThresholdMs > 0
	)
		config.laneHeartbeatLateThresholdMs = Math.floor(
			value.laneHeartbeatLateThresholdMs,
		);
	if (
		typeof value.laneHeartbeatStallThresholdMs === "number" &&
		value.laneHeartbeatStallThresholdMs > 0
	)
		config.laneHeartbeatStallThresholdMs = Math.floor(
			value.laneHeartbeatStallThresholdMs,
		);
	return config;
}

const flowdeskResultReadOnlyAuthority = {
	statusEvidenceObserved: true,
	providerCall: false,
	runtimeExecution: false,
	actualLaneLaunch: false,
	realOpenCodeDispatch: false,
	dispatchAuthorityEnabled: false,
	fallbackAuthority: false,
	writeAuthority: false,
	hardCancelOrNoReplyAuthority: false,
} as const;

function taskResultSummary(entry: FlowDeskSessionEvidenceReloadResultV1["entries"][number]) {
	const record = entry.record;
	return {
		evidenceId: entry.evidenceId,
		taskId: typeof record.task_id === "string" ? record.task_id : "",
		laneId: typeof record.lane_id === "string" ? record.lane_id : undefined,
		createdAt: typeof record.created_at === "string" ? record.created_at : undefined,
		completionStatus:
			typeof record.completion_status === "string"
				? record.completion_status
				: undefined,
		outputKind:
			typeof record.output_kind === "string" ? record.output_kind : undefined,
		usableForSynthesis:
			typeof record.usable_for_synthesis === "boolean"
				? record.usable_for_synthesis
				: undefined,
	};
}

export function executeFlowDeskResultToolV1(config: { rootDir: string }, input: unknown): string {
	const record = isRecord(input) ? input : {};
	const workflowId = typeof record.workflowId === "string" ? record.workflowId : "";
	const taskId = typeof record.taskId === "string" ? record.taskId : undefined;
	if (workflowId.trim().length === 0) {
		return JSON.stringify({
			status: "blocked_before_task_result",
			redactedBlockReason: "flowdesk_result requires workflowId.",
			safeNextActions: ["/flowdesk-status"],
			authority: { ...flowdeskResultReadOnlyAuthority, statusEvidenceObserved: false },
		});
	}

	const reload = reloadFlowDeskSessionEvidenceV1({
		rootDir: config.rootDir,
		workflowId,
	});
	if (!reload.ok) {
		return JSON.stringify({
			status: "blocked_before_task_result",
			workflowId,
			redactedBlockReason:
				reload.errors[0] ?? "durable task_result evidence could not be reloaded.",
			safeNextActions: ["/flowdesk-status", "/flowdesk-doctor"],
			authority: { ...flowdeskResultReadOnlyAuthority, statusEvidenceObserved: false },
		});
	}

	const taskResults = reload.entries.filter(
		(entry) =>
			entry.evidenceClass === "task_result" &&
			entry.record.schema_version === "flowdesk.task_result.v1" &&
			typeof entry.record.task_id === "string" &&
			typeof entry.record.result_text === "string",
	);
	const matches =
		taskId === undefined
			? taskResults
			: taskResults.filter((entry) => entry.record.task_id === taskId);
	if (taskId !== undefined && matches.length === 0) {
		return JSON.stringify({
			status: "blocked_before_task_result",
			workflowId,
			taskId,
			redactedBlockReason: "requested task_result was not found for this workflow.",
			availableTaskResults: taskResults.map(taskResultSummary),
			safeNextActions: ["/flowdesk-status"],
			authority: flowdeskResultReadOnlyAuthority,
		});
	}
	if (taskId === undefined && matches.length === 0) {
		return JSON.stringify({
			status: "blocked_before_task_result",
			workflowId,
			redactedBlockReason: "no durable task_result evidence found for this workflow.",
			safeNextActions: ["/flowdesk-status"],
			authority: flowdeskResultReadOnlyAuthority,
		});
	}
	if (taskId === undefined && matches.length > 1) {
		return JSON.stringify({
			status: "task_result_selector",
			workflowId,
			summaryForUser:
				"Multiple task results are available. Call flowdesk_result again with a specific taskId to view the full text.",
			availableTaskResults: matches.map(taskResultSummary),
			safeNextActions: ["/flowdesk-status"],
			authority: flowdeskResultReadOnlyAuthority,
		});
	}

	const selected = matches[0];
	const selectedRecord = selected.record;
	const selectedTaskId = String(selectedRecord.task_id);
	const resultText = String(selectedRecord.result_text);
	return JSON.stringify({
		status: "task_result_collected",
		workflowId,
		taskId: selectedTaskId,
		evidenceId: selected.evidenceId,
		laneId: typeof selectedRecord.lane_id === "string" ? selectedRecord.lane_id : undefined,
		createdAt:
			typeof selectedRecord.created_at === "string"
				? selectedRecord.created_at
				: undefined,
		completionStatus:
			typeof selectedRecord.completion_status === "string"
				? selectedRecord.completion_status
				: undefined,
		outputKind:
			typeof selectedRecord.output_kind === "string"
				? selectedRecord.output_kind
				: undefined,
		usableForSynthesis:
			typeof selectedRecord.usable_for_synthesis === "boolean"
				? selectedRecord.usable_for_synthesis
				: undefined,
		resultText,
		resultTextLength: resultText.length,
		resultTextTruncated:
			typeof selectedRecord.result_text_truncated === "boolean"
				? selectedRecord.result_text_truncated
				: undefined,
		resultTextSha256:
			typeof selectedRecord.result_text_sha256 === "string"
				? selectedRecord.result_text_sha256
				: undefined,
		summaryForUser: `Full task_result text returned for ${selectedTaskId}.`,
		safeNextActions: ["/flowdesk-status"],
		authority: flowdeskResultReadOnlyAuthority,
	});
}

export function createFlowDeskStatusLiveOptInTools(
	config: FlowDeskStatusLiveConfigV1,
): Record<string, FlowDeskOpenCodeTool> {
	const executeStatusLive = async (input: unknown) => {
		const request = isRecord(input)
			? {
					workflowId:
						typeof input.workflowId === "string"
							? input.workflowId
							: undefined,
				}
			: {};
		const result = await executeFlowDeskStatusLiveV1({
			config,
			request,
		});
		return JSON.stringify(result);
	};
	return {
		[flowdeskStatusLiveToolName]: tool({
			description: [
				"Return a live FlowDesk status summary by reloading durable session evidence under the configured FlowDesk state root, including reviewer verdict counts, reviewer fan-out plans, runtime lane lifecycle records, fallback regate plans, exact-model availability cache entries, provider acquisition results, and a lane heartbeat stall projection that classifies each FlowDesk-owned lane as progressing_normal, progressing_late, stalled, terminal, or unknown based on the most recent lifecycle update.",
				"WHEN TO USE: the user asks about recent FlowDesk activity, current workflow progress, recent reviewer results, ongoing or stalled runs, lanes that have stopped logging, lanes that look stuck, or what has been recorded so far. Trigger on English phrases such as 'status', 'what happened', 'recent activity', 'progress', 'where are we', 'how is it going', 'recent reviews', 'recent runs', 'is it stuck', 'stalled', 'no log', 'no update', 'is anything frozen', 'last review', 'just now', 'earlier result', and Korean phrases such as '상태', '어디까지', '진행 상황', '진행됐', '오늘 작업', '오늘 뭐했', '최근 활동', '최근 리뷰', '지금 어디', '상태 요약', '워크플로우 상태', '멈춘 것 같아', '멈췄어', '응답이 없어', '아무 로그도 없', '오래 걸리는', '진행이 안돼', '방금', '직전', '조금 전', '이전', '최근에 한 거', '아까 한 거', '결과 보여줘'.",
				"ALSO PROACTIVELY USE: as a follow-up after invoking a real-work FlowDesk tool (quick_reviewer_run, quick_fallback_run, managed_dispatch). If the user asks a vague follow-up about the just-completed work ('잘 됐어?', 'how did it go?', '결과는?'), call this tool with the just-created workflowId to pull durable evidence instead of guessing from memory.",
				"WHEN NOT TO USE: provider usage/quota questions (use flowdesk_quota), multi-perspective code reviews (use explicit flowdesk_task reviewer lanes), or unrelated general chat.",
				"INVOKE WITH: optional workflowId. When omitted, the tool lists the most recently modified durable workflows (default up to 5). The plugin user already opted in to durable status evidence reload at configuration time, so this tool can be called automatically without per-call confirmation.",
				"AFTER CALLING: read result.summaryForUser and surface that as the headline reply. If latestTaskResultExcerpts is present and the user asks for completed lane results, surface the bounded resultText excerpts with preserved line breaks; do not expand beyond those excerpts. If the user needs more detail, mention reviewer verdict labels (pass / changes_required / blocked / inconclusive), lane lifecycle states (running, complete, invocation_failed), the most recent fallback_regate_plan state, the most recent provider acquisition status, and any stalled or progressing_late lanes reported in worstLaneStallClassification with totalStalledLaneCount and totalProgressingLateLaneCount. Per-lane entries inside laneStallProjection.entries can also carry expectedNextHeartbeatOverdue=true plus secondsPastExpectedNextHeartbeat to indicate that the heartbeat's own expected_next_heartbeat_at has passed, which is a diagnostic hint independent of the configurable stall threshold. If stalled lanes are present, surface the laneStallProjection safe next actions (/flowdesk-status, /flowdesk-retry, /flowdesk-resume, /flowdesk-abort, /flowdesk-doctor, /flowdesk-export-debug) without auto-retrying, auto-aborting, or auto-fallbacking on the user's behalf. If no workflow returned evidence, say so plainly. Never echo raw provider/auth/token payloads.",
			].join(" "),
			args: {
				workflowId: tool.schema
					.string()
					.optional()
					.describe(
						"Optional specific workflow id to summarize. When omitted, the most recently modified durable workflows are summarized.",
					),
			},
			async execute(input) {
				return executeStatusLive(input);
			},
		}),
		[flowdeskNowToolName]: tool({
			description:
				"Use for FlowDesk status, progress, recent results, or stalled lanes. Read-only durable status summary; no dispatch, provider, runtime, fallback, write, or hard-cancel authority.",
			args: {
				workflowId: tool.schema
					.string()
					.optional()
					.describe("Optional workflow id; omit for recent workflow summary."),
			},
			async execute(input) {
				return executeStatusLive(input);
			},
		}),
		[flowdeskResultToolName]: tool({
			description:
				"Return full durable task_result text for one workflow task. Read-only evidence viewer; no provider, dispatch, runtime, lane, write, fallback, hard-chat, or SDK-scoped noReply control.",
			args: {
				workflowId: tool.schema
					.string()
					.describe("Workflow id containing durable task_result evidence."),
				taskId: tool.schema
					.string()
					.optional()
					.describe("Optional task id. Required when the workflow has multiple task_results."),
			},
			async execute(input) {
				return executeFlowDeskResultToolV1({ rootDir: config.rootDir }, input);
			},
		}),
	};
}

export function createFlowDeskWorkflowSynthesisPreviewTools(config: {
	rootDir: string;
}): Record<string, FlowDeskOpenCodeTool> {
	return {
		[flowdeskWorkflowSynthesisPreviewToolName]: tool({
			description: [
				"Build and persist a provider-free FlowDesk synthesis preview from existing task_result evidence. This local tool never calls providers, launches lanes, dispatches runtime work, performs fallback/reselection, writes workspace files, or grants execution authority.",
				"WHEN TO USE: a workflow reports next_action=synthesis_ready and the user asks to summarize, synthesize, continue with the next synthesis step, or see the completed task results without making a model/provider call.",
				"WHEN NOT TO USE: requests for model-authored synthesis, real dispatch, provider calls, write/apply, fallback/retry, or replacing raw task results.",
				"INVOKE WITH: workflowId for a workflow that already has task_result evidence under the configured durable root.",
				"AFTER CALLING: surface summaryForUser, synthesisId, tasksSummarized, conflictDetected, safeNextActions, and authority. If taskResultExcerpts is present, surface the bounded resultText excerpts with preserved line breaks; do not expand beyond those excerpts. State that this is a provider-free preview derived from durable task_result evidence.",
			].join(" "),
			args: {
				workflowId: tool.schema.string().describe("Workflow id with existing task_result evidence to synthesize locally."),
			},
			async execute(input) {
				const workflowId = isRecord(input) && typeof input.workflowId === "string" ? input.workflowId : "";
				const result = executeFlowDeskWorkflowSynthesisPreviewV1({ workflowId, rootDir: config.rootDir });
				return JSON.stringify(result);
			},
		}),
	};
}

function isFlowDeskUiProbeEnabled(options?: PluginOptions): boolean {
	const raw = options?.[flowdeskUiProbeOption];
	return process.env.FLOWDESK_UI_PROBE === "1" || raw === true || (isRecord(raw) && raw.enabled === true);
}

function boundedUiProbeString(value: unknown, maxLength = 160): string | undefined {
	if (typeof value !== "string" || value.length === 0) return undefined;
	return value.length > maxLength ? `${value.slice(0, maxLength - 1)}…` : value;
}

function summarizeFlowDeskUiProbeEventV1(event: unknown, observedAt: string): FlowDeskUiProbeEventObservationV1 {
	const rec = isRecord(event) ? event : {};
	const properties = Object.keys(rec).sort().slice(0, 20);
	const nested = (name: string): Record<string, unknown> | undefined => {
		const value = rec[name];
		return isRecord(value) ? value : undefined;
	};
	const session = nested("session") ?? nested("sessionID") ?? nested("sessionId");
	const message = nested("message");
	const part = nested("part");
	const sessionId =
		boundedUiProbeString(rec.sessionID) ??
		boundedUiProbeString(rec.sessionId) ??
		boundedUiProbeString(session?.id);
	return {
		observedAt,
		eventType: boundedUiProbeString(rec.type, 120) ?? boundedUiProbeString(rec.event, 120) ?? "unknown",
		...(sessionId === undefined ? {} : { sessionId }),
		...(boundedUiProbeString(message?.id) === undefined ? {} : { messageId: boundedUiProbeString(message?.id) }),
		...(boundedUiProbeString(part?.id) === undefined ? {} : { partId: boundedUiProbeString(part?.id) }),
		keys: properties,
	};
}

function createFlowDeskUiProbeTools(
	observations: FlowDeskUiProbeEventObservationV1[],
): Record<string, FlowDeskOpenCodeTool> {
	return {
		[flowdeskUiProbeToolName]: tool({
			description: [
				"Developer-only FlowDesk UI renderer/event probe. Enabled only when FLOWDESK_UI_PROBE=1.",
				"It emits bounded markdown/details/link/code-fence/long-log samples and reports redacted OpenCode event observations captured by the plugin event hook.",
				"No dispatch, provider call, write authority, fallback authority, or hard chat control is granted.",
			].join(" "),
			args: {
				mode: tool.schema
					.string()
					.optional()
					.describe("Probe mode: render, events, or all. Defaults to all."),
				limit: tool.schema
					.number()
					.optional()
					.describe("Maximum recent event observations to return; clamped to 1..50."),
			},
			async execute(input) {
				const mode = isRecord(input) && typeof input.mode === "string" ? input.mode : "all";
				const requestedLimit = isRecord(input) && typeof input.limit === "number" ? Math.floor(input.limit) : 20;
				const limit = Math.max(1, Math.min(50, requestedLimit));
				const includeRender = mode === "all" || mode === "render";
				const includeEvents = mode === "all" || mode === "events";
				const longLog = Array.from({ length: 40 }, (_, index) => {
					const n = String(index + 1).padStart(2, "0");
					return `${n}. ui-probe timeline event ${n}: message/status/log renderer sample`;
				});
				return JSON.stringify({
					schema_version: "flowdesk.ui_probe_result.v1",
					status: "ui_probe_collected",
					probeEnabled: true,
					mode,
					authority: {
						realOpenCodeDispatch: false,
						providerCall: false,
						runtimeExecution: false,
						actualLaneLaunch: false,
						fallbackAuthority: false,
						hardCancelOrNoReplyAuthority: false,
					},
					...(includeRender
						? {
								renderSamples: {
									markdownDetails: [
										"<details>",
										"<summary>FlowDesk UI probe: details summary</summary>",
										"",
										"[FlowDesk markdown link probe](https://example.com/flowdesk-ui-probe)",
										"",
										"```text",
										...longLog.slice(0, 8),
										"```",
										"</details>",
									].join("\n"),
									longLogText: ["FlowDesk UI probe long log", ...longLog].join("\n"),
									observationInstructions: [
										"1. Check whether markdownDetails renders as collapsible UI or plain text.",
										"2. Click the markdown link and re-run mode=events to see whether any click/navigation event reached Hooks.event.",
										"3. Check whether longLogText is folded, scrollable, or fully expanded by OpenCode's tool-output renderer.",
									].join("\n"),
								},
							}
						: {}),
					...(includeEvents
						? {
								recentEventObservations: observations.slice(-limit),
								recentEventObservationCount: Math.min(observations.length, limit),
								totalBufferedEventObservationCount: observations.length,
							}
						: {}),
				});
			},
		}),
	};
}

export function createFlowDeskProviderUsageLiveOptInTools(
	config: FlowDeskProviderUsageLiveConfigV1,
): Record<string, FlowDeskOpenCodeTool> {
	const executeProviderUsageLive = async (input: unknown) => {
		const request = isRecord(input)
			? {
					providerFamily:
						typeof input.providerFamily === "string"
							? input.providerFamily
							: undefined,
				}
			: {};
		const result = await executeFlowDeskProviderUsageLiveV1({
			config,
			request,
		});
		return JSON.stringify(result);
	};
	return {
		[flowdeskProviderUsageLiveToolName]: tool({
			description: [
				"Return live FlowDesk provider usage availability for Claude, OpenAI/Codex, and Gemini Code Assist using provider-native usage collectors. No estimation; reads OAuth credentials and provider rate-limit/quota APIs. Each provider row carries remainingPercent, alertLevel (ok/warning/critical/exhausted/stale/unknown), and a short recommendation. The top-level worstAlertLevel and overallRecommendation summarize the riskiest provider.",
				"WHEN TO USE: the user asks how much usage, quota, credit, limit, or budget they have left, when their quota resets, or whether a provider is available right now. Trigger on English phrases such as 'usage', 'quota', 'remaining', 'how much left', 'rate limit', 'reset', 'budget left', and on Korean phrases such as '사용량', '잔량', '남은 사용량', '얼마 남았어', '쿼터', '한도', '리셋', '남은거 얼마야', '남은 토큰', '사용 가능량'.",
				"ALSO PROACTIVELY USE: before starting a large multi-step task that depends on a specific provider (e.g. extensive refactor, long agentic loop, multi-perspective review), call this tool first to check whether the chosen provider has enough headroom; if worstAlertLevel is critical or exhausted, warn the user and suggest switching providers or waiting for reset.",
				"WHEN NOT TO USE: general chat, status of an in-progress workflow (use status instead), or any non-usage question.",
				"INVOKE WITH: optional providerFamily ('claude', 'openai', 'gemini', or 'all'; default 'all'). The plugin user has already opted in to provider-native usage collection at configuration time, so this tool can be called automatically without per-call confirmation.",
				"AFTER CALLING: summarize per-provider availability for the user in plain language. For each provider include the bucket label (claude-5h, claude-weekly, openai-gpt-5h, gemini-pro-daily, gemini-pro-weekly, gemini-flash-daily, gemini-flash-lite-daily), remainingPercent, reset time, alertLevel, and recommendation. If any provider returned non_dispatchable, exhausted, critical, stale, or unknown, note it explicitly and surface the overallRecommendation. Never echo raw tokens or raw payloads.",
			].join(" "),
			args: {
				providerFamily: tool.schema
					.string()
					.optional()
					.describe(
						"Provider to query: 'claude', 'openai', 'gemini', or 'all' (default).",
					),
			},
			async execute(input) {
				return executeProviderUsageLive(input);
			},
		}),
		[flowdeskQuotaToolName]: tool({
			description:
				"Use for FlowDesk usage, quota, remaining capacity, or reset times. Diagnostics only; no provider switch, fallback, dispatch, runtime, lane, or write authority.",
			args: {
				providerFamily: tool.schema
					.string()
					.optional()
					.describe("Provider family: claude, openai, gemini, or all. Defaults to all."),
			},
			async execute(input) {
				return executeProviderUsageLive(input);
			},
		}),
	};
}

function quickReviewerRunClientFrom(
	input: unknown,
	options?: PluginOptions,
): FlowDeskManagedDispatchBetaOpenCodeClientV1 | undefined {
	const option = options?.[flowdeskQuickReviewerRunOption];
	if (isRecord(option) && isManagedDispatchBetaClient(option.client))
		return option.client;
	return isRecord(input) && isManagedDispatchBetaClient(input.client)
		? input.client
		: undefined;
}

function quickReviewerRunDefaultsFromOptions(options?: PluginOptions): {
	providerQualifiedModelId?: string;
	runtimeAgent?: string;
	sourceLabel?: string;
	rootDir?: string;
} {
	const option = options?.[flowdeskQuickReviewerRunOption];
	if (!isRecord(option)) return {};
	const optionRoot =
		typeof option.durableStateRoot === "string" &&
		option.durableStateRoot.trim().length > 0
			? option.durableStateRoot
			: undefined;
	const rootDir = optionRoot ?? durableStateRootFromOptions(options);
	return {
		...(typeof option.providerQualifiedModelId === "string" &&
		option.providerQualifiedModelId.trim().length > 0
			? { providerQualifiedModelId: option.providerQualifiedModelId }
			: {}),
		...(typeof option.runtimeAgent === "string" &&
		option.runtimeAgent.trim().length > 0
			? { runtimeAgent: option.runtimeAgent }
			: {}),
		...(typeof option.sourceLabel === "string" &&
		option.sourceLabel.trim().length > 0
			? { sourceLabel: option.sourceLabel }
			: {}),
		...(rootDir === undefined ? {} : { rootDir }),
	};
}

function watchdogConfigFromOptions(options: PluginOptions | undefined): FlowDeskWatchdogConfigV1 | undefined {
	const w = (options as Record<string, unknown> | undefined)?.[flowdeskWatchdogOption];
	if (!isRecord(w) || w.enabled !== true) return undefined;
	return {
		enabled: true,
		intervalMs: Math.max(10_000, typeof w.intervalMs === "number" ? w.intervalMs : 30_000),
		stallThresholdMs: typeof w.stallThresholdMs === "number" ? w.stallThresholdMs : 3 * 60_000,
		mcpTriggerEnabled: w.mcpTriggerEnabled === true,
	};
}

const flowdeskServerPlugin: Plugin = async (input, options) => {
	const projectConfigLoad = loadProjectConfigFromOptions(options);
	const chatIntakeModeGate = chatIntakeModeGateFromProjectConfig(
		projectConfigLoad,
		options,
	);
	const naturalLanguageRoutingEnabled =
		isNaturalLanguageRoutingEnabled(options) &&
		isNaturalLanguageRoutingAllowedByProjectConfig(projectConfigLoad);
	const localSession =
		isLocalNonDispatchAdapterEnabled(options) || naturalLanguageRoutingEnabled
		? createFlowDeskLocalNonDispatchAdapterSession(new Date(), undefined, {
				durableStateRootDir: durableStateRootFromOptions(options),
				projectConfig: localProjectConfigFileOptionsFromOptions(options),
				productionEnablement: productionEnablementFromOptions(options),
				reviewerFanoutDiagnostics:
					reviewerFanoutDiagnosticsFromOptions(options),
				devBetaAgentTaskRun: {
					enabled: isAgentTaskRunEnabled(options),
					registered: isAgentTaskRunEnabled(options),
					hasInjectedSdkClient:
						isRecord(input) && isManagedDispatchBetaClient(input.client),
					durableStateRootConfigured:
						durableStateRootFromOptions(options) !== undefined,
				},
			})
			: undefined;
	const managedDispatchBetaClient =
		isManagedDispatchBetaAdapterEnabled(options) ||
		isDefaultManagedDispatchAuthorized(options)
			? managedDispatchBetaClientFrom(input, options)
			: undefined;
	const managedDispatchBetaReservationStore =
		isManagedDispatchBetaAdapterEnabled(options) ||
		isDefaultManagedDispatchAuthorized(options)
			? (managedDispatchBetaReservationStoreFrom(input, options) ??
				managedDispatchBetaDurableReservationStoreFrom(options))
			: undefined;
	const defaultAuthorization =
		defaultManagedDispatchAuthorizationFromOptions(options);
	const derivedDefaultAuthorizationMetadataConfigured =
		!hasDefaultManagedDispatchAuthorizationOption(options) &&
		hasDefaultManagedDispatchAuthorizationMetadata(options);
	const managedDispatchRunRouteClient =
		managedDispatchBetaClient ??
		(derivedDefaultAuthorizationMetadataConfigured
			? managedDispatchBetaClientFrom(input, options)
			: undefined);
	const managedDispatchRunRouteReservationStore =
		managedDispatchBetaReservationStore ??
		(derivedDefaultAuthorizationMetadataConfigured
			? (managedDispatchBetaReservationStoreFrom(input, options) ??
				managedDispatchBetaDurableReservationStoreFrom(options))
			: undefined);
	const exactModelProviderAcquisitionClient =
		isExactModelProviderAcquisitionLiveTestEnabled(options)
			? exactModelProviderAcquisitionClientFrom(input, options)
			: undefined;
	const exactModelProviderAcquisitionRoot =
		exactModelProviderAcquisitionRootFrom(options);
	const exactModelProviderAcquisitionCacheMaterialization =
		exactModelProviderAcquisitionCacheMaterializationFromOptions(options);
	const runtimeReviewerExecutionClient = isRuntimeReviewerExecutionEnabled(
		options,
	)
		? runtimeReviewerExecutionClientFrom(input, options)
		: undefined;
	const runtimeReviewerExecutionRoot =
		runtimeReviewerExecutionRootFrom(options);
	const tools: Record<string, FlowDeskOpenCodeTool> = {
		[flowdeskPreSpikeDoctorToolName]: tool({
			description:
				"Report FlowDesk plugin load status without enabling real dispatch, provider calls, or runtime execution.",
			args: {},
			async execute() {
				const providerUsageLiveConfigForDoctor = isProviderUsageLiveEnabled(
					options,
				)
					? providerUsageLiveConfigFromOptions(options)
					: undefined;
				const statusLiveConfigForDoctor = isStatusLiveEnabled(options)
					? statusLiveConfigFromOptions(options)
					: undefined;
				const quickFallbackRunConfigForDoctor = isQuickFallbackRunEnabled(
					options,
				)
					? quickFallbackRunConfigFromOptions(options)
					: undefined;
				const laneHeartbeatWriterConfigForDoctor = isLaneHeartbeatWriterEnabled(
					options,
				)
					? laneHeartbeatWriterConfigFromOptions(options)
					: undefined;
				const workflowDispatchPlanConfigForDoctor =
					isWorkflowDispatchPlanToolEnabled(options)
						? workflowDispatchPlanToolConfigFromOptions(options)
						: undefined;
				const quickReviewerRunRegistered =
					isQuickReviewerRunEnabled(options) &&
					quickReviewerRunClientFrom(input, options) !== undefined;
				const agentTaskRunEnabled = isAgentTaskRunEnabled(options);
				const agentTaskRunHasClient =
					isRecord(input) && isManagedDispatchBetaClient(input.client);
				const agentTaskRunRoot = durableStateRootFromOptions(options);
				const naturalLanguageTools = {
					agentTaskRun: {
						enabled: agentTaskRunEnabled,
						registered: agentTaskRunEnabled,
						schemaVisibleWhenEnabled: true,
						hasInjectedSdkClient: agentTaskRunHasClient,
						durableStateRoot: agentTaskRunRoot,
						executionFailClosedUntilClientAvailable:
							agentTaskRunEnabled && !agentTaskRunHasClient,
					},
					quickReviewerRun: {
						enabled: isQuickReviewerRunEnabled(options),
						registered: quickReviewerRunRegistered,
						missingClient:
							isQuickReviewerRunEnabled(options) && !quickReviewerRunRegistered
								? "injected OpenCode SDK client (input.client) is missing"
								: undefined,
					},
					providerUsageLive: {
						enabled: isProviderUsageLiveEnabled(options),
						registered: providerUsageLiveConfigForDoctor !== undefined,
						providers: providerUsageLiveConfigForDoctor?.providers,
						persistsSnapshots:
							providerUsageLiveConfigForDoctor?.persistSnapshots === true &&
							typeof providerUsageLiveConfigForDoctor?.durableStateRootDir ===
								"string",
						persistWorkflowId:
							providerUsageLiveConfigForDoctor?.persistWorkflowId,
					geminiOAuthConfigured:
						providerUsageLiveConfigForDoctor !== undefined &&
						(
							// Explicit inline config
							(providerUsageLiveConfigForDoctor.geminiOAuthClientId !== undefined &&
								providerUsageLiveConfigForDoctor.geminiOAuthClientSecret !== undefined) ||
							// Explicit env vars
							typeof process.env.FLOWDESK_GEMINI_OAUTH_CLIENT_ID === "string" ||
							typeof process.env.FLOWDESK_GEMINI_OAUTH_CLIENT_SECRET === "string" ||
							// Auto-detect: OpenCode auth store (opencode-gemini-auth login)
							geminiOAuthAutoDetectAvailable(providerUsageLiveConfigForDoctor.homeDir)
						),
						hint:
							isProviderUsageLiveEnabled(options) &&
							providerUsageLiveConfigForDoctor === undefined
								? "providerUsageLive.enabled=true but no provider family configured; set providers=['claude','openai','gemini']"
								: undefined,
					},
					statusLive: {
						enabled: isStatusLiveEnabled(options),
						registered: statusLiveConfigForDoctor !== undefined,
						rootDir: statusLiveConfigForDoctor?.rootDir,
						laneHeartbeatLateThresholdMs:
							statusLiveConfigForDoctor?.laneHeartbeatLateThresholdMs,
						laneHeartbeatStallThresholdMs:
							statusLiveConfigForDoctor?.laneHeartbeatStallThresholdMs,
						exposesLaneStallProjection: statusLiveConfigForDoctor !== undefined,
						exposesExpectedNextHeartbeatOverdueHint:
							statusLiveConfigForDoctor !== undefined,
						hint:
							isStatusLiveEnabled(options) &&
							statusLiveConfigForDoctor === undefined
								? "statusLive.enabled=true but no durable state root resolved; set statusLive.rootDir or top-level durableStateRoot"
								: undefined,
					},
					quickFallbackRun: {
						enabled: isQuickFallbackRunEnabled(options),
						registered: quickFallbackRunConfigForDoctor !== undefined,
						defaultFromProvider:
							quickFallbackRunConfigForDoctor?.defaultFromProvider,
						defaultToProvider:
							quickFallbackRunConfigForDoctor?.defaultToProvider,
						persistsRegatePlanEvidence:
							quickFallbackRunConfigForDoctor?.rootDir !== undefined,
					},
					laneHeartbeatWriter: {
						enabled: isLaneHeartbeatWriterEnabled(options),
						registered: laneHeartbeatWriterConfigForDoctor !== undefined,
						rootDir: laneHeartbeatWriterConfigForDoctor?.rootDir,
						defaultExpectedIntervalMs:
							laneHeartbeatWriterConfigForDoctor?.defaultExpectedIntervalMs,
						hint:
							isLaneHeartbeatWriterEnabled(options) &&
							laneHeartbeatWriterConfigForDoctor === undefined
								? "laneHeartbeatWriter.enabled=true but no durable state root resolved; set laneHeartbeatWriter.rootDir or top-level durableStateRoot"
								: undefined,
					},
					workflowDispatchPlanTool: {
						enabled: isWorkflowDispatchPlanToolEnabled(options),
						registered: workflowDispatchPlanConfigForDoctor !== undefined,
						rootDir: workflowDispatchPlanConfigForDoctor?.rootDir,
						persistsWorkflowDispatchPlanEvidence:
							workflowDispatchPlanConfigForDoctor !== undefined,
						authority: {
							realOpenCodeDispatch: false,
							providerCall: false,
							runtimeExecution: false,
							actualLaneLaunch: false,
							fallbackAuthority: false,
						},
						hint:
							isWorkflowDispatchPlanToolEnabled(options) &&
							workflowDispatchPlanConfigForDoctor === undefined
								? "workflowDispatchPlanTool.enabled=true but no durable state root resolved; set workflowDispatchPlanTool.rootDir or top-level durableStateRoot"
								: undefined,
					},
					chatMessageStallAlert: {
						enabled:
							options?.[flowdeskChatMessageStallAlertOption] === true ||
							(isRecord(options?.[flowdeskChatMessageStallAlertOption]) &&
								(
									options?.[flowdeskChatMessageStallAlertOption] as {
										enabled?: unknown;
									}
								).enabled === true),
						registered:
							chatMessageStallAlertOptionsFrom(
								options,
								statusLiveConfigForDoctor,
							) !== undefined,
						requires:
							"statusLive.enabled=true and durableStateRoot (top-level or chatMessageStallAlert.rootDir)",
						note: "chat.message hook appends a passive stall card listing stalled lanes and safe next actions; no auto-retry, auto-abort, or auto-fallback.",
					},
					exportDebug: {
						registered: true,
						note: "/flowdesk-export-debug writes a redacted manifest plus one debug section file per requested section under .flowdesk/sessions/<sid>/redacted-debug/sections/<section>.json when durableStateRoot is configured.",
						sections: [
							"doctor",
							"conformance",
							"workflow_state",
							"audit_refs",
							"usage_summary",
							"policy_summary",
							"redaction_summary",
						],
						manifestPath:
							".flowdesk/sessions/<sid>/redacted-debug/manifest.json",
						sectionPathTemplate:
							".flowdesk/sessions/<sid>/redacted-debug/sections/<section>.json",
					},
				};
				return JSON.stringify({
					pluginId: flowdeskPluginId,
					loaded: true,
					probeRegistrationProfile: isFds1SchemaConversionProbeEnabled(options)
						? "sandbox_conformance_probe_only"
						: "disabled",
					localNonDispatchAdapterProfile: isLocalNonDispatchAdapterEnabled(
						options,
					)
						? flowdeskLocalNonDispatchAdapterProfile
						: "disabled",
					projectConfig: projectConfigLoad,
					chatIntakeModeGate,
					naturalLanguageRoutingProfile: naturalLanguageRoutingEnabled
						? "chat_steering_command_backed"
						: "disabled",
					naturalLanguageTools,
					devBetaLaneCapability: {
						agentTaskRunEnabled,
						agentTaskRunRegistered: agentTaskRunEnabled,
						hasInjectedSdkClient: agentTaskRunHasClient,
						durableStateRootConfigured: agentTaskRunRoot !== undefined,
						launchCapable:
							agentTaskRunEnabled &&
							agentTaskRunHasClient &&
							agentTaskRunRoot !== undefined,
						note:
							"Explicit dev/beta agent-task lane capability is separate from the default production managed-dispatch promotion gate.",
					},
					...(() => {
					// Doctor live-evaluation path: if no pre-baked authorization is
					// present in options but production-enablement default-dispatch
					// metadata IS configured, evaluate live against durable evidence
					// under `.flowdesk/sessions/<doctor-probe-workflow-id>/evidence/`
					// so doctor can report the real
					// `defaultManagedDispatchRegistrationAuthorized` value derived
					// from the user's evidence, not a hard-coded false. The derived
					// authorization is diagnostic-only; it does NOT enable dispatch
					// authority, runtime execution, provider calls, or lane launches.
					const derivedDoctorAuthorization =
						defaultAuthorization === undefined &&
						derivedDefaultAuthorizationMetadataConfigured
							? deriveDefaultManagedDispatchAuthorizationForDoctorV1({
									options,
									durableStateRootDir:
										durableStateRootFromOptions(options),
								})
							: undefined;
					const effectiveAuthorization =
						defaultAuthorization ?? derivedDoctorAuthorization;
					const doctorProbeWorkflowId =
						derivedDefaultAuthorizationMetadataConfigured
							? doctorProbeWorkflowIdFromOptions(options)
							: undefined;
					return {
						productionPromotionGate:
							effectiveAuthorization === undefined
								? "release1_non_dispatch_command_registration_ready"
								: "default_managed_dispatch_authorized_registration_ready",
						defaultManagedDispatchRegistrationAuthorized:
							effectiveAuthorization !== undefined,
						derivedDefaultManagedDispatchAuthorizationMetadataConfigured:
							derivedDefaultAuthorizationMetadataConfigured,
						...(effectiveAuthorization === undefined
							? {}
							: {
									defaultManagedDispatchAuthorizationRef:
										effectiveAuthorization.authorization_id,
									defaultManagedDispatchReadinessRef:
										effectiveAuthorization.readiness_ref,
								}),
						...(derivedDoctorAuthorization !== undefined
							? {
									defaultManagedDispatchAuthorizationSource:
										"derived_from_durable_evidence",
								}
							: defaultAuthorization !== undefined
							? {
									defaultManagedDispatchAuthorizationSource:
										"option_pre_baked",
								}
							: {}),
						...(doctorProbeWorkflowId === undefined
							? {}
							: { doctorProbeWorkflowId }),
					};
				})(),
					productionOpenCodeRegistration: hasProductionOpenCodeRegistration(),
					productionToolRegistration:
						flowdeskPluginScaffold.productionToolRegistration,
					release1HandlerReadiness:
						getFlowDeskRelease1HandlerReadinessSummary(),
					release1ProductionReadiness:
						getFlowDeskRelease1ProductionReadinessSummary(),
				fds1SchemaConversionSpikePassed:
					hasPassingFds1SchemaConversionSpike(),
				operationalIntelligence:
					operationalIntelligenceConfigFromOptions(options),
				federatedRegistry: {
					enabled: true,
					publishToolRegistered: true,
					githubOAuthAvailable: (
						typeof process.env.GITHUB_TOKEN === "string" ||
						typeof process.env.FLOWDESK_GITHUB_OAUTH_TOKEN === "string"
					),
					publicationState: "pending_gate_promotion",
					note: "Federated registry publication records remain advisory-only; flowdesk_federated_registry_publish performs a real GitHub write only when an explicit internal later-gate flag is true.",
				},
				realOpenCodeDispatch:
					flowdeskPluginScaffold.runtimeBoundary.realOpenCodeDispatch,
				providerCall: false,
				runtimeExecution: false,
				actualLaneLaunch: false,
				fallbackAuthority: false,
				hardCancelOrNoReplyAuthority: false,
			});
			},
		}),
	};
	const federatedRegistryConfig = isRecord(options?.federatedRegistry) ? options.federatedRegistry : { enabled: false };
	if (federatedRegistryConfig.enabled === true) {
		Object.assign(tools, createFlowDeskFederatedRegistryPublishTools());
	}
	if (isFds1SchemaConversionProbeEnabled(options))
		Object.assign(tools, createFlowDeskFds1SchemaConversionProbeTools());
	if (isLocalNonDispatchAdapterEnabled(options))
		Object.assign(
			tools,
			createFlowDeskLocalNonDispatchAdapterTools(new Date(), localSession, {
				client: managedDispatchRunRouteClient,
				reservationStore: managedDispatchRunRouteReservationStore,
				durableStateRootDir: durableStateRootFromOptions(options),
				defaultAuthorization,
				deriveDefaultAuthorization: (request) =>
					derivedDefaultAuthorizationMetadataConfigured
						? deriveDefaultManagedDispatchAuthorizationFromProductionEnablement({
								request,
								options,
								durableStateRootDir: durableStateRootFromOptions(options),
								...(managedDispatchRunRouteClient === undefined
									? {}
									: { client: managedDispatchRunRouteClient }),
							})
						: undefined,
			}),
		);
	if (isNaturalLanguageRoutingEnabled(options))
		Object.assign(
			tools,
			createFlowDeskNaturalLanguageRoutingTools(
				new Date(),
				localSession,
				chatIntakeModeGate,
			),
		);
	const agentTaskRunEnabled = isAgentTaskRunEnabled(options);
	if (agentTaskRunEnabled) {
		const agentTaskRunClient = isRecord(input) && isManagedDispatchBetaClient(input.client) ? input.client : undefined;
		const agentTaskRunRoot = durableStateRootFromOptions(options);
		Object.assign(tools, createFlowDeskAgentTaskRunOptInTools({
			client: agentTaskRunClient,
			durableStateRoot: agentTaskRunRoot,
			options,
		}));
	}
	if (managedDispatchBetaClient !== undefined)
		Object.assign(
			tools,
			createFlowDeskManagedDispatchBetaOptInTools(
				managedDispatchBetaClient,
				managedDispatchBetaReservationStore,
				durableStateRootFromOptions(options),
			),
		);
	if (
		exactModelProviderAcquisitionClient !== undefined &&
		exactModelProviderAcquisitionRoot !== undefined
	)
		Object.assign(
			tools,
			createFlowDeskExactModelProviderAcquisitionLiveTestOptInTools(
				exactModelProviderAcquisitionClient,
				exactModelProviderAcquisitionRoot,
				exactModelProviderAcquisitionCacheMaterialization,
				runtimeReviewerExecutionClient ??
					exactModelProviderAcquisitionRuntimeReviewerExecutionClientFrom(
						input,
						options,
					),
			),
		);
	if (
		runtimeReviewerExecutionClient !== undefined &&
		runtimeReviewerExecutionRoot !== undefined
	)
		Object.assign(
			tools,
			createFlowDeskRuntimeReviewerExecutionOptInTools(
				runtimeReviewerExecutionClient,
				runtimeReviewerExecutionRoot,
			),
		);
	if (isManagedFallbackRegateEnabled(options))
		Object.assign(
			tools,
			createFlowDeskManagedFallbackRegateOptInTools(
				durableStateRootFromOptions(options),
			),
		);
	const quickReviewerRunClient = isQuickReviewerRunEnabled(options)
		? quickReviewerRunClientFrom(input, options)
		: undefined;
	if (quickReviewerRunClient !== undefined)
		Object.assign(
			tools,
			createFlowDeskQuickReviewerRunOptInTools(
				quickReviewerRunClient,
				quickReviewerRunDefaultsFromOptions(options),
			),
		);
	const providerUsageLiveConfig = isProviderUsageLiveEnabled(options)
		? providerUsageLiveConfigFromOptions(options)
		: undefined;
	if (providerUsageLiveConfig !== undefined)
		Object.assign(
			tools,
			createFlowDeskProviderUsageLiveOptInTools(providerUsageLiveConfig),
		);
	const statusLiveConfig = isStatusLiveEnabled(options)
		? statusLiveConfigFromOptions(options)
		: undefined;
	if (statusLiveConfig !== undefined) {
		Object.assign(tools, createFlowDeskStatusLiveOptInTools(statusLiveConfig));
		Object.assign(tools, createFlowDeskWorkflowSynthesisPreviewTools({ rootDir: statusLiveConfig.rootDir }));
	}
	const quickFallbackRunConfig = isQuickFallbackRunEnabled(options)
		? quickFallbackRunConfigFromOptions(options)
		: undefined;
	if (quickFallbackRunConfig !== undefined)
		Object.assign(
			tools,
			createFlowDeskQuickFallbackRunOptInTools(quickFallbackRunConfig),
		);
	const laneHeartbeatWriterConfig = isLaneHeartbeatWriterEnabled(options)
		? laneHeartbeatWriterConfigFromOptions(options)
		: undefined;
	if (laneHeartbeatWriterConfig !== undefined)
		Object.assign(
			tools,
			createFlowDeskLaneHeartbeatWriterOptInTools(laneHeartbeatWriterConfig),
		);
	const workflowDispatchPlanConfig = isWorkflowDispatchPlanToolEnabled(options)
		? workflowDispatchPlanToolConfigFromOptions(options)
		: undefined;
	if (workflowDispatchPlanConfig !== undefined)
		Object.assign(
			tools,
			createFlowDeskWorkflowDispatchPlanOptInTools(workflowDispatchPlanConfig),
		);
	if (workflowDispatchPlanConfig !== undefined)
		Object.assign(
			tools,
			createFlowDeskAutoContinuePreviewOptInTools(workflowDispatchPlanConfig),
		);
	const workflowDispatchConfig = workflowDispatchToolConfigFromOptions(input, options);
	if (workflowDispatchConfig !== undefined)
		Object.assign(
			tools,
			createFlowDeskWorkflowDispatchOptInTools(workflowDispatchConfig),
		);
	const autoContinueExecutionConfig = autoContinueExecutionToolConfigFromOptions(input, options);
	if (autoContinueExecutionConfig !== undefined)
		Object.assign(
			tools,
			createFlowDeskAutoContinueExecutionOptInTools(autoContinueExecutionConfig),
		);
	const controlledWriteApplyConfig = controlledWriteApplyConfigFromOptions(input, options);
	if (controlledWriteApplyConfig !== undefined)
		Object.assign(
			tools,
			createFlowDeskControlledWriteApplyOptInTools(controlledWriteApplyConfig),
		);
	const orchestrateConfig = orchestrateToolConfigFromOptions(input, options);
	if (orchestrateConfig !== undefined)
		Object.assign(tools, createFlowDeskOrchestrateOptInTools(orchestrateConfig));
	// P7-S10 OI MCP Tools
	const oiToolsConfig = operationalIntelligenceConfigFromOptions(options);
	if (oiToolsConfig.exposeMcpTools) {
		const oiRootDir = durableStateRootFromOptions(options);
		if (oiRootDir !== undefined)
			Object.assign(tools, createFlowDeskOIOptInTools({ rootDir: oiRootDir, oiConfig: oiToolsConfig }));
	}
	const uiProbeEnabled = isFlowDeskUiProbeEnabled(options);
	const uiProbeEventObservations: FlowDeskUiProbeEventObservationV1[] = [];
	if (uiProbeEnabled) Object.assign(tools, createFlowDeskUiProbeTools(uiProbeEventObservations));

	// P8 Background Watchdog
	const watchdogConfig = watchdogConfigFromOptions(options);
	const durableStateRoot = durableStateRootFromOptions(options);
	if (durableStateRoot !== undefined)
		initializeCompletionWakeParentSessionRefFromReadyCache(durableStateRoot);
	const completionWakeMainSessionConfigFor = (ctx?: unknown) =>
		completionWakeMainSessionConfigFromOptions(options, ctx);
	completionWakeMainSessionConfigFor(input);
	const consumeCompletionWakeForMainSessionBestEffort = async (ctx?: unknown): Promise<void> => {
		const currentCompletionWakeMainSessionConfig = completionWakeMainSessionConfigFor(ctx);
		if (WAKE_DIAG_ENABLED) {
			try {
				const fs = require("node:fs") as typeof import("node:fs");
				fs.appendFileSync(wakeDiagnosticLogPath("wake-cond-diag.log"),
					`${new Date().toISOString()} finalizationRelevant config=${currentCompletionWakeMainSessionConfig !== undefined} client=${eventMonitorClient !== undefined} parentRef=${currentCompletionWakeMainSessionConfig?.parentSessionRef ?? "NONE"}\n`, "utf8");
			} catch { /* best-effort */ }
		}
		if (currentCompletionWakeMainSessionConfig !== undefined && eventMonitorClient !== undefined) {
			try {
				await consumeFlowDeskCompletionWakeForMainSessionV1({
					config: currentCompletionWakeMainSessionConfig,
					client: eventMonitorClient,
				});
			} catch {
				// best-effort; advisory wake must not crash the plugin
			}
		}
	};
	const chatStallAlertRaw = (options as Record<string, unknown> | undefined)?.[flowdeskChatMessageStallAlertOption];
	const guardedAutoAbortForWatchdog = isRecord(chatStallAlertRaw) && isRecord(chatStallAlertRaw.guardedAutoAbort)
		? (() => {
				const raw = chatStallAlertRaw.guardedAutoAbort as Record<string, unknown>;
				const cfg: FlowDeskAutoAbortConfigV1 = {
					autoAbortOnStall: raw.autoAbortOnStall === true,
				};
				if (typeof raw.preAbortWarningMs === "number") cfg.preAbortWarningMs = Math.floor(raw.preAbortWarningMs);
				if (typeof raw.guardSignOffPath === "string") cfg.guardSignOffPath = raw.guardSignOffPath;
				if (typeof raw.guardHmacKey === "string") cfg.guardHmacKey = raw.guardHmacKey;
				if (typeof raw.productionMode === "boolean") cfg.productionMode = raw.productionMode;
				if (raw.autoRetryAfterAbort === true) cfg.autoRetryAfterAbort = true;
				if (typeof raw.maxAutoRetries === "number") cfg.maxAutoRetries = Math.min(2, Math.max(1, Math.floor(raw.maxAutoRetries)));
				return cfg;
			})()
		: undefined;
	// V11.3 event-awakened watchdog: when the event hook observes a
	// finalization-relevant child-session event, it pokes this debounced trigger
	// so the watchdog cycle runs immediately instead of waiting up to the full
	// setInterval period. Capture stays owned by the watchdog cycle (single
	// entry point); the event hook only schedules it. Remains undefined unless
	// the setInterval watchdog is enabled, so the event hook degrades gracefully.
	let pokeWatchdogCycle: (() => void) | undefined;
	if (watchdogConfig?.enabled === true && guardedAutoAbortForWatchdog !== undefined && durableStateRoot !== undefined) {
		const capturedClient = isRecord(input) && isManagedDispatchBetaClient(input.client) ? input.client : undefined;
		const capturedParentSessionId = "";
		const capturedRootDir = durableStateRoot;
		const capturedConfig = guardedAutoAbortForWatchdog;

		const runWatchdogCycle = (consumeCompletionWakeAfterCapture = false) => {
			runFlowDeskWatchdogCycleV1({
				config: capturedConfig,
				rootDir: capturedRootDir,
				client: capturedClient,
				parentSessionId: capturedParentSessionId,
				now: new Date(),
			}).then(async (cycleResult) => {
				if (consumeCompletionWakeAfterCapture) {
					await consumeCompletionWakeForMainSessionBestEffort(input);
					return;
				}
				const hasTerminalWakeCandidate =
					(cycleResult.newTerminalLaneCount ?? 0) > 0 ||
					(cycleResult.retryableTerminalWakePendingCount ?? 0) > 0;
				if (hasTerminalWakeCandidate) {
					await consumeCompletionWakeForMainSessionBestEffort(input);
				}
			}).catch(() => {
				// errors are swallowed — watchdog must not crash the plugin
			});
			// Event-driven pokes always opt into post-capture wake consumption. Interval
			// cycles only attempt it when the cycle reports a terminal wake candidate;
			// completion-wake-main-session handles cooldown, locking, and consumed rows.
		};

		const watchdogInterval = setInterval(runWatchdogCycle, watchdogConfig.intervalMs ?? 30_000);

		// Debounced poke: coalesce bursty finalization events into at most one
		// extra cycle per debounce window. runFlowDeskWatchdogCycleV1 already
		// guards re-entry (`cycle_already_running`), so overlap with the interval
		// is safe; the debounce just avoids scheduling a flood of timers.
		const pokeDebounceMs = 250;
		let pokeTimer: ReturnType<typeof setTimeout> | undefined;
		pokeWatchdogCycle = () => {
			if (pokeTimer !== undefined) return;
			pokeTimer = setTimeout(() => {
				pokeTimer = undefined;
				runWatchdogCycle(true);
			}, pokeDebounceMs);
			pokeTimer.unref?.();
		};

		// Allow the process to exit even if the interval is still active
		watchdogInterval.unref();

		process.once("exit", () => clearInterval(watchdogInterval));
		process.once("SIGTERM", () => clearInterval(watchdogInterval));

		if (watchdogConfig.mcpTriggerEnabled === true) {
			tools[flowdeskWatchdogTriggerToolName] = tool({
				description: "Trigger one watchdog cycle manually. Called by external flowdesk-watchdog process (Option A). Requires guardedAutoAbort config.",
				args: { parentSessionId: tool.schema.string().optional() },
				async execute(args) {
					const psi = isRecord(args) && typeof args.parentSessionId === "string" ? args.parentSessionId : "";
					const result = await runFlowDeskWatchdogCycleV1({
						config: capturedConfig,
						rootDir: capturedRootDir,
						client: capturedClient,
						parentSessionId: psi,
						now: new Date(),
					});
					await consumeCompletionWakeForMainSessionBestEffort(input);
					return JSON.stringify({
						cycleAt: result.cycleAt,
						guardValid: result.guardValid,
						lanesChecked: result.lanesChecked,
						lanesAborted: result.lanesAborted,
						lanesRetried: result.lanesRetried,
						lanesFailed: result.lanesFailed,
						skippedReason: result.skippedReason,
					});
				},
			});
		}
	} else if (watchdogConfig?.mcpTriggerEnabled === true && guardedAutoAbortForWatchdog !== undefined && durableStateRoot !== undefined) {
		// mcpTriggerEnabled without setInterval (Option A standalone)
		const capturedClient = isRecord(input) && isManagedDispatchBetaClient(input.client) ? input.client : undefined;
		const capturedRootDir = durableStateRoot;
		const capturedConfig = guardedAutoAbortForWatchdog;
		tools[flowdeskWatchdogTriggerToolName] = tool({
			description: "Trigger one watchdog cycle manually. Called by external flowdesk-watchdog process (Option A). Requires guardedAutoAbort config.",
			args: { parentSessionId: tool.schema.string().optional() },
			async execute(args) {
				const psi = isRecord(args) && typeof args.parentSessionId === "string" ? args.parentSessionId : "";
				const result = await runFlowDeskWatchdogCycleV1({
					config: capturedConfig,
					rootDir: capturedRootDir,
					client: capturedClient,
					parentSessionId: psi,
					now: new Date(),
				});
				await consumeCompletionWakeForMainSessionBestEffort(input);
				return JSON.stringify({
					cycleAt: result.cycleAt,
					guardValid: result.guardValid,
					lanesChecked: result.lanesChecked,
					lanesAborted: result.lanesAborted,
					lanesRetried: result.lanesRetried,
					lanesFailed: result.lanesFailed,
					skippedReason: result.skippedReason,
				});
			},
		});
	}

	const eventRootDir = durableStateRootFromOptions(options);
	const eventMonitorClient = isRecord(input) && isManagedDispatchBetaClient(input.client) ? input.client : undefined;
	const eventHook = eventRootDir === undefined && !uiProbeEnabled
		? undefined
		: async (input: { event: unknown }) => {
				if (uiProbeEnabled) {
					uiProbeEventObservations.push(
						summarizeFlowDeskUiProbeEventV1(input.event, new Date().toISOString()),
					);
					if (uiProbeEventObservations.length > 200) uiProbeEventObservations.splice(0, uiProbeEventObservations.length - 200);
				}
				if (eventRootDir !== undefined) {
					const observed = await observeFlowDeskOpenCodeEventV1({ rootDir: eventRootDir, event: input.event });
					// V11.3: if this was a matched, finalization-relevant child-session
					// event, poke the watchdog so it captures/terminalizes immediately
					// instead of waiting up to a full setInterval period. The watchdog
					// (single capture owner) still does the actual work.
					if (observed.matched && observed.finalizationRelevant === true) {
						if (pokeWatchdogCycle !== undefined) {
							pokeWatchdogCycle();
						} else if (eventMonitorClient !== undefined && observed.workflowId !== undefined) {
							// Agent-task async capture must not depend on the guarded auto-abort
							// watchdog being enabled. When guardedAutoAbort is not configured, run a
							// bounded capture-oriented monitor pass for the affected workflow only.
							// Use wide termination clocks so this event-poked path captures completed
							// child output but does not act as a hidden auto-abort loop.
							//
							// Body capture retry: if the first pass finds lanes still awaiting body
							// capture (turn completed but SDK buffer not yet readable), reschedule up
							// to 3 times at 5-second intervals — without relying on another user event.
							const capturedWorkflowId = observed.workflowId;
							const runMonitorWithBodyCaptureRetry = async (retriesLeft: number): Promise<void> => {
								try {
									const monResult = await monitorChildSessionsV1({
										rootDir: eventRootDir,
										workflowId: capturedWorkflowId,
										client: eventMonitorClient,
										now: new Date(),
										abortThresholdMs: 10 * 60_000,
										absoluteLaneAgeMs: 60 * 60_000,
									});
									if (
										monResult.lanesCompleted > 0 ||
										monResult.lanesAborted > 0 ||
										observed.eventType === "session.error"
									) {
										refreshFlowDeskCompletionUiCachesV1({
											rootDir: eventRootDir,
											workflowId: capturedWorkflowId,
										});
										await consumeCompletionWakeForMainSessionBestEffort(input);
									}
									if ((monResult.lanesAwaitingCapture ?? 0) > 0 && retriesLeft > 0) {
										const retryTimer = setTimeout(
											() => runMonitorWithBodyCaptureRetry(retriesLeft - 1),
											5_000,
										);
										retryTimer.unref?.();
									}
								} catch {
									// best-effort; event hook must not crash the plugin
								}
							};
							await runMonitorWithBodyCaptureRetry(3);
						}
					}
					const permissionCompletionWakeMainSessionConfig = completionWakeMainSessionConfigFor(input);
					if (observed.matched && observed.permissionAttentionRelevant === true && permissionCompletionWakeMainSessionConfig !== undefined && eventMonitorClient !== undefined) {
						try {
							await consumeFlowDeskCompletionWakeForMainSessionV1({
								config: permissionCompletionWakeMainSessionConfig,
								client: eventMonitorClient,
							});
						} catch {
							// advisory-only permission attention wake must not crash the plugin
						}
					}
				}
			};

	if (!naturalLanguageRoutingEnabled) return eventHook === undefined ? { tool: tools } : { tool: tools, event: eventHook };
	const stallAlertOption = chatMessageStallAlertOptionsFrom(
		options,
		statusLiveConfig,
		isRecord(input) && isManagedDispatchBetaClient(input.client)
			? input.client
			: undefined,
	);
	// Background sidebar cache refresh interval — runs every 3 minutes regardless of chat activity
	if (providerUsageLiveConfig?.durableStateRootDir) {
		const capturedUsageConfig = providerUsageLiveConfig;
		const sidebarRefreshIntervalMs = 3 * 60_000;
		const sidebarRefreshInterval = setInterval(() => {
			const cachePath = join(capturedUsageConfig.durableStateRootDir!, ".flowdesk", "ui", "provider-usage-sidebar.json");
			let isStale = false;
			try {
				const cache = JSON.parse(readFileSync(cachePath, "utf8")) as Record<string, unknown>;
				isStale = isProviderUsageSidebarCacheStale(cache, Date.now(), sidebarRefreshIntervalMs);
			} catch {
				isStale = true;
			}
			if (isStale) {
				executeFlowDeskProviderUsageLiveV1({
					config: { ...capturedUsageConfig, persistSidebarCache: true },
					request: { providerFamily: "all" },
				}).catch(() => {});
			}
		}, sidebarRefreshIntervalMs);
		sidebarRefreshInterval.unref();
		process.once("exit", () => clearInterval(sidebarRefreshInterval));
		process.once("SIGTERM", () => clearInterval(sidebarRefreshInterval));
	}

	return {
		tool: tools,
		...(eventHook === undefined ? {} : { event: eventHook }),
		"chat.message": createFlowDeskNaturalLanguageChatMessageHook(
			() => new Date(),
			localSession,
			stallAlertOption,
			durableStateRootFromOptions(options),
			providerUsageLiveConfig,
			chatIntakeModeGate,
		),
	};
};

export const flowdeskChatMessageStallAlertOption =
	"chatMessageStallAlert" as const;

function chatMessageStallAlertOptionsFrom(
	options: PluginOptions | undefined,
	statusLiveConfig: FlowDeskStatusLiveConfigV1 | undefined,
	sdkClient?: FlowDeskManagedDispatchBetaOpenCodeClientV1,
): FlowDeskChatMessageStallAlertOptionsV1 | undefined {
	const raw = options?.[flowdeskChatMessageStallAlertOption];
	if (raw === false) return undefined;
	const recordRaw = isRecord(raw) ? raw : undefined;
	const explicitEnabled = recordRaw?.enabled === true || raw === true;
	const explicitDisabled = recordRaw?.enabled === false;
	if (explicitDisabled) return undefined;
	const explicitRoot =
		recordRaw !== undefined &&
		typeof recordRaw.rootDir === "string" &&
		recordRaw.rootDir.trim().length > 0
			? recordRaw.rootDir
			: undefined;
	const fallbackRoot =
		statusLiveConfig?.rootDir ?? durableStateRootFromOptions(options);
	const rootDir = explicitRoot ?? fallbackRoot;
	if (rootDir === undefined) return undefined;
	if (!explicitEnabled && statusLiveConfig === undefined) return undefined;
	const config: FlowDeskChatMessageStallAlertOptionsV1 = { rootDir };
	if (
		recordRaw !== undefined &&
		typeof recordRaw.maxWorkflows === "number" &&
		recordRaw.maxWorkflows > 0
	)
		config.maxWorkflows = Math.floor(recordRaw.maxWorkflows);
	if (
		recordRaw !== undefined &&
		typeof recordRaw.laneHeartbeatLateThresholdMs === "number" &&
		recordRaw.laneHeartbeatLateThresholdMs > 0
	)
		config.laneHeartbeatLateThresholdMs = Math.floor(
			recordRaw.laneHeartbeatLateThresholdMs,
		);
	if (
		recordRaw !== undefined &&
		typeof recordRaw.laneHeartbeatStallThresholdMs === "number" &&
		recordRaw.laneHeartbeatStallThresholdMs > 0
	)
		config.laneHeartbeatStallThresholdMs = Math.floor(
			recordRaw.laneHeartbeatStallThresholdMs,
		);
	if (
		recordRaw !== undefined &&
		typeof recordRaw.includeProgressingLate === "boolean"
	)
		config.includeProgressingLate = recordRaw.includeProgressingLate;
	if (
		recordRaw !== undefined &&
		typeof recordRaw.includeProgressCards === "boolean"
	)
		config.includeProgressCards = recordRaw.includeProgressCards;
	if (
		recordRaw !== undefined &&
		typeof recordRaw.maxProgressCards === "number" &&
		recordRaw.maxProgressCards > 0
	)
		config.maxProgressCards = Math.min(
			6,
			Math.max(1, Math.floor(recordRaw.maxProgressCards)),
		);
	if (recordRaw !== undefined && isRecord(recordRaw.guardedAutoAbort)) {
		const rawGuard = recordRaw.guardedAutoAbort;
		const guardedAutoAbort: FlowDeskChatMessageGuardedAutoAbortOptionsV1 = {
			autoAbortOnStall: rawGuard.autoAbortOnStall === true,
		};
		if (typeof rawGuard.preAbortWarningMs === "number" && rawGuard.preAbortWarningMs > 0)
			guardedAutoAbort.preAbortWarningMs = Math.floor(rawGuard.preAbortWarningMs);
		if (typeof rawGuard.guardSignOffPath === "string" && rawGuard.guardSignOffPath.trim().length > 0)
			guardedAutoAbort.guardSignOffPath = rawGuard.guardSignOffPath;
		if (typeof rawGuard.guardHmacKey === "string" && rawGuard.guardHmacKey.length > 0)
			guardedAutoAbort.guardHmacKey = rawGuard.guardHmacKey;
		if (typeof rawGuard.productionMode === "boolean")
			guardedAutoAbort.productionMode = rawGuard.productionMode;
		if (rawGuard.autoRetryAfterAbort === true)
			guardedAutoAbort.autoRetryAfterAbort = true;
		if (typeof rawGuard.maxAutoRetries === "number")
			guardedAutoAbort.maxAutoRetries = Math.min(2, Math.max(1, Math.floor(rawGuard.maxAutoRetries)));
		if (typeof rawGuard.useLiveSdkSessionHealth === "boolean")
			guardedAutoAbort.useLiveSdkSessionHealth = rawGuard.useLiveSdkSessionHealth;
		if (guardedAutoAbort.useLiveSdkSessionHealth === true && sdkClient !== undefined)
			guardedAutoAbort.sdkClient = sdkClient;
		if (isRecord(rawGuard.sdkSessionHealth)) {
			const status = rawGuard.sdkSessionHealth.status;
			if (status === "api_responsive") guardedAutoAbort.sdkSessionHealth = { status };
			if (status === "api_timeout")
				guardedAutoAbort.sdkSessionHealth = {
					status,
					reason:
						typeof rawGuard.sdkSessionHealth.reason === "string"
							? rawGuard.sdkSessionHealth.reason
							: "configured_api_timeout",
				};
			if (status === "unknown")
				guardedAutoAbort.sdkSessionHealth = {
					status,
					reason:
						typeof rawGuard.sdkSessionHealth.reason === "string"
							? rawGuard.sdkSessionHealth.reason
							: "configured_unknown",
				};
		}
		config.guardedAutoAbort = guardedAutoAbort;
	}
	return config;
}

export const flowdeskOpenCodeServerPlugin = {
	id: flowdeskPluginId,
	server: flowdeskServerPlugin,
} satisfies PluginModule;

export default flowdeskOpenCodeServerPlugin;
