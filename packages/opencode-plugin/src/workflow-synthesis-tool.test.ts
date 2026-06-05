import assert from "node:assert/strict";
import test from "node:test";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
	applyFlowDeskSessionEvidenceWriteIntentsV1,
	prepareFlowDeskSessionEvidenceWriteIntentV1,
	reloadFlowDeskSessionEvidenceV1,
} from "@flowdesk/core";
import { executeFlowDeskWorkflowSynthesisPreviewV1 } from "./workflow-synthesis-tool.js";

function writeTaskResult(rootDir: string, workflowId: string, resultText = "Summarized result for the completed task."): void {
	const prepared = prepareFlowDeskSessionEvidenceWriteIntentV1({
		workflowId,
		evidenceId: "task-result-preview-1",
		record: {
			schema_version: "flowdesk.task_result.v1",
			workflow_id: workflowId,
			lane_id: "lane-preview-1",
			task_id: "task-preview-1",
			agent_ref: "agent-test",
			provider_qualified_model_id: "openai/gpt-5.5",
			task_prompt_sha256: "a".repeat(64),
			result_text: resultText,
			result_text_truncated: false,
			result_text_sha256: "b".repeat(64),
			completion_status: "final",
			output_kind: "final_answer",
			usable_for_synthesis: true,
			missing_contract: false,
			created_at: "2026-05-29T00:00:00.000Z",
			dispatch_authority_enabled: false,
		},
	});
	assert.equal(prepared.ok, true, prepared.errors?.join("; "));
	if (!prepared.ok || prepared.writeIntent === undefined) return;
	const applied = applyFlowDeskSessionEvidenceWriteIntentsV1(rootDir, [prepared.writeIntent]);
	assert.equal(applied.ok, true);
}

test("workflow synthesis preview writes provider-free synthesis evidence", () => {
	const rootDir = mkdtempSync(join(tmpdir(), "flowdesk-synthesis-preview-"));
	try {
		const workflowId = "workflow-synthesis-preview-test";
		writeTaskResult(rootDir, workflowId);
		const result = executeFlowDeskWorkflowSynthesisPreviewV1({ workflowId, rootDir });
		assert.equal(result.status, "workflow_synthesis_completed");
		assert.equal(result.authority.providerCall, false);
		assert.equal(result.authority.runtimeExecution, false);
		assert.equal(result.authority.actualLaneLaunch, false);
		assert.match(result.summaryForUser, /Provider-free synthesis preview/);
		assert.match(result.summaryForUser, /Summarized result for the completed task\./);
		assert.equal(result.taskResultExcerpts?.[0]?.resultText, "Summarized result for the completed task.");
		const reloaded = reloadFlowDeskSessionEvidenceV1({ rootDir, workflowId });
		assert.equal(reloaded.ok, true);
		assert.equal(reloaded.entries.filter((entry) => entry.evidenceClass === "workflow_synthesis_result").length, 1);
		assert.equal(reloaded.entries.some((entry) => entry.evidenceClass === "agent_task_child_session"), false);
		const autoNext = JSON.parse(readFileSync(join(rootDir, ".flowdesk", "ui", "auto-next-ready.json"), "utf8")) as Record<string, unknown>;
		assert.deepEqual(autoNext.workflows, []);
		const latestSynthesis = JSON.parse(readFileSync(join(rootDir, ".flowdesk", "ui", "latest-synthesis.json"), "utf8")) as Record<string, unknown>;
		assert.equal(latestSynthesis.schema_version, "flowdesk.latest_synthesis_cache.v1");
		assert.equal(Array.isArray(latestSynthesis.syntheses), true);
		const synthesisRows = latestSynthesis.syntheses as Array<Record<string, unknown>>;
		assert.equal(synthesisRows.length, 1);
		assert.equal(synthesisRows[0].workflowId, workflowId);
		assert.equal(synthesisRows[0].synthesisId, result.synthesisId);
		assert.match(String(synthesisRows[0].summaryPreview), /Provider-free synthesis preview/);
		assert.deepEqual(latestSynthesis.authority, { displayOnly: true, realOpenCodeDispatch: false, providerCall: false, runtimeExecution: false, actualLaneLaunch: false, fallbackAuthority: false, hardCancelOrNoReplyAuthority: false });
		const second = executeFlowDeskWorkflowSynthesisPreviewV1({ workflowId, rootDir });
		assert.equal(second.status, "workflow_synthesis_completed");
		assert.equal(second.synthesisId, result.synthesisId);
		assert.equal(second.summaryForUser, result.summaryForUser);
		const reloadedAfterSecond = reloadFlowDeskSessionEvidenceV1({ rootDir, workflowId });
		assert.equal(reloadedAfterSecond.ok, true);
		assert.equal(reloadedAfterSecond.entries.filter((entry) => entry.evidenceClass === "workflow_synthesis_result").length, 1);
	} finally {
		rmSync(rootDir, { recursive: true, force: true });
	}
});

test("workflow synthesis preview exposes bounded result_text excerpt with line breaks", () => {
	const rootDir = mkdtempSync(join(tmpdir(), "flowdesk-synthesis-preview-lines-"));
	try {
		const workflowId = "workflow-synthesis-preview-lines-test";
		writeTaskResult(rootDir, workflowId, "Line one\nLine two\n- bullet three");
		const result = executeFlowDeskWorkflowSynthesisPreviewV1({ workflowId, rootDir });
		assert.equal(result.status, "workflow_synthesis_completed");
		assert.equal(result.taskResultExcerpts?.length, 1);
		assert.equal(result.taskResultExcerpts?.[0]?.resultText, "Line one\nLine two\n- bullet three");
		assert.equal(result.taskResultExcerpts?.[0]?.truncated, false);
		assert.match(result.summaryForUser, /Line one\nLine two\n- bullet three/);
		const second = executeFlowDeskWorkflowSynthesisPreviewV1({ workflowId, rootDir });
		assert.equal(second.synthesisId, result.synthesisId);
		assert.equal(second.taskResultExcerpts?.[0]?.resultText, "Line one\nLine two\n- bullet three");
	} finally {
		rmSync(rootDir, { recursive: true, force: true });
	}
});

test("workflow synthesis preview redacts forbidden task_result excerpts", () => {
	const rootDir = mkdtempSync(join(tmpdir(), "flowdesk-synthesis-preview-redact-"));
	try {
		const workflowId = "workflow-synthesis-preview-redact-test";
		writeTaskResult(rootDir, workflowId, "provider payload should not be surfaced");
		const result = executeFlowDeskWorkflowSynthesisPreviewV1({ workflowId, rootDir });
		assert.equal(result.status, "workflow_synthesis_completed");
		assert.deepEqual(result.taskResultExcerpts, []);
		assert.doesNotMatch(result.summaryForUser, /provider payload/);
		assert.match(result.summaryForUser, /\(redacted\)/);
	} finally {
		rmSync(rootDir, { recursive: true, force: true });
	}
});
