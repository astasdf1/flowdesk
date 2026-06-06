import assert from "node:assert/strict";
import test from "node:test";
import {
	type FlowDeskExactModelAvailabilityCacheV1,
	evaluateFlowDeskReviewerBindingPredicatesV1,
	materializeFlowDeskTopTierReviewBindingInventorySnapshotV1,
	materializeFlowDeskExactModelAvailabilityCacheFromProviderAcquisitionResultV1,
	planFlowDeskExactModelAvailabilityCacheAcquisitionV1,
	planFlowDeskExactModelAvailabilityCacheRefreshV1,
	planFlowDeskReviewerAssignmentsV1,
	planFlowDeskReviewerFanoutV1,
	recordFlowDeskExactModelAvailabilityCacheProviderAcquisitionResultV1,
	revalidateFlowDeskReviewerAssignmentsFromCacheEvidenceV1,
	revalidateFlowDeskReviewerAssignmentsV1,
	validateFlowDeskExactModelAvailabilityCacheAcquisitionPlanV1,
	validateFlowDeskExactModelAvailabilityCacheProviderAcquisitionResultV1,
	validateFlowDeskExactModelAvailabilityCacheRefreshPlanV1,
	validateFlowDeskExactModelAvailabilityCacheV1,
	validateFlowDeskReviewerAssignmentRevalidationV1,
	validateFlowDeskReviewerFanoutPlanV1,
	validateTopTierReviewBindingInventoryV1,
} from "./index.js";

function cache(
	overrides: Partial<FlowDeskExactModelAvailabilityCacheV1> = {},
): FlowDeskExactModelAvailabilityCacheV1 {
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
		entries: [
			{
				entry_id: "entry-claude-1",
				provider_family: "claude",
				provider_identity_ref: "provider-claude-1",
				provider_qualified_model_id: "claude/claude-opus-4-5",
				model_family: "opus",
				registered: true,
				available: true,
				highest_tier_eligible: true,
				availability_ref: "availability-1",
			},
		],
		dispatch_authority_enabled: false,
		providerCall: false,
		actualLaneLaunch: false,
		runtimeExecution: false,
		...overrides,
	};
}

