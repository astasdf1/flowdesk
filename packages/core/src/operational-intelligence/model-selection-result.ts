/**
 * FlowDeskModelSelectionResultV1 + selectModelForBlock()
 * P7-S13.7: Model selection result contract and selection algorithm.
 * Advisory-only, non-authorizing, release_gate: operational_intelligence_later_gate.
 */
import {
	type ValidationResult,
	valid,
	invalid,
	validateNoForbiddenRawPayloads,
	validateOpaqueId,
	validateOpaqueRef,
	validateTimestamp,
	isRecord,
	rejectUnknownProperties,
} from "./shared.js";
import type { FlowDeskModelCapabilityProfileV1, FlowDeskModelCapabilityProfileCategoryV1 } from "./model-capability-profile.js";
import type { FlowDeskBlockSelectionCriteriaV1 } from "./block-selection-criteria.js";
import type { FlowDeskRoutingAdvisoryEvaluationV1, FlowDeskRoutingInfluencePolicyV1 } from "./routing-advisory.js";

// ─── Supporting types ─────────────────────────────────────────────────────────

export type FlowDeskModelSelectionPurposeV1 =
	| "block_decomposition"   // selects high-performance model for decomposing complex blocks
	| "proposal_generation";  // selects appropriate model for generating proposals

const VALID_SELECTION_PURPOSES: readonly FlowDeskModelSelectionPurposeV1[] = [
	"block_decomposition",
	"proposal_generation",
];

export type FlowDeskModelSelectionReasonV1 =
	| "highest_quota_among_eligible"
	| "best_fitness_eligible"
	| "only_eligible"
	| "fallback_escalation";

const VALID_SELECTION_REASONS: readonly FlowDeskModelSelectionReasonV1[] = [
	"highest_quota_among_eligible",
	"best_fitness_eligible",
	"only_eligible",
	"fallback_escalation",
];

export type FlowDeskIneligibleModelFailedThresholdV1 =
	| "category_fitness"
	| "complexity_handling"
	| "authority_score"
	| "profile_expired"
	| "quota_exhausted";

const VALID_FAILED_THRESHOLDS: readonly string[] = [
	"category_fitness",
	"complexity_handling",
	"authority_score",
	"profile_expired",
	"quota_exhausted",
];

export interface FlowDeskIneligibleModelEntryV1 {
	model_ref: string;
	failed_threshold: FlowDeskIneligibleModelFailedThresholdV1;
	actual_score: number;   // integer 0-5
	required_score: number; // integer 0-5
}

// ─── CONTRACT: FlowDeskModelSelectionResultV1 ─────────────────────────────────

export interface FlowDeskModelSelectionResultV1 {
	schema_version: "flowdesk.model_selection_result.v1";
	selection_id: string;
	block_scoring_ref: string;
	criteria_ref: string;
	evaluated_at: string;
	evaluated_model_profile_refs: string[];
	eligible_model_refs: string[];
	selected_model_ref: string;
	selected_provider_qualified_model_id: string;
	selection_reason: FlowDeskModelSelectionReasonV1;
	ineligible_model_entries: FlowDeskIneligibleModelEntryV1[];
	quota_snapshot_ref: string;
	selection_failed: boolean;
	escalation_required: boolean;
	selection_purpose?: FlowDeskModelSelectionPurposeV1;
	// 12 authority flags + advisory + non-authorizing + release gate
	advisory_only: true;
	non_authorizing: true;
	release_gate: "operational_intelligence_later_gate";
	dispatch_authority_enabled: false;
	approval_authority_enabled: false;
	provider_authority_enabled: false;
	runtime_authority_enabled: false;
	external_write_authority_enabled: false;
	remote_write_authority_enabled: false;
	fallback_authority_enabled: false;
	lane_launch_authority_enabled: false;
	write_authority_enabled: false;
	hard_chat_authority_enabled: false;
	model_selection_authority_enabled: false;
	ranking_authority_enabled: false;
}

