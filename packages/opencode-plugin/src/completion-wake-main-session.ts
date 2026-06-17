import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";

// ---------------------------------------------------------------------------
// Wake notice inbox schema (additive, Phase 1)
// ---------------------------------------------------------------------------
//
// `WakeNoticeInboxEntry` is the canonical durable record for a single wake
// notification.  It is intentionally additive over the pre-existing `WakeRow`
// schema:
//
//   - `consumed` (legacy) – kept for backward compat; means "prompt dispatch
//     was attempted", NOT that the user saw/acknowledged the notice.
//   - `user_acknowledged` (new) – explicit user-side acknowledgement; set only
//     when the user acts via a future explicit flow (not by SDK prompt alone).
//   - `prompt_attempt_count` (new) – incremented each time a prompt dispatch is
//     attempted.  A resolved prompt increments this counter but does NOT flip
//     `user_acknowledged`.
//
// The inbox file (`main-session-wake-notifications.json`) is always merged, never
// overwritten entirely.  Each new notice is added by `notice_id`; the file
// retains up to WAKE_NOTICE_INBOX_MAX_ENTRIES entries sorted newest-first.
// ---------------------------------------------------------------------------

export interface WakeNoticeInboxEntry {
	/** Stable unique id for this notice; derived from consumptionKey. */
	notice_id: string;
	/** ISO timestamp when the notice was first created. */
	created_at: string;
	/** workflowId that triggered the notice. */
	workflowId: string;
	/** Completion kind (mirrors WakeRow.completionKind). */
	completionKind: "task_result" | "task_failed" | "auto_next_ready" | "awaiting_permission" | "diagnostic_attention";
	/** Human-readable label (bounded, redacted). */
	notificationLabel: string;
	/**
	 * Legacy compat: true when a prompt dispatch attempt resolved (not when user
	 * saw/acknowledged the notice).  DO NOT reinterpret as user acknowledgement.
	 * @deprecated Use `prompt_attempt_count` and `user_acknowledged` instead.
	 */
	consumed: boolean;
	/** ISO timestamp of the last prompt dispatch attempt, if any. */
	consumedAt?: string;
	/** Number of times a prompt dispatch was attempted for this notice. */
	prompt_attempt_count: number;
	/**
	 * Explicit user acknowledgement.  Only set when the user explicitly interacts
	 * with this notice via a future acknowledged-action flow.  A prompt resolve
	 * DOES NOT set this field.
	 */
	user_acknowledged: boolean;
}

const WAKE_NOTICE_INBOX_MAX_ENTRIES = 20;

/**
 * Merge a new WakeNoticeInboxEntry into the existing inbox array.
 *
 * Invariants:
 *   1. Each notice_id appears at most once.  A second entry with the same
 *      notice_id merges prompt_attempt_count and preserves user_acknowledged.
 *   2. The inbox is capped at WAKE_NOTICE_INBOX_MAX_ENTRIES entries newest-first.
 *   3. This function never mutates its inputs.
 */
function mergeWakeNoticeInbox(
	existing: WakeNoticeInboxEntry[],
	incoming: WakeNoticeInboxEntry,
): WakeNoticeInboxEntry[] {
	const byId = new Map<string, WakeNoticeInboxEntry>(existing.map((entry) => [entry.notice_id, entry]));
	const previous = byId.get(incoming.notice_id);
 if (previous !== undefined) {
		byId.set(incoming.notice_id, {
			...previous,
			// Merge prompt attempt count additively so each dispatch attempt is
			// preserved on the durable notice record.
			prompt_attempt_count: previous.prompt_attempt_count + incoming.prompt_attempt_count,
			// Only update consumed/consumedAt if the new entry has a newer attempt.
			consumed: previous.consumed || incoming.consumed,
			...(incoming.consumedAt !== undefined ? { consumedAt: incoming.consumedAt } : {}),
			// user_acknowledged is monotonic: once true, stays true.
			user_acknowledged: previous.user_acknowledged || incoming.user_acknowledged,
		});
	} else {
		byId.set(incoming.notice_id, incoming);
	}
	// Sort newest-first by created_at, cap to max.
	return [...byId.values()]
		.sort((a, b) => Date.parse(b.created_at) - Date.parse(a.created_at))
		.slice(0, WAKE_NOTICE_INBOX_MAX_ENTRIES);
}

