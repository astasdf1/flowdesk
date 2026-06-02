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
	buckets?: readonly FlowDeskTuiUsageProviderBucketV1[];
}

export interface FlowDeskTuiUsageProviderBucketV1 {
	resetBucket?: string;
	resetTime?: string;
	remainingPercent: number | null;
	freshness: FlowDeskTuiUsageProviderRowV1["freshness"];
	dispatchability: FlowDeskTuiUsageProviderRowV1["dispatchability"];
	connected: boolean;
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

function remainingPercentFromUsageSnapshotRecord(record: Record<string, unknown>): number | null {
	const explicit = record.remaining_percent;
	if (typeof explicit === "number" && Number.isFinite(explicit)) return explicit;
	if (explicit === null) return null;
	return remainingPercentFromResetBucket(record.reset_bucket);
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

function bucketFromRow(row: FlowDeskTuiUsageProviderRowV1): FlowDeskTuiUsageProviderBucketV1 | undefined {
	if (row.resetBucket === undefined && row.resetTime === undefined && row.remainingPercent === null) return undefined;
	return {
		...(row.resetBucket === undefined ? {} : { resetBucket: row.resetBucket }),
		...(row.resetTime === undefined ? {} : { resetTime: row.resetTime }),
		remainingPercent: row.remainingPercent,
		freshness: row.freshness,
		dispatchability: row.dispatchability,
		connected: row.connected,
		...(row.usageSnapshotRef === undefined ? {} : { usageSnapshotRef: row.usageSnapshotRef }),
		...(row.secondsUntilReset === undefined ? {} : { secondsUntilReset: row.secondsUntilReset }),
		...(row.secondsSinceObserved === undefined ? {} : { secondsSinceObserved: row.secondsSinceObserved }),
	};
}

function bucketSortRank(value: string | undefined): number {
	if (value === undefined) return 99;
	const normalized = value.toLowerCase();
	if (normalized.includes("5h")) return 0;
	if (normalized.includes("weekly") || normalized.includes("1w") || normalized.includes("7d")) return 1;
	if (normalized.includes("daily")) return 2;
	return 10;
}

function canonicalResetBucketKey(value: unknown): string {
	if (typeof value !== "string") return "unknown";
	const normalized = value.toLowerCase().trim().replace(/^[0-9]+(?:\.[0-9]+)?%\s+/, "");
	if (normalized.length === 0) return "unknown";
	return normalized;
}

function rowFromBucketRows(
	family: FlowDeskTuiProviderFamilyV1,
	rows: readonly FlowDeskTuiUsageProviderRowV1[],
	nowMs: number,
): FlowDeskTuiUsageProviderRowV1 {
	if (rows.length === 0) return rowFromRecord(family, undefined, nowMs);
	const sorted = [...rows].sort((a, b) => {
		const byRank = bucketSortRank(a.resetBucket) - bucketSortRank(b.resetBucket);
		if (byRank !== 0) return byRank;
		return (a.resetBucket ?? "").localeCompare(b.resetBucket ?? "");
	});
	const buckets = sorted.map(bucketFromRow).filter((bucket): bucket is FlowDeskTuiUsageProviderBucketV1 => bucket !== undefined);
	const connectedBuckets = sorted.filter((row) => row.connected);
	const primary = connectedBuckets[0] ?? sorted[0] ?? rowFromRecord(family, undefined, nowMs);
	const percents = sorted.map((row) => row.remainingPercent).filter((value): value is number => value !== null);
	const remainingPercent = percents.length > 0 ? Math.min(...percents) : primary.remainingPercent;
	return {
		...primary,
		connected: connectedBuckets.length > 0,
		remainingPercent,
		alertLevel: alertLevelFor(primary.freshness, remainingPercent),
		...(buckets.length > 0 ? { buckets } : {}),
	};
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
	const remainingPercent = remainingPercentFromUsageSnapshotRecord(record);
	const row: FlowDeskTuiUsageProviderRowV1 = {
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
	const bucket = bucketFromRow(row);
	return bucket === undefined ? row : { ...row, buckets: [bucket] };
}

function bucketFromSidebarCacheRecord(
	record: Record<string, unknown>,
	nowMs: number,
	fallbackExpiresAtMs?: number,
	fallbackObservedAtMs?: number,
): FlowDeskTuiUsageProviderBucketV1 | undefined {
	const expiresAtMs = sidebarCacheTimestampMs(record, "expires_at", "expiresAt", fallbackExpiresAtMs);
	const observedAtMs = sidebarCacheTimestampMs(record, "observed_at", "observedAt", fallbackObservedAtMs);
	const forceStale = Number.isFinite(expiresAtMs) && expiresAtMs <= nowMs;
	const dispatchability =
		record.dispatchability === "dispatchable" ||
		record.dispatchability === "diagnostic_only" ||
		record.dispatchability === "non_dispatchable"
			? record.dispatchability
			: "non_dispatchable";
	const freshness = forceStale
		? "stale"
		: record.freshness === "fresh" || record.freshness === "stale" || record.freshness === "unknown"
			? record.freshness
			: "unknown";
	const remainingPercent =
		typeof record.remainingPercent === "number" && Number.isFinite(record.remainingPercent)
			? record.remainingPercent
			: null;
	const resetTime = typeof record.resetTime === "string" ? record.resetTime : undefined;
	const resetMs = resetTime === undefined ? Number.NaN : Date.parse(resetTime);
	if (typeof record.resetBucket !== "string" && resetTime === undefined && remainingPercent === null) return undefined;
	return {
		...(typeof record.resetBucket === "string" ? { resetBucket: record.resetBucket } : {}),
		...(resetTime === undefined ? {} : { resetTime }),
		remainingPercent,
		freshness,
		dispatchability,
		connected: forceStale ? false : record.connected === true,
		...(typeof record.usageSnapshotRef === "string" ? { usageSnapshotRef: record.usageSnapshotRef } : {}),
		...(Number.isFinite(resetMs)
			? { secondsUntilReset: Math.max(0, Math.floor((resetMs - nowMs) / 1000)) }
			: {}),
		...(Number.isFinite(observedAtMs)
			? { secondsSinceObserved: Math.max(0, Math.floor((nowMs - observedAtMs) / 1000)) }
			: {}),
	};
}

function sidebarCacheTimestampMs(
	record: Record<string, unknown>,
	snakeKey: string,
	camelKey: string,
	fallback?: number,
): number {
	const value =
		typeof record[snakeKey] === "string"
			? record[snakeKey]
			: typeof record[camelKey] === "string"
				? record[camelKey]
				: undefined;
	const parsed = value === undefined ? Number.NaN : Date.parse(value);
	if (Number.isFinite(parsed)) return parsed;
	return fallback ?? Number.NaN;
}

function rowFromSidebarCacheRecord(
	family: FlowDeskTuiProviderFamilyV1,
	record: Record<string, unknown> | undefined,
	nowMs: number,
	fallbackExpiresAtMs?: number,
	fallbackObservedAtMs?: number,
): FlowDeskTuiUsageProviderRowV1 {
	if (record === undefined) return rowFromRecord(family, undefined, nowMs);
	const expiresAtMs = sidebarCacheTimestampMs(record, "expires_at", "expiresAt", fallbackExpiresAtMs);
	const observedAtMs = sidebarCacheTimestampMs(record, "observed_at", "observedAt", fallbackObservedAtMs);
	const forceStale = Number.isFinite(expiresAtMs) && expiresAtMs <= nowMs;
	const dispatchability =
		record.dispatchability === "dispatchable" ||
		record.dispatchability === "diagnostic_only" ||
		record.dispatchability === "non_dispatchable"
			? record.dispatchability
			: "non_dispatchable";
	const freshness = forceStale
		? "stale"
		: record.freshness === "fresh" || record.freshness === "stale" || record.freshness === "unknown"
			? record.freshness
			: "unknown";
	const alertLevel = forceStale
		? "stale"
		: record.alertLevel === "ok" ||
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
	const row: FlowDeskTuiUsageProviderRowV1 = {
		providerFamily: family,
		connected: forceStale ? false : record.connected === true,
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
		...(Number.isFinite(observedAtMs)
			? { secondsSinceObserved: Math.max(0, Math.floor((nowMs - observedAtMs) / 1000)) }
			: {}),
	};
	const explicitBuckets = Array.isArray(record.buckets)
		? record.buckets
				.filter(isRecord)
				.map((bucket) => bucketFromSidebarCacheRecord(bucket, nowMs, expiresAtMs, observedAtMs))
				.filter((bucket): bucket is FlowDeskTuiUsageProviderBucketV1 => bucket !== undefined)
		: [];
	const fallbackBucket = bucketFromRow(row);
	const buckets = explicitBuckets.length > 0 ? explicitBuckets : fallbackBucket === undefined ? [] : [fallbackBucket];
	return buckets.length === 0 ? row : { ...row, buckets };
}

function loadSidebarCacheRows(
	rootDir: string,
	nowMs: number,
): { rows: readonly FlowDeskTuiUsageProviderRowV1[]; stale: boolean } | undefined {
	try {
		const cache = JSON.parse(
			readFileSync(join(rootDir, ".flowdesk", "ui", "provider-usage-sidebar.json"), "utf8"),
		) as unknown;
		if (!isRecord(cache) || cache.schema_version !== "flowdesk.provider_usage_sidebar_cache.v1") return undefined;
		const topLevelExpiresAtMs = typeof cache.expires_at === "string" ? Date.parse(cache.expires_at) : Number.NaN;
		const topLevelObservedAtMs = typeof cache.observed_at === "string" ? Date.parse(cache.observed_at) : Number.NaN;
		if (!Array.isArray(cache.providers)) return undefined;
		const byFamily = new Map<FlowDeskTuiProviderFamilyV1, Record<string, unknown>>();
		for (const row of cache.providers) {
			if (!isRecord(row) || !isProviderFamily(row.providerFamily)) continue;
			byFamily.set(row.providerFamily, row);
		}
		if (byFamily.size === 0) return undefined;
		const rows = providerFamilies.map((family) =>
			rowFromSidebarCacheRecord(family, byFamily.get(family), nowMs, topLevelExpiresAtMs, topLevelObservedAtMs),
		);
		const stale = rows.some(
			(row) => row.freshness === "stale" || (row.buckets ?? []).some((bucket) => bucket.freshness === "stale"),
		);
		return { rows, stale };
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
	const sidebarCache = loadSidebarCacheRows(rootDir, nowMs);
	if (sidebarCache !== undefined) {
		return {
			status: "loaded",
			observedAt,
			rootDir,
			workflowId,
			providers: sidebarCache.rows,
			...(sidebarCache.stale ? { redactedReason: "provider usage sidebar cache is stale" } : {}),
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
		const byFamilyBucket = new Map<FlowDeskTuiProviderFamilyV1, Map<string, Record<string, unknown>>>();
		for (const name of readdirSync(evidenceDir)) {
			if (!name.endsWith(".json")) continue;
			const record = JSON.parse(readFileSync(join(evidenceDir, name), "utf8")) as unknown;
			if (!isRecord(record) || record.schema_version !== "flowdesk.usage_snapshot.v1") continue;
			if (!isProviderFamily(record.provider_family)) continue;
			const bucketKey = canonicalResetBucketKey(record.reset_bucket);
			const familyRows = byFamilyBucket.get(record.provider_family) ?? new Map<string, Record<string, unknown>>();
			const previous = familyRows.get(bucketKey);
			const previousMs = timestampFromUsageSnapshotId(previous?.snapshot_id);
			const currentMs = timestampFromUsageSnapshotId(record.snapshot_id);
			if (previous === undefined || (currentMs ?? 0) >= (previousMs ?? 0)) {
				familyRows.set(bucketKey, record);
				byFamilyBucket.set(record.provider_family, familyRows);
			}
		}
		const providers = providerFamilies.map((family) =>
			rowFromBucketRows(
				family,
				[...(byFamilyBucket.get(family)?.values() ?? [])].map((record) => rowFromRecord(family, record, nowMs)),
				nowMs,
			),
		);
		const loadedCount = [...byFamilyBucket.values()].reduce((total, rows) => total + rows.size, 0);
		return {
			status: loadedCount === 0 ? "missing" : "loaded",
			observedAt,
			rootDir,
			workflowId,
			providers,
			...(loadedCount === 0 ? { redactedReason: "no provider usage snapshots found" } : {}),
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

function displayResetTime(value: string | undefined, label: "5h" | "1w" | string): string {
	if (value === undefined) return "?";
	const parsed = Date.parse(value);
	if (!Number.isFinite(parsed)) return value;
	const date = new Date(parsed);
	const hh = String(date.getHours()).padStart(2, "0");
	const mm = String(date.getMinutes()).padStart(2, "0");
	if (label === "5h") return `${hh}:${mm}`;
	const month = String(date.getMonth() + 1).padStart(2, "0");
	const day = String(date.getDate()).padStart(2, "0");
	return `${month}-${day} ${hh}:${mm}`;
}

function compactPercent(value: number | null): string {
	return value === null ? "?" : `${Math.round(value)}%`;
}

function compactBucketSegment(bucket: FlowDeskTuiUsageProviderBucketV1 | undefined, label: "5h" | "1w"): string {
	return `${compactPercent(bucket?.remainingPercent ?? null)} (${label}, r ${displayResetTime(bucket?.resetTime, label)})`;
}

function compactNamedBucketSegment(bucket: FlowDeskTuiUsageProviderBucketV1 | undefined, label: string): string {
	return `${compactPercent(bucket?.remainingPercent ?? null)} (${label}, r ${displayResetTime(bucket?.resetTime, label)})`;
}

function bucketWindowDurationMs(bucket: FlowDeskTuiUsageProviderBucketV1 | undefined, fallbackLabel: string): number | undefined {
	const resetBucket = bucket?.resetBucket?.toLowerCase() ?? "";
	const label = fallbackLabel.toLowerCase();
	if (resetBucket.includes("5h") || label === "5h") return 5 * 60 * 60 * 1000;
	if (resetBucket.includes("daily") || resetBucket.includes("day") || label === "day") return 24 * 60 * 60 * 1000;
	if (resetBucket.includes("weekly") || resetBucket.includes("1w") || resetBucket.includes("7d") || label === "1w") return 7 * 24 * 60 * 60 * 1000;
	return undefined;
}

function bucketQuotaHealth(
	bucket: FlowDeskTuiUsageProviderBucketV1 | undefined,
	label: string,
	nowMs: number,
): number | undefined {
	if (bucket === undefined) return undefined;
	if (bucket.freshness !== "fresh") return Number.NEGATIVE_INFINITY;
	if (bucket.remainingPercent === null || !Number.isFinite(bucket.remainingPercent)) return Number.NEGATIVE_INFINITY;
	if (bucket.remainingPercent < 0 || bucket.remainingPercent > 100) return Number.NEGATIVE_INFINITY;
	const durationMs = bucketWindowDurationMs(bucket, label);
	if (durationMs === undefined || durationMs <= 0) return Number.NEGATIVE_INFINITY;
	let remainingMs: number | undefined;
	if (typeof bucket.secondsUntilReset === "number" && Number.isFinite(bucket.secondsUntilReset)) {
		remainingMs = bucket.secondsUntilReset * 1000;
	} else if (bucket.resetTime !== undefined) {
		const parsed = Date.parse(bucket.resetTime);
		remainingMs = Number.isFinite(parsed) ? parsed - nowMs : undefined;
	}
	if (remainingMs === undefined || !Number.isFinite(remainingMs)) return Number.NEGATIVE_INFINITY;
	if (remainingMs < -60_000) return Number.NEGATIVE_INFINITY;
	if (remainingMs > durationMs + 5 * 60_000) return Number.NEGATIVE_INFINITY;
	const timeRemainingFraction = Math.max(0, Math.min(1, remainingMs / durationMs));
	const remainingFraction = Math.max(0, Math.min(1, bucket.remainingPercent / 100));
	return remainingFraction - timeRemainingFraction;
}

/** Pick the bucket with the lower period-normalized quota health; display stays unchanged. */
function lowerBucket(
	fiveHour: FlowDeskTuiUsageProviderBucketV1 | undefined,
	weekly: FlowDeskTuiUsageProviderBucketV1 | undefined,
	nowMs: number,
): { bucket: FlowDeskTuiUsageProviderBucketV1 | undefined; label: string } {
	const fiveHourPct = fiveHour?.remainingPercent ?? null;
	const weeklyPct = weekly?.remainingPercent ?? null;
	const fiveHourHealth = bucketQuotaHealth(fiveHour, "5h", nowMs);
	const weeklyHealth = bucketQuotaHealth(weekly, "1w", nowMs);
	if (fiveHourHealth !== undefined && weeklyHealth !== undefined && fiveHourHealth !== weeklyHealth) {
		return weeklyHealth < fiveHourHealth ? { bucket: weekly, label: "1w" } : { bucket: fiveHour, label: "5h" };
	}
	if (fiveHourHealth === undefined && weeklyHealth !== undefined) return { bucket: weekly, label: "1w" };
	if (weeklyHealth === undefined && fiveHourHealth !== undefined) return { bucket: fiveHour, label: "5h" };
	if (fiveHourPct === null && weeklyPct === null) return { bucket: fiveHour ?? weekly, label: fiveHour !== undefined ? "5h" : "1w" };
	if (fiveHourPct === null) return { bucket: weekly, label: "1w" };
	if (weeklyPct === null) return { bucket: fiveHour, label: "5h" };
	return weeklyPct <= fiveHourPct ? { bucket: weekly, label: "1w" } : { bucket: fiveHour, label: "5h" };
}

function modelLine(prefix: string, modelLabel: string, bucket: FlowDeskTuiUsageProviderBucketV1 | undefined, periodLabel: string): string {
	const pct = compactPercent(bucket?.remainingPercent ?? null).padStart(4);
	return `${prefix} ${modelLabel.padEnd(6)} ${pct} (${periodLabel}, r ${displayResetTime(bucket?.resetTime, periodLabel)})`;
}

function bucketForCompactLabel(
	provider: FlowDeskTuiUsageProviderRowV1,
	label: "5h" | "1w",
): FlowDeskTuiUsageProviderBucketV1 | undefined {
	const buckets = provider.buckets ?? [];
	return buckets.find((bucket) => {
		const resetBucket = bucket.resetBucket?.toLowerCase() ?? "";
		return label === "5h"
			? resetBucket.includes("5h")
			: resetBucket.includes("weekly") || resetBucket.includes("1w") || resetBucket.includes("7d");
	});
}

function bucketForResetBucketPrefix(
	provider: FlowDeskTuiUsageProviderRowV1,
	prefix: string,
): FlowDeskTuiUsageProviderBucketV1 | undefined {
	const normalizedPrefix = prefix.toLowerCase();
	return (provider.buckets ?? []).find((bucket) => {
		const resetBucket = bucket.resetBucket?.toLowerCase().replace(/^[0-9]+(?:\.[0-9]+)?%\s+/, "") ?? "";
		return resetBucket.startsWith(normalizedPrefix);
	});
}

const compactProviderLabels = {
	claude: "CL",
	openai: "OA",
	gemini: "GM",
} as const;

export function formatFlowDeskTuiUsageSnapshotCompactLines(
	view: FlowDeskTuiUsageSnapshotViewV1,
): string[] {
	const lines: string[] = [];
	const nowMs = Date.parse(view.observedAt);
	for (const family of providerFamilies) {
		const provider = view.providers.find((candidate) => candidate.providerFamily === family);
		const label = compactProviderLabels[family];
		const hasKnownBuckets = (provider?.buckets ?? []).some((bucket) => bucket.remainingPercent !== null || bucket.resetTime !== undefined);
		if (provider === undefined || (provider.connected !== true && !hasKnownBuckets)) {
			lines.push(`${label} ✗`);
			continue;
		}

		if (family === "claude") {
			const fiveHour = bucketForCompactLabel(provider, "5h") ?? (provider.resetBucket?.includes("5h") ? bucketFromRow(provider) : undefined);
			const weekly = bucketForCompactLabel(provider, "1w");
			const { bucket, label: periodLabel } = lowerBucket(fiveHour, weekly, nowMs);
			lines.push(modelLine(label, "Sonnet", bucket, periodLabel));
			continue;
		}

		if (family === "openai") {
			const gpt5h = bucketForResetBucketPrefix(provider, "openai-gpt-5h") ?? bucketForCompactLabel(provider, "5h") ?? (provider.resetBucket?.includes("5h") ? bucketFromRow(provider) : undefined);
			const weekly = bucketForCompactLabel(provider, "1w");
			const { bucket: gptBucket, label: gptPeriod } = lowerBucket(gpt5h, weekly, nowMs);
			lines.push(modelLine(label, "5.5", gptBucket, gptPeriod));
			const spark = bucketForResetBucketPrefix(provider, "openai-spark") ?? bucketForResetBucketPrefix(provider, "openai-5.3") ?? bucketForResetBucketPrefix(provider, "spark");
			if (spark !== undefined) {
				lines.push(modelLine(label, "Spark", spark, spark.resetBucket?.includes("weekly") ? "1w" : "5h"));
			}
			continue;
		}

		if (family === "gemini") {
			const pro = bucketForResetBucketPrefix(provider, "gemini-pro-daily") ?? bucketForResetBucketPrefix(provider, "gemini-pro");
			const flash = bucketForResetBucketPrefix(provider, "gemini-flash-daily");
			const lite = bucketForResetBucketPrefix(provider, "gemini-flash-lite-daily");
			lines.push(modelLine(label, "Pro", pro, "day"));
			lines.push(modelLine(label, "Flash", flash, "day"));
			lines.push(modelLine(label, "Lite", lite, "day"));
			continue;
		}

		// Fallback for unknown families
		const fiveHour = bucketForCompactLabel(provider, "5h") ?? (provider.resetBucket?.includes("5h") ? bucketFromRow(provider) : undefined);
		const weekly = bucketForCompactLabel(provider, "1w");
		const { bucket, label: periodLabel } = lowerBucket(fiveHour, weekly, nowMs);
		lines.push(modelLine(label, "?", bucket, periodLabel));
	}
	return lines;
}

export function formatFlowDeskTuiUsageSnapshotCompactText(
	view: FlowDeskTuiUsageSnapshotViewV1,
): string {
	return formatFlowDeskTuiUsageSnapshotCompactLines(view).join("\n");
}
