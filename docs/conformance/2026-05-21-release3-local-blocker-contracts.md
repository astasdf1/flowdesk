# Release 3 Local Blocker Contracts

Date: 2026-05-21

## Scope

This note records local-only contracts and tests for the remaining Release 3 blockers after the contract-foundation commits. It does not record live OpenCode runtime proof. No provider calls, real dispatch, actual lane launches, fallback/reselection execution, reviewer fan-out, hard chat no-reply/cancel claim, active-profile mutation, GitHub writes, or external storage writes were performed.

## Implemented Contracts

### Blocker #3: FDS-1 Schema Probe Result

`flowdesk.fds1_schema_probe_result.v1` records `probe_pass`, `probe_blocked`, or `probe_invalid`. A pass requires unknown-property rejection, malformed-event rejection, provider-facing conversion check, and runtime validator check. Forged pass states and runtime authority claims fail closed.

### Blocker #4: Chat Hook Authority Probe

`flowdesk.chat_hook_authority_probe.v1` records steering-only versus hard-control evidence without enabling hard chat authority. Missing `noReply`, cancel/stop, throw-blocking, timeout/null fail-closed, or malformed-return fail-closed proof keeps the result steering-only. Even a complete proof artifact still reports `hardCancelOrNoReplyAuthority=false` until a later release gate explicitly promotes authority.

### Blocker #7 Adapter Pre-Call Gate

The opt-in managed-dispatch adapter now requires a dispatch attempt manifest and consumed approval source before the injected SDK client can be called. Fake-client tests prove zero prompt calls when the manifest/approval bundle is missing or when pre-dispatch audit is not committed. Existing Guard/model/binding gates remain in front of the injected client.

### Blocker #8 Lane Lifecycle

`flowdesk.lane_lifecycle_record.v1` records parent/child/message/background/continuation refs with strict id-kind separation. It classifies `complete`, `incomplete`, `no_output`, `missing_verdict`, `aborted`, `timeout`, `late_output`, `orphaned`, and `invocation_failed`. Complete lanes require verdict refs; no-output and missing-verdict lanes cannot carry verdict refs.

### Blocker #9 Exact-Model Availability Cache

`flowdesk.exact_model_availability_cache.v1` binds same-day exact model availability to active profile, OpenCode version, FlowDesk package version, registry hash, Policy Pack hash, provider identity, and auth/account boundary. `flowdesk.reviewer_assignment_plan.v1` uses only registered + available + highest-tier entries and supports same-model multi-perspective assignment. Cache availability remains advisory planning input and does not imply dispatchability, usage freshness, provider health, approval, or Guard authority.

### Blocker #10 Fallback Decision

`flowdesk.fallback_decision.v1` requires a new attempt id, changed binding, fresh evidence refs, fresh Guard decision, fresh approval, fresh pre-dispatch audit, policy eligibility, runtime compatibility, and bounded max depth. Automatic fallback authority remains false; max-depth fallback must terminate as blocked.

### Blocker #11 Operational Intelligence

`flowdesk.operational_intelligence_score.v1` keeps hard filters ahead of advisory scores; blocked hard filters zero the score. `flowdesk.reference_pack.v1` is source-grounded/advisory-only and cannot act as specialist signoff, professional advice, dispatch authority, approval authority, or external-write authority.

## Verification

Commands run from `/Users/bagel_macpro_055/Documents/work/projects/flowdesk`:

1. `npm run typecheck` passed.
2. `npm test` passed: 304/304 tests.

## Authority State

All new artifacts remain non-authorizing. The following are still blocked pending explicit live conformance and user confirmation where applicable:

- Real dispatch/provider calls.
- Actual lane launch.
- Top-tier reviewer fan-out.
- Managed fallback/reselection execution.
- Hard chat no-reply/cancel/stop authority.
- Active-profile mutation.
- GitHub/external storage writes.

## Remaining Live Gates

The repository now has local contracts for blockers #3 through #11, but live gates remain separate:

1. Run provider-facing FDS-1 conversion proof only with explicit confirmation if it mutates external OpenCode runtime state.
2. Run chat hook authority runtime probe without provider calls; keep hard authority false unless a first-class boundary is proven.
3. Run managed-dispatch live conformance only after explicit user approval for provider call.
4. Run actual lane lifecycle proof only after explicit user approval for lane launch.
5. Run exact-model discovery/reviewer fan-out/fallback/external-ledger writes only after their own confirmations.
