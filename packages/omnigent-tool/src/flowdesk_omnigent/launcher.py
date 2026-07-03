"""Foreground launcher for FlowDesk's Omnigent server + host pair."""

from __future__ import annotations

import argparse
import json
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


def build_server_command(
    *, omnigent_bin: str, host: str, port: int, agent_root: Path
) -> list[str]:
    command = [omnigent_bin, "server", "--host", host, "--port", str(port)]
    for name in PARENT_AGENT_NAMES:
        command.extend(["--agent", str(agent_root.expanduser() / name)])
    return command


def build_host_command(*, omnigent_bin: str, server_url: str) -> list[str]:
    return [omnigent_bin, "host", "--server", server_url]


def build_server_env(
    allowed_origins: list[str] | None, *, base_env: dict[str, str] | None = None
) -> dict[str, str]:
    """Return the server subprocess env with ``--allowed-origin`` values merged in.

    Omnigent's ``require_trusted_origin`` guard rejects a browser ``POST
    /v1/sessions`` whose ``Origin`` is neither loopback nor listed in
    ``OMNIGENT_WS_ALLOWED_ORIGINS`` — so external (e.g. Tailscale) browsers get
    ``403`` on new-session creation. This merges the CLI-supplied origins on top
    of any inherited ``OMNIGENT_WS_ALLOWED_ORIGINS`` (comma-separated,
    order-preserving, de-duplicated) so the launcher can open that gate without
    the operator having to export the var by hand.

    :param allowed_origins: Origins from ``--allowed-origin`` (repeatable), each
        ``scheme://host[:port]`` with no path/trailing slash. ``None``/empty
        leaves the inherited value untouched.
    :param base_env: Base environment to copy. Defaults to ``os.environ``.
    :returns: A new env dict for the server ``Popen``.
    """
    env = dict(os.environ if base_env is None else base_env)
    origins: list[str] = []
    existing = env.get("OMNIGENT_WS_ALLOWED_ORIGINS", "").strip()
    if existing:
        origins.extend(part.strip() for part in existing.split(",") if part.strip())
    for origin in allowed_origins or []:
        cleaned = origin.strip()
        if cleaned and cleaned not in origins:
            origins.append(cleaned)
    if origins:
        env["OMNIGENT_WS_ALLOWED_ORIGINS"] = ",".join(origins)
    return env


def tailscale_origins_from_status(status: dict[str, object], *, port: int) -> list[str]:
    """Build trusted browser origins for THIS machine's own Tailscale identity.

    Reads the ``Self`` node from ``tailscale status --json`` output and returns
    the browser ``Origin`` values a tailnet client would send when reaching this
    server: the MagicDNS name over HTTPS (``tailscale serve`` terminates TLS on
    443) and over plain HTTP on the server port, plus each Tailscale IP on the
    server port (IPv6 bracketed). Only *this* node's own addresses are produced
    — never other tailnet peers — so the CSRF trust stays scoped to this host.

    :param status: Parsed ``tailscale status --json`` object.
    :param port: The server port, used for the direct (non-serve) origins.
    :returns: De-duplicated origins in ``scheme://host[:port]`` form.
    """
    self_node = status.get("Self")
    if not isinstance(self_node, dict):
        return []
    origins: list[str] = []
    dns = str(self_node.get("DNSName") or "").strip().rstrip(".")
    if dns:
        origins.append(f"https://{dns}")  # tailscale serve (443, no port)
        origins.append(f"http://{dns}:{port}")  # direct MagicDNS + port
    for raw_ip in self_node.get("TailscaleIPs") or []:
        ip = str(raw_ip).strip()
        if not ip:
            continue
        host = f"[{ip}]" if ":" in ip else ip  # bracket IPv6 literals
        origins.append(f"http://{host}:{port}")
    seen: set[str] = set()
    deduped: list[str] = []
    for origin in origins:
        if origin not in seen:
            seen.add(origin)
            deduped.append(origin)
    return deduped


def detect_tailscale_origins(*, port: int) -> list[str]:
    """Run ``tailscale status --json`` and return this machine's own origins.

    Degrades gracefully: returns ``[]`` (with a stderr note) when the tailscale
    CLI is absent, the command fails, the node is logged out, or the output
    cannot be parsed — the launcher then falls back to loopback-only plus any
    explicit ``--allowed-origin`` values.

    :param port: The server port, forwarded to :func:`tailscale_origins_from_status`.
    :returns: This node's Tailscale origins, or ``[]`` when unavailable.
    """
    if shutil.which("tailscale") is None:
        print(
            "[flowdesk] --tailscale: tailscale CLI not found; skipping auto-origins",
            file=sys.stderr,
        )
        return []
    try:
        proc = subprocess.run(
            ["tailscale", "status", "--json"],
            capture_output=True,
            text=True,
            timeout=10,
        )
    except (OSError, subprocess.SubprocessError) as exc:
        print(
            f"[flowdesk] --tailscale: could not run tailscale status: {exc}",
            file=sys.stderr,
        )
        return []
    if proc.returncode != 0:
        print(
            f"[flowdesk] --tailscale: tailscale status failed (exit {proc.returncode}); skipping",
            file=sys.stderr,
        )
        return []
    try:
        status = json.loads(proc.stdout)
    except ValueError as exc:
        print(
            f"[flowdesk] --tailscale: could not parse tailscale status: {exc}",
            file=sys.stderr,
        )
        return []
    origins = tailscale_origins_from_status(status, port=port)
    if not origins:
        print(
            "[flowdesk] --tailscale: no Tailscale identity found (logged out?); skipping",
            file=sys.stderr,
        )
    return origins


