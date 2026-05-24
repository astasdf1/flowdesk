# Lane Stall Projection Follow-Up Conformance Note (2026-05-24)

## Scope

This note records the local conformance evidence for the follow-up slices that
landed on top of `2026-05-24-lane-stall-projection.md`:

1. Chat-routing recognition of heartbeat and progress-signal phrases.
2. `flowdesk_lane_heartbeat_record` description strengthened to advertise the
   same natural-language triggers.
3. `flowdesk_pre_spike_doctor.naturalLanguageTools` now exposes the stall
   projection and chat stall alert configuration.
4. `chat.message` stall card duplicate suppression now re-alerts the user as
   stall age grows, and gained an optional `Late-progressing lanes detected:`
   card behind `chatMessageStallAlert.includeProgressingLate=true`.
5. `lane-stall-projection.ts` per-lane entries now carry
   `expectedNextHeartbeatOverdue` plus `secondsPastExpectedNextHeartbeat`
   diagnostic hints from the heartbeat record's own
   `expected_next_heartbeat_at` interval.

Coverage stays bounded to FlowDesk-owned lanes (reviewer lanes, runtime lane
launches, provider acquisition lanes, managed-dispatch attempts, fallback
regate plans). No claim is made about arbitrary OpenCode user-driven tool
calls.

## Contract Changes

### Chat routing

`packages/core/src/chat-routing.ts` portable command route for
`/flowdesk-status` now also matches the following heartbeat and progress
signal phrases:

1. Korean: `하트비트`, `심박`, `심장박동`, `진행 신호`, `진행 표시`,
   `레인 상태`, `레인 진행`, `살아 있`, `최근 heartbeat`, `마지막 heartbeat`.
2. English: `heartbeat status`, `heartbeat check`, `recent heartbeat`,
   `lane heartbeat`, `last heartbeat`, plus the existing stall vocabulary
   (`is it stuck`, `seems stuck`, `stalled`, `no log`, `no update`,
   `no response`, `frozen`, `hung`, `hanging`, `silent`).

The new core test `chat routing classifies lane heartbeat and progress signal
intents to portable status command` asserts that each phrase routes to
`{ safe_next_actions: ["/flowdesk-status"], classification: "fast_chat",
route_decision: "use_command_fallback" }` and that the response validator
accepts the resulting `flowdesk.chat_intake.response.v1`.

### Heartbeat writer description

The `flowdesk_lane_heartbeat_record` tool description was strengthened to:

1. Add the Korean and English natural-language trigger lists for heartbeat
   intents (`하트비트 남겨줘`, `심박 남겨줘`, `진행 신호 남겨줘`,
   `record heartbeat`, `emit heartbeat`, `mark progress`, ...).
2. Restate the 2-minute soft heartbeat interval and 5-minute stall threshold.
3. Tell the assistant not to ask for per-call confirmation because the plugin
   user already opted in at configuration time.
4. Remind the assistant never to echo raw prompts, transcripts, provider
   payloads, runtime echo, or other forbidden raw markers.

### Doctor surface

`flowdesk_pre_spike_doctor.naturalLanguageTools` was extended:

1. `statusLive` now reports `exposesLaneStallProjection`, the configured
   `laneHeartbeatLateThresholdMs`/`laneHeartbeatStallThresholdMs`, and a new
   `exposesExpectedNextHeartbeatOverdueHint=true` once the durable state root
   resolves.
2. A new `chatMessageStallAlert` block reports `enabled`, `registered`, the
   required `statusLive.enabled=true and durableStateRoot (top-level or
   chatMessageStallAlert.rootDir)` condition, and an explicit
   `no auto-retry, auto-abort, or auto-fallback` note.

### Chat stall card duplicate suppression and progressing-late opt-in

`packages/opencode-plugin/src/server.ts` `stallAlertDuplicateKey` now mixes
`workflowId:stalledLaneCount:Math.floor(secondsSinceLastSignal/60)` per
workflow plus `worst:<classification>` into the dedup key, so a single
session keeps getting fresh stall cards as the stall age climbs while
identical card content within the dedup window is still suppressed.