/**
 * Read the current inbox from disk.  Returns an empty array on any error.
 * Read-only: never mutates any file.
 */
function readWakeNoticeInbox(inboxPath: string): WakeNoticeInboxEntry[] {
	try {
		if (!existsSync(inboxPath)) return [];
		const parsed = JSON.parse(readFileSync(inboxPath, "utf8")) as unknown;
		if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) return [];
		const record = parsed as Record<string, unknown>;
		if (record.schema_version !== "flowdesk.main_session_wake_notifications.v1") return [];
		if (!Array.isArray(record.notices)) return [];
		return record.notices
			.filter((entry): entry is WakeNoticeInboxEntry => {
				if (typeof entry !== "object" || entry === null || Array.isArray(entry)) return false;
				const e = entry as Record<string, unknown>;
				return typeof e.notice_id === "string" && e.notice_id.length > 0
					&& typeof e.created_at === "string"
					&& typeof e.workflowId === "string";
			})
			.slice(0, WAKE_NOTICE_INBOX_MAX_ENTRIES);
	} catch {
		return [];
	}
}

type CompletionKind = "task_result" | "task_failed" | "auto_next_ready" | "awaiting_permission" | "diagnostic_attention";

export interface FlowDeskCompletionWakeMainSessionConfigV1 {
	enabled: true;
	rootDir: string;
	agentName: string;
	providerQualifiedModelId: string;
	directory?: string;
	/** Live main-session delivery address captured from OpenCode ctx.sessionID. */
	parentSessionRef?: string;
}

export interface FlowDeskCompletionWakeMainSessionResultV1 {
	status: "main_session_wake_completed" | "main_session_wake_skipped";
	wakeAttempted: number;
	wakeSucceeded: number;
	retryScheduled: number;
	skippedReason?: string;
}

interface WakeRow {
	workflowId: string;
	parentSessionRef?: string;
	completionKind: CompletionKind;
	readyAt: string;
	dedupeKey: string;
	consumptionKey: string;
	consumed?: boolean;
	consumedAt?: string;
	retryCount?: number;
	noReply?: boolean;
	taskSummaries: readonly string[];
	notificationLabel: string;
	/** Task ids covered by this wake row (task-unit rows have exactly one). */
	taskIds?: readonly string[];
	/** Parent/main-session model snapshot; preferred over config fallback. */
	parentWakeProviderQualifiedModelId?: string;
}

interface PromptClient {
		session?: {
		prompt?(options: unknown): unknown;
		promptAsync?(options: unknown): unknown;
		status?(...args: unknown[]): unknown;
		messages?(options: unknown): unknown;
	};
}

type PromptDispatch = (options: unknown) => unknown;

const maxWakeRetriesPerConsumptionKey = 10;
const LOCK_STALE_TTL_MS = 60_000;
const WAKE_ROW_MAX_AGE_MS = 300_000;
const DEFAULT_PROVIDER_QUALIFIED_MODEL_ID = "openai/gpt-5.5";
const WAKE_DIAG_ENABLED = process.env.FLOWDESK_WAKE_DIAG === "1" || process.env.FLOWDESK_WAKE_DIAG === "true";

function wakeDiagnosticLogPath(filename: string): string {
	return join(homedir(), ".flowdesk", filename);
}

function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === "object" && value !== null && !Array.isArray(value);
}

function stringField(record: Record<string, unknown>, key: string): string | undefined {
	const value = record[key];
	return typeof value === "string" && value.trim().length > 0 ? value : undefined;
}

