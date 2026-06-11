/**
 * Usage-aware model resolver (selection-phase utility).
 *
 * Purpose:
 *   When a caller requests a preferred provider-qualified model id but the
 *   corresponding provider family is currently exhausted, critical, stale,
 *   unknown, or non_dispatchable according to cached provider usage
 *   snapshots, this utility recommends a pre-launch preferred-model
 *   substitution from the pre-computed model-availability list.
 *
 * Boundary:
 *   - This is a pure function. No file I/O, no DB reads, no network.
 *   - It receives all data (usage snapshots, available model ids) as input.
 *   - It NEVER throws. On any "no good alternative" case, it falls back to
 *     the original requested model id (fail-open).
 *   - It does NOT carry dispatch authority, fallback authority, runtime
 *     execution authority, write authority, or Guard approval. It is only
 *     a selection-phase recommendation utility for changing the launch input
 *     before a lane is started. It is not managed fallback/reselection; real
 *     provider/model reselection still requires the managed fallback regate
 *     path with fresh evidence and Guard approval.
 */

export interface UsageAwareModelResolverUsageSnapshotV1 {
	providerFamily: string;
	alertLevel: "ok" | "warning" | "critical" | "exhausted" | "stale" | "unknown";
	remainingPercent: number;
	dispatchability: "dispatchable" | "non_dispatchable";
}

export interface UsageAwareModelResolverInputV1 {
	requestedModelId: string;
	usageSnapshots: ReadonlyArray<UsageAwareModelResolverUsageSnapshotV1>;
	availableModelIds: ReadonlyArray<string>;
	role?: string;
	/** Defaults to true. */
	allowCrossFamily?: boolean;
}

export type UsageAwareModelResolverOverrideReasonV1 =
	| "exhausted"
	| "critical"
	| "non_dispatchable"
	| "stale";

export interface UsageAwareModelResolverResultV1 {
	resolvedModelId: string;
	overrideApplied: boolean;
	overrideReason?: UsageAwareModelResolverOverrideReasonV1;
	originalModelId: string;
	/** True only when the launch input changed before lane launch. */
	providerBindingChangedBeforeLaunch: boolean;
	/** Stable label for the authority boundary of an applied change. */
	preLaunchModelSubstitution: boolean;
	modelSubstitutionKind: "none" | "pre_launch_preferred_model_substitution";
	fallbackToOriginal?: boolean;
	fallbackToOriginalReason?: string;
}

/**
 * Durable evidence record emitted when usage-aware model resolution applied
 * a pre-launch preferred-model substitution (i.e. the requested preferred
 * provider-qualified model id was swapped before lane launch for an
 * alternative because the requested family was exhausted, critical,
 * non_dispatchable, or stale per cached usage snapshots).
 *
 * This record is selection-phase-only evidence. It does not carry fallback
 * authority, dispatch authority, runtime execution authority, or Guard
 * approval. It is not managed fallback/reselection; managed-dispatch
 * fallback/reselection still requires the fallback regate path with fresh
 * evidence and explicit Guard approval.
 */
export interface FlowDeskUsageAwareModelOverrideEvidenceV1 {
	schema_version: "flowdesk.usage_aware_model_override.v1";
	workflow_id: string;
	lane_id: string;
	task_id: string;
	original_model_id: string;
	resolved_model_id: string;
	override_reason: "exhausted" | "critical" | "non_dispatchable" | "stale";
	allow_cross_family: boolean;
	provider_binding_changed_before_launch: true;
	model_substitution_kind: "pre_launch_preferred_model_substitution";
	managed_fallback_reselection: false;
	observed_at: string;
	// authority block — selection-phase utility only
	selection_phase_only: true;
	fallback_authority_enabled: false;
	dispatch_authority_enabled: false;
}

type ProviderFamilyLabel = "claude" | "openai" | "gemini";

const CLAUDE_PREFIXES = ["anthropic/", "claude/"] as const;
const OPENAI_PREFIXES = ["openai/"] as const;
const GEMINI_PREFIXES = ["google/", "gemini/"] as const;

/**
 * Extract the canonical provider family label from a provider-qualified
 * model id. Returns null when the prefix is unrecognized.
 */
function extractProviderFamily(modelId: string): ProviderFamilyLabel | null {
	const lower = modelId.toLowerCase();
	for (const p of CLAUDE_PREFIXES) {
		if (lower.startsWith(p)) return "claude";
	}
	for (const p of OPENAI_PREFIXES) {
		if (lower.startsWith(p)) return "openai";
	}
	for (const p of GEMINI_PREFIXES) {
		if (lower.startsWith(p)) return "gemini";
	}
	return null;
}

/**
 * Same prefix-based extraction, but applied to candidate model ids in
 * availableModelIds. Returns null when unrecognized.
 */
function modelIdMatchesFamily(modelId: string, family: ProviderFamilyLabel): boolean {
	const lower = modelId.toLowerCase();
	if (family === "claude") {
		return CLAUDE_PREFIXES.some((p) => lower.startsWith(p));
	}
	if (family === "openai") {
		return OPENAI_PREFIXES.some((p) => lower.startsWith(p));
	}
	return GEMINI_PREFIXES.some((p) => lower.startsWith(p));
}

/**
 * Normalize a raw providerFamily snapshot label into the canonical
 * ProviderFamilyLabel used by this resolver. Returns null when the
 * snapshot is for a family this resolver does not handle (e.g.
 * "opencode", "z_ai", "unknown").
 */
