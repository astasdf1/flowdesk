import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { createHash } from "node:crypto";
import {
	applyFlowDeskSessionEvidenceWriteIntentsV1,
	prepareFlowDeskSessionEvidenceWriteIntentV1,
	reloadFlowDeskSessionEvidenceV1,
	projectFlowDeskLaneStallV1,
	type FlowDeskLaneLifecycleRecordV1,
	type FlowDeskReviewerLaneContextV1,
	type FlowDeskAgentTaskContextV1,
	type FlowDeskTaskResultV1,
	type FlowDeskTaskFailedV1,
	type FlowDeskPendingRetryPlanV1,
	type FlowDeskRetryExecutedV1,
	type FlowDeskRetryFailedV1,
} from "@flowdesk/core";
import { createFlowDeskLocalNonDispatchAdapterSession } from "./local-adapter.js";
import { validateAndAbortFlowDeskLaneEvidenceV1 } from "./stall-recovery.js";
import {
	computeGuardSignOffHmacV1,
	evaluateGuardedAutoAbortHookV1,
	evaluateGuardedAutoRetryHookV1,
	backfillTerminalAgentTaskFailedLanesV1,
	reconcileStalePendingRetryPlansV1,
	isAutoAbortEnabledV1,
	verifyGuardSignOffHmacV1,
	type FlowDeskGuardSignOffV1,
} from "./stall-recovery.js";

function lifecycleRecord(overrides: Partial<FlowDeskLaneLifecycleRecordV1> = {}): FlowDeskLaneLifecycleRecordV1 {
	return {
		schema_version: "flowdesk.lane_lifecycle_record.v1",
		lane_id: "lane-quick-policy-security-123",
		workflow_id: "workflow-quick-reviewer-123",
		attempt_id: "attempt-123",
		parent_session_ref: "ses-parent-123",
		agent_ref: "agent-reviewer-123",
		provider_qualified_model_id: "openai/gpt-5.5",
		state: "running",
		timeout_ms: 300_000,
		orphan_max_age_ms: 600_000,
		retry_count: 0,
		created_at: "2026-05-26T10:00:00.000Z",
		updated_at: "2026-05-26T10:01:00.000Z",
		spawned_by: "flowdesk",
		durability: "best_effort_no_dir_fsync",
		dispatch_authority_enabled: false,
		providerCall: false,
		actualLaneLaunch: false,
		runtimeExecution: false,
		...overrides,
	};
}

function writeLifecycle(rootDir: string, record: FlowDeskLaneLifecycleRecordV1, evidenceId = "lifecycle-running-123") {
	const prepared = prepareFlowDeskSessionEvidenceWriteIntentV1({
		workflowId: record.workflow_id,
		evidenceId,
		record,
	});
	assert.equal(prepared.ok, true, prepared.errors.join("\n"));
	assert.ok(prepared.writeIntent);
	const applied = applyFlowDeskSessionEvidenceWriteIntentsV1(rootDir, [prepared.writeIntent]);
	assert.equal(applied.ok, true, applied.errors.join("\n"));
}

const guardKey = "test-guard-hmac-key-32-bytes-minimum";
const guardMarkdown = "# SDK surface verification\n\nP6 safe for evidence-only abort.\n";

function signedGuardSignOff(overrides: Partial<FlowDeskGuardSignOffV1> = {}): FlowDeskGuardSignOffV1 {
	const unsigned = {
		schema_version: "flowdesk.guard_sign_off.v1" as const,
		sign_off_id: "guard-signoff-p6-123",
		created_at: "2026-05-26T10:00:00.000Z",
		target_markdown_sha256: createHash("sha256").update(guardMarkdown, "utf8").digest("hex"),
		p6_safe: true,
		nonce: "nonce-p6-123",
		expires_at: "2026-05-27T10:00:00.000Z",
		dispatch_authority_enabled: false as const,
		...Object.fromEntries(Object.entries(overrides).filter(([key]) => key !== "hmac_sha256")),
	};
	return {
		...unsigned,
		hmac_sha256: computeGuardSignOffHmacV1({ unsignedSignOff: unsigned, hmacKey: guardKey }),
		...(overrides.hmac_sha256 === undefined ? {} : { hmac_sha256: overrides.hmac_sha256 }),
	};
}

test("stall recovery helper records abort lifecycle evidence for FlowDesk-owned lane", () => {
	const rootDir = mkdtempSync(join(tmpdir(), "flowdesk-stall-abort-"));
	writeLifecycle(rootDir, lifecycleRecord());

	const result = validateAndAbortFlowDeskLaneEvidenceV1({
		rootDir,
		workflow_id: "workflow-quick-reviewer-123",
		lane_id: "lane-quick-policy-security-123",
		now: () => new Date("2026-05-26T10:05:00.000Z"),
	});

	assert.equal(result.status, "aborted");
	assert.equal(result.lane_id, "lane-quick-policy-security-123");
	const reload = reloadFlowDeskSessionEvidenceV1({ rootDir, workflowId: "workflow-quick-reviewer-123" });
	assert.equal(reload.ok, true);
	assert.equal(
		reload.entries.some(
			(entry) =>
				entry.evidenceClass === "lane_lifecycle" &&
				entry.evidenceId === result.lifecycle_evidence_id &&
				entry.record.state === "aborted",
		),
		true,
	);
});

test("stall recovery helper blocks non-FlowDesk-owned lane abort", () => {
	const rootDir = mkdtempSync(join(tmpdir(), "flowdesk-stall-abort-external-"));
	writeLifecycle(rootDir, lifecycleRecord({ spawned_by: "external" }));

	const result = validateAndAbortFlowDeskLaneEvidenceV1({
		rootDir,
		workflow_id: "workflow-quick-reviewer-123",
		lane_id: "lane-quick-policy-security-123",
	});

	assert.deepEqual(result, { status: "blocked", reason: "not_flowdesk_owned" });
});

test("local adapter /flowdesk-abort lane_id path surfaces observed cancellation without runtime authority", () => {
	const rootDir = mkdtempSync(join(tmpdir(), "flowdesk-local-abort-"));
	writeLifecycle(rootDir, lifecycleRecord());
	const session = createFlowDeskLocalNonDispatchAdapterSession(
		() => new Date("2026-05-26T10:05:00.000Z"),
		undefined,
		{ durableStateRootDir: rootDir },
	);

	const result = session.evaluate("flowdesk_abort", {
		schema_version: "flowdesk.abort.request.v1",
		request_id: "request-abort-lane-123",
		input_mode: "test_fixture",
		workflow_id: "workflow-quick-reviewer-123",
		lane_id: "lane-quick-policy-security-123",
		reason: "user requested lane recovery abort",
	});

	assert.equal(result.handler.ok, true);
	assert.equal(result.handler.responseSchemaValid, true);
	const response = result.handler.response as { cancellation_state?: string };
	assert.equal(response.cancellation_state, "cancel_observed");
	assert.equal(result.hardCancelOrNoReplyAuthority, false);
	assert.equal(result.actualLaneLaunch, false);
	assert.equal(result.providerCall, false);
});