function writeWakeConsumerLockAcquiredAt(lockDir: string, now: Date): void {
	writeFileSync(join(lockDir, "acquired_at.json"), `${JSON.stringify({ acquired_at: now.toISOString() }, null, 2)}\n`, "utf8");
}

function existingWakeConsumerLockIsStale(lockDir: string, now: Date): boolean {
	try {
		const parsed = JSON.parse(readFileSync(join(lockDir, "acquired_at.json"), "utf8")) as unknown;
		if (!isRecord(parsed)) return true;
		const acquiredAt = stringField(parsed, "acquired_at");
		if (acquiredAt === undefined) return true;
		const acquiredAtMs = Date.parse(acquiredAt);
		return !Number.isFinite(acquiredAtMs) || now.getTime() - acquiredAtMs > LOCK_STALE_TTL_MS;
	} catch {
		return true;
	}
}

function tryCreateWakeConsumerLock(lockDir: string, now: Date): boolean {
	try {
		mkdirSync(lockDir);
	} catch {
		return false;
	}
	try {
		writeWakeConsumerLockAcquiredAt(lockDir, now);
		return true;
	} catch {
		rmSync(lockDir, { recursive: true, force: true });
		return false;
	}
}

function acquireWakeConsumerLock(lockDir: string, now: Date): boolean {
	if (tryCreateWakeConsumerLock(lockDir, now)) return true;
	if (!existingWakeConsumerLockIsStale(lockDir, now)) return false;
	try {
		rmSync(lockDir, { recursive: true, force: true });
	} catch {
		return false;
	}
	return tryCreateWakeConsumerLock(lockDir, now);
}

function numericField(record: Record<string, unknown>, key: string): number | undefined {
	const value = record[key];
	return typeof value === "number" && Number.isFinite(value) && value >= 0 ? Math.floor(value) : undefined;
}

function parentSessionIdFromRef(ref: string | undefined): string | undefined {
	if (ref === undefined) return undefined;
	let value = ref.trim();
	// Strip all leading ses- prefixes (handles legacy ses-ses_... and corrected ses-...)
	while (/^ses-/i.test(value) && value.length > 4) value = value.slice(4);
	// Accept both ses_... (OpenCode session id format) and plain alphanumeric ids
	return /^[A-Za-z0-9]/.test(value) && value.length >= 8 ? value : undefined;
}


function parseModelParts(providerQualifiedModelId: string | undefined): { providerID: string; modelID: string } | undefined {
	if (providerQualifiedModelId === undefined) return undefined;
	const [providerID, ...rest] = providerQualifiedModelId.trim().split("/");
	const modelID = rest.join("/");
	if (providerID.length === 0 || modelID.length === 0) return undefined;
	return { providerID, modelID };
}

function providerQualifiedModelIdFromModelRecord(value: unknown): string | undefined {
	if (!isRecord(value)) return undefined;
	const providerID = stringField(value, "providerID");
	const modelID = stringField(value, "modelID");
	return providerID !== undefined && modelID !== undefined ? `${providerID}/${modelID}` : undefined;
}

/**
 * Probe the live OpenCode session for the most recent message's model binding.
 * Returns a `provider/model` string or `undefined` when no usable live model is
 * available. Failures are intentionally silent so callers can fall back to the
 * recorded row model and then configured model without log spam.
 */
