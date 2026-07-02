# ADR 0004: Omnigent `ts_cli` Selection Bridge Status

**Status**: Accepted — keep as experimental, opt-in, non-default; documented removal trigger
**Date**: 2026-07-02

---

## Context

The Omnigent selector has two engines:

- **`static`** (default): the Python selector in `packages/omnigent-tool` reading the
  `omnigent_selector_registry.v1.json` artifact. Every production path — the MCP
  server, the dispatch guard, the example fixtures, the FD-OC templates — uses this.
- **`ts_cli`** (opt-in): the Python selector shells out to the TypeScript CLI
  (`packages/core/src/omnigent-selection-cli.ts`) when the caller explicitly passes
  `engine="ts_cli"`. It exists so the Omnigent track could reuse `@flowdesk/core`
  TypeScript selection assets instead of duplicating logic.

A 2026-07-02 multi-lens review found `ts_cli` has **no real consumer**: nothing
outside `test_selection.py` invokes it. It carries ongoing cost — a separate
subprocess path, environment stripping, a timeout, and a dependency on a built Node
CLI — with no current caller. Meanwhile Python↔TypeScript **parity is already
enforced** at the registry and behavior level (`agent_allowed_bindings`,
`omnigent_selection_parity_cases.json`, registry deep-equal tests), so the two
selectors are provably equivalent without routing Python through the TS CLI at
runtime.

## Decision

Keep `ts_cli` as an **experimental, opt-in, non-default** bridge. Do **not** promote
it to a default or production path, and do **not** remove it yet.

Rationale for keeping (not removing now):

- It is already fail-closed: on CLI failure the Python wrapper returns `blocked`
  with no static fallback, so a broken bridge cannot silently degrade selection.
- It is the seam that would let the Omnigent track consume richer `@flowdesk/core`
  selection logic (e.g. if OI scoring is ever bridged in — see ADR 0003) without a
  third reimplementation.
- Removal is cheap later; re-adding a reviewed subprocess boundary is not.

## Removal trigger

Remove `ts_cli` (the Python `engine="ts_cli"` path, `omnigent-selection-cli.ts`, and
their tests) if **both** hold at the next Omnigent-track review:

1. No production caller has adopted `engine="ts_cli"`, and
2. no accepted plan (ADR) requires routing Omnigent selection through
   `@flowdesk/core` at runtime.

Until then it stays, clearly marked experimental.

## Consequences

- The static Python selector remains the single production selection path.
- Parity between the Python and TypeScript selectors continues to be guaranteed by
  the shared registry artifact and parity tests, independent of the `ts_cli` bridge.
- Documentation and fixtures must not present `ts_cli` as the default or a supported
  production invocation.

## Non-Goals

- This ADR does not make `ts_cli` a default, production, or dispatch-capable path.
- It does not grant provider/model fallback, runtime retry, write/apply, or any
  authority beyond the existing advisory selection semantics.