test("local adapter doctor surfaces SDK session health diagnostic refs without abort authority", () => {
	const session = createFlowDeskLocalNonDispatchAdapterSession(
		() => new Date("2026-05-26T10:05:00.000Z"),
		undefined,
		{},
	);

	const result = session.evaluate("flowdesk_doctor", {
		schema_version: "flowdesk.doctor.request.v1",
		request_id: "request-doctor-sdk-health-123",
		input_mode: "test_fixture",
		check_scope: "runtime",
		profile: "test",
		persist_report: false,
	});

	assert.equal(result.handler.ok, true);
	const response = result.handler.response as { doctor_results?: Array<{ refs?: string[] }> };
	const refs = response.doctor_results?.flatMap((section) => section.refs ?? []) ?? [];
	assert.equal(refs.includes("sdk_session_api_health=unknown"), true);
	assert.equal(refs.includes("sdk_session_api_reason=sdk_health_not_checked_non_dispatch_adapter"), true);
	assert.equal(refs.includes("sdk_session_abort_automation=disabled_release1"), true);
	assert.equal(result.hardCancelOrNoReplyAuthority, false);
});

test("guard sign-off HMAC verification fails closed on digest, hmac, expiry, and production env fallback", () => {
	assert.equal(
		verifyGuardSignOffHmacV1({ signOff: signedGuardSignOff(), markdownText: guardMarkdown, hmacKey: guardKey }).ok,
		true,
	);
	assert.deepEqual(
		verifyGuardSignOffHmacV1({ signOff: signedGuardSignOff(), markdownText: "changed", hmacKey: guardKey }),
		{ ok: false, reason: "guard_sign_off_markdown_digest_mismatch" },
	);
	assert.deepEqual(
		verifyGuardSignOffHmacV1({ signOff: signedGuardSignOff({ hmac_sha256: "00" }), markdownText: guardMarkdown, hmacKey: guardKey }),
		{ ok: false, reason: "guard_sign_off_hmac_mismatch" },
	);
	assert.deepEqual(
		verifyGuardSignOffHmacV1({
			signOff: signedGuardSignOff({ expires_at: "2026-05-26T09:59:00.000Z" }),
			markdownText: guardMarkdown,
			hmacKey: guardKey,
			now: new Date("2026-05-26T10:00:00.000Z"),
		}),
		{ ok: false, reason: "guard_sign_off_expired" },
	);
	assert.deepEqual(
		isAutoAbortEnabledV1({
			config: { autoAbortOnStall: true, productionMode: true },
			rootDir: "/tmp/no-read",
			loadedSignOff: { signOff: signedGuardSignOff(), markdownText: guardMarkdown },
			env: { FLOWDESK_GUARD_HMAC_KEY: guardKey },
		}),
		{ enabled: false, reason: "env_guard_hmac_key_rejected_in_production" },
	);
});

test("guarded auto-abort issues warning then executes evidence-only abort after expiry", () => {
	const rootDir = mkdtempSync(join(tmpdir(), "flowdesk-auto-abort-"));
	writeLifecycle(rootDir, lifecycleRecord());
	const loadedSignOff = { signOff: signedGuardSignOff(), markdownText: guardMarkdown };
	const config = { autoAbortOnStall: true, preAbortWarningMs: 10_000, guardHmacKey: guardKey };

	const issued = evaluateGuardedAutoAbortHookV1({
		rootDir,
		workflow_id: "workflow-quick-reviewer-123",
		lane_id: "lane-quick-policy-security-123",
		config,
		stallConfirmed: true,
		sdkSessionHealth: { status: "api_timeout", reason: "messages_api_did_not_respond_within_threshold" },
		now: () => new Date("2026-05-26T10:00:00.000Z"),
		loadedSignOff,
	});
	assert.equal(issued.status, "warning_issued");

	const pending = evaluateGuardedAutoAbortHookV1({
		rootDir,
		workflow_id: "workflow-quick-reviewer-123",
		lane_id: "lane-quick-policy-security-123",
		config,
		stallConfirmed: true,
		sdkSessionHealth: { status: "api_timeout", reason: "messages_api_did_not_respond_within_threshold" },
		now: () => new Date("2026-05-26T10:00:05.000Z"),
		loadedSignOff,
	});
	assert.equal(pending.status, "warning_pending");

	const executed = evaluateGuardedAutoAbortHookV1({
		rootDir,
		workflow_id: "workflow-quick-reviewer-123",
		lane_id: "lane-quick-policy-security-123",
		config,
		stallConfirmed: true,
		sdkSessionHealth: { status: "api_timeout", reason: "messages_api_did_not_respond_within_threshold" },
		now: () => new Date("2026-05-26T10:00:11.000Z"),
		loadedSignOff,
	});
	assert.equal(executed.status, "auto_abort_executed");
	const reload = reloadFlowDeskSessionEvidenceV1({ rootDir, workflowId: "workflow-quick-reviewer-123" });
	assert.equal(reload.ok, true);
	assert.equal(reload.entries.some((entry) => entry.evidenceClass === "lane_lifecycle" && entry.record.state === "aborted"), true);
	assert.equal(reload.entries.some((entry) => entry.evidenceClass === "pending_abort_warning" && entry.record.status === "executed"), true);
});

test("guarded auto-abort stays manual when disabled, responsive, or legacy-owned", () => {
	const rootDir = mkdtempSync(join(tmpdir(), "flowdesk-auto-abort-blocked-"));
	writeLifecycle(rootDir, lifecycleRecord({ spawned_by: undefined }));
	const loadedSignOff = { signOff: signedGuardSignOff(), markdownText: guardMarkdown };
	assert.equal(
		evaluateGuardedAutoAbortHookV1({
			rootDir,
			workflow_id: "workflow-quick-reviewer-123",
			lane_id: "lane-quick-policy-security-123",
			config: { autoAbortOnStall: false, guardHmacKey: guardKey },
			stallConfirmed: true,
			sdkSessionHealth: { status: "api_timeout", reason: "messages_api_did_not_respond_within_threshold" },
			loadedSignOff,
		}).status,
		"manual_recommended",
	);
	assert.equal(
		evaluateGuardedAutoAbortHookV1({
			rootDir,
			workflow_id: "workflow-quick-reviewer-123",
			lane_id: "lane-quick-policy-security-123",
			config: { autoAbortOnStall: true, guardHmacKey: guardKey },
			stallConfirmed: true,
			sdkSessionHealth: { status: "api_responsive" },
			loadedSignOff,
		}).status,
		"manual_recommended",
	);
});

// ---------------------------------------------------------------------------
// P7 Guarded Auto-Retry helpers
// ---------------------------------------------------------------------------

