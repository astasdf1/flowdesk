import assert from "node:assert/strict";
import test from "node:test";
import {
	createFlowDeskAdvisoryScoreLedgerAppendIntentV1,
	createFlowDeskAdvisoryScoreLedgerEntryV1,
	createFlowDeskEvaluationEventV1,
	createFlowDeskFederatedScoreRegistryPublicationIntentV1,
	createFlowDeskOptimizerProposalScoreV1,
	createFlowDeskOperationalIntelligenceScoreV1,
	createFlowDeskWorkflowPlanProposalScoreEventV1,
	createFlowDeskWorkflowPlanProposalV1,
	createFlowDeskWorkflowPlanProposalSetV1,
	decodeFlowDeskAdvisoryScoreLedgerEntryJsonlLine,
	encodeFlowDeskAdvisoryScoreLedgerEntryJsonlLine,
	validateFlowDeskAdvisoryScoreLedgerEntryV1,
	validateFlowDeskEvaluationEventV1,
	validateFlowDeskFederatedScoreRegistryPublicationIntentV1,
	validateFlowDeskFederatedScoreRegistryPublicationRequestV1,
	validateFlowDeskOptimizerProposalScoreV1,
	validateFlowDeskOperationalIntelligenceScoreV1,
	validateFlowDeskReferencePackV1,
	validateFlowDeskCategoryFitSnapshotV1,
	createFlowDeskCategoryFitSnapshotV1,
	validateFlowDeskWorkflowPlanProposalScoreEventV1,
	validateFlowDeskWorkflowPlanProposalV1,
	validateFlowDeskWorkflowPlanProposalSetV1,
	type FlowDeskReferencePackV1,
	type FlowDeskWorkflowPlanProposalV1,
	type FlowDeskWorkflowPlanProposalSetV1,
	type FlowDeskFederatedScoreRegistryPublicationRequestV1,
	createFlowDeskNormalizedScoreAggregationV1,
	validateFlowDeskNormalizedScoreAggregationV1,
	type FlowDeskNormalizedScoreAggregationV1,
	createFlowDeskScoreReuseThresholdGateV1,
	validateFlowDeskScoreReuseThresholdGateV1,
	type FlowDeskScoreReuseThresholdGateV1,
	createFlowDeskFanoutCadenceGateV1,
	validateFlowDeskFanoutCadenceGateV1,
	type FlowDeskFanoutCadenceGateV1,
	createFlowDeskLocalLedgerSnapshotV1,
	validateFlowDeskLocalLedgerSnapshotV1,
	type FlowDeskLocalLedgerSnapshotV1,
	createFlowDeskScoreReferencePackV1,
	validateFlowDeskScoreReferencePackV1,
	type FlowDeskScoreReferencePackV1,
	createFlowDeskWorkflowSignatureIndexEntryV1,
	validateFlowDeskWorkflowSignatureIndexEntryV1,
	type FlowDeskWorkflowSignatureIndexEntryV1,
	createFlowDeskOISessionSummaryV1,
	validateFlowDeskOISessionSummaryV1,
	type FlowDeskOISessionSummaryV1,
	createFlowDeskSpecialistWorkflowEligibilityV1,
	validateFlowDeskSpecialistWorkflowEligibilityV1,
	type FlowDeskSpecialistWorkflowEligibilityV1,
	createFlowDeskMCPConnectorAdvisoryV1,
	validateFlowDeskMCPConnectorAdvisoryV1,
	type FlowDeskMCPConnectorAdvisoryV1,
	validateFlowDeskOIAdvisoryEnvelopeV1,
	type FlowDeskOIAdvisoryEnvelopeV1,
	type FlowDeskOIAdvisoryHealthLabelV1,
	scoreWorkflowProposal,
	type FlowDeskScoringEngineInputV1,
	type FlowDeskScoringEngineResultV1,
	evaluateFlowDeskFederatedRegistryConnectorGateV1,
	validateFlowDeskFederatedGateEvaluationResultV1,
	type FlowDeskFederatedGateEvaluationResultV1,
	createFlowDeskFederatedRegistryConnectorCapabilityV1,
	validateFlowDeskFederatedRegistryConnectorCapabilityV1,
	type FlowDeskFederatedRegistryConnectorCapabilityV1,
	type FlowDeskFederatedConnectorKindV1,
	type FlowDeskFederatedConnectorCapabilityStateV1,
	createFlowDeskFederatedRegistryPublicationPreflightV1,
	validateFlowDeskFederatedRegistryPublicationPreflightV1,
	type FlowDeskFederatedRegistryPublicationPreflightV1,
	type FlowDeskFederatedPreflightStateV1,
	createFlowDeskGitHubDryRunPublicationResultV1,
	validateFlowDeskGitHubDryRunPublicationResultV1,
	type FlowDeskGitHubDryRunPublicationResultV1,
	type FlowDeskGitHubDryRunStateV1,
	createFlowDeskFederatedConsentRecordV1,
	validateFlowDeskFederatedConsentRecordV1,
	type FlowDeskFederatedConsentRecordV1,
	type FlowDeskFederatedConsentScopeV1,
	createFlowDeskGitHubOAuthArchitectureV1,
	validateFlowDeskGitHubOAuthArchitectureV1,
	type FlowDeskGitHubOAuthArchitectureV1,
	type FlowDeskGitHubOAuthAuthStateV1,
	// P8-S7: data minimization + canonicalization
	createFlowDeskFederatedDataMinimizationPolicyV1,
	validateFlowDeskFederatedDataMinimizationPolicyV1,
	type FlowDeskFederatedDataMinimizationPolicyV1,
	createFlowDeskFederatedCanonicalWorkflowRefV1,
	validateFlowDeskFederatedCanonicalWorkflowRefV1,
	type FlowDeskFederatedCanonicalWorkflowRefV1,
	// P8-S8: GitHub dry-run publication planner
	planFlowDeskGitHubDryRunPublicationV1,
	type FlowDeskGitHubDryRunPublicationPlanInputV1,
	type FlowDeskGitHubDryRunPublicationPlanResultV1,
} from "./index.js";

const sha256Ref = "sha256-0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef";

function scoreEvent(overrides: Partial<ReturnType<typeof createFlowDeskWorkflowPlanProposalScoreEventV1>> = {}) {
	return {
		...createFlowDeskWorkflowPlanProposalScoreEventV1({
			scoreEventId: "score-event-ledger-1",
			workflowId: "workflow-1",
			proposalId: "proposal-1",
			candidateRef: "candidate-1",
			hardFiltersPassed: true,
			advisoryScore: 81,
			scoreReasonRef: "reason-1",
		}),
		...overrides,
	};
}

function ledgerEntry(overrides: Partial<ReturnType<typeof createFlowDeskAdvisoryScoreLedgerEntryV1>> = {}) {
	return {
		...createFlowDeskAdvisoryScoreLedgerEntryV1({
			ledgerEntryId: "ledger-entry-1",
			workflowId: "workflow-1",
			sequence: 0,
			recordedAt: "2026-06-06T00:00:00.000Z",
			event: scoreEvent(),
		}),
		...overrides,
	};
}

function evaluationEvent(overrides: Partial<ReturnType<typeof createFlowDeskEvaluationEventV1>> = {}) {
	return {
		...createFlowDeskEvaluationEventV1({
			evaluationEventId: "evaluation-event-1",
			workflowId: "workflow-1",
			taskRef: "task-1",
			proposalRef: "proposal-1",
			candidateRef: "candidate-1",
			dedupeRef: "dedupe-evaluation-1",
			taxonomyHashRef: sha256Ref,
			policyHashRef: "hash-policy-1",
			redactionHashRef: "hash-redaction-1",
			scorerRef: "scorer-local-evaluator-1",
			sourceRef: "source-local-evaluation-1",
			observedAt: "2026-06-06T00:00:09.000Z",
			scoreDimensions: [
				{ dimension: "correctness", score: 82, weight: 0.6, outcome_label: "accepted", reason_ref: "reason-correctness-1" },
				{ dimension: "safety", score: 100, weight: 0.4, outcome_label: "accepted", reason_ref: "reason-safety-1" },
			],
			overallOutcomeLabel: "accepted",
			evidenceRefs: ["evidence-1"],
			safeNextActions: ["flowdesk-status"],
		}),
		...overrides,
	};
}

test("optimizer proposal score handles valid dimensions and hard filters", () => {
	const score = createFlowDeskOptimizerProposalScoreV1({
		scoreId: "opt-1",
		workflowId: "workflow-1",
		proposalId: "proposal-1",
		candidateRef: "candidate-1",
		hardFiltersPassed: true,
		scoreDimensions: [
			{ dimension: "goal_fit", score: 90, weight: 0.5, reason_ref: "reason-1" },
			{ dimension: "safety", score: 100, weight: 0.5, reason_ref: "reason-2" }
		],
		advisoryScore: 95
	});
	assert.equal(validateFlowDeskOptimizerProposalScoreV1(score).ok, true);
	assert.equal(score.advisory_score, 95);
	assert.equal(score.hard_filter_state, "passed");
});

test("optimizer proposal score blocked hard filter zeroes score", () => {
	const score = createFlowDeskOptimizerProposalScoreV1({
		scoreId: "opt-2",
		workflowId: "workflow-1",
		proposalId: "proposal-1",
		candidateRef: "candidate-2",
		hardFiltersPassed: false,
		blockedLabels: ["blocked-by-policy"],
		scoreDimensions: [
			{ dimension: "goal_fit", score: 90, weight: 0.5, reason_ref: "reason-1" }
		],
		advisoryScore: 95
	});
	assert.equal(validateFlowDeskOptimizerProposalScoreV1(score).ok, true);
	assert.equal(score.advisory_score, 0);
	assert.equal(score.hard_filter_state, "blocked");
});

test("optimizer proposal score rejects invalid dimensions", () => {
	const score = createFlowDeskOptimizerProposalScoreV1({
		scoreId: "opt-3",
		workflowId: "workflow-1",
		proposalId: "proposal-1",
		candidateRef: "candidate-3",
		hardFiltersPassed: true,
		scoreDimensions: [
			{ dimension: "unknown_fit" as "goal_fit", score: 90, weight: 0.5, reason_ref: "reason-1" }
		],
		advisoryScore: 95
	});
	const result = validateFlowDeskOptimizerProposalScoreV1(score);
	assert.equal(result.ok, false);
	assert.match(result.errors.join("; "), /dimension is invalid/);
});

test("optimizer proposal score rejects authority smuggling and raw markers", () => {
	const score = createFlowDeskOptimizerProposalScoreV1({
		scoreId: "opt-4",
		workflowId: "workflow-1",
		proposalId: "proposal-1",
		candidateRef: "candidate-4",
		hardFiltersPassed: true,
		scoreDimensions: [
			{ dimension: "goal_fit", score: 90, weight: 0.5, reason_ref: "reason-1" }
		],
		advisoryScore: 95
	});
	const forgedRuntime = validateFlowDeskOptimizerProposalScoreV1({ ...score, runtime_authority_enabled: true });
	assert.equal(forgedRuntime.ok, false);
	assert.match(forgedRuntime.errors.join("; "), /advisory-only/);

	const rawMarker = validateFlowDeskOptimizerProposalScoreV1({ ...score, hard_filter_state: "blocked", advisory_score: 0, blocked_labels: ["raw path /Users/foo"] });
	assert.equal(rawMarker.ok, false);
	assert.match(rawMarker.errors.join("; "), /schema-safe|raw path marker/);
});

test("operational intelligence scores remain advisory after hard filters", () => {
	const score = createFlowDeskOperationalIntelligenceScoreV1({
		scoreId: "score-1",
		workflowId: "workflow-1",
		candidateRef: "candidate-1",
		hardFiltersPassed: true,
		advisoryScore: 72,
		scoreReasonRef: "reason-1",
	});
	assert.equal(validateFlowDeskOperationalIntelligenceScoreV1(score).ok, true);
	assert.equal(score.dispatch_authority_enabled, false);
	assert.equal(score.provider_authority_enabled, false);
	assert.equal(score.runtime_authority_enabled, false);
	assert.equal(score.fallback_authority_enabled, false);
	assert.equal(score.lane_launch_authority_enabled, false);
	assert.equal(score.advisory_only, true);
});

test("operational intelligence blocks scoring authority when hard filters fail", () => {
	const score = createFlowDeskOperationalIntelligenceScoreV1({
		scoreId: "score-2",
		workflowId: "workflow-1",
		candidateRef: "candidate-2",
		hardFiltersPassed: false,
		blockedLabels: ["provider_unavailable"],
		advisoryScore: 90,
		scoreReasonRef: "reason-2",
	});
	assert.equal(score.advisory_score, 0);
	assert.equal(validateFlowDeskOperationalIntelligenceScoreV1(score).ok, true);
	const forged = validateFlowDeskOperationalIntelligenceScoreV1({ ...score, dispatch_authority_enabled: true });
	assert.equal(forged.ok, false);
	const missingReason = validateFlowDeskOperationalIntelligenceScoreV1({ ...score, blocked_labels: [] });
	assert.equal(missingReason.ok, false);
	assert.match(missingReason.errors.join("; "), /require blocked_labels/);
	const impossiblePassed = validateFlowDeskOperationalIntelligenceScoreV1({ ...score, hard_filter_state: "passed", advisory_score: 90 });
	assert.equal(impossiblePassed.ok, false);
	assert.match(impossiblePassed.errors.join("; "), /cannot carry blocked_labels/);
});

test("workflow plan proposal sets with all variants are valid", () => {
	const createProposal = (variant: "simple" | "standard" | "detailed" | "high_assurance"): FlowDeskWorkflowPlanProposalV1 => createFlowDeskWorkflowPlanProposalV1({
		proposalId: `proposal-${variant}`,
		workflowId: "workflow-1",
		proposalLabel: `Advisory plan proposal ${variant}`,
		advisorySummaryRef: `summary-${variant}`,
		candidates: [{ candidateRef: `candidate-${variant}`, candidateLabel: `Candidate ${variant}`, candidateSummaryRef: `candidate-summary-${variant}`, hardFiltersPassed: true }],
		createdAt: "2026-06-06T12:00:00.000Z",
		source: "flowdesk-main",
		variant,
		stepSummary: `step summary ${variant}`,
		writeSummary: `write summary ${variant}`,
		verificationSummary: `verification summary ${variant}`,
		rollbackSummary: `rollback summary ${variant}`,
		safeNextActions: ["flowdesk-status"]
	});

	const proposalSet = createFlowDeskWorkflowPlanProposalSetV1({
		proposalSetId: "proposal-set-1",
		workflowId: "workflow-1",
		createdAt: "2026-06-06T12:00:00.000Z",
		simpleProposal: createProposal("simple"),
		standardProposal: createProposal("standard"),
		detailedProposal: createProposal("detailed"),
		highAssuranceProposal: createProposal("high_assurance"),
		metadataRefs: ["ref-metadata-1"],
		evidenceRefs: ["ref-evidence-1"],
	});

	const val = validateFlowDeskWorkflowPlanProposalSetV1(proposalSet);
	assert.equal(val.ok, true, val.errors.join("; "));
	assert.equal(proposalSet.advisory_only, true);
	assert.equal(proposalSet.dispatch_authority_enabled, false);
	assert.equal(proposalSet.approval_authority_enabled, false);
});

test("workflow plan proposal sets reject missing variants or duplicate variants", () => {
	const createProposal = (variant: "simple" | "standard" | "detailed" | "high_assurance"): FlowDeskWorkflowPlanProposalV1 => createFlowDeskWorkflowPlanProposalV1({
		proposalId: `proposal-${variant}`,
		workflowId: "workflow-1",
		proposalLabel: `Advisory plan proposal ${variant}`,
		advisorySummaryRef: `summary-${variant}`,
		candidates: [{ candidateRef: `candidate-${variant}`, candidateLabel: `Candidate ${variant}`, candidateSummaryRef: `candidate-summary-${variant}`, hardFiltersPassed: true }],
		createdAt: "2026-06-06T12:00:00.000Z",
		source: "flowdesk-main",
		variant,
	});

	const proposalSet = createFlowDeskWorkflowPlanProposalSetV1({
		proposalSetId: "proposal-set-1",
		workflowId: "workflow-1",
		createdAt: "2026-06-06T12:00:00.000Z",
		simpleProposal: createProposal("simple"),
		standardProposal: createProposal("standard"),
		detailedProposal: createProposal("detailed"),
		highAssuranceProposal: createProposal("high_assurance"),
	});

	const missingVariant = { ...proposalSet, standard_proposal: undefined };
	const valMissing = validateFlowDeskWorkflowPlanProposalSetV1(missingVariant);
	assert.equal(valMissing.ok, false);
	assert.match(valMissing.errors.join("; "), /standard_proposal is missing/);

	const duplicateVariant = { ...proposalSet, standard_proposal: createProposal("simple") };
	const valDuplicate = validateFlowDeskWorkflowPlanProposalSetV1(duplicateVariant);
	assert.equal(valDuplicate.ok, false);
	assert.match(valDuplicate.errors.join("; "), /standard_proposal must have variant 'standard'/);
});

test("workflow plan proposal sets reject authority and raw marker", () => {
	const createProposal = (variant: "simple" | "standard" | "detailed" | "high_assurance"): FlowDeskWorkflowPlanProposalV1 => createFlowDeskWorkflowPlanProposalV1({
		proposalId: `proposal-${variant}`,
		workflowId: "workflow-1",
		proposalLabel: `Advisory plan proposal ${variant}`,
		advisorySummaryRef: `summary-${variant}`,
		candidates: [{ candidateRef: `candidate-${variant}`, candidateLabel: `Candidate ${variant}`, candidateSummaryRef: `candidate-summary-${variant}`, hardFiltersPassed: true }],
		createdAt: "2026-06-06T12:00:00.000Z",
		variant,
	});

	const proposalSet = createFlowDeskWorkflowPlanProposalSetV1({
		proposalSetId: "proposal-set-1",
		workflowId: "workflow-1",
		createdAt: "2026-06-06T12:00:00.000Z",
		simpleProposal: createProposal("simple"),
		standardProposal: createProposal("standard"),
		detailedProposal: createProposal("detailed"),
		highAssuranceProposal: createProposal("high_assurance"),
	});

	const badAuthority = { ...proposalSet, dispatch_authority_enabled: true };
	const valAuthority = validateFlowDeskWorkflowPlanProposalSetV1(badAuthority);
	assert.equal(valAuthority.ok, false);
	assert.match(valAuthority.errors.join("; "), /advisory-only/);

	const badRawMarker = { ...proposalSet, simple_proposal: createProposal("simple") };
	badRawMarker.simple_proposal.proposal_label = "raw path /Users/example/secret";
	const valRawMarker = validateFlowDeskWorkflowPlanProposalSetV1(badRawMarker);
	assert.equal(valRawMarker.ok, false);
	assert.match(valRawMarker.errors.join("; "), /credential-shaped/);
});

test("workflow plan proposals represent bounded advisory-only candidates", () => {
	const proposal = createFlowDeskWorkflowPlanProposalV1({
		proposalId: "proposal-1",
		workflowId: "workflow-1",
		proposalLabel: "Advisory plan proposal candidates",
		advisorySummaryRef: "summary-1",
		candidates: [
			{
				candidateRef: "candidate-1",
				candidateLabel: "Release 1 command-backed plan",
				candidateSummaryRef: "candidate-summary-1",
				hardFiltersPassed: true,
			},
			{
				candidateRef: "candidate-2",
				candidateLabel: "Blocked dispatch-seeking plan",
				candidateSummaryRef: "candidate-summary-2",
				hardFiltersPassed: false,
				blockedLabels: ["blocked-real-dispatch"],
			},
		],
	});
	assert.equal(validateFlowDeskWorkflowPlanProposalV1(proposal).ok, true);
	assert.equal(proposal.release_gate, "operational_intelligence_later_gate");
	assert.equal(proposal.advisory_only, true);
	assert.equal(proposal.dispatch_authority_enabled, false);
	assert.equal(proposal.approval_authority_enabled, false);
	assert.equal(proposal.provider_authority_enabled, false);
	assert.equal(proposal.runtime_authority_enabled, false);
	assert.equal(proposal.external_write_authority_enabled, false);
	assert.equal(proposal.fallback_authority_enabled, false);
	assert.equal(proposal.lane_launch_authority_enabled, false);
});

test("workflow plan proposals reject blocked hard filter and label/ref violations", () => {
	const proposal = createFlowDeskWorkflowPlanProposalV1({
		proposalId: "proposal-2",
		workflowId: "workflow-1",
		proposalLabel: "Advisory plan proposal",
		advisorySummaryRef: "summary-2",
		candidates: [{ candidateRef: "candidate-1", candidateLabel: "Blocked candidate", candidateSummaryRef: "candidate-summary-1", hardFiltersPassed: false }],
	});
	const missingBlockedLabel = validateFlowDeskWorkflowPlanProposalV1(proposal);
	assert.equal(missingBlockedLabel.ok, false);
	assert.match(missingBlockedLabel.errors.join("; "), /require blocked_labels/);

	const proposalWithBlockedLabel = {
		...proposal,
		candidates: [{ ...proposal.candidates[0], blocked_labels: ["blocked-hard-filter"] }],
	};
	const rawLabel = validateFlowDeskWorkflowPlanProposalV1({ ...proposalWithBlockedLabel, proposal_label: "prompt details expose secrets" });
	assert.equal(rawLabel.ok, false);
	assert.match(rawLabel.errors.join("; "), /prompt-like|credential-shaped/);

	const unsafeRef = validateFlowDeskWorkflowPlanProposalV1({ ...proposalWithBlockedLabel, advisory_summary_ref: "../summary" });
	assert.equal(unsafeRef.ok, false);
	assert.match(unsafeRef.errors.join("; "), /schema-safe|traversal/);
});

test("workflow plan proposal score events are advisory-only and zero blocked scores", () => {
	const event = createFlowDeskWorkflowPlanProposalScoreEventV1({
		scoreEventId: "score-event-1",
		workflowId: "workflow-1",
		proposalId: "proposal-1",
		candidateRef: "candidate-1",
		hardFiltersPassed: true,
		advisoryScore: 84,
		scoreReasonRef: "reason-1",
	});
	assert.equal(validateFlowDeskWorkflowPlanProposalScoreEventV1(event).ok, true);
	assert.equal(event.score_kind, "advisory_workflow_plan_proposal");
	assert.equal(event.dispatch_authority_enabled, false);
	assert.equal(event.approval_authority_enabled, false);
	assert.equal(event.provider_authority_enabled, false);
	assert.equal(event.runtime_authority_enabled, false);
	assert.equal(event.external_write_authority_enabled, false);
	assert.equal(event.fallback_authority_enabled, false);
	assert.equal(event.lane_launch_authority_enabled, false);

	const blocked = createFlowDeskWorkflowPlanProposalScoreEventV1({
		scoreEventId: "score-event-2",
		workflowId: "workflow-1",
		proposalId: "proposal-1",
		candidateRef: "candidate-2",
		hardFiltersPassed: false,
		blockedLabels: ["blocked-provider-unavailable"],
		advisoryScore: 99,
		scoreReasonRef: "reason-2",
	});
	assert.equal(blocked.advisory_score, 0);
	assert.equal(validateFlowDeskWorkflowPlanProposalScoreEventV1(blocked).ok, true);
});

test("workflow plan proposal score events reject authority smuggling", () => {
	const event = createFlowDeskWorkflowPlanProposalScoreEventV1({
		scoreEventId: "score-event-3",
		workflowId: "workflow-1",
		proposalId: "proposal-1",
		candidateRef: "candidate-1",
		hardFiltersPassed: true,
		advisoryScore: 64,
		scoreReasonRef: "reason-3",
	});
	const forgedRuntime = validateFlowDeskWorkflowPlanProposalScoreEventV1({ ...event, runtime_authority_enabled: true });
	assert.equal(forgedRuntime.ok, false);
	assert.match(forgedRuntime.errors.join("; "), /advisory-only/);

	const forgedFallback = validateFlowDeskWorkflowPlanProposalScoreEventV1({ ...event, fallback_authority_enabled: true });
	assert.equal(forgedFallback.ok, false);
	assert.match(forgedFallback.errors.join("; "), /advisory-only/);

	const unknownLaneLaunch = validateFlowDeskWorkflowPlanProposalScoreEventV1({ ...event, laneLaunch: true });
	assert.equal(unknownLaneLaunch.ok, false);
	assert.match(unknownLaneLaunch.errors.join("; "), /unknown properties/);
});

test("reference packs cannot act as professional signoff or external-write authority", () => {
	const pack: FlowDeskReferencePackV1 = {
		schema_version: "flowdesk.reference_pack.v1",
		pack_id: "pack-1",
		workflow_id: "workflow-1",
		source_refs: ["source-1"],
		source_hash_refs: ["hash-source-1"],
		specialist_signoff: false,
		professional_advice: false,
		advisory_only: true,
		external_write_authority_enabled: false,
	};
	assert.equal(validateFlowDeskReferencePackV1(pack).ok, true);
	assert.equal(validateFlowDeskReferencePackV1({ ...pack, specialist_signoff: true }).ok, false);
	assert.equal(validateFlowDeskReferencePackV1({ ...pack, source_hash_refs: ["hash-source-1", "hash-source-2"] }).ok, false);
});

test("operational intelligence contracts reject unknown authority fields", () => {
	const score = createFlowDeskOperationalIntelligenceScoreV1({
		scoreId: "score-3",
		workflowId: "workflow-1",
		candidateRef: "candidate-3",
		hardFiltersPassed: true,
		advisoryScore: 50,
		scoreReasonRef: "reason-3",
	});
	const forgedScore = validateFlowDeskOperationalIntelligenceScoreV1({ ...score, providerCall: true });
	assert.equal(forgedScore.ok, false);
	assert.match(forgedScore.errors.join("|"), /unknown properties/);

	const pack: FlowDeskReferencePackV1 = {
		schema_version: "flowdesk.reference_pack.v1",
		pack_id: "pack-2",
		workflow_id: "workflow-1",
		source_refs: ["source-1"],
		source_hash_refs: ["hash-source-1"],
		specialist_signoff: false,
		professional_advice: false,
		advisory_only: true,
		external_write_authority_enabled: false,
	};
	const forgedPack = validateFlowDeskReferencePackV1({ ...pack, dispatch_authority_enabled: true });
	assert.equal(forgedPack.ok, false);
	assert.match(forgedPack.errors.join("|"), /unknown properties/);
});

test("evaluation events are append-only advisory-only scoring facts", () => {
	const event = evaluationEvent();
	assert.equal(validateFlowDeskEvaluationEventV1(event).ok, true);
	assert.equal(event.schema_version, "flowdesk.evaluation_event.v1");
	assert.equal(event.local_only, true);
	assert.equal(event.append_only, true);
	assert.equal(event.non_authorizing, true);
	assert.equal(event.advisory_only, true);
	assert.equal(event.dispatch_authority_enabled, false);
	assert.equal(event.approval_authority_enabled, false);
	assert.equal(event.provider_authority_enabled, false);
	assert.equal(event.runtime_authority_enabled, false);
	assert.equal(event.lane_launch_authority_enabled, false);
	assert.equal(event.fallback_authority_enabled, false);
	assert.equal(event.write_authority_enabled, false);
	assert.equal(event.external_write_authority_enabled, false);
	assert.equal(event.remote_write_authority_enabled, false);
	assert.equal(event.hard_chat_authority_enabled, false);
});

