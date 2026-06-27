from __future__ import annotations

import json
import subprocess
import sys
import unittest

from flowdesk_omnigent.mcp_server import MCP_TOOL_NAME, handle_mcp_request


class McpServerTests(unittest.TestCase):
    def test_initialize_and_list_tools(self) -> None:
        initialized = handle_mcp_request({"jsonrpc": "2.0", "id": 1, "method": "initialize", "params": {}})
        self.assertEqual(initialized["result"]["serverInfo"]["name"], "flowdesk-omnigent-mcp")

        tools = handle_mcp_request({"jsonrpc": "2.0", "id": 2, "method": "tools/list", "params": {}})
        self.assertEqual(tools["result"]["tools"][0]["name"], MCP_TOOL_NAME)

    def test_tools_call_returns_advisory_selection_text(self) -> None:
        response = handle_mcp_request(
            {
                "jsonrpc": "2.0",
                "id": 3,
                "method": "tools/call",
                "params": {
                    "name": MCP_TOOL_NAME,
                    "arguments": {"task_id": "task-mcp", "task_role": "architecture", "allowed_provider_families": ["openai"]},
                },
            }
        )

        payload = json.loads(response["result"]["content"][0]["text"])
        self.assertEqual(payload["schema_version"], "flowdesk.omnigent_selection.v1")
        self.assertEqual(payload["selection_status"], "selected")
        self.assertEqual(payload["authority"], "advisory_selection_only")
        self.assertEqual(payload["model"], None)

    def test_unsupported_tool_fails_without_dispatch_authority(self) -> None:
        response = handle_mcp_request({"jsonrpc": "2.0", "id": 4, "method": "tools/call", "params": {"name": "sys_session_send", "arguments": {}}})
        self.assertEqual(response["error"]["code"], -32602)
        self.assertNotIn("result", response)

    def test_stdio_transport_handles_initialize_and_tool_call(self) -> None:
        requests = "\n".join(
            [
                json.dumps({"jsonrpc": "2.0", "id": 1, "method": "initialize", "params": {}}),
                json.dumps(
                    {
                        "jsonrpc": "2.0",
                        "id": 2,
                        "method": "tools/call",
                        "params": {
                            "name": MCP_TOOL_NAME,
                            "arguments": {"task_id": "task-stdio", "task_role": "architecture", "allowed_provider_families": ["openai"]},
                        },
                    }
                ),
                "",
            ]
        )
        completed = subprocess.run(
            [sys.executable, "-m", "flowdesk_omnigent.mcp_server"],
            input=requests,
            text=True,
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
            timeout=5,
            check=False,
        )

        self.assertEqual(completed.returncode, 0, completed.stderr)
        responses = [json.loads(line) for line in completed.stdout.splitlines() if line.strip()]
        self.assertEqual(responses[0]["result"]["serverInfo"]["name"], "flowdesk-omnigent-mcp")
        payload = json.loads(responses[1]["result"]["content"][0]["text"])
        self.assertEqual(payload["task_id"], "task-stdio")
        self.assertEqual(payload["authority"], "advisory_selection_only")


if __name__ == "__main__":
    unittest.main()
