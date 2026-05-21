import assert from "node:assert/strict";
import test from "node:test";
import { planFlowDeskReviewerAssignmentsV1, validateFlowDeskExactModelAvailabilityCacheV1, type FlowDeskExactModelAvailabilityCacheV1 } from "./index.js";

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
	const invalid = validateFlowDeskExactModelAvailabilityCacheV1(cache({ entries: [{ ...cache().entries[0], provider_qualified_model_id: "claude/latest", highest_tier_eligible: false }] }));
	assert.equal(invalid.ok, false);
});
