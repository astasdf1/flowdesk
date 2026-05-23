# Runtime Launch Plan Materialization

Date: 2026-05-23

## Scope

This note records the durable session-evidence bridge from ready `reviewer_fanout_plan` evidence to one `runtime_lane_launch_plan` evidence record per planned reviewer lane.

The bridge materializes launch planning evidence only. It does not call the OpenCode SDK, does not launch reviewer lanes, does not execute provider calls, does not run prompts, does not observe lane output, does not accept typed verdicts, does not perform fallback/reselection, and does not promote dispatch authority.

## Implemented Contracts

`@flowdesk/core` session evidence now supports a new evidence class:

```text
runtime_lane_launch_plan -> flowdesk.runtime_lane_launch_plan.v1
```

The new helper `materializeFlowDeskRuntimeLaneLaunchPlansFromReviewerFanoutEvidenceV1`:

1. Selects exactly one valid `reviewer_fanout_plan` evidence record by workflow and optional evidence id.
2. Requires the fan-out plan to be `fanout_ready`.
3. Requires one target launch-plan evidence id per runtime lane launch request.
4. Re-runs `planFlowDeskRuntimeLaneLaunchV1` for every launch request.
5. Requires the existing non-launch preconditions for `launch_ready`: SDK-client availability evidence and a durable evidence-root ref, plus the audit/approval refs already embedded in the request.
6. Blocks duplicate target evidence ids before writes.
7. Writes all launch-plan records through the existing session-evidence prepare/apply path and reload-verifies the resulting records.

## Verification

Targeted verification is covered by:

```bash
npm test --workspace @flowdesk/core -- --test-name-pattern "session evidence|runtime lane"
```

The new tests prove:

1. `runtime_lane_launch_plan` records reload as durable session evidence and reject forged launch/runtime authority.
2. Ready fan-out evidence can materialize three launch-ready runtime launch-plan records.
3. Missing SDK-client availability blocks before writes.
4. Duplicate target launch-plan evidence ids block before additional writes.

## Interpretation

This closes the durable planning step after provider-backed reviewer fan-out topology evidence. Runtime launch plans can now be audited and reloaded before any actual SDK lane launch is attempted.

The next gated work remains actual reviewer lane execution and lifecycle observation. That still requires explicit runtime-launch approval consumption, SDK-client launch orchestration, no-output/missing-verdict classification, typed verdict persistence, durable lifecycle linkage, and verdict acceptance gates.
