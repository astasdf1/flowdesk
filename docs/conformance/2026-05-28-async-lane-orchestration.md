# Async Lane Orchestration & Watchdog Nudge/Restart Design (2026-05-28)

## Scope

This document records the design and planned implementation for two tightly
related features:

1. **Async mode for `flowdesk_agent_task_run`** — the tool returns immediately
   after launching the child session (laneId only), eliminating the blocking
   MCP call that freezes the coordinator.

2. **Watchdog-based child session monitoring** — the existing `setInterval`
   watchdog takes over polling, nudging (with `noReply: true`), and aborting
   stalled child sessions.

3. **Usage-weighted workflow orchestration** — the `flowdesk_orchestrate`
   pipeline (Author → Assign → Schedule → Synthesize) now uses the
   `model-selection-engine` for usage-aware model assignment per task role.

All authority flags remain false throughout. No hard chat cancellation, no
automatic fallback/reselection, no production dispatch authority.

---

## Main Agent Role Boundary (Thin Coordinator Pattern)

This is a **structural constraint**, not just a preference. The main agent
(flowdesk-main) is a **thin coordinator only**. It has exactly three
responsibilities:

```
Main Agent (flowdesk-main)
    │
    ├── 1. PLAN   — decompose user request into typed task nodes
    │               (roles, dependencies, complexity)
    │
    ├── 2. DISPATCH — launch each task via flowdesk_agent_task_run
    │               (asyncMode: true, nudgeQuietPeriodMs: 20000)
    │               → immediately returns laneId
    │               → watchdog handles nudge / abort / retry
    │
    └── 3. SYNTHESIZE — collect terminal results from lanes
                    → aggregate into summaryForUser
                    → surface to user
```

### What the main agent must NOT do

| Forbidden action | Reason |
|-----------------|--------|
| Read/analyze code directly | Makes context bloat; belongs in a lane |
| Implement features or write patches | Implementation is a lane responsibility |
| Call external tools for complex search | Must dispatch to a lane instead |
| Copy large file contents into context | Context pollution; lanes return compact refs |
| Block waiting for a lane to complete | Causes coordinator freeze (the stall problem) |
| Use raw `task`, `bash` for subtask work | Bypasses FlowDesk lane monitoring |

### What the main agent may do directly (bounded exceptions)

The following are **always acceptable** without dispatching a lane:

- Call `flowdesk_provider_usage_live` to check headroom
- Call `flowdesk_status_live` to poll lane terminal state
- Call `flowdesk_lane_heartbeat_record` to record coordinator progress
- Read a **single small file** (< 50 lines) to verify lane output or confirm
  a file:line reference — not for analysis
- Write a **single small patch** when a lane already identified the exact
  change and the coordinator is just applying it
- Respond directly to conversational or status questions that require no
  analysis

### Coordinator context budget

The main agent keeps its context window small. Per turn:

| Item | Limit |
|------|-------|
| Lane result text copied in | ≤ 200 chars (summaryForUser only) |
| File content read directly | ≤ 50 lines total |
| Tool calls per turn | ≤ 5 (dispatch + status + usage) |
| Active lanes open simultaneously | ≤ 6 |

---

## Root Cause: Why the Current Structure Stalls

### Blocking MCP call chain

```
Coordinator (OpenCode session)
    │
    ├─ model calls tool: flowdesk_agent_task_run
    │       │
    │       └─ OpenCode waits for MCP response ──────────── (FROZEN)
    │
    │   MCP plugin process (Node.js event loop)
    │       │
    │       └─ extractAssistantTextFromResponse()
    │               ├─ session.messages(childId)    ← Promise.race 3s cap
    │               │       └─ if SDK uses sync I/O → event loop blocked
    │               └─ sendNudge()                  ← NO timeout (hangs)
```

**Three blocking points:**

| Point | Current state | Risk |
|-------|--------------|------|
| `session.messages` poll | 3s `Promise.race` | SDK sync I/O bypasses async timeout |
| `sendNudge()` | No timeout | prompt call can block indefinitely |
| MCP tool overall | Blocks until done | Coordinator cannot receive new messages |

### Why noReply is required for nudges

Without `noReply: true`, `sendNudge` sends a new user turn to the child
session. The child model replies, creating a second assistant message. The
`extractText` collector sees new activity, resets the inactivity clock, and
the stall is masked. With `noReply: true`, the nudge is a "poke" only — no
new assistant turn is generated — so stall detection remains accurate.

---

## Design

### 1. Async mode for `flowdesk_agent_task_run`

New option: `asyncMode: true` (default `false` for backward compatibility).

**Behavior with `asyncMode: true`:**
1. Call `session.prompt` to launch child session (still wrapped in
   `LAUNCH_TIMEOUT_MS = 60s`).
