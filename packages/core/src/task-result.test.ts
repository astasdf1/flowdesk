import assert from "node:assert/strict";
import test from "node:test";
import {
	validateFlowDeskTaskResultV1,
	validateFlowDeskTaskFailedV1,
	validateFlowDeskAgentTaskProgressV1,
	validateFlowDeskAgentTaskInconsistencyV1,
	VALID_TASK_FAILURE_CATEGORIES,
} from "./task-result.js";

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

function taskResult(overrides: Record<string, unknown> = {}) {
	return {
		schema_version: "flowdesk.task_result.v1",
		workflow_id: "workflow-agent-task-abc123",
		lane_id: "lane-task-abc123",
		task_id: "task-abc123",
	agent_ref: "agent-reviewer-claude-opus",
	provider_qualified_model_id: "claude/claude-opus-4-7",
	task_prompt_sha256: "abc123sha256hex0000000000000000000000000000000000000000000000001",
	result_text: "Analysis complete: no issues found",
	result_text_truncated: false,
	result_text_sha256: "def456sha256hex0000000000000000000000000000000000000000000000002",
		created_at: "2026-05-26T10:00:00.000Z",
		dispatch_authority_enabled: false,
		...overrides,
	};
}

function taskFailed(overrides: Record<string, unknown> = {}) {
	return {
		schema_version: "flowdesk.task_failed.v1",
		workflow_id: "workflow-agent-task-abc123",
		lane_id: "lane-task-abc123",
		task_id: "task-abc123",
	agent_ref: "agent-reviewer-claude-opus",
	provider_qualified_model_id: "claude/claude-opus-4-7",
	failure_category: "sdk_create_failed",
		redacted_reason: "session_create_api_unavailable",
		created_at: "2026-05-26T10:00:00.000Z",
		dispatch_authority_enabled: false,
		...overrides,
	};
}

function taskProgress(overrides: Record<string, unknown> = {}) {
	return {
		schema_version: "flowdesk.agent_task_progress.v1",
		workflow_id: "workflow-agent-task-abc123",
		lane_id: "lane-task-abc123",
		task_id: "task-abc123",
		agent_ref: "agent-reviewer-claude-opus",
		provider_qualified_model_id: "claude/claude-opus-4-7",
		progress_seq: 1,
		observed_at: "2026-05-26T10:00:00.000Z",
		phase: "started",
		progress_label: "agent task started",
		progress_ref: "progress-lane-task-abc123-1",
		redaction_version: "v1",
		dispatch_authority_enabled: false,
		...overrides,
	};
}

function taskInconsistency(overrides: Record<string, unknown> = {}) {
	return {
		schema_version: "flowdesk.agent_task_inconsistency.v1",
		workflow_id: "workflow-agent-task-abc123",
		attempt_id: "attempt-agent-task-abc123",
		lane_id: "lane-task-abc123",
		task_id: "task-abc123",
		last_progress_seq: 3,
		last_progress_observed_at: "2026-05-26T10:00:00.000Z",
		inconsistency_kind: "finalizing_without_terminal",
		grace_window_ms: 90_000,
		grace_source_label: "default_status_live_finalizing_inconsistency_grace",
		observed_at: "2026-05-26T10:02:00.000Z",
		safe_next_actions: [
			"/flowdesk-status",
			"/flowdesk-abort",
			"/flowdesk-retry",
			"/flowdesk-doctor",
			"/flowdesk-export-debug",
		],
		redaction_version: "v1",
		dispatch_authority_enabled: false,
		...overrides,
	};
}

// ---------------------------------------------------------------------------
// task result validator
// ---------------------------------------------------------------------------

test("task result validator accepts valid record", () => {
	const result = validateFlowDeskTaskResultV1(taskResult());
	assert.equal(result.ok, true, result.errors.join("; "));
	assert.deepEqual(result.errors, []);
});

test("task result validator treats result_text as bounded final output, not metadata", () => {
	const result = validateFlowDeskTaskResultV1(
		taskResult({
			result_text: "Final output mentions prompt, developer message, packages/core/src/example.ts, and /Users/example/project.",
			result_text_truncated: true,
		}),
	);
	assert.equal(result.ok, true, result.errors.join("; "));
});

test("task result validator accepts optional output quality metadata", () => {
	const result = validateFlowDeskTaskResultV1(
		taskResult({
			completion_status: "partial",
			output_kind: "process_notes",
			usable_for_synthesis: true,
			missing_contract: true,
		}),
	);
	assert.equal(result.ok, true, result.errors.join("; "));
});

test("task result validator rejects dispatch_authority_enabled: true", () => {
	const result = validateFlowDeskTaskResultV1(
		taskResult({ dispatch_authority_enabled: true }),
	);
	assert.equal(result.ok, false);
	assert.ok(result.errors.some((e) => /dispatch authority/i.test(e)));
});

