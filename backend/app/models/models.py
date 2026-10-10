"""ORM models. Screenshots are stored on disk; the DB keeps only file references."""
from __future__ import annotations

from datetime import datetime, timezone

from sqlalchemy import JSON, Boolean, DateTime, Float, ForeignKey, Index, Integer, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.session import Base


def utcnow() -> datetime:
    return datetime.now(timezone.utc)


class User(Base):
    __tablename__ = "users"
    id: Mapped[int] = mapped_column(primary_key=True)
    email: Mapped[str] = mapped_column(String(255), unique=True, index=True)
    name: Mapped[str] = mapped_column(String(120))
    password_hash: Mapped[str] = mapped_column(String(255))
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)

    projects: Mapped[list["Project"]] = relationship(back_populates="owner", cascade="all, delete-orphan")


class Project(Base):
    __tablename__ = "projects"
    id: Mapped[int] = mapped_column(primary_key=True)
    owner_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), index=True)
    name: Mapped[str] = mapped_column(String(160))
    description: Mapped[str] = mapped_column(Text, default="")
    target_url: Mapped[str] = mapped_column(String(2048))
    environment: Mapped[str] = mapped_column(String(20), default="local")
    github_repo_url: Mapped[str | None] = mapped_column(String(512), nullable=True)
    github_branch: Mapped[str | None] = mapped_column(String(120), nullable=True)
    repo_path_prefix: Mapped[str] = mapped_column(String(255), default="")
    source_dir: Mapped[str | None] = mapped_column(String(1024), nullable=True)
    auth_instructions: Mapped[str] = mapped_column(Text, default="")
    viewports: Mapped[list] = mapped_column(JSON, default=lambda: ["desktop", "tablet", "mobile"])
    scan_notes: Mapped[str] = mapped_column(Text, default="")
    expectations: Mapped[str] = mapped_column(Text, default="")
    status: Mapped[str] = mapped_column(String(20), default="active")
    is_demo: Mapped[bool] = mapped_column(Boolean, default=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow, onupdate=utcnow)

    owner: Mapped[User] = relationship(back_populates="projects")
    scans: Mapped[list["Scan"]] = relationship(back_populates="project", cascade="all, delete-orphan")
    issues: Mapped[list["Issue"]] = relationship(back_populates="project", cascade="all, delete-orphan")


class Scan(Base):
    __tablename__ = "scans"
    __table_args__ = (Index("ix_scans_project_created", "project_id", "created_at"),)
    id: Mapped[int] = mapped_column(primary_key=True)
    project_id: Mapped[int] = mapped_column(ForeignKey("projects.id", ondelete="CASCADE"), index=True)
    kind: Mapped[str] = mapped_column(String(20), default="baseline")  # baseline | verification
    parent_fix_id: Mapped[int | None] = mapped_column(Integer, nullable=True)
    target_url: Mapped[str] = mapped_column(String(2048))
    status: Mapped[str] = mapped_column(String(20), default="queued", index=True)
    # queued | running | completed | failed | cancelled
    stage: Mapped[str] = mapped_column(String(60), default="Queued")
    progress: Mapped[int] = mapped_column(Integer, default=0)
    analysis_mode: Mapped[str] = mapped_column(String(30), default="rule-based-demo")
    page_title: Mapped[str | None] = mapped_column(String(512), nullable=True)
    final_url: Mapped[str | None] = mapped_column(String(2048), nullable=True)
    viewports: Mapped[list] = mapped_column(JSON, default=list)
    console_errors: Mapped[list] = mapped_column(JSON, default=list)
    failed_requests: Mapped[list] = mapped_column(JSON, default=list)
    viewport_metrics: Mapped[dict] = mapped_column(JSON, default=dict)
    ai_notes: Mapped[list] = mapped_column(JSON, default=list)
    error_message: Mapped[str | None] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)
    started_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    finished_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)

    project: Mapped[Project] = relationship(back_populates="scans")
    screenshots: Mapped[list["Screenshot"]] = relationship(back_populates="scan", cascade="all, delete-orphan")
    issues: Mapped[list["Issue"]] = relationship(back_populates="scan", cascade="all, delete-orphan")


class Screenshot(Base):
    __tablename__ = "screenshots"
    id: Mapped[int] = mapped_column(primary_key=True)
    scan_id: Mapped[int] = mapped_column(ForeignKey("scans.id", ondelete="CASCADE"), index=True)
    viewport: Mapped[str] = mapped_column(String(20))
    kind: Mapped[str] = mapped_column(String(20), default="viewport")  # viewport | fullpage
    width: Mapped[int] = mapped_column(Integer)
    height: Mapped[int] = mapped_column(Integer)
    file_path: Mapped[str] = mapped_column(String(1024))  # relative to DATA_DIR/screenshots
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)

    scan: Mapped[Scan] = relationship(back_populates="screenshots")


