"""Install packaged FlowDesk Omnigent agent templates."""

from __future__ import annotations

import argparse
from dataclasses import dataclass
import hashlib
import json
import os
from pathlib import Path
import shutil
import sys
from importlib import metadata, resources
from typing import Iterable

TEMPLATE_ROOT_PARTS = ("templates", "fd-oc")
PARENT_AGENT_NAMES = ("FD-OC", "FD-OC-Opus", "FD-OC-Codex")
SHARED_AGENT_SOURCE = "FD-OC"
MANIFEST_NAME = ".flowdesk-template-manifest.json"


def _template_version() -> str:
    try:
        return metadata.version("flowdesk-omnigent-tool")
    except metadata.PackageNotFoundError:
        return "unknown"


def _sha256(text: str) -> str:
    return hashlib.sha256(text.encode("utf-8")).hexdigest()


def _manifest_path(root: Path) -> Path:
    return root / MANIFEST_NAME


def _read_manifest(root: Path) -> dict[str, object] | None:
    try:
        payload = json.loads(_manifest_path(root).read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError):
        return None
    return payload if isinstance(payload, dict) else None


@dataclass(frozen=True)
class InstallPlan:
    target_root: Path
    files_to_write: tuple[tuple[Path, str], ...]
    links_to_create: tuple[tuple[Path, Path], ...]
    blocked_paths: tuple[Path, ...]


def default_agent_root() -> Path:
    return Path.home() / ".omnigent" / "agents"


def build_install_plan(target_root: Path) -> InstallPlan:
    root = target_root.expanduser()
    files: list[tuple[Path, str]] = []
    for relative_path, text in _iter_template_files():
        files.append((root / relative_path, text))
    links = tuple((root / variant / "agents", Path(f"../{SHARED_AGENT_SOURCE}/agents")) for variant in ("FD-OC-Opus", "FD-OC-Codex"))
    blocked = tuple(path for path, _ in files if path.exists()) + tuple(path for path, _ in links if path.exists() or path.is_symlink())
    return InstallPlan(target_root=root, files_to_write=tuple(files), links_to_create=links, blocked_paths=blocked)


def install_templates(target_root: Path | None = None, *, force: bool = False, dry_run: bool = False) -> dict[str, object]:
    plan = build_install_plan(target_root or default_agent_root())
    if plan.blocked_paths and not force:
        return {
            "status": "blocked_existing_paths",
            "target_root": str(plan.target_root),
            "blocked_paths": [str(path) for path in plan.blocked_paths],
            "files_planned": len(plan.files_to_write),
            "links_planned": len(plan.links_to_create),
        }
    if dry_run:
        return {
            "status": "dry_run",
            "target_root": str(plan.target_root),
            "files_planned": len(plan.files_to_write),
            "links_planned": len(plan.links_to_create),
        }
    for path, text in plan.files_to_write:
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_text(text, encoding="utf-8")
    _write_manifest(plan)
    for link_path, target in plan.links_to_create:
        if link_path.exists() or link_path.is_symlink():
            if link_path.is_dir() and not link_path.is_symlink():
                shutil.rmtree(link_path)
            else:
                link_path.unlink()
        link_path.parent.mkdir(parents=True, exist_ok=True)
        try:
            link_path.symlink_to(target, target_is_directory=True)
        except OSError:
            shutil.copytree(plan.target_root / SHARED_AGENT_SOURCE / "agents", link_path)
    return {
        "status": "installed",
        "target_root": str(plan.target_root),
        "agents": list(PARENT_AGENT_NAMES),
        "files_written": len(plan.files_to_write),
        "links_created": len(plan.links_to_create),
    }


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description="Install FlowDesk FD-OC Omnigent agent templates.")
    parser.add_argument("--agent-root", default=str(default_agent_root()), help="Target Omnigent agent root. Default: ~/.omnigent/agents")
    parser.add_argument("--force", action="store_true", help="Overwrite existing template files and links.")
    parser.add_argument("--dry-run", action="store_true", help="Show the install plan without writing files.")
    parser.add_argument("--check", action="store_true", help="Report drift between installed templates and the packaged version, without writing.")
    args = parser.parse_args(argv)

    if args.check:
        result = check_templates(Path(args.agent_root))
        _print_result(result)
        return 0 if result["status"] in {"current", "not_installed"} else 3

    result = install_templates(Path(args.agent_root), force=args.force, dry_run=args.dry_run)
    _print_result(result)
    return 0 if result["status"] in {"installed", "dry_run"} else 2


