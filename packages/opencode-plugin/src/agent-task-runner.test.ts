/**
 * P7-S16: Focused OI session accumulator + agent-task-runner integration tests.
 *
 * Covers:
 * 1. OI session summary is written as durable evidence after task completes.
 * 2. OI summary write failure does NOT affect task_result.
 * 3. OI summary with oiEnabled=false has advisory_health_label "disabled_by_config" and all counts 0.
 * 4. createOISessionAccumulator() increment / toSummary round-trip.
 * 5. loadRecentOISessionSummariesV1 returns summaries sorted newest-first.
 */
import assert from "node:assert/strict";
import test from "node:test";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { executeFlowDeskAgentTaskV1 } from "./agent-task-runner.js";
import {
	createOISessionAccumulator,
	loadRecentOISessionSummariesV1,
} from "./oi-session-accumulator.js";
import { reloadFlowDeskSessionEvidenceV1 } from "@flowdesk/core";
import type { FlowDeskManagedDispatchBetaOpenCodeClientV1 } from "./managed-dispatch-adapter.js";

// ─── Shared client factory ────────────────────────────────────────────────────

function makeSuccessClient(overrides: {
	messages?: (o: unknown) => Promise<unknown>;
	create?: (o: unknown) => Promise<unknown>;
} = {}): FlowDeskManagedDispatchBetaOpenCodeClientV1 {
	return {
		session: {
			create: overrides.create ?? (async () => ({ id: "ses-oi-test-child-01" })),
			promptAsync: async () => ({}),
			messages: overrides.messages ?? (async () => [
				{
					role: "assistant",
					parts: [
						{ type: "text", text: "OI test answer" },
						{ type: "step-finish", reason: "stop" },
					],
				},
			]),
			abort: async () => {},
		},
	} as unknown as FlowDeskManagedDispatchBetaOpenCodeClientV1;
}

test("runtime task model-selection evidence persists for fuzzy Anthropic alias selection", async () => {
	const root = mkdtempSync(join(tmpdir(), "flowdesk-task-model-selection-anthropic-"));
	try {
		const client = makeSuccessClient();

		const result = await executeFlowDeskAgentTaskV1({
			workflowId: "workflow-task-model-selection-1",
			taskId: "task-model-selection-1",
			laneId: "lane-model-selection-1",
			agentRef: "agent-test",
			providerQualifiedModelId: "anthropic/claude-haiku-5.0",
			promptText: "produce result for task model selection test",
			parentSessionId: "parent-model-selection-test",
			rootDir: root,
			client,
			asyncMode: false,
			oiEnabled: false,
			_launchTimeoutMs: 5_000,
			_nudgeQuietPeriodMs: 50,
			_messagesTimeoutMs: 50,
		});

		assert.equal(result.status, "task_completed", `expected task_completed, got ${result.status}`);

		const reloaded = reloadFlowDeskSessionEvidenceV1({
			rootDir: root,
			workflowId: "workflow-task-model-selection-1",
		});
		assert.ok(reloaded.ok, reloaded.blocked.map((entry) => entry.reason).join("; "));
		const selectionEntry = reloaded.entries.find((entry) => entry.evidenceClass === "task_model_selection");
		assert.ok(selectionEntry, "task_model_selection evidence should be reloadable");
		const record = selectionEntry.record as Record<string, unknown>;
		assert.equal(record.provider_family, "claude");
		assert.equal(record.provider_qualified_model_id, "anthropic/claude-haiku-4-5");
		assert.equal(record.selection_status, "selected");
		assert.deepEqual(record.attempted_provider_qualified_model_ids, [
			"anthropic/claude-haiku-5.0",
			"anthropic/claude-haiku-4-5",
		]);
	} finally {
		rmSync(root, { recursive: true, force: true });
	}
});

