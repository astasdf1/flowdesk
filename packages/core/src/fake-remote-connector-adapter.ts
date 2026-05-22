import type { FlowDeskProductionApprovalSourceV1 } from "./production-approval-source.js";
import {
	evaluateFlowDeskRemoteWriteConnectorExecutionReadinessV1,
	type FlowDeskRemoteWriteConnectorCapabilityV1,
	type FlowDeskRemoteWriteConnectorKindV1,
	type FlowDeskRemoteWritePlanV1,
} from "./remote-write-connector-gate.js";
import {
	invalid,
	type ValidationResult,
	valid,
	validateNoForbiddenRawPayloads,
	validateOpaqueId,
	validateOpaqueRef,
} from "./validators.js";

export interface FlowDeskFakeRemoteConnectorWriteResultV1 extends ValidationResult {
	schema_version: "flowdesk.fake_remote_connector_write_result.v1";
	workflow_id?: string;
	attempt_id?: string;
	connector_kind?: FlowDeskRemoteWriteConnectorKindV1;
	connector_ref?: string;
	target_ref?: string;
	content_hash_ref?: string;
	redacted_remote_ref?: string;
	state: "fake_write_recorded" | "blocked";
	blocked_labels: string[];
	fake_remote_write_attempted: boolean;
	remote_write_attempted: false;
	connector_write_attempted: false;
	github_write_attempted: false;
	storage_write_attempted: false;
	database_write_attempted: false;
	url_write_attempted: false;
	raw_path_write_attempted: false;
	remote_write_authority_enabled: false;
	external_write_authority_enabled: false;
	dispatch_authority_enabled: false;
	providerCall: false;
	actualLaneLaunch: false;
	runtimeExecution: false;
}

const disabledFakeRemoteConnectorAuthority = {
	remote_write_attempted: false as const,
	connector_write_attempted: false as const,
	github_write_attempted: false as const,
	storage_write_attempted: false as const,
	database_write_attempted: false as const,
	url_write_attempted: false as const,
	raw_path_write_attempted: false as const,
	remote_write_authority_enabled: false as const,
	external_write_authority_enabled: false as const,
	dispatch_authority_enabled: false as const,
	providerCall: false as const,
	actualLaneLaunch: false as const,
	runtimeExecution: false as const,
};

function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === "object" && value !== null && !Array.isArray(value);
}

function rejectUnknownProperties(
	value: Record<string, unknown>,
	allowed: readonly string[],
	label: string,
): ValidationResult {
	const unknown = Object.keys(value).filter((key) => !allowed.includes(key));
	return unknown.length === 0
		? valid()
		: invalid(`${label} unknown properties: ${unknown.join(",")}`);
}

function validateRedactedFakeRemoteRef(value: unknown): ValidationResult {
	const ref = validateOpaqueRef(value, "redacted_remote_ref");
	if (!ref.ok) return ref;
	if (typeof value !== "string" || !value.startsWith("fake-remote-"))
		return invalid("redacted_remote_ref must be a fake remote opaque ref");
	return validateNoForbiddenRawPayloads(value, "redacted_remote_ref");
}

export function prepareFlowDeskFakeRemoteConnectorWriteV1(input: {
	capability: FlowDeskRemoteWriteConnectorCapabilityV1;
	writePlan: FlowDeskRemoteWritePlanV1;
	consumedApproval: FlowDeskProductionApprovalSourceV1;
	redactedRemoteRef: string;
}): FlowDeskFakeRemoteConnectorWriteResultV1 {
	const readiness = evaluateFlowDeskRemoteWriteConnectorExecutionReadinessV1({
		capability: input.capability,
		writePlan: input.writePlan,
		consumedApproval: input.consumedApproval,
	});
	const remoteRefResult = validateRedactedFakeRemoteRef(input.redactedRemoteRef);
	const errors = [...readiness.errors, ...remoteRefResult.errors];
	const blockedLabels = [...readiness.blocked_labels];
	if (!remoteRefResult.ok) blockedLabels.push("redacted_remote_ref_invalid");
	if (readiness.state !== "ready" || errors.length > 0) {
		return {
			schema_version: "flowdesk.fake_remote_connector_write_result.v1",
			workflow_id: input.writePlan.workflow_id,
			attempt_id: input.writePlan.attempt_id,
			connector_kind: input.writePlan.connector_kind,
			connector_ref: input.writePlan.connector_ref,
			target_ref: input.writePlan.target_ref,
			content_hash_ref: input.writePlan.content_hash_ref,
			ok: errors.length === 0,
			errors,
			state: "blocked",
			blocked_labels: [...new Set(blockedLabels.length === 0 ? ["readiness_blocked"] : blockedLabels)],
			fake_remote_write_attempted: false,
			...disabledFakeRemoteConnectorAuthority,
		};
	}
	return {
		schema_version: "flowdesk.fake_remote_connector_write_result.v1",
		workflow_id: input.writePlan.workflow_id,
		attempt_id: input.writePlan.attempt_id,
		connector_kind: input.writePlan.connector_kind,
		connector_ref: input.writePlan.connector_ref,
		target_ref: input.writePlan.target_ref,
		content_hash_ref: input.writePlan.content_hash_ref,
		redacted_remote_ref: input.redactedRemoteRef,
		ok: true,
		errors: [],
		state: "fake_write_recorded",
		blocked_labels: [],
		fake_remote_write_attempted: true,
		...disabledFakeRemoteConnectorAuthority,
	};
}

