import { randomBytes } from "node:crypto";
import {
	validateFlowDeskWorkflowAuthoringResultV1,
	validateFlowDeskTaskGraphV1,
	applyFlowDeskSessionEvidenceWriteIntentsV1,
	prepareFlowDeskSessionEvidenceWriteIntentV1,
	reloadFlowDeskSessionEvidenceV1,
} from "@flowdesk/core";
import { executeFlowDeskAgentTaskV1, type FlowDeskAgentTaskInputV1 } from "./agent-task-runner.js";

/** Normalize any string to a safe opaque-id: ASCII alphanumeric plus -._ only */
function toSafeId(raw: string, fallback: string): string {
	const cleaned = raw.replace(/[^A-Za-z0-9._-]/g, "-").replace(/-+/g, "-").replace(/^-|-$/g, "");
	const safe = cleaned.length >= 3 ? cleaned : fallback;
	return safe.slice(0, 64);
}

/** Redact any text that might trigger forbidden-payload validators */
function safeText(raw: string, max: number): string {
	return raw
		.replace(/\b(prompt|system prompt|developer message|transcript|stack trace|provider payload|provider response|tool args|tool result|shell output|raw log|raw config)\b/gi, "[redacted]")
		.replace(/([A-Za-z]:[\\/]|\\\\|\/(Users|home|etc|var|private|tmp|usr|opt)(?:\/|$))/g, "[redacted-path]")
		.replace(/\b(sk-[A-Za-z0-9]|api[_-]?key|bearer\s+[A-Za-z0-9]|token[:=]|secret)\b/gi, "[redacted-cred]")
		.slice(0, max);
}

function randomId(prefix: string) {
	return `${prefix}-${randomBytes(5).toString("hex")}`;
}

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

interface ParsedTask {
	task_id: string;
	title: string;
	summary: string;
	agent_role: string;
	depends_on: string[];
}

function parseTasks(raw: unknown): { ok: boolean; tasks: ParsedTask[]; error?: string } {
	if (!raw) return { ok: false, tasks: [], error: "no JSON found" };
	// Support: array directly, { tasks: [...] }, { task_list: [...] }, { plan: { tasks: [...] } }
	let arr: unknown = undefined;
	if (Array.isArray(raw)) {
		arr = raw;
	} else if (typeof raw === "object" && raw !== null) {
		const r = raw as Record<string, unknown>;
		arr = Array.isArray(r.tasks) ? r.tasks
			: Array.isArray(r.task_list) ? r.task_list
			: Array.isArray(r.plan_tasks) ? r.plan_tasks
			: typeof r.plan === "object" && r.plan !== null && Array.isArray((r.plan as Record<string, unknown>).tasks)
				? (r.plan as Record<string, unknown>).tasks
			: undefined;
	}
	if (!arr || !Array.isArray(arr)) return { ok: false, tasks: [], error: "missing tasks field" };
	const taskArr = arr as unknown[];
	const seen = new Set<string>();
	const rawIdMap = new Map<string, string>(); // raw LLM id → normalized safe id
	const tasks: ParsedTask[] = [];
	for (let idx = 0; idx < taskArr.length; idx++) {
		const item = taskArr[idx];
		if (!item || typeof item !== "object") return { ok: false, tasks: [], error: "task must be an object" };
		const t = item as Record<string, unknown>;
		const rawId = typeof t.task_id === "string" ? t.task_id.trim() : "";
		if (!rawId) return { ok: false, tasks: [], error: "task_id required" };
		// Normalize task_id to ASCII-safe format
		const safeId = toSafeId(rawId, `task-${idx + 1}`);
		// Ensure it starts with "task-" for clarity
		const finalId = safeId.startsWith("task") ? safeId : `task-${safeId}`;
		if (seen.has(finalId)) {
			// deduplicate by appending index
			const dedupId = `${finalId}-${idx}`;
			rawIdMap.set(rawId, dedupId);
			seen.add(dedupId);
			tasks.push({
				task_id: dedupId,
				title: safeText(typeof t.title === "string" ? t.title : "Task", 120),
				summary: safeText(typeof t.summary === "string" ? t.summary : "No summary.", 400),
				agent_role: typeof t.agent_role === "string" ? t.agent_role : "implementation",
				depends_on: [],
			});
		} else {
			rawIdMap.set(rawId, finalId);
			seen.add(finalId);
			tasks.push({
				task_id: finalId,
				title: safeText(typeof t.title === "string" ? t.title : "Task", 120),
				summary: safeText(typeof t.summary === "string" ? t.summary : "No summary.", 400),
				agent_role: typeof t.agent_role === "string" ? t.agent_role : "implementation",
				depends_on: Array.isArray(t.depends_on) ? t.depends_on.filter((d): d is string => typeof d === "string") : [],
			});
		}
	}
	// Resolve depends_on using the rawIdMap
	for (const task of tasks) {
		task.depends_on = task.depends_on
			.map(rawDep => rawIdMap.get(rawDep) ?? rawDep)
			.filter(dep => seen.has(dep) && dep !== task.task_id);
	}
	return { ok: true, tasks };
}