/** Write a guard sign-off sidecar pair into rootDir for the retry hook. */
function writeGuardSignOff(rootDir: string, overrides: Partial<FlowDeskGuardSignOffV1> = {}): void {
	const adrDir = join(rootDir, "docs", "adr");
	mkdirSync(adrDir, { recursive: true });
	const markdownPath = join(adrDir, "0002-sdk-surface-verification.md");
	const jsonPath = join(adrDir, "0002-sdk-surface-verification.guard_sign_off.json");
	writeFileSync(markdownPath, guardMarkdown, "utf8");
	const signOff = signedGuardSignOff(overrides);
	writeFileSync(jsonPath, JSON.stringify(signOff), "utf8");
}

function reviewerLaneContextRecord(overrides: Partial<FlowDeskReviewerLaneContextV1> = {}): FlowDeskReviewerLaneContextV1 {
	return {
		schema_version: "flowdesk.reviewer_lane_context.v1",
		workflow_id: "workflow-quick-reviewer-123",
		lane_id: "lane-quick-policy-security-123",
		lane_plan_ref: "plan-ref-001",
		perspective: "policy_security",
		agent_ref: "agent-reviewer-gpt-frontier",
		provider_qualified_model_id: "openai/gpt-5.5",
		parent_session_ref: "ses-parent-001",
		original_attempt_id: "attempt-001",
		prompt_text: "Review this code for security issues.",
		prompt_text_truncated: false,
		prompt_text_sha256: "abc123sha256hex",
		redaction_version: "v1",
		created_at: "2026-05-26T10:00:00.000Z",
		dispatch_authority_enabled: false,
		...overrides,
	};
}

function writeReviewerLaneContext(rootDir: string, record: FlowDeskReviewerLaneContextV1, evidenceId = "reviewer-lane-context-001"): void {
	const prepared = prepareFlowDeskSessionEvidenceWriteIntentV1({
		workflowId: record.workflow_id,
		evidenceId,
		record: record as unknown as Record<string, unknown>,
	});
	assert.equal(prepared.ok, true, prepared.errors.join("\n"));
	assert.ok(prepared.writeIntent);
	const applied = applyFlowDeskSessionEvidenceWriteIntentsV1(rootDir, [prepared.writeIntent]);
	assert.equal(applied.ok, true, applied.errors.join("\n"));
}

function writeRetryExecutedEvidence(
	rootDir: string,
	record: FlowDeskRetryExecutedV1,
	evidenceId = "retry-executed-001",
): void {
	const prepared = prepareFlowDeskSessionEvidenceWriteIntentV1({
		workflowId: record.workflow_id,
		evidenceId,
		record: record as unknown as Record<string, unknown>,
	});
	assert.equal(prepared.ok, true, prepared.errors.join("\n"));
	assert.ok(prepared.writeIntent);
	const applied = applyFlowDeskSessionEvidenceWriteIntentsV1(rootDir, [prepared.writeIntent]);
	assert.equal(applied.ok, true, applied.errors.join("\n"));
}

function writeRetryFailedEvidence(
	rootDir: string,
	record: FlowDeskRetryFailedV1,
	evidenceId = "retry-failed-001",
): void {
	const prepared = prepareFlowDeskSessionEvidenceWriteIntentV1({
		workflowId: record.workflow_id,
		evidenceId,
		record: record as unknown as Record<string, unknown>,
	});
	assert.equal(prepared.ok, true, prepared.errors.join("\n"));
	assert.ok(prepared.writeIntent);
	const applied = applyFlowDeskSessionEvidenceWriteIntentsV1(rootDir, [prepared.writeIntent]);
	assert.equal(applied.ok, true, applied.errors.join("\n"));
}

function writePendingRetryPlanEvidence(
	rootDir: string,
	record: FlowDeskPendingRetryPlanV1,
	evidenceId = "pending-retry-plan-001",
): void {
	const prepared = prepareFlowDeskSessionEvidenceWriteIntentV1({
		workflowId: record.workflow_id,
		evidenceId,
		record: record as unknown as Record<string, unknown>,
	});
	assert.equal(prepared.ok, true, prepared.errors.join("\n"));
	assert.ok(prepared.writeIntent);
	const applied = applyFlowDeskSessionEvidenceWriteIntentsV1(rootDir, [prepared.writeIntent]);
	assert.equal(applied.ok, true, applied.errors.join("\n"));
}

function agentTaskContextRecord(overrides: Partial<FlowDeskAgentTaskContextV1> = {}): FlowDeskAgentTaskContextV1 {
	return {
		schema_version: "flowdesk.agent_task_context.v1",
		workflow_id: "workflow-agent-task-123",
		lane_id: "lane-agent-task-123",
		task_id: "task-agent-123",
		agent_ref: "agent-general-123",
		provider_qualified_model_id: "openai/gpt-5.5",
		parent_session_ref: "ses-parent-agent-123",
		prompt_text: "Do the generic agent task.",
		prompt_text_truncated: false,
		prompt_text_sha256: "promptsha256",
		redaction_version: "v1",
		created_at: "2026-05-26T10:00:00.000Z",
		dispatch_authority_enabled: false,
		...overrides,
	};
}

function taskFailedRecord(overrides: Partial<FlowDeskTaskFailedV1> = {}): FlowDeskTaskFailedV1 {
	return {
		schema_version: "flowdesk.task_failed.v1",
		workflow_id: "workflow-agent-task-123",
		lane_id: "lane-agent-task-123",
		task_id: "task-agent-123",
		agent_ref: "agent-general-123",
		provider_qualified_model_id: "openai/gpt-5.5",
		failure_category: "no_response",
		redacted_reason: "lane launched but no assistant response text found",
		created_at: "2026-05-26T10:02:00.000Z",
		dispatch_authority_enabled: false,
		...overrides,
	};
}

function taskResultRecord(overrides: Partial<FlowDeskTaskResultV1> = {}): FlowDeskTaskResultV1 {
	return {
		schema_version: "flowdesk.task_result.v1",
		workflow_id: "workflow-agent-task-123",
		lane_id: "lane-agent-task-123",
		task_id: "task-agent-123",
		agent_ref: "agent-general-123",
		provider_qualified_model_id: "openai/gpt-5.5",
		task_prompt_sha256: "promptsha256",
		result_text: "agent task result",
		result_text_truncated: false,
		result_text_sha256: "resultsha256",
		created_at: "2026-05-26T10:02:00.000Z",
		dispatch_authority_enabled: false,
		...overrides,
	};
}

function writeAgentTaskContext(rootDir: string, record: FlowDeskAgentTaskContextV1, evidenceId = "agent-task-context-001"): void {
	const prepared = prepareFlowDeskSessionEvidenceWriteIntentV1({
		workflowId: record.workflow_id,
		evidenceId,
		record: record as unknown as Record<string, unknown>,
	});
	assert.equal(prepared.ok, true, prepared.errors.join("\n"));
	assert.ok(prepared.writeIntent);
	const applied = applyFlowDeskSessionEvidenceWriteIntentsV1(rootDir, [prepared.writeIntent]);
	assert.equal(applied.ok, true, applied.errors.join("\n"));
}

