import { execFileSync } from "node:child_process";
import { mkdirSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import { join, resolve, sep } from "node:path";
import {
	type FlowDeskProviderUsageAcquisitionConfigV1,
	type FlowDeskProviderUsageCollectorOptionsV1,
	type FlowDeskProviderUsageCollectorResultV1,
	type FlowDeskProviderUsageCollectorTargetV1,
	applyFlowDeskSessionEvidenceWriteIntentsV1,
	collectManagedDispatchBetaUsageEvidenceV1,
	prepareFlowDeskSessionEvidenceWriteIntentV1,
	reloadFlowDeskSessionEvidenceV1,
	type FlowDeskSessionEvidenceReloadEntryV1,
	type FlowDeskUsageSnapshotV1,
} from "@flowdesk/core";

const defaultExecFile = (file: string, args: string[]): string =>
	execFileSync(file, args, {
		encoding: "utf-8",
		stdio: ["ignore", "pipe", "ignore"],
	});

export type FlowDeskProviderUsageLiveProviderFamilyV1 =
	| "claude"
	| "openai"
	| "gemini";

export interface FlowDeskProviderUsageLiveConfigV1 {
	homeDir?: string;
	providers?: readonly FlowDeskProviderUsageLiveProviderFamilyV1[];
	claudeOAuthUsage?: boolean;
	codexLiveUsage?: boolean;
	geminiQuota?: boolean;
	geminiOAuthClientId?: string;
	geminiOAuthClientSecret?: string;
	geminiProjectId?: string;
	persistSnapshots?: boolean;
	persistSidebarCache?: boolean;
	durableStateRootDir?: string;
	persistWorkflowId?: string;
	appendToChat?: boolean;
}

export interface FlowDeskProviderUsageLiveRequestV1 {
	providerFamily?: string;
}

export type FlowDeskProviderUsageLiveAlertLevelV1 =
	| "ok"
	| "warning"
	| "critical"
	| "exhausted"
	| "stale"
	| "unknown";

export interface FlowDeskProviderUsageLiveProviderRowV1 {
	providerFamily: FlowDeskProviderUsageLiveProviderFamilyV1;
	ok: boolean;
	dispatchability: "dispatchable" | "diagnostic_only" | "non_dispatchable";
	freshness: "fresh" | "stale" | "unknown";
	resetBucket?: string;
	resetTime?: string;
	remainingPercent: number | null;
	alertLevel: FlowDeskProviderUsageLiveAlertLevelV1;
	recommendation: string;
	uncertaintyFlags: readonly string[];
	modelFamily?: string;
	redactedReason?: string;
	usageSnapshotRef?: string;
	providerHealthSnapshotRef?: string;
	usageAuthorityAcquired: boolean;
}

export interface FlowDeskProviderUsageLiveSnapshotPersistenceV1 {
	requested: boolean;
	durableStateRootConfigured: boolean;
	workflowId?: string;
	persistedEvidenceIds: readonly string[];
	skippedReasons: readonly string[];
}

export interface FlowDeskProviderUsageLiveSnapshotReuseV1 {
	requested: boolean;
	durableStateRootConfigured: boolean;
	workflowId?: string;
	reusedEvidenceIds: readonly string[];
	skippedReasons: readonly string[];
}

export interface FlowDeskProviderUsageLiveSidebarCachePersistenceV1 {
	requested: boolean;
	durableStateRootConfigured: boolean;
	cachePathRef?: string;
	persisted: boolean;
	skippedReasons: readonly string[];
}

export interface FlowDeskProviderUsageLiveResultV1 {
	status:
		| "provider_usage_live_collected"
		| "blocked_before_provider_usage_live";
	observedAt: string;
	requestedProviderFamily: string;
	resolvedProviderFamilies: readonly FlowDeskProviderUsageLiveProviderFamilyV1[];
	providers: readonly FlowDeskProviderUsageLiveProviderRowV1[];
	worstAlertLevel: FlowDeskProviderUsageLiveAlertLevelV1;
	overallRecommendation: string;
	redactedBlockReason?: string;
	snapshotReuse?: FlowDeskProviderUsageLiveSnapshotReuseV1;
	snapshotPersistence?: FlowDeskProviderUsageLiveSnapshotPersistenceV1;
	sidebarCachePersistence?: FlowDeskProviderUsageLiveSidebarCachePersistenceV1;
	safeNextActions: readonly ("/flowdesk-doctor" | "/flowdesk-status")[];
	authority: {
		realOpenCodeDispatch: false;
		providerCall: false;
		runtimeExecution: false;
		actualLaneLaunch: false;
		fallbackAuthority: false;
		hardCancelOrNoReplyAuthority: false;
		toolAuthority: false;
		providerUsageAcquired: boolean;
	};
}

const allProviderFamilies: readonly FlowDeskProviderUsageLiveProviderFamilyV1[] =
	["claude", "openai", "gemini"];

function isProviderFamily(
	value: string,
): value is FlowDeskProviderUsageLiveProviderFamilyV1 {
	return (allProviderFamilies as readonly string[]).includes(value);
}

function modelFamilyDefault(
	family: FlowDeskProviderUsageLiveProviderFamilyV1,
): string {
	if (family === "openai") return "gpt-5";
	if (family === "gemini") return "gemini-pro";
	return "sonnet-4";
}

function targetFor(
	family: FlowDeskProviderUsageLiveProviderFamilyV1,
	observedAt: string,
): FlowDeskProviderUsageCollectorTargetV1 {
	const modelFamily = modelFamilyDefault(family);
	const safeStamp = observedAt.replace(/[^0-9A-Za-z]/g, "");
	return {
		providerFamily: family,
		providerQualifiedModelId: `${family}/${modelFamily}`,
		modelFamily,
		usageSnapshotId: `usage-live-${family}-${safeStamp}`,
		authorityRef: `usage-live-authority-${family}-${safeStamp}`,
		sourceRef: `usage-live-source-${family}-${safeStamp}`,
		conformanceRef: `usage-live-conformance-${family}-${safeStamp}`,
		redactedEvidenceRefs: [`usage-live-evidence-${family}-${safeStamp}`],
		observedAt,
		freshnessTtlMinutes: 5,
	};
}

function blockedAuthority() {
	return {
		realOpenCodeDispatch: false as const,
		providerCall: false as const,
		runtimeExecution: false as const,
		actualLaneLaunch: false as const,
		fallbackAuthority: false as const,
		hardCancelOrNoReplyAuthority: false as const,
		toolAuthority: false as const,
		providerUsageAcquired: false,
	};
}

function safeNextActions(): readonly (
	| "/flowdesk-doctor"
	| "/flowdesk-status"
)[] {
	return ["/flowdesk-doctor", "/flowdesk-status"];
}

function acquisitionConfigFromLive(
	config: FlowDeskProviderUsageLiveConfigV1,
	families: readonly FlowDeskProviderUsageLiveProviderFamilyV1[],
): FlowDeskProviderUsageAcquisitionConfigV1 {
	const acquisition: FlowDeskProviderUsageAcquisitionConfigV1 = {
		enabled: true,
		providers: families,
	};
	if (config.homeDir !== undefined) acquisition.homeDir = config.homeDir;
	if (config.claudeOAuthUsage !== undefined)
		acquisition.claudeOAuthUsage = config.claudeOAuthUsage;
	if (config.codexLiveUsage !== undefined)
		acquisition.codexLiveUsage = config.codexLiveUsage;
	if (config.geminiQuota !== undefined)
		acquisition.geminiQuota = config.geminiQuota;
	if (config.geminiOAuthClientId !== undefined)
		acquisition.geminiOAuthClientId = config.geminiOAuthClientId;
	if (config.geminiOAuthClientSecret !== undefined)
		acquisition.geminiOAuthClientSecret = config.geminiOAuthClientSecret;
	if (config.geminiProjectId !== undefined)
		acquisition.geminiProjectId = config.geminiProjectId;
	return acquisition;
}

function classifyAlert(
	family: FlowDeskProviderUsageLiveProviderFamilyV1,
	result: FlowDeskProviderUsageCollectorResultV1 | undefined,
): {
	remainingPercent: number | null;
	alertLevel: FlowDeskProviderUsageLiveAlertLevelV1;
	recommendation: string;
} {
	if (result === undefined) {
		return {
			remainingPercent: null,
			alertLevel: "unknown",
			recommendation:
				"Provider usage collector did not return data; refresh provider auth and retry before heavy work.",
		};
	}
	if (!result.ok) {
		return {
			remainingPercent: null,
			alertLevel: result.usageSnapshot.freshness === "stale" ? "stale" : "unknown",
			recommendation:
				result.redacted_reason ??
				"Provider usage is currently unavailable; refresh auth or pick another provider.",
		};
	}
	const remaining = result.bucketSnapshot?.remainingPercent ?? null;
	if (remaining === null) {
		return {
			remainingPercent: null,
			alertLevel: "unknown",
			recommendation:
				"Provider usage returned without a remaining percentage; treat as unknown and proceed with caution.",
		};
	}
	if (remaining <= 0) {
		return {
			remainingPercent: remaining,
			alertLevel: "exhausted",
			recommendation: `${family} bucket ${result.usageSnapshot.reset_bucket} is exhausted; wait for reset at ${result.usageSnapshot.reset_time} or switch providers.`,
		};
	}
	if (remaining <= 10) {
		return {
			remainingPercent: remaining,
			alertLevel: "critical",
			recommendation: `${family} bucket ${result.usageSnapshot.reset_bucket} is critically low (~${remaining.toFixed(1)}%). Avoid starting large work until reset at ${result.usageSnapshot.reset_time}, or switch to another provider for big tasks.`,
		};
	}
	if (remaining <= 30) {
		return {
			remainingPercent: remaining,
			alertLevel: "warning",
			recommendation: `${family} bucket ${result.usageSnapshot.reset_bucket} is around ${remaining.toFixed(1)}%; keep heavier tasks short or stage them around the reset at ${result.usageSnapshot.reset_time}.`,
		};
	}
	return {
		remainingPercent: remaining,
		alertLevel: "ok",
		recommendation: `${family} bucket ${result.usageSnapshot.reset_bucket} has ${remaining.toFixed(1)}% remaining until reset at ${result.usageSnapshot.reset_time}; safe to proceed with regular tasks.`,
	};
}

function rowFromCollectorResult(
	family: FlowDeskProviderUsageLiveProviderFamilyV1,
	result: FlowDeskProviderUsageCollectorResultV1 | undefined,
): FlowDeskProviderUsageLiveProviderRowV1 {
	const alert = classifyAlert(family, result);
	if (result === undefined) {
		return {
			providerFamily: family,
			ok: false,
			dispatchability: "non_dispatchable",
			freshness: "unknown",
			remainingPercent: alert.remainingPercent,
			alertLevel: alert.alertLevel,
			recommendation: alert.recommendation,
			uncertaintyFlags: ["unknown"],
			usageAuthorityAcquired: false,
		};
	}
	return {
		providerFamily: family,
		ok: result.ok,
		dispatchability: result.usageSnapshot.dispatchability,
		freshness: result.usageSnapshot.freshness,
		resetBucket: result.usageSnapshot.reset_bucket,
		resetTime: result.usageSnapshot.reset_time,
		remainingPercent: alert.remainingPercent,
		alertLevel: alert.alertLevel,
		recommendation: alert.recommendation,
		uncertaintyFlags: [...result.usageSnapshot.uncertainty_flags],
		modelFamily: result.usageSnapshot.model_family,
		redactedReason: result.redacted_reason,
		usageSnapshotRef: result.usageSnapshot.snapshot_id,
		providerHealthSnapshotRef: result.providerHealthSnapshot.snapshot_id,
		usageAuthorityAcquired:
			result.usageAuthorityEvidence?.usage_acquired === true,
	};
}

function rowFromUsageSnapshot(
	family: FlowDeskProviderUsageLiveProviderFamilyV1,
	snapshot: FlowDeskUsageSnapshotV1,
): FlowDeskProviderUsageLiveProviderRowV1 {
	const remainingPercent = remainingPercentFromSnapshot(snapshot);
	const alert = classifyUsageSnapshot(family, snapshot, remainingPercent);
	return {
		providerFamily: family,
		ok: snapshot.dispatchability === "dispatchable" && snapshot.freshness === "fresh",
		dispatchability: snapshot.dispatchability,
		freshness: snapshot.freshness,
		resetBucket: snapshot.reset_bucket,
		resetTime: snapshot.reset_time,
		remainingPercent,
		alertLevel: alert.alertLevel,
		recommendation: `${alert.recommendation} Reused a fresh durable usage snapshot to avoid another provider usage call.`,
		uncertaintyFlags: [...snapshot.uncertainty_flags],
		modelFamily: snapshot.model_family,
		usageSnapshotRef: snapshot.snapshot_id,
		providerHealthSnapshotRef: `cached-health-${snapshot.snapshot_id}`,
		usageAuthorityAcquired: true,
	};
}

function remainingPercentFromSnapshot(
	snapshot: FlowDeskUsageSnapshotV1,
): number | null {
	const match = /^([0-9]+(?:\.[0-9]+)?)%/.exec(snapshot.reset_bucket);
	if (match === null) return null;
	const parsed = Number.parseFloat(match[1]);
	return Number.isFinite(parsed) ? parsed : null;
}

function classifyUsageSnapshot(
	family: FlowDeskProviderUsageLiveProviderFamilyV1,
	snapshot: FlowDeskUsageSnapshotV1,
	remaining: number | null,
): {
	alertLevel: FlowDeskProviderUsageLiveAlertLevelV1;
	recommendation: string;
} {
	if (snapshot.freshness !== "fresh") {
		return {
			alertLevel: snapshot.freshness === "stale" ? "stale" : "unknown",
			recommendation: `Provider usage snapshot for ${family} is ${snapshot.freshness}; refresh provider auth before relying on it.`,
		};
	}
	if (remaining === null) {
		return {
			alertLevel: "unknown",
			recommendation: `Provider usage snapshot for ${family} did not include a parseable remaining percentage; proceed with caution.`,
		};
	}
	if (remaining <= 0) {
		return {
			alertLevel: "exhausted",
			recommendation: `${family} bucket ${snapshot.reset_bucket} is exhausted; wait for reset at ${snapshot.reset_time} or switch providers.`,
		};
	}
	if (remaining <= 10) {
		return {
			alertLevel: "critical",
			recommendation: `${family} bucket ${snapshot.reset_bucket} is critically low (~${remaining.toFixed(1)}%). Avoid starting large work until reset at ${snapshot.reset_time}, or switch providers for big tasks.`,
		};
	}
	if (remaining <= 30) {
		return {
			alertLevel: "warning",
			recommendation: `${family} bucket ${snapshot.reset_bucket} is around ${remaining.toFixed(1)}%; keep heavier tasks short or stage them around the reset at ${snapshot.reset_time}.`,
		};
	}
	return {
		alertLevel: "ok",
		recommendation: `${family} bucket ${snapshot.reset_bucket} has ${remaining.toFixed(1)}% remaining until reset at ${snapshot.reset_time}; safe to proceed with regular tasks.`,
	};
}

export async function executeFlowDeskProviderUsageLiveV1(input: {
	config: FlowDeskProviderUsageLiveConfigV1;
	request?: FlowDeskProviderUsageLiveRequestV1;
	now?: () => Date;
}): Promise<FlowDeskProviderUsageLiveResultV1> {
	const observedAt = (input.now ? input.now() : new Date()).toISOString();
	const requestedRaw = input.request?.providerFamily?.toLowerCase().trim();
	const requestedProviderFamily =
		requestedRaw === undefined || requestedRaw.length === 0
			? "all"
			: requestedRaw;
	const enabledProviders = input.config.providers ?? allProviderFamilies;
	const families =
		requestedProviderFamily === "all"
			? enabledProviders.filter((family) => allProviderFamilies.includes(family))
			: isProviderFamily(requestedProviderFamily) &&
					enabledProviders.includes(requestedProviderFamily)
				? [requestedProviderFamily]
				: [];

	if (families.length === 0) {
		return {
			status: "blocked_before_provider_usage_live",
			observedAt,
			requestedProviderFamily,
			resolvedProviderFamilies: [],
			providers: [],
			worstAlertLevel: "unknown",
			overallRecommendation:
				"Provider usage live tool is opted in but no provider family is configured; enable at least one of claude/openai/gemini in providerUsageLive.providers.",
			redactedBlockReason:
				requestedProviderFamily === "all"
					? "no provider family is enabled in providerUsageLive configuration"
					: `provider family ${requestedProviderFamily} is not enabled in providerUsageLive configuration`,
			safeNextActions: safeNextActions(),
			authority: blockedAuthority(),
		};
	}

	const snapshotReuse = loadFreshProviderUsageSnapshots(
		input.config,
		families,
		observedAt,
	);
	const cachedByFamily = new Map(
		snapshotReuse.cached.map((cached) => [cached.family, cached] as const),
	);
	// Pre-populate additionalSnapshotsByFamily from evidence cache (for reuse path)
	const additionalSnapshotsByFamilyFromCache = snapshotReuse.additionalByFamily;
	const familiesToCollect = families.filter((family) => !cachedByFamily.has(family));
	const acquisition = acquisitionConfigFromLive(input.config, familiesToCollect);
	const collectorOptions: FlowDeskProviderUsageCollectorOptionsV1 = {
		execFile: defaultExecFile,
	};
	const collectorResults = await Promise.all(
		familiesToCollect.map(async (family) => {
			try {
				const result = await collectManagedDispatchBetaUsageEvidenceV1(
					targetFor(family, observedAt),
					acquisition,
					collectorOptions,
				);
				return { family, result };
			} catch {
				return {
					family,
					result: undefined as FlowDeskProviderUsageCollectorResultV1 | undefined,
				};
			}
		}),
	);

	const providerRows = families.map((family) => {
		const cached = cachedByFamily.get(family);
		if (cached !== undefined) return rowFromUsageSnapshot(family, cached.snapshot);
		const collected = collectorResults.find((result) => result.family === family);
		return rowFromCollectorResult(family, collected?.result);
	});
	const providers = enrichProviderRowsFromReusableSidebarCache(
		input.config,
		providerRows,
		observedAt,
	);
	const anyAcquired = providers.some((row) => row.usageAuthorityAcquired);
	const worstAlertLevel = computeWorstAlertLevel(providers);
	const overallRecommendation = composeOverallRecommendation(
		providers,
		worstAlertLevel,
	);
	const snapshotPersistence = persistProviderUsageSnapshots(
		input.config,
		collectorResults,
		observedAt,
	);
	// Merge: fresh collector results take priority over cached evidence
	const additionalSnapshotsByFamily = new Map<FlowDeskProviderUsageLiveProviderFamilyV1, readonly FlowDeskUsageSnapshotV1[]>(additionalSnapshotsByFamilyFromCache);
	for (const { family, result } of collectorResults) {
		if (result?.additionalSnapshots && result.additionalSnapshots.length > 0) {
			additionalSnapshotsByFamily.set(family, result.additionalSnapshots);
		}
	}
	const sidebarCachePersistence = persistProviderUsageSidebarCache(
		input.config,
		providers,
		observedAt,
		additionalSnapshotsByFamily,
	);

	return {
		status: "provider_usage_live_collected",
		observedAt,
		requestedProviderFamily,
		resolvedProviderFamilies: families,
		providers,
		worstAlertLevel,
		overallRecommendation,
		...(snapshotReuse.report !== undefined ? { snapshotReuse: snapshotReuse.report } : {}),
		...(snapshotPersistence !== undefined
			? { snapshotPersistence }
			: {}),
		...(sidebarCachePersistence !== undefined
			? { sidebarCachePersistence }
			: {}),
		safeNextActions: safeNextActions(),
		authority: {
			realOpenCodeDispatch: false,
			providerCall: false,
			runtimeExecution: false,
			actualLaneLaunch: false,
			fallbackAuthority: false,
			hardCancelOrNoReplyAuthority: false,
			toolAuthority: false,
			providerUsageAcquired: anyAcquired,
		},
	};
}

interface ReusableSidebarCacheUsageRow {
	providerFamily: FlowDeskProviderUsageLiveProviderFamilyV1;
	usageSnapshotRef: string;
	remainingPercent: number;
}

function alertLevelForRemainingPercent(
	freshness: FlowDeskProviderUsageLiveProviderRowV1["freshness"],
	remainingPercent: number | null,
): FlowDeskProviderUsageLiveAlertLevelV1 {
	if (freshness !== "fresh") return freshness === "stale" ? "stale" : "unknown";
	if (remainingPercent === null) return "unknown";
	if (remainingPercent <= 0) return "exhausted";
	if (remainingPercent <= 10) return "critical";
	if (remainingPercent <= 30) return "warning";
	return "ok";
}

function loadReusableSidebarCacheUsageRows(
	config: FlowDeskProviderUsageLiveConfigV1,
	observedAt: string,
): Map<string, ReusableSidebarCacheUsageRow> {
	const rows = new Map<string, ReusableSidebarCacheUsageRow>();
	if (
		typeof config.durableStateRootDir !== "string" ||
		config.durableStateRootDir.trim().length === 0
	)
		return rows;

	const root = resolve(config.durableStateRootDir);
	const dir = resolve(root, ".flowdesk", "ui");
	if (dir !== root && !dir.startsWith(`${root}${sep}`)) return rows;

	try {
		const parsed = JSON.parse(
			readFileSync(join(dir, "provider-usage-sidebar.json"), "utf8"),
		) as unknown;
		if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed))
			return rows;
		const cache = parsed as Record<string, unknown>;
		if (cache.schema_version !== "flowdesk.provider_usage_sidebar_cache.v1")
			return rows;
		const expiresAt =
			typeof cache.expires_at === "string"
				? Date.parse(cache.expires_at)
				: Number.NaN;
		if (!Number.isFinite(expiresAt) || expiresAt <= Date.parse(observedAt))
			return rows;
		if (!Array.isArray(cache.providers)) return rows;

		for (const item of cache.providers) {
			if (typeof item !== "object" || item === null || Array.isArray(item))
				continue;
			const row = item as Record<string, unknown>;
			if (typeof row.providerFamily !== "string" || !isProviderFamily(row.providerFamily))
				continue;
			if (typeof row.usageSnapshotRef !== "string") continue;
			if (
				typeof row.remainingPercent !== "number" ||
				!Number.isFinite(row.remainingPercent)
			)
				continue;
			rows.set(row.usageSnapshotRef, {
				providerFamily: row.providerFamily,
				usageSnapshotRef: row.usageSnapshotRef,
				remainingPercent: row.remainingPercent,
			});
		}
	} catch {
		return rows;
	}

	return rows;
}

