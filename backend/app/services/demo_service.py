"""Launch/inspect the bundled demo website and create the demo project."""
from __future__ import annotations

import atexit
import socket
import subprocess
import sys
import time
from pathlib import Path

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.config import get_settings
from app.models import Project, User

_proc: subprocess.Popen | None = None


def demo_url() -> str:
    return f"http://127.0.0.1:{get_settings().demo_site_port}/index.html"


def is_running() -> bool:
    port = get_settings().demo_site_port
    with socket.socket() as s:
        s.settimeout(0.3)
        return s.connect_ex(("127.0.0.1", port)) == 0


def ensure_demo_server() -> bool:
    """Start the static demo server (loopback only) if it is not already running."""
    global _proc
    if is_running():
        return True
    s = get_settings()
    root = Path(s.demo_site_dir)
    if not (root / "index.html").is_file():
        return False
    _proc = subprocess.Popen(
        [sys.executable, "-I", "-m", "http.server", str(s.demo_site_port), "--bind", "127.0.0.1", "--directory", str(root)],
        stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL,
    )
    atexit.register(stop_demo_server)
    for _ in range(40):
        if is_running():
            return True
        time.sleep(0.1)
    return False


def stop_demo_server() -> None:
    global _proc
    if _proc and _proc.poll() is None:
        _proc.terminate()
    _proc = None


def get_or_create_demo_project(db: Session, user: User) -> Project:
    existing = db.scalars(select(Project).where(Project.owner_id == user.id, Project.is_demo.is_(True))).first()
    if existing:
        return existing
    s = get_settings()
    p = Project(
        owner_id=user.id, name="Northwind demo site (deliberate UI bugs)",
        description="Bundled demo target with a clipped checkout button, a misaligned card, wrapping navigation and an overlapping validation message. A responsive section acts as a control.",
        target_url=demo_url(), environment="local", source_dir=str(Path(s.demo_site_dir).resolve()),
        viewports=["desktop", "tablet", "mobile"], is_demo=True,
        scan_notes="Seeded demo project - not production data.", repo_path_prefix="demo-site",
    )
    db.add(p)
    db.commit()
    db.refresh(p)
    return p
