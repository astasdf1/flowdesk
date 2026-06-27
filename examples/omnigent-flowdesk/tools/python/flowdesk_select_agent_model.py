"""FlowDesk advisory selection tool wrapper for Omnigent."""

from __future__ import annotations

from typing import Any

from omnigent_client import tool

from flowdesk_omnigent.selection import select_agent_model


@tool
def flowdesk_select_agent_model(
    task_id: str,
    task_role: str,
    task_description: str,
    allowed_provider_families: list[str] | None = None,
    preferred_provider_family: str | None = None,
    risk_level: str = "medium",
    requires_headless: bool = True,
) -> dict[str, Any]:
    """Select an advisory FlowDesk agent, harness, and model for a subtask."""

    return select_agent_model(
        {
            "task_id": task_id,
            "task_role": task_role,
            "task_description": task_description,
            "allowed_provider_families": allowed_provider_families,
            "preferred_provider_family": preferred_provider_family,
            "risk_level": risk_level,
            "requires_headless": requires_headless,
        }
    )
