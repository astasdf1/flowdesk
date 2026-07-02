import { randomUUID } from "node:crypto";

export const FLOWDESK_OMNIGENT_SELECTION_SCHEMA_VERSION_V1 = "flowdesk.omnigent_selection.v1" as const;
export const FLOWDESK_OMNIGENT_SELECTION_AUTHORITY_V1 = "advisory_selection_only" as const;

export type FlowDeskOmnigentTaskRoleV1 = "policy_security" | "architecture" | "implementation" | "verification" | "research" | "general" | "gemini_experimental";
export type FlowDeskOmnigentSelectionStatusV1 = "selected" | "blocked" | "non_dispatchable";
export type FlowDeskOmnigentProviderFamilyV1 = "claude" | "openai" | "gemini";
export type FlowDeskOmnigentConfidenceV1 = "high" | "medium" | "low";

export interface FlowDeskOmnigentSelectionRequestV1 {
	task_id?: unknown;
	task_role?: unknown;
	task_complexity?: unknown;
	task_phase?: unknown;
	task_tier?: unknown;
	complexity?: unknown;
	phase?: unknown;
	tier?: unknown;
	allowed_provider_families?: unknown;
	available_agents?: unknown;
	allowed_agents?: unknown;
	preferred_provider_family?: unknown;
	requires_headless?: unknown;
	provider_usage?: unknown;
	provider_health?: unknown;
	preferred_model?: unknown;
	allowed_models?: unknown;
	model_tier?: unknown;
	modelTier?: unknown;
}

export interface FlowDeskOmnigentSelectionV1 {
	schema_version: typeof FLOWDESK_OMNIGENT_SELECTION_SCHEMA_VERSION_V1;
	selection_id: string;
	task_id: string;
	task_role: FlowDeskOmnigentTaskRoleV1 | "unknown";
	selection_status: FlowDeskOmnigentSelectionStatusV1;
	agent?: string;
	harness?: string;
	model?: string | null;
	provider_family?: FlowDeskOmnigentProviderFamilyV1;
	confidence: FlowDeskOmnigentConfidenceV1;
	reason_codes: string[];
	blocked_labels: string[];
	authority: typeof FLOWDESK_OMNIGENT_SELECTION_AUTHORITY_V1;
	created_at: string;
	expires_at: string;
}

interface RegistryEntry {
	agent: string;
	harness: string;
	model: string | null;
	provider_family: FlowDeskOmnigentProviderFamilyV1;
	reason_code: string;
	confidence: FlowDeskOmnigentConfidenceV1;
	model_tier?: string;
}

const ROLE_VALUES = new Set<FlowDeskOmnigentTaskRoleV1>(["policy_security", "architecture", "implementation", "verification", "research", "general", "gemini_experimental"]);
const PROVIDER_FAMILIES = new Set<FlowDeskOmnigentProviderFamilyV1>(["claude", "openai", "gemini"]);

