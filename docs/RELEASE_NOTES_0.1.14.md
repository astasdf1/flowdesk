# FlowDesk 0.1.14 Release Notes

## Highlights

- Release 1 remains conservative and non-dispatch by default.
- Natural-language chat stays transparent: suggestions, confirmation-before-run, and command-backed recovery remain the main flow.
- Provider-free local previews are available for synthesis and durable-plan continuation.
- `flowdesk_agent_task_run` is the supported explicit developer-mode provider-task route.
- `flowdesk_quick_reviewer_run` remains quarantined until revalidated by coordinator policy.

## Safety Notes

- Hard chat cancellation / no-reply is not a Release 1 promise.
- Automatic provider/model fallback or reselection is not a Release 1 promise.
- Production dispatch remains later-gated.
- Watchdog auto-abort, auto-retry, and stall handling are diagnostic/recovery aids, not default authority.

## Verification Notes

- Local build and focused plugin tests have been run for the sidebar, usage, and subtask surfaces.
- Redacted debug exports remain evidence-only.
