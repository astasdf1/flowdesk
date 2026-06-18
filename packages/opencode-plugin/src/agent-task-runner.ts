import { createHash } from "node:crypto";
import {
	type FlowDeskAgentTaskContextV1,
	type FlowDeskAgentTaskProgressV1,
	type FlowDeskTaskModelSelectionV1,
	type FlowDeskLaneLifecycleRecordV1,
	type FlowDeskTaskResultV1,
	type FlowDeskTaskFailedV1,
	type FlowDeskRuntimeLaneLaunchPlanV1,
	type FlowDeskSessionAbortDecisionV1,
	type FlowDeskTopTierReviewVerdictV1,
	type FlowDeskUsageAwareModelOverrideEvidenceV1,
	applyFlowDeskSessionEvidenceWriteIntentsV1,
	prepareFlowDeskSessionEvidenceWriteIntentV1,
	reloadFlowDeskSessionEvidenceV1,
	validateTopTierReviewVerdictV1,
} from "@flowdesk/core";
import {
	type FlowDeskManagedDispatchBetaOpenCodeClientV1,
	abortFlowDeskSessionWithDecisionV1,
	launchFlowDeskInjectedSdkRuntimeLaneFromPlanV1,
	materializeFlowDeskRuntimeLaneLaunchLifecycleEvidenceV1,
} from "./managed-dispatch-adapter.js";
import { observeFlowDeskAgentTaskOutputV1, type FlowDeskAgentTaskCompletionStatusV1, type FlowDeskAgentTaskOutputKindV1 } from "./agent-task-output.js";
import { refreshFlowDeskCompletionUiCachesV1 } from "./completion-ui-cache.js";
import { recordFlowDeskLaneHeartbeatV1 } from "./lane-heartbeat-writer.js";
import { createOISessionAccumulator, type FlowDeskOISessionAccumulatorV1 } from "./oi-session-accumulator.js";
import { resolveOpenCodeRuntimeLaunchModelBindingV1 } from "./model-selection-engine.js";
import { probeReadOnlySdkSessionMessagesV1 } from "./sdk-session-messages-probe.js";

const TASK_RESULT_MAX_TEXT = 32_768;
const AGENT_TASK_CONTEXT_MAX_PROMPT_TEXT = 32_768;
const FLOWDESK_TASK_DESCRIPTION_MAX_CHARS = 15_000;
const FLOWDESK_EARLY_LAUNCH_NO_SIGNAL_THRESHOLD_MS = 30_000;
const INVALID_PARENT_SESSION_REF = "ses-invalid-parent-session-binding" as const;
/** unattached launches will not appear in session-scoped sidebar rows and wake notifications will not be delivered to any specific session */
const UNATTACHED_PARENT_SESSION_REF = "ses-unattached-parent-session" as const;

const FLOWDESK_KNOWN_INVALID_MODEL_IDS = new Set([
	"google/gemini-3-pro-preview",
	"google/gemini-3-flash-preview",
	"google/gemini-3-flash-lite-preview",
	"anthropic/claude-not-opencode-supported",
]);

function isFlowDeskInvalidModelId(modelId: string): boolean {
	if (FLOWDESK_KNOWN_INVALID_MODEL_IDS.has(modelId)) return true;
	if (modelId.startsWith("google/gemini-3-")) return true;
	if (modelId.startsWith("anthropic/claude-not-")) return true;
	return false;
}

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
	parentSessionProviderQualifiedModelId?: string;
	rootDir: string;
	client: FlowDeskManagedDispatchBetaOpenCodeClientV1;
	timeoutMs?: number;
	outputContract?: "final_assistant_text";
	/**
	 * When true, return immediately after lane launch with { status: "task_launched" }.
	 * The watchdog takes over polling, nudging (noReply), and aborting the child session.
	 * The coordinator uses the short status wrapper to detect terminal state.
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
	/** Override early-launch diagnostic threshold — for testing only (default 30000ms in prod) */
	_earlyLaunchDiagnosticThresholdMsForTest?: number;
	/** Override launch timeout — for testing only (default 30000ms in prod) */
	_launchTimeoutMs?: number;
	/** Override heavy-model pre-first-token grace — for testing only */
	_heavyFirstTokenGraceMs?: number;
	/** Internal: true when this is already a fallback retry (prevents infinite retry) */
	_isFallbackRetry?: boolean;
	/**
	 * When false, OI session summary is written with generation_status "disabled_by_config"
	 * and all counts zero. Defaults to true (OI enabled).
	 */
	oiEnabled?: boolean;
	/**
	 * Optional pre-constructed OI accumulator to carry counts into this call.
	 * When absent, a fresh accumulator is created internally.
	 */
	_oiAccumulator?: FlowDeskOISessionAccumulatorV1;
	/**
	 * Optional — populated by the server handler (or other upstream caller)
	 * when usage-aware model resolution applied a pre-launch preferred-model
	 * substitution because the requested provider family was exhausted,
	 * critical, non_dispatchable, or stale per cached usage snapshots.
	 *
	 * When present and `originalModelId` differs from `providerQualifiedModelId`,
	 * `executeFlowDeskAgentTaskV1` writes a durable
	 * `flowdesk.usage_aware_model_override.v1` evidence record. Selection-phase
	 * evidence only — not managed fallback/reselection and does not carry
	 * fallback, dispatch, or runtime authority.
	 */
	usageAwareOverride?: {
		originalModelId: string;
		overrideReason: "exhausted" | "critical" | "non_dispatchable" | "stale";
		allowCrossFamily: boolean;
	};
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
	outputKind: FlowDeskAgentTaskOutputKindV1;
	usableForSynthesis: boolean;
	finalizationReason: "terminal_marker" | "stable_idle" | "nudge_exhausted_partial";
	looksLikeRefusalOrError: boolean;
	finalBodyObserved: boolean;
	terminalMarkerObserved: boolean;
};

export type FlowDeskCaptureSafetyMetadataV1 = {
	capture_status: "captured" | "uncertain" | "no_output";
	capture_confidence: "high" | "medium" | "low" | "none";
	observed_text_kind: FlowDeskAgentTaskOutputKindV1;
	final_body_observed: boolean;
	terminal_marker_observed: boolean;
	requires_coordinator_review: boolean;
	safe_for_auto_synthesis: boolean;
	display_as_uncertain_result: boolean;
};

