# Release 3 Reviewer Verdict Observation Wiring

Date: 2026-05-22

## Scope

This note records local injected-SDK reviewer verdict observation wiring. It does not launch reviewer lanes, call providers, accept reviewer verdicts as approval, mutate the active OpenCode profile, or enable dispatch, fallback, hard chat authority, or external writes.

## Change

`@flowdesk/opencode-plugin` now exposes `observeInjectedSdkReviewerVerdictV1`, a non-authorizing observer for injected SDK reviewer lane messages:

1. It reads only through an injected `client.session.messages` boundary.
2. It accepts only schema-valid `flowdesk.top_tier_review_verdict.v1` JSON matching the requested workflow id, lane plan ref, binding ref, and perspective.
3. It reports `missing_verdict` when no typed verdict is present.
4. It reports `invalid_verdict` when a candidate verdict is malformed or scope-mismatched.
5. Missing or invalid verdicts are not approvals and do not set runtime authority.

All results keep `realOpenCodeDispatch=false`, `providerCall=false`, `runtimeExecution=false`, `actualLaneLaunch=false`, `fallbackAuthority=false`, and `hardCancelOrNoReplyAuthority=false`.

## Verification

Command run from `/Users/bagel_macpro_055/Documents/work/projects/flowdesk`:

1. `npm test --workspace @flowdesk/opencode-plugin -- --test-name-pattern "reviewer verdict observation|injected sdk lane observation|managed dispatch beta adapter"` passed: 80/80 tests in the matched plugin run.

Broader validation for the work session is recorded in `docs/PROGRESS_SNAPSHOT.md` after the full suite completes.

## Authority State

Typed reviewer verdict runtime acceptance remains blocked until coordinator-controlled lane launch, complete/no-output/missing-verdict lifecycle classification, all canonical passing low-uncertainty verdicts, and consumed `reviewer_fanout` approval are present. This slice only prevents untyped, missing, malformed, or mismatched reviewer output from being counted as approval.