function enrichProviderRowsFromReusableSidebarCache(
	config: FlowDeskProviderUsageLiveConfigV1,
	providers: readonly FlowDeskProviderUsageLiveProviderRowV1[],
	observedAt: string,
): readonly FlowDeskProviderUsageLiveProviderRowV1[] {
	const reusable = loadReusableSidebarCacheUsageRows(config, observedAt);
	if (reusable.size === 0) return providers;

	return providers.map((row) => {
		if (row.remainingPercent !== null || row.usageSnapshotRef === undefined)
			return row;
		const cached = reusable.get(row.usageSnapshotRef);
		if (cached === undefined || cached.providerFamily !== row.providerFamily)
			return row;
		const alertLevel = alertLevelForRemainingPercent(
			row.freshness,
			cached.remainingPercent,
		);
		return {
			...row,
			remainingPercent: cached.remainingPercent,
			alertLevel,
			recommendation: `${row.providerFamily} reused a fresh durable usage snapshot and preserved ${cached.remainingPercent.toFixed(1)}% remaining from the previous fresh sidebar cache for the same usage snapshot.`,
		};
	});
}

function persistProviderUsageSidebarCache(
	config: FlowDeskProviderUsageLiveConfigV1,
	providers: readonly FlowDeskProviderUsageLiveProviderRowV1[],
	observedAt: string,
	additionalSnapshotsByFamily?: Map<FlowDeskProviderUsageLiveProviderFamilyV1, readonly FlowDeskUsageSnapshotV1[]>,
): FlowDeskProviderUsageLiveSidebarCachePersistenceV1 | undefined {
	if (config.persistSidebarCache !== true && config.persistSnapshots !== true)
		return undefined;
	if (
		typeof config.durableStateRootDir !== "string" ||
		config.durableStateRootDir.trim().length === 0
	) {
		return {
			requested: true,
			durableStateRootConfigured: false,
			persisted: false,
			skippedReasons: [
				"provider usage sidebar cache requested but no durable state root configured",
			],
		};
	}
	const root = resolve(config.durableStateRootDir);
	const dir = resolve(root, ".flowdesk", "ui");
	if (dir !== root && !dir.startsWith(`${root}${sep}`)) {
		return {
			requested: true,
			durableStateRootConfigured: true,
			persisted: false,
			skippedReasons: ["resolved sidebar cache path escapes durable root"],
		};
	}
	const cachePath = join(dir, "provider-usage-sidebar.json");
	const tempPath = join(dir, `provider-usage-sidebar.${observedAt.replace(/[^0-9A-Za-z]/g, "")}.tmp`);
	// Load previous sidebar to preserve weekly buckets when we're in the evidence-reuse path
	let previousSidebarBucketsByFamily = new Map<string, readonly Record<string, unknown>[]>();
	try {
		const prev = JSON.parse(readFileSync(cachePath, "utf8")) as Record<string, unknown>;
		if (prev.schema_version === "flowdesk.provider_usage_sidebar_cache.v1" && Array.isArray(prev.providers)) {
			for (const p of prev.providers as Record<string, unknown>[]) {
				if (typeof p.providerFamily === "string" && Array.isArray(p.buckets)) {
					previousSidebarBucketsByFamily.set(p.providerFamily, p.buckets as Record<string, unknown>[]);
				}
			}
		}
	} catch {}
	const record = {
		schema_version: "flowdesk.provider_usage_sidebar_cache.v1",
		observed_at: observedAt,
		expires_at: new Date(Date.parse(observedAt) + 5 * 60_000).toISOString(),
		providers: providers.map((row) => {
			const primaryConnected =
				row.dispatchability === "dispatchable" &&
				row.freshness === "fresh" &&
				row.usageAuthorityAcquired === true;
			const primaryBucket = {
				...(row.resetBucket === undefined ? {} : { resetBucket: row.resetBucket }),
				...(row.resetTime === undefined ? {} : { resetTime: row.resetTime }),
				remainingPercent: row.remainingPercent,
				freshness: row.freshness,
				dispatchability: row.dispatchability,
				connected: primaryConnected,
				...(row.usageSnapshotRef === undefined ? {} : { usageSnapshotRef: row.usageSnapshotRef }),
			};
			const freshAdditional = (additionalSnapshotsByFamily?.get(row.providerFamily) ?? []).map((snap) => ({
				resetBucket: snap.reset_bucket,
				...(snap.reset_time !== undefined && snap.reset_time !== "unknown" ? { resetTime: snap.reset_time } : {}),
				remainingPercent: remainingPercentFromSnapshot(snap),
				freshness: snap.freshness,
				dispatchability: snap.dispatchability,
				connected: snap.dispatchability === "dispatchable" && snap.freshness === "fresh",
				usageSnapshotRef: snap.snapshot_id,
			}));
			// When evidence-cache reuse path produced no additional buckets, preserve weekly etc. from previous sidebar
			const prevBuckets = previousSidebarBucketsByFamily.get(row.providerFamily) ?? [];
			const primaryResetBucket = row.resetBucket ?? "";
			const preservedBuckets = freshAdditional.length > 0
				? []
				: prevBuckets.filter((b) => typeof b.resetBucket === "string" && b.resetBucket !== primaryResetBucket);
			const additionalBuckets = freshAdditional.length > 0 ? freshAdditional : preservedBuckets as typeof freshAdditional;
			return {
				providerFamily: row.providerFamily,
				connected: primaryConnected,
				dispatchability: row.dispatchability,
				freshness: row.freshness,
				...(row.resetBucket === undefined ? {} : { resetBucket: row.resetBucket }),
				...(row.resetTime === undefined ? {} : { resetTime: row.resetTime }),
				remainingPercent: row.remainingPercent,
				alertLevel: row.alertLevel,
				...(row.modelFamily === undefined ? {} : { modelFamily: row.modelFamily }),
				...(row.redactedReason === undefined ? {} : { redactedReason: row.redactedReason }),
				...(row.usageSnapshotRef === undefined ? {} : { usageSnapshotRef: row.usageSnapshotRef }),
				buckets: [primaryBucket, ...additionalBuckets],
				uncertaintyFlags: [...row.uncertaintyFlags],
			};
		}),
		safeNextActions: ["/flowdesk-usage", "/flowdesk-status", "/flowdesk-doctor"],
		authority: {
			realOpenCodeDispatch: false,
			providerCall: false,
			runtimeExecution: false,
			actualLaneLaunch: false,
			fallbackAuthority: false,
			hardCancelOrNoReplyAuthority: false,
		},
	};
	try {
		mkdirSync(dir, { recursive: true });
		writeFileSync(tempPath, `${JSON.stringify(record, null, 2)}\n`, "utf8");
		renameSync(tempPath, cachePath);
		return {
			requested: true,
			durableStateRootConfigured: true,
			cachePathRef: ".flowdesk/ui/provider-usage-sidebar.json",
			persisted: true,
			skippedReasons: [],
		};
	} catch {
		return {
			requested: true,
			durableStateRootConfigured: true,
			cachePathRef: ".flowdesk/ui/provider-usage-sidebar.json",
			persisted: false,
			skippedReasons: ["failed to write sidebar cache"],
		};
	}
}

