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
	validateFlowDeskPermissionAskDecisionV1,
	validateFlowDeskPromptNoReplyDecisionV1,
	validateFlowDeskSessionAbortDecisionV1,
	validateNoForbiddenRawPayloads,
	validateTopTierReviewVerdictV1,
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
}

export interface FlowDeskExactModelProviderAcquisitionClientV1 {
	checkExactModelAvailability(
		request: FlowDeskExactModelProviderAcquisitionClientRequestV1,
	): Promise<FlowDeskExactModelProviderAcquisitionClientResultV1> | FlowDeskExactModelProviderAcquisitionClientResultV1;
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

export interface FlowDeskManagedDispatchBetaOpenCodeClientV1 {
	session: {
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

	let clientResult: FlowDeskExactModelProviderAcquisitionClientResultV1;
	let providerCallAttempted = false;
	try {
		providerCallAttempted = true;
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
	} catch {
		clientResult = {
			outcome: "blocked",
			blocked_labels: ["provider_acquisition_client_error"],
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
}): FlowDeskReviewerTypedVerdictAcceptanceAdapterResultV1 {
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
}): FlowDeskDurableReviewerVerdictLinkageAdapterResultV1 {
	const acceptance = prepareFlowDeskReviewerTypedVerdictAcceptanceAdapterV1({
		workflowId: input.workflowId,
		attemptId: input.attemptId,
		verdicts: input.verdicts,
		consumedApproval: input.consumedApproval,
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
			return "anthropic";
		case "gemini":
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

function arrayData(value: unknown): unknown[] {
	const data = responseData(value);
	if (Array.isArray(data)) return data;
	const record = asRecord(data);
	return Array.isArray(record?.items) ? record.items : [];
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

function firstMessageRef(value: unknown): string | undefined {
	const messages = arrayData(value);
	for (const message of messages) {
		const record = asRecord(message);
		const info = asRecord(record?.info) ?? record;
		if (typeof info?.id === "string") return refFrom("message", info.id);
	}
	return undefined;
}

function messageTextCandidates(value: unknown): string[] {
	return arrayData(value).flatMap((message) => {
		const record = asRecord(message);
		const parts = Array.isArray(record?.parts) ? record.parts : [];
		return parts
			.flatMap((part) => {
				const partRecord = asRecord(part);
				const text =
					typeof partRecord?.text === "string"
						? partRecord.text
						: typeof partRecord?.content === "string"
							? partRecord.content
							: undefined;
				return text === undefined || text.length > 20_000 ? [] : [text.trim()];
			})
			.filter((text) => text.startsWith("{") && text.endsWith("}"));
	});
}

function parseJsonCandidate(text: string): unknown | undefined {
	try {
		return JSON.parse(text) as unknown;
	} catch {
		return undefined;
	}
}

function topTierVerdictCandidates(messagesResponse: unknown): unknown[] {
	const direct = arrayData(messagesResponse).filter(
		(message) =>
			asRecord(message)?.schema_version ===
			"flowdesk.top_tier_review_verdict.v1",
	);
	const parsed = messageTextCandidates(messagesResponse)
		.map(parseJsonCandidate)
		.filter((candidate) => candidate !== undefined);
	return [...direct, ...parsed];
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
		const messagesResponse = await messages.call(input.client.session, {
			path: { id: input.request.sessionId },
			...(input.request.directory === undefined
				? {}
				: { query: { directory: input.request.directory } }),
		});
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
			redactedErrors: [...new Set(errors)],
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
		const childrenResponse = await children.call(input.client.session, {
			path: { id: input.request.parentSessionId },
			...(input.request.directory === undefined
				? {}
				: { query: { directory: input.request.directory } }),
		});
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
			const messagesResponse = await input.client.session.messages.call(
				input.client.session,
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

export async function dispatchManagedDispatchBetaPromptV1(input: {
	client: FlowDeskManagedDispatchBetaOpenCodeClientV1;
	boundaryInput: ManagedDispatchBetaBoundaryInputV1;
	request: FlowDeskManagedDispatchBetaDispatchRequestV1;
	dispatchManifest?: FlowDeskDispatchAttemptManifestV1;
	reloadedEvidence?: FlowDeskSessionEvidenceReloadResultV1;
	reservationStore?: FlowDeskManagedDispatchBetaReservationStoreV1;
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