`FlowDeskChatMessageStallAlertOptionsV1.includeProgressingLate?: boolean`
defaults to false. When true and worst classification is `progressing_late`,
the chat.message hook also appends a softer card titled
`Late-progressing lanes detected: ... late, ... stalled.` with the same
explicit `FlowDesk does not auto-retry, auto-abort, or auto-fallback on
stall.` line and the safe next action allowlist
(`/flowdesk-status`, `/flowdesk-retry`, `/flowdesk-resume`,
`/flowdesk-abort`, `/flowdesk-doctor`, `/flowdesk-export-debug`).

A new plugin test `chat.message stall alert surfaces progressing-late lanes
only when includeProgressingLate is opted in` seeds a 3-minute-idle lane,
verifies the default chat hook leaves the message untouched, then verifies
the opt-in hook appends the expected card with the workflow id,
`1 progressing-late`, and the safe next action allowlist with no
`noReply`/`cancel`/`stop` markers.

### Heartbeat expected-next overdue hint

`packages/core/src/lane-stall-projection.ts` per-lane entries now optionally
carry `expectedNextHeartbeatOverdue: boolean` and
`secondsPastExpectedNextHeartbeat: number` when the projection's
`observedAt` has crossed the heartbeat record's own
`expected_next_heartbeat_at`. The classification itself still comes from the
configurable `lateThresholdMs`/`stallThresholdMs` policy (default 2m/5m), so
the hint is diagnostic only: a lane that emitted a heartbeat with a 30-second
expected interval but is only 90 seconds old still classifies as
`progressing_normal` while reporting `expectedNextHeartbeatOverdue=true`.

The new core test `stall projection flags expected_next_heartbeat_at as
overdue when observed_at passes it` asserts both fields and confirms the
classification stays `progressing_normal`.

## Active OpenCode Profile Live Evidence

1. Doctor live verify after repacking `@flowdesk/core@0.1.0` and
   `@flowdesk/opencode-plugin@0.1.1` and force-reinstalling into
   `~/.config/opencode`:
   - `flowdesk_pre_spike_doctor.execute({})` returned
     `naturalLanguageTools.statusLive.exposesLaneStallProjection=true`,
     `naturalLanguageTools.statusLive.exposesExpectedNextHeartbeatOverdueHint=true`,
     `naturalLanguageTools.laneHeartbeatWriter.registered=true`, and
     `naturalLanguageTools.chatMessageStallAlert.registered=true` with the
     expected `requires` and `note` fields.
   - `hasChatMessage` was `true`.

2. Chat.message progressing-late card live smoke (active profile, fresh
   temp durable root, `chatMessageStallAlert.includeProgressingLate=true`):
   - Seeded one 3-minute-idle `lane_lifecycle` record.
   - General chat message produced a second FlowDesk text part with
     `Late-progressing lanes detected: 1 late, 0 stalled.`, the workflow id,
     `1 progressing-late (last signal ~3m ago, no recent heartbeat)`, the
     explicit `FlowDesk does not auto-retry, auto-abort, or auto-fallback on
     stall.` line, and the full safe next action allowlist; the serialized
     output contained no `noReply`, `cancel`, or `stop` markers.

3. Expected-next overdue hint live smoke (active profile, fresh temp durable
   root, `statusLive.enabled=true`):
   - Wrote one `lane_heartbeat` record with `expectedIntervalMs=30000` and
     `observedAt = now - 90 seconds`.
   - `flowdesk_status_live.execute({ workflowId })` returned
     `classification=progressing_normal`,
     `lastSignalSource=lane_heartbeat`,
     `lastHeartbeatSeq=1`,
     `secondsSinceLastSignal=90`,
     `expectedNextHeartbeatOverdue=true`,
     `secondsPastExpectedNextHeartbeat=60`,
     `safeNextActions=["/flowdesk-status"]`,
     `worstLaneStallClassification=progressing_normal`,
     and `authority.statusEvidenceObserved=true` with every other authority
     flag set to false.

## Authority Boundary

No new dispatch, fallback, runtime, lane launch, or hard chat authority is
introduced by any of the follow-up slices. All new fields and tools either
preserve the existing `false` authority flags or expose diagnostic-only
indicators (`statusEvidenceObserved`, `laneHeartbeatPersisted`,
`expectedNextHeartbeatOverdue`,
`exposesLaneStallProjection`,
`exposesExpectedNextHeartbeatOverdueHint`).
