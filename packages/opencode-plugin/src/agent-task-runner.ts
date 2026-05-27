import { createHash } from "node:crypto";
import {
	type FlowDeskAgentTaskContextV1,
	type FlowDeskLaneLifecycleRecordV1,
	type FlowDeskTaskResultV1,
	type FlowDeskTaskFailedV1,
	type FlowDeskRuntimeLaneLaunchPlanV1,
	applyFlowDeskSessionEvidenceWriteIntentsV1,
	prepareFlowDeskSessionEvidenceWriteIntentV1,
} from "@flowdesk/core";
import {
	type FlowDeskManagedDispatchBetaOpenCodeClientV1,
	launchFlowDeskInjectedSdkRuntimeLaneFromPlanV1,
	materializeFlowDeskRuntimeLaneLaunchLifecycleEvidenceV1,
} from "./managed-dispatch-adapter.js";
import { recordFlowDeskLaneHeartbeatV1 } from "./lane-heartbeat-writer.js";

const TASK_RESULT_MAX_TEXT = 32_768;
const AGENT_TASK_CONTEXT_MAX_PROMPT_TEXT = 32_768;

export interface FlowDeskAgentTaskInputV1 {
	workflowId: string;
	taskId: string;
	laneId: string;
	agentRef: string;
	providerQualifiedModelId: string;
	promptText: string;
	parentSessionId: string;
	rootDir: string;
	client: FlowDeskManagedDispatchBetaOpenCodeClientV1;
	timeoutMs?: number;
	outputContract?: "final_assistant_text";
}

export type FlowDeskAgentTaskResultV1 =
	| { status: "task_completed"; resultText: string; laneId: string; taskResultEvidenceId: string }
	| { status: "task_failed"; failureCategory: string; redactedReason: string; laneId: string };

function agentTaskLaunchPlan(input: {
	workflowId: string;
	laneId: string;
	parentSessionId: string;
	agentRef: string;
	providerQualifiedModelId: string;
	token: string;
}): FlowDeskRuntimeLaneLaunchPlanV1 {
	return {
		schema_version: "flowdesk.runtime_lane_launch_plan.v1",
		ok: true,
		errors: [],
		launch_request_id: `launch-request-task-${input.token}`,
		workflow_id: input.workflowId,
		attempt_id: `attempt-task-${input.token}`,
		lane_id: input.laneId,
		state: "launch_ready",
		blocked_labels: [],
		parent_session_ref: `ses-${input.parentSessionId}`,
		agent_ref: input.agentRef,
		provider_qualified_model_id: input.providerQualifiedModelId,
		launch_reason: "agent_task",
		pre_launch_audit_ref: `audit-task-pre-launch-${input.token}`,
		lane_launch_approval_ref: `approval-task-lane-launch-${input.token}`,
		durable_evidence_root_ref: `evidence-root-task-${input.token}`,
		lifecycle_evidence_class: "lane_lifecycle",
		exact_binding_confirmed: true,
		sdk_client_required: true,
		launch_attempted: false,
		dispatch_authority_enabled: false,
		providerCall: false,
		actualLaneLaunch: false,
		runtimeExecution: false,
	};
}

function extractAssistantTextFromResponse(client: FlowDeskManagedDispatchBetaOpenCodeClientV1, childSessionId: string): Promise<string | undefined> | string | undefined {
	// We extract response text via messages API
	const messages = client.session.messages;
	if (messages === undefined) return undefined;
	return (async () => {
		try {
			const method = messages as (options: unknown) => unknown | Promise<unknown>;
			const current = await method.call(client.session, { sessionID: childSessionId });
			const response = isSdkErrorResponse(current)
				? await method.call(client.session, { path: { id: childSessionId } })
				: current;
			const data = asResponseData(response);
			const record = asRecord(data);
			const items = Array.isArray(data)
				? data
				: Array.isArray(record?.items)
					? record.items
					: Array.isArray(record?.messages)
						? record.messages
						: [];
				for (let index = items.length - 1; index >= 0; index -= 1) {
					const message = items[index];
					const record = asRecord(message);
					const info = asRecord(record?.info) ?? record;
					if (info?.role !== "assistant") continue;
				const parts = Array.isArray(record?.parts)
					? record.parts
					: Array.isArray(info?.parts)
						? info.parts
						: [];
				for (const part of parts) {
					const partRecord = asRecord(part);
					const text =
						typeof partRecord?.text === "string"
							? partRecord.text
							: typeof partRecord?.content === "string"
								? partRecord.content
								: undefined;
					if (typeof text === "string" && text.trim().length > 0) return text;
				}
			}
			return undefined;
		} catch {
			return undefined;
		}
	})();
}

