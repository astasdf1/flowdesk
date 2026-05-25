import {
	existsSync,
	mkdirSync,
	readFileSync,
	renameSync,
	writeFileSync,
} from "node:fs";
import { dirname, resolve, sep } from "node:path";
import type {
	FlowDeskActiveAttemptLockV1,
	FlowDeskAttemptRecordV1,
	FlowDeskAuditRecordV1,
	FlowDeskCheckpointRecordV1,
	FlowDeskDebugExportManifestV1,
	FlowDeskDebugSectionFileV1,
	FlowDeskLaneRecordV1,
	FlowDeskWorkflowActiveV1,
	FlowDeskWorkflowRecordV1,
} from "./release1-contracts.js";
import {
	activeAttemptLockPath,
	attemptRecordPath,
	checkpointRecordPath,
	FLOWDESK_WORKFLOW_ACTIVE_PATH,
	redactedDebugManifestPath,
	redactedDebugSectionFilePath,
	sessionAuditPath,
	sessionLanesPath,
	validateFlowDeskRelativeStatePath,
	workflowRecordPath,
} from "./state-paths.js";
import {
	invalid,
	type ValidationResult,
	valid,
	validateActiveAttemptLockV1,
	validateAttemptRecordV1,
	validateAuditRecordV1,
	validateCheckpointRecordV1,
	validateDebugExportManifestV1,
	validateFlowDeskDebugSectionFileV1,
	validateLaneRecordV1,
	validateSessionRecordCannotReplaceWorkflowState,
	validateWorkflowActiveV1,
	validateWorkflowRecordV1,
} from "./validators.js";

export type FlowDeskStateAuthority =
	| "authoritative_workflow_state"
	| "redacted_session_support";
export type FlowDeskStateWriteOperation = "write_json" | "append_jsonl";

export interface FlowDeskStateWriteIntent<TRecord = unknown> {
	operation: FlowDeskStateWriteOperation;
	path: string;
	schemaId: string;
	authority: FlowDeskStateAuthority;
	record: TRecord;
	serialization: "json" | "jsonl";
	fsSafety: "validated_relative_flowdesk_path_only";
	atomicity: {
		strategy: "temp_then_rename_intent";
		tempPath: string;
	};
}

export interface FlowDeskStatePrepareResult<TRecord = unknown>
	extends ValidationResult {
	record?: TRecord;
	writeIntent?: FlowDeskStateWriteIntent<TRecord>;
}

export interface FlowDeskStateWritePlanResult extends ValidationResult {
	plan?: FlowDeskStateWritePlan;
}

export interface FlowDeskStateWritePlan {
	intents: FlowDeskStateWriteIntent[];
}

export interface FlowDeskDurableStateApplyResult extends ValidationResult {
	rootDir?: string;
	writtenPaths?: string[];
	realOpenCodeDispatch: false;
	actualLaneLaunch: false;
	providerCall: false;
	runtimeExecution: false;
}

export interface FlowDeskDurableWorkflowStateSnapshotV1 {
	active?: FlowDeskWorkflowActiveV1;
	workflow?: FlowDeskWorkflowRecordV1;
	currentAttempt?: FlowDeskAttemptRecordV1;
	laneRecords: FlowDeskLaneRecordV1[];
}

export interface FlowDeskDurableStateReadResult extends ValidationResult {
	rootDir?: string;
	snapshot?: FlowDeskDurableWorkflowStateSnapshotV1;
	realOpenCodeDispatch: false;
	actualLaneLaunch: false;
	providerCall: false;
	runtimeExecution: false;
}

export interface FlowDeskStateValidationOptions {
	now?: number;
}

const workflowSchemas = new Set([
	"flowdesk.workflow_active.v1",
	"flowdesk.workflow_record.v1",
	"flowdesk.attempt_record.v1",
	"flowdesk.checkpoint_record.v1",
	"flowdesk.active_attempt_lock.v1",
]);

const sessionSchemas = new Set([
	"flowdesk.lane_record.v1",
	"flowdesk.audit_record.v1",
	"flowdesk.debug_export_manifest.v1",
	"flowdesk.debug_section_file.v1",
]);

