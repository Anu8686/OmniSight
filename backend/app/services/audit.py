"""Audit trail for approvals and automated actions."""
from __future__ import annotations

from sqlalchemy.orm import Session

from app.models import AuditLog


def audit(db: Session, user_id: int | None, action: str, entity_type: str = "", entity_id: int | None = None, **detail) -> None:
    db.add(AuditLog(user_id=user_id, action=action, entity_type=entity_type, entity_id=entity_id, detail=detail))
    db.commit()
