"""Omnigent policy helpers for FlowDesk selection consistency."""

from __future__ import annotations

from datetime import datetime, timezone
import json
from typing import Any, Callable, Mapping, Sequence

from .selection import select_agent_model

DEFAULT_AGENT_MODEL_BINDINGS: Mapping[str, str | None] = {
    "policy-security-agent": "claude-opus-4-8",
    "architecture-agent": None,
    "implementation-agent": None,
    "verification-agent": None,
}
DEFAULT_AGENT_HARNESS_BINDINGS: Mapping[str, str] = {
    "policy-security-agent": "claude-sdk",
    "architecture-agent": "codex",
    "implementation-agent": "codex",
    "verification-agent": "codex",
}
FLOWDESK_SELECTION_STATE_KEY = "flowdesk_selection_events"
FLOWDESK_SELECTOR_TARGETS = frozenset({"flowdesk_select_agent_model", "select_agent_model", "mcp__flowdesk__flowdesk_select_agent_model"})


def make_omnigent_selection_dispatch_guard(
    *,
    guarded_agents: Sequence[str] | None = None,
    allow_unknown_agents: bool = True,
    require_selection_provenance: bool = True,
) -> Callable[[Mapping[str, Any]], dict[str, Any] | None]:
    """Create a tool_call policy that denies selection-incompatible dispatch.

    This is a mechanical pre-dispatch guard for the FlowDesk Omnigent fixture.
    It does not prove that a selector tool was called earlier; it only ensures
    that guarded ``sys_session_send`` calls match FlowDesk's current static
    advisory binding contract.
    """

    guarded = set(guarded_agents or DEFAULT_AGENT_MODEL_BINDINGS.keys())

    def evaluate(event: Mapping[str, Any]) -> dict[str, Any] | None:
        event_type = event.get("type")
        if event_type not in {"tool_call", "tool_result"}:
            return None
        target = event.get("target")
        if event_type == "tool_result" and isinstance(target, str) and _is_flowdesk_selector_target(target):
            return _record_selection_output_event(event)
        if event_type == "tool_result":
            return None
        if event_type == "tool_call" and isinstance(target, str) and _is_flowdesk_selector_target(target):
            return _record_recomputed_selection_event(event)
        if target != "sys_session_send":
            return None
        data = event.get("data")
        if not isinstance(data, Mapping):
            return {"result": "DENY", "reason": "FlowDesk dispatch guard: malformed tool_call data."}
        arguments = data.get("arguments")
        if not isinstance(arguments, Mapping):
            return {"result": "DENY", "reason": "FlowDesk dispatch guard: malformed sys_session_send arguments."}
        agent = arguments.get("agent")
        if not isinstance(agent, str) or not agent:
            return None
        if agent not in guarded:
            if allow_unknown_agents:
                return None
            return {"result": "DENY", "reason": "FlowDesk dispatch guard: unregistered sub-agent."}
        if require_selection_provenance:
            matching_selection = _matching_recorded_selection(event, arguments)
            if matching_selection is None:
                return {"result": "DENY", "reason": "FlowDesk dispatch guard: no matching FlowDesk selection was recorded for this dispatch."}
            if matching_selection.get("selection_status") != "selected":
                return {"result": "DENY", "reason": "FlowDesk dispatch guard: recorded selection was not dispatchable."}
            if _selection_is_expired(matching_selection):
                return {"result": "DENY", "reason": "FlowDesk dispatch guard: recorded selection has expired."}
            expected_model = matching_selection.get("model")
            expected_harness = matching_selection.get("harness")
        else:
            expected_model = DEFAULT_AGENT_MODEL_BINDINGS.get(agent)
            expected_harness = DEFAULT_AGENT_HARNESS_BINDINGS.get(agent)
        actual_harness = _dispatch_harness(arguments)
        effective_harness = actual_harness or DEFAULT_AGENT_HARNESS_BINDINGS.get(agent)
        if isinstance(expected_harness, str) and effective_harness != expected_harness:
            return {"result": "DENY", "reason": "FlowDesk dispatch guard: harness does not match selected binding."}
        actual_model = _dispatch_model(arguments)
        if expected_model is None and actual_model is not None:
            return {"result": "DENY", "reason": "FlowDesk dispatch guard: this sub-agent must use harness default model."}
        if expected_model is not None and actual_model != expected_model:
            return {"result": "DENY", "reason": "FlowDesk dispatch guard: model override does not match selected binding."}
        return {"result": "ALLOW"}

    return evaluate


def omnigent_selection_dispatch_guard(event: Mapping[str, Any]) -> dict[str, Any] | None:
    """Direct Omnigent policy callable for config.yaml function policies."""

    return make_omnigent_selection_dispatch_guard()(event)


def _dispatch_model(arguments: Mapping[str, Any]) -> str | None:
    args = arguments.get("args")
    if isinstance(args, Mapping):
        model = args.get("model")
        return model if isinstance(model, str) and model else None
    return None


