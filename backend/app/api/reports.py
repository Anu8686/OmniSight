from __future__ import annotations

from fastapi import APIRouter, Depends, Query
from fastapi.responses import JSONResponse, Response
from sqlalchemy.orm import Session

from app.api.deps import current_user, owned_scan
from app.db.session import get_db
from app.models import User
from app.services.report_service import build_report, report_csv

router = APIRouter(prefix="/api/reports", tags=["reports"])


@router.get("/{scan_id}")
def get_report(
    scan_id: int, format: str = Query("json", pattern="^(json|csv)$"), download: bool = False,
    user: User = Depends(current_user), db: Session = Depends(get_db),
):
    report = build_report(db, owned_scan(db, user, scan_id))
    if format == "csv":
        return Response(report_csv(report), media_type="text/csv",
                        headers={"Content-Disposition": f'attachment; filename="omnisight-scan-{scan_id}.csv"'})
    headers = {"Content-Disposition": f'attachment; filename="omnisight-scan-{scan_id}.json"'} if download else {}
    return JSONResponse(report, headers=headers)
