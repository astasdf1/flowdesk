from __future__ import annotations

from contextlib import redirect_stderr, redirect_stdout
import io
from pathlib import Path
import tempfile
import unittest
from unittest.mock import patch

from flowdesk_omnigent.launcher import build_host_command, build_server_command, main, missing_template_paths


class LauncherTests(unittest.TestCase):
    def test_build_server_command_registers_all_fd_oc_agents(self) -> None:
        command = build_server_command(omnigent_bin="omnigent", host="127.0.0.1", port=6767, agent_root=Path("/tmp/agents"))

        self.assertEqual(command[:6], ["omnigent", "server", "--host", "127.0.0.1", "--port", "6767"])
        self.assertIn("/tmp/agents/FD-OC", command)
        self.assertIn("/tmp/agents/FD-OC-Opus", command)
        self.assertIn("/tmp/agents/FD-OC-Codex", command)
        self.assertEqual(command.count("--agent"), 3)

    def test_build_server_command_uses_requested_bind_address(self) -> None:
        command = build_server_command(omnigent_bin="omnigent", host="100.64.0.10", port=6767, agent_root=Path("/tmp/agents"))

        self.assertEqual(command[:6], ["omnigent", "server", "--host", "100.64.0.10", "--port", "6767"])

    def test_build_host_command_targets_server_url(self) -> None:
        self.assertEqual(
            build_host_command(omnigent_bin="omnigent", server_url="http://127.0.0.1:6767"),
            ["omnigent", "host", "--server", "http://127.0.0.1:6767"],
        )

    def test_missing_template_paths_reports_missing_parent_configs(self) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            missing = missing_template_paths(Path(tmp))

        self.assertEqual(len(missing), 3)

    def test_dry_run_fails_when_templates_are_missing(self) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            with patch("flowdesk_omnigent.launcher.shutil.which", return_value="/usr/bin/omnigent"):
                with redirect_stderr(io.StringIO()), redirect_stdout(io.StringIO()):
                    result = main(["--agent-root", tmp, "--dry-run"])

        self.assertEqual(result, 2)

    def test_dry_run_can_skip_template_check(self) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            with patch("flowdesk_omnigent.launcher.shutil.which", return_value="/usr/bin/omnigent"):
                with redirect_stderr(io.StringIO()), redirect_stdout(io.StringIO()):
                    result = main(["--agent-root", tmp, "--dry-run", "--skip-template-check"])

        self.assertEqual(result, 0)

    def test_dry_run_accepts_bind_alias(self) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            with patch("flowdesk_omnigent.launcher.shutil.which", return_value="/usr/bin/omnigent"):
                stdout = io.StringIO()
                with redirect_stderr(io.StringIO()), redirect_stdout(stdout):
                    result = main(["--agent-root", tmp, "--dry-run", "--skip-template-check", "--bind", "100.64.0.10"])

        self.assertEqual(result, 0)
        output = stdout.getvalue()
        self.assertIn("--host 100.64.0.10", output)
        self.assertIn("http://100.64.0.10:6767", output)


if __name__ == "__main__":
    unittest.main()
