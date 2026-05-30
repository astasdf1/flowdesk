import type { SafeNextAction } from "./release1-contracts.js";
import {
	validateFlowDeskLaneLifecycleRecordV1,
	type FlowDeskLaneLifecycleRecordV1,
} from "./lane-lifecycle-record.js";
import {
	invalid,
	type ValidationResult,
	valid,
	validateConcreteProviderQualifiedModelId,
	validateNoForbiddenRawPayloads,
	validateOpaqueId,
	validateOpaqueRef,
} from "./validators.js";

export const FLOWDESK_RUNTIME_LANE_LAUNCH_REASONS = [
	"reviewer_fanout",
	"runtime_observation",
	"diagnostic_lane",
	"agent_task",
	"managed_dispatch",
] as const;
export type FlowDeskRuntimeLaneLaunchReasonV1 =
	(typeof FLOWDESK_RUNTIME_LANE_LAUNCH_REASONS)[number];

export interface FlowDeskRuntimeLaneLaunchRequestV1 {
	schema_version: "flowdesk.runtime_lane_launch_request.v1";
	launch_request_id: string;
	workflow_id: string;
	attempt_id: string;
	lane_id: string;
	parent_session_ref: string;
	agent_ref: string;
	provider_qualified_model_id: string;
	launch_reason: FlowDeskRuntimeLaneLaunchReasonV1;
	pre_launch_audit_ref?: string;
	lane_launch_approval_ref?: string;
	requested_at: string;
	timeout_ms: number;
	orphan_max_age_ms: number;
	retry_budget: number;
	dispatch_authority_enabled: false;
	providerCall: false;
	actualLaneLaunch: false;
	runtimeExecution: false;
}

export interface FlowDeskRuntimeLaneLaunchPlanV1 extends ValidationResult {
	schema_version: "flowdesk.runtime_lane_launch_plan.v1";
	launch_request_id?: string;
	workflow_id?: string;
	attempt_id?: string;
	lane_id?: string;
	state: "launch_ready" | "blocked";
	blocked_labels: string[];
	parent_session_ref?: string;
	agent_ref?: string;
	provider_qualified_model_id?: string;
	launch_reason?: FlowDeskRuntimeLaneLaunchReasonV1;
	pre_launch_audit_ref?: string;
	lane_launch_approval_ref?: string;
	durable_evidence_root_ref?: string;
	lifecycle_evidence_class: "lane_lifecycle";
	exact_binding_confirmed: boolean;
	sdk_client_required: true;
	launch_attempted: false;
	dispatch_authority_enabled: false;
	providerCall: false;
	actualLaneLaunch: false;
	runtimeExecution: false;
}

export interface FlowDeskRuntimeLaneLifecycleProjectionV1
	extends ValidationResult {
	schema_version: "flowdesk.runtime_lane_lifecycle_projection.v1";
	workflow_id?: string;
	attempt_id?: string;
	lane_id?: string;
	projection_state:
		| "launch_ready"
		| "blocked"
		| "complete_with_verdict"
		| "terminal_non_approval"
		| "in_progress";
	lifecycle_state?: FlowDeskLaneLifecycleRecordV1["state"];
	verdict_ref?: string;
	blocked_labels: string[];
	safe_next_actions: SafeNextAction[];
	approval_inferred: false;
	dispatch_authority_enabled: false;
	providerCall: false;
	actualLaneLaunch: false;
	runtimeExecution: false;
}

const disabledRuntimeLaneAuthority = {
	dispatch_authority_enabled: false as const,
	providerCall: false as const,
	actualLaneLaunch: false as const,
	runtimeExecution: false as const,
};

function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === "object" && value !== null && !Array.isArray(value);
}

function rejectUnknownProperties(
	record: Record<string, unknown>,
	allowed: readonly string[],
	label: string,
): ValidationResult {
	const unknown = Object.keys(record).filter((key) => !allowed.includes(key));
	return unknown.length === 0
		? valid()
		: invalid(`${label} unknown properties: ${unknown.join(",")}`);
}

function timestamp(value: unknown, label: string): ValidationResult {
	return typeof value === "string" && Number.isFinite(Date.parse(value))
		? valid()
		: invalid(`${label} must be a parseable timestamp`);
}

function boundedNonNegativeInt(
	value: unknown,
	label: string,
	max: number,
): ValidationResult {
	if (typeof value !== "number" || !Number.isInteger(value) || value < 0)
		return invalid(`${label} must be a non-negative integer`);
	return value <= max ? valid() : invalid(`${label} exceeds ${max}`);
}

