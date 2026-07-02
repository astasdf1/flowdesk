"""Post-run consistency verifier for FlowDesk Omnigent selection traces."""

from __future__ import annotations

from typing import Any, Literal, Mapping, Sequence

from .policies import DEFAULT_AGENT_HARNESS_BINDINGS
from .selection import agent_allowed_bindings

TRACE_VERIFIER_SCHEMA_VERSION = "flowdesk.omnigent_trace_verification.v1"

TraceEventType = Literal["selection", "dispatch"]
TraceIssueSeverity = Literal["error", "warning"]


def verify_selection_dispatch_trace(events: Sequence[Mapping[str, Any]]) -> dict[str, Any]:
    """Verify that dispatch events follow prior FlowDesk selection events.

    The verifier intentionally consumes normalized events instead of reading a
    sidecar log. A later adapter can derive these events from Omnigent
    transcript/tool-call history, then call this pure function.
    """

    issues: list[dict[str, Any]] = []
    selections: dict[str, Mapping[str, Any]] = {}
    dispatches_by_task: dict[str, list[Mapping[str, Any]]] = {}

    for index, event in enumerate(events):
        event_type = event.get("type")
        if event_type == "selection":
            task_id = _safe_str(event.get("task_id"))
            if task_id is None:
                issues.append(_issue("error", "selection_missing_task_id", index=index))
                continue
            if task_id in selections:
                issues.append(_issue("error", "duplicate_selection_for_task", index=index, task_id=task_id))
                continue
            selections[task_id] = event
        elif event_type == "dispatch":
            task_id = _safe_str(event.get("task_id"))
            if task_id is None:
                issues.append(_issue("error", "dispatch_missing_task_id", index=index))
                continue
            dispatches_by_task.setdefault(task_id, []).append(event)
            _verify_dispatch(index=index, dispatch=event, selections=selections, issues=issues)
        else:
            issues.append(_issue("warning", "unknown_event_type_ignored", index=index))

    for task_id, selection in selections.items():
        status = selection.get("selection_status")
        dispatches = dispatches_by_task.get(task_id, [])
        if status in {"blocked", "non_dispatchable"} and dispatches:
            issues.append(
                _issue(
                    "error",
                    "blocked_or_non_dispatchable_task_was_dispatched",
                    task_id=task_id,
                    selection_status=status,
                )
            )

    error_count = sum(1 for issue in issues if issue["severity"] == "error")
    warning_count = sum(1 for issue in issues if issue["severity"] == "warning")
    return {
        "schema_version": TRACE_VERIFIER_SCHEMA_VERSION,
        "status": "pass" if error_count == 0 else "fail",
        "selection_count": len(selections),
        "dispatch_count": sum(len(values) for values in dispatches_by_task.values()),
        "error_count": error_count,
        "warning_count": warning_count,
        "issues": issues,
        "authority": "verification_only",
    }


def _verify_dispatch(
    *,
    index: int,
    dispatch: Mapping[str, Any],
    selections: Mapping[str, Mapping[str, Any]],
    issues: list[dict[str, Any]],
) -> None:
    task_id = _safe_str(dispatch.get("task_id"))
    if task_id is None:
        return
    selection = selections.get(task_id)
    if selection is None:
        issues.append(_issue("error", "dispatch_without_prior_selection", index=index, task_id=task_id))
        return

    status = selection.get("selection_status")
    if status != "selected":
        issues.append(
            _issue(
                "error",
                "dispatch_selection_not_selected",
                index=index,
                task_id=task_id,
                selection_status=status,
            )
        )
        return

    selected_agent = _safe_str(selection.get("agent"))
    dispatched_agent = _safe_str(dispatch.get("agent"))
    if selected_agent != dispatched_agent:
        issues.append(
            _issue(
                "error",
                "dispatch_agent_mismatch",
                index=index,
                task_id=task_id,
                selected_agent=selected_agent,
                dispatched_agent=dispatched_agent,
            )
        )

    # Guard-parity (omnigent_selection_dispatch_guard): the harness is coupled to the
    # model's provider family. Validate the dispatched (family, harness) pair for
    # internal consistency and membership in the agent's registry-allowed pairs, rather
    # than tying to the recorded selection's specific model/family. This lets an agent
    # switch across the families it supports when model and harness move together, and
    # keeps a stale/mismatched harness or an unsupported family failing closed.
    dispatched_model = dispatch.get("model")
    dispatched_harness = _safe_str(dispatch.get("harness"))
    effective_harness = dispatched_harness or DEFAULT_AGENT_HARNESS_BINDINGS.get(dispatched_agent or "")
    if isinstance(dispatched_model, str) and dispatched_model:
        model_family = _provider_family_for_model(dispatched_model)
        if model_family is None:
            issues.append(_issue("error", "dispatch_model_family_unresolved", index=index, task_id=task_id, dispatched_model=dispatched_model))
            return
        if _provider_family_for_harness(effective_harness) != model_family:
            issues.append(_issue("error", "dispatch_harness_model_family_mismatch", index=index, task_id=task_id, dispatched_model=dispatched_model))
            return
        dispatch_family: str | None = model_family
    else:
        dispatch_family = _provider_family_for_harness(effective_harness)
    allowed = agent_allowed_bindings().get(dispatched_agent or "")
    if allowed is not None:
        if not isinstance(effective_harness, str) or dispatch_family is None:
            issues.append(_issue("error", "dispatch_binding_unresolved", index=index, task_id=task_id))
        elif (dispatch_family, effective_harness) not in allowed:
            issues.append(_issue("error", "dispatch_binding_not_registered", index=index, task_id=task_id, dispatched_model=dispatched_model))


def _safe_str(value: Any) -> str | None:
    return value if isinstance(value, str) and value else None


def _issue(severity: TraceIssueSeverity, code: str, **details: Any) -> dict[str, Any]:
    return {"severity": severity, "code": code, **details}


def _provider_family_for_model(model: str | None) -> str | None:
    if model is None:
        return None
    if model.startswith(("claude/", "anthropic/", "claude-")):
        return "claude"
    if model.startswith("openai/"):
        return "openai"
    if model.startswith(("gemini/", "google/", "gemini-")):
        return "gemini"
    return None


def _provider_family_for_harness(harness: str | None) -> str | None:
    if harness in {"claude-native", "claude-sdk"}:
        return "claude"
    if harness == "codex":
        return "openai"
    if harness == "antigravity-native":
        return "gemini"
    return None
