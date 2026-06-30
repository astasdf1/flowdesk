"""Install packaged FlowDesk Omnigent agent templates."""

from __future__ import annotations

import argparse
from dataclasses import dataclass
import os
from pathlib import Path
import shutil
import sys
from importlib import resources
from typing import Iterable

TEMPLATE_ROOT_PARTS = ("templates", "fd-oc")
PARENT_AGENT_NAMES = ("FD-OC", "FD-OC-Opus", "FD-OC-Codex")
SHARED_AGENT_SOURCE = "FD-OC"


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
    args = parser.parse_args(argv)

    result = install_templates(Path(args.agent_root), force=args.force, dry_run=args.dry_run)
    _print_result(result)
    return 0 if result["status"] in {"installed", "dry_run"} else 2


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
    else:
        print("installed agents: FD-OC, FD-OC-Opus, FD-OC-Codex")


if __name__ == "__main__":
    raise SystemExit(main(sys.argv[1:]))
