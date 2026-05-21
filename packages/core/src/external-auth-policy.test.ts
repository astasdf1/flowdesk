import assert from "node:assert/strict";
import test from "node:test";
import {
	createFlowDeskExternalAuthProviderPolicyResultV1,
	validateFlowDeskExternalAuthProviderPolicyResultV1,
} from "./external-auth-policy.js";

const workflowId = "workflow-prod-1";
const externalAuthPolicyRef = "external-auth-policy-1";
const providerPolicyRef = "provider-policy-1";

function result() {
	return createFlowDeskExternalAuthProviderPolicyResultV1({
		externalAuthPolicyRef,
		providerPolicyRef,
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
		sanitizedAt: "2026-05-21T00:00:00.000Z",
		metadataLabels: ["account-boundary-bound", "scope-bound"],
		evidenceRefs: ["external-auth-policy-evidence-1"],
	});
}

test("external auth provider policy validates token-free non-authorizing artifacts", () => {
	const artifact = result();
	assert.equal(artifact.raw_auth_object_persisted, false);
	assert.equal(artifact.token_material_persisted, false);
	assert.equal(artifact.provider_call_made, false);
	assert.equal(artifact.runtime_execution_made, false);
	assert.equal(artifact.actual_lane_launch_made, false);
	assert.equal(artifact.dispatch_authority_enabled, false);
	assert.deepEqual(artifact.safe_next_actions, ["/flowdesk-status"]);
	assert.equal(
		validateFlowDeskExternalAuthProviderPolicyResultV1(
			artifact,
			workflowId,
			externalAuthPolicyRef,
			providerPolicyRef,
		).ok,
		true,
	);
});

test("external auth provider policy rejects mismatches and authority smuggling", () => {
	const mismatch = validateFlowDeskExternalAuthProviderPolicyResultV1(
		result(),
		workflowId,
		"external-auth-policy-other",
		providerPolicyRef,
	);
	assert.equal(mismatch.ok, false);
	assert.match(mismatch.errors.join("; "), /external auth policy ref mismatch/);

	const authority = validateFlowDeskExternalAuthProviderPolicyResultV1({
		...result(),
		raw_auth_object_persisted: true,
		token_material_persisted: true,
		provider_call_made: true,
		runtime_execution_made: true,
		actual_lane_launch_made: true,
		dispatch_authority_enabled: true,
	});
	assert.equal(authority.ok, false);
	assert.match(authority.errors.join("; "), /raw auth objects/);
	assert.match(authority.errors.join("; "), /token material/);
	assert.match(authority.errors.join("; "), /provider calls/);
	assert.match(authority.errors.join("; "), /runtime execution/);
	assert.match(authority.errors.join("; "), /launch lanes/);
	assert.match(authority.errors.join("; "), /dispatch authority/);
});

test("external auth provider policy rejects raw auth objects and token-shaped data", () => {
	const raw = validateFlowDeskExternalAuthProviderPolicyResultV1({
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

test("external auth provider policy rejects provider mismatch and non-concrete providers", () => {
	const providerMismatch = validateFlowDeskExternalAuthProviderPolicyResultV1({
		...result(),
		provider_family: "gemini",
		provider_qualified_model_id: "claude/sonnet-4",
	});
	assert.equal(providerMismatch.ok, false);
	assert.match(providerMismatch.errors.join("; "), /match provider_family/);

	const nonConcrete = validateFlowDeskExternalAuthProviderPolicyResultV1({
		...result(),
		provider_family: "unknown",
		provider_qualified_model_id: "unknown/model",
	});
	assert.equal(nonConcrete.ok, false);
	assert.match(nonConcrete.errors.join("; "), /concrete/);
});

test("external auth provider policy rejects provider model aliases", () => {
	for (const providerQualifiedModelId of [
		"claude/latest",
		"openai/default",
		"gemini/auto",
	]) {
		const alias = validateFlowDeskExternalAuthProviderPolicyResultV1({
			...result(),
			provider_family: providerQualifiedModelId.split("/")[0],
			provider_qualified_model_id: providerQualifiedModelId,
		});
		assert.equal(alias.ok, false, providerQualifiedModelId);
		assert.match(
			alias.errors.join("; "),
			/concrete non-alias model id/,
			providerQualifiedModelId,
		);
	}
});
