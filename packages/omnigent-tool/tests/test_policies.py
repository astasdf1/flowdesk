from __future__ import annotations

from datetime import datetime, timedelta, timezone
import json
import os
import tempfile
import unittest

from flowdesk_omnigent.policies import make_omnigent_selection_dispatch_guard, omnigent_selection_dispatch_guard


def _event(agent: str, model: str | None = None) -> dict:
    args = {"input": "redacted"}
    if model is not None:
        args["model"] = model
    return {
        "type": "tool_call",
        "target": "sys_session_send",
        "data": {"name": "sys_session_send", "arguments": {"agent": agent, "title": "task-x", "args": args}},
        "session_state": {"flowdesk_selection_events": [{"task_id": "task-x", "selection_status": "selected", "agent": agent, "model": model}]},
    }


def _selector_event(task_role: str = "architecture") -> dict:
    return {
        "type": "tool_call",
        "target": "flowdesk_select_agent_model",
        "data": {"name": "flowdesk_select_agent_model", "arguments": {"task_id": "task-x", "task_role": task_role, "allowed_provider_families": ["openai"]}},
        "session_state": {},
    }


def _selector_result_event(selection: dict) -> dict:
    return {
        "type": "tool_result",
        "target": "flowdesk_select_agent_model",
        "data": {"output": json.dumps(selection)},
        "session_state": {},
    }


def _selection_record(
    *,
    task_id: str = "task-x",
    status: str = "selected",
    agent: str = "architecture-agent",
    model: str | None = None,
    expires_at: str | None = None,
) -> dict:
    record = {"task_id": task_id, "selection_status": status, "agent": agent, "model": model, "selection_id": f"selection-{task_id}"}
    if expires_at is not None:
        record["expires_at"] = expires_at
    return record


def _selection_payload(
    *,
    task_id: str = "task-x",
    status: str = "selected",
    agent: str = "architecture-agent",
    harness: str = "codex",
    model: str | None = None,
    expires_at: str | None = None,
) -> dict:
    return {
        "schema_version": "flowdesk.omnigent_selection.v1",
        "selection_id": f"selection-{task_id}",
        "task_id": task_id,
        "task_role": "architecture",
        "selection_status": status,
        "agent": agent if status == "selected" else None,
        "harness": harness if status == "selected" else None,
        "model": model,
        "confidence": "high",
        "reason_codes": [],
        "blocked_labels": [],
        "authority": "advisory_selection_only",
        "created_at": datetime.now(timezone.utc).isoformat().replace("+00:00", "Z"),
        "expires_at": expires_at or (datetime.now(timezone.utc) + timedelta(minutes=10)).isoformat().replace("+00:00", "Z"),
    }


