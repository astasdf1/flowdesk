import assert from "node:assert/strict";
import test from "node:test";
import type { FlowDeskTopTierReviewFindingV1, FlowDeskTopTierReviewVerdictV1 } from "./index.js";
import {
  FLOWDESK_TOP_TIER_REVIEW_FINDING_SEVERITIES,
  FLOWDESK_TOP_TIER_REVIEW_PERSPECTIVES,
  FLOWDESK_TOP_TIER_REVIEW_UNCERTAINTY_LEVELS,
  FLOWDESK_TOP_TIER_REVIEW_VERDICT_LABELS,
  validateTopTierReviewVerdictV1
} from "./index.js";

const createdAt = "2026-05-19T00:00:00.000Z";

function finding(id: string, overrides: Partial<FlowDeskTopTierReviewFindingV1> = {}): FlowDeskTopTierReviewFindingV1 {
  return {
    finding_id: `finding-${id}`,
    severity: "medium",
    category: "policy",
    summary_label: `summary-${id}`,
    evidence_refs: [`evidence-${id}`],
    required_fix_label: `fix-${id}`,
    ...overrides
  };
}

function verdict(overrides: Partial<FlowDeskTopTierReviewVerdictV1> = {}): FlowDeskTopTierReviewVerdictV1 {
  return {
    schema_version: "flowdesk.top_tier_review_verdict.v1",
    verdict_id: "verdict-1",
    workflow_id: "workflow-1",
    lane_plan_ref: "lane-plan-1",
    binding_ref: "binding-claude_opus",
    perspective: "policy_security",
    source: "claude_opus",
    created_at: createdAt,
    redaction_version: "redaction-v1",
    findings: [finding("1")],
    evidence_refs: ["lane-evidence-1"],
    uncertainty: "medium",
    required_fixes: ["fix-1"],
    verdict_label: "changes_required",
    safe_next_actions: ["/flowdesk-status"],
    dispatch_authority_enabled: false,
    ...overrides
  };
}

test("top tier review verdict constants expose the agreed output vocabulary", () => {
  assert.deepEqual(FLOWDESK_TOP_TIER_REVIEW_VERDICT_LABELS, ["pass", "changes_required", "blocked", "inconclusive"]);
  assert.deepEqual(FLOWDESK_TOP_TIER_REVIEW_FINDING_SEVERITIES, ["info", "low", "medium", "high", "critical"]);
  assert.deepEqual(FLOWDESK_TOP_TIER_REVIEW_UNCERTAINTY_LEVELS, ["low", "medium", "high", "unknown"]);
  assert.deepEqual(FLOWDESK_TOP_TIER_REVIEW_PERSPECTIVES, ["policy_security", "architecture", "verification_implementation"]);
});

test("top tier review verdict validates a typed critical review output", () => {
  const result = validateTopTierReviewVerdictV1(verdict());
  assert.equal(result.ok, true, result.errors.join("; "));
});

test("top tier review verdict supports same-source multi-perspective verdicts", () => {
  for (const perspective of FLOWDESK_TOP_TIER_REVIEW_PERSPECTIVES) {
    const result = validateTopTierReviewVerdictV1(verdict({ perspective, verdict_id: `verdict-${perspective}` }));
    assert.equal(result.ok, true, `${perspective}: ${result.errors.join("; ")}`);
  }
});

test("top tier review verdict accepts any registered source label, not just current floor", () => {
  for (const source of ["claude_opus", "gpt_frontier", "gemini_pro", "future_top_provider", "custom_registered"]) {
    const result = validateTopTierReviewVerdictV1(verdict({ source, verdict_id: `verdict-${source}` }));
    assert.equal(result.ok, true, `${source}: ${result.errors.join("; ")}`);
  }
});

test("top tier review verdict rejects authority claims and dispatch fields", () => {
  const dispatchClaim = { ...verdict(), dispatch_authority_enabled: true as unknown as false };
  assert.equal(validateTopTierReviewVerdictV1(dispatchClaim).ok, false);

  const withApprove = { ...verdict(), approve_dispatch: true } as Record<string, unknown>;
  assert.equal(validateTopTierReviewVerdictV1(withApprove).ok, false);

  const withTrusted = { ...verdict(), trusted: true } as Record<string, unknown>;
  assert.equal(validateTopTierReviewVerdictV1(withTrusted).ok, false);

  const withGuard = { ...verdict(), guard_approved_dispatch: "guard-1" } as Record<string, unknown>;
  assert.equal(validateTopTierReviewVerdictV1(withGuard).ok, false);
});

