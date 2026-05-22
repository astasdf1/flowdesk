# Release 3 Runtime Lane Lifecycle Live Proof

Date: 2026-05-22

## Scope

This note records a bounded runtime lane lifecycle proof using `opencode serve` and the active OpenCode SDK. It did not use `opencode run`, did not print token material, did not mutate the active profile, did not write GitHub/connector/storage/database/URL/raw-path targets, and did not promote default Release 1 dispatch authority.

## Live Lane Observation

The proof created one parent session and one coordinator-controlled child session, then prompted the child with a sentinel using `openai/gpt-5.4-mini-fast` and `agent=build`.

Redacted live summary:

```json
{
  "serverReady": true,
  "parentSessionId": "ses_1b219690cffeDJov5RJBidgKWg",
  "childSessionId": "ses_1b2196901ffeBH7zEmLPh3qM37",
  "firstChildMessageId": "msg_e4de69711001pkX5OmOw5QcWhL",
  "providerQualifiedModelId": "openai/gpt-5.4-mini-fast",
  "textContainsSentinel": true,
  "laneObservationStatus": "observed",
  "missingLabels": []
}
```

`observeInjectedSdkLaneV1` returned `observed` with these redacted references:

- Parent session ref: `parent-session-ses_1b219690cffeDJov5RJBidgKWg`.
- Child session ref: `child-session-ses_1b2196901ffeBH7zEmLPh3qM37`.
- Message ref: `message-msg_e4de69711001pkX5OmOw5QcWhL`.
- Observed agent ref: `agent-build`.
- Observed model ref: `model-openai-gpt-5.4-mini-fast`.
- Missing labels: none.

The lane observation helper remained non-authorizing:

- `realOpenCodeDispatch=false`.
- `providerCall=false`.
- `runtimeExecution=false`.
- `actualLaneLaunch=false`.
- `fallbackAuthority=false`.
- `toolAuthority=false`.
- `hardCancelOrNoReplyAuthority=false`.

These flags describe the observation result, not the fact that the live child prompt itself used a provider. The provider call occurred only in the bounded SDK lane proof.

## Missing Verdict Classification

The same child session was passed to `observeInjectedSdkReviewerVerdictV1` with a reviewer-verdict expectation. Because the child output was ordinary sentinel text rather than a typed `flowdesk.top_tier_review_verdict.v1`, the observer returned:

```json
{
  "status": "missing_verdict",
  "observationAttempted": true,
  "verdictPresent": false,
  "authority": {
    "realOpenCodeDispatch": false,
    "providerCall": false,
    "runtimeExecution": false,
    "actualLaneLaunch": false,
    "fallbackAuthority": false,
    "toolAuthority": false,
    "hardCancelOrNoReplyAuthority": false
  }
}
```

This proves missing typed verdict output remains a non-approval in the live SDK path.

## Lifecycle State Validation

The proof also validated representative `flowdesk.lane_lifecycle_record.v1` records for the complete and non-approval states:

```json
{
  "complete": true,
  "no_output": true,
  "missing_verdict": true,
  "timeout": true,
  "orphaned": true
}
```

The `complete` record requires child, message, output, runtime echo, telemetry, and verdict refs. The `no_output`, `missing_verdict`, `timeout`, and `orphaned` records validate only when they do not carry approval/verdict authority. This classification validation is local contract proof paired with the live parent/child/message observation above.

## Result

This closes the runtime lane lifecycle proof slice for parent/child/message ref observation and non-approval classification of missing verdict output. It does not promote default Release 1 dispatch, automatic fallback/provider switching, hard chat control, external writes, or reviewer verdict acceptance without typed verdicts and durable lifecycle linkage.
