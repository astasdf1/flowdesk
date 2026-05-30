import { createHash } from "node:crypto";
import {
	existsSync,
	lstatSync,
	mkdirSync,
	readFileSync,
	renameSync,
	rmSync,
	writeFileSync,
} from "node:fs";
import { dirname, resolve, sep } from "node:path";
import type {
	FlowDeskControlledConformanceDocWriteRecordV1,
	FlowDeskControlledExternalWriteRequestV1,
	FlowDeskControlledRedactedAuditExportWriteRecordV1,
	FlowDeskDispatchAttemptManifestV1,
	FlowDeskDispatchIdempotencySnapshotV1,
	FlowDeskExactModelAvailabilityCacheAcquisitionPlanV1,
	FlowDeskExactModelAvailabilityCacheProviderAcquisitionResultV1,
	FlowDeskFallbackDecisionV1,
	FlowDeskFallbackRegatePlanV1,
	FlowDeskLaneLifecycleRecordV1,
	FlowDeskPermissionAskDecisionV1,
	FlowDeskProductionApprovalSourceV1,
	FlowDeskPromptNoReplyDecisionV1,
	FlowDeskRuntimeLaneLaunchPlanV1,
	FlowDeskSessionAbortDecisionV1,
	FlowDeskSessionEvidenceReloadResultV1,
	FlowDeskTopTierReviewPerspective,
	FlowDeskTopTierReviewVerdictV1,
	GuardBoundaryDecisionV1,
	ManagedDispatchBetaBoundaryInputV1,
} from "@flowdesk/core";
import {
	applyFlowDeskSessionEvidenceWriteIntentsV1,
	evaluateFlowDeskDispatchAttemptDurablePrecallV1,
	evaluateManagedDispatchBetaGuardBoundaryV1,
	planFlowDeskFallbackRegateV1,
	prepareFlowDeskDispatchIdempotencyReservationV1,
	prepareFlowDeskDispatchIdempotencyStateUpdateV1,
	prepareFlowDeskSessionEvidenceWriteIntentV1,
	promoteFlowDeskExternalWriteAuthorityV1,
	promoteFlowDeskFallbackReselectionRegateV1,
	promoteFlowDeskManagedDispatchBetaAuthorityV1,
	promoteFlowDeskReviewerTypedVerdictsV1,
	recordFlowDeskExactModelAvailabilityCacheProviderAcquisitionResultV1,
	reloadFlowDeskSessionEvidenceV1,
	validateFlowDeskExactModelAvailabilityCacheAcquisitionPlanV1,
	validateFlowDeskFallbackRegatePlanV1,
	validateFlowDeskProductionApprovalSourceV1,
	validateFlowDeskPermissionAskDecisionV1,
	validateFlowDeskPromptNoReplyDecisionV1,
	validateFlowDeskRuntimeLaneLaunchPlanV1,
	planFlowDeskRuntimeLaneLaunchV1,
	validateFlowDeskSessionAbortDecisionV1,
	validateNoForbiddenRawPayloads,
	validateTopTierReviewVerdictV1,
	FLOWDESK_TOP_TIER_REVIEW_PERSPECTIVES,
} from "@flowdesk/core";

export const flowdeskManagedDispatchBetaAdapterProfile =
	"managed_dispatch_beta_real_opencode_dispatch_adapter" as const;

export type FlowDeskManagedDispatchBetaDispatchMethodV1 =
	| "promptAsync"
	| "prompt";
export type FlowDeskManagedDispatchBetaDispatchStatusV1 =
	| "blocked_before_dispatch"
	| "dispatch_accepted"
	| "dispatch_completed"
	| "dispatch_failed";

export interface FlowDeskManagedDispatchBetaDispatchRequestV1 {
	sessionId: string;
	agent: string;
	provider_qualified_model_id: string;
	promptText?: string;
	promptSummary?: string;
	directory?: string;
	dispatchMethod?: FlowDeskManagedDispatchBetaDispatchMethodV1;
	dispatchMode?: "prompt" | "lane_launch";
	allowActualLaneLaunch?: boolean;
	laneId?: string;
	launchRequestId?: string;
	laneTitle?: string;
}

export interface FlowDeskManagedDispatchBetaAuthoritySummaryV1 {
	realOpenCodeDispatch: boolean;
	providerCall: boolean;
	runtimeExecution: boolean;
	actualLaneLaunch: boolean;
	fallbackAuthority: false;
	toolAuthority: false;
	hardCancelOrNoReplyAuthority: false;
}

export interface FlowDeskFallbackReselectionRegateAdapterResultV1 {
	adapterProfile: "fallback_reselection_regate_adapter";
	status: "regate_required" | "blocked_before_regate";
	dispatchAttempted: false;
	workflowId?: string;
	parentAttemptId?: string;
	newAttemptId?: string;
	fromProviderQualifiedModelId?: string;
	toProviderQualifiedModelId?: string;
	redactedBlockReason?: string;
	safeNextActions: ["/flowdesk-status", "/flowdesk-run"] | ["/flowdesk-status"];
	authority: FlowDeskManagedDispatchBetaAuthoritySummaryV1 & {
		automaticFallbackAuthorized: false;
	};
}

export interface FlowDeskManagedFallbackRegateOrchestratorResultV1 {
	adapterProfile: "managed_fallback_regate_orchestrator";
	status: "regate_plan_ready" | "blocked_before_regate_plan";
	dispatchAttempted: false;
	providerSwitchAttempted: false;
	sdkCallAttempted: false;
	workflowId?: string;
	parentAttemptId?: string;
	newAttemptId?: string;
	fromProviderQualifiedModelId?: string;
	toProviderQualifiedModelId?: string;
	regatePlan?: FlowDeskFallbackRegatePlanV1;
	redactedBlockReason?: string;
	safeNextActions: ["/flowdesk-status", "/flowdesk-run"] | ["/flowdesk-status"];
	authority: FlowDeskManagedDispatchBetaAuthoritySummaryV1 & {
		freshRegatePlanPrepared: boolean;
		automaticFallbackAuthorized: false;
	};
}

export interface FlowDeskControlledExternalWriteAdapterResultV1 {
	adapterProfile: "controlled_external_write_adapter";
	status: "write_ready" | "blocked_before_write";
	writeAttempted: false;
	workflowId?: string;
	attemptId?: string;
	targetKind?: FlowDeskControlledExternalWriteRequestV1["target_kind"];
	targetRef?: string;
	redactedBlockReason?: string;
	safeNextActions:
		| ["/flowdesk-status", "/flowdesk-export-debug"]
		| ["/flowdesk-status"];
	authority: FlowDeskManagedDispatchBetaAuthoritySummaryV1 & {
		controlledExternalWriteAuthorized: boolean;
	};
}

export interface FlowDeskExactModelProviderAcquisitionClientRequestV1 {
	provider_family: FlowDeskExactModelAvailabilityCacheProviderAcquisitionResultV1["provider_family"];
	provider_identity_ref: string;
	provider_qualified_model_id: string;
	model_family: string;
	active_profile_ref: string;
	auth_account_boundary_ref: string;
	live_test_run_ref: string;
	redaction_proof_ref: string;
}

export interface FlowDeskExactModelProviderAcquisitionClientResultV1 {
	outcome: "available" | "unavailable" | "blocked";
	sanitized_provider_result_ref?: string;
	availability_ref?: string;
	highest_tier_eligible?: boolean;
	blocked_labels?: string[];
	provider_call_confirmed?: boolean;
}

export interface FlowDeskExactModelProviderAcquisitionClientV1 {
	checkExactModelAvailability(
		request: FlowDeskExactModelProviderAcquisitionClientRequestV1,
	): Promise<FlowDeskExactModelProviderAcquisitionClientResultV1> | FlowDeskExactModelProviderAcquisitionClientResultV1;
}

export interface FlowDeskOpenCodeMetadataProviderAcquisitionClientOptionsV1 {
	client: unknown;
	directory?: string;
	workspace?: string;
}

export interface FlowDeskOpenCodePromptBackedProviderAcquisitionClientOptionsV1 extends FlowDeskOpenCodeMetadataProviderAcquisitionClientOptionsV1 {
	allowProviderCall: boolean;
	allowedProviderQualifiedModelIds: readonly string[];
	sessionId?: string;
	agent?: string;
}

interface FlowDeskOpenCodeMetadataProviderSurfaceV1 {
	config?: {
		providers?(parameters?: { directory?: string; workspace?: string }): unknown;
	};
	provider?: {
		list?(parameters?: { directory?: string; workspace?: string }): unknown;
		auth?(parameters?: { directory?: string; workspace?: string }): unknown;
	};
	session?: {
		prompt?(options: FlowDeskManagedDispatchBetaPromptOptionsV1): unknown;
		promptAsync?(options: FlowDeskManagedDispatchBetaPromptOptionsV1): unknown;
	};
}

export interface FlowDeskExactModelProviderAcquisitionLiveTestRequestV1 {
	workflowId: string;
	evidenceId: string;
	acquisitionPlan: FlowDeskExactModelAvailabilityCacheAcquisitionPlanV1;
	resultId: string;
	localDate: string;
	activeProfileRef: string;
	opencodeVersionRef: string;
	flowdeskPackageVersionRef: string;
	registryHash: string;
	policyPackHash: string;
	authAccountBoundaryRef: string;
	providerFamily: FlowDeskExactModelAvailabilityCacheProviderAcquisitionResultV1["provider_family"];
	providerIdentityRef: string;
	providerQualifiedModelId: string;
	modelFamily: string;
	availabilityRef: string;
	preCallAuditRef: string;
	idempotencyRef: string;
	liveTestRunRef: string;
	redactionProofRef: string;
	observedAt: string;
}

export interface FlowDeskExactModelProviderAcquisitionLiveTestResultV1 {
	adapterProfile: "exact_model_provider_acquisition_live_test_adapter";
	status:
		| "provider_acquisition_recorded"
		| "provider_acquisition_blocked"
		| "blocked_before_provider_acquisition";
	providerCallAttempted: boolean;
	writeAttempted: boolean;
	evidenceReloaded: boolean;
	workflowId?: string;
	evidenceId?: string;
	resultId?: string;
	providerQualifiedModelId?: string;
	redactedBlockReason?: string;
	result?: FlowDeskExactModelAvailabilityCacheProviderAcquisitionResultV1;
	safeNextActions: ["/flowdesk-status"];
	authority: FlowDeskManagedDispatchBetaAuthoritySummaryV1 & {
		exactModelProviderAcquisitionRecorded: boolean;
		reviewerLaunchAuthorized: false;
		dispatchAuthorityEnabled: false;
	};
}

export interface FlowDeskReviewerTypedVerdictAcceptanceAdapterResultV1 {
	adapterProfile: "reviewer_typed_verdict_acceptance_adapter";
	status: "verdicts_accepted" | "blocked_before_acceptance";
	workflowId: string;
	attemptId: string;
	acceptedVerdictIds: string[];
	acceptedPerspectives: string[];
	redactedBlockReason?: string;
	safeNextActions: ["/flowdesk-status", "/flowdesk-run"] | ["/flowdesk-status"];
	authority: FlowDeskManagedDispatchBetaAuthoritySummaryV1 & {
		typedReviewerVerdictsAccepted: boolean;
	};
}

export interface FlowDeskDurableReviewerVerdictLinkageAdapterResultV1 {
	adapterProfile: "durable_reviewer_verdict_linkage_adapter";
	status: "durable_verdicts_accepted" | "blocked_before_durable_acceptance";
	workflowId: string;
	attemptId: string;
	linkedVerdictIds: string[];
	linkedLifecycleRefs: string[];
	redactedBlockReason?: string;
	safeNextActions: ["/flowdesk-status", "/flowdesk-run"] | ["/flowdesk-status"];
	authority: FlowDeskManagedDispatchBetaAuthoritySummaryV1 & {
		typedReviewerVerdictsAccepted: boolean;
		durableReviewerVerdictEvidenceLinked: boolean;
	};
}

export interface FlowDeskObservedReviewerVerdictEvidenceMaterializationResultV1 {
	adapterProfile: "observed_reviewer_verdict_evidence_materializer";
	status: "verdict_evidence_recorded" | "blocked_before_verdict_evidence";
	writeAttempted: boolean;
	workflowId: string;
	sessionRef: string;
	lanePlanRef: string;
	bindingRef: string;
	perspective: FlowDeskTopTierReviewPerspective;
	verdictId?: string;
	evidenceId?: string;
	evidenceReloaded: boolean;
	redactedBlockReason?: string;
	safeNextActions: ["/flowdesk-status"];
	authority: FlowDeskManagedDispatchBetaAuthoritySummaryV1 & {
		typedReviewerVerdictPersisted: boolean;
		typedReviewerVerdictsAccepted: false;
		durableReviewerVerdictEvidenceLinked: false;
	};
}

export interface FlowDeskControlledConformanceDocLocalWriterResultV1 {
	adapterProfile: "controlled_conformance_doc_local_writer";
	status: "write_recorded" | "blocked_before_local_write";
	workflowId?: string;
	attemptId?: string;
	targetKind?: "release_conformance_doc";
	targetRef?: string;
	writeAttempted: boolean;
	documentPath?: string;
	ledgerEntryId?: string;
	ledgerEvidenceReloaded: boolean;
	artifactSha256Ref?: string;
	redactedBlockReason?: string;
	safeNextActions:
		| ["/flowdesk-status", "/flowdesk-export-debug"]
		| ["/flowdesk-status"];
	authority: FlowDeskManagedDispatchBetaAuthoritySummaryV1 & {
		controlledExternalWriteAuthorized: boolean;
		localConformanceDocWriteRecorded: boolean;
		remoteWriteAttempted: false;
		githubWriteAttempted: false;
		connectorWriteAttempted: false;
		storageWriteAttempted: false;
		databaseWriteAttempted: false;
		urlWriteAttempted: false;
		rawPathWriteAttempted: false;
	};
}

export interface FlowDeskControlledRedactedAuditExportLocalWriterResultV1 {
	adapterProfile: "controlled_redacted_audit_export_local_writer";
	status: "write_recorded" | "blocked_before_local_write";
	workflowId?: string;
	attemptId?: string;
	targetKind?: "redacted_audit_export";
	targetRef?: string;
	writeAttempted: boolean;
	exportPath?: string;
	ledgerEntryId?: string;
	ledgerEvidenceReloaded: boolean;
	artifactSha256Ref?: string;
	redactedBlockReason?: string;
	safeNextActions:
		| ["/flowdesk-status", "/flowdesk-export-debug"]
		| ["/flowdesk-status"];
	authority: FlowDeskManagedDispatchBetaAuthoritySummaryV1 & {
		controlledExternalWriteAuthorized: boolean;
		localRedactedAuditExportWriteRecorded: boolean;
		remoteWriteAttempted: false;
		githubWriteAttempted: false;
		connectorWriteAttempted: false;
		storageWriteAttempted: false;
		databaseWriteAttempted: false;
		urlWriteAttempted: false;
		rawPathWriteAttempted: false;
	};
}

export interface FlowDeskPermissionAskControlAdapterResultV1 {
	adapterProfile: "permission_ask_control_adapter";
	status: "permission_status_applied" | "blocked_before_permission_status";
	permissionStatusApplied: boolean;
	permissionStatus?: "ask" | "deny" | "allow";
	workflowId?: string;
	attemptId?: string;
	redactedBlockReason?: string;
	authority: FlowDeskManagedDispatchBetaAuthoritySummaryV1 & {
		permissionAskStatusControlAuthorized: boolean;
	};
}

export interface FlowDeskSessionAbortControlAdapterResultV1 {
	adapterProfile: "session_abort_control_adapter";
	status: "session_abort_sent" | "blocked_before_session_abort";
	abortAttempted: boolean;
	workflowId?: string;
	attemptId?: string;
	sessionRef?: string;
	response?: unknown;
	redactedBlockReason?: string;
	authority: FlowDeskManagedDispatchBetaAuthoritySummaryV1 & {
		sessionAbortAuthorized: boolean;
	};
}

export interface FlowDeskPromptNoReplyControlAdapterResultV1 {
	adapterProfile: "prompt_no_reply_control_adapter";
	status: "no_reply_prompt_sent" | "blocked_before_no_reply_prompt";
	promptAttempted: boolean;
	workflowId?: string;
	attemptId?: string;
	sessionRef?: string;
	agent?: string;
	model?: { providerID: string; modelID: string };
	response?: unknown;
	redactedBlockReason?: string;
	authority: FlowDeskManagedDispatchBetaAuthoritySummaryV1 & {
		promptNoReplyAuthorized: boolean;
	};
}

export interface FlowDeskManagedDispatchBetaVerificationStatusV1 {
	ambiguityQuarantined: boolean;
	configuredVerificationRef?: string;
	preDispatchAuditRef?: string;
	defaultRelease1ServerBehaviorUnchanged: true;
}

export interface FlowDeskManagedDispatchBetaBlockedResultV1 {
	adapterProfile: typeof flowdeskManagedDispatchBetaAdapterProfile;
	status: "blocked_before_dispatch";
	dispatchAttempted: false;
	guardDecision: GuardBoundaryDecisionV1;
	redactedBlockReason: string;
	authority: FlowDeskManagedDispatchBetaAuthoritySummaryV1;
	verification: FlowDeskManagedDispatchBetaVerificationStatusV1;
}

export interface FlowDeskManagedDispatchBetaDispatchResultV1 {
	adapterProfile: typeof flowdeskManagedDispatchBetaAdapterProfile;
	status: "dispatch_accepted" | "dispatch_completed";
	dispatchAttempted: true;
	dispatchMethod: FlowDeskManagedDispatchBetaDispatchMethodV1;
	guardDecision: GuardBoundaryDecisionV1;
	sessionId: string;
	agent: string;
	model: {
		providerID: string;
		modelID: string;
	};
	directory?: string;
	laneId?: string;
	childSessionRef?: string;
	messageRef?: string;
	response?: unknown;
	authority: FlowDeskManagedDispatchBetaAuthoritySummaryV1;
	verification: FlowDeskManagedDispatchBetaVerificationStatusV1;
}

export interface FlowDeskManagedDispatchBetaDispatchFailedResultV1 {
	adapterProfile: typeof flowdeskManagedDispatchBetaAdapterProfile;
	status: "dispatch_failed";
	dispatchAttempted: true;
	dispatchMethod: FlowDeskManagedDispatchBetaDispatchMethodV1;
	guardDecision: GuardBoundaryDecisionV1;
	sessionId: string;
	agent: string;
	model: {
		providerID: string;
		modelID: string;
	};
	directory?: string;
	redactedErrorCategory: "provider_api" | "runtime" | "unknown";
	authority: FlowDeskManagedDispatchBetaAuthoritySummaryV1;
	verification: FlowDeskManagedDispatchBetaVerificationStatusV1;
}

export type FlowDeskManagedDispatchBetaAdapterResultV1 =
	| FlowDeskManagedDispatchBetaBlockedResultV1
	| FlowDeskManagedDispatchBetaDispatchResultV1
	| FlowDeskManagedDispatchBetaDispatchFailedResultV1;

export interface FlowDeskManagedDispatchBetaPromptOptionsV1 {
	path: { id: string };
	query?: { directory?: string };
	body: {
		model: { providerID: string; modelID: string };
		agent: string;
		noReply?: boolean;
		parts: Array<{ type: "text"; text: string }>;
	};
}

export type FlowDeskRuntimeLaneLaunchDispatchMethodV1 = "promptAsync" | "prompt";

export interface FlowDeskInjectedSdkRuntimeLaneLaunchRequestV1 {
	allowActualLaneLaunch: boolean;
	parentSessionId: string;
	promptText: string;
	directory?: string;
	dispatchMethod?: FlowDeskRuntimeLaneLaunchDispatchMethodV1;
	title?: string;
}

export interface FlowDeskInjectedSdkRuntimeLaneLaunchResultV1 {
	adapterProfile: "injected_sdk_runtime_lane_launch_adapter";
	status:
		| "lane_launch_started"
		| "blocked_before_lane_launch"
		| "lane_launch_failed";
	createAttempted: boolean;
	promptAttempted: boolean;
	workflowId?: string;
	attemptId?: string;
	laneId?: string;
	parentSessionRef?: string;
	childSessionRef?: string;
	messageRef?: string;
	agent?: string;
	model?: { providerID: string; modelID: string };
	dispatchMethod?: FlowDeskRuntimeLaneLaunchDispatchMethodV1;
	redactedBlockReason?: string;
	redactedErrorCategory?: "runtime" | "provider_api" | "unknown";
	safeNextActions: ["/flowdesk-status"] | ["/flowdesk-status", "/flowdesk-export-debug"];
	authority: FlowDeskManagedDispatchBetaAuthoritySummaryV1 & {
		runtimeLaneLaunchAuthorized: boolean;
		defaultRelease1ServerBehaviorUnchanged: true;
	};
}

export interface FlowDeskRuntimeLaneLaunchLifecycleMaterializationResultV1 {
	adapterProfile: "runtime_lane_launch_lifecycle_materializer";
	status: "lane_lifecycle_recorded" | "blocked_before_lane_lifecycle";
	writeAttempted: boolean;
	evidenceReloaded: boolean;
	workflowId?: string;
	attemptId?: string;
	laneId?: string;
	evidenceId?: string;
	lifecycleState?: FlowDeskLaneLifecycleRecordV1["state"];
	redactedBlockReason?: string;
	safeNextActions: ["/flowdesk-status"] | ["/flowdesk-status", "/flowdesk-export-debug"];
	authority: FlowDeskManagedDispatchBetaAuthoritySummaryV1 & {
		runtimeLaneLifecyclePersisted: boolean;
		defaultRelease1ServerBehaviorUnchanged: true;
	};
}

