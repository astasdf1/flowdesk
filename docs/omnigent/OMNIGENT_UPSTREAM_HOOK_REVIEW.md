# FlowDesk Omnigent Upstream Hook Review

**상태**: core hook NOT needed — upstream gap closed (verified omnigent 0.3.0.dev0)
**결론**: 전용 upstream pre-dispatch hook은 불필요. 근본 갭(policy `state_updates` 비지속)이 omnigent modern policy 엔진에서 이미 해소됐다 — guard는 엔진-persisted `session_state`를 1차 provenance로 사용하고, transient cache는 방어적 fallback으로 격하한다.

## Resolution (2026-07-02)

이 문서가 우회하려던 근본 원인은 "Omnigent runner가 FunctionPolicy `state_updates`를 selector-call→dispatch 평가 간 지속하지 못함"이었다. 검증된 omnigent 0.3.0.dev0의 modern policy 계층은 이를 완전히 지원한다:
- `omnigent/policies/function.py:_coerce_to_policy_result`가 콜러블 dict 반환의 `state_updates`(append 포함)를 `PolicyResult.state_updates`로 파싱한다.
- `omnigent/runtime/policies/engine.py`가 `PolicyResult.state_updates`를 `apply_state_updates`로 세션 상태에 적용하고 `ConversationStore.set_session_state`로 **지속**하며, 다음 평가에 `event["session_state"]`로 재주입한다(`_inject_session_state`, `_apply_one` APPEND 지원).

경험적 검증(`tests/test_session_state_roundtrip.py`, pinned contract CI에서 실행): 실제 omnigent `_coerce_to_policy_result` + `_apply_one`로 guard의 selection state_updates를 session_state에 적용한 뒤, **transient cache를 빈 경로로 두고** fresh guard가 dispatch를 평가하면 `session_state` 단독으로 provenance를 찾아 ALLOW하고, session_state가 없으면 DENY한다. 즉 provenance가 엔진 session_state로 서빙되며 cache는 불필요하다.

따라서: (1) 별도 Omnigent core hook을 만들지 않는다 — 근본 해결이 이미 upstream에 있다. (2) transient cache는 session_state를 제공하지 못하는 runner/경로(구버전, 비지속 실행)용 **방어적 fallback**으로만 남긴다. 그 fallback 경로에서의 same-UID 조작 한계는 여전히 유효하지만, session_state가 제공되는 정상 경로에서는 provenance가 조작-불가한 엔진 상태에서 나온다.

## Current Implementation

FlowDesk currently enforces dispatch compatibility through an Omnigent function policy:

- policy path: `flowdesk_omnigent.policies.omnigent_selection_dispatch_guard`
- fixture policy name: `flowdesk_selection_dispatch_guard`
- phase: `tool_call`

The policy records selector-call provenance and requires a matching recorded selection for guarded `sys_session_send` calls.

**Provenance storage (updated 2026-07-02).** On the verified Omnigent version the **primary** provenance source is engine-persisted `session_state` (see Resolution above): the modern policy engine applies the guard's `state_updates` and re-injects them as `event["session_state"]` on the dispatch evaluation. The guard still combines three sources (`policies.py`) — (1) Omnigent `session_state`, (2) an in-process record list, (3) a transient local cache (`FLOWDESK_OMNIGENT_GUARD_CACHE_PATH`) — but the cache is now a **defensive fallback** for runners/paths that do not provide persisted `session_state`, not the load-bearing source. The `test_session_state_roundtrip` contract test proves the guard works from `session_state` alone with the cache emptied.

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
- **Cache tampering / poisoning (fallback path only, fail-open):** the cache file is written without restrictive-enough guarantees and read back without integrity/ownership validation. A same-user process could inject a fabricated `selected` record. As of 2026-07-02 this affects **only the fallback path** — on the verified Omnigent version provenance comes from engine-persisted `session_state`, which a peer process cannot forge. The cache is retained for runners that do not persist `session_state`; on those, this limitation stands (no HMAC/session binding). Hardening/removal of the fallback is tracked in `OMNIGENT_PHASE_BACKLOG.md` P0.
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
