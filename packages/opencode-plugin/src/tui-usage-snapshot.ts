import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

export type FlowDeskTuiProviderFamilyV1 = "claude" | "openai" | "gemini";
export type FlowDeskTuiAlertLevelV1 =
	| "ok"
	| "warning"
	| "critical"
	| "exhausted"
	| "stale"
	| "unknown";

export interface FlowDeskTuiUsageProviderRowV1 {
	providerFamily: FlowDeskTuiProviderFamilyV1;
	connected: boolean;
	dispatchability: "dispatchable" | "diagnostic_only" | "non_dispatchable";
	freshness: "fresh" | "stale" | "unknown";
	resetBucket?: string;
	resetTime?: string;
	remainingPercent: number | null;
	alertLevel: FlowDeskTuiAlertLevelV1;
	usageSnapshotRef?: string;
	secondsUntilReset?: number;
	secondsSinceObserved?: number;
}

export interface FlowDeskTuiUsageSnapshotViewV1 {
	status: "loaded" | "missing" | "blocked";
	observedAt: string;
	rootDir: string;
	workflowId: string;
	providers: readonly FlowDeskTuiUsageProviderRowV1[];
	redactedReason?: string;
	safeNextActions: readonly ("/flowdesk-usage" | "/flowdesk-status" | "/flowdesk-doctor")[];
}

const providerFamilies: readonly FlowDeskTuiProviderFamilyV1[] = [
	"claude",
	"openai",
	"gemini",
];

function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isProviderFamily(value: unknown): value is FlowDeskTuiProviderFamilyV1 {
	return typeof value === "string" && providerFamilies.includes(value as FlowDeskTuiProviderFamilyV1);
}

function safeRootDir(value: string | undefined): string {
	if (typeof value === "string" && value.trim().length > 0) return value;
	const home = process.env.HOME;
	return typeof home === "string" && home.length > 0 ? join(home, ".flowdesk") : ".flowdesk";
}

function safeWorkflowId(value: string | undefined): string {
	return typeof value === "string" && /^[A-Za-z0-9_-]+$/.test(value)
		? value
		: "workflow-provider-usage-live";
}

function timestampFromUsageSnapshotId(value: unknown): number | undefined {
	if (typeof value !== "string") return undefined;
	const match = /(\d{8}T\d{9}Z)$/.exec(value);
	if (match === null) return undefined;
	const stamp = match[1];
	const iso = `${stamp.slice(0, 4)}-${stamp.slice(4, 6)}-${stamp.slice(6, 8)}T${stamp.slice(9, 11)}:${stamp.slice(11, 13)}:${stamp.slice(13, 15)}.${stamp.slice(15, 18)}Z`;
	const parsed = Date.parse(iso);
	return Number.isFinite(parsed) ? parsed : undefined;
}

function remainingPercentFromResetBucket(value: unknown): number | null {
	if (typeof value !== "string") return null;
	const match = /^([0-9]+(?:\.[0-9]+)?)%/.exec(value);
	if (match === null) return null;
	const parsed = Number.parseFloat(match[1]);
	return Number.isFinite(parsed) ? parsed : null;
}

function alertLevelFor(
	freshness: FlowDeskTuiUsageProviderRowV1["freshness"],
	remainingPercent: number | null,
): FlowDeskTuiAlertLevelV1 {
	if (freshness !== "fresh") return freshness === "stale" ? "stale" : "unknown";
	if (remainingPercent === null) return "unknown";
	if (remainingPercent <= 0) return "exhausted";
	if (remainingPercent <= 10) return "critical";
	if (remainingPercent <= 30) return "warning";
	return "ok";
}

function rowFromRecord(
	family: FlowDeskTuiProviderFamilyV1,
	record: Record<string, unknown> | undefined,
	nowMs: number,
): FlowDeskTuiUsageProviderRowV1 {
	if (record === undefined) {
		return {
			providerFamily: family,
			connected: false,
			dispatchability: "non_dispatchable",
			freshness: "unknown",
			remainingPercent: null,
			alertLevel: "unknown",
		};
	}
	const dispatchability =
		record.dispatchability === "dispatchable" ||
		record.dispatchability === "diagnostic_only" ||
		record.dispatchability === "non_dispatchable"
			? record.dispatchability
			: "non_dispatchable";
	const freshness =
		record.freshness === "fresh" || record.freshness === "stale" || record.freshness === "unknown"
			? record.freshness
			: "unknown";
	const resetTime = typeof record.reset_time === "string" ? record.reset_time : undefined;
	const resetMs = resetTime === undefined ? Number.NaN : Date.parse(resetTime);
	const observedMs = timestampFromUsageSnapshotId(record.snapshot_id);
	const remainingPercent = remainingPercentFromResetBucket(record.reset_bucket);
	return {
		providerFamily: family,
		connected: dispatchability === "dispatchable" && freshness === "fresh",
		dispatchability,
		freshness,
		...(typeof record.reset_bucket === "string" ? { resetBucket: record.reset_bucket } : {}),
		...(resetTime === undefined ? {} : { resetTime }),
		remainingPercent,
		alertLevel: alertLevelFor(freshness, remainingPercent),
		...(typeof record.snapshot_id === "string" ? { usageSnapshotRef: record.snapshot_id } : {}),
		...(Number.isFinite(resetMs)
			? { secondsUntilReset: Math.max(0, Math.floor((resetMs - nowMs) / 1000)) }
			: {}),
		...(observedMs === undefined
			? {}
			: { secondsSinceObserved: Math.max(0, Math.floor((nowMs - observedMs) / 1000)) }),
	};
}

