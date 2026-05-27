import {
	invalid,
	type ValidationResult,
	valid,
	validateNoForbiddenRawPayloads,
	validateOpaqueRef,
} from "./validators.js";

export const FLOWDESK_AGENT_REGISTRY_ENTRY_SCHEMA_VERSION_V1 = "flowdesk.agent_registry_entry.v1" as const;
export const FLOWDESK_AGENT_REGISTRY_SCHEMA_VERSION_V1 = "flowdesk.agent_registry.v1" as const;

export const FLOWDESK_AGENT_REGISTRY_RELEASE_GATES_V1 = [
	"release1_planning_only",
	"later_gate_read_only",
	"later_gate_scoped_write",
] as const;

export type FlowDeskAgentRegistryReleaseGateV1 = (typeof FLOWDESK_AGENT_REGISTRY_RELEASE_GATES_V1)[number];

export const FLOWDESK_AGENT_REGISTRY_ROLE_CATEGORIES_V1 = [
	"documentation",
	"exploration",
	"git",
	"implementation",
	"review",
	"architecture",
	"decision",
	"verification",
	"security",
	"performance",
	"migration",
] as const;

export type FlowDeskAgentRegistryRoleCategoryV1 = (typeof FLOWDESK_AGENT_REGISTRY_ROLE_CATEGORIES_V1)[number];

export const FLOWDESK_AGENT_REGISTRY_OUTPUT_CONTRACT_REFS_V1 = [
	"contract-task-result-v1",
	"contract-reviewer-verdict-v1",
	"contract-verification-result-v1",
	"contract-policy-review-result-v1",
	"contract-architecture-decision-result-v1",
	"contract-migration-plan-result-v1",
] as const;

export type FlowDeskAgentRegistryOutputContractRefV1 = (typeof FLOWDESK_AGENT_REGISTRY_OUTPUT_CONTRACT_REFS_V1)[number];

export const FLOWDESK_AGENT_REGISTRY_EVIDENCE_CLASSES_V1 = [
	"task_result",
	"task_failed",
	"reviewer_verdict",
	"lane_lifecycle",
	"lane_heartbeat",
	"runtime_lane_launch_plan",
	"verification_result",
	"policy_review_result",
	"architecture_decision_result",
	"migration_plan_result",
] as const;

export type FlowDeskAgentRegistryEvidenceClassV1 = (typeof FLOWDESK_AGENT_REGISTRY_EVIDENCE_CLASSES_V1)[number];

export const FLOWDESK_AGENT_REGISTRY_REQUIRED_FORBIDDEN_ACTIONS_V1 = [
	"hidden_injection",
	"nested_opencode_run",
	"automatic_fallback_reselection",
	"authority_claims",
] as const;

export interface FlowDeskAgentRegistryEntryV1 {
	schema_version: typeof FLOWDESK_AGENT_REGISTRY_ENTRY_SCHEMA_VERSION_V1;
	agent_id: string;
	role_category: FlowDeskAgentRegistryRoleCategoryV1;
	release_gate: FlowDeskAgentRegistryReleaseGateV1;
	description_label: string;
	use_when: string[];
	do_not_use_when: string[];
	allowed_actions: string[];
	forbidden_actions: string[];
	permission_profile_ref: string;
	input_contract_ref: string;
	output_contract_ref: FlowDeskAgentRegistryOutputContractRefV1;
	required_evidence_classes: FlowDeskAgentRegistryEvidenceClassV1[];
	optional_evidence_classes: FlowDeskAgentRegistryEvidenceClassV1[];
	model_eligibility_policy_ref: string;
	default_runtime_agent_ref?: string;
	fallback_allowed: false;
	dispatch_authority_enabled: false;
	redaction_version: "v1";
}

export interface FlowDeskAgentRegistryV1 {
	schema_version: typeof FLOWDESK_AGENT_REGISTRY_SCHEMA_VERSION_V1;
	registry_id: string;
	entries: FlowDeskAgentRegistryEntryV1[];
	dispatch_authority_enabled: false;
	redaction_version: "v1";
}

const ENTRY_ALLOWED_KEYS = new Set([
	"schema_version",
	"agent_id",
	"role_category",
	"release_gate",
	"description_label",
	"use_when",
	"do_not_use_when",
	"allowed_actions",
	"forbidden_actions",
	"permission_profile_ref",
	"input_contract_ref",
	"output_contract_ref",
	"required_evidence_classes",
	"optional_evidence_classes",
	"model_eligibility_policy_ref",
	"default_runtime_agent_ref",
	"fallback_allowed",
	"dispatch_authority_enabled",
	"redaction_version",
]);

