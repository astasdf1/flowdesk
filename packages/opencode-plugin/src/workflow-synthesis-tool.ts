import { randomBytes } from "node:crypto";
import {
	validateFlowDeskWorkflowSynthesisResultV1,
	applyFlowDeskSessionEvidenceWriteIntentsV1,
	prepareFlowDeskSessionEvidenceWriteIntentV1,
	reloadFlowDeskSessionEvidenceV1,
} from "@flowdesk/core";
import { executeFlowDeskAgentTaskV1, type FlowDeskAgentTaskInputV1 } from "./agent-task-runner.js";
import { refreshFlowDeskCompletionUiCachesV1 } from "./completion-ui-cache.js";

function extractJsonBlock(text: string): unknown | null {
	const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/);
	if (fenced?.[1]) {
		try { return JSON.parse(fenced[1].trim()); } catch { /* fall through */ }
	}
	const bare = text.match(/\{[\s\S]*\}/);
	if (bare) {
		try { return JSON.parse(bare[0]); } catch { /* fall through */ }
	}
	return null;
}

function clamp(text: string, max: number): string {
	return text.length > max ? text.slice(0, max - 1) + "…" : text;
}

const FORBIDDEN_MARKERS = /system prompt|provider payload|raw token|hidden injection|opencode\srun|dispatch|fallback|reselect/i;

export interface FlowDeskWorkflowSynthesisToolResultV1 {
	status: "workflow_synthesis_completed" | "workflow_synthesis_incomplete" | "blocked_before_synthesis";
	workflowId?: string;
	synthesisId?: string;
	tasksSummarized?: number;
	conflictDetected?: boolean;
	redactedBlockReason?: string;
	summaryForUser: string;
	safeNextActions: readonly string[];
	authority: {
		realOpenCodeDispatch: false;
		providerCall: false;
		runtimeExecution: false;
		actualLaneLaunch: false;
		fallbackAuthority: false;
	};
}

const SAFE_AUTHORITY = { realOpenCodeDispatch: false, providerCall: false, runtimeExecution: false, actualLaneLaunch: false, fallbackAuthority: false } as const;

function blocked(reason: string, workflowId?: string): FlowDeskWorkflowSynthesisToolResultV1 {
	return { status: "blocked_before_synthesis", workflowId, redactedBlockReason: reason, summaryForUser: `Blocked: ${reason}`, safeNextActions: ["/flowdesk-status", "/flowdesk-doctor"], authority: SAFE_AUTHORITY };
}

function collectTaskResultSummaries(input: {
	workflowId: string;
	rootDir: string;
}): { ok: true; summaries: Array<{ taskId: string; status: string; text: string }>; conflictDetected: boolean } | { ok: false; result: FlowDeskWorkflowSynthesisToolResultV1 } {
	const reload = reloadFlowDeskSessionEvidenceV1({ workflowId: input.workflowId, rootDir: input.rootDir });
	if (!reload.ok) return { ok: false, result: blocked("session evidence reload failed", input.workflowId) };

	const taskResultEntries = reload.entries.filter(e => e.evidenceClass === "task_result");
	if (taskResultEntries.length === 0) return { ok: false, result: blocked("no task_result evidence found – run scheduler first", input.workflowId) };

	const summaries: Array<{ taskId: string; status: string; text: string }> = [];
	let conflictDetected = false;
	const conflictKeywords = /conflict|contradict|blocked|failed|changes_required|invalid|error/i;
	for (const entry of taskResultEntries.slice(0, 10)) {
		const record = entry.record as Record<string, unknown>;
		const rawText = typeof record.result_text === "string" ? record.result_text : "(no output)";
		const redacted = FORBIDDEN_MARKERS.test(rawText) ? "(redacted)" : clamp(rawText, 500);
		const taskId = typeof record.task_id === "string" ? record.task_id : entry.evidenceId;
		const status = "completed";
		if (conflictKeywords.test(redacted)) conflictDetected = true;
		summaries.push({ taskId, status, text: redacted });
	}
	return { ok: true, summaries, conflictDetected };
}