function writeTaskFailed(rootDir: string, record: FlowDeskTaskFailedV1, evidenceId = "task-failed-001"): void {
	const prepared = prepareFlowDeskSessionEvidenceWriteIntentV1({
		workflowId: record.workflow_id,
		evidenceId,
		record: record as unknown as Record<string, unknown>,
	});
	assert.equal(prepared.ok, true, prepared.errors.join("\n"));
	assert.ok(prepared.writeIntent);
	const applied = applyFlowDeskSessionEvidenceWriteIntentsV1(rootDir, [prepared.writeIntent]);
	assert.equal(applied.ok, true, applied.errors.join("\n"));
}

function writeTaskResult(rootDir: string, record: FlowDeskTaskResultV1, evidenceId = "task-result-001"): void {
	const prepared = prepareFlowDeskSessionEvidenceWriteIntentV1({
		workflowId: record.workflow_id,
		evidenceId,
		record: record as unknown as Record<string, unknown>,
	});
	assert.equal(prepared.ok, true, prepared.errors.join("\n"));
	assert.ok(prepared.writeIntent);
	const applied = applyFlowDeskSessionEvidenceWriteIntentsV1(rootDir, [prepared.writeIntent]);
	assert.equal(applied.ok, true, applied.errors.join("\n"));
}

/** Helper to set up a rootDir with aborted lane lifecycle + guard sign-off + reviewer_lane_context. */
function withTempRoot(prefix: string): string {
	return mkdtempSync(join(tmpdir(), prefix));
}

/**
 * Fake SDK client that successfully creates a child session.
 * Used for happy_path_single_retry.
 */
const fakeSuccessClient = {
	session: {
		create: async () => ({ id: "ses-retry-child-001" }),
		messages: async () => ({ messages: [{ role: "assistant", parts: [{ type: "text", text: '{"schema_version":"flowdesk.top_tier_review_verdict.v1"}' }] }] }),
		prompt: async () => ({}),
		promptAsync: async () => ({}),
		abort: async () => ({}),
		children: async () => ({ sessions: [] }),
	},
};

const fakeAgentTaskFailureClient = {
	session: {
		create: async () => ({ id: "ses-retry-child-failed-001" }),
		messages: async () => ({ messages: [] }),
		prompt: async () => ({}),
		promptAsync: async () => ({}),
		abort: async () => ({}),
		children: async () => ({ sessions: [] }),
	},
};

const retryConfig = {
	autoAbortOnStall: true,
	autoRetryAfterAbort: true as const,
	maxAutoRetries: 1,
	guardHmacKey: guardKey,
};

test("agent-task backfill terminalizes stale legacy failed lane without context", () => {
	const rootDir = withTempRoot("flowdesk-agent-task-backfill-legacy-");
	writeLifecycle(
		rootDir,
		lifecycleRecord({
			workflow_id: "workflow-agent-task-123",
			lane_id: "lane-agent-task-123",
			agent_ref: "agent-general-123",
			provider_qualified_model_id: "openai/gpt-5.5",
			state: "running",
			updated_at: "2026-05-26T10:01:00.000Z",
			spawned_by: undefined,
		}),
		"lifecycle-agent-task-running-001",
	);
	writeTaskFailed(
		rootDir,
		taskFailedRecord({
			failure_category: "sdk_create_failed",
			redacted_reason: "legacy task failed after launch failure",
		}),
	);

	const result = backfillTerminalAgentTaskFailedLanesV1({
		rootDir,
		workflowId: "workflow-agent-task-123",
		now: new Date("2026-05-26T10:05:00.000Z"),
	});

	assert.equal(result.status, "backfill_completed");
	assert.equal(result.lanesTerminalized, 1);
	const reload = reloadFlowDeskSessionEvidenceV1({ rootDir, workflowId: "workflow-agent-task-123" });
	assert.equal(reload.ok, true);
	assert.equal(
		reload.entries.some(
			(entry) =>
				entry.evidenceClass === "lane_lifecycle" &&
				entry.record.lane_id === "lane-agent-task-123" &&
				entry.record.state === "invocation_failed" &&
				entry.record.dispatch_authority_enabled === false &&
				entry.record.providerCall === false &&
				entry.record.actualLaneLaunch === false &&
				entry.record.runtimeExecution === false,
		),
		true,
	);
});

test("agent-task backfill uses agent_task_context and no_response maps to no_output", () => {
	const rootDir = withTempRoot("flowdesk-agent-task-backfill-context-");
	writeLifecycle(
		rootDir,
		lifecycleRecord({
			workflow_id: "workflow-agent-task-123",
			lane_id: "lane-agent-task-123",
			agent_ref: "agent-old-123",
			provider_qualified_model_id: "openai/old-model",
			parent_session_ref: "ses-old-parent-123",
			state: "created",
			updated_at: "2026-05-26T10:01:00.000Z",
		}),
		"lifecycle-agent-task-created-001",
	);
	writeAgentTaskContext(
		rootDir,
		agentTaskContextRecord({
			agent_ref: "agent-general-123",
			provider_qualified_model_id: "openai/gpt-5.5",
			parent_session_ref: "ses-parent-agent-123",
		}),
	);
	writeTaskFailed(rootDir, taskFailedRecord({ failure_category: "no_response" }));

	const result = backfillTerminalAgentTaskFailedLanesV1({
		rootDir,
		workflowId: "workflow-agent-task-123",
		now: new Date("2026-05-26T10:05:00.000Z"),
	});

	assert.equal(result.status, "backfill_completed");
	assert.equal(result.lanesTerminalized, 1);
	const reload = reloadFlowDeskSessionEvidenceV1({ rootDir, workflowId: "workflow-agent-task-123" });
	assert.equal(reload.ok, true);
	const terminal = reload.entries.find(
		(entry) =>
			entry.evidenceClass === "lane_lifecycle" &&
			entry.record.lane_id === "lane-agent-task-123" &&
			entry.record.state === "no_output",
	)?.record as Record<string, unknown> | undefined;
	assert.ok(terminal);
	assert.equal(terminal.agent_ref, "agent-general-123");
	assert.equal(terminal.provider_qualified_model_id, "openai/gpt-5.5");
	assert.equal(terminal.parent_session_ref, "ses-parent-agent-123");
	assert.equal(terminal.output_ref, undefined);
	const projection = projectFlowDeskLaneStallV1({
		workflowId: "workflow-agent-task-123",
		reload,
		observedAt: "2026-05-26T10:10:00.000Z",
		stallThresholdMs: 60_000,
	});
	const laneProjection = projection.entries.find(
		(entry) => entry.laneId === "lane-agent-task-123",
	);
	assert.equal(laneProjection?.classification, "terminal");
	assert.equal(projection.totalStalledLanes, 0);
});

