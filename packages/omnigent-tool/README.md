# FlowDesk Omnigent Tool

Experimental Omnigent integration package for FlowDesk advisory agent/model selection.

This package implements the experimental Omnigent selection path from `docs/omnigent/OMNIGENT_DEVELOPMENT_DESIGN_OPTIONS.md`:

- local Python function tool only;
- advisory selection only;
- no Omnigent dispatch calls;
- no provider fallback/retry authority;
- no credential/token file reads;
- optional local debug JSONL only when explicitly requested by the caller.
- post-run trace verification from Omnigent history/tool-call events;
- optional fixture-level function policy guard for selector-provenance and binding consistency.

Install into an Omnigent venv from PyPI:

```bash
uv pip install --python /path/to/omnigent/.venv/bin/python flowdesk-omnigent-tool
```

Development install from a FlowDesk checkout:

```bash
uv pip install --python /path/to/omnigent/.venv/bin/python -e packages/omnigent-tool
```

Release preflight from the FlowDesk repository:

```bash
npm run release:omnigent-tool
```

Publishing is explicit:

```bash
npm run release:omnigent-tool -- --test-pypi
npm run release:omnigent-tool -- --publish
```

GitHub Actions Trusted Publishing is available through `.github/workflows/publish-omnigent-tool.yml`. Configure PyPI with workflow filename `publish-omnigent-tool.yml` and environment `pypi`; configure TestPyPI with environment `testpypi` if you want a TestPyPI dry run.

Function path for Omnigent config:

```text
flowdesk_omnigent.selection.select_agent_model
```

The selector accepts optional `provider_usage` or `provider_health` snapshots. Exhausted, critical, stale, blocked, unavailable, non-dispatchable, or 0%-remaining provider rows are skipped when another allowed provider can satisfy the request. If every allowed provider is unavailable, the selector returns `selection_status=blocked` with `provider_usage_unavailable`.

If a selector request omits both usage fields, the Python selector can load a strict allowlist usage snapshot from either `FLOWDESK_OMNIGENT_PROVIDER_USAGE_JSON` or `FLOWDESK_OMNIGENT_PROVIDER_USAGE_PATH`. Inline JSON takes precedence over the file path and explicit request fields take precedence over both. Env/path snapshots must contain only the bounded Omnigent usage input fields (`schema_version`, `captured_at`, `observed_at`, `source`, `providers`, or direct `claude`/`openai`/`gemini` rows); malformed, oversized, unknown-key, token-shaped, or out-of-range snapshots fail closed with `provider_usage_snapshot_rejected`. This path reads only caller-provided sanitized usage JSON; it does not read provider credential or token files.

Trace verifier import path:

```text
flowdesk_omnigent.trace_verifier.verify_selection_dispatch_trace
```

Trace adapter import path:

```text
flowdesk_omnigent.trace_adapter.normalize_omnigent_trace_events
```

Minimal adapter/verifier flow:

```python
from flowdesk_omnigent.trace_adapter import normalize_omnigent_trace_events
from flowdesk_omnigent.trace_verifier import verify_selection_dispatch_trace

normalized = normalize_omnigent_trace_events(history_items)
verification = verify_selection_dispatch_trace(normalized["events"])
```

The adapter returns redaction-safe normalized events only. It does not preserve raw prompts, full tool arguments, full tool outputs, provider payloads, or credentials.

Optional MCP stdio server:

```bash
flowdesk-omnigent-mcp
```

Omnigent MCP config after PyPI install:

```yaml
tools:
  flowdesk:
    type: mcp
    command: flowdesk-omnigent-mcp
```

Ensure the Omnigent server process inherits a `PATH` containing the Omnigent venv `bin` directory, for example:

```bash
export PATH="/path/to/omnigent/.venv/bin:$PATH"
```

The MCP server exposes only `flowdesk_select_agent_model`. It is selection-only and does not expose Omnigent dispatch, fallback, retry, write/apply, or provider-switch tools.

Optional Omnigent function policy guard:

```yaml
guardrails:
  policies:
    flowdesk_selection_dispatch_guard:
      type: function
      on: [tool_call, tool_result]
      function: flowdesk_omnigent.policies.omnigent_selection_dispatch_guard
```

The guard records FlowDesk selector calls in Omnigent policy state and, when Omnigent emits a selector `tool_result`, records exact selector output provenance. Guarded `sys_session_send` calls must match a recorded task/agent/harness/model binding and must not use expired selection records. This remains fixture-level policy enforcement only; it does not grant provider fallback, retry, write/apply, hard-chat/noReply, credential, or upstream Omnigent core-hook authority.
