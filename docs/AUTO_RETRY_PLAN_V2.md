# FlowDesk P7 Guarded Auto-Retry Design — V2

**Date**: 2026-05-26  
**Status**: Revised after Claude Opus + GPT critical review of V1  
**Gate**: Release 1 developer-mode (same gate as `flowdesk_quick_reviewer_run`)

---

## Change Log from V1

| Finding | V1 Issue | V2 Fix |
|---------|----------|--------|
| f-pol-001 / GPT | Guard HMAC not bound to retry attempt id | §3.3: Guard re-verify with retry attempt id + pending_retry_plan hash |
| f-pol-002 / GPT | Retry cap counts only retry_executed | §8: Count retry_executed ∪ retry_failed ∪ pending_retry_plan(pending\|launched) per lane |
| f-pol-003 | prompt_text no redaction_version | §3.1: Add redaction_version, mandatory redaction pass |
| f-pol-004 / GPT | Silent skip on SDK unavailable | §5: Emit retry_failed.v1 with reason=sdk_unavailable |
| f-pol-005 | No explicit anti-fallback statement | §2, §8: Exhausted cap → terminal, NO fallback regate |
| f-arch-001 | Missing superseded/expired states | §3.2: Add superseded, expired to pending_retry_plan status |
| f-arch-002 | Race condition on concurrent abort/retry | §8: Monotonic lifecycle terminal-check + single pending_retry_plan guard |
| f-arch-003 | Missing parent_session_ref, attempt_id | §3.1: Added to reviewer_lane_context |
| f-arch-004 | workflow_id + perspective invariant missing | §8: Enforce in evaluateGuardedAutoRetryHookV1 |
| f-arch-005 | Crash recovery undefined | §6: pending_retry_plan launched → retry_failed on recovery |
| f-ver-001 | Hook contract undefined | §4.2: Full input/output schema specified |
| f-ver-002 | Launch function timeout/abort undefined | §4.2: timeoutMs, AbortSignal, partial-failure semantics |
| f-ver-003 | No conformance fixtures | §9: Named fixtures defined |
| f-ver-004 | Disabled reason not differentiated | §4.2: DisabledAutoRetryReason enum |
| f-ver-005 | retry_failed redaction | §3.2: redacted_reason via standard redaction pipeline |
| GPT blocker | Release 1 real-dispatch classification | §2: Explicit gate rationale — same developer-mode path as quick reviewer |

---

## 1. Problem

P6 guarded auto-abort writes `lane_lifecycle state=aborted` evidence for a stalled FlowDesk-owned
reviewer lane. The user must then manually re-issue a reviewer request.

Goal: automatically retry the single failed reviewer perspective using the same injected-SDK
session path that `flowdesk_quick_reviewer_run` already uses, behind a Guard HMAC gate +
explicit config opt-in.

---

## 2. Release Gate Rationale

### Gate: Release 1 developer-mode (same as quick reviewer)

`flowdesk_quick_reviewer_run` already performs `session.create` + `session.promptAsync` in
Release 1 under the following constraints (PROGRESS_SNAPSHOT items 121, 167–172):

- Explicit per-config `quickReviewerRun.enabled: true` (user opt-in)
- Per-call `developerModeAcknowledged: true` (assistant must assert per invocation)
- Per-call `allowProviderCall: true`
- Guard HMAC sign-off required for guarded auto-abort (already in place for P6)

P7 guarded auto-retry reuses this exact SDK path. The Guard HMAC sign-off (already required and
present for auto-abort) serves as the equivalent of `developerModeAcknowledged=true` — it is
an out-of-band user-level explicit consent action (writing the signed ADR + sidecar) that is
equivalent in intent to per-call developer mode acknowledgement, but performed at setup time.

**Additional gating not in V1**:
- Guard HMAC verification is performed **per retry attempt** and must bind to the fresh
  `pending_retry_plan` evidence id (not just the original abort sign-off)
- `autoRetryAfterAbort: true` is a separate explicit config key (not implied by abort config)
- Retry only fires in the `auto_abort_executed` hook return path — never independently

### Not Release 1 if:
- Generic non-reviewer lane retry (unknown prompt reconstruction)
- Cross-model/provider fallback on retry
- Retry without Guard sign-off re-verification
- Retry count > `maxAutoRetries`

---

## 3. Evidence Schema

### 3.1 `flowdesk.reviewer_lane_context.v1`

Written at lane **launch** time by `executeFlowDeskRuntimeReviewerExecutionBridgeV1`.

