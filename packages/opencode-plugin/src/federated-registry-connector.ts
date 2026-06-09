import {
	createFlowDeskFederatedRegistryConnectorCapabilityV1,
	createFlowDeskGitHubOAuthArchitectureV1,
	createFlowDeskFederatedPublicationResultV1,
	evaluateFlowDeskFederatedRegistryConnectorGateV1,
	type FlowDeskEvidenceRefResolverV1,
	type FlowDeskFederatedConnectorKindV1,
	type FlowDeskFederatedConnectorCapabilityStateV1,
	type FlowDeskFederatedPublicationResultV1,
	type FlowDeskFederatedRegistryConnectorCapabilityResultV1,
	type FlowDeskFederatedGateEvaluationResultV1,
	type FlowDeskGitHubDryRunPublicationResultV1,
	type FlowDeskGitHubOAuthArchitectureResultV1,
	validateMinimizationPolicyRef,
	validateProductionPublishFlagRef,
	validateSurplusUsageGateRef,
	validateFlowDeskGitHubDryRunPublicationResultV1,
} from "@flowdesk/core";
import { randomBytes } from "node:crypto";
import { existsSync } from "node:fs";
import { join } from "node:path";

export type GitHubConnectorAuthSourceV1 = "env_github_token" | "env_flowdesk_oauth_token" | "none";

export interface GitHubConnectorDiscoveryOptionsV1 {
	env?: NodeJS.ProcessEnv;
	commandExists?: (command: "gh") => boolean | Promise<boolean>;
	now?: () => Date;
}

/**
 * Discovery result for the GitHub federated registry connector.
 */
export interface GitHubConnectorDiscoveryV1 {
	githubTokenAvailable: boolean;
	ghCliAvailable: boolean;
	capabilityState: FlowDeskFederatedConnectorCapabilityStateV1;
	authSource: GitHubConnectorAuthSourceV1;
	discoveredAt: string;
	reason?: string;
}

/**
 * Discover the GitHub connector capability by checking environment and tools.
 * Advisory-only discovery.
 */
export async function discoverGitHubConnectorV1(options: GitHubConnectorDiscoveryOptionsV1 = {}): Promise<GitHubConnectorDiscoveryV1> {
	const env = options.env ?? process.env;
	const githubTokenAvailable = typeof env.GITHUB_TOKEN === "string" && env.GITHUB_TOKEN.trim().length > 0;
	const flowdeskOAuthTokenAvailable = typeof env.FLOWDESK_GITHUB_OAUTH_TOKEN === "string" && env.FLOWDESK_GITHUB_OAUTH_TOKEN.trim().length > 0;
	const ghCliAvailable = options.commandExists === undefined ? false : await options.commandExists("gh");
	const discoveredAt = (options.now ?? (() => new Date()))().toISOString();
	const authSource: GitHubConnectorAuthSourceV1 = githubTokenAvailable
		? "env_github_token"
		: flowdeskOAuthTokenAvailable
			? "env_flowdesk_oauth_token"
			: "none";
	const tokenAvailable = githubTokenAvailable || flowdeskOAuthTokenAvailable;

	let capabilityState: FlowDeskFederatedConnectorCapabilityStateV1 = "auth_missing";
	let reason: string | undefined;

	if (tokenAvailable) {
		capabilityState = "available";
	} else if (!ghCliAvailable) {
		capabilityState = "missing_tools";
		reason = "GitHub token is missing and gh CLI availability was not proven";
	} else {
		capabilityState = "auth_missing";
		reason = "GITHUB_TOKEN or FLOWDESK_GITHUB_OAUTH_TOKEN environment variable is missing";
	}

	return {
		githubTokenAvailable: tokenAvailable,
		ghCliAvailable,
		capabilityState,
		authSource,
		discoveredAt,
		...(reason === undefined ? {} : { reason }),
	};
}

/**
 * Build the capability descriptor for the GitHub connector.
 */