export interface FlowDeskManagedDispatchBetaOpenCodeClientV1 {
	session: {
		create?(options: {
			body: { parentID: string; title?: string };
		}): unknown | Promise<unknown>;
		prompt?(
			options: FlowDeskManagedDispatchBetaPromptOptionsV1,
		): unknown | Promise<unknown>;
		promptAsync?(
			options: FlowDeskManagedDispatchBetaPromptOptionsV1,
		): unknown | Promise<unknown>;
		abort?(options: {
			path: { id: string };
			query?: { directory?: string };
		}): unknown | Promise<unknown>;
		children?(options: {
			path: { id: string };
			query?: { directory?: string };
		}): unknown | Promise<unknown>;
		messages?(options: {
			path: { id: string };
			query?: { directory?: string };
		}): unknown | Promise<unknown>;
	};
}

export interface FlowDeskManagedDispatchBetaReservationStoreResultV1 {
	ok: boolean;
	reservationEvidenceReloaded: boolean;
	redactedFailureReason?: string;
}

export interface FlowDeskManagedDispatchBetaReservationStoreV1 {
	reserve(input: {
		manifest: FlowDeskDispatchAttemptManifestV1;
		reloadedEvidence: FlowDeskSessionEvidenceReloadResultV1;
	}):
		| Promise<FlowDeskManagedDispatchBetaReservationStoreResultV1>
		| FlowDeskManagedDispatchBetaReservationStoreResultV1;
	recordDispatchCompleted?(input: {
		manifest: FlowDeskDispatchAttemptManifestV1;
		reloadedEvidence: FlowDeskSessionEvidenceReloadResultV1;
	}):
		| Promise<FlowDeskManagedDispatchBetaReservationStoreResultV1>
		| FlowDeskManagedDispatchBetaReservationStoreResultV1;
	recordDispatchFailure(input: {
		manifest: FlowDeskDispatchAttemptManifestV1;
		reloadedEvidence: FlowDeskSessionEvidenceReloadResultV1;
	}):
		| Promise<FlowDeskManagedDispatchBetaReservationStoreResultV1>
		| FlowDeskManagedDispatchBetaReservationStoreResultV1;
}

export interface FlowDeskManagedDispatchBetaDurableReservationStoreOptionsV1 {
	rootDir: string;
	now?: () => Date;
}

export interface FlowDeskInjectedSdkLaneObservationRequestV1 {
	parentSessionId: string;
	laneId: string;
	requestedAgent: string;
	requestedProviderQualifiedModelId: string;
	directory?: string;
}

export interface FlowDeskInjectedSdkLaneObservationResultV1 {
	adapterProfile: "injected_sdk_lane_observation_probe";
	status:
		| "observed"
		| "partial"
		| "observation_unavailable"
		| "observation_failed";
	observationAttempted: boolean;
	parentSessionRef: string;
	laneId: string;
	requestedAgentRef: string;
	requestedModelRef: string;
	childSessionRef?: string;
	messageRef?: string;
	observedAgentRef?: string;
	observedModelRef?: string;
	missingLabels: string[];
	authority: FlowDeskManagedDispatchBetaAuthoritySummaryV1;
}

export interface FlowDeskInjectedSdkReviewerVerdictObservationRequestV1 {
	sessionId: string;
	workflowId: string;
	lanePlanRef: string;
	bindingRef: string;
	perspective: FlowDeskTopTierReviewPerspective;
	directory?: string;
	messagesResponse?: unknown;
}

export interface FlowDeskInjectedSdkReviewerVerdictObservationResultV1 {
	adapterProfile: "injected_sdk_reviewer_verdict_observation";
	status:
		| "verdict_observed"
		| "missing_verdict"
		| "invalid_verdict"
		| "observation_unavailable"
		| "observation_failed";
	observationAttempted: boolean;
	sessionRef: string;
	workflowId: string;
	lanePlanRef: string;
	bindingRef: string;
	perspective: FlowDeskTopTierReviewPerspective;
	verdictId?: string;
	verdict?: FlowDeskTopTierReviewVerdictV1;
	redactedErrors: string[];
	authority: FlowDeskManagedDispatchBetaAuthoritySummaryV1;
}

function disabledAuthority(): FlowDeskManagedDispatchBetaAuthoritySummaryV1 {
	return {
		realOpenCodeDispatch: false,
		providerCall: false,
		runtimeExecution: false,
		actualLaneLaunch: false,
		fallbackAuthority: false,
		toolAuthority: false,
		hardCancelOrNoReplyAuthority: false,
	};
}

function disabledFallbackAuthority(): FlowDeskFallbackReselectionRegateAdapterResultV1["authority"] {
	return { ...disabledAuthority(), automaticFallbackAuthorized: false };
}

function managedFallbackRegateAuthority(
	prepared: boolean,
): FlowDeskManagedFallbackRegateOrchestratorResultV1["authority"] {
	return {
		...disabledAuthority(),
		freshRegatePlanPrepared: prepared,
		automaticFallbackAuthorized: false,
	};
}

function controlledExternalWriteAuthority(
	authorized: boolean,
): FlowDeskControlledExternalWriteAdapterResultV1["authority"] {
	return {
		...disabledAuthority(),
		controlledExternalWriteAuthorized: authorized,
	};
}

function exactModelProviderAcquisitionAuthority(
	recorded: boolean,
): FlowDeskExactModelProviderAcquisitionLiveTestResultV1["authority"] {
	return {
		...disabledAuthority(),
		exactModelProviderAcquisitionRecorded: recorded,
		reviewerLaunchAuthorized: false,
		dispatchAuthorityEnabled: false,
	};
}

function runtimeLaneLaunchAuthority(
	authorized: boolean,
): FlowDeskInjectedSdkRuntimeLaneLaunchResultV1["authority"] {
	return {
		...disabledAuthority(),
		providerCall: authorized,
		runtimeExecution: authorized,
		actualLaneLaunch: authorized,
		runtimeLaneLaunchAuthorized: authorized,
		defaultRelease1ServerBehaviorUnchanged: true,
	};
}

function blockedRuntimeLaneLaunch(
	redactedBlockReason: string,
	plan?: Partial<FlowDeskRuntimeLaneLaunchPlanV1>,
): FlowDeskInjectedSdkRuntimeLaneLaunchResultV1 {
	return {
		adapterProfile: "injected_sdk_runtime_lane_launch_adapter",
		status: "blocked_before_lane_launch",
		createAttempted: false,
		promptAttempted: false,
		...(plan?.workflow_id === undefined ? {} : { workflowId: plan.workflow_id }),
		...(plan?.attempt_id === undefined ? {} : { attemptId: plan.attempt_id }),
		...(plan?.lane_id === undefined ? {} : { laneId: plan.lane_id }),
		...(plan?.parent_session_ref === undefined
			? {}
			: { parentSessionRef: plan.parent_session_ref }),
		redactedBlockReason,
		safeNextActions: ["/flowdesk-status", "/flowdesk-export-debug"],
		authority: runtimeLaneLaunchAuthority(false),
	};
}

function runtimeLaneLaunchLifecycleAuthority(
	persisted: boolean,
): FlowDeskRuntimeLaneLaunchLifecycleMaterializationResultV1["authority"] {
	return {
		...disabledAuthority(),
		runtimeLaneLifecyclePersisted: persisted,
		defaultRelease1ServerBehaviorUnchanged: true,
	};
}

function blockRuntimeLaneLaunchLifecycle(input: {
	plan?: Partial<FlowDeskRuntimeLaneLaunchPlanV1>;
	evidenceId?: string;
	reason: string;
	evidenceReloaded?: boolean;
}): FlowDeskRuntimeLaneLaunchLifecycleMaterializationResultV1 {
	return {
		adapterProfile: "runtime_lane_launch_lifecycle_materializer",
		status: "blocked_before_lane_lifecycle",
		writeAttempted: false,
		evidenceReloaded: input.evidenceReloaded ?? false,
		...(input.plan?.workflow_id === undefined
			? {}
			: { workflowId: input.plan.workflow_id }),
		...(input.plan?.attempt_id === undefined
			? {}
			: { attemptId: input.plan.attempt_id }),
		...(input.plan?.lane_id === undefined ? {} : { laneId: input.plan.lane_id }),
		...(input.evidenceId === undefined ? {} : { evidenceId: input.evidenceId }),
		redactedBlockReason: input.reason,
		safeNextActions: ["/flowdesk-status", "/flowdesk-export-debug"],
		authority: runtimeLaneLaunchLifecycleAuthority(false),
	};
}

function blockedExactModelProviderAcquisition(
	reason: string,
	input?: Partial<FlowDeskExactModelProviderAcquisitionLiveTestRequestV1>,
): FlowDeskExactModelProviderAcquisitionLiveTestResultV1 {
	return {
		adapterProfile: "exact_model_provider_acquisition_live_test_adapter",
		status: "blocked_before_provider_acquisition",
		providerCallAttempted: false,
		writeAttempted: false,
		evidenceReloaded: false,
		workflowId: input?.workflowId,
		evidenceId: input?.evidenceId,
		resultId: input?.resultId,
		providerQualifiedModelId: input?.providerQualifiedModelId,
		redactedBlockReason: reason,
		safeNextActions: ["/flowdesk-status"],
		authority: exactModelProviderAcquisitionAuthority(false),
	};
}

function opencodeMetadataCallParameters(input: {
	directory?: string;
	workspace?: string;
}): { directory?: string; workspace?: string } | undefined {
	const parameters = {
		...(typeof input.directory === "string" && input.directory.trim().length > 0
			? { directory: input.directory }
			: {}),
		...(typeof input.workspace === "string" && input.workspace.trim().length > 0
			? { workspace: input.workspace }
			: {}),
	};
	return Object.keys(parameters).length > 0 ? parameters : undefined;
}

function opencodeProvidersFromConfig(value: unknown): unknown[] | undefined {
	const record = asRecord(responseData(value));
	return Array.isArray(record?.providers) ? record.providers : undefined;
}

function opencodeProvidersFromList(value: unknown): unknown[] | undefined {
	const record = asRecord(responseData(value));
	return Array.isArray(record?.all) ? record.all : undefined;
}

function opencodeConnectedProviderIds(value: unknown): string[] | undefined {
	const record = asRecord(responseData(value));
	if (!Array.isArray(record?.connected)) return undefined;
	return record.connected.every((item) => typeof item === "string")
		? record.connected
		: undefined;
}

function opencodeProviderAuthMethodTypes(
	value: unknown,
	providerID: string,
): string[] | undefined {
	const methods = asRecord(responseData(value))?.[providerID];
	if (!Array.isArray(methods) || methods.length === 0) return undefined;
	const types = methods.map((method) => asRecord(method)?.type);
	return types.every((type) => type === "api" || type === "oauth")
		? (types as string[])
		: undefined;
}

function opencodeProviderById(
	providers: readonly unknown[],
	providerID: string,
): Record<string, unknown> | undefined {
	return providers
		.map(asRecord)
		.find((provider) => provider?.id === providerID);
}

function opencodeProviderHasModel(
	provider: Record<string, unknown> | undefined,
	modelID: string,
): boolean {
	const models = asRecord(provider?.models);
	return models !== undefined && asRecord(models[modelID]) !== undefined;
}

function unavailableMetadataResult(
	labels: string[],
): FlowDeskExactModelProviderAcquisitionClientResultV1 {
	return {
		outcome: "blocked",
		blocked_labels: labels,
		provider_call_confirmed: false,
	};
}

const flowdeskExactModelProviderAcquisitionSentinelPromptV1 =
	"FlowDesk exact-model provider acquisition sentinel. Return a short acknowledgement only.";

function providerAcquisitionPromptOptions(input: {
	request: FlowDeskExactModelProviderAcquisitionClientRequestV1;
	model: { providerID: string; modelID: string };
	sessionId?: string;
	agent?: string;
	directory?: string;
}): FlowDeskManagedDispatchBetaPromptOptionsV1 {
	const sessionId = input.sessionId?.trim() || input.request.live_test_run_ref;
	return {
		path: { id: sessionId },
		...(input.directory === undefined
			? {}
			: { query: { directory: input.directory } }),
		body: {
			model: input.model,
			agent: input.agent?.trim() || "general",
			parts: [{ type: "text", text: flowdeskExactModelProviderAcquisitionSentinelPromptV1 }],
		},
	};
}

function providerAcquisitionDuplicateLabels(input: {
	request: FlowDeskExactModelProviderAcquisitionLiveTestRequestV1;
	rootDir: string;
}): { ok: true } | { ok: false; reason: string } {
	const reloaded = reloadFlowDeskSessionEvidenceV1({
		workflowId: input.request.workflowId,
		rootDir: input.rootDir,
	});
	if (!reloaded.ok || reloaded.blocked.length > 0) {
		return {
			ok: false,
			reason:
				"Exact-model provider acquisition live-test requires reloadable durable evidence before any provider call.",
		};
	}
	for (const entry of reloaded.entries) {
		if (
			entry.evidenceClass !==
			"exact_model_availability_cache_provider_acquisition_result"
		) {
			continue;
		}
		const record =
			entry.record as unknown as FlowDeskExactModelAvailabilityCacheProviderAcquisitionResultV1;
		if (
			record.live_test_run_ref === input.request.liveTestRunRef ||
			record.idempotency_ref === input.request.idempotencyRef
		) {
			return {
				ok: false,
				reason:
					"Exact-model provider acquisition live-test duplicate idempotency evidence blocks before any provider call.",
			};
		}
	}
	return { ok: true };
}

export function createFlowDeskOpenCodeMetadataProviderAcquisitionClientV1(
	options: FlowDeskOpenCodeMetadataProviderAcquisitionClientOptionsV1,
): FlowDeskExactModelProviderAcquisitionClientV1 | undefined {
	const client = asRecord(options.client) as
		| FlowDeskOpenCodeMetadataProviderSurfaceV1
		| undefined;
	if (client === undefined) return undefined;
	return {
		async checkExactModelAvailability(request) {
			const model = parseProviderQualifiedModelId(
				request.provider_qualified_model_id,
			);
			const providerID = opencodeRuntimeProviderIDForFlowDeskProviderFamily(
				request.provider_family,
			);
			if (
				model === undefined ||
				providerID === undefined ||
				model.providerID !== request.provider_family
			) {
				return unavailableMetadataResult([
					"opencode_provider_mapping_missing",
				]);
			}
			if (
				typeof client.config?.providers !== "function" ||
				typeof client.provider?.list !== "function" ||
				typeof client.provider?.auth !== "function"
			) {
				return unavailableMetadataResult([
					"opencode_metadata_surface_missing",
				]);
			}

			const callParameters = opencodeMetadataCallParameters(options);
			let configProvidersResponse: unknown;
			let providerListResponse: unknown;
			let providerAuthResponse: unknown;
			try {
				[configProvidersResponse, providerListResponse, providerAuthResponse] = await Promise.all([
					client.config.providers.call(client.config, callParameters),
					client.provider.list.call(client.provider, callParameters),
					client.provider.auth.call(client.provider, callParameters),
				]);
			} catch {
				return unavailableMetadataResult([
					"opencode_metadata_query_failed",
				]);
			}
			const configProviders = opencodeProvidersFromConfig(configProvidersResponse);
			const listedProviders = opencodeProvidersFromList(providerListResponse);
			const connectedProviderIds = opencodeConnectedProviderIds(providerListResponse);
			const authMethodTypes = opencodeProviderAuthMethodTypes(
				providerAuthResponse,
				providerID,
			);
			if (configProviders === undefined)
				return unavailableMetadataResult([
					"opencode_config_providers_missing",
				]);
			if (listedProviders === undefined)
				return unavailableMetadataResult([
					"opencode_provider_list_missing",
				]);
			if (connectedProviderIds === undefined || authMethodTypes === undefined)
				return unavailableMetadataResult([
					"opencode_provider_auth_missing",
				]);

			const configProvider = opencodeProviderById(configProviders, providerID);
			const listedProvider = opencodeProviderById(listedProviders, providerID);
			if (configProvider === undefined || listedProvider === undefined)
				return unavailableMetadataResult([
					"opencode_provider_metadata_missing",
				]);
			if (
				!opencodeProviderHasModel(configProvider, model.modelID) ||
				!opencodeProviderHasModel(listedProvider, model.modelID)
			) {
				return unavailableMetadataResult([
					"opencode_provider_model_missing",
				]);
			}
			if (!connectedProviderIds.includes(providerID))
				return unavailableMetadataResult([
					"opencode_provider_auth_missing",
				]);

			const sanitizedFacts = {
				providerID,
				modelID: model.modelID,
				authMethodTypes,
			};
			const sanitized = validateNoForbiddenRawPayloads(
				sanitizedFacts,
				"opencode_metadata_provider_acquisition_facts",
			);
			if (!sanitized.ok)
				return unavailableMetadataResult([
					"opencode_provider_metadata_not_sanitized",
				]);

			return {
				outcome: "available",
				sanitized_provider_result_ref: refFrom(
					"provider-result",
					`${providerID}-${model.modelID}-metadata`,
				),
				availability_ref: refFrom(
					"availability",
					`${providerID}-${model.modelID}-metadata`,
				),
				highest_tier_eligible: true,
				provider_call_confirmed: false,
			};
		},
	};
}

export function createFlowDeskOpenCodePromptBackedProviderAcquisitionClientV1(
	options: FlowDeskOpenCodePromptBackedProviderAcquisitionClientOptionsV1,
): FlowDeskExactModelProviderAcquisitionClientV1 | undefined {
	const client = asRecord(options.client) as
		| FlowDeskOpenCodeMetadataProviderSurfaceV1
		| undefined;
	const metadataClient = createFlowDeskOpenCodeMetadataProviderAcquisitionClientV1(options);
	if (client === undefined || metadataClient === undefined) return undefined;
	return {
		async checkExactModelAvailability(request) {
			const metadataResult = await metadataClient.checkExactModelAvailability(request);
			if (metadataResult.outcome !== "available") {
				return { ...metadataResult, provider_call_confirmed: false };
			}

			if (options.allowProviderCall !== true) {
				return unavailableMetadataResult([
					"opencode_sdk_provider_call_not_allowed",
				]);
			}
			if (!options.allowedProviderQualifiedModelIds.includes(request.provider_qualified_model_id)) {
				return unavailableMetadataResult([
					"opencode_sdk_provider_model_not_allowed",
				]);
			}

			const parsedModel = parseProviderQualifiedModelId(
				request.provider_qualified_model_id,
			);
			const runtimeModel = parsedModel === undefined || parsedModel.providerID !== request.provider_family
				? undefined
				: opencodeRuntimeModelForFlowDeskModel(parsedModel);
			if (runtimeModel === undefined) {
				return unavailableMetadataResult([
					"opencode_provider_mapping_missing",
				]);
			}

			const prompt = typeof client.session?.promptAsync === "function"
				? client.session.promptAsync
				: client.session?.prompt;
			if (prompt === undefined) {
				return unavailableMetadataResult([
					"opencode_sdk_surface_missing",
				]);
			}

			const promptOptions = providerAcquisitionPromptOptions({
				request,
				model: runtimeModel,
				...(typeof options.sessionId === "string" ? { sessionId: options.sessionId } : {}),
				...(typeof options.agent === "string" ? { agent: options.agent } : {}),
				...(typeof options.directory === "string" ? { directory: options.directory } : {}),
			});
			try {
				await prompt.call(client.session, promptOptions);
			} catch {
				return {
					outcome: "blocked",
					blocked_labels: ["opencode_sdk_provider_call_failed"],
					provider_call_confirmed: true,
				};
			}

			return {
				outcome: "available",
				sanitized_provider_result_ref: refFrom(
					"provider-result",
					`${runtimeModel.providerID}-${runtimeModel.modelID}-sdk-sentinel`,
				),
				availability_ref: refFrom(
					"availability",
					`${runtimeModel.providerID}-${runtimeModel.modelID}-sdk-sentinel`,
				),
				highest_tier_eligible: metadataResult.highest_tier_eligible === true,
				provider_call_confirmed: true,
			};
		},
	};
}