const ENTRY_REQUIRED_KEYS = [
	"schema_version",
	"agent_id",
	"role_category",
	"release_gate",
	"description_label",
	"use_when",
	"do_not_use_when",
	"allowed_actions",
	"forbidden_actions",
	"permission_profile_ref",
	"input_contract_ref",
	"output_contract_ref",
	"required_evidence_classes",
	"optional_evidence_classes",
	"model_eligibility_policy_ref",
	"fallback_allowed",
	"dispatch_authority_enabled",
	"redaction_version",
] as const;

const REGISTRY_ALLOWED_KEYS = new Set([
	"schema_version",
	"registry_id",
	"entries",
	"dispatch_authority_enabled",
	"redaction_version",
]);

const AUTHORITY_SMUGGLING_PATTERN = /\b(?:approve(?:d|s)?|approval|authorize(?:d|s)?|authorization|guard(?:ed)?|dispatch(?:able|ed|es)?|dispatch\s*-?authority|fallback|reselection|reselect|no\s*-?reply|hard\s*-?(?:cancel|stop)|real\s*-?(?:opencode\s*-?)?dispatch|provider\s*-?(?:call|payload|response)|runtime\s*-?execution|actual\s*-?lane\s*-?launch|opencode\s+run|hidden\s+injection)\b/i;
const DISALLOWED_RELEASE1_PATCH_EVIDENCE_PATTERN = /\b(?:patch|diff|write|edit|commit|pull_request|pr|controlled_write|real_patch)\b/i;

function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === "object" && value !== null && !Array.isArray(value);
}

function rejectUnknownProperties(value: Record<string, unknown>, allowed: ReadonlySet<string>, label: string): string[] {
	return Object.keys(value)
		.filter((key) => !allowed.has(key))
		.map((key) => `${label} has unknown property: ${key}`);
}

function requireKeys(value: Record<string, unknown>, keys: readonly string[], label: string): string[] {
	return keys.filter((key) => !(key in value)).map((key) => `${label} missing required field: ${key}`);
}

function boundedString(value: unknown, label: string, maxLength = 200): ValidationResult {
	if (typeof value !== "string" || value.trim().length === 0) return invalid(`${label} must be a non-empty string`);
	if (value.length > maxLength) return invalid(`${label} exceeds ${maxLength} chars`);
	return validateNoForbiddenRawPayloads(value, label);
}

function stringArray(value: unknown, label: string, options: { minItems?: number; maxItems?: number; allowAuthorityTerms?: boolean } = {}): ValidationResult {
	if (!Array.isArray(value)) return invalid(`${label} must be an array`);
	const minItems = options.minItems ?? 1;
	const maxItems = options.maxItems ?? 16;
	const errors: string[] = [];
	if (value.length < minItems) errors.push(`${label} must contain at least ${minItems} item(s)`);
	if (value.length > maxItems) errors.push(`${label} exceeds ${maxItems} items`);
	value.forEach((item, index) => {
		const itemLabel = `${label}[${index}]`;
		if (typeof item !== "string" || item.trim().length === 0) {
			errors.push(`${itemLabel} must be a non-empty string`);
			return;
		}
		if (item.length > 160) errors.push(`${itemLabel} exceeds 160 chars`);
		errors.push(...validateNoForbiddenRawPayloads(item, itemLabel).errors);
		if (options.allowAuthorityTerms !== true && AUTHORITY_SMUGGLING_PATTERN.test(item)) {
			errors.push(`${itemLabel} contains authority-smuggling language`);
		}
	});
	return errors.length === 0 ? valid() : invalid(...errors);
}

function safeLabel(value: unknown, label: string): ValidationResult {
	const result = boundedString(value, label, 200);
	if (!result.ok) return result;
	return AUTHORITY_SMUGGLING_PATTERN.test(value as string)
		? invalid(`${label} contains authority-smuggling language`)
		: valid();
}

function ref(value: unknown, label: string): ValidationResult {
	const result = validateOpaqueRef(value, label);
	if (!result.ok) return result;
	return AUTHORITY_SMUGGLING_PATTERN.test(value as string)
		? invalid(`${label} contains authority-smuggling language`)
		: valid();
}

function enumValue(value: unknown, allowed: readonly string[], label: string): ValidationResult {
	return typeof value === "string" && allowed.includes(value) ? valid() : invalid(`${label} is not allowed`);
}

function evidenceArray(value: unknown, label: string, options: { minItems?: number; maxItems?: number } = {}): ValidationResult {
	const result = stringArray(value, label, { minItems: options.minItems, maxItems: options.maxItems });
	if (!result.ok) return result;
	const errors: string[] = [];
	(value as string[]).forEach((item, index) => {
		if (!FLOWDESK_AGENT_REGISTRY_EVIDENCE_CLASSES_V1.includes(item as FlowDeskAgentRegistryEvidenceClassV1)) {
			errors.push(`${label}[${index}] is not an allowed evidence class`);
		}
	});
	return errors.length === 0 ? valid() : invalid(...errors);
}

