import { createHash } from "node:crypto";
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import {
	applyFlowDeskSessionEvidenceWriteIntentsV1,
	prepareFlowDeskSessionEvidenceWriteIntentV1,
	type FlowDeskAgentTaskProgressV1,
} from "@flowdesk/core";
import { refreshFlowDeskCompletionUiCachesV1 } from "./completion-ui-cache.js";

export interface FlowDeskEventHookObservationResultV1 {
	matched: boolean;
	eventType?: string;
	sessionId?: string;
	workflowId?: string;
	laneId?: string;
	taskId?: string;
	evidenceWritten: number;
}

interface ChildSessionBinding {
	workflowId: string;
	laneId: string;
	taskId: string;
	childSessionId: string;
	parentSessionRef: string;
	agentRef: string;
	providerQualifiedModelId: string;
}

function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === "object" && value !== null && !Array.isArray(value);
}

function safeString(value: unknown): string | undefined {
	return typeof value === "string" && value.trim().length > 0 ? value : undefined;
}

function shortHash(value: unknown): string {
	return createHash("sha256").update(JSON.stringify(value)).digest("hex").slice(0, 12);
}

function compactLabel(value: string): string {
	const compact = value.replace(/\s+/g, " ").trim();
	return compact.length > 120 ? `${compact.slice(0, 119)}…` : compact;
}

function firstString(value: unknown): string | undefined {
	return typeof value === "string" && value.trim().length > 0 ? value : undefined;
}

function errorDetailFromRecord(value: unknown): string | undefined {
	if (!isRecord(value)) return firstString(value);
	const message = firstString(value.message) ?? firstString(value.reason) ?? firstString(value.error);
	const code = firstString(value.code) ?? firstString(value.name);
	const stack = firstString(value.stack)?.split(/\r?\n/)[0];
	const cause = isRecord(value.cause) ? firstString(value.cause.message) ?? firstString(value.cause.reason) ?? firstString(value.cause.error) : undefined;
	const details = [
		message === undefined ? undefined : `message=${compactLabel(message)}`,
		code === undefined ? undefined : `code=${compactLabel(code)}`,
		stack === undefined ? undefined : `stack=${compactLabel(stack)}`,
		cause === undefined ? undefined : `cause=${compactLabel(cause)}`,
	].filter((part): part is string => part !== undefined);
	return details.length === 0 ? undefined : details.join("; ");
}

function recordShapeSummary(value: unknown, label: string): string | undefined {
	if (!isRecord(value)) return undefined;
	const keys = Object.keys(value).sort();
	if (keys.length === 0) return `${label}=empty`;
	const keySummary = keys
		.slice(0, 12)
		.map((key) => `${key}:${typeof value[key]}`)
		.join(",");
	return `${label} keys=[${keySummary}${keys.length > 12 ? ",…" : ""}]`;
}

function sessionErrorSummary(event: unknown): string {
	const properties = eventProperties(event);
	const direct = errorDetailFromRecord(properties?.error);
	const message =
		direct ??
		errorDetailFromRecord(properties) ??
		recordShapeSummary(properties, "properties") ??
		firstString(properties?.error) ??
		firstString(properties?.message) ??
		firstString(properties?.reason) ??
		recordShapeSummary(event, "event");
	return message === undefined
		? "OpenCode session.error event observed for FlowDesk child session"
		: `OpenCode session.error observed: ${compactLabel(message)}`;
}

function eventProperties(event: unknown): Record<string, unknown> | undefined {
	const record = isRecord(event) ? event : undefined;
	return isRecord(record?.properties) ? record.properties : undefined;
}

function eventType(event: unknown): string | undefined {
	return safeString(isRecord(event) ? event.type : undefined);
}

function eventSessionId(event: unknown): string | undefined {
	const properties = eventProperties(event);
	const direct = safeString(properties?.sessionID);
	if (direct !== undefined) return direct;
	const part = isRecord(properties?.part) ? properties.part : undefined;
	const partSession = safeString(part?.sessionID);
	if (partSession !== undefined) return partSession;
	const info = isRecord(properties?.info) ? properties.info : undefined;
	return safeString(info?.sessionID);
}

function readJson(path: string): Record<string, unknown> | undefined {
	try {
		const parsed = JSON.parse(readFileSync(path, "utf8"));
		return isRecord(parsed) ? parsed : undefined;
	} catch {
		return undefined;
	}
}