test("evaluation events reject unknown properties and authority smuggling", () => {
	const event = evaluationEvent();
	const unknown = validateFlowDeskEvaluationEventV1({ ...event, providerCall: true });
	assert.equal(unknown.ok, false);
	assert.match(unknown.errors.join("; "), /unknown properties/);

	const dispatch = validateFlowDeskEvaluationEventV1({ ...event, dispatch_authority_enabled: true });
	assert.equal(dispatch.ok, false);
	assert.match(dispatch.errors.join("; "), /advisory-only|dispatch/);

	const hardChat = validateFlowDeskEvaluationEventV1({ ...event, hard_chat_authority_enabled: true });
	assert.equal(hardChat.ok, false);
	assert.match(hardChat.errors.join("; "), /hard-chat/);
});

test("evaluation events reject raw markers and malformed refs or hashes", () => {
	const raw = validateFlowDeskEvaluationEventV1(evaluationEvent({ source_ref: "prompt with token secret" }));
	assert.equal(raw.ok, false);
	assert.match(raw.errors.join("; "), /schema-safe|prompt-like|credential-shaped/);

	const malformedRef = validateFlowDeskEvaluationEventV1(evaluationEvent({ dedupe_ref: "../dedupe" }));
	assert.equal(malformedRef.ok, false);
	assert.match(malformedRef.errors.join("; "), /schema-safe|traversal/);

	const malformedHash = validateFlowDeskEvaluationEventV1(evaluationEvent({ taxonomy_hash_ref: "sha256-not-hex" }));
	assert.equal(malformedHash.ok, false);
	assert.match(malformedHash.errors.join("; "), /sha256/);
});

test("evaluation events reject invalid score dimensions and outcomes", () => {
	const invalidDimension = validateFlowDeskEvaluationEventV1(evaluationEvent({
		score_dimensions: [{ dimension: "provider_call" as "correctness", score: 50, weight: 0.5, outcome_label: "accepted", reason_ref: "reason-1" }],
	}));
	assert.equal(invalidDimension.ok, false);
	assert.match(invalidDimension.errors.join("; "), /dimension is invalid/);

	const invalidOutcome = validateFlowDeskEvaluationEventV1(evaluationEvent({
		overall_outcome_label: "dispatch" as "accepted",
	}));
	assert.equal(invalidOutcome.ok, false);
	assert.match(invalidOutcome.errors.join("; "), /overall_outcome_label is invalid/);

	const duplicateDimension = validateFlowDeskEvaluationEventV1(evaluationEvent({
		score_dimensions: [
			{ dimension: "safety", score: 50, weight: 0.5, outcome_label: "neutral", reason_ref: "reason-1" },
			{ dimension: "safety", score: 60, weight: 0.5, outcome_label: "neutral", reason_ref: "reason-2" },
		],
	}));
	assert.equal(duplicateDimension.ok, false);
	assert.match(duplicateDimension.errors.join("; "), /must not duplicate/);
});

test("evaluation events are compatible with local ledger append idempotency", () => {
	const entry = createFlowDeskAdvisoryScoreLedgerEntryV1({
		ledgerEntryId: "ledger-entry-evaluation-1",
		workflowId: "workflow-1",
		sequence: 0,
		recordedAt: "2026-06-06T00:00:10.000Z",
		event: evaluationEvent(),
	});
	assert.equal(entry.event_kind, "evaluation_event");
	assert.equal(validateFlowDeskAdvisoryScoreLedgerEntryV1(entry).ok, true);
	const intent = createFlowDeskAdvisoryScoreLedgerAppendIntentV1({ existingJsonl: "", entry, idempotencyKey: "idem-evaluation-1" });
	assert.equal(intent.ok, true);
	assert.equal(intent.intent?.append_only, true);
	assert.equal(intent.intent?.append_line?.includes("flowdesk.evaluation_event.v1"), true);
	const replay = createFlowDeskAdvisoryScoreLedgerAppendIntentV1({ existingJsonl: `${intent.intent?.append_line ?? ""}\n`, entry, idempotencyKey: "idem-evaluation-1" });
	assert.equal(replay.ok, true);
	assert.equal(replay.intent?.idempotent_replay, true);
});

test("advisory score ledger entries encode and decode as local JSONL", () => {
	const entry = ledgerEntry();
	assert.equal(validateFlowDeskAdvisoryScoreLedgerEntryV1(entry).ok, true);
	const encoded = encodeFlowDeskAdvisoryScoreLedgerEntryJsonlLine(entry);
	assert.equal(encoded.ok, true);
	assert.equal(encoded.line?.includes("\n"), false);
	const decoded = decodeFlowDeskAdvisoryScoreLedgerEntryJsonlLine(encoded.line ?? "");
	assert.equal(decoded.ok, true);
	assert.deepEqual(decoded.entry, entry);
	assert.equal(decoded.entry?.local_only, true);
	assert.equal(decoded.entry?.append_only, true);
	assert.equal(decoded.entry?.non_authorizing, true);
	assert.equal(decoded.entry?.dispatch_authority_enabled, false);
	assert.equal(decoded.entry?.external_write_authority_enabled, false);
});

test("advisory score ledger JSONL rejects malformed and authority-smuggling lines", () => {
	const malformed = decodeFlowDeskAdvisoryScoreLedgerEntryJsonlLine("{not-json}");
	assert.equal(malformed.ok, false);
	assert.match(malformed.errors.join("; "), /malformed JSON/);

	const entry = ledgerEntry({ runtime_authority_enabled: true as false });
	const forged = decodeFlowDeskAdvisoryScoreLedgerEntryJsonlLine(JSON.stringify(entry));
	assert.equal(forged.ok, false);
	assert.match(forged.errors.join("; "), /advisory-only/);

	const unknownProviderCall = decodeFlowDeskAdvisoryScoreLedgerEntryJsonlLine(JSON.stringify({ ...ledgerEntry(), providerCall: true }));
	assert.equal(unknownProviderCall.ok, false);
	assert.match(unknownProviderCall.errors.join("; "), /unknown properties/);
});

test("advisory score ledger rejects raw payload and path markers", () => {
	const rawReason = ledgerEntry({ event: scoreEvent({ score_reason_ref: "prompt details expose secret" }) });
	const rawResult = validateFlowDeskAdvisoryScoreLedgerEntryV1(rawReason);
	assert.equal(rawResult.ok, false);
	assert.match(rawResult.errors.join("; "), /schema-safe|prompt-like|credential-shaped/);

	const rawLabelProposal = createFlowDeskWorkflowPlanProposalV1({
		proposalId: "proposal-raw",
		workflowId: "workflow-1",
		proposalLabel: "raw path /Users/example/secret",
		advisorySummaryRef: "summary-1",
		candidates: [{ candidateRef: "candidate-1", candidateLabel: "Candidate", candidateSummaryRef: "candidate-summary-1", hardFiltersPassed: true }],
	});
	const pathResult = validateFlowDeskAdvisoryScoreLedgerEntryV1(ledgerEntry({ event_kind: "workflow_plan_proposal", event: rawLabelProposal }));
	assert.equal(pathResult.ok, false);
	assert.match(pathResult.errors.join("; "), /raw path marker/);
});

test("advisory score ledger append intents preserve ordering and idempotency", () => {
	const first = ledgerEntry();
	const firstIntent = createFlowDeskAdvisoryScoreLedgerAppendIntentV1({ existingJsonl: "", entry: first, idempotencyKey: "idem-1" });
	assert.equal(firstIntent.ok, true);
	assert.equal(firstIntent.intent?.operation, "append_jsonl");
	assert.equal(firstIntent.intent?.serialization, "jsonl");
	assert.equal(firstIntent.intent?.append_only, true);
	assert.equal(firstIntent.intent?.local_only, true);
	assert.equal(firstIntent.intent?.non_authorizing, true);
	assert.equal(firstIntent.intent?.append_line, encodeFlowDeskAdvisoryScoreLedgerEntryJsonlLine(first).line);

	const existing = `${firstIntent.intent?.append_line ?? ""}\n`;
	const replay = createFlowDeskAdvisoryScoreLedgerAppendIntentV1({ existingJsonl: existing, entry: first, idempotencyKey: "idem-1" });
	assert.equal(replay.ok, true);
	assert.equal(replay.intent?.idempotent_replay, true);
	assert.equal(replay.intent?.append_line, null);

	const second = ledgerEntry({
		ledger_entry_id: "ledger-entry-2",
		sequence: 1,
		previous_ledger_entry_id: "ledger-entry-1",
		recorded_at: "2026-06-06T00:00:01.000Z",
		event: scoreEvent({ score_event_id: "score-event-ledger-2", candidate_ref: "candidate-2" }),
	});
	const secondIntent = createFlowDeskAdvisoryScoreLedgerAppendIntentV1({ existingJsonl: existing, entry: second, idempotencyKey: "idem-2" });
	assert.equal(secondIntent.ok, true);
	assert.equal(secondIntent.intent?.expected_previous_ledger_entry_id, "ledger-entry-1");
	assert.equal(secondIntent.intent?.next_sequence, 2);

	const skipped = createFlowDeskAdvisoryScoreLedgerAppendIntentV1({ existingJsonl: existing, entry: { ...second, sequence: 3 }, idempotencyKey: "idem-3" });
	assert.equal(skipped.ok, false);
	assert.match(skipped.errors.join("; "), /sequence must continue/);

	const wrongPrevious = createFlowDeskAdvisoryScoreLedgerAppendIntentV1({ existingJsonl: existing, entry: { ...second, previous_ledger_entry_id: "ledger-entry-other" }, idempotencyKey: "idem-4" });
	assert.equal(wrongPrevious.ok, false);
	assert.match(wrongPrevious.errors.join("; "), /must match current tail/);
});

test("federated score registry publication intent is blocked by default", () => {
	const result = createFlowDeskFederatedScoreRegistryPublicationIntentV1({
		publicationIntentId: "registry-intent-1",
		requestId: "registry-request-1",
		workflowId: "workflow-1",
		registryRef: "registry-local-advisory-1",
		ledgerEntries: [ledgerEntry()],
		requestedAt: "2026-06-06T00:00:02.000Z",
	});
	assert.equal(result.ok, true);
	assert.equal(validateFlowDeskFederatedScoreRegistryPublicationIntentV1(result.intent).ok, true);
	assert.equal(result.intent?.state, "blocked");
	assert.equal(result.intent?.federated_registry_publication_opt_in, false);
	assert.equal(result.intent?.remote_write_blocked_by_default, true);
	assert.equal(result.intent?.remote_write_attempted, false);
	assert.equal(result.intent?.remote_write_authority_enabled, false);
	assert.equal(result.intent?.external_write_authority_enabled, false);
	assert.equal(result.intent?.blocked_labels.includes("federated-registry-publication-opt-in-missing"), true);
});

test("federated score registry publication request is opt-in and non-authorizing", () => {
	const request: FlowDeskFederatedScoreRegistryPublicationRequestV1 = {
		schema_version: "flowdesk.federated_score_registry_publication_request.v1",
		request_id: "registry-request-0",
		workflow_id: "workflow-1",
		registry_ref: "registry-local-advisory-1",
		ledger_entry_refs: ["ledger-entry-1"],
		requested_at: "2026-06-06T00:00:02.500Z",
		federated_registry_publication_opt_in: true,
		connector_gate_satisfied: false,
		remote_write_blocked_by_default: true,
		remote_write_attempted: false,
		non_authorizing: true,
		advisory_only: true,
		dispatch_authority_enabled: false,
		approval_authority_enabled: false,
		provider_authority_enabled: false,
		runtime_authority_enabled: false,
		external_write_authority_enabled: false,
		remote_write_authority_enabled: false,
		fallback_authority_enabled: false,
		lane_launch_authority_enabled: false,
	};
	assert.equal(validateFlowDeskFederatedScoreRegistryPublicationRequestV1(request).ok, true);
	assert.equal(validateFlowDeskFederatedScoreRegistryPublicationRequestV1({ ...request, remote_write_attempted: true }).ok, false);
	assert.equal(validateFlowDeskFederatedScoreRegistryPublicationRequestV1({ ...request, connector_gate_satisfied: true }).ok, false);
	assert.equal(validateFlowDeskFederatedScoreRegistryPublicationRequestV1({ ...request, registry_ref: "https://registry.example/raw" }).ok, false);
});

test("federated score registry opt-in remains non-authorizing without connector gate", () => {
	const result = createFlowDeskFederatedScoreRegistryPublicationIntentV1({
		publicationIntentId: "registry-intent-2",
		requestId: "registry-request-2",
		workflowId: "workflow-1",
		registryRef: "registry-local-advisory-1",
		ledgerEntries: [ledgerEntry()],
		requestedAt: "2026-06-06T00:00:03.000Z",
		federatedRegistryPublicationOptIn: true,
	});
	assert.equal(result.ok, true);
	assert.equal(validateFlowDeskFederatedScoreRegistryPublicationIntentV1(result.intent).ok, true);
	assert.equal(result.intent?.federated_registry_publication_opt_in, true);
	assert.equal(result.intent?.state, "blocked");
	assert.equal(result.intent?.connector_gate_satisfied, false);
	assert.equal(result.intent?.non_authorizing, true);
	assert.equal(result.intent?.dispatch_authority_enabled, false);
	assert.equal(result.intent?.provider_authority_enabled, false);
	assert.equal(result.intent?.runtime_authority_enabled, false);
	assert.equal(result.intent?.fallback_authority_enabled, false);
	assert.equal(result.intent?.lane_launch_authority_enabled, false);
	assert.equal(result.intent?.blocked_labels.includes("connector-gate-not-supplied-or-not-enabled"), true);
});

test("federated score registry publication rejects authority smuggling", () => {
	const result = createFlowDeskFederatedScoreRegistryPublicationIntentV1({
		publicationIntentId: "registry-intent-3",
		requestId: "registry-request-3",
		workflowId: "workflow-1",
		registryRef: "registry-local-advisory-1",
		ledgerEntries: [ledgerEntry()],
		requestedAt: "2026-06-06T00:00:04.000Z",
		federatedRegistryPublicationOptIn: true,
	});
	assert.equal(result.ok, true);
	const forgedRemote = validateFlowDeskFederatedScoreRegistryPublicationIntentV1({ ...result.intent, remote_write_authority_enabled: true });
	assert.equal(forgedRemote.ok, false);
	assert.match(forgedRemote.errors.join("; "), /remote-write/);
	const forgedConnectorGate = validateFlowDeskFederatedScoreRegistryPublicationIntentV1({ ...result.intent, connector_gate_satisfied: true });
	assert.equal(forgedConnectorGate.ok, false);
	assert.match(forgedConnectorGate.errors.join("; "), /connector gate unsatisfied/);
	const unknownPublicationTarget = validateFlowDeskFederatedScoreRegistryPublicationIntentV1({ ...result.intent, githubPublicationUrl: "https://example.invalid" });
	assert.equal(unknownPublicationTarget.ok, false);
	assert.match(unknownPublicationTarget.errors.join("; "), /unknown properties/);
});

test("federated score registry refs stay redaction-safe", () => {
	const rawRegistry = createFlowDeskFederatedScoreRegistryPublicationIntentV1({
		publicationIntentId: "registry-intent-4",
		requestId: "registry-request-4",
		workflowId: "workflow-1",
		registryRef: "https://github.com/org/repo/issues/1",
		ledgerEntries: [ledgerEntry()],
		requestedAt: "2026-06-06T00:00:05.000Z",
		federatedRegistryPublicationOptIn: true,
	});
	assert.equal(rawRegistry.ok, false);
	assert.match(rawRegistry.errors.join("; "), /schema-safe|paths/);

	const rawConnector = createFlowDeskFederatedScoreRegistryPublicationIntentV1({
		publicationIntentId: "registry-intent-5",
		requestId: "registry-request-5",
		workflowId: "workflow-1",
		registryRef: "registry-local-advisory-1",
		ledgerEntries: [ledgerEntry()],
		requestedAt: "2026-06-06T00:00:06.000Z",
		federatedRegistryPublicationOptIn: true,
		connectorGateRef: "secret token raw prompt",
	});
	assert.equal(rawConnector.ok, false);
	assert.match(rawConnector.errors.join("; "), /spaces|traversal|schema-safe/);
});

test("federated score registry intent is compatible with local ledger entries", () => {
	const first = ledgerEntry();
	const second = ledgerEntry({
		ledger_entry_id: "ledger-entry-2",
		sequence: 1,
		previous_ledger_entry_id: "ledger-entry-1",
		recorded_at: "2026-06-06T00:00:01.000Z",
		event: scoreEvent({ score_event_id: "score-event-ledger-2", candidate_ref: "candidate-2" }),
	});
	const result = createFlowDeskFederatedScoreRegistryPublicationIntentV1({
		publicationIntentId: "registry-intent-6",
		requestId: "registry-request-6",
		workflowId: "workflow-1",
		registryRef: "registry-local-advisory-1",
		ledgerEntries: [first, second],
		requestedAt: "2026-06-06T00:00:07.000Z",
		federatedRegistryPublicationOptIn: true,
		connectorGateRef: "connector-gate-ref-1",
	});
	assert.equal(result.ok, true);
	assert.deepEqual(result.intent?.ledger_entry_refs, ["ledger-entry-1", "ledger-entry-2"]);
	assert.equal(result.intent?.ledger_entry_count, 2);
	assert.equal(result.intent?.local_ledger_compatible, true);
	assert.equal(validateFlowDeskFederatedScoreRegistryPublicationIntentV1(result.intent).ok, true);

	const mismatched = createFlowDeskFederatedScoreRegistryPublicationIntentV1({
		publicationIntentId: "registry-intent-7",
		requestId: "registry-request-7",
		workflowId: "workflow-other",
		registryRef: "registry-local-advisory-1",
		ledgerEntries: [first],
		requestedAt: "2026-06-06T00:00:08.000Z",
		federatedRegistryPublicationOptIn: true,
	});
	assert.equal(mismatched.ok, false);
	assert.match(mismatched.errors.join("; "), /workflow_id must match/);
});

test("category fit snapshots remain advisory-only", () => {
	const snapshot = createFlowDeskCategoryFitSnapshotV1({
		snapshotId: "snap-1",
		workflowId: "workflow-1",
		taskSignatureRef: "task-sig-1",
		categorySignatureRef: "cat-sig-1",
		sampleCount: 42,
		fitnessScore: 85,
		freshnessTimestamp: "2026-06-06T00:00:00.000Z",
		evidenceRefs: ["evidence-1", "evidence-2"],
		safeNextActions: ["flowdesk-status"],
	});
	assert.equal(validateFlowDeskCategoryFitSnapshotV1(snapshot).ok, true);
	assert.equal(snapshot.advisory_only, true);
	assert.equal(snapshot.dispatch_authority_enabled, false);
	assert.equal(snapshot.external_write_authority_enabled, false);
	assert.equal(snapshot.remote_write_authority_enabled, false);
	assert.equal(snapshot.hard_chat_authority_enabled, false);
});

test("category fit snapshots reject unknown properties and authority smuggling", () => {
	const snapshot = createFlowDeskCategoryFitSnapshotV1({
		snapshotId: "snap-1",
		workflowId: "workflow-1",
		taskSignatureRef: "task-sig-1",
		categorySignatureRef: "cat-sig-1",
		sampleCount: 42,
		fitnessScore: 85,
		freshnessTimestamp: "2026-06-06T00:00:00.000Z",
		evidenceRefs: ["evidence-1"],
		safeNextActions: ["flowdesk-status"],
	});

	const forgedDispatch = validateFlowDeskCategoryFitSnapshotV1({ ...snapshot, dispatch_authority_enabled: true });
	assert.equal(forgedDispatch.ok, false);
	assert.match(forgedDispatch.errors.join("; "), /advisory-only/);

	const forgedWrite = validateFlowDeskCategoryFitSnapshotV1({ ...snapshot, remote_write_authority_enabled: true });
	assert.equal(forgedWrite.ok, false);
	assert.match(forgedWrite.errors.join("; "), /advisory-only/);

	const unknown = validateFlowDeskCategoryFitSnapshotV1({ ...snapshot, providerCall: true });
	assert.equal(unknown.ok, false);
	assert.match(unknown.errors.join("; "), /unknown properties/);
});

test("category fit snapshots reject malformed hashes and fail-closed validation", () => {
	const snapshot = createFlowDeskCategoryFitSnapshotV1({
		snapshotId: "snap-1",
		workflowId: "workflow-1",
		taskSignatureRef: "task-sig-1",
		categorySignatureRef: "cat-sig-1",
		sampleCount: -1, // invalid
		fitnessScore: 105, // invalid
		freshnessTimestamp: "not-a-date",
		evidenceRefs: ["invalid ref with spaces"],
		safeNextActions: ["flowdesk-status"],
	});

	const result = validateFlowDeskCategoryFitSnapshotV1(snapshot);
	assert.equal(result.ok, false);
	assert.match(result.errors.join("; "), /sample_count must be a non-negative integer/);
	assert.match(result.errors.join("; "), /fitness_score must be 0\.\.100/);
	assert.match(result.errors.join("; "), /freshness_timestamp must be a parseable timestamp/);
	assert.match(result.errors.join("; "), /schema-safe/);
});

// ─── P7-S5b: FlowDeskNormalizedScoreAggregationV1 tests ─────────────────────

test("normalized score aggregation creates valid weighted-average result", () => {
	const result = createFlowDeskNormalizedScoreAggregationV1({
		aggregationId: "agg-1",
		workflowId: "workflow-1",
		sourceScoreId: "opt-score-1",
		dimensionScores: [
			{ dimension: "goal_fit", score: 80, weight: 0.6, reason_ref: "reason-1" },
			{ dimension: "safety", score: 100, weight: 0.4, reason_ref: "reason-2" },
		],
		hardFilterState: "passed",
		aggregationReasonRef: "reason-agg-1",
		aggregatedAt: "2026-06-06T12:00:00.000Z",
	});
	assert.equal(result.ok, true, result.errors.join("; "));
	assert.ok(result.aggregation, "aggregation must be present");
	const agg = result.aggregation!;
	// weighted average: 80*0.6 + 100*0.4 = 48 + 40 = 88 (over total weight 1.0)
	assert.equal(agg.normalized_score, 88);
	assert.equal(agg.strict_minimum_breached, false);
	assert.equal(agg.hard_filter_state, "passed");
	assert.equal(agg.schema_version, "flowdesk.normalized_score_aggregation.v1");
	assert.equal(agg.release_gate, "operational_intelligence_later_gate");
	assert.equal(agg.advisory_only, true);
	assert.equal(agg.dispatch_authority_enabled, false);
	assert.equal(agg.provider_authority_enabled, false);
	assert.equal(agg.runtime_authority_enabled, false);
	assert.equal(agg.fallback_authority_enabled, false);
	assert.equal(agg.lane_launch_authority_enabled, false);
	assert.equal(agg.write_authority_enabled, false);
	assert.equal(agg.hard_chat_authority_enabled, false);
	assert.equal(agg.external_write_authority_enabled, false);
	// validator passes on the freshly created aggregation
	assert.equal(validateFlowDeskNormalizedScoreAggregationV1(agg).ok, true);
});

test("normalized score aggregation zeroes score on strict_minimum_breached and blocked hard_filter_state", () => {
	// Strict minimum threshold set at 90; safety score 70 < 90 → breach → zero
	const breached = createFlowDeskNormalizedScoreAggregationV1({
		aggregationId: "agg-2",
		workflowId: "workflow-1",
		sourceScoreId: "opt-score-2",
		dimensionScores: [
			{ dimension: "goal_fit", score: 95, weight: 0.5, reason_ref: "reason-1" },
			{ dimension: "safety", score: 70, weight: 0.5, reason_ref: "reason-2" },
		],
		hardFilterState: "passed",
		aggregationReasonRef: "reason-agg-2",
		aggregatedAt: "2026-06-06T12:01:00.000Z",
		strictMinimumThreshold: 90,
	});
	assert.equal(breached.ok, true, breached.errors.join("; "));
	assert.equal(breached.aggregation!.strict_minimum_breached, true);
	assert.equal(breached.aggregation!.normalized_score, 0);
	assert.equal(validateFlowDeskNormalizedScoreAggregationV1(breached.aggregation!).ok, true);

	// Blocked hard_filter_state also zeroes the score
	const blocked = createFlowDeskNormalizedScoreAggregationV1({
		aggregationId: "agg-3",
		workflowId: "workflow-1",
		sourceScoreId: "opt-score-3",
		dimensionScores: [
			{ dimension: "goal_fit", score: 90, weight: 1.0, reason_ref: "reason-3" },
		],
		hardFilterState: "blocked",
		aggregationReasonRef: "reason-agg-3",
		aggregatedAt: "2026-06-06T12:02:00.000Z",
	});
	assert.equal(blocked.ok, true, blocked.errors.join("; "));
	assert.equal(blocked.aggregation!.hard_filter_state, "blocked");
	assert.equal(blocked.aggregation!.normalized_score, 0);
	assert.equal(validateFlowDeskNormalizedScoreAggregationV1(blocked.aggregation!).ok, true);
});

test("normalized score aggregation rejects authority smuggling", () => {
	const result = createFlowDeskNormalizedScoreAggregationV1({
		aggregationId: "agg-4",
		workflowId: "workflow-1",
		sourceScoreId: "opt-score-4",
		dimensionScores: [
			{ dimension: "goal_fit", score: 75, weight: 1.0, reason_ref: "reason-4" },
		],
		hardFilterState: "passed",
		aggregationReasonRef: "reason-agg-4",
		aggregatedAt: "2026-06-06T12:03:00.000Z",
	});
	assert.equal(result.ok, true);
	const agg = result.aggregation!;

	// dispatch authority smuggling
	const forgedDispatch = validateFlowDeskNormalizedScoreAggregationV1({ ...agg, dispatch_authority_enabled: true });
	assert.equal(forgedDispatch.ok, false);
	assert.match(forgedDispatch.errors.join("; "), /advisory-only/);

	// external_write_authority smuggling
	const forgedWrite = validateFlowDeskNormalizedScoreAggregationV1({ ...agg, external_write_authority_enabled: true });
	assert.equal(forgedWrite.ok, false);
	assert.match(forgedWrite.errors.join("; "), /advisory-only/);

	// hard_chat_authority smuggling
	const forgedHardChat = validateFlowDeskNormalizedScoreAggregationV1({ ...agg, hard_chat_authority_enabled: true });
	assert.equal(forgedHardChat.ok, false);
	assert.match(forgedHardChat.errors.join("; "), /advisory-only/);

	// write_authority smuggling
	const forgedWriteAuth = validateFlowDeskNormalizedScoreAggregationV1({ ...agg, write_authority_enabled: true });
	assert.equal(forgedWriteAuth.ok, false);
	assert.match(forgedWriteAuth.errors.join("; "), /advisory-only/);
});

