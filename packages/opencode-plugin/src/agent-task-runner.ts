import { createHash } from "node:crypto";
import {
	type FlowDeskAgentTaskContextV1,
	type FlowDeskAgentTaskProgressV1,
	type FlowDeskLaneLifecycleRecordV1,
	type FlowDeskTaskResultV1,
	type FlowDeskTaskFailedV1,
	type FlowDeskRuntimeLaneLaunchPlanV1,
	type FlowDeskTopTierReviewVerdictV1,
	applyFlowDeskSessionEvidenceWriteIntentsV1,
	prepareFlowDeskSessionEvidenceWriteIntentV1,
	reloadFlowDeskSessionEvidenceV1,
	validateTopTierReviewVerdictV1,
} from "@flowdesk/core";
import {
	type FlowDeskManagedDispatchBetaOpenCodeClientV1,
	launchFlowDeskInjectedSdkRuntimeLaneFromPlanV1,
	materializeFlowDeskRuntimeLaneLaunchLifecycleEvidenceV1,
} from "./managed-dispatch-adapter.js";
import { observeFlowDeskAgentTaskOutputV1, type FlowDeskAgentTaskCompletionStatusV1 } from "./agent-task-output.js";
import { refreshFlowDeskCompletionUiCachesV1 } from "./completion-ui-cache.js";
import { recordFlowDeskLaneHeartbeatV1 } from "./lane-heartbeat-writer.js";

const TASK_RESULT_MAX_TEXT = 32_768;
const AGENT_TASK_CONTEXT_MAX_PROMPT_TEXT = 32_768;
const INVALID_PARENT_SESSION_REF = "ses-invalid-parent-session-binding" as const;

export interface FlowDeskAgentTaskFallbackBindingV1 {
	agentRef: string;
	providerQualifiedModelId: string;
}

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
	/**
	 * When true, return immediately after lane launch with { status: "task_launched" }.
	 * The watchdog takes over polling, nudging (noReply), and aborting the child session.
	 * The coordinator polls flowdesk_status_live to detect terminal state.
	 */
	asyncMode?: boolean;
	/**
	 * When provided and the primary attempt fails with no_response,
	 * automatically retry once with this fallback agent/model binding.
	 */
	fallbackBinding?: FlowDeskAgentTaskFallbackBindingV1;
	/** Override quiet period before nudge — for testing only */
	_nudgeQuietPeriodMs?: number;
	/** Override messages poll timeout — for testing only (default 3000ms in prod) */
	_messagesTimeoutMs?: number;
	/** Override launch timeout — for testing only (default 300000ms = 5min in prod) */
	_launchTimeoutMs?: number;
	/** Internal: true when this is already a fallback retry (prevents infinite retry) */
	_isFallbackRetry?: boolean;
}

export type FlowDeskAgentTaskResultV1 =
	| { status: "task_completed"; resultText: string; laneId: string; taskResultEvidenceId: string }
	| { status: "task_launched"; laneId: string; childSessionId: string }
	| { status: "task_failed"; failureCategory: string; redactedReason: string; laneId: string };

/** Schema version for async child session tracking evidence */
export const AGENT_TASK_CHILD_SESSION_SCHEMA_VERSION = "flowdesk.agent_task_child_session.v1" as const;

/**
 * Result of the permissive capture layer. The capture layer's ONLY job is to
 * reliably surface whatever assistant text the child session produced plus
 * advisory transport metadata. It never judges substance/quality — the main
 * coordinator reads this and decides success/failure/retry.
 */
type FlowDeskAgentTaskCaptureResultV1 = {
	text: string;
	completionStatus: FlowDeskAgentTaskCompletionStatusV1;
	outputKind: string;
	usableForSynthesis: boolean;
	finalizationReason: "terminal_marker" | "stable_idle" | "nudge_exhausted_partial";
	looksLikeRefusalOrError: boolean;
};

/** Stable-idle finalization thresholds for non-terminal captured text. */
const STABLE_IDLE_MIN_CYCLES = 3;
const STABLE_IDLE_MIN_MS = 12_000;
const STABLE_IDLE_MIN_LEN = 16;

export function sanitizeFlowDeskTaskResultTextV1(text: string): { text: string; changed: boolean; truncated: boolean } {
	return {
		text: text.length > TASK_RESULT_MAX_TEXT ? text.slice(0, TASK_RESULT_MAX_TEXT) : text,
		changed: false,
		truncated: text.length > TASK_RESULT_MAX_TEXT,
	};
}

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

