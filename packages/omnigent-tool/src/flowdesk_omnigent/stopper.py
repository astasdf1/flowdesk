"""Teardown companion for ``flowdesk-omnigent-start``.

``flowdesk-omnigent-start`` runs the Omnigent server and host as *foreground*
child processes of the launcher wrapper, so they are never registered as
Omnigent-managed daemons. As a result ``omnigent stop`` alone leaves that
foreground trio (wrapper + ``omnigent server`` + ``omnigent host``) running.

This command discovers and terminates exactly that trio — SIGINT first so the
launcher wrapper can tear down its own children gracefully, escalating to
SIGKILL for stragglers — then delegates to ``omnigent stop`` for any
daemon-managed instances. It deliberately does NOT match interactive
``omnigent run`` / TUI client sessions, which are the user's own windows.
"""

from __future__ import annotations

import argparse
import os
import re
import shutil
import signal
import subprocess
import sys
import time

# Command-line patterns for the processes flowdesk-omnigent-start owns.
# HOST is checked before SERVER because the host command line also contains
# "--server <url>"; matching " host " first keeps the classification correct.
_WRAPPER_RE = re.compile(r"flowdesk-omnigent-start|flowdesk_omnigent\.launcher")
_HOST_RE = re.compile(r"\bomnigent\b\s+host\b")
_SERVER_RE = re.compile(r"\bomnigent\b\s+server\b|omnigent\.host\._daemon_entry")

# Shells whose command line may merely *contain* our tokens inside a `-c`/`eval`
# string (e.g. the shell that launched flowdesk-omnigent-start). The real
# wrapper/server/host are always python processes, so a shell argv[0] means the
# tokens are an invocation string, not this process's own identity.
_SHELL_EXECUTABLES = frozenset(
    {"sh", "bash", "zsh", "dash", "ksh", "fish", "csh", "tcsh"}
)

# Termination order: wrapper first (its SIGINT handler tears down its children),
# then host, then server. Lower sorts earlier.
_ORDER = {"wrapper": 0, "host": 1, "server": 2}


def _is_shell_command(command: str) -> bool:
    """True if argv[0]'s basename is a shell (login shells may be prefixed '-')."""
    first = command.split()[0] if command.split() else ""
    base = first.rsplit("/", 1)[-1].lstrip("-")
    return base in _SHELL_EXECUTABLES


def classify(command: str) -> str | None:
    """Return the flowdesk-omnigent role of a process command line, or None.

    None means the process is unrelated (or an interactive session we must not
    kill) and should be left alone. Shell processes are never classified: a
    shell whose argv embeds ``flowdesk-omnigent-start`` is the *launcher* of the
    wrapper, not the wrapper itself, and must not be signalled.
    """
    if _is_shell_command(command):
        return None
    if _WRAPPER_RE.search(command):
        return "wrapper"
    if _HOST_RE.search(command):
        return "host"
    if _SERVER_RE.search(command):
        return "server"
    return None


def parse_ps(output: str) -> list[tuple[int, str]]:
    """Parse ``ps -axww -o pid=,command=`` output into (pid, command) pairs."""
    processes: list[tuple[int, str]] = []
    for line in output.splitlines():
        line = line.strip()
        if not line:
            continue
        pid_str, _, command = line.partition(" ")
        if not pid_str.isdigit():
            continue
        command = command.strip()
        if command:
            processes.append((int(pid_str), command))
    return processes


def select_targets(
    processes: list[tuple[int, str]], *, exclude_pids: set[int]
) -> list[tuple[int, str, str]]:
    """Return (pid, kind, command) for flowdesk-omnigent processes to stop.

    ``exclude_pids`` guards against the stopper signalling itself or its parent
    shell. Results are ordered so wrappers are signalled before their children.
    """
    targets: list[tuple[int, str, str]] = []
    for pid, command in processes:
        if pid in exclude_pids:
            continue
        kind = classify(command)
        if kind is not None:
            targets.append((pid, kind, command))
    targets.sort(key=lambda t: _ORDER.get(t[1], 9))
    return targets


def _list_processes() -> list[tuple[int, str]]:
    result = subprocess.run(
        ["ps", "-axww", "-o", "pid=,command="],
        capture_output=True,
        text=True,
        check=False,
    )
    return parse_ps(result.stdout)


def _signal(pid: int, sig: int) -> bool:
    try:
        os.kill(pid, sig)
        return True
    except (ProcessLookupError, PermissionError):
        return False


def _still_alive(pids: list[int]) -> list[int]:
    alive: list[int] = []
    for pid in pids:
        if _signal(pid, 0):
            alive.append(pid)
    return alive


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(
        description="Stop the Omnigent server+host launched by flowdesk-omnigent-start."
    )
    parser.add_argument(
        "--omnigent-bin",
        default="omnigent",
        help="Omnigent executable. Default: omnigent",
    )
    parser.add_argument(
        "--no-omnigent-stop",
        action="store_true",
        help="Do not also run `omnigent stop` for daemon-managed instances.",
    )
    parser.add_argument(
        "--dry-run",
        action="store_true",
        help="List the processes that would be signaled, then exit.",
    )
    parser.add_argument(
        "--timeout",
        type=float,
        default=6.0,
        help="Seconds to wait for graceful shutdown before SIGKILL. Default: 6",
    )
    args = parser.parse_args(argv)

    exclude = {os.getpid(), os.getppid()}
    targets = select_targets(_list_processes(), exclude_pids=exclude)

    if args.dry_run:
        if not targets:
            print("[flowdesk] no flowdesk-omnigent processes found")
        for pid, kind, command in targets:
            print(f"[flowdesk] would stop {kind} pid={pid}: {command}")
        return 0

    if not targets:
        print("[flowdesk] no flowdesk-omnigent foreground processes found")
    else:
        # 1) SIGINT everything, wrappers first so the launcher tears down its children.
        for pid, kind, _command in targets:
            if _signal(pid, signal.SIGINT):
                print(f"[flowdesk] SIGINT {kind} pid={pid}")

        # 2) Wait for graceful exit, then SIGKILL stragglers.
        pids = [pid for pid, _kind, _command in targets]
        deadline = time.time() + args.timeout
        remaining = _still_alive(pids)
        while remaining and time.time() < deadline:
            time.sleep(0.25)
            remaining = _still_alive(pids)
        for pid in remaining:
            if _signal(pid, signal.SIGKILL):
                print(f"[flowdesk] SIGKILL pid={pid}")

    # 3) Delegate to `omnigent stop` for daemon-managed instances.
    if not args.no_omnigent_stop and (
        shutil.which(args.omnigent_bin) or os.path.exists(args.omnigent_bin)
    ):
        try:
            subprocess.run([args.omnigent_bin, "stop"], check=False)
        except OSError as exc:  # pragma: no cover - platform/spawn failure
            print(f"[flowdesk] omnigent stop failed: {exc}", file=sys.stderr)

    return 0


if __name__ == "__main__":
    raise SystemExit(main(sys.argv[1:]))
