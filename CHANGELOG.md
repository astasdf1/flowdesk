# FlowDesk Changelog

All notable changes to `@flowdesk/core` and `@flowdesk/opencode-plugin` are
recorded here. The two packages version together inside this monorepo so a
single entry per release date covers both unless otherwise noted.

The format is loosely based on Keep a Changelog. Authority flags
(`realOpenCodeDispatch`, `providerCall`, `runtimeExecution`,
`actualLaneLaunch`, `fallbackAuthority`, `hardCancelOrNoReplyAuthority`)
remain `false` by default across every release listed here unless an entry
explicitly says otherwise.

## 0.1.10 — 2026-05-25

### Added

- `/flowdesk-export-debug` debug section files now carry per-section
  redacted `summary_labels` derived from current adapter state. `doctor`,
  `conformance`, `workflow_state`, `audit_refs`, `usage_summary`,
  `policy_summary`, and `redaction_summary` each produce a small bounded
  set of labels (e.g. `disabled_modes:`, `config_hash:`, `release_mode:`,
  `redaction_version:`) that stay redacted-only and do not echo raw
  paths, payloads, transcripts, or credentials.
- `flowdesk_pre_spike_doctor.naturalLanguageTools.exportDebug` now lists
  the supported debug sections, the manifest path, and the section file
  path template so users can discover the new persisted layout from the
  doctor tool.

### Authority Boundary

`realOpenCodeDispatch`, `providerCall`, `runtimeExecution`,
`actualLaneLaunch`, `fallbackAuthority`, `hardCancelOrNoReplyAuthority`,
and `toolAuthority` remain `false`. Section labels and doctor surface
expose redacted metadata only.

## 0.1.9 — 2026-05-25

### Added

- Reviewer assignment and fan-out planning now prefer distinct concrete
  provider-qualified models before repeating a model, lower
  `max_concurrent_lane_count` to the number of distinct concrete models in the
  ready plan, and carry `same_model_stagger_ms` (default 3000) plus a
  `lane_launch_schedule` with per-lane `launch_delay_ms` when the same model
  must be reused. The new fields are scheduling metadata only.
- Release 1 Policy Pack disk loading/merge. The local non-dispatch adapter
  now loads `.flowdesk/config.json` plus configured `policyPackPaths`,
  validates schema, rejects missing/unsafe/invalid/hash-drift packs, merges
  loaded packs into the effective policy, and threads the policy context
  into Guard, local permissions, workflow records, doctor/project-config
  status, and non-dispatch command-backed runs.
- `flowdesk_export_debug` materializes one redacted JSON file per included
  section under `.flowdesk/sessions/<sid>/redacted-debug/sections/<section>.json`
  alongside the existing manifest. The new `flowdesk.debug_section_file.v1`
  contract carries export_id, section, redaction status, warning count,
  excluded categories, source refs, summary labels, and audit refs. The
  manifest now reports real `file_count` and `byte_count` derived from the
  persisted section files, and each `included_sections[].ref` points at the
  section file ref.

### Authority Boundary

`realOpenCodeDispatch`, `providerCall`, `runtimeExecution`,
`actualLaneLaunch`, `fallbackAuthority`, `hardCancelOrNoReplyAuthority`,
and `toolAuthority` remain `false`. Reviewer scheduling metadata,
Policy Pack disk loading, and debug section file materialization are
redacted non-dispatch state writes only and cannot promote later-gate
authority.

## 0.1.8 — 2026-05-25

### Added

- `/flowdesk-export-debug` now materializes a validated
  `flowdesk.debug_export_manifest.v1` through the local non-dispatch adapter
  when durable state is configured.
- Regression coverage asserts the durable manifest contains only redacted
  section labels/refs/counts/retention state and no raw logs, payload markers,
  credentials, transcripts, or filesystem paths.

### Authority Boundary

`realOpenCodeDispatch`, `providerCall`, `runtimeExecution`,
`actualLaneLaunch`, `fallbackAuthority`, `hardCancelOrNoReplyAuthority`,
and `toolAuthority` remain `false`. Debug export materialization is a
redacted non-dispatch state write only.

## 0.1.7 — 2026-05-25

### Added

- Opt-in project config loading for `.flowdesk/config.json` via the plugin
  `projectConfig` option. Loaded configs are validated with the existing
  `flowdesk.project_config.v1` contract before they affect chat steering.
- `flowdesk_pre_spike_doctor` now reports redacted project config load status
  (`loaded`, `missing`, `blocked`, or `disabled`) without exposing raw config
  values or filesystem paths.

### Changed

- When project config loading is enabled, natural-language routing fails
  closed if the config is missing, unreadable, malformed, invalid, or disables
  chat steering through `chat_intake_mode` / `hook_harness_mode`.

### Authority Boundary

`realOpenCodeDispatch`, `providerCall`, `runtimeExecution`,
`actualLaneLaunch`, `fallbackAuthority`, `hardCancelOrNoReplyAuthority`,
and `toolAuthority` remain `false`. Config loading can only constrain
Release 1 steering; it cannot promote later-gate authority.

## 0.1.6 — 2026-05-25

