/**
 * Usage-weighted model selection engine.
 *
 * Maps task roles to candidate model tiers and uses current provider usage
 * to weight the probability of selecting each model. Low-usage providers are
 * deprioritized; exhausted providers are excluded.
 */

import {
	type FlowDeskAgentRegistryRoleCategoryV1,
	type FlowDeskRoutingAdvisoryEvaluationV1,
	SAME_FAMILY_MODEL_FALLBACK_CHAINS,
	fuzzyFamilyKeywordForModelId,
} from "@flowdesk/core";
export { SAME_FAMILY_MODEL_FALLBACK_CHAINS, fuzzyFamilyKeywordForModelId };

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
	 * Key is providerQualifiedModelId, value is mean weighted score (typically 0..100
	 * for caller-supplied maps, or 0..1 when derived from a routing advisory).
	 *
	 * Advisory-only: never changes which candidates are eligible; only resolves ties
	 * when alertLevel and weight are already equal.
	 */
	oiPerformanceScores?: Map<string, number>;
	/**
	 * OI routing advisory evaluation produced by `evaluateOIRoutingAdvisoryV1`.
	 *
	 * When provided, the tie-breaker consults `model_summaries` to break ties
	 * between candidates that are already equivalent under alertLevel and weight.
	 * The advisory's `model_ref` is matched against either:
	 *   1. the exact `providerQualifiedModelId`, or
	 *   2. the `candidate-<modelId-with-/-replaced-by-->` convention used by the
	 *      workflow-assign tool when persisting OI evidence, or
	 *   3. any `model_ref` containing the providerQualifiedModelId as a substring
	 *      (best-effort opaque-ref match).
	 *
	 * Advisory-only: never authorizes dispatch, fallback, routing, or provider/
	 * model reselection. When both `routingAdvisory` and `oiPerformanceScores`
	 * are provided, the routing advisory's per-model score is preferred and the
	 * `oiPerformanceScores` map is consulted only as a final additive fallback
	 * for models the advisory does not mention.
	 */
	routingAdvisory?: FlowDeskRoutingAdvisoryEvaluationV1;
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

const SAME_FAMILY_MODEL_STAGE_KEYWORDS: Record<ModelCandidate["providerFamily"], readonly string[]> = {
	claude: ["opus", "sonnet", "haiku"],
	openai: ["normal", "mini", "fast", "spark"],
	gemini: ["pro", "flash", "flash-lite"],
};

export function isDeprecatedProviderQualifiedModelId(modelId: string): boolean {
	return DEPRECATED_PROVIDER_QUALIFIED_MODEL_IDS.has(modelId);
}

export function isOpenCodeSupportedProviderQualifiedModelId(modelId: string): boolean {
	return OPENCODE_SUPPORTED_PROVIDER_QUALIFIED_MODEL_IDS.has(modelId) && !isDeprecatedProviderQualifiedModelId(modelId);
}