export function buildGitHubConnectorCapabilityDescriptorV1(
	discovery: GitHubConnectorDiscoveryV1,
	connectorKind: FlowDeskFederatedConnectorKindV1 = "github_pr_comment"
): FlowDeskFederatedRegistryConnectorCapabilityResultV1 {
	const capabilityDescriptorId = `cap-gh-${randomBytes(8).toString("hex")}`;
	
	return createFlowDeskFederatedRegistryConnectorCapabilityV1({
		capabilityDescriptorId,
		capabilityRef: "github-federated-connector-v1",
		connectorKind,
		connectorProfileRef: "profile-github-default",
		registryRef: "registry-github-community",
		authScopeRef: "scope-github-repo-or-public-repo",
		targetKind: connectorKind,
		toolRef: discovery.ghCliAvailable ? "tool-gh-cli" : "tool-github-rest-api",
		capabilityState: discovery.capabilityState,
		contentFormatRef: "format-markdown-federated-score-v1",
		dryRunSupported: true,
		discoveredAt: discovery.discoveredAt,
	});
}

export function buildGitHubOAuthArchitectureDescriptorV1(
	discovery: GitHubConnectorDiscoveryV1,
): FlowDeskGitHubOAuthArchitectureResultV1 {
	return createFlowDeskGitHubOAuthArchitectureV1({
		architectureId: `github-oauth-arch-${randomBytes(8).toString("hex")}`,
		authScopeRef: "scope-github-repo-or-public-repo",
		requiredGithubScopes: ["repo", "public_repo"],
		tokenRef: discovery.authSource === "none" ? "github-token-ref-missing" : `github-token-ref-${discovery.authSource}`,
		authState: discovery.githubTokenAvailable ? "configured" : "missing",
		dryRunAllowedWithoutToken: true,
	});
}

export function evaluateGitHubConnectorGateV1(input: {
	workflowId: string;
	attemptId: string;
	capabilityDescriptorRef?: string;
	privacyReviewRef?: string;
	securityAuditRef?: string;
}): FlowDeskFederatedGateEvaluationResultV1 {
	return evaluateFlowDeskFederatedRegistryConnectorGateV1({
		workflowId: input.workflowId,
		attemptId: input.attemptId,
		...(input.capabilityDescriptorRef === undefined ? {} : { capabilityDescriptorRef: input.capabilityDescriptorRef }),
		...(input.privacyReviewRef === undefined ? {} : { privacyReviewRef: input.privacyReviewRef }),
		...(input.securityAuditRef === undefined ? {} : { securityAuditRef: input.securityAuditRef }),
	});
}

export interface GitHubPublicationTargetV1 {
	kind: "github_issue" | "github_pr_comment";
	owner: string;
	repo: string;
	/** Required for github_pr_comment. GitHub PR comments use the issue comments endpoint. */
	issueNumber?: number;
	/** Required for github_issue. */
	title?: string;
}

export type GitHubPublicationRemoteWriteStateV1 = "skipped" | "posted" | "failed";

export interface GitHubPublicationHttpResponseLikeV1 {
	ok: boolean;
	status: number;
	json: () => Promise<unknown>;
	text?: () => Promise<string>;
}

export type GitHubPublicationFetchV1 = (
	url: string,
	init: {
		method: "POST";
		headers: Record<string, string>;
		body: string;
	},
) => Promise<GitHubPublicationHttpResponseLikeV1>;

export interface GitHubPublicationRemoteWriteSummaryV1 {
	state: GitHubPublicationRemoteWriteStateV1;
	statusCode?: number;
	remoteUrl?: string;
	redactedReason?: string;
	endpointKind: "github_issue" | "github_pr_comment";
}

