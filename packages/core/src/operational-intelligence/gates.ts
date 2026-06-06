/**
 * Advisory gate contracts: score reuse threshold gate and fanout cadence gate.
 * P7-S13.5 submodule: gates
 */
import {
	type ValidationResult,
	valid,
	invalid,
	validateNoForbiddenRawPayloads,
	validateOpaqueId,
	validateOpaqueRef,
	isRecord,
	rejectUnknownProperties,
	validateTimestamp,
	validateHashRef,
} from "./shared.js";

// ─── Score Reuse Threshold Gate ───────────────────────────────────────────────

/**
 * Advisory decision label for whether an existing score/aggregation can be
 * reused, must be recomputed, or is blocked from any use.
 */
export type FlowDeskScoreReuseDecisionLabelV1 = "reuse" | "recompute" | "blocked";

/**
 * Advisory-only contract encoding a bounded reuse vs recompute decision for an
 * existing `FlowDeskOptimizerProposalScoreV1` or `FlowDeskNormalizedScoreAggregationV1`.
 */
export interface FlowDeskScoreReuseThresholdGateV1 {
	schema_version: "flowdesk.score_reuse_threshold_gate.v1";
	gate_id: string;
	workflow_id: string;
	previous_score_ref: string;
	previous_context_hash: string;
	current_context_hash: string;
	score_age_seconds: number;
	max_age_threshold_seconds: number;
	min_score_threshold: number;
	previous_advisory_score: number;
	context_match: boolean;
	within_age_threshold: boolean;
	above_min_score: boolean;
	gate_decision: FlowDeskScoreReuseDecisionLabelV1;
	reason_refs: string[];
	evaluated_at: string;
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
}

export interface FlowDeskScoreReuseThresholdGateResultV1 {
	ok: boolean;
	errors: string[];
	gate?: FlowDeskScoreReuseThresholdGateV1;
}

export function createFlowDeskScoreReuseThresholdGateV1(input: {
	gateId: string;
	workflowId: string;
	previousScoreRef: string;
	previousContextHash: string;
	currentContextHash: string;
	scoreAgeSeconds: number;
	maxAgeThresholdSeconds: number;
	minScoreThreshold?: number;
	previousAdvisoryScore: number;
	reasonRefs: string[];
	evaluatedAt: string;
}): FlowDeskScoreReuseThresholdGateResultV1 {
	const errors: string[] = [];
	errors.push(...validateOpaqueId(input.gateId, "gate_id").errors);
	errors.push(...validateOpaqueId(input.workflowId, "workflow_id").errors);
	errors.push(...validateOpaqueRef(input.previousScoreRef, "previous_score_ref").errors);
	errors.push(...validateHashRef(input.previousContextHash, "previous_context_hash").errors);
	errors.push(...validateHashRef(input.currentContextHash, "current_context_hash").errors);
	errors.push(...validateTimestamp(input.evaluatedAt, "evaluated_at").errors);
	if (typeof input.scoreAgeSeconds !== "number" || !Number.isFinite(input.scoreAgeSeconds) || input.scoreAgeSeconds < 0) errors.push("score_age_seconds must be a non-negative finite number");
	if (typeof input.maxAgeThresholdSeconds !== "number" || !Number.isFinite(input.maxAgeThresholdSeconds) || input.maxAgeThresholdSeconds <= 0) errors.push("max_age_threshold_seconds must be a positive finite number");
	const minScoreThreshold = input.minScoreThreshold ?? 0;
	if (typeof minScoreThreshold !== "number" || !Number.isFinite(minScoreThreshold) || minScoreThreshold < 0 || minScoreThreshold > 100) errors.push("min_score_threshold must be 0..100");
	if (typeof input.previousAdvisoryScore !== "number" || !Number.isFinite(input.previousAdvisoryScore) || input.previousAdvisoryScore < 0 || input.previousAdvisoryScore > 100) errors.push("previous_advisory_score must be 0..100");
	if (!Array.isArray(input.reasonRefs) || input.reasonRefs.length === 0) errors.push("reason_refs must be a non-empty array");
	else for (const [index, ref] of input.reasonRefs.entries()) errors.push(...validateOpaqueRef(ref, `reason_refs[${index}]`).errors);
	if (errors.length > 0) return { ok: false, errors };

	const contextMatch = input.previousContextHash === input.currentContextHash;
	const withinAgeThreshold = input.scoreAgeSeconds <= input.maxAgeThresholdSeconds;
	const aboveMinScore = input.previousAdvisoryScore >= minScoreThreshold;

	let gateDecision: FlowDeskScoreReuseDecisionLabelV1;
	if (!contextMatch || !withinAgeThreshold || !aboveMinScore) {
		gateDecision = "recompute";
	} else {
		gateDecision = "reuse";
	}

	const gate: FlowDeskScoreReuseThresholdGateV1 = {
		schema_version: "flowdesk.score_reuse_threshold_gate.v1",
		gate_id: input.gateId,
		workflow_id: input.workflowId,
		previous_score_ref: input.previousScoreRef,
		previous_context_hash: input.previousContextHash,
		current_context_hash: input.currentContextHash,
		score_age_seconds: input.scoreAgeSeconds,
		max_age_threshold_seconds: input.maxAgeThresholdSeconds,
		min_score_threshold: minScoreThreshold,
		previous_advisory_score: input.previousAdvisoryScore,
		context_match: contextMatch,
		within_age_threshold: withinAgeThreshold,
		above_min_score: aboveMinScore,
		gate_decision: gateDecision,
		reason_refs: [...input.reasonRefs],
		evaluated_at: input.evaluatedAt,
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
	};
	return { ok: true, errors: [], gate };
}

