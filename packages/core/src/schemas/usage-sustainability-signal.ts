/**
 * Usage sustainability signal contracts.
 *
 * This signal is intentionally independent from FlowDeskScoringEngineInputV1:
 * quota governance produces/owns the signal, while scoring may consume it as a
 * bounded advisory input without gaining dispatch, fallback, or provider authority.
 */

export type FlowDeskUsageResetWindowKindV1 = "5h" | "daily" | "weekly" | "unknown";

export type FlowDeskUsageSustainabilityUncertaintyV1 = "confident" | "stale" | "unknown";

export interface FlowDeskUsageSustainabilitySignalV1 {
	reset_window_kind: FlowDeskUsageResetWindowKindV1;
	remaining_percent: number;
	elapsed_percent: number;
	uncertainty: FlowDeskUsageSustainabilityUncertaintyV1;
}
