# Lane Heartbeat and Stall Projection Conformance Note (2026-05-24)

## Scope

This note records the local conformance evidence for the FlowDesk lane heartbeat
and stall projection slice introduced on 2026-05-24. It covers FlowDesk-owned
lanes only (reviewer lanes, runtime lane launches, provider acquisition lanes,
managed-dispatch attempts, fallback regate plans). It does not claim coverage of
arbitrary OpenCode user-driven tool calls or any work that FlowDesk did not
launch.

## Contracts

1. `flowdesk.lane_heartbeat.v1` evidence class
   - Path: `.flowdesk/sessions/<workflow_id>/evidence/lane-heartbeat/<heartbeat_id>.json`
   - States: `created`, `running`, `awaiting_dependency`, `cooldown`
   - Required fields: `heartbeat_id`, `workflow_id`, `attempt_id`, `lane_id`,
     `heartbeat_seq`, `state`, `observed_at`, `expected_next_heartbeat_at`,
     `parent_session_ref`, `agent_ref`, `provider_qualified_model_id`
   - Optional fields: `progress_ref`, `progress_summary_label`
   - Authority flags must be false (`dispatch_authority_enabled`, `providerCall`,
     `actualLaneLaunch`, `runtimeExecution`)
   - Validator rejects unknown properties, raw payload markers, authority
     smuggling, and `expected_next_heartbeat_at <= observed_at`

2. `projectFlowDeskLaneStallV1`
   - Inputs: reloaded session evidence result, workflow id, observed-at,
     optional late/stall thresholds
   - Picks latest lifecycle or heartbeat record per lane id (heartbeat counts
     as `lane_heartbeat` signal source)
   - Classifies each lane as `progressing_normal` (<=2 minutes since last
     signal), `progressing_late` (2-5 minutes), `stalled` (>5 minutes while
     still in `created`/`running`/`awaiting_dependency`/`cooldown`),
     `terminal` (any terminal lifecycle state), or `unknown`
   - Late threshold clamps to a minimum of 10 seconds, stall threshold is
     always at least 1 second above the late threshold
   - Stalled lanes get the bounded safe action allowlist
     `/flowdesk-status`, `/flowdesk-retry`, `/flowdesk-resume`,
     `/flowdesk-abort`, `/flowdesk-doctor`, `/flowdesk-export-debug`

## Plugin Surfaces

1. `flowdesk_status_live`
   - Now returns per-workflow `laneStallProjection`, `worstLaneStallClassification`,
     `stalledLaneCount`, `progressingLateLaneCount`
   - Returns top-level `worstLaneStallClassification`, `totalStalledLaneCount`,
     `totalProgressingLateLaneCount`
   - Authority flags unchanged: `realOpenCodeDispatch=false`, `providerCall=false`,
     `runtimeExecution=false`, `actualLaneLaunch=false`, `fallbackAuthority=false`,
     `hardCancelOrNoReplyAuthority=false`

2. `flowdesk_lane_heartbeat_record`
   - Registers only when `laneHeartbeatWriter.enabled=true` and a durable state
     root resolves (explicit `laneHeartbeatWriter.rootDir` or top-level
     `durableStateRoot`)
   - Auto-increments `heartbeat_seq` per lane id from the latest persisted
     heartbeat
   - Authority flags always false; `laneHeartbeatPersisted=true` becomes the
     only diagnostic flag on success

3. `chat.message` stall alert card
   - Enabled when both `statusLive.enabled=true` and
     `chatMessageStallAlert.enabled=true` (or any explicit
     `chatMessageStallAlert` record) are set with a resolvable durable state root
   - Appends a redacted FlowDesk card listing the count of stalled and
     progressing-late lanes, the workflow id, last-signal age, and the safe
     next actions
   - The card explicitly states `FlowDesk does not auto-retry, auto-abort, or
     auto-fallback on stall.`
   - Duplicate suppression key includes session ref plus per-workflow stalled
     lane counts so spammy duplicate cards are dropped within the existing
     duplicate suppression window

4. Runtime reviewer execution bridge
   - Now writes a single `lane_heartbeat` record per reviewer lane right after
     `lane_launch_started` and before observing the typed reviewer verdict
   - Heartbeat write failures are diagnostic and do not block lane execution

## Test Coverage

- Core unit tests: `lane-heartbeat.test.ts` (4 tests), `lane-stall-projection.test.ts`
  (7 tests) covering builder defaults, threshold clamping, validator
  rejection, session evidence reload, and heartbeat-as-signal projection.
- Plugin tests: `status live tool exposes a lane heartbeat stall projection`,
  `status live tool description mentions lane heartbeat stall projection
  vocabulary`, `lane heartbeat writer tool is absent by default and registers
  only with explicit opt-in plus a durable state root`,
  `chat.message stall alert card appends safe next actions when stalled lanes
  exist`.
- Chat routing test: `chat routing classifies stalled lane intents to portable
  status command` covers Korean and English stall phrases.
- Full test suite: 510/510 passing.

## Active Profile Live Smoke

1. Heartbeat writer + status live cross-tool integration on
   `~/.config/opencode` profile with local tarballs:
   - First heartbeat returned `heartbeatSeq=1`, second `heartbeatSeq=2`
   - Status live projection reported `progressing_normal`,
     `secondsSinceLastSignal=0`, `lastSignalSource=lane_heartbeat`,
     `lastHeartbeatSeq=2`, `totalStalledLaneCount=0`, authority all false
2. `chat.message` stall alert on `~/.config/opencode` profile with the same
   tarballs:
   - Seeded a lane lifecycle 11 minutes old
   - General chat message produced a second FlowDesk text part with
     `Stalled lanes detected: 1 stalled, 0 progressing-late`, the workflow id,
     `last signal ~11m ago, no recent heartbeat`, the
     "FlowDesk does not auto-retry, auto-abort, or auto-fallback on stall"
     line, and the full safe next action allowlist; no `noReply`, `cancel`, or
     `stop` markers in the serialized output

## Authority Boundary

No new dispatch, fallback, runtime, lane launch, or hard chat authority is
introduced by this slice. All new fields and tools either preserve the existing
`false` authority flags or expose new diagnostic-only flags (`statusEvidenceObserved`,
`laneHeartbeatPersisted`).
