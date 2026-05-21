import assert from "node:assert/strict";
import test from "node:test";
import type { FlowDeskStatusLaneSummaryV1 } from "./index.js";
import {
	createFlowDeskLaneObservabilityArtifactV1,
	validateFlowDeskLaneObservabilityArtifactV1,
} from "./index.js";

const now = "2026-05-21T00:00:00.000Z";

function laneSummary(
	overrides: Partial<FlowDeskStatusLaneSummaryV1> = {},
): FlowDeskStatusLaneSummaryV1 {
	return {
		lane_id: "lane-123",
		workflow_id: "workflow-123",
		plan_revision_id: "plan-123",
		attempt_id: "attempt-123",
		task_ref: "task-123",
		lane_class: "verification",
		state: "completed",
		created_at: now,
		started_at: now,
		updated_at: now,
		completed_at: now,
		safe_next_action: "/flowdesk-status",
		refs: ["lane-summary-123"],
		event_refs: ["event-123"],
		audit_refs: ["audit-123"],
		observability_ref: "lane-observability-123",
		debug_ref: "debug-123",
		...overrides,
	};
}

test("lane observability artifact records L1 inspectability without runtime authority", () => {
	const artifact = createFlowDeskLaneObservabilityArtifactV1({
		observabilityId: "lane-observability-123",
		statusSummaryRef: "lane-summary-123",
		laneSummary: laneSummary(),
		requestedBindingRef: "binding-requested-123",
		observedBindingRef: "binding-observed-123",
		parentSessionRef: "parent-session-123",
		childSessionRef: "child-session-123",
		messageRef: "message-123",
		outputRef: "output-123",
		detailRef: "lane-summary-123",
	});

	assert.equal(artifact.observability_level, "openable_refs");
	assert.equal(artifact.inspection_state, "inspectable");
	assert.deepEqual(artifact.inspect_actions, [
		"/flowdesk-status",
		"/flowdesk-export-debug",
	]);
	assert.equal(artifact.dispatch_authority_enabled, false);
	assert.equal(artifact.provider_call_made, false);
	assert.equal(artifact.runtime_execution, false);
	assert.equal(artifact.hard_chat_authority_claimed, false);
	assert.equal(validateFlowDeskLaneObservabilityArtifactV1(artifact).ok, true);
});

test("lane observability validator rejects authority and raw payload smuggling", () => {
	const valid = createFlowDeskLaneObservabilityArtifactV1({
		observabilityId: "lane-observability-123",
		statusSummaryRef: "lane-summary-123",
		laneSummary: laneSummary(),
	});

	const authority = validateFlowDeskLaneObservabilityArtifactV1({
		...valid,
		runtime_execution: true,
	});
	assert.equal(authority.ok, false);
	assert.match(authority.errors.join("; "), /runtime execution/);

	const raw = validateFlowDeskLaneObservabilityArtifactV1({
		...valid,
		child_session_ref: "/Users/example/session.json",
	});
	assert.equal(raw.ok, false);
	assert.match(raw.errors.join("; "), /raw path|schema-safe|paths/);
});

test("lane observability can represent degraded user inspectability", () => {
	const artifact = createFlowDeskLaneObservabilityArtifactV1({
		observabilityId: "lane-observability-degraded",
		statusSummaryRef: "lane-summary-123",
		laneSummary: laneSummary({ state: "correlation_lost" }),
		observabilityLevel: "status_summary",
		inspectionState: "degraded",
		redactionStatus: "partial",
		inspectActions: ["/flowdesk-status"],
	});

	assert.equal(artifact.lane_state, "correlation_lost");
	assert.equal(artifact.observability_level, "status_summary");
	assert.equal(artifact.inspection_state, "degraded");
	assert.deepEqual(artifact.inspect_actions, ["/flowdesk-status"]);
	assert.equal(validateFlowDeskLaneObservabilityArtifactV1(artifact).ok, true);
});
