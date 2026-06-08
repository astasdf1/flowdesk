/**
 * Usage-weighted model selection engine.
 *
 * Maps task roles to candidate model tiers and uses current provider usage
 * to weight the probability of selecting each model. Low-usage providers are
 * deprioritized; exhausted providers are excluded.
 */

import type { FlowDeskAgentRegistryRoleCategoryV1 } from "@flowdesk/core";

export type ModelTier = "heavy" | "medium" | "light";

export interface ModelCandidate {
	providerQualifiedModelId: string;
	providerFamily: "claude" | "openai" | "gemini";
	usageKey?: string;
	agentName: string;
	tier: ModelTier;
}

export interface ProviderUsageInput {
	providerFamily: "claude" | "openai" | "gemini";
	remainingPercent: number | null;
	alertLevel: "ok" | "warning" | "critical" | "exhausted" | "stale" | "unknown";
	resetBucket?: string;
	resetTime?: string;
	freshness?: "fresh" | "stale" | "unknown";
	secondsUntilReset?: number;
}

export interface ModelSelectionResult {
	candidate: ModelCandidate;
	weight: number;
	usageNote: string;
	/**
	 * Ordered exact models considered during same-family selection fallback.
	 * This is selection evidence only; it does not authorize runtime retry or
	 * managed provider/model fallback.
	 */
	attemptedProviderQualifiedModelIds: readonly string[];
}

export interface WorkingModelSelectionInput {
	availableModelIds: readonly string[];
	availabilitySource?: "local_db" | "durable_cache" | "cloud_cache" | "test_fixture";
	/**
	 * Tertiary tie-breaker: model performance scores from operational intelligence.
	 * Key is providerQualifiedModelId, value is mean weighted score (0..100).
	 */
	oiPerformanceScores?: Map<string, number>;
}

const DEPRECATED_PROVIDER_QUALIFIED_MODEL_IDS = new Set<string>([
	"google/gemini-3.1-flash-lite-preview",
	"gemini/gemini-3.1-flash-lite-preview",
]);

const OPENCODE_SUPPORTED_PROVIDER_QUALIFIED_MODEL_IDS = new Set<string>([
	"anthropic/claude-opus-4-7",
	"claude/claude-opus-4-7",
	"anthropic/claude-opus-4-5",
	"claude/claude-opus-4-5",
	"anthropic/claude-opus-4-1",
	"claude/claude-opus-4-1",
	"anthropic/claude-opus-4-0",
	"claude/claude-opus-4-0",
	"anthropic/claude-sonnet-4-6",
	"claude/claude-sonnet-4-6",
	"anthropic/claude-sonnet-4-5",
	"claude/claude-sonnet-4-5",
	"anthropic/claude-sonnet-4-0",
	"claude/claude-sonnet-4-0",
	"anthropic/claude-haiku-4-5",
	"claude/claude-haiku-4-5",
	"claude/sonnet-4",
	"openai/gpt-5.5",
	"openai/gpt-5.5-fast",
	"openai/gpt-5.4",
	"openai/gpt-5.4-fast",
	"openai/gpt-5.4-mini",
	"openai/gpt-5.4-mini-fast",
	"openai/gpt-5.3-codex",
	"openai/gpt-5.3-codex-spark",
	"openai/gpt-5.2",
	"google/gemini-2.5-flash",
	"gemini/gemini-2.5-flash",
	"google/gemini-2.5-flash-lite",
	"gemini/gemini-2.5-flash-lite",
	"google/gemini-2.5-pro",
	"gemini/gemini-2.5-pro",
	"google/gemini-3-flash-preview",
	"gemini/gemini-3-flash-preview",
	"google/gemini-3-pro-preview",
	"gemini/gemini-3-pro-preview",
	"google/gemini-3.1-pro-preview",
	"gemini/gemini-3.1-pro-preview",
	"google/gemini-3.1-flash-lite",
	"gemini/gemini-3.1-flash-lite",
]);

export const SAME_FAMILY_MODEL_FALLBACK_CHAINS = {
	claude: ["opus", "sonnet", "haiku"],
	openai: ["normal", "mini", "fast", "spark"],
	gemini: ["pro", "flash", "flash-lite"],
} as const;