export async function runFlowDeskExactModelProviderAcquisitionLiveTestV1(input: {
	client: FlowDeskExactModelProviderAcquisitionClientV1;
	request: FlowDeskExactModelProviderAcquisitionLiveTestRequestV1;
	rootDir: string;
}): Promise<FlowDeskExactModelProviderAcquisitionLiveTestResultV1> {
	if (typeof input.rootDir !== "string" || input.rootDir.trim().length === 0)
		return blockedExactModelProviderAcquisition(
			"Exact-model provider acquisition live-test requires a durable state root before any provider call.",
			input.request,
		);
	const planValidation = validateFlowDeskExactModelAvailabilityCacheAcquisitionPlanV1(input.request.acquisitionPlan);
	if (!planValidation.ok || input.request.acquisitionPlan.state !== "acquisition_planned") {
		return blockedExactModelProviderAcquisition(
			"Exact-model provider acquisition live-test requires valid acquisition_planned evidence before any provider call.",
			input.request,
		);
	}
	const duplicateCheck = providerAcquisitionDuplicateLabels(input);
	if (!duplicateCheck.ok) {
		return blockedExactModelProviderAcquisition(
			duplicateCheck.reason,
			input.request,
		);
	}

	let clientResult: FlowDeskExactModelProviderAcquisitionClientResultV1;
	let providerCallAttempted = false;
	try {
		clientResult = await input.client.checkExactModelAvailability({
			provider_family: input.request.providerFamily,
			provider_identity_ref: input.request.providerIdentityRef,
			provider_qualified_model_id: input.request.providerQualifiedModelId,
			model_family: input.request.modelFamily,
			active_profile_ref: input.request.activeProfileRef,
			auth_account_boundary_ref: input.request.authAccountBoundaryRef,
			live_test_run_ref: input.request.liveTestRunRef,
			redaction_proof_ref: input.request.redactionProofRef,
		});
		providerCallAttempted = clientResult.provider_call_confirmed !== false;
	} catch {
		providerCallAttempted = true;
		clientResult = {
			outcome: "blocked",
			blocked_labels: ["provider_acquisition_client_error"],
			provider_call_confirmed: true,
		};
	}

	const rawCheck = validateNoForbiddenRawPayloads(clientResult, "provider_acquisition_client_result");
	const blockedLabels = [
		...(clientResult.blocked_labels ?? []),
		...(rawCheck.ok ? [] : ["provider_acquisition_result_not_sanitized"]),
	];
	const result = recordFlowDeskExactModelAvailabilityCacheProviderAcquisitionResultV1({
		acquisitionPlan: input.request.acquisitionPlan,
		resultId: input.request.resultId,
		localDate: input.request.localDate,
		activeProfileRef: input.request.activeProfileRef,
		opencodeVersionRef: input.request.opencodeVersionRef,
		flowdeskPackageVersionRef: input.request.flowdeskPackageVersionRef,
		registryHash: input.request.registryHash,
		policyPackHash: input.request.policyPackHash,
		authAccountBoundaryRef: input.request.authAccountBoundaryRef,
		providerFamily: input.request.providerFamily,
		providerIdentityRef: input.request.providerIdentityRef,
		providerQualifiedModelId: input.request.providerQualifiedModelId,
		modelFamily: input.request.modelFamily,
		availabilityRef: clientResult.availability_ref ?? input.request.availabilityRef,
		preCallAuditRef: input.request.preCallAuditRef,
		idempotencyRef: input.request.idempotencyRef,
		liveTestRunRef: input.request.liveTestRunRef,
		redactionProofRef: input.request.redactionProofRef,
		sanitizedProviderResultRef: clientResult.sanitized_provider_result_ref,
		observedAt: input.request.observedAt,
		outcome: rawCheck.ok ? clientResult.outcome : "blocked",
		highestTierEligible: clientResult.highest_tier_eligible,
		blockedLabels,
		providerCall: providerCallAttempted,
	});
	const prepared = prepareFlowDeskSessionEvidenceWriteIntentV1({
		workflowId: input.request.workflowId,
		evidenceId: input.request.evidenceId,
		record: result,
	});
	if (!prepared.ok || prepared.writeIntent === undefined) {
		return {
			adapterProfile: "exact_model_provider_acquisition_live_test_adapter",
			status: "provider_acquisition_blocked",
			providerCallAttempted,
			writeAttempted: false,
			evidenceReloaded: false,
			workflowId: input.request.workflowId,
			evidenceId: input.request.evidenceId,
			resultId: input.request.resultId,
			providerQualifiedModelId: input.request.providerQualifiedModelId,
			redactedBlockReason: "Provider acquisition result could not be prepared as durable session evidence.",
			result,
			safeNextActions: ["/flowdesk-status"],
			authority: exactModelProviderAcquisitionAuthority(false),
		};
	}
	const applied = applyFlowDeskSessionEvidenceWriteIntentsV1(input.rootDir, [prepared.writeIntent]);
	const reloaded = applied.ok
		? reloadFlowDeskSessionEvidenceV1({ workflowId: input.request.workflowId, rootDir: input.rootDir })
		: undefined;
	const evidenceReloaded = reloaded?.entries.some(
		(entry) => entry.evidenceClass === "exact_model_availability_cache_provider_acquisition_result" && entry.evidenceId === input.request.evidenceId,
	) === true;
	const recorded = applied.ok && evidenceReloaded && result.state === "availability_acquired" && result.ok;
	return {
		adapterProfile: "exact_model_provider_acquisition_live_test_adapter",
		status: recorded ? "provider_acquisition_recorded" : "provider_acquisition_blocked",
		providerCallAttempted,
		writeAttempted: true,
		evidenceReloaded,
		workflowId: input.request.workflowId,
		evidenceId: input.request.evidenceId,
		resultId: input.request.resultId,
		providerQualifiedModelId: input.request.providerQualifiedModelId,
		...(recorded ? {} : { redactedBlockReason: "Provider acquisition live-test did not produce reloadable availability evidence." }),
		result,
		safeNextActions: ["/flowdesk-status"],
		authority: exactModelProviderAcquisitionAuthority(recorded),
	};
}

function reviewerTypedVerdictAuthority(
	accepted: boolean,
): FlowDeskReviewerTypedVerdictAcceptanceAdapterResultV1["authority"] {
	return { ...disabledAuthority(), typedReviewerVerdictsAccepted: accepted };
}

function durableReviewerVerdictAuthority(
	accepted: boolean,
): FlowDeskDurableReviewerVerdictLinkageAdapterResultV1["authority"] {
	return {
		...disabledAuthority(),
		typedReviewerVerdictsAccepted: accepted,
		durableReviewerVerdictEvidenceLinked: accepted,
	};
}

function observedReviewerVerdictEvidenceAuthority(
	persisted: boolean,
): FlowDeskObservedReviewerVerdictEvidenceMaterializationResultV1["authority"] {
	return {
		...disabledAuthority(),
		typedReviewerVerdictPersisted: persisted,
		typedReviewerVerdictsAccepted: false,
		durableReviewerVerdictEvidenceLinked: false,
	};
}

function controlledConformanceDocWriteAuthority(
	recorded: boolean,
): FlowDeskControlledConformanceDocLocalWriterResultV1["authority"] {
	return {
		...disabledAuthority(),
		controlledExternalWriteAuthorized: recorded,
		localConformanceDocWriteRecorded: recorded,
		remoteWriteAttempted: false,
		githubWriteAttempted: false,
		connectorWriteAttempted: false,
		storageWriteAttempted: false,
		databaseWriteAttempted: false,
		urlWriteAttempted: false,
		rawPathWriteAttempted: false,
	};
}

function controlledRedactedAuditExportWriteAuthority(
	recorded: boolean,
): FlowDeskControlledRedactedAuditExportLocalWriterResultV1["authority"] {
	return {
		...disabledAuthority(),
		controlledExternalWriteAuthorized: recorded,
		localRedactedAuditExportWriteRecorded: recorded,
		remoteWriteAttempted: false,
		githubWriteAttempted: false,
		connectorWriteAttempted: false,
		storageWriteAttempted: false,
		databaseWriteAttempted: false,
		urlWriteAttempted: false,
		rawPathWriteAttempted: false,
	};
}

function permissionAskControlAuthority(
	authorized: boolean,
): FlowDeskPermissionAskControlAdapterResultV1["authority"] {
	return {
		...disabledAuthority(),
		permissionAskStatusControlAuthorized: authorized,
	};
}

function sessionAbortControlAuthority(
	authorized: boolean,
): FlowDeskSessionAbortControlAdapterResultV1["authority"] {
	return { ...disabledAuthority(), sessionAbortAuthorized: authorized };
}

function promptNoReplyControlAuthority(
	authorized: boolean,
): FlowDeskPromptNoReplyControlAdapterResultV1["authority"] {
	return {
		...disabledAuthority(),
		providerCall: authorized,
		runtimeExecution: authorized,
		promptNoReplyAuthorized: authorized,
	};
}

function blockControlledConformanceDocWrite(input: {
	request?: FlowDeskControlledExternalWriteRequestV1;
	reason: string;
}): FlowDeskControlledConformanceDocLocalWriterResultV1 {
	return {
		adapterProfile: "controlled_conformance_doc_local_writer",
		status: "blocked_before_local_write",
		writeAttempted: false,
		workflowId: input.request?.workflow_id,
		attemptId: input.request?.attempt_id,
		targetKind:
			input.request?.target_kind === "release_conformance_doc"
				? "release_conformance_doc"
				: undefined,
		targetRef: input.request?.target_ref,
		ledgerEvidenceReloaded: false,
		redactedBlockReason: input.reason,
		safeNextActions: ["/flowdesk-status"],
		authority: controlledConformanceDocWriteAuthority(false),
	};
}

function blockControlledRedactedAuditExportWrite(input: {
	request?: FlowDeskControlledExternalWriteRequestV1;
	reason: string;
}): FlowDeskControlledRedactedAuditExportLocalWriterResultV1 {
	return {
		adapterProfile: "controlled_redacted_audit_export_local_writer",
		status: "blocked_before_local_write",
		writeAttempted: false,
		workflowId: input.request?.workflow_id,
		attemptId: input.request?.attempt_id,
		targetKind:
			input.request?.target_kind === "redacted_audit_export"
				? "redacted_audit_export"
				: undefined,
		targetRef: input.request?.target_ref,
		ledgerEvidenceReloaded: false,
		redactedBlockReason: input.reason,
		safeNextActions: ["/flowdesk-status"],
		authority: controlledRedactedAuditExportWriteAuthority(false),
	};
}

function blockObservedReviewerVerdictEvidence(input: {
	observation: FlowDeskInjectedSdkReviewerVerdictObservationResultV1;
	evidenceId?: string;
	reason: string;
	evidenceReloaded?: boolean;
}): FlowDeskObservedReviewerVerdictEvidenceMaterializationResultV1 {
	return {
		adapterProfile: "observed_reviewer_verdict_evidence_materializer",
		status: "blocked_before_verdict_evidence",
		writeAttempted: false,
		workflowId: input.observation.workflowId,
		sessionRef: input.observation.sessionRef,
		lanePlanRef: input.observation.lanePlanRef,
		bindingRef: input.observation.bindingRef,
		perspective: input.observation.perspective,
		verdictId: input.observation.verdictId,
		evidenceId: input.evidenceId,
		evidenceReloaded: input.evidenceReloaded ?? false,
		redactedBlockReason: input.reason,
		safeNextActions: ["/flowdesk-status"],
		authority: observedReviewerVerdictEvidenceAuthority(false),
	};
}

export function applyFlowDeskPermissionAskControlV1(input: {
	decision: FlowDeskPermissionAskDecisionV1;
	output: { status: "ask" | "deny" | "allow" };
}): FlowDeskPermissionAskControlAdapterResultV1 {
	const validation = validateFlowDeskPermissionAskDecisionV1(input.decision);
	if (!validation.ok) {
		return {
			adapterProfile: "permission_ask_control_adapter",
			status: "blocked_before_permission_status",
			permissionStatusApplied: false,
			workflowId: input.decision.workflow_id,
			attemptId: input.decision.attempt_id,
			redactedBlockReason:
				validation.errors.join(",") || "invalid permission decision",
			authority: permissionAskControlAuthority(false),
		};
	}
	input.output.status = input.decision.status;
	return {
		adapterProfile: "permission_ask_control_adapter",
		status: "permission_status_applied",
		permissionStatusApplied: true,
		permissionStatus: input.decision.status,
		workflowId: input.decision.workflow_id,
		attemptId: input.decision.attempt_id,
		authority: permissionAskControlAuthority(true),
	};
}

export async function abortFlowDeskSessionWithDecisionV1(input: {
	client: FlowDeskManagedDispatchBetaOpenCodeClientV1;
	decision: FlowDeskSessionAbortDecisionV1;
	directory?: string;
}): Promise<FlowDeskSessionAbortControlAdapterResultV1> {
	const validation = validateFlowDeskSessionAbortDecisionV1(input.decision);
	if (!validation.ok) {
		return {
			adapterProfile: "session_abort_control_adapter",
			status: "blocked_before_session_abort",
			abortAttempted: false,
			workflowId: input.decision.workflow_id,
			attemptId: input.decision.attempt_id,
			sessionRef: input.decision.session_ref,
			redactedBlockReason:
				validation.errors.join(",") || "invalid abort decision",
			authority: sessionAbortControlAuthority(false),
		};
	}
	const abort = input.client.session.abort;
	if (abort === undefined) {
		return {
			adapterProfile: "session_abort_control_adapter",
			status: "blocked_before_session_abort",
			abortAttempted: false,
			workflowId: input.decision.workflow_id,
			attemptId: input.decision.attempt_id,
			sessionRef: input.decision.session_ref,
			redactedBlockReason: "Injected OpenCode client is missing session.abort.",
			authority: sessionAbortControlAuthority(false),
		};
	}
	const response = await abort.call(input.client.session, {
		path: { id: input.decision.session_ref },
		...(input.directory === undefined
			? {}
			: { query: { directory: input.directory } }),
	});
	return {
		adapterProfile: "session_abort_control_adapter",
		status: "session_abort_sent",
		abortAttempted: true,
		workflowId: input.decision.workflow_id,
		attemptId: input.decision.attempt_id,
		sessionRef: input.decision.session_ref,
		response,
		authority: sessionAbortControlAuthority(true),
	};
}

export async function dispatchFlowDeskPromptNoReplyWithDecisionV1(input: {
	client: FlowDeskManagedDispatchBetaOpenCodeClientV1;
	decision: FlowDeskPromptNoReplyDecisionV1;
	request: FlowDeskManagedDispatchBetaDispatchRequestV1;
}): Promise<FlowDeskPromptNoReplyControlAdapterResultV1> {
	const validation = validateFlowDeskPromptNoReplyDecisionV1(input.decision);
	if (!validation.ok) {
		return {
			adapterProfile: "prompt_no_reply_control_adapter",
			status: "blocked_before_no_reply_prompt",
			promptAttempted: false,
			workflowId: input.decision.workflow_id,
			attemptId: input.decision.attempt_id,
			sessionRef: input.decision.session_ref,
			redactedBlockReason:
				validation.errors.join(",") || "invalid no-reply decision",
			authority: promptNoReplyControlAuthority(false),
		};
	}
	if (input.request.sessionId !== input.decision.session_ref) {
		return {
			adapterProfile: "prompt_no_reply_control_adapter",
			status: "blocked_before_no_reply_prompt",
			promptAttempted: false,
			workflowId: input.decision.workflow_id,
			attemptId: input.decision.attempt_id,
			sessionRef: input.decision.session_ref,
			redactedBlockReason:
				"No-reply decision session_ref must match request sessionId.",
			authority: promptNoReplyControlAuthority(false),
		};
	}
	if (refFrom("agent", input.request.agent) !== input.decision.agent_ref) {
		return {
			adapterProfile: "prompt_no_reply_control_adapter",
			status: "blocked_before_no_reply_prompt",
			promptAttempted: false,
			workflowId: input.decision.workflow_id,
			attemptId: input.decision.attempt_id,
			sessionRef: input.decision.session_ref,
			redactedBlockReason:
				"No-reply decision agent_ref must match request agent.",
			authority: promptNoReplyControlAuthority(false),
		};
	}
	if (
		input.request.provider_qualified_model_id !==
		input.decision.provider_qualified_model_id
	) {
		return {
			adapterProfile: "prompt_no_reply_control_adapter",
			status: "blocked_before_no_reply_prompt",
			promptAttempted: false,
			workflowId: input.decision.workflow_id,
			attemptId: input.decision.attempt_id,
			sessionRef: input.decision.session_ref,
			redactedBlockReason:
				"No-reply decision provider_qualified_model_id must match request model.",
			authority: promptNoReplyControlAuthority(false),
		};
	}
	const text = promptTextFrom(input.request);
	const model = parseProviderQualifiedModelId(
		input.request.provider_qualified_model_id,
	);
	const runtimeModel =
		model === undefined
			? undefined
			: opencodeRuntimeModelForFlowDeskModel(model);
	if (
		text === undefined ||
		runtimeModel === undefined ||
		input.request.agent.trim().length === 0
	) {
		return {
			adapterProfile: "prompt_no_reply_control_adapter",
			status: "blocked_before_no_reply_prompt",
			promptAttempted: false,
			workflowId: input.decision.workflow_id,
			attemptId: input.decision.attempt_id,
			sessionRef: input.decision.session_ref,
			redactedBlockReason:
				"No-reply prompt request is missing agent, model, or bounded text.",
			authority: promptNoReplyControlAuthority(false),
		};
	}
	const dispatchMethod = input.request.dispatchMethod ?? "prompt";
	const dispatch = input.client.session[dispatchMethod];
	if (dispatch === undefined) {
		return {
			adapterProfile: "prompt_no_reply_control_adapter",
			status: "blocked_before_no_reply_prompt",
			promptAttempted: false,
			workflowId: input.decision.workflow_id,
			attemptId: input.decision.attempt_id,
			sessionRef: input.decision.session_ref,
			redactedBlockReason:
				"Injected OpenCode client is missing the requested prompt method.",
			authority: promptNoReplyControlAuthority(false),
		};
	}
	const options = dispatchOptions(input.request, runtimeModel, text);
	const response = await dispatch.call(input.client.session, {
		...options,
		body: { ...options.body, noReply: true },
	});
	return {
		adapterProfile: "prompt_no_reply_control_adapter",
		status: "no_reply_prompt_sent",
		promptAttempted: true,
		workflowId: input.decision.workflow_id,
		attemptId: input.decision.attempt_id,
		sessionRef: input.decision.session_ref,
		agent: input.request.agent,
		model: runtimeModel,
		response,
		authority: promptNoReplyControlAuthority(true),
	};
}

function sha256Ref(content: string): string {
	return `sha256-${createHash("sha256").update(content, "utf8").digest("hex")}`;
}

function safeJoinUnderRoot(rootDir: string, relativePath: string): string {
	const root = resolve(rootDir);
	const target = resolve(root, relativePath);
	const rootPrefix = root.endsWith(sep) ? root : `${root}${sep}`;
	if (target !== root && !target.startsWith(rootPrefix))
		throw new Error("controlled write target escapes root directory");
	return target;
}

function ensureNoSymlinkedDirectory(
	rootDir: string,
	relativePath: string,
): void {
	const root = resolve(rootDir);
	if (existsSync(root) && lstatSync(root).isSymbolicLink())
		throw new Error("controlled write root must not be a symlink");
	const parts = dirname(relativePath)
		.split("/")
		.filter((part) => part.length > 0);
	let current = root;
	for (const part of parts) {
		current = resolve(current, part);
		if (existsSync(current) && lstatSync(current).isSymbolicLink())
			throw new Error("controlled write directory must not be a symlink");
	}
}

function controlledDocPathFor(targetRef: string): string {
	return `docs/conformance/${targetRef}.md`;
}

function controlledRedactedAuditExportPathFor(
	workflowId: string,
	targetRef: string,
): string {
	return `.flowdesk/sessions/${workflowId}/redacted-audit/${targetRef}.json`;
}

function validateControlledDocMarkdown(value: unknown): string[] {
	if (typeof value !== "string" || value.trim().length === 0)
		return ["documentMarkdown must be a non-empty string"];
	if (value.length > 200_000)
		return ["documentMarkdown exceeds controlled conformance doc limit"];
	return [];
}

function validateRedactedAuditExportJson(value: unknown): string[] {
	if (typeof value !== "string" || value.trim().length === 0)
		return ["exportJson must be a non-empty string"];
	if (value.length > 200_000)
		return ["exportJson exceeds controlled redacted audit export limit"];
	let parsed: unknown;
	try {
		parsed = JSON.parse(value);
	} catch {
		return ["exportJson must be parseable JSON"];
	}
	if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed))
		return ["exportJson must be a JSON object"];
	const redaction = validateNoForbiddenRawPayloads(
		parsed,
		"redacted_audit_export",
	);
	return redaction.ok ? [] : redaction.errors;
}