function findChildSessionBinding(rootDir: string, childSessionId: string): ChildSessionBinding | undefined {
	const sessionsDir = join(rootDir, ".flowdesk", "sessions");
	if (!existsSync(sessionsDir)) return undefined;
	for (const workflowId of readdirSync(sessionsDir)) {
		const evidenceDir = join(sessionsDir, workflowId, "evidence", "agent-task-child-session");
		if (!existsSync(evidenceDir)) continue;
		for (const file of readdirSync(evidenceDir)) {
			if (!file.endsWith(".json")) continue;
			const record = readJson(join(evidenceDir, file));
			if (record?.child_session_id !== childSessionId) continue;
			const laneId = safeString(record.lane_id);
			const taskId = safeString(record.task_id);
			const agentRef = safeString(record.agent_ref);
			const providerQualifiedModelId = safeString(record.provider_qualified_model_id);
			const parentSessionRef = safeString(record.parent_session_ref);
			if (laneId === undefined || taskId === undefined || agentRef === undefined || providerQualifiedModelId === undefined || parentSessionRef === undefined) continue;
			return { workflowId, laneId, taskId, childSessionId, parentSessionRef, agentRef, providerQualifiedModelId };
		}
	}
	return undefined;
}

function writeEvidence(rootDir: string, workflowId: string, evidenceId: string, record: Record<string, unknown>): boolean {
	const prepared = prepareFlowDeskSessionEvidenceWriteIntentV1({ workflowId, evidenceId, record });
	if (!prepared.ok || prepared.writeIntent === undefined) return false;
	const applied = applyFlowDeskSessionEvidenceWriteIntentsV1(rootDir, [prepared.writeIntent]);
	return applied.ok && applied.writtenPaths.length > 0;
}

function writeProgress(rootDir: string, binding: ChildSessionBinding, event: unknown, phase: FlowDeskAgentTaskProgressV1["phase"], label: string): boolean {
	const digest = shortHash(event);
	const record: FlowDeskAgentTaskProgressV1 = {
		schema_version: "flowdesk.agent_task_progress.v1",
		workflow_id: binding.workflowId,
		lane_id: binding.laneId,
		task_id: binding.taskId,
		agent_ref: binding.agentRef,
		provider_qualified_model_id: binding.providerQualifiedModelId,
		progress_seq: Number.parseInt(digest.slice(0, 6), 16) + 1,
		observed_at: new Date().toISOString(),
		phase,
		progress_label: compactLabel(label),
		progress_ref: `progress-${binding.laneId}-event-${digest}`,
		redaction_version: "v1",
		dispatch_authority_enabled: false,
	};
	return writeEvidence(rootDir, binding.workflowId, `agent-task-progress-${binding.laneId}-event-${digest}`, record as unknown as Record<string, unknown>);
}

