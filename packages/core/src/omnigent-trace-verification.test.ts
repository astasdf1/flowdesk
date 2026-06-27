import assert from "node:assert/strict";
import test from "node:test";
import { validateFlowDeskOmnigentTraceVerificationV1 } from "./index.js";

function verification(overrides: Record<string, unknown> = {}) {
	return {
		schema_version: "flowdesk.omnigent_trace_verification.v1",
		status: "pass",
		selection_count: 1,
		dispatch_count: 1,
		error_count: 0,
		warning_count: 0,
		issues: [],
		authority: "verification_only",
		...overrides,
	};
}

test("omnigent trace verification accepts passing verification-only result", () => {
	const result = validateFlowDeskOmnigentTraceVerificationV1(verification());
	assert.equal(result.ok, true, result.errors.join("; "));
});

test("omnigent trace verification accepts failing result with counted issue", () => {
	const result = validateFlowDeskOmnigentTraceVerificationV1(verification({
		status: "fail",
		error_count: 1,
		issues: [{ severity: "error", code: "dispatch_without_prior_selection", task_id: "task-x" }],
	}));
	assert.equal(result.ok, true, result.errors.join("; "));
});

test("omnigent trace verification rejects authority smuggling and raw markers", () => {
	assert.equal(validateFlowDeskOmnigentTraceVerificationV1(verification({ authority: "dispatch_gate" })).ok, false);
	assert.equal(validateFlowDeskOmnigentTraceVerificationV1(verification({ issues: [{ severity: "warning", code: "x", detail: "SECRET_TOKEN" }], warning_count: 1 })).ok, false);
	assert.equal(validateFlowDeskOmnigentTraceVerificationV1(verification({ status: "pass", error_count: 1, issues: [{ severity: "error", code: "x" }] })).ok, false);
});