export interface PublishToGitHubInputV1 {
	dryRunResult: FlowDeskGitHubDryRunPublicationResultV1;
	ledgerIdempotencyRef: string;
	guardApprovalRef: string;
	target: GitHubPublicationTargetV1;
	contentMarkdown: string;
	/** Release 1/later-gate foundation: the only switch that can permit a real remote write. */
	allowActualRemoteWrite: boolean;
	/** Hypothetical later connector gate signal. Main Release 1 flow must keep this false. */
	connectorGateSatisfied?: boolean;
	productionPublishFlagRef?: string;
	surplusUsageGateRef?: string;
	minimizationPolicyRef?: string;
	/** Evidence resolver used by tests and later gated callers; omitted refs fail closed. */
	evidenceRefResolver?: FlowDeskEvidenceRefResolverV1;
	env?: NodeJS.ProcessEnv;
	fetchImpl?: GitHubPublicationFetchV1;
	now?: () => Date;
}

export interface PublishToGitHubResultV1 {
	ok: boolean;
	errors: string[];
	publicationResult?: FlowDeskFederatedPublicationResultV1;
	remoteWrite: GitHubPublicationRemoteWriteSummaryV1;
	authority: {
		advisoryOnlyRecord: true;
		remoteWriteAuthorityEnabledInRecord: false;
		dispatchAuthorityEnabled: false;
		laneLaunchAuthorityEnabled: false;
	};
}

const GITHUB_REPOSITORY_PART_RE = /^[A-Za-z0-9_.-]{1,100}$/;
const CONTENT_MARKDOWN_FORBIDDEN_MARKER_RE = new RegExp(
	[
		"\\bGITHUB_TOKEN\\b",
		"\\bFLOWDESK_[A-Z0-9_]*\\b",
		"\\bBearer\\s+[A-Za-z0-9._~+/=-]{12,}",
		"\\bgh[opsu]_[A-Za-z0-9_]{20,}\\b",
		"\\bgithub_pat_[A-Za-z0-9_]{20,}\\b",
		"-----BEGIN [A-Z ]*PRIVATE KEY-----",
	].join("|"),
	"i",
);
const CONTENT_MARKDOWN_FORBIDDEN_MARKER_LABEL = "content-markdown-contains-forbidden-marker";

function tokenFromGitHubConnectorEnv(env: NodeJS.ProcessEnv): string | undefined {
	const githubToken = typeof env.GITHUB_TOKEN === "string" ? env.GITHUB_TOKEN.trim() : "";
	if (githubToken.length > 0) return githubToken;
	const flowdeskToken = typeof env.FLOWDESK_GITHUB_OAUTH_TOKEN === "string" ? env.FLOWDESK_GITHUB_OAUTH_TOKEN.trim() : "";
	return flowdeskToken.length > 0 ? flowdeskToken : undefined;
}

function validateGitHubPublicationTargetV1(target: GitHubPublicationTargetV1): string[] {
	const errors: string[] = [];
	if (target.kind !== "github_issue" && target.kind !== "github_pr_comment") errors.push("target.kind must be github_issue or github_pr_comment");
	if (!GITHUB_REPOSITORY_PART_RE.test(target.owner)) errors.push("target.owner must be a GitHub owner slug");
	if (!GITHUB_REPOSITORY_PART_RE.test(target.repo)) errors.push("target.repo must be a GitHub repository slug");
	if (target.kind === "github_pr_comment") {
		if (!Number.isInteger(target.issueNumber) || (target.issueNumber ?? 0) < 1) errors.push("target.issueNumber must be a positive integer for github_pr_comment");
	}
	if (target.kind === "github_issue") {
		if (typeof target.title !== "string" || target.title.trim().length === 0 || target.title.length > 256) errors.push("target.title must be non-empty and <= 256 chars for github_issue");
	}
	return errors;
}

function contentMarkdownContainsForbiddenMarkerV1(contentMarkdown: string): boolean {
	return CONTENT_MARKDOWN_FORBIDDEN_MARKER_RE.test(contentMarkdown);
}

function buildGitHubPublicationRequestV1(target: GitHubPublicationTargetV1, contentMarkdown: string): { url: string; body: Record<string, string> } {
	const base = `https://api.github.com/repos/${encodeURIComponent(target.owner)}/${encodeURIComponent(target.repo)}/issues`;
	if (target.kind === "github_pr_comment") {
		return {
			url: `${base}/${target.issueNumber}/comments`,
			body: { body: contentMarkdown },
		};
	}
	return {
		url: base,
		body: { title: target.title ?? "FlowDesk federated registry publication", body: contentMarkdown },
	};
}

