import {
	 type FlowDeskProductionApprovalSourceV1,
	type FlowDeskLaneLifecycleRecordV1,
	 type FlowDeskReviewerLaneContextV1,
	type FlowDeskRuntimeLaneLaunchPlanV1,
	type FlowDeskSessionEvidenceReloadResultV1,
	type FlowDeskTopTierReviewPerspective,
	type FlowDeskTopTierReviewVerdictV1,
	applyFlowDeskSessionEvidenceWriteIntentsV1,
	prepareFlowDeskSessionEvidenceWriteIntentV1,
	reloadFlowDeskSessionEvidenceV1,
} from "@flowdesk/core";
import { createHash } from "node:crypto";
import { recordFlowDeskLaneHeartbeatV1 } from "./lane-heartbeat-writer.js";
import {
	type FlowDeskManagedDispatchBetaOpenCodeClientV1,
	launchFlowDeskInjectedSdkRuntimeLaneFromPlanV1,
	materializeFlowDeskObservedReviewerVerdictEvidenceV1,
	materializeFlowDeskRuntimeLaneCompleteLifecycleEvidenceV1,
	materializeFlowDeskRuntimeLaneLaunchLifecycleEvidenceV1,
	observeInjectedSdkReviewerVerdictV1,
	prepareFlowDeskDurableReviewerVerdictLinkageAdapterV1,
	prepareFlowDeskReviewerTypedVerdictAcceptanceAdapterV1,
} from "./managed-dispatch-adapter.js";

