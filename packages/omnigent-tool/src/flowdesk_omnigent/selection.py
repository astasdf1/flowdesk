"""Advisory FlowDesk agent/model selection for Omnigent.

This module intentionally does not import or call Omnigent orchestration tools.
It returns advisory binding data only.
"""

from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime, timedelta, timezone
import json
import os
from pathlib import Path
import subprocess
from typing import Any, Literal, Mapping, Sequence
from uuid import uuid4

SCHEMA_VERSION = "flowdesk.omnigent_selection.v1"
LOG_SCHEMA_VERSION = "flowdesk.omnigent_selection_debug_log.v1"
AUTHORITY = "advisory_selection_only"
PROVIDER_USAGE_JSON_ENV = "FLOWDESK_OMNIGENT_PROVIDER_USAGE_JSON"
PROVIDER_USAGE_PATH_ENV = "FLOWDESK_OMNIGENT_PROVIDER_USAGE_PATH"
PROVIDER_USAGE_MAX_BYTES = 64 * 1024
FORBIDDEN_PROVIDER_USAGE_KEYS = {"authorization", "cookie", "credential", "credentials", "secret", "token"}

SelectionStatus = Literal["selected", "blocked", "non_dispatchable"]
ProviderFamily = Literal["claude", "openai", "gemini"]

ROLE_VALUES = {
    "policy_security",
    "architecture",
    "implementation",
    "verification",
    "research",
    "general",
    "gemini_experimental",
}

REASON_CODES = {
    "role_policy_security_prefers_deep_reasoning",
    "role_architecture_prefers_frontier_reasoning",
    "role_implementation_prefers_coding_harness",
    "role_verification_prefers_cost_controlled_model",
    "role_research_prefers_sonnet_context",
    "role_general_prefers_balanced_model",
    "headless_subscription_verified",
    "quota_unknown_used_as_non_blocking_mvp_default",
    "subscription_harness_default_model",
    "gemini_oauth_refresh_unstable",
    "model_family_compatible",
    "model_family_mismatch_blocked",
    "provider_not_allowed",
    "agent_not_available",
    "task_tier_prefers_reasoning_model",
    "provider_usage_unavailable",
    "unknown_role_blocked",
    "malformed_request_blocked",
    "ts_cli_unavailable_blocked",
    "ts_cli_invalid_response_blocked",
}

PROVIDER_BY_HARNESS: Mapping[str, ProviderFamily] = {
    "claude-sdk": "claude",
    "codex": "openai",
    "antigravity-native": "gemini",
}

MODEL_PREFIXES: Mapping[ProviderFamily, tuple[str, ...]] = {
    "claude": ("anthropic/", "claude/", "claude-"),
    "openai": ("openai/",),
    "gemini": ("google/", "gemini/"),
}


@dataclass(frozen=True)
class RegistryEntry:
    agent: str
    harness: str
    model: str | None
    provider_family: ProviderFamily
    reason_code: str
    confidence: Literal["high", "medium", "low"] = "high"