const disabledDurableStateAuthority = {
	realOpenCodeDispatch: false,
	actualLaneLaunch: false,
	providerCall: false,
	runtimeExecution: false,
} as const;

function cloneRecord<TRecord>(record: TRecord): TRecord {
	return JSON.parse(JSON.stringify(record)) as TRecord;
}

function intentFor<TRecord>(args: {
	operation: FlowDeskStateWriteOperation;
	path: string;
	schemaId: string;
	authority: FlowDeskStateAuthority;
	record: TRecord;
}): FlowDeskStatePrepareResult<TRecord> {
	const pathResult = validateFlowDeskRelativeStatePath(args.path);
	if (!pathResult.ok) return { ok: false, errors: pathResult.errors };
	const tempPath = `${args.path}.tmp-${args.schemaId.replace(/[^A-Za-z0-9_.-]/g, "-")}`;
	const tempPathResult = validateFlowDeskRelativeStatePath(
		tempPath,
		"temp path",
	);
	if (!tempPathResult.ok) return { ok: false, errors: tempPathResult.errors };
	return {
		ok: true,
		errors: [],
		record: cloneRecord(args.record),
		writeIntent: {
			operation: args.operation,
			path: args.path,
			schemaId: args.schemaId,
			authority: args.authority,
			record: cloneRecord(args.record),
			serialization: args.operation === "append_jsonl" ? "jsonl" : "json",
			fsSafety: "validated_relative_flowdesk_path_only",
			atomicity: {
				strategy: "temp_then_rename_intent",
				tempPath,
			},
		},
	};
}

function failedFromThrown(error: unknown): FlowDeskStatePrepareResult {
	return invalid(
		error instanceof Error ? error.message : "state path preparation failed",
	);
}