function rowFromSidebarCacheRecord(
	family: FlowDeskTuiProviderFamilyV1,
	record: Record<string, unknown> | undefined,
	nowMs: number,
): FlowDeskTuiUsageProviderRowV1 {
	if (record === undefined) return rowFromRecord(family, undefined, nowMs);
	const dispatchability =
		record.dispatchability === "dispatchable" ||
		record.dispatchability === "diagnostic_only" ||
		record.dispatchability === "non_dispatchable"
			? record.dispatchability
			: "non_dispatchable";
	const freshness =
		record.freshness === "fresh" || record.freshness === "stale" || record.freshness === "unknown"
			? record.freshness
			: "unknown";
	const alertLevel =
		record.alertLevel === "ok" ||
		record.alertLevel === "warning" ||
		record.alertLevel === "critical" ||
		record.alertLevel === "exhausted" ||
		record.alertLevel === "stale" ||
		record.alertLevel === "unknown"
			? record.alertLevel
			: "unknown";
	const remainingPercent =
		typeof record.remainingPercent === "number" && Number.isFinite(record.remainingPercent)
			? record.remainingPercent
			: null;
	const resetTime = typeof record.resetTime === "string" ? record.resetTime : undefined;
	const resetMs = resetTime === undefined ? Number.NaN : Date.parse(resetTime);
	return {
		providerFamily: family,
		connected: record.connected === true,
		dispatchability,
		freshness,
		...(typeof record.resetBucket === "string" ? { resetBucket: record.resetBucket } : {}),
		...(resetTime === undefined ? {} : { resetTime }),
		remainingPercent,
		alertLevel,
		...(typeof record.usageSnapshotRef === "string" ? { usageSnapshotRef: record.usageSnapshotRef } : {}),
		...(Number.isFinite(resetMs)
			? { secondsUntilReset: Math.max(0, Math.floor((resetMs - nowMs) / 1000)) }
			: {}),
	};
}

function loadSidebarCacheRows(
	rootDir: string,
	nowMs: number,
): readonly FlowDeskTuiUsageProviderRowV1[] | undefined {
	try {
		const cache = JSON.parse(
			readFileSync(join(rootDir, ".flowdesk", "ui", "provider-usage-sidebar.json"), "utf8"),
		) as unknown;
		if (!isRecord(cache) || cache.schema_version !== "flowdesk.provider_usage_sidebar_cache.v1") return undefined;
		if (!Array.isArray(cache.providers)) return undefined;
		const byFamily = new Map<FlowDeskTuiProviderFamilyV1, Record<string, unknown>>();
		for (const row of cache.providers) {
			if (!isRecord(row) || !isProviderFamily(row.providerFamily)) continue;
			byFamily.set(row.providerFamily, row);
		}
		if (byFamily.size === 0) return undefined;
		return providerFamilies.map((family) =>
			rowFromSidebarCacheRecord(family, byFamily.get(family), nowMs),
		);
	} catch {
		return undefined;
	}
}

export function loadFlowDeskTuiUsageSnapshotViewV1(input: {
	rootDir?: string;
	workflowId?: string;
	now?: () => Date;
} = {}): FlowDeskTuiUsageSnapshotViewV1 {
	const observedAt = (input.now ? input.now() : new Date()).toISOString();
	const nowMs = Date.parse(observedAt);
	const rootDir = safeRootDir(input.rootDir);
	const workflowId = safeWorkflowId(input.workflowId);
	const sidebarRows = loadSidebarCacheRows(rootDir, nowMs);
	if (sidebarRows !== undefined) {
		return {
			status: "loaded",
			observedAt,
			rootDir,
			workflowId,
			providers: sidebarRows,
			safeNextActions: ["/flowdesk-usage", "/flowdesk-status", "/flowdesk-doctor"],
		};
	}
	const evidenceDir = join(
		rootDir,
		".flowdesk",
		"sessions",
		workflowId,
		"evidence",
		"provider-usage-snapshot",
	);
	try {
		const byFamily = new Map<FlowDeskTuiProviderFamilyV1, Record<string, unknown>>();
		for (const name of readdirSync(evidenceDir)) {
			if (!name.endsWith(".json")) continue;
			const record = JSON.parse(readFileSync(join(evidenceDir, name), "utf8")) as unknown;
			if (!isRecord(record) || record.schema_version !== "flowdesk.usage_snapshot.v1") continue;
			if (!isProviderFamily(record.provider_family)) continue;
			const previous = byFamily.get(record.provider_family);
			const previousMs = timestampFromUsageSnapshotId(previous?.snapshot_id);
			const currentMs = timestampFromUsageSnapshotId(record.snapshot_id);
			if (previous === undefined || (currentMs ?? 0) >= (previousMs ?? 0)) {
				byFamily.set(record.provider_family, record);
			}
		}
		const providers = providerFamilies.map((family) =>
			rowFromRecord(family, byFamily.get(family), nowMs),
		);
		return {
			status: byFamily.size === 0 ? "missing" : "loaded",
			observedAt,
			rootDir,
			workflowId,
			providers,
			...(byFamily.size === 0 ? { redactedReason: "no provider usage snapshots found" } : {}),
			safeNextActions: ["/flowdesk-usage", "/flowdesk-status", "/flowdesk-doctor"],
		};
	} catch {
		return {
			status: "blocked",
			observedAt,
			rootDir,
			workflowId,
			providers: providerFamilies.map((family) => rowFromRecord(family, undefined, nowMs)),
			redactedReason: "provider usage snapshot cache is unavailable",
			safeNextActions: ["/flowdesk-usage", "/flowdesk-status", "/flowdesk-doctor"],
		};
	}
}
