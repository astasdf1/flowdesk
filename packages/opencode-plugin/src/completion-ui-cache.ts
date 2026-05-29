import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import {
	reloadFlowDeskSessionEvidenceV1,
	type FlowDeskSessionEvidenceReloadEntryV1,
} from "@flowdesk/core";

type UiRow = {
	workflowId: string;
	laneId: string;
	taskId?: string;
	state?: string;
	classification: "progressing_normal" | "progressing_late" | "stalled" | "terminal" | "unknown";
	progressPhase?: string;
	lastObservedAt?: string;
	completionStatus?: string;
	outputKind?: string;
	usableForSynthesis?: boolean;
	recoveryActionRefs: readonly string[];
	statusCommandRef: "/flowdesk-status";
	debugCommandRef: "/flowdesk-export-debug";
};

function getString(record: Record<string, unknown>, key: string): string | undefined {
	const value = record[key];
	return typeof value === "string" && value.length > 0 ? value : undefined;
}

function latestByLane(entries: readonly FlowDeskSessionEvidenceReloadEntryV1[], evidenceClass: string): Map<string, FlowDeskSessionEvidenceReloadEntryV1> {
	const byLane = new Map<string, FlowDeskSessionEvidenceReloadEntryV1>();
	for (const entry of entries) {
		if (entry.evidenceClass !== evidenceClass) continue;
		const laneId = getString(entry.record, "lane_id");
		if (laneId === undefined) continue;
		byLane.set(laneId, entry);
	}
	return byLane;
}

export function refreshFlowDeskCompletionUiCachesV1(input: {
	rootDir: string;
	workflowId: string;
	observedAt?: string;
}): void {
	try {
		const observedAt = input.observedAt ?? new Date().toISOString();
		const reload = reloadFlowDeskSessionEvidenceV1({ rootDir: input.rootDir, workflowId: input.workflowId });
		if (!reload.ok) return;
		const resultByLane = latestByLane(reload.entries, "task_result");
		const failedByLane = latestByLane(reload.entries, "task_failed");
		const contextByLane = latestByLane(reload.entries, "agent_task_context");
		const laneIds = new Set<string>([...contextByLane.keys(), ...resultByLane.keys(), ...failedByLane.keys()]);
		const rows: UiRow[] = [...laneIds].map((laneId) => {
			const result = resultByLane.get(laneId)?.record;
			const failed = failedByLane.get(laneId)?.record;
			const context = contextByLane.get(laneId)?.record;
			const taskId = getString(result ?? failed ?? context ?? {}, "task_id");
			const state = result !== undefined ? "task_result" : failed !== undefined ? "invocation_failed" : "running";
			const actions = failed !== undefined
				? ["/flowdesk-status", "/flowdesk-retry", "/flowdesk-resume", "/flowdesk-abort", "/flowdesk-export-debug"]
				: ["/flowdesk-status", "/flowdesk-export-debug"];
			return {
				workflowId: input.workflowId,
				laneId,
				...(taskId === undefined ? {} : { taskId }),
				state,
				classification: result !== undefined || failed !== undefined ? "terminal" : "progressing_normal",
				progressPhase: result !== undefined ? "finalizing" : failed !== undefined ? "failed" : "waiting",
				lastObservedAt: getString(result ?? failed ?? context ?? {}, "created_at") ?? observedAt,
				...(getString(result ?? {}, "completion_status") === undefined ? {} : { completionStatus: getString(result ?? {}, "completion_status") }),
				...(getString(result ?? {}, "output_kind") === undefined ? {} : { outputKind: getString(result ?? {}, "output_kind") }),
				...(typeof result?.usable_for_synthesis === "boolean" ? { usableForSynthesis: result.usable_for_synthesis } : {}),
				recoveryActionRefs: actions,
				statusCommandRef: "/flowdesk-status",
				debugCommandRef: "/flowdesk-export-debug",
			};
		});
		const uiDir = join(input.rootDir, ".flowdesk", "ui");
		mkdirSync(uiDir, { recursive: true });
		writeFileSync(join(uiDir, "subtask-activity-sidebar.json"), `${JSON.stringify({
			schema_version: "flowdesk.subtask_activity_sidebar_cache.v1",
			observed_at: observedAt,
			expires_at: new Date(Date.parse(observedAt) + 120_000).toISOString(),
			rows: rows.slice(0, 8),
			authority: { displayOnly: true, realOpenCodeDispatch: false, providerCall: false, runtimeExecution: false, fallbackAuthority: false, hardCancelOrNoReplyAuthority: false },
		}, null, 2)}\n`, "utf8");

		const ready = rows.length > 0 && rows.every((row) => row.state === "task_result" && row.completionStatus !== "partial" && row.usableForSynthesis !== false);
		writeFileSync(join(uiDir, "auto-next-ready.json"), `${JSON.stringify({
			schema_version: "flowdesk.auto_next_ready_cache.v1",
			observed_at: observedAt,
			expires_at: new Date(Date.parse(observedAt) + 120_000).toISOString(),
			workflows: ready ? [{
				workflowId: input.workflowId,
				laneProgressAggregate: { expected: rows.length, terminal: rows.length, taskResult: rows.length, failed: 0, awaitingPermission: 0, normalCompleted: rows.length, autoNextStepEligible: true },
				taskResultRefs: rows.map((row) => row.taskId ?? row.laneId).slice(0, 32),
				nextActionRefs: ["/flowdesk-status", "/flowdesk-export-debug"],
			}] : [],
			authority: { displayOnly: true, realOpenCodeDispatch: false, providerCall: false, runtimeExecution: false, fallbackAuthority: false, hardCancelOrNoReplyAuthority: false },
		}, null, 2)}\n`, "utf8");
	} catch {
		// Display cache refresh is best-effort only.
	}
}