test("agent-task backfill terminalizes stale legacy task result lane", () => {
	const rootDir = withTempRoot("flowdesk-agent-task-backfill-result-");
	writeLifecycle(
		rootDir,
		lifecycleRecord({
			workflow_id: "workflow-agent-task-123",
			lane_id: "lane-agent-task-123",
			agent_ref: "agent-general-123",
			provider_qualified_model_id: "openai/gpt-5.5",
			state: "running",
			updated_at: "2026-05-26T10:01:00.000Z",
		}),
		"lifecycle-agent-task-running-001",
	);
	writeTaskResult(rootDir, taskResultRecord());

	const result = backfillTerminalAgentTaskFailedLanesV1({
		rootDir,
		workflowId: "workflow-agent-task-123",
		now: new Date("2026-05-26T10:05:00.000Z"),
	});

	assert.equal(result.status, "backfill_completed");
	assert.equal(result.lanesTerminalized, 1);
	const reload = reloadFlowDeskSessionEvidenceV1({ rootDir, workflowId: "workflow-agent-task-123" });
	assert.equal(reload.ok, true);
	const terminal = reload.entries.find(
		(entry) =>
			entry.evidenceClass === "lane_lifecycle" &&
			entry.record.lane_id === "lane-agent-task-123" &&
			entry.record.state === "incomplete",
	)?.record as Record<string, unknown> | undefined;
	assert.ok(terminal);
	assert.equal(terminal.verdict_ref, undefined);
	assert.equal(terminal.output_ref, "output-task-agent-123");
	assert.equal(terminal.dispatch_authority_enabled, false);
	assert.equal(terminal.providerCall, false);
	assert.equal(terminal.actualLaneLaunch, false);
	assert.equal(terminal.runtimeExecution, false);
	const projection = projectFlowDeskLaneStallV1({
		workflowId: "workflow-agent-task-123",
		reload,
		observedAt: "2026-05-26T10:10:00.000Z",
		stallThresholdMs: 60_000,
	});
	assert.equal(projection.totalStalledLanes, 0);
	assert.equal(
		projection.entries.find((entry) => entry.laneId === "lane-agent-task-123")?.classification,
		"terminal",
	);
});

// ---------------------------------------------------------------------------
// Conformance fixtures
// ---------------------------------------------------------------------------

test("guarded auto-retry launches reviewer lane after abort", async () => {
	// happy_path_single_retry
	const rootDir = withTempRoot("flowdesk-auto-retry-happy-");
	writeGuardSignOff(rootDir);
	// Write aborted lifecycle
	writeLifecycle(
		rootDir,
		lifecycleRecord({ state: "aborted", updated_at: "2026-05-26T10:05:00.000Z" }),
		"lifecycle-aborted-123",
	);
	writeReviewerLaneContext(rootDir, reviewerLaneContextRecord());

	const result = await evaluateGuardedAutoRetryHookV1({ _nudgeQuietPeriodMs: 100, _messagesTimeoutMs: 0,
		config: retryConfig,
		rootDir,
		workflowId: "workflow-quick-reviewer-123",
		laneId: "lane-quick-policy-security-123",
		abortEvidenceId: "lifecycle-aborted-123",
		client: fakeSuccessClient,
		parentSessionId: "parent-session-001",
		now: new Date("2026-05-26T10:06:00.000Z"),
	});

	assert.equal(result.status, "retry_launched", `expected retry_launched, got ${JSON.stringify(result)}`);
	assert.ok("newLaneId" in result && typeof result.newLaneId === "string");
	assert.ok("pendingRetryEvidenceId" in result && typeof result.pendingRetryEvidenceId === "string");

	// Verify retry_executed evidence written
	const reload = reloadFlowDeskSessionEvidenceV1({ rootDir, workflowId: "workflow-quick-reviewer-123" });
	assert.equal(reload.ok, true);
	assert.equal(
		reload.entries.some((e) => e.record && (e.record as Record<string, unknown>).schema_version === "flowdesk.retry_executed.v1"),
		true,
		"retry_executed.v1 evidence should be written",
	);
	// Verify pending_retry_plan exists with launched status
	const launchedPlan = reload.entries.some(
		(e) =>
			(e.record as Record<string, unknown>)?.schema_version === "flowdesk.pending_retry_plan.v1" &&
			(e.record as Record<string, unknown>)?.status === "launched",
	);
	assert.equal(launchedPlan, true, "pending_retry_plan with launched status should be written");
});

test("guarded auto-retry blocked when cap reached", async () => {
	// cap_reached_after_one: seed retry_executed for the lane, verify auto_retry_disabled(cap_reached)
	const rootDir = withTempRoot("flowdesk-auto-retry-cap-");
	writeGuardSignOff(rootDir);
	writeLifecycle(
		rootDir,
		lifecycleRecord({ state: "aborted", updated_at: "2026-05-26T10:05:00.000Z" }),
		"lifecycle-aborted-123",
	);
	writeReviewerLaneContext(rootDir, reviewerLaneContextRecord());
	// Seed one retry_executed for original lane (cap = 1 already used)
	writeRetryExecutedEvidence(rootDir, {
		schema_version: "flowdesk.retry_executed.v1",
		workflow_id: "workflow-quick-reviewer-123",
		original_lane_id: "lane-quick-policy-security-123",
		new_lane_id: "lane-retry-previous-001",
		retry_attempt: 1,
		perspective: "policy_security",
		provider_qualified_model_id: "openai/gpt-5.5",
		new_parent_session_ref: "ses-retry-child-prev",
		original_attempt_id: "attempt-001",
		created_at: "2026-05-26T10:03:00.000Z",
		dispatch_authority_enabled: false,
	});

	const result = await evaluateGuardedAutoRetryHookV1({ _nudgeQuietPeriodMs: 100, _messagesTimeoutMs: 0,
		config: retryConfig,
		rootDir,
		workflowId: "workflow-quick-reviewer-123",
		laneId: "lane-quick-policy-security-123",
		abortEvidenceId: "lifecycle-aborted-123",
		client: fakeSuccessClient,
		parentSessionId: "parent-session-001",
		now: new Date("2026-05-26T10:06:00.000Z"),
	});

	assert.equal(result.status, "auto_retry_disabled");
	assert.equal("reason" in result && result.reason, "cap_reached");

	// Verify retry_failed(cap_reached) written
	const reload = reloadFlowDeskSessionEvidenceV1({ rootDir, workflowId: "workflow-quick-reviewer-123" });
	assert.equal(reload.ok, true);
	assert.equal(
		reload.entries.some(
			(e) =>
				(e.record as Record<string, unknown>)?.schema_version === "flowdesk.retry_failed.v1" &&
				(e.record as Record<string, unknown>)?.failure_category === "cap_reached",
		),
		true,
		"retry_failed(cap_reached) evidence should be written",
	);
});

