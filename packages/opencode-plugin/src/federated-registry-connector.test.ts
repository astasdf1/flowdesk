import assert from "node:assert/strict";
import test from "node:test";
import { createFlowDeskGitHubDryRunPublicationResultV1 } from "@flowdesk/core";
import {
	discoverGitHubConnectorV1,
	buildGitHubConnectorCapabilityDescriptorV1,
	buildGitHubOAuthArchitectureDescriptorV1,
	evaluateGitHubConnectorGateV1,
	publishToGitHubV1,
	type GitHubPublicationFetchV1,
} from "./federated-registry-connector.js";

const fixedNow = new Date("2026-06-07T00:00:00.000Z");

test("discoverGitHubConnectorV1 detects token from environment", async () => {
	// Mock environment
	const originalToken = process.env.GITHUB_TOKEN;
	process.env.GITHUB_TOKEN = "ghp_test_token";
	
	try {
		const discovery = await discoverGitHubConnectorV1({ now: () => fixedNow });
		assert.equal(discovery.githubTokenAvailable, true);
		assert.equal(discovery.capabilityState, "available");
		assert.equal(discovery.authSource, "env_github_token");
		assert.equal(discovery.discoveredAt, fixedNow.toISOString());
	} finally {
		if (originalToken === undefined) delete process.env.GITHUB_TOKEN;
		else process.env.GITHUB_TOKEN = originalToken;
	}
});

test("discoverGitHubConnectorV1 handles missing token and missing tools", async () => {
	const originalToken = process.env.GITHUB_TOKEN;
	const originalOAuth = process.env.FLOWDESK_GITHUB_OAUTH_TOKEN;
	delete process.env.GITHUB_TOKEN;
	delete process.env.FLOWDESK_GITHUB_OAUTH_TOKEN;
	
	try {
		const discovery = await discoverGitHubConnectorV1({ commandExists: () => false, now: () => fixedNow });
		assert.equal(discovery.githubTokenAvailable, false);
		assert.equal(discovery.ghCliAvailable, false);
		assert.equal(discovery.capabilityState, "missing_tools");
		assert.equal(discovery.authSource, "none");
		assert.match(discovery.reason!, /gh CLI availability was not proven/);
	} finally {
		if (originalToken === undefined) delete process.env.GITHUB_TOKEN;
		else process.env.GITHUB_TOKEN = originalToken;
		if (originalOAuth === undefined) delete process.env.FLOWDESK_GITHUB_OAUTH_TOKEN;
		else process.env.FLOWDESK_GITHUB_OAUTH_TOKEN = originalOAuth;
	}
});

test("discoverGitHubConnectorV1 reports auth missing when gh exists without token", async () => {
	const discovery = await discoverGitHubConnectorV1({ env: {}, commandExists: () => true, now: () => fixedNow });
	assert.equal(discovery.githubTokenAvailable, false);
	assert.equal(discovery.ghCliAvailable, true);
	assert.equal(discovery.capabilityState, "auth_missing");
	assert.match(discovery.reason!, /environment variable is missing/);
});

test("buildGitHubConnectorCapabilityDescriptorV1 builds valid core contract", async () => {
	const discovery = {
		githubTokenAvailable: true,
		ghCliAvailable: false,
		capabilityState: "available" as const,
		authSource: "env_github_token" as const,
		discoveredAt: fixedNow.toISOString(),
	};
	
	const result = buildGitHubConnectorCapabilityDescriptorV1(discovery);
	assert.equal(result.ok, true);
	assert.ok(result.capability);
	assert.equal(result.capability.schema_version, "flowdesk.federated_registry_connector_capability.v1");
	assert.equal(result.capability.capability_state, "available");
	assert.equal(result.capability.connector_gate_satisfiable, true);
	assert.equal(result.capability.remote_write_authority_enabled, false);
	assert.equal(result.capability.dispatch_authority_enabled, false);
});

test("buildGitHubOAuthArchitectureDescriptorV1 builds token-free OAuth architecture", async () => {
	const discovery = await discoverGitHubConnectorV1({ env: { FLOWDESK_GITHUB_OAUTH_TOKEN: "redacted-test-token" }, now: () => fixedNow });
	const result = buildGitHubOAuthArchitectureDescriptorV1(discovery);
	assert.equal(result.ok, true);
	assert.ok(result.architecture);
	assert.equal(result.architecture.auth_state, "configured");
	assert.equal(result.architecture.token_transmitted_in_evidence, false);
	assert.doesNotMatch(result.architecture.token_ref, /redacted-test-token/);
});

test("evaluateGitHubConnectorGateV1 remains blocked and non-authorizing", () => {
	const result = evaluateGitHubConnectorGateV1({
		workflowId: "workflow-test",
		attemptId: "attempt-test",
		capabilityDescriptorRef: "capability-ref-test",
	});
	assert.equal(result.gate_satisfied, false);
	assert.equal(result.remote_write_authority_enabled, false);
	assert.equal(result.dispatch_authority_enabled, false);
	assert.ok(result.redacted_block_reasons.includes("connector_gate_promotion_not_yet_authorized"));
});

function dryRunResult(kind: "github_issue" | "github_pr_comment" = "github_pr_comment") {
	const result = createFlowDeskGitHubDryRunPublicationResultV1({
		dryRunResultId: "dry-run-test",
		preflightRef: "preflight-ref-test",
		writePlanRef: "write-plan-ref-test",
		workflowId: "workflow-test",
		attemptId: "attempt-test",
		connectorKind: kind,
		redactedTargetLabel: "github target",
		redactedContentPreview: "federated score preview",
		contentHashRef: "hash-test",
		dryRunState: "dry_run_recorded",
		blockedLabels: [],
		fakeRemoteWriteAttempted: true,
	});
	assert.equal(result.ok, true);
	assert.ok(result.result);
	return result.result;
}