const scoreReuseThresholdGateAllowedProperties = [
	"schema_version",
	"gate_id",
	"workflow_id",
	"previous_score_ref",
	"previous_context_hash",
	"current_context_hash",
	"score_age_seconds",
	"max_age_threshold_seconds",
	"min_score_threshold",
	"previous_advisory_score",
	"context_match",
	"within_age_threshold",
	"above_min_score",
	"gate_decision",
	"reason_refs",
	"evaluated_at",
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
] as const;

const scoreReuseDecisionLabels: readonly string[] = ["reuse", "recompute", "blocked"];

export function validateFlowDeskScoreReuseThresholdGateV1(value: unknown): ValidationResult {
	if (!isRecord(value)) return invalid("score reuse threshold gate must be an object");
	const record = value as Record<string, unknown>;
	const errors: string[] = [];

	errors.push(...rejectUnknownProperties(record, scoreReuseThresholdGateAllowedProperties, "score reuse threshold gate").errors);

	if (record.schema_version !== "flowdesk.score_reuse_threshold_gate.v1") errors.push("score reuse threshold gate schema_version is invalid");
	if (record.release_gate !== "operational_intelligence_later_gate") errors.push("score reuse threshold gate release_gate is invalid");

	errors.push(...validateOpaqueId(record.gate_id, "gate_id").errors);
	errors.push(...validateOpaqueId(record.workflow_id, "workflow_id").errors);
	errors.push(...validateOpaqueRef(record.previous_score_ref, "previous_score_ref").errors);
	errors.push(...validateHashRef(record.previous_context_hash, "previous_context_hash").errors);
	errors.push(...validateHashRef(record.current_context_hash, "current_context_hash").errors);
	errors.push(...validateTimestamp(record.evaluated_at, "evaluated_at").errors);

	if (typeof record.score_age_seconds !== "number" || !Number.isFinite(record.score_age_seconds) || record.score_age_seconds < 0) errors.push("score_age_seconds must be a non-negative finite number");
	if (typeof record.max_age_threshold_seconds !== "number" || !Number.isFinite(record.max_age_threshold_seconds) || record.max_age_threshold_seconds <= 0) errors.push("max_age_threshold_seconds must be a positive finite number");
	if (typeof record.min_score_threshold !== "number" || !Number.isFinite(record.min_score_threshold) || record.min_score_threshold < 0 || record.min_score_threshold > 100) errors.push("min_score_threshold must be 0..100");
	if (typeof record.previous_advisory_score !== "number" || !Number.isFinite(record.previous_advisory_score) || record.previous_advisory_score < 0 || record.previous_advisory_score > 100) errors.push("previous_advisory_score must be 0..100");

	if (typeof record.context_match !== "boolean") errors.push("context_match must be a boolean");
	if (typeof record.within_age_threshold !== "boolean") errors.push("within_age_threshold must be a boolean");
	if (typeof record.above_min_score !== "boolean") errors.push("above_min_score must be a boolean");

	if (typeof record.gate_decision !== "string" || !scoreReuseDecisionLabels.includes(record.gate_decision)) errors.push("gate_decision must be 'reuse', 'recompute', or 'blocked'");

	if (!Array.isArray(record.reason_refs) || record.reason_refs.length === 0) errors.push("reason_refs must be a non-empty array");
	else for (const [index, ref] of record.reason_refs.entries()) errors.push(...validateOpaqueRef(ref, `reason_refs[${index}]`).errors);

	if (record.gate_decision === "reuse" && (record.context_match !== true || record.within_age_threshold !== true || record.above_min_score !== true)) {
		errors.push("gate_decision 'reuse' requires context_match, within_age_threshold, and above_min_score to all be true");
	}

	if (record.gate_decision === "blocked"
		&& record.context_match === true
		&& record.within_age_threshold === true
		&& record.above_min_score === true) {
		errors.push("gate_decision 'blocked' is inconsistent: all sub-conditions are true but gate claims blocked");
	}

	if (record.advisory_only !== true
		|| record.non_authorizing !== true
		|| record.dispatch_authority_enabled !== false
		|| record.approval_authority_enabled !== false
		|| record.provider_authority_enabled !== false
		|| record.runtime_authority_enabled !== false
		|| record.external_write_authority_enabled !== false
		|| record.remote_write_authority_enabled !== false
		|| record.fallback_authority_enabled !== false
		|| record.lane_launch_authority_enabled !== false
		|| record.write_authority_enabled !== false
		|| record.hard_chat_authority_enabled !== false) {
		errors.push("score reuse threshold gate must remain advisory-only non-authorizing with no dispatch, approval, provider, runtime, external-write, remote-write, fallback, lane-launch, write, or hard-chat authority");
	}

	errors.push(...validateNoForbiddenRawPayloads(record, "score_reuse_threshold_gate").errors);
	return errors.length === 0 ? valid() : invalid(...errors);
}