### Added

- Durable non-confirmation chat suggestion de-duplication when
  `durableStateRoot` is configured. FlowDesk now writes a short-lived,
  redacted `flowdesk.chat_suggestion_preference.v1` UX record so repeated
  plan/status/usage suggestion cards remain suppressed across plugin
  restarts.
- Documentation now distinguishes these records from audit, workflow,
  approval, or dispatch evidence and states their redaction/expiry boundary.

### Authority Boundary

`realOpenCodeDispatch`, `providerCall`, `runtimeExecution`,
`actualLaneLaunch`, `fallbackAuthority`, `hardCancelOrNoReplyAuthority`,
and `toolAuthority` remain `false`. Preference persistence is best-effort UX
dedupe only and degrades to in-memory suppression on read/write failure.

## 0.1.5 — 2026-05-25

### Added

- Plan-backed continuous-work natural-language routing for explicit phrases
  such as `계획 전체 진행`, `막히기전까지 계속 진행`, `전체 설계문서 기반으로 진행`,
  `continue until blocked`, and `work through the whole plan`.
- Continuous work now requires existing planning/design evidence for the
  workflow or session before FlowDesk suggests `/flowdesk-resume`. Without
  evidence, chat intake asks for clarification/status and does not auto-create
  a plan or route to `/flowdesk-run`.
- User-facing and normative docs now describe the bounded continuous-work
  semantics and stop conditions.

### Authority Boundary

`realOpenCodeDispatch`, `providerCall`, `runtimeExecution`,
`actualLaneLaunch`, `fallbackAuthority`, `hardCancelOrNoReplyAuthority`,
and `toolAuthority` remain `false`. Continuous-work routing is command-backed
steering only and stays bounded to existing plan/design evidence.

## 0.1.4 — 2026-05-24

### Added

- New `@flowdesk/core` validator `validateFlowDeskPreDispatchAuditRecordV1`
  in `packages/core/src/pre-dispatch-audit-record.ts` for the
  `flowdesk.pre_dispatch_audit_record.v1` schema. The session-evidence
  reload dispatch now runs it for every persisted `pre_dispatch_audit`
  entry instead of falling through to the generic redaction check.
- New `@flowdesk/core` shape-only validators in
  `packages/core/src/managed-dispatch-evidence-shape.ts` for
  `flowdesk.managed_dispatch_beta.usage_authority_evidence.v1`,
  `flowdesk.managed_dispatch_beta.runtime_echo_evidence.v1`, and
  `flowdesk.managed_dispatch_beta.telemetry_correlation.v1`. They enforce
  the schema_version and the redacted-raw-payload boundary at reload time
  without requiring the cross-validation context that the full Release 2
  validators need. Session-evidence reload now dispatches to these shape
  checks for `usage_authority`, `runtime_echo`, and
  `telemetry_correlation` durable evidence.

### Authority Boundary

`realOpenCodeDispatch`, `providerCall`, `runtimeExecution`,
`actualLaneLaunch`, `fallbackAuthority`, `hardCancelOrNoReplyAuthority`,
and `toolAuthority` remain `false`. The four new validators only
tighten fail-closed checks at reload time.

## 0.1.3 — 2026-05-24

### Added

- Workspace-root `LICENSE` (MIT) plus per-package `LICENSE` files and
  per-package `README.md` so the published tarballs ship complete OSS
  documentation.
- `flowdesk_pre_spike_doctor.naturalLanguageTools.statusLive.exposesExpectedNextHeartbeatOverdueHint`
  diagnostic exposure.
- `flowdesk.lane_heartbeat.v1` evidence class is now wired into
  `validateEvidenceShape`, alongside new dispatch coverage for
  `configured_verification`, `sanitized_auth_capture`,
  `external_auth_provider_policy`, and `production_approval` evidence
  classes. Each previously fell through to a generic schema/redaction
  check; they now run their dedicated fail-closed validators on every
  durable reload.
- New session-evidence reload test asserts that good and forged shapes for
  the four newly-wired classes are accepted or blocked as expected.

### Changed

- `engines.node` is now declared per-package (`>=20.11.0`) so external
  consumers installing only one of the two packages still get correct
  Node engine warnings.
- `@opencode-ai/plugin` moved from `dependencies` to `peerDependencies`
  on `@flowdesk/opencode-plugin` (peer range `>=1.14.40 <2`) so the host
  OpenCode runtime decides the exact plugin API version. A workspace
  devDependency keeps local development working.
- `homepage`, `bugs`, and `files` (README/LICENSE) added to both package
  manifests.
- Root `README.md` updated to point the OpenCode plugin entry at the
  `/server` subpath and to install `^0.1.2` (now `^0.1.3`).
- Per-package READMEs document the natural-language tools, opt-in config,
  and authority boundary.

### Authority Boundary

`realOpenCodeDispatch`, `providerCall`, `runtimeExecution`,
`actualLaneLaunch`, `fallbackAuthority`, `hardCancelOrNoReplyAuthority`,
and `toolAuthority` remain `false`. Hardening only tightens fail-closed
checks; no authority was promoted.

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
