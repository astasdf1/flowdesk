import type { FlowDeskProviderUsageCollectorResultV1 } from "./provider-usage-collector.js";

// Usage bridge: map OpenCode-track live collector results into the strict
// allowlist snapshot the Omnigent selector consumes via
// FLOWDESK_OMNIGENT_PROVIDER_USAGE_JSON / FLOWDESK_OMNIGENT_PROVIDER_USAGE_PATH.
// The Python parser (flowdesk_omnigent.selection._normalize_provider_usage_snapshot)
// fails closed on ANY unknown key, out-of-enum alert level, out-of-range
// remaining_percent, or string longer than 120 chars — so this builder emits
// only allowlisted fields and mirrors those bounds exactly. Advisory input
// only: it grants no dispatch/fallback/retry authority.

export const FLOWDESK_OMNIGENT_USAGE_INPUT_SCHEMA_VERSION_V1 = "flowdesk.omnigent_provider_usage_input.v1" as const;

export type FlowDeskOmnigentUsageBridgeFamilyV1 = "claude" | "openai" | "gemini";
export type FlowDeskOmnigentUsageBridgeAlertLevelV1 =
	| "ok"
	| "warning"
	| "critical"
	| "exhausted"
	| "stale"
	| "unknown";

export interface FlowDeskOmnigentUsageBridgeRowV1 {
	alert_level: FlowDeskOmnigentUsageBridgeAlertLevelV1;
	remaining_percent?: number;
	reset_time?: string;
}

export interface FlowDeskOmnigentUsageBridgeSnapshotV1 {
	schema_version: typeof FLOWDESK_OMNIGENT_USAGE_INPUT_SCHEMA_VERSION_V1;
	captured_at: string;
	source: string;
	claude?: FlowDeskOmnigentUsageBridgeRowV1;
	openai?: FlowDeskOmnigentUsageBridgeRowV1;
	gemini?: FlowDeskOmnigentUsageBridgeRowV1;
}

export interface FlowDeskOmnigentUsageBridgeInputV1 {
	family: FlowDeskOmnigentUsageBridgeFamilyV1;
	result: FlowDeskProviderUsageCollectorResultV1 | undefined;
}

const MAX_SNAPSHOT_STRING_LENGTH = 120;

function boundedString(value: string): string {
	return value.length > MAX_SNAPSHOT_STRING_LENGTH ? value.slice(0, MAX_SNAPSHOT_STRING_LENGTH) : value;
}

// Same thresholds as the OpenCode provider-usage live tool's classifyAlert:
// <=0 exhausted, <=10 critical, <=30 warning, else ok.
function alertLevelForRemaining(remaining: number): FlowDeskOmnigentUsageBridgeAlertLevelV1 {
	if (remaining <= 0) return "exhausted";
	if (remaining <= 10) return "critical";
	if (remaining <= 30) return "warning";
	return "ok";
}

export function buildFlowDeskOmnigentUsageBridgeRowV1(
	result: FlowDeskProviderUsageCollectorResultV1 | undefined,
): FlowDeskOmnigentUsageBridgeRowV1 {
	const bucket = result?.bucketSnapshot;
	if (result === undefined || bucket === undefined) return { alert_level: "unknown" };
	if (bucket.uncertainty === "stale") {
		const row: FlowDeskOmnigentUsageBridgeRowV1 = { alert_level: "stale" };
		if (bucket.resetAt !== undefined) row.reset_time = boundedString(bucket.resetAt);
		return row;
	}
	if (bucket.uncertainty !== "available" || bucket.remainingPercent === null) {
		// insufficient / unknown / provider_refused, or no usable number: the
		// selector treats "unknown" as non-blocking by default, which matches
		// the advisory-only stance — never fabricate a number here.
		return { alert_level: "unknown" };
	}
	const remaining = Math.min(100, Math.max(0, bucket.remainingPercent));
	const row: FlowDeskOmnigentUsageBridgeRowV1 = {
		alert_level: alertLevelForRemaining(remaining),
		remaining_percent: remaining,
	};
	if (bucket.resetAt !== undefined) row.reset_time = boundedString(bucket.resetAt);
	return row;
}

export function buildFlowDeskOmnigentUsageBridgeSnapshotV1(
	inputs: readonly FlowDeskOmnigentUsageBridgeInputV1[],
	options: { capturedAt: string; source?: string },
): FlowDeskOmnigentUsageBridgeSnapshotV1 {
	const snapshot: FlowDeskOmnigentUsageBridgeSnapshotV1 = {
		schema_version: FLOWDESK_OMNIGENT_USAGE_INPUT_SCHEMA_VERSION_V1,
		captured_at: boundedString(options.capturedAt),
		source: boundedString(options.source ?? "flowdesk-opencode-usage-collector"),
	};
	for (const input of inputs) {
		snapshot[input.family] = buildFlowDeskOmnigentUsageBridgeRowV1(input.result);
	}
	return snapshot;
}