test("normalized score aggregation rejects malformed and invalid input", () => {
	// Score out of 0..100 range during creation
	const outOfRange = createFlowDeskNormalizedScoreAggregationV1({
		aggregationId: "agg-5",
		workflowId: "workflow-1",
		sourceScoreId: "opt-score-5",
		dimensionScores: [
			{ dimension: "goal_fit", score: 150, weight: 1.0, reason_ref: "reason-5" },
		],
		hardFilterState: "passed",
		aggregationReasonRef: "reason-agg-5",
		aggregatedAt: "2026-06-06T12:04:00.000Z",
	});
	assert.equal(outOfRange.ok, false);
	assert.match(outOfRange.errors.join("; "), /score must be 0/);

	// Unknown property injection
	const result = createFlowDeskNormalizedScoreAggregationV1({
		aggregationId: "agg-6",
		workflowId: "workflow-1",
		sourceScoreId: "opt-score-6",
		dimensionScores: [
			{ dimension: "safety", score: 80, weight: 1.0, reason_ref: "reason-6" },
		],
		hardFilterState: "passed",
		aggregationReasonRef: "reason-agg-6",
		aggregatedAt: "2026-06-06T12:05:00.000Z",
	});
	assert.equal(result.ok, true);
	const agg = result.aggregation!;

	// Unknown property
	const unknown = validateFlowDeskNormalizedScoreAggregationV1({ ...agg, providerDispatchTarget: "openai" });
	assert.equal(unknown.ok, false);
	assert.match(unknown.errors.join("; "), /unknown properties/);

	// Missing required field (aggregation_id stripped)
	const { aggregation_id: _removed, ...aggWithoutId } = agg as FlowDeskNormalizedScoreAggregationV1;
	const missingId = validateFlowDeskNormalizedScoreAggregationV1(aggWithoutId);
	assert.equal(missingId.ok, false);

	// Consistency violation: strict_minimum_breached=true but normalized_score > 0
	const inconsistent = validateFlowDeskNormalizedScoreAggregationV1({ ...agg, strict_minimum_breached: true, normalized_score: 50 });
	assert.equal(inconsistent.ok, false);
	assert.match(inconsistent.errors.join("; "), /normalized_score must be 0/);

	// normalized_score out of range in validator
	const badScore = validateFlowDeskNormalizedScoreAggregationV1({ ...agg, normalized_score: 150 });
	assert.equal(badScore.ok, false);
	assert.match(badScore.errors.join("; "), /finite number/);
});

// ─── P7-S6: FlowDeskScoreReuseThresholdGateV1 tests ─────────────────────────

const ctxHash = "sha256-abcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890";
const ctxHash2 = "sha256-1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef";

test("score reuse threshold gate produces reuse decision when all conditions pass", () => {
	const result = createFlowDeskScoreReuseThresholdGateV1({
		gateId: "gate-1",
		workflowId: "workflow-1",
		previousScoreRef: "score-ref-1",
		previousContextHash: ctxHash,
		currentContextHash: ctxHash,
		scoreAgeSeconds: 30,
		maxAgeThresholdSeconds: 300,
		minScoreThreshold: 60,
		previousAdvisoryScore: 85,
		reasonRefs: ["reason-gate-1"],
		evaluatedAt: "2026-06-06T12:00:00.000Z",
	});
	assert.equal(result.ok, true, result.errors.join("; "));
	const gate = result.gate!;
	assert.equal(gate.gate_decision, "reuse");
	assert.equal(gate.context_match, true);
	assert.equal(gate.within_age_threshold, true);
	assert.equal(gate.above_min_score, true);
	assert.equal(gate.schema_version, "flowdesk.score_reuse_threshold_gate.v1");
	assert.equal(gate.release_gate, "operational_intelligence_later_gate");
	assert.equal(gate.advisory_only, true);
	assert.equal(gate.non_authorizing, true);
	assert.equal(gate.dispatch_authority_enabled, false);
	assert.equal(gate.provider_authority_enabled, false);
	assert.equal(gate.runtime_authority_enabled, false);
	assert.equal(gate.fallback_authority_enabled, false);
	assert.equal(gate.lane_launch_authority_enabled, false);
	assert.equal(gate.write_authority_enabled, false);
	assert.equal(gate.remote_write_authority_enabled, false);
	assert.equal(gate.hard_chat_authority_enabled, false);
	assert.equal(validateFlowDeskScoreReuseThresholdGateV1(gate).ok, true);
});

test("score reuse threshold gate produces recompute decision on context drift", () => {
	// Mismatched context hashes → recompute
	const drifted = createFlowDeskScoreReuseThresholdGateV1({
		gateId: "gate-2",
		workflowId: "workflow-1",
		previousScoreRef: "score-ref-2",
		previousContextHash: ctxHash,
		currentContextHash: ctxHash2,
		scoreAgeSeconds: 10,
		maxAgeThresholdSeconds: 300,
		previousAdvisoryScore: 90,
		reasonRefs: ["reason-gate-2"],
		evaluatedAt: "2026-06-06T12:01:00.000Z",
	});
	assert.equal(drifted.ok, true, drifted.errors.join("; "));
	assert.equal(drifted.gate!.gate_decision, "recompute");
	assert.equal(drifted.gate!.context_match, false);
	assert.equal(validateFlowDeskScoreReuseThresholdGateV1(drifted.gate!).ok, true);

	// Stale score (age > threshold) → recompute
	const stale = createFlowDeskScoreReuseThresholdGateV1({
		gateId: "gate-3",
		workflowId: "workflow-1",
		previousScoreRef: "score-ref-3",
		previousContextHash: ctxHash,
		currentContextHash: ctxHash,
		scoreAgeSeconds: 600,
		maxAgeThresholdSeconds: 300,
		previousAdvisoryScore: 90,
		reasonRefs: ["reason-gate-3"],
		evaluatedAt: "2026-06-06T12:02:00.000Z",
	});
	assert.equal(stale.ok, true, stale.errors.join("; "));
	assert.equal(stale.gate!.gate_decision, "recompute");
	assert.equal(stale.gate!.within_age_threshold, false);

	// Score below minimum threshold → recompute
	const belowMin = createFlowDeskScoreReuseThresholdGateV1({
		gateId: "gate-4",
		workflowId: "workflow-1",
		previousScoreRef: "score-ref-4",
		previousContextHash: ctxHash,
		currentContextHash: ctxHash,
		scoreAgeSeconds: 10,
		maxAgeThresholdSeconds: 300,
		minScoreThreshold: 80,
		previousAdvisoryScore: 50,
		reasonRefs: ["reason-gate-4"],
		evaluatedAt: "2026-06-06T12:03:00.000Z",
	});
	assert.equal(belowMin.ok, true, belowMin.errors.join("; "));
	assert.equal(belowMin.gate!.gate_decision, "recompute");
	assert.equal(belowMin.gate!.above_min_score, false);
});

test("score reuse threshold gate rejects authority smuggling", () => {
	const result = createFlowDeskScoreReuseThresholdGateV1({
		gateId: "gate-5",
		workflowId: "workflow-1",
		previousScoreRef: "score-ref-5",
		previousContextHash: ctxHash,
		currentContextHash: ctxHash,
		scoreAgeSeconds: 0,
		maxAgeThresholdSeconds: 60,
		previousAdvisoryScore: 75,
		reasonRefs: ["reason-gate-5"],
		evaluatedAt: "2026-06-06T12:04:00.000Z",
	});
	assert.equal(result.ok, true);
	const gate = result.gate!;

	const forgedDispatch = validateFlowDeskScoreReuseThresholdGateV1({ ...gate, dispatch_authority_enabled: true });
	assert.equal(forgedDispatch.ok, false);
	assert.match(forgedDispatch.errors.join("; "), /advisory-only non-authorizing/);

	const forgedRuntime = validateFlowDeskScoreReuseThresholdGateV1({ ...gate, runtime_authority_enabled: true });
	assert.equal(forgedRuntime.ok, false);
	assert.match(forgedRuntime.errors.join("; "), /advisory-only non-authorizing/);

	const forgedFallback = validateFlowDeskScoreReuseThresholdGateV1({ ...gate, fallback_authority_enabled: true });
	assert.equal(forgedFallback.ok, false);
	assert.match(forgedFallback.errors.join("; "), /advisory-only non-authorizing/);

	const forgedRemoteWrite = validateFlowDeskScoreReuseThresholdGateV1({ ...gate, remote_write_authority_enabled: true });
	assert.equal(forgedRemoteWrite.ok, false);
	assert.match(forgedRemoteWrite.errors.join("; "), /advisory-only non-authorizing/);

	const forgedWrite = validateFlowDeskScoreReuseThresholdGateV1({ ...gate, write_authority_enabled: true });
	assert.equal(forgedWrite.ok, false);
	assert.match(forgedWrite.errors.join("; "), /advisory-only non-authorizing/);
});

test("score reuse threshold gate rejects malformed and out-of-range inputs", () => {
	// Negative score_age_seconds
	const negAge = createFlowDeskScoreReuseThresholdGateV1({
		gateId: "gate-6",
		workflowId: "workflow-1",
		previousScoreRef: "score-ref-6",
		previousContextHash: ctxHash,
		currentContextHash: ctxHash,
		scoreAgeSeconds: -1,
		maxAgeThresholdSeconds: 300,
		previousAdvisoryScore: 80,
		reasonRefs: ["reason-gate-6"],
		evaluatedAt: "2026-06-06T12:05:00.000Z",
	});
	assert.equal(negAge.ok, false);
	assert.match(negAge.errors.join("; "), /score_age_seconds must be a non-negative/);

	// Zero max_age_threshold (must be > 0)
	const zeroMax = createFlowDeskScoreReuseThresholdGateV1({
		gateId: "gate-7",
		workflowId: "workflow-1",
		previousScoreRef: "score-ref-7",
		previousContextHash: ctxHash,
		currentContextHash: ctxHash,
		scoreAgeSeconds: 10,
		maxAgeThresholdSeconds: 0,
		previousAdvisoryScore: 80,
		reasonRefs: ["reason-gate-7"],
		evaluatedAt: "2026-06-06T12:06:00.000Z",
	});
	assert.equal(zeroMax.ok, false);
	assert.match(zeroMax.errors.join("; "), /max_age_threshold_seconds must be a positive/);

	// previous_advisory_score out of 0..100
	const badScore = createFlowDeskScoreReuseThresholdGateV1({
		gateId: "gate-8",
		workflowId: "workflow-1",
		previousScoreRef: "score-ref-8",
		previousContextHash: ctxHash,
		currentContextHash: ctxHash,
		scoreAgeSeconds: 10,
		maxAgeThresholdSeconds: 300,
		previousAdvisoryScore: 150,
		reasonRefs: ["reason-gate-8"],
		evaluatedAt: "2026-06-06T12:07:00.000Z",
	});
	assert.equal(badScore.ok, false);
	assert.match(badScore.errors.join("; "), /previous_advisory_score must be 0..100/);

	// Malformed hash ref
	const badHash = createFlowDeskScoreReuseThresholdGateV1({
		gateId: "gate-9",
		workflowId: "workflow-1",
		previousScoreRef: "score-ref-9",
		previousContextHash: "not-a-valid-hash",
		currentContextHash: ctxHash,
		scoreAgeSeconds: 10,
		maxAgeThresholdSeconds: 300,
		previousAdvisoryScore: 80,
		reasonRefs: ["reason-gate-9"],
		evaluatedAt: "2026-06-06T12:08:00.000Z",
	});
	assert.equal(badHash.ok, false);
	assert.match(badHash.errors.join("; "), /previous_context_hash.*sha256|hash-<schema-safe/);

	// Unknown property injection via validator
	const result = createFlowDeskScoreReuseThresholdGateV1({
		gateId: "gate-10",
		workflowId: "workflow-1",
		previousScoreRef: "score-ref-10",
		previousContextHash: ctxHash,
		currentContextHash: ctxHash,
		scoreAgeSeconds: 5,
		maxAgeThresholdSeconds: 300,
		previousAdvisoryScore: 80,
		reasonRefs: ["reason-gate-10"],
		evaluatedAt: "2026-06-06T12:09:00.000Z",
	});
	assert.equal(result.ok, true);
	const unknown = validateFlowDeskScoreReuseThresholdGateV1({ ...result.gate!, providerDispatchTarget: "openai" });
	assert.equal(unknown.ok, false);
	assert.match(unknown.errors.join("; "), /unknown properties/);
});

test("score reuse threshold gate rejects inconsistent decisions", () => {
	const result = createFlowDeskScoreReuseThresholdGateV1({
		gateId: "gate-11",
		workflowId: "workflow-1",
		previousScoreRef: "score-ref-11",
		previousContextHash: ctxHash,
		currentContextHash: ctxHash,
		scoreAgeSeconds: 5,
		maxAgeThresholdSeconds: 300,
		previousAdvisoryScore: 80,
		reasonRefs: ["reason-gate-11"],
		evaluatedAt: "2026-06-06T12:10:00.000Z",
	});
	assert.equal(result.ok, true);
	const gate = result.gate!;

	// "reuse" decision but context_match=false is inconsistent
	const badReuseNoContext = validateFlowDeskScoreReuseThresholdGateV1({
		...gate,
		gate_decision: "reuse",
		context_match: false,
	});
	assert.equal(badReuseNoContext.ok, false);
	assert.match(badReuseNoContext.errors.join("; "), /reuse.*requires/);

	// "reuse" decision but within_age_threshold=false is inconsistent
	const badReuseStale = validateFlowDeskScoreReuseThresholdGateV1({
		...gate,
		gate_decision: "reuse",
		within_age_threshold: false,
	});
	assert.equal(badReuseStale.ok, false);
	assert.match(badReuseStale.errors.join("; "), /reuse.*requires/);

	// "blocked" decision but all sub-conditions true is inconsistent
	const badBlocked = validateFlowDeskScoreReuseThresholdGateV1({
		...gate,
		gate_decision: "blocked",
		context_match: true,
		within_age_threshold: true,
		above_min_score: true,
	});
	assert.equal(badBlocked.ok, false);
	assert.match(badBlocked.errors.join("; "), /blocked.*inconsistent/);

	// Invalid gate_decision value
	const badDecision = validateFlowDeskScoreReuseThresholdGateV1({
		...gate,
		gate_decision: "dispatch" as "reuse",
	});
	assert.equal(badDecision.ok, false);
	assert.match(badDecision.errors.join("; "), /gate_decision must be/);
});

// ─── P7-S7: Fanout Cadence Gate tests ────────────────────────────────────────

test("fanout cadence gate allows, reduces, and holds within safe bounds", () => {
	// allow: 2 requested, max=8, active=0, no cooldown pressure
	const allow = createFlowDeskFanoutCadenceGateV1({
		gateId: "fcg-1",
		workflowId: "workflow-1",
		requestedLaneCount: 2,
		maxConcurrentLanes: 8,
		activeLaneCount: 0,
		cadenceWindowSeconds: 60,
		cooldownSeconds: 0,
		secondsSinceLastBurst: 120,
		reasonRefs: ["reason-fcg-allow-1"],
		evaluatedAt: "2026-06-06T13:00:00.000Z",
	});
	assert.equal(allow.ok, true, allow.errors.join("; "));
	assert.equal(allow.gate!.gate_decision, "allow");
	assert.equal(allow.gate!.advisory_only, true);
	assert.equal(allow.gate!.dispatch_authority_enabled, false);
	assert.equal(allow.gate!.lane_launch_authority_enabled, false);

	// reduce: 5 requested, max=8 → 5 > floor(8/2)=4 → reduce
	const reduce = createFlowDeskFanoutCadenceGateV1({
		gateId: "fcg-2",
		workflowId: "workflow-1",
		requestedLaneCount: 5,
		maxConcurrentLanes: 8,
		activeLaneCount: 0,
		cadenceWindowSeconds: 60,
		cooldownSeconds: 0,
		secondsSinceLastBurst: 120,
		reasonRefs: ["reason-fcg-reduce-1"],
		evaluatedAt: "2026-06-06T13:01:00.000Z",
	});
	assert.equal(reduce.ok, true, reduce.errors.join("; "));
	assert.equal(reduce.gate!.gate_decision, "reduce");

	// hold: active=6, requested=4, max=8 → 6+4=10 > 8 → hold
	const hold = createFlowDeskFanoutCadenceGateV1({
		gateId: "fcg-3",
		workflowId: "workflow-1",
		requestedLaneCount: 4,
		maxConcurrentLanes: 8,
		activeLaneCount: 6,
		cadenceWindowSeconds: 60,
		cooldownSeconds: 0,
		secondsSinceLastBurst: 120,
		reasonRefs: ["reason-fcg-hold-1"],
		evaluatedAt: "2026-06-06T13:02:00.000Z",
	});
	assert.equal(hold.ok, true, hold.errors.join("; "));
	assert.equal(hold.gate!.gate_decision, "hold");

	// hold via cooldown: cooldown=30, seconds_since_last_burst=10
	const holdCooldown = createFlowDeskFanoutCadenceGateV1({
		gateId: "fcg-4",
		workflowId: "workflow-1",
		requestedLaneCount: 2,
		maxConcurrentLanes: 8,
		activeLaneCount: 0,
		cadenceWindowSeconds: 60,
		cooldownSeconds: 30,
		secondsSinceLastBurst: 10,
		reasonRefs: ["reason-fcg-hold-cooldown-1"],
		evaluatedAt: "2026-06-06T13:03:00.000Z",
	});
	assert.equal(holdCooldown.ok, true, holdCooldown.errors.join("; "));
	assert.equal(holdCooldown.gate!.gate_decision, "hold");
});

test("fanout cadence gate rejects authority smuggling", () => {
	const result = createFlowDeskFanoutCadenceGateV1({
		gateId: "fcg-5",
		workflowId: "workflow-1",
		requestedLaneCount: 2,
		maxConcurrentLanes: 8,
		activeLaneCount: 0,
		cadenceWindowSeconds: 60,
		cooldownSeconds: 0,
		secondsSinceLastBurst: 120,
		reasonRefs: ["reason-fcg-5"],
		evaluatedAt: "2026-06-06T13:04:00.000Z",
	});
	assert.equal(result.ok, true);
	const gate = result.gate!;

	const forgedDispatch = validateFlowDeskFanoutCadenceGateV1({ ...gate, dispatch_authority_enabled: true });
	assert.equal(forgedDispatch.ok, false);
	assert.match(forgedDispatch.errors.join("; "), /advisory-only non-authorizing/);

	const forgedLaneLaunch = validateFlowDeskFanoutCadenceGateV1({ ...gate, lane_launch_authority_enabled: true });
	assert.equal(forgedLaneLaunch.ok, false);
	assert.match(forgedLaneLaunch.errors.join("; "), /advisory-only non-authorizing/);

	const forgedFallback = validateFlowDeskFanoutCadenceGateV1({ ...gate, fallback_authority_enabled: true });
	assert.equal(forgedFallback.ok, false);
	assert.match(forgedFallback.errors.join("; "), /advisory-only non-authorizing/);

	const forgedWrite = validateFlowDeskFanoutCadenceGateV1({ ...gate, write_authority_enabled: true });
	assert.equal(forgedWrite.ok, false);
	assert.match(forgedWrite.errors.join("; "), /advisory-only non-authorizing/);

	const forgedRuntime = validateFlowDeskFanoutCadenceGateV1({ ...gate, runtime_authority_enabled: true });
	assert.equal(forgedRuntime.ok, false);
	assert.match(forgedRuntime.errors.join("; "), /advisory-only non-authorizing/);
});

test("fanout cadence gate rejects malformed and out-of-range inputs", () => {
	// Negative active_lane_count
	const negActive = createFlowDeskFanoutCadenceGateV1({
		gateId: "fcg-6",
		workflowId: "workflow-1",
		requestedLaneCount: 2,
		maxConcurrentLanes: 8,
		activeLaneCount: -1,
		cadenceWindowSeconds: 60,
		cooldownSeconds: 0,
		secondsSinceLastBurst: 0,
		reasonRefs: ["reason-fcg-6"],
		evaluatedAt: "2026-06-06T13:05:00.000Z",
	});
	assert.equal(negActive.ok, false);
	assert.match(negActive.errors.join("; "), /active_lane_count must be a non-negative/);

	// Zero max_concurrent_lanes (must be >= 1)
	const zeroMax = createFlowDeskFanoutCadenceGateV1({
		gateId: "fcg-7",
		workflowId: "workflow-1",
		requestedLaneCount: 1,
		maxConcurrentLanes: 0,
		activeLaneCount: 0,
		cadenceWindowSeconds: 60,
		cooldownSeconds: 0,
		secondsSinceLastBurst: 0,
		reasonRefs: ["reason-fcg-7"],
		evaluatedAt: "2026-06-06T13:06:00.000Z",
	});
	assert.equal(zeroMax.ok, false);
	assert.match(zeroMax.errors.join("; "), /max_concurrent_lanes must be a positive/);

	// Unknown property injection
	const validResult = createFlowDeskFanoutCadenceGateV1({
		gateId: "fcg-8",
		workflowId: "workflow-1",
		requestedLaneCount: 2,
		maxConcurrentLanes: 8,
		activeLaneCount: 0,
		cadenceWindowSeconds: 60,
		cooldownSeconds: 0,
		secondsSinceLastBurst: 0,
		reasonRefs: ["reason-fcg-8"],
		evaluatedAt: "2026-06-06T13:07:00.000Z",
	});
	assert.equal(validResult.ok, true);
	const unknownProp = validateFlowDeskFanoutCadenceGateV1({ ...validResult.gate!, providerDispatchTarget: "openai" });
	assert.equal(unknownProp.ok, false);
	assert.match(unknownProp.errors.join("; "), /unknown properties/);

	// Malformed reason_refs — empty array
	const emptyReasons = createFlowDeskFanoutCadenceGateV1({
		gateId: "fcg-9",
		workflowId: "workflow-1",
		requestedLaneCount: 2,
		maxConcurrentLanes: 8,
		activeLaneCount: 0,
		cadenceWindowSeconds: 60,
		cooldownSeconds: 0,
		secondsSinceLastBurst: 0,
		reasonRefs: [],
		evaluatedAt: "2026-06-06T13:08:00.000Z",
	});
	assert.equal(emptyReasons.ok, false);
	assert.match(emptyReasons.errors.join("; "), /reason_refs must be a non-empty/);
});

test("fanout cadence gate rejects inconsistent decisions", () => {
	const validResult = createFlowDeskFanoutCadenceGateV1({
		gateId: "fcg-10",
		workflowId: "workflow-1",
		requestedLaneCount: 2,
		maxConcurrentLanes: 8,
		activeLaneCount: 0,
		cadenceWindowSeconds: 60,
		cooldownSeconds: 0,
		secondsSinceLastBurst: 120,
		reasonRefs: ["reason-fcg-10"],
		evaluatedAt: "2026-06-06T13:09:00.000Z",
	});
	assert.equal(validResult.ok, true);
	const gate = validResult.gate!;

	// allow=true but requested > max → inconsistent
	const badAllow = validateFlowDeskFanoutCadenceGateV1({
		...gate,
		gate_decision: "allow",
		requested_lane_count: 10,
		max_concurrent_lanes: 8,
	});
	assert.equal(badAllow.ok, false);
	assert.match(badAllow.errors.join("; "), /allow.*inconsistent/);

	// blocked but all constraints pass → inconsistent
	const badBlocked = validateFlowDeskFanoutCadenceGateV1({
		...gate,
		gate_decision: "blocked",
		requested_lane_count: 2,
		max_concurrent_lanes: 8,
		active_lane_count: 0,
		cooldown_seconds: 0,
		seconds_since_last_burst: 120,
	});
	assert.equal(badBlocked.ok, false);
	assert.match(badBlocked.errors.join("; "), /blocked.*inconsistent/);

	// Invalid gate_decision value
	const badDecision = validateFlowDeskFanoutCadenceGateV1({
		...gate,
		gate_decision: "dispatch" as "allow",
	});
	assert.equal(badDecision.ok, false);
	assert.match(badDecision.errors.join("; "), /gate_decision must be/);
});

// ─── P7-S8: Local Ledger Snapshot tests ──────────────────────────────────────

const snapshotHash = "sha256-abcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890";

test("local ledger snapshot creates valid advisory-only record with entries", () => {
	const result = createFlowDeskLocalLedgerSnapshotV1({
		snapshotId: "snap-ledger-1",
		workflowId: "workflow-1",
		capturedAt: "2026-06-06T14:00:00.000Z",
		entryCount: 5,
		oldestEntryRef: "ledger-entry-oldest-1",
		newestEntryRef: "ledger-entry-newest-1",
		contentHashSummary: snapshotHash,
		stalenessSeconds: 12,
		safeNextActions: ["flowdesk-status"],
	});
	assert.equal(result.ok, true, result.errors.join("; "));
	const snap = result.snapshot!;
	assert.equal(snap.schema_version, "flowdesk.local_ledger_snapshot.v1");
	assert.equal(snap.entry_count, 5);
	assert.equal(snap.oldest_entry_ref, "ledger-entry-oldest-1");
	assert.equal(snap.newest_entry_ref, "ledger-entry-newest-1");
	assert.equal(snap.content_hash_summary, snapshotHash);
	assert.equal(snap.staleness_seconds, 12);
	assert.equal(snap.advisory_only, true);
	assert.equal(snap.non_authorizing, true);
	assert.equal(snap.dispatch_authority_enabled, false);
	assert.equal(snap.approval_authority_enabled, false);
	assert.equal(snap.provider_authority_enabled, false);
	assert.equal(snap.runtime_authority_enabled, false);
	assert.equal(snap.external_write_authority_enabled, false);
	assert.equal(snap.remote_write_authority_enabled, false);
	assert.equal(snap.fallback_authority_enabled, false);
	assert.equal(snap.lane_launch_authority_enabled, false);
	assert.equal(snap.write_authority_enabled, false);
	assert.equal(snap.hard_chat_authority_enabled, false);
	// Validator also passes
	assert.equal(validateFlowDeskLocalLedgerSnapshotV1(snap).ok, true);
});