export function buildFlowDeskCaptureSafetyMetadataV1(input: {
	text?: string;
	completionStatus?: FlowDeskAgentTaskCompletionStatusV1;
	outputKind?: string;
	finalizationReason?: string;
	finalBodyObserved?: boolean;
	terminalMarkerObserved?: boolean;
}): FlowDeskCaptureSafetyMetadataV1 {
	const textPresent = typeof input.text === "string" && input.text.trim().length > 0;
	const outputKind = (["final_answer", "partial_findings", "process_notes", "tool_trace_only", "empty"] as const)
		.includes(input.outputKind as FlowDeskAgentTaskOutputKindV1)
		? input.outputKind as FlowDeskAgentTaskOutputKindV1
		: textPresent ? "partial_findings" : "empty";
	const finalBodyObserved = input.finalBodyObserved ?? textPresent;
	const terminalMarkerObserved = input.terminalMarkerObserved ?? (input.finalizationReason === "terminal_marker" || input.finalizationReason === "finish_reason");
	// Enforcement invariant: process_notes (and tool_trace_only/empty) MUST NEVER be
	// safe for auto-synthesis, regardless of completionStatus, finalBodyObserved, or
	// terminalMarkerObserved. Only "final_answer" is synthesis-eligible. This guard
	// is the single authoritative enforcement point for the task_result evidence path.
	const synthesisEligibleKind = outputKind === "final_answer";
	const safeForAutoSynthesis = synthesisEligibleKind &&
		textPresent &&
		finalBodyObserved &&
		terminalMarkerObserved &&
		input.completionStatus !== "partial";
	if (!textPresent) {
		return {
			capture_status: "no_output",
			capture_confidence: "none",
			observed_text_kind: "empty",
			final_body_observed: false,
			terminal_marker_observed: terminalMarkerObserved,
			requires_coordinator_review: false,
			safe_for_auto_synthesis: false,
			display_as_uncertain_result: false,
		};
	}
	return {
		capture_status: safeForAutoSynthesis ? "captured" : "uncertain",
		capture_confidence: safeForAutoSynthesis ? "high" : "low",
		observed_text_kind: outputKind,
		final_body_observed: finalBodyObserved,
		terminal_marker_observed: terminalMarkerObserved,
		requires_coordinator_review: !safeForAutoSynthesis,
		safe_for_auto_synthesis: safeForAutoSynthesis,
		display_as_uncertain_result: !safeForAutoSynthesis,
	};
}

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
	// Empty parentSessionId is a valid unattached launch — the plan must still
	// carry a schema-safe parent_session_ref (>=3 chars, no trailing `-`). The
	// launcher recognizes the unattached sentinel and passes `parentID: undefined`
	// to the SDK so the child session is created without a parent binding.
	const parentSessionRef = input.parentSessionId.length === 0
		? UNATTACHED_PARENT_SESSION_REF
		: `ses-${input.parentSessionId}`;
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
		parent_session_ref: parentSessionRef,
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

function validateAgentTaskParentSessionId(parentSessionId: string): { ok: true; parentSessionRef: string; unattached: boolean } | { ok: false; redactedReason: string; parentSessionRef: typeof INVALID_PARENT_SESSION_REF } {
	const value = parentSessionId.trim();
	// An empty parentSessionId is a valid "unattached" launch. The flowdesk_task
	// compact tool intentionally seeds parent only from unconsumed completion-wake
	// ready-cache rows; when no usable seed exists, the lane must still launch
	// with no parent binding (SDK `session.create` receives `parentID: undefined`).
	if (value.length === 0)
		return { ok: true, parentSessionRef: UNATTACHED_PARENT_SESSION_REF, unattached: true };
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
	return { ok: true, parentSessionRef: `ses-${value}`, unattached: false };
}

function safeRecordAgentTaskHeartbeatV1(
	input: Parameters<typeof recordFlowDeskLaneHeartbeatV1>[0],
): void {
	try {
		recordFlowDeskLaneHeartbeatV1(input);
	} catch {
		// Heartbeats are diagnostic evidence only. A malformed stale parent/session
		// ref must never abort task failure materialization or leak a raw SDK/route
		// stack into the main OpenCode TUI.
	}
}

/** Bounded nudge text — versioned constant, never echoes user input */
const AGENT_TASK_NUDGE_TEXT = "Please provide your final answer now. If you have completed your analysis, output your complete response." as const;

/**
 * Pre-first-token grace for heavy models. Some heavy models (e.g. Claude Opus,
 * non-fast GPT-5.x, Codex) can take much longer than the light-model quiet
 * period to emit their FIRST assistant token on a large prompt, while still
 * working normally. Measured Claude Opus first-token latency on a long review
 * prompt was ~48s, which the default 10s/20s/30s policy mis-classified as
 * no_response. For heavy models only, the silence window BEFORE the first
 * assistant token is widened to 30s/60s/90s (nudge at 30s and 60s, give up at
 * 90s if still no first token). Once the first token arrives, the normal
 * 10s/20s/30s quiet/nudge policy applies for the rest of the stream. Light
 * models (mini/fast/spark/flash/flash-lite/haiku, plus gemini pro and sonnet)
 * keep the unchanged short policy throughout.
 */
const AGENT_TASK_HEAVY_FIRST_TOKEN_GRACE_MS = 30_000 as const;

/**
 * Classify a provider-qualified model id as "heavy" (slow to first token on
 * large prompts). Only these get the widened pre-first-token grace. The check
 * is conservative and explicitly excludes light/fast variants and the models
 * the operator does not consider heavy (gemini pro, sonnet).
 */
/**
 * Classify a provider-qualified model id as "heavy" (slow to first token on
 * large prompts). Only these get the widened pre-first-token grace. The check
 * is conservative and explicitly excludes light/fast variants and the models
 * the operator does not consider heavy (gemini pro, sonnet).
 */