function validateAgentTaskParentSessionId(parentSessionId: string): { ok: true; parentSessionRef: string } | { ok: false; redactedReason: string; parentSessionRef: typeof INVALID_PARENT_SESSION_REF } {
	const value = parentSessionId.trim();
	if (value.length === 0)
		return { ok: false, redactedReason: "missing_parent_session_binding", parentSessionRef: INVALID_PARENT_SESSION_REF };
	if (value.length > 128)
		return { ok: false, redactedReason: "invalid_parent_session_binding", parentSessionRef: INVALID_PARENT_SESSION_REF };
	// `ses-...` is FlowDesk's opaque session-ref wrapper, not the raw OpenCode
	// session id expected by SDK `session.create({ parentID })`. Accepting it here
	// causes evidence such as `ses-ses-flowdesk-coordinator` and can make the SDK
	// wait on a non-existent synthetic parent session until launch timeout.
	if (value.startsWith("ses-"))
		return { ok: false, redactedReason: "invalid_parent_session_binding", parentSessionRef: INVALID_PARENT_SESSION_REF };
	if (/\s/.test(value))
		return { ok: false, redactedReason: "invalid_parent_session_binding", parentSessionRef: INVALID_PARENT_SESSION_REF };
	if (!/^[A-Za-z0-9_.:-]+$/.test(value))
		return { ok: false, redactedReason: "invalid_parent_session_binding", parentSessionRef: INVALID_PARENT_SESSION_REF };
	return { ok: true, parentSessionRef: `ses-${value}` };
}

/** Bounded nudge text — versioned constant, never echoes user input */
const AGENT_TASK_NUDGE_TEXT = "Please provide your final answer now. If you have completed your analysis, output your complete response." as const;

/**
 * Polls `session.messages` with a per-call 3-second cap so it works whether the SDK
 * uses snapshot (returns immediately) or long-poll (blocks until output) semantics.
 *
 * Heartbeat: fires every `quietPeriodMs` of silence — only when inactive.
 * Nudge:     after `quietPeriodMs` of silence, sends a bounded prompt to the child
 *            session asking for the final answer. Max `maxNudges` nudges total.
 *            After exhausting nudges with no response, returns undefined.
 */