test("task result validator rejects wrong schema_version", () => {
	const result = validateFlowDeskTaskResultV1(
		taskResult({ schema_version: "flowdesk.task_failed.v1" }),
	);
	assert.equal(result.ok, false);
	assert.ok(result.errors.some((e) => /schema_version/.test(e)));
});

test("task result validator rejects task_id not starting with task-", () => {
	const result = validateFlowDeskTaskResultV1(
		taskResult({ task_id: "something-else-abc123" }),
	);
	assert.equal(result.ok, false);
	assert.ok(result.errors.some((e) => /task_id/.test(e)));
});

test("task result validator rejects result_text exceeding max length", () => {
	const result = validateFlowDeskTaskResultV1(
		taskResult({ result_text: "x".repeat(32_769) }),
	);
	assert.equal(result.ok, false);
	assert.ok(result.errors.some((e) => /result_text/.test(e)));
});

test("task result validator accepts result_text at exactly max length", () => {
	const result = validateFlowDeskTaskResultV1(
		taskResult({ result_text: "x".repeat(32_768) }),
	);
	assert.equal(result.ok, true, result.errors.join("; "));
});

test("task result validator rejects unknown property", () => {
	const result = validateFlowDeskTaskResultV1(
		taskResult({ unknown_field: "bad" }),
	);
	assert.equal(result.ok, false);
	assert.ok(result.errors.some((e) => /unknown property/.test(e)));
});

// ---------------------------------------------------------------------------
// task failed validator
// ---------------------------------------------------------------------------

test("task failed validator accepts valid record", () => {
	const result = validateFlowDeskTaskFailedV1(taskFailed());
	assert.equal(result.ok, true, result.errors.join("; "));
	assert.deepEqual(result.errors, []);
});

test("task failed validator accepts all failure categories", () => {
	for (const category of VALID_TASK_FAILURE_CATEGORIES) {
		const result = validateFlowDeskTaskFailedV1(
			taskFailed({ failure_category: category }),
		);
		assert.equal(result.ok, true, `${category}: ${result.errors.join("; ")}`);
	}
});

test("task failed validator rejects invalid failure_category", () => {
	const result = validateFlowDeskTaskFailedV1(
		taskFailed({ failure_category: "bad_category" }),
	);
	assert.equal(result.ok, false);
	assert.ok(result.errors.some((e) => /failure_category/.test(e)));
});

test("task failed validator rejects dispatch_authority_enabled: true", () => {
	const result = validateFlowDeskTaskFailedV1(
		taskFailed({ dispatch_authority_enabled: true }),
	);
	assert.equal(result.ok, false);
	assert.ok(result.errors.some((e) => /dispatch authority/i.test(e)));
});

test("task failed validator rejects task_id not starting with task-", () => {
	const result = validateFlowDeskTaskFailedV1(
		taskFailed({ task_id: "notask-abc123" }),
	);
	assert.equal(result.ok, false);
	assert.ok(result.errors.some((e) => /task_id/.test(e)));
});

test("agent task progress validator accepts valid record", () => {
	const result = validateFlowDeskAgentTaskProgressV1(taskProgress());
	assert.equal(result.ok, true, result.errors.join("; "));
});

test("agent task progress validator rejects authority and oversized labels", () => {
	const authority = validateFlowDeskAgentTaskProgressV1(taskProgress({ dispatch_authority_enabled: true }));
	assert.equal(authority.ok, false);
	assert.ok(authority.errors.some((e) => /dispatch authority/i.test(e)));
	const label = validateFlowDeskAgentTaskProgressV1(taskProgress({ progress_label: "x".repeat(121) }));
	assert.equal(label.ok, false);
	assert.ok(label.errors.some((e) => /progress_label/.test(e)));
});

test("agent task inconsistency validator accepts valid redacted record", () => {
	const result = validateFlowDeskAgentTaskInconsistencyV1(taskInconsistency());
	assert.equal(result.ok, true, result.errors.join("; "));
});

test("agent task inconsistency validator rejects authority and raw payload wording", () => {
	const authority = validateFlowDeskAgentTaskInconsistencyV1(
		taskInconsistency({ dispatch_authority_enabled: true }),
	);
	assert.equal(authority.ok, false);
	assert.ok(authority.errors.some((e) => /dispatch authority/i.test(e)));
	const raw = validateFlowDeskAgentTaskInconsistencyV1(
		taskInconsistency({ grace_source_label: "provider payload copied" }),
	);
	assert.equal(raw.ok, false);
});

test("agent task inconsistency validator rejects invalid grace and action", () => {
	const grace = validateFlowDeskAgentTaskInconsistencyV1(
		taskInconsistency({ grace_window_ms: 1_000 }),
	);
	assert.equal(grace.ok, false);
	assert.ok(grace.errors.some((e) => /grace_window_ms/.test(e)));
	const action = validateFlowDeskAgentTaskInconsistencyV1(
		taskInconsistency({ safe_next_actions: ["/flowdesk-status", "/flowdesk-fallback"] }),
	);
	assert.equal(action.ok, false);
	assert.ok(action.errors.some((e) => /safe_next_actions/.test(e)));
});