function loadFreshProviderUsageSnapshots(
	config: FlowDeskProviderUsageLiveConfigV1,
	families: readonly FlowDeskProviderUsageLiveProviderFamilyV1[],
	observedAt: string,
): {
	cached: Array<{
		family: FlowDeskProviderUsageLiveProviderFamilyV1;
		snapshot: FlowDeskUsageSnapshotV1;
		evidenceId: string;
	}>;
	additionalByFamily: Map<FlowDeskProviderUsageLiveProviderFamilyV1, FlowDeskUsageSnapshotV1[]>;
	report?: FlowDeskProviderUsageLiveSnapshotReuseV1;
} {
	if (typeof config.durableStateRootDir !== "string" || config.durableStateRootDir.trim().length === 0)
		return { cached: [], additionalByFamily: new Map() };
	const workflowId = sanitizePersistWorkflowId(config.persistWorkflowId);
	const reload = reloadFlowDeskSessionEvidenceV1({
		rootDir: config.durableStateRootDir,
		workflowId,
	});
	const skippedReasons: string[] = [];
	if (!reload.ok) {
		return {
			cached: [],
			additionalByFamily: new Map(),
			report: {
				requested: true,
				durableStateRootConfigured: true,
				workflowId,
				reusedEvidenceIds: [],
				skippedReasons: [`reload failed: ${reload.errors.join("; ")}`],
			},
		};
	}
	const cached: Array<{
		family: FlowDeskProviderUsageLiveProviderFamilyV1;
		snapshot: FlowDeskUsageSnapshotV1;
		evidenceId: string;
	}> = [];
	const additionalByFamily = new Map<FlowDeskProviderUsageLiveProviderFamilyV1, FlowDeskUsageSnapshotV1[]>();
	for (const family of families) {
		const entry = latestFreshUsageSnapshotEntry(reload.entries, family, observedAt);
		if (entry === undefined) {
			skippedReasons.push(`${family}: no fresh durable usage snapshot within TTL`);
			continue;
		}
		cached.push({
			family,
			snapshot: entry.record as unknown as FlowDeskUsageSnapshotV1,
			evidenceId: entry.evidenceId,
		});
		// Load fresh additional snapshots (e.g. weekly) that were persisted alongside the primary
		const addEntries = additionalFreshUsageSnapshotEntries(reload.entries, family, entry.evidenceId, observedAt);
		if (addEntries.length > 0) {
			additionalByFamily.set(family, addEntries.map((e) => e.record as unknown as FlowDeskUsageSnapshotV1));
		}
	}
	return {
		cached,
		additionalByFamily,
		report: {
			requested: true,
			durableStateRootConfigured: true,
			workflowId,
			reusedEvidenceIds: cached.map((entry) => entry.evidenceId),
			skippedReasons,
		},
	};
}

