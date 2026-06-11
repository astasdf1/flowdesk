import { execFileSync } from "node:child_process";
import { mkdirSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import { join, resolve, sep } from "node:path";
import {
	type FlowDeskProviderUsageAcquisitionConfigV1,
	type FlowDeskProviderUsageCollectorOptionsV1,
	type FlowDeskProviderUsageCollectorResultV1,
	type FlowDeskProviderUsageCollectorTargetV1,
	type FlowDeskProviderHealthSnapshotV1,
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

export const alertSeverityRank: Record<FlowDeskProviderUsageLiveAlertLevelV1, number> = {
	ok: 0,
	stale: 1,
	unknown: 2,
	warning: 3,
	critical: 4,
	exhausted: 5,
};

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
	buckets?: readonly {
		resetBucket: string;
		resetTime?: string;
		remainingPercent: number | null;
		alertLevel: FlowDeskProviderUsageLiveAlertLevelV1;
	}[];
	uncertaintyFlags: readonly string[];
	modelFamily?: string;
	redactedReason?: string;
	usageSnapshotRef?: string;
	providerHealthSnapshotRef?: string;
	providerHealth?: {
		snapshotRef: string;
		freshness: FlowDeskProviderHealthSnapshotV1["freshness"];
		availabilityState: FlowDeskProviderHealthSnapshotV1["availability_state"];
		failureClass: FlowDeskProviderHealthSnapshotV1["failure_class"];
		dispatchability: FlowDeskProviderHealthSnapshotV1["dispatchability"];
		sourceSurface: FlowDeskProviderHealthSnapshotV1["source_surface"];
	};
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
	modelHint?: string,
): string {
	if (family === "openai") {
		if (modelHint !== undefined) {
			const hint = modelHint.toLowerCase();
			if (hint.includes("spark") || hint.includes("5.3") || hint.includes("5-3")) return "gpt-5.3-spark";
		}
		return "gpt-5.5";
	}
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

	const snapshots = [result.usageSnapshot, ...(result.additionalSnapshots ?? [])];
	let worstAlertLevel: FlowDeskProviderUsageLiveAlertLevelV1 = "ok";
	let worstRemaining: number | null = null;
	let worstRecommendation = "";
	let hasSetInitial = false;

	if (!result.ok) {
		for (const snap of snapshots) {
			const remaining = remainingPercentFromSnapshot(snap);
			let alertLevel: FlowDeskProviderUsageLiveAlertLevelV1;
			let recommendation: string;

			if (remaining !== null && snap.freshness === "fresh") {
				alertLevel = remaining <= 0 ? "exhausted" : remaining <= 10 ? "critical" : remaining <= 30 ? "warning" : "ok";
				recommendation = remaining <= 0
					? `${family} bucket ${snap.reset_bucket} is exhausted; wait for reset at ${snap.reset_time} or use a non-exhausted model bucket.`
					: `${family} bucket ${snap.reset_bucket} has ${remaining.toFixed(1)}% remaining, but dispatch authority was not acquired; use diagnostic display only.`;
			} else {
				alertLevel = snap.freshness === "stale" ? "stale" : "unknown";
				recommendation = result.redacted_reason ?? "Provider usage is currently unavailable; refresh auth or pick another provider.";
			}

			if (!hasSetInitial || alertSeverityRank[alertLevel] > alertSeverityRank[worstAlertLevel]) {
				worstAlertLevel = alertLevel;
				worstRecommendation = recommendation;
				worstRemaining = remaining;
				hasSetInitial = true;
			}
		}
		return {
			remainingPercent: worstRemaining,
			alertLevel: worstAlertLevel,
			recommendation: worstRecommendation,
		};
	}

	for (const snap of snapshots) {
		const remaining = snap === result.usageSnapshot && result.bucketSnapshot?.remainingPercent !== undefined
			? result.bucketSnapshot.remainingPercent
			: remainingPercentFromSnapshot(snap);

		let alertLevel: FlowDeskProviderUsageLiveAlertLevelV1 = "ok";
		let recommendation = "";

		if (remaining === null) {
			alertLevel = "unknown";
			recommendation = "Provider usage returned without a remaining percentage; treat as unknown and proceed with caution.";
		} else if (remaining <= 0) {
			alertLevel = "exhausted";
			recommendation = `${family} bucket ${snap.reset_bucket} is exhausted; wait for reset at ${snap.reset_time} or switch providers.`;
		} else if (remaining <= 10) {
			alertLevel = "critical";
			recommendation = `${family} bucket ${snap.reset_bucket} is critically low (~${remaining.toFixed(1)}%). Avoid starting large work until reset at ${snap.reset_time}, or switch to another provider for big tasks.`;
		} else if (remaining <= 30) {
			alertLevel = "warning";
			recommendation = `${family} bucket ${snap.reset_bucket} is around ${remaining.toFixed(1)}%; keep heavier tasks short or stage them around the reset at ${snap.reset_time}.`;
		} else {
			alertLevel = "ok";
			recommendation = `${family} bucket ${snap.reset_bucket} has ${remaining.toFixed(1)}% remaining until reset at ${snap.reset_time}; safe to proceed with regular tasks.`;
		}

		if (!hasSetInitial || alertSeverityRank[alertLevel] > alertSeverityRank[worstAlertLevel]) {
			worstAlertLevel = alertLevel;
			worstRecommendation = recommendation;
			worstRemaining = remaining;
			hasSetInitial = true;
		}
	}

	return {
		remainingPercent: worstRemaining,
		alertLevel: worstAlertLevel,
		recommendation: worstRecommendation,
	};
}

function rowFromCollectorResult(
	family: FlowDeskProviderUsageLiveProviderFamilyV1,
	result: FlowDeskProviderUsageCollectorResultV1 | undefined,
): FlowDeskProviderUsageLiveProviderRowV1 {
	const alert = classifyAlert(family, result);
	const snapshots = result === undefined ? [] : [result.usageSnapshot, ...(result.additionalSnapshots ?? [])];
	const anyExhausted = snapshots.some(s => {
		const rem = remainingPercentFromSnapshot(s);
		return rem !== null && rem <= 0;
	});

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

	const buckets: {
		resetBucket: string;
		resetTime?: string;
		remainingPercent: number | null;
		alertLevel: FlowDeskProviderUsageLiveAlertLevelV1;
	}[] = [];

	const primaryRemaining = result.bucketSnapshot?.remainingPercent ?? remainingPercentFromSnapshot(result.usageSnapshot);
	let primaryAlertLevel: FlowDeskProviderUsageLiveAlertLevelV1 = "unknown";
	if (!result.ok) {
		primaryAlertLevel = primaryRemaining !== null && result.usageSnapshot.freshness === "fresh"
			? (primaryRemaining <= 0 ? "exhausted" : primaryRemaining <= 10 ? "critical" : primaryRemaining <= 30 ? "warning" : "ok")
			: (result.usageSnapshot.freshness === "stale" ? "stale" : "unknown");
	} else {
		primaryAlertLevel = primaryRemaining === null ? "unknown" : primaryRemaining <= 0 ? "exhausted" : primaryRemaining <= 10 ? "critical" : primaryRemaining <= 30 ? "warning" : "ok";
	}

	buckets.push({
		resetBucket: result.usageSnapshot.reset_bucket,
		resetTime: result.usageSnapshot.reset_time,
		remainingPercent: primaryRemaining,
		alertLevel: primaryAlertLevel,
	});

	if (result.additionalSnapshots) {
		for (const snap of result.additionalSnapshots) {
			const rem = remainingPercentFromSnapshot(snap);
			let addAlertLevel: FlowDeskProviderUsageLiveAlertLevelV1 = "unknown";
			if (!result.ok) {
				addAlertLevel = rem !== null && snap.freshness === "fresh"
					? (rem <= 0 ? "exhausted" : rem <= 10 ? "critical" : rem <= 30 ? "warning" : "ok")
					: (snap.freshness === "stale" ? "stale" : "unknown");
			} else {
				addAlertLevel = rem === null ? "unknown" : rem <= 0 ? "exhausted" : rem <= 10 ? "critical" : rem <= 30 ? "warning" : "ok";
			}
			buckets.push({
				resetBucket: snap.reset_bucket,
				resetTime: snap.reset_time,
				remainingPercent: rem,
				alertLevel: addAlertLevel,
			});
		}
	}

	return {
		providerFamily: family,
		ok: result.ok && !anyExhausted,
		dispatchability: anyExhausted ? "non_dispatchable" : result.usageSnapshot.dispatchability,
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
		providerHealth: {
			snapshotRef: result.providerHealthSnapshot.snapshot_id,
			freshness: result.providerHealthSnapshot.freshness,
			availabilityState: result.providerHealthSnapshot.availability_state,
			failureClass: result.providerHealthSnapshot.failure_class,
			dispatchability: result.providerHealthSnapshot.dispatchability,
			sourceSurface: result.providerHealthSnapshot.source_surface,
		},
		usageAuthorityAcquired:
			result.usageAuthorityEvidence?.usage_acquired === true,
		buckets,
	};
}

function rowFromUsageSnapshot(
	family: FlowDeskProviderUsageLiveProviderFamilyV1,
	snapshot: FlowDeskUsageSnapshotV1,
	additionalSnapshots?: readonly FlowDeskUsageSnapshotV1[],
): FlowDeskProviderUsageLiveProviderRowV1 {
	const primaryRemainingPercent = remainingPercentFromSnapshot(snapshot);
	const primaryAlert = classifyUsageSnapshot(family, snapshot, primaryRemainingPercent);

	const buckets: {
		resetBucket: string;
		resetTime?: string;
		remainingPercent: number | null;
		alertLevel: FlowDeskProviderUsageLiveAlertLevelV1;
	}[] = [
		{
			resetBucket: snapshot.reset_bucket,
			resetTime: snapshot.reset_time,
			remainingPercent: primaryRemainingPercent,
			alertLevel: primaryAlert.alertLevel,
		},
	];

	let worstRemaining = primaryRemainingPercent;
	let worstAlertLevel = primaryAlert.alertLevel;
	let worstRecommendation = primaryAlert.recommendation;

	if (additionalSnapshots && additionalSnapshots.length > 0) {
		for (const snap of additionalSnapshots) {
			const rem = remainingPercentFromSnapshot(snap);
			const a = classifyUsageSnapshot(family, snap, rem);
			buckets.push({
				resetBucket: snap.reset_bucket,
				resetTime: snap.reset_time,
				remainingPercent: rem,
				alertLevel: a.alertLevel,
			});

			if (alertSeverityRank[a.alertLevel] > alertSeverityRank[worstAlertLevel]) {
				worstAlertLevel = a.alertLevel;
				worstRecommendation = a.recommendation;
				worstRemaining = rem;
			}
		}
	}

	return {
		providerFamily: family,
		ok: snapshot.dispatchability === "dispatchable" && snapshot.freshness === "fresh",
		dispatchability: snapshot.dispatchability,
		freshness: snapshot.freshness,
		resetBucket: snapshot.reset_bucket,
		resetTime: snapshot.reset_time,
		remainingPercent: worstRemaining,
		alertLevel: worstAlertLevel,
		recommendation: `${worstRecommendation} Reused a fresh durable usage snapshot to avoid another provider usage call.`,
		uncertaintyFlags: [...snapshot.uncertainty_flags],
		modelFamily: snapshot.model_family,
		usageSnapshotRef: snapshot.snapshot_id,
		providerHealthSnapshotRef: `cached-health-${snapshot.snapshot_id}`,
		providerHealth: {
			snapshotRef: `cached-health-${snapshot.snapshot_id}`,
			freshness: snapshot.freshness,
			availabilityState:
				snapshot.dispatchability === "dispatchable" && snapshot.freshness === "fresh"
					? "healthy"
					: "unknown",
			failureClass:
				snapshot.dispatchability === "dispatchable" && snapshot.freshness === "fresh"
					? "none"
					: "telemetry_ambiguous",
			dispatchability: snapshot.dispatchability,
			sourceSurface: "usage_collector",
		},
		usageAuthorityAcquired: true,
		buckets,
	};
}

function remainingPercentFromSnapshot(
	snapshot: FlowDeskUsageSnapshotV1,
): number | null {
	const explicit = (snapshot as { remaining_percent?: unknown }).remaining_percent;
	if (typeof explicit === "number" && Number.isFinite(explicit)) return explicit;
	if (explicit === null) return null;
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
		if (cached !== undefined) {
			return rowFromUsageSnapshot(
				family,
				cached.snapshot,
				additionalSnapshotsByFamilyFromCache.get(family),
			);
		}
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
	dispatchability: FlowDeskProviderUsageLiveProviderRowV1["dispatchability"];
	freshness: FlowDeskProviderUsageLiveProviderRowV1["freshness"];
	resetBucket?: string;
	resetTime?: string;
	remainingPercent: number;
	alertLevel: FlowDeskProviderUsageLiveAlertLevelV1;
	modelFamily?: string;
	uncertaintyFlags: readonly string[];
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
			appendReusableSidebarRow(rows, row.providerFamily, row, observedAt);
			if (Array.isArray(row.buckets)) {
				for (const bucket of row.buckets) {
					if (
						typeof bucket === "object" &&
						bucket !== null &&
						!Array.isArray(bucket)
					) {
						appendReusableSidebarRow(
							rows,
							row.providerFamily,
							{
								...bucket,
								modelFamily: row.modelFamily,
								uncertaintyFlags: row.uncertaintyFlags,
							},
							observedAt,
						);
					}
				}
			}
		}
	} catch {
		return rows;
	}

	return rows;
}