export const FLOWDESK_OMNIGENT_DEFAULT_REGISTRY_V1: Record<FlowDeskOmnigentTaskRoleV1, readonly RegistryEntry[]> = {
	policy_security: [
		{ agent: "policy-security-agent", harness: "claude-native", model: "claude-opus-4-8", provider_family: "claude", reason_code: "role_policy_security_prefers_deep_reasoning", confidence: "high" },
		{ agent: "policy-security-agent", harness: "claude-native", model: "claude-sonnet-5", model_tier: "sonnet", provider_family: "claude", reason_code: "role_policy_security_prefers_deep_reasoning", confidence: "medium" },
		{ agent: "policy-security-agent", harness: "claude-native", model: "claude-sonnet-4-6", provider_family: "claude", reason_code: "role_policy_security_prefers_deep_reasoning", confidence: "medium" },
		{ agent: "policy-security-agent", harness: "claude-native", model: "claude-haiku-4-5", provider_family: "claude", reason_code: "role_policy_security_prefers_deep_reasoning", confidence: "medium" },
		{ agent: "policy-security-agent", harness: "codex", model: null, provider_family: "openai", reason_code: "role_policy_security_prefers_deep_reasoning", confidence: "medium" },
		{ agent: "policy-security-agent", harness: "codex", model: "openai/gpt-5.5", model_tier: "frontier", provider_family: "openai", reason_code: "role_policy_security_prefers_deep_reasoning", confidence: "medium" },
	],
	architecture: [
		{ agent: "architecture-agent", harness: "codex", model: null, provider_family: "openai", reason_code: "role_architecture_prefers_frontier_reasoning", confidence: "high" },
		{ agent: "architecture-agent", harness: "codex", model: "openai/gpt-5.5", model_tier: "frontier", provider_family: "openai", reason_code: "role_architecture_prefers_frontier_reasoning", confidence: "high" },
		{ agent: "architecture-agent", harness: "codex", model: "openai/gpt-5.4", model_tier: "normal", provider_family: "openai", reason_code: "role_architecture_prefers_frontier_reasoning", confidence: "high" },
		{ agent: "architecture-agent", harness: "claude-native", model: "claude-sonnet-5", model_tier: "sonnet", provider_family: "claude", reason_code: "role_architecture_prefers_frontier_reasoning", confidence: "medium" },
		{ agent: "architecture-agent", harness: "claude-native", model: "claude-sonnet-4-6", provider_family: "claude", reason_code: "role_architecture_prefers_frontier_reasoning", confidence: "medium" },
		{ agent: "architecture-agent", harness: "claude-native", model: "claude-opus-4-8", provider_family: "claude", reason_code: "role_architecture_prefers_frontier_reasoning", confidence: "medium" },
		{ agent: "architecture-agent", harness: "claude-native", model: "claude-haiku-4-5", provider_family: "claude", reason_code: "role_architecture_prefers_frontier_reasoning", confidence: "medium" },
	],
	implementation: [
		{ agent: "implementation-agent", harness: "codex", model: null, provider_family: "openai", reason_code: "role_implementation_prefers_coding_harness", confidence: "high" },
		{ agent: "implementation-agent", harness: "codex", model: "openai/gpt-5.4-mini-fast", model_tier: "fast", provider_family: "openai", reason_code: "role_implementation_prefers_coding_harness", confidence: "high" },
		{ agent: "implementation-agent", harness: "codex", model: "openai/gpt-5.3-codex-spark", model_tier: "spark", provider_family: "openai", reason_code: "role_implementation_prefers_coding_harness", confidence: "medium" },
		{ agent: "implementation-agent", harness: "claude-native", model: "claude-sonnet-5", model_tier: "sonnet", provider_family: "claude", reason_code: "role_implementation_prefers_coding_harness", confidence: "medium" },
		{ agent: "implementation-agent", harness: "claude-native", model: "claude-sonnet-4-6", provider_family: "claude", reason_code: "role_implementation_prefers_coding_harness", confidence: "medium" },
		{ agent: "implementation-agent", harness: "claude-native", model: "claude-opus-4-8", provider_family: "claude", reason_code: "role_implementation_prefers_coding_harness", confidence: "medium" },
		{ agent: "implementation-agent", harness: "claude-native", model: "claude-haiku-4-5", provider_family: "claude", reason_code: "role_implementation_prefers_coding_harness", confidence: "medium" },
	],
	verification: [
		{ agent: "verification-agent", harness: "codex", model: null, provider_family: "openai", reason_code: "role_verification_prefers_cost_controlled_model", confidence: "high" },
		{ agent: "verification-agent", harness: "codex", model: "openai/gpt-5.4-mini", model_tier: "mini", provider_family: "openai", reason_code: "role_verification_prefers_cost_controlled_model", confidence: "high" },
		{ agent: "verification-agent", harness: "codex", model: "openai/gpt-5.4-mini-fast", model_tier: "fast", provider_family: "openai", reason_code: "role_verification_prefers_cost_controlled_model", confidence: "medium" },
		{ agent: "verification-agent", harness: "claude-native", model: "claude-haiku-4-5", provider_family: "claude", reason_code: "role_verification_prefers_cost_controlled_model", confidence: "medium" },
		{ agent: "verification-agent", harness: "claude-native", model: "claude-sonnet-5", model_tier: "sonnet", provider_family: "claude", reason_code: "role_verification_prefers_cost_controlled_model", confidence: "medium" },
		{ agent: "verification-agent", harness: "claude-native", model: "claude-sonnet-4-6", provider_family: "claude", reason_code: "role_verification_prefers_cost_controlled_model", confidence: "medium" },
		{ agent: "verification-agent", harness: "claude-native", model: "claude-opus-4-8", provider_family: "claude", reason_code: "role_verification_prefers_cost_controlled_model", confidence: "medium" },
		{ agent: "verification-agent", harness: "antigravity-native", model: "google/gemini-3.1-flash-lite", model_tier: "flash-lite", provider_family: "gemini", reason_code: "role_verification_prefers_cost_controlled_model", confidence: "medium" },
		{ agent: "verification-agent", harness: "antigravity-native", model: "google/gemini-3-flash-preview", model_tier: "flash", provider_family: "gemini", reason_code: "role_verification_prefers_cost_controlled_model", confidence: "medium" },
		{ agent: "verification-agent", harness: "antigravity-native", model: "gemini-3.5-flash", model_tier: "flash", provider_family: "gemini", reason_code: "role_verification_prefers_cost_controlled_model", confidence: "high" },
		{ agent: "verification-agent", harness: "antigravity-native", model: "google/gemini-3.1-pro-preview", model_tier: "pro", provider_family: "gemini", reason_code: "role_verification_prefers_cost_controlled_model", confidence: "medium" },
	],
	research: [
		{ agent: "research-agent", harness: "claude-native", model: "claude-sonnet-5", model_tier: "sonnet", provider_family: "claude", reason_code: "role_research_prefers_sonnet_context", confidence: "medium" },
		{ agent: "research-agent", harness: "claude-native", model: "claude-sonnet-4-6", provider_family: "claude", reason_code: "role_research_prefers_sonnet_context", confidence: "medium" },
		{ agent: "research-agent", harness: "claude-native", model: "claude-opus-4-8", provider_family: "claude", reason_code: "role_research_prefers_sonnet_context", confidence: "medium" },
		{ agent: "research-agent", harness: "claude-native", model: "claude-haiku-4-5", provider_family: "claude", reason_code: "role_research_prefers_sonnet_context", confidence: "medium" },
		{ agent: "research-agent", harness: "codex", model: null, provider_family: "openai", reason_code: "role_research_prefers_sonnet_context", confidence: "medium" },
		{ agent: "research-agent", harness: "codex", model: "openai/gpt-5.5", model_tier: "frontier", provider_family: "openai", reason_code: "role_research_prefers_sonnet_context", confidence: "medium" },
	],
	general: [
		{ agent: "general-agent", harness: "codex", model: null, provider_family: "openai", reason_code: "role_general_prefers_balanced_model", confidence: "medium" },
		{ agent: "general-agent", harness: "codex", model: "openai/gpt-5.4-mini-fast", model_tier: "fast", provider_family: "openai", reason_code: "role_general_prefers_balanced_model", confidence: "medium" },
		{ agent: "general-agent", harness: "codex", model: "openai/gpt-5.3-codex-spark", model_tier: "spark", provider_family: "openai", reason_code: "role_general_prefers_balanced_model", confidence: "medium" },
		{ agent: "general-agent", harness: "claude-native", model: "claude-sonnet-5", model_tier: "sonnet", provider_family: "claude", reason_code: "role_general_prefers_balanced_model", confidence: "medium" },
		{ agent: "general-agent", harness: "claude-native", model: "claude-sonnet-4-6", provider_family: "claude", reason_code: "role_general_prefers_balanced_model", confidence: "medium" },
		{ agent: "general-agent", harness: "claude-native", model: "claude-opus-4-8", provider_family: "claude", reason_code: "role_general_prefers_balanced_model", confidence: "medium" },
		{ agent: "general-agent", harness: "claude-native", model: "claude-haiku-4-5", provider_family: "claude", reason_code: "role_general_prefers_balanced_model", confidence: "medium" },
	],
	gemini_experimental: [
		{
			agent: "gemini-agent",
			harness: "antigravity-native",
			model: "google/gemini-3.1-flash-lite",
			model_tier: "flash-lite",
			provider_family: "gemini",
			reason_code: "role_gemini_experimental_prefers_gemini_native",
			confidence: "high",
		},
		{ agent: "gemini-agent", harness: "antigravity-native", model: "google/gemini-3-flash-preview", model_tier: "flash", provider_family: "gemini", reason_code: "role_gemini_experimental_prefers_gemini_native", confidence: "medium" },
		{ agent: "gemini-agent", harness: "antigravity-native", model: "gemini-3.5-flash", model_tier: "flash", provider_family: "gemini", reason_code: "role_gemini_experimental_prefers_gemini_native", confidence: "high" },
		{ agent: "gemini-agent", harness: "antigravity-native", model: "google/gemini-3.1-pro-preview", model_tier: "pro", provider_family: "gemini", reason_code: "role_gemini_experimental_prefers_gemini_native", confidence: "medium" },
	],
};

