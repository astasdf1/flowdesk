from __future__ import annotations

import json
from pathlib import Path
import unittest

from flowdesk_omnigent.trace_adapter import normalize_omnigent_trace_events
from flowdesk_omnigent.trace_verifier import verify_selection_dispatch_trace


def _selection_output(task_id: str, *, status: str = "selected", agent: str = "architecture-agent", model: str | None = None) -> str:
    return json.dumps(
        {
            "schema_version": "flowdesk.omnigent_selection.v1",
            "selection_id": f"selection-{task_id}",
            "task_id": task_id,
            "selection_status": status,
            "agent": agent if status == "selected" else None,
            "harness": "codex" if status == "selected" else None,
            "model": model,
            "authority": "advisory_selection_only",
        }
    )


class TraceAdapterTests(unittest.TestCase):
    def test_normalizes_three_matching_selection_dispatch_pairs(self) -> None:
        items = []
        for task_id, agent, model in [
            ("task-policy", "policy-security-agent", "claude-opus-4-8"),
            ("task-architecture", "architecture-agent", None),
            ("task-verification", "verification-agent", None),
        ]:
            items.extend(
                [
                    {
                        "type": "function_call",
                        "name": "flowdesk_select_agent_model",
                        "arguments": json.dumps({"task_id": task_id}),
                        "call_id": f"call_select_{task_id}",
                    },
                    {
                        "type": "function_call_output",
                        "call_id": f"call_select_{task_id}",
                        "output": _selection_output(task_id, agent=agent, model=model),
                    },
                    {
                        "type": "function_call",
                        "name": "sys_session_send",
                        "arguments": json.dumps(
                            {
                                "agent": agent,
                                "title": task_id,
                                "args": {"model": model} if model is not None else {},
                            }
                        ),
                        "call_id": f"call_dispatch_{task_id}",
                    },
                ]
            )

        normalized = normalize_omnigent_trace_events(items)
        result = verify_selection_dispatch_trace(normalized["events"])

        self.assertEqual(normalized["warning_count"], 0)
        self.assertEqual(result["status"], "pass")
        self.assertEqual(result["selection_count"], 3)
        self.assertEqual(result["dispatch_count"], 3)

    def test_normalizes_matching_function_call_history(self) -> None:
        normalized = normalize_omnigent_trace_events(
            [
                {
                    "id": "fc_select",
                    "type": "function_call",
                    "name": "flowdesk_select_agent_model",
                    "arguments": json.dumps({"task_id": "task-architecture"}),
                    "call_id": "call_select",
                },
                {
                    "id": "out_select",
                    "type": "function_call_output",
                    "call_id": "call_select",
                    "output": _selection_output("task-architecture"),
                },
                {
                    "id": "fc_dispatch",
                    "type": "function_call",
                    "name": "sys_session_send",
                    "arguments": json.dumps(
                        {
                            "agent": "architecture-agent",
                            "title": "task-architecture",
                            "args": {"input": "redacted"},
                        }
                    ),
                    "call_id": "call_dispatch",
                },
            ]
        )

        self.assertEqual(normalized["warning_count"], 0)
        self.assertEqual([event["type"] for event in normalized["events"]], ["selection", "dispatch"])
        result = verify_selection_dispatch_trace(normalized["events"])
        self.assertEqual(result["status"], "pass")

    def test_normalizes_nested_data_shape(self) -> None:
        normalized = normalize_omnigent_trace_events(
            [
                {
                    "id": "fc_select",
                    "type": "function_call",
                    "data": {
                        "name": "flowdesk_select_agent_model",
                        "arguments": json.dumps({"task_id": "task-policy"}),
                        "call_id": "call_select",
                    },
                },
                {
                    "id": "out_select",
                    "type": "function_call_output",
                    "data": {"call_id": "call_select", "output": _selection_output("task-policy", agent="policy-security-agent", model="claude-opus-4-8")},
                },
                {
                    "id": "fc_dispatch",
                    "type": "function_call",
                    "data": {
                        "name": "sys_session_send",
                        "arguments": {
                            "agent": "policy-security-agent",
                            "title": "task-policy",
                            "args": {"model": "claude-opus-4-8"},
                        },
                        "call_id": "call_dispatch",
                    },
                },
            ]
        )

        result = verify_selection_dispatch_trace(normalized["events"])
        self.assertEqual(result["status"], "pass")

    def test_verifier_fails_blocked_selection_dispatch_from_normalized_history(self) -> None:
        normalized = normalize_omnigent_trace_events(
            [
                {
                    "type": "function_call",
                    "name": "flowdesk_select_agent_model",
                    "arguments": json.dumps({"task_id": "task-blocked"}),
                    "call_id": "call_select",
                },
                {
                    "type": "function_call_output",
                    "call_id": "call_select",
                    "output": _selection_output("task-blocked", status="blocked"),
                },
                {
                    "type": "function_call",
                    "name": "sys_session_send",
                    "arguments": json.dumps({"agent": "architecture-agent", "title": "task-blocked", "args": {}}),
                    "call_id": "call_dispatch",
                },
            ]
        )

        result = verify_selection_dispatch_trace(normalized["events"])
        self.assertEqual(result["status"], "fail")
        self.assertIn("blocked_or_non_dispatchable_task_was_dispatched", [issue["code"] for issue in result["issues"]])

    def test_verifier_fails_null_model_override_from_normalized_history(self) -> None:
        normalized = normalize_omnigent_trace_events(
            [
                {
                    "type": "function_call",
                    "name": "flowdesk_select_agent_model",
                    "arguments": json.dumps({"task_id": "task-codex"}),
                    "call_id": "call_select",
                },
                {"type": "function_call_output", "call_id": "call_select", "output": _selection_output("task-codex")},
                {
                    "type": "function_call",
                    "name": "sys_session_send",
                    "arguments": json.dumps(
                        {"agent": "architecture-agent", "title": "task-codex", "args": {"model": "openai/gpt-5.5"}}
                    ),
                    "call_id": "call_dispatch",
                },
            ]
        )

        result = verify_selection_dispatch_trace(normalized["events"])
        self.assertEqual(result["status"], "fail")
        self.assertEqual(result["issues"][0]["code"], "dispatch_model_override_should_be_omitted")

    def test_realistic_fixture_normalizes_and_verifies_end_to_end(self) -> None:
        fixture_path = Path(__file__).parent / "fixtures" / "omnigent_function_history_selection_dispatch.json"
        items = json.loads(fixture_path.read_text(encoding="utf-8"))

        normalized = normalize_omnigent_trace_events(items)
        result = verify_selection_dispatch_trace(normalized["events"])

        self.assertEqual(normalized["warning_count"], 0)
        self.assertEqual(result["status"], "pass")
        self.assertEqual(result["selection_count"], 2)
        self.assertEqual(result["dispatch_count"], 2)


if __name__ == "__main__":
    unittest.main()