// ─── Fanout Cadence Gate ──────────────────────────────────────────────────────

/**
 * Advisory decision label for whether a proposed multi-lane fanout/cadence is
 * within safe bounds.
 */
export type FlowDeskFanoutCadenceDecisionLabelV1 = "allow" | "reduce" | "hold" | "blocked";

/**
 * Advisory-only contract encoding a bounded fanout/cadence gate decision for a
 * proposed multi-lane execution.
 */
export interface FlowDeskFanoutCadenceGateV1 {
	schema_version: "flowdesk.fanout_cadence_gate.v1";
	gate_id: string;
	workflow_id: string;
	requested_lane_count: number;
	max_concurrent_lanes: number;
	active_lane_count: number;
	cadence_window_seconds: number;
	cooldown_seconds: number;
	seconds_since_last_burst: number;
	risk_labels: string[];
	dependency_refs: string[];
	reason_refs: string[];
	gate_decision: FlowDeskFanoutCadenceDecisionLabelV1;
	evaluated_at: string;
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
}

export interface FlowDeskFanoutCadenceGateResultV1 {
	ok: boolean;
	errors: string[];
	gate?: FlowDeskFanoutCadenceGateV1;
}

export function createFlowDeskFanoutCadenceGateV1(input: {
	gateId: string;
	workflowId: string;
	requestedLaneCount: number;
	maxConcurrentLanes: number;
	activeLaneCount: number;
	cadenceWindowSeconds: number;
	cooldownSeconds: number;
	secondsSinceLastBurst: number;
	riskLabels?: string[];
	dependencyRefs?: string[];
	reasonRefs: string[];
	evaluatedAt: string;
}): FlowDeskFanoutCadenceGateResultV1 {
	const errors: string[] = [];
	errors.push(...validateOpaqueId(input.gateId, "gate_id").errors);
	errors.push(...validateOpaqueId(input.workflowId, "workflow_id").errors);
	errors.push(...validateTimestamp(input.evaluatedAt, "evaluated_at").errors);

	if (typeof input.requestedLaneCount !== "number" || !Number.isInteger(input.requestedLaneCount) || input.requestedLaneCount < 1) errors.push("requested_lane_count must be a positive integer >= 1");
	if (typeof input.maxConcurrentLanes !== "number" || !Number.isInteger(input.maxConcurrentLanes) || input.maxConcurrentLanes < 1) errors.push("max_concurrent_lanes must be a positive integer >= 1");
	if (typeof input.activeLaneCount !== "number" || !Number.isInteger(input.activeLaneCount) || input.activeLaneCount < 0) errors.push("active_lane_count must be a non-negative integer");
	if (typeof input.cadenceWindowSeconds !== "number" || !Number.isFinite(input.cadenceWindowSeconds) || input.cadenceWindowSeconds < 0) errors.push("cadence_window_seconds must be a non-negative finite number");
	if (typeof input.cooldownSeconds !== "number" || !Number.isFinite(input.cooldownSeconds) || input.cooldownSeconds < 0) errors.push("cooldown_seconds must be a non-negative finite number");
	if (typeof input.secondsSinceLastBurst !== "number" || !Number.isFinite(input.secondsSinceLastBurst) || input.secondsSinceLastBurst < 0) errors.push("seconds_since_last_burst must be a non-negative finite number");

	const riskLabels = input.riskLabels ?? [];
	if (!Array.isArray(riskLabels)) errors.push("risk_labels must be an array");
	else for (const [index, label] of riskLabels.entries()) errors.push(...validateOpaqueRef(label, `risk_labels[${index}]`).errors);

	const dependencyRefs = input.dependencyRefs ?? [];
	if (!Array.isArray(dependencyRefs)) errors.push("dependency_refs must be an array");
	else for (const [index, ref] of dependencyRefs.entries()) errors.push(...validateOpaqueRef(ref, `dependency_refs[${index}]`).errors);

	if (!Array.isArray(input.reasonRefs) || input.reasonRefs.length === 0) errors.push("reason_refs must be a non-empty array");
	else for (const [index, ref] of input.reasonRefs.entries()) errors.push(...validateOpaqueRef(ref, `reason_refs[${index}]`).errors);

	if (errors.length > 0) return { ok: false, errors };

	let gateDecision: FlowDeskFanoutCadenceDecisionLabelV1;

	if (input.requestedLaneCount > input.maxConcurrentLanes) {
		gateDecision = "blocked";
	} else if (
		(input.activeLaneCount + input.requestedLaneCount) > input.maxConcurrentLanes ||
		(input.cooldownSeconds > 0 && input.secondsSinceLastBurst < input.cooldownSeconds)
	) {
		gateDecision = "hold";
	} else if (input.requestedLaneCount > Math.floor(input.maxConcurrentLanes / 2)) {
		gateDecision = "reduce";
	} else {
		gateDecision = "allow";
	}

	const gate: FlowDeskFanoutCadenceGateV1 = {
		schema_version: "flowdesk.fanout_cadence_gate.v1",
		gate_id: input.gateId,
		workflow_id: input.workflowId,
		requested_lane_count: input.requestedLaneCount,
		max_concurrent_lanes: input.maxConcurrentLanes,
		active_lane_count: input.activeLaneCount,
		cadence_window_seconds: input.cadenceWindowSeconds,
		cooldown_seconds: input.cooldownSeconds,
		seconds_since_last_burst: input.secondsSinceLastBurst,
		risk_labels: [...riskLabels],
		dependency_refs: [...dependencyRefs],
		reason_refs: [...input.reasonRefs],
		gate_decision: gateDecision,
		evaluated_at: input.evaluatedAt,
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
	};
	return { ok: true, errors: [], gate };
}

