/**
 * FlowDeskModelCapabilityProfileV1
 * P7-S13.7: Model capability profile contract for operational intelligence model selection.
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

// ─── Category fitness types ───────────────────────────────────────────────────

export type FlowDeskModelCapabilityProfileCategoryV1 =
	| "schema_only"
	| "implementation"
	| "integration"
	| "orchestration"
	| "security_boundary"
	| "design";

/** Each value is an integer 1..10 representing model fitness for the category. */
export type FlowDeskCategoryFitnessMapV1 = Record<FlowDeskModelCapabilityProfileCategoryV1, number>;

const CAPABILITY_PROFILE_CATEGORIES: readonly FlowDeskModelCapabilityProfileCategoryV1[] = [
	"schema_only",
	"implementation",
	"integration",
	"orchestration",
	"security_boundary",
	"design",
];

// ─── CONTRACT: FlowDeskModelCapabilityProfileV1 ───────────────────────────────

export interface FlowDeskModelCapabilityProfileV1 {
	schema_version: "flowdesk.model_capability_profile.v1";
	profile_id: string;
	model_ref: string;
	provider_qualified_model_id: string;
	scored_at: string;
	category_fitness: FlowDeskCategoryFitnessMapV1;
	complexity_handling_score: number;
	authority_sensitivity_score: number;
	evidence_refs: string[];
	freshness_ttl_seconds: number;
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
	"profile_id",
	"model_ref",
	"provider_qualified_model_id",
	"scored_at",
	"category_fitness",
	"complexity_handling_score",
	"authority_sensitivity_score",
	"evidence_refs",
	"freshness_ttl_seconds",
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

function validateIntegerRange(value: unknown, label: string, min: number, max: number): string[] {
	if (!Number.isInteger(value) || (value as number) < min || (value as number) > max) {
		return [`${label} must be an integer ${min}-${max}`];
	}
	return [];
}

function validateCategoryFitnessMap(value: unknown, label: string): string[] {
	const errors: string[] = [];
	if (!isRecord(value)) {
		errors.push(`${label} must be an object`);
		return errors;
	}
	const map = value as Record<string, unknown>;
	for (const cat of CAPABILITY_PROFILE_CATEGORIES) {
		if (!(cat in map)) {
			errors.push(`${label}.${cat} is required`);
		} else {
			errors.push(...validateIntegerRange(map[cat], `${label}.${cat}`, 1, 10));
		}
	}
	// Reject unknown category keys
	for (const key of Object.keys(map)) {
		if (!(CAPABILITY_PROFILE_CATEGORIES as readonly string[]).includes(key)) {
			errors.push(`${label} unknown category: ${key}`);
		}
	}
	return errors;
}

export function createFlowDeskModelCapabilityProfileV1(input: {
	profileId: string;
	modelRef: string;
	providerQualifiedModelId: string;
	scoredAt: string;
	categoryFitness: FlowDeskCategoryFitnessMapV1;
	complexityHandlingScore: number;
	authoritySensitivityScore: number;
	evidenceRefs: string[];
	freshnessTtlSeconds: number;
}): { ok: boolean; errors: string[]; profile?: FlowDeskModelCapabilityProfileV1 } {
	const errors: string[] = [];

	errors.push(...validateOpaqueId(input.profileId, "profileId").errors);
	errors.push(...validateOpaqueRef(input.modelRef, "modelRef").errors);

	// Validate provider_qualified_model_id: non-empty string with "/" separator
	if (typeof input.providerQualifiedModelId !== "string" || !input.providerQualifiedModelId.includes("/") || input.providerQualifiedModelId.length < 3) {
		errors.push("providerQualifiedModelId must be a non-empty string with '/' separator");
	}

	errors.push(...validateTimestamp(input.scoredAt, "scoredAt").errors);
	errors.push(...validateCategoryFitnessMap(input.categoryFitness, "categoryFitness"));
	errors.push(...validateIntegerRange(input.complexityHandlingScore, "complexityHandlingScore", 1, 10));
	errors.push(...validateIntegerRange(input.authoritySensitivityScore, "authoritySensitivityScore", 1, 10));

	if (!Array.isArray(input.evidenceRefs) || input.evidenceRefs.length < 1 || input.evidenceRefs.length > 16) {
		errors.push("evidenceRefs must be a non-empty array of 1-16 elements");
	} else {
		for (const [i, ref] of input.evidenceRefs.entries()) {
			errors.push(...validateOpaqueRef(ref, `evidenceRefs[${i}]`).errors);
		}
	}

	if (!Number.isInteger(input.freshnessTtlSeconds) || input.freshnessTtlSeconds < 3600 || input.freshnessTtlSeconds > 2592000) {
		errors.push("freshnessTtlSeconds must be an integer 3600..2592000");
	}

	// Check raw payload markers in string fields
	if (typeof input.providerQualifiedModelId === "string") {
		errors.push(...validateNoForbiddenRawPayloads(input.providerQualifiedModelId, "providerQualifiedModelId").errors);
	}

	if (errors.length > 0) return { ok: false, errors };

	const profile: FlowDeskModelCapabilityProfileV1 = {
		schema_version: "flowdesk.model_capability_profile.v1",
		profile_id: input.profileId,
		model_ref: input.modelRef,
		provider_qualified_model_id: input.providerQualifiedModelId,
		scored_at: input.scoredAt,
		category_fitness: input.categoryFitness,
		complexity_handling_score: input.complexityHandlingScore,
		authority_sensitivity_score: input.authoritySensitivityScore,
		evidence_refs: input.evidenceRefs,
		freshness_ttl_seconds: input.freshnessTtlSeconds,
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

	return { ok: true, errors: [], profile };
}

export function validateFlowDeskModelCapabilityProfileV1(value: unknown): ValidationResult {
	if (!isRecord(value)) return invalid("model capability profile must be an object");
	const record = value as Record<string, unknown>;
	const errors: string[] = [];

	errors.push(...rejectUnknownProperties(record, ALLOWED_FIELDS, "model capability profile").errors);

	if (record.schema_version !== "flowdesk.model_capability_profile.v1") errors.push("invalid schema_version");
	if (record.release_gate !== "operational_intelligence_later_gate") errors.push("invalid release_gate");

	errors.push(...validateOpaqueId(record.profile_id, "profile_id").errors);
	errors.push(...validateOpaqueRef(record.model_ref, "model_ref").errors);

	if (typeof record.provider_qualified_model_id !== "string" || !record.provider_qualified_model_id.includes("/") || record.provider_qualified_model_id.length < 3) {
		errors.push("provider_qualified_model_id must be a non-empty string with '/' separator");
	} else {
		errors.push(...validateNoForbiddenRawPayloads(record.provider_qualified_model_id, "provider_qualified_model_id").errors);
	}

	errors.push(...validateTimestamp(record.scored_at, "scored_at").errors);
	errors.push(...validateCategoryFitnessMap(record.category_fitness, "category_fitness"));
	errors.push(...validateIntegerRange(record.complexity_handling_score, "complexity_handling_score", 1, 10));
	errors.push(...validateIntegerRange(record.authority_sensitivity_score, "authority_sensitivity_score", 1, 10));

	if (!Array.isArray(record.evidence_refs) || record.evidence_refs.length < 1 || record.evidence_refs.length > 16) {
		errors.push("evidence_refs must be a non-empty array of 1-16 elements");
	} else {
		for (const [i, ref] of (record.evidence_refs as unknown[]).entries()) {
			errors.push(...validateOpaqueRef(ref, `evidence_refs[${i}]`).errors);
		}
	}

	if (!Number.isInteger(record.freshness_ttl_seconds) || (record.freshness_ttl_seconds as number) < 3600 || (record.freshness_ttl_seconds as number) > 2592000) {
		errors.push("freshness_ttl_seconds must be an integer 3600..2592000");
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

	errors.push(...validateNoForbiddenRawPayloads(record, "model capability profile").errors);

	return errors.length === 0 ? valid() : invalid(...errors);
}

// ─── Initial pre-seeded model profiles ───────────────────────────────────────

const BASE_FLAGS = {
	advisory_only: true as const,
	non_authorizing: true as const,
	release_gate: "operational_intelligence_later_gate" as const,
	dispatch_authority_enabled: false as const,
	approval_authority_enabled: false as const,
	provider_authority_enabled: false as const,
	runtime_authority_enabled: false as const,
	external_write_authority_enabled: false as const,
	remote_write_authority_enabled: false as const,
	fallback_authority_enabled: false as const,
	lane_launch_authority_enabled: false as const,
	write_authority_enabled: false as const,
	hard_chat_authority_enabled: false as const,
	model_selection_authority_enabled: false as const,
	ranking_authority_enabled: false as const,
};

export const FLOWDESK_INITIAL_MODEL_PROFILES: FlowDeskModelCapabilityProfileV1[] = [
	{
		schema_version: "flowdesk.model_capability_profile.v1",
		profile_id: "cap-profile-claude-opus-4-8",
		model_ref: "cap-profile-claude-opus-4-8",
		provider_qualified_model_id: "anthropic/claude-opus-4-8",
		scored_at: "2026-06-07T00:00:00.000Z",
		category_fitness: {
			schema_only: 9,
			implementation: 9,
			integration: 9,
			orchestration: 10,
			security_boundary: 10,
			design: 10,
		},
		complexity_handling_score: 8,
		authority_sensitivity_score: 10,
		evidence_refs: ["evidence-initial-estimate-opus-4-8"],
		freshness_ttl_seconds: 604800,
		...BASE_FLAGS,
	},
	{
		schema_version: "flowdesk.model_capability_profile.v1",
		profile_id: "cap-profile-claude-opus-4-7",
		model_ref: "cap-profile-claude-opus-4-7",
		provider_qualified_model_id: "anthropic/claude-opus-4-7",
		scored_at: "2026-06-07T00:00:00.000Z",
		category_fitness: {
			schema_only: 9,
			implementation: 8,
			integration: 8,
			orchestration: 8,
			security_boundary: 9,
			design: 9,
		},
		complexity_handling_score: 8,
		authority_sensitivity_score: 9,
		evidence_refs: ["evidence-initial-estimate-opus-4-7"],
		freshness_ttl_seconds: 604800,
		...BASE_FLAGS,
	},
	{
		schema_version: "flowdesk.model_capability_profile.v1",
		profile_id: "cap-profile-claude-sonnet-4-6",
		model_ref: "cap-profile-claude-sonnet-4-6",
		provider_qualified_model_id: "anthropic/claude-sonnet-4-6",
		scored_at: "2026-06-07T00:00:00.000Z",
		category_fitness: {
			schema_only: 9,
			implementation: 7,
			integration: 7,
			orchestration: 7,
			security_boundary: 8,
			design: 9,
		},
		complexity_handling_score: 7,
		authority_sensitivity_score: 8,
		evidence_refs: ["evidence-initial-estimate-sonnet-4-6"],
		freshness_ttl_seconds: 604800,
		...BASE_FLAGS,
	},
	{
		schema_version: "flowdesk.model_capability_profile.v1",
		profile_id: "cap-profile-claude-haiku-4-5",
		model_ref: "cap-profile-claude-haiku-4-5",
		provider_qualified_model_id: "anthropic/claude-haiku-4-5",
		scored_at: "2026-06-07T00:00:00.000Z",
		category_fitness: {
			schema_only: 6,
			implementation: 5,
			integration: 5,
			orchestration: 5,
			security_boundary: 7,
			design: 5,
		},
		complexity_handling_score: 5,
		authority_sensitivity_score: 7,
		evidence_refs: ["evidence-initial-estimate-haiku-4-5"],
		freshness_ttl_seconds: 604800,
		...BASE_FLAGS,
	},
	{
		schema_version: "flowdesk.model_capability_profile.v1",
		profile_id: "cap-profile-gpt-5-5",
		model_ref: "cap-profile-gpt-5-5",
		provider_qualified_model_id: "openai/gpt-5.5",
		scored_at: "2026-06-07T00:00:00.000Z",
		category_fitness: {
			schema_only: 8,
			implementation: 9,
			integration: 9,
			orchestration: 8,
			security_boundary: 6,
			design: 8,
		},
		complexity_handling_score: 10,
		authority_sensitivity_score: 6,
		evidence_refs: ["evidence-initial-estimate-gpt-5-5"],
		freshness_ttl_seconds: 604800,
		...BASE_FLAGS,
	},
	{
		schema_version: "flowdesk.model_capability_profile.v1",
		profile_id: "cap-profile-gpt-5-5-fast",
		model_ref: "cap-profile-gpt-5-5-fast",
		provider_qualified_model_id: "openai/gpt-5.5-fast",
		scored_at: "2026-06-07T00:00:00.000Z",
		category_fitness: {
			schema_only: 7,
			implementation: 7,
			integration: 7,
			orchestration: 7,
			security_boundary: 6,
			design: 7,
		},
		complexity_handling_score: 8,
		authority_sensitivity_score: 6,
		evidence_refs: ["evidence-initial-estimate-gpt-5-5-fast"],
		freshness_ttl_seconds: 604800,
		...BASE_FLAGS,
	},
	{
		schema_version: "flowdesk.model_capability_profile.v1",
		profile_id: "cap-profile-gpt-5-3-codex-spark",
		model_ref: "cap-profile-gpt-5-3-codex-spark",
		provider_qualified_model_id: "openai/gpt-5.3-codex-spark",
		scored_at: "2026-06-07T00:00:00.000Z",
		category_fitness: {
			schema_only: 6,
			implementation: 9,
			integration: 9,
			orchestration: 5,
			security_boundary: 3,
			design: 5,
		},
		complexity_handling_score: 9,
		authority_sensitivity_score: 3,
		evidence_refs: ["evidence-initial-estimate-codex-spark"],
		freshness_ttl_seconds: 604800,
		...BASE_FLAGS,
	},
	{
		schema_version: "flowdesk.model_capability_profile.v1",
		profile_id: "cap-profile-gpt-5-4-mini",
		model_ref: "cap-profile-gpt-5-4-mini",
		provider_qualified_model_id: "openai/gpt-5.4-mini",
		scored_at: "2026-06-07T00:00:00.000Z",
		category_fitness: {
			schema_only: 7,
			implementation: 7,
			integration: 7,
			orchestration: 6,
			security_boundary: 5,
			design: 6,
		},
		complexity_handling_score: 6,
		authority_sensitivity_score: 4,
		evidence_refs: ["evidence-initial-estimate-gpt-5-4-mini"],
		freshness_ttl_seconds: 604800,
		...BASE_FLAGS,
	},
	{
		schema_version: "flowdesk.model_capability_profile.v1",
		profile_id: "cap-profile-gpt-5-4-mini-fast",
		model_ref: "cap-profile-gpt-5-4-mini-fast",
		provider_qualified_model_id: "openai/gpt-5.4-mini-fast",
		scored_at: "2026-06-07T00:00:00.000Z",
		category_fitness: {
			schema_only: 6,
			implementation: 5,
			integration: 5,
			orchestration: 5,
			security_boundary: 4,
			design: 5,
		},
		complexity_handling_score: 5,
		authority_sensitivity_score: 4,
		evidence_refs: ["evidence-initial-estimate-gpt-5-4-mini-fast"],
		freshness_ttl_seconds: 604800,
		...BASE_FLAGS,
	},
	{
		schema_version: "flowdesk.model_capability_profile.v1",
		profile_id: "cap-profile-gemini-3-1-pro-preview",
		model_ref: "cap-profile-gemini-3-1-pro-preview",
		provider_qualified_model_id: "google/gemini-3.1-pro-preview",
		scored_at: "2026-06-07T00:00:00.000Z",
		category_fitness: {
			schema_only: 7,
			implementation: 9,
			integration: 8,
			orchestration: 8,
			security_boundary: 5,
			design: 8,
		},
		complexity_handling_score: 9,
		authority_sensitivity_score: 5,
		evidence_refs: ["evidence-initial-estimate-gemini-pro"],
		freshness_ttl_seconds: 604800,
		...BASE_FLAGS,
	},
	{
		schema_version: "flowdesk.model_capability_profile.v1",
		profile_id: "cap-profile-gemini-3-flash-preview",
		model_ref: "cap-profile-gemini-3-flash-preview",
		provider_qualified_model_id: "google/gemini-3-flash-preview",
		scored_at: "2026-06-07T00:00:00.000Z",
		category_fitness: {
			schema_only: 6,
			implementation: 6,
			integration: 6,
			orchestration: 5,
			security_boundary: 4,
			design: 5,
		},
		complexity_handling_score: 6,
		authority_sensitivity_score: 4,
		evidence_refs: ["evidence-initial-estimate-gemini-flash"],
		freshness_ttl_seconds: 604800,
		...BASE_FLAGS,
	},
	{
		schema_version: "flowdesk.model_capability_profile.v1",
		profile_id: "cap-profile-gemini-3-1-flash-lite",
		model_ref: "cap-profile-gemini-3-1-flash-lite",
		provider_qualified_model_id: "google/gemini-3.1-flash-lite-preview",
		scored_at: "2026-06-07T00:00:00.000Z",
		category_fitness: {
			schema_only: 4,
			implementation: 4,
			integration: 4,
			orchestration: 3,
			security_boundary: 2,
			design: 3,
		},
		complexity_handling_score: 3,
		authority_sensitivity_score: 2,
		evidence_refs: ["evidence-initial-estimate-gemini-flash-lite"],
		freshness_ttl_seconds: 604800,
		...BASE_FLAGS,
	},
];
