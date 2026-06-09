import assert from "node:assert/strict";
import test from "node:test";
import { validateFlowDeskTaskModelSelectionV1 } from "./index.js";

function selection(overrides: Record<string, unknown> = {}) {
	return {
		schema_version: "flowdesk.task_model_selection.v1",
		workflow_id: "workflow-model-1",
		task_id: "task-plan",
		selection_id: "selection-1",
		provider_family: "openai",
		provider_qualified_model_id: "openai/gpt-5.5",
		usage_snapshot_ref: "usage-snapshot-1",
		usage_snapshot_freshness: "fresh",
		provider_health_ref: "provider-health-1",
		provider_health_label: "ok",
		exact_model_availability_ref: "model-availability-1",
		exact_model_availability_label: "available",
		fit_label: "good planning fit",
		performance_label: "balanced",
		selection_status: "selected",
		blocked_labels: [],
		fallback_allowed: false,
		reselection_allowed: false,
		created_at: "2026-05-27T00:00:00.000Z",
		release_gate: "release1_planning_only",
		dispatch_authority_enabled: false,
		provider_call_made: false,
		runtime_execution: false,
		actual_lane_launch: false,
		write_authority_enabled: false,
		redaction_version: "v1",
		...overrides,
	};
}

test("task model selection accepts planning-only model selection", () => {
	const result = validateFlowDeskTaskModelSelectionV1(selection());
	assert.equal(result.ok, true, result.errors.join("; "));
});

test("task model selection rejects fallback, reselection, authority, raw markers, and unknown props", () => {
	assert.equal(validateFlowDeskTaskModelSelectionV1(selection({ fallback_allowed: true })).ok, false);
	assert.equal(validateFlowDeskTaskModelSelectionV1(selection({ reselection_allowed: true })).ok, false);
	assert.equal(validateFlowDeskTaskModelSelectionV1(selection({ provider_call_made: true })).ok, false);
	assert.equal(validateFlowDeskTaskModelSelectionV1(selection({ performance_label: "provider response copied" })).ok, false);
	assert.equal(validateFlowDeskTaskModelSelectionV1(selection({ extra: "nope" })).ok, false);
});

test("task model selection represents non-dispatchable Gemini as blocked without reselection", () => {
	const blocked = validateFlowDeskTaskModelSelectionV1(selection({
		provider_family: "gemini",
		provider_qualified_model_id: "gemini/gemini-pro-2.5",
		exact_model_availability_label: "non_dispatchable",
		selection_status: "blocked",
		blocked_labels: ["non_dispatchable"],
	}));
	assert.equal(blocked.ok, true, blocked.errors.join("; "));
	const invalid = validateFlowDeskTaskModelSelectionV1(selection({
		provider_family: "gemini",
		provider_qualified_model_id: "gemini/gemini-pro-2.5",
		exact_model_availability_label: "non_dispatchable",
		selection_status: "selected",
		blocked_labels: [],
	}));
	assert.equal(invalid.ok, false);
	assert.match(invalid.errors.join("|"), /non-dispatchable Gemini/);
});

test("task model selection accepts provider prefix aliases for canonical provider families", () => {
	const anthropic = validateFlowDeskTaskModelSelectionV1(selection({
		provider_family: "claude",
		provider_qualified_model_id: "anthropic/claude-haiku-4-5",
	}));
	assert.equal(anthropic.ok, true, anthropic.errors.join("; "));

	const google = validateFlowDeskTaskModelSelectionV1(selection({
		provider_family: "gemini",
		provider_qualified_model_id: "google/gemini-2.5-pro",
	}));
	assert.equal(google.ok, true, google.errors.join("; "));
});

test("task model selection rejects non-equivalent provider family prefixes", () => {
	const invalid = validateFlowDeskTaskModelSelectionV1(selection({
		provider_family: "openai",
		provider_qualified_model_id: "anthropic/claude-haiku-4-5",
	}));
	assert.equal(invalid.ok, false);
	assert.match(invalid.errors.join("|"), /provider_qualified_model_id must match provider_family/);
});
