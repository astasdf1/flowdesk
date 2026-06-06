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
