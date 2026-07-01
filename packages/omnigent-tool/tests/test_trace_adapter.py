from __future__ import annotations

import json
from pathlib import Path
import unittest

from flowdesk_omnigent.trace_adapter import normalize_omnigent_trace_events
from flowdesk_omnigent.trace_verifier import verify_selection_dispatch_trace


def _selection_output(
    task_id: str,
    *,
    status: str = "selected",
    agent: str = "architecture-agent",
    harness: str = "codex",
    provider_family: str | None = None,
    model: str | None = None,
) -> str:
    return json.dumps(
        {
            "schema_version": "flowdesk.omnigent_selection.v1",
            "selection_id": f"selection-{task_id}",
            "task_id": task_id,
            "selection_status": status,
            "agent": agent if status == "selected" else None,
            "harness": harness if status == "selected" else None,
            "provider_family": provider_family if status == "selected" else None,
            "model": model,
            "authority": "advisory_selection_only",
        }
    )


class TraceAdapterTests(unittest.TestCase):
    def test_normalizes_three_matching_selection_dispatch_pairs(self) -> None:
        items = []
        for task_id, agent, model, provider_family, harness in [
            ("task-policy", "policy-security-agent", "claude-opus-4-8", "claude", "claude-native"),
            ("task-architecture", "architecture-agent", None, "openai", "codex"),
            ("task-verification", "verification-agent", None, "openai", "codex"),
            ("task-gemini", "gemini-agent", "google/gemini-3.1-flash-lite", "gemini", "antigravity-native"),
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
                        "output": _selection_output(task_id, agent=agent, provider_family=provider_family, model=model),
                    },
                    {
                        "type": "function_call",
                        "name": "sys_session_send",
                        "arguments": json.dumps(
                            {
                                "agent": agent,
                                "title": task_id,
                                "args": {"model": model, "harness": harness} if model is not None else {"harness": harness},
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
        self.assertEqual(result["selection_count"], 4)
        self.assertEqual(result["dispatch_count"], 4)

    def test_normalizes_gemini_selection_without_explicit_provider_family(self) -> None:
        normalized = normalize_omnigent_trace_events(
            [
                {
                    "type": "function_call",
                    "name": "flowdesk_select_agent_model",
                    "arguments": json.dumps({"task_id": "task-gemini", "task_role": "gemini_experimental"}),
                    "call_id": "call_select",
                },
                {
                    "type": "function_call_output",
                    "call_id": "call_select",
                    "output": json.dumps(
                        {
                            "schema_version": "flowdesk.omnigent_selection.v1",
                            "selection_id": "selection-task-gemini",
                            "task_id": "task-gemini",
                            "task_role": "gemini_experimental",
                            "selection_status": "selected",
                            "agent": "gemini-agent",
                            "harness": "antigravity-native",
                            "model": None,
                            "confidence": "high",
                            "reason_codes": ["role_gemini_experimental_prefers_gemini_native"],
                            "blocked_labels": [],
                            "authority": "advisory_selection_only",
                        }
                    ),
                },
                {
                    "type": "function_call",
                    "name": "sys_session_send",
                    "arguments": json.dumps(
                        {
                            "agent": "gemini-agent",
                            "title": "task-gemini",
                            "args": {
                                "harness": "antigravity-native",
                            },
                        }
                    ),
                    "call_id": "call_dispatch",
                },
            ]
        )

        self.assertEqual(normalized["warning_count"], 0)
        self.assertEqual(normalized["events"][0]["provider_family"], "gemini")
        result = verify_selection_dispatch_trace(normalized["events"])
        self.assertEqual(result["status"], "pass")

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
                    "data": {
                        "call_id": "call_select",
                        "output": _selection_output(
                            "task-policy",
                            agent="policy-security-agent",
                            provider_family="claude",
                            model="claude-opus-4-8",
                        ),
                    },
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

    def test_verifier_allows_same_family_model_override_from_normalized_history(self) -> None:
        normalized = normalize_omnigent_trace_events(
            [
                {
                    "type": "function_call",
                    "name": "flowdesk_select_agent_model",
                    "arguments": json.dumps({"task_id": "task-codex"}),
                    "call_id": "call_select",
                },
                {"type": "function_call_output", "call_id": "call_select", "output": _selection_output("task-codex", provider_family="openai")},
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
        self.assertEqual(result["status"], "pass")

    def test_verifier_fails_cross_family_model_override_from_normalized_history(self) -> None:
        normalized = normalize_omnigent_trace_events(
            [
                {
                    "type": "function_call",
                    "name": "flowdesk_select_agent_model",
                    "arguments": json.dumps({"task_id": "task-claude"}),
                    "call_id": "call_select",
                },
                {"type": "function_call_output", "call_id": "call_select", "output": _selection_output("task-claude", provider_family="claude", model="claude-opus-4-8")},
                {
                    "type": "function_call",
                    "name": "sys_session_send",
                    "arguments": json.dumps(
                        {"agent": "architecture-agent", "title": "task-claude", "args": {"model": "openai/gpt-5.5"}}
                    ),
                    "call_id": "call_dispatch",
                },
            ]
        )

        result = verify_selection_dispatch_trace(normalized["events"])
        self.assertEqual(result["status"], "fail")
        self.assertEqual(result["issues"][0]["code"], "dispatch_model_family_mismatch")

    def test_realistic_fixture_normalizes_and_verifies_end_to_end(self) -> None:
        fixture_path = Path(__file__).parent / "fixtures" / "omnigent_function_history_selection_dispatch.json"
        items = json.loads(fixture_path.read_text(encoding="utf-8"))

        normalized = normalize_omnigent_trace_events(items)
        result = verify_selection_dispatch_trace(normalized["events"])

        self.assertEqual(normalized["warning_count"], 0)
        self.assertEqual(result["status"], "pass")
        self.assertEqual(result["selection_count"], 3)
        self.assertEqual(result["dispatch_count"], 3)


if __name__ == "__main__":
    unittest.main()
