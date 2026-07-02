from __future__ import annotations

import unittest

from flowdesk_omnigent.trace_verifier import verify_selection_dispatch_trace


class TraceVerifierTests(unittest.TestCase):
    def test_passes_matching_selection_and_dispatch(self) -> None:
        result = verify_selection_dispatch_trace(
            [
                {
                    "type": "selection",
                    "task_id": "task-policy",
                    "selection_status": "selected",
                    "agent": "policy-security-agent",
                    "provider_family": "claude",
                    "model": "claude-opus-4-8",
                    "authority": "advisory_selection_only",
                },
                {
                    "type": "dispatch",
                    "task_id": "task-policy",
                    "agent": "policy-security-agent",
                    "model": "claude-sonnet-4-6",
                },
            ]
        )

        self.assertEqual(result["status"], "pass")
        self.assertEqual(result["error_count"], 0)

    def test_passes_null_model_when_dispatch_omits_override(self) -> None:
        result = verify_selection_dispatch_trace(
            [
                {
                    "type": "selection",
                    "task_id": "task-architecture",
                    "selection_status": "selected",
                    "agent": "architecture-agent",
                    "provider_family": "openai",
                    "model": None,
                },
                {
                    "type": "dispatch",
                    "task_id": "task-architecture",
                    "agent": "architecture-agent",
                },
            ]
        )

        self.assertEqual(result["status"], "pass")

    def test_passes_gemini_selection_when_family_is_inferred_from_harness(self) -> None:
        result = verify_selection_dispatch_trace(
            [
                {
                    "type": "selection",
                    "task_id": "task-gemini",
                    "selection_status": "selected",
                    "agent": "gemini-agent",
                    "harness": "antigravity-native",
                    "authority": "advisory_selection_only",
                },
                {
                    "type": "dispatch",
                    "task_id": "task-gemini",
                    "agent": "gemini-agent",
                    "harness": "antigravity-native",
                },
            ]
        )

        self.assertEqual(result["status"], "pass")

    def test_fails_dispatch_without_prior_selection(self) -> None:
        result = verify_selection_dispatch_trace(
            [
                {
                    "type": "dispatch",
                    "task_id": "task-unselected",
                    "agent": "architecture-agent",
                }
            ]
        )

        self.assertEqual(result["status"], "fail")
        self.assertEqual(result["issues"][0]["code"], "dispatch_without_prior_selection")

    def test_fails_agent_mismatch(self) -> None:
        result = verify_selection_dispatch_trace(
            [
                {
                    "type": "selection",
                    "task_id": "task-x",
                    "selection_status": "selected",
                    "agent": "architecture-agent",
                    "provider_family": "openai",
                    "model": None,
                },
                {
                    "type": "dispatch",
                    "task_id": "task-x",
                    "agent": "policy-security-agent",
                },
            ]
        )

        self.assertEqual(result["status"], "fail")
        self.assertEqual(result["issues"][0]["code"], "dispatch_agent_mismatch")

    def test_fails_cross_family_model_override_without_matching_harness(self) -> None:
        # Model switched to openai but harness left as claude-native -> the dispatched
        # (family, harness) pair is inconsistent -> fail (guard parity).
        result = verify_selection_dispatch_trace(
            [
                {
                    "type": "selection",
                    "task_id": "task-y",
                    "selection_status": "selected",
                    "agent": "policy-security-agent",
                    "provider_family": "claude",
                    "model": "claude-opus-4-8",
                },
                {
                    "type": "dispatch",
                    "task_id": "task-y",
                    "agent": "policy-security-agent",
                    "model": "openai/gpt-5.5",
                    "harness": "claude-native",
                },
            ]
        )

        self.assertEqual(result["status"], "fail")
        self.assertEqual(result["issues"][0]["code"], "dispatch_harness_model_family_mismatch")

    def test_allows_cross_family_override_when_harness_changed_together(self) -> None:
        # Model AND harness switched together to (openai, codex), a registered binding
        # for policy-security-agent -> allowed even though the selection was claude.
        result = verify_selection_dispatch_trace(
            [
                {
                    "type": "selection",
                    "task_id": "task-y2",
                    "selection_status": "selected",
                    "agent": "policy-security-agent",
                    "provider_family": "claude",
                    "model": "claude-opus-4-8",
                },
                {
                    "type": "dispatch",
                    "task_id": "task-y2",
                    "agent": "policy-security-agent",
                    "model": "openai/gpt-5.5",
                    "harness": "codex",
                },
            ]
        )

        self.assertEqual(result["status"], "pass")

    def test_fails_family_outside_agent_registry(self) -> None:
        # gemini+antigravity is internally consistent but architecture-agent has no
        # gemini binding in the registry -> fail.
        result = verify_selection_dispatch_trace(
            [
                {
                    "type": "selection",
                    "task_id": "task-y3",
                    "selection_status": "selected",
                    "agent": "architecture-agent",
                    "provider_family": "openai",
                    "model": None,
                },
                {
                    "type": "dispatch",
                    "task_id": "task-y3",
                    "agent": "architecture-agent",
                    "model": "google/gemini-3.1-flash-lite",
                    "harness": "antigravity-native",
                },
            ]
        )

        self.assertEqual(result["status"], "fail")
        self.assertEqual(result["issues"][0]["code"], "dispatch_binding_not_registered")

    def test_allows_same_family_model_override_when_selection_keeps_family(self) -> None:
        result = verify_selection_dispatch_trace(
            [
                {
                    "type": "selection",
                    "task_id": "task-z",
                    "selection_status": "selected",
                    "agent": "verification-agent",
                    "provider_family": "openai",
                    "model": None,
                },
                {
                    "type": "dispatch",
                    "task_id": "task-z",
                    "agent": "verification-agent",
                    "model": "openai/gpt-5.5",
                },
            ]
        )

        self.assertEqual(result["status"], "pass")

    def test_fails_blocked_selection_dispatch(self) -> None:
        result = verify_selection_dispatch_trace(
            [
                {
                    "type": "selection",
                    "task_id": "task-blocked",
                    "selection_status": "blocked",
                    "blocked_labels": ["unknown_role"],
                },
                {
                    "type": "dispatch",
                    "task_id": "task-blocked",
                    "agent": "architecture-agent",
                },
            ]
        )

        self.assertEqual(result["status"], "fail")
        codes = [issue["code"] for issue in result["issues"]]
        self.assertIn("dispatch_selection_not_selected", codes)
        self.assertIn("blocked_or_non_dispatchable_task_was_dispatched", codes)


if __name__ == "__main__":
    unittest.main()