function validateRoleOutputEvidenceCompatibility(value: Record<string, unknown>): ValidationResult {
	const role = value.role_category;
	const output = value.output_contract_ref;
	const requiredEvidence = Array.isArray(value.required_evidence_classes) ? value.required_evidence_classes.filter((item): item is string => typeof item === "string") : [];
	const errors: string[] = [];
	const hasAny = (...classes: string[]) => classes.some((evidenceClass) => requiredEvidence.includes(evidenceClass));
	const terminalEvidenceEquivalent = hasAny("lane_lifecycle", "task_result", "task_failed", "reviewer_verdict", "verification_result", "policy_review_result", "architecture_decision_result", "migration_plan_result");

	if (!terminalEvidenceEquivalent) {
		errors.push("required_evidence_classes must include lane_lifecycle or terminal evidence such as task_result/reviewer_verdict");
	}

	if (role === "review") {
		if (output !== "contract-reviewer-verdict-v1" && output !== "contract-task-result-v1") {
			errors.push("review role must use contract-reviewer-verdict-v1 or advisory contract-task-result-v1");
		}
		if (output === "contract-task-result-v1" && requiredEvidence.includes("reviewer_verdict")) {
			errors.push("review role with advisory contract-task-result-v1 must not require reviewer_verdict evidence");
		}
	}

	if (role === "verification") {
		if (output !== "contract-verification-result-v1" && output !== "contract-task-result-v1") {
			errors.push("verification role must use contract-verification-result-v1 or contract-task-result-v1");
		}
		if (!requiredEvidence.includes("lane_lifecycle")) errors.push("verification role must require lane_lifecycle evidence");
		if (!hasAny("task_result", "verification_result")) errors.push("verification role must require task_result or verification_result evidence");
	}

	if (role === "implementation") {
		if (value.release_gate !== "release1_planning_only" && value.release_gate !== "later_gate_scoped_write") {
			errors.push("implementation role must be release1_planning_only or later_gate_scoped_write");
		}
		for (const evidenceClass of requiredEvidence) {
			if (DISALLOWED_RELEASE1_PATCH_EVIDENCE_PATTERN.test(evidenceClass)) {
				errors.push("implementation role must not require real patch/write evidence in Release 1 registry entries");
			}
		}
	}

	if (role === "security") {
		if (output !== "contract-policy-review-result-v1" && output !== "contract-task-result-v1") {
			errors.push("security role must use contract-policy-review-result-v1 or advisory contract-task-result-v1");
		}
		for (const label of ["output_contract_ref", "permission_profile_ref"]) {
			const text = value[label];
			if (typeof text === "string" && /(?:guard|dispatch).*(?:approval|approve|authority)|(?:approval|approve|authority).*(?:guard|dispatch)/i.test(text)) {
				errors.push(`${label} must not claim Guard approval or dispatch approval authority`);
			}
		}
	}

	return errors.length === 0 ? valid() : invalid(...errors);
}