const SAME_FAMILY_EXACT_MODEL_FALLBACK_CHAINS: Record<ModelCandidate["providerFamily"], readonly (readonly string[])[]> = {
	claude: [
		["anthropic/claude-opus-4-7", "claude/claude-opus-4-7", "anthropic/claude-opus-4-5", "claude/claude-opus-4-5", "anthropic/claude-opus-4-1", "claude/claude-opus-4-1", "anthropic/claude-opus-4-0", "claude/claude-opus-4-0"],
		["anthropic/claude-sonnet-4-6", "claude/claude-sonnet-4-6", "anthropic/claude-sonnet-4-5", "claude/claude-sonnet-4-5", "anthropic/claude-sonnet-4-0", "claude/claude-sonnet-4-0", "claude/sonnet-4"],
		["anthropic/claude-haiku-4-5", "claude/claude-haiku-4-5"],
	],
	openai: [
		["openai/gpt-5.5", "openai/gpt-5.4", "openai/gpt-5.3-codex", "openai/gpt-5.2"],
		["openai/gpt-5.4-mini"],
		["openai/gpt-5.5-fast", "openai/gpt-5.4-fast", "openai/gpt-5.4-mini-fast"],
		["openai/gpt-5.3-codex-spark"],
	],
	gemini: [
		["google/gemini-3.1-pro-preview", "gemini/gemini-3.1-pro-preview", "google/gemini-3-pro-preview", "gemini/gemini-3-pro-preview", "google/gemini-2.5-pro", "gemini/gemini-2.5-pro"],
		["google/gemini-3-flash-preview", "gemini/gemini-3-flash-preview", "google/gemini-2.5-flash", "gemini/gemini-2.5-flash"],
		["google/gemini-3.1-flash-lite", "gemini/gemini-3.1-flash-lite", "google/gemini-2.5-flash-lite", "gemini/gemini-2.5-flash-lite"],
	],
};

export function isDeprecatedProviderQualifiedModelId(modelId: string): boolean {
	return DEPRECATED_PROVIDER_QUALIFIED_MODEL_IDS.has(modelId);
}

export function isOpenCodeSupportedProviderQualifiedModelId(modelId: string): boolean {
	return OPENCODE_SUPPORTED_PROVIDER_QUALIFIED_MODEL_IDS.has(modelId) && !isDeprecatedProviderQualifiedModelId(modelId);
}

export function intersectWorkingAndOpenCodeSupportedModelIds(availableModelIds: readonly string[]): string[] {
	return availableModelIds
		.filter((modelId, index, array) => array.indexOf(modelId) === index)
		.filter(isOpenCodeSupportedProviderQualifiedModelId);
}

export interface SameFamilyModelFallbackResolution {
	selectedProviderQualifiedModelId?: string;
	attemptedProviderQualifiedModelIds: readonly string[];
	providerFamily?: ModelCandidate["providerFamily"];
}

export function resolveSameFamilyOpenCodeSupportedModelFallback(input: {
	providerQualifiedModelId: string;
	availableModelIds: readonly string[];
}): SameFamilyModelFallbackResolution {
	const family = providerFamilyForModelId(input.providerQualifiedModelId);
	if (family === undefined) {
		return { attemptedProviderQualifiedModelIds: [input.providerQualifiedModelId] };
	}
	const chain = SAME_FAMILY_EXACT_MODEL_FALLBACK_CHAINS[family];
	const stageIndex = fallbackStageIndexForModelId(family, input.providerQualifiedModelId);
	if (stageIndex === undefined) {
		return { providerFamily: family, attemptedProviderQualifiedModelIds: [input.providerQualifiedModelId] };
	}
	const available = new Set(input.availableModelIds);
	const attempted: string[] = [];
	const addAttempt = (modelId: string) => {
		if (!attempted.includes(modelId)) attempted.push(modelId);
	};
	for (let index = stageIndex; index < chain.length; index++) {
		const stageModels = index === stageIndex
			? [input.providerQualifiedModelId, ...chain[index].filter((modelId) => modelId !== input.providerQualifiedModelId)]
			: chain[index];
		for (const modelId of stageModels) {
			addAttempt(modelId);
			if (available.has(modelId) && isOpenCodeSupportedProviderQualifiedModelId(modelId)) {
				return { providerFamily: family, selectedProviderQualifiedModelId: modelId, attemptedProviderQualifiedModelIds: attempted };
			}
		}
	}
	return { providerFamily: family, attemptedProviderQualifiedModelIds: attempted };
}

function providerFamilyForModelId(modelId: string): ModelCandidate["providerFamily"] | undefined {
	if (modelId.startsWith("anthropic/") || modelId.startsWith("claude/")) return "claude";
	if (modelId.startsWith("openai/")) return "openai";
	if (modelId.startsWith("google/") || modelId.startsWith("gemini/")) return "gemini";
	return undefined;
}