// Parity with the Python selector (flowdesk_omnigent.selection): compatibility
// is defense-in-depth over the curated registry, and available-agent filtering
// lets the parent restrict selection to agents it actually registered.
const PROVIDER_BY_HARNESS: Record<string, FlowDeskOmnigentProviderFamilyV1> = {
	"claude-native": "claude",
	"claude-sdk": "claude",
	codex: "openai",
	"antigravity-native": "gemini",
};
const MODEL_PREFIXES: Record<FlowDeskOmnigentProviderFamilyV1, readonly string[]> = {
	claude: ["anthropic/", "claude/", "claude-"],
	openai: ["openai/"],
	gemini: ["google/", "gemini/", "gemini-"],
};
// Harness is coupled to model family (parity with the Python selector). A model-family
// change must carry the matching harness; every registry entry's harness must be one of
// its family's harnesses (asserted in tests). Primary entry = canonical default.
export const HARNESSES_BY_FAMILY: Record<FlowDeskOmnigentProviderFamilyV1, readonly string[]> = {
	claude: ["claude-native", "claude-sdk"],
	openai: ["codex"],
	gemini: ["antigravity-native"],
};
export const PROVIDER_FAMILY_HARNESS: Record<FlowDeskOmnigentProviderFamilyV1, string> = {
	claude: HARNESSES_BY_FAMILY.claude[0],
	openai: HARNESSES_BY_FAMILY.openai[0],
	gemini: HARNESSES_BY_FAMILY.gemini[0],
};

