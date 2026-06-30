# ADR 0003: Omnigent-First Selection Layer Priority

**Status**: Accepted for current development priority
**Date**: 2026-06-30

---

## Context

ADR 0001 selected an OpenCode plugin-first path for the initial FlowDesk implementation. ADR 0002 later authorized an Omnigent selection integration track without changing OpenCode Release 1 authority.

The product direction has since become clearer: FlowDesk should be useful as an agent/model selection intelligence layer that attaches to existing orchestration platforms. The near-term platform priority is Omnigent because Omnigent already owns workspace-first workflow decomposition, child-session dispatch, harness execution, context handling, inbox collection, compaction, and synthesis.

This ADR updates priority and terminology. It does not revoke ADR 0001. The OpenCode plugin remains a maintained safety/evidence/provider-usage/status and post-dispatch lane-observability track. It does not become the primary orchestration UX for the current Omnigent-focused work.

---

## Decision

FlowDesk's current development priority is the Omnigent-first selection layer.

FlowDesk remains explicitly **not** a standalone orchestrator. In the Omnigent track:

1. Omnigent owns workflow decomposition, dispatch, runtime execution, context/memory, inbox collection, and synthesis.
2. FlowDesk owns advisory selection of `{agent, harness, model}` from bounded metadata: task role, task tier/complexity/phase, available agents, provider usage/health, and harness/model compatibility.
3. FlowDesk selection results use `authority="advisory_selection_only"` and do not approve dispatch, fallback, retry, write/apply, or hard-chat control.
4. The optional Omnigent function-policy guard is an **opt-in dispatch-consistency gate**, not a general execution authority. It may mechanically deny only FlowDesk-known `sys_session_send` calls that mismatch a fresh selector provenance record for task/agent/harness/model binding.
5. Installing the guard changes Omnigent fixture behavior by adding a narrow consistency check. It does not transfer Omnigent's dispatch authority to FlowDesk and does not authorize provider/model fallback or reselection.
6. OpenCode Release 1 default behavior remains non-dispatch. OpenCode post-dispatch lane observability and capture-finalization code may observe and materialize evidence for lanes launched through separately authorized paths, but that evidence is not dispatch approval.

---

## Terminology

Use these terms consistently:

| Term | Meaning |
|---|---|
| Advisory selector | FlowDesk code that returns a bounded `flowdesk.omnigent_selection.v1` recommendation. |
| Opt-in dispatch-consistency gate | Omnigent function-policy guard that can deny binding mismatches for FlowDesk-known sub-agents when explicitly installed. |
| Dispatch authority | The platform/user/Guard-controlled authority to launch runtime work. Omnigent keeps this authority in the Omnigent track. |
| Lane observability | OpenCode-side capture/status/wake/evidence handling for lanes that were already launched through a separate authorized path. |

Avoid saying FlowDesk "dispatches", "runs", "orchestrates", or "approves" Omnigent work in the Omnigent track. Say FlowDesk "selects", "recommends", "records", "verifies consistency", or "denies consistency mismatches when the optional guard is installed".

---

## Product Positioning

The current product description is:

> FlowDesk is an agent/model selection layer for existing AI orchestration platforms. The current development priority is Omnigent workspace-first selection; the OpenCode plugin remains the safety, evidence, provider-usage, status, and lane-observability track.

The OpenCode package name and ADR 0001 remain historically accurate for the initial implementation. New Omnigent-facing docs should not present OpenCode as the current priority runtime.

---

## Implementation Consequences

Immediate follow-up work should prioritize:

1. Updating README and Omnigent docs to distinguish advisory selection, optional dispatch-consistency gating, and OpenCode lane observability.
2. Freezing the guard boundary as opt-in and narrow until a later ADR promotes any broader guard authority.
3. Formalizing provider-usage snapshot input with a strict allowlist schema before relying on env/path ingestion for release claims.
4. Adding Python/TypeScript selector parity fixtures and moving the static registry toward a single source of truth.
5. Making any repo-managed FD-OC Omnigent templates versioned, opt-in, and explicit that they are platform templates, not FlowDesk becoming the orchestrator.

---

## Non-Goals

This ADR does not authorize:

1. Default OpenCode provider dispatch.
2. Automatic provider/model fallback or reselection.
3. Omnigent runtime retries.
4. Write/apply authority.
5. Hard chat/noReply/cancel/stop authority.
6. Credential or token file reads by the Omnigent selector.
7. Gemini or Pi dispatch promotion.
8. Upstream Omnigent core hooks.

---

## Supersession Notes

This ADR supersedes ADR 0001 only for current development priority and public positioning. ADR 0001 continues to govern the OpenCode plugin implementation unless a later ADR changes that track.

This ADR refines ADR 0002 by accepting the already-implemented Omnigent function-policy guard as an opt-in dispatch-consistency gate. ADR 0002's authority prohibitions still stand for fallback, retry, write/apply, hard-chat/noReply, and OpenCode Release 1 production dispatch.