const fanoutCadenceGateAllowedProperties = [
	"schema_version",
	"gate_id",
	"workflow_id",
	"requested_lane_count",
	"max_concurrent_lanes",
	"active_lane_count",
	"cadence_window_seconds",
	"cooldown_seconds",
	"seconds_since_last_burst",
	"risk_labels",
	"dependency_refs",
	"reason_refs",
	"gate_decision",
	"evaluated_at",
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
] as const;

const fanoutCadenceDecisionLabels: readonly string[] = ["allow", "reduce", "hold", "blocked"];

export function validateFlowDeskFanoutCadenceGateV1(value: unknown): ValidationResult {
	if (!isRecord(value)) return invalid("fanout cadence gate must be an object");
	const record = value as Record<string, unknown>;
	const errors: string[] = [];

	errors.push(...rejectUnknownProperties(record, fanoutCadenceGateAllowedProperties, "fanout cadence gate").errors);

	if (record.schema_version !== "flowdesk.fanout_cadence_gate.v1") errors.push("fanout cadence gate schema_version is invalid");
	if (record.release_gate !== "operational_intelligence_later_gate") errors.push("fanout cadence gate release_gate is invalid");

	errors.push(...validateOpaqueId(record.gate_id, "gate_id").errors);
	errors.push(...validateOpaqueId(record.workflow_id, "workflow_id").errors);
	errors.push(...validateTimestamp(record.evaluated_at, "evaluated_at").errors);

	if (typeof record.requested_lane_count !== "number" || !Number.isInteger(record.requested_lane_count) || record.requested_lane_count < 1) errors.push("requested_lane_count must be a positive integer >= 1");
	if (typeof record.max_concurrent_lanes !== "number" || !Number.isInteger(record.max_concurrent_lanes) || record.max_concurrent_lanes < 1) errors.push("max_concurrent_lanes must be a positive integer >= 1");
	if (typeof record.active_lane_count !== "number" || !Number.isInteger(record.active_lane_count) || record.active_lane_count < 0) errors.push("active_lane_count must be a non-negative integer");
	if (typeof record.cadence_window_seconds !== "number" || !Number.isFinite(record.cadence_window_seconds) || record.cadence_window_seconds < 0) errors.push("cadence_window_seconds must be a non-negative finite number");
	if (typeof record.cooldown_seconds !== "number" || !Number.isFinite(record.cooldown_seconds) || record.cooldown_seconds < 0) errors.push("cooldown_seconds must be a non-negative finite number");
	if (typeof record.seconds_since_last_burst !== "number" || !Number.isFinite(record.seconds_since_last_burst) || record.seconds_since_last_burst < 0) errors.push("seconds_since_last_burst must be a non-negative finite number");

	if (!Array.isArray(record.risk_labels)) errors.push("risk_labels must be an array");
	else for (const [index, label] of record.risk_labels.entries()) errors.push(...validateOpaqueRef(label, `risk_labels[${index}]`).errors);

	if (!Array.isArray(record.dependency_refs)) errors.push("dependency_refs must be an array");
	else for (const [index, ref] of record.dependency_refs.entries()) errors.push(...validateOpaqueRef(ref, `dependency_refs[${index}]`).errors);

	if (!Array.isArray(record.reason_refs) || record.reason_refs.length === 0) errors.push("reason_refs must be a non-empty array");
	else for (const [index, ref] of (record.reason_refs as unknown[]).entries()) errors.push(...validateOpaqueRef(ref, `reason_refs[${index}]`).errors);

	if (typeof record.gate_decision !== "string" || !fanoutCadenceDecisionLabels.includes(record.gate_decision)) {
		errors.push("gate_decision must be 'allow', 'reduce', 'hold', or 'blocked'");
	}

	if (record.gate_decision === "allow") {
		if (typeof record.requested_lane_count === "number" && typeof record.max_concurrent_lanes === "number" &&
			record.requested_lane_count > record.max_concurrent_lanes) {
			errors.push("gate_decision 'allow' is inconsistent: requested_lane_count exceeds max_concurrent_lanes");
		}
		if (typeof record.active_lane_count === "number" && typeof record.requested_lane_count === "number" &&
			typeof record.max_concurrent_lanes === "number" &&
			(record.active_lane_count + record.requested_lane_count) > record.max_concurrent_lanes) {
			errors.push("gate_decision 'allow' is inconsistent: active_lane_count + requested_lane_count exceeds max_concurrent_lanes");
		}
		if (typeof record.cooldown_seconds === "number" && record.cooldown_seconds > 0 &&
			typeof record.seconds_since_last_burst === "number" &&
			record.seconds_since_last_burst < record.cooldown_seconds) {
			errors.push("gate_decision 'allow' is inconsistent: cooldown has not yet elapsed");
		}
	}

	if (record.gate_decision === "blocked") {
		if (typeof record.requested_lane_count === "number" && typeof record.max_concurrent_lanes === "number" &&
			record.requested_lane_count <= record.max_concurrent_lanes &&
			typeof record.active_lane_count === "number" &&
			(record.active_lane_count + record.requested_lane_count) <= record.max_concurrent_lanes &&
			typeof record.cooldown_seconds === "number" &&
			typeof record.seconds_since_last_burst === "number" &&
			(record.cooldown_seconds === 0 || record.seconds_since_last_burst >= record.cooldown_seconds)) {
			errors.push("gate_decision 'blocked' is inconsistent: all constraints pass but gate claims blocked");
		}
	}

	if (record.advisory_only !== true
		|| record.non_authorizing !== true
		|| record.dispatch_authority_enabled !== false
		|| record.approval_authority_enabled !== false
		|| record.provider_authority_enabled !== false
		|| record.runtime_authority_enabled !== false
		|| record.external_write_authority_enabled !== false
		|| record.remote_write_authority_enabled !== false
		|| record.fallback_authority_enabled !== false
		|| record.lane_launch_authority_enabled !== false
		|| record.write_authority_enabled !== false
		|| record.hard_chat_authority_enabled !== false) {
		errors.push("fanout cadence gate must remain advisory-only non-authorizing with no dispatch, approval, provider, runtime, external-write, remote-write, fallback, lane-launch, write, or hard-chat authority");
	}

	errors.push(...validateNoForbiddenRawPayloads(record, "fanout_cadence_gate").errors);
	return errors.length === 0 ? valid() : invalid(...errors);
}