export function validateFlowDeskFakeRemoteConnectorWriteResultV1(value: unknown): ValidationResult {
	if (!isRecord(value)) return invalid("fake remote connector write result must be an object");
	const record = value as Partial<FlowDeskFakeRemoteConnectorWriteResultV1>;
	const errors: string[] = [];
	const allowed = [
		"schema_version",
		"workflow_id",
		"attempt_id",
		"connector_kind",
		"connector_ref",
		"target_ref",
		"content_hash_ref",
		"redacted_remote_ref",
		"ok",
		"errors",
		"state",
		"blocked_labels",
		"fake_remote_write_attempted",
		"remote_write_attempted",
		"connector_write_attempted",
		"github_write_attempted",
		"storage_write_attempted",
		"database_write_attempted",
		"url_write_attempted",
		"raw_path_write_attempted",
		"remote_write_authority_enabled",
		"external_write_authority_enabled",
		"dispatch_authority_enabled",
		"providerCall",
		"actualLaneLaunch",
		"runtimeExecution",
	] as const;
	errors.push(...rejectUnknownProperties(record, allowed, "fake remote connector write result").errors);
	if (record.schema_version !== "flowdesk.fake_remote_connector_write_result.v1")
		errors.push("fake remote connector write result schema_version is invalid");
	for (const [valueToCheck, label] of [
		[record.workflow_id, "workflow_id"],
		[record.attempt_id, "attempt_id"],
	] as const)
		if (valueToCheck !== undefined) errors.push(...validateOpaqueId(valueToCheck, label).errors);
	for (const [valueToCheck, label] of [
		[record.connector_ref, "connector_ref"],
		[record.target_ref, "target_ref"],
		[record.content_hash_ref, "content_hash_ref"],
	] as const)
		if (valueToCheck !== undefined) errors.push(...validateOpaqueRef(valueToCheck, label).errors);
	if (record.redacted_remote_ref !== undefined)
		errors.push(...validateRedactedFakeRemoteRef(record.redacted_remote_ref).errors);
	if (record.state !== "fake_write_recorded" && record.state !== "blocked")
		errors.push("fake remote connector write result state is invalid");
	if (typeof record.ok !== "boolean") errors.push("fake remote connector write result ok must be boolean");
	if (!Array.isArray(record.errors)) errors.push("fake remote connector write result errors must be an array");
	if (!Array.isArray(record.blocked_labels)) errors.push("blocked_labels must be an array");
	if (typeof record.fake_remote_write_attempted !== "boolean")
		errors.push("fake_remote_write_attempted must be boolean");
	if (record.state === "fake_write_recorded" && record.fake_remote_write_attempted !== true)
		errors.push("fake_write_recorded requires fake_remote_write_attempted=true");
	if (record.state === "blocked" && record.fake_remote_write_attempted !== false)
		errors.push("blocked fake remote connector results cannot attempt fake writes");
	if (
		record.remote_write_attempted !== false ||
		record.connector_write_attempted !== false ||
		record.github_write_attempted !== false ||
		record.storage_write_attempted !== false ||
		record.database_write_attempted !== false ||
		record.url_write_attempted !== false ||
		record.raw_path_write_attempted !== false ||
		record.remote_write_authority_enabled !== false ||
		record.external_write_authority_enabled !== false ||
		record.dispatch_authority_enabled !== false ||
		record.providerCall !== false ||
		record.actualLaneLaunch !== false ||
		record.runtimeExecution !== false
	)
		errors.push("fake remote connector write result cannot enable real remote, connector, dispatch, provider, lane, or runtime authority");
	errors.push(...validateNoForbiddenRawPayloads(record, "fake_remote_connector_write_result").errors);
	return errors.length === 0 ? valid() : invalid(...errors);
}