class PolicyTests(unittest.TestCase):
    def setUp(self) -> None:
        self._tmpdir = tempfile.TemporaryDirectory()
        self.addCleanup(self._tmpdir.cleanup)
        previous = os.environ.get("FLOWDESK_OMNIGENT_GUARD_CACHE_PATH")
        os.environ["FLOWDESK_OMNIGENT_GUARD_CACHE_PATH"] = os.path.join(self._tmpdir.name, "guard-cache.json")
        if previous is None:
            self.addCleanup(os.environ.pop, "FLOWDESK_OMNIGENT_GUARD_CACHE_PATH", None)
        else:
            self.addCleanup(os.environ.__setitem__, "FLOWDESK_OMNIGENT_GUARD_CACHE_PATH", previous)

    def test_allows_expected_claude_policy_security_binding(self) -> None:
        guard = make_omnigent_selection_dispatch_guard()
        self.assertEqual(guard(_event("policy-security-agent", "claude-opus-4-8"))["result"], "ALLOW")

    def test_denies_policy_security_wrong_model(self) -> None:
        guard = make_omnigent_selection_dispatch_guard()
        event = _event("policy-security-agent", "claude-sonnet-4-6")
        event["session_state"] = {
            "flowdesk_selection_events": [_selection_record(agent="policy-security-agent", model="claude-opus-4-8")]
        }
        self.assertEqual(guard(event)["result"], "DENY")

    def test_denies_codex_default_agent_model_override(self) -> None:
        guard = make_omnigent_selection_dispatch_guard()
        event = _event("architecture-agent", "openai/gpt-5.5")
        event["session_state"] = {"flowdesk_selection_events": [_selection_record(agent="architecture-agent", model=None)]}
        self.assertEqual(guard(event)["result"], "DENY")

    def test_allows_codex_default_agent_without_model_override(self) -> None:
        guard = make_omnigent_selection_dispatch_guard()
        self.assertEqual(guard(_event("verification-agent"))["result"], "ALLOW")

    def test_ignores_non_dispatch_tool_calls_and_unknown_agents_by_default(self) -> None:
        guard = make_omnigent_selection_dispatch_guard()
        self.assertIsNone(guard({"type": "tool_call", "target": "web_fetch", "data": {}}))
        self.assertIsNone(guard(_event("other-agent")))

    def test_ignores_sys_session_send_tool_result_payloads(self) -> None:
        guard = make_omnigent_selection_dispatch_guard()
        result = guard({"type": "tool_result", "target": "sys_session_send", "data": {"status": "complete"}, "session_state": {}})
        self.assertIsNone(result)

    def test_direct_policy_callable_matches_omnigent_contract(self) -> None:
        event = _event("architecture-agent", "openai/gpt-5.5")
        event["session_state"] = {"flowdesk_selection_events": [_selection_record(agent="architecture-agent", model=None)]}
        self.assertEqual(omnigent_selection_dispatch_guard(event)["result"], "DENY")

    def test_direct_policy_callable_records_in_memory_runner_state(self) -> None:
        self.assertEqual(omnigent_selection_dispatch_guard(_selector_event())["result"], "ALLOW")
        event = _event("architecture-agent")
        event["session_state"] = {}

        result = omnigent_selection_dispatch_guard(event)

        self.assertEqual(result["result"], "ALLOW")

    def test_records_selector_call_in_policy_state(self) -> None:
        result = omnigent_selection_dispatch_guard(_selector_event())
        self.assertEqual(result["result"], "ALLOW")
        update = result["state_updates"][0]
        self.assertEqual(update["key"], "flowdesk_selection_events")
        self.assertEqual(update["action"], "append")
        self.assertEqual(update["value"]["agent"], "architecture-agent")
        self.assertEqual(update["value"]["provenance_source"], "selector_args_recomputed")

    def test_factory_policy_records_in_memory_runner_state(self) -> None:
        guard = make_omnigent_selection_dispatch_guard()
        self.assertEqual(guard(_selector_event())["result"], "ALLOW")
        event = _event("architecture-agent")
        event["session_state"] = {}

        result = guard(event)

        self.assertEqual(result["result"], "ALLOW")

    def test_factory_policy_records_mcp_selector_name_from_data(self) -> None:
        guard = make_omnigent_selection_dispatch_guard()
        selector = _selector_event()
        selector["target"] = "flowdesk"
        selector["data"]["name"] = "flowdesk_select_agent_model"
        self.assertEqual(guard(selector)["result"], "ALLOW")
        event = _event("architecture-agent")
        event["session_state"] = {}

        result = guard(event)

        self.assertEqual(result["result"], "ALLOW")

    def test_cached_selection_record_supports_cross_policy_instance_matching(self) -> None:
        first_guard = make_omnigent_selection_dispatch_guard()
        second_guard = make_omnigent_selection_dispatch_guard()
        self.assertEqual(first_guard(_selector_event())["result"], "ALLOW")
        event = _event("architecture-agent")
        event["session_state"] = {}

        result = second_guard(event)

        self.assertEqual(result["result"], "ALLOW")

    def test_records_selector_output_in_policy_state(self) -> None:
        result = omnigent_selection_dispatch_guard(_selector_result_event(_selection_payload()))
        self.assertEqual(result["result"], "ALLOW")
        update = result["state_updates"][0]
        self.assertEqual(update["value"]["task_id"], "task-x")
        self.assertEqual(update["value"]["provenance_source"], "selector_output")

    def test_denies_dispatch_without_recorded_selector_provenance(self) -> None:
        event = _event("architecture-agent")
        event["session_state"] = {}
        result = omnigent_selection_dispatch_guard(event)
        self.assertEqual(result["result"], "DENY")
        self.assertIn("no matching FlowDesk selection", result["reason"])

    def test_denies_expired_recorded_selection(self) -> None:
        expired = (datetime.now(timezone.utc) - timedelta(seconds=1)).isoformat().replace("+00:00", "Z")
        event = _event("architecture-agent")
        event["session_state"] = {"flowdesk_selection_events": [_selection_record(expires_at=expired)]}

        result = omnigent_selection_dispatch_guard(event)

        self.assertEqual(result["result"], "DENY")
        self.assertIn("no matching FlowDesk selection", result["reason"])

    def test_uses_recorded_dynamic_model_binding_instead_of_static_registry(self) -> None:
        event = _event("architecture-agent", "claude-sonnet-4-6")
        event["data"]["arguments"]["harness"] = "claude-sdk"
        event["session_state"] = {
            "flowdesk_selection_events": [
                {**_selection_record(agent="architecture-agent", model="claude-sonnet-4-6"), "harness": "claude-sdk"}
            ]
        }

        result = omnigent_selection_dispatch_guard(event)

        self.assertEqual(result["result"], "ALLOW")

    def test_denies_dynamic_harness_binding_when_override_is_missing(self) -> None:
        event = _event("architecture-agent", "claude-sonnet-4-6")
        event["session_state"] = {
            "flowdesk_selection_events": [
                {**_selection_record(agent="architecture-agent", model="claude-sonnet-4-6"), "harness": "claude-sdk"}
            ]
        }

        result = omnigent_selection_dispatch_guard(event)

        self.assertEqual(result["result"], "DENY")
        self.assertIn("harness does not match", result["reason"])

    def test_denies_title_collision_without_matching_task_id(self) -> None:
        event = _event("architecture-agent")
        event["data"]["arguments"]["title"] = "task-y"
        event["session_state"] = {"flowdesk_selection_events": [_selection_record(task_id="task-x")]}

        result = omnigent_selection_dispatch_guard(event)

        self.assertEqual(result["result"], "DENY")
        self.assertIn("no matching FlowDesk selection", result["reason"])

    def test_latest_selector_output_record_wins_over_recomputed_record(self) -> None:
        event = _event("architecture-agent", "claude-sonnet-4-6")
        event["data"]["arguments"]["harness"] = "claude-sdk"
        event["session_state"] = {
            "flowdesk_selection_events": [
                _selection_record(task_id="task-x", agent="architecture-agent", model=None),
                {**_selection_record(task_id="task-x", agent="architecture-agent", model="claude-sonnet-4-6"), "harness": "claude-sdk"},
            ]
        }

        result = omnigent_selection_dispatch_guard(event)

        self.assertEqual(result["result"], "ALLOW")


if __name__ == "__main__":
    unittest.main()