function latestFreshUsageSnapshotEntry(
	entries: readonly FlowDeskSessionEvidenceReloadEntryV1[],
	family: FlowDeskProviderUsageLiveProviderFamilyV1,
	observedAt: string,
): FlowDeskSessionEvidenceReloadEntryV1 | undefined {
	const candidates = entries
		.filter((entry) => entry.evidenceClass === "provider_usage_snapshot")
		.filter((entry) => entry.record.provider_family === family)
		.filter((entry) => entry.record.freshness === "fresh")
		.map((entry) => ({ entry, observedAtMs: snapshotObservedAtMs(entry) }))
		.filter((item): item is { entry: FlowDeskSessionEvidenceReloadEntryV1; observedAtMs: number } => item.observedAtMs !== undefined)
		.filter((item) => {
			const ttlMinutes = typeof item.entry.record.freshness_ttl === "number" ? item.entry.record.freshness_ttl : 0;
			return new Date(observedAt).getTime() - item.observedAtMs <= ttlMinutes * 60_000;
		})
		.sort((a, b) => b.observedAtMs - a.observedAtMs);
	return candidates[0]?.entry;
}

function additionalFreshUsageSnapshotEntries(
	entries: readonly FlowDeskSessionEvidenceReloadEntryV1[],
	family: FlowDeskProviderUsageLiveProviderFamilyV1,
	primaryEvidenceId: string,
	observedAt: string,
): FlowDeskSessionEvidenceReloadEntryV1[] {
	// Additional snapshots are persisted with evidenceId = primaryEvidenceId + "-" + bucketKey
	return entries
		.filter((entry) => entry.evidenceClass === "provider_usage_snapshot")
		.filter((entry) => entry.record.provider_family === family)
		.filter((entry) => entry.evidenceId !== primaryEvidenceId && entry.evidenceId.startsWith(`${primaryEvidenceId}-`))
		.filter((entry) => {
			const observedAtMs = snapshotObservedAtMs(entry);
			if (observedAtMs === undefined) return false;
			const ttlMinutes = typeof entry.record.freshness_ttl === "number" ? entry.record.freshness_ttl : 0;
			return new Date(observedAt).getTime() - observedAtMs <= ttlMinutes * 60_000;
		});
}

