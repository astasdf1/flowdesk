import assert from "node:assert/strict";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import {
	createFlowDeskFederatedDataMinimizationPolicyV1,
	createFlowDeskGitHubConnectorProductionPublishFlagV1,
	createFlowDeskGitHubDryRunPublicationResultV1,
	createFlowDeskSurplusUsageGateV1,
} from "@flowdesk/core";
import {
	discoverGitHubConnectorV1,
	buildGitHubConnectorCapabilityDescriptorV1,
	buildGitHubOAuthArchitectureDescriptorV1,
	evaluateGitHubConnectorGateV1,
	publishToGitHubV1,
	resolveGitHubPublicationFetchImplForContextV1,
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

function validProductionEvidence(overrides: { staleGate?: boolean; invalidPolicyK?: boolean; flagState?: "enabled" | "disabled" | "unknown" } = {}) {
	const gate = createFlowDeskSurplusUsageGateV1({
		gateId: "gate-production-publish-test",
		workflowId: "workflow-test",
		snapshotRef: "snapshot-ref-test",
		snapshotHash: "sha256-aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
		snapshotCapturedAt: fixedNow.toISOString(),
		evaluatedAt: fixedNow.toISOString(),
		snapshotAgeSeconds: overrides.staleGate === true ? 301 : 1,
		maxSnapshotAgeSeconds: 300,
		providerFamily: "openai",
		bucketLabel: "openai-gpt-5h",
		remainingPercent: 90,
		surplusThresholdPercent: 50,
		alertLevel: "ok",
		reasonRefs: ["reason-ref-test"],
	});
	assert.equal(gate.ok, true);
	assert.ok(gate.gate);
	const policy = createFlowDeskFederatedDataMinimizationPolicyV1({
		policyId: "policy-production-publish-test",
		workflowId: "workflow-test",
		kAnonymityThreshold: 10,
		createdAt: fixedNow.toISOString(),
	});
	assert.equal(policy.ok, true);
	assert.ok(policy.policy);
	const flag = createFlowDeskGitHubConnectorProductionPublishFlagV1({
		state: overrides.flagState ?? "enabled",
		consumesSurplusUsageGateRef: "surplus-gate-ref-test",
		consumesMinimizationPolicyRef: "minimization-policy-ref-test",
		consumesGuardApprovalRef: "guard-approval-ref-test",
		createdAt: fixedNow.toISOString(),
	});
	assert.equal(flag.ok, true);
	assert.ok(flag.flag);
	const evidence = new Map<string, unknown>([
		["production-flag-ref-test", flag.flag],
		["surplus-gate-ref-test", gate.gate],
		["minimization-policy-ref-test", overrides.invalidPolicyK === true ? { ...policy.policy, k_anonymity_threshold: 5 } : policy.policy],
	]);
	return {
		productionPublishFlagRef: "production-flag-ref-test",
		surplusUsageGateRef: "surplus-gate-ref-test",
		minimizationPolicyRef: "minimization-policy-ref-test",
		evidenceRefResolver: (ref: string) => evidence.get(ref),
	};
}

async function withGlobalFetch<T>(fetchImpl: GitHubPublicationFetchV1 | undefined, fn: () => Promise<T>): Promise<T> {
	const originalFetch = globalThis.fetch;
	try {
		if (fetchImpl === undefined) delete (globalThis as { fetch?: unknown }).fetch;
		else (globalThis as { fetch?: GitHubPublicationFetchV1 }).fetch = fetchImpl;
		return await fn();
	} finally {
		(globalThis as { fetch?: typeof globalThis.fetch }).fetch = originalFetch;
	}
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

test("publishToGitHubV1 blocks contentMarkdown with forbidden marker", async () => {
	const result = await publishToGitHubV1({
		dryRunResult: dryRunResult(),
		ledgerIdempotencyRef: "ledger-idempotency-ref-test",
		guardApprovalRef: "guard-approval-ref-test",
		target: { kind: "github_pr_comment", owner: "flowdesk", repo: "repo", issueNumber: 12 },
		contentMarkdown: "FlowDesk publication body\n\nDo not publish FLOWDESK_GITHUB_OAUTH_TOKEN here.",
		allowActualRemoteWrite: true,
		connectorGateSatisfied: true,
		env: { GITHUB_TOKEN: "ghp_secret" },
		...validProductionEvidence(),
		now: () => fixedNow,
	});

	assert.equal(result.ok, false);
	assert.equal(result.remoteWrite.state, "skipped");
	assert.match(result.errors.join("; "), /contentMarkdown contains a forbidden marker/);
	assert.ok(result.publicationResult?.blocked_labels.includes("content-markdown-contains-forbidden-marker"));
	assert.match(result.remoteWrite.redactedReason ?? "", /content-markdown-contains-forbidden-marker/);
});

test("publishToGitHubV1 blocks while ledger compaction lock is held", async () => {
	const root = mkdtempSync(join(tmpdir(), "flowdesk-github-publish-compaction-lock-"));
	const originalCwd = process.cwd();
	let called = false;
	const fetchImpl: GitHubPublicationFetchV1 = async () => {
		called = true;
		throw new Error("should not be called while compaction lock is held");
	};

	try {
		mkdirSync(join(root, ".flowdesk", "locks"), { recursive: true });
		writeFileSync(join(root, ".flowdesk", "locks", "compaction.lock"), "locked\n", "utf8");
		process.chdir(root);

		const result = await withGlobalFetch(fetchImpl, () => publishToGitHubV1({
			dryRunResult: dryRunResult(),
			ledgerIdempotencyRef: "ledger-idempotency-ref-test",
			guardApprovalRef: "guard-approval-ref-test",
			target: { kind: "github_pr_comment", owner: "flowdesk", repo: "repo", issueNumber: 12 },
			contentMarkdown: "FlowDesk publication body",
			allowActualRemoteWrite: true,
			connectorGateSatisfied: true,
			env: { GITHUB_TOKEN: "ghp_secret" },
			...validProductionEvidence(),
			fetchImpl,
			now: () => fixedNow,
		}));

		assert.equal(called, false);
		assert.equal(result.ok, false);
		assert.equal(result.remoteWrite.state, "skipped");
		assert.equal(result.remoteWrite.redactedReason, "compaction-lock-held");
		assert.deepEqual(result.publicationResult?.blocked_labels, ["compaction-lock-held"]);
		assert.equal(result.publicationResult?.publication_state, "blocked");
	} finally {
		process.chdir(originalCwd);
		rmSync(root, { recursive: true, force: true });
	}
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
	const result = await withGlobalFetch(fetchImpl, () => publishToGitHubV1({
		dryRunResult: dryRunResult("github_pr_comment"),
		ledgerIdempotencyRef: "ledger-idempotency-ref-test",
		guardApprovalRef: "guard-approval-ref-test",
		target: { kind: "github_pr_comment", owner: "flowdesk", repo: "repo", issueNumber: 12 },
		contentMarkdown: "FlowDesk publication body",
		allowActualRemoteWrite: true,
		connectorGateSatisfied: true,
		env: { FLOWDESK_GITHUB_OAUTH_TOKEN: "github_oauth_secret" },
		...validProductionEvidence(),
		fetchImpl,
		now: () => fixedNow,
	}));
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
	const result = await withGlobalFetch(fetchImpl, () => publishToGitHubV1({
		dryRunResult: dryRunResult("github_issue"),
		ledgerIdempotencyRef: "ledger-idempotency-ref-test",
		guardApprovalRef: "guard-approval-ref-test",
		target: { kind: "github_issue", owner: "flowdesk", repo: "repo", title: "FlowDesk federated score" },
		contentMarkdown: "Issue body",
		allowActualRemoteWrite: true,
		connectorGateSatisfied: true,
		env: { GITHUB_TOKEN: "ghp_secret" },
		...validProductionEvidence(),
		fetchImpl,
		now: () => fixedNow,
	}));
	assert.equal(result.remoteWrite.state, "posted");
	assert.deepEqual(body, { title: "FlowDesk federated score", body: "Issue body" });
});

test("publishToGitHubV1 reports GitHub API failure without marking advisory record as attempted", async () => {
	const fetchImpl: GitHubPublicationFetchV1 = async () => ({
		ok: false,
		status: 500,
		json: async () => ({ message: "Internal Server Error" }),
	});
	const result = await withGlobalFetch(fetchImpl, () => publishToGitHubV1({
		dryRunResult: dryRunResult(),
		ledgerIdempotencyRef: "ledger-idempotency-ref-test",
		guardApprovalRef: "guard-approval-ref-test",
		target: { kind: "github_pr_comment", owner: "flowdesk", repo: "repo", issueNumber: 12 },
		contentMarkdown: "FlowDesk publication body",
		allowActualRemoteWrite: true,
		connectorGateSatisfied: true,
		env: { GITHUB_TOKEN: "ghp_secret" },
		...validProductionEvidence(),
		fetchImpl,
		now: () => fixedNow,
	}));
	assert.equal(result.ok, false);
	assert.equal(result.remoteWrite.state, "failed");
	assert.equal(result.remoteWrite.statusCode, 500);
	assert.equal(result.remoteWrite.redactedReason, "github-api-call-failed");
	assert.equal(result.publicationResult?.publication_state, "blocked");
	assert.deepEqual(result.publicationResult?.blocked_labels, ["github-api-call-failed"]);
	assert.equal(result.publicationResult?.remote_write_attempted, false);
});

test("publishToGitHubV1 labels 403 GitHub API response as rate limited", async () => {
	const fetchImpl: GitHubPublicationFetchV1 = async () => ({
		ok: false,
		status: 403,
		json: async () => ({ message: "API rate limit exceeded" }),
	});
	const result = await withGlobalFetch(fetchImpl, () => publishToGitHubV1({
		dryRunResult: dryRunResult(),
		ledgerIdempotencyRef: "ledger-idempotency-ref-test",
		guardApprovalRef: "guard-approval-ref-test",
		target: { kind: "github_pr_comment", owner: "flowdesk", repo: "repo", issueNumber: 12 },
		contentMarkdown: "FlowDesk publication body",
		allowActualRemoteWrite: true,
		connectorGateSatisfied: true,
		env: { GITHUB_TOKEN: "ghp_secret" },
		...validProductionEvidence(),
		fetchImpl,
		now: () => fixedNow,
	}));
	assert.equal(result.ok, false);
	assert.equal(result.remoteWrite.state, "failed");
	assert.equal(result.remoteWrite.statusCode, 403);
	assert.equal(result.remoteWrite.redactedReason, "github-api-rate-limited");
	assert.deepEqual(result.publicationResult?.blocked_labels, ["github-api-rate-limited"]);
	assert.deepEqual(result.errors, ["github_api_status_403"]);
});

test("test_productionPublish_flag_requires_all_preconditions", async () => {
	for (const omitted of ["productionPublishFlagRef", "surplusUsageGateRef", "minimizationPolicyRef"] as const) {
		const input = validProductionEvidence();
		delete input[omitted];
		const result = await publishToGitHubV1({
			dryRunResult: dryRunResult(),
			ledgerIdempotencyRef: "ledger-idempotency-ref-test",
			guardApprovalRef: "guard-approval-ref-test",
			target: { kind: "github_pr_comment", owner: "flowdesk", repo: "repo", issueNumber: 12 },
			contentMarkdown: "FlowDesk publication body",
			allowActualRemoteWrite: true,
			connectorGateSatisfied: true,
			env: { GITHUB_TOKEN: "ghp_secret" },
			...input,
			now: () => fixedNow,
		});
		assert.equal(result.ok, false);
		assert.equal(result.remoteWrite.state, "skipped");
	}
});

test("test_productionPublish_missing_blocks_with_specific_label", async () => {
	const result = await publishToGitHubV1({
		dryRunResult: dryRunResult(),
		ledgerIdempotencyRef: "ledger-idempotency-ref-test",
		guardApprovalRef: "guard-approval-ref-test",
		target: { kind: "github_pr_comment", owner: "flowdesk", repo: "repo", issueNumber: 12 },
		contentMarkdown: "FlowDesk publication body",
		allowActualRemoteWrite: true,
		connectorGateSatisfied: true,
		env: { GITHUB_TOKEN: "ghp_secret" },
		now: () => fixedNow,
	});
	assert.match(result.remoteWrite.redactedReason ?? "", /production-publish-flag-missing/);
	assert.match(result.remoteWrite.redactedReason ?? "", /surplus-usage-gate-missing/);
	assert.match(result.remoteWrite.redactedReason ?? "", /minimization-policy-missing/);
});

test("test_surplusUsageGate_stale_blocks_publish", async () => {
	const result = await publishToGitHubV1({
		dryRunResult: dryRunResult(),
		ledgerIdempotencyRef: "ledger-idempotency-ref-test",
		guardApprovalRef: "guard-approval-ref-test",
		target: { kind: "github_pr_comment", owner: "flowdesk", repo: "repo", issueNumber: 12 },
		contentMarkdown: "FlowDesk publication body",
		allowActualRemoteWrite: true,
		connectorGateSatisfied: true,
		env: { GITHUB_TOKEN: "ghp_secret" },
		...validProductionEvidence({ staleGate: true }),
		now: () => fixedNow,
	});
	assert.equal(result.remoteWrite.state, "skipped");
	assert.match(result.remoteWrite.redactedReason ?? "", /surplusUsageGate-unfresh/);
});

test("test_minimizationPolicy_invalid_k_anonymity_blocks_publish", async () => {
	const result = await publishToGitHubV1({
		dryRunResult: dryRunResult(),
		ledgerIdempotencyRef: "ledger-idempotency-ref-test",
		guardApprovalRef: "guard-approval-ref-test",
		target: { kind: "github_pr_comment", owner: "flowdesk", repo: "repo", issueNumber: 12 },
		contentMarkdown: "FlowDesk publication body",
		allowActualRemoteWrite: true,
		connectorGateSatisfied: true,
		env: { GITHUB_TOKEN: "ghp_secret" },
		...validProductionEvidence({ invalidPolicyK: true }),
		now: () => fixedNow,
	});
	assert.equal(result.remoteWrite.state, "skipped");
	assert.match(result.remoteWrite.redactedReason ?? "", /minimizationPolicy-invalid-k-anonymity/);
});

test("test_fetchImpl_override_ignored_in_production_context", async () => {
	let globalCalled = false;
	let overrideCalled = false;
	const globalFetch: GitHubPublicationFetchV1 = async () => {
		globalCalled = true;
		return { ok: true, status: 201, json: async () => ({ html_url: "https://github.com/flowdesk/repo/pull/12#issuecomment-1" }) };
	};
	const overrideFetch: GitHubPublicationFetchV1 = async () => {
		overrideCalled = true;
		throw new Error("override must be ignored");
	};
	const result = await withGlobalFetch(globalFetch, () => publishToGitHubV1({
		dryRunResult: dryRunResult(),
		ledgerIdempotencyRef: "ledger-idempotency-ref-test",
		guardApprovalRef: "guard-approval-ref-test",
		target: { kind: "github_pr_comment", owner: "flowdesk", repo: "repo", issueNumber: 12 },
		contentMarkdown: "FlowDesk publication body",
		allowActualRemoteWrite: true,
		connectorGateSatisfied: true,
		env: { GITHUB_TOKEN: "ghp_secret" },
		...validProductionEvidence(),
		fetchImpl: overrideFetch,
		now: () => fixedNow,
	}));
	assert.equal(result.remoteWrite.state, "posted");
	assert.equal(globalCalled, true);
	assert.equal(overrideCalled, false);
});

test("test_fetchImpl_override_honored_in_test_context", async () => {
	const overrideFetch: GitHubPublicationFetchV1 = async () => ({ ok: true, status: 201, json: async () => ({}) });
	await withGlobalFetch(undefined, async () => {
		const selected = resolveGitHubPublicationFetchImplForContextV1({ productionPublishEnabled: false, fetchImpl: overrideFetch });
		assert.equal(selected, overrideFetch);
	});
});

test("test_authority_invariants_unchanged", async () => {
	const blocked = await publishToGitHubV1({
		dryRunResult: dryRunResult(),
		ledgerIdempotencyRef: "ledger-idempotency-ref-test",
		guardApprovalRef: "guard-approval-ref-test",
		target: { kind: "github_pr_comment", owner: "flowdesk", repo: "repo", issueNumber: 12 },
		contentMarkdown: "FlowDesk publication body",
		allowActualRemoteWrite: true,
		connectorGateSatisfied: true,
		env: {},
		now: () => fixedNow,
	});
	const posted = await withGlobalFetch(async () => ({ ok: true, status: 201, json: async () => ({}) }), () => publishToGitHubV1({
		dryRunResult: dryRunResult(),
		ledgerIdempotencyRef: "ledger-idempotency-ref-test",
		guardApprovalRef: "guard-approval-ref-test",
		target: { kind: "github_pr_comment", owner: "flowdesk", repo: "repo", issueNumber: 12 },
		contentMarkdown: "FlowDesk publication body",
		allowActualRemoteWrite: true,
		connectorGateSatisfied: true,
		env: { GITHUB_TOKEN: "ghp_secret" },
		...validProductionEvidence(),
		now: () => fixedNow,
	}));
	assert.equal(blocked.authority.remoteWriteAuthorityEnabledInRecord, false);
	assert.equal(posted.authority.remoteWriteAuthorityEnabledInRecord, false);
	assert.equal(posted.publicationResult?.remote_write_authority_enabled, false);
});

test("test_no_blocking_change_to_existing_gate_semantics", async () => {
	const result = await publishToGitHubV1({
		dryRunResult: dryRunResult(),
		ledgerIdempotencyRef: "ledger-idempotency-ref-test",
		guardApprovalRef: "guard-approval-ref-test",
		target: { kind: "github_pr_comment", owner: "flowdesk", repo: "repo", issueNumber: 12 },
		contentMarkdown: "FlowDesk publication body",
		allowActualRemoteWrite: false,
		connectorGateSatisfied: false,
		env: { GITHUB_TOKEN: "ghp_secret" },
		now: () => fixedNow,
	});
	assert.equal(result.remoteWrite.state, "skipped");
	assert.match(result.remoteWrite.redactedReason ?? "", /actual-remote-write-not-enabled/);
	assert.match(result.remoteWrite.redactedReason ?? "", /connector-gate-not-satisfied/);
	assert.match(result.remoteWrite.redactedReason ?? "", /production-publish-flag-missing/);
});