test("local ledger snapshot rejects authority smuggling", () => {
	const result = createFlowDeskLocalLedgerSnapshotV1({
		snapshotId: "snap-ledger-2",
		workflowId: "workflow-1",
		capturedAt: "2026-06-06T14:01:00.000Z",
		entryCount: 0,
		stalenessSeconds: 0,
		safeNextActions: ["flowdesk-status"],
	});
	assert.equal(result.ok, true);
	const snap = result.snapshot!;

	// dispatch authority smuggling
	const forgedDispatch = validateFlowDeskLocalLedgerSnapshotV1({ ...snap, dispatch_authority_enabled: true });
	assert.equal(forgedDispatch.ok, false);
	assert.match(forgedDispatch.errors.join("; "), /advisory-only non-authorizing/);

	// runtime authority smuggling
	const forgedRuntime = validateFlowDeskLocalLedgerSnapshotV1({ ...snap, runtime_authority_enabled: true });
	assert.equal(forgedRuntime.ok, false);
	assert.match(forgedRuntime.errors.join("; "), /advisory-only non-authorizing/);

	// non_authorizing stripped
	const strippedNonAuth = validateFlowDeskLocalLedgerSnapshotV1({ ...snap, non_authorizing: false as true });
	assert.equal(strippedNonAuth.ok, false);
	assert.match(strippedNonAuth.errors.join("; "), /advisory-only non-authorizing/);

	// unknown property injection
	const unknown = validateFlowDeskLocalLedgerSnapshotV1({ ...snap, providerCall: true });
	assert.equal(unknown.ok, false);
	assert.match(unknown.errors.join("; "), /unknown properties/);
});

test("local ledger snapshot rejects malformed and invalid inputs", () => {
	// Negative entry_count
	const negCount = createFlowDeskLocalLedgerSnapshotV1({
		snapshotId: "snap-ledger-3",
		workflowId: "workflow-1",
		capturedAt: "2026-06-06T14:02:00.000Z",
		entryCount: -1,
		stalenessSeconds: 0,
		safeNextActions: ["flowdesk-status"],
	});
	assert.equal(negCount.ok, false);
	assert.match(negCount.errors.join("; "), /entry_count must be a non-negative integer/);

	// Negative staleness_seconds
	const negStaleness = createFlowDeskLocalLedgerSnapshotV1({
		snapshotId: "snap-ledger-4",
		workflowId: "workflow-1",
		capturedAt: "2026-06-06T14:03:00.000Z",
		entryCount: 0,
		stalenessSeconds: -5,
		safeNextActions: ["flowdesk-status"],
	});
	assert.equal(negStaleness.ok, false);
	assert.match(negStaleness.errors.join("; "), /staleness_seconds must be a non-negative finite/);

	// Malformed content_hash_summary
	const badHash = createFlowDeskLocalLedgerSnapshotV1({
		snapshotId: "snap-ledger-5",
		workflowId: "workflow-1",
		capturedAt: "2026-06-06T14:04:00.000Z",
		entryCount: 3,
		oldestEntryRef: "ledger-entry-1",
		newestEntryRef: "ledger-entry-3",
		contentHashSummary: "not-a-valid-hash",
		stalenessSeconds: 0,
		safeNextActions: ["flowdesk-status"],
	});
	assert.equal(badHash.ok, false);
	assert.match(badHash.errors.join("; "), /content_hash_summary.*sha256|hash-<schema-safe/);

	// Raw path marker in snapshot_id
	const rawPath = createFlowDeskLocalLedgerSnapshotV1({
		snapshotId: "/Users/foo/ledger",
		workflowId: "workflow-1",
		capturedAt: "2026-06-06T14:05:00.000Z",
		entryCount: 0,
		stalenessSeconds: 0,
		safeNextActions: ["flowdesk-status"],
	});
	assert.equal(rawPath.ok, false);
	assert.match(rawPath.errors.join("; "), /schema-safe|raw path marker|traversal/);
});

test("local ledger snapshot rejects inconsistent state (zero entries with refs)", () => {
	// entry_count=0 but oldest_entry_ref is present → inconsistency
	const zeroWithOldest = createFlowDeskLocalLedgerSnapshotV1({
		snapshotId: "snap-ledger-6",
		workflowId: "workflow-1",
		capturedAt: "2026-06-06T14:06:00.000Z",
		entryCount: 0,
		oldestEntryRef: "ledger-entry-1",
		newestEntryRef: "ledger-entry-1",
		stalenessSeconds: 0,
		safeNextActions: ["flowdesk-status"],
	});
	assert.equal(zeroWithOldest.ok, false);
	assert.match(zeroWithOldest.errors.join("; "), /oldest_entry_ref must be absent when entry_count is 0/);

	// entry_count=0 but content_hash_summary is present → inconsistency
	const zeroWithHash = createFlowDeskLocalLedgerSnapshotV1({
		snapshotId: "snap-ledger-7",
		workflowId: "workflow-1",
		capturedAt: "2026-06-06T14:07:00.000Z",
		entryCount: 0,
		contentHashSummary: snapshotHash,
		stalenessSeconds: 0,
		safeNextActions: ["flowdesk-status"],
	});
	assert.equal(zeroWithHash.ok, false);
	assert.match(zeroWithHash.errors.join("; "), /content_hash_summary must be absent when entry_count is 0/);

	// oldest_entry_ref without newest_entry_ref → ref pair inconsistency
	const mismatchedRefs = createFlowDeskLocalLedgerSnapshotV1({
		snapshotId: "snap-ledger-8",
		workflowId: "workflow-1",
		capturedAt: "2026-06-06T14:08:00.000Z",
		entryCount: 3,
		oldestEntryRef: "ledger-entry-oldest-1",
		// newest_entry_ref intentionally absent
		stalenessSeconds: 0,
		safeNextActions: ["flowdesk-status"],
	});
	assert.equal(mismatchedRefs.ok, false);
	assert.match(mismatchedRefs.errors.join("; "), /oldest_entry_ref and newest_entry_ref must both be present or both absent/);

	// Validator also detects inconsistency: valid snapshot then mutated
	const validResult = createFlowDeskLocalLedgerSnapshotV1({
		snapshotId: "snap-ledger-9",
		workflowId: "workflow-1",
		capturedAt: "2026-06-06T14:09:00.000Z",
		entryCount: 2,
		oldestEntryRef: "ledger-entry-oldest-1",
		newestEntryRef: "ledger-entry-newest-1",
		stalenessSeconds: 0,
		safeNextActions: ["flowdesk-status"],
	});
	assert.equal(validResult.ok, true);
	// Mutate to entry_count=0 while keeping refs — validator must reject
	const mutated = validateFlowDeskLocalLedgerSnapshotV1({ ...validResult.snapshot!, entry_count: 0 });
	assert.equal(mutated.ok, false);
	assert.match(mutated.errors.join("; "), /oldest_entry_ref must be absent when entry_count is 0/);
});

// ─── P7-S9: Score Reference Pack tests ──────────────────────────────────────

test("score reference pack creates valid pack with required and optional refs", () => {
	const result = createFlowDeskScoreReferencePackV1({
		referencePackId: "ref-pack-1",
		workflowId: "workflow-1",
		taskSignatureRef: "task-sig-1",
		scoreRefs: ["score-ref-1", "score-ref-2"],
		snapshotRefs: ["snapshot-ref-1"],
		gateDecisionRefs: ["gate-decision-ref-1"],
		capturedAt: "2026-06-06T15:00:00.000Z",
		safeNextActions: ["flowdesk-status"],
	});
	assert.equal(result.ok, true, result.errors.join("; "));
	const pack = result.pack as FlowDeskScoreReferencePackV1;
	assert.equal(pack.schema_version, "flowdesk.score_reference_pack.v1");
	assert.equal(pack.reference_pack_id, "ref-pack-1");
	assert.equal(pack.workflow_id, "workflow-1");
	assert.equal(pack.task_signature_ref, "task-sig-1");
	assert.deepEqual(pack.score_refs, ["score-ref-1", "score-ref-2"]);
	assert.deepEqual(pack.snapshot_refs, ["snapshot-ref-1"]);
	assert.deepEqual(pack.gate_decision_refs, ["gate-decision-ref-1"]);
	assert.equal(pack.captured_at, "2026-06-06T15:00:00.000Z");
	assert.equal(pack.advisory_only, true);
	assert.equal(pack.non_authorizing, true);
	assert.equal(pack.dispatch_authority_enabled, false);
	assert.equal(pack.approval_authority_enabled, false);
	assert.equal(pack.provider_authority_enabled, false);
	assert.equal(pack.runtime_authority_enabled, false);
	assert.equal(pack.external_write_authority_enabled, false);
	assert.equal(pack.remote_write_authority_enabled, false);
	assert.equal(pack.fallback_authority_enabled, false);
	assert.equal(pack.lane_launch_authority_enabled, false);
	assert.equal(pack.write_authority_enabled, false);
	assert.equal(pack.hard_chat_authority_enabled, false);
	// Validator also passes
	assert.equal(validateFlowDeskScoreReferencePackV1(pack).ok, true);
});

test("score reference pack rejects authority smuggling", () => {
	const result = createFlowDeskScoreReferencePackV1({
		referencePackId: "ref-pack-2",
		workflowId: "workflow-1",
		taskSignatureRef: "task-sig-1",
		scoreRefs: ["score-ref-1"],
		capturedAt: "2026-06-06T15:01:00.000Z",
		safeNextActions: ["flowdesk-status"],
	});
	assert.equal(result.ok, true);
	const pack = result.pack as FlowDeskScoreReferencePackV1;

	// dispatch authority smuggling
	const forgedDispatch = validateFlowDeskScoreReferencePackV1({ ...pack, dispatch_authority_enabled: true });
	assert.equal(forgedDispatch.ok, false);
	assert.match(forgedDispatch.errors.join("; "), /advisory-only non-authorizing/);

	// runtime authority smuggling
	const forgedRuntime = validateFlowDeskScoreReferencePackV1({ ...pack, runtime_authority_enabled: true });
	assert.equal(forgedRuntime.ok, false);
	assert.match(forgedRuntime.errors.join("; "), /advisory-only non-authorizing/);

	// non_authorizing stripped
	const strippedNonAuth = validateFlowDeskScoreReferencePackV1({ ...pack, non_authorizing: false as true });
	assert.equal(strippedNonAuth.ok, false);
	assert.match(strippedNonAuth.errors.join("; "), /advisory-only non-authorizing/);

	// unknown property injection
	const unknown = validateFlowDeskScoreReferencePackV1({ ...pack, providerCall: true });
	assert.equal(unknown.ok, false);
	assert.match(unknown.errors.join("; "), /unknown properties/);
});

test("score reference pack rejects malformed and over-limit inputs", () => {
	// Empty score_refs
	const emptyScoreRefs = createFlowDeskScoreReferencePackV1({
		referencePackId: "ref-pack-3a",
		workflowId: "workflow-1",
		taskSignatureRef: "task-sig-1",
		scoreRefs: [],
		capturedAt: "2026-06-06T15:02:00.000Z",
		safeNextActions: ["flowdesk-status"],
	});
	assert.equal(emptyScoreRefs.ok, false);
	assert.match(emptyScoreRefs.errors.join("; "), /score_refs must be a non-empty bounded array/);

	// Over-limit score_refs (21 entries)
	const tooManyScoreRefs = createFlowDeskScoreReferencePackV1({
		referencePackId: "ref-pack-3b",
		workflowId: "workflow-1",
		taskSignatureRef: "task-sig-1",
		scoreRefs: Array.from({ length: 21 }, (_, i) => `score-ref-${i + 1}`),
		capturedAt: "2026-06-06T15:02:10.000Z",
		safeNextActions: ["flowdesk-status"],
	});
	assert.equal(tooManyScoreRefs.ok, false);
	assert.match(tooManyScoreRefs.errors.join("; "), /score_refs must be a non-empty bounded array/);

	// Over-limit snapshot_refs (11 entries)
	const tooManySnapshots = createFlowDeskScoreReferencePackV1({
		referencePackId: "ref-pack-3c",
		workflowId: "workflow-1",
		taskSignatureRef: "task-sig-1",
		scoreRefs: ["score-ref-1"],
		snapshotRefs: Array.from({ length: 11 }, (_, i) => `snapshot-ref-${i + 1}`),
		capturedAt: "2026-06-06T15:02:20.000Z",
		safeNextActions: ["flowdesk-status"],
	});
	assert.equal(tooManySnapshots.ok, false);
	assert.match(tooManySnapshots.errors.join("; "), /snapshot_refs must be a bounded array/);

	// Over-limit gate_decision_refs (11 entries)
	const tooManyGates = createFlowDeskScoreReferencePackV1({
		referencePackId: "ref-pack-3d",
		workflowId: "workflow-1",
		taskSignatureRef: "task-sig-1",
		scoreRefs: ["score-ref-1"],
		gateDecisionRefs: Array.from({ length: 11 }, (_, i) => `gate-ref-${i + 1}`),
		capturedAt: "2026-06-06T15:02:30.000Z",
		safeNextActions: ["flowdesk-status"],
	});
	assert.equal(tooManyGates.ok, false);
	assert.match(tooManyGates.errors.join("; "), /gate_decision_refs must be a bounded array/);

	// Malformed task_signature_ref (raw path marker)
	const rawPath = createFlowDeskScoreReferencePackV1({
		referencePackId: "ref-pack-3e",
		workflowId: "workflow-1",
		taskSignatureRef: "/Users/foo/task-sig",
		scoreRefs: ["score-ref-1"],
		capturedAt: "2026-06-06T15:02:40.000Z",
		safeNextActions: ["flowdesk-status"],
	});
	assert.equal(rawPath.ok, false);
	assert.match(rawPath.errors.join("; "), /schema-safe|raw path marker|traversal/);
});

test("score reference pack rejects empty or missing required arrays via validator", () => {
	// Validator rejects object with score_refs as empty array
	const noScoreRefs = validateFlowDeskScoreReferencePackV1({
		schema_version: "flowdesk.score_reference_pack.v1",
		reference_pack_id: "ref-pack-4a",
		workflow_id: "workflow-1",
		task_signature_ref: "task-sig-1",
		score_refs: [],
		snapshot_refs: [],
		gate_decision_refs: [],
		captured_at: "2026-06-06T15:03:00.000Z",
		safe_next_actions: ["flowdesk-status"],
		advisory_only: true,
		non_authorizing: true,
		dispatch_authority_enabled: false,
		approval_authority_enabled: false,
		provider_authority_enabled: false,
		runtime_authority_enabled: false,
		external_write_authority_enabled: false,
		remote_write_authority_enabled: false,
		fallback_authority_enabled: false,
		lane_launch_authority_enabled: false,
		write_authority_enabled: false,
		hard_chat_authority_enabled: false,
	});
	assert.equal(noScoreRefs.ok, false);
	assert.match(noScoreRefs.errors.join("; "), /score_refs must be a non-empty bounded array/);

	// Validator rejects missing safe_next_actions
	const noActions = validateFlowDeskScoreReferencePackV1({
		schema_version: "flowdesk.score_reference_pack.v1",
		reference_pack_id: "ref-pack-4b",
		workflow_id: "workflow-1",
		task_signature_ref: "task-sig-1",
		score_refs: ["score-ref-1"],
		snapshot_refs: [],
		gate_decision_refs: [],
		captured_at: "2026-06-06T15:03:10.000Z",
		safe_next_actions: [],
		advisory_only: true,
		non_authorizing: true,
		dispatch_authority_enabled: false,
		approval_authority_enabled: false,
		provider_authority_enabled: false,
		runtime_authority_enabled: false,
		external_write_authority_enabled: false,
		remote_write_authority_enabled: false,
		fallback_authority_enabled: false,
		lane_launch_authority_enabled: false,
		write_authority_enabled: false,
		hard_chat_authority_enabled: false,
	});
	assert.equal(noActions.ok, false);
	assert.match(noActions.errors.join("; "), /safe_next_actions must be a non-empty bounded array/);

	// Validator rejects non-object
	assert.equal(validateFlowDeskScoreReferencePackV1(null).ok, false);
	assert.equal(validateFlowDeskScoreReferencePackV1(42).ok, false);
	assert.equal(validateFlowDeskScoreReferencePackV1([]).ok, false);
});

// ─── P7-S10: Workflow Signature Index Entry tests ────────────────────────────

test("workflow signature index entry creates valid entry with all optional fields", () => {
	const result = createFlowDeskWorkflowSignatureIndexEntryV1({
		entryId: "idx-entry-1",
		workflowId: "workflow-1",
		taskSignatureRef: "task-sig-1",
		referencePackRef: "ref-pack-1",
		categoryFitSnapshotRef: "cat-snap-1",
		lastScoredAt: "2026-06-06T15:30:00.000Z",
		createdAt: "2026-06-06T15:00:00.000Z",
		safeNextActions: ["flowdesk-status"],
	});
	assert.equal(result.ok, true, result.errors.join("; "));
	const entry = result.entry as FlowDeskWorkflowSignatureIndexEntryV1;
	assert.equal(entry.schema_version, "flowdesk.workflow_signature_index_entry.v1");
	assert.equal(entry.entry_id, "idx-entry-1");
	assert.equal(entry.workflow_id, "workflow-1");
	assert.equal(entry.task_signature_ref, "task-sig-1");
	assert.equal(entry.reference_pack_ref, "ref-pack-1");
	assert.equal(entry.category_fit_snapshot_ref, "cat-snap-1");
	assert.equal(entry.last_scored_at, "2026-06-06T15:30:00.000Z");
	assert.equal(entry.created_at, "2026-06-06T15:00:00.000Z");
	assert.equal(entry.advisory_only, true);
	assert.equal(entry.non_authorizing, true);
	assert.equal(entry.dispatch_authority_enabled, false);
	assert.equal(entry.approval_authority_enabled, false);
	assert.equal(entry.provider_authority_enabled, false);
	assert.equal(entry.runtime_authority_enabled, false);
	assert.equal(entry.external_write_authority_enabled, false);
	assert.equal(entry.remote_write_authority_enabled, false);
	assert.equal(entry.fallback_authority_enabled, false);
	assert.equal(entry.lane_launch_authority_enabled, false);
	assert.equal(entry.write_authority_enabled, false);
	assert.equal(entry.hard_chat_authority_enabled, false);
	// Validator also passes
	assert.equal(validateFlowDeskWorkflowSignatureIndexEntryV1(entry).ok, true);
});

test("workflow signature index entry creates valid minimal entry (no optional fields)", () => {
	const result = createFlowDeskWorkflowSignatureIndexEntryV1({
		entryId: "idx-entry-2",
		workflowId: "workflow-2",
		taskSignatureRef: "task-sig-2",
		createdAt: "2026-06-06T16:00:00.000Z",
		safeNextActions: ["flowdesk-status", "flowdesk-doctor"],
	});
	assert.equal(result.ok, true, result.errors.join("; "));
	const entry = result.entry as FlowDeskWorkflowSignatureIndexEntryV1;
	assert.equal(entry.reference_pack_ref, undefined);
	assert.equal(entry.category_fit_snapshot_ref, undefined);
	assert.equal(entry.last_scored_at, undefined);
	assert.equal(entry.advisory_only, true);
	assert.equal(entry.non_authorizing, true);
	// Validator also passes on minimal entry
	assert.equal(validateFlowDeskWorkflowSignatureIndexEntryV1(entry).ok, true);
});

test("workflow signature index entry rejects authority smuggling and unknown properties", () => {
	const result = createFlowDeskWorkflowSignatureIndexEntryV1({
		entryId: "idx-entry-3",
		workflowId: "workflow-1",
		taskSignatureRef: "task-sig-3",
		createdAt: "2026-06-06T16:01:00.000Z",
		safeNextActions: ["flowdesk-status"],
	});
	assert.equal(result.ok, true);
	const entry = result.entry as FlowDeskWorkflowSignatureIndexEntryV1;

	// dispatch authority smuggling
	const forgedDispatch = validateFlowDeskWorkflowSignatureIndexEntryV1({ ...entry, dispatch_authority_enabled: true });
	assert.equal(forgedDispatch.ok, false);
	assert.match(forgedDispatch.errors.join("; "), /advisory-only non-authorizing/);

	// runtime authority smuggling
	const forgedRuntime = validateFlowDeskWorkflowSignatureIndexEntryV1({ ...entry, runtime_authority_enabled: true });
	assert.equal(forgedRuntime.ok, false);
	assert.match(forgedRuntime.errors.join("; "), /advisory-only non-authorizing/);

	// non_authorizing stripped
	const strippedNonAuth = validateFlowDeskWorkflowSignatureIndexEntryV1({ ...entry, non_authorizing: false as true });
	assert.equal(strippedNonAuth.ok, false);
	assert.match(strippedNonAuth.errors.join("; "), /advisory-only non-authorizing/);

	// unknown property injection
	const unknown = validateFlowDeskWorkflowSignatureIndexEntryV1({ ...entry, providerCall: true });
	assert.equal(unknown.ok, false);
	assert.match(unknown.errors.join("; "), /unknown properties/);
});

// ─── P7-S11: OI Session Summary tests ────────────────────────────────────────

test("OI session summary creates valid summary with healthy label", () => {
	const result = createFlowDeskOISessionSummaryV1({
		summaryId: "oi-summary-1",
		sessionRef: "ses-session-1",
		workflowId: "workflow-oi-1",
		proposalsScored: 5,
		reuseGatesChecked: 3,
		fanoutGatesEvaluated: 2,
		ledgerEntriesTotal: 10,
		advisoryHealthLabel: "healthy",
		capturedAt: "2026-06-06T12:00:00.000Z",
		safeNextActions: ["flowdesk-status"],
	});
	assert.equal(result.ok, true);
	assert.equal(result.errors.length, 0);
	assert.ok(result.summary !== undefined);
	const s = result.summary as FlowDeskOISessionSummaryV1;
	assert.equal(s.schema_version, "flowdesk.oi_session_summary.v1");
	assert.equal(s.summary_id, "oi-summary-1");
	assert.equal(s.session_ref, "ses-session-1");
	assert.equal(s.workflow_id, "workflow-oi-1");
	assert.equal(s.proposals_scored, 5);
	assert.equal(s.reuse_gates_checked, 3);
	assert.equal(s.fanout_gates_evaluated, 2);
	assert.equal(s.ledger_entries_total, 10);
	assert.equal(s.advisory_health_label, "healthy");
	assert.equal(s.advisory_only, true);
	assert.equal(s.non_authorizing, true);
	assert.equal(s.dispatch_authority_enabled, false);
	assert.equal(s.approval_authority_enabled, false);
	assert.equal(s.provider_authority_enabled, false);
	assert.equal(s.runtime_authority_enabled, false);
	assert.equal(s.fallback_authority_enabled, false);
	assert.equal(s.lane_launch_authority_enabled, false);
	assert.equal(s.write_authority_enabled, false);
	assert.equal(s.hard_chat_authority_enabled, false);
	// Validate round-trips
	const validation = validateFlowDeskOISessionSummaryV1(s);
	assert.equal(validation.ok, true);
});

test("OI session summary creates valid summary with degraded label and zero counts", () => {
	const result = createFlowDeskOISessionSummaryV1({
		summaryId: "oi-summary-degraded-1",
		sessionRef: "ses-degraded-session-1",
		workflowId: "workflow-oi-degraded-1",
		proposalsScored: 0,
		reuseGatesChecked: 0,
		fanoutGatesEvaluated: 0,
		ledgerEntriesTotal: 0,
		advisoryHealthLabel: "degraded",
		capturedAt: "2026-06-06T13:00:00.000Z",
		safeNextActions: ["flowdesk-doctor", "flowdesk-status"],
	});
	assert.equal(result.ok, true);
	assert.ok(result.summary !== undefined);
	const s = result.summary as FlowDeskOISessionSummaryV1;
	assert.equal(s.advisory_health_label, "degraded");
	assert.equal(s.proposals_scored, 0);
	assert.equal(s.ledger_entries_total, 0);
	// Validate round-trips
	const validation = validateFlowDeskOISessionSummaryV1(s);
	assert.equal(validation.ok, true);
});

test("OI session summary validator rejects authority smuggling", () => {
	const result = createFlowDeskOISessionSummaryV1({
		summaryId: "oi-summary-auth-1",
		sessionRef: "ses-auth-1",
		workflowId: "workflow-oi-auth-1",
		proposalsScored: 1,
		reuseGatesChecked: 1,
		fanoutGatesEvaluated: 1,
		ledgerEntriesTotal: 1,
		advisoryHealthLabel: "healthy",
		capturedAt: "2026-06-06T14:00:00.000Z",
		safeNextActions: ["flowdesk-status"],
	});
	assert.equal(result.ok, true);
	assert.ok(result.summary !== undefined);

	// Attempt authority smuggling: flip advisory_only and set a dispatch flag
	const smuggled = {
		...result.summary,
		advisory_only: false,
		dispatch_authority_enabled: true,
	};
	const validation = validateFlowDeskOISessionSummaryV1(smuggled);
	assert.equal(validation.ok, false);
	assert.match(validation.errors.join("; "), /advisory-only|dispatch/);
});

test("OI session summary validator rejects negative counts", () => {
	// proposals_scored negative
	const r1 = createFlowDeskOISessionSummaryV1({
		summaryId: "oi-summary-neg-1",
		sessionRef: "ses-neg-1",
		workflowId: "workflow-oi-neg-1",
		proposalsScored: -1,
		reuseGatesChecked: 0,
		fanoutGatesEvaluated: 0,
		ledgerEntriesTotal: 0,
		advisoryHealthLabel: "unknown",
		capturedAt: "2026-06-06T15:00:00.000Z",
		safeNextActions: ["flowdesk-status"],
	});
	assert.equal(r1.ok, false);
	assert.match(r1.errors.join("; "), /proposals_scored.*non-negative/);

	// reuse_gates_checked negative
	const r2 = createFlowDeskOISessionSummaryV1({
		summaryId: "oi-summary-neg-2",
		sessionRef: "ses-neg-2",
		workflowId: "workflow-oi-neg-2",
		proposalsScored: 0,
		reuseGatesChecked: -5,
		fanoutGatesEvaluated: 0,
		ledgerEntriesTotal: 0,
		advisoryHealthLabel: "stale",
		capturedAt: "2026-06-06T15:01:00.000Z",
		safeNextActions: ["flowdesk-status"],
	});
	assert.equal(r2.ok, false);
	assert.match(r2.errors.join("; "), /reuse_gates_checked.*non-negative/);

	// Validator-level negative count (via direct object)
	const directNeg = validateFlowDeskOISessionSummaryV1({
		schema_version: "flowdesk.oi_session_summary.v1",
		summary_id: "oi-summary-neg-3",
		session_ref: "ses-neg-3",
		workflow_id: "workflow-oi-neg-3",
		proposals_scored: 0,
		reuse_gates_checked: 0,
		fanout_gates_evaluated: 0,
		ledger_entries_total: -2,
		advisory_health_label: "healthy",
		captured_at: "2026-06-06T15:02:00.000Z",
		safe_next_actions: ["flowdesk-status"],
		advisory_only: true,
		non_authorizing: true,
		dispatch_authority_enabled: false,
		approval_authority_enabled: false,
		provider_authority_enabled: false,
		runtime_authority_enabled: false,
		external_write_authority_enabled: false,
		remote_write_authority_enabled: false,
		fallback_authority_enabled: false,
		lane_launch_authority_enabled: false,
		write_authority_enabled: false,
		hard_chat_authority_enabled: false,
	});
	assert.equal(directNeg.ok, false);
	assert.match(directNeg.errors.join("; "), /ledger_entries_total.*non-negative/);
});