test("runtime model binding still fails closed before SDK session creation", async () => {
	const root = mkdtempSync(join(tmpdir(), "flowdesk-task-model-selection-fail-closed-"));
	try {
		let createCalls = 0;
		const client = makeSuccessClient({
			create: async () => {
				createCalls++;
				return { id: "ses-should-not-be-created" };
			},
		});

		const unsupportedModel = await executeFlowDeskAgentTaskV1({
			workflowId: "workflow-task-model-selection-unsupported",
			taskId: "task-model-selection-unsupported",
			laneId: "lane-model-selection-unsupported",
			agentRef: "agent-test",
			providerQualifiedModelId: "openai/fake-unsupported-model-xyz",
			promptText: "should not launch unsupported model",
			parentSessionId: "parent-model-selection-test",
			rootDir: root,
			client,
			asyncMode: false,
		});
		assert.equal(unsupportedModel.status, "task_failed");
		if (unsupportedModel.status !== "task_failed") return;
		assert.match(unsupportedModel.redactedReason, /not supported|unsupported|no same-family OpenCode-supported fallback/i);
		assert.equal(createCalls, 0, "SDK session.create must not be called for failed model binding");
	} finally {
		rmSync(root, { recursive: true, force: true });
	}
});

// ─── Test 1: OI session summary is written after task completes ───────────────

test("OI session summary evidence is written after task_completed", async () => {
	const root = mkdtempSync(join(tmpdir(), "flowdesk-oi-summary-written-"));
	try {
		const client = makeSuccessClient();

		const result = await executeFlowDeskAgentTaskV1({
			workflowId: "workflow-oi-summary-1",
			taskId: "task-oi-summary-1",
			laneId: "lane-oi-summary-1",
			agentRef: "agent-test",
			providerQualifiedModelId: "openai/gpt-5.5",
			promptText: "produce result for OI test",
			parentSessionId: "parent-oi-test",
			rootDir: root,
			client,
			asyncMode: false,
			oiEnabled: true,
			_launchTimeoutMs: 5_000,
			_nudgeQuietPeriodMs: 50,
			_messagesTimeoutMs: 50,
		});

		// Confirm task completed successfully.
		assert.equal(result.status, "task_completed", `expected task_completed, got ${result.status}`);

		// OI session summary should appear in the durable evidence store.
		const reloaded = reloadFlowDeskSessionEvidenceV1({
			rootDir: root,
			workflowId: "workflow-oi-summary-1",
		});
		assert.ok(reloaded.ok, "evidence reload should succeed");

		const oiEntries = reloaded.entries.filter((e) => e.evidenceClass === "oi_session_summary");
		assert.ok(oiEntries.length >= 1, `expected at least 1 oi_session_summary entry, got ${oiEntries.length}`);

		const oiRecord = oiEntries[0]!.record as Record<string, unknown>;
		assert.equal(oiRecord.schema_version, "flowdesk.oi_session_summary.v1");
		assert.equal(oiRecord.workflow_id, "workflow-oi-summary-1");
		assert.equal(oiRecord.advisory_only, true);
		assert.equal(oiRecord.non_authorizing, true);
		assert.equal(oiRecord.dispatch_authority_enabled, false);
		// OI is enabled → health label should NOT be disabled_by_config.
		assert.notEqual(oiRecord.advisory_health_label, "disabled_by_config");
	} finally {
		rmSync(root, { recursive: true, force: true });
	}
});

// ─── Test 2: OI summary write failure does not affect task_result ─────────────

