/**
 * Evaluation events and advisory score ledger contracts.
 * P7-S13.5 submodule: evaluation-events
 *
 * Dependency: proposals.ts (one-directional; proposals.ts does NOT import this file)
 */
import {
	type ValidationResult,
	valid,
	invalid,
	validateNoForbiddenRawPayloads,
	validateOpaqueId,
	validateOpaqueRef,
	isRecord,
	refs,
	rejectUnknownProperties,
	validateTimestamp,
	validateAdvisoryAuthorityFlags,
	validateEvaluationAuthorityFlags,
	validateEvaluationOutcomeLabel,
	validateEvaluationScoreDimensions,
	validateHashRef,
	stableStringify,
} from "./shared.js";

import {
	type FlowDeskWorkflowPlanProposalV1,
	type FlowDeskWorkflowPlanProposalScoreEventV1,
	validateFlowDeskWorkflowPlanProposalV1,
	validateFlowDeskWorkflowPlanProposalScoreEventV1,
} from "./proposals.js";

// Re-export the proposal types so barrel can get them all from one place
export type { FlowDeskWorkflowPlanProposalV1, FlowDeskWorkflowPlanProposalScoreEventV1 };

// ─── Types ────────────────────────────────────────────────────────────────────

export type FlowDeskEvaluationOutcomeLabelV1 = "accepted" | "rejected" | "neutral" | "blocked" | "inconclusive";
export type FlowDeskEvaluationScoreDimensionNameV1 = "correctness" | "safety" | "utility" | "cost" | "latency" | "policy_fit" | "redaction_fit";

export interface FlowDeskEvaluationScoreDimensionV1 {
	dimension: FlowDeskEvaluationScoreDimensionNameV1;
	score: number;
	weight: number;
	outcome_label: FlowDeskEvaluationOutcomeLabelV1;
	reason_ref: string;
}

export interface FlowDeskEvaluationEventV1 {
	schema_version: "flowdesk.evaluation_event.v1";
	evaluation_event_id: string;
	workflow_id: string;
	task_ref?: string;
	proposal_ref?: string;
	candidate_ref?: string;
	dedupe_ref: string;
	taxonomy_hash_ref: string;
	policy_hash_ref: string;
	redaction_hash_ref: string;
	scorer_ref: string;
	source_ref: string;
	observed_at: string;
	score_dimensions: FlowDeskEvaluationScoreDimensionV1[];
	overall_outcome_label: FlowDeskEvaluationOutcomeLabelV1;
	evidence_refs: string[];
	safe_next_actions: string[];
	local_only: true;
	append_only: true;
	non_authorizing: true;
	advisory_only: true;
	dispatch_authority_enabled: false;
	approval_authority_enabled: false;
	provider_authority_enabled: false;
	runtime_authority_enabled: false;
	external_write_authority_enabled: false;
	write_authority_enabled: false;
	remote_write_authority_enabled: false;
	fallback_authority_enabled: false;
	lane_launch_authority_enabled: false;
	hard_chat_authority_enabled: false;
}

export interface FlowDeskAdvisoryScoreLedgerEntryV1 {
	schema_version: "flowdesk.advisory_score_ledger_entry.v1";
	ledger_entry_id: string;
	workflow_id: string;
	sequence: number;
	previous_ledger_entry_id?: string;
	recorded_at: string;
	event_kind: "workflow_plan_proposal" | "workflow_plan_proposal_score_event" | "evaluation_event";
	event: FlowDeskWorkflowPlanProposalV1 | FlowDeskWorkflowPlanProposalScoreEventV1 | FlowDeskEvaluationEventV1;
	local_only: true;
	append_only: true;
	non_authorizing: true;
	advisory_only: true;
	dispatch_authority_enabled: false;
	approval_authority_enabled: false;
	provider_authority_enabled: false;
	runtime_authority_enabled: false;
	external_write_authority_enabled: false;
	fallback_authority_enabled: false;
	lane_launch_authority_enabled: false;
}