test("OI session summary validator rejects invalid advisory_health_label", () => {
	const result = createFlowDeskOISessionSummaryV1({
		summaryId: "oi-summary-label-1",
		sessionRef: "ses-label-1",
		workflowId: "workflow-oi-label-1",
		proposalsScored: 0,
		reuseGatesChecked: 0,
		fanoutGatesEvaluated: 0,
		ledgerEntriesTotal: 0,
		advisoryHealthLabel: "invalid-label" as never,
		capturedAt: "2026-06-06T16:00:00.000Z",
		safeNextActions: ["flowdesk-status"],
	});
	assert.equal(result.ok, false);
	assert.match(result.errors.join("; "), /advisory_health_label.*healthy.*degraded.*stale.*unknown/);

	// Validator-level bad label
	const directBad = validateFlowDeskOISessionSummaryV1({
		schema_version: "flowdesk.oi_session_summary.v1",
		summary_id: "oi-summary-label-2",
		session_ref: "ses-label-2",
		workflow_id: "workflow-oi-label-2",
		proposals_scored: 0,
		reuse_gates_checked: 0,
		fanout_gates_evaluated: 0,
		ledger_entries_total: 0,
		advisory_health_label: "excellent",
		captured_at: "2026-06-06T16:01:00.000Z",
		safe_next_actions: ["flowdesk-status"],
		advisory_only: true,
		non_authorizing: true,
		dispatch_authority_enabled: false,
		approval_authority_enabled: false,
		provider_authority_enabled: false,
		runtime_authority_enabled: false,
		external_write_authority_enabled: false,
		remote_write_authority_enabled: false,
		fallback_authority_enabled: false,
		lane_launch_authority_enabled: false,
		write_authority_enabled: false,
		hard_chat_authority_enabled: false,
	});
	assert.equal(directBad.ok, false);
	assert.match(directBad.errors.join("; "), /advisory_health_label/);

	// Also confirm validator rejects non-object inputs
	assert.equal(validateFlowDeskOISessionSummaryV1(null).ok, false);
	assert.equal(validateFlowDeskOISessionSummaryV1(42).ok, false);
	assert.equal(validateFlowDeskOISessionSummaryV1([]).ok, false);
});

test("workflow signature index entry rejects malformed input and timestamp inconsistency", () => {
	// Malformed task_signature_ref (raw path marker)
	const rawPath = createFlowDeskWorkflowSignatureIndexEntryV1({
		entryId: "idx-entry-4a",
		workflowId: "workflow-1",
		taskSignatureRef: "/Users/foo/task-sig",
		createdAt: "2026-06-06T16:02:00.000Z",
		safeNextActions: ["flowdesk-status"],
	});
	assert.equal(rawPath.ok, false);
	assert.match(rawPath.errors.join("; "), /schema-safe|raw path marker|traversal/);

	// Malformed reference_pack_ref
	const badRef = createFlowDeskWorkflowSignatureIndexEntryV1({
		entryId: "idx-entry-4b",
		workflowId: "workflow-1",
		taskSignatureRef: "task-sig-4b",
		referencePackRef: "../bad-ref",
		createdAt: "2026-06-06T16:03:00.000Z",
		safeNextActions: ["flowdesk-status"],
	});
	assert.equal(badRef.ok, false);
	assert.match(badRef.errors.join("; "), /schema-safe|traversal/);

	// last_scored_at before created_at → timestamp inconsistency
	const staleScore = createFlowDeskWorkflowSignatureIndexEntryV1({
		entryId: "idx-entry-4c",
		workflowId: "workflow-1",
		taskSignatureRef: "task-sig-4c",
		lastScoredAt: "2026-06-05T00:00:00.000Z", // before created_at
		createdAt: "2026-06-06T16:04:00.000Z",
		safeNextActions: ["flowdesk-status"],
	});
	assert.equal(staleScore.ok, false);
	assert.match(staleScore.errors.join("; "), /last_scored_at must not precede created_at/);

	// Validator also detects timestamp inconsistency on mutated entry
	const validResult = createFlowDeskWorkflowSignatureIndexEntryV1({
		entryId: "idx-entry-4d",
		workflowId: "workflow-1",
		taskSignatureRef: "task-sig-4d",
		lastScoredAt: "2026-06-06T17:00:00.000Z",
		createdAt: "2026-06-06T16:05:00.000Z",
		safeNextActions: ["flowdesk-status"],
	});
	assert.equal(validResult.ok, true);
	// Mutate: push created_at to after last_scored_at
	const mutated = validateFlowDeskWorkflowSignatureIndexEntryV1({
		...validResult.entry,
		created_at: "2026-06-06T18:00:00.000Z",
	});
	assert.equal(mutated.ok, false);
	assert.match(mutated.errors.join("; "), /last_scored_at must not precede created_at/);

	// Validator rejects non-object inputs
	assert.equal(validateFlowDeskWorkflowSignatureIndexEntryV1(null).ok, false);
	assert.equal(validateFlowDeskWorkflowSignatureIndexEntryV1(42).ok, false);
	assert.equal(validateFlowDeskWorkflowSignatureIndexEntryV1([]).ok, false);
});

// ─── P7-S12: Specialist Workflow Eligibility ─────────────────────────────────

test("specialist workflow eligibility: valid eligible decision", () => {
	const result = createFlowDeskSpecialistWorkflowEligibilityV1({
		eligibilityId: "eligibility-1",
		workflowId: "workflow-1",
		taskSignatureRef: "task-sig-security-1",
		eligibilityDecision: "eligible",
		specialistCategory: "security",
		confidenceScore: 87,
		reasonRefs: ["reason-security-match-1", "reason-confidence-1"],
		blockingLabels: [],
		evaluatedAt: "2026-06-06T12:00:00.000Z",
		safeNextActions: ["flowdesk-status"],
	});
	assert.equal(result.ok, true);
	assert.ok(result.eligibility);
	const e = result.eligibility as FlowDeskSpecialistWorkflowEligibilityV1;
	assert.equal(e.schema_version, "flowdesk.specialist_workflow_eligibility.v1");
	assert.equal(e.eligibility_decision, "eligible");
	assert.equal(e.specialist_category, "security");
	assert.equal(e.confidence_score, 87);
	assert.deepEqual(e.reason_refs, ["reason-security-match-1", "reason-confidence-1"]);
	assert.deepEqual(e.blocking_labels, []);
	assert.equal(e.advisory_only, true);
	assert.equal(e.non_authorizing, true);
	assert.equal(e.dispatch_authority_enabled, false);
	assert.equal(e.routing_authority_enabled, false);
	assert.equal(e.model_selection_authority_enabled, false);

	// Validator accepts a valid eligible record
	const validation = validateFlowDeskSpecialistWorkflowEligibilityV1(e);
	assert.equal(validation.ok, true);
});

test("specialist workflow eligibility: valid ineligible decision", () => {
	const result = createFlowDeskSpecialistWorkflowEligibilityV1({
		eligibilityId: "eligibility-2",
		workflowId: "workflow-2",
		taskSignatureRef: "task-sig-general-2",
		eligibilityDecision: "ineligible",
		specialistCategory: "unknown",
		confidenceScore: 0,
		reasonRefs: ["reason-no-match-2"],
		blockingLabels: [],
		evaluatedAt: "2026-06-06T13:00:00.000Z",
		safeNextActions: ["flowdesk-status"],
	});
	assert.equal(result.ok, true);
	assert.ok(result.eligibility);
	const e = result.eligibility as FlowDeskSpecialistWorkflowEligibilityV1;
	assert.equal(e.eligibility_decision, "ineligible");
	assert.equal(e.specialist_category, "unknown");
	assert.equal(e.confidence_score, 0);

	// Round-trip through validator
	const validation = validateFlowDeskSpecialistWorkflowEligibilityV1(e);
	assert.equal(validation.ok, true);

	// Non-object inputs rejected
	assert.equal(validateFlowDeskSpecialistWorkflowEligibilityV1(null).ok, false);
	assert.equal(validateFlowDeskSpecialistWorkflowEligibilityV1(42).ok, false);
	assert.equal(validateFlowDeskSpecialistWorkflowEligibilityV1([]).ok, false);
});

test("specialist workflow eligibility: authority smuggling rejection", () => {
	const valid = createFlowDeskSpecialistWorkflowEligibilityV1({
		eligibilityId: "eligibility-3",
		workflowId: "workflow-3",
		taskSignatureRef: "task-sig-3",
		eligibilityDecision: "eligible",
		specialistCategory: "compliance",
		confidenceScore: 70,
		evaluatedAt: "2026-06-06T14:00:00.000Z",
		safeNextActions: ["flowdesk-status"],
	});
	assert.equal(valid.ok, true);

	// Attempt to smuggle dispatch authority
	const smuggledDispatch = validateFlowDeskSpecialistWorkflowEligibilityV1({
		...valid.eligibility,
		dispatch_authority_enabled: true,
	});
	assert.equal(smuggledDispatch.ok, false);
	assert.match(smuggledDispatch.errors.join("; "), /advisory-only non-authorizing|dispatch/);

	// Attempt to smuggle routing authority
	const smuggledRouting = validateFlowDeskSpecialistWorkflowEligibilityV1({
		...valid.eligibility,
		routing_authority_enabled: true,
	});
	assert.equal(smuggledRouting.ok, false);
	assert.match(smuggledRouting.errors.join("; "), /advisory-only non-authorizing|routing/);

	// Attempt to smuggle non_authorizing=false
	const smuggledNonAuth = validateFlowDeskSpecialistWorkflowEligibilityV1({
		...valid.eligibility,
		non_authorizing: false,
	});
	assert.equal(smuggledNonAuth.ok, false);

	// Attempt to inject unknown property
	const unknownProp = validateFlowDeskSpecialistWorkflowEligibilityV1({
		...valid.eligibility,
		inject_prompt: "do something",
	});
	assert.equal(unknownProp.ok, false);
	assert.match(unknownProp.errors.join("; "), /unknown properties/);
});

test("specialist workflow eligibility: out-of-range confidence rejection and blocked-without-label inconsistency", () => {
	// confidence_score above 100
	const tooHigh = createFlowDeskSpecialistWorkflowEligibilityV1({
		eligibilityId: "eligibility-4a",
		workflowId: "workflow-4",
		taskSignatureRef: "task-sig-4",
		eligibilityDecision: "eligible",
		specialistCategory: "legal",
		confidenceScore: 101,
		evaluatedAt: "2026-06-06T15:00:00.000Z",
		safeNextActions: ["flowdesk-status"],
	});
	assert.equal(tooHigh.ok, false);
	assert.match(tooHigh.errors.join("; "), /confidence_score/);

	// confidence_score below 0
	const tooLow = createFlowDeskSpecialistWorkflowEligibilityV1({
		eligibilityId: "eligibility-4b",
		workflowId: "workflow-4",
		taskSignatureRef: "task-sig-4b",
		eligibilityDecision: "ineligible",
		specialistCategory: "medical",
		confidenceScore: -1,
		evaluatedAt: "2026-06-06T15:01:00.000Z",
		safeNextActions: ["flowdesk-status"],
	});
	assert.equal(tooLow.ok, false);
	assert.match(tooLow.errors.join("; "), /confidence_score/);

	// confidence_score is non-integer (float)
	const nonInteger = createFlowDeskSpecialistWorkflowEligibilityV1({
		eligibilityId: "eligibility-4c",
		workflowId: "workflow-4",
		taskSignatureRef: "task-sig-4c",
		eligibilityDecision: "deferred",
		specialistCategory: "security",
		confidenceScore: 50.5,
		evaluatedAt: "2026-06-06T15:02:00.000Z",
		safeNextActions: ["flowdesk-status"],
	});
	assert.equal(nonInteger.ok, false);
	assert.match(nonInteger.errors.join("; "), /confidence_score/);

	// blocked decision without blocking_labels → inconsistency
	const blockedNoLabels = createFlowDeskSpecialistWorkflowEligibilityV1({
		eligibilityId: "eligibility-4d",
		workflowId: "workflow-4",
		taskSignatureRef: "task-sig-4d",
		eligibilityDecision: "blocked",
		specialistCategory: "unknown",
		confidenceScore: 0,
		blockingLabels: [],  // empty — must be rejected
		evaluatedAt: "2026-06-06T15:03:00.000Z",
		safeNextActions: ["flowdesk-status"],
	});
	assert.equal(blockedNoLabels.ok, false);
	assert.match(blockedNoLabels.errors.join("; "), /blocking_labels.*non-empty|non-empty.*blocking_labels|blocked/);

	// Validator also detects blocked-without-label on a mutated valid blocked record
	const validBlocked = createFlowDeskSpecialistWorkflowEligibilityV1({
		eligibilityId: "eligibility-4e",
		workflowId: "workflow-4",
		taskSignatureRef: "task-sig-4e",
		eligibilityDecision: "blocked",
		specialistCategory: "compliance",
		confidenceScore: 10,
		blockingLabels: ["policy-gate-not-satisfied"],
		evaluatedAt: "2026-06-06T15:04:00.000Z",
		safeNextActions: ["flowdesk-status"],
	});
	assert.equal(validBlocked.ok, true);

	// Mutate: clear blocking_labels while keeping decision=blocked
	const mutated = validateFlowDeskSpecialistWorkflowEligibilityV1({
		...validBlocked.eligibility,
		blocking_labels: [],
	});
	assert.equal(mutated.ok, false);
	assert.match(mutated.errors.join("; "), /blocking_labels.*non-empty|non-empty.*blocking_labels|blocked/);

	// Unknown eligibility_decision
	const badDecision = createFlowDeskSpecialistWorkflowEligibilityV1({
		eligibilityId: "eligibility-4f",
		workflowId: "workflow-4",
		taskSignatureRef: "task-sig-4f",
		eligibilityDecision: "approved" as "eligible",
		specialistCategory: "security",
		confidenceScore: 50,
		evaluatedAt: "2026-06-06T15:05:00.000Z",
		safeNextActions: ["flowdesk-status"],
	});
	assert.equal(badDecision.ok, false);
	assert.match(badDecision.errors.join("; "), /eligibility_decision/);

	// Unknown specialist_category
	const badCategory = createFlowDeskSpecialistWorkflowEligibilityV1({
		eligibilityId: "eligibility-4g",
		workflowId: "workflow-4",
		taskSignatureRef: "task-sig-4g",
		eligibilityDecision: "eligible",
		specialistCategory: "finance" as "security",
		confidenceScore: 50,
		evaluatedAt: "2026-06-06T15:06:00.000Z",
		safeNextActions: ["flowdesk-status"],
	});
	assert.equal(badCategory.ok, false);
	assert.match(badCategory.errors.join("; "), /specialist_category/);
});

// ─── P7-S13: MCP Connector Advisory tests ───────────────────────────────────

test("MCP connector advisory: valid enabled and disabled states", () => {
	// Enabled tool connector
	const enabled = createFlowDeskMCPConnectorAdvisoryV1({
		advisoryId: "mcp-advisory-enabled-1",
		connectorId: "connector-filesystem-tool-1",
		connectorKind: "tool",
		connectorState: "enabled",
		stateReasonRefs: ["reason-connector-enabled-1"],
		observedAt: "2026-06-06T12:00:00.000Z",
		safeNextActions: ["flowdesk-status"],
	});
	assert.equal(enabled.ok, true, enabled.errors.join("; "));
	const a = enabled.advisory as FlowDeskMCPConnectorAdvisoryV1;
	assert.equal(a.schema_version, "flowdesk.mcp_connector_advisory.v1");
	assert.equal(a.advisory_id, "mcp-advisory-enabled-1");
	assert.equal(a.connector_id, "connector-filesystem-tool-1");
	assert.equal(a.connector_kind, "tool");
	assert.equal(a.connector_state, "enabled");
	assert.deepEqual(a.state_reason_refs, ["reason-connector-enabled-1"]);
	assert.equal(a.advisory_only, true);
	assert.equal(a.non_authorizing, true);
	assert.equal(a.connector_execution_authority_enabled, false);
	assert.equal(a.dispatch_authority_enabled, false);
	assert.equal(a.provider_authority_enabled, false);
	assert.equal(a.runtime_authority_enabled, false);
	assert.equal(a.external_write_authority_enabled, false);
	assert.equal(a.fallback_authority_enabled, false);
	assert.equal(a.lane_launch_authority_enabled, false);
	assert.equal(a.write_authority_enabled, false);
	assert.equal(a.hard_chat_authority_enabled, false);
	// Round-trip through validator
	assert.equal(validateFlowDeskMCPConnectorAdvisoryV1(a).ok, true);

	// Disabled resource connector (no stateReasonRefs)
	const disabled = createFlowDeskMCPConnectorAdvisoryV1({
		advisoryId: "mcp-advisory-disabled-1",
		connectorId: "connector-github-resource-1",
		connectorKind: "resource",
		connectorState: "disabled",
		observedAt: "2026-06-06T12:01:00.000Z",
		safeNextActions: ["flowdesk-doctor", "flowdesk-status"],
	});
	assert.equal(disabled.ok, true, disabled.errors.join("; "));
	const d = disabled.advisory as FlowDeskMCPConnectorAdvisoryV1;
	assert.equal(d.connector_state, "disabled");
	assert.equal(d.connector_kind, "resource");
	assert.deepEqual(d.state_reason_refs, []);
	assert.equal(validateFlowDeskMCPConnectorAdvisoryV1(d).ok, true);
});

test("MCP connector advisory: valid degraded state with multiple reason refs", () => {
	const degraded = createFlowDeskMCPConnectorAdvisoryV1({
		advisoryId: "mcp-advisory-degraded-1",
		connectorId: "connector-search-prompt-1",
		connectorKind: "prompt",
		connectorState: "degraded",
		stateReasonRefs: ["reason-timeout-1", "reason-partial-response-1"],
		observedAt: "2026-06-06T12:02:00.000Z",
		safeNextActions: ["flowdesk-status", "flowdesk-doctor"],
	});
	assert.equal(degraded.ok, true, degraded.errors.join("; "));
	const a = degraded.advisory as FlowDeskMCPConnectorAdvisoryV1;
	assert.equal(a.connector_state, "degraded");
	assert.equal(a.connector_kind, "prompt");
	assert.deepEqual(a.state_reason_refs, ["reason-timeout-1", "reason-partial-response-1"]);
	assert.equal(validateFlowDeskMCPConnectorAdvisoryV1(a).ok, true);

	// unknown kind + unavailable state
	const unavailable = createFlowDeskMCPConnectorAdvisoryV1({
		advisoryId: "mcp-advisory-unavail-1",
		connectorId: "connector-unknown-1",
		connectorKind: "unknown",
		connectorState: "unavailable",
		stateReasonRefs: ["reason-not-installed-1"],
		observedAt: "2026-06-06T12:03:00.000Z",
		safeNextActions: ["flowdesk-status"],
	});
	assert.equal(unavailable.ok, true, unavailable.errors.join("; "));
	const u = unavailable.advisory as FlowDeskMCPConnectorAdvisoryV1;
	assert.equal(u.connector_kind, "unknown");
	assert.equal(u.connector_state, "unavailable");
	assert.equal(validateFlowDeskMCPConnectorAdvisoryV1(u).ok, true);
});

test("MCP connector advisory: authority smuggling rejection including connector_execution_authority_enabled", () => {
	const result = createFlowDeskMCPConnectorAdvisoryV1({
		advisoryId: "mcp-advisory-auth-1",
		connectorId: "connector-auth-test-1",
		connectorKind: "tool",
		connectorState: "enabled",
		observedAt: "2026-06-06T12:04:00.000Z",
		safeNextActions: ["flowdesk-status"],
	});
	assert.equal(result.ok, true);
	const a = result.advisory as FlowDeskMCPConnectorAdvisoryV1;

	// connector_execution_authority_enabled smuggling (the primary guard for this schema)
	const forgedExec = validateFlowDeskMCPConnectorAdvisoryV1({ ...a, connector_execution_authority_enabled: true });
	assert.equal(forgedExec.ok, false);
	assert.match(forgedExec.errors.join("; "), /connector-execution|advisory-only non-authorizing/);

	// dispatch authority smuggling
	const forgedDispatch = validateFlowDeskMCPConnectorAdvisoryV1({ ...a, dispatch_authority_enabled: true });
	assert.equal(forgedDispatch.ok, false);
	assert.match(forgedDispatch.errors.join("; "), /advisory-only non-authorizing/);

	// runtime authority smuggling
	const forgedRuntime = validateFlowDeskMCPConnectorAdvisoryV1({ ...a, runtime_authority_enabled: true });
	assert.equal(forgedRuntime.ok, false);
	assert.match(forgedRuntime.errors.join("; "), /advisory-only non-authorizing/);

	// non_authorizing stripped
	const strippedNonAuth = validateFlowDeskMCPConnectorAdvisoryV1({ ...a, non_authorizing: false as true });
	assert.equal(strippedNonAuth.ok, false);
	assert.match(strippedNonAuth.errors.join("; "), /advisory-only non-authorizing/);

	// Unknown property injection
	const unknown = validateFlowDeskMCPConnectorAdvisoryV1({ ...a, providerCall: true });
	assert.equal(unknown.ok, false);
	assert.match(unknown.errors.join("; "), /unknown properties/);
});

test("MCP connector advisory: invalid connector_kind and connector_state rejection", () => {
	// Invalid connector_kind
	const badKind = createFlowDeskMCPConnectorAdvisoryV1({
		advisoryId: "mcp-advisory-kind-1",
		connectorId: "connector-kind-test-1",
		connectorKind: "database" as "tool",
		connectorState: "enabled",
		observedAt: "2026-06-06T12:05:00.000Z",
		safeNextActions: ["flowdesk-status"],
	});
	assert.equal(badKind.ok, false);
	assert.match(badKind.errors.join("; "), /connector_kind.*tool.*resource.*prompt.*unknown/);

	// Invalid connector_state
	const badState = createFlowDeskMCPConnectorAdvisoryV1({
		advisoryId: "mcp-advisory-state-1",
		connectorId: "connector-state-test-1",
		connectorKind: "tool",
		connectorState: "error" as "enabled",
		observedAt: "2026-06-06T12:06:00.000Z",
		safeNextActions: ["flowdesk-status"],
	});
	assert.equal(badState.ok, false);
	assert.match(badState.errors.join("; "), /connector_state.*enabled.*disabled.*unavailable.*degraded/);

	// Validator also rejects invalid kind/state
	const validResult = createFlowDeskMCPConnectorAdvisoryV1({
		advisoryId: "mcp-advisory-valid-kind-1",
		connectorId: "connector-valid-1",
		connectorKind: "tool",
		connectorState: "enabled",
		observedAt: "2026-06-06T12:07:00.000Z",
		safeNextActions: ["flowdesk-status"],
	});
	assert.equal(validResult.ok, true);
	const badKindViaDirect = validateFlowDeskMCPConnectorAdvisoryV1({ ...validResult.advisory, connector_kind: "network" });
	assert.equal(badKindViaDirect.ok, false);
	assert.match(badKindViaDirect.errors.join("; "), /connector_kind/);

	const badStateViaDirect = validateFlowDeskMCPConnectorAdvisoryV1({ ...validResult.advisory, connector_state: "active" });
	assert.equal(badStateViaDirect.ok, false);
	assert.match(badStateViaDirect.errors.join("; "), /connector_state/);
});

test("MCP connector advisory: malformed ref and raw marker rejection", () => {
	// Malformed advisory_id (raw path marker)
	const rawAdvisoryId = createFlowDeskMCPConnectorAdvisoryV1({
		advisoryId: "/Users/foo/advisory",
		connectorId: "connector-ref-test-1",
		connectorKind: "tool",
		connectorState: "enabled",
		observedAt: "2026-06-06T12:08:00.000Z",
		safeNextActions: ["flowdesk-status"],
	});
	assert.equal(rawAdvisoryId.ok, false);
	assert.match(rawAdvisoryId.errors.join("; "), /schema-safe|raw path marker|traversal/);

	// Malformed connector_id (raw path marker)
	const rawConnectorId = createFlowDeskMCPConnectorAdvisoryV1({
		advisoryId: "mcp-advisory-ref-test-2",
		connectorId: "../connectors/secret",
		connectorKind: "resource",
		connectorState: "enabled",
		observedAt: "2026-06-06T12:09:00.000Z",
		safeNextActions: ["flowdesk-status"],
	});
	assert.equal(rawConnectorId.ok, false);
	assert.match(rawConnectorId.errors.join("; "), /schema-safe|traversal/);

	// Malformed state_reason_ref (contains spaces / raw marker)
	const rawReasonRef = createFlowDeskMCPConnectorAdvisoryV1({
		advisoryId: "mcp-advisory-ref-test-3",
		connectorId: "connector-ref-test-3",
		connectorKind: "tool",
		connectorState: "degraded",
		stateReasonRefs: ["reason with spaces in it"],
		observedAt: "2026-06-06T12:10:00.000Z",
		safeNextActions: ["flowdesk-status"],
	});
	assert.equal(rawReasonRef.ok, false);
	assert.match(rawReasonRef.errors.join("; "), /schema-safe|spaces/);

	// Over-limit state_reason_refs (6 entries, max 5)
	const tooManyRefs = createFlowDeskMCPConnectorAdvisoryV1({
		advisoryId: "mcp-advisory-ref-test-4",
		connectorId: "connector-ref-test-4",
		connectorKind: "tool",
		connectorState: "degraded",
		stateReasonRefs: Array.from({ length: 6 }, (_, i) => `reason-${i + 1}`),
		observedAt: "2026-06-06T12:11:00.000Z",
		safeNextActions: ["flowdesk-status"],
	});
	assert.equal(tooManyRefs.ok, false);
	assert.match(tooManyRefs.errors.join("; "), /state_reason_refs.*bounded|0\.\.5/);

	// Non-object inputs rejected by validator
	assert.equal(validateFlowDeskMCPConnectorAdvisoryV1(null).ok, false);
	assert.equal(validateFlowDeskMCPConnectorAdvisoryV1(42).ok, false);
	assert.equal(validateFlowDeskMCPConnectorAdvisoryV1([]).ok, false);
});

// ─── P7-S13.6a: OI Advisory Envelope + Health Label Taxonomy tests ────────────

