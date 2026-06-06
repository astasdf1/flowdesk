import assert from "node:assert/strict";
import test from "node:test";
import {
	createFlowDeskOperationalIntelligenceScoreV1,
	createFlowDeskWorkflowPlanProposalScoreEventV1,
	createFlowDeskWorkflowPlanProposalV1,
	validateFlowDeskOperationalIntelligenceScoreV1,
	validateFlowDeskReferencePackV1,
	validateFlowDeskWorkflowPlanProposalScoreEventV1,
	validateFlowDeskWorkflowPlanProposalV1,
	type FlowDeskReferencePackV1,
} from "./index.js";

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
