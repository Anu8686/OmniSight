"""Scan lifecycle: create, execute in background, persist screenshots + findings, cancel."""
from __future__ import annotations

import logging
from datetime import datetime, timezone

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.ai.providers import build_provider
from app.ai.service import analyze_scan
from app.browser.scanner import ScanCancelled, ScanError, ScanResult, run_scan
from app.core.config import get_settings
from app.db.session import SessionLocal
from app.models import Issue, Project, Scan, Screenshot

log = logging.getLogger("omnisight.scan")


def _now() -> datetime:
    return datetime.now(timezone.utc)


def create_scan(
    db: Session, project: Project, viewports: list[str] | None = None, *, kind: str = "baseline",
    target_url: str | None = None, parent_fix_id: int | None = None,
) -> Scan:
    scan = Scan(
        project_id=project.id, kind=kind, target_url=target_url or project.target_url,
        viewports=list(viewports or project.viewports), parent_fix_id=parent_fix_id,
        status="queued", stage="Queued", progress=0,
    )
    db.add(scan)
    db.commit()
    db.refresh(scan)
    return scan


def request_cancel(db: Session, scan: Scan) -> Scan:
    if scan.status in ("queued", "running"):
        scan.status = "cancelled"
        scan.stage = "Cancelled by user"
        scan.finished_at = _now()
        db.commit()
    return scan


def execute_scan(scan_id: int, extra_allowed: set[str] | None = None, rules_only: bool = False) -> None:
    """Runs in a worker thread (FastAPI background task). Uses its own DB session."""
    s = get_settings()
    db = SessionLocal()
    try:
        scan = db.get(Scan, scan_id)
        if scan is None or scan.status == "cancelled":
            return
        project = db.get(Project, scan.project_id)
        scan.status, scan.started_at, scan.stage, scan.progress = "running", _now(), "Starting", 2
        db.commit()

        def cancelled() -> bool:
            with SessionLocal() as chk:
                cur = chk.get(Scan, scan_id)
                return cur is None or cur.status == "cancelled"

        def progress(stage: str, pct: int) -> None:
            with SessionLocal() as upd:
                cur = upd.get(Scan, scan_id)
                if cur and cur.status == "running":
                    cur.stage, cur.progress = stage, pct
                    upd.commit()

        try:
            result = run_scan(
                scan.target_url, scan.viewports, s.screenshots_path / f"scan_{scan_id}", f"scan_{scan_id}",
                extra_allowed=extra_allowed, cancel_check=cancelled, on_progress=progress,
                timeout_s=s.scan_timeout_seconds, max_elements=s.max_dom_elements,
            )
            progress("Analyzing with " + ("rules" if rules_only or not s.ai_configured else "vision model + rules"), 85)
            provider = None if rules_only else build_provider(s)
            analysis = analyze_scan(result, s.screenshots_path, provider, result.page_title, project.expectations if project else "")
            if cancelled():
                raise ScanCancelled()
            _persist(db, scan, result, analysis)
            scan.status, scan.stage, scan.progress, scan.finished_at = "completed", "Completed", 100, _now()
            db.commit()
        except ScanCancelled:
            db.rollback()
            scan = db.get(Scan, scan_id)
            scan.status, scan.stage, scan.finished_at = "cancelled", "Cancelled by user", _now()
            db.commit()
        except ScanError as exc:
            db.rollback()
            scan = db.get(Scan, scan_id)
            scan.status, scan.stage, scan.error_message, scan.finished_at = "failed", "Failed", str(exc), _now()
            db.commit()
        except Exception:  # noqa: BLE001 - never leak internals to the user
            log.exception("scan %s crashed", scan_id)
            db.rollback()
            scan = db.get(Scan, scan_id)
            scan.status, scan.stage, scan.finished_at = "failed", "Failed", _now()
            scan.error_message = "An unexpected error interrupted the scan. Check the server logs."
            db.commit()
    finally:
        db.close()


def _persist(db: Session, scan: Scan, result: ScanResult, analysis) -> None:
    shot_rows: dict[tuple[str, str], Screenshot] = {}
    for name, vr in result.viewports.items():
        for sh in vr.shots:
            row = Screenshot(scan_id=scan.id, viewport=sh.viewport, kind=sh.kind, width=sh.width, height=sh.height, file_path=sh.rel_path)
            db.add(row)
            shot_rows[(sh.viewport, sh.kind)] = row
    db.flush()

    def best_shot(vp: str) -> Screenshot | None:
        return shot_rows.get((vp, "fullpage")) or shot_rows.get((vp, "viewport"))

    for m in analysis.issues:
        f = m.finding
        by_vp = {}
        for vp in m.viewports:
            sh = best_shot(vp)
            by_vp[vp] = {
                "screenshot_id": sh.id if sh else None,
                "image_size": [sh.width, sh.height] if sh else None,
                "bounding_box": m.bboxes.get(vp) or None,
            }
        primary = by_vp[m.evidence_viewport]
        evidence = {
            "screenshot": best_shot(m.evidence_viewport).file_path if best_shot(m.evidence_viewport) else None,
            "screenshot_id": primary["screenshot_id"],
            "image_size": primary["image_size"],
            "viewport": m.evidence_viewport,
            "element_selector": f.evidence.element_selector,
            "bounding_box": primary["bounding_box"],
            "by_viewport": by_vp,
        }
        db.add(Issue(
            scan_id=scan.id, project_id=scan.project_id, issue_key=f.issue_key[:300], rule_id=f.rule_id, title=f.title,
            category=f.category, severity=f.severity, description=f.description,
            viewport=", ".join(m.viewports), confidence=f.confidence, source=f.source, evidence=evidence,
            suggested_fix=f.suggested_fix.model_dump() if f.suggested_fix else None,
            reasoning=f.reasoning, status="open",
        ))
    scan.page_title, scan.final_url = result.page_title, result.final_url
    scan.console_errors = result.console_errors[:50]
    scan.failed_requests = result.failed_requests[:50]
    scan.analysis_mode = analysis.mode
    scan.ai_notes = analysis.notes
    scan.viewport_metrics = {
        name: {
            "width": vr.width, "height": vr.height, "scroll_width": vr.dom["scrollWidth"], "scroll_height": vr.dom["scrollHeight"],
            "element_count": vr.dom["elementCount"],
            "horizontal_overflow": vr.dom["scrollWidth"] > vr.dom["vw"] + 1,
            "issues": sum(1 for m in analysis.issues if name in m.viewports),
        }
        for name, vr in result.viewports.items()
    }
    db.commit()


def scan_issue_keys(db: Session, scan_id: int) -> set[str]:
    return set(db.scalars(select(Issue.issue_key).where(Issue.scan_id == scan_id)).all())
