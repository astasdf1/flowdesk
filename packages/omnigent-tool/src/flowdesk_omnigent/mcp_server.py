"""Minimal stdio MCP server for FlowDesk Omnigent advisory selection."""

from __future__ import annotations

import json
import sys
from typing import Any, Mapping

from .selection import select_agent_model

MCP_PROTOCOL_VERSION = "2024-11-05"
MCP_TOOL_NAME = "flowdesk_select_agent_model"
# Per-line byte cap so a newline-less giant payload cannot be buffered without
# bound (`for line in sys.stdin` would read until EOF). 256 KiB is far above any
# legitimate selection request.
MAX_REQUEST_BYTES = 262144


def handle_mcp_request(request: Mapping[str, Any]) -> dict[str, Any] | None:
    """Handle one JSON-RPC request without granting runtime authority."""

    method = request.get("method")
    request_id = request.get("id")
    if method == "notifications/initialized":
        return None
    if method == "initialize":
        return _result(
            request_id,
            {
                "protocolVersion": MCP_PROTOCOL_VERSION,
                "capabilities": {"tools": {}},
                "serverInfo": {"name": "flowdesk-omnigent-mcp", "version": "0.1.0"},
            },
        )
    if method == "tools/list":
        return _result(request_id, {"tools": [_tool_definition()]})
    if method == "tools/call":
        params = request.get("params")
        if not isinstance(params, Mapping) or params.get("name") != MCP_TOOL_NAME:
            return _error(request_id, -32602, "unsupported tool")
        arguments = params.get("arguments")
        if not isinstance(arguments, Mapping):
            arguments = {}
        selection = select_agent_model(arguments, write_evidence=False)
        return _result(
            request_id,
            {
                "content": [{"type": "text", "text": json.dumps(selection, ensure_ascii=True, sort_keys=True, separators=(",", ":"))}],
                "isError": False,
            },
        )
    return _error(request_id, -32601, "method not found")


def _bounded_lines(stream: Any, max_bytes: int):
    """Yield input lines, or ``None`` for a line exceeding ``max_bytes``.

    Oversized lines are drained one bounded chunk at a time (never buffered
    whole), so a newline-less giant payload cannot exhaust memory.
    """

    while True:
        line = stream.readline(max_bytes + 1)
        if line == "":
            return
        if len(line) > max_bytes and not line.endswith("\n"):
            while True:
                chunk = stream.readline(max_bytes + 1)
                if chunk == "" or chunk.endswith("\n"):
                    break
            yield None
            continue
        yield line


def main() -> None:
    """Run a line-delimited JSON-RPC stdio loop."""

    for line in _bounded_lines(sys.stdin, MAX_REQUEST_BYTES):
        if line is None:
            response: dict[str, Any] | None = _error(None, -32600, "request too large")
        elif not line.strip():
            continue
        else:
            try:
                request = json.loads(line)
            except json.JSONDecodeError:
                response = _error(None, -32700, "parse error")
            else:
                response = handle_mcp_request(request) if isinstance(request, Mapping) else _error(None, -32600, "invalid request")
        if response is not None:
            sys.stdout.write(json.dumps(response, ensure_ascii=True, sort_keys=True, separators=(",", ":")))
            sys.stdout.write("\n")
            sys.stdout.flush()


def _tool_definition() -> dict[str, Any]:
    return {
        "name": MCP_TOOL_NAME,
        "description": "Return advisory-only FlowDesk agent/model selection for an Omnigent subtask.",
        "inputSchema": {
            "type": "object",
            "additionalProperties": False,
            "properties": {
                "task_id": {"type": "string"},
                "task_role": {
                    "type": "string",
                    "enum": ["policy_security", "architecture", "implementation", "verification", "research", "general", "gemini_experimental"],
                },
                "available_agents": {"type": "array", "items": {"type": "string"}},
                "task_complexity": {"type": "string", "enum": ["low", "medium", "high", "critical"]},
                "task_phase": {
                    "type": "string",
                    "enum": ["high_level_design", "detailed_design", "implementation", "verification", "research", "risk_review"],
                },
                "task_tier": {"type": "string", "enum": ["lower", "middle", "upper", "senior", "reasoning", "frontier"]},
                "model_tier": {
                    "type": "string",
                    "enum": ["frontier", "normal", "mini", "fast", "spark", "sonnet", "pro", "flash", "flash-lite"],
                },
                "preferred_model": {"type": "string"},
                "allowed_models": {"type": "array", "items": {"type": ["string", "null"]}},
                "allowed_provider_families": {"type": "array", "items": {"type": "string", "enum": ["claude", "openai", "gemini"]}},
                "preferred_provider_family": {"type": "string", "enum": ["claude", "openai", "gemini"]},
                "requires_headless": {"type": "boolean"},
            },
            "required": ["task_id", "task_role"],
        },
    }


def _result(request_id: Any, result: Mapping[str, Any]) -> dict[str, Any]:
    return {"jsonrpc": "2.0", "id": request_id, "result": dict(result)}


def _error(request_id: Any, code: int, message: str) -> dict[str, Any]:
    return {"jsonrpc": "2.0", "id": request_id, "error": {"code": code, "message": message}}


if __name__ == "__main__":
    main()
