import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { DatabaseSync } from "node:sqlite";
import test from "node:test";
import {
	createFlowDeskFederatedDataMinimizationPolicyV1,
	createFlowDeskGitHubConnectorProductionPublishFlagV1,
	createFlowDeskGitHubDryRunPublicationResultV1,
	createFlowDeskSurplusUsageGateV1,
} from "@flowdesk/core";
import { FORBIDDEN_RAW_PAYLOAD_MARKERS } from "@flowdesk/core";
import {
	discoverGitHubConnectorV1,
	buildGitHubConnectorCapabilityDescriptorV1,
	buildGitHubOAuthArchitectureDescriptorV1,
	evaluateGitHubConnectorGateV1,
	fetchModelAvailabilityDbFromGitHubV1,
	fetchProviderCatalogFromGitHubV1,
	publishToGitHubV1,
	resolveGitHubPublicationFetchImplForContextV1,
	validateContentMarkdownAgainstForbiddenMarkers,
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

// ─── Phase 8a — Burn-Rate Gate consumption ────────────────────────────────────

function surplusGateEvidence(overrides: { snapshotFresh?: boolean; alertLevelDeny?: boolean } = {}) {
	// Build a valid gate via the constructor. The constructor enforces
	// cross-field consistency; for the verdict-deny path we trigger
	// "blocked_alert_level" naturally via alertLevel="critical" (which keeps
	// the record internally consistent for validateFlowDeskSurplusUsageGateV1).
	// snapshot_fresh override (snapshotFresh=false) is safe because the
	// validator's "allow"-path consistency rules do not depend on
	// snapshot_fresh directly (only on surplus_sufficient + blocked_labels).
	const created = createFlowDeskSurplusUsageGateV1({
		gateId: "gate-burn-rate-test",
		workflowId: "workflow-test",
		snapshotRef: "snapshot-ref-test",
		snapshotHash: "sha256-aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
		snapshotCapturedAt: fixedNow.toISOString(),
		evaluatedAt: fixedNow.toISOString(),
		snapshotAgeSeconds: 1,
		maxSnapshotAgeSeconds: 300,
		providerFamily: "openai",
		bucketLabel: "openai-gpt-5h",
		remainingPercent: 90,
		surplusThresholdPercent: 50,
		alertLevel: overrides.alertLevelDeny === true ? "critical" : "ok",
		reasonRefs: ["reason-ref-test"],
	});
	assert.equal(created.ok, true);
	assert.ok(created.gate);
	const gate = {
		...created.gate,
		...(overrides.snapshotFresh === undefined ? {} : { snapshot_fresh: overrides.snapshotFresh }),
	};
	const evidence = new Map<string, unknown>([["surplus-gate-ref-test", gate]]);
	return {
		surplusUsageGateRef: "surplus-gate-ref-test",
		evidenceRefResolver: (ref: string) => evidence.get(ref),
	};
}

test("test_publish_consumes_fresh_surplus_usage_gate", async () => {
	// surplusUsageGateRef omitted → preliminaryBlockLabels include
	// "surplus-usage-gate-missing".
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
	assert.equal(result.ok, false);
	assert.equal(result.remoteWrite.state, "skipped");
	assert.ok(result.publicationResult?.blocked_labels.includes("surplus-usage-gate-missing"));
});

test("test_surplus_gate_stale_blocks_publish", async () => {
	// surplusUsageGateRef present but snapshot_fresh=false →
	// "surplus-usage-gate-stale" emitted in blocked_labels.
	const result = await publishToGitHubV1({
		dryRunResult: dryRunResult(),
		ledgerIdempotencyRef: "ledger-idempotency-ref-test",
		guardApprovalRef: "guard-approval-ref-test",
		target: { kind: "github_pr_comment", owner: "flowdesk", repo: "repo", issueNumber: 12 },
		contentMarkdown: "FlowDesk publication body",
		allowActualRemoteWrite: true,
		connectorGateSatisfied: true,
		env: { GITHUB_TOKEN: "ghp_secret" },
		...surplusGateEvidence({ snapshotFresh: false }),
		now: () => fixedNow,
	});
	assert.equal(result.remoteWrite.state, "skipped");
	assert.ok(result.publicationResult?.blocked_labels.includes("surplus-usage-gate-stale"));
});

test("test_surplus_gate_verdict_deny_blocks_publish", async () => {
	// gate_verdict !== "allow" → "surplus-usage-gate-verdict-deny" emitted.
	const result = await publishToGitHubV1({
		dryRunResult: dryRunResult(),
		ledgerIdempotencyRef: "ledger-idempotency-ref-test",
		guardApprovalRef: "guard-approval-ref-test",
		target: { kind: "github_pr_comment", owner: "flowdesk", repo: "repo", issueNumber: 12 },
		contentMarkdown: "FlowDesk publication body",
		allowActualRemoteWrite: true,
		connectorGateSatisfied: true,
		env: { GITHUB_TOKEN: "ghp_secret" },
		...surplusGateEvidence({ alertLevelDeny: true }),
		now: () => fixedNow,
	});
	assert.equal(result.remoteWrite.state, "skipped");
	assert.ok(result.publicationResult?.blocked_labels.includes("surplus-usage-gate-verdict-deny"));
});

test("test_surplus_gate_valid_does_not_block", async () => {
	// gate_verdict="allow" and snapshot_fresh=true → no Phase 8a
	// surplus-usage-gate-* labels appear in blocked_labels. Other unrelated
	// gates (productionPublish flag / minimization policy) may still block;
	// we only assert the surplus dimension is not the cause.
	const result = await publishToGitHubV1({
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
	});
	const labels = result.publicationResult?.blocked_labels ?? [];
	assert.equal(labels.includes("surplus-usage-gate-missing"), false);
	assert.equal(labels.includes("surplus-usage-gate-stale"), false);
	assert.equal(labels.includes("surplus-usage-gate-verdict-deny"), false);
	assert.equal(labels.includes("surplus-usage-gate-reload-failed"), false);
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

// ─── Phase 8b — Compaction lock path unification (R-NEW-1) ───────────────────

test("test_compaction_lock_path_unified: connector and core helper agree on lock path", async () => {
	const { flowDeskCompactionLockPathV1 } = await import("@flowdesk/core");
	const root = mkdtempSync(join(tmpdir(), "flowdesk-compaction-lock-unified-"));
	try {
		const stateRoot = join(root, ".flowdesk");
		mkdirSync(stateRoot, { recursive: true });
		const expectedLockPath = flowDeskCompactionLockPathV1(stateRoot);
		// Sanity: helper path is <stateRoot>/.locks/compaction.lock — the unified location.
		assert.equal(expectedLockPath, join(stateRoot, ".locks", "compaction.lock"));

		// Hold the unified lock and confirm the connector sees it via durableStateRoot input.
		mkdirSync(join(stateRoot, ".locks"), { recursive: true });
		writeFileSync(expectedLockPath, JSON.stringify({ acquired_at: fixedNow.toISOString() }) + "\n", "utf8");

		const result = await publishToGitHubV1({
			dryRunResult: dryRunResult(),
			ledgerIdempotencyRef: "ledger-idempotency-ref-test",
			guardApprovalRef: "guard-approval-ref-test",
			target: { kind: "github_pr_comment", owner: "flowdesk", repo: "repo", issueNumber: 12 },
			contentMarkdown: "FlowDesk publication body",
			allowActualRemoteWrite: true,
			connectorGateSatisfied: true,
			env: { GITHUB_TOKEN: "ghp_secret" },
			...validProductionEvidence(),
			durableStateRoot: stateRoot,
			now: () => fixedNow,
		});

		assert.equal(result.ok, false);
		assert.equal(result.remoteWrite.state, "skipped");
		assert.equal(result.remoteWrite.redactedReason, "compaction-lock-held");
		assert.deepEqual(result.publicationResult?.blocked_labels, ["compaction-lock-held"]);
	} finally {
		rmSync(root, { recursive: true, force: true });
	}
});

test("test_compaction_lock_held_blocks_publish: durableStateRoot lock path blocks publishToGitHubV1", async () => {
	const root = mkdtempSync(join(tmpdir(), "flowdesk-compaction-lock-blocks-"));
	let called = false;
	const fetchImpl: GitHubPublicationFetchV1 = async () => {
		called = true;
		throw new Error("should not be called while compaction lock is held");
	};
	try {
		const stateRoot = join(root, ".flowdesk");
		mkdirSync(join(stateRoot, ".locks"), { recursive: true });
		writeFileSync(join(stateRoot, ".locks", "compaction.lock"), "locked\n", "utf8");

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
			durableStateRoot: stateRoot,
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
		rmSync(root, { recursive: true, force: true });
	}
});

// ─── Phase 8c Section 2.6 — productionPublish Flag AND-Gate ──────────────────

/**
 * Phase 8c §2.6 — fixed allowed redactedReason label set. Every
 * redactedReason emitted by publishToGitHubV1 must consist of a
 * comma-separated list whose individual tokens belong to this enum.
 */
const ALLOWED_REDACTED_REASON_LABELS = new Set<string>([
	"actual-remote-write-not-enabled",
	"connector-gate-not-satisfied",
	"content-markdown-contains-forbidden-marker",
	"production-publish-flag-missing",
	"productionPublish-disabled",
	"productionPublish-invalid",
	"surplus-usage-gate-missing",
	"surplus-usage-gate-stale",
	"surplus-usage-gate-verdict-deny",
	"surplus-usage-gate-reload-failed",
	"surplusUsageGate-unfresh",
	"surplusUsageGate-alert-level-unsafe",
	"surplusUsageGate-not-allow",
	"surplusUsageGate-invalid",
	"minimization-policy-missing",
	"minimizationPolicy-invalid",
	"minimizationPolicy-invalid-k-anonymity",
	"guard-approval-ref-missing",
	"guard-approval-attempt-mismatch",
	"ledger-idempotency-ref-missing",
	"compaction-lock-held",
	"github-publication-input-invalid",
	"github-fetch-unavailable",
	"github-api-rate-limited",
	"github-api-call-failed",
	"github-api-call-threw",
]);

function basePublishInputForAndGate() {
	return {
		dryRunResult: dryRunResult(),
		ledgerIdempotencyRef: "ledger-idempotency-ref-test",
		guardApprovalRef: "guard-approval-ref-test",
		target: { kind: "github_pr_comment" as const, owner: "flowdesk", repo: "repo", issueNumber: 12 },
		contentMarkdown: "FlowDesk publication body",
		allowActualRemoteWrite: true,
		connectorGateSatisfied: true,
		env: { GITHUB_TOKEN: "ghp_secret" },
		...validProductionEvidence(),
		now: () => fixedNow,
	};
}

test("Section 2.6 — test_token_not_in_errors_for_all_failure_modes", async () => {
	const token = "ghp_super_secret_token_value";
	const env = { GITHUB_TOKEN: token };
	const fetchImpls: Array<{ label: string; impl: GitHubPublicationFetchV1 }> = [
		{ label: "api-500", impl: async () => ({ ok: false, status: 500, json: async () => ({ message: "server error" }) }) },
		{ label: "api-403", impl: async () => ({ ok: false, status: 403, json: async () => ({ message: "rate limited" }) }) },
		{ label: "api-429", impl: async () => ({ ok: false, status: 429, json: async () => ({ message: "rate limited" }) }) },
		{ label: "api-throws", impl: async () => { throw new Error(`network failure containing ${token}`); } },
	];
	for (const { impl } of fetchImpls) {
		const result = await withGlobalFetch(impl, () => publishToGitHubV1({ ...basePublishInputForAndGate(), env, fetchImpl: impl }));
		const serialized = JSON.stringify(result);
		assert.equal(serialized.includes(token), false, "raw token must not appear in serialized result");
		assert.equal(result.errors.join("|").includes(token), false);
		assert.equal((result.remoteWrite.redactedReason ?? "").includes(token), false);
	}
	// Block-mode failure modes (no fetch involved):
	const blockModes: Array<{ overrideInput: Record<string, unknown> }> = [
		{ overrideInput: { allowActualRemoteWrite: false } },
		{ overrideInput: { connectorGateSatisfied: false } },
		{ overrideInput: { productionPublishFlagRef: undefined } },
		{ overrideInput: { surplusUsageGateRef: undefined } },
		{ overrideInput: { minimizationPolicyRef: undefined } },
		{ overrideInput: { guardApprovalRef: "" } },
		{ overrideInput: { ledgerIdempotencyRef: "" } },
	];
	for (const { overrideInput } of blockModes) {
		const result = await publishToGitHubV1({ ...basePublishInputForAndGate(), env, ...overrideInput });
		const serialized = JSON.stringify(result);
		assert.equal(serialized.includes(token), false, `token must not leak for blocked mode ${JSON.stringify(overrideInput)}`);
	}
});

test("Section 2.6 — test_token_not_in_evidence_when_serialized", async () => {
	const token = "ghp_a_definitely_secret_token";
	const fetchImpl: GitHubPublicationFetchV1 = async () => ({ ok: true, status: 201, json: async () => ({ html_url: "https://github.com/flowdesk/repo/pull/12#issuecomment-1" }) });
	const result = await withGlobalFetch(fetchImpl, () => publishToGitHubV1({
		...basePublishInputForAndGate(),
		env: { GITHUB_TOKEN: token },
		fetchImpl,
	}));
	const serialized = JSON.stringify(result.publicationResult);
	assert.equal(serialized.includes(token), false);
	assert.equal(JSON.stringify(result).includes(token), false);
});

test("Section 2.6 — test_authorization_header_only_present_when_remote_write_enabled", async () => {
	let calls = 0;
	const fetchImpl: GitHubPublicationFetchV1 = async () => {
		calls += 1;
		return { ok: true, status: 201, json: async () => ({}) };
	};
	await publishToGitHubV1({
		...basePublishInputForAndGate(),
		allowActualRemoteWrite: false,
		fetchImpl,
	});
	assert.equal(calls, 0, "fetchImpl must not be invoked when allowActualRemoteWrite=false");
});

test("Section 2.6 — test_fetch_not_called_when_preliminary_block_labels_present", async () => {
	let calls = 0;
	const fetchImpl: GitHubPublicationFetchV1 = async () => {
		calls += 1;
		return { ok: true, status: 201, json: async () => ({}) };
	};
	// Remove minimization policy ref to force a preliminary block label.
	const input = basePublishInputForAndGate();
	delete (input as { minimizationPolicyRef?: string }).minimizationPolicyRef;
	const result = await publishToGitHubV1({ ...input, fetchImpl });
	assert.equal(calls, 0);
	assert.equal(result.remoteWrite.state, "skipped");
	assert.ok((result.publicationResult?.blocked_labels ?? []).includes("minimization-policy-missing"));
});

test("Section 2.6 — test_authority_block_invariants_for_all_branches", async () => {
	const assertAuthority = (r: { authority: { advisoryOnlyRecord: true; remoteWriteAuthorityEnabledInRecord: false; dispatchAuthorityEnabled: false; laneLaunchAuthorityEnabled: false }; publicationResult?: { remote_write_authority_enabled?: boolean; dispatch_authority_enabled?: boolean; advisory_only?: boolean } }) => {
		assert.equal(r.authority.advisoryOnlyRecord, true);
		assert.equal(r.authority.remoteWriteAuthorityEnabledInRecord, false);
		assert.equal(r.authority.dispatchAuthorityEnabled, false);
		assert.equal(r.authority.laneLaunchAuthorityEnabled, false);
		if (r.publicationResult !== undefined) {
			assert.equal(r.publicationResult.remote_write_authority_enabled, false);
			assert.equal(r.publicationResult.dispatch_authority_enabled, false);
			assert.equal(r.publicationResult.advisory_only, true);
		}
	};
	// Branch 1: blocked by gates
	assertAuthority(await publishToGitHubV1({ ...basePublishInputForAndGate(), allowActualRemoteWrite: false }));
	// Branch 2: blocked by missing prod evidence
	const noEvidence = basePublishInputForAndGate();
	delete (noEvidence as { productionPublishFlagRef?: string }).productionPublishFlagRef;
	assertAuthority(await publishToGitHubV1(noEvidence));
	// Branch 3: compaction lock branch — covered by separate test, also assert here with input that triggers it indirectly via gating.
	// Branch 4: fetch unavailable
	assertAuthority(await withGlobalFetch(undefined, () => publishToGitHubV1({ ...basePublishInputForAndGate(), fetchImpl: undefined })));
	// Branch 5: API failure
	assertAuthority(await withGlobalFetch(async () => ({ ok: false, status: 500, json: async () => ({}) }), () => publishToGitHubV1({ ...basePublishInputForAndGate(), fetchImpl: async () => ({ ok: false, status: 500, json: async () => ({}) }) })));
	// Branch 6: success
	const success = await withGlobalFetch(async () => ({ ok: true, status: 201, json: async () => ({ html_url: "https://github.com/flowdesk/repo/pull/12#issuecomment-1" }) }), () => publishToGitHubV1({ ...basePublishInputForAndGate(), fetchImpl: async () => ({ ok: true, status: 201, json: async () => ({ html_url: "https://github.com/flowdesk/repo/pull/12#issuecomment-1" }) }) }));
	assertAuthority(success);
});

test("Section 2.6 — test_productionPublish_flag_and_gates_with_existing_preconditions", async () => {
	const removals: Array<keyof ReturnType<typeof basePublishInputForAndGate>> = [
		"productionPublishFlagRef",
		"surplusUsageGateRef",
		"minimizationPolicyRef",
	];
	for (const key of removals) {
		const input = basePublishInputForAndGate();
		delete (input as Record<string, unknown>)[key as string];
		const result = await publishToGitHubV1(input);
		assert.equal(result.publicationResult?.publication_state, "blocked", `removing ${key} must block`);
		assert.equal(result.remoteWrite.state, "skipped", `removing ${key} must skip remote write`);
	}
	// Removing the boolean preconditions also blocks. guardApprovalRef and
	// ledgerIdempotencyRef are validated by the core publication-result writer
	// itself, so when they are empty the advisory record cannot be built and
	// publicationResult is undefined; we instead assert that the remote-write
	// state is "skipped" with the expected label in redactedReason.
	for (const { override, label } of [
		{ override: { allowActualRemoteWrite: false }, label: "actual-remote-write-not-enabled" },
		{ override: { connectorGateSatisfied: false }, label: "connector-gate-not-satisfied" },
		{ override: { guardApprovalRef: "" }, label: "guard-approval-ref-missing" },
		{ override: { ledgerIdempotencyRef: "" }, label: "ledger-idempotency-ref-missing" },
	]) {
		const result = await publishToGitHubV1({ ...basePublishInputForAndGate(), ...override });
		assert.equal(result.ok, false);
		assert.equal(result.remoteWrite.state, "skipped");
		assert.match(result.remoteWrite.redactedReason ?? "", new RegExp(label));
	}
});

test("Section 2.6 — test_mock_fetchImpl_seam_works_in_test_and_is_disabled_in_production", async () => {
	// (a) Production flag absent → override honored
	const overrideFetch: GitHubPublicationFetchV1 = async () => ({ ok: true, status: 201, json: async () => ({}) });
	const noFlagInput = basePublishInputForAndGate();
	delete (noFlagInput as { productionPublishFlagRef?: string }).productionPublishFlagRef;
	const selectedTest = resolveGitHubPublicationFetchImplForContextV1({ productionPublishEnabled: false, fetchImpl: overrideFetch });
	assert.equal(selectedTest, overrideFetch);
	// (b) Production flag enabled → override ignored, globalThis.fetch returned
	let globalCalled = false;
	const globalFetch: GitHubPublicationFetchV1 = async () => {
		globalCalled = true;
		return { ok: true, status: 201, json: async () => ({ html_url: "https://github.com/flowdesk/repo/pull/12#issuecomment-1" }) };
	};
	const overrideCalled = { v: false };
	const overrideFetch2: GitHubPublicationFetchV1 = async () => {
		overrideCalled.v = true;
		throw new Error("override must be ignored");
	};
	const result = await withGlobalFetch(globalFetch, () => publishToGitHubV1({ ...basePublishInputForAndGate(), fetchImpl: overrideFetch2 }));
	assert.equal(result.remoteWrite.state, "posted");
	assert.equal(globalCalled, true);
	assert.equal(overrideCalled.v, false);
});

test("Section 2.6 — test_content_markdown_forbidden_marker_rejected", async () => {
	// Validate helper for each marker (parameterized) and verify connector rejects them.
	for (const marker of FORBIDDEN_RAW_PAYLOAD_MARKERS) {
		assert.equal(validateContentMarkdownAgainstForbiddenMarkers(`Body containing ${marker} keyword`), true, marker);
	}
	// Also verify the connector marks the label when the body has a marker.
	const result = await publishToGitHubV1({
		...basePublishInputForAndGate(),
		contentMarkdown: "Body referencing token within a sentence.",
	});
	assert.equal(result.ok, false);
	assert.ok((result.publicationResult?.blocked_labels ?? []).includes("content-markdown-contains-forbidden-marker"));
});

test("Section 2.6 — test_content_markdown_requires_minimization_policy_ref", async () => {
	const input = basePublishInputForAndGate();
	delete (input as { minimizationPolicyRef?: string }).minimizationPolicyRef;
	const result = await publishToGitHubV1(input);
	assert.equal(result.publicationResult?.publication_state, "blocked");
	assert.ok((result.publicationResult?.blocked_labels ?? []).includes("minimization-policy-missing"));
});

test("Section 2.6 — test_redactedReason_is_fixed_enum", async () => {
	// Compose a multi-block scenario and assert every comma-separated label
	// in redactedReason belongs to ALLOWED_REDACTED_REASON_LABELS.
	const result = await publishToGitHubV1({
		...basePublishInputForAndGate(),
		allowActualRemoteWrite: false,
		connectorGateSatisfied: false,
		productionPublishFlagRef: undefined,
		surplusUsageGateRef: undefined,
		minimizationPolicyRef: undefined,
		guardApprovalRef: "",
		ledgerIdempotencyRef: "",
	});
	const labels = (result.remoteWrite.redactedReason ?? "").split(",").map((s) => s.trim()).filter((s) => s.length > 0);
	assert.ok(labels.length > 0);
	for (const label of labels) {
		assert.ok(ALLOWED_REDACTED_REASON_LABELS.has(label), `unexpected redactedReason label: ${label}`);
	}
});

test("Section 2.6 — test_rate_limit_403_429_classified_as_rate_limited", async () => {
	for (const status of [403, 429]) {
		const fetchImpl: GitHubPublicationFetchV1 = async () => ({
			ok: false,
			status,
			json: async () => ({ message: "rate limit" }),
		});
		const result = await withGlobalFetch(fetchImpl, () => publishToGitHubV1({ ...basePublishInputForAndGate(), fetchImpl }));
		assert.equal(result.remoteWrite.statusCode, status);
		assert.equal(result.remoteWrite.redactedReason, "github-api-rate-limited", `status ${status}`);
		assert.ok((result.publicationResult?.blocked_labels ?? []).includes("github-api-rate-limited"));
	}
});

test("Section 2.6 — guard-approval-ref-missing label emitted when guardApprovalRef empty", async () => {
	// When guardApprovalRef is empty, the advisory publication record cannot be
	// built by createFlowDeskFederatedPublicationResultV1 (it validates opaque
	// refs strictly). The connector still blocks the publish and surfaces the
	// label through redactedReason.
	const result = await publishToGitHubV1({
		...basePublishInputForAndGate(),
		guardApprovalRef: "",
	});
	assert.equal(result.ok, false);
	assert.equal(result.remoteWrite.state, "skipped");
	assert.match(result.remoteWrite.redactedReason ?? "", /guard-approval-ref-missing/);
});

test("Section 2.6 — guard-approval-attempt-mismatch label emitted when flag's consumes_guard_approval_ref differs", async () => {
	// Build a productionPublish flag bound to a DIFFERENT guard approval ref,
	// while the publish call presents "guard-approval-ref-test".
	const evidence = validProductionEvidence();
	const mismatchedFlag = createFlowDeskGitHubConnectorProductionPublishFlagV1({
		state: "enabled",
		consumesSurplusUsageGateRef: "surplus-gate-ref-test",
		consumesMinimizationPolicyRef: "minimization-policy-ref-test",
		consumesGuardApprovalRef: "different-guard-approval-ref",
		createdAt: fixedNow.toISOString(),
	});
	assert.equal(mismatchedFlag.ok, true);
	const newEvidenceMap = new Map<string, unknown>([
		["production-flag-ref-test", mismatchedFlag.flag],
		["surplus-gate-ref-test", evidence.evidenceRefResolver("surplus-gate-ref-test")],
		["minimization-policy-ref-test", evidence.evidenceRefResolver("minimization-policy-ref-test")],
	]);
	const result = await publishToGitHubV1({
		...basePublishInputForAndGate(),
		evidenceRefResolver: (ref: string) => newEvidenceMap.get(ref),
	});
	assert.equal(result.publicationResult?.publication_state, "blocked");
	assert.ok((result.publicationResult?.blocked_labels ?? []).includes("guard-approval-attempt-mismatch"));
});

test("Section 2.6 — ledger-idempotency-ref-missing label emitted when ledgerIdempotencyRef empty", async () => {
	// Same shape as guard-approval-ref-missing: the core publication-result
	// writer rejects empty ledgerIdempotencyRef, so publicationResult is
	// undefined but the connector still surfaces the label.
	const result = await publishToGitHubV1({
		...basePublishInputForAndGate(),
		ledgerIdempotencyRef: "",
	});
	assert.equal(result.ok, false);
	assert.equal(result.remoteWrite.state, "skipped");
	assert.match(result.remoteWrite.redactedReason ?? "", /ledger-idempotency-ref-missing/);
});

// ── Phase 8e: fetchModelAvailabilityDbFromGitHubV1 ───────────────────────────

/**
 * Build a minimal model-availability SQLite DB file in a temp directory.
 * Returns the absolute path to the written DB file and its sha256 hex digest.
 */
function buildMinimalModelAvailabilityDb(
	dir: string,
	observedAt: string,
	dbName = "model-availability.db",
): { dbPath: string; sha256: string } {
	const dbPath = join(dir, dbName);
	const db = new DatabaseSync(dbPath);
	db.exec(`
		CREATE TABLE IF NOT EXISTS snapshot (
			id INTEGER PRIMARY KEY CHECK (id = 1),
			schema_version TEXT NOT NULL,
			observed_at TEXT NOT NULL
		);
		CREATE TABLE IF NOT EXISTS models (
			model_id TEXT PRIMARY KEY,
			provider_family TEXT NOT NULL,
			status TEXT NOT NULL,
			available INTEGER NOT NULL DEFAULT 0
		);
		PRAGMA journal_mode=DELETE;
	`);
	db.prepare("INSERT OR REPLACE INTO snapshot (id, schema_version, observed_at) VALUES (1, ?, ?)").run(
		"flowdesk.opencode_model_availability_snapshot.v1",
		observedAt,
	);
	// Checkpoint and switch to DELETE journal mode so the .db file is
	// self-contained (no WAL sidecar files) when copied byte-for-byte.
	db.exec("PRAGMA wal_checkpoint(TRUNCATE)");
	db.close();
	const bytes = readFileSync(dbPath);
	const sha256 = createHash("sha256").update(bytes).digest("hex");
	return { dbPath, sha256 };
}

test("Section 8e — fetchModelAvailabilityDbFromGitHubV1 blocks when allowActualRemoteRead is absent", async () => {
	const tmpDir = mkdtempSync(join(tmpdir(), "flowdesk-test-fetch-"));
	try {
		const targetPath = join(tmpDir, "out.db");
		const result = await fetchModelAvailabilityDbFromGitHubV1({
			assetUrl: "https://example.com/model-availability.db",
			expectedSha256: "a".repeat(64),
			currentObservedAt: "",
			targetPath,
			// allowActualRemoteRead intentionally omitted
		});
		assert.equal(result.status, "blocked");
		assert.ok(Array.isArray(result.blocked_labels));
		assert.ok(result.blocked_labels!.includes("remote-read-not-enabled"));
	} finally {
		rmSync(tmpDir, { recursive: true, force: true });
	}
});

test("Section 8e — fetchModelAvailabilityDbFromGitHubV1 blocks when allowActualRemoteRead is false", async () => {
	const tmpDir = mkdtempSync(join(tmpdir(), "flowdesk-test-fetch-"));
	try {
		const targetPath = join(tmpDir, "out.db");
		const result = await fetchModelAvailabilityDbFromGitHubV1({
			assetUrl: "https://example.com/model-availability.db",
			expectedSha256: "a".repeat(64),
			currentObservedAt: "",
			targetPath,
			allowActualRemoteRead: false,
		});
		assert.equal(result.status, "blocked");
		assert.ok(result.blocked_labels!.includes("remote-read-not-enabled"));
	} finally {
		rmSync(tmpDir, { recursive: true, force: true });
	}
});

test("Section 8e — fetchModelAvailabilityDbFromGitHubV1 blocks on missing assetUrl", async () => {
	const tmpDir = mkdtempSync(join(tmpdir(), "flowdesk-test-fetch-"));
	try {
		const result = await fetchModelAvailabilityDbFromGitHubV1({
			assetUrl: "",
			expectedSha256: "a".repeat(64),
			currentObservedAt: "",
			targetPath: join(tmpDir, "out.db"),
			allowActualRemoteRead: true,
		});
		assert.equal(result.status, "blocked");
		assert.ok(result.blocked_labels!.includes("asset-url-missing"));
	} finally {
		rmSync(tmpDir, { recursive: true, force: true });
	}
});

test("Section 8e — fetchModelAvailabilityDbFromGitHubV1 blocks on invalid expectedSha256", async () => {
	const tmpDir = mkdtempSync(join(tmpdir(), "flowdesk-test-fetch-"));
	try {
		const result = await fetchModelAvailabilityDbFromGitHubV1({
			assetUrl: "https://example.com/model-availability.db",
			expectedSha256: "not-a-hex-digest",
			currentObservedAt: "",
			targetPath: join(tmpDir, "out.db"),
			allowActualRemoteRead: true,
		});
		assert.equal(result.status, "blocked");
		assert.ok(result.blocked_labels!.includes("expected-sha256-invalid"));
	} finally {
		rmSync(tmpDir, { recursive: true, force: true });
	}
});

test("Section 8e — fetchModelAvailabilityDbFromGitHubV1 returns fetch_failed on network error", async () => {
	const tmpDir = mkdtempSync(join(tmpdir(), "flowdesk-test-fetch-"));
	try {
		// Patch globalThis.fetch temporarily to simulate a network failure.
		const originalFetch = globalThis.fetch;
		globalThis.fetch = (async () => { throw new Error("ECONNREFUSED"); }) as unknown as typeof globalThis.fetch;
		try {
			const result = await fetchModelAvailabilityDbFromGitHubV1({
				assetUrl: "https://example.com/model-availability.db",
				expectedSha256: "a".repeat(64),
				currentObservedAt: "",
				targetPath: join(tmpDir, "out.db"),
				allowActualRemoteRead: true,
			});
			assert.equal(result.status, "fetch_failed");
		} finally {
			globalThis.fetch = originalFetch;
		}
	} finally {
		rmSync(tmpDir, { recursive: true, force: true });
	}
});

test("Section 8e — fetchModelAvailabilityDbFromGitHubV1 returns fetch_failed on non-2xx HTTP status", async () => {
	const tmpDir = mkdtempSync(join(tmpdir(), "flowdesk-test-fetch-"));
	try {
		const originalFetch = globalThis.fetch;
		// @ts-expect-error — deliberately replacing fetch for test.
		globalThis.fetch = async () => ({
			ok: false,
			status: 404,
			arrayBuffer: async () => new ArrayBuffer(0),
		});
		try {
			const result = await fetchModelAvailabilityDbFromGitHubV1({
				assetUrl: "https://example.com/model-availability.db",
				expectedSha256: "a".repeat(64),
				currentObservedAt: "",
				targetPath: join(tmpDir, "out.db"),
				allowActualRemoteRead: true,
			});
			assert.equal(result.status, "fetch_failed");
		} finally {
			globalThis.fetch = originalFetch;
		}
	} finally {
		rmSync(tmpDir, { recursive: true, force: true });
	}
});

test("Section 8e — fetchModelAvailabilityDbFromGitHubV1 returns sha256_mismatch when digests differ", async () => {
	const tmpDir = mkdtempSync(join(tmpdir(), "flowdesk-test-fetch-"));
	try {
		const fakeContent = Buffer.from("fake-db-content");
		const originalFetch = globalThis.fetch;
		// @ts-expect-error — deliberately replacing fetch for test.
		globalThis.fetch = async () => ({
			ok: true,
			status: 200,
			arrayBuffer: async () => fakeContent.buffer.slice(fakeContent.byteOffset, fakeContent.byteOffset + fakeContent.byteLength),
		});
		try {
			const result = await fetchModelAvailabilityDbFromGitHubV1({
				assetUrl: "https://example.com/model-availability.db",
				expectedSha256: "a".repeat(64), // wrong digest
				currentObservedAt: "",
				targetPath: join(tmpDir, "out.db"),
				allowActualRemoteRead: true,
			});
			assert.equal(result.status, "sha256_mismatch");
			// The actual sha256 must be returned so the caller can diagnose.
			assert.ok(typeof result.sha256 === "string" && result.sha256.length === 64);
		} finally {
			globalThis.fetch = originalFetch;
		}
	} finally {
		rmSync(tmpDir, { recursive: true, force: true });
	}
});

test("Section 8e — fetchModelAvailabilityDbFromGitHubV1 returns skipped_downgrade when fetched observed_at is older", async () => {
	const srcDir = mkdtempSync(join(tmpdir(), "flowdesk-test-fetch-src-"));
	const dstDir = mkdtempSync(join(tmpdir(), "flowdesk-test-fetch-dst-"));
	try {
		const { dbPath, sha256 } = buildMinimalModelAvailabilityDb(srcDir, "2025-01-01T00:00:00.000Z");
		const dbBytes = readFileSync(dbPath);
		const originalFetch = globalThis.fetch;
		// @ts-expect-error — deliberately replacing fetch for test.
		globalThis.fetch = async () => ({
			ok: true,
			status: 200,
			arrayBuffer: async () => {
				const ab = new ArrayBuffer(dbBytes.byteLength);
				Buffer.from(ab).set(dbBytes);
				return ab;
			},
		});
		try {
			const result = await fetchModelAvailabilityDbFromGitHubV1({
				assetUrl: "https://example.com/model-availability.db",
				expectedSha256: sha256,
				// currentObservedAt is NEWER than the fetched DB → downgrade
				currentObservedAt: "2026-01-01T00:00:00.000Z",
				targetPath: join(dstDir, "out.db"),
				allowActualRemoteRead: true,
			});
			assert.equal(result.status, "skipped_downgrade");
			assert.equal(result.sha256, sha256);
			assert.equal(result.observedAt, "2025-01-01T00:00:00.000Z");
		} finally {
			globalThis.fetch = originalFetch;
		}
	} finally {
		rmSync(srcDir, { recursive: true, force: true });
		rmSync(dstDir, { recursive: true, force: true });
	}
});

test("Section 8e — fetchModelAvailabilityDbFromGitHubV1 fetches and atomically writes DB on success", async () => {
	const srcDir = mkdtempSync(join(tmpdir(), "flowdesk-test-fetch-src-"));
	const dstDir = mkdtempSync(join(tmpdir(), "flowdesk-test-fetch-dst-"));
	try {
		const { dbPath, sha256 } = buildMinimalModelAvailabilityDb(srcDir, "2026-06-01T00:00:00.000Z");
		const dbBytes = readFileSync(dbPath);
		const originalFetch = globalThis.fetch;
		// @ts-expect-error — deliberately replacing fetch for test.
		globalThis.fetch = async () => ({
			ok: true,
			status: 200,
			arrayBuffer: async () => {
				const ab = new ArrayBuffer(dbBytes.byteLength);
				Buffer.from(ab).set(dbBytes);
				return ab;
			},
		});
		try {
			const targetPath = join(dstDir, "out.db");
			const result = await fetchModelAvailabilityDbFromGitHubV1({
				assetUrl: "https://example.com/model-availability.db",
				expectedSha256: sha256,
				// currentObservedAt is older → no downgrade → proceed
				currentObservedAt: "2025-01-01T00:00:00.000Z",
				targetPath,
				allowActualRemoteRead: true,
			});
			assert.equal(result.status, "fetched");
			assert.equal(result.sha256, sha256);
			assert.equal(result.observedAt, "2026-06-01T00:00:00.000Z");
			// Verify the file was actually written.
			const writtenBytes = readFileSync(targetPath);
			const writtenSha256 = createHash("sha256").update(writtenBytes).digest("hex");
			assert.equal(writtenSha256, sha256);
		} finally {
			globalThis.fetch = originalFetch;
		}
	} finally {
		rmSync(srcDir, { recursive: true, force: true });
		rmSync(dstDir, { recursive: true, force: true });
	}
});

// ── Phase 8f: fetchProviderCatalogFromGitHubV1 tests ─────────────────────────

test("fetchProviderCatalogFromGitHubV1 blocks when allowActualRemoteRead is not true", async () => {
	const result = await fetchProviderCatalogFromGitHubV1({
		assetUrl: "https://example.com/provider-catalog.json",
		expectedSha256: "a".repeat(64),
		currentUpdatedAt: "",
		targetPath: "/tmp/provider-catalog.json",
		allowActualRemoteRead: false,
	});
	assert.equal(result.status, "blocked");
	assert.ok(result.blocked_labels?.includes("remote-read-not-enabled"));

	const resultMissing = await fetchProviderCatalogFromGitHubV1({
		assetUrl: "https://example.com/provider-catalog.json",
		expectedSha256: "a".repeat(64),
		currentUpdatedAt: "",
		targetPath: "/tmp/provider-catalog.json",
	});
	assert.equal(resultMissing.status, "blocked");
	assert.ok(resultMissing.blocked_labels?.includes("remote-read-not-enabled"));
});

test("fetchProviderCatalogFromGitHubV1 blocks on invalid input (missing URL, bad sha256, missing target path)", async () => {
	const resultNoUrl = await fetchProviderCatalogFromGitHubV1({
		assetUrl: "",
		expectedSha256: "a".repeat(64),
		currentUpdatedAt: "",
		targetPath: "/tmp/provider-catalog.json",
		allowActualRemoteRead: true,
	});
	assert.equal(resultNoUrl.status, "blocked");
	assert.ok(resultNoUrl.blocked_labels?.includes("asset-url-missing"));

	const resultBadSha = await fetchProviderCatalogFromGitHubV1({
		assetUrl: "https://example.com/provider-catalog.json",
		expectedSha256: "not-a-valid-sha256",
		currentUpdatedAt: "",
		targetPath: "/tmp/provider-catalog.json",
		allowActualRemoteRead: true,
	});
	assert.equal(resultBadSha.status, "blocked");
	assert.ok(resultBadSha.blocked_labels?.includes("expected-sha256-invalid"));

	const resultNoTarget = await fetchProviderCatalogFromGitHubV1({
		assetUrl: "https://example.com/provider-catalog.json",
		expectedSha256: "a".repeat(64),
		currentUpdatedAt: "",
		targetPath: "",
		allowActualRemoteRead: true,
	});
	assert.equal(resultNoTarget.status, "blocked");
	assert.ok(resultNoTarget.blocked_labels?.includes("target-path-missing"));
});

test("fetchProviderCatalogFromGitHubV1 fetches, validates, and writes a catalog atomically", async () => {
	const dstDir = mkdtempSync(join(tmpdir(), "flowdesk-catalog-test-"));
	const targetPath = join(dstDir, "provider-catalog.json");

	// Build a minimal valid catalog
	const catalogContent = JSON.stringify({
		schema_version: "flowdesk.provider_catalog.v1",
		updated_at: "2026-06-10T00:00:00Z",
		families: [
			{
				family: "claude",
				opencode_provider_id: "anthropic",
				prefixes: ["anthropic/"],
				stage_keywords: ["opus"],
				fallback_chains: [["anthropic/claude-opus-4-7"]],
				deprecated_model_ids: [],
				agent_name: "reviewer-claude-opus",
			},
		],
		supported_model_ids: ["anthropic/claude-opus-4-7"],
		tiers: {
			heavy: [{ providerQualifiedModelId: "anthropic/claude-opus-4-7", providerFamily: "claude", agentName: "reviewer-claude-opus" }],
			medium: [],
			light: [],
		},
		roles: {},
	});
	const sha256 = createHash("sha256").update(catalogContent, "utf8").digest("hex");

	// Mock globalThis.fetch
	const originalFetch = globalThis.fetch;
	try {
		globalThis.fetch = (async (_url: string, _init: unknown) => {
			const buf = Buffer.from(catalogContent, "utf8");
			return {
				ok: true,
				status: 200,
				arrayBuffer: async () => buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength),
			};
		}) as unknown as typeof globalThis.fetch;

		const result = await fetchProviderCatalogFromGitHubV1({
			assetUrl: "https://example.com/provider-catalog.json",
			expectedSha256: sha256,
			currentUpdatedAt: "",
			targetPath,
			allowActualRemoteRead: true,
		});
		assert.equal(result.status, "fetched", `Expected fetched, got ${result.status} (errors: ${JSON.stringify(result.validationErrors)})`);
		assert.equal(result.sha256, sha256);
		assert.equal(result.updatedAt, "2026-06-10T00:00:00Z");
		// Verify the file was actually written
		const writtenText = readFileSync(targetPath, "utf8");
		assert.equal(writtenText, catalogContent);
	} finally {
		globalThis.fetch = originalFetch;
		rmSync(dstDir, { recursive: true, force: true });
	}
});

test("fetchProviderCatalogFromGitHubV1 prevents downgrade when fetched catalog is older", async () => {
	const dstDir = mkdtempSync(join(tmpdir(), "flowdesk-catalog-downgrade-test-"));
	const targetPath = join(dstDir, "provider-catalog.json");

	const olderCatalog = JSON.stringify({
		schema_version: "flowdesk.provider_catalog.v1",
		updated_at: "2026-01-01T00:00:00Z",
		families: [
			{
				family: "claude",
				opencode_provider_id: "anthropic",
				prefixes: ["anthropic/"],
				stage_keywords: ["opus"],
				fallback_chains: [["anthropic/claude-opus-4-7"]],
				deprecated_model_ids: [],
				agent_name: "reviewer-claude-opus",
			},
		],
		supported_model_ids: ["anthropic/claude-opus-4-7"],
		tiers: { heavy: [], medium: [], light: [] },
		roles: {},
	});
	const sha256 = createHash("sha256").update(olderCatalog, "utf8").digest("hex");

	const originalFetch = globalThis.fetch;
	try {
		globalThis.fetch = (async (_url: string, _init: unknown) => {
			const buf = Buffer.from(olderCatalog, "utf8");
			return {
				ok: true,
				status: 200,
				arrayBuffer: async () => buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength),
			};
		}) as unknown as typeof globalThis.fetch;

		// Current catalog is newer (2026-06-10) than fetched (2026-01-01) → downgrade prevented
		const result = await fetchProviderCatalogFromGitHubV1({
			assetUrl: "https://example.com/provider-catalog.json",
			expectedSha256: sha256,
			currentUpdatedAt: "2026-06-10T00:00:00Z",
			targetPath,
			allowActualRemoteRead: true,
		});
		assert.equal(result.status, "skipped_downgrade");
		assert.equal(result.updatedAt, "2026-01-01T00:00:00Z");
	} finally {
		globalThis.fetch = originalFetch;
		rmSync(dstDir, { recursive: true, force: true });
	}
});

test("fetchProviderCatalogFromGitHubV1 returns sha256_mismatch when downloaded content differs", async () => {
	const dstDir = mkdtempSync(join(tmpdir(), "flowdesk-catalog-sha-test-"));
	const targetPath = join(dstDir, "provider-catalog.json");
	const originalFetch = globalThis.fetch;
	try {
		globalThis.fetch = (async (_url: string, _init: unknown) => {
			const buf = Buffer.from('{"some":"json"}', "utf8");
			return {
				ok: true,
				status: 200,
				arrayBuffer: async () => buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength),
			};
		}) as unknown as typeof globalThis.fetch;

		const result = await fetchProviderCatalogFromGitHubV1({
			assetUrl: "https://example.com/provider-catalog.json",
			expectedSha256: "b".repeat(64), // wrong sha256
			currentUpdatedAt: "",
			targetPath,
			allowActualRemoteRead: true,
		});
		assert.equal(result.status, "sha256_mismatch");
	} finally {
		globalThis.fetch = originalFetch;
		rmSync(dstDir, { recursive: true, force: true });
	}
});