function appendReusableSidebarRow(
	rows: Map<string, ReusableSidebarCacheUsageRow>,
	providerFamily: FlowDeskProviderUsageLiveProviderFamilyV1,
	row: Record<string, unknown>,
	observedAt: string,
): void {
	if (typeof row.usageSnapshotRef !== "string") return;
	if (
		typeof row.remainingPercent !== "number" ||
		!Number.isFinite(row.remainingPercent)
	)
		return;
	const resetTime = typeof row.resetTime === "string" ? row.resetTime : undefined;
	if (resetTime !== undefined && resetTime !== "unknown") {
		const resetTimeMs = Date.parse(resetTime);
		if (Number.isFinite(resetTimeMs) && resetTimeMs <= Date.parse(observedAt))
			return;
	}
	const freshness =
		row.freshness === "fresh" ||
		row.freshness === "stale" ||
		row.freshness === "unknown"
			? row.freshness
			: "unknown";
	rows.set(row.usageSnapshotRef, {
		providerFamily,
		usageSnapshotRef: row.usageSnapshotRef,
		dispatchability:
			row.dispatchability === "dispatchable" ||
			row.dispatchability === "diagnostic_only" ||
			row.dispatchability === "non_dispatchable"
				? row.dispatchability
				: "diagnostic_only",
		freshness,
		...(typeof row.resetBucket === "string" ? { resetBucket: row.resetBucket } : {}),
		...(resetTime === undefined ? {} : { resetTime }),
		remainingPercent: row.remainingPercent,
		alertLevel:
			typeof row.alertLevel === "string" &&
			["ok", "warning", "critical", "exhausted", "stale", "unknown"].includes(
				row.alertLevel,
			)
				? (row.alertLevel as FlowDeskProviderUsageLiveAlertLevelV1)
				: alertLevelForRemainingPercent(freshness, row.remainingPercent),
		...(typeof row.modelFamily === "string" ? { modelFamily: row.modelFamily } : {}),
		uncertaintyFlags: Array.isArray(row.uncertaintyFlags)
			? row.uncertaintyFlags.filter(
					(flag): flag is string => typeof flag === "string",
				)
			: [],
	});
}

