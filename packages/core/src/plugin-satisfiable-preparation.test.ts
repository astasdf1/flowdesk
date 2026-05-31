import assert from "node:assert/strict";
import test from "node:test";
import {
	assessFlowDeskPluginSatisfiablePreparationV1,
	FLOWDESK_PLUGIN_SATISFIABLE_EVIDENCE_KINDS,
} from "./index.js";

test("nothing supplied: all non-human plugin evidence pending, approval is human-pending", () => {
	const r = assessFlowDeskPluginSatisfiablePreparationV1({
		workflowId: "workflow-prep-1",
		suppliedEvidenceKinds: [],
		remainingBlockerLabels: [
			"usage_authority_missing",
			"runtime_echo_missing",
			"lane_conformance_missing",
		],
	});
	assert.equal(r.supplied.length, 0);
	assert.ok(r.pending_human.includes("production_approval_source"));
	assert.equal(r.pending_human.length, 1);
	assert.equal(r.all_non_human_plugin_evidence_supplied, false);
	assert.equal(r.all_plugin_satisfiable_supplied, false);
	// Boundary still classifies the platform-dependent labels.
	assert.equal(r.plugin_boundary_assessment.opencode_platform_dependent_count, 2);
});

test("all non-human supplied but approval pending: human step is the only plugin remainder", () => {
	const nonHuman = FLOWDESK_PLUGIN_SATISFIABLE_EVIDENCE_KINDS.filter(
		(k) => k !== "production_approval_source",
	);
	const r = assessFlowDeskPluginSatisfiablePreparationV1({
		workflowId: "workflow-prep-2",
		suppliedEvidenceKinds: nonHuman,
		remainingBlockerLabels: ["production_approval_source_missing", "runtime_echo_missing"],
	});
	assert.equal(r.all_non_human_plugin_evidence_supplied, true);
	assert.equal(r.all_plugin_satisfiable_supplied, false);
	assert.deepEqual(r.pending_human, ["production_approval_source"]);
	assert.equal(r.pending_non_human.length, 0);
});

test("everything supplied: all plugin-satisfiable evidence supplied (only platform remains)", () => {
	const r = assessFlowDeskPluginSatisfiablePreparationV1({
		workflowId: "workflow-prep-3",
		suppliedEvidenceKinds: [...FLOWDESK_PLUGIN_SATISFIABLE_EVIDENCE_KINDS],
		remainingBlockerLabels: ["runtime_echo_missing", "telemetry_correlation_missing", "lane_conformance_missing"],
	});
	assert.equal(r.all_plugin_satisfiable_supplied, true);
	assert.equal(r.pending_human.length, 0);
	assert.equal(r.pending_non_human.length, 0);
	assert.equal(r.plugin_boundary_assessment.only_platform_dependent_blockers_remain, true);
});

test("preparation readiness never fabricates evidence and is authority-free", () => {
	const r = assessFlowDeskPluginSatisfiablePreparationV1({
		workflowId: "workflow-prep-4",
		suppliedEvidenceKinds: ["usage_authority"],
		remainingBlockerLabels: [],
	});
	// Supplied reflects only what was passed; nothing auto-added.
	assert.deepEqual(r.supplied, ["usage_authority"]);
	assert.equal(r.dispatch_authority_enabled, false);
	assert.equal(r.realOpenCodeDispatch, false);
	assert.equal(r.actualLaneLaunch, false);
	assert.equal(r.providerCall, false);
	assert.equal(r.runtimeExecution, false);
});
