from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException
from pydantic import ValidationError
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.api.deps import current_user, owned_project
from app.db.session import get_db
from app.models import Issue, Project, Scan, User
from app.schemas.api import ProjectCreate, ProjectOut, ProjectUpdate
from app.security.url_guard import UnsafeTargetError, validate_target_url
from app.services import demo_service
from app.services.audit import audit
from app.services.fix_service import validate_source_dir

router = APIRouter(prefix="/api/projects", tags=["projects"])


def _check_url(url: str) -> None:
    try:
        validate_target_url(url)
    except UnsafeTargetError as exc:
        raise HTTPException(422, str(exc)) from exc


def _check_source(value: str | None) -> str | None:
    try:
        return validate_source_dir(value)
    except ValueError as exc:
        raise HTTPException(422, str(exc)) from exc


def project_out(db: Session, p: Project) -> ProjectOut:
    out = ProjectOut.model_validate(p)
    out.scan_count = db.scalar(select(func.count(Scan.id)).where(Scan.project_id == p.id, Scan.kind == "baseline")) or 0
    base_issue = (Issue.project_id == p.id) & Issue.scan_id.in_(select(Scan.id).where(Scan.kind == "baseline"))
    out.total_issue_count = db.scalar(select(func.count(Issue.id)).where(base_issue)) or 0
    out.open_issue_count = db.scalar(
        select(func.count(Issue.id)).where(base_issue, Issue.status.notin_(["verified", "dismissed"]))
    ) or 0
    last = db.scalars(select(Scan).where(Scan.project_id == p.id, Scan.kind == "baseline").order_by(Scan.id.desc())).first()
    if last:
        out.last_scan_at, out.last_scan_status, out.last_scan_id = last.created_at, last.status, last.id
    return out


@router.get("", response_model=list[ProjectOut])
def list_projects(q: str | None = None, user: User = Depends(current_user), db: Session = Depends(get_db)):
    stmt = select(Project).where(Project.owner_id == user.id).order_by(Project.id.desc())
    if q:
        stmt = stmt.where(Project.name.ilike(f"%{q}%"))
    return [project_out(db, p) for p in db.scalars(stmt)]


@router.post("", response_model=ProjectOut, status_code=201)
def create_project(body: ProjectCreate, user: User = Depends(current_user), db: Session = Depends(get_db)):
    _check_url(body.target_url)
    data = body.model_dump()
    data["source_dir"] = _check_source(data["source_dir"])
    p = Project(owner_id=user.id, **data)
    db.add(p)
    db.commit()
    db.refresh(p)
    audit(db, user.id, "project.created", "project", p.id)
    return project_out(db, p)


@router.post("/demo", response_model=ProjectOut, status_code=201)
def create_demo(user: User = Depends(current_user), db: Session = Depends(get_db)):
    """Start the bundled demo site (loopback only) and create the demo project."""
    if not demo_service.ensure_demo_server():
        raise HTTPException(500, "The demo site could not be started. Check that the demo-site folder exists.")
    p = demo_service.get_or_create_demo_project(db, user)
    audit(db, user.id, "project.demo_ready", "project", p.id)
    return project_out(db, p)


@router.get("/{project_id}", response_model=ProjectOut)
def get_project(project_id: int, user: User = Depends(current_user), db: Session = Depends(get_db)):
    return project_out(db, owned_project(db, user, project_id))


@router.patch("/{project_id}", response_model=ProjectOut)
def update_project(project_id: int, body: ProjectUpdate, user: User = Depends(current_user), db: Session = Depends(get_db)):
    p = owned_project(db, user, project_id)
    data = body.model_dump(exclude_unset=True)
    status_value = data.pop("status", None)
    current = ProjectCreate.model_validate({
        k: getattr(p, k) for k in ProjectCreate.model_fields
    }).model_dump()
    merged = {**current, **{k: v for k, v in data.items() if v is not None or k in ("github_repo_url", "github_branch", "source_dir")}}
    try:
        validated = ProjectCreate.model_validate(merged).model_dump()
    except ValidationError as exc:
        raise HTTPException(422, "; ".join(e["msg"] for e in exc.errors())) from exc
    if "target_url" in data and data["target_url"]:
        _check_url(validated["target_url"])
    if "source_dir" in data:
        validated["source_dir"] = _check_source(validated["source_dir"])
    for k in data:
        setattr(p, k, validated[k])
    if status_value:
        p.status = status_value
    db.commit()
    db.refresh(p)
    audit(db, user.id, "project.updated", "project", p.id, fields=list(data))
    return project_out(db, p)


@router.delete("/{project_id}", status_code=204)
def delete_project(project_id: int, user: User = Depends(current_user), db: Session = Depends(get_db)):
    p = owned_project(db, user, project_id)
    db.delete(p)
    db.commit()
    audit(db, user.id, "project.deleted", "project", project_id)