async function probeLiveSessionModelFromMessages(
	client: PromptClient | undefined,
	sessionId: string,
): Promise<string | undefined> {
	if (client?.session?.messages === undefined) return undefined;
	try {
		const response = await client.session.messages.call(client.session, { path: { id: sessionId } });
		const messageList = Array.isArray(response)
			? response
			: isRecord(response) && Array.isArray(response.data)
				? response.data
				: [];

		for (let i = messageList.length - 1; i >= 0; i -= 1) {
			const message = messageList[i];
			if (!isRecord(message)) continue;

			const info = message.info;
			if (isRecord(info)) {
				const nestedInfoModel = providerQualifiedModelIdFromModelRecord(info.model);
				if (nestedInfoModel !== undefined) return nestedInfoModel;

				const flatInfoModel = providerQualifiedModelIdFromModelRecord(info);
				if (flatInfoModel !== undefined) return flatInfoModel;
			}

			const directMessageModel = providerQualifiedModelIdFromModelRecord(message.model);
			if (directMessageModel !== undefined) return directMessageModel;
		}
	} catch {
		// Read-only probe failed (session gone, permission denied, SDK shape drift, etc.).
	}
	return undefined;
}

/**
 * Resolve the provider/model parts to attach to the wake prompt body.
 *
 * Precedence (highest first):
 *   1. Live `session.messages()` model probe — the current session binding.
 *   2. `parentWakeProviderQualifiedModelId` from the wake row — the parent
 *      session's model snapshot recorded by agent-task-runner at task launch.
 *   3. `configProviderQualifiedModelId` — the configured fallback resolved
 *      from `plugin.options.model` or the `completionWakeMainSession`
 *      sub-option.
 *   4. Unspecified — all candidates were missing or unparseable. In that
 *      case no `model` field is attached to the prompt body and OpenCode
 *      uses its own routing default (`DEFAULT_PROVIDER_QUALIFIED_MODEL_ID`
 *      remains the documented baseline for tests).
 *
 * Returns `undefined` when no candidate parses; callers omit the
 * `model` body field in that case.
 */
function resolveWakeModelParts(input: {
	sessionProviderQualifiedModelId?: string;
	parentWakeProviderQualifiedModelId?: string;
	configProviderQualifiedModelId?: string;
}): { providerID: string; modelID: string } | undefined {
	return parseModelParts(input.sessionProviderQualifiedModelId)
		?? parseModelParts(input.parentWakeProviderQualifiedModelId)
		?? parseModelParts(input.configProviderQualifiedModelId);
}

// Re-export DEFAULT for diagnostic/documentation purposes; the default is
// NOT silently injected into the prompt body — see resolveWakeModelParts.
void DEFAULT_PROVIDER_QUALIFIED_MODEL_ID;

function statusIndicatesActive(value: unknown): boolean {
	if (typeof value === "string") return /^(active|busy|running|working|retry|retrying)$/i.test(value.trim());
	if (!isRecord(value)) return false;
	const status = stringField(value, "status") ?? stringField(value, "state") ?? stringField(value, "type");
	if (status !== undefined && statusIndicatesActive(status)) return true;
	const nestedStatus = value.status;
	return nestedStatus !== value && statusIndicatesActive(nestedStatus);
}

async function mainSessionIsActive(input: {
	session: NonNullable<PromptClient["session"]>;
	sessionId: string;
	directory?: string;
}): Promise<boolean> {
	if (input.session.status === undefined) return true;
	const query = input.directory === undefined ? undefined : { directory: input.directory };
	try {
		const value = await input.session.status.call(input.session, {
			path: { id: input.sessionId },
			...(query === undefined ? {} : { query }),
		});
		return statusIndicatesActive(value);
	} catch {
		try {
			const value = await input.session.status.call(input.session, {
				sessionID: input.sessionId,
				...(query === undefined ? {} : { query }),
			});
			return statusIndicatesActive(value);
		} catch {
			return false;
		}
	}
}

function noReplyForWakeRow(row: { completionKind: CompletionKind; noReply?: boolean }): boolean {
	if (typeof row.noReply === "boolean") return row.noReply;
	return row.completionKind === "diagnostic_attention";
}