export function materializeFlowDeskControlledConformanceDocLocalWriteV1(input: {
	rootDir: string;
	readiness: FlowDeskControlledExternalWriteAdapterResultV1;
	request: FlowDeskControlledExternalWriteRequestV1;
	consumedApproval: FlowDeskProductionApprovalSourceV1;
	ledgerEntryId: string;
	documentMarkdown: string;
	materializedAt?: string;
}): FlowDeskControlledConformanceDocLocalWriterResultV1 {
	const errors: string[] = [];
	if (typeof input.rootDir !== "string" || input.rootDir.trim().length === 0)
		errors.push("rootDir is required");
	errors.push(...validateControlledDocMarkdown(input.documentMarkdown));
	if (input.readiness.status !== "write_ready")
		errors.push("controlled external write readiness must be write_ready");
	if (input.readiness.authority.controlledExternalWriteAuthorized !== true)
		errors.push(
			"controlled external write readiness must authorize the controlled target",
		);
	if (input.request.target_kind !== "release_conformance_doc")
		errors.push("local writer only supports release_conformance_doc targets");
	const recheckedReadiness = prepareFlowDeskControlledExternalWriteAdapterV1({
		request: input.request,
		consumedApproval: input.consumedApproval,
	});
	if (recheckedReadiness.status !== "write_ready")
		errors.push(
			recheckedReadiness.redactedBlockReason ??
				"controlled external write readiness recheck failed",
		);
	if (
		input.readiness.workflowId !== input.request.workflow_id ||
		input.readiness.attemptId !== input.request.attempt_id ||
		input.readiness.targetKind !== input.request.target_kind ||
		input.readiness.targetRef !== input.request.target_ref
	)
		errors.push("readiness result does not match request target");
	if (input.consumedApproval.consumed_at === undefined)
		errors.push("external_write approval must be consumed before local write");
	if (input.consumedApproval.consumption_audit_ref === undefined)
		errors.push("external_write approval must include consumption audit ref");
	const artifactSha256Ref = sha256Ref(input.documentMarkdown);
	if (input.request.content_hash_ref !== artifactSha256Ref)
		errors.push("request content_hash_ref must match document sha256");
	const materializedAt = input.materializedAt ?? new Date().toISOString();
	if (!Number.isFinite(Date.parse(materializedAt)))
		errors.push("materializedAt must be a parseable timestamp");
	if (errors.length > 0)
		return blockControlledConformanceDocWrite({
			request: input.request,
			reason: errors.join(", "),
		});

	const documentPath = controlledDocPathFor(input.request.target_ref);
	const ledgerRecord: FlowDeskControlledConformanceDocWriteRecordV1 = {
		schema_version: "flowdesk.controlled_conformance_doc_write.v1",
		ledger_entry_id: input.ledgerEntryId,
		request_id: input.request.request_id,
		workflow_id: input.request.workflow_id,
		attempt_id: input.request.attempt_id,
		target_kind: "release_conformance_doc",
		target_ref: input.request.target_ref,
		approval_id: input.consumedApproval.approval_id,
		actor_ref: input.consumedApproval.actor_ref,
		profile_ref: input.consumedApproval.profile_ref,
		evidence_bundle_hash: input.consumedApproval.evidence_bundle_hash,
		guard_decision_ref: input.consumedApproval.guard_decision_ref,
		issuance_audit_ref: input.consumedApproval.issuance_audit_ref,
		consumption_audit_ref: input.consumedApproval
			.consumption_audit_ref as string,
		redaction_policy_ref: input.request.redaction_policy_ref,
		content_hash_ref: input.request.content_hash_ref,
		pre_write_audit_ref: input.request.pre_write_audit_ref,
		dry_run_ref: input.request.dry_run_ref,
		artifact_ref: `artifact-${input.request.target_ref}`,
		artifact_path: documentPath,
		artifact_sha256_ref: artifactSha256Ref,
		materialized_at: materializedAt,
		local_only: true,
		writeAttempted: true,
		remoteWriteAttempted: false,
		githubWriteAttempted: false,
		connectorWriteAttempted: false,
		storageWriteAttempted: false,
		databaseWriteAttempted: false,
		urlWriteAttempted: false,
		rawPathWriteAttempted: false,
		dispatch_authority_enabled: false,
		realOpenCodeDispatch: false,
		providerCall: false,
		actualLaneLaunch: false,
		runtimeExecution: false,
		fallbackAuthority: false,
		toolAuthority: false,
		hardCancelOrNoReplyAuthority: false,
	};
	const preparedLedger = prepareFlowDeskSessionEvidenceWriteIntentV1({
		workflowId: input.request.workflow_id,
		evidenceId: input.ledgerEntryId,
		record: ledgerRecord,
	});
	if (!preparedLedger.ok || preparedLedger.writeIntent === undefined)
		return blockControlledConformanceDocWrite({
			request: input.request,
			reason: preparedLedger.errors.join(", ") || "ledger write intent invalid",
		});
	const preWriteReload = reloadFlowDeskSessionEvidenceV1({
		workflowId: input.request.workflow_id,
		rootDir: input.rootDir,
	});
	if (!preWriteReload.ok || preWriteReload.blocked.length > 0)
		return blockControlledConformanceDocWrite({
			request: input.request,
			reason: "controlled conformance doc pre-write evidence reload failed",
		});

	let documentRenamed = false;
	let ledgerRenamed = false;
	try {
		ensureNoSymlinkedDirectory(input.rootDir, documentPath);
		ensureNoSymlinkedDirectory(input.rootDir, preparedLedger.writeIntent.path);
		const documentTarget = safeJoinUnderRoot(input.rootDir, documentPath);
		const documentTemp = safeJoinUnderRoot(
			input.rootDir,
			`docs/conformance/.${input.request.target_ref}.tmp-controlled-conformance-doc-write`,
		);
		const ledgerTarget = safeJoinUnderRoot(
			input.rootDir,
			preparedLedger.writeIntent.path,
		);
		const ledgerTemp = safeJoinUnderRoot(
			input.rootDir,
			preparedLedger.writeIntent.tempPath,
		);
		if (existsSync(documentTarget) || existsSync(ledgerTarget))
			return blockControlledConformanceDocWrite({
				request: input.request,
				reason: "controlled conformance doc or ledger target already exists",
			});
		if (dirname(documentTarget) !== dirname(documentTemp))
			return blockControlledConformanceDocWrite({
				request: input.request,
				reason: "controlled conformance doc temp path must stay beside target",
			});
		if (dirname(ledgerTarget) !== dirname(ledgerTemp))
			return blockControlledConformanceDocWrite({
				request: input.request,
				reason:
					"controlled conformance doc ledger temp path must stay beside target",
			});
		mkdirSync(dirname(documentTarget), { recursive: true });
		mkdirSync(dirname(ledgerTarget), { recursive: true });
		writeFileSync(documentTemp, input.documentMarkdown, "utf8");
		writeFileSync(ledgerTemp, JSON.stringify(ledgerRecord), "utf8");
		renameSync(documentTemp, documentTarget);
		documentRenamed = true;
		renameSync(ledgerTemp, ledgerTarget);
		ledgerRenamed = true;
		const writtenHash = sha256Ref(readFileSync(documentTarget, "utf8"));
		if (writtenHash !== artifactSha256Ref) {
			try {
				rmSync(ledgerTarget, { force: true });
				rmSync(documentTarget, { force: true });
			} catch {
				// Best-effort cleanup only; result remains blocked.
			} finally {
				documentRenamed = false;
				ledgerRenamed = false;
			}
			return blockControlledConformanceDocWrite({
				request: input.request,
				reason: "controlled conformance doc hash verification failed",
			});
		}
		const reloaded = reloadFlowDeskSessionEvidenceV1({
			workflowId: input.request.workflow_id,
			rootDir: input.rootDir,
		});
		const ledgerReloaded =
			reloaded.ok &&
			reloaded.blocked.length === 0 &&
			reloaded.entries.some(
				(entry) =>
					entry.evidenceClass === "controlled_conformance_doc_write" &&
					entry.evidenceId === input.ledgerEntryId &&
					entry.record.artifact_sha256_ref === artifactSha256Ref,
			);
		if (!ledgerReloaded)
			try {
				rmSync(ledgerTarget, { force: true });
				rmSync(documentTarget, { force: true });
			} catch {
				// Best-effort cleanup only; result remains blocked.
			} finally {
				documentRenamed = false;
				ledgerRenamed = false;
			}
		if (!ledgerReloaded)
			return blockControlledConformanceDocWrite({
				request: input.request,
				reason: "controlled conformance doc ledger reload failed",
			});
		return {
			adapterProfile: "controlled_conformance_doc_local_writer",
			status: "write_recorded",
			workflowId: input.request.workflow_id,
			attemptId: input.request.attempt_id,
			targetKind: "release_conformance_doc",
			targetRef: input.request.target_ref,
			writeAttempted: true,
			documentPath,
			ledgerEntryId: input.ledgerEntryId,
			ledgerEvidenceReloaded: true,
			artifactSha256Ref,
			safeNextActions: ["/flowdesk-status", "/flowdesk-export-debug"],
			authority: controlledConformanceDocWriteAuthority(true),
		};
	} catch (error) {
		try {
			if (ledgerRenamed) {
				const ledgerTarget = safeJoinUnderRoot(
					input.rootDir,
					preparedLedger.writeIntent.path,
				);
				rmSync(ledgerTarget, { force: true });
			}
			if (documentRenamed) {
				const documentTarget = safeJoinUnderRoot(input.rootDir, documentPath);
				rmSync(documentTarget, { force: true });
			}
		} catch {
			// Best-effort cleanup only; result remains blocked.
		}
		return blockControlledConformanceDocWrite({
			request: input.request,
			reason:
				error instanceof Error
					? error.message
					: "controlled conformance doc local write failed",
		});
	}
}

export function materializeFlowDeskControlledRedactedAuditExportLocalWriteV1(input: {
	rootDir: string;
	readiness: FlowDeskControlledExternalWriteAdapterResultV1;
	request: FlowDeskControlledExternalWriteRequestV1;
	consumedApproval: FlowDeskProductionApprovalSourceV1;
	ledgerEntryId: string;
	exportJson: string;
	materializedAt?: string;
}): FlowDeskControlledRedactedAuditExportLocalWriterResultV1 {
	const errors: string[] = [];
	if (typeof input.rootDir !== "string" || input.rootDir.trim().length === 0)
		errors.push("rootDir is required");
	errors.push(...validateRedactedAuditExportJson(input.exportJson));
	if (input.readiness.status !== "write_ready")
		errors.push("controlled external write readiness must be write_ready");
	if (input.readiness.authority.controlledExternalWriteAuthorized !== true)
		errors.push(
			"controlled external write readiness must authorize the controlled target",
		);
	if (input.request.target_kind !== "redacted_audit_export")
		errors.push("local writer only supports redacted_audit_export targets");
	const recheckedReadiness = prepareFlowDeskControlledExternalWriteAdapterV1({
		request: input.request,
		consumedApproval: input.consumedApproval,
	});
	if (recheckedReadiness.status !== "write_ready")
		errors.push(
			recheckedReadiness.redactedBlockReason ??
				"controlled external write readiness recheck failed",
		);
	if (
		input.readiness.workflowId !== input.request.workflow_id ||
		input.readiness.attemptId !== input.request.attempt_id ||
		input.readiness.targetKind !== input.request.target_kind ||
		input.readiness.targetRef !== input.request.target_ref
	)
		errors.push("readiness result does not match request target");
	if (input.consumedApproval.consumed_at === undefined)
		errors.push("external_write approval must be consumed before local write");
	if (input.consumedApproval.consumption_audit_ref === undefined)
		errors.push("external_write approval must include consumption audit ref");
	const artifactSha256Ref = sha256Ref(input.exportJson);
	if (input.request.content_hash_ref !== artifactSha256Ref)
		errors.push(
			"request content_hash_ref must match redacted audit export sha256",
		);
	const materializedAt = input.materializedAt ?? new Date().toISOString();
	if (!Number.isFinite(Date.parse(materializedAt)))
		errors.push("materializedAt must be a parseable timestamp");
	if (errors.length > 0)
		return blockControlledRedactedAuditExportWrite({
			request: input.request,
			reason: errors.join(", "),
		});

	const exportPath = controlledRedactedAuditExportPathFor(
		input.request.workflow_id,
		input.request.target_ref,
	);
	const ledgerRecord: FlowDeskControlledRedactedAuditExportWriteRecordV1 = {
		schema_version: "flowdesk.controlled_redacted_audit_export_write.v1",
		ledger_entry_id: input.ledgerEntryId,
		request_id: input.request.request_id,
		workflow_id: input.request.workflow_id,
		attempt_id: input.request.attempt_id,
		target_kind: "redacted_audit_export",
		target_ref: input.request.target_ref,
		approval_id: input.consumedApproval.approval_id,
		actor_ref: input.consumedApproval.actor_ref,
		profile_ref: input.consumedApproval.profile_ref,
		evidence_bundle_hash: input.consumedApproval.evidence_bundle_hash,
		guard_decision_ref: input.consumedApproval.guard_decision_ref,
		issuance_audit_ref: input.consumedApproval.issuance_audit_ref,
		consumption_audit_ref: input.consumedApproval
			.consumption_audit_ref as string,
		redaction_policy_ref: input.request.redaction_policy_ref,
		content_hash_ref: input.request.content_hash_ref,
		pre_write_audit_ref: input.request.pre_write_audit_ref,
		dry_run_ref: input.request.dry_run_ref,
		artifact_ref: `artifact-${input.request.target_ref}`,
		artifact_path: exportPath,
		artifact_sha256_ref: artifactSha256Ref,
		materialized_at: materializedAt,
		local_only: true,
		redacted: true,
		writeAttempted: true,
		remoteWriteAttempted: false,
		githubWriteAttempted: false,
		connectorWriteAttempted: false,
		storageWriteAttempted: false,
		databaseWriteAttempted: false,
		urlWriteAttempted: false,
		rawPathWriteAttempted: false,
		dispatch_authority_enabled: false,
		realOpenCodeDispatch: false,
		providerCall: false,
		actualLaneLaunch: false,
		runtimeExecution: false,
		fallbackAuthority: false,
		toolAuthority: false,
		hardCancelOrNoReplyAuthority: false,
	};
	const preparedLedger = prepareFlowDeskSessionEvidenceWriteIntentV1({
		workflowId: input.request.workflow_id,
		evidenceId: input.ledgerEntryId,
		record: ledgerRecord,
	});
	if (!preparedLedger.ok || preparedLedger.writeIntent === undefined)
		return blockControlledRedactedAuditExportWrite({
			request: input.request,
			reason: preparedLedger.errors.join(", ") || "ledger write intent invalid",
		});
	const preWriteReload = reloadFlowDeskSessionEvidenceV1({
		workflowId: input.request.workflow_id,
		rootDir: input.rootDir,
	});
	if (!preWriteReload.ok || preWriteReload.blocked.length > 0)
		return blockControlledRedactedAuditExportWrite({
			request: input.request,
			reason:
				"controlled redacted audit export pre-write evidence reload failed",
		});

	let exportRenamed = false;
	let ledgerRenamed = false;
	try {
		ensureNoSymlinkedDirectory(input.rootDir, exportPath);
		ensureNoSymlinkedDirectory(input.rootDir, preparedLedger.writeIntent.path);
		const exportTarget = safeJoinUnderRoot(input.rootDir, exportPath);
		const exportTemp = safeJoinUnderRoot(
			input.rootDir,
			`.flowdesk/sessions/${input.request.workflow_id}/redacted-audit/.${input.request.target_ref}.tmp-controlled-redacted-audit-export-write`,
		);
		const ledgerTarget = safeJoinUnderRoot(
			input.rootDir,
			preparedLedger.writeIntent.path,
		);
		const ledgerTemp = safeJoinUnderRoot(
			input.rootDir,
			preparedLedger.writeIntent.tempPath,
		);
		if (existsSync(exportTarget) || existsSync(ledgerTarget))
			return blockControlledRedactedAuditExportWrite({
				request: input.request,
				reason:
					"controlled redacted audit export or ledger target already exists",
			});
		if (dirname(exportTarget) !== dirname(exportTemp))
			return blockControlledRedactedAuditExportWrite({
				request: input.request,
				reason:
					"controlled redacted audit export temp path must stay beside target",
			});
		if (dirname(ledgerTarget) !== dirname(ledgerTemp))
			return blockControlledRedactedAuditExportWrite({
				request: input.request,
				reason:
					"controlled redacted audit export ledger temp path must stay beside target",
			});
		mkdirSync(dirname(exportTarget), { recursive: true });
		mkdirSync(dirname(ledgerTarget), { recursive: true });
		writeFileSync(exportTemp, input.exportJson, "utf8");
		writeFileSync(ledgerTemp, JSON.stringify(ledgerRecord), "utf8");
		renameSync(exportTemp, exportTarget);
		exportRenamed = true;
		renameSync(ledgerTemp, ledgerTarget);
		ledgerRenamed = true;
		const writtenHash = sha256Ref(readFileSync(exportTarget, "utf8"));
		if (writtenHash !== artifactSha256Ref) {
			try {
				rmSync(ledgerTarget, { force: true });
				rmSync(exportTarget, { force: true });
			} catch {
				// Best-effort cleanup only; result remains blocked.
			} finally {
				exportRenamed = false;
				ledgerRenamed = false;
			}
			return blockControlledRedactedAuditExportWrite({
				request: input.request,
				reason: "controlled redacted audit export hash verification failed",
			});
		}
		const reloaded = reloadFlowDeskSessionEvidenceV1({
			workflowId: input.request.workflow_id,
			rootDir: input.rootDir,
		});
		const ledgerReloaded =
			reloaded.ok &&
			reloaded.blocked.length === 0 &&
			reloaded.entries.some(
				(entry) =>
					entry.evidenceClass === "controlled_redacted_audit_export_write" &&
					entry.evidenceId === input.ledgerEntryId &&
					entry.record.artifact_sha256_ref === artifactSha256Ref,
			);
		if (!ledgerReloaded)
			try {
				rmSync(ledgerTarget, { force: true });
				rmSync(exportTarget, { force: true });
			} catch {
				// Best-effort cleanup only; result remains blocked.
			} finally {
				exportRenamed = false;
				ledgerRenamed = false;
			}
		if (!ledgerReloaded)
			return blockControlledRedactedAuditExportWrite({
				request: input.request,
				reason: "controlled redacted audit export ledger reload failed",
			});
		return {
			adapterProfile: "controlled_redacted_audit_export_local_writer",
			status: "write_recorded",
			workflowId: input.request.workflow_id,
			attemptId: input.request.attempt_id,
			targetKind: "redacted_audit_export",
			targetRef: input.request.target_ref,
			writeAttempted: true,
			exportPath,
			ledgerEntryId: input.ledgerEntryId,
			ledgerEvidenceReloaded: true,
			artifactSha256Ref,
			safeNextActions: ["/flowdesk-status", "/flowdesk-export-debug"],
			authority: controlledRedactedAuditExportWriteAuthority(true),
		};
	} catch (error) {
		try {
			if (ledgerRenamed) {
				const ledgerTarget = safeJoinUnderRoot(
					input.rootDir,
					preparedLedger.writeIntent.path,
				);
				rmSync(ledgerTarget, { force: true });
			}
			if (exportRenamed) {
				const exportTarget = safeJoinUnderRoot(input.rootDir, exportPath);
				rmSync(exportTarget, { force: true });
			}
		} catch {
			// Best-effort cleanup only; result remains blocked.
		}
		return blockControlledRedactedAuditExportWrite({
			request: input.request,
			reason:
				error instanceof Error
					? error.message
					: "controlled redacted audit export local write failed",
		});
	}
}

export function prepareFlowDeskFallbackReselectionRegateAdapterV1(input: {
	decision: FlowDeskFallbackDecisionV1;
	consumedApproval: FlowDeskProductionApprovalSourceV1;
}): FlowDeskFallbackReselectionRegateAdapterResultV1 {
	const promotion = promoteFlowDeskFallbackReselectionRegateV1(input);
	if (
		!promotion.ok ||
		promotion.fallback_reselection_regate_authority_enabled !== true
	) {
		return {
			adapterProfile: "fallback_reselection_regate_adapter",
			status: "blocked_before_regate",
			dispatchAttempted: false,
			workflowId: input.decision.workflow_id,
			parentAttemptId: input.decision.parent_attempt_id,
			newAttemptId: input.decision.new_attempt_id,
			redactedBlockReason:
				promotion.errors.join(",") || "fallback reselection regate blocked",
			safeNextActions: ["/flowdesk-status"],
			authority: disabledFallbackAuthority(),
		};
	}
	return {
		adapterProfile: "fallback_reselection_regate_adapter",
		status: "regate_required",
		dispatchAttempted: false,
		workflowId: input.decision.workflow_id,
		parentAttemptId: input.decision.parent_attempt_id,
		newAttemptId: input.decision.new_attempt_id,
		fromProviderQualifiedModelId:
			input.decision.from_provider_qualified_model_id,
		toProviderQualifiedModelId: input.decision.to_provider_qualified_model_id,
		safeNextActions: ["/flowdesk-status", "/flowdesk-run"],
		authority: disabledFallbackAuthority(),
	};
}

export function orchestrateFlowDeskManagedFallbackRegateV1(input: {
	decision: FlowDeskFallbackDecisionV1;
	consumedApproval: FlowDeskProductionApprovalSourceV1;
}): FlowDeskManagedFallbackRegateOrchestratorResultV1 {
	const plan = planFlowDeskFallbackRegateV1(input);
	if (!plan.ok || plan.state !== "full_regate_required") {
		return {
			adapterProfile: "managed_fallback_regate_orchestrator",
			status: "blocked_before_regate_plan",
			dispatchAttempted: false,
			providerSwitchAttempted: false,
			sdkCallAttempted: false,
			workflowId: input.decision.workflow_id,
			parentAttemptId: input.decision.parent_attempt_id,
			newAttemptId: input.decision.new_attempt_id,
			fromProviderQualifiedModelId:
				input.decision.from_provider_qualified_model_id,
			toProviderQualifiedModelId: input.decision.to_provider_qualified_model_id,
			regatePlan: plan,
			redactedBlockReason:
				plan.errors.join(",") || "fallback regate plan blocked",
			safeNextActions: ["/flowdesk-status"],
			authority: managedFallbackRegateAuthority(false),
		};
	}
	return {
		adapterProfile: "managed_fallback_regate_orchestrator",
		status: "regate_plan_ready",
		dispatchAttempted: false,
		providerSwitchAttempted: false,
		sdkCallAttempted: false,
		workflowId: plan.workflow_id,
		parentAttemptId: plan.parent_attempt_id,
		newAttemptId: plan.new_attempt_id,
		fromProviderQualifiedModelId: plan.from_provider_qualified_model_id,
		toProviderQualifiedModelId: plan.to_provider_qualified_model_id,
		regatePlan: plan,
		safeNextActions: ["/flowdesk-status", "/flowdesk-run"],
		authority: managedFallbackRegateAuthority(true),
	};
}

