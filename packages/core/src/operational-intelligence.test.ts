import assert from "node:assert/strict";
import test from "node:test";
import { createFlowDeskOperationalIntelligenceScoreV1, validateFlowDeskOperationalIntelligenceScoreV1, validateFlowDeskReferencePackV1, type FlowDeskReferencePackV1 } from "./index.js";

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