async function extractAssistantTextFromResponse(
	client: FlowDeskManagedDispatchBetaOpenCodeClientV1,
	childSessionId: string,
	opts?: {
		quietPeriodMs?: number;          // silence before heartbeat / nudge (default 30s)
		maxNudges?: number;              // max nudge attempts (default 2)
		runtimeModel?: string;           // OpenCode runtime model id for nudge prompt
		agentName?: string;              // agent name for nudge prompt
		messagesTimeoutMs?: number;      // per-call cap for session.messages (default 3000ms)
		heartbeatFn?: (elapsedMs: number) => void;
	},
): Promise<FlowDeskAgentTaskCaptureResultV1 | undefined> {
	const messages = client.session.messages;
	if (messages === undefined) return undefined;

	const quietPeriodMs = opts?.quietPeriodMs ?? 30_000;
	const maxNudges = opts?.maxNudges ?? 2;
	const MESSAGES_TIMEOUT_MS = opts?.messagesTimeoutMs ?? 3_000; // per-call cap — handles both snapshot and long-poll

	const method = messages as (options: unknown) => unknown | Promise<unknown>;

	/**
	 * Call session.messages with a ceiling timeout so we can check inactivity periodically.
	 * This handles both snapshot APIs (return immediately) and long-poll APIs
	 * (block until LLM produces output). With the timeout, a long-poll call that
	 * hasn't returned after MESSAGES_TIMEOUT_MS resolves as null so we can
	 * check the inactivity clock and possibly send a nudge.
	 */
	const callMessages = (): Promise<unknown | null> => {
		const messagePromise = (async () => {
			const current = await method.call(client.session, { sessionID: childSessionId });
			if (isSdkErrorResponse(current))
				return method.call(client.session, { path: { id: childSessionId } });
			return current;
		})();
		// Only race against timeout when the API might block (MESSAGES_TIMEOUT_MS > 0)
		if (MESSAGES_TIMEOUT_MS <= 0) return messagePromise;
		return Promise.race([
			messagePromise,
			new Promise<null>(resolve => setTimeout(() => resolve(null), MESSAGES_TIMEOUT_MS)),
		]);
	};

	/** Send a nudge to the child session with a hard timeout to prevent blocking.
	 * Uses noReply: true so the child does not generate a spurious second assistant turn.
	 */
	const sendNudge = async (): Promise<"sent" | "timeout" | "skipped"> => {
		const promptFn = client.session.prompt ?? client.session.promptAsync;
		if (promptFn === undefined) return "skipped";
		const NUDGE_TIMEOUT_MS = 5_000;
		try {
			await Promise.race([
				(promptFn as (o: unknown) => unknown).call(client.session, {
					sessionID: childSessionId,
					noReply: true,
					...(opts?.runtimeModel !== undefined ? { model: opts.runtimeModel } : {}),
					...(opts?.agentName !== undefined ? { agent: opts.agentName } : {}),
					parts: [{ type: "text", text: AGENT_TASK_NUDGE_TEXT }],
				}),
				new Promise<never>((_, reject) =>
					setTimeout(() => reject(new Error("nudge timeout")), NUDGE_TIMEOUT_MS),
				),
			]);
			return "sent";
		} catch { return "timeout"; }
	};

	const observe = (response: unknown) => {
		if (response === null) return undefined; // timed-out poll cycle
		return observeFlowDeskAgentTaskOutputV1(response);
	};

	const startMs = Date.now();
	let lastActivityMs = startMs;
	let lastSignature = "";
	let lastHeartbeatMs = startMs;
	let nudgeCount = 0;
	let latestCandidate: ReturnType<typeof observeFlowDeskAgentTaskOutputV1> | undefined;
	// Stable-idle tracking: capture non-terminal text once it has settled, so a
	// good answer is not lost just because the SDK shape never surfaced an
	// explicit terminal/finish marker.
	let stableText: string | undefined;
	let stableCount = 0;
	let firstStableMs = 0;

	try {
		while (true) {
			const response = await callMessages();
			const nowMs = Date.now();

			// Build signature (null response = timeout, no change)
			const sig = response === null ? lastSignature : (() => {
				const data = asResponseData(response);
				const record = asRecord(data);
				const items = Array.isArray(data) ? data
					: Array.isArray(record?.items) ? record.items
					: Array.isArray(record?.messages) ? record.messages : [];
				const observed = observe(response);
				return `${items.length}:${observed?.latestText?.length ?? 0}:${observed?.terminalObserved === true ? "terminal" : "open"}`;
			})();

			if (sig !== lastSignature) {
				// New activity — reset all inactivity clocks
				lastSignature = sig;
				lastActivityMs = nowMs;
				lastHeartbeatMs = nowMs;
			}

			const observed = observe(response);
			if (observed?.latestText !== undefined && observed.latestText.trim().length > 0) {
				latestCandidate = observed;
				// Track text stability for idle finalization. Active tool runs reset
				// stability so we never finalize mid tool-call.
				if (observed.hasRunningTool) {
					stableText = undefined;
					stableCount = 0;
				} else if (observed.latestText === stableText) {
					stableCount++;
				} else {
					stableText = observed.latestText;
					stableCount = 1;
					firstStableMs = nowMs;
				}
			}
			if (observed?.terminalObserved === true && observed.latestText !== undefined && observed.latestText.trim().length > 0) {
				return { text: observed.latestText, completionStatus: "final", outputKind: observed.outputKind, usableForSynthesis: observed.usableForSynthesis, finalizationReason: "terminal_marker", looksLikeRefusalOrError: observed.looksLikeRefusalOrError };
			}
			// Stable-idle: non-terminal text that has been unchanged across several
			// poll cycles and a minimum interval is treated as captured (not a
			// semantic success claim — completion_status stays "final" but the
			// finalization_reason records that this was idle-based capture).
			if (
				latestCandidate?.latestText !== undefined &&
				stableText !== undefined &&
				stableText.trim().length >= STABLE_IDLE_MIN_LEN &&
				stableCount >= STABLE_IDLE_MIN_CYCLES &&
				nowMs - firstStableMs >= STABLE_IDLE_MIN_MS
			) {
				return { text: latestCandidate.latestText, completionStatus: "final", outputKind: latestCandidate.outputKind, usableForSynthesis: latestCandidate.usableForSynthesis, finalizationReason: "stable_idle", looksLikeRefusalOrError: latestCandidate.looksLikeRefusalOrError };
			}

			const silenceMs = nowMs - lastActivityMs;

			if (silenceMs >= quietPeriodMs) {
				// Emit heartbeat on first quiet-period expiry of each silence window
				if (nowMs - lastHeartbeatMs >= quietPeriodMs) {
					lastHeartbeatMs = nowMs;
					opts?.heartbeatFn?.(nowMs - startMs);
				}

				// Send nudge after quiet period
			if (nudgeCount < maxNudges) {
				nudgeCount++;
				await sendNudge();
				// Reset activity clock after nudge — give a fresh quiet window
				lastActivityMs = Date.now();
				lastHeartbeatMs = lastActivityMs;
			} else {
				// Exhausted all nudges. Preserve usable candidate text as partial output.
				if (latestCandidate?.latestText !== undefined && latestCandidate.latestText.trim().length > 0) {
					return { text: latestCandidate.latestText, completionStatus: "partial", outputKind: latestCandidate.outputKind, usableForSynthesis: latestCandidate.usableForSynthesis, finalizationReason: "nudge_exhausted_partial", looksLikeRefusalOrError: latestCandidate.looksLikeRefusalOrError };
				}
				return undefined;
			}
		} else {
			// No activity and not yet at quiet period — yield to event loop before next poll.
			// Sleep for up to 1s or quietPeriodMs/10, whichever is smaller, to avoid tight loops
			// while still being responsive when messages arrive quickly (snapshot mode).
			const yieldMs = Math.max(10, Math.min(1_000, Math.floor(quietPeriodMs / 10)));
			await new Promise<void>(resolve => setTimeout(resolve, yieldMs));
		}
	}
	} catch {
		return undefined;
	}
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
}): boolean {
	const prepared = prepareFlowDeskSessionEvidenceWriteIntentV1({
		workflowId: input.workflowId,
		evidenceId: input.evidenceId,
		record: input.record,
	});
	if (prepared.ok && prepared.writeIntent !== undefined) {
		const applied = applyFlowDeskSessionEvidenceWriteIntentsV1(input.rootDir, [prepared.writeIntent]);
		return applied.ok && applied.writtenPaths.length > 0;
	}
	return false;
}