export function getOpenCodeSupportedProviderQualifiedModelIds(): ReadonlySet<string> {
	return OPENCODE_SUPPORTED_PROVIDER_QUALIFIED_MODEL_IDS;
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

export interface FlowDeskSelectionPhaseModelFallbackEvidenceV1 {
	requestedProviderQualifiedModelId: string;
	selectedProviderQualifiedModelId?: string;
	attemptedProviderQualifiedModelIds: readonly string[];
	selectionPhaseOnly: true;
	runtimeRetryAttempted: false;
	fallbackAuthorityEnabled: false;
}

export interface FlowDeskRuntimeLaunchModelBindingV1 {
	requestedProviderQualifiedModelId: string;
	selectedProviderQualifiedModelId?: string;
	effectiveProviderQualifiedModelId?: string;
	attemptedProviderQualifiedModelIds: readonly string[];
	providerFamily?: ModelCandidate["providerFamily"];
	modelSelectionFallback: FlowDeskSelectionPhaseModelFallbackEvidenceV1;
}

export type FlowDeskRuntimeLaunchModelBindingResolutionV1 =
	| ({ ok: true; selectedProviderQualifiedModelId: string; effectiveProviderQualifiedModelId: string } & FlowDeskRuntimeLaunchModelBindingV1)
	| ({ ok: false; redactedReason: string } & FlowDeskRuntimeLaunchModelBindingV1);

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

/**
 * MANAGED DISPATCH PATH: Resolves the concrete model binding used by direct
 * runtime lane launches. Must use durable working-model evidence.
 *
 * The OpenCode runtime only accepts exact supported model ids, while callers may
 * provide same-family fuzzy ids such as `anthropic/claude-haiku-5.0`. This helper
 * reloads the durable working-model snapshot, applies same-family selection-only
 * fallback, and returns the requested model, selected effective model, and full
 * attempted chain as non-authorizing advisory evidence. It never retries a
 * runtime launch and never enables fallback/reselection authority.
 */
export function resolveOpenCodeRuntimeLaunchModelBindingV1(input: {
	providerQualifiedModelId: string;
}): FlowDeskRuntimeLaunchModelBindingResolutionV1 {
	const requestedProviderQualifiedModelId = input.providerQualifiedModelId;
	const fallbackEvidence = (resolution: SameFamilyModelFallbackResolution): FlowDeskSelectionPhaseModelFallbackEvidenceV1 => ({
		requestedProviderQualifiedModelId,
		...(resolution.selectedProviderQualifiedModelId === undefined ? {} : { selectedProviderQualifiedModelId: resolution.selectedProviderQualifiedModelId }),
		attemptedProviderQualifiedModelIds: resolution.attemptedProviderQualifiedModelIds,
		selectionPhaseOnly: true,
		runtimeRetryAttempted: false,
		fallbackAuthorityEnabled: false,
	});

	// Use OpenCode-supported models directly (no file I/O required)
	const availableModelIds = Array.from(OPENCODE_SUPPORTED_PROVIDER_QUALIFIED_MODEL_IDS);
	const resolution = resolveSameFamilyOpenCodeSupportedModelFallback({
		providerQualifiedModelId: requestedProviderQualifiedModelId,
		availableModelIds,
	});
	const evidence = fallbackEvidence(resolution);
	const base = {
		requestedProviderQualifiedModelId,
		...(resolution.selectedProviderQualifiedModelId === undefined ? {} : { selectedProviderQualifiedModelId: resolution.selectedProviderQualifiedModelId, effectiveProviderQualifiedModelId: resolution.selectedProviderQualifiedModelId }),
		attemptedProviderQualifiedModelIds: resolution.attemptedProviderQualifiedModelIds,
		...(resolution.providerFamily === undefined ? {} : { providerFamily: resolution.providerFamily }),
		modelSelectionFallback: evidence,
	};

	if (!availableModelIds.includes(requestedProviderQualifiedModelId) && resolution.selectedProviderQualifiedModelId === undefined) {
		return {
			ok: false,
			redactedReason: "Requested provider-qualified model is not supported by OpenCode; check your model ID.",
			...base,
		};
	}

	if (resolution.selectedProviderQualifiedModelId === undefined) {
		return {
			ok: false,
			redactedReason: "No same-family OpenCode-supported fallback found for requested model.",
			...base,
		};
	}

	if (!isOpenCodeSupportedProviderQualifiedModelId(resolution.selectedProviderQualifiedModelId)) {
		return {
			ok: false,
			redactedReason: "Model resolution did not produce an OpenCode-supported model.",
			...base,
		};
	}

	return {
		ok: true,
		requestedProviderQualifiedModelId,
		selectedProviderQualifiedModelId: resolution.selectedProviderQualifiedModelId,
		effectiveProviderQualifiedModelId: resolution.selectedProviderQualifiedModelId,
		attemptedProviderQualifiedModelIds: resolution.attemptedProviderQualifiedModelIds,
		...(resolution.providerFamily === undefined ? {} : { providerFamily: resolution.providerFamily }),
		modelSelectionFallback: evidence,
	};
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
	const familyKeyword = fuzzyFamilyKeywordForModelId(family, modelId);
	if (familyKeyword !== undefined) {
		const fuzzyIndex = SAME_FAMILY_MODEL_STAGE_KEYWORDS[family].indexOf(familyKeyword);
		if (fuzzyIndex >= 0) return fuzzyIndex;
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
	// gpt-5.4-mini-fast is the FlowDesk main coordinator model (see
	// FLOWDESK_MAIN_COORDINATOR_MODEL in bootstrap-installer.ts). Listed first
	// so light-role candidate pools can pick it when it is the working model.
	{ providerQualifiedModelId: "openai/gpt-5.4-mini-fast", providerFamily: "openai", agentName: "reviewer-gpt-frontier", tier: "light" },
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
 *
 * SELECTION PHASE ONLY: This function performs model assignment and planning.
 * It does NOT authorize runtime dispatch.
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

	// Resolve OI tie-breaker score map once.  Combines an optional routing advisory
	// (key-normalized so opaque candidate refs match providerQualifiedModelId) and
	// an explicit oiPerformanceScores map.  Advisory-only: never used to filter or
	// re-rank by anything other than equal-weight tie-breaks below.
	const oiTieBreakerScores = resolveOITieBreakerScores(
		weighted.map((w) => w.candidate.providerQualifiedModelId),
		selectionContext.routingAdvisory,
		selectionContext.oiPerformanceScores,
	);

	return weighted.sort((a, b) => {
		const aUsage = usageByFamily.get(a.candidate.usageKey ?? a.candidate.providerFamily) ?? usageByFamily.get(a.candidate.providerFamily);
		const bUsage = usageByFamily.get(b.candidate.usageKey ?? b.candidate.providerFamily) ?? usageByFamily.get(b.candidate.providerFamily);
		const byAlert = ALERT_RANK[aUsage?.alertLevel ?? "unknown"] - ALERT_RANK[bUsage?.alertLevel ?? "unknown"];
		if (byAlert !== 0) return byAlert;
		const byWeight = b.weight - a.weight;
		if (byWeight !== 0) return byWeight;
		// Phase 7.5: Tertiary tie-breaker – prefer models with higher OI performance scores
		if (oiTieBreakerScores !== undefined) {
			const aScore = oiTieBreakerScores.get(a.candidate.providerQualifiedModelId) ?? 0;
			const bScore = oiTieBreakerScores.get(b.candidate.providerQualifiedModelId) ?? 0;
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
 * Normalize a providerQualifiedModelId to the opaque candidate-ref form used by
 * `workflow-assign-tool.ts` when persisting OI routing advisory evidence.
 * Mirrors `selectedCandidateRef = candidate-${modelId.replace(/\//g, "-")}`.
 */
function candidateRefForModelId(providerQualifiedModelId: string): string {
	return `candidate-${providerQualifiedModelId.replace(/\//g, "-")}`;
}

/**
 * Build a tie-breaker score map keyed by providerQualifiedModelId from an optional
 * routing advisory plus an optional caller-supplied oiPerformanceScores map.
 *
 * Resolution rules per candidate providerQualifiedModelId:
 *   1. Prefer the routing advisory's model_summaries entry that matches by:
 *      a. exact providerQualifiedModelId, then
 *      b. candidate-ref form (candidate-<modelId-with-/-replaced-by-->), then
 *      c. opaque model_ref that contains the providerQualifiedModelId substring.
 *   2. Otherwise fall back to oiPerformanceScores.get(providerQualifiedModelId).
 *
 * Returns undefined when neither input is provided, so callers can short-circuit
 * the tie-breaker comparison entirely (preserving byte-identical behavior in
 * baselines that pass no OI inputs at all).
 */
function resolveOITieBreakerScores(
	candidateModelIds: readonly string[],
	advisory: FlowDeskRoutingAdvisoryEvaluationV1 | undefined,
	explicitScores: Map<string, number> | undefined,
): Map<string, number> | undefined {
	if (advisory === undefined && explicitScores === undefined) return undefined;
	const out = new Map<string, number>();
	const summaries = advisory?.model_summaries ?? [];
	for (const modelId of candidateModelIds) {
		const candidateRef = candidateRefForModelId(modelId);
		let resolved: number | undefined;
		// 1a. exact providerQualifiedModelId match
		let match = summaries.find((s) => s.model_ref === modelId);
		// 1b. candidate-ref form match
		if (match === undefined) match = summaries.find((s) => s.model_ref === candidateRef);
		// 1c. best-effort opaque substring match (skip empty modelId guard)
		if (match === undefined && modelId.length > 0) match = summaries.find((s) => s.model_ref.includes(modelId));
		if (match !== undefined) resolved = match.weighted_score;
		// 2. fall back to explicit scores
		if (resolved === undefined && explicitScores !== undefined) {
			const explicit = explicitScores.get(modelId);
			if (explicit !== undefined) resolved = explicit;
		}
		if (resolved !== undefined) out.set(modelId, resolved);
	}
	return out;
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