export function validateFlowDeskAgentRegistryEntryV1(value: unknown): ValidationResult {
	if (!isRecord(value)) return invalid("agent registry entry must be an object");
	const errors: string[] = [];
	errors.push(...rejectUnknownProperties(value, ENTRY_ALLOWED_KEYS, "agent registry entry"));
	errors.push(...requireKeys(value, ENTRY_REQUIRED_KEYS, "agent registry entry"));

	if (value.schema_version !== FLOWDESK_AGENT_REGISTRY_ENTRY_SCHEMA_VERSION_V1) {
		errors.push(`schema_version must be ${FLOWDESK_AGENT_REGISTRY_ENTRY_SCHEMA_VERSION_V1}`);
	}
	if (typeof value.agent_id !== "string" || !/^agent-[a-z0-9]+(?:-[a-z0-9]+)*$/.test(value.agent_id)) {
		errors.push("agent_id must be a stable lowercase FlowDesk-owned agent id such as agent-security-policy");
	}
	if (typeof value.agent_id === "string" && /\b(?:omo|omc)\b/i.test(value.agent_id)) {
		errors.push("agent_id must not use forbidden legacy agent naming");
	}
	if (!FLOWDESK_AGENT_REGISTRY_RELEASE_GATES_V1.includes(value.release_gate as FlowDeskAgentRegistryReleaseGateV1)) {
		errors.push("release_gate is invalid");
	}
	errors.push(...safeLabel(value.role_category, "role_category").errors);
	errors.push(...enumValue(value.role_category, FLOWDESK_AGENT_REGISTRY_ROLE_CATEGORIES_V1, "role_category").errors);
	errors.push(...safeLabel(value.description_label, "description_label").errors);
	errors.push(...stringArray(value.use_when, "use_when").errors);
	errors.push(...stringArray(value.do_not_use_when, "do_not_use_when").errors);
	errors.push(...stringArray(value.allowed_actions, "allowed_actions").errors);
	errors.push(...stringArray(value.forbidden_actions, "forbidden_actions", { allowAuthorityTerms: true }).errors);

	const forbiddenActions = Array.isArray(value.forbidden_actions) ? value.forbidden_actions : [];
	for (const required of FLOWDESK_AGENT_REGISTRY_REQUIRED_FORBIDDEN_ACTIONS_V1) {
		if (!forbiddenActions.includes(required)) errors.push(`forbidden_actions must include ${required}`);
	}

	errors.push(...ref(value.permission_profile_ref, "permission_profile_ref").errors);
	errors.push(...ref(value.input_contract_ref, "input_contract_ref").errors);
	errors.push(...ref(value.output_contract_ref, "output_contract_ref").errors);
	errors.push(...enumValue(value.output_contract_ref, FLOWDESK_AGENT_REGISTRY_OUTPUT_CONTRACT_REFS_V1, "output_contract_ref").errors);
	errors.push(...evidenceArray(value.required_evidence_classes, "required_evidence_classes", { maxItems: 12 }).errors);
	errors.push(...evidenceArray(value.optional_evidence_classes, "optional_evidence_classes", { minItems: 0, maxItems: 12 }).errors);
	errors.push(...ref(value.model_eligibility_policy_ref, "model_eligibility_policy_ref").errors);
	if (value.default_runtime_agent_ref !== undefined) {
		if (typeof value.default_runtime_agent_ref !== "string" || !/^agent-[a-z0-9]+(?:-[a-z0-9]+)*$/.test(value.default_runtime_agent_ref)) {
			errors.push("default_runtime_agent_ref must be a stable lowercase agent ref when present");
		}
		errors.push(...validateNoForbiddenRawPayloads(value.default_runtime_agent_ref, "default_runtime_agent_ref").errors);
	}
	if (value.fallback_allowed !== false) errors.push("fallback_allowed must be false");
	if (value.dispatch_authority_enabled !== false) errors.push("dispatch_authority_enabled must be false");
	if (value.redaction_version !== "v1") errors.push("redaction_version must be v1");
	errors.push(...validateRoleOutputEvidenceCompatibility(value).errors);
	errors.push(...validateNoForbiddenRawPayloads(value, "agent_registry_entry").errors);

	return errors.length === 0 ? valid() : invalid(...errors);
}

export function validateFlowDeskAgentRegistryV1(value: unknown): ValidationResult {
	if (!isRecord(value)) return invalid("agent registry must be an object");
	const errors: string[] = [];
	errors.push(...rejectUnknownProperties(value, REGISTRY_ALLOWED_KEYS, "agent registry"));
	errors.push(...requireKeys(value, ["schema_version", "registry_id", "entries", "dispatch_authority_enabled", "redaction_version"], "agent registry"));
	if (value.schema_version !== FLOWDESK_AGENT_REGISTRY_SCHEMA_VERSION_V1) {
		errors.push(`schema_version must be ${FLOWDESK_AGENT_REGISTRY_SCHEMA_VERSION_V1}`);
	}
	errors.push(...ref(value.registry_id, "registry_id").errors);
	if (!Array.isArray(value.entries)) {
		errors.push("entries must be an array");
	} else {
		if (value.entries.length === 0) errors.push("entries must contain at least one agent");
		if (value.entries.length > 64) errors.push("entries exceeds 64 items");
		const seen = new Set<string>();
		value.entries.forEach((entry, index) => {
			errors.push(...validateFlowDeskAgentRegistryEntryV1(entry).errors.map((error) => `entries[${index}]: ${error}`));
			if (isRecord(entry) && typeof entry.agent_id === "string") {
				if (seen.has(entry.agent_id)) errors.push(`entries[${index}]: duplicate agent_id ${entry.agent_id}`);
				seen.add(entry.agent_id);
			}
		});
	}
	if (value.dispatch_authority_enabled !== false) errors.push("dispatch_authority_enabled must be false");
	if (value.redaction_version !== "v1") errors.push("redaction_version must be v1");
	errors.push(...validateNoForbiddenRawPayloads(value, "agent_registry").errors);
	return errors.length === 0 ? valid() : invalid(...errors);
}