function refWithPrefix(
	value: unknown,
	label: string,
	prefixes: readonly string[],
): ValidationResult {
	const ref = validateOpaqueRef(value, label);
	if (!ref.ok) return ref;
	const text = value as string;
	return prefixes.some((prefix) => text.startsWith(prefix))
		? valid()
		: invalid(`${label} must use ${prefixes.join("/")} kind prefix`);
}

export function validateFlowDeskRuntimeLaneLaunchRequestV1(
	value: unknown,
): ValidationResult {
	if (!isRecord(value)) return invalid("runtime lane launch request must be an object");
	const record = value as Partial<FlowDeskRuntimeLaneLaunchRequestV1>;
	const errors: string[] = [];
	errors.push(
		...rejectUnknownProperties(
			record,
			[
				"schema_version",
				"launch_request_id",
				"workflow_id",
				"attempt_id",
				"lane_id",
				"parent_session_ref",
				"agent_ref",
				"provider_qualified_model_id",
				"launch_reason",
				"pre_launch_audit_ref",
				"lane_launch_approval_ref",
				"requested_at",
				"timeout_ms",
				"orphan_max_age_ms",
				"retry_budget",
				"dispatch_authority_enabled",
				"providerCall",
				"actualLaneLaunch",
				"runtimeExecution",
			],
			"runtime lane launch request",
		).errors,
	);
	if (record.schema_version !== "flowdesk.runtime_lane_launch_request.v1")
		errors.push("runtime lane launch request schema_version is invalid");
	errors.push(...validateOpaqueId(record.launch_request_id, "launch_request_id").errors);
	errors.push(...validateOpaqueId(record.workflow_id, "workflow_id").errors);
	errors.push(...validateOpaqueId(record.attempt_id, "attempt_id").errors);
	errors.push(...validateOpaqueId(record.lane_id, "lane_id").errors);
	errors.push(...refWithPrefix(record.parent_session_ref, "parent_session_ref", ["ses-"]).errors);
	errors.push(...refWithPrefix(record.agent_ref, "agent_ref", ["agent-"]).errors);
	errors.push(
		...validateConcreteProviderQualifiedModelId(
			record.provider_qualified_model_id,
		).errors,
	);
	if (
		!(FLOWDESK_RUNTIME_LANE_LAUNCH_REASONS as readonly string[]).includes(
			record.launch_reason ?? "",
		)
	)
		errors.push("runtime lane launch reason is invalid");
	if (record.pre_launch_audit_ref !== undefined)
		errors.push(...refWithPrefix(record.pre_launch_audit_ref, "pre_launch_audit_ref", ["audit-"]).errors);
	if (record.lane_launch_approval_ref !== undefined)
		errors.push(
			...refWithPrefix(record.lane_launch_approval_ref, "lane_launch_approval_ref", ["approval-"]).errors,
		);
	errors.push(...timestamp(record.requested_at, "requested_at").errors);
	errors.push(...boundedNonNegativeInt(record.timeout_ms, "timeout_ms", 600_000).errors);
	errors.push(
		...boundedNonNegativeInt(
			record.orphan_max_age_ms,
			"orphan_max_age_ms",
			3_600_000,
		).errors,
	);
	errors.push(...boundedNonNegativeInt(record.retry_budget, "retry_budget", 2).errors);
	if (
		record.dispatch_authority_enabled !== false ||
		record.providerCall !== false ||
		record.actualLaneLaunch !== false ||
		record.runtimeExecution !== false
	)
		errors.push("runtime lane launch request cannot enable or claim runtime authority");
	errors.push(...validateNoForbiddenRawPayloads(record, "runtime_lane_launch_request").errors);
	return errors.length === 0 ? valid() : invalid(...errors);
}

