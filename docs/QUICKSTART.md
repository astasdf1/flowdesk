# FlowDesk for opencode Quickstart

This quickstart is for ordinary users. Implementer-oriented context is available in `START_HERE.md` and `FLOWDESK_OPENCODE_PLUGIN_IMPLEMENTATION_SPEC.md`.

## What FlowDesk Does in Release 1

FlowDesk routes accepted chat requests into guarded command-backed workflows. It can create delegated authoring records and lane summaries, dry-run, run deterministic fake-runtime checks, show status, recover from checkpoints, retry safely, request abort, refresh usage readiness, diagnose provider health, and export redacted diagnostics.

The main agent should not write large workflow plans directly. It should route the request and show compact typed summaries. Actual OpenCode subtask/model/provider lane launch is not Release 1 behavior unless a later conformance and real-dispatch gate explicitly enables it; otherwise FlowDesk uses delegated records, fake lane summaries, and command-backed fallback summaries.

FlowDesk does not run real OpenCode dispatch in Release 1. It does not claim automatic provider/model fallback, hard chat cancellation, hard no-reply control, trusted real-provider runtime echo, community telemetry upload, or score-based approval.

## Happy Path

If FlowDesk has not been implemented or installed for your pinned OpenCode version yet, this quickstart describes the intended Release 1 experience rather than runnable commands.

1. Install FlowDesk with a pinned OpenCode-compatible installer or development profile.
2. Run `/flowdesk-doctor`.
3. Ask in chat: `Use FlowDesk to plan this task and show me the guarded steps.`
4. Review the plan, lane summaries, and any required approval.
5. Continue with `/flowdesk-run` when FlowDesk presents it as the guarded command-backed dry-run or fake-runtime step.
6. Check `/flowdesk-status` for workflow state and subagent lane status.
7. Follow any suggested recovery command.

During install, FlowDesk should create a timestamped backup and a redacted bootstrap report before changing the selected OpenCode profile. If install fails, use the installer’s rollback guidance or run `/flowdesk-doctor` and `/flowdesk-export-debug`; do not manually paste raw OpenCode config, credentials, provider auth entries, or profile contents into FlowDesk.

## Command Fallback

Use these commands when chat routing is unavailable or FlowDesk asks you to recover manually:

```text
/flowdesk-doctor
/flowdesk-plan
/flowdesk-run
/flowdesk-status
/flowdesk-resume
/flowdesk-retry
/flowdesk-abort
/flowdesk-usage
/flowdesk-export-debug
```

`/flowdesk-abort` is best-effort unless a future conformance artifact proves hard cancellation. It records the request, prevents further Release 1 execution where possible, and tells you the safest next action.

## Provider or Model Unavailable

If Claude, a provider API, or a selected model is unavailable, run:

```text
/flowdesk-status
/flowdesk-usage
/flowdesk-doctor
```

FlowDesk shows usage readiness separately from provider health. In Release 1, an outage can produce a warning, block, degraded status, fake-runtime result, or safe retry guidance. It does not automatically switch providers or models. Fix provider auth or OpenCode model configuration outside FlowDesk, wait for rate limits or outages to clear, then rerun the suggested command.

OpenCode Go and z.ai are covered by the same diagnostic-only behavior. If FlowDesk cannot prove fresh quota or account-specific availability from an official machine-readable source, it reports unknown usage instead of guessing or scraping provider console pages.

If FlowDesk later references OpenUsage-style usage data, treat it as source-labeled evidence. Local observed history can explain this machine's activity, but it is not proof of account-wide remaining quota.

## Inspecting Subagent Lanes

When OpenCode exposes a safe status or reference surface, FlowDesk may show task-like lane cards or openable markdown/file references for delegated planning, refinement, review, and verification lanes. Each summary should show a lane id, task reference, state, timestamps, event or debug references, failure class if any, and a safe next action.

If OpenCode does not prove clickable or openable references for your version, use `/flowdesk-status` and `/flowdesk-export-debug`. Release 1 may show redacted summaries and opaque references instead of raw logs. It does not promise a native clickable task pane unless a later conformance artifact proves one. Raw prompts, transcripts, tool payloads, stack traces, and raw file contents must stay out of status and debug output.

`opencode run` is not a FlowDesk quickstart command. Implementers may use it for provider smoke tests or diagnostics, but it is not FlowDesk's delegated-lane, review fan-out, or normal execution path.
