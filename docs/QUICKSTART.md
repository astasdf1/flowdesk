# FlowDesk for opencode Quickstart

This quickstart is for ordinary users. Implementer-oriented context is available in `START_HERE.md` and `FLOWDESK_OPENCODE_PLUGIN_IMPLEMENTATION_SPEC.md`.

## What FlowDesk Does in Release 1

FlowDesk routes accepted chat requests into guarded command-backed workflows. It can create delegated authoring records and lane summaries, dry-run, run deterministic fake-runtime checks, show status, recover from checkpoints, retry safely, request abort, refresh usage readiness, diagnose provider health, and export redacted diagnostics.

The main agent should not write large workflow plans directly. It should route the request and show compact typed summaries. Actual OpenCode subtask/model/provider lane launch is not Release 1 behavior unless a later conformance and real-dispatch gate explicitly enables it; otherwise FlowDesk uses delegated records, fake lane summaries, and command-backed fallback summaries.

FlowDesk does not run real OpenCode dispatch in Release 1. It does not claim automatic provider/model fallback, hard chat cancellation, hard no-reply control, trusted real-provider runtime echo, community telemetry upload, or score-based approval.

## Happy Path

Install the published Release 1 packages, then use the `flowdesk-install-release1` bootstrap CLI from `@flowdesk/opencode-plugin`:

```text
npm install @flowdesk/core@0.1.8 @flowdesk/opencode-plugin@0.1.8
```

If you are testing a reviewed local build, record the local package provenance separately and keep the same Release 1 safety boundary.

1. Install the published packages shown above or a reviewed local build.
2. Preview bootstrap installation without writing files:

   ```text
   flowdesk-install-release1 --profile-root <opencode-profile-dir> --durable-root <flowdesk-state-dir> --target-profile <profile-ref> --confirmation <confirmation-ref> --expires-at <iso-time>
   ```

3. Copy the exact approval phrase printed by the preview.
4. Re-run the same command with `--approve "<exact phrase>"`.
5. Run `/flowdesk-doctor`.
6. Ask in chat: `Use FlowDesk to plan this task and show me the guarded steps.`
7. Review the plan, lane summaries, and any required approval.
8. Continue with `/flowdesk-run` when FlowDesk presents it as the guarded command-backed dry-run or fake-runtime step.
9. Check `/flowdesk-status` for workflow state and subagent lane status.
10. Follow any suggested recovery command.

During install, FlowDesk creates a timestamped backup, portable `/flowdesk-*` command files, a redacted bootstrap report, and a doctor handoff before changing the selected OpenCode profile. The preview path writes nothing. If install fails, use the installer’s rollback guidance or run `/flowdesk-doctor` and `/flowdesk-export-debug`; do not manually paste raw OpenCode config, credentials, provider auth entries, or profile contents into FlowDesk.

Bootstrap does not launch lanes, call providers, enable real dispatch, switch providers/models, or grant hard chat cancellation/no-reply authority. Release 1 production registration is limited to non-dispatch command-backed handlers.

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

## Natural-Language Tools

Once the FlowDesk plugin is loaded in the active OpenCode profile, the assistant LLM picks up five description-driven natural-language tools without you typing portable commands:

1. `flowdesk_quick_reviewer_run` — say things like `다관점 리뷰 해줘` or `multi-perspective review` to get a 3-perspective FlowDesk reviewer fan-out.
2. `flowdesk_provider_usage_live` — say `사용량 보여줘` or `how much usage do I have left` to get live Claude/OpenAI/Gemini availability with `alertLevel` and `recommendation`.
3. `flowdesk_status_live` — say `어디까지 했어`, `상태`, `is anything stuck`, or `lane heartbeat status` to read durable session evidence and the lane heartbeat stall projection.
4. `flowdesk_quick_fallback_run` — say `Claude 막혔어 OpenAI 로 다시` or `fallback to openai/gpt-5.5` to plan a fresh full re-gate; the actual provider switch is still blocked behind managed-dispatch promotion.
5. `flowdesk_lane_heartbeat_record` — say `하트비트 남겨줘` or `record a heartbeat for the lane` to persist one durable `lane_heartbeat` evidence record per FlowDesk-owned lane.

None of these promote default real dispatch, automatic fallback, or hard chat cancellation authority. `flowdesk_quick_reviewer_run` is the explicit opt-in provider-calling exception when `quickReviewerRun.enabled=true` plus the tool's provider-call flags are present; the other tools only read or write redacted diagnostic/planning evidence.

## Stalled Lane Alerts in Chat

If you also enable `statusLive.enabled=true` and `chatMessageStallAlert.enabled=true` with a `durableStateRoot`, FlowDesk passively appends a redacted stall card to your chat whenever durable session evidence shows a FlowDesk-owned lane that has not produced a heartbeat or lifecycle update for more than five minutes. The card lists how many lanes are stalled, the top workflow ids with their last-signal age in minutes, the explicit line `FlowDesk does not auto-retry, auto-abort, or auto-fallback on stall.`, and a safe next action allowlist (`/flowdesk-status`, `/flowdesk-retry`, `/flowdesk-resume`, `/flowdesk-abort`, `/flowdesk-doctor`, `/flowdesk-export-debug`). The card de-duplicates within a session unless the stalled lane count, worst classification, or per-workflow age bucket changes, so longer stalls re-alert you over time.
