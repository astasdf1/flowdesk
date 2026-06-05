import assert from "node:assert/strict";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { reloadFlowDeskSessionEvidenceV1, sessionEvidenceRecordPath } from "@flowdesk/core";
import { executeFlowDeskAutoContinueExecutionToolV1 } from "./auto-continue-execution-tool.js";
import { executeFlowDeskWorkflowDispatchPlanToolV1 } from "./workflow-dispatch-plan-tool.js";

test("auto-continue execution runs first pending durable plan task only with explicit opt-in", async () => {
	const rootDir = mkdtempSync(join(tmpdir(), "flowdesk-auto-continue-execution-"));
	const counters = { create: 0, prompt: 0, messages: 0 };
	try {
		const workflowId = "workflow-auto-continue-execution-1";
		const plan = executeFlowDeskWorkflowDispatchPlanToolV1({
			config: { rootDir },
			request: {
				workflowId,
				goalSummary: "Continue durable planned work",
				tasks: [
					{ agentRole: "implementation", title: "First task", summary: "Already completed" },
					{ agentRole: "implementation", title: "Second task", summary: "Execute item details" },
				],
			},
			now: () => new Date("2026-05-29T00:00:00.000Z"),
		});
		assert.equal(plan.status, "workflow_dispatch_plan_recorded", plan.summaryForUser);
		const completedTaskId = `task-1-${workflowId}`;
		const nextTaskId = `task-2-${workflowId}`;
		writeEvidence(rootDir, workflowId, "task_result", "task-result-one", {
			schema_version: "flowdesk.task_result.v1",
			workflow_id: workflowId,
			lane_id: "lane-one",
			task_id: completedTaskId,
			agent_ref: "agent-test",
			provider_qualified_model_id: "openai/gpt-5.5",
			task_prompt_sha256: "a".repeat(64),
			result_text: "done",
			result_text_truncated: false,
			result_text_sha256: "b".repeat(64),
			completion_status: "final",
			output_kind: "final_answer",
			usable_for_synthesis: true,
			created_at: "2026-05-29T00:00:00.000Z",
			dispatch_authority_enabled: false,
		});

		const result = await executeFlowDeskAutoContinueExecutionToolV1({
			config: { rootDir, client: fakeClient("Auto continue result.", counters) as never, compatibilityGate: compatibilityGate() },
			request: {
				workflowId,
				parentSessionId: "parent-session-1",
				task: {
					taskId: nextTaskId,
					promptText: "Return the auto-continue result.",
					agentName: "flowdesk-code-backend",
					providerQualifiedModelId: "openai/gpt-5.5",
				},
				developerModeAcknowledged: true,
				allowProviderCall: true,
				allowActualLaneLaunch: true,
				allowAutoContinueExecution: true,
			},
		});

		assert.equal(result.status, "auto_continue_execution_completed", result.summaryForUser);
		assert.equal(result.taskId, nextTaskId);
		const reloaded = reloadEvidence(rootDir, workflowId);
		assert.equal(reloaded.some((entry) => entry.evidenceClass === "lane_lifecycle" && entry.record.lane_id === result.laneId && ["complete", "incomplete"].includes(String(entry.record.state))), true);
		assert.equal(result.pendingTaskCount, 1);
		assert.equal(result.completedTaskCount, 1);
		assert.equal(counters.create, 1);
		assert.equal(counters.prompt, 1);
		assert.equal(result.authority.realOpenCodeDispatch, false);
		assert.equal(result.authority.dispatchAuthorityEnabled, false);
		assert.equal(result.authority.defaultRelease1DispatchAuthority, false);
		assert.equal(result.authority.fallbackAuthority, false);
		assert.equal(result.authority.hardCancelOrNoReplyAuthority, false);
		assert.equal(result.authority.toolAuthority, false);
		assert.equal(result.authority.autoContinuationExecuted, true);
		assert.equal(result.authority.autoContinueCompatibilityGateSatisfied, true);
		assert.equal(result.autoContinueCompatibilityGate?.evidenceRef, "test:autoContinueExecution.enabled+devBetaActualLaneLaunch");
	} finally {
		rmSync(rootDir, { recursive: true, force: true });
	}
});

