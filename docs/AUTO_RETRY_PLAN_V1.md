# FlowDesk P7 Guarded Auto-Retry Design — V1

**Date**: 2026-05-26  
**Status**: Draft for multi-perspective review  
**Gate**: Release 1 (uses same SDK path as quick reviewer, which is already Release 1-approved)

---

## 1. Problem

P6 guarded auto-abort marks a stalled FlowDesk-owned reviewer lane as `aborted` in evidence.  
After that, the user must manually run `/flowdesk-retry` or re-issue a quick reviewer request.  
Goal: automatically retry the failed reviewer lane after abort, behind an explicit opt-in + Guard gate.

---

## 2. Release Gate Assessment

### Allowed under Release 1?

Yes — with the following rationale:

| Criterion | Evidence |
|-----------|----------|
| SDK surface | `session.create` + `session.promptAsync` already used by `launchFlowDeskInjectedSdkRuntimeLaneFromPlanV1` in the quick reviewer path (PROGRESS_SNAPSHOT item 121) |
| Explicit opt-in | Requires `autoRetryAfterAbort: true` in config + Guard HMAC sign-off |
| Bounded | Max 1 retry by default, configurable via `maxAutoRetries: 1` |
| Scope | Reviewer lanes only (`spawned_by=flowdesk` + `reviewer_lane_context.v1` evidence present) |
| Authority | No new dispatch/fallback/hard-chat authority promoted |
| Audit | Full evidence trail: `reviewer_lane_context`, `pending_retry_plan`, `retry_executed`/`retry_failed` |

### Not allowed (and excluded from this plan):
- Generic non-reviewer lane retry (unknown prompt reconstruction path)
- Automatic provider/model switching on retry (Release 1 fallback prohibition)
- More than `maxAutoRetries` attempts in one guard sign-off window
- Retry without Guard re-verification

---

## 3. Architecture

### 3.1 New evidence class: `flowdesk.reviewer_lane_context.v1`

Stored at lane **launch** time by `executeFlowDeskRuntimeReviewerExecutionBridgeV1`.  
Contains everything needed to reconstruct the retry prompt.

```typescript
interface FlowDeskReviewerLaneContextV1 {
  schema_version: "flowdesk.reviewer_lane_context.v1";
  workflow_id: string;
  lane_id: string;
  lane_plan_ref: string;         // opaque ref to runtime_lane_launch_plan evidence
  perspective: string;           // "policy_security" | "architecture" | "verification_implementation"
  agent_ref: string;             // e.g. "agent-reviewer-gpt-frontier"
  provider_qualified_model_id: string;  // e.g. "openai/gpt-5.5"
  prompt_text: string;           // bounded to 8 192 chars (redacted if over limit)
  prompt_text_truncated: boolean;
  created_at: string;
  dispatch_authority_enabled: false;
}
```

**Constraints**:
- `prompt_text` capped at 8 192 chars; if original prompt is longer, store first 8 192 chars and set `prompt_text_truncated: true`
- `dispatch_authority_enabled` always `false`
- Written via session evidence write intent (same path as all other evidence)

### 3.2 New evidence classes for retry lifecycle

#### `flowdesk.pending_retry_plan.v1`
Written when auto-retry is triggered (after `auto_abort_executed`).

```typescript
interface FlowDeskPendingRetryPlanV1 {
  schema_version: "flowdesk.pending_retry_plan.v1";
  workflow_id: string;
  lane_id: string;              // original stalled lane
  new_lane_id: string;          // new lane id to be launched
  retry_attempt: number;        // 1-based
  context_evidence_id: string;  // ref to reviewer_lane_context.v1
  status: "pending" | "launched" | "failed" | "cancelled";
  created_at: string;
  dispatch_authority_enabled: false;
}
```

#### `flowdesk.retry_executed.v1`
Written after successful retry launch.

```typescript
interface FlowDeskRetryExecutedV1 {
  schema_version: "flowdesk.retry_executed.v1";
  workflow_id: string;
  original_lane_id: string;
  new_lane_id: string;
  retry_attempt: number;
  new_parent_session_ref: string;
  created_at: string;
  dispatch_authority_enabled: false;
}
```

#### `flowdesk.retry_failed.v1`
Written when retry launch fails.

```typescript
interface FlowDeskRetryFailedV1 {
  schema_version: "flowdesk.retry_failed.v1";
  workflow_id: string;
  original_lane_id: string;
  retry_attempt: number;
  redacted_reason: string;
  created_at: string;
  dispatch_authority_enabled: false;
}
```

---

## 4. New functions

### 4.1 `packages/core/src/retry-plan.ts`

```typescript
export function validateFlowDeskReviewerLaneContextV1(value: unknown): ValidationResult
export function validateFlowDeskPendingRetryPlanV1(value: unknown): ValidationResult
export function validateFlowDeskRetryExecutedV1(value: unknown): ValidationResult
export function validateFlowDeskRetryFailedV1(value: unknown): ValidationResult
```

### 4.2 `packages/opencode-plugin/src/stall-recovery.ts` — new function

```typescript
export async function evaluateGuardedAutoRetryHookV1(input: {
  config: FlowDeskAutoAbortConfigV1;        // reuse, adds autoRetryAfterAbort + maxAutoRetries
  rootDir: string;
  workflowId: string;
  laneId: string;                          // the just-aborted lane
  client: FlowDeskManagedDispatchBetaOpenCodeClientV1 | undefined;
  parentSessionId: string;
  now?: Date;
}): Promise<FlowDeskAutoRetryResultV1>
```

