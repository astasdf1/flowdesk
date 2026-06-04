import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

type CompletionKind = "task_result" | "task_failed" | "auto_next_ready" | "awaiting_permission" | "diagnostic_attention";

export interface FlowDeskCompletionWakeMainSessionConfigV1 {
	enabled: true;
	rootDir: string;
	agentName: string;
	providerQualifiedModelId: string;
	directory?: string;
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

function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === "object" && value !== null && !Array.isArray(value);
}

function stringField(record: Record<string, unknown>, key: string): string | undefined {
	const value = record[key];
	return typeof value === "string" && value.trim().length > 0 ? value : undefined;
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

function modelParts(providerQualifiedModelId: string): { providerID: string; modelID: string } | undefined {
	const [providerID, ...rest] = providerQualifiedModelId.split("/");
	const modelID = rest.join("/");
	if (providerID.length === 0 || modelID.length === 0) return undefined;
	return { providerID, modelID };
}

function noReplyForWakeRow(row: { completionKind: CompletionKind; noReply?: boolean }): boolean {
	if (typeof row.noReply === "boolean") return row.noReply;
	return row.completionKind === "diagnostic_attention";
}

function resultShape(value: unknown): Record<string, string> {
	if (!isRecord(value)) return { type: typeof value };
	const shape: Record<string, string> = {};
	for (const [key, entry] of Object.entries(value).slice(0, 12)) {
		shape[key] = Array.isArray(entry) ? "array" : entry === null ? "null" : typeof entry;
	}
	return shape;
}

function logDispatchDiagnostic(input: { callShape: "primary_path" | "fallback_flat"; outcome: "resolved" | "rejected"; value?: unknown }): void {
	console.info("FlowDesk main-session wake dispatch diagnostic", {
		callShape: input.callShape,
		outcome: input.outcome,
		returnValueShape: input.outcome === "resolved" ? resultShape(input.value) : undefined,
	});
}

function statusLooksActive(value: unknown): boolean {
	if (typeof value === "string") return /active|busy|running|processing|streaming|generating/i.test(value) && !/idle/i.test(value);
	if (!isRecord(value)) return false;
	if (value.idle === false || value.isIdle === false) return true;
	for (const key of ["status", "state", "phase", "activity"]) {
		const field = value[key];
		if (typeof field === "string" && /active|busy|running|processing|streaming|generating/i.test(field) && !/idle/i.test(field)) return true;
	}
	return false;
}

async function mainSessionIsActive(session: NonNullable<PromptClient["session"]>, sessionId: string): Promise<boolean> {
	if (session.status === undefined) return false;
	try {
		return statusLooksActive(await session.status.call(session, sessionId));
	} catch {
		return false;
	}
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
		});
	}
	return rows;
}

function wakePrompt(row: WakeRow): string {
	const action = row.completionKind === "auto_next_ready"
		? "Continue the FlowDesk workflow now by synthesizing the completed subtask result or moving to the next safe step."
		: row.completionKind === "awaiting_permission"
			? "Notify the user that a child FlowDesk lane is awaiting an OpenCode permission response, then check durable status. The user must approve or deny through OpenCode's permission UI. Do not auto-approve, auto-deny, retry, fallback, dispatch, write, or hard-cancel."
		: row.completionKind === "diagnostic_attention"
			? "Resume FlowDesk coordination now by checking durable status/debug evidence for a child lane diagnostic attention signal. Treat this as advisory only; do not synthesize results, fail the task, abort, retry, fallback, dispatch, write, approve/deny permissions, or hard-cancel."
		: row.completionKind === "task_failed"
			? "Resume FlowDesk coordination now by checking the failed subtask status and deciding the next safe action."
			: "Resume FlowDesk coordination now by checking the completed subtask result and deciding the next safe action.";
	const summary = row.taskSummaries.length > 0 ? ` Summary: ${row.taskSummaries.join(", ")}.` : "";
	return `FlowDesk completion wake signal. Workflow ${row.workflowId} is ${row.completionKind} at ${row.readyAt}.${summary} ${action} Use durable FlowDesk status evidence; do not invent results.`;
}

async function dispatchParentWakePrompt(input: {
	dispatch: PromptDispatch;
	session: NonNullable<PromptClient["session"]>;
	sessionId: string;
	directory?: string;
	text: string;
	noReply: boolean;
}): Promise<boolean> {
	const query = input.directory === undefined ? undefined : { directory: input.directory };
	const body = {
		noReply: input.noReply,
		parts: [{ type: "text", text: input.text.slice(0, 1_000) }],
	};
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
	const model = modelParts(input.config.providerQualifiedModelId);
	if (model === undefined) return { status: "main_session_wake_skipped", wakeAttempted: 0, wakeSucceeded: 0, retryScheduled: 0, skippedReason: "invalid_model_id" };
	const uiDir = join(input.config.rootDir, ".flowdesk", "ui");
	const readyPath = join(uiDir, "completion-wake-ready.json");
	if (!existsSync(readyPath)) return { status: "main_session_wake_skipped", wakeAttempted: 0, wakeSucceeded: 0, retryScheduled: 0, skippedReason: "wake_ready_cache_missing" };
	const parsed = JSON.parse(readFileSync(readyPath, "utf8")) as unknown;
	const rows = rowsFromCache(parsed).filter((row) => row.consumed !== true && parentSessionIdFromRef(row.parentSessionRef) !== undefined).slice(0, 3);
	if (rows.length === 0) return { status: "main_session_wake_skipped", wakeAttempted: 0, wakeSucceeded: 0, retryScheduled: 0, skippedReason: "no_unconsumed_parent_scoped_rows" };
	mkdirSync(uiDir, { recursive: true });
	const observedAt = (input.now ?? new Date()).toISOString();
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
		if (await mainSessionIsActive(input.client.session, sessionId)) {
			retryScheduled += 1;
			retryKeys.add(row.consumptionKey);
			continue;
		}
		const succeeded = await dispatchParentWakePrompt({
			dispatch,
			session: input.client.session,
			sessionId,
			directory: input.config.directory,
			text: wakePrompt(row),
			noReply: noReplyForWakeRow(row),
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
}
