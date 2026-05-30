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
}

export interface ModelSelectionResult {
	candidate: ModelCandidate;
	weight: number;
	usageNote: string;
}

export interface WorkingModelSelectionInput {
	availableModelIds?: readonly string[];
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
	{ providerQualifiedModelId: "google/gemini-3.1-flash-preview", providerFamily: "gemini", usageKey: "gemini-flash", agentName: "reviewer-gemini-pro", tier: "medium" },
];

const LIGHT_MODELS: ModelCandidate[] = [
	{ providerQualifiedModelId: "openai/gpt-5.5", providerFamily: "openai", agentName: "reviewer-gpt-frontier", tier: "light" },
	{ providerQualifiedModelId: "anthropic/claude-sonnet-4-6", providerFamily: "claude", agentName: "reviewer-claude-opus", tier: "light" },
	{ providerQualifiedModelId: "google/gemini-3.1-flash-lite-preview", providerFamily: "gemini", usageKey: "gemini-flash-lite", agentName: "reviewer-gemini-pro", tier: "light" },
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

function usageWeight(usage: ProviderUsageInput | undefined): number {
	if (!usage) return 0.2; // unknown provider → low weight
	if (usage.alertLevel === "exhausted") return 0;
	if (usage.alertLevel === "critical") return 0.05;
	const pct = usage.remainingPercent;
	if (pct === null) return 0.1;
	if (pct > 50) return 1.0;
	if (pct > 30) return 0.7;
	if (pct > 10) return 0.3;
	return 0.05;
}

function usageNote(usage: ProviderUsageInput | undefined): string {
	if (!usage) return "usage unknown";
	if (usage.alertLevel === "exhausted") return "exhausted – excluded";
	if (usage.alertLevel === "critical") return `critical (${usage.remainingPercent ?? "?"}% left)`;
	if (usage.alertLevel === "warning") return `warning (${usage.remainingPercent ?? "?"}% left)`;
	return `ok (${usage.remainingPercent ?? "?"}% left)`;
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
	selectionContext: WorkingModelSelectionInput = {},
	now?: () => Date,
): ModelSelectionResult | undefined {
	void now; // reserved for future TTL checks
	const mapping = ROLE_TIER_MAP[role];
	if (!mapping) return undefined;
	const allowedModelIds = selectionContext.availableModelIds === undefined ? undefined : new Set(selectionContext.availableModelIds);

	// Deduplicate by providerQualifiedModelId and compute weights
	const seen = new Set<string>();
	const weighted: ModelSelectionResult[] = [];
	for (const candidate of mapping.candidates) {
		if (allowedModelIds !== undefined && !allowedModelIds.has(candidate.providerQualifiedModelId)) continue;
		if (seen.has(candidate.providerQualifiedModelId)) continue;
		seen.add(candidate.providerQualifiedModelId);
		const usage = usageByFamily.get(candidate.usageKey ?? candidate.providerFamily) ?? usageByFamily.get(candidate.providerFamily);
		const weight = usageWeight(usage);
		if (weight <= 0) continue; // exhausted – skip entirely
		weighted.push({ candidate, weight, usageNote: usageNote(usage) });
	}

	if (weighted.length === 0) return undefined;

	// Weighted random pick
	const total = weighted.reduce((sum, r) => sum + r.weight, 0);
	let rand = Math.random() * total;
	for (const r of weighted) {
		rand -= r.weight;
		if (rand <= 0) return r;
	}
	return weighted[weighted.length - 1];
}

/**
 * Build a usage map from the sidebar cache provider rows.
 */
export function buildUsageMapFromProviders(
	providers: ReadonlyArray<{
		providerFamily: string;
		remainingPercent: number | null;
		alertLevel: string;
		buckets?: readonly {
			resetBucket?: string;
			remainingPercent: number | null;
			alertLevel?: string;
			freshness?: string;
		}[];
	}>,
): Map<string, ProviderUsageInput> {
	const map = new Map<string, ProviderUsageInput>();
	for (const p of providers) {
		if (p.providerFamily !== "claude" && p.providerFamily !== "openai" && p.providerFamily !== "gemini") continue;
		const providerUsage: ProviderUsageInput = {
			providerFamily: p.providerFamily,
			remainingPercent: p.remainingPercent,
			alertLevel: (p.alertLevel as ProviderUsageInput["alertLevel"]) ?? "unknown",
		};
		map.set(p.providerFamily, providerUsage);
		if (p.providerFamily !== "gemini") continue;
		for (const bucket of p.buckets ?? []) {
			const usageKey = geminiUsageKeyFromResetBucket(bucket.resetBucket);
			if (usageKey === undefined) continue;
			const usage: ProviderUsageInput = {
				providerFamily: "gemini",
				remainingPercent: bucket.remainingPercent,
				alertLevel: alertLevelForBucket(bucket.remainingPercent, bucket.freshness, bucket.alertLevel),
			};
			const existing = map.get(usageKey);
			if (existing === undefined || usageRank(usage) < usageRank(existing)) map.set(usageKey, usage);
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

function usageRank(usage: ProviderUsageInput): number {
	if (usage.remainingPercent !== null) return usage.remainingPercent;
	return usage.alertLevel === "unknown" || usage.alertLevel === "stale" ? Number.POSITIVE_INFINITY : 100;
}
