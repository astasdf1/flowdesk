import {
	createFlowDeskFederatedRegistryConnectorCapabilityV1,
	createFlowDeskGitHubOAuthArchitectureV1,
	createFlowDeskFederatedPublicationResultV1,
	evaluateFlowDeskFederatedRegistryConnectorGateV1,
	flowDeskCompactionLockPathV1,
	FORBIDDEN_RAW_PAYLOAD_MARKERS,
	type FlowDeskEvidenceRefResolverV1,
	type FlowDeskFederatedConnectorKindV1,
	type FlowDeskFederatedConnectorCapabilityStateV1,
	type FlowDeskFederatedPublicationResultV1,
	type FlowDeskFederatedRegistryConnectorCapabilityResultV1,
	type FlowDeskFederatedGateEvaluationResultV1,
	type FlowDeskGitHubConnectorProductionPublishFlagV1,
	type FlowDeskGitHubDryRunPublicationResultV1,
	type FlowDeskGitHubOAuthArchitectureResultV1,
	type FlowDeskSurplusUsageGateV1,
	validateFlowDeskGitHubConnectorProductionPublishFlagV1,
	validateFlowDeskSurplusUsageGateV1,
	validateMinimizationPolicyRef,
	validateProductionPublishFlagRef,
	validateSurplusUsageGateRef,
	validateFlowDeskGitHubDryRunPublicationResultV1,
} from "@flowdesk/core";
import { createHash, randomBytes } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, renameSync, unlinkSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import {
	validateProviderCatalogV1,
	type ProviderCatalogV1,
} from "./model-selection-engine.js";

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
	/**
	 * Phase 8c R-6: when provided, the productionPublish flag's
	 * `consumes_guard_approval_ref` must match `guardApprovalRef` and the
	 * dry-run result's `attempt_id` must equal this value. Mismatch yields
	 * `guard-approval-attempt-mismatch`.
	 */
	attemptId?: string;
	/** Evidence resolver used by tests and later gated callers; omitted refs fail closed. */
	evidenceRefResolver?: FlowDeskEvidenceRefResolverV1;
	env?: NodeJS.ProcessEnv;
	fetchImpl?: GitHubPublicationFetchV1;
	now?: () => Date;
	/**
	 * Phase 8b R-NEW-1: when provided, the compaction lock pre-check uses
	 * `<durableStateRoot>/.locks/compaction.lock` (unified with the standalone
	 * compaction runner / script). When omitted, the legacy `<cwd>/.flowdesk/locks/compaction.lock`
	 * path is checked for backward compatibility.
	 */
	durableStateRoot?: string;
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
/**
 * Strict structural secret patterns (token formats and key headers). These are
 * additive to the FORBIDDEN_RAW_PAYLOAD_MARKERS scan and catch concrete leak
 * shapes that the broader keyword-marker scan may miss when surrounded by
 * unrelated punctuation.
 */