// Match the Python selector's `request.get("available_agents") or request.get("allowed_agents")`:
// an EMPTY list is Python-falsy and falls through to allowed_agents (and, if that
// is also absent, to "no constraint"). Using JS `??` here would instead treat `[]`
// as "block every agent" — the opposite of the Python behavior.
function pythonTruthy(value: unknown): boolean {
	if (value === undefined || value === null || value === false) return false;
	if (Array.isArray(value)) return value.length > 0;
	if (typeof value === "string") return value.length > 0;
	if (typeof value === "number") return value !== 0;
	if (typeof value === "object") return Object.keys(value).length > 0;
	return true;
}

function availableAgents(request: FlowDeskOmnigentSelectionRequestV1): Set<string> | undefined {
	const raw = pythonTruthy(request.available_agents) ? request.available_agents : request.allowed_agents;
	if (raw === undefined || raw === null) return undefined;
	if (!Array.isArray(raw)) return new Set();
	return new Set(raw.filter((item): item is string => typeof item === "string" && item.length > 0));
}

function entryCompatibilityError(entry: RegistryEntry): string | null {
	if (PROVIDER_BY_HARNESS[entry.harness] !== entry.provider_family) return "model_family_mismatch_blocked";
	if (entry.model === null) return null;
	const prefixes = MODEL_PREFIXES[entry.provider_family] ?? [];
	if (!prefixes.some((prefix) => entry.model!.startsWith(prefix))) return "model_family_mismatch_blocked";
	return null;
}