function progressLabel(value: string): string {
	const compact = value.replace(/\s+/g, " ").trim();
	return compact.length > 120 ? `${compact.slice(0, 119)}…` : compact;
}

function writeAgentTaskProgress(input: {
	rootDir: string;
	workflowId: string;
	laneId: string;
	taskId: string;
	agentRef: string;
	providerQualifiedModelId: string;
	phase: FlowDeskAgentTaskProgressV1["phase"];
	progressSeq: number;
	progressLabel: string;
	observedAt?: string;
}): void {
	const observedAt = input.observedAt ?? new Date().toISOString();
	const record: FlowDeskAgentTaskProgressV1 = {
		schema_version: "flowdesk.agent_task_progress.v1",
		workflow_id: input.workflowId,
		lane_id: input.laneId,
		task_id: input.taskId,
		agent_ref: input.agentRef,
		provider_qualified_model_id: input.providerQualifiedModelId,
		progress_seq: input.progressSeq,
		observed_at: observedAt,
		phase: input.phase,
		progress_label: progressLabel(input.progressLabel),
		progress_ref: `progress-${input.laneId}-${input.progressSeq}`,
		redaction_version: "v1",
		dispatch_authority_enabled: false,
	};
	writeSessionEvidence({
		rootDir: input.rootDir,
		workflowId: input.workflowId,
		evidenceId: `agent-task-progress-${input.laneId}-${input.progressSeq}`,
		record: record as unknown as Record<string, unknown>,
	});
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
	state: "complete" | "incomplete" | "no_output" | "invocation_failed";
	outputRef?: string;
	verdictRef?: string;
	evidenceId: string;
	createdAt: string;
	updatedAt: string;
	timeoutMs?: number;
}): void {
	const childSessionRef = input.childSessionRef === input.parentSessionRef ? undefined : input.childSessionRef;
	const messageRef = input.messageRef ?? (input.state === "complete" ? `msg-${input.laneId}` : undefined);
	const record: FlowDeskLaneLifecycleRecordV1 = {
		schema_version: "flowdesk.lane_lifecycle_record.v1",
		lane_id: input.laneId,
		workflow_id: input.workflowId,
		attempt_id: input.attemptId,
		parent_session_ref: input.parentSessionRef,
		...(childSessionRef === undefined ? {} : { child_session_ref: childSessionRef }),
		...(messageRef === undefined ? {} : { message_ref: messageRef }),
		agent_ref: input.agentRef,
		provider_qualified_model_id: input.providerQualifiedModelId,
		state: input.state,
		...(input.verdictRef === undefined ? {} : { verdict_ref: input.verdictRef }),
		...(input.outputRef === undefined ? {} : { output_ref: input.outputRef }),
		...(input.state === "complete" ? { runtime_echo_ref: `runtime-echo-${input.laneId}`, telemetry_ref: `telemetry-${input.laneId}` } : {}),
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

function extractJsonBlocksFromText(raw: string): string[] {
	const trimmed = raw.trim();
	const results: string[] = [];
	if (trimmed.startsWith("{") && trimmed.endsWith("}")) return [trimmed];
	const fencePattern = /```(?:json)?\s*\n?(\{[\s\S]*?\})\s*\n?```/g;
	for (const match of trimmed.matchAll(fencePattern)) {
		if (match[1]) results.push(match[1].trim());
	}
	if (results.length > 0) return results;
	let depth = 0;
	let start = -1;
	let lastBlock: string | undefined;
	for (let i = 0; i < trimmed.length; i++) {
		const ch = trimmed[i];
		if (ch === "{") {
			if (depth === 0) start = i;
			depth++;
		} else if (ch === "}") {
			depth--;
			if (depth === 0 && start !== -1) {
				lastBlock = trimmed.slice(start, i + 1).trim();
				start = -1;
			}
		}
	}
	return lastBlock === undefined ? [] : [lastBlock];
}

function observedTopTierReviewerVerdictFromText(input: {
	text: string;
	workflowId: string;
}): FlowDeskTopTierReviewVerdictV1 | undefined {
	for (const block of extractJsonBlocksFromText(input.text)) {
		try {
			const candidate = JSON.parse(block) as unknown;
			const validation = validateTopTierReviewVerdictV1(candidate);
			if (!validation.ok) continue;
			const verdict = candidate as FlowDeskTopTierReviewVerdictV1;
			if (verdict.workflow_id === input.workflowId) return verdict;
		} catch {
			// Keep scanning candidates.
		}
	}
	return undefined;
}

function persistObservedReviewerVerdict(input: {
	rootDir: string;
	workflowId: string;
	verdict: FlowDeskTopTierReviewVerdictV1;
}): boolean {
	const evidenceId = input.verdict.verdict_id;
	if (!writeSessionEvidence({
		rootDir: input.rootDir,
		workflowId: input.workflowId,
		evidenceId,
		record: input.verdict as unknown as Record<string, unknown>,
	})) return false;
	const reloaded = reloadFlowDeskSessionEvidenceV1({
		rootDir: input.rootDir,
		workflowId: input.workflowId,
	});
	return reloaded.ok && reloaded.blocked.length === 0 && reloaded.entries.some((entry) =>
		entry.evidenceClass === "reviewer_verdict" &&
		entry.evidenceId === evidenceId &&
		entry.record.verdict_id === input.verdict.verdict_id
	);
}

export async function executeFlowDeskAgentTaskV1(
	input: FlowDeskAgentTaskInputV1,
): Promise<FlowDeskAgentTaskResultV1> {
	const observedAt = new Date().toISOString();
	const token = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
	const parentBinding = validateAgentTaskParentSessionId(input.parentSessionId);
	const parentSessionRef = parentBinding.parentSessionRef;
	const attemptId = `attempt-task-${token}`;

	if (!parentBinding.ok) {
		const taskFailedEvidenceId = `task-failed-${input.taskId}-${token}-invalid-parent`;
		const redactedReason = parentBinding.redactedReason;
		writeSessionEvidence({
			rootDir: input.rootDir,
			workflowId: input.workflowId,
			evidenceId: taskFailedEvidenceId,
			record: {
				schema_version: "flowdesk.task_failed.v1",
				workflow_id: input.workflowId,
				lane_id: input.laneId,
				task_id: input.taskId,
				agent_ref: input.agentRef,
				provider_qualified_model_id: input.providerQualifiedModelId,
				failure_category: "sdk_create_failed",
				redacted_reason: redactedReason,
				created_at: observedAt,
				dispatch_authority_enabled: false,
			} as unknown as Record<string, unknown>,
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
			evidenceId: `lifecycle-task-terminal-${input.laneId}-${token}-invalid-parent`,
			createdAt: observedAt,
			updatedAt: observedAt,
		});
		return { status: "task_failed", failureCategory: "sdk_create_failed", redactedReason, laneId: input.laneId };
	}

	const launchPlan = agentTaskLaunchPlan({
		workflowId: input.workflowId,
		laneId: input.laneId,
		parentSessionId: input.parentSessionId,
		agentRef: input.agentRef,
		providerQualifiedModelId: input.providerQualifiedModelId,
		token,
	});

	const runningLifecycleEvidenceId = `lifecycle-task-running-${input.laneId}-${token}`;
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
	writeAgentTaskProgress({
		rootDir: input.rootDir,
		workflowId: input.workflowId,
		laneId: input.laneId,
		taskId: input.taskId,
		agentRef: input.agentRef,
		providerQualifiedModelId: input.providerQualifiedModelId,
		phase: "started",
		progressSeq: 1,
		progressLabel: "agent task lane launch started",
		observedAt,
	});

	// Launch the lane — wrap in absolute timeout so session.prompt blocking doesn't hang forever.
	// The launch phase timeout is longer (5 min) since promptAsync may queue work before responding.
	// 1 min default — if session.prompt blocks for more than 1 min with no activity, give up
	const LAUNCH_TIMEOUT_MS = input._launchTimeoutMs ?? 60_000;
	const launchTimeoutHandle = setTimeout(() => { /* no-op; just a handle */ }, LAUNCH_TIMEOUT_MS);
	const dispatchMethod = input.client.session.promptAsync !== undefined ? "promptAsync" : "prompt";
	const launchResult = await Promise.race([
		launchFlowDeskInjectedSdkRuntimeLaneFromPlanV1({
			client: input.client,
			launchPlan,
			request: {
				allowActualLaneLaunch: true,
				parentSessionId: input.parentSessionId,
				promptText: input.promptText,
				dispatchMethod,
			},
		}),
		new Promise<{ status: "launch_timeout" }>(resolve =>
			setTimeout(() => resolve({ status: "launch_timeout" }), LAUNCH_TIMEOUT_MS)
		),
	]);
	clearTimeout(launchTimeoutHandle);

	if ("status" in launchResult && launchResult.status === "launch_timeout") {
		// session.prompt blocked for too long — treat as invocation failure
		const failedEvidenceId = `task-failed-${input.taskId}-${token}-launch-timeout`;
		writeSessionEvidence({
			rootDir: input.rootDir,
			workflowId: input.workflowId,
			evidenceId: failedEvidenceId,
			record: {
				schema_version: "flowdesk.task_failed.v1",
				workflow_id: input.workflowId,
				lane_id: input.laneId,
				task_id: input.taskId,
				agent_ref: input.agentRef,
				provider_qualified_model_id: input.providerQualifiedModelId,
				failure_category: "sdk_create_failed",
				redacted_reason: "lane launch timed out: session.prompt did not respond",
				created_at: observedAt,
				dispatch_authority_enabled: false,
			} as unknown as Record<string, unknown>,
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
			evidenceId: `lifecycle-task-terminal-${input.laneId}-${token}-launch-timeout`,
			createdAt: observedAt,
			updatedAt: new Date().toISOString(),
		});
		return { status: "task_failed", failureCategory: "sdk_create_failed", redactedReason: "launch timeout: session.prompt did not respond within the allowed window", laneId: input.laneId };
	}

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
		refreshFlowDeskCompletionUiCachesV1({
			rootDir: input.rootDir,
			workflowId: input.workflowId,
			observedAt,
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
	refreshFlowDeskCompletionUiCachesV1({
		rootDir: input.rootDir,
		workflowId: input.workflowId,
		observedAt,
	});

	// Extract child session ID
	const childSessionId = launchResult.childSessionRef?.startsWith("ses-")
		? launchResult.childSessionRef.slice("ses-".length)
		: undefined;

	// ── Async mode: return immediately, watchdog handles polling/nudging/abort ──
	if (input.asyncMode === true) {
		const resolvedChildId = childSessionId ?? "";
		// Write child session evidence so watchdog can find it
		writeSessionEvidence({
			rootDir: input.rootDir,
			workflowId: input.workflowId,
			evidenceId: `agent-task-child-session-${input.laneId}-${token}`,
			record: {
				schema_version: AGENT_TASK_CHILD_SESSION_SCHEMA_VERSION,
				workflow_id: input.workflowId,
				lane_id: input.laneId,
				task_id: input.taskId,
				child_session_id: resolvedChildId,
				parent_session_ref: parentSessionRef,
				provider_qualified_model_id: input.providerQualifiedModelId,
				agent_ref: input.agentRef,
				nudge_count: 0,
				last_nudge_at: null,
				created_at: observedAt,
				dispatch_authority_enabled: false,
			} as unknown as Record<string, unknown>,
		});
		writeAgentTaskProgress({
			rootDir: input.rootDir,
			workflowId: input.workflowId,
			laneId: input.laneId,
			taskId: input.taskId,
			agentRef: input.agentRef,
			providerQualifiedModelId: input.providerQualifiedModelId,
			phase: "waiting",
			progressSeq: 2,
			progressLabel: "agent task waiting for async child result",
		});
		refreshFlowDeskCompletionUiCachesV1({
			rootDir: input.rootDir,
			workflowId: input.workflowId,
			observedAt: new Date().toISOString(),
		});
		return { status: "task_launched", laneId: input.laneId, childSessionId: resolvedChildId };
	}

	let resultObservation: FlowDeskAgentTaskCaptureResultV1 | undefined;
	if (childSessionId !== undefined) {
		const runtimeModel = launchResult.status === "lane_launch_started" && typeof launchResult.model === "string"
			? launchResult.model : undefined;
		const agentName = launchResult.status === "lane_launch_started" && typeof launchResult.agent === "string"
			? launchResult.agent : undefined;
		resultObservation = await extractAssistantTextFromResponse(input.client, childSessionId, {
			quietPeriodMs: input._nudgeQuietPeriodMs ?? 20_000,  // default 20s per policy
			maxNudges: 2,
			runtimeModel,
			agentName,
			messagesTimeoutMs: input._messagesTimeoutMs,
			heartbeatFn: (elapsedMs) => {
				recordFlowDeskLaneHeartbeatV1({
					rootDir: input.rootDir,
					workflowId: input.workflowId,
					attemptId,
					laneId: input.laneId,
					parentSessionRef,
					agentRef: input.agentRef,
					providerQualifiedModelId: input.providerQualifiedModelId,
					state: "running",
					observedAt: new Date().toISOString(),
					progressSummaryLabel: `agent task waiting for response elapsed=${Math.floor(elapsedMs / 1000)}s`,
				});
			},
		});
	}

	const resultText = resultObservation?.text;
	if (resultText === undefined) {
		// No response text - write task_failed
		const taskFailedEvidenceId = `task-failed-${input.taskId}-${token}`;
		const failureCategory = "no_response";
		const evidenceFailureCategory = "no_response";
		const redactedReason = "lane launched but no assistant response text found";
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
		writeAgentTaskProgress({
			rootDir: input.rootDir,
			workflowId: input.workflowId,
			laneId: input.laneId,
			taskId: input.taskId,
			agentRef: input.agentRef,
			providerQualifiedModelId: input.providerQualifiedModelId,
			phase: "failed",
			progressSeq: 3,
			progressLabel: failureCategory === "no_response" ? "agent task finished without response" : "agent task output contract not satisfied",
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
			state: "no_output",
			evidenceId: `lifecycle-task-terminal-${input.laneId}-${token}`,
			createdAt: observedAt,
			updatedAt: new Date().toISOString(),
			timeoutMs: input.timeoutMs,
		});
		refreshFlowDeskCompletionUiCachesV1({
			rootDir: input.rootDir,
			workflowId: input.workflowId,
			observedAt: new Date().toISOString(),
		});

		// Auto-retry with fallback binding if configured and this is not already a retry
		if (input.fallbackBinding !== undefined && !input._isFallbackRetry) {
			const retryToken = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
			const retryTaskId = `${input.taskId}-retry-${retryToken.slice(0, 6)}`;
			const retryLaneId = `${input.laneId}-retry`;
			writeAgentTaskProgress({
				rootDir: input.rootDir,
				workflowId: input.workflowId,
				laneId: retryLaneId,
				taskId: retryTaskId,
				agentRef: input.fallbackBinding.agentRef,
				providerQualifiedModelId: input.fallbackBinding.providerQualifiedModelId,
				phase: "retrying",
				progressSeq: 0,
				progressLabel: `auto-retry with ${input.fallbackBinding.providerQualifiedModelId} after ${failureCategory}`,
			});
			return executeFlowDeskAgentTaskV1({
				...input,
				taskId: retryTaskId,
				laneId: retryLaneId,
				agentRef: input.fallbackBinding.agentRef,
				providerQualifiedModelId: input.fallbackBinding.providerQualifiedModelId,
				fallbackBinding: undefined,
				_isFallbackRetry: true,
			});
		}

		return {
			status: "task_failed",
			failureCategory,
			redactedReason,
			laneId: input.laneId,
		};
	}

	const fullResultText = resultText;
	const sanitizedResult = sanitizeFlowDeskTaskResultTextV1(fullResultText);
	const storedResultText = sanitizedResult.text;
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
		result_text_truncated: sanitizedResult.truncated,
		result_text_sha256: resultSha256,
		completion_status: resultObservation?.completionStatus ?? "final",
		output_kind: resultObservation?.outputKind as FlowDeskTaskResultV1["output_kind"] ?? "final_answer",
		usable_for_synthesis: resultObservation?.usableForSynthesis ?? true,
		// Capture/judgement separation: text was captured, so this is NOT a
		// contract failure. output_kind/completion_status/looks_like_refusal_or_error
		// are advisory inputs for the coordinator's substance judgement, never a
		// capture-side drop. missing_contract is only ever true when an explicit
		// contract was requested AND no text was captured (that path returns
		// task_failed above, so here it is always false).
		missing_contract: false,
		...(resultObservation?.finalizationReason === undefined
			? {}
			: { finalization_reason: resultObservation.finalizationReason }),
		looks_like_refusal_or_error: resultObservation?.looksLikeRefusalOrError ?? false,
		created_at: observedAt,
		dispatch_authority_enabled: false,
	};
		const taskResultWritten = writeSessionEvidence({
			rootDir: input.rootDir,
			workflowId: input.workflowId,
			evidenceId: taskResultEvidenceId,
			record: taskResultRecord as unknown as Record<string, unknown>,
		});
		if (!taskResultWritten) {
			const taskFailedEvidenceId = `task-failed-${input.taskId}-${token}-result-write`;
			const redactedReason = "task_result evidence persistence failed";
			writeSessionEvidence({
				rootDir: input.rootDir,
				workflowId: input.workflowId,
				evidenceId: taskFailedEvidenceId,
				record: {
					schema_version: "flowdesk.task_failed.v1",
					workflow_id: input.workflowId,
					lane_id: input.laneId,
					task_id: input.taskId,
					agent_ref: input.agentRef,
					provider_qualified_model_id: input.providerQualifiedModelId,
					failure_category: "unknown",
					redacted_reason: redactedReason,
					created_at: observedAt,
					dispatch_authority_enabled: false,
				} as unknown as Record<string, unknown>,
			});
			writeAgentTaskProgress({
				rootDir: input.rootDir,
				workflowId: input.workflowId,
				laneId: input.laneId,
				taskId: input.taskId,
				agentRef: input.agentRef,
				providerQualifiedModelId: input.providerQualifiedModelId,
				phase: "failed",
				progressSeq: 4,
				progressLabel: "agent task result persistence failed",
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
				evidenceId: `lifecycle-task-terminal-${input.laneId}-${token}-result-write`,
				createdAt: observedAt,
				updatedAt: new Date().toISOString(),
				timeoutMs: input.timeoutMs,
			});
			refreshFlowDeskCompletionUiCachesV1({
				rootDir: input.rootDir,
				workflowId: input.workflowId,
				observedAt,
			});
			return {
				status: "task_failed",
				failureCategory: "unknown",
				redactedReason,
				laneId: input.laneId,
			};
		}
	const observedReviewerVerdict = observedTopTierReviewerVerdictFromText({
		text: fullResultText,
		workflowId: input.workflowId,
	});
	const reviewerVerdictPersisted = observedReviewerVerdict === undefined
		? false
		: persistObservedReviewerVerdict({
			rootDir: input.rootDir,
			workflowId: input.workflowId,
			verdict: observedReviewerVerdict,
		});
	writeAgentTaskProgress({
		rootDir: input.rootDir,
		workflowId: input.workflowId,
		laneId: input.laneId,
		taskId: input.taskId,
		agentRef: input.agentRef,
		providerQualifiedModelId: input.providerQualifiedModelId,
		phase: "finalizing",
		progressSeq: 3,
		progressLabel: reviewerVerdictPersisted
			? "agent task result captured with reviewer verdict evidence"
			: "agent task result captured",
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
		state: reviewerVerdictPersisted ? "complete" : "incomplete",
		verdictRef: reviewerVerdictPersisted ? observedReviewerVerdict?.verdict_id : undefined,
		outputRef: `output-${taskResultEvidenceId}`,
		evidenceId: `lifecycle-task-terminal-${input.laneId}-${token}`,
		createdAt: observedAt,
		updatedAt: new Date().toISOString(),
		timeoutMs: input.timeoutMs,
	});
	refreshFlowDeskCompletionUiCachesV1({
		rootDir: input.rootDir,
		workflowId: input.workflowId,
		observedAt,
	});

	return {
		status: "task_completed",
		resultText: fullResultText,
		laneId: input.laneId,
		taskResultEvidenceId,
	};
}