// DIAGNOSTIC: capture dispatch call shape + return value to a file so we can see
// exactly what the OpenCode SDK returns for the wake prompt call. This tells us
// whether the platform accepted/rendered the prompt or silently ignored it.
function logDispatchDiagnostic(input: { callShape: "primary_path" | "fallback_flat"; outcome: "resolved" | "rejected"; value?: unknown }): void {
	if (!WAKE_DIAG_ENABLED) return;
	try {
		const fs = require("node:fs") as typeof import("node:fs");
		const line = `${new Date().toISOString()} ${input.callShape} ${input.outcome} ${JSON.stringify(input.value)?.slice(0, 800)}\n`;
		fs.appendFileSync(wakeDiagnosticLogPath("wake-dispatch-diag.log"), line, "utf8");
	} catch { /* best-effort */ }
}

function rowsFromCache(value: unknown): WakeRow[] {
	if (!isRecord(value) || value.schema_version !== "flowdesk.completion_wake_ready_cache.v1") return [];
	if (!Array.isArray(value.rows)) return [];
	const rows: WakeRow[] = [];
	for (const raw of value.rows) {
		if (!isRecord(raw)) continue;
		const workflowId = stringField(raw, "workflowId");
		const readyAt = stringField(raw, "readyAt");
		const dedupeKey = stringField(raw, "dedupeKey");
		const consumptionKey = stringField(raw, "consumptionKey");
		const completionKind = stringField(raw, "completionKind");
		if (workflowId === undefined || readyAt === undefined || dedupeKey === undefined || consumptionKey === undefined) continue;
			if (completionKind !== "task_result" && completionKind !== "task_failed" && completionKind !== "auto_next_ready" && completionKind !== "awaiting_permission" && completionKind !== "diagnostic_attention") continue;
		const wakeModel = stringField(raw, "parentWakeProviderQualifiedModelId");
		rows.push({
			workflowId,
			...(stringField(raw, "parentSessionRef") === undefined ? {} : { parentSessionRef: stringField(raw, "parentSessionRef") }),
			completionKind,
			readyAt,
			dedupeKey,
			consumptionKey,
			consumed: raw.consumed === true,
			...(stringField(raw, "consumedAt") === undefined ? {} : { consumedAt: stringField(raw, "consumedAt") }),
			...(numericField(raw, "retryCount") === undefined ? {} : { retryCount: numericField(raw, "retryCount") }),
			...(typeof raw.noReply === "boolean" ? { noReply: raw.noReply } : {}),
			taskSummaries: Array.isArray(raw.taskSummaries) ? raw.taskSummaries.filter((entry): entry is string => typeof entry === "string" && entry.trim().length > 0).map((entry) => entry.trim().slice(0, 20)).slice(0, 3) : [],
			notificationLabel: stringField(raw, "notificationLabel")?.slice(0, 80) ?? "FlowDesk task completed",
			...(Array.isArray(raw.taskIds) ? { taskIds: raw.taskIds.filter((entry): entry is string => typeof entry === "string" && entry.trim().length > 0).slice(0, 8) } : {}),
			...(wakeModel !== undefined && wakeModel.includes("/") ? { parentWakeProviderQualifiedModelId: wakeModel } : {}),
		});
	}
	return rows;
}

function wakePrompt(row: WakeRow): string {
	const kind = row.completionKind;
	const tag = kind === "awaiting_permission" ? "permission" : kind === "diagnostic_attention" ? "attention" : kind === "task_failed" ? "failed" : "done";
	// For task-unit rows (single taskId), include the task id so the user
	// immediately knows which task completed/failed without checking status.
	const taskSuffix = row.taskIds !== undefined && row.taskIds.length === 1
		? ` task:${row.taskIds[0]}`
		: row.taskIds !== undefined && row.taskIds.length > 1
			? ` tasks:${row.taskIds.slice(0, 3).join(",")}`
			: "";
	return `[FlowDesk:${tag}] ${row.workflowId}${taskSuffix}. Check /flowdesk-status.`;
}

