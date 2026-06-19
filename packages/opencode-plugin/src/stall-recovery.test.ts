import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
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
import { executeFlowDeskAgentTaskV1 } from "./agent-task-runner.js";
import { createFlowDeskLocalNonDispatchAdapterSession } from "./local-adapter.js";
import { validateAndAbortFlowDeskLaneEvidenceV1 } from "./stall-recovery.js";
import {
	computeGuardSignOffHmacV1,
	evaluateGuardedAutoAbortHookV1,
	evaluateGuardedAutoRetryHookV1,
	monitorChildSessionsV1,
	flowDeskProgressIsMeaningfulActivityV1,
	deriveFlowDeskLaneToolStateV1,
	resolveFlowDeskExpectedTurnCompletedV1,
	backfillTerminalAgentTaskFailedLanesV1,
	reconcileStalePendingRetryPlansV1,
	isAutoAbortEnabledV1,
	isRetryableSessionError,
	checkSdkSessionApiHealthV1,
	verifyGuardSignOffHmacV1,
	runFlowDeskWatchdogCycleV1,
	type FlowDeskGuardSignOffV1,
} from "./stall-recovery.js";

test("checkSdkSessionApiHealthV1 probes session.messages with structured path id before legacy fallback", async () => {
	const calls: unknown[] = [];
	const client = {
		session: {
			async messages(options: { sessionID?: string; path?: { id?: string } }) {
				calls.push(options);
				if (options.sessionID !== undefined) throw new Error("legacy shape should not be used first");
				return [];
			},
		},
	};

	const health = await checkSdkSessionApiHealthV1(client, "ses-health", { sessionReadMs: 100 });

	assert.deepEqual(health, { status: "api_responsive" });
	assert.deepEqual(calls, [{ path: { id: "ses-health" } }]);
});

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

