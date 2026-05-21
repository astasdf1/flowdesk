import {
	invalid,
	type ValidationResult,
	valid,
	validateNoForbiddenRawPayloads,
	validateOpaqueId,
	validateOpaqueRef,
} from "./validators.js";

export const FLOWDESK_CHAT_HOOK_PROBE_OUTCOMES = [
	"steering_only",
	"hard_control_proven",
	"blocked",
	"invalid",
] as const;
export type FlowDeskChatHookProbeOutcomeV1 =
	(typeof FLOWDESK_CHAT_HOOK_PROBE_OUTCOMES)[number];

export interface FlowDeskChatHookAuthorityProbeV1 {
	schema_version: "flowdesk.chat_hook_authority_probe.v1";
	probe_id: string;
	chat_hook_ref: string;
	observed_at: string;
	outcome: FlowDeskChatHookProbeOutcomeV1;
	mutation_observed: boolean;
	throw_blocks_reply: boolean;
	no_reply_supported: boolean;
	cancel_or_stop_supported: boolean;
	duplicate_assistant_reply_observed: boolean;
	timeout_or_null_fail_closed: boolean;
	malformed_return_fail_closed: boolean;
	hardCancelOrNoReplyAuthority: false;
	failure_labels: string[];
	evidence_refs: string[];
	dispatch_authority_enabled: false;
	providerCall: false;
	runtimeExecution: false;
	actualLaneLaunch: false;
}

function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === "object" && value !== null && !Array.isArray(value);
}

function validateStringArray(value: unknown, label: string): ValidationResult {
	if (!Array.isArray(value)) return invalid(`${label} must be an array`);
	const errors: string[] = [];
	for (const [index, item] of value.entries()) {
		if (typeof item !== "string" || item.length === 0 || item.length > 160)
			errors.push(`${label}[${index}] must be a bounded string`);
		errors.push(...validateNoForbiddenRawPayloads(item, `${label}[${index}]`).errors);
	}
	return errors.length === 0 ? valid() : invalid(...errors);
}

export function createFlowDeskChatHookAuthorityProbeV1(input: {
	probeId: string;
	chatHookRef: string;
	observedAt: string;
	mutationObserved: boolean;
	throwBlocksReply?: boolean;
	noReplySupported?: boolean;
	cancelOrStopSupported?: boolean;
	duplicateAssistantReplyObserved?: boolean;
	timeoutOrNullFailClosed?: boolean;
	malformedReturnFailClosed?: boolean;
	evidenceRefs?: string[];
}): FlowDeskChatHookAuthorityProbeV1 {
	const failureLabels = [
		input.mutationObserved ? undefined : "mutation_not_observed",
		input.throwBlocksReply === true ? undefined : "throw_blocking_unproven",
		input.noReplySupported === true ? undefined : "no_reply_unproven",
		input.cancelOrStopSupported === true ? undefined : "cancel_or_stop_unproven",
		input.duplicateAssistantReplyObserved === true
			? "duplicate_assistant_reply_observed"
			: undefined,
		input.timeoutOrNullFailClosed === true
			? undefined
			: "timeout_or_null_not_fail_closed",
		input.malformedReturnFailClosed === true
			? undefined
			: "malformed_return_not_fail_closed",
	].filter((label): label is string => label !== undefined);
	const hardControlProven =
		input.throwBlocksReply === true &&
		input.noReplySupported === true &&
		input.cancelOrStopSupported === true &&
		input.duplicateAssistantReplyObserved !== true &&
		input.timeoutOrNullFailClosed === true &&
		input.malformedReturnFailClosed === true;
	return {
		schema_version: "flowdesk.chat_hook_authority_probe.v1",
		probe_id: input.probeId,
		chat_hook_ref: input.chatHookRef,
		observed_at: input.observedAt,
		outcome: hardControlProven ? "hard_control_proven" : "steering_only",
		mutation_observed: input.mutationObserved,
		throw_blocks_reply: input.throwBlocksReply === true,
		no_reply_supported: input.noReplySupported === true,
		cancel_or_stop_supported: input.cancelOrStopSupported === true,
		duplicate_assistant_reply_observed:
			input.duplicateAssistantReplyObserved === true,
		timeout_or_null_fail_closed: input.timeoutOrNullFailClosed === true,
		malformed_return_fail_closed: input.malformedReturnFailClosed === true,
		hardCancelOrNoReplyAuthority: false,
		failure_labels: [...new Set(failureLabels)],
		evidence_refs: [...(input.evidenceRefs ?? [])],
		dispatch_authority_enabled: false,
		providerCall: false,
		runtimeExecution: false,
		actualLaneLaunch: false,
	};
}