export interface FlowDeskAdvisoryScoreLedgerAppendIntentV1 {
	schema_version: "flowdesk.advisory_score_ledger_append_intent.v1";
	operation: "append_jsonl";
	serialization: "jsonl";
	ledger_scope: "local_advisory_score_events";
	ledger_entry_id: string;
	workflow_id: string;
	idempotency_key: string;
	append_line: string | null;
	idempotent_replay: boolean;
	expected_previous_ledger_entry_id?: string;
	current_entry_count: number;
	next_sequence: number;
	local_only: true;
	append_only: true;
	non_authorizing: true;
	advisory_only: true;
	dispatch_authority_enabled: false;
	approval_authority_enabled: false;
	provider_authority_enabled: false;
	runtime_authority_enabled: false;
	external_write_authority_enabled: false;
	fallback_authority_enabled: false;
	lane_launch_authority_enabled: false;
}

export interface FlowDeskAdvisoryScoreLedgerLineResultV1 {
	ok: boolean;
	errors: string[];
	line?: string;
}

export interface FlowDeskAdvisoryScoreLedgerDecodeResultV1 {
	ok: boolean;
	errors: string[];
	entry?: FlowDeskAdvisoryScoreLedgerEntryV1;
}

export interface FlowDeskAdvisoryScoreLedgerAppendIntentResultV1 {
	ok: boolean;
	errors: string[];
	intent?: FlowDeskAdvisoryScoreLedgerAppendIntentV1;
}

// ─── Creators ────────────────────────────────────────────────────────────────

export function createFlowDeskEvaluationEventV1(input: {
	evaluationEventId: string;
	workflowId: string;
	taskRef?: string;
	proposalRef?: string;
	candidateRef?: string;
	dedupeRef: string;
	taxonomyHashRef: string;
	policyHashRef: string;
	redactionHashRef: string;
	scorerRef: string;
	sourceRef: string;
	observedAt: string;
	scoreDimensions: FlowDeskEvaluationScoreDimensionV1[];
	overallOutcomeLabel: FlowDeskEvaluationOutcomeLabelV1;
	evidenceRefs: string[];
	safeNextActions: string[];
}): FlowDeskEvaluationEventV1 {
	return {
		schema_version: "flowdesk.evaluation_event.v1",
		evaluation_event_id: input.evaluationEventId,
		workflow_id: input.workflowId,
		...(input.taskRef === undefined ? {} : { task_ref: input.taskRef }),
		...(input.proposalRef === undefined ? {} : { proposal_ref: input.proposalRef }),
		...(input.candidateRef === undefined ? {} : { candidate_ref: input.candidateRef }),
		dedupe_ref: input.dedupeRef,
		taxonomy_hash_ref: input.taxonomyHashRef,
		policy_hash_ref: input.policyHashRef,
		redaction_hash_ref: input.redactionHashRef,
		scorer_ref: input.scorerRef,
		source_ref: input.sourceRef,
		observed_at: input.observedAt,
		score_dimensions: input.scoreDimensions.map((dimension) => ({ ...dimension })),
		overall_outcome_label: input.overallOutcomeLabel,
		evidence_refs: [...input.evidenceRefs],
		safe_next_actions: [...input.safeNextActions],
		local_only: true,
		append_only: true,
		non_authorizing: true,
		advisory_only: true,
		dispatch_authority_enabled: false,
		approval_authority_enabled: false,
		provider_authority_enabled: false,
		runtime_authority_enabled: false,
		external_write_authority_enabled: false,
		write_authority_enabled: false,
		remote_write_authority_enabled: false,
		fallback_authority_enabled: false,
		lane_launch_authority_enabled: false,
		hard_chat_authority_enabled: false,
	};
}