function validateWriteIntentRecord(
	intent: FlowDeskStateWriteIntent,
	options: FlowDeskStateValidationOptions = {},
): ValidationResult {
	if (
		intent.schemaId !==
		(intent.record as { schema_version?: unknown }).schema_version
	)
		return invalid("intent schemaId must match record schema_version");
	if (
		workflowSchemas.has(intent.schemaId) &&
		intent.authority !== "authoritative_workflow_state"
	)
		return invalid(
			"workflow state schema requires authoritative workflow authority",
		);
	if (
		sessionSchemas.has(intent.schemaId) &&
		intent.authority !== "redacted_session_support"
	)
		return invalid(
			"session schema requires redacted session support authority",
		);

	switch (intent.schemaId) {
		case "flowdesk.workflow_active.v1": {
			const recordResult = validateWorkflowActiveV1(intent.record);
			if (!recordResult.ok) return recordResult;
			if (
				intent.operation !== "write_json" ||
				intent.serialization !== "json" ||
				intent.path !== FLOWDESK_WORKFLOW_ACTIVE_PATH
			)
				return invalid("workflow-active intent target is invalid");
			return valid();
		}
		case "flowdesk.workflow_record.v1": {
			const record = intent.record as FlowDeskWorkflowRecordV1;
			const recordResult = validateWorkflowRecordV1(record);
			if (!recordResult.ok) return recordResult;
			if (
				intent.operation !== "write_json" ||
				intent.serialization !== "json" ||
				intent.path !== workflowRecordPath(record.workflow_id)
			)
				return invalid("workflow-record intent target is invalid");
			return valid();
		}
		case "flowdesk.attempt_record.v1": {
			const record = intent.record as FlowDeskAttemptRecordV1;
			const recordResult = validateAttemptRecordV1(record);
			if (!recordResult.ok) return recordResult;
			if (
				intent.operation !== "write_json" ||
				intent.serialization !== "json" ||
				intent.path !== attemptRecordPath(record.workflow_id, record.attempt_id)
			)
				return invalid("attempt-record intent target is invalid");
			return valid();
		}
		case "flowdesk.checkpoint_record.v1": {
			const record = intent.record as FlowDeskCheckpointRecordV1;
			const recordResult = validateCheckpointRecordV1(record);
			if (!recordResult.ok) return recordResult;
			if (
				intent.operation !== "write_json" ||
				intent.serialization !== "json" ||
				intent.path !==
					checkpointRecordPath(record.workflow_id, record.checkpoint_id)
			)
				return invalid("checkpoint-record intent target is invalid");
			return valid();
		}
		case "flowdesk.active_attempt_lock.v1": {
			const record = intent.record as FlowDeskActiveAttemptLockV1;
			const recordResult = validateActiveAttemptLockV1(record, options.now);
			if (!recordResult.ok) return recordResult;
			if (
				intent.operation !== "write_json" ||
				intent.serialization !== "json" ||
				intent.path !== activeAttemptLockPath(record.workflow_id)
			)
				return invalid("active-attempt-lock intent target is invalid");
			return valid();
		}
		case "flowdesk.lane_record.v1": {
			const recordResult = validateLaneRecordV1(intent.record);
			if (!recordResult.ok) return recordResult;
			if (
				intent.operation !== "append_jsonl" ||
				intent.serialization !== "jsonl" ||
				!intent.path.startsWith(".flowdesk/sessions/") ||
				!intent.path.endsWith("/lanes.jsonl")
			)
				return invalid("lane-record intent target is invalid");
			return validateSessionRecordCannotReplaceWorkflowState(intent.record);
		}
		case "flowdesk.audit_record.v1": {
			const recordResult = validateAuditRecordV1(intent.record);
			if (!recordResult.ok) return recordResult;
			if (
				intent.operation !== "append_jsonl" ||
				intent.serialization !== "jsonl" ||
				!intent.path.startsWith(".flowdesk/sessions/") ||
				!intent.path.endsWith("/audit.jsonl")
			)
				return invalid("audit-record intent target is invalid");
			return validateSessionRecordCannotReplaceWorkflowState(intent.record);
		}
		case "flowdesk.debug_export_manifest.v1": {
			const recordResult = validateDebugExportManifestV1(intent.record);
			if (!recordResult.ok) return recordResult;
			if (
				intent.operation !== "write_json" ||
				intent.serialization !== "json" ||
				!intent.path.startsWith(".flowdesk/sessions/") ||
				!intent.path.endsWith("/redacted-debug/manifest.json")
			)
				return invalid("debug-export-manifest intent target is invalid");
			return validateSessionRecordCannotReplaceWorkflowState(intent.record);
		}
		case "flowdesk.debug_section_file.v1": {
			const recordResult = validateFlowDeskDebugSectionFileV1(intent.record);
			if (!recordResult.ok) return recordResult;
			if (
				intent.operation !== "write_json" ||
				intent.serialization !== "json" ||
				!intent.path.startsWith(".flowdesk/sessions/") ||
				!/\/redacted-debug\/sections\/[a-z][a-z0-9_]*\.json$/.test(intent.path)
			)
				return invalid("debug-section-file intent target is invalid");
			return validateSessionRecordCannotReplaceWorkflowState(intent.record);
		}
		default:
			return invalid(
				"intent schemaId is not a supported persisted state schema",
			);
	}
}

export function validateFlowDeskStateWriteIntent(
	intent: unknown,
	options: FlowDeskStateValidationOptions = {},
): ValidationResult {
	if (typeof intent !== "object" || intent === null || Array.isArray(intent))
		return invalid("intent must be an object");
	const candidate = intent as FlowDeskStateWriteIntent;
	const errors: string[] = [];
	if (
		candidate.operation !== "write_json" &&
		candidate.operation !== "append_jsonl"
	)
		errors.push("intent operation is invalid");
	if (
		candidate.authority !== "authoritative_workflow_state" &&
		candidate.authority !== "redacted_session_support"
	)
		errors.push("intent authority is invalid");
	if (typeof candidate.schemaId !== "string")
		errors.push("intent schemaId is invalid");
	const pathResult = validateFlowDeskRelativeStatePath(
		candidate.path,
		"intent path",
	);
	if (!pathResult.ok) errors.push(...pathResult.errors);
	if (candidate.fsSafety !== "validated_relative_flowdesk_path_only")
		errors.push("intent must be relative-path safe");
	if (candidate.atomicity?.strategy !== "temp_then_rename_intent")
		errors.push("intent must describe temp-then-rename atomicity");
	const tempPathResult = validateFlowDeskRelativeStatePath(
		candidate.atomicity?.tempPath,
		"intent temp path",
	);
	if (!tempPathResult.ok) errors.push(...tempPathResult.errors);
	if (
		typeof candidate.path === "string" &&
		typeof candidate.atomicity?.tempPath === "string" &&
		!candidate.atomicity.tempPath.startsWith(`${candidate.path}.tmp-`)
	)
		errors.push("intent temp path must be derived from target path");
	if (candidate.record === undefined) errors.push("intent record is required");
	if (errors.length > 0) return invalid(...errors);
	return validateWriteIntentRecord(candidate, options);
}

