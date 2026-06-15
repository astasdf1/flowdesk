import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { reloadFlowDeskSessionEvidenceV1 } from "@flowdesk/core";
import {
	observeAndFinalizeManagedDispatchLaneV1,
	type FlowDeskManagedDispatchBetaOpenCodeClientV1,
} from "./managed-dispatch-adapter.js";

const observedAt = "2026-05-17T00:00:00.000Z";

type SmokeMode = "text" | "throw" | "empty";

function fakeLaneMessagesResponse(text: string): unknown {
	return [
		{
			info: { role: "assistant", status: "complete" },
			parts: [
				{ type: "text", text },
				{ type: "step-finish", reason: "stop" },
			],
		},
	];
}

function fakeAcceptedLaneClient(mode: SmokeMode): FlowDeskManagedDispatchBetaOpenCodeClientV1 {
	return {
		session: {
			messages() {
				if (mode === "throw") throw new Error("messages read failed");
				if (mode === "empty") return Promise.resolve([]);
				return Promise.resolve(fakeLaneMessagesResponse("Managed dispatch lane completed with text output."));
			},
		},
	};
}

function runIds(suffix: string) {
	return {
		workflowId: `workflow-terminal-smoke-${suffix}`,
		attemptId: `attempt-terminal-smoke-${suffix}`,
		laneId: `lane-terminal-smoke-${suffix}`,
		childSessionId: `child-terminal-smoke-${suffix}`,
	};
}

async function finalize(rootDir: string, mode: SmokeMode, suffix: string) {
	const ids = runIds(suffix);
	const result = await observeAndFinalizeManagedDispatchLaneV1({
		client: fakeAcceptedLaneClient(mode),
		rootDir,
		workflowId: ids.workflowId,
		attemptId: ids.attemptId,
		laneId: ids.laneId,
		childSessionId: ids.childSessionId,
		agentRef: "agent-build",
		providerQualifiedModelId: "claude/sonnet-4",
		parentSessionRef: "ses-terminal-smoke-parent",
		now: () => new Date(observedAt),
	});
	const reloaded = reloadFlowDeskSessionEvidenceV1({
		workflowId: ids.workflowId,
		rootDir,
	});
	assert.equal(reloaded.ok, true, reloaded.errors.join("; "));
	assert.equal(reloaded.blocked.length, 0, reloaded.blocked.join("; "));
	return { ids, result, reloaded };
}

function assertTerminalLifecycle(
	entries: ReturnType<typeof reloadFlowDeskSessionEvidenceV1>["entries"],
	laneId: string,
	state: string,
) {
	const lifecycle = entries.find(
		(entry) =>
			entry.evidenceClass === "lane_lifecycle" &&
			entry.record.lane_id === laneId &&
			entry.record.state === state,
	);
	assert.ok(lifecycle, `expected terminal lane_lifecycle state=${state}`);
	return lifecycle;
}

function assertNoTerminalEvidenceAuthority(entries: ReturnType<typeof reloadFlowDeskSessionEvidenceV1>["entries"]) {
	for (const entry of entries) {
		if (![
			"lane_lifecycle",
			"task_result",
			"task_failed",
			"terminal_lifecycle",
		].includes(entry.evidenceClass)) continue;
		const record = entry.record as Record<string, unknown>;
		assert.notEqual(record.dispatch_authority_enabled, true, `${entry.evidenceId} dispatch_authority_enabled`);
		assert.notEqual(record.fallback_authority_enabled, true, `${entry.evidenceId} fallback_authority_enabled`);
		assert.notEqual(record.providerCall, true, `${entry.evidenceId} providerCall`);
		assert.notEqual(record.actualLaneLaunch, true, `${entry.evidenceId} actualLaneLaunch`);
		assert.notEqual(record.runtimeExecution, true, `${entry.evidenceId} runtimeExecution`);
	}
}

test("managed dispatch terminal smoke: accepted lane text output finalizes complete with task_result linkage", async () => {
	const rootDir = mkdtempSync(join(tmpdir(), "flowdesk-managed-dispatch-terminal-text-"));
	try {
		const { ids, result, reloaded } = await finalize(rootDir, "text", "text");
		assert.equal(result.status, "lane_finalized");
		assert.equal(result.terminalLinkageVerified, true);
		assert.ok(result.taskResultEvidenceId);
		assert.ok(result.terminalLifecycleEvidenceId);
		assertTerminalLifecycle(reloaded.entries, ids.laneId, "complete");
		assert.ok(
			reloaded.entries.some(
				(entry) => entry.evidenceClass === "task_result" && entry.record.lane_id === ids.laneId,
			),
			"expected task_result evidence for text output",
		);
		assertNoTerminalEvidenceAuthority(reloaded.entries);
	} finally {
		rmSync(rootDir, { recursive: true, force: true });
	}
});

test("managed dispatch terminal smoke: accepted lane messages throw writes task_failed and failed lifecycle", async () => {
	const rootDir = mkdtempSync(join(tmpdir(), "flowdesk-managed-dispatch-terminal-throw-"));
	try {
		const { ids, result, reloaded } = await finalize(rootDir, "throw", "throw");
		assert.equal(result.status, "lane_no_output");
		assert.equal(result.terminalLinkageVerified, true);
		assertTerminalLifecycle(reloaded.entries, ids.laneId, "invocation_failed");
		assert.ok(
			reloaded.entries.some(
				(entry) =>
					entry.evidenceClass === "task_failed" &&
					entry.record.lane_id === ids.laneId &&
					entry.record.failure_category === "provider_dispatch_error",
			),
			"expected task_failed evidence when messages throws",
		);
		assertNoTerminalEvidenceAuthority(reloaded.entries);
	} finally {
		rmSync(rootDir, { recursive: true, force: true });
	}
});

test("managed dispatch terminal smoke: accepted lane empty messages finalizes no_output without task_failed", async () => {
	const rootDir = mkdtempSync(join(tmpdir(), "flowdesk-managed-dispatch-terminal-empty-"));
	try {
		const { ids, result, reloaded } = await finalize(rootDir, "empty", "empty");
		assert.equal(result.status, "lane_no_output");
		assert.equal(result.terminalLinkageVerified, true);
		assertTerminalLifecycle(reloaded.entries, ids.laneId, "no_output");
		assert.equal(
			reloaded.entries.some((entry) => entry.evidenceClass === "task_failed" && entry.record.lane_id === ids.laneId),
			false,
			"empty/no text should remain distinct from messages read failure",
		);
		assertNoTerminalEvidenceAuthority(reloaded.entries);
	} finally {
		rmSync(rootDir, { recursive: true, force: true });
	}
});

test("managed dispatch terminal smoke: all terminal evidence keeps authority flags disabled", async () => {
	for (const mode of ["text", "throw", "empty"] as const) {
		const rootDir = mkdtempSync(join(tmpdir(), `flowdesk-managed-dispatch-terminal-authority-${mode}-`));
		try {
			const { reloaded } = await finalize(rootDir, mode, `authority-${mode}`);
			assertNoTerminalEvidenceAuthority(reloaded.entries);
		} finally {
			rmSync(rootDir, { recursive: true, force: true });
		}
	}
});
