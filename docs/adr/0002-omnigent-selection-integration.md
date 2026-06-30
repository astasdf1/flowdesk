# ADR 0002: Omnigent Selection Integration Track

**Status**: Accepted for design and experimental integration; refined by [ADR 0003](./0003-omnigent-first-selection-layer.md)
**Date**: 2026-06-26

---

## Context

FlowDesk is already implemented as an OpenCode plugin track. That track remains governed by the OpenCode implementation specification, Release 1 contracts, conformance plan, threat model, and ADR 0001.

FlowDesk is also exploring Omnigent as an external orchestration platform because Omnigent already provides workflow prompts, sub-agent spawning, provider-specific harnesses, parallel `sys_session_send` fan-out, and inbox-based result collection.

The desired integration shape is not for FlowDesk to become the orchestrator. FlowDesk should act as an agent/model selection intelligence layer that Omnigent can call before dispatching a subtask.

---

## Decision

Create a parallel Omnigent integration track for experimental development.

The Omnigent track may add documentation, examples, and a dedicated integration package, but it must not change OpenCode Release 1 authority, OpenCode plugin conformance claims, or OpenCode runtime behavior.

The first implementation target is an Omnigent local function tool that returns advisory selection results. The recommended package boundary is `packages/omnigent-tool`. It must not depend on `packages/opencode-plugin`.

The canonical initial contract is `flowdesk.omnigent_selection.v1`. It is advisory-only unless and until a separate mechanical dispatch-consistency guard is implemented and reviewed.

---

## Authority Boundary

The Omnigent integration track does not grant FlowDesk any of these authorities:

- Omnigent dispatch authority.
- Runtime retry authority.
- Provider/model fallback or reselection authority.
- Write/apply authority.
- OpenCode hard chat/noReply/cancel/stop authority.
- OpenCode Release 1 production dispatch authority.

FlowDesk selection results are recommendations. ADR 0003 refines the implemented function-policy guard as an opt-in dispatch-consistency gate: it may mechanically deny only FlowDesk-known task/agent/harness/model binding mismatches with fresh selector provenance. It does not grant provider/model fallback, runtime retry, write/apply, hard-chat/noReply, or OpenCode Release 1 production dispatch authority.

---

## Implementation Rules

1. Omnigent integration code lives outside `packages/opencode-plugin`.
2. Shared TypeScript policy may later move into `packages/core`, but `packages/omnigent-tool` must not import OpenCode plugin runtime code.
3. Phase 1 starts with a Python selector and static registry to prove the Omnigent integration seam.
4. Phase 2 may add a TypeScript CLI bridge only after subprocess credential, environment, timeout, and redaction rules are specified.
5. Gemini `antigravity-native` remains experimental and non-dispatchable by default until OAuth refresh/TUI behavior has a reviewed plan.
6. Selection evidence should use Omnigent transcript/tool-call history as the default source of truth. Optional debug logs must be explicit, redacted, and bounded; they must not contain raw prompts, credential file contents, tokens, keychain material, or provider payloads.

---

## Consequences

This ADR allows Omnigent design and prototype work to continue without confusing it with OpenCode Release 1 readiness.

It also means Omnigent docs are scoped to the Omnigent track. If they conflict with OpenCode normative docs, the OpenCode docs continue to govern the OpenCode plugin track.