function snapshotObservedAtMs(
	entry: FlowDeskSessionEvidenceReloadEntryV1,
): number | undefined {
	const fromEvidenceId = timestampFromUsageSnapshotId(entry.evidenceId);
	if (fromEvidenceId !== undefined) return fromEvidenceId;
	const snapshotId = entry.record.snapshot_id;
	return typeof snapshotId === "string"
		? timestampFromUsageSnapshotId(snapshotId)
		: undefined;
}

function timestampFromUsageSnapshotId(value: string): number | undefined {
	const match = /(\d{8}T\d{9}Z)$/.exec(value);
	if (match === null) return undefined;
	const stamp = match[1];
	const iso = `${stamp.slice(0, 4)}-${stamp.slice(4, 6)}-${stamp.slice(6, 8)}T${stamp.slice(9, 11)}:${stamp.slice(11, 13)}:${stamp.slice(13, 15)}.${stamp.slice(15, 18)}Z`;
	const parsed = Date.parse(iso);
	return Number.isFinite(parsed) ? parsed : undefined;
}

function persistProviderUsageSnapshots(
	config: FlowDeskProviderUsageLiveConfigV1,
	collectorResults: Array<{
		family: FlowDeskProviderUsageLiveProviderFamilyV1;
		result: FlowDeskProviderUsageCollectorResultV1 | undefined;
	}>,
	observedAt: string,
): FlowDeskProviderUsageLiveSnapshotPersistenceV1 | undefined {
	if (config.persistSnapshots !== true) return undefined;
	const skippedReasons: string[] = [];
	if (
		typeof config.durableStateRootDir !== "string" ||
		config.durableStateRootDir.trim().length === 0
	) {
		return {
			requested: true,
			durableStateRootConfigured: false,
			persistedEvidenceIds: [],
			skippedReasons: [
				"providerUsageLive.persistSnapshots=true but no durable state root configured (set providerUsageLive.durableStateRootDir or top-level durableStateRoot)",
			],
		};
	}
	const workflowId = sanitizePersistWorkflowId(config.persistWorkflowId);
	const persistedIds: string[] = [];
	const stamp = observedAt.replaceAll(/[-:.]/g, "").replace("Z", "Z");
	const intents = [] as ReturnType<
		typeof prepareFlowDeskSessionEvidenceWriteIntentV1
	>["writeIntent"][];
	for (const { family, result } of collectorResults) {
		if (result === undefined) {
			skippedReasons.push(`${family}: collector result missing`);
			continue;
		}
		if (result.usageAuthorityEvidence?.usage_acquired !== true) {
			skippedReasons.push(`${family}: usage authority not acquired`);
			continue;
		}
		const evidenceId = `provider-usage-snapshot-${family}-${stamp}`;
		const prep = prepareFlowDeskSessionEvidenceWriteIntentV1({
			workflowId,
			evidenceId,
			record: result.usageSnapshot as unknown as Record<string, unknown>,
		});
		if (!prep.ok || prep.writeIntent === undefined) {
			skippedReasons.push(
				`${family}: snapshot prepare failed (${prep.errors.join("; ")})`,
			);
			continue;
		}
		intents.push(prep.writeIntent);
		persistedIds.push(evidenceId);
		// Also persist additional snapshots (e.g. weekly bucket) as separate evidence files
		for (const addSnap of result.additionalSnapshots ?? []) {
			const addBucketKey = (addSnap.reset_bucket ?? "unknown").replace(/^[0-9]+(?:\.[0-9]+)?%\s+/, "").replace(/[^a-z0-9-]/gi, "-");
			const addEvidenceId = `provider-usage-snapshot-${family}-${stamp}-${addBucketKey}`;
			const addPrep = prepareFlowDeskSessionEvidenceWriteIntentV1({
				workflowId,
				evidenceId: addEvidenceId,
				record: addSnap as unknown as Record<string, unknown>,
			});
			if (addPrep.ok && addPrep.writeIntent !== undefined) {
				intents.push(addPrep.writeIntent);
				persistedIds.push(addEvidenceId);
			}
		}
	}
	if (intents.length === 0) {
		return {
			requested: true,
			durableStateRootConfigured: true,
			workflowId,
			persistedEvidenceIds: [],
			skippedReasons,
		};
	}
	const filteredIntents = intents.filter(
		(intent): intent is NonNullable<typeof intent> => intent !== undefined,
	);
	const applied = applyFlowDeskSessionEvidenceWriteIntentsV1(
		config.durableStateRootDir,
		filteredIntents,
	);
	if (!applied.ok) {
		return {
			requested: true,
			durableStateRootConfigured: true,
			workflowId,
			persistedEvidenceIds: [],
			skippedReasons: [
				...skippedReasons,
				`apply failed: ${applied.errors.join("; ")}`,
			],
		};
	}
	return {
		requested: true,
		durableStateRootConfigured: true,
		workflowId,
		persistedEvidenceIds: persistedIds,
		skippedReasons,
	};
}