test("guarded auto-retry counts failed retries toward cap", async () => {
	// cap_bypass_via_failures_blocked: seed retry_failed for the lane
	const rootDir = withTempRoot("flowdesk-auto-retry-cap-via-failed-");
	writeGuardSignOff(rootDir);
	writeLifecycle(
		rootDir,
		lifecycleRecord({ state: "aborted", updated_at: "2026-05-26T10:05:00.000Z" }),
		"lifecycle-aborted-123",
	);
	writeReviewerLaneContext(rootDir, reviewerLaneContextRecord());
	// Seed one retry_failed for original lane — still counts toward cap
	writeRetryFailedEvidence(rootDir, {
		schema_version: "flowdesk.retry_failed.v1",
		workflow_id: "workflow-quick-reviewer-123",
		original_lane_id: "lane-quick-policy-security-123",
		new_lane_id: "lane-retry-prev-failed",
		retry_attempt: 1,
		failure_category: "sdk_create_failed",
		redacted_reason: "sdk_session_create_threw_previously",
		created_at: "2026-05-26T10:03:00.000Z",
		dispatch_authority_enabled: false,
	});

	const result = await evaluateGuardedAutoRetryHookV1({ _nudgeQuietPeriodMs: 100, _messagesTimeoutMs: 0,
		config: retryConfig,
		rootDir,
		workflowId: "workflow-quick-reviewer-123",
		laneId: "lane-quick-policy-security-123",
		abortEvidenceId: "lifecycle-aborted-123",
		client: fakeSuccessClient,
		parentSessionId: "parent-session-001",
		now: new Date("2026-05-26T10:06:00.000Z"),
	});

	assert.equal(result.status, "auto_retry_disabled");
	assert.equal("reason" in result && result.reason, "cap_reached");
});

test("guarded auto-retry disabled when guard stale", async () => {
	// guard_stale_blocks_retry: use expired guard sidecar
	const rootDir = withTempRoot("flowdesk-auto-retry-guard-stale-");
	// Write expired guard sign-off (expires_at in the past)
	writeGuardSignOff(rootDir, { expires_at: "2026-05-26T09:00:00.000Z" });
	writeLifecycle(
		rootDir,
		lifecycleRecord({ state: "aborted", updated_at: "2026-05-26T10:05:00.000Z" }),
		"lifecycle-aborted-123",
	);
	writeReviewerLaneContext(rootDir, reviewerLaneContextRecord());

	const result = await evaluateGuardedAutoRetryHookV1({ _nudgeQuietPeriodMs: 100, _messagesTimeoutMs: 0,
		config: retryConfig,
		rootDir,
		workflowId: "workflow-quick-reviewer-123",
		laneId: "lane-quick-policy-security-123",
		abortEvidenceId: "lifecycle-aborted-123",
		client: fakeSuccessClient,
		parentSessionId: "parent-session-001",
		now: new Date("2026-05-26T10:06:00.000Z"),
	});

	assert.equal(result.status, "auto_retry_disabled");
	assert.equal("reason" in result && result.reason, "guard_unverified");
});

test("guarded auto-retry disabled when context missing", async () => {
	// context_missing_blocks: no reviewer_lane_context evidence
	const rootDir = withTempRoot("flowdesk-auto-retry-ctx-missing-");
	writeGuardSignOff(rootDir);
	writeLifecycle(
		rootDir,
		lifecycleRecord({ state: "aborted", updated_at: "2026-05-26T10:05:00.000Z" }),
		"lifecycle-aborted-123",
	);
	// No reviewer_lane_context written

	const result = await evaluateGuardedAutoRetryHookV1({ _nudgeQuietPeriodMs: 100, _messagesTimeoutMs: 0,
		config: retryConfig,
		rootDir,
		workflowId: "workflow-quick-reviewer-123",
		laneId: "lane-quick-policy-security-123",
		abortEvidenceId: "lifecycle-aborted-123",
		client: fakeSuccessClient,
		parentSessionId: "parent-session-001",
		now: new Date("2026-05-26T10:06:00.000Z"),
	});

	assert.equal(result.status, "auto_retry_disabled");
	assert.equal("reason" in result && result.reason, "context_missing");
});

test("guarded auto-retry launches generic agent task from agent_task_context", async () => {
	const rootDir = withTempRoot("flowdesk-auto-retry-agent-task-happy-");
	writeGuardSignOff(rootDir);
	writeLifecycle(
		rootDir,
		lifecycleRecord({
			workflow_id: "workflow-agent-task-123",
			lane_id: "lane-agent-task-123",
			agent_ref: "agent-general-123",
			provider_qualified_model_id: "openai/gpt-5.5",
			state: "aborted",
			updated_at: "2026-05-26T10:05:00.000Z",
		}),
		"lifecycle-agent-task-aborted-001",
	);
	writeAgentTaskContext(rootDir, agentTaskContextRecord());

	const result = await evaluateGuardedAutoRetryHookV1({ _nudgeQuietPeriodMs: 100, _messagesTimeoutMs: 0,
		config: retryConfig,
		rootDir,
		workflowId: "workflow-agent-task-123",
		laneId: "lane-agent-task-123",
		abortEvidenceId: "lifecycle-agent-task-aborted-001",
		client: fakeSuccessClient,
		parentSessionId: "unused-parent-for-agent-context",
		now: new Date("2026-05-26T10:06:00.000Z"),
	});

	assert.equal(result.status, "retry_launched", `expected retry_launched, got ${JSON.stringify(result)}`);
	const reload = reloadFlowDeskSessionEvidenceV1({ rootDir, workflowId: "workflow-agent-task-123" });
	assert.equal(reload.ok, true);
	assert.equal(
		reload.entries.some(
			(e) =>
				(e.record as Record<string, unknown>)?.schema_version === "flowdesk.retry_executed.v1" &&
				(e.record as Record<string, unknown>)?.retry_kind === "agent_task" &&
				(e.record as Record<string, unknown>)?.task_id === "task-agent-123",
		),
		true,
		"generic retry_executed evidence should be written",
	);
	assert.equal(
		reload.entries.some(
			(e) =>
				(e.record as Record<string, unknown>)?.schema_version === "flowdesk.task_result.v1" &&
				(e.record as Record<string, unknown>)?.lane_id === ("newLaneId" in result ? result.newLaneId : ""),
		),
		true,
		"generic retry should write task_result for the new lane",
	);
	assert.equal(
		reload.entries.some(
			(e) =>
				(e.record as Record<string, unknown>)?.schema_version === "flowdesk.pending_retry_plan.v1" &&
				(e.record as Record<string, unknown>)?.status === "launched",
		),
		true,
		"pending retry plan should be marked launched",
	);
});