function revalidation(
	overrides: Partial<
		Parameters<typeof revalidateFlowDeskReviewerAssignmentsV1>[0]
	> = {},
) {
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

function cacheHitRefreshPlan(
	overrides: Record<string, unknown> = {},
): ReturnType<typeof planFlowDeskExactModelAvailabilityCacheRefreshV1> {
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

function refreshRequiredPlan(
	overrides: Record<string, unknown> = {},
): ReturnType<typeof planFlowDeskExactModelAvailabilityCacheRefreshV1> {
	return {
		...planFlowDeskExactModelAvailabilityCacheRefreshV1({
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
	const plan = planFlowDeskReviewerAssignmentsV1({
		cache: cache(),
		localDate: "2026-05-21",
	});
	assert.equal(plan.state, "ready");
	assert.equal(plan.lane_bindings.length, 3);
	assert.deepEqual(
		plan.lane_bindings.map((lane) => lane.perspective),
		["policy_security", "architecture", "verification_implementation"],
	);
	assert.equal(
		new Set(plan.lane_bindings.map((lane) => lane.perspective)).size,
		3,
		"same concrete model assignment must not collapse reviewer perspectives",
	);
	assert.equal(
		new Set(plan.lane_bindings.map((lane) => lane.provider_qualified_model_id))
			.size,
		1,
	);
	assert.equal(
		new Set(plan.lane_bindings.map((lane) => lane.entry_id)).size,
		1,
		"one highest-tier concrete binding may be reused across distinct perspective lanes",
	);
	assert.equal(plan.providerCall, false);
	assert.equal(plan.dispatch_authority_enabled, false);
	assert.equal(plan.actualLaneLaunch, false);
	assert.equal(plan.runtimeExecution, false);
});

test("reviewer binding predicates include only available highest-tier registered bindings", () => {
	const evaluation = evaluateFlowDeskReviewerBindingPredicatesV1({
		cache: cache(),
		localDate: "2026-05-21",
		requestedProviderQualifiedModelIds: ["claude/claude-opus-4-5"],
	});
	assert.equal(evaluation.state, "evaluated", evaluation.errors.join("; "));
	assert.equal(evaluation.binding_states.length, 1);
	assert.deepEqual(evaluation.binding_states[0], {
		entry_id: "entry-claude-1",
		provider_qualified_model_id: "claude/claude-opus-4-5",
		registered: true,
		available: true,
		highest_tier_eligible: true,
		inclusion: "included",
		labels: ["registered", "available_highest_tier"],
		blocked_labels: [],
		safe_next_actions: ["/flowdesk-status"],
	});
	assert.equal(evaluation.providerCall, false);
	assert.equal(evaluation.actualLaneLaunch, false);
});

test("reviewer binding predicates reject lower-tier substitution explicitly", () => {
	const lowerTierCache = cache({
		entries: [
			{ ...cache().entries[0], available: false, highest_tier_eligible: false },
			{
				entry_id: "entry-claude-sonnet-lower",
				provider_family: "claude",
				provider_identity_ref: "provider-claude-1",
				provider_qualified_model_id: "claude/claude-sonnet-4-5",
				model_family: "sonnet",
				registered: true,
				available: true,
				highest_tier_eligible: false,
				availability_ref: "availability-sonnet",
			},
		],
	});
	const evaluation = evaluateFlowDeskReviewerBindingPredicatesV1({
		cache: lowerTierCache,
		localDate: "2026-05-21",
	});
	assert.equal(evaluation.state, "blocked");
	const lower = evaluation.binding_states.find((state) => state.entry_id === "entry-claude-sonnet-lower");
	assert.equal(lower?.inclusion, "excluded");
	assert.ok(lower?.blocked_labels.includes("available_but_not_highest_tier"));
	assert.ok(lower?.blocked_labels.includes("lower_tier_substitution_rejected"));
	const plan = planFlowDeskReviewerAssignmentsV1({
		cache: lowerTierCache,
		localDate: "2026-05-21",
	});
	assert.equal(plan.state, "blocked");
	assert.deepEqual(plan.lane_bindings, []);
	assert.ok(plan.blocked_labels.includes("lower_tier_substitution_rejected"));
});

test("reviewer assignment keeps one highest-tier model for all perspectives and rejects lower-tier substitution", () => {
	const highestAndLowerTierCache = cache({
		entries: [
			cache().entries[0],
			{
				entry_id: "entry-claude-sonnet-lower",
				provider_family: "claude",
				provider_identity_ref: "provider-claude-1",
				provider_qualified_model_id: "claude/claude-sonnet-4-5",
				model_family: "sonnet",
				registered: true,
				available: true,
				highest_tier_eligible: false,
				availability_ref: "availability-sonnet",
			},
		],
	});

	const lowerRequested = evaluateFlowDeskReviewerBindingPredicatesV1({
		cache: highestAndLowerTierCache,
		localDate: "2026-05-21",
		requestedProviderQualifiedModelIds: ["claude/claude-sonnet-4-5"],
	});
	assert.equal(lowerRequested.state, "blocked");
	assert.equal(lowerRequested.binding_states[0]?.inclusion, "excluded");
	assert.ok(
		lowerRequested.binding_states[0]?.blocked_labels.includes(
			"lower_tier_substitution_rejected",
		),
	);

	const plan = planFlowDeskReviewerAssignmentsV1({
		cache: highestAndLowerTierCache,
		localDate: "2026-05-21",
	});
	assert.equal(plan.state, "ready", plan.errors.join("; "));
	assert.equal(plan.lane_bindings.length, 3);
	assert.deepEqual(
		plan.lane_bindings.map((lane) => lane.perspective),
		["policy_security", "architecture", "verification_implementation"],
	);
	assert.deepEqual(
		[...new Set(plan.lane_bindings.map((lane) => lane.entry_id))],
		["entry-claude-1"],
	);
	assert.deepEqual(
		[...new Set(plan.lane_bindings.map((lane) => lane.provider_qualified_model_id))],
		["claude/claude-opus-4-5"],
	);
	assert.equal(plan.dispatch_authority_enabled, false);
	assert.equal(plan.providerCall, false);
	assert.equal(plan.actualLaneLaunch, false);
	assert.equal(plan.runtimeExecution, false);
});

test("reviewer binding predicates block stale or missing cache availability", () => {
	const stale = evaluateFlowDeskReviewerBindingPredicatesV1({
		cache: cache(),
		localDate: "2026-05-22",
	});
	assert.equal(stale.state, "blocked");
	assert.ok(stale.blocked_labels.includes("cache_not_same_day"));
	assert.equal(stale.binding_states[0]?.available, false);
	assert.equal(stale.binding_states[0]?.inclusion, "blocked");
	const missing = evaluateFlowDeskReviewerBindingPredicatesV1({
		localDate: "2026-05-21",
		requestedProviderQualifiedModelIds: ["claude/claude-opus-4-5"],
	});
	assert.equal(missing.state, "blocked");
	assert.ok(missing.blocked_labels.includes("cache_missing"));
	assert.equal(missing.binding_states[0]?.registered, false);
	assert.equal(missing.providerCall, false);
});

test("reviewer binding predicates distinguish registered unavailable and unregistered models", () => {
	const unavailable = evaluateFlowDeskReviewerBindingPredicatesV1({
		cache: cache({
			entries: [{ ...cache().entries[0], available: false, highest_tier_eligible: false }],
		}),
		localDate: "2026-05-21",
	});
	assert.equal(unavailable.binding_states[0]?.registered, true);
	assert.equal(unavailable.binding_states[0]?.available, false);
	assert.equal(unavailable.binding_states[0]?.inclusion, "excluded");
	assert.ok(unavailable.binding_states[0]?.blocked_labels.includes("registered_but_unavailable"));
	assert.ok(unavailable.binding_states[0]?.safe_next_actions.includes("/flowdesk-usage"));
	const unregistered = evaluateFlowDeskReviewerBindingPredicatesV1({
		cache: cache(),
		localDate: "2026-05-21",
		requestedProviderQualifiedModelIds: ["openai/gpt-5.5"],
	});
	assert.equal(unregistered.binding_states[0]?.registered, false);
	assert.equal(unregistered.binding_states[0]?.inclusion, "blocked");
	assert.ok(unregistered.binding_states[0]?.blocked_labels.includes("binding_unregistered"));
	assert.ok(unregistered.blocked_labels.includes("binding_unregistered"));
});

test("top tier review binding inventory snapshot materializes included excluded and blocked predicate refs", () => {
	const evaluation = evaluateFlowDeskReviewerBindingPredicatesV1({
		cache: cache({
			entries: [
				cache().entries[0],
				{
					entry_id: "entry-gpt-unavailable",
					provider_family: "openai",
					provider_identity_ref: "provider-openai-1",
					provider_qualified_model_id: "openai/gpt-5.5",
					model_family: "gpt-5",
					registered: true,
					available: false,
					highest_tier_eligible: false,
					availability_ref: "availability-gpt-unavailable",
				},
			],
		}),
		localDate: "2026-05-21",
		requestedProviderQualifiedModelIds: [
			"claude/claude-opus-4-5",
			"openai/gpt-5.5",
			"gemini/gemini-2.5-pro",
		],
	});
	const result = materializeFlowDeskTopTierReviewBindingInventorySnapshotV1({
		predicateEvaluation: evaluation,
		inventoryId: "inventory-1",
		workflowId: "workflow-1",
		planRevisionId: "plan-1",
		createdAt: "2026-05-21T00:00:00.000Z",
		evidenceRefs: ["predicate-evaluation-1"],
	});
	assert.equal(result.state, "materialized", result.errors.join("; "));
	assert.ok(result.inventory);
	assert.deepEqual(result.inventory.included_binding_refs, ["entry-claude-1"]);
	assert.deepEqual(result.inventory.excluded_binding_refs, ["entry-gpt-unavailable"]);
	assert.deepEqual(result.inventory.blocked_binding_refs, ["binding-state-3"]);
	assert.ok(result.inventory.evidence_refs.includes("predicate-evaluation-1"));
	assert.ok(result.inventory.evidence_refs.includes("cache-1"));
	assert.ok(result.inventory.blocked_labels.includes("registered_but_unavailable"));
	assert.ok(result.inventory.blocked_labels.includes("binding_unregistered"));
	assert.equal(validateTopTierReviewBindingInventoryV1(result.inventory).ok, true);
	assert.equal(result.inventory.providerCall, false);
	assert.equal(result.inventory.actualLaneLaunch, false);
	assert.equal(result.inventory.runtimeExecution, false);
	assert.equal(result.inventory.fallback_authority_enabled, false);
	assert.equal(result.inventory.guard_replacement_authority_enabled, false);
	assert.equal(result.inventory.external_write_authority_enabled, false);
});

test("top tier review binding inventory snapshot preserves lower-tier substitution rejection label", () => {
	const evaluation = evaluateFlowDeskReviewerBindingPredicatesV1({
		cache: cache({
			entries: [
				cache().entries[0],
				{
					entry_id: "entry-claude-sonnet-lower",
					provider_family: "claude",
					provider_identity_ref: "provider-claude-1",
					provider_qualified_model_id: "claude/claude-sonnet-4-5",
					model_family: "sonnet",
					registered: true,
					available: true,
					highest_tier_eligible: false,
					availability_ref: "availability-sonnet",
				},
			],
		}),
		localDate: "2026-05-21",
	});
	const result = materializeFlowDeskTopTierReviewBindingInventorySnapshotV1({
		predicateEvaluation: evaluation,
		inventoryId: "inventory-2",
		workflowId: "workflow-1",
		planRevisionId: "plan-1",
		createdAt: "2026-05-21T00:00:00.000Z",
	});
	assert.equal(result.state, "materialized", result.errors.join("; "));
	assert.ok(result.inventory?.labels.includes("lower_tier_substitution_rejected"));
	assert.ok(result.inventory?.blocked_labels.includes("lower_tier_substitution_rejected"));
	assert.deepEqual(result.inventory?.excluded_binding_refs, ["entry-claude-sonnet-lower"]);
});

test("top tier review binding inventory rejects raw payload path markers and authority smuggling", () => {
	const evaluation = evaluateFlowDeskReviewerBindingPredicatesV1({
		cache: cache(),
		localDate: "2026-05-21",
	});
	const result = materializeFlowDeskTopTierReviewBindingInventorySnapshotV1({
		predicateEvaluation: evaluation,
		inventoryId: "inventory-3",
		workflowId: "workflow-1",
		planRevisionId: "plan-1",
		createdAt: "2026-05-21T00:00:00.000Z",
	});
	assert.ok(result.inventory);
	assert.equal(validateTopTierReviewBindingInventoryV1({ ...result.inventory, labels: ["provider payload"] }).ok, false);
	assert.equal(validateTopTierReviewBindingInventoryV1({ ...result.inventory, evidence_refs: ["/Users/example/raw"] }).ok, false);
	assert.equal(validateTopTierReviewBindingInventoryV1({ ...result.inventory, providerCall: true }).ok, false);
	assert.equal(validateTopTierReviewBindingInventoryV1({ ...result.inventory, actualLaneLaunch: true }).ok, false);
	assert.equal(validateTopTierReviewBindingInventoryV1({ ...result.inventory, fallback_authority_enabled: true }).ok, false);
	assert.equal(validateTopTierReviewBindingInventoryV1({ ...result.inventory, guard_replacement_authority_enabled: true }).ok, false);
	assert.equal(validateTopTierReviewBindingInventoryV1({ ...result.inventory, external_write_authority_enabled: true }).ok, false);
});

test("top tier review binding inventory records safe next actions for blocked and unavailable bindings", () => {
	const evaluation = evaluateFlowDeskReviewerBindingPredicatesV1({
		cache: cache({
			entries: [{ ...cache().entries[0], available: false, highest_tier_eligible: false }],
		}),
		localDate: "2026-05-21",
		requestedProviderQualifiedModelIds: ["claude/claude-opus-4-5", "openai/gpt-5.5"],
	});
	const result = materializeFlowDeskTopTierReviewBindingInventorySnapshotV1({
		predicateEvaluation: evaluation,
		inventoryId: "inventory-4",
		workflowId: "workflow-1",
		planRevisionId: "plan-1",
		createdAt: "2026-05-21T00:00:00.000Z",
	});
	assert.equal(result.state, "materialized", result.errors.join("; "));
	assert.ok(result.inventory?.safe_next_actions.includes("/flowdesk-usage"));
	assert.ok(result.inventory?.safe_next_actions.includes("/flowdesk-doctor"));
	assert.ok(result.inventory?.safe_next_actions.includes("/flowdesk-plan"));
	assert.ok(result.inventory?.safe_next_actions.includes("/flowdesk-status"));
});

test("availability cache blocks stale date, aliases, and lower-tier substitution", () => {
	const stale = planFlowDeskReviewerAssignmentsV1({
		cache: cache(),
		localDate: "2026-05-22",
	});
	assert.equal(stale.state, "blocked");
	assert.ok(stale.blocked_labels.includes("cache_not_same_day"));
	assert.deepEqual(stale.lane_bindings, []);
	const invalid = validateFlowDeskExactModelAvailabilityCacheV1(
		cache({
			entries: [
				{
					...cache().entries[0],
					provider_qualified_model_id: "claude/latest",
					highest_tier_eligible: false,
				},
			],
		}),
	);
	assert.equal(invalid.ok, false);
	const invalidPlan = planFlowDeskReviewerAssignmentsV1({
		cache: cache({
			entries: [
				{ ...cache().entries[0], provider_qualified_model_id: "claude/latest" },
			],
		}),
		localDate: "2026-05-21",
	});
	assert.equal(invalidPlan.state, "blocked");
	assert.ok(invalidPlan.blocked_labels.includes("cache_invalid"));
	assert.deepEqual(invalidPlan.lane_bindings, []);
});

test("reviewer assignment keeps highest-tier eligibility primary and uses usage as tie-breaker", () => {
	const plan = planFlowDeskReviewerAssignmentsV1({
		cache: cache({
			entries: [
				{
					entry_id: "entry-claude-critical",
					provider_family: "claude",
					provider_identity_ref: "provider-claude-1",
					provider_qualified_model_id: "claude/claude-opus-4-5",
					model_family: "opus",
					registered: true,
					available: true,
					highest_tier_eligible: true,
					availability_ref: "availability-critical",
				},
				{
					entry_id: "entry-openai-ok",
					provider_family: "openai",
					provider_identity_ref: "provider-openai-1",
					provider_qualified_model_id: "openai/gpt-5.5",
					model_family: "gpt-frontier",
					registered: true,
					available: true,
					highest_tier_eligible: true,
					availability_ref: "availability-ok",
				},
				{
					entry_id: "entry-gemini-lower-tier",
					provider_family: "gemini",
					provider_identity_ref: "provider-gemini-1",
					provider_qualified_model_id: "gemini/gemini-2.5-pro",
					model_family: "gemini-pro",
					registered: true,
					available: true,
					highest_tier_eligible: false,
					availability_ref: "availability-lower-tier",
				},
			],
		}),
		localDate: "2026-05-21",
		usagePressureByEntryId: {
			"entry-claude-critical": "critical",
			"entry-openai-ok": "ok",
		},
	});
	assert.equal(plan.state, "ready");
	assert.equal(plan.lane_bindings[0]?.entry_id, "entry-openai-ok");
	assert.equal(plan.lane_bindings.some((binding) => binding.entry_id === "entry-gemini-lower-tier"), false);
	assert.equal(plan.providerCall, false);
});

test("reviewer assignment honors suitability preference before usage pressure", () => {
	const plan = planFlowDeskReviewerAssignmentsV1({
		cache: cache({
			entries: [
				cache().entries[0],
				{
					entry_id: "entry-openai-ok",
					provider_family: "openai",
					provider_identity_ref: "provider-openai-1",
					provider_qualified_model_id: "openai/gpt-5.5",
					model_family: "gpt-frontier",
					registered: true,
					available: true,
					highest_tier_eligible: true,
					availability_ref: "availability-ok",
				},
			],
		}),
		localDate: "2026-05-21",
		preferredModelFamilies: ["opus", "gpt-frontier"],
		usagePressureByEntryId: {
			"entry-claude-1": "critical",
			"entry-openai-ok": "ok",
		},
	});
	assert.equal(plan.state, "ready");
	assert.equal(plan.lane_bindings[0]?.entry_id, "entry-claude-1");
	assert.equal(plan.providerCall, false);
});

test("reviewer assignment prefers distinct concrete models before repeating one", () => {
	const plan = planFlowDeskReviewerAssignmentsV1({
		cache: cache({
			entries: [
				cache().entries[0],
				{
					entry_id: "entry-openai-1",
					provider_family: "openai",
					provider_identity_ref: "provider-openai-1",
					provider_qualified_model_id: "openai/gpt-5.5",
					model_family: "gpt-frontier",
					registered: true,
					available: true,
					highest_tier_eligible: true,
					availability_ref: "availability-openai-1",
				},
				{
					entry_id: "entry-openai-2",
					provider_family: "openai",
					provider_identity_ref: "provider-openai-2",
					provider_qualified_model_id: "openai/gpt-5.5",
					model_family: "gpt-frontier",
					registered: true,
					available: true,
					highest_tier_eligible: true,
					availability_ref: "availability-openai-2",
				},
			],
		}),
		localDate: "2026-05-21",
	});
	assert.equal(plan.state, "ready");
	assert.deepEqual(
		plan.lane_bindings.map((binding) => binding.provider_qualified_model_id),
		["claude/claude-opus-4-5", "openai/gpt-5.5", "openai/gpt-5.5"],
	);
	assert.equal(plan.providerCall, false);
});

test("availability cache rejects unknown properties and provider drift", () => {
	const unknown = validateFlowDeskExactModelAvailabilityCacheV1({
		...cache(),
		providerCallAuthority: true,
	});
	assert.equal(unknown.ok, false);
	assert.match(unknown.errors.join("|"), /unknown properties/);

	const drift = validateFlowDeskExactModelAvailabilityCacheV1(
		cache({
			entries: [
				{
					...cache().entries[0],
					provider_family: "openai",
					provider_qualified_model_id: "claude/claude-opus-4-5",
				},
			],
		}),
	);
	assert.equal(drift.ok, false);
	assert.match(
		drift.errors.join("|"),
		/must match provider_qualified_model_id/,
	);
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
	assert.equal(
		validateFlowDeskExactModelAvailabilityCacheRefreshPlanV1(hit).ok,
		true,
	);

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

test("same-day cache hit is reusable for assignment while stale daily cache plans refresh", () => {
	const sameDayRefresh = cacheHitRefreshPlan();
	const sameDayAcquisition = planFlowDeskExactModelAvailabilityCacheAcquisitionV1({
		refreshPlan: sameDayRefresh,
	});
	const sameDayRevalidation = revalidateFlowDeskReviewerAssignmentsFromCacheEvidenceV1({
		cache: cache(),
		cacheRefreshPlan: sameDayRefresh,
		localDate: "2026-05-21",
		activeProfileRef: "profile-1",
		opencodeVersionRef: "opencode-1.15.6",
		flowdeskPackageVersionRef: "flowdesk-0.1.1",
		registryHash: "hash-registry-1",
		policyPackHash: "hash-policy-1",
		authAccountBoundaryRef: "account-1",
	});
	assert.equal(sameDayRefresh.state, "cache_hit");
	assert.equal(sameDayAcquisition.state, "acquisition_not_needed");
	assert.equal(sameDayAcquisition.providerCall, false);
	assert.equal(sameDayRevalidation.state, "revalidated");
	assert.equal(sameDayRevalidation.providerCall, false);

	const staleRefresh = planFlowDeskExactModelAvailabilityCacheRefreshV1({
		cache: cache(),
		localDate: "2026-05-22",
		activeProfileRef: "profile-1",
		opencodeVersionRef: "opencode-1.15.6",
		flowdeskPackageVersionRef: "flowdesk-0.1.1",
		registryHash: "hash-registry-1",
		policyPackHash: "hash-policy-1",
		authAccountBoundaryRef: "account-1",
	});
	const staleAcquisition = planFlowDeskExactModelAvailabilityCacheAcquisitionV1({
		refreshPlan: staleRefresh,
	});
	const staleRevalidation = revalidateFlowDeskReviewerAssignmentsFromCacheEvidenceV1({
		cache: cache(),
		cacheRefreshPlan: staleRefresh,
		localDate: "2026-05-22",
		activeProfileRef: "profile-1",
		opencodeVersionRef: "opencode-1.15.6",
		flowdeskPackageVersionRef: "flowdesk-0.1.1",
		registryHash: "hash-registry-1",
		policyPackHash: "hash-policy-1",
		authAccountBoundaryRef: "account-1",
	});
	assert.equal(staleRefresh.state, "refresh_required");
	assert.ok(staleRefresh.refresh_reason_labels.includes("cache_not_same_day"));
	assert.equal(staleRefresh.cache_usable_for_assignment, false);
	assert.equal(staleAcquisition.state, "acquisition_planned");
	assert.equal(staleAcquisition.providerCall, false);
	assert.equal(staleRevalidation.state, "blocked");
	assert.ok(staleRevalidation.blocked_labels.includes("cache_not_same_day"));
	assert.ok(staleRevalidation.blocked_labels.includes("cache_refresh_not_cache_hit"));
	assert.deepEqual(staleRevalidation.eligible_bindings, []);
});

test("availability cache refresh plan blocks invalid cache and authority smuggling", () => {
	const invalidCache = planFlowDeskExactModelAvailabilityCacheRefreshV1({
		cache: cache({
			entries: [
				{ ...cache().entries[0], provider_qualified_model_id: "claude/latest" },
			],
		}),
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
	assert.match(
		forged.errors.join("|"),
		/cannot attempt discovery, refresh, launch, provider call, or runtime authority/,
	);
});

test("availability cache acquisition plan distinguishes no-op, planned, and blocked states", () => {
	const noOp = planFlowDeskExactModelAvailabilityCacheAcquisitionV1({
		refreshPlan: cacheHitRefreshPlan(),
	});
	assert.equal(noOp.state, "acquisition_not_needed");
	assert.equal(noOp.acquisition_required, false);
	assert.equal(noOp.cache_usable_for_assignment, true);
	assert.equal(noOp.refresh_plan_state, "cache_hit");
	assert.deepEqual(noOp.blocked_labels, []);
	assert.deepEqual(noOp.acquisition_reason_labels, []);
	assert.equal(
		validateFlowDeskExactModelAvailabilityCacheAcquisitionPlanV1(noOp).ok,
		true,
	);

	const planned = planFlowDeskExactModelAvailabilityCacheAcquisitionV1({
		refreshPlan: refreshRequiredPlan(),
	});
	assert.equal(planned.state, "acquisition_planned");
	assert.equal(planned.acquisition_required, true);
	assert.equal(planned.cache_usable_for_assignment, false);
	assert.equal(planned.refresh_plan_state, "refresh_required");
	assert.ok(planned.acquisition_reason_labels.includes("cache_missing"));
	assert.deepEqual(planned.blocked_labels, []);
	assert.equal(
		validateFlowDeskExactModelAvailabilityCacheAcquisitionPlanV1(planned).ok,
		true,
	);

	const blocked = planFlowDeskExactModelAvailabilityCacheAcquisitionV1({
		refreshPlan: {
			...refreshRequiredPlan(),
			state: "blocked",
			blocked_labels: ["cache_invalid"],
			refresh_reason_labels: [],
			discovery_required: true,
			refresh_required: false,
			cache_usable_for_assignment: false,
		},
	});
	assert.equal(blocked.state, "blocked");
	assert.ok(blocked.blocked_labels.includes("refresh_plan_blocked"));
	assert.deepEqual(blocked.acquisition_reason_labels, []);
	assert.equal(blocked.acquisition_required, false);
	assert.equal(
		validateFlowDeskExactModelAvailabilityCacheAcquisitionPlanV1(blocked).ok,
		true,
	);
});

test("availability cache acquisition plan blocks invalid refresh evidence and authority smuggling", () => {
	const invalidRefreshPlan =
		planFlowDeskExactModelAvailabilityCacheAcquisitionV1({
			refreshPlan: {
				...cacheHitRefreshPlan(),
				providerCall: true,
			} as unknown as ReturnType<
				typeof planFlowDeskExactModelAvailabilityCacheRefreshV1
			>,
		});
	assert.equal(invalidRefreshPlan.state, "blocked");
	assert.ok(invalidRefreshPlan.blocked_labels.includes("refresh_plan_invalid"));
	assert.equal(invalidRefreshPlan.refresh_plan_state, "invalid");
	assert.match(
		invalidRefreshPlan.errors.join("|"),
		/refresh_plan: .*provider call/,
	);

	const blockedRefreshPlan =
		planFlowDeskExactModelAvailabilityCacheAcquisitionV1({
			refreshPlan: planFlowDeskExactModelAvailabilityCacheRefreshV1({
				cache: cache({
					entries: [
						{
							...cache().entries[0],
							provider_qualified_model_id: "claude/latest",
						},
					],
				}),
				localDate: "2026-05-21",
				activeProfileRef: "profile-1",
				opencodeVersionRef: "opencode-1.15.6",
				flowdeskPackageVersionRef: "flowdesk-0.1.1",
				registryHash: "hash-registry-1",
				policyPackHash: "hash-policy-1",
				authAccountBoundaryRef: "account-1",
			}),
		});
	assert.equal(blockedRefreshPlan.state, "blocked");
	assert.ok(blockedRefreshPlan.blocked_labels.includes("refresh_plan_blocked"));
	assert.equal(blockedRefreshPlan.refresh_plan_state, "blocked");
	assert.equal(
		validateFlowDeskExactModelAvailabilityCacheAcquisitionPlanV1(
			blockedRefreshPlan,
		).ok,
		true,
	);

	const forgedProviderCall =
		validateFlowDeskExactModelAvailabilityCacheAcquisitionPlanV1({
			...planFlowDeskExactModelAvailabilityCacheAcquisitionV1({
				refreshPlan: refreshRequiredPlan(),
			}),
			providerCall: true,
		} as unknown);
	assert.equal(forgedProviderCall.ok, false);
	assert.match(
		forgedProviderCall.errors.join("|"),
		/cannot attempt discovery, refresh, acquisition, launch, provider call, or runtime authority/,
	);

	const forgedAttempts =
		validateFlowDeskExactModelAvailabilityCacheAcquisitionPlanV1({
			...planFlowDeskExactModelAvailabilityCacheAcquisitionV1({
				refreshPlan: refreshRequiredPlan(),
			}),
			discovery_attempted: true,
			refresh_attempted: true,
			acquisition_attempted: true,
		} as unknown);
	assert.equal(forgedAttempts.ok, false);
	assert.match(
		forgedAttempts.errors.join("|"),
		/cannot attempt discovery, refresh, acquisition, launch, provider call, or runtime authority/,
	);

	const unknown = validateFlowDeskExactModelAvailabilityCacheAcquisitionPlanV1({
		...planFlowDeskExactModelAvailabilityCacheAcquisitionV1({
			refreshPlan: refreshRequiredPlan(),
		}),
		fallback_authority_enabled: true,
	} as unknown);
	assert.equal(unknown.ok, false);
	assert.match(unknown.errors.join("|"), /unknown properties/);
});

function providerAcquisitionResult(
	overrides: Partial<Parameters<typeof recordFlowDeskExactModelAvailabilityCacheProviderAcquisitionResultV1>[0]> = {},
) {
	return recordFlowDeskExactModelAvailabilityCacheProviderAcquisitionResultV1({
		acquisitionPlan: planFlowDeskExactModelAvailabilityCacheAcquisitionV1({
			refreshPlan: refreshRequiredPlan(),
		}),
		resultId: "provider-acquisition-result-1",
		localDate: "2026-05-21",
		activeProfileRef: "profile-1",
		opencodeVersionRef: "opencode-1.15.6",
		flowdeskPackageVersionRef: "flowdesk-0.1.1",
		registryHash: "hash-registry-1",
		policyPackHash: "hash-policy-1",
		authAccountBoundaryRef: "account-1",
		providerFamily: "claude",
		providerIdentityRef: "provider-claude-1",
		providerQualifiedModelId: "claude/claude-opus-4-5",
		modelFamily: "opus",
		availabilityRef: "availability-live-1",
		preCallAuditRef: "audit-provider-acquisition-1",
		idempotencyRef: "idempotency-provider-acquisition-1",
		liveTestRunRef: "live-test-run-1",
		redactionProofRef: "redaction-proof-1",
		sanitizedProviderResultRef: "provider-result-redacted-1",
		observedAt: "2026-05-21T00:00:00.000Z",
		outcome: "available",
		highestTierEligible: true,
		...overrides,
	});
}

test("provider acquisition result records bounded live-test facts without dispatch authority", () => {
	const acquired = providerAcquisitionResult();
	assert.equal(acquired.state, "availability_acquired");
	assert.equal(acquired.ok, true, acquired.errors.join("; "));
	assert.equal(acquired.providerCall, true);
	assert.equal(acquired.acquisition_attempted, true);
	assert.equal(acquired.discovery_attempted, true);
	assert.equal(acquired.refresh_attempted, false);
	assert.equal(acquired.dispatch_authority_enabled, false);
	assert.equal(acquired.actualLaneLaunch, false);
	assert.equal(acquired.runtimeExecution, false);
	assert.equal(acquired.available, true);
	assert.equal(acquired.highest_tier_eligible, true);
	assert.equal(
		validateFlowDeskExactModelAvailabilityCacheProviderAcquisitionResultV1(acquired).ok,
		true,
	);

	const unavailable = providerAcquisitionResult({ outcome: "unavailable", highestTierEligible: false });
	assert.equal(unavailable.state, "availability_acquired");
	assert.equal(unavailable.available, false);
	assert.equal(unavailable.highest_tier_eligible, false);
	assert.equal(unavailable.providerCall, true);
	assert.equal(
		validateFlowDeskExactModelAvailabilityCacheProviderAcquisitionResultV1(unavailable).ok,
		true,
	);

	const metadataOnly = providerAcquisitionResult({ providerCall: false });
	assert.equal(metadataOnly.state, "availability_acquired");
	assert.equal(metadataOnly.providerCall, false);
	assert.equal(metadataOnly.acquisition_attempted, true);
	assert.equal(metadataOnly.discovery_attempted, true);
	assert.equal(
		validateFlowDeskExactModelAvailabilityCacheProviderAcquisitionResultV1(metadataOnly).ok,
		true,
	);
});

test("provider acquisition result blocks invalid plans and authority smuggling", () => {
	const noOpPlan = providerAcquisitionResult({
		acquisitionPlan: planFlowDeskExactModelAvailabilityCacheAcquisitionV1({
			refreshPlan: cacheHitRefreshPlan(),
		}),
	});
	assert.equal(noOpPlan.state, "blocked");
	assert.equal(noOpPlan.providerCall, false);
	assert.ok(noOpPlan.blocked_labels.includes("acquisition_plan_not_planned"));

	const invalidProvider = providerAcquisitionResult({
		providerQualifiedModelId: "openai/gpt-5.1",
	});
	assert.equal(invalidProvider.state, "blocked");
	assert.ok(invalidProvider.blocked_labels.includes("provider_acquisition_context_invalid"));
	assert.match(invalidProvider.errors.join("|"), /provider_family must match/);

	const forgedRuntime = validateFlowDeskExactModelAvailabilityCacheProviderAcquisitionResultV1({
		...providerAcquisitionResult(),
		runtimeExecution: true,
	});
	assert.equal(forgedRuntime.ok, false);
	assert.match(
		forgedRuntime.errors.join("|"),
		/cannot refresh cache, launch lanes, authorize dispatch, or run runtime execution/,
	);

	const rawPayload = validateFlowDeskExactModelAvailabilityCacheProviderAcquisitionResultV1({
		...providerAcquisitionResult(),
		sanitized_provider_result_ref: "raw provider response token secret",
	});
	assert.equal(rawPayload.ok, false);
});

test("provider acquisition materializes same-day exact-model cache only from prompt-backed success", () => {
	const materialized = materializeFlowDeskExactModelAvailabilityCacheFromProviderAcquisitionResultV1({
		providerAcquisitionResult: providerAcquisitionResult(),
		cacheId: "cache-live-1",
		entryId: "entry-live-1",
		expectedContext: {
			localDate: "2026-05-21",
			activeProfileRef: "profile-1",
			opencodeVersionRef: "opencode-1.15.6",
			flowdeskPackageVersionRef: "flowdesk-0.1.1",
			registryHash: "hash-registry-1",
			policyPackHash: "hash-policy-1",
			authAccountBoundaryRef: "account-1",
		},
	});
	assert.equal(materialized.state, "cache_materialized", materialized.errors.join("; "));
	assert.ok(materialized.cache);
	assert.equal(validateFlowDeskExactModelAvailabilityCacheV1(materialized.cache).ok, true);
	assert.equal(materialized.cache.providerCall, false);
	assert.equal(materialized.cache.dispatch_authority_enabled, false);
	assert.equal(materialized.cache.entries[0].provider_family, "claude");
	assert.equal(materialized.cache.entries[0].provider_identity_ref, "provider-claude-1");
	assert.equal(materialized.cache.entries[0].provider_qualified_model_id, "claude/claude-opus-4-5");
	assert.equal(materialized.cache.entries[0].model_family, "opus");
	assert.equal(materialized.cache.entries[0].availability_ref, "availability-live-1");

	const refreshPlan = planFlowDeskExactModelAvailabilityCacheRefreshV1({
		cache: materialized.cache,
		localDate: "2026-05-21",
		activeProfileRef: "profile-1",
		opencodeVersionRef: "opencode-1.15.6",
		flowdeskPackageVersionRef: "flowdesk-0.1.1",
		registryHash: "hash-registry-1",
		policyPackHash: "hash-policy-1",
		authAccountBoundaryRef: "account-1",
	});
	assert.equal(refreshPlan.state, "cache_hit");
	assert.equal(refreshPlan.providerCall, false);
	assert.equal(validateFlowDeskExactModelAvailabilityCacheRefreshPlanV1(refreshPlan).ok, true);
});

test("provider acquisition cache materialization blocks metadata-only unavailable lower-tier drift and forged authority", () => {
	const metadataOnly = materializeFlowDeskExactModelAvailabilityCacheFromProviderAcquisitionResultV1({
		providerAcquisitionResult: providerAcquisitionResult({ providerCall: false }),
		expectedContext: { localDate: "2026-05-21" },
	});
	assert.equal(metadataOnly.state, "blocked");
	assert.ok(metadataOnly.blocked_labels.includes("provider_acquisition_metadata_only"));
	assert.equal(metadataOnly.cache, undefined);

	for (const [result, label] of [
		[providerAcquisitionResult({ outcome: "blocked" }), "provider_acquisition_not_acquired"],
		[providerAcquisitionResult({ outcome: "unavailable", highestTierEligible: false }), "provider_model_unavailable"],
		[providerAcquisitionResult({ highestTierEligible: false }), "provider_model_not_highest_tier_eligible"],
	] as const) {
		const blocked = materializeFlowDeskExactModelAvailabilityCacheFromProviderAcquisitionResultV1({
			providerAcquisitionResult: result,
			expectedContext: { localDate: "2026-05-21" },
		});
		assert.equal(blocked.state, "blocked");
		assert.ok(blocked.blocked_labels.includes(label), `${label}: ${blocked.blocked_labels.join(",")}`);
		assert.equal(blocked.cache, undefined);
	}

	const drift = materializeFlowDeskExactModelAvailabilityCacheFromProviderAcquisitionResultV1({
		providerAcquisitionResult: providerAcquisitionResult(),
		expectedContext: {
			localDate: "2026-05-22",
			activeProfileRef: "profile-2",
			opencodeVersionRef: "opencode-1.15.7",
			flowdeskPackageVersionRef: "flowdesk-0.1.2",
			registryHash: "hash-registry-2",
			policyPackHash: "hash-policy-2",
			authAccountBoundaryRef: "account-2",
		},
	});
	assert.equal(drift.state, "blocked");
	assert.ok(drift.blocked_labels.includes("local_date_drift"));
	assert.ok(drift.blocked_labels.includes("active_profile_ref_drift"));
	assert.ok(drift.blocked_labels.includes("registry_hash_drift"));

	const forged = materializeFlowDeskExactModelAvailabilityCacheFromProviderAcquisitionResultV1({
		providerAcquisitionResult: { ...providerAcquisitionResult(), dispatch_authority_enabled: true },
		expectedContext: { localDate: "2026-05-21" },
	});
	assert.equal(forged.state, "blocked");
	assert.ok(forged.blocked_labels.includes("provider_acquisition_result_invalid"));
	assert.match(forged.errors.join("|"), /authorize dispatch/);
});

test("reviewer assignment revalidation blocks stale cache and context drift", () => {
	const ready = revalidation();
	assert.equal(ready.state, "revalidated");
	assert.equal(ready.eligible_bindings.length, 1);
	assert.equal(
		validateFlowDeskReviewerAssignmentRevalidationV1(ready).ok,
		true,
	);

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
			entries: [
				{ ...cache().entries[0], provider_qualified_model_id: "claude/latest" },
			],
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
	assert.ok(
		lowerTier.blocked_labels.includes("registered_available_lower_tier_only"),
	);
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
	assert.equal(
		validateFlowDeskReviewerAssignmentRevalidationV1(ready).ok,
		true,
	);

	const refreshRequired =
		revalidateFlowDeskReviewerAssignmentsFromCacheEvidenceV1({
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
	assert.ok(
		refreshRequired.blocked_labels.includes("cache_refresh_not_cache_hit"),
	);
	assert.ok(
		refreshRequired.blocked_labels.includes(
			"cache_refresh_not_usable_for_assignment",
		),
	);
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
	assert.ok(
		drift.blocked_labels.includes("cache_refresh_expected_context_drift"),
	);
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
	assert.deepEqual(plan.planned_perspectives, [
		"policy_security",
		"architecture",
		"verification_implementation",
	]);
	assert.equal(
		new Set(
			plan.runtime_lane_launch_requests.map(
				(request) => request.provider_qualified_model_id,
			),
		).size,
		1,
	);
	assert.equal(
		new Set(plan.runtime_lane_launch_requests.map((request) => request.lane_id)).size,
		3,
		"same concrete model fan-out must retain one lane per perspective",
	);
	assert.deepEqual(
		plan.runtime_lane_launch_requests.map((request) => request.lane_id),
		[
			"reviewer-lane-attempt-1-policy_security",
			"reviewer-lane-attempt-1-architecture",
			"reviewer-lane-attempt-1-verification_implementation",
		],
	);
	assert.equal(
		new Set(
			plan.runtime_lane_launch_requests.map(
				(request) => request.launch_request_id,
			),
		).size,
		3,
		"same concrete model fan-out must retain one launch request per perspective",
	);
	assert.equal(plan.max_concurrent_lane_count, 1);
	assert.equal(plan.same_model_stagger_ms, 1);
	assert.deepEqual(
		plan.lane_launch_schedule.map((entry) => entry.launch_delay_ms),
		[0, 1, 2],
	);
	assert.equal(plan.launch_attempted, false);
	assert.equal(plan.approval_inferred, false);
	assert.equal(plan.dispatch_authority_enabled, false);
	assert.equal(plan.providerCall, false);
	assert.equal(plan.actualLaneLaunch, false);
	assert.equal(plan.runtimeExecution, false);
	assert.equal(validateFlowDeskReviewerFanoutPlanV1(plan).ok, true);
});

test("reviewer fanout spreads distinct models and only staggers repeated models", () => {
	const plan = planFlowDeskReviewerFanoutV1({
		revalidation: revalidation({
			cache: cache({
				entries: [
					cache().entries[0],
					{
						entry_id: "entry-openai-1",
						provider_family: "openai",
						provider_identity_ref: "provider-openai-1",
						provider_qualified_model_id: "openai/gpt-5.5",
						model_family: "gpt-frontier",
						registered: true,
						available: true,
						highest_tier_eligible: true,
						availability_ref: "availability-openai-1",
					},
					{
						entry_id: "entry-gemini-1",
						provider_family: "gemini",
						provider_identity_ref: "provider-gemini-1",
						provider_qualified_model_id: "gemini/gemini-2.5-pro",
						model_family: "gemini-pro",
						registered: true,
						available: true,
						highest_tier_eligible: true,
						availability_ref: "availability-gemini-1",
					},
				],
			}),
		}),
		workflowId: "workflow-1",
		attemptId: "attempt-1",
		parentSessionRef: "ses-parent-1",
		agentRef: "agent-reviewer",
		requestedAt: "2026-05-21T00:00:00.000Z",
		sameModelStaggerMs: 4000,
	});
	assert.equal(plan.state, "fanout_ready", plan.errors.join("; "));
	assert.equal(
		new Set(
			plan.runtime_lane_launch_requests.map(
				(request) => request.provider_qualified_model_id,
			),
		).size,
		3,
	);
	assert.equal(plan.max_concurrent_lane_count, 3);
	assert.deepEqual(
		plan.lane_launch_schedule.map((entry) => entry.launch_delay_ms),
		[0, 0, 0],
	);
	assert.equal(validateFlowDeskReviewerFanoutPlanV1(plan).ok, true);
});

test("reviewer fanout enforces top-tier cap and preserves non-dispatch authority", () => {
	const tooManyPerspectives = [
		"policy_security",
		"architecture",
		"verification_implementation",
		"policy_security",
		"architecture",
		"verification_implementation",
	] as unknown as Parameters<typeof planFlowDeskReviewerFanoutV1>[0]["requestedPerspectives"];
	const blocked = planFlowDeskReviewerFanoutV1({
		revalidation: revalidation(),
		workflowId: "workflow-1",
		attemptId: "attempt-1",
		parentSessionRef: "ses-parent-1",
		agentRef: "agent-reviewer",
		requestedAt: "2026-05-21T00:00:00.000Z",
		requestedPerspectives: tooManyPerspectives,
		maxConcurrentLaneCount: 6,
	});
	assert.equal(blocked.state, "blocked");
	assert.ok(blocked.blocked_labels.includes("top_tier_fanout_cap_exceeded"));
	assert.match(blocked.errors.join("|"), /top-tier fan-out cap 5/);
	assert.deepEqual(blocked.runtime_lane_launch_requests, []);
	assert.equal(blocked.providerCall, false);
	assert.equal(blocked.actualLaneLaunch, false);

	const base = planFlowDeskReviewerFanoutV1({
		revalidation: revalidation(),
		workflowId: "workflow-1",
		attemptId: "attempt-1",
		parentSessionRef: "ses-parent-1",
		agentRef: "agent-reviewer",
		requestedAt: "2026-05-21T00:00:00.000Z",
	});
	const forged = validateFlowDeskReviewerFanoutPlanV1({
		...base,
		runtime_lane_launch_requests: [
			...base.runtime_lane_launch_requests,
			...base.runtime_lane_launch_requests,
		],
		lane_launch_schedule: [
			...base.lane_launch_schedule,
			...base.lane_launch_schedule,
		],
		max_concurrent_lane_count: 6,
	});
	assert.equal(forged.ok, false);
	assert.match(forged.errors.join("|"), /runtime_lane_launch_requests cannot exceed top-tier fan-out cap 5/);
	assert.match(forged.errors.join("|"), /max_concurrent_lane_count.*top-tier fan-out cap 5/);
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
	assert.match(
		missingPerspective.errors.join("|"),
		/cover every required perspective/,
	);

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