test("OI advisory envelope: valid envelope creation and round-trip", () => {
	const envelope: FlowDeskOIAdvisoryEnvelopeV1 = {
		advisory_only: true,
		non_authorizing: true,
		routing_decision_changed: false,
		dispatch_authority_enabled: false,
		fallback_authority_enabled: false,
		provider_call_made: false,
		runtime_execution_attempted: false,
		write_authority_enabled: false,
		source_evidence_refs: ["evidence-ref-1", "evidence-ref-2"],
		generated_at: "2026-06-07T00:00:00.000Z",
		generation_status: "complete",
	};
	const result = validateFlowDeskOIAdvisoryEnvelopeV1(envelope);
	assert.equal(result.ok, true, result.errors.join("; "));

	// Partial generation_status also valid
	const partial: FlowDeskOIAdvisoryEnvelopeV1 = { ...envelope, generation_status: "partial" };
	assert.equal(validateFlowDeskOIAdvisoryEnvelopeV1(partial).ok, true);

	// Empty source_evidence_refs is allowed
	const noRefs: FlowDeskOIAdvisoryEnvelopeV1 = { ...envelope, source_evidence_refs: [] };
	assert.equal(validateFlowDeskOIAdvisoryEnvelopeV1(noRefs).ok, true);

	// Non-object inputs rejected
	assert.equal(validateFlowDeskOIAdvisoryEnvelopeV1(null).ok, false);
	assert.equal(validateFlowDeskOIAdvisoryEnvelopeV1(42).ok, false);
	assert.equal(validateFlowDeskOIAdvisoryEnvelopeV1("string").ok, false);
});

test("OI advisory health label taxonomy: all 7 values are valid, invalid values rejected", () => {
	// All 7 valid values as FlowDeskOIAdvisoryHealthLabelV1
	const validLabels: FlowDeskOIAdvisoryHealthLabelV1[] = [
		"healthy",
		"degraded",
		"stale",
		"unknown",
		"disabled_by_config",
		"missing_source_evidence",
		"partial",
	];
	// Verify the union type accepts all 7 values (compile-time check via array assignment)
	assert.equal(validLabels.length, 7);

	// OI session summary accepts the 3 new labels
	for (const label of ["disabled_by_config", "missing_source_evidence", "partial"] as const) {
		const result = createFlowDeskOISessionSummaryV1({
			summaryId: `oi-summary-label-${label}`,
			sessionRef: "ses-label-test-1",
			workflowId: `workflow-oi-label-${label}`,
			proposalsScored: 0,
			reuseGatesChecked: 0,
			fanoutGatesEvaluated: 0,
			ledgerEntriesTotal: 0,
			advisoryHealthLabel: label,
			capturedAt: "2026-06-07T00:00:00.000Z",
			safeNextActions: ["flowdesk-status"],
		});
		assert.equal(result.ok, true, `label '${label}' should be accepted: ${result.errors.join("; ")}`);
		assert.equal(result.summary?.advisory_health_label, label);
	}

	// Invalid label values still rejected
	const badLabel = createFlowDeskOISessionSummaryV1({
		summaryId: "oi-summary-bad-label",
		sessionRef: "ses-bad-label",
		workflowId: "workflow-bad-label",
		proposalsScored: 0,
		reuseGatesChecked: 0,
		fanoutGatesEvaluated: 0,
		ledgerEntriesTotal: 0,
		advisoryHealthLabel: "excellent" as never,
		capturedAt: "2026-06-07T00:01:00.000Z",
		safeNextActions: ["flowdesk-status"],
	});
	assert.equal(badLabel.ok, false);
	assert.match(badLabel.errors.join("; "), /advisory_health_label/);
});

test("OI advisory envelope: authority smuggling rejection", () => {
	const validEnvelope: FlowDeskOIAdvisoryEnvelopeV1 = {
		advisory_only: true,
		non_authorizing: true,
		routing_decision_changed: false,
		dispatch_authority_enabled: false,
		fallback_authority_enabled: false,
		provider_call_made: false,
		runtime_execution_attempted: false,
		write_authority_enabled: false,
		source_evidence_refs: ["evidence-ref-auth-1"],
		generated_at: "2026-06-07T01:00:00.000Z",
		generation_status: "complete",
	};
	assert.equal(validateFlowDeskOIAdvisoryEnvelopeV1(validEnvelope).ok, true);

	// Attempt to smuggle dispatch authority
	const smuggledDispatch = validateFlowDeskOIAdvisoryEnvelopeV1({ ...validEnvelope, dispatch_authority_enabled: true });
	assert.equal(smuggledDispatch.ok, false);
	assert.match(smuggledDispatch.errors.join("; "), /dispatch_authority_enabled.*false|authority smuggling/);

	// Attempt to smuggle fallback authority
	const smuggledFallback = validateFlowDeskOIAdvisoryEnvelopeV1({ ...validEnvelope, fallback_authority_enabled: true });
	assert.equal(smuggledFallback.ok, false);
	assert.match(smuggledFallback.errors.join("; "), /fallback_authority_enabled.*false|authority smuggling/);

	// Attempt to flip advisory_only to false
	const smuggledAdvisory = validateFlowDeskOIAdvisoryEnvelopeV1({ ...validEnvelope, advisory_only: false as true });
	assert.equal(smuggledAdvisory.ok, false);
	assert.match(smuggledAdvisory.errors.join("; "), /advisory_only.*true/);

	// Attempt to set provider_call_made to true
	const smuggledProvider = validateFlowDeskOIAdvisoryEnvelopeV1({ ...validEnvelope, provider_call_made: true as false });
	assert.equal(smuggledProvider.ok, false);
	assert.match(smuggledProvider.errors.join("; "), /provider_call_made.*false|authority smuggling/);

	// Unknown property injection
	const unknownProp = validateFlowDeskOIAdvisoryEnvelopeV1({ ...validEnvelope, runtimeTarget: "openai" });
	assert.equal(unknownProp.ok, false);
	assert.match(unknownProp.errors.join("; "), /unknown properties/);
});

test("OI advisory envelope: invalid generation_status rejection and malformed generated_at rejection", () => {
	const base: FlowDeskOIAdvisoryEnvelopeV1 = {
		advisory_only: true,
		non_authorizing: true,
		routing_decision_changed: false,
		dispatch_authority_enabled: false,
		fallback_authority_enabled: false,
		provider_call_made: false,
		runtime_execution_attempted: false,
		write_authority_enabled: false,
		source_evidence_refs: [],
		generated_at: "2026-06-07T02:00:00.000Z",
		generation_status: "complete",
	};
	assert.equal(validateFlowDeskOIAdvisoryEnvelopeV1(base).ok, true);

	// Invalid generation_status value
	const badStatus = validateFlowDeskOIAdvisoryEnvelopeV1({ ...base, generation_status: "dispatching" as "complete" });
	assert.equal(badStatus.ok, false);
	assert.match(badStatus.errors.join("; "), /generation_status.*complete.*partial.*degraded.*disabled_by_config/);

	// All valid generation_status values are accepted
	for (const status of ["complete", "partial", "degraded", "disabled_by_config"] as const) {
		const result = validateFlowDeskOIAdvisoryEnvelopeV1({ ...base, generation_status: status });
		assert.equal(result.ok, true, `generation_status '${status}' should be valid: ${result.errors.join("; ")}`);
	}

	// Malformed generated_at (not parseable timestamp)
	const badTimestamp = validateFlowDeskOIAdvisoryEnvelopeV1({ ...base, generated_at: "not-a-timestamp" });
	assert.equal(badTimestamp.ok, false);
	assert.match(badTimestamp.errors.join("; "), /generated_at.*parseable|timestamp/);

	// Missing generated_at (undefined)
	const missingTimestamp = validateFlowDeskOIAdvisoryEnvelopeV1({ ...base, generated_at: undefined as unknown as string });
	assert.equal(missingTimestamp.ok, false);
	assert.match(missingTimestamp.errors.join("; "), /generated_at.*parseable|timestamp/);

	// source_evidence_refs with invalid opaque ref (contains spaces)
	const badRef = validateFlowDeskOIAdvisoryEnvelopeV1({ ...base, source_evidence_refs: ["ref with spaces"] });
	assert.equal(badRef.ok, false);
	assert.match(badRef.errors.join("; "), /schema-safe|spaces/);
});

// ─── P7-S14: Minimal OI Scoring Engine tests ─────────────────────────────────

test("scoring engine: valid full input (ok alert) → healthy, score > 70, hard filter passed", () => {
	const result: FlowDeskScoringEngineResultV1 = scoreWorkflowProposal({
		workflowId: "workflow-score-ok-1",
		proposalId: "proposal-score-ok-1",
		candidateRef: "candidate-score-ok-1",
		agentRole: "implementation",
		providerFamily: "claude",
		usageRemainingPercent: 85,
		alertLevel: "ok",
		resetBucketSeconds: 600,
		activeConurrentLanes: 1,
		maxConcurrentLanes: 5,
		requestedLaneCount: 2,
		contextWindowTokens: 200000,
	});
	assert.equal(result.ok, true, result.errors.join("; "));
	assert.equal(result.healthLabel, "healthy");
	assert.ok(result.score !== undefined, "score must be present");
	assert.ok(result.score!.advisory_score > 70, `advisory_score ${result.score!.advisory_score} should be > 70`);
	assert.equal(result.score!.hard_filter_state, "passed");
	assert.equal(result.score!.blocked_labels.length, 0);
	assert.equal(result.score!.advisory_only, true);
	assert.equal(result.score!.dispatch_authority_enabled, false);
	assert.equal(result.score!.provider_authority_enabled, false);
	assert.equal(result.score!.runtime_authority_enabled, false);
	assert.equal(result.score!.fallback_authority_enabled, false);
	assert.equal(result.score!.lane_launch_authority_enabled, false);
	// Validator accepts the produced score
	assert.equal(validateFlowDeskOptimizerProposalScoreV1(result.score!).ok, true);
});

test("scoring engine: exhausted quota → degraded health, hard filter blocked, blocked_labels includes quota_exhausted", () => {
	const result: FlowDeskScoringEngineResultV1 = scoreWorkflowProposal({
		workflowId: "workflow-score-exhausted-1",
		proposalId: "proposal-score-exhausted-1",
		candidateRef: "candidate-score-exhausted-1",
		agentRole: "security",
		providerFamily: "openai",
		usageRemainingPercent: 0,
		alertLevel: "exhausted",
		resetBucketSeconds: 3600,
		activeConurrentLanes: 0,
		maxConcurrentLanes: 5,
		requestedLaneCount: 1,
	});
	assert.equal(result.ok, true, result.errors.join("; "));
	assert.equal(result.healthLabel, "degraded");
	assert.ok(result.score !== undefined, "score must be present");
	assert.equal(result.score!.hard_filter_state, "blocked");
	assert.ok(result.score!.blocked_labels.includes("quota_exhausted"), `blocked_labels should include quota_exhausted, got: ${JSON.stringify(result.score!.blocked_labels)}`);
	// Blocked hard filter zeroes the advisory_score
	assert.equal(result.score!.advisory_score, 0);
	// Validator accepts the produced score
	assert.equal(validateFlowDeskOptimizerProposalScoreV1(result.score!).ok, true);
});

test("scoring engine: minimal inputs → partial health, confidence score <= 60", () => {
	// Only required fields, no optional evidence
	const result: FlowDeskScoringEngineResultV1 = scoreWorkflowProposal({
		workflowId: "workflow-score-minimal-1",
		proposalId: "proposal-score-minimal-1",
		candidateRef: "candidate-score-minimal-1",
		agentRole: "implementation",
		providerFamily: "gemini",
	});
	assert.equal(result.ok, true, result.errors.join("; "));
	assert.equal(result.healthLabel, "partial");
	assert.ok(result.score !== undefined, "score must be present");
	// Confidence dimension should be <= 60 due to minimal inputs
	const confidenceDim = result.score!.score_dimensions.find(d => d.dimension === "confidence");
	assert.ok(confidenceDim !== undefined, "confidence dimension must exist");
	assert.ok(confidenceDim!.score <= 60, `confidence score ${confidenceDim!.score} should be <= 60 for minimal inputs`);
	assert.equal(result.score!.hard_filter_state, "passed");
	// Validator accepts the produced score
	assert.equal(validateFlowDeskOptimizerProposalScoreV1(result.score!).ok, true);
});

test("scoring engine: critical quota → cost dimension < 50", () => {
	const result: FlowDeskScoringEngineResultV1 = scoreWorkflowProposal({
		workflowId: "workflow-score-critical-1",
		proposalId: "proposal-score-critical-1",
		candidateRef: "candidate-score-critical-1",
		agentRole: "architecture",
		providerFamily: "claude",
		usageRemainingPercent: 10,
		alertLevel: "critical",
		resetBucketSeconds: 1800,
	});
	assert.equal(result.ok, true, result.errors.join("; "));
	assert.ok(result.score !== undefined, "score must be present");
	const costDim = result.score!.score_dimensions.find(d => d.dimension === "cost");
	assert.ok(costDim !== undefined, "cost dimension must exist");
	assert.ok(costDim!.score < 50, `cost score ${costDim!.score} should be < 50 for critical quota`);
	// Hard filter should still pass for critical (only exhausted blocks)
	assert.equal(result.score!.hard_filter_state, "passed");
	// Validator accepts the produced score
	assert.equal(validateFlowDeskOptimizerProposalScoreV1(result.score!).ok, true);
});

test("scoring engine: invalid workflowId → ok:false with errors", () => {
	const result: FlowDeskScoringEngineResultV1 = scoreWorkflowProposal({
		workflowId: "",  // invalid: empty string
		proposalId: "proposal-score-invalid-1",
		candidateRef: "candidate-score-invalid-1",
		agentRole: "implementation",
		providerFamily: "claude",
	});
	assert.equal(result.ok, false);
	assert.ok(result.errors.length > 0, "errors must be non-empty");
	assert.equal(result.score, undefined);
	// healthLabel should still be returned (unknown on error)
	assert.equal(result.healthLabel, "unknown");
});

// ─── P8-S4: Federated registry connector gate evaluator tests ─────────────────

test("federated gate evaluator: gate_satisfied is always false with minimal inputs", () => {
	const result: FlowDeskFederatedGateEvaluationResultV1 = evaluateFlowDeskFederatedRegistryConnectorGateV1({
		workflowId: "workflow-gate-1",
		attemptId: "attempt-gate-1",
	});
	// Structural: gate_satisfied is always false
	assert.equal(result.gate_satisfied, false, "gate_satisfied must always be false");
	// Required literals
	assert.equal(result.advisory_only, true);
	assert.equal(result.non_authorizing, true);
	assert.equal(result.connector_gate_promotion_authorized, false);
	assert.equal(result.remote_write_authority_enabled, false);
	assert.equal(result.dispatch_authority_enabled, false);
	// schema_version
	assert.equal(result.schema_version, "flowdesk.federated_gate_evaluation.v1");
	// Validator accepts the result
	assert.equal(validateFlowDeskFederatedGateEvaluationResultV1(result).ok, true);
});

test("federated gate evaluator: gate_satisfied is always false even with all refs present", () => {
	const result: FlowDeskFederatedGateEvaluationResultV1 = evaluateFlowDeskFederatedRegistryConnectorGateV1({
		workflowId: "workflow-gate-full-1",
		attemptId: "attempt-gate-full-1",
		capabilityDescriptorRef: "capability-descriptor-ref-1",
		intentRef: "intent-ref-1",
		threatModelDocRef: "threat-model-doc-ref-1",
		privacyReviewRef: "privacy-review-ref-1",
		securityAuditRef: "security-audit-ref-1",
	});
	// Even with all refs supplied, gate_satisfied must still be false
	assert.equal(result.gate_satisfied, false, "gate_satisfied must always be false even with all refs");
	assert.equal(result.connector_gate_promotion_authorized, false);
	assert.equal(result.remote_write_authority_enabled, false);
	assert.equal(result.dispatch_authority_enabled, false);
	// Validator must accept
	assert.equal(validateFlowDeskFederatedGateEvaluationResultV1(result).ok, true);
});

test("federated gate evaluator: redacted_block_reasons always includes connector_gate_promotion_not_yet_authorized", () => {
	// Test with minimal input
	const minimal = evaluateFlowDeskFederatedRegistryConnectorGateV1({
		workflowId: "workflow-gate-reasons-1",
		attemptId: "attempt-gate-reasons-1",
	});
	assert.ok(
		minimal.redacted_block_reasons.includes("connector_gate_promotion_not_yet_authorized"),
		"redacted_block_reasons must always include connector_gate_promotion_not_yet_authorized"
	);
	// Test with all refs — still present
	const full = evaluateFlowDeskFederatedRegistryConnectorGateV1({
		workflowId: "workflow-gate-reasons-2",
		attemptId: "attempt-gate-reasons-2",
		privacyReviewRef: "privacy-ref-1",
		securityAuditRef: "security-ref-1",
		capabilityDescriptorRef: "capability-ref-1",
	});
	assert.ok(
		full.redacted_block_reasons.includes("connector_gate_promotion_not_yet_authorized"),
		"redacted_block_reasons must always include connector_gate_promotion_not_yet_authorized even with all refs"
	);
	// missing_evidence_labels always includes the capability label
	assert.ok(
		minimal.missing_evidence_labels.includes("flowdesk.federated_registry_connector_capability.v1"),
		"missing_evidence_labels must always include flowdesk.federated_registry_connector_capability.v1"
	);
});

test("federated gate evaluator: privacy_review_evidence_missing appears when privacyReviewRef absent", () => {
	const withoutPrivacy = evaluateFlowDeskFederatedRegistryConnectorGateV1({
		workflowId: "workflow-gate-privacy-1",
		attemptId: "attempt-gate-privacy-1",
		// privacyReviewRef intentionally absent
	});
	assert.ok(
		withoutPrivacy.redacted_block_reasons.includes("privacy_review_evidence_missing"),
		"privacy_review_evidence_missing must be present when privacyReviewRef is absent"
	);
	assert.ok(
		withoutPrivacy.missing_evidence_labels.includes("privacy_review_record"),
		"missing_evidence_labels must include privacy_review_record when privacyReviewRef absent"
	);
	// When present, privacy_review_evidence_missing should NOT appear
	const withPrivacy = evaluateFlowDeskFederatedRegistryConnectorGateV1({
		workflowId: "workflow-gate-privacy-2",
		attemptId: "attempt-gate-privacy-2",
		privacyReviewRef: "privacy-review-ref-1",
	});
	assert.ok(
		!withPrivacy.redacted_block_reasons.includes("privacy_review_evidence_missing"),
		"privacy_review_evidence_missing must NOT appear when privacyReviewRef is present"
	);
	assert.ok(
		!withPrivacy.missing_evidence_labels.includes("privacy_review_record"),
		"privacy_review_record must NOT appear in missing_evidence_labels when privacyReviewRef is present"
	);
});

test("federated gate evaluator: security_audit_evidence_missing appears when securityAuditRef absent", () => {
	const withoutAudit = evaluateFlowDeskFederatedRegistryConnectorGateV1({
		workflowId: "workflow-gate-audit-1",
		attemptId: "attempt-gate-audit-1",
		// securityAuditRef intentionally absent
	});
	assert.ok(
		withoutAudit.redacted_block_reasons.includes("security_audit_evidence_missing"),
		"security_audit_evidence_missing must be present when securityAuditRef is absent"
	);
	assert.ok(
		withoutAudit.missing_evidence_labels.includes("security_audit_record"),
		"missing_evidence_labels must include security_audit_record when securityAuditRef absent"
	);
	// When present, security_audit_evidence_missing should NOT appear
	const withAudit = evaluateFlowDeskFederatedRegistryConnectorGateV1({
		workflowId: "workflow-gate-audit-2",
		attemptId: "attempt-gate-audit-2",
		securityAuditRef: "security-audit-ref-1",
	});
	assert.ok(
		!withAudit.redacted_block_reasons.includes("security_audit_evidence_missing"),
		"security_audit_evidence_missing must NOT appear when securityAuditRef is present"
	);
	assert.ok(
		!withAudit.missing_evidence_labels.includes("security_audit_record"),
		"security_audit_record must NOT appear in missing_evidence_labels when securityAuditRef is present"
	);
});

test("federated gate evaluator: authority smuggling rejected by schema validator", () => {
	const result = evaluateFlowDeskFederatedRegistryConnectorGateV1({
		workflowId: "workflow-gate-smuggling-1",
		attemptId: "attempt-gate-smuggling-1",
	});

	// Validator rejects gate_satisfied set to true
	const forgedGateSatisfied = validateFlowDeskFederatedGateEvaluationResultV1({
		...result,
		gate_satisfied: true,
	});
	assert.equal(forgedGateSatisfied.ok, false);
	assert.ok(
		forgedGateSatisfied.errors.some((e) => /gate_satisfied.*false/.test(e) || /authority smuggling/.test(e)),
		`Expected gate_satisfied authority error, got: ${forgedGateSatisfied.errors.join("; ")}`
	);

	// Validator rejects connector_gate_promotion_authorized set to true
	const forgedPromotion = validateFlowDeskFederatedGateEvaluationResultV1({
		...result,
		connector_gate_promotion_authorized: true,
	});
	assert.equal(forgedPromotion.ok, false);
	assert.ok(
		forgedPromotion.errors.some((e) => /connector_gate_promotion_authorized.*false/.test(e) || /authority smuggling/.test(e)),
		`Expected connector_gate_promotion_authorized authority error, got: ${forgedPromotion.errors.join("; ")}`
	);

	// Validator rejects dispatch_authority_enabled set to true
	const forgedDispatch = validateFlowDeskFederatedGateEvaluationResultV1({
		...result,
		dispatch_authority_enabled: true,
	});
	assert.equal(forgedDispatch.ok, false);
	assert.ok(
		forgedDispatch.errors.some((e) => /dispatch_authority_enabled.*false/.test(e) || /authority smuggling/.test(e)),
		`Expected dispatch_authority_enabled authority error, got: ${forgedDispatch.errors.join("; ")}`
	);

	// Validator rejects remote_write_authority_enabled set to true
	const forgedRemoteWrite = validateFlowDeskFederatedGateEvaluationResultV1({
		...result,
		remote_write_authority_enabled: true,
	});
	assert.equal(forgedRemoteWrite.ok, false);
	assert.ok(
		forgedRemoteWrite.errors.some((e) => /remote_write_authority_enabled.*false/.test(e) || /authority smuggling/.test(e)),
		`Expected remote_write_authority_enabled authority error, got: ${forgedRemoteWrite.errors.join("; ")}`
	);
});

// ─── P8-S3: FlowDeskFederatedRegistryConnectorCapabilityV1 tests ──────────────

const validCapabilityInput = {
	capabilityDescriptorId: "cap-desc-1",
	capabilityRef: "cap-ref-1",
	connectorKind: "github_issue" as const,
	connectorProfileRef: "profile-ref-1",
	registryRef: "registry-ref-1",
	authScopeRef: "auth-scope-1",
	targetKind: "github_issue" as const,
	toolRef: "tool-ref-1",
	capabilityState: "available" as const,
	contentFormatRef: "format-ref-1",
	dryRunSupported: true,
	discoveredAt: "2026-06-07T00:00:00.000Z",
};

test("P8-S3 connector capability: valid available state → connector_gate_satisfiable=true", () => {
	const result = createFlowDeskFederatedRegistryConnectorCapabilityV1(validCapabilityInput);
	assert.equal(result.ok, true, result.errors.join("; "));
	assert.ok(result.capability !== undefined);
	assert.equal(result.capability!.capability_state, "available");
	assert.equal(result.capability!.connector_gate_satisfiable, true);
	assert.equal(result.capability!.dry_run_supported, true);
	assert.equal(result.capability!.remote_write_blocked_by_default, true);
	assert.equal(result.capability!.remote_write_authority_enabled, false);
	assert.equal(result.capability!.dispatch_authority_enabled, false);
	assert.equal(result.capability!.providerCall, false);
	assert.equal(result.capability!.actualLaneLaunch, false);
	assert.equal(result.capability!.runtimeExecution, false);
	// Validate round-trip
	const validation = validateFlowDeskFederatedRegistryConnectorCapabilityV1(result.capability!);
	assert.equal(validation.ok, true, validation.errors.join("; "));
});

test("P8-S3 connector capability: missing_tools state → connector_gate_satisfiable=false", () => {
	const result = createFlowDeskFederatedRegistryConnectorCapabilityV1({
		...validCapabilityInput,
		capabilityDescriptorId: "cap-desc-missing-1",
		capabilityState: "missing_tools",
	});
	assert.equal(result.ok, true, result.errors.join("; "));
	assert.equal(result.capability!.capability_state, "missing_tools");
	assert.equal(result.capability!.connector_gate_satisfiable, false);
	const validation = validateFlowDeskFederatedRegistryConnectorCapabilityV1(result.capability!);
	assert.equal(validation.ok, true, validation.errors.join("; "));
});

test("P8-S3 connector capability: auth_missing state → connector_gate_satisfiable=false", () => {
	const result = createFlowDeskFederatedRegistryConnectorCapabilityV1({
		...validCapabilityInput,
		capabilityDescriptorId: "cap-desc-auth-1",
		capabilityState: "auth_missing",
	});
	assert.equal(result.ok, true, result.errors.join("; "));
	assert.equal(result.capability!.connector_gate_satisfiable, false);
	const validation = validateFlowDeskFederatedRegistryConnectorCapabilityV1(result.capability!);
	assert.equal(validation.ok, true, validation.errors.join("; "));
});

test("P8-S3 connector capability: blocked state → connector_gate_satisfiable=false", () => {
	const result = createFlowDeskFederatedRegistryConnectorCapabilityV1({
		...validCapabilityInput,
		capabilityDescriptorId: "cap-desc-blocked-1",
		capabilityState: "blocked",
	});
	assert.equal(result.ok, true, result.errors.join("; "));
	assert.equal(result.capability!.connector_gate_satisfiable, false);
	const validation = validateFlowDeskFederatedRegistryConnectorCapabilityV1(result.capability!);
	assert.equal(validation.ok, true, validation.errors.join("; "));
});

test("P8-S3 connector capability: authority smuggling rejection → connector_gate_satisfiable=true with non-available state rejected by validator", () => {
	const created = createFlowDeskFederatedRegistryConnectorCapabilityV1({
		...validCapabilityInput,
		capabilityDescriptorId: "cap-desc-smuggle-1",
		capabilityState: "missing_tools",
	});
	assert.equal(created.ok, true);
	// Attempt to smuggle connector_gate_satisfiable=true for non-available state
	const tampered = { ...created.capability!, connector_gate_satisfiable: true };
	const validation = validateFlowDeskFederatedRegistryConnectorCapabilityV1(tampered);
	assert.equal(validation.ok, false);
	assert.ok(validation.errors.some((e: string) => /connector_gate_satisfiable.*false|not available/i.test(e)),
		`Expected connector_gate_satisfiable error, got: ${validation.errors.join("; ")}`);
});

test("P8-S3 connector capability: authority flag smuggling dispatch_authority_enabled=true → rejected", () => {
	const created = createFlowDeskFederatedRegistryConnectorCapabilityV1(validCapabilityInput);
	assert.equal(created.ok, true);
	const tampered = { ...created.capability!, dispatch_authority_enabled: true as unknown as false };
	const validation = validateFlowDeskFederatedRegistryConnectorCapabilityV1(tampered);
	assert.equal(validation.ok, false);
	assert.ok(validation.errors.some((e: string) => /dispatch_authority_enabled.*false|authority smuggling/i.test(e)),
		`Expected dispatch authority error, got: ${validation.errors.join("; ")}`);
});