export interface FlowDeskManagedFallbackRegatePlanEvidenceMaterializationResultV1 {
	adapterProfile: "managed_fallback_regate_plan_evidence_materializer";
	status: "regate_plan_evidence_recorded" | "blocked_before_regate_plan_evidence";
	writeAttempted: boolean;
	evidenceReloaded: boolean;
	workflowId?: string;
	evidenceId?: string;
	redactedBlockReason?: string;
	safeNextActions: ["/flowdesk-status"] | ["/flowdesk-status", "/flowdesk-run"];
	authority: {
		realOpenCodeDispatch: false;
		providerCall: false;
		runtimeExecution: false;
		actualLaneLaunch: false;
		fallbackAuthority: false;
		automaticFallbackAuthorized: false;
		regatePlanPersisted: boolean;
		toolAuthority: false;
		hardCancelOrNoReplyAuthority: false;
	};
}

export function materializeFlowDeskManagedFallbackRegatePlanEvidenceV1(input: {
	rootDir: string;
	regatePlan: FlowDeskFallbackRegatePlanV1;
	evidenceId: string;
}): FlowDeskManagedFallbackRegatePlanEvidenceMaterializationResultV1 {
	const blockedAuthority = {
		realOpenCodeDispatch: false as const,
		providerCall: false as const,
		runtimeExecution: false as const,
		actualLaneLaunch: false as const,
		fallbackAuthority: false as const,
		automaticFallbackAuthorized: false as const,
		regatePlanPersisted: false,
		toolAuthority: false as const,
		hardCancelOrNoReplyAuthority: false as const,
	};
	if (typeof input.rootDir !== "string" || input.rootDir.trim().length === 0)
		return {
			adapterProfile: "managed_fallback_regate_plan_evidence_materializer",
			status: "blocked_before_regate_plan_evidence",
			writeAttempted: false,
			evidenceReloaded: false,
			workflowId: input.regatePlan?.workflow_id,
			evidenceId: input.evidenceId,
			redactedBlockReason: "rootDir is required",
			safeNextActions: ["/flowdesk-status"],
			authority: blockedAuthority,
		};
	const planValidation = validateFlowDeskFallbackRegatePlanV1(input.regatePlan);
	if (!planValidation.ok)
		return {
			adapterProfile: "managed_fallback_regate_plan_evidence_materializer",
			status: "blocked_before_regate_plan_evidence",
			writeAttempted: false,
			evidenceReloaded: false,
			workflowId: input.regatePlan?.workflow_id,
			evidenceId: input.evidenceId,
			redactedBlockReason:
				planValidation.errors.join(", ") ||
				"fallback regate plan invalid",
			safeNextActions: ["/flowdesk-status"],
			authority: blockedAuthority,
		};
	if (
		input.regatePlan.state !== "full_regate_required" ||
		input.regatePlan.ok !== true
	)
		return {
			adapterProfile: "managed_fallback_regate_plan_evidence_materializer",
			status: "blocked_before_regate_plan_evidence",
			writeAttempted: false,
			evidenceReloaded: false,
			workflowId: input.regatePlan?.workflow_id,
			evidenceId: input.evidenceId,
			redactedBlockReason: "fallback regate plan must be full_regate_required",
			safeNextActions: ["/flowdesk-status"],
			authority: blockedAuthority,
		};
	const workflowId = input.regatePlan.workflow_id;
	if (typeof workflowId !== "string" || workflowId.trim().length === 0)
		return {
			adapterProfile: "managed_fallback_regate_plan_evidence_materializer",
			status: "blocked_before_regate_plan_evidence",
			writeAttempted: false,
			evidenceReloaded: false,
			evidenceId: input.evidenceId,
			redactedBlockReason: "fallback regate plan workflow_id is required",
			safeNextActions: ["/flowdesk-status"],
			authority: blockedAuthority,
		};
	const preWriteReload = reloadFlowDeskSessionEvidenceV1({
		workflowId,
		rootDir: input.rootDir,
	});
	if (!preWriteReload.ok || preWriteReload.blocked.length > 0)
		return {
			adapterProfile: "managed_fallback_regate_plan_evidence_materializer",
			status: "blocked_before_regate_plan_evidence",
			writeAttempted: false,
			evidenceReloaded: false,
			workflowId,
			evidenceId: input.evidenceId,
			redactedBlockReason: "fallback regate plan pre-write reload failed",
			safeNextActions: ["/flowdesk-status"],
			authority: blockedAuthority,
		};
	if (
		preWriteReload.entries.some(
			(entry) =>
				entry.evidenceClass === "fallback_regate_plan" &&
				entry.evidenceId === input.evidenceId,
		)
	)
		return {
			adapterProfile: "managed_fallback_regate_plan_evidence_materializer",
			status: "blocked_before_regate_plan_evidence",
			writeAttempted: false,
			evidenceReloaded: true,
			workflowId,
			evidenceId: input.evidenceId,
			redactedBlockReason: "fallback regate plan evidence already exists",
			safeNextActions: ["/flowdesk-status"],
			authority: blockedAuthority,
		};
	const prepared = prepareFlowDeskSessionEvidenceWriteIntentV1({
		workflowId,
		evidenceId: input.evidenceId,
		record: input.regatePlan as unknown as Record<string, unknown>,
	});
	if (!prepared.ok || prepared.writeIntent === undefined)
		return {
			adapterProfile: "managed_fallback_regate_plan_evidence_materializer",
			status: "blocked_before_regate_plan_evidence",
			writeAttempted: false,
			evidenceReloaded: true,
			workflowId,
			evidenceId: input.evidenceId,
			redactedBlockReason:
				prepared.errors.join(", ") ||
				"fallback regate plan evidence intent invalid",
			safeNextActions: ["/flowdesk-status"],
			authority: blockedAuthority,
		};
	const applied = applyFlowDeskSessionEvidenceWriteIntentsV1(input.rootDir, [
		prepared.writeIntent,
	]);
	if (!applied.ok)
		return {
			adapterProfile: "managed_fallback_regate_plan_evidence_materializer",
			status: "blocked_before_regate_plan_evidence",
			writeAttempted: false,
			evidenceReloaded: true,
			workflowId,
			evidenceId: input.evidenceId,
			redactedBlockReason:
				applied.errors.join(", ") ||
				"fallback regate plan evidence write failed",
			safeNextActions: ["/flowdesk-status"],
			authority: blockedAuthority,
		};
	const postWriteReload = reloadFlowDeskSessionEvidenceV1({
		workflowId,
		rootDir: input.rootDir,
	});
	const persisted =
		postWriteReload.ok &&
		postWriteReload.entries.some(
			(entry) =>
				entry.evidenceClass === "fallback_regate_plan" &&
				entry.evidenceId === input.evidenceId &&
				entry.record.state === "full_regate_required",
		);
	if (!persisted)
		return {
			adapterProfile: "managed_fallback_regate_plan_evidence_materializer",
			status: "blocked_before_regate_plan_evidence",
			writeAttempted: true,
			evidenceReloaded: false,
			workflowId,
			evidenceId: input.evidenceId,
			redactedBlockReason:
				"fallback regate plan evidence reload verification failed",
			safeNextActions: ["/flowdesk-status"],
			authority: blockedAuthority,
		};
	return {
		adapterProfile: "managed_fallback_regate_plan_evidence_materializer",
		status: "regate_plan_evidence_recorded",
		writeAttempted: true,
		evidenceReloaded: true,
		workflowId,
		evidenceId: input.evidenceId,
		safeNextActions: ["/flowdesk-status", "/flowdesk-run"],
		authority: {
			...blockedAuthority,
			regatePlanPersisted: true,
		},
	};
}

export function prepareFlowDeskControlledExternalWriteAdapterV1(input: {
	request: FlowDeskControlledExternalWriteRequestV1;
	consumedApproval: FlowDeskProductionApprovalSourceV1;
}): FlowDeskControlledExternalWriteAdapterResultV1 {
	const promotion = promoteFlowDeskExternalWriteAuthorityV1(input);
	if (!promotion.ok || promotion.external_write_authority_enabled !== true) {
		return {
			adapterProfile: "controlled_external_write_adapter",
			status: "blocked_before_write",
			writeAttempted: false,
			workflowId: input.request.workflow_id,
			attemptId: input.request.attempt_id,
			redactedBlockReason:
				promotion.errors.join(",") || "controlled external write blocked",
			safeNextActions: ["/flowdesk-status"],
			authority: controlledExternalWriteAuthority(false),
		};
	}
	return {
		adapterProfile: "controlled_external_write_adapter",
		status: "write_ready",
		writeAttempted: false,
		workflowId: input.request.workflow_id,
		attemptId: input.request.attempt_id,
		targetKind: input.request.target_kind,
		targetRef: input.request.target_ref,
		safeNextActions: ["/flowdesk-status", "/flowdesk-export-debug"],
		authority: controlledExternalWriteAuthority(true),
	};
}

export function prepareFlowDeskReviewerTypedVerdictAcceptanceAdapterV1(input: {
	workflowId: string;
	attemptId: string;
	verdicts: readonly FlowDeskTopTierReviewVerdictV1[];
	consumedApproval: FlowDeskProductionApprovalSourceV1;
	requiredPerspectives?: readonly FlowDeskTopTierReviewPerspective[];
}): FlowDeskReviewerTypedVerdictAcceptanceAdapterResultV1 {
	if (input.requiredPerspectives !== undefined) {
		const errors: string[] = [];
		const requiredPerspectives = [...input.requiredPerspectives];
		if (requiredPerspectives.length === 0)
			errors.push("required reviewer perspectives must be non-empty");
		const canonical = new Set<string>(FLOWDESK_TOP_TIER_REVIEW_PERSPECTIVES);
		const seenRequired = new Set<string>();
		for (const [index, perspective] of requiredPerspectives.entries()) {
			if (!canonical.has(perspective))
				errors.push(`requiredPerspectives[${index}] is not canonical`);
			if (seenRequired.has(perspective))
				errors.push(`requiredPerspectives[${index}] must be distinct`);
			seenRequired.add(perspective);
		}
		const approvalResult = validateFlowDeskProductionApprovalSourceV1(
			input.consumedApproval,
			input.workflowId,
		);
		errors.push(...approvalResult.errors);
		if (input.consumedApproval.attempt_id !== input.attemptId)
			errors.push("approval source attempt_id mismatch");
		if (input.consumedApproval.consumed_by_attempt_id !== input.attemptId)
			errors.push("approval source consumed_by_attempt_id mismatch");
		if (input.consumedApproval.action_type !== "reviewer_fanout")
			errors.push("approval source action_type mismatch");
		const verdicts = Array.isArray(input.verdicts) ? input.verdicts : [];
		if (!Array.isArray(input.verdicts)) errors.push("verdicts must be an array");
		const seenVerdictIds = new Set<string>();
		const seenPerspectives = new Set<string>();
		for (const [index, verdict] of verdicts.entries()) {
			const result = validateTopTierReviewVerdictV1(verdict);
			errors.push(...result.errors.map((error) => `verdicts[${index}]: ${error}`));
			const record = verdict as Partial<FlowDeskTopTierReviewVerdictV1>;
			if (record.workflow_id !== input.workflowId)
				errors.push(`verdicts[${index}] workflow_id mismatch`);
			if (record.verdict_label !== "pass")
				errors.push(`verdicts[${index}] verdict_label must be pass`);
			if (record.uncertainty !== "low")
				errors.push(`verdicts[${index}] uncertainty must be low`);
			if (!Array.isArray(record.evidence_refs) || record.evidence_refs.length === 0)
				errors.push(`verdicts[${index}] evidence_refs must be non-empty`);
			if (typeof record.verdict_id === "string") {
				if (seenVerdictIds.has(record.verdict_id))
					errors.push(`verdicts[${index}] verdict_id must be distinct`);
				seenVerdictIds.add(record.verdict_id);
			}
			if (typeof record.perspective === "string") {
				if (seenPerspectives.has(record.perspective))
					errors.push(`verdicts[${index}] perspective must be distinct`);
				seenPerspectives.add(record.perspective);
				if (!seenRequired.has(record.perspective))
					errors.push(`verdicts[${index}] perspective was not requested`);
			}
		}
		for (const perspective of requiredPerspectives) {
			if (!seenPerspectives.has(perspective))
				errors.push(`missing required reviewer perspective: ${perspective}`);
		}
		if (verdicts.length !== requiredPerspectives.length)
			errors.push("verdicts must contain exactly the requested perspectives");
		if (errors.length > 0) {
			return {
				adapterProfile: "reviewer_typed_verdict_acceptance_adapter",
				status: "blocked_before_acceptance",
				workflowId: input.workflowId,
				attemptId: input.attemptId,
				acceptedVerdictIds: [],
				acceptedPerspectives: [],
				redactedBlockReason:
					errors.join(",") || "reviewer verdict acceptance blocked",
				safeNextActions: ["/flowdesk-status"],
				authority: reviewerTypedVerdictAuthority(false),
			};
		}
		return {
			adapterProfile: "reviewer_typed_verdict_acceptance_adapter",
			status: "verdicts_accepted",
			workflowId: input.workflowId,
			attemptId: input.attemptId,
			acceptedVerdictIds: verdicts.map((verdict) => verdict.verdict_id),
			acceptedPerspectives: requiredPerspectives,
			safeNextActions: ["/flowdesk-status", "/flowdesk-run"],
			authority: reviewerTypedVerdictAuthority(true),
		};
	}
	const promotion = promoteFlowDeskReviewerTypedVerdictsV1(input);
	if (
		!promotion.ok ||
		promotion.typed_reviewer_verdict_acceptance_enabled !== true
	) {
		return {
			adapterProfile: "reviewer_typed_verdict_acceptance_adapter",
			status: "blocked_before_acceptance",
			workflowId: input.workflowId,
			attemptId: input.attemptId,
			acceptedVerdictIds: [],
			acceptedPerspectives: [],
			redactedBlockReason:
				promotion.errors.join(",") || "reviewer verdict acceptance blocked",
			safeNextActions: ["/flowdesk-status"],
			authority: reviewerTypedVerdictAuthority(false),
		};
	}
	return {
		adapterProfile: "reviewer_typed_verdict_acceptance_adapter",
		status: "verdicts_accepted",
		workflowId: input.workflowId,
		attemptId: input.attemptId,
		acceptedVerdictIds: promotion.accepted_verdict_ids ?? [],
		acceptedPerspectives: promotion.accepted_perspectives ?? [],
		safeNextActions: ["/flowdesk-status", "/flowdesk-run"],
		authority: reviewerTypedVerdictAuthority(true),
	};
}

function durableReviewerVerdictIds(
	reloadedEvidence: FlowDeskSessionEvidenceReloadResultV1,
): Set<string> {
	return new Set(
		reloadedEvidence.entries
			.filter((entry) => entry.evidenceClass === "reviewer_verdict")
			.map((entry) => entry.record.verdict_id)
			.filter((value): value is string => typeof value === "string"),
	);
}

function durableCompleteLifecycleRefs(input: {
	reloadedEvidence: FlowDeskSessionEvidenceReloadResultV1;
	workflowId: string;
	attemptId: string;
	verdictIds: readonly string[];
}): Map<string, string> {
	const verdictIds = new Set(input.verdictIds);
	const refs = new Map<string, string>();
	for (const entry of input.reloadedEvidence.entries) {
		if (entry.evidenceClass !== "lane_lifecycle") continue;
		const record = entry.record as unknown as FlowDeskLaneLifecycleRecordV1;
		if (
			record.workflow_id === input.workflowId &&
			record.attempt_id === input.attemptId &&
			record.state === "complete" &&
			typeof record.verdict_ref === "string" &&
			verdictIds.has(record.verdict_ref)
		) {
			refs.set(record.verdict_ref, entry.evidenceId);
		}
	}
	return refs;
}

export function prepareFlowDeskDurableReviewerVerdictLinkageAdapterV1(input: {
	workflowId: string;
	attemptId: string;
	verdicts: readonly FlowDeskTopTierReviewVerdictV1[];
	consumedApproval: FlowDeskProductionApprovalSourceV1;
	reloadedEvidence: FlowDeskSessionEvidenceReloadResultV1;
	requiredPerspectives?: readonly FlowDeskTopTierReviewPerspective[];
}): FlowDeskDurableReviewerVerdictLinkageAdapterResultV1 {
	const acceptance = prepareFlowDeskReviewerTypedVerdictAcceptanceAdapterV1({
		workflowId: input.workflowId,
		attemptId: input.attemptId,
		verdicts: input.verdicts,
		consumedApproval: input.consumedApproval,
		...(input.requiredPerspectives === undefined
			? {}
			: { requiredPerspectives: input.requiredPerspectives }),
	});
	if (acceptance.status !== "verdicts_accepted") {
		return {
			adapterProfile: "durable_reviewer_verdict_linkage_adapter",
			status: "blocked_before_durable_acceptance",
			workflowId: input.workflowId,
			attemptId: input.attemptId,
			linkedVerdictIds: [],
			linkedLifecycleRefs: [],
			redactedBlockReason:
				acceptance.redactedBlockReason ?? "reviewer verdict acceptance blocked",
			safeNextActions: ["/flowdesk-status"],
			authority: durableReviewerVerdictAuthority(false),
		};
	}
	if (!input.reloadedEvidence.ok || input.reloadedEvidence.blocked.length > 0) {
		return {
			adapterProfile: "durable_reviewer_verdict_linkage_adapter",
			status: "blocked_before_durable_acceptance",
			workflowId: input.workflowId,
			attemptId: input.attemptId,
			linkedVerdictIds: [],
			linkedLifecycleRefs: [],
			redactedBlockReason: "reviewer durable evidence reload is blocked",
			safeNextActions: ["/flowdesk-status"],
			authority: durableReviewerVerdictAuthority(false),
		};
	}
	const requiredVerdictIds = acceptance.acceptedVerdictIds;
	const verdictEvidence = durableReviewerVerdictIds(input.reloadedEvidence);
	const lifecycleRefs = durableCompleteLifecycleRefs({
		reloadedEvidence: input.reloadedEvidence,
		workflowId: input.workflowId,
		attemptId: input.attemptId,
		verdictIds: requiredVerdictIds,
	});
	const missingVerdicts = requiredVerdictIds.filter(
		(verdictId) => !verdictEvidence.has(verdictId),
	);
	const missingLifecycle = requiredVerdictIds.filter(
		(verdictId) => !lifecycleRefs.has(verdictId),
	);
	if (missingVerdicts.length > 0 || missingLifecycle.length > 0) {
		return {
			adapterProfile: "durable_reviewer_verdict_linkage_adapter",
			status: "blocked_before_durable_acceptance",
			workflowId: input.workflowId,
			attemptId: input.attemptId,
			linkedVerdictIds: requiredVerdictIds.filter((verdictId) =>
				verdictEvidence.has(verdictId),
			),
			linkedLifecycleRefs: [...lifecycleRefs.values()],
			redactedBlockReason: [
				missingVerdicts.length > 0
					? "missing durable reviewer verdict evidence"
					: undefined,
				missingLifecycle.length > 0
					? "missing complete lane lifecycle evidence"
					: undefined,
			]
				.filter((reason): reason is string => reason !== undefined)
				.join(", "),
			safeNextActions: ["/flowdesk-status"],
			authority: durableReviewerVerdictAuthority(false),
		};
	}
	return {
		adapterProfile: "durable_reviewer_verdict_linkage_adapter",
		status: "durable_verdicts_accepted",
		workflowId: input.workflowId,
		attemptId: input.attemptId,
		linkedVerdictIds: requiredVerdictIds,
		linkedLifecycleRefs: [...lifecycleRefs.values()],
		safeNextActions: ["/flowdesk-status", "/flowdesk-run"],
		authority: durableReviewerVerdictAuthority(true),
	};
}