export interface FlowDeskRuntimeReviewerExecutionExpectationV1 {
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

export interface FlowDeskReviewerLaneCompletionWaitOptionsV1 {
	pollIntervalMs?: number;
	maxWaitMs?: number;
	quietPeriodMs?: number;
	stableSampleCount?: number;
}

export type FlowDeskReviewerLaneCompletionWaitResultV1 =
	| {
			status: "completion_observed";
			messageCount: number;
			finalAssistantTextSha256?: string;
			messagesResponse?: unknown;
	  }
	| {
			status: "completion_timeout" | "completion_wait_failed" | "completion_wait_unavailable";
			messageCount?: number;
			redactedErrors: string[];
	  };

const DEFAULT_REVIEWER_COMPLETION_WAIT = {
	pollIntervalMs: 1_000,
	maxWaitMs: 120_000,
	quietPeriodMs: 2_000,
	stableSampleCount: 2,
} as const;

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

function responseData(value: unknown): unknown {
	const record = isRecord(value) ? value : undefined;
	return record !== undefined && "data" in record ? record.data : value;
}

function responseArray(value: unknown): unknown[] {
	const data = responseData(value);
	if (Array.isArray(data)) return data;
	const record = isRecord(data) ? data : undefined;
	if (Array.isArray(record?.items)) return record.items;
	if (Array.isArray(record?.messages)) return record.messages;
	return [];
}

function messageRole(message: unknown): string | undefined {
	const record = isRecord(message) ? message : undefined;
	const info = isRecord(record?.info) ? record.info : record;
	return typeof info?.role === "string" ? info.role : undefined;
}

function messageTextParts(message: unknown): string[] {
	const record = isRecord(message) ? message : undefined;
	const info = isRecord(record?.info) ? record.info : undefined;
	const parts = Array.isArray(record?.parts)
		? record.parts
		: Array.isArray(info?.parts)
			? info.parts
			: [];
	return parts.flatMap((part) => {
		const partRecord = isRecord(part) ? part : undefined;
		const text =
			typeof partRecord?.text === "string"
				? partRecord.text
				: typeof partRecord?.content === "string"
					? partRecord.content
					: undefined;
		return text === undefined || text.trim().length === 0 ? [] : [text.trim()];
	});
}

function terminalSignalFromMessages(messages: unknown[]): boolean {
	return messages.some((message) => {
		const record = isRecord(message) ? message : undefined;
		const info = isRecord(record?.info) ? record.info : record;
		const status =
			typeof info?.status === "string"
				? info.status
				: typeof info?.state === "string"
					? info.state
					: undefined;
		return status !== undefined && ["complete", "completed", "done", "finished", "error", "failed"].includes(status);
	});
}

function finalAssistantText(messages: unknown[]): string | undefined {
	for (let index = messages.length - 1; index >= 0; index -= 1) {
		const message = messages[index];
		const role = messageRole(message);
		if (role !== undefined && role !== "assistant") continue;
		const text = messageTextParts(message).join("\n").trim();
		if (text.length > 0) return text;
	}
	return undefined;
}

function textHash(text: string): string {
	return createHash("sha256").update(text, "utf8").digest("hex");
}

function isSdkErrorResponse(value: unknown): boolean {
	const record = isRecord(value) ? value : undefined;
	const data = isRecord(responseData(value)) ? responseData(value) as Record<string, unknown> : undefined;
	return record?.error !== undefined || data?.error !== undefined;
}

async function callMessagesWithFallback(input: {
	client: FlowDeskManagedDispatchBetaOpenCodeClientV1;
	childSessionId: string;
}): Promise<unknown> {
	const method = input.client.session.messages as (options: unknown) => unknown | Promise<unknown>;
	return method.call(input.client.session, { sessionID: input.childSessionId });
}

function normalizedCompletionWaitOptions(
	options?: FlowDeskReviewerLaneCompletionWaitOptionsV1,
): Required<FlowDeskReviewerLaneCompletionWaitOptionsV1> {
	const pollIntervalMs = Math.max(25, Math.min(options?.pollIntervalMs ?? DEFAULT_REVIEWER_COMPLETION_WAIT.pollIntervalMs, 10_000));
	const maxWaitMs = Math.max(pollIntervalMs, Math.min(options?.maxWaitMs ?? DEFAULT_REVIEWER_COMPLETION_WAIT.maxWaitMs, 300_000));
	return {
		pollIntervalMs,
		maxWaitMs,
		quietPeriodMs: Math.max(0, Math.min(options?.quietPeriodMs ?? DEFAULT_REVIEWER_COMPLETION_WAIT.quietPeriodMs, maxWaitMs)),
		stableSampleCount: Math.max(2, Math.min(options?.stableSampleCount ?? DEFAULT_REVIEWER_COMPLETION_WAIT.stableSampleCount, 20)),
	};
}

function sleep(ms: number): Promise<void> {
	return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function waitForReviewerLaneCompletionV1(input: {
	client: FlowDeskManagedDispatchBetaOpenCodeClientV1;
	childSessionId: string;
	options?: FlowDeskReviewerLaneCompletionWaitOptionsV1;
}): Promise<FlowDeskReviewerLaneCompletionWaitResultV1> {
	if (input.client.session.messages === undefined) {
		return { status: "completion_wait_unavailable", redactedErrors: ["session_messages_api_missing"] };
	}
	const options = normalizedCompletionWaitOptions(input.options);
	const startedAt = Date.now();
	let lastSignature: string | undefined;
	let lastChangedAt = startedAt;
	let stableSamples = 0;
	let lastMessageCount = 0;
	try {
		while (Date.now() - startedAt <= options.maxWaitMs) {
			const response = await callMessagesWithFallback({ client: input.client, childSessionId: input.childSessionId });
			const messages = responseArray(response);
			lastMessageCount = messages.length;
			const finalText = finalAssistantText(messages);
			const finalHash = finalText === undefined ? undefined : textHash(finalText);
			const signature = `${messages.length}:${finalHash ?? ""}`;
			if (finalText !== undefined && finalText.startsWith("{") && finalText.endsWith("}")) {
				return { status: "completion_observed", messageCount: messages.length, finalAssistantTextSha256: finalHash, messagesResponse: response };
			}
			if (terminalSignalFromMessages(messages) && finalHash !== undefined) {
				return { status: "completion_observed", messageCount: messages.length, finalAssistantTextSha256: finalHash, messagesResponse: response };
			}
			if (signature === lastSignature) {
				stableSamples += 1;
			} else {
				lastSignature = signature;
				lastChangedAt = Date.now();
				stableSamples = 1;
			}
			if (
				finalHash !== undefined &&
				stableSamples >= options.stableSampleCount &&
				Date.now() - lastChangedAt >= options.quietPeriodMs
			) {
				return { status: "completion_observed", messageCount: messages.length, finalAssistantTextSha256: finalHash };
			}
			if (
				finalHash === undefined &&
				stableSamples >= options.stableSampleCount &&
				Date.now() - lastChangedAt >= options.quietPeriodMs
			) {
				return { status: "completion_timeout", messageCount: messages.length, redactedErrors: ["reviewer_lane_no_final_assistant_text"] };
			}
			await sleep(options.pollIntervalMs);
		}
		return { status: "completion_timeout", messageCount: lastMessageCount, redactedErrors: ["reviewer_lane_completion_wait_timed_out"] };
	} catch {
		return { status: "completion_wait_failed", messageCount: lastMessageCount, redactedErrors: ["reviewer_lane_completion_wait_failed"] };
	}
}

function writeTerminalReviewerLaneLifecycle(input: {
	rootDir: string;
	workflowId: string;
	evidenceId: string;
	launchPlan: FlowDeskRuntimeLaneLaunchPlanV1;
	childSessionRef?: string;
	messageRef?: string;
	state: FlowDeskLaneLifecycleRecordV1["state"];
	observedAt: string;
	timeoutMs?: number;
}): boolean {
	const record: FlowDeskLaneLifecycleRecordV1 = {
		schema_version: "flowdesk.lane_lifecycle_record.v1",
		lane_id: input.launchPlan.lane_id ?? "lane-missing",
		workflow_id: input.workflowId,
		attempt_id: input.launchPlan.attempt_id ?? "attempt-missing",
		parent_session_ref: input.launchPlan.parent_session_ref ?? "ses-missing",
		...(input.childSessionRef === undefined ? {} : { child_session_ref: input.childSessionRef }),
		...(input.messageRef === undefined || !input.messageRef.startsWith("msg-") ? {} : { message_ref: input.messageRef }),
		agent_ref: input.launchPlan.agent_ref ?? "agent-missing",
		provider_qualified_model_id: input.launchPlan.provider_qualified_model_id ?? "openai/missing",
		state: input.state,
		timeout_ms: input.timeoutMs ?? 0,
		orphan_max_age_ms: 0,
		retry_count: 0,
		created_at: input.observedAt,
		updated_at: new Date().toISOString(),
		dispatch_authority_enabled: false,
		providerCall: false,
		actualLaneLaunch: false,
		runtimeExecution: false,
	};
	const prepared = prepareFlowDeskSessionEvidenceWriteIntentV1({
		workflowId: input.workflowId,
		evidenceId: input.evidenceId,
		record: record as unknown as Record<string, unknown>,
	});
	if (!prepared.ok || prepared.writeIntent === undefined) return false;
	return applyFlowDeskSessionEvidenceWriteIntentsV1(input.rootDir, [prepared.writeIntent]).ok;
}

export function runtimeReviewerExecutionExpectationFromValue(
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

export function runtimeReviewerExecutionExpectationsFromValue(
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

export function redactedRuntimeReviewerExecutionBlocked(reason: string) {
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

export async function executeFlowDeskRuntimeReviewerExecutionBridgeV1(input: {
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
	const completionWaitOptions = isRecord(input.request.completionWait)
		? (input.request.completionWait as FlowDeskReviewerLaneCompletionWaitOptionsV1)
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
	const lanes: Record<string, unknown>[] = [];
	let launchAttempted = false;
	let writeAttempted = false;
	for (const expectation of expectations) {
		const launchPlan = runtimeLaunchPlanFromReloadedEvidence({
			reloadedEvidence: reloadedBefore,
			evidenceId: expectation.launchPlanEvidenceId,
		});
		if (launchPlan === undefined) {
			lanes.push({
				launchPlanEvidenceId: expectation.launchPlanEvidenceId,
				perspective: expectation.perspective,
				launchStatus: "missing_launch_plan",
				redactedBlockReason: "runtime launch plan evidence is missing",
			});
			continue;
		}
		launchAttempted = true;
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
		writeAttempted = writeAttempted || runningLifecycle.writeAttempted;
		if (launchResult.status === "lane_launch_started") {
			const laneId = launchPlan.lane_id ?? "";
			const parentSessionRef = launchPlan.parent_session_ref ?? "";
			const agentRef = launchPlan.agent_ref ?? "";
			const providerQualifiedModelId =
				launchPlan.provider_qualified_model_id ?? "";
			if (
				laneId.length > 0 &&
				parentSessionRef.length > 0 &&
				agentRef.length > 0 &&
				providerQualifiedModelId.length > 0
			) {
				const heartbeat = recordFlowDeskLaneHeartbeatV1({
					rootDir: input.rootDir,
					workflowId,
					attemptId,
					laneId,
					parentSessionRef,
					agentRef,
					providerQualifiedModelId,
					state: "running",
					observedAt,
					progressSummaryLabel: `reviewer lane ${expectation.perspective} launch heartbeat`,
				});
				writeAttempted = writeAttempted || heartbeat.writeAttempted;

				// Write reviewer_lane_context.v1 for auto-retry support (auxiliary — must not fail launch)
				try {
					const fullPromptText = expectation.promptText;
					const fullPromptSha256 = createHash("sha256")
						.update(fullPromptText, "utf8")
						.digest("hex");
					const truncated = fullPromptText.length > 8192;
					const promptTextToStore = truncated
						? fullPromptText.slice(0, 8192)
						: fullPromptText;
					const contextEvidenceId = `reviewer-lane-context-${laneId}-${observedAt.replace(/[^0-9A-Za-z]/g, "")}`;
					const contextRecord: FlowDeskReviewerLaneContextV1 = {
						schema_version: "flowdesk.reviewer_lane_context.v1",
						workflow_id: workflowId,
						lane_id: laneId,
						lane_plan_ref: expectation.lanePlanRef,
						perspective: expectation.perspective as FlowDeskTopTierReviewPerspective,
						agent_ref: agentRef,
						provider_qualified_model_id: providerQualifiedModelId,
						parent_session_ref: parentSessionRef,
						original_attempt_id: attemptId,
						prompt_text: promptTextToStore,
						prompt_text_truncated: truncated,
						prompt_text_sha256: fullPromptSha256,
						redaction_version: "v1",
						created_at: observedAt,
						dispatch_authority_enabled: false,
					};
					const contextPrepared = prepareFlowDeskSessionEvidenceWriteIntentV1({
						workflowId,
						evidenceId: contextEvidenceId,
						record: contextRecord as unknown as Record<string, unknown>,
					});
					if (contextPrepared.ok && contextPrepared.writeIntent !== undefined) {
						applyFlowDeskSessionEvidenceWriteIntentsV1(input.rootDir, [contextPrepared.writeIntent]);
					}
				} catch (contextErr) {
					// Auxiliary write — do not fail lane launch
					process.stderr.write(
						`[flowdesk] reviewer_lane_context write failed (non-fatal): ${contextErr instanceof Error ? contextErr.message : "unknown"}\n`,
					);
				}
			}
		}
		if (launchResult.status !== "lane_launch_started") {
			lanes.push({
				launchPlanEvidenceId: expectation.launchPlanEvidenceId,
				perspective: expectation.perspective,
				launchStatus: launchResult.status,
				runningLifecycle: runningLifecycle.lifecycleState,
				redactedBlockReason: "runtime lane launch did not start",
			});
			continue;
		}
		const childSessionId = launchResult.childSessionRef?.startsWith("ses-")
			? launchResult.childSessionRef.slice("ses-".length)
			: undefined;
		if (childSessionId === undefined) {
			const terminalWritten = writeTerminalReviewerLaneLifecycle({
				rootDir: input.rootDir,
				workflowId,
				evidenceId: expectation.completeLifecycleEvidenceId,
				launchPlan,
				childSessionRef: launchResult.childSessionRef,
				messageRef: launchResult.messageRef,
				state: "invocation_failed",
				observedAt,
			});
			writeAttempted = writeAttempted || terminalWritten;
			lanes.push({
				launchPlanEvidenceId: expectation.launchPlanEvidenceId,
				perspective: expectation.perspective,
				launchStatus: launchResult.status,
				runningLifecycle: runningLifecycle.lifecycleState,
				completeLifecycle: terminalWritten ? "invocation_failed" : undefined,
				observationStatus: "completion_wait_failed",
				redactedBlockReason: "runtime lane launch did not return a child session ref",
			});
			continue;
		}
		const waitResult = await waitForReviewerLaneCompletionV1({
			client: input.client,
			childSessionId,
			options: completionWaitOptions,
		});
		if (waitResult.status !== "completion_observed") {
			const terminalState = waitResult.status === "completion_timeout" ? "timeout" : "invocation_failed";
			const terminalWritten = writeTerminalReviewerLaneLifecycle({
				rootDir: input.rootDir,
				workflowId,
				evidenceId: expectation.completeLifecycleEvidenceId,
				launchPlan,
				childSessionRef: launchResult.childSessionRef,
				messageRef: launchResult.messageRef,
				state: terminalState,
				observedAt,
				timeoutMs: completionWaitOptions?.maxWaitMs,
			});
			writeAttempted = writeAttempted || terminalWritten;
			lanes.push({
				launchPlanEvidenceId: expectation.launchPlanEvidenceId,
				perspective: expectation.perspective,
				launchStatus: launchResult.status,
				runningLifecycle: runningLifecycle.lifecycleState,
				completeLifecycle: terminalWritten ? terminalState : undefined,
				observationStatus: waitResult.status,
				redactedObservationErrors: waitResult.redactedErrors,
				redactedBlockReason: "reviewer lane did not reach observable completion",
			});
			continue;
		}
		const observation = await observeInjectedSdkReviewerVerdictV1({
			client: input.client,
			request: {
				sessionId: childSessionId,
				workflowId,
				lanePlanRef: expectation.lanePlanRef,
				bindingRef: expectation.bindingRef,
				perspective:
					expectation.perspective as FlowDeskTopTierReviewPerspective,
				messagesResponse: waitResult.messagesResponse,
			},
		});
		if (observation.status !== "verdict_observed") {
			const terminalState = observation.status === "missing_verdict" ? "missing_verdict" : "tool_calls_only_no_verdict";
			const terminalWritten = writeTerminalReviewerLaneLifecycle({
				rootDir: input.rootDir,
				workflowId,
				evidenceId: expectation.completeLifecycleEvidenceId,
				launchPlan,
				childSessionRef: launchResult.childSessionRef,
				messageRef: launchResult.messageRef,
				state: terminalState,
				observedAt,
			});
			writeAttempted = writeAttempted || terminalWritten;
			lanes.push({
				launchPlanEvidenceId: expectation.launchPlanEvidenceId,
				perspective: expectation.perspective,
				launchStatus: launchResult.status,
				runningLifecycle: runningLifecycle.lifecycleState,
				completeLifecycle: terminalWritten ? terminalState : undefined,
				observationStatus: observation.status,
				redactedObservationErrors: observation.redactedErrors,
				redactedBlockReason: "typed reviewer verdict was not observed",
			});
			continue;
		}
		const observedVerdict = observation.verdict;
		if (observedVerdict === undefined) {
			lanes.push({
				launchPlanEvidenceId: expectation.launchPlanEvidenceId,
				perspective: expectation.perspective,
				launchStatus: launchResult.status,
				runningLifecycle: runningLifecycle.lifecycleState,
				observationStatus: observation.status,
				redactedBlockReason:
					"typed reviewer verdict observation did not include a verdict record",
			});
			continue;
		}
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
		writeAttempted = true;
		if (
			verdictMaterialization.status !== "verdict_evidence_recorded" ||
			completeLifecycle.status !== "lane_lifecycle_recorded"
		) {
			lanes.push({
				launchPlanEvidenceId: expectation.launchPlanEvidenceId,
				perspective: expectation.perspective,
				launchStatus: launchResult.status,
				runningLifecycle: runningLifecycle.lifecycleState,
				observationStatus: observation.status,
				verdictMaterializationStatus: verdictMaterialization.status,
				completeLifecycle: completeLifecycle.lifecycleState,
				redactedBlockReason:
					"runtime reviewer durable evidence materialization failed",
			});
			continue;
		}
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
		requiredPerspectives: expectations.map(
			(expectation) =>
				expectation.perspective as FlowDeskTopTierReviewPerspective,
		),
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
		requiredPerspectives: expectations.map(
			(expectation) =>
				expectation.perspective as FlowDeskTopTierReviewPerspective,
		),
	});
	return {
		adapterProfile: "runtime_reviewer_execution_bridge",
		status:
			durableLinkage.status === "durable_verdicts_accepted"
				? "runtime_reviewer_execution_completed"
				: "runtime_reviewer_execution_incomplete",
		launchAttempted,
		writeAttempted,
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
