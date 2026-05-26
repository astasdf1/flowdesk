import assert from "node:assert/strict";
import test from "node:test";
import {
	validateFlowDeskReviewerLaneContextV1,
	validateFlowDeskPendingRetryPlanV1,
	validateFlowDeskRetryExecutedV1,
	validateFlowDeskRetryFailedV1,
} from "./retry-plan.js";

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

function reviewerLaneContext(overrides: Record<string, unknown> = {}) {
	return {
		schema_version: "flowdesk.reviewer_lane_context.v1",
		workflow_id: "workflow-quick-reviewer-abc123",
		lane_id: "lane-quick-policy-security-abc123",
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

function pendingRetryPlan(overrides: Record<string, unknown> = {}) {
	return {
		schema_version: "flowdesk.pending_retry_plan.v1",
		workflow_id: "workflow-quick-reviewer-abc123",
		original_lane_id: "lane-quick-policy-security-abc123",
		new_lane_id: "lane-retry-lane-quick-policy-security-abc123-20260526",
		retry_attempt: 1,
		context_evidence_id: "reviewer-lane-context-001",
		abort_evidence_id: "pending-abort-warning-001",
		status: "pending",
		created_at: "2026-05-26T10:00:00.000Z",
		expires_at: "2026-05-26T11:00:00.000Z",
		dispatch_authority_enabled: false,
		...overrides,
	};
}

function retryExecuted(overrides: Record<string, unknown> = {}) {
	return {
		schema_version: "flowdesk.retry_executed.v1",
		workflow_id: "workflow-quick-reviewer-abc123",
		original_lane_id: "lane-quick-policy-security-abc123",
		new_lane_id: "lane-retry-lane-quick-policy-security-abc123-20260526",
		retry_attempt: 1,
		perspective: "policy_security",
		provider_qualified_model_id: "openai/gpt-5.5",
		new_parent_session_ref: "ses-retry-child-001",
		original_attempt_id: "attempt-001",
		created_at: "2026-05-26T10:00:00.000Z",
		dispatch_authority_enabled: false,
		...overrides,
	};
}

function retryFailed(overrides: Record<string, unknown> = {}) {
	return {
		schema_version: "flowdesk.retry_failed.v1",
		workflow_id: "workflow-quick-reviewer-abc123",
		original_lane_id: "lane-quick-policy-security-abc123",
		new_lane_id: "lane-retry-lane-quick-policy-security-abc123-20260526",
		retry_attempt: 1,
		failure_category: "sdk_unavailable",
		redacted_reason: "sdk_client_missing_or_session_create_unavailable",
		created_at: "2026-05-26T10:00:00.000Z",
		dispatch_authority_enabled: false,
		...overrides,
	};
}

// ---------------------------------------------------------------------------
// reviewer lane context validator
// ---------------------------------------------------------------------------

test("reviewer lane context validator accepts valid records", () => {
	assert.equal(validateFlowDeskReviewerLaneContextV1(reviewerLaneContext()).ok, true);
	// All three valid perspectives
	for (const perspective of ["policy_security", "architecture", "verification_implementation"]) {
		assert.equal(
			validateFlowDeskReviewerLaneContextV1(reviewerLaneContext({ perspective })).ok,
			true,
		);
	}
	// prompt_text_truncated: true is valid
	assert.equal(
		validateFlowDeskReviewerLaneContextV1(reviewerLaneContext({ prompt_text_truncated: true })).ok,
		true,
	);
});

test("reviewer lane context validator rejects missing redaction_version", () => {
	const result = validateFlowDeskReviewerLaneContextV1(
		reviewerLaneContext({ redaction_version: "" }),
	);
	assert.equal(result.ok, false);
	assert.equal(result.errors.some((e) => e.includes("redaction_version")), true);
});

test("reviewer lane context validator rejects dispatch_authority_enabled: true", () => {
	const result = validateFlowDeskReviewerLaneContextV1(
		reviewerLaneContext({ dispatch_authority_enabled: true }),
	);
	assert.equal(result.ok, false);
	assert.equal(result.errors.some((e) => e.includes("dispatch authority")), true);
});

// ---------------------------------------------------------------------------
// pending retry plan validator
// ---------------------------------------------------------------------------

test("pending retry plan validator accepts all status values", () => {
	for (const status of ["pending", "launched", "failed", "cancelled", "superseded", "expired"]) {
		assert.equal(
			validateFlowDeskPendingRetryPlanV1(pendingRetryPlan({ status })).ok,
			true,
			`status=${status} should be valid`,
		);
	}
});

test("pending retry plan validator rejects invalid status", () => {
	const result = validateFlowDeskPendingRetryPlanV1(pendingRetryPlan({ status: "unknown_state" }));
	assert.equal(result.ok, false);
	assert.equal(result.errors.some((e) => e.includes("status")), true);
});

// ---------------------------------------------------------------------------
// retry executed validator
// ---------------------------------------------------------------------------

test("retry executed validator accepts valid record", () => {
	assert.equal(validateFlowDeskRetryExecutedV1(retryExecuted()).ok, true);
	// All perspectives valid
	for (const perspective of ["policy_security", "architecture", "verification_implementation"]) {
		assert.equal(
			validateFlowDeskRetryExecutedV1(retryExecuted({ perspective })).ok,
			true,
		);
	}
	// retry_attempt >= 1 required
	assert.equal(validateFlowDeskRetryExecutedV1(retryExecuted({ retry_attempt: 2 })).ok, true);
	assert.equal(validateFlowDeskRetryExecutedV1(retryExecuted({ retry_attempt: 0 })).ok, false);
	assert.equal(validateFlowDeskRetryExecutedV1(retryExecuted({ dispatch_authority_enabled: true })).ok, false);
});

// ---------------------------------------------------------------------------
// retry failed validator
// ---------------------------------------------------------------------------

test("retry failed validator accepts all failure categories", () => {
	const categories = [
		"opt_in_false",
		"guard_unverified",
		"context_missing",
		"context_redaction_invalid",
		"cap_reached",
		"sdk_unavailable",
		"invariant_violated",
		"concurrent_retry_in_progress",
		"lane_not_terminal_aborted",
		"sdk_create_failed",
		"sdk_prompt_rejected",
		"indeterminate_launch",
	];
	for (const failure_category of categories) {
		assert.equal(
			validateFlowDeskRetryFailedV1(retryFailed({ failure_category })).ok,
			true,
			`failure_category=${failure_category} should be valid`,
		);
	}
	// new_lane_id is optional — omitting it should be valid
	const { new_lane_id: _omit, ...noNewLaneId } = retryFailed();
	assert.equal(validateFlowDeskRetryFailedV1(noNewLaneId).ok, true);
});

test("retry failed validator rejects dispatch_authority_enabled: true", () => {
	const result = validateFlowDeskRetryFailedV1(
		retryFailed({ dispatch_authority_enabled: true }),
	);
	assert.equal(result.ok, false);
	assert.equal(result.errors.some((e) => e.includes("dispatch authority")), true);
});
