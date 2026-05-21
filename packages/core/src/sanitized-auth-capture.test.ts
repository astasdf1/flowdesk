import assert from "node:assert/strict";
import test from "node:test";
import {
	createFlowDeskSanitizedAuthCaptureResultV1,
	validateFlowDeskSanitizedAuthCaptureResultV1,
} from "./sanitized-auth-capture.js";

const workflowId = "workflow-prod-1";
const sanitizedAuthCaptureRef = "sanitized-auth-capture-1";

function result() {
	return createFlowDeskSanitizedAuthCaptureResultV1({
		sanitizedAuthCaptureRef,
		durableCaptureRef: "durable-auth-capture-1",
		workflowId,
		providerFamily: "claude",
		providerQualifiedModelId: "claude/sonnet-4",
		authProfileRef: "auth-profile-claude",
		authEvidenceRef: "auth-evidence-claude",
		credentialScopeRef: "principal-scope-claude",
		accountBoundaryRef: "account-boundary-claude",
		sanitizerRef: "sanitizer-claude-auth-plugin-v1",
		sourceRef: "external-auth-source-1",
		result: "passed",
		capturedAt: "2026-05-21T00:00:00.000Z",
		metadataLabels: ["raw-plugin-object-redacted", "scope-bound"],
		evidenceRefs: ["sanitized-auth-capture-evidence-1"],
	});
}

test("sanitized auth capture validates durable token-free artifacts", () => {
	const artifact = result();
	assert.equal(artifact.raw_auth_object_persisted, false);
	assert.equal(artifact.raw_plugin_object_persisted, false);
	assert.equal(artifact.token_material_persisted, false);
	assert.equal(artifact.provider_call_made, false);
	assert.equal(artifact.runtime_execution_made, false);
	assert.equal(artifact.actual_lane_launch_made, false);
	assert.equal(artifact.dispatch_authority_enabled, false);
	assert.deepEqual(artifact.safe_next_actions, ["/flowdesk-status"]);
	const validation = validateFlowDeskSanitizedAuthCaptureResultV1(
		artifact,
		workflowId,
		sanitizedAuthCaptureRef,
	);
	assert.equal(validation.ok, true, validation.errors.join("; "));
});

test("sanitized auth capture rejects mismatches and authority smuggling", () => {
	const mismatch = validateFlowDeskSanitizedAuthCaptureResultV1(
		result(),
		workflowId,
		"sanitized-auth-capture-other",
	);
	assert.equal(mismatch.ok, false);
	assert.match(mismatch.errors.join("; "), /sanitized auth capture ref mismatch/);

	const authority = validateFlowDeskSanitizedAuthCaptureResultV1({
		...result(),
		raw_auth_object_persisted: true,
		raw_plugin_object_persisted: true,
		token_material_persisted: true,
		provider_call_made: true,
		runtime_execution_made: true,
		actual_lane_launch_made: true,
		dispatch_authority_enabled: true,
	});
	assert.equal(authority.ok, false);
	assert.match(authority.errors.join("; "), /raw auth objects/);
	assert.match(authority.errors.join("; "), /raw plugin objects/);
	assert.match(authority.errors.join("; "), /token material/);
	assert.match(authority.errors.join("; "), /provider calls/);
	assert.match(authority.errors.join("; "), /runtime execution/);
	assert.match(authority.errors.join("; "), /launch lanes/);
	assert.match(authority.errors.join("; "), /dispatch authority/);
});

test("sanitized auth capture rejects raw auth objects and token-shaped data", () => {
	const raw = validateFlowDeskSanitizedAuthCaptureResultV1({
		...result(),
		accessToken: "token:secret",
		metadata_labels: ["contains credential"],
		evidence_refs: "leaky-evidence-ref",
	});
	assert.equal(raw.ok, false);
	assert.match(raw.errors.join("; "), /unknown properties/);
	assert.match(raw.errors.join("; "), /credential-shaped marker/);
	assert.match(raw.errors.join("; "), /evidence_refs must be an array/);
});

test("sanitized auth capture rejects provider mismatches and model aliases", () => {
	const providerMismatch = validateFlowDeskSanitizedAuthCaptureResultV1({
		...result(),
		provider_family: "gemini",
		provider_qualified_model_id: "claude/sonnet-4",
	});
	assert.equal(providerMismatch.ok, false);
	assert.match(providerMismatch.errors.join("; "), /match provider_family/);

	for (const providerQualifiedModelId of [
		"claude/latest",
		"openai/default",
		"gemini/auto",
	]) {
		const alias = validateFlowDeskSanitizedAuthCaptureResultV1({
			...result(),
			provider_family: providerQualifiedModelId.split("/")[0],
			provider_qualified_model_id: providerQualifiedModelId,
		});
		assert.equal(alias.ok, false, providerQualifiedModelId);
		assert.match(alias.errors.join("; "), /concrete non-alias model id/);
	}
});