DEFAULT_REGISTRY: Mapping[str, tuple[RegistryEntry, ...]] = {
    "policy_security": (
        RegistryEntry(
            agent="policy-security-agent",
            harness="claude-sdk",
            model="claude-opus-4-8",
            provider_family="claude",
            reason_code="role_policy_security_prefers_deep_reasoning",
        ),
        RegistryEntry(
            agent="policy-security-agent",
            harness="codex",
            model=None,
            provider_family="openai",
            reason_code="role_policy_security_prefers_deep_reasoning",
            confidence="medium",
        ),
    ),
    "architecture": (
        RegistryEntry(
            agent="architecture-agent",
            harness="codex",
            model=None,
            provider_family="openai",
            reason_code="role_architecture_prefers_frontier_reasoning",
        ),
        RegistryEntry(
            agent="architecture-agent",
            harness="claude-sdk",
            model="claude-sonnet-4-6",
            provider_family="claude",
            reason_code="role_architecture_prefers_frontier_reasoning",
            confidence="medium",
        ),
    ),
    "implementation": (
        RegistryEntry(
            agent="implementation-agent",
            harness="codex",
            model=None,
            provider_family="openai",
            reason_code="role_implementation_prefers_coding_harness",
        ),
        RegistryEntry(
            agent="implementation-agent",
            harness="claude-sdk",
            model="claude-sonnet-4-6",
            provider_family="claude",
            reason_code="role_implementation_prefers_coding_harness",
            confidence="medium",
        ),
    ),
    "verification": (
        RegistryEntry(
            agent="verification-agent",
            harness="codex",
            model=None,
            provider_family="openai",
            reason_code="role_verification_prefers_cost_controlled_model",
        ),
        RegistryEntry(
            agent="verification-agent",
            harness="claude-sdk",
            model="claude-haiku-4-5",
            provider_family="claude",
            reason_code="role_verification_prefers_cost_controlled_model",
            confidence="medium",
        ),
    ),
    "research": (
        RegistryEntry(
            agent="research-agent",
            harness="claude-sdk",
            model="claude-sonnet-4-6",
            provider_family="claude",
            reason_code="role_research_prefers_sonnet_context",
        ),
        RegistryEntry(
            agent="research-agent",
            harness="codex",
            model=None,
            provider_family="openai",
            reason_code="role_research_prefers_sonnet_context",
            confidence="medium",
        ),
    ),
    "general": (
        RegistryEntry(
            agent="general-agent",
            harness="codex",
            model=None,
            provider_family="openai",
            reason_code="role_general_prefers_balanced_model",
            confidence="medium",
        ),
        RegistryEntry(
            agent="general-agent",
            harness="claude-sdk",
            model="claude-sonnet-4-6",
            provider_family="claude",
            reason_code="role_general_prefers_balanced_model",
            confidence="medium",
        ),
    ),
}


def select_agent_model(
    request: Mapping[str, Any] | None = None,
    *,
    registry: Mapping[str, tuple[RegistryEntry, ...]] | None = None,
    write_evidence: bool = False,
    **kwargs: Any,
) -> dict[str, Any]:
    """Return an advisory Omnigent agent/model binding.

    Omnigent function tools may pass either one request object or keyword
    arguments. Supporting both keeps the boundary tolerant without widening the
    output authority.
    """

    now = _utc_now()
    if request is None:
        request = kwargs
    elif kwargs:
        merged = dict(request)
        merged.update(kwargs)
        request = merged

    if not isinstance(request, Mapping):
        result = _blocked_response(
            task_id="task-unknown",
            reason_codes=["malformed_request_blocked"],
            blocked_labels=["malformed_request"],
            now=now,
        )
        _write_evidence_if_enabled(result, write_evidence)
        return result

    request = _request_with_default_provider_usage(request)

    if request.get("engine") == "ts_cli":
        result = _select_via_ts_cli(request, now=now)
        _write_evidence_if_enabled(result, write_evidence)
        return result

    task_id = _safe_task_id(request.get("task_id"))
    role = request.get("task_role")
    if not isinstance(role, str) or role not in ROLE_VALUES:
        result = _blocked_response(
            task_id=task_id,
            reason_codes=["unknown_role_blocked"],
            blocked_labels=["unknown_role"],
            now=now,
        )
        _write_evidence_if_enabled(result, write_evidence)
        return result

    if role == "gemini_experimental":
        result = _non_dispatchable_response(
            task_id=task_id,
            role=role,
            reason_codes=["gemini_oauth_refresh_unstable"],
            blocked_labels=["gemini_oauth_refresh_unstable"],
            now=now,
        )
        _write_evidence_if_enabled(result, write_evidence)
        return result

    allowed_provider_families = _allowed_provider_families(request)
    available_agents = _available_agents(request)
    entries = (registry or DEFAULT_REGISTRY).get(role, ())

    agent_unavailable = False
    provider_usage_blocked = False
    tier_reason = _task_tier_reason_code(request)
    for entry in _ordered_entries_for_task(request, entries):
        if available_agents is not None and entry.agent not in available_agents:
            agent_unavailable = True
            continue
        if entry.provider_family not in allowed_provider_families:
            continue
        if not _provider_usage_allows(request, entry.provider_family):
            provider_usage_blocked = True
            continue
        compatibility_error = _entry_compatibility_error(entry)
        if compatibility_error is not None:
            result = _blocked_response(
                task_id=task_id,
                role=role,
                reason_codes=[compatibility_error],
                blocked_labels=[compatibility_error],
                now=now,
            )
            _write_evidence_if_enabled(result, write_evidence)
            return result

        result = _selected_response(task_id=task_id, role=role, entry=entry, now=now, extra_reason_codes=[tier_reason] if tier_reason else [])
        _write_evidence_if_enabled(result, write_evidence)
        return result

    if provider_usage_blocked:
        blocked_reason = "provider_usage_unavailable"
    elif agent_unavailable:
        blocked_reason = "agent_not_available"
    else:
        blocked_reason = "provider_not_allowed"
    result = _blocked_response(
        task_id=task_id,
        role=role,
        reason_codes=[blocked_reason],
        blocked_labels=[blocked_reason],
        now=now,
    )
    _write_evidence_if_enabled(result, write_evidence)
    return result