test("P8-S3 connector capability: github_pr_comment kind → valid", () => {
	const result = createFlowDeskFederatedRegistryConnectorCapabilityV1({
		...validCapabilityInput,
		capabilityDescriptorId: "cap-desc-pr-1",
		connectorKind: "github_pr_comment",
		targetKind: "github_pr_comment",
	});
	assert.equal(result.ok, true, result.errors.join("; "));
	assert.equal(result.capability!.connector_kind, "github_pr_comment");
	const validation = validateFlowDeskFederatedRegistryConnectorCapabilityV1(result.capability!);
	assert.equal(validation.ok, true, validation.errors.join("; "));
});

test("P8-S3 connector capability: invalid connector_kind (http_endpoint) → rejected", () => {
	const result = createFlowDeskFederatedRegistryConnectorCapabilityV1({
		...validCapabilityInput,
		capabilityDescriptorId: "cap-desc-bad-kind-1",
		connectorKind: "http_endpoint" as unknown as "github_issue",
	});
	assert.equal(result.ok, false);
	assert.ok(result.errors.some((e: string) => /connector_kind/i.test(e)));
});

// ─── P8-S3: FlowDeskFederatedRegistryPublicationPreflightV1 tests ─────────────

const validPreflightInput = {
	preflightId: "preflight-1",
	publicationIntentRef: "pub-intent-ref-1",
	capabilityDescriptorRef: "cap-desc-ref-1",
	workflowId: "workflow-pf-1",
	attemptId: "attempt-pf-1",
	registryRef: "registry-ref-pf-1",
	connectorKind: "github_issue" as const,
	targetRef: "target-ref-pf-1",
	contentHashRef: "sha256-0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef",
	redactionPolicyRef: "redaction-policy-1",
	authScopeRef: "auth-scope-pf-1",
	contentFormatRef: "format-ref-pf-1",
	idempotencyKeyRef: "idempotency-key-1",
	preWriteAuditRef: "pre-write-audit-1",
	preflightState: "preflight_passed" as const,
	blockedLabels: [] as string[],
	createdAt: "2026-06-07T00:00:00.000Z",
};

test("P8-S3 preflight: valid preflight_passed state", () => {
	const result = createFlowDeskFederatedRegistryPublicationPreflightV1(validPreflightInput);
	assert.equal(result.ok, true, result.errors.join("; "));
	assert.ok(result.preflight !== undefined);
	assert.equal(result.preflight!.preflight_state, "preflight_passed");
	assert.equal(result.preflight!.connector_gate_satisfied, false);
	assert.equal(result.preflight!.remote_write_blocked_by_default, true);
	assert.equal(result.preflight!.remote_write_attempted, false);
	assert.equal(result.preflight!.preflight_only, true);
	assert.equal(result.preflight!.non_authorizing, true);
	assert.equal(result.preflight!.advisory_only, true);
	assert.equal(result.preflight!.dry_run_required, true);
	assert.equal(result.preflight!.dispatch_authority_enabled, false);
	assert.equal(result.preflight!.providerCall, false);
	assert.equal(result.preflight!.actualLaneLaunch, false);
	assert.equal(result.preflight!.runtimeExecution, false);
	const validation = validateFlowDeskFederatedRegistryPublicationPreflightV1(result.preflight!);
	assert.equal(validation.ok, true, validation.errors.join("; "));
});

test("P8-S3 preflight: blocked state with blocked_labels", () => {
	const result = createFlowDeskFederatedRegistryPublicationPreflightV1({
		...validPreflightInput,
		preflightId: "preflight-blocked-1",
		preflightState: "blocked",
		blockedLabels: ["connector-gate-not-satisfied", "dry-run-required"],
	});
	assert.equal(result.ok, true, result.errors.join("; "));
	assert.equal(result.preflight!.preflight_state, "blocked");
	assert.ok(result.preflight!.blocked_labels.length > 0);
	const validation = validateFlowDeskFederatedRegistryPublicationPreflightV1(result.preflight!);
	assert.equal(validation.ok, true, validation.errors.join("; "));
});

test("P8-S3 preflight: blocked state with empty blocked_labels → rejected", () => {
	const result = createFlowDeskFederatedRegistryPublicationPreflightV1({
		...validPreflightInput,
		preflightId: "preflight-bad-1",
		preflightState: "blocked",
		blockedLabels: [],
	});
	assert.equal(result.ok, false);
	assert.ok(result.errors.some((e: string) => /blocked.*blocked_labels|blocked_labels.*blocked/i.test(e)),
		`Expected blocked_labels error, got: ${result.errors.join("; ")}`);
});

test("P8-S3 preflight: hash-prefixed content_hash_ref valid", () => {
	const result = createFlowDeskFederatedRegistryPublicationPreflightV1({
		...validPreflightInput,
		preflightId: "preflight-hash-1",
		contentHashRef: "hash-content-abc123",
	});
	assert.equal(result.ok, true, result.errors.join("; "));
	const validation = validateFlowDeskFederatedRegistryPublicationPreflightV1(result.preflight!);
	assert.equal(validation.ok, true, validation.errors.join("; "));
});

test("P8-S3 preflight: invalid content_hash_ref (no hash- or sha256- prefix) → rejected", () => {
	const result = createFlowDeskFederatedRegistryPublicationPreflightV1({
		...validPreflightInput,
		preflightId: "preflight-badhash-1",
		contentHashRef: "raw-content-without-prefix",
	});
	assert.equal(result.ok, false);
	assert.ok(result.errors.some((e: string) => /content_hash_ref/i.test(e)),
		`Expected content_hash_ref error, got: ${result.errors.join("; ")}`);
});

test("P8-S3 preflight: connector_gate_satisfied=true → rejected by validator", () => {
	const created = createFlowDeskFederatedRegistryPublicationPreflightV1(validPreflightInput);
	assert.equal(created.ok, true);
	// Attempt to smuggle connector_gate_satisfied=true
	const tampered = { ...created.preflight!, connector_gate_satisfied: true as unknown as false };
	const validation = validateFlowDeskFederatedRegistryPublicationPreflightV1(tampered);
	assert.equal(validation.ok, false);
	assert.ok(validation.errors.some((e: string) => /connector_gate_satisfied.*false|authority smuggling/i.test(e)),
		`Expected connector_gate_satisfied error, got: ${validation.errors.join("; ")}`);
});

test("P8-S3 preflight: authority flag smuggling providerCall=true → rejected", () => {
	const created = createFlowDeskFederatedRegistryPublicationPreflightV1(validPreflightInput);
	assert.equal(created.ok, true);
	const tampered = { ...created.preflight!, providerCall: true as unknown as false };
	const validation = validateFlowDeskFederatedRegistryPublicationPreflightV1(tampered);
	assert.equal(validation.ok, false);
	assert.ok(validation.errors.some((e: string) => /providerCall.*false|authority smuggling/i.test(e)),
		`Expected providerCall error, got: ${validation.errors.join("; ")}`);
});

test("P8-S3 preflight: unknown property → rejected (closed schema)", () => {
	const created = createFlowDeskFederatedRegistryPublicationPreflightV1(validPreflightInput);
	assert.equal(created.ok, true);
	const withExtra = { ...created.preflight!, extra_unknown_prop: "injected" };
	const validation = validateFlowDeskFederatedRegistryPublicationPreflightV1(withExtra);
	assert.equal(validation.ok, false);
	assert.ok(validation.errors.some(e => /unknown properties/i.test(e)));
});

// ─── P8-S3: FlowDeskGitHubDryRunPublicationResultV1 tests ─────────────────────

const validDryRunInput = {
	dryRunResultId: "dry-run-1",
	preflightRef: "preflight-ref-1",
	writePlanRef: "write-plan-ref-1",
	workflowId: "workflow-dr-1",
	attemptId: "attempt-dr-1",
	connectorKind: "github_issue" as const,
	redactedTargetLabel: "issue #42 in myorg/myrepo",
	redactedContentPreview: "Score summary for workflow workflow-dr-1",
	contentHashRef: "sha256-0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef",
	dryRunState: "dry_run_recorded" as const,
	blockedLabels: [] as string[],
	fakeRemoteWriteAttempted: true,
};

test("P8-S3 dry-run: valid dry_run_recorded state", () => {
	const result = createFlowDeskGitHubDryRunPublicationResultV1(validDryRunInput);
	assert.equal(result.ok, true, result.errors.join("; "));
	assert.ok(result.result !== undefined);
	assert.equal(result.result!.dry_run_state, "dry_run_recorded");
	assert.equal(result.result!.would_produce_ref_shape, "github_url");
	assert.equal(result.result!.remote_write_attempted, false);
	assert.equal(result.result!.github_write_attempted, false);
	assert.equal(result.result!.connector_write_attempted, false);
	assert.equal(result.result!.remote_write_authority_enabled, false);
	assert.equal(result.result!.external_write_authority_enabled, false);
	assert.equal(result.result!.dispatch_authority_enabled, false);
	assert.equal(result.result!.providerCall, false);
	assert.equal(result.result!.actualLaneLaunch, false);
	assert.equal(result.result!.runtimeExecution, false);
	const validation = validateFlowDeskGitHubDryRunPublicationResultV1(result.result!);
	assert.equal(validation.ok, true, validation.errors.join("; "));
});

test("P8-S3 dry-run: blocked state with blocked_labels", () => {
	const result = createFlowDeskGitHubDryRunPublicationResultV1({
		...validDryRunInput,
		dryRunResultId: "dry-run-blocked-1",
		dryRunState: "blocked",
		blockedLabels: ["connector-gate-not-satisfied"],
		fakeRemoteWriteAttempted: false,
	});
	assert.equal(result.ok, true, result.errors.join("; "));
	assert.equal(result.result!.dry_run_state, "blocked");
	assert.ok(result.result!.blocked_labels.length > 0);
	const validation = validateFlowDeskGitHubDryRunPublicationResultV1(result.result!);
	assert.equal(validation.ok, true, validation.errors.join("; "));
});

test("P8-S3 dry-run: raw URL in redacted_target_label → rejected", () => {
	const result = createFlowDeskGitHubDryRunPublicationResultV1({
		...validDryRunInput,
		dryRunResultId: "dry-run-rawurl-1",
		redactedTargetLabel: "https://github.com/myorg/myrepo/issues/42",
	});
	assert.equal(result.ok, false);
	assert.ok(result.errors.some((e: string) => /redacted_target_label.*url|url.*redacted_target_label/i.test(e)),
		`Expected URL rejection error, got: ${result.errors.join("; ")}`);
});

test("P8-S3 dry-run: http URL in redacted_target_label → rejected", () => {
	const result = createFlowDeskGitHubDryRunPublicationResultV1({
		...validDryRunInput,
		dryRunResultId: "dry-run-httpurl-1",
		redactedTargetLabel: "http://github.com/myorg/myrepo/pull/99",
	});
	assert.equal(result.ok, false);
	assert.ok(result.errors.some((e: string) => /redacted_target_label.*url|url.*redacted_target_label/i.test(e)),
		`Expected URL rejection error, got: ${result.errors.join("; ")}`);
});

test("P8-S3 dry-run: authority smuggling dispatch_authority_enabled=true → rejected", () => {
	const created = createFlowDeskGitHubDryRunPublicationResultV1(validDryRunInput);
	assert.equal(created.ok, true);
	const tampered = { ...created.result!, dispatch_authority_enabled: true as unknown as false };
	const validation = validateFlowDeskGitHubDryRunPublicationResultV1(tampered);
	assert.equal(validation.ok, false);
	assert.ok(validation.errors.some((e: string) => /dispatch_authority_enabled.*false|authority smuggling/i.test(e)),
		`Expected dispatch authority error, got: ${validation.errors.join("; ")}`);
});

test("P8-S3 dry-run: authority smuggling remote_write_attempted=true → rejected", () => {
	const created = createFlowDeskGitHubDryRunPublicationResultV1(validDryRunInput);
	assert.equal(created.ok, true);
	const tampered = { ...created.result!, remote_write_attempted: true as unknown as false };
	const validation = validateFlowDeskGitHubDryRunPublicationResultV1(tampered);
	assert.equal(validation.ok, false);
	assert.ok(validation.errors.some((e: string) => /remote_write_attempted.*false|authority smuggling/i.test(e)),
		`Expected remote_write_attempted error, got: ${validation.errors.join("; ")}`);
});

test("P8-S3 dry-run: authority smuggling github_write_attempted=true → rejected", () => {
	const created = createFlowDeskGitHubDryRunPublicationResultV1(validDryRunInput);
	assert.equal(created.ok, true);
	const tampered = { ...created.result!, github_write_attempted: true as unknown as false };
	const validation = validateFlowDeskGitHubDryRunPublicationResultV1(tampered);
	assert.equal(validation.ok, false);
	assert.ok(validation.errors.some((e: string) => /github_write_attempted.*false|authority smuggling/i.test(e)),
		`Expected github_write_attempted error, got: ${validation.errors.join("; ")}`);
});

test("P8-S3 dry-run: unknown property → rejected (closed schema)", () => {
	const created = createFlowDeskGitHubDryRunPublicationResultV1(validDryRunInput);
	assert.equal(created.ok, true);
	const withExtra = { ...created.result!, unexpected_field: "injected" };
	const validation = validateFlowDeskGitHubDryRunPublicationResultV1(withExtra);
	assert.equal(validation.ok, false);
	assert.ok(validation.errors.some((e: string) => /unknown properties/i.test(e)));
});

test("P8-S3 dry-run: github_pr_comment kind → valid", () => {
	const result = createFlowDeskGitHubDryRunPublicationResultV1({
		...validDryRunInput,
		dryRunResultId: "dry-run-pr-1",
		connectorKind: "github_pr_comment",
		redactedTargetLabel: "PR #15 in myorg/myrepo",
	});
	assert.equal(result.ok, true, result.errors.join("; "));
	assert.equal(result.result!.connector_kind, "github_pr_comment");
	const validation = validateFlowDeskGitHubDryRunPublicationResultV1(result.result!);
	assert.equal(validation.ok, true, validation.errors.join("; "));
});

test("P8-S3 dry-run: content_hash_ref with hash- prefix → valid", () => {
	const result = createFlowDeskGitHubDryRunPublicationResultV1({
		...validDryRunInput,
		dryRunResultId: "dry-run-hashprefix-1",
		contentHashRef: "hash-content-preview-abc123",
	});
	assert.equal(result.ok, true, result.errors.join("; "));
	const validation = validateFlowDeskGitHubDryRunPublicationResultV1(result.result!);
	assert.equal(validation.ok, true, validation.errors.join("; "));
});

test("P8-S3 dry-run: invalid would_produce_ref_shape → rejected by validator", () => {
	const created = createFlowDeskGitHubDryRunPublicationResultV1(validDryRunInput);
	assert.equal(created.ok, true);
	const tampered = { ...created.result!, would_produce_ref_shape: "opaque_remote_ref" as unknown as "github_url" };
	const validation = validateFlowDeskGitHubDryRunPublicationResultV1(tampered);
	assert.equal(validation.ok, false);
	assert.ok(validation.errors.some((e: string) => /would_produce_ref_shape.*github_url/i.test(e)),
		`Expected would_produce_ref_shape error, got: ${validation.errors.join("; ")}`);
});

// ─── P8-S6a: Federated Consent Record tests ────────────────────────────────────

test("P8-S6a consent record: valid granted not-revoked publish_scores scope", () => {
	const result = createFlowDeskFederatedConsentRecordV1({
		consentRecordId: "consent-record-1",
		workflowId: "workflow-consent-1",
		consentGrantedAt: "2026-06-07T00:00:00.000Z",
		consentGrantedBy: "operator-config-ref-1",
		targetRegistryRef: "registry-config-ref-1",
		revoked: false,
		consentScope: ["publish_scores"],
		retentionDays: 30,
		installationIdHashRef: "hash-installation-abc123",
	});
	assert.equal(result.ok, true, result.errors.join("; "));
	assert.ok(result.record !== undefined);
	const r = result.record as FlowDeskFederatedConsentRecordV1;
	assert.equal(r.schema_version, "flowdesk.federated_consent_record.v1");
	assert.equal(r.consent_record_id, "consent-record-1");
	assert.equal(r.revocable, true);
	assert.equal(r.revoked, false);
	assert.equal(r.revoked_at, undefined);
	assert.deepEqual(r.consent_scope, ["publish_scores"]);
	assert.equal(r.retention_days, 30);
	assert.equal(r.advisory_only, true);
	assert.equal(r.non_authorizing, true);
	assert.equal(r.remote_write_authority_enabled, false);
	assert.equal(r.dispatch_authority_enabled, false);
	// Validator round-trip
	assert.equal(validateFlowDeskFederatedConsentRecordV1(r).ok, true);
});

test("P8-S6a consent record: revoked=true requires revoked_at", () => {
	// revoked=true without revoked_at → rejected
	const withoutAt = createFlowDeskFederatedConsentRecordV1({
		consentRecordId: "consent-record-2a",
		workflowId: "workflow-consent-2",
		consentGrantedAt: "2026-06-07T00:01:00.000Z",
		consentGrantedBy: "operator-config-ref-2",
		targetRegistryRef: "registry-config-ref-2",
		revoked: true,
		// revokedAt intentionally absent
		consentScope: ["read_scores"],
		retentionDays: 90,
		installationIdHashRef: "hash-installation-def456",
	});
	assert.equal(withoutAt.ok, false);
	assert.match(withoutAt.errors.join("; "), /revoked_at.*required|required.*revoked_at/);

	// revoked=true WITH revoked_at → accepted
	const withAt = createFlowDeskFederatedConsentRecordV1({
		consentRecordId: "consent-record-2b",
		workflowId: "workflow-consent-2",
		consentGrantedAt: "2026-06-07T00:01:00.000Z",
		consentGrantedBy: "operator-config-ref-2",
		targetRegistryRef: "registry-config-ref-2",
		revoked: true,
		revokedAt: "2026-06-07T01:00:00.000Z",
		consentScope: ["read_scores"],
		retentionDays: 90,
		installationIdHashRef: "hash-installation-def456",
	});
	assert.equal(withAt.ok, true, withAt.errors.join("; "));
	assert.equal(withAt.record?.revoked_at, "2026-06-07T01:00:00.000Z");
	assert.equal(validateFlowDeskFederatedConsentRecordV1(withAt.record!).ok, true);

	// Validator: revoked=true without revoked_at is also caught
	const forgedRevoked = validateFlowDeskFederatedConsentRecordV1({
		...withAt.record!,
		revoked_at: undefined,
	});
	assert.equal(forgedRevoked.ok, false);
	assert.match(forgedRevoked.errors.join("; "), /revoked_at.*required|required.*revoked_at/);
});

test("P8-S6a consent record: empty consent_scope rejected", () => {
	const result = createFlowDeskFederatedConsentRecordV1({
		consentRecordId: "consent-record-3",
		workflowId: "workflow-consent-3",
		consentGrantedAt: "2026-06-07T00:02:00.000Z",
		consentGrantedBy: "operator-config-ref-3",
		targetRegistryRef: "registry-config-ref-3",
		revoked: false,
		consentScope: [],  // empty — must be rejected
		retentionDays: 7,
		installationIdHashRef: "hash-installation-ghi789",
	});
	assert.equal(result.ok, false);
	assert.match(result.errors.join("; "), /consent_scope.*non-empty|non-empty.*consent_scope/);

	// Validator also rejects empty scope on a valid base
	const base = createFlowDeskFederatedConsentRecordV1({
		consentRecordId: "consent-record-3b",
		workflowId: "workflow-consent-3",
		consentGrantedAt: "2026-06-07T00:03:00.000Z",
		consentGrantedBy: "operator-config-ref-3b",
		targetRegistryRef: "registry-config-ref-3b",
		revoked: false,
		consentScope: ["post_pr_comments"],
		retentionDays: 14,
		installationIdHashRef: "hash-installation-ghi789",
	});
	assert.equal(base.ok, true, base.errors.join("; "));
	const emptyScope = validateFlowDeskFederatedConsentRecordV1({ ...base.record!, consent_scope: [] });
	assert.equal(emptyScope.ok, false);
	assert.match(emptyScope.errors.join("; "), /consent_scope.*non-empty|non-empty.*consent_scope/);
});

test("P8-S6a consent record: retention_days out of range rejected", () => {
	// Zero days (< 1)
	const zeroDays = createFlowDeskFederatedConsentRecordV1({
		consentRecordId: "consent-record-4a",
		workflowId: "workflow-consent-4",
		consentGrantedAt: "2026-06-07T00:04:00.000Z",
		consentGrantedBy: "operator-config-ref-4",
		targetRegistryRef: "registry-config-ref-4",
		revoked: false,
		consentScope: ["publish_scores"],
		retentionDays: 0,
		installationIdHashRef: "hash-installation-jkl012",
	});
	assert.equal(zeroDays.ok, false);
	assert.match(zeroDays.errors.join("; "), /retention_days.*1\.\.365|1\.\.365.*retention_days/);

	// 366 days (> 365)
	const tooManyDays = createFlowDeskFederatedConsentRecordV1({
		consentRecordId: "consent-record-4b",
		workflowId: "workflow-consent-4",
		consentGrantedAt: "2026-06-07T00:05:00.000Z",
		consentGrantedBy: "operator-config-ref-4b",
		targetRegistryRef: "registry-config-ref-4b",
		revoked: false,
		consentScope: ["read_scores"],
		retentionDays: 366,
		installationIdHashRef: "hash-installation-jkl012",
	});
	assert.equal(tooManyDays.ok, false);
	assert.match(tooManyDays.errors.join("; "), /retention_days.*1\.\.365|1\.\.365.*retention_days/);

	// Valid boundary values 1 and 365
	for (const days of [1, 365]) {
		const boundary = createFlowDeskFederatedConsentRecordV1({
			consentRecordId: `consent-record-4c-${days}`,
			workflowId: "workflow-consent-4",
			consentGrantedAt: "2026-06-07T00:06:00.000Z",
			consentGrantedBy: "operator-config-ref-4c",
			targetRegistryRef: "registry-config-ref-4c",
			revoked: false,
			consentScope: ["publish_scores"],
			retentionDays: days,
			installationIdHashRef: "hash-installation-jkl012",
		});
		assert.equal(boundary.ok, true, `retention_days=${days} should be valid: ${boundary.errors.join("; ")}`);
	}
});

// ─── P8-S6a: GitHub OAuth Architecture tests ────────────────────────────────────

test("P8-S6a OAuth architecture: valid configured state", () => {
	const result = createFlowDeskGitHubOAuthArchitectureV1({
		architectureId: "oauth-arch-1",
		authScopeRef: "auth-scope-ref-1",
		requiredGithubScopes: ["repo", "read:org"],
		tokenRef: "token-opaque-ref-1",
		authState: "configured",
		dryRunAllowedWithoutToken: false,
	});
	assert.equal(result.ok, true, result.errors.join("; "));
	assert.ok(result.architecture !== undefined);
	const a = result.architecture as FlowDeskGitHubOAuthArchitectureV1;
	assert.equal(a.schema_version, "flowdesk.github_oauth_architecture.v1");
	assert.equal(a.architecture_id, "oauth-arch-1");
	assert.equal(a.token_storage, "config_file_only");
	assert.equal(a.token_ref, "token-opaque-ref-1");
	assert.equal(a.auth_state, "configured");
	assert.equal(a.dry_run_allowed_without_token, false);
	assert.equal(a.advisory_only, true);
	assert.equal(a.non_authorizing, true);
	assert.equal(a.provider_call_made, false);
	assert.equal(a.token_transmitted_in_evidence, false);
	assert.equal(a.remote_write_authority_enabled, false);
	assert.equal(a.dispatch_authority_enabled, false);
	// Validator round-trip
	assert.equal(validateFlowDeskGitHubOAuthArchitectureV1(a).ok, true);

	// Missing state: dry_run_allowed_without_token=true
	const missing = createFlowDeskGitHubOAuthArchitectureV1({
		architectureId: "oauth-arch-1b",
		authScopeRef: "auth-scope-ref-1b",
		requiredGithubScopes: ["public_repo"],
		tokenRef: "token-ref-missing-1",
		authState: "missing",
		dryRunAllowedWithoutToken: true,
	});
	assert.equal(missing.ok, true, missing.errors.join("; "));
	assert.equal(missing.architecture?.dry_run_allowed_without_token, true);
	assert.equal(missing.architecture?.auth_state, "missing");
	assert.equal(validateFlowDeskGitHubOAuthArchitectureV1(missing.architecture!).ok, true);
});

test("P8-S6a OAuth architecture: token_ref containing ghp_ rejected", () => {
	// ghp_ prefix is a raw GitHub PAT — must never appear in token_ref
	const ghpToken = createFlowDeskGitHubOAuthArchitectureV1({
		architectureId: "oauth-arch-2a",
		authScopeRef: "auth-scope-ref-2",
		requiredGithubScopes: ["repo"],
		tokenRef: "ghp_secretTokenValue12345",  // raw token — must be rejected
		authState: "configured",
		dryRunAllowedWithoutToken: false,
	});
	assert.equal(ghpToken.ok, false);
	assert.match(ghpToken.errors.join("; "), /token_ref.*raw token|raw token.*token_ref|token smuggling/);

	// github_pat_ prefix
	const patToken = createFlowDeskGitHubOAuthArchitectureV1({
		architectureId: "oauth-arch-2b",
		authScopeRef: "auth-scope-ref-2b",
		requiredGithubScopes: ["repo"],
		tokenRef: "github_pat_abc123xyz",  // raw PAT — must be rejected
		authState: "configured",
		dryRunAllowedWithoutToken: false,
	});
	assert.equal(patToken.ok, false);
	assert.match(patToken.errors.join("; "), /token_ref.*raw token|raw token.*token_ref|token smuggling/);

	// Validator also rejects raw token patterns
	const validArch = createFlowDeskGitHubOAuthArchitectureV1({
		architectureId: "oauth-arch-2c",
		authScopeRef: "auth-scope-ref-2c",
		requiredGithubScopes: ["repo"],
		tokenRef: "token-opaque-ref-2c",
		authState: "configured",
		dryRunAllowedWithoutToken: false,
	});
	assert.equal(validArch.ok, true, validArch.errors.join("; "));
	const forgedToken = validateFlowDeskGitHubOAuthArchitectureV1({
		...validArch.architecture!,
		token_ref: "ghp_leakedToken",
	});
	assert.equal(forgedToken.ok, false);
	assert.match(forgedToken.errors.join("; "), /token_ref.*raw token|raw token.*token_ref|token smuggling/);
});

