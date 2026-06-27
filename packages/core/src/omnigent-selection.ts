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
	allowed_provider_families?: unknown;
	preferred_provider_family?: unknown;
	requires_headless?: unknown;
	provider_usage?: unknown;
	provider_health?: unknown;
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
}

const ROLE_VALUES = new Set<FlowDeskOmnigentTaskRoleV1>(["policy_security", "architecture", "implementation", "verification", "research", "general", "gemini_experimental"]);
const PROVIDER_FAMILIES = new Set<FlowDeskOmnigentProviderFamilyV1>(["claude", "openai", "gemini"]);

const DEFAULT_REGISTRY: Record<Exclude<FlowDeskOmnigentTaskRoleV1, "gemini_experimental">, readonly RegistryEntry[]> = {
	policy_security: [
		{ agent: "policy-security-agent", harness: "claude-sdk", model: "claude-opus-4-8", provider_family: "claude", reason_code: "role_policy_security_prefers_deep_reasoning", confidence: "high" },
		{ agent: "policy-security-agent", harness: "codex", model: null, provider_family: "openai", reason_code: "role_policy_security_prefers_deep_reasoning", confidence: "medium" },
	],
	architecture: [
		{ agent: "architecture-agent", harness: "codex", model: null, provider_family: "openai", reason_code: "role_architecture_prefers_frontier_reasoning", confidence: "high" },
		{ agent: "architecture-agent", harness: "claude-sdk", model: "claude-sonnet-4-6", provider_family: "claude", reason_code: "role_architecture_prefers_frontier_reasoning", confidence: "medium" },
	],
	implementation: [
		{ agent: "implementation-agent", harness: "codex", model: null, provider_family: "openai", reason_code: "role_implementation_prefers_coding_harness", confidence: "high" },
		{ agent: "implementation-agent", harness: "claude-sdk", model: "claude-sonnet-4-6", provider_family: "claude", reason_code: "role_implementation_prefers_coding_harness", confidence: "medium" },
	],
	verification: [
		{ agent: "verification-agent", harness: "codex", model: null, provider_family: "openai", reason_code: "role_verification_prefers_cost_controlled_model", confidence: "high" },
		{ agent: "verification-agent", harness: "claude-sdk", model: "claude-haiku-4-5", provider_family: "claude", reason_code: "role_verification_prefers_cost_controlled_model", confidence: "medium" },
	],
	research: [
		{ agent: "research-agent", harness: "claude-sdk", model: "claude-sonnet-4-6", provider_family: "claude", reason_code: "role_research_prefers_sonnet_context", confidence: "high" },
		{ agent: "research-agent", harness: "codex", model: null, provider_family: "openai", reason_code: "role_research_prefers_sonnet_context", confidence: "medium" },
	],
	general: [
		{ agent: "general-agent", harness: "codex", model: null, provider_family: "openai", reason_code: "role_general_prefers_balanced_model", confidence: "medium" },
		{ agent: "general-agent", harness: "claude-sdk", model: "claude-sonnet-4-6", provider_family: "claude", reason_code: "role_general_prefers_balanced_model", confidence: "medium" },
	],
};

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
	if (taskRole === "gemini_experimental") {
		return negativeSelection({ taskId, role: taskRole, status: "non_dispatchable", reasonCodes: ["gemini_oauth_refresh_unstable"], blockedLabels: ["gemini_oauth_refresh_unstable"], now });
	}
	const allowed = allowedProviderFamilies(request.allowed_provider_families);
	let providerUsageBlocked = false;
	for (const entry of DEFAULT_REGISTRY[taskRole]) {
		if (!allowed.has(entry.provider_family)) continue;
		if (!providerUsageAllows(request, entry.provider_family)) {
			providerUsageBlocked = true;
			continue;
		}
		return selectedSelection({ taskId, role: taskRole, entry, now });
	}
	const blockedReason = providerUsageBlocked ? "provider_usage_unavailable" : "provider_not_allowed";
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

function selectedSelection(input: { taskId: string; role: FlowDeskOmnigentTaskRoleV1; entry: RegistryEntry; now: Date }): FlowDeskOmnigentSelectionV1 {
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
		reason_codes: [input.entry.reason_code, "headless_subscription_verified", "quota_unknown_used_as_non_blocking_mvp_default", input.entry.model === null ? "subscription_harness_default_model" : "model_family_compatible"],
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
	if (value === undefined || value === null) return new Set(["claude", "openai"]);
	if (!Array.isArray(value)) return new Set();
	return new Set(value.filter((entry): entry is FlowDeskOmnigentProviderFamilyV1 => PROVIDER_FAMILIES.has(entry)));
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