export function createFlowDeskAdvisoryScoreLedgerEntryV1(input: {
	ledgerEntryId: string;
	workflowId: string;
	sequence: number;
	previousLedgerEntryId?: string;
	recordedAt: string;
	event: FlowDeskWorkflowPlanProposalV1 | FlowDeskWorkflowPlanProposalScoreEventV1 | FlowDeskEvaluationEventV1;
}): FlowDeskAdvisoryScoreLedgerEntryV1 {
	const eventKind = input.event.schema_version === "flowdesk.workflow_plan_proposal.v1"
		? "workflow_plan_proposal"
		: input.event.schema_version === "flowdesk.workflow_plan_proposal_score_event.v1"
			? "workflow_plan_proposal_score_event"
			: "evaluation_event";
	return {
		schema_version: "flowdesk.advisory_score_ledger_entry.v1",
		ledger_entry_id: input.ledgerEntryId,
		workflow_id: input.workflowId,
		sequence: input.sequence,
		...(input.previousLedgerEntryId === undefined ? {} : { previous_ledger_entry_id: input.previousLedgerEntryId }),
		recorded_at: input.recordedAt,
		event_kind: eventKind,
		event: input.event,
		local_only: true,
		append_only: true,
		non_authorizing: true,
		advisory_only: true,
		dispatch_authority_enabled: false,
		approval_authority_enabled: false,
		provider_authority_enabled: false,
		runtime_authority_enabled: false,
		external_write_authority_enabled: false,
		fallback_authority_enabled: false,
		lane_launch_authority_enabled: false,
	};
}

// ─── Validators ──────────────────────────────────────────────────────────────

export function validateFlowDeskEvaluationEventV1(value: unknown): ValidationResult {
	if (!isRecord(value)) return invalid("evaluation event must be an object");
	const record = value as Partial<FlowDeskEvaluationEventV1>;
	const errors: string[] = [];
	errors.push(...rejectUnknownProperties(record, [
		"schema_version",
		"evaluation_event_id",
		"workflow_id",
		"task_ref",
		"proposal_ref",
		"candidate_ref",
		"dedupe_ref",
		"taxonomy_hash_ref",
		"policy_hash_ref",
		"redaction_hash_ref",
		"scorer_ref",
		"source_ref",
		"observed_at",
		"score_dimensions",
		"overall_outcome_label",
		"evidence_refs",
		"safe_next_actions",
		"local_only",
		"append_only",
		"non_authorizing",
		"advisory_only",
		"dispatch_authority_enabled",
		"approval_authority_enabled",
		"provider_authority_enabled",
		"runtime_authority_enabled",
		"external_write_authority_enabled",
		"write_authority_enabled",
		"remote_write_authority_enabled",
		"fallback_authority_enabled",
		"lane_launch_authority_enabled",
		"hard_chat_authority_enabled",
	], "evaluation event").errors);
	if (record.schema_version !== "flowdesk.evaluation_event.v1") errors.push("evaluation event schema_version is invalid");
	errors.push(...validateOpaqueId(record.evaluation_event_id, "evaluation_event_id").errors);
	errors.push(...validateOpaqueId(record.workflow_id, "workflow_id").errors);
	if (record.task_ref !== undefined) errors.push(...validateOpaqueRef(record.task_ref, "task_ref").errors);
	if (record.proposal_ref !== undefined) errors.push(...validateOpaqueRef(record.proposal_ref, "proposal_ref").errors);
	if (record.candidate_ref !== undefined) errors.push(...validateOpaqueRef(record.candidate_ref, "candidate_ref").errors);
	if (record.task_ref === undefined && record.proposal_ref === undefined && record.candidate_ref === undefined) errors.push("evaluation event requires at least one task_ref, proposal_ref, or candidate_ref");
	errors.push(...validateOpaqueRef(record.dedupe_ref, "dedupe_ref").errors);
	errors.push(...validateHashRef(record.taxonomy_hash_ref, "taxonomy_hash_ref").errors);
	errors.push(...validateHashRef(record.policy_hash_ref, "policy_hash_ref").errors);
	errors.push(...validateHashRef(record.redaction_hash_ref, "redaction_hash_ref").errors);
	errors.push(...validateOpaqueRef(record.scorer_ref, "scorer_ref").errors);
	errors.push(...validateOpaqueRef(record.source_ref, "source_ref").errors);
	errors.push(...validateTimestamp(record.observed_at, "observed_at").errors);
	errors.push(...validateEvaluationScoreDimensions(record.score_dimensions, "score_dimensions").errors);
	errors.push(...validateEvaluationOutcomeLabel(record.overall_outcome_label, "overall_outcome_label").errors);
	errors.push(...refs(record.evidence_refs, "evidence_refs").errors);
	if (!Array.isArray(record.safe_next_actions) || record.safe_next_actions.length === 0 || record.safe_next_actions.length > 8) errors.push("safe_next_actions must be a non-empty bounded array");
	else for (const [index, action] of record.safe_next_actions.entries()) errors.push(...validateOpaqueRef(action, `safe_next_actions[${index}]`).errors);
	errors.push(...validateEvaluationAuthorityFlags(record, "evaluation event").errors);
	errors.push(...validateNoForbiddenRawPayloads(record, "evaluation_event").errors);
	return errors.length === 0 ? valid() : invalid(...errors);
}