export function validateFlowDeskRuntimeLaneLaunchPlanV1(
	value: unknown,
): ValidationResult {
	if (!isRecord(value)) return invalid("runtime lane launch plan must be an object");
	const record = value as Partial<FlowDeskRuntimeLaneLaunchPlanV1>;
	const errors: string[] = [];
	errors.push(
		...rejectUnknownProperties(
			record,
			[
				"schema_version",
				"ok",
				"errors",
				"launch_request_id",
				"workflow_id",
				"attempt_id",
				"lane_id",
				"state",
				"blocked_labels",
				"parent_session_ref",
				"agent_ref",
				"provider_qualified_model_id",
				"launch_reason",
				"pre_launch_audit_ref",
				"lane_launch_approval_ref",
				"durable_evidence_root_ref",
				"lifecycle_evidence_class",
				"exact_binding_confirmed",
				"sdk_client_required",
				"launch_attempted",
				"dispatch_authority_enabled",
				"providerCall",
				"actualLaneLaunch",
				"runtimeExecution",
			],
			"runtime lane launch plan",
		).errors,
	);
	if (record.schema_version !== "flowdesk.runtime_lane_launch_plan.v1")
		errors.push("runtime lane launch plan schema_version is invalid");
	if (record.launch_request_id !== undefined)
		errors.push(...validateOpaqueId(record.launch_request_id, "launch_request_id").errors);
	if (record.workflow_id !== undefined)
		errors.push(...validateOpaqueId(record.workflow_id, "workflow_id").errors);
	if (record.attempt_id !== undefined)
		errors.push(...validateOpaqueId(record.attempt_id, "attempt_id").errors);
	if (record.lane_id !== undefined)
		errors.push(...validateOpaqueId(record.lane_id, "lane_id").errors);
	if (record.parent_session_ref !== undefined)
		errors.push(...refWithPrefix(record.parent_session_ref, "parent_session_ref", ["ses-"]).errors);
	if (record.agent_ref !== undefined)
		errors.push(...refWithPrefix(record.agent_ref, "agent_ref", ["agent-"]).errors);
	if (record.provider_qualified_model_id !== undefined)
		errors.push(
			...validateConcreteProviderQualifiedModelId(
				record.provider_qualified_model_id,
			).errors,
		);
	if (
		record.launch_reason !== undefined &&
		!(FLOWDESK_RUNTIME_LANE_LAUNCH_REASONS as readonly string[]).includes(
			record.launch_reason,
		)
	)
		errors.push("runtime lane launch plan reason is invalid");
	if (record.pre_launch_audit_ref !== undefined)
		errors.push(...refWithPrefix(record.pre_launch_audit_ref, "pre_launch_audit_ref", ["audit-"]).errors);
	if (record.lane_launch_approval_ref !== undefined)
		errors.push(
			...refWithPrefix(record.lane_launch_approval_ref, "lane_launch_approval_ref", ["approval-"]).errors,
		);
	if (record.durable_evidence_root_ref !== undefined)
		errors.push(
			...refWithPrefix(record.durable_evidence_root_ref, "durable_evidence_root_ref", ["evidence-root-"]).errors,
		);
	if (record.state !== "launch_ready" && record.state !== "blocked")
		errors.push("runtime lane launch plan state is invalid");
	if (!Array.isArray(record.blocked_labels)) errors.push("blocked_labels must be an array");
	else
		for (const [index, label] of record.blocked_labels.entries())
			errors.push(...validateOpaqueId(label, `blocked_labels[${index}]`).errors);
	if (record.state === "launch_ready" && (record.blocked_labels?.length ?? 0) > 0)
		errors.push("launch_ready plan cannot carry blocked labels");
	if (record.state === "blocked" && (record.blocked_labels?.length ?? 0) === 0)
		errors.push("blocked launch plan requires blocked labels");
	if (record.lifecycle_evidence_class !== "lane_lifecycle")
		errors.push("runtime lane launch plan must target lane_lifecycle evidence");
	if (record.exact_binding_confirmed !== (record.state === "launch_ready"))
		errors.push("exact binding confirmation must match launch readiness");
	if (record.sdk_client_required !== true)
		errors.push("runtime lane launch plan must require an injected SDK client");
	if (
		record.launch_attempted !== false ||
		record.dispatch_authority_enabled !== false ||
		record.providerCall !== false ||
		record.actualLaneLaunch !== false ||
		record.runtimeExecution !== false
	)
		errors.push("runtime lane launch plan cannot attempt launch or enable authority");
	errors.push(...validateNoForbiddenRawPayloads(record, "runtime_lane_launch_plan").errors);
	return errors.length === 0 ? valid() : invalid(...errors);
}