def flowdesk_select_agent_model(*args: Any, **kwargs: Any) -> dict[str, Any]:
    """Compatibility alias for docs and Omnigent config sketches."""

    if args:
        if len(args) != 1:
            return select_agent_model({"task_id": "task-unknown"}, **kwargs)
        return select_agent_model(args[0], **kwargs)
    return select_agent_model(**kwargs)


def _selected_response(*, task_id: str, role: str, entry: RegistryEntry, now: datetime, extra_reason_codes: Sequence[str] = ()) -> dict[str, Any]:
    return {
        "schema_version": SCHEMA_VERSION,
        "selection_id": _selection_id(),
        "task_id": task_id,
        "task_role": role,
        "selection_status": "selected",
        "agent": entry.agent,
        "harness": entry.harness,
        "model": entry.model,
        "provider_family": entry.provider_family,
        "confidence": entry.confidence,
        "reason_codes": _clean_reason_codes(
            [
                entry.reason_code,
                *extra_reason_codes,
                "headless_subscription_verified",
                "quota_unknown_used_as_non_blocking_mvp_default",
                "subscription_harness_default_model" if entry.model is None else "model_family_compatible",
            ]
        ),
        "blocked_labels": [],
        "authority": AUTHORITY,
        "created_at": _iso(now),
        "expires_at": _iso(now + timedelta(minutes=10)),
    }


def _blocked_response(
    *,
    task_id: str,
    reason_codes: Sequence[str],
    blocked_labels: Sequence[str],
    now: datetime,
    role: str | None = None,
) -> dict[str, Any]:
    return _negative_response(
        task_id=task_id,
        role=role,
        status="blocked",
        reason_codes=reason_codes,
        blocked_labels=blocked_labels,
        now=now,
    )


def _non_dispatchable_response(
    *,
    task_id: str,
    role: str,
    reason_codes: Sequence[str],
    blocked_labels: Sequence[str],
    now: datetime,
) -> dict[str, Any]:
    return _negative_response(
        task_id=task_id,
        role=role,
        status="non_dispatchable",
        reason_codes=reason_codes,
        blocked_labels=blocked_labels,
        now=now,
    )


def _negative_response(
    *,
    task_id: str,
    role: str | None,
    status: SelectionStatus,
    reason_codes: Sequence[str],
    blocked_labels: Sequence[str],
    now: datetime,
) -> dict[str, Any]:
    return {
        "schema_version": SCHEMA_VERSION,
        "selection_id": _selection_id(),
        "task_id": task_id,
        "task_role": role or "unknown",
        "selection_status": status,
        "confidence": "low",
        "reason_codes": _clean_reason_codes(reason_codes),
        "blocked_labels": _safe_labels(blocked_labels),
        "authority": AUTHORITY,
        "created_at": _iso(now),
        "expires_at": _iso(now + timedelta(minutes=10)),
    }