export function selectFlowDeskOmnigentAgentModelV1(request: FlowDeskOmnigentSelectionRequestV1 | null | undefined, now = new Date()): FlowDeskOmnigentSelectionV1 {
	if (!request || typeof request !== "object") {
		return negativeSelection({ taskId: "task-unknown", role: "unknown", status: "blocked", reasonCodes: ["malformed_request_blocked"], blockedLabels: ["malformed_request"], now });
	}
	const taskId = safeTaskId(request.task_id);
	const role = request.task_role;
	if (typeof role !== "string" || !ROLE_VALUES.has(role as FlowDeskOmnigentTaskRoleV1)) {
		return negativeSelection({ taskId, role: "unknown", status: "blocked", reasonCodes: ["unknown_role_blocked"], blockedLabels: ["unknown_role"], now });
	}
	const taskRole = role as FlowDeskOmnigentTaskRoleV1;
	const allowed = allowedProviderFamilies(request.allowed_provider_families);
	const available = availableAgents(request);
	const tierReason = taskTierReasonCode(request);
	const modelPreferenceReason = modelPreferenceReasonCode(request);
	let providerUsageBlocked = false;
	let agentUnavailable = false;
	for (const entry of orderedEntriesForTask(request, FLOWDESK_OMNIGENT_DEFAULT_REGISTRY_V1[taskRole])) {
		if (available !== undefined && !available.has(entry.agent)) {
			agentUnavailable = true;
			continue;
		}
		if (!allowed.has(entry.provider_family)) continue;
		if (!providerUsageAllows(request, entry.provider_family)) {
			providerUsageBlocked = true;
			continue;
		}
		const compatibilityError = entryCompatibilityError(entry);
		if (compatibilityError !== null) {
			return negativeSelection({ taskId, role: taskRole, status: "blocked", reasonCodes: [compatibilityError], blockedLabels: [compatibilityError], now });
		}
		return selectedSelection({ taskId, role: taskRole, entry, now, extraReasonCodes: [tierReason, modelPreferenceReason].filter((reason): reason is string => typeof reason === "string") });
	}
	const blockedReason = providerUsageBlocked ? "provider_usage_unavailable" : agentUnavailable ? "agent_not_available" : "provider_not_allowed";
	return negativeSelection({ taskId, role: taskRole, status: "blocked", reasonCodes: [blockedReason], blockedLabels: [blockedReason], now });
}

export function validateFlowDeskOmnigentSelectionV1(value: unknown): { ok: boolean; errors: string[] } {
	const errors: string[] = [];
	if (!value || typeof value !== "object" || Array.isArray(value)) return { ok: false, errors: ["selection must be an object"] };
	const record = value as Record<string, unknown>;
	if (record.schema_version !== FLOWDESK_OMNIGENT_SELECTION_SCHEMA_VERSION_V1) errors.push("schema_version must be flowdesk.omnigent_selection.v1");
	if (record.authority !== FLOWDESK_OMNIGENT_SELECTION_AUTHORITY_V1) errors.push("authority must be advisory_selection_only");
	if (!isSafeId(record.selection_id)) errors.push("selection_id must be a safe id");
	if (!isSafeId(record.task_id)) errors.push("task_id must be a safe id");
	if (typeof record.task_role !== "string") errors.push("task_role must be a string");
	if (!new Set(["selected", "blocked", "non_dispatchable"]).has(String(record.selection_status))) errors.push("selection_status is invalid");
	if (!Array.isArray(record.reason_codes)) errors.push("reason_codes must be an array");
	if (!Array.isArray(record.blocked_labels)) errors.push("blocked_labels must be an array");
	if (record.selection_status === "selected") {
		if (typeof record.agent !== "string" || record.agent.length === 0) errors.push("selected response requires agent");
		if (typeof record.harness !== "string" || record.harness.length === 0) errors.push("selected response requires harness");
		if (!PROVIDER_FAMILIES.has(record.provider_family as FlowDeskOmnigentProviderFamilyV1)) errors.push("selected response requires provider_family");
	}
	if (String(record.task_description ?? "").length > 0) errors.push("selection must not include task_description");
	return { ok: errors.length === 0, errors };
}