function fallbackStageIndexForModelId(family: ModelCandidate["providerFamily"], modelId: string): number | undefined {
	const chain = SAME_FAMILY_EXACT_MODEL_FALLBACK_CHAINS[family];
	const explicitIndex = chain.findIndex((stage) => stage.includes(modelId));
	if (explicitIndex >= 0) return explicitIndex;
	const normalized = modelId.toLowerCase();
	if (family === "claude") {
		if (normalized.includes("opus")) return 0;
		if (normalized.includes("sonnet")) return 1;
		if (normalized.includes("haiku")) return 2;
	}
	if (family === "openai") {
		if (normalized.includes("spark")) return 3;
		if (normalized.includes("mini")) return 1;
		if (normalized.includes("fast")) return 2;
		if (normalized.includes("gpt")) return 0;
	}
	if (family === "gemini") {
		if (normalized.includes("flash-lite")) return 2;
		if (normalized.includes("flash")) return 1;
		if (normalized.includes("pro")) return 0;
	}
	return undefined;
}

function usageKeyForResolvedModel(candidate: ModelCandidate, modelId: string): ModelCandidate["usageKey"] {
	if (candidate.providerFamily !== "gemini") return candidate.usageKey;
	const normalized = modelId.toLowerCase();
	if (normalized.includes("flash-lite")) return "gemini-flash-lite";
	if (normalized.includes("flash")) return "gemini-flash";
	if (normalized.includes("pro")) return "gemini-pro";
	return candidate.usageKey;
}

// ---------------------------------------------------------------------------
// Model catalog – ordered by preference within each tier
// ---------------------------------------------------------------------------

const HEAVY_MODELS: ModelCandidate[] = [
	{ providerQualifiedModelId: "anthropic/claude-opus-4-7", providerFamily: "claude", agentName: "reviewer-claude-opus", tier: "heavy" },
	{ providerQualifiedModelId: "openai/gpt-5.5", providerFamily: "openai", agentName: "reviewer-gpt-frontier", tier: "heavy" },
];

const MEDIUM_MODELS: ModelCandidate[] = [
	{ providerQualifiedModelId: "openai/gpt-5.5", providerFamily: "openai", agentName: "reviewer-gpt-frontier", tier: "medium" },
	{ providerQualifiedModelId: "anthropic/claude-sonnet-4-6", providerFamily: "claude", agentName: "reviewer-claude-opus", tier: "medium" },
	{ providerQualifiedModelId: "google/gemini-3.1-pro-preview", providerFamily: "gemini", usageKey: "gemini-pro", agentName: "reviewer-gemini-pro", tier: "medium" },
	{ providerQualifiedModelId: "google/gemini-3-pro-preview", providerFamily: "gemini", usageKey: "gemini-pro", agentName: "reviewer-gemini-pro", tier: "medium" },
	{ providerQualifiedModelId: "google/gemini-2.5-pro", providerFamily: "gemini", usageKey: "gemini-pro", agentName: "reviewer-gemini-pro", tier: "medium" },
	{ providerQualifiedModelId: "google/gemini-3.1-flash-lite", providerFamily: "gemini", usageKey: "gemini-flash-lite", agentName: "reviewer-gemini-pro", tier: "medium" },
];

const LIGHT_MODELS: ModelCandidate[] = [
	{ providerQualifiedModelId: "openai/gpt-5.5", providerFamily: "openai", agentName: "reviewer-gpt-frontier", tier: "light" },
	{ providerQualifiedModelId: "anthropic/claude-sonnet-4-6", providerFamily: "claude", agentName: "reviewer-claude-opus", tier: "light" },
	{ providerQualifiedModelId: "google/gemini-3.1-flash-lite", providerFamily: "gemini", usageKey: "gemini-flash-lite", agentName: "reviewer-gemini-pro", tier: "light" },
];