function extractGitHubHtmlUrlV1(payload: unknown): string | undefined {
	if (typeof payload !== "object" || payload === null || Array.isArray(payload)) return undefined;
	const value = (payload as { html_url?: unknown }).html_url;
	return typeof value === "string" && /^https:\/\/github\.com\//.test(value) ? value : undefined;
}

function createAdvisoryPublicationResultV1(input: {
	dryRunResult: FlowDeskGitHubDryRunPublicationResultV1;
	ledgerIdempotencyRef: string;
	guardApprovalRef: string;
	publicationState: "pending_gate_promotion" | "blocked";
	blockedLabels: readonly string[];
	now: () => Date;
}): { result?: FlowDeskFederatedPublicationResultV1; errors: string[] } {
	const created = createFlowDeskFederatedPublicationResultV1({
		publicationResultId: `publication-result-${input.dryRunResult.dry_run_result_id.replace(/[^A-Za-z0-9_-]/g, "-").slice(0, 40)}`,
		ledgerIdempotencyRef: input.ledgerIdempotencyRef,
		dryRunResultRef: `ref-${input.dryRunResult.dry_run_result_id}`,
		guardApprovalRef: input.guardApprovalRef,
		publicationState: input.publicationState,
		blockedLabels: input.blockedLabels,
		createdAt: input.now().toISOString(),
	});
	return { result: created.result, errors: created.errors };
}

function productionPublishBlockLabelsV1(input: PublishToGitHubInputV1): { labels: string[]; productionPublishEnabled: boolean } {
	const labels: string[] = [];
	let productionPublishEnabled = false;
	if (input.productionPublishFlagRef === undefined) {
		labels.push("production-publish-flag-missing");
	} else {
		try {
			validateProductionPublishFlagRef(input.productionPublishFlagRef, input.evidenceRefResolver);
			productionPublishEnabled = true;
		} catch (error) {
			const message = error instanceof Error ? error.message : "production publish flag invalid";
			labels.push(message.includes("disabled") || message.includes("unknown") ? "productionPublish-disabled" : "productionPublish-invalid");
		}
	}

	if (input.surplusUsageGateRef === undefined) {
		labels.push("surplus-usage-gate-missing");
	} else {
		try {
			validateSurplusUsageGateRef(input.surplusUsageGateRef, input.evidenceRefResolver);
		} catch (error) {
			const message = error instanceof Error ? error.message : "surplus usage gate invalid";
			if (message.includes("stale")) labels.push("surplusUsageGate-unfresh");
			else if (message.includes("alert level")) labels.push("surplusUsageGate-alert-level-unsafe");
			else if (message.includes("verdict")) labels.push("surplusUsageGate-not-allow");
			else labels.push("surplusUsageGate-invalid");
		}
	}

	if (input.minimizationPolicyRef === undefined) {
		labels.push("minimization-policy-missing");
	} else {
		try {
			validateMinimizationPolicyRef(input.minimizationPolicyRef, input.evidenceRefResolver);
		} catch (error) {
			const message = error instanceof Error ? error.message : "minimization policy invalid";
			labels.push(message.includes("k_anonymity_threshold") ? "minimizationPolicy-invalid-k-anonymity" : "minimizationPolicy-invalid");
		}
	}

	return { labels, productionPublishEnabled };
}

export function resolveGitHubPublicationFetchImplForContextV1(input: {
	productionPublishEnabled: boolean;
	fetchImpl?: GitHubPublicationFetchV1;
}): GitHubPublicationFetchV1 | undefined {
	return input.productionPublishEnabled === true
		? (globalThis.fetch as unknown as GitHubPublicationFetchV1 | undefined)
		: input.fetchImpl ?? (globalThis.fetch as unknown as GitHubPublicationFetchV1 | undefined);
}