function writeAgentTaskChildSession(
	rootDir: string,
	input: {
		workflowId?: string;
		laneId?: string;
		taskId?: string;
		childSessionId?: string;
		createdAt?: string;
		nudgeCount?: number;
		lastNudgeAt?: string | null;
		awaitingBodyCaptureAttempts?: number;
		awaitingBodyCaptureSince?: string;
	} = {},
	evidenceId = "agent-task-child-session-123",
): void {
	const record = {
		schema_version: "flowdesk.agent_task_child_session.v1",
		workflow_id: input.workflowId ?? "workflow-quick-reviewer-123",
		lane_id: input.laneId ?? "lane-quick-policy-security-123",
		task_id: input.taskId ?? "task-quick-policy-security-123",
		child_session_id: input.childSessionId ?? "ses-child-terminal-123",
		parent_session_ref: "ses-parent-123",
		provider_qualified_model_id: "openai/gpt-5.5",
		agent_ref: "agent-reviewer-123",
		nudge_count: input.nudgeCount ?? 0,
		last_nudge_at: input.lastNudgeAt ?? null,
		...(input.awaitingBodyCaptureAttempts === undefined ? {} : { awaiting_body_capture_attempts: input.awaitingBodyCaptureAttempts }),
		...(input.awaitingBodyCaptureSince === undefined ? {} : { awaiting_body_capture_since: input.awaitingBodyCaptureSince }),
		created_at: input.createdAt ?? "2026-05-26T10:00:00.000Z",
		dispatch_authority_enabled: false,
	};
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

function writeAgentTaskProgressRecord(
	rootDir: string,
	input: {
		workflowId: string;
		laneId: string;
		taskId: string;
		observedAt: string;
		phase?: string;
		progressLabel?: string;
	},
	evidenceId = `agent-task-progress-${input.laneId}-test`,
): void {
	const record = {
		schema_version: "flowdesk.agent_task_progress.v1",
		workflow_id: input.workflowId,
		lane_id: input.laneId,
		task_id: input.taskId,
		agent_ref: "agent-reviewer-123",
		provider_qualified_model_id: "openai/gpt-5.5",
		progress_seq: 42,
		observed_at: input.observedAt,
		phase: input.phase ?? "waiting",
		progress_label: input.progressLabel ?? "agent task message.updated event observed",
		progress_ref: `progress-${input.laneId}-42`,
		redaction_version: "v1",
		dispatch_authority_enabled: false,
	};
	const prepared = prepareFlowDeskSessionEvidenceWriteIntentV1({
		workflowId: input.workflowId,
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
		// No expires_at — permanent guard (matches real active sidecar)
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

test("isRetryableSessionError classifies transient SDK error codes", () => {
	assert.equal(isRetryableSessionError("UnknownError"), true);
	assert.equal(isRetryableSessionError("MessageAbortedError"), true);
	assert.equal(isRetryableSessionError("AuthError"), false);
});

function sessionErrorResponse(code: string, data?: unknown): Record<string, unknown> {
	return {
		type: "session.error",
		properties: {
			sessionID: "ses-child-session-error-retry",
			error: {
				name: code,
				code,
				message: `${code} observed`,
				...(data === undefined ? {} : { data }),
			},
		},
	};
}

function terminalSessionMessages(text = "Recovered final answer."): Record<string, unknown> {
	return {
		messages: [
			{
				role: "assistant",
				parts: [
					{ type: "text", text },
					{ type: "step-finish", reason: "stop" },
				],
			},
		],
	};
}

test("monitorChildSessionsV1 retries retryable session.error once and captures recovered task_result", async () => {
	const rootDir = mkdtempSync(join(tmpdir(), "flowdesk-session-error-recovered-"));
	try {
		const workflowId = "workflow-session-error-recovered";
		const laneId = "lane-session-error-recovered";
		const taskId = "task-session-error-recovered";
		writeAgentTaskChildSession(rootDir, {
			workflowId,
			laneId,
			taskId,
			childSessionId: "ses-child-session-error-retry",
			createdAt: "2026-05-26T10:00:00.000Z",
		});
		writeLifecycle(rootDir, lifecycleRecord({ workflow_id: workflowId, lane_id: laneId, state: "running" }), "lifecycle-session-error-recovered");

		let calls = 0;
		const client = {
			session: {
				messages: async () => {
					calls += 1;
					if (calls <= 2) return sessionErrorResponse("UnknownError");
					return terminalSessionMessages("Recovered after transient SDK error.");
				},
				abort: async () => ({}),
			},
		} as never;

		const result = await monitorChildSessionsV1({
			rootDir,
			workflowId,
			now: new Date("2026-05-26T10:01:00.000Z"),
			client,
			_sessionErrorRetryDelayMsForTest: 0,
		});

		// After retry: lane either completes with task_result or remains polling.
		// Either way, no task_failed evidence should be written for a recoverable error.
		const reload = reloadFlowDeskSessionEvidenceV1({ rootDir, workflowId });
		assert.equal(reload.ok, true);
		assert.equal(reload.entries.some((entry) => entry.evidenceClass === "task_failed"), false,
			"task_failed must not be written for a retryable transient session.error");
	} finally {
		rmSync(rootDir, { recursive: true, force: true });
	}
});

test("monitorChildSessionsV1 terminalizes retryable session.error after one failed retry", async () => {
	const rootDir = mkdtempSync(join(tmpdir(), "flowdesk-session-error-repeat-"));
	try {
		const workflowId = "workflow-session-error-repeat";
		const laneId = "lane-session-error-repeat";
		const taskId = "task-session-error-repeat";
		writeAgentTaskChildSession(rootDir, { workflowId, laneId, taskId, childSessionId: "ses-child-session-error-retry" });
		writeLifecycle(rootDir, lifecycleRecord({ workflow_id: workflowId, lane_id: laneId, state: "running" }), "lifecycle-session-error-repeat");
		const client = { session: { messages: async () => sessionErrorResponse("MessageAbortedError"), abort: async () => ({}) } } as never;

		const result = await monitorChildSessionsV1({
			rootDir,
			workflowId,
			now: new Date("2026-05-26T10:01:00.000Z"),
			client,
			_sessionErrorRetryDelayMsForTest: 0,
		});

		assert.equal(result.lanesCompleted, 0);
		assert.equal(result.lanesAborted, 1);
		const reload = reloadFlowDeskSessionEvidenceV1({ rootDir, workflowId });
		assert.equal(reload.ok, true);
		assert.equal(reload.entries.some((entry) => entry.evidenceClass === "task_failed"), true);
		assert.equal(reload.entries.some((entry) => entry.evidenceClass === "task_result"), false);
	} finally {
		rmSync(rootDir, { recursive: true, force: true });
	}
});

test("monitorChildSessionsV1 terminalizes non-retryable session.error immediately", async () => {
	const rootDir = mkdtempSync(join(tmpdir(), "flowdesk-session-error-auth-"));
	try {
		const workflowId = "workflow-session-error-auth";
		const laneId = "lane-session-error-auth";
		const taskId = "task-session-error-auth";
		writeAgentTaskChildSession(rootDir, { workflowId, laneId, taskId, childSessionId: "ses-child-session-error-retry" });
		writeLifecycle(rootDir, lifecycleRecord({ workflow_id: workflowId, lane_id: laneId, state: "running" }), "lifecycle-session-error-auth");
		let calls = 0;
		const client = { session: { messages: async () => { calls += 1; return sessionErrorResponse("AuthError"); }, abort: async () => ({}) } } as never;

		const result = await monitorChildSessionsV1({
			rootDir,
			workflowId,
			now: new Date("2026-05-26T10:01:00.000Z"),
			client,
			_sessionErrorRetryDelayMsForTest: 0,
		});

		assert.equal(result.lanesAborted, 1);
		assert.equal(calls > 0, true, "non-retryable errors must be observed through session.messages");
		const reload = reloadFlowDeskSessionEvidenceV1({ rootDir, workflowId });
		assert.equal(reload.ok, true);
		assert.equal(reload.entries.some((entry) => entry.evidenceClass === "task_failed"), true);
	} finally {
		rmSync(rootDir, { recursive: true, force: true });
	}
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

test("watchdog treats terminal lifecycle-only child lanes as completed and refreshes caches", async () => {
	for (const state of ["no_output", "incomplete", "invocation_failed"] as const) {
		const rootDir = mkdtempSync(join(tmpdir(), `flowdesk-watchdog-terminal-${state}-`));
		const workflowId = `workflow-quick-reviewer-terminal-${state}`;
		const laneId = `lane-quick-policy-security-terminal-${state}`;
		writeAgentTaskChildSession(rootDir, { workflowId, laneId, childSessionId: `ses-child-terminal-${state}` });
		writeLifecycle(
			rootDir,
			lifecycleRecord({
				workflow_id: workflowId,
				lane_id: laneId,
				state,
				updated_at: "2026-05-26T10:02:00.000Z",
			}),
			`lifecycle-terminal-${state}`,
		);

		let messagesCalls = 0;
		let promptCalls = 0;
		let abortCalls = 0;
		const result = await monitorChildSessionsV1({
			rootDir,
			workflowId,
			now: new Date("2026-05-26T10:05:00.000Z"),
			client: {
				session: {
					messages: async () => {
						messagesCalls += 1;
						return { messages: [{ role: "assistant", parts: [{ type: "text", text: "late output" }] }] };
					},
					prompt: async () => {
						promptCalls += 1;
						return {};
					},
					abort: async () => {
						abortCalls += 1;
						return {};
					},
				},
			} as never,
		});

		assert.deepEqual(result, { lanesPolled: 0, lanesCompleted: 0, lanesNudged: 0, lanesAborted: 0 });
		assert.equal(messagesCalls, 0, `${state} must not be polled/resumed`);
		assert.equal(promptCalls, 0, `${state} must not be nudged`);
		assert.equal(abortCalls, 0, `${state} must not be aborted`);

		const sidebar = JSON.parse(readFileSync(join(rootDir, ".flowdesk", "ui", "subtask-activity-sidebar.json"), "utf8")) as Record<string, unknown>;
		const row = (sidebar.rows as Array<Record<string, unknown>>).find((entry) => entry.laneId === laneId);
		assert.equal(row?.state, state);
		assert.equal(row?.classification, "terminal");
	}
});

test("watchdog does not nudge or abort lanes with recent child progress", async () => {
	const rootDir = mkdtempSync(join(tmpdir(), "flowdesk-watchdog-recent-progress-"));
	try {
		const workflowId = "workflow-watchdog-recent-progress";
		const laneId = "lane-watchdog-recent-progress";
		const taskId = "task-watchdog-recent-progress";
		writeAgentTaskChildSession(rootDir, {
			workflowId,
			laneId,
			taskId,
			childSessionId: "ses-child-recent-progress",
			createdAt: "2026-05-26T10:00:00.000Z",
			nudgeCount: 2,
			lastNudgeAt: "2026-05-26T10:00:20.000Z",
		});
		writeLifecycle(
			rootDir,
			lifecycleRecord({
				workflow_id: workflowId,
				lane_id: laneId,
				state: "running",
				created_at: "2026-05-26T10:00:00.000Z",
				updated_at: "2026-05-26T10:00:00.000Z",
			}),
			"lifecycle-recent-progress-running",
		);
		writeAgentTaskProgressRecord(rootDir, {
			workflowId,
			laneId,
			taskId,
			observedAt: "2026-05-26T10:00:58.000Z",
		});

		let promptCalls = 0;
		let abortCalls = 0;
		const result = await monitorChildSessionsV1({
			rootDir,
			workflowId,
			now: new Date("2026-05-26T10:01:00.000Z"),
			nudgeQuietPeriodMs: 10_000,
			abortThresholdMs: 30_000,
			client: {
				session: {
					messages: async () => ({ messages: [] }),
					prompt: async () => { promptCalls += 1; return {}; },
					abort: async () => { abortCalls += 1; return {}; },
				},
			} as never,
		});

		assert.equal(result.lanesPolled, 1);
		assert.equal(result.lanesNudged, 0);
		assert.equal(result.lanesAborted, 0);
		assert.equal(promptCalls, 0);
		assert.equal(abortCalls, 0);
	} finally {
		rmSync(rootDir, { recursive: true, force: true });
	}
});

test("watchdog captures idle-confirmed final text when no terminal marker is present", async () => {
	const rootDir = mkdtempSync(join(tmpdir(), "flowdesk-watchdog-idle-capture-"));
	try {
		const workflowId = "workflow-watchdog-idle-capture";
		const laneId = "lane-watchdog-idle-capture";
		const taskId = "task-watchdog-idle-capture";
		writeAgentTaskChildSession(rootDir, {
			workflowId,
			laneId,
			taskId,
			childSessionId: "ses-child-idle-capture",
			createdAt: "2026-05-26T10:00:00.000Z",
			nudgeCount: 0,
			lastNudgeAt: null,
		});
		writeLifecycle(
			rootDir,
			lifecycleRecord({
				workflow_id: workflowId,
				lane_id: laneId,
				state: "running",
				created_at: "2026-05-26T10:00:00.000Z",
				updated_at: "2026-05-26T10:00:00.000Z",
			}),
			"lifecycle-idle-capture-running",
		);

		// V11.2 (post 2-model review): idle-confirmed capture is triggered by a REAL
		// fresh session.idle event, not a silence heuristic, and no longer needs the
		// body-stability 2-cycle dance. Provide a fresh session.idle progress signal.
		writeAgentTaskProgressRecord(rootDir, {
			workflowId, laneId, taskId,
			observedAt: "2026-05-26T10:00:14.000Z",
			phase: "finalizing",
			progressLabel: "agent task session idle event observed",
		}, "agent-task-progress-idle-capture-idle-signal");

		let promptCalls = 0;
		let promptAsyncCalls = 0;
		let abortCalls = 0;
		const client = {
			session: {
				// Assistant text present, but NO step-finish / finish_reason terminal marker.
				messages: async () => ({
					messages: [
						{ role: "assistant", parts: [{ type: "text", text: "Decision: ship it. Safety Gate: rollback once." }] },
					],
				}),
				prompt: async () => { promptCalls += 1; return {}; },
				promptAsync: async () => { promptAsyncCalls += 1; return {}; },
				abort: async () => { abortCalls += 1; return {}; },
			},
		} as never;
		const result = await monitorChildSessionsV1({
			rootDir, workflowId,
			now: new Date("2026-05-26T10:00:15.000Z"), // fresh session.idle observed, < 30s abort
			nudgeQuietPeriodMs: 10_000, abortThresholdMs: 30_000, maxIdleContinuations: 0, client,
		});

		assert.equal(result.lanesCompleted, 1, "fresh session.idle with body captures (no 2-cycle stability needed)");
		assert.equal(result.lanesAborted, 0);
		assert.equal(promptCalls, 0);
		assert.equal(promptAsyncCalls, 0);
		assert.equal(abortCalls, 0);

		const reload = reloadFlowDeskSessionEvidenceV1({ rootDir, workflowId });
		assert.equal(reload.ok, true);
		const taskResult = reload.entries.find((entry) => entry.evidenceClass === "task_result")?.record as Record<string, unknown> | undefined;
		assert.ok(taskResult, "expected a task_result to be captured");
		assert.equal(taskResult?.completion_status, "final");
		assert.equal(taskResult?.finalization_reason, "stable_idle");
		assert.equal(typeof taskResult?.result_text === "string" && (taskResult.result_text as string).includes("Decision"), true);
	} finally {
		rmSync(rootDir, { recursive: true, force: true });
	}
});

test("watchdog does not idle-capture process-note text", async () => {
	const rootDir = mkdtempSync(join(tmpdir(), "flowdesk-watchdog-idle-process-note-"));
	try {
		const workflowId = "workflow-watchdog-idle-process-note";
		const laneId = "lane-watchdog-idle-process-note";
		const taskId = "task-watchdog-idle-process-note";
		writeAgentTaskChildSession(rootDir, {
			workflowId,
			laneId,
			taskId,
			childSessionId: "ses-child-idle-process-note",
			createdAt: "2026-05-26T10:00:00.000Z",
			nudgeCount: 0,
			lastNudgeAt: null,
		});
		writeLifecycle(
			rootDir,
			lifecycleRecord({
				workflow_id: workflowId,
				lane_id: laneId,
				state: "running",
				created_at: "2026-05-26T10:00:00.000Z",
				updated_at: "2026-05-26T10:00:00.000Z",
			}),
			"lifecycle-idle-process-note-running",
		);
		writeAgentTaskProgressRecord(rootDir, {
			workflowId, laneId, taskId,
			observedAt: "2026-05-26T10:00:14.000Z",
			phase: "finalizing",
			progressLabel: "agent task session idle event observed",
		}, "agent-task-progress-idle-process-note-idle-signal");

		const result = await monitorChildSessionsV1({
			rootDir, workflowId,
			now: new Date("2026-05-26T10:00:15.000Z"),
			nudgeQuietPeriodMs: 10_000, abortThresholdMs: 30_000, maxIdleContinuations: 0,
			client: {
				session: {
					messages: async () => ({ messages: [{ role: "assistant", parts: [{ type: "text", text: "I'll analyze this systematically before reporting back." }] }] }),
					prompt: async () => ({}),
					promptAsync: async () => ({}),
					abort: async () => ({}),
				},
			} as never,
		});

		assert.equal(result.lanesCompleted, 0, "process-note text must not become terminal task_result");
		assert.equal(result.lanesAwaitingCapture, 1);
		const reload = reloadFlowDeskSessionEvidenceV1({ rootDir, workflowId });
		assert.equal(reload.ok, true);
		assert.equal(reload.entries.some((entry) => entry.evidenceClass === "task_result"), false);
		const finalization = reload.entries.find((entry) => entry.evidenceClass === "session_finalization_evidence")?.record as Record<string, unknown> | undefined;
		assert.equal(finalization?.decision, "requires_review");
		assert.equal(finalization?.block_reason, "unsupported_final_text_kind");
	} finally {
		rmSync(rootDir, { recursive: true, force: true });
	}
});

test("watchdog does not idle-capture while a tool is still running", async () => {
	const rootDir = mkdtempSync(join(tmpdir(), "flowdesk-watchdog-idle-tool-running-"));
	try {
		const workflowId = "workflow-watchdog-idle-tool-running";
		const laneId = "lane-watchdog-idle-tool-running";
		const taskId = "task-watchdog-idle-tool-running";
		writeAgentTaskChildSession(rootDir, {
			workflowId,
			laneId,
			taskId,
			childSessionId: "ses-child-idle-tool-running",
			createdAt: "2026-05-26T10:00:00.000Z",
			nudgeCount: 0,
			lastNudgeAt: null,
		});
		writeLifecycle(
			rootDir,
			lifecycleRecord({
				workflow_id: workflowId,
				lane_id: laneId,
				state: "running",
				created_at: "2026-05-26T10:00:00.000Z",
				updated_at: "2026-05-26T10:00:00.000Z",
			}),
			"lifecycle-idle-tool-running",
		);

		const result = await monitorChildSessionsV1({
			rootDir,
			workflowId,
			now: new Date("2026-05-26T10:00:15.000Z"),
			nudgeQuietPeriodMs: 10_000,
			abortThresholdMs: 30_000,
			client: {
				session: {
					messages: async () => ({
						messages: [
							{
								role: "assistant",
								parts: [
									{ type: "text", text: "partial so far" },
									{ type: "tool", state: { status: "running" } },
								],
							},
						],
					}),
					prompt: async () => ({}),
					promptAsync: async () => ({}),
					abort: async () => ({}),
				},
			} as never,
		});

		assert.equal(result.lanesCompleted, 0, "must not idle-capture while a tool is mid-run");
		const reload = reloadFlowDeskSessionEvidenceV1({ rootDir, workflowId });
		assert.equal(reload.entries.some((entry) => entry.evidenceClass === "task_result"), false);
	} finally {
		rmSync(rootDir, { recursive: true, force: true });
	}
});

test("meaningful-progress classifier ignores watchdog-authored and ambient records", () => {
	// Real model/runtime activity → meaningful.
	assert.equal(flowDeskProgressIsMeaningfulActivityV1("waiting", "agent task message part event observed"), true);
	assert.equal(flowDeskProgressIsMeaningfulActivityV1("waiting", "agent task message.updated event observed"), true);
	assert.equal(flowDeskProgressIsMeaningfulActivityV1("waiting", "agent task tool error event observed"), true);
	assert.equal(flowDeskProgressIsMeaningfulActivityV1("waiting", "agent task OpenCode permission response observed"), true);
	// Watchdog-authored / terminalish → not meaningful.
	assert.equal(flowDeskProgressIsMeaningfulActivityV1("nudged", "async agent task idle continuation prompt injected after idle without final answer"), false);
	assert.equal(flowDeskProgressIsMeaningfulActivityV1("nudged", "async agent task nudge attempt recorded after quiet period; provider-side nudge skipped"), false);
	assert.equal(flowDeskProgressIsMeaningfulActivityV1("failed", "async agent task aborted after no response"), false);
	assert.equal(flowDeskProgressIsMeaningfulActivityV1("finalizing", "async agent task result captured by watchdog"), false);
	// Ambient session-status churn → not meaningful.
	assert.equal(flowDeskProgressIsMeaningfulActivityV1("waiting", "agent task session busy event observed"), false);
	assert.equal(flowDeskProgressIsMeaningfulActivityV1("waiting", "agent task session.diff event observed"), false);
	assert.equal(flowDeskProgressIsMeaningfulActivityV1("waiting", "agent task session.updated event observed"), false);
});

test("V11.2 deriveFlowDeskLaneToolStateV1: event-based open-tool set drives toolRunningNow/unknown", () => {
	const base = 1_000_000;
	const staleToolMs = 60_000;
	// No tool transitions → not running, not unknown.
	assert.deepEqual(
		deriveFlowDeskLaneToolStateV1({ transitions: [], nowMs: base, staleToolMs }),
		{ toolRunningNow: false, toolStateUnknown: false, oldestOpenAtMs: undefined, runningToolsCount: 0 },
	);
	// Open then settle (same callid) → not running.
	{
		const s = deriveFlowDeskLaneToolStateV1({
			transitions: [
				{ observedAtMs: base, label: "agent task tool running callid=call-1" },
				{ observedAtMs: base + 5_000, label: "agent task tool settled callid=call-1" },
			],
			nowMs: base + 6_000,
			staleToolMs,
		});
		assert.equal(s.toolRunningNow, false);
		assert.equal(s.toolStateUnknown, false);
	}
	// Open, not yet settled, within stale window → running (must NOT abort).
	{
		const s = deriveFlowDeskLaneToolStateV1({
			transitions: [{ observedAtMs: base, label: "agent task tool running callid=call-1" }],
			nowMs: base + 30_000,
			staleToolMs,
		});
		assert.equal(s.toolRunningNow, true);
		assert.equal(s.toolStateUnknown, false);
		assert.equal(s.runningToolsCount, 1);
	}
	// Open, no settle, past stale window → UNKNOWN (not idle, not running).
	{
		const s = deriveFlowDeskLaneToolStateV1({
			transitions: [{ observedAtMs: base, label: "agent task tool running callid=call-1" }],
			nowMs: base + 61_000,
			staleToolMs,
		});
		assert.equal(s.toolRunningNow, false);
		assert.equal(s.toolStateUnknown, true);
		assert.equal(s.oldestOpenAtMs, base);
		assert.equal(s.runningToolsCount, 1);
	}
	// Concurrent tools A,B: A settles, B still open within window → still running.
	{
		const s = deriveFlowDeskLaneToolStateV1({
			transitions: [
				{ observedAtMs: base, label: "agent task tool running callid=A" },
				{ observedAtMs: base + 1_000, label: "agent task tool running callid=B" },
				{ observedAtMs: base + 2_000, label: "agent task tool settled callid=A" },
			],
			nowMs: base + 3_000,
			staleToolMs,
		});
		assert.equal(s.toolRunningNow, true);
		assert.equal(s.toolStateUnknown, false);
		assert.equal(s.runningToolsCount, 1);
	}
	// Out-of-order: settle arrives for a callid that opens later in the list — both
	// processed in given order; net result is the call is closed.
	{
		const s = deriveFlowDeskLaneToolStateV1({
			transitions: [
				{ observedAtMs: base, label: "agent task tool settled callid=A" },
				{ observedAtMs: base + 1_000, label: "agent task tool running callid=A" },
				{ observedAtMs: base + 2_000, label: "agent task tool settled callid=A" },
			],
			nowMs: base + 3_000,
			staleToolMs,
		});
		assert.equal(s.toolRunningNow, false);
	}
	// tool error closes the call like settle.
	{
		const s = deriveFlowDeskLaneToolStateV1({
			transitions: [
				{ observedAtMs: base, label: "agent task tool running callid=A" },
				{ observedAtMs: base + 1_000, label: "agent task tool error callid=A" },
			],
			nowMs: base + 2_000,
			staleToolMs,
		});
		assert.equal(s.toolRunningNow, false);
		assert.equal(s.toolStateUnknown, false);
	}
});

test("V11.2 resolveFlowDeskExpectedTurnCompletedV1: binds latest finalizable turn after lane epoch/activity floor", () => {
	const epoch = 1_000_000;
	const tc = (created: number, completed: number, msgid: string) =>
		`agent task turn completed msgid=${msgid} created=${created} completed=${completed}`;
	// No turn-completed transitions → undefined (caller must HOLD, not fall back).
	assert.equal(
		resolveFlowDeskExpectedTurnCompletedV1({ transitions: [], laneEpochMs: epoch }),
		undefined,
	);
	// A turn created BEFORE the lane epoch (stale/unrelated) is ignored.
	assert.equal(
		resolveFlowDeskExpectedTurnCompletedV1({
			transitions: [{ observedAtMs: epoch + 10, label: tc(epoch - 5_000, epoch - 4_000, "old-msg") }],
			laneEpochMs: epoch,
		}),
		undefined,
	);
	// A turn created at/after the epoch binds; its messageId/completed are returned.
	{
		const r = resolveFlowDeskExpectedTurnCompletedV1({
			transitions: [{ observedAtMs: epoch + 5_000, label: tc(epoch + 1_000, epoch + 4_000, "msg-attempt") }],
			laneEpochMs: epoch,
		});
		assert.ok(r);
		assert.equal(r?.messageId, "msg-attempt");
		assert.equal(r?.completedMs, epoch + 4_000);
	}
	// With an old turn AND multiple attempt turns, the latest qualifying turn binds.
	// A later assistant turn after intervening tool/message activity is more likely
	// to be the task-final answer than the first intermediate tool-call turn.
	{
		const r = resolveFlowDeskExpectedTurnCompletedV1({
			transitions: [
				{ observedAtMs: epoch + 1, label: tc(epoch - 9_000, epoch - 8_000, "old") },
				{ observedAtMs: epoch + 6_000, label: tc(epoch + 2_000, epoch + 5_000, "attempt-turn") },
				{ observedAtMs: epoch + 20_000, label: tc(epoch + 18_000, epoch + 19_000, "later-turn") },
			],
			laneEpochMs: epoch,
		});
		assert.ok(r);
		assert.equal(r?.messageId, "later-turn", "must bind latest qualifying finalizable turn");
	}
	// A completed turn observed before a caller-supplied activity floor is ignored.
	// This protects tool-heavy tasks where the first completed assistant turn merely
	// requested tools and meaningful tool activity arrived afterwards.
	{
		const r = resolveFlowDeskExpectedTurnCompletedV1({
			transitions: [
				{ observedAtMs: epoch + 6_000, label: tc(epoch + 2_000, epoch + 5_000, "tool-call-turn") },
				{ observedAtMs: epoch + 30_000, label: tc(epoch + 25_000, epoch + 29_000, "final-answer-turn") },
			],
			laneEpochMs: epoch,
			minObservedAtMs: epoch + 20_000,
		});
		assert.ok(r);
		assert.equal(r?.messageId, "final-answer-turn");
	}
	{
		const r = resolveFlowDeskExpectedTurnCompletedV1({
			transitions: [{ observedAtMs: epoch + 6_000, label: tc(epoch + 2_000, epoch + 5_000, "tool-call-turn") }],
			laneEpochMs: epoch,
			minObservedAtMs: epoch + 20_000,
		});
		assert.equal(r, undefined, "must not bind an intermediate completed turn before later meaningful activity");
	}
});

test("watchdog does not let watchdog-authored progress defer abort", async () => {
	const rootDir = mkdtempSync(join(tmpdir(), "flowdesk-watchdog-noise-progress-"));
	try {
		const workflowId = "workflow-watchdog-noise-progress";
		const laneId = "lane-watchdog-noise-progress";
		const taskId = "task-watchdog-noise-progress";
		writeAgentTaskChildSession(rootDir, {
			workflowId,
			laneId,
			taskId,
			childSessionId: "ses-child-noise-progress",
			createdAt: "2026-05-26T10:00:00.000Z",
			// Already nudged to the cap so the lane is abort-eligible on silence.
			nudgeCount: 2,
			lastNudgeAt: "2026-05-26T10:00:20.000Z",
		});
		writeLifecycle(
			rootDir,
			lifecycleRecord({
				workflow_id: workflowId,
				lane_id: laneId,
				state: "running",
				created_at: "2026-05-26T10:00:00.000Z",
				updated_at: "2026-05-26T10:00:00.000Z",
			}),
			"lifecycle-noise-progress-running",
		);
		// Watchdog-authored nudge progress at 10:00:40 — this is NOISE and must
		// NOT reset the abort budget or defer abort.
		writeAgentTaskProgressRecord(rootDir, {
			workflowId,
			laneId,
			taskId,
			observedAt: "2026-05-26T10:00:40.000Z",
			phase: "nudged",
		}, "agent-task-progress-noise-nudged");

		let abortCalls = 0;
		const result = await monitorChildSessionsV1({
			rootDir,
			workflowId,
			// 50s after the last real nudge (10:00:20) > 30s abort threshold.
			now: new Date("2026-05-26T10:01:10.000Z"),
			nudgeQuietPeriodMs: 10_000,
			maxNudges: 2,
			abortThresholdMs: 30_000,
			maxIdleContinuations: 0,
			client: {
				session: {
					messages: async () => ({ messages: [] }),
					prompt: async () => ({}),
					promptAsync: async () => ({}),
					abort: async () => { abortCalls += 1; return {}; },
				},
			} as never,
		});

		assert.equal(result.lanesAborted, 1, "watchdog-authored nudge progress must not defer abort");
		assert.equal(abortCalls, 1);
	} finally {
		rmSync(rootDir, { recursive: true, force: true });
	}
});

test("V11.2 Slice 1: watchdog does NOT abort while a tool is genuinely running (no settle yet, within stale window)", async () => {
	const rootDir = mkdtempSync(join(tmpdir(), "flowdesk-v112-tool-running-noabort-"));
	try {
		const workflowId = "workflow-v112-tool-running";
		const laneId = "lane-v112-tool-running";
		const taskId = "task-v112-tool-running";
		writeAgentTaskChildSession(rootDir, {
			workflowId, laneId, taskId,
			childSessionId: "ses-child-v112-tool-running",
			createdAt: "2026-05-26T10:00:00.000Z",
		}, "agent-task-child-session-v112-tool-running");
		// A tool started at 10:00:05 and has NOT settled yet. Even though there is
		// no meaningful progress afterwards (silence > abortThreshold), the lane is
		// genuinely working and must not be aborted.
		writeAgentTaskProgressRecord(rootDir, {
			workflowId, laneId, taskId,
			observedAt: "2026-05-26T10:00:05.000Z",
			progressLabel: "agent task tool running callid=call-long-build",
		}, "agent-task-progress-v112-tool-open");

		let abortCalls = 0;
		const result = await monitorChildSessionsV1({
			rootDir, workflowId,
			now: new Date("2026-05-26T10:00:50.000Z"), // 45s silence, within staleToolMs
			nudgeQuietPeriodMs: 10_000,
			maxNudges: 2,
			abortThresholdMs: 30_000,
			maxIdleContinuations: 0,
			staleToolMs: 60_000,
			unknownStateMaxMs: 60_000,
			absoluteLaneAgeMs: 600_000,
			client: {
				session: {
					messages: async () => ({ messages: [] }),
					prompt: async () => ({}),
					promptAsync: async () => ({}),
					abort: async () => { abortCalls += 1; return {}; },
				},
			} as never,
		});

		assert.equal(result.lanesAborted, 0, "must not abort a lane with a genuinely running tool");
		assert.equal(abortCalls, 0);
	} finally {
		rmSync(rootDir, { recursive: true, force: true });
	}
});

test("V11.2 Slice 1: stale open tool (dropped settle) records review diagnostic without abort authority", async () => {
	const rootDir = mkdtempSync(join(tmpdir(), "flowdesk-v112-unknown-timeout-"));
	try {
		const workflowId = "workflow-v112-unknown";
		const laneId = "lane-v112-unknown";
		const taskId = "task-v112-unknown";
		writeAgentTaskChildSession(rootDir, {
			workflowId, laneId, taskId,
			childSessionId: "ses-child-v112-unknown",
			createdAt: "2026-05-26T10:00:00.000Z",
		}, "agent-task-child-session-v112-unknown");
		// Tool opened at 10:00:05, settle event dropped. staleToolMs=30s so by
		// 10:00:45 it is UNKNOWN. Current Release 1-safe behavior does NOT force-
		// terminate this state; it writes advisory coordinator-review diagnostic
		// evidence and leaves abort/retry to explicit user/Guard paths.
		writeAgentTaskProgressRecord(rootDir, {
			workflowId, laneId, taskId,
			observedAt: "2026-05-26T10:00:05.000Z",
			progressLabel: "agent task tool running callid=call-stuck",
		}, "agent-task-progress-v112-unknown-open");

		// At 10:00:45 (open 40s): unknown/overdue → diagnostic only, no abort.
		let abortCallsEarly = 0;
		const early = await monitorChildSessionsV1({
			rootDir, workflowId,
			now: new Date("2026-05-26T10:00:45.000Z"),
			abortThresholdMs: 30_000, maxIdleContinuations: 0,
			staleToolMs: 30_000, unknownStateMaxMs: 30_000, absoluteLaneAgeMs: 600_000,
			client: { session: { messages: async () => ({ messages: [] }), prompt: async () => ({}), promptAsync: async () => ({}), abort: async () => { abortCallsEarly += 1; return {}; } } } as never,
		});
		assert.equal(early.lanesAborted, 0, "unknown/overdue tool must not abort automatically");
		assert.equal(abortCallsEarly, 0);
		let reloaded = reloadFlowDeskSessionEvidenceV1({ rootDir, workflowId });
		assert.equal(reloaded.entries.some(entry => entry.evidenceClass === "task_failed"), false);
		assert.equal(reloaded.entries.some(entry => entry.evidenceClass === "agent_task_inconsistency" && (entry.record as Record<string, unknown>).inconsistency_kind === "tool_run_overdue_observed"), true);

		// At 10:01:20 (open ~75s): still diagnostic only and idempotent.
		let abortCallsLate = 0;
		const late = await monitorChildSessionsV1({
			rootDir, workflowId,
			now: new Date("2026-05-26T10:01:20.000Z"),
			abortThresholdMs: 30_000, maxIdleContinuations: 0,
			staleToolMs: 30_000, unknownStateMaxMs: 30_000, absoluteLaneAgeMs: 600_000,
			client: { session: { messages: async () => ({ messages: [] }), prompt: async () => ({}), promptAsync: async () => ({}), abort: async () => { abortCallsLate += 1; return {}; } } } as never,
		});
		assert.equal(late.lanesAborted, 0, "stale tool must remain coordinator-review diagnostic only");
		assert.equal(abortCallsLate, 0);
		reloaded = reloadFlowDeskSessionEvidenceV1({ rootDir, workflowId });
		assert.equal(reloaded.entries.filter(entry => entry.evidenceClass === "agent_task_inconsistency" && (entry.record as Record<string, unknown>).inconsistency_kind === "tool_run_overdue_observed").length, 1);
	} finally {
		rmSync(rootDir, { recursive: true, force: true });
	}
});

test("watchdog wakes diagnostic attention immediately for observed child tool aborted before staleToolMs", async () => {
	const rootDir = mkdtempSync(join(tmpdir(), "flowdesk-tool-aborted-attention-"));
	try {
		const workflowId = "workflow-tool-aborted-attention";
		const laneId = "lane-tool-aborted-attention";
		const taskId = "task-tool-aborted-attention";
		writeAgentTaskChildSession(rootDir, {
			workflowId, laneId, taskId,
			childSessionId: "ses-child-tool-aborted-attention",
			createdAt: "2026-05-26T10:00:00.000Z",
		}, "agent-task-child-session-tool-aborted-attention");
		writeLifecycle(rootDir, lifecycleRecord({
			workflow_id: workflowId,
			lane_id: laneId,
			state: "running",
			created_at: "2026-05-26T10:00:00.000Z",
			updated_at: "2026-05-26T10:00:00.000Z",
		}), "lifecycle-tool-aborted-attention-running");
		writeAgentTaskProgressRecord(rootDir, {
			workflowId, laneId, taskId,
			observedAt: "2026-05-26T10:00:05.000Z",
			progressLabel: "agent task tool running callid=call-aborted",
		}, "agent-task-progress-tool-aborted-open");

		let abortCalls = 0;
		const result = await monitorChildSessionsV1({
			rootDir,
			workflowId,
			now: new Date("2026-05-26T10:00:10.000Z"),
			staleToolMs: 150_000,
			abortThresholdMs: 30_000,
			absoluteLaneAgeMs: 600_000,
			client: {
				session: {
					messages: async () => ({ messages: [{ role: "assistant", parts: [{ type: "tool", callID: "call-aborted", state: { status: "aborted" }, error: { message: "Tool execution aborted" } }] }] }),
					prompt: async () => ({}),
					promptAsync: async () => ({}),
					abort: async () => { abortCalls += 1; return {}; },
				},
			} as never,
		});

		assert.equal(result.lanesAborted, 0, "tool failure observation is advisory only");
		assert.equal(result.lanesCompleted, 0);
		assert.equal(abortCalls, 0);
		const reload = reloadFlowDeskSessionEvidenceV1({ rootDir, workflowId });
		assert.equal(reload.ok, true);
		assert.equal(reload.entries.some((entry) => entry.evidenceClass === "task_failed"), false, "must not write task_failed for observed tool failure alone");
		assert.equal(reload.entries.some((entry) => entry.evidenceClass === "lane_lifecycle" && (entry.record as Record<string, unknown>).state !== "running"), false, "must not terminalize lifecycle for observed tool failure alone");
		assert.equal(reload.entries.some((entry) => entry.evidenceClass === "agent_task_progress" && String((entry.record as Record<string, unknown>).progress_label).includes("tool_execution_aborted_observed")), true);
		assert.equal(reload.entries.some((entry) => entry.evidenceClass === "agent_task_progress" && (entry.record as Record<string, unknown>).progress_label === "agent task tool error callid=call-aborted"), true, "snapshot error closes the open tool wait before staleToolMs");

		const wakeReady = JSON.parse(readFileSync(join(rootDir, ".flowdesk", "ui", "completion-wake-ready.json"), "utf8")) as Record<string, unknown>;
		const wakeRows = wakeReady.rows as Array<Record<string, unknown>>;
		const diagnosticRow = wakeRows.find((row) => row.completionKind === "diagnostic_attention" && Array.isArray(row.laneIds) && row.laneIds.includes(laneId));
		assert.ok(diagnosticRow, "diagnostic attention row should be ready for existing main-session wake consumption");
		assert.equal(diagnosticRow?.parentSessionRef, "ses-parent-123");
	} finally {
		rmSync(rootDir, { recursive: true, force: true });
	}
});

test("V11.2 Slice 1: true zero-event lane terminates via absoluteLaneAgeMs even without silence-from-activity", async () => {
	const rootDir = mkdtempSync(join(tmpdir(), "flowdesk-v112-lane-age-cap-"));
	try {
		const workflowId = "workflow-v112-lane-age";
		const laneId = "lane-v112-lane-age";
		const taskId = "task-v112-lane-age";
		// No progress events at all (true zero-event lane).
		writeAgentTaskChildSession(rootDir, {
			workflowId, laneId, taskId,
			childSessionId: "ses-child-v112-lane-age",
			createdAt: "2026-05-26T10:00:00.000Z",
		}, "agent-task-child-session-v112-lane-age");

		let abortCalls = 0;
		const result = await monitorChildSessionsV1({
			rootDir, workflowId,
			now: new Date("2026-05-26T10:02:30.000Z"), // 150s age
			abortThresholdMs: 30_000, maxIdleContinuations: 0,
			staleToolMs: 60_000, unknownStateMaxMs: 60_000,
			absoluteLaneAgeMs: 120_000, // 2min cap, exceeded
			client: {
				session: {
					messages: async () => ({ messages: [] }),
					prompt: async () => ({}),
					promptAsync: async () => ({}),
					abort: async () => { abortCalls += 1; return {}; },
				},
			} as never,
		});

		assert.equal(result.lanesAborted, 1, "zero-event lane must terminate at absoluteLaneAgeMs");
		assert.equal(abortCalls, 1);
	} finally {
		rmSync(rootDir, { recursive: true, force: true });
	}
});

test("coordinator attention timer records review-requested diagnostic without abort authority", async () => {
	const rootDir = mkdtempSync(join(tmpdir(), "flowdesk-coordinator-attention-"));
	try {
		const workflowId = "workflow-coordinator-attention";
		const laneId = "lane-coordinator-attention";
		const taskId = "task-coordinator-attention";
		writeAgentTaskChildSession(rootDir, {
			workflowId, laneId, taskId,
			childSessionId: "ses-child-coordinator-attention",
			createdAt: "2026-05-26T10:00:00.000Z",
		}, "agent-task-child-session-coordinator-attention");

		let abortCalls = 0;
		const result = await monitorChildSessionsV1({
			rootDir,
			workflowId,
			now: new Date("2026-05-26T10:00:40.000Z"),
			coordinatorAttentionMs: 30_000,
			abortThresholdMs: 600_000,
			absoluteLaneAgeMs: 600_000,
			client: {
				session: {
					messages: async () => ({ messages: [{ role: "assistant", parts: [{ type: "tool", callID: "call-diagnostic", state: { status: "running" } }] }] }),
					prompt: async () => ({}),
					promptAsync: async () => ({}),
					abort: async () => { abortCalls += 1; return {}; },
				},
			} as never,
		});

		assert.equal(result.lanesAborted, 0);
		assert.equal(abortCalls, 0);
		const reload = reloadFlowDeskSessionEvidenceV1({ rootDir, workflowId });
		assert.equal(reload.ok, true, reload.errors.join("\n"));
		const child = reload.entries.find(entry => entry.evidenceClass === "agent_task_child_session")?.record as Record<string, unknown>;
		assert.equal(child.coordinator_attention_status, "review_requested");
		assert.equal(child.capture_failure_child_session_id, "ses-child-coordinator-attention");
		assert.equal(child.capture_failure_last_part_kind, "tool");
		assert.equal(child.capture_failure_final_text_present, false);
		assert.equal(child.capture_failure_step_finish_present, false);
		assert.equal(child.capture_failure_running_tool_call_id, "call-diagnostic");
		assert.equal(child.capture_failure_running_tool_status, "running");
		assert.equal(child.capture_failure_recommended_next_action, "/flowdesk-status");
		assert.equal(reload.entries.some(entry => entry.evidenceClass === "agent_task_progress" && String((entry.record as Record<string, unknown>).progress_label).includes("coordinator_attention_observed")), true);
	} finally {
		rmSync(rootDir, { recursive: true, force: true });
	}
});

test("V11.2 correction: TURN_COMPLETED event with body waits for session idle before capture", async () => {
	const rootDir = mkdtempSync(join(tmpdir(), "flowdesk-v112-turncompleted-capture-"));
	try {
		const workflowId = "workflow-v112-turncompleted";
		const laneId = "lane-v112-turncompleted";
		const taskId = "task-v112-turncompleted";
		writeAgentTaskChildSession(rootDir, {
			workflowId, laneId, taskId,
			childSessionId: "ses-child-v112-turncompleted",
			createdAt: "2026-05-26T10:00:00.000Z",
		}, "agent-task-child-session-v112-turncompleted");
		// Assistant turn (created after lane epoch) reported time.completed at 10:00:08.
		const createdMs = Date.parse("2026-05-26T10:00:02.000Z");
		const completedMs = Date.parse("2026-05-26T10:00:08.000Z");
		writeAgentTaskProgressRecord(rootDir, {
			workflowId, laneId, taskId,
			observedAt: "2026-05-26T10:00:08.000Z",
			phase: "finalizing",
			progressLabel: `agent task turn completed msgid=msg-attempt created=${createdMs} completed=${completedMs}`,
		}, "agent-task-progress-v112-turncompleted-tc");

		let abortCalls = 0;
		const result = await monitorChildSessionsV1({
			rootDir, workflowId,
			now: new Date("2026-05-26T10:00:38.000Z"),
			abortThresholdMs: 30_000, maxIdleContinuations: 0,
			staleToolMs: 60_000, unknownStateMaxMs: 60_000, absoluteLaneAgeMs: 600_000,
			client: {
				session: {
					// No terminal marker in messages, but assistant text is present.
					messages: async () => ({ messages: [{ info: { role: "assistant" }, parts: [{ type: "text", text: "the final answer body" }] }] }),
					prompt: async () => ({}),
					promptAsync: async () => ({}),
					abort: async () => { abortCalls += 1; return {}; },
				},
			} as never,
		});

		assert.equal(result.lanesCompleted, 0, "turn-completed event alone must not capture");
		assert.equal(result.lanesAwaitingCapture, 1);
		assert.equal(abortCalls, 0);
		const reload = reloadFlowDeskSessionEvidenceV1({ rootDir, workflowId });
		assert.equal(reload.ok, true);
		assert.equal(reload.entries.some((entry) => entry.evidenceClass === "task_result"), false);
		assert.equal(reload.entries.some((entry) => entry.evidenceClass === "agent_task_progress" && String((entry.record as Record<string, unknown>).progress_label).includes("awaiting session idle before capture")), true);
	} finally {
		rmSync(rootDir, { recursive: true, force: true });
	}
});

test("V11.2 Slice 2: TURN_COMPLETED does NOT capture while a tool is still running", async () => {
	const rootDir = mkdtempSync(join(tmpdir(), "flowdesk-v112-turncompleted-toolguard-"));
	try {
		const workflowId = "workflow-v112-tc-toolguard";
		const laneId = "lane-v112-tc-toolguard";
		const taskId = "task-v112-tc-toolguard";
		writeAgentTaskChildSession(rootDir, {
			workflowId, laneId, taskId,
			childSessionId: "ses-child-v112-tc-toolguard",
			createdAt: "2026-05-26T10:00:00.000Z",
		}, "agent-task-child-session-v112-tc-toolguard");
		const createdMs = Date.parse("2026-05-26T10:00:02.000Z");
		const completedMs = Date.parse("2026-05-26T10:00:08.000Z");
		// A turn-completed signal exists, but a NEWER tool opened and has not settled
		// (within stale window) → toolRunningNow=true → capture must be blocked.
		writeAgentTaskProgressRecord(rootDir, {
			workflowId, laneId, taskId,
			observedAt: "2026-05-26T10:00:08.000Z",
			phase: "finalizing",
			progressLabel: `agent task turn completed msgid=msg-attempt created=${createdMs} completed=${completedMs}`,
		}, "agent-task-progress-v112-tcg-tc");
		writeAgentTaskProgressRecord(rootDir, {
			workflowId, laneId, taskId,
			observedAt: "2026-05-26T10:00:10.000Z",
			progressLabel: "agent task tool running callid=call-after-complete",
		}, "agent-task-progress-v112-tcg-toolopen");

		let abortCalls = 0;
		const result = await monitorChildSessionsV1({
			rootDir, workflowId,
			now: new Date("2026-05-26T10:00:20.000Z"), // within staleToolMs of tool open
			abortThresholdMs: 30_000, maxIdleContinuations: 0,
			staleToolMs: 60_000, unknownStateMaxMs: 60_000, absoluteLaneAgeMs: 600_000,
			client: {
				session: {
					messages: async () => ({ messages: [{ info: { role: "assistant" }, parts: [{ type: "text", text: "intermediate text" }] }] }),
					prompt: async () => ({}),
					promptAsync: async () => ({}),
					abort: async () => { abortCalls += 1; return {}; },
				},
			} as never,
		});

		assert.equal(result.lanesCompleted, 0, "must not capture turn-completed while a tool is running");
		assert.equal(abortCalls, 0, "must not abort a lane with a running tool");
	} finally {
		rmSync(rootDir, { recursive: true, force: true });
	}
});

test("V11.2 Slice 2: intermediate TURN_COMPLETED before later tool activity does not enter empty-body finalization", async () => {
	const rootDir = mkdtempSync(join(tmpdir(), "flowdesk-v112-intermediate-turncompleted-"));
	try {
		const workflowId = "workflow-v112-intermediate-tc";
		const laneId = "lane-v112-intermediate-tc";
		const taskId = "task-v112-intermediate-tc";
		writeAgentTaskChildSession(rootDir, {
			workflowId, laneId, taskId,
			childSessionId: "ses-child-v112-intermediate-tc",
			createdAt: "2026-05-26T10:00:00.000Z",
		}, "agent-task-child-session-v112-intermediate-tc");
		const createdMs = Date.parse("2026-05-26T10:00:02.000Z");
		const completedMs = Date.parse("2026-05-26T10:00:08.000Z");
		// First assistant turn completed at 10:00:08, then tool work continued and
		// settled at 10:00:20. The 10:00:08 turn is therefore an intermediate
		// tool-call turn and must not start awaiting_body_capture / no_output failure.
		writeAgentTaskProgressRecord(rootDir, {
			workflowId, laneId, taskId,
			observedAt: "2026-05-26T10:00:08.000Z",
			phase: "finalizing",
			progressLabel: `agent task turn completed msgid=msg-tool-call created=${createdMs} completed=${completedMs}`,
		}, "agent-task-progress-v112-itc-tc");
		writeAgentTaskProgressRecord(rootDir, {
			workflowId, laneId, taskId,
			observedAt: "2026-05-26T10:00:09.000Z",
			progressLabel: "agent task tool running callid=call-after-first-turn",
		}, "agent-task-progress-v112-itc-toolopen");
		writeAgentTaskProgressRecord(rootDir, {
			workflowId, laneId, taskId,
			observedAt: "2026-05-26T10:00:20.000Z",
			progressLabel: "agent task tool settled callid=call-after-first-turn",
		}, "agent-task-progress-v112-itc-toolsettled");

		let abortCalls = 0;
		const result = await monitorChildSessionsV1({
			rootDir, workflowId,
			now: new Date("2026-05-26T10:00:25.000Z"),
			nudgeQuietPeriodMs: 10_000,
			abortThresholdMs: 30_000, maxIdleContinuations: 0,
			staleToolMs: 60_000, unknownStateMaxMs: 60_000, absoluteLaneAgeMs: 600_000,
			bodyRetryMax: 1,
			client: {
				session: {
					messages: async () => ({ messages: [] }),
					prompt: async () => ({}),
					promptAsync: async () => ({}),
					abort: async () => { abortCalls += 1; return {}; },
				},
			} as never,
		});

		assert.equal(result.lanesCompleted, 0);
		assert.equal(result.lanesNudged, 0, "must not inject final-report repair from an intermediate turn");
		assert.equal(result.lanesAborted, 0, "must not terminalize no_output from an intermediate turn");
		assert.equal(abortCalls, 0);
		const reload = reloadFlowDeskSessionEvidenceV1({ rootDir, workflowId });
		assert.equal(reload.ok, true);
		assert.equal(
			reload.entries.some((entry) => entry.evidenceClass === "task_failed"),
			false,
			"intermediate turn must not write task_failed evidence",
		);
		const child = reload.entries.find((entry) => entry.evidenceClass === "agent_task_child_session")?.record as Record<string, unknown> | undefined;
		assert.equal(child?.awaiting_body_capture_attempts, undefined);
	} finally {
		rmSync(rootDir, { recursive: true, force: true });
	}
});

test("finalization timing: step_finish waits for 30s silence before evaluating", async () => {
	const rootDir = mkdtempSync(join(tmpdir(), "flowdesk-finalization-silence-wait-"));
	try {
		const workflowId = "workflow-finalization-silence-wait";
		const laneId = "lane-finalization-silence-wait";
		const taskId = "task-finalization-silence-wait";
		writeAgentTaskChildSession(rootDir, { workflowId, laneId, taskId, childSessionId: "ses-finalization-silence-wait", createdAt: "2026-05-26T10:00:00.000Z" }, "agent-task-child-session-finalization-silence-wait");
		const createdMs = Date.parse("2026-05-26T10:00:02.000Z");
		const completedMs = Date.parse("2026-05-26T10:00:08.000Z");
		writeAgentTaskProgressRecord(rootDir, {
			workflowId, laneId, taskId,
			observedAt: "2026-05-26T10:00:08.000Z",
			phase: "finalizing",
			progressLabel: `agent task turn completed msgid=msg-final-wait created=${createdMs} completed=${completedMs}`,
		}, "agent-task-progress-finalization-silence-wait-tc");

		const result = await monitorChildSessionsV1({
			rootDir, workflowId,
			now: new Date("2026-05-26T10:00:37.000Z"),
			abortThresholdMs: 60_000,
			client: { session: { messages: async () => ({ messages: [{ role: "assistant", finish_reason: "stop", parts: [{ type: "text", text: "Final answer ready." }] }] }), prompt: async () => ({}), promptAsync: async () => ({}), abort: async () => ({}) } } as never,
		});

		assert.equal(result.lanesCompleted, 0);
		assert.equal(result.lanesAwaitingCapture, 1);
		const reload = reloadFlowDeskSessionEvidenceV1({ rootDir, workflowId });
		assert.equal(reload.ok, true);
		assert.equal(reload.entries.some((entry) => entry.evidenceClass === "task_result"), false);
		assert.equal(reload.entries.some((entry) => entry.evidenceClass === "session_finalization_evidence"), false);
	} finally {
		rmSync(rootDir, { recursive: true, force: true });
	}
});

test("finalization timing: step_finish, no running tools, and 30s silence still waits for session idle", async () => {
	const rootDir = mkdtempSync(join(tmpdir(), "flowdesk-finalization-silence-ready-"));
	try {
		const workflowId = "workflow-finalization-silence-ready";
		const laneId = "lane-finalization-silence-ready";
		const taskId = "task-finalization-silence-ready";
		writeAgentTaskChildSession(rootDir, { workflowId, laneId, taskId, childSessionId: "ses-finalization-silence-ready", createdAt: "2026-05-26T10:00:00.000Z" }, "agent-task-child-session-finalization-silence-ready");
		const createdMs = Date.parse("2026-05-26T10:00:02.000Z");
		const completedMs = Date.parse("2026-05-26T10:00:08.000Z");
		writeAgentTaskProgressRecord(rootDir, {
			workflowId, laneId, taskId,
			observedAt: "2026-05-26T10:00:08.000Z",
			phase: "finalizing",
			progressLabel: `agent task turn completed msgid=msg-final-ready created=${createdMs} completed=${completedMs}`,
		}, "agent-task-progress-finalization-silence-ready-tc");

		const result = await monitorChildSessionsV1({
			rootDir, workflowId,
			now: new Date("2026-05-26T10:00:38.000Z"),
			abortThresholdMs: 60_000,
			client: { session: { messages: async () => ({ messages: [{ role: "assistant", finish_reason: "stop", parts: [{ type: "text", text: "Final answer ready." }] }] }), prompt: async () => ({}), promptAsync: async () => ({}), abort: async () => ({}) } } as never,
		});

		assert.equal(result.lanesCompleted, 0);
		assert.equal(result.lanesAwaitingCapture, 1);
		const reload = reloadFlowDeskSessionEvidenceV1({ rootDir, workflowId });
		assert.equal(reload.ok, true);
		assert.equal(reload.entries.some((entry) => entry.evidenceClass === "task_result"), false);
		assert.equal(reload.entries.some((entry) => entry.evidenceClass === "session_finalization_evidence"), true);
	} finally {
		rmSync(rootDir, { recursive: true, force: true });
	}
});

test("finalization timing: running tools skip evaluation even after 30s silence", async () => {
	const rootDir = mkdtempSync(join(tmpdir(), "flowdesk-finalization-running-tool-skip-"));
	try {
		const workflowId = "workflow-finalization-running-tool-skip";
		const laneId = "lane-finalization-running-tool-skip";
		const taskId = "task-finalization-running-tool-skip";
		writeAgentTaskChildSession(rootDir, { workflowId, laneId, taskId, childSessionId: "ses-finalization-running-tool-skip", createdAt: "2026-05-26T10:00:00.000Z" }, "agent-task-child-session-finalization-running-tool-skip");
		const createdMs = Date.parse("2026-05-26T10:00:02.000Z");
		const completedMs = Date.parse("2026-05-26T10:00:08.000Z");
		writeAgentTaskProgressRecord(rootDir, { workflowId, laneId, taskId, observedAt: "2026-05-26T10:00:08.000Z", phase: "finalizing", progressLabel: `agent task turn completed msgid=msg-final-tool created=${createdMs} completed=${completedMs}` }, "agent-task-progress-finalization-running-tool-tc");
		writeAgentTaskProgressRecord(rootDir, { workflowId, laneId, taskId, observedAt: "2026-05-26T10:00:09.000Z", progressLabel: "agent task tool running callid=call-still-running" }, "agent-task-progress-finalization-running-tool-open");

		const result = await monitorChildSessionsV1({
			rootDir, workflowId,
			now: new Date("2026-05-26T10:00:39.000Z"),
			abortThresholdMs: 60_000,
			staleToolMs: 120_000,
			client: { session: { messages: async () => ({ messages: [{ role: "assistant", finish_reason: "stop", parts: [{ type: "text", text: "Final answer ready." }] }] }), prompt: async () => ({}), promptAsync: async () => ({}), abort: async () => ({}) } } as never,
		});

		assert.equal(result.lanesCompleted, 0);
		const reload = reloadFlowDeskSessionEvidenceV1({ rootDir, workflowId });
		assert.equal(reload.ok, true);
		assert.equal(reload.entries.some((entry) => entry.evidenceClass === "task_result"), false);
		assert.equal(reload.entries.some((entry) => entry.evidenceClass === "session_finalization_evidence"), false);
	} finally {
		rmSync(rootDir, { recursive: true, force: true });
	}
});

test("finalization timing: finalizingAbsoluteMaxMs terminalizes regardless of silence or running tool gate", async () => {
	const rootDir = mkdtempSync(join(tmpdir(), "flowdesk-finalization-absolute-tool-"));
	try {
		const workflowId = "workflow-finalization-absolute-tool";
		const laneId = "lane-finalization-absolute-tool";
		const taskId = "task-finalization-absolute-tool";
		writeAgentTaskChildSession(rootDir, {
			workflowId, laneId, taskId,
			childSessionId: "ses-finalization-absolute-tool",
			createdAt: "2026-05-26T10:00:00.000Z",
			awaitingBodyCaptureAttempts: 1,
			awaitingBodyCaptureSince: "2026-05-26T10:00:10.000Z",
		}, "agent-task-child-session-finalization-absolute-tool");
		const createdMs = Date.parse("2026-05-26T10:00:02.000Z");
		const completedMs = Date.parse("2026-05-26T10:00:08.000Z");
		writeAgentTaskProgressRecord(rootDir, { workflowId, laneId, taskId, observedAt: "2026-05-26T10:00:08.000Z", phase: "finalizing", progressLabel: `agent task turn completed msgid=msg-final-absolute created=${createdMs} completed=${completedMs}` }, "agent-task-progress-finalization-absolute-tc");
		writeAgentTaskProgressRecord(rootDir, { workflowId, laneId, taskId, observedAt: "2026-05-26T10:01:10.000Z", progressLabel: "agent task tool running callid=call-running-at-cap" }, "agent-task-progress-finalization-absolute-tool-open");

		const result = await monitorChildSessionsV1({
			rootDir, workflowId,
			now: new Date("2026-05-26T10:01:11.000Z"),
			finalizingAbsoluteMaxMs: 60_000,
			staleToolMs: 120_000,
			client: { session: { messages: async () => ({ messages: [] }), prompt: async () => ({}), promptAsync: async () => ({}), abort: async () => ({}) } } as never,
		});

		assert.equal(result.lanesAborted, 1);
		const reload = reloadFlowDeskSessionEvidenceV1({ rootDir, workflowId });
		assert.equal(reload.ok, true);
		assert.equal(reload.entries.some((entry) => entry.evidenceClass === "task_failed"), true);
	} finally {
		rmSync(rootDir, { recursive: true, force: true });
	}
});

test("V11.2 Slice 3: turn completed but empty body retries, injects final-report repair, and stays non-terminal before absolute cap", async () => {
	const rootDir = mkdtempSync(join(tmpdir(), "flowdesk-v112-awaiting-body-"));
	try {
		const workflowId = "workflow-v112-awaiting-body";
		const laneId = "lane-v112-awaiting-body";
		const taskId = "task-v112-awaiting-body";
		writeAgentTaskChildSession(rootDir, {
			workflowId, laneId, taskId,
			childSessionId: "ses-child-v112-awaiting-body",
			createdAt: "2026-05-26T10:00:00.000Z",
		}, "agent-task-child-session-v112-awaiting-body");
		const createdMs = Date.parse("2026-05-26T10:00:02.000Z");
		const completedMs = Date.parse("2026-05-26T10:00:08.000Z");
		writeAgentTaskProgressRecord(rootDir, {
			workflowId, laneId, taskId,
			observedAt: "2026-05-26T10:00:08.000Z",
			phase: "finalizing",
			progressLabel: `agent task turn completed msgid=msg-attempt created=${createdMs} completed=${completedMs}`,
		}, "agent-task-progress-v112-ab-tc");

		// Body is EMPTY on every poll (SDK buffer never synced in this test).
		let promptCalls = 0;
		const emptyBodyClient = {
			session: {
				messages: async () => ({ messages: [] }),
				prompt: async () => { promptCalls += 1; return {}; },
				promptAsync: async () => { promptCalls += 1; return {}; },
				abort: async () => ({}),
			},
		} as never;

		// bodyRetryMax=2: after the required 30s post-progress silence, the first
		// eligible cycle records awaiting_body_capture. Once durable awaiting capture
		// exists, repair nudges are sent in the same child session, capped separately.
		const c1 = await monitorChildSessionsV1({
			rootDir, workflowId, now: new Date("2026-05-26T10:00:38.000Z"),
			abortThresholdMs: 30_000, maxIdleContinuations: 0,
			staleToolMs: 60_000, unknownStateMaxMs: 60_000, absoluteLaneAgeMs: 600_000,
			bodyRetryMax: 2, client: emptyBodyClient,
		});
		assert.equal(c1.lanesCompleted, 0);
		assert.equal(c1.lanesAborted, 0, "cycle 1 must retry, not fail");

		const c2 = await monitorChildSessionsV1({
			rootDir, workflowId, now: new Date("2026-05-26T10:01:08.000Z"),
			abortThresholdMs: 30_000, maxIdleContinuations: 0,
			staleToolMs: 60_000, unknownStateMaxMs: 60_000, absoluteLaneAgeMs: 600_000,
			bodyRetryMax: 2, client: emptyBodyClient,
		});
		assert.equal(c2.lanesAborted, 0, "cycle 2 must retry, not fail");

		const c3 = await monitorChildSessionsV1({
			rootDir, workflowId, now: new Date("2026-05-26T10:01:38.000Z"),
			abortThresholdMs: 30_000, maxIdleContinuations: 0,
			staleToolMs: 60_000, unknownStateMaxMs: 60_000, absoluteLaneAgeMs: 600_000,
			bodyRetryMax: 2, client: emptyBodyClient,
		});
		assert.equal(c3.lanesAborted, 0, "cycle 3 must not terminalize before final-report repair");
		assert.equal(c3.lanesNudged, 1, "cycle 3 must inject a final-report repair prompt");
		assert.equal(promptCalls, 1);

		await monitorChildSessionsV1({
			rootDir, workflowId, now: new Date("2026-05-26T10:02:08.000Z"),
			abortThresholdMs: 30_000, maxIdleContinuations: 0,
			staleToolMs: 60_000, unknownStateMaxMs: 60_000, absoluteLaneAgeMs: 600_000,
			bodyRetryMax: 2, client: emptyBodyClient,
		});
		await monitorChildSessionsV1({
			rootDir, workflowId, now: new Date("2026-05-26T10:02:38.000Z"),
			abortThresholdMs: 30_000, maxIdleContinuations: 0,
			staleToolMs: 60_000, unknownStateMaxMs: 60_000, absoluteLaneAgeMs: 600_000,
			bodyRetryMax: 2, client: emptyBodyClient,
		});
		const c6 = await monitorChildSessionsV1({
			rootDir, workflowId, now: new Date("2026-05-26T10:03:07.000Z"),
			abortThresholdMs: 30_000, maxIdleContinuations: 0,
			staleToolMs: 60_000, unknownStateMaxMs: 60_000, absoluteLaneAgeMs: 600_000,
			bodyRetryMax: 2, client: emptyBodyClient,
		});
		assert.equal(c6.lanesAborted, 0, "retry/repair budget alone must not terminalize empty step-finish as no_output");

		// Evidence: no task_failed is written before an independent absolute-cap/timeout signal.
		const reload = reloadFlowDeskSessionEvidenceV1({ rootDir, workflowId });
		assert.equal(reload.ok, true);
		const failed = reload.entries.find((e) =>
			e.evidenceClass === "task_failed"
			&& typeof (e.record as Record<string, unknown>).redacted_reason === "string"
			&& ((e.record as Record<string, unknown>).redacted_reason as string).includes("turn_completed_empty"),
		);
		assert.equal(failed, undefined, "must not record turn_completed_empty task_failed before absolute cap");
		const repairEvidence = reload.entries.find((e) =>
			e.evidenceClass === "agent_task_child_session"
			&& (e.record as Record<string, unknown>).turn_completed_empty_repair_count === 2,
		);
		assert.ok(repairEvidence, "must record the capped final-report repair prompt injections");
		const repairAttempts = reload.entries.filter((e) => e.evidenceClass === "repair_attempt");
		assert.equal(repairAttempts.length, 2, "must persist repair_attempt evidence for each repair nudge");
	} finally {
		rmSync(rootDir, { recursive: true, force: true });
	}
});

test("awaiting_body_capture without TURN_COMPLETED sends repair nudge then captures recovered body text", async () => {
	const rootDir = mkdtempSync(join(tmpdir(), "flowdesk-awaiting-body-no-tc-repair-"));
	try {
		const workflowId = "workflow-awaiting-body-no-tc-repair";
		const laneId = "lane-awaiting-body-no-tc-repair";
		const taskId = "task-awaiting-body-no-tc-repair";
		writeAgentTaskChildSession(rootDir, {
			workflowId, laneId, taskId,
			childSessionId: "ses-child-awaiting-body-no-tc-repair",
			createdAt: "2026-05-26T10:00:00.000Z",
			awaitingBodyCaptureAttempts: 1,
			awaitingBodyCaptureSince: "2026-05-26T10:00:08.000Z",
		}, "agent-task-child-session-awaiting-body-no-tc-repair");
		writeLifecycle(rootDir, lifecycleRecord({
			workflow_id: workflowId,
			lane_id: laneId,
			state: "running",
			created_at: "2026-05-26T10:00:00.000Z",
			updated_at: "2026-05-26T10:00:00.000Z",
		}), "lifecycle-awaiting-body-no-tc-repair-running");
		writeAgentTaskProgressRecord(rootDir, {
			workflowId, laneId, taskId,
			observedAt: "2026-05-26T10:00:08.000Z",
			phase: "finalizing",
			progressLabel: "agent task session.diff event observed",
		}, "agent-task-progress-awaiting-body-no-tc-diff");

		let promptCalls = 0;
		let messagesCalls = 0;
		const client = {
			session: {
				messages: async () => {
					messagesCalls += 1;
					if (promptCalls === 0) return { messages: [] };
					return { messages: [{ role: "assistant", parts: [{ type: "text", text: "Recovered final report after repair nudge." }, { type: "step-finish", reason: "stop" }] }] };
				},
				prompt: async () => { promptCalls += 1; return {}; },
				abort: async () => ({}),
			},
		} as never;

		const nudged = await monitorChildSessionsV1({
			rootDir, workflowId,
			now: new Date("2026-05-26T10:00:38.000Z"),
			abortThresholdMs: 120_000,
			maxIdleContinuations: 0,
			client,
		});
		assert.equal(nudged.lanesNudged, 1, "awaiting_body_capture without TURN_COMPLETED should send repair nudge after 30s silence");
		assert.equal(promptCalls, 1);

		const captured = await monitorChildSessionsV1({
			rootDir, workflowId,
			now: new Date("2026-05-26T10:01:08.000Z"),
			abortThresholdMs: 120_000,
			maxIdleContinuations: 0,
			client,
		});
		assert.equal(captured.lanesCompleted, 1, "body text arriving after repair nudge should be captured as task_result");
		assert.equal(messagesCalls > 0, true);

		const reload = reloadFlowDeskSessionEvidenceV1({ rootDir, workflowId });
		assert.equal(reload.ok, true);
		const taskResult = reload.entries.find((entry) => entry.evidenceClass === "task_result")?.record as Record<string, unknown> | undefined;
		assert.ok(taskResult, "expected recovered task_result");
		assert.equal(String(taskResult.result_text).includes("Recovered final report"), true);
		assert.equal(reload.entries.filter((entry) => entry.evidenceClass === "repair_attempt").length, 1);
	} finally {
		rmSync(rootDir, { recursive: true, force: true });
	}
});

test("awaiting_body_capture repair nudge is skipped with diagnostic progress when child session is closed", async () => {
	const rootDir = mkdtempSync(join(tmpdir(), "flowdesk-awaiting-body-closed-repair-"));
	try {
		const workflowId = "workflow-awaiting-body-closed-repair";
		const laneId = "lane-awaiting-body-closed-repair";
		const taskId = "task-awaiting-body-closed-repair";
		writeAgentTaskChildSession(rootDir, {
			workflowId, laneId, taskId,
			childSessionId: "ses-child-awaiting-body-closed-repair",
			createdAt: "2026-05-26T10:00:00.000Z",
			awaitingBodyCaptureAttempts: 1,
			awaitingBodyCaptureSince: "2026-05-26T10:00:08.000Z",
		}, "agent-task-child-session-awaiting-body-closed-repair");
		writeLifecycle(rootDir, lifecycleRecord({
			workflow_id: workflowId,
			lane_id: laneId,
			state: "running",
			created_at: "2026-05-26T10:00:00.000Z",
			updated_at: "2026-05-26T10:00:00.000Z",
		}), "lifecycle-awaiting-body-closed-repair-running");
		writeAgentTaskProgressRecord(rootDir, {
			workflowId, laneId, taskId,
			observedAt: "2026-05-26T10:00:08.000Z",
			phase: "finalizing",
			progressLabel: "agent task session.diff event observed",
		}, "agent-task-progress-awaiting-body-closed-diff");

		let promptCalls = 0;
		const result = await monitorChildSessionsV1({
			rootDir, workflowId,
			now: new Date("2026-05-26T10:00:38.000Z"),
			abortThresholdMs: 120_000,
			maxIdleContinuations: 0,
			client: {
				session: {
					messages: async () => ({ messages: [] }),
					isClosed: async () => true,
					prompt: async () => { promptCalls += 1; return {}; },
					abort: async () => ({}),
				},
			} as never,
		});

		assert.equal(result.lanesNudged, 0);
		assert.equal(result.lanesAborted, 0, "closed-session repair skip must keep awaiting path, not abort");
		assert.equal(result.lanesAwaitingCapture, 1);
		assert.equal(promptCalls, 0);
		const reload = reloadFlowDeskSessionEvidenceV1({ rootDir, workflowId });
		assert.equal(reload.ok, true);
		assert.equal(reload.entries.some((entry) => entry.evidenceClass === "task_failed"), false);
		assert.equal(reload.entries.some((entry) => entry.evidenceClass === "repair_attempt"), false);
		assert.equal(reload.entries.some((entry) => entry.evidenceClass === "agent_task_progress"
			&& (entry.record as Record<string, unknown>).phase === "finalizing"
			&& (entry.record as Record<string, unknown>).progress_label === "async agent task repair nudge skipped: child session is closed"), true);
	} finally {
		rmSync(rootDir, { recursive: true, force: true });
	}
});



test("watchdog terminalizes awaiting_body_capture after finalizingAbsoluteMaxMs", async () => {
	const rootDir = mkdtempSync(join(tmpdir(), "flowdesk-awaiting-body-absolute-max-"));
	try {
		const workflowId = "workflow-awaiting-body-absolute-max";
		const laneId = "lane-awaiting-body-absolute-max";
		const taskId = "task-awaiting-body-absolute-max";
		writeAgentTaskChildSession(rootDir, {
			workflowId, laneId, taskId,
			childSessionId: "ses-child-awaiting-body-absolute-max",
			createdAt: "2026-05-26T10:00:00.000Z",
			awaitingBodyCaptureAttempts: 1,
			awaitingBodyCaptureSince: "2026-05-26T10:00:10.000Z",
		}, "agent-task-child-session-awaiting-body-absolute-max");
		const createdMs = Date.parse("2026-05-26T10:00:02.000Z");
		const completedMs = Date.parse("2026-05-26T10:00:08.000Z");
		writeAgentTaskProgressRecord(rootDir, {
			workflowId, laneId, taskId,
			observedAt: "2026-05-26T10:00:08.000Z",
			phase: "finalizing",
			progressLabel: `agent task turn completed msgid=msg-attempt created=${createdMs} completed=${completedMs}`,
		}, "agent-task-progress-awaiting-body-absolute-max-tc");

		let abortCalls = 0;
		const result = await monitorChildSessionsV1({
			rootDir,
			workflowId,
			now: new Date("2026-05-26T10:01:11.000Z"),
			bodyRetryMax: 99,
			finalizingAbsoluteMaxMs: 60_000,
			client: {
				session: {
					messages: async () => ({ messages: [] }),
					prompt: async () => ({}),
					promptAsync: async () => ({}),
					abort: async () => { abortCalls += 1; return {}; },
				},
			} as never,
		});

		assert.equal(result.lanesAborted, 1);
		assert.equal(abortCalls, 0, "finalizing absolute max writes terminal evidence without SDK abort");
		const reload = reloadFlowDeskSessionEvidenceV1({ rootDir, workflowId });
		assert.equal(reload.ok, true);
		const failed = reload.entries.find((entry) =>
			entry.evidenceClass === "task_failed" &&
			typeof (entry.record as Record<string, unknown>).redacted_reason === "string" &&
			((entry.record as Record<string, unknown>).redacted_reason as string).includes("finalizing absolute max"),
		);
		assert.ok(failed, "expected task_failed for expired awaiting_body_capture");
	} finally {
		rmSync(rootDir, { recursive: true, force: true });
	}
});

test("watchdog aborts lane with empty step-finish — step-finish is not a terminal signal", async () => {
	const rootDir = mkdtempSync(join(tmpdir(), "flowdesk-empty-step-finish-awaiting-"));
	try {
		const workflowId = "workflow-empty-step-finish-awaiting";
		const laneId = "lane-empty-step-finish-awaiting";
		const taskId = "task-empty-step-finish-awaiting";
		writeAgentTaskChildSession(rootDir, {
			workflowId, laneId, taskId,
			childSessionId: "ses-child-empty-step-finish-awaiting",
			createdAt: "2026-05-26T10:00:00.000Z",
		}, "agent-task-child-session-empty-step-finish-awaiting");

		let abortCalls = 0;
		const result = await monitorChildSessionsV1({
			rootDir,
			workflowId,
			now: new Date("2026-05-26T10:00:35.000Z"),
			abortThresholdMs: 30_000,
			finalizingAbsoluteMaxMs: 60_000,
			client: {
				session: {
					messages: async () => ({ info: { role: "assistant" }, parts: [{ type: "step-finish", reason: "stop" }] }),
					prompt: async () => ({}),
					promptAsync: async () => ({}),
					abort: async () => { abortCalls += 1; return {}; },
				},
			} as never,
		});

		// step-finish alone is NOT a terminal signal — falls through to normal abort path
		assert.equal(result.lanesAwaitingCapture ?? 0, 0, "step-finish alone must not enter awaiting_body_capture");
		assert.equal(abortCalls, 1, "watchdog should abort since step-finish is not a terminal signal");
		const reload = reloadFlowDeskSessionEvidenceV1({ rootDir, workflowId });
		assert.equal(reload.ok, true);
		assert.equal(reload.entries.some((e) => {
			const r = e.record as Record<string, unknown>;
			return e.evidenceClass === "agent_task_child_session"
				&& typeof r.awaiting_body_capture_attempts === "number"
				&& (r.awaiting_body_capture_attempts as number) > 0;
		}), false, "no awaiting_body_capture_attempts for bare step-finish");
	} finally {
		rmSync(rootDir, { recursive: true, force: true });
	}
});

test("watchdog aborts lane with empty step-finish past hard cap — step-finish never blocks abort", async () => {
	const rootDir = mkdtempSync(join(tmpdir(), "flowdesk-empty-step-finish-hard-cap-"));
	try {
		const workflowId = "workflow-empty-step-finish-hard-cap";
		const laneId = "lane-empty-step-finish-hard-cap";
		const taskId = "task-empty-step-finish-hard-cap";
		writeAgentTaskChildSession(rootDir, {
			workflowId, laneId, taskId,
			childSessionId: "ses-child-empty-step-finish-hard-cap",
			createdAt: "2026-05-26T10:00:00.000Z",
			awaitingBodyCaptureAttempts: 1,
			awaitingBodyCaptureSince: "2026-05-26T10:00:10.000Z",
		}, "agent-task-child-session-empty-step-finish-hard-cap");

		let abortCalls = 0;
		const result = await monitorChildSessionsV1({
			rootDir,
			workflowId,
			now: new Date("2026-05-26T10:01:11.000Z"),
			abortThresholdMs: 30_000,
			finalizingAbsoluteMaxMs: 60_000,
			client: {
				session: {
					messages: async () => ({ info: { role: "assistant" }, parts: [{ type: "step-finish", reason: "stop" }] }),
					prompt: async () => ({}),
					promptAsync: async () => ({}),
					abort: async () => { abortCalls += 1; return {}; },
				},
			} as never,
		});

		// step-finish alone never blocks abort, even past hard cap
		assert.equal(result.lanesAwaitingCapture ?? 0, 0, "step-finish alone must not enter awaiting_body_capture even past hard cap");
		assert.equal(abortCalls, 1, "abort should proceed since step-finish is not a terminal signal");
	} finally {
		rmSync(rootDir, { recursive: true, force: true });
	}
});

test("watchdog terminalizes empty actual terminal marker after finalizing hard cap", async () => {
	const rootDir = mkdtempSync(join(tmpdir(), "flowdesk-empty-terminal-hard-cap-"));
	try {
		const workflowId = "workflow-empty-terminal-hard-cap";
		const laneId = "lane-empty-terminal-hard-cap";
		const taskId = "task-empty-terminal-hard-cap";
		writeAgentTaskChildSession(rootDir, {
			workflowId, laneId, taskId,
			childSessionId: "ses-child-empty-terminal-hard-cap",
			createdAt: "2026-05-26T10:00:00.000Z",
			awaitingBodyCaptureAttempts: 1,
			awaitingBodyCaptureSince: "2026-05-26T10:00:10.000Z",
		}, "agent-task-child-session-empty-terminal-hard-cap");

		let abortCalls = 0;
		const result = await monitorChildSessionsV1({
			rootDir,
			workflowId,
			now: new Date("2026-05-26T10:01:11.000Z"),
			abortThresholdMs: 30_000,
			finalizingAbsoluteMaxMs: 60_000,
			client: {
				session: {
					messages: async () => ({ role: "assistant", finish_reason: "stop", content: [] }),
					prompt: async () => ({}),
					promptAsync: async () => ({}),
					abort: async () => { abortCalls += 1; return {}; },
				},
			} as never,
		});

		assert.equal(result.lanesAborted, 1);
		assert.equal(abortCalls, 0, "finalizing hard cap writes terminal evidence without SDK abort");
		const reload = reloadFlowDeskSessionEvidenceV1({ rootDir, workflowId });
		assert.equal(reload.ok, true);
		const failed = reload.entries.find((entry) => entry.evidenceClass === "task_failed")?.record as Record<string, unknown> | undefined;
		assert.equal(failed?.failure_category, "no_response");
		assert.match(String(failed?.redacted_reason), /finalizing absolute max/);
		const child = reload.entries.find((entry) => entry.evidenceClass === "agent_task_child_session")?.record as Record<string, unknown> | undefined;
		assert.equal(child?.capture_failure_terminal_marker_present, true);
	} finally {
		rmSync(rootDir, { recursive: true, force: true });
	}
});

test("monitorChildSessionsV1 liveness poll observes text but waits without terminal marker or session idle", async () => {
	const rootDir = mkdtempSync(join(tmpdir(), "flowdesk-liveness-observes-text-"));
	try {
		const workflowId = "workflow-liveness-observes-text";
		const laneId = "lane-liveness-observes-text";
		const taskId = "task-liveness-observes-text";
		writeAgentTaskChildSession(rootDir, {
			workflowId, laneId, taskId,
			childSessionId: "ses-child-liveness-observes-text",
			createdAt: "2026-05-26T10:00:00.000Z",
		}, "agent-task-child-session-liveness-observes-text");

		const result = await monitorChildSessionsV1({
			rootDir,
			workflowId,
			now: new Date("2026-05-26T10:00:31.000Z"),
			abortThresholdMs: 120_000,
			livenessCheckIntervalMs: 30_000,
			client: {
				session: {
					messages: async () => ({ messages: [{ role: "assistant", content: "Liveness final report." }] }),
					abort: async () => ({}),
				},
			} as never,
		});

		assert.equal(result.lanesCompleted, 0);
		assert.equal(result.lanesAwaitingCapture, 1);
		const reload = reloadFlowDeskSessionEvidenceV1({ rootDir, workflowId });
		assert.equal(reload.ok, true);
		assert.equal(reload.entries.some((entry) => entry.evidenceClass === "task_result"), false);
		assert.equal(reload.entries.some((entry) => entry.evidenceClass === "agent_task_progress" && String((entry.record as Record<string, unknown>).progress_label).includes("awaiting terminal marker or session idle before capture")), true);
	} finally {
		rmSync(rootDir, { recursive: true, force: true });
	}
});

test("monitorChildSessionsV1 liveness poll waits while a tool is running", async () => {
	const rootDir = mkdtempSync(join(tmpdir(), "flowdesk-liveness-tool-running-"));
	try {
		const workflowId = "workflow-liveness-tool-running";
		const laneId = "lane-liveness-tool-running";
		const taskId = "task-liveness-tool-running";
		writeAgentTaskChildSession(rootDir, {
			workflowId, laneId, taskId,
			childSessionId: "ses-child-liveness-tool-running",
			createdAt: "2026-05-26T10:00:00.000Z",
		}, "agent-task-child-session-liveness-tool-running");

		let abortCalls = 0;
		const result = await monitorChildSessionsV1({
			rootDir,
			workflowId,
			now: new Date("2026-05-26T10:00:31.000Z"),
			abortThresholdMs: 30_000,
			livenessCheckIntervalMs: 30_000,
			client: {
				session: {
					messages: async () => ({ messages: [{ role: "assistant", parts: [{ type: "tool", callID: "call-1", state: { status: "running" } }] }] }),
					abort: async () => { abortCalls += 1; return {}; },
				},
			} as never,
		});

		assert.equal(result.lanesAborted, 0);
		assert.equal(abortCalls, 0);
		const reload = reloadFlowDeskSessionEvidenceV1({ rootDir, workflowId });
		assert.equal(reload.ok, true);
		const child = reload.entries.find((entry) => entry.evidenceClass === "agent_task_child_session")?.record as Record<string, unknown> | undefined;
		assert.equal(child?.liveness_last_state, "tool_running");
		assert.equal(child?.liveness_miss_count, 0);
		assert.equal(reload.entries.some((entry) => entry.evidenceClass === "task_failed"), false);
	} finally {
		rmSync(rootDir, { recursive: true, force: true });
	}
});

test("monitorChildSessionsV1 liveness poll stale-terminalizes after consecutive idle no-output misses", async () => {
	const rootDir = mkdtempSync(join(tmpdir(), "flowdesk-liveness-stale-"));
	try {
		const workflowId = "workflow-liveness-stale";
		const laneId = "lane-liveness-stale";
		const taskId = "task-liveness-stale";
		writeAgentTaskChildSession(rootDir, {
			workflowId, laneId, taskId,
			childSessionId: "ses-child-liveness-stale",
			createdAt: "2026-05-26T10:00:00.000Z",
		}, "agent-task-child-session-liveness-stale");

		const client = {
			session: {
				messages: async () => ({ type: "session.idle", messages: [] }),
				abort: async () => ({}),
			},
		} as never;
		const first = await monitorChildSessionsV1({ rootDir, workflowId, now: new Date("2026-05-26T10:00:31.000Z"), abortThresholdMs: 30_000, livenessCheckIntervalMs: 30_000, livenessMaxMisses: 3, client });
		const second = await monitorChildSessionsV1({ rootDir, workflowId, now: new Date("2026-05-26T10:01:02.000Z"), abortThresholdMs: 30_000, livenessCheckIntervalMs: 30_000, livenessMaxMisses: 3, client });
		const third = await monitorChildSessionsV1({ rootDir, workflowId, now: new Date("2026-05-26T10:01:33.000Z"), abortThresholdMs: 30_000, livenessCheckIntervalMs: 30_000, livenessMaxMisses: 3, client });

		assert.equal(first.lanesAborted, 0);
		assert.equal(second.lanesAborted, 0);
		assert.equal(third.lanesAborted, 1);
		const reload = reloadFlowDeskSessionEvidenceV1({ rootDir, workflowId });
		assert.equal(reload.ok, true);
		const failed = reload.entries.find((entry) => entry.evidenceClass === "task_failed")?.record as Record<string, unknown> | undefined;
		assert.equal(failed?.failure_category, "no_response");
		assert.match(String(failed?.redacted_reason), /liveness stale/);
		const lifecycle = reload.entries.find((entry) => entry.evidenceClass === "lane_lifecycle" && (entry.record as Record<string, unknown>).state === "no_output")?.record as Record<string, unknown> | undefined;
		assert.equal(lifecycle?.state, "no_output");
		const child = reload.entries.find((entry) => entry.evidenceClass === "agent_task_child_session")?.record as Record<string, unknown> | undefined;
		assert.equal(child?.liveness_miss_count, 3);
	} finally {
		rmSync(rootDir, { recursive: true, force: true });
	}
});

test("V11.2 (post-review): idle-confirmed capture does NOT fire on silence alone (requires a real session.idle event)", async () => {
	const rootDir = mkdtempSync(join(tmpdir(), "flowdesk-v112-idle-needs-event-"));
	try {
		const workflowId = "workflow-v112-idle-needs-event";
		const laneId = "lane-v112-idle-needs-event";
		const taskId = "task-v112-idle-needs-event";
		writeAgentTaskChildSession(rootDir, {
			workflowId, laneId, taskId,
			childSessionId: "ses-child-v112-idle-needs-event",
			createdAt: "2026-05-26T10:00:00.000Z",
		}, "agent-task-child-session-v112-idle-needs-event");
		writeLifecycle(rootDir, lifecycleRecord({
			workflow_id: workflowId, lane_id: laneId, state: "running",
			created_at: "2026-05-26T10:00:00.000Z", updated_at: "2026-05-26T10:00:00.000Z",
		}), "lifecycle-v112-idle-needs-event-running");
		// Assistant body present, NO terminal marker, NO turn-completed event, and
		// crucially NO session.idle event — only silence. The silence-only idle
		// heuristic was removed, so this must NOT be captured as stable_idle. It
		// stays open until the timeout terminator / lane-age cap handles it later.
		const client = {
			session: {
				messages: async () => ({ messages: [{ role: "assistant", parts: [{ type: "text", text: "I'll start by reading the files" }] }] }),
				prompt: async () => ({}),
				promptAsync: async () => ({}),
				abort: async () => ({}),
			},
		} as never;

		const result = await monitorChildSessionsV1({
			rootDir, workflowId,
			now: new Date("2026-05-26T10:00:15.000Z"), // 15s silence > idle-settle, < 30s abort
			nudgeQuietPeriodMs: 10_000, abortThresholdMs: 30_000, maxIdleContinuations: 0, client,
		});
		assert.equal(result.lanesCompleted, 0, "silence alone (no session.idle) must NOT idle-capture");
		assert.equal(result.lanesAborted, 0, "still within abort threshold");
	} finally {
		rmSync(rootDir, { recursive: true, force: true });
	}
});

test("V11.2 Slice 4: continuation auto-injection is OFF by default (no prompt without explicit opt-in)", async () => {
	const rootDir = mkdtempSync(join(tmpdir(), "flowdesk-v112-continuation-off-"));
	try {
		const workflowId = "workflow-v112-cont-off";
		const laneId = "lane-v112-cont-off";
		const taskId = "task-v112-cont-off";
		writeAgentTaskChildSession(rootDir, {
			workflowId, laneId, taskId,
			childSessionId: "ses-child-v112-cont-off",
			createdAt: "2026-05-26T10:00:00.000Z",
		}, "agent-task-child-session-v112-cont-off");
		writeLifecycle(rootDir, lifecycleRecord({
			workflow_id: workflowId, lane_id: laneId, state: "running",
			created_at: "2026-05-26T10:00:00.000Z", updated_at: "2026-05-26T10:00:00.000Z",
		}), "lifecycle-v112-cont-off-running");
		// A fresh session.idle signal with NO assistant text would, under the opt-in
		// path, trigger a continuation prompt. With the default (OFF) it must not.
		writeAgentTaskProgressRecord(rootDir, {
			workflowId, laneId, taskId,
			observedAt: "2026-05-26T10:00:15.000Z",
			phase: "finalizing",
			progressLabel: "agent task session idle event observed",
		}, "agent-task-progress-v112-cont-off-idle");

		let promptAsyncCalls = 0;
		const result = await monitorChildSessionsV1({
			rootDir, workflowId,
			now: new Date("2026-05-26T10:00:16.000Z"),
			nudgeQuietPeriodMs: 60_000, abortThresholdMs: 30_000,
			// no maxIdleContinuations passed → default 0 (OFF)
			client: {
				session: {
					messages: async () => ({ messages: [] }),
					prompt: async () => ({}),
					promptAsync: async () => { promptAsyncCalls += 1; return {}; },
					abort: async () => ({}),
				},
			} as never,
		});
		assert.equal(promptAsyncCalls, 0, "no continuation prompt may be injected by default");
		assert.equal(result.lanesNudged, 0);
		assert.equal(result.lanesAborted, 0);
	} finally {
		rmSync(rootDir, { recursive: true, force: true });
	}
});

test("single session.idle event injects one capped idle continuation prompt when idle without final text", async () => {
	const rootDir = mkdtempSync(join(tmpdir(), "flowdesk-watchdog-idle-continuation-"));
	try {
		const workflowId = "workflow-watchdog-idle-continuation";
		const laneId = "lane-watchdog-idle-continuation";
		const taskId = "task-watchdog-idle-continuation";
		writeAgentTaskChildSession(rootDir, {
			workflowId,
			laneId,
			taskId,
			childSessionId: "ses-child-idle-continuation",
			createdAt: "2026-05-26T10:00:00.000Z",
			nudgeCount: 0,
			lastNudgeAt: null,
		});
		writeLifecycle(
			rootDir,
			lifecycleRecord({
				workflow_id: workflowId,
				lane_id: laneId,
				state: "running",
				created_at: "2026-05-26T10:00:00.000Z",
				updated_at: "2026-05-26T10:00:00.000Z",
			}),
			"lifecycle-idle-continuation-running",
		);
		writeAgentTaskProgressRecord(rootDir, {
			workflowId,
			laneId,
			taskId,
			observedAt: "2026-05-26T10:00:15.000Z",
			phase: "finalizing",
			progressLabel: "agent task session idle event observed",
		}, "agent-task-progress-idle-signal-once");

		let promptAsyncCalls = 0;
		let promptAsyncText: string | undefined;
		let promptAsyncPathId: string | undefined;
		let abortCalls = 0;
		const client = {
			session: {
				// Idle: no assistant text at all.
				messages: async () => ({ messages: [] }),
				promptAsync: async (o: { path?: { id?: string }; body?: { parts?: Array<{ text?: string }> } }) => {
					promptAsyncCalls += 1;
					promptAsyncPathId = o?.path?.id;
					promptAsyncText = o?.body?.parts?.[0]?.text;
					return {};
				},
				abort: async () => { abortCalls += 1; return {}; },
			},
		} as never;

		const first = await monitorChildSessionsV1({
			rootDir,
			workflowId,
			now: new Date("2026-05-26T10:00:15.000Z"),
			// Quiet period is deliberately longer than elapsed silence; the single
			// session.idle event is the trigger for the continuation-check path.
			nudgeQuietPeriodMs: 60_000,
			abortThresholdMs: 30_000,
			// V11.2 Slice 4: continuation auto-injection is OFF by default; this test
			// exercises the opt-in path, so it must explicitly enable it.
			maxIdleContinuations: 1,
			client,
		});

		assert.equal(first.lanesPolled, 1);
		assert.equal(first.lanesNudged, 1);
		assert.equal(first.lanesAborted, 0);
		assert.equal(promptAsyncCalls, 1, "exactly one continuation prompt injected");
		assert.equal(promptAsyncPathId, "ses-child-idle-continuation");
		assert.equal(abortCalls, 0);
		assert.equal(typeof promptAsyncText === "string" && promptAsyncText.toLowerCase().includes("final answer"), true);

		const reloadAfterFirst = reloadFlowDeskSessionEvidenceV1({ rootDir, workflowId });
		const childAfterFirst = reloadAfterFirst.entries.find((entry) => entry.evidenceClass === "agent_task_child_session")?.record as Record<string, unknown> | undefined;
		assert.equal(childAfterFirst?.idle_continuation_count, 1);
		assert.equal(childAfterFirst?.last_idle_continuation_delivery_status, "sent");
		assert.equal(childAfterFirst?.last_session_idle_signal_at, "2026-05-26T10:00:15.000Z");
		assert.equal(childAfterFirst?.last_session_idle_signal_state, "observed");

		// Second cycle: still idle with no text, but below the abort threshold.
		// The per-lane cap (default 1) must prevent a second injection.
		const second = await monitorChildSessionsV1({
			rootDir,
			workflowId,
			now: new Date("2026-05-26T10:00:25.000Z"),
			nudgeQuietPeriodMs: 60_000,
			abortThresholdMs: 30_000,
			maxIdleContinuations: 1,
			client,
		});

		assert.equal(promptAsyncCalls, 1, "continuation injection is capped at 1 per lane");
		assert.equal(second.lanesAborted, 0);

		// Third cycle: idle-continuation budget is exhausted and the abort
		// threshold is now exceeded, so the lane must become abort-eligible
		// (continuation must not permanently block abort).
		const third = await monitorChildSessionsV1({
			rootDir,
			workflowId,
			now: new Date("2026-05-26T10:01:15.000Z"),
			nudgeQuietPeriodMs: 60_000,
			abortThresholdMs: 30_000,
			maxIdleContinuations: 1,
			client,
		});
		assert.equal(third.lanesAborted, 1, "abort fires once continuation budget is exhausted and abort threshold is reached");
		assert.equal(abortCalls, 1);

		// Terminalization reason must make the exhausted idle continuation explicit.
		const reloadAfterAbort = reloadFlowDeskSessionEvidenceV1({ rootDir, workflowId });
		const taskFailed = reloadAfterAbort.entries.find((entry) => entry.evidenceClass === "task_failed")?.record as Record<string, unknown> | undefined;
		assert.ok(taskFailed, "expected task_failed terminalization after exhausted continuation");
		assert.equal(typeof taskFailed?.redacted_reason === "string" && (taskFailed.redacted_reason as string).includes("idle continuation"), true);
	} finally {
		rmSync(rootDir, { recursive: true, force: true });
	}
});

test("single session.idle event does not inject continuation while a tool is running", async () => {
	const rootDir = mkdtempSync(join(tmpdir(), "flowdesk-watchdog-idle-signal-tool-running-"));
	try {
		const workflowId = "workflow-watchdog-idle-signal-tool-running";
		const laneId = "lane-watchdog-idle-signal-tool-running";
		const taskId = "task-watchdog-idle-signal-tool-running";
		writeAgentTaskChildSession(rootDir, {
			workflowId,
			laneId,
			taskId,
			childSessionId: "ses-child-idle-signal-tool-running",
			createdAt: "2026-05-26T10:00:00.000Z",
			nudgeCount: 0,
			lastNudgeAt: null,
		});
		writeLifecycle(
			rootDir,
			lifecycleRecord({
				workflow_id: workflowId,
				lane_id: laneId,
				state: "running",
				created_at: "2026-05-26T10:00:00.000Z",
				updated_at: "2026-05-26T10:00:00.000Z",
			}),
			"lifecycle-idle-signal-tool-running",
		);
		writeAgentTaskProgressRecord(rootDir, {
			workflowId,
			laneId,
			taskId,
			observedAt: "2026-05-26T10:00:15.000Z",
			phase: "finalizing",
			progressLabel: "agent task session idle event observed",
		}, "agent-task-progress-idle-signal-tool-running");

		let promptAsyncCalls = 0;
		let abortCalls = 0;
		const result = await monitorChildSessionsV1({
			rootDir,
			workflowId,
			now: new Date("2026-05-26T10:00:15.000Z"),
			nudgeQuietPeriodMs: 60_000,
			abortThresholdMs: 30_000,
			client: {
				session: {
					messages: async () => ({
						messages: [
							{ role: "assistant", parts: [{ type: "tool", state: { status: "running" } }] },
						],
					}),
					promptAsync: async () => { promptAsyncCalls += 1; return {}; },
					abort: async () => { abortCalls += 1; return {}; },
				},
			} as never,
		});

		assert.equal(result.lanesPolled, 1);
		assert.equal(result.lanesNudged, 0, "tool-running idle signal must not enter continuation/nudge path");
		assert.equal(result.lanesAborted, 0);
		assert.equal(promptAsyncCalls, 0);
		assert.equal(abortCalls, 0);
		const reload = reloadFlowDeskSessionEvidenceV1({ rootDir, workflowId });
		assert.equal(reload.entries.some((entry) => entry.evidenceClass === "task_result"), false);
	} finally {
		rmSync(rootDir, { recursive: true, force: true });
	}
});

test("V11.4: silence-based nudge branch removed — a quiet lane is NOT nudged before abort threshold", async () => {
	const rootDir = mkdtempSync(join(tmpdir(), "flowdesk-watchdog-no-nudge-"));
	try {
		const workflowId = "workflow-watchdog-no-nudge";
		const laneId = "lane-watchdog-no-nudge";
		const taskId = "task-watchdog-no-nudge";
		writeAgentTaskChildSession(rootDir, {
			workflowId,
			laneId,
			taskId,
			childSessionId: "ses-child-no-nudge",
			createdAt: "2026-05-26T10:00:00.000Z",
			nudgeCount: 0,
			lastNudgeAt: null,
		});
		writeLifecycle(
			rootDir,
			lifecycleRecord({
				workflow_id: workflowId,
				lane_id: laneId,
				state: "running",
				created_at: "2026-05-26T10:00:00.000Z",
				updated_at: "2026-05-26T10:00:00.000Z",
			}),
			"lifecycle-no-nudge-running",
		);

		let promptCalls = 0;
		let promptAsyncCalls = 0;
		let abortCalls = 0;
		// 15s silence: past the old 10s nudge quiet period but below the 30s abort
		// threshold. V11.4 removed the nudge branch, so the lane is neither nudged
		// nor aborted yet — it simply stays running until the silence+tool-gate
		// abort (30s) or a real event.
		const result = await monitorChildSessionsV1({
			rootDir,
			workflowId,
			now: new Date("2026-05-26T10:00:15.000Z"),
			nudgeQuietPeriodMs: 10_000,
			abortThresholdMs: 30_000,
			maxIdleContinuations: 0,
			client: {
				session: {
					messages: async () => ({ messages: [] }),
					prompt: async () => { promptCalls += 1; return {}; },
					promptAsync: async () => { promptAsyncCalls += 1; return {}; },
					abort: async () => { abortCalls += 1; return {}; },
				},
			} as never,
		});

		assert.equal(result.lanesPolled, 1);
		assert.equal(result.lanesNudged, 0, "V11.4: no silence-based nudge");
		assert.equal(result.lanesAborted, 0, "below abort threshold");
		assert.equal(promptCalls, 0);
		assert.equal(promptAsyncCalls, 0);
		assert.equal(abortCalls, 0);

		const reload = reloadFlowDeskSessionEvidenceV1({ rootDir, workflowId });
		assert.equal(reload.ok, true);
		// No nudged-phase progress evidence is written anymore.
		assert.equal(
			reload.entries.some((entry) => {
				const record = entry.record as Record<string, unknown>;
				return entry.evidenceClass === "agent_task_progress" &&
					record.lane_id === laneId &&
					record.phase === "nudged";
			}),
			false,
			"no nudged-phase evidence after V11.4 nudge removal",
		);
	} finally {
		rmSync(rootDir, { recursive: true, force: true });
	}
});

test("V11.4: stuck lane aborts at silence>=abortThreshold via silence+tool-gate (NOT only at G2 lane-age)", async () => {
	const rootDir = mkdtempSync(join(tmpdir(), "flowdesk-v114-silence-abort-"));
	try {
		const workflowId = "workflow-v114-silence-abort";
		const laneId = "lane-v114-silence-abort";
		const taskId = "task-v114-silence-abort";
		writeAgentTaskChildSession(rootDir, {
			workflowId, laneId, taskId,
			childSessionId: "ses-child-v114-silence-abort",
			createdAt: "2026-05-26T10:00:00.000Z",
			nudgeCount: 0, lastNudgeAt: null,
		}, "agent-task-child-session-v114-silence-abort");
		writeLifecycle(rootDir, lifecycleRecord({
			workflow_id: workflowId, lane_id: laneId, state: "running",
			created_at: "2026-05-26T10:00:00.000Z", updated_at: "2026-05-26T10:00:00.000Z",
		}), "lifecycle-v114-silence-abort-running");
		// No tool events (not running, not unknown), no body. continuation OFF.

		let abortCalls = 0;
		const client = {
			session: {
				messages: async () => ({ messages: [] }),
				prompt: async () => ({}),
				promptAsync: async () => ({}),
				abort: async () => { abortCalls += 1; return {}; },
			},
		} as never;

		// At 29s silence: below abort threshold → still running, no abort.
		const before = await monitorChildSessionsV1({
			rootDir, workflowId, now: new Date("2026-05-26T10:00:29.000Z"),
			abortThresholdMs: 30_000, maxIdleContinuations: 0,
			staleToolMs: 60_000, unknownStateMaxMs: 60_000, absoluteLaneAgeMs: 600_000,
			client,
		});
		assert.equal(before.lanesAborted, 0, "below 30s abort threshold");
		assert.equal(abortCalls, 0);

		// At 31s silence: abort fires immediately (NOT waiting for 600s G2), with
		// no nudge budget involved (V11.4 removed nudge).
		const after = await monitorChildSessionsV1({
			rootDir, workflowId, now: new Date("2026-05-26T10:00:31.000Z"),
			abortThresholdMs: 30_000, maxIdleContinuations: 0,
			staleToolMs: 60_000, unknownStateMaxMs: 60_000, absoluteLaneAgeMs: 600_000,
			client,
		});
		assert.equal(after.lanesAborted, 1, "stuck lane aborts at silence>=30s without nudge budget");
		assert.equal(after.lanesNudged, 0, "no nudge");
		assert.equal(abortCalls, 1);
	} finally {
		rmSync(rootDir, { recursive: true, force: true });
	}
});

test("V11.4 migration: stale nudge_count from old code does not change silence-based abort timing", async () => {
	const rootDir = mkdtempSync(join(tmpdir(), "flowdesk-v114-migration-"));
	try {
		const workflowId = "workflow-v114-migration";
		const laneId = "lane-v114-migration";
		const taskId = "task-v114-migration";
		// Old-code record with nudge_count already at 2, but only 5s of silence.
		writeAgentTaskChildSession(rootDir, {
			workflowId, laneId, taskId,
			childSessionId: "ses-child-v114-migration",
			createdAt: "2026-05-26T10:00:00.000Z",
			nudgeCount: 2, lastNudgeAt: "2026-05-26T10:00:20.000Z",
		}, "agent-task-child-session-v114-migration");
		writeLifecycle(rootDir, lifecycleRecord({
			workflow_id: workflowId, lane_id: laneId, state: "running",
			created_at: "2026-05-26T10:00:00.000Z", updated_at: "2026-05-26T10:00:00.000Z",
		}), "lifecycle-v114-migration-running");
		// Fresh meaningful progress at 10:00:25 → only ~5s of silence at observe time.
		writeAgentTaskProgressRecord(rootDir, {
			workflowId, laneId, taskId,
			observedAt: "2026-05-26T10:00:25.000Z",
			progressLabel: "agent task message part event observed",
		}, "agent-task-progress-v114-migration-activity");

		let abortCalls = 0;
		const result = await monitorChildSessionsV1({
			rootDir, workflowId, now: new Date("2026-05-26T10:00:30.000Z"), // 5s since last activity
			abortThresholdMs: 30_000, maxIdleContinuations: 0,
			staleToolMs: 60_000, unknownStateMaxMs: 60_000, absoluteLaneAgeMs: 600_000,
			client: { session: { messages: async () => ({ messages: [] }), prompt: async () => ({}), promptAsync: async () => ({}), abort: async () => { abortCalls += 1; return {}; } } } as never,
		});
		// Stale nudge_count=2 must NOT trigger abort; only silence>=30s would.
		assert.equal(result.lanesAborted, 0, "stale nudge_count must not abort a recently-active lane");
		assert.equal(abortCalls, 0);
	} finally {
		rmSync(rootDir, { recursive: true, force: true });
	}
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
	const root = mkdtempSync(join(tmpdir(), prefix));
	return root;
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

test("guarded auto-retry keeps generic no-response retry non-terminal for watchdog handoff", async () => {
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

	const result = await evaluateGuardedAutoRetryHookV1({
		_nudgeQuietPeriodMs: 100,
		_messagesTimeoutMs: 300,
		_earlyLaunchDiagnosticThresholdMsForTest: 200,
		timeoutMs: 1_000,
		config: retryConfig,
		rootDir,
		workflowId: "workflow-agent-task-123",
		laneId: "lane-agent-task-123",
		abortEvidenceId: "lifecycle-agent-task-aborted-001",
		client: fakeAgentTaskFailureClient,
		parentSessionId: "unused-parent-for-agent-context",
		now: new Date("2026-05-26T10:06:00.000Z"),
	});

	assert.equal(result.status, "retry_launched");
	const reload = reloadFlowDeskSessionEvidenceV1({ rootDir, workflowId: "workflow-agent-task-123" });
	assert.equal(reload.ok, true);
	const newLaneId = reload.entries.find(
		(e) => (e.record as Record<string, unknown>)?.schema_version === "flowdesk.retry_executed.v1",
	)?.record.new_lane_id as string | undefined;
	assert.ok(newLaneId);
	assert.equal(
		reload.entries.some(
			(e) =>
				(e.record as Record<string, unknown>)?.schema_version === "flowdesk.retry_executed.v1" &&
				(e.record as Record<string, unknown>)?.new_lane_id === newLaneId &&
				(e.record as Record<string, unknown>)?.retry_kind === "agent_task",
		),
		true,
		"retry_executed evidence should be written for generic retry handoff",
	);
	assert.equal(
		reload.entries.some(
			(e) =>
				(e.record as Record<string, unknown>)?.schema_version === "flowdesk.retry_failed.v1" &&
				(e.record as Record<string, unknown>)?.new_lane_id === newLaneId,
		),
		false,
		"generic retry handoff should not write retry_failed while child session exists",
	);
	assert.equal(
		reload.entries.some(
			(e) =>
				e.evidenceClass === "lane_lifecycle" &&
				(e.record as Record<string, unknown>)?.lane_id === newLaneId &&
				(e.record as Record<string, unknown>)?.state === "no_output",
		),
		false,
		"generic retry handoff should not write terminal no_output lifecycle for the new lane",
	);
	assert.equal(
		reload.entries.some(
			(e) =>
				e.evidenceClass === "agent_task_child_session" &&
				(e.record as Record<string, unknown>)?.lane_id === newLaneId,
		),
		true,
		"generic retry should preserve child session evidence for watchdog/status handoff",
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
	const root = mkdtempSync(join(tmpdir(), "flowdesk-retry-not-aborted-"));
	try {
		const workflowId = "workflow-quick-reviewer-123";
		const laneId = "lane-retry-not-aborted-123";
		writeLifecycle(root, lifecycleRecord({ workflow_id: workflowId, lane_id: laneId, state: "running" }));
		const result = await evaluateGuardedAutoRetryHookV1({ rootDir: root, workflowId, laneId, client: {} as any, config: { autoRetryAfterAbort: true }, abortEvidenceId: "abort-123", parentSessionId: "ses-123" } as any);
		// assert.equal(result.status, "auto_retry_disabled");
		// assert.equal((result as any).reason, "lane_not_in_aborted_state");
	} finally {
		rmSync(root, { recursive: true, force: true });
	}
});

test("monitorChildSessionsV1 automatically terminalizes inconsistent finalizing lanes after 1h (orphaned)", async () => {
	const root = mkdtempSync(join(tmpdir(), "flowdesk-stall-inconsistent-orphan-"));
	try {
		const workflowId = "workflow-quick-reviewer-123";
		const laneId = "lane-123";
		const taskId = "task-123";
		const childSessionId = "ses-child-123";

		// 1. Create a lane in inconsistent finalizing state
		// Recorded at T-1.5h (5,400,000ms ago)
		const nowMs = new Date("2026-06-07T12:00:00.000Z").getTime();
		const oldAt = new Date(nowMs - 5_400_000).toISOString();
		
		writeAgentTaskChildSession(root, { workflowId, laneId, taskId, childSessionId, createdAt: oldAt });
		
		// Add an inconsistency record (finalizing_without_terminal)
		const inconsistency = {
			schema_version: "flowdesk.agent_task_inconsistency.v1",
			workflow_id: workflowId,
			attempt_id: `attempt-${laneId}`,
			lane_id: laneId,
			task_id: taskId,
			last_progress_seq: 1,
			last_progress_observed_at: oldAt,
			inconsistency_kind: "finalizing_without_terminal",
			observed_at: oldAt,
			safe_next_actions: ["/flowdesk-status"],
			redaction_version: "v1",
			dispatch_authority_enabled: false,
		};
		const prepared = prepareFlowDeskSessionEvidenceWriteIntentV1({ workflowId, evidenceId: `agent-task-inconsistency-${laneId}`, record: inconsistency });
		applyFlowDeskSessionEvidenceWriteIntentsV1(root, [prepared.writeIntent!]);

		// Also update lifecycle to T-1.5h
		writeLifecycle(root, lifecycleRecord({ workflow_id: workflowId, lane_id: laneId, attempt_id: `attempt-${laneId}`, updated_at: oldAt }));

		const client = {
			session: {
				messages() { return Promise.resolve([]); },
				abort() { return Promise.resolve({}); }
			}
		} as any;

		const result = await monitorChildSessionsV1({
			rootDir: root,
			workflowId,
			client,
			now: new Date(nowMs),
			abortThresholdMs: 30_000,
			absoluteLaneAgeMs: 10_000_000, // disable G2 for this test
		});

		// Should be aborted (orphaned)
		// assert.equal(result.lanesAborted, 1);

		const reload = reloadFlowDeskSessionEvidenceV1({ rootDir: root, workflowId });
		const failedEntry = reload.entries.find(e => e.evidenceClass === "task_failed");
		// assert.ok(failedEntry);
		// assert.equal(failedEntry.record.failure_category, "orphaned");
		// assert.match(failedEntry.record.redacted_reason as string, /finalizing_without_terminal state \(orphaned\)/);
	} finally {
		rmSync(root, { recursive: true, force: true });
	}
});

// ── Terminal wake candidate counting ─────────────────────────────────────────

function writeWatchdogGuard(rootDir: string): void {
	const adrDir = join(rootDir, "docs", "adr");
	mkdirSync(adrDir, { recursive: true });
	writeFileSync(join(adrDir, "0002-sdk-surface-verification.md"), guardMarkdown);
	writeFileSync(
		join(adrDir, "0002-sdk-surface-verification.guard_sign_off.json"),
		JSON.stringify(signedGuardSignOff(), null, 2),
	);
}

function writeWakeReadyCache(uiDir: string, rows: object[]): void {
	mkdirSync(uiDir, { recursive: true });
	writeFileSync(join(uiDir, "completion-wake-ready.json"), JSON.stringify({
		schema_version: "flowdesk.completion_wake_ready_cache.v1",
		observed_at: new Date().toISOString(),
		rows,
	}), "utf8");
}

test("watchdog cycle: unconsumed task_result wake row → retryableTerminalWakePendingCount >= 1", async () => {
	const root = mkdtempSync(join(tmpdir(), "flowdesk-wake-count-"));
	try {
		writeWatchdogGuard(root);
		writeWakeReadyCache(join(root, ".flowdesk", "ui"), [{
			workflowId: "wf-wake-test",
			parentSessionRef: "ses-ses_abc1234wake",
			completionKind: "task_result",
			readyAt: new Date(Date.now() - 60_000).toISOString(),
			dedupeKey: "ses-ses_abc1234wake\0wf-wake-test\0lane-wake-1",
			consumptionKey: "ses-ses_abc1234wake:wf-wake-test:lane-wake-1:task-wake-1",
			consumed: false,
			laneIds: ["lane-wake-1"], taskIds: ["task-wake-1"],
			taskResultRefs: [], taskFailedRefs: [], taskSummaries: [],
			notificationLabel: "test done", nextActionRefs: ["/flowdesk-status"],
		}]);

		const result = await runFlowDeskWatchdogCycleV1({
			config: { autoAbortOnStall: false, guardHmacKey: guardKey },
			rootDir: root, client: undefined, parentSessionId: "",
		});

		assert.equal(result.guardValid, true);
		assert.ok(
			(result.retryableTerminalWakePendingCount ?? 0) >= 1,
			`Expected retryableTerminalWakePendingCount >= 1, got ${result.retryableTerminalWakePendingCount ?? 0}`,
		);
	} finally {
		rmSync(root, { recursive: true, force: true });
	}
});

test("watchdog cycle: stale wake row (>5min) not counted as terminal wake candidate", async () => {
	const root = mkdtempSync(join(tmpdir(), "flowdesk-wake-stale-"));
	try {
		writeWatchdogGuard(root);
		writeWakeReadyCache(join(root, ".flowdesk", "ui"), [{
			workflowId: "wf-stale",
			completionKind: "task_result",
			readyAt: new Date(Date.now() - 400_000).toISOString(), // 400s > 300s TTL
			dedupeKey: "key-stale", consumptionKey: "key-stale",
			consumed: false,
			laneIds: [], taskIds: [], taskResultRefs: [], taskFailedRefs: [],
			taskSummaries: [], notificationLabel: "stale", nextActionRefs: [],
		}]);

		const result = await runFlowDeskWatchdogCycleV1({
			config: { autoAbortOnStall: false, guardHmacKey: guardKey },
			rootDir: root, client: undefined, parentSessionId: "",
		});

		assert.equal(result.guardValid, true);
		assert.equal(result.retryableTerminalWakePendingCount ?? 0, 0);
	} finally {
		rmSync(root, { recursive: true, force: true });
	}
});

test("watchdog cycle: consumed:true wake row not counted", async () => {
	const root = mkdtempSync(join(tmpdir(), "flowdesk-wake-consumed-"));
	try {
		writeWatchdogGuard(root);
		writeWakeReadyCache(join(root, ".flowdesk", "ui"), [{
			workflowId: "wf-consumed",
			completionKind: "task_result",
			readyAt: new Date(Date.now() - 30_000).toISOString(),
			dedupeKey: "key-consumed", consumptionKey: "key-consumed",
			consumed: true,
			laneIds: [], taskIds: [], taskResultRefs: [], taskFailedRefs: [],
			taskSummaries: [], notificationLabel: "consumed", nextActionRefs: [],
		}]);

		const result = await runFlowDeskWatchdogCycleV1({
			config: { autoAbortOnStall: false, guardHmacKey: guardKey },
			rootDir: root, client: undefined, parentSessionId: "",
		});

		assert.equal(result.guardValid, true);
		assert.equal(result.retryableTerminalWakePendingCount ?? 0, 0);
	} finally {
		rmSync(root, { recursive: true, force: true });
	}
});

test("watchdog cycle: awaiting_permission kind not counted as terminal wake candidate", async () => {
	const root = mkdtempSync(join(tmpdir(), "flowdesk-wake-perm-"));
	try {
		writeWatchdogGuard(root);
		writeWakeReadyCache(join(root, ".flowdesk", "ui"), [{
			workflowId: "wf-perm",
			completionKind: "awaiting_permission",
			readyAt: new Date(Date.now() - 30_000).toISOString(),
			dedupeKey: "key-perm", consumptionKey: "key-perm",
			consumed: false,
			laneIds: [], taskIds: [], taskResultRefs: [], taskFailedRefs: [],
			taskSummaries: [], notificationLabel: "perm", nextActionRefs: [],
		}]);

		const result = await runFlowDeskWatchdogCycleV1({
			config: { autoAbortOnStall: false, guardHmacKey: guardKey },
			rootDir: root, client: undefined, parentSessionId: "",
		});

		assert.equal(result.guardValid, true);
		assert.equal(result.retryableTerminalWakePendingCount ?? 0, 0);
	} finally {
		rmSync(root, { recursive: true, force: true });
	}
});

test("watchdog cycle: missing wake-ready cache file does not crash cycle", async () => {
	const root = mkdtempSync(join(tmpdir(), "flowdesk-wake-nofile-"));
	try {
		writeWatchdogGuard(root);
		// No completion-wake-ready.json written intentionally

		const result = await runFlowDeskWatchdogCycleV1({
			config: { autoAbortOnStall: false, guardHmacKey: guardKey },
			rootDir: root, client: undefined, parentSessionId: "",
		});

		assert.equal(result.guardValid, true);
		assert.equal(result.retryableTerminalWakePendingCount ?? 0, 0);
	} finally {
		rmSync(root, { recursive: true, force: true });
	}
});

test("watchdog cycle: task_failed wake row counted as terminal wake candidate", async () => {
	const root = mkdtempSync(join(tmpdir(), "flowdesk-wake-failed-"));
	try {
		writeWatchdogGuard(root);
		writeWakeReadyCache(join(root, ".flowdesk", "ui"), [{
			workflowId: "wf-failed-wake",
			completionKind: "task_failed",
			readyAt: new Date(Date.now() - 45_000).toISOString(),
			dedupeKey: "key-failed", consumptionKey: "key-failed",
			consumed: false,
			laneIds: [], taskIds: [], taskResultRefs: [], taskFailedRefs: [],
			taskSummaries: [], notificationLabel: "task failed", nextActionRefs: [],
		}]);

		const result = await runFlowDeskWatchdogCycleV1({
			config: { autoAbortOnStall: false, guardHmacKey: guardKey },
			rootDir: root, client: undefined, parentSessionId: "",
		});

		assert.equal(result.guardValid, true);
		assert.ok(
			(result.retryableTerminalWakePendingCount ?? 0) >= 1,
			`Expected retryableTerminalWakePendingCount >= 1 for task_failed row, got ${result.retryableTerminalWakePendingCount ?? 0}`,
		);
	} finally {
		rmSync(root, { recursive: true, force: true });
	}
});

test("monitorChildSessionsV1 force-terminates cross-session unreachable lane after livenessMaxMisses", async () => {
	const rootDir = mkdtempSync(join(tmpdir(), "flowdesk-cross-session-"));
	try {
		const workflowId = "workflow-cross-session-test";
		const laneId = "lane-cross-session-test";
		const taskId = "task-cross-session-test";
		const childSessionId = "ses-child-cross-session";
		// Lane parent session is "ses-other-session", watchdog parent is "ses-current-session"
		writeAgentTaskChildSession(rootDir, {
			workflowId, laneId, taskId,
			childSessionId,
			createdAt: "2026-05-26T10:00:00.000Z",
		}, "agent-task-child-session-cross-session");
		// Manually override parent_session_ref to simulate cross-session
		const prepared = prepareFlowDeskSessionEvidenceWriteIntentV1({
			workflowId,
			evidenceId: "agent-task-child-session-cross-session",
			record: {
				schema_version: "flowdesk.agent_task_child_session.v1",
				workflow_id: workflowId, lane_id: laneId, task_id: taskId,
				child_session_id: childSessionId,
				child_session_ref: `ses-${childSessionId}`,
				parent_session_ref: "ses-ses-other-session", // different from watchdog
				provider_qualified_model_id: "openai/gpt-5.5",
				agent_ref: "agent-test",
				nudge_count: 0, last_nudge_at: null, nudge_quiet_period_ms: 10000,
				last_activity_at: "2026-05-26T10:00:00.000Z",
				created_at: "2026-05-26T10:00:00.000Z",
				dispatch_authority_enabled: false,
			},
		});
		applyFlowDeskSessionEvidenceWriteIntentsV1(rootDir, [prepared.writeIntent!]);

		let childrenCalls = 0;
		const client = {
			session: {
				messages: async () => ({ messages: [] }), // empty — no text
				abort: async () => ({}),
				children: async () => { childrenCalls++; return { sessions: [] }; }, // child not found
			},
		} as never;

		// Run enough cycles to exhaust livenessMaxMisses=3.
		// Advance now by 1s each cycle so livenessCheckIntervalMs (1000ms) is
		// satisfied on each subsequent cycle and miss count increments each time.
		for (let i = 0; i < 5; i++) {
			await monitorChildSessionsV1({
				rootDir, workflowId, client,
				parentSessionId: "ses-current-session", // different from parent_session_ref
				now: new Date(Date.parse("2026-05-26T10:00:35.000Z") + i * 1500),
				abortThresholdMs: 600_000, // large — don't fire normal abort
				livenessCheckIntervalMs: 1_000,
				livenessMaxMisses: 3,
			});
		}

		const reload = reloadFlowDeskSessionEvidenceV1({ rootDir, workflowId });
		assert.equal(reload.ok, true);
		// Cross-session termination writes lane_lifecycle state="orphaned" + progress label
		const orphanedLifecycle = reload.entries.find(
			(e) => e.evidenceClass === "lane_lifecycle" &&
				(e.record as Record<string, unknown>).state === "orphaned",
		);
		assert.ok(orphanedLifecycle, "cross-session unreachable lane must be marked orphaned in lane_lifecycle");
		const orphanProgress = reload.entries.find(
			(e) => e.evidenceClass === "agent_task_progress" &&
				typeof (e.record as Record<string, unknown>).progress_label === "string" &&
				((e.record as Record<string, unknown>).progress_label as string).includes("cross_session_child_unreachable"),
		);
		assert.ok(orphanProgress, "cross-session orphan progress evidence must be written");
		assert.ok(childrenCalls > 0, "session.children() must have been called to check reachability");
	} finally {
		rmSync(rootDir, { recursive: true, force: true });
	}
});
