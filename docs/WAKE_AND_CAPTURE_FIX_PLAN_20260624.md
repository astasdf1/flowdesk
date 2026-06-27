# FlowDesk Wake Notification and Capture Finalization Fix Plan

**Date**: 2026-06-24
**Status**: Documentation only / Plan for sequential implementation
**Authority Boundary**: No dispatch approval, provider selection, fallback/reselection, write/apply, hard-chat/noReply, or Guard authority changes.

---

## Executive Summary

This plan addresses two distinct problems in FlowDesk's lane finalization and wake-notification delivery:

1. **Capture/Finalization Failures**: Lanes produce safe-capture-ready evidence but fail to materialize terminal `task_result`/`task_failed` records, leaving them in `inconsistent_finalizing_without_terminal` state despite observable completion text.

2. **Wake Notification Loss**: Wake inbox rows can be marked `consumed=true` after SDK prompt resolves, without proof the user saw the notification. Later notices can overwrite earlier ones in the persisted wake-notification file.

Both problems are blocking FlowDesk lane reliability under the current verified authority boundary. This plan proposes focused fixes in two sequential implementation phases.

---

## Problem A: Capture and Finalization Convergence Failures

### Symptom

Lanes reach `finalizing/step-finish` state and produce durable evidence showing:
- Assistant text present and observable
- `safe_capture_ready` session-finalization evidence
- Terminal progress labels (session idle, step finish)
- **But**: No terminal `task_result` or `task_failed` record materializes
- **Result**: Lane stays `running`/`inconsistent_finalizing_without_terminal` indefinitely

### Root Cause Candidate

The awaiting-body rescue path in `stall-recovery.ts`:

1. Observes `safe_capture_ready` finalization evidence or stabilized final-answer text
2. Writes `safe_capture_ready` progress label
3. Evaluates output kind: if `final_answer`, continues to terminal task-result path
4. But `canPersistAwaitingBodyCaptureRescueTerminalTaskResultFromOutputKind(outputKind)` may return `outputKind === "final_answer"` **and also** continue without terminal evidence
5. This leaves running/inconsistent state despite safe durable evidence

A secondary hypothesis: the `outputKind` gate checks for `final_answer` but bare `continue` statements allow lanes to escape without branching to terminal task-result or task-failed materialization.

### Fix: Capture Convergence Guard

**Invariant**: If `safe_capture_ready` or stable final-answer text exists, the branch **must** terminalize:

- **Branch path A (Safe)**: Write terminal `task_result` with the final-answer body
- **Branch path B (Not safe)**: Write terminal `task_failed` with `failure_category=unknown` / `redacted_reason=unsupported_or_requires_review`
- **Branch path C (No output)**: Write terminal `task_failed` with `failure_category=no_output` / `redacted_reason=step_finish_without_body`
- **Never**: Bare `continue` or skip to running state after observing `safe_capture_ready`

Implementation approach:
- Audit `stall-recovery.ts` awaiting-body rescue path for all code paths after `safe_capture_ready` detection
- Enforce: every path must call `writeTerminalTaskResultV1()` or `writeTerminalTaskFailedV1()`
- Add intermediate progress/finalization labels before terminal write so durable evidence shows intent even if write fails

### Related Test Coverage

Existing tests already cover:
- `"V11.2 correction: stable final-answer text captures after bounded quiescence without session idle"`
- `"buildFlowDeskCaptureSafetyMetadataV1: final_answer with stable_idle is safe_for_auto_synthesis=true"`
- `"monitorChildSessionsV1 terminalizes stable process_notes without task_result"`

New focused tests needed:
1. **step-finish/text missing**: Lane with assistant text + step-finish but no terminal session-idle signal → must not stay running indefinitely
2. **safe_capture_ready/no task_result**: Lane with safe finalization evidence but missing task_result record → must capture or terminalize on next watch cycle
3. **outputKind mismatch**: Finalization evidence outputKind conflicts with actual output classification → must fail-safe to task_failed/requires_review
4. **process_notes/tool_trace/empty safety**: Lane with process-notes/tool-trace/empty output + safe_capture_ready → must not write task_result; must write task_failed instead

---

## Problem B: Wake Notification Loss and Overwrite

### Symptom

Wake inbox management:
- Rows can be marked `consumed=true` after SDK prompt resolves, **before user sees the notification**
- `main-session-wake-notifications.json` persisted state can be overwritten by later notices without merging
- Unclear whether "consumed" means "delivered to sidebar" or "prompt resolved in background"
- No persistent inbox state separate from a single overwritable file

### Root Cause Candidate