const ALLOWED_FIELDS: readonly string[] = [
	"schema_version",
	"selection_id",
	"block_scoring_ref",
	"criteria_ref",
	"evaluated_at",
	"evaluated_model_profile_refs",
	"eligible_model_refs",
	"selected_model_ref",
	"selected_provider_qualified_model_id",
	"selection_reason",
	"ineligible_model_entries",
	"quota_snapshot_ref",
	"selection_failed",
	"escalation_required",
	"selection_purpose",
	"advisory_only",
	"non_authorizing",
	"release_gate",
	"dispatch_authority_enabled",
	"approval_authority_enabled",
	"provider_authority_enabled",
	"runtime_authority_enabled",
	"external_write_authority_enabled",
	"remote_write_authority_enabled",
	"fallback_authority_enabled",
	"lane_launch_authority_enabled",
	"write_authority_enabled",
	"hard_chat_authority_enabled",
	"model_selection_authority_enabled",
	"ranking_authority_enabled",
];

const INELIGIBLE_ENTRY_ALLOWED_FIELDS: readonly string[] = [
	"model_ref",
	"failed_threshold",
	"actual_score",
	"required_score",
];

function validateIneligibleEntry(value: unknown, label: string): string[] {
	const errors: string[] = [];
	if (!isRecord(value)) {
		errors.push(`${label} must be an object`);
		return errors;
	}
	const entry = value as Record<string, unknown>;
	errors.push(...rejectUnknownProperties(entry, INELIGIBLE_ENTRY_ALLOWED_FIELDS, label).errors);
	errors.push(...validateOpaqueRef(entry.model_ref, `${label}.model_ref`).errors);
	if (typeof entry.failed_threshold !== "string" || !VALID_FAILED_THRESHOLDS.includes(entry.failed_threshold)) {
		errors.push(`${label}.failed_threshold must be one of: ${VALID_FAILED_THRESHOLDS.join(", ")}`);
	}
	if (!Number.isInteger(entry.actual_score) || (entry.actual_score as number) < 0 || (entry.actual_score as number) > 5) {
		errors.push(`${label}.actual_score must be an integer 0-5`);
	}
	if (!Number.isInteger(entry.required_score) || (entry.required_score as number) < 0 || (entry.required_score as number) > 5) {
		errors.push(`${label}.required_score must be an integer 0-5`);
	}
	return errors;
}

export function createFlowDeskModelSelectionResultV1(input: {
	selectionId: string;
	blockScoringRef: string;
	criteriaRef: string;
	evaluatedAt: string;
	evaluatedModelProfileRefs: string[];
	eligibleModelRefs: string[];
	selectedModelRef: string;
	selectedProviderQualifiedModelId: string;
	selectionReason: FlowDeskModelSelectionReasonV1;
	ineligibleModelEntries: FlowDeskIneligibleModelEntryV1[];
	quotaSnapshotRef: string;
	selectionPurpose?: FlowDeskModelSelectionPurposeV1;
}): { ok: boolean; errors: string[]; result?: FlowDeskModelSelectionResultV1 } {
	const errors: string[] = [];

	errors.push(...validateOpaqueId(input.selectionId, "selectionId").errors);
	errors.push(...validateOpaqueRef(input.blockScoringRef, "blockScoringRef").errors);
	errors.push(...validateOpaqueRef(input.criteriaRef, "criteriaRef").errors);
	errors.push(...validateTimestamp(input.evaluatedAt, "evaluatedAt").errors);
	errors.push(...validateOpaqueRef(input.quotaSnapshotRef, "quotaSnapshotRef").errors);

	if (!Array.isArray(input.evaluatedModelProfileRefs) || input.evaluatedModelProfileRefs.length < 1 || input.evaluatedModelProfileRefs.length > 32) {
		errors.push("evaluatedModelProfileRefs must be a non-empty array of 1-32 elements");
	} else {
		for (const [i, ref] of input.evaluatedModelProfileRefs.entries()) {
			errors.push(...validateOpaqueRef(ref, `evaluatedModelProfileRefs[${i}]`).errors);
		}
	}

	if (!Array.isArray(input.eligibleModelRefs) || input.eligibleModelRefs.length > 32) {
		errors.push("eligibleModelRefs must be an array of 0-32 elements");
	} else {
		for (const [i, ref] of input.eligibleModelRefs.entries()) {
			errors.push(...validateOpaqueRef(ref, `eligibleModelRefs[${i}]`).errors);
		}
	}

	// Derive selection_failed and escalation_required
	const selectionFailed = Array.isArray(input.eligibleModelRefs) && input.eligibleModelRefs.length === 0;
	const escalationRequired = selectionFailed;

	// Cross-field validations
	if (input.selectedModelRef !== "" && Array.isArray(input.eligibleModelRefs) && input.eligibleModelRefs.length === 0) {
		errors.push("selectedModelRef must be '' when eligibleModelRefs is empty");
	}

	if (input.selectedModelRef !== "" && Array.isArray(input.eligibleModelRefs) && !input.eligibleModelRefs.includes(input.selectedModelRef)) {
		errors.push("selectedModelRef must be an element of eligibleModelRefs when not empty");
	}

	if (!VALID_SELECTION_REASONS.includes(input.selectionReason)) {
		errors.push(`selectionReason must be one of: ${VALID_SELECTION_REASONS.join(", ")}`);
	}

	if (!Array.isArray(input.ineligibleModelEntries) || input.ineligibleModelEntries.length > 32) {
		errors.push("ineligibleModelEntries must be an array of 0-32 elements");
	}

	if (errors.length > 0) return { ok: false, errors };

	const result: FlowDeskModelSelectionResultV1 = {
		schema_version: "flowdesk.model_selection_result.v1",
		selection_id: input.selectionId,
		block_scoring_ref: input.blockScoringRef,
		criteria_ref: input.criteriaRef,
		evaluated_at: input.evaluatedAt,
		evaluated_model_profile_refs: input.evaluatedModelProfileRefs,
		eligible_model_refs: input.eligibleModelRefs,
		selected_model_ref: input.selectedModelRef,
		selected_provider_qualified_model_id: input.selectedProviderQualifiedModelId,
		selection_reason: input.selectionReason,
		ineligible_model_entries: input.ineligibleModelEntries,
		quota_snapshot_ref: input.quotaSnapshotRef,
		selection_failed: selectionFailed,
		escalation_required: escalationRequired,
		...(input.selectionPurpose !== undefined ? { selection_purpose: input.selectionPurpose } : {}),
		advisory_only: true,
		non_authorizing: true,
		release_gate: "operational_intelligence_later_gate",
		dispatch_authority_enabled: false,
		approval_authority_enabled: false,
		provider_authority_enabled: false,
		runtime_authority_enabled: false,
		external_write_authority_enabled: false,
		remote_write_authority_enabled: false,
		fallback_authority_enabled: false,
		lane_launch_authority_enabled: false,
		write_authority_enabled: false,
		hard_chat_authority_enabled: false,
		model_selection_authority_enabled: false,
		ranking_authority_enabled: false,
	};

	return { ok: true, errors: [], result };
}