def _entry_compatibility_error(entry: RegistryEntry) -> str | None:
    expected_provider = PROVIDER_BY_HARNESS.get(entry.harness)
    if expected_provider != entry.provider_family:
        return "model_family_mismatch_blocked"
    if entry.model is None:
        return None
    prefixes = MODEL_PREFIXES.get(entry.provider_family, ())
    if not entry.model.startswith(prefixes):
        return "model_family_mismatch_blocked"
    if entry.reason_code not in REASON_CODES:
        return "model_family_mismatch_blocked"
    return None


def _select_via_ts_cli(request: Mapping[str, Any], *, now: datetime) -> dict[str, Any]:
    task_id = _safe_task_id(request.get("task_id"))
    cli_path = _ts_cli_path(request)
    if cli_path is None:
        return _blocked_response(
            task_id=task_id,
            role=request.get("task_role") if isinstance(request.get("task_role"), str) else None,
            reason_codes=["ts_cli_unavailable_blocked"],
            blocked_labels=["ts_cli_unavailable"],
            now=now,
        )
    payload = dict(request)
    payload.pop("engine", None)
    payload.pop("ts_cli_path", None)
    try:
        completed = subprocess.run(
            ["node", str(cli_path)],
            input=json.dumps(payload, ensure_ascii=True, separators=(",", ":")),
            text=True,
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
            timeout=5,
            check=False,
            env=_safe_subprocess_env(),
        )
    except (OSError, subprocess.SubprocessError):
        return _blocked_response(
            task_id=task_id,
            role=request.get("task_role") if isinstance(request.get("task_role"), str) else None,
            reason_codes=["ts_cli_unavailable_blocked"],
            blocked_labels=["ts_cli_unavailable"],
            now=now,
        )
    if completed.returncode != 0:
        return _blocked_response(
            task_id=task_id,
            role=request.get("task_role") if isinstance(request.get("task_role"), str) else None,
            reason_codes=["ts_cli_unavailable_blocked"],
            blocked_labels=["ts_cli_unavailable"],
            now=now,
        )
    try:
        result = json.loads(completed.stdout)
    except json.JSONDecodeError:
        return _blocked_response(
            task_id=task_id,
            role=request.get("task_role") if isinstance(request.get("task_role"), str) else None,
            reason_codes=["ts_cli_invalid_response_blocked"],
            blocked_labels=["ts_cli_invalid_response"],
            now=now,
        )
    if not _valid_selection_response(result):
        return _blocked_response(
            task_id=task_id,
            role=request.get("task_role") if isinstance(request.get("task_role"), str) else None,
            reason_codes=["ts_cli_invalid_response_blocked"],
            blocked_labels=["ts_cli_invalid_response"],
            now=now,
        )
    return result


def _ts_cli_path(request: Mapping[str, Any]) -> Path | None:
    raw = request.get("ts_cli_path") or os.environ.get("FLOWDESK_OMNIGENT_TS_CLI_PATH")
    if isinstance(raw, str) and raw:
        candidate = Path(raw)
        return candidate if candidate.exists() and candidate.is_file() else None
    for base in [Path.cwd(), *Path.cwd().parents]:
        candidate = base / "packages" / "core" / "dist" / "omnigent-selection-cli.js"
        if candidate.exists() and candidate.is_file():
            return candidate
    return None


def _safe_subprocess_env() -> dict[str, str]:
    keep = {"PATH", "HOME", "USER", "TMPDIR", "TMP", "TEMP", "SHELL", "NODE_PATH"}
    safe: dict[str, str] = {}
    for key, value in os.environ.items():
        upper = key.upper()
        if key in keep or upper.startswith("LC_") or upper == "LANG":
            safe[key] = value
    return safe


def _valid_selection_response(value: Any) -> bool:
    if not isinstance(value, Mapping):
        return False
    if value.get("schema_version") != SCHEMA_VERSION:
        return False
    if value.get("authority") != AUTHORITY:
        return False
    if value.get("selection_status") not in {"selected", "blocked", "non_dispatchable"}:
        return False
    if not isinstance(value.get("task_id"), str):
        return False
    if not isinstance(value.get("selection_id"), str):
        return False
    if not isinstance(value.get("reason_codes"), list):
        return False
    if not isinstance(value.get("blocked_labels"), list):
        return False
    if value.get("selection_status") == "selected":
        return isinstance(value.get("agent"), str) and isinstance(value.get("harness"), str)
    return True


