# Lane Termination Redesign

## 1. Problem Statement
Historically, `step-finish` was incorrectly treated as a terminal signal for FlowDesk lanes. In practice, this led to several issues:
- **`no_output` failures**: Lanes reporting `step-finish` with an empty body were erroneously classified as complete without actual output, causing loss of task results.
- **`awaiting_body_capture` loops**: Lanes remained in an awaiting state, retrying or nudging unnecessarily because the `step-finish` signal didn't imply actual completion of the work.

## 2. OMO Reference
The `oh-my-openagent` (OMO) architecture provides a more robust termination model, using a combination of session state, output validation, and todo tracking, with a stale timeout as a safety net.

Key implementation components:
- `session-status-classifier.ts`: Defines `idle` and `interrupted` states as terminal.
- `session-idle-event-handler.ts`: Logic to determine completion: `idle + validateSessionHasOutput + checkSessionTodos` → `complete`.
- `task-poller.ts`: Manages the stale timeout cascade to ensure lanes don't hang indefinitely.

### 2.1 OMO Completion Gate Details (captured 2026-06-19)

Use this section as the local reference instead of re-searching OMO when touching
FlowDesk capture/finalization logic.

Reference repository and paths:
- Repository: `https://github.com/code-yeongyu/oh-my-openagent`, branch `dev`.
- `packages/omo-opencode/src/features/background-agent/session-idle-event-handler.ts`
- `packages/omo-opencode/src/features/background-agent/session-status-classifier.ts`
- `packages/omo-opencode/src/features/background-agent/task-poller.ts`
- `packages/omo-opencode/src/features/background-agent/manager.ts`
- `packages/omo-opencode/src/features/background-agent/constants.ts`

Observed OMO semantics:
- `turncompleted`, `step-finish`, and message-update events are **activity/output
  signals**, not subtask completion signals.
- Background task completion is driven by `session.idle` or polling that observes
  the session is idle/gone/terminal, never by a single assistant turn completing.
- Early idle is deferred: `MIN_IDLE_TIME_MS = 5000`; idle observed before this
  minimum is re-emitted later instead of completing the task immediately.
- Active statuses are `busy`, `retry`, and `running`; if polling sees one of
  these, OMO explicitly skips completion.
- Known terminal statuses are `idle` and `interrupted`, but `idle` is not treated
  as a hard terminal by itself; it enters the completion validation path.
- Before completion, OMO validates that the session has real assistant/tool
  output. It checks for assistant/tool messages and content-bearing parts such as
  `text`, `reasoning`, `tool`, and non-empty `tool_result`.
- Before completion, OMO checks session todos; any todo not `completed` or
  `cancelled` blocks completion.
- After async validation/todo checks, OMO re-checks that the task is still
  `running` before completing, preventing races with other terminal paths.
- Team/member sessions skip background auto-complete on idle.
- Stale timeout and session-gone handling are safety nets, not the normal result
  capture path.

FlowDesk implication:
- `turncompleted` must be downgraded to “body/readiness candidate” evidence.
- A FlowDesk lane must not write `task_result` or terminal lifecycle evidence
  until a session-idle/quiescence gate passes, there are no running/unknown tools,
  the captured output is not `process_notes`/`tool_trace_only`/`empty`, no newer
  lane activity invalidates the observed turn-completed candidate, and any
  tracked same-lane work/todos are complete or absent.
- If a `turncompleted` candidate is followed by later assistant/tool/progress
  activity, that candidate is stale and cannot justify capture.

## 3. Redesigned Termination Signal Hierarchy
The new signal hierarchy for FlowDesk termination (prioritized):

1. **`terminalObserved` + `body`**: Explicit terminal signal with actual content.
2. **`session.idle` + `output`**: Session is idle AND valid output has been validated.
3. **`step-finish` + `body` + `settle`**: `step-finish` with valid content AND stability check (settle).
4. **Liveness poll failure**: Detected by the periodic liveness check (see section 4).
5. **Absolute hard cap**: Final fallback mechanism (e.g., 180s timeout).

**IMPORTANT:** `step-finish` with *no body* is explicitly NOT a terminal signal.

## 4. Periodic Liveness Check Design
To prevent stuck lanes, we implement a periodic liveness check:
- **Frequency**: Every `T` seconds (TBD, e.g., 15s).
- **Mechanism**:
    1. Read `session.messages()` directly.
    2. Check for:
        - `text` presence.
        - Active `running` tools.
        - `idle` state.
    3. Increment a `missCounter` for consecutive readings where:
        - No text AND no active tools AND not idle.
    4. Terminate the lane on `N` consecutive misses.

## 5. Key Invariants
- Never terminate on `step-finish` alone (must include body/validation).
- Always verify output presence before marking as complete.
- Liveness check is mandatory to prevent permanently stuck lanes.

## 6. Files to Modify
- `packages/opencode-plugin/src/stall-recovery.ts`: Update `monitorChildSessionsV1` to implement the new hierarchy and liveness check.
- `packages/opencode-plugin/src/session-finalization-evidence.ts`: Update `evaluateFlowDeskSessionFinalizationEvidence` to reflect these rules.