test("P8-S6a OAuth architecture: token_transmitted_in_evidence=true rejected (authority smuggling)", () => {
	// Create valid architecture first
	const validArch = createFlowDeskGitHubOAuthArchitectureV1({
		architectureId: "oauth-arch-3",
		authScopeRef: "auth-scope-ref-3",
		requiredGithubScopes: ["repo", "read:org"],
		tokenRef: "token-opaque-ref-3",
		authState: "configured",
		dryRunAllowedWithoutToken: false,
	});
	assert.equal(validArch.ok, true, validArch.errors.join("; "));

	// Attempt to smuggle token_transmitted_in_evidence=true
	const smuggled = validateFlowDeskGitHubOAuthArchitectureV1({
		...validArch.architecture!,
		token_transmitted_in_evidence: true as unknown as false,
	});
	assert.equal(smuggled.ok, false);
	assert.match(smuggled.errors.join("; "), /token_transmitted_in_evidence.*false|token smuggling/);

	// Attempt to smuggle dispatch_authority_enabled=true
	const dispatchSmuggled = validateFlowDeskGitHubOAuthArchitectureV1({
		...validArch.architecture!,
		dispatch_authority_enabled: true as unknown as false,
	});
	assert.equal(dispatchSmuggled.ok, false);
	assert.match(dispatchSmuggled.errors.join("; "), /dispatch_authority_enabled.*false|authority smuggling/);

	// Attempt to smuggle provider_call_made=true
	const providerSmuggled = validateFlowDeskGitHubOAuthArchitectureV1({
		...validArch.architecture!,
		provider_call_made: true as unknown as false,
	});
	assert.equal(providerSmuggled.ok, false);
	assert.match(providerSmuggled.errors.join("; "), /provider_call_made.*false|authority smuggling/);

	// Unknown property injection
	const unknownProp = validateFlowDeskGitHubOAuthArchitectureV1({
		...validArch.architecture!,
		extra_field: "injected",
	});
	assert.equal(unknownProp.ok, false);
	assert.match(unknownProp.errors.join("; "), /unknown properties/);
});

// ─── P8-S7: Federated Data Minimization Policy tests ─────────────────────────

const validMinPolicyInput = {
	policyId: "policy-minimization-1",
	workflowId: "workflow-1",
	kAnonymityThreshold: 10,
	createdAt: "2026-06-07T00:00:00.000Z",
};

test("P8-S7 data minimization policy: valid policy with k_anonymity_threshold=10", () => {
	const result = createFlowDeskFederatedDataMinimizationPolicyV1(validMinPolicyInput);
	assert.equal(result.ok, true, result.errors.join("; "));
	const policy = result.policy as FlowDeskFederatedDataMinimizationPolicyV1;
	assert.equal(policy.schema_version, "flowdesk.federated_data_minimization_policy.v1");
	assert.equal(policy.policy_id, "policy-minimization-1");
	assert.equal(policy.workflow_id, "workflow-1");
	assert.equal(policy.strip_workflow_id, true);
	assert.equal(policy.strip_proposal_id, true);
	assert.equal(policy.strip_task_descriptions, true);
	assert.equal(policy.strip_model_names, true);
	assert.equal(policy.publish_dimension_scores_as_buckets, true);
	assert.equal(policy.score_bucket_size, 25);
	assert.equal(policy.publish_timestamp_resolution, "day");
	assert.equal(policy.canonical_workflow_ref_algorithm, "sha256");
	assert.equal(policy.k_anonymity_threshold, 10);
	assert.equal(policy.advisory_only, true);
	assert.equal(policy.non_authorizing, true);
	assert.equal(policy.remote_write_authority_enabled, false);
	assert.equal(policy.dispatch_authority_enabled, false);
	// Round-trip validation
	const validation = validateFlowDeskFederatedDataMinimizationPolicyV1(policy);
	assert.equal(validation.ok, true, validation.errors.join("; "));
});

test("P8-S7 data minimization policy: k_anonymity_threshold < 10 rejected", () => {
	// threshold = 9 → rejected
	const r9 = createFlowDeskFederatedDataMinimizationPolicyV1({ ...validMinPolicyInput, kAnonymityThreshold: 9 });
	assert.equal(r9.ok, false);
	assert.match(r9.errors.join("; "), /k_anonymity_threshold.*>= 10/);

	// threshold = 0 → rejected
	const r0 = createFlowDeskFederatedDataMinimizationPolicyV1({ ...validMinPolicyInput, kAnonymityThreshold: 0 });
	assert.equal(r0.ok, false);
	assert.match(r0.errors.join("; "), /k_anonymity_threshold.*>= 10/);

	// threshold = -1 → rejected
	const rNeg = createFlowDeskFederatedDataMinimizationPolicyV1({ ...validMinPolicyInput, kAnonymityThreshold: -1 });
	assert.equal(rNeg.ok, false);
	assert.match(rNeg.errors.join("; "), /k_anonymity_threshold.*>= 10/);

	// Validator-level: k_anonymity_threshold = 5 on an otherwise-valid record
	const valid10 = createFlowDeskFederatedDataMinimizationPolicyV1(validMinPolicyInput);
	assert.equal(valid10.ok, true);
	const tampered = validateFlowDeskFederatedDataMinimizationPolicyV1({ ...valid10.policy!, k_anonymity_threshold: 5 });
	assert.equal(tampered.ok, false);
	assert.match(tampered.errors.join("; "), /k_anonymity_threshold.*>= 10/);
});

test("P8-S7 data minimization policy: score_bucket_size != 25 rejected by validator", () => {
	const valid = createFlowDeskFederatedDataMinimizationPolicyV1(validMinPolicyInput);
	assert.equal(valid.ok, true);

	// Attempt to mutate score_bucket_size to a different value
	const tampered = validateFlowDeskFederatedDataMinimizationPolicyV1({
		...valid.policy!,
		score_bucket_size: 10 as 25,
	});
	assert.equal(tampered.ok, false);
	assert.match(tampered.errors.join("; "), /score_bucket_size.*25/);

	// Also reject score_bucket_size = 50
	const tampered50 = validateFlowDeskFederatedDataMinimizationPolicyV1({
		...valid.policy!,
		score_bucket_size: 50 as 25,
	});
	assert.equal(tampered50.ok, false);
	assert.match(tampered50.errors.join("; "), /score_bucket_size.*25/);
});

test("P8-S7 data minimization policy: all literal fields enforced by validator", () => {
	const valid = createFlowDeskFederatedDataMinimizationPolicyV1(validMinPolicyInput);
	assert.equal(valid.ok, true);
	const p = valid.policy!;

	// strip_workflow_id must be true
	assert.equal(validateFlowDeskFederatedDataMinimizationPolicyV1({ ...p, strip_workflow_id: false as true }).ok, false);

	// strip_proposal_id must be true
	assert.equal(validateFlowDeskFederatedDataMinimizationPolicyV1({ ...p, strip_proposal_id: false as true }).ok, false);

	// strip_task_descriptions must be true
	assert.equal(validateFlowDeskFederatedDataMinimizationPolicyV1({ ...p, strip_task_descriptions: false as true }).ok, false);

	// strip_model_names must be true
	assert.equal(validateFlowDeskFederatedDataMinimizationPolicyV1({ ...p, strip_model_names: false as true }).ok, false);

	// publish_dimension_scores_as_buckets must be true
	assert.equal(validateFlowDeskFederatedDataMinimizationPolicyV1({ ...p, publish_dimension_scores_as_buckets: false as true }).ok, false);

	// publish_timestamp_resolution must be "day"
	assert.equal(validateFlowDeskFederatedDataMinimizationPolicyV1({ ...p, publish_timestamp_resolution: "hour" as "day" }).ok, false);

	// canonical_workflow_ref_algorithm must be "sha256"
	assert.equal(validateFlowDeskFederatedDataMinimizationPolicyV1({ ...p, canonical_workflow_ref_algorithm: "md5" as "sha256" }).ok, false);

	// dispatch_authority_enabled must be false
	const forgedDispatch = validateFlowDeskFederatedDataMinimizationPolicyV1({ ...p, dispatch_authority_enabled: true as false });
	assert.equal(forgedDispatch.ok, false);
	assert.match(forgedDispatch.errors.join("; "), /dispatch_authority_enabled.*false/);

	// remote_write_authority_enabled must be false
	const forgedRemoteWrite = validateFlowDeskFederatedDataMinimizationPolicyV1({ ...p, remote_write_authority_enabled: true as false });
	assert.equal(forgedRemoteWrite.ok, false);
	assert.match(forgedRemoteWrite.errors.join("; "), /remote_write_authority_enabled.*false/);

	// Unknown property injection
	const unknown = validateFlowDeskFederatedDataMinimizationPolicyV1({ ...p, providerCall: true });
	assert.equal(unknown.ok, false);
	assert.match(unknown.errors.join("; "), /unknown properties/);
});

test("P8-S7 data minimization policy: valid threshold values >= 10 accepted", () => {
	for (const threshold of [10, 15, 100, 1000]) {
		const result = createFlowDeskFederatedDataMinimizationPolicyV1({
			...validMinPolicyInput,
			policyId: `policy-min-threshold-${threshold}`,
			kAnonymityThreshold: threshold,
		});
		assert.equal(result.ok, true, `threshold=${threshold}: ${result.errors.join("; ")}`);
		assert.equal(result.policy!.k_anonymity_threshold, threshold);
		const validation = validateFlowDeskFederatedDataMinimizationPolicyV1(result.policy!);
		assert.equal(validation.ok, true, `threshold=${threshold} validate: ${validation.errors.join("; ")}`);
	}
});

// ─── P8-S7: Federated Canonical Workflow Ref tests ───────────────────────────

const validCanonRefInput = {
	canonicalRefId: "canonical-ref-1",
	sourceHashRef: "sha256-abcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890",
	createdAt: "2026-06-07T00:00:00.000Z",
};

test("P8-S7 canonical workflow ref: valid canonical ref with sha256 source_hash_ref", () => {
	const result = createFlowDeskFederatedCanonicalWorkflowRefV1(validCanonRefInput);
	assert.equal(result.ok, true, result.errors.join("; "));
	const ref = result.canonicalRef as FlowDeskFederatedCanonicalWorkflowRefV1;
	assert.equal(ref.schema_version, "flowdesk.federated_canonical_workflow_ref.v1");
	assert.equal(ref.canonical_ref_id, "canonical-ref-1");
	assert.equal(ref.source_hash_ref, validCanonRefInput.sourceHashRef);
	assert.equal(ref.algorithm, "sha256");
	assert.deepEqual(ref.input_fields_hashed, ["installation_id", "workflow_id"]);
	assert.equal(ref.reversible, false);
	assert.equal(ref.source_workflow_id_exposed, false);
	assert.equal(ref.advisory_only, true);
	assert.equal(ref.non_authorizing, true);
	assert.equal(ref.remote_write_authority_enabled, false);
	// Round-trip validation
	const validation = validateFlowDeskFederatedCanonicalWorkflowRefV1(ref);
	assert.equal(validation.ok, true, validation.errors.join("; "));
});

test("P8-S7 canonical workflow ref: reversible=true rejected", () => {
	const valid = createFlowDeskFederatedCanonicalWorkflowRefV1(validCanonRefInput);
	assert.equal(valid.ok, true);
	const tampered = validateFlowDeskFederatedCanonicalWorkflowRefV1({
		...valid.canonicalRef!,
		reversible: true as false,
	});
	assert.equal(tampered.ok, false);
	assert.match(tampered.errors.join("; "), /reversible.*false/);
});

test("P8-S7 canonical workflow ref: source_workflow_id_exposed=true rejected", () => {
	const valid = createFlowDeskFederatedCanonicalWorkflowRefV1(validCanonRefInput);
	assert.equal(valid.ok, true);
	const tampered = validateFlowDeskFederatedCanonicalWorkflowRefV1({
		...valid.canonicalRef!,
		source_workflow_id_exposed: true as false,
	});
	assert.equal(tampered.ok, false);
	assert.match(tampered.errors.join("; "), /source_workflow_id_exposed.*false/);
});

test("P8-S7 canonical workflow ref: raw workflowId in source_hash_ref rejected", () => {
	// A ref containing "workflow-" prefix is rejected as a raw workflowId marker
	const rawMarkerRef = createFlowDeskFederatedCanonicalWorkflowRefV1({
		...validCanonRefInput,
		sourceHashRef: "hash-workflow-abc123" as string,
	});
	assert.equal(rawMarkerRef.ok, false);
	assert.match(rawMarkerRef.errors.join("; "), /raw workflowId markers rejected/);

	// Also rejected at validator level
	const valid = createFlowDeskFederatedCanonicalWorkflowRefV1(validCanonRefInput);
	assert.equal(valid.ok, true);
	const tamperedAtValidate = validateFlowDeskFederatedCanonicalWorkflowRefV1({
		...valid.canonicalRef!,
		source_hash_ref: "hash-workflow-xyz" as string,
	});
	assert.equal(tamperedAtValidate.ok, false);
	assert.match(tamperedAtValidate.errors.join("; "), /raw workflowId markers rejected/);
});

test("P8-S7 canonical workflow ref: algorithm != sha256 rejected", () => {
	const valid = createFlowDeskFederatedCanonicalWorkflowRefV1(validCanonRefInput);
	assert.equal(valid.ok, true);
	const tampered = validateFlowDeskFederatedCanonicalWorkflowRefV1({
		...valid.canonicalRef!,
		algorithm: "md5" as "sha256",
	});
	assert.equal(tampered.ok, false);
	assert.match(tampered.errors.join("; "), /algorithm.*sha256/);
});

test("P8-S7 canonical workflow ref: input_fields_hashed missing required fields rejected", () => {
	const valid = createFlowDeskFederatedCanonicalWorkflowRefV1(validCanonRefInput);
	assert.equal(valid.ok, true);

	// Missing "installation_id"
	const missingInstall = validateFlowDeskFederatedCanonicalWorkflowRefV1({
		...valid.canonicalRef!,
		input_fields_hashed: ["workflow_id"] as readonly ("installation_id" | "workflow_id")[],
	});
	assert.equal(missingInstall.ok, false);
	assert.match(missingInstall.errors.join("; "), /installation_id/);

	// Missing "workflow_id"
	const missingWorkflow = validateFlowDeskFederatedCanonicalWorkflowRefV1({
		...valid.canonicalRef!,
		input_fields_hashed: ["installation_id"] as readonly ("installation_id" | "workflow_id")[],
	});
	assert.equal(missingWorkflow.ok, false);
	assert.match(missingWorkflow.errors.join("; "), /workflow_id/);

	// Both missing (empty array)
	const empty = validateFlowDeskFederatedCanonicalWorkflowRefV1({
		...valid.canonicalRef!,
		input_fields_hashed: [] as readonly ("installation_id" | "workflow_id")[],
	});
	assert.equal(empty.ok, false);

	// Both required fields present → accepted
	const both = validateFlowDeskFederatedCanonicalWorkflowRefV1({
		...valid.canonicalRef!,
		input_fields_hashed: ["installation_id", "workflow_id"],
	});
	assert.equal(both.ok, true, both.errors.join("; "));
});

test("P8-S7 canonical workflow ref: authority smuggling and unknown properties rejected", () => {
	const valid = createFlowDeskFederatedCanonicalWorkflowRefV1(validCanonRefInput);
	assert.equal(valid.ok, true);
	const ref = valid.canonicalRef!;

	// remote_write_authority_enabled must be false
	const forgedRemoteWrite = validateFlowDeskFederatedCanonicalWorkflowRefV1({ ...ref, remote_write_authority_enabled: true as false });
	assert.equal(forgedRemoteWrite.ok, false);
	assert.match(forgedRemoteWrite.errors.join("; "), /remote_write_authority_enabled.*false/);

	// advisory_only must be true
	const forgedAdvisory = validateFlowDeskFederatedCanonicalWorkflowRefV1({ ...ref, advisory_only: false as true });
	assert.equal(forgedAdvisory.ok, false);
	assert.match(forgedAdvisory.errors.join("; "), /advisory_only.*true/);

	// non_authorizing must be true
	const forgedNonAuth = validateFlowDeskFederatedCanonicalWorkflowRefV1({ ...ref, non_authorizing: false as true });
	assert.equal(forgedNonAuth.ok, false);
	assert.match(forgedNonAuth.errors.join("; "), /non_authorizing.*true/);

	// Unknown property injection
	const unknown = validateFlowDeskFederatedCanonicalWorkflowRefV1({ ...ref, providerCall: true });
	assert.equal(unknown.ok, false);
	assert.match(unknown.errors.join("; "), /unknown properties/);

	// Non-object input
	assert.equal(validateFlowDeskFederatedCanonicalWorkflowRefV1(null).ok, false);
	assert.equal(validateFlowDeskFederatedCanonicalWorkflowRefV1(42).ok, false);
});

// ─── P8-S8: planFlowDeskGitHubDryRunPublicationV1 tests ───────────────────────

// Helper: build a complete set of valid prerequisite records for the planner.
// Uses "workflow-1" throughout to match the existing scoreEvent()/ledgerEntry() helpers.
function buildValidPlannerInput(): FlowDeskGitHubDryRunPublicationPlanInputV1 {
	const intentResult = createFlowDeskFederatedScoreRegistryPublicationIntentV1({
		publicationIntentId: "planner-intent-1",
		requestId: "planner-request-1",
		workflowId: "workflow-1",
		registryRef: "registry-planner-1",
		ledgerEntries: [ledgerEntry()],
		requestedAt: "2026-06-07T00:00:00.000Z",
		federatedRegistryPublicationOptIn: true,
	});
	assert.equal(intentResult.ok, true, (intentResult.errors ?? []).join("; "));

	const capabilityResult = createFlowDeskFederatedRegistryConnectorCapabilityV1({
		capabilityDescriptorId: "planner-cap-1",
		capabilityRef: "cap-ref-planner-1",
		connectorKind: "github_issue",
		connectorProfileRef: "profile-ref-planner-1",
		registryRef: "registry-planner-1",
		authScopeRef: "auth-scope-planner-1",
		targetKind: "github_issue",
		toolRef: "tool-ref-planner-1",
		capabilityState: "available",
		contentFormatRef: "format-ref-planner-1",
		dryRunSupported: true,
		discoveredAt: "2026-06-07T00:00:00.000Z",
	});
	assert.equal(capabilityResult.ok, true, capabilityResult.errors.join("; "));

	const preflightResult = createFlowDeskFederatedRegistryPublicationPreflightV1({
		preflightId: "planner-preflight-1",
		publicationIntentRef: "pub-intent-ref-planner-1",
		capabilityDescriptorRef: "cap-desc-ref-planner-1",
		workflowId: "workflow-1",
		attemptId: "planner-attempt-1",
		registryRef: "registry-planner-1",
		connectorKind: "github_issue",
		targetRef: "target-ref-planner-1",
		contentHashRef: "sha256-0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef",
		redactionPolicyRef: "redaction-policy-planner-1",
		authScopeRef: "auth-scope-planner-1",
		contentFormatRef: "format-ref-planner-1",
		idempotencyKeyRef: "idempotency-key-planner-1",
		preWriteAuditRef: "pre-write-audit-planner-1",
		preflightState: "preflight_passed",
		blockedLabels: [],
		createdAt: "2026-06-07T00:00:00.000Z",
	});
	assert.equal(preflightResult.ok, true, preflightResult.errors.join("; "));

	const consentResult = createFlowDeskFederatedConsentRecordV1({
		consentRecordId: "planner-consent-1",
		workflowId: "workflow-1",
		consentGrantedAt: "2026-06-07T00:00:00.000Z",
		consentGrantedBy: "operator-config-ref-planner-1",
		targetRegistryRef: "registry-planner-1",
		revoked: false,
		consentScope: ["publish_scores"],
		retentionDays: 30,
		installationIdHashRef: "hash-installation-planner-1",
	});
	assert.equal(consentResult.ok, true, consentResult.errors.join("; "));

	const minPolicyResult = createFlowDeskFederatedDataMinimizationPolicyV1({
		policyId: "planner-policy-1",
		workflowId: "workflow-1",
		kAnonymityThreshold: 10,
		createdAt: "2026-06-07T00:00:00.000Z",
	});
	assert.equal(minPolicyResult.ok, true, minPolicyResult.errors.join("; "));

	const canonRefResult = createFlowDeskFederatedCanonicalWorkflowRefV1({
		canonicalRefId: "planner-canon-ref-1",
		sourceHashRef: "sha256-abcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890",
		createdAt: "2026-06-07T00:00:00.000Z",
	});
	assert.equal(canonRefResult.ok, true, canonRefResult.errors.join("; "));

	return {
		intent: intentResult.intent!,
		capability: capabilityResult.capability!,
		preflight: preflightResult.preflight!,
		consent: consentResult.record!,
		minimizationPolicy: minPolicyResult.policy!,
		canonicalRef: canonRefResult.canonicalRef!,
		connectorKind: "github_issue",
		redactedTargetLabel: "github_issue in myorg/myrepo",
		redactedContentPreview: "Score summary: dimension_a=75, dimension_b=50",
		contentHashRef: "sha256-0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef",
	};
}

test("P8-S8 planner: full happy-path dry-run → dry_run_state=dry_run_recorded", () => {
	const input = buildValidPlannerInput();
	const result: FlowDeskGitHubDryRunPublicationPlanResultV1 = planFlowDeskGitHubDryRunPublicationV1(input);
	assert.equal(result.ok, true, result.errors.join("; "));
	assert.ok(result.plan !== undefined);
	const plan = result.plan!;
	assert.equal(plan.dry_run_state, "dry_run_recorded");
	assert.equal(plan.fake_remote_write_attempted, true);
	assert.equal(plan.connector_kind, "github_issue");
	assert.equal(plan.redacted_target_label, "github_issue in myorg/myrepo");
	assert.equal(plan.redacted_content_preview, "Score summary: dimension_a=75, dimension_b=50");
	// All authority flags must be false
	assert.equal(plan.remote_write_attempted, false);
	assert.equal(plan.github_write_attempted, false);
	assert.equal(plan.remote_write_authority_enabled, false);
	assert.equal(plan.external_write_authority_enabled, false);
	assert.equal(plan.dispatch_authority_enabled, false);
	assert.equal(plan.providerCall, false);
	assert.equal(plan.actualLaneLaunch, false);
	assert.equal(plan.runtimeExecution, false);
	// blocked_labels must be empty
	assert.equal(result.blockedLabels.length, 0);
	// Plan record validates correctly
	const validation = validateFlowDeskGitHubDryRunPublicationResultV1(plan);
	assert.equal(validation.ok, true, validation.errors.join("; "));
});

test("P8-S8 planner: revoked consent → blocked, errors include consent_revoked", () => {
	const input = buildValidPlannerInput();
	// Override with a revoked consent record
	const revokedConsentResult = createFlowDeskFederatedConsentRecordV1({
		consentRecordId: "planner-consent-revoked-1",
		workflowId: "workflow-1",
		consentGrantedAt: "2026-06-07T00:00:00.000Z",
		consentGrantedBy: "operator-config-ref-planner-1",
		targetRegistryRef: "registry-planner-1",
		revoked: true,
		revokedAt: "2026-06-07T01:00:00.000Z",
		consentScope: ["publish_scores"],
		retentionDays: 30,
		installationIdHashRef: "hash-installation-planner-2",
	});
	assert.equal(revokedConsentResult.ok, true, revokedConsentResult.errors.join("; "));

	const result = planFlowDeskGitHubDryRunPublicationV1({
		...input,
		consent: revokedConsentResult.record!,
	});
	assert.equal(result.ok, false);
	assert.ok(result.errors.includes("consent_revoked"), `Expected consent_revoked in errors: ${result.errors.join("; ")}`);
	assert.ok(result.blockedLabels.includes("consent_revoked"));
	assert.equal(result.plan, undefined);
});

test("P8-S8 planner: consent missing publish_scores scope → blocked", () => {
	const input = buildValidPlannerInput();
	// Override with consent that only has read_scores, not publish_scores
	const readOnlyConsentResult = createFlowDeskFederatedConsentRecordV1({
		consentRecordId: "planner-consent-readonly-1",
		workflowId: "workflow-1",
		consentGrantedAt: "2026-06-07T00:00:00.000Z",
		consentGrantedBy: "operator-config-ref-planner-1",
		targetRegistryRef: "registry-planner-1",
		revoked: false,
		consentScope: ["read_scores"],
		retentionDays: 30,
		installationIdHashRef: "hash-installation-planner-3",
	});
	assert.equal(readOnlyConsentResult.ok, true, readOnlyConsentResult.errors.join("; "));

	const result = planFlowDeskGitHubDryRunPublicationV1({
		...input,
		consent: readOnlyConsentResult.record!,
	});
	assert.equal(result.ok, false);
	assert.ok(
		result.errors.includes("consent_scope_missing_publish_scores"),
		`Expected consent_scope_missing_publish_scores in errors: ${result.errors.join("; ")}`,
	);
	assert.ok(result.blockedLabels.includes("consent_scope_missing_publish_scores"));
	assert.equal(result.plan, undefined);
});

test("P8-S8 planner: preflight not passed → blocked", () => {
	const input = buildValidPlannerInput();
	// Override with a blocked preflight
	const blockedPreflightResult = createFlowDeskFederatedRegistryPublicationPreflightV1({
		preflightId: "planner-preflight-blocked-1",
		publicationIntentRef: "pub-intent-ref-planner-1",
		capabilityDescriptorRef: "cap-desc-ref-planner-1",
		workflowId: "workflow-1",
		attemptId: "planner-attempt-1",
		registryRef: "registry-planner-1",
		connectorKind: "github_issue",
		targetRef: "target-ref-planner-1",
		contentHashRef: "sha256-0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef",
		redactionPolicyRef: "redaction-policy-planner-1",
		authScopeRef: "auth-scope-planner-1",
		contentFormatRef: "format-ref-planner-1",
		idempotencyKeyRef: "idempotency-key-planner-1",
		preWriteAuditRef: "pre-write-audit-planner-1",
		preflightState: "blocked",
		blockedLabels: ["connector-gate-not-satisfied"],
		createdAt: "2026-06-07T00:00:00.000Z",
	});
	assert.equal(blockedPreflightResult.ok, true, blockedPreflightResult.errors.join("; "));

	const result = planFlowDeskGitHubDryRunPublicationV1({
		...input,
		preflight: blockedPreflightResult.preflight!,
	});
	assert.equal(result.ok, false);
	assert.ok(
		result.errors.includes("preflight_not_passed"),
		`Expected preflight_not_passed in errors: ${result.errors.join("; ")}`,
	);
	assert.ok(result.blockedLabels.includes("preflight_not_passed"));
	assert.equal(result.plan, undefined);
});

test("P8-S8 planner: raw URL in redactedContentPreview → blocked", () => {
	const input = buildValidPlannerInput();

	// Override with a content preview containing a raw URL
	const result = planFlowDeskGitHubDryRunPublicationV1({
		...input,
		redactedContentPreview: "See details at https://github.com/org/repo/issues/42 for more info",
	});
	assert.equal(result.ok, false);
	assert.ok(
		result.errors.includes("redacted_content_preview_contains_raw_url"),
		`Expected redacted_content_preview_contains_raw_url in errors: ${result.errors.join("; ")}`,
	);
	assert.ok(result.blockedLabels.includes("redacted_content_preview_contains_raw_url"));
	assert.equal(result.plan, undefined);
});