function isProcessOnlyAssistantOutput(text: string): boolean {
	const normalized = text.trim().toLowerCase();
	return normalized.length === 0 || [
		"working",
		"thinking",
		"i'll take a look",
		"i will take a look",
		"let me inspect",
		"i'm going to inspect",
	].some((fragment) => normalized.includes(fragment));
}

function asRecord(value: unknown): Record<string, unknown> | undefined {
	return typeof value === "object" && value !== null && !Array.isArray(value)
		? (value as Record<string, unknown>)
		: undefined;
}

function asResponseData(value: unknown): unknown {
	const record = asRecord(value);
	return record !== undefined && "data" in record ? record.data : value;
}

function isSdkErrorResponse(value: unknown): boolean {
	const record = asRecord(value);
	const data = asRecord(asResponseData(value));
	return record?.error !== undefined || data?.error !== undefined;
}

function sha256Hex(text: string): string {
	return createHash("sha256").update(text, "utf8").digest("hex");
}

function writeSessionEvidence(input: {
	rootDir: string;
	workflowId: string;
	evidenceId: string;
	record: Record<string, unknown>;
}): void {
	const prepared = prepareFlowDeskSessionEvidenceWriteIntentV1({
		workflowId: input.workflowId,
		evidenceId: input.evidenceId,
		record: input.record,
	});
	if (prepared.ok && prepared.writeIntent !== undefined) {
		applyFlowDeskSessionEvidenceWriteIntentsV1(input.rootDir, [prepared.writeIntent]);
	}
}

function writeAgentTaskTerminalLifecycle(input: {
	rootDir: string;
	workflowId: string;
	laneId: string;
	attemptId: string;
	parentSessionRef: string;
	childSessionRef?: string;
	messageRef?: string;
	agentRef: string;
	providerQualifiedModelId: string;
	state: "incomplete" | "no_output" | "invocation_failed";
	outputRef?: string;
	evidenceId: string;
	createdAt: string;
	updatedAt: string;
	timeoutMs?: number;
}): void {
	const childSessionRef = input.childSessionRef === input.parentSessionRef ? undefined : input.childSessionRef;
	const record: FlowDeskLaneLifecycleRecordV1 = {
		schema_version: "flowdesk.lane_lifecycle_record.v1",
		lane_id: input.laneId,
		workflow_id: input.workflowId,
		attempt_id: input.attemptId,
		parent_session_ref: input.parentSessionRef,
		...(childSessionRef === undefined ? {} : { child_session_ref: childSessionRef }),
		...(input.messageRef === undefined ? {} : { message_ref: input.messageRef }),
		agent_ref: input.agentRef,
		provider_qualified_model_id: input.providerQualifiedModelId,
		state: input.state,
		...(input.outputRef === undefined ? {} : { output_ref: input.outputRef }),
		timeout_ms: input.timeoutMs ?? 0,
		orphan_max_age_ms: 0,
		retry_count: 0,
		created_at: input.createdAt,
		updated_at: input.updatedAt,
		dispatch_authority_enabled: false,
		providerCall: false,
		actualLaneLaunch: false,
		runtimeExecution: false,
	};
	writeSessionEvidence({
		rootDir: input.rootDir,
		workflowId: input.workflowId,
		evidenceId: input.evidenceId,
		record: record as unknown as Record<string, unknown>,
	});
}

