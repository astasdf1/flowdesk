"""Minimal stdio MCP server for FlowDesk Omnigent advisory selection."""

from __future__ import annotations

import json
import sys
from typing import Any, Mapping

from .selection import select_agent_model

MCP_PROTOCOL_VERSION = "2024-11-05"
MCP_TOOL_NAME = "flowdesk_select_agent_model"


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


def main() -> None:
    """Run a line-delimited JSON-RPC stdio loop."""

    for line in sys.stdin:
        if not line.strip():
            continue
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
