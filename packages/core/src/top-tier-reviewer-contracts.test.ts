import assert from "node:assert/strict";
import test from "node:test";
import type {
  FlowDeskTopTierReviewBindingInventoryV1,
  FlowDeskTopTierReviewerBindingV1,
  FlowDeskTopTierReviewerLanePlanV1
} from "./index.js";
import {
  FLOWDESK_TOP_TIER_BINDING_AVAILABILITY_STATES,
  FLOWDESK_TOP_TIER_LANE_INCLUSION_STATES,
  FLOWDESK_TOP_TIER_REVIEW_INVENTORY_DECISIONS,
  FLOWDESK_TOP_TIER_REVIEW_PERSPECTIVES,
  validateTopTierReviewBindingInventoryV1,
  validateTopTierReviewerBindingV1,
  validateTopTierReviewerLanePlanV1
} from "./index.js";

const observedAt = "2026-05-19T00:00:00.000Z";
const expiresAt = "2026-05-19T01:00:00.000Z";

function bindingFor(label: string, providerFamily: "claude" | "openai" | "gemini", modelFamily: string, modelId: string): FlowDeskTopTierReviewerBindingV1 {
  return {
    schema_version: "flowdesk.top_tier_reviewer_binding.v1",
    binding_id: `binding-${label}`,
    reviewer_profile_id: "reviewer",
    binding_label: label,
    provider_family: providerFamily,
    provider_qualified_model_id: `${providerFamily}/${modelId}`,
    model_family: modelFamily,
    highest_tier_eligible: true,
    registry_entry_ref: `registry-${label}`,
    policy_pack_eligibility_ref: `policy-${label}`,
    availability: "registered_available",
    dispatch_authority_enabled: false,
    observed_at: observedAt,
    expires_at: expiresAt
  };
}

function lanePlanFor(perspective: typeof FLOWDESK_TOP_TIER_REVIEW_PERSPECTIVES[number], bindingLabel: string, inclusionState: typeof FLOWDESK_TOP_TIER_LANE_INCLUSION_STATES[number] = "included"): FlowDeskTopTierReviewerLanePlanV1 {
  return {
    schema_version: "flowdesk.top_tier_reviewer_lane_plan.v1",
    lane_plan_id: `lane-${perspective}-${bindingLabel}`,
    binding_ref: `binding-${bindingLabel}`,
    perspective,
    inclusion_state: inclusionState,
    reason_label: `reason-${perspective}-${inclusionState}`,
    safe_next_actions: ["/flowdesk-status"],
    dispatch_authority_enabled: false
  };
}

function inventoryFor(bindings: FlowDeskTopTierReviewerBindingV1[], lanePlans: FlowDeskTopTierReviewerLanePlanV1[]): FlowDeskTopTierReviewBindingInventoryV1 {
  return {
    schema_version: "flowdesk.top_tier_review_binding_inventory.v1",
    inventory_id: "inventory-1",
    workflow_id: "workflow-1",
    plan_revision_id: "plan-1",
    created_at: observedAt,
    redaction_version: "redaction-v1",
    registered_binding_refs: bindings.map((binding) => `registry-${binding.binding_label}`),
    available_binding_refs: bindings.filter((binding) => binding.availability === "registered_available").map((binding) => `registry-${binding.binding_label}`),
    unavailable_binding_refs: bindings.filter((binding) => binding.availability === "registered_unavailable").map((binding) => `registry-${binding.binding_label}`),
    blocked_binding_refs: bindings.filter((binding) => binding.availability === "registered_blocked").map((binding) => `registry-${binding.binding_label}`),
    lane_plan_refs: lanePlans.map((lane) => lane.lane_plan_id),
    max_concurrent_lane_count: lanePlans.length,
    budget_cap_label: "policy-budget-default",
    quota_reserve_label: "policy-reserve-default",
    timeout_label: "policy-timeout-default",
    retry_budget_label: "policy-retry-default",
    inventory_decision: "ready",
    safe_next_actions: ["/flowdesk-status"],
    dispatch_authority_enabled: false
  };
}

test("top tier review constants expose registered/highest-tier vocabulary", () => {
  assert.deepEqual(FLOWDESK_TOP_TIER_REVIEW_PERSPECTIVES, ["policy_security", "architecture", "verification_implementation"]);
  assert.deepEqual(FLOWDESK_TOP_TIER_BINDING_AVAILABILITY_STATES, ["registered_available", "registered_unavailable", "registered_blocked"]);
  assert.deepEqual(FLOWDESK_TOP_TIER_LANE_INCLUSION_STATES, ["included", "excluded", "blocked"]);
  assert.deepEqual(FLOWDESK_TOP_TIER_REVIEW_INVENTORY_DECISIONS, ["ready", "blocked", "policy_change_required"]);
});

test("top tier reviewer binding validates registered highest-tier concrete bindings", () => {
  const binding = bindingFor("claude_opus", "claude", "opus", "claude-opus-4-5");
  const result = validateTopTierReviewerBindingV1(binding);
  assert.equal(result.ok, true, result.errors.join("; "));
});