2. Write `running` lane lifecycle + heartbeat evidence.
3. Store `child_session_ref` in a new `agent_task_child_session.v1` evidence
   record so the watchdog can find it later.
4. Return immediately: `{ status: "task_launched", laneId, childSessionId }`.
5. The coordinator gets the laneId and uses `flowdesk_status_live` to poll
   for terminal state (completed / failed).

**Backward compatibility:** When `asyncMode` is absent or `false`, the
existing blocking behavior is preserved exactly.

### 2. Child session evidence record

New evidence class: `agent_task_child_session`  
Schema: `flowdesk.agent_task_child_session.v1`

```json
{
  "schema_version": "flowdesk.agent_task_child_session.v1",
  "workflow_id": "...",
  "lane_id": "...",
  "task_id": "...",
  "child_session_id": "...",
  "parent_session_ref": "ses-...",
  "provider_qualified_model_id": "...",
  "agent_ref": "...",
  "nudge_count": 0,
  "last_nudge_at": null,
  "created_at": "...",
  "dispatch_authority_enabled": false
}
```

The watchdog reads this record to find which child session to monitor for
each running lane.

### 3. Watchdog cycle enhancement

The existing `runFlowDeskWatchdogCycleV1` gains a new phase:
**child session monitor**.

For each running lane that has an `agent_task_child_session` evidence record:

```
Phase: child session monitor
─────────────────────────────────────────────────────────
For each running lane with child_session_id:

  1. Call session.messages(childSessionId) with 3s cap
     → If final assistant text found:
         a. Write task_result evidence
         b. Write terminal complete lifecycle
         c. Done (no nudge needed)

  2. Compute silence = now - last_activity
     → silence < 20s: no action, continue polling next cycle

  3. silence >= 20s AND nudge_count == 0:
         a. sendNudgeWithTimeout(childSessionId, noReply=true, timeoutMs=5000)
         b. Update nudge_count = 1, last_nudge_at = now
         c. Write updated child_session evidence

  4. silence >= 40s AND nudge_count == 1:
         a. sendNudgeWithTimeout(childSessionId, noReply=true, timeoutMs=5000)
         b. Update nudge_count = 2, last_nudge_at = now

  5. silence >= 60s AND nudge_count >= 2:
         a. Call session.abort(childSessionId) via abortFlowDeskSessionWithDecisionV1
         b. Write task_failed evidence (failure_category: "timeout")
         c. Write terminal invocation_failed lifecycle
         d. Trigger auto-retry if autoRetryAfterAbort enabled
```

**Nudge timing summary:**

| Silence | Action |
|---------|--------|
| 0–19s | Poll only |
| 20s | `session.prompt(childId, noReply: true)` nudge 1 |
| 40s | `session.prompt(childId, noReply: true)` nudge 2 |
| 60s+ | `session.abort(childId)` → task_failed → watchdog retry |

### 4. sendNudgeWithTimeout

Existing `sendNudge` has no timeout. New wrapper:

```typescript
async function sendNudgeWithTimeout(
  client, childSessionId, noReply, timeoutMs = 5_000
): Promise<"sent" | "timeout" | "skipped"> {
  const promptFn = client.session.prompt ?? client.session.promptAsync;
  if (!promptFn) return "skipped";
  try {
    await Promise.race([
      promptFn.call(client.session, {
        sessionID: childSessionId,
        noReply,
        parts: [{ type: "text", text: AGENT_TASK_NUDGE_TEXT }],
      }),
      new Promise((_, reject) =>
        setTimeout(() => reject(new Error("nudge timeout")), timeoutMs)
      ),
    ]);
    return "sent";
  } catch {
    return "timeout";
  }
}
```

### 5. Usage-weighted orchestration (model-selection-engine)

The `flowdesk_orchestrate` pipeline enforces the thin coordinator pattern.
The main agent dispatches all work via `flowdesk_agent_task_run`; it never
analyzes, implements, or synthesizes directly.