Return union:
```typescript
type FlowDeskAutoRetryResultV1 =
  | { status: "auto_retry_not_configured" }
  | { status: "auto_retry_disabled_max_retries_reached"; retriesUsed: number }
  | { status: "auto_retry_disabled_no_context" }     // no reviewer_lane_context evidence
  | { status: "auto_retry_disabled_no_client" }      // no injected SDK client
  | { status: "auto_retry_disabled_guard_invalid"; reason: string }
  | { status: "retry_launched"; newLaneId: string; pendingRetryEvidenceId: string }
  | { status: "retry_failed"; redactedReason: string }
```

### 4.3 Wire into `server.ts`

In `chat.message` hook, after `evaluateGuardedAutoAbortHookV1` returns `auto_abort_executed`:

```typescript
if (abortResult.status === "auto_abort_executed" && config.guardedAutoAbort?.autoRetryAfterAbort === true) {
  const retryResult = await evaluateGuardedAutoRetryHookV1({
    config: config.guardedAutoAbort,
    rootDir,
    workflowId: abortResult.workflowId,
    laneId: abortResult.laneId,
    client: input.client,
    parentSessionId: input.info?.sessionID ?? "",
    now,
  });
  // append retry status to stall card diagnostics section
}
```

---

## 5. Config extension

```jsonc
"chatMessageStallAlert": {
  "enabled": true,
  "guardedAutoAbort": {
    "autoAbortOnStall": true,
    "autoRetryAfterAbort": true,     // NEW — default false
    "maxAutoRetries": 1,             // NEW — default 1, max 3
    "preAbortWarningMs": 60000,
    "guardHmacKey": "...",
    "productionMode": true,
    "useLiveSdkSessionHealth": true
  }
}
```

---

## 6. Execution flow

```
stall detected (chat.message hook)
        ↓
evaluateGuardedAutoAbortHookV1
  → warning_issued (first hook call)
        ↓ (60s later)
  → auto_abort_executed
  → lane_lifecycle state=aborted evidence written
        ↓
evaluateGuardedAutoRetryHookV1 (if autoRetryAfterAbort=true)
  → check retry count from retry_executed evidence (≤ maxAutoRetries)
  → load reviewer_lane_context.v1 for aborted lane
  → check Guard HMAC still valid
  → check client.session.create available
  → write pending_retry_plan.v1 (status=pending)
  → call launchFlowDeskInjectedSdkRuntimeLaneFromPlanV1
      (reuse existing launch infrastructure)
  → on success: write retry_executed.v1 + update pending_retry_plan status=launched
  → on failure: write retry_failed.v1 + update pending_retry_plan status=failed
        ↓
stall card shows "auto_retry_launched" or "auto_retry_failed"
```

---

## 7. Implementation order

1. `packages/core/src/retry-plan.ts` — new schema + validators
2. `packages/core/src/state-paths.ts` — add `reviewer_lane_context`, `pending_retry_plan`, `retry_executed`, `retry_failed` segments
3. `packages/core/src/session-evidence.ts` — add schema map entries + validators
4. `packages/core/src/index.ts` — export new types
5. `packages/opencode-plugin/src/runtime-reviewer-execution-bridge.ts` — write `reviewer_lane_context.v1` at launch
6. `packages/opencode-plugin/src/stall-recovery.ts` — add `evaluateGuardedAutoRetryHookV1`
7. `packages/opencode-plugin/src/server.ts` — wire `evaluateGuardedAutoRetryHookV1` after abort, extend config parsing
8. Tests — unit + integration

---

## 8. Safety invariants

| Invariant | Enforcement |
|-----------|-------------|
| Only FlowDesk-owned reviewer lanes are retried | `reviewer_lane_context.v1` must exist (written only by FlowDesk bridge) |
| Max retry cap | Count `retry_executed` evidence records for the lane; block if ≥ `maxAutoRetries` |
| Guard re-verification on every retry | `verifyGuardSignOffHmacV1` called in `evaluateGuardedAutoRetryHookV1` |
| No provider switching | Retry uses the exact same `provider_qualified_model_id` from context evidence |
| Idempotency | `pending_retry_plan.v1` written before SDK call; duplicate `new_lane_id` blocked |
| No dispatch authority escalation | All new evidence records carry `dispatch_authority_enabled: false` |
| Fail-closed | Any missing evidence/client/guard → `auto_retry_disabled_*` result, no retry |

---

## 9. Known limitations (V1)

- Retry only for **reviewer lanes** (not generic worker lanes)
- `prompt_text` truncated at 8 192 chars — very long review prompts may produce partial retries
- Single retry attempt per guard sign-off window by default (`maxAutoRetries: 1`)
- Retry uses same model/agent as original — no model fallback on retry
- If `session.create` is unavailable (non-injected context), retry is silently skipped

---

## 10. Not in scope (V1)

- Generic lane retry (requires prompt reconstruction for non-reviewer lanes)
- Cross-model fallback on retry (Release 1 fallback prohibition)
- Retry chains (retry of retry)
- Manual `/flowdesk-retry` integration (separate command path)
