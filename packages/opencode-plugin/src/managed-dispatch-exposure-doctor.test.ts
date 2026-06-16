import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import {
	applyFlowDeskSessionEvidenceWriteIntentsV1,
	evaluateFlowDeskManagedDispatchExposureAuthorizationV1,
	FLOWDESK_S7_REQUIRED_S6_TUPLE,
	prepareFlowDeskSessionEvidenceWriteIntentV1,
} from "@flowdesk/core";
import { createFlowDeskLocalNonDispatchAdapterSession } from "./local-adapter.js";

const workflowId = FLOWDESK_S7_REQUIRED_S6_TUPLE.workflow_id;

function taskResult(overrides: Record<string, unknown> = {}) {
	return {
		schema_version: "flowdesk.task_result.v1",
		workflow_id: workflowId,
		lane_id: FLOWDESK_S7_REQUIRED_S6_TUPLE.lane_id,
		task_id: FLOWDESK_S7_REQUIRED_S6_TUPLE.task_id,
		agent_ref: "agent-flowdesk-s6-smoke",
		provider_qualified_model_id: "openai/gpt-5.5",
		task_prompt_sha256: "sha256-s6-input-digest",
		result_text: `S6 completed. ${FLOWDESK_S7_REQUIRED_S6_TUPLE.sentinel}`,
		result_text_truncated: false,
		result_text_sha256: "sha256-s6-result",
		created_at: "2026-06-15T11:55:00.000Z",
		dispatch_authority_enabled: false,
		...overrides,
	};
}

function authorization(overrides: Record<string, unknown> = {}) {
	return evaluateFlowDeskManagedDispatchExposureAuthorizationV1({
		taskResultEvidence: taskResult(),
		taskResultEvidenceId: FLOWDESK_S7_REQUIRED_S6_TUPLE.result_evidence_id,
		progressSnapshotWorkflowId:
			FLOWDESK_S7_REQUIRED_S6_TUPLE.progress_snapshot_workflow_id,
		now: "2026-06-15T12:00:00.000Z",
		...overrides,
	});
}

function writeAuthorization(root: string, record: ReturnType<typeof authorization>): void {
	const prepared = prepareFlowDeskSessionEvidenceWriteIntentV1({
		workflowId,
		evidenceId: "managed-dispatch-exposure-authorization-doctor",
		record,
	});
	assert.equal(prepared.ok, true, prepared.errors.join("; "));
	assert.ok(prepared.writeIntent);
	const applied = applyFlowDeskSessionEvidenceWriteIntentsV1(root, [
		prepared.writeIntent,
	]);
	assert.equal(applied.ok, true, applied.errors.join("; "));
}

function doctorRefs(root: string): string[] {
	const session = createFlowDeskLocalNonDispatchAdapterSession(
		new Date("2026-06-15T12:00:00.000Z"),
		undefined,
		{ durableStateRootDir: root },
	);
	const result = session.evaluate("flowdesk_doctor", {
		schema_version: "flowdesk.doctor.request.v1",
		request_id: "request-s7-exposure-doctor",
		input_mode: "test_fixture",
		check_scope: "all",
		profile: "test",
		persist_report: false,
	});
	assert.equal(result.handler.ok, true, result.handler.errors.join("; "));
	assert.equal(result.handler.realOpenCodeDispatch, false);
	assert.equal(result.handler.actualLaneLaunch, false);
	assert.equal(result.handler.providerCall, false);
	assert.equal(result.handler.runtimeExecution, false);
	const response = result.handler.response as {
		doctor_results?: Array<{ section?: string; refs?: string[] }>;
	};
	const compatibility = response.doctor_results?.find(
		(section) => section.section === "opencode_plugin_compatibility",
	);
	assert.ok(compatibility);
	return compatibility.refs ?? [];
}

function withTempRoot(run: (root: string) => void): void {
	const root = mkdtempSync(join(tmpdir(), "flowdesk-s7-exposure-doctor-"));
	try {
		run(root);
	} finally {
		rmSync(root, { recursive: true, force: true });
	}
}

test("doctor reloads registered S7 exposure authorization evidence as authorized", () => {
	withTempRoot((root) => {
		writeAuthorization(root, authorization());
		const refs = doctorRefs(root);
		assert.ok(refs.includes("s7_managed_dispatch_exposure_state=authorized"));
		assert.ok(
			refs.includes(
				"s7_managed_dispatch_exposure_evidence_ref=managed-dispatch-exposure-authorization-doctor",
			),
		);
		assert.ok(
			refs.includes(
				"s7_managed_dispatch_exposure_dispatch_authority_enabled=false",
			),
		);
	});
});

test("doctor reloads registered blocked S7 exposure authorization evidence as blocked", () => {
	withTempRoot((root) => {
		writeAuthorization(root, authorization({ taskResultEvidenceId: "task-result-wrong" }));
		const refs = doctorRefs(root);
		assert.ok(refs.includes("s7_managed_dispatch_exposure_state=blocked"));
		assert.ok(
			refs.includes(
				"s7_managed_dispatch_exposure_block_label=s6_result_evidence_mismatched",
			),
		);
	});
});

test("doctor reports S7 exposure authorization unknown when no registered evidence exists", () => {
	withTempRoot((root) => {
		const refs = doctorRefs(root);
		assert.ok(refs.includes("s7_managed_dispatch_exposure_state=unknown"));
		assert.ok(
			refs.includes("s7_managed_dispatch_exposure_evidence=not_yet_evaluated"),
		);
	});
});