test("auto-continue execution blocks missing opt-in and taskId mismatch before SDK calls", async () => {
	const rootDir = mkdtempSync(join(tmpdir(), "flowdesk-auto-continue-execution-blocks-"));
	const counters = { create: 0, prompt: 0, messages: 0 };
	try {
		const workflowId = "workflow-auto-continue-execution-blocks-1";
		const plan = executeFlowDeskWorkflowDispatchPlanToolV1({
			config: { rootDir },
			request: {
				workflowId,
				goalSummary: "Continue durable planned work",
				tasks: [{ agentRole: "implementation", title: "First task", summary: "Execute item details" }],
			},
			now: () => new Date("2026-05-29T00:00:00.000Z"),
		});
		assert.equal(plan.status, "workflow_dispatch_plan_recorded", plan.summaryForUser);
		const base = {
			workflowId,
			parentSessionId: "parent-session-1",
			task: {
				taskId: `task-1-${workflowId}`,
				promptText: "Return the auto-continue result.",
				agentName: "flowdesk-code-backend",
				providerQualifiedModelId: "openai/gpt-5.5",
			},
			developerModeAcknowledged: true,
			allowProviderCall: true,
			allowActualLaneLaunch: true,
			allowAutoContinueExecution: true,
		};

		const missingOptIn = await executeFlowDeskAutoContinueExecutionToolV1({
			config: { rootDir, client: fakeClient("unused", counters) as never, compatibilityGate: compatibilityGate() },
			request: { ...base, allowAutoContinueExecution: false },
		});
		assert.equal(missingOptIn.status, "blocked_before_auto_continue_execution");
		assert.match(String(missingOptIn.redactedBlockReason), /allowAutoContinueExecution=true/);

		const mismatch = await executeFlowDeskAutoContinueExecutionToolV1({
			config: { rootDir, client: fakeClient("unused", counters) as never, compatibilityGate: compatibilityGate() },
			request: { ...base, task: { ...base.task, taskId: "task-other" } },
		});
		assert.equal(mismatch.status, "blocked_before_auto_continue_execution");
		assert.match(String(mismatch.redactedBlockReason), /first pending durable plan task/);
		assert.equal(counters.create, 0);
		assert.equal(counters.prompt, 0);
	} finally {
		rmSync(rootDir, { recursive: true, force: true });
	}
});

test("auto-continue execution blocks when local compatibility evidence is absent", async () => {
	const rootDir = mkdtempSync(join(tmpdir(), "flowdesk-auto-continue-execution-compat-"));
	const counters = { create: 0, prompt: 0, messages: 0 };
	try {
		const workflowId = "workflow-auto-continue-execution-compat-1";
		const plan = executeFlowDeskWorkflowDispatchPlanToolV1({
			config: { rootDir },
			request: {
				workflowId,
				goalSummary: "Continue durable planned work",
				tasks: [{ agentRole: "implementation", title: "First task", summary: "Execute item details" }],
			},
			now: () => new Date("2026-05-29T00:00:00.000Z"),
		});
		assert.equal(plan.status, "workflow_dispatch_plan_recorded", plan.summaryForUser);
		const result = await executeFlowDeskAutoContinueExecutionToolV1({
			config: { rootDir, client: fakeClient("unused", counters) as never },
			request: {
				workflowId,
				parentSessionId: "parent-session-1",
				task: {
					taskId: `task-1-${workflowId}`,
					promptText: "Return the auto-continue result.",
					agentName: "flowdesk-code-backend",
					providerQualifiedModelId: "openai/gpt-5.5",
				},
				developerModeAcknowledged: true,
				allowProviderCall: true,
				allowActualLaneLaunch: true,
				allowAutoContinueExecution: true,
			},
		});
		assert.equal(result.status, "blocked_before_auto_continue_execution");
		assert.match(String(result.redactedBlockReason), /local compatibility evidence is required/);
		assert.equal(result.autoContinueCompatibilityGate?.satisfied, false);
		assert.equal(result.authority.autoContinueCompatibilityGateSatisfied, false);
		assert.equal(counters.create, 0);
		assert.equal(counters.prompt, 0);
	} finally {
		rmSync(rootDir, { recursive: true, force: true });
	}
});

