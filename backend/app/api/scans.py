from __future__ import annotations

from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException
from fastapi.responses import FileResponse
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.api.deps import current_user, owned_project, owned_scan
from app.api.issues import issue_out
from app.core.config import get_settings
from app.db.session import get_db
from app.models import Issue, Scan, Screenshot, User
from app.schemas.api import IssueOut, ScanCreate, ScanOut, ScreenshotOut
from app.security.rate_limit import scan_limiter
from app.security.url_guard import UnsafeTargetError, validate_target_url
from app.services import scan_service
from app.services.audit import audit

router = APIRouter(prefix="/api", tags=["scans"])


def scan_out(db: Session, s: Scan, with_shots: bool = True) -> ScanOut:
    out = ScanOut.model_validate(s)
    out.project_name = s.project.name
    counts = dict(db.execute(select(Issue.severity, func.count(Issue.id)).where(Issue.scan_id == s.id).group_by(Issue.severity)).all())
    out.severity_counts, out.issue_count = counts, sum(counts.values())
    if with_shots:
        out.screenshots = [
            ScreenshotOut(id=x.id, scan_id=x.scan_id, viewport=x.viewport, kind=x.kind, width=x.width, height=x.height,
                          url=f"/api/screenshots/{x.id}/file")
            for x in s.screenshots
        ]
    return out


@router.post("/scans", response_model=ScanOut, status_code=202, dependencies=[Depends(scan_limiter)])
def start_scan(body: ScanCreate, bg: BackgroundTasks, user: User = Depends(current_user), db: Session = Depends(get_db)):
    project = owned_project(db, user, body.project_id)
    try:
        validate_target_url(project.target_url)  # re-validate at scan time (DNS may have changed)
    except UnsafeTargetError as exc:
        raise HTTPException(422, str(exc)) from exc
    running = db.scalar(select(func.count(Scan.id)).where(Scan.project_id == project.id, Scan.status.in_(["queued", "running"])))
    if running:
        raise HTTPException(409, "A scan is already running for this project.")
    scan = scan_service.create_scan(db, project, body.viewports)
    audit(db, user.id, "scan.started", "scan", scan.id, project_id=project.id)
    bg.add_task(scan_service.execute_scan, scan.id)
    return scan_out(db, scan)


@router.get("/scans", response_model=list[ScanOut])
def list_scans(
    project_id: int | None = None, status: str | None = None, include_verification: bool = False,
    user: User = Depends(current_user), db: Session = Depends(get_db),
):
    from app.models import Project

    stmt = select(Scan).join(Project, Scan.project_id == Project.id).where(Project.owner_id == user.id).order_by(Scan.id.desc()).limit(200)
    if project_id:
        stmt = stmt.where(Scan.project_id == project_id)
    if status:
        stmt = stmt.where(Scan.status == status)
    if not include_verification:
        stmt = stmt.where(Scan.kind == "baseline")
    return [scan_out(db, s, with_shots=False) for s in db.scalars(stmt)]


@router.get("/scans/{scan_id}", response_model=ScanOut)
def get_scan(scan_id: int, user: User = Depends(current_user), db: Session = Depends(get_db)):
    return scan_out(db, owned_scan(db, user, scan_id))


@router.post("/scans/{scan_id}/cancel", response_model=ScanOut)
def cancel_scan(scan_id: int, user: User = Depends(current_user), db: Session = Depends(get_db)):
    scan = owned_scan(db, user, scan_id)
    if scan.status not in ("queued", "running"):
        raise HTTPException(409, f"The scan is already {scan.status}.")
    scan_service.request_cancel(db, scan)
    audit(db, user.id, "scan.cancelled", "scan", scan.id)
    return scan_out(db, scan)


@router.get("/scans/{scan_id}/issues", response_model=list[IssueOut])
def scan_issues(scan_id: int, user: User = Depends(current_user), db: Session = Depends(get_db)):
    scan = owned_scan(db, user, scan_id)
    return [issue_out(i) for i in db.scalars(select(Issue).where(Issue.scan_id == scan.id).order_by(Issue.id))]


@router.get("/screenshots/{shot_id}/file")
def screenshot_file(shot_id: int, user: User = Depends(current_user), db: Session = Depends(get_db)):
    shot = db.get(Screenshot, shot_id)
    if shot is None or shot.scan.project.owner_id != user.id:
        raise HTTPException(404, "Screenshot not found.")
    root = get_settings().screenshots_path.resolve()
    path = (root / shot.file_path).resolve()
    if root not in path.parents or not path.is_file():
        raise HTTPException(404, "Screenshot file is no longer available.")
    return FileResponse(path, media_type="image/png", headers={"Cache-Control": "private, max-age=3600"})