/**
 * Perform a GitHub federated-registry publication when a later connector gate is explicitly supplied.
 *
 * The returned FlowDeskFederatedPublicationResultV1 remains advisory-only by design: it never claims
 * connector_gate_satisfied, remote_write_attempted, github_write_attempted, or remote-write authority.
 * The actual network side effect is exposed only as transient remoteWrite metadata and is guarded by
 * allowActualRemoteWrite=true plus connectorGateSatisfied=true.
 */
export async function publishToGitHubV1(input: PublishToGitHubInputV1): Promise<PublishToGitHubResultV1> {
	const now = input.now ?? (() => new Date());
	const authority = {
		advisoryOnlyRecord: true as const,
		remoteWriteAuthorityEnabledInRecord: false as const,
		dispatchAuthorityEnabled: false as const,
		laneLaunchAuthorityEnabled: false as const,
	};
	const dryRunValidation = validateFlowDeskGitHubDryRunPublicationResultV1(input.dryRunResult);
	const errors: string[] = dryRunValidation.ok ? [] : dryRunValidation.errors;
	errors.push(...validateGitHubPublicationTargetV1(input.target));
	if (input.dryRunResult.connector_kind !== input.target.kind) errors.push("target.kind must match dryRunResult.connector_kind");
	if (input.dryRunResult.dry_run_state !== "dry_run_recorded") errors.push("dryRunResult must be dry_run_recorded");
	if (typeof input.contentMarkdown !== "string" || input.contentMarkdown.trim().length === 0) errors.push("contentMarkdown must be non-empty");
	if (input.contentMarkdown.length > 60_000) errors.push("contentMarkdown must be <= 60000 chars");
	const contentMarkdownBlockLabels: string[] = [];
	if (contentMarkdownContainsForbiddenMarkerV1(input.contentMarkdown)) {
		errors.push("contentMarkdown contains a forbidden marker");
		contentMarkdownBlockLabels.push(CONTENT_MARKDOWN_FORBIDDEN_MARKER_LABEL);
	}
	if (existsSync(join(process.cwd(), ".flowdesk", "locks", "compaction.lock"))) {
		const advisory = createAdvisoryPublicationResultV1({
			dryRunResult: input.dryRunResult,
			ledgerIdempotencyRef: input.ledgerIdempotencyRef,
			guardApprovalRef: input.guardApprovalRef,
			publicationState: "blocked",
			blockedLabels: ["compaction-lock-held"],
			now,
		});
		return {
			ok: false,
			errors: [...errors, ...advisory.errors],
			...(advisory.result === undefined ? {} : { publicationResult: advisory.result }),
			remoteWrite: {
				state: "skipped",
				endpointKind: input.target.kind,
				redactedReason: "compaction-lock-held",
			},
			authority,
		};
	}

	const token = tokenFromGitHubConnectorEnv(input.env ?? process.env);
	if (token === undefined) errors.push("github_token_missing");
	const productionPublish = productionPublishBlockLabelsV1(input);

	const preliminaryBlockLabels = [
		...(input.allowActualRemoteWrite === true ? [] : ["actual-remote-write-not-enabled"]),
		...(input.connectorGateSatisfied === true ? [] : ["connector-gate-not-satisfied"]),
		...contentMarkdownBlockLabels,
		...productionPublish.labels,
		...(errors.length === 0 ? [] : ["github-publication-input-invalid"]),
	];

	if (preliminaryBlockLabels.length > 0) {
		const advisory = createAdvisoryPublicationResultV1({
			dryRunResult: input.dryRunResult,
			ledgerIdempotencyRef: input.ledgerIdempotencyRef,
			guardApprovalRef: input.guardApprovalRef,
			publicationState: "blocked",
			blockedLabels: preliminaryBlockLabels,
			now,
		});
		return {
			ok: false,
			errors: [...errors, ...advisory.errors],
			...(advisory.result === undefined ? {} : { publicationResult: advisory.result }),
			remoteWrite: {
				state: "skipped",
				endpointKind: input.target.kind,
				redactedReason: preliminaryBlockLabels.join(","),
			},
			authority,
		};
	}

	// Phase 8c contract:
	// - Test contexts (productionPublish absent/disabled): fetchImpl override honored (test seam)
	// - Production contexts (productionPublish enabled): override IGNORED; globalThis.fetch forced
	// Prevents malicious caller from injecting a fetch observer capturing Authorization header (T1.1)
	const fetchImpl = resolveGitHubPublicationFetchImplForContextV1({ productionPublishEnabled: productionPublish.productionPublishEnabled, fetchImpl: input.fetchImpl });
	if (fetchImpl === undefined) {
		const advisory = createAdvisoryPublicationResultV1({
			dryRunResult: input.dryRunResult,
			ledgerIdempotencyRef: input.ledgerIdempotencyRef,
			guardApprovalRef: input.guardApprovalRef,
			publicationState: "blocked",
			blockedLabels: ["github-fetch-unavailable"],
			now,
		});
		return {
			ok: false,
			errors: advisory.errors,
			...(advisory.result === undefined ? {} : { publicationResult: advisory.result }),
			remoteWrite: { state: "failed", endpointKind: input.target.kind, redactedReason: "github-fetch-unavailable" },
			authority,
		};
	}

	const request = buildGitHubPublicationRequestV1(input.target, input.contentMarkdown);
	try {
		const response = await fetchImpl(request.url, {
			method: "POST",
			headers: {
				Accept: "application/vnd.github+json",
				Authorization: `Bearer ${token}`,
				"Content-Type": "application/json",
				"User-Agent": "flowdesk-opencode-plugin",
				"X-GitHub-Api-Version": "2022-11-28",
			},
			body: JSON.stringify(request.body),
		});
		const payload = await response.json().catch(async () => {
			const text = await response.text?.();
			return { message: typeof text === "string" ? text.slice(0, 200) : "non-json github response" };
		});
		if (!response.ok) {
			const blockedLabel = response.status === 403 || response.status === 429 ? "github-api-rate-limited" : "github-api-call-failed";
			const advisory = createAdvisoryPublicationResultV1({
				dryRunResult: input.dryRunResult,
				ledgerIdempotencyRef: input.ledgerIdempotencyRef,
				guardApprovalRef: input.guardApprovalRef,
				publicationState: "blocked",
				blockedLabels: [blockedLabel],
				now,
			});
			return {
				ok: false,
				errors: [...advisory.errors, `github_api_status_${response.status}`],
				...(advisory.result === undefined ? {} : { publicationResult: advisory.result }),
				remoteWrite: { state: "failed", endpointKind: input.target.kind, statusCode: response.status, redactedReason: blockedLabel },
				authority,
			};
		}
		const advisory = createAdvisoryPublicationResultV1({
			dryRunResult: input.dryRunResult,
			ledgerIdempotencyRef: input.ledgerIdempotencyRef,
			guardApprovalRef: input.guardApprovalRef,
			publicationState: "pending_gate_promotion",
			blockedLabels: [],
			now,
		});
		return {
			ok: advisory.errors.length === 0,
			errors: advisory.errors,
			...(advisory.result === undefined ? {} : { publicationResult: advisory.result }),
			remoteWrite: {
				state: "posted",
				endpointKind: input.target.kind,
				statusCode: response.status,
				...(extractGitHubHtmlUrlV1(payload) === undefined ? {} : { remoteUrl: extractGitHubHtmlUrlV1(payload) }),
			},
			authority,
		};
	} catch {
		const advisory = createAdvisoryPublicationResultV1({
			dryRunResult: input.dryRunResult,
			ledgerIdempotencyRef: input.ledgerIdempotencyRef,
			guardApprovalRef: input.guardApprovalRef,
			publicationState: "blocked",
			blockedLabels: ["github-api-call-threw"],
			now,
		});
		return {
			ok: false,
			errors: advisory.errors,
			...(advisory.result === undefined ? {} : { publicationResult: advisory.result }),
			remoteWrite: { state: "failed", endpointKind: input.target.kind, redactedReason: "github-api-call-threw" },
			authority,
		};
	}
}