```typescript
interface FlowDeskReviewerLaneContextV1 {
  schema_version: "flowdesk.reviewer_lane_context.v1";
  workflow_id: string;
  lane_id: string;
  lane_plan_ref: string;              // ref to runtime_lane_launch_plan evidence
  perspective: FlowDeskTopTierReviewPerspective;
  agent_ref: string;                  // e.g. "agent-reviewer-gpt-frontier"
  provider_qualified_model_id: string; // e.g. "openai/gpt-5.5"
  parent_session_ref: string;         // NEW: ses-* ref from launch plan
  original_attempt_id: string;        // NEW: attempt id of the quick reviewer run
  prompt_text: string;                // bounded to 8 192 chars
  prompt_text_truncated: boolean;
  prompt_text_sha256: string;         // SHA-256 of FULL prompt (before truncation)
  redaction_version: string;          // e.g. "v1" — mandatory, reject load if missing
  created_at: string;
  dispatch_authority_enabled: false;
}
```

**Constraints**:
- `prompt_text` capped at 8 192 chars; truncated version stored, full hash always stored
- Redaction pass applied before write: no raw provider tokens, absolute paths, auth payloads
- `dispatch_authority_enabled` always `false`

### 3.2 `flowdesk.pending_retry_plan.v1`

```typescript
interface FlowDeskPendingRetryPlanV1 {
  schema_version: "flowdesk.pending_retry_plan.v1";
  workflow_id: string;
  original_lane_id: string;           // stalled lane that was aborted
  new_lane_id: string;                // new lane id (pre-allocated, used as idempotency key)
  retry_attempt: number;              // 1-based
  context_evidence_id: string;        // ref to reviewer_lane_context.v1
  abort_evidence_id: string;          // ref to pending_abort_warning.v1 that triggered this
  status: "pending" | "launched" | "failed" | "cancelled" | "superseded" | "expired";
  created_at: string;
  expires_at: string;                 // NEW: created_at + guardSignOffExpiry; expired after this
  dispatch_authority_enabled: false;
}
```

**Status transitions**:
```
pending → launched (SDK session.create succeeded)
pending → failed   (Guard/invariant check failed or SDK failed before create)
pending → cancelled (user /flowdesk-abort cancels)
launched → (terminal in retry_executed.v1 or retry_failed.v1)
pending|launched → superseded (newer retry plan for same lane written)
pending|launched → expired (expires_at passed without terminal evidence)
```

### 3.3 `flowdesk.retry_executed.v1`

```typescript
interface FlowDeskRetryExecutedV1 {
  schema_version: "flowdesk.retry_executed.v1";
  workflow_id: string;
  original_lane_id: string;
  new_lane_id: string;                // matches pending_retry_plan.new_lane_id
  retry_attempt: number;
  perspective: FlowDeskTopTierReviewPerspective;  // NEW
  provider_qualified_model_id: string;             // NEW — must match context evidence
  new_parent_session_ref: string;
  original_attempt_id: string;                     // NEW — from context evidence
  created_at: string;
  dispatch_authority_enabled: false;
}
```

### 3.4 `flowdesk.retry_failed.v1`

```typescript
interface FlowDeskRetryFailedV1 {
  schema_version: "flowdesk.retry_failed.v1";
  workflow_id: string;
  original_lane_id: string;
  new_lane_id: string | undefined;    // may be absent if SDK call failed before create
  retry_attempt: number;
  failure_category: DisabledAutoRetryReason | "sdk_create_failed" | "sdk_prompt_rejected" | "indeterminate_launch";
  redacted_reason: string;            // via standard redaction pipeline
  created_at: string;
  dispatch_authority_enabled: false;
}
```

---

## 4. Function Contracts

### 4.1 `packages/core/src/retry-plan.ts`

```typescript
export type FlowDeskTopTierReviewPerspective = // already in core

export type DisabledAutoRetryReason =
  | "opt_in_false"
  | "guard_unverified"
  | "context_missing"
  | "context_redaction_invalid"
  | "cap_reached"
  | "sdk_unavailable"
  | "invariant_violated"
  | "concurrent_retry_in_progress"
  | "lane_not_terminal_aborted";

export type FlowDeskAutoRetryResultV1 =
  | { status: "auto_retry_not_configured"; reason: "opt_in_false" }
  | { status: "auto_retry_disabled"; reason: DisabledAutoRetryReason; retriesUsed?: number }
  | { status: "retry_launched"; newLaneId: string; pendingRetryEvidenceId: string }
  | { status: "retry_failed"; failureCategory: string; redactedReason: string }

export function validateFlowDeskReviewerLaneContextV1(value: unknown): ValidationResult
export function validateFlowDeskPendingRetryPlanV1(value: unknown): ValidationResult
export function validateFlowDeskRetryExecutedV1(value: unknown): ValidationResult
export function validateFlowDeskRetryFailedV1(value: unknown): ValidationResult
```

### 4.2 `evaluateGuardedAutoRetryHookV1` in `stall-recovery.ts`