export function prepareWorkflowActiveWriteIntent(
	record: FlowDeskWorkflowActiveV1,
	expected?: { workflowId?: string; attemptId?: string },
): FlowDeskStatePrepareResult<FlowDeskWorkflowActiveV1> {
	const result = validateWorkflowActiveV1(record, expected);
	if (!result.ok) return result;
	return intentFor({
		operation: "write_json",
		path: FLOWDESK_WORKFLOW_ACTIVE_PATH,
		schemaId: record.schema_version,
		authority: "authoritative_workflow_state",
		record,
	});
}

export function prepareWorkflowRecordWriteIntent(
	record: FlowDeskWorkflowRecordV1,
): FlowDeskStatePrepareResult<FlowDeskWorkflowRecordV1> {
	const result = validateWorkflowRecordV1(record);
	if (!result.ok) return result;
	try {
		return intentFor({
			operation: "write_json",
			path: workflowRecordPath(record.workflow_id),
			schemaId: record.schema_version,
			authority: "authoritative_workflow_state",
			record,
		});
	} catch (error) {
		return failedFromThrown(
			error,
		) as FlowDeskStatePrepareResult<FlowDeskWorkflowRecordV1>;
	}
}

export function prepareAttemptRecordWriteIntent(
	record: FlowDeskAttemptRecordV1,
): FlowDeskStatePrepareResult<FlowDeskAttemptRecordV1> {
	const result = validateAttemptRecordV1(record);
	if (!result.ok) return result;
	try {
		return intentFor({
			operation: "write_json",
			path: attemptRecordPath(record.workflow_id, record.attempt_id),
			schemaId: record.schema_version,
			authority: "authoritative_workflow_state",
			record,
		});
	} catch (error) {
		return failedFromThrown(
			error,
		) as FlowDeskStatePrepareResult<FlowDeskAttemptRecordV1>;
	}
}

export function prepareCheckpointRecordWriteIntent(
	record: FlowDeskCheckpointRecordV1,
	options: { source: "durable_workflow_state" | "event_only" },
): FlowDeskStatePrepareResult<FlowDeskCheckpointRecordV1> {
	const result = validateCheckpointRecordV1(record);
	if (!result.ok) return result;
	if (options?.source !== "durable_workflow_state")
		return invalid(
			"authoritative checkpoint writes require durable workflow state source",
		);
	try {
		return intentFor({
			operation: "write_json",
			path: checkpointRecordPath(record.workflow_id, record.checkpoint_id),
			schemaId: record.schema_version,
			authority: "authoritative_workflow_state",
			record,
		});
	} catch (error) {
		return failedFromThrown(
			error,
		) as FlowDeskStatePrepareResult<FlowDeskCheckpointRecordV1>;
	}
}

export function prepareActiveAttemptLockWriteIntent(
	record: FlowDeskActiveAttemptLockV1,
	now = Date.now(),
): FlowDeskStatePrepareResult<FlowDeskActiveAttemptLockV1> {
	const result = validateActiveAttemptLockV1(record, now);
	if (!result.ok) return result;
	try {
		return intentFor({
			operation: "write_json",
			path: activeAttemptLockPath(record.workflow_id),
			schemaId: record.schema_version,
			authority: "authoritative_workflow_state",
			record,
		});
	} catch (error) {
		return failedFromThrown(
			error,
		) as FlowDeskStatePrepareResult<FlowDeskActiveAttemptLockV1>;
	}
}