test("OI summary write failure does not propagate: task_completed still returned", async () => {
	const root = mkdtempSync(join(tmpdir(), "flowdesk-oi-summary-failsafe-"));
	try {
		const client = makeSuccessClient();

		// Pass an accumulator whose toSummary throws — simulates a write failure path.
		const throwingAccumulator = createOISessionAccumulator();
		// Override toSummary to throw after some increments.
		const originalToSummary = throwingAccumulator.toSummary.bind(throwingAccumulator);
		Object.defineProperty(throwingAccumulator, "toSummary", {
			value: (_input: Parameters<typeof originalToSummary>[0]) => {
				throw new Error("simulated OI summary build failure");
			},
		});

		const result = await executeFlowDeskAgentTaskV1({
			workflowId: "workflow-oi-failsafe-1",
			taskId: "task-oi-failsafe-1",
			laneId: "lane-oi-failsafe-1",
			agentRef: "agent-test",
			providerQualifiedModelId: "openai/gpt-5.5",
			promptText: "produce result for OI failsafe test",
			parentSessionId: "parent-oi-failsafe",
			rootDir: root,
			client,
			asyncMode: false,
			oiEnabled: true,
			_oiAccumulator: throwingAccumulator,
			_launchTimeoutMs: 5_000,
			_nudgeQuietPeriodMs: 50,
			_messagesTimeoutMs: 50,
		});

		// Task must complete successfully even though the OI write threw.
		assert.equal(result.status, "task_completed", `OI write failure should not prevent task_completed, got ${result.status}`);
		if (result.status !== "task_completed") return;
		assert.ok(result.taskResultEvidenceId.length > 0, "taskResultEvidenceId must be populated");

		// The task_result evidence should exist; oi_session_summary may or may not exist.
		const reloaded = reloadFlowDeskSessionEvidenceV1({
			rootDir: root,
			workflowId: "workflow-oi-failsafe-1",
		});
		const taskResults = reloaded.entries.filter((e) => e.evidenceClass === "task_result");
		assert.ok(taskResults.length >= 1, "task_result evidence must be written regardless of OI failure");
	} finally {
		rmSync(root, { recursive: true, force: true });
	}
});

// ─── Test 3: oiEnabled=false produces disabled_by_config summary ──────────────

test("OI summary with oiEnabled=false has advisory_health_label disabled_by_config and all counts 0", async () => {
	const root = mkdtempSync(join(tmpdir(), "flowdesk-oi-disabled-"));
	try {
		const client = makeSuccessClient();

		const result = await executeFlowDeskAgentTaskV1({
			workflowId: "workflow-oi-disabled-1",
			taskId: "task-oi-disabled-1",
			laneId: "lane-oi-disabled-1",
			agentRef: "agent-test",
			providerQualifiedModelId: "openai/gpt-5.5",
			promptText: "produce result for OI disabled test",
			parentSessionId: "parent-oi-disabled",
			rootDir: root,
			client,
			asyncMode: false,
			oiEnabled: false, // OI disabled
			_launchTimeoutMs: 5_000,
			_nudgeQuietPeriodMs: 50,
			_messagesTimeoutMs: 50,
		});

		assert.equal(result.status, "task_completed", `expected task_completed, got ${result.status}`);

		const reloaded = reloadFlowDeskSessionEvidenceV1({
			rootDir: root,
			workflowId: "workflow-oi-disabled-1",
		});
		assert.ok(reloaded.ok, "evidence reload should succeed");

		const oiEntries = reloaded.entries.filter((e) => e.evidenceClass === "oi_session_summary");
		assert.ok(oiEntries.length >= 1, `expected at least 1 oi_session_summary entry, got ${oiEntries.length}`);

		const oiRecord = oiEntries[0]!.record as Record<string, unknown>;
		assert.equal(oiRecord.advisory_health_label, "disabled_by_config", "OI disabled → advisory_health_label must be disabled_by_config");
		assert.equal(oiRecord.proposals_scored, 0, "disabled OI → proposals_scored must be 0");
		assert.equal(oiRecord.reuse_gates_checked, 0, "disabled OI → reuse_gates_checked must be 0");
		assert.equal(oiRecord.fanout_gates_evaluated, 0, "disabled OI → fanout_gates_evaluated must be 0");
		assert.equal(oiRecord.ledger_entries_total, 0, "disabled OI → ledger_entries_total must be 0");
		assert.equal(oiRecord.advisory_only, true);
		assert.equal(oiRecord.dispatch_authority_enabled, false);
	} finally {
		rmSync(root, { recursive: true, force: true });
	}
});

// ─── Test 6: parentSessionProviderQualifiedModelId is recorded ────────────────