export function validateFlowDeskChatHookAuthorityProbeV1(
	value: unknown,
): ValidationResult {
	if (!isRecord(value)) return invalid("chat hook authority probe must be an object");
	const record = value as Partial<FlowDeskChatHookAuthorityProbeV1>;
	const errors: string[] = [];
	const allowed = new Set([
		"schema_version",
		"probe_id",
		"chat_hook_ref",
		"observed_at",
		"outcome",
		"mutation_observed",
		"throw_blocks_reply",
		"no_reply_supported",
		"cancel_or_stop_supported",
		"duplicate_assistant_reply_observed",
		"timeout_or_null_fail_closed",
		"malformed_return_fail_closed",
		"hardCancelOrNoReplyAuthority",
		"failure_labels",
		"evidence_refs",
		"dispatch_authority_enabled",
		"providerCall",
		"runtimeExecution",
		"actualLaneLaunch",
	]);
	for (const key of Object.keys(record))
		if (!allowed.has(key)) errors.push(`unknown properties: ${key}`);
	if (record.schema_version !== "flowdesk.chat_hook_authority_probe.v1")
		errors.push("chat hook probe schema_version is invalid");
	errors.push(...validateOpaqueId(record.probe_id, "probe_id").errors);
	errors.push(...validateOpaqueRef(record.chat_hook_ref, "chat_hook_ref").errors);
	if (
		!(FLOWDESK_CHAT_HOOK_PROBE_OUTCOMES as readonly string[]).includes(
			record.outcome ?? "",
		)
	)
		errors.push("chat hook probe outcome is invalid");
	if (
		typeof record.observed_at !== "string" ||
		!Number.isFinite(Date.parse(record.observed_at))
	)
		errors.push("observed_at must be parseable");
	for (const key of [
		"mutation_observed",
		"throw_blocks_reply",
		"no_reply_supported",
		"cancel_or_stop_supported",
		"duplicate_assistant_reply_observed",
		"timeout_or_null_fail_closed",
		"malformed_return_fail_closed",
	] as const)
		if (typeof record[key] !== "boolean") errors.push(`${key} must be boolean`);
	errors.push(...validateStringArray(record.failure_labels, "failure_labels").errors);
	errors.push(...validateStringArray(record.evidence_refs, "evidence_refs").errors);
	if (record.hardCancelOrNoReplyAuthority !== false)
		errors.push("chat hook probe cannot claim hard chat authority");
	if (
		record.outcome === "hard_control_proven" &&
		(record.throw_blocks_reply !== true ||
			record.no_reply_supported !== true ||
			record.cancel_or_stop_supported !== true ||
			record.timeout_or_null_fail_closed !== true ||
			record.malformed_return_fail_closed !== true ||
			record.duplicate_assistant_reply_observed !== false)
	)
		errors.push("hard_control_proven requires all hard-control observations");
	if (
		record.dispatch_authority_enabled !== false ||
		record.providerCall !== false ||
		record.runtimeExecution !== false ||
		record.actualLaneLaunch !== false
	)
		errors.push("chat hook probe cannot enable runtime authority");
	errors.push(...validateNoForbiddenRawPayloads(record, "chat_hook_authority_probe").errors);
	return errors.length === 0 ? valid() : invalid(...errors);
}
