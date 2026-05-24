import {
	type FlowDeskChatHookAuthorityProbeV1,
	type FlowDeskChatIntakeRequestV1,
	type FlowDeskConfiguredVerificationResultV1,
	type FlowDeskDispatchAttemptManifestV1,
	type FlowDeskDefaultManagedDispatchAuthorizationV1,
	type FlowDeskExternalAuthProviderPolicyResultV1,
	type FlowDeskFallbackDecisionV1,
	type FlowDeskProductionApprovalSourceV1,
	type FlowDeskProductionApprovalDecisionV1,
	type FlowDeskRelease1MinimumPortableCommandName,
	type FlowDeskRelease1MinimumToolName,
	type FlowDeskSanitizedAuthCaptureResultV1,
	type FlowDeskReviewerFanoutFromReloadedCacheEvidenceInputV1,
	type FlowDeskReviewerFanoutFromReloadedCacheEvidencePlanV1,
	type FlowDeskRuntimeLaneLaunchPlanV1,
	type FlowDeskSessionEvidenceReloadResultV1,
	type FlowDeskTopTierReviewPerspective,
	type FlowDeskTopTierReviewVerdictV1,
	type FlowDeskToolRequestEnvelopeV1,
	type ManagedDispatchBetaBoundaryInputV1,
	type SafeNextAction,
	applyFlowDeskSessionEvidenceWriteIntentsV1,
	createFlowDeskChatHookAuthorityProbeV1,
	evaluateFlowDeskChatIntakeV1,
	getFlowDeskPortableCommandToolName,
	getRelease1SchemaArtifact,
	materializeFlowDeskExactModelCacheEvidenceFromProviderAcquisitionEvidenceV1,
	materializeFlowDeskRuntimeLaneLaunchPlansFromReviewerFanoutEvidenceV1,
	planFlowDeskReviewerFanoutFromReloadedCacheEvidenceV1,
	prepareFlowDeskSessionEvidenceWriteIntentV1,
	reloadFlowDeskSessionEvidenceV1,
	validateFlowDeskDefaultManagedDispatchAuthorizationV1,
	validateRunRequestV1,
} from "@flowdesk/core";
import { type Plugin, type PluginModule, type PluginOptions, tool } from "@opencode-ai/plugin";
import type { z } from "zod";
import {
	flowdeskPluginId,
	flowdeskPluginScaffold,
	hasProductionOpenCodeRegistration,
} from "./index.js";
import {
	createFlowDeskLocalNonDispatchAdapterSession,
	flowdeskLocalNonDispatchAdapterProfile,
	type FlowDeskLocalClockV1,
	type FlowDeskLocalNonDispatchAdapterSessionV1,
	type FlowDeskLocalProductionEnablementOptionsV1,
	type FlowDeskLocalReviewerFanoutDiagnosticsOptionsV1,
} from "./local-adapter.js";
import {
	type FlowDeskExactModelProviderAcquisitionClientV1,
	type FlowDeskExactModelProviderAcquisitionLiveTestRequestV1,
	type FlowDeskManagedDispatchBetaAdapterResultV1,
	type FlowDeskManagedDispatchBetaDispatchRequestV1,
	type FlowDeskManagedDispatchBetaOpenCodeClientV1,
	type FlowDeskManagedDispatchBetaReservationStoreV1,
	createFlowDeskManagedDispatchBetaDurableReservationStoreV1,
	createFlowDeskOpenCodeMetadataProviderAcquisitionClientV1,
	createFlowDeskOpenCodePromptBackedProviderAcquisitionClientV1,
	dispatchManagedDispatchBetaPromptV1,
	launchFlowDeskInjectedSdkRuntimeLaneFromPlanV1,
	materializeFlowDeskManagedFallbackRegatePlanEvidenceV1,
	materializeFlowDeskObservedReviewerVerdictEvidenceV1,
	materializeFlowDeskRuntimeLaneCompleteLifecycleEvidenceV1,
	materializeFlowDeskRuntimeLaneLaunchLifecycleEvidenceV1,
	observeInjectedSdkReviewerVerdictV1,
	orchestrateFlowDeskManagedFallbackRegateV1,
	prepareFlowDeskDurableReviewerVerdictLinkageAdapterV1,
	prepareFlowDeskReviewerTypedVerdictAcceptanceAdapterV1,
	runFlowDeskExactModelProviderAcquisitionLiveTestV1,
} from "./managed-dispatch-adapter.js";
import {
	type FlowDeskRuntimeReviewerExecutionExpectationV1,
	executeFlowDeskRuntimeReviewerExecutionBridgeV1,
	redactedRuntimeReviewerExecutionBlocked,
	runtimeReviewerExecutionExpectationsFromValue,
} from "./runtime-reviewer-execution-bridge.js";
import {
	type FlowDeskQuickReviewerRunResultV1,
	executeFlowDeskQuickReviewerRunV1,
} from "./quick-reviewer-run.js";
import {
	type FlowDeskProviderUsageLiveConfigV1,
	type FlowDeskProviderUsageLiveProviderFamilyV1,
	executeFlowDeskProviderUsageLiveV1,
} from "./provider-usage-live-tool.js";
import {
	type FlowDeskStatusLiveConfigV1,
	executeFlowDeskStatusLiveV1,
} from "./status-live-tool.js";
import {
	type FlowDeskQuickFallbackRunConfigV1,
	executeFlowDeskQuickFallbackRunV1,
} from "./quick-fallback-run.js";
import {
	type FlowDeskLaneHeartbeatWriteRequestV1,
	recordFlowDeskLaneHeartbeatV1,
} from "./lane-heartbeat-writer.js";
import {
	FLOWDESK_PRE_SPIKE_PLUGIN_TOOL_STUBS,
	getFlowDeskRelease1HandlerReadinessSummary,
	getFlowDeskRelease1ProductionReadinessSummary,
	hasPassingFds1SchemaConversionSpike,
	runFlowDeskPreSpikePluginToolStub,
} from "./tool-stubs.js";