function sanitizePersistWorkflowId(value: string | undefined): string {
	if (
		typeof value === "string" &&
		value.length > 0 &&
		/^[A-Za-z0-9_-]+$/.test(value) &&
		!value.startsWith("-") &&
		!value.endsWith("-")
	)
		return value;
	return "workflow-provider-usage-live";
}

const alertSeverityRank: Record<FlowDeskProviderUsageLiveAlertLevelV1, number> = {
	ok: 0,
	stale: 1,
	unknown: 2,
	warning: 3,
	critical: 4,
	exhausted: 5,
};

function computeWorstAlertLevel(
	providers: readonly FlowDeskProviderUsageLiveProviderRowV1[],
): FlowDeskProviderUsageLiveAlertLevelV1 {
	let worst: FlowDeskProviderUsageLiveAlertLevelV1 = "ok";
	for (const row of providers) {
		if (alertSeverityRank[row.alertLevel] > alertSeverityRank[worst])
			worst = row.alertLevel;
	}
	return worst;
}

function composeOverallRecommendation(
	providers: readonly FlowDeskProviderUsageLiveProviderRowV1[],
	worst: FlowDeskProviderUsageLiveAlertLevelV1,
): string {
	if (providers.length === 0)
		return "No provider rows were returned; nothing to recommend.";
	if (worst === "ok")
		return "All collected providers are dispatchable with healthy headroom; safe to proceed with regular tasks.";
	const families = providers
		.filter((row) => row.alertLevel === worst)
		.map((row) => row.providerFamily)
		.join(", ");
	if (worst === "exhausted")
		return `Critical: provider quota exhausted on ${families}. Wait for reset or switch providers before heavy work.`;
	if (worst === "critical")
		return `Critical low quota on ${families}; avoid starting large multi-step work until reset, or switch providers.`;
	if (worst === "warning")
		return `Quota tight on ${families}; keep heavier tasks short or stage them around the reset window.`;
	if (worst === "stale")
		return `Provider usage data is stale on ${families}; refresh provider auth and retry before relying on these numbers.`;
	return `Provider usage data is unknown on ${families}; refresh auth and retry, or pick a different provider.`;
}
