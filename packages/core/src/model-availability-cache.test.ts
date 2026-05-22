import assert from "node:assert/strict";
import test from "node:test";
import {
	planFlowDeskExactModelAvailabilityCacheRefreshV1,
	planFlowDeskReviewerAssignmentsV1,
	planFlowDeskReviewerFanoutV1,
	revalidateFlowDeskReviewerAssignmentsFromCacheEvidenceV1,
	revalidateFlowDeskReviewerAssignmentsV1,
	validateFlowDeskExactModelAvailabilityCacheV1,
	validateFlowDeskExactModelAvailabilityCacheRefreshPlanV1,
	validateFlowDeskReviewerAssignmentRevalidationV1,
	validateFlowDeskReviewerFanoutPlanV1,
	type FlowDeskExactModelAvailabilityCacheV1,
} from "./index.js";

function cache(overrides: Partial<FlowDeskExactModelAvailabilityCacheV1> = {}): FlowDeskExactModelAvailabilityCacheV1 {
	return {
		schema_version: "flowdesk.exact_model_availability_cache.v1",
		cache_id: "cache-1",
		local_date: "2026-05-21",
		active_profile_ref: "profile-1",
		opencode_version_ref: "opencode-1.15.6",
		flowdesk_package_version_ref: "flowdesk-0.1.1",
		registry_hash: "hash-registry-1",
		policy_pack_hash: "hash-policy-1",
		auth_account_boundary_ref: "account-1",
		entries: [{
			entry_id: "entry-claude-1",
			provider_family: "claude",
			provider_identity_ref: "provider-claude-1",
			provider_qualified_model_id: "claude/claude-opus-4-5",
			model_family: "opus",
			registered: true,
			available: true,
			highest_tier_eligible: true,
			availability_ref: "availability-1",
		}],
		dispatch_authority_enabled: false,
		providerCall: false,
		actualLaneLaunch: false,
		runtimeExecution: false,
		...overrides,
	};
}

function revalidation(overrides: Partial<Parameters<typeof revalidateFlowDeskReviewerAssignmentsV1>[0]> = {}) {
	return revalidateFlowDeskReviewerAssignmentsV1({
		cache: cache(),
		localDate: "2026-05-21",
		activeProfileRef: "profile-1",
		opencodeVersionRef: "opencode-1.15.6",
		flowdeskPackageVersionRef: "flowdesk-0.1.1",
		registryHash: "hash-registry-1",
		policyPackHash: "hash-policy-1",
		authAccountBoundaryRef: "account-1",
		...overrides,
	});
}

function cacheHitRefreshPlan(overrides: Record<string, unknown> = {}): ReturnType<typeof planFlowDeskExactModelAvailabilityCacheRefreshV1> {
	return {
		...planFlowDeskExactModelAvailabilityCacheRefreshV1({
			cache: cache(),
			localDate: "2026-05-21",
			activeProfileRef: "profile-1",
			opencodeVersionRef: "opencode-1.15.6",
			flowdeskPackageVersionRef: "flowdesk-0.1.1",
			registryHash: "hash-registry-1",
			policyPackHash: "hash-policy-1",
			authAccountBoundaryRef: "account-1",
		}),
		...overrides,
	} as ReturnType<typeof planFlowDeskExactModelAvailabilityCacheRefreshV1>;
}

test("exact-model availability cache validates same-day concrete model entries", () => {
	assert.equal(validateFlowDeskExactModelAvailabilityCacheV1(cache()).ok, true);
	const plan = planFlowDeskReviewerAssignmentsV1({ cache: cache(), localDate: "2026-05-21" });
	assert.equal(plan.state, "ready");
	assert.equal(plan.lane_bindings.length, 3);
	assert.equal(new Set(plan.lane_bindings.map((lane) => lane.provider_qualified_model_id)).size, 1);
	assert.equal(plan.providerCall, false);
});

test("availability cache blocks stale date, aliases, and lower-tier substitution", () => {
	const stale = planFlowDeskReviewerAssignmentsV1({ cache: cache(), localDate: "2026-05-22" });
	assert.equal(stale.state, "blocked");
	assert.ok(stale.blocked_labels.includes("cache_not_same_day"));
	assert.deepEqual(stale.lane_bindings, []);
	const invalid = validateFlowDeskExactModelAvailabilityCacheV1(cache({ entries: [{ ...cache().entries[0], provider_qualified_model_id: "claude/latest", highest_tier_eligible: false }] }));
	assert.equal(invalid.ok, false);
	const invalidPlan = planFlowDeskReviewerAssignmentsV1({ cache: cache({ entries: [{ ...cache().entries[0], provider_qualified_model_id: "claude/latest" }] }), localDate: "2026-05-21" });
	assert.equal(invalidPlan.state, "blocked");
	assert.ok(invalidPlan.blocked_labels.includes("cache_invalid"));
	assert.deepEqual(invalidPlan.lane_bindings, []);
});