export function validateFlowDeskAdvisoryScoreLedgerEntryV1(value: unknown): ValidationResult {
	if (!isRecord(value)) return invalid("advisory score ledger entry must be an object");
	const record = value as Partial<FlowDeskAdvisoryScoreLedgerEntryV1>;
	const errors: string[] = [];
	errors.push(...rejectUnknownProperties(record, [
		"schema_version",
		"ledger_entry_id",
		"workflow_id",
		"sequence",
		"previous_ledger_entry_id",
		"recorded_at",
		"event_kind",
		"event",
		"local_only",
		"append_only",
		"non_authorizing",
		"advisory_only",
		"dispatch_authority_enabled",
		"approval_authority_enabled",
		"provider_authority_enabled",
		"runtime_authority_enabled",
		"external_write_authority_enabled",
		"fallback_authority_enabled",
		"lane_launch_authority_enabled",
	], "advisory score ledger entry").errors);
	errors.push(...validateOpaqueId(record.ledger_entry_id, "ledger_entry_id").errors);
	errors.push(...validateOpaqueId(record.workflow_id, "workflow_id").errors);
	if (record.previous_ledger_entry_id !== undefined) errors.push(...validateOpaqueId(record.previous_ledger_entry_id, "previous_ledger_entry_id").errors);
	if (record.schema_version !== "flowdesk.advisory_score_ledger_entry.v1") errors.push("advisory score ledger entry schema_version is invalid");
	if (typeof record.sequence !== "number" || !Number.isInteger(record.sequence) || record.sequence < 0) errors.push("advisory score ledger entry sequence must be a non-negative integer");
	if (record.sequence === 0 && record.previous_ledger_entry_id !== undefined) errors.push("first advisory score ledger entry must not carry previous_ledger_entry_id");
	if (typeof record.sequence === "number" && record.sequence > 0 && record.previous_ledger_entry_id === undefined) errors.push("non-initial advisory score ledger entry requires previous_ledger_entry_id");
	errors.push(...validateTimestamp(record.recorded_at, "recorded_at").errors);
	if (record.local_only !== true || record.append_only !== true || record.non_authorizing !== true) errors.push("advisory score ledger entry must remain local-only, append-only, and non-authorizing");
	errors.push(...validateAdvisoryAuthorityFlags(record, "advisory score ledger entry").errors);
	if (record.event_kind === "workflow_plan_proposal") {
		errors.push(...validateFlowDeskWorkflowPlanProposalV1(record.event).errors.map((error) => `event.${error}`));
		if (isRecord(record.event) && record.event.workflow_id !== record.workflow_id) errors.push("advisory score ledger entry workflow_id must match proposal event workflow_id");
	} else if (record.event_kind === "workflow_plan_proposal_score_event") {
		errors.push(...validateFlowDeskWorkflowPlanProposalScoreEventV1(record.event).errors.map((error) => `event.${error}`));
		if (isRecord(record.event) && record.event.workflow_id !== record.workflow_id) errors.push("advisory score ledger entry workflow_id must match score event workflow_id");
	} else if (record.event_kind === "evaluation_event") {
		errors.push(...validateFlowDeskEvaluationEventV1(record.event).errors.map((error) => `event.${error}`));
		if (isRecord(record.event) && record.event.workflow_id !== record.workflow_id) errors.push("advisory score ledger entry workflow_id must match evaluation event workflow_id");
	} else errors.push("advisory score ledger entry event_kind is invalid");
	errors.push(...validateNoForbiddenRawPayloads(record, "advisory_score_ledger_entry").errors);
	return errors.length === 0 ? valid() : invalid(...errors);
}

