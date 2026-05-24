import { existsSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import {
	FLOWDESK_SESSION_EVIDENCE_CLASSES,
	type FlowDeskSessionEvidenceClass,
	type FlowDeskSessionEvidenceReloadEntryV1,
	type FlowDeskSessionEvidenceReloadResultV1,
	reloadFlowDeskSessionEvidenceV1,
} from "@flowdesk/core";

export interface FlowDeskStatusLiveConfigV1 {
	rootDir: string;
	maxWorkflows?: number;
	maxRecentEvidencePerClass?: number;
}

export interface FlowDeskStatusLiveRequestV1 {
	workflowId?: string;
}

export interface FlowDeskStatusLiveWorkflowEvidenceSummaryV1 {
	workflowId: string;
	reloadOk: boolean;
	blockedCount: number;
	evidenceCounts: Partial<Record<FlowDeskSessionEvidenceClass, number>>;
	recentEvidenceRefs: Partial<Record<FlowDeskSessionEvidenceClass, string[]>>;
	latestReviewerVerdictLabels: readonly (
		| "pass"
		| "changes_required"
		| "blocked"
		| "inconclusive"
	)[];
	latestLaneLifecycleStates: readonly string[];
	latestRegatePlanState?: string;
	latestProviderAcquisitionStatus?: string;
}

export interface FlowDeskStatusLiveResultV1 {
	status: "status_live_collected" | "blocked_before_status_live";
	observedAt: string;
	rootDir: string;
	requestedWorkflowId?: string;
	resolvedWorkflowIds: readonly string[];
	workflows: readonly FlowDeskStatusLiveWorkflowEvidenceSummaryV1[];
	redactedBlockReason?: string;
	safeNextActions: readonly (
		| "/flowdesk-status"
		| "/flowdesk-doctor"
		| "/flowdesk-export-debug"
	)[];
	authority: {
		realOpenCodeDispatch: false;
		providerCall: false;
		runtimeExecution: false;
		actualLaneLaunch: false;
		fallbackAuthority: false;
		hardCancelOrNoReplyAuthority: false;
		toolAuthority: false;
		statusEvidenceObserved: boolean;
	};
}

const FLOWDESK_SESSION_RECORD_ROOT = ".flowdesk/sessions";

function blockedAuthority() {
	return {
		realOpenCodeDispatch: false as const,
		providerCall: false as const,
		runtimeExecution: false as const,
		actualLaneLaunch: false as const,
		fallbackAuthority: false as const,
		hardCancelOrNoReplyAuthority: false as const,
		toolAuthority: false as const,
		statusEvidenceObserved: false,
	};
}

function safeNextActions(): readonly (
	| "/flowdesk-status"
	| "/flowdesk-doctor"
	| "/flowdesk-export-debug"
)[] {
	return ["/flowdesk-status", "/flowdesk-doctor", "/flowdesk-export-debug"];
}

function listSessionWorkflowIds(rootDir: string, max: number): string[] {
	const sessionsDir = join(rootDir, FLOWDESK_SESSION_RECORD_ROOT);
	if (!existsSync(sessionsDir)) return [];
	let entries: string[];
	try {
		entries = readdirSync(sessionsDir);
	} catch {
		return [];
	}
	const workflowEntries: { name: string; mtimeMs: number }[] = [];
	for (const name of entries) {
		const candidatePath = join(sessionsDir, name);
		let stat: ReturnType<typeof statSync>;
		try {
			stat = statSync(candidatePath);
		} catch {
			continue;
		}
		if (!stat.isDirectory()) continue;
		workflowEntries.push({ name, mtimeMs: stat.mtimeMs });
	}
	workflowEntries.sort((a, b) => b.mtimeMs - a.mtimeMs);
	return workflowEntries.slice(0, max).map((entry) => entry.name);
}

function getStringField(
	record: Record<string, unknown>,
	key: string,
): string | undefined {
	const value = record[key];
	return typeof value === "string" ? value : undefined;
}

function summarizeWorkflow(
	workflowId: string,
	reload: FlowDeskSessionEvidenceReloadResultV1,
	maxRecent: number,
): FlowDeskStatusLiveWorkflowEvidenceSummaryV1 {
	const counts: Partial<Record<FlowDeskSessionEvidenceClass, number>> = {};
	const recent: Partial<Record<FlowDeskSessionEvidenceClass, string[]>> = {};
	const reviewerVerdictLabels: (
		| "pass"
		| "changes_required"
		| "blocked"
		| "inconclusive"
	)[] = [];
	const laneLifecycleStates: string[] = [];
	let regatePlanState: string | undefined;
	let providerAcquisitionStatus: string | undefined;

	for (const evidenceClass of FLOWDESK_SESSION_EVIDENCE_CLASSES) {
		const classEntries = reload.entries.filter(
			(entry: FlowDeskSessionEvidenceReloadEntryV1) =>
				entry.evidenceClass === evidenceClass,
		);
		if (classEntries.length === 0) continue;
		counts[evidenceClass] = classEntries.length;
		recent[evidenceClass] = classEntries
			.slice(-maxRecent)
			.map((entry) => entry.evidenceId);

		if (evidenceClass === "reviewer_verdict") {
			for (const entry of classEntries.slice(-maxRecent)) {
				const label = getStringField(entry.record, "verdict_label");
				if (
					label === "pass" ||
					label === "changes_required" ||
					label === "blocked" ||
					label === "inconclusive"
				)
					reviewerVerdictLabels.push(label);
			}
		}
		if (evidenceClass === "lane_lifecycle") {
			for (const entry of classEntries.slice(-maxRecent)) {
				const state = getStringField(entry.record, "state");
				if (state !== undefined) laneLifecycleStates.push(state);
			}
		}
		if (evidenceClass === "fallback_regate_plan") {
			const last = classEntries[classEntries.length - 1];
			if (last !== undefined) {
				const state = getStringField(last.record, "state");
				if (state !== undefined) regatePlanState = state;
			}
		}
		if (
			evidenceClass ===
			"exact_model_availability_cache_provider_acquisition_result"
		) {
			const last = classEntries[classEntries.length - 1];
			if (last !== undefined) {
				const acquisitionStatus =
					getStringField(last.record, "status") ??
					getStringField(last.record, "state");
				if (acquisitionStatus !== undefined)
					providerAcquisitionStatus = acquisitionStatus;
			}
		}
	}

	return {
		workflowId,
		reloadOk: reload.ok,
		blockedCount: reload.blocked.length,
		evidenceCounts: counts,
		recentEvidenceRefs: recent,
		latestReviewerVerdictLabels: reviewerVerdictLabels,
		latestLaneLifecycleStates: laneLifecycleStates,
		...(regatePlanState !== undefined
			? { latestRegatePlanState: regatePlanState }
			: {}),
		...(providerAcquisitionStatus !== undefined
			? { latestProviderAcquisitionStatus: providerAcquisitionStatus }
			: {}),
	};
}

export async function executeFlowDeskStatusLiveV1(input: {
	config: FlowDeskStatusLiveConfigV1;
	request?: FlowDeskStatusLiveRequestV1;
	now?: () => Date;
}): Promise<FlowDeskStatusLiveResultV1> {
	const observedAt = (input.now ? input.now() : new Date()).toISOString();
	const rootDir = input.config.rootDir;
	const requestedWorkflowId = input.request?.workflowId?.trim();
	const maxWorkflows = Math.max(input.config.maxWorkflows ?? 5, 1);
	const maxRecentEvidencePerClass = Math.max(
		input.config.maxRecentEvidencePerClass ?? 3,
		1,
	);

	if (typeof rootDir !== "string" || rootDir.trim().length === 0) {
		return {
			status: "blocked_before_status_live",
			observedAt,
			rootDir: rootDir ?? "",
			...(requestedWorkflowId ? { requestedWorkflowId } : {}),
			resolvedWorkflowIds: [],
			workflows: [],
			redactedBlockReason:
				"status live tool requires a durable state root directory",
			safeNextActions: safeNextActions(),
			authority: blockedAuthority(),
		};
	}

	const workflowIds =
		requestedWorkflowId !== undefined && requestedWorkflowId.length > 0
			? [requestedWorkflowId]
			: listSessionWorkflowIds(rootDir, maxWorkflows);

	if (workflowIds.length === 0) {
		return {
			status: "blocked_before_status_live",
			observedAt,
			rootDir,
			...(requestedWorkflowId ? { requestedWorkflowId } : {}),
			resolvedWorkflowIds: [],
			workflows: [],
			redactedBlockReason:
				requestedWorkflowId !== undefined && requestedWorkflowId.length > 0
					? `no durable session evidence for workflow ${requestedWorkflowId}`
					: "no durable session workflows found under the configured durable state root",
			safeNextActions: safeNextActions(),
			authority: blockedAuthority(),
		};
	}

	const workflows: FlowDeskStatusLiveWorkflowEvidenceSummaryV1[] = [];
	for (const workflowId of workflowIds) {
		const reload = reloadFlowDeskSessionEvidenceV1({
			workflowId,
			rootDir,
		});
		workflows.push(
			summarizeWorkflow(workflowId, reload, maxRecentEvidencePerClass),
		);
	}

	const observed = workflows.some((summary) =>
		Object.values(summary.evidenceCounts).some(
			(count) => typeof count === "number" && count > 0,
		),
	);

	return {
		status: "status_live_collected",
		observedAt,
		rootDir,
		...(requestedWorkflowId ? { requestedWorkflowId } : {}),
		resolvedWorkflowIds: workflowIds,
		workflows,
		safeNextActions: safeNextActions(),
		authority: {
			realOpenCodeDispatch: false,
			providerCall: false,
			runtimeExecution: false,
			actualLaneLaunch: false,
			fallbackAuthority: false,
			hardCancelOrNoReplyAuthority: false,
			toolAuthority: false,
			statusEvidenceObserved: observed,
		},
	};
}