```typescript
export async function evaluateGuardedAutoRetryHookV1(input: {
  config: FlowDeskAutoAbortConfigV1;      // autoRetryAfterAbort, maxAutoRetries added
  rootDir: string;
  workflowId: string;
  laneId: string;                         // the just-aborted lane
  abortEvidenceId: string;               // NEW: pending_abort_warning evidence id
  client: FlowDeskManagedDispatchBetaOpenCodeClientV1 | undefined;
  parentSessionId: string;
  timeoutMs?: number;                     // NEW: default 30000
  abortSignal?: AbortSignal;             // NEW
  now?: Date;
}): Promise<FlowDeskAutoRetryResultV1>
```

**Execution order (must be sequential — no concurrent duplicate)**:

1. Check `config.autoRetryAfterAbort === true` → else `auto_retry_not_configured`
2. Re-verify Guard HMAC (same `verifyGuardSignOffHmacV1`) → else `guard_unverified`
3. Check `client?.session?.create` present → else write `retry_failed(sdk_unavailable)` and return
4. Load `reviewer_lane_context.v1` for `laneId` → else `context_missing`
5. Verify `context.redaction_version` present → else `context_redaction_invalid`
6. Verify `context.workflow_id === workflowId && context.perspective` valid → else `invariant_violated`
7. Reload evidence, count retry attempts for `laneId`:
   - `retry_executed` + `retry_failed` + `pending_retry_plan(pending|launched)` ≥ `maxAutoRetries`
   - → write `retry_failed(cap_reached)`, return `auto_retry_disabled(cap_reached)`
8. Check no `pending_retry_plan(pending|launched)` already exists for `laneId`
   - → else `concurrent_retry_in_progress`
9. Verify `lane_lifecycle` terminal state = `aborted` for `laneId` (monotonic check)
   - → else `lane_not_terminal_aborted`
10. Generate `newLaneId = opaqueId("lane-retry")`, `pendingRetryEvidenceId`
11. Write `pending_retry_plan.v1(status=pending)` — **before** any SDK call
12. Call `launchFlowDeskInjectedSdkRuntimeLaneFromPlanV1` with context params
    - timeout: `timeoutMs` (default 30s), `abortSignal`
13. On `session.create` success but `promptAsync` rejection:
    - Write `retry_failed(sdk_prompt_rejected)`; update pending to `failed`
14. On `session.create` failure:
    - Write `retry_failed(sdk_create_failed)`; update pending to `failed`
15. On full success:
    - Write `retry_executed.v1`; update pending to `launched`
    - Return `retry_launched`

### 4.3 Crash recovery rule

On startup/reload: any `pending_retry_plan` in `launched` state with no matching `retry_executed`
or `retry_failed` within 10 minutes of `created_at` is reconciled as `retry_failed(indeterminate_launch)`.
This reconciliation is performed by `reconcileStalePendingRetryPlansV1` called on evidence reload.

---

## 5. Config extension

```jsonc
"chatMessageStallAlert": {
  "enabled": true,
  "guardedAutoAbort": {
    "autoAbortOnStall": true,
    "autoRetryAfterAbort": true,   // NEW: default false
    "maxAutoRetries": 1,           // NEW: default 1, maximum 2 (lowered from V1 max 3)
    "preAbortWarningMs": 60000,
    "guardHmacKey": "...",
    "productionMode": true,
    "useLiveSdkSessionHealth": true
  }
}
```

**Why maxAutoRetries max=2**: Provider rate-limit headroom and Guard window duration (30 days)
are sufficient for 2 retries; 3+ retries in an automated path without user observation risks
quota exhaustion. Hard ceiling=2 with no config override above 2.

---

## 6. Execution flow (complete)

```
auto_abort_executed → lane_lifecycle(aborted) evidence written
         ↓
evaluateGuardedAutoRetryHookV1 (if autoRetryAfterAbort=true)
  [1] opt-in check
  [2] Guard HMAC re-verify
  [3] SDK client check (fail → retry_failed(sdk_unavailable) evidence)
  [4] load reviewer_lane_context.v1
  [5] redaction_version check
  [6] workflow/perspective invariant check
  [7] count cap: retry_executed + retry_failed + pending(pending|launched) ≥ max?
         yes → retry_failed(cap_reached) + auto_retry_disabled(cap_reached)
  [8] concurrent pending check → else disabled(concurrent_retry_in_progress)
  [9] monotonic terminal-aborted lifecycle check
  [10] allocate newLaneId
  [11] write pending_retry_plan(pending) ← IDEMPOTENCY FENCE
  [12] launchFlowDeskInjectedSdkRuntimeLaneFromPlanV1 (30s timeout)
         session.create fails → retry_failed(sdk_create_failed) + pending→failed
         session.create ok, promptAsync fails → retry_failed(sdk_prompt_rejected) + pending→failed
         success → retry_executed.v1 + pending→launched
         ↓
stall card appends retry_launched / retry_failed / auto_retry_disabled status

On restart:
  reconcileStalePendingRetryPlansV1:
    pending_retry_plan(launched) + age > 10m + no terminal evidence
    → write retry_failed(indeterminate_launch)
```

