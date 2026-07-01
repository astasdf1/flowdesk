"""Omnigent policy helpers for FlowDesk selection consistency."""

from __future__ import annotations

from datetime import datetime, timezone
import json
import os
from pathlib import Path
from typing import Any, Callable, Mapping, Sequence

from .selection import select_agent_model

DEFAULT_AGENT_MODEL_BINDINGS: Mapping[str, str | None] = {
    "policy-security-agent": None,
    "architecture-agent": None,
    "implementation-agent": None,
    "verification-agent": None,
    "research-agent": None,
    "general-agent": None,
    "gemini-agent": None,
}
DEFAULT_AGENT_HARNESS_BINDINGS: Mapping[str, str] = {
    "policy-security-agent": "claude-native",
    "architecture-agent": "codex",
    "implementation-agent": "codex",
    "verification-agent": "codex",
    "research-agent": "claude-native",
    "general-agent": "codex",
    "gemini-agent": "antigravity-native",
}
FLOWDESK_SELECTION_STATE_KEY = "flowdesk_selection_events"
FLOWDESK_SELECTOR_TARGETS = frozenset({"flowdesk_select_agent_model", "select_agent_model", "mcp__flowdesk__flowdesk_select_agent_model"})
_MAX_IN_MEMORY_SELECTION_RECORDS = 200
_DIRECT_SELECTION_RECORDS: list[dict[str, Any]] = []
_GUARD_CACHE_ENV = "FLOWDESK_OMNIGENT_GUARD_CACHE_PATH"


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

    local_selection_records: list[dict[str, Any]] = []

    def evaluate(event: Mapping[str, Any]) -> dict[str, Any] | None:
        return _evaluate_omnigent_selection_dispatch_guard(
            event,
            local_selection_records=local_selection_records,
            guarded_agents=guarded_agents,
            allow_unknown_agents=allow_unknown_agents,
            require_selection_provenance=require_selection_provenance,
        )

    return evaluate


def omnigent_selection_dispatch_guard(event: Mapping[str, Any]) -> dict[str, Any] | None:
    """Direct Omnigent policy callable for config.yaml function policies."""

    return _evaluate_omnigent_selection_dispatch_guard(event, local_selection_records=_DIRECT_SELECTION_RECORDS)


def _evaluate_omnigent_selection_dispatch_guard(
    event: Mapping[str, Any],
    *,
    local_selection_records: list[dict[str, Any]],
    guarded_agents: Sequence[str] | None = None,
    allow_unknown_agents: bool = True,
    require_selection_provenance: bool = True,
) -> dict[str, Any] | None:
    guarded = set(guarded_agents or DEFAULT_AGENT_MODEL_BINDINGS.keys())
    event_type = event.get("type")
    if event_type not in {"tool_call", "tool_result"}:
        return None
    target = event.get("target")
    if event_type == "tool_result" and _is_flowdesk_selector_event(event):
        return _record_selection_output_event(event, local_selection_records=local_selection_records)
    if event_type == "tool_result":
        return None
    if event_type == "tool_call" and _is_flowdesk_selector_event(event):
        return _record_recomputed_selection_event(event, local_selection_records=local_selection_records)
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
    actual_model = _dispatch_model(arguments)
    actual_provider_family = _dispatch_provider_family(arguments)
    if require_selection_provenance:
        matching_selection = _matching_recorded_selection(event, arguments, local_selection_records=local_selection_records)
        if matching_selection is None:
            return {"result": "DENY", "reason": "FlowDesk dispatch guard: no matching FlowDesk selection was recorded for this dispatch."}
        if matching_selection.get("selection_status") != "selected":
            return {"result": "DENY", "reason": "FlowDesk dispatch guard: recorded selection was not dispatchable."}
        if _selection_is_expired(matching_selection):
            return {"result": "DENY", "reason": "FlowDesk dispatch guard: recorded selection has expired."}
        expected_provider_family = _selection_provider_family(matching_selection, agent=agent)
        expected_harness = matching_selection.get("harness")
    else:
        expected_provider_family = _provider_family_for_harness(DEFAULT_AGENT_HARNESS_BINDINGS.get(agent))
        expected_harness = DEFAULT_AGENT_HARNESS_BINDINGS.get(agent)
    actual_harness = _dispatch_harness(arguments)
    effective_harness = actual_harness or DEFAULT_AGENT_HARNESS_BINDINGS.get(agent)
    if isinstance(expected_harness, str) and effective_harness != expected_harness:
        return {"result": "DENY", "reason": "FlowDesk dispatch guard: harness does not match selected binding."}
    if actual_model is not None:
        if actual_provider_family is None:
            return {"result": "DENY", "reason": "FlowDesk dispatch guard: model override does not match selected binding."}
        if expected_provider_family is not None and actual_provider_family != expected_provider_family:
            return {"result": "DENY", "reason": "FlowDesk dispatch guard: model family does not match selected binding."}
    return {"result": "ALLOW"}