def _allowed_provider_families(request: Mapping[str, Any]) -> set[ProviderFamily]:
    raw = request.get("allowed_provider_families")
    if raw is None:
        return {"claude", "openai"}
    if not isinstance(raw, Sequence) or isinstance(raw, (str, bytes)):
        return set()
    allowed: set[ProviderFamily] = set()
    for item in raw:
        if item in {"claude", "openai", "gemini"}:
            allowed.add(item)
    return allowed


def _available_agents(request: Mapping[str, Any]) -> set[str] | None:
    raw = request.get("available_agents") or request.get("allowed_agents")
    if raw is None:
        return None
    if not isinstance(raw, Sequence) or isinstance(raw, (str, bytes)):
        return set()
    return {item for item in raw if isinstance(item, str) and item}


def _ordered_entries_for_task(request: Mapping[str, Any], entries: tuple[RegistryEntry, ...]) -> tuple[RegistryEntry, ...]:
    if _task_tier_reason_code(request) is None:
        return entries
    return tuple(sorted(entries, key=_tier_entry_sort_key))


def _tier_entry_sort_key(entry: RegistryEntry) -> tuple[int, int]:
    reasoning_score = 0 if entry.provider_family == "claude" and entry.model is not None else 1
    confidence_score = {"high": 0, "medium": 1, "low": 2}.get(entry.confidence, 2)
    return (reasoning_score, confidence_score)


def _task_tier_reason_code(request: Mapping[str, Any]) -> str | None:
    complexity = request.get("task_complexity") or request.get("complexity")
    if complexity in {"high", "critical"}:
        return "task_tier_prefers_reasoning_model"
    phase = request.get("task_phase") or request.get("phase")
    if phase in {"high_level_design", "detailed_design", "risk_review"}:
        return "task_tier_prefers_reasoning_model"
    tier = request.get("task_tier") or request.get("tier")
    if tier in {"upper", "senior", "reasoning", "frontier"}:
        return "task_tier_prefers_reasoning_model"
    return None


def _provider_usage_allows(request: Mapping[str, Any], provider_family: ProviderFamily) -> bool:
    snapshot = request.get("provider_usage") or request.get("provider_health")
    if snapshot is None:
        return True
    rows: list[Mapping[str, Any]] = []
    if isinstance(snapshot, Mapping):
        direct = snapshot.get(provider_family)
        if isinstance(direct, Mapping):
            rows.append(direct)
        providers = snapshot.get("providers")
        if isinstance(providers, Sequence) and not isinstance(providers, (str, bytes)):
            rows.extend(row for row in providers if isinstance(row, Mapping) and row.get("provider_family") == provider_family)
    elif isinstance(snapshot, Sequence) and not isinstance(snapshot, (str, bytes)):
        rows.extend(row for row in snapshot if isinstance(row, Mapping) and row.get("provider_family") == provider_family)
    if not rows:
        return True
    return any(_provider_usage_row_allows(row) for row in rows)


def _request_with_default_provider_usage(request: Mapping[str, Any]) -> Mapping[str, Any]:
    if request.get("provider_usage") is not None or request.get("provider_health") is not None:
        return request
    snapshot = _load_default_provider_usage_snapshot()
    if snapshot is None:
        return request
    merged = dict(request)
    merged["provider_usage"] = snapshot
    return merged


def _load_default_provider_usage_snapshot() -> Any | None:
    inline = os.environ.get(PROVIDER_USAGE_JSON_ENV)
    if inline:
        return _parse_provider_usage_snapshot(inline)
    raw_path = os.environ.get(PROVIDER_USAGE_PATH_ENV)
    if not raw_path:
        return None
    try:
        path = Path(raw_path).expanduser()
        if not path.exists() or not path.is_file() or path.stat().st_size > PROVIDER_USAGE_MAX_BYTES:
            return None
        return _parse_provider_usage_snapshot(path.read_text(encoding="utf-8"))
    except (OSError, UnicodeDecodeError):
        return None