class Issue(Base):
    __tablename__ = "issues"
    __table_args__ = (Index("ix_issues_project_status", "project_id", "status"),)
    id: Mapped[int] = mapped_column(primary_key=True)
    scan_id: Mapped[int] = mapped_column(ForeignKey("scans.id", ondelete="CASCADE"), index=True)
    project_id: Mapped[int] = mapped_column(ForeignKey("projects.id", ondelete="CASCADE"), index=True)
    issue_key: Mapped[str] = mapped_column(String(300), index=True)  # stable id used to compare scans
    rule_id: Mapped[str] = mapped_column(String(60), default="")
    title: Mapped[str] = mapped_column(String(300))
    category: Mapped[str] = mapped_column(String(60), index=True)
    severity: Mapped[str] = mapped_column(String(20), index=True)  # critical|high|medium|low
    description: Mapped[str] = mapped_column(Text)
    viewport: Mapped[str] = mapped_column(String(80))  # e.g. "mobile" or "desktop, tablet"
    confidence: Mapped[float] = mapped_column(Float, default=0.5)
    source: Mapped[str] = mapped_column(String(20), default="rule-based")  # rule-based | vlm
    evidence: Mapped[dict] = mapped_column(JSON, default=dict)
    suggested_fix: Mapped[dict | None] = mapped_column(JSON, nullable=True)
    reasoning: Mapped[str] = mapped_column(Text, default="")
    status: Mapped[str] = mapped_column(String(24), default="open", index=True)
    reviewer: Mapped[str | None] = mapped_column(String(120), nullable=True)
    reviewer_comment: Mapped[str] = mapped_column(Text, default="")
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)

    scan: Mapped[Scan] = relationship(back_populates="issues")
    project: Mapped[Project] = relationship(back_populates="issues")
    fixes: Mapped[list["ProposedFix"]] = relationship(back_populates="issue", cascade="all, delete-orphan")


class ProposedFix(Base):
    __tablename__ = "proposed_fixes"
    id: Mapped[int] = mapped_column(primary_key=True)
    issue_id: Mapped[int] = mapped_column(ForeignKey("issues.id", ondelete="CASCADE"), index=True)
    file: Mapped[str] = mapped_column(String(512))
    explanation: Mapped[str] = mapped_column(Text, default="")
    code: Mapped[str] = mapped_column(Text)  # CSS block appended to `file` in the isolated workspace
    original_snippet: Mapped[str] = mapped_column(Text, default="")
    status: Mapped[str] = mapped_column(String(20), default="proposed", index=True)
    # proposed | approved | rejected | applied | verified | verification_failed | rolled_back
    origin: Mapped[str] = mapped_column(String(20), default="rule-based")
    workspace_path: Mapped[str | None] = mapped_column(String(1024), nullable=True)
    patch: Mapped[str | None] = mapped_column(Text, nullable=True)
    approved_by: Mapped[int | None] = mapped_column(Integer, nullable=True)
    approved_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    pr_url: Mapped[str | None] = mapped_column(String(512), nullable=True)
    pr_status: Mapped[str | None] = mapped_column(String(30), nullable=True)
    pr_simulated: Mapped[bool] = mapped_column(Boolean, default=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)

    issue: Mapped[Issue] = relationship(back_populates="fixes")
    verifications: Mapped[list["FixVerification"]] = relationship(back_populates="fix", cascade="all, delete-orphan")


class FixVerification(Base):
    __tablename__ = "fix_verifications"
    id: Mapped[int] = mapped_column(primary_key=True)
    fix_id: Mapped[int] = mapped_column(ForeignKey("proposed_fixes.id", ondelete="CASCADE"), index=True)
    verification_scan_id: Mapped[int | None] = mapped_column(Integer, nullable=True)
    resolved: Mapped[bool] = mapped_column(Boolean, default=False)
    status: Mapped[str] = mapped_column(String(20))  # passed | failed | error
    regressions: Mapped[list] = mapped_column(JSON, default=list)
    before_screenshot_id: Mapped[int | None] = mapped_column(Integer, nullable=True)
    after_screenshot_id: Mapped[int | None] = mapped_column(Integer, nullable=True)
    summary: Mapped[str] = mapped_column(Text, default="")
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)

    fix: Mapped[ProposedFix] = relationship(back_populates="verifications")


class Integration(Base):
    __tablename__ = "integrations"
    id: Mapped[int] = mapped_column(primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), index=True)
    provider: Mapped[str] = mapped_column(String(30))  # github
    repository: Mapped[str | None] = mapped_column(String(255), nullable=True)
    branch: Mapped[str | None] = mapped_column(String(120), nullable=True)
    last_checked_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    last_status: Mapped[str | None] = mapped_column(String(40), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)
    # NOTE: tokens are never stored in the database; they come from server environment variables.


class AuditLog(Base):
    __tablename__ = "audit_logs"
    id: Mapped[int] = mapped_column(primary_key=True)
    user_id: Mapped[int | None] = mapped_column(Integer, nullable=True, index=True)
    action: Mapped[str] = mapped_column(String(80), index=True)
    entity_type: Mapped[str] = mapped_column(String(40), default="")
    entity_id: Mapped[int | None] = mapped_column(Integer, nullable=True)
    detail: Mapped[dict] = mapped_column(JSON, default=dict)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow, index=True)
