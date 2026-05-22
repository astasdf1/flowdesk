# Observed Reviewer Verdict Materialization

Date: 2026-05-23

## Scope

This note records the fail-closed adapter helper that persists an already observed typed reviewer verdict as durable `reviewer_verdict` session evidence.

## Implemented

`materializeFlowDeskObservedReviewerVerdictEvidenceV1` accepts a reviewer verdict observation result and writes durable session evidence only when the observation status is `verdict_observed` and a schema-valid `flowdesk.top_tier_review_verdict.v1` verdict is present. The helper uses the existing session evidence prepare, apply, and reload paths, rejects duplicate evidence ids before write, and verifies the record can be reloaded after materialization.

Missing, invalid, unavailable, or failed observations return `blocked_before_verdict_evidence` and write nothing.

## Safety Boundary

This slice persists typed verdict evidence only. It does not launch reviewer lanes, call providers, read provider APIs, accept verdicts, link durable verdicts to lifecycle evidence, authorize dispatch, run SDK prompts, or infer approval. The materializer authority summary keeps provider calls, runtime execution, actual lane launch, dispatch, durable linkage, and typed verdict acceptance disabled.

## Verification

Adapter tests cover a valid observed typed verdict persisting exactly one `reviewer_verdict` record with disabled authority flags, and missing/invalid observations writing no reviewer verdict evidence. Existing session evidence validators still reject malformed reviewer verdict records and authority smuggling.

## Remaining Gaps

Actual reviewer lane launch, runtime launch approval, SDK-client lane orchestration, complete lifecycle linkage for product verdict sets, and any verdict acceptance workflow remain later-gated.
