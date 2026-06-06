/**
 * OI session accumulator for agent task runner integration.
 * P7-S16: Tracks OI operations during a task and produces a FlowDeskOISessionSummaryV1
 * after task completion. Also provides a reader for the N most recent OI summaries.
 */

import {
	type FlowDeskOISessionSummaryV1,
	type FlowDeskOISessionSummaryResultV1,
	createFlowDeskOISessionSummaryV1,
	reloadFlowDeskSessionEvidenceV1,
} from "@flowdesk/core";

// Re-export types for callers that import from this module.
export type { FlowDeskOISessionSummaryResultV1 };

// ─── Accumulator Interface ────────────────────────────────────────────────────

/**
 * Tracks OI operation counts during a single agent task execution.
 * All fields are non-negative integers; increment() is the only mutation path.
 * Advisory-only: no authority flags, no dispatch, no provider calls.
 */
export interface FlowDeskOISessionAccumulatorV1 {
	/** Number of workflow plan proposals scored during the task. */
	proposalsScored: number;
	/** Number of score-reuse gate checks performed. */
	reuseGatesChecked: number;
	/** Number of fanout cadence gate evaluations performed. */
	fanoutGatesEvaluated: number;
	/** Total advisory ledger entries produced. */
	ledgerEntriesTotal: number;

	/**
	 * Increment one of the tracked OI operation counters by 1.
	 * Silently ignored for unknown field names (callers use the typed union).
	 */
	increment(
		field:
			| "proposalsScored"
			| "reuseGatesChecked"
			| "fanoutGatesEvaluated"
			| "ledgerEntriesTotal",
	): void;

	/**
	 * Produce a FlowDeskOISessionSummaryResultV1 from the current counter state.
	 * The caller supplies metadata (sessionRef, workflowId, capturedAt, oiEnabled).
	 * When oiEnabled=false, all counts are forced to 0 and advisory_health_label
	 * is set to "disabled_by_config".
	 */
	toSummary(input: {
		summaryId: string;
		sessionRef: string;
		workflowId: string;
		capturedAt: string;
		oiEnabled: boolean;
	}): FlowDeskOISessionSummaryResultV1;
}

// ─── Factory ─────────────────────────────────────────────────────────────────

/**
 * Create a fresh OI session accumulator with all counters at zero.
 * One accumulator instance should be created per agent task execution.
 */
export function createOISessionAccumulator(): FlowDeskOISessionAccumulatorV1 {
	let proposalsScored = 0;
	let reuseGatesChecked = 0;
	let fanoutGatesEvaluated = 0;
	let ledgerEntriesTotal = 0;

	return {
		get proposalsScored() {
			return proposalsScored;
		},
		get reuseGatesChecked() {
			return reuseGatesChecked;
		},
		get fanoutGatesEvaluated() {
			return fanoutGatesEvaluated;
		},
		get ledgerEntriesTotal() {
			return ledgerEntriesTotal;
		},

		increment(field) {
			if (field === "proposalsScored") proposalsScored++;
			else if (field === "reuseGatesChecked") reuseGatesChecked++;
			else if (field === "fanoutGatesEvaluated") fanoutGatesEvaluated++;
			else if (field === "ledgerEntriesTotal") ledgerEntriesTotal++;
		},

		toSummary(input) {
			const disabled = !input.oiEnabled;
			return createFlowDeskOISessionSummaryV1({
				summaryId: input.summaryId,
				sessionRef: input.sessionRef,
				workflowId: input.workflowId,
				proposalsScored: disabled ? 0 : proposalsScored,
				reuseGatesChecked: disabled ? 0 : reuseGatesChecked,
				fanoutGatesEvaluated: disabled ? 0 : fanoutGatesEvaluated,
				ledgerEntriesTotal: disabled ? 0 : ledgerEntriesTotal,
				advisoryHealthLabel: disabled ? "disabled_by_config" : "healthy",
				capturedAt: input.capturedAt,
				safeNextActions: ["flowdesk-status"],
			});
		},
	};
}

// ─── Reader ───────────────────────────────────────────────────────────────────

/**
 * Load up to `maxCount` most recent OI session summaries for a workflow.
 * Uses the session evidence reload path (validates shape before returning).
 * Returns summaries sorted by captured_at descending (newest first).
 *
 * This is a best-effort reader: if the rootDir is invalid or no summaries
 * exist, it returns an empty array without throwing.
 */
export async function loadRecentOISessionSummariesV1(input: {
	durableStateRoot: string;
	workflowId: string;
	/** Maximum number of summaries to return. Default 5, clamped to 1..50. */
	maxCount?: number;
}): Promise<FlowDeskOISessionSummaryV1[]> {
	const maxCount = Math.max(1, Math.min(50, input.maxCount ?? 5));

	let reloadResult: ReturnType<typeof reloadFlowDeskSessionEvidenceV1>;
	try {
		reloadResult = reloadFlowDeskSessionEvidenceV1({
			rootDir: input.durableStateRoot,
			workflowId: input.workflowId,
		});
	} catch {
		// Treat any unexpected reload error as "no summaries available".
		return [];
	}

	if (!reloadResult.ok && reloadResult.entries.length === 0) {
		return [];
	}

	const summaryEntries = reloadResult.entries.filter(
		(entry) => entry.evidenceClass === "oi_session_summary",
	);

	// Sort by captured_at descending (newest first); entries without a valid
	// timestamp sort to the end so they don't suppress newer valid ones.
	summaryEntries.sort((a, b) => {
		const aAt = typeof (a.record as Record<string, unknown>).captured_at === "string"
			? Date.parse((a.record as Record<string, unknown>).captured_at as string)
			: -Infinity;
		const bAt = typeof (b.record as Record<string, unknown>).captured_at === "string"
			? Date.parse((b.record as Record<string, unknown>).captured_at as string)
			: -Infinity;
		return bAt - aAt;
	});

	return summaryEntries
		.slice(0, maxCount)
		.map((entry) => entry.record as unknown as FlowDeskOISessionSummaryV1);
}
