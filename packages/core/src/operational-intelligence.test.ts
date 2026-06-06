import assert from "node:assert/strict";
import test from "node:test";
import {
	createFlowDeskAdvisoryScoreLedgerAppendIntentV1,
	createFlowDeskAdvisoryScoreLedgerEntryV1,
	createFlowDeskEvaluationEventV1,
	createFlowDeskFederatedScoreRegistryPublicationIntentV1,
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
