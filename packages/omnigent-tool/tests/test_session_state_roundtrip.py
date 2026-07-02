"""Contract test: the dispatch guard's selection provenance persists through the
REAL Omnigent policy engine's session_state, so the transient cache is no longer
load-bearing.

Skipped unless Omnigent is importable (it runs in the pinned-Omnigent contract
CI, where the exact verified version is installed). This is the evidence that
the FunctionPolicy ``state_updates`` persistence gap the guard cache worked
around is closed upstream as of the verified Omnigent version — see
docs/omnigent/OMNIGENT_UPSTREAM_HOOK_REVIEW.md.
"""
from __future__ import annotations

import json
import os
import tempfile
import unittest

try:
    from omnigent.policies.function import _coerce_to_policy_result
    from omnigent.runtime.policies.engine import _apply_one

    _OMNIGENT_AVAILABLE = True
except Exception:  # pragma: no cover - exercised only where omnigent is absent
    _OMNIGENT_AVAILABLE = False

from flowdesk_omnigent.policies import make_omnigent_selection_dispatch_guard
from flowdesk_omnigent.selection import select_agent_model


@unittest.skipUnless(_OMNIGENT_AVAILABLE, "requires an installed Omnigent (pinned contract CI)")
class SessionStateRoundtripTests(unittest.TestCase):
    def test_guard_provenance_persists_via_engine_session_state_without_cache(self) -> None:
        session_ref = "ses-roundtrip"
        with tempfile.TemporaryDirectory() as capture_dir, tempfile.TemporaryDirectory() as clean_dir:
            sel = select_agent_model(
                {"task_id": "rt-1", "task_role": "architecture", "allowed_provider_families": ["claude", "openai"]},
                write_evidence=False,
            )
            self.assertEqual(sel["selection_status"], "selected")

            # A throwaway guard emits the selection state_updates (its cache write
            # is confined to capture_dir and discarded).
            os.environ["FLOWDESK_OMNIGENT_GUARD_CACHE_PATH"] = os.path.join(capture_dir, "cache.json")
            throwaway = make_omnigent_selection_dispatch_guard()
            guard_out = throwaway(
                {"type": "tool_result", "target": "flowdesk_select_agent_model", "data": {"output": json.dumps(sel)}, "session_state": {}, "session_ref": session_ref}
            )
            self.assertEqual(guard_out["result"], "ALLOW")
            self.assertTrue(guard_out.get("state_updates"))

            # REAL Omnigent engine coerces + applies the state_updates into session_state.
            pr = _coerce_to_policy_result(guard_out, spec_name="flowdesk_selection_dispatch_guard")
            self.assertTrue(pr.state_updates, "omnigent coercion dropped state_updates")
            session_state: dict = {}
            for op in pr.state_updates:
                _apply_one(session_state, op)
            self.assertIn("flowdesk_selection_events", session_state)

            # Isolate the dispatch checks from the throwaway's cache write.
            os.environ["FLOWDESK_OMNIGENT_GUARD_CACHE_PATH"] = os.path.join(clean_dir, "cache.json")

            def dispatch(with_state: bool) -> dict:
                args = {"harness": sel["harness"]}
                if sel["model"] is not None:
                    args["model"] = sel["model"]
                return {
                    "type": "tool_call", "target": "sys_session_send",
                    "data": {"name": "sys_session_send", "arguments": {"agent": sel["agent"], "title": "rt-1", "args": args}},
                    "session_state": dict(session_state) if with_state else {}, "session_ref": session_ref,
                }

            # Fresh guard (empty in-memory) + empty cache + engine session_state -> ALLOW.
            allow = make_omnigent_selection_dispatch_guard()(dispatch(with_state=True))
            self.assertEqual(allow["result"], "ALLOW", allow)

            # Control: no session_state + empty cache -> DENY (no provenance anywhere).
            deny = make_omnigent_selection_dispatch_guard()(dispatch(with_state=False))
            self.assertEqual(deny["result"], "DENY", deny)


if __name__ == "__main__":
    unittest.main()