test("availability cache rejects unknown properties and provider drift", () => {
	const unknown = validateFlowDeskExactModelAvailabilityCacheV1({ ...cache(), providerCallAuthority: true });
	assert.equal(unknown.ok, false);
	assert.match(unknown.errors.join("|"), /unknown properties/);

	const drift = validateFlowDeskExactModelAvailabilityCacheV1(cache({
		entries: [{
			...cache().entries[0],
			provider_family: "openai",
			provider_qualified_model_id: "claude/claude-opus-4-5",
		}],
	}));
	assert.equal(drift.ok, false);
	assert.match(drift.errors.join("|"), /must match provider_qualified_model_id/);
});

test("availability cache refresh plan distinguishes cache hit, missing, and drift", () => {
	const hit = planFlowDeskExactModelAvailabilityCacheRefreshV1({
		cache: cache(),
		localDate: "2026-05-21",
		activeProfileRef: "profile-1",
		opencodeVersionRef: "opencode-1.15.6",
		flowdeskPackageVersionRef: "flowdesk-0.1.1",
		registryHash: "hash-registry-1",
		policyPackHash: "hash-policy-1",
		authAccountBoundaryRef: "account-1",
	});
	assert.equal(hit.state, "cache_hit");
	assert.equal(hit.cache_usable_for_assignment, true);
	assert.equal(hit.discovery_required, false);
	assert.equal(hit.providerCall, false);
	assert.equal(validateFlowDeskExactModelAvailabilityCacheRefreshPlanV1(hit).ok, true);

	const missing = planFlowDeskExactModelAvailabilityCacheRefreshV1({
		localDate: "2026-05-21",
		activeProfileRef: "profile-1",
		opencodeVersionRef: "opencode-1.15.6",
		flowdeskPackageVersionRef: "flowdesk-0.1.1",
		registryHash: "hash-registry-1",
		policyPackHash: "hash-policy-1",
		authAccountBoundaryRef: "account-1",
	});
	assert.equal(missing.state, "refresh_required");
	assert.ok(missing.refresh_reason_labels.includes("cache_missing"));
	assert.equal(missing.discovery_required, true);
	assert.equal(missing.refresh_required, true);
	assert.equal(missing.cache_usable_for_assignment, false);

	const drift = planFlowDeskExactModelAvailabilityCacheRefreshV1({
		cache: cache(),
		localDate: "2026-05-22",
		activeProfileRef: "profile-2",
		opencodeVersionRef: "opencode-1.15.7",
		flowdeskPackageVersionRef: "flowdesk-0.1.2",
		registryHash: "hash-registry-2",
		policyPackHash: "hash-policy-2",
		authAccountBoundaryRef: "account-2",
	});
	assert.equal(drift.state, "refresh_required");
	assert.ok(drift.refresh_reason_labels.includes("cache_not_same_day"));
	assert.ok(drift.refresh_reason_labels.includes("active_profile_changed"));
	assert.ok(drift.refresh_reason_labels.includes("opencode_version_changed"));
	assert.ok(drift.refresh_reason_labels.includes("registry_hash_changed"));
	assert.equal(drift.discovery_attempted, false);
	assert.equal(drift.refresh_attempted, false);
});

test("availability cache refresh plan blocks invalid cache and authority smuggling", () => {
	const invalidCache = planFlowDeskExactModelAvailabilityCacheRefreshV1({
		cache: cache({ entries: [{ ...cache().entries[0], provider_qualified_model_id: "claude/latest" }] }),
		localDate: "2026-05-21",
		activeProfileRef: "profile-1",
		opencodeVersionRef: "opencode-1.15.6",
		flowdeskPackageVersionRef: "flowdesk-0.1.1",
		registryHash: "hash-registry-1",
		policyPackHash: "hash-policy-1",
		authAccountBoundaryRef: "account-1",
	});
	assert.equal(invalidCache.state, "blocked");
	assert.ok(invalidCache.blocked_labels.includes("cache_invalid"));
	assert.equal(invalidCache.cache_usable_for_assignment, false);

	const forged = validateFlowDeskExactModelAvailabilityCacheRefreshPlanV1({
		...planFlowDeskExactModelAvailabilityCacheRefreshV1({
			cache: cache(),
			localDate: "2026-05-21",
			activeProfileRef: "profile-1",
			opencodeVersionRef: "opencode-1.15.6",
			flowdeskPackageVersionRef: "flowdesk-0.1.1",
			registryHash: "hash-registry-1",
			policyPackHash: "hash-policy-1",
			authAccountBoundaryRef: "account-1",
		}),
		providerCall: true,
	});
	assert.equal(forged.ok, false);
	assert.match(forged.errors.join("|"), /cannot attempt discovery, refresh, launch, provider call, or runtime authority/);
});

