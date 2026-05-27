import type { OpaqueId } from "./release1-contracts.js";
import {
	FLOWDESK_PLANNING_AUTHORITY_KEYS_V1,
	invalid,
	isPlanningEvidenceRecord,
	rejectUnknownPlanningProperties,
	requirePlanningKeys,
	type ValidationResult,
	valid,
	validatePlanningAuthorityFalse,
	validatePlanningNoForbiddenPayloads,
	validatePlanningOpaqueId,
	validatePlanningSafeText,
	validatePlanningTimestamp,
} from "./planning-evidence-common.js";

export const FLOWDESK_TASK_GRAPH_SCHEMA_VERSION_V1 = "flowdesk.task_graph.v1" as const;

export interface FlowDeskTaskGraphNodeV1 {
	task_id: OpaqueId;
	title: string;
	summary: string;
}

export interface FlowDeskTaskGraphEdgeV1 {
	from_task_id: OpaqueId;
	to_task_id: OpaqueId;
	relation: "depends_on";
}

export interface FlowDeskTaskGraphV1 {
	schema_version: typeof FLOWDESK_TASK_GRAPH_SCHEMA_VERSION_V1;
	workflow_id: OpaqueId;
	task_graph_id: OpaqueId;
	nodes: FlowDeskTaskGraphNodeV1[];
	edges: FlowDeskTaskGraphEdgeV1[];
	graph_summary: string;
	created_at: string;
	release_gate: "release1_planning_only";
	dispatch_authority_enabled: false;
	provider_call_made: false;
	runtime_execution: false;
	actual_lane_launch: false;
	write_authority_enabled: false;
	redaction_version: "v1";
}

const GRAPH_ALLOWED_KEYS = new Set([
	"schema_version",
	"workflow_id",
	"task_graph_id",
	"nodes",
	"edges",
	"graph_summary",
	"created_at",
	"release_gate",
	...FLOWDESK_PLANNING_AUTHORITY_KEYS_V1,
	"redaction_version",
]);
const NODE_ALLOWED_KEYS = new Set(["task_id", "title", "summary"]);
const EDGE_ALLOWED_KEYS = new Set(["from_task_id", "to_task_id", "relation"]);

function validateNode(value: unknown, label: string): ValidationResult {
	if (!isPlanningEvidenceRecord(value)) return invalid(`${label} must be an object`);
	const errors: string[] = [];
	errors.push(...rejectUnknownPlanningProperties(value, NODE_ALLOWED_KEYS, label));
	errors.push(...requirePlanningKeys(value, ["task_id", "title", "summary"], label));
	errors.push(...validatePlanningOpaqueId(value.task_id, `${label}.task_id`).errors);
	errors.push(...validatePlanningSafeText(value.title, `${label}.title`, 160).errors);
	errors.push(...validatePlanningSafeText(value.summary, `${label}.summary`, 500).errors);
	errors.push(...validatePlanningNoForbiddenPayloads(value, label).errors);
	return errors.length === 0 ? valid() : invalid(...errors);
}

function validateEdge(value: unknown, label: string): ValidationResult {
	if (!isPlanningEvidenceRecord(value)) return invalid(`${label} must be an object`);
	const errors: string[] = [];
	errors.push(...rejectUnknownPlanningProperties(value, EDGE_ALLOWED_KEYS, label));
	errors.push(...requirePlanningKeys(value, ["from_task_id", "to_task_id", "relation"], label));
	errors.push(...validatePlanningOpaqueId(value.from_task_id, `${label}.from_task_id`).errors);
	errors.push(...validatePlanningOpaqueId(value.to_task_id, `${label}.to_task_id`).errors);
	if (value.relation !== "depends_on") errors.push(`${label}.relation must be depends_on`);
	if (value.from_task_id === value.to_task_id) errors.push(`${label} self dependency is not allowed`);
	errors.push(...validatePlanningNoForbiddenPayloads(value, label).errors);
	return errors.length === 0 ? valid() : invalid(...errors);
}