export function materializeFlowDeskObservedReviewerVerdictEvidenceV1(input: {
	rootDir: string;
	observation: FlowDeskInjectedSdkReviewerVerdictObservationResultV1;
	evidenceId?: string;
}): FlowDeskObservedReviewerVerdictEvidenceMaterializationResultV1 {
	const evidenceId = input.evidenceId ?? input.observation.verdictId;
	if (typeof input.rootDir !== "string" || input.rootDir.trim().length === 0)
		return blockObservedReviewerVerdictEvidence({
			observation: input.observation,
			evidenceId,
			reason: "rootDir is required",
		});
	if (
		input.observation.status !== "verdict_observed" ||
		input.observation.verdict === undefined
	)
		return blockObservedReviewerVerdictEvidence({
			observation: input.observation,
			evidenceId,
			reason: "reviewer verdict observation must be verdict_observed",
		});
	if (evidenceId === undefined)
		return blockObservedReviewerVerdictEvidence({
			observation: input.observation,
			reason: "reviewer verdict evidence id is required",
		});
	const validation = validateTopTierReviewVerdictV1(input.observation.verdict);
	if (!validation.ok)
		return blockObservedReviewerVerdictEvidence({
			observation: input.observation,
			evidenceId,
			reason: validation.errors.join(", ") || "reviewer verdict is invalid",
		});
	const preWriteReload = reloadFlowDeskSessionEvidenceV1({
		workflowId: input.observation.workflowId,
		rootDir: input.rootDir,
	});
	if (!preWriteReload.ok || preWriteReload.blocked.length > 0)
		return blockObservedReviewerVerdictEvidence({
			observation: input.observation,
			evidenceId,
			reason: "reviewer verdict pre-write evidence reload failed",
			evidenceReloaded: false,
		});
	if (
		preWriteReload.entries.some(
			(entry) =>
				entry.evidenceClass === "reviewer_verdict" &&
				entry.evidenceId === evidenceId,
		)
	)
		return blockObservedReviewerVerdictEvidence({
			observation: input.observation,
			evidenceId,
			reason: "reviewer verdict evidence already exists",
			evidenceReloaded: true,
		});
	const prepared = prepareFlowDeskSessionEvidenceWriteIntentV1({
		workflowId: input.observation.workflowId,
		evidenceId,
		record: input.observation.verdict,
	});
	if (!prepared.ok || prepared.writeIntent === undefined)
		return blockObservedReviewerVerdictEvidence({
			observation: input.observation,
			evidenceId,
			reason:
				prepared.errors.join(", ") ||
				"reviewer verdict evidence intent invalid",
			evidenceReloaded: true,
		});
	const applied = applyFlowDeskSessionEvidenceWriteIntentsV1(input.rootDir, [
		prepared.writeIntent,
	]);
	if (!applied.ok)
		return blockObservedReviewerVerdictEvidence({
			observation: input.observation,
			evidenceId,
			reason:
				applied.errors.join(", ") || "reviewer verdict evidence write failed",
			evidenceReloaded: true,
		});
	const postWriteReload = reloadFlowDeskSessionEvidenceV1({
		workflowId: input.observation.workflowId,
		rootDir: input.rootDir,
	});
	const persisted =
		postWriteReload.ok &&
		postWriteReload.entries.some(
			(entry) =>
				entry.evidenceClass === "reviewer_verdict" &&
				entry.evidenceId === evidenceId &&
				entry.record.verdict_id === input.observation.verdictId,
		);
	if (!persisted)
		return blockObservedReviewerVerdictEvidence({
			observation: input.observation,
			evidenceId,
			reason: "reviewer verdict evidence reload verification failed",
			evidenceReloaded: false,
		});
	return {
		adapterProfile: "observed_reviewer_verdict_evidence_materializer",
		status: "verdict_evidence_recorded",
		writeAttempted: true,
		workflowId: input.observation.workflowId,
		sessionRef: input.observation.sessionRef,
		lanePlanRef: input.observation.lanePlanRef,
		bindingRef: input.observation.bindingRef,
		perspective: input.observation.perspective,
		verdictId: input.observation.verdictId,
		evidenceId,
		evidenceReloaded: true,
		safeNextActions: ["/flowdesk-status"],
		authority: observedReviewerVerdictEvidenceAuthority(true),
	};
}

function idempotencySnapshotFrom(
	entry: FlowDeskSessionEvidenceReloadResultV1["entries"][number] | undefined,
): FlowDeskDispatchIdempotencySnapshotV1 | undefined {
	if (entry?.evidenceClass !== "dispatch_idempotency") return undefined;
	return entry.record as unknown as FlowDeskDispatchIdempotencySnapshotV1;
}

function existingIdempotencySnapshot(
	reloadedEvidence: FlowDeskSessionEvidenceReloadResultV1,
): FlowDeskDispatchIdempotencySnapshotV1 | undefined {
	const snapshots = reloadedEvidence.entries
		.map(idempotencySnapshotFrom)
		.filter(
			(snapshot): snapshot is FlowDeskDispatchIdempotencySnapshotV1 =>
				snapshot !== undefined,
		);
	const latest = snapshots[snapshots.length - 1];
	if (latest === undefined) return undefined;
	const entriesByKey = new Map<
		string,
		FlowDeskDispatchIdempotencySnapshotV1["entries"][number]
	>();
	for (const snapshot of snapshots) {
		for (const entry of snapshot.entries)
			entriesByKey.set(entry.idempotency_key, entry);
	}
	return { ...latest, entries: [...entriesByKey.values()] };
}

function currentIdempotencySnapshot(
	rootDir: string,
	workflowId: string,
):
	| { ok: true; snapshot?: FlowDeskDispatchIdempotencySnapshotV1 }
	| { ok: false; redactedFailureReason: string } {
	const reloaded = reloadFlowDeskSessionEvidenceV1({ workflowId, rootDir });
	if (!reloaded.ok || reloaded.blocked.length > 0)
		return { ok: false, redactedFailureReason: "reservation reload failed" };
	return { ok: true, snapshot: existingIdempotencySnapshot(reloaded) };
}

function reservationKey(manifest: FlowDeskDispatchAttemptManifestV1): string {
	return `${manifest.workflow_id}:${manifest.attempt_id}:${manifest.idempotency_key}`;
}

function snapshotRefFor(
	manifest: FlowDeskDispatchAttemptManifestV1,
	suffix: string,
): string {
	return `idempotency-${manifest.attempt_id}-${suffix}`
		.replaceAll(/[^A-Za-z0-9_.:-]/g, "-")
		.slice(0, 96);
}

function hasMatchingEntry(
	snapshot: FlowDeskDispatchIdempotencySnapshotV1,
	manifest: FlowDeskDispatchAttemptManifestV1,
	state?: string,
): boolean {
	return snapshot.entries.some(
		(entry) =>
			entry.attempt_id === manifest.attempt_id &&
			entry.idempotency_key === manifest.idempotency_key &&
			(state === undefined || entry.state === state),
	);
}

function materializeSnapshot(input: {
	rootDir: string;
	manifest: FlowDeskDispatchAttemptManifestV1;
	evidenceId: string;
	snapshot: FlowDeskDispatchIdempotencySnapshotV1;
	expectedState: string;
}): FlowDeskManagedDispatchBetaReservationStoreResultV1 & {
	snapshot?: FlowDeskDispatchIdempotencySnapshotV1;
} {
	const prepared = prepareFlowDeskSessionEvidenceWriteIntentV1({
		workflowId: input.manifest.workflow_id,
		evidenceId: input.evidenceId,
		record: input.snapshot,
	});
	if (!prepared.ok || prepared.writeIntent === undefined) {
		return {
			ok: false,
			reservationEvidenceReloaded: false,
			redactedFailureReason: "reservation write intent invalid",
		};
	}
	const applied = applyFlowDeskSessionEvidenceWriteIntentsV1(input.rootDir, [
		prepared.writeIntent,
	]);
	if (!applied.ok) {
		return {
			ok: false,
			reservationEvidenceReloaded: false,
			redactedFailureReason: "reservation materialization failed",
		};
	}
	const reloaded = reloadFlowDeskSessionEvidenceV1({
		workflowId: input.manifest.workflow_id,
		rootDir: input.rootDir,
	});
	if (!reloaded.ok || reloaded.blocked.length > 0) {
		return {
			ok: false,
			reservationEvidenceReloaded: false,
			redactedFailureReason: "reservation reload failed",
		};
	}
	const reloadedSnapshot = idempotencySnapshotFrom(
		reloaded.entries.find(
			(entry) =>
				entry.evidenceClass === "dispatch_idempotency" &&
				entry.evidenceId === input.evidenceId,
		),
	);
	if (
		reloadedSnapshot === undefined ||
		!hasMatchingEntry(reloadedSnapshot, input.manifest, input.expectedState)
	) {
		return {
			ok: false,
			reservationEvidenceReloaded: false,
			redactedFailureReason: "reservation evidence missing after reload",
		};
	}
	return {
		ok: true,
		reservationEvidenceReloaded: true,
		snapshot: reloadedSnapshot,
	};
}

export function createFlowDeskManagedDispatchBetaDurableReservationStoreV1(
	options: FlowDeskManagedDispatchBetaDurableReservationStoreOptionsV1,
): FlowDeskManagedDispatchBetaReservationStoreV1 {
	const now = options.now ?? (() => new Date());
	const reservedSnapshots = new Map<
		string,
		FlowDeskDispatchIdempotencySnapshotV1
	>();
	return {
		reserve(input) {
			const recordedAt = now().toISOString();
			const evidenceId = snapshotRefFor(input.manifest, "reserved");
			const current = currentIdempotencySnapshot(
				options.rootDir,
				input.manifest.workflow_id,
			);
			if (!current.ok) {
				return {
					ok: false,
					reservationEvidenceReloaded: false,
					redactedFailureReason: current.redactedFailureReason,
				};
			}
			const reservation = prepareFlowDeskDispatchIdempotencyReservationV1({
				workflowId: input.manifest.workflow_id,
				attemptId: input.manifest.attempt_id,
				idempotencyKey: input.manifest.idempotency_key,
				snapshotRef: evidenceId,
				reservedAt: recordedAt,
				existingSnapshot:
					current.snapshot ??
					existingIdempotencySnapshot(input.reloadedEvidence),
			});
			if (
				!reservation.reservation_prepared ||
				reservation.snapshot === undefined
			) {
				return {
					ok: false,
					reservationEvidenceReloaded: false,
					redactedFailureReason: "reservation preparation blocked",
				};
			}
			const materialized = materializeSnapshot({
				rootDir: options.rootDir,
				manifest: input.manifest,
				evidenceId,
				snapshot: reservation.snapshot,
				expectedState: "reserved",
			});
			if (materialized.ok && materialized.snapshot !== undefined)
				reservedSnapshots.set(
					reservationKey(input.manifest),
					materialized.snapshot,
				);
			return {
				ok: materialized.ok,
				reservationEvidenceReloaded: materialized.reservationEvidenceReloaded,
				...(materialized.redactedFailureReason === undefined
					? {}
					: { redactedFailureReason: materialized.redactedFailureReason }),
			};
		},
		recordDispatchCompleted(input) {
			const recordedAt = now().toISOString();
			const evidenceId = snapshotRefFor(input.manifest, "dispatch-completed");
			const current = currentIdempotencySnapshot(
				options.rootDir,
				input.manifest.workflow_id,
			);
			if (!current.ok) {
				return {
					ok: false,
					reservationEvidenceReloaded: false,
					redactedFailureReason: current.redactedFailureReason,
				};
			}
			const stateUpdate = prepareFlowDeskDispatchIdempotencyStateUpdateV1({
				workflowId: input.manifest.workflow_id,
				attemptId: input.manifest.attempt_id,
				idempotencyKey: input.manifest.idempotency_key,
				snapshotRef: evidenceId,
				recordedAt,
				nextState: "dispatch_completed",
				existingSnapshot:
					reservedSnapshots.get(reservationKey(input.manifest)) ??
					current.snapshot ??
					existingIdempotencySnapshot(input.reloadedEvidence),
			});
			if (
				!stateUpdate.state_update_prepared ||
				stateUpdate.snapshot === undefined
			) {
				return {
					ok: false,
					reservationEvidenceReloaded: false,
					redactedFailureReason: "completed state preparation blocked",
				};
			}
			const materialized = materializeSnapshot({
				rootDir: options.rootDir,
				manifest: input.manifest,
				evidenceId,
				snapshot: stateUpdate.snapshot,
				expectedState: "dispatch_completed",
			});
			if (materialized.ok && materialized.snapshot !== undefined)
				reservedSnapshots.set(
					reservationKey(input.manifest),
					materialized.snapshot,
				);
			return {
				ok: materialized.ok,
				reservationEvidenceReloaded: materialized.reservationEvidenceReloaded,
				...(materialized.redactedFailureReason === undefined
					? {}
					: { redactedFailureReason: materialized.redactedFailureReason }),
			};
		},
		recordDispatchFailure(input) {
			const recordedAt = now().toISOString();
			const evidenceId = snapshotRefFor(input.manifest, "dispatch-failed");
			const current = currentIdempotencySnapshot(
				options.rootDir,
				input.manifest.workflow_id,
			);
			if (!current.ok) {
				return {
					ok: false,
					reservationEvidenceReloaded: false,
					redactedFailureReason: current.redactedFailureReason,
				};
			}
			const stateUpdate = prepareFlowDeskDispatchIdempotencyStateUpdateV1({
				workflowId: input.manifest.workflow_id,
				attemptId: input.manifest.attempt_id,
				idempotencyKey: input.manifest.idempotency_key,
				snapshotRef: evidenceId,
				recordedAt,
				nextState: "dispatch_failed",
				existingSnapshot:
					reservedSnapshots.get(reservationKey(input.manifest)) ??
					current.snapshot ??
					existingIdempotencySnapshot(input.reloadedEvidence),
			});
			if (
				!stateUpdate.state_update_prepared ||
				stateUpdate.snapshot === undefined
			) {
				return {
					ok: false,
					reservationEvidenceReloaded: false,
					redactedFailureReason: "failure state preparation blocked",
				};
			}
			const materialized = materializeSnapshot({
				rootDir: options.rootDir,
				manifest: input.manifest,
				evidenceId,
				snapshot: stateUpdate.snapshot,
				expectedState: "dispatch_failed",
			});
			if (materialized.ok && materialized.snapshot !== undefined)
				reservedSnapshots.set(
					reservationKey(input.manifest),
					materialized.snapshot,
				);
			return {
				ok: materialized.ok,
				reservationEvidenceReloaded: materialized.reservationEvidenceReloaded,
				...(materialized.redactedFailureReason === undefined
					? {}
					: { redactedFailureReason: materialized.redactedFailureReason }),
			};
		},
	};
}

function enabledDispatchAuthority(): FlowDeskManagedDispatchBetaAuthoritySummaryV1 {
	return {
		...disabledAuthority(),
		realOpenCodeDispatch: true,
		providerCall: true,
		runtimeExecution: true,
	};
}

function verificationFor(
	input: ManagedDispatchBetaBoundaryInputV1,
): FlowDeskManagedDispatchBetaVerificationStatusV1 {
	return {
		ambiguityQuarantined: input.ambiguityQuarantined === true,
		...(input.configuredVerificationRef === undefined
			? {}
			: { configuredVerificationRef: input.configuredVerificationRef }),
		...(input.preDispatchAuditRef === undefined
			? {}
			: { preDispatchAuditRef: input.preDispatchAuditRef }),
		defaultRelease1ServerBehaviorUnchanged: true,
	};
}

function blocked(
	input: ManagedDispatchBetaBoundaryInputV1,
	guardDecision: GuardBoundaryDecisionV1,
	redactedBlockReason = guardDecision.redacted_reason,
): FlowDeskManagedDispatchBetaBlockedResultV1 {
	return {
		adapterProfile: flowdeskManagedDispatchBetaAdapterProfile,
		status: "blocked_before_dispatch",
		dispatchAttempted: false,
		guardDecision,
		redactedBlockReason,
		authority: disabledAuthority(),
		verification: verificationFor(input),
	};
}

function parseProviderQualifiedModelId(
	value: string,
): { providerID: string; modelID: string } | undefined {
	const separator = value.indexOf("/");
	if (separator <= 0 || separator === value.length - 1) return undefined;
	const providerID = value.slice(0, separator).trim();
	const modelID = value.slice(separator + 1).trim();
	if (providerID.length === 0 || modelID.length === 0) return undefined;
	return { providerID, modelID };
}

function opencodeRuntimeProviderIDForFlowDeskProviderFamily(
	providerFamily: string,
): string | undefined {
	switch (providerFamily) {
		case "claude":
		case "anthropic":
			return "anthropic";
		case "gemini":
		case "google":
			return "google";
		case "openai":
			return "openai";
		default:
			return undefined;
	}
}

function opencodeRuntimeModelForFlowDeskModel(model: {
	providerID: string;
	modelID: string;
}): { providerID: string; modelID: string } | undefined {
	const providerID = opencodeRuntimeProviderIDForFlowDeskProviderFamily(
		model.providerID,
	);
	return providerID === undefined
		? undefined
		: { providerID, modelID: model.modelID };
}

function refFrom(label: string, value: string): string {
	const safe = value
		.replaceAll(/[^A-Za-z0-9_.:-]/g, "-")
		.replaceAll(/-+/g, "-")
		.slice(0, 96);
	return `${label}-${safe.length > 0 ? safe : "unknown"}`;
}

function asRecord(value: unknown): Record<string, unknown> | undefined {
	return typeof value === "object" && value !== null && !Array.isArray(value)
		? (value as Record<string, unknown>)
		: undefined;
}

function responseData(value: unknown): unknown {
	const record = asRecord(value);
	return record !== undefined && "data" in record ? record.data : value;
}

function isSdkErrorResponse(value: unknown): boolean {
	const record = asRecord(value);
	const data = asRecord(responseData(value));
	return record?.error !== undefined || data?.error !== undefined;
}

async function callSdkWithLegacyFallback(
	method: (options: unknown) => unknown | Promise<unknown>,
	thisArg: unknown,
	currentOptions: unknown,
	legacyOptions: unknown,
): Promise<unknown> {
	const current = await method.call(thisArg, currentOptions);
	if (!isSdkErrorResponse(current)) return current;
	return method.call(thisArg, legacyOptions);
}

function arrayData(value: unknown): unknown[] {
	const data = responseData(value);
	if (Array.isArray(data)) return data;
	const record = asRecord(data);
	if (Array.isArray(record?.items)) return record.items;
	return Array.isArray(record?.messages) ? record.messages : [];
}

function modelRef(value: unknown): string | undefined {
	const record = asRecord(value);
	if (record === undefined) return undefined;
	const providerID =
		typeof record.providerID === "string" ? record.providerID : undefined;
	const modelID =
		typeof record.modelID === "string"
			? record.modelID
			: typeof record.id === "string"
				? record.id
				: undefined;
	return providerID !== undefined && modelID !== undefined
		? refFrom("model", `${providerID}-${modelID}`)
		: undefined;
}

function sessionIdFromResponse(value: unknown): string | undefined {
	const data = responseData(value);
	const record = asRecord(data);
	return typeof record?.id === "string" && record.id.trim().length > 0
		? record.id
		: undefined;
}

function agentIdFromRef(value: string | undefined): string | undefined {
	if (value === undefined || !value.startsWith("agent-")) return undefined;
	const agent = value.slice("agent-".length).trim();
	return agent.length > 0 ? agent : undefined;
}

function firstMessageRef(value: unknown): string | undefined {
	const direct = asRecord(responseData(value));
	const directInfo = asRecord(direct?.info) ?? direct;
	if (typeof directInfo?.id === "string") return refFrom("message", directInfo.id);
	const messages = arrayData(value);
	for (const message of messages) {
		const record = asRecord(message);
		const info = asRecord(record?.info) ?? record;
		if (typeof info?.id === "string") return refFrom("message", info.id);
	}
	return undefined;
}

function lifecycleMessageRefFrom(value: string | undefined): string | undefined {
	if (value === undefined) return undefined;
	if (value.startsWith("msg-")) return value;
	if (value.startsWith("message-")) return `msg-${value.slice("message-".length)}`;
	return value;
}

function messageRole(message: unknown): string | undefined {
	const record = asRecord(message);
	const info = asRecord(record?.info) ?? record;
	return typeof info?.role === "string" ? info.role : undefined;
}

function extractJsonBlocksFromText(raw: string): string[] {
	const results: string[] = [];
	// 1. Raw bare JSON object: starts with { ends with }
	if (raw.startsWith("{") && raw.endsWith("}")) {
		results.push(raw);
		return results;
	}
	// 2. Markdown code fence: ```json\n{...}\n``` or ```\n{...}\n```
	const fencePattern = /```(?:json)?\s*\n?(\{[\s\S]*?\})\s*\n?```/g;
	for (const match of raw.matchAll(fencePattern)) {
		if (match[1]) results.push(match[1].trim());
	}
	if (results.length > 0) return results;
	// 3. Last {...} block in text (handles preamble like "Here is the verdict: {...}")
	let depth = 0;
	let start = -1;
	let lastBlock: string | undefined;
	for (let i = 0; i < raw.length; i++) {
		const ch = raw[i];
		if (ch === "{") {
			if (depth === 0) start = i;
			depth++;
		} else if (ch === "}") {
			depth--;
			if (depth === 0 && start !== -1) {
				lastBlock = raw.slice(start, i + 1).trim();
				start = -1;
			}
		}
	}
	if (lastBlock !== undefined) results.push(lastBlock);
	return results;
}

function messageTextCandidates(message: unknown): string[] {
	const record = asRecord(message);
	const info = asRecord(record?.info);
	const parts = Array.isArray(record?.parts)
		? record.parts
		: Array.isArray(info?.parts)
			? info.parts
			: [];
	return parts
		.flatMap((part) => {
			const partRecord = asRecord(part);
			const text =
				typeof partRecord?.text === "string"
					? partRecord.text
					: typeof partRecord?.content === "string"
						? partRecord.content
						: undefined;
			if (text === undefined || text.length > 20_000) return [];
			return extractJsonBlocksFromText(text.trim());
		});
}

function directVerdictCandidate(message: unknown): unknown | undefined {
	return asRecord(message)?.schema_version === "flowdesk.top_tier_review_verdict.v1"
		? message
		: undefined;
}

function topTierVerdictCandidates(messagesResponse: unknown): unknown[] {
	const messages = arrayData(messagesResponse);
	const candidates: unknown[] = [];
	for (let index = messages.length - 1; index >= 0; index -= 1) {
		const message = messages[index];
		const parsed = messageTextCandidates(message)
			.map(parseJsonCandidate)
			.filter((candidate) => candidate !== undefined);
		if (messageRole(message) === "assistant") candidates.push(...parsed);
		const direct = directVerdictCandidate(message);
		if (direct !== undefined) candidates.push(direct);
		if (messageRole(message) !== "assistant") candidates.push(...parsed);
	}
	const topLevel = directVerdictCandidate(responseData(messagesResponse));
	return topLevel === undefined ? candidates : [...candidates, topLevel];
}