export function prepareLaneRecordWriteIntent(
	sessionId: string,
	record: FlowDeskLaneRecordV1,
): FlowDeskStatePrepareResult<FlowDeskLaneRecordV1> {
	const result = validateLaneRecordV1(record);
	if (!result.ok) return result;
	const authorityResult =
		validateSessionRecordCannotReplaceWorkflowState(record);
	if (!authorityResult.ok) return authorityResult;
	try {
		return intentFor({
			operation: "append_jsonl",
			path: sessionLanesPath(sessionId),
			schemaId: record.schema_version,
			authority: "redacted_session_support",
			record,
		});
	} catch (error) {
		return failedFromThrown(
			error,
		) as FlowDeskStatePrepareResult<FlowDeskLaneRecordV1>;
	}
}

export function prepareAuditRecordWriteIntent(
	sessionId: string,
	record: FlowDeskAuditRecordV1,
): FlowDeskStatePrepareResult<FlowDeskAuditRecordV1> {
	const result = validateAuditRecordV1(record);
	if (!result.ok) return result;
	const authorityResult =
		validateSessionRecordCannotReplaceWorkflowState(record);
	if (!authorityResult.ok) return authorityResult;
	try {
		return intentFor({
			operation: "append_jsonl",
			path: sessionAuditPath(sessionId),
			schemaId: record.schema_version,
			authority: "redacted_session_support",
			record,
		});
	} catch (error) {
		return failedFromThrown(
			error,
		) as FlowDeskStatePrepareResult<FlowDeskAuditRecordV1>;
	}
}

export function prepareDebugExportManifestWriteIntent(
	sessionId: string,
	record: FlowDeskDebugExportManifestV1,
): FlowDeskStatePrepareResult<FlowDeskDebugExportManifestV1> {
	const result = validateDebugExportManifestV1(record);
	if (!result.ok) return result;
	const authorityResult =
		validateSessionRecordCannotReplaceWorkflowState(record);
	if (!authorityResult.ok) return authorityResult;
	try {
		return intentFor({
			operation: "write_json",
			path: redactedDebugManifestPath(sessionId),
			schemaId: record.schema_version,
			authority: "redacted_session_support",
			record,
		});
	} catch (error) {
		return failedFromThrown(
			error,
		) as FlowDeskStatePrepareResult<FlowDeskDebugExportManifestV1>;
	}
}

export function prepareDebugSectionFileWriteIntent(
	sessionId: string,
	record: FlowDeskDebugSectionFileV1,
): FlowDeskStatePrepareResult<FlowDeskDebugSectionFileV1> {
	const result = validateFlowDeskDebugSectionFileV1(record);
	if (!result.ok) return result;
	const authorityResult =
		validateSessionRecordCannotReplaceWorkflowState(record);
	if (!authorityResult.ok) return authorityResult;
	try {
		return intentFor({
			operation: "write_json",
			path: redactedDebugSectionFilePath(sessionId, record.section),
			schemaId: record.schema_version,
			authority: "redacted_session_support",
			record,
		});
	} catch (error) {
		return failedFromThrown(
			error,
		) as FlowDeskStatePrepareResult<FlowDeskDebugSectionFileV1>;
	}
}

export function createFlowDeskStateWritePlan(
	intents: readonly FlowDeskStateWriteIntent[],
	options: FlowDeskStateValidationOptions = {},
): FlowDeskStateWritePlanResult {
	const errors: string[] = [];
	for (const intent of intents) {
		const intentResult = validateFlowDeskStateWriteIntent(intent, options);
		if (!intentResult.ok) errors.push(...intentResult.errors);
	}
	if (errors.length > 0) return invalid(...errors);
	return { ...valid(), plan: { intents: cloneRecord([...intents]) } };
}

export function applyWriteIntentsToInMemoryState(
	intents: readonly FlowDeskStateWriteIntent[],
	initial?: ReadonlyMap<string, string>,
	options: FlowDeskStateValidationOptions = {},
): Map<string, string> {
	const plan = createFlowDeskStateWritePlan(intents, options);
	if (!plan.ok || plan.plan === undefined)
		throw new Error(plan.errors.join("; "));
	const state = new Map(initial ?? []);
	for (const intent of plan.plan.intents) {
		const serialized = JSON.stringify(intent.record);
		if (intent.operation === "append_jsonl") {
			const current = state.get(intent.path);
			state.set(
				intent.path,
				current === undefined || current.length === 0
					? `${serialized}\n`
					: `${current}${serialized}\n`,
			);
		} else {
			state.set(intent.path, serialized);
		}
	}
	return state;
}

