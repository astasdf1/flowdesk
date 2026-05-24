# FlowDesk Changelog

All notable changes to `@flowdesk/core` and `@flowdesk/opencode-plugin` are
recorded here. The two packages version together inside this monorepo so a
single entry per release date covers both unless otherwise noted.

The format is loosely based on Keep a Changelog. Authority flags
(`realOpenCodeDispatch`, `providerCall`, `runtimeExecution`,
`actualLaneLaunch`, `fallbackAuthority`, `hardCancelOrNoReplyAuthority`)
remain `false` by default across every release listed here unless an entry
explicitly says otherwise.

## 0.1.2 — 2026-05-24

### Added

- Lane heartbeat and stall projection contract: implementation spec section
  `6.7a Lane Heartbeat and Stall Detection Contract`, IMPLEMENTATION_ROADMAP
  Phase 1 entry 14, and USER_MANUAL stall + heartbeat copy.
- `@flowdesk/core` exports `projectFlowDeskLaneStallV1` and the
  `flowdesk.lane_stall_projection.v1` shape; entries carry
  `classification`, `lastSignalSource`, `lastHeartbeatSeq`,
  `expectedNextHeartbeatAt`, `expectedNextHeartbeatOverdue`,
  `secondsPastExpectedNextHeartbeat`, and a bounded `safeNextActions`
  allowlist (`/flowdesk-status`, `/flowdesk-retry`, `/flowdesk-resume`,
  `/flowdesk-abort`, `/flowdesk-doctor`, `/flowdesk-export-debug`).
- `@flowdesk/core` adds `flowdesk.lane_heartbeat.v1` evidence class, the
  `buildFlowDeskLaneHeartbeatRecordV1` helper, and a validator that rejects
  unknown properties, raw payload markers, authority smuggling, and
  `expected_next_heartbeat_at <= observed_at`.
- `@flowdesk/opencode-plugin` adds `flowdesk_lane_heartbeat_record` opt-in
  tool, `flowdesk_status_live` lane stall projection output, the runtime
  reviewer execution bridge launch-time heartbeat, and a passive
  `chat.message` stall alert card with the explicit
  `FlowDesk does not auto-retry, auto-abort, or auto-fallback on stall.`
  copy. The card supports `chatMessageStallAlert.includeProgressingLate`
  for the softer `Late-progressing lanes detected:` variant and re-alerts
  the user as stall age grows through a dedup key bucketed by minute.
- `flowdesk_pre_spike_doctor.naturalLanguageTools` now reports the
  heartbeat writer registration, `statusLive.exposesLaneStallProjection`,
  `statusLive.exposesExpectedNextHeartbeatOverdueHint`, and a
  `chatMessageStallAlert` block with the required preconditions and an
  explicit `no auto-retry, auto-abort, or auto-fallback` note.
- Natural-language entry points expanded to five description-driven LLM
  tools across Korean and English (`flowdesk_quick_reviewer_run`,
  `flowdesk_provider_usage_live`, `flowdesk_status_live`,
  `flowdesk_quick_fallback_run`, `flowdesk_lane_heartbeat_record`).
- `proactiveUsagePreflightPattern` chat-routing now places
  `/flowdesk-usage` before `/flowdesk-plan` and `/flowdesk-status` when the
  request reads as a larger planning, review, or refactor task.
- Heartbeat and progress-signal phrases (Korean `하트비트`, `심박`,
  `심장박동`, `진행 신호`, `레인 상태`, `살아 있`, `최근 heartbeat`,
  `마지막 heartbeat`; English `heartbeat status`, `recent heartbeat`,
  `lane heartbeat`) are routed to `/flowdesk-status`.
- New conformance notes: `docs/conformance/2026-05-24-lane-stall-projection.md`
  and `docs/conformance/2026-05-24-lane-stall-projection-followups.md`
  record local + active OpenCode profile live evidence.

### Changed

- `flowdesk_quick_reviewer_run` description now states that each reviewer
  lane automatically records one launch-time heartbeat through the runtime
  reviewer execution bridge.
- `flowdesk_status_live` description now mentions the
  `expectedNextHeartbeatOverdue` and `secondsPastExpectedNextHeartbeat`
  diagnostic hints and the bounded safe action allowlist for stalled
  lanes.
- `docs/USAGE_NATURAL_LANGUAGE.md` covers all five live tools, the
  chat.message stall card, and the new heartbeat diagnostic hints; the
  example active OpenCode profile JSON is updated accordingly.
- `docs/USER_MANUAL.md` adds the Natural-Language Tools and Stalled Lane
  Alerts sections.
- `docs/QUICKSTART.md` introduces the five natural-language tools and the
  stall alert card.
- Gemini Code Assist collector now reuses the cached `access_token` in
  `~/.gemini/oauth_creds.json` and falls closed with sanitized reasons
  when the cached token is expired and no client id/secret is available.
- Claude macOS keychain auto-detection now works zero-config by injecting
  an `execFile` capability from the plugin layer; the core
  `provider-usage-collector` keeps its Checkpoint 4 `child_process` ban.

### Authority Boundary

`realOpenCodeDispatch`, `providerCall`, `runtimeExecution`,
`actualLaneLaunch`, `fallbackAuthority`,
`hardCancelOrNoReplyAuthority`, and `toolAuthority` remain `false`. Only
diagnostic flags (`providerUsageAcquired`, `statusEvidenceObserved`,
`exactModelProviderAcquisitionRecorded`, `regatePlanPrepared`,
`laneHeartbeatPersisted`, `expectedNextHeartbeatOverdue`) can become
`true` to indicate that real data was read or written.

## 0.1.1 — 2026-05-21

### Added

- Active OpenCode profile migration to nested `@opencode-ai/plugin@1.15.6`
  and `@opencode-ai/sdk@1.15.6`.
- Doctor + status + usage + plan + run + export-debug command-backed
  handlers verified against local OpenCode 1.14.50 and 1.15.x lines.
- FDS-1 runtime-closed fixture and schema probe evidence under the updated
  package line.

### Changed

- Bootstrap installer adds durable confirmation ledger under
  `.flowdesk/bootstrap/confirmations/<confirmationRef>.json` with one-shot
  consumption, exact typed phrase binding, and command-file rollback on
  durable artifact or ledger failure.

## 0.1.0 — 2026-05-20

### Added

- Initial public publication of `@flowdesk/core` and
  `@flowdesk/opencode-plugin` on the npm public registry.
- Release 1 minimum command surface: `/flowdesk-doctor`, `/flowdesk-plan`,
  `/flowdesk-run`, `/flowdesk-status`, `/flowdesk-resume`,
  `/flowdesk-retry`, `/flowdesk-abort`, `/flowdesk-usage`,
  `/flowdesk-export-debug`.
- Local non-dispatch command-backed handlers, default-on natural-language
  chat steering with visible FlowDesk cards, durable session evidence
  writer with batch-level prevalidation, and `.flowdesk` redacted state
  materialization.
- Bootstrap installer library and `flowdesk-install-release1` CLI.