function parseJsonCandidate(text: string): unknown | undefined {
	try {
		return JSON.parse(text) as unknown;
	} catch {
		return undefined;
	}
}


function verdictMatchesRequest(
	verdict: FlowDeskTopTierReviewVerdictV1,
	request: FlowDeskInjectedSdkReviewerVerdictObservationRequestV1,
): string[] {
	return [
		verdict.workflow_id === request.workflowId
			? undefined
			: "verdict workflow_id mismatch",
		verdict.lane_plan_ref === request.lanePlanRef
			? undefined
			: "verdict lane_plan_ref mismatch",
		verdict.binding_ref === request.bindingRef
			? undefined
			: "verdict binding_ref mismatch",
		verdict.perspective === request.perspective
			? undefined
			: "verdict perspective mismatch",
	].filter((error): error is string => error !== undefined);
}

export async function observeInjectedSdkReviewerVerdictV1(input: {
	client: FlowDeskManagedDispatchBetaOpenCodeClientV1;
	request: FlowDeskInjectedSdkReviewerVerdictObservationRequestV1;
}): Promise<FlowDeskInjectedSdkReviewerVerdictObservationResultV1> {
	const base = {
		adapterProfile: "injected_sdk_reviewer_verdict_observation" as const,
		sessionRef: refFrom("session", input.request.sessionId),
		workflowId: input.request.workflowId,
		lanePlanRef: input.request.lanePlanRef,
		bindingRef: input.request.bindingRef,
		perspective: input.request.perspective,
		authority: disabledAuthority(),
	};
	const messages = input.client.session.messages;
	if (messages === undefined) {
		return {
			...base,
			status: "observation_unavailable",
			observationAttempted: false,
			redactedErrors: ["session_messages_api_missing"],
		};
	}
	try {
		const messagesResponse = input.request.messagesResponse ?? await callSdkWithLegacyFallback(
			messages as (options: unknown) => unknown | Promise<unknown>,
			input.client.session,
			{
				sessionID: input.request.sessionId,
				...(input.request.directory === undefined
					? {}
					: { directory: input.request.directory }),
			},
			{
				path: { id: input.request.sessionId },
				...(input.request.directory === undefined
					? {}
					: { query: { directory: input.request.directory } }),
			},
		);
		const errors: string[] = [];
		for (const candidate of topTierVerdictCandidates(messagesResponse)) {
			const validation = validateTopTierReviewVerdictV1(candidate);
			if (!validation.ok) {
				errors.push(...validation.errors.slice(0, 5));
				continue;
			}
			const verdict = candidate as FlowDeskTopTierReviewVerdictV1;
			const matchErrors = verdictMatchesRequest(verdict, input.request);
			if (matchErrors.length > 0) {
				errors.push(...matchErrors);
				continue;
			}
			return {
				...base,
				status: "verdict_observed",
				observationAttempted: true,
				verdictId: verdict.verdict_id,
				verdict,
				redactedErrors: [],
			};
		}
		return {
			...base,
			status: errors.length > 0 ? "invalid_verdict" : "missing_verdict",
			observationAttempted: true,
			redactedErrors: [...new Set(errors)].slice(0, 8).map((error) => error.slice(0, 200)),
		};
	} catch {
		return {
			...base,
			status: "observation_failed",
			observationAttempted: true,
			redactedErrors: ["session_messages_read_failed"],
		};
	}
}

export async function observeInjectedSdkLaneV1(input: {
	client: FlowDeskManagedDispatchBetaOpenCodeClientV1;
	request: FlowDeskInjectedSdkLaneObservationRequestV1;
}): Promise<FlowDeskInjectedSdkLaneObservationResultV1> {
	const base = {
		adapterProfile: "injected_sdk_lane_observation_probe" as const,
		parentSessionRef: refFrom("parent-session", input.request.parentSessionId),
		laneId: input.request.laneId,
		requestedAgentRef: refFrom("agent", input.request.requestedAgent),
		requestedModelRef: refFrom(
			"model",
			input.request.requestedProviderQualifiedModelId,
		),
		authority: disabledAuthority(),
	};
	const children = input.client.session.children;
	if (children === undefined) {
		return {
			...base,
			status: "observation_unavailable",
			observationAttempted: false,
			missingLabels: ["session_children_api_missing"],
		};
	}
	try {
		const childrenResponse = await callSdkWithLegacyFallback(
			children as (options: unknown) => unknown | Promise<unknown>,
			input.client.session,
			{
				sessionID: input.request.parentSessionId,
				...(input.request.directory === undefined
					? {}
					: { directory: input.request.directory }),
			},
			{
				path: { id: input.request.parentSessionId },
				...(input.request.directory === undefined
					? {}
					: { query: { directory: input.request.directory } }),
			},
		);
		const childRecord = arrayData(childrenResponse)
			.map(asRecord)
			.find(
				(record): record is Record<string, unknown> => record !== undefined,
			);
		const childSessionId =
			typeof childRecord?.id === "string" ? childRecord.id : undefined;
		const childSessionRef =
			childSessionId === undefined
				? undefined
				: refFrom("child-session", childSessionId);
		const observedAgentRef =
			typeof childRecord?.agent === "string"
				? refFrom("agent", childRecord.agent)
				: undefined;
		const observedModelRef = modelRef(childRecord?.model);
		let messageRef: string | undefined;
		if (
			childSessionId !== undefined &&
			input.client.session.messages !== undefined
		) {
			const messagesResponse = await callSdkWithLegacyFallback(
				input.client.session.messages as (
					options: unknown,
				) => unknown | Promise<unknown>,
				input.client.session,
				{
					sessionID: childSessionId,
					...(input.request.directory === undefined
						? {}
						: { directory: input.request.directory }),
				},
				{
					path: { id: childSessionId },
					...(input.request.directory === undefined
						? {}
						: { query: { directory: input.request.directory } }),
				},
			);
			messageRef = firstMessageRef(messagesResponse);
		}
		const missingLabels = [
			childSessionRef === undefined ? "child_session_missing" : undefined,
			observedAgentRef === undefined ? "observed_agent_missing" : undefined,
			observedModelRef === undefined ? "observed_model_missing" : undefined,
			messageRef === undefined ? "message_ref_missing" : undefined,
		].filter((label): label is string => label !== undefined);
		return {
			...base,
			status: missingLabels.length === 0 ? "observed" : "partial",
			observationAttempted: true,
			...(childSessionRef === undefined ? {} : { childSessionRef }),
			...(messageRef === undefined ? {} : { messageRef }),
			...(observedAgentRef === undefined ? {} : { observedAgentRef }),
			...(observedModelRef === undefined ? {} : { observedModelRef }),
			missingLabels,
		};
	} catch {
		return {
			...base,
			status: "observation_failed",
			observationAttempted: true,
			missingLabels: ["session_observation_failed"],
		};
	}
}

export async function launchFlowDeskInjectedSdkRuntimeLaneFromPlanV1(input: {
	client: FlowDeskManagedDispatchBetaOpenCodeClientV1;
	launchPlan: FlowDeskRuntimeLaneLaunchPlanV1;
	request: FlowDeskInjectedSdkRuntimeLaneLaunchRequestV1;
}): Promise<FlowDeskInjectedSdkRuntimeLaneLaunchResultV1> {
	const plan = input.launchPlan;
	const planValidation = validateFlowDeskRuntimeLaneLaunchPlanV1(plan);
	if (!planValidation.ok)
		return blockedRuntimeLaneLaunch(
			`Runtime lane launch plan invalid: ${planValidation.errors.join(",") || "unknown"}.`,
			plan,
		);
	if (plan.state !== "launch_ready")
		return blockedRuntimeLaneLaunch(
			`Runtime lane launch plan is not ready: ${plan.blocked_labels.join(",") || "blocked"}.`,
			plan,
		);
	if (input.request.allowActualLaneLaunch !== true)
		return blockedRuntimeLaneLaunch(
			"Explicit actual runtime lane launch opt-in is required.",
			plan,
		);
	const parentSessionRef = refFrom("ses", input.request.parentSessionId);
	if (plan.parent_session_ref !== parentSessionRef)
		return blockedRuntimeLaneLaunch(
			"Runtime lane launch parent session does not match the launch plan binding.",
			plan,
		);
	const agent = agentIdFromRef(plan.agent_ref);
	const model = plan.provider_qualified_model_id === undefined
		? undefined
		: parseProviderQualifiedModelId(plan.provider_qualified_model_id);
	const runtimeModel = model === undefined
		? undefined
		: opencodeRuntimeModelForFlowDeskModel(model);
	const text = input.request.promptText.trim();
	if (agent === undefined || runtimeModel === undefined || text.length === 0)
		return blockedRuntimeLaneLaunch(
			"Runtime lane launch is missing an agent, runtime model, or bounded prompt text.",
			plan,
		);
	if (text.length > 20_000)
		return blockedRuntimeLaneLaunch(
			"Runtime lane launch prompt text exceeds the bounded prompt limit.",
			plan,
		);
	const create = input.client.session.create;
	if (create === undefined)
		return blockedRuntimeLaneLaunch(
			"Injected OpenCode client is missing session.create for child lane launch.",
			plan,
		);
	const dispatchMethod = input.request.dispatchMethod ?? "promptAsync";
	const dispatch = input.client.session[dispatchMethod];
	if (dispatch === undefined)
		return blockedRuntimeLaneLaunch(
			"Injected OpenCode client is missing the requested session prompt method.",
			plan,
		);
	let childSessionId: string | undefined;
	try {
		childSessionId = sessionIdFromResponse(
			await callSdkWithLegacyFallback(
				create as (options: unknown) => unknown | Promise<unknown>,
				input.client.session,
				{
					parentID: input.request.parentSessionId,
					...(input.request.title === undefined
						? {}
						: { title: input.request.title.slice(0, 120) }),
				},
				{
					body: {
						parentID: input.request.parentSessionId,
						...(input.request.title === undefined
							? {}
							: { title: input.request.title.slice(0, 120) }),
					},
				},
			),
		);
	} catch {
		return {
			adapterProfile: "injected_sdk_runtime_lane_launch_adapter",
			status: "lane_launch_failed",
			createAttempted: true,
			promptAttempted: false,
			workflowId: plan.workflow_id,
			attemptId: plan.attempt_id,
			laneId: plan.lane_id,
			parentSessionRef: plan.parent_session_ref,
			redactedErrorCategory: "runtime",
			safeNextActions: ["/flowdesk-status", "/flowdesk-export-debug"],
			authority: runtimeLaneLaunchAuthority(false),
		};
	}
	if (childSessionId === undefined)
		return {
			adapterProfile: "injected_sdk_runtime_lane_launch_adapter",
			status: "lane_launch_failed",
			createAttempted: true,
			promptAttempted: false,
			workflowId: plan.workflow_id,
			attemptId: plan.attempt_id,
			laneId: plan.lane_id,
			parentSessionRef: plan.parent_session_ref,
			redactedErrorCategory: "runtime",
			safeNextActions: ["/flowdesk-status", "/flowdesk-export-debug"],
			authority: runtimeLaneLaunchAuthority(false),
		};
	let response: unknown;
	try {
		const flatPromptOptions = {
			sessionID: childSessionId,
			...(input.request.directory === undefined
				? {}
				: { directory: input.request.directory }),
			model: runtimeModel,
			agent,
			parts: [{ type: "text", text }],
		};
		const structuredPromptOptions = {
			path: { id: childSessionId },
			...(input.request.directory === undefined
				? {}
				: { query: { directory: input.request.directory } }),
			body: {
				model: runtimeModel,
				agent,
				parts: [{ type: "text", text }],
			},
		};
		const firstPromptOptions = dispatchMethod === "promptAsync" ? structuredPromptOptions : flatPromptOptions;
		const fallbackPromptOptions = dispatchMethod === "promptAsync" ? flatPromptOptions : structuredPromptOptions;
		response = await callSdkWithLegacyFallback(
			dispatch as (options: unknown) => unknown | Promise<unknown>,
			input.client.session,
			firstPromptOptions,
			fallbackPromptOptions,
		);
		if (isSdkErrorResponse(response)) throw new Error("sdk prompt failed");
	} catch {
		return {
			adapterProfile: "injected_sdk_runtime_lane_launch_adapter",
			status: "lane_launch_failed",
			createAttempted: true,
			promptAttempted: true,
			workflowId: plan.workflow_id,
			attemptId: plan.attempt_id,
			laneId: plan.lane_id,
			parentSessionRef: plan.parent_session_ref,
			childSessionRef: refFrom("ses", childSessionId),
			agent,
			model: runtimeModel,
			dispatchMethod,
			redactedErrorCategory: "provider_api",
			safeNextActions: ["/flowdesk-status", "/flowdesk-export-debug"],
			authority: runtimeLaneLaunchAuthority(false),
		};
	}
	return {
		adapterProfile: "injected_sdk_runtime_lane_launch_adapter",
		status: "lane_launch_started",
		createAttempted: true,
		promptAttempted: true,
		workflowId: plan.workflow_id,
		attemptId: plan.attempt_id,
		laneId: plan.lane_id,
		parentSessionRef: plan.parent_session_ref,
		childSessionRef: refFrom("ses", childSessionId),
		...(firstMessageRef(response) === undefined
			? {}
			: { messageRef: firstMessageRef(response) }),
		agent,
		model: runtimeModel,
		dispatchMethod,
		safeNextActions: ["/flowdesk-status"],
		authority: runtimeLaneLaunchAuthority(true),
	};
}

export function materializeFlowDeskRuntimeLaneLaunchLifecycleEvidenceV1(input: {
	rootDir: string;
	launchPlan: FlowDeskRuntimeLaneLaunchPlanV1;
	launchResult: FlowDeskInjectedSdkRuntimeLaneLaunchResultV1;
	evidenceId: string;
	observedAt: string;
	timeoutMs?: number;
	orphanMaxAgeMs?: number;
	retryCount?: number;
}): FlowDeskRuntimeLaneLaunchLifecycleMaterializationResultV1 {
	if (typeof input.rootDir !== "string" || input.rootDir.trim().length === 0)
		return blockRuntimeLaneLaunchLifecycle({
			plan: input.launchPlan,
			evidenceId: input.evidenceId,
			reason: "rootDir is required",
		});
	const planValidation = validateFlowDeskRuntimeLaneLaunchPlanV1(input.launchPlan);
	if (!planValidation.ok || input.launchPlan.state !== "launch_ready")
		return blockRuntimeLaneLaunchLifecycle({
			plan: input.launchPlan,
			evidenceId: input.evidenceId,
			reason:
				planValidation.errors.join(", ") ||
				"runtime lane launch plan must be launch_ready",
		});
	if (
		input.launchResult.status !== "lane_launch_started" &&
		input.launchResult.status !== "lane_launch_failed"
	)
		return blockRuntimeLaneLaunchLifecycle({
			plan: input.launchPlan,
			evidenceId: input.evidenceId,
			reason: "runtime lane launch result must be started or failed",
		});
	if (
		input.launchResult.workflowId !== input.launchPlan.workflow_id ||
		input.launchResult.attemptId !== input.launchPlan.attempt_id ||
		input.launchResult.laneId !== input.launchPlan.lane_id ||
		input.launchResult.parentSessionRef !== input.launchPlan.parent_session_ref
	)
		return blockRuntimeLaneLaunchLifecycle({
			plan: input.launchPlan,
			evidenceId: input.evidenceId,
			reason: "runtime lane launch result does not match launch plan binding",
		});
	const state: FlowDeskLaneLifecycleRecordV1["state"] =
		input.launchResult.status === "lane_launch_started"
			? "running"
			: "invocation_failed";
	const record: FlowDeskLaneLifecycleRecordV1 = {
		schema_version: "flowdesk.lane_lifecycle_record.v1",
		lane_id: input.launchPlan.lane_id ?? "lane-missing",
		workflow_id: input.launchPlan.workflow_id ?? "workflow-missing",
		attempt_id: input.launchPlan.attempt_id ?? "attempt-missing",
		parent_session_ref: input.launchPlan.parent_session_ref ?? "ses-missing",
		...(input.launchResult.childSessionRef === undefined
			? {}
			: { child_session_ref: input.launchResult.childSessionRef }),
		...(lifecycleMessageRefFrom(input.launchResult.messageRef) === undefined
			? {}
			: { message_ref: lifecycleMessageRefFrom(input.launchResult.messageRef) }),
		agent_ref: input.launchPlan.agent_ref ?? "agent-missing",
		provider_qualified_model_id:
			input.launchPlan.provider_qualified_model_id ?? "claude/missing",
		state,
		timeout_ms: input.timeoutMs ?? 0,
		orphan_max_age_ms: input.orphanMaxAgeMs ?? 0,
		retry_count: input.retryCount ?? 0,
		created_at: input.observedAt,
		updated_at: input.observedAt,
		dispatch_authority_enabled: false,
		providerCall: false,
		actualLaneLaunch: false,
		runtimeExecution: false,
	};
	const preWriteReload = reloadFlowDeskSessionEvidenceV1({
		workflowId: record.workflow_id,
		rootDir: input.rootDir,
	});
	if (!preWriteReload.ok || preWriteReload.blocked.length > 0)
		return blockRuntimeLaneLaunchLifecycle({
			plan: input.launchPlan,
			evidenceId: input.evidenceId,
			reason: "lane lifecycle pre-write evidence reload failed",
			evidenceReloaded: false,
		});
	if (
		preWriteReload.entries.some(
			(entry) =>
				entry.evidenceClass === "lane_lifecycle" &&
				entry.evidenceId === input.evidenceId,
		)
	)
		return blockRuntimeLaneLaunchLifecycle({
			plan: input.launchPlan,
			evidenceId: input.evidenceId,
			reason: "lane lifecycle evidence already exists",
			evidenceReloaded: true,
		});
	const prepared = prepareFlowDeskSessionEvidenceWriteIntentV1({
		workflowId: record.workflow_id,
		evidenceId: input.evidenceId,
		record: record as unknown as Record<string, unknown>,
	});
	if (!prepared.ok || prepared.writeIntent === undefined)
		return blockRuntimeLaneLaunchLifecycle({
			plan: input.launchPlan,
			evidenceId: input.evidenceId,
			reason:
				prepared.errors.join(", ") || "lane lifecycle evidence intent invalid",
			evidenceReloaded: true,
		});
	const applied = applyFlowDeskSessionEvidenceWriteIntentsV1(input.rootDir, [
		prepared.writeIntent,
	]);
	if (!applied.ok)
		return blockRuntimeLaneLaunchLifecycle({
			plan: input.launchPlan,
			evidenceId: input.evidenceId,
			reason: applied.errors.join(", ") || "lane lifecycle evidence write failed",
			evidenceReloaded: true,
		});
	const postWriteReload = reloadFlowDeskSessionEvidenceV1({
		workflowId: record.workflow_id,
		rootDir: input.rootDir,
	});
	const persisted =
		postWriteReload.ok &&
		postWriteReload.entries.some(
			(entry) =>
				entry.evidenceClass === "lane_lifecycle" &&
				entry.evidenceId === input.evidenceId &&
				entry.record.lane_id === record.lane_id &&
				entry.record.state === record.state,
		);
	if (!persisted)
		return blockRuntimeLaneLaunchLifecycle({
			plan: input.launchPlan,
			evidenceId: input.evidenceId,
			reason: "lane lifecycle evidence reload verification failed",
			evidenceReloaded: false,
		});
	return {
		adapterProfile: "runtime_lane_launch_lifecycle_materializer",
		status: "lane_lifecycle_recorded",
		writeAttempted: true,
		evidenceReloaded: true,
		workflowId: record.workflow_id,
		attemptId: record.attempt_id,
		laneId: record.lane_id,
		evidenceId: input.evidenceId,
		lifecycleState: record.state,
		safeNextActions: ["/flowdesk-status"],
		authority: runtimeLaneLaunchLifecycleAuthority(true),
	};
}