function resolveFlowDeskTarget(
	rootDir: string,
	relativePath: string,
): { root: string; target: string; temp: string } {
	const root = resolve(rootDir);
	const target = resolve(root, relativePath);
	const temp = resolve(root, `${relativePath}.tmp-${Date.now().toString(36)}`);
	const rootPrefix = root.endsWith(sep) ? root : `${root}${sep}`;
	if (target !== root && !target.startsWith(rootPrefix))
		throw new Error("durable state target escapes rootDir");
	if (temp !== root && !temp.startsWith(rootPrefix))
		throw new Error("durable state temp target escapes rootDir");
	return { root, target, temp };
}

function resolveFlowDeskReadTarget(
	rootDir: string,
	relativePath: string,
): { root: string; target: string } {
	const pathResult = validateFlowDeskRelativeStatePath(relativePath);
	if (!pathResult.ok) throw new Error(pathResult.errors.join("; "));
	const root = resolve(rootDir);
	const target = resolve(root, relativePath);
	const rootPrefix = root.endsWith(sep) ? root : `${root}${sep}`;
	if (target !== root && !target.startsWith(rootPrefix))
		throw new Error("durable state target escapes rootDir");
	return { root, target };
}

function readOptionalJson(
	rootDir: string,
	relativePath: string,
):
	| { ok: true; record?: unknown; root: string }
	| { ok: false; errors: string[]; root?: string } {
	try {
		const resolved = resolveFlowDeskReadTarget(rootDir, relativePath);
		if (!existsSync(resolved.target)) return { ok: true, root: resolved.root };
		return {
			ok: true,
			record: JSON.parse(readFileSync(resolved.target, "utf8")),
			root: resolved.root,
		};
	} catch (error) {
		return {
			ok: false,
			errors: [
				error instanceof Error ? error.message : "durable state read failed",
			],
		};
	}
}

function readOptionalJsonl(
	rootDir: string,
	relativePath: string,
):
	| { ok: true; records: unknown[]; root: string }
	| { ok: false; errors: string[]; root?: string } {
	try {
		const resolved = resolveFlowDeskReadTarget(rootDir, relativePath);
		if (!existsSync(resolved.target))
			return { ok: true, records: [], root: resolved.root };
		const records = readFileSync(resolved.target, "utf8")
			.split("\n")
			.map((line) => line.trim())
			.filter((line) => line.length > 0)
			.map((line) => JSON.parse(line));
		return { ok: true, records, root: resolved.root };
	} catch (error) {
		return {
			ok: false,
			errors: [
				error instanceof Error ? error.message : "durable state read failed",
			],
		};
	}
}