async function dispatchParentWakePrompt(input: {
	dispatch: PromptDispatch;
	session: NonNullable<PromptClient["session"]>;
	sessionId: string;
	directory?: string;
	text: string;
	noReply: boolean;
	model?: { providerID: string; modelID: string };
}): Promise<boolean> {
	const query = input.directory === undefined ? undefined : { directory: input.directory };
	const body = {
		// noReply 필드를 완전히 제거: 일부 플랫폼 구현에서 noReply가 존재하면
		// 메시지를 "조용한 신호"로 간주하여 채팅창에 렌더링하지 않고 삼키는 문제가 있음.
		// 이를 제거하여 일반 사용자 메시지처럼 무조건 화면에 표시되도록 강제함.
		parts: [{ type: "text", text: input.text.slice(0, 1_000) }],
		...(input.model === undefined ? {} : { model: { providerID: input.model.providerID, modelID: input.model.modelID } }),
	};
	void input.noReply;
	try {
		const value = await input.dispatch.call(input.session, {
			path: { id: input.sessionId },
			...(query === undefined ? {} : { query }),
			body,
		});
		logDispatchDiagnostic({ callShape: "primary_path", outcome: "resolved", value });
		return true;
	} catch {
		logDispatchDiagnostic({ callShape: "primary_path", outcome: "rejected" });
		try {
			const value = await input.dispatch.call(input.session, {
				sessionID: input.sessionId,
				...(query === undefined ? {} : { query }),
				body,
			});
			logDispatchDiagnostic({ callShape: "fallback_flat", outcome: "resolved", value });
			return true;
		} catch {
			logDispatchDiagnostic({ callShape: "fallback_flat", outcome: "rejected" });
			return false;
		}
	}
}

