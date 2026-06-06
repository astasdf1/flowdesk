/**
 * MCP connector advisory contract.
 * P7-S13.5 submodule: mcp-advisory
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
} from "./shared.js";

// ─── Types ────────────────────────────────────────────────────────────────────

/**
 * Advisory-only connector kind labels for MCP connectors.
 */
export type FlowDeskMCPConnectorKindV1 = "tool" | "resource" | "prompt" | "unknown";

/**
 * Advisory-only connector state labels for MCP connectors.
 */
export type FlowDeskMCPConnectorStateV1 = "enabled" | "disabled" | "unavailable" | "degraded";

/**
 * Pure advisory contract recording the observed state of an optional MCP connector.
 */
export interface FlowDeskMCPConnectorAdvisoryV1 {
	schema_version: "flowdesk.mcp_connector_advisory.v1";
	advisory_id: string;
	connector_id: string;
	connector_kind: FlowDeskMCPConnectorKindV1;
	connector_state: FlowDeskMCPConnectorStateV1;
	state_reason_refs: string[];
	observed_at: string;
	safe_next_actions: string[];
	advisory_only: true;
	non_authorizing: true;
	connector_execution_authority_enabled: false;
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

export interface FlowDeskMCPConnectorAdvisoryResultV1 {
	ok: boolean;
	errors: string[];
	advisory?: FlowDeskMCPConnectorAdvisoryV1;
}

// ─── Constants ────────────────────────────────────────────────────────────────

const mcpConnectorKinds: readonly string[] = ["tool", "resource", "prompt", "unknown"];
const mcpConnectorStates: readonly string[] = ["enabled", "disabled", "unavailable", "degraded"];

const mcpConnectorAdvisoryAllowedProperties = [
	"schema_version",
	"advisory_id",
	"connector_id",
	"connector_kind",
	"connector_state",
	"state_reason_refs",
	"observed_at",
	"safe_next_actions",
	"advisory_only",
	"non_authorizing",
	"connector_execution_authority_enabled",
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

// ─── Creator ──────────────────────────────────────────────────────────────────

export function createFlowDeskMCPConnectorAdvisoryV1(input: {
	advisoryId: string;
	connectorId: string;
	connectorKind: FlowDeskMCPConnectorKindV1;
	connectorState: FlowDeskMCPConnectorStateV1;
	stateReasonRefs?: string[];
	observedAt: string;
	safeNextActions: string[];
}): FlowDeskMCPConnectorAdvisoryResultV1 {
	const errors: string[] = [];

	errors.push(...validateOpaqueId(input.advisoryId, "advisory_id").errors);
	errors.push(...validateOpaqueId(input.connectorId, "connector_id").errors);
	errors.push(...validateTimestamp(input.observedAt, "observed_at").errors);

	if (typeof input.connectorKind !== "string" || !mcpConnectorKinds.includes(input.connectorKind)) {
		errors.push("connector_kind must be 'tool', 'resource', 'prompt', or 'unknown'");
	}

	if (typeof input.connectorState !== "string" || !mcpConnectorStates.includes(input.connectorState)) {
		errors.push("connector_state must be 'enabled', 'disabled', 'unavailable', or 'degraded'");
	}

	const stateReasonRefs = input.stateReasonRefs ?? [];
	if (!Array.isArray(stateReasonRefs) || stateReasonRefs.length > 5) {
		errors.push("state_reason_refs must be a bounded array (0..5 entries)");
	} else {
		for (const [index, ref] of stateReasonRefs.entries()) {
			errors.push(...validateOpaqueRef(ref, `state_reason_refs[${index}]`).errors);
		}
	}

	if (!Array.isArray(input.safeNextActions) || input.safeNextActions.length === 0 || input.safeNextActions.length > 8) {
		errors.push("safe_next_actions must be a non-empty bounded array (1..8 entries)");
	} else {
		for (const [index, action] of input.safeNextActions.entries()) {
			errors.push(...validateOpaqueRef(action, `safe_next_actions[${index}]`).errors);
		}
	}

	if (errors.length > 0) return { ok: false, errors };

	const advisory: FlowDeskMCPConnectorAdvisoryV1 = {
		schema_version: "flowdesk.mcp_connector_advisory.v1",
		advisory_id: input.advisoryId,
		connector_id: input.connectorId,
		connector_kind: input.connectorKind,
		connector_state: input.connectorState,
		state_reason_refs: [...stateReasonRefs],
		observed_at: input.observedAt,
		safe_next_actions: [...input.safeNextActions],
		advisory_only: true,
		non_authorizing: true,
		connector_execution_authority_enabled: false,
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
	return { ok: true, errors: [], advisory };
}

// ─── Validator ────────────────────────────────────────────────────────────────

export function validateFlowDeskMCPConnectorAdvisoryV1(value: unknown): ValidationResult {
	if (!isRecord(value)) return invalid("MCP connector advisory must be an object");
	const record = value as Record<string, unknown>;
	const errors: string[] = [];

	errors.push(...rejectUnknownProperties(record, mcpConnectorAdvisoryAllowedProperties, "MCP connector advisory").errors);

	if (record.schema_version !== "flowdesk.mcp_connector_advisory.v1") {
		errors.push("MCP connector advisory schema_version is invalid");
	}

	errors.push(...validateOpaqueId(record.advisory_id, "advisory_id").errors);
	errors.push(...validateOpaqueId(record.connector_id, "connector_id").errors);
	errors.push(...validateTimestamp(record.observed_at, "observed_at").errors);

	if (typeof record.connector_kind !== "string" || !mcpConnectorKinds.includes(record.connector_kind)) {
		errors.push("connector_kind must be 'tool', 'resource', 'prompt', or 'unknown'");
	}

	if (typeof record.connector_state !== "string" || !mcpConnectorStates.includes(record.connector_state)) {
		errors.push("connector_state must be 'enabled', 'disabled', 'unavailable', or 'degraded'");
	}

	if (!Array.isArray(record.state_reason_refs) || (record.state_reason_refs as unknown[]).length > 5) {
		errors.push("state_reason_refs must be a bounded array (0..5 entries)");
	} else {
		for (const [index, ref] of (record.state_reason_refs as unknown[]).entries()) {
			errors.push(...validateOpaqueRef(ref, `state_reason_refs[${index}]`).errors);
		}
	}

	if (!Array.isArray(record.safe_next_actions) || record.safe_next_actions.length === 0 || record.safe_next_actions.length > 8) {
		errors.push("safe_next_actions must be a non-empty bounded array (1..8 entries)");
	} else {
		for (const [index, action] of record.safe_next_actions.entries()) {
			errors.push(...validateOpaqueRef(action, `safe_next_actions[${index}]`).errors);
		}
	}

	if (record.advisory_only !== true
		|| record.non_authorizing !== true
		|| record.connector_execution_authority_enabled !== false
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
		errors.push("MCP connector advisory must remain advisory-only non-authorizing with no connector-execution, dispatch, approval, provider, runtime, external-write, remote-write, fallback, lane-launch, write, or hard-chat authority");
	}

	// Exclude bounded enum fields (connector_kind, connector_state) from raw payload scan
	const { connector_kind: _ck, connector_state: _cs, ...recordForRawScan } = record;
	errors.push(...validateNoForbiddenRawPayloads(recordForRawScan, "mcp_connector_advisory").errors);
	return errors.length === 0 ? valid() : invalid(...errors);
}
