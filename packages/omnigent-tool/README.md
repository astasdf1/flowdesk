# FlowDesk Omnigent Tool

Experimental Omnigent integration package for FlowDesk advisory agent/model selection.

This package implements the experimental Omnigent selection path from `docs/omnigent/OMNIGENT_DEVELOPMENT_DESIGN_OPTIONS.md`:

- local Python function and MCP selection tools;
- advisory selection only;
- no Omnigent dispatch calls;
- no provider fallback/retry authority;
- no credential/token file reads;
- optional local debug JSONL only when explicitly requested by the caller.
- post-run trace verification from Omnigent history/tool-call events;
- optional fixture-level function policy guard for selector-provenance and binding consistency.
- optional FD-OC Omnigent templates and a foreground server+host launcher.

Install into an Omnigent venv from PyPI:

```bash
uv pip install --python /path/to/omnigent/.venv/bin/python flowdesk-omnigent-tool
```

Development install from a FlowDesk checkout:

```bash
uv pip install --python /path/to/omnigent/.venv/bin/python -e packages/omnigent-tool
```

After install, ensure the Python environment's `bin` directory is on the `PATH` used by your shell and Omnigent server:

```bash
export PATH="/path/to/omnigent/.venv/bin:$PATH"
```

Install the bundled workspace-first FD-OC Omnigent templates into `~/.omnigent/agents`:

```bash
flowdesk-omnigent-install-templates
```

Preview or install to a custom agent root:

```bash
flowdesk-omnigent-install-templates --dry-run
flowdesk-omnigent-install-templates --agent-root /path/to/agents
flowdesk-omnigent-install-templates --force
```

Run Omnigent server and host daemon from one foreground command:

```bash
flowdesk-omnigent-start --open
```

This starts the equivalent of:

```bash
omnigent server --port 6767 \
  --agent ~/.omnigent/agents/FD-OC \
  --agent ~/.omnigent/agents/FD-OC-Opus \
  --agent ~/.omnigent/agents/FD-OC-Codex
omnigent host --server http://127.0.0.1:6767
```

Useful launcher options:

```bash
flowdesk-omnigent-start --dry-run
flowdesk-omnigent-start --bind 100.x.y.z --open
flowdesk-omnigent-start --port 6767
flowdesk-omnigent-start --agent-root ~/.omnigent/agents
flowdesk-omnigent-start --no-host-daemon
flowdesk-omnigent-start --omnigent-bin /path/to/omnigent
```

The launcher binds to `127.0.0.1` by default. Use `--bind <tailscale-ip-or-hostname>` to expose the Omnigent server on a Tailscale interface, or `--bind 0.0.0.0` only when you intentionally want every interface to listen. The launcher is foreground-only. It does not install a background daemon, edit shell profiles, register launchd/systemd services, or write Omnigent config. Press `Ctrl-C` to stop the child server and host processes.

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

### Release cadence policy

`flowdesk-omnigent-tool` is an **advisory-only** selection package. Publish a new PyPI version only when a change is user-facing for installers of the package — that is, one of:

- a change to selector behavior, the registry artifact, or the response contract (`flowdesk.omnigent_selection.v1`);
- a change to the MCP server tool surface, the console script, or the guard policy semantics;
- a packaging, dependency, install-path, or security fix that affects installed behavior.

Do **not** cut a release for repo-only changes: documentation edits, examples, tests, CI tweaks, or progress-snapshot updates. Batch such changes and let them ride the next behavior-driven release. Because the tool cannot dispatch, provider-switch, or gain authority by design, version churn adds install/verification cost without user benefit. When in doubt, land the change unversioned and defer the bump until the next capability change. Record each published version once in `PROGRESS_SNAPSHOT.md`; a bump with no capability delta should be rare and justified.

Function path for Omnigent config:

```text
flowdesk_omnigent.selection.select_agent_model
```

The shared registry is role-based, not role-exclusive: every agent role now has
Claude Opus, Sonnet, and Haiku entries where Claude is supported, alongside the
existing OpenAI harness fallback. The selector still prefers the role-appropriate
Claude variant when tier signals are present, but dispatch remains provenance-
gated by the selection guard.

The bundled FlowDesk templates bind Claude to the native `claude-native`
runtime path. `claude-sdk` remains accepted as a compatibility alias, but when
Claude-native is unavailable in the local environment that is a runtime/auth
constraint, not a FlowDesk policy block.

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

The MCP server exposes only `flowdesk_select_agent_model`. It accepts advisory hints such as `task_complexity`, `task_phase`, `task_tier`, `model_tier`, `preferred_model`, and `allowed_models`; these only rank/filter selector candidates. The server is selection-only and does not expose Omnigent dispatch, fallback, retry, write/apply, or provider-switch tools.

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

**This is a best-effort, opt-in consistency check, not a hard security gate.** Because the current Omnigent runner does not reliably persist FunctionPolicy state between selector and dispatch evaluation, provenance depends on a transient local cache at `~/.cache/flowdesk/omnigent-selection-guard-cache.json` (override with `FLOWDESK_OMNIGENT_GUARD_CACHE_PATH`). The guard only covers FlowDesk-known bindings and only exists when installed. Unknown agents are allowed by default (`allow_unknown_agents=True`), and the cache is writable by any same-user process, so tampering can forge provenance (fail-open); cache loss or a changed cache location/user instead causes legitimate dispatches to be denied (fail-closed availability failure). Do not treat it as a trust boundary. See `docs/omnigent/OMNIGENT_UPSTREAM_HOOK_REVIEW.md` → "Honest Limitations".