// Role → preferred tier + candidate pool
// Heavy roles: only heavy models (high quality required)
// Medium roles: medium first, heavy fallback
// Light roles: light first, medium fallback
const ROLE_TIER_MAP: Record<FlowDeskAgentRegistryRoleCategoryV1, { tier: ModelTier; candidates: ModelCandidate[] }> = {
	security:      { tier: "heavy",  candidates: [...HEAVY_MODELS] },
	architecture:  { tier: "heavy",  candidates: [HEAVY_MODELS[1], HEAVY_MODELS[0]] },
	review:        { tier: "heavy",  candidates: [...HEAVY_MODELS, ...MEDIUM_MODELS] },
	decision:      { tier: "medium", candidates: [...MEDIUM_MODELS, ...HEAVY_MODELS] },
	implementation:{ tier: "medium", candidates: [...MEDIUM_MODELS] },
	verification:  { tier: "medium", candidates: [...MEDIUM_MODELS] },
	performance:   { tier: "medium", candidates: [...MEDIUM_MODELS] },
	migration:     { tier: "medium", candidates: [...MEDIUM_MODELS, ...HEAVY_MODELS] },
	exploration:   { tier: "light",  candidates: [...LIGHT_MODELS, ...MEDIUM_MODELS] },
	documentation: { tier: "light",  candidates: [...LIGHT_MODELS, ...MEDIUM_MODELS] },
	git:           { tier: "light",  candidates: [...LIGHT_MODELS] },
};

// ---------------------------------------------------------------------------
// Usage weight calculation
// ---------------------------------------------------------------------------

const RESET_WINDOW_MS = {
	rolling_5h: 5 * 60 * 60 * 1000,
	daily: 24 * 60 * 60 * 1000,
	weekly: 7 * 24 * 60 * 60 * 1000,
} as const;

const RESET_WINDOW_TOLERANCE_MS = 5 * 60 * 1000;
const CLOCK_SKEW_TOLERANCE_MS = 60 * 1000;
const HARD_VETO_REMAINING_FRACTION = 0.05;

const ALERT_RANK: Record<ProviderUsageInput["alertLevel"], number> = {
	ok: 0,
	warning: 1,
	critical: 2,
	exhausted: 3,
	stale: 4,
	unknown: 5,
};

function windowDurationMs(resetBucket: string | undefined): number | undefined {
	const normalized = resetBucket?.toLowerCase().replace(/^[0-9]+(?:\.[0-9]+)?%\s+/, "") ?? "";
	if (normalized.includes("5h")) return RESET_WINDOW_MS.rolling_5h;
	if (normalized.includes("daily") || normalized.includes("day")) return RESET_WINDOW_MS.daily;
	if (normalized.includes("weekly") || normalized.includes("1w") || normalized.includes("7d")) return RESET_WINDOW_MS.weekly;
	return undefined;
}

function resetTimeRemainingMs(usage: ProviderUsageInput, nowMs: number): number | undefined {
	if (typeof usage.secondsUntilReset === "number" && Number.isFinite(usage.secondsUntilReset)) {
		return usage.secondsUntilReset * 1000;
	}
	if (usage.resetTime === undefined) return undefined;
	const parsed = Date.parse(usage.resetTime);
	return Number.isFinite(parsed) ? parsed - nowMs : undefined;
}

function quotaHealthScore(usage: ProviderUsageInput | undefined, nowMs: number): number | undefined {
	if (usage === undefined) return undefined;
	if (usage.freshness !== undefined && usage.freshness !== "fresh") return undefined;
	if (usage.alertLevel === "exhausted" || usage.alertLevel === "stale" || usage.alertLevel === "unknown") return undefined;
	if (usage.remainingPercent === null || !Number.isFinite(usage.remainingPercent)) return undefined;
	if (usage.remainingPercent < 0 || usage.remainingPercent > 100) return undefined;
	const durationMs = windowDurationMs(usage.resetBucket);
	if (durationMs === undefined || durationMs <= 0) return undefined;
	const remainingMs = resetTimeRemainingMs(usage, nowMs);
	if (remainingMs === undefined || !Number.isFinite(remainingMs)) return undefined;
	if (remainingMs < -CLOCK_SKEW_TOLERANCE_MS) return undefined;
	if (remainingMs > durationMs + RESET_WINDOW_TOLERANCE_MS) return undefined;
	const quotaFraction = Math.max(0, Math.min(1, usage.remainingPercent / 100));
	if (quotaFraction <= HARD_VETO_REMAINING_FRACTION) return undefined;
	const timeRemainingFraction = Math.max(0, Math.min(1, remainingMs / durationMs));
	return quotaFraction - timeRemainingFraction;
}

