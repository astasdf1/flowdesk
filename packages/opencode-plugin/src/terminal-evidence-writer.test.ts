import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, test } from "node:test";
import {
	classifyDispatchTerminalState,
	isTerminalEvidencePresent,
	persistTerminalEvidence,
} from "./terminal-evidence-writer.js";

const tempDirs: string[] = [];

function makeTempDir(): string {
	const dir = mkdtempSync(join(tmpdir(), "flowdesk-terminal-evidence-"));
	tempDirs.push(dir);
	return dir;
}

function canonicalEvidencePath(rootDir: string): string {
	return join(
		rootDir,
		".flowdesk",
		"sessions",
		"workflow-a",
		"evidence",
		"terminal-lifecycle",
		"terminal-workflow-a-attempt-a-lane-a.json",
	);
}

function basePersistInput(rootDir: string) {
	return {
		rootDir,
		workflowId: "workflow-a",
		attemptId: "attempt-a",
		laneId: "lane-a",
		taskId: "task-a",
		state: "complete",
		reason: "response_with_result_text",
	};
}

function sha256(content: string): string {
	return createHash("sha256").update(content).digest("hex");
}

afterEach(() => {
	for (const dir of tempDirs.splice(0)) {
		rmSync(dir, { recursive: true, force: true });
	}
});

describe("classifyDispatchTerminalState", () => {
	test("classifies response with non-empty result text as complete", () => {
		assert.deepEqual(
			classifyDispatchTerminalState({
				responseObserved: true,
				resultText: "done",
				errorCategory: undefined,
				timedOut: false,
			}),
			{ state: "complete", reason: "response_with_result_text" },
		);
	});

	test("classifies response without result text as no_output", () => {
		assert.deepEqual(
			classifyDispatchTerminalState({
				responseObserved: true,
				resultText: undefined,
				errorCategory: undefined,
				timedOut: false,
			}),
			{ state: "no_output", reason: "response_without_result_text" },
		);
	});

	test("classifies caught error category as invocation_failed", () => {
		assert.deepEqual(
			classifyDispatchTerminalState({
				responseObserved: false,
				resultText: undefined,
				errorCategory: "sdk_exception",
				timedOut: false,
			}),
			{ state: "invocation_failed", reason: "error_category:sdk_exception" },
		);
	});

	test("classifies caller-signalled timeout as timeout", () => {
		assert.deepEqual(
			classifyDispatchTerminalState({
				responseObserved: true,
				resultText: "late",
				errorCategory: undefined,
				timedOut: true,
			}),
			{ state: "timeout", reason: "caller_signalled_timeout" },
		);
	});
});

describe("persistTerminalEvidence", () => {
	test("writes terminal evidence once at the canonical path", () => {
		const rootDir = makeTempDir();

		const result = persistTerminalEvidence(basePersistInput(rootDir));

		assert.equal(result.written, true);
		assert.equal(result.reason, "written");
		assert.equal(result.evidenceId, "terminal-workflow-a-attempt-a-lane-a");
		assert.equal(typeof result.contentSha256, "string");

		const record = JSON.parse(readFileSync(canonicalEvidencePath(rootDir), "utf8"));
		assert.equal(record.schema_version, "flowdesk.terminal_lifecycle_evidence.v1");
		assert.equal(record.workflow_id, "workflow-a");
		assert.equal(record.attempt_id, "attempt-a");
		assert.equal(record.lane_id, "lane-a");
		assert.equal(record.task_id, "task-a");
		assert.equal(record.state, "complete");
		assert.equal(record.reason, "response_with_result_text");
		assert.equal(record.terminal_sequence, 1);
		assert.equal(record.dispatch_authority_enabled, false);
		assert.match(record.observed_at, /^\d{4}-\d{2}-\d{2}T/);
	});

	test("duplicate same payload returns already_exists_same_payload", () => {
		const rootDir = makeTempDir();
		persistTerminalEvidence(basePersistInput(rootDir));

		const duplicate = persistTerminalEvidence(basePersistInput(rootDir));

		assert.deepEqual(duplicate, {
			written: false,
			reason: "already_exists_same_payload",
			evidenceId: "terminal-workflow-a-attempt-a-lane-a",
			existingState: "complete",
			conflict: false,
			quarantineRecommended: false,
		});
	});

	test("duplicate conflicting terminal evidence returns conflict without overwriting", () => {
		const rootDir = makeTempDir();
		persistTerminalEvidence(basePersistInput(rootDir));

		const duplicate = persistTerminalEvidence({
			...basePersistInput(rootDir),
			state: "timeout",
			reason: "caller_signalled_timeout",
		});

		assert.deepEqual(duplicate, {
			written: false,
			reason: "terminal_evidence_conflict",
			evidenceId: "terminal-workflow-a-attempt-a-lane-a",
			existingState: "complete",
			requestedState: "timeout",
			conflict: true,
			quarantineRecommended: true,
		});
		const record = JSON.parse(readFileSync(canonicalEvidencePath(rootDir), "utf8"));
		assert.equal(record.state, "complete");
		assert.equal(record.reason, "response_with_result_text");
	});

	test("stores a content hash matching the canonical unhashed record", () => {
		const rootDir = makeTempDir();
		const result = persistTerminalEvidence(basePersistInput(rootDir));
		const record = JSON.parse(readFileSync(canonicalEvidencePath(rootDir), "utf8"));
		const { content_sha256: _contentSha256, ...recordWithoutHash } = record;
		const expectedHash = sha256(`${JSON.stringify(recordWithoutHash, null, 2)}\n`);

		assert.equal(record.terminal_sequence, 1);
		assert.equal(record.content_sha256, expectedHash);
		assert.equal(result.contentSha256, expectedHash);
	});
});

describe("isTerminalEvidencePresent", () => {
	test("reports not present before persist and present after persist", () => {
		const rootDir = makeTempDir();
		const input = {
			rootDir,
			workflowId: "workflow-a",
			attemptId: "attempt-a",
			laneId: "lane-a",
		};

		assert.deepEqual(isTerminalEvidencePresent(input), { present: false });
		persistTerminalEvidence(basePersistInput(rootDir));
		assert.deepEqual(isTerminalEvidencePresent(input), {
			present: true,
			evidenceId: "terminal-workflow-a-attempt-a-lane-a",
			state: "complete",
		});
	});
});
