import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import { join } from "node:path";

/** Terminal lane lifecycle states emitted by the standalone terminal evidence writer. */
export type FlowDeskLaneLifecycleState =
	| "complete"
	| "no_output"
	| "invocation_failed"
	| "timeout";

/** Input used to classify the terminal state of a managed-dispatch lane observation. */
export interface TerminalClassificationInput {
	responseObserved: boolean;
	resultText: string | undefined;
	errorCategory: string | undefined;
	timedOut: boolean;
}

/** Classification result for a terminal managed-dispatch lane observation. */
export interface TerminalClassificationResult {
	state: FlowDeskLaneLifecycleState;
	reason: string;
}

/** Input used to persist write-once terminal lifecycle evidence. */
export interface PersistTerminalEvidenceInput {
	rootDir: string;
	workflowId: string;
	attemptId: string;
	laneId: string;
	taskId: string;
	state: string;
	reason: string;
}

/** Result returned after attempting to persist terminal lifecycle evidence. */
export interface PersistTerminalEvidenceResult {
	written: boolean;
	reason: string;
	evidenceId: string;
	existingState?: string;
	requestedState?: string;
	conflict?: boolean;
	quarantineRecommended?: boolean;
	contentSha256?: string;
}

/** Input used to check for existing terminal lifecycle evidence. */
export interface TerminalEvidencePresentInput {
	rootDir: string;
	workflowId: string;
	attemptId: string;
	laneId: string;
}

/** Result returned when checking for existing terminal lifecycle evidence. */
export interface TerminalEvidencePresentResult {
	present: boolean;
	state?: string;
	evidenceId?: string;
}

/** Persisted terminal lifecycle evidence record. */
export interface TerminalLifecycleEvidenceRecord {
	schema_version: "flowdesk.terminal_lifecycle_evidence.v1";
	workflow_id: string;
	attempt_id: string;
	lane_id: string;
	task_id: string;
	state: string;
	reason: string;
	terminal_sequence: 1;
	observed_at: string;
	content_sha256: string;
	dispatch_authority_enabled: false;
}

const TERMINAL_LIFECYCLE_SCHEMA_VERSION =
	"flowdesk.terminal_lifecycle_evidence.v1";

function terminalEvidenceId(input: {
	workflowId: string;
	attemptId: string;
	laneId: string;
}): string {
	return `terminal-${input.workflowId}-${input.attemptId}-${input.laneId}`;
}

function terminalEvidencePath(input: {
	rootDir: string;
	workflowId: string;
	attemptId: string;
	laneId: string;
}): { evidenceId: string; evidenceDir: string; filePath: string } {
	const evidenceId = terminalEvidenceId(input);
	const evidenceDir = join(
		input.rootDir,
		".flowdesk",
		"sessions",
		input.workflowId,
		"evidence",
		"terminal-lifecycle",
	);
	return {
		evidenceId,
		evidenceDir,
		filePath: join(evidenceDir, `${evidenceId}.json`),
	};
}

function readExistingState(filePath: string): string | undefined {
	try {
		const record = JSON.parse(readFileSync(filePath, "utf8")) as {
			state?: unknown;
		};
		return typeof record.state === "string" ? record.state : undefined;
	} catch {
		return undefined;
	}
}

function readExistingRecord(filePath: string): Record<string, unknown> | undefined {
	try {
		const record = JSON.parse(readFileSync(filePath, "utf8")) as unknown;
		return record !== null && typeof record === "object"
			? (record as Record<string, unknown>)
			: undefined;
	} catch {
		return undefined;
	}
}

function terminalSemanticPayload(input: PersistTerminalEvidenceInput) {
	return {
		workflow_id: input.workflowId,
		attempt_id: input.attemptId,
		lane_id: input.laneId,
		task_id: input.taskId,
		state: input.state,
		reason: input.reason,
		dispatch_authority_enabled: false,
	};
}

function existingTerminalSemanticPayload(record: Record<string, unknown> | undefined) {
	return {
		workflow_id: record?.workflow_id,
		attempt_id: record?.attempt_id,
		lane_id: record?.lane_id,
		task_id: record?.task_id,
		state: record?.state,
		reason: record?.reason,
		dispatch_authority_enabled: record?.dispatch_authority_enabled,
	};
}

