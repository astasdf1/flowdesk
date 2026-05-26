import assert from "node:assert/strict";
import test from "node:test";
import {
	validateFlowDeskPendingAbortCancelV1,
	validateFlowDeskPendingAbortWarningV1,
} from "./pending-abort.js";

function warning(overrides: Record<string, unknown> = {}) {
	return {
		schema_version: "flowdesk.pending_abort_warning.v1",
		warning_id: "warning-123",
		workflow_id: "workflow-stall-recovery-123",
		lane_id: "lane-123",
		warning_issued_at: "2026-05-26T00:00:00.000Z",
		expires_at: "2026-05-26T00:01:00.000Z",
		cancel_command: "/flowdesk-abort lane-123 cancel",
		status: "pending",
		dispatch_authority_enabled: false,
		...overrides,
	};
}

function cancel(overrides: Record<string, unknown> = {}) {
	return {
		schema_version: "flowdesk.pending_abort_cancel.v1",
		cancel_id: "cancel-123",
		warning_id_ref: "warning-123",
		workflow_id: "workflow-stall-recovery-123",
		lane_id: "lane-123",
		cancelled_at: "2026-05-26T00:00:10.000Z",
		cancel_reason: "user_requested_via_command",
		cancel_actor: "user",
		dispatch_authority_enabled: false,
		...overrides,
	};
}

test("pending abort warning validates tombstone states without authority", () => {
	for (const status of ["pending", "cancelled", "executed", "tombstoned"]) {
		assert.equal(validateFlowDeskPendingAbortWarningV1(warning({ status })).ok, true);
	}
	assert.equal(validateFlowDeskPendingAbortWarningV1(warning({ status: "deleted" })).ok, false);
	assert.equal(validateFlowDeskPendingAbortWarningV1(warning({ dispatch_authority_enabled: true })).ok, false);
});

test("pending abort cancel only accepts user actor and scoped reason", () => {
	assert.equal(validateFlowDeskPendingAbortCancelV1(cancel()).ok, true);
	assert.equal(validateFlowDeskPendingAbortCancelV1(cancel({ cancel_actor: "system" })).ok, false);
	assert.equal(validateFlowDeskPendingAbortCancelV1(cancel({ cancel_reason: "raw prompt" })).ok, false);
	assert.equal(validateFlowDeskPendingAbortCancelV1(cancel({ dispatch_authority_enabled: true })).ok, false);
});