function writeSessionErrorTerminal(rootDir: string, binding: ChildSessionBinding, event: unknown): number {
	const digest = shortHash(event);
	const observedAt = new Date().toISOString();
	const redactedReason = sessionErrorSummary(event);
	const redactedErrorDetails = compactLabel([
		"session.error details",
		firstString(eventProperties(event)?.sessionID) === undefined ? undefined : `session=${firstString(eventProperties(event)?.sessionID)}`,
		errorDetailFromRecord(eventProperties(event)?.error),
		recordShapeSummary(eventProperties(event)?.error, "error"),
		recordShapeSummary(eventProperties(event), "properties"),
		recordShapeSummary(event, "event"),
		firstString(eventProperties(event)?.message) === undefined ? undefined : `message=${firstString(eventProperties(event)?.message)}`,
		firstString(eventProperties(event)?.reason) === undefined ? undefined : `reason=${firstString(eventProperties(event)?.reason)}`,
		firstString(eventProperties(event)?.code) === undefined ? undefined : `code=${firstString(eventProperties(event)?.code)}`,
	].filter((part): part is string => part !== undefined).join("; "));
	let written = 0;
	if (writeEvidence(rootDir, binding.workflowId, `task-failed-${binding.taskId}-event-session-error-${digest}`, {
		schema_version: "flowdesk.task_failed.v1",
		workflow_id: binding.workflowId,
		lane_id: binding.laneId,
		task_id: binding.taskId,
		agent_ref: binding.agentRef,
		provider_qualified_model_id: binding.providerQualifiedModelId,
		failure_category: "unknown",
		redacted_reason: redactedReason,
		redacted_error_details: redactedErrorDetails,
		created_at: observedAt,
		dispatch_authority_enabled: false,
	})) written++;
	if (writeEvidence(rootDir, binding.workflowId, `lifecycle-agent-task-event-session-error-${binding.laneId}-${digest}`, {
		schema_version: "flowdesk.lane_lifecycle_record.v1",
		lane_id: binding.laneId,
		workflow_id: binding.workflowId,
		attempt_id: `attempt-${binding.laneId}-event-${digest}`,
		parent_session_ref: binding.parentSessionRef,
		child_session_ref: `ses-${binding.childSessionId}`,
		agent_ref: binding.agentRef,
		provider_qualified_model_id: binding.providerQualifiedModelId,
		state: "invocation_failed",
		timeout_ms: 60_000,
		orphan_max_age_ms: 600_000,
		retry_count: 0,
		created_at: observedAt,
		updated_at: observedAt,
		spawned_by: "flowdesk",
		durability: "best_effort_no_dir_fsync",
		dispatch_authority_enabled: false,
		providerCall: false,
		actualLaneLaunch: false,
		runtimeExecution: false,
	})) written++;
	return written;
}

function eventProgress(event: unknown): { phase: FlowDeskAgentTaskProgressV1["phase"]; label: string } | undefined {
	const type = eventType(event);
	const properties = eventProperties(event);
	if (type === "permission.updated") return { phase: "awaiting_permission", label: "agent task awaiting OpenCode permission response" };
	if (type === "permission.replied") return { phase: "waiting", label: "agent task OpenCode permission response observed" };
	if (type === "session.error") return { phase: "failed", label: compactLabel(sessionErrorSummary(event)) };
	if (type === "session.idle") return { phase: "finalizing", label: "agent task session idle event observed" };
	if (type === "session.status") {
		const status = isRecord(properties?.status) ? properties.status : undefined;
		if (status?.type === "retry") return { phase: "retrying", label: "agent task session retry event observed" };
		if (status?.type === "idle") return { phase: "finalizing", label: "agent task session idle status observed" };
		if (status?.type === "busy") return { phase: "waiting", label: "agent task session busy event observed" };
	}
	if (type === "message.part.updated") {
		const part = isRecord(properties?.part) ? properties.part : undefined;
		if (part?.type === "step-finish") return { phase: "finalizing", label: "agent task terminal step event observed" };
		if (part?.type === "tool" && isRecord(part.state) && part.state.status === "error") return { phase: "waiting", label: "agent task tool error event observed" };
		return { phase: "waiting", label: "agent task message part event observed" };
	}
	if (type === "message.updated" || type === "session.updated" || type === "session.diff") return { phase: "waiting", label: `agent task ${type} event observed` };
	return undefined;
}

export async function observeFlowDeskOpenCodeEventV1(input: {
	rootDir: string;
	event: unknown;
}): Promise<FlowDeskEventHookObservationResultV1> {
	const type = eventType(input.event);
	const sessionId = eventSessionId(input.event);
	if (type === undefined || sessionId === undefined) return { matched: false, eventType: type, sessionId, evidenceWritten: 0 };
	const binding = findChildSessionBinding(input.rootDir, sessionId);
	if (binding === undefined) return { matched: false, eventType: type, sessionId, evidenceWritten: 0 };
	const progress = eventProgress(input.event);
	const progressWritten = progress === undefined ? false : writeProgress(input.rootDir, binding, input.event, progress.phase, progress.label);
	const terminalWritten = type === "session.error" ? writeSessionErrorTerminal(input.rootDir, binding, input.event) : 0;
	if (terminalWritten > 0) {
		refreshFlowDeskCompletionUiCachesV1({
			rootDir: input.rootDir,
			workflowId: binding.workflowId,
		});
	}
	return {
		matched: true,
		eventType: type,
		sessionId,
		workflowId: binding.workflowId,
		laneId: binding.laneId,
		taskId: binding.taskId,
		evidenceWritten: (progressWritten ? 1 : 0) + terminalWritten,
	};
}
