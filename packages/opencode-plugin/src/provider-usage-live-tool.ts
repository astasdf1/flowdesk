import {
	type FlowDeskProviderUsageAcquisitionConfigV1,
	type FlowDeskProviderUsageCollectorResultV1,
	type FlowDeskProviderUsageCollectorTargetV1,
	collectManagedDispatchBetaUsageEvidenceV1,
} from "@flowdesk/core";

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

export interface FlowDeskProviderUsageLiveProviderRowV1 {
	providerFamily: FlowDeskProviderUsageLiveProviderFamilyV1;
	ok: boolean;
	dispatchability: "dispatchable" | "diagnostic_only" | "non_dispatchable";
	freshness: "fresh" | "stale" | "unknown";
	resetBucket?: string;
	resetTime?: string;
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

function rowFromCollectorResult(
	family: FlowDeskProviderUsageLiveProviderFamilyV1,
	result: FlowDeskProviderUsageCollectorResultV1 | undefined,
): FlowDeskProviderUsageLiveProviderRowV1 {
	if (result === undefined) {
		return {
			providerFamily: family,
			ok: false,
			dispatchability: "non_dispatchable",
			freshness: "unknown",
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
			redactedBlockReason:
				requestedProviderFamily === "all"
					? "no provider family is enabled in providerUsageLive configuration"
					: `provider family ${requestedProviderFamily} is not enabled in providerUsageLive configuration`,
			safeNextActions: safeNextActions(),
			authority: blockedAuthority(),
		};
	}

	const acquisition = acquisitionConfigFromLive(input.config, families);
	const collectorResults = await Promise.all(
		families.map(async (family) => {
			try {
				const result = await collectManagedDispatchBetaUsageEvidenceV1(
					targetFor(family, observedAt),
					acquisition,
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

	return {
		status: "provider_usage_live_collected",
		observedAt,
		requestedProviderFamily,
		resolvedProviderFamilies: families,
		providers,
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
