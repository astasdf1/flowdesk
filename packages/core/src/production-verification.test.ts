import assert from "node:assert/strict";
import test from "node:test";
import {
	createFlowDeskConfiguredVerificationResultV1,
	validateFlowDeskConfiguredVerificationResultV1,
} from "./production-verification.js";

const workflowId = "workflow-prod-1";
const verificationRef = "verification-1";

function result() {
	return createFlowDeskConfiguredVerificationResultV1({
		verificationRef,
		workflowId,
		result: "passed",
		producedAt: "2026-05-21T00:00:00.000Z",
		sourceRef: "configured-verification-source-1",
		checkLabels: ["typecheck", "unit-tests"],
		evidenceRefs: ["configured-verification-evidence-1"],
	});
}

test("configured verification result validates redacted non-authorizing artifacts", () => {
	const artifact = result();
	assert.equal(artifact.raw_output_redacted, true);
	assert.equal(artifact.provider_call_made, false);
	assert.equal(artifact.runtime_execution_made, false);
	assert.equal(artifact.actual_lane_launch_made, false);
	assert.equal(artifact.dispatch_authority_enabled, false);
	assert.deepEqual(artifact.safe_next_actions, ["/flowdesk-status"]);
	assert.equal(
		validateFlowDeskConfiguredVerificationResultV1(
			artifact,
			workflowId,
			verificationRef,
		).ok,
		true,
	);
});

test("configured verification result rejects mismatches and authority smuggling", () => {
	const artifact = result();

	const mismatch = validateFlowDeskConfiguredVerificationResultV1(
		artifact,
		workflowId,
		"verification-other",
	);
	assert.equal(mismatch.ok, false);
	assert.match(mismatch.errors.join("; "), /ref mismatch/);

	const authority = validateFlowDeskConfiguredVerificationResultV1({
		...artifact,
		provider_call_made: true,
		runtime_execution_made: true,
		actual_lane_launch_made: true,
		dispatch_authority_enabled: true,
	});
	assert.equal(authority.ok, false);
	assert.match(authority.errors.join("; "), /provider calls/);
	assert.match(authority.errors.join("; "), /runtime execution/);
	assert.match(authority.errors.join("; "), /launch lanes/);
	assert.match(authority.errors.join("; "), /dispatch authority/);
});

test("configured verification result rejects raw payloads and unknown properties", () => {
	const raw = validateFlowDeskConfiguredVerificationResultV1({
		...result(),
		source_ref: "/Users/example/private.txt",
		unknown_field: "not-allowed",
	});
	assert.equal(raw.ok, false);
	assert.match(raw.errors.join("; "), /unknown properties/);
	assert.match(raw.errors.join("; "), /raw path marker/);
});