test("guarded auto-retry blocks generic lane when agent_task_context and reviewer context are missing", async () => {
	const rootDir = withTempRoot("flowdesk-auto-retry-agent-task-ctx-missing-");
	writeGuardSignOff(rootDir);
	writeLifecycle(
		rootDir,
		lifecycleRecord({
			workflow_id: "workflow-agent-task-123",
			lane_id: "lane-agent-task-123",
			state: "aborted",
			updated_at: "2026-05-26T10:05:00.000Z",
		}),
		"lifecycle-agent-task-aborted-001",
	);

	const result = await evaluateGuardedAutoRetryHookV1({ _nudgeQuietPeriodMs: 100, _messagesTimeoutMs: 0,
		config: retryConfig,
		rootDir,
		workflowId: "workflow-agent-task-123",
		laneId: "lane-agent-task-123",
		abortEvidenceId: "lifecycle-agent-task-aborted-001",
		client: fakeSuccessClient,
		parentSessionId: "parent-session-001",
		now: new Date("2026-05-26T10:06:00.000Z"),
	});

	assert.equal(result.status, "auto_retry_disabled");
	assert.equal("reason" in result && result.reason, "context_missing");
});

test("guarded auto-retry cap prevents generic agent task retry", async () => {
	const rootDir = withTempRoot("flowdesk-auto-retry-agent-task-cap-");
	writeGuardSignOff(rootDir);
	writeLifecycle(
		rootDir,
		lifecycleRecord({
			workflow_id: "workflow-agent-task-123",
			lane_id: "lane-agent-task-123",
			state: "aborted",
			updated_at: "2026-05-26T10:05:00.000Z",
		}),
		"lifecycle-agent-task-aborted-001",
	);
	writeAgentTaskContext(rootDir, agentTaskContextRecord());
	writeRetryExecutedEvidence(rootDir, {
		schema_version: "flowdesk.retry_executed.v1",
		workflow_id: "workflow-agent-task-123",
		original_lane_id: "lane-agent-task-123",
		new_lane_id: "lane-retry-agent-task-prev",
		retry_attempt: 1,
		retry_kind: "agent_task",
		task_id: "task-agent-123",
		provider_qualified_model_id: "openai/gpt-5.5",
		new_parent_session_ref: "ses-parent-agent-123",
		created_at: "2026-05-26T10:03:00.000Z",
		dispatch_authority_enabled: false,
	});

	const result = await evaluateGuardedAutoRetryHookV1({ _nudgeQuietPeriodMs: 100, _messagesTimeoutMs: 0,
		config: retryConfig,
		rootDir,
		workflowId: "workflow-agent-task-123",
		laneId: "lane-agent-task-123",
		abortEvidenceId: "lifecycle-agent-task-aborted-001",
		client: fakeSuccessClient,
		parentSessionId: "parent-session-001",
		now: new Date("2026-05-26T10:06:00.000Z"),
	});

	assert.equal(result.status, "auto_retry_disabled");
	assert.equal("reason" in result && result.reason, "cap_reached");
});

test("guarded auto-retry records generic retry failure and terminal lifecycle", async () => {
	const rootDir = withTempRoot("flowdesk-auto-retry-agent-task-failed-");
	writeGuardSignOff(rootDir);
	writeLifecycle(
		rootDir,
		lifecycleRecord({
			workflow_id: "workflow-agent-task-123",
			lane_id: "lane-agent-task-123",
			agent_ref: "agent-general-123",
			provider_qualified_model_id: "openai/gpt-5.5",
			state: "aborted",
			updated_at: "2026-05-26T10:05:00.000Z",
		}),
		"lifecycle-agent-task-aborted-001",
	);
	writeAgentTaskContext(rootDir, agentTaskContextRecord());

	const result = await evaluateGuardedAutoRetryHookV1({ _nudgeQuietPeriodMs: 100, _messagesTimeoutMs: 0,
		config: retryConfig,
		rootDir,
		workflowId: "workflow-agent-task-123",
		laneId: "lane-agent-task-123",
		abortEvidenceId: "lifecycle-agent-task-aborted-001",
		client: fakeAgentTaskFailureClient,
		parentSessionId: "unused-parent-for-agent-context",
		now: new Date("2026-05-26T10:06:00.000Z"),
	});

	assert.equal(result.status, "retry_failed");
	const reload = reloadFlowDeskSessionEvidenceV1({ rootDir, workflowId: "workflow-agent-task-123" });
	assert.equal(reload.ok, true);
	const newLaneId = reload.entries.find(
		(e) => (e.record as Record<string, unknown>)?.schema_version === "flowdesk.retry_failed.v1",
	)?.record.new_lane_id as string | undefined;
	assert.ok(newLaneId);
	assert.equal(
		reload.entries.some(
			(e) =>
				(e.record as Record<string, unknown>)?.schema_version === "flowdesk.retry_failed.v1" &&
				(e.record as Record<string, unknown>)?.new_lane_id === newLaneId,
		),
		true,
		"retry_failed evidence should be written for generic retry",
	);
	assert.equal(
		reload.entries.some(
			(e) =>
				e.evidenceClass === "lane_lifecycle" &&
				(e.record as Record<string, unknown>)?.lane_id === newLaneId &&
				(e.record as Record<string, unknown>)?.state === "no_output",
		),
		true,
		"failed generic retry should write terminal lifecycle for the new lane",
	);
	assert.equal(
		reload.entries.some(
			(e) =>
				(e.record as Record<string, unknown>)?.schema_version === "flowdesk.pending_retry_plan.v1" &&
				(e.record as Record<string, unknown>)?.status === "failed",
		),
		true,
		"pending retry plan should be marked failed",
	);
});

test("guarded auto-retry emits retry_failed evidence when SDK unavailable", async () => {
	// sdk_unavailable_emits_evidence: null client → retry_failed(sdk_unavailable) written, NOT silent skip
	const rootDir = withTempRoot("flowdesk-auto-retry-sdk-unavail-");
	writeGuardSignOff(rootDir);
	writeLifecycle(
		rootDir,
		lifecycleRecord({ state: "aborted", updated_at: "2026-05-26T10:05:00.000Z" }),
		"lifecycle-aborted-123",
	);
	writeReviewerLaneContext(rootDir, reviewerLaneContextRecord());

	const result = await evaluateGuardedAutoRetryHookV1({ _nudgeQuietPeriodMs: 100, _messagesTimeoutMs: 0,
		config: retryConfig,
		rootDir,
		workflowId: "workflow-quick-reviewer-123",
		laneId: "lane-quick-policy-security-123",
		abortEvidenceId: "lifecycle-aborted-123",
		client: undefined,
		parentSessionId: "parent-session-001",
		now: new Date("2026-05-26T10:06:00.000Z"),
	});

	assert.equal(result.status, "retry_failed");
	assert.equal("failureCategory" in result && result.failureCategory, "sdk_unavailable");

	// Verify retry_failed(sdk_unavailable) evidence written — NOT a silent skip
	const reload = reloadFlowDeskSessionEvidenceV1({ rootDir, workflowId: "workflow-quick-reviewer-123" });
	assert.equal(reload.ok, true);
	assert.equal(
		reload.entries.some(
			(e) =>
				(e.record as Record<string, unknown>)?.schema_version === "flowdesk.retry_failed.v1" &&
				(e.record as Record<string, unknown>)?.failure_category === "sdk_unavailable",
		),
		true,
		"retry_failed(sdk_unavailable) evidence must be written (not a silent skip)",
	);
});