export function encodeFlowDeskAdvisoryScoreLedgerEntryJsonlLine(entry: FlowDeskAdvisoryScoreLedgerEntryV1): FlowDeskAdvisoryScoreLedgerLineResultV1 {
	const validation = validateFlowDeskAdvisoryScoreLedgerEntryV1(entry);
	if (!validation.ok) return { ok: false, errors: validation.errors };
	const line = stableStringify(entry);
	return line.includes("\n") || line.includes("\r") ? { ok: false, errors: ["advisory score ledger JSONL line must be single-line"] } : { ok: true, errors: [], line };
}

export function decodeFlowDeskAdvisoryScoreLedgerEntryJsonlLine(line: string): FlowDeskAdvisoryScoreLedgerDecodeResultV1 {
	if (typeof line !== "string" || line.length === 0) return { ok: false, errors: ["advisory score ledger JSONL line must be non-empty"] };
	if (line.includes("\n") || line.includes("\r")) return { ok: false, errors: ["advisory score ledger JSONL line must be single-line"] };
	let parsed: unknown;
	try {
		parsed = JSON.parse(line);
	} catch {
		return { ok: false, errors: ["advisory score ledger JSONL line is malformed JSON"] };
	}
	const validation = validateFlowDeskAdvisoryScoreLedgerEntryV1(parsed);
	return validation.ok ? { ok: true, errors: [], entry: parsed as FlowDeskAdvisoryScoreLedgerEntryV1 } : { ok: false, errors: validation.errors };
}

export function decodeFlowDeskAdvisoryScoreLedgerJsonl(jsonl: string): FlowDeskAdvisoryScoreLedgerDecodeResultV1[] {
	if (jsonl.length === 0) return [];
	return jsonl.split("\n").filter((line, index, lines) => line.length > 0 || index < lines.length - 1).map((line) => decodeFlowDeskAdvisoryScoreLedgerEntryJsonlLine(line));
}

