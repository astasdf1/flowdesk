# FlowDesk Omnigent Upstream Hook Review

**상태**: not implemented
**결론**: defer core hook until policy-level provenance guard proves insufficient.

## Current Implementation

FlowDesk currently enforces dispatch compatibility through an Omnigent function policy:

- policy path: `flowdesk_omnigent.policies.omnigent_selection_dispatch_guard`
- fixture policy name: `flowdesk_selection_dispatch_guard`
- phase: `tool_call`

The policy records selector-call provenance and requires a matching recorded selection for guarded `sys_session_send` calls.

**Provenance storage is not solely Omnigent `session_state`.** In practice the current Omnigent runner does not reliably persist FunctionPolicy `state_updates` across the selector-call evaluation and the later dispatch evaluation. To work around that, the guard combines three provenance sources (`policies.py`): (1) Omnigent-provided `session_state`, (2) an in-process record list, and (3) a transient local cache at `~/.cache/flowdesk/omnigent-selection-guard-cache.json` (overridable via `FLOWDESK_OMNIGENT_GUARD_CACHE_PATH`). The local cache is the source that makes the guard work today.

## Verified Behavior

- Selector call records a redacted selection event in policy state.
- Selector result records exact selector output provenance when Omnigent emits the `tool_result` phase.
- Dispatch without matching selection is denied.
- Dispatch with mismatched model binding is denied.
- Dispatch with mismatched harness binding is denied.
- Expired selection records are denied.
- Dispatch with matching selection and model binding is allowed.

Live sentinel evidence:

- Negative no-provenance: `FLOWDESK_PROVENANCE_GUARD_NEGATIVE_20260627_OK`
- Positive with provenance: `FLOWDESK_PROVENANCE_GUARD_POSITIVE_2_20260627_OK`
- Final no-provenance after output-provenance guard: `FLOWDESK_PROVENANCE_GUARD_NEGATIVE_FINAL_20260628_OK`
- Final positive after output-provenance guard: `FLOWDESK_PROVENANCE_GUARD_POSITIVE_FINAL_2_20260628_OK`
- Previous binding mismatch negative: `FLOWDESK_DISPATCH_GUARD_NEGATIVE_20260627_OK`
- Previous binding positive: `FLOWDESK_DISPATCH_GUARD_POSITIVE_20260627_OK`

## Honest Limitations — This Is Not a Hard Security Gate

The guard is a **best-effort, opt-in dispatch-consistency check**, not a tamper-resistant security boundary. It must not be described or relied on as a hard gate. Known limitations:

- **Transient-cache dependency:** provenance correctness depends on the local guard cache (above). Cache miss, eviction, a cleared/relocated `~/.cache`, a different `HOME`/user, or a separate process without the cache leaves a legitimate selection unrecognized — the guard then denies (fail-closed availability failure), not allows.
- **Cache tampering / poisoning (fail-open):** the cache file is written without restrictive permissions and read back without integrity, ownership, or session validation (`policies.py` `_append_cached_selection_record` / `_read_cached_selection_records`). Any process running as the same user can inject a fabricated `selected` record and satisfy the provenance match, bypassing the deny. There is no HMAC/signature, no session binding requirement, and the read-modify-write cycle uses a fixed `.tmp` name with no lock (concurrent writers can lose records). This is the primary reason the guard must not be treated as a security boundary; hardening items are tracked in `OMNIGENT_PHASE_BACKLOG.md` → "다관점 비판 리뷰 반영 (2026-07-02)" P0.
- **Unknown-agent fail-open default:** `allow_unknown_agents` defaults to `True`, so dispatches for agents outside the FlowDesk registry pass through without any check.
- **Opt-in only:** the guard exists only when the operator installs `flowdesk_selection_dispatch_guard` in `guardrails.policies`. Without it there is no deny at all.
- **Known-agent scope:** it only checks FlowDesk-known `{task, agent, harness, model}` bindings. Dispatch paths, agents, or tools FlowDesk does not know about are not gated.
- **Consistency, not authority:** it verifies that a guarded dispatch matches a recorded FlowDesk selection. It does not prove the selector was actually consulted for unknown paths, and it grants no provider/model fallback, retry, write/apply, or hard-chat authority.
- **Platform coupling:** behavior depends on the current Omnigent `tool_call`/`tool_result` event shapes and policy semantics, which are pre-1.0 and may change.

A robust, tamper-resistant pre-dispatch gate requires the upstream core hook described below; until that exists, treat the guard as advisory consistency enforcement for cooperative fixtures, not as a trust boundary.

## Why No Core Hook Yet

An upstream `sys_session_send` hook would provide stronger lifecycle control, but it would also require Omnigent core changes and a new authority boundary. The current policy-level path already gives a mechanical deny for the experimental fixture without changing Omnigent core.

## Remaining Reasons To Consider Core Hook Later

- Need to bind selection provenance across child session reuse, title collisions, and selection expiry in core state.
- Need first-class UI/audit representation of FlowDesk selection evidence inside Omnigent.
- Need non-fixture, platform-wide guard semantics rather than opt-in `guardrails.policies` YAML.

## Non-Goals For Current Track

- No provider/model fallback authority.
- No runtime retry authority.
- No write/apply authority.
- No hard-chat/noReply authority.
- No OpenCode Release 1 authority change.
