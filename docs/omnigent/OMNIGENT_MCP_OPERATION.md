# FlowDesk Omnigent MCP Operation

**상태**: experimental selection-only path
**마지막 검증**: 2026-06-27

## Scope

`flowdesk-omnigent-mcp` is an optional stdio MCP server that exposes only one tool:

- `flowdesk_select_agent_model`

It does not expose dispatch, fallback, retry, provider switching, write/apply, hard-chat/noReply, or credential tools.

## Omnigent Fixture

Example fixture:

- `examples/omnigent-flowdesk-mcp/config.yaml`

Inline MCP shape:

```yaml
tools:
  flowdesk:
    type: mcp
    command: /Users/bagel_macpro_055/Documents/work/projects/omnigent/.venv/bin/python
    args:
      - -m
      - flowdesk_omnigent.mcp_server
    env:
      PYTHONPATH: /Users/bagel_macpro_055/Documents/work/projects/flowdesk/packages/omnigent-tool/src
```

## Operational Checks

Parser check:

```bash
PYTHONPATH="/Users/bagel_macpro_055/Documents/work/projects/omnigent:/Users/bagel_macpro_055/Documents/work/projects/flowdesk/packages/omnigent-tool/src" \
  /Users/bagel_macpro_055/Documents/work/projects/omnigent/.venv/bin/python - <<'PY'
from pathlib import Path
from omnigent.spec import load
spec = load(Path('examples/omnigent-flowdesk-mcp'), expand_env=False)
assert [(server.name, server.transport) for server in spec.mcp_servers] == [('flowdesk', 'stdio')]
print('FLOWDESK_MCP_FIXTURE_PARSE_OK')
PY
```

Stdio tool list smoke:

```bash
printf '%s\n' '{"jsonrpc":"2.0","id":1,"method":"tools/list","params":{}}' \
  | PYTHONPATH="packages/omnigent-tool/src" \
    /Users/bagel_macpro_055/Documents/work/projects/omnigent/.venv/bin/python -m flowdesk_omnigent.mcp_server
```

Live smoke sentinel observed:

- `FLOWDESK_MCP_SELECTION_SMOKE_20260627_OK`

## Latency/Overhead Notes

The MCP server is stdio and starts as a Python process. Current validation is smoke-level only: parser check, stdio list/call, and one live Omnigent MCP selection smoke.

Local in-process handler smoke observed on 2026-06-27:

```text
FLOWDESK_MCP_LOCAL_HANDLER_100_CALLS_MS=1.315
```

Stdio process smoke observed on 2026-06-28:

```text
FLOWDESK_MCP_STDIO_100_CALLS_MS=33.391
```

The in-process value measures the Python request handler only. The stdio value includes launching one Python MCP server process and sending 100 line-delimited JSON-RPC `tools/call` requests through stdin/stdout. Neither value includes Omnigent child session scheduling or provider runtime latency.

## Safety Boundary

MCP selection remains advisory. The mechanical deny currently comes from the Omnigent function policy `flowdesk_selection_dispatch_guard`, not from the MCP server itself.