---

## 7. Wire into `server.ts`

```typescript
// after evaluateGuardedAutoAbortHookV1 returns auto_abort_executed:
let retryResult: FlowDeskAutoRetryResultV1 | undefined;
if (
  abortResult.status === "auto_abort_executed" &&
  guardedAutoAbortConfig?.autoRetryAfterAbort === true &&
  input.client !== undefined
) {
  retryResult = await evaluateGuardedAutoRetryHookV1({
    config: guardedAutoAbortConfig,
    rootDir,
    workflowId: abortResult.workflowId,
    laneId: abortResult.laneId,
    abortEvidenceId: abortResult.pendingAbortEvidenceId,
    client: input.client,
    parentSessionId: input.info?.sessionID ?? "",
    timeoutMs: 30_000,
  });
}
// append retryResult status to stall card diagnostics
```

---

## 8. Safety invariants (complete)

| Invariant | Enforcement |
|-----------|-------------|
| Reviewer lanes only | `reviewer_lane_context.v1` must exist (only bridge writes it) |
| Max retry cap | Count retry_executed + retry_failed + pending(pending\|launched) ≥ maxAutoRetries (≤2) |
| Guard re-verification per retry | `verifyGuardSignOffHmacV1` called before each retry |
| No provider switching | Retry uses exact `provider_qualified_model_id` from context evidence |
| No fallback on cap exhaustion | Cap reached → terminal `retry_failed(cap_reached)`, NO fallback regate |
| Idempotency fence | `pending_retry_plan(pending)` written before SDK call |
| No duplicate concurrent retry | `pending(pending\|launched)` check blocks second hook call |
| Monotonic abort check | `lane_lifecycle terminal=aborted` must be latest evidence for lane |
| Crash recovery | `pending(launched) + age>10m + no terminal` → `retry_failed(indeterminate_launch)` |
| `dispatch_authority_enabled: false` | All evidence records enforce this |
| Redaction-first | `prompt_text` scrubbed via redaction pipeline; `retry_failed.redacted_reason` scrubbed |
| Workflow+perspective binding | `retry_executed.workflow_id == context.workflow_id AND perspective == context.perspective` |

---

## 9. Conformance fixtures (named)

| Fixture | Expected terminal evidence |
|---------|---------------------------|
| `happy_path_single_retry` | `retry_executed.v1`, `pending_retry_plan(launched)` |
| `cap_reached_after_one` | `retry_failed(cap_reached)` on second attempt |
| `cap_bypass_via_failures_blocked` | retry_failed(cap_reached) because failed+pending counted |
| `guard_stale_blocks_retry` | `auto_retry_disabled(guard_unverified)` |
| `context_missing_blocks` | `auto_retry_disabled(context_missing)` |
| `sdk_unavailable_emits_evidence` | `retry_failed(sdk_unavailable)` — not silent skip |
| `concurrent_retry_blocked` | `auto_retry_disabled(concurrent_retry_in_progress)` |
| `crash_recovery_indeterminate` | `retry_failed(indeterminate_launch)` after reconciliation |
| `prompt_rejected_after_create` | `retry_failed(sdk_prompt_rejected)` |
| `wrong_ownership_blocked` | `auto_retry_disabled(context_missing)` (no reviewer_lane_context) |

---

## 10. Implementation order

1. `packages/core/src/retry-plan.ts` — types + validators for all 4 evidence classes
2. `packages/core/src/state-paths.ts` — add 4 new segment keys
3. `packages/core/src/session-evidence.ts` — schema map + validation dispatch
4. `packages/core/src/index.ts` — exports
5. `packages/opencode-plugin/src/runtime-reviewer-execution-bridge.ts` — write `reviewer_lane_context.v1` with redaction + sha256 at launch
6. `packages/opencode-plugin/src/stall-recovery.ts` — `evaluateGuardedAutoRetryHookV1` + `reconcileStalePendingRetryPlansV1`
7. `packages/opencode-plugin/src/server.ts` — wire after abort, config parsing, `reconcileStalePendingRetryPlansV1` on stall reload
8. Tests — 10 conformance fixtures + unit tests

---

## 11. Not in scope (V2)

- Generic lane retry (non-reviewer lanes)
- Cross-model fallback on retry (Release 1 fallback prohibition)
- Retry chains (retry of retry — `retry_chain_root_attempt_id` tracked but chain depth=1)
- Manual `/flowdesk-retry` integration (separate command path, not modified here)
- maxAutoRetries > 2
