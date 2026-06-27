# FlowDesk Omnigent Upstream Hook Review

**상태**: not implemented
**결론**: defer core hook until policy-level provenance guard proves insufficient.

## Current Implementation

FlowDesk currently enforces dispatch compatibility through an Omnigent function policy:

- policy path: `flowdesk_omnigent.policies.omnigent_selection_dispatch_guard`
- fixture policy name: `flowdesk_selection_dispatch_guard`
- phase: `tool_call`

The policy now records selector-call provenance in Omnigent `session_state` and requires a matching recorded selection for guarded `sys_session_send` calls.

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