test("auto-continue execution blocks terminal incomplete durable task evidence before SDK calls", async () => {
	const rootDir = mkdtempSync(join(tmpdir(), "flowdesk-auto-continue-execution-failed-"));
	const counters = { create: 0, prompt: 0, messages: 0 };
	try {
		const workflowId = "workflow-auto-continue-execution-failed-1";
		const plan = executeFlowDeskWorkflowDispatchPlanToolV1({
			config: { rootDir },
			request: {
				workflowId,
				goalSummary: "Continue durable planned work",
				tasks: [
					{ agentRole: "implementation", title: "Failed task", summary: "Already failed" },
					{ agentRole: "implementation", title: "Later task", summary: "Do not execute" },
				],
			},
			now: () => new Date("2026-05-29T00:00:00.000Z"),
		});
		assert.equal(plan.status, "workflow_dispatch_plan_recorded", plan.summaryForUser);
		const failedTaskId = `task-1-${workflowId}`;
		writeEvidence(rootDir, workflowId, "lane_lifecycle", "lane-no-output-one", {
			schema_version: "flowdesk.lane_lifecycle_record.v1",
			workflow_id: workflowId,
			lane_id: "lane-failed-one",
			attempt_id: "attempt-lane-failed-one",
			parent_session_ref: "ses-parent-lifecycle-1",
			child_session_ref: "ses-child-lane-failed-one",
			agent_ref: "agent-reviewer-gpt-frontier",
			provider_qualified_model_id: "openai/gpt-5.5",
			task_id: failedTaskId,
			state: "no_output",
			timeout_ms: 60_000,
			orphan_max_age_ms: 600_000,
			retry_count: 0,
			created_at: "2026-05-29T00:00:00.000Z",
			updated_at: "2026-05-29T00:00:00.000Z",
			spawned_by: "flowdesk",
			durability: "best_effort_no_dir_fsync",
			dispatch_authority_enabled: false,
			providerCall: false,
			actualLaneLaunch: false,
			runtimeExecution: false,
		});

		const result = await executeFlowDeskAutoContinueExecutionToolV1({
			config: { rootDir, client: fakeClient("unused", counters) as never, compatibilityGate: compatibilityGate() },
			request: {
				workflowId,
				parentSessionId: "parent-session-1",
				task: {
					taskId: failedTaskId,
					promptText: "Return the auto-continue result.",
					agentName: "flowdesk-code-backend",
					providerQualifiedModelId: "openai/gpt-5.5",
				},
				developerModeAcknowledged: true,
				allowProviderCall: true,
				allowActualLaneLaunch: true,
				allowAutoContinueExecution: true,
			},
		});
		assert.equal(result.status, "blocked_before_auto_continue_execution");
		assert.match(String(result.redactedBlockReason), /terminal incomplete evidence: no_output/);
		assert.equal(result.blockedTaskCount, 1);
		assert.equal(result.pendingTaskCount, 1);
		assert.equal(counters.create, 0);
		assert.equal(counters.prompt, 0);
	} finally {
		rmSync(rootDir, { recursive: true, force: true });
	}
});

function fakeClient(outputText: string, counters: { create: number; prompt: number; messages: number }) {
	const sessionMessages = new Map<string, unknown[]>();
	return {
		session: {
			async create(options: { parentID?: string }) {
				counters.create += 1;
				return { id: options.parentID === undefined ? "parent-session-1" : "child-session-1" };
			},
			async prompt(options: { sessionID?: string; path?: { id?: string } }) {
				counters.prompt += 1;
				const sessionId = String(options.sessionID ?? options.path?.id ?? "child-session-1");
				sessionMessages.set(sessionId, [
					{ id: "msg-auto-continue-1", info: { role: "assistant" }, parts: [{ type: "text", text: outputText }, { type: "step-finish", reason: "stop" }] },
				]);
				return { id: "msg-auto-continue-1" };
			},
			async messages(options: { sessionID?: string; path?: { id?: string } }) {
				counters.messages += 1;
				return sessionMessages.get(String(options.sessionID ?? options.path?.id ?? "")) ?? [];
			},
		},
	};
}

function compatibilityGate() {
	return {
		autoContinueExecutionEnabled: true,
		devBetaActualLaneLaunch: true,
		evidenceRef: "test:autoContinueExecution.enabled+devBetaActualLaneLaunch",
	};
}

function writeEvidence(
	rootDir: string,
	workflowId: string,
	evidenceClass: Parameters<typeof sessionEvidenceRecordPath>[1],
	evidenceId: string,
	record: Record<string, unknown>,
): void {
	const relativePath = sessionEvidenceRecordPath(workflowId, evidenceClass, evidenceId);
	const absolutePath = join(rootDir, relativePath);
	mkdirSync(join(absolutePath, ".."), { recursive: true });
	writeFileSync(absolutePath, JSON.stringify(record), "utf8");
}

function reloadEvidence(rootDir: string, workflowId: string): Array<{ evidenceClass: string; record: Record<string, unknown> }> {
	const reloaded = reloadFlowDeskSessionEvidenceV1({ rootDir, workflowId });
	return reloaded.entries.map((entry) => ({ evidenceClass: entry.evidenceClass, record: entry.record }));
}