export async function consumeFlowDeskCompletionWakeForMainSessionV1(input: {
	config: FlowDeskCompletionWakeMainSessionConfigV1;
	client: PromptClient | undefined;
	now?: Date;
}): Promise<FlowDeskCompletionWakeMainSessionResultV1> {
	if (input.client?.session === undefined) return { status: "main_session_wake_skipped", wakeAttempted: 0, wakeSucceeded: 0, retryScheduled: 0, skippedReason: "opencode_sdk_client_unavailable" };
	const dispatch = input.client.session.promptAsync ?? input.client.session.prompt;
	if (dispatch === undefined) return { status: "main_session_wake_skipped", wakeAttempted: 0, wakeSucceeded: 0, retryScheduled: 0, skippedReason: "session_prompt_unavailable" };
	const uiDir = join(input.config.rootDir, ".flowdesk", "ui");
	const readyPath = join(uiDir, "completion-wake-ready.json");
	if (!existsSync(readyPath)) return { status: "main_session_wake_skipped", wakeAttempted: 0, wakeSucceeded: 0, retryScheduled: 0, skippedReason: "wake_ready_cache_missing" };
	mkdirSync(uiDir, { recursive: true });
	const lockDir = join(uiDir, "completion-wake-consumer.lock");
	const now = input.now ?? new Date();
	if (!acquireWakeConsumerLock(lockDir, now)) {
		return { status: "main_session_wake_skipped", wakeAttempted: 0, wakeSucceeded: 0, retryScheduled: 0, skippedReason: "wake_consumer_lock_active" };
	}
	try {
	const parsed = JSON.parse(readFileSync(readyPath, "utf8")) as unknown;
	const allRows = rowsFromCache(parsed);
	// Global cooldown: if any row was consumed within the last 10 seconds, skip
	// this cycle entirely to prevent burst flooding when many events fire close together.
	const WAKE_COOLDOWN_MS = 10_000;
	const nowMs = now.getTime();
	const recentlyConsumed = allRows.some((row) => {
		if (row.consumed !== true) return false;
		const consumedAt = typeof (row as unknown as Record<string, unknown>).consumedAt === "string" ? Date.parse(String((row as unknown as Record<string, unknown>).consumedAt)) : 0;
		return Number.isFinite(consumedAt) && nowMs - consumedAt < WAKE_COOLDOWN_MS;
	});
	const diag = (msg: string) => { if (!WAKE_DIAG_ENABLED) return; try { (require("node:fs") as typeof import("node:fs")).appendFileSync(wakeDiagnosticLogPath("wake-step-diag.log"), `${new Date().toISOString()} ${msg}\n`, "utf8"); } catch {} };
	if (recentlyConsumed) { diag("SKIP cooldown_active"); return { status: "main_session_wake_skipped", wakeAttempted: 0, wakeSucceeded: 0, retryScheduled: 0, skippedReason: "wake_cooldown_active" }; }
	// Strict cap: dispatch at most 1 wake prompt per consume cycle to prevent
	// context flooding when many workflows complete in a burst. The remaining
	// unconsumed rows survive in the cache and will be retried on the next cycle.
	const rows = allRows
		.map((row) => {
			// Preserve the wake row's origin session whenever it exists. The live/config
			// parentSessionRef is only a fallback for legacy/cache rows with no origin.
			if (row.parentSessionRef !== undefined && row.parentSessionRef.trim().length > 0) return row;
			return input.config.parentSessionRef !== undefined ? { ...row, parentSessionRef: input.config.parentSessionRef } : row;
		})
		.filter((row) => row.consumed !== true && parentSessionIdFromRef(row.parentSessionRef) !== undefined)
		.filter((row) => {
			const readyAtMs = Date.parse(row.readyAt);
			return Number.isFinite(readyAtMs) && nowMs - readyAtMs <= WAKE_ROW_MAX_AGE_MS;
		})
		// Oldest-first delivery keeps earlier success notices from being starved by
		// newer failures and preserves queue order across cycles.
		.sort((left, right) => Date.parse(left.readyAt) - Date.parse(right.readyAt))
		.slice(0, 1);
	if (rows.length === 0) { diag("SKIP no_unconsumed_parent_scoped_rows"); return { status: "main_session_wake_skipped", wakeAttempted: 0, wakeSucceeded: 0, retryScheduled: 0, skippedReason: "no_unconsumed_parent_scoped_rows" }; }
	diag(`PROCEED to dispatch with ${rows.length} row(s)`);
	const observedAt = now.toISOString();
	let wakeSucceeded = 0;
	let retryScheduled = 0;
	const consumedKeys = new Set<string>();
	const retryKeys = new Set<string>();
	const cappedKeys = new Set<string>();
	for (const row of rows) {
		const sessionId = parentSessionIdFromRef(row.parentSessionRef);
		if (sessionId === undefined) continue;
		if ((row.retryCount ?? 0) >= maxWakeRetriesPerConsumptionKey) {
			cappedKeys.add(row.consumptionKey);
			continue;
		}
		// CRITICAL FIX: The mainSessionIsActive check was the root cause of missing
		// wakes. When the SDK client has no `session.status` method, that helper
		// returns `true` (active) by default, so EVERY wake was pushed to retry and
		// NEVER dispatched. Per user requirement, wake prompts must always be queued
		// regardless of active state — OpenCode owns the prompt queue, and the global
		// 10s cooldown + 1-prompt-per-cycle cap + consumptionKey dedupe already
		// prevent flooding/duplicates. The active-session gate is removed entirely.
		// Wake model precedence: live session.messages() model > parent-recorded row
		// model > config model > none. When none are set/parseable, omit the model
		// body field so OpenCode picks its own default; see resolveWakeModelParts().
		const sessionModel = await probeLiveSessionModelFromMessages(input.client, sessionId);
		const effectiveModel = resolveWakeModelParts({
			sessionProviderQualifiedModelId: sessionModel,
			parentWakeProviderQualifiedModelId: row.parentWakeProviderQualifiedModelId,
			configProviderQualifiedModelId: input.config.providerQualifiedModelId,
		});
		const succeeded = await dispatchParentWakePrompt({
			dispatch,
			session: input.client.session,
			sessionId,
			directory: input.config.directory,
			text: wakePrompt(row),
			noReply: noReplyForWakeRow(row),
			model: effectiveModel,
		});
		if (succeeded) {
			wakeSucceeded += 1;
			consumedKeys.add(row.consumptionKey);
		} else {
			retryScheduled += 1;
			retryKeys.add(row.consumptionKey);
		}
	}
	if ((consumedKeys.size > 0 || retryKeys.size > 0 || cappedKeys.size > 0) && isRecord(parsed) && Array.isArray(parsed.rows)) {
		const updatedRows = parsed.rows.map((raw) => {
			if (!isRecord(raw)) return raw;
			const key = stringField(raw, "consumptionKey");
			if (key !== undefined && consumedKeys.has(key)) return { ...raw, consumed: true, consumedAt: observedAt, consumedBy: "main_session_prompt" };
			if (key !== undefined && cappedKeys.has(key)) return { ...raw, consumed: true, consumedAt: observedAt, consumedBy: "main_session_prompt_retry_cap" };
			if (key !== undefined && retryKeys.has(key)) return { ...raw, consumed: false, retryCount: (numericField(raw, "retryCount") ?? 0) + 1, retryScheduledAt: observedAt };
			return raw;
		});
		writeFileSync(readyPath, `${JSON.stringify({ ...parsed, observed_at: observedAt, rows: updatedRows }, null, 2)}\n`, "utf8");
		if (consumedKeys.size > 0) {
			// Phase 1 additive inbox: read existing notices and merge rather than
			// overwriting the entire file.  Each prompt dispatch attempt increments
			// `prompt_attempt_count` but does NOT set `user_acknowledged` — that
			// remains false until an explicit user action acknowledges the notice.
			// This ensures prior notices are never silently erased by a later one.
			const inboxPath = join(uiDir, "main-session-wake-notifications.json");
			let inboxEntries = readWakeNoticeInbox(inboxPath);
			for (const row of rows.filter((r) => consumedKeys.has(r.consumptionKey))) {
				// Derive a stable notice_id from the consumptionKey so retries for
				// the same logical notice merge into the same inbox slot.
				const noticeId = row.consumptionKey.slice(0, 128);
				const incoming: WakeNoticeInboxEntry = {
					notice_id: noticeId,
					created_at: observedAt,
					workflowId: row.workflowId,
					completionKind: row.completionKind,
					notificationLabel: row.notificationLabel.slice(0, 80),
					// Legacy compat: consumed=true means "prompt dispatch attempted".
					// NOT "user acknowledged".  See schema comment above.
					consumed: true,
					consumedAt: observedAt,
					// Each successful prompt resolve increments the attempt count.
					prompt_attempt_count: 1,
					user_acknowledged: false,
				};
				inboxEntries = mergeWakeNoticeInbox(inboxEntries, incoming);
			}
			writeFileSync(inboxPath, `${JSON.stringify({
				schema_version: "flowdesk.main_session_wake_notifications.v1",
				observed_at: observedAt,
				expires_at: new Date(Date.parse(observedAt) + 120_000).toISOString(),
				notices: inboxEntries,
				authority: { displayOnly: true, mainSessionPromptAttempted: true, parentPromptInjection: true, providerCall: true, runtimeExecution: true, actualLaneLaunch: false, hardCancelOrNoReplyAuthority: false, userAcknowledgementNotGrantedByPrompt: true },
			}, null, 2)}\n`, "utf8");
		}
	}
	return { status: "main_session_wake_completed", wakeAttempted: rows.length, wakeSucceeded, retryScheduled };
	} catch {
		return { status: "main_session_wake_skipped", wakeAttempted: 0, wakeSucceeded: 0, retryScheduled: 0, skippedReason: "wake_cache_parse_error" };
	} finally {
		rmSync(lockDir, { recursive: true, force: true });
	}
}