function writeWorkflowSynthesisResult(input: {
	workflowId: string;
	rootDir: string;
	summaries: Array<{ taskId: string; status: string; text: string }>;
	conflictDetected: boolean;
	synthesisSummary: string;
}): FlowDeskWorkflowSynthesisToolResultV1 {
	const synthesisId = `synthesis-${randomBytes(5).toString("hex")}`;
	const synthesisRecord = {
		schema_version: "flowdesk.workflow_synthesis_result.v1",
		workflow_id: input.workflowId,
		synthesis_id: synthesisId,
		tasks_summarized: input.summaries.length,
		task_refs: input.summaries.map(s => s.taskId),
		conflict_detected: input.conflictDetected,
		synthesis_summary: input.synthesisSummary,
		safe_next_actions: ["/flowdesk-status", "/flowdesk-export-debug"],
	};

	if (!validateFlowDeskWorkflowSynthesisResultV1(synthesisRecord).ok) {
		return { status: "workflow_synthesis_incomplete", workflowId: input.workflowId, redactedBlockReason: "synthesis record validation failed", summaryForUser: "Synthesis validation failed.", safeNextActions: ["/flowdesk-status"], authority: SAFE_AUTHORITY };
	}

	const prepared = prepareFlowDeskSessionEvidenceWriteIntentV1({ workflowId: input.workflowId, evidenceId: synthesisId, record: synthesisRecord as unknown as Record<string, unknown> });
	if (!prepared.ok || !prepared.writeIntent) return blocked("synthesis write intent failed", input.workflowId);

	const applied = applyFlowDeskSessionEvidenceWriteIntentsV1(input.rootDir, [prepared.writeIntent]);
	if (!applied.ok) return blocked("synthesis evidence write failed", input.workflowId);
	refreshFlowDeskCompletionUiCachesV1({
		rootDir: input.rootDir,
		workflowId: input.workflowId,
	});

	return {
		status: "workflow_synthesis_completed",
		workflowId: input.workflowId,
		synthesisId,
		tasksSummarized: input.summaries.length,
		conflictDetected: input.conflictDetected,
		summaryForUser: input.synthesisSummary,
		safeNextActions: ["/flowdesk-status", "/flowdesk-export-debug"],
		authority: SAFE_AUTHORITY,
	};
}

function existingWorkflowSynthesisResult(input: {
	workflowId: string;
	rootDir: string;
}): FlowDeskWorkflowSynthesisToolResultV1 | undefined {
	const reload = reloadFlowDeskSessionEvidenceV1({ workflowId: input.workflowId, rootDir: input.rootDir });
	if (!reload.ok) return undefined;
	const existing = reload.entries.find((entry) => entry.evidenceClass === "workflow_synthesis_result");
	if (!existing) return undefined;
	const record = existing.record as Record<string, unknown>;
	const synthesisId = typeof record.synthesis_id === "string" ? record.synthesis_id : existing.evidenceId;
	refreshFlowDeskCompletionUiCachesV1({
		rootDir: input.rootDir,
		workflowId: input.workflowId,
	});
	return {
		status: "workflow_synthesis_completed",
		workflowId: input.workflowId,
		synthesisId,
		tasksSummarized: typeof record.tasks_summarized === "number" ? record.tasks_summarized : 0,
		conflictDetected: record.conflict_detected === true,
		summaryForUser: typeof record.synthesis_summary === "string" ? record.synthesis_summary : "Existing synthesis preview.",
		safeNextActions: ["/flowdesk-status", "/flowdesk-export-debug"],
		authority: SAFE_AUTHORITY,
	};
}