function enrichProviderRowsFromReusableSidebarCache(
	config: FlowDeskProviderUsageLiveConfigV1,
	providers: readonly FlowDeskProviderUsageLiveProviderRowV1[],
	observedAt: string,
): readonly FlowDeskProviderUsageLiveProviderRowV1[] {
	const reusable = loadReusableSidebarCacheUsageRows(config, observedAt);
	if (reusable.size === 0) return providers;

	return providers.map((row) => {
		const transientFailure =
			row.usageAuthorityAcquired !== true ||
			row.remainingPercent === null ||
			row.dispatchability !== "dispatchable" ||
			row.freshness !== "fresh";
		const reusableByFamily = [...reusable.values()].find(
			(cached) =>
				cached.providerFamily === row.providerFamily &&
				cached.dispatchability === "dispatchable" &&
				cached.freshness === "fresh",
		);
		if (transientFailure && reusableByFamily !== undefined) {
			return {
				...row,
				ok: true,
				dispatchability: reusableByFamily.dispatchability,
				freshness: reusableByFamily.freshness,
				...(reusableByFamily.resetBucket === undefined
					? {}
					: { resetBucket: reusableByFamily.resetBucket }),
				...(reusableByFamily.resetTime === undefined
					? {}
					: { resetTime: reusableByFamily.resetTime }),
				remainingPercent: reusableByFamily.remainingPercent,
				alertLevel: reusableByFamily.alertLevel,
				modelFamily: reusableByFamily.modelFamily ?? row.modelFamily,
				redactedReason: undefined,
				usageSnapshotRef: reusableByFamily.usageSnapshotRef,
				providerHealthSnapshotRef: `cached-health-${reusableByFamily.usageSnapshotRef}`,
				providerHealth: {
					snapshotRef: `cached-health-${reusableByFamily.usageSnapshotRef}`,
					freshness: "fresh",
					availabilityState: "healthy",
					failureClass: "none",
					dispatchability: "dispatchable",
					sourceSurface: "usage_collector",
				},
				usageAuthorityAcquired: true,
				uncertaintyFlags: [...reusableByFamily.uncertaintyFlags],
				recommendation: `${row.providerFamily} kept the previous fresh usage snapshot and preserved ${reusableByFamily.remainingPercent.toFixed(1)}% remaining because the latest usage refresh did not acquire fresh dispatchable evidence.`,
			};
		}
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
	const expiresAt = new Date(Date.parse(observedAt) + 5 * 60_000).toISOString();
	// Load previous sidebar to preserve weekly buckets and unrelated provider rows during scoped refreshes.
	let previousSidebarRowsByFamily = new Map<string, Record<string, unknown>>();
	let previousSidebarBucketsByFamily = new Map<string, readonly Record<string, unknown>[]>();
	try {
		const prev = JSON.parse(readFileSync(cachePath, "utf8")) as Record<string, unknown>;
		if (prev.schema_version === "flowdesk.provider_usage_sidebar_cache.v1" && Array.isArray(prev.providers)) {
			const previousObservedAt = typeof prev.observed_at === "string" ? prev.observed_at : undefined;
			const previousExpiresAt = typeof prev.expires_at === "string" ? prev.expires_at : undefined;
			for (const p of prev.providers as Record<string, unknown>[]) {
				if (typeof p.providerFamily === "string") {
					const normalizedBuckets = Array.isArray(p.buckets)
						? (p.buckets as Record<string, unknown>[]).map((bucket) => ({
							...bucket,
							...(typeof bucket.observed_at === "string" || previousObservedAt === undefined ? {} : { observed_at: previousObservedAt }),
							...(typeof bucket.expires_at === "string" || previousExpiresAt === undefined ? {} : { expires_at: previousExpiresAt }),
						}))
						: [];
					const normalizedProvider = {
						...p,
						...(typeof p.observed_at === "string" || previousObservedAt === undefined ? {} : { observed_at: previousObservedAt }),
						...(typeof p.expires_at === "string" || previousExpiresAt === undefined ? {} : { expires_at: previousExpiresAt }),
						...(normalizedBuckets.length > 0 ? { buckets: normalizedBuckets } : {}),
					};
					previousSidebarRowsByFamily.set(p.providerFamily, normalizedProvider);
					if (normalizedBuckets.length > 0) {
						previousSidebarBucketsByFamily.set(p.providerFamily, normalizedBuckets);
					}
				}
			}
		}
	} catch {}
	const refreshedProviderFamilies = new Set(providers.map((row) => row.providerFamily));
	const currentProviders = providers.map((row) => {
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
			observed_at: observedAt,
			expires_at: expiresAt,
			...(row.usageSnapshotRef === undefined ? {} : { usageSnapshotRef: row.usageSnapshotRef }),
		};
		const freshAdditional = (additionalSnapshotsByFamily?.get(row.providerFamily) ?? []).map((snap) => ({
			resetBucket: snap.reset_bucket,
			...(snap.reset_time !== undefined && snap.reset_time !== "unknown" ? { resetTime: snap.reset_time } : {}),
			remainingPercent: remainingPercentFromSnapshot(snap),
			freshness: snap.freshness,
			dispatchability: snap.dispatchability,
			connected: snap.dispatchability === "dispatchable" && snap.freshness === "fresh",
			observed_at: observedAt,
			expires_at: expiresAt,
			usageSnapshotRef: snap.snapshot_id,
		}));
		// When evidence-cache reuse path produced no additional buckets, preserve weekly etc. from previous sidebar.
		// Bug A fix: drop buckets whose expires_at has already passed so stale buckets (e.g. an expired 5h
		// short-window bucket) are not carried forward indefinitely across refreshes.
		const prevBuckets = previousSidebarBucketsByFamily.get(row.providerFamily) ?? [];
		const primaryResetBucket = row.resetBucket ?? "";
		const nowMsForCarryForward = Date.parse(observedAt);
		const preservedBuckets = freshAdditional.length > 0
			? []
			: prevBuckets.filter((b) => {
				if (typeof b.resetBucket !== "string") return false;
				if (b.resetBucket === primaryResetBucket) return false;
				if (typeof b.expires_at === "string") {
					const expiresMs = Date.parse(b.expires_at);
					if (Number.isFinite(expiresMs) && Number.isFinite(nowMsForCarryForward) && expiresMs <= nowMsForCarryForward) {
						return false;
					}
				}
				return true;
			});
		const additionalBuckets = freshAdditional.length > 0 ? freshAdditional : preservedBuckets as typeof freshAdditional;
		return {
			providerFamily: row.providerFamily,
			connected: primaryConnected,
			dispatchability: row.dispatchability,
			freshness: row.freshness,
			observed_at: observedAt,
			expires_at: expiresAt,
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
	});
	const preservedProviders = [...previousSidebarRowsByFamily.entries()]
		.filter(([family]) => !refreshedProviderFamilies.has(family as FlowDeskProviderUsageLiveProviderFamilyV1))
		.map(([, row]) => row);
	const record = {
		schema_version: "flowdesk.provider_usage_sidebar_cache.v1",
		observed_at: observedAt,
		expires_at: expiresAt,
		providers: [...currentProviders, ...preservedProviders],
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
		.sort((a, b) => {
			if (b.observedAtMs !== a.observedAtMs) return b.observedAtMs - a.observedAtMs;
			return a.entry.evidenceId.length - b.entry.evidenceId.length;
		});
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
	const match = /(\d{8}T\d{9}Z)/.exec(value);
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
			skippedReasons.push(
				`${family}: collector result missing; preserving previous durable snapshot if present`,
			);
			continue;
		}
		const healthDispatchable =
			result.providerHealthSnapshot.freshness === "fresh" &&
			result.providerHealthSnapshot.dispatchability === "dispatchable" &&
			result.providerHealthSnapshot.availability_state === "healthy" &&
			result.providerHealthSnapshot.failure_class === "none";
		if (result.usageAuthorityEvidence?.usage_acquired !== true) {
			skippedReasons.push(
				`${family}: usage authority not acquired; preserving previous durable snapshot if present`,
			);
			if (!healthDispatchable)
				skippedReasons.push(
					`${family}: provider health snapshot not persisted because refresh did not produce fresh dispatchable health`,
				);
			continue;
		}
		if (healthDispatchable) {
			const healthEvidenceId = `provider-health-snapshot-${family}-${stamp}`;
			const healthPrep = prepareFlowDeskSessionEvidenceWriteIntentV1({
				workflowId,
				evidenceId: healthEvidenceId,
				record: result.providerHealthSnapshot as unknown as Record<string, unknown>,
			});
			if (healthPrep.ok && healthPrep.writeIntent !== undefined) {
				intents.push(healthPrep.writeIntent);
				persistedIds.push(healthEvidenceId);
			} else {
				skippedReasons.push(
					`${family}: provider health snapshot prepare failed (${healthPrep.errors.join("; ")})`,
				);
			}
		} else {
			skippedReasons.push(
				`${family}: provider health snapshot not persisted because refresh did not produce fresh dispatchable health`,
			);
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

	const culprits: string[] = [];
	for (const row of providers) {
		if (row.alertLevel === worst) {
			const worstBuckets = row.buckets?.filter((b) => b.alertLevel === worst);
			if (worstBuckets && worstBuckets.length > 0) {
				for (const b of worstBuckets) {
					culprits.push(`${row.providerFamily} bucket ${b.resetBucket}`);
				}
			} else {
				culprits.push(row.providerFamily);
			}
		}
	}
	const culpritStr = [...new Set(culprits)].join(", ");

	if (worst === "exhausted")
		return `Critical: provider quota exhausted on ${culpritStr}. Wait for reset or switch providers before heavy work.`;
	if (worst === "critical")
		return `Critical low quota on ${culpritStr}; avoid starting large multi-step work until reset, or switch providers.`;
	if (worst === "warning")
		return `Quota tight on ${culpritStr}; keep heavier tasks short or stage them around the reset window.`;
	if (worst === "stale")
		return `Provider usage data is stale on ${culpritStr}; refresh provider auth and retry before relying on these numbers.`;
	return `Provider usage data is unknown on ${culpritStr}; refresh auth and retry, or pick a different provider.`;
}
