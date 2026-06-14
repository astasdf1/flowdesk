import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import {
	applyFlowDeskSessionEvidenceWriteIntentsV1,
	prepareFlowDeskSessionEvidenceWriteIntentV1,
	type FlowDeskManagedDispatchBundleEvaluationV1,
} from "@flowdesk/core";
import { createFlowDeskLocalNonDispatchAdapterSession } from "./local-adapter.js";

function baseEvaluation(
	overrides: Partial<FlowDeskManagedDispatchBundleEvaluationV1>,
): FlowDeskManagedDispatchBundleEvaluationV1 {
	return {
		schema_version: "flowdesk.managed_dispatch_bundle_evaluation.v1",
		workflow_id: "workflow-local",
		attempt_id: "attempt-bundle-doctor",
		gate_result: "pass",
		managed_dispatch_bundle_passed: true,
		items: [],
		blocked_items: [],
		blocked_labels: [],
		evidence_refs: ["evidence-a", "evidence-b"],
		dispatch_authority_enabled: false,
		fallback_authority_enabled: false,
		hard_chat_authority_enabled: false,
		external_write_authority_enabled: false,
		providerCall: false,
		actualLaneLaunch: false,
		runtimeExecution: false,
		...overrides,
	};
}

function writeBundleEvaluation(
	root: string,
	record: FlowDeskManagedDispatchBundleEvaluationV1,
): void {
	const prepared = prepareFlowDeskSessionEvidenceWriteIntentV1({
		workflowId: record.workflow_id ?? "workflow-local",
		evidenceId: "bundle-evaluation-doctor",
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
		new Date("2026-06-15T00:00:00.000Z"),
		undefined,
		{ durableStateRootDir: root },
	);
	const result = session.evaluate("flowdesk_doctor", {
		schema_version: "flowdesk.doctor.request.v1",
		request_id: "request-bundle-doctor",
		input_mode: "test_fixture",
		check_scope: "all",
		profile: "test",
		persist_report: false,
	});
	assert.equal(result.handler.ok, true, result.handler.errors.join("; "));
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
	const root = mkdtempSync(join(tmpdir(), "flowdesk-bundle-doctor-"));
	try {
		run(root);
	} finally {
		rmSync(root, { recursive: true, force: true });
	}
}

test("doctor surfaces managed dispatch bundle pass summary", () => {
	withTempRoot((root) => {
		writeBundleEvaluation(root, baseEvaluation({}));
		const refs = doctorRefs(root);
		assert.ok(refs.includes("managed_dispatch_bundle_gate_result=pass"));
		assert.ok(refs.includes("managed_dispatch_bundle_blocked_items_count=0"));
		assert.ok(refs.includes("managed_dispatch_bundle_evidence_refs_count=2"));
	});
});

test("doctor surfaces managed dispatch bundle blocked item labels", () => {
	withTempRoot((root) => {
		writeBundleEvaluation(
			root,
			baseEvaluation({
				gate_result: "blocked",
				managed_dispatch_bundle_passed: false,
				blocked_items: ["fresh_usage_provider_health"],
				blocked_labels: ["fresh_usage_provider_health_blocked"],
				evidence_refs: ["usage-ref"],
			}),
		);
		const refs = doctorRefs(root);
		assert.ok(refs.includes("managed_dispatch_bundle_gate_result=blocked"));
		assert.ok(refs.includes("managed_dispatch_bundle_blocked_items_count=1"));
		assert.ok(
			refs.includes(
				"managed_dispatch_bundle_blocked_item=fresh_usage_provider_health",
			),
		);
		assert.ok(
			refs.includes(
				"managed_dispatch_bundle_blocked_label=fresh_usage_provider_health_blocked",
			),
		);
	});
});

test("doctor reports managed dispatch bundle not yet evaluated when absent", () => {
	withTempRoot((root) => {
		const refs = doctorRefs(root);
		assert.ok(refs.includes("managed_dispatch_bundle_status=not_yet_evaluated"));
	});
});