1. **Eager consumption**: Wake row is marked consumed after `session.prompt()` returns, not after user interaction or sidebar display
2. **Single-file persistence**: New wake notices serialize directly to `main-session-wake-notifications.json`, replacing prior state without merge logic
3. **No inbox state machine**: Wake delivery is request-response only; no separate inbox/sidebar/user-visible state

### Fix: Wake Notification Status-First Inbox

**Design principle**: Treat wake notifications as status-visible inbox items, not transient request-response messages. Use best-effort nudge prompts only as secondary delivery mechanism.

Implementation approach (sequential):

1. **Status/sidebar-first inbox** (Phase 1):
   - Move wake notifications into status-live output as a top-level `recent_wake_notices` list (max 10 items)
   - Each notice carries: `notice_id`, `timestamp`, `title`, `category` (e.g. "lane_stalled", "provider_health")
   - Status-live becomes the canonical source of truth; users see notices in `/flowdesk-status` output
   - Sidebars/TUI extensions can render the status-live inbox list without prompt/consume semantics

2. **Additive schema fields** (Phase 1):
   - Add `user_acknowledged: boolean` field to wake notices instead of redefining legacy `consumed`
   - Add `prompt_attempt_count: integer` for diagnostics
   - Keep historical `consumed` field for backward compatibility but deprecate its semantics
   - Never overwrite the entire notice file; use append/merge logic instead

3. **Prompt as best-effort nudge** (Phase 2):
   - Treat `session.prompt()` call as a nudge-only delivery mechanism
   - Prompt result (user click / dismiss / timeout) is diagnostic, not the source of truth for delivery
   - If prompt fails or times out, notice remains visible in status-live inbox
   - If prompt succeeds, set `prompt_attempt_count++` but do not automatically set `user_acknowledged`

4. **Cross-process consume safety** (Phase 2):
   - Persist wake notices in a subdirectory structure (`~/.flowdesk/wake-notices/{notice_id}.json`) instead of a single file
   - Use file-based locks or atomic writes to prevent overwrites
   - Ensure that status-live reads remain read-only and cannot corrupt persisted notices

### Related Test Coverage

New focused tests needed:
1. **Prompt resolves but not visible**: Lane produces wake notice → prompt called → prompt resolves → status-live still shows notice
2. **Later notice does not overwrite**: First notice created → second notice created → both visible in status-live
3. **Status_live remains read-only**: Concurrent status-live reads do not corrupt notice state
4. **Cross-process consume does not erase**: One FlowDesk command marks notice as `user_acknowledged` → next status-live read still shows it with updated field

---

## Scope and Constraints

### In Scope

- Documentation only
- Design of code changes without writing production code
- Test specifications for focused regression coverage
- Authority boundary definition (what changes are **not** granted)

### Out of Scope (For Later Implementation Lanes)

- Writing or editing production `*.ts` files
- Test implementation or test data fixtures
- Running tests or CI/CD
- Database redaction or migration
- SDK/OpenCode compatibility changes beyond current paths

### Authority Boundary

This plan grants **no changes** to:
- Hard-chat / `noReply` / `cancel` / `stop` semantics
- Managed dispatch gating or approval
- Fallback / reselection logic
- Write/apply/controlled-write authority
- User approval semantics or Guard logic

Changes are limited to:
- Internal lane finalization state machine (stall-recovery)
- Wake notification inbox management (storage/schema, not delivery timing)
- Diagnostic evidence persistence (adding fields, not changing validation)
- Test-only coverage and fixtures

---

## Implementation Order

### Phase 1: Capture Convergence Fix

**Goal**: Eliminate `inconsistent_finalizing_without_terminal` states by enforcing terminal-evidence materialization after `safe_capture_ready` detection.

**Sequential Steps**:

1. **Audit awaiting-body rescue path**
   - File: `packages/opencode-plugin/src/stall-recovery.ts`
   - Task: Trace all code paths from `safe_capture_ready` detection through function exit
   - Task: Identify any bare `continue` or early return without terminal-evidence write
   - Output: Annotated code map of gaps

2. **Implement capture-convergence guard**
   - File: `packages/opencode-plugin/src/stall-recovery.ts`
   - Task: Add explicit branching after `safe_capture_ready`: final-answer path → task_result, not-safe path → task_failed, no-output path → task_failed
   - Task: Add pre-terminal progress labels so durable evidence shows intent even if write fails
   - Task: Ensure no bare continue after outputKind gate

3. **Add focused regression tests**
   - File: `packages/opencode-plugin/src/stall-recovery.test.ts`
   - Task: Step-finish/text missing test (lane stays running indefinitely → must fail)
   - Task: Safe_capture_ready/no task_result test (durable evidence exists but no terminal record → must capture)
   - Task: OutputKind mismatch test (finalization evidence conflicts with classification → must fail-safe)
   - Task: Process_notes/tool_trace/empty safety test (never write task_result for non-final output)

