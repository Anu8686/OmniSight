"""OmniSight API entrypoint."""
from __future__ import annotations

import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI, Request
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from sqlalchemy import text
from starlette.exceptions import HTTPException as StarletteHTTPException

from app.api import auth, dashboard, fixes, integrations, issues, projects, reports, scans
from app.core.config import get_settings
from app.core.logging import setup_logging
from app.db.session import SessionLocal, init_db

setup_logging()
log = logging.getLogger("omnisight")


@asynccontextmanager
async def lifespan(_: FastAPI):
    init_db()
    _recover_orphaned_scans()
    log.info("OmniSight API started (AI mode: %s, GitHub: %s)",
             "vlm+rules" if get_settings().ai_configured else "rule-based demo",
             "live" if get_settings().github_configured else "simulated")
    yield


def _recover_orphaned_scans() -> None:
    """Scans left 'running' by a previous process can never finish: mark them failed."""
    from app.models import Scan

    with SessionLocal() as db:
        for s in db.query(Scan).filter(Scan.status.in_(["queued", "running"])).all():
            s.status, s.stage, s.error_message = "failed", "Failed", "The server restarted while this scan was running."
        db.commit()


app = FastAPI(
    title="OmniSight API", version="1.0.0",
    description="AI-powered visual QA and human-approved self-healing agent.", lifespan=lifespan,
)
settings = get_settings()
app.add_middleware(
    CORSMiddleware,
    allow_origins=[settings.frontend_url], allow_credentials=True,
    allow_methods=["GET", "POST", "PATCH", "DELETE"], allow_headers=["Content-Type", "Authorization"],
)


@app.exception_handler(StarletteHTTPException)
async def http_exc(_: Request, exc: StarletteHTTPException):
    return JSONResponse({"detail": exc.detail}, status_code=exc.status_code, headers=getattr(exc, "headers", None))


@app.exception_handler(RequestValidationError)
async def validation_exc(_: Request, exc: RequestValidationError):
    msgs = []
    for e in exc.errors():
        loc = ".".join(str(x) for x in e["loc"] if x not in ("body", "query", "path"))
        msgs.append(f"{loc}: {e['msg']}" if loc else e["msg"])
    return JSONResponse({"detail": "; ".join(msgs) or "Invalid request.", "errors": [
        {"field": ".".join(str(x) for x in e["loc"][1:]), "message": e["msg"]} for e in exc.errors()
    ]}, status_code=422)


@app.exception_handler(Exception)
async def unhandled(_: Request, exc: Exception):
    log.exception("unhandled error")  # stack trace stays in server logs only
    return JSONResponse({"detail": "An unexpected server error occurred."}, status_code=500)


@app.get("/api/health", tags=["health"])
def health():
    db_ok = True
    try:
        with SessionLocal() as db:
            db.execute(text("SELECT 1"))
    except Exception:  # noqa: BLE001
        db_ok = False
    s = get_settings()
    return {
        "status": "ok" if db_ok else "degraded", "database": "ok" if db_ok else "error", "version": app.version,
        "ai_mode": "vlm+rules" if s.ai_configured else "rule-based-demo",
        "github_mode": "live" if s.github_configured else "simulated",
    }


for r in (auth, projects, scans, issues, fixes, integrations, reports, dashboard):
    app.include_router(r.router)
