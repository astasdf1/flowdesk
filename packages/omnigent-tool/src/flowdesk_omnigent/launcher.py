"""Foreground launcher for FlowDesk's Omnigent server + host pair."""

from __future__ import annotations

import argparse
import os
from pathlib import Path
import shutil
import signal
import subprocess
import sys
import threading
import time
import webbrowser

from .template_installer import PARENT_AGENT_NAMES, default_agent_root


def build_server_command(*, omnigent_bin: str, host: str, port: int, agent_root: Path) -> list[str]:
    command = [omnigent_bin, "server", "--host", host, "--port", str(port)]
    for name in PARENT_AGENT_NAMES:
        command.extend(["--agent", str(agent_root.expanduser() / name)])
    return command


def build_host_command(*, omnigent_bin: str, server_url: str) -> list[str]:
    return [omnigent_bin, "host", "--server", server_url]


def missing_template_paths(agent_root: Path) -> list[Path]:
    root = agent_root.expanduser()
    missing: list[Path] = []
    for name in PARENT_AGENT_NAMES:
        config = root / name / "config.yaml"
        if not config.exists():
            missing.append(config)
    return missing


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description="Run Omnigent server and host with FlowDesk FD-OC agents registered.")
    parser.add_argument("--omnigent-bin", default="omnigent", help="Omnigent executable. Default: omnigent")
    parser.add_argument("--host", "--bind", dest="host", default="127.0.0.1", help="Server bind address. Default: 127.0.0.1")
    parser.add_argument("--port", default=6767, type=int, help="Server port. Default: 6767")
    parser.add_argument("--agent-root", default=str(default_agent_root()), help="Omnigent agent root. Default: ~/.omnigent/agents")
    parser.add_argument("--no-host-daemon", action="store_true", help="Only run the server, not `omnigent host`.")
    parser.add_argument("--open", action="store_true", help="Open the Omnigent URL in the default browser after launch.")
    parser.add_argument("--dry-run", action="store_true", help="Print commands without starting processes.")
    parser.add_argument("--skip-template-check", action="store_true", help="Do not require FD-OC templates to exist before launch.")
    args = parser.parse_args(argv)

    agent_root = Path(args.agent_root).expanduser()
    server_url = f"http://{args.host}:{args.port}"
    server_command = build_server_command(omnigent_bin=args.omnigent_bin, host=args.host, port=args.port, agent_root=agent_root)
    host_command = build_host_command(omnigent_bin=args.omnigent_bin, server_url=server_url)

    if shutil.which(args.omnigent_bin) is None and not Path(args.omnigent_bin).exists():
        print(f"Omnigent executable not found: {args.omnigent_bin}", file=sys.stderr)
        return 2
    missing = missing_template_paths(agent_root) if not args.skip_template_check else []
    if missing:
        print("FD-OC templates are not installed:", file=sys.stderr)
        for path in missing:
            print(f"  {path}", file=sys.stderr)
        print("Run: flowdesk-omnigent-install-templates", file=sys.stderr)
        return 2
    if args.dry_run:
        print("server:")
        print("  " + _shell_join(server_command))
        if not args.no_host_daemon:
            print("host:")
            print("  " + _shell_join(host_command))
        return 0

    processes: list[subprocess.Popen[str]] = []
    try:
        server = subprocess.Popen(server_command, stdout=subprocess.PIPE, stderr=subprocess.STDOUT, text=True, bufsize=1)
        processes.append(server)
        _pipe_output("server", server)
        time.sleep(2)
        if not args.no_host_daemon:
            host_process = subprocess.Popen(host_command, stdout=subprocess.PIPE, stderr=subprocess.STDOUT, text=True, bufsize=1)
            processes.append(host_process)
            _pipe_output("host", host_process)
        if args.open:
            webbrowser.open(server_url)
        print(f"[flowdesk] Omnigent URL: {server_url}")
        return _wait_for_processes(processes)
    except KeyboardInterrupt:
        print("\n[flowdesk] stopping Omnigent processes")
        return 130
    finally:
        _terminate_processes(processes)


def _pipe_output(label: str, process: subprocess.Popen[str]) -> None:
    def run() -> None:
        if process.stdout is None:
            return
        for line in process.stdout:
            print(f"[{label}] {line}", end="")

    thread = threading.Thread(target=run, daemon=True)
    thread.start()


def _wait_for_processes(processes: list[subprocess.Popen[str]]) -> int:
    while processes:
        for process in list(processes):
            code = process.poll()
            if code is not None:
                return code
        time.sleep(0.5)
    return 0


def _terminate_processes(processes: list[subprocess.Popen[str]]) -> None:
    for process in reversed(processes):
        if process.poll() is None:
            try:
                process.send_signal(signal.SIGINT)
            except OSError:
                pass
    deadline = time.time() + 5
    for process in reversed(processes):
        while process.poll() is None and time.time() < deadline:
            time.sleep(0.1)
        if process.poll() is None:
            process.terminate()


def _shell_join(command: list[str]) -> str:
    return " ".join(_shell_quote(part) for part in command)


def _shell_quote(value: str) -> str:
    if value and all(ch.isalnum() or ch in "@%_+=:,./-" for ch in value):
        return value
    return "'" + value.replace("'", "'\\''") + "'"


if __name__ == "__main__":
    raise SystemExit(main(sys.argv[1:]))