test("reviewer assignment revalidation blocks stale cache and context drift", () => {
	const ready = revalidation();
	assert.equal(ready.state, "revalidated");
	assert.equal(ready.eligible_bindings.length, 1);
	assert.equal(validateFlowDeskReviewerAssignmentRevalidationV1(ready).ok, true);

	const drift = revalidation({
		localDate: "2026-05-22",
		activeProfileRef: "profile-2",
		policyPackHash: "hash-policy-2",
		authAccountBoundaryRef: "account-2",
	});
	assert.equal(drift.state, "blocked");
	assert.ok(drift.blocked_labels.includes("cache_not_same_day"));
	assert.ok(drift.blocked_labels.includes("active_profile_drift"));
	assert.ok(drift.blocked_labels.includes("policy_pack_hash_drift"));
	assert.ok(drift.blocked_labels.includes("auth_account_boundary_drift"));
	assert.deepEqual(drift.eligible_bindings, []);
});

test("reviewer assignment revalidation rejects alias and lower-tier substitution", () => {
	const alias = revalidation({
		cache: cache({
			entries: [{ ...cache().entries[0], provider_qualified_model_id: "claude/latest" }],
		}),
	});
	assert.equal(alias.state, "blocked");
	assert.ok(alias.blocked_labels.includes("cache_invalid"));

	const lowerTier = revalidation({
		cache: cache({
			entries: [{ ...cache().entries[0], highest_tier_eligible: false }],
		}),
	});
	assert.equal(lowerTier.state, "blocked");
	assert.ok(lowerTier.blocked_labels.includes("registered_available_lower_tier_only"));
	assert.deepEqual(lowerTier.eligible_bindings, []);
});

test("reviewer assignment revalidation requires paired cache-hit refresh evidence", () => {
	const ready = revalidateFlowDeskReviewerAssignmentsFromCacheEvidenceV1({
		cache: cache(),
		cacheRefreshPlan: cacheHitRefreshPlan(),
		localDate: "2026-05-21",
		activeProfileRef: "profile-1",
		opencodeVersionRef: "opencode-1.15.6",
		flowdeskPackageVersionRef: "flowdesk-0.1.1",
		registryHash: "hash-registry-1",
		policyPackHash: "hash-policy-1",
		authAccountBoundaryRef: "account-1",
	});
	assert.equal(ready.state, "revalidated", ready.errors.join("; "));
	assert.equal(ready.eligible_bindings.length, 1);
	assert.equal(validateFlowDeskReviewerAssignmentRevalidationV1(ready).ok, true);

	const refreshRequired = revalidateFlowDeskReviewerAssignmentsFromCacheEvidenceV1({
		cache: cache(),
		cacheRefreshPlan: cacheHitRefreshPlan({
			state: "refresh_required",
			refresh_reason_labels: ["cache_not_same_day"],
			discovery_required: true,
			refresh_required: true,
			cache_usable_for_assignment: false,
		}),
		localDate: "2026-05-21",
		activeProfileRef: "profile-1",
		opencodeVersionRef: "opencode-1.15.6",
		flowdeskPackageVersionRef: "flowdesk-0.1.1",
		registryHash: "hash-registry-1",
		policyPackHash: "hash-policy-1",
		authAccountBoundaryRef: "account-1",
	});
	assert.equal(refreshRequired.state, "blocked");
	assert.ok(refreshRequired.blocked_labels.includes("cache_refresh_not_cache_hit"));
	assert.ok(refreshRequired.blocked_labels.includes("cache_refresh_not_usable_for_assignment"));
	assert.deepEqual(refreshRequired.eligible_bindings, []);
});