test("publishToGitHubV1 skips network call unless explicit remote write flag and gate are true", async () => {
	let called = false;
	const fetchImpl: GitHubPublicationFetchV1 = async () => {
		called = true;
		throw new Error("should not be called");
	};
	const result = await publishToGitHubV1({
		dryRunResult: dryRunResult(),
		ledgerIdempotencyRef: "ledger-idempotency-ref-test",
		guardApprovalRef: "guard-approval-ref-test",
		target: { kind: "github_pr_comment", owner: "flowdesk", repo: "repo", issueNumber: 12 },
		contentMarkdown: "FlowDesk publication body",
		allowActualRemoteWrite: false,
		connectorGateSatisfied: true,
		env: { GITHUB_TOKEN: "ghp_secret" },
		fetchImpl,
		now: () => fixedNow,
	});
	assert.equal(called, false);
	assert.equal(result.ok, false);
	assert.equal(result.remoteWrite.state, "skipped");
	assert.equal(result.publicationResult?.remote_write_attempted, false);
	assert.equal(result.publicationResult?.github_write_attempted, false);
	assert.equal(result.publicationResult?.advisory_only, true);
});

test("publishToGitHubV1 posts PR comment through GitHub issues comments endpoint", async () => {
	const calls: Array<{ url: string; body: unknown; authorization?: string }> = [];
	const fetchImpl: GitHubPublicationFetchV1 = async (url, init) => {
		calls.push({ url, body: JSON.parse(init.body) as unknown, authorization: init.headers.Authorization });
		return {
			ok: true,
			status: 201,
			json: async () => ({ html_url: "https://github.com/flowdesk/repo/pull/12#issuecomment-1" }),
		};
	};
	const result = await publishToGitHubV1({
		dryRunResult: dryRunResult("github_pr_comment"),
		ledgerIdempotencyRef: "ledger-idempotency-ref-test",
		guardApprovalRef: "guard-approval-ref-test",
		target: { kind: "github_pr_comment", owner: "flowdesk", repo: "repo", issueNumber: 12 },
		contentMarkdown: "FlowDesk publication body",
		allowActualRemoteWrite: true,
		connectorGateSatisfied: true,
		env: { FLOWDESK_GITHUB_OAUTH_TOKEN: "github_oauth_secret" },
		fetchImpl,
		now: () => fixedNow,
	});
	assert.equal(result.ok, true);
	assert.equal(result.remoteWrite.state, "posted");
	assert.equal(result.remoteWrite.statusCode, 201);
	assert.equal(calls.length, 1);
	assert.equal(calls[0]?.url, "https://api.github.com/repos/flowdesk/repo/issues/12/comments");
	assert.deepEqual(calls[0]?.body, { body: "FlowDesk publication body" });
	assert.equal(calls[0]?.authorization, "Bearer github_oauth_secret");
	assert.equal(result.publicationResult?.publication_state, "pending_gate_promotion");
	assert.equal(result.publicationResult?.remote_write_attempted, false);
	assert.equal(result.publicationResult?.remote_write_authority_enabled, false);
});

test("publishToGitHubV1 creates GitHub issue with mocked API", async () => {
	let body: unknown;
	const fetchImpl: GitHubPublicationFetchV1 = async (url, init) => {
		assert.equal(url, "https://api.github.com/repos/flowdesk/repo/issues");
		body = JSON.parse(init.body) as unknown;
		return { ok: true, status: 201, json: async () => ({ html_url: "https://github.com/flowdesk/repo/issues/99" }) };
	};
	const result = await publishToGitHubV1({
		dryRunResult: dryRunResult("github_issue"),
		ledgerIdempotencyRef: "ledger-idempotency-ref-test",
		guardApprovalRef: "guard-approval-ref-test",
		target: { kind: "github_issue", owner: "flowdesk", repo: "repo", title: "FlowDesk federated score" },
		contentMarkdown: "Issue body",
		allowActualRemoteWrite: true,
		connectorGateSatisfied: true,
		env: { GITHUB_TOKEN: "ghp_secret" },
		fetchImpl,
		now: () => fixedNow,
	});
	assert.equal(result.remoteWrite.state, "posted");
	assert.deepEqual(body, { title: "FlowDesk federated score", body: "Issue body" });
});

test("publishToGitHubV1 reports GitHub API failure without marking advisory record as attempted", async () => {
	const fetchImpl: GitHubPublicationFetchV1 = async () => ({
		ok: false,
		status: 403,
		json: async () => ({ message: "Resource not accessible by integration" }),
	});
	const result = await publishToGitHubV1({
		dryRunResult: dryRunResult(),
		ledgerIdempotencyRef: "ledger-idempotency-ref-test",
		guardApprovalRef: "guard-approval-ref-test",
		target: { kind: "github_pr_comment", owner: "flowdesk", repo: "repo", issueNumber: 12 },
		contentMarkdown: "FlowDesk publication body",
		allowActualRemoteWrite: true,
		connectorGateSatisfied: true,
		env: { GITHUB_TOKEN: "ghp_secret" },
		fetchImpl,
		now: () => fixedNow,
	});
	assert.equal(result.ok, false);
	assert.equal(result.remoteWrite.state, "failed");
	assert.equal(result.remoteWrite.statusCode, 403);
	assert.equal(result.publicationResult?.publication_state, "blocked");
	assert.equal(result.publicationResult?.remote_write_attempted, false);
});
