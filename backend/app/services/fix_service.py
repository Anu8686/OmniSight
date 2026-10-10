"""Human-approved self-healing workflow: propose -> approve -> apply (isolated workspace) -> verify -> rollback.

Safety properties
-----------------
* Only CSS rule blocks that pass `css_guard` are ever written, and only as an *appended* override block.
* Changes go to a COPY of the source directory inside the server's data dir; the original is never modified.
* No shell commands from AI output are executed. The only subprocess is a static file server bound to
  127.0.0.1 serving the workspace copy for the verification scan.
* Approval is explicit, recorded in the audit log, and required before apply/verify/PR.
"""
from __future__ import annotations

import difflib
import re
import shutil
import socket
import subprocess
import sys
import time
from datetime import datetime, timezone
from pathlib import Path
from urllib.parse import urlsplit

import httpx
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.config import get_settings
from app.models import FixVerification, Issue, ProposedFix, Project, Scan, Screenshot, User
from app.security.css_guard import UnsafeCssError, validate_css_patch
from app.services.audit import audit
from app.services.scan_service import create_scan, execute_scan, scan_issue_keys

MAX_WORKSPACE_BYTES = 20 * 1024 * 1024
MAX_WORKSPACE_FILES = 500


class FixError(Exception):
    def __init__(self, message: str, status: int = 409):
        super().__init__(message)
        self.message, self.status = message, status


def _now() -> datetime:
    return datetime.now(timezone.utc)


def resolve_source_dir(project: Project) -> Path | None:
    if not project.source_dir:
        return None
    p = Path(project.source_dir).resolve()
    roots = get_settings().allowed_source_roots_list
    if not any(p == r or r in p.parents for r in roots) or not p.is_dir():
        return None
    return p


def validate_source_dir(value: str | None) -> str | None:
    if not value:
        return None
    p = Path(value).expanduser().resolve()
    roots = get_settings().allowed_source_roots_list
    if not p.is_dir() or not any(p == r or r in p.parents for r in roots):
        raise ValueError("Source directory must exist and be inside ALLOWED_SOURCE_ROOTS.")
    return str(p)


def _safe_file(base: Path, rel: str) -> Path:
    rel = rel.replace("\\", "/").lstrip("/")
    target = (base / rel).resolve()
    if base.resolve() not in target.parents or target.suffix.lower() != ".css":
        raise FixError("Fixes may only modify .css files inside the project source directory.", 422)
    return target


def extract_related_rules(css_text: str, selector: str, limit: int = 4) -> str:
    tokens = [t for t in re.findall(r"[.#][A-Za-z_][\w-]*", selector)]
    if not tokens:
        return ""
    blocks = []
    for m in re.finditer(r"([^{}@]+)\{([^{}]*)\}", css_text):
        sel = m.group(1).strip()
        if any(t in sel for t in tokens[-2:]):
            blocks.append(f"{sel} {{{m.group(2).rstrip()}\n}}")
        if len(blocks) >= limit:
            break
    return "\n\n".join(blocks)


# ------------------------------------------------------------------ propose
def propose_fix(db: Session, issue: Issue, project: Project, user: User) -> ProposedFix:
    sf = issue.suggested_fix
    if not sf or not sf.get("code"):
        raise FixError("This finding has no automatic fix suggestion. Review it manually.", 422)
    try:
        code = validate_css_patch(sf["code"])
    except UnsafeCssError as exc:
        raise FixError(f"The suggested change was rejected by the safety checks: {exc}", 422) from exc
    existing = db.scalars(
        select(ProposedFix).where(ProposedFix.issue_id == issue.id, ProposedFix.status.in_(["proposed", "approved", "applied"]))
    ).first()
    if existing:
        return existing

    original = ""
    src = resolve_source_dir(project)
    file = sf.get("file") or "styles.css"
    if src:
        try:
            target = _safe_file(src, file)
            if target.is_file():
                original = extract_related_rules(target.read_text(encoding="utf-8", errors="replace"), issue.evidence.get("element_selector") or "")
        except FixError:
            raise
    fix = ProposedFix(
        issue_id=issue.id, file=file, explanation=sf.get("explanation", ""), code=code,
        original_snippet=original, status="proposed", origin=issue.source,
    )
    db.add(fix)
    issue.status = "fix_proposed"
    db.commit()
    db.refresh(fix)
    audit(db, user.id, "fix.proposed", "fix", fix.id, issue_id=issue.id)
    return fix


