import {
	type FlowDeskFederatedScoreRegistryPublicationIntentV1,
	type FlowDeskAdvisoryScoreLedgerEntryV1,
	createFlowDeskFederatedScoreRegistryPublicationIntentV1,
	createFlowDeskFederatedRegistryConnectorCapabilityV1,
	createFlowDeskFederatedRegistryPublicationPreflightV1,
	planFlowDeskGitHubDryRunPublicationV1,
	type FlowDeskGitHubDryRunPublicationPlanInputV1,
	type FlowDeskGitHubDryRunPublicationPlanResultV1,
	type FlowDeskFederatedConsentRecordV1,
	type FlowDeskFederatedRegistryPublicationPreflightV1,
	type FlowDeskFederatedCanonicalWorkflowRefV1,
	type FlowDeskGitHubOAuthArchitectureV1,
	type FlowDeskFederatedDataMinimizationPolicyV1,
} from "@flowdesk/core";
import { randomBytes } from "node:crypto";

/**
 * Service to plan and record federated registry publication intents.
 * Advisory-only publisher.
 */
export interface FederatedPublisherPlanInputV1 {
	workflowId: string;
	requestId: string;
	registryRef: string;
	ledgerEntries: FlowDeskAdvisoryScoreLedgerEntryV1[];
	consentRecord: FlowDeskFederatedConsentRecordV1;
	canonicalRef: FlowDeskFederatedCanonicalWorkflowRefV1;
	oauthArchitecture: FlowDeskGitHubOAuthArchitectureV1;
	minimizationPolicy: FlowDeskFederatedDataMinimizationPolicyV1;
	connectorGateRef?: string;
	optIn: boolean;
}

export interface FederatedPublisherPlanResultV1 {
	ok: boolean;
	intent: FlowDeskFederatedScoreRegistryPublicationIntentV1;
	dryRunPlan: FlowDeskGitHubDryRunPublicationPlanResultV1;
}

/**
 * Plan a federated registry publication by composing all required evidence.
 * Returns a result that can be persisted as evidence.
 */
export function planFederatedPublicationV1(input: FederatedPublisherPlanInputV1): { ok: false; errors: string[] } | FederatedPublisherPlanResultV1 {
	const requestedAt = new Date().toISOString();
	const publicationIntentId = `pub-intent-${randomBytes(8).toString("hex")}`;
	
	// 1. Build the intent (initially blocked by default per core contract)
	const intentResult = createFlowDeskFederatedScoreRegistryPublicationIntentV1({
		publicationIntentId,
		requestId: input.requestId,
		workflowId: input.workflowId,
		registryRef: input.registryRef,
		ledgerEntries: input.ledgerEntries,
		requestedAt,
		federatedRegistryPublicationOptIn: input.optIn,
		...(input.connectorGateRef === undefined ? {} : { connectorGateRef: input.connectorGateRef }),
	});

	if (!intentResult.ok || !intentResult.intent) {
		return { ok: false, errors: intentResult.errors };
	}

	// 2. Wrap the core dry-run planner (P8-S8)
	// In a real implementation, we would also build preflight evidence first.
	// For this foundation, we focus on the wiring.
	
	const capabilityDescriptorId = `cap-gh-${randomBytes(4).toString("hex")}`;
	const capabilityResult = createFlowDeskFederatedRegistryConnectorCapabilityV1({
		capabilityDescriptorId,
		capabilityRef: "github-federated-connector-v1",
		connectorKind: "github_pr_comment",
		connectorProfileRef: "profile-github-default",
		registryRef: input.registryRef,
		authScopeRef: "scope-github-repo-or-public-repo",
		targetKind: "github_pr_comment",
		toolRef: "tool-github-rest-api",
		capabilityState: "available",
		contentFormatRef: "format-markdown-federated-score-v1",
		dryRunSupported: true,
		discoveredAt: requestedAt,
	});
	if (!capabilityResult.ok || !capabilityResult.capability) return { ok: false, errors: capabilityResult.errors };

	const preflightResult = createFlowDeskFederatedRegistryPublicationPreflightV1({
		preflightId: `pre-${randomBytes(4).toString("hex")}`,
		publicationIntentRef: publicationIntentId,
		capabilityDescriptorRef: capabilityDescriptorId,
		workflowId: input.workflowId,
		attemptId: "attempt-1",
		registryRef: input.registryRef,
		connectorKind: "github_pr_comment",
		targetRef: "repo-default",
		contentHashRef: "hash-default",
		redactionPolicyRef: "policy-default",
		authScopeRef: "scope-default",
		contentFormatRef: "format-default",
		idempotencyKeyRef: "key-default",
		preWriteAuditRef: "audit-default",
		preflightState: "preflight_passed",
		blockedLabels: [],
		createdAt: requestedAt,
	});
	if (!preflightResult.ok || !preflightResult.preflight) return { ok: false, errors: preflightResult.errors };

	const planInput: FlowDeskGitHubDryRunPublicationPlanInputV1 = {
		intent: intentResult.intent,
		capability: capabilityResult.capability,
		preflight: preflightResult.preflight,
		consent: input.consentRecord,
		minimizationPolicy: input.minimizationPolicy,
		canonicalRef: input.canonicalRef,
		connectorKind: "github_pr_comment",
		redactedTargetLabel: "github_pr_comment in org/repo",
		redactedContentPreview: "Preview of federated score publication",
		contentHashRef: "hash-default",
	};


	const planResult = planFlowDeskGitHubDryRunPublicationV1(planInput);

	return {
		ok: true,
		intent: intentResult.intent,
		dryRunPlan: planResult,
	};
}
