from __future__ import annotations

from datetime import date, datetime, time, timezone

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.api.deps import current_user, owned_issue
from app.api.fixes import fix_out
from app.db.session import get_db
from app.models import FixVerification, Issue, ProposedFix, Project, Scan, User
from app.schemas.api import IssueDetail, IssueOut, IssueUpdate, Page, VerificationOut
from app.services.audit import audit

router = APIRouter(prefix="/api/issues", tags=["issues"])


def issue_out(i: Issue) -> IssueOut:
    out = IssueOut.model_validate(i)
    out.project_name = i.project.name
    return out


@router.get("", response_model=Page)
def list_issues(
    severity: str | None = None, status: str | None = None, project_id: int | None = None, viewport: str | None = None,
    category: str | None = None, date_from: date | None = None, date_to: date | None = None, q: str | None = None,
    include_verification: bool = False, page: int = Query(1, ge=1), page_size: int = Query(20, ge=1, le=100),
    user: User = Depends(current_user), db: Session = Depends(get_db),
):
    stmt = (
        select(Issue).join(Project, Issue.project_id == Project.id).join(Scan, Issue.scan_id == Scan.id)
        .where(Project.owner_id == user.id)
    )
    if not include_verification:
        stmt = stmt.where(Scan.kind == "baseline")
    if severity:
        stmt = stmt.where(Issue.severity == severity)
    if status:
        stmt = stmt.where(Issue.status == status)
    if project_id:
        stmt = stmt.where(Issue.project_id == project_id)
    if viewport:
        stmt = stmt.where(Issue.viewport.contains(viewport))
    if category:
        stmt = stmt.where(Issue.category == category)
    if date_from:
        stmt = stmt.where(Issue.created_at >= datetime.combine(date_from, time.min, tzinfo=timezone.utc))
    if date_to:
        stmt = stmt.where(Issue.created_at <= datetime.combine(date_to, time.max, tzinfo=timezone.utc))
    if q:
        stmt = stmt.where(Issue.title.ilike(f"%{q}%"))
    total = db.scalar(select(func.count()).select_from(stmt.subquery())) or 0
    rows = db.scalars(stmt.order_by(Issue.id.desc()).offset((page - 1) * page_size).limit(page_size)).all()
    return Page(items=[issue_out(i).model_dump(mode="json") for i in rows], total=total, page=page, page_size=page_size)


@router.get("/{issue_id}", response_model=IssueDetail)
def get_issue(issue_id: int, user: User = Depends(current_user), db: Session = Depends(get_db)):
    i = owned_issue(db, user, issue_id)
    out = IssueDetail.model_validate(i)
    out.project_name = i.project.name
    out.fixes = [fix_out(db, f) for f in i.fixes]
    out.verifications = [
        VerificationOut.model_validate(v)
        for v in db.scalars(
            select(FixVerification).join(ProposedFix, FixVerification.fix_id == ProposedFix.id)
            .where(ProposedFix.issue_id == i.id).order_by(FixVerification.id.desc())
        )
    ]
    return out


@router.patch("/{issue_id}", response_model=IssueOut)
def update_issue(issue_id: int, body: IssueUpdate, user: User = Depends(current_user), db: Session = Depends(get_db)):
    i = owned_issue(db, user, issue_id)
    data = body.model_dump(exclude_unset=True)
    if data.get("status") == "dismissed" and i.status in ("fix_applied",):
        raise HTTPException(409, "Roll back the applied fix before dismissing this issue.")
    for k, v in data.items():
        setattr(i, k, v)
    db.commit()
    audit(db, user.id, "issue.updated", "issue", i.id, fields=list(data))
    return issue_out(i)