# ------------------------------------------------------------------ approve / reject
def approve_fix(db: Session, fix: ProposedFix, user: User, comment: str = "") -> ProposedFix:
    if fix.status != "proposed":
        raise FixError(f"Only proposed fixes can be approved (current status: {fix.status}).")
    fix.status, fix.approved_by, fix.approved_at = "approved", user.id, _now()
    fix.issue.status, fix.issue.reviewer = "fix_approved", user.name
    if comment:
        fix.issue.reviewer_comment = comment
    db.commit()
    audit(db, user.id, "fix.approved", "fix", fix.id, issue_id=fix.issue_id, comment=comment[:200])
    return fix


def reject_fix(db: Session, fix: ProposedFix, user: User, comment: str = "") -> ProposedFix:
    if fix.status not in ("proposed", "approved"):
        raise FixError(f"This fix can no longer be rejected (current status: {fix.status}).")
    fix.status = "rejected"
    fix.issue.status, fix.issue.reviewer = "open", user.name
    if comment:
        fix.issue.reviewer_comment = comment
    db.commit()
    audit(db, user.id, "fix.rejected", "fix", fix.id, issue_id=fix.issue_id, comment=comment[:200])
    return fix


# ------------------------------------------------------------------ apply (isolated workspace)
def _copy_source(src: Path, dest: Path) -> None:
    total = files = 0
    for p in src.rglob("*"):
        if p.is_symlink() or any(part.startswith(".") for part in p.relative_to(src).parts):
            continue
        if p.is_file():
            files += 1
            total += p.stat().st_size
            if files > MAX_WORKSPACE_FILES or total > MAX_WORKSPACE_BYTES:
                raise FixError("The source directory is too large to copy into an isolated workspace.", 422)
    shutil.copytree(
        src, dest, symlinks=False,
        ignore=shutil.ignore_patterns(".*", "node_modules", "__pycache__", "*.pyc", "serve.py"),
    )


def build_patch(original: str, patched: str, file: str) -> str:
    return "".join(
        difflib.unified_diff(
            original.splitlines(keepends=True), patched.splitlines(keepends=True),
            fromfile=f"a/{file}", tofile=f"b/{file}",
        )
    )


def patched_content(original: str, fix: ProposedFix) -> str:
    block = f"\n\n/* OmniSight fix #{fix.id} for issue #{fix.issue_id} (human-approved) */\n{fix.code}\n"
    return original.rstrip("\n") + block


def apply_fix(db: Session, fix: ProposedFix, project: Project, user: User) -> ProposedFix:
    if fix.status not in ("approved",):
        raise FixError("A fix must be approved before it can be applied.")
    src = resolve_source_dir(project)
    if src is None:
        raise FixError(
            "This project has no local source directory configured, so OmniSight cannot apply the change. "
            "Use the suggested code manually or open a pull request.", 409,
        )
    ws = get_settings().workspaces_path / f"fix_{fix.id}"
    if ws.exists():
        shutil.rmtree(ws)
    site = ws / "site"
    _copy_source(src, site)
    target = _safe_file(site, fix.file)
    if not target.is_file():
        shutil.rmtree(ws, ignore_errors=True)
        raise FixError(f"The file '{fix.file}' was not found in the project source.", 422)
    original = target.read_text(encoding="utf-8")
    (ws / "original").mkdir(exist_ok=True)
    (ws / "original" / target.name).write_text(original, encoding="utf-8")  # preserved for rollback
    patched = patched_content(original, fix)
    validate_css_patch(fix.code)
    target.write_text(patched, encoding="utf-8")
    fix.workspace_path = str(ws)
    fix.patch = build_patch(original, patched, fix.file)
    fix.status = "applied"
    fix.issue.status = "fix_applied"
    db.commit()
    audit(db, user.id, "fix.applied_in_workspace", "fix", fix.id, issue_id=fix.issue_id)
    return fix


def rollback_fix(db: Session, fix: ProposedFix, user: User) -> ProposedFix:
    if fix.workspace_path:
        ws = Path(fix.workspace_path).resolve()
        if get_settings().workspaces_path.resolve() in ws.parents:
            shutil.rmtree(ws, ignore_errors=True)
    fix.workspace_path = None
    fix.status = "rolled_back"
    fix.issue.status = "fix_proposed"
    db.commit()
    audit(db, user.id, "fix.rolled_back", "fix", fix.id, issue_id=fix.issue_id)
    return fix