test("reviewer assignment revalidation blocks cache refresh evidence drift", () => {
	const drift = revalidateFlowDeskReviewerAssignmentsFromCacheEvidenceV1({
		cache: cache(),
		cacheRefreshPlan: cacheHitRefreshPlan({
			cache_id: "cache-other",
			expected_policy_pack_hash: "hash-policy-other",
			cache_registry_hash: "hash-registry-other",
		}),
		localDate: "2026-05-21",
		activeProfileRef: "profile-1",
		opencodeVersionRef: "opencode-1.15.6",
		flowdeskPackageVersionRef: "flowdesk-0.1.1",
		registryHash: "hash-registry-1",
		policyPackHash: "hash-policy-1",
		authAccountBoundaryRef: "account-1",
	});
	assert.equal(drift.state, "blocked");
	assert.ok(drift.blocked_labels.includes("cache_refresh_cache_id_mismatch"));
	assert.ok(drift.blocked_labels.includes("cache_refresh_expected_context_drift"));
	assert.ok(drift.blocked_labels.includes("cache_refresh_cache_context_drift"));
	assert.deepEqual(drift.eligible_bindings, []);

	const forged = revalidateFlowDeskReviewerAssignmentsFromCacheEvidenceV1({
		cache: cache(),
		cacheRefreshPlan: cacheHitRefreshPlan({ providerCall: true }),
		localDate: "2026-05-21",
		activeProfileRef: "profile-1",
		opencodeVersionRef: "opencode-1.15.6",
		flowdeskPackageVersionRef: "flowdesk-0.1.1",
		registryHash: "hash-registry-1",
		policyPackHash: "hash-policy-1",
		authAccountBoundaryRef: "account-1",
	});
	assert.equal(forged.state, "blocked");
	assert.ok(forged.blocked_labels.includes("cache_refresh_plan_invalid"));
	assert.match(forged.errors.join("|"), /provider call/);
});

test("reviewer fanout plan deterministically materializes launch requests without launching lanes", () => {
	const plan = planFlowDeskReviewerFanoutV1({
		revalidation: revalidation(),
		workflowId: "workflow-1",
		attemptId: "attempt-1",
		parentSessionRef: "ses-parent-1",
		agentRef: "agent-reviewer",
		requestedAt: "2026-05-21T00:00:00.000Z",
		preLaunchAuditRef: "audit-pre-launch-1",
		laneLaunchApprovalRef: "approval-lane-launch-1",
	});
	assert.equal(plan.state, "fanout_ready", plan.errors.join("; "));
	assert.equal(plan.runtime_lane_launch_requests.length, 3);
	assert.deepEqual(plan.planned_perspectives, ["policy_security", "architecture", "verification_implementation"]);
	assert.equal(new Set(plan.runtime_lane_launch_requests.map((request) => request.provider_qualified_model_id)).size, 1);
	assert.equal(plan.launch_attempted, false);
	assert.equal(plan.approval_inferred, false);
	assert.equal(plan.providerCall, false);
	assert.equal(plan.actualLaneLaunch, false);
	assert.equal(validateFlowDeskReviewerFanoutPlanV1(plan).ok, true);
});

test("reviewer fanout plan blocks missing perspectives and authority smuggling", () => {
	const blocked = planFlowDeskReviewerFanoutV1({
		revalidation: revalidation({ localDate: "2026-05-22" }),
		workflowId: "workflow-1",
		attemptId: "attempt-1",
		parentSessionRef: "ses-parent-1",
		agentRef: "agent-reviewer",
		requestedAt: "2026-05-21T00:00:00.000Z",
	});
	assert.equal(blocked.state, "blocked");
	assert.ok(blocked.blocked_labels.includes("assignment_revalidation_blocked"));
	assert.equal(blocked.runtime_lane_launch_requests.length, 0);

	const missingPerspective = validateFlowDeskReviewerFanoutPlanV1({
		...planFlowDeskReviewerFanoutV1({
			revalidation: revalidation(),
			workflowId: "workflow-1",
			attemptId: "attempt-1",
			parentSessionRef: "ses-parent-1",
			agentRef: "agent-reviewer",
			requestedAt: "2026-05-21T00:00:00.000Z",
		}),
		planned_perspectives: ["policy_security", "architecture"],
	});
	assert.equal(missingPerspective.ok, false);
	assert.match(missingPerspective.errors.join("|"), /cover every required perspective/);

	const forged = validateFlowDeskReviewerFanoutPlanV1({
		...planFlowDeskReviewerFanoutV1({
			revalidation: revalidation(),
			workflowId: "workflow-1",
			attemptId: "attempt-1",
			parentSessionRef: "ses-parent-1",
			agentRef: "agent-reviewer",
			requestedAt: "2026-05-21T00:00:00.000Z",
		}),
		actualLaneLaunch: true,
	});
	assert.equal(forged.ok, false);
	assert.match(forged.errors.join("|"), /cannot launch lanes/);
});