export function validateFlowDeskModelSelectionResultV1(value: unknown): ValidationResult {
	if (!isRecord(value)) return invalid("model selection result must be an object");
	const record = value as Record<string, unknown>;
	const errors: string[] = [];

	errors.push(...rejectUnknownProperties(record, ALLOWED_FIELDS, "model selection result").errors);

	if (record.schema_version !== "flowdesk.model_selection_result.v1") errors.push("invalid schema_version");
	if (record.release_gate !== "operational_intelligence_later_gate") errors.push("invalid release_gate");

	errors.push(...validateOpaqueId(record.selection_id, "selection_id").errors);
	errors.push(...validateOpaqueRef(record.block_scoring_ref, "block_scoring_ref").errors);
	errors.push(...validateOpaqueRef(record.criteria_ref, "criteria_ref").errors);
	errors.push(...validateTimestamp(record.evaluated_at, "evaluated_at").errors);
	errors.push(...validateOpaqueRef(record.quota_snapshot_ref, "quota_snapshot_ref").errors);

	// evaluated_model_profile_refs: non-empty, 1-32
	if (!Array.isArray(record.evaluated_model_profile_refs) || (record.evaluated_model_profile_refs as unknown[]).length < 1 || (record.evaluated_model_profile_refs as unknown[]).length > 32) {
		errors.push("evaluated_model_profile_refs must be a non-empty array of 1-32 elements");
	} else {
		for (const [i, ref] of (record.evaluated_model_profile_refs as unknown[]).entries()) {
			errors.push(...validateOpaqueRef(ref, `evaluated_model_profile_refs[${i}]`).errors);
		}
	}

	// eligible_model_refs: 0-32
	if (!Array.isArray(record.eligible_model_refs) || (record.eligible_model_refs as unknown[]).length > 32) {
		errors.push("eligible_model_refs must be an array of 0-32 elements");
	} else {
		for (const [i, ref] of (record.eligible_model_refs as unknown[]).entries()) {
			errors.push(...validateOpaqueRef(ref, `eligible_model_refs[${i}]`).errors);
		}
	}

	// ineligible_model_entries: 0-32
	if (!Array.isArray(record.ineligible_model_entries) || (record.ineligible_model_entries as unknown[]).length > 32) {
		errors.push("ineligible_model_entries must be an array of 0-32 elements");
	} else {
		for (const [i, entry] of (record.ineligible_model_entries as unknown[]).entries()) {
			errors.push(...validateIneligibleEntry(entry, `ineligible_model_entries[${i}]`));
		}
	}

	// selection_reason
	if (typeof record.selection_reason !== "string" || !VALID_SELECTION_REASONS.includes(record.selection_reason as FlowDeskModelSelectionReasonV1)) {
		errors.push(`selection_reason must be one of: ${VALID_SELECTION_REASONS.join(", ")}`);
	}

	// selection_failed consistency
	const eligibleCount = Array.isArray(record.eligible_model_refs) ? (record.eligible_model_refs as unknown[]).length : -1;
	const expectedFailed = eligibleCount === 0;
	if (typeof record.selection_failed !== "boolean") {
		errors.push("selection_failed must be a boolean");
	} else if (record.selection_failed !== expectedFailed) {
		errors.push("selection_failed must equal (eligible_model_refs.length === 0)");
	}

	// selection_failed → selection_reason must be "fallback_escalation"
	if (record.selection_failed === true && record.selection_reason !== "fallback_escalation") {
		errors.push("selection_failed=true requires selection_reason='fallback_escalation'");
	}

	// !selection_failed → selection_reason must NOT be "fallback_escalation"
	if (record.selection_failed === false && record.selection_reason === "fallback_escalation") {
		errors.push("selection_reason='fallback_escalation' requires selection_failed=true");
	}

	// escalation_required
	if (typeof record.escalation_required !== "boolean") {
		errors.push("escalation_required must be a boolean");
	} else if (record.selection_failed === true && record.escalation_required !== true) {
		errors.push("escalation_required must be true when selection_failed=true");
	}

	// selection_purpose (optional)
	if (record.selection_purpose !== undefined) {
		if (typeof record.selection_purpose !== "string" || !VALID_SELECTION_PURPOSES.includes(record.selection_purpose as FlowDeskModelSelectionPurposeV1)) {
			errors.push(`selection_purpose must be one of: ${VALID_SELECTION_PURPOSES.join(", ")}`);
		}
	}

	// selected_model_ref must be in eligible_model_refs when not ""
	if (typeof record.selected_model_ref === "string" && record.selected_model_ref !== "") {
		if (Array.isArray(record.eligible_model_refs) && !(record.eligible_model_refs as string[]).includes(record.selected_model_ref)) {
			errors.push("selected_model_ref must be an element of eligible_model_refs when not empty");
		}
	}

	// eligible + ineligible count === evaluated count
	const evaluatedCount = Array.isArray(record.evaluated_model_profile_refs) ? (record.evaluated_model_profile_refs as unknown[]).length : -1;
	const ineligibleCount = Array.isArray(record.ineligible_model_entries) ? (record.ineligible_model_entries as unknown[]).length : 0;
	if (evaluatedCount >= 0 && eligibleCount >= 0 && (eligibleCount + ineligibleCount) !== evaluatedCount) {
		errors.push(`eligible (${eligibleCount}) + ineligible (${ineligibleCount}) must equal evaluated (${evaluatedCount})`);
	}

	// Authority flags
	if (record.advisory_only !== true) errors.push("advisory_only must be true");
	if (record.non_authorizing !== true) errors.push("non_authorizing must be true");
	if (record.dispatch_authority_enabled !== false) errors.push("dispatch_authority_enabled must be false");
	if (record.approval_authority_enabled !== false) errors.push("approval_authority_enabled must be false");
	if (record.provider_authority_enabled !== false) errors.push("provider_authority_enabled must be false");
	if (record.runtime_authority_enabled !== false) errors.push("runtime_authority_enabled must be false");
	if (record.external_write_authority_enabled !== false) errors.push("external_write_authority_enabled must be false");
	if (record.remote_write_authority_enabled !== false) errors.push("remote_write_authority_enabled must be false");
	if (record.fallback_authority_enabled !== false) errors.push("fallback_authority_enabled must be false");
	if (record.lane_launch_authority_enabled !== false) errors.push("lane_launch_authority_enabled must be false");
	if (record.write_authority_enabled !== false) errors.push("write_authority_enabled must be false");
	if (record.hard_chat_authority_enabled !== false) errors.push("hard_chat_authority_enabled must be false");
	if (record.model_selection_authority_enabled !== false) errors.push("model_selection_authority_enabled must be false");
	if (record.ranking_authority_enabled !== false) errors.push("ranking_authority_enabled must be false");

	errors.push(...validateNoForbiddenRawPayloads(record, "model selection result").errors);

	return errors.length === 0 ? valid() : invalid(...errors);
}

