import assert from "node:assert/strict";
import test from "node:test";
import {
	createFlowDeskAdvisoryScoreLedgerAppendIntentV1,
	createFlowDeskAdvisoryScoreLedgerEntryV1,
	createFlowDeskOperationalIntelligenceScoreV1,
	createFlowDeskWorkflowPlanProposalScoreEventV1,
	createFlowDeskWorkflowPlanProposalV1,
	decodeFlowDeskAdvisoryScoreLedgerEntryJsonlLine,
	encodeFlowDeskAdvisoryScoreLedgerEntryJsonlLine,
	validateFlowDeskAdvisoryScoreLedgerEntryV1,
	validateFlowDeskOperationalIntelligenceScoreV1,
	validateFlowDeskReferencePackV1,
	validateFlowDeskWorkflowPlanProposalScoreEventV1,
	validateFlowDeskWorkflowPlanProposalV1,
	type FlowDeskReferencePackV1,
} from "./index.js";

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