// ─── Surplus Usage Gate ───────────────────────────────────────────────────────

/**
 * Advisory decision label for the surplus usage gate.
 * Controls whether the operational intelligence can proceed with fanout.
 */
export type FlowDeskSurplusUsageDecisionLabelV1 =
	| "allow"
	| "blocked_stale_usage"
	| "blocked_alert_level"
	| "blocked_insufficient_surplus";

/**
 * Advisory-only contract encoding a bounded surplus usage gate decision.
 * Checks whether the provider has sufficient remaining quota headroom.
 */
export interface FlowDeskSurplusUsageGateV1 {
	schema_version: "flowdesk.surplus_usage_gate.v1";
	gate_id: string;
	workflow_id: string;
	snapshot_ref: string;
	snapshot_hash: string;
	snapshot_captured_at: string;
	evaluated_at: string;
	snapshot_age_seconds: number;
	max_snapshot_age_seconds: number;
	provider_family: "claude" | "openai" | "gemini";
	bucket_label: string;
	remaining_percent: number;
	surplus_threshold_percent: number;
	alert_level: "ok" | "warning" | "critical" | "exhausted" | "stale" | "unknown";
	snapshot_fresh: boolean;
	alert_level_safe: boolean;
	surplus_sufficient: boolean;
	gate_verdict: FlowDeskSurplusUsageDecisionLabelV1;
	blocked_labels: string[];
	reason_refs: string[];
	release_gate: "operational_intelligence_later_gate";
	advisory_only: true;
	non_authorizing: true;
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
}

