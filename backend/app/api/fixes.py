from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import PlainTextResponse
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.api.deps import current_user, owned_fix, owned_issue
from app.db.session import get_db
from app.models import FixVerification, ProposedFix, Project, Issue, User
from app.schemas.api import DecisionIn, FixOut, VerificationOut
from app.services import fix_service
from app.services.fix_service import FixError

router = APIRouter(prefix="/api", tags=["fixes"])


def fix_out(db: Session, f: ProposedFix) -> FixOut:
    out = FixOut.model_validate(f)
    project = f.issue.project
    out.can_apply = fix_service.resolve_source_dir(project) is not None
    out.source_note = (
        "" if out.can_apply else
        "No local source directory is linked to this project, so this is a code suggestion only (copy it or open a pull request)."
    )
    out.issue_title, out.issue_severity = f.issue.title, f.issue.severity
    out.project_id, out.project_name = project.id, project.name
    latest = db.scalars(select(FixVerification).where(FixVerification.fix_id == f.id).order_by(FixVerification.id.desc())).first()
    out.latest_verification = VerificationOut.model_validate(latest) if latest else None
    return out


def _wrap(call):
    try:
        return call()
    except FixError as exc:
        raise HTTPException(exc.status, exc.message) from exc


@router.post("/issues/{issue_id}/propose-fix", response_model=FixOut, status_code=201)
def propose(issue_id: int, user: User = Depends(current_user), db: Session = Depends(get_db)):
    issue = owned_issue(db, user, issue_id)
    return fix_out(db, _wrap(lambda: fix_service.propose_fix(db, issue, issue.project, user)))


@router.get("/fixes", response_model=list[FixOut])
def list_fixes(status: str | None = None, user: User = Depends(current_user), db: Session = Depends(get_db)):
    stmt = (
        select(ProposedFix).join(Issue, ProposedFix.issue_id == Issue.id).join(Project, Issue.project_id == Project.id)
        .where(Project.owner_id == user.id).order_by(ProposedFix.id.desc()).limit(200)
    )
    if status:
        stmt = stmt.where(ProposedFix.status == status)
    return [fix_out(db, f) for f in db.scalars(stmt)]


@router.get("/fixes/{fix_id}", response_model=FixOut)
def get_fix(fix_id: int, user: User = Depends(current_user), db: Session = Depends(get_db)):
    return fix_out(db, owned_fix(db, user, fix_id))


@router.post("/fixes/{fix_id}/approve", response_model=FixOut)
def approve(fix_id: int, body: DecisionIn | None = None, user: User = Depends(current_user), db: Session = Depends(get_db)):
    fix = owned_fix(db, user, fix_id)
    return fix_out(db, _wrap(lambda: fix_service.approve_fix(db, fix, user, (body.comment if body else ""))))


@router.post("/fixes/{fix_id}/reject", response_model=FixOut)
def reject(fix_id: int, body: DecisionIn | None = None, user: User = Depends(current_user), db: Session = Depends(get_db)):
    fix = owned_fix(db, user, fix_id)
    return fix_out(db, _wrap(lambda: fix_service.reject_fix(db, fix, user, (body.comment if body else ""))))


@router.post("/fixes/{fix_id}/apply", response_model=FixOut)
def apply(fix_id: int, user: User = Depends(current_user), db: Session = Depends(get_db)):
    fix = owned_fix(db, user, fix_id)
    return fix_out(db, _wrap(lambda: fix_service.apply_fix(db, fix, fix.issue.project, user)))


@router.post("/fixes/{fix_id}/verify", response_model=VerificationOut)
def verify(fix_id: int, user: User = Depends(current_user), db: Session = Depends(get_db)):
    fix = owned_fix(db, user, fix_id)
    return VerificationOut.model_validate(_wrap(lambda: fix_service.verify_fix(db, fix, fix.issue.project, user)))


@router.post("/fixes/{fix_id}/rollback", response_model=FixOut)
def rollback(fix_id: int, user: User = Depends(current_user), db: Session = Depends(get_db)):
    fix = owned_fix(db, user, fix_id)
    if fix.status not in ("applied", "verified", "verification_failed"):
        raise HTTPException(409, "Only applied fixes can be rolled back.")
    return fix_out(db, fix_service.rollback_fix(db, fix, user))


@router.get("/fixes/{fix_id}/verifications", response_model=list[VerificationOut])
def verifications(fix_id: int, user: User = Depends(current_user), db: Session = Depends(get_db)):
    fix = owned_fix(db, user, fix_id)
    return [VerificationOut.model_validate(v) for v in sorted(fix.verifications, key=lambda v: -v.id)]


@router.get("/fixes/{fix_id}/patch", response_class=PlainTextResponse)
def download_patch(fix_id: int, user: User = Depends(current_user), db: Session = Depends(get_db)):
    fix = owned_fix(db, user, fix_id)
    if fix.patch:
        text = fix.patch
    else:
        text = f"# OmniSight suggested change for {fix.file} (not yet applied)\n# Append to the end of the file:\n\n{fix.code}\n"
    return PlainTextResponse(text, headers={"Content-Disposition": f'attachment; filename="omnisight-fix-{fix.id}.patch"'})