test("guarded auto-retry blocked when concurrent retry in progress", async () => {
	// concurrent_retry_blocked: seed pending_retry_plan(pending) for same lane
	const rootDir = withTempRoot("flowdesk-auto-retry-concurrent-");
	writeGuardSignOff(rootDir);
	writeLifecycle(
		rootDir,
		lifecycleRecord({ state: "aborted", updated_at: "2026-05-26T10:05:00.000Z" }),
		"lifecycle-aborted-123",
	);
	writeReviewerLaneContext(rootDir, reviewerLaneContextRecord());
	// Seed an active pending_retry_plan for the same original lane
	writePendingRetryPlanEvidence(rootDir, {
		schema_version: "flowdesk.pending_retry_plan.v1",
		workflow_id: "workflow-quick-reviewer-123",
		original_lane_id: "lane-quick-policy-security-123",
		new_lane_id: "lane-retry-concurrent-001",
		retry_attempt: 1,
		context_evidence_id: "reviewer-lane-context-001",
		abort_evidence_id: "lifecycle-aborted-123",
		status: "pending",
		created_at: "2026-05-26T10:04:00.000Z",
		expires_at: "2026-05-26T11:04:00.000Z",
		dispatch_authority_enabled: false,
	});

	const result = await evaluateGuardedAutoRetryHookV1({ _nudgeQuietPeriodMs: 100, _messagesTimeoutMs: 0,
		config: retryConfig,
		rootDir,
		workflowId: "workflow-quick-reviewer-123",
		laneId: "lane-quick-policy-security-123",
		abortEvidenceId: "lifecycle-aborted-123",
		client: fakeSuccessClient,
		parentSessionId: "parent-session-001",
		now: new Date("2026-05-26T10:06:00.000Z"),
	});

	// The concurrent pending plan counts toward cap (retriesUsed=1 >= maxAutoRetries=1),
	// so we get cap_reached rather than concurrent_retry_in_progress
	// (per Step 7 checking cap before Step 8 checking concurrent)
	assert.equal(result.status, "auto_retry_disabled");
	assert.ok(
		("reason" in result && result.reason === "cap_reached") ||
		("reason" in result && result.reason === "concurrent_retry_in_progress"),
		`expected cap_reached or concurrent_retry_in_progress, got ${JSON.stringify(result)}`,
	);
});

test("reconcile stale pending retry plans writes indeterminate failure", () => {
	// crash_recovery_indeterminate: seed pending_retry_plan(launched) older than 10min with no terminal
	const rootDir = withTempRoot("flowdesk-auto-retry-crash-recovery-");
	// Write a launched pending_retry_plan created 11 minutes ago
	const createdAt = new Date("2026-05-26T09:50:00.000Z");
	const now = new Date("2026-05-26T10:01:00.000Z"); // 11 minutes later
	writePendingRetryPlanEvidence(rootDir, {
		schema_version: "flowdesk.pending_retry_plan.v1",
		workflow_id: "workflow-quick-reviewer-123",
		original_lane_id: "lane-quick-policy-security-123",
		new_lane_id: "lane-retry-stale-launched-001",
		retry_attempt: 1,
		context_evidence_id: "reviewer-lane-context-001",
		abort_evidence_id: "lifecycle-aborted-123",
		status: "launched",
		created_at: createdAt.toISOString(),
		expires_at: "2026-05-26T11:00:00.000Z",
		dispatch_authority_enabled: false,
	});

	// No retry_executed or retry_failed exists for new_lane_id
	reconcileStalePendingRetryPlansV1({
		rootDir,
		workflowId: "workflow-quick-reviewer-123",
		now,
		staleThresholdMs: 600_000, // 10 minutes
	});

	// Verify retry_failed(indeterminate_launch) written
	const reload = reloadFlowDeskSessionEvidenceV1({ rootDir, workflowId: "workflow-quick-reviewer-123" });
	assert.equal(reload.ok, true);
	assert.equal(
		reload.entries.some(
			(e) =>
				(e.record as Record<string, unknown>)?.schema_version === "flowdesk.retry_failed.v1" &&
				(e.record as Record<string, unknown>)?.failure_category === "indeterminate_launch",
		),
		true,
		"retry_failed(indeterminate_launch) evidence should be written after crash recovery",
	);
});

test("guarded auto-retry not configured when autoRetryAfterAbort is false", async () => {
	// Verify auto_retry_not_configured returned immediately when opt-in is false
	const rootDir = withTempRoot("flowdesk-auto-retry-not-configured-");
	writeGuardSignOff(rootDir);
	writeLifecycle(rootDir, lifecycleRecord({ state: "aborted", updated_at: "2026-05-26T10:05:00.000Z" }));

	const result = await evaluateGuardedAutoRetryHookV1({ _nudgeQuietPeriodMs: 100, _messagesTimeoutMs: 0,
		config: { ...retryConfig, autoRetryAfterAbort: false },
		rootDir,
		workflowId: "workflow-quick-reviewer-123",
		laneId: "lane-quick-policy-security-123",
		abortEvidenceId: "lifecycle-aborted-123",
		client: fakeSuccessClient,
		parentSessionId: "parent-session-001",
	});

	assert.equal(result.status, "auto_retry_not_configured");
	assert.equal("reason" in result && result.reason, "opt_in_false");
});

test("guarded auto-retry blocked when lane not in aborted state", async () => {
	// lane_not_terminal_aborted: seed running lifecycle only, verify disabled(lane_not_terminal_aborted)
	const rootDir = withTempRoot("flowdesk-auto-retry-not-aborted-");
	writeGuardSignOff(rootDir);
	// Write lifecycle in "running" state — NOT aborted
	writeLifecycle(rootDir, lifecycleRecord({ state: "running" }), "lifecycle-running-only");
	writeReviewerLaneContext(rootDir, reviewerLaneContextRecord());

	const result = await evaluateGuardedAutoRetryHookV1({ _nudgeQuietPeriodMs: 100, _messagesTimeoutMs: 0,
		config: retryConfig,
		rootDir,
		workflowId: "workflow-quick-reviewer-123",
		laneId: "lane-quick-policy-security-123",
		abortEvidenceId: "lifecycle-running-only",
		client: fakeSuccessClient,
		parentSessionId: "parent-session-001",
		now: new Date("2026-05-26T10:06:00.000Z"),
	});

	assert.equal(result.status, "auto_retry_disabled");
	assert.equal("reason" in result && result.reason, "lane_not_terminal_aborted");
});