function validateDag(nodes: FlowDeskTaskGraphNodeV1[], edges: FlowDeskTaskGraphEdgeV1[]): string[] {
	const errors: string[] = [];
	const nodeIds = new Set<string>();
	for (const node of nodes) {
		if (nodeIds.has(node.task_id)) errors.push(`duplicate task id: ${node.task_id}`);
		nodeIds.add(node.task_id);
	}
	const outgoing = new Map<string, string[]>();
	for (const edge of edges) {
		if (!nodeIds.has(edge.from_task_id)) errors.push(`missing dependency task id: ${edge.from_task_id}`);
		if (!nodeIds.has(edge.to_task_id)) errors.push(`missing dependent task id: ${edge.to_task_id}`);
		if (edge.from_task_id === edge.to_task_id) errors.push(`self dependency is not allowed: ${edge.from_task_id}`);
		const list = outgoing.get(edge.from_task_id) ?? [];
		list.push(edge.to_task_id);
		outgoing.set(edge.from_task_id, list);
	}
	const visiting = new Set<string>();
	const visited = new Set<string>();
	const visit = (id: string): boolean => {
		if (visiting.has(id)) return true;
		if (visited.has(id)) return false;
		visiting.add(id);
		for (const next of outgoing.get(id) ?? []) if (visit(next)) return true;
		visiting.delete(id);
		visited.add(id);
		return false;
	};
	for (const id of nodeIds) {
		if (visit(id)) {
			errors.push("task graph contains a cycle");
			break;
		}
	}
	return errors;
}

export function validateFlowDeskTaskGraphV1(value: unknown): ValidationResult {
	if (!isPlanningEvidenceRecord(value)) return invalid("task graph must be an object");
	const errors: string[] = [];
	errors.push(...rejectUnknownPlanningProperties(value, GRAPH_ALLOWED_KEYS, "task graph"));
	errors.push(...requirePlanningKeys(value, ["schema_version", "workflow_id", "task_graph_id", "nodes", "edges", "graph_summary", "created_at", "release_gate", ...FLOWDESK_PLANNING_AUTHORITY_KEYS_V1, "redaction_version"], "task graph"));
	if (value.schema_version !== FLOWDESK_TASK_GRAPH_SCHEMA_VERSION_V1) errors.push(`schema_version must be ${FLOWDESK_TASK_GRAPH_SCHEMA_VERSION_V1}`);
	errors.push(...validatePlanningOpaqueId(value.workflow_id, "workflow_id").errors);
	errors.push(...validatePlanningOpaqueId(value.task_graph_id, "task_graph_id").errors);
	if (!Array.isArray(value.nodes)) errors.push("nodes must be an array");
	else {
		if (value.nodes.length === 0 || value.nodes.length > 64) errors.push("nodes must contain 1..64 items");
		errors.push(...value.nodes.flatMap((node, index) => validateNode(node, `nodes[${index}]`).errors));
	}
	if (!Array.isArray(value.edges)) errors.push("edges must be an array");
	else {
		if (value.edges.length > 128) errors.push("edges exceeds 128 items");
		errors.push(...value.edges.flatMap((edge, index) => validateEdge(edge, `edges[${index}]`).errors));
	}
	if (Array.isArray(value.nodes) && Array.isArray(value.edges)) errors.push(...validateDag(value.nodes as FlowDeskTaskGraphNodeV1[], value.edges as FlowDeskTaskGraphEdgeV1[]));
	errors.push(...validatePlanningSafeText(value.graph_summary, "graph_summary", 500).errors);
	errors.push(...validatePlanningTimestamp(value.created_at, "created_at").errors);
	if (value.release_gate !== "release1_planning_only") errors.push("release_gate must be release1_planning_only");
	if (value.redaction_version !== "v1") errors.push("redaction_version must be v1");
	errors.push(...validatePlanningAuthorityFalse(value, "task_graph"));
	errors.push(...validatePlanningNoForbiddenPayloads(value, "task_graph").errors);
	return errors.length === 0 ? valid() : invalid(...errors);
}
