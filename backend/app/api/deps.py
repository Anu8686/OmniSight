"""Shared API dependencies: DB session, authenticated user, ownership checks."""
from __future__ import annotations

from fastapi import Depends, HTTPException, Request, status
from sqlalchemy.orm import Session

from app.core.security import decode_access_token
from app.db.session import get_db
from app.models import Issue, ProposedFix, Project, Scan, User

COOKIE_NAME = "omnisight_session"


def current_user(request: Request, db: Session = Depends(get_db)) -> User:
    token = request.cookies.get(COOKIE_NAME)
    if not token:
        auth = request.headers.get("authorization", "")
        if auth.lower().startswith("bearer "):
            token = auth[7:].strip()
    uid = decode_access_token(token) if token else None
    user = db.get(User, uid) if uid else None
    if user is None or not user.is_active:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Authentication required.")
    return user


def owned_project(db: Session, user: User, project_id: int) -> Project:
    p = db.get(Project, project_id)
    if p is None or p.owner_id != user.id:
        raise HTTPException(404, "Project not found.")
    return p


def owned_scan(db: Session, user: User, scan_id: int) -> Scan:
    s = db.get(Scan, scan_id)
    if s is None or s.project.owner_id != user.id:
        raise HTTPException(404, "Scan not found.")
    return s


def owned_issue(db: Session, user: User, issue_id: int) -> Issue:
    i = db.get(Issue, issue_id)
    if i is None or i.project.owner_id != user.id:
        raise HTTPException(404, "Issue not found.")
    return i


def owned_fix(db: Session, user: User, fix_id: int) -> ProposedFix:
    f = db.get(ProposedFix, fix_id)
    if f is None or f.issue.project.owner_id != user.id:
        raise HTTPException(404, "Fix not found.")
    return f