export function createFlowDeskAdvisoryScoreLedgerAppendIntentV1(input: {
	existingJsonl: string;
	entry: FlowDeskAdvisoryScoreLedgerEntryV1;
	idempotencyKey: string;
}): FlowDeskAdvisoryScoreLedgerAppendIntentResultV1 {
	const errors: string[] = [];
	errors.push(...validateOpaqueId(input.idempotencyKey, "idempotency_key").errors);
	const encoded = encodeFlowDeskAdvisoryScoreLedgerEntryJsonlLine(input.entry);
	if (!encoded.ok || encoded.line === undefined) errors.push(...encoded.errors);
	const decoded = decodeFlowDeskAdvisoryScoreLedgerJsonl(input.existingJsonl);
	const entries: FlowDeskAdvisoryScoreLedgerEntryV1[] = [];
	for (const [index, result] of decoded.entries()) {
		if (!result.ok || result.entry === undefined) errors.push(...result.errors.map((error) => `existingJsonl[${index}]: ${error}`));
		else entries.push(result.entry);
	}
	if (errors.length > 0 || encoded.line === undefined) return { ok: false, errors };
	for (const [index, entry] of entries.entries()) {
		if (entry.sequence !== index) errors.push(`existingJsonl[${index}] sequence must equal append order`);
		if (index === 0 && entry.previous_ledger_entry_id !== undefined) errors.push("existingJsonl[0] must not carry previous_ledger_entry_id");
		if (index > 0 && entry.previous_ledger_entry_id !== entries[index - 1]?.ledger_entry_id) errors.push(`existingJsonl[${index}] previous_ledger_entry_id must match prior entry`);
	}
	const last = entries.at(-1);
	const duplicate = entries.find((entry) => entry.ledger_entry_id === input.entry.ledger_entry_id);
	if (duplicate !== undefined) {
		const duplicateLine = encodeFlowDeskAdvisoryScoreLedgerEntryJsonlLine(duplicate).line;
		if (duplicateLine !== encoded.line) errors.push("advisory score ledger duplicate ledger_entry_id does not match existing entry");
		if (errors.length > 0) return { ok: false, errors };
		return { ok: true, errors: [], intent: {
			schema_version: "flowdesk.advisory_score_ledger_append_intent.v1",
			operation: "append_jsonl",
			serialization: "jsonl",
			ledger_scope: "local_advisory_score_events",
			ledger_entry_id: input.entry.ledger_entry_id,
			workflow_id: input.entry.workflow_id,
			idempotency_key: input.idempotencyKey,
			append_line: null,
			idempotent_replay: true,
			...(input.entry.previous_ledger_entry_id === undefined ? {} : { expected_previous_ledger_entry_id: input.entry.previous_ledger_entry_id }),
			current_entry_count: entries.length,
			next_sequence: entries.length,
			local_only: true,
			append_only: true,
			non_authorizing: true,
			advisory_only: true,
			dispatch_authority_enabled: false,
			approval_authority_enabled: false,
			provider_authority_enabled: false,
			runtime_authority_enabled: false,
			external_write_authority_enabled: false,
			fallback_authority_enabled: false,
			lane_launch_authority_enabled: false,
		} };
	}
	const expectedSequence = entries.length;
	if (input.entry.sequence !== expectedSequence) errors.push("advisory score ledger append sequence must continue current JSONL order");
	if (last === undefined && input.entry.previous_ledger_entry_id !== undefined) errors.push("first advisory score ledger append must not expect a previous entry");
	if (last !== undefined && input.entry.previous_ledger_entry_id !== last.ledger_entry_id) errors.push("advisory score ledger append previous_ledger_entry_id must match current tail");
	if (errors.length > 0) return { ok: false, errors };
	return { ok: true, errors: [], intent: {
		schema_version: "flowdesk.advisory_score_ledger_append_intent.v1",
		operation: "append_jsonl",
		serialization: "jsonl",
		ledger_scope: "local_advisory_score_events",
		ledger_entry_id: input.entry.ledger_entry_id,
		workflow_id: input.entry.workflow_id,
		idempotency_key: input.idempotencyKey,
		append_line: encoded.line,
		idempotent_replay: false,
		...(input.entry.previous_ledger_entry_id === undefined ? {} : { expected_previous_ledger_entry_id: input.entry.previous_ledger_entry_id }),
		current_entry_count: entries.length,
		next_sequence: entries.length + 1,
		local_only: true,
		append_only: true,
		non_authorizing: true,
		advisory_only: true,
		dispatch_authority_enabled: false,
		approval_authority_enabled: false,
		provider_authority_enabled: false,
		runtime_authority_enabled: false,
		external_write_authority_enabled: false,
		fallback_authority_enabled: false,
		lane_launch_authority_enabled: false,
	} };
}
