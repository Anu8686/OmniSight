from __future__ import annotations

import logging
from datetime import datetime, timezone
from pathlib import Path

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.api.deps import current_user, owned_fix
from app.core.config import get_settings
from app.db.session import get_db
from app.github import service as gh
from app.models import Integration, User
from app.schemas.api import PullRequestIn, PullRequestPreviewIn
from app.services import fix_service
from app.services.audit import audit

log = logging.getLogger("omnisight.github")
router = APIRouter(prefix="/api/integrations", tags=["integrations"])
PR_READY = {"approved", "applied", "verified", "verification_failed"}


def _http_client():
    """Indirection so tests can inject a mock transport."""
    return None


@router.get("/github/status")
def github_status(user: User = Depends(current_user), db: Session = Depends(get_db)):
    s = get_settings()
    out = {
        "configured": s.github_configured,
        "mode": "live" if s.github_configured else "simulated",
        "repository": s.github_repository or None,
        "token_present": bool(s.github_token),  # never the token itself
        "connection": "not_configured", "can_push": None, "default_branch": None, "message": "",
        "instructions": [
            "Create a fine-grained personal access token limited to one repository with Contents and Pull requests (read & write).",
            "Set GITHUB_TOKEN and GITHUB_REPOSITORY=owner/repo in backend/.env, then restart the backend.",
            "Without them OmniSight runs a SIMULATED pull-request flow that never contacts GitHub.",
        ],
    }
    if s.github_configured:
        try:
            info = gh.get_client(s, _http_client()).check()
            out.update(connection="ok" if info["can_push"] else "read_only", can_push=info["can_push"],
                       default_branch=info["default_branch"],
                       message="Connected." if info["can_push"] else "Token can read but not push to this repository.")
        except gh.GitHubError as exc:
            out.update(connection="error", message=exc.message)
    else:
        out["message"] = "GitHub is not configured. Pull requests are simulated."
    integ = db.query(Integration).filter_by(user_id=user.id, provider="github").first() or Integration(user_id=user.id, provider="github")
    integ.repository, integ.last_status, integ.last_checked_at = s.github_repository or None, out["connection"], datetime.now(timezone.utc)
    db.add(integ)
    db.commit()
    return out


def _repo_file(project, fix) -> str:
    prefix = project.repo_path_prefix.strip("/")
    return f"{prefix}/{fix.file}" if prefix else fix.file


def _pr_text(fix) -> tuple[str, str, str]:
    title = f"fix(ui): {fix.issue.title[:120]}"
    commit = f"fix(ui): {fix.issue.title[:100]} (OmniSight fix #{fix.id})"
    body = (
        f"## {fix.issue.title}\n\n{fix.issue.description}\n\n**Severity:** {fix.issue.severity}  \n"
        f"**Viewport(s):** {fix.issue.viewport}  \n**Detected by:** {fix.issue.source} analysis\n\n"
        f"### Proposed CSS (`{fix.file}`)\n```css\n{fix.code}\n```\n\n{fix.explanation}\n\n"
        f"_Reviewed and approved by a human in OmniSight before this pull request was opened._"
    )
    return title, commit, body


@router.post("/github/pull-requests/preview")
def preview_pr(body: PullRequestPreviewIn, user: User = Depends(current_user), db: Session = Depends(get_db)):
    fix = owned_fix(db, user, body.fix_id)
    project = fix.issue.project
    title, commit, text = _pr_text(fix)
    s = get_settings()
    src = fix_service.resolve_source_dir(project)
    diff = fix.patch
    if not diff and src:
        try:
            target = fix_service._safe_file(src, fix.file)
            orig = target.read_text(encoding="utf-8")
            diff = fix_service.build_patch(orig, fix_service.patched_content(orig, fix), fix.file)
        except Exception:  # noqa: BLE001
            diff = None
    return {
        "mode": "live" if s.github_configured else "simulated",
        "repository": s.github_repository or "owner/repo (simulated)",
        "base_branch": project.github_branch or "default branch",
        "head_branch": f"omnisight/fix-{fix.id}",
        "title": title, "commit_message": commit, "body": text,
        "files": [{"path": _repo_file(project, fix), "change": "append CSS override block", "diff": diff, "code": fix.code}],
        "ready": fix.status in PR_READY,
        "not_ready_reason": None if fix.status in PR_READY else "The fix must be approved by a reviewer first.",
    }


@router.post("/github/pull-requests")
def create_pr(body: PullRequestIn, user: User = Depends(current_user), db: Session = Depends(get_db)):
    if not body.approve:
        raise HTTPException(400, "Explicit approval is required to create a pull request.")
    fix = owned_fix(db, user, body.fix_id)
    if fix.status not in PR_READY:
        raise HTTPException(409, "The fix must be approved before a pull request can be opened.")
    project = fix.issue.project
    title, commit, text = _pr_text(fix)
    s = get_settings()
    try:
        result = gh.create_pull_request(
            s, project_repo_url=project.github_repo_url, base_branch=project.github_branch, repo_file=_repo_file(project, fix),
            fix_id=fix.id, transform=lambda original: fix_service.patched_content(original, fix),
            title=body.title or title, commit_message=body.commit_message or commit, body=text, http=_http_client(),
        )
    except gh.GitHubError as exc:
        log.warning("pull request failed: %s", exc.message)
        audit(db, user.id, "github.pr_failed", "fix", fix.id, reason=exc.message)
        raise HTTPException(exc.status if 400 <= exc.status < 600 else 502, exc.message) from exc
    fix.pr_url, fix.pr_status, fix.pr_simulated = result.url, result.status, result.simulated
    db.commit()
    audit(db, user.id, "github.pr_created", "fix", fix.id, simulated=result.simulated, branch=result.branch)
    return {"url": result.url, "number": result.number, "branch": result.branch, "simulated": result.simulated, "status": result.status}