export function planFlowDeskRuntimeLaneLaunchV1(input: {
	request: FlowDeskRuntimeLaneLaunchRequestV1;
	sdkClientAvailable?: boolean;
	durableEvidenceRootRef?: string;
}): FlowDeskRuntimeLaneLaunchPlanV1 {
	const requestResult = validateFlowDeskRuntimeLaneLaunchRequestV1(input.request);
	const errors = [...requestResult.errors];
	const blockedLabels: string[] = [];
	if (!requestResult.ok) blockedLabels.push("launch_request_invalid");
	if (input.request.pre_launch_audit_ref === undefined)
		blockedLabels.push("pre_launch_audit_missing");
	if (input.request.lane_launch_approval_ref === undefined)
		blockedLabels.push("lane_launch_approval_missing");
	if (input.sdkClientAvailable !== true)
		blockedLabels.push("sdk_client_unavailable");
	if (input.durableEvidenceRootRef === undefined)
		blockedLabels.push("durable_evidence_root_missing");
	else {
		const rootResult = refWithPrefix(
			input.durableEvidenceRootRef,
			"durable_evidence_root_ref",
			["evidence-root-"],
		);
		errors.push(...rootResult.errors);
		if (!rootResult.ok) blockedLabels.push("durable_evidence_root_invalid");
	}
	const ready = errors.length === 0 && blockedLabels.length === 0;
	return {
		schema_version: "flowdesk.runtime_lane_launch_plan.v1",
		ok: errors.length === 0,
		errors,
		launch_request_id: input.request.launch_request_id,
		workflow_id: input.request.workflow_id,
		attempt_id: input.request.attempt_id,
		lane_id: input.request.lane_id,
		state: ready ? "launch_ready" : "blocked",
		blocked_labels: [...new Set(blockedLabels)],
		parent_session_ref: input.request.parent_session_ref,
		agent_ref: input.request.agent_ref,
		provider_qualified_model_id: input.request.provider_qualified_model_id,
		launch_reason: input.request.launch_reason,
		pre_launch_audit_ref: input.request.pre_launch_audit_ref,
		lane_launch_approval_ref: input.request.lane_launch_approval_ref,
		durable_evidence_root_ref: input.durableEvidenceRootRef,
		lifecycle_evidence_class: "lane_lifecycle",
		exact_binding_confirmed: ready,
		sdk_client_required: true,
		launch_attempted: false,
		...disabledRuntimeLaneAuthority,
	};
}

export function projectFlowDeskRuntimeLaneLifecycleV1(input: {
	plan?: FlowDeskRuntimeLaneLaunchPlanV1;
	lifecycle?: FlowDeskLaneLifecycleRecordV1;
}): FlowDeskRuntimeLaneLifecycleProjectionV1 {
	const errors: string[] = [];
	const blockedLabels: string[] = [];
	if (input.plan !== undefined) {
		const planResult = validateFlowDeskRuntimeLaneLaunchPlanV1(input.plan);
		errors.push(...planResult.errors);
		if (!planResult.ok || input.plan.state === "blocked")
			blockedLabels.push(...(input.plan.blocked_labels.length > 0 ? input.plan.blocked_labels : ["launch_plan_blocked"]));
	}
	if (input.lifecycle !== undefined) {
		const lifecycleResult = validateFlowDeskLaneLifecycleRecordV1(input.lifecycle);
		errors.push(...lifecycleResult.errors);
		if (!lifecycleResult.ok) blockedLabels.push("lane_lifecycle_invalid");
	}
	let projectionState: FlowDeskRuntimeLaneLifecycleProjectionV1["projection_state"] =
		"blocked";
	if (errors.length > 0 || blockedLabels.length > 0) projectionState = "blocked";
	else if (input.lifecycle !== undefined) {
		projectionState = input.lifecycle.state === "complete"
			? "complete_with_verdict"
			: ["created", "running"].includes(input.lifecycle.state)
				? "in_progress"
				: "terminal_non_approval";
	} else if (input.plan?.state === "launch_ready") projectionState = "launch_ready";
	const safeNextActions: SafeNextAction[] = projectionState === "blocked"
		? ["/flowdesk-status", "/flowdesk-export-debug"]
		: projectionState === "launch_ready" || projectionState === "in_progress"
			? ["/flowdesk-status"]
			: ["/flowdesk-status", "/flowdesk-run"];
	return {
		schema_version: "flowdesk.runtime_lane_lifecycle_projection.v1",
		ok: errors.length === 0,
		errors,
		workflow_id: input.lifecycle?.workflow_id ?? input.plan?.workflow_id,
		attempt_id: input.lifecycle?.attempt_id ?? input.plan?.attempt_id,
		lane_id: input.lifecycle?.lane_id ?? input.plan?.lane_id,
		projection_state: projectionState,
		lifecycle_state: input.lifecycle?.state,
		verdict_ref: input.lifecycle?.state === "complete" ? input.lifecycle.verdict_ref : undefined,
		blocked_labels: [...new Set(blockedLabels)],
		safe_next_actions: safeNextActions,
		approval_inferred: false,
		...disabledRuntimeLaneAuthority,
	};
}