function selectedSelection(input: { taskId: string; role: FlowDeskOmnigentTaskRoleV1; entry: RegistryEntry; now: Date; extraReasonCodes?: string[] }): FlowDeskOmnigentSelectionV1 {
	return {
		schema_version: FLOWDESK_OMNIGENT_SELECTION_SCHEMA_VERSION_V1,
		selection_id: selectionId(),
		task_id: input.taskId,
		task_role: input.role,
		selection_status: "selected",
		agent: input.entry.agent,
		harness: input.entry.harness,
		model: input.entry.model,
		provider_family: input.entry.provider_family,
		confidence: input.entry.confidence,
		reason_codes: [input.entry.reason_code, ...(input.extraReasonCodes ?? []), "headless_subscription_verified", "quota_unknown_used_as_non_blocking_mvp_default", input.entry.model === null ? "subscription_harness_default_model" : "model_family_compatible"],
		blocked_labels: [],
		authority: FLOWDESK_OMNIGENT_SELECTION_AUTHORITY_V1,
		created_at: iso(input.now),
		expires_at: iso(new Date(input.now.getTime() + 10 * 60 * 1000)),
	};
}

function negativeSelection(input: { taskId: string; role: FlowDeskOmnigentTaskRoleV1 | "unknown"; status: "blocked" | "non_dispatchable"; reasonCodes: string[]; blockedLabels: string[]; now: Date }): FlowDeskOmnigentSelectionV1 {
	return {
		schema_version: FLOWDESK_OMNIGENT_SELECTION_SCHEMA_VERSION_V1,
		selection_id: selectionId(),
		task_id: input.taskId,
		task_role: input.role,
		selection_status: input.status,
		confidence: "low",
		reason_codes: input.reasonCodes,
		blocked_labels: input.blockedLabels,
		authority: FLOWDESK_OMNIGENT_SELECTION_AUTHORITY_V1,
		created_at: iso(input.now),
		expires_at: iso(new Date(input.now.getTime() + 10 * 60 * 1000)),
	};
}

function allowedProviderFamilies(value: unknown): Set<FlowDeskOmnigentProviderFamilyV1> {
	if (value === undefined || value === null) return new Set(["claude", "openai", "gemini"]);
	if (!Array.isArray(value)) return new Set();
	return new Set(value.filter((entry): entry is FlowDeskOmnigentProviderFamilyV1 => PROVIDER_FAMILIES.has(entry)));
}

function orderedEntriesForTask(request: FlowDeskOmnigentSelectionRequestV1, entries: readonly RegistryEntry[]): readonly RegistryEntry[] {
	const filtered = entries.filter((entry) => entryAllowedByModelRequest(request, entry));
	if (preferredModel(request) || modelTier(request)) return [...filtered].sort((left, right) => compareModelPreference(request, left, right));
	if (taskTierReasonCode(request)) return [...filtered].sort((left, right) => tierEntryScore(left) - tierEntryScore(right));
	return filtered;
}

function entryAllowedByModelRequest(request: FlowDeskOmnigentSelectionRequestV1, entry: RegistryEntry): boolean {
	const allowed = allowedModels(request);
	if (allowed && !allowed.has(entry.model)) return false;
	const preferred = preferredModel(request);
	if (preferred && entry.model !== preferred) return false;
	const tier = modelTier(request);
	if (tier && entry.model_tier !== tier) return false;
	return true;
}

function compareModelPreference(request: FlowDeskOmnigentSelectionRequestV1, left: RegistryEntry, right: RegistryEntry): number {
	const leftKey = modelPreferenceScore(request, left);
	const rightKey = modelPreferenceScore(request, right);
	return leftKey[0] - rightKey[0] || leftKey[1] - rightKey[1] || leftKey[2] - rightKey[2];
}

function modelPreferenceScore(request: FlowDeskOmnigentSelectionRequestV1, entry: RegistryEntry): [number, number, number] {
	const preferred = preferredModel(request);
	const tier = modelTier(request);
	const confidenceScore = entry.confidence === "high" ? 0 : entry.confidence === "medium" ? 1 : 2;
	return [preferred && entry.model === preferred ? 0 : 1, tier && entry.model_tier === tier ? 0 : 1, confidenceScore];
}

