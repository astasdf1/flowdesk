# AGENTS.md - FlowDesk Repository Guidance

This repository is the FlowDesk OpenCode plugin project.

## Documentation Map

For product and implementation context, use the documentation under `docs/`. The implementation specification is the primary contract when documents conflict unless a newer ADR explicitly changes the decision. This file is not a mandatory traversal path for generated FlowDesk agents.

## Progress Tracking Requirement

`docs/PROGRESS_SNAPSHOT.md` is the required progress tracker for this repository. Every non-trivial work session must check it before concluding and update it when code, tests, docs, packaging, installer behavior, conformance evidence, release gates, blockers, or user-facing readiness changes. If no progress fields changed, the final response must explicitly say the progress snapshot was checked and did not need an update.

## Current Target

Release 1 is a general-use MVP for ordinary OpenCode users. Natural-language chat is the primary UX, routed into guarded command-backed workflows. Commands are setup, status, recovery, diagnostics, and fallback controls, not the main way users should work.

Planning update: do not implement broad hidden OMO-style prompt/prefix injection. Release 1 chat routing must use conservative, transparent intent handling: leave general chat alone, show visible FlowDesk suggestions for likely workflow-worthy requests, route only explicit/high-confidence FlowDesk requests into command-backed workflows, and require confirmation before any execution-like guarded dry-run or fake-runtime step.

Allowed Release 1 scope:

1. Installer bootstrap and `/flowdesk-doctor`.
2. Chat-routed command-backed flows for delegated planning records, guarded dry-run, fake-runtime execution, lane status summaries, recovery, and diagnostics. Release 1 does not perform actual OpenCode subtask/model/provider lane launches unless a later real-dispatch gate explicitly promotes that behavior.
3. Release 1 minimum command surface: `/flowdesk-doctor`, `/flowdesk-plan`, `/flowdesk-run`, `/flowdesk-status`, `/flowdesk-resume`, `/flowdesk-retry`, `/flowdesk-abort`, `/flowdesk-usage`, and `/flowdesk-export-debug`.
4. Hook harness modes that can enforce, observe, or turn off managed automation while preserving safe fallback behavior.
5. Redacted audit, lane summaries, and debug export.
6. OpenCode conformance reporting bounded to OpenCode 1.14.40 evidence until newer conformance exists.
7. User manual coverage for abnormal use and safe alternatives.
8. Provider Health Snapshot diagnostics separate from Usage Availability Snapshot display and fail-closed behavior.

Not Release 1 scope:

1. Real OpenCode dispatch.
2. Automatic provider/model fallback or reselection.
3. Hard chat cancellation or no-reply authority through unsupported `noReply`, `cancel`, or `stop` fields.
4. Evaluation-based ranking.
5. Patent, legal, or medical-device specialist workflows.
6. Optional MCP connector execution.

## Identity and Paths

Use these names for implementation:

1. Project name: FlowDesk.
2. Public name: FlowDesk for opencode.
3. Repository slug: `flowdesk`.
4. Plugin id: `flowdesk`.
5. Package scope: `@flowdesk/*` unless a newer ADR changes it.
6. Project data root: `.flowdesk/`.

Legacy names such as DEX Conductor, `@dex-conductor/*`, and `.conductor/` are background or migration references only.

## Background Docs

Files under `docs/background/` are non-normative. Do not implement production behavior directly from them.

Use background docs only for historical context, research rationale, or migration notes. If they conflict with normative docs, the normative docs win.

## Safety Rules

1. No OMO runtime, prompt, config schema, agent, skill, task file, team runtime, or source dependency.
2. No nested `opencode run` for normal plugin-managed workflows.
3. No privileged action without FlowDesk Guard approval or a specific Guard-approved non-dispatch permission.
4. No real dispatch until conformance proves trusted binding, trusted runtime echo, sufficient telemetry surfaces, fresh usage, Guard approval, and durable pre-dispatch audit.
5. No managed provider/model fallback or reselection until a later gate proves fresh provider-native usage, fresh provider health, runtime compatibility, policy eligibility, trusted binding/echo, sufficient telemetry, durable pre-dispatch audit, a new attempt id, and explicit Guard approval.
6. No claim of hard chat cancellation or no-reply authority until a first-class OpenCode boundary is proven; Release 1 chat UX must route into command-backed workflows.
7. Hook harness enforcement may deny, rewrite, or route unsafe attempts, but it never approves dispatch and off mode never bypasses Guard.
8. Event telemetry supports harness coordination but is not Guard authority, dispatch authorization, durable audit completion, or sole runtime echo evidence.
9. Debug and audit outputs must be redacted-first.
10. Heavy workflow authoring belongs in bounded subagent lanes where conformance and release gates permit. In Release 1, lane records and summaries may be fake-runtime, degraded, or command-backed when actual lane launch is not proven safe. Main-agent output should be limited to routing, compact summaries, Guard handoff, and safe next actions.
11. Chat/message mutation is steering only unless conformance proves blocking intake. Do not claim that FlowDesk fully handled, suppressed, or replaced the normal assistant turn through prompt mutation alone.

## Before Changing Code

Before implementing or editing code, identify which release gate the task belongs to:

1. Release 1 general-use MVP.
2. Managed dispatch beta.
3. Operational intelligence.
4. Specialist workflow.

If the task asks for a later gate, verify the required conformance and threat-model conditions before implementation.

Before concluding any implementation or planning task, update `docs/PROGRESS_SNAPSHOT.md` or state why no update was necessary.