export interface FlowDeskSurplusUsageGateResultV1 {
	ok: boolean;
	errors: string[];
	gate?: FlowDeskSurplusUsageGateV1;
}

const unsafeAlertLevels = new Set(["critical", "exhausted", "stale", "unknown"]);

export function createFlowDeskSurplusUsageGateV1(input: {
	gateId: string;
	workflowId: string;
	snapshotRef: string;
	snapshotHash: string;
	snapshotCapturedAt: string;
	evaluatedAt: string;
	snapshotAgeSeconds: number;
	maxSnapshotAgeSeconds: number;
	providerFamily: string;
	bucketLabel: string;
	remainingPercent: number;
	surplusThresholdPercent: number;
	alertLevel: string;
	reasonRefs: string[];
}): FlowDeskSurplusUsageGateResultV1 {
	const errors: string[] = [];
	errors.push(...validateOpaqueId(input.gateId, "gate_id").errors);
	errors.push(...validateOpaqueId(input.workflowId, "workflow_id").errors);
	errors.push(...validateOpaqueRef(input.snapshotRef, "snapshot_ref").errors);
	errors.push(...validateHashRef(input.snapshotHash, "snapshot_hash").errors);
	errors.push(...validateTimestamp(input.snapshotCapturedAt, "snapshot_captured_at").errors);
	errors.push(...validateTimestamp(input.evaluatedAt, "evaluated_at").errors);

	if (typeof input.snapshotAgeSeconds !== "number" || !Number.isFinite(input.snapshotAgeSeconds) || input.snapshotAgeSeconds < 0) errors.push("snapshot_age_seconds must be a non-negative finite number");
	if (typeof input.maxSnapshotAgeSeconds !== "number" || !Number.isFinite(input.maxSnapshotAgeSeconds) || input.maxSnapshotAgeSeconds < 60 || input.maxSnapshotAgeSeconds > 300) errors.push("max_snapshot_age_seconds must be finite in range [60,300]");
	if (!["claude", "openai", "gemini"].includes(input.providerFamily)) errors.push("provider_family must be 'claude', 'openai', or 'gemini'");
	errors.push(...validateOpaqueRef(input.bucketLabel, "bucket_label").errors);
	if (typeof input.remainingPercent !== "number" || !Number.isFinite(input.remainingPercent) || input.remainingPercent < 0 || input.remainingPercent > 100) errors.push("remaining_percent must be finite in range [0,100]");
	if (typeof input.surplusThresholdPercent !== "number" || !Number.isFinite(input.surplusThresholdPercent) || input.surplusThresholdPercent < 25 || input.surplusThresholdPercent > 95) errors.push("surplus_threshold_percent must be finite in range [25,95]");
	const validAlertLevels = ["ok", "warning", "critical", "exhausted", "stale", "unknown"];
	if (!validAlertLevels.includes(input.alertLevel)) errors.push("alert_level must be one of: ok, warning, critical, exhausted, stale, unknown");

	if (!Array.isArray(input.reasonRefs) || input.reasonRefs.length === 0) errors.push("reason_refs must be a non-empty array");
	else for (const [index, ref] of input.reasonRefs.entries()) errors.push(...validateOpaqueRef(ref, `reason_refs[${index}]`).errors);

	if (errors.length > 0) return { ok: false, errors };

	const snapshotFresh = input.remainingPercent > input.surplusThresholdPercent;
	const alertLevelSafe = !unsafeAlertLevels.has(input.alertLevel);
	const surplusSufficient = input.remainingPercent >= input.surplusThresholdPercent && snapshotFresh && alertLevelSafe;

	// Verdict derivation: first match wins
	let gateVerdict: FlowDeskSurplusUsageDecisionLabelV1;
	const blockedLabels: string[] = [];

	if (input.snapshotAgeSeconds > input.maxSnapshotAgeSeconds) {
		gateVerdict = "blocked_stale_usage";
		blockedLabels.push("snapshot-age-exceeded");
	} else if (unsafeAlertLevels.has(input.alertLevel)) {
		gateVerdict = "blocked_alert_level";
		blockedLabels.push(`alert-level-${input.alertLevel}`);
	} else if (input.remainingPercent < input.surplusThresholdPercent) {
		gateVerdict = "blocked_insufficient_surplus";
		blockedLabels.push("insufficient-surplus");
	} else {
		gateVerdict = "allow";
	}

	const gate: FlowDeskSurplusUsageGateV1 = {
		schema_version: "flowdesk.surplus_usage_gate.v1",
		gate_id: input.gateId,
		workflow_id: input.workflowId,
		snapshot_ref: input.snapshotRef,
		snapshot_hash: input.snapshotHash,
		snapshot_captured_at: input.snapshotCapturedAt,
		evaluated_at: input.evaluatedAt,
		snapshot_age_seconds: input.snapshotAgeSeconds,
		max_snapshot_age_seconds: input.maxSnapshotAgeSeconds,
		provider_family: input.providerFamily as "claude" | "openai" | "gemini",
		bucket_label: input.bucketLabel,
		remaining_percent: input.remainingPercent,
		surplus_threshold_percent: input.surplusThresholdPercent,
		alert_level: input.alertLevel as FlowDeskSurplusUsageGateV1["alert_level"],
		snapshot_fresh: snapshotFresh,
		alert_level_safe: alertLevelSafe,
		surplus_sufficient: surplusSufficient,
		gate_verdict: gateVerdict,
		blocked_labels: blockedLabels,
		reason_refs: [...input.reasonRefs],
		release_gate: "operational_intelligence_later_gate",
		advisory_only: true,
		non_authorizing: true,
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
	};
	return { ok: true, errors: [], gate };
}