function semanticPayloadsMatch(
	existingRecord: Record<string, unknown> | undefined,
	input: PersistTerminalEvidenceInput,
): boolean {
	return (
		JSON.stringify(existingTerminalSemanticPayload(existingRecord)) ===
		JSON.stringify(terminalSemanticPayload(input))
	);
}

function sha256(content: string): string {
	return createHash("sha256").update(content).digest("hex");
}

function stringifyRecord(record: unknown): string {
	return `${JSON.stringify(record, null, 2)}\n`;
}

/**
 * Determines the terminal lifecycle state from a managed-dispatch result observation.
 * Timeout is caller-signalled and takes precedence over response/error inspection.
 */
export function classifyDispatchTerminalState(
	input: TerminalClassificationInput,
): TerminalClassificationResult {
	if (input.timedOut) {
		return { state: "timeout", reason: "caller_signalled_timeout" };
	}
	if (input.errorCategory !== undefined && input.errorCategory.length > 0) {
		return {
			state: "invocation_failed",
			reason: `error_category:${input.errorCategory}`,
		};
	}
	if (!input.responseObserved) {
		return { state: "invocation_failed", reason: "no_response_observed" };
	}
	if (typeof input.resultText === "string" && input.resultText.trim().length > 0) {
		return { state: "complete", reason: "response_with_result_text" };
	}
	return { state: "no_output", reason: "response_without_result_text" };
}

/**
 * Persists terminal lifecycle evidence exactly once for a workflow/attempt/lane tuple.
 * The content hash is computed over the canonical record content before the
 * `content_sha256` field is attached, avoiding caller-supplied hashes or timestamps.
 */
export function persistTerminalEvidence(
	input: PersistTerminalEvidenceInput,
): PersistTerminalEvidenceResult {
	const { evidenceId, evidenceDir, filePath } = terminalEvidencePath(input);
	if (existsSync(filePath)) {
		const existingRecord = readExistingRecord(filePath);
		const existingState =
			typeof existingRecord?.state === "string" ? existingRecord.state : undefined;
		if (semanticPayloadsMatch(existingRecord, input)) {
			return {
				written: false,
				reason: "already_exists_same_payload",
				evidenceId,
				existingState,
				conflict: false,
				quarantineRecommended: false,
			};
		}
		return {
			written: false,
			reason: "terminal_evidence_conflict",
			evidenceId,
			existingState,
			requestedState: input.state,
			conflict: true,
			quarantineRecommended: true,
		};
	}

	const observedAt = new Date().toISOString();
	const recordWithoutHash: Omit<TerminalLifecycleEvidenceRecord, "content_sha256"> = {
		schema_version: TERMINAL_LIFECYCLE_SCHEMA_VERSION,
		workflow_id: input.workflowId,
		attempt_id: input.attemptId,
		lane_id: input.laneId,
		task_id: input.taskId,
		state: input.state,
		reason: input.reason,
		terminal_sequence: 1,
		observed_at: observedAt,
		dispatch_authority_enabled: false,
	};
	const contentSha256 = sha256(stringifyRecord(recordWithoutHash));
	const record: TerminalLifecycleEvidenceRecord = {
		...recordWithoutHash,
		content_sha256: contentSha256,
	};
	const content = stringifyRecord(record);

	mkdirSync(evidenceDir, { recursive: true });
	writeFileSync(`${filePath}.tmp`, content, "utf8");
	renameSync(`${filePath}.tmp`, filePath);

	return {
		written: true,
		reason: "written",
		evidenceId,
		contentSha256,
	};
}

/** Checks whether terminal lifecycle evidence exists for a workflow/attempt/lane tuple. */
export function isTerminalEvidencePresent(
	input: TerminalEvidencePresentInput,
): TerminalEvidencePresentResult {
	const { evidenceId, filePath } = terminalEvidencePath(input);
	if (!existsSync(filePath)) return { present: false };
	return {
		present: true,
		evidenceId,
		state: readExistingState(filePath),
	};
}
