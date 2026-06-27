"""Normalize Omnigent tool-call history into FlowDesk trace events."""

from __future__ import annotations

import json
from typing import Any, Mapping, Sequence

FLOWDESK_SELECTION_TOOL_NAMES = frozenset({"flowdesk_select_agent_model", "select_agent_model"})
OMNIGENT_DISPATCH_TOOL_NAMES = frozenset({"sys_session_send"})


def normalize_omnigent_trace_events(items: Sequence[Mapping[str, Any]]) -> dict[str, Any]:
    """Extract redacted selection/dispatch events from Omnigent history items.

    Supported inputs are intentionally broad and JSON-like:

    - persisted Omnigent conversation API items with ``type=function_call`` and
      ``type=function_call_output``;
    - already-flattened tool records containing ``name`` and ``arguments``;
    - generic assistant blocks with ``tool_calls`` entries.

    The function returns only redaction-safe fields required by
    ``verify_selection_dispatch_trace``. It does not preserve raw prompts,
    full tool arguments, or full tool outputs.
    """

    events: list[dict[str, Any]] = []
    warnings: list[dict[str, Any]] = []
    calls_by_id: dict[str, dict[str, Any]] = {}

    for index, item in enumerate(items):
        for call in _iter_tool_calls(item):
            name = _safe_str(call.get("name"))
            call_id = _safe_str(call.get("call_id") or call.get("id"))
            arguments = _coerce_json_object(call.get("arguments") or call.get("args"))
            if name is None:
                warnings.append(_warning("tool_call_missing_name", index=index))
                continue
            if call_id is not None:
                calls_by_id[call_id] = {"name": name, "arguments": arguments, "source_ref": _source_ref(item, index)}
            if name in OMNIGENT_DISPATCH_TOOL_NAMES:
                dispatch = _dispatch_event_from_args(arguments, source_ref=_source_ref(item, index))
                if dispatch is None:
                    warnings.append(_warning("dispatch_call_missing_task_id", index=index, tool_name=name))
                else:
                    events.append(dispatch)

        output = _function_call_output(item)
        if output is None:
            continue
        call_id, output_text = output
        call = calls_by_id.get(call_id)
        if call is None:
            warnings.append(_warning("tool_output_without_known_call", index=index))
            continue
        if call["name"] not in FLOWDESK_SELECTION_TOOL_NAMES:
            continue
        selection = _selection_event_from_output(output_text, source_ref=call["source_ref"])
        if selection is None:
            warnings.append(_warning("selection_output_not_parseable", index=index, tool_name=call["name"]))
        else:
            events.append(selection)

    return {
        "schema_version": "flowdesk.omnigent_trace_events.v1",
        "events": events,
        "warning_count": len(warnings),
        "warnings": warnings,
        "authority": "trace_normalization_only",
    }


def _iter_tool_calls(item: Mapping[str, Any]) -> list[Mapping[str, Any]]:
    item_type = item.get("type")
    if item_type == "function_call":
        return [item]
    data = item.get("data")
    if isinstance(data, Mapping) and data.get("type") == "function_call":
        return [data]
    if isinstance(data, Mapping) and item_type == "function_call":
        return [data]
    tool_calls = item.get("tool_calls")
    if isinstance(tool_calls, list):
        return [entry for entry in tool_calls if isinstance(entry, Mapping)]
    content = item.get("content")
    if isinstance(content, list):
        calls: list[Mapping[str, Any]] = []
        for block in content:
            if isinstance(block, Mapping):
                nested = block.get("tool_calls")
                if isinstance(nested, list):
                    calls.extend(entry for entry in nested if isinstance(entry, Mapping))
        return calls
    return []


def _function_call_output(item: Mapping[str, Any]) -> tuple[str, str] | None:
    candidate: Mapping[str, Any] | None = item
    data = item.get("data")
    if isinstance(data, Mapping) and (item.get("type") == "function_call_output" or data.get("type") == "function_call_output"):
        candidate = data
    elif item.get("type") != "function_call_output":
        return None
    call_id = _safe_str(candidate.get("call_id") if candidate is not None else None)
    output = candidate.get("output") if candidate is not None else None
    if call_id is None or not isinstance(output, str):
        return None
    return call_id, output


def _selection_event_from_output(output_text: str, *, source_ref: str) -> dict[str, Any] | None:
    payload = _coerce_json_object(output_text)
    if not payload:
        return None
    if isinstance(payload.get("result"), Mapping):
        payload = dict(payload["result"])
    if payload.get("schema_version") != "flowdesk.omnigent_selection.v1":
        return None
    task_id = _safe_str(payload.get("task_id"))
    if task_id is None:
        return None
    return {
        "type": "selection",
        "task_id": task_id,
        "selection_id": payload.get("selection_id"),
        "selection_status": payload.get("selection_status"),
        "agent": payload.get("agent"),
        "harness": payload.get("harness"),
        "model": payload.get("model"),
        "source_ref": source_ref,
    }


def _dispatch_event_from_args(args: Mapping[str, Any], *, source_ref: str) -> dict[str, Any] | None:
    nested_args = args.get("args")
    if not isinstance(nested_args, Mapping):
        nested_args = {}
    task_id = _safe_str(args.get("task_id") or nested_args.get("task_id") or args.get("title"))
    if task_id is None:
        return None
    return {
        "type": "dispatch",
        "task_id": task_id,
        "agent": args.get("agent"),
        "harness": nested_args.get("harness") or args.get("harness"),
        "model": nested_args.get("model") if "model" in nested_args else args.get("model"),
        "source_ref": source_ref,
    }


def _coerce_json_object(value: Any) -> dict[str, Any]:
    if isinstance(value, Mapping):
        return dict(value)
    if not isinstance(value, str) or not value.strip():
        return {}
    try:
        parsed = json.loads(value)
    except json.JSONDecodeError:
        return {}
    return dict(parsed) if isinstance(parsed, Mapping) else {}


def _safe_str(value: Any) -> str | None:
    return value if isinstance(value, str) and value else None


def _source_ref(item: Mapping[str, Any], index: int) -> str:
    item_id = _safe_str(item.get("id"))
    if item_id is not None:
        return f"item:{item_id}"
    return f"index:{index}"


def _warning(code: str, **details: Any) -> dict[str, Any]:
    return {"severity": "warning", "code": code, **details}