test("parentSessionProviderQualifiedModelId is recorded in agent_task_context", async () => {
	const root = mkdtempSync(join(tmpdir(), "flowdesk-parent-model-recorded-"));
	try {
		const client = makeSuccessClient();
		const parentModel = "anthropic/claude-opus-4-7";

		const result = await executeFlowDeskAgentTaskV1({
			workflowId: "workflow-parent-model-1",
			taskId: "task-parent-model-1",
			laneId: "lane-parent-model-1",
			agentRef: "agent-test",
			providerQualifiedModelId: "openai/gpt-5.5",
			promptText: "test parent model recording",
			parentSessionId: "parent-oi-test",
			parentSessionProviderQualifiedModelId: parentModel,
			rootDir: root,
			client,
			asyncMode: false,
			oiEnabled: true,
			_launchTimeoutMs: 5_000,
			_nudgeQuietPeriodMs: 50,
			_messagesTimeoutMs: 50,
		});

		assert.equal(result.status, "task_completed");

		const reloaded = reloadFlowDeskSessionEvidenceV1({
			rootDir: root,
			workflowId: "workflow-parent-model-1",
		});
		assert.ok(reloaded.ok);

		const contextEntries = reloaded.entries.filter((e) => e.evidenceClass === "agent_task_context");
		assert.ok(contextEntries.length >= 1);

		const contextRecord = contextEntries[0]!.record as Record<string, unknown>;
		assert.equal(contextRecord.recorded_parent_provider_qualified_model_id, parentModel);
		assert.equal(contextRecord.parent_wake_provider_qualified_model_id, parentModel);
	} finally {
		rmSync(root, { recursive: true, force: true });
	}
});

// ─── Test 4: OI accumulator increment / toSummary round-trip ─────────────────

test("createOISessionAccumulator increment and toSummary round-trip", () => {
	const acc = createOISessionAccumulator();
	assert.equal(acc.proposalsScored, 0);
	assert.equal(acc.reuseGatesChecked, 0);
	assert.equal(acc.fanoutGatesEvaluated, 0);
	assert.equal(acc.ledgerEntriesTotal, 0);

	acc.increment("proposalsScored");
	acc.increment("proposalsScored");
	acc.increment("reuseGatesChecked");
	acc.increment("fanoutGatesEvaluated");
	acc.increment("ledgerEntriesTotal");
	acc.increment("ledgerEntriesTotal");
	acc.increment("ledgerEntriesTotal");

	assert.equal(acc.proposalsScored, 2);
	assert.equal(acc.reuseGatesChecked, 1);
	assert.equal(acc.fanoutGatesEvaluated, 1);
	assert.equal(acc.ledgerEntriesTotal, 3);

	const result = acc.toSummary({
		summaryId: "oi-summary-unit-test",
		sessionRef: "ses-unit-test-ref",
		workflowId: "workflow-unit-test",
		capturedAt: "2026-06-07T00:00:00.000Z",
		oiEnabled: true,
	});

	assert.ok(result.ok, `toSummary should produce valid summary: ${result.errors.join("; ")}`);
	assert.ok(result.summary !== undefined, "toSummary should have a summary field");
	assert.equal(result.summary!.proposals_scored, 2);
	assert.equal(result.summary!.reuse_gates_checked, 1);
	assert.equal(result.summary!.fanout_gates_evaluated, 1);
	assert.equal(result.summary!.ledger_entries_total, 3);
	assert.equal(result.summary!.advisory_health_label, "healthy");
	assert.equal(result.summary!.advisory_only, true);
	assert.equal(result.summary!.dispatch_authority_enabled, false);
});