def _write_manifest(plan: InstallPlan) -> None:
    checksums = {
        str(path.relative_to(plan.target_root)): _sha256(text)
        for path, text in plan.files_to_write
    }
    manifest = {
        "schema": "flowdesk.omnigent_template_manifest.v1",
        "version": _template_version(),
        "files": dict(sorted(checksums.items())),
    }
    try:
        plan.target_root.mkdir(parents=True, exist_ok=True)
        _manifest_path(plan.target_root).write_text(json.dumps(manifest, indent=2, sort_keys=True), encoding="utf-8")
    except OSError:
        return


def check_templates(target_root: Path | None = None) -> dict[str, object]:
    """Compare installed FD-OC templates against the packaged templates and report
    drift. Detects files a user edited (modified), files removed (missing), and an
    install left behind by a package upgrade (version mismatch)."""

    root = (target_root or default_agent_root()).expanduser()
    manifest = _read_manifest(root)
    if manifest is None and not any((root / rel).exists() for rel, _ in _iter_template_files()):
        return {"status": "not_installed", "target_root": str(root), "current_version": _template_version()}
    file_status: dict[str, str] = {}
    for relative_path, text in _iter_template_files():
        disk_path = root / relative_path
        rel = str(relative_path)
        if not disk_path.exists():
            file_status[rel] = "missing"
            continue
        try:
            file_status[rel] = "current" if disk_path.read_text(encoding="utf-8") == text else "modified"
        except OSError:
            file_status[rel] = "unreadable"
    drifted = {rel: state for rel, state in file_status.items() if state != "current"}
    installed_version = manifest.get("version") if isinstance(manifest, dict) else None
    current_version = _template_version()
    version_drift = isinstance(installed_version, str) and installed_version != current_version
    return {
        "status": "drift" if drifted or version_drift else "current",
        "target_root": str(root),
        "installed_version": installed_version,
        "current_version": current_version,
        "version_drift": version_drift,
        "drifted_files": dict(sorted(drifted.items())),
    }


def _iter_template_files() -> Iterable[tuple[Path, str]]:
    root = resources.files("flowdesk_omnigent")
    for part in TEMPLATE_ROOT_PARTS:
        root = root / part
    with resources.as_file(root) as root_path:
        for path in sorted(root_path.rglob("*.yaml")):
            yield (path.relative_to(root_path), path.read_text(encoding="utf-8"))


def _print_result(result: dict[str, object]) -> None:
    status = result["status"]
    print(f"flowdesk-omnigent-install-templates: {status}")
    print(f"target_root: {result['target_root']}")
    if status == "blocked_existing_paths":
        print("Existing paths block installation. Re-run with --force to overwrite:")
        for path in result.get("blocked_paths", []):
            print(f"  {path}")
    elif status == "dry_run":
        print(f"files_planned: {result['files_planned']}")
        print(f"links_planned: {result['links_planned']}")
    elif status in {"current", "drift", "not_installed"}:
        print(f"installed_version: {result.get('installed_version')}")
        print(f"current_version: {result.get('current_version')}")
        drifted = result.get("drifted_files") or {}
        if isinstance(drifted, dict) and drifted:
            print("drift detected. Re-run install with --force to restore packaged templates:")
            for rel, state in drifted.items():
                print(f"  {state}: {rel}")
        elif result.get("version_drift"):
            print("templates match content but were installed by a different package version.")
    else:
        print("installed agents: FD-OC, FD-OC-Opus, FD-OC-Codex")


if __name__ == "__main__":
    raise SystemExit(main(sys.argv[1:]))
