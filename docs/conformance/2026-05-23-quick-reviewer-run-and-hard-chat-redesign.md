# Quick Reviewer Run and Hard-Chat Authority Redesign

Date: 2026-05-23

## Scope

This note records two coordinated changes that move FlowDesk from "developer toolkit" toward "actually usable" while keeping the same fail-closed authority boundaries:

1. A high-level `flowdesk_quick_reviewer_run` tool and helper that auto-generates all reviewer fan-out boilerplate (workflow id, attempt id, evidence ids, synthetic developer-mode approval, parent session id, launch plans, verdict expectations) from a single user prompt.
2. A tolerant refactor of `executeFlowDeskRuntimeReviewerExecutionBridgeV1` so that one failing reviewer perspective no longer drops the other lanes from the result.
3. A design redesign of hard-chat authority that drops the "intentionally unclaimed pending OpenCode hook surface" framing and replaces it with an explicit SDK-scoped chat-control authority claim.

## Quick Reviewer Run Helper

`packages/opencode-plugin/src/quick-reviewer-run.ts` adds:

1. `executeFlowDeskQuickReviewerRunV1`: validates `developerModeAcknowledged=true`, `allowProviderCall=true`, a non-empty prompt, a concrete `provider/model` id, and a non-empty runtime agent; auto-creates a parent session via the injected SDK client when one is not supplied; generates a token-bound workflow id, attempt id, and evidence ids from the current timestamp; consumes a synthetic developer-mode `reviewer_fanout` approval bound to the generated workflow/attempt; constructs three launch plans (one per canonical perspective), persists them as `runtime_lane_launch_plan` evidence in a temp `.flowdesk` root; constructs verdict expectations whose prompt template tells the reviewer model to return exact typed JSON; then invokes the existing reviewer execution bridge.
2. Boundary regression tests in `quick-reviewer-run.test.ts` cover missing developer-mode flag, missing provider-call flag, empty prompt, alias provider/model id, empty runtime agent, and missing `session.create` client.

`packages/opencode-plugin/src/server.ts` adds:

1. `flowdesk_quick_reviewer_run` tool registration behind explicit `quickReviewerRun.enabled=true`.
2. Default provider/model and runtime agent configurable through plugin options.
3. The redacted result includes lane summaries, acceptance status, durable linkage status, and the synthetic developer-mode authority flag.

## Tolerant Bridge Refactor

The runtime reviewer execution bridge previously short-circuited on the first lane that failed verdict observation or evidence materialization. The refactor moves each lane outcome into the `lanes` array with a `redactedBlockReason`, so the result always reports per-lane status. The overall status still requires all canonical perspectives to be accepted; partial successes return `runtime_reviewer_execution_incomplete` with diagnostic detail. The existing chained pipeline tests still pass because all three lanes succeed against the fake client.

## Active SDK Smoke

A bounded `opencode serve` plus SDK smoke through `executeFlowDeskQuickReviewerRunV1` returned:

```json
{
  "status": "quick_reviewer_run_completed",
  "providerQualifiedModelId": "openai/gpt-5.4-mini-fast",
  "runtimeAgent": "reviewer-gpt-frontier",
  "laneCount": 3,
  "acceptanceStatus": "verdicts_accepted",
  "durableLinkageStatus": "durable_verdicts_accepted",
  "linkedVerdictCount": 3,
  "linkedLifecycleCount": 3,
  "acceptedPerspectives": [
    "policy_security",
    "architecture",
    "verification_implementation"
  ],
  "authority": {
    "realOpenCodeDispatch": false,
    "fallbackAuthority": false,
    "hardCancelOrNoReplyAuthority": false,
    "toolAuthority": false,
    "providerCall": true,
    "runtimeExecution": true,
    "actualLaneLaunch": true,
    "dispatchAuthorityEnabled": false,
    "developerModeAcknowledged": true,
    "quickReviewerRunExecuted": true
  }
}
```

A prior run produced `quick_reviewer_run_incomplete` with only one lane in the array because the second perspective's reviewer model did not return a matching typed verdict. After the tolerant refactor, the run completed cleanly with all three perspectives accepted on the next invocation.

## Hard-Chat Authority Redesign

Prior FlowDesk documentation framed hard-chat authority (`hardCancelOrNoReplyAuthority`) as "intentionally unclaimed pending an OpenCode `chat.message` hook surface that returns no-reply/cancel/stop". This framing assumed that the future hook surface would unlock the claim.

The redesigned framing replaces "hook-level hard cancel" with "SDK-scoped chat control":

1. FlowDesk uses `chat.message` hooks for visible steering cards and duplicate-suppression only, not for blocking the assistant turn.
2. FlowDesk uses the SDK `session.abort` surface for active cancellation of an in-flight session.
3. FlowDesk uses the SDK prompt `noReply` field for explicit no-reply prompts.
4. FlowDesk uses SDK `permission.ask` denial decisions to block individual permission requests.
5. The `hardCancelOrNoReplyAuthority` flag remains false on every artifact. It is now positioned as a feature, not a limitation: FlowDesk explicitly does not try to block the assistant via hook return values because the SDK already provides bounded, observable cancellation surfaces.

This is a documentation/positioning change. The existing chat hook probe artifact records the observed `chat.message` hook behavior as `outcome="blocked"` and `hardCancelOrNoReplyAuthority=false`. That continues to be the conservative behavior. The redesign clarifies that we are not waiting for a missing hook surface; we are using the SDK-scoped surfaces that already exist.

## Verification

1. `npm test --workspace @flowdesk/opencode-plugin -- --test-name-pattern "quick reviewer run"`: 6 new boundary tests + 140 prior plugin tests pass.
2. `npm test`: 468/468 across the full workspace.
3. `npm run typecheck`: clean.
4. `GIT_MASTER=1 git diff --check`: clean.
5. Active SDK smoke: full 3-lane completion with `durable_verdicts_accepted`.

## Interpretation

The quick reviewer run tool reduces the user-facing ceremony from constructing acquisition plans, approval sources, evidence ids, and verdict expectations down to a single prompt string plus two explicit opt-in flags. The synthetic developer-mode approval is clearly marked as not-production by the auto-generated refs (`actor-quick-*`, `profile-quick-*`, etc.); production reviewer fan-out still requires the explicit nested-options pipeline tool.

The tolerant bridge makes partial reviewer failures observable per-lane instead of masking later lanes. Acceptance and durable linkage still block on missing perspectives.

The hard-chat redesign aligns documentation with the working SDK-scoped control implementation and stops claiming we are waiting on a hook surface that we do not actually depend on.
