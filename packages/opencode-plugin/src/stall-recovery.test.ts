import assert from "node:assert/strict";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { createHash } from "node:crypto";
import {
	applyFlowDeskSessionEvidenceWriteIntentsV1,
	prepareFlowDeskSessionEvidenceWriteIntentV1,
	reloadFlowDeskSessionEvidenceV1,
	type FlowDeskLaneLifecycleRecordV1,
} from "@flowdesk/core";
import { createFlowDeskLocalNonDispatchAdapterSession } from "./local-adapter.js";
import { validateAndAbortFlowDeskLaneEvidenceV1 } from "./stall-recovery.js";
import {
	computeGuardSignOffHmacV1,
	evaluateGuardedAutoAbortHookV1,
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