# ------------------------------------------------------------------ verify
def _free_port() -> int:
    with socket.socket() as s:
        s.bind(("127.0.0.1", 0))
        return s.getsockname()[1]


def _start_static_server(directory: Path) -> tuple[subprocess.Popen, int]:
    port = _free_port()
    proc = subprocess.Popen(
        [sys.executable, "-I", "-m", "http.server", str(port), "--bind", "127.0.0.1", "--directory", str(directory)],
        stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL, cwd=str(directory),
    )
    for _ in range(50):
        try:
            if httpx.get(f"http://127.0.0.1:{port}/", timeout=0.5).status_code < 500:
                return proc, port
        except httpx.HTTPError:
            time.sleep(0.1)
    proc.terminate()
    raise FixError("The isolated verification server failed to start.", 500)


def verify_fix(db: Session, fix: ProposedFix, project: Project, user: User) -> FixVerification:
    if fix.status not in ("applied", "verified", "verification_failed") or not fix.workspace_path:
        raise FixError("Apply the approved fix in the isolated workspace before verifying.")
    issue = fix.issue
    site = Path(fix.workspace_path) / "site"
    if not site.is_dir():
        raise FixError("The isolated workspace no longer exists. Apply the fix again.")
    parts = urlsplit(project.target_url)
    path = (parts.path or "/") + (f"?{parts.query}" if parts.query else "")

    proc, port = _start_static_server(site)
    scan_id = None
    try:
        host = f"127.0.0.1:{port}"
        scan = create_scan(db, project, list(project.viewports), kind="verification", target_url=f"http://{host}{path}", parent_fix_id=fix.id)
        scan_id = scan.id
        execute_scan(scan.id, extra_allowed={host}, rules_only=True)  # independent, deterministic re-scan
    finally:
        proc.terminate()
        try:
            proc.wait(timeout=5)
        except subprocess.TimeoutExpired:
            proc.kill()

    db.expire_all()
    scan = db.get(Scan, scan_id)
    if scan.status != "completed":
        v = FixVerification(
            fix_id=fix.id, verification_scan_id=scan.id, resolved=False, status="error",
            summary=f"The verification scan did not complete: {scan.error_message or scan.status}",
        )
        db.add(v)
        db.commit()
        audit(db, user.id, "fix.verification_error", "fix", fix.id)
        return v

    before_keys = scan_issue_keys(db, issue.scan_id)
    after_keys = scan_issue_keys(db, scan.id)
    regressions = sorted(
        db.scalars(select(Issue.title).where(Issue.scan_id == scan.id, Issue.issue_key.notin_(before_keys))).all()
    )
    if issue.source != "rule-based":
        status, resolved = "inconclusive", False
        summary = "This finding came from the AI model and cannot be re-checked by deterministic rules. Compare the before/after screenshots manually."
    else:
        resolved = issue.issue_key not in after_keys
        status = "passed" if resolved and not regressions else "failed"
        if resolved and not regressions:
            summary = "The issue no longer appears at any scanned viewport and no new issues were introduced."
        elif resolved:
            summary = f"The issue is resolved but {len(regressions)} new issue(s) appeared."
        else:
            summary = "The issue is still detected after applying the fix."
    ev_vp = (issue.evidence or {}).get("viewport") or "desktop"
    after_shot = db.scalars(
        select(Screenshot).where(Screenshot.scan_id == scan.id, Screenshot.viewport == ev_vp).order_by(Screenshot.kind.asc())
    ).first()  # 'fullpage' sorts before 'viewport', so the full-page capture is preferred
    v = FixVerification(
        fix_id=fix.id, verification_scan_id=scan.id, resolved=resolved, status=status, regressions=regressions,
        before_screenshot_id=(issue.evidence or {}).get("screenshot_id"),
        after_screenshot_id=after_shot.id if after_shot else None, summary=summary,
    )
    db.add(v)
    ok = status == "passed"
    fix.status = "verified" if ok else "verification_failed"
    issue.status = "verified" if ok else "verification_failed"
    db.commit()
    db.refresh(v)
    audit(db, user.id, "fix.verified", "fix", fix.id, status=status, resolved=resolved, regressions=len(regressions))
    return v
