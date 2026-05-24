import { execFileSync } from "node:child_process";
import {
	type FlowDeskProviderUsageAcquisitionConfigV1,
	type FlowDeskProviderUsageCollectorOptionsV1,
	type FlowDeskProviderUsageCollectorResultV1,
	type FlowDeskProviderUsageCollectorTargetV1,
	collectManagedDispatchBetaUsageEvidenceV1,
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

	const acquisition = acquisitionConfigFromLive(input.config, families);
	const collectorOptions: FlowDeskProviderUsageCollectorOptionsV1 = {
		execFile: defaultExecFile,
	};
	const collectorResults = await Promise.all(
		families.map(async (family) => {
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

	const providers = collectorResults.map(({ family, result }) =>
		rowFromCollectorResult(family, result),
	);
	const anyAcquired = providers.some((row) => row.usageAuthorityAcquired);
	const worstAlertLevel = computeWorstAlertLevel(providers);
	const overallRecommendation = composeOverallRecommendation(
		providers,
		worstAlertLevel,
	);

	return {
		status: "provider_usage_live_collected",
		observedAt,
		requestedProviderFamily,
		resolvedProviderFamilies: families,
		providers,
		worstAlertLevel,
		overallRecommendation,
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
