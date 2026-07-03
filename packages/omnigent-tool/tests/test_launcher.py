from __future__ import annotations

from contextlib import redirect_stderr, redirect_stdout
import io
from pathlib import Path
import tempfile
import unittest
from unittest.mock import patch

from flowdesk_omnigent.launcher import (
    build_host_command,
    build_server_command,
    build_server_env,
    detect_tailscale_origins,
    main,
    missing_template_paths,
    tailscale_origins_from_status,
)


class LauncherTests(unittest.TestCase):
    def test_build_server_command_registers_all_fd_oc_agents(self) -> None:
        command = build_server_command(
            omnigent_bin="omnigent",
            host="127.0.0.1",
            port=6767,
            agent_root=Path("/tmp/agents"),
        )

        self.assertEqual(
            command[:6], ["omnigent", "server", "--host", "127.0.0.1", "--port", "6767"]
        )
        self.assertIn("/tmp/agents/FD-OC", command)
        self.assertIn("/tmp/agents/FD-OC-Opus", command)
        self.assertIn("/tmp/agents/FD-OC-Codex", command)
        self.assertEqual(command.count("--agent"), 3)

    def test_build_server_command_uses_requested_bind_address(self) -> None:
        command = build_server_command(
            omnigent_bin="omnigent",
            host="100.64.0.10",
            port=6767,
            agent_root=Path("/tmp/agents"),
        )

        self.assertEqual(
            command[:6],
            ["omnigent", "server", "--host", "100.64.0.10", "--port", "6767"],
        )

    def test_build_host_command_targets_server_url(self) -> None:
        self.assertEqual(
            build_host_command(
                omnigent_bin="omnigent", server_url="http://127.0.0.1:6767"
            ),
            ["omnigent", "host", "--server", "http://127.0.0.1:6767"],
        )

    def test_missing_template_paths_reports_missing_parent_configs(self) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            missing = missing_template_paths(Path(tmp))

        self.assertEqual(len(missing), 3)

    def test_dry_run_fails_when_templates_are_missing(self) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            with patch(
                "flowdesk_omnigent.launcher.shutil.which",
                return_value="/usr/bin/omnigent",
            ):
                with redirect_stderr(io.StringIO()), redirect_stdout(io.StringIO()):
                    result = main(["--agent-root", tmp, "--dry-run"])

        self.assertEqual(result, 2)

    def test_dry_run_can_skip_template_check(self) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            with patch(
                "flowdesk_omnigent.launcher.shutil.which",
                return_value="/usr/bin/omnigent",
            ):
                with redirect_stderr(io.StringIO()), redirect_stdout(io.StringIO()):
                    result = main(
                        ["--agent-root", tmp, "--dry-run", "--skip-template-check"]
                    )

        self.assertEqual(result, 0)

    def test_dry_run_accepts_bind_alias(self) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            with patch(
                "flowdesk_omnigent.launcher.shutil.which",
                return_value="/usr/bin/omnigent",
            ):
                stdout = io.StringIO()
                with redirect_stderr(io.StringIO()), redirect_stdout(stdout):
                    result = main(
                        [
                            "--agent-root",
                            tmp,
                            "--dry-run",
                            "--skip-template-check",
                            "--bind",
                            "100.64.0.10",
                        ]
                    )

        self.assertEqual(result, 0)
        output = stdout.getvalue()
        self.assertIn("--host 100.64.0.10", output)
        self.assertIn("http://100.64.0.10:6767", output)


class BuildServerEnvTests(unittest.TestCase):
    def test_allowed_origin_sets_env_var(self) -> None:
        env = build_server_env(["https://host.ts.net"], base_env={"PATH": "/usr/bin"})
        self.assertEqual(env["OMNIGENT_WS_ALLOWED_ORIGINS"], "https://host.ts.net")
        self.assertEqual(env["PATH"], "/usr/bin")  # base env preserved

    def test_multiple_origins_are_comma_joined(self) -> None:
        env = build_server_env(["https://a.ts.net", "https://b.ts.net"], base_env={})
        self.assertEqual(
            env["OMNIGENT_WS_ALLOWED_ORIGINS"], "https://a.ts.net,https://b.ts.net"
        )

    def test_merges_with_inherited_value_and_dedupes(self) -> None:
        env = build_server_env(
            ["https://new.ts.net", "https://a.ts.net"],
            base_env={
                "OMNIGENT_WS_ALLOWED_ORIGINS": "https://a.ts.net, https://b.ts.net"
            },
        )
        # inherited first (order preserved), new appended, duplicate dropped.
        self.assertEqual(
            env["OMNIGENT_WS_ALLOWED_ORIGINS"],
            "https://a.ts.net,https://b.ts.net,https://new.ts.net",
        )

    def test_no_origins_leaves_var_unset_when_absent(self) -> None:
        env = build_server_env(None, base_env={"PATH": "/usr/bin"})
        self.assertNotIn("OMNIGENT_WS_ALLOWED_ORIGINS", env)

    def test_no_flag_preserves_inherited_value(self) -> None:
        env = build_server_env(
            [], base_env={"OMNIGENT_WS_ALLOWED_ORIGINS": "https://a.ts.net"}
        )
        self.assertEqual(env["OMNIGENT_WS_ALLOWED_ORIGINS"], "https://a.ts.net")