def _dispatch_model(arguments: Mapping[str, Any]) -> str | None:
    args = arguments.get("args")
    if isinstance(args, Mapping):
        model = args.get("model")
        return model if isinstance(model, str) and model else None
    return None


def _dispatch_provider_family(arguments: Mapping[str, Any]) -> str | None:
    return _model_provider_family(_dispatch_model(arguments))


def _dispatch_harness(arguments: Mapping[str, Any]) -> str | None:
    args = arguments.get("args")
    harness = args.get("harness") if isinstance(args, Mapping) else None
    if not isinstance(harness, str) or not harness:
        harness = arguments.get("harness")
    return harness if isinstance(harness, str) and harness else None


def _record_recomputed_selection_event(
    event: Mapping[str, Any],
    *,
    local_selection_records: list[dict[str, Any]],
) -> dict[str, Any] | None:
    data = event.get("data")
    if not isinstance(data, Mapping):
        return None
    arguments = data.get("arguments")
    if not isinstance(arguments, Mapping):
        arguments = {}
    selection = select_agent_model(arguments, write_evidence=False)
    record = _record_from_selection(selection, provenance_source="selector_args_recomputed", event=event)
    if record is None:
        return None
    _append_in_memory_selection_record(local_selection_records, record)
    return {"result": "ALLOW", "state_updates": [{"key": FLOWDESK_SELECTION_STATE_KEY, "action": "append", "value": record}]}


def _record_selection_output_event(
    event: Mapping[str, Any],
    *,
    local_selection_records: list[dict[str, Any]],
) -> dict[str, Any] | None:
    selection = _selection_from_tool_result(event)
    if selection is None:
        return {"result": "ALLOW"}
    record = _record_from_selection(selection, provenance_source="selector_output", event=event)
    if record is None:
        return {"result": "ALLOW"}
    _append_in_memory_selection_record(local_selection_records, record)
    return {"result": "ALLOW", "state_updates": [{"key": FLOWDESK_SELECTION_STATE_KEY, "action": "append", "value": record}]}


def _append_in_memory_selection_record(records: list[dict[str, Any]], record: Mapping[str, Any]) -> None:
    records.append(dict(record))
    if len(records) > _MAX_IN_MEMORY_SELECTION_RECORDS:
        del records[: len(records) - _MAX_IN_MEMORY_SELECTION_RECORDS]
    _append_cached_selection_record(record)


def _append_cached_selection_record(record: Mapping[str, Any]) -> None:
    path = _guard_cache_path()
    try:
        path.parent.mkdir(parents=True, exist_ok=True)
        records = _read_cached_selection_records()
        records.append(dict(record))
        records = records[-_MAX_IN_MEMORY_SELECTION_RECORDS:]
        tmp_path = path.with_suffix(f"{path.suffix}.tmp")
        tmp_path.write_text(json.dumps(records, sort_keys=True), encoding="utf-8")
        tmp_path.replace(path)
    except OSError:
        return


def _read_cached_selection_records() -> list[Mapping[str, Any]]:
    path = _guard_cache_path()
    try:
        payload = json.loads(path.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError):
        return []
    if not isinstance(payload, list):
        return []
    return [item for item in payload if isinstance(item, Mapping)]


def _guard_cache_path() -> Path:
    override = os.environ.get(_GUARD_CACHE_ENV)
    if override:
        return Path(override).expanduser()
    return Path.home() / ".cache" / "flowdesk" / "omnigent-selection-guard-cache.json"


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


def _record_from_selection(selection: Mapping[str, Any], *, provenance_source: str, event: Mapping[str, Any] | None = None) -> dict[str, Any] | None:
    task_id = selection.get("task_id")
    status = selection.get("selection_status")
    if not isinstance(task_id, str) or not task_id or status not in {"selected", "blocked", "non_dispatchable"}:
        return None
    record = {
        "task_id": task_id,
        "selection_status": status,
        "agent": selection.get("agent"),
        "harness": selection.get("harness"),
        "provider_family": selection.get("provider_family"),
        "model": selection.get("model"),
        "selection_id": selection.get("selection_id"),
        "expires_at": selection.get("expires_at"),
        "provenance_source": provenance_source,
    }
    session_ref = _event_session_ref(event or {})
    if session_ref is not None:
        record["session_ref"] = session_ref
    return record