export function executeFlowDeskWorkflowSynthesisPreviewV1(input: {
	workflowId: string;
	rootDir: string;
}): FlowDeskWorkflowSynthesisToolResultV1 {
	if (!input.workflowId?.trim()) return blocked("workflowId is required");
	if (!input.rootDir?.trim()) return blocked("rootDir is required");
	const existing = existingWorkflowSynthesisResult({ workflowId: input.workflowId, rootDir: input.rootDir });
	if (existing) return existing;
	const collected = collectTaskResultSummaries({ workflowId: input.workflowId, rootDir: input.rootDir });
	if (!collected.ok) return collected.result;
	const previewText = collected.summaries
		.map(s => `${s.taskId}: ${s.text}`)
		.join("; ");
	const synthesisSummary = clamp(
		`Provider-free synthesis preview for ${collected.summaries.length} task result(s). ${previewText}`,
		650,
	);
	return writeWorkflowSynthesisResult({
		workflowId: input.workflowId,
		rootDir: input.rootDir,
		summaries: collected.summaries,
		conflictDetected: collected.conflictDetected,
		synthesisSummary,
	});
}

export async function executeFlowDeskWorkflowSynthesisToolV1(input: {
	workflowId: string;
	rootDir: string;
	client: FlowDeskAgentTaskInputV1["client"];
	parentSessionId: string;
	providerQualifiedModelId: string;
	agentName: string;
}): Promise<FlowDeskWorkflowSynthesisToolResultV1> {
	if (!input.workflowId?.trim()) return blocked("workflowId is required");
	if (!input.rootDir?.trim()) return blocked("rootDir is required");
	if (!input.parentSessionId?.trim()) return blocked("parentSessionId is required");
	if (!input.providerQualifiedModelId?.includes("/")) return blocked("providerQualifiedModelId must be concrete");
	if (!input.agentName?.trim()) return blocked("agentName is required");
	const existing = existingWorkflowSynthesisResult({ workflowId: input.workflowId, rootDir: input.rootDir });
	if (existing) return existing;

	const collected = collectTaskResultSummaries({ workflowId: input.workflowId, rootDir: input.rootDir });
	if (!collected.ok) return collected.result;
	const summaries = collected.summaries;
	let conflictDetected = collected.conflictDetected;

	const promptText = [
		"You are a results synthesizer. Read the following task results and provide a concise, bounded synthesis.",
		"Return ONLY a JSON object: { \"synthesis_summary\": string (≤600 chars, no raw tokens/payloads/dispatch wording), \"conflict_detected\": boolean }",
		"No execution authority. Redacted summaries only.",
		"---",
		summaries.map(s => `Task ${s.taskId} (${s.status}): ${s.text}`).join("\n"),
	].join("\n");

	const taskResult = await executeFlowDeskAgentTaskV1({
		workflowId: input.workflowId,
		taskId: `task-synth-${randomBytes(4).toString("hex")}`,
		laneId: `lane-synth-${randomBytes(4).toString("hex")}`,
		agentRef: `agent-${input.agentName.toLowerCase().replace(/[^a-z0-9-]/g, "-")}`,
		providerQualifiedModelId: input.providerQualifiedModelId,
		promptText,
		parentSessionId: input.parentSessionId,
		rootDir: input.rootDir,
		client: input.client,
		outputContract: "final_assistant_text",
	});

	let synthesisSummary = `Synthesized ${summaries.length} task result(s). Conflict: ${conflictDetected}.`;
	if (taskResult.status === "task_completed") {
		const parsed = extractJsonBlock(taskResult.resultText);
		if (parsed && typeof parsed === "object" && "synthesis_summary" in parsed) {
			const raw = (parsed as Record<string, unknown>).synthesis_summary;
			if (typeof raw === "string" && !FORBIDDEN_MARKERS.test(raw)) {
				synthesisSummary = clamp(raw, 700);
				if (typeof (parsed as Record<string, unknown>).conflict_detected === "boolean") {
					conflictDetected = (parsed as Record<string, unknown>).conflict_detected as boolean;
				}
			}
		}
	}

	return writeWorkflowSynthesisResult({
		workflowId: input.workflowId,
		rootDir: input.rootDir,
		summaries,
		conflictDetected,
		synthesisSummary,
	});
}