4. **Verification**
   - `npm run typecheck --workspace @flowdesk/opencode-plugin`
   - `npm run build --workspace @flowdesk/opencode-plugin`
   - `node --test packages/opencode-plugin/dist/stall-recovery.test.js`
   - All existing + new tests pass; no new TODOs introduced

### Phase 2: Wake Notification Status-First Inbox

**Goal**: Make wake notifications visible in status output and prevent loss of earlier notices to overwrites.

**Sequential Steps**:

1. **Design status-live inbox schema**
   - File: `packages/opencode-plugin/src/status-live-tool.ts`
   - Task: Define `recent_wake_notices` array in status output schema
   - Task: Define notice fields: `notice_id`, `timestamp`, `title`, `category`, `user_acknowledged`, `prompt_attempt_count`
   - Output: Schema sketch document or updated type definitions

2. **Implement status-live inbox rendering**
   - File: `packages/opencode-plugin/src/status-live-tool.ts`
   - Task: Read persisted wake notices
   - Task: Render as `recent_wake_notices` in status-live output
   - Task: Preserve backward-compatibility field layout

3. **Update wake-notification persistence**
   - File: `packages/opencode-plugin/src/local-adapter.ts` or wake-notification module
   - Task: Change single-file persistence to merge/append logic
   - Task: Add `user_acknowledged` field to schema (keep `consumed` for backward compat)
   - Task: Implement file-lock or atomic-write safety for cross-process writes

4. **Refactor prompt delivery to nudge-only**
   - File: `packages/opencode-plugin/src/wake-notification.ts` (or equivalent)
   - Task: Update code comments to clarify prompt is best-effort nudge
   - Task: Increment `prompt_attempt_count` instead of immediately setting `consumed`
   - Task: Ensure prompt failures do not delete notices from inbox

5. **Add focused regression tests**
   - File: `packages/opencode-plugin/src/status-live-tool.test.ts` or `packages/opencode-plugin/src/wake-notification.test.ts`
   - Task: Prompt resolves but not visible → status-live shows notice
   - Task: Later notice does not overwrite → both visible in status
   - Task: Status_live remains read-only → concurrent reads do not corrupt state
   - Task: Cross-process consume does not erase → notice visible with updated field

6. **Verification**
   - `npm run typecheck --workspace @flowdesk/opencode-plugin`
   - `npm run build --workspace @flowdesk/opencode-plugin`
   - `node --test packages/opencode-plugin/dist/status-live-tool.test.js packages/opencode-plugin/dist/wake-notification.test.js`
   - All existing + new tests pass; no new TODOs introduced

---

## Terminology Correction

Throughout this plan and future implementation lanes:

**Avoid**: "Release 1" as a decision label
**Use instead**: "Current verified authority boundary" or "Phase 1 MVP scope"

This clarifies that decisions are tied to proven authority/conformance gates, not marketing phases.

---

## Missing Facts and Open Questions

1. **SDK session.prompt() timeout semantics**: Does prompt timeout count as user dismissal or delivery failure? (Needed for Phase 2 design.)
2. **Concurrent wake-notification writers**: Are multiple FlowDesk processes expected to write wake notices simultaneously? (Affects file-lock strategy.)
3. **Historical wake-notification data**: Should existing `main-session-wake-notifications.json` entries migrate to the new structure, or start fresh? (Affects Phase 2 rollout.)
4. **Status-live refresh latency**: What is acceptable latency for status-live to reflect a new wake notice? (Affects Phase 2 UI expectations.)

---

## Reference Documents

- `PROGRESS_SNAPSHOT.md` (ongoing implementation context)
- `LANE_TERMINATION_REDESIGN.md` (lane finalization hierarchy)
- `LANE_FINALIZATION_CAPTURE_INVESTIGATION_20260621.md` (root cause analysis)
- `FLOWDESK_OPENCODE_PLUGIN_IMPLEMENTATION_SPEC.md` (normative behavior spec)

---

## Next Steps

After this plan is captured in the progress snapshot:

1. Implementation lane for Phase 1 (capture convergence): audit, guard implementation, tests, verification
2. Implementation lane for Phase 2 (wake notification inbox): status-live integration, persistence, nudge refactor, tests, verification
3. Optional: Cross-cutting conformance review for authority boundaries and threat-model alignment

No dispatch, provider selection, fallback/reselection, write/apply, hard-chat/noReply, or Guard authority changes are granted by this plan.
