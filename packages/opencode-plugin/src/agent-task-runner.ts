import { createHash } from "node:crypto";
import {
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
			for (const message of items) {
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
			attemptId: launchPlan.attempt_id ?? `attempt-task-${token}`,
			laneId: input.laneId,
			parentSessionRef: `ses-${input.parentSessionId}`,
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
		const taskFailedPrepared = prepareFlowDeskSessionEvidenceWriteIntentV1({
			workflowId: input.workflowId,
			evidenceId: taskFailedEvidenceId,
			record: taskFailedRecord as unknown as Record<string, unknown>,
		});
		if (taskFailedPrepared.ok && taskFailedPrepared.writeIntent !== undefined) {
			applyFlowDeskSessionEvidenceWriteIntentsV1(input.rootDir, [taskFailedPrepared.writeIntent]);
		}

		return {
			status: "task_failed",
			failureCategory,
			redactedReason: String(redactedReason).slice(0, 500),
			laneId: input.laneId,
		};
	}

	// Lane launched successfully - record heartbeat
	const attemptId = launchPlan.attempt_id ?? `attempt-task-${token}`;
	recordFlowDeskLaneHeartbeatV1({
		rootDir: input.rootDir,
		workflowId: input.workflowId,
		attemptId,
		laneId: input.laneId,
		parentSessionRef: `ses-${input.parentSessionId}`,
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

	if (resultText === undefined) {
		// No response text - write task_failed
		const taskFailedEvidenceId = `task-failed-${input.taskId}-${token}`;
		const taskFailedRecord: FlowDeskTaskFailedV1 = {
			schema_version: "flowdesk.task_failed.v1",
			workflow_id: input.workflowId,
			lane_id: input.laneId,
			task_id: input.taskId,
			agent_ref: input.agentRef,
			provider_qualified_model_id: input.providerQualifiedModelId,
			failure_category: "no_response",
			redacted_reason: "lane launched but no assistant response text found",
			created_at: observedAt,
			dispatch_authority_enabled: false,
		};
		const taskFailedPrepared = prepareFlowDeskSessionEvidenceWriteIntentV1({
			workflowId: input.workflowId,
			evidenceId: taskFailedEvidenceId,
			record: taskFailedRecord as unknown as Record<string, unknown>,
		});
		if (taskFailedPrepared.ok && taskFailedPrepared.writeIntent !== undefined) {
			applyFlowDeskSessionEvidenceWriteIntentsV1(input.rootDir, [taskFailedPrepared.writeIntent]);
		}
		return {
			status: "task_failed",
			failureCategory: "no_response",
			redactedReason: "lane launched but no assistant response text found",
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
	const taskResultPrepared = prepareFlowDeskSessionEvidenceWriteIntentV1({
		workflowId: input.workflowId,
		evidenceId: taskResultEvidenceId,
		record: taskResultRecord as unknown as Record<string, unknown>,
	});
	if (taskResultPrepared.ok && taskResultPrepared.writeIntent !== undefined) {
		applyFlowDeskSessionEvidenceWriteIntentsV1(input.rootDir, [taskResultPrepared.writeIntent]);
	}

	return {
		status: "task_completed",
		resultText: fullResultText,
		laneId: input.laneId,
		taskResultEvidenceId,
	};
}