def missing_template_paths(agent_root: Path) -> list[Path]:
    root = agent_root.expanduser()
    missing: list[Path] = []
    for name in PARENT_AGENT_NAMES:
        config = root / name / "config.yaml"
        if not config.exists():
            missing.append(config)
    return missing


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(
        description="Run Omnigent server and host with FlowDesk FD-OC agents registered."
    )
    parser.add_argument(
        "--omnigent-bin",
        default="omnigent",
        help="Omnigent executable. Default: omnigent",
    )
    parser.add_argument(
        "--host",
        "--bind",
        dest="host",
        default="127.0.0.1",
        help="Server bind address. Default: 127.0.0.1",
    )
    parser.add_argument(
        "--port", default=6767, type=int, help="Server port. Default: 6767"
    )
    parser.add_argument(
        "--agent-root",
        default=str(default_agent_root()),
        help="Omnigent agent root. Default: ~/.omnigent/agents",
    )
    parser.add_argument(
        "--no-host-daemon",
        action="store_true",
        help="Only run the server, not `omnigent host`.",
    )
    parser.add_argument(
        "--open",
        action="store_true",
        help="Open the Omnigent URL in the default browser after launch.",
    )
    parser.add_argument(
        "--dry-run",
        action="store_true",
        help="Print commands without starting processes.",
    )
    parser.add_argument(
        "--skip-template-check",
        action="store_true",
        help="Do not require FD-OC templates to exist before launch.",
    )
    parser.add_argument(
        "--allowed-origin",
        action="append",
        dest="allowed_origins",
        metavar="ORIGIN",
        help=(
            "Trusted browser Origin allowed to create sessions, e.g. "
            "https://host.ts.net for Tailscale access. Repeatable. Sets "
            "OMNIGENT_WS_ALLOWED_ORIGINS on the server so external browsers do "
            "not get 403 on new-session creation. Use scheme://host[:port] with "
            "no path or trailing slash."
        ),
    )
    parser.add_argument(
        "--tailscale",
        action="store_true",
        help=(
            "Auto-allow THIS machine's own Tailscale MagicDNS hostname and IPs "
            "as trusted browser origins (runs `tailscale status --json`). Lets "
            "tailnet browsers create sessions without 403. Portable — detects "
            "the local node at launch, so any operator's own install works. "
            "Skips gracefully if the tailscale CLI is missing or logged out."
        ),
    )
    args = parser.parse_args(argv)

    agent_root = Path(args.agent_root).expanduser()
    server_url = f"http://{args.host}:{args.port}"
    server_command = build_server_command(
        omnigent_bin=args.omnigent_bin,
        host=args.host,
        port=args.port,
        agent_root=agent_root,
    )
    host_command = build_host_command(
        omnigent_bin=args.omnigent_bin, server_url=server_url
    )

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
    allowed_origins = list(args.allowed_origins or [])
    if args.tailscale:
        allowed_origins.extend(detect_tailscale_origins(port=args.port))
    server_env = build_server_env(allowed_origins)
    if args.dry_run:
        print("server:")
        print("  " + _shell_join(server_command))
        allowed = server_env.get("OMNIGENT_WS_ALLOWED_ORIGINS")
        if allowed:
            print(f"  OMNIGENT_WS_ALLOWED_ORIGINS={allowed}")
        if not args.no_host_daemon:
            print("host:")
            print("  " + _shell_join(host_command))
        return 0

    processes: list[subprocess.Popen[str]] = []
    try:
        server = subprocess.Popen(
            server_command,
            env=server_env,
            stdout=subprocess.PIPE,
            stderr=subprocess.STDOUT,
            text=True,
            bufsize=1,
        )
        processes.append(server)
        _pipe_output("server", server)
        time.sleep(2)
        if not args.no_host_daemon:
            host_process = subprocess.Popen(
                host_command,
                stdout=subprocess.PIPE,
                stderr=subprocess.STDOUT,
                text=True,
                bufsize=1,
            )
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
