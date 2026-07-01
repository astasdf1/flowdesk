from __future__ import annotations

import json
import os
from pathlib import Path
import tempfile
import unittest
from unittest.mock import patch

from flowdesk_omnigent.selection import DEFAULT_REGISTRY, RegistryEntry, select_agent_model


PARITY_FIXTURE_PATH = Path(__file__).parent / "fixtures" / "omnigent_selection_parity_cases.json"
REGISTRY_ARTIFACT_PATH = Path(__file__).parents[1] / "src" / "flowdesk_omnigent" / "omnigent_selector_registry.v1.json"


class SelectionTests(unittest.TestCase):
    def test_python_registry_matches_shared_registry_artifact(self) -> None:
        artifact = json.loads(REGISTRY_ARTIFACT_PATH.read_text(encoding="utf-8"))
        self.assertEqual(artifact["schema_version"], "flowdesk.omnigent_selector_registry.v1")
        self.assertEqual(artifact["authority"], "advisory_registry_only")
        normalized = {
            role: [
                {
                    "agent": entry.agent,
                    "harness": entry.harness,
                    "model": entry.model,
                    "provider_family": entry.provider_family,
                    "reason_code": entry.reason_code,
                    "confidence": entry.confidence,
                }
                for entry in entries
            ]
            for role, entries in DEFAULT_REGISTRY.items()
        }
        self.assertEqual(artifact["roles"], normalized)

    def test_selection_parity_golden_cases(self) -> None:
        cases = json.loads(PARITY_FIXTURE_PATH.read_text(encoding="utf-8"))
        for case in cases:
            with self.subTest(case=case["name"]):
                result = select_agent_model(case["request"], write_evidence=False)
                expected = case["expected"]
                self.assertEqual(result["schema_version"], "flowdesk.omnigent_selection.v1")
                self.assertEqual(result["authority"], "advisory_selection_only")
                self.assertEqual(result["task_id"], case["request"].get("task_id", "task-unknown"))
                self.assertEqual(result["task_role"], expected["task_role"])
                self.assertEqual(result["selection_status"], expected["selection_status"])
                self.assertEqual(result["confidence"], expected["confidence"])
                for key in ("agent", "harness", "model", "provider_family"):
                    if key in expected:
                        self.assertEqual(result.get(key), expected[key])
                if "blocked_labels" in expected:
                    self.assertEqual(result["blocked_labels"], expected["blocked_labels"])
                for reason_code in expected["reason_codes_include"]:
                    self.assertIn(reason_code, result["reason_codes"])

    def test_policy_security_selects_claude_opus(self) -> None:
        result = select_agent_model(
            {
                "task_id": "task-policy-1",
                "task_role": "policy_security",
                "task_description": "review authority boundary",
                "allowed_provider_families": ["claude", "openai"],
                "requires_headless": True,
            },
            write_evidence=False,
        )

        self.assertEqual(result["schema_version"], "flowdesk.omnigent_selection.v1")
        self.assertEqual(result["selection_status"], "selected")
        self.assertEqual(result["agent"], "policy-security-agent")
        self.assertEqual(result["harness"], "claude-sdk")
        self.assertEqual(result["model"], "claude-opus-4-8")
        self.assertEqual(result["provider_family"], "claude")
        self.assertEqual(result["authority"], "advisory_selection_only")
        self.assertIn("model_family_compatible", result["reason_codes"])

    def test_disallowed_primary_provider_uses_secondary(self) -> None:
        result = select_agent_model(
            {
                "task_id": "task-policy-2",
                "task_role": "policy_security",
                "allowed_provider_families": ["openai"],
            },
            write_evidence=False,
        )

        self.assertEqual(result["selection_status"], "selected")
        self.assertEqual(result["provider_family"], "openai")
        self.assertEqual(result["harness"], "codex")
        self.assertIsNone(result["model"])
        self.assertIn("subscription_harness_default_model", result["reason_codes"])

    def test_usage_snapshot_skips_exhausted_primary_provider(self) -> None:
        result = select_agent_model(
            {
                "task_id": "task-policy-usage",
                "task_role": "policy_security",
                "allowed_provider_families": ["claude", "openai"],
                "provider_usage": {
                    "providers": [
                        {"provider_family": "claude", "alert_level": "exhausted", "remaining_percent": 0},
                        {"provider_family": "openai", "alert_level": "ok", "remaining_percent": 70},
                    ]
                },
            },
            write_evidence=False,
        )

        self.assertEqual(result["selection_status"], "selected")
        self.assertEqual(result["provider_family"], "openai")
        self.assertEqual(result["harness"], "codex")

    def test_usage_snapshot_blocks_when_all_allowed_providers_unavailable(self) -> None:
        result = select_agent_model(
            {
                "task_id": "task-usage-blocked",
                "task_role": "architecture",
                "allowed_provider_families": ["openai"],
                "provider_usage": {"openai": {"alertLevel": "critical", "remainingPercent": 1}},
            },
            write_evidence=False,
        )

        self.assertEqual(result["selection_status"], "blocked")
        self.assertEqual(result["blocked_labels"], ["provider_usage_unavailable"])

    def test_default_provider_usage_json_env_is_injected_when_request_omits_usage(self) -> None:
        old_json = os.environ.get("FLOWDESK_OMNIGENT_PROVIDER_USAGE_JSON")
        old_path = os.environ.get("FLOWDESK_OMNIGENT_PROVIDER_USAGE_PATH")
        os.environ["FLOWDESK_OMNIGENT_PROVIDER_USAGE_JSON"] = json.dumps(
            {
                "providers": [
                    {"provider_family": "claude", "alert_level": "exhausted", "remaining_percent": 0},
                    {"provider_family": "openai", "alert_level": "ok", "remaining_percent": 70},
                ]
            }
        )
        os.environ.pop("FLOWDESK_OMNIGENT_PROVIDER_USAGE_PATH", None)
        try:
            result = select_agent_model(
                {
                    "task_id": "task-usage-env-json",
                    "task_role": "policy_security",
                    "allowed_provider_families": ["claude", "openai"],
                },
                write_evidence=False,
            )
        finally:
            if old_json is None:
                os.environ.pop("FLOWDESK_OMNIGENT_PROVIDER_USAGE_JSON", None)
            else:
                os.environ["FLOWDESK_OMNIGENT_PROVIDER_USAGE_JSON"] = old_json
            if old_path is None:
                os.environ.pop("FLOWDESK_OMNIGENT_PROVIDER_USAGE_PATH", None)
            else:
                os.environ["FLOWDESK_OMNIGENT_PROVIDER_USAGE_PATH"] = old_path

        self.assertEqual(result["selection_status"], "selected")
        self.assertEqual(result["provider_family"], "openai")

    def test_default_provider_usage_path_is_injected_when_request_omits_usage(self) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            path = Path(tmp) / "provider-usage.json"
            path.write_text(
                json.dumps({"openai": {"alertLevel": "critical", "remainingPercent": 1}}),
                encoding="utf-8",
            )
            old_json = os.environ.get("FLOWDESK_OMNIGENT_PROVIDER_USAGE_JSON")
            old_path = os.environ.get("FLOWDESK_OMNIGENT_PROVIDER_USAGE_PATH")
            os.environ.pop("FLOWDESK_OMNIGENT_PROVIDER_USAGE_JSON", None)
            os.environ["FLOWDESK_OMNIGENT_PROVIDER_USAGE_PATH"] = str(path)
            try:
                result = select_agent_model(
                    {
                        "task_id": "task-usage-env-path",
                        "task_role": "architecture",
                        "allowed_provider_families": ["openai"],
                    },
                    write_evidence=False,
                )
            finally:
                if old_json is None:
                    os.environ.pop("FLOWDESK_OMNIGENT_PROVIDER_USAGE_JSON", None)
                else:
                    os.environ["FLOWDESK_OMNIGENT_PROVIDER_USAGE_JSON"] = old_json
                if old_path is None:
                    os.environ.pop("FLOWDESK_OMNIGENT_PROVIDER_USAGE_PATH", None)
                else:
                    os.environ["FLOWDESK_OMNIGENT_PROVIDER_USAGE_PATH"] = old_path

        self.assertEqual(result["selection_status"], "blocked")
        self.assertEqual(result["blocked_labels"], ["provider_usage_unavailable"])

    def test_explicit_provider_usage_overrides_default_provider_usage_env(self) -> None:
        old_json = os.environ.get("FLOWDESK_OMNIGENT_PROVIDER_USAGE_JSON")
        os.environ["FLOWDESK_OMNIGENT_PROVIDER_USAGE_JSON"] = json.dumps({"claude": {"alertLevel": "exhausted", "remainingPercent": 0}})
        try:
            result = select_agent_model(
                {
                    "task_id": "task-usage-explicit-wins",
                    "task_role": "policy_security",
                    "allowed_provider_families": ["claude", "openai"],
                    "provider_usage": {"claude": {"alertLevel": "ok", "remainingPercent": 90}},
                },
                write_evidence=False,
            )
        finally:
            if old_json is None:
                os.environ.pop("FLOWDESK_OMNIGENT_PROVIDER_USAGE_JSON", None)
            else:
                os.environ["FLOWDESK_OMNIGENT_PROVIDER_USAGE_JSON"] = old_json

        self.assertEqual(result["selection_status"], "selected")
        self.assertEqual(result["provider_family"], "claude")

    def test_default_provider_usage_env_rejects_non_allowlisted_keys(self) -> None:
        old_json = os.environ.get("FLOWDESK_OMNIGENT_PROVIDER_USAGE_JSON")
        os.environ["FLOWDESK_OMNIGENT_PROVIDER_USAGE_JSON"] = json.dumps(
            {"providers": [{"provider_family": "claude", "alert_level": "exhausted", "access_token": "SHOULD_NOT_BE_READ"}]}
        )
        try:
            result = select_agent_model(
                {
                    "task_id": "task-usage-unsafe-env",
                    "task_role": "policy_security",
                    "allowed_provider_families": ["claude", "openai"],
                },
                write_evidence=False,
            )
        finally:
            if old_json is None:
                os.environ.pop("FLOWDESK_OMNIGENT_PROVIDER_USAGE_JSON", None)
            else:
                os.environ["FLOWDESK_OMNIGENT_PROVIDER_USAGE_JSON"] = old_json

        self.assertEqual(result["selection_status"], "blocked")
        self.assertEqual(result["blocked_labels"], ["provider_usage_snapshot_rejected"])

    def test_default_provider_usage_env_rejects_malformed_json(self) -> None:
        old_json = os.environ.get("FLOWDESK_OMNIGENT_PROVIDER_USAGE_JSON")
        os.environ["FLOWDESK_OMNIGENT_PROVIDER_USAGE_JSON"] = "{not-json"
        try:
            result = select_agent_model(
                {
                    "task_id": "task-usage-malformed-env",
                    "task_role": "architecture",
                    "allowed_provider_families": ["claude", "openai"],
                },
                write_evidence=False,
            )
        finally:
            if old_json is None:
                os.environ.pop("FLOWDESK_OMNIGENT_PROVIDER_USAGE_JSON", None)
            else:
                os.environ["FLOWDESK_OMNIGENT_PROVIDER_USAGE_JSON"] = old_json

        self.assertEqual(result["selection_status"], "blocked")
        self.assertEqual(result["blocked_labels"], ["provider_usage_snapshot_rejected"])

    def test_default_provider_usage_env_rejects_unknown_top_level_key(self) -> None:
        old_json = os.environ.get("FLOWDESK_OMNIGENT_PROVIDER_USAGE_JSON")
        os.environ["FLOWDESK_OMNIGENT_PROVIDER_USAGE_JSON"] = json.dumps(
            {"providers": [{"provider_family": "openai", "alert_level": "ok"}], "raw_payload": "SHOULD_NOT_BE_ACCEPTED"}
        )
        try:
            result = select_agent_model(
                {
                    "task_id": "task-usage-unknown-key-env",
                    "task_role": "architecture",
                    "allowed_provider_families": ["claude", "openai"],
                },
                write_evidence=False,
            )
        finally:
            if old_json is None:
                os.environ.pop("FLOWDESK_OMNIGENT_PROVIDER_USAGE_JSON", None)
            else:
                os.environ["FLOWDESK_OMNIGENT_PROVIDER_USAGE_JSON"] = old_json

        self.assertEqual(result["selection_status"], "blocked")
        self.assertEqual(result["blocked_labels"], ["provider_usage_snapshot_rejected"])

    def test_default_provider_usage_env_rejects_out_of_range_remaining_percent(self) -> None:
        old_json = os.environ.get("FLOWDESK_OMNIGENT_PROVIDER_USAGE_JSON")
        os.environ["FLOWDESK_OMNIGENT_PROVIDER_USAGE_JSON"] = json.dumps(
            {"providers": [{"provider_family": "openai", "alert_level": "ok", "remaining_percent": 101}]}
        )
        try:
            result = select_agent_model(
                {
                    "task_id": "task-usage-bad-remaining-env",
                    "task_role": "architecture",
                    "allowed_provider_families": ["claude", "openai"],
                },
                write_evidence=False,
            )
        finally:
            if old_json is None:
                os.environ.pop("FLOWDESK_OMNIGENT_PROVIDER_USAGE_JSON", None)
            else:
                os.environ["FLOWDESK_OMNIGENT_PROVIDER_USAGE_JSON"] = old_json

        self.assertEqual(result["selection_status"], "blocked")
        self.assertEqual(result["blocked_labels"], ["provider_usage_snapshot_rejected"])

    def test_high_complexity_implementation_prefers_reasoning_model(self) -> None:
        result = select_agent_model(
            {
                "task_id": "task-implementation-high",
                "task_role": "implementation",
                "task_complexity": "high",
                "allowed_provider_families": ["claude", "openai"],
            },
            write_evidence=False,
        )

        self.assertEqual(result["selection_status"], "selected")
        self.assertEqual(result["provider_family"], "claude")
        self.assertEqual(result["harness"], "claude-sdk")
        self.assertEqual(result["model"], "claude-sonnet-4-6")
        self.assertIn("task_tier_prefers_reasoning_model", result["reason_codes"])

    def test_high_level_architecture_phase_prefers_reasoning_model(self) -> None:
        result = select_agent_model(
            {
                "task_id": "task-architecture-tier",
                "task_role": "architecture",
                "task_phase": "high_level_design",
                "allowed_provider_families": ["claude", "openai"],
            },
            write_evidence=False,
        )

        self.assertEqual(result["selection_status"], "selected")
        self.assertEqual(result["provider_family"], "claude")
        self.assertEqual(result["harness"], "claude-sdk")
        self.assertEqual(result["model"], "claude-sonnet-4-6")

    def test_tier_preference_still_falls_back_when_reasoning_provider_unavailable(self) -> None:
        result = select_agent_model(
            {
                "task_id": "task-tier-usage-fallback",
                "task_role": "implementation",
                "task_complexity": "critical",
                "allowed_provider_families": ["claude", "openai"],
                "provider_usage": {
                    "providers": [
                        {"provider_family": "claude", "alert_level": "exhausted", "remaining_percent": 0},
                        {"provider_family": "openai", "alert_level": "ok", "remaining_percent": 70},
                    ]
                },
            },
            write_evidence=False,
        )

        self.assertEqual(result["selection_status"], "selected")
        self.assertEqual(result["provider_family"], "openai")
        self.assertEqual(result["harness"], "codex")

    def test_available_agents_filter_skips_unregistered_primary_agent(self) -> None:
        result = select_agent_model(
            {
                "task_id": "task-available-agents",
                "task_role": "research",
                "available_agents": ["general-agent"],
                "allowed_provider_families": ["claude", "openai"],
            },
            write_evidence=False,
        )

        self.assertEqual(result["selection_status"], "blocked")
        self.assertEqual(result["blocked_labels"], ["agent_not_available"])

    def test_available_agents_filter_allows_registered_secondary_agent(self) -> None:
        result = select_agent_model(
            {
                "task_id": "task-available-secondary",
                "task_role": "research",
                "available_agents": ["research-agent"],
                "allowed_provider_families": ["claude", "openai"],
            },
            write_evidence=False,
        )

        self.assertEqual(result["selection_status"], "selected")
        self.assertEqual(result["agent"], "research-agent")

    def test_unknown_role_blocks(self) -> None:
        result = select_agent_model(
            {"task_id": "task-bad-role", "task_role": "security"},
            write_evidence=False,
        )

        self.assertEqual(result["selection_status"], "blocked")
        self.assertEqual(result["blocked_labels"], ["unknown_role"])
        self.assertEqual(result["authority"], "advisory_selection_only")

    def test_malformed_request_blocks(self) -> None:
        result = select_agent_model("not-a-dict", write_evidence=False)  # type: ignore[arg-type]

        self.assertEqual(result["selection_status"], "blocked")
        self.assertEqual(result["blocked_labels"], ["malformed_request"])

    def test_gemini_experimental_is_non_dispatchable(self) -> None:
        result = select_agent_model(
            {"task_id": "task-gemini", "task_role": "gemini_experimental"},
            write_evidence=False,
        )

        self.assertEqual(result["selection_status"], "non_dispatchable")
        self.assertEqual(result["blocked_labels"], ["gemini_oauth_refresh_unstable"])

    def test_model_family_mismatch_blocks(self) -> None:
        bad_registry = {
            "architecture": (
                RegistryEntry(
                    agent="architecture-agent",
                    harness="codex",
                    model="anthropic/claude-opus-4-7",
                    provider_family="openai",
                    reason_code="role_architecture_prefers_frontier_reasoning",
                ),
            )
        }
        result = select_agent_model(
            {"task_id": "task-mismatch", "task_role": "architecture"},
            registry=bad_registry,
            write_evidence=False,
        )

        self.assertEqual(result["selection_status"], "blocked")
        self.assertEqual(result["blocked_labels"], ["model_family_mismatch_blocked"])

    def test_redacted_evidence_log_omits_task_description(self) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            previous = Path.cwd()
            os.chdir(tmp)
            try:
                select_agent_model(
                    {
                        "task_id": "task-log",
                        "task_role": "verification",
                        "task_description": "SECRET_PROMPT_TEXT_SHOULD_NOT_APPEAR",
                    },
                    write_evidence=True,
                )
                log_path = Path(tmp) / ".flowdesk" / "omnigent-selection" / "selection-log.jsonl"
                self.assertFalse(log_path.exists())
            finally:
                os.chdir(previous)

    def test_evidence_log_path_can_be_overridden(self) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            log_path = Path(tmp) / "selection-log.jsonl"
            old = os.environ.get("FLOWDESK_OMNIGENT_SELECTION_LOG_PATH")
            os.environ["FLOWDESK_OMNIGENT_SELECTION_LOG_PATH"] = str(log_path)
            try:
                select_agent_model(
                    {
                        "task_id": "task-log-override",
                        "task_role": "architecture",
                        "task_description": "SHOULD_NOT_APPEAR",
                    },
                    write_evidence=True,
                )
                raw = log_path.read_text(encoding="utf-8")
                self.assertNotIn("SHOULD_NOT_APPEAR", raw)
                record = json.loads(raw)
                self.assertEqual(record["schema_version"], "flowdesk.omnigent_selection_debug_log.v1")
                self.assertEqual(record["task_id"], "task-log-override")
            finally:
                if old is None:
                    os.environ.pop("FLOWDESK_OMNIGENT_SELECTION_LOG_PATH", None)
                else:
                    os.environ["FLOWDESK_OMNIGENT_SELECTION_LOG_PATH"] = old

    def test_default_call_does_not_write_debug_log(self) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            previous = Path.cwd()
            os.chdir(tmp)
            try:
                select_agent_model(
                    {
                        "task_id": "task-no-log",
                        "task_role": "verification",
                        "task_description": "ordinary task",
                    }
                )
                self.assertFalse((Path(tmp) / ".flowdesk").exists())
            finally:
                os.chdir(previous)

    def test_ts_cli_engine_returns_cli_selection(self) -> None:
        cli_result = {
            "schema_version": "flowdesk.omnigent_selection.v1",
            "selection_id": "selection-ts-cli",
            "task_id": "task-cli",
            "task_role": "architecture",
            "selection_status": "selected",
            "agent": "architecture-agent",
            "harness": "codex",
            "model": None,
            "provider_family": "openai",
            "confidence": "high",
            "reason_codes": ["subscription_harness_default_model"],
            "blocked_labels": [],
            "authority": "advisory_selection_only",
            "created_at": "2026-06-26T00:00:00.000Z",
            "expires_at": "2026-06-26T00:10:00.000Z",
        }
        with tempfile.NamedTemporaryFile() as handle:
            with patch("flowdesk_omnigent.selection.subprocess.run") as run:
                run.return_value.returncode = 0
                run.return_value.stdout = json.dumps(cli_result)
                run.return_value.stderr = "SHOULD_NOT_BE_RETURNED"
                result = select_agent_model(
                    {
                        "engine": "ts_cli",
                        "ts_cli_path": handle.name,
                        "task_id": "task-cli",
                        "task_role": "architecture",
                    },
                    write_evidence=False,
                )

        self.assertEqual(result, cli_result)
        _, kwargs = run.call_args
        self.assertNotIn("ANTHROPIC_API_KEY", kwargs["env"])
        self.assertNotIn("OPENAI_API_KEY", kwargs["env"])
        self.assertNotIn("GEMINI_API_KEY", kwargs["env"])

    def test_ts_cli_engine_blocks_without_static_fallback(self) -> None:
        with tempfile.NamedTemporaryFile() as handle:
            with patch("flowdesk_omnigent.selection.subprocess.run") as run:
                run.return_value.returncode = 1
                run.return_value.stdout = ""
                run.return_value.stderr = "raw error should not return"
                result = select_agent_model(
                    {
                        "engine": "ts_cli",
                        "ts_cli_path": handle.name,
                        "task_id": "task-cli-fail",
                        "task_role": "architecture",
                    },
                    write_evidence=False,
                )

        self.assertEqual(result["selection_status"], "blocked")
        self.assertEqual(result["blocked_labels"], ["ts_cli_unavailable"])
        self.assertNotEqual(result.get("agent"), "architecture-agent")


if __name__ == "__main__":
    unittest.main()