export function materializeFlowDeskRuntimeLaneCompleteLifecycleEvidenceV1(input: {
	rootDir: string;
	launchPlan: FlowDeskRuntimeLaneLaunchPlanV1;
	launchResult: FlowDeskInjectedSdkRuntimeLaneLaunchResultV1;
	verdictObservation: FlowDeskInjectedSdkReviewerVerdictObservationResultV1;
	evidenceId: string;
	observedAt: string;
	outputRef: string;
	runtimeEchoRef: string;
	telemetryRef: string;
	timeoutMs?: number;
	orphanMaxAgeMs?: number;
	retryCount?: number;
}): FlowDeskRuntimeLaneLaunchLifecycleMaterializationResultV1 {
	if (typeof input.rootDir !== "string" || input.rootDir.trim().length === 0)
		return blockRuntimeLaneLaunchLifecycle({
			plan: input.launchPlan,
			evidenceId: input.evidenceId,
			reason: "rootDir is required",
		});
	const planValidation = validateFlowDeskRuntimeLaneLaunchPlanV1(input.launchPlan);
	if (!planValidation.ok || input.launchPlan.state !== "launch_ready")
		return blockRuntimeLaneLaunchLifecycle({
			plan: input.launchPlan,
			evidenceId: input.evidenceId,
			reason:
				planValidation.errors.join(", ") ||
				"runtime lane launch plan must be launch_ready",
		});
	if (input.launchResult.status !== "lane_launch_started")
		return blockRuntimeLaneLaunchLifecycle({
			plan: input.launchPlan,
			evidenceId: input.evidenceId,
			reason: "runtime lane launch result must be lane_launch_started",
		});
	if (
		input.launchResult.workflowId !== input.launchPlan.workflow_id ||
		input.launchResult.attemptId !== input.launchPlan.attempt_id ||
		input.launchResult.laneId !== input.launchPlan.lane_id ||
		input.launchResult.parentSessionRef !== input.launchPlan.parent_session_ref
	)
		return blockRuntimeLaneLaunchLifecycle({
			plan: input.launchPlan,
			evidenceId: input.evidenceId,
			reason: "runtime lane launch result does not match launch plan binding",
		});
	if (
		input.verdictObservation.status !== "verdict_observed" ||
		input.verdictObservation.verdict === undefined ||
		input.verdictObservation.verdictId === undefined
	)
		return blockRuntimeLaneLaunchLifecycle({
			plan: input.launchPlan,
			evidenceId: input.evidenceId,
			reason: "reviewer verdict observation must be verdict_observed",
		});
	if (input.verdictObservation.workflowId !== input.launchPlan.workflow_id)
		return blockRuntimeLaneLaunchLifecycle({
			plan: input.launchPlan,
			evidenceId: input.evidenceId,
			reason: "reviewer verdict observation workflow does not match launch plan",
		});
	const verdictValidation = validateTopTierReviewVerdictV1(
		input.verdictObservation.verdict,
	);
	if (!verdictValidation.ok)
		return blockRuntimeLaneLaunchLifecycle({
			plan: input.launchPlan,
			evidenceId: input.evidenceId,
			reason:
				verdictValidation.errors.join(", ") || "reviewer verdict is invalid",
		});
	const childSessionRef = input.launchResult.childSessionRef;
	const messageRef = lifecycleMessageRefFrom(input.launchResult.messageRef);
	if (childSessionRef === undefined || messageRef === undefined)
		return blockRuntimeLaneLaunchLifecycle({
			plan: input.launchPlan,
			evidenceId: input.evidenceId,
			reason: "complete lane lifecycle requires child and message refs",
		});
	const record: FlowDeskLaneLifecycleRecordV1 = {
		schema_version: "flowdesk.lane_lifecycle_record.v1",
		lane_id: input.launchPlan.lane_id ?? "lane-missing",
		workflow_id: input.launchPlan.workflow_id ?? "workflow-missing",
		attempt_id: input.launchPlan.attempt_id ?? "attempt-missing",
		parent_session_ref: input.launchPlan.parent_session_ref ?? "ses-missing",
		child_session_ref: childSessionRef,
		message_ref: messageRef,
		agent_ref: input.launchPlan.agent_ref ?? "agent-missing",
		provider_qualified_model_id:
			input.launchPlan.provider_qualified_model_id ?? "claude/missing",
		state: "complete",
		verdict_ref: input.verdictObservation.verdictId,
		output_ref: input.outputRef,
		runtime_echo_ref: input.runtimeEchoRef,
		telemetry_ref: input.telemetryRef,
		timeout_ms: input.timeoutMs ?? 0,
		orphan_max_age_ms: input.orphanMaxAgeMs ?? 0,
		retry_count: input.retryCount ?? 0,
		created_at: input.observedAt,
		updated_at: input.observedAt,
		dispatch_authority_enabled: false,
		providerCall: false,
		actualLaneLaunch: false,
		runtimeExecution: false,
	};
	const preWriteReload = reloadFlowDeskSessionEvidenceV1({
		workflowId: record.workflow_id,
		rootDir: input.rootDir,
	});
	if (!preWriteReload.ok || preWriteReload.blocked.length > 0)
		return blockRuntimeLaneLaunchLifecycle({
			plan: input.launchPlan,
			evidenceId: input.evidenceId,
			reason: "complete lane lifecycle pre-write evidence reload failed",
			evidenceReloaded: false,
		});
	if (
		preWriteReload.entries.some(
			(entry) =>
				entry.evidenceClass === "lane_lifecycle" &&
				entry.evidenceId === input.evidenceId,
		)
	)
		return blockRuntimeLaneLaunchLifecycle({
			plan: input.launchPlan,
			evidenceId: input.evidenceId,
			reason: "lane lifecycle evidence already exists",
			evidenceReloaded: true,
		});
	const prepared = prepareFlowDeskSessionEvidenceWriteIntentV1({
		workflowId: record.workflow_id,
		evidenceId: input.evidenceId,
		record: record as unknown as Record<string, unknown>,
	});
	if (!prepared.ok || prepared.writeIntent === undefined)
		return blockRuntimeLaneLaunchLifecycle({
			plan: input.launchPlan,
			evidenceId: input.evidenceId,
			reason:
				prepared.errors.join(", ") ||
				"complete lane lifecycle evidence intent invalid",
			evidenceReloaded: true,
		});
	const applied = applyFlowDeskSessionEvidenceWriteIntentsV1(input.rootDir, [
		prepared.writeIntent,
	]);
	if (!applied.ok)
		return blockRuntimeLaneLaunchLifecycle({
			plan: input.launchPlan,
			evidenceId: input.evidenceId,
			reason:
				applied.errors.join(", ") ||
				"complete lane lifecycle evidence write failed",
			evidenceReloaded: true,
		});
	const postWriteReload = reloadFlowDeskSessionEvidenceV1({
		workflowId: record.workflow_id,
		rootDir: input.rootDir,
	});
	const persisted =
		postWriteReload.ok &&
		postWriteReload.entries.some(
			(entry) =>
				entry.evidenceClass === "lane_lifecycle" &&
				entry.evidenceId === input.evidenceId &&
				entry.record.state === "complete" &&
				entry.record.verdict_ref === input.verdictObservation.verdictId,
		);
	if (!persisted)
		return blockRuntimeLaneLaunchLifecycle({
			plan: input.launchPlan,
			evidenceId: input.evidenceId,
			reason: "complete lane lifecycle evidence reload verification failed",
			evidenceReloaded: false,
		});
	return {
		adapterProfile: "runtime_lane_launch_lifecycle_materializer",
		status: "lane_lifecycle_recorded",
		writeAttempted: true,
		evidenceReloaded: true,
		workflowId: record.workflow_id,
		attemptId: record.attempt_id,
		laneId: record.lane_id,
		evidenceId: input.evidenceId,
		lifecycleState: "complete",
		safeNextActions: ["/flowdesk-status"],
		authority: runtimeLaneLaunchLifecycleAuthority(true),
	};
}

function promptTextFrom(
	request: FlowDeskManagedDispatchBetaDispatchRequestV1,
): string | undefined {
	const text =
		request.promptText?.trim() ?? request.promptSummary?.trim() ?? "";
	return text.length > 0 ? text.slice(0, 20_000) : undefined;
}

function dispatchOptions(
	request: FlowDeskManagedDispatchBetaDispatchRequestV1,
	model: { providerID: string; modelID: string },
	text: string,
): FlowDeskManagedDispatchBetaPromptOptionsV1 {
	return {
		path: { id: request.sessionId },
		...(request.directory === undefined
			? {}
			: { query: { directory: request.directory } }),
		body: {
			model,
			agent: request.agent,
			parts: [{ type: "text", text }],
		},
	};
}

function managedDispatchLaneLaunchPlan(input: {
	boundaryInput: ManagedDispatchBetaBoundaryInputV1;
	request: FlowDeskManagedDispatchBetaDispatchRequestV1;
	manifest: FlowDeskDispatchAttemptManifestV1;
	sdkClientAvailable: boolean;
}): FlowDeskRuntimeLaneLaunchPlanV1 {
	const laneId = input.request.laneId ?? `lane-${input.manifest.attempt_id}`;
	return planFlowDeskRuntimeLaneLaunchV1({
		request: {
			schema_version: "flowdesk.runtime_lane_launch_request.v1",
			launch_request_id:
				input.request.launchRequestId ??
				`launch-request-${input.manifest.attempt_id}`,
			workflow_id: input.manifest.workflow_id,
			attempt_id: input.manifest.attempt_id,
			lane_id: laneId,
			parent_session_ref: refFrom("ses", input.request.sessionId),
			agent_ref: refFrom("agent", input.request.agent),
			provider_qualified_model_id: input.request.provider_qualified_model_id,
			launch_reason: "managed_dispatch",
			pre_launch_audit_ref: input.manifest.pre_dispatch_audit_ref,
			lane_launch_approval_ref: input.manifest.consumed_approval_ref,
			requested_at: input.manifest.created_at,
			timeout_ms: 60_000,
			orphan_max_age_ms: 180_000,
			retry_budget: 0,
			dispatch_authority_enabled: false,
			providerCall: false,
			actualLaneLaunch: false,
			runtimeExecution: false,
		},
		sdkClientAvailable: input.sdkClientAvailable,
		durableEvidenceRootRef: `evidence-root-${input.manifest.workflow_id}`,
	});
}

export async function dispatchManagedDispatchBetaPromptV1(input: {
	client: FlowDeskManagedDispatchBetaOpenCodeClientV1;
	boundaryInput: ManagedDispatchBetaBoundaryInputV1;
	request: FlowDeskManagedDispatchBetaDispatchRequestV1;
	dispatchManifest?: FlowDeskDispatchAttemptManifestV1;
	reloadedEvidence?: FlowDeskSessionEvidenceReloadResultV1;
	reservationStore?: FlowDeskManagedDispatchBetaReservationStoreV1;
	durableStateRootDir?: string;
}): Promise<FlowDeskManagedDispatchBetaAdapterResultV1> {
	const guardDecision = evaluateManagedDispatchBetaGuardBoundaryV1(
		input.boundaryInput,
	);
	if (guardDecision.status !== "eligible")
		return blocked(input.boundaryInput, guardDecision);

	const approvedProviderQualifiedModelId =
		input.boundaryInput.guardApproval?.provider_qualified_model_id;
	if (
		approvedProviderQualifiedModelId === undefined ||
		input.request.provider_qualified_model_id !==
			approvedProviderQualifiedModelId
	) {
		return blocked(
			input.boundaryInput,
			guardDecision,
			"Dispatch request model must exactly match Guard-approved provider-qualified model.",
		);
	}

	const model = parseProviderQualifiedModelId(approvedProviderQualifiedModelId);
	if (
		model === undefined ||
		model.providerID !== input.boundaryInput.guardApproval?.provider_family
	) {
		return blocked(
			input.boundaryInput,
			guardDecision,
			"Guard-approved provider-qualified model is invalid or provider-mismatched.",
		);
	}

	const runtimeModel = opencodeRuntimeModelForFlowDeskModel(model);
	if (runtimeModel === undefined) {
		return blocked(
			input.boundaryInput,
			guardDecision,
			"Guard-approved provider family is not mapped to an OpenCode runtime provider.",
		);
	}

	const text = promptTextFrom(input.request);
	if (
		input.request.sessionId.trim().length === 0 ||
		input.request.agent.trim().length === 0 ||
		text === undefined
	) {
		return blocked(
			input.boundaryInput,
			guardDecision,
			"Dispatch request is missing session, agent, or bounded prompt text.",
		);
	}

	if (
		input.dispatchManifest === undefined ||
		input.reloadedEvidence === undefined
	) {
		return blocked(
			input.boundaryInput,
			guardDecision,
			"Dispatch attempt manifest and durable evidence reload are required before SDK call.",
		);
	}
	const precall = evaluateFlowDeskDispatchAttemptDurablePrecallV1({
		manifest: input.dispatchManifest,
		reloadedEvidence: input.reloadedEvidence,
	});
	if (!precall.sdk_call_permitted) {
		return blocked(
			input.boundaryInput,
			guardDecision,
			`Dispatch pre-call gate blocked: ${precall.blocked_labels.join(",") || precall.errors.join(",") || "unknown"}.`,
		);
	}
	const consumedApproval = input.reloadedEvidence.entries.find(
		(entry) =>
			entry.evidenceClass === "production_approval_source" &&
			entry.record.approval_id === input.dispatchManifest?.approval_ref,
	)?.record as FlowDeskProductionApprovalSourceV1 | undefined;
	if (consumedApproval === undefined) {
		return blocked(
			input.boundaryInput,
			guardDecision,
			"Durable dispatch pre-call gate did not expose a reloaded consumed approval source.",
		);
	}
	const {
		durable_provenance_required: _durableProvenanceRequired,
		reloaded_approval_source_ref: _reloadedApprovalSourceRef,
		reloaded_pre_dispatch_audit_ref: _reloadedPreDispatchAuditRef,
		reloaded_idempotency_snapshot_ref: _reloadedIdempotencySnapshotRef,
		...promotionPrecall
	} = precall;

	if (
		input.boundaryInput.preDispatchAuditRef === undefined ||
		input.boundaryInput.runtimeEchoEvidence?.conformance_ref === undefined
	) {
		return blocked(
			input.boundaryInput,
			guardDecision,
			"Managed-dispatch promotion requires matching audit and conformance refs before SDK call.",
		);
	}
	const promotion = promoteFlowDeskManagedDispatchBetaAuthorityV1({
		guardDecision,
		precallEvaluation: promotionPrecall,
		consumedApproval,
		auditRef: input.boundaryInput.preDispatchAuditRef,
		conformanceRef: input.boundaryInput.runtimeEchoEvidence.conformance_ref,
	});
	if (
		!promotion.ok ||
		promotion.managed_dispatch_beta_authority_enabled !== true
	) {
		return blocked(
			input.boundaryInput,
			guardDecision,
			`Managed-dispatch promotion blocked: ${promotion.errors.join(",") || "unknown"}.`,
		);
	}

	const dispatchMethod = input.request.dispatchMethod ?? "promptAsync";
	const dispatch = input.client.session[dispatchMethod];
	if (dispatch === undefined)
		return blocked(
			input.boundaryInput,
			guardDecision,
			"Injected OpenCode client is missing the requested session prompt method.",
		);

	if (input.reservationStore === undefined) {
		return blocked(
			input.boundaryInput,
			guardDecision,
			"Dispatch idempotency reservation materialization is required before SDK call.",
		);
	}
	const reservation = await input.reservationStore.reserve({
		manifest: input.dispatchManifest,
		reloadedEvidence: input.reloadedEvidence,
	});
	if (!reservation.ok || reservation.reservationEvidenceReloaded !== true) {
		return blocked(
			input.boundaryInput,
			guardDecision,
			`Dispatch idempotency reservation materialization blocked: ${reservation.redactedFailureReason ?? "reload not proven"}.`,
		);
	}
	const dispatchMode = input.request.dispatchMode ?? "prompt";
	if (dispatchMode === "lane_launch") {
		const launchPlan = managedDispatchLaneLaunchPlan({
			boundaryInput: input.boundaryInput,
			request: input.request,
			manifest: input.dispatchManifest,
			sdkClientAvailable: input.client.session.create !== undefined,
		});
		const launchResult = await launchFlowDeskInjectedSdkRuntimeLaneFromPlanV1({
			client: input.client,
			launchPlan,
			request: {
				allowActualLaneLaunch: input.request.allowActualLaneLaunch === true,
				parentSessionId: input.request.sessionId,
				promptText: text,
				...(input.request.directory === undefined
					? {}
					: { directory: input.request.directory }),
				dispatchMethod,
				...(input.request.laneTitle === undefined
					? {}
					: { title: input.request.laneTitle }),
			},
		});
		if (launchResult.status !== "lane_launch_started") {
			return {
				adapterProfile: flowdeskManagedDispatchBetaAdapterProfile,
				status: "dispatch_failed",
				dispatchAttempted: true,
				dispatchMethod,
				guardDecision,
				sessionId: input.request.sessionId,
				agent: input.request.agent,
				model: runtimeModel,
				...(input.request.directory === undefined
					? {}
					: { directory: input.request.directory }),
				redactedErrorCategory: "runtime",
				authority: { ...enabledDispatchAuthority(), runtimeExecution: false },
				verification: verificationFor(input.boundaryInput),
			};
		}
		if (input.durableStateRootDir !== undefined) {
			const lifecycle = materializeFlowDeskRuntimeLaneLaunchLifecycleEvidenceV1({
				rootDir: input.durableStateRootDir,
				launchPlan,
				launchResult,
				evidenceId: `lifecycle-managed-dispatch-${launchPlan.lane_id}`,
				observedAt: new Date().toISOString(),
				timeoutMs: 60_000,
				orphanMaxAgeMs: 180_000,
				retryCount: 0,
			});
			if (lifecycle.status !== "lane_lifecycle_recorded") {
				return {
					adapterProfile: flowdeskManagedDispatchBetaAdapterProfile,
					status: "dispatch_failed",
					dispatchAttempted: true,
					dispatchMethod,
					guardDecision,
					sessionId: input.request.sessionId,
					agent: input.request.agent,
					model: runtimeModel,
					...(input.request.directory === undefined
						? {}
						: { directory: input.request.directory }),
					redactedErrorCategory: "runtime",
					authority: { ...enabledDispatchAuthority(), runtimeExecution: false },
					verification: verificationFor(input.boundaryInput),
				};
			}
		}
		const completedRecord =
			input.reservationStore.recordDispatchCompleted === undefined
				? { ok: true, reservationEvidenceReloaded: true }
				: await input.reservationStore.recordDispatchCompleted({
						manifest: input.dispatchManifest,
						reloadedEvidence: input.reloadedEvidence,
					});
		if (!completedRecord.ok || completedRecord.reservationEvidenceReloaded !== true) {
			return {
				adapterProfile: flowdeskManagedDispatchBetaAdapterProfile,
				status: "dispatch_failed",
				dispatchAttempted: true,
				dispatchMethod,
				guardDecision,
				sessionId: input.request.sessionId,
				agent: input.request.agent,
				model: runtimeModel,
				...(input.request.directory === undefined
					? {}
					: { directory: input.request.directory }),
				redactedErrorCategory: "runtime",
				authority: { ...enabledDispatchAuthority(), runtimeExecution: false },
				verification: verificationFor(input.boundaryInput),
			};
		}
		return {
			adapterProfile: flowdeskManagedDispatchBetaAdapterProfile,
			status: "dispatch_accepted",
			dispatchAttempted: true,
			dispatchMethod,
			guardDecision,
			sessionId: input.request.sessionId,
			agent: input.request.agent,
			model: runtimeModel,
			...(input.request.directory === undefined
				? {}
				: { directory: input.request.directory }),
			...(launchResult.laneId === undefined ? {} : { laneId: launchResult.laneId }),
			...(launchResult.childSessionRef === undefined
				? {}
				: { childSessionRef: launchResult.childSessionRef }),
			...(launchResult.messageRef === undefined
				? {}
				: { messageRef: launchResult.messageRef }),
			authority: { ...enabledDispatchAuthority(), actualLaneLaunch: true },
			verification: verificationFor(input.boundaryInput),
		};
	}

	const options = dispatchOptions(input.request, runtimeModel, text);
	let response: unknown;
	try {
		response = await dispatch.call(input.client.session, options);
	} catch {
		const failureRecord = await input.reservationStore.recordDispatchFailure({
			manifest: input.dispatchManifest,
			reloadedEvidence: input.reloadedEvidence,
		});
		return {
			adapterProfile: flowdeskManagedDispatchBetaAdapterProfile,
			status: "dispatch_failed",
			dispatchAttempted: true,
			dispatchMethod,
			guardDecision,
			sessionId: input.request.sessionId,
			agent: input.request.agent,
			model: runtimeModel,
			...(input.request.directory === undefined
				? {}
				: { directory: input.request.directory }),
			redactedErrorCategory:
				failureRecord.ok && failureRecord.reservationEvidenceReloaded
					? "provider_api"
					: "runtime",
			authority: { ...enabledDispatchAuthority(), runtimeExecution: false },
			verification: verificationFor(input.boundaryInput),
		};
	}
	const completedRecord =
		input.reservationStore.recordDispatchCompleted === undefined
			? { ok: true, reservationEvidenceReloaded: true }
			: await input.reservationStore.recordDispatchCompleted({
					manifest: input.dispatchManifest,
					reloadedEvidence: input.reloadedEvidence,
				});
	if (!completedRecord.ok || completedRecord.reservationEvidenceReloaded !== true) {
		return {
			adapterProfile: flowdeskManagedDispatchBetaAdapterProfile,
			status: "dispatch_failed",
			dispatchAttempted: true,
			dispatchMethod,
			guardDecision,
			sessionId: input.request.sessionId,
			agent: input.request.agent,
			model: runtimeModel,
			...(input.request.directory === undefined
				? {}
				: { directory: input.request.directory }),
			redactedErrorCategory: "runtime",
			authority: { ...enabledDispatchAuthority(), runtimeExecution: false },
			verification: verificationFor(input.boundaryInput),
		};
	}
	return {
		adapterProfile: flowdeskManagedDispatchBetaAdapterProfile,
		status:
			dispatchMethod === "promptAsync"
				? "dispatch_accepted"
				: "dispatch_completed",
		dispatchAttempted: true,
		dispatchMethod,
		guardDecision,
		sessionId: input.request.sessionId,
		agent: input.request.agent,
		model: runtimeModel,
		...(input.request.directory === undefined
			? {}
			: { directory: input.request.directory }),
		...(response === undefined ? {} : { response }),
		authority: enabledDispatchAuthority(),
		verification: verificationFor(input.boundaryInput),
	};
}
