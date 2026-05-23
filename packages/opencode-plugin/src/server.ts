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

interface FlowDeskRuntimeReviewerExecutionExpectationV1 {
	launchPlanEvidenceId: string;
	lanePlanRef: string;
	bindingRef: string;
	perspective: string;
	promptText: string;
	runningLifecycleEvidenceId: string;
	completeLifecycleEvidenceId: string;
	reviewerVerdictEvidenceId: string;
	outputRef: string;
	runtimeEchoRef: string;
	telemetryRef: string;
	title?: string;
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

function runtimeReviewerExecutionExpectationFromValue(
	value: unknown,
): FlowDeskRuntimeReviewerExecutionExpectationV1 | undefined {
	if (!isRecord(value)) return undefined;
	const required = [
		"launchPlanEvidenceId",
		"lanePlanRef",
		"bindingRef",
		"perspective",
		"promptText",
		"runningLifecycleEvidenceId",
		"completeLifecycleEvidenceId",
		"reviewerVerdictEvidenceId",
		"outputRef",
		"runtimeEchoRef",
		"telemetryRef",
	] as const;
	if (
		required.some(
			(key) => typeof value[key] !== "string" || value[key].trim().length === 0,
		)
	)
		return undefined;
	return {
		launchPlanEvidenceId: value.launchPlanEvidenceId as string,
		lanePlanRef: value.lanePlanRef as string,
		bindingRef: value.bindingRef as string,
		perspective: value.perspective as string,
		promptText: value.promptText as string,
		runningLifecycleEvidenceId: value.runningLifecycleEvidenceId as string,
		completeLifecycleEvidenceId: value.completeLifecycleEvidenceId as string,
		reviewerVerdictEvidenceId: value.reviewerVerdictEvidenceId as string,
		outputRef: value.outputRef as string,
		runtimeEchoRef: value.runtimeEchoRef as string,
		telemetryRef: value.telemetryRef as string,
		...(typeof value.title === "string" && value.title.trim().length > 0
			? { title: value.title }
			: {}),
	};
}

function runtimeReviewerExecutionExpectationsFromValue(
	value: unknown,
): FlowDeskRuntimeReviewerExecutionExpectationV1[] | undefined {
	if (!Array.isArray(value) || value.length === 0) return undefined;
	const expectations = value.map(runtimeReviewerExecutionExpectationFromValue);
	return expectations.every(
		(expectation): expectation is FlowDeskRuntimeReviewerExecutionExpectationV1 =>
			expectation !== undefined,
	)
		? expectations
		: undefined;
}

function runtimeLaunchPlanFromReloadedEvidence(input: {
	reloadedEvidence: FlowDeskSessionEvidenceReloadResultV1;
	evidenceId: string;
}): FlowDeskRuntimeLaneLaunchPlanV1 | undefined {
	const entry = input.reloadedEvidence.entries.find(
		(candidate) =>
			candidate.evidenceClass === "runtime_lane_launch_plan" &&
			candidate.evidenceId === input.evidenceId,
	);
	return entry?.record as unknown as FlowDeskRuntimeLaneLaunchPlanV1 | undefined;
}

function redactedRuntimeReviewerExecutionBlocked(reason: string) {
	return {
		adapterProfile: "runtime_reviewer_execution_bridge",
		status: "blocked_before_runtime_reviewer_execution",
		launchAttempted: false,
		writeAttempted: false,
		evidenceReloaded: false,
		redactedBlockReason: reason,
		safeNextActions: ["/flowdesk-status"],
		authority: { ...disabledAuthority, toolAuthority: false },
	};
}

async function executeFlowDeskRuntimeReviewerExecutionBridge(input: {
	client: FlowDeskManagedDispatchBetaOpenCodeClientV1;
	rootDir: string;
	request: Record<string, unknown>;
}): Promise<Record<string, unknown>> {
	const workflowId =
		typeof input.request.workflowId === "string"
			? input.request.workflowId
			: undefined;
	const attemptId =
		typeof input.request.attemptId === "string"
			? input.request.attemptId
			: undefined;
	const parentSessionId =
		typeof input.request.parentSessionId === "string"
			? input.request.parentSessionId
			: undefined;
	const observedAt =
		typeof input.request.observedAt === "string"
			? input.request.observedAt
			: new Date().toISOString();
	const expectations = runtimeReviewerExecutionExpectationsFromValue(
		input.request.verdictExpectations,
	);
	const consumedApproval = isRecord(input.request.consumedReviewerFanoutApproval)
		? (input.request
				.consumedReviewerFanoutApproval as unknown as FlowDeskProductionApprovalSourceV1)
		: undefined;
	if (
		workflowId === undefined ||
		attemptId === undefined ||
		parentSessionId === undefined ||
		expectations === undefined ||
		input.request.allowActualLaneLaunch !== true ||
		consumedApproval === undefined
	)
		return redactedRuntimeReviewerExecutionBlocked(
			"Runtime reviewer execution requires workflowId, attemptId, parentSessionId, allowActualLaneLaunch=true, consumedReviewerFanoutApproval, and verdictExpectations.",
		);
	const reloadedBefore = reloadFlowDeskSessionEvidenceV1({
		workflowId,
		rootDir: input.rootDir,
	});
	if (!reloadedBefore.ok || reloadedBefore.blocked.length > 0)
		return redactedRuntimeReviewerExecutionBlocked(
			"runtime reviewer execution evidence reload failed",
		);
	const verdicts: FlowDeskTopTierReviewVerdictV1[] = [];
	const lanes = [];
	for (const expectation of expectations) {
		const launchPlan = runtimeLaunchPlanFromReloadedEvidence({
			reloadedEvidence: reloadedBefore,
			evidenceId: expectation.launchPlanEvidenceId,
		});
		if (launchPlan === undefined)
			return redactedRuntimeReviewerExecutionBlocked(
				"runtime launch plan evidence is missing",
			);
		const launchResult = await launchFlowDeskInjectedSdkRuntimeLaneFromPlanV1({
			client: input.client,
			launchPlan,
			request: {
				allowActualLaneLaunch: true,
				parentSessionId,
				promptText: expectation.promptText,
				dispatchMethod: "prompt",
				...(expectation.title === undefined
					? {}
					: { title: expectation.title }),
			},
		});
		const runningLifecycle =
			materializeFlowDeskRuntimeLaneLaunchLifecycleEvidenceV1({
				rootDir: input.rootDir,
				launchPlan,
				launchResult,
				evidenceId: expectation.runningLifecycleEvidenceId,
				observedAt,
			});
		if (launchResult.status !== "lane_launch_started")
			return {
				adapterProfile: "runtime_reviewer_execution_bridge",
				status: "runtime_reviewer_execution_incomplete",
				launchAttempted: true,
				writeAttempted: runningLifecycle.writeAttempted,
				evidenceReloaded: runningLifecycle.evidenceReloaded,
				redactedBlockReason: "runtime lane launch did not start",
				lanes,
				safeNextActions: ["/flowdesk-status", "/flowdesk-export-debug"],
				authority: { ...disabledAuthority, toolAuthority: false },
			};
		const childSessionId = launchResult.childSessionRef?.startsWith("ses-")
			? launchResult.childSessionRef.slice("ses-".length)
			: undefined;
		if (childSessionId === undefined)
			return redactedRuntimeReviewerExecutionBlocked(
				"runtime lane launch did not return a child session ref",
			);
		const observation = await observeInjectedSdkReviewerVerdictV1({
			client: input.client,
			request: {
				sessionId: childSessionId,
				workflowId,
				lanePlanRef: expectation.lanePlanRef,
				bindingRef: expectation.bindingRef,
				perspective:
					expectation.perspective as FlowDeskTopTierReviewPerspective,
			},
		});
		if (observation.status !== "verdict_observed")
			return {
				adapterProfile: "runtime_reviewer_execution_bridge",
				status: "runtime_reviewer_execution_incomplete",
				launchAttempted: true,
				writeAttempted: runningLifecycle.writeAttempted,
				evidenceReloaded: runningLifecycle.evidenceReloaded,
				redactedBlockReason: "typed reviewer verdict was not observed",
				lanes,
				safeNextActions: ["/flowdesk-status", "/flowdesk-export-debug"],
				authority: { ...disabledAuthority, toolAuthority: false },
			};
		const observedVerdict = observation.verdict;
		if (observedVerdict === undefined)
			return redactedRuntimeReviewerExecutionBlocked(
				"typed reviewer verdict observation did not include a verdict record",
			);
		const verdictMaterialization =
			materializeFlowDeskObservedReviewerVerdictEvidenceV1({
				rootDir: input.rootDir,
				observation,
				evidenceId: expectation.reviewerVerdictEvidenceId,
			});
		const completeLifecycle =
			materializeFlowDeskRuntimeLaneCompleteLifecycleEvidenceV1({
				rootDir: input.rootDir,
				launchPlan,
				launchResult,
				verdictObservation: observation,
				evidenceId: expectation.completeLifecycleEvidenceId,
				observedAt,
				outputRef: expectation.outputRef,
				runtimeEchoRef: expectation.runtimeEchoRef,
				telemetryRef: expectation.telemetryRef,
			});
		if (
			verdictMaterialization.status !== "verdict_evidence_recorded" ||
			completeLifecycle.status !== "lane_lifecycle_recorded"
		)
			return {
				adapterProfile: "runtime_reviewer_execution_bridge",
				status: "runtime_reviewer_execution_incomplete",
				launchAttempted: true,
				writeAttempted: true,
				evidenceReloaded: false,
				redactedBlockReason:
					"runtime reviewer durable evidence materialization failed",
				lanes,
				safeNextActions: ["/flowdesk-status", "/flowdesk-export-debug"],
				authority: { ...disabledAuthority, toolAuthority: false },
			};
		verdicts.push(observedVerdict);
		lanes.push({
			launchPlanEvidenceId: expectation.launchPlanEvidenceId,
			perspective: expectation.perspective,
			launchStatus: launchResult.status,
			runningLifecycle: runningLifecycle.lifecycleState,
			observationStatus: observation.status,
			verdictMaterializationStatus: verdictMaterialization.status,
			completeLifecycle: completeLifecycle.lifecycleState,
			verdictId: observation.verdictId,
		});
	}
	const acceptance = prepareFlowDeskReviewerTypedVerdictAcceptanceAdapterV1({
		workflowId,
		attemptId,
		verdicts,
		consumedApproval,
	});
	const reloadedAfter = reloadFlowDeskSessionEvidenceV1({
		workflowId,
		rootDir: input.rootDir,
	});
	const durableLinkage = prepareFlowDeskDurableReviewerVerdictLinkageAdapterV1({
		workflowId,
		attemptId,
		verdicts,
		consumedApproval,
		reloadedEvidence: reloadedAfter,
	});
	return {
		adapterProfile: "runtime_reviewer_execution_bridge",
		status:
			durableLinkage.status === "durable_verdicts_accepted"
				? "runtime_reviewer_execution_completed"
				: "runtime_reviewer_execution_incomplete",
		launchAttempted: true,
		writeAttempted: true,
		evidenceReloaded: reloadedAfter.ok,
		workflowId,
		attemptId,
		laneCount: lanes.length,
		lanes,
		acceptanceStatus: acceptance.status,
		acceptedPerspectives: acceptance.acceptedPerspectives,
		durableLinkageStatus: durableLinkage.status,
		linkedVerdictCount: durableLinkage.linkedVerdictIds.length,
		linkedLifecycleCount: durableLinkage.linkedLifecycleRefs.length,
		blockedCount: reloadedAfter.blocked.length,
		safeNextActions: ["/flowdesk-status"],
		authority: {
			...durableLinkage.authority,
			toolAuthority: false,
		},
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
						? await executeFlowDeskRuntimeReviewerExecutionBridge({
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

export function createFlowDeskNaturalLanguageChatMessageHook(
	now: FlowDeskLocalClockV1 = () => new Date(),
	session = createFlowDeskLocalNonDispatchAdapterSession(now),
) {
	const recentSuggestionCards = new Map<string, number>();
	return async function message(
		input: unknown,
		output: FlowDeskChatMessageOutput,
	): Promise<void> {
		const inputRecord = isRecord(input) ? input : {};
		const request = intakeRequestFromChatMessage({ ...inputRecord, ...output });
		const preview = previewNaturalLanguageRouting(request);
		if (preview.evaluation.response.route_decision === "continue_chat") return;
		const nowMs = clockMs(now);
		for (const [key, recordedAtMs] of recentSuggestionCards) {
			if (
				nowMs - recordedAtMs > flowdeskChatSuggestionDuplicateWindowMs ||
				nowMs < recordedAtMs
			)
				recentSuggestionCards.delete(key);
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
	};
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
				const result = await executeFlowDeskRuntimeReviewerExecutionBridge({
					client,
					rootDir,
					request: record.request,
				});
				return JSON.stringify(result);
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

export function createFlowDeskManagedFallbackRegateOptInTools(): Record<
	string,
	FlowDeskOpenCodeTool
> {
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
				return JSON.stringify(redactedManagedFallbackRegateToolResult(result));
			},
		}),
	};
}

function isManagedFallbackRegateEnabled(options?: PluginOptions): boolean {
	const value = options?.[flowdeskManagedFallbackRegateOption];
	return value === true || (isRecord(value) && value.enabled === true);
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
		Object.assign(tools, createFlowDeskManagedFallbackRegateOptInTools());
	if (!isNaturalLanguageRoutingEnabled(options)) return { tool: tools };
	return {
		tool: tools,
		"chat.message": createFlowDeskNaturalLanguageChatMessageHook(
			() => new Date(),
			localSession,
		),
	};
};

export const flowdeskOpenCodeServerPlugin = {
	id: flowdeskPluginId,
	server: flowdeskServerPlugin,
} satisfies PluginModule;

export default flowdeskOpenCodeServerPlugin;
