# Release 3 Claude Managed-Dispatch Live Proof

Date: 2026-05-22

## Scope

This note records a bounded live Claude managed-dispatch proof through FlowDesk's explicit opt-in adapter path. It used `opencode serve` plus the active OpenCode SDK client. It did not use `opencode run`, did not print token material, did not mutate the active OpenCode profile, did not write GitHub/connector/storage/database/URL/raw-path targets, and did not promote default Release 1 dispatch authority.

## Boundary

The live proof preserved the existing managed-dispatch gate order:

1. Create an SDK session through the active OpenCode server.
2. Build FlowDesk evidence bound to `claude/claude-sonnet-4-5`.
3. Validate managed-dispatch beta Guard evidence, exact model binding, manifest, consumed approval source, durable pre-call evidence, idempotency reservation materialization, and promotion.
4. Call only the injected SDK `session.prompt` method through `dispatchManagedDispatchBetaPromptV1`.

The FlowDesk-to-OpenCode provider mapping was exercised live:

- FlowDesk evidence/request model: `claude/claude-sonnet-4-5`.
- OpenCode runtime provider/model passed by the adapter: `anthropic/claude-sonnet-4-5`.

## Result

The successful run returned this redacted summary:

```json
{
  "serverReady": true,
  "workflowId": "workflow-claude-live-1779423160706",
  "attemptId": "attempt-claude-live-1779423160706",
  "sessionId": "ses_1b21d5672ffeEpJ24bXau0BZBy",
  "responseMessageId": "msg_e4de2a9e7001fp0s0FNU2YBH3B",
  "status": "dispatch_completed",
  "dispatchMethod": "prompt",
  "requestedFlowDeskModel": "claude/claude-sonnet-4-5",
  "runtimeProviderID": "anthropic",
  "runtimeModelID": "claude-sonnet-4-5",
  "dispatchAttempted": true,
  "textContainsSentinel": true,
  "authority": {
    "realOpenCodeDispatch": true,
    "providerCall": true,
    "runtimeExecution": true,
    "actualLaneLaunch": false,
    "fallbackAuthority": false,
    "toolAuthority": false,
    "hardCancelOrNoReplyAuthority": false
  },
  "verification": {
    "ambiguityQuarantined": true,
    "configuredVerificationRef": "verification-claude-live",
    "preDispatchAuditRef": "audit-claude-live-1779423160706",
    "defaultRelease1ServerBehaviorUnchanged": true
  }
}
```

The returned model text contained the expected sentinel. The raw provider response and token/auth material were not printed or persisted.

## Failed Pre-Call Harness Attempt

An initial harness attempt failed before dispatch because the synthetic approval source had equal `issued_at` and `consumed_at` timestamps. `consumeFlowDeskProductionApprovalSourceV1` correctly rejected it with `approval source consumed_at must be after issued_at`. No SDK dispatch result was produced from that failed pre-call attempt; the harness was corrected by making `issued_at` precede `consumed_at`.

## Authority Interpretation

This closes the specific Claude managed-dispatch live proof gap for the explicit opt-in adapter path and the `claude` -> `anthropic` runtime mapping.

It does not promote default Release 1 real dispatch, automatic fallback/provider switching, hard chat `noReply`/`cancel`/`stop`, external writes, reviewer fan-out authority, or production release approval. The live dispatch authority shown above exists only inside the already-gated explicit opt-in managed-dispatch adapter invocation.