```
User request
    │
    ▼
flowdesk_orchestrate(goalSummary)   ← main agent calls this
    │
    ├── Phase 1: PLAN (Author lane)
    │       │
    │       ├─ main agent dispatches:
    │       │     flowdesk_agent_task_run(
    │       │       task: "decompose goal into typed task graph",
    │       │       asyncMode: true, nudgeQuietPeriodMs: 20000
    │       │     ) → laneId-author
    │       │
    │       ├─ watchdog monitors laneId-author
    │       │     (nudge@20s, nudge@40s, abort@60s+)
    │       │
    │       └─ main agent polls: flowdesk_status_live(laneId-author)
    │               → task_result: FlowDeskTaskGraphV1 evidence
    │
    ├── Phase 2: ASSIGN (usage-weighted, in-process)
    │       │
    │       ├─ flowdesk_provider_usage_live() → usageByFamily
    │       │
    │       └─ for each task node in graph:
    │               selectModelForTask(role, usageByFamily)
    │               → FlowDeskTaskModelSelectionV1 evidence
    │               (no lane needed — pure computation)
    │
    ├── Phase 3: DISPATCH (Schedule lanes)
    │       │
    │       ├─ for each task (DAG order):
    │       │     flowdesk_agent_task_run(
    │       │       task: node.summary + node.title,
    │       │       model: selectedModel, asyncMode: true
    │       │     ) → laneId-task-N
    │       │
    │       └─ watchdog monitors all task lanes in parallel
    │               (nudge@20s, nudge@40s, abort@60s+ per lane)
    │
    └── Phase 4: SYNTHESIZE (Synthesis lane)
            │
            ├─ main agent polls all task laneIds
            │     flowdesk_status_live() → all terminal
            │
            ├─ main agent dispatches:
            │     flowdesk_agent_task_run(
            │       task: "synthesize task results into summaryForUser",
            │       asyncMode: true
            │     ) → laneId-synthesis
            │
            └─ main agent polls: flowdesk_status_live(laneId-synthesis)
                    → summaryForUser → surface to user
```

**Key constraint**: At no point does the main agent read files, call APIs,
or analyze content directly. Every work unit is a lane.

The `Assign` phase (model selection) is the only exception — it is pure
in-process computation (no I/O, no provider calls) and produces only
planning evidence records.

**Model selection tiers:**

| Role | Tier | Primary candidates |
|------|------|--------------------|
| security | heavy | claude-opus, gpt-5.5 |
| architecture | heavy | gpt-5.5, claude-opus |
| review | heavy | claude-opus, gpt-5.5 |
| decision / implementation / verification / migration | medium | gpt-5.5, claude-sonnet, gemini-pro |
| exploration / documentation / git | light | gpt-5.5, claude-sonnet |

**Usage weight mapping:**

| remainingPercent | Weight |
|-----------------|--------|
| > 50% | 1.0 (full) |
| 30–50% | 0.7 |
| 10–30% | 0.3 |
| < 10% (critical) | 0.05 |
| exhausted | 0 (excluded) |

---

## Implementation Plan

### Files to change

| File | Change |
|------|--------|
| `packages/opencode-plugin/src/agent-task-runner.ts` | Add `asyncMode` option; wrap `sendNudge` in timeout; add `session.abort` path; write `agent_task_child_session` evidence |
| `packages/opencode-plugin/src/stall-recovery.ts` | New `monitorChildSessionsV1` function for watchdog phase |
| `packages/opencode-plugin/src/watchdog-cycle.ts` | Invoke `monitorChildSessionsV1` after stall detection |
| `packages/opencode-plugin/src/server.ts` | Expose `asyncMode` on `flowdesk_agent_task_run` tool args |
| `packages/opencode-plugin/src/workflow-scheduler.ts` | Support async mode: return laneIds, poll until terminal |
| `packages/core/src/state-paths.ts` | Add `agent_task_child_session` evidence class |
| `packages/core/src/session-evidence.ts` | Reload + validate child session records |
| `docs/conformance/2026-05-28-async-lane-orchestration.md` | This document |
| `docs/PROGRESS_SNAPSHOT.md` | Record design and implementation |

### Non-changes (preserved)

- Default `asyncMode: false` preserves all existing blocking behavior
- All authority flags stay false
- No automatic provider fallback or reselection
- `flowdesk_quick_reviewer_run` is unaffected (uses its own polling bridge)

---

## Authority Boundary

This design introduces no new dispatch, runtime, fallback, write, or hard-chat
authority:

- `session.prompt(noReply: true)` is an SDK nudge only, scoped to the child
  session the coordinator already launched
- `session.abort` is coordinator-issued session cleanup, not production abort
  authority
- `asyncMode` changes timing, not dispatch permissions
- `hardCancelOrNoReplyAuthority` remains false
- `dispatch_authority_enabled` remains false on all evidence records

---

## Open Questions

1. **`session.messages` sync I/O**: If the OpenCode SDK's `session.messages`
   truly blocks the Node.js thread (e.g., via Bun's synchronous IPC), the
   watchdog `setInterval` also cannot fire. Mitigation: the watchdog runs in
   the same process but async-mode lanes no longer hold the event loop hostage
   (the tool returns immediately). Watchdog cycles will fire between user
   messages.

2. **Coordinator polling protocol**: With `asyncMode: true`, the coordinator
   should call `flowdesk_status_live` after dispatching to check terminal state.
   The agent profile already documents this pattern.

3. **Result retrieval**: The watchdog writes `task_result` evidence when it
   finds the final text. The coordinator can read this via
   `flowdesk_status_live` or a future `flowdesk_task_result_get` helper.
