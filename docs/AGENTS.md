# AGENTS.md - FlowDesk Docs Navigation

This folder contains FlowDesk planning and design documents.

## Documentation Map

This file lists the main FlowDesk documents without imposing an agent-specific reading path.

## Document Authority

Normative implementation documents:

1. `START_HERE.md`
2. `FLOWDESK_OPENCODE_PLUGIN_IMPLEMENTATION_SPEC.md`
3. `schemas/RELEASE_1_TOOL_CONTRACTS.md`
4. `adr/0001-opencode-plugin-first.md`
5. `IMPLEMENTATION_ROADMAP.md`
6. `OPENCODE_CONFORMANCE_PLAN.md`
7. `THREAT_MODEL.md`
8. `USER_MANUAL.md`

User-facing safety document:

1. `USER_MANUAL.md`

Background documents:

1. `background/OPENCODE_FIRST_PLUGIN_DESIGN.md`
2. `background/OPENCODE_PLUGIN_RESEARCH.md`

The implementation specification wins conflicts unless a newer ADR explicitly changes the decision.

## Release 1 Reminder

Release 1 is a general-use MVP for ordinary OpenCode users. Natural-language chat is the primary UX, routed into guarded command-backed workflows. Heavy workflow authoring should be represented through bounded lane records and summaries where conformance and release gates permit, with the main agent limited to routing, compact summaries, Guard handoff, and safe next actions. Actual OpenCode subtask/model/provider lane launches are not Release 1 behavior unless a later real-dispatch gate explicitly promotes them. Commands remain available for setup, status, recovery, diagnostics, and fallback.

Do not treat real dispatch, automatic provider/model fallback or reselection, hard `noReply`/`cancel`/`stop` authority, evaluation ranking, specialist workflows, or MCP connectors as Release 1 work unless a newer ADR/spec revision says so. Chat routing is allowed only as guarded command-backed routing when conformance proves safe mutation/throw behavior. The Release 1 minimum command surface is `/flowdesk-doctor`, `/flowdesk-plan`, `/flowdesk-run`, `/flowdesk-status`, `/flowdesk-resume`, `/flowdesk-retry`, `/flowdesk-abort`, `/flowdesk-usage`, and `/flowdesk-export-debug`. Provider Health Snapshot diagnostics are separate from Usage Availability Snapshot display. The hook harness may deny, rewrite, or route unsafe attempts, but it never approves dispatch and off mode leaves only safe manual or fallback behavior.

OpenCode Go and z.ai are diagnostic provider families in this design. Do not infer fallback, dispatch, or quota availability from provider-side suggestions, coding-plan labels, model text, or console-only pages.

## Search Guidance

If search results land in `docs/background/`, check the supersession note before using the content. Background examples may contain legacy names such as DEX Conductor, `@dex-conductor/*`, `.conductor/`, or `/flowdesk:*` aliases.

Production FlowDesk targets are `FlowDesk`, `@flowdesk/*`, `.flowdesk/`, and portable `/flowdesk-*` commands unless conformance proves aliases.

When authoring FlowDesk agent profiles, do not turn this documentation map into instructions that force fixed document-path traversal. Express agent expertise through capabilities, tool bounds, reference scopes, output contracts, verification rules, and safety boundaries instead.