def _parse_provider_usage_snapshot(raw: str) -> Any | None:
    if len(raw.encode("utf-8")) > PROVIDER_USAGE_MAX_BYTES:
        return None
    try:
        parsed = json.loads(raw)
    except json.JSONDecodeError:
        return None
    return parsed if _provider_usage_snapshot_is_redaction_safe(parsed) else None


def _provider_usage_snapshot_is_redaction_safe(value: Any, *, depth: int = 0) -> bool:
    if depth > 8:
        return False
    if value is None or isinstance(value, (bool, int, float)):
        return True
    if isinstance(value, str):
        return len(value) <= 500
    if isinstance(value, Sequence) and not isinstance(value, (str, bytes)):
        return len(value) <= 100 and all(_provider_usage_snapshot_is_redaction_safe(item, depth=depth + 1) for item in value)
    if isinstance(value, Mapping):
        if len(value) > 100:
            return False
        for key, item in value.items():
            if not isinstance(key, str) or len(key) > 80:
                return False
            lowered = key.lower()
            if any(forbidden in lowered for forbidden in FORBIDDEN_PROVIDER_USAGE_KEYS):
                return False
            if not _provider_usage_snapshot_is_redaction_safe(item, depth=depth + 1):
                return False
        return True
    return False


def _provider_usage_row_allows(row: Mapping[str, Any]) -> bool:
    if row.get("dispatchable") is False or row.get("non_dispatchable") is True:
        return False
    alert = row.get("alert_level") or row.get("alertLevel") or row.get("status")
    if alert in {"critical", "exhausted", "stale", "non_dispatchable", "blocked", "unavailable"}:
        return False
    remaining = row.get("remaining_percent") if "remaining_percent" in row else row.get("remainingPercent")
    if isinstance(remaining, (int, float)) and remaining <= 0:
        return False
    return True


def _write_evidence_if_enabled(result: Mapping[str, Any], write_evidence: bool) -> None:
    if not write_evidence:
        return
    override = os.environ.get("FLOWDESK_OMNIGENT_SELECTION_LOG_PATH")
    if not override:
        return
    log_path = Path(override)
    log_path.parent.mkdir(parents=True, exist_ok=True)
    record = {
        "schema_version": LOG_SCHEMA_VERSION,
        "selection_id": result.get("selection_id"),
        "task_id": result.get("task_id"),
        "task_role": result.get("task_role"),
        "selection_status": result.get("selection_status"),
        "agent": result.get("agent"),
        "harness": result.get("harness"),
        "model": result.get("model"),
        "provider_family": result.get("provider_family"),
        "reason_codes": result.get("reason_codes", []),
        "blocked_labels": result.get("blocked_labels", []),
        "created_at": result.get("created_at"),
        "expires_at": result.get("expires_at"),
        "authority": AUTHORITY,
    }
    with log_path.open("a", encoding="utf-8") as handle:
        handle.write(json.dumps(record, ensure_ascii=True, sort_keys=True, separators=(",", ":")))
        handle.write("\n")


def _clean_reason_codes(reason_codes: Sequence[str]) -> list[str]:
    cleaned = [code for code in reason_codes if code in REASON_CODES]
    return cleaned or ["malformed_request_blocked"]


def _safe_labels(labels: Sequence[str]) -> list[str]:
    result: list[str] = []
    for label in labels:
        if isinstance(label, str) and 1 <= len(label) <= 80 and label.replace("_", "").isalnum():
            result.append(label)
    return result


def _safe_task_id(value: Any) -> str:
    if isinstance(value, str) and 1 <= len(value) <= 128:
        if all(ch.isalnum() or ch in "-_:." for ch in value):
            return value
    return "task-unknown"


def _selection_id() -> str:
    return f"selection-{uuid4().hex}"


def _utc_now() -> datetime:
    return datetime.now(timezone.utc)


def _iso(value: datetime) -> str:
    return value.isoformat().replace("+00:00", "Z")