const surplusUsageGateAllowedProperties = [
	"schema_version",
	"gate_id",
	"workflow_id",
	"snapshot_ref",
	"snapshot_hash",
	"snapshot_captured_at",
	"evaluated_at",
	"snapshot_age_seconds",
	"max_snapshot_age_seconds",
	"provider_family",
	"bucket_label",
	"remaining_percent",
	"surplus_threshold_percent",
	"alert_level",
	"snapshot_fresh",
	"alert_level_safe",
	"surplus_sufficient",
	"gate_verdict",
	"blocked_labels",
	"reason_refs",
	"release_gate",
	"advisory_only",
	"non_authorizing",
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
] as const;

const surplusUsageDecisionLabels: readonly string[] = ["allow", "blocked_stale_usage", "blocked_alert_level", "blocked_insufficient_surplus"];
const validAlertLevelValues: readonly string[] = ["ok", "warning", "critical", "exhausted", "stale", "unknown"];
const validProviderFamilies: readonly string[] = ["claude", "openai", "gemini"];

export function validateFlowDeskSurplusUsageGateV1(value: unknown): ValidationResult {
	if (!isRecord(value)) return invalid("surplus usage gate must be an object");
	const record = value as Record<string, unknown>;
	const errors: string[] = [];

	errors.push(...rejectUnknownProperties(record, surplusUsageGateAllowedProperties, "surplus usage gate").errors);

	if (record.schema_version !== "flowdesk.surplus_usage_gate.v1") errors.push("surplus usage gate schema_version is invalid");
	if (record.release_gate !== "operational_intelligence_later_gate") errors.push("surplus usage gate release_gate is invalid");

	errors.push(...validateOpaqueId(record.gate_id, "gate_id").errors);
	errors.push(...validateOpaqueId(record.workflow_id, "workflow_id").errors);
	errors.push(...validateOpaqueRef(record.snapshot_ref, "snapshot_ref").errors);
	errors.push(...validateHashRef(record.snapshot_hash, "snapshot_hash").errors);
	errors.push(...validateTimestamp(record.snapshot_captured_at, "snapshot_captured_at").errors);
	errors.push(...validateTimestamp(record.evaluated_at, "evaluated_at").errors);

	if (typeof record.snapshot_age_seconds !== "number" || !Number.isFinite(record.snapshot_age_seconds) || record.snapshot_age_seconds < 0) errors.push("snapshot_age_seconds must be a non-negative finite number");
	if (typeof record.max_snapshot_age_seconds !== "number" || !Number.isFinite(record.max_snapshot_age_seconds) || record.max_snapshot_age_seconds < 60 || record.max_snapshot_age_seconds > 300) errors.push("max_snapshot_age_seconds must be finite in range [60,300]");
	if (typeof record.provider_family !== "string" || !validProviderFamilies.includes(record.provider_family)) errors.push("provider_family must be 'claude', 'openai', or 'gemini'");
	errors.push(...validateOpaqueRef(record.bucket_label, "bucket_label").errors);
	if (typeof record.remaining_percent !== "number" || !Number.isFinite(record.remaining_percent) || record.remaining_percent < 0 || record.remaining_percent > 100) errors.push("remaining_percent must be finite in range [0,100]");
	if (typeof record.surplus_threshold_percent !== "number" || !Number.isFinite(record.surplus_threshold_percent) || record.surplus_threshold_percent < 25 || record.surplus_threshold_percent > 95) errors.push("surplus_threshold_percent must be finite in range [25,95]");
	if (typeof record.alert_level !== "string" || !validAlertLevelValues.includes(record.alert_level)) errors.push("alert_level must be one of: ok, warning, critical, exhausted, stale, unknown");

	if (typeof record.snapshot_fresh !== "boolean") errors.push("snapshot_fresh must be a boolean");
	if (typeof record.alert_level_safe !== "boolean") errors.push("alert_level_safe must be a boolean");
	if (typeof record.surplus_sufficient !== "boolean") errors.push("surplus_sufficient must be a boolean");

	if (typeof record.gate_verdict !== "string" || !surplusUsageDecisionLabels.includes(record.gate_verdict)) errors.push("gate_verdict must be a valid FlowDeskSurplusUsageDecisionLabelV1");

	if (!Array.isArray(record.reason_refs) || record.reason_refs.length === 0) errors.push("reason_refs must be a non-empty array");
	else for (const [index, ref] of (record.reason_refs as unknown[]).entries()) errors.push(...validateOpaqueRef(ref, `reason_refs[${index}]`).errors);

	if (!Array.isArray(record.blocked_labels)) errors.push("blocked_labels must be an array");
	else for (const [index, lbl] of (record.blocked_labels as unknown[]).entries()) errors.push(...validateOpaqueRef(lbl, `blocked_labels[${index}]`).errors);

	// Cross-field consistency checks (only when fields are valid enough to check)
	if (errors.length === 0 || errors.filter(e => e.includes("gate_verdict") || e.includes("blocked_labels") || e.includes("surplus_sufficient") || e.includes("alert_level_safe")).length === 0) {
		const verdict = record.gate_verdict as string;
		const blockedLabels = record.blocked_labels as string[];
		const surplusSufficient = record.surplus_sufficient as boolean;
		const alertLevelSafe = record.alert_level_safe as boolean;
		const snapshotAgeSeconds = record.snapshot_age_seconds as number;
		const maxSnapshotAgeSeconds = record.max_snapshot_age_seconds as number;

		if (verdict === "allow" && surplusSufficient !== true) errors.push("gate_verdict 'allow' requires surplus_sufficient to be true");
		if (verdict === "allow" && Array.isArray(blockedLabels) && blockedLabels.length > 0) errors.push("gate_verdict 'allow' must have empty blocked_labels");
		if (verdict !== "allow" && Array.isArray(blockedLabels) && blockedLabels.length === 0) errors.push(`gate_verdict '${verdict}' requires non-empty blocked_labels`);
		// blocked_stale_usage is only invalid if the snapshot is NOT stale
		if (verdict === "blocked_stale_usage" && typeof snapshotAgeSeconds === "number" && typeof maxSnapshotAgeSeconds === "number" && snapshotAgeSeconds <= maxSnapshotAgeSeconds) {
			errors.push("gate_verdict 'blocked_stale_usage' is inconsistent: snapshot_age_seconds <= max_snapshot_age_seconds");
		}
		if (verdict === "blocked_alert_level" && alertLevelSafe === true) errors.push("gate_verdict 'blocked_alert_level' is inconsistent with alert_level_safe=true");
		// surplus_sufficient=true + allow is the happy path; stale-age can block even when surplus is sufficient
		if (surplusSufficient === true && verdict !== "allow") {
			// It's valid to have surplus_sufficient=true but still be blocked_stale_usage (age wins first)
			if (verdict !== "blocked_stale_usage") {
				errors.push(`surplus_sufficient=true requires gate_verdict='allow' (or blocked_stale_usage when age wins)`);
			}
		}
	}

	// Authority flags
	if (record.advisory_only !== true
		|| record.non_authorizing !== true
		|| record.dispatch_authority_enabled !== false
		|| record.approval_authority_enabled !== false
		|| record.provider_authority_enabled !== false
		|| record.runtime_authority_enabled !== false
		|| record.external_write_authority_enabled !== false
		|| record.remote_write_authority_enabled !== false
		|| record.fallback_authority_enabled !== false
		|| record.lane_launch_authority_enabled !== false
		|| record.write_authority_enabled !== false
		|| record.hard_chat_authority_enabled !== false) {
		errors.push("surplus usage gate must remain advisory-only non-authorizing with no dispatch, approval, provider, runtime, external-write, remote-write, fallback, lane-launch, write, or hard-chat authority");
	}

	errors.push(...validateNoForbiddenRawPayloads(record, "surplus_usage_gate").errors);
	return errors.length === 0 ? valid() : invalid(...errors);
}
