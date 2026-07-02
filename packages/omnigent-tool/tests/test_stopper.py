from __future__ import annotations

import io
from contextlib import redirect_stdout
import unittest
from unittest.mock import patch

from flowdesk_omnigent.stopper import classify, main, parse_ps, select_targets

# Representative command lines as emitted by `ps -axww -o pid=,command=` for a
# live `flowdesk-omnigent-start` launch (paths abbreviated but structure real).
_WRAPPER = "12340 /uv/tools/flowdesk-omnigent-tool/bin/python /home/u/.local/bin/flowdesk-omnigent-start --bind 127.0.0.1"
_SERVER = "12341 /uv/tools/omnigent/bin/python /home/u/.local/bin/omnigent server --host 127.0.0.1 --port 6767"
_HOST = "12342 /uv/tools/omnigent/bin/python /home/u/.local/bin/omnigent host --server http://127.0.0.1:6767"
_DAEMON = "12343 /uv/tools/omnigent/bin/python -m omnigent.host._daemon_entry"
# Interactive sessions and unrelated processes we must NOT touch.
_TUI = "12350 /uv/tools/omnigent/bin/python -m omnigent.cli"
_RUN = (
    "12351 /uv/tools/omnigent/bin/python /home/u/.local/bin/omnigent run --agent FD-OC"
)
_UNRELATED = "12360 /bin/zsh -c source /home/u/.claude/shell-snapshots/snap.sh"
# The shell that *launched* the wrapper: its argv embeds the token in an eval
# string. It is the launcher's parent, not the wrapper, and must be ignored.
_LAUNCHING_SHELL = "12370 /bin/zsh -c eval 'cd ~/proj && flowdesk-omnigent-start --bind 127.0.0.1 --port 6767'"


class ClassifyTests(unittest.TestCase):
    def test_wrapper_matches_console_script_and_module(self) -> None:
        self.assertEqual(classify(_WRAPPER.split(" ", 1)[1]), "wrapper")
        self.assertEqual(
            classify("python -m flowdesk_omnigent.launcher --port 6767"), "wrapper"
        )

    def test_server_and_daemon_classify_as_server(self) -> None:
        self.assertEqual(classify(_SERVER.split(" ", 1)[1]), "server")
        self.assertEqual(classify(_DAEMON.split(" ", 1)[1]), "server")

    def test_host_takes_precedence_over_its_server_flag(self) -> None:
        # The host command line contains "--server <url>"; it must still be a host.
        self.assertEqual(classify(_HOST.split(" ", 1)[1]), "host")

    def test_interactive_and_unrelated_are_ignored(self) -> None:
        self.assertIsNone(classify(_TUI.split(" ", 1)[1]))
        self.assertIsNone(classify(_RUN.split(" ", 1)[1]))
        self.assertIsNone(classify(_UNRELATED.split(" ", 1)[1]))

    def test_launching_shell_is_not_the_wrapper(self) -> None:
        # A shell whose argv embeds the token (the process that ran the
        # console script) must never be classified/killed.
        self.assertIsNone(classify(_LAUNCHING_SHELL.split(" ", 1)[1]))

    def test_tool_env_path_alone_does_not_match(self) -> None:
        # The uv tool dir literally contains "omnigent" but the process is just python.
        self.assertIsNone(
            classify(
                "/uv/tools/omnigent/bin/python /home/u/.local/bin/flowdesk-omnigent-mcp"
            )
        )


class ParseAndSelectTests(unittest.TestCase):
    def test_parse_ps_reads_pid_and_command(self) -> None:
        parsed = parse_ps("  100 python -m omnigent server \n\n  bad line\n200 zsh\n")
        self.assertEqual(parsed, [(100, "python -m omnigent server"), (200, "zsh")])

    def test_select_orders_wrapper_first_and_excludes_self(self) -> None:
        output = "\n".join([_HOST, _SERVER, _WRAPPER, _TUI, _UNRELATED])
        targets = select_targets(parse_ps(output), exclude_pids={12360})
        kinds = [kind for _pid, kind, _cmd in targets]
        self.assertEqual(kinds, ["wrapper", "host", "server"])
        # The interactive/unrelated pids never appear.
        pids = {pid for pid, _k, _c in targets}
        self.assertEqual(pids, {12340, 12341, 12342})

    def test_select_honors_exclude_pids(self) -> None:
        targets = select_targets(parse_ps(_WRAPPER), exclude_pids={12340})
        self.assertEqual(targets, [])


class MainDryRunTests(unittest.TestCase):
    def test_dry_run_lists_targets_without_signalling(self) -> None:
        procs = parse_ps("\n".join([_WRAPPER, _SERVER, _HOST, _TUI]))
        with patch("flowdesk_omnigent.stopper._list_processes", return_value=procs):
            with patch("flowdesk_omnigent.stopper._signal") as sig:
                with patch("flowdesk_omnigent.stopper.subprocess.run") as run:
                    out = io.StringIO()
                    with redirect_stdout(out):
                        rc = main(["--dry-run"])
        self.assertEqual(rc, 0)
        sig.assert_not_called()
        run.assert_not_called()
        text = out.getvalue()
        self.assertIn("would stop wrapper pid=12340", text)
        self.assertIn("would stop server pid=12341", text)
        self.assertIn("would stop host pid=12342", text)
        self.assertNotIn("12350", text)

    def test_no_targets_dry_run_reports_none(self) -> None:
        with patch(
            "flowdesk_omnigent.stopper._list_processes", return_value=parse_ps(_TUI)
        ):
            out = io.StringIO()
            with redirect_stdout(out):
                rc = main(["--dry-run"])
        self.assertEqual(rc, 0)
        self.assertIn("no flowdesk-omnigent processes found", out.getvalue())


if __name__ == "__main__":
    unittest.main()
