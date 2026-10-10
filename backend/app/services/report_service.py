"""Scan report assembly and JSON/CSV export."""
from __future__ import annotations

import csv
import io
from datetime import datetime, timezone

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models import FixVerification, Issue, ProposedFix, Scan

SEV_ORDER = ["critical", "high", "medium", "low"]


def build_report(db: Session, scan: Scan) -> dict:
    issues = db.scalars(select(Issue).where(Issue.scan_id == scan.id).order_by(Issue.id)).all()
    grouped = {s: [] for s in SEV_ORDER}
    for i in issues:
        grouped.setdefault(i.severity, []).append({
            "id": i.id, "title": i.title, "category": i.category, "severity": i.severity, "viewport": i.viewport,
            "confidence": i.confidence, "source": i.source, "status": i.status, "description": i.description,
            "element_selector": (i.evidence or {}).get("element_selector"),
            "suggested_fix": i.suggested_fix,
        })
    fixes = db.scalars(
        select(ProposedFix).join(Issue, ProposedFix.issue_id == Issue.id).where(Issue.scan_id == scan.id)
    ).all()
    verifs = []
    for f in fixes:
        for v in f.verifications:
            verifs.append({
                "fix_id": f.id, "issue_id": f.issue_id, "issue_title": f.issue.title, "status": v.status, "resolved": v.resolved,
                "regressions": v.regressions, "summary": v.summary, "verification_scan_id": v.verification_scan_id,
                "before_screenshot_id": v.before_screenshot_id, "after_screenshot_id": v.after_screenshot_id,
                "created_at": v.created_at.isoformat(),
            })
    return {
        "generated_at": datetime.now(timezone.utc).isoformat(),
        "analysis_mode": scan.analysis_mode,
        "analysis_label": (
            "Rule-based demo analysis (no vision model configured)" if scan.analysis_mode == "rule-based-demo"
            else "Vision model findings plus rule-based checks"
        ),
        "scan": {
            "id": scan.id, "project_id": scan.project_id, "kind": scan.kind, "status": scan.status, "target_url": scan.target_url,
            "final_url": scan.final_url, "page_title": scan.page_title, "viewports": scan.viewports,
            "created_at": scan.created_at.isoformat(), "finished_at": scan.finished_at.isoformat() if scan.finished_at else None,
            "error_message": scan.error_message,
        },
        "summary": {"total_findings": len(issues), "by_severity": {s: len(grouped[s]) for s in SEV_ORDER}},
        "viewport_metrics": scan.viewport_metrics,
        "console_errors": scan.console_errors,
        "failed_requests": scan.failed_requests,
        "notes": scan.ai_notes,
        "findings_by_severity": grouped,
        "verifications": verifs,
    }


def report_csv(report: dict) -> str:
    buf = io.StringIO()
    w = csv.writer(buf)
    w.writerow(["id", "severity", "category", "title", "viewport", "confidence", "source", "status", "element_selector", "description"])
    for sev in SEV_ORDER:
        for f in report["findings_by_severity"].get(sev, []):
            row = [f["id"], f["severity"], f["category"], f["title"], f["viewport"], f["confidence"], f["source"], f["status"],
                   f["element_selector"] or "", f["description"]]
            # Neutralise spreadsheet formula injection from page-derived text.
            w.writerow([("'" + c) if isinstance(c, str) and c[:1] in "=+-@\t\r" and c else c for c in row])
    return buf.getvalue()
