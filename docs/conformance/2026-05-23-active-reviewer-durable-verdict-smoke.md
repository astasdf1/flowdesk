# Active Reviewer Durable Verdict Smoke

Date: 2026-05-23

## Scope

This note records a bounded active-environment smoke of the explicit SDK reviewer-lane path after the complete lifecycle materializer was added.

The smoke used `opencode serve` plus the OpenCode SDK. It did not use `opencode run`, did not print token material, did not print reviewer transcripts, did not mutate the active OpenCode profile, did not perform fallback/reselection, did not execute remote writes, and did not promote default dispatch authority.

## Runtime Shape Fix

The first active attempt exposed a current-SDK shape gap: the runtime-lane launch and observation wrappers were still sending legacy `{ path, body }` envelopes to `session.create`, `session.prompt`, `session.children`, and `session.messages`. The current OpenCode SDK expects top-level `parentID`, `sessionID`, `model`, `agent`, and `parts` fields.

The adapter now sends the current SDK shape first and falls back to the legacy envelope only when the SDK returns a structured error response. Thrown prompt/provider failures are still treated as prompt failures and are not retried through the fallback path.

## Passing Smoke

The final passing smoke used one active OpenAI model for all three canonical reviewer perspectives:

```json
{
  "serverReady": true,
  "providerQualifiedModelId": "openai/gpt-5.4-mini-fast",
  "runtimeAgent": "reviewer-gpt-frontier",
  "laneCount": 3,
  "acceptanceStatus": "verdicts_accepted",
  "durableLinkageStatus": "durable_verdicts_accepted",
  "linkedVerdictCount": 3,
  "linkedLifecycleCount": 3,
  "reloadOk": true,
  "blockedCount": 0,
  "evidenceCounts": {
    "reviewer_verdict": 3,
    "lane_lifecycle": 6
  }
}
```

For each of `policy_security`, `architecture`, and `verification_implementation`, the smoke reported:

1. `launchStatus="lane_launch_started"`.
2. `runningLifecycle="running"`.
3. `observationStatus="verdict_observed"`.
4. `verdictMaterializationStatus="verdict_evidence_recorded"`.
5. `completeLifecycle="complete"`.

The durable linkage adapter accepted three reloaded reviewer-verdict evidence records and three complete lifecycle records for the same workflow and attempt.

## Authority Boundary

The accepted durable linkage result kept these authority flags disabled:

1. `realOpenCodeDispatch=false`.
2. `providerCall=false` on the linkage artifact.
3. `runtimeExecution=false` on the linkage artifact.
4. `actualLaneLaunch=false` on the linkage artifact.
5. `fallbackAuthority=false`.
6. `hardCancelOrNoReplyAuthority=false`.

The active SDK lane prompts did make bounded provider calls as part of the explicit smoke. Those calls are not default Release 1 dispatch authority and are not promoted by the durable verdict/linkage artifacts.

## Failed Attempts

Before the SDK-shape fix, the active launch wrapper returned `lane_launch_started` but `session.messages` returned an SDK error object for the legacy path shape, so verdict observation reported `missing_verdict`. No durable reviewer verdict evidence or complete lifecycle evidence was accepted from that attempt.

A later smoke run with `openai/gpt-5.5` completed the durable chain and printed the same successful evidence summary, but the temporary harness did not exit cleanly after closing the server and the shell killed it at timeout. A clean-exit retry then hit a transient `lane_launch_failed` before verdict work. The final clean passing run used `openai/gpt-5.4-mini-fast`.

## Interpretation

This closes the active practical path from explicit reviewer lane launch to typed verdict observation, durable verdict evidence, complete lifecycle materialization, durable linkage, and typed verdict acceptance for a same-model multi-perspective reviewer fan-out. Remaining product work is to connect this active path to the provider-acquisition-derived runtime launch-plan bridge as a user-facing explicit command/server flow, then continue to fallback/reselection, remote connector write, and default dispatch promotion gates.
