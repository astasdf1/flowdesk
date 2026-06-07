/**
 * Block hierarchy contracts.
 * Operational intelligence later gate – advisory-only, non-authorizing.
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
} from "./shared.js";

// ─── Hierarchy node ────────────────────────────────────────────────────────────

export type FlowDeskHierarchyNodeStatusV1 = "pending" | "processing" | "complete" | "aborted";

export interface FlowDeskHierarchyNodeV1 {
	block_id: string;
	parent_block_id?: string;
	depth: number;               // 0-2
	node_status: FlowDeskHierarchyNodeStatusV1;
	decomposition_ref?: string;
	scoring_ref?: string;
}

// ─── CONTRACT: FlowDeskBlockHierarchyV1 ──────────────────────────────────────

export type FlowDeskBlockHierarchyStatusV1 = "pending" | "processing" | "complete" | "aborted";

export interface FlowDeskBlockHierarchyV1 {
	schema_version: "flowdesk.block_hierarchy.v1";
	hierarchy_id: string;
	root_block_id: string;
	workflow_id: string;
	revision_id: number;                   // monotonic int, starts 1
	previous_revision_ref?: string;
	nodes: FlowDeskHierarchyNodeV1[];       // 1..40
	total_nodes: number;
	node_count_warning?: "soft_warning_25_nodes";
	max_depth: number;                      // 1-2
	allow_deep_decomposition?: true;
	status: FlowDeskBlockHierarchyStatusV1;
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

const NODE_ALLOWED = [
	"block_id", "parent_block_id", "depth", "node_status",
	"decomposition_ref", "scoring_ref",
] as const;

const HIERARCHY_ALLOWED = [
	"schema_version", "hierarchy_id", "root_block_id", "workflow_id",
	"revision_id", "previous_revision_ref", "nodes",
	"total_nodes", "node_count_warning", "max_depth", "allow_deep_decomposition",
	"status",
	"advisory_only", "non_authorizing", "release_gate",
	"dispatch_authority_enabled", "approval_authority_enabled",
	"provider_authority_enabled", "runtime_authority_enabled",
	"external_write_authority_enabled", "remote_write_authority_enabled",
	"fallback_authority_enabled", "lane_launch_authority_enabled",
	"write_authority_enabled", "hard_chat_authority_enabled",
	"model_selection_authority_enabled", "ranking_authority_enabled",
] as const;

const NODE_STATUSES: readonly FlowDeskHierarchyNodeStatusV1[] = ["pending", "processing", "complete", "aborted"];
const HIERARCHY_STATUSES: readonly FlowDeskBlockHierarchyStatusV1[] = ["pending", "processing", "complete", "aborted"];

function validateHierarchyNode(value: unknown, label: string): ValidationResult {
	if (!isRecord(value)) return invalid(`${label} must be an object`);
	const record = value as Record<string, unknown>;
	const errors: string[] = [];
	errors.push(...rejectUnknownProperties(record, NODE_ALLOWED, label).errors);
	errors.push(...validateOpaqueId(record.block_id, `${label}.block_id`).errors);
	if (record.parent_block_id !== undefined)
		errors.push(...validateOpaqueId(record.parent_block_id, `${label}.parent_block_id`).errors);
	if (typeof record.depth !== "number" || !Number.isInteger(record.depth) || record.depth < 0 || record.depth > 2)
		errors.push(`${label}.depth must be an integer 0-2`);
	if (typeof record.node_status !== "string" || !NODE_STATUSES.includes(record.node_status as FlowDeskHierarchyNodeStatusV1))
		errors.push(`${label}.node_status must be one of: ${NODE_STATUSES.join(", ")}`);
	if (record.decomposition_ref !== undefined)
		errors.push(...validateOpaqueRef(record.decomposition_ref, `${label}.decomposition_ref`).errors);
	if (record.scoring_ref !== undefined)
		errors.push(...validateOpaqueRef(record.scoring_ref, `${label}.scoring_ref`).errors);
	return errors.length === 0 ? valid() : invalid(...errors);
}

export function validateFlowDeskBlockHierarchyV1(value: unknown): ValidationResult {
	if (!isRecord(value)) return invalid("block hierarchy must be an object");
	const record = value as Record<string, unknown>;
	const errors: string[] = [];

	errors.push(...rejectUnknownProperties(record, HIERARCHY_ALLOWED, "block hierarchy").errors);
	if (record.schema_version !== "flowdesk.block_hierarchy.v1")
		errors.push("block hierarchy schema_version must be flowdesk.block_hierarchy.v1");
	errors.push(...validateOpaqueId(record.hierarchy_id, "hierarchy_id").errors);
	errors.push(...validateOpaqueId(record.root_block_id, "root_block_id").errors);
	errors.push(...validateOpaqueId(record.workflow_id, "workflow_id").errors);

	if (typeof record.revision_id !== "number" || !Number.isInteger(record.revision_id) || record.revision_id < 1)
		errors.push("revision_id must be an integer >= 1");

	if (record.previous_revision_ref !== undefined)
		errors.push(...validateOpaqueRef(record.previous_revision_ref, "previous_revision_ref").errors);

	// nodes: 1..40
	if (!Array.isArray(record.nodes) || record.nodes.length < 1 || record.nodes.length > 40)
		errors.push("nodes must be an array of 1..40 items");
	else {
		for (const [i, node] of record.nodes.entries())
			errors.push(...validateHierarchyNode(node, `nodes[${i}]`).errors);
	}

	const totalNodes = record.total_nodes;
	if (typeof totalNodes !== "number" || !Number.isInteger(totalNodes) || totalNodes < 0)
		errors.push("total_nodes must be a non-negative integer");

	// REJECT total_nodes > 40
	if (typeof totalNodes === "number" && totalNodes > 40)
		errors.push("total_nodes must not exceed 40");

	// REJECT total_nodes !== nodes.length
	if (Array.isArray(record.nodes) && typeof totalNodes === "number" && totalNodes !== record.nodes.length)
		errors.push("total_nodes must equal nodes.length");

	// node_count_warning
	if (record.node_count_warning !== undefined && record.node_count_warning !== "soft_warning_25_nodes")
		errors.push("node_count_warning must be 'soft_warning_25_nodes' or undefined");

	const maxDepth = record.max_depth;
	if (typeof maxDepth !== "number" || !Number.isInteger(maxDepth) || maxDepth < 1 || maxDepth > 2)
		errors.push("max_depth must be an integer 1-2");

	// REJECT max_depth=2 without allow_deep_decomposition=true
	if (typeof maxDepth === "number" && maxDepth === 2 && record.allow_deep_decomposition !== true)
		errors.push("allow_deep_decomposition must be true when max_depth is 2");

	if (record.allow_deep_decomposition !== undefined && record.allow_deep_decomposition !== true)
		errors.push("allow_deep_decomposition must be true or absent");

	if (typeof record.status !== "string" || !HIERARCHY_STATUSES.includes(record.status as FlowDeskBlockHierarchyStatusV1))
		errors.push(`status must be one of: ${HIERARCHY_STATUSES.join(", ")}`);

	// Authority flags
	if (record.advisory_only !== true) errors.push("advisory_only must be true");
	if (record.non_authorizing !== true) errors.push("non_authorizing must be true");
	if (record.release_gate !== "operational_intelligence_later_gate") errors.push("release_gate must be operational_intelligence_later_gate");
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

	errors.push(...validateNoForbiddenRawPayloads(record, "block hierarchy").errors);

	return errors.length === 0 ? valid() : invalid(...errors);
}

export type FlowDeskBlockHierarchyV1Result = {
	ok: true;
	errors: [];
	hierarchy: FlowDeskBlockHierarchyV1;
} | {
	ok: false;
	errors: string[];
	hierarchy: undefined;
};

export function createFlowDeskBlockHierarchyV1(input: {
	hierarchyId: string;
	rootBlockId: string;
	workflowId: string;
	revisionId: number;
	previousRevisionRef?: string;
	nodes: FlowDeskHierarchyNodeV1[];
	maxDepth: 1 | 2;
	status: FlowDeskBlockHierarchyStatusV1;
}): FlowDeskBlockHierarchyV1Result {
	const errors: string[] = [];

	const totalNodes = input.nodes.length;
	if (totalNodes > 40)
		errors.push("total_nodes must not exceed 40");
	if (totalNodes < 1)
		errors.push("nodes must have at least 1 item");
	if (input.maxDepth === 2) {
		// will set allow_deep_decomposition = true
	}

	if (errors.length > 0) return { ok: false, errors, hierarchy: undefined };

	const hierarchy: FlowDeskBlockHierarchyV1 = {
		schema_version: "flowdesk.block_hierarchy.v1",
		hierarchy_id: input.hierarchyId,
		root_block_id: input.rootBlockId,
		workflow_id: input.workflowId,
		revision_id: input.revisionId,
		...(input.previousRevisionRef !== undefined ? { previous_revision_ref: input.previousRevisionRef } : {}),
		nodes: input.nodes,
		total_nodes: totalNodes,
		...(totalNodes >= 25 ? { node_count_warning: "soft_warning_25_nodes" as const } : {}),
		max_depth: input.maxDepth,
		...(input.maxDepth === 2 ? { allow_deep_decomposition: true as const } : {}),
		status: input.status,
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

	return { ok: true, errors: [], hierarchy };
}