def _matching_recorded_selection(
    event: Mapping[str, Any],
    arguments: Mapping[str, Any],
    *,
    local_selection_records: Sequence[Mapping[str, Any]],
) -> Mapping[str, Any] | None:
    state = event.get("session_state")
    if not isinstance(state, Mapping):
        return None
    records = state.get(FLOWDESK_SELECTION_STATE_KEY)
    if not isinstance(records, list):
        records = []
    combined_records = [*records, *local_selection_records, *_read_cached_selection_records()]
    event_session_ref = _event_session_ref(event)
    task_id = _dispatch_task_id(arguments)
    agent = arguments.get("agent")
    model = _dispatch_model(arguments)
    actual_provider_family = _model_provider_family(model)
    for raw in reversed(combined_records):
        if not isinstance(raw, Mapping):
            continue
        record_session_ref = raw.get("session_ref")
        if event_session_ref is not None and isinstance(record_session_ref, str) and record_session_ref != event_session_ref:
            continue
        if task_id is not None and raw.get("task_id") != task_id:
            continue
        if raw.get("agent") != agent:
            continue
        if _selection_is_expired(raw):
            continue
        expected_provider_family = _selection_provider_family(raw, agent=agent)
        if actual_provider_family is not None and expected_provider_family is not None and actual_provider_family != expected_provider_family:
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


def _event_session_ref(event: Mapping[str, Any]) -> str | None:
    for key in ("session_ref", "session_id", "sessionId"):
        value = event.get(key)
        if isinstance(value, str) and value:
            return value
    for container_key in ("data", "request_data"):
        container = event.get(container_key)
        if not isinstance(container, Mapping):
            continue
        for key in ("session_ref", "session_id", "sessionId"):
            value = container.get(key)
            if isinstance(value, str) and value:
                return value
    return None


def _selection_provider_family(selection: Mapping[str, Any], *, agent: str | None = None) -> str | None:
    provider_family = selection.get("provider_family")
    if isinstance(provider_family, str) and provider_family in {"claude", "openai", "gemini"}:
        return provider_family
    model = selection.get("model")
    if isinstance(model, str):
        derived = _model_provider_family(model)
        if derived is not None:
            return derived
    if isinstance(agent, str):
        return _provider_family_for_harness(DEFAULT_AGENT_HARNESS_BINDINGS.get(agent))
    harness = selection.get("harness")
    return _provider_family_for_harness(harness if isinstance(harness, str) else None)


def _provider_family_for_harness(harness: str | None) -> str | None:
    if harness == "claude-native":
        return "claude"
    if harness == "claude-sdk":
        return "claude"
    if harness == "codex":
        return "openai"
    if harness == "antigravity-native":
        return "gemini"
    return None


def _model_provider_family(model: str | None) -> str | None:
    if model is None:
        return None
    if model.startswith(("claude/", "anthropic/", "claude-")):
        return "claude"
    if model.startswith("openai/"):
        return "openai"
    if model.startswith(("gemini/", "google/")):
        return "gemini"
    return None


def _is_flowdesk_selector_target(target: str) -> bool:
    return (
        target in FLOWDESK_SELECTOR_TARGETS
        or target.endswith("__flowdesk_select_agent_model")
        or target.endswith(".flowdesk_select_agent_model")
        or target.endswith("/flowdesk_select_agent_model")
    )


def _is_flowdesk_selector_event(event: Mapping[str, Any]) -> bool:
    for candidate in _event_selector_name_candidates(event):
        if isinstance(candidate, str) and _is_flowdesk_selector_target(candidate):
            return True
    return False


def _event_selector_name_candidates(event: Mapping[str, Any]) -> list[Any]:
    candidates: list[Any] = [event.get("target")]
    data = event.get("data")
    if isinstance(data, Mapping):
        candidates.extend([data.get("name"), data.get("tool"), data.get("tool_name")])
    request_data = event.get("request_data")
    if isinstance(request_data, Mapping):
        candidates.extend([request_data.get("name"), request_data.get("tool"), request_data.get("tool_name")])
    return candidates


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
