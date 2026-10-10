from __future__ import annotations

from collections import Counter
from datetime import datetime, timedelta, timezone

from fastapi import APIRouter, Depends
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.api.deps import current_user
from app.api.issues import issue_out
from app.api.projects import project_out
from app.api.scans import scan_out
from app.core.config import get_settings
from app.db.session import get_db
from app.models import Issue, ProposedFix, Project, Scan, Screenshot, User

router = APIRouter(prefix="/api", tags=["dashboard"])


def _sample() -> dict:
    """Illustrative placeholder shown ONLY when the account has no data. Always flagged is_sample=True."""
    today = datetime.now(timezone.utc).date()
    return {
        "is_sample": True,
        "sample_label": "Sample data - illustrative only. Create a project and run a scan to see your own metrics.",
        "totals": {"projects": 3, "scans": 18, "bugs_detected": 41, "fixes_verified": 12},
        "severity_distribution": {"critical": 6, "high": 11, "medium": 17, "low": 7},
        "scan_outcomes": {"completed": 15, "failed": 2, "cancelled": 1},
        "activity": [
            {"date": (today - timedelta(days=13 - i)).isoformat(), "completed": c, "failed": f}
            for i, (c, f) in enumerate([(1, 0), (0, 0), (2, 0), (1, 1), (0, 0), (3, 0), (1, 0), (2, 1), (0, 0), (1, 0), (2, 0), (1, 0), (0, 0), (1, 0)])
        ],
        "viewport_coverage": {"desktop": 18, "tablet": 17, "mobile": 18},
        "recent_scans": [], "recent_issues": [], "recent_projects": [],
    }


@router.get("/dashboard")
def dashboard(user: User = Depends(current_user), db: Session = Depends(get_db)):
    project_ids = select(Project.id).where(Project.owner_id == user.id)
    n_projects = db.scalar(select(func.count(Project.id)).where(Project.owner_id == user.id)) or 0
    base_scans = select(Scan.id).where(Scan.project_id.in_(project_ids), Scan.kind == "baseline")
    n_scans = db.scalar(select(func.count()).select_from(base_scans.subquery())) or 0
    if n_projects == 0 and n_scans == 0:
        return _sample()
    sev = dict(db.execute(select(Issue.severity, func.count(Issue.id)).where(Issue.scan_id.in_(base_scans)).group_by(Issue.severity)).all())
    outcomes = dict(db.execute(select(Scan.status, func.count(Scan.id)).where(Scan.id.in_(base_scans)).group_by(Scan.status)).all())
    verified = db.scalar(
        select(func.count(ProposedFix.id)).join(Issue, ProposedFix.issue_id == Issue.id)
        .where(Issue.project_id.in_(project_ids), ProposedFix.status == "verified")
    ) or 0
    since = datetime.now(timezone.utc) - timedelta(days=13)
    recent = db.scalars(select(Scan).where(Scan.id.in_(base_scans), Scan.created_at >= since.replace(hour=0, minute=0, second=0))).all()
    by_day: dict[str, Counter] = {}
    for sc in recent:
        by_day.setdefault(sc.created_at.date().isoformat(), Counter())[sc.status] += 1
    today = datetime.now(timezone.utc).date()
    activity = []
    for i in range(14):
        d = (today - timedelta(days=13 - i)).isoformat()
        c = by_day.get(d, Counter())
        activity.append({"date": d, "completed": c["completed"], "failed": c["failed"] + c["cancelled"]})
    cov = dict(db.execute(
        select(Screenshot.viewport, func.count(func.distinct(Screenshot.scan_id)))
        .where(Screenshot.scan_id.in_(base_scans), Screenshot.kind == "viewport").group_by(Screenshot.viewport)
    ).all())
    return {
        "is_sample": False, "sample_label": "",
        "totals": {"projects": n_projects, "scans": n_scans, "bugs_detected": sum(sev.values()), "fixes_verified": verified},
        "severity_distribution": {k: sev.get(k, 0) for k in ("critical", "high", "medium", "low")},
        "scan_outcomes": {k: outcomes.get(k, 0) for k in ("completed", "failed", "cancelled")},
        "activity": activity,
        "viewport_coverage": {k: cov.get(k, 0) for k in ("desktop", "tablet", "mobile")},
        "recent_scans": [scan_out(db, s, with_shots=False).model_dump(mode="json") for s in db.scalars(
            select(Scan).where(Scan.id.in_(base_scans)).order_by(Scan.id.desc()).limit(6))],
        "recent_issues": [issue_out(i).model_dump(mode="json") for i in db.scalars(
            select(Issue).where(Issue.scan_id.in_(base_scans)).order_by(Issue.id.desc()).limit(6))],
        "recent_projects": [project_out(db, p).model_dump(mode="json") for p in db.scalars(
            select(Project).where(Project.owner_id == user.id).order_by(Project.id.desc()).limit(5))],
    }


@router.get("/settings")
def app_settings(user: User = Depends(current_user)):
    s = get_settings()
    return {
        "environment": s.environment,
        "ai": {
            "configured": s.ai_configured, "provider": s.ai_provider or None, "model": s.ai_model or None,
            "mode": "vlm+rules" if s.ai_configured else "rule-based-demo",
            "message": "Vision model active. Findings from the model are suggestions and are labelled as such."
            if s.ai_configured else "Demo mode: deterministic rule-based checks only. Set AI_PROVIDER, AI_MODEL and an API key in backend/.env to enable a vision model.",
        },
        "github": {"configured": s.github_configured, "repository": s.github_repository or None},
        "allowed_scan_hosts": s.allowed_hosts_list,
        "auth_mode": "cookie-session (HttpOnly JWT, scrypt password hashing)",
        "limits": {"scan_timeout_seconds": s.scan_timeout_seconds, "max_dom_elements": s.max_dom_elements},
    }
