from __future__ import annotations

import json
import os
from pathlib import Path
import tempfile
import unittest
from unittest.mock import patch

from flowdesk_omnigent.selection import DEFAULT_REGISTRY, HARNESSES_BY_FAMILY, MODEL_PREFIXES, RegistryEntry, agent_allowed_bindings, select_agent_model


PARITY_FIXTURE_PATH = Path(__file__).parent / "fixtures" / "omnigent_selection_parity_cases.json"
REGISTRY_ARTIFACT_PATH = Path(__file__).parents[1] / "src" / "flowdesk_omnigent" / "omnigent_selector_registry.v1.json"
CLAUDE_MODEL_SET = {"claude-opus-4-8", "claude-sonnet-5", "claude-sonnet-4-6", "claude-haiku-4-5"}
OPENAI_GPT56_MODEL_SET = {"openai/gpt-5.6", "openai/gpt-5.6-terra", "openai/gpt-5.6-luna"}


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
                    **({"model_tier": entry.model_tier} if entry.model_tier is not None else {}),
                    "provider_family": entry.provider_family,
                    "reason_code": entry.reason_code,
                    "confidence": entry.confidence,
                }
                for entry in entries
            ]
            for role, entries in DEFAULT_REGISTRY.items()
        }
        self.assertEqual(artifact["roles"], normalized)

    def test_python_registry_exposes_all_claude_variants_per_role(self) -> None:
        for role, entries in DEFAULT_REGISTRY.items():
            with self.subTest(role=role):
                if role == "gemini_experimental":
                    continue
                claude_models = {entry.model for entry in entries if entry.provider_family == "claude" and entry.model is not None}
                self.assertEqual(claude_models, CLAUDE_MODEL_SET | {"claude-fable-5"})
                self.assertTrue(any(entry.provider_family == "openai" and entry.model is None for entry in entries))

    def test_python_registry_exposes_openai_gpt56_variants_per_role(self) -> None:
        for role, entries in DEFAULT_REGISTRY.items():
            with self.subTest(role=role):
                if role == "gemini_experimental":
                    continue
                openai_models = {entry.model for entry in entries if entry.provider_family == "openai" and entry.model is not None}
                self.assertTrue(OPENAI_GPT56_MODEL_SET.issubset(openai_models))

    def test_selection_golden_examples_shape_is_stable(self) -> None:
        # Golden bridge between the Python response shape and the core schema:
        # regenerating each canonical request must produce exactly the golden
        # object modulo the dynamic fields (selection_id/created_at/expires_at).
        # The TS side validates the same fixture with
        # validateFlowDeskOmnigentSelectionV1.
        golden_path = Path(__file__).parent / "fixtures" / "omnigent_selection_golden_examples.json"
        golden = json.loads(golden_path.read_text(encoding="utf-8"))
        requests = {
            "selected_policy_security_claude": {"task_id": "task-golden-selected", "task_role": "policy_security", "allowed_provider_families": ["claude", "openai"]},
            "selected_codex_default_null_model": {"task_id": "task-golden-codex", "task_role": "architecture", "allowed_provider_families": ["openai"]},
            "blocked_unknown_role": {"task_id": "task-golden-blocked", "task_role": "nonexistent"},
            "blocked_provider_not_entitled": {"task_id": "task-golden-entitled", "task_role": "architecture", "allowed_provider_families": ["openai"], "entitled_providers": ["gemini"]},
        }
        self.assertEqual(set(golden), set(requests))
        dynamic = {"selection_id", "created_at", "expires_at"}
        for name, request in requests.items():
            with self.subTest(example=name):
                regenerated = select_agent_model(request, write_evidence=False)
                expected = {k: v for k, v in golden[name].items() if k not in dynamic}
                actual = {k: v for k, v in regenerated.items() if k not in dynamic}
                self.assertEqual(actual, expected)

    def test_selection_golden_examples_are_redaction_safe(self) -> None:
        # Smoke-artifact redaction guarantee: golden selection artifacts must not
        # contain token-shaped strings, credential paths, or prompt echoes.
        import re

        golden_path = Path(__file__).parent / "fixtures" / "omnigent_selection_golden_examples.json"
        raw = golden_path.read_text(encoding="utf-8")
        # Token-shaped secrets (anchored so "task-..." does not false-positive on "sk-").
        self.assertIsNone(re.search(r"\bsk-[A-Za-z0-9]{8,}", raw))
        self.assertIsNone(re.search(r"\beyJ[A-Za-z0-9_-]{10,}", raw))  # JWT-shaped
        for marker in ("Bearer ", "oauth", "credentials.json", "auth.json", "task_description", "prompt"):
            self.assertNotIn(marker, raw)

    def test_debug_evidence_writer_emits_only_schema_aligned_fields(self) -> None:
        # The optional debug log is DERIVED evidence: an allowlist projection of
        # the flowdesk.omnigent_selection.v1 response only. It must never echo
        # request fields (descriptions/prompts) or grow unlisted keys.
        allowed = {
            "schema_version", "selection_id", "task_id", "task_role", "selection_status",
            "agent", "harness", "model", "provider_family", "reason_codes",
            "blocked_labels", "created_at", "expires_at", "authority",
        }
        with tempfile.TemporaryDirectory() as d:
            log_path = os.path.join(d, "selection-log.jsonl")
            with patch.dict(os.environ, {"FLOWDESK_OMNIGENT_SELECTION_LOG_PATH": log_path}):
                select_agent_model(
                    {"task_id": "task-debug-writer", "task_role": "architecture", "task_description": "SECRET prompt text", "allowed_provider_families": ["openai"]},
                    write_evidence=True,
                )
            lines = [line for line in open(log_path, encoding="utf-8").read().splitlines() if line]
        self.assertEqual(len(lines), 1)
        record = json.loads(lines[0])
        self.assertTrue(set(record).issubset(allowed), set(record) - allowed)
        self.assertNotIn("SECRET", lines[0])

    def test_usage_bridge_fixture_is_accepted_and_skips_exhausted_provider(self) -> None:
        # Cross-language guarantee for the OpenCode->Omnigent usage bridge:
        # the TS builder (packages/core/src/omnigent-usage-snapshot.ts) asserts
        # it produces exactly this fixture; here we assert the Python selector
        # accepts it via the env snapshot path and actually acts on it
        # (claude exhausted -> policy_security falls through to openai/codex).
        fixture_path = Path(__file__).parent / "fixtures" / "omnigent_usage_bridge_snapshot_example.json"
        raw = fixture_path.read_text(encoding="utf-8")
        old_json = os.environ.get("FLOWDESK_OMNIGENT_PROVIDER_USAGE_JSON")
        old_path = os.environ.get("FLOWDESK_OMNIGENT_PROVIDER_USAGE_PATH")
        os.environ["FLOWDESK_OMNIGENT_PROVIDER_USAGE_JSON"] = raw
        os.environ.pop("FLOWDESK_OMNIGENT_PROVIDER_USAGE_PATH", None)
        try:
            result = select_agent_model(
                {
                    "task_id": "task-usage-bridge",
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
        self.assertEqual(result["harness"], "codex")
        self.assertNotIn("provider_usage_snapshot_rejected", result["reason_codes"])

    def test_registry_model_ids_conform_to_family_prefixes(self) -> None:
        # Registry model ids are a manually-verified artifact (see OMNIGENT_SETUP).
        # This is a drift canary: a non-null model id must match a known prefix for its
        # provider family, catching typos or a family/model mismatch in the JSON.
        for role, entries in DEFAULT_REGISTRY.items():
            for entry in entries:
                if entry.model is None:
                    continue
                with self.subTest(role=role, model=entry.model, family=entry.provider_family):
                    prefixes = MODEL_PREFIXES.get(entry.provider_family, ())
                    self.assertTrue(
                        entry.model.startswith(tuple(prefixes)),
                        f"model {entry.model} does not match any {entry.provider_family} prefix {prefixes}",
                    )

    def test_registry_harness_is_coupled_to_model_family(self) -> None:
        for role, entries in DEFAULT_REGISTRY.items():
            for entry in entries:
                with self.subTest(role=role, agent=entry.agent, harness=entry.harness):
                    allowed = HARNESSES_BY_FAMILY.get(entry.provider_family)
                    self.assertIsNotNone(allowed, f"unknown provider_family {entry.provider_family}")
                    self.assertIn(entry.harness, allowed)

    def test_agent_allowed_bindings_pairs_family_with_harness(self) -> None:
        bindings = agent_allowed_bindings()
        # Every recorded pair must be internally consistent (harness belongs to family).
        for agent, pairs in bindings.items():
            for family, harness in pairs:
                with self.subTest(agent=agent, family=family, harness=harness):
                    self.assertIn(harness, HARNESSES_BY_FAMILY.get(family, ()))
        # architecture-agent supports both openai/codex and claude/claude-native.
        self.assertIn(("openai", "codex"), bindings["architecture-agent"])
        self.assertIn(("claude", "claude-native"), bindings["architecture-agent"])

    def test_python_registry_exposes_dedicated_gemini_agent(self) -> None:
        entries = DEFAULT_REGISTRY["gemini_experimental"]
        self.assertEqual(len(entries), 4)
        self.assertEqual(entries[0].agent, "gemini-agent")
        self.assertEqual(entries[0].harness, "antigravity-native")
        self.assertEqual(entries[0].provider_family, "gemini")
        self.assertEqual(entries[0].model, "google/gemini-3.1-flash-lite")
        self.assertEqual({entry.model_tier for entry in entries}, {"flash-lite", "flash", "pro"})
        self.assertIn("gemini-3.5-flash", {entry.model for entry in entries})

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
        self.assertEqual(result["harness"], "claude-native")
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

    def test_openai_model_tier_selects_codex_fast_variant(self) -> None:
        result = select_agent_model(
            {
                "task_id": "task-codex-fast",
                "task_role": "implementation",
                "allowed_provider_families": ["openai"],
                "model_tier": "fast",
            },
            write_evidence=False,
        )

        self.assertEqual(result["selection_status"], "selected")
        self.assertEqual(result["provider_family"], "openai")
        self.assertEqual(result["harness"], "codex")
        self.assertEqual(result["model"], "openai/gpt-5.4-mini-fast")
        self.assertIn("model_tier_preference_applied", result["reason_codes"])
        self.assertIn("model_family_compatible", result["reason_codes"])

    def test_openai_preferred_model_can_select_gpt56_luna_variant(self) -> None:
        result = select_agent_model(
            {
                "task_id": "task-gpt56-luna",
                "task_role": "implementation",
                "allowed_provider_families": ["openai"],
                "preferred_model": "openai/gpt-5.6-luna",
            },
            write_evidence=False,
        )

        self.assertEqual(result["selection_status"], "selected")
        self.assertEqual(result["provider_family"], "openai")
        self.assertEqual(result["harness"], "codex")
        self.assertEqual(result["model"], "openai/gpt-5.6-luna")

    def test_openai_preferred_model_can_select_gpt56_terra_variant(self) -> None:
        result = select_agent_model(
            {
                "task_id": "task-gpt56-terra",
                "task_role": "architecture",
                "allowed_provider_families": ["openai"],
                "preferred_model": "openai/gpt-5.6-terra",
            },
            write_evidence=False,
        )

        self.assertEqual(result["selection_status"], "selected")
        self.assertEqual(result["provider_family"], "openai")
        self.assertEqual(result["harness"], "codex")
        self.assertEqual(result["model"], "openai/gpt-5.6-terra")

    def test_claude_preferred_model_can_select_fable_five(self) -> None:
        result = select_agent_model(
            {
                "task_id": "task-claude-fable-5",
                "task_role": "policy_security",
                "allowed_provider_families": ["claude"],
                "preferred_model": "claude-fable-5",
            },
            write_evidence=False,
        )

        self.assertEqual(result["selection_status"], "selected")
        self.assertEqual(result["provider_family"], "claude")
        self.assertEqual(result["harness"], "claude-native")
        self.assertEqual(result["model"], "claude-fable-5")

    def test_claude_model_tier_selects_sonnet_5_variant(self) -> None:
        result = select_agent_model(
            {
                "task_id": "task-claude-sonnet-5",
                "task_role": "architecture",
                "allowed_provider_families": ["claude"],
                "model_tier": "sonnet",
            },
            write_evidence=False,
        )

        self.assertEqual(result["selection_status"], "selected")
        self.assertEqual(result["provider_family"], "claude")
        self.assertEqual(result["harness"], "claude-native")
        self.assertEqual(result["model"], "claude-sonnet-5")
        self.assertIn("model_tier_preference_applied", result["reason_codes"])

    def test_openai_model_tier_selects_codex_spark_variant(self) -> None:
        result = select_agent_model(
            {
                "task_id": "task-codex-spark",
                "task_role": "general",
                "allowed_provider_families": ["openai"],
                "model_tier": "spark",
            },
            write_evidence=False,
        )

        self.assertEqual(result["selection_status"], "selected")
        self.assertEqual(result["agent"], "general-agent")
        self.assertEqual(result["harness"], "codex")
        self.assertEqual(result["model"], "openai/gpt-5.3-codex-spark")

    def test_preferred_model_selects_exact_codex_variant(self) -> None:
        result = select_agent_model(
            {
                "task_id": "task-codex-preferred",
                "task_role": "architecture",
                "allowed_provider_families": ["openai"],
                "preferred_model": "openai/gpt-5.4",
            },
            write_evidence=False,
        )

        self.assertEqual(result["selection_status"], "selected")
        self.assertEqual(result["model"], "openai/gpt-5.4")
        self.assertIn("preferred_model_applied", result["reason_codes"])

    def test_gemini_model_tier_selects_pro_variant(self) -> None:
        result = select_agent_model(
            {
                "task_id": "task-gemini-pro",
                "task_role": "gemini_experimental",
                "allowed_provider_families": ["gemini"],
                "model_tier": "pro",
            },
            write_evidence=False,
        )

        self.assertEqual(result["selection_status"], "selected")
        self.assertEqual(result["agent"], "gemini-agent")
        self.assertEqual(result["harness"], "antigravity-native")
        self.assertEqual(result["model"], "google/gemini-3.1-pro-preview")
        self.assertIn("model_tier_preference_applied", result["reason_codes"])

    def test_gemini_model_tier_selects_35_flash_variant(self) -> None:
        result = select_agent_model(
            {
                "task_id": "task-gemini-35-flash",
                "task_role": "gemini_experimental",
                "allowed_provider_families": ["gemini"],
                "model_tier": "flash",
            },
            write_evidence=False,
        )

        self.assertEqual(result["selection_status"], "selected")
        self.assertEqual(result["agent"], "gemini-agent")
        self.assertEqual(result["harness"], "antigravity-native")
        self.assertEqual(result["model"], "gemini-3.5-flash")
        self.assertIn("model_tier_preference_applied", result["reason_codes"])

    def test_default_provider_family_set_includes_gemini(self) -> None:
        result = select_agent_model(
            {
                "task_id": "task-gemini-default",
                "task_role": "gemini_experimental",
            },
            write_evidence=False,
        )

        self.assertEqual(result["selection_status"], "selected")
        self.assertEqual(result["agent"], "gemini-agent")
        self.assertEqual(result["harness"], "antigravity-native")
        self.assertEqual(result["provider_family"], "gemini")

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
        self.assertEqual(result["harness"], "claude-native")
        self.assertEqual(result["model"], "claude-sonnet-5")

    def test_critical_verification_prefers_claude_haiku(self) -> None:
        result = select_agent_model(
            {
                "task_id": "task-verification-tier",
                "task_role": "verification",
                "task_complexity": "critical",
                "allowed_provider_families": ["claude", "openai"],
            },
            write_evidence=False,
        )

        self.assertEqual(result["selection_status"], "selected")
        self.assertEqual(result["provider_family"], "claude")
        self.assertEqual(result["harness"], "claude-native")
        self.assertEqual(result["model"], "claude-haiku-4-5")
        self.assertIn("task_tier_prefers_reasoning_model", result["reason_codes"])
        self.assertIn("task_tier_prefers_reasoning_model", result["reason_codes"])

    def test_verification_can_select_gemini_flash_lite(self) -> None:
        result = select_agent_model(
            {
                "task_id": "task-verification-gemini",
                "task_role": "verification",
                "allowed_provider_families": ["gemini"],
            },
            write_evidence=False,
        )

        self.assertEqual(result["selection_status"], "selected")
        self.assertEqual(result["agent"], "verification-agent")
        self.assertEqual(result["harness"], "antigravity-native")
        self.assertEqual(result["model"], "google/gemini-3.1-flash-lite")
        self.assertEqual(result["provider_family"], "gemini")
        self.assertIn("model_family_compatible", result["reason_codes"])

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
        self.assertEqual(result["harness"], "claude-native")
        self.assertEqual(result["model"], "claude-sonnet-5")

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

    def test_gemini_experimental_routes_to_dedicated_agent(self) -> None:
        result = select_agent_model(
            {"task_id": "task-gemini", "task_role": "gemini_experimental", "allowed_provider_families": ["gemini"]},
            write_evidence=False,
        )

        self.assertEqual(result["selection_status"], "selected")
        self.assertEqual(result["agent"], "gemini-agent")
        self.assertEqual(result["harness"], "antigravity-native")
        self.assertEqual(result["model"], "google/gemini-3.1-flash-lite")
        self.assertEqual(result["provider_family"], "gemini")
        self.assertIn("role_gemini_experimental_prefers_gemini_native", result["reason_codes"])

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
