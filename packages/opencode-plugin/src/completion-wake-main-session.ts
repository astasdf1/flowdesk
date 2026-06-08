import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";

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
	};
}

type PromptDispatch = (options: unknown) => unknown;

const maxWakeRetriesPerConsumptionKey = 10;
const LOCK_STALE_TTL_MS = 60_000;
const WAKE_ROW_MAX_AGE_MS = 300_000;
const DEFAULT_PROVIDER_QUALIFIED_MODEL_ID = "openai/gpt-5.5";
const WAKE_DIAG_ENABLED = process.env.FLOWDESK_WAKE_DIAG === "1" || process.env.FLOWDESK_WAKE_DIAG === "true";

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
	while (/^ses-/i.test(value) && value.length > 4) value = value.slice(4);
	return /^ses_[A-Za-z0-9]/.test(value) ? value : undefined;
}


function parseModelParts(providerQualifiedModelId: string | undefined): { providerID: string; modelID: string } | undefined {
	if (providerQualifiedModelId === undefined) return undefined;
	const [providerID, ...rest] = providerQualifiedModelId.trim().split("/");
	const modelID = rest.join("/");
	if (providerID.length === 0 || modelID.length === 0) return undefined;
	return { providerID, modelID };
}

function modelParts(providerQualifiedModelId: string | undefined): { providerID: string; modelID: string } {
	return parseModelParts(providerQualifiedModelId) ?? parseModelParts(DEFAULT_PROVIDER_QUALIFIED_MODEL_ID)!;
}

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
		fs.appendFileSync("/Users/bagel_macpro_055/.flowdesk/wake-dispatch-diag.log", line, "utf8");
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
	const configModel = parseModelParts(input.config.providerQualifiedModelId);
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
	const diag = (msg: string) => { if (!WAKE_DIAG_ENABLED) return; try { (require("node:fs") as typeof import("node:fs")).appendFileSync("/Users/bagel_macpro_055/.flowdesk/wake-step-diag.log", `${new Date().toISOString()} ${msg}\n`, "utf8"); } catch {} };
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
		.sort((left, right) => Date.parse(right.readyAt) - Date.parse(left.readyAt))
		.slice(0, 1);
	diag(`allRows=${allRows.length} eligibleRows=${rows.length} configParentRef=${input.config.parentSessionRef ?? "NONE"}`);
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
		const rowModel = row.parentWakeProviderQualifiedModelId !== undefined ? parseModelParts(row.parentWakeProviderQualifiedModelId) : undefined;
		const effectiveModel = rowModel ?? configModel;
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
			writeFileSync(join(uiDir, "main-session-wake-notifications.json"), `${JSON.stringify({
				schema_version: "flowdesk.main_session_wake_notifications.v1",
				observed_at: observedAt,
				expires_at: new Date(Date.parse(observedAt) + 120_000).toISOString(),
				notices: rows.filter((row) => consumedKeys.has(row.consumptionKey)).map((row) => ({ ...row, consumedAt: observedAt, consumedBy: "main_session_prompt" })),
				authority: { displayOnly: true, mainSessionPromptAttempted: true, parentPromptInjection: true, providerCall: true, runtimeExecution: true, actualLaneLaunch: false, hardCancelOrNoReplyAuthority: false },
			}, null, 2)}\n`, "utf8");
		}
	}
	return { status: "main_session_wake_completed", wakeAttempted: rows.length, wakeSucceeded, retryScheduled };
	} finally {
		rmSync(lockDir, { recursive: true, force: true });
	}
}
