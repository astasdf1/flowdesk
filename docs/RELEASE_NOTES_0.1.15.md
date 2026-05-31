# FlowDesk 0.1.15 Release Notes

FlowDesk `0.1.15` packages the latest Release 1-safe plugin updates while keeping default dispatch/runtime/fallback authority disabled.

## Highlights

- Period-normalized usage routing for model selection.
- Passive sidebar representative-bucket selection now uses period-normalized quota health while keeping the visible display format unchanged.
- Managed-dispatch beta/R2.5 code-test verification refreshed after the routing changes.
- Agent-task nudge/restart timing shortened to 10s/20s nudges and 30s timeout for future lanes.

## Authority boundaries

- Release 1 default behavior remains command-backed and non-dispatch.
- Managed dispatch, production dispatch authority, managed fallback, and hard chat control remain later-gated behind explicit Guard/conformance evidence.
- Provider-calling helper lanes remain explicit developer-mode opt-in.