export async function executeFlowDeskAgentTaskV1(
	input: FlowDeskAgentTaskInputV1,
): Promise<FlowDeskAgentTaskResultV1> {
	const observedAt = new Date().toISOString();
	const token = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;

	const launchPlan = agentTaskLaunchPlan({
		workflowId: input.workflowId,
		laneId: input.laneId,
		parentSessionId: input.parentSessionId,
		agentRef: input.agentRef,
		providerQualifiedModelId: input.providerQualifiedModelId,
		token,
	});

	const runningLifecycleEvidenceId = `lifecycle-task-running-${input.laneId}-${token}`;
	const attemptId = launchPlan.attempt_id ?? `attempt-task-${token}`;
	const parentSessionRef = `ses-${input.parentSessionId}`;
	const promptTextTruncated = input.promptText.length > AGENT_TASK_CONTEXT_MAX_PROMPT_TEXT;
	const agentTaskContextRecord: FlowDeskAgentTaskContextV1 = {
		schema_version: "flowdesk.agent_task_context.v1",
		workflow_id: input.workflowId,
		lane_id: input.laneId,
		task_id: input.taskId,
		agent_ref: input.agentRef,
		provider_qualified_model_id: input.providerQualifiedModelId,
		parent_session_ref: parentSessionRef,
		prompt_text: promptTextTruncated
			? input.promptText.slice(0, AGENT_TASK_CONTEXT_MAX_PROMPT_TEXT)
			: input.promptText,
		prompt_text_truncated: promptTextTruncated,
		prompt_text_sha256: sha256Hex(input.promptText),
		redaction_version: "v1",
		created_at: observedAt,
		dispatch_authority_enabled: false,
	};
	writeSessionEvidence({
		rootDir: input.rootDir,
		workflowId: input.workflowId,
		evidenceId: `agent-task-context-${input.taskId}-${token}`,
		record: agentTaskContextRecord as unknown as Record<string, unknown>,
	});

	// Launch the lane
	const launchResult = await launchFlowDeskInjectedSdkRuntimeLaneFromPlanV1({
		client: input.client,
		launchPlan,
		request: {
			allowActualLaneLaunch: true,
			parentSessionId: input.parentSessionId,
			promptText: input.promptText,
			dispatchMethod: "prompt",
		},
	});

	// Write running lifecycle evidence
	materializeFlowDeskRuntimeLaneLaunchLifecycleEvidenceV1({
		rootDir: input.rootDir,
		launchPlan,
		launchResult,
		evidenceId: runningLifecycleEvidenceId,
		observedAt,
	});

	if (launchResult.status !== "lane_launch_started") {
		// Record heartbeat for failed launch
		recordFlowDeskLaneHeartbeatV1({
			rootDir: input.rootDir,
			workflowId: input.workflowId,
			attemptId,
			laneId: input.laneId,
			parentSessionRef,
			agentRef: input.agentRef,
			providerQualifiedModelId: input.providerQualifiedModelId,
			state: "running",
			observedAt,
			progressSummaryLabel: `agent task lane launch failed`,
		});

		// Write task_failed evidence
		const failureCategory = launchResult.status === "lane_launch_failed" ? "sdk_create_failed" : "unknown";
		const redactedReason = launchResult.redactedBlockReason ?? launchResult.redactedErrorCategory ?? "lane launch did not start";
		const taskFailedEvidenceId = `task-failed-${input.taskId}-${token}`;
		const taskFailedRecord: FlowDeskTaskFailedV1 = {
			schema_version: "flowdesk.task_failed.v1",
			workflow_id: input.workflowId,
			lane_id: input.laneId,
			task_id: input.taskId,
			agent_ref: input.agentRef,
			provider_qualified_model_id: input.providerQualifiedModelId,
			failure_category: failureCategory,
			redacted_reason: String(redactedReason).slice(0, 500),
			created_at: observedAt,
			dispatch_authority_enabled: false,
		};
		writeSessionEvidence({
			rootDir: input.rootDir,
			workflowId: input.workflowId,
			evidenceId: taskFailedEvidenceId,
			record: taskFailedRecord as unknown as Record<string, unknown>,
		});
		writeAgentTaskTerminalLifecycle({
			rootDir: input.rootDir,
			workflowId: input.workflowId,
			laneId: input.laneId,
			attemptId,
			parentSessionRef,
			agentRef: input.agentRef,
			providerQualifiedModelId: input.providerQualifiedModelId,
			state: "invocation_failed",
			evidenceId: `lifecycle-task-terminal-${input.laneId}-${token}`,
			createdAt: observedAt,
			updatedAt: new Date().toISOString(),
			timeoutMs: input.timeoutMs,
		});

		return {
			status: "task_failed",
			failureCategory,
			redactedReason: String(redactedReason).slice(0, 500),
			laneId: input.laneId,
		};
	}

	// Lane launched successfully - record heartbeat
	recordFlowDeskLaneHeartbeatV1({
		rootDir: input.rootDir,
		workflowId: input.workflowId,
		attemptId,
		laneId: input.laneId,
		parentSessionRef,
		agentRef: input.agentRef,
		providerQualifiedModelId: input.providerQualifiedModelId,
		state: "running",
		observedAt,
		progressSummaryLabel: `agent task lane launch heartbeat`,
	});

	// Extract child session ID and get response text
	const childSessionId = launchResult.childSessionRef?.startsWith("ses-")
		? launchResult.childSessionRef.slice("ses-".length)
		: undefined;

	let resultText: string | undefined;
	if (childSessionId !== undefined) {
		resultText = await extractAssistantTextFromResponse(input.client, childSessionId);
	}

	if (resultText === undefined || (input.outputContract === "final_assistant_text" && isProcessOnlyAssistantOutput(resultText))) {
		// No response text - write task_failed
		const taskFailedEvidenceId = `task-failed-${input.taskId}-${token}`;
		const failureCategory = resultText === undefined ? "no_response" : "contract_not_satisfied";
		const evidenceFailureCategory = resultText === undefined ? "no_response" : "unknown";
		const redactedReason = resultText === undefined
			? "lane launched but no assistant response text found"
			: "lane launched but final assistant response did not satisfy requested output contract";
		const taskFailedRecord: FlowDeskTaskFailedV1 = {
			schema_version: "flowdesk.task_failed.v1",
			workflow_id: input.workflowId,
			lane_id: input.laneId,
			task_id: input.taskId,
			agent_ref: input.agentRef,
			provider_qualified_model_id: input.providerQualifiedModelId,
			failure_category: evidenceFailureCategory,
			redacted_reason: redactedReason,
			created_at: observedAt,
			dispatch_authority_enabled: false,
		};
		writeSessionEvidence({
			rootDir: input.rootDir,
			workflowId: input.workflowId,
			evidenceId: taskFailedEvidenceId,
			record: taskFailedRecord as unknown as Record<string, unknown>,
		});
		writeAgentTaskTerminalLifecycle({
			rootDir: input.rootDir,
			workflowId: input.workflowId,
			laneId: input.laneId,
			attemptId,
			parentSessionRef,
			childSessionRef: launchResult.childSessionRef,
			messageRef: launchResult.messageRef?.startsWith("msg-") ? launchResult.messageRef : undefined,
			agentRef: input.agentRef,
			providerQualifiedModelId: input.providerQualifiedModelId,
			state: resultText === undefined ? "no_output" : "incomplete",
			evidenceId: `lifecycle-task-terminal-${input.laneId}-${token}`,
			createdAt: observedAt,
			updatedAt: new Date().toISOString(),
			timeoutMs: input.timeoutMs,
		});
		return {
			status: "task_failed",
			failureCategory,
			redactedReason,
			laneId: input.laneId,
		};
	}

	// Truncate if needed
	const fullResultText = resultText;
	const truncated = fullResultText.length > TASK_RESULT_MAX_TEXT;
	const storedResultText = truncated ? fullResultText.slice(0, TASK_RESULT_MAX_TEXT) : fullResultText;
	const promptSha256 = sha256Hex(input.promptText);
	const resultSha256 = sha256Hex(fullResultText);

	// Write task_result evidence
	const taskResultEvidenceId = `task-result-${input.taskId}-${token}`;
	const taskResultRecord: FlowDeskTaskResultV1 = {
		schema_version: "flowdesk.task_result.v1",
		workflow_id: input.workflowId,
		lane_id: input.laneId,
		task_id: input.taskId,
		agent_ref: input.agentRef,
		provider_qualified_model_id: input.providerQualifiedModelId,
		task_prompt_sha256: promptSha256,
		result_text: storedResultText,
		result_text_truncated: truncated,
		result_text_sha256: resultSha256,
		created_at: observedAt,
		dispatch_authority_enabled: false,
	};
	writeSessionEvidence({
		rootDir: input.rootDir,
		workflowId: input.workflowId,
		evidenceId: taskResultEvidenceId,
		record: taskResultRecord as unknown as Record<string, unknown>,
	});
	writeAgentTaskTerminalLifecycle({
		rootDir: input.rootDir,
		workflowId: input.workflowId,
		laneId: input.laneId,
		attemptId,
		parentSessionRef,
		childSessionRef: launchResult.childSessionRef,
		messageRef: launchResult.messageRef?.startsWith("msg-") ? launchResult.messageRef : undefined,
		agentRef: input.agentRef,
		providerQualifiedModelId: input.providerQualifiedModelId,
		state: "incomplete",
		outputRef: `output-${taskResultEvidenceId}`,
		evidenceId: `lifecycle-task-terminal-${input.laneId}-${token}`,
		createdAt: observedAt,
		updatedAt: new Date().toISOString(),
		timeoutMs: input.timeoutMs,
	});

	return {
		status: "task_completed",
		resultText: fullResultText,
		laneId: input.laneId,
		taskResultEvidenceId,
	};
}