export function isFlowDeskHeavyFirstTokenModelV1(providerQualifiedModelId: string | undefined): boolean {
	if (typeof providerQualifiedModelId !== "string") return false;
	const id = providerQualifiedModelId.toLowerCase();
	// Light/fast variants are never heavy, regardless of base family.
	if (/(mini|fast|spark|flash|flash-lite|haiku)/.test(id)) return false;
	// Operator decision: gemini pro and sonnet are NOT treated as heavy.
	if (/gemini[^/]*pro/.test(id)) return false;
	if (/sonnet/.test(id)) return false;
	// Heavy: Claude Opus, non-fast GPT-5.x main, and Codex models.
	if (/opus/.test(id)) return true;
	if (/codex/.test(id)) return true;
	if (/openai\/gpt-5(\.\d+)?$/.test(id)) return true;
	return false;
}

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
	token: string,
	opts?: {
		workflowId: string;
		rootDir: string;
		laneId: string;
		taskId: string;
		quietPeriodMs?: number;          // silence before heartbeat / nudge (default 10s)
		maxNudges?: number;              // max nudge attempts (default 2)
		runtimeModel?: string;           // OpenCode runtime model id for nudge prompt
		agentName?: string;              // agent name for nudge prompt
		messagesTimeoutMs?: number;      // per-call cap for session.messages (default 3000ms)
		firstTokenGraceMs?: number;      // widened silence window BEFORE first assistant token (heavy models)
		heartbeatFn?: (elapsedMs: number) => void;
		nudgeFn?: (nudgeCount: number, lastNudgeAt: string) => void;
	},
): Promise<FlowDeskAgentTaskCaptureResultV1 | undefined> {
	const messages = client.session.messages;
	if (messages === undefined) return undefined;

	const quietPeriodMs = opts?.quietPeriodMs ?? 10_000;
	const maxNudges = opts?.maxNudges ?? 2;
	const workflowId = opts?.workflowId ?? "";
	const rootDir = opts?.rootDir ?? "";
	const laneId = opts?.laneId ?? "";
	const taskId = opts?.taskId ?? "";
	// Pre-first-token grace only widens the FIRST silence window (before any
	// assistant token). Never smaller than the normal quiet period.
	const firstTokenGraceMs = Math.max(quietPeriodMs, opts?.firstTokenGraceMs ?? quietPeriodMs);
	let firstTokenSeen = false;
	const MESSAGES_TIMEOUT_MS = opts?.messagesTimeoutMs ?? 3_000; // per-call cap — handles both snapshot and long-poll

	/**
	 * Call session.messages with a ceiling timeout so we can check inactivity periodically.
	 * This handles both snapshot APIs (return immediately) and long-poll APIs
	 * (block until LLM produces output). With the timeout, a long-poll call that
	 * hasn't returned after MESSAGES_TIMEOUT_MS resolves as null so we can
	 * check the inactivity clock and possibly send a nudge. The helper is
	 * structured-first and catches legacy `%7Bid%7D` SDK route failures so raw
	 * OpenCode stack traces do not leak into TUI output.
	 */
	const callMessages = (): Promise<unknown | null> => {
		const messagePromise = (async () => {
			const result = await probeReadOnlySdkSessionMessagesV1(client, childSessionId);
			return result.status === "ok" ? result.response : null;
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
	let hasLogged30sDiag = false;
	let hasLogged60sDiag = false;

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
				firstTokenSeen = true;
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
				return { text: observed.latestText, completionStatus: "final", outputKind: observed.outputKind, usableForSynthesis: observed.usableForSynthesis, finalizationReason: "terminal_marker", looksLikeRefusalOrError: observed.looksLikeRefusalOrError, finalBodyObserved: true, terminalMarkerObserved: true };
			}
			if (observed?.terminalObserved === true && latestCandidate?.latestText !== undefined && latestCandidate.latestText.trim().length > 0) {
				return { text: latestCandidate.latestText, completionStatus: "partial", outputKind: latestCandidate.outputKind, usableForSynthesis: false, finalizationReason: "terminal_marker", looksLikeRefusalOrError: latestCandidate.looksLikeRefusalOrError, finalBodyObserved: false, terminalMarkerObserved: true };
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
				return { text: latestCandidate.latestText, completionStatus: "final", outputKind: latestCandidate.outputKind, usableForSynthesis: latestCandidate.usableForSynthesis, finalizationReason: "stable_idle", looksLikeRefusalOrError: latestCandidate.looksLikeRefusalOrError, finalBodyObserved: true, terminalMarkerObserved: false };
			}

			const silenceMs = nowMs - lastActivityMs;
			const totalElapsedMs = nowMs - startMs;

			// 30s diagnostic
			if (totalElapsedMs >= 30_000 && !firstTokenSeen && !hasLogged30sDiag) {
				hasLogged30sDiag = true;
				writeSessionEvidence({
					rootDir,
					workflowId,
					evidenceId: `early-launch-diag-${laneId}-${token}-30s`,
					record: {
						schema_version: "flowdesk.early_launch_diagnostic.v1",
						workflow_id: workflowId,
						lane_id: laneId,
						task_id: taskId,
						label: "session_may_have_failed_to_start",
						created_at: new Date().toISOString(),
						dispatch_authority_enabled: false,
					},
				});
			}

			// 60s diagnostic
			if (totalElapsedMs >= 60_000 && !firstTokenSeen && !hasLogged60sDiag) {
				hasLogged60sDiag = true;
				writeSessionEvidence({
					rootDir,
					workflowId,
					evidenceId: `early-launch-diag-${laneId}-${token}-60s`,
					record: {
						schema_version: "flowdesk.early_launch_diagnostic.v1",
						workflow_id: workflowId,
						lane_id: laneId,
						task_id: taskId,
						label: "no_first_signal",
						created_at: new Date().toISOString(),
						dispatch_authority_enabled: false,
					},
				});
			}

			// Heavy-model pre-first-token grace: while NO assistant token has
			// appeared yet, do NOT nudge. Nudging a heavy model that is still
			// producing its first token (a noReply prompt) only interferes with
			// the in-flight turn. Instead wait quietly until the first-token
			// deadline (the widened grace), emitting heartbeats so the lane still
			// looks alive, and only give up if no first token arrives in time.
			if (!firstTokenSeen && firstTokenGraceMs > quietPeriodMs) {
				const firstTokenDeadlineMs = firstTokenGraceMs * (maxNudges + 1); // e.g. 30s*3 = 90s
				if (totalElapsedMs >= firstTokenGraceMs && nowMs - lastHeartbeatMs >= firstTokenGraceMs) {
					lastHeartbeatMs = nowMs;
					opts?.heartbeatFn?.(totalElapsedMs);
				}
				if (totalElapsedMs >= firstTokenDeadlineMs) {
					// No first token within the heavy grace deadline — give up.
					return undefined;
				}
				// Keep waiting quietly for the first token.
				const yieldMs = Math.max(10, Math.min(1_000, Math.floor(quietPeriodMs / 10)));
				await new Promise<void>(resolve => setTimeout(resolve, yieldMs));
				continue;
			}

			// Normal quiet/nudge policy (light models, or after the first token).
			if (silenceMs >= quietPeriodMs) {
				// Emit heartbeat on first window expiry of each silence window
				if (nowMs - lastHeartbeatMs >= quietPeriodMs) {
					lastHeartbeatMs = nowMs;
					opts?.heartbeatFn?.(nowMs - startMs);
				}

				// Send nudge after quiet period
			if (nudgeCount < maxNudges) {
				nudgeCount++;
				await sendNudge();
				opts?.nudgeFn?.(nudgeCount, new Date().toISOString());
				// Reset activity clock after nudge — give a fresh quiet window
				lastActivityMs = Date.now();
				lastHeartbeatMs = lastActivityMs;
			} else {
				// Exhausted all nudges. Preserve usable candidate text as partial output.
				if (latestCandidate?.latestText !== undefined && latestCandidate.latestText.trim().length > 0) {
					return { text: latestCandidate.latestText, completionStatus: "partial", outputKind: latestCandidate.outputKind, usableForSynthesis: latestCandidate.usableForSynthesis, finalizationReason: "nudge_exhausted_partial", looksLikeRefusalOrError: latestCandidate.looksLikeRefusalOrError, finalBodyObserved: true, terminalMarkerObserved: false };
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

function normalizeProviderQualifiedModelId(value: string | undefined): string | undefined {
	if (typeof value !== "string") return undefined;
	const trimmed = value.trim();
	return /^[^\s/]+\/[^\s/]+$/.test(trimmed) ? trimmed : undefined;
}

function writeSessionEvidence(input: {
	rootDir: string;
	workflowId: string;
	evidenceId: string;
	record: Record<string, unknown>;
}): boolean {
	try {
		const prepared = prepareFlowDeskSessionEvidenceWriteIntentV1({
			workflowId: input.workflowId,
			evidenceId: input.evidenceId,
			record: input.record,
		});
		if (prepared.ok && prepared.writeIntent !== undefined) {
			const applied = applyFlowDeskSessionEvidenceWriteIntentsV1(input.rootDir, [prepared.writeIntent]);
			return applied.ok && applied.writtenPaths.length > 0;
		}
	} catch {
		// Session evidence writes are diagnostic/capture bookkeeping. Invalid stale
		// refs or filesystem races must not leak raw stacks into the parent TUI.
	}
	return false;
}

function writeRuntimeLaunchModelSelectionEvidence(input: {
	rootDir: string;
	workflowId: string;
	taskId: string;
	token: string;
	providerFamily?: "claude" | "openai" | "gemini";
	providerQualifiedModelId: string;
	attemptedProviderQualifiedModelIds: readonly string[];
	selectionStatus: FlowDeskTaskModelSelectionV1["selection_status"];
	blockedLabels: string[];
	createdAt: string;
}): void {
	if (input.providerFamily === undefined) return;
	const record: FlowDeskTaskModelSelectionV1 = {
		schema_version: "flowdesk.task_model_selection.v1",
		workflow_id: input.workflowId,
		task_id: input.taskId,
		selection_id: `selection-runtime-launch-${input.token}`,
		provider_family: input.providerFamily,
		provider_qualified_model_id: input.providerQualifiedModelId,
		attempted_provider_qualified_model_ids: [...input.attemptedProviderQualifiedModelIds].slice(0, 16),
		usage_snapshot_ref: `usage-runtime-launch-${input.token}`,
		usage_snapshot_freshness: "unknown",
		provider_health_ref: `provider-health-runtime-launch-${input.token}`,
		provider_health_label: "unknown",
		exact_model_availability_ref: `working-model-runtime-launch-${input.token}`,
		exact_model_availability_label: input.selectionStatus === "selected" ? "available" : "unknown",
		fit_label: "runtime_launch_same_family_binding",
		performance_label: "runtime_launch_not_ranked",
		selection_status: input.selectionStatus,
		blocked_labels: input.blockedLabels,
		fallback_allowed: false,
		reselection_allowed: false,
		created_at: input.createdAt,
		release_gate: "release1_planning_only",
		dispatch_authority_enabled: false,
		provider_call_made: false,
		runtime_execution: false,
		actual_lane_launch: false,
		write_authority_enabled: false,
		redaction_version: "v1",
	};
	writeSessionEvidence({
		rootDir: input.rootDir,
		workflowId: input.workflowId,
		evidenceId: `model-selection-fallback-${input.taskId}-${input.token}`,
		record: record as unknown as Record<string, unknown>,
	});
}

/**
 * Persist a durable evidence record for a usage-aware pre-launch
 * preferred-model substitution that was applied earlier (e.g. by the server
 * handler) before the runtime launch plan was constructed. Selection-phase
 * evidence only — not managed fallback/reselection and does not carry
 * fallback, dispatch, or runtime authority.
 */
export function writeUsageAwareModelOverrideEvidence(input: {
	rootDir: string;
	workflowId: string;
	laneId: string;
	taskId: string;
	token: string;
	originalModelId: string;
	resolvedModelId: string;
	overrideReason: "exhausted" | "critical" | "non_dispatchable" | "stale";
	allowCrossFamily: boolean;
	observedAt: string;
}): void {
	const evidenceId = `usage-aware-override-${input.laneId}-${input.token}`;
	const record: FlowDeskUsageAwareModelOverrideEvidenceV1 = {
		schema_version: "flowdesk.usage_aware_model_override.v1",
		workflow_id: input.workflowId,
		lane_id: input.laneId,
		task_id: input.taskId,
		original_model_id: input.originalModelId,
		resolved_model_id: input.resolvedModelId,
		override_reason: input.overrideReason,
		allow_cross_family: input.allowCrossFamily,
		provider_binding_changed_before_launch: true,
		model_substitution_kind: "pre_launch_preferred_model_substitution",
		managed_fallback_reselection: false,
		observed_at: input.observedAt,
		selection_phase_only: true,
		fallback_authority_enabled: false,
		dispatch_authority_enabled: false,
	};
	writeSessionEvidence({
		rootDir: input.rootDir,
		workflowId: input.workflowId,
		evidenceId,
		record: record as unknown as Record<string, unknown>,
	});
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

function writeAgentTaskChildSessionIndex(input: {
	rootDir: string;
	workflowId: string;
	laneId: string;
	taskId: string;
	childSessionId: string;
	parentSessionRef: string;
	providerQualifiedModelId: string;
	agentRef: string;
	nudgeCount: number;
	lastNudgeAt: string | null;
	nudgeQuietPeriodMs: number;
	lastActivityAt: string;
	createdAt: string;
	evidenceId: string;
}): void {
	writeSessionEvidence({
		rootDir: input.rootDir,
		workflowId: input.workflowId,
		evidenceId: input.evidenceId,
		record: {
			schema_version: AGENT_TASK_CHILD_SESSION_SCHEMA_VERSION,
			workflow_id: input.workflowId,
			lane_id: input.laneId,
			task_id: input.taskId,
			child_session_id: input.childSessionId,
			child_session_ref: input.childSessionId.length > 0 ? `ses-${input.childSessionId}` : undefined,
			parent_session_ref: input.parentSessionRef,
			provider_qualified_model_id: input.providerQualifiedModelId,
			agent_ref: input.agentRef,
			nudge_count: input.nudgeCount,
			last_nudge_at: input.lastNudgeAt,
			nudge_quiet_period_ms: input.nudgeQuietPeriodMs,
			last_activity_at: input.lastActivityAt,
			created_at: input.createdAt,
			dispatch_authority_enabled: false,
		} as unknown as Record<string, unknown>,
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

	if (input.promptText.length > FLOWDESK_TASK_DESCRIPTION_MAX_CHARS) {
		const taskFailedEvidenceId = `task-failed-${input.taskId}-${token}-limit-exceeded`;
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
				failure_category: "invalid_request",
				redacted_reason: "task_description_exceeds_limit_15000_chars",
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
			evidenceId: `lifecycle-task-terminal-${input.laneId}-${token}-limit-exceeded`,
			createdAt: observedAt,
			updatedAt: observedAt,
		});
		return { status: "task_failed", failureCategory: "invalid_request", redactedReason: "task_description_exceeds_limit_15000_chars", laneId: input.laneId };
	}

	if (isFlowDeskInvalidModelId(input.providerQualifiedModelId)) {
		writeSessionEvidence({
			rootDir: input.rootDir,
			workflowId: input.workflowId,
			evidenceId: `task-failed-${input.taskId}-${token}-invalid-model`,
			record: {
				schema_version: "flowdesk.task_failed.v1",
				workflow_id: input.workflowId,
				lane_id: input.laneId,
				task_id: input.taskId,
				agent_ref: input.agentRef,
				provider_qualified_model_id: input.providerQualifiedModelId,
				failure_category: "sdk_create_failed",
				redacted_reason: "provider_qualified_model_id_not_supported_in_current_runtime",
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
			evidenceId: `lifecycle-task-terminal-${input.laneId}-${token}-invalid-model`,
			createdAt: observedAt,
			updatedAt: observedAt,
		});
		return { status: "task_failed", failureCategory: "sdk_create_failed", redactedReason: "provider_qualified_model_id_not_supported_in_current_runtime", laneId: input.laneId };
	}

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

	// Resolve same-family fuzzy model ids before constructing the launch plan.
	// This is selection-phase-only evidence: it may choose an OpenCode-supported
	// exact binding from the supported models set, but it does not authorize
	// runtime retry, provider reselection, or managed-dispatch fallback.
	const modelBinding = resolveOpenCodeRuntimeLaunchModelBindingV1({
		providerQualifiedModelId: input.providerQualifiedModelId,
	});
	writeRuntimeLaunchModelSelectionEvidence({
		rootDir: input.rootDir,
		workflowId: input.workflowId,
		taskId: input.taskId,
		token,
		providerFamily: modelBinding.providerFamily,
		providerQualifiedModelId: modelBinding.selectedProviderQualifiedModelId ?? input.providerQualifiedModelId,
		attemptedProviderQualifiedModelIds: modelBinding.attemptedProviderQualifiedModelIds,
		selectionStatus: modelBinding.ok ? "selected" : "blocked",
		blockedLabels: modelBinding.ok ? [] : ["runtime-launch-model-binding-unavailable"],
		createdAt: observedAt,
	});
	// Selection-phase-only: when an upstream caller (e.g. the server handler)
	// applied a usage-aware pre-launch preferred-model substitution before
	// invoking this runner, persist that decision as durable evidence. Not
	// managed fallback/reselection; no dispatch/fallback authority.
	if (
		input.usageAwareOverride !== undefined &&
		input.usageAwareOverride.originalModelId !== input.providerQualifiedModelId
	) {
		writeUsageAwareModelOverrideEvidence({
			rootDir: input.rootDir,
			workflowId: input.workflowId,
			laneId: input.laneId,
			taskId: input.taskId,
			token,
			originalModelId: input.usageAwareOverride.originalModelId,
			resolvedModelId: input.providerQualifiedModelId,
			overrideReason: input.usageAwareOverride.overrideReason,
			allowCrossFamily: input.usageAwareOverride.allowCrossFamily,
			observedAt,
		});
	}
	if (!modelBinding.ok) {
		const redactedReason = modelBinding.redactedReason;
		writeSessionEvidence({
			rootDir: input.rootDir,
			workflowId: input.workflowId,
			evidenceId: `task-failed-${input.taskId}-${token}-model-binding`,
			record: {
				schema_version: "flowdesk.task_failed.v1",
				workflow_id: input.workflowId,
				lane_id: input.laneId,
				task_id: input.taskId,
				agent_ref: input.agentRef,
				provider_qualified_model_id: modelBinding.selectedProviderQualifiedModelId ?? input.providerQualifiedModelId,
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
			providerQualifiedModelId: modelBinding.selectedProviderQualifiedModelId ?? input.providerQualifiedModelId,
			state: "invocation_failed",
			evidenceId: `lifecycle-task-terminal-${input.laneId}-${token}-model-binding`,
			createdAt: observedAt,
			updatedAt: observedAt,
		});
		return { status: "task_failed", failureCategory: "sdk_create_failed", redactedReason, laneId: input.laneId };
	}
	const effectiveProviderQualifiedModelId = modelBinding.effectiveProviderQualifiedModelId;

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
			workflowId: string;
			rootDir: string;
			laneId: string;
			taskId: string;
			quietPeriodMs?: number;          // silence before heartbeat / nudge (default 10s)
			maxNudges?: number;              // max nudge attempts (default 2)
			runtimeModel?: string;           // OpenCode runtime model id for nudge prompt
			agentName?: string;              // agent name for nudge prompt
			messagesTimeoutMs?: number;      // per-call cap for session.messages (default 3000ms)
			firstTokenGraceMs?: number;      // widened silence window BEFORE first assistant token (heavy models)
			heartbeatFn?: (elapsedMs: number) => void;
			nudgeFn?: (nudgeCount: number, lastNudgeAt: string) => void;
		},
	): Promise<FlowDeskAgentTaskCaptureResultV1 | undefined> {
		const messages = client.session.messages;
		if (messages === undefined) return undefined;

		const quietPeriodMs = opts?.quietPeriodMs ?? 10_000;
		const maxNudges = opts?.maxNudges ?? 2;
		// Pre-first-token grace only widens the FIRST silence window (before any
		// assistant token). Never smaller than the normal quiet period.
		const firstTokenGraceMs = Math.max(quietPeriodMs, opts?.firstTokenGraceMs ?? quietPeriodMs);
		let firstTokenSeen = false;
		const MESSAGES_TIMEOUT_MS = opts?.messagesTimeoutMs ?? 3_000; // per-call cap — handles both snapshot and long-poll

		/**
		 * Call session.messages with a ceiling timeout so we can check inactivity periodically.
		 * This handles both snapshot APIs (return immediately) and long-poll APIs
		 * (block until LLM produces output). With the timeout, a long-poll call that
		 * hasn't returned after MESSAGES_TIMEOUT_MS resolves as null so we can
		 * check the inactivity clock and possibly send a nudge. The helper is
		 * structured-first and catches legacy `%7Bid%7D` SDK route failures so raw
		 * OpenCode stack traces do not leak into TUI output.
		 */
		const callMessages = (): Promise<unknown | null> => {
			const messagePromise = (async () => {
				const result = await probeReadOnlySdkSessionMessagesV1(client, childSessionId);
				return result.status === "ok" ? result.response : null;
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
		let hasLogged30sDiag = false;
		let hasLogged60sDiag = false;

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
					firstTokenSeen = true;
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
					return { text: observed.latestText, completionStatus: "final", outputKind: observed.outputKind, usableForSynthesis: observed.usableForSynthesis, finalizationReason: "terminal_marker", looksLikeRefusalOrError: observed.looksLikeRefusalOrError, finalBodyObserved: true, terminalMarkerObserved: true };
				}
				if (observed?.terminalObserved === true && latestCandidate?.latestText !== undefined && latestCandidate.latestText.trim().length > 0) {
					return { text: latestCandidate.latestText, completionStatus: "partial", outputKind: latestCandidate.outputKind, usableForSynthesis: false, finalizationReason: "terminal_marker", looksLikeRefusalOrError: latestCandidate.looksLikeRefusalOrError, finalBodyObserved: false, terminalMarkerObserved: true };
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
					return { text: latestCandidate.latestText, completionStatus: "final", outputKind: latestCandidate.outputKind, usableForSynthesis: latestCandidate.usableForSynthesis, finalizationReason: "stable_idle", looksLikeRefusalOrError: latestCandidate.looksLikeRefusalOrError, finalBodyObserved: true, terminalMarkerObserved: false };
				}

				const silenceMs = nowMs - lastActivityMs;
				const totalElapsedMs = nowMs - startMs;

																// Diagnostic threshold check
				const earlyLaunchThresholdMs = input._earlyLaunchDiagnosticThresholdMsForTest ?? FLOWDESK_EARLY_LAUNCH_NO_SIGNAL_THRESHOLD_MS;
			if (totalElapsedMs >= earlyLaunchThresholdMs && !firstTokenSeen && !hasLogged30sDiag) {
					hasLogged30sDiag = true;
					writeAgentTaskProgress({
						rootDir: input.rootDir,
						workflowId: input.workflowId,
						laneId: input.laneId,
						taskId: input.taskId,
						agentRef: input.agentRef,
						providerQualifiedModelId: effectiveProviderQualifiedModelId,
						phase: "waiting",
						progressSeq: 100, // Using a unique sequence for diagnostics
						progressLabel: "early_launch_diagnostic: session_may_have_failed_to_start",
						observedAt: new Date().toISOString(),
					});
					writeAgentTaskProgress({
						rootDir: input.rootDir,
						workflowId: input.workflowId,
						laneId: input.laneId,
						taskId: input.taskId,
						agentRef: input.agentRef,
						providerQualifiedModelId: effectiveProviderQualifiedModelId,
						phase: "waiting",
						progressSeq: 101, // Using a unique sequence for diagnostics
						progressLabel: "early_launch_diagnostic: no_first_signal",
						observedAt: new Date().toISOString(),
					});
				}

				// Heavy-model pre-first-token grace: while NO assistant token has
				// appeared yet, do NOT nudge. Nudging a heavy model that is still
				// producing its first token (a noReply prompt) only interferes with
				// the in-flight turn. Instead wait quietly until the first-token
				// deadline (the widened grace), emitting heartbeats so the lane still
				// looks alive, and only give up if no first token arrives in time.
				if (!firstTokenSeen && firstTokenGraceMs > quietPeriodMs) {
					const firstTokenDeadlineMs = firstTokenGraceMs * (maxNudges + 1); // e.g. 30s*3 = 90s
					if (totalElapsedMs >= firstTokenGraceMs && nowMs - lastHeartbeatMs >= firstTokenGraceMs) {
						lastHeartbeatMs = nowMs;
						opts?.heartbeatFn?.(totalElapsedMs);
					}
					if (totalElapsedMs >= firstTokenDeadlineMs) {
						// No first token within the heavy grace deadline — give up.
						return undefined;
					}
					// Keep waiting quietly for the first token.
					const yieldMs = Math.max(10, Math.min(1_000, Math.floor(quietPeriodMs / 10)));
					await new Promise<void>(resolve => setTimeout(resolve, yieldMs));
					continue;
				}

				// Normal quiet/nudge policy (light models, or after the first token).
				if (silenceMs >= quietPeriodMs) {
					// Emit heartbeat on first window expiry of each silence window
					if (nowMs - lastHeartbeatMs >= quietPeriodMs) {
						lastHeartbeatMs = nowMs;
						opts?.heartbeatFn?.(nowMs - startMs);
					}

					// Send nudge after quiet period
				if (nudgeCount < maxNudges) {
					nudgeCount++;
					await sendNudge();
					opts?.nudgeFn?.(nudgeCount, new Date().toISOString());
					// Reset activity clock after nudge — give a fresh quiet window
					lastActivityMs = Date.now();
					lastHeartbeatMs = lastActivityMs;
				} else {
					// Exhausted all nudges. Preserve usable candidate text as partial output.
					if (latestCandidate?.latestText !== undefined && latestCandidate.latestText.trim().length > 0) {
						return { text: latestCandidate.latestText, completionStatus: "partial", outputKind: latestCandidate.outputKind, usableForSynthesis: latestCandidate.usableForSynthesis, finalizationReason: "nudge_exhausted_partial", looksLikeRefusalOrError: latestCandidate.looksLikeRefusalOrError, finalBodyObserved: true, terminalMarkerObserved: false };
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

	const launchPlan = agentTaskLaunchPlan({
		workflowId: input.workflowId,
		laneId: input.laneId,
		parentSessionId: input.parentSessionId,
		agentRef: input.agentRef,
		providerQualifiedModelId: effectiveProviderQualifiedModelId,
		token,
	});

	const runningLifecycleEvidenceId = `lifecycle-task-running-${input.laneId}-${token}`;
	const promptTextTruncated = input.promptText.length > AGENT_TASK_CONTEXT_MAX_PROMPT_TEXT;
	const recordedParentProviderQualifiedModelId = normalizeProviderQualifiedModelId(
		input.parentSessionProviderQualifiedModelId,
	);
	const agentTaskContextRecord: FlowDeskAgentTaskContextV1 = {
		schema_version: "flowdesk.agent_task_context.v1",
		workflow_id: input.workflowId,
		lane_id: input.laneId,
		task_id: input.taskId,
		agent_ref: input.agentRef,
		provider_qualified_model_id: effectiveProviderQualifiedModelId,
		parent_session_ref: parentSessionRef,
		recorded_parent_provider_qualified_model_id: recordedParentProviderQualifiedModelId,
		parent_wake_provider_qualified_model_id: recordedParentProviderQualifiedModelId,
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
		providerQualifiedModelId: effectiveProviderQualifiedModelId,
		phase: "started",
		progressSeq: 1,
		progressLabel: "agent task lane launch started",
		observedAt,
	});

	// Launch the lane — wrap in absolute timeout so session.prompt blocking doesn't hang forever.
	// 30s default — if session.prompt blocks for more than 30s with no activity, give up.
	const LAUNCH_TIMEOUT_MS = input._launchTimeoutMs ?? 30_000;
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
				provider_qualified_model_id: effectiveProviderQualifiedModelId,
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
			providerQualifiedModelId: effectiveProviderQualifiedModelId,
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
		safeRecordAgentTaskHeartbeatV1({
			rootDir: input.rootDir,
			workflowId: input.workflowId,
			attemptId,
			laneId: input.laneId,
			parentSessionRef,
			agentRef: input.agentRef,
			providerQualifiedModelId: effectiveProviderQualifiedModelId,
			state: "running",
			observedAt,
			progressSummaryLabel: `agent task lane launch failed`,
		});

		// Write task_failed evidence. Distinguish a provider-side dispatch error
		// (the runtime accepted the lane create but the prompt call returned a
		// provider/runtime error, e.g. expired provider OAuth in an in-process
		// SDK server) from a generic SDK session-create failure, so diagnostics
		// and retries can tell "provider rejected dispatch" apart from "could not
		// open a child session at all". This only changes the advisory failure
		// label/reason; capture behavior and all authority flags are unchanged.
		const failureCategory =
			launchResult.status === "lane_launch_failed"
				? launchResult.redactedErrorCategory === "provider_api"
					? "provider_dispatch_error"
					: "sdk_create_failed"
				: "unknown";
		const redactedReason =
			launchResult.redactedBlockReason ??
			(launchResult.redactedErrorCategory === "provider_api"
				? "provider rejected the lane dispatch (provider_api error); the runtime created the child session but the provider returned an error before producing output"
				: launchResult.redactedErrorCategory) ??
			"lane launch did not start";
		const taskFailedEvidenceId = `task-failed-${input.taskId}-${token}`;
		const taskFailedRecord: FlowDeskTaskFailedV1 = {
			schema_version: "flowdesk.task_failed.v1",
			workflow_id: input.workflowId,
			lane_id: input.laneId,
			task_id: input.taskId,
			agent_ref: input.agentRef,
			provider_qualified_model_id: effectiveProviderQualifiedModelId,
			failure_category: failureCategory,
			redacted_reason: String(redactedReason).slice(0, 500),
			...(launchResult.redactedErrorLabel === undefined ? {} : { redacted_error_details: launchResult.redactedErrorLabel }),
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
			agentRef: input.agentRef,
			providerQualifiedModelId: effectiveProviderQualifiedModelId,
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
	safeRecordAgentTaskHeartbeatV1({
		rootDir: input.rootDir,
		workflowId: input.workflowId,
		attemptId,
		laneId: input.laneId,
		parentSessionRef,
		agentRef: input.agentRef,
		providerQualifiedModelId: effectiveProviderQualifiedModelId,
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
	const nudgeQuietPeriodMs = typeof input._nudgeQuietPeriodMs === "number" && input._nudgeQuietPeriodMs > 0
		? Math.floor(input._nudgeQuietPeriodMs)
		: 10_000;
	const childSessionEvidenceId = `agent-task-child-session-${input.laneId}-${token}`;
	if (childSessionId !== undefined) {
		writeAgentTaskChildSessionIndex({
			rootDir: input.rootDir,
			workflowId: input.workflowId,
			laneId: input.laneId,
			taskId: input.taskId,
			childSessionId,
			parentSessionRef,
			providerQualifiedModelId: effectiveProviderQualifiedModelId,
			agentRef: input.agentRef,
			nudgeCount: 0,
			lastNudgeAt: null,
			nudgeQuietPeriodMs,
			lastActivityAt: observedAt,
			createdAt: observedAt,
			evidenceId: childSessionEvidenceId,
		});
	}

	// ── Async mode: return immediately, watchdog handles polling/nudging/abort ──
	if (input.asyncMode === true) {
		const resolvedChildId = childSessionId ?? "";
		writeAgentTaskChildSessionIndex({
			rootDir: input.rootDir,
			workflowId: input.workflowId,
			laneId: input.laneId,
			taskId: input.taskId,
			childSessionId: resolvedChildId,
			parentSessionRef,
			providerQualifiedModelId: effectiveProviderQualifiedModelId,
			agentRef: input.agentRef,
			nudgeCount: 0,
			lastNudgeAt: null,
			nudgeQuietPeriodMs,
			lastActivityAt: observedAt,
			createdAt: observedAt,
			evidenceId: childSessionEvidenceId,
		});
		writeAgentTaskProgress({
			rootDir: input.rootDir,
			workflowId: input.workflowId,
			laneId: input.laneId,
			taskId: input.taskId,
			agentRef: input.agentRef,
			providerQualifiedModelId: effectiveProviderQualifiedModelId,
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
	let syncNudgeCount = 0;
	let syncLastNudgeAt: string | null = null;
	if (childSessionId !== undefined) {
		const runtimeModel = launchResult.status === "lane_launch_started" && typeof launchResult.model === "string"
			? launchResult.model : undefined;
		const agentName = launchResult.status === "lane_launch_started" && typeof launchResult.agent === "string"
			? launchResult.agent : undefined;
		// Heavy models (e.g. Claude Opus, non-fast GPT-5.x, Codex) can be slow to
		// the FIRST token on large prompts; give them a widened pre-first-token
		// grace so a genuinely-working slow start is not mis-read as no_response.
		// Light models (mini/fast/spark/flash/haiku, plus gemini pro and sonnet)
		// keep the unchanged short policy.
		const heavyFirstToken = isFlowDeskHeavyFirstTokenModelV1(effectiveProviderQualifiedModelId);
		resultObservation = await extractAssistantTextFromResponse(input.client, childSessionId, {
			workflowId: input.workflowId,
			rootDir: input.rootDir,
			laneId: input.laneId,
			taskId: input.taskId,
			quietPeriodMs: input._nudgeQuietPeriodMs ?? 10_000,  // default 10s per policy
			maxNudges: 2,
			...(heavyFirstToken ? { firstTokenGraceMs: input._heavyFirstTokenGraceMs ?? AGENT_TASK_HEAVY_FIRST_TOKEN_GRACE_MS } : {}),
			runtimeModel,
			agentName,
			messagesTimeoutMs: input._messagesTimeoutMs,
			nudgeFn: (nudgeCount, lastNudgeAt) => {
				syncNudgeCount = nudgeCount;
				syncLastNudgeAt = lastNudgeAt;
				writeAgentTaskChildSessionIndex({
					rootDir: input.rootDir,
					workflowId: input.workflowId,
					laneId: input.laneId,
					taskId: input.taskId,
					childSessionId,
					parentSessionRef,
					providerQualifiedModelId: effectiveProviderQualifiedModelId,
					agentRef: input.agentRef,
					nudgeCount: syncNudgeCount,
					lastNudgeAt: syncLastNudgeAt,
					nudgeQuietPeriodMs,
					lastActivityAt: lastNudgeAt,
					createdAt: observedAt,
					evidenceId: childSessionEvidenceId,
				});
			},
			heartbeatFn: (elapsedMs) => {
				safeRecordAgentTaskHeartbeatV1({
					rootDir: input.rootDir,
					workflowId: input.workflowId,
					attemptId,
					laneId: input.laneId,
					parentSessionRef,
					agentRef: input.agentRef,
					providerQualifiedModelId: effectiveProviderQualifiedModelId,
					state: "running",
					observedAt: new Date().toISOString(),
					progressSummaryLabel: `agent task waiting for response elapsed=${Math.floor(elapsedMs / 1000)}s`,
				});
			},
		});
		writeAgentTaskChildSessionIndex({
			rootDir: input.rootDir,
			workflowId: input.workflowId,
			laneId: input.laneId,
			taskId: input.taskId,
			childSessionId,
			parentSessionRef,
			providerQualifiedModelId: effectiveProviderQualifiedModelId,
			agentRef: input.agentRef,
			nudgeCount: syncNudgeCount,
			lastNudgeAt: syncLastNudgeAt,
			nudgeQuietPeriodMs,
			lastActivityAt: syncLastNudgeAt ?? new Date().toISOString(),
			createdAt: observedAt,
			evidenceId: childSessionEvidenceId,
		});
	}

	const resultText = resultObservation?.text;
	if (resultText === undefined) {
		if (childSessionId !== undefined) {
			writeAgentTaskProgress({
				rootDir: input.rootDir,
				workflowId: input.workflowId,
				laneId: input.laneId,
				taskId: input.taskId,
				agentRef: input.agentRef,
				providerQualifiedModelId: effectiveProviderQualifiedModelId,
				phase: "waiting",
				progressSeq: 3,
				progressLabel:
					"agent task still awaiting child output after bounded sync capture; watchdog/status may backfill result",
			});
			refreshFlowDeskCompletionUiCachesV1({
				rootDir: input.rootDir,
				workflowId: input.workflowId,
				observedAt: new Date().toISOString(),
			});
			return {
				status: "task_launched",
				laneId: input.laneId,
				childSessionId,
			};
		}
		// No response text - write task_failed
		const taskFailedEvidenceId = `task-failed-${input.taskId}-${token}`;
		const failureCategory = "no_response";
		const evidenceFailureCategory = "no_response";
		const redactedReason = "lane launched but no assistant response text found";
		const noOutputCaptureMetadata = buildFlowDeskCaptureSafetyMetadataV1({
			text: undefined,
			outputKind: "empty",
			finalBodyObserved: false,
			terminalMarkerObserved: false,
		});
		const taskFailedRecord: FlowDeskTaskFailedV1 = {
			schema_version: "flowdesk.task_failed.v1",
			workflow_id: input.workflowId,
			lane_id: input.laneId,
			task_id: input.taskId,
			agent_ref: input.agentRef,
			provider_qualified_model_id: effectiveProviderQualifiedModelId,
			failure_category: evidenceFailureCategory,
			redacted_reason: redactedReason,
			...noOutputCaptureMetadata,
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
			providerQualifiedModelId: effectiveProviderQualifiedModelId,
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
			providerQualifiedModelId: effectiveProviderQualifiedModelId,
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
	const captureSafetyMetadata = buildFlowDeskCaptureSafetyMetadataV1({
		text: storedResultText,
		completionStatus: resultObservation?.completionStatus ?? "final",
		outputKind: resultObservation?.outputKind ?? "final_answer",
		finalizationReason: resultObservation?.finalizationReason,
		finalBodyObserved: resultObservation?.finalBodyObserved ?? true,
		terminalMarkerObserved: resultObservation?.terminalMarkerObserved,
	});

	// Write task_result evidence
	const taskResultEvidenceId = `task-result-${input.taskId}-${token}`;
	const resolvedOutputKind = resultObservation?.outputKind as FlowDeskTaskResultV1["output_kind"] ?? "final_answer";
	// Enforcement invariant (evidence boundary): process_notes output can NEVER be
	// usable_for_synthesis=true or safe_for_auto_synthesis=true in the persisted
	// task_result evidence record. This clamp is applied after all upstream
	// calculations to guarantee the invariant even if capture metadata is
	// reconstructed from a path that did not apply the outputKind guard.
	const processNotesOutputKind =
		resolvedOutputKind === "process_notes" ||
		resolvedOutputKind === "tool_trace_only" ||
		resolvedOutputKind === "empty";
	const taskResultRecord: FlowDeskTaskResultV1 = {
		schema_version: "flowdesk.task_result.v1",
		workflow_id: input.workflowId,
		lane_id: input.laneId,
		task_id: input.taskId,
		agent_ref: input.agentRef,
		provider_qualified_model_id: effectiveProviderQualifiedModelId,
		task_prompt_sha256: promptSha256,
		result_text: storedResultText,
		result_text_truncated: sanitizedResult.truncated,
		result_text_sha256: resultSha256,
		completion_status: resultObservation?.completionStatus ?? "final",
		output_kind: resolvedOutputKind,
		usable_for_synthesis: processNotesOutputKind ? false : captureSafetyMetadata.safe_for_auto_synthesis,
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
		...captureSafetyMetadata,
		// Re-enforce synthesis safety flags after spread: the spread must not
		// silently override the process_notes enforcement clamp above.
		...(processNotesOutputKind ? { usable_for_synthesis: false, safe_for_auto_synthesis: false } : {}),
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
					provider_qualified_model_id: effectiveProviderQualifiedModelId,
					failure_category: "unknown",
					redacted_reason: redactedReason,
					...captureSafetyMetadata,
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
				providerQualifiedModelId: effectiveProviderQualifiedModelId,
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
				providerQualifiedModelId: effectiveProviderQualifiedModelId,
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
		providerQualifiedModelId: effectiveProviderQualifiedModelId,
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
		providerQualifiedModelId: effectiveProviderQualifiedModelId,
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

	// ── OI session summary write (advisory-only, non-blocking) ───────────────
	// Write AFTER task_result is confirmed written. Failures here must NEVER
	// affect the task_completed return value or the task_result evidence.
	const oiEnabled = input.oiEnabled !== false; // default true
	const oiAccumulator = input._oiAccumulator ?? createOISessionAccumulator();
	try {
		const oiCapturedAt = new Date().toISOString();
		const oiSummaryId = `oi-summary-${input.taskId}-${token}`;
		const oiSessionRef = parentSessionRef;
		const oiResult = oiAccumulator.toSummary({
			summaryId: oiSummaryId,
			sessionRef: oiSessionRef,
			workflowId: input.workflowId,
			capturedAt: oiCapturedAt,
			oiEnabled,
		});
		if (oiResult.ok && oiResult.summary !== undefined) {
			writeSessionEvidence({
				rootDir: input.rootDir,
				workflowId: input.workflowId,
				evidenceId: oiSummaryId,
				record: oiResult.summary as unknown as Record<string, unknown>,
			});
		}
	} catch {
		// OI summary write failure must not propagate — task_result stands.
	}

	return {
		status: "task_completed",
		resultText: fullResultText,
		laneId: input.laneId,
		taskResultEvidenceId,
	};
}

/**
 * Abort a running dev/beta agent task lane through the canonical typed session
 * abort control adapter, then write terminal task_failed + lane_lifecycle
 * evidence for the task. The command-backed /flowdesk-abort diagnostic path is
 * intentionally separate and non-runtime.
 *
 * Returns:
 *   "aborted"      — SDK abort was attempted and terminal evidence was written.
 *   "abort_skipped" — client.session.abort is unavailable; evidence still written.
 *   "abort_failed"  — unexpected error; evidence still written where possible.
 */
export async function abortFlowDeskAgentTaskV1(input: {
	rootDir: string;
	workflowId: string;
	taskId: string;
	reason: string;
	client: FlowDeskManagedDispatchBetaOpenCodeClientV1;
	now?: Date;
}): Promise<{ status: "aborted" | "abort_skipped" | "abort_failed" | "task_not_found"; redactedReason?: string }> {
	const now = input.now ?? new Date();
	const observedAt = now.toISOString();
	const redactedReason = input.reason.slice(0, 500);

	// 1. Reload evidence to find laneId, childSessionId, agentRef, providerQualifiedModelId, attemptId
	const reload = reloadFlowDeskSessionEvidenceV1({ rootDir: input.rootDir, workflowId: input.workflowId });
	if (!reload.ok) return { status: "task_not_found", redactedReason: "evidence reload failed" };

	// Find child-session record for this taskId
	const getString = (record: Record<string, unknown>, key: string): string | undefined => {
		const value = record[key];
		return typeof value === "string" && value.length > 0 ? value : undefined;
	};
	const childSessionEntry = reload.entries
		.filter((e) => e.evidenceClass === "agent_task_child_session")
		.find((e) => getString(e.record, "task_id") === input.taskId);

	if (childSessionEntry === undefined) return { status: "task_not_found", redactedReason: `no child session found for taskId ${input.taskId}` };

	const laneId = getString(childSessionEntry.record, "lane_id") ?? input.taskId;
	const childSessionId = getString(childSessionEntry.record, "child_session_id") ?? "";
	const agentRef = getString(childSessionEntry.record, "agent_ref") ?? "agent-unknown";
	const providerQualifiedModelId = getString(childSessionEntry.record, "provider_qualified_model_id") ?? "unknown/unknown";
	// Find attemptId from lane_lifecycle or fall back to generated
	const lifecycleEntry = reload.entries.find((e) => e.evidenceClass === "lane_lifecycle" && getString(e.record, "lane_id") === laneId);
	const attemptId = getString(lifecycleEntry?.record ?? {}, "attempt_id") ?? `attempt-abort-${createHash("sha256").update(laneId).digest("hex").slice(0, 8)}`;

	const token = createHash("sha256").update(`abort-${laneId}-${observedAt}`).digest("hex").slice(0, 12);

	let sdkAbortStatus: "aborted" | "abort_skipped" | "abort_failed" = "aborted";

	// 2. Attempt SDK abort through the canonical typed session abort adapter — best-effort, must not throw.
	if (childSessionId.length === 0) {
		sdkAbortStatus = "abort_skipped";
	} else {
		const abortDecision: FlowDeskSessionAbortDecisionV1 = {
			schema_version: "flowdesk.session_abort_decision.v1",
			decision_id: `session-abort-decision-${token}`,
			workflow_id: input.workflowId,
			attempt_id: attemptId,
			session_ref: childSessionId,
			abort_reason: "user_requested_abort",
			policy_pack_ref: `policy-pack-abort-${token}`,
			guard_decision_ref: `guard-decision-abort-${token}`,
			pre_abort_audit_ref: `pre-abort-audit-${token}`,
			created_at: observedAt,
			dispatch_authority_enabled: false,
			providerCall: false,
			actualLaneLaunch: false,
			runtimeExecution: false,
			hardCancelOrNoReplyAuthority: false,
			session_abort_authorized: true,
		};
		try {
			const adapterResult = await abortFlowDeskSessionWithDecisionV1({
				client: input.client,
				decision: abortDecision,
			});
			if (adapterResult.status !== "session_abort_sent") sdkAbortStatus = "abort_skipped";
		} catch {
			sdkAbortStatus = "abort_failed";
		}
	}

	// 3. Write task_failed evidence
	const taskFailedEvidenceId = `task-failed-${input.taskId}-abort-${token}`;
	writeSessionEvidence({
		rootDir: input.rootDir,
		workflowId: input.workflowId,
		evidenceId: taskFailedEvidenceId,
		record: {
			schema_version: "flowdesk.task_failed.v1",
			workflow_id: input.workflowId,
			lane_id: laneId,
			task_id: input.taskId,
			agent_ref: agentRef,
			provider_qualified_model_id: providerQualifiedModelId,
			failure_category: "unknown",
			redacted_reason: `coordinator_abort: ${redactedReason}`,
			created_at: observedAt,
			dispatch_authority_enabled: false,
		} satisfies FlowDeskTaskFailedV1,
	});

	// 4. Write terminal lane_lifecycle evidence
	writeAgentTaskTerminalLifecycle({
		rootDir: input.rootDir,
		workflowId: input.workflowId,
		laneId,
		attemptId,
		parentSessionRef: childSessionId.length > 0 ? `ses-${childSessionId}` : `ses-unattached-abort-${token}`,
		childSessionRef: childSessionId.length > 0 ? `ses-${childSessionId}` : undefined,
		agentRef,
		providerQualifiedModelId,
		state: "invocation_failed",
		evidenceId: `lifecycle-abort-${laneId}-${token}`,
		createdAt: observedAt,
		updatedAt: observedAt,
	});

	// 5. Refresh sidebar cache
	refreshFlowDeskCompletionUiCachesV1({
		rootDir: input.rootDir,
		workflowId: input.workflowId,
		observedAt,
	});

	return sdkAbortStatus === "aborted"
		? { status: "aborted" }
		: { status: sdkAbortStatus, redactedReason };
}
