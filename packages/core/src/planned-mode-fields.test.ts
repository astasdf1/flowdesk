import assert from "node:assert/strict";
import test from "node:test";
import {
  createFlowDeskPlannedTopTierMultiPerspectiveReviewModeFieldV1,
  FLOWDESK_PLANNED_MODE_FIELD_LABELS,
  FLOWDESK_PLANNED_MODE_FIELD_STATES,
  FLOWDESK_PLANNED_TOP_TIER_MULTI_PERSPECTIVE_REVIEW_MODE_FIELD_REF,
  flowDeskPlannedModeFieldToString,
  validateFlowDeskPlannedModeFieldEntryStringV1,
  validateFlowDeskPlannedModeFieldV1
} from "./index.js";

test("planned mode field constants expose the agreed label and state vocabulary", () => {
  assert.deepEqual(FLOWDESK_PLANNED_MODE_FIELD_LABELS, ["top_tier_multi_perspective_review_mode"]);
  assert.deepEqual(FLOWDESK_PLANNED_MODE_FIELD_STATES, ["disabled", "planned", "conformance_ready", "release_gate_ready"]);
});

test("planned mode field factory defaults to planned and remains non-authorizing", () => {
  const entry = createFlowDeskPlannedTopTierMultiPerspectiveReviewModeFieldV1();
  assert.equal(entry.label, "top_tier_multi_perspective_review_mode");
  assert.equal(entry.state, "planned");
  assert.equal(entry.dispatch_authority_enabled, false);
  assert.equal(flowDeskPlannedModeFieldToString(entry), "top_tier_multi_perspective_review_mode=planned");
  assert.equal(FLOWDESK_PLANNED_TOP_TIER_MULTI_PERSPECTIVE_REVIEW_MODE_FIELD_REF, "top_tier_multi_perspective_review_mode=planned");
  assert.equal(validateFlowDeskPlannedModeFieldV1(entry).ok, true);
});

test("planned mode field allows only the registered states", () => {
  for (const state of FLOWDESK_PLANNED_MODE_FIELD_STATES) {
    const entry = createFlowDeskPlannedTopTierMultiPerspectiveReviewModeFieldV1(state);
    assert.equal(validateFlowDeskPlannedModeFieldV1(entry).ok, true, state);
  }
});

test("planned mode field rejects authority-implying states", () => {
  for (const forbiddenState of ["enabled", "active", "dispatch_ready", "approved", "authorized"]) {
    const bad = { ...createFlowDeskPlannedTopTierMultiPerspectiveReviewModeFieldV1(), state: forbiddenState as never };
    const result = validateFlowDeskPlannedModeFieldV1(bad);
    assert.equal(result.ok, false, `${forbiddenState} should be rejected`);
  }
});

test("planned mode field rejects unknown labels and dispatch authority claims", () => {
  const unknownLabel = { ...createFlowDeskPlannedTopTierMultiPerspectiveReviewModeFieldV1(), label: "release_2_ready" as never };
  assert.equal(validateFlowDeskPlannedModeFieldV1(unknownLabel).ok, false);

  const dispatchClaim = { ...createFlowDeskPlannedTopTierMultiPerspectiveReviewModeFieldV1(), dispatch_authority_enabled: true as never };
  assert.equal(validateFlowDeskPlannedModeFieldV1(dispatchClaim).ok, false);

  const extraField = { ...createFlowDeskPlannedTopTierMultiPerspectiveReviewModeFieldV1(), extra: "x" } as Record<string, unknown>;
  assert.equal(validateFlowDeskPlannedModeFieldV1(extraField).ok, false);
});

test("planned mode field entry string validator parses label=state strictly", () => {
  assert.equal(validateFlowDeskPlannedModeFieldEntryStringV1("top_tier_multi_perspective_review_mode=planned").ok, true);
  assert.equal(validateFlowDeskPlannedModeFieldEntryStringV1("top_tier_multi_perspective_review_mode=conformance_ready").ok, true);
  assert.equal(validateFlowDeskPlannedModeFieldEntryStringV1("top_tier_multi_perspective_review_mode=enabled").ok, false);
  assert.equal(validateFlowDeskPlannedModeFieldEntryStringV1("top_tier_multi_perspective_review_mode=active").ok, false);
  assert.equal(validateFlowDeskPlannedModeFieldEntryStringV1("top_tier_multi_perspective_review_mode=dispatch_ready").ok, false);
  assert.equal(validateFlowDeskPlannedModeFieldEntryStringV1("future_mode=planned").ok, false);
  assert.equal(validateFlowDeskPlannedModeFieldEntryStringV1("not_a_label_state").ok, false);
  assert.equal(validateFlowDeskPlannedModeFieldEntryStringV1("").ok, false);
});