test("fetchProviderCatalogFromGitHubV1 returns validation_failed for structurally invalid catalog JSON", async () => {
	const dstDir = mkdtempSync(join(tmpdir(), "flowdesk-catalog-validation-test-"));
	const targetPath = join(dstDir, "provider-catalog.json");

	const badCatalog = JSON.stringify({
		schema_version: "flowdesk.provider_catalog.v1",
		updated_at: "2026-06-10T00:00:00Z",
		families: [
			{
				family: "claude",
				opencode_provider_id: "../../path-traversal", // invalid
				prefixes: ["anthropic/"],
				stage_keywords: ["opus"],
				fallback_chains: [],
				deprecated_model_ids: [],
				agent_name: "reviewer-claude-opus",
			},
		],
		supported_model_ids: [],
		tiers: { heavy: [], medium: [], light: [] },
		roles: {},
	});
	const sha256 = createHash("sha256").update(badCatalog, "utf8").digest("hex");

	const originalFetch = globalThis.fetch;
	try {
		globalThis.fetch = (async (_url: string, _init: unknown) => {
			const buf = Buffer.from(badCatalog, "utf8");
			return {
				ok: true,
				status: 200,
				arrayBuffer: async () => buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength),
			};
		}) as unknown as typeof globalThis.fetch;

		const result = await fetchProviderCatalogFromGitHubV1({
			assetUrl: "https://example.com/provider-catalog.json",
			expectedSha256: sha256,
			currentUpdatedAt: "",
			targetPath,
			allowActualRemoteRead: true,
		});
		assert.equal(result.status, "validation_failed");
		assert.ok(Array.isArray(result.validationErrors) && result.validationErrors.length > 0);
		assert.ok(result.validationErrors!.some((e) => e.includes("opencode_provider_id")));
	} finally {
		globalThis.fetch = originalFetch;
		rmSync(dstDir, { recursive: true, force: true });
	}
});
