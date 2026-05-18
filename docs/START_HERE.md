# FlowDesk for opencode Documentation Start Here

## Purpose

This file summarizes the authority and scope of the FlowDesk documentation set. New users can start with `../README.md` or `QUICKSTART.md`; implementers can use this file as a compact map of the implementation-oriented documents.

## Normative Documents

Implementation decisions use these documents as the normative set:

1. `FLOWDESK_OPENCODE_PLUGIN_IMPLEMENTATION_SPEC.md`
2. `schemas/RELEASE_1_TOOL_CONTRACTS.md`
3. `adr/0001-opencode-plugin-first.md`
4. `IMPLEMENTATION_ROADMAP.md`
5. `PROGRESS_SNAPSHOT.md`
6. `OPENCODE_CONFORMANCE_PLAN.md`
7. `THREAT_MODEL.md`
8. `USER_MANUAL.md`

If these documents conflict, the implementation specification wins unless a newer ADR explicitly changes the decision.

`PROGRESS_SNAPSHOT.md` is the required status tracker. Update it whenever implementation status, release gates, blockers, conformance evidence, user-facing readiness, or critical review priorities change. If a work session changes nothing that affects progress, explicitly state that the snapshot was checked and did not need an update.

## Background Documents

These documents are research and historical design context:

1. `background/OPENCODE_FIRST_PLUGIN_DESIGN.md`
2. `background/OPENCODE_PLUGIN_RESEARCH.md`

They are not normative for FlowDesk implementation identity, package names, project data paths, Release 1 scope, command naming, user safety guidance, or safety gates. Treat them as relevant only when they agree with the normative documents.

## Current Implementation Target

Release 1 is a **General-Use MVP** for ordinary OpenCode users. Natural-language chat is the primary UX. FlowDesk routes accepted chat requests into guarded command-backed workflows when OpenCode 1.14.40 conformance evidence supports safe mutation/throw behavior.

Current planning update: FlowDesk must not use broad hidden prefix injection to force most chat through FlowDesk. Chat routing is conservative: ordinary chat is left alone, likely FlowDesk-related work may receive a visible suggestion, explicit FlowDesk requests may enter command-backed workflows, and later-gate unsafe requests are routed to safe alternatives. Execution-like chat requires confirmation before guarded dry-run or fake-runtime behavior.

Release 1 provider/API/model outage handling is diagnostic only. FlowDesk may show provider health, usage readiness, degraded status, fake-runtime output, and safe next actions, but it must not automatically switch providers or models.

OpenCode Go and z.ai are supported in this design as diagnostic provider families, not as fallback or dispatch authority. Missing official quota or account-specific availability evidence remains unknown and non-dispatchable for real provider/model selection.

Final product purpose: FlowDesk minimizes main-agent context. The main agent should do only intake, routing, compact summaries, Guard handoff, and safe next actions. Heavy workflow drafting, refinement, and review belong in bounded subagent lanes that return typed summaries and redacted references when the release gate and pinned OpenCode conformance permit actual lane launch; Release 1 may otherwise use delegated records, fake-runtime lane summaries, and command-backed fallback summaries.

Commands are still required, but they are controls for setup, status, recovery, diagnostics, and fallback. They are not the primary UX for normal work.

Agent authoring note: this file is a map for humans and implementers, not a mandatory reading sequence for generated agents. FlowDesk agent profiles should express expertise through capabilities, tool bounds, reference scopes, output contracts, verification rules, and safety boundaries. They must not force agents to traverse specific documentation paths or read documents in a fixed order.

Included:

1. Installer bootstrap and `/flowdesk-doctor`.
2. Chat-routed planning, delegated workflow authoring records, guarded dry-run, fake-runtime execution, status, recovery, and diagnostics. Release 1 delegated records do not imply actual OpenCode subtask/model/provider lane launch.
3. The Release 1 minimum command surface: `/flowdesk-doctor`, `/flowdesk-plan`, `/flowdesk-run`, `/flowdesk-status`, `/flowdesk-resume`, `/flowdesk-retry`, `/flowdesk-abort`, `/flowdesk-usage`, and `/flowdesk-export-debug`.
4. Provider Health Snapshot diagnostics separate from Usage Availability Snapshot checks.
5. Exact Release 1 tool contract names, schema ids, fixture prefixes, and schema conversion spike artifact requirements in `schemas/RELEASE_1_TOOL_CONTRACTS.md`.
6. Hook harness modes for enforcement, observation, and safe manual fallback.
7. Redacted audit, lane status summaries, and debug export.
8. OpenCode conformance reporting bounded to OpenCode 1.14.40 evidence until newer evidence exists.
9. User manual guidance for abnormal use and safe alternatives.

Excluded until later gates:

1. Real OpenCode dispatch.
2. Automatic provider/model fallback or reselection.
3. Hard chat cancellation or no-reply authority through unsupported `noReply`, `cancel`, or `stop` fields.
4. Evaluation-based ranking or workflow optimization as approval. Release 1 may scaffold schemas and events only.
5. Patent, legal, or medical-device specialist workflows.
6. Optional MCP connector execution.
7. Opt-in federated score registry, central telemetry, or community score sharing.

## Naming and Paths

Current FlowDesk identity:

1. Project name: FlowDesk.
2. Public name: FlowDesk for opencode.
3. Repository slug: `flowdesk`.
4. Plugin id: `flowdesk`.
5. Package scope: `@flowdesk/*` unless a future ADR changes it.
6. Project data root: `.flowdesk/`.

Public product spelling is **FlowDesk for opencode**. Upstream runtime references may use **OpenCode** when naming the external project or API surface.

Legacy terms such as DEX Conductor, `@dex-conductor/*`, and `.conductor/` are background or migration references only.

## Command Naming

Portable command names are documented first:

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

Desired `/flowdesk:*` aliases are enabled only after OpenCode conformance proves parser and platform support.

OpenCode 1.14.40 PoC currently supports portable command-backed flow and chat steering/routing as the Release 1 basis. It does not prove colon alias portability, real dispatch, or hard chat interception.

When Claude, a provider API, or a model is unavailable, users should run `/flowdesk-status`, `/flowdesk-usage`, and `/flowdesk-doctor`. Release 1 reports the health and usage state separately and stays on safe diagnostic, degraded, guarded dry-run, or fake-runtime paths.

Bootstrap/config commands are separate from the core Release 1 command path:

1. `/flowdesk-setup` is a bootstrap installer entrypoint. It is not a normal plugin-managed workflow command.
2. `/flowdesk-init` scaffolds `.flowdesk/config.json` only during bootstrap, or after bootstrap with a Guard-approved non-dispatch config-scaffold permission.
3. Neither command may enable production dispatch by itself.

## Safety Rule

No implementation task may cite a legacy Conductor, OMO, `@dex-conductor/*`, or `.conductor/` path/package as a production FlowDesk target unless it is explicitly marked migration, compatibility, or test-only.