export const flowdeskPreSpikeDoctorToolName =
	"flowdesk_pre_spike_doctor" as const;
export const flowdeskChatIntakeToolName = "flowdesk_chat_intake" as const;
export const flowdeskFds1SchemaConversionProbeOption =
	"fds1SchemaConversionProbe" as const;
export const flowdeskLocalNonDispatchAdapterOption =
	"localNonDispatchAdapter" as const;
export const flowdeskNaturalLanguageRoutingOption =
	"naturalLanguageRouting" as const;
export const flowdeskDurableStateRootOption = "durableStateRoot" as const;
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
export const flowdeskLaneHeartbeatWriterOption =
	"laneHeartbeatWriter" as const;
export const flowdeskDefaultManagedDispatchAuthorizationOption =
	"defaultManagedDispatchAuthorization" as const;
export const flowdeskManagedDispatchBetaToolName =
	"flowdesk_managed_dispatch_beta" as const;
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
export const flowdeskQuickFallbackRunToolName =
	"flowdesk_quick_fallback_run" as const;
export const flowdeskLaneHeartbeatWriterToolName =
	"flowdesk_lane_heartbeat_record" as const;

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

export interface FlowDeskManagedDispatchRunRouteOptionsV1 {
	client?: FlowDeskManagedDispatchBetaOpenCodeClientV1;
	reservationStore?: FlowDeskManagedDispatchBetaReservationStoreV1;
	durableStateRootDir?: string;
	defaultAuthorization?: FlowDeskDefaultManagedDispatchAuthorizationV1;
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
	return isRecord(value) && typeof value.checkExactModelAvailability === "function";
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
	| "user_approval_ref";

const chatEnvelopeOptionalFields: readonly FlowDeskRequestEnvelopeOptionalField[] =
	["workflow_id", "session_ref", "redacted_intake_ref", "user_approval_ref"];

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
				"FlowDesk chat intake requested a non-dispatch retry diagnostic.",
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
) {
	const evaluation = evaluateFlowDeskChatIntakeV1({
		request,
		chatIntakeMode: "steering",
		hookHarnessMode: "enforce",
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

function previewNaturalLanguageRouting(request: FlowDeskChatIntakeRequestV1) {
	const evaluation = evaluateFlowDeskChatIntakeV1({
		request,
		chatIntakeMode: "steering",
		hookHarnessMode: "enforce",
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

export function createFlowDeskLocalNonDispatchAdapterTools(
	now = new Date(),
	session = createFlowDeskLocalNonDispatchAdapterSession(now),
	managedDispatchRunRoute: FlowDeskManagedDispatchRunRouteOptionsV1 = {},
): Record<string, FlowDeskOpenCodeTool> {
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
					description: `FlowDesk local non-dispatch command adapter for ${stub.toolName}; no provider call, real dispatch, or lane launch.`,
					args,
					async execute(request) {
						const record: Record<string, unknown> = isRecord(request) ? request : {};
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
		}),
	);
}

export function createFlowDeskNaturalLanguageRoutingTools(
	now = new Date(),
	session = createFlowDeskLocalNonDispatchAdapterSession(now),
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
				"FlowDesk natural-language chat intake steering; command-backed only, with no provider call, real dispatch, lane launch, fallback, or hard chat control.",
			args,
			async execute(request) {
				return JSON.stringify(
					evaluateNaturalLanguageRouting(
						request as unknown as FlowDeskChatIntakeRequestV1,
						session,
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
	result: Awaited<ReturnType<typeof runFlowDeskExactModelProviderAcquisitionLiveTestV1>>,
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
								...(cacheMaterialization.fanout.runtimeLaunchPlans === undefined
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
													cacheMaterialization.fanout.runtimeLaunchPlans
														.result.launchPlans.map(
															(plan) => plan.state,
														),
												launchPlanCount:
													cacheMaterialization.fanout.runtimeLaunchPlans
														.result.launchPlans.length,
												writeIntentCount:
													cacheMaterialization.fanout.runtimeLaunchPlans
														.result.writeIntents.length,
												launchAttempted:
													cacheMaterialization.fanout.runtimeLaunchPlans
														.result.launchPlans.some(
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
																		.runtimeReviewerExecution.result
																		.status,
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
		...(typeof value.observedAt === "string" && value.observedAt.trim().length > 0
			? { observedAt: value.observedAt }
			: {}),
		consumedReviewerFanoutApproval:
			value.consumedReviewerFanoutApproval as unknown as FlowDeskProductionApprovalSourceV1,
		verdictExpectations: expectations,
	};
}

function providerAcquisitionRuntimeLaunchPlanMaterializationFromValue(
	value: unknown,
): FlowDeskProviderAcquisitionRuntimeLaunchPlanMaterializationOptionsV1 | undefined {
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
		...(typeof value.requestedAt === "string" && value.requestedAt.trim().length > 0
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
		...(typeof value.timeoutMs === "number" ? { timeoutMs: value.timeoutMs } : {}),
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
): FlowDeskExactModelProviderAcquisitionCacheMaterializationOptionsV1 | undefined {
	const value = options?.[flowdeskExactModelProviderAcquisitionLiveTestOption];
	if (!isRecord(value) || !isRecord(value.cacheMaterialization)) return undefined;
	const cacheMaterialization = value.cacheMaterialization;
	if (
		cacheMaterialization.enabled !== true ||
		typeof cacheMaterialization.targetCacheEvidenceId !== "string" ||
		cacheMaterialization.targetCacheEvidenceId.trim().length === 0 ||
		typeof cacheMaterialization.targetCacheRefreshPlanEvidenceId !== "string" ||
		cacheMaterialization.targetCacheRefreshPlanEvidenceId.trim().length === 0
	)
		return undefined;
	const reviewerFanoutPlanning = providerAcquisitionReviewerFanoutPlanningFromValue(
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
		...(reviewerFanoutPlanning === undefined
			? {}
			: { reviewerFanoutPlanning }),
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
	const authorization = options.defaultAuthorization;
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
				});
				return JSON.stringify(redactedManagedDispatchBetaToolResult(result));
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
						adapterProfile: "exact_model_provider_acquisition_live_test_adapter",
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
				const result = await runFlowDeskExactModelProviderAcquisitionLiveTestV1({
					client,
					rootDir,
					request,
				});
				const materializationResult =
					cacheMaterialization !== undefined &&
					result.evidenceReloaded === true
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
									flowdeskPackageVersionRef:
										request.flowdeskPackageVersionRef,
									registryHash: request.registryHash,
									policyPackHash: request.policyPackHash,
									authAccountBoundaryRef:
										request.authAccountBoundaryRef,
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
								flowdeskPackageVersionRef:
									request.flowdeskPackageVersionRef,
								registryHash: request.registryHash,
								policyPackHash: request.policyPackHash,
								authAccountBoundaryRef:
									request.authAccountBoundaryRef,
								attemptId:
									cacheMaterialization.reviewerFanoutPlanning.attemptId,
								parentSessionRef:
									cacheMaterialization.reviewerFanoutPlanning
										.parentSessionRef,
								agentRef:
									cacheMaterialization.reviewerFanoutPlanning.agentRef,
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
								...(cacheMaterialization.reviewerFanoutPlanning.orphanMaxAgeMs ===
								undefined
									? {}
									: {
											orphanMaxAgeMs:
												cacheMaterialization.reviewerFanoutPlanning.orphanMaxAgeMs,
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
						? (cacheMaterialization.reviewerFanoutPlanning.fanoutPlanEvidenceId ??
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
									...(runtimeLaunchPlanOptions.durableEvidenceRootRef === undefined
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
					cacheMaterialization !== undefined && materializationResult !== undefined
						? {
								options: cacheMaterialization,
								result: materializationResult,
								...(cacheMaterialization.reviewerFanoutPlanning !== undefined &&
								fanoutResult !== undefined
									? {
											fanout: {
												options:
													cacheMaterialization.reviewerFanoutPlanning,
												result: fanoutResult,
												persistedEvidenceId:
													fanoutPersistedEvidenceId,
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
																runtimeReviewerExecutionResult !==
																	undefined
																	? {
																			runtimeReviewerExecution: {
																				options:
																					runtimeReviewerExecutionOptions,
																				result:
																					runtimeReviewerExecutionResult,
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
}

export function createFlowDeskNaturalLanguageChatMessageHook(
	now: FlowDeskLocalClockV1 = () => new Date(),
	session = createFlowDeskLocalNonDispatchAdapterSession(now),
	stallAlert?: FlowDeskChatMessageStallAlertOptionsV1,
) {
	const recentSuggestionCards = new Map<string, number>();
	const recentStallAlerts = new Map<string, number>();
	return async function message(
		input: unknown,
		output: FlowDeskChatMessageOutput,
	): Promise<void> {
		const inputRecord = isRecord(input) ? input : {};
		const request = intakeRequestFromChatMessage({ ...inputRecord, ...output });
		const preview = previewNaturalLanguageRouting(request);
		const nowMs = clockMs(now);
		for (const [key, recordedAtMs] of recentSuggestionCards) {
			if (
				nowMs - recordedAtMs > flowdeskChatSuggestionDuplicateWindowMs ||
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
		const stallSummary = stallAlert
			? await collectStallAlertSummary(stallAlert, now)
			: undefined;
		const shouldAppendStallCard =
			stallSummary !== undefined &&
			stallSummary.worstClassification === "stalled" &&
			stallSummary.totalStalled > 0;
		if (preview.evaluation.response.route_decision === "continue_chat") {
			if (shouldAppendStallCard && stallSummary !== undefined) {
				const key = stallAlertDuplicateKey(request, stallSummary);
				const previous = recentStallAlerts.get(key);
				recentStallAlerts.set(key, nowMs);
				if (
					previous === undefined ||
					nowMs - previous > flowdeskChatSuggestionDuplicateWindowMs
				) {
					if (!Array.isArray(output.parts)) output.parts = [];
					output.parts.push({
						type: "text",
						text: stallAlertText(stallSummary),
					});
				}
			}
			return;
		}
		if (!mayCreatePendingConfirmation(preview)) {
			const duplicateKey = suggestionDuplicateKey(
				request,
				preview.evaluation.response,
			);
			const previousAtMs = recentSuggestionCards.get(duplicateKey);
			recentSuggestionCards.set(duplicateKey, nowMs);
			if (
				previousAtMs !== undefined &&
				nowMs - previousAtMs <= flowdeskChatSuggestionDuplicateWindowMs
			)
				return;
		}
		const result = evaluateNaturalLanguageRouting(request, session);
		if (!Array.isArray(output.parts)) output.parts = [];
		output.parts.push({ type: "text", text: steeringText(result) });
		if (shouldAppendStallCard && stallSummary !== undefined) {
			const key = stallAlertDuplicateKey(request, stallSummary);
			const previous = recentStallAlerts.get(key);
			recentStallAlerts.set(key, nowMs);
			if (
				previous === undefined ||
				nowMs - previous > flowdeskChatSuggestionDuplicateWindowMs
			)
				output.parts.push({
					type: "text",
					text: stallAlertText(stallSummary),
				});
		}
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
		secondsSinceLastSignal?: number;
		laneId?: string;
		failureHint?: string;
	}>;
}

async function collectStallAlertSummary(
	stallAlert: FlowDeskChatMessageStallAlertOptionsV1,
	clock: FlowDeskLocalClockV1,
): Promise<FlowDeskChatMessageStallSummaryV1 | undefined> {
	try {
		const observedAt = (typeof clock === "function" ? clock() : clock).toISOString();
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
		const result = await executeFlowDeskStatusLiveV1({
			config,
			now: () => new Date(observedAt),
		});
		if (result.status !== "status_live_collected") return undefined;
		const workflowSummaries = result.workflows
			.filter(
				(workflow) => (workflow.stalledLaneCount ?? 0) > 0,
			)
			.slice(0, 3)
			.map((workflow) => {
				const stalledEntry = workflow.laneStallProjection?.entries.find(
					(entry) => entry.classification === "stalled",
				);
				return {
					workflowId: workflow.workflowId,
					stalledLaneCount: workflow.stalledLaneCount ?? 0,
					lateLaneCount: workflow.progressingLateLaneCount ?? 0,
					...(stalledEntry?.secondsSinceLastSignal === undefined
						? {}
						: { secondsSinceLastSignal: stalledEntry.secondsSinceLastSignal }),
					...(stalledEntry?.laneId === undefined
						? {}
						: { laneId: stalledEntry.laneId }),
					...(stalledEntry?.failureHint === undefined
						? {}
						: { failureHint: stalledEntry.failureHint }),
				};
			});
		return {
			worstClassification: result.worstLaneStallClassification ?? "unknown",
			totalStalled: result.totalStalledLaneCount ?? 0,
			totalLate: result.totalProgressingLateLaneCount ?? 0,
			workflowSummaries,
		};
	} catch {
		return undefined;
	}
}

function stallAlertDuplicateKey(
	request: FlowDeskChatIntakeRequestV1,
	summary: FlowDeskChatMessageStallSummaryV1,
): string {
	const wf = summary.workflowSummaries
		.map((entry) => `${entry.workflowId}:${entry.stalledLaneCount}`)
		.join("|");
	return `${safeToken(request.session_ref, "session")}|stall|${wf}`;
}

function stallAlertText(summary: FlowDeskChatMessageStallSummaryV1): string {
	const lines: string[] = [];
	lines.push("FlowDesk");
	lines.push(
		`Stalled lanes detected: ${summary.totalStalled} stalled, ${summary.totalLate} progressing-late.`,
	);
	for (const workflow of summary.workflowSummaries.slice(0, 3)) {
		const secs = workflow.secondsSinceLastSignal ?? 0;
		const minutes = Math.floor(secs / 60);
		const hint = workflow.failureHint ?? "no recent heartbeat";
		lines.push(
			`- workflow ${workflow.workflowId}: ${workflow.stalledLaneCount} stalled (last signal ~${minutes}m ago, ${hint}).`,
		);
	}
	lines.push("FlowDesk does not auto-retry, auto-abort, or auto-fallback on stall.");
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

function durableStateRootFromOptions(
	options?: PluginOptions,
): string | undefined {
	const value = options?.[flowdeskDurableStateRootOption];
	return typeof value === "string" && value.trim().length > 0
		? value
		: undefined;
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

function isExactModelProviderAcquisitionLiveTestEnabled(options?: PluginOptions): boolean {
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
	const authorization = value as unknown as FlowDeskDefaultManagedDispatchAuthorizationV1;
	const validation = validateFlowDeskDefaultManagedDispatchAuthorizationV1(authorization);
	return validation.ok &&
		authorization.state === "authorized" &&
		authorization.default_managed_dispatch_authority_enabled === true
		? authorization
		: undefined;
}

function isDefaultManagedDispatchAuthorized(options?: PluginOptions): boolean {
	return defaultManagedDispatchAuthorizationFromOptions(options) !== undefined;
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
	if (isRecord(input) && isExactModelProviderAcquisitionClient(input.exactModelProviderAcquisitionClient))
		return input.exactModelProviderAcquisitionClient;
	if (!isRecord(input)) return undefined;
	const promptBackedCheck = isRecord(option) && isRecord(option.promptBackedCheck)
		? option.promptBackedCheck
		: undefined;
	const commonOptions = {
		client: input.client,
		...(typeof input.directory === "string" ? { directory: input.directory } : {}),
		...(typeof input.workspace === "string" ? { workspace: input.workspace } : {}),
	};
	if (promptBackedCheck?.enabled === true) {
		const allowedProviderQualifiedModelIds = Array.isArray(promptBackedCheck.allowedProviderQualifiedModelIds)
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
	return createFlowDeskOpenCodeMetadataProviderAcquisitionClientV1(commonOptions);
}

function exactModelProviderAcquisitionRootFrom(options?: PluginOptions): string | undefined {
	const option = options?.[flowdeskExactModelProviderAcquisitionLiveTestOption];
	const optionRoot = isRecord(option) && typeof option.durableStateRoot === "string" && option.durableStateRoot.trim().length > 0
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
	if (
		isRecord(option) &&
		isManagedDispatchBetaClient(option.sdkClient)
	)
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
		...(isManagedDispatchBetaClient(value.client) ? { client: value.client } : {}),
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

function runtimeReviewerExecutionRootFrom(options?: PluginOptions): string | undefined {
	const runtimeOptions = runtimeReviewerExecutionOptionsFrom(options);
	return runtimeOptions?.durableStateRoot ?? durableStateRootFromOptions(options);
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
		adapterProfile: "quick_reviewer_run_helper",
		status: "blocked_before_quick_reviewer_run",
		laneCount: 0,
		lanes: [],
		redactedBlockReason: reason,
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
				"Run a 3-perspective FlowDesk reviewer fan-out (policy_security, architecture, verification_implementation) on a user-supplied prompt, pasted content, or the current conversation context, returning typed reviewer verdicts.",
				"WHEN TO USE: the user explicitly asks for a code review, security audit, multi-perspective check, critical review, design review, or quality review. Trigger on English phrases such as 'multi-perspective review', 'multi-angle review', 'critical review', 'review from multiple perspectives', 'audit', 'critique', 'assess', or 'evaluate'. Trigger on Korean phrases such as '다관점 리뷰', '다관점리뷰', '다관점 비판적리뷰', '다관점 비판적 리뷰', '다각도 리뷰', '다각도 검토', '여러 관점 리뷰', '여러 관점에서 검토', '복수 관점 리뷰', '비판적 리뷰', '비판적 검토', '심층 리뷰', '아키텍처 리뷰', '보안 리뷰', '품질 리뷰', '검토', or '점검'.",
				"CONTENT SELECTION: code is not required. If the user provides no explicit snippet after the trigger phrase, pass a concise prompt that includes the user's request plus the relevant current conversation context or target they are asking to review.",
				"WHEN NOT TO USE: general questions, plain chat, or any request that does not explicitly ask for a review, critique, audit, assessment, evaluation, 검토, 리뷰, 점검, or 비판.",
				"INVOKE WITH: developerModeAcknowledged=true and allowProviderCall=true. The plugin user has already opted into this tool at configuration time, so these flags must be set on every call. Do not ask the user for extra confirmation before calling; just call.",
				"AFTER CALLING: summarize the lane verdicts back to the user. acceptanceStatus=verdicts_accepted and durableLinkageStatus=durable_verdicts_accepted mean all three perspectives passed. Any lane with a redactedBlockReason indicates that perspective did not return a matching typed verdict.",
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
				if (
					typeof providerQualifiedModelId !== "string" ||
					typeof runtimeAgent !== "string"
				)
					return JSON.stringify(
						redactedQuickReviewerRunBlocked(
							"Quick reviewer run requires providerQualifiedModelId and runtimeAgent (either as args or plugin defaults).",
						),
					);
				const perspectives = Array.isArray(record.perspectives)
					? (record.perspectives.filter(
							(value): value is string => typeof value === "string",
						) as never)
					: undefined;
				const result = await executeFlowDeskQuickReviewerRunV1({
					client,
					prompt,
					providerQualifiedModelId,
					runtimeAgent,
					allowProviderCall: record.allowProviderCall === true,
					developerModeAcknowledged:
						record.developerModeAcknowledged === true,
					...(perspectives === undefined ? {} : { perspectives }),
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

function redactedManagedFallbackRegateBlocked(reason: string) {
	return {
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
				if (
					!isRecord(record.decision) ||
					!isRecord(record.consumedApproval)
				) {
					return JSON.stringify(
						redactedManagedFallbackRegateBlocked(
							"Managed fallback regate requires both decision and consumedApproval records.",
						),
					);
				}
				const result = orchestrateFlowDeskManagedFallbackRegateV1({
					decision:
						record.decision as unknown as FlowDeskFallbackDecisionV1,
					consumedApproval:
						record.consumedApproval as unknown as FlowDeskProductionApprovalSourceV1,
				});
				const redacted = redactedManagedFallbackRegateToolResult(result);
				const persistRequested = record.persistRegatePlanEvidence === true;
				const evidenceId = typeof record.regatePlanEvidenceId === "string"
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
					const persistResult = materializeFlowDeskManagedFallbackRegatePlanEvidenceV1({
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

function providerUsageLiveConfigFromOptions(
	options?: PluginOptions,
): FlowDeskProviderUsageLiveConfigV1 | undefined {
	const value = options?.[flowdeskProviderUsageLiveOption];
	if (!isRecord(value) || value.enabled !== true) return undefined;
	const config: FlowDeskProviderUsageLiveConfigV1 = {};
	if (typeof value.homeDir === "string" && value.homeDir.trim().length > 0)
		config.homeDir = value.homeDir;
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
	if (typeof value.sourceLabel === "string" && value.sourceLabel.trim().length > 0)
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
	return {
		[flowdeskQuickFallbackRunToolName]: tool({
			description: [
				"Plan a FlowDesk fallback regate from one provider to another by auto-building a developer-mode synthetic fallback decision and consumed fallback_reselection approval, then running the FlowDesk fallback regate orchestrator to produce a redacted regate plan. This tool plans, it does not switch providers or dispatch real lanes; FlowDesk default dispatch authority remains disabled.",
				"WHEN TO USE: the user explicitly says one provider is blocked, exhausted, slow, or otherwise unwanted and asks to retry the work on a different provider. Trigger on English phrases such as 'fallback to', 'switch to', 'retry with', 'try with another provider', 'use a different provider', 'this provider is blocked', and on Korean phrases such as '막혔어', '다른 걸로 다시', '다른 provider 로', '다른 모델로 재시도', '재시도 해줘', '바꿔서 다시', 'fallback 해줘', '다른 곳으로 돌려', 'OpenAI 로 다시', 'Claude 로 다시', 'Gemini 로 다시'.",
				"WHEN NOT TO USE: general usage/quota questions (use flowdesk_provider_usage_live), code review/audit requests (use flowdesk_quick_reviewer_run), workflow status questions (use flowdesk_status_live), or any request that does not explicitly ask to retry on a different provider.",
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
				const request = isRecord(input)
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
				const result = await executeFlowDeskQuickFallbackRunV1({
					config,
					request,
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

interface FlowDeskLaneHeartbeatWriterConfigV1 {
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
		config.defaultExpectedIntervalMs = Math.floor(value.defaultExpectedIntervalMs);
	return config;
}

export function createFlowDeskLaneHeartbeatWriterOptInTools(
	config: FlowDeskLaneHeartbeatWriterConfigV1,
): Record<string, FlowDeskOpenCodeTool> {
	return {
		[flowdeskLaneHeartbeatWriterToolName]: tool({
			description: [
				"Record a durable FlowDesk lane heartbeat for a FlowDesk-owned lane (reviewer lane, runtime lane launch, provider acquisition lane, managed-dispatch attempt, fallback regate plan). Each call produces one validated flowdesk.lane_heartbeat.v1 record with a monotonically increasing heartbeat_seq per lane id, persisted as durable session evidence. Heartbeats are diagnostic evidence only and never approve dispatch, widen scope, or replace Guard. Default soft heartbeat interval is about 2 minutes; the 5-minute stall threshold lives in the stall projection.",
				"WHEN TO USE: a FlowDesk coordinator that owns the lane needs to prove it is still active during a long-running step. Trigger when the assistant is coordinating a FlowDesk lane and the previous heartbeat or lifecycle update was emitted close to the soft heartbeat interval (about 2 minutes by default), OR when the user explicitly asks to record/refresh a heartbeat. Also trigger on English phrases such as 'heartbeat', 'record heartbeat', 'emit heartbeat', 'mark progress', 'I'm still alive', 'lane is still progressing', 'heartbeat for the lane', and Korean phrases such as '하트비트 남겨줘', '하트비트 기록해줘', '심박 남겨줘', '심장박동 기록', '레인 살아 있다고 표시', '진행 신호 남겨줘', '진행 표시 해줘', '아직 살아 있다고 알려줘'.",
				"WHEN NOT TO USE: lifecycle transitions to terminal states (use lane_lifecycle materializers), reviewer verdict observations, provider-call evidence, dispatch authority changes, arbitrary OpenCode user-driven tool calls that FlowDesk did not launch, or any case where you do not have a stable FlowDesk lane id and parent session id.",
				"INVOKE WITH: workflowId, attemptId, laneId, parentSessionRef (must start with 'ses-'), agentRef (must start with 'agent-'), providerQualifiedModelId (concrete provider/model id), state (one of 'created', 'running', 'awaiting_dependency', 'cooldown'), and optional progressSummaryLabel (<=120 chars and redaction-safe), progressRef (starts with 'progress-' or 'heartbeat-progress-'), expectedIntervalMs, heartbeatSeq, observedAt. When heartbeatSeq is omitted the writer derives it from the latest heartbeat for the lane id. The plugin user already opted into this tool at configuration time, so do not ask the user for extra confirmation; just call.",
				"AFTER CALLING: confirm status=lane_heartbeat_recorded with the heartbeat_seq, observed_at, and expected_next_heartbeat_at. On status=blocked_before_lane_heartbeat surface the redactedBlockReason and suggest /flowdesk-status or /flowdesk-doctor. Never echo raw prompts, transcripts, provider payloads, runtime echo, or any other forbidden raw markers.",
			].join(" "),
			args: {
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
					.describe(
						"Opaque ses-* ref for the parent session that owns this lane.",
					),
				agentRef: tool.schema
					.string()
					.describe("Opaque agent-* ref for the FlowDesk agent profile."),
				providerQualifiedModelId: tool.schema
					.string()
					.describe(
						"Concrete provider-qualified model id (e.g. 'openai/gpt-5.4-mini-fast').",
					),
				state: tool.schema
					.enum([
						"created",
						"running",
						"awaiting_dependency",
						"cooldown",
					])
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
			},
			async execute(input) {
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
			},
		}),
	};
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

export function createFlowDeskStatusLiveOptInTools(
	config: FlowDeskStatusLiveConfigV1,
): Record<string, FlowDeskOpenCodeTool> {
	return {
		[flowdeskStatusLiveToolName]: tool({
			description: [
				"Return a live FlowDesk status summary by reloading durable session evidence under the configured FlowDesk state root, including reviewer verdict counts, reviewer fan-out plans, runtime lane lifecycle records, fallback regate plans, exact-model availability cache entries, provider acquisition results, and a lane heartbeat stall projection that classifies each FlowDesk-owned lane as progressing_normal, progressing_late, stalled, terminal, or unknown based on the most recent lifecycle update.",
				"WHEN TO USE: the user asks about recent FlowDesk activity, current workflow progress, recent reviewer results, ongoing or stalled runs, lanes that have stopped logging, lanes that look stuck, or what has been recorded so far. Trigger on English phrases such as 'status', 'what happened', 'recent activity', 'progress', 'where are we', 'how is it going', 'recent reviews', 'recent runs', 'is it stuck', 'stalled', 'no log', 'no update', 'is anything frozen', and Korean phrases such as '상태', '어디까지', '진행 상황', '진행됐', '오늘 작업', '오늘 뭐했', '최근 활동', '최근 리뷰', '지금 어디', '상태 요약', '워크플로우 상태', '멈춘 것 같아', '멈췄어', '응답이 없어', '아무 로그도 없', '오래 걸리는', '진행이 안돼'.",
				"WHEN NOT TO USE: provider usage/quota questions (use flowdesk_provider_usage_live), multi-perspective code reviews (use flowdesk_quick_reviewer_run), or unrelated general chat.",
				"INVOKE WITH: optional workflowId. When omitted, the tool lists the most recently modified durable workflows (default up to 5). The plugin user already opted in to durable status evidence reload at configuration time, so this tool can be called automatically without per-call confirmation.",
				"AFTER CALLING: summarize per-workflow durable evidence counts in plain language for the user. Mention reviewer verdict labels (pass / changes_required / blocked / inconclusive), lane lifecycle states (running, complete, invocation_failed), the most recent fallback_regate_plan state, the most recent provider acquisition status, and any stalled or progressing_late lanes reported in worstLaneStallClassification with totalStalledLaneCount and totalProgressingLateLaneCount. If stalled lanes are present, surface the laneStallProjection safe next actions (/flowdesk-status, /flowdesk-retry, /flowdesk-resume, /flowdesk-abort, /flowdesk-doctor, /flowdesk-export-debug) without auto-retrying, auto-aborting, or auto-fallbacking on the user's behalf. If no workflow returned evidence, say so plainly. Never echo raw provider/auth/token payloads.",
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
			},
		}),
	};
}

export function createFlowDeskProviderUsageLiveOptInTools(
	config: FlowDeskProviderUsageLiveConfigV1,
): Record<string, FlowDeskOpenCodeTool> {
	return {
		[flowdeskProviderUsageLiveToolName]: tool({
			description: [
				"Return live FlowDesk provider usage availability for Claude, OpenAI/Codex, and Gemini Code Assist using provider-native usage collectors. No estimation; reads OAuth credentials and provider rate-limit/quota APIs. Each provider row carries remainingPercent, alertLevel (ok/warning/critical/exhausted/stale/unknown), and a short recommendation. The top-level worstAlertLevel and overallRecommendation summarize the riskiest provider.",
				"WHEN TO USE: the user asks how much usage, quota, credit, limit, or budget they have left, when their quota resets, or whether a provider is available right now. Trigger on English phrases such as 'usage', 'quota', 'remaining', 'how much left', 'rate limit', 'reset', 'budget left', and on Korean phrases such as '사용량', '잔량', '남은 사용량', '얼마 남았어', '쿼터', '한도', '리셋', '남은거 얼마야', '남은 토큰', '사용 가능량'.",
				"ALSO PROACTIVELY USE: before starting a large multi-step task that depends on a specific provider (e.g. extensive refactor, long agentic loop, multi-perspective review), call this tool first to check whether the chosen provider has enough headroom; if worstAlertLevel is critical or exhausted, warn the user and suggest switching providers or waiting for reset.",
				"WHEN NOT TO USE: general chat, status of an in-progress workflow (use status instead), or any non-usage question.",
				"INVOKE WITH: optional providerFamily ('claude', 'openai', 'gemini', or 'all'; default 'all'). The plugin user has already opted in to provider-native usage collection at configuration time, so this tool can be called automatically without per-call confirmation.",
				"AFTER CALLING: summarize per-provider availability for the user in plain language. For each provider include the bucket label (claude-5h, claude-weekly, openai-gpt-5h, gemini-pro-5h, gemini-pro-weekly, gemini-flash-daily, gemini-flash-lite-daily), remainingPercent, reset time, alertLevel, and recommendation. If any provider returned non_dispatchable, exhausted, critical, stale, or unknown, note it explicitly and surface the overallRecommendation. Never echo raw tokens or raw payloads.",
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
				const request = isRecord(input)
					? { providerFamily: typeof input.providerFamily === "string" ? input.providerFamily : undefined }
					: {};
				const result = await executeFlowDeskProviderUsageLiveV1({
					config,
					request,
				});
				return JSON.stringify(result);
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
		...(typeof option.durableStateRoot === "string" &&
		option.durableStateRoot.trim().length > 0
			? { rootDir: option.durableStateRoot }
			: {}),
	};
}

const flowdeskServerPlugin: Plugin = async (input, options) => {
	const localSession =
		isLocalNonDispatchAdapterEnabled(options) ||
		isNaturalLanguageRoutingEnabled(options)
			? createFlowDeskLocalNonDispatchAdapterSession(new Date(), undefined, {
					durableStateRootDir: durableStateRootFromOptions(options),
					productionEnablement: productionEnablementFromOptions(options),
					reviewerFanoutDiagnostics: reviewerFanoutDiagnosticsFromOptions(options),
				})
			: undefined;
	const managedDispatchBetaClient = isManagedDispatchBetaAdapterEnabled(options)
		|| isDefaultManagedDispatchAuthorized(options)
		? managedDispatchBetaClientFrom(input, options)
		: undefined;
	const managedDispatchBetaReservationStore =
		isManagedDispatchBetaAdapterEnabled(options) || isDefaultManagedDispatchAuthorized(options)
			? (managedDispatchBetaReservationStoreFrom(input, options) ??
				managedDispatchBetaDurableReservationStoreFrom(options))
			: undefined;
	const defaultAuthorization = defaultManagedDispatchAuthorizationFromOptions(options);
	const exactModelProviderAcquisitionClient = isExactModelProviderAcquisitionLiveTestEnabled(options)
		? exactModelProviderAcquisitionClientFrom(input, options)
		: undefined;
	const exactModelProviderAcquisitionRoot = exactModelProviderAcquisitionRootFrom(options);
	const exactModelProviderAcquisitionCacheMaterialization =
		exactModelProviderAcquisitionCacheMaterializationFromOptions(options);
	const runtimeReviewerExecutionClient = isRuntimeReviewerExecutionEnabled(options)
		? runtimeReviewerExecutionClientFrom(input, options)
		: undefined;
	const runtimeReviewerExecutionRoot = runtimeReviewerExecutionRootFrom(options);
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
				const quickReviewerRunRegistered =
					isQuickReviewerRunEnabled(options) &&
					quickReviewerRunClientFrom(input, options) !== undefined;
				const naturalLanguageTools = {
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
						geminiOAuthConfigured:
							providerUsageLiveConfigForDoctor !== undefined &&
							((providerUsageLiveConfigForDoctor.geminiOAuthClientId !==
								undefined &&
								providerUsageLiveConfigForDoctor.geminiOAuthClientSecret !==
									undefined) ||
								typeof process.env.FLOWDESK_GEMINI_OAUTH_CLIENT_ID ===
									"string" ||
								typeof process.env.FLOWDESK_GEMINI_OAUTH_CLIENT_SECRET ===
									"string"),
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
						exposesLaneStallProjection:
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
					chatMessageStallAlert: {
						enabled:
							options?.[flowdeskChatMessageStallAlertOption] === true ||
							(isRecord(options?.[flowdeskChatMessageStallAlertOption]) &&
								(options?.[flowdeskChatMessageStallAlertOption] as { enabled?: unknown })
									.enabled === true),
						registered:
							chatMessageStallAlertOptionsFrom(options, statusLiveConfigForDoctor) !==
							undefined,
						requires:
							"statusLive.enabled=true and durableStateRoot (top-level or chatMessageStallAlert.rootDir)",
						note:
							"chat.message hook appends a passive stall card listing stalled lanes and safe next actions; no auto-retry, auto-abort, or auto-fallback.",
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
					naturalLanguageRoutingProfile: isNaturalLanguageRoutingEnabled(
						options,
					)
						? "chat_steering_command_backed_non_dispatch"
						: "disabled",
					naturalLanguageTools,
					productionPromotionGate:
						defaultAuthorization === undefined
							? "release1_non_dispatch_command_registration_ready"
							: "default_managed_dispatch_authorized_registration_ready",
					defaultManagedDispatchRegistrationAuthorized:
						defaultAuthorization !== undefined,
					...(defaultAuthorization === undefined
						? {}
						: {
								defaultManagedDispatchAuthorizationRef:
									defaultAuthorization.authorization_id,
								defaultManagedDispatchReadinessRef:
									defaultAuthorization.readiness_ref,
							}),
					productionOpenCodeRegistration: hasProductionOpenCodeRegistration(),
					productionToolRegistration:
						flowdeskPluginScaffold.productionToolRegistration,
					release1HandlerReadiness:
						getFlowDeskRelease1HandlerReadinessSummary(),
					release1ProductionReadiness:
						getFlowDeskRelease1ProductionReadinessSummary(),
					fds1SchemaConversionSpikePassed:
						hasPassingFds1SchemaConversionSpike(),
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
	if (isFds1SchemaConversionProbeEnabled(options))
		Object.assign(tools, createFlowDeskFds1SchemaConversionProbeTools());
	if (isLocalNonDispatchAdapterEnabled(options))
		Object.assign(
			tools,
			createFlowDeskLocalNonDispatchAdapterTools(new Date(), localSession, {
				client: managedDispatchBetaClient,
				reservationStore: managedDispatchBetaReservationStore,
				durableStateRootDir: durableStateRootFromOptions(options),
				defaultAuthorization,
			}),
		);
	if (isNaturalLanguageRoutingEnabled(options))
		Object.assign(
			tools,
			createFlowDeskNaturalLanguageRoutingTools(new Date(), localSession),
		);
	if (managedDispatchBetaClient !== undefined)
		Object.assign(
			tools,
			createFlowDeskManagedDispatchBetaOptInTools(
				managedDispatchBetaClient,
				managedDispatchBetaReservationStore,
				durableStateRootFromOptions(options),
			),
		);
	if (exactModelProviderAcquisitionClient !== undefined && exactModelProviderAcquisitionRoot !== undefined)
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
	if (statusLiveConfig !== undefined)
		Object.assign(tools, createFlowDeskStatusLiveOptInTools(statusLiveConfig));
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
	if (!isNaturalLanguageRoutingEnabled(options)) return { tool: tools };
	const stallAlertOption = chatMessageStallAlertOptionsFrom(
		options,
		statusLiveConfig,
	);
	return {
		tool: tools,
		"chat.message": createFlowDeskNaturalLanguageChatMessageHook(
			() => new Date(),
			localSession,
			stallAlertOption,
		),
	};
};

export const flowdeskChatMessageStallAlertOption =
	"chatMessageStallAlert" as const;

function chatMessageStallAlertOptionsFrom(
	options: PluginOptions | undefined,
	statusLiveConfig: FlowDeskStatusLiveConfigV1 | undefined,
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
	const fallbackRoot = statusLiveConfig?.rootDir ?? durableStateRootFromOptions(options);
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
	return config;
}

export const flowdeskOpenCodeServerPlugin = {
	id: flowdeskPluginId,
	server: flowdeskServerPlugin,
} satisfies PluginModule;

export default flowdeskOpenCodeServerPlugin;