test("top tier reviewer binding rejects alias and lower-tier shapes", () => {
  const aliasBinding = bindingFor("claude_opus", "claude", "opus", "latest");
  const aliasResult = validateTopTierReviewerBindingV1(aliasBinding);
  assert.equal(aliasResult.ok, false);

  const dispatchClaim = { ...bindingFor("claude_opus", "claude", "opus", "claude-opus-4-5"), dispatch_authority_enabled: true as unknown as false };
  assert.equal(validateTopTierReviewerBindingV1(dispatchClaim).ok, false);

  const lowerTier = { ...bindingFor("claude_opus", "claude", "opus", "claude-opus-4-5"), highest_tier_eligible: false as unknown as true };
  assert.equal(validateTopTierReviewerBindingV1(lowerTier).ok, false);

  const providerHidden = { ...bindingFor("claude_opus", "claude", "opus", "claude-opus-4-5"), provider_family: "unknown" as unknown as "claude" };
  assert.equal(validateTopTierReviewerBindingV1(providerHidden).ok, false);

  const wrongProfile = { ...bindingFor("claude_opus", "claude", "opus", "claude-opus-4-5"), reviewer_profile_id: "critic" as unknown as "reviewer" };
  assert.equal(validateTopTierReviewerBindingV1(wrongProfile).ok, false);
});

test("top tier reviewer lane plan supports same-model multi-perspective bindings", () => {
  const lanes = FLOWDESK_TOP_TIER_REVIEW_PERSPECTIVES.map((perspective) => lanePlanFor(perspective, "claude_opus"));
  for (const lane of lanes) {
    const result = validateTopTierReviewerLanePlanV1(lane);
    assert.equal(result.ok, true, result.errors.join("; "));
  }
  const uniqueBindingRefs = new Set(lanes.map((lane) => lane.binding_ref));
  assert.equal(uniqueBindingRefs.size, 1, "expected all perspectives to share one binding ref");
});

test("top tier reviewer lane plan rejects malformed perspective and authority claims", () => {
  const badPerspective = { ...lanePlanFor("policy_security", "claude_opus"), perspective: "unknown_lane" as unknown as typeof FLOWDESK_TOP_TIER_REVIEW_PERSPECTIVES[number] };
  assert.equal(validateTopTierReviewerLanePlanV1(badPerspective).ok, false);

  const dispatchClaim = { ...lanePlanFor("policy_security", "claude_opus"), dispatch_authority_enabled: true as unknown as false };
  assert.equal(validateTopTierReviewerLanePlanV1(dispatchClaim).ok, false);

  const badAction = { ...lanePlanFor("policy_security", "claude_opus"), safe_next_actions: ["/flowdesk-real-dispatch"] as unknown as ["/flowdesk-status"] };
  assert.equal(validateTopTierReviewerLanePlanV1(badAction).ok, false);
});

test("top tier review binding inventory accepts a single-model multi-perspective plan", () => {
  const binding = bindingFor("claude_opus", "claude", "opus", "claude-opus-4-5");
  const lanes = FLOWDESK_TOP_TIER_REVIEW_PERSPECTIVES.map((perspective) => lanePlanFor(perspective, "claude_opus"));
  const inventory = inventoryFor([binding], lanes);
  const result = validateTopTierReviewBindingInventoryV1(inventory);
  assert.equal(result.ok, true, result.errors.join("; "));
});

test("top tier review binding inventory accepts a registered multi-model fan-out", () => {
  const bindings = [
    bindingFor("claude_opus", "claude", "opus", "claude-opus-4-5"),
    bindingFor("gpt_frontier", "openai", "gpt-5", "gpt-5.5"),
    bindingFor("gemini_pro", "gemini", "gemini-pro", "gemini-2.5-pro")
  ];
  const lanes = bindings.map((binding) => lanePlanFor("policy_security", binding.binding_label));
  const inventory = inventoryFor(bindings, lanes);
  const result = validateTopTierReviewBindingInventoryV1(inventory);
  assert.equal(result.ok, true, result.errors.join("; "));
});

test("top tier review binding inventory fails closed on authority claims and empty bindings", () => {
  const binding = bindingFor("claude_opus", "claude", "opus", "claude-opus-4-5");
  const lanes = [lanePlanFor("policy_security", "claude_opus")];

  const dispatchClaim = { ...inventoryFor([binding], lanes), dispatch_authority_enabled: true as unknown as false };
  assert.equal(validateTopTierReviewBindingInventoryV1(dispatchClaim).ok, false);

  const emptyRegistered = { ...inventoryFor([binding], lanes), registered_binding_refs: [] };
  assert.equal(validateTopTierReviewBindingInventoryV1(emptyRegistered).ok, false);

  const emptyLanes = { ...inventoryFor([binding], lanes), lane_plan_refs: [] };
  assert.equal(validateTopTierReviewBindingInventoryV1(emptyLanes).ok, false);

  const badDecision = { ...inventoryFor([binding], lanes), inventory_decision: "approved" as unknown as typeof FLOWDESK_TOP_TIER_REVIEW_INVENTORY_DECISIONS[number] };
  assert.equal(validateTopTierReviewBindingInventoryV1(badDecision).ok, false);

  const oversizedConcurrency = { ...inventoryFor([binding], lanes), max_concurrent_lane_count: 0 };
  assert.equal(validateTopTierReviewBindingInventoryV1(oversizedConcurrency).ok, false);
});

test("top tier review contracts cannot smuggle dispatch authority fields", () => {
  const binding = { ...bindingFor("claude_opus", "claude", "opus", "claude-opus-4-5"), trusted: true } as Record<string, unknown>;
  assert.equal(validateTopTierReviewerBindingV1(binding).ok, false);

  const lane = { ...lanePlanFor("policy_security", "claude_opus"), approve_dispatch: true } as Record<string, unknown>;
  assert.equal(validateTopTierReviewerLanePlanV1(lane).ok, false);

  const inventory = { ...inventoryFor([bindingFor("claude_opus", "claude", "opus", "claude-opus-4-5")], [lanePlanFor("policy_security", "claude_opus")]), guard_approved_dispatch: "guard-1" } as Record<string, unknown>;
  assert.equal(validateTopTierReviewBindingInventoryV1(inventory).ok, false);
});