function preferredModel(request: FlowDeskOmnigentSelectionRequestV1): string | null {
	return typeof request.preferred_model === "string" && request.preferred_model ? request.preferred_model : null;
}

function modelTier(request: FlowDeskOmnigentSelectionRequestV1): string | null {
	const raw = request.model_tier ?? request.modelTier;
	return typeof raw === "string" && raw ? raw : null;
}

function allowedModels(request: FlowDeskOmnigentSelectionRequestV1): Set<string | null> | null {
	if (request.allowed_models === undefined || request.allowed_models === null) return null;
	if (!Array.isArray(request.allowed_models)) return new Set();
	return new Set(request.allowed_models.filter((model): model is string | null => model === null || typeof model === "string"));
}

function modelPreferenceReasonCode(request: FlowDeskOmnigentSelectionRequestV1): string | null {
	if (preferredModel(request)) return "preferred_model_applied";
	if (modelTier(request)) return "model_tier_preference_applied";
	return null;
}

function tierEntryScore(entry: RegistryEntry): number {
	const reasoningScore = entry.provider_family === "claude" && entry.model !== null ? 0 : 10;
	const confidenceScore = entry.confidence === "high" ? 0 : entry.confidence === "medium" ? 1 : 2;
	return reasoningScore + confidenceScore;
}

function taskTierReasonCode(request: FlowDeskOmnigentSelectionRequestV1): string | null {
	const complexity = request.task_complexity ?? request.complexity;
	if (complexity === "high" || complexity === "critical") return "task_tier_prefers_reasoning_model";
	const phase = request.task_phase ?? request.phase;
	if (phase === "high_level_design" || phase === "detailed_design" || phase === "risk_review") return "task_tier_prefers_reasoning_model";
	const tier = request.task_tier ?? request.tier;
	if (tier === "upper" || tier === "senior" || tier === "reasoning" || tier === "frontier") return "task_tier_prefers_reasoning_model";
	return null;
}

function providerUsageAllows(request: FlowDeskOmnigentSelectionRequestV1, providerFamily: FlowDeskOmnigentProviderFamilyV1): boolean {
	const snapshot = request.provider_usage ?? request.provider_health;
	if (snapshot === undefined || snapshot === null) return true;
	const rows: Record<string, unknown>[] = [];
	if (isRecord(snapshot)) {
		const direct = snapshot[providerFamily];
		if (isRecord(direct)) rows.push(direct);
		const providers = snapshot.providers;
		if (Array.isArray(providers)) {
			rows.push(...providers.filter((row): row is Record<string, unknown> => isRecord(row) && row.provider_family === providerFamily));
		}
	} else if (Array.isArray(snapshot)) {
		rows.push(...snapshot.filter((row): row is Record<string, unknown> => isRecord(row) && row.provider_family === providerFamily));
	}
	if (rows.length === 0) return true;
	return rows.some(providerUsageRowAllows);
}

function providerUsageRowAllows(row: Record<string, unknown>): boolean {
	if (row.dispatchable === false || row.non_dispatchable === true) return false;
	const alert = row.alert_level ?? row.alertLevel ?? row.status;
	if (typeof alert === "string" && new Set(["critical", "exhausted", "stale", "non_dispatchable", "blocked", "unavailable"]).has(alert)) return false;
	const remaining = row.remaining_percent ?? row.remainingPercent;
	if (typeof remaining === "number" && Number.isFinite(remaining) && remaining <= 0) return false;
	return true;
}

function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === "object" && value !== null && !Array.isArray(value);
}

function safeTaskId(value: unknown): string {
	return isSafeId(value) ? value : "task-unknown";
}

function isSafeId(value: unknown): value is string {
	return typeof value === "string" && value.length >= 1 && value.length <= 128 && /^[A-Za-z0-9_.:-]+$/.test(value);
}

function selectionId(): string {
	return `selection-${randomUUID().replaceAll("-", "")}`;
}

function iso(value: Date): string {
	return value.toISOString();
}