class DryRunAllowedOriginTests(unittest.TestCase):
    def test_dry_run_prints_allowed_origins(self) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            with patch(
                "flowdesk_omnigent.launcher.shutil.which",
                return_value="/usr/bin/omnigent",
            ):
                stdout = io.StringIO()
                with redirect_stderr(io.StringIO()), redirect_stdout(stdout):
                    result = main(
                        [
                            "--agent-root",
                            tmp,
                            "--dry-run",
                            "--skip-template-check",
                            "--allowed-origin",
                            "https://host.ts.net",
                        ]
                    )
        self.assertEqual(result, 0)
        self.assertIn(
            "OMNIGENT_WS_ALLOWED_ORIGINS=https://host.ts.net", stdout.getvalue()
        )


class TailscaleOriginsFromStatusTests(unittest.TestCase):
    _STATUS = {
        "Self": {
            "DNSName": "bagel-macpro-055-macbookpro.tailabcdc5.ts.net.",
            "TailscaleIPs": ["100.105.213.56", "fd7a:115c:a1e0::3d39:d539"],
        }
    }

    def test_builds_magicdns_and_ip_origins(self) -> None:
        origins = tailscale_origins_from_status(self._STATUS, port=6767)
        self.assertEqual(
            origins,
            [
                "https://bagel-macpro-055-macbookpro.tailabcdc5.ts.net",
                "http://bagel-macpro-055-macbookpro.tailabcdc5.ts.net:6767",
                "http://100.105.213.56:6767",
                "http://[fd7a:115c:a1e0::3d39:d539]:6767",  # IPv6 bracketed
            ],
        )

    def test_strips_trailing_dot_from_dnsname(self) -> None:
        origins = tailscale_origins_from_status(
            {"Self": {"DNSName": "host.ts.net."}}, port=6767
        )
        self.assertIn("https://host.ts.net", origins)
        self.assertNotIn("https://host.ts.net.", origins)

    def test_missing_self_returns_empty(self) -> None:
        self.assertEqual(tailscale_origins_from_status({}, port=6767), [])

    def test_logged_out_shape_returns_empty(self) -> None:
        # A logged-out node has no DNSName and no IPs.
        self.assertEqual(
            tailscale_origins_from_status(
                {"Self": {"DNSName": "", "TailscaleIPs": []}}, port=6767
            ),
            [],
        )


class DetectTailscaleOriginsTests(unittest.TestCase):
    def test_returns_empty_when_cli_missing(self) -> None:
        with patch("flowdesk_omnigent.launcher.shutil.which", return_value=None):
            with redirect_stderr(io.StringIO()):
                self.assertEqual(detect_tailscale_origins(port=6767), [])

    def test_parses_cli_output(self) -> None:
        import subprocess

        fake = subprocess.CompletedProcess(
            args=[],
            returncode=0,
            stdout='{"Self": {"DNSName": "host.tailnet.ts.net.", "TailscaleIPs": ["100.64.0.5"]}}',
            stderr="",
        )
        with patch(
            "flowdesk_omnigent.launcher.shutil.which", return_value="/usr/bin/tailscale"
        ):
            with patch("flowdesk_omnigent.launcher.subprocess.run", return_value=fake):
                origins = detect_tailscale_origins(port=6767)
        self.assertIn("https://host.tailnet.ts.net", origins)
        self.assertIn("http://100.64.0.5:6767", origins)

    def test_bad_json_returns_empty(self) -> None:
        import subprocess

        fake = subprocess.CompletedProcess(
            args=[], returncode=0, stdout="not json", stderr=""
        )
        with patch(
            "flowdesk_omnigent.launcher.shutil.which", return_value="/usr/bin/tailscale"
        ):
            with patch("flowdesk_omnigent.launcher.subprocess.run", return_value=fake):
                with redirect_stderr(io.StringIO()):
                    self.assertEqual(detect_tailscale_origins(port=6767), [])


if __name__ == "__main__":
    unittest.main()
