import assert from "node:assert/strict";
import test from "node:test";
import {
	type FlowDeskExactModelAvailabilityCacheV1,
	planFlowDeskReviewerFanoutV1,
	revalidateFlowDeskReviewerAssignmentsV1,
	validateFlowDeskReviewerFanoutPlanV1,
} from "./index.js";

type AvailabilityEntry = FlowDeskExactModelAvailabilityCacheV1["entries"][number];

const baseEntry: AvailabilityEntry = {
	entry_id: "entry-claude-1",
	provider_family: "claude",
	provider_identity_ref: "provider-claude-1",
	provider_qualified_model_id: "claude/claude-opus-4-5",
	model_family: "opus",
	registered: true,
	available: true,
	highest_tier_eligible: true,
	availability_ref: "availability-claude-1",
};

function entry(overrides: Partial<AvailabilityEntry>): AvailabilityEntry {
	return { ...baseEntry, ...overrides };
}

function cache(entries: AvailabilityEntry[]): FlowDeskExactModelAvailabilityCacheV1 {
	return {
		schema_version: "flowdesk.exact_model_availability_cache.v1",
		cache_id: "cache-fanout-1",
		local_date: "2026-05-21",
		active_profile_ref: "profile-1",
		opencode_version_ref: "opencode-1.15.6",
		flowdesk_package_version_ref: "flowdesk-0.1.1",
		registry_hash: "hash-registry-1",
		policy_pack_hash: "hash-policy-1",
		auth_account_boundary_ref: "account-1",
		entries,
		dispatch_authority_enabled: false,
		providerCall: false,
		actualLaneLaunch: false,
		runtimeExecution: false,
	};
}

function revalidationFor(entries: AvailabilityEntry[]) {
	return revalidateFlowDeskReviewerAssignmentsV1({
		cache: cache(entries),
		localDate: "2026-05-21",
		activeProfileRef: "profile-1",
		opencodeVersionRef: "opencode-1.15.6",
		flowdeskPackageVersionRef: "flowdesk-0.1.1",
		registryHash: "hash-registry-1",
		policyPackHash: "hash-policy-1",
		authAccountBoundaryRef: "account-1",
	});
}

function fanoutPlan(entries: AvailabilityEntry[], maxConcurrentLaneCount = 3) {
	return planFlowDeskReviewerFanoutV1({
		revalidation: revalidationFor(entries),
		workflowId: "workflow-fanout-1",
		attemptId: "attempt-fanout-1",
		parentSessionRef: "ses-parent-1",
		agentRef: "agent-reviewer",
		requestedAt: "2026-05-21T00:00:00.000Z",
		requestedPerspectives: ["policy_security", "architecture", "verification_implementation"],
		maxConcurrentLaneCount,
		timeoutMs: 30000,
		orphanMaxAgeMs: 60000,
		retryBudget: 1,
		sameModelStaggerMs: 250,
	});
}

const threeHighestTierEntries = [
	baseEntry,
	entry({
		entry_id: "entry-openai-1",
		provider_family: "openai",
		provider_identity_ref: "provider-openai-1",
		provider_qualified_model_id: "openai/gpt-5.5",
		model_family: "gpt-frontier",
		availability_ref: "availability-openai-1",
	}),
	entry({
		entry_id: "entry-gemini-1",
		provider_family: "gemini",
		provider_identity_ref: "provider-gemini-1",
		provider_qualified_model_id: "gemini/gemini-2.5-pro",
		model_family: "gemini-pro",
		availability_ref: "availability-gemini-1",
	}),
];

test("fan-out approves when all required perspectives have registered highest-tier coverage", () => {
	const plan = fanoutPlan(threeHighestTierEntries);
	assert.equal(plan.state, "fanout_ready", plan.errors.join("; "));
	assert.deepEqual(plan.required_perspectives, [
		"policy_security",
		"architecture",
		"verification_implementation",
	]);
	assert.deepEqual(plan.planned_perspectives, plan.required_perspectives);
	assert.equal(plan.runtime_lane_launch_requests.length, plan.required_perspectives.length);
	assert.equal(new Set(plan.runtime_lane_launch_requests.map((request) => request.lane_id)).size, 3);
	assert.equal(new Set(plan.runtime_lane_launch_requests.map((request) => request.provider_qualified_model_id)).size, 3);
	assert.equal(validateFlowDeskReviewerFanoutPlanV1(plan).ok, true);
});

test("fan-out blocks instead of silently shrinking when no highest-tier binding is eligible", () => {
	// All entries have highest_tier_eligible:false → revalidation blocked → plan blocked, not silently shrunk
	const nonEligibleEntries = threeHighestTierEntries.map((e) => ({ ...e, highest_tier_eligible: false }));
	const plan = fanoutPlan(nonEligibleEntries);
	assert.equal(plan.state, "blocked");
	assert.deepEqual(plan.planned_perspectives, []);
	assert.deepEqual(plan.runtime_lane_launch_requests, []);
	assert.ok(plan.blocked_labels.length > 0);
});

test("fan-out approved plan records non-zero budget and timeout reserve evidence", () => {
	const plan = fanoutPlan(threeHighestTierEntries);
	assert.equal(plan.state, "fanout_ready", plan.errors.join("; "));
	// retry_budget and timeout_ms serve as budget/quota reserve fields in the plan schema
	assert.ok(
		plan.runtime_lane_launch_requests.every((request) => request.retry_budget > 0),
		"approved fan-out lanes must carry non-zero retry budget",
	);
	assert.ok(
		plan.runtime_lane_launch_requests.every((request) => request.timeout_ms > 0),
		"approved fan-out lanes must carry non-zero timeout (capacity reserve)",
	);
});

test("fan-out honors requested concurrency cap without shrinking required launch requests", () => {
	const plan = fanoutPlan(threeHighestTierEntries, 2);
	assert.equal(plan.state, "fanout_ready", plan.errors.join("; "));
	assert.equal(plan.max_concurrent_lane_count, 2);
	assert.ok(plan.max_concurrent_lane_count <= 2);
	assert.equal(plan.runtime_lane_launch_requests.length, 3);
	assert.deepEqual(plan.planned_perspectives, plan.required_perspectives);
});