export function loadFlowDeskDurableWorkflowState(
	rootDir: string,
	options: { workflowId?: string; sessionId?: string; now?: number } = {},
): FlowDeskDurableStateReadResult {
	if (typeof rootDir !== "string" || rootDir.trim().length === 0)
		return {
			...invalid("rootDir is required"),
			...disabledDurableStateAuthority,
		};
	const activeRead = readOptionalJson(rootDir, FLOWDESK_WORKFLOW_ACTIVE_PATH);
	if (!activeRead.ok)
		return {
			...invalid(...activeRead.errors),
			...disabledDurableStateAuthority,
		};
	const root = activeRead.root;
	let active: FlowDeskWorkflowActiveV1 | undefined;
	if (activeRead.record !== undefined) {
		const activeResult = validateWorkflowActiveV1(activeRead.record);
		if (!activeResult.ok)
			return {
				...invalid(...activeResult.errors),
				rootDir: root,
				...disabledDurableStateAuthority,
			};
		active = activeRead.record as FlowDeskWorkflowActiveV1;
	}

	const workflowId = options.workflowId ?? active?.active_workflow_id;
	if (workflowId === undefined)
		return {
			...valid(),
			rootDir: root,
			snapshot: { laneRecords: [] },
			...disabledDurableStateAuthority,
		};
	const workflowRead = readOptionalJson(
		rootDir,
		workflowRecordPath(workflowId),
	);
	if (!workflowRead.ok)
		return {
			...invalid(...workflowRead.errors),
			rootDir: root,
			...disabledDurableStateAuthority,
		};
	let workflow: FlowDeskWorkflowRecordV1 | undefined;
	if (workflowRead.record !== undefined) {
		const workflowResult = validateWorkflowRecordV1(workflowRead.record);
		if (!workflowResult.ok)
			return {
				...invalid(...workflowResult.errors),
				rootDir: root,
				...disabledDurableStateAuthority,
			};
		workflow = workflowRead.record as FlowDeskWorkflowRecordV1;
	}

	let currentAttempt: FlowDeskAttemptRecordV1 | undefined;
	if (workflow?.current_attempt_id !== undefined) {
		const attemptRead = readOptionalJson(
			rootDir,
			attemptRecordPath(workflow.workflow_id, workflow.current_attempt_id),
		);
		if (!attemptRead.ok)
			return {
				...invalid(...attemptRead.errors),
				rootDir: root,
				...disabledDurableStateAuthority,
			};
		if (attemptRead.record !== undefined) {
			const attemptResult = validateAttemptRecordV1(attemptRead.record);
			if (!attemptResult.ok)
				return {
					...invalid(...attemptResult.errors),
					rootDir: root,
					...disabledDurableStateAuthority,
				};
			currentAttempt = attemptRead.record as FlowDeskAttemptRecordV1;
		}
	}

	const laneRead = readOptionalJsonl(
		rootDir,
		sessionLanesPath(options.sessionId ?? "session-local"),
	);
	if (!laneRead.ok)
		return {
			...invalid(...laneRead.errors),
			rootDir: root,
			...disabledDurableStateAuthority,
		};
	const laneRecords: FlowDeskLaneRecordV1[] = [];
	for (const record of laneRead.records) {
		const laneResult = validateLaneRecordV1(record);
		if (!laneResult.ok)
			return {
				...invalid(...laneResult.errors),
				rootDir: root,
				...disabledDurableStateAuthority,
			};
		const lane = record as FlowDeskLaneRecordV1;
		if (lane.workflow_id === workflowId) laneRecords.push(lane);
	}

	return {
		...valid(),
		rootDir: root,
		snapshot: {
			...(active?.active_workflow_id === workflowId ? { active } : {}),
			...(workflow === undefined ? {} : { workflow }),
			...(currentAttempt === undefined ? {} : { currentAttempt }),
			laneRecords,
		},
		...disabledDurableStateAuthority,
	};
}

export function applyWriteIntentsToDurableState(
	rootDir: string,
	intents: readonly FlowDeskStateWriteIntent[],
	options: FlowDeskStateValidationOptions = {},
): FlowDeskDurableStateApplyResult {
	if (typeof rootDir !== "string" || rootDir.trim().length === 0)
		return {
			...invalid("rootDir is required"),
			...disabledDurableStateAuthority,
		};
	const plan = createFlowDeskStateWritePlan(intents, options);
	if (!plan.ok || plan.plan === undefined)
		return { ...invalid(...plan.errors), ...disabledDurableStateAuthority };
	const writtenPaths: string[] = [];
	try {
		const root = resolve(rootDir);
		for (const intent of plan.plan.intents) {
			const resolved = resolveFlowDeskTarget(root, intent.path);
			mkdirSync(dirname(resolved.target), { recursive: true });
			const serialized = JSON.stringify(intent.record);
			const content =
				intent.operation === "append_jsonl" && existsSync(resolved.target)
					? `${readFileSync(resolved.target, "utf8")}${serialized}\n`
					: `${serialized}${intent.operation === "append_jsonl" ? "\n" : ""}`;
			writeFileSync(resolved.temp, content, "utf8");
			renameSync(resolved.temp, resolved.target);
			writtenPaths.push(intent.path);
		}
		return {
			...valid(),
			rootDir: root,
			writtenPaths,
			...disabledDurableStateAuthority,
		};
	} catch (error) {
		return {
			...invalid(
				error instanceof Error ? error.message : "durable state write failed",
			),
			writtenPaths,
			...disabledDurableStateAuthority,
		};
	}
}
