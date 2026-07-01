from __future__ import annotations

from pathlib import Path
import tempfile
import unittest

from flowdesk_omnigent.template_installer import build_install_plan, install_templates


class TemplateInstallerTests(unittest.TestCase):
    def test_build_install_plan_contains_fd_oc_templates(self) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            plan = build_install_plan(Path(tmp))

        relative_paths = {str(path.relative_to(tmp)) for path, _ in plan.files_to_write}
        self.assertIn("FD-OC/config.yaml", relative_paths)
        self.assertIn("FD-OC-Opus/config.yaml", relative_paths)
        self.assertIn("FD-OC-Codex/config.yaml", relative_paths)
        self.assertIn("FD-OC/agents/implementation-agent/config.yaml", relative_paths)
        self.assertIn("FD-OC/agents/gemini-agent/config.yaml", relative_paths)
        gemini_agent_text = next(text for path, text in plan.files_to_write if str(path.relative_to(tmp)) == "FD-OC/agents/gemini-agent/config.yaml")
        self.assertIn("model: google/gemini-3.1-flash-lite", gemini_agent_text)
        self.assertEqual(len(plan.links_to_create), 2)

    def test_install_templates_writes_configs_and_variant_agent_links(self) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            result = install_templates(Path(tmp))
            root = Path(tmp)

            self.assertEqual(result["status"], "installed")
            self.assertTrue((root / "FD-OC" / "config.yaml").exists())
            self.assertTrue((root / "FD-OC" / "agents" / "general-agent" / "config.yaml").exists())
            self.assertTrue((root / "FD-OC" / "agents" / "gemini-agent" / "config.yaml").exists())
            self.assertTrue((root / "FD-OC-Opus" / "agents").exists())
            self.assertTrue((root / "FD-OC-Codex" / "agents").exists())

    def test_install_templates_blocks_existing_paths_without_force(self) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            (root / "FD-OC").mkdir(parents=True)
            (root / "FD-OC" / "config.yaml").write_text("existing", encoding="utf-8")

            result = install_templates(root)

        self.assertEqual(result["status"], "blocked_existing_paths")
        self.assertTrue(result["blocked_paths"])


if __name__ == "__main__":
    unittest.main()
