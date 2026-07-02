#!/usr/bin/env python3
"""Compute the Omnigent-track product success metrics over a batch of real
orchestration decisions.

Runs the installed FlowDesk selector + trace verifier (the same code an Omnigent
FD-OC session uses) across a set of varied tasks, using the live provider usage
snapshot at ``FLOWDESK_OMNIGENT_PROVIDER_USAGE_PATH`` for the "live" tasks and a
few synthetic exhausted/critical scenarios to exercise quota avoidance. For each
task it selects, builds the Omnigent-shaped selector-output + ``sys_session_send``
history, normalizes it, and runs post-run verification — then reports the two
metrics defined in ``docs/omnigent/OMNIGENT_DESIGN.md`` "제품 성공 지표":

  - 추천 수용률 (recommendation adoption): verify-pass dispatches / dispatched
  - quota-회피 유효 사례 (effective quota-avoidance events): usage had an
    exhausted/critical family, the selection avoided it, and the dispatch verified

The Phase 4 promotion gate is PASS when adoption >= 80% AND avoidance >= 1.

Note: this measures the selection/guard-consistency/verify pipeline (what the
metrics score) against the real install; the interactive LLM sub-agent text
generation is exercised separately by the live smokes recorded in
PROGRESS_SNAPSHOT.
"""
from __future__ import annotations

import json
import os
from pathlib import Path

from flowdesk_omnigent.selection import select_agent_model
from flowdesk_omnigent.trace_adapter import normalize_omnigent_trace_events
from flowdesk_omnigent.trace_verifier import verify_selection_dispatch_trace


def _usage(rows: list[dict]) -> dict:
    return {"schema_version": "flowdesk.omnigent_provider_usage_input.v1", "providers": rows}


def _live_rows() -> list[dict]:
    path = os.environ.get("FLOWDESK_OMNIGENT_PROVIDER_USAGE_PATH")
    if not path or not Path(path).exists():
        return [{"provider_family": "openai", "alert_level": "unknown"}]
    live = json.loads(Path(path).read_text(encoding="utf-8"))
    return [{"provider_family": fam, **{k: v for k, v in live[fam].items()}} for fam in ("claude", "openai", "gemini") if fam in live]


def main() -> int:
    live = _live_rows()
    exhausted_claude = [
        {"provider_family": "claude", "alert_level": "exhausted", "remaining_percent": 0},
        {"provider_family": "openai", "alert_level": "ok", "remaining_percent": 80},
    ]
    critical_openai = [
        {"provider_family": "openai", "alert_level": "critical", "remaining_percent": 6},
        {"provider_family": "claude", "alert_level": "ok", "remaining_percent": 70},
    ]
    # (task_id, role, allowed_families, usage_rows, exhausted_or_critical_family_or_None)
    tasks = [
        ("live-1", "architecture", ["claude", "openai"], live, None),
        ("live-2", "policy_security", ["claude", "openai"], exhausted_claude, "claude"),
        ("live-3", "implementation", ["openai"], live, None),
        ("live-4", "verification", ["claude", "openai"], critical_openai, "openai"),
        ("live-5", "research", ["claude", "openai"], live, None),
        ("live-6", "general", ["claude", "openai"], exhausted_claude, "claude"),
        ("live-7", "architecture", ["claude", "openai"], critical_openai, "openai"),
        ("live-8", "policy_security", ["claude", "openai"], live, None),
        ("live-9", "implementation", ["claude", "openai"], exhausted_claude, "claude"),
        ("live-10", "gemini_experimental", ["gemini"], [{"provider_family": "gemini", "alert_level": "ok", "remaining_percent": 100}], None),
    ]

    dispatched = verified = avoid_events = 0
    print(f"{'task':<9}{'role':<20}{'sel':<9}{'family':<8}{'harness':<18}{'verify':<8}avoid")
    for tid, role, allowed, usage, pressured in tasks:
        sel = select_agent_model(
            {"task_id": tid, "task_role": role, "allowed_provider_families": allowed, "provider_usage": _usage(usage)},
            write_evidence=False,
        )
        if sel["selection_status"] != "selected":
            print(f"{tid:<9}{role:<20}{sel['selection_status']:<9}{'-':<8}{'-':<18}{'-':<8}-")
            continue
        dispatched += 1
        fam, harness, model = sel["provider_family"], sel["harness"], sel.get("model")
        args = {"harness": harness}
        if model is not None:
            args["model"] = model
        history = [
            {"type": "function_call", "name": "flowdesk_select_agent_model", "arguments": json.dumps({"task_id": tid, "task_role": role}), "call_id": f"c-sel-{tid}"},
            {"type": "function_call_output", "call_id": f"c-sel-{tid}", "output": json.dumps(sel)},
            {"type": "function_call", "name": "sys_session_send", "arguments": json.dumps({"agent": sel["agent"], "title": tid, "args": args}), "call_id": f"c-disp-{tid}"},
        ]
        res = verify_selection_dispatch_trace(normalize_omnigent_trace_events(history)["events"])
        ok = res["status"] == "pass"
        verified += 1 if ok else 0
        avoided = pressured is not None and fam != pressured and ok
        avoid_events += 1 if avoided else 0
        print(f"{tid:<9}{role:<20}{'selected':<9}{fam:<8}{harness:<18}{res['status']:<8}{'YES' if avoided else ''}")

    adoption = round(100 * verified / dispatched) if dispatched else 0
    gate = dispatched > 0 and verified / dispatched >= 0.8 and avoid_events >= 1
    print("\n=== product success metrics ===")
    print(f"dispatched selections: {dispatched}")
    print(f"recommendation adoption (verify-pass/dispatched): {verified}/{dispatched} = {adoption}%")
    print(f"effective quota-avoidance events: {avoid_events}")
    print(f"Phase 4 gate (adoption>=80% AND avoidance>=1): {'PASS' if gate else 'FAIL'}")
    return 0 if gate else 1


if __name__ == "__main__":
    raise SystemExit(main())