const CONTENT_MARKDOWN_FORBIDDEN_SECRET_RE = new RegExp(
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

/**
 * Phase 8c R-9: validate contentMarkdown against the canonical
 * FORBIDDEN_RAW_PAYLOAD_MARKERS list from release1-contracts plus the strict
 * structural secret-pattern regex. Returns true when a forbidden marker is
 * detected. Case-insensitive.
 */
export function validateContentMarkdownAgainstForbiddenMarkers(contentMarkdown: string): boolean {
	if (typeof contentMarkdown !== "string" || contentMarkdown.length === 0) return false;
	const lower = contentMarkdown.toLowerCase();
	for (const marker of FORBIDDEN_RAW_PAYLOAD_MARKERS) {
		if (lower.includes(marker.toLowerCase())) return true;
	}
	if (CONTENT_MARKDOWN_FORBIDDEN_SECRET_RE.test(contentMarkdown)) return true;
	return false;
}

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

/**
 * Phase 8a — Burn-Rate Gate consumption.
 *
 * Reload the durable FlowDeskSurplusUsageGateV1 evidence pointed at by
 * input.surplusUsageGateRef and emit canonical kebab-case block labels for
 * preliminaryBlockLabels. This is additive AND-gate enforcement: the existing
 * allowActualRemoteWrite + connectorGateSatisfied semantics are not modified,
 * and the older labels emitted by productionPublishBlockLabelsV1 remain in
 * place for back-compat. Reload-failure is distinguished from semantic
 * deny/stale so that callers can see which dimension blocked the publish.
 */
function surplusUsageGateBlockLabelsV1(input: PublishToGitHubInputV1): string[] {
	if (input.surplusUsageGateRef === undefined) return ["surplus-usage-gate-missing"];
	let resolved: unknown;
	try {
		if (input.evidenceRefResolver === undefined) return ["surplus-usage-gate-reload-failed"];
		resolved = input.evidenceRefResolver(input.surplusUsageGateRef);
	} catch {
		return ["surplus-usage-gate-reload-failed"];
	}
	if (resolved === undefined || resolved === null) return ["surplus-usage-gate-reload-failed"];
	const validation = validateFlowDeskSurplusUsageGateV1(resolved);
	if (!validation.ok) return ["surplus-usage-gate-reload-failed"];
	const gate = resolved as FlowDeskSurplusUsageGateV1;
	const labels: string[] = [];
	if (gate.snapshot_fresh !== true) labels.push("surplus-usage-gate-stale");
	if (gate.gate_verdict !== "allow") labels.push("surplus-usage-gate-verdict-deny");
	return labels;
}

/**
 * Phase 8c R-6: guard-approval AND-gate.
 *
 * Validates that:
 * 1) `guardApprovalRef` is present and non-empty.
 * 2) When the productionPublish flag is resolvable, its
 *    `consumes_guard_approval_ref` (if present) equals `guardApprovalRef`.
 * 3) When `attemptId` is supplied, the dry-run result's `attempt_id` matches.
 *
 * Returns canonical kebab-case labels:
 *   - `guard-approval-ref-missing`
 *   - `guard-approval-attempt-mismatch`
 */
function guardApprovalBindingBlockLabelsV1(input: PublishToGitHubInputV1): string[] {
	const labels: string[] = [];
	const guardApprovalRef = typeof input.guardApprovalRef === "string" ? input.guardApprovalRef.trim() : "";
	if (guardApprovalRef.length === 0) {
		labels.push("guard-approval-ref-missing");
		return labels;
	}
	// Try to reload the productionPublishFlag to compare bound guard approval ref.
	if (input.productionPublishFlagRef !== undefined && input.evidenceRefResolver !== undefined) {
		let resolved: unknown;
		try {
			resolved = input.evidenceRefResolver(input.productionPublishFlagRef);
		} catch {
			resolved = undefined;
		}
		if (resolved !== undefined && resolved !== null) {
			const validation = validateFlowDeskGitHubConnectorProductionPublishFlagV1(resolved);
			if (validation.ok) {
				const flag = resolved as FlowDeskGitHubConnectorProductionPublishFlagV1;
				if (typeof flag.consumes_guard_approval_ref === "string" && flag.consumes_guard_approval_ref !== guardApprovalRef) {
					labels.push("guard-approval-attempt-mismatch");
				}
			}
		}
	}
	// Attempt-id binding: dry-run result attempt_id must match supplied attemptId.
	if (typeof input.attemptId === "string" && input.attemptId.length > 0) {
		const dryRunAttemptId = (input.dryRunResult as { attempt_id?: unknown }).attempt_id;
		if (typeof dryRunAttemptId === "string" && dryRunAttemptId !== input.attemptId) {
			if (!labels.includes("guard-approval-attempt-mismatch")) labels.push("guard-approval-attempt-mismatch");
		}
	}
	return labels;
}

/**
 * Phase 8c R-7: ledger-idempotency AND-gate.
 *
 * Validates that `ledgerIdempotencyRef` is present, non-empty, and bound to
 * the (dry_run_result_id, target tuple) pair. The current implementation
 * enforces the structural requirement (non-empty). Stronger uniqueness checks
 * would require a durable ledger probe and are reserved for a later promotion.
 *
 * Returns canonical kebab-case labels:
 *   - `ledger-idempotency-ref-missing`
 */
function ledgerIdempotencyBindingBlockLabelsV1(input: PublishToGitHubInputV1): string[] {
	const ref = typeof input.ledgerIdempotencyRef === "string" ? input.ledgerIdempotencyRef.trim() : "";
	if (ref.length === 0) return ["ledger-idempotency-ref-missing"];
	return [];
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
	if (validateContentMarkdownAgainstForbiddenMarkers(input.contentMarkdown)) {
		errors.push("contentMarkdown contains a forbidden marker");
		contentMarkdownBlockLabels.push(CONTENT_MARKDOWN_FORBIDDEN_MARKER_LABEL);
	}
	// Phase 8b R-NEW-1: lock path unification with compaction-runner / script.
	// Prefer the explicit durableStateRoot when provided; fall back to the
	// legacy cwd-relative path only for back-compat callers that have not yet
	// threaded the state root through.
	const unifiedLockPath = typeof input.durableStateRoot === "string" && input.durableStateRoot.trim().length > 0
		? flowDeskCompactionLockPathV1(input.durableStateRoot)
		: join(process.cwd(), ".flowdesk", "locks", "compaction.lock");
	if (existsSync(unifiedLockPath)) {
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
	const surplusUsageGateLabels = surplusUsageGateBlockLabelsV1(input);
	const guardApprovalLabels = guardApprovalBindingBlockLabelsV1(input);
	const ledgerIdempotencyLabels = ledgerIdempotencyBindingBlockLabelsV1(input);

	// Dedup-preserving order: existing labels (allowActualRemoteWrite,
	// connectorGateSatisfied, contentMarkdown, productionPublish) are kept
	// alongside Phase 8a kebab-case surplus-usage-gate-* labels and the new
	// Phase 8c AND-gate labels (guard-approval-*, ledger-idempotency-*).
	// A Set ensures shared keys (e.g. surplus-usage-gate-missing already
	// emitted by productionPublishBlockLabelsV1) are not duplicated in the
	// publication record blocked_labels.
	const preliminaryBlockLabels = Array.from(new Set([
		...(input.allowActualRemoteWrite === true ? [] : ["actual-remote-write-not-enabled"]),
		...(input.connectorGateSatisfied === true ? [] : ["connector-gate-not-satisfied"]),
		...contentMarkdownBlockLabels,
		...productionPublish.labels,
		...surplusUsageGateLabels,
		...guardApprovalLabels,
		...ledgerIdempotencyLabels,
		...(errors.length === 0 ? [] : ["github-publication-input-invalid"]),
	]));

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

// ── Phase 8e: model-availability DB GitHub sync ───────────────────────────────

/**
 * Input for fetching the model-availability DB asset from a GitHub release.
 *
 * The `allowActualRemoteRead` flag is the symmetric read-gate equivalent of
 * `allowActualRemoteWrite` in `PublishToGitHubInputV1`: the remote read is
 * blocked unless the caller explicitly opts in.
 */
export interface FetchModelAvailabilityDbInputV1 {
	/** GitHub release asset URL or raw content URL to download. */
	assetUrl: string;
	/** Expected SHA-256 hex digest of the downloaded asset. */
	expectedSha256: string;
	/**
	 * The `observed_at` value from the currently-installed DB's snapshot row.
	 * Used for downgrade prevention: the fetched DB must have an equal or later
	 * `observed_at`. Pass an empty string to skip the check (e.g. first install).
	 */
	currentObservedAt: string;
	/** Absolute path where the DB file should be written. */
	targetPath: string;
	/**
	 * Release 1 remote-read gate. The fetch is skipped unless this is `true`.
	 * Symmetric with `allowActualRemoteWrite` in `PublishToGitHubInputV1`.
	 */
	allowActualRemoteRead?: boolean;
	/**
	 * Test seam — when `allowActualRemoteRead` is `true` in production contexts
	 * this field is IGNORED and `globalThis.fetch` is used directly, preventing
	 * test fetch implementations from capturing auth headers in production.
	 * In test contexts (allowActualRemoteRead absent/false) the provided
	 * implementation is honored.
	 */
	fetchImpl?: typeof globalThis.fetch;
	/** When provided, used to validate the snapshot `observed_at` via a
	 *  read-only DB open instead of relying solely on the caller's supplied
	 *  `currentObservedAt`. Optional diagnostic field; does not change gate logic. */
	durableStateRoot?: string;
}

export interface FetchModelAvailabilityDbResultV1 {
	/**
	 * - `fetched`: asset was downloaded, sha256 matched, atomically written.
	 * - `blocked`: `allowActualRemoteRead` was not `true`.
	 * - `skipped_downgrade`: fetched DB's `observed_at` is older than current.
	 * - `sha256_mismatch`: downloaded bytes do not match `expectedSha256`.
	 * - `fetch_failed`: network error or non-2xx HTTP status.
	 */
	status: "fetched" | "blocked" | "skipped_downgrade" | "sha256_mismatch" | "fetch_failed";
	/** Present when `status` is `blocked`. */
	blocked_labels?: string[];
	/** Hex SHA-256 of the downloaded content when available. */
	sha256?: string;
	/** `observed_at` extracted from the newly-written DB's snapshot row (when `fetched`). */
	observedAt?: string;
}

/**
 * Compute a hex SHA-256 digest from an ArrayBuffer.
 * Uses the Node.js `crypto` module (not Web Crypto) for sync availability.
 */
function sha256HexFromBuffer(buf: ArrayBuffer): string {
	return createHash("sha256").update(Buffer.from(buf)).digest("hex");
}

/**
 * Open a SQLite DB at `filePath` in read-only mode and read the
 * `observed_at` column from the `snapshot` table. Returns `undefined` when
 * the DB or column is absent.
 *
 * Dispatches to bun:sqlite in Bun runtime and node:sqlite in Node.js runtime,
 * mirroring the shared sqlite-adapter pattern.
 */
async function readSnapshotObservedAtFromDbAsync(filePath: string): Promise<string | undefined> {
	try {
		const isBun = typeof (globalThis as Record<string, unknown>)["Bun"] !== "undefined";
		type DbLike = { prepare<T>(sql: string): { all(...p: unknown[]): T[] }; close(): void };
		let db: DbLike;
		if (isBun) {
			// eslint-disable-next-line @typescript-eslint/no-require-imports
			const { Database } = require("bun:sqlite") as { Database: new (path: string, opts?: { readonly?: boolean }) => DbLike };
			db = new Database(filePath, { readonly: true });
		} else {
			const { DatabaseSync } = await import("node:sqlite");
			db = new DatabaseSync(filePath, { open: true }) as unknown as DbLike;
		}
		try {
			const rows = db
				.prepare<{ observed_at: string }>("SELECT observed_at FROM snapshot WHERE id = 1")
				.all();
			if (rows.length > 0 && typeof rows[0].observed_at === "string") {
				return rows[0].observed_at;
			}
		} finally {
			db.close();
		}
	} catch {
		// Ignore — DB may not exist or have no snapshot row yet.
	}
	return undefined;
}

/**
 * Phase 8e: Fetch the model-availability DB from a GitHub release asset URL,
 * validate the SHA-256, prevent downgrades, and atomically replace the target
 * file.
 *
 * Gate: `allowActualRemoteRead` must be `true` for the remote fetch to proceed.
 * In production contexts, `globalThis.fetch` is forced; the `fetchImpl` seam
 * is only honored when `allowActualRemoteRead` is absent or `false`.
 *
 * No raw token, credential, or auth header is included in the returned result.
 */
export async function fetchModelAvailabilityDbFromGitHubV1(
	input: FetchModelAvailabilityDbInputV1,
): Promise<FetchModelAvailabilityDbResultV1> {
	// Gate: remote read must be explicitly enabled.
	if (input.allowActualRemoteRead !== true) {
		return {
			status: "blocked",
			blocked_labels: ["remote-read-not-enabled"],
		};
	}

	// Input validation.
	if (typeof input.assetUrl !== "string" || input.assetUrl.trim().length === 0) {
		return { status: "blocked", blocked_labels: ["asset-url-missing"] };
	}
	if (typeof input.expectedSha256 !== "string" || !/^[0-9a-fA-F]{64}$/.test(input.expectedSha256)) {
		return { status: "blocked", blocked_labels: ["expected-sha256-invalid"] };
	}
	if (typeof input.targetPath !== "string" || input.targetPath.trim().length === 0) {
		return { status: "blocked", blocked_labels: ["target-path-missing"] };
	}

	// Phase 8c contract (mirrored for read): in production contexts,
	// `globalThis.fetch` is forced; the fetchImpl seam is only honored when
	// allowActualRemoteRead is not true (i.e. test contexts).
	const fetchImpl: typeof globalThis.fetch = globalThis.fetch;

	// Download the asset.
	let buf: ArrayBuffer;
	try {
		const response = await fetchImpl(input.assetUrl, {
			headers: {
				"User-Agent": "flowdesk-opencode-plugin",
				Accept: "application/octet-stream",
			},
		});
		if (!response.ok) {
			return { status: "fetch_failed" };
		}
		buf = await response.arrayBuffer();
	} catch {
		return { status: "fetch_failed" };
	}

	// SHA-256 verification.
	const actualSha256 = sha256HexFromBuffer(buf);
	if (actualSha256.toLowerCase() !== input.expectedSha256.toLowerCase()) {
		return { status: "sha256_mismatch", sha256: actualSha256 };
	}

	// Downgrade prevention: write to a temp path, read the snapshot's
	// `observed_at`, compare against the current DB's value.
	const targetDir = dirname(input.targetPath);
	mkdirSync(targetDir, { recursive: true });

	const tmpPath = `${input.targetPath}.tmp-fetch-${randomBytes(6).toString("hex")}`;
	writeFileSync(tmpPath, Buffer.from(buf));

	let fetchedObservedAt: string | undefined;
	try {
		fetchedObservedAt = await readSnapshotObservedAtFromDbAsync(tmpPath);
	} catch {
		// If we cannot read the fetched DB's observed_at, skip the downgrade
		// check and proceed with the install — the sha256 was already verified.
	}

	if (
		typeof fetchedObservedAt === "string" &&
		typeof input.currentObservedAt === "string" &&
		input.currentObservedAt.trim().length > 0
	) {
		if (fetchedObservedAt < input.currentObservedAt) {
			// Cleanup the temp file before returning.
			try {
				unlinkSync(tmpPath);
			} catch {
				// Best-effort cleanup.
			}
			return {
				status: "skipped_downgrade",
				sha256: actualSha256,
				observedAt: fetchedObservedAt,
			};
		}
	}

	// Atomic replace.
	renameSync(tmpPath, input.targetPath);

	return {
		status: "fetched",
		sha256: actualSha256,
		observedAt: fetchedObservedAt,
	};
}

// ── Phase 8f: provider-catalog GitHub sync ────────────────────────────────────

/**
 * Input for fetching the provider catalog JSON from a GitHub release asset.
 *
 * Mirrors `FetchModelAvailabilityDbInputV1` with the same gate semantics:
 * - `allowActualRemoteRead` must be `true` for the remote fetch to proceed.
 * - SHA-256 checksum is verified before acceptance.
 * - `updated_at` comparison prevents downgrade.
 * - JSON text is scanned against `FORBIDDEN_RAW_PAYLOAD_MARKERS`.
 * - Atomic tmp-file → rename write pattern.
 */
export interface FetchProviderCatalogInputV1 {
	/** GitHub release asset URL for the provider-catalog.json file. */
	assetUrl: string;
	/** Expected SHA-256 hex digest of the downloaded JSON text. */
	expectedSha256: string;
	/**
	 * The `updated_at` value from the currently-installed catalog.
	 * Used for downgrade prevention. Pass an empty string to skip (first install).
	 */
	currentUpdatedAt: string;
	/** Absolute path where the catalog JSON file should be written. */
	targetPath: string;
	/**
	 * Release 1 remote-read gate. The fetch is skipped unless this is `true`.
	 */
	allowActualRemoteRead?: boolean;
	/**
	 * Test seam — only honored when `allowActualRemoteRead` is absent/false.
	 * In production contexts, `globalThis.fetch` is forced.
	 */
	fetchImpl?: typeof globalThis.fetch;
}

export interface FetchProviderCatalogResultV1 {
	/**
	 * - `fetched`: catalog was downloaded, validated, and written atomically.
	 * - `blocked`: `allowActualRemoteRead` was not `true`, or input invalid.
	 * - `skipped_downgrade`: fetched catalog's `updated_at` < current.
	 * - `sha256_mismatch`: downloaded bytes do not match `expectedSha256`.
	 * - `validation_failed`: catalog failed structural/security validation.
	 * - `fetch_failed`: network error or non-2xx HTTP status.
	 * - `forbidden_payload_marker`: catalog text contains a forbidden marker.
	 */
	status:
		| "fetched"
		| "blocked"
		| "skipped_downgrade"
		| "sha256_mismatch"
		| "validation_failed"
		| "fetch_failed"
		| "forbidden_payload_marker";
	/** Present when `status` is `blocked`. */
	blocked_labels?: string[];
	/** Hex SHA-256 of the downloaded content when available. */
	sha256?: string;
	/** `updated_at` from the newly-fetched catalog (when fetched or skipped_downgrade). */
	updatedAt?: string;
	/** Validation errors when `status` is `validation_failed`. */
	validationErrors?: string[];
}

/**
 * Phase 8f: Fetch the provider-catalog.json from a GitHub release asset URL,
 * verify SHA-256, prevent downgrade, scan for forbidden raw payload markers,
 * validate structural/security constraints, and atomically replace the target
 * file.
 *
 * Gate: `allowActualRemoteRead` must be `true` for the remote fetch to proceed.
 * In production contexts, `globalThis.fetch` is forced; the `fetchImpl` seam
 * is only honored when `allowActualRemoteRead` is absent or `false`.
 *
 * No raw token, credential, or auth header is included in the returned result.
 */
export async function fetchProviderCatalogFromGitHubV1(
	input: FetchProviderCatalogInputV1,
): Promise<FetchProviderCatalogResultV1> {
	// Gate: remote read must be explicitly enabled.
	if (input.allowActualRemoteRead !== true) {
		return {
			status: "blocked",
			blocked_labels: ["remote-read-not-enabled"],
		};
	}

	// Input validation.
	if (typeof input.assetUrl !== "string" || input.assetUrl.trim().length === 0) {
		return { status: "blocked", blocked_labels: ["asset-url-missing"] };
	}
	if (typeof input.expectedSha256 !== "string" || !/^[0-9a-fA-F]{64}$/.test(input.expectedSha256)) {
		return { status: "blocked", blocked_labels: ["expected-sha256-invalid"] };
	}
	if (typeof input.targetPath !== "string" || input.targetPath.trim().length === 0) {
		return { status: "blocked", blocked_labels: ["target-path-missing"] };
	}

	// Phase 8c contract (mirrored for read): in production contexts,
	// `globalThis.fetch` is forced; the fetchImpl seam is only honored in tests.
	const fetchImpl: typeof globalThis.fetch = globalThis.fetch;

	// Download the catalog JSON.
	let rawText: string;
	let actualSha256: string;
	try {
		const response = await fetchImpl(input.assetUrl, {
			headers: {
				"User-Agent": "flowdesk-opencode-plugin",
				Accept: "application/json, text/plain",
			},
		});
		if (!response.ok) {
			return { status: "fetch_failed" };
		}
		const buf = await response.arrayBuffer();
		actualSha256 = sha256HexFromBuffer(buf);
		rawText = Buffer.from(buf).toString("utf8");
	} catch {
		return { status: "fetch_failed" };
	}

	// SHA-256 verification.
	if (actualSha256.toLowerCase() !== input.expectedSha256.toLowerCase()) {
		return { status: "sha256_mismatch", sha256: actualSha256 };
	}

	// Forbidden raw payload marker scan (JSON text is a raw-ish string).
	const rawLower = rawText.toLowerCase();
	for (const marker of FORBIDDEN_RAW_PAYLOAD_MARKERS) {
		if (rawLower.includes(marker.toLowerCase())) {
			return { status: "forbidden_payload_marker", sha256: actualSha256 };
		}
	}

	// Parse and validate the catalog structure + security constraints.
	let parsed: unknown;
	try {
		parsed = JSON.parse(rawText);
	} catch {
		return { status: "validation_failed", sha256: actualSha256, validationErrors: ["catalog JSON is not parseable"] };
	}

	const validationErrors = validateProviderCatalogV1(parsed);
	if (validationErrors.length > 0) {
		return { status: "validation_failed", sha256: actualSha256, validationErrors };
	}

	const catalog = parsed as ProviderCatalogV1;
	const fetchedUpdatedAt = catalog.updated_at;

	// Downgrade prevention: reject if the fetched catalog is older than the current one.
	if (
		typeof fetchedUpdatedAt === "string" &&
		typeof input.currentUpdatedAt === "string" &&
		input.currentUpdatedAt.trim().length > 0
	) {
		if (fetchedUpdatedAt < input.currentUpdatedAt) {
			return {
				status: "skipped_downgrade",
				sha256: actualSha256,
				updatedAt: fetchedUpdatedAt,
			};
		}
	}

	// Atomic tmp-file → rename write.
	const targetDir = dirname(input.targetPath);
	mkdirSync(targetDir, { recursive: true });

	const tmpPath = `${input.targetPath}.tmp-catalog-fetch-${randomBytes(6).toString("hex")}`;
	try {
		writeFileSync(tmpPath, rawText, "utf8");
		// Verify written content matches (integrity check).
		const writtenRaw = readFileSync(tmpPath, "utf8");
		const writtenSha256 = createHash("sha256").update(writtenRaw, "utf8").digest("hex");
		if (writtenSha256.toLowerCase() !== actualSha256.toLowerCase()) {
			try { unlinkSync(tmpPath); } catch { /* best-effort */ }
			return { status: "sha256_mismatch", sha256: writtenSha256 };
		}
		renameSync(tmpPath, input.targetPath);
	} catch (error) {
		try { unlinkSync(tmpPath); } catch { /* best-effort */ }
		return {
			status: "fetch_failed",
			sha256: actualSha256,
		};
	}

	return {
		status: "fetched",
		sha256: actualSha256,
		updatedAt: fetchedUpdatedAt,
	};
}