def _dispatch_harness(arguments: Mapping[str, Any]) -> str | None:
    harness = arguments.get("harness")
    return harness if isinstance(harness, str) and harness else None


def _record_recomputed_selection_event(event: Mapping[str, Any]) -> dict[str, Any] | None:
    data = event.get("data")
    if not isinstance(data, Mapping):
        return None
    arguments = data.get("arguments")
    if not isinstance(arguments, Mapping):
        arguments = {}
    selection = select_agent_model(arguments, write_evidence=False)
    record = _record_from_selection(selection, provenance_source="selector_args_recomputed")
    if record is None:
        return None
    return {"result": "ALLOW", "state_updates": [{"key": FLOWDESK_SELECTION_STATE_KEY, "action": "append", "value": record}]}


def _record_selection_output_event(event: Mapping[str, Any]) -> dict[str, Any] | None:
    selection = _selection_from_tool_result(event)
    if selection is None:
        return {"result": "ALLOW"}
    record = _record_from_selection(selection, provenance_source="selector_output")
    if record is None:
        return {"result": "ALLOW"}
    return {"result": "ALLOW", "state_updates": [{"key": FLOWDESK_SELECTION_STATE_KEY, "action": "append", "value": record}]}


def _selection_from_tool_result(event: Mapping[str, Any]) -> Mapping[str, Any] | None:
    data = event.get("data")
    payload: Any = None
    if isinstance(data, Mapping):
        payload = data.get("output") or data.get("result") or data.get("content")
    elif isinstance(data, str):
        payload = data
    selection = _coerce_selection_payload(payload)
    if selection is not None:
        return selection
    if isinstance(data, Mapping):
        content = data.get("content")
        if isinstance(content, list):
            for item in content:
                if isinstance(item, Mapping) and item.get("type") == "text":
                    selection = _coerce_selection_payload(item.get("text"))
                    if selection is not None:
                        return selection
    return None


def _coerce_selection_payload(value: Any) -> Mapping[str, Any] | None:
    if isinstance(value, Mapping):
        payload = dict(value)
    elif isinstance(value, str) and value.strip():
        try:
            parsed = json.loads(value)
        except json.JSONDecodeError:
            return None
        if not isinstance(parsed, Mapping):
            return None
        payload = dict(parsed)
    else:
        return None
    if isinstance(payload.get("result"), Mapping):
        payload = dict(payload["result"])
    if payload.get("schema_version") != "flowdesk.omnigent_selection.v1":
        return None
    if payload.get("authority") != "advisory_selection_only":
        return None
    return payload


def _record_from_selection(selection: Mapping[str, Any], *, provenance_source: str) -> dict[str, Any] | None:
    task_id = selection.get("task_id")
    status = selection.get("selection_status")
    if not isinstance(task_id, str) or not task_id or status not in {"selected", "blocked", "non_dispatchable"}:
        return None
    return {
        "task_id": task_id,
        "selection_status": status,
        "agent": selection.get("agent"),
        "harness": selection.get("harness"),
        "model": selection.get("model"),
        "selection_id": selection.get("selection_id"),
        "expires_at": selection.get("expires_at"),
        "provenance_source": provenance_source,
    }


def _matching_recorded_selection(event: Mapping[str, Any], arguments: Mapping[str, Any]) -> Mapping[str, Any] | None:
    state = event.get("session_state")
    if not isinstance(state, Mapping):
        return None
    records = state.get(FLOWDESK_SELECTION_STATE_KEY)
    if not isinstance(records, list):
        return None
    task_id = _dispatch_task_id(arguments)
    agent = arguments.get("agent")
    model = _dispatch_model(arguments)
    for raw in reversed(records):
        if not isinstance(raw, Mapping):
            continue
        if task_id is not None and raw.get("task_id") != task_id:
            continue
        if raw.get("agent") != agent:
            continue
        if _selection_is_expired(raw):
            continue
        expected_model = raw.get("model")
        if expected_model is None and model is not None:
            continue
        if expected_model is not None and expected_model != model:
            continue
        return raw
    return None


def _dispatch_task_id(arguments: Mapping[str, Any]) -> str | None:
    args = arguments.get("args")
    if isinstance(args, Mapping):
        task_id = args.get("task_id")
        if isinstance(task_id, str) and task_id:
            return task_id
    title = arguments.get("title")
    return title if isinstance(title, str) and title else None


def _is_flowdesk_selector_target(target: str) -> bool:
    return target in FLOWDESK_SELECTOR_TARGETS or target.endswith("__flowdesk_select_agent_model")


def _selection_is_expired(selection: Mapping[str, Any]) -> bool:
    expires_at = selection.get("expires_at")
    if not isinstance(expires_at, str) or not expires_at:
        return False
    try:
        parsed = datetime.fromisoformat(expires_at.replace("Z", "+00:00"))
    except ValueError:
        return True
    if parsed.tzinfo is None:
        parsed = parsed.replace(tzinfo=timezone.utc)
    return parsed <= datetime.now(timezone.utc)