// ─── selectModelForBlock() ────────────────────────────────────────────────────

export function selectModelForBlock(input: {
	criteria: FlowDeskBlockSelectionCriteriaV1;
	profiles: FlowDeskModelCapabilityProfileV1[];
	quotaMap: Map<string, number>; // model_ref → remaining_percent (0-100)
	evaluatedAt: string;
	selectionId: string;
	quotaSnapshotRef: string;
	criteriaRef: string;
	purpose?: FlowDeskModelSelectionPurposeV1;
	routingAdvisory?: FlowDeskRoutingAdvisoryEvaluationV1;
	routingInfluencePolicy?: FlowDeskRoutingInfluencePolicyV1;
}): { ok: boolean; errors: string[]; result?: FlowDeskModelSelectionResultV1 } {
	const errors: string[] = [];

	if (!input.profiles || input.profiles.length === 0) {
		errors.push("profiles must be a non-empty array");
		return { ok: false, errors };
	}

	const evaluatedAt = input.evaluatedAt;
	const evaluatedAtMs = Date.parse(evaluatedAt);
	if (!Number.isFinite(evaluatedAtMs)) {
		errors.push("evaluatedAt must be a parseable timestamp");
		return { ok: false, errors };
	}

	const criteria = input.criteria;
	const sourceCategory = criteria.source_category as FlowDeskModelCapabilityProfileCategoryV1;

	const eligibleProfiles: FlowDeskModelCapabilityProfileV1[] = [];
	const ineligibleEntries: FlowDeskIneligibleModelEntryV1[] = [];

	for (const profile of input.profiles) {
		// Step 1: Check expiry
		const scoredAtMs = Date.parse(profile.scored_at);
		const expiryMs = scoredAtMs + profile.freshness_ttl_seconds * 1000;
		if (expiryMs < evaluatedAtMs) {
			ineligibleEntries.push({
				model_ref: profile.model_ref,
				failed_threshold: "profile_expired",
				actual_score: 0,
				required_score: 0,
			});
			continue;
		}

		// Step 2: Check category_fitness
		const categoryFitnessScore = profile.category_fitness[sourceCategory] ?? 0;
		if (categoryFitnessScore < criteria.min_category_fitness_required) {
			ineligibleEntries.push({
				model_ref: profile.model_ref,
				failed_threshold: "category_fitness",
				actual_score: categoryFitnessScore,
				required_score: criteria.min_category_fitness_required,
			});
			continue;
		}

		// Step 3: Check complexity_handling_score
		if (profile.complexity_handling_score < criteria.min_complexity_handling_required) {
			ineligibleEntries.push({
				model_ref: profile.model_ref,
				failed_threshold: "complexity_handling",
				actual_score: profile.complexity_handling_score,
				required_score: criteria.min_complexity_handling_required,
			});
			continue;
		}

		// Step 4: Check authority_sensitivity_score
		if (profile.authority_sensitivity_score < criteria.min_authority_score_required) {
			ineligibleEntries.push({
				model_ref: profile.model_ref,
				failed_threshold: "authority_score",
				actual_score: profile.authority_sensitivity_score,
				required_score: criteria.min_authority_score_required,
			});
			continue;
		}

		// Step 4b: Purpose-based boosted threshold for block_decomposition
		// Requires complexity_handling_score >= 7 (boosted minimum for high-performance decomposition models)
		if (input.purpose === "block_decomposition" && profile.complexity_handling_score < 7) {
			ineligibleEntries.push({
				model_ref: profile.model_ref,
				failed_threshold: "complexity_handling",
				actual_score: profile.complexity_handling_score,
				required_score: 7,
			});
			continue;
		}

		// Step 5: Check quota
		const quota = input.quotaMap.get(profile.model_ref) ?? 0;
		if (quota <= 0) {
			ineligibleEntries.push({
				model_ref: profile.model_ref,
				failed_threshold: "quota_exhausted",
				actual_score: 0,
				required_score: 1,
			});
			continue;
		}

		// Eligible
		eligibleProfiles.push(profile);
	}

	// Steps 7-9: Determine selection
	let selectedModelRef = "";
	let selectedProviderQualifiedModelId = "";
	let selectionReason: FlowDeskModelSelectionReasonV1 = "fallback_escalation";

	if (eligibleProfiles.length === 0) {
		// Step 7: fallback_escalation
		selectionReason = "fallback_escalation";
	} else if (eligibleProfiles.length === 1) {
		// Step 8: only_eligible
		const selected = eligibleProfiles[0];
		selectedModelRef = selected.model_ref;
		selectedProviderQualifiedModelId = selected.provider_qualified_model_id;
		selectionReason = "only_eligible";
	} else {
		// Step 9: Multiple eligible — sort by quota DESC, then fitness DESC.
		// R3-S6: only when quota and fitness are exact ties, an explicitly enabled
		// routing influence policy may use advisory weighted_score as a third-level
		// tie-breaker. Otherwise deterministic input order is preserved by sort index.
		const advisoryByModel = new Map((input.routingAdvisory?.model_summaries ?? []).map((summary) => [summary.model_ref, summary]));
		const routingInfluenceEnabled = input.routingInfluencePolicy?.enabled === true && input.routingInfluencePolicy.tie_quota_delta_percent === 0;
		const minSampleThreshold = input.routingInfluencePolicy?.min_sample_threshold ?? Number.POSITIVE_INFINITY;
		const indexed = eligibleProfiles.map((profile, index) => ({ profile, index }));
		const sorted = [...eligibleProfiles].sort((a, b) => {
			const quotaA = input.quotaMap.get(a.model_ref) ?? 0;
			const quotaB = input.quotaMap.get(b.model_ref) ?? 0;
			if (quotaB !== quotaA) return quotaB - quotaA;
			// Tiebreak: sum of relevant fitness scores DESC
			const fitA = a.category_fitness[sourceCategory] + a.complexity_handling_score + a.authority_sensitivity_score;
			const fitB = b.category_fitness[sourceCategory] + b.complexity_handling_score + b.authority_sensitivity_score;
			if (fitB !== fitA) return fitB - fitA;
			if (routingInfluenceEnabled) {
				const advisoryA = advisoryByModel.get(a.model_ref);
				const advisoryB = advisoryByModel.get(b.model_ref);
				const advisoryAEligible = advisoryA !== undefined && advisoryA.sample_count >= minSampleThreshold;
				const advisoryBEligible = advisoryB !== undefined && advisoryB.sample_count >= minSampleThreshold;
				if (advisoryAEligible && advisoryBEligible && advisoryA!.weighted_score !== advisoryB!.weighted_score) return advisoryB!.weighted_score - advisoryA!.weighted_score;
				if (advisoryAEligible !== advisoryBEligible) return advisoryAEligible ? -1 : 1;
			}
			return indexed.find((entry) => entry.profile === a)!.index - indexed.find((entry) => entry.profile === b)!.index;
		});

		const topQuota = input.quotaMap.get(sorted[0].model_ref) ?? 0;
		const secondQuota = sorted.length > 1 ? (input.quotaMap.get(sorted[1].model_ref) ?? 0) : -1;
		const hasTie = topQuota === secondQuota;

		const selected = sorted[0];
		selectedModelRef = selected.model_ref;
		selectedProviderQualifiedModelId = selected.provider_qualified_model_id;
		selectionReason = hasTie ? "best_fitness_eligible" : "highest_quota_among_eligible";
	}

	const evaluatedModelProfileRefs = input.profiles.map((p) => p.model_ref);
	const eligibleModelRefs = eligibleProfiles.map((p) => p.model_ref);

	return createFlowDeskModelSelectionResultV1({
		selectionId: input.selectionId,
		blockScoringRef: criteria.source_block_id,
		criteriaRef: input.criteriaRef,
		evaluatedAt,
		evaluatedModelProfileRefs,
		eligibleModelRefs,
		selectedModelRef,
		selectedProviderQualifiedModelId,
		selectionReason,
		ineligibleModelEntries: ineligibleEntries,
		quotaSnapshotRef: input.quotaSnapshotRef,
		selectionPurpose: input.purpose,
	});
}
