# Release 3 Durable Reviewer Verdict Linkage

Date: 2026-05-22

## Scope

This note records the A-track evidence hardening selected by the multi-model strategy review. It links typed reviewer verdict acceptance to durable session evidence and complete lane lifecycle records without enabling dispatch, provider calls, runtime execution, fallback, hard-chat control, or external writes.

## Added Durable Evidence Classes

Session evidence now accepts and reloads these additional redacted evidence classes:

- `reviewer_verdict`: schema `flowdesk.top_tier_review_verdict.v1`.
- `lane_lifecycle`: schema `flowdesk.lane_lifecycle_record.v1`.
- `reviewer_lane_conformance`: schema `flowdesk.top_tier_reviewer_lane_conformance_observation.v1`.

Each class uses the existing temp-then-rename session evidence path and validator-specific fail-closed checks. Forged authority fields, malformed lifecycle states, hard-chat authority claims, raw payload markers, cross-workflow records, and path-shaped evidence ids block reload or preparation.

## Durable Acceptance Gate

`prepareFlowDeskDurableReviewerVerdictLinkageAdapterV1` adds a non-authorizing durable precondition before typed verdict acceptance can be treated as durable:

1. The existing typed verdict acceptance adapter must return `verdicts_accepted`.
2. Reloaded session evidence must be `ok` with no blocked records.
3. Every accepted verdict id must exist as reloaded `reviewer_verdict` evidence.
4. Every accepted verdict id must have a matching reloaded `lane_lifecycle` record in `complete` state for the same workflow and attempt.

If any durable evidence is missing, the adapter returns `blocked_before_durable_acceptance` with `/flowdesk-status` only. When all durable links are present, it returns `durable_verdicts_accepted` and exposes only:

- `typedReviewerVerdictsAccepted: true`.
- `durableReviewerVerdictEvidenceLinked: true`.

All dispatch/runtime authority flags remain false:

- `realOpenCodeDispatch: false`.
- `providerCall: false`.
- `runtimeExecution: false`.
- `actualLaneLaunch: false`.
- `fallbackAuthority: false`.
- `toolAuthority: false`.
- `hardCancelOrNoReplyAuthority: false`.

## Coverage

Targeted coverage now proves:

- reviewer verdict, lane lifecycle, and reviewer lane conformance evidence can be prepared, written, reloaded, and inventoried through session evidence;
- forged reviewer verdict/lifecycle/conformance records are blocked;
- durable reviewer verdict linkage accepts only after reloaded verdict evidence and complete lifecycle evidence exist for every canonical verdict;
- missing lifecycle evidence blocks durable acceptance even when typed verdicts themselves are valid.

## Remaining Boundary

This closes the durable evidence-linkage gap for typed reviewer verdict acceptance. It does not promote managed dispatch. Full production dispatch still requires the existing managed-dispatch gates, fresh usage/provider health, Guard approval, pre-dispatch audit, durable idempotency reservation, configured verification, sanitized auth/provider policy, and separate release approval.
