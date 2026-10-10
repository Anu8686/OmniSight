"""Pydantic request/response models for the REST API."""
from __future__ import annotations

import re
from datetime import datetime
from typing import Any, Literal

from pydantic import BaseModel, ConfigDict, EmailStr, Field, field_validator

Environment = Literal["local", "development", "staging", "production"]
ViewportName = Literal["desktop", "tablet", "mobile"]
_GH_URL = re.compile(r"^https://github\.com/[\w.-]+/[\w.-]+/?$")


# ------------------------------------------------------------------ auth
class RegisterIn(BaseModel):
    name: str = Field(min_length=2, max_length=80)
    email: EmailStr
    password: str = Field(min_length=10, max_length=128)

    @field_validator("password")
    @classmethod
    def _strength(cls, v: str) -> str:
        if not (re.search(r"[A-Za-z]", v) and re.search(r"\d", v)):
            raise ValueError("Password must contain at least one letter and one number.")
        return v

    @field_validator("name")
    @classmethod
    def _name(cls, v: str) -> str:
        return v.strip()


class LoginIn(BaseModel):
    email: EmailStr
    password: str = Field(min_length=1, max_length=128)


class UserOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    name: str
    email: str
    created_at: datetime


class ProfileUpdate(BaseModel):
    name: str = Field(min_length=2, max_length=80)


# ------------------------------------------------------------------ projects
class ProjectBase(BaseModel):
    name: str = Field(min_length=2, max_length=160)
    description: str = Field(default="", max_length=2000)
    target_url: str = Field(max_length=2048)
    environment: Environment = "local"
    github_repo_url: str | None = Field(default=None, max_length=512)
    github_branch: str | None = Field(default=None, max_length=120)
    repo_path_prefix: str = Field(default="", max_length=255)
    source_dir: str | None = Field(default=None, max_length=1024)
    auth_instructions: str = Field(default="", max_length=2000)
    viewports: list[ViewportName] = Field(default_factory=lambda: ["desktop", "tablet", "mobile"], min_length=1)
    scan_notes: str = Field(default="", max_length=2000)
    expectations: str = Field(default="", max_length=2000)

    @field_validator("github_repo_url")
    @classmethod
    def _gh(cls, v: str | None) -> str | None:
        if v in (None, ""):
            return None
        if not _GH_URL.match(v.strip()):
            raise ValueError("Repository URL must look like https://github.com/owner/repo")
        return v.strip().rstrip("/")

    @field_validator("github_branch")
    @classmethod
    def _branch(cls, v: str | None) -> str | None:
        if v in (None, ""):
            return None
        if not re.match(r"^[\w./-]{1,120}$", v) or ".." in v:
            raise ValueError("Branch name contains unsupported characters.")
        return v

    @field_validator("repo_path_prefix")
    @classmethod
    def _prefix(cls, v: str) -> str:
        v = v.strip().strip("/")
        if ".." in v or v.startswith("/") or not re.match(r"^[\w./-]*$", v):
            raise ValueError("Repository path prefix is invalid.")
        return v

    @field_validator("viewports")
    @classmethod
    def _uniq(cls, v: list[str]) -> list[str]:
        return list(dict.fromkeys(v))


class ProjectCreate(ProjectBase):
    pass


class ProjectUpdate(BaseModel):
    name: str | None = Field(default=None, min_length=2, max_length=160)
    description: str | None = Field(default=None, max_length=2000)
    target_url: str | None = Field(default=None, max_length=2048)
    environment: Environment | None = None
    github_repo_url: str | None = None
    github_branch: str | None = None
    repo_path_prefix: str | None = None
    source_dir: str | None = None
    auth_instructions: str | None = Field(default=None, max_length=2000)
    viewports: list[ViewportName] | None = Field(default=None, min_length=1)
    scan_notes: str | None = Field(default=None, max_length=2000)
    expectations: str | None = Field(default=None, max_length=2000)
    status: Literal["active", "archived"] | None = None


class ProjectOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    name: str
    description: str
    target_url: str
    environment: str
    github_repo_url: str | None
    github_branch: str | None
    repo_path_prefix: str
    source_dir: str | None
    auth_instructions: str
    viewports: list[str]
    scan_notes: str
    expectations: str
    status: str
    is_demo: bool
    created_at: datetime
    updated_at: datetime
    scan_count: int = 0
    open_issue_count: int = 0
    total_issue_count: int = 0
    last_scan_at: datetime | None = None
    last_scan_status: str | None = None
    last_scan_id: int | None = None


# ------------------------------------------------------------------ scans
class ScanCreate(BaseModel):
    project_id: int
    viewports: list[ViewportName] | None = Field(default=None, min_length=1)


class ScreenshotOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    scan_id: int
    viewport: str
    kind: str
    width: int
    height: int
    url: str = ""


class ScanOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    project_id: int
    project_name: str = ""
    kind: str
    target_url: str
    status: str
    stage: str
    progress: int
    analysis_mode: str
    page_title: str | None
    final_url: str | None
    viewports: list[str]
    console_errors: list[str]
    failed_requests: list[dict[str, Any]]
    viewport_metrics: dict[str, Any]
    ai_notes: list[str]
    error_message: str | None
    created_at: datetime
    started_at: datetime | None
    finished_at: datetime | None
    issue_count: int = 0
    severity_counts: dict[str, int] = Field(default_factory=dict)
    screenshots: list[ScreenshotOut] = Field(default_factory=list)


# ------------------------------------------------------------------ issues / fixes
class FixOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    issue_id: int
    file: str
    explanation: str
    code: str
    original_snippet: str
    status: str
    origin: str
    patch: str | None
    approved_at: datetime | None
    pr_url: str | None
    pr_status: str | None
    pr_simulated: bool
    created_at: datetime
    can_apply: bool = False
    source_note: str = ""
    issue_title: str = ""
    issue_severity: str = ""
    project_id: int = 0
    project_name: str = ""
    latest_verification: "VerificationOut | None" = None


class VerificationOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    fix_id: int
    verification_scan_id: int | None
    resolved: bool
    status: str
    regressions: list[str]
    before_screenshot_id: int | None
    after_screenshot_id: int | None
    summary: str
    created_at: datetime


class IssueOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    scan_id: int
    project_id: int
    project_name: str = ""
    title: str
    category: str
    severity: str
    description: str
    viewport: str
    confidence: float
    source: str
    rule_id: str
    evidence: dict[str, Any]
    suggested_fix: dict[str, Any] | None
    reasoning: str
    status: str
    reviewer: str | None
    reviewer_comment: str
    created_at: datetime


class IssueDetail(IssueOut):
    fixes: list[FixOut] = Field(default_factory=list)
    verifications: list[VerificationOut] = Field(default_factory=list)


class IssueUpdate(BaseModel):
    status: Literal["open", "dismissed"] | None = None
    reviewer: str | None = Field(default=None, max_length=120)
    reviewer_comment: str | None = Field(default=None, max_length=2000)


class DecisionIn(BaseModel):
    comment: str = Field(default="", max_length=1000)


class Page(BaseModel):
    items: list[Any]
    total: int
    page: int
    page_size: int


# ------------------------------------------------------------------ github
class PullRequestIn(BaseModel):
    fix_id: int
    title: str | None = Field(default=None, max_length=200)
    commit_message: str | None = Field(default=None, max_length=300)
    approve: bool = Field(description="Must be true: explicit approval to write to the repository.")


class PullRequestPreviewIn(BaseModel):
    fix_id: int


FixOut.model_rebuild()