test("createOISessionAccumulator toSummary with oiEnabled=false zeroes all counts", () => {
	const acc = createOISessionAccumulator();
	acc.increment("proposalsScored");
	acc.increment("reuseGatesChecked");
	acc.increment("fanoutGatesEvaluated");
	acc.increment("ledgerEntriesTotal");

	const result = acc.toSummary({
		summaryId: "oi-summary-disabled-unit-test",
		sessionRef: "ses-disabled-ref",
		workflowId: "workflow-disabled-test",
		capturedAt: "2026-06-07T00:00:00.000Z",
		oiEnabled: false,
	});

	assert.ok(result.ok, `disabled toSummary should be valid: ${result.errors.join("; ")}`);
	assert.equal(result.summary!.proposals_scored, 0, "disabled → proposals_scored=0");
	assert.equal(result.summary!.reuse_gates_checked, 0, "disabled → reuse_gates_checked=0");
	assert.equal(result.summary!.fanout_gates_evaluated, 0, "disabled → fanout_gates_evaluated=0");
	assert.equal(result.summary!.ledger_entries_total, 0, "disabled → ledger_entries_total=0");
	assert.equal(result.summary!.advisory_health_label, "disabled_by_config");
});

// ─── Test 5: loadRecentOISessionSummariesV1 returns summaries newest-first ────

test("loadRecentOISessionSummariesV1 returns summaries sorted newest-first", async () => {
	const root = mkdtempSync(join(tmpdir(), "flowdesk-oi-reader-"));
	try {
		const client = makeSuccessClient();

		// Write two tasks with OI summaries to the same workflow.
		await executeFlowDeskAgentTaskV1({
			workflowId: "workflow-oi-reader-1",
			taskId: "task-oi-reader-first",
			laneId: "lane-oi-reader-first",
			agentRef: "agent-test",
			providerQualifiedModelId: "openai/gpt-5.5",
			promptText: "first task",
			parentSessionId: "parent-oi-reader",
			rootDir: root,
			client,
			asyncMode: false,
			oiEnabled: true,
			_launchTimeoutMs: 5_000,
			_nudgeQuietPeriodMs: 50,
			_messagesTimeoutMs: 50,
		});

		// Small delay so captured_at differs.
		await new Promise<void>((resolve) => setTimeout(resolve, 5));

		await executeFlowDeskAgentTaskV1({
			workflowId: "workflow-oi-reader-1",
			taskId: "task-oi-reader-second",
			laneId: "lane-oi-reader-second",
			agentRef: "agent-test",
			providerQualifiedModelId: "openai/gpt-5.5",
			promptText: "second task",
			parentSessionId: "parent-oi-reader",
			rootDir: root,
			client,
			asyncMode: false,
			oiEnabled: true,
			_launchTimeoutMs: 5_000,
			_nudgeQuietPeriodMs: 50,
			_messagesTimeoutMs: 50,
		});

		// Reader: load up to 5 most recent summaries.
		const summaries = await loadRecentOISessionSummariesV1({
			durableStateRoot: root,
			workflowId: "workflow-oi-reader-1",
			maxCount: 5,
		});

		assert.ok(summaries.length >= 2, `expected at least 2 summaries, got ${summaries.length}`);

		// All returned summaries must have a valid schema_version.
		for (const s of summaries) {
			assert.equal(s.schema_version, "flowdesk.oi_session_summary.v1");
		}

		// Sorted newest-first: first summary's captured_at >= second's.
		const first = summaries[0]!;
		const second = summaries[1]!;
		const firstAt = Date.parse(first.captured_at);
		const secondAt = Date.parse(second.captured_at);
		assert.ok(firstAt >= secondAt, `newest-first order violated: ${first.captured_at} < ${second.captured_at}`);
	} finally {
		rmSync(root, { recursive: true, force: true });
	}
});

test("loadRecentOISessionSummariesV1 returns empty array for unknown workflowId", async () => {
	const root = mkdtempSync(join(tmpdir(), "flowdesk-oi-reader-empty-"));
	try {
		const summaries = await loadRecentOISessionSummariesV1({
			durableStateRoot: root,
			workflowId: "workflow-does-not-exist",
		});
		assert.deepEqual(summaries, [], "no summaries should be returned for unknown workflow");
	} finally {
		rmSync(root, { recursive: true, force: true });
	}
});