export interface FlowDeskWorkflowAuthorToolResultV1 {
	status: "workflow_authoring_completed" | "workflow_authoring_incomplete" | "blocked_before_workflow_authoring";
	workflowId?: string;
	authoringResultId?: string;
	taskGraphId?: string;
	taskCount?: number;
	redactedBlockReason?: string;
	safeNextActions: readonly string[];
	authority: {
		realOpenCodeDispatch: false;
		providerCall: false;
		runtimeExecution: false;
		actualLaneLaunch: false;
		fallbackAuthority: false;
		hardCancelOrNoReplyAuthority: false;
		toolAuthority: false;
	};
}

const SAFE_AUTHORITY = {
	realOpenCodeDispatch: false,
	providerCall: false,
	runtimeExecution: false,
	actualLaneLaunch: false,
	fallbackAuthority: false,
	hardCancelOrNoReplyAuthority: false,
	toolAuthority: false,
} as const;

function blocked(reason: string, workflowId?: string): FlowDeskWorkflowAuthorToolResultV1 {
	return { status: "blocked_before_workflow_authoring", workflowId, redactedBlockReason: reason, safeNextActions: ["/flowdesk-status", "/flowdesk-doctor"], authority: SAFE_AUTHORITY };
}

export async function executeFlowDeskWorkflowAuthorToolV1(input: {
	workflowId?: string;
	goalSummary: string;
	parentSessionId: string;
	rootDir: string;
	client: FlowDeskAgentTaskInputV1["client"];
	providerQualifiedModelId: string;
	agentName: string;
}): Promise<FlowDeskWorkflowAuthorToolResultV1> {
	if (!input.goalSummary?.trim()) return blocked("goalSummary is required");
	if (!input.parentSessionId?.trim()) return blocked("parentSessionId is required");
	if (!input.rootDir?.trim()) return blocked("rootDir is required");
	if (!input.providerQualifiedModelId?.includes("/")) return blocked("providerQualifiedModelId must be concrete");
	if (!input.agentName?.trim()) return blocked("agentName is required");

	const workflowId = input.workflowId?.trim() || `workflow-author-${randomBytes(5).toString("hex")}`;
	const authoringResultId = randomId("authoring-result");
	const taskGraphId = randomId("task-graph");

	const promptText = [
		"OUTPUT ONLY: Return a single raw JSON object. No thinking. No prose. No code fence. No explanation.",
		"The JSON must have exactly this structure:",
		'{"tasks":[{"task_id":"task-1","title":"Short title here","summary":"What this task does","agent_role":"implementation","depends_on":[]},{"task_id":"task-2","title":"Second task","summary":"What this task does","agent_role":"review","depends_on":["task-1"]}]}',
		"Rules:",
		"- Use exactly task-1, task-2, task-3, task-4 as task_ids (2 to 4 tasks)",
		"- agent_role must be one of: implementation, review, verification, security, architecture, documentation, migration",
		"- depends_on contains task_ids that must complete first (empty array if none)",
		"- title max 80 chars, summary max 300 chars",
		"- Start your response with { and end with }",
		"",
		`GOAL: ${input.goalSummary.slice(0, 400)}`,
	].join("\n");

	const taskResult = await executeFlowDeskAgentTaskV1({
		workflowId,
		taskId: randomId("task"),
		laneId: randomId("lane"),
		agentRef: `agent-${input.agentName.toLowerCase().replace(/[^a-z0-9-]/g, "-")}`,
		providerQualifiedModelId: input.providerQualifiedModelId,
		promptText,
		parentSessionId: input.parentSessionId,
		rootDir: input.rootDir,
		client: input.client,
		outputContract: "final_assistant_text",
	});

	if (taskResult.status !== "task_completed") {
		return { status: "workflow_authoring_incomplete", workflowId, redactedBlockReason: taskResult.redactedReason, safeNextActions: ["/flowdesk-status"], authority: SAFE_AUTHORITY };
	}

	const parsed = extractJsonBlock(taskResult.resultText);
	const { ok, tasks, error } = parseTasks(parsed);
	if (!ok || tasks.length === 0) return { status: "workflow_authoring_incomplete", workflowId, redactedBlockReason: `task parse failed: ${error ?? "no tasks"}`, safeNextActions: ["/flowdesk-status"], authority: SAFE_AUTHORITY };

	const createdAt = new Date().toISOString();
	const authoringRecord = {
		schema_version: "flowdesk.workflow_authoring_result.v1",
		workflow_id: workflowId,
		authoring_result_id: authoringResultId,
		goal_summary: safeText(input.goalSummary, 400),
		scope_summary: `Planning evidence only: ${tasks.length} task(s) identified.`,
		output_summary: "Task graph ready for agent assignment.",
		risk_summary: "Planning only, no execution authority.",
		status: "authored",
		created_at: createdAt,
		evidence_refs: [taskGraphId],
		release_gate: "release1_planning_only",
		dispatch_authority_enabled: false,
		provider_call_made: false,
		runtime_execution: false,
		actual_lane_launch: false,
		write_authority_enabled: false,
		redaction_version: "v1",
	};

	const graphRecord = {
		schema_version: "flowdesk.task_graph.v1",
		workflow_id: workflowId,
		task_graph_id: taskGraphId,
		nodes: tasks.map(t => ({ task_id: t.task_id, title: t.title, summary: t.summary })),
		edges: tasks.flatMap(t => t.depends_on.map(dep => ({ from_task_id: dep, to_task_id: t.task_id, relation: "depends_on" as const }))),
		graph_summary: `${tasks.length} task(s) planned from goal.`,
		created_at: createdAt,
		release_gate: "release1_planning_only" as const,
		dispatch_authority_enabled: false as const,
		provider_call_made: false as const,
		runtime_execution: false as const,
		actual_lane_launch: false as const,
		write_authority_enabled: false as const,
		redaction_version: "v1" as const,
	};

	if (!validateFlowDeskWorkflowAuthoringResultV1(authoringRecord).ok) return blocked("authoring record validation failed", workflowId);
	if (!validateFlowDeskTaskGraphV1(graphRecord).ok) return blocked("task graph validation failed", workflowId);

	const intents = [
		prepareFlowDeskSessionEvidenceWriteIntentV1({ workflowId, evidenceId: authoringResultId, record: authoringRecord as unknown as Record<string, unknown> }),
		prepareFlowDeskSessionEvidenceWriteIntentV1({ workflowId, evidenceId: taskGraphId, record: graphRecord as unknown as Record<string, unknown> }),
	];
	if (intents.some(i => !i.ok || !i.writeIntent)) return blocked("evidence write intent preparation failed", workflowId);

	const applied = applyFlowDeskSessionEvidenceWriteIntentsV1(input.rootDir, intents.map(i => i.writeIntent!));
	if (!applied.ok) return blocked("evidence write failed", workflowId);

	const reload = reloadFlowDeskSessionEvidenceV1({ workflowId, rootDir: input.rootDir });
	if (!reload.ok || !reload.entries.some(e => e.evidenceId === authoringResultId)) return blocked("authoring evidence reload failed", workflowId);

	return {
		status: "workflow_authoring_completed",
		workflowId,
		authoringResultId,
		taskGraphId,
		taskCount: tasks.length,
		safeNextActions: ["/flowdesk-status", "/flowdesk-export-debug"],
		authority: SAFE_AUTHORITY,
	};
}