function usageNote(usage: ProviderUsageInput | undefined, nowMs = Date.now()): string {
	if (!usage) return "usage unknown";
	const qhs = quotaHealthScore(usage, nowMs);
	if (qhs === undefined) return `${usage.alertLevel} – excluded`;
	if (usage.alertLevel === "exhausted") return "exhausted – excluded";
	if (usage.alertLevel === "critical") return `critical (${usage.remainingPercent ?? "?"}% left)`;
	if (usage.alertLevel === "warning") return `warning (${usage.remainingPercent ?? "?"}% left)`;
	return `ok (${usage.remainingPercent ?? "?"}% left, quota ${qhs >= 0 ? "ahead" : "behind"})`;
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Select the best model for a task given current provider usage.
 * Uses weighted random selection so lower-usage providers are preferred
 * without completely blocking higher-usage ones.
 */
export function selectModelForTask(
	role: FlowDeskAgentRegistryRoleCategoryV1,
	usageByFamily: Map<string, ProviderUsageInput>,
	selectionContext: WorkingModelSelectionInput,
	now?: () => Date,
): ModelSelectionResult | undefined {
	const nowMs = (now ? now() : new Date()).getTime();
	const mapping = ROLE_TIER_MAP[role];
	if (!mapping) return undefined;
	if (intersectWorkingAndOpenCodeSupportedModelIds(selectionContext.availableModelIds).length === 0) return undefined;

	// Deduplicate by providerQualifiedModelId and compute weights
	const seen = new Set<string>();
	const weighted: ModelSelectionResult[] = [];
	for (const candidate of mapping.candidates) {
		const resolution = resolveSameFamilyOpenCodeSupportedModelFallback({
			providerQualifiedModelId: candidate.providerQualifiedModelId,
			availableModelIds: selectionContext.availableModelIds,
		});
		if (resolution.selectedProviderQualifiedModelId === undefined) continue;
		if (seen.has(resolution.selectedProviderQualifiedModelId)) continue;
		seen.add(resolution.selectedProviderQualifiedModelId);
		const resolvedCandidate: ModelCandidate = {
			...candidate,
			providerQualifiedModelId: resolution.selectedProviderQualifiedModelId,
			usageKey: usageKeyForResolvedModel(candidate, resolution.selectedProviderQualifiedModelId),
		};
		const usage = usageByFamily.get(resolvedCandidate.usageKey ?? resolvedCandidate.providerFamily) ?? usageByFamily.get(resolvedCandidate.providerFamily);
		const qhs = quotaHealthScore(usage, nowMs);
		const weight = qhs === undefined ? 0 : Math.max(0.01, qhs + 1);
		if (weight <= 0) continue; // exhausted – skip entirely
		weighted.push({ candidate: resolvedCandidate, weight, usageNote: usageNote(usage, nowMs), attemptedProviderQualifiedModelIds: resolution.attemptedProviderQualifiedModelIds });
	}

	if (weighted.length === 0) return undefined;

	return weighted.sort((a, b) => {
		const aUsage = usageByFamily.get(a.candidate.usageKey ?? a.candidate.providerFamily) ?? usageByFamily.get(a.candidate.providerFamily);
		const bUsage = usageByFamily.get(b.candidate.usageKey ?? b.candidate.providerFamily) ?? usageByFamily.get(b.candidate.providerFamily);
		const byAlert = ALERT_RANK[aUsage?.alertLevel ?? "unknown"] - ALERT_RANK[bUsage?.alertLevel ?? "unknown"];
		if (byAlert !== 0) return byAlert;
		const byWeight = b.weight - a.weight;
		if (byWeight !== 0) return byWeight;
		// Phase 7.5: Tertiary tie-breaker – prefer models with higher OI performance scores
		if (selectionContext.oiPerformanceScores !== undefined) {
			const aScore = selectionContext.oiPerformanceScores.get(a.candidate.providerQualifiedModelId) ?? 0;
			const bScore = selectionContext.oiPerformanceScores.get(b.candidate.providerQualifiedModelId) ?? 0;
			const byOI = bScore - aScore;
			if (byOI !== 0) return byOI;
		}
		const byTier = tierRank(a.candidate.tier) - tierRank(b.candidate.tier);
		if (byTier !== 0) return byTier;
		const byCatalogPreference = mapping.candidates.findIndex((candidate) => candidate.providerQualifiedModelId === a.candidate.providerQualifiedModelId) - mapping.candidates.findIndex((candidate) => candidate.providerQualifiedModelId === b.candidate.providerQualifiedModelId);
		if (byCatalogPreference !== 0) return byCatalogPreference;
		return a.candidate.providerQualifiedModelId.localeCompare(b.candidate.providerQualifiedModelId);
	})[0];
}

function tierRank(tier: ModelTier): number {
	return tier === "heavy" ? 0 : tier === "medium" ? 1 : 2;
}

/**
 * Build a usage map from the sidebar cache provider rows.
 */
export function buildUsageMapFromProviders(
	providers: ReadonlyArray<{
			providerFamily: string;
			remainingPercent: number | null;
			alertLevel: string;
			resetBucket?: string;
			resetTime?: string;
			freshness?: string;
			secondsUntilReset?: number;
			buckets?: readonly {
				resetBucket?: string;
				resetTime?: string;
				remainingPercent: number | null;
				alertLevel?: string;
				freshness?: string;
				secondsUntilReset?: number;
			}[];
		}>,
	now?: () => Date,
): Map<string, ProviderUsageInput> {
	const nowMs = (now ? now() : new Date()).getTime();
	const map = new Map<string, ProviderUsageInput>();
	for (const p of providers) {
		if (p.providerFamily !== "claude" && p.providerFamily !== "openai" && p.providerFamily !== "gemini") continue;
		const providerUsage: ProviderUsageInput = {
			providerFamily: p.providerFamily,
			remainingPercent: p.remainingPercent,
			alertLevel: (p.alertLevel as ProviderUsageInput["alertLevel"]) ?? "unknown",
			...(p.resetBucket === undefined ? {} : { resetBucket: p.resetBucket }),
			...(p.resetTime === undefined ? {} : { resetTime: p.resetTime }),
			...(p.freshness === "fresh" || p.freshness === "stale" || p.freshness === "unknown" ? { freshness: p.freshness } : {}),
			...(typeof p.secondsUntilReset === "number" ? { secondsUntilReset: p.secondsUntilReset } : {}),
		};
		map.set(p.providerFamily, providerUsage);
		for (const bucket of p.buckets ?? []) {
			const usageKey = p.providerFamily === "gemini" ? geminiUsageKeyFromResetBucket(bucket.resetBucket) : p.providerFamily;
			if (usageKey === undefined) continue;
			const usage: ProviderUsageInput = {
				providerFamily: p.providerFamily,
				remainingPercent: bucket.remainingPercent,
				alertLevel: alertLevelForBucket(bucket.remainingPercent, bucket.freshness, bucket.alertLevel),
				...(bucket.resetBucket === undefined ? {} : { resetBucket: bucket.resetBucket }),
				...(bucket.resetTime === undefined ? {} : { resetTime: bucket.resetTime }),
				...(bucket.freshness === "fresh" || bucket.freshness === "stale" || bucket.freshness === "unknown" ? { freshness: bucket.freshness } : {}),
				...(typeof bucket.secondsUntilReset === "number" ? { secondsUntilReset: bucket.secondsUntilReset } : {}),
			};
			const existing = map.get(usageKey);
			if (existing === undefined || usageRank(usage, nowMs) < usageRank(existing, nowMs)) map.set(usageKey, usage);
		}
	}
	return map;
}

function geminiUsageKeyFromResetBucket(value: string | undefined): "gemini-pro" | "gemini-flash" | "gemini-flash-lite" | undefined {
	const normalized = value?.toLowerCase().trim().replace(/^[0-9]+(?:\.[0-9]+)?%\s+/, "") ?? "";
	if (normalized.startsWith("gemini-flash-lite")) return "gemini-flash-lite";
	if (normalized.startsWith("gemini-flash")) return "gemini-flash";
	if (normalized.startsWith("gemini-pro")) return "gemini-pro";
	return undefined;
}

function alertLevelForBucket(remainingPercent: number | null, freshness: string | undefined, explicit: string | undefined): ProviderUsageInput["alertLevel"] {
	if (explicit === "ok" || explicit === "warning" || explicit === "critical" || explicit === "exhausted" || explicit === "stale" || explicit === "unknown") return explicit;
	if (freshness !== undefined && freshness !== "fresh") return freshness === "stale" ? "stale" : "unknown";
	if (remainingPercent === null) return "unknown";
	if (remainingPercent <= 0) return "exhausted";
	if (remainingPercent <= 10) return "critical";
	if (remainingPercent <= 30) return "warning";
	return "ok";
}

function usageRank(usage: ProviderUsageInput, nowMs = Date.now()): number {
	const qhs = quotaHealthScore(usage, nowMs);
	if (qhs !== undefined) return qhs;
	return Number.NEGATIVE_INFINITY;
}