function normalizeSnapshotFamily(label: string): ProviderFamilyLabel | null {
	const lower = label.toLowerCase();
	if (lower === "claude" || lower === "anthropic") return "claude";
	if (lower === "openai") return "openai";
	if (lower === "gemini" || lower === "google") return "gemini";
	return null;
}

function snapshotIsHealthy(s: UsageAwareModelResolverUsageSnapshotV1): boolean {
	return (
		(s.alertLevel === "ok" || s.alertLevel === "warning") &&
		s.dispatchability === "dispatchable"
	);
}

function snapshotNeedsOverride(
	s: UsageAwareModelResolverUsageSnapshotV1,
): UsageAwareModelResolverOverrideReasonV1 | null {
	if (s.dispatchability === "non_dispatchable") return "non_dispatchable";
	if (s.alertLevel === "exhausted") return "exhausted";
	if (s.alertLevel === "critical") return "critical";
	if (s.alertLevel === "stale") return "stale";
	if (s.alertLevel === "unknown") return "stale";
	return null;
}

function usageAwareResolverResult(input: {
	resolvedModelId: string;
	originalModelId: string;
	overrideApplied: boolean;
	overrideReason?: UsageAwareModelResolverOverrideReasonV1;
	fallbackToOriginal?: boolean;
	fallbackToOriginalReason?: string;
}): UsageAwareModelResolverResultV1 {
	return {
		resolvedModelId: input.resolvedModelId,
		overrideApplied: input.overrideApplied,
		...(input.overrideReason === undefined ? {} : { overrideReason: input.overrideReason }),
		originalModelId: input.originalModelId,
		providerBindingChangedBeforeLaunch: input.overrideApplied,
		preLaunchModelSubstitution: input.overrideApplied,
		modelSubstitutionKind: input.overrideApplied ? "pre_launch_preferred_model_substitution" : "none",
		...(input.fallbackToOriginal === undefined ? {} : { fallbackToOriginal: input.fallbackToOriginal }),
		...(input.fallbackToOriginalReason === undefined
			? {}
			: { fallbackToOriginalReason: input.fallbackToOriginalReason }),
	};
}

/**
 * Resolve a requested provider-qualified model id against cached usage
 * snapshots and a pre-computed availability list. See module header for
 * full semantics.
 */
export function resolveUsageAwareProviderQualifiedModelId(
	input: UsageAwareModelResolverInputV1,
): UsageAwareModelResolverResultV1 {
	const requested = input.requestedModelId;
	const allowCrossFamily = input.allowCrossFamily ?? true;
	const available = input.availableModelIds ?? [];
	const snapshots = input.usageSnapshots ?? [];

	const requestedFamily = extractProviderFamily(requested);

	// Case 1: We can't parse the family. Pass through.
	if (requestedFamily === null) {
		return usageAwareResolverResult({
			resolvedModelId: requested,
			overrideApplied: false,
			originalModelId: requested,
		});
	}

	// Find the snapshot for the requested family (first match).
	const requestedSnapshot = snapshots.find(
		(s) => normalizeSnapshotFamily(s.providerFamily) === requestedFamily,
	);

	// Case 2: No snapshot for requested family → cannot prove unhealthy,
	// pass through (fail-open). This is conservative but matches the
	// "no override without evidence" principle.
	if (!requestedSnapshot) {
		return usageAwareResolverResult({
			resolvedModelId: requested,
			overrideApplied: false,
			originalModelId: requested,
		});
	}

	const overrideReason = snapshotNeedsOverride(requestedSnapshot);

	// Case 3: Requested family is healthy enough → no override.
	if (overrideReason === null) {
		return usageAwareResolverResult({
			resolvedModelId: requested,
			overrideApplied: false,
			originalModelId: requested,
		});
	}

	// At this point we need an alternative.

	// Build candidate snapshot list according to allowCrossFamily.
	const candidateSnapshots: UsageAwareModelResolverUsageSnapshotV1[] = [];
	for (const s of snapshots) {
		const fam = normalizeSnapshotFamily(s.providerFamily);
		if (fam === null) continue;
		if (!allowCrossFamily && fam !== requestedFamily) continue;
		if (fam === requestedFamily) {
			// Don't recommend the same unhealthy family.
			continue;
		}
		if (!snapshotIsHealthy(s)) continue;
		candidateSnapshots.push(s);
	}

	// Sort: ok before warning, then remainingPercent descending.
	candidateSnapshots.sort((a, b) => {
		const aRank = a.alertLevel === "ok" ? 0 : 1;
		const bRank = b.alertLevel === "ok" ? 0 : 1;
		if (aRank !== bRank) return aRank - bRank;
		return b.remainingPercent - a.remainingPercent;
	});

	for (const candidate of candidateSnapshots) {
		const fam = normalizeSnapshotFamily(candidate.providerFamily);
		if (fam === null) continue;
		const match = available.find((m) => modelIdMatchesFamily(m, fam));
		if (match) {
			return usageAwareResolverResult({
				resolvedModelId: match,
				overrideApplied: true,
				overrideReason,
				originalModelId: requested,
			});
		}
	}

	// No alternative found → fail-open with original.
	const fallbackReason = allowCrossFamily
		? "no_healthy_alternative_family_with_available_model"
		: "same_family_only_no_available_model";
	return usageAwareResolverResult({
		resolvedModelId: requested,
		overrideApplied: false,
		originalModelId: requested,
		fallbackToOriginal: true,
		fallbackToOriginalReason: fallbackReason,
	});
}