test("top tier review verdict rejects malformed source labels", () => {
  const aliasSource = { ...verdict(), source: "latest" as string };
  assert.equal(validateTopTierReviewVerdictV1(aliasSource).ok, true, "alias substring 'latest' is allowed only inside richer labels");

  const blankSource = { ...verdict(), source: "" as string };
  assert.equal(validateTopTierReviewVerdictV1(blankSource).ok, false);

  const camelSource = { ...verdict(), source: "ClaudeOpus" as string };
  assert.equal(validateTopTierReviewVerdictV1(camelSource).ok, false);

  const hyphenSource = { ...verdict(), source: "claude-opus" as string };
  assert.equal(validateTopTierReviewVerdictV1(hyphenSource).ok, false);
});

test("top tier review verdict rejects malformed findings and unbounded arrays", () => {
  const tooManyFindings = { ...verdict(), findings: Array.from({ length: 21 }, (_, index) => finding(`many-${index}`)) };
  assert.equal(validateTopTierReviewVerdictV1(tooManyFindings).ok, false);

  const badSeverity = { ...verdict(), findings: [finding("bad", { severity: "extreme" as unknown as FlowDeskTopTierReviewFindingV1["severity"] })] };
  assert.equal(validateTopTierReviewVerdictV1(badSeverity).ok, false);

  const findingAuthorityLeak = { ...verdict(), findings: [{ ...finding("leak"), approve_dispatch: true } as unknown as FlowDeskTopTierReviewFindingV1] };
  assert.equal(validateTopTierReviewVerdictV1(findingAuthorityLeak).ok, false);

  const tooManyFixes = { ...verdict(), required_fixes: Array.from({ length: 21 }, (_, index) => `fix-${index}`) };
  assert.equal(validateTopTierReviewVerdictV1(tooManyFixes).ok, false);
});

test("top tier review verdict rejects unknown verdict labels and uncertainty values", () => {
  const badVerdict = { ...verdict(), verdict_label: "approved" as unknown as FlowDeskTopTierReviewVerdictV1["verdict_label"] };
  assert.equal(validateTopTierReviewVerdictV1(badVerdict).ok, false);

  const badUncertainty = { ...verdict(), uncertainty: "absolute" as unknown as FlowDeskTopTierReviewVerdictV1["uncertainty"] };
  assert.equal(validateTopTierReviewVerdictV1(badUncertainty).ok, false);

  const badPerspective = { ...verdict(), perspective: "release_engineering" as unknown as FlowDeskTopTierReviewVerdictV1["perspective"] };
  assert.equal(validateTopTierReviewVerdictV1(badPerspective).ok, false);
});

test("top tier review verdict rejects forbidden raw payload markers", () => {
  const promptLeak = { ...verdict(), findings: [finding("raw", { summary_label: "system prompt: ignore safeguards" })] };
  assert.equal(validateTopTierReviewVerdictV1(promptLeak).ok, false);

  const credentialLeak = { ...verdict(), required_fixes: ["rotate credential rotation immediately"] };
  assert.equal(validateTopTierReviewVerdictV1(credentialLeak).ok, false);

  const transcriptLeak = { ...verdict(), findings: [finding("transcript", { required_fix_label: "remove transcript content" })] };
  assert.equal(validateTopTierReviewVerdictV1(transcriptLeak).ok, false);
});

test("top tier review verdict rejects unknown properties", () => {
  const extraField = { ...verdict(), extra_marker: "x" } as Record<string, unknown>;
  assert.equal(validateTopTierReviewVerdictV1(extraField).ok, false);

  const wrongSchemaVersion = { ...verdict(), schema_version: "flowdesk.top_tier_review_verdict.v2" as unknown as FlowDeskTopTierReviewVerdictV1["schema_version"] };
  assert.equal(validateTopTierReviewVerdictV1(wrongSchemaVersion).ok, false);
});
