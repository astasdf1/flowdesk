# Lane Finalization Capture Investigation — 2026-06-21

## Recovered design result

The FlowDesk task result for `workflow-dual-lane-finalization-fix-plan-20260621` incorrectly captured an intermediate 160-character progress sentence as terminal output. The actual OpenCode child session later produced a substantive 2,297-character final plan in text part `prt_eec86639e001N5rgZXSOhqf7LS`.

### Current evidence

The live smoke workflows showed the same symptom:

- `reloadOk=true`
- `lane_lifecycle=running`
- `agent_task_inconsistency=1`
- `task_result=0`
- `worstClassification=inconsistent_finalizing_without_terminal`
- Latest progress was `session.updated` / `session.diff`
- Safe next actions were status/debug/recovery only

### Implementation slices

1. **Contract/evidence cleanup**
   - Files: `session-finalization-evidence.ts`, `event-hook-observer.ts`
   - Keep `session.updated` / `session.diff` explicitly ambient.
   - Final-answer capture eligibility should come only from assistant final text, turn-completed, or terminal step evidence.

2. **Capture path fix**
   - File: `stall-recovery.ts`
   - If assistant final text exists, finalizing should converge to `task_result` and must not stay `running` / `inconsistent_finalizing_without_terminal` because of ambient churn.

3. **Timeout terminalization**
   - Files: `stall-recovery.ts`, `status-live-tool.ts`
   - Stale `inconsistent_finalizing_without_terminal` lanes should terminalize to `task_failed` plus terminal `lane_lifecycle` after a bounded hard cap.

### Timeout policy

- Preserve the soft grace: `agentTaskFinalizingInconsistencyGraceMs`.
- Use `finalizingAbsoluteMaxMs` as the hard boundary.
- Hard cap should be measured from finalizing start or `awaiting_body_capture_since`.
- Ambient `session.updated` / `session.diff` must not extend the hard cap.

### Regression tests

- `event-hook-observer.test.ts`: ambient session churn is not finalization-relevant.
- `stall-recovery.test.ts`: assistant final text captures to `task_result`.
- `stall-recovery.test.ts`: hard cap produces `task_failed` + terminal lifecycle.
- `stall-recovery.test.ts`: ambient churn after finalization does not leave a lane indefinitely inconsistent.
- `status-live-tool.test.ts`: stale inconsistent lanes are no longer shown as permanently running after terminal evidence exists.

### Acceptance criteria

- Final-answer live smoke ends with `task_result` or terminal `task_failed`/lifecycle.
- Process-note / readonly lanes terminalize after the bounded timeout when not safely capturable.
- Status-live no longer leaves the affected workflows as `running/inconsistent_finalizing_without_terminal` indefinitely.
- Active lanes are not falsely terminalized while still producing meaningful activity.

### Risks

- Too-aggressive timeout could fail a slow lane before late final text appears.
- Watchdog and status-live must share the same policy to avoid divergent projections.
- Backfilling terminal evidence for existing inconsistent lanes needs idempotent evidence ids.
